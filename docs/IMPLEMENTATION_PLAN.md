# Implementierungsplan – KI-Therapiecoach-Mock-up

**Version:** 1.0 · **Datum:** 2026-11-02  
**Status:** **APPROVED – Arbeitsplan unter Vorbehalt echter Anbieter-/Nokia-Tests.**  
**Verbindlicher technischer Vertrag:** `ARCHITECTURE.md` v1.0 + `API_CONTRACT.md` v1.0. **Verbindlicher Umfang:** `PROJECT_BRIEF.md` v0.7, `PROJECT_RULES.md`. Prozess und Rollen nach `IMPLEMENTATION_PROCESS.md`.

## 1. Ziel, Abnahmeebenen und Zeit-/Kostenprinzip

**V1-Demonstrator:** Eine mobile PWA auf Nokia C22 und später Android-Tablet, vier Hauptbereiche (Infos, Videos, Therapielogbuch, Mit Anna sprechen), Rolle Patient/in/Angehörige/r, Touch und Sprache, proaktive Nachfragen (standardmäßig AUS), sicherer privater ElevenLabs-Agent, lokale Safety-Steuerung COACH EIN/AUS, STUMM, STOPP, F9 bei fokussierter PWA, nur fiktive Daten im RAM.

- **Stand heute:** Architektur/Verträge anhand vorhandener Projektunterlagen und offizieller Dokumentation **geprüft**; **keine** Build-, Live-Provider- oder Nokia-Tests durchgeführt.
- **Externe Dienste:** Cloudflare Workers Free + SQLite-backed Durable Object als Ausgangspunkt; ElevenLabs erst nach gesicherter Kostenkontrolle. GitHub Pages für öffentliche fiktive Assets. Keine Zahlungen ohne ausdrückliche Freigabe.
- **Budget:** **maximal 50 CHF insgesamt bis 31.12.2026** für externe Dienste. Freikontingente ändern sich; vor jedem Live-Gate Dashboard/Abrechnung prüfen. Die Token-Tagesgrenze (12) ist **keine** Kostenobergrenze in CHF. Kein „einfach ausprobieren“ bei unbekannter Abrechnung.
- **Abnahmeunterschied:** `bestanden (CI/Mock)` ≠ `bestanden (Desktop)` ≠ `bestanden (Nokia C22)`.

## 2. Reihenfolge / Abhängigkeiten

```text
P0 Chat 00: Architektur + API-Vertrag freigegeben [JETZT]
       │
       ├──► P1 Chat 01: PWA, RAM-Zustand, MockVoiceAdapter, Tests ─────┐
       ├──► P2 Chat 02: Worker, DO-Limiter, Fake-Provider, Tests ───────┤
       └──► P3 Chat 03: Privatagent, Persona, Tool-Schemas/Testplan ────┤
                                                                     ▼
P4 Chat 04: GitHub-Integration, UI-Deployment, Mock-E2E im Browser
       │
       ▼
P5 Chat 04: Cloudflare + ElevenLabs Live-Integration (kostenkontrolliert)
       │
       ▼
P6 Chat 04: Nokia C22 / Bluetooth-F9 / Dokumentation und Demo-Abnahme
```

P1–P3 können **sofort parallel** beginnen, sobald diese Freigabe als gemeinsame Projektquellen vorliegt. P4 beginnt, wenn mindestens P1 für ein erstes Mock-Deployment übergeben wurde; die echte Dreiwege-Integration erst nach P1–P3. Einzelne Entwicklertests dürfen schon parallel laufen.

## 3. P0 – Architektur und Verträge (Chat 00)

**Lieferung:** `ARCHITECTURE.md` v1.0, `API_CONTRACT.md` v1.0, dieser Plan, `HANDOFF_ARCHITECTURE.md`; gemeinsame Datei-Ablage im ChatGPT-Projekt und versioniert später unter `docs/` im GitHub-Repository.

**Entscheidungen:** Direktes WebRTC statt Audio-Relay; `@elevenlabs/client`; ein privater Agent; Worker nur Token-Service; zentraler SQLite-backed Durable Object; zwei Dimensionen für Voice-Phase/Mute; 300-s-Doppellimit; sechs Toolnamen; Bestätigungs-Gate vor Logbucheintrag; STOPP synchron lokal.

