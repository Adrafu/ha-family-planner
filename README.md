# Family Planner Cards

Fünfzehn eigene Lovelace-Karten für einen Home-Assistant-Familienplaner:

- **`meal-grid-card`** — Essensplan (Frühstück/Mittag/Abend), gespeist aus einem Kalender, mit Inline-Bearbeitung, Food-Emojis und KI-Vorschlag (`ai_task`; entschärft mit Küchen-/Grundform-Rotation, Saison- und Wetterbezug, liest getippten Wunsch aus). **Kochbuch-Kopplung:** „★ Ins Kochbuch" pro Eintrag und „Woche füllen" hybrid (erst gewichtet aus dem Kochbuch, dann KI). Drei Darstellungen über `layout`: **`list`** (Vorgabe) ist die **Liste nach Tagen**: je Tag eine Zeile, links Wochentag und Datum, rechts die Mahlzeiten untereinander mit farbigem Punkt, Linien statt Kästen, heute mit Akzentstrich am Rand; sie funktioniert in jeder Breite, auf breiten Karten (ab 640 px, bei mehr als drei Mahlzeiten entsprechend breiter, etwa am Tablet) wird daraus eine **ruhige Tabelle**: Tage als Zeilen, Mahlzeiten als Spalten mit Punkt und Name nur im Kopf, in den Zellen nur das Gericht oder ein leises ＋, heute leicht getönt mit Strich am Rand. **`today`** ist „Heute groß, Woche kurz" für die Startseite: die Mahlzeiten von heute nebeneinander in einem Kasten, darunter die nächsten `days_ahead` Tage mit allem, was je Tag geplant ist (jede eingetragene Mahlzeit mit ihrem Punkt, leere fallen weg). **`grid`** ist die bisherige Tabelle; auf schmalen Karten (Handy, unter 560 px) dreht sie sich: Tage als Zeilen, Mahlzeiten als Spalten. Der Kopf ist schlicht: Titel links, rechts eine Pille ‹ Woche ›, „✨ Woche füllen" und „Leeren" als kleine Pillen. Die Farbe der Mahlzeiten steht nur im Punkt (`--fp-meal0` bis `--fp-meal2`). `mode: compact` (Heute/Morgen) bleibt wie bisher. `background` akzeptiert wahlweise ein Bild (URL → dunkles Overlay + weißer Text) **oder** einen CSS-Farbwert/Verlauf (heller Hintergrund, dunkler Text).
- **`family-calendar-card`** — Familienkalender mit **Tagesansicht** (eine Spalte je Person, große Terminkacheln, am Handy eine Zeitliste mit Jetzt-Linie), **Wochenansicht** mit großen Terminkacheln (am Tablet eine Spalte je Tag, am Handy die Tage untereinander; das klassische Stunden-Raster gibt es weiter mit `week_grid: true`) und Monatsansicht. Schlichter Kopf mit Titel, den Ansichten Tag/Woche/Monat als Schalter und dem Datum als Pille (‹ 12.–18. Okt ›), Knopf „+ Termin“ rechts, Personenfilter als kleine Chips mit Farbpunkt, Wischen wechselt Tag bzw. Woche. Mehrere Personen lassen sich per Präfix aus einem Kalender aufteilen. Termine direkt anlegen, bearbeiten und löschen. Im Stunden-Raster Jetzt-Linie (Outlook-Stil), Heute-Highlight und ausgegraute vergangene Tage. Dazu eine **kompakte Mehrtagesansicht** (`initial_view: agenda`): eine Spalte je Tag, Termine als Kacheln mit farbiger Kante — gedacht als Ersatz fuer eine fremde Kalenderkarte in der Uebersicht.
- **`kids-routine-card`** — **Routinen für Kinder, Schritt für Schritt** (z. B. Morgen und Abend): immer nur der aktuelle Schritt groß mit Symbol und einem Knopf „Fertig“, darüber Punkte für den ganzen Ablauf. Die passende Routine steht nach Tageszeit vorne (`from`), ein Umschalter wechselt von Hand. Ist alles erledigt, gibt es Konfetti und „Geschafft!“ statt Punkten; Sterne (z. B. über ChoreOps) nur, wenn `points_entity` gesetzt ist. Zurückgesetzt wird über eine eigene Automation, etwa nachts.
- **`shopping-fav-card`** — Schnell-Buttons für Lieblings-Artikel/-Aufgaben (ein Tipp legt das Item auf die To-do-Liste) als **gleich breite Chips** in `columns` Spalten (auf schmalen Karten weniger), Emoji über dem Namen. Favoriten, die **schon offen auf der Liste** stehen, sind mit ✓ markiert und werden bei einem Tipp nicht doppelt angelegt (die Karte liest die Liste live, nur ohne `assign`). Bearbeiten (Hinzufügen/Entfernen/Sortieren) über ✏️ im Kopf; Favoriten in einem `input_text`, Emojis automatisch abgeleitet. Optional als „Hinzufügen"-Button mit kombiniertem Dialog (Freitext + Favoriten + Zuweisung + Fälligkeit, alles konfigurierbar). Mit `embedded: true` sitzt sie ohne eigenen Rahmen in der `fp-todo-card` (Option `favorites` dort).
- **`nav-card`** — Hüllt eine beliebige Karte ein und macht sie als Ganzes anklickbar: Tipps auf nicht-interaktive Bereiche navigieren zu einem Tab, interaktive Elemente (Checkboxen, Eingabefelder, anklickbare Zellen) bleiben aktiv.
- **`fp-todo-card`** — Zeichnet ihre **eigene To-do-Liste** (nicht mehr die native `todo-list`-Karte) im Stil der Baby-Übersicht, live aus der To-do-Entität: Kopf mit Namens-Pille oder Titel und der Zahl der offenen Aufgaben, darunter die Aufgaben als Kacheln mit großem Kreis zum **Abhaken (mit „Rückgängig")** und einem Fälligkeits-Chip („gestern", „heute 14:00", „Fr"). Mit `display_order: duedate_asc` stehen sie in Gruppen **Überfällig / Heute / Demnächst / Ohne Datum**. `pill: { label, color }` gibt jeder Person **eine Farbe** (passt zu hellem und dunklem Theme), `empty_text` ist der Hinweis bei leerer Liste, `due_date_period` filtert nach Fälligkeit. Eine Eingabezeile legt Aufgaben an (`hide_create: true` blendet sie aus); neue Einträge erscheinen **sofort**, auch über das `fp-todo-add`-Event der `shopping-fav-card`, noch bevor Cloud-Listen wie Todoist/Bring nachziehen. Optional ein **eigener Änderungsdialog** (`edit_dialog`): Aufgabe umbenennen, in eine andere Liste verschieben, Fälligkeit per Schnellauswahl setzen und eine Wiederholung vergeben. Für den Einkauf lässt sich alles in **einer** Karte bündeln: eigener Eingabetext, Eingabe oben, Pille im Kopf, die einen Dienst ruft (z. B. ein Skript), und die Favoriten darunter.
- **`fp-glance-card`** — „Today at a glance"-Banner für die Übersicht: tageszeitabhängige Begrüßung, Datum, nächster Termin (Präfix-Personen aufgelöst) und heutiges Abendessen, mit einem Hintergrund je Tageszeit (nach Uhrzeit): als Foto, aus dem Theme (`--fp-glance-*`) oder als Blauverlauf. Das Wetter wird als eingebettete `clock-weather-card` (echte Animationen + Vorschau) transparent auf den Banner geblendet. Klick pro Element navigiert getrennt (Datum/Termin → Kalender, Essen → Essensplan, Wetter → eigener Wetter-Tab); das More-Info-Popup der eingebetteten Karte wird unterdrückt. Mit `baby` stehen je Kind eine Zeile mit der Stillübersicht unter dem Gruß.
- **`fp-cookbook-card`** — Kochbuch mit Rezepten (Zutaten, Schritt-für-Schritt-Anleitung, Portionen-Slider, Sterne-Bewertung, **Zubereitungszeit**), gespeichert in einer lokalen To-do-Liste. Die Übersicht ist ruhig gehalten: **Bildkacheln** mit Name, Zeit und kcal, Suche und Hinweise als Pillen im Kopf, Filter als wischbare Chips; Tags, Bewertung und Nährwerte stehen auf der Rezeptseite. **Bilder zu den Rezepten** in den Kacheln und auf der Rezeptseite: eigenes Foto hochladen (verkleinert in den HA-Medienordner, Admin-Konto nötig), freie Fotos über Openverse suchen (Creative Commons, der Fotografen-Hinweis wird mitgespeichert), KI-Bild (nur wenn das `ai_task` Bilder erzeugen kann) oder Bildadresse. **KI-Rezept** aus Name/Text und **KI-Vorschlag „überrasch mich"** ohne Eingabe (berücksichtigt Jahreszeit + Wetter, erzwingt Abwechslung, meidet zuletzt Vorgeschlagenes → keine Monotonie). Rezepte lassen sich **vollständig bearbeiten** (Name, Mahlzeit, Tags, Portionen, Zeiten, **Nährwerte**, Zutaten, Schritte). **Kalorien und Eiweiß je Portion** werden mitgeschätzt und auf der Rezeptseite angezeigt (auf der Kachel steht nur kcal); für Altbestand gibt es im Kopf kleine Pillen zum Nachrechnen von Zeiten und Nährwerten. Die Filter „schnell" und „proteinreich" werden aus Gesamtzeit bzw. Eiweißwert **berechnet** statt geraten. Mit `import_service` erscheint im „＋ Neu"-Dialog ein **Link-Feld**: Rezeptseiten werden aus ihrem JSON-LD ausgelesen, Videos vom Import-Dienst angeschaut. „In Plan legen" schreibt in den Essensplan-Kalender; „Zutaten → Einkauf" öffnet ein Auswahl-Popup und legt nur die angehakten (auf die Portionen skalierten) Zutaten auf die Einkaufsliste; steht dieselbe Zutat dort schon offen, wird die Menge addiert statt eine zweite Zeile anzulegen (g/kg und ml/l werden umgerechnet, die Menge darf im Titel oder in der Beschreibung stehen).
- **`dobby-clock-card`** — **Schachuhr, die hochzählt.** Für Versteckspiele zu zweit: wer den Gegenstand versteckt hat, dessen Uhr läuft. Eine Wippe als Tastenpaar oben auf dem Gehäuse, die laufende Taste steht oben; darunter zwei Anzeigen. Die Rundenzeit wechselt die Einheit mit ihrer Länge (Minuten → Stunden → Tage → Wochen → Monate), darunter der Gesamtstand. Dazu eine **Bestenliste** mit den drei längsten Verstecken samt Zeitraum. Der Stand liegt in Helfern und übersteht Neustarts; die Uhr tickt nur im Browser, damit kein Sensor im Sekundentakt die Datenbank füllt.
- **`fp-feeding-card`** — **Stillprotokoll** je Kind: Start/Stopp mit laufender Uhr, Seitenvorschlag, Fläschchen in ml, Nachtragen, Tabelle für heute und gestern mit Tagessummen. Groß die **Zeit seit der letzten Mahlzeit** mit Balken bis zur Erinnerung, aufklappbar ein **Rückblick über 7 Tage** (Mahlzeiten, Stillzeit, Ø Abstand, Fläschchen) und ein **Bericht** der letzten 7 Tage zum Drucken oder als PDF, auf Wunsch mit Windeln und Gewicht.
- **`fp-weight-card`** — **Gewichtsverlauf** mehrerer Kinder auf einer Zeitachse, Eintragen per Dialog, Punkt antippen zum Bearbeiten. Optional mit **Perzentilkurven** aus einer eigenen Datendatei, auch für Frühgeborene nach korrigiertem Alter.
- **`fp-diaper-card`** — **Windelprotokoll** je Kind: nass, voll oder beides per Tipp, Zeit seit der letzten Windel und dem letzten Stuhl, heute und gestern mit Summen, Rückblick über 7 Tage.
- **`fp-milestone-card`** — **Meilensteine** je Kind zum Abhaken: **Erste Male** als Sticker-Album (erstes Lachen, erster Zahn, erste Schritte, erster Schnee …), **Entwicklung** nach Alter mit den Punkten, die gerade dran sind, und **Bewegung** mit den Zeitfenstern der WHO. Abhaken ist ein kleines Fest: Konfetti, ein Jubel-Dialog, Datum und Notiz, auch nachträglich und für Geschwister auf einmal. Eigene Momente lassen sich dazulegen, und zu jedem Meilenstein passt **ein Foto**. Frühgeborene nach korrigiertem Alter.
- **`fp-baby-overview-card`** — **Übersicht** je Kind im Stil der App Buma, gespeist aus den Kalendern von Still-, Windel-, Gewichts- und Meilensteinkarte und einem eigenen Schlafkalender. **Heute:** am Tablet Schlafknöpfe („Beide schlafen“ und je Kind), farbige Schnellknöpfe für Stillen, Windel und Fläschchen, die Karte **„Nächste Mahlzeit“** mit Zeitfenster, **„Jetzt“** als Liste mit farbigen Symbolen (Zeit seit dem letzten Mal, Ausblick auf den nächsten Schlaf, „Fällig“), **„Tag“** mit Streifen und den Zahlen als Textzeile, Chips für Wachstum und Momente und die Einträge, mit ‹ › durch die letzten Wochen blättern. Am Handy steht unten eine Aktionsleiste mit Schlaf, Beide, Stillen, Windel und Fläschchen, und der Kopf mit der Kinderwahl klebt beim Scrollen kompakt oben. **Protokoll:** Still- und Windelkarte je Kind direkt in der Übersicht, mit Bearbeiten, Rückblick und Bericht. **Muster:** Zusammenfassung, Filter, Tagesschnitt und eine Zeile je Tag. **Wachstum:** aktuelles Gewicht mit Zunahme und Perzentile, Kurve nach Alter mit Perzentilbändern, Messungen, Wiegen direkt in der Karte. **Momente:** die Meilensteinkarte direkt in der Übersicht, ohne eigenen Tab. ✦ öffnet **„Frag nach“**: eine KI (`ai_task`) beantwortet Fragen zu allen Einträgen und sucht Muster. Folgt dem hellen oder dunklen Modus des Geräts, Farben aus dem Theme; Zwillinge am Tablet nebeneinander, am Handy per Schalter im Kopf oder Wischen zum Umschalten. Mit `layout: bar` wird daraus eine schmale **Baby-Leiste** für die Startseite (letzte und nächste Mahlzeit je Kind, ein Tipp öffnet den Baby-Tab bei diesem Kind).
- **`fp-assistant-card`** — **Sprachassistent „Pip“**: eine unsichtbare Karte, die eine kleine schwebende Figur (ein Spross mit Augen) unten rechts (auf Wunsch links) einblendet, in allen Tabs des Dashboards. Ein Tipp öffnet das Gespräch (am Tablet und PC als Seitenleiste, am Handy als Blatt von unten): Fragen per Text, Vorschlags-Chips oder **Mikrofon**, Antworten der Assist-Pipeline im Verlauf und auf Wunsch **vorgelesen**, Weiterreden, wenn der Gesprächsagent nachfragt; optional hört Pip per **Aktivierungswort** („Hey Pip“) zu, erkannt direkt im Browser. Über das Ereignis `fp_pip_karte` zeigt Pip kleine **Aktionskarten**, etwa „Termin angelegt“ mit **Rückgängig** oder eine Nachfrage mit **Ja/Abbrechen**. Farben und Ecken aus dem Theme.

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
- `custom:fp-assistant-card`

