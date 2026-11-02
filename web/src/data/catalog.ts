import type { DemoLogEntry, ExerciseId, InfoTopicId, VideoId } from '../core/types.ts';
export const topics: Record<InfoTopicId, { title: string; summary: string; points: string[]; document: string }> = {
  stairs: {
    title: 'Treppensteigen',
    summary: 'Beispielinformation zur Vorbereitung eines Gesprächs mit Fachpersonen. Keine Anleitung zur eigenen Durchführung.',
    points: ['Nach einem Spitalaufenthalt können Fragen zu Treppen und Geländern entstehen.', 'Ein Reha-Team kann individuelle Voraussetzungen und sichere Varianten besprechen.', 'Dieses Anschauungsobjekt gibt keine persönliche Übungsempfehlung.'],
    document: 'docs/treppen-demo.pdf',
  },
  chair_rise: {
    title: 'Aufstehen vom Stuhl',
    summary: 'Fiktives Thema rund um Alltagsbewegungen in der Rehabilitation.',
    points: ['Alltägliche Bewegungen können im Reha-Gespräch thematisiert werden.', 'Hilfsmittel und Vorgehen werden bei Bedarf mit Fachpersonen abgestimmt.', 'Der gezeigte Ablauf ist kein Ersatz für individuell geprüfte Anweisungen.'],
    document: 'docs/stuhl-demo.pdf',
  },
};
export const videos: Record<VideoId, { title: string; description: string; file: string; poster: string }> = {
  stairs_demo: { title: 'Treppen · Demonstrationsclip', description: 'Animierter Platzhalter ohne konkrete Therapieanleitung.', file: 'videos/stairs-demo.mp4', poster: 'posters/stairs.svg' },
  chair_rise_demo: { title: 'Stuhl · Demonstrationsclip', description: 'Animierter Platzhalter ohne konkrete Therapieanleitung.', file: 'videos/chair-demo.mp4', poster: 'posters/chair.svg' },
};
export const exerciseNames: Record<ExerciseId, string> = {
  stairs: 'Treppen (Beispiel)',
  chair_rise: 'Aufstehen vom Stuhl (Beispiel)',
};
export function freshDemoEntries(): DemoLogEntry[] {
  return [
    { id: 'fixture-1', exerciseId: 'chair_rise', when: 'gestern, Beispiel', comment: 'Fiktiver Mustereintrag: fühlte sich gut an.', demo: true },
    { id: 'fixture-2', exerciseId: 'stairs', when: 'letzte Woche, Beispiel', comment: 'Fiktiver Mustereintrag: mit Fachperson besprochen.', demo: true },
  ];
}
