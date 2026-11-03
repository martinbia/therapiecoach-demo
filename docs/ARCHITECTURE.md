# Systemarchitektur – KI-Therapiecoach

**Version:** 1.0 · **Datum:** 2026-11-02  
**Status:** **APPROVED – technische Architektur und Schnittstellen für Chats 01–03 freigegeben.**  
**Freigabegrenze:** Dokumentations- und Implementierungsfreigabe, **keine** Behauptung eines erfolgreich getesteten End-to-End-Systems oder einer Nokia-Hardwareabnahme. Maßgeblich zusammen mit `API_CONTRACT.md` v1.0. Fachlicher Umfang nach `PROJECT_BRIEF.md` v0.7, Regeln nach `PROJECT_RULES.md` und Ablauf nach `IMPLEMENTATION_PROCESS.md`.

## 1. Architekturentscheidung

**V1 bleibt eine kleine, mobile-first Single-Page-PWA mit einem getrennten Token-Worker und einem privaten ElevenLabs-Agenten.** Kein eigener Audioserver, keine Therapie-Datenbank, keine Nutzerkonten, kein natives Android-Paket.

```text
Nokia C22 (Android 13 Go) / später Android-Tablet
  Browser HTTPS, GitHub Pages / <repo>/
  ├─ UI: Rolle, Infos, Videos, PDFs, RAM-Logbuch
  ├─ AppState + ActionDispatcher (Touch und Voice identisch)
  ├─ VoiceService
  │   ├─ MockVoiceAdapter (kein Netz, keine Kosten)
  │   └─ ElevenLabsAdapter (@elevenlabs/client)
  ├─ F9-Ereignis (nur bei fokussierter PWA)
  └─ SafetyController (COACH EIN/AUS, STUMM, STOPP)
            │
            │ HTTPS POST /api/session {pin} (nur beim Voice-Start)
            ▼
Cloudflare Worker (Free-Tarif als Ausgangspunkt)
  ├─ Exact-Origin-/CORS- und Eingabeprüfung
  ├─ PIN-Prüfung nur serverseitig (Cloudflare Secret)
  ├─ AccessLimiter: 1 SQLite-backed Durable Object
  │   └─ atomare Fehlversuchs-, IP- und Tageszähler
  ├─ Betriebs-Sperrschalter (LIVE_ENABLED)
  └─ ElevenLabs-API-Key + Agent-ID nur serverseitig
            │
            │ GET https://api.elevenlabs.io/v1/convai/
            │     conversation/token?agent_id=<AGENT_ID>
            │ xi-api-key: <Cloudflare Secret>
            ▼
ElevenLabs API gibt WebRTC-conversation-token zurück
            │
            ▼
Browser: Conversation.startSession({ conversationToken,
  connectionType: 'webrtc', clientTools, dynamicVariables, ... })
            │
            └────────── DIREKTE WebRTC-Medien-/Datenverbindung ──────►
                    privater ElevenLabs-Agent "Anna"
                    STT / LLM / TTS / Tools
```

**Wichtig:** Der Worker ist **nur Autorisierungs-/Token-Dienst**, nicht Teil des laufenden Audios. Neue Tokens zu sperren trennt **keine** schon aktive Verbindung. Die lokale Sitzung wird über das SDK beendet; zusätzlich wird die maximale Gesprächsdauer am ElevenLabs-Agenten konfiguriert. API-Schlüssel bleiben immer serverseitig. Das WebRTC-Token ist ein kurzlebiges, im Browser unvermeidbar sichtbares *Bearer-Token* und darf nur flüchtig verarbeitet werden.

## 2. Verantwortungen und Grenzen

