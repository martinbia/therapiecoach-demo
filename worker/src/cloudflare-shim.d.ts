/** Minimal build-time declarations for the Cloudflare runtime module.
 * This lets `tsc` check without installing a separate Workers type package.
 * Cloudflare itself provides the actual `cloudflare:workers` module at runtime.
 */
declare module 'cloudflare:workers' {
  export class DurableObject<TEnv> {
    protected ctx: { storage: import('./types.js').SqlStorage & { setAlarm(at: number): Promise<void> } };
    protected env: TEnv;
    constructor(ctx: { storage: import('./types.js').SqlStorage & { setAlarm(at: number): Promise<void> } }, env: TEnv);
  }
}
