# SETUP_CLOUDFLARE – ohne lokale IDE

**Version 1.0 · 02.11.2026.** Die folgenden Schritte führen zunächst zu einem **gesperrten**, ohne echte Zugangsdaten sicher deploybaren Worker. Erst nach separater Freigabe wird die Echtverbindung aktiviert. Für den ersten Deploy sind keine ElevenLabs-Kosten notwendig.

## Phase A – Repository vorbereiten

1. Das ZIP entpacken. Es enthält den Unterordner `worker/` und `HANDOFF_BACKEND.md`.
2. Im **separaten Therapiecoach-GitHub-Repository** die Dateien in `worker/` an denselben Pfad übertragen – idealerweise in den Branch `worker`; nicht das frühere Offline-Whisper-Repository verwenden. GitHub-Web-Upload oder ein Browser-GitHub-Codespace sind möglich. **Nicht** `node_modules/`, `.build/`, `.env`, `.dev.vars` hochladen.
3. Der GitHub-Branch muss `worker/wrangler.jsonc`, `worker/package.json`, `worker/src/` und `worker/test/` enthalten.
4. Optional (Chat 04): `worker/ci/backend-check.yml` nach `/.github/workflows/backend-check.yml` im **Repo-Root** kopieren. Erst dort wird die GitHub-Action aktiv. Sie benötigt **keine GitHub-Secrets** und deployt nicht.
5. Für einen reproduzierbaren Installationsstand in GitHub Codespaces (Browser) im Terminal `cd worker && npm install --no-audit --no-fund && npm run check` ausführen und die dabei erstellte `worker/package-lock.json` committen. Danach kann die CI `npm ci` verwenden. Kein lokales Android-/PC-IDE-Setup notwendig.

## Phase B – Cloudflare-Free-Konto und gesperrten Worker anlegen

1. Cloudflare-Konto unter https://dash.cloudflare.com anlegen bzw. anmelden. **Workers Free** wählen; **keinen** kostenpflichtigen Tarif aktivieren. Unter Abrechnung prüfen, dass keine ungewollten kostenpflichtigen Dienste aktiviert sind.
2. In **Workers & Pages → Create application → GitHub** das Therapiecoach-Repo verbinden (Cloudflare-GitHub-App in Ihrem Konto autorisieren). Projektart **Worker**, nicht Pages, wählen.
3. Repository: `therapiecoach-demo` bzw. Ihr tatsächliches Repo. Production-Branch: vorerst `worker` (nach Integration ggf. `main`); **Root directory: `worker`**.
4. Worker-Name: **`pflegepfad-access-worker`** – muss mit `worker/wrangler.jsonc` übereinstimmen. Wenn Sie einen anderen Namen wünschen, beide Stellen gleich anpassen.
5. Build command: `npm run check`. Deploy command: `npx wrangler deploy`. Die Plattform installiert die npm-Abhängigkeiten für den Build. **Preview-Builds möglichst deaktivieren**, damit keine unbeabsichtigten Test-/Vorschauendpunkte mit Live-Bindings entstehen.
6. **Save and Deploy**. Die `new_sqlite_classes`-Migration aus `wrangler.jsonc` erstellt das SQLite-backed Durable Object; das Binding heisst `ACCESS_LIMITER`. Dafür kein D1/KV/R2 anlegen.
7. Notieren Sie die öffentliche Basis-URL, etwa `https://pflegepfad-access-worker.<ihr-subdomain>.workers.dev`. Diese URL ist **nicht geheim**; sie wird Chat 01 später als `WORKER_BASE_URL` benötigen. Keine PIN an ChatGPT senden.
8. **Wichtig:** Bis zur Konfiguration liefert die API nur Fehler (kein Token), denn `LIVE_ENABLED` ist nicht gesetzt und bedeutet sicherheitshalber `false`.

### Falls die Git-Integration bei Ihnen nicht verfügbar ist