**Abnahme P0:** Alle vier Dateien vorhanden, konsistente Feldnamen/Fehler/Toolnamen, offizielle Referenzen datiert, verbleibende Smartphone-/Konto-Risiken erkennbar. **Erfüllbar ohne API-Key und ohne Gerät.**

## 4. P1 – Frontend mit Mock (Chat 01, `web/`)

**Umsetzen (zunächst ohne Cloudzugang):**

1. Minimalprojekt Vite + TypeScript + native HTML/CSS; GitHub-Pages-Pfad über Vite-`base` konfigurierbar, PWA-Manifest, HTTPS-Anforderungen und README ohne lokale IDE.
2. Rollenwahl, vier große Kacheln, proaktiver Schalter AUS, Infos/Videos/PDF-Katalog, fiktive RAM-Logbuchfixtures und Touch-Bestätigung.
3. Ein gemeinsamer `ActionDispatcher` für Touch/Client Tools; erlaubte IDs `stairs`, `chair_rise`, `stairs_demo`, `chair_rise_demo`; sanitisiertes Rendering.
4. `VoiceService` mit `MockVoiceAdapter`, generischen Events, Session-Generation und Race-Schutz; `ElevenLabsAdapter` nur soweit mit klarer TokenProvider-Injektion möglich. **Keine** PIN in dauerhafter Ablage.
5. COACH EIN/AUS, STUMM und STOPP als getrennte Bedienelemente; STOPP sofort lokal, unabhängig von Mock-Backend-Delays. F9 `event.code`, nur Vordergrund, Eingabefelder ausnehmen.
6. Mock-Regler/Test-Harness für Connect-Verzögerung, späte Agent-Tools, künstliche Fehler, finalen Nutzertext und 300-s-Zeitlimit; kein echter kostenpflichtiger Aufruf.
7. CI: TypeScript-Check, Unit-/State-Tests, Vite-Build und GitHub-Actions-Pages-Deploymentvorbereitung.

**Abnahme Gate A – Mock-UI:** `npm ci`, typecheck/test/build erfolgreich; Touch-Navigation; 2 Rollen; Video/PDF; RAM-Reset bei Reload; Proaktivität default AUS; lokales STOPP unterbricht Ton/Medien ohne Netz; keine unbestätigten Einträge; F9 getestet im Desktopbrowser; kein API-Key im Bundle. **Nokia bis P6 offen**.

**Übergabe:** Dateien `web/`, `HANDOFF_FRONTEND.md`, tatsächliche CI-Resultate, `API_CONTRACT`-Referenz v1.0, bekannte Grenzen/Bedienungsanleitung.

## 5. P2 – Worker mit Zugriffsschutz (Chat 02, `worker/`)

**Umsetzen:**

1. Cloudflare Workers TypeScript, Wrangler und SQLite-backed Durable Object `AccessLimiter`; keine bezahlten zusätzlichen Cloud-Produkte.
2. `POST /api/session` gemäß Vertrag; exakte Origin/CORS/OPTIONS/Content-Type/Body-Validierung und neutrale Fehler.
3. `DEMO_PIN`, `ELEVENLABS_API_KEY` als Cloudflare Secrets; `AGENT_ID`, `ALLOWED_ORIGIN`, `LIVE_ENABLED` als serverseitige Konfiguration; Mock-/Testumgebung niemals offen ins öffentliche Internet ausstellen.
4. Zentrale atomare Zähler: 5 PIN-Fehlversuche pro IP/15 min, 3 gültige Token-Versuche pro IP/15 min, max. 12 global/UTC-Tag. Reservierung vor Provideraufruf; Ablauf/Aufräumen und Ausfallverhalten fail-closed.
5. Serveraufruf an offizielles `GET /v1/convai/conversation/token?agent_id=...` mit `xi-api-key`; `{ token }` → `{ conversationToken }`; keine Weitergabe von `conversation_id`, API-Key oder internen Providerfehlern.
6. Testbare `fetch`-Injektion für Fake-Provider in Unit-/Integrationstests; Mock nie als öffentliche Ausgabe-Route.
7. Anleitung: Cloudflare Free-Tarif prüfen, Wrangler-Deploy, Variablen/Secrets **über Cloudflare** setzen ohne Veröffentlichung, LIVE_ENABLED standardmäßig aus, Abschaltung und Rate-Limit-Diagnose.

