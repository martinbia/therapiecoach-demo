import type { ConversationContext, VoiceEvent, VoiceState } from '../core/types.ts';
import type { VoiceService } from './voice-types.ts';

export abstract class BaseVoiceAdapter implements VoiceService {
  protected state: VoiceState = {phase: 'off', userMuted: false, effectiveMuted: false, generationId: 0};
  protected listeners = new Set<(event: VoiceEvent) => void>();
  protected videoSuppressed = false;
  protected deadline: ReturnType<typeof setTimeout> | null = null;
  protected context: ConversationContext | null = null;
  getState(): VoiceState { return {...this.state}; }
  subscribe(listener: (event: VoiceEvent) => void): () => void { this.listeners.add(listener); listener({type:'state', state:this.getState()}); return () => this.listeners.delete(listener); }
  protected emit(event: VoiceEvent): void { for (const listener of this.listeners) listener(event); }
  protected patch(data: Partial<VoiceState>): void { this.state = {...this.state, ...data}; this.emit({type:'state', state:this.getState()}); }
  protected begin(context: ConversationContext): number | null {
    if (this.state.phase === 'active' || this.state.phase === 'connecting' || this.state.phase === 'stopping') return null;
    this.context = context;
    this.videoSuppressed = false;
    const generationId = this.state.generationId + 1;
    this.patch({phase:'connecting', generationId, errorCode:undefined, userMuted:false, effectiveMuted:false});
    return generationId;
  }
  protected valid(generationId: number): boolean {
    return this.state.generationId === generationId && (this.state.phase === 'active' || this.state.phase === 'connecting');
  }
  protected activate(generationId: number): void {
    if (!this.valid(generationId)) return;
    this.patch({phase:'active'});
    this.clearDeadline();
    this.deadline = setTimeout(() => { if (this.valid(generationId)) void this.stop(); }, 300_000);
  }
  protected fail(generationId: number, code = 'VOICE_ERROR'): void {
    if (!this.valid(generationId)) return;
    this.clearDeadline();
    this.patch({phase:'error', errorCode:code, userMuted:false, effectiveMuted:false});
    this.emit({type:'error', code, generationId});
  }
  protected invalidate(): number {
    const generationId = this.state.generationId + 1;
    this.clearDeadline();
    this.context = null;
    this.videoSuppressed = false;
    this.patch({phase:'stopping', generationId, userMuted:false, effectiveMuted:false});
    return generationId;
  }
  protected clearDeadline(): void { if (this.deadline) clearTimeout(this.deadline); this.deadline = null; }
  async setVideoSuppressed(suppressed: boolean): Promise<void> {
    this.videoSuppressed = suppressed;
    if (this.state.phase === 'active') await this.applyMute(this.state.userMuted, suppressed);
  }
  abstract start(context: ConversationContext): Promise<void>;
  abstract setMuted(muted: boolean): Promise<void>;
  abstract stop(): Promise<void>;
  protected abstract applyMute(userMuted: boolean, videoSuppressed: boolean): Promise<void>;
  updateContext(_context: ConversationContext): void { /* overridable; must never auto-reconnect */ }
}
