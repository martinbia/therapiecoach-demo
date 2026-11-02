import type { ActionResult, ClientToolName, ConversationContext } from '../core/types.ts';
import { BaseVoiceAdapter } from './base.ts';
import type { DispatchTool } from './voice-types.ts';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export class MockVoiceAdapter extends BaseVoiceAdapter {
  connectDelayMs = 350;
  failNextStart = false;
  private proactiveTimer: ReturnType<typeof setInterval> | null = null;
  private synthVoice = false;
  onAnnaText?: (text: string) => void;
  constructor(private dispatchTool: DispatchTool) { super(); }
  enableSpeechSynthesis(enabled: boolean): void { this.synthVoice = enabled; }
  async start(context: ConversationContext): Promise<void> {
    const gen = this.begin(context);
    if (gen === null) return;
    const shouldFail = this.failNextStart;
    this.failNextStart = false;
    await wait(this.connectDelayMs);
    if (!this.valid(gen)) return;
    if (shouldFail) { this.fail(gen, 'MOCK_CONNECT_ERROR'); return; }
    this.activate(gen);
    this.say('Hallo, ich bin Anna. Dies ist eine Simulation ohne Mikrofon oder Cloud.');
    this.updateContext(context);
  }
  async setMuted(muted: boolean): Promise<void> {
    if (this.state.phase !== 'active' && this.state.phase !== 'connecting') return;
    await this.applyMute(muted, this.videoSuppressed);
  }
  protected async applyMute(userMuted: boolean, videoSuppressed: boolean): Promise<void> {
    if (this.state.phase === 'active' || this.state.phase === 'connecting') {
      if (userMuted || videoSuppressed) this.cancelSpeech();
      this.patch({userMuted, effectiveMuted:userMuted || videoSuppressed});
    }
  }
  stop(): Promise<void> {
    // The invalidation and any browser TTS cancellation are SYNCHRONOUS.
    if (this.state.phase === 'off' || this.state.phase === 'stopping') return Promise.resolve();
    this.invalidate();
    this.cancelSpeech();
    this.clearProactiveTimer();
    this.patch({phase:'off'});
    return Promise.resolve();
  }
  updateContext(context: ConversationContext): void {
    this.context = context;
    this.clearProactiveTimer();
    if (this.state.phase === 'active' && context.proactivityEnabled) {
      this.proactiveTimer = setInterval(() => {
        if (this.state.phase === 'active' && !this.state.effectiveMuted && this.context?.proactivityEnabled) {
          this.say('Eine unverbindliche Demo-Nachfrage: Möchtest du einen fiktiven Logbucheintrag erstellen?');
        }
      }, 90_000);
    }
  }
  private clearProactiveTimer(): void { if (this.proactiveTimer) clearInterval(this.proactiveTimer); this.proactiveTimer = null; }
  private cancelSpeech(): void { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
  say(text: string): void {
    if (this.state.phase !== 'active' || this.state.effectiveMuted) return;
    this.onAnnaText?.(text);
    // Text-only simulation is always available; optional TTS uses OS voice, never a cloud request from us.
    if (this.synthVoice && typeof speechSynthesis !== 'undefined') {
      this.cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'de-DE'; utterance.rate = 0.95;
      speechSynthesis.speak(utterance);
    }
  }
  simulateFinalUserText(text: string): void {
    if (this.state.phase !== 'active') return;
    this.emit({type:'finalUserText', text, generationId:this.state.generationId});
  }
  async simulateTool(name: ClientToolName, args: unknown, delayMs = 0): Promise<ActionResult> {
    const generationId = this.state.generationId;
    if (delayMs) await wait(delayMs);
    this.emit({type:'toolRequest', name, args, generationId});
    return this.dispatchTool(name, args, generationId);
  }
}
