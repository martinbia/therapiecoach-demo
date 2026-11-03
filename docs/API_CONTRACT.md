# API- und Aktionsvertrag – KI-Therapiecoach

**Version:** **1.0** · **Datum:** 2026-11-02  
**Status:** **APPROVED – für Chats 01, 02 und 03 verbindlich.**  
**Gültigkeit:** Zusammen mit `ARCHITECTURE.md` v1.0. Dies ist der **projektinterne Vertrag**, nicht die Behauptung, dass ElevenLabs-/Cloudflare-Konten oder ein Nokia-Test bereits funktionsfähig eingerichtet wurden. Bei Abweichungen: Rückfrage an Chat 00 und Versionserhöhung vor Änderung.

## 1. Schnittstellenübersicht

| Grenze | Richtung | Vertrag | Owner |
|---|---|---|---|
| HTTP | Browser → Cloudflare | `POST /api/session` / `SessionResponse` | Chat 02 (Server), Chat 01 (Client) |
| Provider REST | Worker → ElevenLabs | `GET /v1/convai/conversation/token?agent_id=...` mit `xi-api-key` | Chat 02 |
| WebRTC/SDK | Browser → ElevenLabs | `Conversation.startSession({ conversationToken, connectionType: 'webrtc', ... })` | Chat 01, Chat 03 (Agent bereitstellen) |
| Voice-Port | App ↔ VoiceAdapter | `VoiceService`, `VoiceState`, `VoiceEvent` | Chat 01 |
| Client Tools | Agent → Browser | Sechs exakt benannte Funktionen mit Payloads aus §5 | Chat 03 (Definition), Chat 01 (Ausführung) |
| UI | Touch/F9 → Dispatcher | dieselben Aktionen wie über Client Tools, lokale Sicherheitsaktionen vorrangig | Chat 01 |

Bei Vertragskonflikten gilt: **Weder Worker noch Agent ändern ohne Chat 00 einen externen Parameternamen.**

## 2. HTTP: Browser → Worker

### 2.1 Endpunkt

```http
POST {WORKER_BASE_URL}/api/session HTTP/1.1
Origin: https://<github-account>.github.io
Content-Type: application/json
Accept: application/json

{"pin":"<interaktiv eingegebene Demo-PIN>"}
```

**Vorgaben:**

- `WORKER_BASE_URL` ist eine **öffentliche HTTPS-URL**, zur Build-Zeit oder im statischen Frontend gesetzt. Kein `agentId` und kein API-Key im Frontend erforderlich.
- Request-Body **genau** JSON-Objekt mit Pflichtfeld `pin`: `string`, Länge **6–128** Zeichen (Demo verwendet bewusst lange PIN/Passphrase). Keine zusätzlichen Schlüssel (`additionalProperties:false`). PIN wird nicht getrimmt oder stillschweigend normalisiert; UI beschreibt erlaubte Eingabe.
- Maximale HTTP-Request-Größe **1 KiB**; größere Requests werden `413`. Keine Query-Parameter und kein GET für Token-Ausgabe.
- `fetch` mit `credentials: 'omit'`, keine Cookies; PIN nur bei Start nach Nutzeraktion. PIN im Speicher nicht über den Request hinaus halten, insbesondere kein `localStorage`, `sessionStorage` oder `IndexedDB`.
- Header `Origin` muss exakt mit `ALLOWED_ORIGIN` übereinstimmen, einschließlich Schema/Hostname/Port; die Repository-Route gehört **nicht** zur Origin. Fehlender oder anderer Origin wird verweigert. Andere Browser-Origins können nicht per CORS zugreifen; serverseitig ist die PIN trotzdem Pflicht, denn Origin/CORS allein schützen nicht gegen Skripte ohne Browser.
- `OPTIONS /api/session`: für erlaubten Origin `204`, mit `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Origin: <erlaubter Origin>`; kein Tokenerzeugen, keine PIN-Abfrage.
- `Vary: Origin`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` auf Antworten; insbesondere kein Token-Caching. Kein `Access-Control-Allow-Credentials`.

### 2.2 Erfolgsantwort

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{"conversationToken":"<kurzlebiges Provider-Bearer-Token>"}
```