### Beispiel: meal-grid-card

```yaml
type: custom:meal-grid-card
entity: calendar.essensplan
mode: week            # oder "compact" (heute + morgen, ignoriert layout)
layout: list          # "list" (Liste nach Tagen, Vorgabe; ab 640 px als Tabelle), "today" (Heute groß, Woche kurz) oder "grid" (Tabelle)
days_ahead: 4         # nur für "today": so viele Tage nach heute stehen in der kurzen Liste (0 bis 13)
title: Wochenplan
ai_entity: ai_task.google_ai_task
background: "https://example.com/bild.jpg"
hide_header: false    # true = ohne Kopf und Wochennavigation (für die Übersicht)
meal_labels: true     # false = ohne Bezeichnung (Liste und Listen-Tabelle: nur der Punkt, grid: nur das Symbol)
empty_text: "＋"      # was bei einer leeren Mahlzeit steht (leise dargestellt, z. B. auch "offen")
cookbook_path: /familienplaner/kochbuch   # optional: Seite des Kochbuchs; „Zum Rezept" springt dorthin, der Kopf zeigt den Knopf „📖 Kochbuch"
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

In der Liste und in der Tabelle blättert die Pille ‹ 13.–19. Okt › durch die Wochen; ist es nicht die aktuelle Woche, springt „Heute" zurück. „✨ Woche füllen" und „Leeren" stehen mit `ai_suggest` im Kopf. Ist `cookbook_path` gesetzt, steht davor die Pille „📖 Kochbuch", ein Tipp öffnet die Seite. Mit `hide_header: true` bleiben „Woche füllen" und „Leeren" als schmale Reihe stehen, „📖 Kochbuch" gehört nur zum vollen Kopf; in „Heute groß" gibt es sie nicht. Die Punktfarben kommen aus dem Theme (`fp-meal0` bis `fp-meal2`, ab der vierten Mahlzeit wie die dritte), das Feld der Tabelle weiter aus `fp-meal0-bg` bis `fp-meal2-bg`.

Bei `layout: list` entscheidet die Breite der Karte: darunter steht die Liste (Handy), ab 640 px die Tabelle (Tablet). Die Zellen sind wie die Liste antippbar, `layout: grid` und `mode: compact` bleiben unverändert.

### Beispiel: family-calendar-card

```yaml
type: custom:family-calendar-card
title: Familienkalender
initial_view: week    # "day", "week", "month" oder "agenda"
week_grid: false      # true: Woche als Stunden-Raster statt Terminkacheln
days: 4               # nur fuer "agenda": 1 bis 14 Tage nebeneinander
hide_header: false    # Kopf mit Titel, Ansichten und Datum ausblenden
hide_legend: false    # Personenfilter ausblenden
fill_height: false    # true: Karte reicht mindestens bis zum unteren Bildschirmrand (Tag, Woche, Monat)
day_start: 6
day_end: 23
persons:
  - { name: Familie, color: "#E53935", calendar: calendar.familie, match: none }
  - { name: Person A, color: "#1E88E5", calendar: calendar.familie, prefix: "A" }
  - { name: Person B, color: "#8E24AA", calendar: calendar.familie, prefix: "B" }
  - { name: Kind A, color: "#43A047", calendar: calendar.kind_a, entity: person.kind_a }  # entity oder picture: Foto statt Initiale
  - { name: Feiertage, color: "#78909C", calendar: calendar.feiertage, no_create: true }  # nur lesen, als Zeile über den Terminen
