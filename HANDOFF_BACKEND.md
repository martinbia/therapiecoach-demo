# HANDOFF_BACKEND – Chat 02 → Chat 04 / Chat 00

**Backend-Version:** `worker-v1.0.0` · **Datum:** 02.11.2026  
**Verbindlicher API-Vertrag:** `API_CONTRACT.md` **v1.0 APPROVED**  
**Architektur:** `ARCHITECTURE.md` **v1.0 APPROVED**  
**Status:** **Implementiert + offline getestet**, Cloudflare-Deployment und ElevenLabs-Livezugang noch offen. **Keine Commit-ID:** Repository-Zugriff nicht erteilt; Auslieferung als ZIP.

## 1. Gelieferte Dateien

```text
worker/
  README.md
  SETUP_CLOUDFLARE.md
  SECURITY_CHECKLIST.md
  TEST_RESULTS.md
  package.json
  tsconfig.json
  wrangler.jsonc
  .gitignore
  src/index.ts
  src/session.ts
  src/limiter-store.ts
  src/types.ts
  src/cloudflare-shim.d.ts
  test/session.test.mjs
  ci/backend-check.yml
HANDOFF_BACKEND.md
```

Keine echten Geheimnisse, Tokens oder Identitäts-/Therapiedaten. `worker/ci/backend-check.yml` ist absichtlich eine **CI-Vorlage**, die Chat 04 bei Bedarf in den Repo-Root unter `.github/workflows/backend-check.yml` kopiert. Sie deployt nicht.

## 2. Schnittstelle zum Frontend (unverändert)

`POST {WORKER_BASE_URL}/api/session`, Header `Origin: https://<github-account>.github.io` und `Content-Type: application/json`, Body ausschliesslich `{ "pin": "..." }`, 6–128 Zeichen, maximal 1024 Byte. Erfolg `200 { "conversationToken": "..." }`. Fehlercodes 400 `BAD_REQUEST`, 401 `ACCESS_DENIED`, 403 `ORIGIN_FORBIDDEN`, 405 `METHOD_NOT_ALLOWED`, 413 `PAYLOAD_TOO_LARGE`, 429 `RATE_LIMITED`, 502 `UPSTREAM_FAILURE`, 503 `SERVICE_UNAVAILABLE`; JSON-Felder `error` und `message`. OPTIONS 204 für erlaubte Origin. Keine Cookies, keine Tokens in Browser-Storage oder Logs.

Worker-URL darf im Frontend als öffentliche Basis-URL stehen. **Nie** einen Fallback auf eine öffentliche ElevenLabs-Session implementieren; Fehler `429` nicht automatisch wiederholen. Der Frontend-TokenProvider muss die PIN nach dem POST aus seinem Speicher verwerfen. Bei `LIVE_ENABLED=false` gibt es kein Token.

## 3. Interne Implementierung

- Cloudflare Worker TypeScript + **eine** SQLite-backed Durable Object-Klasse `AccessLimiter`, Instanzschlüssel `idFromName('demo-global')`.
- Atomare SQLite-Transaktion (`transactionSync`) für jede gültige Reservierung / jeden Fehlversuch. Check nochmals im Reservierungsschritt. Ausfallsicher: DO-/Konfig-Fehler → 503.
- Limits: 5 falsche PIN/IP/15 min, 3 Tokenreservierungen/IP/15 min, 12 global/UTC-Tag. Alle vom Vertrag gedeckelt, optional **nur verschärfbar**.
- IP vor DO-Speicherung mit unabhängigem Cloudflare-Secret `IP_HASH_KEY` HMAC-SHA256 pseudonymisiert. Weitere Secrets: `DEMO_PIN`, `ELEVENLABS_API_KEY`; serverseitige Variablen `AGENT_ID`, `ALLOWED_ORIGIN`, `LIVE_ENABLED`. Dashboard verwaltet alle Variablen, `keep_vars=true` schützt vor versehentlichem Überschreiben bei Deploy.
- Token-API exakt `GET /v1/convai/conversation/token?agent_id=...` + `xi-api-key`, 6-s-Abbruchsignal; ausschliesslich `.token` wird ausgegeben.
- Keine öffentliche Mock-Token-Route, kein Audio-/WebRTC-Proxy, keine Therapie- oder Patientendaten. Datenbankereignisse werden nach 48 h bei Zugriff und best-effort per Alarm entfernt; Cloudflare-PITR kann frühere Zustände vorhalten.
- Standardmässig **kein Livezugriff**: fehlende Variable oder `LIVE_ENABLED=false` verweigert Token.

### Technischer Hinweis an Chat 00

