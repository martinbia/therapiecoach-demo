# HANDOFF_FRONTEND – Chat 01

**Version:** 1.0.0 · **Datum:** 02.11.2026  
**Vertrag:** `API_CONTRACT.md` v1.0 und `ARCHITECTURE.md` v1.0 (**APPROVED**).  
**Quelle/ID:** ZIP `therapiecoach_frontend_v1.0.0.zip`, **kein Git-Commit**, da kein Repositoryzugriff vorliegt.  
**Owner:** Chat 01 (`web/`). **Merge/Deployment:** Chat 04.

## 1. Übergabe und Funktionsumfang

Im Paket: `web/` (Vite + TypeScript, DOM/CSS, Voice-Service, Mock/Live-Adapter, TokenProvider, Medien/PDFs, Tests, README, PWA-Assets), `.github/workflows/frontend-pages.yml`, `README.md`, diese Handoff-Datei.

| Funktion | Umsetzungsstatus |
|---|---|
| Patient/in und Angehörige/r, vier Kacheln, Tablet-CSS | **Implementiert**, Nokia nicht getestet |
| Infos, PDF und zwei animierte MP4-Demos | **Implementiert**, Beispiel-PDF gerendert, MP4-Dauer geprüft |
| RAM-Logbuch, fiktive Ausgangslage, Reset nach Reload | **Implementiert**, Unit-Test bestanden |
| Explizite Touch-Bestätigung; Agentenbestätigung mit Client-Evidenz | **Implementiert**, Unit-Tests bestanden |
| Proaktive Nachfragen default AUS | **Implementiert**, Mock-Intervall nur bei aktiver Sitzung |
| `VoiceService`/`MockVoiceAdapter`, 300-s-Timer | **Implementiert**, Zustandstests bestanden |
| `ElevenLabsAdapter` + WebRTC / privater TokenProvider | **Implementiert/Integration vorbereitet**, echte SDK-/Hardwareprüfung offen |
| `COACH EIN/AUS`, `STUMM`, `STOPP` + verspätete Events | **Implementiert**, Mock-Unit-Tests bestanden |
| F9 bei fokussierter PWA, kein PIN-Fokus | **Implementiert**, Predicate-Unit-Test bestanden; echte BT-Tastatur offen |
| PWA/Service Worker, GitHub-Pages-Basis-Pfad, Workflow | **Konfiguriert**, echter Build/Deployment noch offen |

## 2. Schnittstellen – unverändert v1.0

- Browser → Worker: `POST {VITE_WORKER_BASE_URL}/api/session`, `Content-Type: application/json`, Body exakt `{ "pin": "..." }`, `credentials:'omit'`; Erfolg `{ "conversationToken": "..." }`. PIN nie als Buildwert, nie gespeichert. Der Browser übermittelt nur eine interaktive PIN bei Live-Start. Worker wird **nicht** von Chat 01 implementiert.
- Browser → ElevenLabs: `Conversation.startSession({conversationToken, textOnly:false, connectionType:'webrtc', dynamicVariables:{role,proactivity_enabled}, clientTools})`, Agent privat. `@elevenlabs/client` ist im `package.json` auf **1.32.1** festgelegt. Der SDK-Adapter wird nur im Live-Modus dynamisch geladen.
- Genau sechs Toolnamen, Payloads und `ActionResult` nach API v1.0. `ActionDispatcher.dispatchTool` prüft strikte Top-Level-Keys, IDs, Strings/Längen, aktive Generation und Bestätigung. Sprachtranskript-Evidenz nur nach `onMessage` mit Rolle `user`, nie AI-Texte; enge Positivliste, 30 s, keine weiteren widersprechenden Äußerungen. Bei fehlender Provider-Evidenz nur Touch-Commit.
- `VoiceState`: Phase + `userMuted` + `effectiveMuted` + `generationId` + `errorCode?` unverändert. `stop()` invalidiert Generation synchron **vor Promise/SDK-Cleanup**; MediaView hält Videos lokal an; Vorschläge werden bei STOPP verworfen. `COACH AUS` lässt Medien und offenen Vorschlag bestehen.
- Webseitiger Login entfällt bewusst; Cloudflare/Agent-Verantwortung bleibt bei Chats 02/03.

## 3. Tatsächlich ausgeführte Tests (dieser Lauf)

1. `node --experimental-transform-types --test tests/*.test.ts` mit Node **v22.16.0**: **18/18 PASS**, 0 FAILED (Mock-State, Doppelstart, STOPP beim Connect, späte Tools, F9-Predicate, Video-Mute-Kollision, Eingabe-/Bestätigungskontrolle, Reload-Reset, Proaktivitätsprüfung).
2. `tsc --noEmit -p tsconfig.json` mit global installiertem TypeScript: **PASS**, **aber** gegen lokale temporäre `node_modules`-Deklarations-Stubs für `@elevenlabs/client`, `vite` und Node, weil npm-Pakete nicht heruntergeladen werden konnten. Original-SDK-Typcheck im CI **noch nicht geprüft**. Stubs wurden **nicht** in die ZIP aufgenommen.
3. `ffprobe` für selbst erzeugte Videos: `stairs-demo.mp4` **6.000 s**, `chair-demo.mp4` **6.000 s**; beide H.264/yuv420p. PDF `treppen-demo.pdf` mit PDF-Renderer erstellt/geprüft; keine externen oder urheberrechtlich geschützten Demovideos verwendet.
4. Offline transpilierten Browser-Smoke-Build erstellt (TypeScript→ES-Module); **Browser-Smoketest nicht bestanden/ausführbar**: Chromium/Playwright blockiert Navigation sowohl auf `http://127.0.0.1` als auch auf `file://` mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Kein Desktop-GUI- oder Nokia-Test daraus abgeleitet.
5. Versuch `npm view`/npm-Register im Container: DNS-Fehler **`Could not resolve host: registry.npmjs.org`** / Timeout. Deshalb **kein echter `npm install`/`npm run build`/`npm ci`**, kein `package-lock.json`. Der GitHub-Workflow installiert die exakt gepinnten Direktabhängigkeiten per `npm install` und führt den echten `tsc`/Vite-Build erst im CI aus. Nach erstem Erfolg npm-Lockfile committen und auf `npm ci` umstellen.
6. **Nicht durchgeführt:** GitHub Actions, Pages-Deployment, reale Cloudflare-Antworten, ElevenLabs-Live-WebRTC, Mikrofon, echte F9-Bluetooth-Taste, Nokia C22, Tablet.