| Bereich | Darf | Darf nicht | Owner |
|---|---|---|---|
| `web/` | Rolle, Navigation, UI, Demo-Katalog, lokal laufende Medien, RAM-Logbuch, Eventzustände, F9, STOPP; Token anfordern und SDK nutzen | PIN authentifizieren; ElevenLabs-API-Key enthalten; klinische Entscheidungen; Einträge ohne Bestätigung persistieren | Chat 01 |
| `worker/` | HTTPS `POST /api/session`; PIN, Exact-Origin-Prüfung, Rate-Limits, globales Token-Budget, Freischaltung; nur autorisierte Token-Ausgabe | Gesprächs-Audio entgegennehmen; Logbuch speichern; Agent-Tool-Aufrufe für UI interpretieren | Chat 02 |
| `agent/` | Ein **privater** Agent „Anna“, Persona für Patient/in bzw. Angehörige, allgemein verständliche freigegebene Beispiele, Client-Tool-Definitionen | Browserzustände direkt ändern, PIN sehen, echte Therapiedaten speichern, API-Schlüssel in die PWA schreiben | Chat 03 |
| `docs/`, `tests/`, Integration | Vertragsänderungen koordinieren, Integrations-/Gerätetests durchführen | ohne Chat 00 eigenmächtig HTTP-Felder, Toolnamen oder Statusdefinitionen ändern | Chat 00 / Chat 04 |

Chat 01 ist die **einzige Autorität für lokalen App-Zustand**. Der Agent darf App-Aktionen nur vorschlagen bzw. als Client Tool aufrufen, deren Umsetzung und Validierung vollständig im `ActionDispatcher` liegt. Der Worker kennt keine UI-Details oder Rollen.

## 3. Konkrete technische Festlegungen

1. **Frontend:** Vite + TypeScript + native DOM/CSS, kein zusätzliches schweres UI-Framework. Mobile-first, knappe Abhängigkeiten; responsive für Tablet.
2. **Hosting:** GitHub Pages über GitHub Actions, HTTPS. Relativer Vite-`base`-Pfad passend zu `/<repo>/`; Manifest und Assets ebenso. Kein geheimer Build-Parameter. Die öffentliche Worker-Basis-URL ist zulässige Frontend-Konfiguration.
3. **SDK:** offizielles `@elevenlabs/client`; beim Aufbau die konkrete aufgelöste Version in `web/package-lock.json` sperren. WebRTC mit `Conversation.startSession({ conversationToken, connectionType: 'webrtc', ... })`. Keine nicht dokumentierte interne SDK-Manipulation.
4. **Privater Agent:** ElevenLabs Authentifizierung aktiv (`enable_auth=true`), **keine öffentliche Agent-ID-Session** und **keine kombinierte ElevenLabs-Allowlist**; Worker prüft erlaubten Web-Origin selbst. Signierte WebSocket-URL ist **nicht** der V1-Pfad.
5. **Client Tools:** Agenten-Toolname und registrierter `clientTools`-Schlüssel müssen exakt gleich (case-sensitive) sein. Alle Tools führen in den gleichen `ActionDispatcher`, nie direkt auf beliebige DOM-IDs/URLs.
6. **Rolle:** vor dem Start `patient` oder `caregiver`; gleicher privater Agent. Übergabe als `dynamicVariables` (`role`, `proactivity_enabled`) beim Sitzungsstart; Agent-Template nutzt genau diese Namen. Touch-Änderungen während einer laufenden Session werden über `sendContextualUpdate` mitgeteilt; keine Agent-Umschaltung erforderlich.
7. **Inhalte:** versionierte fiktive `web/src/data/`-Kataloge, Medien/PDFs aus genehmigten statischen Assets; keine personenbezogenen Daten, keine dynamische Cloud-Persistenz.
8. **Logbuch:** Demo-Startwerte werden bei Seitenstart in RAM kopiert; keine `localStorage`-, `IndexedDB`- oder Cloud-Speicherung von Logbucheinträgen; Reload stellt den Ausgangszustand wieder her.
9. **Proaktivität:** zunächst `false`. Nur bei aktivem, nicht stummem Voice-Dialog; keine Hintergrundaufgabe/Push/Timer ausserhalb der aktiven Sitzung. Agent-Prompt begrenzt Häufigkeit und respektiert AUS.
10. **Sichere Nutzung:** keine echten Patientendaten; keine diagnose- oder therapieentscheidenden persönlichen Anweisungen. Bei Unsicherheit allgemeine Information, Hinweis auf Fachpersonal.
11. **Betrieb:** Zunächst Mock, dann geschützter kleiner Live-Test. Unabhängige Ausführung der drei Arbeitsstränge gemäss Abschnitt 9.