`conversationToken` ist Pflicht, nicht-leerer String. **Kein** `signedUrl`, `agentId`, `apiKey`, `pin`, `conversationId` oder sonstige Provider-Metadaten im Antwortobjekt. Das Frontend behandelt das Token flüchtig und ruft unmittelbar `startSession` auf.

### 2.3 Fehlerantworten

Alle Fehler verwenden JSON `{"error":"<CODE>","message":"<neutraler deutschsprachiger Text>"}`; `message` ist nur für UI, Steuerlogik nutzt `error`. Keine Rohfehler von ElevenLabs, keine internen Limits/Secrets oder PIN-Details in der Nachricht.

| HTTP | `error` | Ursache / Clientreaktion |
|---|---|---|
| 400 | `BAD_REQUEST` | falsches JSON, falsche PIN-Typ-/Länge, unbekannte Felder; Eingabe neu prüfen |
| 401 | `ACCESS_DENIED` | PIN stimmt nicht; neutrale Meldung |
| 403 | `ORIGIN_FORBIDDEN` | unzulässiger Origin; keine CORS-Freigabe; direkte Requests können Status sehen |
| 405 | `METHOD_NOT_ALLOWED` | z. B. GET statt POST; `Allow: POST, OPTIONS` |
| 413 | `PAYLOAD_TOO_LARGE` | > 1 KiB |
| 429 | `RATE_LIMITED` | IP-/Globalgrenze erreicht; keine automatische Retry-Schleife |
| 502 | `UPSTREAM_FAILURE` | ElevenLabs-Token-API antwortet fehlerhaft oder nicht im Timeout |
| 503 | `SERVICE_UNAVAILABLE` | `LIVE_ENABLED=false`, Secret/Binding fehlt oder Sicherheitsprüfung nicht verfügbar |

Beispiel: `{"error":"ACCESS_DENIED","message":"Zugang nicht möglich."}`. Frontend muss unbekannte Statuscodes defensiv als `error` behandeln; **niemals** bei Worker-Fehler auf eine öffentliche Agent-Verbindung ausweichen.

### 2.4 Serverseitige Regeln (Worker)

1. Frühzeitig Methode, Body-Limit, Origin und JSON-Schema prüfen. Vor PIN-Vergleich über **zentrales** Durable Object Sperr-/Fehlversuchsbudget ermitteln; Ausfälle der Zählinstanz ⇒ `503`, nicht öffnen.
2. PIN `DEMO_PIN` ausschließlich als **Cloudflare Secret**; Vergleich ohne zeitabhängig offensichtliche Stringpräfixreaktion (z. B. HMAC/constant-time-Digest-Vergleich). Bei falscher PIN Fehlversuch für IP atomar buchen; keine PIN in Logs.
3. Berechtigter Versuch muss das **Token-Ausgabebudget im Durable Object atomar reservieren, bevor** die ElevenLabs-Token-API kontaktiert wird. Globale DO-Instanz statt je-Worker-Instanz. Verbrauchten Slot bei Providerfehler nicht sofort freigeben (race-safe).
4. Defaultkonfiguration: `LIVE_ENABLED=false` bis Gate B; danach max. **5 Fehl-PIN/15 min/IP**, **3 gültige Ausgaben/15 min/IP**, **12 Ausgabeversuche/UTC-Tag global**. Diese Zahlen dürfen konfiguriert, aber nicht unbemerkt ausgehöhlt werden.
5. Bei Session-Start: kein Server-Session-Cookie, keine Patientennummer, keine Therapiehistorie. Über IP kann Cloudflare technische Request-Metadaten verarbeiten; im Durable Object nur minimale kurzlebige Zähler/zeitlich aggregierte Identifikatoren. Aufräum-/TTL-Konzept vor Live-Gate dokumentieren.
6. Worker nach Provider-Aufruf nur Token-String validieren; externe Fehlermeldungen in `UPSTREAM_FAILURE` abbilden; keine Rohantwort loggen.
7. Niemals PIN/Key/Token in URL, Entwicklerkonsole, Analytics oder CI-Logs. Für lokale Tests Fake-Provider und Test-Secrets verwenden; **kein öffentliches Mock-Token-Feature**.

