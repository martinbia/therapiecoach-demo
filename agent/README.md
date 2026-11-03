# agent/ - Anna (Chat 03, Stand 2026-11-03)

**Zur Ablage im GitHub-Repository:** Dieses Verzeichnis direkt als `agent/` in das Repo von Chat 04 uebernehmen. Es ist **kein** installierbares NPM-Paket und kein importierbarer ElevenLabs-Agent. Der reale private Agent **Anna** wurde im ElevenLabs-Konto bereits auf Branch `Main` veroeffentlicht.

## Inhalt

- `PERSONA_ANNA.md`: deutscher Agenten-Systemprompt, First Message, Safety und Testdialoge.
- `AGENT_CONFIGURATION.md`: dokumentierter Anbieter-Istzustand aus Nutzer-Screenshots und offener Soll-/Ist-Abgleich.
- `CLIENT_TOOLS.md`: sechs exakt benannte Client Tools und Validierungsregeln.
- `tool_schemas.json`: projektinterne maschinenlesbare Parameter-Schemas; **nicht** unbesehen ueber ElevenLabs JSON Import einspielen.
- `verify_agent_contract.py`: lokaler Offline-Test, verwendet nur Python-Standardbibliothek.
- `HANDOFF_ELEVENLABS.md`: Pflichtuebergabe an Chat 04, Integrationsreihenfolge und Teststatus.

## Sofort ausfuehren (in der GitHub-Integration, keine Secrets notwendig)

```bash
python3 agent/verify_agent_contract.py
```

Die aktualisierten Dokumente enthalten den **Istzustand vom 2026-11-02**: Agent veroeffentlicht, Free-Konto, sechs Tools sichtbar und deutscher Sprachdialog im ElevenLabs-Dashboard mit Firefox/Windows erfolgreich. Nicht belegt sind echte Toolausfuehrung, Cloudflare-PIN, PWA-WebRTC oder Nokia C22.

## Schnittstelle und Geheimnisse

**Vertrag:** `API_CONTRACT.md v1.0` und `ARCHITECTURE.md v1.0` aus Chat 00, unveraendert.

- Agent ist privat; Cloudflare Worker gibt nach PIN-Pruefung nur `conversationToken` aus.
- `AGENT_ID` **nur als serverseitiger Worker-Konfigurationswert** setzen.
- `ELEVENLABS_API_KEY` und `DEMO_PIN` **nur als Cloudflare Secrets** hinterlegen.
- Keine echten Token, PINs, Schluessel, realen Patientendaten oder Gespraechs-IDs in Repo/Chat.
- `LIVE_ENABLED=false`, bis Chat 04 alle Kosten-/Sicherheits-Gates freigegeben hat.

**Hinweis:** Es existiert noch kein GitHub-Commit aus diesem Chat. Integration und Hardware-Abnahme sind Aufgaben von Chat 04.
