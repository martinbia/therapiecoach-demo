# Abnahmeprotokoll Nokia C22 / Android 13 Go

**Status 2026-11-02:** Alle praktischen Gerätetests offen. Gerät/Browser/Datum/Build-SHA erst beim Test eintragen. Nur fiktive Inhalte verwenden.

| Test-ID | Bedienhandlung | Bestehenskriterium | Ist-Ergebnis |
|---|---|---|---|
| N01 | PWA über HTTPS öffnen, Rolle wählen, Kacheln bedienen | Kein horizontales Scrollen, Texte/Buttons gut bedienbar | AUSSTEHEND |
| N02 | COACH EIN (live), Mikrofon erlauben, zwei Sätze sagen | Natürliches Hochdeutsch-Gespräch ohne erneutes PTT | AUSSTEHEND |
| N03 | STUMM während Anna antwortet; dann AUS | Input an Agent und lokaler Agententon stumm, danach wieder nutzbar | AUSSTEHEND |
| N04 | STOPP während Antwort und während Video | Lokal sofort still (Testziel < 1 s), bleibt still | AUSSTEHEND |
| N05 | STOPP bei `connecting`, WLAN trennen/wieder verbinden | Kein späterer Audio-/Sessionstart | AUSSTEHEND |
| N06 | COACH AUS und danach EIN | Nur Voice endet; Touch-UI/Video bleiben, bewusster neuer Start | AUSSTEHEND |
| N07 | Infos/Videos/Logbuch per Touch und Client Tools, falsche IDs testen | Nur Whitelist-IDs wirken; ungültige Eingaben ohne Wirkung | AUSSTEHEND |
| N08 | Vorschlag, Negation, Touch-/Transkript-Bestätigung, Reload | Kein unbestätigter Eintrag; Reload stellt nur fiktive Historie wieder her | AUSSTEHEND |
| N09 | Patient/in und Angehörige/r, Proaktivität EIN/AUS | Rollenkontext verschieden, Standard AUS, keine Pushs | AUSSTEHEND |
| N10 | BT-Tastatur F9 einmal/drücken-halten, PIN-Feld fokussieren | Ein Umschalten bei Einmaldruck; keine Wiederholung/kein PIN-F9 | AUSSTEHEND |
| N11 | Anbieter-300s-Limit und LIVE_ENABLED=false | Agent endet max. 300 s; Disable verhindert neue Token | AUSSTEHEND |
| N12 | Privacy-/Budgetdashboard prüfen | Keine Patientendaten/Secrets; tatsächliche Kosten/Retention dokumentiert | AUSSTEHEND |

**Gate C verlangt N02–N05 auf echter Hardware:** STUMM und STOPP haben Vorrang vor anderen Features. Ergebnisse getrennt nach `BESTANDEN`, `FEHLGESCHLAGEN`, `NICHT GETESTET` eintragen. Screenshots ohne PIN/API-Key/Token; keine echten Gesundheitsdaten.
