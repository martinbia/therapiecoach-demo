# Projektbrief – KI-Therapiecoach-Mock-up

**Version:** 0.7 (konsolidiert, 2026-11-02)  
**Status:** Fachliche Ausgangsspezifikation; technische Schnittstellen separat freigeben.

## 1. Zweck

Ein einfaches, praktisch nutzbares **Anschauungsobjekt** für KI-basierte Rehabilitationsunterstützung nach Hüftfraktur. Testpersonen sollen auf einem Smartphone oder Tablet direkt mit einem Sprachcoach sprechen, Inhalte ansehen und Funktionen über Sprache bzw. Touchscreen bedienen können. Es ist **keine klinisch validierte Anwendung** und kein Medizinprodukt. Der technische Voice-Baustein soll in künftigen Forschungsprojekten wiederverwendbar sein.

## 2. Geräte und Rahmen

- **Zuerst:** Nokia C22, Android 13 Go; PWA in aktuellem unterstütztem Browser.
- **Später:** aktuelles Android-Tablet, voraussichtlich Lenovo Tab 10.1; responsives Layout von Anfang an.
- Das alte Samsung Tab A (Android 7.1.1) und Nexus 5X (Android 8.1) sind keine Zielplattformen; alter Browser-/Sicherheitsstand.
- Entwicklung möglichst ohne lokale IDE; GitHub-Weboberfläche/GitHub Actions und bereitgestellte Dateien.
- Externe Dienstkosten maximal **50 CHF bis 31.12.2026**, Hardware separat; keine versteckten kostenpflichtigen Dienste.
- Sprache wird online verarbeitet, nicht mit der langsamen Offline-Whisper-Implementierung auf dem Nokia.

## 3. Personen und Dialog

Start mit Auswahl **Patient/in** oder **Angehörige/r**. Coach-Persona „Anna“: freundlich, geduldig, knappe verständliche Antworten, zunächst Hochdeutsch, Schweizerdeutsch experimentell auf Verständlichkeit prüfen. Keine therapeutischen Entscheidungen oder medizinisch individuellen Instruktionen. Gespräch soll natürlich sein, ohne Push-to-Talk für jede Äusserung.

## 4. Oberfläche und Hauptfunktionen

Vier gut sichtbare Bereiche: **Infos**, **Videos**, **Therapielogbuch**, **Mit Anna sprechen**. UI mit grossen Touch-Zielen, lesbaren Texten, Smartphone- und Tablet-Layouts.

- **Infos:** wenige fiktive/validierte Beispielthemen wie Treppensteigen, Aufstehen aus Bett/Stuhl. Auswahl per Touch oder Sprache.
- **Videos:** ein bis drei genehmigte oder selbst erstellte Demonstrationsclips; öffnen per Touch oder Client Tool, lokal pausieren/stoppen; Agent schweigt während Video vorzugsweise.
- **Dokumente:** ein bis zwei freigegebene Beispieldokumente/PDFs; einfache Anzeige und kurze Erklärung.
- **Logbuch:** vorgegebene fiktive Historie. Bei aktivem Coach kann Person eine Übung, Zeitpunkt und Eindruck nennen. Agent fasst zusammen, fragt nach Bestätigung; erst dann wird ein Eintrag erzeugt. Touch-Alternative vorgesehen. **Nur RAM, keine Persistenz**; nach Seitenneustart wieder Ausgangslage.
- **Proaktive Nachfragen:** eigenständiger Schalter „Aktive Nachfragen“, zunächst AUS. Wenn EIN, darf Anna während aktiver Sprachsitzung gelegentlich nach Übung fragen; kein Timer/Push bei geschlossener App, keine aufdringlichen Wiederholungen.
- **Multimodalität:** Touch und Sprache lösen dieselben App-Aktionen aus; Screen-Auswahl kann optional sprachlich begleitet werden. Agent kann Client Tools für `openInfo`, `openVideo`, `openLogbook`, `proposeLogEntry`, `setProactivity` verwenden. Aktionen sind zu validieren, insbesondere IDs und Eintragsbestätigung.

## 5. Drei Sicherheits-/Bedienelemente

