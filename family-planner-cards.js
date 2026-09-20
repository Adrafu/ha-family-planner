/* Family Planner custom cards v2.3.1 - meal-grid-card + family-calendar-card + kids-routine-card + shopping-fav-card + nav-card + fp-todo-card + fp-glance-card + fp-cookbook-card + dobby-clock-card */

/* ===== shared utils (einmal global, von allen Karten genutzt) ===== */
// Achtung: Auf dem Beta-Dashboard sind Prod- und Beta-Datei gleichzeitig geladen.
// Ein "if (window.__fpUtils) return" wuerde bedeuten, dass die zuerst geladene
// Datei gewinnt — neue Helfer aus der zweiten Datei fehlen dann und die Karten
// sterben beim Aufbau. Deshalb zusammenfuehren statt abbrechen: vorhandene
// Implementierungen bleiben, fehlende kommen dazu.
(() => {
  const defaults = {
    cp: c => String.fromCodePoint(c),
    esc: s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    pad: n => String(n).padStart(2, "0"),
    norm: s => { let out = ""; for (const ch of String(s).toLowerCase()) { const c = ch.codePointAt(0); if (c === 0xe4) out += "a"; else if (c === 0xf6) out += "o"; else if (c === 0xfc) out += "u"; else if (c === 0xdf) out += "ss"; else out += ch; } return out; },
    reEsc: s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    toast: (el, msg) => { try { el.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: msg }, bubbles: true, composed: true })); } catch (e) {} },
    // Karte fuellt ihre Rasterzelle aus.
    // HA gibt dem Grid-Item (div.card) die Zeilenhoehe, dazwischen sitzt aber
    // <hui-card> ganz ohne eigene Hoehe (light DOM, keine Styles). Damit reisst
    // die Hoehenkette und die Karte bleibt auf Inhaltshoehe stehen — sichtbar,
    // sobald zwei verschieden hohe Karten in derselben Rasterzeile liegen.
    fill: el => {
      el.style.display = "block";
      el.style.height = "100%";
      const p = el.parentElement;
      if (p && p.localName === "hui-card") { p.style.display = "block"; p.style.height = "100%"; }
    },
  };
  // In dasselbe Objekt hineinschreiben, nicht ersetzen: Karten der anderen
  // Datei halten bereits eine Referenz darauf.
  const u = window.__fpUtils || (window.__fpUtils = {});
  for (const k of Object.keys(defaults)) if (!(k in u)) u[k] = defaults[k];

  // Formularelemente erben die Schrift nicht — sie nehmen die des Systems.
  // Unsere Karten leben im Light DOM, ein Stil im Kopf reicht also aus.
  // Betrifft Knoepfe, Eingabefelder und Textbereiche in allen eigenen Karten.
  const SID = "fp-form-font";
  if (!document.getElementById(SID)) {
    const st = document.createElement("style");
    st.id = SID;
    st.textContent = "button,input,select,textarea{font-family:inherit;}";
    document.head.appendChild(st);
  }
})();

/* ===== eigener Symbolsatz „fp" =====
   Home Assistant kennt nur die Namen, die Material Design Icons mitliefert — und
   eine Socke ist nicht dabei (nur Steckdosen heissen dort „socket"). Ein Name,
   den es nicht gibt, wird stillschweigend als nichts gezeichnet.
   Ueber window.customIconsets laesst sich ein eigener Praefix anmelden; danach
   ist „fp:socke" ueberall dort verwendbar, wo HA ein Icon erwartet — also auch
   als Symbol eines Dashboard-Tabs.
   Pfade in einem 24x24-Raster, selbst gezeichnet. */
(() => {
  const ICONS = {
    // Socke im Profil, Zehe nach links. Drei getrennte Flaechen statt
    // ausgestanzter Loecher: Bundblock, Streifen, Koerper. So haengt nichts an
    // der Fuellregel, und die beiden Luecken bleiben auch bei 18px echte Luecken
    // — sie sind das Merkmal, an dem man eine Socke von einem Stiefel unterscheidet.
    socke: "M12,2.6 H17.8 A1.2,1.2 0 0 1 19,3.8 V5.2 H10.8 V3.8 A1.2,1.2 0 0 1 12,2.6 Z "
      + "M10.8,6.6 H19 V8.2 H10.8 Z "
      + "M10.8,9.6 H19 V15.6 Q19,20.8 13.8,20.8 H9.2 Q4.8,20.8 4.8,17.3 Q4.8,13.8 9.2,13.8 C10.2,13.8 10.8,13 10.8,11.8 Z",
  };
  // Wie beim Utils-Block: auf dem Beta-Dashboard sind Prod- und Beta-Datei
  // gleichzeitig geladen. Der Aufloeser darf deshalb nicht seine eigene Liste
  // einschliessen, sonst kennt er nur die Symbole der zuerst geladenen Datei.
  // Stattdessen alle in dasselbe Verzeichnis legen und daraus nachschlagen.
  const REG = window.__fpIcons || (window.__fpIcons = {});
  for (const k of Object.keys(ICONS)) if (!(k in REG)) REG[k] = ICONS[k];

  const sets = window.customIconsets || (window.customIconsets = {});
  if (!sets.fp) {
    sets.fp = async (name) => {
      const path = REG[name];
      if (!path) throw new Error(`fp-Symbol "${name}" gibt es nicht`);
      return { path };
    };
  }
})();

