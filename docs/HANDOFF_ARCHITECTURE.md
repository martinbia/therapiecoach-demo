# Architektur-Handoff für Chats 01, 02, 03 und 04

**Version:** 1.0 · **2026-11-02**  
**Status:** **APPROVED – Startfreigabe für parallele Entwicklung.**  
**Freigabe durch:** Chat 00 (Architektur/Vertrag); **kein** Live-/Nokia-Abnahmebericht.

## 1. Unmittelbar verbindlich

**Vor jeder Implementierung** lesen: `PROJECT_BRIEF.md` v0.7, `PROJECT_RULES.md`, `IMPLEMENTATION_PROCESS.md`, **`ARCHITECTURE.md` v1.0**, **`API_CONTRACT.md` v1.0**, `IMPLEMENTATION_PLAN.md` v1.0. Falls eine Datei im ChatGPT-Projekt fehlt, nachfragen oder offen als fehlend markieren; nicht aus dem Gedächtnis nachbauen.

**Technik ist festgelegt:**

- Browser: **GitHub Pages** (HTTPS), **Vite + TypeScript**, Vanilla DOM/CSS, PWA mobile-first, Nokia C22 (Android 13 Go), später Tablet.
- Voice: **`@elevenlabs/client`**, privater Agent „Anna“, **WebRTC über `conversationToken`**; direkter Medienpfad Browser ↔ ElevenLabs, Worker nur Token-Service.
- Worker: **Cloudflare Workers** + **eine SQLite-backed Durable-Object-Instanz** für zentrale atomare PIN-/Token-Zähler; `LIVE_ENABLED=false` bis zur Live-Freigabe.
- Zustand: `VoiceState.phase = off|connecting|active|stopping|error`, zusätzlich `userMuted` / `effectiveMuted`; **STUMM** beidseitig, **STOPP** synchron lokal auch bei Netzwerkfehlern.
- Inhalte: fiktiv, RAM-only-Logbuch ohne `localStorage`/Cloudpersistenz; Proaktivität AUS per Default, Patient/in und Angehörige/r.
- Kosten: Dienstkosten zusammen höchstens **50 CHF bis 2026-12-31**, zahlungspflichtige Funktionen nur nach Freigabe.

## 2. Gemeinsamer Integrationsvertrag – Kurzfassung

### HTTP

```text
POST {WORKER_BASE_URL}/api/session
Origin: https://<account>.github.io
Content-Type: application/json
BODY:    { "pin": "<Demo-PIN>" }
SUCCESS: 200 { "conversationToken": "<WebRTC-Token>" }
ERROR:   { "error": "<CODE>", "message": "<Text>" }
```

Fehlercodes: `BAD_REQUEST` (400), `ACCESS_DENIED` (401), `ORIGIN_FORBIDDEN` (403), `METHOD_NOT_ALLOWED` (405), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `UPSTREAM_FAILURE` (502), `SERVICE_UNAVAILABLE` (503). Keine Secrets im Browser. Worker-Aufruf gegen ElevenLabs: `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=<AGENT_ID>` mit Header `xi-api-key` aus Secret; nur `token` in `conversationToken` überführen.

### Sechs Client Tools (case-sensitive, Agent-Dashboard „Client“, Wait for response)

| Name | Payload | Effekt |
|---|---|---|
| `openInfo` | `{"topicId":"stairs"}` | erlaubtes Info-Thema öffnen |
| `openVideo` | `{"videoId":"stairs_demo"}` | erlaubtes Video anzeigen |
| `openLogbook` | `{}` | RAM-Logbuch anzeigen |
| `proposeLogEntry` | `{"exerciseId":"chair_rise","when":"heute Morgen","comment":"gut"}` | **nur** Bestätigungsvorschau |
| `confirmLogEntry` | `{"confirmed":true}` | nur mit separater positiver Nutzerbestätigung, sonst Touch-Fallback |
| `setProactivity` | `{"enabled":true}` | proaktive Nachfragen setzen |

Mindest-IDs: Info `stairs`, `chair_rise`; Videos `stairs_demo`, `chair_rise_demo`; Übungen `stairs`, `chair_rise`. Weitere IDs sind vorerst **nicht** freigegeben. Alle Tool-Aufrufe gehen über `ActionDispatcher`, nie direkt auf ungeprüfte URLs oder DOM-HTML.

### Safety, gemeinsames Verhalten

