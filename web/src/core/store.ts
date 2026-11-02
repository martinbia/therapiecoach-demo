import { freshDemoEntries } from '../data/catalog.ts';
import type { AppState, VoiceState } from './types.ts';

export const initialVoiceState = (): VoiceState => ({phase: 'off', userMuted: false, effectiveMuted: false, generationId: 0});
export const createInitialState = (): AppState => ({
  role: null, proactivityEnabled: false, selectedInfoTopicId: null, selectedVideoId: null,
  logbookEntries: freshDemoEntries(), pendingLogEntry: null, voice: initialVoiceState(), view: 'home',
  status: 'Bereit für eine Demonstration mit fiktiven Daten.',
});
export class AppStore {
  private state = createInitialState();
  private listeners = new Set<(state: AppState) => void>();
  get(): AppState { return this.state; }
  patch(next: Partial<AppState>): void { this.state = {...this.state, ...next}; this.emit(); }
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  private emit(): void { for (const listener of this.listeners) listener(this.state); }
}
