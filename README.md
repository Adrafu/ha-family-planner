# Family Planner Cards

Vier eigene Lovelace-Karten für einen Home-Assistant-Familienplaner:

- **`meal-grid-card`** — Wochen-Essensplan als Kästchen-Raster (Frühstück/Mittag/Abend), gespeist aus einem Kalender, mit Inline-Bearbeitung, Food-Emojis und optionalem KI-Vorschlag (`ai_task`).
- **`family-calendar-card`** — Familienkalender mit echtem Wochen-Stunden-Raster + Monatsansicht, Präfix-basierter Aufteilung mehrerer Personen aus einem Kalender und einzeln umschaltbarer Legende. Termine direkt anlegen, bearbeiten und löschen.
- **`kids-routine-card`** — Buddy-artige Routinen für Kinder: Aufgaben mit Emoji nach Tageszeit, antippen zum Abhaken (Sterne via ChoreOps), mit Belohnungs-Animation.
- **`shopping-fav-card`** — Schnell-Buttons für Lieblings-Einkaufsartikel (ein Tipp legt das Item auf die To-do-Liste) inkl. Editor zum Hinzufügen/Entfernen/Sortieren; Favoriten in einem `input_text`, Emojis automatisch abgeleitet.

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

## Lizenz

MIT
