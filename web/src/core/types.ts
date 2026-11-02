// API_CONTRACT.md v1.0 – shared browser contract. No patient identifiers.
export type Role = 'patient' | 'caregiver';
export type VoicePhase = 'off' | 'connecting' | 'active' | 'stopping' | 'error';
export type InfoTopicId = 'stairs' | 'chair_rise';
export type VideoId = 'stairs_demo' | 'chair_rise_demo';
export type ExerciseId = 'stairs' | 'chair_rise';
export type ClientToolName = 'openInfo' | 'openVideo' | 'openLogbook' | 'proposeLogEntry' | 'confirmLogEntry' | 'setProactivity';
export interface ConversationContext { role: Role; proactivityEnabled: boolean }
export interface VoiceState {
  phase: VoicePhase;
  userMuted: boolean;
  effectiveMuted: boolean;
  generationId: number;
  errorCode?: string;
}
export type VoiceEvent =
  | { type: 'state'; state: VoiceState }
  | { type: 'finalUserText'; text: string; generationId: number }
  | { type: 'toolRequest'; name: ClientToolName; args: unknown; generationId: number }
  | { type: 'error'; code: string; generationId: number };
export type ActionResult =
  | { ok: true; code: 'OK' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED'; message: string }
  | { ok: false; code: 'INVALID_ARGUMENT' | 'UNKNOWN_ID' | 'STALE_SESSION' | 'NOT_AVAILABLE' | 'CONFIRMATION_REQUIRED' | 'CONFIRMATION_PENDING'; message: string };
export interface DemoLogEntry {
  id: string;
  exerciseId: ExerciseId;
  when: string;
  comment: string;
  demo: true;
}
export interface PendingLogEntry extends DemoLogEntry { createdAt: number; generationId: number }
export type ViewName = 'home' | 'info' | 'video' | 'logbook' | 'coach';
export interface AppState {
  role: Role | null;
  proactivityEnabled: boolean;
  selectedInfoTopicId: InfoTopicId | null;
  selectedVideoId: VideoId | null;
  logbookEntries: DemoLogEntry[];
  pendingLogEntry: PendingLogEntry | null;
  voice: VoiceState;
  view: ViewName;
  status: string;
}
export type UIAction =
  | { type: 'SELECT_ROLE'; role: Role }
  | { type: 'NAV_HOME' }
  | { type: 'OPEN_INFO'; topicId: unknown }
  | { type: 'OPEN_VIDEO'; videoId: unknown }
  | { type: 'OPEN_LOGBOOK' }
  | { type: 'OPEN_COACH' }
  | { type: 'PROPOSE_LOG_ENTRY'; exerciseId: unknown; when: unknown; comment: unknown }
  | { type: 'CONFIRM_LOG_ENTRY'; confirmed: boolean }
  | { type: 'SET_PROACTIVITY'; enabled: boolean };
export type ActionSource = { kind: 'touch' } | { kind: 'voice'; generationId: number };