**Abnahme Gate B – Backend:** Mock-Fetch erfolgreich; richtige/falsche PIN, Cross-Origin, kein Origin, fehlerhafte Requests, Rate-Limit-Races, Tagesdeckel, Providerfehler, fehlende Secrets und Betriebsabschaltung automatisiert getestet. Secrets nicht im Repo, CI-Ausgaben oder HTTP. Echte Token-Ausgabe erst nach Kontofreigabe und sicherem Live-Gate.

**Übergabe:** `worker/`, `HANDOFF_BACKEND.md`, Konfigurationsvariablen, Wrangler-Befehle, Tests und Ergebnisse.

## 6. P3 – ElevenLabs-Agent und Client Tools (Chat 03, `agent/`)

**Umsetzen:**

1. Agent „Anna“ mit Hochdeutsch, ruhigem/knappem Stil und freigegebenen **fiktiven** Beispielinformationen; separate Dialoghinweise für `role=patient` und `role=caregiver` via `dynamicVariables`.
2. Sicherheitsgrenzen: keine individuelle Diagnose, keine persönlichen Therapiepläne, bei medizinischer Unsicherheit Hinweis auf Fachperson; Schweizerdeutsch nur experimentell, kein Qualitätsversprechen.
3. Agent **private** konfigurieren (`enable_auth=true`), **keinen** öffentlich zugänglichen Modus und keine parallele Provider-Allowlist; Zugang durch Workertoken.
4. Agent-seitig max. Gesprächsdauer **300 s** (`conversation_config.conversation.max_duration_seconds=300`). Keine proaktive Interaktion außerhalb aktiver Sitzung, Schalter `proactivity_enabled` standardmäßig false; seltene Nachfragen bei EIN.
5. **Genau sechs** Client Tools mit Namen/Parametern nach `API_CONTRACT.md`: `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `confirmLogEntry`, `setProactivity`; **Client**, **Wait for response**; dokumentierte Beispiel- und Fehlerrückgaben.
6. Prompt fordert explizite Eintragsbestätigung; Agent darf **niemals** ohne Bestätigung „gespeichert“ behaupten. Die Entscheidung über Commit ist **ausschließlich** Aufgabe des Browser-Dispatchers.
7. Datenschutzprüfung: Audio Saving AUS; Retention für Audio/Transkript soweit verfügbar 0; aktuelle Konten-Funktionalität und Abrechnungsstatus dokumentieren, keine echte Therapiedatenbasis.
8. `agent/` enthält Dashboard-Schritte und **redigierte** Tool-Schemas/Persona/ggf. Agent-Konfigexport ohne API-Key, reale PIN oder Nutzerdaten. Offline-Konfigtests zuerst; Dashboard-Test optional und als Live-/Kosten-Test gekennzeichnet.

**Abnahme Gate P3:** Sechs Tool-Schemas identisch zum Vertrag; Rollen-/Proaktivitäts-/Bestätigungsprompts vorhanden; private Auth und Dauer-/Retention-Einstellungen durch Dashboard-Notiz bzw. Screenshots ohne Secrets dokumentiert. Das allein **beweist keine** funktionierende WebRTC-Verbindung auf Nokia.

**Übergabe:** `agent/`, `HANDOFF_ELEVENLABS.md`, ID nur als Platzhalter/operative Konfig, getestete bzw. noch ungetestete Funktionen.

## 7. P4 – Integration des Mock-Demonstrators (Chat 04)

**Eingänge:** Frontend-Handoff, Source-Code, freigegebene Verträge. Worker/Agent dürfen während erster Mock-Integration noch ausstehen.

**Arbeit:** Repo aus den drei Branches/Paketen zusammenführen; keine direkte Überschreibung von `docs/`; GitHub-Actions-Build; GitHub-Pages-Deployment unter echtem `/<repo>/`-Pfad; Test am Desktop und anschließend Touch-Prüfung am Nokia ohne Live-Voice. Konfiguration `VOICE_MODE=mock` nur als **öffentliche Build-Option**; keinerlei Secrets.

**Abnahme Mock-Demo:** Kein API-Key/Cloudkonto benötigt. Rolle wechseln, alle Kacheln, Videos/PDFs, Mock-Tool-Aktionen, validierte Einträge mit Touch, Proaktivität, STOPP und Reload demonstrierbar. Mindestens ein vollständiges CI-Ergebnis und ein manueller Browser-Test dokumentiert.

## 8. P5 – Kontrollierte Live-Verbindung (Chat 04 mit Chat 02/03)

**Vorbedingung: Kosten-/Datenschutz-Gate:**

- ElevenLabs-Preise/Freikontingent, Tarif, ggf. automatische Guthabenaufladung und verfügbarer Kostenalarm/-Grenze **im tatsächlichen Konto** verifiziert; maximal 50 CHF Gesamtbudget bis 2026-12-31. Unklare Kosten ⇒ **kein Live-Start**.
- Privater Agent, max. 300 s, Audio-Retention/-Saving und fiktive Daten geprüft.
- Worker Secrets in Cloudflare gesetzt, CORS exakt auf echte GitHub-Pages-Origin, `LIVE_ENABLED` erst für wenige Live-Tests aktivieren, API-Token nur über PIN abrufen.
- Browser erlaubt HTTPS und Mikrofon. Keine echten Patientengespräche/Patientendaten.

**Arbeit:** Privaten WebRTC-Token vom Worker holen; `@elevenlabs/client` anbinden; `clientTools`-Callback-Map prüfen; `dynamicVariables` (Rolle/Proaktivität) prüfen; kurze Testgespräche; neue Provider- oder SDK-Probleme als Change Request an Chat 00, **keine** stillschweigende WebSocket-Ersatzarchitektur.

**Abnahme Live-Integration:** gültige PIN startet echte Sitzung, ungültige PIN nicht; alle sechs Tools; 300-s-Anbietergrenze (kleinere Testdauer nur mit gesonderter Test-Agent-Konfig); `LIVE_ENABLED=false` sperrt **neue** Sitzungen; keine Backend-Logbuchdaten; Kostenstand und Sicherheitsgrenzen dokumentiert.

## 9. P6 – Nokia C22, Bluetooth, finale Demo (Chat 04)

**Explizit auf echter Hardware testen (nicht durch CI ersetzbar):**

| Test-ID | Praktische Prüfung | Abnahmekriterium |
|---|---|---|
| N01 | aktueller Browser/HTTPS/PWA, Touch/Schrift | ohne horizontales Scrollen, Hauptfunktionen bedienbar |
| N02 | Mikrofonfreigabe und WebRTC | natürliches Hin-/Her-Gespräch Hochdeutsch, keine manuelle PTT pro Satz |
| N03 | STUMM bei laufender Agent-Antwort | **beidseitig**: Mikrofon an Agent und KI-Ausgabe lokal stumm; Rückkehr bei AUS |
| N04 | STOPP während Anna spricht und bei Video | Audio/Video **sofort lokal** aus, Ziel < 1 s beobachtbar; keine Reaktivierung durch späte Events |
| N05 | STOPP während Connecting und bei Netzverlust | keine neue Verbindung / späte Medien nach STOPP |
| N06 | COACH AUS und COACH EIN | nur Voice getrennt, UI bleibt, neue PIN/Session erlaubt |
| N07 | sechs Tool-Calls + Touch-Aktionen | gültige Medien-IDs öffnen, ungültige IDs ändern Zustand nicht |
| N08 | vorgeschlagener Logbuch-Eintrag | keine Speicherung ohne explizite Sprachevidenz oder Touch; Reload setzt alles zurück |
| N09 | Patient/in/Angehörige/r und Proaktivität | Rollen unterscheidbar; Nachfragen default AUS, nur bei aktivem Dialog EIN |
| N10 | BT-Tastatur F9 | fokussierte PWA wechselt Coach; keine Zusage bei gesperrtem Bildschirm |
| N11 | Session-Limit / Backend-Abschalter | 300 s Anbieterlimit getestet; Abschalter verhindert neue Tokens, nicht bestehende Session |
| N12 | Datenschutz/Preis | keine echten Daten/Secrets; Kostenverbrauch, Provideraufbewahrung protokolliert |

**Gate C – Hardware-Safety:** N02–N05 müssen praktisch bestanden sein. Falls N03 trotz SDK-Methoden scheitert, **nicht** als gelöst deklarieren: Live-Voice nicht als bestanden abnehmen, Fehlerbericht an Chat 00.

**Gate D – Demonstration:** 3–5-Minuten-Demo gemäß `PROJECT_BRIEF.md` mit fiktivem Stuhl-Aufstehen, Treppen-Info, Video, Rollenwahl, bestätigtem RAM-Eintrag, STOPP, F9 und Reload. Testergebnis mit Gerät-/Browser-/SDK-Version, Datum, Testpersonen ohne persönliche Gesundheitsdaten und Kostenstand festhalten.

## 10. Übergaben, Repo, Entscheidungsregeln

- Projekt-Repo als neue, getrennte Codebasis (nicht das Offline-Whisper-Projekt). Empfohlene Branches: `frontend`, `worker`, `agent`; `main` nur über Integrations-Chat 04. Jeder Chat ändert **nur** sein Verzeichnis; gemeinsame `docs/` bei Chat 00.
- Jeder Chat muss einen `HANDOFF_<BEREICH>.md` liefern: Vertragsversion, Dateiliste, Commit-ID/ZIP-Fassung, dokumentierte Tests **mit realem Resultat**, offene Punkte, benötigte Benutzeraktionen, Sicherheits-/Kostengrenzen.
- GitHub ist maßgeblich für den aktuellen **Code**, ChatGPT-Projektdateien werden **nicht automatisch** synchronisiert. Nach Freigabe neue Architektur-Dateien manuell als Projektquellen ersetzen und im Repo versionieren.
- Vertragsänderung (`POST`-Felder, Tools, Zustände, Fehlertypen, neue ID-Kategorien) ausschließlich per **Change Request → Chat 00 Freigabe → neue Version → Benachrichtigung der betroffenen Chats**.
- Keine Geheimnisse in ChatGPT, Codes, `.md`-Dateien, ZIPs oder Screenshots; nur Secret-Namen und Platzhalter.
- Neue Funktionen (echte Patientenprofile, Cloud-Logbuch, Push, eigene BLE-App, lokale APK) **BACKLOG**, nicht ungeplant zu V1 hinzufügen.

## 11. Offene Entscheidungen und externe Abhängigkeiten (ohne Entwickler-Blockade)

| Thema | Owner | Zeitpunkt | Blockiert |
|---|---|---|---|
| GitHub-Repo/Account und Pages-URL bereitstellen | Auftraggeber / Chat 04 | P4 | Deployment, **nicht** Mock-Entwicklung |
| Cloudflare-Konto/Secrets konfigurieren | Auftraggeber / Chat 02 | P5 | echte Token-Ausgabe, **nicht** Worker-Tests |
| ElevenLabs-Privatagent erstellen und Kosten klären | Auftraggeber / Chat 03 | P5 | Live-Voice, **nicht** Agent-Konfigentwurf |
| Medien fachlich freigeben | Fachverantwortung | vor externen Demoprüfungen | fertige Inhalte, **nicht** fiktives Mock |
| Nokia C22 physisch testen | Auftraggeber / Chat 04 | P6 | Gate C/D, **nicht** parallele Entwicklung |

**Sofortige nächste Aktion:** `ARCHITECTURE.md` und `API_CONTRACT.md` durch v1.0 ersetzen; diesen Plan und `HANDOFF_ARCHITECTURE.md` als Projektquellen hinzufügen; dann Chats **01–03 parallel** nach Handoff starten.
