# CLIENT_TOOLS.md - ElevenLabs Client Tools für Anna

Version: 1.0 - Uebergabe 2026-11-03 | Owner: Chat 03 | Quelle: API_CONTRACT.md v1.0 (APPROVED)

**Status:** Alle sechs Tools sind laut Nutzerinteraktion am 2026-11-02 im ElevenLabs-Dashboard als Client Tools angelegt und in der Uebersicht sichtbar (0 Ausfuehrungen). Der Nutzer hat sie anhand der hier beschriebenen Felder eingerichtet. Ein Provider-Konfigexport zur vollstaendigen Parameter-/Wait-for-response-Pruefung liegt noch nicht vor; keine Browser-/PWA-Tool-Ausfuehrung getestet.

## 1. Gemeinsame Regel

Jedes Tool wird im ElevenLabs-Agenten unter `Tools` > `Add Tool` als **Type=Client** erstellt. **Wait for response = EIN** bei allen sechs Tools. Toolname und Parameterbezeichner sind exakt und case-sensitive. Keine Webhook-/Server-Tools anstelle der Client Tools anlegen. Die PWA registriert dieselben Namen in `clientTools`, wartet den gemeinsamen `ActionDispatcher.dispatch(...)` ab und gibt die Antwort an ElevenLabs zurück.

Die Datei `tool_schemas.json` in diesem Paket ist eine **projektinterne, neutrale JSON-Schema-Hilfe**, KEIN ungeprüfter ElevenLabs-API-Import-Export. Bei der Dashboard-Eingabe Parameter manuell entsprechend unten anlegen. Strings mit eingeschraenkten IDs duerfen im Agenten nur die genannten Werte nutzen, selbst wenn das Dashboard keine Enum-Validierung anbietet. Der Browser bleibt die verbindliche Validierungsinstanz.

Dokumentation: https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools

## 2. Exakt sechs Tooldefinitionen

### `openInfo`

**Beschreibung für Dashboard:** Öffnet ein freigegebenes, fiktives Infothema in der App, wenn die Person Informationen zu Treppensteigen oder Aufstehen aus dem Stuhl sehen möchte. Warte auf das Ergebnis; behaupte nicht, dass die Ansicht geöffnet wurde, falls der Client einen Fehler meldet.

| Parameter | Typ | Pflicht | Erlaubte Werte |
| --- | --- | --- | --- |
| `topicId` | String | ja | `stairs` oder `chair_rise` |

Beispiel: `{"topicId":"stairs"}`

### `openVideo`

**Beschreibung:** Zeigt den lokalen, freigegebenen Demo-Videoplayer für das gewählte Thema; die Person kann eventuell noch auf Play tippen. Kein freier URL-Parameter und keine Autoplay-Zusage.

| Parameter | Typ | Pflicht | Erlaubte Werte |
| --- | --- | --- | --- |
| `videoId` | String | ja | `stairs_demo` oder `chair_rise_demo` |

Beispiel: `{"videoId":"stairs_demo"}`

### `openLogbook`

**Beschreibung:** Öffnet das ausschliesslich lokal im Browser-RAM vorhandene fiktive Therapielogbuch. Das Tool ändert keine Eintraege.

**Keine Parameter.** Beispiel: `{}`

### `proposeLogEntry`

**Beschreibung:** Bereitet einen fiktiven Übungslogbuch-Eintrag als Bestätigungsvorschau vor, aber speichert ihn **nicht**. Vor Aufruf fiktive Übung, freien Zeitpunkt und Kommentar aus dem Dialog sammeln. Nach erfolgreicher Vorschau die Angaben kurz vorlesen und die Person ausdrücklich um Bestätigung bitten.

| Parameter | Typ | Pflicht | Einschränkung |
| --- | --- | --- | --- |
| `exerciseId` | String | ja | `stairs` oder `chair_rise` |
| `when` | String | ja | 1-80 Zeichen, fiktiver Zeitpunkt |
| `comment` | String | ja | 0-240 Zeichen, freier Demo-Text |

Beispiel: `{"exerciseId":"chair_rise","when":"heute Morgen","comment":"hat gut geklappt"}`

Ein zweiter Vorschlag bei bereits bestehender Vorschau muss mit `CONFIRMATION_PENDING` abgewiesen werden (oder per UI nach ausdrücklicher Aktion behandelt werden). Keine ungeprüften HTML-Inhalte in die UI setzen.

### `confirmLogEntry`