### 2.5 Worker → ElevenLabs (offizielle API)

```http
GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=<AGENT_ID>
xi-api-key: <ELEVENLABS_API_KEY aus Cloudflare Secret>
Accept: application/json
```

Providerantwort laut offizieller Referenz: `{ "token": "...", "conversation_id": "..." }`. Worker übernimmt **nur** `token` als `conversationToken`. `AGENT_ID` liegt in Cloudflare-Konfiguration und wird im Worker-Pfad nicht vom Client geliefert. Fehler `422`, Netzwerkfehler und nicht parsebare Antwort ergeben `502`; Timeout vorsehen. Für einen privaten Agenten muss in ElevenLabs Authentifizierung **aktiv** sein. Das Provider-`conversationToken` ist für **WebRTC**, nicht als WebSocket-`signedUrl` zu verwenden.

## 3. Browser: VoiceService und Zustand

Die folgenden TypeScript-Typen beschreiben **unsere interne Abstraktion** und sind keine Behauptung, dass das SDK dieselben Methoden besitzt:

```ts
export type Role = 'patient' | 'caregiver';
export type VoicePhase = 'off' | 'connecting' | 'active' | 'stopping' | 'error';

export interface ConversationContext {
  role: Role;
  proactivityEnabled: boolean;
}
export interface VoiceState {
  phase: VoicePhase;
  userMuted: boolean;
  effectiveMuted: boolean; // userMuted || videoSuppressesVoice
  generationId: number;    // nur im Speicher
  errorCode?: string;
}
export type VoiceEvent =
  | { type: 'state'; state: VoiceState }
  | { type: 'finalUserText'; text: string; generationId: number }
  | { type: 'toolRequest'; name: ClientToolName; args: unknown; generationId: number }
  | { type: 'error'; code: string; generationId: number };

export interface VoiceService {
  start(context: ConversationContext): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  stop(): Promise<void>;
  getState(): VoiceState;
  subscribe(listener: (event: VoiceEvent) => void): () => void;
}
```

**Injektion und Abgrenzung:** `ElevenLabsAdapter` erhält bei seiner Erzeugung einen `SessionTokenProvider: () => Promise<string>` und einen `dispatchTool: (name: ClientToolName, args: unknown, generationId: number) => Promise<ActionResult>`. Der TokenProvider gehört zum App-Integrationscode: Er zeigt bei Bedarf den PIN-Dialog, sendet `POST /api/session`, verwirft die PIN unmittelbar und liefert nur `conversationToken`. Der MockAdapter braucht diesen Provider nicht. Die `clientTools`-Callbacks **müssen** `dispatchTool(...)` abwarten und dessen `ActionResult` an ElevenLabs zurückgeben; `VoiceEvent.toolRequest` ist höchstens eine zusätzliche Beobachtungs-/Testmeldung und ersetzt keine Tool-Antwort. Dadurch bleiben PIN und Reha-Logik aus dem wiederverwendbaren Voice-Kern heraus.

**Semantik:**