## 4. Bekannte Einschränkungen / Safety / Datenschutz

- **SDK-Mute-Grenze:** In der gegenwärtig sichtbaren ElevenLabs-Implementierung kann `setMicMuted` intern einen Promise-Fehler behandeln und `onError` auslösen, ohne dem Aufrufer eine verlässliche Mute-Acknowledgement zu liefern. `setVolume` kann synchron sein. Adapter ruft beide Methoden, reagiert auf SDK-Fehler mit Stop, hat aber vor Nokia-Test **keinen Nachweis** eines lückenlosen beidseitigen Mute. **Gate C offen**, bei unzuverlässigem Verhalten Live-Modus nicht freigeben. An Chat 00 als Implementierungsrisiko melden (keine Vertragsänderung vorgenommen).
- **STOPP während noch ausstehendem `startSession`:** Generation und UI/Medien werden sofort lokal gesperrt, das später gelieferte SDK-Objekt wird mutet+beendet. Ob Audio **während des noch laufenden SDK-Verbindungs-Promises** bereits kurz ausgegeben werden kann, muss Chat 04 am Nokia prüfen. Kein Versprechen einer Hardware-Audiolatenz unter 1 s vor Test.
- **WebRTC/Browser-API dynamisch:** `@elevenlabs/client` v1.32.1 und Browserkompatibilität zur echten Version erst bei Dependency-Installation/CI und Nokia verifizieren. Bei abweichenden SDK-Typen keinen stillen Wechsel von WebRTC zu WebSocket vornehmen.
- **Kosten:** Default `VITE_VOICE_MODE=mock` = keine eigenen ElevenLabs-/Workeranfragen. Tokenfreigabe nur via Worker. Budgetfreigabe ≤50 CHF bis 31.12.2026 gilt weiter; Agent-Limit 300 s muss in `agent/` gesetzt sein, lokaler Timer allein garantiert keine Budgetgrenze.
- **Datenschutz:** Nur fiktive Inhalte und Startdaten. Kein `localStorage`, `sessionStorage`, `IndexedDB`, Backend-Logbuch oder echte Patientennamen. GitHub Pages ist öffentlich. PIN-Dialog leert Eingabe nach Submit und verarbeitet sie in flüchtigem Funktionsscope; kurzlebiges Bearer-Token ist im Browser zur WebRTC-Einrichtung notwendigerweise temporär vorhanden. Provider-Retention separat prüfen.
- **Medien:** Selbsterstellte Animationsplatzhalter, keine fachlich freigegebenen Therapie-Demos. Video-Autoplay wird nicht angenommen; Play-Button sichtbar. PDF-Inline-Anzeige hängt vom Browser ab; separater `PDF öffnen`-Link vorhanden.

## 5. Nächste konkrete Aktionen (Chat 04)

1. Paket im neuen GitHub-Repository in `frontend` bereitstellen und mit `worker/` und `agent/` koordinieren; **nicht** `docs/` überschreiben.
2. In GitHub Actions `npm install`, `npm run typecheck`, `npm test`, `npm run build` erfolgreich ausführen. Eventuelle Original-SDK-Typabweichungen gezielt im Adapter beheben, mit Chat 00 abstimmen falls externes Feld betroffen. Anschließend `web/package-lock.json` erzeugen/committen und Workflow auf `npm ci` umstellen.
3. Mock-Website auf Pages veröffentlichen und im Desktop/auf dem Nokia prüfen: Touch, CSS, Seitenpfad, PDFs, MP4, temporärer Logbucheintrag, Reload, proaktiver Schalter, STOPP, F9 mit BT-Tastatur.
4. Worker Handoff aus Chat 02 und Agent Handoff aus Chat 03 zusammenführen. Erst nach Kosten-/Retention-/Origin-/PIN-Tests Build-Variablen auf Live setzen und auf privatem Agenten einen kurzen WebRTC-Test durchführen.
5. Auf Nokia die Abnahmefälle N01–N12 aus `IMPLEMENTATION_PLAN.md` dokumentieren. Schwerpunkte: `setMicMuted`+`setVolume`, STOPP während Connecting/AI-Audio/Video, Netzunterbruch, finale Benutzertranskripte für Sprachbestätigung, 300-s-Agentlimit.

**Keine Nutzeraktion erforderlich, um die Mock-Entwicklung abzuschließen.** Für echtes Deployment benötigt Chat 04 ein neues GitHub-Repository, für Live außerdem Cloudflare-/ElevenLabs-Kontofreigabe und tatsächliche Gerätemessungen. Keine kostenpflichtige Freigabe durch diese Übergabe.
