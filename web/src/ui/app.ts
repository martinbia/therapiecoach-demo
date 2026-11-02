import { topics, videos, exerciseNames } from '../data/catalog.ts';
import type { ExerciseId, InfoTopicId, VideoId, AppState, ActionResult, UIAction, Role } from '../core/types.ts';
import type { AppStore } from '../core/store.ts';
import type { ActionDispatcher } from '../core/dispatcher.ts';
import type { BaseVoiceAdapter } from '../voice/base.ts';
import type { MockVoiceAdapter } from '../voice/mock.ts';
import type { SafetyController } from '../core/safety.ts';
import { shouldToggleFromKeyboard } from '../core/keyboard.ts';
import type { PinDialog } from '../access/token.ts';

const esc = (value: string): string => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] ?? ch));
const BASE = import.meta.env.BASE_URL;
const file = (path: string) => `${BASE}${path}`;
const ico = (icon: string) => `<span class="tile-icon" aria-hidden="true">${icon}</span>`;

export class MediaView {
  video: HTMLVideoElement | null = null;
  private blockAutoplay = false;
  constructor(private voice: BaseVoiceAdapter) {}
  attach(video: HTMLVideoElement): void {
    this.video = video;
    this.blockAutoplay = false;
    video.addEventListener('pointerdown', () => { this.blockAutoplay = false; });
    video.addEventListener('play', () => {
      if (this.blockAutoplay) { video.pause(); return; }
      void this.voice.setVideoSuppressed(true);
    });
    video.addEventListener('pause', () => { void this.voice.setVideoSuppressed(false); });
    video.addEventListener('ended', () => { void this.voice.setVideoSuppressed(false); });
  }
  stopAll(): void {
    this.blockAutoplay = true;
    if (this.video) {
      this.video.pause();
      try { this.video.currentTime = 0; } catch { /* unavailable media */ }
    }
    void this.voice.setVideoSuppressed(false);
  }
  detach(): void { this.stopAll(); this.video = null; }
}

