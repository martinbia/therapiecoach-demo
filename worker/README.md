# Cloudflare-Backend – KI-Therapiecoach, Vertrag v1.0

**Stand: 02.11.2026** · Owner Chat 02 · zunächst nur Mock-getestet. **Kein öffentlicher Fake-Token-Dienst.**

## Zweck

`POST /api/session` nimmt genau `{"pin":"..."}` entgegen und antwortet nur bei erfolgreicher serverseitiger PIN-Prüfung mit `{"conversationToken":"..."}`. Der Token stammt von `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...` (Authentifizierung über `xi-api-key`). Es gibt keinen Audio-Relay, keinen Admin-Endpunkt, keine Nutzerkonten und keine Speicherung von Gesprächsinhalten. Der Agent **muss** separat privat konfiguriert sein.

**Vor Live-Betrieb:** `SETUP_CLOUDFLARE.md`, `SECURITY_CHECKLIST.md`, `TEST_RESULTS.md` lesen. Die Nutzungsgrenzen verhindern keine garantiert maximale CHF-Rechnung. Standard: `LIVE_ENABLED` fehlt oder `false` → keine Token-Ausgabe.

## Verzeichnis

```text
worker/
  src/
    index.ts             Cloudflare Worker + Durable Object (RPC)
    session.ts           HTTP, PIN/HMAC, CORS, Provider-Timeout
    limiter-store.ts     atomare SQLite-Zähler und Ablauf
    types.ts             serverseitige Typen, Limits
    cloudflare-shim.d.ts minimale TS-Definition des Cloudflare-Runtime-Moduls
  test/session.test.mjs  14 unabhängige Tests (Node SQLite / Fake-Provider)
  ci/backend-check.yml   Vorlage: durch Chat 04 nach .github/workflows kopieren
  wrangler.jsonc         SQLite-Migration, Binding, keep_vars, Logging AUS
  tsconfig.json
  package.json
  .gitignore
  SETUP_CLOUDFLARE.md
  SECURITY_CHECKLIST.md
  TEST_RESULTS.md
```

Die Runtime benötigt **keine npm-Bibliothek**; TypeScript und Wrangler sind ausschliesslich Entwicklungswerkzeuge. `npm install` wird später in GitHub Codespaces oder Cloudflare Builds ausgeführt. **Nicht** `node_modules`, `.dev.vars` oder `.env` hochladen. Keinerlei echte PIN oder API-Keys in Konfigurationsdateien eintragen.

## Lokal/Codespaces oder Cloudflare Builds

```sh
cd worker
npm install --no-audit --no-fund
npm run check
npm run deploy:dry
```

`npm run check` führt TypeScript-Check und Node-Tests aus. Die Node-Tests prüfen den echten TypeScript-HTTP-Handler und die echte SQLite-SQL-Logik mit einer In-Memory-SQLite-Implementierung (Node 22); nur die Cloudflare-DO-RPC/Alarm-Laufzeit wird simuliert. **Das ist kein Beleg eines echten Cloudflare-Deployments.** `npm install` erzeugt `package-lock.json`, das nach erfolgreicher Installation für reproduzierbare CI-Läufe ins Repository committed werden sollte; ab dann in der CI `npm ci` einsetzen.

## Öffentliches HTTP-API v1.0

- Methode: **nur** `POST /api/session` mit exaktem `Origin`, `Content-Type: application/json`, gültigem JSON-Objekt mit einzigem Feld `pin` (6–128 UTF-16-Codeeinheiten), maximal **1024 Byte**.
- 200: `{"conversationToken":"<fluechtiges-Provider-Token>"}`.
- Fehler: `{"error":"<CODE>","message":"<neutraler-Text>"}`.
- Statuscodes: 400 `BAD_REQUEST`, 401 `ACCESS_DENIED`, 403 `ORIGIN_FORBIDDEN`, 405 `METHOD_NOT_ALLOWED`, 413 `PAYLOAD_TOO_LARGE`, 429 `RATE_LIMITED`, 502 `UPSTREAM_FAILURE`, 503 `SERVICE_UNAVAILABLE`.
- `OPTIONS /api/session`: 204, CORS ausschliesslich für exakten `ALLOWED_ORIGIN`. Keine Cookies und kein `Access-Control-Allow-Credentials`; alle Antworten `Cache-Control: no-store`, `Vary: Origin`, `Referrer-Policy: no-referrer`.
- Der Browser darf die PIN nur für einen bewussten Start abfragen und nicht in Web Storage ablegen.

## Limits, Sicherheit und Ablauf

- **5** fehlgeschlagene PIN-Versuche je pseudonymisierter Cloudflare-Quell-IP / rollierende 15 min (danach 429, auch mit richtiger PIN).
- **3** gültige Token-Reservierungen je Quell-IP / rollierende 15 min.
- **12** gültige Token-Reservierungen **global** / UTC-Tag.
- Ein einziger Durable Object mit `idFromName('demo-global')`, SQLite-`transactionSync` für Limitprüfung und Einfügen. **Provider-Aufruf immer erst nach Reservierung.** Provider-Fehler verbrauchen den Slot.
- Speicherung: nur HMAC-SHA256(IP, `IP_HASH_KEY`), Art (`failure` / `token`), Zeitpunkt, UTC-Tag. Niemals IP-Klartext, PIN, Token, Audiotext.
- Beim nächsten Reservierungsversuch werden Einträge älter als 48 h entfernt. Zusätzlich läuft ein **best-effort Durable-Object-Alarm** ca. 48 h + 2 min nach der letzten Reservierung, um auch in Ruhephasen aufzuräumen. Alarm-/Provider-Ausfälle können die Löschung verzögern; die Plattform bietet unabhängig eine Point-in-Time-Recovery-Historie.
- Die Limits können in Cloudflare durch **optionale** Variablen `MAX_FAILED_PER_IP`, `MAX_TOKENS_PER_IP`, `MAX_TOKENS_PER_DAY` **nur verschärft** werden. Werte über 5/3/12 oder fehlerhafte Werte sperren den Dienst (503). Die Standardwerte gelten ohne Variablen.
- Kein Logging im Code; `observability.enabled=false`. Cloudflare/ElevenLabs können eigene Plattformmetadaten verarbeiten.

## Offline-/Live-Grenze

`MockVoiceAdapter` des Frontends gehört zu Chat 01 und benötigt **keinen** Token. `Fake-Provider` ist nur in `test/` enthalten. Es existiert keine öffentliche Route zum Testtoken. Ein Live-Test ist erst nach Gate B/Kostenfreigabe von Chat 00/04 vorgesehen. Live-Sitzung und Nokia C22 **nicht getestet**.

## Verifizierte offizielle Referenzen am 02.11.2026

- https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
- https://elevenlabs.io/docs/eleven-agents/customization/authentication
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/
