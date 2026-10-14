# Family Planner Cards

Vierzehn eigene Lovelace-Karten für einen Home-Assistant-Familienplaner:

- **`meal-grid-card`** — Essensplan (Frühstück/Mittag/Abend), gespeist aus einem Kalender, mit Inline-Bearbeitung, Food-Emojis und KI-Vorschlag (`ai_task`; entschärft mit Küchen-/Grundform-Rotation, Saison- und Wetterbezug, liest getippten Wunsch aus). **Kochbuch-Kopplung:** „★ Ins Kochbuch" pro Eintrag und „Woche füllen" hybrid (erst gewichtet aus dem Kochbuch, dann KI). Drei Darstellungen über `layout`: **`list`** (Vorgabe) ist die **Liste nach Tagen**: je Tag eine Zeile, links Wochentag und Datum, rechts die Mahlzeiten untereinander mit farbigem Punkt, Linien statt Kästen, heute mit Akzentstrich am Rand; sie funktioniert in jeder Breite. **`today`** ist „Heute groß, Woche kurz" für die Startseite: die Mahlzeiten von heute nebeneinander in einem Kasten, darunter die nächsten `days_ahead` Tage mit allem, was je Tag geplant ist (jede eingetragene Mahlzeit mit ihrem Punkt, leere fallen weg). **`grid`** ist die bisherige Tabelle; auf schmalen Karten (Handy, unter 560 px) dreht sie sich: Tage als Zeilen, Mahlzeiten als Spalten. Der Kopf ist schlicht: Titel links, rechts eine Pille ‹ Woche ›, „✨ Woche füllen" und „Leeren" als kleine Pillen. Die Farbe der Mahlzeiten steht nur im Punkt (`--fp-meal0` bis `--fp-meal2`). `mode: compact` (Heute/Morgen) bleibt wie bisher. `background` akzeptiert wahlweise ein Bild (URL → dunkles Overlay + weißer Text) **oder** einen CSS-Farbwert/Verlauf (heller Hintergrund, dunkler Text).
- **`family-calendar-card`** — Familienkalender mit **Tagesansicht** (eine Spalte je Person, große Terminkacheln, am Handy eine Zeitliste mit Jetzt-Linie), **Wochenansicht** mit großen Terminkacheln (am Tablet eine Spalte je Tag, am Handy die Tage untereinander; das klassische Stunden-Raster gibt es weiter mit `week_grid: true`) und Monatsansicht. Schlichter Kopf mit Titel, den Ansichten Tag/Woche/Monat als Schalter und dem Datum als Pille (‹ 12.–18. Okt ›), Knopf „+ Termin“ rechts, Personenfilter als kleine Chips mit Farbpunkt, Wischen wechselt Tag bzw. Woche. Mehrere Personen lassen sich per Präfix aus einem Kalender aufteilen. Termine direkt anlegen, bearbeiten und löschen. Im Stunden-Raster Jetzt-Linie (Outlook-Stil), Heute-Highlight und ausgegraute vergangene Tage. Dazu eine **kompakte Mehrtagesansicht** (`initial_view: agenda`): eine Spalte je Tag, Termine als Kacheln mit farbiger Kante — gedacht als Ersatz fuer eine fremde Kalenderkarte in der Uebersicht.
- **`kids-routine-card`** — Buddy-artige Routinen für Kinder: Aufgaben mit Emoji nach Tageszeit, antippen zum Abhaken (Sterne via ChoreOps), mit Belohnungs-Animation.
- **`shopping-fav-card`** — Schnell-Buttons für Lieblings-Artikel/-Aufgaben (ein Tipp legt das Item auf die To-do-Liste) als **gleich breite Chips** in `columns` Spalten (auf schmalen Karten weniger), Emoji über dem Namen. Favoriten, die **schon offen auf der Liste** stehen, sind mit ✓ markiert und werden bei einem Tipp nicht doppelt angelegt (die Karte liest die Liste live, nur ohne `assign`). Bearbeiten (Hinzufügen/Entfernen/Sortieren) über ✏️ im Kopf; Favoriten in einem `input_text`, Emojis automatisch abgeleitet. Optional als „Hinzufügen"-Button mit kombiniertem Dialog (Freitext + Favoriten + Zuweisung + Fälligkeit, alles konfigurierbar).
- **`nav-card`** — Hüllt eine beliebige Karte ein und macht sie als Ganzes anklickbar: Tipps auf nicht-interaktive Bereiche navigieren zu einem Tab, interaktive Elemente (Checkboxen, Eingabefelder, anklickbare Zellen) bleiben aktiv.
- **`fp-todo-card`** — Zeichnet ihre **eigene To-do-Liste** (nicht mehr die native `todo-list`-Karte) im Stil der Baby-Übersicht, live aus der To-do-Entität: Kopf mit Namens-Pille oder Titel und der Zahl der offenen Aufgaben, darunter die Aufgaben als Kacheln mit großem Kreis zum **Abhaken (mit „Rückgängig")** und einem Fälligkeits-Chip („gestern", „heute 14:00", „Fr"). Mit `display_order: duedate_asc` stehen sie in Gruppen **Überfällig / Heute / Demnächst / Ohne Datum**. `pill: { label, color }` gibt jeder Person **eine Farbe** (passt zu hellem und dunklem Theme), `empty_text` ist der Hinweis bei leerer Liste, `due_date_period` filtert nach Fälligkeit. Eine Eingabezeile legt Aufgaben an (`hide_create: true` blendet sie aus); neue Einträge erscheinen **sofort**, auch über das `fp-todo-add`-Event der `shopping-fav-card`, noch bevor Cloud-Listen wie Todoist/Bring nachziehen. Optional ein **eigener Änderungsdialog** (`edit_dialog`): Aufgabe umbenennen, in eine andere Liste verschieben, Fälligkeit per Schnellauswahl setzen und eine Wiederholung vergeben.
- **`fp-glance-card`** — „Today at a glance"-Banner für die Übersicht: tageszeitabhängige Begrüßung, Datum, nächster Termin (Präfix-Personen aufgelöst) und heutiges Abendessen, mit einem Hintergrund je Tageszeit (nach Uhrzeit): als Foto, aus dem Theme (`--fp-glance-*`) oder als Blauverlauf. Das Wetter wird als eingebettete `clock-weather-card` (echte Animationen + Vorschau) transparent auf den Banner geblendet. Klick pro Element navigiert getrennt (Datum/Termin → Kalender, Essen → Essensplan, Wetter → eigener Wetter-Tab); das More-Info-Popup der eingebetteten Karte wird unterdrückt.
- **`fp-cookbook-card`** — Kochbuch mit Rezepten (Zutaten, Schritt-für-Schritt-Anleitung, Portionen-Slider, Sterne-Bewertung, **Zubereitungszeit**), gespeichert in einer lokalen To-do-Liste. Die Übersicht ist ruhig gehalten: **Bildkacheln** mit Name, Zeit und kcal, Suche und Hinweise als Pillen im Kopf, Filter als wischbare Chips; Tags, Bewertung und Nährwerte stehen auf der Rezeptseite. **Bilder zu den Rezepten** in den Kacheln und auf der Rezeptseite: eigenes Foto hochladen (verkleinert in den HA-Medienordner, Admin-Konto nötig), freie Fotos über Openverse suchen (Creative Commons, der Fotografen-Hinweis wird mitgespeichert), KI-Bild (nur wenn das `ai_task` Bilder erzeugen kann) oder Bildadresse. **KI-Rezept** aus Name/Text und **KI-Vorschlag „überrasch mich"** ohne Eingabe (berücksichtigt Jahreszeit + Wetter, erzwingt Abwechslung, meidet zuletzt Vorgeschlagenes → keine Monotonie). Rezepte lassen sich **vollständig bearbeiten** (Name, Mahlzeit, Tags, Portionen, Zeiten, **Nährwerte**, Zutaten, Schritte). **Kalorien und Eiweiß je Portion** werden mitgeschätzt und auf der Rezeptseite angezeigt (auf der Kachel steht nur kcal); für Altbestand gibt es im Kopf kleine Pillen zum Nachrechnen von Zeiten und Nährwerten. Die Filter „schnell" und „proteinreich" werden aus Gesamtzeit bzw. Eiweißwert **berechnet** statt geraten. Mit `import_service` erscheint im „＋ Neu"-Dialog ein **Link-Feld**: Rezeptseiten werden aus ihrem JSON-LD ausgelesen, Videos vom Import-Dienst angeschaut. „In Plan legen" schreibt in den Essensplan-Kalender; „Zutaten → Einkauf" öffnet ein Auswahl-Popup und legt nur die angehakten (auf die Portionen skalierten) Zutaten auf die Einkaufsliste; steht dieselbe Zutat dort schon offen, wird die Menge addiert statt eine zweite Zeile anzulegen (g/kg und ml/l werden umgerechnet, die Menge darf im Titel oder in der Beschreibung stehen).
- **`dobby-clock-card`** — **Schachuhr, die hochzählt.** Für Versteckspiele zu zweit: wer den Gegenstand versteckt hat, dessen Uhr läuft. Eine Wippe als Tastenpaar oben auf dem Gehäuse, die laufende Taste steht oben; darunter zwei Anzeigen. Die Rundenzeit wechselt die Einheit mit ihrer Länge (Minuten → Stunden → Tage → Wochen → Monate), darunter der Gesamtstand. Dazu eine **Bestenliste** mit den drei längsten Verstecken samt Zeitraum. Der Stand liegt in Helfern und übersteht Neustarts; die Uhr tickt nur im Browser, damit kein Sensor im Sekundentakt die Datenbank füllt.
- **`fp-feeding-card`** — **Stillprotokoll** je Kind: Start/Stopp mit laufender Uhr, Seitenvorschlag, Fläschchen in ml, Nachtragen, Tabelle für heute und gestern mit Tagessummen. Groß die **Zeit seit der letzten Mahlzeit** mit Balken bis zur Erinnerung, aufklappbar ein **Rückblick über 7 Tage** (Mahlzeiten, Stillzeit, Ø Abstand, Fläschchen) und ein **Bericht** der letzten 7 Tage zum Drucken oder als PDF, auf Wunsch mit Windeln und Gewicht.
- **`fp-weight-card`** — **Gewichtsverlauf** mehrerer Kinder auf einer Zeitachse, Eintragen per Dialog, Punkt antippen zum Bearbeiten. Optional mit **Perzentilkurven** aus einer eigenen Datendatei, auch für Frühgeborene nach korrigiertem Alter.
- **`fp-diaper-card`** — **Windelprotokoll** je Kind: nass, voll oder beides per Tipp, Zeit seit der letzten Windel und dem letzten Stuhl, heute und gestern mit Summen, Rückblick über 7 Tage.
- **`fp-milestone-card`** — **Meilensteine** je Kind zum Abhaken: **Erste Male** als Sticker-Album (erstes Lachen, erster Zahn, erste Schritte, erster Schnee …), **Entwicklung** nach Alter mit den Punkten, die gerade dran sind, und **Bewegung** mit den Zeitfenstern der WHO. Abhaken ist ein kleines Fest: Konfetti, ein Jubel-Dialog, Datum und Notiz, auch nachträglich und für Geschwister auf einmal. Eigene Momente lassen sich dazulegen. Frühgeborene nach korrigiertem Alter.
- **`fp-baby-overview-card`** — **Übersicht** je Kind im Stil der App Buma, gespeist aus den Kalendern von Still-, Windel-, Gewichts- und Meilensteinkarte und einem eigenen Schlafkalender. **Heute:** Schlafknöpfe („Beide schlafen“ und je Kind), farbige Schnellknöpfe für Stillen, Windel und Fläschchen, die Karte **„Nächste Mahlzeit“** mit Zeitfenster, **„Jetzt“** als Liste mit farbigen Symbolen (Zeit seit dem letzten Mal, Ausblick auf den nächsten Schlaf, „Fällig“), **„Tag“** mit Streifen und den Zahlen als Textzeile, Chips für Wachstum und Momente und die Einträge, mit ‹ › durch die letzten Wochen blättern. Am Handy steht unten eine Aktionsleiste mit Schlaf, Stillen, Windel und Fläschchen. **Protokoll:** Still- und Windelkarte je Kind direkt in der Übersicht, mit Bearbeiten, Rückblick und Bericht. **Muster:** Zusammenfassung, Filter, Tagesschnitt und eine Zeile je Tag. **Wachstum:** aktuelles Gewicht mit Zunahme und Perzentile, Kurve nach Alter mit Perzentilbändern, Messungen, Wiegen direkt in der Karte. **Momente:** die Meilensteinkarte direkt in der Übersicht, ohne eigenen Tab. ✦ öffnet **„Frag nach“**: eine KI (`ai_task`) beantwortet Fragen zu allen Einträgen und sucht Muster. Folgt dem hellen oder dunklen Modus des Geräts, Farben aus dem Theme; Zwillinge am Tablet nebeneinander, am Handy per Schalter im Kopf oder Wischen zum Umschalten.