```

Tag und Woche passen sich der Kartenbreite an: unter 560 px die Handy-Liste, darüber Spalten. Passen die Spalten nicht nebeneinander, brechen sie in eine zweite Zeile um, statt seitlich zu scrollen; passen sie, teilen sich die sieben Tage die volle Breite. Ein Tipp auf eine freie Fläche legt dort einen Termin an.

Mit `fill_height: true` reicht die Karte mindestens bis zum unteren Bildschirmrand (sichtbare Höhe abzüglich Kopfzeile, Safe-Area und 8 px Rand; den Rand stellt `--fcc-fill-offset` im Theme ein). Die Spalten wachsen nach unten mit, die freie Fläche einer Spalte legt wie gewohnt einen Termin an. Gedacht für eine Panel-View; in der Mehrtagesansicht (`initial_view: agenda`) bleibt die Karte so hoch wie ihr Inhalt.

Der Kopf ist schlicht: links der Titel, daneben die Ansichten als Schalter und das Datum als Pille (‹ 12.–18. Okt ›, in der Tagesansicht „Mi, 14. Okt“). „Heute“ erscheint nur, wenn nicht der aktuelle Tag, die aktuelle Woche oder der aktuelle Monat gezeigt wird. „+ Termin“ steht rechts; auf schmalen Karten stehen Titel und „+ Termin“ oben, darunter Datum und Ansichten. Die Personenfilter sind kleine Chips mit Punkt in der Personenfarbe: In Tag und Woche sind „Alle“ bzw. die gewählten Personen gefüllt, in Monat, Agenda und Stunden-Raster blendet ein Tipp die Person aus (der Chip wird blass). Farben und Flächen kommen aus dem Theme (`fp-accent`, `fp-surface` …); die Terminkacheln behalten die Personenfarbe.

### Beispiel: kids-routine-card

```yaml
type: custom:kids-routine-card
name: Kind A                 # Kopf und „Geschafft, Kind A!“ (title überschreibt den Kopf)
color: "#4A7A3A"             # optional: Farbpunkt des Kindes im Kopf
routines:
  - label: Morgen
    icon: "🌅"
    from: 5                  # ab 5 Uhr steht diese Routine vorne (Zahl oder "HH:MM")
    tasks:
      - { label: Anziehen, emoji: "👕", entity: input_boolean.kind_a_morgen_anziehen }
      - { label: Zähne putzen, emoji: "🪥", entity: input_boolean.kind_a_morgen_zaehne }
      - { label: Frühstück, emoji: "🥣", entity: input_boolean.kind_a_morgen_fruehstueck }
  - label: Abend
    icon: "🌙"
    from: "16:00"            # gilt bis zur nächsten Routine, auch über Mitternacht
    tasks:
      - { label: Zähne putzen, emoji: "🪥", entity: input_boolean.kind_a_abend_zaehne }
      - { label: Schlafanzug, emoji: "🛌", entity: input_boolean.kind_a_abend_schlafanzug }