- `start` nur durch bewusste Nutzerinteraktion (COACH EIN/F9 im Vordergrund), niemals bei App-Load. Vorher PIN abfragen; Fehl-PIN erzeugt keine SDK-Verbindung. Mehrfachklicks/`event.repeat` starten keine parallelen Sessions.
- `stop()` führt die **lokale Sperre synchron vor dem ersten `await`** aus, invalidiert sofort die Generation, schaltet lokale KI-Ausgabe aus und startet asynchron `endSession`/Ressourcen-Freigabe. Doppelter Stop ist idempotent. STOPP ruft zusätzlich `MediaView.stopAll()` und `discardPendingLogEntry()` über den übergeordneten SafetyController, nicht innerhalb des wiederverwendbaren Voice-Moduls.
- `setMuted(true)` bedeutet **beides**: Input `conversation.setMicMuted(true)`, Output `conversation.setVolume({volume:0})`. Bei Teilausfall Fail-closed `stop` und UI-Fehlermeldung. `setMuted(false)` stellt Input und vorherigen KI-Volume-Wert (Standard `1`) nur bei aktivem Gespräch und ohne konkurrierende Videounterdrückung wieder her.
- `userMuted` ist die Nutzerwahl; `effectiveMuted` darf wegen `videoSuppressesVoice` `true` sein, obwohl `userMuted=false`. Der User-STUMM-Button darf durch eine automatische Video-Pause nicht überschrieben werden.
- Die auf dem Gerät getestete SDK-Library-Version wird in `package-lock.json` dokumentiert. Laut aktueller JS-Doku stehen `Conversation.startSession`, `endSession`, `setMicMuted`, `setVolume`, `sendContextualUpdate` bereit. Für WebRTC `connectionType:'webrtc'` ausdrücklich angeben.
- SDK-Callbacks nur solange `generationId` dem aktuellen Start entspricht und `phase` nicht `stopping/off` ist. Alte Tool-Calls müssen konsequent abgewiesen werden.
- Verbindungsende/Netzausfall ⇒ ohne Autoreconnect zurück zu `off` (bei unerwartetem Fehler vorübergehend `error` zur Anzeige); keine erneute PIN-/Token-Anfrage von selbst.
- Startkontext `dynamicVariables: {role: context.role, proactivity_enabled: context.proactivityEnabled}`; Agenten-Prompt in `agent/` verwendet exakt diese Namen. Bei proaktiver Umschaltung während laufender Session `sendContextualUpdate` (nicht als vertrauenswürdige Rückmeldung behandeln); wenn Audio stumm oder off, keine proaktiven Sprechakte.
- **300 s** maximale tatsächliche Gesprächszeit: Timer im Frontend und `conversation_config.conversation.max_duration_seconds=300` bei ElevenLabs; beide getrennt testen.

### 3.1 Zustandsübergänge

| Ausgang | Ereignis | Folge | Bemerkung |
|---|---|---|---|
| `off` / `error` | COACH EIN | `connecting` | PIN und Mikrofon notwendig |
| `connecting` | erfolgreicher SDK-Connect | `active` | nur gleiche Generation |
| `connecting` | Fehler | `error` | keine SDK-Reste abspielen |
| `connecting` / `active` / `error` | COACH AUS | `stopping → off` | Video bleibt ggf. an |
| *jeder Zustand* | STOPP | `stopping → off` | sofort Medien/KI-Audio lokal sperren |
| `active` | STUMM EIN/AUS | weiterhin `active` | `userMuted` ändern, Phase nicht |
| `active` | Timer/Disconnect | `stopping → off` | kein Autoreconnect |
| `off` | Reload | `off`, `userMuted=false` | neues RAM-Logbuch aus Fixtures |

Falls STUMM bei `connecting` angefordert wird, gewünschte Einstellung merken und unmittelbar bei Verfügbarkeit des SDK-Objekts anwenden; vor erfolgreichem Apply weder `active + stumm` anzeigen noch eine ungeschützte Ausgabe behaupten. Bei kritischer Race-Situation lieber Abbruch und neuer Start.

## 4. Gemeinsamer AppState und Dispatcher

```ts
export interface AppState {
  role: Role | null;
  proactivityEnabled: boolean;          // Default false
  selectedInfoTopicId: InfoTopicId | null;
  selectedVideoId: VideoId | null;
  logbookEntries: DemoLogEntry[];       // nur RAM
  pendingLogEntry: PendingLogEntry | null;
  voice: VoiceState;
}

export type InfoTopicId = 'stairs' | 'chair_rise';
export type VideoId = 'stairs_demo' | 'chair_rise_demo';
export type ExerciseId = 'stairs' | 'chair_rise';
```

