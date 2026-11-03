import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleSession, pinsEqual, ipKeyFor } from '../.build/session.js';
import { LimiterStore } from '../.build/limiter-store.js';
import { readLimits } from '../.build/types.js';

const ORIGIN = 'https://demo.github.io';
const PIN = 'MOCK-only-passphrase-123';

function sqlStorage() {
  const db = new DatabaseSync(':memory:');
  return {
    sql: {
      exec(statement, ...params) {
        const stmt = db.prepare(statement);
        if (/^\s*(SELECT|WITH)/i.test(statement)) {
          const rows = stmt.all(...params);
          return { one: () => { if (!rows.length) throw new Error('No row'); return rows[0]; }, toArray: () => rows };
        }
        stmt.run(...params);
        return { one: () => { throw new Error('Not a query'); }, toArray: () => [] };
      },
    },
    transactionSync(callback) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}
function fixture(options = {}) {
  const storage = sqlStorage();
  const env = {
    LIVE_ENABLED: 'true', ALLOWED_ORIGIN: ORIGIN,
    AGENT_ID: 'agent_FAKE1234567890123', DEMO_PIN: PIN,
    ELEVENLABS_API_KEY: 'TEST_FAKE_NO_REAL_PROVIDER',
    IP_HASH_KEY: 'MOCK_hmac_material_not_a_live_secret_0123456789',
    ...options,
  };
  const store = new LimiterStore(storage, readLimits(env));
  let providerCalls = 0;
  const providerFetch = async (url, init) => {
    providerCalls++;
    assert.match(url, /^https:\/\/api\.elevenlabs\.io\/v1\/convai\/conversation\/token\?agent_id=agent_FAKE/);
    assert.equal(init.method, 'GET');
    assert.equal(init.headers['xi-api-key'], env.ELEVENLABS_API_KEY);
    return Response.json({ token: `fake-token-${providerCalls}`, conversation_id: 'private-meta-not-for-browser' });
  };
  env.ACCESS_LIMITER = {
    idFromName(name) { assert.equal(name, 'demo-global'); return name; },
    get() { return {
      async check(key) { return store.check(key); },
      async decide(key, matches) { return store.decide(key, matches); },
    }; },
  };
  const call = (body = { pin: PIN }, {
    ip = '198.51.100.5', origin = ORIGIN, method = 'POST', contentType = 'application/json',
    url = 'https://worker.test/api/session', extraHeaders = {}, fetchProvider = providerFetch,
  } = {}) => {
    const headers = { 'Content-Type': contentType, 'CF-Connecting-IP': ip, ...extraHeaders };
    if (origin !== null) headers.Origin = origin;
    const request = new Request(url, { method, headers, body: method === 'POST' ?
      typeof body === 'string' ? body : JSON.stringify(body) : undefined });
    return handleSession(request, env, fetchProvider);
  };
  return { call, env, store, storage, get providerCalls() { return providerCalls; } };
}
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['error', 'message']);
  assert.equal(data.error, code);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
}

test('approved request returns exclusively conversationToken and safe headers', async () => {
  const f = fixture();
  const response = await f.call();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { conversationToken: 'fake-token-1' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(f.providerCalls, 1);
  f.storage.close();
});

test('wrong PIN and constant-width digest comparison', async () => {
  const f = fixture();
  await expectError(await f.call({pin: 'bad-pin-value'}), 401, 'ACCESS_DENIED');
  assert.equal(await pinsEqual(PIN, PIN), true);
  assert.equal(await pinsEqual(PIN + 'x', PIN), false);
  assert.equal(f.providerCalls, 0);
  f.storage.close();
});

test('forbidden or missing Origin have no CORS header, no provider call', async () => {
  const f = fixture();
  for (const origin of [null, 'https://evil.example', `${ORIGIN}/repo`, 'http://demo.github.io']) {
    const result = await f.call({pin: PIN}, {origin});
    await expectError(result, 403, 'ORIGIN_FORBIDDEN');
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(f.providerCalls, 0);
  f.storage.close();
});

test('OPTIONS allowed, preflight forbidden, GET is 405', async () => {
  const f = fixture();
  const allowed = await f.call(null, { method: 'OPTIONS' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(allowed.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  await expectError(await f.call(null, { method: 'OPTIONS', origin: 'https://evil.example' }), 403, 'ORIGIN_FORBIDDEN');
  const get = await f.call(null, { method: 'GET' });
  await expectError(get, 405, 'METHOD_NOT_ALLOWED');
  assert.equal(get.headers.get('Allow'), 'POST, OPTIONS');
  assert.equal(f.providerCalls, 0);
  f.storage.close();
});

test('schema, query, Content-Type, JSON, oversized body rejected without provider', async () => {
  const f = fixture();
  for (const body of ['not json', 'null', '[]', '{}', '{"pin":123}', '{"pin":"short"}',
    '{"pin":"abcdefgh","role":"patient"}']) {
    await expectError(await f.call(body), 400, 'BAD_REQUEST');
  }
  await expectError(await f.call({pin: PIN}, {contentType: 'text/plain'}), 400, 'BAD_REQUEST');
  await expectError(await f.call({pin: PIN}, {url: 'https://worker.test/api/session?pin=x'}), 400, 'BAD_REQUEST');
  await expectError(await f.call({pin: 'x'.repeat(1100)}), 413, 'PAYLOAD_TOO_LARGE');
  assert.equal(f.providerCalls, 0);
  f.storage.close();
});

test('5 wrong PIN/IP in rolling window, then block even if PIN correct; other IP independent', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) await expectError(await f.call({pin: 'invalid-passphrase'}), 401, 'ACCESS_DENIED');
  await expectError(await f.call(), 429, 'RATE_LIMITED');
  await expectError(await f.call({pin: 'invalid-passphrase'}), 429, 'RATE_LIMITED');
  assert.equal((await f.call({pin: PIN}, {ip: '198.51.100.6'})).status, 200);
  assert.equal(f.providerCalls, 1);
  f.storage.close();
});

test('max 3 reservations/IP/15min, including provider failure', async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) assert.equal((await f.call()).status, 200);
  await expectError(await f.call(), 429, 'RATE_LIMITED');
  assert.equal(f.providerCalls, 3);
  f.storage.close();
});

test('12 global reservations/UTC-day, concurrent requests from 20 IP addresses', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({length:20}, (_, i) =>
    f.call({pin: PIN}, {ip: `198.51.100.${i + 1}`})));
  assert.equal(results.filter(r => r.status === 200).length, 12);
  assert.equal(results.filter(r => r.status === 429).length, 8);
  assert.equal(f.providerCalls, 12);
  f.storage.close();
});