# optional, nur wenn Punkte gewünscht sind:
# points_entity: sensor.kind_a_sterne     # zeigt „⭐ N“ im Kopf
# reward_button: button.kind_a_plus_1     # wird bei „Fertig“ gedrückt
# penalty_button: button.kind_a_minus_1   # wird bei „Zurück“ gedrückt
```

Ohne `from` gilt die erste Routine ab 0 Uhr und die zweite ab 12 Uhr. „Fertig“ schaltet den aktuellen Schritt ein, „Zurück“ den zuletzt erledigten wieder aus; ein Doppeltipp zählt nur einmal. Zum täglichen Zurücksetzen eine Automation anlegen, die die Schalter z. B. um 4 Uhr ausschaltet.

### Beispiel: shopping-fav-card

```yaml
type: custom:shopping-fav-card
list_entity: todo.zuhause            # To-do-Liste, auf die getippte Favoriten wandern
store_entity: input_text.einkauf_favoriten   # Helper, der die Favoriten speichert
columns: 3
```

Der Helper `input_text.einkauf_favoriten` muss vorab angelegt sein (max. 255 Zeichen). Favoriten werden als kommagetrennte Liste gespeichert; der Knopf „✏️ Bearbeiten" im Kopf der Karte öffnet einen Editor.

Die Favoriten erscheinen als **gleich breite Chips** in höchstens `columns` Spalten (auf schmalen Karten weniger, mindestens ca. 96 px breit), das Emoji steht über dem Namen. Steht ein Favorit **schon offen auf der Liste** `list_entity`, ist sein Chip mit ✓ und Akzentrand markiert, und ein Tipp darauf legt ihn **nicht doppelt** an, sondern zeigt nur einen Hinweis. Dazu liest die Karte die Liste live; Mengenangaben wie „200 g Butter" zählen für „Butter". Die Markierung gibt es nur ohne `assign` (dort wählt der Dialog das Ziel); schlägt das Lesen der Liste fehl, bleibt die Karte einfach ohne Markierung. Im „Hinzufügen"-Dialog zeigen die Favoriten dieselbe Markierung, solange das gewählte Ziel `list_entity` ist.

Mit `embedded: true` zeichnet die Karte **ohne eigenen Rahmen**, Hintergrund und Innenabstand und mit kompakteren Kacheln: der Titel steht klein als Abschnitts-Label („SCHNELL DAZU"), „✏️ Bearbeiten" rechts daneben. Gedacht für die Einbettung in die `fp-todo-card` (siehe dort, Option `favorites`); die ✓-Markierung und der Editor bleiben unverändert. Ohne `embedded` ändert sich nichts.

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
# hide_undated: true      # optional: Aufgaben ohne Datum ausblenden (Vorgabe false)
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
- **`due_date_period`:** `week` läuft von Montag bis Sonntag, `offset: 0` ist der aktuelle Zeitraum. Gezeigt werden nur offene Aufgaben, die bis zum Ende des Zeitraums fällig sind (Überfälliges eingeschlossen). Der Filter betrifft nur Aufgaben **mit** Datum; Aufgaben ohne Datum bleiben sichtbar und stehen unter „Ohne Datum“. Mit `hide_undated: true` werden sie ausgeblendet. `period: day, offset: 4` ist praktisch für kompakte Übersichtsseiten.
- **Neu anlegen:** Die Eingabezeile „Neue Aufgabe" (Enter oder ＋) zeigt den Eintrag sofort leicht ausgegraut; er wird ersetzt, sobald das Backend nachzieht (spätestens nach 20 Sekunden). Dasselbe gilt für Aufgaben, die die `shopping-fav-card` über das Event `fp-todo-add` anlegt.
- **Liste kurz nicht erreichbar:** Cloud-Listen wie Bring! oder Todoist sind bei einem Verbindungsabriss für ein, zwei Minuten „nicht verfügbar“. Home Assistant nimmt ein Anlegen in dieser Zeit an und verwirft es still. Die Karten prüfen das deshalb vorher: Der Eintrag bleibt ausgegraut mit „⏳ … wird nachgeschickt“ stehen und wird automatisch angelegt, sobald die Liste wieder da ist (Hinweis „nachgetragen“). Gilt für die Eingabezeile, die Favoriten der `shopping-fav-card` und „Zutaten → Einkauf“ im Kochbuch. Die Warteschlange lebt im Browser; wer die Seite neu lädt, bevor die Liste zurück ist, verliert die wartenden Einträge.
- **Nicht mehr dabei:** Weil die Karte nicht mehr die native Liste einbettet, greifen `card_mod`-Regeln für deren Innereien nicht mehr, auch `hide_section_headers` hat keine Wirkung. Ziehen zum Umsortieren gibt es nicht.

#### Einkauf in einer Karte

Alle Optionen sind frei kombinierbar; ohne sie bleibt die Karte, wie sie ist.

```yaml
type: custom:fp-todo-card
entity: todo.einkauf
title: Einkaufsliste
display_order: alpha_asc
add_placeholder: Artikel hinzufügen   # Platzhalter der Eingabe (Vorgabe „Neue Aufgabe")
create_position: top                  # top = Eingabe direkt unter dem Kopf (Vorgabe bottom = unten)
header_actions:                       # kleine Pillen ganz rechts im Kopf, rufen einen Dienst
  - { label: Bestellen, icon: "🛒", service: script.einkauf_bestellen }
favorites:                            # eingebettete shopping-fav-card, unter der Liste
  store_entity: input_text.einkauf_favoriten
  columns: 4
  title: Schnell dazu
```

Eine kleine zweite Karte für eine meist leere Liste:

```yaml
type: custom:fp-todo-card
entity: todo.apotheke
title: Apotheke
add_placeholder: Artikel hinzufügen
empty_style: compact                  # eine Zeile „✓ Nichts zu besorgen" statt des großen Hinweises
empty_text: Nichts zu besorgen
```

- **`add_placeholder`:** Text im leeren Eingabefeld statt „Neue Aufgabe".
- **`create_position: top`:** Die Eingabezeile steht direkt unter dem Kopf statt unter der Liste; praktisch, wenn die Liste länger wird und man im Geschäft zuerst die Liste braucht, aber oben schnell etwas ergänzen will. Mit `hide_create: true` gibt es sie weiterhin nicht.
- **`header_actions`:** Liste mit `label`, `icon` (Emoji, optional), `service` (`domain.service`), optional `data` (Dienstdaten) und `confirm_text` (Rückfrage vor dem Aufruf). Jeder Eintrag ist eine kleine Pille mit Akzentrand rechts im Kopf; auf schmalen Karten brechen sie in eine zweite Zeile um. Ein Tipp ruft den Dienst und zeigt danach „✓ Bestellen“ bzw. „Bestellen hat nicht geklappt“; währenddessen ist die Pille gesperrt (ein Skript kann dauern).
- **`favorites`:** Konfiguration einer `shopping-fav-card` (`store_entity`, `columns`, `title`, `big`, …). `list_entity` ist die `entity` der Karte, solange nichts anderes angegeben ist; die Favoriten werden mit `embedded: true` ohne Rahmen unter der Liste gezeichnet, mit Linie darüber (bei `create_position: top` direkt unter der Liste, sonst unter der Eingabe). Tippt man einen Favoriten, erscheint er sofort in der Liste.
- **`empty_style: compact`:** Der Leer-Zustand ist eine leise Zeile „✓ " plus `empty_text` (Vorgabe „Alles erledigt“) statt des großen Hinweises mit Kreis.

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
baby:                                       # optional: je Kind eine Zeile unter dem Gruß (Konfiguration der fp-baby-overview-card)
  nav_path: /familien-planer/baby           # Tipp auf ein Kind öffnet den Baby-Tab bei diesem Kind
  kids:
    - { key: kind_a, name: Kind A, color: "#4A7A3A", feeding_calendar: calendar.stillprotokoll_kind_a, switch: input_boolean.stillen_kind_a, start: input_datetime.stillen_kind_a_beginn }
    - { key: kind_b, name: Kind B, color: "#7A4A78", feeding_calendar: calendar.stillprotokoll_kind_b, switch: input_boolean.stillen_kind_b, start: input_datetime.stillen_kind_b_beginn }
```