## Installation (HACS)

1. HACS → drei Punkte oben rechts → **Custom repositories**.
2. URL dieses Repos einfügen, Kategorie **Dashboard** wählen, **Add**.
3. „Family Planner Cards" in HACS suchen und **herunterladen**.
4. Browser-Cache leeren / hart neu laden.

## Karten-Typen

- `custom:meal-grid-card`
- `custom:family-calendar-card`
- `custom:kids-routine-card`
- `custom:shopping-fav-card`
- `custom:nav-card`
- `custom:fp-todo-card`
- `custom:fp-glance-card`
- `custom:fp-cookbook-card`
- `custom:dobby-clock-card`
- `custom:fp-feeding-card`
- `custom:fp-weight-card`
- `custom:fp-diaper-card`
- `custom:fp-milestone-card`
- `custom:fp-baby-overview-card`

### Beispiel: meal-grid-card

```yaml
type: custom:meal-grid-card
entity: calendar.essensplan
mode: week            # oder "compact" (heute + morgen, ignoriert layout)
layout: list          # "list" (Liste nach Tagen, Vorgabe), "today" (Heute groß, Woche kurz) oder "grid" (Tabelle)
days_ahead: 4         # nur für "today": so viele Tage nach heute stehen in der kurzen Liste (0 bis 13)
title: Wochenplan
ai_entity: ai_task.google_ai_task
background: "https://example.com/bild.jpg"
hide_header: false    # true = ohne Kopf und Wochennavigation (für die Übersicht)
meal_labels: true     # false = ohne Bezeichnung (Liste: nur der Punkt, Tabelle: nur das Symbol)
empty_text: "+"       # was bei einer leeren Mahlzeit steht
meals:
  - { label: "Frühstück", start: 0, end: 11 }
  - { label: "Mittag", start: 11, end: 15 }
  - { label: "Abend", start: 15, end: 24 }
```

Für die Startseite eignet sich „Heute groß, Woche kurz":

```yaml
type: custom:meal-grid-card
entity: calendar.essensplan
layout: today
days_ahead: 4         # die nächsten 4 Tage nach heute
```

Oben steht der Kopf „Essen heute" mit dem Datum als kleiner Pille (ein eigener `title` ersetzt den Text, `hide_header: true` blendet ihn aus). Darunter folgen die Mahlzeiten von heute nebeneinander, am sehr schmalen Handy untereinander, und der Abschnitt „Nächste Tage" mit allem Geplanten je Tag: rechts vom Wochentag stehen alle eingetragenen Mahlzeiten nebeneinander (bei Platzmangel umbrechend, jede mit ihrem Punkt), ein Tag ohne Eintrag zeigt „noch nichts geplant"; die Tage dürfen in die nächste Woche reichen. Jede Mahlzeit lässt sich antippen und bearbeiten, mit `nav_path` führt ein Tipp stattdessen zur angegebenen Seite.