## 4. Voice-Modul: Trennung und Wiederverwendbarkeit

**Schnittstelle:** `VoiceService` nach `API_CONTRACT.md`, nicht SDK-spezifisch. `web/src/voice/` enthält Schnittstelle, zustandsbezogene Typen, Mock und ElevenLabs-Adapter; **keine** Reha-Inhalte oder fest codierte Katalog-IDs. ActionDispatcher/Tool-Mapping sitzt außerhalb des wiederverwendbaren Voice-Kerns.

- `VoiceService`: `start(context)`, `setMuted(boolean)`, `stop()`, `getState()`, `subscribe(listener)`; **Stop muss lokal sofort wirken** (synchrone lokale Unterbrechung vor Promise-Cleanup).
- `MockVoiceAdapter`: deterministische Statuswechsel, simulierbare Connect-Verzögerung, Fehler und eingehende Tool-Aufrufe; kein PIN, keine externe API.
- `ElevenLabsAdapter`: erhält beim Erzeugen einen injizierten `SessionTokenProvider` (PIN-Dialog + Worker-Aufruf werden **außerhalb** des Voice-Kerns umgesetzt), bindet `Conversation.startSession`, SDK-Eventübersetzung, `setMicMuted`, `setVolume`, `endSession`; vermittelt Tool-Callbacks über einen ebenfalls injizierten `dispatchTool`-Handler und gibt dessen `ActionResult` an den Agenten zurück. Dadurch kennt der Voice-Kern weder PIN-Felder noch Reha-Aktionen.
- `ActionDispatcher`: akzeptiert UI- oder Tool-Aktionen; überprüft Session-Generation, Typen, IDs, Verfügbarkeit, Bestätigung; gibt strukturierte Erfolg-/Fehlerwerte zurück. Die Demo-Fachlogik liegt **nicht** im VoiceAdapter.
- Für Folgeprojekte müssen nur `ConversationContext`/`ActionRegistry`, Inhalte und UI ausgetauscht werden. Die Worker-Token-Funktion kann separat wiederverwendet werden.

## 5. Zustände, Audio und Abbruchverhalten

**Zwei getrennte Zustandsdimensionen** statt des widersprüchlichen Einzelstatus `muted`:

```text
phase = off | connecting | active | stopping | error
userMuted = false | true   (nur für aktuelle aktive/aufbauende Sitzung)
effectiveMuted = userMuted OR videoSuppressesVoice
```

`muted` ist **kein** Verbindungsstatus. `effectiveMuted` wird aus dem Wunsch des Nutzers und optionaler Medienunterdrückung abgeleitet. Eine automatische Medien-Pause darf ein vom Nutzer gesetztes STUMM **nicht** rückgängig machen. In der UI sind Phase und Stummschaltung sichtbar getrennt.

| Bedienung | Verhalten | Medien und Logbuch |
|---|---|---|
| **COACH EIN** bei `off`/`error` | Mit expliziter Aktion PIN-Dialog, Worker-Token, Mic-Berechtigung und neue SDK-Session; `connecting → active`. Kein Autostart nach Reload. | Restliche UI bleibt nutzbar. |
| **COACH AUS** bei `connecting`/`active` | Sofort lokal KI-Audio unterbinden, Session-Cleanup anstoßen; `off` nach Abschluss; spätere Callback-Daten verworfen. | **Nicht** automatisch laufendes Video/PDF stoppen; Logbuch bleibt. |
| **STUMM EIN** | In aktiver Session Mikrofon `setMicMuted(true)` **und** Sprachausgabe `setVolume({volume:0})`; erst als erfolgreich anzeigen, wenn beides angewendet wurde. Schlägt eines fehl, Voice beenden und Fehler zeigen (fail closed). | UI/Medien bleiben bedienbar; Video-Ton nicht Teil von STUMM. |
| **STUMM AUS** | `setMicMuted(false)` und voriges KI-Volume (Standard 1) wiederherstellen, außer Video unterdrückt Voice. | Video-Ton bleibt unabhängig. |
| **STOPP** | **Vor jedem Await** lokal Audio deaktivieren, laufende `MediaView`-Audio/Video pausieren/stoppen, Session-Generation erhöhen und alle alten Tool-Callbacks sperren; danach `endSession`/Cleanup. Niemals automatisch verbinden. | `pendingLogEntry` verwerfen, bestehendes RAM-Logbuch nicht löschen. UI bleibt bedienbar. |
| **Reload/Tab schließen** | Kein Autostart; `off`, `userMuted=false`; bestmöglich Session-Cleanup bei `pagehide`. | Logbuch zurück auf fiktive Anfangswerte. |