| Aktion | Ergebnis |
|---|---|
| COACH EIN | bewusster Touch/F9 → PIN-Dialog → Token → WebRTC; nie automatisch nach Reload |
| COACH AUS | nur Voice-Session beenden; UI/Video darf weiterlaufen |
| STUMM | `conversation.setMicMuted(true)` **und** `conversation.setVolume({volume:0})`; bei unvollständiger Wirkung Voice abbrechen |
| STOPP | **vor Await** KI-Audio/Medien lokal stoppen, alte Generation sperren, anschließend SDK `endSession`, keine automatische Wiederverbindung; unbestätigten Logbucheintrag verwerfen |
| F9 | `keydown`, `event.code==='F9'`, `!event.repeat`, keine Text-/PIN-Eingabe im Fokus; nur fokussierte PWA |
| Dauer | 300 s am Agent plus 300 s im Client, keine Garantie einer CHF-Kostensperre |

## 3. Chat 01 – Startauftrag Frontend (`web/`)

**Auftrag:** Vollständige minimalistische PWA **zuerst im Mock-Modus** erstellen, mit `VoiceService`, `MockVoiceAdapter`, `ActionDispatcher`, fiktiven Inhalten und korrekter Safety-Steuerung. SDK-Adapter separat halten; PIN-Dialog und TokenProvider vorsehen, aber keine Secrets im Frontend. Layout Nokia-first und Tablet-responsiv. GitHub-Pages-`base`, PWA-Manifest und CI beachten.

**Im ersten Lauf ohne externe Dienste nachweisen:** Rolle Patient/in/Angehörige/r, Infos, Videos, PDFs, RAM-Logbuch, explizite Touch-Bestätigung, Default-Proaktivität AUS, sechs simulierte Client Tools, F9, STUMM, COACH EIN/AUS, STOPP bei verzögertem Mock und spätem Tool-Event, Reload-Reset. Tool-Schemas und `VoiceState` exakt aus `API_CONTRACT.md`.

**Nicht tun:** Worker implementieren, reale Secrets anfordern/einbauen, neue Client Tools erfinden, Live-Berechtigung umgehen, fiktive Daten dauerhaft speichern.

**Abgabe:** `web/`, `HANDOFF_FRONTEND.md`, CI-/Build-Ergebnisse, Liste der offenen echten Smartphone-Prüfungen. **Start: sofort.**

## 4. Chat 02 – Startauftrag Cloudflare (`worker/`)

**Auftrag:** `POST /api/session` v1.0 bauen; **Cloudflare Durable Object mit SQLite-Storage** für global konsistente Sperr- und Token-Zähler. Defaultlimits 5 Fehl-PIN/IP/15 min, 3 Token/IP/15 min und 12/UTC-Tag global; Token vor Providerkontakt reservieren. `DEMO_PIN`, `ELEVENLABS_API_KEY` ausschließlich Cloudflare Secrets; `AGENT_ID`, `ALLOWED_ORIGIN`, `LIVE_ENABLED` serverseitig. CORS korrekt, keine öffentliche Mock-Token-Ausgabe.

**Zuerst testen:** Fake-Providerantwort `{token:"fake"}`, Origin-/Methoden-/Body-Validierung, Fehl-PIN, Concurrent-Limits, Ausfall DO/Secrets, Provider-Fehler. Keine echten Anbieterkosten nötig. Schritt-für-Schritt-Deploy/Secret-Anleitung ohne lokale IDE mitliefern.

**Nicht tun:** WebRTC-Audio relayen, UI-Logbuch speichern, vollständige Benutzerverwaltung aufbauen, kostenpflichtigen Plan ohne Freigabe aktivieren.

**Abgabe:** `worker/`, `HANDOFF_BACKEND.md`, Test-/Deploy-Protokoll. **Start: sofort.**

## 5. Chat 03 – Startauftrag ElevenLabs (`agent/`)

**Auftrag:** Eine private deutschsprachige Persona „Anna“, zweifach per `role` (`patient`/`caregiver`) angepasst, `proactivity_enabled=false` standardmäßig, sechs Client Tools exakt gemäß Vertrag, Agent-Laufzeit max. 300 s. `enable_auth=true`; für V1 **keine kombinierte Provider-Allowlist**. Nur fiktive Inhalte, keine individuellen medizinischen Anweisungen; Audiorecording und Retention minimieren. `Wait for response` für die Tools. Prompt stellt bei Logbucheinträgen eine explizite Bestätigungsfrage und respektiert fehlgeschlagene Client-Tools.

**Zuerst testen:** Agent-Konfig und Tool-Parameter gegen Vertrag prüfen; Testdialoge und Grenzen simulieren. Echte Gesprächstests erst, wenn Konto und Kostenstatus geklärt sind. Dashboard-Konfigurationsschritte dokumentieren, keine API-Keys oder PINs in Dateien oder Chat.