Ohne `backgrounds` nimmt die Karte Hintergrund, Schrift, Rand und Schatten aus den Theme-Variablen `--fp-glance-*` (siehe „Design-Variablen“), ohne diese die bisherigen Blauverläufe mit weißer Schrift. Das Wetter kann über `weather_card` mit einer vollständigen `clock-weather-card`-Config überschrieben werden; ansonsten wird eine sinnvolle Default-Config verwendet. Benötigt die HACS-Karte `clock-weather-card`.

**Baby-Zeilen (`baby`):** Mit `baby` legt die Begrüßung eine eingebettete `fp-baby-overview-card` im Layout `bar` mit `bar_style: inline` an (siehe „Baby-Leiste“). Unter dem Gruß und der Trennlinie steht je Kind eine Zeile („Kind A · satt seit 1:56 h · 02:23–03:29“, „Fällig“-Chip, „stillt · 12 Min“ mit Puls), danach folgt die Zeile mit Termin und Abendessen. Schrift, Farbe und Größe erben von der Begrüßung. Ein Tipp auf ein Kind öffnet `nav_path` bei diesem Kind. `baby` nimmt alle Optionen der Baby-Leiste (`kids`, `nav_path`, `meal_pause_entity` …), `layout` und `bar_style` setzt die Begrüßung selbst. Ohne `baby` bleibt die Karte, wie sie ist.

### Beispiel: fp-cookbook-card

```yaml
type: custom:fp-cookbook-card
entity: todo.kochbuch                  # lokale To-do-Liste als Rezept-Speicher
essensplan_entity: calendar.essensplan  # Ziel für „In Plan legen"
shopping_entity: todo.zuhause           # Ziel für „Zutaten → Einkauf"
ai_entity: ai_task.google_ai_task       # für KI-Rezept + KI-Vorschlag
ai_image_entity: ai_task.google_ai_task # optional: eigene KI nur fürs KI-Bild (braucht generate_image); leer = ai_entity
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

Gewichtsverlauf mehrerer Kinder auf einer gemeinsamen Zeitachse. „＋ Eintragen“ öffnet einen Dialog mit Kind, Datum und Gewicht (Gramm oder Kilo). Ein Tipp auf einen Punkt öffnet Bearbeiten oder Löschen. Pro Kind und Tag wird höchstens ein Wert gespeichert. Die Uhrzeit der Eingabe gilt als Wiegezeit und steht im Termin (`"zeit": "HH:MM"` in der Beschreibung); beim Korrigieren eines Werts bleibt sie erhalten.

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
image_folder: meilensteine          # optional: Unterordner im HA-Medienordner für die Fotos (Vorgabe: meilensteine)
```

Den Kalender vorab über die Integration **Local Calendar** anlegen (z. B. „Meilensteine“). Ein erreichter Meilenstein ist ein Ganztagstermin an dem Tag, an dem es passiert ist, etwa „🐢 Kind A: Krabbelt“. Wer den Kalender zusätzlich in der `family-calendar-card` einblendet, sieht die Meilensteine dort auch. Andere Termine im selben Kalender werden übersprungen.

- **✨ Erste Male:** Gesammelte Momente werden zu Stickern in der Farbe des Kinds, mit dem Alter von damals. Offene Plätze sind gestrichelt. „＋ Eigener Moment“ legt eigene Erinnerungen mit Symbol und Titel dazu.
- **🌱 Entwicklung:** Die Punkte aus den Checklisten der CDC (2022) für 2, 4, 6, 9, 12, 15 und 18 Monate und 2 Jahre, nach Gefühlen, Sprache, Entdecken und Bewegung. Jeden Punkt schaffen mindestens drei von vier Kindern bis zu diesem Alter. Die Stufe, die gerade dran ist, ist vorausgewählt und mit „jetzt“ markiert.
- **👣 Bewegung:** Die sechs Meilensteine der WHO-Motorikstudie mit ihrem Zeitfenster (1. bis 99. Perzentil), dazu ein Punkt je Kind, wann es so weit war, und eine Linie bei heute.

Ein Tipp auf einen offenen Meilenstein öffnet den Jubel-Dialog: Datum (heute, gestern oder frei), „Datum nur ungefähr“, eine Notiz und bei Geschwistern „Auch für … festhalten“ (bei Erlebnissen schon angehakt). „Festhalten“ zeigt Konfetti und lässt den Sticker hüpfen. Ein Tipp auf etwas Abgehaktes öffnet die Erinnerung zum Ändern. Derselbe Meilenstein in mehreren Bereichen wird nur einmal abgehakt: „Sitzt allein“ zählt auch für „Sitzt ohne Hilfe“ und das WHO-Fenster.

**Foto:** Zu jedem Meilenstein lässt sich ein Foto anhängen, beim Festhalten oder später in der Erinnerung („📷 Foto“, am Handy wahlweise Kamera oder Mediathek; „Tauschen“ und „Entfernen“ gehen auch). Im Sticker-Album ersetzt das runde Foto das Symbol, bei Entwicklung und Bewegung sitzt ein kleines rundes Foto am erledigten Eintrag, in der Erinnerung steht es groß oben, und ein Tipp darauf zeigt es bildschirmfüllend. Der Ordner `image_folder` muss im Medienordner von Home Assistant einmal angelegt sein (bei `/media` also `/media/meilensteine`), und zum Hochladen braucht es ein Admin-Konto. Die Fotos werden vor dem Hochladen verkleinert (lange Seite 1280 px). Gespeichert wird nur der Verweis im Kalendereintrag. Ein Foto, das beim Abbrechen oder Tauschen noch an keinem Eintrag hängt, wird wieder gelöscht. Ein **gespeichertes** Foto bleibt dagegen auch nach „Tauschen“, „Entfernen“ oder „Nicht mehr abhaken“ im Medienordner liegen, denn bei Geschwistern kann dasselbe Foto an mehreren Einträgen hängen; aufräumen geht dort von Hand. „Auch für … festhalten“ übernimmt das Foto für alle Kinder.

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

Weitere Optionen: `chat: false` blendet ✦ aus, `action_bar: false` blendet die Aktionsleiste am Handy aus (Vorgabe `true`; die Ansichtsleiste mit Heute, Protokoll, Muster, Wachstum und Momente bleibt), `days` (Vorgabe 14) legt fest, wie viele Tage die KI bekommt, `bottle_presets` (Vorgabe 40/60/90/120) sind die Mengen im Fläschchen-Blatt, `reminder_hours`, `meal_pause_minutes` und `bottle_minutes` wirken wie bei der Stillkarte (`reminder_hours` auch je Kind), `night_start` und `night_end` (Vorgabe 22 und 6) legen die Nacht für `reminder_night_entity` fest.

