import { type Limits, type SqlStorage } from './types.js';

const WINDOW_MS = 15 * 60 * 1000;
const RETAIN_MS = 48 * 60 * 60 * 1000;
export type CheckResult = 'ok' | 'limited';
export type DecideResult = 'issued' | 'denied' | 'limited';

/**
 * A SQLite-backed, globally shared Durable Object holds this store.
 * Critical count+write steps execute in one *synchronous* storage transaction.
 * This implementation contains no IP, PIN or bearer token values.
 */
export class LimiterStore {
  constructor(private readonly storage: SqlStorage, private readonly limits: Limits) {
    storage.sql.exec(`CREATE TABLE IF NOT EXISTS access_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_key TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('failure','token')),
      time_ms INTEGER NOT NULL,
      utc_day TEXT NOT NULL
    )`);
    storage.sql.exec(`CREATE INDEX IF NOT EXISTS access_ip_kind_time
      ON access_events(ip_key,kind,time_ms)`);
    storage.sql.exec(`CREATE INDEX IF NOT EXISTS access_day_kind
      ON access_events(utc_day,kind)`);
  }

  private countIp(ipKey: string, kind: 'failure' | 'token', now: number): number {
    const row = this.storage.sql.exec<{ n: number }>(
      'SELECT COUNT(*) AS n FROM access_events WHERE ip_key=? AND kind=? AND time_ms>?',
      ipKey, kind, now - WINDOW_MS,
    ).one();
    return row.n;
  }

  private countDay(day: string): number {
    return this.storage.sql.exec<{ n: number }>(
      "SELECT COUNT(*) AS n FROM access_events WHERE kind='token' AND utc_day=?", day,
    ).one().n;
  }

  /** Also invoked by a best-effort DO alarm so an idle object gets pruned. */
  prune(now = Date.now()): void {
    this.storage.sql.exec('DELETE FROM access_events WHERE time_ms<?', now - RETAIN_MS);
  }

  /** Check BEFORE PIN comparison. Reservation checks the failure count again. */
  check(ipKey: string, now = Date.now()): CheckResult {
    return this.countIp(ipKey, 'failure', now) >= this.limits.failures ? 'limited' : 'ok';
  }

  /** Atomically record a failure OR reserve a token *before* provider contact. */
  decide(ipKey: string, pinMatches: boolean, now = Date.now()): DecideResult {
    return this.storage.transactionSync(() => {
      this.storage.sql.exec('DELETE FROM access_events WHERE time_ms<?', now - RETAIN_MS);
      if (this.countIp(ipKey, 'failure', now) >= this.limits.failures) return 'limited';
      const utcDay = new Date(now).toISOString().slice(0, 10);
      if (!pinMatches) {
        this.storage.sql.exec(
          "INSERT INTO access_events(ip_key,kind,time_ms,utc_day) VALUES (?,'failure',?,?)",
          ipKey, now, utcDay,
        );
        return 'denied';
      }
      if (this.countIp(ipKey, 'token', now) >= this.limits.ipTokens ||
          this.countDay(utcDay) >= this.limits.dayTokens) return 'limited';
      this.storage.sql.exec(
        "INSERT INTO access_events(ip_key,kind,time_ms,utc_day) VALUES (?,'token',?,?)",
        ipKey, now, utcDay,
      );
      return 'issued';
    });
  }
}