**Kein CHANGE_REQUEST für `API_CONTRACT.md`:** Die öffentliche API, Provider-Parameter und Codes bleiben v1.0. `IP_HASH_KEY` ist **ein zusätzliches rein internes Cloudflare-Secret** zum Schutz der gespeicherten IP-Zähler, keine Browser- oder HTTP-Vertragsänderung. `keep_vars=true` ist eine bewusste Betriebsentscheidung, damit die drei unkritischen Laufzeitvariablen im Cloudflare-Dashboard bleiben. Eine harte Budgetgarantie ist unverändert nicht umsetzbar.

## 4. Tatsächlich ausgeführte Checks

Umgebung Node **22.16.0**, TypeScript **5.8.3**, Node-In-Memory-SQLite, echter HTTP-Handler/SQL-Code, Fake-Cloudflare-DO-RPC und Fake-ElevenLabs-Fetch.

```text
npm run check
  tsc --noEmit                                      PASS
  tsc                                               PASS
  node --test --test-concurrency=1 test/*.test.mjs  PASS (14/14; 0 failures; ca. 6.2 s)
```

Insbesondere getestet: korrekte/ungültige PIN, Origin/OPTIONS/GET, JSON/1-KiB-Validierung, fehlende Secrets, Ausfall DO, LIVE-Abschalter, 5/3/12-Limits, 20 konkurrierende Anfragen von 20 IPs (genau 12 Erfolge), UTC-Reset, Sliding Window, HMAC-IP und Upstream-422/Fehler/6-s-Timeout.

**Noch nicht getestet:** `wrangler deploy --dry-run`, Cloudflare-DO-RPC/SQL/Alarms auf echter Edge, Cloudflare-Header/CORS im Livebrowser, echter ElevenLabs-Token und End-to-End-WebRTC sowie Nokia C22. Grund: keine Kontozugriffe und npm-Registry in der bereitgestellten Ausführungsumgebung DNS-seitig nicht erreichbar. Keine gezahlten Dienste aktiviert. Cloudflare-Dokumentation, SQLite/Transaktionen, Git-Builds, Secrets und ElevenLabs-Endpoint wurden anhand offizieller Quellen am 02.11.2026 geprüft; Referenzen in `worker/README.md`.

## 5. Nutzerschritte / Integration

1. `worker/SETUP_CLOUDFLARE.md` befolgen. Zielrepo/GitHub-Branch `worker`, Cloudflare Workers Free, Root `worker`, Worker-Name `pflegepfad-access-worker`, **Preview-Builds aus**.
2. Nach erstem Deploy im Cloudflare-Dashboard die Variables `LIVE_ENABLED=false`, `ALLOWED_ORIGIN`, `AGENT_ID` setzen. Nur echte Secrets in Cloudflare (`DEMO_PIN`, `ELEVENLABS_API_KEY`, `IP_HASH_KEY`), niemals Chat/GitHub.
3. Gate B: Cloudflare-Deployment, DO-Migration/Binding, CORS und 503 bei Abschaltung ohne Providerkosten nachweisen. Ergebnisse/Screenshots **ohne Secrets** an Chat 04.
4. Chat 03 liefert privaten Agent `enable_auth=true`, Agent-Maximaldauer 300 s, Datensparsamkeit und Kontokostenstatus. Chat 04 prüft den gemeinsamen API-Vertrag, bindet Frontend an Worker-URL, führt Testdialog durch und testet Nokia C22.
5. Erst nach geklärtem **50-CHF-Gesamtbudget bis 31.12.2026** `LIVE_ENABLED=true` für kurze Live-Tests einschalten, direkt danach wieder `false`.

## 6. Offene Risiken / Integrationshinweise

- **Keine harte CHF-Obergrenze:** 12 reservierte Tokens sind keine Minuten-/Kostenabrechnung. Bereits gestartete Gespräche bleiben nach `LIVE_ENABLED=false` möglich; Stop lokal/bei ElevenLabs separat.
- CORS verhindert Browser-Fremdursprünge, aber keinen nichtbrowserbasierten Origin-Spoof; PIN bleibt Geheimnis.
- Quell-IP/15 min ist kein personenbezogenes Nutzersystem; NAT/wechselnde IPs können unfaire Sperren oder Umgehung bewirken.
- SQLite-Pseudonymdaten sind weiterhin technische Metadaten; Accountretention und PITR separat prüfen.
- Cloudflare Workers Free kann bei Überschreitung einzelner Free-Kontingente Requests verweigern. Ein Livekonto und eventuelle Kostenfreigabe sind gesondert zu überprüfen.
- `package-lock.json` fehlt, weil kein npm-Zugriff in dieser Umgebung. Nach `npm install` in Codespaces generieren/committen; danach CI auf `npm ci` umstellen.
- Keine andere Chat-Quelle / kein GitHub-Branch wurde hier automatisch geändert. Freigegebene Shared-Dokumente bleiben unverändert.
