# v1.4.0

Stabilitäts-Release: Kalender-Bearbeitung ohne Datenverlust, robustere Dialoge und sichtbares Fehler-Feedback.

## 🛠 Fixes

- **Serientermine werden nicht mehr komplett gelöscht.** Löschen und Bearbeiten übergeben jetzt `recurrence_id` – es ist nur noch die einzelne Instanz betroffen, nicht die ganze Serie. (meal-grid-card, family-calendar-card)
- **Bearbeiten nutzt `calendar/event/update` statt Löschen + Neuanlegen.** UID, Beschreibung und Serie bleiben erhalten; mehrtägige Ganztagstermine behalten ihre Dauer. Falls der Kalender kein Update unterstützt, greift ein sicherer Fallback (erst neu anlegen, dann löschen) – ein fehlgeschlagener Speichervorgang kann keinen Termin mehr verlieren.
- **Offene Dialoge überleben Re-Renders.** Termin- und Gericht-Dialoge werden nicht mehr durch State-Updates zerstört, während man tippt.
- **Fehler sind jetzt sichtbar.** Fehlgeschlagene Service-Calls (Speichern, Löschen, Laden, KI, To-do) zeigen eine HA-Notification statt still zu scheitern.
- Personen-Prefixe mit Regex-Sonderzeichen (z. B. `T.`) werden korrekt gematcht.
- Termine um 23 Uhr erzeugen keine ungültigen Null-Länge-Events mehr (Ende rollt sauber über Mitternacht).
- Event-Zuordnung kollidiert nicht mehr bei gleicher UID über mehrere Kalender/Serien hinweg.
- shopping-fav-card: Kommas in Favoriten werden abgefangen (hätten Einträge zerrissen) und das 255-Zeichen-Limit des `input_text` wird vor dem Speichern geprüft.

## 🔧 Intern

- Gemeinsame Utility-Funktionen (`esc`, `norm`, `pad`, Emoji-Codepoints, Toast) einmal global statt 4× dupliziert.
- Toter Code und doppelter Emoji-Map-Eintrag entfernt.
- **Beta-Build:** `family-planner-cards-beta.js` wird jetzt per `node build-beta.js` aus der Hauptdatei generiert. Alle 5 Karten (neu inkl. `nav-card-beta`) bekommen das `-beta`-Suffix und laufen parallel zur Hauptversion.

## ⚠️ Hinweise

- family-calendar-card: Der Speicher-Key für ausgeblendete Personen hat sich geändert – die Legenden-Auswahl wird einmalig zurückgesetzt.
- Nach dem Update Browser-Cache leeren bzw. hart neu laden (Strg+Shift+R).