**Race-Schutz:** Jeder Start bekommt eine monotone `generationId`; `stop` oder `coachOff` invalidiert diese sofort. Wenn ein verspäteter Token oder `startSession`-Promise zurückkommt, darf er weder Audio freischalten noch Zustand ändern; eine nachträglich erzeugte SDK-Instanz muss sofort beendet werden. Unterbrechung lokaler Medien darf **nie** auf Netzantwort warten. **Keine harte Echtzeitgarantie der Android-Audio-Hardware** ohne Nokia-Test.

**Während Video:** `openVideo` zeigt einen Player mit deutlich sichtbarem Play-Button. Autoplay über Client Tool kann vom Browser blockiert sein; daher keine Autoplay-Garantie. Wenn Video tatsächlich läuft, darf Anna optional beidseitig stumm geschaltet werden (`videoSuppressesVoice`). Nach Videoende nur wiederherstellen, falls `userMuted=false` und Session noch aktiv. STOPP hält beides an.

**Sitzungsdauer:** **300 Sekunden maximal** am ElevenLabs-Agenten (`conversation_config.conversation.max_duration_seconds=300`) und zusätzlich lokal ab tatsächlichem Verbindungsbeginn; `stop()` bei Ablauf. Anbieterlimit ist der wichtigere Schutz gegen Gebühren bei verlorener Browser-Verbindung, aber **kein CHF-Budget-Limit**.

## 6. PIN, Missbrauchsschutz, Budget

- Worker `POST /api/session` ausschließlich via HTTPS und `Content-Type: application/json`; kein Cache. `Origin` exakt gegen konfigurierte GitHub-Pages-Origin prüfen; Preflight `OPTIONS` gezielt beantworten. CORS ist **kein** Authentifizierungsersatz.
- PIN aus der Nutzereingabe wird ausschließlich serverseitig mit dem als **Cloudflare Secret** gespeicherten `DEMO_PIN` verifiziert; kein PIN im Quellcode oder GitHub Actions. Bevorzugt längere zufällige Demo-PIN/Passphrase, keine vierstellige leicht zu erratende PIN. Keine Speicherung in Browser-Storage; Eingabefeld nach Anfrage leeren.
- Ein SQLite-backed **Durable Object** `AccessLimiter` mit genau einer globalen Instanz (`idFromName('demo-global')`) führt **atomar** Fehlversuche/Token-Ausgabe-Zähler; personenbezogene Therapiedaten werden **nicht** gespeichert. Der Free-Tarif unterstützt SQLite-backed DO. Keine globalen Worker-JS-Variablen als Sicherheitszähler, keine KV-basierte Sperre mit Eventual Consistency.
- Startwerte für Mock-up: höchstens **5 fehlgeschlagene PIN-Versuche pro IP in 15 Minuten**, höchstens **3 autorisierte Token pro IP in 15 Minuten**, höchstens **12 Token-Ausgaben global pro UTC-Tag**. Alle Grenzen serverseitig, konfigurierbar **ohne Vertragsänderung**. Eine atomare global reservierte Ausgabe zählt auch, wenn der Provider danach scheitert (fail-closed, verhindert paralleles Überziehen).
- Sperre `LIVE_ENABLED=false` verhindert jegliche **neue** Token-Ausgabe. Keine öffentlich erreichbare Admin- oder Mock-Token-Route; keine Token in Logs, Fehlern oder URLs. Nicht unterstützte/fehlende Bindings und Secrets führen zu `503`, niemals zu offenem Betrieb.
- Die Tagesgrenze begrenzt **ausgegebene Tokens, nicht ElevenLabs-Gebühren**. **Vor Live-Freischaltung** Abrechnungs-/Guthaben-/Nutzungsgrenzen am ElevenLabs-Konto prüfen, automatische Aufladung deaktivieren, verfügbare Kontingente notieren; unter 50 CHF Gesamtbudget bis 31.12.2026 bleiben. Keine kostenpflichtigen Optionen ohne Freigabe.
- Keine Entwickler-/Test-Tokens über die öffentliche Worker-Route. Für Unit-Tests lokale Fake-Provider, für Browser-Mock `MockVoiceAdapter`.

