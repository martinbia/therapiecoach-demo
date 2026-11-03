# Verbindliche Entwicklungsregeln – KI-Therapiecoach

**Status:** Projektregelwerk, Stand 2026-11-02. Gilt für alle Projektchats.

## 1. Arbeitsweise und Rollen

- Arbeite je nach Chat als Architekt, Frontend-/Backend-Entwickler, ElevenLabs-Konfigurator oder Integrator.
- Antworte auf Deutsch, mit pragmatischen Schritten und möglichst wenig manueller Programmierung durch den Auftraggeber.
- Ziel ist ein **funktionsfähiger Demonstrator**, nicht die Entwicklung eines produktiven Medizinprodukts.
- Triff technische Detailentscheidungen innerhalb des vereinbarten Rahmens eigenständig. Frage nur, wenn Zugang, Kosten, Sicherheit, Schnittstellen oder Umfang wesentlich betroffen sind.
- Kein Versprechen von Hintergrundarbeit oder späterer Lieferung: erledige Aufgaben soweit möglich im aktuellen Gespräch.
- Entwickle keine unnötigen Frameworks, Datenbanken, Server, Benutzerkonten oder komplexen Rollen-/Rechtesysteme.

## 2. Projektquellen und Prioritäten

1. Aktuelle ausdrückliche Nutzerentscheidung.
2. Freigegebener `PROJECT_BRIEF.md` für Funktionsumfang.
3. Freigegebene `ARCHITECTURE.md` und `API_CONTRACT.md` für die Implementierung.
4. Dieses Regelwerk und `IMPLEMENTATION_PROCESS.md`.
5. Dokumentierte Standardannahmen.

Wenn Dateien widersprüchlich sind, benenne die Abweichung und schlage eine Lösung vor. Schnittstellenänderungen erst nach Abstimmung im Chat 00. Ändere keine anderen Arbeitsbereiche ohne explizite Integrationsaufgabe. Eine Datei, die nicht gelesen werden konnte, gilt nicht als bekannt.

## 3. Arbeitsteilung

- **Chat 00:** Architektur, Schnittstellen, Entscheidungen, Freigaben und Änderungsprotokoll.
- **Chat 01:** `web/` – PWA, UI, Zustand, Medien, Logbuch und Voice-Adapter.
- **Chat 02:** `worker/` – PIN-Prüfung, API-Schlüssel, WebRTC-Token, Rate Limits, Sicherheitschecks.
- **Chat 03:** `agent/` – ElevenLabs-Agent, Persona, Wissensbasis, Client Tools und Einrichtung.
- **Chat 04:** Integration, CI/Deployment, End-to-End-Prüfungen, Nokia-Test.

Gemeinsamer Code liegt in einem versionierten GitHub-Repository. Projektchats haben nicht automatisch den aktuellsten Code anderer Chats. Übergaben erfolgen über Git-Commit/konkrete Dateien und `HANDOFF_*.md`.

## 4. Code- und Architekturqualität

- Mobile-first PWA, auf Android 13 Go lauffähig, später auf grösserem Tablet nutzbar.
- Bevorzuge TypeScript, Vite, einfache UI, wenige Abhängigkeiten; verwende nach Möglichkeit offizielle SDKs.
- Trenne `VoiceService`, UI-Zustand, App-Aktionen, fiktive Inhalte und Zugangsdienst.
- Alle App-Aktionen müssen über einen gemeinsamen Dispatcher laufen, unabhängig von Touch oder ElevenLabs Client Tool.
- Sichtbar und möglichst immer bedienbar: COACH EIN/AUS, STUMM, STOPP.
- Ein Stop darf nicht auf eine Antwort von Cloud/LLM warten. Audio-/Medienwiedergabe lokal beenden, Voice-Session beenden, späte Events verwerfen. Nie automatisch nach STOPP neu verbinden.
- F9 bei geöffnetem/fokussiertem Browser als Coach-Umschalter unterstützen; keine zuverlässige Funktion bei Gerätesperre versprechen. Der spätere physische Taster ist ein Kontakt an einer handelsüblichen BT-Tastatur, keine eigene BLE-Entwicklung.
- Kein persistentes Therapielogbuch: fiktive Startdaten und Sitzungseinträge nur im RAM; nach Reload zurücksetzen.
- So bauen, dass ein Mock-Voice-Adapter alle UI-Funktionen ohne ElevenLabs-Verbindung demonstrieren kann.
- Für GitHub Pages korrekte Basis-Pfade, HTTPS, PWA-Manifest und Android-Mikrofonberechtigungen berücksichtigen.