- **COACH EIN/AUS:** aktiviert eine neue Sprachsitzung oder beendet sie; restliche UI bleibt verfügbar.
- **STUMM:** Mikrofonsignal und KI-Audio stummschalten; Sitzung kann grundsätzlich bestehen bleiben. Implementierbarkeit und genaues SDK-Verhalten prüfen; UI zeigt Status.
- **STOPP:** sofort lokal die Interaktion und laufende Medien unterbrechen und die Sprachsitzung beenden; kein automatischer Neustart durch verspätete Events. Immer gut sichtbar und ohne Spracherkennung nutzbar.

Ein externer Schalter soll später elektrisch an eine Taste einer handelsüblichen **Bluetooth-Tastatur** angeschlossen werden. Erste Softwareversion erkennt beispielhaft **F9** zum Umschalten von COACH EIN/AUS. Nur bei offener/fokussierter PWA, keine Zusage für gesperrten Bildschirm. Gewöhnliche Bluetooth-HID-Tastatur: keine eigene BLE-Implementierung.

## 6. Beispielvorführung (3–5 Minuten)

1. App starten; Rolle „Patient/in“ auswählen, Coach aktivieren, Anna begrüsst.
2. Mit aktivierter Proaktivität nach Übung fragen; „Aufstehen aus dem Stuhl“, Zeitpunkt, Verlauf, Bestätigung, neuer Demo-Logbucheintrag.
3. „Erkläre das Treppensteigen“ oder gleichwertiger Touch-Aufruf; Kurzinfo erscheint und Anna erklärt.
4. Video zum Thema starten; Während Wiedergabe kurze Pause der Sprachausgabe; danach Nachfrage.
5. Proaktivität AUS; COACH EIN/AUS, STUMM und STOPP demonstrieren; später F9/physischer Schalter.
6. App neu laden; neu hinzugefügter Logbucheintrag ist verschwunden.

Im Angehörigenmodus alternative Fragen zur Unterstützung einer nahestehenden Person.

## 7. Inhalte und Grenzen

Therapieinhalte werden später fachlich geprüft und ausgetauscht; zunächst nur als klar gekennzeichnete Beispieldaten. GitHub Pages ist öffentlich: keine geheimen oder personenbezogenen Inhalte dort ablegen. Agent-Wissensbasis und Medien-Metadaten getrennt vom Programmcode halten. Keine echten Patienten, Konten, Therapiedatenbank, Terminplanung, automatische Erinnerungen, Bluetooth-Eigenentwicklung oder regulatorische Medizinprodukt-Funktionen in Version 1.

## 8. Technik und Datenschutz

- GitHub Pages: statisches Frontend/PWA.
- ElevenLabs Agents: STT/LLM/TTS mit Echtzeitdialog; private Agent-Konfiguration; Patient-/Angehörigenkontext.
- Cloudflare Workers: serverseitiger PIN-Schutz und kurzlebige Autorisierung, sichere Secrets, Rate Limits, optional Stop-Ausgabe bei abgeschalteter Zugangssperre.
- Bevorzugt WebRTC mit ElevenLabs-`conversationToken`; genaue API und SDK-Kompatibilität vor Freigabe prüfen.
- Auch mit RAM-Logbuch können Gesprächs-/Audiodaten bei ElevenLabs anfallen; nur fiktive Daten und datensparsame Agent-Einstellungen.
- Kein eigener Backend-Server und keine produktive Datenbank.

## 9. Akzeptanz für Demonstrator V1

Die Oberfläche funktioniert auf Nokia C22. Ohne Cloud-Dienste kann man per Mock-Modus Rolle, Infos, Video, Logbuch, Proaktivität und UI-Zustände demonstrieren. Nach echter Integration kann man einen geschützten Sprachdialog starten und lokal zuverlässig stummschalten/stoppen. Agent-Tools öffnen Medien und erzeugen bestätigte fiktive Einträge. Tastatur-F9 funktioniert im Vordergrund. Geheimnisse sind nicht in Web-Assets oder Logs. Kostenkontrolle und tatsächliche Smartphone-Tests sind dokumentiert.

## 10. Aufwand

Frühere Grobschätzung: ca. **15–25 Entwicklungsstunden** mit intensiver KI-Unterstützung; keine verbindliche Zusage. Agent-/Cloud-Kontoaktivierung, medizinisch validierte Inhalte, Hardware-Umbau, zusätzliche Integrationsfehler und reale Tests können den Aufwand erhöhen.
