# Anna – Therapiecoach-Demonstrator (Frontend)

**Lieferstand:** 1.0.0 (02.11.2026) · **Vertrag:** `API_CONTRACT.md` / `ARCHITECTURE.md` v1.0 · **Verantwortung:** Chat 01 (`web/`).

Ein einfacher mobile-first PWA-Demonstrator für Nokia C22 / Android 13 Go und spätere Tablets. Keine Therapieanwendung und kein Medizinprodukt. Alle Inhalte, Logbucheinträge, Videos und Dokumente sind **fiktiv** bzw. selbst erstellte Platzhalter. Keine echten Patientendaten eingeben oder sprechen.

## Sofort ausprobieren – Mock ohne Konten

Die App startet **standardmässig im Mock-Modus**: Rolle auswählen, vier Bereiche öffnen, Videos abspielen, PDFs anzeigen, fiktive Logbucheinträge per Touch bestätigen, proaktive Nachfragen ein-/ausschalten, COACH EIN/AUS, STUMM, STOPP und F9 testen. Die Mock-Teststeuerung liegt unter **„Mit Anna sprechen“** und kann alle sechs Agent-Tools simulieren. Sie spricht optional mit der Geräte-Sprachsynthese; eine echte Mikrofonerkennung/ElevenLabs-Verbindung ist **im Mock-Modus nicht** aktiv.

### Dateien in ein neues GitHub-Repository übernehmen – ohne lokale IDE

1. `therapiecoach_frontend_v1.0.0.zip` auf einem PC entpacken. **Nicht** in das vorhandene Offline-Whisper-Repository einspielen.
2. Auf GitHub ein eigenes Repository anlegen (z. B. `therapiecoach-demo`). Die Verzeichnisse **`web/` und `.github/workflows/`** sowie `README.md` und `HANDOFF_FRONTEND.md` mit ihrer Pfadstruktur übernehmen. Über GitHub *Add file → Upload files* (oder Codespaces-Dateibrowser) hochladen und committen. Wenn die Web-Uploadoberfläche Verzeichnisstrukturen nicht übernimmt, die entpackten Dateien über **Codespaces** hochladen oder mit GitHub Desktop committen; ZIP-Datei **nicht** einfach als ZIP committen.
3. Unter *Settings → Pages → Build and deployment* die Quelle **GitHub Actions** wählen.
4. Unter *Actions* den Workflow **Frontend CI and GitHub Pages** prüfen bzw. *Run workflow* auf `main` ausführen. Der Workflow installiert Pakete, prüft TypeScript, führt 18 Unit-Tests aus, baut mit Vite und deployt `web/dist` nach Pages. Das passiert **erst nach** erfolgreichem CI-Lauf, nicht bereits durch diesen ZIP-Download.
5. Test-URL bei einem normalen Projekt-Repository: `https://<ACCOUNT>.github.io/<REPO>/`. Browser-Cache/Service Worker bei Änderungen ggf. einmal neu laden.
6. Auf dem Nokia C22 die HTTPS-Adresse in aktuellem Chrome öffnen. Chrome kann *Zum Startbildschirm hinzufügen* anbieten. Mikrofon wird nur für den späteren Live-Modus benötigt.

**Wichtig:** Der Workflow nutzt zunächst `npm install`, weil die Entwicklungsumgebung keine npm-Abhängigkeiten abrufen und deshalb keine echte `package-lock.json` generieren konnte. Im ersten erfolgreichen CI-Lauf wird eine Lockdatei nur **temporär im Runner** erstellt. Für reproduzierbare Folge-Builds bitte später ein von npm generiertes `web/package-lock.json` committen und im Workflow `npm install` in `npm ci` ändern. Eine Lockdatei wurde bewusst nicht erfunden.

### Optional lokal / Codespaces

Node.js ≥22.12:

```bash
cd web
npm install
npm run typecheck
npm test
npm run dev
npm run build
```

`npm run dev` öffnet den Vite-Entwicklungsserver, Standardport 5173. Die dist-Dateien liegen nach `npm run build` unter `web/dist`.

## Build-Konfiguration (öffentlich, keine Secrets)

| Variable | Default | Bedeutung |
|---|---|---|
| `VITE_VOICE_MODE` | `mock` | `mock` oder `elevenlabs` |
| `VITE_WORKER_BASE_URL` | leer | HTTPS-Basis-URL des Cloudflare-Workers, **ohne** `/api/session` |
| `VITE_BASE_PATH` | `/` lokal; CI setzt `/<REPO>/` | Basis-Pfad für GitHub Pages |

Lokale Einstellungen in `.env` möglich (Vorlage `.env.example`). Für GitHub Actions können die beiden öffentlichen Voice-Variablen als Repository **Variables** unter *Settings → Secrets and variables → Actions → Variables* gesetzt werden. Keine Secrets in `VITE_*` aufnehmen: alle Vite-Variablen sind öffentlich im Browser-Bundle.

**Erst nach Freigabe von Chat 04** `VITE_VOICE_MODE=elevenlabs` setzen und `VITE_WORKER_BASE_URL=https://...` ergänzen. Kein Frontend-Agent-API-Key und keine PIN als Build-Variable. Die PIN wird nur bei COACH EIN interaktiv angefragt und direkt an den Worker `POST /api/session` geschickt. Worker und privater Agent müssen zuvor korrekt eingerichtet und mit der realen GitHub-Pages-Origin freigegeben sein.

**GitHub Pages für Nutzerseiten:** Bei einem Repository `<ACCOUNT>.github.io` ohne Projektpfad muss `VITE_BASE_PATH=/` statt `/<REPO>/` gesetzt werden. Der Workflow ist für **Projekt-Repositories** vorbereitet; Anpassung durch Chat 04 vor Deployment.

