import type { ActionDispatcher } from './dispatcher.ts';
import type { BaseVoiceAdapter } from '../voice/base.ts';
import type { WorkerSessionTokenProvider } from '../access/token.ts';

export interface StoppableMedia { stopAll(): void }
export class SafetyController {
  constructor(private voice: BaseVoiceAdapter, private media: StoppableMedia, private dispatcher: ActionDispatcher, private tokenProvider?: WorkerSessionTokenProvider) {}
  stopAll(): void {
    // Never wait on network / SDK for local safety actions.
    this.tokenProvider?.cancel();
    // Invalidate the voice generation BEFORE pausing video: the video 'pause'
    // handler removes video-induced muting. In the opposite order that handler
    // could start an SDK unmute immediately before STOPP.
    void this.voice.stop();
    this.media.stopAll();
    this.dispatcher.discardPending();
  }
  coachOff(): void {
    this.tokenProvider?.cancel();
    void this.voice.stop();
    // Deliberately keep video playing and pending logbook proposal available.
  }
}
