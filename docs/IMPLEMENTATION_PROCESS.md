# Implementierungsprozess und parallele Chat-Organisation

**Version:** 1.0 · 2026-11-02  
**Ziel:** Parallele Arbeit ohne doppelte Implementierung oder Schnittstellenkonflikte.

## 1. Vorbereitung in ChatGPT

1. Neues ChatGPT-Projekt „KI-Therapiecoach“ erstellen.
2. **Nur den Text aus `PROJECT_MAIN_PROMPT.md`** in das Feld *Projektanweisungen* kopieren (unter 8.000 Zeichen).
3. Als gemeinsame Projektquellen hochladen: `PROJECT_RULES.md`, `PROJECT_BRIEF.md`, `IMPLEMENTATION_PROCESS.md` sowie zunächst `ARCHITECTURE.md` und `API_CONTRACT.md` **mit Entwurfsstatus**.
4. Die Startprompts aus `prompts/` in einzelne Chats kopieren. Diese Prompt-Dateien müssen nicht alle als Projektquellen hochgeladen werden.
5. Geheimnisse niemals in ChatGPT-Projektdateien oder Chats ablegen.

## 2. Chat 00 zuerst: Architektur und Freigabe

- `prompts/CHAT_00_ARCHITECTURE.md` starten.
- Gemeinsam mit dem dortigen Chat `PROJECT_BRIEF.md`, `ARCHITECTURE.md` und `API_CONTRACT.md` prüfen.
- Offene technische Punkte anhand aktueller offizieller SDK-/API-Dokumentation klären, insbesondere ElevenLabs-Token, Mikrofon/Mute, Client Tools, Cloudflare-Limits und GitHub-Pages-Basis-Pfad.
- Die Dateien `ARCHITECTURE.md` und `API_CONTRACT.md` von **DRAFT** auf **APPROVED** stellen, Versionen dokumentieren.
- Geänderte freigegebene Dateien im Projekt ersetzen und im GitHub-Repository versionieren.
- Erst danach Chats 01, 02 und 03 starten. Nicht einfach anhand der Entwürfe unabhängig Schnittstellen erraten.

## 3. Parallele Arbeitsstränge

| Chat | Verantwortung | Dateien | Handoff |
|---|---|---|---|
| 01 PWA | UI, Zustand, Voice-Mock, echter Adapter, Medien, Demo-Logbuch | `web/` | `HANDOFF_FRONTEND.md` |
| 02 Cloudflare | Geschützte PIN-Prüfung, Token-Service, Rate Limits, Tests | `worker/` | `HANDOFF_BACKEND.md` |
| 03 ElevenLabs | Privater Agent, Persona, Client Tools, Testkonfiguration | `agent/` | `HANDOFF_ELEVENLABS.md` |

Parallelisierung: Die UI kann vollständig mit einem **MockVoiceAdapter** entwickelt werden, bevor Cloudflare/ElevenLabs eingerichtet sind. Worker und Agent werden unabhängig vorbereitet. Änderungen an API-Parametern müssen zu Chat 00 und anschliessend in das freigegebene `API_CONTRACT.md`.

## 4. Repository und Übergaben

Ein neues GitHub-Repository, z. B. `therapiecoach-demo`, anlegen; das bisherige Offline-Whisper-Repository unverändert lassen.

Empfohlene Top-Level-Struktur:

```text
therapiecoach-demo/
  web/
  worker/
  agent/
  docs/
  tests/
  README.md
```

- GitHub ist **maßgeblich für den aktuellen Code**; Chats sind Arbeitsumgebungen, keine automatische Dateisynchronisation.
- Idealerweise arbeitet jeder Chat in eigenem Branch (`frontend`, `worker`, `agent`) oder liefert ein Paket mit klaren Pfaden; nur Integrations-Chat führt in `main` zusammen.
- Keine Überschreibung gemeinsamer Dateien aus parallelen Chats.
- Jede Handoff-Datei nennt Commit-ID oder ZIP-Version, betroffene Dateien, Schnittstellenversion, tatsächlich ausgeführte Tests, bekannte Probleme und Nutzeraktionen.
- Dateien in der Projektbibliothek werden nach Freigabe bewusst aktualisiert. Niemals davon ausgehen, dass eine Änderung in GitHub automatisch im ChatGPT-Projekt sichtbar wird.

## 5. Chat 04: Integration und Test

Start erst nach verfügbaren Ergebnissen der Chats 01–03. `prompts/CHAT_04_INTEGRATION.md` verwenden.

**Stufen:**

1. Frontend mit MockVoiceAdapter bauen und deployen.
2. GitHub Pages im Browser auf Nokia testen (Touch, Layout, Medien, Offline-Verhalten bei Bedarf).
3. Worker mit Testkonfiguration und Rate-Limit-Tests deployen; CORS, gültige/ungültige PIN prüfen.
4. ElevenLabs-Privatagent und Client Tools konfigurieren, Token-Test durchführen.
5. Voice-Adapter anbinden und einen kurzen Live-Sprachdialog starten.
6. START/STOPP/STUMM während Antwort und bei Netzunterbruch testen.
7. Video-/Info-/Logbuch-Aktionen via Touch und Sprache prüfen; Bestätigung vor Logbucheintrag.
8. F9 mit Bluetooth-Tastatur testen, ohne Hardwareumbau; danach optional Schalter.
9. Kosten-/Datenschutzeinstellungen überprüfen und Testprotokoll aktualisieren.

## 6. Abnahme- und Sicherheits-Gates

**Gate A – UI:** Bedienbare Mock-PWA, Build erfolgreich, mit fiktiven Inhalten und ohne bezahlte Cloud-Anfragen.

**Gate B – Zugang:** Privater Agent, keine Secrets im Client; falsche PIN verweigert; Limits technisch getestet; zulässiger Origin konfiguriert.

**Gate C – Sprache:** Live-Mikrofon, Verbindungsende, STUMM, STOPP zuverlässig auf Nokia getestet. SDK-Grenzen notiert. Video und verspätete Agent-Aktionen bleiben nach STOPP beendet.

**Gate D – Demonstration:** Patient/Angehörige, Infos, Video, proaktive Frage, bestätigter Eintrag, Reload-Rücksetzen, F9; keine echten Daten. Kostenstatus bekannt.

Ein erfolgreiches CI-Build ersetzt keinen Smartphone-Test. Ein durch JS begrenztes Gespräch ist keine harte Ausgabensperre beim Anbieter.

## 7. Entscheidungen, die der Auftraggeber selbst ausführt

- Konten bei GitHub, ElevenLabs und Cloudflare einrichten bzw. Zugriff freigeben.
- Ggf. einen bezahlten Tarif bewusst aktivieren, aber nur mit geklärter Abrechnung.
- Echte API-Secrets ausschliesslich in Cloudflare-/GitHub-Secret-Verwaltungen setzen, nicht in ChatGPT.
- Auf dem Nokia Mikrofon-, Audio-, Video- und Tastaturfunktionen praktisch testen.
- Therapeutische Inhalte fachlich genehmigen.

## 8. Keine ungeplante Ausweitung

Die erste Version braucht weder Patientenaccounts noch echte Therapiedaten noch Cloud-Datenbank, automatische Push-Erinnerungen, BT-Eigenprotokoll, native APK oder professionelle Medienverwaltung. Wünsche ausserhalb dieses Umfangs zunächst als Backlog markieren.