Die Karte folgt dem hellen bzw. dunklen Modus des Geräts und nimmt ihre Farben, Ecken und den Kopfverlauf aus den Theme-Variablen `--fp-*` (Flächen, Farben je Tätigkeit, „Fällig“, Radien, Kopfverlauf); ohne diese Zeilen im Theme gelten Rückfallwerte.

Die Karte liest, was die anderen Karten schreiben, und braucht keine eigenen Helfer. Selbst schreibt sie Windeln, Fläschchen, Gewichte sowie nachgetragenes oder geändertes Stillen im Format jener Karten und schaltet den Still-Schalter wie die Stillkarte; den Termin legt weiterhin die Protokoll-Automation an. Genauso beim Schlaf: Die Knöpfe schalten nur `sleep_switch`, den Termin schreibt eine Automation (siehe unten). Fehlt ein Kalender in der Konfiguration, fällt der passende Teil einfach weg. Am besten als eigener Tab in einer **Panel-View**.

- **Kopf:** Foto oder Initiale, Name, Alter („8 Mon. 28 T. · korr. 7 Mon.“). Bei mehreren Kindern steht im Kopf ein Schalter mit einem großen Knopf je Kind (Foto, Name, Alter), der gewählte in der Kinderfarbe; am Handy wechselt auch ein waagrechtes Wischen über dem Inhalt das Kind, am Tablet stehen alle nebeneinander. Rechts ✦ für „Frag nach“, darunter ‹ Heute › zum Blättern. Bei mehreren Kindern klebt der Kopf am Handy in jeder Ansicht beim Scrollen unter der Kopfzeile von Home Assistant (mit etwas Luft darunter). Er behält Größe, Foto und Alter und bekommt dabei eine Fläche mit Schatten; ein Tipp wechselt weiter das Kind. Ganz oben und am Tablet sieht er aus wie sonst.
- **Schnellknöpfe:** Am Tablet stehen sie in der Spalte je Kind. Stillen startet und stoppt (läuft es, heißt der Knopf „■ Stopp“; die laufende Uhr steht in „Nächste Mahlzeit“), Windel fragt nass, voll oder beides, Fläschchen fragt Menge und Uhrzeit („fertig getrunken um“). Am Handy stehen Schlaf, Beide, Stillen, Windel und Fläschchen in einer Aktionsleiste unten über der Ansichtsleiste, in jeder Ansicht; Schlaf, Stillen, Windel und Fläschchen gelten für das gewählte Kind. Der Schlafknopf zeigt dort „wach H:MM h“ bzw. die Schlafdauer. „Beide“ (bei mehr als zwei Kindern „Alle“) steht nur, wenn mindestens zwei Kinder einen `sleep_switch` haben: ein Tipp legt alle hin, die noch wach sind; schlafen alle, heißt der Knopf „Beide wach“ und weckt alle.
- **Nächste Mahlzeit:** die Spanne, in der die nächste Mahlzeit üblich ist — aus den Abständen der letzten 72 Stunden, getrennt nach Tag und Nacht (22–6 Uhr), ab vier Abständen. Danach „Fällig“. Während des Stillens steht hier die laufende Uhr.
- **Jetzt:** Schlaf, Stillen, Fläschchen und Windel als Liste mit farbigen Symbolen (😴 🤱 🍼 💩): groß der Wert, darunter klein „Tätigkeit · Detail“, rechts bei Bedarf der Ausblick. Schlaf zeigt: Schläft das Kind, steht dort seit wann und wie lange es meist dauert; ist es wach, steht dort die Spanne für den nächsten Schlaf oder „Länger wach“ (länger als sonst), jeweils mit „wach seit“; ohne Prognose nur „wach seit“ mit der Uhrzeit. Stillen zeigt die Zeit seit dem letzten Stillen mit Seite und Dauer (läuft es, die Seite und seit wann), Fläschchen die Zeit seither und die Menge, Windel die Zeit seither mit dem letzten Stuhl und rechts „Nächste“ mit der Spanne. „Fällig“ erscheint bei Stillen nach der Erinnerungsgrenze, bei der Windel nach der üblichen Spanne. Ab einem Tag stehen Wochentag und Uhrzeit. Welche Zeilen erscheinen, hängt nur an der Konfiguration; fehlt ein Eintrag, steht „–“. Am Tablet stehen die Spalten der Kinder Zeile für Zeile auf einer Höhe.
- **Tag:** Eine Karte mit dem Streifen von 0 bis 24 Uhr (mit Stunden) und darunter den Zahlen als Textzeile (Mahlzeiten, gestillt, Fläschchen, Windeln, Schlaf; fehlt ein Wert, steht „–“). Darunter die letzten fünf Einträge als Liste, der Rest über „Alle n Einträge“. Mit ‹ geht es bis zu vier Wochen zurück.
- **Wachstum und Momente (Chips):** Heute stehen darunter zwei Chips, sobald `weight_calendar` bzw. `milestone_calendar` gesetzt ist: das letzte Gewicht mit der Zunahme zur Messung davor und der letzte Meilenstein mit Datum. Ein Tipp öffnet die Ansicht „Wachstum“ bzw. „Momente“.
- **Protokoll:** erscheint unten in der Leiste direkt nach „Heute“, sobald ein Kind `feeding_calendar` oder `diaper_calendar` hat. Je Kind steht dort die `fp-feeding-card` (mit `switch`) und darunter die `fp-diaper-card` eingebettet, in den Farben der Übersicht: Eintragen, Ändern, Nachtragen und der **Bericht** zum Drucken oder Teilen, ohne eine eigene Dashboard-Seite. Die Konfiguration der Karten ergibt sich aus der der Übersicht (Kalender, Schalter, Seite und Beginn je Kind, dazu `weight_calendar`, `reminder_entity`, `reminder_night_entity` und `meal_pause_entity`). Ein Tipp auf die Karte „Nächste Mahlzeit“ (auch „Stillt gerade“; „■ Stoppen“ stoppt nur das Stillen) und auf die Jetzt-Zeilen „Stillen“ und „Fläschchen“ wählt das Kind dieser Spalte und öffnet sein Protokoll bei der Stillkarte, ein Tipp auf die Windelzeile scrollt direkt zur Windelkarte. Auch der Weg über „🖨 Bericht“ in „Muster“ führt dorthin.
- **Muster:** „Woche“ oder „2 Wochen“, Filter Alle/Stillen/Fläschchen/Windel. Oben eine gerechnete Zusammenfassung (z. B. „Die Nächte werden länger 🌙“ mit Mahlzeiten und Windeln am Tag und dem Vergleich zur Zeit davor), darunter der Tagesschnitt, eine Zeile je Tag mit Summe und Bemerktes wie die längste Pause der letzten Nacht.
- **Schlaf:** Am Tablet über den Spalten „Beide schlafen“ (bei mehr Kindern „Alle schlafen“) und ein Knopf je Kind. Schläft ein Kind, ist sein Knopf gefüllt und zeigt die Dauer; ein Tipp heißt „aufgewacht“. Am Handy steht oben kein Schlafblock: Das gewählte Kind schaltet die Aktionsleiste unten, dort steht auch „Beide“. „Beide schlafen“ legt alle hin, die noch wach sind, und weckt alle, wenn alle schlafen. Unter einer Minute gilt als Fehltipp. Die Jetzt-Zeile „Schlaf“ zeigt den Ausblick (siehe oben); die Spanne für den nächsten Schlaf kommt ab drei Wachphasen in den letzten 72 Stunden, getrennt nach Tag und Nacht, wie bei der nächsten Mahlzeit. Schlaf erscheint als Fläche im Tagesstreifen, in den Zahlen von „Tag“, in den Einträgen (Tipp zum Ändern oder Löschen), im Muster als eigener Filter und in „Frag nach“. Schlaf nachtragen geht am Tablet mit ＋ neben den Schlafknöpfen, am Handy über „＋ Nachtragen“ bei den Einträgen, in beiden Fällen auch für beide Kinder auf einmal; überschneidende Phasen werden abgelehnt.
- **Momente:** erscheint unten in der Leiste, sobald `milestone_calendar` gesetzt ist, und zeigt die `fp-milestone-card` in den Farben der Übersicht (Erste Male, Entwicklung, Bewegung, Abhaken mit Dialog). Ein eigener Tab für die Meilensteine ist damit nicht nötig. Das gewählte Kind ist in Übersicht und Meilensteinen dasselbe. `memories_path` wird nur noch genutzt, wenn kein `milestone_calendar` gesetzt ist.
- **Wachstum:** erscheint unten in der Leiste, sobald `weight_calendar` gesetzt ist. Oben das letzte Gewicht mit Alter, Perzentile und der Zunahme seit der Messung davor (Ø g am Tag), darunter Zunahme seit der Geburt, Schnitt pro Woche und die Perzentile jetzt und bei der Geburt. Die Kurve zeigt das Gewicht nach Lebenswochen bzw. -monaten, mit `growth_data` und `sex` je Kind auch die Bänder P3–P97 und P50, ein Stück in die Zukunft und mit einer Linie bei heute. „Bemerkt“ nennt gerechnete Beobachtungen wie den tiefsten Wert nach der Geburt, wann das Geburtsgewicht wieder erreicht war oder eine neue Kilomarke. „⚖️ Wiegen“ trägt ein, ein Tipp auf eine Messung oder einen Punkt ändert oder löscht sie; pro Kind und Tag bleibt es bei einem Wert. Als Geburtsgewicht gilt der Wert am Geburtstag.
- **Frag nach:** Vorschläge wie „Wie war die letzte Nacht?“ oder freie Fragen. Die Karte rechnet Tageswerte, Nächte und die Einträge der letzten drei Tage vor und gibt sie mit der Frage und dem bisherigen Gespräch an `ai_task.generate_data`. **Diese Daten gehen an den KI-Dienst, der hinter der `ai_task`-Entity steht.** Die Antworten sind kein ärztlicher Rat.

