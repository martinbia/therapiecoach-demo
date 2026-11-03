import { type Env, readLimits } from './types.js';

type ErrorCode = 'BAD_REQUEST' | 'ACCESS_DENIED' | 'ORIGIN_FORBIDDEN' |
  'METHOD_NOT_ALLOWED' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' |
  'UPSTREAM_FAILURE' | 'SERVICE_UNAVAILABLE';

const MAX_BODY_BYTES = 1024;
const PROVIDER_TIMEOUT_MS = 6000;
const encoder = new TextEncoder();

const MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Anfrage nicht gueltig.',
  ACCESS_DENIED: 'Zugang nicht moeglich.',
  ORIGIN_FORBIDDEN: 'Zugriff nicht erlaubt.',
  METHOD_NOT_ALLOWED: 'Methode nicht erlaubt.',
  PAYLOAD_TOO_LARGE: 'Anfrage zu gross.',
  RATE_LIMITED: 'Zugang voruebergehend nicht moeglich.',
  UPSTREAM_FAILURE: 'Sprachdienst voruebergehend nicht verfuegbar.',
  SERVICE_UNAVAILABLE: 'Dienst zurzeit nicht verfuegbar.',
};

function reply(
  status: number, content: unknown, originAllowed: boolean, origin: string,
  moreHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    ...moreHeaders,
  });
  if (originAllowed) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(JSON.stringify(content), { status, headers });
}
function error(
  status: number, code: ErrorCode, originAllowed: boolean, origin: string,
  headers?: Record<string, string>,
): Response {
  return reply(status, { error: code, message: MESSAGES[code] }, originAllowed, origin, headers);
}

function originIsConfigured(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.origin === origin;
  } catch { return false; }
}

async function readLimitedBody(request: { body: ReadableStream<Uint8Array> | null }, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Both candidate and server-side PIN hashed; loop compares full fixed-width digests. */
export async function pinsEqual(candidate: string, configured: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(candidate), digest(configured)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

/** HMAC-blind the source IP before anything is stored in the Durable Object. */
export async function ipKeyFor(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(ip)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type ProviderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** No fake/token provider route is exported. Inject fetch only in unit/integration tests. */
export async function fetchConversationToken(env: Env, providerFetch: ProviderFetch): Promise<string> {
  const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
  url.searchParams.set('agent_id', env.AGENT_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const provider = await providerFetch(url.toString(), {
      method: 'GET',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Accept': 'application/json' },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!provider.ok) throw new Error('Upstream status not successful');
    // Reject oversized provider responses instead of retaining arbitrary data.
    const data = await readLimitedBody(provider, 4096);
    if (!data) throw new Error('Upstream response too big');
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    if (!parsed || typeof parsed !== 'object' || !('token' in parsed) ||
      typeof parsed.token !== 'string' || parsed.token.length === 0 || parsed.token.length > 4096) {
      throw new Error('Upstream missing token');
    }
    return parsed.token;
  } finally { clearTimeout(timer); }
}

/** Public HTTP contract: POST /api/session -> {conversationToken} or neutral errors. */
export async function handleSession(
  request: Request, env: Env, providerFetch: ProviderFetch = fetch,
): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  // A missing/malformed dashboard configuration is a service outage, not an open CORS rule.
  if (!originIsConfigured(env.ALLOWED_ORIGIN)) return error(503, 'SERVICE_UNAVAILABLE', false, origin);
  const allowed = origin !== '' && origin === env.ALLOWED_ORIGIN && originIsConfigured(env.ALLOWED_ORIGIN);
  const path = new URL(request.url);
  if (path.pathname !== '/api/session' || path.search !== '') {
    return error(400, 'BAD_REQUEST', allowed, origin);
  }
  if (!allowed) return error(403, 'ORIGIN_FORBIDDEN', false, origin);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '0',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    } });
  }
  if (request.method !== 'POST') {
    return error(405, 'METHOD_NOT_ALLOWED', true, origin, { Allow: 'POST, OPTIONS' });
  }
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    return error(413, 'PAYLOAD_TOO_LARGE', true, origin);
  }
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/i.test(request.headers.get('Content-Type') ?? '')) {
    return error(400, 'BAD_REQUEST', true, origin);
  }
  let pin: string;
  try {
    const body = await readLimitedBody(request, MAX_BODY_BYTES);
    if (body === null) return error(413, 'PAYLOAD_TOO_LARGE', true, origin);
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid');
    const fields = Object.keys(parsed);
    if (fields.length !== 1 || fields[0] !== 'pin') throw new Error('Unexpected fields');
    const value = (parsed as Record<string, unknown>).pin;
    if (typeof value !== 'string' || value.length < 6 || value.length > 128) throw new Error('Invalid pin');
    pin = value;
  } catch { return error(400, 'BAD_REQUEST', true, origin); }

  // All service failures default closed. DO failure, missing IP or secrets -> 503.
  if (env.LIVE_ENABLED !== 'true') return error(503, 'SERVICE_UNAVAILABLE', true, origin);
  const ip = request.headers.get('CF-Connecting-IP');
  try {
    readLimits(env);
    if (!originIsConfigured(env.ALLOWED_ORIGIN) ||
        !/^agent_[A-Za-z0-9_-]{8,128}$/.test(env.AGENT_ID ?? '') ||
        typeof env.DEMO_PIN !== 'string' || env.DEMO_PIN.length < 6 || env.DEMO_PIN.length > 128 ||
        typeof env.ELEVENLABS_API_KEY !== 'string' || env.ELEVENLABS_API_KEY.length < 1 ||
        typeof env.IP_HASH_KEY !== 'string' || env.IP_HASH_KEY.length < 32 ||
        !ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip) ||
        !env.ACCESS_LIMITER) throw new Error('Missing configuration');

    const ipKey = await ipKeyFor(ip, env.IP_HASH_KEY);
    const limiter = env.ACCESS_LIMITER.get(env.ACCESS_LIMITER.idFromName('demo-global'));
    const check = await limiter.check(ipKey);
    if (check !== 'ok' && check !== 'limited') throw new Error('Unrecognised limiter reply');
    if (check === 'limited') return error(429, 'RATE_LIMITED', true, origin);
    const matches = await pinsEqual(pin, env.DEMO_PIN);
    const verdict = await limiter.decide(ipKey, matches);
    if (!['issued', 'denied', 'limited'].includes(verdict)) throw new Error('Unrecognised limiter reply');
    if (verdict === 'limited') return error(429, 'RATE_LIMITED', true, origin);
    if (verdict === 'denied') return error(401, 'ACCESS_DENIED', true, origin);
    // Impossible state must fail closed, never issue a token on a wrong PIN.
    if (!matches) return error(503, 'SERVICE_UNAVAILABLE', true, origin);
  } catch { return error(503, 'SERVICE_UNAVAILABLE', true, origin); }

  try {
    const token = await fetchConversationToken(env, providerFetch);
    return reply(200, { conversationToken: token }, true, origin);
  } catch { return error(502, 'UPSTREAM_FAILURE', true, origin); }
}