/* ===== meal-grid-card v25 (Heute als Ring statt Einfaerbung, Knopfleiste im Theme-Ton, Feldfarbe je Mahlzeit, meal_labels und empty_text, hide_header fuer die Uebersicht, Leistenfarbe via --fp-bar-bg; „Zum Rezept" springt ins eigene Kochbuch, wenn das Gericht dort steht; sonst Web-Suche) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class MealGridCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Wochenplan", mode: "week", week_offset: 0, nav_path: "",
      show_emojis: true, meal_icons: true, background: "",
      ai_suggest: true, ai_entity: "", recipe_url: "https://www.chefkoch.de/rs/s0/{q}/Rezepte.html",
      hide_header: false,                   // Wochenansicht ohne Kopfleiste und Wochennavigation (fuer die Uebersicht)
      meal_labels: true,                    // Beschriftung neben dem Mahlzeit-Symbol
      empty_text: "+",                      // was in einer leeren Zelle steht
      cookbook_entity: "todo.kochbuch", weather_entity: "weather.home", cookbook_path: "",
      meals: [
        { label: "Frühstück", start: 0, end: 11 },
        { label: "Mittag", start: 11, end: 15 },
        { label: "Abend", start: 15, end: 24 },
      ],
    }, config || {});
    if (!this.config.entity) throw new Error("Bitte 'entity' (einen Kalender) angeben");
    this._offset = this.config.week_offset || 0;
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
  }
  set hass(hass) { this._hass = hass; this._maybeFetch(); }

  _range() {
    const now = new Date();
    let startDate, days;
    if (this.config.mode === "compact") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); days = 2;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow + this._offset * 7);
      startDate = d; days = 7;
    }
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + days);
    return { startDate, endDate, days };
  }

  async _maybeFetch(force) {
    if (!this._hass) return;
    const { startDate, endDate, days } = this._range();
    const key = this.config.entity + "|" + startDate.toISOString() + "|" + days;
    const now = Date.now();
    if (!force && key === this._rangeKey && now - this._lastFetch < 60000) return;
    this._rangeKey = key; this._lastFetch = now;
    try {
      const s = encodeURIComponent(startDate.toISOString());
      const e = encodeURIComponent(endDate.toISOString());
      const evts = await this._hass.callApi("GET", `calendars/${this.config.entity}?start=${s}&end=${e}`);
      this._events = Array.isArray(evts) ? evts : [];
    } catch (err) { this._events = []; if (this._loadedOnce) this._toast("Essensplan: Kalender konnte nicht geladen werden"); }
    this._loadedOnce = true; // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._render();
  }

  _norm(s) { return U.norm(s); }
  _clean(t) { return t ? String(t).replace(/^[\s\p{P}\p{S}]+/u, "").trim() : ""; }
  _esc(s) { return U.esc(s); }
  _pad(n) { return U.pad(n); }
  _toast(msg) { U.toast(this, msg); }
  _evDate(ev) { const dt = (ev.start && (ev.start.dateTime || ev.start.date)) || ev.start; return new Date(dt); }
  _nav(path) { history.pushState(null, "", path); window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true })); }

  _food(dish) {
    const n = this._norm(dish);
    const map = [
      ["spaghet", 0x1F35D], ["lasagne", 0x1F35D], ["nudel", 0x1F35D], ["pasta", 0x1F35D], ["tortellini", 0x1F35D],
      ["pizza", 0x1F355], ["risotto", 0x1F35A], ["reis", 0x1F35A],
      ["eintopf", 0x1F372], ["suppe", 0x1F372], ["supp", 0x1F372], ["curry", 0x1F35B],
      ["porridge", 0x1F963], ["haferbrei", 0x1F963], ["muesli", 0x1F963], ["musli", 0x1F963], ["joghurt", 0x1F963], ["cornflakes", 0x1F963],
      ["croissant", 0x1F950], ["broetchen", 0x1F950], ["brotchen", 0x1F950], ["semmel", 0x1F950],
      ["toast", 0x1F35E], ["brot", 0x1F35E],
      ["spiegelei", 0x1F373], ["ruehrei", 0x1F373], ["ruhrei", 0x1F373], ["omelett", 0x1F373], ["eier", 0x1F373],
      ["salat", 0x1F957],
      ["pommes", 0x1F35F], ["fries", 0x1F35F], ["kartoffel", 0x1F954], ["erdapfel", 0x1F954], ["knoedel", 0x1F359], ["knodel", 0x1F359],
      ["schnitzel", 0x1F356], ["steak", 0x1F356], ["braten", 0x1F356], ["gulasch", 0x1F356], ["fleisch", 0x1F356],
      ["bratwurst", 0x1F32D], ["hotdog", 0x1F32D], ["wurst", 0x1F32D], ["aufschnitt", 0x1F953], ["speck", 0x1F953],
      ["haehnchen", 0x1F357], ["hahnchen", 0x1F357], ["haendl", 0x1F357], ["chicken", 0x1F357], ["pute", 0x1F357], ["huhn", 0x1F357],
      ["lachs", 0x1F41F], ["thunfisch", 0x1F41F], ["fisch", 0x1F41F], ["sushi", 0x1F363],
      ["burger", 0x1F354], ["taco", 0x1F32E], ["burrito", 0x1F32F], ["wrap", 0x1F32F], ["doener", 0x1F959], ["doner", 0x1F959], ["kebab", 0x1F959],
      ["pfannkuchen", 0x1F95E], ["palatschinke", 0x1F95E], ["pancake", 0x1F95E], ["waffel", 0x1F9C7],
      ["kaese", 0x1F9C0], ["kase", 0x1F9C0],
      ["brokkoli", 0x1F966], ["broccoli", 0x1F966], ["karfiol", 0x1F966], ["blumenkohl", 0x1F966], ["gemuese", 0x1F966], ["gemuse", 0x1F966],
      ["paprika", 0x1FAD1], ["peperoni", 0x1F336], ["chili", 0x1F336], ["chilli", 0x1F336], ["scharf", 0x1F336],
      ["tomate", 0x1F345], ["paradeiser", 0x1F345], ["pilz", 0x1F344], ["champignon", 0x1F344], ["mais", 0x1F33D],
      ["karotte", 0x1F955], ["moehre", 0x1F955], ["mohre", 0x1F955], ["zucchini", 0x1F952], ["gurke", 0x1F952],
      ["spinat", 0x1F96C], ["kohl", 0x1F96C], ["avocado", 0x1F951], ["bohne", 0x1FAD8], ["linse", 0x1FAD8], ["kichererbse", 0x1FAD8], ["huelsen", 0x1FAD8],
      ["auflauf", 0x1F958], ["gratin", 0x1F958], ["pfanne", 0x1F958], ["wok", 0x1F35C], ["ramen", 0x1F35C],
      ["quiche", 0x1F967], ["tarte", 0x1F967], ["sandwich", 0x1F96A], ["baguette", 0x1F956],
      ["banane", 0x1F34C], ["apfel", 0x1F34E], ["beere", 0x1F353], ["obst", 0x1F34E], ["frucht", 0x1F34E],
      ["kuchen", 0x1F370], ["torte", 0x1F370], ["schokolad", 0x1F36B], ["keks", 0x1F36A], ["eis", 0x1F368], ["dessert", 0x1F368], ["pudding", 0x1F368],
      ["smoothie", 0x1F964], ["milch", 0x1F95B], ["kaffee", 0x2615], ["tee", 0x1F375],
    ];
    for (const [k, cp] of map) { if (n.includes(k)) return CP(cp); }
    return CP(0x1F37D);
  }

  _mealIcon(label) {
    const n = this._norm(label);
    if (n.includes("fruh") || n.includes("morgen") || n.includes("breakfast")) return CP(0x2615);
    if (n.includes("mittag") || n.includes("lunch")) return CP(0x1F37D);
    if (n.includes("abend") || n.includes("dinner")) return CP(0x1F319);
    if (n.includes("snack") || n.includes("jause")) return CP(0x1F34E);
    return CP(0x1F37D);
  }
  _mealHour(meal) {
    if (meal.at != null) return meal.at;
    const n = this._norm(meal.label);
    if (n.includes("fruh") || n.includes("morgen")) return 8;
    if (n.includes("mittag") || n.includes("lunch")) return 12;
    if (n.includes("abend") || n.includes("dinner")) return 18;
    return meal.start > 0 ? meal.start : 8;
  }

  async _delEvent(ev, noRefresh, quiet) {
    if (!ev || !ev.uid) return false;
    const msg = { type: "calendar/event/delete", entity_id: this.config.entity, uid: ev.uid };
    if (ev.recurrence_id) msg.recurrence_id = ev.recurrence_id; // nur diese Instanz, nicht die ganze Serie
    let ok = true;
    try { await this._hass.callWS(msg); } catch (e) { ok = false; if (!quiet) this._toast("Eintrag konnte nicht gelöscht werden"); }
    if (!noRefresh) await this._maybeFetch(true);
    return ok;
  }
  _fmtDT(d) { return `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())} ${this._pad(d.getHours())}:${this._pad(d.getMinutes())}:00`; }
  async _createEvent(meal, date, text, evForTime) {
    let hour = this._mealHour(meal), mins = 0;
    if (evForTime && evForTime.start) { const d = new Date(evForTime.start); hour = d.getHours(); mins = d.getMinutes(); }
    const sd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, mins);
    const ed = new Date(sd.getTime() + 3600000); // +1h, rollt korrekt über Mitternacht
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this.config.entity, summary: text, start_date_time: this._fmtDT(sd), end_date_time: this._fmtDT(ed) });
      return true;
    } catch (e) { this._toast("Eintrag konnte nicht erstellt werden"); return false; }
  }
  async _updateEvent(ev, text) {
    if (!ev || !ev.uid || !ev.start || !ev.end) return false;
    const msg = { type: "calendar/event/update", entity_id: this.config.entity, uid: ev.uid, event: { summary: text, dtstart: ev.start, dtend: ev.end } };
    if (ev.recurrence_id) msg.recurrence_id = ev.recurrence_id;
    if (ev.description) msg.event.description = ev.description;
    try { await this._hass.callWS(msg); return true; } catch (e) { return false; }
  }
  async _saveCell(meal, date, ev, text) {
    if (ev && text === "") { await this._delEvent(ev); return; }
    if (ev && text !== "" && text !== ev.summary) {
      // Erst Update versuchen (erhält UID/Serie); Fallback: erst neu anlegen, dann alt löschen
      if (!(await this._updateEvent(ev, text))) {
        if (await this._createEvent(meal, date, text, ev)) {
          if (!(await this._delEvent(ev, true, true))) this._toast("Geändert, aber alter Eintrag blieb stehen – bitte Duplikat löschen");
        }
      }
      await this._maybeFetch(true); return;
    }
    if (!ev && text !== "") { if (await this._createEvent(meal, date, text)) await this._maybeFetch(true); }
  }

  // ---------- Kochbuch-Kopplung ----------
  _season() { const m = new Date().getMonth() + 1; if (m === 12 || m <= 2) return "Winter"; if (m <= 5) return "Frühling"; if (m <= 8) return "Sommer"; return "Herbst"; }
  async _loadCookbook(useCache) {
    if (!this._hass || !this.config.cookbook_entity) return [];
    if (useCache && this._cbCache && Date.now() - this._cbCacheAt < 60000) return this._cbCache;
    try {
      const r = await this._hass.callService("todo", "get_items", { entity_id: this.config.cookbook_entity }, undefined, false, true);
      const items = (r && r.response && r.response[this.config.cookbook_entity] && r.response[this.config.cookbook_entity].items) || [];
      const list = items.map(it => { let m = {}; try { m = JSON.parse(it.description || "{}"); } catch (e) { m = {}; } return Object.assign({ name: it.summary, uid: it.uid, category: "egal", tags: [], rating: 0, last_cooked: null, season: [] }, m, { name: it.summary, uid: it.uid }); });
      this._cbCache = list; this._cbCacheAt = Date.now();
      return list;
    } catch (e) { return []; }
  }
  _matchMeal(cat, label) { if (!cat || cat === "egal") return true; return this._norm(cat) === this._norm(label); }
  _pickWeighted(pool, meal, usedNamesSet) {
    const season = this._norm(this._season());
    const cands = pool.filter(d => d.name && !usedNamesSet.has(this._norm(d.name)) && this._matchMeal(d.category, meal.label));
    if (!cands.length) return null;
    const now = Date.now();
    const weighted = cands.map(d => {
      let w = 1 + (Number(d.rating) || 0);
      const s = (d.season || []).map(x => this._norm(x));
      if (s.includes(season) || s.includes("ganzjahrig") || s.includes("ganzjaehrig")) w *= 1.5;
      if (d.last_cooked) { const days = (now - new Date(d.last_cooked).getTime()) / 86400000; if (days >= 0 && days < 10) w *= 0.2; }
      return { d, w: Math.max(w, 0.05) };
    });
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    for (const it of weighted) { r -= it.w; if (r <= 0) return it.d; }
    return weighted[weighted.length - 1].d;
  }
  async _toCookbook(name, btn) {
    name = (name || "").trim();
    if (!name) { this._toast("Kein Gericht angegeben"); return; }
    const prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = CP(0x2605) + " ...";
    try {
      const cb = await this._loadCookbook();
      if (cb.some(d => this._norm(d.name) === this._norm(name))) { this._toast(`„${name}" ist schon im Kochbuch`); btn.disabled = false; btn.innerHTML = prev; return; }
      const bp = 2;
      const prompt = `Erzeuge ein bewaehrtes, alltagstaugliches Familienrezept fuer "${name}". Halte dich ans klassische, typische Rezept fuer dieses Gericht und erfinde KEINE zusaetzlichen Hauptzutaten (z. B. keine Huelsenfruechte, kein Fleisch nur wegen Protein), die nicht ueblich dazugehoeren. `
        + `Tags NUR aus dieser Liste (2-4 passende): vegetarisch, vegan, fleisch, fisch, schnell, proteinreich, kinderliebling, saisonal. Verwende NIEMALS "bunt" als Tag. `
        + `Sprache: oesterreichisches Deutsch (Erdaepfel, Paradeiser, Topfen, Obers ...). Mengen fuer ${bp} Portionen. `
        + `Antworte NUR mit GUELTIGEM JSON (kein Markdown, keine Erklaerung), exakt in dieser Form:`
        + `{"name":"${name}","category":"Frühstück|Mittag|Abend","tags":["vegetarisch","schnell"],"portions_base":${bp},"ingredients":[{"qty":250,"unit":"g","item":"Zutat"}],"steps":["Schritt 1","Schritt 2"],"season":["ganzjährig"]}`;
      const data = { task_name: "Kochbuch-Rezept", instructions: prompt };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      let meta = null;
      try {
        const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
        let txt = r && r.response && r.response.data;
        if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
        const mm = String(txt || "").match(/\{[\s\S]*\}/);
        if (mm) meta = JSON.parse(mm[0]);
      } catch (e) { meta = null; }
      if (!meta) meta = { category: "egal", tags: [], portions_base: bp, ingredients: [], steps: [], season: ["ganzjährig"] };
      meta.portions_base = meta.portions_base || bp; meta.rating = meta.rating || 0; meta.times_cooked = 0; meta.last_cooked = null;
      delete meta.name; delete meta.uid;
      await this._hass.callService("todo", "add_item", { entity_id: this.config.cookbook_entity, item: name, description: JSON.stringify(meta) });
      this._toast(meta.ingredients && meta.ingredients.length ? `„${name}" mit Rezept ins Kochbuch` : `„${name}" ins Kochbuch (ohne Rezept)`);
    } catch (e) { this._toast("Ins Kochbuch speichern fehlgeschlagen"); }
    btn.disabled = false; btn.innerHTML = prev;
  }

  async _suggest(meal, input, btn) {
    const prev = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = CP(0x2728) + " ...";
    try {
      const existing = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.summary) existing.push(o.summary); })));
      const avoid = Array.from(new Set(existing.concat(this._recent || []))).filter(Boolean);
      const typed = (input.value || "").trim();
      const hint = (typed && typed !== (this._mgAiSet || "")) ? typed : ""; // getippten Wunsch auslesen, KI-gesetzte Namen ignorieren
      const season = this._season();
      const w = this._hass.states[this.config.weather_entity];
      const cond = w ? w.state : "";
      const temp = w && w.attributes && w.attributes.temperature != null ? w.attributes.temperature : "";
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const cuisine = pick(["österreichisch/deutsch", "italienisch", "asiatisch (Wok/Curry)", "indisch", "orientalisch/levantinisch", "mexikanisch", "griechisch/mediterran", "spanisch", "französisch", "Balkan/ungarisch"]);
      const base = pick(["mit Hülsenfrüchten", "als Ofengericht", "als Pfannengericht", "als Eintopf/Suppe", "mit Reis/Getreide", "als Auflauf/Gratin", "als Bowl/Salat", "mit Nudeln", "mit Erdäpfeln", "mit Tofu/Ei/Käse"]);
      const veg = Math.random() < 0.7;
      const diet = veg ? "Das Gericht soll moeglichst fleischlos (vegetarisch) sein." : "Das Gericht darf auch Fleisch oder Fisch enthalten.";
      const prompt = `Schlage genau EIN alltagstaugliches Gericht fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. `
        + (hint ? `Beziehe unbedingt diesen Wunsch ein (Zutat/Idee/Richtung): "${hint}". Kueche und Grundform frei, solange es dazu passt. ` : `Kueche diesmal: ${cuisine}. Grundform diesmal: ${base}. `)
        + `${diet} Beruecksichtige Jahreszeit (${season})${cond ? ` und Wetter (${cond}${temp !== "" ? `, ${temp} Grad` : ""})` : ""}. `
        + `Auch einfache Klassiker sind willkommen, aber auf keinen Fall Erdaepfelgulasch. `
        + `Sprache: oesterreichisches Deutsch (Topfen, Erdaepfel, Paradeiser ...), Gerichte duerfen aus aller Welt stammen. Zufalls-Seed: ${Math.random().toString(36).slice(2, 8)}. `
        + `Antworte NUR mit dem Gerichtnamen, ohne Erklaerung, ohne Anfuehrungszeichen, ohne Satzzeichen am Ende.`
        + (avoid.length ? ` Vermeide diese Gerichte: ${avoid.join(", ")}.` : "");
      const data = { task_name: "Essensvorschlag", instructions: prompt };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
      let txt = r && r.response && r.response.data;
      if (txt && typeof txt === "object") txt = txt.text || txt.result || JSON.stringify(txt);
      txt = String(txt || "").trim().replace(/^["'\s]+/, "").replace(/["'\s.]+$/, "");
      if (txt) { input.value = txt; this._mgAiSet = txt; input.focus(); this._recent = this._recent || []; this._recent.push(txt); if (this._recent.length > 14) this._recent.shift(); }
      else throw new Error("leer");
    } catch (e) {
      input.placeholder = "KI nicht verfügbar - bitte Text eingeben";
      btn.title = "KI nicht eingerichtet (Google Generative AI Integration fehlt)";
    }
    btn.disabled = false; btn.innerHTML = prev;
  }

  async _fillWeek(btn) {
    if (this.config.mode === "compact") return;
    const prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = CP(0x2728) + " ...";
    try {
      const cookbook = await this._loadCookbook();
      const usedNames = new Set();
      const existing = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.summary) { existing.push(o.summary); usedNames.add(this._norm(o.summary)); } })));
      let fromCB = 0, fromAI = 0;
      for (let mi = 0; mi < this._meals.length; mi++) {
        const meal = this._meals[mi];
        const emptyDays = [];
        for (let ci = 0; ci < this._cols.length; ci++) {
          const cell = this._cells[mi][ci];
          if (!(cell && cell.length && cell[0].summary)) emptyDays.push(ci);
        }
        if (!emptyDays.length) continue;
        // 1) erst gewichtet aus dem Kochbuch
        const aiDays = [];
        for (const ci of emptyDays) {
          const pick = this._pickWeighted(cookbook, meal, usedNames);
          if (pick) { usedNames.add(this._norm(pick.name)); existing.push(pick.name); await this._createEvent(meal, this._cols[ci], pick.name); fromCB++; }
          else aiDays.push(ci);
        }
        // 2) verbleibende Lücken per KI (entschärfter Prompt)
        if (aiDays.length) {
          const prompt = `Schlage ${aiDays.length} verschiedene, einfache, alltagstaugliche Gerichte fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. Etwa 70% davon sollen fleischlos (vegetarisch) sein. Beruecksichtige die Jahreszeit (${this._season()}). Sprache: oesterreichisches Deutsch (z. B. Topfen statt Quark, Erdaepfel statt Kartoffeln, Paradeiser statt Tomaten), aber die Gerichte duerfen aus aller Welt stammen. Auf keinen Fall Erdaepfelgulasch. Antworte als reine Liste, ein Gericht pro Zeile, ohne Nummerierung und ohne Aufzaehlungszeichen.` + (existing.length ? ` Vermeide diese Gerichte: ${existing.join(", ")}.` : "");
          const data = { task_name: "Wochenessensplan", instructions: prompt };
          if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
          const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
          let txt = r && r.response && r.response.data;
          if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
          const dishes = String(txt || "").split("\n").map(x => x.replace(/^[\s\d.)\-*]+/, "").trim()).filter(Boolean);
          for (let k = 0; k < aiDays.length; k++) {
            const dish = dishes[k];
            if (!dish) continue;
            existing.push(dish); usedNames.add(this._norm(dish));
            await this._createEvent(meal, this._cols[aiDays[k]], dish); fromAI++;
          }
        }
      }
      await this._maybeFetch(true);
      this._toast(`Woche gefüllt: ${fromCB} aus Kochbuch, ${fromAI} per KI`);
    } catch (e) { this._toast("Woche füllen fehlgeschlagen (ai_task nicht verfügbar?)"); }
    btn.disabled = false; btn.innerHTML = prev;
  }

  async _clearWeek(btn) {
    if (this.config.mode === "compact") return;
    if (!window.confirm("Wirklich alle Gerichte dieser Woche löschen?")) return;
    const prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = CP(0x1F5D1) + " ...";
    try {
      const evs = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.uid) evs.push(o); })));
      for (const o of evs) { await this._delEvent(o, true); }
      await this._maybeFetch(true);
    } catch (e) { this._toast("Woche leeren fehlgeschlagen"); }
    btn.disabled = false; btn.innerHTML = prev;
  }

  _openEditor(mi, ci) {
    const meal = this._meals[mi], date = this._cols[ci];
    const ev = (this._cells[mi][ci] && this._cells[mi][ci][0]) || null;
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const title = `${dn[(date.getDay() + 6) % 7]} ${date.getDate()}.${date.getMonth() + 1}. - ${meal.label}`;
    const ov = document.createElement("div"); ov.className = "mg-ov";
    const box = document.createElement("div"); box.className = "mg-modal";
    const suggestBtn = this.config.ai_suggest ? `<div class="mg-suggest-row"><button class="mg-btn mg-suggest">${CP(0x2728)} Vorschlag holen</button></div>` : "";
    const cookBtn = this.config.cookbook_entity ? `<div class="mg-cook-row"><button class="mg-btn mg-tocook">${CP(0x2605)} Ins Kochbuch</button></div>` : "";
    box.innerHTML = `<div class="mg-modal-t"></div><input class="mg-input" type="text" placeholder="Gericht eingeben..."><div class="mg-recipe-row"><button class="mg-btn mg-recipe">${CP(0x1F517)} Zum Rezept</button></div>${suggestBtn}${cookBtn}<div class="mg-modal-btns"><button class="mg-btn mg-cancel">Abbrechen</button><button class="mg-btn mg-del">Löschen</button><button class="mg-btn mg-save">Speichern</button></div>`;
    box.querySelector(".mg-modal-t").textContent = title;
    const input = box.querySelector(".mg-input");
    input.value = ev ? (ev.summary || "") : "";
    this._mgAiSet = ""; // getippter/vorhandener Text zählt als Wunsch; nur KI-Vorschläge werden ignoriert
    const delBtn = box.querySelector(".mg-del");
    if (!ev) delBtn.style.display = "none";
    ov.appendChild(box); this.appendChild(ov);
    this._editing = true; // blockiert Re-Renders, solange der Dialog offen ist
    setTimeout(() => { input.focus(); input.select(); }, 30);
    const close = () => { this._editing = false; if (ov.parentNode) ov.parentNode.removeChild(ov); this._render(); };
    const save = async () => { const t = input.value.trim(); close(); await this._saveCell(meal, date, ev, t); };
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    box.querySelector(".mg-cancel").addEventListener("click", close);
    delBtn.addEventListener("click", async () => { close(); await this._delEvent(ev); });
    box.querySelector(".mg-save").addEventListener("click", save);
    const sb = box.querySelector(".mg-suggest");
    if (sb) sb.addEventListener("click", () => this._suggest(meal, input, sb));
    const cbtn = box.querySelector(".mg-tocook");
    if (cbtn) cbtn.addEventListener("click", () => this._toCookbook(input.value, cbtn));
    const rb = box.querySelector(".mg-recipe");
    if (rb) {
      if (!ev) { const rr = rb.closest(".mg-recipe-row"); if (rr) rr.style.display = "none"; }
      // Steht das Gericht im eigenen Kochbuch, dorthin springen statt ins Web
      const checkCookbook = () => {
        const q = input.value.trim();
        if (!q || !this.config.cookbook_path) { rb.dataset.uid = ""; return; }
        this._loadCookbook(true).then(cb => {
          const hit = cb.find(x => this._norm(x.name) === this._norm(q));
          rb.dataset.uid = hit ? hit.uid : "";
          rb.innerHTML = hit ? `${CP(0x1F4D6)} Im Kochbuch öffnen` : `${CP(0x1F517)} Zum Rezept`;
        }).catch(() => {});
      };
      checkCookbook();
      input.addEventListener("change", checkCookbook);
      rb.addEventListener("click", () => {
        const q = input.value.trim(); if (!q) return;
        if (rb.dataset.uid) { close(); this._nav(`${this.config.cookbook_path}#dish=${encodeURIComponent(rb.dataset.uid)}`); return; }
        const u = (this.config.recipe_url || "https://www.chefkoch.de/rs/s0/{q}/Rezepte.html").replace("{q}", encodeURIComponent(q));
        window.open(u, "_blank", "noopener");
      });
    }
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { close(); } });
  }

  _render() {
    if (!this._hass) return;
    if (this._editing) return; // offenen Dialog nicht zerstören
    const { startDate, days } = this._range();
    const compact = this.config.mode === "compact";
    const meals = this.config.meals;
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const cols = [];
    for (let i = 0; i < days; i++) { const d = new Date(startDate); d.setDate(d.getDate() + i); cols.push(d); }
    const cells = meals.map(() => cols.map(() => []));
    (this._events || []).forEach(ev => {
      const d = this._evDate(ev);
      const ci = cols.findIndex(c => c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && c.getDate() === d.getDate());
      if (ci < 0) return;
      const h = d.getHours();
      let mi = meals.findIndex(m => h >= m.start && h < m.end);
      if (mi < 0) mi = 0;
      const dt = (ev.start && (ev.start.dateTime || ev.start.date)) || ev.start;
      const de = (ev.end && (ev.end.dateTime || ev.end.date)) || ev.end;
      cells[mi][ci].push({ uid: ev.uid, recurrence_id: ev.recurrence_id, summary: this._clean(ev.summary || ev.message || ""), start: dt, end: de, description: ev.description });
    });
    this._cols = cols; this._cells = cells; this._meals = meals;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isToday = d => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    const colLabel = (d, i) => compact ? (i === 0 ? "Heute" : "Morgen") : dn[(d.getDay() + 6) % 7];

    let head = "";
    if (!compact && this.config.hide_header) {
      head = "";
    } else if (!compact) {
      const a = cols[0], b = cols[cols.length - 1];
      const range = `${a.getDate()}.${a.getMonth() + 1}. - ${b.getDate()}.${b.getMonth() + 1}.`;
      const rel = this._offset === 0 ? "Diese Woche" : (this._offset === 1 ? "+1 Woche" : this._offset === -1 ? "Letzte Woche" : (this._offset > 0 ? "+" : "") + this._offset + " Wochen");
      head = `<div class="mg-bar">
        <button class="mg-nav" data-d="-1" title="Vorige Woche">${CP(0x2039)}</button>
        <div class="mg-bar-mid"><div class="mg-bar-t">${this._esc(this.config.title)}</div><div class="mg-bar-s">${range} &middot; ${rel}</div></div>
        <button class="mg-today-btn" data-d="0" title="Aktuelle Woche">${CP(0x1F3E0)}</button>
        <button class="mg-nav" data-d="1" title="Nächste Woche">${CP(0x203A)}</button>
      </div>`;
    } else if (this.config.title) {
      head = `<div class="mg-h">${this._esc(this.config.title)}</div>`;
    }

    let html = `<ha-card class="mg-card">${head}${(!compact && this.config.ai_suggest) ? `<div class="mg-fillrow"><button class="mg-fill">${CP(0x2728)} Woche f&uuml;llen</button><button class="mg-clear">${CP(0x1F5D1)} Woche leeren</button></div>` : ""}<div class="mg-wrap"><table class="mg"><thead><tr><th class="mg-corner"></th>`;
    cols.forEach((d, i) => {
      html += `<th class="${isToday(d) ? "mg-today" : ""}"><div class="mg-day">${colLabel(d, i)}</div><div class="mg-date">${d.getDate()}.${d.getMonth() + 1}.</div></th>`;
    });
    html += "</tr></thead><tbody>";
    meals.forEach((m, mi) => {
      const ic = this.config.meal_icons ? `<div class="mg-meal-ic">${this._mealIcon(m.label)}</div>` : "";
      const tx = this.config.meal_labels ? `<div class="mg-meal-tx">${this._esc(m.label)}</div>` : "";
      // Zeilenklasse: jede Mahlzeit darf eine eigene Feldfarbe bekommen
      html += `<tr class="mg-r${mi}"><th class="mg-meal">${ic}${tx}</th>`;
      cols.forEach((d, ci) => {
        const items = cells[mi][ci].filter(o => o.summary).map(o => {
          const em = this.config.show_emojis ? this._food(o.summary) : "";
          return (em ? `<span class="mg-em">${em}</span>` : "") + this._esc(o.summary);
        });
        const inner = items.length ? `<span>${items.join("<br>")}</span>`
          : `<span class="mg-plus">${this._esc(this.config.empty_text)}</span>`;
        html += `<td class="mg-cell ${isToday(d) ? "mg-today" : ""}" data-mi="${mi}" data-ci="${ci}">${inner}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table></div></ha-card>";

    let bgImg = "";
    if (this.config.background) {
      const _b = this.config.background;
      const _isImg = /^(https?:|\/|data:)/.test(_b) || /\.(jpe?g|png|webp|gif|avif)/i.test(_b);
      if (_isImg) {
        bgImg = `.mg-card{background-image:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.72)),url('${_b}');background-size:cover;background-position:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);} .mg-card .mg-bar-t,.mg-card .mg-bar-s,.mg-card .mg-meal-tx{color:#fff;} .mg-card thead th,.mg-card thead .mg-day,.mg-card thead .mg-date{color:#fff !important;} .mg-card td.mg-cell{background:rgba(255,255,255,.14);font-weight:600;color:#fff !important;} .mg-card td.mg-cell span{color:#fff !important;} .mg-card .mg-plus{color:#fff !important;opacity:.65;} .mg-card td.mg-cell:hover{background:rgba(255,255,255,.26);} .mg-card .mg-today{--mg-cell-bg:rgba(255,255,255,.32);}`;
      } else {
        bgImg = `.mg-card{background:${_b};}`;
      }
    }
    const css = `
      .mg-card{overflow:hidden;}
      .mg-h{padding:12px 16px 4px;font-size:1.25rem;font-weight:600;}
      /* Leistenfarbe ueber --fp-bar-bg aus dem Theme uebersteuerbar */
      .mg-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--fp-bar-bg,linear-gradient(135deg,rgba(var(--fp-tint-rgb,129,212,250),.70),rgba(var(--fp-accent-rgb,79,195,247),.70)));color:var(--fp-bar-fg,#fff);}
      .mg-bar-mid{flex:1;text-align:center;line-height:1.15;}
      .mg-bar-t{font-size:1.15rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.30);}
      .mg-bar-s{font-size:.78rem;opacity:.95;text-shadow:0 1px 2px rgba(0,0,0,.25);}
      .mg-nav,.mg-today-btn{border:none;background:rgba(255,255,255,.28);color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.25rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
      .mg-nav:hover,.mg-today-btn:hover{background:rgba(255,255,255,.45);}
      .mg-wrap{padding:14px 16px 18px;overflow-x:auto;}
      table.mg{width:100%;border-collapse:separate;border-spacing:7px;table-layout:fixed;}
      table.mg th,table.mg td{text-align:center;}
      table.mg thead th{font-size:.8rem;color:var(--secondary-text-color);padding:2px;}
      table.mg thead .mg-day{font-weight:700;color:var(--primary-text-color);}
      table.mg thead .mg-date{font-size:.7rem;}
      th.mg-meal{width:54px;}
      .mg-meal-ic{font-size:1.15rem;line-height:1.2;}
      .mg-meal-tx{font-size:.6rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.03em;}
      /* Feldfarbe je Mahlzeit: das Theme setzt fp-meal0/1/2-bg, ohne Theme
         bleiben alle drei Zeilen wie bisher. */
      tr.mg-r0{--mg-cell-bg:var(--fp-meal0-bg,rgba(var(--fp-tint-rgb,129,212,250),0.10));}
      tr.mg-r1{--mg-cell-bg:var(--fp-meal1-bg,rgba(var(--fp-tint-rgb,129,212,250),0.10));}
      tr.mg-r2{--mg-cell-bg:var(--fp-meal2-bg,rgba(var(--fp-tint-rgb,129,212,250),0.10));}
      td.mg-cell{background:var(--mg-cell-bg,rgba(var(--fp-tint-rgb,129,212,250),0.10));border:1px solid var(--fp-meal-border,var(--divider-color));border-radius:var(--fp-meal-radius,14px);min-height:var(--fp-meal-h,48px);height:var(--fp-meal-h,48px);padding:6px;font-size:.82rem;line-height:1.2;color:var(--primary-text-color);cursor:pointer;vertical-align:middle;transition:background .15s,transform .1s;}
      td.mg-cell:hover{background:var(--mg-cell-bg-hover,rgba(var(--fp-tint-rgb,129,212,250),0.20));transform:translateY(-1px);}
      td.mg-cell span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .mg-plus{color:var(--secondary-text-color);opacity:.38;font-size:.78rem;font-weight:400;}
      .mg-em{margin-right:3px;}
      /* Heute nicht mehr einfaerben — das uebermalte die Farbe der Mahlzeit.
         Stattdessen ein Ring um die Zelle und ein hervorgehobenes Datum. */
      td.mg-cell.mg-today{box-shadow:inset 0 0 0 2px var(--fp-head,var(--primary-color));}
      thead th.mg-today .mg-day,thead th.mg-today .mg-date{color:var(--fp-head,var(--primary-color));}
      th.mg-corner{width:54px;}
      .mg-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9;}
      .mg-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,360px);border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);text-shadow:none;}
      .mg-modal-t{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .mg-input{width:100%;box-sizing:border-box;padding:11px 12px;font-size:1rem;border:1px solid var(--divider-color,#ccc);border-radius:12px;background:var(--secondary-background-color,#f3f3f3);color:var(--primary-text-color);}
      .mg-suggest-row{margin-top:10px;}
      .mg-cook-row{margin-top:10px;}
      .mg-recipe-row{margin-top:10px;}
      .mg-recipe{width:100%;background:rgba(255,167,38,.18);color:#e65100;font-weight:600;}
      .mg-suggest{width:100%;background:rgba(var(--fp-accent-rgb,79,195,247),.18);color:var(--fp-head,#0277bd);font-weight:600;}
      .mg-tocook{width:100%;background:rgba(245,179,1,.18);color:#a86b00;font-weight:600;}
      .mg-fillrow{display:flex;gap:8px;padding:10px 14px 0;}
      .mg-fill{flex:1;border:none;border-radius:10px;padding:9px;font-size:.88rem;background:rgba(var(--fp-accent-rgb,79,195,247),.16);color:var(--fp-head,#014a73);font-weight:600;cursor:pointer;}
      .mg-fill:hover{background:rgba(var(--fp-accent-rgb,79,195,247),.26);}
      .mg-clear{flex:1;border:none;border-radius:10px;padding:9px;font-size:.88rem;background:transparent;border:1px solid var(--divider-color);color:var(--secondary-text-color);font-weight:600;cursor:pointer;}
      .mg-clear:hover{color:var(--error-color);border-color:var(--error-color);}
      .mg-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
      .mg-btn{border:none;border-radius:10px;padding:9px 14px;font-size:.9rem;cursor:pointer;}
      .mg-cancel{background:var(--secondary-background-color,#eee);color:var(--primary-text-color);}
      .mg-del{background:rgba(229,57,53,.15);color:#e53935;}
      .mg-save{background:var(--fp-accent,#4fc3f7);color:#06354a;font-weight:700;}
      ${bgImg}
    `;
    this.innerHTML = `<style>${css}</style>${html}`;
    const fb = this.querySelector(".mg-fill");
    if (fb) fb.addEventListener("click", () => this._fillWeek(fb));
    const cb = this.querySelector(".mg-clear");
    if (cb) cb.addEventListener("click", () => this._clearWeek(cb));
    this.querySelectorAll(".mg-nav,.mg-today-btn").forEach(b => {
      b.addEventListener("click", e => {
        e.stopPropagation();
        const d = parseInt(b.dataset.d, 10);
        this._offset = d === 0 ? 0 : this._offset + d;
        this._maybeFetch(true);
      });
    });
    this.querySelectorAll(".mg-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        if (this.config.nav_path) { this._nav(this.config.nav_path); return; }
        this._openEditor(parseInt(cell.dataset.mi, 10), parseInt(cell.dataset.ci, 10));
      });
    });
  }
  getCardSize() { return this.config.mode === "compact" ? 3 : 6; }
}
if (!customElements.get("meal-grid-card")) {
  customElements.define("meal-grid-card", MealGridCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "meal-grid-card", name: "Meal Grid Card", description: "Wochenplan grid fed from a calendar" });
}
})();

/* ===== family-calendar-card v2.6 (durchlaufende Tage stehen in der Ganztagszeile, Wochenraster schneidet mehrtaegige Termine je Tag zu, Termine mit Beginn- und Enddatum, auch ueber Mitternacht, mehrtaegige Termine mit ab/bis je Tag, Mehrtagesansicht agenda mit days/hide_header/hide_legend, Farben ueber Theme-Variablen, Heute hellblau + vergangene Tage gedimmt) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class FamilyCalendarCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Kalender", initial_view: "week", day_start: 6, day_end: 23, persons: [],
      days: 4,                 // nur fuer initial_view: "agenda"
      hide_header: false,      // Kopfleiste mit Navigation und Ansichtswechsel
      hide_legend: false,      // Personenfilter unter der Kopfleiste
    }, config || {});
    if (!this.config.persons || !this.config.persons.length) throw new Error("Bitte 'persons' konfigurieren");
    this._view = this.config.initial_view === "month" ? "month"
      : this.config.initial_view === "agenda" ? "agenda" : "week";
    this._offset = 0;
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
    this._hidden = this._loadHidden();
  }
  set hass(hass) { this._hass = hass; this._maybeFetch(); }
  connectedCallback() { if (!this._clock) this._clock = setInterval(() => this._tickNow(), 60000); }
  disconnectedCallback() { if (this._clock) { clearInterval(this._clock); this._clock = null; } }
  _tickNow() {
    if (this._view !== "week") return;
    const line = this.querySelector(".fcc-now"), past = this.querySelector(".fcc-nowpast");
    if (!line && !past) return;
    const now = new Date(); const nf = now.getHours() + now.getMinutes() / 60;
    const h0 = this.config.day_start, h1 = this.config.day_end, HH = 46;
    if (nf < h0 || nf >= h1) { if (line) line.style.display = "none"; if (past) past.style.display = "none"; return; }
    const t = (nf - h0) * HH;
    if (line) { line.style.display = "block"; line.style.top = t + "px"; }
    if (past) { past.style.display = "block"; past.style.height = t + "px"; }
  }
  _key() { let h = 0; const src = (this.config.persons || []).map(p => p.name + "|" + p.calendar).join(";"); for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0; return "fcc_hidden_" + (this.config.title || "cal") + "_" + (h >>> 0).toString(36); }
  _loadHidden() { try { return new Set(JSON.parse(localStorage.getItem(this._key()) || "[]")); } catch (e) { return new Set(); } }
  _saveHidden() { try { localStorage.setItem(this._key(), JSON.stringify([...this._hidden])); } catch (e) {} }

  _entities() { const s = new Set(); this.config.persons.forEach(p => { if (p.calendar) s.add(p.calendar); }); return [...s]; }

  _range() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (this._view === "agenda") {
      const n = Math.max(1, Math.min(14, this.config.days || 4));
      const d = new Date(now); d.setDate(d.getDate() + this._offset * n);
      const end = new Date(d); end.setDate(end.getDate() + n);
      return { start: d, end, gridStart: d, gridEnd: end };
    }
    if (this._view === "week") {
      const d = new Date(now); const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow + this._offset * 7);
      const end = new Date(d); end.setDate(end.getDate() + 7);
      return { start: d, end, gridStart: d };
    }
    const first = new Date(now.getFullYear(), now.getMonth() + this._offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + this._offset + 1, 1);
    const gs = new Date(first); gs.setDate(gs.getDate() - ((first.getDay() + 6) % 7));
    const ge = new Date(last); const trail = (7 - ((last.getDay() + 6) % 7)) % 7; ge.setDate(ge.getDate() + trail);
    return { start: first, end: last, gridStart: gs, gridEnd: ge };
  }

  async _maybeFetch(force) {
    if (!this._hass) return;
    const r = this._range();
    const fs = this._view === "month" ? r.gridStart : r.start;
    const fe = this._view === "month" ? r.gridEnd : r.end;
    const key = this._view + "|" + this._offset + "|" + fs.toISOString();
    const now = Date.now();
    if (!force && key === this._rangeKey && now - this._lastFetch < 60000) return;
    this._rangeKey = key; this._lastFetch = now;
    const ents = this._entities();
    const all = [], failed = [];
    await Promise.all(ents.map(async ent => {
      try {
        const s = encodeURIComponent(fs.toISOString()), e = encodeURIComponent(fe.toISOString());
        const evts = await this._hass.callApi("GET", `calendars/${ent}?start=${s}&end=${e}`);
        (evts || []).forEach(ev => { ev._entity = ent; all.push(ev); });
      } catch (err) { failed.push(ent); }
    }));
    if (failed.length && this._loadedOnce) this._toast("Kalender nicht erreichbar: " + failed.join(", "));
    this._loadedOnce = true; // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._events = all;
    this._render();
  }

  _esc(s) { return U.esc(s); }
  _pad(n) { return U.pad(n); }
  _toast(msg) { U.toast(this, msg); }

  _textOn(bg) { let h = String(bg).replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join(""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); if (isNaN(r) || isNaN(g) || isNaN(b)) return "#fff"; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#222" : "#fff"; }
  _matchPrefix(title, prefix) { const re = new RegExp("^" + U.reEsc(prefix) + "[ :._-]"); return re.test(title); }
  _stripPrefix(title, prefix) { return title.replace(new RegExp("^" + U.reEsc(prefix) + "[ :._-]\\s*"), ""); }

  _classify(ev) {
    const title = ev.summary || ev.message || "";
    const group = this.config.persons.filter(p => p.calendar === ev._entity);
    if (!group.length) return null;
    const prefixed = group.filter(p => p.prefix);
    for (const p of prefixed) { if (this._matchPrefix(title, p.prefix)) return { person: p, display: this._stripPrefix(title, p.prefix) }; }
    const none = group.find(p => p.match === "none") || group.find(p => !p.prefix);
    if (none) return { person: none, display: title };
    return { person: group[0], display: title };
  }

  _parse(ev) {
    const s = ev.start || {}, e = ev.end || {};
    const allDay = !!(s.date && !s.dateTime);
    let start, end;
    if (allDay) {
      const a = String(s.date).split("-"); start = new Date(+a[0], +a[1] - 1, +a[2]);
      const b = String(e.date || s.date).split("-"); end = new Date(+b[0], +b[1] - 1, +b[2]);
    } else {
      start = new Date(s.dateTime || s.date);
      end = new Date(e.dateTime || e.date || s.dateTime || s.date);
    }
    return { allDay, start, end };
  }

  _items() {
    const out = []; this._evMap = {};
    (this._events || []).forEach(ev => {
      const cl = this._classify(ev); if (!cl) return;
      if (this._hidden.has(cl.person.name)) return;
      const t = this._parse(ev);
      const item = { person: cl.person, display: cl.display, allDay: t.allDay, start: t.start, end: t.end, uid: ev.uid, recurrence_id: ev.recurrence_id, description: ev.description, entity: ev._entity };
      item.key = ev._entity + "|" + (ev.uid || "") + "|" + (ev.recurrence_id || ""); // uid allein kollidiert über Kalender/Serien hinweg
      out.push(item);
      if (ev.uid) this._evMap[item.key] = item;
    });
    return out;
  }

  _sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  _isToday(d) { const t = new Date(); return this._sameDay(d, t); }

  // Personenfarbe als zarte Flaeche und als lesbarer Text darauf.
  _hex(c) { let h = String(c || "#888888").replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join(""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return [isNaN(r) ? 136 : r, isNaN(g) ? 136 : g, isNaN(b) ? 136 : b]; }
  _rgba(c, a) { const [r, g, b] = this._hex(c); return `rgba(${r},${g},${b},${a})`; }
  _deep(c, f) { const [r, g, b] = this._hex(c); const k = f == null ? 0.55 : f; return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; }

  // Kompakte Mehrtagesansicht: eine Spalte je Tag, Termine als Kacheln mit
  // farbiger Kante. Ersetzt die fremde week-planner-card in der Uebersicht.
  _agendaHTML() {
    const r = this._range();
    const n = Math.max(1, Math.min(14, this.config.days || 4));
    const items = this._items();
    const dn = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const morgen = new Date(heute); morgen.setDate(morgen.getDate() + 1);

    let html = `<div class="fcc-ag" style="grid-template-columns:repeat(${n},minmax(0,1fr))">`;
    for (let i = 0; i < n; i++) {
      const d = new Date(r.start); d.setDate(d.getDate() + i);
      const de = new Date(d); de.setDate(de.getDate() + 1);
      const tag = this._sameDay(d, heute) ? "Heute" : this._sameDay(d, morgen) ? "Morgen" : dn[(d.getDay() + 6) % 7];
      // Ganztaegiges zuerst, danach chronologisch
      const list = items.filter(it => it.start < de && it.end > d)
        .sort((a, b) => (a.allDay === b.allDay) ? (a.start - b.start) : (a.allDay ? -1 : 1));

      html += `<div class="fcc-ag-col${this._sameDay(d, heute) ? " fcc-ag-today" : ""}">`;
      html += `<div class="fcc-ag-h"><span class="fcc-ag-n">${d.getDate()}</span><span class="fcc-ag-w">${this._esc(tag)}</span></div>`;
      if (!list.length) {
        html += '<div class="fcc-ag-none">frei</div>';
      } else {
        list.forEach(it => {
          const c = (it.person && it.person.color) || "#888888";
          // Mehrtaegiges: sonst stuende an jedem Tag die urspruengliche
          // Startzeit, was auf Folgetagen schlicht falsch ist.
          const faengtHeuteAn = it.start >= d;
          const hoertHeuteAuf = it.end <= de;
          const hhmm = t => `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`;
          let zeit;
          if (it.allDay) zeit = "ganztägig";
          else if (faengtHeuteAn && hoertHeuteAuf) zeit = hhmm(it.start);
          else if (faengtHeuteAn) zeit = "ab " + hhmm(it.start);
          else if (hoertHeuteAuf) zeit = "bis " + hhmm(it.end);
          else zeit = "ganztägig";
          html += `<div class="fcc-ag-ev" data-key="${this._esc(it.key)}" style="border-left-color:${c};background:${this._rgba(c, 0.14)}">`
            + `<div class="fcc-ag-t" style="color:${this._deep(c)}">${this._esc(zeit)}</div>`
            + `<div class="fcc-ag-s">${this._esc(it.display)}</div></div>`;
        });
      }
      html += "</div>";
    }
    html += "</div>";

    const a = r.start, b = new Date(r.end); b.setDate(b.getDate() - 1);
    return { html, label: `${a.getDate()}.${a.getMonth() + 1}. - ${b.getDate()}.${b.getMonth() + 1}.` };
  }

  _legendHTML() {
    let h = '<div class="fcc-legend">';
    this.config.persons.forEach(p => {
      const off = this._hidden.has(p.name) ? " fcc-off" : "";
      h += `<button class="fcc-chip${off}" data-person="${this._esc(p.name)}"><span class="fcc-dot" style="background:${p.color}"></span>${this._esc(p.name)}</button>`;
    });
    h += "</div>";
    return h;
  }

  _headerHTML(label) {
    return `<div class="fcc-bar">
      <div class="fcc-title">${this._esc(this.config.title)}</div>
      <div class="fcc-nav">
        <button class="fcc-btn fcc-nav-b" data-d="-1">${CP(0x2039)}</button>
        <button class="fcc-btn fcc-today" data-d="0">Heute</button>
        <button class="fcc-btn fcc-nav-b" data-d="1">${CP(0x203A)}</button>
      </div>
      <div class="fcc-range">${this._esc(label)}</div>
      <div class="fcc-views">
        <button class="fcc-btn fcc-vw${this._view === "week" ? " fcc-vw-on" : ""}" data-v="week">Woche</button>
        <button class="fcc-btn fcc-vw${this._view === "month" ? " fcc-vw-on" : ""}" data-v="month">Monat</button>
      </div>
    </div>`;
  }

  _weekHTML() {
    const r = this._range();
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const cols = []; for (let i = 0; i < 7; i++) { const d = new Date(r.start); d.setDate(d.getDate() + i); cols.push(d); }
    const HH = 46, h0 = this.config.day_start, h1 = this.config.day_end;
    const gridH = (h1 - h0) * HH;
    const items = this._items();
    const label = `${cols[0].getDate()}.${cols[0].getMonth() + 1}. - ${cols[6].getDate()}.${cols[6].getMonth() + 1}.${cols[6].getFullYear()}`;

    let head = '<div class="fcc-wk-head"><div class="fcc-gutter"></div>';
    cols.forEach((d, i) => { head += `<div class="fcc-dcol${this._isToday(d) ? " fcc-today" : ""}"><div class="fcc-dn">${dn[i]}</div><div class="fcc-dd">${d.getDate()}.${d.getMonth() + 1}.</div></div>`; });
    head += "</div>";

    let allRow = '<div class="fcc-allday"><div class="fcc-gutter fcc-allday-lbl">ganzt.</div>';
    cols.forEach(d => {
      const tv = new Date(d); tv.setHours(0, 0, 0, 0);
      const tb = new Date(tv); tb.setDate(tb.getDate() + 1);
      let cell = '<div class="fcc-ad-cell">';
      // Auch Termine mit Uhrzeit gehoeren hier hinauf, wenn sie den Tag
      // komplett ueberdecken — ein Balken ueber das ganze Raster sagt nichts,
      // ausser dass er nirgends hineinpasst.
      items.filter(it => (it.allDay && d >= new Date(it.start.getFullYear(), it.start.getMonth(), it.start.getDate()) && d < it.end)
        || (!it.allDay && it.start <= tv && it.end >= tb)).forEach(it => {
        cell += `<div class="fcc-ad-ev" style="background:${it.person.color};color:${this._textOn(it.person.color)}" data-key="${this._esc(it.key)}" data-ent="${it.entity}">${this._esc(it.display)}</div>`;
      });
      cell += "</div>"; allRow += cell;
    });
    allRow += "</div>";

    let hours = '<div class="fcc-hours">';
    for (let h = h0; h < h1; h++) hours += `<div class="fcc-hr" style="height:${HH}px"><span>${this._pad(h)}:00</span></div>`;
    hours += "</div>";

    const nowD = new Date(); const nowFrac = nowD.getHours() + nowD.getMinutes() / 60;
    const todayMid = new Date(nowD); todayMid.setHours(0, 0, 0, 0);
    let body = `<div class="fcc-grid"><div class="fcc-gutter">${hours}</div>`;
    cols.forEach(d => {
      // Ueberlappung statt Starttag: ein Termin ueber Mitternacht gehoert in
      // beide Spalten, nicht nur in die des Beginns.
      const tagVon = new Date(d); tagVon.setHours(0, 0, 0, 0);
      const tagBis = new Date(tagVon); tagBis.setDate(tagBis.getDate() + 1);
      // Tage, an denen der Termin durchlaeuft, stehen oben in der Ganztagszeile
      const dayItems = items.filter(it => !it.allDay && it.start < tagBis && it.end > tagVon
        && !(it.start <= tagVon && it.end >= tagBis));
      dayItems.sort((a, b) => a.start - b.start || a.end - b.end);
      const clusters = []; let cur = [], curEnd = null;
      dayItems.forEach(e => { if (curEnd !== null && e.start >= curEnd) { clusters.push(cur); cur = []; curEnd = null; } cur.push(e); curEnd = curEnd === null ? e.end : new Date(Math.max(curEnd, e.end)); });
      if (cur.length) clusters.push(cur);
      clusters.forEach(cl => { const colsEnd = []; cl.forEach(e => { let placed = false; for (let i = 0; i < colsEnd.length; i++) { if (colsEnd[i] <= e.start) { e._c = i; colsEnd[i] = e.end; placed = true; break; } } if (!placed) { e._c = colsEnd.length; colsEnd.push(e.end); } }); cl.forEach(e => e._n = colsEnd.length); });
      const today = this._isToday(d);
      const dMid = new Date(d); dMid.setHours(0, 0, 0, 0);
      const isPast = !today && dMid < todayMid;
      let col = `<div class="fcc-col${today ? " fcc-today-col" : ""}" data-date="${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}" style="height:${gridH}px;background-size:100% ${HH}px">`;
      if (today && nowFrac >= h0 && nowFrac < h1) { const nt = (nowFrac - h0) * HH; col += `<div class="fcc-past fcc-nowpast" style="height:${nt}px"></div><div class="fcc-now" style="top:${nt}px"></div>`; }
      else if (isPast) { col += `<div class="fcc-past" style="height:${gridH}px"></div>`; }
      dayItems.forEach(e => {
        // Auf den Tag zuschneiden: laeuft der Termin schon oder laeuft er
        // weiter, reicht der Balken bis an den Rand des Rasters.
        const std = e.start <= tagVon ? h0 : e.start.getHours() + e.start.getMinutes() / 60;
        const end = e.end >= tagBis ? h1 : e.end.getHours() + e.end.getMinutes() / 60;
        const sd = Math.max(h0, std);
        const ed = Math.min(h1, Math.max(sd + 0.25, end));
        const top = (sd - h0) * HH, hgt = Math.max(16, (ed - sd) * HH);
        const w = 100 / (e._n || 1), left = (e._c || 0) * w;
        const faengtAn = e.start > tagVon;
        const zeit = faengtAn ? `${this._pad(e.start.getHours())}:${this._pad(e.start.getMinutes())}`
          : (e.end < tagBis ? `bis ${this._pad(e.end.getHours())}:${this._pad(e.end.getMinutes())}` : "");
        col += `<div class="fcc-ev" data-key="${this._esc(e.key)}" data-ent="${e.entity}" style="top:${top}px;height:${hgt}px;left:${left}%;width:${w}%;background:${e.person.color};color:${this._textOn(e.person.color)}"><span class="fcc-ev-t">${this._esc(e.display)}</span><span class="fcc-ev-h">${this._esc(zeit)}</span></div>`;
      });
      col += "</div>"; body += col;
    });
    body += "</div>";
    return { label, html: `<div class="fcc-wk">${head}${allRow}<div class="fcc-scroll">${body}</div></div>` };
  }

  _monthHTML() {
    const r = this._range();
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const cells = []; const d = new Date(r.gridStart);
    while (d < r.gridEnd) { cells.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const items = this._items();
    const mlabel = r.start.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    let head = '<div class="fcc-m-head">'; dn.forEach(n => head += `<div>${n}</div>`); head += "</div>";
    let grid = '<div class="fcc-m-grid">';
    cells.forEach(c => {
      const inMonth = c.getMonth() === r.start.getMonth();
      const dayEv = items.filter(it => { const s = new Date(it.start.getFullYear(), it.start.getMonth(), it.start.getDate()); const e = it.allDay ? it.end : new Date(it.end.getFullYear(), it.end.getMonth(), it.end.getDate() + 1); return c >= s && c < e; });
      dayEv.sort((a, b) => (a.allDay === b.allDay) ? a.start - b.start : (a.allDay ? -1 : 1));
      let cell = `<div class="fcc-m-cell${inMonth ? "" : " fcc-dim"}${this._isToday(c) ? " fcc-today" : ""}" data-date="${c.getFullYear()}-${this._pad(c.getMonth() + 1)}-${this._pad(c.getDate())}"><div class="fcc-m-num">${c.getDate()}</div>`;
      dayEv.slice(0, 4).forEach(it => { const tm = it.allDay ? "" : `${this._pad(it.start.getHours())}:${this._pad(it.start.getMinutes())} `; cell += `<div class="fcc-m-ev" data-key="${this._esc(it.key)}" data-ent="${it.entity}" style="border-left-color:${it.person.color}"><span class="fcc-m-t">${this._esc(tm)}${this._esc(it.display)}</span></div>`; });
      if (dayEv.length > 4) cell += `<div class="fcc-m-more">+${dayEv.length - 4}</div>`;
      cell += "</div>"; grid += cell;
    });
    grid += "</div>";
    return { label: mlabel, html: `<div class="fcc-m">${head}${grid}</div>` };
  }

  _openEvent(opts) {
    opts = opts || {};
    const persons = this.config.persons.filter(p => p.calendar && !p.no_create);
    if (!persons.length || !this._hass) return;
    const pad = n => String(n).padStart(2, "0");
    const it = opts.item || null;
    const edit = !!it;
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let dateIso, dateIso2, von, bis, allDay = false, title = "", personIdx = 0;
    if (edit) {
      const s = it.start, e = it.end;
      dateIso = iso(s);
      allDay = !!it.allDay;
      // Ganztaegige Termine enden in HA am Folgetag (exklusiv). Im Formular
      // steht der letzte Tag, an dem der Termin tatsaechlich laeuft.
      if (allDay) { const le = new Date(e); le.setDate(le.getDate() - 1); dateIso2 = iso(le < s ? s : le); }
      else dateIso2 = iso(e);
      von = pad(s.getHours()) + ":" + pad(s.getMinutes());
      bis = pad(e.getHours()) + ":" + pad(e.getMinutes());
      title = it.display || "";
      const pi = persons.findIndex(p => it.person && p.name === it.person.name);
      personIdx = pi >= 0 ? pi : 0;
    } else {
      dateIso = opts.dateIso;
      dateIso2 = opts.dateIso;
      von = pad(opts.hour) + ":00";
      bis = pad(Math.min(opts.hour + 1, 23)) + ":00";
    }
    const ov = document.createElement("div"); ov.className = "fcc-ov";
    const box = document.createElement("div"); box.className = "fcc-modal";
    const optsHtml = persons.map((p, i) => `<option value="${i}"${i === personIdx ? " selected" : ""}>${this._esc(p.name)}</option>`).join("");
    box.innerHTML = `<div class="fcc-modal-t">${edit ? "Termin bearbeiten" : "Neuer Termin"}</div>
      <input class="fcc-in fcc-title" type="text" placeholder="Titel" value="${this._esc(title)}">
      <label class="fcc-lab">Wer</label><select class="fcc-in fcc-person">${optsHtml}</select>
      <div class="fcc-row2"><div><label class="fcc-lab">Beginn</label><input class="fcc-in fcc-date" type="date" value="${dateIso}"></div><div><label class="fcc-lab">Ende</label><input class="fcc-in fcc-date2" type="date" value="${dateIso2}"></div></div>
      <label class="fcc-check"><input type="checkbox" class="fcc-allday"${allDay ? " checked" : ""}> Ganztags</label>
      <div class="fcc-row2 fcc-times"><div><label class="fcc-lab">Von</label><input class="fcc-in fcc-von" type="time" value="${von}"></div><div><label class="fcc-lab">Bis</label><input class="fcc-in fcc-bis" type="time" value="${bis}"></div></div>
      <div class="fcc-modal-btns"><button class="fcc-btn2 fcc-cancel">Abbrechen</button>${edit ? '<button class="fcc-btn2 fcc-del">Löschen</button>' : ''}<button class="fcc-btn2 fcc-save">Speichern</button></div>`;
    ov.appendChild(box); this.appendChild(ov);
    this._editing = true; // blockiert Re-Renders, solange der Dialog offen ist
    const ti = box.querySelector(".fcc-title");
    const adCb = box.querySelector(".fcc-allday");
    const timesEl = box.querySelector(".fcc-times");
    const syncTimes = () => { timesEl.style.display = adCb.checked ? "none" : "flex"; };
    syncTimes(); adCb.addEventListener("change", syncTimes);
    setTimeout(() => { ti.focus(); }, 30);
    const close = () => { this._editing = false; if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    box.querySelector(".fcc-cancel").addEventListener("click", close);
    const delBtn = box.querySelector(".fcc-del");
    if (delBtn) delBtn.addEventListener("click", () => { close(); this._deleteItem(it).then(() => this._maybeFetch(true)); });
    box.querySelector(".fcc-save").addEventListener("click", () => {
      const t = ti.value.trim(); if (!t) { ti.focus(); return; }
      const p = persons[+box.querySelector(".fcc-person").value];
      const d = box.querySelector(".fcc-date").value;
      // Enddatum nie vor dem Startdatum — sonst legt HA einen ungueltigen Termin an
      let d2 = box.querySelector(".fcc-date2").value || d;
      if (d2 < d) d2 = d;
      const ad = adCb.checked;
      const summary = (p.prefix ? p.prefix + " " : "") + t;
      // Zeiten und Daten vor close() aus dem Formular lesen
      let startDate = d, endDate = "", startDT = "", endDT = "";
      if (ad) {
        // Im Formular steht der letzte Tag, HA erwartet den Folgetag
        const nd = new Date(d2 + "T00:00:00"); nd.setDate(nd.getDate() + 1);
        endDate = iso(nd);
      } else {
        let v = box.querySelector(".fcc-von").value || "09:00";
        let b = box.querySelector(".fcc-bis").value || v;
        // Nur innerhalb desselben Tages muss das Ende nach dem Beginn liegen;
        // ueber Mitternacht hinweg ist eine kleinere Uhrzeit voellig richtig.
        if (d2 === d && b <= v) {
          const bd = new Date(d + "T" + v + ":00"); const day0 = bd.getDate();
          bd.setMinutes(bd.getMinutes() + 60);
          b = bd.getDate() !== day0 ? "23:59" : pad(bd.getHours()) + ":" + pad(bd.getMinutes());
        }
        startDT = d + " " + v + ":00"; endDT = d2 + " " + b + ":00";
      }
      close();
      const refresh = () => this._maybeFetch(true);
      const doCreate = () => {
        const data = { entity_id: p.calendar, summary: summary };
        if (edit && it.description) data.description = it.description;
        if (ad) { data.start_date = startDate; data.end_date = endDate; }
        else { data.start_date_time = startDT; data.end_date_time = endDT; }
        return this._hass.callService("calendar", "create_event", data).then(() => true).catch(() => { this._toast("Termin konnte nicht gespeichert werden"); return false; });
      };
      const createThenDelete = () => doCreate().then(ok => { if (!ok) return; return this._deleteItem(it, true).then(del => { if (!del) this._toast("Gespeichert, aber alter Termin blieb stehen – bitte Duplikat prüfen"); }); }).then(refresh);
      if (edit && it && it.uid && p.calendar === it.entity) {
        // Bestehenden Termin aktualisieren (erhält UID, Serie, Beschreibung); Fallback: neu anlegen, dann alt löschen
        const msg = { type: "calendar/event/update", entity_id: it.entity, uid: it.uid, event: { summary: summary } };
        if (it.recurrence_id) msg.recurrence_id = it.recurrence_id;
        if (it.description) msg.event.description = it.description;
        if (ad) { msg.event.dtstart = startDate; msg.event.dtend = endDate; }
        else { msg.event.dtstart = startDT.replace(" ", "T"); msg.event.dtend = endDT.replace(" ", "T"); }
        this._hass.callWS(msg).then(refresh).catch(createThenDelete);
      } else if (edit && it && it.uid) {
        createThenDelete(); // Kalender gewechselt
      } else {
        doCreate().then(refresh);
      }
    });
  }
  _deleteItem(it, quiet) {
    if (!it || !it.uid) return Promise.resolve(false);
    const msg = { type: "calendar/event/delete", entity_id: it.entity, uid: it.uid };
    if (it.recurrence_id) msg.recurrence_id = it.recurrence_id; // nur diese Instanz, nicht die ganze Serie
    return this._hass.callWS(msg).then(() => true).catch(() => { if (!quiet) this._toast("Termin konnte nicht gelöscht werden"); return false; });
  }

  _render() {
    if (!this._hass) return;
    if (this._editing) return; // offenen Dialog nicht zerstören
    const view = this._view === "month" ? this._monthHTML()
      : this._view === "agenda" ? this._agendaHTML() : this._weekHTML();
    const css = this._css();
    const kopf = this.config.hide_header ? "" : this._headerHTML(view.label);
    const legende = this.config.hide_legend ? "" : this._legendHTML();
    this.innerHTML = `<style>${css}</style><ha-card class="fcc-card">${kopf}${legende}${view.html}</ha-card>`;
    this.querySelectorAll(".fcc-nav-b,.fcc-today").forEach(b => b.addEventListener("click", () => { const dd = parseInt(b.dataset.d, 10); this._offset = dd === 0 ? 0 : this._offset + dd; this._maybeFetch(true); }));
    this.querySelectorAll(".fcc-vw").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; if (v !== this._view) { this._view = v; this._offset = 0; this._maybeFetch(true); } }));
    this.querySelectorAll(".fcc-chip").forEach(b => b.addEventListener("click", () => { const n = b.dataset.person; if (this._hidden.has(n)) this._hidden.delete(n); else this._hidden.add(n); this._saveHidden(); this._render(); }));
    this.querySelectorAll(".fcc-ev,.fcc-ad-ev,.fcc-m-ev,.fcc-ag-ev").forEach(el => el.addEventListener("click", e => {
      e.stopPropagation();
      const k = el.dataset.key;
      const item = k && this._evMap ? this._evMap[k] : null;
      if (item && !(item.person && item.person.no_create)) { this._openEvent({ item: item }); return; }
      const ent = el.dataset.ent; if (ent) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: ent }, bubbles: true, composed: true }));
    }));
    this.querySelectorAll(".fcc-col").forEach(col => col.addEventListener("click", e => { const ds = col.dataset.date; if (!ds) return; const h = Math.min(this.config.day_end - 1, Math.max(this.config.day_start, this.config.day_start + Math.floor(e.offsetY / 46))); this._openEvent({ dateIso: ds, hour: h }); }));
    this.querySelectorAll(".fcc-m-cell").forEach(c => c.addEventListener("click", () => { const ds = c.dataset.date; if (ds) this._openEvent({ dateIso: ds, hour: 9 }); }));
    if (this._view === "week") { const sc = this.querySelector(".fcc-scroll"); if (sc) { const nd = new Date(); const nf = nd.getHours() + nd.getMinutes() / 60; const tgt = (this._offset === 0 && nf > this.config.day_start + 1) ? (nf - this.config.day_start - 1) : (8 - this.config.day_start); sc.scrollTop = Math.max(0, tgt * 46); } }
  }

  _css() {
    return `
    .fcc-card{overflow:hidden;padding-bottom:6px;}
    .fcc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;background:linear-gradient(135deg,rgba(var(--fp-tint-rgb,129,212,250),.70),rgba(var(--fp-accent-rgb,79,195,247),.70));color:#fff;}
    .fcc-title{font-size:1.15rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.25);}
    .fcc-range{flex:1;text-align:center;font-size:.92rem;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.2);}
    .fcc-nav,.fcc-views{display:flex;gap:6px;}
    .fcc-btn{border:none;border-radius:9px;padding:7px 12px;font-size:.85rem;cursor:pointer;background:rgba(255,255,255,.25);color:#fff;}
    .fcc-btn:hover{background:rgba(255,255,255,.42);}
    .fcc-vw-on{background:#fff;color:var(--fp-head,#0277bd);font-weight:700;}
    .fcc-legend{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 4px;}
    .fcc-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--divider-color,#ddd);background:var(--card-background-color);color:var(--primary-text-color);border-radius:999px;padding:4px 10px;font-size:.82rem;cursor:pointer;}
    .fcc-chip.fcc-off{opacity:.4;text-decoration:line-through;}
    .fcc-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
    /* Mehrtagesansicht */
    .fcc-ag{display:grid;gap:10px;padding:12px 14px 14px;}
    .fcc-ag-col{min-width:0;}
    .fcc-ag-h{display:flex;align-items:baseline;gap:6px;margin-bottom:7px;padding-bottom:5px;border-bottom:1px solid var(--divider-color);}
    .fcc-ag-n{font-size:1.15rem;font-weight:700;color:var(--primary-text-color);line-height:1;}
    .fcc-ag-w{font-size:.78rem;color:var(--secondary-text-color);}
    .fcc-ag-today .fcc-ag-n{color:var(--fp-head,var(--primary-color));}
    .fcc-ag-today .fcc-ag-h{border-bottom-color:var(--fp-head,var(--primary-color));}
    .fcc-ag-ev{border-left:3px solid #888;border-radius:0 8px 8px 0;padding:5px 8px;margin-bottom:5px;cursor:pointer;}
    .fcc-ag-ev:hover{filter:brightness(.96);}
    .fcc-ag-t{font-size:.72rem;font-weight:700;line-height:1.3;}
    .fcc-ag-s{font-size:.8rem;line-height:1.3;color:var(--primary-text-color);overflow-wrap:anywhere;}
    .fcc-ag-none{font-size:.78rem;color:var(--secondary-text-color);opacity:.7;padding:5px 2px;}
    .fcc-gutter{width:48px;flex:0 0 48px;}
    .fcc-wk-head{display:flex;padding:6px 8px 0;}
    .fcc-dcol{flex:1;min-width:0;text-align:center;border-radius:8px 8px 0 0;padding:2px;}
    .fcc-dn{font-size:.72rem;color:var(--secondary-text-color);font-weight:700;}
    .fcc-dd{font-size:.7rem;color:var(--secondary-text-color);}
    .fcc-dcol.fcc-today .fcc-dn,.fcc-dcol.fcc-today .fcc-dd{color:#039be5;}
    .fcc-allday{display:flex;padding:0 8px 4px;gap:0;align-items:stretch;}
    .fcc-allday-lbl{font-size:.6rem;color:var(--secondary-text-color);display:flex;align-items:center;justify-content:flex-end;padding-right:4px;}
    .fcc-ad-cell{flex:1;min-width:0;overflow:hidden;min-height:8px;padding:1px;}
    .fcc-ad-ev{font-size:.72rem;color:#fff;border-radius:6px;padding:1px 6px;margin:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;}
    .fcc-scroll{max-height:62vh;overflow-y:auto;padding:0 8px 8px;}
    .fcc-grid{display:flex;}
    .fcc-hours{position:relative;}
    .fcc-hr{position:relative;}
    .fcc-hr span{position:absolute;top:-7px;right:6px;font-size:.66rem;color:var(--secondary-text-color);}
    .fcc-col{position:relative;flex:1;min-width:0;border-left:1px solid var(--divider-color,#eee);background-image:linear-gradient(var(--divider-color,#eee) 1px,transparent 1px);}
    .fcc-today-col{background-color:rgba(var(--fp-tint-rgb,129,212,250),.20);}
    .fcc-ev{position:absolute;border-radius:7px;color:#fff;padding:2px 5px;overflow:hidden;font-size:.72rem;line-height:1.05;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;box-sizing:border-box;}
    .fcc-ev-t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .fcc-ev-h{font-size:.62rem;opacity:.9;}
    .fcc-past{position:absolute;left:0;right:0;top:0;background:rgba(0,0,0,.16);pointer-events:none;}
    .fcc-now{position:absolute;left:0;right:0;height:0;border-top:2px solid #e53935;z-index:6;pointer-events:none;}
    .fcc-now::before{content:"";position:absolute;left:-1px;top:-4px;width:8px;height:8px;border-radius:50%;background:#e53935;}
    .fcc-m-head{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:6px 8px 0;}
    .fcc-m-head>div{text-align:center;font-size:.72rem;font-weight:700;color:var(--secondary-text-color);}
    .fcc-m-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:6px 8px 8px;}
    .fcc-m-cell{min-width:0;overflow:hidden;min-height:84px;border-radius:8px;border:1px solid var(--divider-color);background:var(--secondary-background-color,rgba(0,0,0,.03));padding:3px;}
    .fcc-m-cell.fcc-dim{opacity:.45;}
    .fcc-m-cell.fcc-today{outline:2px solid #039be5;}
    .fcc-m-num{font-size:.72rem;font-weight:700;text-align:right;color:var(--primary-text-color);padding:0 2px;}
    .fcc-m-ev{border-left:3px solid #888;background:var(--card-background-color);border-radius:4px;margin:2px 0;padding:1px 4px;overflow:hidden;cursor:pointer;}
    .fcc-m-t{font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;color:var(--primary-text-color);}
    .fcc-m-more{font-size:.62rem;color:var(--secondary-text-color);padding-left:4px;}
    .fcc-col{cursor:pointer;}
    .fcc-m-cell{cursor:pointer;}
    .fcc-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:20;}
    .fcc-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);text-shadow:none;width:min(92vw,360px);border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
    .fcc-modal-t{font-size:1.1rem;font-weight:700;margin-bottom:10px;}
    .fcc-lab{display:block;font-size:.72rem;color:var(--secondary-text-color);margin:8px 0 2px;}
    .fcc-in{width:100%;box-sizing:border-box;padding:9px 10px;font-size:1rem;border:1px solid var(--divider-color,#ccc);border-radius:10px;background:var(--secondary-background-color,#f3f3f3);color:var(--primary-text-color);}
    .fcc-row2{display:flex;gap:10px;}
    .fcc-row2>div{flex:1;}
    .fcc-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
    .fcc-btn2{border:none;border-radius:10px;padding:9px 14px;font-size:.9rem;cursor:pointer;}
    .fcc-cancel{background:var(--secondary-background-color,#eee);color:var(--primary-text-color);}
    .fcc-save{background:#039be5;color:#fff;font-weight:700;}
    .fcc-del{background:rgba(229,57,53,.15);color:#c62828;}
    .fcc-check{display:flex;align-items:center;gap:8px;font-size:.85rem;margin:10px 0 2px;color:var(--primary-text-color);}
    `;
  }
  getCardSize() { return 10; }
}
if (!customElements.get("family-calendar-card")) {
  customElements.define("family-calendar-card", FamilyCalendarCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "family-calendar-card", name: "Family Calendar Card", description: "Wochen-Stunden-Raster + Monat mit Praefix-Personen" });
}
})();

/* ===== kids-routine-card v6 (fehler-toasts) ===== */
(() => {
const U = window.__fpUtils;
const CPR = U.cp;
class KidsRoutineCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({ title: "Routinen", points_entity: "", reward_button: "", penalty_button: "", routines: [] }, config || {});
    this._prev = {}; this._inited = false; this._built = false; this._sig = "";
  }
  set hass(hass) {
    this._hass = hass;
    let sig = "";
    if (this.config.points_entity && hass.states[this.config.points_entity]) sig += hass.states[this.config.points_entity].state;
    this.config.routines.forEach(g => (g.tasks || []).forEach(t => { const s = hass.states[t.entity]; sig += "|" + (s ? s.state : "?"); }));
    if (sig === this._sig) return;
    this._sig = sig; this._render();
  }
  _esc(s) { return U.esc(s); }
  _toast(msg) { U.toast(this, msg); }
  _isOn(e) { const s = this._hass && this._hass.states[e]; return !!(s && s.state === "on"); }
  _fmtStars(v) { const n = parseFloat(v); return isNaN(n) ? v : String(Math.round(n)); }
  _toggle(task) {
    if (!this._hass || !task || !task.entity) return;
    const wasOn = this._isOn(task.entity);
    this._hass.callService("input_boolean", "toggle", { entity_id: task.entity }).catch(() => this._toast("Aufgabe konnte nicht umgeschaltet werden"));
    if (!wasOn) {
      this._celebrate(task.emoji);
      if (this.config.reward_button) this._hass.callService("button", "press", { entity_id: this.config.reward_button }).catch(() => {});
    } else {
      if (this.config.penalty_button) this._hass.callService("button", "press", { entity_id: this.config.penalty_button }).catch(() => {});
    }
  }
  _resetGroup(tasks) { const ids = (tasks || []).map(t => t.entity).filter(Boolean); if (this._hass && ids.length) this._hass.callService("input_boolean", "turn_off", { entity_id: ids }).catch(() => this._toast("Zurücksetzen fehlgeschlagen")); }
  _celebrate(emoji) {
    if (!this._fx) return;
    const e = emoji || CPR(0x2B50);
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("span");
      s.className = "kr-drop"; s.textContent = e;
      s.style.left = (Math.random() * 100) + "%";
      s.style.fontSize = (18 + Math.random() * 22) + "px";
      s.style.animationDelay = (Math.random() * 0.3) + "s";
      s.style.animationDuration = (1.1 + Math.random() * 0.9) + "s";
      this._fx.appendChild(s);
      setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 2400);
    }
  }
  _render() {
    if (!this._hass) return;
    if (!this._built) {
      this.innerHTML = `<style>${this._css()}</style><ha-card class="kr-card"><div class="kr-fx"></div><div class="kr-content"></div></ha-card>`;
      this._fx = this.querySelector(".kr-fx"); this._content = this.querySelector(".kr-content"); this._built = true;
    }
    const stars = this.config.points_entity && this._hass.states[this.config.points_entity] ? this._hass.states[this.config.points_entity].state : null;
    let html = `<div class="kr-head"><div class="kr-title">${this._esc(this.config.title)}</div>` + (stars != null ? `<div class="kr-stars">${CPR(0x2B50)} ${this._esc(this._fmtStars(stars))}</div>` : "") + `</div>`;
    this.config.routines.forEach((g, gi) => {
      const tasks = g.tasks || [];
      const done = tasks.filter(t => this._isOn(t.entity)).length;
      const all = tasks.length && done === tasks.length;
      html += `<div class="kr-group${all ? " kr-done" : ""}"><div class="kr-glabel"><span>${this._esc(g.icon || "")} ${this._esc(g.label || "")}</span><span class="kr-prog">${done}/${tasks.length}</span><button class="kr-reset" data-g="${gi}" title="Zurücksetzen">${CPR(0x21BB)}</button></div><div class="kr-tasks">`;
      tasks.forEach((t, ti) => {
        const on = this._isOn(t.entity);
        html += `<button class="kr-task${on ? " kr-on" : ""}" data-g="${gi}" data-t="${ti}"><span class="kr-emoji">${this._esc(t.emoji || "")}</span><span class="kr-lbl">${this._esc(t.label || "")}</span>${on ? `<span class="kr-check">${CPR(0x2714)}</span>` : ""}</button>`;
      });
      html += `</div></div>`;
    });
    this._content.innerHTML = html;
    this._content.querySelectorAll(".kr-task").forEach(b => b.addEventListener("click", () => { const g = +b.dataset.g, t = +b.dataset.t; this._toggle(this.config.routines[g].tasks[t]); }));
    this._content.querySelectorAll(".kr-reset").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); this._resetGroup(this.config.routines[+b.dataset.g].tasks || []); }));
  }
  _css() {
    return `
    .kr-card{position:relative;overflow:hidden;padding:6px 6px 12px;}
    .kr-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;}
    .kr-drop{position:absolute;top:-34px;animation-name:kr-fall;animation-timing-function:linear;animation-fill-mode:forwards;}
    @keyframes kr-fall{to{transform:translateY(380px) rotate(45deg);opacity:0;}}
    .kr-head{display:flex;justify-content:space-between;align-items:center;padding:8px 8px 4px;}
    .kr-title{font-size:1.2rem;font-weight:700;}
    .kr-stars{font-size:1.05rem;font-weight:700;color:#f9a825;}
    .kr-group{margin:6px 4px;border-radius:16px;padding:6px 8px;background:var(--secondary-background-color,rgba(0,0,0,.03));transition:background .2s;}
    .kr-group.kr-done{background:rgba(67,160,71,.16);}
    .kr-glabel{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.95rem;padding:2px 2px 6px;}
    .kr-glabel>span:first-child{flex:1;}
    .kr-prog{font-size:.8rem;color:var(--secondary-text-color);font-weight:600;}
    .kr-reset{border:none;background:transparent;color:var(--secondary-text-color);font-size:1.1rem;cursor:pointer;line-height:1;}
    .kr-tasks{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:8px;}
    .kr-task{position:relative;border:none;border-radius:16px;padding:10px 6px;background:var(--card-background-color,#fff);box-shadow:0 1px 4px rgba(0,0,0,.14);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;transition:transform .1s,background .15s;}
    .kr-task:active{transform:scale(.94);}
    .kr-task.kr-on{background:rgba(67,160,71,.20);}
    .kr-emoji{font-size:2rem;line-height:1;}
    .kr-task.kr-on .kr-emoji{filter:grayscale(.15);}
    .kr-lbl{font-size:.72rem;text-align:center;color:var(--primary-text-color);line-height:1.05;}
    .kr-check{position:absolute;top:4px;right:6px;color:#2e7d32;font-weight:800;font-size:.9rem;}
    `;
  }
  getCardSize() { return 6; }
}
if (!customElements.get("kids-routine-card")) {
  customElements.define("kids-routine-card", KidsRoutineCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "kids-routine-card", name: "Kids Routine Card", description: "Buddy-style routines with emoji + rewards" });
}
})();

/* ===== shopping-fav-card v20 (Datumsfeld als vierter Knopf in der Bis-wann-Reihe, Farben ueber Theme-Variablen, Wiederholung: eigene Intervalle wie „alle 2 Wochen") ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class ShoppingFavCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.list_entity) throw new Error("list_entity (todo-Liste) erforderlich");
    this.config = Object.assign({
      columns: 3, store_entity: "", title: "", assign: false, targets: [], default_target: "",
      big: false, fallback: "", add_button: false, add_label: "", show_due: true, target_label: "Wer?",
      // Serienaufgaben: nur moeglich, wenn das Ziel eine Todoist-Liste mit project_id ist.
      // Home Assistant reicht kein Wiederholungsmuster durch, deshalb legt die Karte solche
      // Aufgaben direkt ueber die Todoist-Schnittstelle an (rest_command).
      repeat_options: [], repeat_label: "Wiederholung", todoist_service: "rest_command.todoist_add_task",
    }, config || {});
    this._editing = false; this._lastVal = null; this._built = false;
  }
  set hass(hass) {
    this._hass = hass;
    if (this._editing) return;
    const v = this._storeVal();
    if (v !== this._lastVal || !this._built) { this._lastVal = v; this._render(); }
  }
  _storeVal() {
    const e = this.config.store_entity;
    const st = e && this._hass && this._hass.states[e];
    return st ? String(st.state) : "";
  }
  _items() { return this._storeVal().split(",").map(s => s.trim()).filter(Boolean); }
  _esc(s) { return U.esc(s); }
  _norm(s) { return U.norm(s); }
  _toast(msg) { U.toast(this, msg); }
  _emoji(name) {
    const n = this._norm(name);
    const map = [
      ["joghurt", 0x1F963], ["topfen", 0x1F963], ["quark", 0x1F963], ["milch", 0x1F95B], ["obers", 0x1F95B], ["sahne", 0x1F95B],
      ["butter", 0x1F9C8], ["mozzarella", 0x1F9C0], ["parmesan", 0x1F9C0], ["schafkase", 0x1F9C0], ["feta", 0x1F9C0], ["kase", 0x1F9C0],
      ["ei", 0x1F95A], ["weckerl", 0x1F956], ["semmel", 0x1F956], ["broetchen", 0x1F956], ["brotchen", 0x1F956], ["baguette", 0x1F956],
      ["toast", 0x1F35E], ["brot", 0x1F35E], ["gebaeck", 0x1F950], ["croissant", 0x1F950],
      ["schinken", 0x1F356], ["speck", 0x1F953], ["wurst", 0x1F32D], ["faschiert", 0x1F356], ["hack", 0x1F356], ["steak", 0x1F356], ["fleisch", 0x1F356],
      ["haehnchen", 0x1F357], ["hahnchen", 0x1F357], ["haendl", 0x1F357], ["huhn", 0x1F357], ["pute", 0x1F357],
      ["lachs", 0x1F41F], ["thunfisch", 0x1F41F], ["fisch", 0x1F41F],
      ["aufstrich", 0x1F96A], ["aufschnitt", 0x1F96A],
      ["tomate", 0x1F345], ["paradeiser", 0x1F345], ["paprika", 0x1FAD1], ["chili", 0x1F336], ["peperoni", 0x1F336],
      ["gurke", 0x1F952], ["salat", 0x1F957], ["zwiebel", 0x1F9C5], ["knoblauch", 0x1F9C4],
      ["kartoffel", 0x1F954], ["erdapfel", 0x1F954], ["karotte", 0x1F955], ["moehre", 0x1F955], ["mohre", 0x1F955],
      ["brokkoli", 0x1F966], ["karfiol", 0x1F966], ["blumenkohl", 0x1F966], ["spinat", 0x1F96C], ["kohl", 0x1F96C],
      ["pilz", 0x1F344], ["champignon", 0x1F344], ["mais", 0x1F33D], ["avocado", 0x1F951], ["gemuese", 0x1F966], ["gemuse", 0x1F966],
      ["apfel", 0x1F34E], ["banane", 0x1F34C], ["beere", 0x1F353], ["erdbeer", 0x1F353], ["zitrone", 0x1F34B], ["orange", 0x1F34A],
      ["traube", 0x1F347], ["birne", 0x1F350], ["obst", 0x1F34E],
      ["nudel", 0x1F35D], ["pasta", 0x1F35D], ["spaghet", 0x1F35D], ["reis", 0x1F35A], ["mehl", 0x1F33E],
      ["oel", 0x1FAD2], ["essig", 0x1FAD9], ["zucker", 0x1F36C], ["salz", 0x1F9C2], ["honig", 0x1F36F],
      ["schokolad", 0x1F36B], ["keks", 0x1F36A], ["kuchen", 0x1F370], ["eis", 0x1F368], ["chips", 0x1F37F], ["nuss", 0x1F95C],
      ["kaffee", 0x2615], ["tee", 0x1F375], ["wasser", 0x1F4A7], ["saft", 0x1F9C3], ["bier", 0x1F37A], ["wein", 0x1F377], ["smoothie", 0x1F964],
      ["klopapier", 0x1F9FB], ["toilettenpapier", 0x1F9FB], ["kuechenroll", 0x1F9FB], ["taschentuch", 0x1F9FB],
      ["seife", 0x1F9FC], ["shampoo", 0x1F9F4], ["zahnpasta", 0x1FAA5], ["waschmittel", 0x1F9F4], ["putz", 0x1F9FD], ["spuel", 0x1F9FD],
      ["windel", 0x1F9F7], ["batterie", 0x1F50B], ["blume", 0x1F490],
      ["mull", 0x1F5D1], ["abfall", 0x1F5D1], ["restmull", 0x1F5D1], ["biomull", 0x1F5D1], ["tonne", 0x1F5D1],
      ["altpapier", 0x267B], ["papier", 0x267B], ["recyc", 0x267B], ["karton", 0x1F4E6], ["paket", 0x1F4E6], ["brief", 0x2709],
      ["waesche", 0x1F9FA], ["wasche", 0x1F9FA], ["waschen", 0x1F9FA], ["waschmasch", 0x1F9FA], ["aufraeum", 0x1F9FA], ["aufraum", 0x1F9FA], ["ordnung", 0x1F9FA],
      ["geschirr", 0x1F37D], ["spuelmasch", 0x1F37D], ["spulmasch", 0x1F37D], ["abwasch", 0x1F37D], ["decken", 0x1F37D],
      ["staubsaug", 0x1F9F9], ["saugen", 0x1F9F9], ["staub", 0x1F9F9], ["kehren", 0x1F9F9], ["fegen", 0x1F9F9],
      ["wisch", 0x1F9FD], ["reinig", 0x1F9FD], ["fenster", 0x1F9FD],
      ["buegel", 0x1F455], ["bugel", 0x1F455], ["bett", 0x1F6CF],
      ["kochen", 0x1F373], ["backen", 0x1F9C1],
      ["rasen", 0x1F33F], ["maehen", 0x1F33F], ["mahen", 0x1F33F], ["garten", 0x1F33F], ["unkraut", 0x1F33F],
      ["gassi", 0x1F415], ["hund", 0x1F415], ["katze", 0x1F408], ["fuettern", 0x1F43E], ["futtern", 0x1F43E],
      ["rechnung", 0x1F4B6], ["zahlen", 0x1F4B6], ["ueberweis", 0x1F4B6], ["bank", 0x1F4B6],
      ["tanken", 0x26FD], ["auto", 0x1F697], ["werkstatt", 0x1F527], ["reparier", 0x1F527], ["reparatur", 0x1F527],
      ["apotheke", 0x1F48A], ["medikament", 0x1F48A], ["arzt", 0x1F3E5], ["termin", 0x1F4C5],
      ["einkauf", 0x1F6D2],
    ];
    for (const [k, cp] of map) { if (n.includes(k)) return CP(cp); }
    return this.config.fallback || CP(0x1F6D2);
  }
  _add(name) {
    const item = String(name || "").trim();
    if (!item) return;
    if (item.includes(",")) { this._toast("Kommas sind in Favoriten nicht möglich"); return; }
    const items = this._draft || (this._draft = this._items());
    if (items.some(x => x.toLowerCase() === item.toLowerCase())) return;
    if (items.concat(item).join(",").length > 255) { this._toast("Favoriten-Speicher voll (input_text: max. 255 Zeichen)"); return; }
    items.push(item); this._renderEditor(); this._persist();
  }
  _remove(i) {
    const items = this._draft || (this._draft = this._items());
    items.splice(i, 1); this._renderEditor(); this._persist();
  }
  _move(i, d) {
    const items = this._draft || (this._draft = this._items()); const j = i + d;
    if (j < 0 || j >= items.length) return;
    const t = items[i]; items[i] = items[j]; items[j] = t;
    this._renderEditor(); this._persist();
  }
  _persist() {
    if (!this._draft) return;
    const val = this._draft.join(",");
    this._lastVal = val;
    if (this._hass && this.config.store_entity) {
      this._hass.callService("input_text", "set_value", { entity_id: this.config.store_entity, value: val }).catch(() => this._toast("Favoriten konnten nicht gespeichert werden"));
    }
  }
  _projectOf(entity) {
    const t = (this.config.targets || []).find(x => x.entity === entity);
    return (t && t.project_id) || "";
  }
  _repeatable(entity) { return !!((this.config.repeat_options || []).length && this._projectOf(entity)); }

  _addItem(name, target, due, dueString) {
    if (!this._hass) return;
    const ent = target || this.config.list_entity;
    if (dueString) { this._addRecurring(name, ent, due, dueString); return; }
    const data = { entity_id: ent, item: name };
    if (due) data.due_date = due;
    window.dispatchEvent(new CustomEvent("fp-todo-add", { detail: { entity: ent, summary: name, due: due || null } }));
    this._hass.callService("todo", "add_item", data).catch(() => this._toast("Konnte nicht zur Liste hinzugefügt werden"));
  }

  // Serienaufgabe direkt bei Todoist anlegen. Ein gewaehltes Datum wird als
  // Startpunkt angehaengt ("… starting 2027-02-01"), sonst startet die Serie heute.
  async _addRecurring(name, ent, due, dueString) {
    const project = this._projectOf(ent);
    const svc = String(this.config.todoist_service || "");
    const [dom, srv] = svc.split(".");
    if (!project || !dom || !srv) { this._toast("Serienaufgaben sind für diese Liste nicht eingerichtet"); return; }
    const full = due ? `${dueString} starting ${due}` : dueString;
    window.dispatchEvent(new CustomEvent("fp-todo-add", { detail: { entity: ent, summary: name, due: due || null } }));
    try {
      await this._hass.callService(dom, srv, { content: name, project_id: project, due_string: full });
      this._toast(`„${name}" als Serie angelegt (${dueString})`);
      // Todoist braucht einen Moment; danach die Liste nachladen
      setTimeout(() => this._hass.callService("homeassistant", "update_entity", { entity_id: ent }).catch(() => {}), 3000);
    } catch (e) {
      this._toast("Serienaufgabe konnte nicht angelegt werden");
    }
  }

  // Auswahlzeile für die Wiederholung (nur bei Todoist-Zielen sinnvoll)
  _unitBtns(cls, sel) {
    return [["day", "Tage"], ["week", "Wochen"], ["month", "Monate"], ["year", "Jahre"]]
      .map(([u, l]) => `<button class="${cls}${u === sel ? " sf-rep-on" : ""}" data-u="${u}">${l}</button>`).join("");
  }
  _repeatHtml() {
    const opts = this.config.repeat_options || [];
    if (!opts.length) return "";
    const btns = [`<button class="sf-rep sf-rep-on" data-r="">Einmalig</button>`]
      .concat(opts.map(o => `<button class="sf-rep" data-r="${this._esc(o.due_string)}">${this._esc(o.label)}</button>`))
      .concat([`<button class="sf-rep" data-r="__custom">Eigene …</button>`]).join("");
    return `<div class="sf-sub sf-rep-sub">${this._esc(this.config.repeat_label)}</div>`
      + `<div class="sf-reps">${btns}</div>`
      + `<div class="sf-cust" style="display:none"><span class="sf-cust-lbl">alle</span>`
      + `<input class="sf-cust-n" type="number" min="1" max="99" value="2">`
      + `<div class="sf-cus">${this._unitBtns("sf-cu", "week")}</div></div>`;
  }
  _wireRepeat(ov) {
    this._rep = "";
    const sub = ov.querySelector(".sf-rep-sub"), row = ov.querySelector(".sf-reps"), cust = ov.querySelector(".sf-cust");
    if (!row) return;
    const nInp = cust && cust.querySelector(".sf-cust-n");
    const custDue = () => {
      const n = Math.min(99, Math.max(1, parseInt(nInp.value, 10) || 1));
      const on = cust.querySelector(".sf-cu.sf-rep-on");
      const u = on ? on.dataset.u : "week";
      return `every! ${n} ${u}${n > 1 ? "s" : ""}`;   // Todoist: Einzahl bei 1
    };
    const custOpen = () => cust && cust.style.display !== "none";
    const sync = () => {
      const on = this._repeatable(this._sel);
      if (sub) sub.style.display = on ? "" : "none";
      row.style.display = on ? "" : "none";
      if (!on) {
        this._rep = "";
        if (cust) cust.style.display = "none";
        row.querySelectorAll(".sf-rep").forEach(x => x.classList.toggle("sf-rep-on", x.dataset.r === ""));
      }
    };
    row.querySelectorAll(".sf-rep").forEach(b => b.addEventListener("click", () => {
      row.querySelectorAll(".sf-rep").forEach(x => x.classList.toggle("sf-rep-on", x === b));
      if (b.dataset.r === "__custom" && cust) { cust.style.display = "flex"; this._rep = custDue(); }
      else { if (cust) cust.style.display = "none"; this._rep = b.dataset.r; }
    }));
    if (cust) {
      nInp.addEventListener("input", () => { if (custOpen()) this._rep = custDue(); });
      cust.querySelectorAll(".sf-cu").forEach(b => b.addEventListener("click", () => {
        cust.querySelectorAll(".sf-cu").forEach(x => x.classList.toggle("sf-rep-on", x === b));
        if (custOpen()) this._rep = custDue();
      }));
    }
    sync();
    return sync;
  }
  _isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  // „Bis wann?": drei feste Knöpfe plus ein vierter für ein freies Datum.
  // Das Datumsfeld sitzt in der gleichen Reihe und trägt bis zur Auswahl die
  // Aufschrift „Datum wählen" — ein leeres date-Feld sieht sonst aus wie ein Versehen.
  _dueHtml() {
    return `<div class="sf-sub">Bis wann?</div><div class="sf-dates">`
      + `<button class="sf-q sf-q-on" data-q="none">Kein Datum</button>`
      + `<button class="sf-q" data-q="today">Heute</button>`
      + `<button class="sf-q" data-q="tom">Morgen</button>`
      + `<div class="sf-datewrap sf-dempty"><input class="sf-date" type="date"></div>`
      + `</div>`;
  }
  _wireDue(ov) {
    const dateInp = ov.querySelector(".sf-date");
    if (!dateInp) return;
    const wrap = ov.querySelector(".sf-datewrap");
    // Ein Tipp irgendwo ins date-Feld setzt nur den Cursor in ein Segment;
    // aufgeklappt wird der Wähler sonst nur über das Kalendersymbol.
    wrap.addEventListener("click", () => {
      try { if (dateInp.showPicker) dateInp.showPicker(); else { dateInp.focus(); dateInp.click(); } }
      catch (e) { dateInp.focus(); }
    });
    const paint = quickActive => {
      const has = !!dateInp.value;
      wrap.classList.toggle("sf-dempty", !has);
      wrap.classList.toggle("sf-dsel", has && !quickActive);
    };
    ov.querySelectorAll(".sf-q").forEach(b => b.addEventListener("click", () => {
      const q = b.dataset.q;
      if (q === "none") { this._due = ""; dateInp.value = ""; }
      else { const d = new Date(); if (q === "tom") d.setDate(d.getDate() + 1); this._due = this._isoDate(d); dateInp.value = this._due; }
      ov.querySelectorAll(".sf-q").forEach(x => x.classList.toggle("sf-q-on", x === b));
      paint(true);
    }));
    dateInp.addEventListener("change", () => {
      this._due = dateInp.value;
      ov.querySelectorAll(".sf-q").forEach(x => x.classList.remove("sf-q-on"));
      paint(false);
    });
    paint(true);
  }
  _openAssign(name) {
    this._editing = true;
    const targets = this.config.targets || [];
    const def = this.config.default_target || this.config.list_entity || (targets[0] && targets[0].entity) || "";
    this._sel = def; this._due = "";
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._aov = ov;
    const tbtns = targets.map(t => `<button class="sf-tgt${t.entity === def ? " sf-tgt-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">${this._emoji(name)} ${this._esc(name)}</div><div class="sf-sub">Wer?</div><div class="sf-tgts">${tbtns}</div>${this._dueHtml()}${this._repeatHtml()}<div class="sf-foot"><button class="sf-cancel">Abbrechen</button><button class="sf-ok">OK</button></div></div>`;
    this.appendChild(ov);
    const syncRep = this._wireRepeat(ov);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeAssign(); });
    ov.querySelectorAll(".sf-tgt").forEach(b => b.addEventListener("click", () => {
      this._sel = b.dataset.e;
      ov.querySelectorAll(".sf-tgt").forEach(x => x.classList.toggle("sf-tgt-on", x === b));
      if (syncRep) syncRep();
    }));
    this._wireDue(ov);
    ov.querySelector(".sf-cancel").addEventListener("click", () => this._closeAssign());
    ov.querySelector(".sf-ok").addEventListener("click", () => { this._addItem(name, this._sel || def, this._due, this._rep); this._closeAssign(); });
  }
  _closeAssign() {
    this._editing = false;
    if (this._aov && this._aov.parentNode) this._aov.parentNode.removeChild(this._aov);
    this._aov = null;
  }
  _openAdd() {
    this._editing = true;
    const targets = this.config.targets || [];
    const def = this.config.default_target || this.config.list_entity || (targets[0] && targets[0].entity) || "";
    this._sel = def; this._due = "";
    const favs = this._items();
    const favChips = favs.map(f => `<button class="sf-favpick" data-n="${this._esc(f)}">${this._emoji(f)} ${this._esc(f)}</button>`).join("");
    const tbtns = targets.map(t => `<button class="sf-tgt${t.entity === def ? " sf-tgt-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    const dueHtml = this.config.show_due ? this._dueHtml() : "";
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._aov = ov;
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">${CP(0x2795)} ${this._esc(this.config.add_label || "Hinzufügen")}</div><input class="sf-addtext" type="text" placeholder="Eingeben..."/>${favChips ? `<div class="sf-sub">Favoriten</div><div class="sf-favs">${favChips}</div>` : ""}${tbtns ? `<div class="sf-sub">${this._esc(this.config.target_label || "Wer?")}</div><div class="sf-tgts">${tbtns}</div>` : ""}${dueHtml}${this._repeatHtml()}<div class="sf-foot"><button class="sf-cancel">Abbrechen</button><button class="sf-ok">Hinzufügen</button></div></div>`;
    this.appendChild(ov);
    const txt = ov.querySelector(".sf-addtext");
    const syncRep = this._wireRepeat(ov);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeAssign(); });
    ov.querySelectorAll(".sf-favpick").forEach(b => b.addEventListener("click", () => { txt.value = b.dataset.n; }));
    ov.querySelectorAll(".sf-tgt").forEach(b => b.addEventListener("click", () => { this._sel = b.dataset.e; ov.querySelectorAll(".sf-tgt").forEach(x => x.classList.toggle("sf-tgt-on", x === b)); if (syncRep) syncRep(); }));
    this._wireDue(ov);
    const submit = () => { const t = txt.value.trim(); if (!t) { txt.focus(); return; } this._addItem(t, this._sel || def, this._due, this._rep); this._closeAssign(); };
    txt.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    ov.querySelector(".sf-cancel").addEventListener("click", () => this._closeAssign());
    ov.querySelector(".sf-ok").addEventListener("click", submit);
  }
  _flash(b) {
    const o = b.innerHTML; b.classList.add("sf-added"); b.innerHTML = CP(0x2713) + " Hinzugefügt";
    setTimeout(() => { b.classList.remove("sf-added"); b.innerHTML = o; }, 850);
  }
  _render() {
    this._built = true;
    // Favoriten und Hinzufügen-Knopf sind kombinierbar. Ohne ausdrückliche
    // Angabe bleibt das alte Verhalten: mit Knopf nur der Knopf (kompakte
    // Übersicht), ohne Knopf nur die Favoriten.
    const showFavs = this.config.show_favorites !== undefined
      ? !!this.config.show_favorites : !this.config.add_button;
    const head = this.config.title ? `<div class="sf-title">${this._esc(this.config.title)}</div>` : "";
    let body = "";
    if (showFavs) {
      const items = this._items();
      const cols = this.config.columns || 3;
      const big = this.config.big ? " sf-big" : "";
      const chips = items.map(it => `<button class="sf-chip${big}" data-n="${this._esc(it)}">${this._emoji(it)} ${this._esc(it)}</button>`).join("");
      body += `<div class="sf-grid" style="grid-template-columns:repeat(${cols},1fr);">${chips || `<div class="sf-empty">Noch keine Favoriten</div>`}</div>`
            + `<div class="sf-editbar"><button class="sf-edit">${CP(0x270F) + CP(0xFE0F)} Favoriten bearbeiten</button></div>`;
    }
    if (this.config.add_button) {
      // gleiche Leiste wie „Favoriten bearbeiten" -> identische Breite und Abstand
      body += `<div class="sf-addbar"><button class="sf-addbig">${CP(0x2795)} ${this._esc(this.config.add_label || "Aufgabe hinzufügen")}</button></div>`;
    }
    this.innerHTML = `<ha-card class="sf-card${this.config.add_button && !showFavs ? " sf-addcard" : ""}">${head}${body}</ha-card>${this._styles()}`;

    const ab = this.querySelector(".sf-addbig");
    if (ab) ab.addEventListener("click", () => this._openAdd());
    const assign = this.config.assign && (this.config.targets || []).length;
    this.querySelectorAll(".sf-chip").forEach(b => b.addEventListener("click", () => {
      if (assign) { this._openAssign(b.dataset.n); }
      else { this._addItem(b.dataset.n, this.config.list_entity); this._flash(b); }
    }));
    const eb = this.querySelector(".sf-edit"); if (eb) eb.addEventListener("click", () => this._openEditor());
  }
  _openEditor() {
    this._editing = true;
    this._draft = this._items();
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._ov = ov;
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">Favoriten bearbeiten</div><div class="sf-list"></div><div class="sf-addrow"><input class="sf-new" type="text" placeholder="Neuer Favorit..."><button class="sf-addbtn">${CP(0x2795)} Hinzufügen</button></div><div class="sf-foot"><button class="sf-done">Fertig</button></div></div>`;
    this.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeEditor(); });
    const inp = ov.querySelector(".sf-new");
    ov.querySelector(".sf-addbtn").addEventListener("click", () => { this._add(inp.value); inp.value = ""; inp.focus(); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); this._add(inp.value); inp.value = ""; } });
    ov.querySelector(".sf-done").addEventListener("click", () => this._closeEditor());
    this._renderEditor();
  }
  _renderEditor() {
    if (!this._ov) return;
    const list = this._ov.querySelector(".sf-list");
    const items = this._draft || this._items();
    list.innerHTML = items.map((it, i) => `<div class="sf-row"><span class="sf-rlbl">${this._emoji(it)} ${this._esc(it)}</span><span class="sf-acts"><button data-a="up" data-i="${i}" title="Hoch">${CP(0x25B2)}</button><button data-a="dn" data-i="${i}" title="Runter">${CP(0x25BC)}</button><button class="sf-x" data-a="rm" data-i="${i}" title="Entfernen">${CP(0x2715)}</button></span></div>`).join("") || `<div class="sf-empty">Noch keine Favoriten</div>`;
    list.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const i = +b.dataset.i, a = b.dataset.a;
      if (a === "rm") this._remove(i); else if (a === "up") this._move(i, -1); else if (a === "dn") this._move(i, 1);
    }));
  }
  _closeEditor() {
    this._editing = false;
    if (this._ov && this._ov.parentNode) this._ov.parentNode.removeChild(this._ov);
    this._ov = null; this._draft = null; this._lastVal = this._storeVal(); this._render();
  }
  _styles() {
    return `<style>
      .sf-card{padding:12px;}
      .sf-title{font-weight:700;margin-bottom:8px;}
      .sf-grid{display:grid;gap:8px;}
      .sf-chip{height:50px;border:1px solid var(--divider-color);border-radius:12px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.92rem;font-weight:600;cursor:pointer;padding:4px;line-height:1.1;}
      .sf-chip:hover{background:var(--primary-color);color:var(--text-primary-color,#fff);}
      .sf-chip:active{transform:scale(.97);}
      .sf-added{background:rgba(76,175,80,.85)!important;color:#fff!important;border-color:transparent!important;}
      .sf-empty{grid-column:1/-1;color:var(--secondary-text-color);padding:8px;text-align:center;}
      .sf-editbar{margin-top:10px;display:flex;}
      .sf-edit{flex:1;border:none;border-radius:10px;padding:10px;background:rgba(120,144,156,.16);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .sf-edit:hover{background:rgba(120,144,156,.30);}
      .sf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:20;}
      .sf-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,420px);max-height:82vh;overflow:auto;border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
      .sf-mhead{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .sf-list{display:flex;flex-direction:column;gap:6px;}
      .sf-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(127,127,127,.10);border-radius:10px;padding:6px 8px;}
      .sf-rlbl{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .sf-acts{display:flex;gap:2px;flex:none;}
      .sf-acts button{border:none;background:transparent;cursor:pointer;font-size:1rem;padding:4px 7px;color:var(--secondary-text-color);border-radius:8px;}
      .sf-acts button:hover{background:rgba(127,127,127,.18);}
      .sf-acts .sf-x{color:#c62828;}
      .sf-addrow{display:flex;gap:8px;margin-top:14px;}
      .sf-new{flex:1;border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-addbtn{border:none;border-radius:10px;padding:10px 12px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;cursor:pointer;white-space:nowrap;}
      .sf-foot{margin-top:16px;display:flex;justify-content:flex-end;}
      .sf-done{border:none;border-radius:10px;padding:10px 18px;background:rgba(120,144,156,.22);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .sf-chip.sf-big{height:66px;font-size:1.05rem;border-radius:14px;}
      .sf-sub{font-size:.8rem;font-weight:700;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.03em;margin:14px 0 6px;}
      .sf-tgts,.sf-dates{display:flex;gap:8px;flex-wrap:wrap;}
      .sf-tgt{flex:1;min-width:84px;border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .sf-tgt-on{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:transparent;}
      .sf-q{flex:1;min-width:70px;border:1px solid var(--divider-color);border-radius:10px;padding:9px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.9rem;}
      .sf-q-on{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .sf-reps{display:flex;gap:6px;flex-wrap:wrap;}
      .sf-rep{border:1px solid var(--divider-color);border-radius:10px;padding:8px 11px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.85rem;}
      .sf-rep-on{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .sf-cust{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
      .sf-cust-lbl{color:var(--secondary-text-color);font-size:.9rem;}
      .sf-cust-n{width:66px;padding:8px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.95rem;}
      .sf-cus{display:flex;gap:5px;flex:1;flex-wrap:wrap;}
      .sf-cu{flex:1;min-width:64px;border:1px solid var(--divider-color);border-radius:10px;padding:8px 6px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.82rem;}
      .sf-datewrap{position:relative;flex:1;min-width:120px;}
      .sf-date{width:100%;height:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;padding:9px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.9rem;}
      /* Leeres date-Feld zeigt sonst nur "tt.mm.jjjj" auf Weiß — die Auflage
         beschriftet es wie einen Knopf und lässt Tipps durch (pointer-events). */
      .sf-datewrap.sf-dempty::after{content:"Datum wählen";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.9rem;pointer-events:none;}
      .sf-datewrap.sf-dsel .sf-date{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .sf-foot .sf-cancel{border:none;border-radius:10px;padding:10px 16px;background:rgba(120,144,156,.20);color:var(--primary-text-color);font-weight:600;cursor:pointer;margin-right:8px;}
      .sf-foot .sf-ok{border:none;border-radius:10px;padding:10px 22px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;cursor:pointer;}
      /* Zeigt die Karte nur den Knopf, ist der Knopf die Kachel: kein Rahmen,
         keine Innenabstaende, eine durchgehende Flaeche. */
      .sf-addcard{padding:0;background:transparent;border:none;box-shadow:none;}
      .sf-addbar{margin-top:8px;display:flex;}
      .sf-addcard .sf-addbar{margin-top:0;}
      .sf-addbig{flex:1;border:none;border-radius:10px;padding:12px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;font-size:1rem;cursor:pointer;}
      .sf-addcard .sf-addbig{border-radius:var(--ha-card-border-radius,12px);padding:15px 12px;}
      .sf-addbig:hover{background:rgba(var(--fp-accent-rgb,79,195,247),1);}
      .sf-addtext{width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;padding:11px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-favs{display:flex;gap:8px;flex-wrap:wrap;}
      .sf-favpick{border:1px solid var(--divider-color);border-radius:12px;padding:12px 14px;min-height:46px;box-sizing:border-box;display:flex;align-items:center;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:1rem;font-weight:600;cursor:pointer;}
      .sf-favpick:active{transform:scale(.97);}
      .sf-favpick:hover{background:var(--primary-color);color:var(--text-primary-color,#fff);}
    </style>`;
  }
  getCardSize() { return 3; }
}
if (!customElements.get("shopping-fav-card")) {
  customElements.define("shopping-fav-card", ShoppingFavCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "shopping-fav-card", name: "Shopping Favorites Card", description: "Editable shopping quick-add favorites" });
}
})();

/* ===== nav-card v3 (fuellt die Rasterzelle aus; wraps any card; pointer/text-cursor children stay interactive) ===== */
(() => {
const U = window.__fpUtils;
class NavCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.card) throw new Error("card (zu umhuellende Karte) erforderlich");
    this.config = config;
    this._built = false;
  }
  set hass(hass) {
    this._hass = hass;
    if (this._child) this._child.hass = hass;
    if (!this._built) this._build();
  }
  async _build() {
    this._built = true;
    let el;
    try {
      const helpers = await window.loadCardHelpers();
      el = helpers.createCardElement(this.config.card);
    } catch (e) {
      this.innerHTML = "<ha-card style='padding:12px'>nav-card: Karte konnte nicht geladen werden</ha-card>";
      return;
    }
    if (this._hass) el.hass = this._hass;
    this._child = el;
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.height = "100%";
    wrap.appendChild(el);
    this.innerHTML = "";
    this.appendChild(wrap);
    wrap.addEventListener("click", e => this._onClick(e));
    // Hoehe bis zur umhuellten Karte durchreichen; deren ha-card braucht
    // zusaetzlich card_mod: "ha-card{height:100%}" in ihrer eigenen Config.
    if (U.fill) U.fill(this); // defensiv: fehlender Helfer darf die Karte nie killen
    if (el.style) el.style.height = "100%";
  }
  _isInteractive(path) {
    const tags = ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "HA-CHECKBOX", "MWC-CHECKBOX", "HA-SWITCH", "HA-TEXTFIELD", "HA-TEXTAREA", "HA-ICON-BUTTON", "MWC-BUTTON", "HA-BUTTON", "PAPER-INPUT", "HA-MD-LIST-ITEM", "HA-CHECK-LIST-ITEM", "MWC-LIST-ITEM", "HA-LIST-ITEM", "HA-SLIDER", "HA-CONTROL-SLIDER", "HA-CONTROL-BUTTON"];
    const roles = ["checkbox", "button", "textbox", "switch", "option", "menuitem", "slider"];
    for (const n of path) {
      if (n === this) break;
      const t = n.tagName;
      if (!t) continue;
      if (tags.indexOf(t) !== -1) return true;
      if (n.getAttribute) {
        const r = n.getAttribute("role");
        if (r && roles.indexOf(r) !== -1) return true;
        if (n.isContentEditable) return true;
      }
    }
    return false;
  }
  _onClick(e) {
    const path = e.composedPath ? e.composedPath() : [];
    if (this._isInteractive(path)) return;
    const target = path.length ? path[0] : e.target;
    if (target && target.nodeType === 1) {
      let cur = "";
      try { cur = getComputedStyle(target).cursor; } catch (er) {}
      if (cur === "pointer" || cur === "text") return;
    }
    const p = this.config.path;
    if (!p) return;
    history.pushState(null, "", p);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
  }
  getCardSize() { return (this._child && this._child.getCardSize) ? this._child.getCardSize() : 3; }
}
if (!customElements.get("nav-card")) {
  customElements.define("nav-card", NavCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "nav-card", name: "Nav Card", description: "Wraps a card; taps on non-interactive areas navigate" });
}
})();

/* ===== fp-todo-card v13 (Datumsfeld als Knopf in der Bis-wann-Reihe, Namens-Pille als Kartenkopf, Farben ueber Theme-Variablen, Änderungsdialog: eigene Wiederholungs-Intervalle) ===== */
(() => {
const U = window.__fpUtils;
class FpTodoCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error("entity erforderlich");
    this.config = config;
    // Eigener Änderungsdialog statt des nativen: erlaubt Verschieben in eine
    // andere Liste, Datum-Schnellauswahl und Serien (letztere nur bei Todoist).
    this._edit = !!config.edit_dialog;
    this._targets = config.edit_targets || config.targets || [];
    this._repeats = config.repeat_options || [];
    this._pending = [];
    this._built = false;
    this._onAdd = e => { const d = e.detail || {}; if (d.entity === this.config.entity && d.summary) this._optimistic(String(d.summary)); };
    this._onInlineKey = e => { if (e.key === "Enter") this._maybeInline(e); };
    this._onInlineClick = e => { this._maybeRowTap(e); if (!e.defaultPrevented) this._maybeInline(e); };
  }
  connectedCallback() {
    window.addEventListener("fp-todo-add", this._onAdd);
    this.addEventListener("keydown", this._onInlineKey, true);
    this.addEventListener("click", this._onInlineClick, true);
    this._build();
  }
  disconnectedCallback() {
    window.removeEventListener("fp-todo-add", this._onAdd);
    this.removeEventListener("keydown", this._onInlineKey, true);
    this.removeEventListener("click", this._onInlineClick, true);
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
    this._closeEdit();
  }
  // Tipp auf eine Aufgabe abfangen, bevor der native Bearbeiten-Dialog aufgeht.
  // Die Checkbox bleibt unangetastet — Abhaken muss weiter direkt funktionieren.
  _maybeRowTap(e) {
    if (!this._edit || this._ov) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.some(el => el && el.localName && /checkbox/.test(el.localName))) return;
    const row = path.find(el => el && el.localName === "ha-check-list-item");
    if (!row) return;
    const uid = row.itemId;
    if (!uid) return;
    e.stopPropagation(); e.preventDefault();
    this._openEdit(uid);
  }
  _maybeInline(e) {
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.some(el => el && el.classList && el.classList.contains("addRow"))) return;
    if (e.type === "click" && !path.some(el => el && el.classList && el.classList.contains("addButton"))) return;
    const inp = path.find(el => el && el.localName === "ha-input");
    const val = inp && inp.value != null ? String(inp.value).trim() : "";
    if (val) this._optimistic(val);
  }
  set hass(hass) { this._hass = hass; if (this._child) { this._child.hass = hass; this._placePill(); } else this._build(); }
  async _build() {
    if (this._built || !this._hass || !this.isConnected) return;
    this._built = true;
    let el;
    try {
      const helpers = await window.loadCardHelpers();
      const cfg = Object.assign({}, this.config);
      cfg.type = "todo-list";
      // Statt der nativen Ueberschrift eine farbige Pille: die native muss weg,
      // sonst steht der Name zweimal da.
      if (this.config.pill) delete cfg.title;
      el = helpers.createCardElement(cfg);
    } catch (e) { this._built = false; return; }
    el.hass = this._hass;
    this._child = el;
    this.innerHTML = "";
    this.appendChild(el);
    this._pillTries = 0;
    this._placePill();
  }
  // Die Pille gehoert optisch in die Karte, die native Karte hat aber ein
  // eigenes Shadow-DOM. Also hineinsetzen — und bei jedem Zustandswechsel
  // nachsehen, ob Lit sie beim Neuzeichnen entfernt hat.
  _placePill() {
    const p = this.config && this.config.pill;
    if (!p) return;
    const root = this._child && this._child.shadowRoot;
    const card = root && root.querySelector("ha-card");
    if (!card) {
      if ((this._pillTries = (this._pillTries || 0) + 1) < 30) setTimeout(() => this._placePill(), 100);
      return;
    }
    if (card.querySelector(".fpt-pill")) return;
    const el = document.createElement("div");
    el.className = "fpt-pill";
    el.textContent = p.label || this.config.title || "";
    el.setAttribute("style",
      "display:inline-block;margin:12px 0 2px 16px;padding:3px 11px;border-radius:99px;"
      + "font-size:12px;font-weight:600;line-height:1.55;letter-spacing:.01em;"
      + "background:" + (p.bg || "var(--secondary-background-color)") + ";"
      + "color:" + (p.color || "var(--primary-text-color)") + ";");
    card.insertBefore(el, card.firstChild);
  }
  _list() {
    try { return this._child && this._child.shadowRoot && this._child.shadowRoot.querySelector("ha-list"); } catch (e) { return null; }
  }

  // ---------- Änderungsdialog ----------
  _esc(s) { return U.esc(s); }
  _iso(d) { return d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate()); }
  _projectOf(entity) {
    const t = this._targets.find(x => x.entity === entity);
    return (t && t.project_id) || "";
  }
  async _loadItem(uid) {
    const ent = this.config.entity;
    const r = await this._hass.callService("todo", "get_items", { entity_id: ent }, undefined, false, true);
    const items = (r && r.response && r.response[ent] && r.response[ent].items) || [];
    return items.find(i => i.uid === uid) || null;
  }
  async _openEdit(uid) {
    let item = null;
    try { item = await this._loadItem(uid); }
    catch (e) { console.warn("[fp-todo-card] Aufgabe laden fehlgeschlagen:", this.config.entity, uid, e); }
    if (!item) { U.toast(this, "Aufgabe konnte nicht geladen werden"); return; }

    const src = this.config.entity;
    let sel = src, due = (item.due || "").slice(0, 10), rep = "";
    const tbtns = this._targets.map(t => `<button class="ft-tgt${t.entity === src ? " ft-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    const rbtns = [`<button class="ft-rep ft-on" data-r="">Unverändert</button>`]
      .concat(this._repeats.map(o => `<button class="ft-rep" data-r="${this._esc(o.due_string)}">${this._esc(o.label)}</button>`))
      .concat([`<button class="ft-rep" data-r="__custom">Eigene …</button>`]).join("");
    const ubtns = [["day", "Tage"], ["week", "Wochen"], ["month", "Monate"], ["year", "Jahre"]]
      .map(([u, l]) => `<button class="ft-cu${u === "week" ? " ft-on" : ""}" data-u="${u}">${l}</button>`).join("");

    const ov = document.createElement("div"); ov.className = "ft-ov"; this._ov = ov;
    ov.innerHTML = `<div class="ft-modal">
      <div class="ft-head">Aufgabe bearbeiten</div>
      <input class="ft-name" type="text" value="${this._esc(item.summary || "")}">
      ${tbtns ? `<div class="ft-sub">Wer?</div><div class="ft-row">${tbtns}</div>` : ""}
      <div class="ft-sub">Bis wann?</div>
      <div class="ft-row"><button class="ft-q" data-q="none">Kein Datum</button><button class="ft-q" data-q="today">Heute</button><button class="ft-q" data-q="tom">Morgen</button><button class="ft-q" data-q="week">In 1 Woche</button><div class="ft-datewrap${due ? "" : " ft-dempty"}"><input class="ft-date" type="date" value="${this._esc(due)}"></div></div>
      ${this._repeats.length ? `<div class="ft-sub ft-rsub">Wiederholung</div><div class="ft-row ft-reps">${rbtns}</div>`
        + `<div class="ft-cust" style="display:none"><span class="ft-cust-lbl">alle</span><input class="ft-cust-n" type="number" min="1" max="99" value="2"><div class="ft-cus">${ubtns}</div></div>` : ""}
      <div class="ft-foot"><button class="ft-btn ft-save">Speichern</button><button class="ft-btn ft-cancel">Abbrechen</button><button class="ft-btn ft-del">🗑</button></div>
    </div>${this._editStyles()}`;
    this.appendChild(ov);

    const dateInp = ov.querySelector(".ft-date");
    const cust = ov.querySelector(".ft-cust");
    const custDue = () => {
      const nEl = cust.querySelector(".ft-cust-n");
      const n = Math.min(99, Math.max(1, parseInt(nEl.value, 10) || 1));
      const u = (cust.querySelector(".ft-cu.ft-on") || { dataset: { u: "week" } }).dataset.u;
      return `every! ${n} ${u}${n > 1 ? "s" : ""}`;   // Todoist: Einzahl bei 1
    };
    const custOpen = () => cust && cust.style.display !== "none";
    const syncRep = () => {
      const on = !!(this._repeats.length && this._projectOf(sel));
      ov.querySelectorAll(".ft-rsub, .ft-reps").forEach(x => x.style.display = on ? "" : "none");
      if (!on) { rep = ""; if (cust) cust.style.display = "none"; }
    };
    // Kein Klick aus dem Dialog darf nach außen durchschlagen — sonst deutet
    // eine umschließende nav-card ihn als Navigation und wechselt den Tab.
    ov.addEventListener("click", e => { e.stopPropagation(); if (e.target === ov) this._closeEdit(); });
    ov.querySelectorAll(".ft-tgt").forEach(b => b.addEventListener("click", () => {
      sel = b.dataset.e;
      ov.querySelectorAll(".ft-tgt").forEach(x => x.classList.toggle("ft-on", x === b));
      syncRep();
    }));
    const dateWrap = ov.querySelector(".ft-datewrap");
    // Wie bei der Einkaufskarte: den Datumswähler von Hand aufklappen.
    dateWrap.addEventListener("click", () => {
      try { if (dateInp.showPicker) dateInp.showPicker(); else { dateInp.focus(); dateInp.click(); } }
      catch (e) { dateInp.focus(); }
    });
    const paintDue = quickActive => {
      const has = !!dateInp.value;
      dateWrap.classList.toggle("ft-dempty", !has);
      dateWrap.classList.toggle("ft-dsel", has && !quickActive);
    };
    ov.querySelectorAll(".ft-q").forEach(b => b.addEventListener("click", () => {
      const q = b.dataset.q;
      if (q === "none") { due = ""; dateInp.value = ""; }
      else { const d = new Date(); if (q === "tom") d.setDate(d.getDate() + 1); if (q === "week") d.setDate(d.getDate() + 7); due = this._iso(d); dateInp.value = due; }
      ov.querySelectorAll(".ft-q").forEach(x => x.classList.toggle("ft-on", x === b));
      paintDue(true);
    }));
    dateInp.addEventListener("change", () => { due = dateInp.value; ov.querySelectorAll(".ft-q").forEach(x => x.classList.remove("ft-on")); paintDue(false); });
    paintDue(false);
    ov.querySelectorAll(".ft-rep").forEach(b => b.addEventListener("click", () => {
      ov.querySelectorAll(".ft-rep").forEach(x => x.classList.toggle("ft-on", x === b));
      if (b.dataset.r === "__custom" && cust) { cust.style.display = "flex"; rep = custDue(); }
      else { if (cust) cust.style.display = "none"; rep = b.dataset.r; }
    }));
    if (cust) {
      cust.querySelector(".ft-cust-n").addEventListener("input", () => { if (custOpen()) rep = custDue(); });
      cust.querySelectorAll(".ft-cu").forEach(b => b.addEventListener("click", () => {
        cust.querySelectorAll(".ft-cu").forEach(x => x.classList.toggle("ft-on", x === b));
        if (custOpen()) rep = custDue();
      }));
    }
    syncRep();

    ov.querySelector(".ft-cancel").addEventListener("click", () => this._closeEdit());
    ov.querySelector(".ft-del").addEventListener("click", async () => {
      if (!window.confirm(`„${item.summary}" löschen?`)) return;
      this._closeEdit();
      try { await this._hass.callService("todo", "remove_item", { entity_id: src, item: uid }); }
      catch (e) { U.toast(this, "Löschen fehlgeschlagen"); }
    });
    ov.querySelector(".ft-save").addEventListener("click", async e => {
      const btn = e.currentTarget; btn.disabled = true;
      const name = ov.querySelector(".ft-name").value.trim() || item.summary;
      try {
        await this._saveEdit({ uid, src, sel, name, due, rep, old: item });
        this._closeEdit();
      } catch (err) { U.toast(this, "Änderung fehlgeschlagen"); btn.disabled = false; }
    });
  }
  async _saveEdit({ uid, src, sel, name, due, rep, old }) {
    const moved = sel !== src;
    // Serie: nur über die Todoist-Schnittstelle setzbar, HA reicht sie nicht durch
    if (rep && this._projectOf(sel)) {
      const svc = String(this.config.todoist_service || "rest_command.todoist_add_task").split(".");
      await this._hass.callService(svc[0], svc[1], {
        content: name, project_id: this._projectOf(sel),
        due_string: due ? `${rep} starting ${due}` : rep,
      });
      await this._hass.callService("todo", "remove_item", { entity_id: src, item: uid });
      U.toast(this, `„${name}" ist jetzt eine Serie`);
    } else if (moved) {
      const data = { entity_id: sel, item: name };
      if (due) data.due_date = due;
      await this._hass.callService("todo", "add_item", data);
      await this._hass.callService("todo", "remove_item", { entity_id: src, item: uid });
      U.toast(this, `„${name}" verschoben`);
    } else {
      const data = { entity_id: src, item: uid, rename: name };
      if (due) data.due_date = due; else data.due_date = null;
      await this._hass.callService("todo", "update_item", data);
    }
    const refresh = moved || rep ? [src, sel] : [src];
    setTimeout(() => this._hass.callService("homeassistant", "update_entity", { entity_id: refresh }).catch(() => {}), 2500);
  }
  _closeEdit() { if (this._ov && this._ov.parentNode) this._ov.parentNode.removeChild(this._ov); this._ov = null; }
  _editStyles() {
    return `<style>
      .ft-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:22;}
      .ft-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,420px);max-height:84vh;overflow:auto;border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
      .ft-head{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .ft-sub{font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.03em;color:var(--secondary-text-color);margin:14px 0 6px;}
      .ft-row{display:flex;gap:6px;flex-wrap:wrap;}
      .ft-name{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:1rem;margin-top:6px;}
      .ft-datewrap{position:relative;flex:1;min-width:110px;}
      .ft-date{width:100%;height:100%;box-sizing:border-box;padding:9px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.85rem;}
      /* Wie bei der Einkaufskarte: das leere date-Feld bekommt eine Aufschrift,
         damit es in der Reihe nicht als leerer Kasten steht. */
      .ft-datewrap.ft-dempty::after{content:"Datum wählen";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.85rem;pointer-events:none;}
      .ft-datewrap.ft-dsel .ft-date{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .ft-tgt,.ft-q,.ft-rep{flex:1;min-width:78px;border:1px solid var(--divider-color);border-radius:10px;padding:9px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.85rem;}
      .ft-on{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .ft-cust{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
      .ft-cust-lbl{color:var(--secondary-text-color);font-size:.9rem;}
      .ft-cust-n{width:66px;padding:8px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.95rem;}
      .ft-cus{display:flex;gap:5px;flex:1;flex-wrap:wrap;}
      .ft-cu{flex:1;min-width:64px;border:1px solid var(--divider-color);border-radius:10px;padding:8px 6px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.82rem;}
      .ft-foot{display:flex;gap:8px;margin-top:16px;}
      .ft-btn{flex:1;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;}
      .ft-save{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);}
      .ft-cancel{background:var(--secondary-background-color);color:var(--primary-text-color);}
      .ft-del{flex:none;background:rgba(229,57,53,.15);color:#e53935;}
    </style>`;
  }

  _optimistic(summary) {
    const list = this._list();
    if (!list) return;
    const node = document.createElement("ha-check-list-item");
    node.setAttribute("left", "");
    node.className = "editRow";
    node.style.opacity = "0.5";
    const col = document.createElement("div"); col.className = "column";
    const span = document.createElement("span"); span.className = "summary"; span.textContent = summary;
    col.appendChild(span); node.appendChild(col);
    list.insertBefore(node, list.firstChild);
    this._pending.push({ key: summary.toLowerCase(), node: node, t: Date.now() });
    if (!this._poll) this._poll = setInterval(() => this._reconcile(), 400);
  }
  _reconcile() {
    const items = (this._child && this._child._items) || [];
    const active = items.filter(i => i && i.status !== "completed");
    this._pending = this._pending.filter(p => {
      const found = active.some(i => (i.summary || "").toLowerCase() === p.key);
      const old = Date.now() - p.t > 12000;
      if (found || old) { if (p.node && p.node.parentNode) p.node.parentNode.removeChild(p.node); return false; }
      return true;
    });
    if (!this._pending.length && this._poll) { clearInterval(this._poll); this._poll = null; }
  }
  getCardSize() { return (this._child && this._child.getCardSize) ? this._child.getCardSize() : 3; }
}
if (!customElements.get("fp-todo-card")) {
  customElements.define("fp-todo-card", FpTodoCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-todo-card", name: "FP Todo Card", description: "Wraps native todo-list with optimistic instant add" });
}
})();

/* ===== fp-glance-card v6 (fuellt die Rasterzelle aus, forecast_rows statt forecast_days (clock-weather-card v2), hide_today_section fuer flaches Banner; Wetter-Klick via transparentes Overlay = Touch+Maus zuverlaessig; Pro-Element-Navigation Datum/Termin->Kalender, Essen->Essensplan, Wetter->Wetter-Tab; Wetter via eingebettete clock-weather-card; Tageszeit-Hintergrund via sun.sun) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class FpGlanceCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      name: "Familie",
      weather_entity: "weather.home",
      sun_entity: "sun.sun",
      show_weather: true,
      weather_card: null,                   // eigene clock-weather-card-Config (optional); sonst Default unten
      shadow: "",                           // eigener Schlagschatten, z. B. "0 4px 14px rgba(0,0,0,.16)" oder "none"
      forecast_rows: 4,                     // Anzahl Prognosezeilen (hiess in clock-weather-card v1 noch forecast_days)
      hide_today_section: false,            // grossen Uhr-/Icon-Block ausblenden -> flaches Banner
      persons: [],                          // wie family-calendar-card: {name,color,calendar,prefix,match}
      essensplan_entity: "calendar.essensplan",
      dinner: { start: 15, end: 24 },       // Stunden-Fenster fuers Abendessen
      backgrounds: {},                      // {morning,day,evening,night} Bild-URLs (optional)
      background: "",                       // Fallback-Bild/CSS fuer alle Tageszeiten (optional)
      calendar_path: "",                    // Klick auf Datum + naechsten Termin -> Kalender
      meals_path: "",                       // Klick auf Abendessen -> Essensplan
      weather_path: "",                     // Klick aufs Wetter -> Wetter-Tab
      nav_path: "",                         // (veraltet) Fallback fuer calendar_path
    }, config || {});
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
    this._built = false; this._wc = null; this._curBg = ""; this._curLight = null;
    // Eingebettete Wetterkarte (transparent aufs Banner geblendet); volle Config ueberschreibbar via weather_card
    if (this.config.show_weather) {
      // Kopie: eine aus der Dashboard-Konfiguration gereichte weather_card ist eingefroren
      const base = Object.assign({}, this.config.weather_card || {
        type: "custom:clock-weather-card",
        entity: this.config.weather_entity,
        sun_entity: this.config.sun_entity,
        locale: "de-DE", time_format: "24",
        hide_today_section: !!this.config.hide_today_section, hide_forecast_section: false,
        forecast_rows: this.config.forecast_rows,
      });
      if (!base.card_mod) base.card_mod = { style: "ha-card{background:transparent!important;box-shadow:none!important;border:none!important;} :host{--primary-text-color:#fff;--secondary-text-color:rgba(255,255,255,.9);} img{filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));} svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}" };
      this._wcConfig = base;
    }
  }
  set hass(hass) {
    this._hass = hass;
    if (this._wc) this._wc.hass = hass;
    if (!this._built) this._build(); else this._paint();
    this._maybeFetch();
  }
  connectedCallback() { if (!this._clock) this._clock = setInterval(() => { this._maybeFetch(); this._paint(); }, 60000); }
  disconnectedCallback() { if (this._clock) { clearInterval(this._clock); this._clock = null; } }

  _esc(s) { return U.esc(s); }
  _pad(n) { return U.pad(n); }
  _toast(msg) { U.toast(this, msg); }
  _nav(path) { history.pushState(null, "", path); window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true })); }

  _entities() {
    const s = new Set();
    (this.config.persons || []).forEach(p => { if (p.calendar) s.add(p.calendar); });
    if (this.config.essensplan_entity) s.add(this.config.essensplan_entity);
    return [...s];
  }
  _range() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }
  async _maybeFetch(force) {
    if (!this._hass) return;
    const { start, end } = this._range();
    const ents = this._entities();
    const key = ents.join(",") + "|" + start.toISOString();
    const now = Date.now();
    if (!force && key === this._rangeKey && now - this._lastFetch < 60000) return;
    this._rangeKey = key; this._lastFetch = now;
    const all = [], failed = [];
    await Promise.all(ents.map(async ent => {
      try {
        const s = encodeURIComponent(start.toISOString()), e = encodeURIComponent(end.toISOString());
        const evts = await this._hass.callApi("GET", `calendars/${ent}?start=${s}&end=${e}`);
        (evts || []).forEach(ev => { ev._entity = ent; all.push(ev); });
      } catch (err) { failed.push(ent); }
    }));
    if (failed.length && this._loadedOnce) this._toast("Übersicht: Kalender nicht erreichbar: " + failed.join(", "));
    this._loadedOnce = true; // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._events = all;
    this._paint();
  }

  _matchPrefix(title, prefix) { const re = new RegExp("^" + U.reEsc(prefix) + "[ :._-]"); return re.test(title); }
  _stripPrefix(title, prefix) { return title.replace(new RegExp("^" + U.reEsc(prefix) + "[ :._-]\\s*"), ""); }
  _classify(ev) {
    const title = ev.summary || ev.message || "";
    const group = (this.config.persons || []).filter(p => p.calendar === ev._entity);
    if (!group.length) return { person: null, display: title };
    const prefixed = group.filter(p => p.prefix);
    for (const p of prefixed) { if (this._matchPrefix(title, p.prefix)) return { person: p, display: this._stripPrefix(title, p.prefix) }; }
    const none = group.find(p => p.match === "none") || group.find(p => !p.prefix);
    if (none) return { person: none, display: title };
    return { person: group[0], display: title };
  }
  _parse(ev) {
    const s = ev.start || {}, e = ev.end || {};
    const allDay = !!(s.date && !s.dateTime);
    let start, end;
    if (allDay) {
      const a = String(s.date).split("-"); start = new Date(+a[0], +a[1] - 1, +a[2]);
      const b = String(e.date || s.date).split("-"); end = new Date(+b[0], +b[1] - 1, +b[2]);
    } else { start = new Date(s.dateTime || s.date); end = new Date(e.dateTime || e.date || s.dateTime || s.date); }
    return { allDay, start, end };
  }
  _nextAppt() {
    const now = new Date();
    const persEnts = new Set((this.config.persons || []).map(p => p.calendar));
    const cands = [];
    (this._events || []).forEach(ev => {
      if (!persEnts.has(ev._entity)) return;
      const t = this._parse(ev);
      if (t.end <= now && !t.allDay) return;
      const cl = this._classify(ev);
      cands.push({ display: cl.display, person: cl.person, allDay: t.allDay, start: t.start });
    });
    cands.sort((a, b) => (a.allDay === b.allDay) ? a.start - b.start : (a.allDay ? 1 : -1));
    return cands[0] || null;
  }
  _dinner() {
    const ent = this.config.essensplan_entity;
    const d = this.config.dinner || { start: 15, end: 24 };
    let pick = null;
    (this._events || []).forEach(ev => {
      if (ev._entity !== ent) return;
      const t = this._parse(ev);
      const h = t.allDay ? 12 : t.start.getHours();
      if (h >= d.start && h < d.end) { if (!pick || t.start < pick.start) pick = { summary: ev.summary || ev.message || "", start: t.start }; }
    });
    return pick;
  }

  _daypart() { const h = new Date().getHours(); if (h >= 5 && h < 11) return "morning"; if (h >= 11 && h < 17) return "day"; if (h >= 17 && h < 22) return "evening"; return "night"; }
  _greet() { const p = this._daypart(); return p === "morning" ? "Guten Morgen" : p === "evening" ? "Guten Abend" : p === "night" ? "Gute Nacht" : "Hallo"; }
  _defaultBg(part) { return part === "morning" ? "linear-gradient(135deg,#5b9bd5,#89c4f4)" : part === "day" ? "linear-gradient(135deg,#2f80c4,#5aa9e6)" : part === "evening" ? "linear-gradient(135deg,#3a5a8c,#7b6ca8)" : "linear-gradient(135deg,#1b2a4a,#33415e)"; }
  _bg() {
    const part = this._daypart();
    const bgs = this.config.backgrounds || {};
    const bRaw = bgs[part] || this.config.background || "";
    const isImg = bRaw && (/^(https?:|\/|data:)/.test(bRaw) || /\.(jpe?g|png|webp|gif|avif)/i.test(bRaw));
    if (isImg) return { style: `background-image:linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.58)),url('${bRaw}');background-size:cover;background-position:center;`, light: true };
    if (bRaw) return { style: `background:${bRaw};`, light: false };
    return { style: `background:${this._defaultBg(part)};`, light: true };
  }

  async _build() {
    this._built = true;
    this.innerHTML = `
      <style>
        /* Radius, Rand und Schatten aus denselben Theme-Variablen wie eine ha-card —
           die Karte zeichnet ihr eigenes div und wuerde sonst flach danebenstehen. */
        .fpg-card{position:relative;overflow:hidden;padding:16px 18px;box-sizing:border-box;height:100%;
          border-radius:var(--ha-card-border-radius,12px);
          /* box-shadow wird auf diesem div nicht gerendert (in HA nachgemessen),
             drop-shadow schon. Wert fest statt var(--ha-card-box-shadow):
             dort steht je nach Theme "none", und drop-shadow(none) macht die
             ganze Filter-Regel ungueltig — dann faellt auch der Rueckfallwert weg.
             Ueber die Karten-Option "shadow" ueberschreibbar. */
          filter:drop-shadow(var(--fpg-shadow,0 4px 14px rgba(0,0,0,.16)));
          border-width:var(--ha-card-border-width,0);border-style:solid;
          border-color:var(--ha-card-border-color,var(--divider-color));}
        .fpg-light{color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.55);}
        .fpg-dark{color:var(--primary-text-color);}
        .fpg-clk{cursor:pointer;}
        .fpg-date.fpg-clk:hover,.fpg-chip.fpg-clk:hover{text-decoration:underline;}
        .fpg-wc.fpg-clk{cursor:pointer;}
        .fpg-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;}
        .fpg-date{font-size:.82rem;opacity:.88;}
        .fpg-hi{font-size:1.3rem;font-weight:700;margin-top:2px;}
        .fpg-info{display:flex;gap:16px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.28);font-size:.9rem;}
        .fpg-dark .fpg-info{border-top-color:var(--divider-color);}
        .fpg-chip{display:inline-flex;align-items:center;gap:6px;}
        .fpg-dot{width:9px;height:9px;border-radius:50%;display:inline-block;}
        .fpg-muted{opacity:.72;}
        .fpg-wc{margin-top:8px;position:relative;}
        .fpg-wc-ov{position:absolute;inset:0;z-index:2;cursor:pointer;}
        .fpg-wc-hidden{display:none;}
      </style>
      <div class="fpg-card">
        <div class="fpg-top">
          <div class="fpg-greet"><div class="fpg-date"></div><div class="fpg-hi"></div></div>
        </div>
        <div class="fpg-info"></div>
        <div class="fpg-wc"></div>
      </div>`;
    if (U.fill) U.fill(this); // defensiv: fehlender Helfer darf die Karte nie killen
    if (this.config.shadow) this.style.setProperty("--fpg-shadow", this.config.shadow);
    this._elCard = this.querySelector(".fpg-card");
    this._elDate = this.querySelector(".fpg-date");
    this._elGreet = this.querySelector(".fpg-hi");
    this._elInfo = this.querySelector(".fpg-info");
    this._elWc = this.querySelector(".fpg-wc");
    // Pro-Element-Navigation: Datum + Termin -> Kalender, Essen -> Essensplan, Wetter -> Wetter-Tab
    const calPath = this.config.calendar_path || this.config.nav_path || "";
    if (calPath) { this._elDate.classList.add("fpg-clk"); this._elDate.addEventListener("click", () => this._nav(calPath)); }
    this._elInfo.addEventListener("click", e => {
      const p = e.composedPath ? e.composedPath() : [];
      for (const n of p) { if (n === this._elInfo) break; if (n.dataset && n.dataset.nav) { this._nav(n.dataset.nav); return; } }
    });
    if (this.config.weather_path) this._elWc.classList.add("fpg-clk");
    if (this.config.show_weather && this._wcConfig) {
      try {
        const helpers = await window.loadCardHelpers();
        const el = helpers.createCardElement(this._wcConfig);
        if (this._hass) el.hass = this._hass;
        this._wc = el; this._elWc.appendChild(el);
        // Transparentes Overlay ueber der Wetterkarte: faengt Taps ab (Touch + Maus) und navigiert,
        // ohne dass die eingebettete Karte das More-Info-Popup oeffnet.
        if (this.config.weather_path) {
          const ov = document.createElement("div");
          ov.className = "fpg-wc-ov";
          ov.addEventListener("click", () => this._nav(this.config.weather_path));
          this._elWc.appendChild(ov);
        }
      } catch (e) { this._elWc.classList.add("fpg-wc-hidden"); if (this._loadedOnce) this._toast("Wetterkarte konnte nicht geladen werden"); }
    } else { this._elWc.classList.add("fpg-wc-hidden"); }
    this._paint();
  }

  _paint() {
    if (!this._hass || !this._built || !this._elCard) return;
    const bg = this._bg();
    if (bg.style !== this._curBg) { this._elCard.setAttribute("style", bg.style); this._curBg = bg.style; }
    if (bg.light !== this._curLight) {
      this._elCard.classList.toggle("fpg-light", bg.light);
      this._elCard.classList.toggle("fpg-dark", !bg.light);
      this._curLight = bg.light;
    }
    const now = new Date();
    this._elDate.textContent = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    this._elGreet.textContent = this._greet() + (this.config.name ? ", " + this.config.name : "") + "!";
    const calPath = this.config.calendar_path || this.config.nav_path || "";
    const mealsPath = this.config.meals_path || "";
    const clkCal = calPath ? " fpg-clk" : "", clkMeal = mealsPath ? " fpg-clk" : "";
    const chips = [];
    const appt = this._nextAppt();
    if (appt) {
      const time = appt.allDay ? "ganztägig" : `${this._pad(appt.start.getHours())}:${this._pad(appt.start.getMinutes())}`;
      const dot = appt.person && appt.person.color ? `<span class="fpg-dot" style="background:${appt.person.color}"></span>` : "";
      chips.push(`<span class="fpg-chip${clkCal}" data-nav="${this._esc(calPath)}">${dot}${CP(0x1F4C5)} ${this._esc(time)} · ${this._esc(appt.display)}</span>`);
    } else {
      chips.push(`<span class="fpg-chip fpg-muted${clkCal}" data-nav="${this._esc(calPath)}">${CP(0x1F4C5)} Keine Termine mehr heute</span>`);
    }
    const din = this._dinner();
    chips.push(`<span class="fpg-chip${clkMeal}" data-nav="${this._esc(mealsPath)}">${CP(0x1F37D)} Abends: ${din ? this._esc(din.summary) : "<span class=\"fpg-muted\">noch offen</span>"}</span>`);
    this._elInfo.innerHTML = chips.join("");
  }

  getCardSize() { return (this._wc && this._wc.getCardSize) ? (this._wc.getCardSize() + 2) : 4; }
}
if (!customElements.get("fp-glance-card")) {
  customElements.define("fp-glance-card", FpGlanceCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-glance-card", name: "FP Glance Card", description: "Today at a glance: greeting + next event + dinner, with embedded animated clock-weather-card" });
}
})();

/* ===== fp-cookbook-card v18 (Import per Link: Rezeptseiten und Videos, Naehrwerte je Portion, Filter „proteinreich" aus dem Eiweisswert, Farben ueber Theme-Variablen, Kochbuch; Rezepte bearbeiten: Name, Mahlzeit, Tags, Portionen, Zeiten, Naehrwerte, Zutaten, Schritte) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class FpCookbookCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Kochbuch",
      entity: "todo.kochbuch",              // Ablage (Local To-do)
      essensplan_entity: "calendar.essensplan",
      shopping_entity: "todo.zuhause",
      ai_entity: "ai_task.google_ai_task",
      weather_entity: "weather.home",
      base_portions: 2,
      quick_max_min: 20,            // bis hierher gilt ein Gericht als „schnell"
      import_service: "",           // z. B. rest_command.kochbuch_import — blendet das Link-Feld ein
      protein_min_g: 25,            // ab hier gilt eine Portion als „proteinreich"
      style: "viel vegetarisch, bunt gemischt, proteinreich, schnell zu kochen",
      meals: [
        { label: "Frühstück", at: 8 },
        { label: "Mittag", at: 12 },
        { label: "Abend", at: 18 },
      ],
    }, config || {});
    this._dishes = null; this._sig = ""; this._built = false;
    this._search = ""; this._filter = "Alle"; this._ov = null; this._recentSuggestions = [];
  }
  set hass(hass) {
    this._hass = hass;
    const st = hass.states[this.config.entity];
    const sig = st ? st.state + "|" + st.last_updated : "none";
    if (sig !== this._sig) { this._sig = sig; this._fetch(); }
    if (!this._built) this._render();
  }

  _esc(s) { return U.esc(s); }
  _toast(m) { U.toast(this, m); }
  _pad(n) { return U.pad(n); }

  async _fetch() {
    if (!this._hass) return;
    try {
      const r = await this._hass.callService("todo", "get_items", { entity_id: this.config.entity }, undefined, false, true);
      const items = (r && r.response && r.response[this.config.entity] && r.response[this.config.entity].items) || [];
      this._dishes = items.map(it => {
        let meta = {};
        try { meta = JSON.parse(it.description || "{}"); } catch (e) { meta = { note: it.description || "" }; }
        return Object.assign({ name: it.summary, uid: it.uid, category: "egal", tags: [], portions_base: this.config.base_portions, ingredients: [], steps: [], rating: 0, times_cooked: 0, last_cooked: null }, meta, { name: it.summary, uid: it.uid });
      });
    } catch (e) { this._dishes = []; if (this._loadedOnce) this._toast("Kochbuch konnte nicht geladen werden"); }
    this._loadedOnce = true;
    this._render();
    this._maybeOpenFromHash();
  }

  // ---------- Persistenz ----------
  _dishJson(d) {
    const { name, uid, ...meta } = d; // name/uid landen in summary; Rest als JSON
    return JSON.stringify(meta);
  }
  async _save(d, existingUid) {
    const data = { entity_id: this.config.entity, item: existingUid || d.name };
    try {
      if (existingUid) {
        await this._hass.callService("todo", "update_item", { entity_id: this.config.entity, item: existingUid, rename: d.name, description: this._dishJson(d) });
      } else {
        await this._hass.callService("todo", "add_item", { entity_id: this.config.entity, item: d.name, description: this._dishJson(d) });
      }
      await this._fetch();
      return true;
    } catch (e) { this._toast("Speichern fehlgeschlagen"); return false; }
  }
  async _delete(d) {
    try { await this._hass.callService("todo", "remove_item", { entity_id: this.config.entity, item: d.uid || d.name }); await this._fetch(); }
    catch (e) { this._toast("Löschen fehlgeschlagen"); }
  }

  // ---------- KI ----------
  _season() { const m = new Date().getMonth() + 1; if (m === 12 || m <= 2) return "Winter"; if (m <= 5) return "Frühling"; if (m <= 8) return "Sommer"; return "Herbst"; }
  async _generate(name, freeText, opts) {
    opts = opts || {};
    const bp = this.config.base_portions;
    let head;
    if (opts.suggest) {
      const season = this._season();
      const w = this._hass.states[this.config.weather_entity];
      const cond = w ? w.state : "";
      const temp = w && w.attributes && w.attributes.temperature != null ? w.attributes.temperature : "";
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const cuisine = pick(["österreichisch/deutsch", "italienisch", "asiatisch (Wok/Curry)", "indisch", "orientalisch/levantinisch", "mexikanisch", "griechisch/mediterran", "spanisch", "französisch", "Balkan/ungarisch"]);
      const base = pick(["mit Hülsenfrüchten (Linsen/Kichererbsen/Bohnen)", "als Ofengericht", "als Pfannengericht", "als Eintopf oder Suppe", "mit Reis oder Getreide (Bulgur/Couscous)", "als Auflauf/Gratin", "als Bowl/großer Salat", "mit Nudeln/Teigwaren", "mit Kartoffeln/Erdäpfeln", "mit Tofu, Ei oder Käse"]);
      const avoidNames = Array.from(new Set([].concat((this._dishes || []).map(x => x.name), this._recentSuggestions || []).filter(Boolean))).slice(0, 60).join(", ");
      const hint = (opts.hint || "").trim();
      head = `Schlage EIGENSTAENDIG genau EIN konkretes, alltagstaugliches Familiengericht vor (entscheide selbst, keine Rueckfrage). `
        + (hint ? `Beziehe unbedingt diesen Wunsch des Nutzers ein (Zutat/Idee/Richtung): "${hint}". Kueche und Grundform frei waehlen, solange es zum Wunsch passt. ` : `Kueche diesmal zwingend: ${cuisine}. Grundform diesmal zwingend: ${base}. `)
        + `Beruecksichtige Jahreszeit (${season})${cond ? ` und Wetter (${cond}${temp !== "" ? `, ${temp} Grad` : ""})` : ""}. `
        + (avoidNames ? `Vermeide diese bereits vorgeschlagenen/vorhandenen Gerichte UND alles klar Aehnliche: ${avoidNames}. ` : "")
        + `Auf keinen Fall Erdaepfelgulasch. Zufalls-Seed: ${Math.random().toString(36).slice(2, 8)}. `;
    } else {
      head = `Erzeuge ein bewaehrtes, alltagstaugliches Familienrezept${name ? ` fuer "${name}"` : ""}. `
        + (freeText ? `Nutze als Grundlage diesen Text/dieses Rezept: """${freeText}""". ` : "");
    }
    const named = !opts.suggest && !!(name && name.trim());
    const styleLine = named
      ? `Halte dich ans klassische, typische Rezept fuer "${name}" und erfinde KEINE zusaetzlichen Hauptzutaten (z. B. keine Huelsenfruechte, kein Fleisch nur wegen Protein), die nicht ueblich dazugehoeren. Der Stil (${this.config.style}) ist nur eine leichte Tendenz und darf das Gericht nicht verfaelschen. `
      : `Stil/Praeferenz: ${this.config.style} ("bunt gemischt" meint Abwechslung ueber die Zeit, NICHT als Tag). Orientiere dich an sehr gut bewerteten, klassischen Rezepten. `;
    const prompt = head
      + styleLine
      + `Tags NUR aus dieser Liste (2-4 passende): vegetarisch, vegan, fleisch, fisch, proteinreich, kinderliebling, saisonal. Vergib KEIN Tag "schnell" und NIEMALS "bunt" — die Schnelligkeit wird aus der Zeit berechnet. `
      + `Sprache: oesterreichisches Deutsch (Erdaepfel, Paradeiser, Topfen, Obers ...). Mengen fuer ${bp} Portionen. `
      + `Schaetze zusaetzlich die Zeit in Minuten, ehrlich und realistisch: "active_min" = reine Arbeitszeit am Herd/Brett, `
      + `"total_min" = Gesamtdauer von Anfang bis servierfertig INKLUSIVE Koch-, Back-, Zieh-, Marinier-, Aufgeh- und Auskuehlzeit. `
      + `Beispiele: Erdaepfelsalat braucht Kochen plus Auskuehlen (total_min etwa 45), Nudeln mit Pesto etwa 20, ein Schmorgericht 120 oder mehr. `
      + `Schaetze ausserdem die Naehrwerte PRO PORTION, ausgehend von ${bp} Portionen: "kcal" = Kalorien je Portion, `
      + `"protein_g" = Eiweiss je Portion in Gramm. Rechne beides aus den Zutatenmengen und teile durch die Portionszahl, `
      + `runde auf ganze Zahlen und gib keine Bandbreiten an. `
      + `Antworte NUR mit GUELTIGEM JSON (kein Markdown, keine Erklaerung), exakt in dieser Form:`
      + `{"name":"Gerichtname","category":"Frühstück|Mittag|Abend","tags":["vegetarisch","proteinreich"],"portions_base":${bp},"active_min":20,"total_min":45,"kcal":520,"protein_g":28,"ingredients":[{"qty":250,"unit":"g","item":"Zutat"}],"steps":["Schritt 1","Schritt 2"],"season":["ganzjährig"]}`;
    const data = { task_name: "Kochbuch-Rezept", instructions: prompt };
    if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
    const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
    let txt = r && r.response && r.response.data;
    if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
    const m = String(txt || "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("KI-Antwort ohne JSON");
    const d = JSON.parse(m[0]);
    d.portions_base = d.portions_base || bp;
    d.active_min = Number(d.active_min) || 0;
    d.total_min = Number(d.total_min) || d.active_min;
    d.kcal = Math.round(Number(d.kcal) || 0);
    d.protein_g = Math.round(Number(d.protein_g) || 0);
    d.tags = (d.tags || []).filter(t => U.norm(t) !== "schnell"); // wird aus total_min abgeleitet
    d.rating = 0; d.times_cooked = 0; d.last_cooked = null;
    if (name && !d.name) d.name = name;
    if (opts.suggest && d.name) { this._recentSuggestions = [d.name].concat(this._recentSuggestions || []).slice(0, 20); }
    return d;
  }

  // Zeiten für Rezepte ohne Zeitangabe nachtragen (einmaliger Lauf über den Altbestand)
  async _estimateTime(d) {
    const prompt = `Wie lange dauert die Zubereitung von "${d.name}"?`
      + ((d.ingredients || []).length ? ` Zutaten: ${(d.ingredients || []).map(i => `${i.qty || ""} ${i.unit || ""} ${i.item || ""}`.trim()).join(", ")}.` : "")
      + ((d.steps || []).length ? ` Schritte: ${(d.steps || []).join(" | ")}.` : "")
      + ` Schaetze ehrlich und realistisch: "active_min" = reine Arbeitszeit, "total_min" = Gesamtdauer bis servierfertig`
      + ` INKLUSIVE Koch-, Back-, Zieh-, Marinier-, Aufgeh- und Auskuehlzeit.`
      + ` Antworte NUR mit JSON: {"active_min":20,"total_min":45}`;
    const data = { task_name: "Zubereitungszeit", instructions: prompt };
    if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
    const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
    let txt = r && r.response && r.response.data;
    if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
    const m = String(txt || "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("keine Zeit erkannt");
    const j = JSON.parse(m[0]);
    const total = Number(j.total_min) || 0;
    if (!total) throw new Error("keine Zeit erkannt");
    return { active_min: Number(j.active_min) || 0, total_min: total };
  }
  async _fillTimes(btn) {
    const missing = (this._dishes || []).filter(d => !Number(d.total_min));
    if (!missing.length) { this._toast("Alle Rezepte haben schon eine Zeit"); return; }
    const prev = btn.innerHTML; btn.disabled = true;
    let ok = 0, fail = 0;
    for (let i = 0; i < missing.length; i++) {
      const d = missing[i];
      btn.innerHTML = `${CP(0x23F1)} ${i + 1}/${missing.length} …`;
      try {
        const t = await this._estimateTime(d);
        d.active_min = t.active_min; d.total_min = t.total_min;
        d.tags = (d.tags || []).filter(x => U.norm(x) !== "schnell");
        await this._hass.callService("todo", "update_item", { entity_id: this.config.entity, item: d.uid, rename: d.name, description: this._dishJson(d) });
        ok++;
      } catch (e) { fail++; }
    }
    btn.disabled = false; btn.innerHTML = prev;
    await this._fetch();
    this._toast(`Zeiten ergänzt: ${ok}${fail ? `, ${fail} fehlgeschlagen` : ""}`);
  }

  // Rezeptseiten liefern oft Kalorien, aber kein Eiweiß — beides zählt als Lücke.
  _nutriMissing(d) { return !Number(d.kcal) || !Number(d.protein_g); }
  // Nährwerte je Portion für Rezepte ohne Angabe nachtragen (Altbestand)
  async _estimateNutrition(d) {
    const bp = Number(d.portions_base) || this.config.base_portions;
    const prompt = `Wie viele Kalorien und wie viel Eiweiss hat EINE Portion von "${d.name}"?`
      + ` Das Rezept ergibt ${bp} Portionen.`
      + ((d.ingredients || []).length ? ` Zutaten fuer ${bp} Portionen: ${(d.ingredients || []).map(i => `${i.qty || ""} ${i.unit || ""} ${i.item || ""}`.trim()).join(", ")}.` : "")
      + ((d.steps || []).length ? ` Schritte: ${(d.steps || []).join(" | ")}.` : "")
      + ` Rechne aus den Zutatenmengen und teile durch die Portionszahl. Ganze Zahlen, keine Bandbreiten.`
      + ` Antworte NUR mit JSON: {"kcal":520,"protein_g":28}`;
    const data = { task_name: "Nährwerte", instructions: prompt };
    if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
    const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
    let txt = r && r.response && r.response.data;
    if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
    const m = String(txt || "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("keine Nährwerte erkannt");
    const j = JSON.parse(m[0]);
    const kcal = Math.round(Number(j.kcal) || 0);
    if (!kcal) throw new Error("keine Nährwerte erkannt");
    return { kcal, protein_g: Math.round(Number(j.protein_g) || 0) };
  }
  async _fillNutrition(btn) {
    const missing = (this._dishes || []).filter(d => this._nutriMissing(d));
    if (!missing.length) { this._toast("Alle Rezepte haben schon Nährwerte"); return; }
    const prev = btn.innerHTML; btn.disabled = true;
    let ok = 0, fail = 0;
    for (let i = 0; i < missing.length; i++) {
      const d = missing[i];
      btn.innerHTML = `${CP(0x1F525)} ${i + 1}/${missing.length} …`;
      try {
        const n = await this._estimateNutrition(d);
        // Importierte Werte sind gemessen, geschätzte nur geraten — nur Lücken füllen.
        d.kcal = Number(d.kcal) || n.kcal;
        d.protein_g = Number(d.protein_g) || n.protein_g;
        await this._hass.callService("todo", "update_item", { entity_id: this.config.entity, item: d.uid, rename: d.name, description: this._dishJson(d) });
        ok++;
      } catch (e) { fail++; }
    }
    btn.disabled = false; btn.innerHTML = prev;
    await this._fetch();
    this._toast(`Nährwerte ergänzt: ${ok}${fail ? `, ${fail} fehlgeschlagen` : ""}`);
  }

  // ---------- Aktionen ----------
  _mealHour(label) { const m = (this.config.meals || []).find(x => x.label === label); return m ? m.at : 18; }
  _fmtDT(dt) { return `${dt.getFullYear()}-${this._pad(dt.getMonth() + 1)}-${this._pad(dt.getDate())} ${this._pad(dt.getHours())}:${this._pad(dt.getMinutes())}:00`; }
  async _addToPlan(d, date, mealLabel) {
    const sd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), this._mealHour(mealLabel), 0);
    const ed = new Date(sd.getTime() + 3600000);
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this.config.essensplan_entity, summary: d.name, start_date_time: this._fmtDT(sd), end_date_time: this._fmtDT(ed) });
      d.last_cooked = new Date().toISOString().slice(0, 10); d.times_cooked = (d.times_cooked || 0) + 1;
      await this._save(d, d.uid);
      this._toast(`„${d.name}" für ${mealLabel} eingeplant`);
      return true;
    } catch (e) { this._toast("Konnte nicht in den Essensplan legen"); return false; }
  }
  _scale(q, factor) { const v = (Number(q) || 0) * factor; if (v >= 10) return Math.round(v); if (v >= 1) return Math.round(v * 2) / 2; return Math.round(v * 10) / 10; }
  _ingLine(i, factor) { return `${this._scale(i.qty, factor) || ""} ${i.unit || ""} ${i.item || ""}`.trim(); }
  _openShopping(d, portions) {
    const factor = portions / (d.portions_base || this.config.base_portions);
    const ings = d.ingredients || [];
    if (!ings.length) { this._toast("Keine Zutaten hinterlegt"); return; }
    const rows = ings.map((i, idx) => `<label class="cb-ck"><input type="checkbox" data-idx="${idx}" checked><span>${this._esc(this._ingLine(i, factor))}</span></label>`).join("");
    const ov = this._overlay(`
      <div class="cb-m-head"><span>Zutaten wählen (${portions} P.)</span><button class="cb-x">${CP(0x2715)}</button></div>
      <div class="cb-ck-tools"><button class="cb-linkbtn cb-ck-all">Alle</button><button class="cb-linkbtn cb-ck-none">Keine</button></div>
      <div class="cb-cklist">${rows}</div>
      <div class="cb-m-foot"><button class="cb-btn cb-ck-add">🛒 Auf die Einkaufsliste</button></div>`);
    const boxes = () => Array.from(ov.querySelectorAll(".cb-cklist input[type=checkbox]"));
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelector(".cb-ck-all").addEventListener("click", () => boxes().forEach(b => b.checked = true));
    ov.querySelector(".cb-ck-none").addEventListener("click", () => boxes().forEach(b => b.checked = false));
    ov.querySelector(".cb-ck-add").addEventListener("click", async e => {
      const chosen = boxes().filter(b => b.checked).map(b => Number(b.dataset.idx));
      if (!chosen.length) { this._toast("Nichts ausgewählt"); return; }
      const btn = e.currentTarget; btn.disabled = true;
      const lines = chosen.map(idx => this._ingLine(ings[idx], factor)).filter(Boolean);
      try { for (const l of lines) await this._hass.callService("todo", "add_item", { entity_id: this.config.shopping_entity, item: l }); this._toast(`${lines.length} Zutaten auf die Einkaufsliste`); this._closeOv(); }
      catch (err) { this._toast("Zutaten konnten nicht hinzugefügt werden"); btn.disabled = false; }
    });
  }

  // ---------- UI ----------
  _closeOv() { if (this._ov && this._ov.parentNode) this._ov.parentNode.removeChild(this._ov); this._ov = null; }
  _stars(n) { let s = ""; for (let i = 1; i <= 5; i++) s += i <= n ? CP(0x2605) : CP(0x2606); return s; }
  _sinceTxt(iso) {
    if (!iso) return "noch nie gekocht";
    const d = new Date(iso), days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "heute gekocht"; if (days === 1) return "gestern gekocht";
    if (days < 14) return `vor ${days} Tagen`; return `vor ${Math.floor(days / 7)} Wochen`;
  }

  // „schnell" wird nicht mehr geraten, sondern aus der geschätzten Gesamtzeit abgeleitet.
  // Rezepte ohne Zeitangabe fallen auf ihr altes Tag zurück, bis sie nachgerechnet sind.
  _isQuick(d) {
    const t = Number(d.total_min) || 0;
    if (t > 0) return t <= (this.config.quick_max_min || 20);
    return (d.tags || []).some(x => U.norm(x) === "schnell");
  }
  // Dasselbe für „proteinreich": lieber der gemessene Wert als das Tag der KI.
  _isProteinRich(d) {
    const p = Number(d.protein_g) || 0;
    if (p > 0) return p >= (this.config.protein_min_g || 25);
    return (d.tags || []).some(x => U.norm(x) === "proteinreich");
  }
  _timeTxt(d) {
    const t = Number(d.total_min) || 0;
    if (!t) return "";
    const a = Number(d.active_min) || 0;
    return a && a < t ? `${t} Min (${a} Min Arbeit)` : `${t} Min`;
  }
  // Nährwerte gelten immer je Portion, unabhängig vom Portionsregler
  _nutriTxt(d) {
    const k = Number(d.kcal) || 0, p = Number(d.protein_g) || 0;
    const parts = [];
    if (k) parts.push(`${k} kcal`);
    if (p) parts.push(`${p} g Eiweiß`);
    return parts.join(" · ");
  }
  // Zeit und Nährwerte in einer Zeile; leere Angaben fallen weg
  _metaRow(d, cls, perPortion) {
    const bits = [];
    const t = this._timeTxt(d); if (t) bits.push(`${CP(0x23F1)} ${this._esc(t)}`);
    const n = this._nutriTxt(d); if (n) bits.push(`${CP(0x1F525)} ${this._esc(n)}${perPortion ? " pro Portion" : ""}`);
    return bits.length ? `<div class="${cls}">${bits.join(" &nbsp;·&nbsp; ")}</div>` : "";
  }
  _filtered() {
    const q = U.norm(this._search);
    return (this._dishes || []).filter(d => {
      if (this._filter === "schnell") { if (!this._isQuick(d)) return false; }
      else if (this._filter === "proteinreich") { if (!this._isProteinRich(d)) return false; }
      else if (this._filter !== "Alle" && d.category !== this._filter && !(d.tags || []).includes(this._filter)) return false;
      if (!q) return true;
      return U.norm(d.name).includes(q) || (d.tags || []).some(t => U.norm(t).includes(q));
    });
  }
  // Aufruf aus dem Essensplan: /…/kochbuch#dish=<uid> öffnet das Rezept direkt
  _maybeOpenFromHash() {
    const m = (location.hash || "").match(/dish=([^&]+)/);
    if (!m) return;
    const key = decodeURIComponent(m[1]);
    const d = (this._dishes || []).find(x => x.uid === key || U.norm(x.name) === U.norm(key));
    if (!d) return;
    history.replaceState(null, "", location.pathname + location.search);
    this._openDetail(d);
  }

  _render() {
    if (!this._hass) return;
    this._built = true;
    const dishes = this._filtered();
    const cats = ["Alle", "Frühstück", "Mittag", "Abend", "vegetarisch", "kinderliebling", "schnell", "proteinreich"];
    const chips = cats.map(c => `<button class="cb-chip${this._filter === c ? " cb-chip-on" : ""}" data-f="${this._esc(c)}">${this._esc(c)}</button>`).join("");
    const nNoTime = (this._dishes || []).filter(d => !Number(d.total_min)).length;
    const timeBar = nNoTime ? `<button class="cb-fixtimes">${CP(0x23F1)} Zubereitungszeit für ${nNoTime} Rezept${nNoTime === 1 ? "" : "e"} nachrechnen</button>` : "";
    const nNoNutri = (this._dishes || []).filter(d => this._nutriMissing(d)).length;
    const nutriBar = nNoNutri ? `<button class="cb-fixnutri">${CP(0x1F525)} Nährwerte für ${nNoNutri} Rezept${nNoNutri === 1 ? "" : "e"} berechnen</button>` : "";
    const cards = dishes.length ? dishes.map(d => `
      <button class="cb-dish" data-uid="${this._esc(d.uid)}">
        <div class="cb-d-name">${this._esc(d.name)}</div>
        <div class="cb-d-meta">${d.category && d.category !== "egal" ? this._esc(d.category) + " · " : ""}${this._esc(this._sinceTxt(d.last_cooked))}</div>
        ${this._metaRow(d, "cb-d-time")}
        <div class="cb-d-tags">${(d.tags || []).slice(0, 3).map(t => `<span class="cb-tag">${this._esc(t)}</span>`).join("")}</div>
        <div class="cb-d-stars">${d.rating ? this._stars(d.rating) : ""}</div>
      </button>`).join("")
      : `<div class="cb-empty">Noch keine Rezepte. Tippe auf „＋ Neu", um eins per KI zu erzeugen.</div>`;

    this.innerHTML = `
      <ha-card class="cb-card">
        <div class="cb-bar">
          <div class="cb-title">${CP(0x1F4D6)} ${this._esc(this.config.title)}</div>
          <button class="cb-add">＋ Neu</button>
        </div>
        ${timeBar}
        ${nutriBar}
        <input class="cb-search" type="text" placeholder="Suchen …" value="${this._esc(this._search)}">
        <div class="cb-chips">${chips}</div>
        <div class="cb-grid">${cards}</div>
      </ha-card>
      ${this._styles()}`;

    this.querySelector(".cb-add").addEventListener("click", () => this._openAdd());
    const ft = this.querySelector(".cb-fixtimes");
    if (ft) ft.addEventListener("click", () => this._fillTimes(ft));
    const fn = this.querySelector(".cb-fixnutri");
    if (fn) fn.addEventListener("click", () => this._fillNutrition(fn));
    const si = this.querySelector(".cb-search");
    si.addEventListener("input", e => { this._search = e.target.value; this._renderGridOnly(); });
    this.querySelectorAll(".cb-chip").forEach(b => b.addEventListener("click", () => { this._filter = b.dataset.f; this._render(); }));
    this.querySelectorAll(".cb-dish").forEach(b => b.addEventListener("click", () => { const d = this._dishes.find(x => x.uid === b.dataset.uid); if (d) this._openDetail(d); }));
  }
  _renderGridOnly() {
    const grid = this.querySelector(".cb-grid"); if (!grid) return;
    const dishes = this._filtered();
    grid.innerHTML = dishes.length ? dishes.map(d => `
      <button class="cb-dish" data-uid="${this._esc(d.uid)}">
        <div class="cb-d-name">${this._esc(d.name)}</div>
        <div class="cb-d-meta">${d.category && d.category !== "egal" ? this._esc(d.category) + " · " : ""}${this._esc(this._sinceTxt(d.last_cooked))}</div>
        ${this._metaRow(d, "cb-d-time")}
        <div class="cb-d-tags">${(d.tags || []).slice(0, 3).map(t => `<span class="cb-tag">${this._esc(t)}</span>`).join("")}</div>
        <div class="cb-d-stars">${d.rating ? this._stars(d.rating) : ""}</div>
      </button>`).join("") : `<div class="cb-empty">Keine Treffer.</div>`;
    grid.querySelectorAll(".cb-dish").forEach(b => b.addEventListener("click", () => { const d = this._dishes.find(x => x.uid === b.dataset.uid); if (d) this._openDetail(d); }));
  }

  _overlay(html) {
    this._closeOv();
    const ov = document.createElement("div"); ov.className = "cb-ov"; ov.innerHTML = `<div class="cb-modal">${html}</div>` + this._styles();
    ov.addEventListener("click", e => { if (e.target === ov) this._closeOv(); });
    this.appendChild(ov); this._ov = ov; return ov;
  }

  _openDetail(d) {
    let portions = d.portions_base || this.config.base_portions;
    const ov = this._overlay(`
      <div class="cb-m-head"><span>${this._esc(d.name)}</span><button class="cb-x">${CP(0x2715)}</button></div>
      <div class="cb-m-tags">${(d.tags || []).map(t => `<span class="cb-tag">${this._esc(t)}</span>`).join("")}</div>
      ${this._metaRow(d, "cb-time", true)}
      <div class="cb-rate" data-r="${d.rating || 0}">Bewertung: <span class="cb-rate-stars"></span></div>
      <div class="cb-port">Portionen: <input class="cb-port-slider" type="range" min="1" max="12" value="${portions}"> <b class="cb-port-val">${portions}</b></div>
      <div class="cb-sub">Zutaten</div><ul class="cb-ing"></ul>
      <div class="cb-sub">Zubereitung</div><ol class="cb-steps">${(d.steps || []).map(s => `<li>${this._esc(s)}</li>`).join("") || "<li>—</li>"}</ol>
      ${d.source_url ? `<div class="cb-src"><a href="${this._esc(d.source_url)}" target="_blank" rel="noopener">↗ Original-Video ansehen</a></div>` : ""}
      <div class="cb-m-foot">
        <button class="cb-btn cb-plan">📅 In Plan legen</button>
        <button class="cb-btn cb-shop">🛒 Zutaten → Einkauf</button>
        <button class="cb-btn cb-edit" title="Bearbeiten">✏️</button>
        <button class="cb-btn cb-del" title="Löschen">🗑</button>
      </div>`);
    const renderIng = () => {
      const factor = portions / (d.portions_base || this.config.base_portions);
      ov.querySelector(".cb-ing").innerHTML = (d.ingredients || []).map(i => `<li>${this._esc(String(this._scale(i.qty, factor) || ""))} ${this._esc(i.unit || "")} ${this._esc(i.item || "")}</li>`).join("") || "<li>—</li>";
      ov.querySelector(".cb-port-val").textContent = portions;
    };
    renderIng();
    const renderStars = () => { ov.querySelector(".cb-rate-stars").innerHTML = [1, 2, 3, 4, 5].map(i => `<span class="cb-star" data-v="${i}">${i <= (d.rating || 0) ? CP(0x2605) : CP(0x2606)}</span>`).join(""); };
    renderStars();
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelector(".cb-port-slider").addEventListener("input", e => { portions = Number(e.target.value); renderIng(); });
    ov.querySelector(".cb-rate-stars").addEventListener("click", e => { const s = e.target.closest(".cb-star"); if (!s) return; d.rating = Number(s.dataset.v); renderStars(); this._save(d, d.uid); });
    ov.querySelector(".cb-edit").addEventListener("click", () => this._openEdit(d));
    ov.querySelector(".cb-plan").addEventListener("click", () => this._openPlan(d));
    ov.querySelector(".cb-shop").addEventListener("click", () => this._openShopping(d, portions));
    ov.querySelector(".cb-del").addEventListener("click", () => { if (window.confirm(`„${d.name}" löschen?`)) { this._closeOv(); this._delete(d); } });
  }

  // Rezept von Hand korrigieren: Name, Kategorie, Tags, Zeit, Zutaten, Schritte
  _openEdit(d) {
    const KNOWN = ["vegetarisch", "vegan", "fleisch", "fisch", "proteinreich", "kinderliebling", "saisonal"];
    // eigene Tags erhalten; „schnell" nicht, das kommt aus der Zeit
    const own = (d.tags || []).filter(t => U.norm(t) !== "schnell" && !KNOWN.some(k => U.norm(k) === U.norm(t)));
    const allTags = KNOWN.concat(own);
    const sel = new Set((d.tags || []).map(t => U.norm(t)));
    const cats = ["egal", "Frühstück", "Mittag", "Abend"];
    const ingRow = (i) => `<div class="cb-e-row">
      <input class="cb-e-in cb-e-q" type="text" inputmode="decimal" placeholder="Menge" value="${this._esc(i && i.qty != null ? String(i.qty) : "")}">
      <input class="cb-e-in cb-e-u" type="text" placeholder="Einheit" value="${this._esc((i && i.unit) || "")}">
      <input class="cb-e-in cb-e-i" type="text" placeholder="Zutat" value="${this._esc((i && i.item) || "")}">
      <button class="cb-e-x" title="Zeile entfernen">✕</button>
    </div>`;

    const ov = this._overlay(`
      <div class="cb-m-head"><span>Rezept bearbeiten</span><button class="cb-x">${CP(0x2715)}</button></div>
      <div class="cb-sub">Name</div>
      <input class="cb-in cb-e-name" type="text" value="${this._esc(d.name || "")}">
      <div class="cb-sub">Mahlzeit</div>
      <div class="cb-e-cats">${cats.map(c => `<button class="cb-chip cb-e-cat${(d.category || "egal") === c ? " cb-chip-on" : ""}" data-c="${this._esc(c)}">${this._esc(c)}</button>`).join("")}</div>
      <div class="cb-sub">Tags</div>
      <div class="cb-e-tags">${allTags.map(t => `<button class="cb-chip cb-e-tag${sel.has(U.norm(t)) ? " cb-chip-on" : ""}" data-t="${this._esc(t)}">${this._esc(t)}</button>`).join("")}</div>
      <div class="cb-e-hint">„schnell" wird automatisch aus der Gesamtzeit abgeleitet (bis ${this.config.quick_max_min || 20} Min). Der Filter „proteinreich" richtet sich nach dem Eiweißwert (ab ${this.config.protein_min_g || 25} g je Portion) und fällt nur ohne Wert auf das Tag zurück.</div>
      <div class="cb-sub">Portionen, Zeit &amp; Nährwerte</div>
      <div class="cb-e-nums">
        <label>Basis-Portionen<input class="cb-e-in cb-e-port" type="number" min="1" max="20" value="${Number(d.portions_base) || this.config.base_portions}"></label>
        <label>Arbeitszeit (Min)<input class="cb-e-in cb-e-act" type="number" min="0" max="600" value="${Number(d.active_min) || ""}"></label>
        <label>Gesamtzeit (Min)<input class="cb-e-in cb-e-tot" type="number" min="0" max="1440" value="${Number(d.total_min) || ""}"></label>
        <label>kcal / Portion<input class="cb-e-in cb-e-kcal" type="number" min="0" max="5000" value="${Number(d.kcal) || ""}"></label>
        <label>Eiweiß (g) / Portion<input class="cb-e-in cb-e-prot" type="number" min="0" max="300" value="${Number(d.protein_g) || ""}"></label>
      </div>
      <div class="cb-sub">Zutaten</div>
      <div class="cb-e-ings">${((d.ingredients || []).length ? d.ingredients : [{}]).map(ingRow).join("")}</div>
      <button class="cb-linkbtn cb-e-add">+ Zutat</button>
      <div class="cb-sub">Zubereitung <span class="cb-e-hint-inline">— ein Schritt pro Zeile</span></div>
      <textarea class="cb-in cb-e-steps">${this._esc((d.steps || []).join("\n"))}</textarea>
      <div class="cb-m-foot">
        <button class="cb-btn cb-e-save">✔ Speichern</button>
        <button class="cb-btn cb-e-cancel">Abbrechen</button>
      </div>`);

    let category = d.category || "egal";
    const tags = new Set((d.tags || []).filter(t => U.norm(t) !== "schnell"));

    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelector(".cb-e-cancel").addEventListener("click", () => this._openDetail(d));
    ov.querySelectorAll(".cb-e-cat").forEach(b => b.addEventListener("click", () => {
      category = b.dataset.c;
      ov.querySelectorAll(".cb-e-cat").forEach(x => x.classList.toggle("cb-chip-on", x.dataset.c === category));
    }));
    ov.querySelectorAll(".cb-e-tag").forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.t;
      const hit = Array.from(tags).find(x => U.norm(x) === U.norm(t));
      if (hit) tags.delete(hit); else tags.add(t);
      b.classList.toggle("cb-chip-on", !hit);
    }));
    const wireDel = () => ov.querySelectorAll(".cb-e-x").forEach(b => {
      b.onclick = () => { const rows = ov.querySelectorAll(".cb-e-row"); if (rows.length > 1) b.closest(".cb-e-row").remove(); else b.closest(".cb-e-row").querySelectorAll("input").forEach(i => i.value = ""); };
    });
    wireDel();
    ov.querySelector(".cb-e-add").addEventListener("click", () => {
      ov.querySelector(".cb-e-ings").insertAdjacentHTML("beforeend", ingRow({}));
      wireDel();
      const rows = ov.querySelectorAll(".cb-e-row");
      rows[rows.length - 1].querySelector(".cb-e-q").focus();
    });

    ov.querySelector(".cb-e-save").addEventListener("click", async e => {
      const btn = e.currentTarget;
      const name = ov.querySelector(".cb-e-name").value.trim();
      if (!name) { this._toast("Name darf nicht leer sein"); return; }
      btn.disabled = true;
      const ings = Array.from(ov.querySelectorAll(".cb-e-row")).map(r => {
        const item = r.querySelector(".cb-e-i").value.trim();
        if (!item) return null;
        const qRaw = r.querySelector(".cb-e-q").value.trim().replace(",", ".");
        const qty = qRaw === "" ? "" : (Number(qRaw) || 0);
        return { qty, unit: r.querySelector(".cb-e-u").value.trim(), item };
      }).filter(Boolean);
      const steps = ov.querySelector(".cb-e-steps").value.split("\n").map(s => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
      const act = Number(ov.querySelector(".cb-e-act").value) || 0;
      const tot = Number(ov.querySelector(".cb-e-tot").value) || 0;
      Object.assign(d, {
        name, category,
        tags: Array.from(tags),
        portions_base: Number(ov.querySelector(".cb-e-port").value) || this.config.base_portions,
        active_min: act,
        total_min: tot || act,
        kcal: Math.round(Number(ov.querySelector(".cb-e-kcal").value) || 0),
        protein_g: Math.round(Number(ov.querySelector(".cb-e-prot").value) || 0),
        ingredients: ings,
        steps,
      });
      if (await this._save(d, d.uid)) { this._closeOv(); this._toast(`„${name}" gespeichert`); }
      else btn.disabled = false;
    });
  }

  _openPlan(d) {
    const days = []; const now = new Date();
    for (let i = 0; i < 7; i++) { const dd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); days.push(dd); }
    const dayBtns = days.map((dd, i) => `<button class="cb-day" data-i="${i}">${i === 0 ? "Heute" : dd.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}</button>`).join("");
    const mealBtns = (this.config.meals || []).map(m => `<button class="cb-meal" data-m="${this._esc(m.label)}">${this._esc(m.label)}</button>`).join("");
    const ov = this._overlay(`
      <div class="cb-m-head"><span>„${this._esc(d.name)}" einplanen</span><button class="cb-x">${CP(0x2715)}</button></div>
      <div class="cb-sub">Tag</div><div class="cb-days">${dayBtns}</div>
      <div class="cb-sub">Mahlzeit</div><div class="cb-meals">${mealBtns}</div>
      <div class="cb-m-foot"><button class="cb-btn cb-plan-ok">📅 Einplanen</button></div>`);
    let dayI = 0, meal = (this.config.meals[2] || this.config.meals[0]).label;
    const mark = () => { ov.querySelectorAll(".cb-day").forEach(b => b.classList.toggle("cb-on", Number(b.dataset.i) === dayI)); ov.querySelectorAll(".cb-meal").forEach(b => b.classList.toggle("cb-on", b.dataset.m === meal)); };
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelectorAll(".cb-day").forEach(b => b.addEventListener("click", () => { dayI = Number(b.dataset.i); mark(); }));
    ov.querySelectorAll(".cb-meal").forEach(b => b.addEventListener("click", () => { meal = b.dataset.m; mark(); }));
    ov.querySelector(".cb-plan-ok").addEventListener("click", async e => { const btn = e.currentTarget; btn.disabled = true; const ok = await this._addToPlan(d, days[dayI], meal); if (ok) this._closeOv(); else btn.disabled = false; });
    mark();
  }

  _openAdd() {
    const ov = this._overlay(`
      <div class="cb-m-head"><span>Neues Rezept</span><button class="cb-x">${CP(0x2715)}</button></div>
      ${this.config.import_service ? `<div class="cb-sub">Von einer Webseite oder einem Video</div>
      <div class="cb-imp-row">
        <input class="cb-in cb-imp-url" type="url" inputmode="url" placeholder="Link einfügen …">
        <button class="cb-btn cb-imp-go">${CP(0x2B07)} Holen</button>
      </div>
      <div class="cb-e-hint">Rezeptseiten werden ausgelesen, Reels und TikToks angeschaut. Dauert bis zu zwei Minuten.</div>
      <div class="cb-sub">Oder selbst anlegen</div>` : ""}
      <input class="cb-in cb-name" type="text" placeholder="Gerichtname (z. B. Linsencurry)">
      <textarea class="cb-in cb-free" placeholder="Optional: Rezept-Text/Notizen einfügen …"></textarea>
      <div class="cb-m-foot">
        <button class="cb-btn cb-gen">✨ KI-Rezept erzeugen</button>
      </div>
      <div class="cb-m-foot">
        <button class="cb-btn cb-suggest">💡 KI-Vorschlag — überrasch mich</button>
      </div>
      <div class="cb-gen-out"></div>`);
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    this._aiSetName = "";
    const showPreview = (d) => {
      const nameIn = ov.querySelector(".cb-name");
      if (nameIn && d.name) { nameIn.value = d.name; this._aiSetName = d.name; } // generierten Namen ins Feld übernehmen (editierbar); merken, dass er von der KI stammt
      const out = ov.querySelector(".cb-gen-out");
      out.innerHTML = `<div class="cb-sub">${this._esc(d.name)} — ${this._esc(d.category || "")}</div>
        <div class="cb-m-tags">${(d.tags || []).map(t => `<span class="cb-tag">${this._esc(t)}</span>`).join("")}</div>
        <ul class="cb-ing">${(d.ingredients || []).map(i => `<li>${this._esc(String(i.qty || ""))} ${this._esc(i.unit || "")} ${this._esc(i.item || "")}</li>`).join("")}</ul>
        <ol class="cb-steps">${(d.steps || []).map(s => `<li>${this._esc(s)}</li>`).join("")}</ol>
        <div class="cb-m-foot"><button class="cb-btn cb-savegen">✔ Ins Kochbuch speichern</button></div>`;
      out.querySelector(".cb-savegen").addEventListener("click", async () => { const nm = nameIn && nameIn.value.trim(); if (nm) d.name = nm; if (await this._save(d)) this._closeOv(); });
    };
    const run = async (btn, loading, factory) => {
      const prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = loading;
      try { showPreview(await factory()); }
      catch (e) { this._toast("KI-Rezept fehlgeschlagen (ai_task nicht verfügbar?)"); }
      btn.disabled = false; btn.innerHTML = prev;
    };
    ov.querySelector(".cb-gen").addEventListener("click", () => {
      const name = ov.querySelector(".cb-name").value.trim();
      const free = ov.querySelector(".cb-free").value.trim();
      if (!name && !free) { this._toast("Bitte Namen oder Rezept-Text eingeben"); return; }
      run(ov.querySelector(".cb-gen"), "✨ …", () => this._generate(name, free));
    });
    ov.querySelector(".cb-suggest").addEventListener("click", () => {
      const typed = ov.querySelector(".cb-name").value.trim();
      const hint = (typed && typed !== (this._aiSetName || "")) ? typed : ""; // nur echten Nutzer-Text als Hinweis, nicht den KI-Namen
      run(ov.querySelector(".cb-suggest"), "💡 …", () => this._generate("", "", { suggest: true, hint }));
    });
    const igo = ov.querySelector(".cb-imp-go");
    if (igo) igo.addEventListener("click", () => this._import(igo, ov.querySelector(".cb-imp-url")));
  }

  // Import per Link. Der Dienst antwortet sofort und arbeitet im Hintergrund —
  // deshalb wird hier auf das neue Rezept gewartet, statt auf eine Antwort.
  async _import(btn, inp) {
    const url = (inp.value || "").trim();
    if (!/^https?:\/\/\S+$/i.test(url)) { this._toast("Bitte einen vollständigen Link einfügen"); inp.focus(); return; }
    const [domain, service] = String(this.config.import_service).split(".");
    const before = new Set((this._dishes || []).map(d => d.uid));
    const prev = btn.innerHTML; btn.disabled = true; inp.disabled = true;
    try {
      await this._hass.callService(domain, service, { url, chat_id: "" });
    } catch (e) {
      btn.disabled = false; inp.disabled = false; btn.innerHTML = prev;
      this._toast("Import-Dienst nicht erreichbar");
      return;
    }
    // Bis zu zwei Minuten pollen. Der Dialog bleibt offen, damit man sieht,
    // dass noch etwas läuft — und beim Schließen läuft der Import trotzdem weiter.
    for (let i = 0; i < 40; i++) {
      btn.innerHTML = `⏳ ${i * 3}s`;
      await new Promise(r => setTimeout(r, 3000));
      if (!this.isConnected) return;
      await this._fetch();
      const neu = (this._dishes || []).find(d => !before.has(d.uid));
      if (neu) {
        this._closeOv();
        this._toast(`„${neu.name}" importiert`);
        this._openDetail(neu);
        return;
      }
    }
    btn.disabled = false; inp.disabled = false; btn.innerHTML = prev;
    this._toast("Dauert länger als erwartet — das Rezept taucht von selbst auf, wenn es fertig ist");
  }

  _styles() {
    return `<style>
      .cb-card{padding:12px 14px;}
      .cb-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
      .cb-title{font-weight:700;font-size:1.05rem;}
      .cb-add{border:none;border-radius:10px;padding:8px 12px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;cursor:pointer;}
      .cb-search{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--divider-color);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color);margin-bottom:8px;}
      .cb-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
      .cb-chip{border:1px solid var(--divider-color);border-radius:16px;padding:5px 11px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.82rem;cursor:pointer;}
      .cb-chip-on{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:transparent;}
      .cb-src{margin-top:12px;font-size:.85rem;}
      .cb-src a{color:var(--primary-color,var(--fp-head,#0277bd));}
      .cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;}
      .cb-dish{text-align:left;border:1px solid var(--divider-color);border-radius:12px;padding:10px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;display:flex;flex-direction:column;gap:4px;min-height:70px;}
      .cb-dish:hover{background:rgba(var(--fp-tint-rgb,129,212,250),.18);}
      .cb-d-name{font-weight:700;font-size:.95rem;line-height:1.15;}
      .cb-d-meta{font-size:.75rem;color:var(--secondary-text-color);}
      .cb-d-time{font-size:.72rem;color:var(--secondary-text-color);}
      .cb-time{font-size:.9rem;color:var(--secondary-text-color);margin:4px 0 2px;}
      .cb-fixtimes{width:100%;box-sizing:border-box;border:1px solid rgba(255,167,38,.5);background:rgba(255,167,38,.14);color:#e65100;font-weight:600;border-radius:12px;padding:9px 12px;margin-bottom:8px;cursor:pointer;text-align:left;font-size:.86rem;}
      .cb-fixtimes:hover{background:rgba(255,167,38,.24);}
      .cb-fixtimes:disabled{opacity:.7;cursor:default;}
      .cb-fixnutri{width:100%;box-sizing:border-box;border:1px solid rgba(var(--fp-tint-rgb,125,155,132),.55);background:rgba(var(--fp-tint-rgb,125,155,132),.14);color:var(--fp-head,#3C5343);font-weight:600;border-radius:12px;padding:9px 12px;margin-bottom:8px;cursor:pointer;text-align:left;font-size:.86rem;}
      .cb-fixnutri:hover{background:rgba(var(--fp-tint-rgb,125,155,132),.24);}
      .cb-fixnutri:disabled{opacity:.7;cursor:default;}
      .cb-imp-row{display:flex;gap:8px;align-items:stretch;}
      .cb-imp-row .cb-in{flex:1;margin:0;}
      .cb-imp-go{white-space:nowrap;}
      .cb-imp-go:disabled{opacity:.7;cursor:default;}
      .cb-d-tags{display:flex;gap:4px;flex-wrap:wrap;}
      .cb-tag{font-size:.68rem;background:rgba(var(--fp-tint-rgb,129,212,250),.25);color:var(--fp-head,#0277bd);border-radius:8px;padding:1px 6px;}
      .cb-d-stars{color:#f5b301;font-size:.8rem;}
      .cb-empty{grid-column:1/-1;color:var(--secondary-text-color);text-align:center;padding:18px;}
      .cb-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:20;}
      .cb-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(94vw,460px);max-height:86vh;overflow:auto;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
      .cb-m-head{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:1.1rem;margin-bottom:8px;}
      .cb-x{border:none;background:transparent;font-size:1.1rem;cursor:pointer;color:var(--secondary-text-color);}
      .cb-m-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;}
      .cb-rate{font-size:.85rem;color:var(--secondary-text-color);margin:6px 0;}
      .cb-rate-stars .cb-star,.cb-star{cursor:pointer;color:#f5b301;font-size:1.1rem;}
      .cb-port{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:.9rem;}
      .cb-port-slider{flex:1;}
      .cb-sub{font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em;color:var(--secondary-text-color);margin:12px 0 6px;}
      .cb-ing{margin:0;padding-left:18px;} .cb-ing li{margin:2px 0;}
      .cb-steps{margin:0;padding-left:20px;} .cb-steps li{margin:5px 0;line-height:1.35;}
      .cb-m-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
      .cb-btn{flex:1;border:none;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;background:rgba(179,229,252,.95);color:#014a73;}
      .cb-btn.cb-del{flex:none;background:rgba(229,57,53,.15);color:#e53935;}
      .cb-in{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--divider-color);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color);margin-bottom:8px;font-size:1rem;}
      textarea.cb-free{min-height:70px;resize:vertical;}
      .cb-ck-tools{display:flex;gap:14px;margin:2px 0 8px;}
      .cb-linkbtn{border:none;background:transparent;color:var(--primary-color,var(--fp-head,#0277bd));cursor:pointer;font-size:.85rem;padding:2px 0;text-decoration:underline;}
      .cb-cklist{max-height:46vh;overflow:auto;display:flex;flex-direction:column;gap:2px;}
      .cb-ck{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;cursor:pointer;}
      .cb-ck:hover{background:rgba(var(--fp-tint-rgb,129,212,250),.12);}
      .cb-ck input{width:18px;height:18px;flex:none;}
      .cb-e-cats,.cb-e-tags{display:flex;gap:6px;flex-wrap:wrap;}
      .cb-e-hint{font-size:.75rem;color:var(--secondary-text-color);margin-top:6px;}
      .cb-e-hint-inline{font-weight:400;text-transform:none;letter-spacing:0;}
      .cb-e-nums{display:flex;gap:8px;flex-wrap:wrap;}
      .cb-e-nums label{flex:1;min-width:96px;display:flex;flex-direction:column;gap:3px;font-size:.72rem;color:var(--secondary-text-color);}
      .cb-e-in{padding:8px 9px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font-size:.95rem;box-sizing:border-box;width:100%;}
      .cb-e-row{display:flex;gap:5px;margin-bottom:5px;align-items:center;}
      .cb-e-q{flex:0 0 68px;} .cb-e-u{flex:0 0 74px;} .cb-e-i{flex:1;min-width:0;}
      .cb-e-x{flex:none;border:none;background:rgba(229,57,53,.12);color:#e53935;border-radius:8px;width:30px;height:34px;cursor:pointer;font-size:.85rem;}
      textarea.cb-e-steps{min-height:150px;resize:vertical;line-height:1.45;font-family:inherit;}
      .cb-btn.cb-edit,.cb-btn.cb-del{flex:none;}
      .cb-btn.cb-edit{background:rgba(255,213,79,.30);color:#8a6100;}
      .cb-days,.cb-meals{display:flex;gap:6px;flex-wrap:wrap;}
      .cb-day,.cb-meal{border:1px solid var(--divider-color);border-radius:10px;padding:9px 11px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;}
      .cb-day.cb-on,.cb-meal.cb-on{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:transparent;}
    </style>`;
  }
  getCardSize() { return 8; }
}
if (!customElements.get("fp-cookbook-card")) {
  customElements.define("fp-cookbook-card", FpCookbookCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-cookbook-card", name: "FP Cookbook Card", description: "Kochbuch mit Rezepten, KI-Generierung, in Essensplan legen, Zutaten -> Einkauf" });
}

/* ===== dobby-clock-card v7 (Einheitenleiter bis Monate, feinere Einheiten auf eigener Zeile) ===== */
class DobbyClockCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      select: "input_select.dobby_versteckt_von",
      players: [
        { name: "Tobias", total: "input_number.dobby_gesamtzeit_tobias" },
        { name: "Verena", total: "input_number.dobby_gesamtzeit_verena" },
      ],
      since: "input_datetime.dobby_letzter_wechsel",
      pause_label: "Pause",
      title: "Wo ist Dobby?",
      round_label: "diese Runde",
      idle_text: "Niemand versteckt gerade etwas",
    }, config || {});
    if ((this.config.players || []).length !== 2) throw new Error("dobby-clock-card braucht genau zwei players");
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._paint();
  }

  connectedCallback() { this._startTicking(); }
  disconnectedCallback() { this._stopTicking(); }
  // Die Uhr tickt nur hier im Browser. Ein Sensor, der jede Sekunde einen neuen
  // Zustand schreibt, wuerde die Datenbank fuellen, ohne dass jemand etwas davon hat.
  _startTicking() { this._stopTicking(); this._timer = setInterval(() => this._paint(), 1000); }
  _stopTicking() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

  // Einheitenleiter: Minuten, Stunden, Tage, Wochen, Monate. Ein Versteck hält
  // hier monatelang — „1465:12:07" wäre zwar korrekt, sagt aber niemandem etwas.
  // Die große Zahl bleibt dadurch immer ein- bis zweistellig, die Einheit steht
  // klein daneben, dazu der Rest in der nächstkleineren Einheit.
  _parts(sec) {
    const s = Math.max(0, Math.floor(sec));
    const MIN = 60, STD = 3600, TAG = 86400, WOCHE = 7 * TAG, MONAT = 30 * TAG;
    const pl = (n, ein, viele) => `${n} ${n === 1 ? ein : viele}`;
    // Unter einer Stunde laufen die Sekunden mit — da schaut man noch zu.
    if (s < STD) return { big: String(Math.floor(s / MIN)), unit: `:${String(s % MIN).padStart(2, "0")}`, rest: [] };
    if (s < TAG) {
      const h = Math.floor(s / STD), m = Math.floor((s % STD) / MIN);
      return { big: String(h), unit: " Std", rest: m ? [`${m} Min`] : [] };
    }
    if (s < WOCHE) {
      const d = Math.floor(s / TAG), h = Math.floor((s % TAG) / STD);
      return { big: String(d), unit: d === 1 ? " Tag" : " Tage", rest: h ? [`${h} Std`] : [] };
    }
    if (s < MONAT) {
      const w = Math.floor(s / WOCHE), d = Math.floor((s % WOCHE) / TAG);
      return { big: String(w), unit: w === 1 ? " Woche" : " Wochen", rest: d ? [pl(d, "Tag", "Tage")] : [] };
    }
    // Ab einem Monat bleiben Wochen UND Tage stehen — „2 Monate" allein
    // verschluckt bis zu vier Wochen, und genau die will man ja sehen.
    // Die Reste müssen sich aufeinander stapeln: erst Monate abziehen, dann aus
    // DEM Rest die Wochen, dann aus dessen Rest die Tage. „s % WOCHE" rechnet
    // dagegen an den Monaten vorbei und liefert Tage, die gar nicht übrig sind.
    const mo = Math.floor(s / MONAT);
    const nachMonaten = s % MONAT;
    const w = Math.floor(nachMonaten / WOCHE);
    const d = Math.floor((nachMonaten % WOCHE) / TAG);
    const rest = [];
    if (w) rest.push(pl(w, "Woche", "Wochen"));
    if (d) rest.push(pl(d, "Tag", "Tage"));
    return { big: String(mo), unit: mo === 1 ? " Monat" : " Monate", rest };
  }
  // Sekunden -> "1:04:07" bzw. "4:07"
  _fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const p = n => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
  }
  // Gesamtstand in derselben Sprache, aber knapper: für die kleine Zeile
  // reichen zwei Einheiten, sonst wird sie länger als die Karte breit ist.
  _langfmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    if (s < 3600) return `${Math.floor(s / 60)} Min`;
    const t = this._parts(s);
    return `${t.big}${t.unit}${t.rest[0] ? ` ${t.rest[0]}` : ""}`;
  }

  _running() {
    const st = this._hass.states[this.config.select];
    return st ? st.state : this.config.pause_label;
  }
  _since() {
    const st = this._hass.states[this.config.since];
    const t = st && st.attributes ? Number(st.attributes.timestamp) : 0;
    return t > 0 ? t : 0;
  }
  _total(p) {
    const st = this._hass.states[p.total];
    return st ? Number(st.state) || 0 : 0;
  }

  _build() {
    this._built = true;
    const [a, b] = this.config.players;
    this.innerHTML = `
      <ha-card class="dc-card">
        <div class="dc-rockerwrap">
          <div class="dc-rocker">
            <div class="dc-paddle dc-paddle0"></div>
            <div class="dc-paddle dc-paddle1"></div>
          </div>
          <div class="dc-hinge"></div>
        </div>
        <div class="dc-body">
          ${[a, b].map((p, i) => `
            <button class="dc-side dc-side${i}" data-n="${U.esc(p.name)}">
              <div class="dc-name">${U.esc(p.name)}</div>
              <div class="dc-time"><span class="dc-big">0</span><span class="dc-sec">:00</span></div>
              <div class="dc-rest"></div>
              <div class="dc-total"></div>
            </button>`).join(`<div class="dc-hair"></div>`)}
        </div>
        <div class="dc-bar">
          <div class="dc-state"></div>
          <button class="dc-pause"></button>
        </div>
      </ha-card>
      ${this._styles()}`;

    this.querySelectorAll(".dc-side").forEach(btn => btn.addEventListener("click", () => this._handOver(btn.dataset.n)));
    this.querySelector(".dc-pause").addEventListener("click", () => this._togglePause());
  }

  // Tippen heisst „der hat ihn jetzt": dessen Uhr laeuft, die andere steht.
  // Laeuft die Uhr dieser Seite schon, ist der Tipp ein Versehen — dann passiert nichts.
  _handOver(name) {
    if (this._running() === name) return;
    this._hass.callService("input_select", "select_option", { entity_id: this.config.select, option: name });
  }
  _togglePause() {
    const cur = this._running();
    const P = this.config.pause_label;
    if (cur !== P) { this._paused = cur; this._hass.callService("input_select", "select_option", { entity_id: this.config.select, option: P }); return; }
    // Aus der Pause zurueck zu dem, der vorher dran war — sonst muesste man raten.
    const back = this._paused && this._paused !== P ? this._paused : this.config.players[0].name;
    this._hass.callService("input_select", "select_option", { entity_id: this.config.select, option: back });
  }

  _paint() {
    if (!this._hass || !this._built) return;
    const run = this._running();
    const P = this.config.pause_label;
    const since = this._since();
    const laufend = run !== P && since > 0 ? Math.floor(Date.now() / 1000 - since) : 0;

    this.config.players.forEach((p, i) => {
      const side = this.querySelector(`.dc-side${i}`);
      const aktiv = p.name === run;
      side.classList.toggle("dc-on", aktiv);
      this.querySelector(`.dc-paddle${i}`).classList.toggle("dc-up", aktiv);
      // Groß steht, was gerade passiert: die laufende Runde. Der Gesamtstand
      // ist die Statistik darunter — er ändert sich ja nur beim Wechsel.
      const t = this._parts(aktiv ? laufend : 0);
      side.querySelector(".dc-big").textContent = t.big;
      side.querySelector(".dc-sec").textContent = t.unit;
      // Die feineren Einheiten kommen auf eine eigene Zeile. Hinter der großen
      // Zahl gedrängt würden sie umbrechen und das Zifferngitter zerreißen.
      side.querySelector(".dc-rest").textContent = t.rest.join(" und ");
      side.querySelector(".dc-total").textContent = `gesamt ${this._langfmt(this._total(p) + (aktiv ? laufend : 0))}`;
    });

    // Die Wippe kippt zur laufenden Seite: wessen Uhr läuft, dessen Taste steht oben.
    const card = this.querySelector(".dc-card");
    card.classList.toggle("dc-kipp0", run === this.config.players[0].name);
    card.classList.toggle("dc-kipp1", run === this.config.players[1].name);

    const st = this.querySelector(".dc-state");
    st.textContent = run === P ? this.config.idle_text : `${run} hat ihn versteckt`;
    this.querySelector(".dc-pause").textContent = run === P ? "▶ Weiter" : "⏸ Pause";
  }

  _styles() {
    return `<style>
      .dc-card{padding:18px 18px 14px;}

      /* --- Wippe: die beiden Tasten oben auf dem Gehäuse ---
         Ein Balken, der um die Mitte kippt. Gedrückt wird die eigene Seite,
         dadurch hebt sich die andere — wessen Taste oben steht, dessen Uhr läuft. */
      .dc-rockerwrap{position:relative;height:30px;margin:0 6px 14px;}
      .dc-rocker{display:flex;gap:4px;height:22px;transform-origin:50% 50%;
        transition:transform .55s cubic-bezier(.32,1.4,.5,1);}
      .dc-card.dc-kipp0 .dc-rocker{transform:rotate(-2.4deg);}
      .dc-card.dc-kipp1 .dc-rocker{transform:rotate(2.4deg);}
      /* Nur die Farbe unterscheidet die beiden Hälften. Kein eigenes translateY,
         sonst säße die gehobene Taste nicht mehr auf derselben Geraden wie die
         andere und der Balken bekäme einen Knick am Scharnier. */
      .dc-paddle{flex:1 1 0;border-radius:11px;background:var(--secondary-background-color);
        transition:background .3s,box-shadow .3s;}
      .dc-paddle.dc-up{background:rgba(var(--fp-accent-rgb,79,195,247),.9);
        box-shadow:0 6px 14px rgba(var(--fp-accent-rgb,79,195,247),.32);}
      /* Das Scharnier dreht nicht mit — daran hängt der Balken. */
      .dc-hinge{position:absolute;left:50%;top:26px;transform:translateX(-50%);
        width:34px;height:4px;border-radius:2px;background:var(--divider-color);}

      /* --- Gehäuse: eine Fläche, zwei Anzeigen, ein Haarstrich dazwischen --- */
      .dc-body{display:flex;align-items:stretch;border-radius:20px;overflow:hidden;
        background:var(--secondary-background-color);}
      .dc-hair{width:1px;background:var(--divider-color);opacity:.6;flex:none;margin:14px 0;}
      .dc-side{flex:1 1 0;min-width:0;border:none;background:transparent;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px 18px;
        color:var(--primary-text-color);transition:background .3s;}
      .dc-side:active{background:rgba(0,0,0,.04);}
      .dc-side.dc-on{background:rgba(var(--fp-accent-rgb,79,195,247),.10);}
      .dc-name{font-size:.8rem;font-weight:590;letter-spacing:.04em;text-transform:uppercase;
        color:var(--secondary-text-color);opacity:.75;}
      .dc-time{display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;
        font-variant-numeric:tabular-nums;color:var(--secondary-text-color);opacity:.45;
        transition:color .3s,opacity .3s;}
      .dc-big{font-size:3.1rem;font-weight:600;line-height:.98;letter-spacing:-.025em;}
      .dc-sec{font-size:1.4rem;font-weight:500;letter-spacing:-.005em;margin-left:2px;opacity:.85;}
      .dc-rest{font-size:.92rem;font-weight:590;color:var(--secondary-text-color);
        opacity:.6;min-height:1.2em;transition:color .3s,opacity .3s;}
      .dc-side.dc-on .dc-rest{color:var(--fp-head,var(--primary-color));opacity:.9;}
      .dc-side.dc-on .dc-time{color:var(--fp-head,var(--primary-color));opacity:1;}
      .dc-total{font-size:.76rem;color:var(--secondary-text-color);opacity:.7;min-height:1.1em;}

      .dc-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin-top:14px;padding:0 4px;}
      .dc-state{font-size:.82rem;color:var(--secondary-text-color);opacity:.8;}
      .dc-pause{border:none;border-radius:999px;padding:8px 16px;
        background:var(--secondary-background-color);color:var(--primary-text-color);
        cursor:pointer;font-size:.82rem;font-weight:590;transition:background .2s;}
      .dc-pause:hover{background:rgba(var(--fp-tint-rgb,129,212,250),.22);}
    </style>`;
  }
  getCardSize() { return 4; }
}
if (!customElements.get("dobby-clock-card")) {
  customElements.define("dobby-clock-card", DobbyClockCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "dobby-clock-card", name: "Dobby Clock Card", description: "Schachuhr, die hochzaehlt — fuer Versteckspiele zu zweit" });
}
})();