In der Liste und in der Tabelle blättert die Pille ‹ 13.–19. Okt › durch die Wochen; ist es nicht die aktuelle Woche, springt „Heute" zurück. „✨ Woche füllen" und „Leeren" stehen mit `ai_suggest` im Kopf. Mit `hide_header: true` bleiben sie als schmale Reihe stehen. Die Punktfarben kommen aus dem Theme (`fp-meal0` bis `fp-meal2`, ab der vierten Mahlzeit wie die dritte), das Feld der Tabelle weiter aus `fp-meal0-bg` bis `fp-meal2-bg`.

### Beispiel: family-calendar-card

```yaml
type: custom:family-calendar-card
title: Familienkalender
initial_view: week    # "day", "week", "month" oder "agenda"
week_grid: false      # true: Woche als Stunden-Raster statt Terminkacheln
days: 4               # nur fuer "agenda": 1 bis 14 Tage nebeneinander
hide_header: false    # Kopf mit Titel, Ansichten und Datum ausblenden
hide_legend: false    # Personenfilter ausblenden
day_start: 6
day_end: 23
persons:
  - { name: Familie, color: "#E53935", calendar: calendar.familie, match: none }
  - { name: Person A, color: "#1E88E5", calendar: calendar.familie, prefix: "A" }
  - { name: Person B, color: "#8E24AA", calendar: calendar.familie, prefix: "B" }
  - { name: Kind A, color: "#43A047", calendar: calendar.kind_a, entity: person.kind_a }  # entity oder picture: Foto statt Initiale
  - { name: Feiertage, color: "#78909C", calendar: calendar.feiertage, no_create: true }  # nur lesen, als Zeile über den Terminen
```

Tag und Woche passen sich der Kartenbreite an: unter 560 px die Handy-Liste, darüber Spalten. Passen die Spalten nicht nebeneinander, brechen sie in eine zweite Zeile um, statt seitlich zu scrollen. Ein Tipp auf eine freie Fläche legt dort einen Termin an.

Der Kopf ist schlicht: links der Titel, daneben die Ansichten als Schalter und das Datum als Pille (‹ 12.–18. Okt ›, in der Tagesansicht „Mi, 14. Okt“). „Heute“ erscheint nur, wenn nicht der aktuelle Tag, die aktuelle Woche oder der aktuelle Monat gezeigt wird. „+ Termin“ steht rechts; auf schmalen Karten stehen Titel und „+ Termin“ oben, darunter Datum und Ansichten. Die Personenfilter sind kleine Chips mit Punkt in der Personenfarbe: In Tag und Woche sind „Alle“ bzw. die gewählten Personen gefüllt, in Monat, Agenda und Stunden-Raster blendet ein Tipp die Person aus (der Chip wird blass). Farben und Flächen kommen aus dem Theme (`fp-accent`, `fp-surface` …); die Terminkacheln behalten die Personenfarbe.

### Beispiel: shopping-fav-card

```yaml
type: custom:shopping-fav-card
list_entity: todo.zuhause            # To-do-Liste, auf die getippte Favoriten wandern
store_entity: input_text.einkauf_favoriten   # Helper, der die Favoriten speichert
columns: 3
```

Der Helper `input_text.einkauf_favoriten` muss vorab angelegt sein (max. 255 Zeichen). Favoriten werden als kommagetrennte Liste gespeichert; der Knopf „✏️ Bearbeiten" im Kopf der Karte öffnet einen Editor.

Die Favoriten erscheinen als **gleich breite Chips** in höchstens `columns` Spalten (auf schmalen Karten weniger, mindestens ca. 96 px breit), das Emoji steht über dem Namen. Steht ein Favorit **schon offen auf der Liste** `list_entity`, ist sein Chip mit ✓ und Akzentrand markiert, und ein Tipp darauf legt ihn **nicht doppelt** an, sondern zeigt nur einen Hinweis. Dazu liest die Karte die Liste live; Mengenangaben wie „200 g Butter" zählen für „Butter". Die Markierung gibt es nur ohne `assign` (dort wählt der Dialog das Ziel); schlägt das Lesen der Liste fehl, bleibt die Karte einfach ohne Markierung. Im „Hinzufügen"-Dialog zeigen die Favoriten dieselbe Markierung, solange das gewählte Ziel `list_entity` ist.

