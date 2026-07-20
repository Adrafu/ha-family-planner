# Contributing to Family Planner Cards

Danke für dein Interesse, an den Family Planner Cards mitzuarbeiten! Dieses Dokument beschreibt die Architektur, die Code-Konventionen und den Entwicklungs-/Release-Workflow. Bitte lies es, bevor du einen Pull Request öffnest.

## Überblick & Architektur

Das Repo liefert **sieben Lovelace-Karten in einer einzigen JavaScript-Datei** (`family-planner-cards.js`). Leitgedanke ist „Integrations-First": bewährte Bausteine (Kalender, To-do-Entities, ChoreOps, `clock-weather-card` …) kombinieren und die Energie in die UX der eigenen Karten stecken.

Jede Karte ist ein eigenständiges, IIFE-gekapseltes Custom Element:

```js
/* ===== meal-grid-card v17 (kurze Beschreibung der Aenderung) ===== */
(() => {
  const U = window.__fpUtils;   // gemeinsame Helfer
  const CP = U.cp;
  class MealGridCard extends HTMLElement { /* … */ }
  if (!customElements.get("meal-grid-card")) {
    customElements.define("meal-grid-card", MealGridCard);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: "meal-grid-card", name: "Meal Grid Card", description: "…" });
  }
})();
```

Wichtige Punkte:

- **Ein `if (!customElements.get(...))`-Guard** pro Karte verhindert Doppelregistrierung.
- **Gemeinsame Helfer** liegen global in `window.__fpUtils` (`cp`, `esc`, `pad`, `norm`, `reEsc`, `toast`). Jede Karte holt sie sich oben mit `const U = window.__fpUtils; const CP = U.cp;` — bitte keine Helfer duplizieren.
- **Keine Build-Tools, kein Bundler.** Reines ES ohne Transpilation; die Datei wird direkt als `module`-Resource geladen.

## Projektstruktur

| Datei | Zweck |
|---|---|
| `family-planner-cards.js` | **Produktions-Quelle** — hier wird editiert. Enthält alle Karten. |
| `README.md` | Nutzer-Doku (wird von HACS gerendert). |
| `hacs.json` | HACS-Manifest (`filename`, `render_readme`). |
| `CONTRIBUTING.md` | Dieses Dokument. |

Die Beta-Datei (`family-planner-cards-beta.js`) und Dashboard-/Theme-Konfiguration sind **nicht** Teil des Repos — sie werden lokal aus der Quelle generiert bzw. leben in der jeweiligen Home-Assistant-Instanz.

## Entwicklungsumgebung & Test

Es genügt Node (für die Syntaxprüfung) und eine Home-Assistant-Testinstanz.

1. Änderungen in `family-planner-cards.js` machen.
2. Syntax prüfen:

   ```bash
   node --check family-planner-cards.js
   ```