**Datenschutz:** GitHub Pages ist öffentlich. In ElevenLabs die Audiorecording-Speicherung deaktivieren und Transkript-/Audio-Retention soweit im Tarif möglich auf **0 Tage** setzen; tatsächliche Kontoeinstellungen prüfen und dokumentieren. ElevenLabs nennt sonst standardmäßig längere Aufbewahrung. Zero-Retention-Modus nicht ohne Prüfung seiner Verfügbarkeit voraussetzen. Auch bei RAM-Logbuch verarbeitet der Cloud-Agent Audio/Text.

## 7. Agent „Anna“ und App-Aktionen

Eine Agenten-Instanz, zwei Rollenperspektiven. `agent/` liefert Persona, Freigabetext und insgesamt **sechs** exakt benannte Client Tools (einschließlich `confirmLogEntry`; siehe unten). Die verbindlichen Parameternamen, Rückgaben und Prüfungen stehen in `API_CONTRACT.md`.

1. `openInfo` – bekannte Info-ID anzeigen.
2. `openVideo` – bekannten Clip anzeigen (nicht blind autoplayen).
3. `openLogbook` – RAM-Logbuch anzeigen.
4. `proposeLogEntry` – gültigen, unbestätigten Eintrag vorbereiten.
5. `confirmLogEntry` – **nur nach explizitem Bestätigungssignal** einen vorhandenen Vorschlag committen.
6. `setProactivity` – lokales Proaktivitätsflag ändern.

**Logbuch-Safety:** Ein Tool-Aufruf allein ist **kein Nachweis** einer Bestätigung. Der Client akzeptiert `confirmLogEntry` nur, wenn seit Erstellung eines gültigen `pendingLogEntry` eine eindeutige positive **finale Nutzeräußerung** in derselben Session beobachtet wurde; andernfalls zeigt die UI eine Touch-Bestätigung. Keine positive finale Transkription ⇒ kein sprachlicher Commit. Der Agent darf keinen Eintrag direkt ins Logbuch schreiben. Beim STOPP wird der Vorschlag gelöscht. Die Spracherkennung ist nicht klinisch belastbar; Touch ist der robuste Rückfallweg.

## 8. Abhängigkeiten, Deployment, Tests

```text
therapiecoach-demo/
  web/                 # Chat 01; Vite/TS, PWA, Voice, Inhalte, Mock
  worker/              # Chat 02; Worker, DO, API- und Auth-Tests
  agent/               # Chat 03; Persona, Tool-Schemas, Agent-Setup
  docs/                # gemeinsame freigegebene Dokumente, Chat 00
  tests/               # gemeinsame E2E/Checklisten, Chat 04
  README.md
```

**Parallelisierbarkeit:** Nach diesem APPROVED-Vertrag kann `web/` komplett gegen den MockVoiceAdapter testen; `worker/` kann ElevenLabs mittels lokaler Fake-Fetch-Antwort simulieren; `agent/` kann Toolnamen/-Parameter offline dokumentieren und im Dashboard mit Testagent testen. Erst Chat 04 verbindet echte Konten und führt Nokia-Tests durch. Entwicklungs-Chats ändern `docs/ARCHITECTURE.md` oder `docs/API_CONTRACT.md` **nicht**; sie melden Änderungsbedarf an Chat 00.