Die IDs sind die **Mindest-Fixtures für V1**; weitere IDs sind nur erlaubt, wenn Chat 00 den gemeinsamen Katalog freigibt und beide Integrationsseiten aktualisiert werden. PDFs werden als genehmigte Dokument-Links der Info-Themen angezeigt, kein zusätzliches Voice-Tool erforderlich. Medien-URLs kommen nur aus dem lokalen, statisch validierten Katalog, **nicht** aus Tool-Parametern.

Alle UI-/Voice-Aktionen laufen über dieselbe Validierung im `ActionDispatcher`. Der **AppState** ist alleinige Quelle für UI-Zustand. Die Tool-Rückgabe wird nicht als wahrheitsgemäßer Nutzerbeleg interpretiert.

## 5. ElevenLabs Client Tools – verbindliche Definition

**Exakt sechs** Client Tools; registriert als `clientTools: { openInfo: ..., ... }` beim `Conversation.startSession`. Agent-seitig **Type = Client**, jedes Argument ist exakt typisiert, Namen sind **case-sensitive**. Für jedes Tool `Wait for response` aktivieren, damit der Agent fehlerhafte IDs oder ausstehende Bestätigung erkennen kann. Alle Funktionen führen **nur** `ActionDispatcher.dispatch(...)` aus; niemals ungeprüften Tool-Text in HTML einfügen.

### 5.1 Tool-Payloads und Wirkung

| Toolname | JSON-Parameter | Nebenwirkung | Prüfungen |
|---|---|---|---|
| `openInfo` | `{"topicId":"stairs"}` | Info anzeigen | `topicId` aus `InfoTopicId` |
| `openVideo` | `{"videoId":"stairs_demo"}` | Player anzeigen, nur wenn erlaubt abspielen | `videoId` aus `VideoId`, keine URL vom Agent |
| `openLogbook` | `{}` | vorhandene RAM-Einträge anzeigen | keine weiteren Argumente |
| `proposeLogEntry` | `{"exerciseId":"chair_rise","when":"heute Morgen","comment":"hat gut geklappt"}` | nur `pendingLogEntry` setzen, Bestätigungsdialog anzeigen | erlaubte `exerciseId`, `when`: 1–80 Zeichen, `comment`: 0–240 Zeichen; kein HTML |
| `confirmLogEntry` | `{"confirmed":true}` | vorhandenen Vorschlag nach **nachgewiesener** Bestätigung ins RAM übernehmen | echter `pendingLogEntry`; `confirmed` Boolean; eindeutige Nutzerbestätigung nach Vorschlag in gleicher Generation, sonst kein Commit |
| `setProactivity` | `{"enabled":true}` | lokalen Schalter setzen | `enabled` Boolean, keine Nebenaktion bei `off` |

`confirmed:false` verwirft den Vorschlag (wenn vorhanden); `confirmed:true` darf **niemals** allein wegen des Agentenaufrufs einen Eintrag erstellen. `proposeLogEntry` erzeugt keine ID aus Agent-Eingabe: das Frontend erzeugt eine lokale eindeutige RAM-ID. Datum/Uhrzeit in `when` sind Demo-Freitext, kein medizinischer Zeitnachweis. Maximal ein `pendingLogEntry` gleichzeitig; neuer Vorschlag ersetzt ihn nur nach expliziter UI-Behandlung (sonst Fehler `CONFIRMATION_PENDING`).

### 5.2 Verpflichtende Bestätigungskontrolle

Der `ActionDispatcher` setzt `pendingLogEntry` mit `createdAt` und `generationId`. Ein Tool `confirmLogEntry({confirmed:true})` wird nur akzeptiert, wenn:

