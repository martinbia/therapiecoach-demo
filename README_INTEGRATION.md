# Anna – integriertes Therapiecoach-Mock-up (Chat 04)

**Stand:** 2026-11-03 · **Vertrag:** `API_CONTRACT.md` v1.0 APPROVED · **Status:** integrierter Quellstand und lokale Tests; GitHub Pages/Cloudflare/WebRTC/Nokia-Freigabe ausstehend.

## Bestandteile

- `web/`: TypeScript/Vite-PWA, Touch-UI, Mock-Adapter, geschützter ElevenLabs-WebRTC-Adapter, PIN-Dialog, sechs Client Tools, Sicherheit und Unit-Tests.
- `worker/`: Cloudflare Workers + SQLite-backed Durable Object, PIN- und Limitprüfungen, nur Token-Ausgabe, 14 Offline-Tests.
- `agent/`: bereits im ElevenLabs-Dashboard eingerichteter privater Agent „Anna“ laut Handoff, Persona und sechs Client-Tool-Fixtures.
- `docs/`: von Chat 00 freigegebene v1.0-Projektunterlagen (unverändert).
- `tests/`: Vorab- und Vertragsprüfung; Nokia-Abnahmematrix.
- `.github/workflows/frontend-pages.yml`: ein kombinierter CI-Workflow für Frontend + Worker + Agent, danach GitHub-Pages-Deployment.
- `integration/`: Patch und konfliktvermeidendes Installationsskript für das *bestehende* GitHub-Repository.

## Zuerst lesen

1. [`DEPLOY_GITHUB.md`](DEPLOY_GITHUB.md): Schrittfolge für das bestehende GitHub-Repository, ohne lokale IDE.
2. [`INSTALL_NOKIA_C22.md`](INSTALL_NOKIA_C22.md): Installation und Hardwaretest auf dem Nokia.
3. [`TEST_REPORT.md`](TEST_REPORT.md): wirklich ausgeführte Tests, Grenzen und offene Geräte-Gates.
4. [`HANDOFF_INTEGRATION.md`](HANDOFF_INTEGRATION.md): Herkunft und Restarbeiten.

## Laufmodi und Sicherheit

`VITE_VOICE_MODE=mock` ist die Standardkonfiguration (kein Cloudkontakt). Eine Live-PWA setzt `VITE_VOICE_MODE=elevenlabs` und die **öffentliche** `VITE_WORKER_BASE_URL` voraus; echte PIN/ElevenLabs-Schlüssel befinden sich **ausschliesslich** in Cloudflare-Secrets. `LIVE_ENABLED=false` muss bis zum geprüften Live-Gate bestehen bleiben.

Die bestätigende Sprachtranskription ist im Live-Adapter **vorsorglich deaktiviert**, weil der dokumentierte ElevenLabs-SDK-Callback `onMessage` auch vorläufige Nutzertranskripte liefern kann. Der Agent kann weiterhin Einträge vorschlagen; nur eine echte Touch-Bestätigung übernimmt sie in den flüchtigen RAM-Zustand. Im Mock sind finale Nutzeraussagen explizit simuliert und testbar.

STOPP invalidiert Voice **vor** der Video-Pause, um eine unbeabsichtigte Audio-Wiederaktivierung durch das Pause-Ereignis zu vermeiden. Der Hardware-Nachweis auf Android Go bleibt offen.

Alle Reha-Angaben sind fiktive Demo-Inhalte. Keine echten Patientendaten. Kein Medizinprodukt. Keine kostenpflichtigen Dienste ohne ausdrückliche Freigabe. Budget maximal 50 CHF externe Dienste bis 31.12.2026.
