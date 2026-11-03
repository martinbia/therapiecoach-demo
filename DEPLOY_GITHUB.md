# GitHub, Cloudflare und ElevenLabs: Schritt für Schritt

**Stand:** 03.11.2026 · Keine lokale IDE nötig · zuerst Mock-Modus / keine Live-Kosten.

## A. Einmalig: Projekt in bestehendes GitHub-Repository übernehmen

GitHub `main` ist die Quelle für den letzten Code von Chat 01. Das vorliegende `web/` stammt dagegen aus einem **rekonstruierten** Paket ohne bekannte Git-Commit-ID. **Nicht einfach dieses gesamte ZIP über GitHub main kopieren.** Das beiliegende Skript übernimmt neue Bereiche und spielt nur einen geprüften Frontend-Patch ein; bei abweichenden GitHub-Dateien bricht es ohne Überschreiben ab.

1. ZIP `therapiecoach_integriert_2026-11-03.zip` auf den PC herunterladen, noch nicht entpacken.
2. GitHub-Repository öffnen: `https://github.com/martinbia/therapiecoach-demo` → **Code → Codespaces → Create codespace on main**. Prüfen, ob die Codespace-Nutzung in deinem kostenlosen GitHub-Kontingent enthalten ist; **keine zusätzliche kostenpflichtige Nutzung freigeben**.
3. Im Codespaces-Dateiexplorer die ZIP-Datei über **Upload Files…** in das geöffnete Repository hochladen. Am unteren Rand das integrierte **Terminal** öffnen.
4. **Im Terminal im Repository-Hauptverzeichnis** folgende Befehle ausführen (die Dateinamen exakt beibehalten):

```bash
unzip -q therapiecoach_integriert_2026-11-03.zip -d /tmp/anna-integration
bash /tmp/anna-integration/therapiecoach-demo/integration/install_into_repo.sh /tmp/anna-integration/therapiecoach-demo
git status --short
```

   Erwartung: Meldung `OK: Integration ... eingespielt` sowie neue Dateien unter `worker/`, `agent/`, `docs/`, `tests/`, `integration/` und einige kleine Web-Änderungen. **Falls die Prüfung mit `FEHLER` stoppt: nicht erzwingen**; aktuellen GitHub-Code/Fehlertext an Chat 04 melden. Bei abweichendem Frontend könnte der rekonstruierten Patch veraltet sein.

5. Nach positiver Prüfung die ZIP-Datei aus dem Arbeitsverzeichnis entfernen und die Änderungen versionieren:

```bash
rm therapiecoach_integriert_2026-11-03.zip
git add web worker agent docs tests integration .github .gitignore README_INTEGRATION.md DEPLOY_GITHUB.md INSTALL_NOKIA_C22.md TEST_REPORT.md HANDOFF_INTEGRATION.md HANDOFF_BACKEND.md HANDOFF_ELEVENLABS.md
git commit -m "Integriere Anna-PWA, Worker und Agent-Vertrag"
git push
```

   Wenn bereits ein gültiger GitHub-Commit mit diesen Änderungen vorliegt, kann Git `nothing to commit` anzeigen. Den Commit-Hash mit `git rev-parse HEAD` notieren. **Keine Secrets ins Repository oder Terminal schreiben.**

6. Unter `Settings → Secrets and variables → Actions → Variables` für die **Mock-Demo** sicherstellen: `VITE_VOICE_MODE=mock` (oder Variable nicht vorhanden). `VITE_WORKER_BASE_URL` ist im Mock nicht nötig. **Nie** Demo-PIN oder ElevenLabs-API-Key als `VITE_*` hinterlegen.

## B. GitHub Pages aktivieren und Mock-Build prüfen

1. Im selben GitHub-Repository: **Settings → Pages → Build and deployment → Source = GitHub Actions** auswählen. GitHub generiert hier keine Vite-App neu; unser Workflow ist schon vorhanden.
2. **Actions → Frontend CI and GitHub Pages** öffnen. Nach dem Push sollte ein Workflow laufen. Alternativ `Run workflow → main` ausführen.
3. Erst wenn `verify` **und** `deploy` grün sind, die tatsächliche Seite öffnen. Erwarteter Projekt-Link (erst nach erfolgreichem Deploy): `https://martinbia.github.io/therapiecoach-demo/`.
4. Im Web prüfen: Rollenwechsel, Infos/PDF, beide Videos, Logbuch mit Touch-Bestätigung, Proaktivität AUS, Mock-Client-Tools, COACH EIN/AUS, STUMM und STOPP; danach Reload-Rücksetzen.
5. Bei rotem `verify` die **erste konkrete Fehlermeldung** (ohne Secrets) aus GitHub Actions an Chat 04 geben. Bei `deploy` 404 zuerst Pages-Source überprüfen. Nicht den Worker oder das Frontend öffentlich umgehen, um einen Buildfehler zu verstecken.

**Was `verify` prüft:** `npm install`/TypeScript/28 Frontendtests (davon 5 mit isolierter SDK-Simulation)/Vite-Build, Agent-Schemas, Python-Preflight, Worker-Typecheck, 14 Worker-Tests und einen vollständigen Offline-Cross-Component-Test. Die npm-Lockdateien fehlen noch im Paket: in Codespaces später je `cd web && npm install` und `cd worker && npm install` ausführen, die echten `package-lock.json` committen und erst dann im Workflow die Install-Schritte auf `npm ci` ändern. Nicht künstlich erzeugte Lockdateien verwenden.

## C. Cloudflare Worker im Free-Modus bereitstellen – noch gesperrt