test('upstream failures 502, and reservation is not refunded', async () => {
  const f = fixture();
  const failure = async () => new Response('not authorized', {status: 422});
  await expectError(await f.call({pin: PIN},{fetchProvider: failure}), 502, 'UPSTREAM_FAILURE');
  const malformed = async () => Response.json({conversation_id:'x'});
  await expectError(await f.call({pin: PIN},{fetchProvider: malformed}), 502, 'UPSTREAM_FAILURE');
  const noJson = async () => new Response('{malformed', {status:200});
  await expectError(await f.call({pin: PIN},{fetchProvider: noJson}), 502, 'UPSTREAM_FAILURE');
  await expectError(await f.call(), 429, 'RATE_LIMITED');
  assert.equal(f.providerCalls, 0);
  f.storage.close();
});

test('failed fetch/timeout rejection 502', async () => {
  const f = fixture();
  await expectError(await f.call({pin:PIN}, {fetchProvider: async () => {throw new Error('network');}}), 502, 'UPSTREAM_FAILURE');
  f.storage.close();
});

test('LIVE_ENABLED=false and missing config/secret/DO/IP fail closed', async () => {
  for (const changed of [
    { LIVE_ENABLED: 'false' }, {DEMO_PIN: undefined}, {ELEVENLABS_API_KEY: undefined},
    {IP_HASH_KEY: undefined}, {ACCESS_LIMITER: undefined}, {AGENT_ID: undefined},
    {MAX_TOKENS_PER_DAY: '1000'}, {ALLOWED_ORIGIN: undefined},
  ]) {
    const f = fixture();
    Object.assign(f.env, changed);
    await expectError(await f.call(), 503, 'SERVICE_UNAVAILABLE');
    assert.equal(f.providerCalls, 0);
    f.storage.close();
  }
  const f = fixture();
  await expectError(await f.call({pin: PIN}, {ip: ''}), 503, 'SERVICE_UNAVAILABLE');
  f.env.ACCESS_LIMITER.get = () => {throw new Error('DO unreachable');};
  await expectError(await f.call(), 503, 'SERVICE_UNAVAILABLE');
  f.storage.close();
});

test('rolling 15m expirations, UTC day rollover and 48h cleanup in SQLite', () => {
  const storage = sqlStorage();
  const store = new LimiterStore(storage, {failures: 2, ipTokens: 2, dayTokens: 2});
  const t = Date.parse('2026-11-02T23:59:00.000Z');
  assert.equal(store.decide('a', false, t), 'denied');
  assert.equal(store.decide('a', false, t + 10), 'denied');
  assert.equal(store.check('a', t + 11), 'limited');
  assert.equal(store.check('a', t + 900001), 'ok');
  assert.equal(store.decide('b', true, t), 'issued');
  assert.equal(store.decide('c', true, t), 'issued');
  assert.equal(store.decide('d', true, t), 'limited');
  assert.equal(store.decide('d', true, t + 120000), 'issued');
  assert.equal(store.decide('e', true, t + 172920001), 'issued');
  const row = storage.sql.exec('SELECT COUNT(*) AS n FROM access_events').one();
  assert.equal(row.n, 1);
  storage.close();
});

test('IP is HMAC-pseudonymized, never retained in SQL rows', async () => {
  const f = fixture();
  await f.call();
  const key = await ipKeyFor('198.51.100.5', f.env.IP_HASH_KEY);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(f.storage.sql.exec('SELECT ip_key AS n FROM access_events').one().n, key);
  assert.equal(JSON.stringify(f.storage.sql.exec('SELECT * FROM access_events').toArray()).includes('198.51'), false);
  f.storage.close();
});

test('upstream timeout aborts stalled fake fetch after 6 seconds', async () => {
  const f = fixture();
  const started = Date.now();
  const blocked = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once:true});
  });
  await expectError(await f.call({pin:PIN}, {fetchProvider:blocked}), 502, 'UPSTREAM_FAILURE');
  assert.ok(Date.now() - started >= 5900, 'AbortSignal must trigger the timeout');
  f.storage.close();
});
