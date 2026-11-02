import './style.css';
import { AppStore } from './core/store.ts';
import { ActionDispatcher } from './core/dispatcher.ts';
import { MockVoiceAdapter } from './voice/mock.ts';
import { PinDialog, WorkerSessionTokenProvider } from './access/token.ts';
import { AppUI } from './ui/app.ts';
import { SafetyController } from './core/safety.ts';
import type { ClientToolName, VoiceEvent } from './core/types.ts';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing app root.');
const pinMount = document.createElement('div');
pinMount.id = 'pin-mount';
document.body.append(pinMount);
const pin = new PinDialog(pinMount);
const store = new AppStore();
const dispatcher = new ActionDispatcher(store);
const mode = import.meta.env.VITE_VOICE_MODE === 'elevenlabs' ? 'elevenlabs' : 'mock';
const worker = mode === 'elevenlabs' ? new WorkerSessionTokenProvider(import.meta.env.VITE_WORKER_BASE_URL ?? '', pin) : null;
const dispatchTool = async (name: ClientToolName, args: unknown, generationId: number) => dispatcher.dispatchTool(name, args, generationId);
const mock = mode === 'mock' ? new MockVoiceAdapter(dispatchTool) : null;
// SDK is loaded only in live mode; the Mock PWA does not download ElevenLabs code.
const voice = mock ?? new (await import('./voice/elevenlabs.ts')).ElevenLabsAdapter(() => worker!.getToken(), dispatchTool);
const ui = new AppUI(app, store, dispatcher, voice, mock, pin, mode);
const safety = new SafetyController(voice, ui.media, dispatcher, worker ?? undefined);
ui.setSafety(safety);
voice.subscribe((event: VoiceEvent) => {
  if (event.type === 'state') store.patch({voice:event.state});
  if (event.type === 'finalUserText') dispatcher.recordFinalUserText(event.text, event.generationId);
  if (event.type === 'error') store.patch({status:`Sprachmodul: ${event.code}. Bitte erneut starten.`});
});
// Never reconnect automatically after reload or when the app leaves the foreground.
window.addEventListener('pagehide', () => { safety.stopAll(); });
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {scope:import.meta.env.BASE_URL}).catch(() => {
      // Unsupported, blocked or private browser: no loss of core UI functionality.
    });
  });
}