**Erst nach funktionierender Mock-PWA.** Cloudflare Workers Free prüfen; keine kostenpflichtigen Produkte aktivieren. Bestehende Anleitung: [`worker/SETUP_CLOUDFLARE.md`](worker/SETUP_CLOUDFLARE.md).

1. Unter `https://dash.cloudflare.com` → Workers & Pages den Worker mit Repository `therapiecoach-demo`, Root `worker`, Name `pflegepfad-access-worker` und Konfigurationsdatei `worker/wrangler.jsonc` anlegen. Falls GitHub-Integration nicht klappt: Codespaces-Terminal `cd worker && npm install && npx wrangler login && npx wrangler deploy` nach ausdrücklicher Freigabe des Zugriffs. Für erste Tests `wrangler deploy --dry-run` verwenden. **Keine Vorschau-Deployments mit Live-Secrets.**
2. Die SQLite-Durable-Object-Migration `new_sqlite_classes: ["AccessLimiter"]` und Binding `ACCESS_LIMITER` müssen bestehen bleiben. Die öffentliche Worker-URL notieren (kein Geheimnis).
3. **Variablen in Cloudflare**: `LIVE_ENABLED=false`, `ALLOWED_ORIGIN=https://martinbia.github.io` (**ohne `/therapiecoach-demo/`**), `AGENT_ID` aus dem bereits existierenden privaten Anna-Agenten.
4. **Nur unter Cloudflare → Settings → Variables and Secrets als Secret**: `DEMO_PIN` (lange zufällige Demo-Passphrase), `ELEVENLABS_API_KEY` (privat), `IP_HASH_KEY` (unabhängig, zufällig, lang). Keine realen Werte in GitHub, ZIP, Chat, Terminalbefehlen, Logs oder Screenshots veröffentlichen.
5. Noch `LIVE_ENABLED=false`: CORS-OPTIONS mit erlaubter Origin → 204, falsche Origin → 403, GET `/api/session` → 405, POST mit korrekter Struktur → 503 (kein Provideraufruf). Wer keine Terminalkenntnisse hat, kann die entsprechenden Browser- und Cloudflare-Testschritte mit Chat 04 gemeinsam ausführen.

## D. Bereits bestehenden ElevenLabs-Agenten prüfen

Laut dem neuesten Handoff aus Chat 03 ist **Anna bereits im ElevenLabs-Dashboard veröffentlicht**, mit privater Authentifizierung, 300-s-Limit und 0-Tage-Retention; ein deutscher Dialog wurde **im Dashboard-Widget** erfolgreich getestet. **Keinen zweiten Agenten anlegen.** Das ist noch kein WebRTC-Test aus der PWA.

1. Im existierenden ElevenLabs-Konto Agent **Anna / Main** öffnen. `enable_auth=true`, 300 s Dauer, die sechs Client Tools (alle `Client`, `Wait for response`), dynamische Variablen `role` und `proactivity_enabled`, Audiorecording AUS und tatsächliche Retention kontrollieren.
2. **Prompt-Abgleich:** Die Datei `agent/PERSONA_ANNA.md` enthält einen Integrationszusatz: Im Live-Betrieb soll Anna nach jedem Logbuchvorschlag zur **Touch-Bestätigung** auffordern. Dieser Zusatz wird **nicht automatisch** in das Dashboard übernommen. Bei der Konfigurationsprüfung entsprechend aktualisieren.
3. Vor dem ersten PWA-Live-Test den aktuellen Kontotarif, verbleibende Credits **nach** dem bereits absolvierten Dashboard-Test, automatische Nachzahlung/Top-up, LLM-Zusatzkosten und mögliche Budgetgrenzen prüfen. Gesamtbudget bis 31.12.2026: höchstens **50 CHF**. Keine bezahlte Funktion ohne Zustimmung.

## E. Erst nach Sicherheits-/Kostenfreigabe: echter Dialog

1. In GitHub Actions Repository-**Variables**: `VITE_VOICE_MODE=elevenlabs` und `VITE_WORKER_BASE_URL=https://<die-echte-Worker-URL-ohne-/api/session>` eintragen; keine Secrets als Variable anlegen. Danach Pages-Workflow auf `main` erneut starten (Vite-Konfigurationswerte sind Build-Zeit-Werte).
2. Prüfen, dass Cloudflare-Origin/DO/Secrets stimmen. Danach `LIVE_ENABLED=true` **bewusst** für einen kurzen, genehmigten Test setzen und Worker neu deployen.
3. In der PWA Rolle wählen → COACH EIN → PIN interaktiv eingeben → Mikrofon erlauben → Hochdeutsch testen. Keine PIN in den Chat kopieren. Die echten sechs Tools über kurze Demo-Kommandos testen. Bestätigung im Live-Modus nur per Touch.
4. STUMM, STOPP während Anna spricht/Video, Netzunterbruch und F9 physisch am Nokia prüfen. Die tatsächliche WebRTC-/Android-Funktion ist vorher **nicht freigegeben**.
5. Nach dem Test `LIVE_ENABLED=false` und Provider-Kostenverbrauch prüfen. Diese Sperre blockiert **neue Tokens**, nicht bereits laufende Gespräche. Budget- und Hardware-Ergebnisse in `TEST_REPORT.md` nachtragen.

**Falls etwas fehlschlägt:** Kein öffentlicher ElevenLabs-Fallback, kein Abschalten des Origin-/PIN-Schutzes und kein Umstellen auf WebSockets ohne Chat 00. Screenshots ausschliesslich ohne Geheimnisse teilen.
