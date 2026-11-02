// Only the worker verifies PINs. No secret or durable PIN storage in the PWA.
export class AccessError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export class PinDialog {
  private active: {resolve: (pin: string) => void; reject: (err: Error) => void} | null = null;
  constructor(private root: HTMLElement) {}
  ask(): Promise<string> {
    if (this.active) return Promise.reject(new AccessError('ALREADY_OPEN', 'PIN-Eingabe bereits geöffnet.'));
    return new Promise<string>((resolve, reject) => {
      this.active = {resolve, reject};
      this.root.innerHTML = `<div class="dialog-shade" role="dialog" aria-modal="true" aria-labelledby="pin-title"><form class="pin-dialog" id="pin-form" aria-label="Geschützter Sprachzugang">
        <div class="pin-heading" id="pin-title">Sprachcoach freischalten</div>
        <p>Gib die Demo-PIN / Passphrase ein (6–128 Zeichen). Die Eingabe wird nicht gespeichert.</p>
        <label for="demo-pin">PIN / Passphrase</label>
        <input id="demo-pin" type="password" minlength="6" maxlength="128" autocomplete="off" required spellcheck="false" inputmode="text">
        <p class="micro-note">Nur an den Cloudflare Worker über HTTPS. Keine echten Patientendaten eingeben.</p>
        <div class="dialog-actions"><button type="button" class="btn light" id="cancel-pin">Abbrechen</button><button type="submit" class="btn primary">Verbinden</button></div>
      </form></div>`;
      const input = this.root.querySelector<HTMLInputElement>('#demo-pin')!;
      const cancel = this.root.querySelector<HTMLButtonElement>('#cancel-pin')!;
      const form = this.root.querySelector<HTMLFormElement>('#pin-form')!;
      cancel.addEventListener('click', () => this.cancel());
      input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); this.cancel(); } });
      form.addEventListener('submit', event => {
        event.preventDefault();
        const pin = input.value;
        if (pin.length < 6 || pin.length > 128) { input.reportValidity(); return; }
        input.value = '';
        this.active = null;
        this.root.replaceChildren();
        resolve(pin);
      });
      input.focus();
    });
  }
  cancel(): void {
    if (!this.active) return;
    const reject = this.active.reject;
    const input = this.root.querySelector<HTMLInputElement>('#demo-pin');
    if (input) input.value = '';
    this.active = null;
    this.root.replaceChildren();
    reject(new AccessError('CANCELLED', 'Zugangseingabe abgebrochen.'));
  }
  isOpen(): boolean { return Boolean(this.active); }
}

export class WorkerSessionTokenProvider {
  private controllers = new Set<AbortController>();
  constructor(private baseUrl: string, private pinDialog: PinDialog) {}
  cancel(): void {
    this.pinDialog.cancel();
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }
  async getToken(): Promise<string> {
    if (!this.baseUrl.startsWith('https://')) throw new AccessError('SERVICE_UNAVAILABLE', 'Worker-URL fehlt oder ist nicht HTTPS.');
    const pin = await this.pinDialog.ask();
    const controller = new AbortController();
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/session`, {
        method:'POST', mode:'cors', credentials:'omit', cache:'no-store', redirect:'error',
        referrerPolicy:'no-referrer', headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify({pin}), signal:controller.signal,
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = value && typeof value === 'object' && 'error' in value && typeof value.error === 'string' ? value.error : 'SERVICE_UNAVAILABLE';
        const known = ['BAD_REQUEST','ACCESS_DENIED','ORIGIN_FORBIDDEN','METHOD_NOT_ALLOWED','PAYLOAD_TOO_LARGE','RATE_LIMITED','UPSTREAM_FAILURE','SERVICE_UNAVAILABLE'];
        throw new AccessError(known.includes(code) ? code : 'SERVICE_UNAVAILABLE', 'Geschützter Zugang nicht möglich. Bitte Einstellung und PIN prüfen.');
      }
      if (!value || typeof value !== 'object' || !('conversationToken' in value) || typeof value.conversationToken !== 'string' || !value.conversationToken) {
        throw new AccessError('UPSTREAM_FAILURE', 'Ungültige Token-Antwort.');
      }
      return value.conversationToken;
    } catch (e) {
      if (e instanceof AccessError) throw e;
      throw new AccessError('SERVICE_UNAVAILABLE', 'Verbindung zum Zugangsdienst fehlgeschlagen.');
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
      // pin is a transient function-local immutable string; no browser persistence.
    }
  }
}
