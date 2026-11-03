# AGENT_CONFIGURATION.md - Ist-/Soll-Konfiguration ElevenLabs-Agent Anna

Version: 1.0 (Uebergabe 2026-11-03) | Owner: Chat 03 | Vertrag: **API_CONTRACT.md v1.0 APPROVED**

**Beweisniveau:** Ist-Zustand aus Screenshots und erfolgreichem Benutzertest im ElevenLabs-Dashboard. Keine administrative API-Abfrage, kein vollstaendiger Config-Export, keine End-to-End-PWA-/Cloudflare-Pruefung.

## 1. Aktueller Kontostand und Nutzung

- Plattform: **ElevenAgents**, Konto **Free** laut Screenshot unter Subscription/Profil.
- Workspace Credit Limit: 10'000 Credits. **Vor** dem ersten Sprachtest 0 Credits Verbrauch, 10'000 verbleibend; **nach** dem Sprachtest wurde kein neuer Verbrauchsscreenshot uebergeben. Nicht mehr 0 als aktuellen Verbrauch ausgeben.
- Keine im Chat beauftragte Tarifumstellung oder Zahlung. Das konkrete Vorliegen einer nutzungsbasierten Abrechnung/Auto-Top-up wurde nicht separat per Zahlungsansicht verifiziert.
- Projektbudget aller externen Dienste: max. **50 CHF bis 2026-12-31**; keine bezahlte Freischaltung ohne explizite Zustimmung. Anbieterlimits oder 300 Sekunden pro Sitzung sind kein hartes CHF-Kostenlimit.
- ElevenAgents Free nennt auf der am 2026-11-02 verwendeten Preisseite 15 Gespraechsminuten pro Monat. Vor weiteren Live-Tests Free-Restkontingent und anfallende LLM-/Zusatzkosten im Konto kontrollieren.

## 2. Agent - bestaetigter Dashboard-Stand

| Bereich | Konfiguration | Beleglage |
|---|---|---|
| Agent / Branch | `Anna` / `Main` | Dashboard-Screenshot nach Publish |
| Publish | Erfolgt; Button danach grau | Screenshot; keine neue ausstehende Aenderung sichtbar |
| Typ | ElevenLabs Agents, eine Instanz | Dashboard |
| Standardsprache | `German` | Dashboard |
| Voice | `Sarah - Mature, Reassuring, Confident` | Dashboard; deutsche Sprachausgabe gehoert |
| TTS | `V4 Turbo` in Voice-Einstellungen | Screenshot vor Publikation; im finalen Export noch pruefen |
| LLM | `DeepSeek Flash 4.1` | Dashboard |
| Voice mode | `Custom` | Dashboard |
| `role` | Placeholder `patient`, Text | Vars-Screenshot |
| `proactivity_enabled` | Placeholder `false`, Boolean | Vars-Screenshot |
| First message | `Guten Tag! Ich bin Anna, Ihre digitale Begleiterin. Ich kann Ihnen allgemeine Informationen zur Rehabilitation nach einer Hueftfraktur geben. Wie kann ich Ihnen helfen?` | Im Agenten/Widget sichtbar; in PERSONA_ANNA.md mit Umlauten |
| System prompt | deutsche Persona; `{{role}}`, `{{proactivity_enabled}}` | Ausschnitte der View-Changes-/Agent-Screenshots |
| Authentifizierung | **Enable authentication = ON** | View Changes: Off -> On; Schloss-Symbol in Agent-Ansicht |
| Authz ueber Worker | **noch nicht getestet** | Tokenservice/Integration fehlt |
| Provider-Allowlist | gemaess Architektur nicht zusaetzlich aktivieren | Endzustand nicht gesondert eingesehen |
| Max conversation duration | **300 s** | View Changes: 600 -> 300 (Laufzeitgrenze noch nicht erprobt) |
| Speculative turn | **OFF** | View Changes: On -> Off |
| File input/attachments | **OFF** | View Changes: On -> Off |
| Record voice / Store Call Audio | **OFF** | View Changes: On -> Off |
| Retention days | **0** | View Changes: -1 -> 0; geplante, nicht sofortige Loeschung |
| Delete Audio | **ON** | View Changes: Off -> On |
| Delete Transcript and PII | **ON** | View Changes: Off -> On |
| Zero Retention Mode | **OFF** | Datenschutz-Screenshot; nicht mit Nullspeicherung verwechseln |
| `user_transcript` client event | in der Eventliste sichtbar | Advanced-Screenshot, fuer Logbuch-Gate relevant |
| Tools | sechs benoetigte Client Tools | Tools-Uebersicht nach Publish, jeweils 0 Executions |

Hinweis: Die aktuellen konkreten Provider-Einstellungen bitte bei Chat 04 vor der produktiven Live-Verbindung per redigiertem Dashboard-Screenshot oder Admin-Export gegenpruefen. Die Dokumentation ist **keine** importierbare ElevenLabs-Konfiguration.

