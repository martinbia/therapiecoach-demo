# SECURITY_CHECKLIST – Backend-Gate B / Live-Gate P5

**Stand 02.11.2026.** `[x]` = im Code bzw. lokal mit Fake-Diensten geprüft, `[ ]` = manuelle Cloud-/Anbieterprüfung ausstehend. Ein lokaler Test belegt **nicht** die Cloudflare-Betriebsbereitschaft.

## Code und Tests

- [x] Nur `POST /api/session`, exact-Origin-CORS und gezielte OPTIONS-Behandlung.
- [x] Nur Objekt `{pin:string}` mit Länge 6–128 und höchstens 1024 Request-Bytes; zusätzliche Felder abgewiesen.
- [x] Neutrale, vertragskonforme JSON-Fehler 400/401/403/405/413/429/502/503.
- [x] Richtige PIN allein erzeugt kein Token bei `LIVE_ENABLED!=true`; ohne Secrets/Binding/IP keine Freigabe.
- [x] PIN-Vergleich SHA-256-Digests und vollständiger Byte-Vergleich, nicht unsicherer Präfixvergleich.
- [x] HMAC-SHA256-Pseudonymisierung der IP; nur Zeitstempel/UTC-Tag/Art in SQLite, keine Klartext-IP im Durable Object.
- [x] Ein **globales** SQLite-backed DO; `transactionSync` ohne `await` für Zählung und Reservierung.
- [x] 5 Fehlversuche/IP/15min, 3 Reservierungen/IP/15min, 12 global/UTC-Tag; strengere Limits möglich, keine Erhöhung durch zufällige Konfiguration.
- [x] Provider-Aufruf **nach** Reservierung; keine Rückerstattung bei Upstreamfehler; 6-s-Abbruchsignal.
- [x] Aus der Providerantwort wird nur `token` übernommen; keine API-/Agent-Metadaten im Browser.
- [x] `Cache-Control:no-store`, `Vary:Origin`, `Referrer-Policy:no-referrer`, keine Cookies/CORS-Credentials.
- [x] Keine öffentliche Fake-Token-, Admin-, Reset- oder Statistik-Route; keine automatische Retry-Logik.
- [x] Reiner Sourcecode schreibt keine Logs, `observability.enabled=false`; DO-Aufräumen bei Zugriff + best-effort Alarm.
- [x] 14 Node-/SQLite-/Fake-Provider-Tests und TypeScript-Check **lokal bestanden**.

## Cloudflare-Konto / Integration (noch offen)

- [ ] Cloudflare Workers **Free** und SQLite-DO-Plan/Limit im echten Konto bestätigt.
- [ ] Reale GitHub-Pages-Origin exakt als `ALLOWED_ORIGIN` eingestellt (`https://konto.github.io`, **kein** `/repo/`).
- [ ] `LIVE_ENABLED=false` in Dashboard gesetzt und öffentliche POST-Prüfung ergibt `503`, keine neue Berechtigung.
- [ ] Echte Geheimnisse ausschliesslich in Cloudflare-Secret-Bindings (`DEMO_PIN`, `ELEVENLABS_API_KEY`, `IP_HASH_KEY`), ausreichend stark und voneinander unabhängig.
- [ ] Keine `.dev.vars`, API-Schlüssel, PINs, echten Tokens in GitHub, ChatGPT, Fotos oder CI-Logs.
- [ ] `ACCESS_LIMITER`-Durable-Object-Binding mit SQLite-Migration `new_sqlite_classes` erfolgreich deployed.
- [ ] Origin-, CORS-, PIN-, Sperr- und Paralleltests gegen tatsächlichen Cloudflare Worker **kontrolliert** erfolgreich; nicht mit echten Providerkosten Lasttests auslösen.
- [ ] Cloudflare-Builds-Preview-Routen ausgeschaltet/eingeschränkt; alle produktiven Routen gesperrt oder PIN-geschützt.
- [ ] Cloudflare-Plattform-/Account-Logs und Aufbewahrungsfristen zusätzlich überprüft; DO-PITR kann ältere Speicherzustände länger vorhalten.
- [ ] Notfallabschaltung per Dashboard tatsächlich geprüft (nur **neue** Ausgaben blockiert).

## ElevenLabs / Kosten / Datenschutz (noch offen)

- [ ] Einziger Agent **privat**, `enable_auth=true`, kein öffentlicher Startweg / keine kombinierte Anbieter-Allowlist.
- [ ] WebRTC `conversationToken` statt signierter WebSocket-URL.
- [ ] Agent-Maximaldauer **300 s** im Anbieter gesetzt, 300-s-Frontend-Timer separat getestet.
- [ ] Audio-Speicherung AUS, Retention minimiert, Datenschutzangaben im Konto tatsächlich geprüft; **keine echten Patientendaten**.
- [ ] Kontokosten, Restminuten und mögliche Überziehungen/Auto-Top-ups geklärt; Budget **50 CHF bis 31.12.2026**. Unklare Abrechnung ⇒ `LIVE_ENABLED=false`.
- [ ] Anbieter-Key nötigenfalls sofort widerrufbar; keine Behauptung, dass das aktive WebRTC-Sitzungen sofort trennt.
- [ ] Nokia C22: tatsächliche Verbindung und STOPP/STUMM durch Chat 04 hardwareseitig abgenommen.

## Sicherheitsgrenzen, die nicht behoben werden können durch den Worker allein

1. **CORS/Origin ist keine Authentifizierung:** Nicht-Browser-Clients können den Origin-Header setzen. Die PIN bleibt obligatorisch.
2. **PIN ist geteilt:** Kein persönliches Konto; Weitergabe oder Abgriff erlaubt autorisierte Tokenabrufe, begrenzt nur durch IP/Tag-Limits. Bei Verdacht PIN und API-Key tauschen.
3. **IP-Limits sind best-effort gegen organisierte Angreifer:** NAT, Mobilfunkwechsel und verteilte IPs können Fehlblockaden bzw. Umgehung begünstigen. Globaldeckel hilft gegen parallele Übernutzung.
4. **Die 12 Token/Tag sind KEIN CHF-Kostendeckel:** Eine ausgegebene Berechtigung kann eine längere kostenrelevante Sitzung auslösen. Bereits laufende und noch verwendbare Tokens werden durch `LIVE_ENABLED=false` nicht widerrufen.
5. **Cloudflare Free ≠ feste Kostenobergrenze für ElevenLabs:** Provider kann nach Minuten, Tokens, Zusatzleistungen, Tarif oder Aufladung abrechnen. Harte Kostenkontrolle nur über tatsächlich bestätigte Anbieter-Abrechnungsgrenzen und menschliche Freigabe.
6. **IP-Pseudonyme sind technische personenbezogene Metadaten** und keine anonymen Daten; Cloudflare kann Infrastruktur-Logs verarbeiten. SQL-Löschalarm ist best-effort, die Cloudflare-PITR-Historie kann Datenzustände länger erhalten.
7. **Worker kann keine bereits aktive WebRTC-Medienverbindung stoppen:** Client-STOPP und Provider-Maximaldauer bleiben Pflicht.
8. **Fehlende reale End-to-End-Prüfung:** Code-Tests beweisen weder tatsächlich deploytes DO-RPC/Alarms noch WebRTC-/Nokia-Verhalten.