export class AppUI {
  private header: HTMLElement;
  private controls: HTMLElement;
  private content: HTMLElement;
  private toast: HTMLElement;
  private lastViewKey = '';
  readonly media: MediaView;
  private latestMockText = 'Anna wartet auf den Start des Mock-Coachs.';
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private host: HTMLElement,
    private store: AppStore,
    private dispatcher: ActionDispatcher,
    private voice: BaseVoiceAdapter,
    private mock: MockVoiceAdapter | null,
    private pinDialog: PinDialog,
    private mode: 'mock' | 'elevenlabs',
  ) {
    this.media = new MediaView(voice);
    host.innerHTML = `<div class="app-shell">
      <header id="site-header"></header>
      <section id="control-bar" class="control-bar" aria-label="Steuerung für den Sprachcoach"></section>
      <main id="content" class="main-content" tabindex="-1"></main>
      <footer class="site-footer">Fiktive Demonstration · Kein Medizinprodukt · Keine echten Patientendaten</footer>
    </div><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
    this.header = host.querySelector<HTMLElement>('#site-header')!;
    this.controls = host.querySelector<HTMLElement>('#control-bar')!;
    this.content = host.querySelector<HTMLElement>('#content')!;
    this.toast = host.querySelector<HTMLElement>('#toast')!;
    this.installHandlers();
    this.store.subscribe(state => this.render(state));
    if (mock) mock.onAnnaText = text => { this.latestMockText = text; this.showNotice(`Anna (Mock): ${text}`); this.store.patch({status:'Anna (Mock) hat eine Nachricht ausgegeben.'}); };
  }
  private safety!: SafetyController;
  setSafety(safety: SafetyController): void { this.safety = safety; }
  showNotice(text: string): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.toast.textContent = text; this.toast.classList.add('visible');
    this.noticeTimer = setTimeout(() => this.toast.classList.remove('visible'), 5400);
  }
  private dispatch(action: UIAction): ActionResult {
    const result = this.dispatcher.dispatch(action);
    if (!result.ok) this.showNotice(result.message);
    if (result.ok && (action.type === 'SELECT_ROLE' || action.type === 'SET_PROACTIVITY')) this.voice.updateContext(this.context());
    return result;
  }
  private context() { const s = this.store.get(); return {role: (s.role ?? 'patient') as Role, proactivityEnabled:s.proactivityEnabled}; }
  private toggleCoach(): void {
    const phase = this.voice.getState().phase;
    if (phase === 'active' || phase === 'connecting' || phase === 'stopping') { this.safety.coachOff(); return; }
    if (!this.store.get().role) { this.showNotice('Bitte zuerst Patienten- oder Angehörigenmodus auswählen.'); return; }
    void this.voice.start(this.context());
  }
  private installHandlers(): void {
    this.host.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      switch(action) {
        case 'role': this.dispatch({type:'SELECT_ROLE', role:id as Role}); break;
        case 'home': this.dispatch({type:'NAV_HOME'}); break;
        case 'info': this.dispatch({type:'OPEN_INFO', topicId:id}); break;
        case 'video': this.dispatch({type:'OPEN_VIDEO', videoId:id}); break;
        case 'logbook': this.dispatch({type:'OPEN_LOGBOOK'}); break;
        case 'coach': this.dispatch({type:'OPEN_COACH'}); break;
        case 'coach-toggle': this.toggleCoach(); break;
        case 'mute': void this.voice.setMuted(!this.voice.getState().userMuted); break;
        case 'stop': this.safety.stopAll(); this.showNotice('STOPP – Coach und Medien wurden lokal angehalten.'); break;
        case 'confirm': this.displayResult(this.dispatch({type:'CONFIRM_LOG_ENTRY', confirmed:true})); break;
        case 'reject': this.displayResult(this.dispatch({type:'CONFIRM_LOG_ENTRY', confirmed:false})); break;
        case 'mock-tts': this.mock?.enableSpeechSynthesis((button as HTMLInputElement).getAttribute('aria-pressed') !== 'true'); button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); button.textContent = button.getAttribute('aria-pressed') === 'true' ? 'Gerätestimme: EIN' : 'Gerätestimme: AUS'; break;
        case 'mock-tool': void this.runMockTool(id ?? ''); break;
        case 'mock-proactive': this.mock?.say('Nur eine Demo-Nachfrage: Möchtest du über deine Übung sprechen?'); break;
        case 'mock-evidence': this.mock?.simulateFinalUserText('Ja'); this.showNotice('Finale Nutzeraussage »Ja« simuliert.'); break;
        case 'mock-confirm': void this.mock?.simulateTool('confirmLogEntry', {confirmed:true}).then(result => this.displayResult(result)); break;
        case 'video-stop': this.media.stopAll(); break;
      }
    });
    this.host.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (input.id === 'proactivity-switch') this.displayResult(this.dispatch({type:'SET_PROACTIVITY', enabled:input.checked}));
      if (input.id === 'mock-delay' && this.mock) this.mock.connectDelayMs = Number(input.value);
      if (input.id === 'mock-fail' && this.mock) this.mock.failNextStart = input.checked;
    });
    this.host.addEventListener('submit', event => {
      const form = event.target as HTMLFormElement;
      if (form.id === 'log-form') {
        event.preventDefault();
        const fields = new FormData(form);
        const result = this.dispatch({type:'PROPOSE_LOG_ENTRY', exerciseId:fields.get('exercise'), when:fields.get('when'), comment:fields.get('comment')});
        this.displayResult(result);
      } else if (form.id === 'mock-final-form') {
        event.preventDefault();
        const text = String(new FormData(form).get('mock-text') ?? '');
        this.mock?.simulateFinalUserText(text);
        this.showNotice(`Fiktive Nutzeraussage simuliert: ${text}`);
      }
    });
    window.addEventListener('keydown', event => {
      if (shouldToggleFromKeyboard(event, this.pinDialog.isOpen(), document.hasFocus())) {
        event.preventDefault(); this.toggleCoach();
      }
    });
  }
  private displayResult(result: ActionResult): void { this.showNotice(result.message); }
  private async runMockTool(id: string): Promise<void> {
    if (!this.mock) return;
    const commands = {
      info: ['openInfo', {topicId:'stairs'}], video: ['openVideo', {videoId:'chair_rise_demo'}],
      log: ['openLogbook', {}], propose: ['proposeLogEntry', {exerciseId:'chair_rise', when:'heute Vormittag (Demo)', comment:'Fiktiv: gut geklappt'}],
      confirm: ['confirmLogEntry', {confirmed:true}], proactivity: ['setProactivity', {enabled:true}],
      invalid: ['openInfo', {topicId:'unbekannt'}],
    } as const;
    const command = commands[id as keyof typeof commands];
    if (!command) return;
    const result = await this.mock.simulateTool(command[0], command[1], id === 'invalid' ? 800 : 0);
    this.displayResult(result);
  }
  private render(s: AppState): void {
    const role = s.role ? (s.role === 'patient' ? 'Patient/in' : 'Angehörige/r') : 'Rolle wählen';
    const phaseText = {off:'Aus', connecting:'Verbindet …', active:'Aktiv', stopping:'Beendet …', error:'Fehler'}[s.voice.phase];
    const badge = this.mode === 'mock' ? 'MOCK · 0 CHF CLOUDKOSTEN' : 'LIVE · EXTERNE SPRACHVERARBEITUNG';
    this.header.innerHTML = `<div class="brand-row"><div class="brand"><span class="brand-mark">a<span>.</span></span><div><strong>Anna</strong><small>Therapiecoach · Demo</small></div></div><span class="mode-tag">${badge}</span></div>
      <div class="utility-row"><span class="role-text">${role}</span><button class="text-button" data-action="home">Startseite</button>${s.role ? `<button class="text-button" data-action="role" data-id="${s.role === 'patient' ? 'caregiver' : 'patient'}">Rolle wechseln</button>` : ''}</div>`;
    const on = s.voice.phase === 'active' || s.voice.phase === 'connecting' || s.voice.phase === 'stopping';
    this.controls.innerHTML = `<div class="control-heading"><div><span class="status-dot ${s.voice.phase === 'active' ? 'lit' : ''}"></span> <strong>Sprachcoach</strong> <span class="phase">${phaseText}</span></div><span class="shortcut">F9</span></div>
      <div class="control-buttons">
        <button class="btn ${on ? 'light' : 'primary'}" data-action="coach-toggle" ${s.voice.phase === 'stopping' ? 'disabled' : ''} aria-label="Coach ${on ? 'ausschalten' : 'einschalten'}">${on ? '◼ COACH AUS' : '◉ COACH EIN'}</button>
        <button class="btn light ${s.voice.userMuted ? 'is-muted' : ''}" data-action="mute" ${!on || s.voice.phase === 'stopping' ? 'disabled' : ''} aria-pressed="${s.voice.userMuted}">${s.voice.userMuted ? '◌ STUMM AUS' : '◌ STUMM'}</button>
        <button class="btn danger" data-action="stop" aria-label="Alles sofort stoppen">■ STOPP</button>
      </div>
      <div class="control-meta">${s.voice.effectiveMuted ? 'Mikrofon und KI-Ton stumm · ' : ''}${this.mode === 'mock' ? 'Kein echtes Mikrofon · ' : ''}<span class="control-info" aria-live="polite">${esc(s.status)}</span></div>`;
    const key = JSON.stringify([s.role,s.view,s.selectedInfoTopicId,s.selectedVideoId,s.pendingLogEntry?.id,s.logbookEntries.map(e => e.id)]);
    if (key !== this.lastViewKey) {
      // Replacing the DOM always disposes the previous player safely.
      if (this.media.video) this.media.detach();
      this.lastViewKey = key;
      this.content.innerHTML = this.buildContent(s);
      const player = this.content.querySelector<HTMLVideoElement>('#demo-video');
      if (player) this.media.attach(player);
    }
    const switchEl = this.content.querySelector<HTMLInputElement>('#proactivity-switch');
    if (switchEl && document.activeElement !== switchEl) switchEl.checked = s.proactivityEnabled;
    const indicator = this.content.querySelector<HTMLElement>('#proactivity-state');
    if (indicator) indicator.textContent = s.proactivityEnabled ? 'EIN' : 'AUS';
  }
  private buildContent(s: AppState): string {
    if (!s.role) return `<section class="welcome"><p class="eyebrow">WILLKOMMEN BEI ANNA</p><h1>Wie möchtest du Anna kennenlernen?</h1><p class="lead">Ein einfaches Anschauungsobjekt für Informationen, Videos und ein fiktives Therapielogbuch.</p><div class="role-grid">
      <button class="role-card" data-action="role" data-id="patient">${ico('☺')}<span><strong>Ich bin Patient/in</strong><small>Infos und Übungen kennenlernen</small></span><span class="card-arrow">→</span></button>
      <button class="role-card" data-action="role" data-id="caregiver">${ico('♡')}<span><strong>Ich bin Angehörige/r</strong><small>Eine nahestehende Person unterstützen</small></span><span class="card-arrow">→</span></button></div><p class="hint">Alle dargestellten Daten sind erfunden. Keine persönliche Therapieanleitung.</p></section>`;
    switch (s.view) {
      case 'home': return this.home(s);
      case 'info': return this.info(s);
      case 'video': return this.video(s);
      case 'logbook': return this.logbook(s);
      case 'coach': return this.coach(s);
    }
  }
  private home(s: AppState): string {
    return `<section class="home-intro"><p class="eyebrow">DEIN DEMO-BEREICH</p><h1>${s.role === 'patient' ? 'Schön, dass du da bist.' : 'Gemeinsam gut informiert.'}</h1><p class="lead">${s.role === 'patient' ? 'Wähle, was du dir heute ansehen möchtest.' : 'Entdecke Beispielinformationen zur Begleitung einer nahestehenden Person.'}</p></section>
    <section class="tile-grid" aria-label="Hauptfunktionen">
      <button class="feature-tile mint" data-action="info" data-id="stairs">${ico('ⓘ')}<strong>Infos</strong><span>Wissen einfach erklärt</span><span class="tile-cta">Ansehen ↗</span></button>
      <button class="feature-tile blue" data-action="video" data-id="chair_rise_demo">${ico('▷')}<strong>Videos</strong><span>Demo-Clips ansehen</span><span class="tile-cta">Abspielen ↗</span></button>
      <button class="feature-tile sand" data-action="logbook">${ico('▤')}<strong>Therapielogbuch</strong><span>Fiktive Einträge dokumentieren</span><span class="tile-cta">Öffnen ↗</span></button>
      <button class="feature-tile lilac" data-action="coach">${ico('♫')}<strong>Mit Anna sprechen</strong><span>${this.mode === 'mock' ? 'Sprachaktionen simulieren' : 'Geschützten Sprachcoach starten'}</span><span class="tile-cta">Loslegen ↗</span></button>
    </section>${this.proactivity(s)}<div class="notice-card"><strong>Ein Hinweis zur Sicherheit</strong><p>Anna ist ein Demonstrator. Sie stellt keine Diagnosen und ersetzt kein Gespräch mit Fachpersonen.</p></div>`;
  }
  private proactivity(_s: AppState): string {
    return `<section class="switch-card"><div><strong>Aktive Nachfragen</strong><p>Anna darf während eines laufenden, nicht stummen Dialogs gelegentlich nachfragen. Standard: AUS.</p></div><label class="switch"><input id="proactivity-switch" type="checkbox" aria-label="Aktive Nachfragen ein- oder ausschalten"><span class="switch-track"></span><strong id="proactivity-state">AUS</strong></label></section>`;
  }
  private back(): string { return `<button class="back-link" data-action="home">← Alle Bereiche</button>`; }
  private info(s: AppState): string {
    const id = s.selectedInfoTopicId ?? 'stairs'; const topic = topics[id];
    return `${this.back()}<section class="section-header"><p class="eyebrow">INFORMATIONEN</p><h1>Gut informiert sein</h1><p class="lead">Allgemeine Beispieldaten. Individuelle Fragen gehören in die persönliche Beratung.</p></section>
      <div class="selector-row"><button data-action="info" data-id="stairs" class="selection ${id==='stairs'?'selected':''}">Treppensteigen</button><button data-action="info" data-id="chair_rise" class="selection ${id==='chair_rise'?'selected':''}">Aufstehen vom Stuhl</button></div>
      <article class="article-card"><div class="mini-icon">i</div><h2>${esc(topic.title)}</h2><p>${esc(topic.summary)}</p><ul>${topic.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>
      <div class="document-card"><div><strong>Beispieldokument (PDF)</strong><p>Öffne das fiktive Merkblatt zum Thema.</p></div><a class="btn primary" href="${file(topic.document)}" target="_blank" rel="noopener noreferrer">PDF öffnen ↗</a></div>
      <details class="pdf-details"><summary>PDF hier einblenden (falls Browser unterstützt)</summary><iframe title="Beispiel-PDF ${esc(topic.title)}" loading="lazy" src="${file(topic.document)}"></iframe></details></article>`;
  }
  private video(s: AppState): string {
    const id = s.selectedVideoId ?? 'chair_rise_demo'; const v = videos[id];
    return `${this.back()}<section class="section-header"><p class="eyebrow">DEMONSTRATIONSVIDEOS</p><h1>Beispiele ansehen</h1><p class="lead">Zwei selbst erstellte illustrative Platzhalterclips. Kein medizinischer Bewegungsablauf.</p></section>
      <div class="selector-row"><button data-action="video" data-id="stairs_demo" class="selection ${id==='stairs_demo'?'selected':''}">Treppen</button><button data-action="video" data-id="chair_rise_demo" class="selection ${id==='chair_rise_demo'?'selected':''}">Stuhl</button></div>
      <article class="media-card"><video id="demo-video" controls playsinline preload="metadata" poster="${file(v.poster)}" aria-label="${esc(v.title)}"><source src="${file(v.file)}" type="video/mp4">Dein Browser kann das Video nicht abspielen.</video>
      <div class="media-description"><h2>${esc(v.title)}</h2><p>${esc(v.description)}</p><button class="btn light" data-action="video-stop">Video anhalten und zurücksetzen</button></div></article>`;
  }
  private logbook(s: AppState): string {
    const pending = s.pendingLogEntry;
    return `${this.back()}<section class="section-header"><p class="eyebrow">THERAPIELOGBUCH · DEMO</p><h1>Was ist im Beispiel passiert?</h1><p class="lead">Alle Einträge sind erfunden und werden bei jedem Neuladen zurückgesetzt. Keine Speicherung auf dem Gerät oder in der Cloud.</p></section>
      ${pending ? `<section class="pending-card" aria-live="assertive"><span class="eyebrow">BESTÄTIGUNG ERFORDERLICH</span><h2>Eintrag übernehmen?</h2><p><strong>${esc(exerciseNames[pending.exerciseId])}</strong> · ${esc(pending.when)}</p><p>${esc(pending.comment || '(kein Kommentar)')}</p><div class="form-actions"><button class="btn primary" data-action="confirm">Ja, fiktiv eintragen</button><button class="btn light" data-action="reject">Verwerfen</button></div><small>Ein Agentenaufruf allein ist keine Bestätigung.</small>${this.mode === 'mock' ? `<div class="mock-voice-confirm"><button class="btn light" data-action="mock-evidence">Demo: »Ja« simulieren</button><button class="btn light" data-action="mock-confirm">Demo: Agent bestätigt</button></div>` : ''}</section>` : ''}
      <section class="article-card"><h2>Neuen Beispiel-Eintrag erstellen</h2><form id="log-form" class="log-form"><label for="exercise">Beispielaktivität</label><select id="exercise" name="exercise"><option value="chair_rise">Aufstehen vom Stuhl</option><option value="stairs">Treppen</option></select><label for="when">Wann? (Freitext)</label><input id="when" name="when" maxlength="80" required placeholder="z. B. heute Vormittag"><label for="comment">Eindruck (optional)</label><textarea id="comment" name="comment" maxlength="240" rows="3" placeholder="Nur fiktive Angaben"></textarea><button class="btn primary" type="submit" ${pending?'disabled':''}>Eintrag vorschlagen</button></form></section>
      <section class="log-history"><div class="list-heading"><h2>Beispielverlauf</h2><span>${s.logbookEntries.length} Einträge</span></div>${s.logbookEntries.map(entry => `<article class="history-item"><div class="history-dot"></div><div><strong>${esc(exerciseNames[entry.exerciseId])}</strong><time>${esc(entry.when)}</time><p>${esc(entry.comment)}</p><small>FIKTIV</small></div></article>`).join('')}</section>`;
  }
  private coach(s: AppState): string {
    return `${this.back()}<section class="section-header"><p class="eyebrow">ANNA · SPRACHCOACH</p><h1>${this.mode === 'mock' ? 'Anna ausprobieren' : 'Mit Anna sprechen'}</h1><p class="lead">${this.mode === 'mock' ? 'Die Sprachaktionen werden ohne ElevenLabs simuliert. Mikrofonerkennung ist hier nicht aktiv.' : 'Für das Live-Gespräch wird eine PIN benötigt. Sprache wird über ElevenLabs verarbeitet.'}</p></section>
      <section class="coach-card"><div class="avatar"><div class="avatar-face">a<span>.</span></div></div><h2>Hallo, ich bin Anna!</h2><p>${s.role === 'caregiver' ? 'Ich zeige dir Beispiele für Angehörige.' : 'Ich zeige dir fiktive Reha-Beispiele.'}</p><button class="btn primary large" data-action="coach-toggle">${['active','connecting'].includes(s.voice.phase) ? 'COACH AUS' : 'COACH EIN'}</button></section>
      ${this.proactivity(s)}
      ${this.mode === 'mock' ? `<details class="test-harness" open><summary>Mock-Teststeuerung · sechs Client Tools</summary><div class="harness-body"><p>Die Tasten simulieren Aufrufe des späteren Sprachagenten. Zuerst COACH EIN wählen.</p>
      <div class="mock-grid"><button class="btn light" data-action="mock-tool" data-id="info">openInfo</button><button class="btn light" data-action="mock-tool" data-id="video">openVideo</button><button class="btn light" data-action="mock-tool" data-id="log">openLogbook</button><button class="btn light" data-action="mock-tool" data-id="propose">proposeLogEntry</button><button class="btn light" data-action="mock-tool" data-id="confirm">confirmLogEntry</button><button class="btn light" data-action="mock-tool" data-id="proactivity">setProactivity</button><button class="btn light" data-action="mock-tool" data-id="invalid">Ungültige ID testen</button><button class="btn light" data-action="mock-proactive">Nachfrage simulieren</button></div>
      <form id="mock-final-form" class="mock-form"><label for="mock-text">Finale Nutzeraussage simulieren</label><input id="mock-text" name="mock-text" placeholder="Ja" autocomplete="off" value="Ja"><button class="btn light" type="submit">Aussage senden</button></form>
      <div class="settings-row"><label>Connect-Verzögerung <select id="mock-delay"><option value="350">350 ms</option><option value="3000">3 Sekunden</option><option value="9000">9 Sekunden</option></select></label><label><input type="checkbox" id="mock-fail"> Nächsten Start fehlschlagen lassen</label></div>
      <button class="btn light" data-action="mock-tts" aria-pressed="false">Gerätestimme: AUS</button><p class="micro-note">Optionale Geräte-TTS hängt vom Betriebssystem ab. Keine STT-Funktion, keine echte Therapieempfehlung.</p></div></details>` : `<div class="notice-card"><strong>Datenschutzhinweis</strong><p>Nur fiktive Angaben sprechen. Live-Sprachdaten gehen direkt an ElevenLabs. Kontoeinstellungen für Speicherung/Kosten vor Freigabe prüfen.</p></div>`}`;
  }
}