Alternative **ohne lokalen PC-Installationsaufwand**: GitHub Codespaces im Browser starten, `cd worker`, `npm install`, `npm run check`, `npx wrangler login` (Cloudflare-Login nur im Browser autorisieren), `npx wrangler deploy`. Das Deployment erfolgt **mit Ihrem Cloudflare-Konto**, niemals mit hier geteilten Zugangsdaten. Dieser alternative Weg ist vorbereitet, nicht live getestet. **Keine** echte PIN als `.dev.vars` im Codespace speichern.

## Phase C – Cloudflare-Variablen und Secrets im Dashboard setzen

Öffnen Sie **Workers & Pages → pflegepfad-access-worker → Settings → Variables and Secrets → Add**. Der genaue Menütext kann sich leicht ändern. `wrangler.jsonc` enthält `keep_vars=true`, damit Dashboard-Variablen bei späteren Wrangler-Deployments nicht stillschweigend gelöscht werden.

**Plaintext-Variablen** (Typ *Variable* – Konfiguration, keine Zugangsdaten):

| Name | Wert / Eingabe |
|---|---|
| `LIVE_ENABLED` | `false` (zunächst zwingend!) |
| `ALLOWED_ORIGIN` | `https://<github-account>.github.io` – echte HTTPS-Origin **ohne** `/repo/`, ohne abschliessenden Slash |
| `AGENT_ID` | ID des **privaten** ElevenLabs-Agenten aus Chat 03; nur hier eintragen, nicht im Frontend |

**Geheimnisse** (Typ *Secret*; echte Werte ausschliesslich **direkt im Cloudflare-Dashboard** eingeben):

| Name | Wie erzeugen / erhalten |
|---|---|
| `DEMO_PIN` | Zufällige Demo-Passphrase, empfohlen 16–32 Zeichen (API akzeptiert 6–128). Im Passwortmanager erzeugen; keine echten Patientendaten. Die Nutzerin gibt diesen Wert später beim COACH EIN manuell ein. |
| `ELEVENLABS_API_KEY` | Privater ElevenLabs-API-Key mit minimal nötigen Berechtigungen, soweit Kontotarif das ermöglicht. **Nie** im GitHub-Code, ChatGPT, Frontend oder Build-Log. |
| `IP_HASH_KEY` | Unabhängiges, zufällig erzeugtes Secret mit mindestens 32 Zeichen. Nur zur pseudonymisierten IP-Zählung. Im Passwortmanager erzeugen, nicht mit DEMO_PIN identisch. |

Nach dem Eintragen **Deploy** zur Aktivierung der Variablen/Secrets auswählen. Wenn Agent noch nicht existiert, `AGENT_ID` und `ELEVENLABS_API_KEY` **noch nicht** setzen; Worker bleibt trotzdem blockiert. Eine reine Mock-Demo benötigt gar keine Cloudflare-Secrets.

**Nicht zusätzlich nötig:** eigene Datenbank, KV-Namespace, D1, R2, paid Rate Limiting, API-Schlüssel in GitHub Actions. Der einzige SQLite-Speicher befindet sich im Durable Object.

## Phase D – Sichere Vorabprüfung ohne Providerkosten

Solange `LIVE_ENABLED=false` ist, darf `POST /api/session` **niemals 200** liefern. Folgende beiden ungefährlichen Befehle sind optional in GitHub Codespaces oder lokal ausführbar (`<WORKER_URL>` ersetzen, aber **keine PIN** in einen Terminalbefehl schreiben):

```sh
curl -i -X OPTIONS '<WORKER_URL>/api/session' -H 'Origin: https://<github-account>.github.io' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type'
curl -i -X GET '<WORKER_URL>/api/session' -H 'Origin: https://<github-account>.github.io'
```