#### Baby-Leiste (`layout: bar`)

Mit `layout: bar` wird aus der Karte eine schmale Leiste für die Startseite (Sections-View, volle Breite): eine flache Pille ohne Überschrift, in der je Kind ein Element steht, mit Kürzel oder Foto, Name, der letzten Mahlzeit („satt seit 1:10 h“) und der Spanne der nächsten („22:24–22:49“). Liegt die Uhrzeit gerade in der Spanne, steht „jetzt–22:49“, danach ein „Fällig“-Chip. Während des Stillens zeigt ein pulsierender Punkt „stillt · 12 Min“, dann ohne Spanne. Ohne Prognose (weniger als vier Abstände in den letzten 72 Stunden) steht nur „satt seit …“, ohne Eintrag „noch nichts eingetragen“, und liegt die letzte Mahlzeit länger als acht Stunden zurück, „letzte vor …“. Die Zahlen und Regeln sind die der Karte „Nächste Mahlzeit“ im Baby-Tab. Ab 700 px Breite stehen die Kinder in einer Zeile, getrennt durch einen dünnen Strich, darunter in je einer Zeile untereinander. Farben und Ecken kommen aus dem Theme, hell und dunkel; bei „Bewegung reduzieren“ pulsiert nichts. Mit `bar_style: inline` entfallen Pille, Rahmen, Fläche und Außenabstand: Die Kinder stehen immer untereinander, Farbe und Schriftgröße erben vom Behälter, Gedämpftes ist über die Deckkraft abgesetzt. Das ist für die Begrüßung gedacht (`baby` der `fp-glance-card`), geht aber auch in einer eigenen Karte.

```yaml
type: custom:fp-baby-overview-card
layout: bar
nav_path: /familienplaner/baby       # optional: Tab, den ein Tipp auf ein Kind öffnet (ohne nav_path nur Anzeige)
# bar_style: inline                  # optional: ohne Pille, eine Zeile je Kind in Farbe und Größe des Behälters
meal_pause_entity: input_number.stillen_pause_bis_neue_mahlzeit   # optional, wie in der Übersicht
kids:
  - key: kind_a                      # dieselben key in derselben Reihenfolge wie im Baby-Tab
    name: Kind A
    color: "#4A7A3A"
    picture: /local/kind_a.jpg       # optional: Foto (oder entity: person.kind_a)
    feeding_calendar: calendar.stillprotokoll_kind_a
    switch: input_boolean.stillen_kind_a
    start: input_datetime.stillen_kind_a_beginn
  - key: kind_b
    name: Kind B
    color: "#7A4A78"
    # … gleich wie oben
```

Die `kids`-Angaben lassen sich aus dem Baby-Tab kopieren; die Leiste braucht davon `key`, `name`, `color`, `picture` bzw. `entity`, `feeding_calendar`, `switch` und `start`. Sie lädt nur die Stillkalender der letzten vier Tage und liest sonst die Schalter aus Home Assistant: Windeln, Schlaf, Gewicht, Meilensteine und `growth_data` bleiben außen vor, `reminder_entity` und `reminder_night_entity` braucht sie nicht. Ein Tipp auf ein Kind merkt sich dieses Kind im Browser (dieselbe Merkung wie der Kindschalter im Baby-Tab) und öffnet `nav_path`; der Baby-Tab springt beim Wiederöffnen zu diesem Kind. Das klappt nur, wenn Leiste und Tab dieselben `key` in derselben Reihenfolge haben. Am besten als eigene Karte ganz oben in einem Abschnitt der Startseite.

### Beispiel: fp-assistant-card

```yaml
type: custom:fp-assistant-card
name: Pip                     # Name der Figur (Vorgabe „Pip“)
pipeline_id: 01abc...                 # Assist-Pipeline (ID aus Einstellungen → Sprachassistenten); ohne = bevorzugte Pipeline
speak: auto                   # auto = vorlesen nur, wenn per Mikrofon gefragt; always; never
suggestions:                  # Chips; Vorgaben siehe unten
  - { icon: "📅", text: "Was steht heute an?" }
dashboard: familien-planer    # optional, sonst aus der URL
lift: { baby: 76 }            # optional: am Handy (unter 700 px) auf Seiten, deren letzter Pfadteil hier steht, um so viele px nach oben rücken (Vorgabe baby: 76)
position: right               # right (Vorgabe) | left: Figur unten rechts oder unten links
wake_word:                    # optional: Aktivierungswort, erkannt im Browser; ohne diesen Block gibt es die Funktion nicht
  name: Hey Pip                       # Anzeige im Schalter (Vorgabe „Hey <Name>“)
  model: /local/fp-wake/hey_pip.onnx  # Weckwort-Modell (openWakeWord, ONNX)
  base: /local/fp-wake/               # Ordner mit melspectrogram.onnx und embedding_model.onnx (Vorgabe: Ordner von model)
  threshold: 0.5                      # Schwelle 0..1 (Vorgabe 0.5)
  patience: 2                         # so viele Blöcke à 80 ms in Folge über der Schwelle (Vorgabe 2)
```

