# Nokia C22 – PWA installieren und schrittweise testen

**Nur nach grünem GitHub-Pages-Deployment; zuerst Mock-Modus.** Android 13 Go, aktuelles Chrome, stabile Internetverbindung für die Installation. Keine echten Gesundheitsdaten eingeben. Ein eigenständiges APK wird **nicht** gebraucht.

## A. Installation (Mock ohne Cloudkosten)

1. Nokia C22 mit WLAN verbinden und **Chrome** öffnen.
2. `https://martinbia.github.io/therapiecoach-demo/` eingeben. Die Adresse funktioniert erst, wenn GitHub Pages tatsächlich freigeschaltet und erfolgreich deployt wurde.
3. Chrome-Menü **⋮ → Zum Startbildschirm hinzufügen** oder **App installieren** auswählen, wenn angeboten. Sonst weiterhin direkt im Browser testen.
4. Startbildschirm-Icon **Anna Demo** öffnen. Bei Problemen: zuerst Browserseite neu laden. Es muss **MOCK** erkennbar sein; hier **keine** PIN und **kein** Mikrofon nötig.

## B. Erste kurze Hardwareprüfung – jetzt ausführbar, wenn Pages grün

Teste nacheinander, und teile Chat 04 jeweils **nur Ergebnis/Fehlertext** mit:

1. **N01 Oberfläche:** Patient/in wählen. Sind alle vier Kacheln sichtbar? Muss horizontal gescrollt werden? Dann Angehörige/r auswählen.
2. **N07 Touch-Medien:** Infos → Treppensteigen → PDF; Video → beide Clips jeweils manuell **Play** und **Pause**. Werden Medien dargestellt?
3. **N08 Logbuch:** Neuen **fiktiven** Eintrag vorschlagen → zunächst nur Vorschau, dann **Ja, fiktiv eintragen** → Zahl der Einträge wächst. App/Seite neu laden → zurück auf die zwei fiktiven Anfangseinträge.
4. **N09 Proaktivität:** Nach Neustart muss **AUS** angezeigt werden. EIN/AUS antippen; nur während einer gestarteten Mock-Sitzung wird eine optionale Nachfrage simuliert.
5. **N04 STOPP:** Mock-Coach EIN (unter „Mit Anna sprechen“). Optional „Gerätestimme EIN“ aktivieren und eine Simulation auslösen. Währenddessen **STOPP** drücken: Ton und Video müssen sofort aus sein. Danach darf keine alte Aktion die Sitzung selbst wieder starten.
6. **N10 F9:** Eine gekoppelte Bluetooth-HID-Tastatur benutzen, PWA im Vordergrund öffnen, **F9** drücken → COACH EIN/AUS. Das funktioniert nicht garantiert bei gesperrtem Bildschirm oder wenn ein Texteingabefeld aktiv ist. Ohne Tastatur diesen Punkt als *ausstehend* melden, nicht als Fehler.

## C. Live-Test – ausdrücklich erst nach Freigabe

Erst nach abgeschlossenem Gate für PIN/Cloudflare, Kosten/Datenschutz und aktivierter Live-PWA:

1. N02 Rolle wählen → **COACH EIN** → PIN nur im App-Dialog eingeben → Chrome-Mikrofonberechtigung erlauben. Erwartung: hörbare deutschsprachige Antwort in der PWA, natürliches Wechselgespräch. Niemals die PIN oder API-Schlüssel an Chat 04 senden.
2. N03 Während Anna hörbar spricht, **STUMM**: KI-Ausgabe **und** Mikrofoneingang müssen auf dem Nokia stumm sein. Nach STUMM AUS nur bewusst fortfahren. Ein Scheitern blockiert die Live-Hardwarefreigabe.
3. N04 **STOPP** mitten in einer KI-Antwort sowie während Video: Ton und Video sollen **beobachtbar unter 1 Sekunde** verstummen; keine späte Audioausgabe.
4. N05 Bei **Verbindungsaufbau** STOPP drücken und separat kurz WLAN ausschalten → keine unerwartete Wiederverbindung.
5. N06 **COACH AUS** beendet nur Voice, die UI bleibt verwendbar. COACH EIN verlangt neue Session/PIN.
6. N07 Sprachkommandos: „Öffne Infos zum Treppensteigen“, „Zeige Stuhl-Video“, „Öffne Logbuch“; danach übrige drei Toolnamen mit fiktiven Daten über Agent testen. Ungültige IDs dürfen nichts öffnen.
7. N08 Agent kann fiktiven Eintrag vorschlagen; **nur Touch bestätigt** in dieser Integrationsfassung. Ein mündliches „Ja“ allein darf **nicht** speichern. Neu laden → Eintrag weg.
8. N09 Zwischen Patient/in und Angehörige/r neu starten; default Nachfragen AUS, bei EIN höchstens gelegentlich während laufendem Dialog.
9. N10 BT-F9 wiederholen. N11 300-s-Agentenlimit separat als geplanten Laufzeittest kontrollieren; der Worker-Abschalter blockiert nur **neue** Sessions. N12 Konto-Kosten/Audio-Retention und Datenfreiheit dokumentieren.

**Wichtige Abnahme:** Ein grünes GitHub-Actions-Ergebnis ist **kein** Nokia-Nachweis. Insbesondere N02–N05 müssen auf echter Hardware funktionieren; bei Sicherheitsabweichung Live-Flag wieder AUS und keine Umgehung des PIN-Workers.

## D. Rückmeldung an Chat 04

Bitte folgende Angaben nennen (ohne PIN, Secrets oder Gesundheitsdaten): Test-ID, **OK / FEHLER / OFFEN**, ungefähres Verhalten, Android-/Chrome-Version, WLAN oder Mobilnetz. Für Medienfehler ggf. Screenshot ohne sensible Inhalte. Es ist nicht nötig, alle zwölf Tests auf einmal durchzuführen.
