/** API_CONTRACT.md v1.0 - only private server-side bindings. */
export interface LimiterStub {
  check(ipKey: string): Promise<'ok' | 'limited'>;
  decide(ipKey: string, matches: boolean): Promise<'issued' | 'denied' | 'limited'>;
}
export interface LimiterNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): LimiterStub;
}
export interface Env {
  ACCESS_LIMITER: LimiterNamespace;
  LIVE_ENABLED: string;
  ALLOWED_ORIGIN: string;
  AGENT_ID: string;
  DEMO_PIN: string;
  ELEVENLABS_API_KEY: string;
  IP_HASH_KEY: string;
  /** Optional tighter limits; >default is rejected, never silently expanded. */
  MAX_FAILED_PER_IP?: string;
  MAX_TOKENS_PER_IP?: string;
  MAX_TOKENS_PER_DAY?: string;
}
export interface SqlCursor<T> {
  one(): T;
  toArray(): T[];
}
export interface SqlInterface {
  exec<T extends Record<string, unknown> = Record<string, unknown>>(
    statement: string, ...params: (string | number)[]
  ): SqlCursor<T>;
}
export interface SqlStorage {
  sql: SqlInterface;
  transactionSync<T>(callback: () => T): T;
}
export interface Limits {
  failures: number;
  ipTokens: number;
  dayTokens: number;
}
export const DEFAULT_LIMITS: Limits = Object.freeze({ failures: 5, ipTokens: 3, dayTokens: 12 });

export function readLimits(env: Partial<Env>): Limits {
  function limit(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    if (!/^[1-9][0-9]*$/.test(value)) throw new Error('Invalid limit');
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n > fallback) throw new Error('Limit exceeds contract');
    return n;
  }
  return {
    failures: limit(env.MAX_FAILED_PER_IP, DEFAULT_LIMITS.failures),
    ipTokens: limit(env.MAX_TOKENS_PER_IP, DEFAULT_LIMITS.ipTokens),
    dayTokens: limit(env.MAX_TOKENS_PER_DAY, DEFAULT_LIMITS.dayTokens),
  };
}