1. der Vorschlag noch existiert und zur **aktuellen** aktiven Voice-Generation gehört;
2. **nach** dem Vorschlag eine **finale** Nutzer-Transkription eingegangen ist, die eine eindeutige Bejahung enthält (eng begrenzte erlaubte Äußerungen, etwa „Ja“, „Ja, das stimmt“, „Bitte eintragen“; Negationen/Ambiguitäten ausgeschlossen); und
3. die Bestätigung höchstens **30 s** alt ist, seither keine konkurrierende Nutzeräußerung/Änderung stattgefunden hat und sie noch nicht verbraucht wurde.

Ohne verlässliche finale Nutzer-Transkription, etwa wegen SDK-Ereignisgrenzen, ist Sprach-Commit **gesperrt** und das UI zeigt eine **explizite Touch-Bestätigung**. Touch-Bestätigung ist ein eigener authentischer UI-Klick, kein Agent-Tool, und darf bei gültigem Vorschlag auch ohne Voice funktionieren. Eine Agent-Antwort „ist gespeichert“ ist kein Beweis. Dies ist Mock-Safety und keine klinische Verifikation.

COACH AUS: Vorschlag bleibt sichtbar, darf per Touch bestätigt/abgebrochen werden; **kein** späterer Voice-Tool-Commit. STOPP: Vorschlag sofort verwerfen; alte Tool-Requests werden mit Generation-Risiko blockiert. Reload: Vorschlag und hinzugefügte Einträge verschwinden.

### 5.3 Einheitliche Tool-Rückgabe

```ts
export type ClientToolName =
  'openInfo' | 'openVideo' | 'openLogbook' |
  'proposeLogEntry' | 'confirmLogEntry' | 'setProactivity';

export type ActionResult =
  | { ok: true; code: 'OK' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED'; message: string }
  | { ok: false; code: 'INVALID_ARGUMENT' | 'UNKNOWN_ID' | 'STALE_SESSION' |
      'NOT_AVAILABLE' | 'CONFIRMATION_REQUIRED' | 'CONFIRMATION_PENDING'; message: string };
```

Beispiel erfolgreich `proposeLogEntry`: `{"ok":true,"code":"PENDING_CONFIRMATION","message":"Bitte Eintrag bestätigen."}`. Bei unbekannter ID: `{"ok":false,"code":"UNKNOWN_ID","message":"Dieses Beispiel ist nicht vorhanden."}`. Keine UI-URLs, stack traces oder Geheimnisse in Tool-Rückgaben. Der Agent soll Fehler höflich mitteilen und Alternativen anbieten. Bei unvollständig konfiguriertem `Wait for response` muss Client-UI dennoch korrekt bleiben.

### 5.4 App-Aktionen außerhalb von ElevenLabs

- `COACH_TOGGLE`: Touch und F9; `event.code==='F9' && !event.repeat`, aber nur wenn kein PIN-/Textfeld fokussiert und Browserfenster aktiv ist; bei ausgeschalteter Session PIN-Dialog statt unsicherem Autostart.
- `MUTE_TOGGLE`: nur bei laufender Voice-Session; separate Darstellung. Ein Video mutet sich dadurch nicht automatisch.
- `STOP_ALL`: lokaler, **vorrangiger** SafetyController. Für Sprach-Tool-Aufrufe **nicht** registrieren (STOPP funktioniert ohne Netz/Agent).
- Touch-Funktionen `OPEN_INFO`, `OPEN_VIDEO`, `OPEN_LOGBOOK`, `PROPOSE_LOG_ENTRY`, `CONFIRM_LOG_ENTRY`, `SET_PROACTIVITY` führen denselben Dispatcher-Pfad mit klarer Quelle `touch` bzw. `voice` aus.

## 6. Mock-Verträge und eigenständige Tests

### 6.1 Frontend-Mock (Chat 01)

`MockVoiceAdapter` implementiert exakt `VoiceService`: startet ohne PIN/Internet/Provider, simuliert `connecting→active`, User-Text und Tool-Aufruf per Test-Harness, kann Verbindung verzögern/fehlschlagen lassen. Tests: Doppelstart, STOPP während Connecting, späte Tools nach STOPP, STUMM/Video-Kollision, F9, Reload-Reset, Touch-/Voice-Gleichwertigkeit, nur bestätigte Einträge.

