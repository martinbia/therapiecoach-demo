import { DurableObject } from 'cloudflare:workers';
import { LimiterStore } from './limiter-store.js';
import { handleSession } from './session.js';
import { type Env, readLimits } from './types.js';

/** One SQLite-backed object: do not change idFromName('demo-global') in V1. */
export class AccessLimiter extends DurableObject<Env> {
  private readonly store: LimiterStore;

  constructor(ctx: ConstructorParameters<typeof DurableObject<Env>>[0], env: Env) {
    super(ctx, env);
    this.store = new LimiterStore(ctx.storage, readLimits(env));
  }

  // Only callable via a Cloudflare DO binding, not from the public HTTP API.
  async check(ipKey: string): Promise<'ok' | 'limited'> {
    if (!/^[0-9a-f]{64}$/.test(ipKey)) throw new Error('Invalid caller data');
    return this.store.check(ipKey);
  }

  async decide(ipKey: string, matches: boolean): Promise<'issued' | 'denied' | 'limited'> {
    if (!/^[0-9a-f]{64}$/.test(ipKey) || typeof matches !== 'boolean') {
      throw new Error('Invalid caller data');
    }
    const result = this.store.decide(ipKey, matches);
    if (result === 'issued' || result === 'denied') {
      // No open timer: an alarm prunes even if no further requests arrive.
      // Failure to schedule throws: caller fails closed (reservation stays used).
      await this.ctx.storage.setAlarm(Date.now() + 48 * 60 * 60 * 1000 + 120000);
    }
    return result;
  }

  alarm(): void {
    this.store.prune();
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleSession(request, env);
  },
};