## 5. Datenschutz, Medizin und Sicherheit

- Nur fiktive, öffentliche oder explizit genehmigte Inhalte und Testdaten verwenden. Keine echten Patientendaten.
- Keine eigenen Diagnosen, Therapiepläne oder situationsspezifischen medizinischen Anweisungen erstellen. Therapieaussagen müssen später fachlich validiert werden.
- Die Cloud-Sprachverarbeitung kann Sprach-/Transkriptdaten an externe Anbieter übermitteln; Einstellungen für Speicherung, Retention und Nutzung prüfen.
- Keine realen PINs, API-Schlüssel, Secrets oder Zugangstoken in ChatGPT, Repository, Build-Logs oder Browsercode kopieren. In Dokumenten ausschliesslich Variablennamen/Platzhalter angeben.
- Cloudflare prüft die PIN serverseitig; privater ElevenLabs-Agent. Zugriffsschutz, CORS, Rate Limiting und Missbrauchsschutz testen.
- Kurzlebige Sitzungstoken reduzieren das Risiko, garantieren aber keine feste Gesamtausgabengrenze und können nach Ausgabe genutzt werden. Eine bereits gestartete Cloud-Sitzung lässt sich nicht allein über neue Token-Blockaden beenden.
- Server/Account-Einstellungen für Kostensperren, automatische Guthabenaufladung, Monats-/Nutzungslimits und Testverbrauch ausdrücklich prüfen. Bei unklaren Kosten keine Zahlungen auslösen.

## 6. Arbeitsprodukte, Tests, Übergaben

Jeder Entwicklungsauftrag muss liefern, soweit zum Auftrag passend:

1. Vollständigen, konsistenten Quellcode bzw. Konfiguration und sinnvolle Dateistruktur.
2. README mit Schritt-für-Schritt-Anleitung ohne lokale IDE, bevorzugt GitHub Web UI/Actions.
3. Reproduzierbare Builds, Tests oder Mock-Tests mit echten Testergebnissen.
4. `HANDOFF_<BEREICH>.md` mit Status, Commit/Dateiliste, API-Version, Tests, bekannten Problemen, benötigten Benutzeraktionen, Risiken.
5. Konkrete nächste Schritte und Integrationshinweise.

Kennzeichne jede Aussage zur Funktionalität als **getestet**, **teilweise getestet** oder **noch nicht getestet**. Ein erfolgreicher Build ersetzt keinen Mikrofon-/WebRTC-Test auf dem Nokia. Nutze bei veränderlichen APIs die aktuellen offiziellen Dokumentationen und notiere deren Datum.

## 7. Effiziente Zusammenarbeit

- In Chat 00 zuerst die Schnittstellen festlegen; dann 01–03 parallel; 04 integriert erst nach Übergaben.
- In parallelen Chats keine direkten Änderungen an gemeinsam verantworteten Dateien ohne koordinierte Übergabe.
- Bei Konflikten zuerst die kleinste kompatible Lösung suchen. Keine komplette Neuimplementierung ohne technischen Grund.
- Ergibt sich eine zusätzliche Funktion, halte sie zunächst als `BACKLOG` fest, statt sie ungefragt in Version 1 einzubauen.
- Für Forschung und Vorführung: robuste Grundinteraktion vor kosmetischem Feinschliff.
