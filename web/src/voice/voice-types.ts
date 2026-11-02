import type { ActionResult, ClientToolName, ConversationContext, VoiceEvent, VoiceState } from '../core/types.ts';

export interface VoiceService {
  start(context: ConversationContext): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  stop(): Promise<void>;
  getState(): VoiceState;
  subscribe(listener: (event: VoiceEvent) => void): () => void;
}
export type SessionTokenProvider = () => Promise<string>;
export type DispatchTool = (name: ClientToolName, args: unknown, generationId: number) => Promise<ActionResult>;