## Bedienablauf (3–5 Minuten)

1. Rolle **Patient/in** oder **Angehörige/r** wählen.
2. **COACH EIN** – im Mock nach kurzer Verzögerung „Aktiv“. **F9** schaltet bei fokussiertem Fenster um (nicht während PIN-/Texteingabe).
3. **Therapielogbuch** öffnen → fiktiven Eintrag vorschlagen → erst **Ja, fiktiv eintragen** übernimmt ihn; sonst **Verwerfen**.
4. **Infos** → Beispielthema auswählen → PDF öffnen. **Videos** → Play drücken. Keine Autoplay-Garantie.
5. **Mit Anna sprechen** → Mock-Teststeuerung → sechs Client-Tools aufrufen, auch Fehl-ID und Verzögerung testen. Proaktive Nachfragen können eingeschaltet werden; automatische Mock-Nachfrage nur während aktivem, nicht stummem Mock-Gespräch ungefähr alle 90 s.
6. **STUMM** unterdrückt im Mock optionale Geräte-TTS und markiert die Sitzung; im Live-Modus sollen Mikrofon und KI-Ausgabe gemeinsam stummgeschaltet werden. **STOPP** beendet den Coach und stoppt zugleich Video lokal. **COACH AUS** beendet nur den Coach – Medien und ein offener Logbuchvorschlag bleiben erhalten.
7. Seite neu laden: Rolle, Sitzung, Schalter und neue Einträge werden zurückgesetzt; die zwei Startbeispiele erscheinen erneut.

### Simulation einer sprachlichen Bestätigung

Im Mock-Modus einen Eintrag über den Tool-Button `proposeLogEntry` vorschlagen. Im Logbuch unter dem Bestätigungsfeld **„Demo: »Ja« simulieren“**, danach **„Demo: Agent bestätigt“** wählen. Ohne simulierte finale Aussage bleibt das Sprach-Tool `confirmLogEntry` gesperrt; Touch-Bestätigung funktioniert ohne Transkript. Dies ist **nur** ein Test-Harness, keine wirkliche STT-Erkennung.

## Architektur / Dateiverzeichnis

```text
web/
  src/
    core/       store.ts, dispatcher.ts, safety.ts, keyboard.ts, types.ts
    voice/      voice-types.ts, base.ts, mock.ts, elevenlabs.ts
    access/     token.ts (flüchtige PIN, POST /api/session)
    ui/         app.ts (DOM-UI, lokaler MediaView)
    data/       catalog.ts (statischer fiktiver Inhalt)
    main.ts, style.css
  public/
    manifest.webmanifest, sw.js, icons/, posters/, videos/, docs/
  tests/       dispatcher.test.ts, voice.test.ts
  scripts/     create_demo_assets.py (optional – generierte Medien schon enthalten)
  package.json, tsconfig.json, vite.config.ts, .env.example
.github/workflows/frontend-pages.yml
HANDOFF_FRONTEND.md
```

Sechs exakt benannte Tools: `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `confirmLogEntry`, `setProactivity`. Erlaubte IDs: `stairs`, `chair_rise`, `stairs_demo`, `chair_rise_demo`. Alle Agent-Eingaben werden im Dispatcher geprüft. HTML-Textinhalte werden vor Einfügen escaped; Medien-URLs entstehen ausschließlich aus dem festen lokalen Katalog.

`VoiceService` trennt Voice-Status (`off`, `connecting`, `active`, `stopping`, `error`) von `userMuted` / `effectiveMuted`. Die aktuelle Startgeneration wird bei STOPP sofort lokal invalidiert; späte Tool-Antworten werden abgewiesen. Die App merkt sich **nichts** über `localStorage`, `sessionStorage`, `IndexedDB` oder einen Server. Der Service Worker speichert nur öffentliche PWA-Dateien und niemals Worker-/PIN-/Tokenantworten.

## Grenzen und Abnahme

- **Getestet:** 18 isolierte Unit-Tests mit Node 22.16.0 erfolgreich; TypeScript-Quellcheck über lokal vorhandenen Compiler mit SDK-/Vite-**Typ-Stubs**, nicht gegen die noch zu installierenden Originalpakete; zwei MP4-Clips per ffprobe verifiziert; Beispiel-PDF visuell gerendert.
- **Nicht getestet:** `npm install`/echter `npm run build` wegen DNS-Sperre zum npm-Register in dieser Ausführungsumgebung; GitHub Actions; interaktiver Chrome-Browserlauf (Testumgebung blockierte Navigation); Nokia C22; Bluetooth-F9; reale ElevenLabs-Tokens, WebRTC, Mic-Mute und Audioausgabe.
- **Sicherheitsgrenze:** SDK v1.32.1 dokumentiert `setMicMuted` und `setVolume`, aber ob beides auf Android Go **tatsächlich vollständig und synchron** stummschaltet, ist offen. Ein Fehler führt in der Adapterlogik zum Voice-Abbruch. Vor Gate C ist ein Hardwaretest obligatorisch. Die 300-s-Clientgrenze ist nur zusätzlich; die Agent-Max-Duration muss in ElevenLabs (Chat 03) auf 300 s gesetzt werden.
- **Budget:** Mock verursacht keine ElevenLabs-/Cloudflare-Aufrufe. Live erst nach separater Budget- und Datenschutzfreigabe (maximal 50 CHF externe Dienste bis 31.12.2026). Tokenlimits allein garantieren keine CHF-Kostensperre.

Aktuelle Quellen (02.11.2026): [ElevenLabs JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script), [ElevenLabs Client Tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools). Details siehe `HANDOFF_FRONTEND.md`.
