import { AppStore } from './store.ts';
import type { ActionResult, ActionSource, ClientToolName, ExerciseId, InfoTopicId, UIAction, VideoId } from './types.ts';

const ok = (code: 'OK' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED', message: string): ActionResult => ({ok: true, code, message});
const err = (code: 'INVALID_ARGUMENT' | 'UNKNOWN_ID' | 'STALE_SESSION' | 'NOT_AVAILABLE' | 'CONFIRMATION_REQUIRED' | 'CONFIRMATION_PENDING', message: string): ActionResult => ({ok: false, code, message});
const infoIds = new Set<InfoTopicId>(['stairs', 'chair_rise']);
const videoIds = new Set<VideoId>(['stairs_demo', 'chair_rise_demo']);
const exerciseIds = new Set<ExerciseId>(['stairs', 'chair_rise']);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (value: unknown, keys: string[]): value is Record<string, unknown> => isRecord(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const cleanText = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const affirmation = (text: string): boolean => /^(ja|ja das stimmt|bitte eintragen|ja bitte eintragen)[.!]?$/u.test(text.toLocaleLowerCase('de-CH').normalize('NFC').replace(/[,;:]+/g, '').trim());
interface Evidence { generationId: number; after: number; time: number; used: boolean }
let nextId = 1;

export class ActionDispatcher {
  private evidence: Evidence | null = null;
  private latestTranscriptAt = 0;
  constructor(public readonly store: AppStore, private readonly now = () => Date.now()) {}

  /** Called only from confirmed-final user transcriptions, never from agent responses. */
  recordFinalUserText(text: string, generationId: number): void {
    const state = this.store.get();
    if (state.voice.phase !== 'active' || state.voice.generationId !== generationId) return;
    const time = this.now();
    this.latestTranscriptAt = time;
    const pending = state.pendingLogEntry;
    this.evidence = pending && pending.generationId === generationId && time >= pending.createdAt && affirmation(text)
      ? {generationId, after: pending.createdAt, time, used: false} : null;
  }

  discardPending(): void {
    this.evidence = null;
    if (this.store.get().pendingLogEntry) this.store.patch({pendingLogEntry: null});
  }

  dispatch(action: UIAction, source: ActionSource = {kind: 'touch'}): ActionResult {
    const s = this.store.get();
    if (source.kind === 'voice' && (s.voice.phase !== 'active' || s.voice.generationId !== source.generationId)) {
      return err('STALE_SESSION', 'Diese Sprachsitzung ist nicht mehr aktiv.');
    }
    switch(action.type) {
      case 'SELECT_ROLE':
        if (action.role !== 'patient' && action.role !== 'caregiver') return err('INVALID_ARGUMENT', 'Rolle ungültig.');
        this.store.patch({role: action.role, view: 'home', status: action.role === 'patient' ? 'Patientenmodus ausgewählt.' : 'Angehörigenmodus ausgewählt.'});
        return ok('OK', 'Rolle ausgewählt.');
      case 'NAV_HOME': this.store.patch({view: 'home'}); return ok('OK', 'Startseite geöffnet.');
      case 'OPEN_COACH': this.store.patch({view: 'coach'}); return ok('OK', 'Sprachcoach geöffnet.');
      case 'OPEN_INFO':
        if (!infoIds.has(action.topicId as InfoTopicId)) return err('UNKNOWN_ID', 'Dieses Beispiel ist nicht vorhanden.');
        this.store.patch({view: 'info', selectedInfoTopicId: action.topicId as InfoTopicId});
        return ok('OK', 'Information geöffnet.');
      case 'OPEN_VIDEO':
        if (!videoIds.has(action.videoId as VideoId)) return err('UNKNOWN_ID', 'Dieses Beispiel ist nicht vorhanden.');
        this.store.patch({view: 'video', selectedVideoId: action.videoId as VideoId});
        return ok('OK', 'Video ausgewählt. Bitte Wiedergabe manuell starten.');
      case 'OPEN_LOGBOOK': this.store.patch({view: 'logbook'}); return ok('OK', 'Logbuch geöffnet.');
      case 'SET_PROACTIVITY':
        if (typeof action.enabled !== 'boolean') return err('INVALID_ARGUMENT', 'Schalterwert ungültig.');
        this.store.patch({proactivityEnabled: action.enabled, status: action.enabled ? 'Aktive Nachfragen sind eingeschaltet.' : 'Aktive Nachfragen sind ausgeschaltet.'});
        return ok('OK', 'Einstellung geändert.');
      case 'PROPOSE_LOG_ENTRY': {
        if (!exerciseIds.has(action.exerciseId as ExerciseId)) return err('UNKNOWN_ID', 'Diese Übung ist nicht vorhanden.');
        if (!cleanText(action.when, 1, 80) || !cleanText(action.comment, 0, 240)) return err('INVALID_ARGUMENT', 'Angaben sind ungültig oder zu lang.');
        if (s.pendingLogEntry) return err('CONFIRMATION_PENDING', 'Bitte zuerst den offenen Vorschlag bestätigen oder verwerfen.');
        const pending = {
          id: `local-${nextId++}`, exerciseId: action.exerciseId as ExerciseId,
          when: action.when.trim(), comment: action.comment.trim(), demo: true as const,
          createdAt: this.now(), generationId: s.voice.generationId,
        };
        this.evidence = null;
        this.store.patch({pendingLogEntry: pending, view: 'logbook'});
        return ok('PENDING_CONFIRMATION', 'Bitte Eintrag bestätigen.');
      }
      case 'CONFIRM_LOG_ENTRY': {
        if (typeof action.confirmed !== 'boolean') return err('INVALID_ARGUMENT', 'Bestätigung ist ungültig.');
        const pending = s.pendingLogEntry;
        if (!pending) return err('NOT_AVAILABLE', 'Kein offener Eintrag.');
        if (!action.confirmed) { this.discardPending(); return ok('CANCELLED', 'Eintrag verworfen.'); }
        if (source.kind === 'voice') {
          const e = this.evidence;
          if (pending.generationId !== source.generationId || !e || e.generationId !== source.generationId || e.after !== pending.createdAt || e.used || this.now() - e.time > 30_000 || e.time !== this.latestTranscriptAt) {
            return err('CONFIRMATION_REQUIRED', 'Bitte den Eintrag über die Schaltfläche bestätigen.');
          }
          e.used = true;
        }
        const {id, exerciseId, when, comment, demo} = pending;
        this.evidence = null;
        this.store.patch({logbookEntries: [{id, exerciseId, when, comment, demo}, ...s.logbookEntries], pendingLogEntry: null, view: 'logbook'});
        return ok('CONFIRMED', 'Fiktiver Eintrag übernommen.');
      }
    }
  }

  /** Voice tools are strictly whitelisted and validated; no arbitrary HTML, URLs or action names. */
  dispatchTool(name: ClientToolName, args: unknown, generationId: number): ActionResult {
    const source: ActionSource = {kind: 'voice', generationId};
    if (this.store.get().voice.phase !== 'active' || this.store.get().voice.generationId !== generationId) {
      return err('STALE_SESSION', 'Diese Sprachsitzung ist nicht mehr aktiv.');
    }
    switch(name) {
      case 'openInfo': return shape(args, ['topicId']) ? this.dispatch({type: 'OPEN_INFO', topicId: args.topicId}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      case 'openVideo': return shape(args, ['videoId']) ? this.dispatch({type: 'OPEN_VIDEO', videoId: args.videoId}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      case 'openLogbook': return shape(args, []) ? this.dispatch({type: 'OPEN_LOGBOOK'}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      case 'proposeLogEntry': return shape(args, ['exerciseId','when','comment']) ? this.dispatch({type: 'PROPOSE_LOG_ENTRY', exerciseId: args.exerciseId, when: args.when, comment: args.comment}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      case 'confirmLogEntry': return shape(args, ['confirmed']) && typeof args.confirmed === 'boolean' ? this.dispatch({type: 'CONFIRM_LOG_ENTRY', confirmed: args.confirmed}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      case 'setProactivity': return shape(args, ['enabled']) && typeof args.enabled === 'boolean' ? this.dispatch({type: 'SET_PROACTIVITY', enabled: args.enabled}, source) : err('INVALID_ARGUMENT', 'Argumente ungültig.');
      default: return err('NOT_AVAILABLE', 'Unbekanntes Werkzeug.');
    }
  }
}
