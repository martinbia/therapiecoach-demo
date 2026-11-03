# TEST_RESULTS – Chat 02, Stand 02.11.2026

## Tatsächlich ausgeführt

Umgebung: Node.js **v22.16.0** (Node `node:sqlite`, experimentell), TypeScript **5.8.3**, ohne Cloudflare-Zugang und ohne ElevenLabs-Key.

```sh
cd worker
npm run check
```

- TypeScript: `tsc --noEmit` → **Bestanden**.
- Build für Tests: `tsc` → **Bestanden**.
- `node --test --test-concurrency=1 test/*.test.mjs` → **14/14 bestanden, 0 fehlgeschlagen** (ca. 6,2 s). Testdatei: `test/session.test.mjs`.

| Test | Resultat |
|---|---|
| Korrekte PIN: nur `conversationToken`, sichere Header | PASS |
| Falsche PIN, SHA-256-Vergleich | PASS |
| Fremde / fehlende / pfadbehaftete Origin | PASS |
| OPTIONS-Preflight, ungültiges OPTIONS, GET 405 | PASS |
| Schema-, Content-Type-, JSON-, Query- und 1-KiB-Grenze | PASS |
| 5 Falsch-PIN pro IP, andere IP unabhängig | PASS |
| 3 gültige Reservierungen pro IP | PASS |
| 20 gleichzeitige Anfragen von 20 IPs: genau 12 Ausgaben | PASS |
| Provider 422/fehlendes Token/kaputtes JSON, verbrauchte Slots bleiben | PASS |
| Provider-Netzwerkfehler | PASS |
| 6-s-Abbruch eines blockierten Fake-Providers (AbortSignal) | PASS |
| LIVE aus, fehlende Secrets/DO/IP, unzulässige Limitkonfiguration | PASS |
| 15-min-Sliding-Window, UTC-Tageswechsel, SQL-Bereinigung >48 h | PASS |
| IP nur als HMAC-SHA256-Hash in SQLite | PASS |

**Prüfarchitektur:** echte TypeScript-Sitzungs-/PIN-Logik, echte SQL-Queries aus `LimiterStore`, In-Memory-SQLite via Node, Fake-`ACCESS_LIMITER`-RPC-Stub, Fake-ElevenLabs-Fetch. Der Echtbetrieb wurde **nicht** auf Cloudflare ausgeführt. Der SDK-/Node-SQLite-Ersatz bildet Cloudflare nicht vollständig nach.

## Noch nicht getestet / Hindernisse

- `wrangler deploy --dry-run`, `wrangler dev` und echte Cloudflare-Runtime/SQL-Alarm-Ausführung: **nicht getestet**. In dieser Ausführungsumgebung war kein Wrangler installiert; öffentliche npm-Registry war DNS-seitig nicht erreichbar. Die Setup-Anleitung setzt daher `npm install` in GitHub Codespaces oder Cloudflare Builds voraus.
- Echte Cloudflare-DO-RPC-Serialisierung, Alarm-Auslösung im Worker, Plattform-Header `CF-Connecting-IP`, tatsächliche CORS-Preflight im Browser: **noch nicht live getestet**.
- Realer ElevenLabs-Token, `enable_auth`, WebRTC, 300-s-Agentengrenze, Abrechnung: **noch nicht getestet**.
- 6-s-Abbruch per AbortSignal mit blockiertem Fake-Fetch **lokal bestanden**; tatsächliche Cloudflare-Timer-Laufzeit noch nicht gemessen.
- Nokia C22 und Bluetooth/STOPP/STUMM: Zuständigkeit Chat 04, **nicht getestet**.
- `package-lock.json` nicht vorhanden: npm-Registry hier nicht erreichbar. Beim ersten `npm install` erzeugen/committen; dann CI auf `npm ci` umstellen.

## Quellen: offizielle Dokumentation geprüft am 02.11.2026

Cloudflare DO SQLite/Transaktionen, Alarm, Free, Secrets, Wrangler/keep_vars, Builds; ElevenLabs `GET /v1/convai/conversation/token`. Verlinkt in `README.md` und `SETUP_CLOUDFLARE.md`.