Die Karte ist **unsichtbar** (nur beim Bearbeiten steht ein kleiner Platzhalter da). Sie merkt sich ihre Einstellungen im Browser und holt eine einzige schwebende Figur an die Seite. Die Figur erscheint danach in **allen Tabs** des Dashboards, auch wenn direkt ein anderer Tab neu geladen wird. Die Karte muss dafür in einem Tab liegen und auf jedem Gerät einmal geladen worden sein. Pip braucht eine **Assist-Pipeline mit Gesprächsagent**; ohne `pipeline_id` gilt die bevorzugte Pipeline. `lift` hebt die Figur am Handy über eine klebende Aktionsleiste, etwa im Baby-Tab: Steht der letzte Teil der Adresse (`/familien-planer/baby` → `baby`) in `lift`, rückt sie um den Wert in Pixel nach oben; mit `lift: {}` bleibt sie immer unten. Das **Mikrofon** gibt es nur über eine sichere Verbindung (https), sonst bleibt es beim Schreiben. Mit `position: left` sitzt die Figur am linken Rand des Inhaltsbereichs, also rechts neben der HA-Seitenleiste (ausgeklappt, eingeklappt oder im Kiosk-Modus ohne Seitenleiste), und das Gespräch öffnet sich auf derselben Seite; `lift` wirkt auf beiden Seiten gleich. Die Vorgabe-Vorschläge sind „Was steht heute an?“, „Was gibt's heute zum Abendessen?“, „Wann haben die Zwillinge zuletzt getrunken?“, „Was steht auf der Einkaufsliste?“, „Brauchen wir morgen einen Schirm?“ und „Ist die Wohnungstür zugesperrt?“.

**Aktivierungswort:** Mit `wake_word` erscheint im Gespräch ein Schalter „Auf „Hey Pip“ hören“, **pro Gerät** gespeichert und zunächst aus. Ist er an, bleibt das Mikrofon offen und ein kleines Modell erkennt das Wort **im Browser** (openWakeWord über onnxruntime-web); erst danach geht Ton an Home Assistant, ab der Spracherkennung wie beim Mikrofon-Knopf und aus demselben Mikrofon-Strom. Pip spielt dabei einen kurzen Ton und öffnet das Gespräch. Solange er antwortet und vorliest, hört die Erkennung nicht zu. Ein am Wort geöffnetes Gespräch schließt sich 30 Sekunden nach der Antwort von selbst, wenn niemand etwas antippt. Ein kleiner Punkt an der Figur zeigt, dass Pip zuhört.

- **Nur über https.** Ohne sichere Verbindung ist der Schalter gesperrt. Am iPad bzw. in der Kiosk-App startet Audio erst nach einer Berührung: Nach einem Neuladen steht am Schalter „Einmal tippen, dann hört Pip zu“, ein Tipp irgendwo auf der Seite reicht. Verliert das Gerät das Mikrofon oder wird die Seite verdeckt, schließt Pip es und öffnet es bei der Rückkehr wieder (am iPad ggf. nach einem Tipp).
- **Modelle:** `melspectrogram.onnx`, `embedding_model.onnx` und das Weckwort-Modell (z. B. `hey_pip.onnx`) in `/config/www/fp-wake/` ablegen, sie sind dann unter `/local/fp-wake/` erreichbar. Die beiden Basismodelle gibt es bei [openWakeWord](https://github.com/dscripka/openWakeWord/releases) (Version 0.5.1). Fehlt eine Datei, steht am Schalter ein Hinweis; die übrigen Funktionen laufen weiter.
- **Erkennung laden:** onnxruntime-web (feste Version, einige MB) wird beim ersten Einschalten von `cdn.jsdelivr.net` geladen und danach vom Browser zwischengespeichert; dafür braucht das Gerät Internet.
- **Lizenzen:** Der Code von openWakeWord und die Basismodelle (Mel-Spektrogramm, Embedding) stehen unter Apache-2.0, die vortrainierten Weckwörter (etwa „hey jarvis“) unter CC BY-NC-SA 4.0, also nur für nichtkommerzielle Nutzung. Für ein selbst trainiertes Modell gelten die Lizenzen der Trainingsdaten (beim offiziellen Trainingsweg teils ebenfalls nur nichtkommerziell).
- **Feinabstimmung:** Löst Pip zu oft aus, `threshold` erhöhen oder `patience` auf 3 setzen; hört er zu selten, `threshold` senken. Ein eigenes Wort sollte mindestens drei Silben haben (etwa „Hey Pipo“ statt „Hey Pip“): Kurze Wörter werden schlechter erkannt und lösen öfter falsch aus. Ein Modell, das aus mehreren gemittelten Netzen besteht, verträgt eine höhere Schwelle (z. B. `threshold: 0.8`, `patience: 1`).

**Aktionskarten:** Eine Automation oder ein Skript schickt das Ereignis `fp_pip_karte`; Pip zeigt es nur, solange eine Frage läuft oder die Antwort höchstens 20 Sekunden her ist (und nur für Konten, die Ereignisse abonnieren dürfen, also Administratoren).

```yaml
- event: fp_pip_karte
  event_data:
    art: neu                     # neu | bestaetigen | info
    titel: Termin angelegt
    zeilen:                      # je Zeile [links, rechts]
      - ["Zahnarzt", "Di 27.10. 10:30"]
    rueckgaengig:                # nur bei art: neu, 10 Sekunden lang als Knopf „Rückgängig“
      typ: kalender              # kalender (kalender, summary, start) oder liste (liste, eintraege)
      kalender: calendar.familie
      summary: Zahnarzt
      start: "2026-10-27 10:30:00"   # lokal, JJJJ-MM-TT HH:MM:SS oder JJJJ-MM-TT
```

- `neu`: Karte mit dem Knopf „Rückgängig“. Bei `typ: kalender` sucht Pip den Termin mit gleicher `summary` und gleichem Beginn am `start`-Tag und löscht ihn; bei `typ: liste` entfernt es jeden Eintrag aus `eintraege` per `todo.remove_item` von der To-do-Liste `liste`. Nach 10 Sekunden steht dort „✓ erledigt“.
- `bestaetigen`: Karte mit „Ja, mach das“ und „Abbrechen“; ein Tipp schickt „Ja“ bzw. „Nein“ als normale Nachricht in dasselbe Gespräch. Das Feld `code` ist für die eigene Automation gedacht und wird nicht angezeigt.
- `info`: nur Titel und Zeilen.

Der Verlauf liegt nur im Speicher (die letzten 40 Einträge), ↺ im Kopf beginnt ein neues Gespräch. Nach fünf Minuten ohne Nachricht beginnt für Home Assistant ein neuer Gesprächsfaden, der Verlauf bleibt sichtbar. Die Einstellungen liegen im Browser unter `fp-pip-dock:<dashboard>`, der Schalter für das Aktivierungswort unter `fp-pip-wake:<dashboard>`; wird die Karte entfernt, verschwindet die Figur erst, wenn der erste Eintrag gelöscht ist.

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
