
    
  
import { Conversation, type VoiceConversation } from '@elevenlabs/client';
import type { ActionResult, ClientToolName, ConversationContext } from '../core/types.ts';
import { BaseVoiceAdapter } from './base.ts';
import type { DispatchTool, SessionTokenProvider } from './voice-types.ts';

// Public SDK boundary. No PIN, Cloudflare details or therapy-specific rules in this module.
type Session = VoiceConversation;
const stale: ActionResult = {ok: false, code:'STALE_SESSION', message:'Diese Sprachsitzung ist nicht mehr aktiv.'};
const toolNames: readonly ClientToolName[] = ['openInfo', 'openVideo', 'openLogbook', 'proposeLogEntry', 'confirmLogEntry', 'setProactivity'];

// Some SDK versions type startSession() as a union of voice and text sessions,
// even for an explicit WebRTC voice request. Narrow at runtime instead of casting.
function isVoiceSession(value: unknown): value is VoiceConversation {
  return typeof value === 'object' && value !== null &&
    'setMicMuted' in value && typeof value.setMicMuted === 'function' &&
    'setVolume' in value && typeof value.setVolume === 'function' &&
    'endSession' in value && typeof value.endSession === 'function';
}
export class ElevenLabsAdapter extends BaseVoiceAdapter {
  private session: Session | null = null;
  private requestedMute = false;
  private muteSerial = 0;
  constructor(private tokenProvider: SessionTokenProvider, private dispatchTool: DispatchTool) { super(); }

  async start(context: ConversationContext): Promise<void> {
    const gen = this.begin(context);
    if (gen === null) return;
    try {
      const conversationToken = await this.tokenProvider();
      if (!this.valid(gen)) return;
      if (!conversationToken) throw new Error('TOKEN_EMPTY');
      // Tools are registered as a closed map; their responses are awaited by the provider.
      const callback = (name: ClientToolName) => async (args: unknown): Promise<string> => {
        if (!this.valid(gen) || this.state.phase !== 'active') return JSON.stringify(stale);
        this.emit({type:'toolRequest', name, args, generationId:gen});
        const result = await this.dispatchTool(name, args, gen);
        // The provider SDK requires string/number/void, not an object.
        // The JSON string retains the ActionResult schema for the agent.
        return JSON.stringify(this.valid(gen) ? result : stale);
      };
      const clientTools = Object.fromEntries(toolNames.map(name => [name, callback(name)])) as Record<ClientToolName, (args: unknown) => Promise<string>>;
      const candidateSession = await Conversation.startSession({
        conversationToken,
        textOnly: false as const,
        connectionType: 'webrtc',
        dynamicVariables: {role: context.role, proactivity_enabled: context.proactivityEnabled},
        clientTools,
        onMessage: message => {
          if (!this.valid(gen)) return;
          // The SDK onMessage user callback represents the final user_transcript event.
          // Tentative text and AI output are never confirmation evidence.
          if (message.role === 'user' && typeof message.message === 'string') {
            this.emit({type:'finalUserText', text: message.message, generationId:gen});
          }
        },
        onDisconnect: () => { if (this.valid(gen)) void this.stop(); },
        onError: () => {
          // Do not expose upstream details in UI or logs.
          if (this.valid(gen)) { this.fail(gen, 'PROVIDER_ERROR'); void this.stop(); }
        },
      });
      if (!isVoiceSession(candidateSession)) {
        await candidateSession.endSession().catch(() => undefined);
        throw new Error('VOICE_SESSION_REQUIRED');
      }
      const newSession = candidateSession;
      if (!this.valid(gen)) {
        // Race: STOPP while startSession was still resolving.
        await Promise.allSettled([newSession.setMicMuted(true), newSession.setVolume({volume:0})]);
        await newSession.endSession().catch(() => undefined);
        return;
      }
      this.session = newSession;
      if (this.requestedMute || this.videoSuppressed) {
        await this.applyMute(this.requestedMute, this.videoSuppressed);
        if (!this.valid(gen)) return;
      }
      this.activate(gen);
    } catch {
      if (this.valid(gen)) {
        this.fail(gen, 'CONNECT_FAILED');
        await this.stop();
      }
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    if (this.state.phase === 'connecting') {
      // Save intent; do not claim that the microphone or output have been muted yet.
      this.requestedMute = muted;
      return;
    }
    if (this.state.phase !== 'active') return;
    await this.applyMute(muted, this.videoSuppressed);
  }
  protected async applyMute(userMuted: boolean, videoSuppressed: boolean): Promise<void> {

