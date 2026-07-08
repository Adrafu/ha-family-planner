# Family Planner Cards

Sechs eigene Lovelace-Karten für einen Home-Assistant-Familienplaner:

- **`meal-grid-card`** — Wochen-Essensplan als Kästchen-Raster (Frühstück/Mittag/Abend), gespeist aus einem Kalender, mit Inline-Bearbeitung, Food-Emojis und optionalem KI-Vorschlag (`ai_task`). `background` akzeptiert wahlweise ein Bild (URL → dunkles Overlay + weißer Text) **oder** einen CSS-Farbwert/Verlauf (heller Hintergrund, dunkler Text).
- **`family-calendar-card`** — Familienkalender mit echtem Wochen-Stunden-Raster + Monatsansicht, Präfix-basierter Aufteilung mehrerer Personen aus einem Kalender und einzeln umschaltbarer Legende. Termine direkt anlegen, bearbeiten und löschen. Jetzt-Linie (Outlook-Stil), hellblaues Heute-Highlight und ausgegraute vergangene Tage.
- **`kids-routine-card`** — Buddy-artige Routinen für Kinder: Aufgaben mit Emoji nach Tageszeit, antippen zum Abhaken (Sterne via ChoreOps), mit Belohnungs-Animation.
- **`shopping-fav-card`** — Schnell-Buttons für Lieblings-Artikel/-Aufgaben (ein Tipp legt das Item auf die To-do-Liste) inkl. Editor zum Hinzufügen/Entfernen/Sortieren; Favoriten in einem `input_text`, Emojis automatisch abgeleitet. Optional als „Hinzufügen"-Button mit kombiniertem Dialog (Freitext + Favoriten + Zuweisung + Fälligkeit, alles konfigurierbar).
- **`nav-card`** — Hüllt eine beliebige Karte ein und macht sie als Ganzes anklickbar: Tipps auf nicht-interaktive Bereiche navigieren zu einem Tab, interaktive Elemente (Checkboxen, Eingabefelder, anklickbare Zellen) bleiben aktiv.
- **`fp-todo-card`** — Hüllt die native `todo-list`-Karte ein (identischer Look, volles Bearbeiten/Abhaken) und fügt **optimistisches Hinzufügen** hinzu: neue Einträge erscheinen sofort in der Liste (auch über das native Feld oder das `fp-todo-add`-Event der `shopping-fav-card`), noch bevor Cloud-Listen wie Todoist/Bring nachziehen.

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

### Beispiel: meal-grid-card

```yaml
type: custom:meal-grid-card
entity: calendar.essensplan
mode: week            # oder "compact" (heute + morgen)
title: Wochenplan
ai_entity: ai_task.google_ai_task
background: "https://example.com/bild.jpg"
meals:
  - { label: "Frühstück", start: 0, end: 11 }
  - { label: "Mittag", start: 11, end: 15 }
  - { label: "Abend", start: 15, end: 24 }
```

### Beispiel: family-calendar-card

```yaml
type: custom:family-calendar-card
title: Familienkalender
initial_view: week    # oder "month"
day_start: 6
day_end: 23
persons:
  - { name: Familie, color: "#E53935", calendar: calendar.familie, match: none }
  - { name: Tobi, color: "#1E88E5", calendar: calendar.familie, prefix: "T" }
  - { name: Verena, color: "#8E24AA", calendar: calendar.familie, prefix: "V" }
  - { name: Kind I, color: "#43A047", calendar: calendar.kind_i }
```

### Beispiel: shopping-fav-card

```yaml
type: custom:shopping-fav-card
list_entity: todo.zuhause            # To-do-Liste, auf die getippte Favoriten wandern
store_entity: input_text.einkauf_favoriten   # Helper, der die Favoriten speichert
columns: 3
```

Der Helper `input_text.einkauf_favoriten` muss vorab angelegt sein (max. 255 Zeichen). Favoriten werden als kommagetrennte Liste gespeichert; der „Favoriten bearbeiten"-Button öffnet einen Editor.

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
  - { label: Tobi, entity: todo.tobi }
  - { label: Verena, entity: todo.verena }
```

### Beispiel: nav-card

```yaml
type: custom:nav-card
path: /lovelace/einkauf      # Ziel-Tab beim Tippen auf nicht-interaktive Bereiche
card:
  type: todo-list
  entity: todo.zuhause
```

### Beispiel: fp-todo-card

Übernimmt alle Optionen der nativen `todo-list`-Karte (`title`, `hide_completed`, `hide_create`, `display_order`, `card_mod`, `hide_section_headers` …) und ergänzt optimistisches Hinzufügen.

```yaml
type: custom:fp-todo-card
entity: todo.allgemein
title: Allgemein
hide_create: true
display_order: duedate_asc
```

Neue Einträge erscheinen sofort (leicht ausgegraut) und werden ersetzt, sobald das Backend nachzieht. Adds über die `shopping-fav-card` (Event `fp-todo-add`) und über das native Eingabefeld werden erkannt.

## Lizenz

MIT
