# Integrationsüberlagerung – GitHub `main` bleibt maßgeblich

Die Datei `web-fixes.patch` ist aus dem rekonstruierten Frontend-Quellstand erzeugt. Sie ändert ausschließlich:

- `web/src/core/safety.ts` – STOPP invalidiert Voice vor Video-Pause.
- `web/src/voice/elevenlabs.ts` – vorläufige SDK-Transkripte sind kein finaler Bestätigungsbeleg.
- `web/package.json` und `web/tests/voice.test.ts` – zusätzliche Tests.
- `.github/workflows/frontend-pages.yml` – Integrationstests vor dem Pages-Deployment.

Die neuen Dateien `web/tests/access.test.ts`, `web/tests/elevenlabs-adapter.test.ts` und `web/tests/sdk-mock-loader.mjs` werden gesondert hinzugefügt. Der restliche vorhandene `web/`-Stand bleibt unberührt.

**Konflikte sind absichtlich blockierend:** `install_into_repo.sh` prüft `git apply --check` bzw. vorhandene Dateien, bevor es etwas schreibt. Es überschreibt keine unbekannten GitHub-Fassungen.

Nur der **Mock-Modus** wird durch GitHub Pages bereitgestellt. Cloudflare- und ElevenLabs-Livekonfiguration sowie Nokia-Abnahme sind zusätzliche Schritte.