Optional mit Zuweisungs-Dialog (Tipp öffnet „Wer? / Bis wann?"):

```yaml
type: custom:shopping-fav-card
list_entity: todo.haushalt
store_entity: input_text.aufgaben_favoriten
columns: 4
big: true
assign: true                 # Tipp öffnet Dialog statt direktem Hinzufügen
default_target: todo.haushalt # Ziel bei OK ohne Auswahl
fallback: "📋"               # Emoji für unbekannte Einträge
targets:
  - { label: Gemeinsam, entity: todo.haushalt }
  - { label: Person A, entity: todo.person_a }
  - { label: Person B, entity: todo.person_b }
```

Optional **Serienaufgaben**. Home Assistant reicht bei `todo.add_item` kein Wiederholungsmuster durch, deshalb legt die Karte solche Aufgaben direkt über die Todoist-Schnittstelle an — dafür braucht jedes Ziel eine `project_id` und es muss ein passender `rest_command` existieren:

```yaml
show_favorites: true          # Favoriten UND Hinzufügen-Knopf zeigen
add_button: true
repeat_options:
  - { label: "wöchentlich",   due_string: "every! week" }
  - { label: "alle 6 Monate", due_string: "every! 6 months" }
todoist_service: rest_command.todoist_add_task
targets:
  - { label: Person A, entity: todo.person_a, project_id: "PROJEKT-ID" }
```

Zusätzlich zu den Voreinstellungen erscheint **„Eigene …"** für freie Intervalle wie „alle 2 Wochen". Das Rufzeichen in `every!` ist entscheidend: damit rechnet Todoist ab dem **Erledigungsdatum** statt ab der Fälligkeit — bei Haushaltsaufgaben fast immer das Gewollte.

### Beispiel: nav-card

```yaml
type: custom:nav-card
path: /lovelace/einkauf      # Ziel-Tab beim Tippen auf nicht-interaktive Bereiche
card:
  type: todo-list
  entity: todo.zuhause
```

### Beispiel: fp-todo-card

Die Karte zeichnet ihre Liste **selbst** (nicht mehr die native `todo-list`-Karte) und holt sie live aus der To-do-Entität. Kopf: links die Namens-Pille (oder der `title`), rechts die Zahl der offenen Aufgaben. Darunter steht jede Aufgabe als Kachel mit einem großen Kreis zum Abhaken, dem Text und, wenn es ein Datum gibt, einem Chip: „gestern", „seit Mo", „heute 14:00", „morgen", „Fr", „24.10.". Überfälliges ist rot, Heutiges gelb hinterlegt.

```yaml
type: custom:fp-todo-card
entity: todo.allgemein
pill: { label: Person A, color: "#D99A0B" }   # Namens-Pille im Kopf, eine Farbe je Person
# title: Allgemein        # ohne pill: fette Überschrift
empty_text: Alles erledigt  # Hinweis bei leerer Liste (Vorgabe)
hide_completed: true      # Vorgabe; false zeigt Erledigtes unten unter „Erledigt"
show_description: true    # Vorgabe; zeigt die Beschreibung als kleine zweite Zeile (false = ohne)
hide_create: true         # true blendet die Eingabezeile „Neue Aufgabe" aus
display_order: duedate_asc  # duedate_asc | alpha_asc | sonst Reihenfolge der Liste
due_date_period:            # optional: nur bald Fälliges zeigen
  calendar:
    period: day             # day | week | month | year
    offset: 4               # 0 = aktuelle Periode
edit_dialog: true           # optional: Tipp auf den Text öffnet den eigenen Änderungsdialog
edit_targets:               # Ziele zum Verschieben (project_id nur für Todoist)
  - { label: Allgemein, entity: todo.allgemein, project_id: "PROJEKT-ID" }
  - { label: Person A,  entity: todo.person_a,  project_id: "PROJEKT-ID" }
repeat_options:             # optional, nur mit project_id wirksam
  - { label: "alle 6 Monate", due_string: "every! 6 months" }
                            # „Eigene …" (freies Intervall) kommt automatisch dazu
todoist_service: rest_command.todoist_add_task
```

- **Gruppen:** Mit `display_order: duedate_asc` erscheinen die Abschnitte **Überfällig**, **Heute**, **Demnächst** und **Ohne Datum**, jeweils nach Datum aufsteigend; leere Abschnitte fallen weg. `alpha_asc` sortiert alphabetisch ohne Abschnitte, ohne `display_order` bleibt die Reihenfolge der Liste.
- **Beschreibung:** Mit `show_description` (Vorgabe `true`) steht die Beschreibung einer Aufgabe als kleine zweite Zeile unter dem Text, höchstens zwei Zeilen lang. Bei Einkaufslisten (z. B. Bring) steckt dort die Info zum Artikel wie „Natur, 450 g". Für Listen mit internen Notizen, etwa Sync-Markierungen, setzt man `show_description: false`.
- **Abhaken:** Ein Tipp auf den Kreis erledigt die Aufgabe sofort und zeigt kurz „Rückgängig". Mit `hide_completed: false` bringt ein Tipp auf den gefüllten Kreis eine erledigte Aufgabe zurück.
- **Personenfarbe:** `pill: { label, color }` genügt: Hintergrund und Schrift der Pille werden aus der einen Farbe gemischt und passen so zu hellem und dunklem Theme. Die alte Form `{ label, bg, color }` bleibt gültig, wenn `bg` und `color` beide gesetzt sind; dann gelten genau diese beiden Werte. Ohne Farbe bleibt die Pille neutral.
- **`due_date_period`:** `week` läuft von Montag bis Sonntag, `offset: 0` ist der aktuelle Zeitraum. Gezeigt werden nur offene Aufgaben, die bis zum Ende des Zeitraums fällig sind (Überfälliges eingeschlossen); Aufgaben ohne Fälligkeitsdatum fallen dabei weg. `period: day, offset: 4` ist praktisch für kompakte Übersichtsseiten.
- **Neu anlegen:** Die Eingabezeile „Neue Aufgabe" (Enter oder ＋) zeigt den Eintrag sofort leicht ausgegraut; er wird ersetzt, sobald das Backend nachzieht (spätestens nach 20 Sekunden). Dasselbe gilt für Aufgaben, die die `shopping-fav-card` über das Event `fp-todo-add` anlegt.
- **Nicht mehr dabei:** Weil die Karte nicht mehr die native Liste einbettet, greifen `card_mod`-Regeln für deren Innereien nicht mehr, auch `hide_section_headers` hat keine Wirkung. Ziehen zum Umsortieren gibt es nicht.

### Beispiel: fp-glance-card

```yaml
type: custom:fp-glance-card
name: Familie
weather_entity: weather.home
sun_entity: sun.sun
essensplan_entity: calendar.essensplan
calendar_path: /familien-planer/kalender   # Klick auf Datum + nächsten Termin
meals_path: /familien-planer/essensplan     # Klick auf Abendessen
weather_path: /familien-planer/wetter       # Klick aufs Wetter
persons:
  - { name: Familie, color: "#E53935", calendar: calendar.familie, match: none }
  - { name: Person A, color: "#FBC02D", calendar: calendar.familie, prefix: "A" }
  - { name: Person B, color: "#1E88E5", calendar: calendar.familie, prefix: "B" }
  - { name: Kind A, color: "#43A047", calendar: calendar.kind_a }
backgrounds:                                # optional, sonst Theme bzw. Blauverlauf
  morning: /local/glance/morning.jpg
  day: /local/glance/day.jpg
  evening: /local/glance/evening.jpg
  night: /local/glance/night.jpg
```

Ohne `backgrounds` nimmt die Karte Hintergrund, Schrift, Rand und Schatten aus den Theme-Variablen `--fp-glance-*` (siehe „Design-Variablen“), ohne diese die bisherigen Blauverläufe mit weißer Schrift. Das Wetter kann über `weather_card` mit einer vollständigen `clock-weather-card`-Config überschrieben werden; ansonsten wird eine sinnvolle Default-Config verwendet. Benötigt die HACS-Karte `clock-weather-card`.

### Beispiel: fp-cookbook-card

```yaml
type: custom:fp-cookbook-card
entity: todo.kochbuch                  # lokale To-do-Liste als Rezept-Speicher
essensplan_entity: calendar.essensplan  # Ziel für „In Plan legen"
shopping_entity: todo.zuhause           # Ziel für „Zutaten → Einkauf"
ai_entity: ai_task.google_ai_task       # für KI-Rezept + KI-Vorschlag
weather_entity: weather.home            # optional, für Saison-/Wetterbezug
base_portions: 2
quick_max_min: 20                       # bis hierher gilt ein Gericht als „schnell"
protein_min_g: 25                       # ab hier gilt eine Portion als „proteinreich"
import_service: rest_command.kochbuch_import   # optional: Link-Feld im „＋ Neu"-Dialog
image_folder: kochbuch                  # Unterordner im HA-Medienordner für eigene Fotos
style: "viel vegetarisch, bunt gemischt, proteinreich, schnell zu kochen"
```

Die Übersicht zeigt ruhige Bildkacheln: das Foto, darunter der Name und eine Zeile mit Zeit und kcal (z. B. „55 Min · 520 kcal“). Tags, Bewertung und Nährwerte stehen auf der Rezeptseite. Im Kopf sitzen links der Titel, daneben die Suche als Pille und rechts „＋ Neu“; fehlen bei Rezepten Zeiten oder Nährwerte, erscheinen dort kleine Pillen zum Nachrechnen. Die Filter laufen als eine waagrecht wischbare Chip-Zeile darunter.

### Beispiel: dobby-clock-card

```yaml
type: custom:dobby-clock-card
select: input_select.dobby_versteckt_von     # Optionen: die beiden Namen + „Pause"
since: input_datetime.dobby_letzter_wechsel  # Beginn der laufenden Runde (Datum + Zeit)
players:
  - name: Person A
    total: input_number.dobby_gesamtzeit_person_a
  - name: Person B
    total: input_number.dobby_gesamtzeit_person_b
highscore: input_text.dobby_highscore        # leer lassen blendet die Bestenliste aus
highscore_label: Beste Verstecke
pause_label: Pause
idle_text: Niemand versteckt gerade etwas
```

Die Bestenliste steht kompakt in einem einzigen `input_text`: `Name~Sekunden~Startzeit`, Einträge durch `|` getrennt. Drei Stück brauchen rund 75 der 255 erlaubten Zeichen; das Enddatum rechnet die Karte aus Start plus Dauer. Die Automation sortiert jede abgeschlossene Runde ein und behält die drei längsten.

Dazu eine Automation am `input_select`, die beim Wechsel die verstrichene Zeit dem **vorherigen** Verstecker gutschreibt und den Zeitstempel neu setzt — dort steht die Wahrheit, die Karte rechnet nur für die Anzeige.

> **Falle beim Anlegen:** ein frisches `input_datetime` steht auf *heute 00:00:00*, nicht auf null, und ein frisches `input_select` auf seiner ersten Option. Ohne Deckelung bekommt der erste Verstecker den halben Tag geschenkt. Die Gutschrift auf `min(seit Zeitstempel, seit dem letzten Zustandswechsel)` begrenzen.

### Beispiel: fp-feeding-card

```yaml
type: custom:fp-feeding-card
name: Kind A
calendar: calendar.stillprotokoll_kind_a     # Local Calendar, ein Termin pro Mahlzeit
switch: input_boolean.stillen_kind_a         # an = wird gerade gestillt
side: input_select.stillen_kind_a_seite     # links / rechts, vorgeschlagene nächste Seite
start: input_datetime.stillen_kind_a_beginn # Beginn der laufenden Mahlzeit
color: "#4A7A3A"
auto_minutes: 60                           # Markierung für automatisch beendete Mahlzeiten
bottle_presets: [40, 60, 90, 120]          # ml-Schnellwahl, die erste ist vorausgewählt
reminder_hours: 3                          # Balken „seit der letzten Mahlzeit" bis zu dieser Marke
reminder_entity: input_number.stillen_erinnerung_tagsuber        # optional, Stunden, überschreibt reminder_hours
reminder_night_entity: input_number.stillen_erinnerung_nachts    # optional, Stunden für nachts (night_start 22 bis night_end 6)
meal_pause_minutes: 45                     # höchstens so viel Pause zwischen zwei Einträgen derselben Mahlzeit
meal_pause_entity: input_number.stillen_pause_bis_neue_mahlzeit  # optional, Minuten, überschreibt meal_pause_minutes
bottle_minutes: 15                         # Fläschchen werden nach dem Trinken eingetragen: so viel früher war ihr Beginn
diaper_calendar: calendar.windeln_kind_a   # optional, nur für den Bericht (Kalender der fp-diaper-card)
weight_calendar: calendar.gewicht_zwillinge # optional, nur für den Bericht (Kalender der fp-weight-card)
weight_key: kind_a                         # Schlüssel dieses Kinds in der fp-weight-card
```

Tabelle Stillbeginn – Stillende – Stilldauer – Fläschchen für heute und gestern, mit Tagessummen. Der Knopf schaltet nur den Schalter; eine Automation schreibt beim Ausschalten den Kalendertermin und schaltet die Seite weiter. Dadurch funktioniert Starten und Stoppen per Sprachassistent genauso. Fläschchen schreibt die Karte direkt als eigene Zeile (`Fläschchen N ml`).

Über der Tabelle steht groß die Zeit seit **Beginn** der letzten Mahlzeit, darunter ein Balken bis `reminder_hours` (gelb kurz davor, rot danach). Eine Mahlzeit umfasst alle Einträge, zwischen denen höchstens `meal_pause_minutes` Pause liegen (vom Ende des einen bis zum Beginn des nächsten). So bleibt auch eine Fütterung über eine Stunde mit Stillen, Fläschchen und nochmal Stillen eine Mahlzeit. Gezählt wird ab ihrem Beginn, von Beginn zu Beginn, wie Hebammen zählen. Mit `reminder_entity`/`reminder_night_entity` gilt tagsüber und nachts eine eigene Grenze. Fläschchen tragen die Uhrzeit, zu der sie fertig waren („Fertig um“); ihr Beginn wird `bottle_minutes` früher geschätzt. Beginnt eine Mahlzeit mit einem Fläschchen, steht „ca.“ vor der Uhrzeit. „Letzte 7 Tage" klappt einen Rückblick auf, „🖨 Bericht" öffnet eine druckfertige Seite mit Übersicht, Gewichten, Windeln und allen Einträgen; „Als PDF sichern" bietet der Druckdialog an.

### Beispiel: fp-weight-card

```yaml
type: custom:fp-weight-card
title: Gewicht
calendar: calendar.gewicht_zwillinge     # Local Calendar, ein Ganztagstermin pro Messung
kids:
  - { key: kind_a, name: Kind A, color: "#4A7A3A" }
  - { key: kind_b, name: Kind B, color: "#7A4A78" }
```

Gewichtsverlauf mehrerer Kinder auf einer gemeinsamen Zeitachse. „＋ Eintragen“ öffnet einen Dialog mit Kind, Datum und Gewicht (Gramm oder Kilo). Ein Tipp auf einen Punkt öffnet Bearbeiten oder Löschen. Pro Kind und Tag wird höchstens ein Wert gespeichert.

**Perzentilkurven (optional).** Mit `growth_data` und je Kind Geburtsdatum, Gestationsalter und Geschlecht zeichnet die Karte die Bänder P3–P97 und P10–P90 sowie P50 und zeigt neben dem letzten Wert die ungefähre Perzentile. Kinder mit gleichen Angaben (Zwillinge) teilen sich eine Kurvenschar.

```yaml
growth_data: /local/fp-growth-data.json
kids:
  - { key: kind_a, name: Kind A, color: "#4A7A3A", birth: "2026-01-15", ga: "34+5", sex: m }
```

Die Referenzdaten sind **nicht Teil dieses Repos**, weil sie eigenen Lizenzen unterliegen. Die JSON-Datei baut man sich aus den öffentlichen Tabellen selbst:

```json
{
  "who":     { "m": { "w": [[Woche, L, M, S], ...], "mo": [[Monat, L, M, S], ...] }, "f": { ... } },
  "preterm": { "m": [[Woche, P3, P10, P50, P90, P97], ...], "f": [ ... ] }
}
```

- `who`: WHO Child Growth Standards, Gewicht nach Alter, L/M/S-Werte je Woche (0–13) und je Monat (0–60). Gilt ab dem errechneten Termin nach korrigiertem Alter.
- `preterm` (optional): Gewicht in kg je Woche ab Beginn der Schwangerschaft, etwa aus den INTERGROWTH-21st-Standards für Frühgeborene (27–64 Wochen). Solange ein Kind in diesem Bereich liegt, gelten diese Werte, danach WHO.

### Beispiel: fp-diaper-card

```yaml
type: custom:fp-diaper-card
name: Kind A
calendar: calendar.windeln_kind_a   # Local Calendar, ein kurzer Termin pro Windel
color: "#4A7A3A"
```

Drei Knöpfe (nass, voll, beides) tragen sofort ein; ein Doppeltipp erzeugt keinen zweiten Eintrag. Darunter die Zeit seit der letzten Windel und dem letzten Stuhl, die Einträge von heute und gestern mit Summen (antippen zum Ändern oder Löschen) und aufklappbar die letzten 7 Tage. „Beides" zählt bei nass und bei voll mit. Einen eigenen Kalender verwenden, nicht den des Stillprotokolls, sonst zählt eine Erinnerung „seit der letzten Mahlzeit" auch Windeln mit.

Die To-do-Liste `todo.kochbuch` muss vorab über die Integration **Local To-do** angelegt sein. Jedes Gericht wird als ein Listeneintrag gespeichert (Name = Titel, Rezeptdaten als JSON in der Beschreibung). KI-Funktionen benötigen eine eingerichtete `ai_task`-Entity (z. B. Google Generative AI). Am besten als **Panel-View** einbinden.

### Beispiel: fp-milestone-card

```yaml
type: custom:fp-milestone-card
title: Meilensteine
calendar: calendar.meilensteine     # Local Calendar, ein Ganztagstermin je Meilenstein und Kind
kids:                               # gleiche Angaben wie bei der fp-weight-card
  - { key: kind_a, name: Kind A, color: "#4A7A3A", birth: "2026-01-15", ga: "34+5" }
  - { key: kind_b, name: Kind B, color: "#7A4A78", birth: "2026-01-15", ga: "34+5" }
sections: [firsts, development, motor]   # optional: welche Bereiche, in welcher Reihenfolge
```

Den Kalender vorab über die Integration **Local Calendar** anlegen (z. B. „Meilensteine“). Ein erreichter Meilenstein ist ein Ganztagstermin an dem Tag, an dem es passiert ist, etwa „🐢 Kind A: Krabbelt“. Wer den Kalender zusätzlich in der `family-calendar-card` einblendet, sieht die Meilensteine dort auch. Andere Termine im selben Kalender werden übersprungen.

- **✨ Erste Male:** Gesammelte Momente werden zu Stickern in der Farbe des Kinds, mit dem Alter von damals. Offene Plätze sind gestrichelt. „＋ Eigener Moment“ legt eigene Erinnerungen mit Symbol und Titel dazu.
- **🌱 Entwicklung:** Die Punkte aus den Checklisten der CDC (2022) für 2, 4, 6, 9, 12, 15 und 18 Monate und 2 Jahre, nach Gefühlen, Sprache, Entdecken und Bewegung. Jeden Punkt schaffen mindestens drei von vier Kindern bis zu diesem Alter. Die Stufe, die gerade dran ist, ist vorausgewählt und mit „jetzt“ markiert.
- **👣 Bewegung:** Die sechs Meilensteine der WHO-Motorikstudie mit ihrem Zeitfenster (1. bis 99. Perzentil), dazu ein Punkt je Kind, wann es so weit war, und eine Linie bei heute.

Ein Tipp auf einen offenen Meilenstein öffnet den Jubel-Dialog: Datum (heute, gestern oder frei), „Datum nur ungefähr“, eine Notiz und bei Geschwistern „Auch für … festhalten“ (bei Erlebnissen schon angehakt). „Festhalten“ zeigt Konfetti und lässt den Sticker hüpfen. Ein Tipp auf etwas Abgehaktes öffnet die Erinnerung zum Ändern. Derselbe Meilenstein in mehreren Bereichen wird nur einmal abgehakt: „Sitzt allein“ zählt auch für „Sitzt ohne Hilfe“ und das WHO-Fenster.

Mit `birth` zeigt die Karte das Alter. Mit `ga` (Schwangerschaftswoche bei der Geburt, z. B. `34+5`) rechnen „jetzt“ und die WHO-Fenster bei Kindern, die mindestens drei Wochen zu früh kamen, nach korrigiertem Alter.

### Beispiel: fp-baby-overview-card

```yaml
type: custom:fp-baby-overview-card
weight_calendar: calendar.gewicht_zwillinge   # optional: Kalender der fp-weight-card
milestone_calendar: calendar.meilensteine     # optional: Kalender der fp-milestone-card
ai_entity: ai_task.google_ai_task             # für „Frag nach“; leer = die in HA voreingestellte KI
growth_data: /local/fp-growth-data.json       # optional: Perzentilkurven wie bei der fp-weight-card
reminder_entity: input_number.stillen_erinnerung_tagsuber         # optional: Stunden bis „Fällig“ tagsüber, derselbe Helfer wie Stillkarte und Automation
reminder_night_entity: input_number.stillen_erinnerung_nachts     # optional: dasselbe nachts (22–6 Uhr)
meal_pause_entity: input_number.stillen_pause_bis_neue_mahlzeit   # optional: Minuten Pause, bis ein Eintrag zu einer neuen Mahlzeit zählt
kids:
  - key: kind_a                     # wie in Gewichts- und Meilensteinkarte (sonst weight_key / milestone_key)
    name: Kind A
    color: "#4A7A3A"
    birth: "2026-01-15"
    ga: "34+5"
    sex: m                          # für die Perzentilkurven (m oder f)
    picture: /local/kind_a.jpg      # optional: Foto im Kopf (oder entity: person.kind_a)
    feeding_calendar: calendar.stillprotokoll_kind_a   # wie bei der fp-feeding-card
    switch: input_boolean.stillen_kind_a
    side: input_select.stillen_kind_a_seite
    start: input_datetime.stillen_kind_a_beginn
    diaper_calendar: calendar.windeln_kind_a           # wie bei der fp-diaper-card
    sleep_calendar: calendar.schlaf_kind_a             # optional: Schlaf, ein Termin je Schlafphase
    sleep_switch: input_boolean.schlafen_kind_a
    sleep_start: input_datetime.schlafen_kind_a_beginn
  - key: kind_b
    name: Kind B
    color: "#7A4A78"
    # … gleich wie oben
```

Beim Öffnen des Tabs steht die Karte immer auf „Heute“ am heutigen Tag; das gewählte Kind bleibt.

Für den Schlaf je Kind ein `input_boolean` (an = schläft), ein `input_datetime` mit Datum und Uhrzeit für den Beginn und einen Local Calendar anlegen. Eine Automation stempelt beim Einschalten den Beginn und schreibt beim Ausschalten den Termin `Schlaf` mit der Beschreibung `{"typ":"schlaf","auto":false}`; Phasen unter einer Minute verwirft sie. Startet das Stillen, während das Kind schläft, schaltet sie den Schlaf aus: wer gestillt wird, ist wach. Eine zweite Automation beendet einen vergessenen Schlaf nach 12 Stunden, der Termin wird dann gekappt und mit `"auto":true` markiert. Der Schlafkalender ist bewusst ein eigener: Eine Erinnerung, die jeden Eintrag im Stillkalender als Mahlzeit zählt, bliebe sonst stumm.

Jeder Eintrag in „Einträge“ lässt sich antippen, ändern und löschen (im Format der Still- und Windelkarte); nach den Schnelleinträgen (Windel, Fläschchen, Start von Stillen und Schlaf) bietet Home Assistant 8 Sekunden lang „Rückgängig“ an. „＋ Nachtragen“ im Kopf der Einträge trägt Stillen, Fläschchen, Windel oder Schlaf für Heute oder Gestern nach. ⚙ im Kopf (nur sichtbar, wenn `reminder_entity`, `reminder_night_entity` oder `meal_pause_entity` gesetzt ist) stellt Erinnerung und Pause direkt am Helfer ein.

Weitere Optionen: `chat: false` blendet ✦ aus, `days` (Vorgabe 14) legt fest, wie viele Tage die KI bekommt, `bottle_presets` (Vorgabe 40/60/90/120) sind die Mengen im Fläschchen-Blatt, `reminder_hours`, `meal_pause_minutes` und `bottle_minutes` wirken wie bei der Stillkarte (`reminder_hours` auch je Kind), `night_start` und `night_end` (Vorgabe 22 und 6) legen die Nacht für `reminder_night_entity` fest.

Die Karte folgt dem hellen bzw. dunklen Modus des Geräts und nimmt ihre Farben, Ecken und den Kopfverlauf aus den Theme-Variablen `--fp-*` (Flächen, Farben je Tätigkeit, „Fällig“, Radien, Kopfverlauf); ohne diese Zeilen im Theme gelten Rückfallwerte.

Die Karte liest, was die anderen Karten schreiben, und braucht keine eigenen Helfer. Selbst schreibt sie Windeln, Fläschchen, Gewichte sowie nachgetragenes oder geändertes Stillen im Format jener Karten und schaltet den Still-Schalter wie die Stillkarte; den Termin legt weiterhin die Protokoll-Automation an. Genauso beim Schlaf: Die Knöpfe schalten nur `sleep_switch`, den Termin schreibt eine Automation (siehe unten). Fehlt ein Kalender in der Konfiguration, fällt der passende Teil einfach weg. Am besten als eigener Tab in einer **Panel-View**.

- **Kopf:** Foto oder Initiale, Name, Alter („8 Mon. 28 T. · korr. 7 Mon.“). Bei mehreren Kindern steht im Kopf ein Schalter mit einem großen Knopf je Kind (Foto, Name, Alter), der gewählte in der Kinderfarbe; am Handy wechselt auch ein waagrechtes Wischen über dem Inhalt das Kind, am Tablet stehen alle nebeneinander. Rechts ✦ für „Frag nach“, darunter ‹ Heute › zum Blättern.
- **Schnellknöpfe:** Am Tablet stehen sie in der Spalte je Kind. Stillen startet und stoppt (läuft es, heißt der Knopf „■ Stopp“; die laufende Uhr steht in „Nächste Mahlzeit“), Windel fragt nass, voll oder beides, Fläschchen fragt Menge und Uhrzeit („fertig getrunken um“). Am Handy stehen Schlaf, Stillen, Windel und Fläschchen für das gewählte Kind in einer Aktionsleiste unten über der Ansichtsleiste, in jeder Ansicht. Der Schlafknopf zeigt dort „wach H:MM h“ bzw. die Schlafdauer.
- **Nächste Mahlzeit:** die Spanne, in der die nächste Mahlzeit üblich ist — aus den Abständen der letzten 72 Stunden, getrennt nach Tag und Nacht (22–6 Uhr), ab vier Abständen. Danach „Fällig“. Während des Stillens steht hier die laufende Uhr.
- **Jetzt:** Schlaf, Stillen, Fläschchen und Windel als Liste mit farbigen Symbolen (😴 🤱 🍼 💩): groß der Wert, darunter klein „Tätigkeit · Detail“, rechts bei Bedarf der Ausblick. Schlaf zeigt: Schläft das Kind, steht dort seit wann und wie lange es meist dauert; ist es wach, steht dort die Spanne für den nächsten Schlaf oder „Länger wach“ (länger als sonst), jeweils mit „wach seit“; ohne Prognose nur „wach seit“ mit der Uhrzeit. Stillen zeigt die Zeit seit dem letzten Stillen mit Seite und Dauer (läuft es, die Seite und seit wann), Fläschchen die Zeit seither und die Menge, Windel die Zeit seither mit dem letzten Stuhl und rechts „Nächste“ mit der Spanne. „Fällig“ erscheint bei Stillen nach der Erinnerungsgrenze, bei der Windel nach der üblichen Spanne. Ab einem Tag stehen Wochentag und Uhrzeit. Welche Zeilen erscheinen, hängt nur an der Konfiguration; fehlt ein Eintrag, steht „–“. Am Tablet stehen die Spalten der Kinder Zeile für Zeile auf einer Höhe.
- **Tag:** Eine Karte mit dem Streifen von 0 bis 24 Uhr (mit Stunden) und darunter den Zahlen als Textzeile (Mahlzeiten, gestillt, Fläschchen, Windeln, Schlaf; fehlt ein Wert, steht „–“). Darunter die letzten fünf Einträge als Liste, der Rest über „Alle n Einträge“. Mit ‹ geht es bis zu vier Wochen zurück.
- **Wachstum und Momente (Chips):** Heute stehen darunter zwei Chips, sobald `weight_calendar` bzw. `milestone_calendar` gesetzt ist: das letzte Gewicht mit der Zunahme zur Messung davor und der letzte Meilenstein mit Datum. Ein Tipp öffnet die Ansicht „Wachstum“ bzw. „Momente“.
- **Protokoll:** erscheint unten in der Leiste direkt nach „Heute“, sobald ein Kind `feeding_calendar` oder `diaper_calendar` hat. Je Kind steht dort die `fp-feeding-card` (mit `switch`) und darunter die `fp-diaper-card` eingebettet, in den Farben der Übersicht: Eintragen, Ändern, Nachtragen und der **Bericht** zum Drucken oder Teilen, ohne eine eigene Dashboard-Seite. Die Konfiguration der Karten ergibt sich aus der der Übersicht (Kalender, Schalter, Seite und Beginn je Kind, dazu `weight_calendar`, `reminder_entity`, `reminder_night_entity` und `meal_pause_entity`). Ein Tipp auf die Jetzt-Zeilen „Stillen“ und „Fläschchen“ und auf „🖨 Bericht“ in „Muster“ führt dorthin.
- **Muster:** „Woche“ oder „2 Wochen“, Filter Alle/Stillen/Fläschchen/Windel. Oben eine gerechnete Zusammenfassung (z. B. „Die Nächte werden länger 🌙“ mit Mahlzeiten und Windeln am Tag und dem Vergleich zur Zeit davor), darunter der Tagesschnitt, eine Zeile je Tag mit Summe und Bemerktes wie die längste Pause der letzten Nacht.
- **Schlaf:** Am Tablet über den Spalten „Beide schlafen“ (bei mehr Kindern „Alle schlafen“) und ein Knopf je Kind. Schläft ein Kind, ist sein Knopf gefüllt und zeigt die Dauer; ein Tipp heißt „aufgewacht“. Am Handy steht oben nur „Beide schlafen“ mit dem Zustand des anderen Kindes; das gewählte Kind schaltet die Aktionsleiste unten. „Beide schlafen“ legt alle hin, die noch wach sind, und weckt alle, wenn alle schlafen. Unter einer Minute gilt als Fehltipp. Die Jetzt-Zeile „Schlaf“ zeigt den Ausblick (siehe oben); die Spanne für den nächsten Schlaf kommt ab drei Wachphasen in den letzten 72 Stunden, getrennt nach Tag und Nacht, wie bei der nächsten Mahlzeit. Schlaf erscheint als Fläche im Tagesstreifen, in den Zahlen von „Tag“, in den Einträgen (Tipp zum Ändern oder Löschen), im Muster als eigener Filter und in „Frag nach“. ＋ trägt Schlaf nach, auch für beide auf einmal; überschneidende Phasen werden abgelehnt.
- **Momente:** erscheint unten in der Leiste, sobald `milestone_calendar` gesetzt ist, und zeigt die `fp-milestone-card` in den Farben der Übersicht (Erste Male, Entwicklung, Bewegung, Abhaken mit Dialog). Ein eigener Tab für die Meilensteine ist damit nicht nötig. Das gewählte Kind ist in Übersicht und Meilensteinen dasselbe. `memories_path` wird nur noch genutzt, wenn kein `milestone_calendar` gesetzt ist.
- **Wachstum:** erscheint unten in der Leiste, sobald `weight_calendar` gesetzt ist. Oben das letzte Gewicht mit Alter, Perzentile und der Zunahme seit der Messung davor (Ø g am Tag), darunter Zunahme seit der Geburt, Schnitt pro Woche und die Perzentile jetzt und bei der Geburt. Die Kurve zeigt das Gewicht nach Lebenswochen bzw. -monaten, mit `growth_data` und `sex` je Kind auch die Bänder P3–P97 und P50, ein Stück in die Zukunft und mit einer Linie bei heute. „Bemerkt“ nennt gerechnete Beobachtungen wie den tiefsten Wert nach der Geburt, wann das Geburtsgewicht wieder erreicht war oder eine neue Kilomarke. „⚖️ Wiegen“ trägt ein, ein Tipp auf eine Messung oder einen Punkt ändert oder löscht sie; pro Kind und Tag bleibt es bei einem Wert. Als Geburtsgewicht gilt der Wert am Geburtstag.
- **Frag nach:** Vorschläge wie „Wie war die letzte Nacht?“ oder freie Fragen. Die Karte rechnet Tageswerte, Nächte und die Einträge der letzten drei Tage vor und gibt sie mit der Frage und dem bisherigen Gespräch an `ai_task.generate_data`. **Diese Daten gehen an den KI-Dienst, der hinter der `ai_task`-Entity steht.** Die Antworten sind kein ärztlicher Rat.

## Design-Variablen (Theme)

Die Karten nehmen Farben, Flächen und Ecken aus Theme-Variablen `--fp-*`. Jede Karte liest sie mit Rückfallwerten, ohne Theme bleibt alles benutzbar. Hell und dunkel kommen aus den `modes` des Themes, die Karten folgen dem Modus des Geräts. Text und Kartenflächen kommen weiter aus den HA-Variablen (`primary-text-color`, `card-background-color` …).

| Variable | Wofür | Hell | Dunkel |
| --- | --- | --- | --- |
| **Akzent** | | | |
| `fp-accent` | Akzentfarbe (Salbei) | `#4F6B57` | `#8FB098` |
| `fp-accent-rgb` | Akzent als RGB-Tripel, für Knopfflächen | `79, 107, 87` | `143, 176, 152` |
| `fp-tint-rgb` | helleres Salbei als RGB-Tripel, für Tönungen | `125, 155, 132` | `143, 176, 152` |
| `fp-accent-fg` | Text auf Knopfflächen | `#FFFFFF` | `#1E1C18` |
| `fp-head` | Überschriften in den Karten | `#3C5343` | `#8FB098` |
| **Essensplan** | | | |
| `fp-meal0-bg` | Feld Frühstück | `#F0EADA` | `#332F27` |
| `fp-meal1-bg` | Feld Mittag | `#DFEBD6` | `#2B3529` |
| `fp-meal2-bg` | Feld Abend | `#F7E4CC` | `#372E24` |
| `fp-meal0` | Punkt Frühstück | `#C9A15A` | `#D8B676` |
| `fp-meal1` | Punkt Mittag | `#6E9A62` | `#8DB880` |
| `fp-meal2` | Punkt Abend | `#C97A3D` | `#DE9660` |
| `fp-meal-border` | Rand der Felder | `transparent` | `transparent` |
| `fp-meal-radius` | Ecken der Felder | `8px` | `8px` |
| **Flächen und Form** | | | |
| `fp-surface` | Kacheln innerhalb einer Karte | `#F4EFE4` | `#35322B` |
| `fp-surface-2` | Spuren und gedrückte Segmente | `#E9E2D2` | `#403C34` |
| `fp-radius` | Ecken von Karten und Blättern | `16px` | `16px` |
| `fp-radius-sm` | Ecken von Kacheln und Knöpfen | `12px` | `12px` |
| `fp-hero-bg` | Kopfverlauf der Baby-Übersicht | Verlauf `#DCE5D3` → transparent (Morgen in Salbei) | Verlauf `#26324D` → transparent (Nachthimmel) |
| **Signal** | | | |
| `fp-alert` | „Fällig“ | `#B97F06` | `#E0A93F` |
| `fp-alert-bg` | Hintergrund bei „Fällig“ | `#FBEFD3` | `#3A3122` |
| **Tätigkeiten** | | | |
| `fp-c-nurse` | Stillen | `#D9719F` | `#E58BB6` |
| `fp-c-bottle` | Fläschchen | `#E3A43A` | `#EDB458` |
| `fp-c-diaper` | Windel (Blaugrün statt Grün) | `#3E9DB0` | `#63B7C8` |
| `fp-c-stool` | Stuhl | `#A77446` | `#C08C5E` |
| `fp-c-sleep` | Schlaf | `#8A87E0` | `#9592EE` |
| `fp-c-on` | Schrift auf diesen Farbflächen | `#1E1C18` | `#1E1C18` |
| **Startseite** | | | |
| `fp-glance-morning` | Hintergrund Morgen (5–11 Uhr) | Verlauf `#E4EBDA` → `#F3EBD8` (Salbei → Sand) | Verlauf `#2E3A30` → `#3A3527` |
| `fp-glance-day` | Hintergrund Tag (11–17 Uhr) | Verlauf `#DCE7D6` → `#E6EEDF` (Salbei) | Verlauf `#2C3A2F` → `#33402F` |
| `fp-glance-evening` | Hintergrund Abend (17–22 Uhr) | Verlauf `#DCE7D6` → `#EADDC9` (Salbei → warmer Bernstein) | Verlauf `#2E3530` → `#3B2F2A` |
| `fp-glance-night` | Hintergrund Nacht (22–5 Uhr) | Verlauf `#D5DDD3` → `#D9DCE6` (Salbei → kühles Grau) | Verlauf `#1E2638` → `#26324D` (Nachthimmel) |
| `fp-glance-fg` | Schrift des Banners | `#22371F` | `#EDE8DC` |
| `fp-glance-border` | Rand des Banners | `#B9CBB1` | `#3E3B34` |
| `fp-glance-shadow` | Schatten des Banners | `0 2px 8px rgba(70, 58, 34, 0.16)` | `0 2px 8px rgba(0, 0, 0, 0.35)` |

Die `fp-glance-*`-Variablen gehören zur `fp-glance-card`: ein Hintergrund je Tageszeit (Morgen 5–11, Tag 11–17, Abend 17–22 Uhr, sonst Nacht), dazu Schrift, Rand und Schatten des Banners. Sie gelten, wenn `backgrounds` bzw. `background` in der Kartenkonfiguration nicht gesetzt sind. `fp-glance-shadow` muss ein gültiger Schatten sein (z. B. `0 2px 8px rgba(0, 0, 0, 0.2)`), nicht `none`.

Alle Zeilen für das eigene Theme, in der Form der `modes`:

```yaml
mein-theme:
  modes:
    light:
      # … eigene Einträge …
      fp-accent-rgb: "79, 107, 87"
      fp-tint-rgb: "125, 155, 132"
      fp-accent-fg: "#FFFFFF"
      fp-accent: "#4F6B57"
      fp-head: "#3C5343"
      fp-meal0-bg: "#F0EADA"
      fp-meal1-bg: "#DFEBD6"
      fp-meal2-bg: "#F7E4CC"
      fp-meal0: "#C9A15A"
      fp-meal1: "#6E9A62"
      fp-meal2: "#C97A3D"
      fp-meal-border: "transparent"
      fp-meal-radius: "8px"
      fp-surface: "#F4EFE4"
      fp-surface-2: "#E9E2D2"
      fp-hero-bg: "linear-gradient(180deg, #DCE5D3, rgba(220, 229, 211, 0))"
      fp-alert: "#B97F06"
      fp-alert-bg: "#FBEFD3"
      fp-c-nurse: "#D9719F"
      fp-c-bottle: "#E3A43A"
      fp-c-diaper: "#3E9DB0"
      fp-c-stool: "#A77446"
      fp-c-sleep: "#8A87E0"
      fp-c-on: "#1E1C18"
      fp-radius: "16px"
      fp-radius-sm: "12px"
      fp-glance-morning: "linear-gradient(135deg, #E4EBDA, #F3EBD8)"
      fp-glance-day: "linear-gradient(135deg, #DCE7D6, #E6EEDF)"
      fp-glance-evening: "linear-gradient(135deg, #DCE7D6, #EADDC9)"
      fp-glance-night: "linear-gradient(135deg, #D5DDD3, #D9DCE6)"
      fp-glance-fg: "#22371F"
      fp-glance-border: "#B9CBB1"
      fp-glance-shadow: "0 2px 8px rgba(70, 58, 34, 0.16)"
    dark:
      # … eigene Einträge …
      fp-accent-rgb: "143, 176, 152"
      fp-tint-rgb: "143, 176, 152"
      fp-accent-fg: "#1E1C18"
      fp-accent: "#8FB098"
      fp-head: "#8FB098"
      fp-meal0-bg: "#332F27"
      fp-meal1-bg: "#2B3529"
      fp-meal2-bg: "#372E24"
      fp-meal0: "#D8B676"
      fp-meal1: "#8DB880"
      fp-meal2: "#DE9660"
      fp-meal-border: "transparent"
      fp-meal-radius: "8px"
      fp-surface: "#35322B"
      fp-surface-2: "#403C34"
      fp-hero-bg: "linear-gradient(180deg, #26324D, rgba(38, 50, 77, 0))"
      fp-alert: "#E0A93F"
      fp-alert-bg: "#3A3122"
      fp-c-nurse: "#E58BB6"
      fp-c-bottle: "#EDB458"
      fp-c-diaper: "#63B7C8"
      fp-c-stool: "#C08C5E"
      fp-c-sleep: "#9592EE"
      fp-c-on: "#1E1C18"
      fp-radius: "16px"
      fp-radius-sm: "12px"
      fp-glance-morning: "linear-gradient(135deg, #2E3A30, #3A3527)"
      fp-glance-day: "linear-gradient(135deg, #2C3A2F, #33402F)"
      fp-glance-evening: "linear-gradient(135deg, #2E3530, #3B2F2A)"
      fp-glance-night: "linear-gradient(135deg, #1E2638, #26324D)"
      fp-glance-fg: "#EDE8DC"
      fp-glance-border: "#3E3B34"
      fp-glance-shadow: "0 2px 8px rgba(0, 0, 0, 0.35)"
```

Danach in Home Assistant unter Entwicklerwerkzeuge → YAML „Themes“ neu laden.

## Lizenz

MIT