**Beschreibung:** Versucht, einen bereits angezeigten fiktiven Logbuchvorschlag zu bestätigen oder abzulehnen. Nur nach einer gesonderten, klaren Bejahung **nach** der Vorschau `confirmed=true` senden. Die App prüft diese Bestätigung unabhängig und kann Touch-Bestätigung verlangen. Bei Ablehnung `confirmed=false` senden. Ein erfolgreicher Tool-Aufruf ist erst nach Antwort `CONFIRMED` eine Speicherung.

| Parameter | Typ | Pflicht | Werte |
| --- | --- | --- | --- |
| `confirmed` | Boolean | ja | `true` oder `false` |

Beispiel: `{"confirmed":true}`

**Sicherheitsgate (im Browser, nicht allein im Prompt):** `confirmed=true` nur akzeptieren, wenn ein zur aktuellen Session-Generation gehoerender `pendingLogEntry` besteht, NACH der Vorschau eine *finale* eindeutig zustimmende Nutzer-Transkription eingegangen ist, diese hoechstens 30 Sekunden alt und unverbraucht ist und keine konkurrierende Änderung vorliegt. Ohne verlässliche finale Nutzeräusserung `CONFIRMATION_REQUIRED` und **Touch-Fallback**. Bei `confirmed=false` wird vorhandener Vorschlag verworfen. STOPP verwirft ausstehenden Vorschlag sofort. Die logische Implementierung ist Owner Chat 01.

### `setProactivity`

**Beschreibung:** Ändert den Schalter für optionale, seltene proaktive Fragen nach fiktiven Übungen während einer aktiven Sprachsitzung. Nur auf klaren Wunsch der Person aufrufen. Neue Einstellung erst nach positivem Toolergebnis als gesetzt bezeichnen. Default bleibt AUS.

| Parameter | Typ | Pflicht | Werte |
| --- | --- | --- | --- |
| `enabled` | Boolean | ja | `true` oder `false` |

Beispiel: `{"enabled":true}`

## 3. ActionResult - an den Agenten zurückgeben

Erfolgreiches Ergebnis:

```json
{"ok":true,"code":"PENDING_CONFIRMATION","message":"Bitte Eintrag bestätigen."}
```

Fehlgeschlagenes Ergebnis:

```json
{"ok":false,"code":"UNKNOWN_ID","message":"Dieses Beispiel ist nicht vorhanden."}
```

Weitere zulässige Erfolgscodes: `OK`, `PENDING_CONFIRMATION`, `CONFIRMED`, `CANCELLED`. Fehlercodes: `INVALID_ARGUMENT`, `UNKNOWN_ID`, `STALE_SESSION`, `NOT_AVAILABLE`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_PENDING`.

**Reaktion Anna:** Nach `ok:false` nicht so tun, als sei die Aktion gelungen. Keine unendlichen Wiederholungen. Bei `CONFIRMATION_REQUIRED` um Bestätigung via Touch bitten. Keine Geheimnisse, Stacktraces oder URLs in Toolantworten.

## 4. Was NICHT als Client Tool anzulegen ist

COACH EIN/AUS, STUMM, STOPP und F9 gehoeren zur PWA und zum `SafetyController`, nicht zur Agent-Toolliste. Das lokale STOPP muss unabhängig von Audio und Netz funktionieren. Auch direkte Audio- oder Medienkontrolle darf nicht über ein nicht freigegebenes siebtes Tool eingeführt werden.

## 5. Dashboard-Checkliste und Falltests

- [x] Exakt sechs Toolnamen im Dashboard-Screenshot sichtbar, Schreibweise identisch.
- [ ] Alle sechs laut Einrichtungsanleitung Type=Client und Wait for response=AN; Stichprobe per UI/Export noch erforderlich.
- [ ] Alle Parameter gemaess Nutzereingabe angelegt; vollstaendiger Export-/Dashboard-Abgleich ausstehend; `openLogbook` ohne Parameter.
- [ ] Kein frei wählbarer `url`-, `html`- oder `patientId`-Parameter.
- [ ] Mit Frontend-Dispatch und echten Toolresultaten getestet (Spaeter Chat 04).

Gezielte Negativtests: `topicId='unknown'` => `UNKNOWN_ID`; `confirmed='true'` (String) => `INVALID_ARGUMENT`; `confirmed=true` ohne finale Bejahung => `CONFIRMATION_REQUIRED`; alter Generation-Aufruf nach STOPP => `STALE_SESSION`; ungültiger Video-ID => `UNKNOWN_ID`; doppelter unbestätigter Vorschlag => `CONFIRMATION_PENDING`.