### 6.2 Worker-Mock (Chat 02)

Tests injizieren Fake-`fetch` für den ElevenLabs-Endpunkt mit `{ "token":"fake-test-token","conversation_id":"fake" }`; **nur in nicht öffentlich ausgelieferten Tests**, nicht in einer produktiven Route. Tests: zulässige/fehlende/falsche Origin, falscher Methode/Body/Content-Type, PIN-Fehler, DoS-Folgen, globaler paralleler Token-Zähler, Provider-Ausfall/Timeout, fehlendes Secret, Abschalter; **kein** realer Token erforderlich.

### 6.3 Agent-Vertragsprüfung (Chat 03)

`agent/` enthält Toolkonfigurationsbeschreibungen/JSON-Schemas mit genau sechs Namen und Parametern; Testskript vergleicht diese mit lokal exportierten Frontend-Kontrakt-Definitionen (oder dokumentierten Fixture-JSONs). Testdialoge für Rollen, IDs, bestätigungsbedürftige Logeinträge, Proaktivität AUS, medizinische Grenzen; Agenten-Dashboard-Tests separat als **live, ggf. kostenrelevant** markieren.

### 6.4 Integrations-Testfälle (Chat 04)

1. Falsche PIN ⇒ `401`, keine Verbindung; korrekt ⇒ Token; neuer Start erhält neues Token.
2. WebRTC Mikrofon, beidseitiges STUMM (`setMicMuted` + `setVolume`), STUMM AUS.
3. STOPP während Connect, während Anna spricht und während Video; alte Events bewirken nichts.
4. Netzunterbruch und Session-Limit 300 s ⇒ kein automatischer Neustart; lokaler Medienstop.
5. sechs Tools mit gültigen und falschen Parametern; erst Vorschlag, dann echte finale Ja-Äußerung bzw. Touch, sonst kein Eintrag.
6. Proaktivität ab Werk AUS, Rolle Patient/in/Angehörige/r, Touch/Voice, F9 mit BT-Tastatur, Reload-Reset.
7. Kein API-Key/PIN in Web-Bundle, Logs oder im GitHub-Repository; tatsächliche Kontokosten/Retention geprüft.

## 7. Versionspolitik und Änderungsvorschläge

**Fixiert für v1.0:** `POST /api/session`, JSON-Felder, Error-Codes, sechs Toolnamen und deren Payloads, `VoiceState`, `ActionResult`, 300-s-Limit, lokale Safety-Semantik. Nicht vertragskritische Stil- und UI-Details dürfen die jeweiligen Chats selbst festlegen. Neue Tools, IDs, HTTP-Felder und Zustandssemantik nur über Chat 00 mit dokumentiertem Change-Log und neuer Versionsnummer; Handoffs referenzieren den genauen Commit/Vertragsstand.

**Spezifikationsgrenze:** Die dokumentierten ElevenLabs-Methoden sind laut offiziellen Quellen verfügbar; konkrete SDK-Version, Browser-Mikrofon-, WebRTC-, Audio- und final-user-transcript-Ereignisse werden erst durch Implementierung/Hardwaretests bestätigt. Keine erfundenen Garantien.

## 8. Offizielle Quellen (geprüft am 2026-11-02)

- `@elevenlabs/client`, WebRTC, `setMicMuted`/`setVolume`/Events: https://elevenlabs.io/docs/eleven-agents/libraries/java-script
- WebRTC-Token-Endpoint: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
- Private-Agent-Auth: https://elevenlabs.io/docs/eleven-agents/customization/authentication
- Client Tools / Wait for response: https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- Dynamic Variables: https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- Agent-Max-Duration: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
- Cloudflare DO-Konsistenz, Free: https://developers.cloudflare.com/durable-objects/platform/limits/
- Cloudflare regionale vs. strikte Limits: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