**Testklassen:** lokal/CI (Typechecks, Build, Action- und State-Mocks, Worker-Auth-/Rate-Limit-Tests, Tool-Vertragschecks), Desktop-Browser (Media/HTTPS/PWA), **Nokia C22 real** (Mic, WebRTC, STUMM beidseitig, Audio-STOPP unter 1 s als Testziel, F9, Netzunterbruch, 5-min-Grenze), Tablet später. Ein erfolgreicher CI-Build ersetzt keine Nokia-Tests.

## 9. Abgrenzung und dokumentierte Risiken

| Risiko | Gegenmaßnahme / offenes Gate |
|---|---|
| WebRTC/Audio auf Android 13 Go verhält sich anders als Desktop | echter Nokia-Test, dokumentierte Browser- und SDK-Version; kein Wechsel auf WebSocket ohne Entscheidung von Chat 00 |
| SDK-`setMicMuted`/`setVolume(0)` blockieren lokal nicht sofort zuverlässig | Fail-closed, STOPP lokal, Gate C erfordert praktischen Nachweis |
| Nach Token-Ausgabe kann ein Gespräch weiterlaufen | ElevenLabs Max-Duration 300 s, lokaler Timer, Konto-Kontingente; keine Behauptung global harter CHF-Sperre |
| Ein Agent halluziniert Tool-Parameter / Bestätigungen | strikte ID-Typ-/Längenprüfung, `pendingLogEntry`, unabhängiger User-Nachweis oder Touch |
| Android blockiert Autoplay und Hintergrund-F9 | sichtbarer Play-Button, F9 nur im Vordergrund |
| Drittanbieter speichern Gesprächsdaten | nur fiktive Daten, Retention-/Audioeinstellungen prüfen; keine echten klinischen Daten |
| Cloudflare-Free-Kontingente oder Provider-Funktionen ändern sich | Plan/Preise vor echtem Einsatz im Dashboard prüfen, bei Überschreitung fail-closed |

## 10. Dokumentation der Freigabe

**Chat 00 / ADR-001:** PWA + Worker + direkter ElevenLabs-WebRTC-Pfad beibehalten.  
**ADR-002:** `VoiceState.phase` und `userMuted` getrennt; `STOPP` als sofortiger lokaler Safety-Pfad.  
**ADR-003:** Eine zentral koordinierte SQLite-backed Durable-Object-Instanz statt regionsübergreifend nur approximativer Rate-Limit-Bindings.  
**ADR-004:** Agent private auth, WebRTC-Token, `@elevenlabs/client`; keine WebSocket-Signed-URL im V1-Betrieb.  
**ADR-005:** Client-Tool-Commit des RAM-Logbuchs nur mit Client-seitiger Bestätigungsevidenz, sonst Touch.  
**ADR-006:** Anbieter-Max-Duration auf 300 s, lokaler 300-s-Timer und manuell geprüfte Anbieter-Kontengrenzen.  
**ADR-007:** Sechs Agent-Tools, kein eigenständiges siebtes Steuerwerkzeug.  

### Offizielle, am 2026-11-02 geprüfte Referenzen

- ElevenLabs JavaScript SDK: https://elevenlabs.io/docs/eleven-agents/libraries/java-script
- ElevenLabs WebRTC-Token: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
- ElevenLabs Agent Authentication: https://elevenlabs.io/docs/eleven-agents/customization/authentication
- ElevenLabs Client Tools: https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- ElevenLabs Dynamic Variables: https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- ElevenLabs Max Conversation Duration: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
- ElevenLabs Retention: https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
- Cloudflare Workers Rate Limits / Strict Limits: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Cloudflare Durable Objects Free/SQLite: https://developers.cloudflare.com/durable-objects/platform/limits/
- Cloudflare Durable Objects Pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
