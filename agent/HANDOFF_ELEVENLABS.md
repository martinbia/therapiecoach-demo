# HANDOFF_ELEVENLABS.md - Chat 03 -> Chat 04

**Paket:** `agent_handoff_2026-11-03_v1.zip` | **Stand:** 2026-11-03 | **Owner:** Chat 03 | **Vertrag:** `API_CONTRACT.md v1.0` / `ARCHITECTURE.md v1.0` (**APPROVED**)

## 1. Erledigt / Ist-Zustand

- ElevenLabs-Agent **Anna** ist im Branch `Main` **veroeffentlicht**. Kein erneutes Anlegen erforderlich.
- Free-Konto aus Screenshots bestaetigt. Vor dem Sprachtest: 10'000 Credits verfuegbar, 0 verbraucht. **Nach** dem kurzen Live-Sprachtest ist der Credit-Reststand nicht erneut verifiziert. Kein kostenpflichtiger Tarif durch Chat 03 aktiviert.
- Deutsch als Standardsprache; Stimme **Sarah**; LLM **DeepSeek Flash 4.1**; Custom Voice mode. First Message und System-Prompt fuer patient/caregiver und proactivity_enabled sichtbar konfiguriert.
- Agent-Authentifizierung **ON**, 300 s Limit, Store Call Audio **OFF**, Retention **0 Tage** (zeitversetzte Loeschung), Delete Audio **ON**, Delete Transcript/PII **ON**. Provider-Zero-Retention-Mode **OFF**.
- Genau sechs Tools im Dashboard als **Client tool** sichtbar: `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `confirmLogEntry`, `setProactivity`; Nutzerdialoge zu Pflichtparametern/Enums abgeschlossen. Keine Tool-Ausfuehrungen (jeweils 0 laut Screenshot).
- **Live im Dashboard getestet:** Mikrofon via Firefox/Windows, deutsche Spracherkennung (Frage transkribiert), Anna antwortete hoerbar auf Hochdeutsch. **Nicht** PWA/WebRTC/Worker getestet.

## 2. Dateien im ZIP

| Datei | Inhalt / Zweck |
| --- | --- |
| `agent/README.md` | Uebergabeanleitung an Chat 04, Ordnerstruktur |
| `agent/PERSONA_ANNA.md` | System-Prompt-Referenz und First Message; keine Provider-Importdatei |
| `agent/AGENT_CONFIGURATION.md` | Screenshots-basierter Ist-/Soll-Stand und verbleibende Checks |
| `agent/CLIENT_TOOLS.md` | Exakt sechs Tools, Parameter, Bestätigungssicherheit und Fehlerregeln |
| `agent/tool_schemas.json` | Maschinenlesbare **projektinterne** JSON-Schema-Fixtures; kein ElevenLabs-Agentimport |
| `agent/verify_agent_contract.py` | Offline-Schema-/Payload-Tests gegen v1.0-Toolnamen; kein Provider-Aufruf |
| `agent/HANDOFF_ELEVENLABS.md` | Diese Uebergabe |

**Repo-Status:** Kein GitHub-Commit durch Chat 03. Chat 04 entpackt/uebernimmt ausschliesslich das Verzeichnis `agent/` in das gemeinsame Repo und dokumentiert den eigenen Commit. `docs/` **nicht** eigenmaechtig aendern.

## 3. Verbindliche technische Schnittstelle

1. **Auth:** Agent privat (`enable_auth=true`); kein unauthorisierter Public-Agent-Fallback und keine kombinierte Provider-Allowlist. `AGENT_ID` bleibt serverseitig in Cloudflare-Konfiguration; `ELEVENLABS_API_KEY` und `DEMO_PIN` sind Cloudflare Secrets, niemals GitHub/Chat.
2. **Worker**: `POST /api/session`, Body `{ "pin": "..." }`, Success `{ "conversationToken": "..." }`; Provider-Token `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...`, Header `xi-api-key` nur serverseitig.
3. **PWA**: `@elevenlabs/client`, `connectionType:'webrtc'`, `dynamicVariables: {role:'patient'|'caregiver', proactivity_enabled:boolean}`; Token ausschliesslich vom Worker.
4. **Toolnamen exakt:** `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `confirmLogEntry`, `setProactivity`. Payloads und ActionResult genau in `CLIENT_TOOLS.md` / `tool_schemas.json`; **Wait for response** bei allen sechs.
5. **Logbuch:** Vorschlag durch `proposeLogEntry`; `confirmLogEntry` darf ohne separate finale spaetere eindeutige Nutzertranskription (max. 30 s) **keinen** Eintrag speichern. Bei unzureichendem Transcript **Touch-Fallback**. Browser `ActionDispatcher` entscheidet, nicht Agent.
6. **Sicherheit:** COACH EIN/AUS, STUMM, STOPP und F9 sind alleinige lokale PWA-Aktionen. STOPP wirkt synchron lokal vor `await`, stoppt Medien, invalidiert Generation, keine Wiederverbindung.
7. **Budget:** Gesamt < = 50 CHF bis 2026-12-31; `LIVE_ENABLED=false` bis Freigabe; Worker-Sperren 5 Fehl-PIN/IP/15 min, 3 Token/IP/15 min, 12 global/UTC-Tag; Agent und Client 300 s. Keine dieser Grenzen ist fuer sich eine harte CHF-Sperre.