## 3. Tools (UI-Tooldefinitionen, Vertrag v1.0)

Exakt `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `confirmLogEntry`, `setProactivity`.

- Tools sind im Dashboard als `Client tool` sichtbar; jedes soll **Wait for response = EIN** haben.
- Parameter werden von ElevenLabs nur vorgeschlagen. Browser-`ActionDispatcher` validiert Typen, ID-Enums und bestaetigte Logbucheintraege nochmals unabhaengig.
- Die technischen Schemas stehen in `tool_schemas.json` und die Erlaeuterungen in `CLIENT_TOOLS.md`.
- Tools wurden am 2026-11-02 **nicht ausgefuehrt**; die Anzeige `Executions = 0` ist keine Funktionspruefung.

## 4. Erster Live-Sprachtest (durch Nutzer am 2026-11-02)

- Testort: ElevenLabs-Dashboard, Widget-Preview in **Firefox unter Windows**. Nicht die GitHub-Pages-PWA.
- Erster Textchat erfolgreich; danach kurzer Sprachdialog. Mikrofonfreigabe erteilt; nach anfaenglicher Fehlbedienung sprachlich erfolgreich.
- Die gesprochene Benutzerfrage wurde sichtbar als Text transkribiert: `Hallo Anna, kannst du mir kurz erklaeren, wobei du mir helfen kannst?`
- Anna hat in Deutsch mit einer passenden allgemeinen Beschreibung des fiktiven Demonstrators geantwortet. Nutzer bestaetigte, sie gehoert zu haben.
- **Bestanden:** Desktop-Mikrofon, deutschsprachige Erkennung und deutschsprachige TTS/Antwort im Dashboard-Widget.
- **Nicht nachgewiesen:** End-to-End-Toolaufruf, Cloudflare-PIN, WebRTC-PWA, Latenz, Schweizerdeutsch, Interruption/STOPP/STUMM, Nokia C22, 300-s-Timeout und finanzielle Ausgaben nach Test.

## 5. Vorgeschriebene PWA-/Worker-Anbindung (noch offen)

1. **Chat 02** konfiguriert den Cloudflare Worker: `DEMO_PIN` und `ELEVENLABS_API_KEY` ausschliesslich als **Cloudflare Secrets**. `AGENT_ID`, `ALLOWED_ORIGIN`, `LIVE_ENABLED` ausschliesslich serverseitig. Den konkreten Agent-ID-Wert **nicht** hier oder in Chatnachrichten dokumentieren.
2. Worker `POST /api/session` mit `{ "pin": "..." }` -> nur `{ "conversationToken": "..." }`. Provideraufruf `GET /v1/convai/conversation/token?agent_id=...` mit `xi-api-key`.
3. **Chat 01/04** verwendet offizielles `@elevenlabs/client`, direkter Browser-WebRTC-Pfad `Conversation.startSession({conversationToken, connectionType:'webrtc', dynamicVariables:{role,proactivity_enabled}, clientTools:{...}})`.
4. Sechs Tools gehen ueber `ActionDispatcher`; auf `ActionResult` warten. `confirmLogEntry({confirmed:true})` nie als Beleg einer bestaetigten Nutzeraktion werten; finale Nutzer-Transkription **nach** Vorschlag oder echter Touch-Klick erforderlich.
5. `LIVE_ENABLED=false` bis Safety-/Kosten-Gate. Limits gemaess Vertrag: 5 Fehl-PIN/IP/15 min, 3 Tokens/IP/15 min, 12 Tokens/UTC-Tag global; Anbieter und Browser je 300 s; kein CHF-Budgetdeckel.
6. Nochmalige Privacy-Kontrolle: 0-Tage-Retention bedeutet geplante Loeschung, **nicht** nachgewiesene Zero-Retention-Garantie.

## 6. Offene Checks fuer Chat 04

- Agent-ID ueber ElevenLabs-UI selbst auslesen und **ausschliesslich serverseitig** setzen, ohne API-Schluessel/PIN in Chat/GitHub hochzuladen.
- Alle sechs Tool-Konfigurationen und Wait-for-response-Einstellungen per exportierter **redigierter** Konfiguration gegen `tool_schemas.json` vergleichen.
- Korrekte Tool-Antworten im echten Browser pruefen; STOPP lokal synchron und STUMM beidseitig mit Firefox und Nokia C22 testen.
- LLM-/Voice-Kosten nach dem ersten Live-Sprachtest im Konto pruefen. Keine automatischen Guthabenkaeufe.

## 7. Offizielle Referenzen (bei der Konzeption geprueft 2026-11-02)

- https://elevenlabs.io/docs/eleven-agents/customization/authentication
- https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
- https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
- https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving
- https://elevenlabs.io/pricing/agents