**Nicht tun:** eigene UI-Aktionen hinzufügen, Logbucheintrag ungeprüft „speichern“, Agent öffentlich machen, bezahlte Pakete ohne Freigabe aktivieren.

**Abgabe:** `agent/`, `HANDOFF_ELEVENLABS.md`, konfigurierbare Tool-Definitionen und Tests. **Start: sofort.**

## 6. Chat 04 – Integration **erst nach Übergaben**

1. `web/` aus Chat 01 im Mock-Modus via GitHub Pages bauen/deployen und prüfen.
2. `worker/` aus Chat 02 getrennt deployen; PIN, CORS, DO, Secrets, Rate-Limits mit kontrollierten Tests überprüfen.
3. `agent/` aus Chat 03 im ElevenLabs-Konto privat und mit 300 s max. konfigurieren; Kosten/Retention prüfen.
4. Adapter auf echte Worker-URL schalten, kurze Live-WebRTC-Session, sechs Tools, STUMM, STOPP und Abschluss prüfen.
5. Nokia C22: Mic/WebRTC, Audio beidseitig STUMM, STOPP während Sprache/Medien/Connecting und bei Netzunterbruch, F9 via BT-Tastatur. Hardwaretests und Kostenstatus in Testbericht dokumentieren.

**Kein Handoff ist ein automatischer Merge.** Jeder Bereich liefert konkreten Commit/Dateistand und Tests. Gemeinsame Docs nur Chat 00 ändern.

## 7. GitHub und Dateiorganisation

```text
therapiecoach-demo/
  web/      # 01
  worker/   # 02
  agent/    # 03
  docs/     # 00: ARCHITECTURE.md, API_CONTRACT.md,
            #     IMPLEMENTATION_PLAN.md, HANDOFF_ARCHITECTURE.md
  tests/    # 04 bzw. gemeinsamer Testplan
  README.md
```

Für unabhängige Arbeit Branches `frontend`, `worker`, `agent` oder klar getrennte ZIPs. GitHub ist Quelle des aktuellen Codes; ChatGPT-Projektdateien müssen nach Änderungen **bewusst** ersetzt werden. Handoffs müssen `API_CONTRACT.md v1.0` angeben.

## 8. Pflichten in jedem Handoff

Jeder Bereich berichtet: **(a)** Vertragsversion **(b)** Dateiliste und Commit/ZIP-Version **(c)** tatsächlich ausgeführte Befehle/Tests mit Resultat **(d)** noch nicht getestete Teile **(e)** bekannte Fehler/Sicherheitsgrenzen **(f)** notwendige Aktionen des Auftraggebers **(g)** Integrationshinweise. Keine Behauptung „Nokia geprüft“, bevor ein realer Nokia-Test durchgeführt wurde.

## 9. Sofortiger Änderungsprozess

**Blockierender Konflikt?** Kleinste kompatible Lösung lokal vorschlagen, Änderung **nicht** stillschweigend durchführen. Einen kompakten **CHANGE_REQUEST** an Chat 00 mit Problem, Fundstelle, altem/neuem Vertrag, Kompatibilität, benötigten Tests übergeben. Chat 00 entscheidet, versioniert, informiert alle betroffenen Chats. Nicht vertragskritische Implementierungsdetails (CSS, Komponentenstruktur, Testframework) bestimmt der jeweilige Chat autonom.

## 10. Explizit offene Live-Risiken

- WebRTC, Audio- und Mic-Mute auf Android 13 Go sind **noch nicht auf echter Hardware getestet**.
- Benutzer-Transkript-Ereignisse können SDK-/Agent-Konfig erfordern: sprachliches `confirmLogEntry` nur bei finaler eindeutiger Nutzerbestätigung, ansonsten Touch-Bestätigung.
- Autoplay kann blockiert sein; Video zeigt immer einen Play-Button.
- `LIVE_ENABLED=false` stoppt **keine laufenden** Provider-Sitzungen; lokaler Abbruch plus Agent-Max-Limit erforderlich.
- Cloudflare/ElevenLabs Free-Kontingent, Preise und Speicherbedingungen sind vor Live-Betrieb **im jeweiligen Konto** zu bestätigen.

**Freigabe:** **Chats 01, 02, 03 dürfen nach Hochladen der freigegebenen Quellen parallel beginnen.** Chat 04 integriert deren Ergebnisse später; echter Live-/Nokia-Betrieb erfordert zusätzliche Gates aus `IMPLEMENTATION_PLAN.md`.