## 4. Teststatus (ehrliche Abnahmegrenzen)

| Test | Status |
| --- | --- |
| Tool-Schemas gegen API-Vertrag v1.0 (offline) | Skript wird in Paket ausgefuehrt; Resultat siehe Testkommando |
| Agent vorhanden, publiziert, Auth ON, Privacy/300 s konfiguriert | **Per Nutzer-Screenshots bestaetigt** |
| Free-Konto und vor-Test-Credit-Kontingent | **Per Screenshot bestaetigt**; Nach-Test-Stand offen |
| Echte deutschsprachige Eingabe/Ausgabe in ElevenLabs-Widget | **Bestanden** (Nutzerbericht + Screenshot), Firefox/Windows |
| Einzelne Tool-Parameter vollstaendig gegen Provider-Export geprueft | **Offen**; manuell angelegt, kein Export |
| PWA + Cloudflare Worker + WebRTC | **Offen** |
| PIN-/Origin-/DO-Rate-Limit / sichere Token-Ausgabe | **Offen**, Chat 02/04 |
| Alle sechs echten PWA Client Tools / Bestaetigungs-Gate | **Offen**, Chat 04 |
| Nokia C22 Audio/Video/Mute/STOPP/F9/Netzunterbruch | **Offen**, Chat 04 |
| Schweizerdeutsch, 300-s-Laufzeitgrenze | **Offen** |
| Kosten nach erstem Sprachtest | **Offen** |

## 5. Naechste Schritte fuer Chat 04 (Reihenfolge)

1. ZIP nach Repo-Root entpacken und `agent/` einchecken. `python3 agent/verify_agent_contract.py` ausfuehren und Resultat speichern; ggf. fehlende gemeinsame `API_CONTRACT.md` v1.0 unter `docs/` beruecksichtigen.
2. Handoffs von Chat 01 (`web/`) und Chat 02 (`worker/`) ebenfalls uebernehmen; CI/Mock-Gate vor Live-Gate.
3. In ElevenLabs **bestehende** Anna/`Main` verwenden. Admin-/Tool-/Auth-Einstellungen mit redigierten Screenshots oder Export bestaetigen, keine erneute Agent-Kreation. Agent-ID nicht in dieser Datei ablegen; in Worker-Serverkonfiguration eintragen.
4. Worker mit Fake-Provider, PIN- und Limits testen; danach privat ausgestellten WebRTC-Token ueber den Worker an das Frontend geben. Vorher aktuelle Kontokosten und Restkontingent pruefen.
5. Kurzer PWA-Sprachtest, sechs Tools/Negative-Cases, Schutz bei Logbucheintraegen, proactivity default false. Danach Nokia C22 und Bluetooth-F9. Keine echte Patientendaten oder klinische Uebungsanweisungen.

## 6. Risiken und offene Verbesserungen

- `Take turn after silence` war im Dashboard zeitweise **7 s**; darf bei proactivity_enabled=false keine unerwuenschten Uebungsnachfragen ausloesen. Bei Bedarf Chat 00 fuer einen vertragskritischen Change Request informieren.
- `user_transcript` war als Client Event sichtbar; **finale**, nach Vorschlag eingegangene Nutzertranskription und die SDK-Semantik sind noch nicht nachgewiesen. Im Zweifel ausschliesslich Touch zum Commit.
- Zero-Retention-Mode AUS, `Retention=0` bedeutet verzoegerte Loeschung und ersetzt keine Garantie sofortiger Nullspeicherung. Nur fiktive Daten.
- Dashboard-Preview funktioniert trotz privater Agent-Auth; das beweist nicht, dass ein unberechtigter externer Client abgewiesen wird. Token-/CORS-/Origin-Gate separat pruefen.
- Nicht ohne neue Freigabe Plan wechseln, Bezahlfunktionen aktivieren oder `API_CONTRACT.md` abwandeln.