Erwartung: `204` mit exakt zugelassener Origin (OPTIONS) sowie `405` mit `Allow: POST, OPTIONS` (GET). Test mit falscher Origin muss `403` ohne `Access-Control-Allow-Origin` ergeben. Ein gültiger JSON-POST kann vor Live-Aktivierung `503 SERVICE_UNAVAILABLE` ergeben, auch mit korrekt gesetzter PIN – **kein Provideraufruf**. Für diesen Test **keine echte PIN in Shell-History, URL oder Chat eintragen**. Nach dem freigegebenen Frontend-Deploy den PIN-Dialog der App verwenden.

**Wenn Deploy/DO-Migration fehlschlägt:** Screenshot/Fehlermeldung ohne Secrets sichern, Worker `LIVE_ENABLED=false` belassen. Nicht die DO-Migration entfernen, Zähler lokal speichern oder einen öffentlichen Agenten verwenden.

## Phase E – Erst nach expliziter Kosten-/Sicherheitsfreigabe (Chat 00/04)

1. Bei ElevenLabs im eigenen Account Preis/Tarif/Restkontingent und **Überziehungs-/Auflade-Einstellungen** prüfen; wenn eine wirksame harte Kontobudgetgrenze nicht garantiert wird, Live-Betrieb als finanziell nicht strikt gedeckelt behandeln. **Maximal 50 CHF Projektkosten bis 31.12.2026** ist ein Budgetziel, keine Worker-Garantie. Falls Kosten unklar: **nicht** aktivieren.
2. Agent in ElevenLabs **privat** (`enable_auth=true`) schalten, Gesprächs-Maximaldauer **300 Sekunden**, Audio-Speicherung AUS und Retention soweit verfügbar minimieren; keine echten Patientendaten.
3. Im Cloudflare Worker prüfen: exakte erlaubte Origin, alle drei Secrets, `ACCESS_LIMITER`-Binding, Cloudflare Free und `LIVE_ENABLED=false`.
4. Unter **Settings → Variables and Secrets** die Variable `LIVE_ENABLED` gezielt auf `true` ändern → **Deploy**. Erst jetzt kann eine korrekte PIN ein echtes Provider-Token auslösen.
5. Über die echte GitHub-Pages-App eine **kurze** Testsession ausführen (niemals API-Key in die PWA). Erwartete Fehler-Codes siehe README. Keine automatischen Retry-Schleifen bei `429`.
6. Chat 04 prüft Mikrofon/WebRTC, STUMM, STOPP, 300-s-Agent-Grenze und reale Konto-Kosten; ein erfolgreicher Worker-Test ersetzt keinen Nokia-C22-Test.
7. Sobald der Test beendet ist, `LIVE_ENABLED` zurück auf `false` setzen und **Deploy**. Bestehende ElevenLabs-Sessions laufen dadurch eventuell weiter; bei Notfall zusätzlich den Agenten beim Anbieter deaktivieren/API-Key sperren (bereits ausgegebene Tokens können bis zu deren Ablauf noch nutzbar sein).

## Notfallabschaltung

**Cloudflare → Workers & Pages → Worker → Settings → Variables and Secrets → LIVE_ENABLED = false → Deploy.** Danach darf keine **neue** Berechtigung ausgestellt werden. Im Bedarfsfall ElevenLabs-Agent zusätzlich deaktivieren, Key widerrufen und aktive Gespräche durch Client-STOPP beenden. Eine unmittelbare Abschaltung bereits bestehender WebRTC-Verbindungen kann der Worker technisch nicht garantieren.

## Offizielle Dokumentation (eingesehen 02.11.2026)

- Cloudflare Konto/Repository-Deploy: https://developers.cloudflare.com/workers/ci-cd/builds/
- Root directory und Deploy command: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Cloudflare Secret-Dashboard: https://developers.cloudflare.com/workers/configuration/secrets/
- `keep_vars`: https://developers.cloudflare.com/workers/wrangler/configuration/
- DO SQLite & Migration: https://developers.cloudflare.com/durable-objects/get-started/
- Free-Grenzen/Preise: https://developers.cloudflare.com/durable-objects/platform/pricing/
- ElevenLabs Token: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