3. Zum Ausprobieren die Datei nach `/config/www/` (also `/local/…`) der Testinstanz kopieren und als Dashboard-Resource vom Typ `module` einbinden. **Nach jedem Upload** den Cache-Buster hochzählen (`/local/family-planner-cards.js?v=N`) — siehe [Gotchas](#gotchas).

## Karten-Konventionen

Bitte halte dich an folgende Konventionen — die meisten Review-Kommentare drehen sich darum:

- **Versions-Kommentar bumpen.** Jede Karte trägt in ihrem Banner eine Version (`/* ===== <card> vN (…) ===== */`). Wird eine Karte geändert, die Nummer erhöhen und die Klammer kurz beschreiben. Bei einem Release zusätzlich die Datei-Kopfzeile (Zeile 1) bumpen.
- **Echte Umlaute in UI-Text.** Alles, was der Nutzer sieht (Labels, Buttons, Toasts, Platzhalter), schreibt `ü/ö/ä/ß` echt aus — **keine** ASCII-Ersatzformen wie `hinzufuegen`. ASCII ist ausschließlich in rein funktionalen, nicht sichtbaren Strings erlaubt (z. B. Schlüssel für Emoji-Matching oder die Normalisierung in `U.norm`).
- **Fehler-Toasts sauber halten.** Den allerersten Ladefehler unterdrücken (Startup-Flackern) — üblich über ein `_loadedOnce`-Flag, das erst nach dem ersten Fetch gesetzt wird. Fallbacks, die ein Duplikat hinterlassen könnten (z. B. „neu anlegen + alt löschen"), zeigen einen **expliziten** Toast statt still zu scheitern.
- **Theme statt Hardcoding.** Karten-Außenrand und -Schatten kommen global aus dem Theme, nicht per Karte. **Interne** Linien (Rasterzellen, Chips …) sind theme-adaptiv über `var(--divider-color)` bzw. die HA-CSS-Variablen (`--primary-text-color`, `--card-background-color`, …) — keine festen Hex-Farben, die im hellen/dunklen Theme brechen.
- **`custom:`-Präfix.** In Dashboard-Configs heißen die Karten `custom:meal-grid-card` usw. Beim Prüfen/Filtern von Kartentypen immer mit Präfix vergleichen.
- **Kein Browser-Storage-Missbrauch.** `localStorage` nur für unkritische UI-Präferenzen (z. B. eingeklappte Legende) und defensiv (try/catch) verwenden.

## Beta-Workflow

Änderungen werden erst ausgiebig in einer **Beta** getestet, bevor sie produktiv gehen. Die Beta-Datei entsteht durch Umbenennen aller Kartentypen mit `-beta`-Suffix:

```bash
sed -e 's/meal-grid-card/meal-grid-card-beta/g' \
    -e 's/family-calendar-card/family-calendar-card-beta/g' \
    -e 's/kids-routine-card/kids-routine-card-beta/g' \
    -e 's/shopping-fav-card/shopping-fav-card-beta/g' \
    -e 's/fp-todo-card/fp-todo-card-beta/g' \
    -e 's/nav-card/nav-card-beta/g' \
    -e 's/fp-glance-card/fp-glance-card-beta/g' \
    family-planner-cards.js > family-planner-cards-beta.js
```

Danach:

1. `node --check` auf **beide** Dateien.
2. Beta-Datei nach `/local/` der Testinstanz hochladen.
3. Cache-Buster `?v=N` der Beta-Resource hochzählen — **erst nach** dem Upload.
4. In einem separaten Beta-Dashboard (idealerweise `require_admin`) testen, das dieselbe View-Struktur wie Prod nutzt.

Die `-beta`-Datei wird **immer frisch aus der aktuellen Quelle** gebaut (obige `sed`-Kette), nie aus einem älteren Stand — sonst fehlen Änderungen.

## Release-Workflow

Wenn eine Änderung in der Beta bestätigt ist:

1. Datei-Kopfzeile (Version) und ggf. README aktualisieren.
2. Committen und taggen:

   ```bash
   git add family-planner-cards.js README.md
   git commit -m "vX.Y.Z: kurze Zusammenfassung"
   git tag vX.Y.Z
   git push && git push --tags
   ```

3. In HACS auf die neue Version updaten, danach Browser-Cache leeren / hart neu laden.

Versioniere nach [SemVer](https://semver.org/lang/de/): Bugfix → Patch, neue abwärtskompatible Funktion → Minor, Breaking Change an einer Karten-API → Major.

## Pull Requests

- Halte PRs fokussiert (idealerweise eine Karte / ein Thema).
- Beschreibe **was** und **warum**, und wie du getestet hast (welche HA-Version, welche Karte).
- Stelle sicher, dass `node --check family-planner-cards.js` fehlerfrei durchläuft.
- Bumpe den Versions-Kommentar der geänderten Karte(n).
- Screenshots bei UI-Änderungen sind sehr willkommen.

Sei freundlich und konstruktiv im Umgang miteinander — wir wollen ein einladendes Projekt.

## Gotchas

- **Service-Worker-Cache-Falle:** Den `?v=`-Cache-Buster **immer erst nach** dem Upload der neuen Datei hochzählen. Sonst serviert der Service Worker die alte Version trotz Hard-Refresh.
- **Beta aus der aktuellen Quelle bauen** (die `sed`-Kette), nicht aus einer Kopie.
- **`custom:`-Präfix** bei Typvergleichen nicht vergessen.
- **Abhängigkeiten:** Einige Karten binden andere HACS-Karten ein oder ergänzen sie (z. B. bettet `fp-glance-card` die `clock-weather-card` ein, `fp-todo-card` die native `todo-list`). Solche Abhängigkeiten in Doku und PR-Beschreibung nennen.

## Lizenz

Mit einem Beitrag stimmst du zu, dass dein Code unter der **MIT-Lizenz** dieses Projekts veröffentlicht wird.
