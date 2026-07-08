/* Family Planner custom cards v1.5.0 - meal-grid-card + family-calendar-card + kids-routine-card + shopping-fav-card + nav-card + fp-todo-card */

/* ===== shared utils (einmal global, von allen Karten genutzt) ===== */
(() => {
  if (window.__fpUtils) return;
  window.__fpUtils = {
    cp: c => String.fromCodePoint(c),
    esc: s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    pad: n => String(n).padStart(2, "0"),
    norm: s => { let out = ""; for (const ch of String(s).toLowerCase()) { const c = ch.codePointAt(0); if (c === 0xe4) out += "a"; else if (c === 0xf6) out += "o"; else if (c === 0xfc) out += "u"; else if (c === 0xdf) out += "ss"; else out += ch; } return out; },
    reEsc: s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    toast: (el, msg) => { try { el.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: msg }, bubbles: true, composed: true })); } catch (e) {} },
  };
})();

/* ===== meal-grid-card v15 (update statt delete+create, recurrence_id, modal-guard, toasts) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class MealGridCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Wochenplan", mode: "week", week_offset: 0, nav_path: "",
      show_emojis: true, meal_icons: true, background: "",
      ai_suggest: true, ai_entity: "", recipe_url: "https://www.chefkoch.de/rs/s0/{q}/Rezepte.html",
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

  async _suggest(meal, input, btn) {
    const prev = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = CP(0x2728) + " ...";
    try {
      const existing = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.summary) existing.push(o.summary); })));
      const avoid = existing.concat(this._recent || []);
      const veg = Math.random() < 0.7;
      const diet = veg ? "Das Gericht MUSS fleischlos (vegetarisch) sein." : "Das Gericht darf auch Fleisch oder Fisch enthalten.";
      const prompt = `Schlage genau EIN alltagstaugliches Gericht fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. ${diet} Auch einfache Klassiker (z. B. Nudeln mit Pesto, Reis mit Gemuese) sind ausdruecklich willkommen. Sprache: oesterreichisches Deutsch (z. B. Topfen statt Quark, Erdaepfel statt Kartoffeln, Paradeiser statt Tomaten), aber die Gerichte duerfen aus aller Welt stammen, nicht nur oesterreichische Kueche. Antworte NUR mit dem Gerichtnamen, ohne Erklaerung, ohne Anfuehrungszeichen, ohne Satzzeichen am Ende.` + (avoid.length ? ` Vermeide diese Gerichte: ${avoid.join(", ")}.` : "");
      const data = { task_name: "Essensvorschlag", instructions: prompt };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
      let txt = r && r.response && r.response.data;
      if (txt && typeof txt === "object") txt = txt.text || txt.result || JSON.stringify(txt);
      txt = String(txt || "").trim().replace(/^["'\s]+/, "").replace(/["'\s.]+$/, "");
      if (txt) { input.value = txt; input.focus(); this._recent = this._recent || []; this._recent.push(txt); if (this._recent.length > 14) this._recent.shift(); }
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
      const existing = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.summary) existing.push(o.summary); })));
      for (let mi = 0; mi < this._meals.length; mi++) {
        const meal = this._meals[mi];
        const emptyDays = [];
        for (let ci = 0; ci < this._cols.length; ci++) {
          const cell = this._cells[mi][ci];
          if (!(cell && cell.length && cell[0].summary)) emptyDays.push(ci);
        }
        if (!emptyDays.length) continue;
        const prompt = `Schlage ${emptyDays.length} verschiedene, einfache, alltagstaugliche Gerichte fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. Etwa 70% davon sollen fleischlos (vegetarisch) sein. Sprache: oesterreichisches Deutsch (z. B. Topfen statt Quark, Erdaepfel statt Kartoffeln, Paradeiser statt Tomaten), aber die Gerichte duerfen aus aller Welt stammen, nicht nur oesterreichische Kueche. Antworte als reine Liste, ein Gericht pro Zeile, ohne Nummerierung und ohne Aufzaehlungszeichen.` + (existing.length ? ` Vermeide diese Gerichte: ${existing.join(", ")}.` : "");
        const data = { task_name: "Wochenessensplan", instructions: prompt };
        if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
        const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
        let txt = r && r.response && r.response.data;
        if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
        const dishes = String(txt || "").split("\n").map(x => x.replace(/^[\s\d.)\-*]+/, "").trim()).filter(Boolean);
        for (let k = 0; k < emptyDays.length; k++) {
          const dish = dishes[k];
          if (!dish) continue;
          existing.push(dish);
          await this._createEvent(meal, this._cols[emptyDays[k]], dish);
        }
      }
      await this._maybeFetch(true);
    } catch (e) { this._toast("KI-Wochenplan fehlgeschlagen (ai_task nicht verfügbar?)"); }
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
    box.innerHTML = `<div class="mg-modal-t"></div><input class="mg-input" type="text" placeholder="Gericht eingeben..."><div class="mg-recipe-row"><button class="mg-btn mg-recipe">${CP(0x1F517)} Zum Rezept</button></div>${suggestBtn}<div class="mg-modal-btns"><button class="mg-btn mg-cancel">Abbrechen</button><button class="mg-btn mg-del">Löschen</button><button class="mg-btn mg-save">Speichern</button></div>`;
    box.querySelector(".mg-modal-t").textContent = title;
    const input = box.querySelector(".mg-input");
    input.value = ev ? (ev.summary || "") : "";
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
    const rb = box.querySelector(".mg-recipe");
    if (rb) {
      if (!ev) { const rr = rb.closest(".mg-recipe-row"); if (rr) rr.style.display = "none"; }
      rb.addEventListener("click", () => { const q = input.value.trim(); if (!q) return; const u = (this.config.recipe_url || "https://www.chefkoch.de/rs/s0/{q}/Rezepte.html").replace("{q}", encodeURIComponent(q)); window.open(u, "_blank", "noopener"); });
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
    if (!compact) {
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
      html += `<tr><th class="mg-meal">${ic}<div class="mg-meal-tx">${this._esc(m.label)}</div></th>`;
      cols.forEach((d, ci) => {
        const items = cells[mi][ci].filter(o => o.summary).map(o => {
          const em = this.config.show_emojis ? this._food(o.summary) : "";
          return (em ? `<span class="mg-em">${em}</span>` : "") + this._esc(o.summary);
        });
        const inner = items.length ? `<span>${items.join("<br>")}</span>` : `<span class="mg-plus">+</span>`;
        html += `<td class="mg-cell ${isToday(d) ? "mg-today" : ""}" data-mi="${mi}" data-ci="${ci}">${inner}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table></div></ha-card>";

    const bgImg = this.config.background ? `.mg-card{background-image:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.72)),url('${this.config.background}');background-size:cover;background-position:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);} .mg-card .mg-bar-t,.mg-card .mg-bar-s,.mg-card .mg-meal-tx{color:#fff;} .mg-card thead th,.mg-card thead .mg-day,.mg-card thead .mg-date{color:#fff !important;} .mg-card td.mg-cell{background:rgba(255,255,255,.14);font-weight:600;color:#fff !important;} .mg-card td.mg-cell span{color:#fff !important;} .mg-card .mg-plus{color:#fff !important;opacity:.65;} .mg-card td.mg-cell:hover{background:rgba(255,255,255,.26);} .mg-card .mg-today{--mg-cell-bg:rgba(255,255,255,.32);}` : "";
    const css = `
      .mg-card{overflow:hidden;}
      .mg-h{padding:12px 16px 4px;font-size:1.25rem;font-weight:600;}
      .mg-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;background:linear-gradient(135deg,rgba(129,212,250,.70),rgba(79,195,247,.70));color:#fff;}
      .mg-bar-mid{flex:1;text-align:center;line-height:1.15;}
      .mg-bar-t{font-size:1.15rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.30);}
      .mg-bar-s{font-size:.78rem;opacity:.95;text-shadow:0 1px 2px rgba(0,0,0,.25);}
      .mg-nav,.mg-today-btn{border:none;background:rgba(255,255,255,.28);color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.25rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
      .mg-nav:hover,.mg-today-btn:hover{background:rgba(255,255,255,.45);}
      .mg-wrap{padding:10px;overflow-x:auto;}
      table.mg{width:100%;border-collapse:separate;border-spacing:7px;table-layout:fixed;}
      table.mg th,table.mg td{text-align:center;}
      table.mg thead th{font-size:.8rem;color:var(--secondary-text-color);padding:2px;}
      table.mg thead .mg-day{font-weight:700;color:var(--primary-text-color);}
      table.mg thead .mg-date{font-size:.7rem;}
      th.mg-meal{width:54px;}
      .mg-meal-ic{font-size:1.15rem;line-height:1.2;}
      .mg-meal-tx{font-size:.6rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.03em;}
      td.mg-cell{background:var(--mg-cell-bg,rgba(129,212,250,0.10));border-radius:14px;min-height:54px;height:54px;padding:6px;font-size:.82rem;line-height:1.2;color:var(--primary-text-color);cursor:pointer;vertical-align:middle;transition:background .15s,transform .1s;}
      td.mg-cell:hover{background:var(--mg-cell-bg-hover,rgba(129,212,250,0.20));transform:translateY(-1px);}
      td.mg-cell span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .mg-plus{color:var(--secondary-text-color);opacity:.45;font-size:1.1rem;font-weight:400;}
      .mg-em{margin-right:3px;}
      .mg-today{--mg-cell-bg:rgba(129,212,250,0.24);}
      th.mg-corner{width:54px;}
      .mg-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9;}
      .mg-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,360px);border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);text-shadow:none;}
      .mg-modal-t{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .mg-input{width:100%;box-sizing:border-box;padding:11px 12px;font-size:1rem;border:1px solid var(--divider-color,#ccc);border-radius:12px;background:var(--secondary-background-color,#f3f3f3);color:var(--primary-text-color);}
      .mg-suggest-row{margin-top:10px;}
      .mg-recipe-row{margin-top:10px;}
      .mg-recipe{width:100%;background:rgba(255,167,38,.18);color:#e65100;font-weight:600;}
      .mg-suggest{width:100%;background:rgba(79,195,247,.18);color:#0277bd;font-weight:600;}
      .mg-fillrow{display:flex;gap:8px;padding:0 14px 10px;}
      .mg-fill{flex:1;border:none;border-radius:10px;padding:10px;background:rgba(179,229,252,.95);color:#014a73;font-weight:700;cursor:pointer;}
      .mg-fill:hover{background:rgba(179,229,252,1);}
      .mg-clear{flex:1;border:none;border-radius:10px;padding:10px;background:rgba(255,205,210,.95);color:#b71c1c;font-weight:700;cursor:pointer;}
      .mg-clear:hover{background:rgba(255,205,210,1);}
      .mg-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
      .mg-btn{border:none;border-radius:10px;padding:9px 14px;font-size:.9rem;cursor:pointer;}
      .mg-cancel{background:var(--secondary-background-color,#eee);color:var(--primary-text-color);}
      .mg-del{background:rgba(229,57,53,.15);color:#e53935;}
      .mg-save{background:#4fc3f7;color:#06354a;font-weight:700;}
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

/* ===== family-calendar-card v1.7 (update-ws, recurrence_id, modal-guard, prefix-escape, toasts) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class FamilyCalendarCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Kalender", initial_view: "week", day_start: 6, day_end: 23, persons: [],
    }, config || {});
    if (!this.config.persons || !this.config.persons.length) throw new Error("Bitte 'persons' konfigurieren");
    this._view = this.config.initial_view === "month" ? "month" : "week";
    this._offset = 0;
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
    this._hidden = this._loadHidden();
  }
  set hass(hass) { this._hass = hass; this._maybeFetch(); }

  _key() { let h = 0; const src = (this.config.persons || []).map(p => p.name + "|" + p.calendar).join(";"); for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0; return "fcc_hidden_" + (this.config.title || "cal") + "_" + (h >>> 0).toString(36); }
  _loadHidden() { try { return new Set(JSON.parse(localStorage.getItem(this._key()) || "[]")); } catch (e) { return new Set(); } }
  _saveHidden() { try { localStorage.setItem(this._key(), JSON.stringify([...this._hidden])); } catch (e) {} }

  _entities() { const s = new Set(); this.config.persons.forEach(p => { if (p.calendar) s.add(p.calendar); }); return [...s]; }

  _range() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
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
    const fs = this._view === "week" ? r.start : r.gridStart;
    const fe = this._view === "week" ? r.end : r.gridEnd;
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
      let cell = '<div class="fcc-ad-cell">';
      items.filter(it => it.allDay && d >= new Date(it.start.getFullYear(), it.start.getMonth(), it.start.getDate()) && d < it.end).forEach(it => {
        cell += `<div class="fcc-ad-ev" style="background:${it.person.color};color:${this._textOn(it.person.color)}" data-key="${this._esc(it.key)}" data-ent="${it.entity}">${this._esc(it.display)}</div>`;
      });
      cell += "</div>"; allRow += cell;
    });
    allRow += "</div>";

    let hours = '<div class="fcc-hours">';
    for (let h = h0; h < h1; h++) hours += `<div class="fcc-hr" style="height:${HH}px"><span>${this._pad(h)}:00</span></div>`;
    hours += "</div>";

    let body = `<div class="fcc-grid"><div class="fcc-gutter">${hours}</div>`;
    cols.forEach(d => {
      const dayItems = items.filter(it => !it.allDay && this._sameDay(it.start, d));
      dayItems.sort((a, b) => a.start - b.start || a.end - b.end);
      const clusters = []; let cur = [], curEnd = null;
      dayItems.forEach(e => { if (curEnd !== null && e.start >= curEnd) { clusters.push(cur); cur = []; curEnd = null; } cur.push(e); curEnd = curEnd === null ? e.end : new Date(Math.max(curEnd, e.end)); });
      if (cur.length) clusters.push(cur);
      clusters.forEach(cl => { const colsEnd = []; cl.forEach(e => { let placed = false; for (let i = 0; i < colsEnd.length; i++) { if (colsEnd[i] <= e.start) { e._c = i; colsEnd[i] = e.end; placed = true; break; } } if (!placed) { e._c = colsEnd.length; colsEnd.push(e.end); } }); cl.forEach(e => e._n = colsEnd.length); });
      let col = `<div class="fcc-col${this._isToday(d) ? " fcc-today-col" : ""}" data-date="${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}" style="height:${gridH}px;background-size:100% ${HH}px">`;
      dayItems.forEach(e => {
        const sd = Math.max(h0, e.start.getHours() + e.start.getMinutes() / 60);
        const ed = Math.min(h1, Math.max(sd + 0.25, e.end.getHours() + e.end.getMinutes() / 60 || h1));
        const top = (sd - h0) * HH, hgt = Math.max(16, (ed - sd) * HH);
        const w = 100 / (e._n || 1), left = (e._c || 0) * w;
        col += `<div class="fcc-ev" data-key="${this._esc(e.key)}" data-ent="${e.entity}" style="top:${top}px;height:${hgt}px;left:${left}%;width:${w}%;background:${e.person.color};color:${this._textOn(e.person.color)}"><span class="fcc-ev-t">${this._esc(e.display)}</span><span class="fcc-ev-h">${this._pad(e.start.getHours())}:${this._pad(e.start.getMinutes())}</span></div>`;
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
    let dateIso, von, bis, allDay = false, title = "", personIdx = 0;
    if (edit) {
      const s = it.start, e = it.end;
      dateIso = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
      allDay = !!it.allDay;
      von = pad(s.getHours()) + ":" + pad(s.getMinutes());
      bis = pad(e.getHours()) + ":" + pad(e.getMinutes());
      title = it.display || "";
      const pi = persons.findIndex(p => it.person && p.name === it.person.name);
      personIdx = pi >= 0 ? pi : 0;
    } else {
      dateIso = opts.dateIso;
      von = pad(opts.hour) + ":00";
      bis = pad(Math.min(opts.hour + 1, 23)) + ":00";
    }
    const ov = document.createElement("div"); ov.className = "fcc-ov";
    const box = document.createElement("div"); box.className = "fcc-modal";
    const optsHtml = persons.map((p, i) => `<option value="${i}"${i === personIdx ? " selected" : ""}>${this._esc(p.name)}</option>`).join("");
    box.innerHTML = `<div class="fcc-modal-t">${edit ? "Termin bearbeiten" : "Neuer Termin"}</div>
      <input class="fcc-in fcc-title" type="text" placeholder="Titel" value="${this._esc(title)}">
      <label class="fcc-lab">Wer</label><select class="fcc-in fcc-person">${optsHtml}</select>
      <label class="fcc-lab">Datum</label><input class="fcc-in fcc-date" type="date" value="${dateIso}">
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
      const ad = adCb.checked;
      const summary = (p.prefix ? p.prefix + " " : "") + t;
      // Zeiten/Daten vor close() aus dem Formular lesen; mehrtägige Ganztagstermine behalten ihre Dauer
      let days = 1;
      if (edit && it.allDay && ad) days = Math.max(1, Math.round((it.end - it.start) / 86400000));
      let startDate = d, endDate = "", startDT = "", endDT = "";
      if (ad) {
        const nd = new Date(d + "T00:00:00"); nd.setDate(nd.getDate() + days);
        endDate = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
      } else {
        let v = box.querySelector(".fcc-von").value || "09:00";
        let b = box.querySelector(".fcc-bis").value || v;
        if (b <= v) { const bd = new Date(d + "T" + v + ":00"); const day0 = bd.getDate(); bd.setMinutes(bd.getMinutes() + 60); b = bd.getDate() !== day0 ? "23:59" : pad(bd.getHours()) + ":" + pad(bd.getMinutes()); }
        startDT = d + " " + v + ":00"; endDT = d + " " + b + ":00";
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
    const view = this._view === "month" ? this._monthHTML() : this._weekHTML();
    const css = this._css();
    this.innerHTML = `<style>${css}</style><ha-card class="fcc-card">${this._headerHTML(view.label)}${this._legendHTML()}${view.html}</ha-card>`;
    this.querySelectorAll(".fcc-nav-b,.fcc-today").forEach(b => b.addEventListener("click", () => { const dd = parseInt(b.dataset.d, 10); this._offset = dd === 0 ? 0 : this._offset + dd; this._maybeFetch(true); }));
    this.querySelectorAll(".fcc-vw").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; if (v !== this._view) { this._view = v; this._offset = 0; this._maybeFetch(true); } }));
    this.querySelectorAll(".fcc-chip").forEach(b => b.addEventListener("click", () => { const n = b.dataset.person; if (this._hidden.has(n)) this._hidden.delete(n); else this._hidden.add(n); this._saveHidden(); this._render(); }));
    this.querySelectorAll(".fcc-ev,.fcc-ad-ev,.fcc-m-ev").forEach(el => el.addEventListener("click", e => {
      e.stopPropagation();
      const k = el.dataset.key;
      const item = k && this._evMap ? this._evMap[k] : null;
      if (item && !(item.person && item.person.no_create)) { this._openEvent({ item: item }); return; }
      const ent = el.dataset.ent; if (ent) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: ent }, bubbles: true, composed: true }));
    }));
    this.querySelectorAll(".fcc-col").forEach(col => col.addEventListener("click", e => { const ds = col.dataset.date; if (!ds) return; const h = Math.min(this.config.day_end - 1, Math.max(this.config.day_start, this.config.day_start + Math.floor(e.offsetY / 46))); this._openEvent({ dateIso: ds, hour: h }); }));
    this.querySelectorAll(".fcc-m-cell").forEach(c => c.addEventListener("click", () => { const ds = c.dataset.date; if (ds) this._openEvent({ dateIso: ds, hour: 9 }); }));
    if (this._view === "week") { const sc = this.querySelector(".fcc-scroll"); if (sc) sc.scrollTop = Math.max(0, (8 - this.config.day_start) * 46); }
  }

  _css() {
    return `
    .fcc-card{overflow:hidden;padding-bottom:6px;}
    .fcc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;background:linear-gradient(135deg,rgba(129,212,250,.70),rgba(79,195,247,.70));color:#fff;}
    .fcc-title{font-size:1.15rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.25);}
    .fcc-range{flex:1;text-align:center;font-size:.92rem;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.2);}
    .fcc-nav,.fcc-views{display:flex;gap:6px;}
    .fcc-btn{border:none;border-radius:9px;padding:7px 12px;font-size:.85rem;cursor:pointer;background:rgba(255,255,255,.25);color:#fff;}
    .fcc-btn:hover{background:rgba(255,255,255,.42);}
    .fcc-vw-on{background:#fff;color:#0277bd;font-weight:700;}
    .fcc-legend{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 4px;}
    .fcc-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--divider-color,#ddd);background:var(--card-background-color);color:var(--primary-text-color);border-radius:999px;padding:4px 10px;font-size:.82rem;cursor:pointer;}
    .fcc-chip.fcc-off{opacity:.4;text-decoration:line-through;}
    .fcc-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
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
    .fcc-today-col{background-color:rgba(3,155,229,.05);}
    .fcc-ev{position:absolute;border-radius:7px;color:#fff;padding:2px 5px;overflow:hidden;font-size:.72rem;line-height:1.05;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;box-sizing:border-box;}
    .fcc-ev-t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .fcc-ev-h{font-size:.62rem;opacity:.9;}
    .fcc-m-head{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:6px 8px 0;}
    .fcc-m-head>div{text-align:center;font-size:.72rem;font-weight:700;color:var(--secondary-text-color);}
    .fcc-m-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:6px 8px 8px;}
    .fcc-m-cell{min-width:0;overflow:hidden;min-height:84px;border-radius:8px;background:var(--secondary-background-color,rgba(0,0,0,.03));padding:3px;}
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

/* ===== shopping-fav-card v11 (add_button-Dialog, show_due/target_label, fp-todo-add-Event) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class ShoppingFavCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.list_entity) throw new Error("list_entity (todo-Liste) erforderlich");
    this.config = Object.assign({ columns: 3, store_entity: "", title: "", assign: false, targets: [], default_target: "", big: false, fallback: "", add_button: false, add_label: "", show_due: true, target_label: "Wer?" }, config || {});
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
  _addItem(name, target, due) {
    if (!this._hass) return;
    const ent = target || this.config.list_entity;
    const data = { entity_id: ent, item: name };
    if (due) data.due_date = due;
    window.dispatchEvent(new CustomEvent("fp-todo-add", { detail: { entity: ent, summary: name, due: due || null } }));
    this._hass.callService("todo", "add_item", data).catch(() => this._toast("Konnte nicht zur Liste hinzugefügt werden"));
  }
  _isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  _openAssign(name) {
    this._editing = true;
    const targets = this.config.targets || [];
    const def = this.config.default_target || this.config.list_entity || (targets[0] && targets[0].entity) || "";
    this._sel = def; this._due = "";
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._aov = ov;
    const tbtns = targets.map(t => `<button class="sf-tgt${t.entity === def ? " sf-tgt-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">${this._emoji(name)} ${this._esc(name)}</div><div class="sf-sub">Wer?</div><div class="sf-tgts">${tbtns}</div><div class="sf-sub">Bis wann?</div><div class="sf-dates"><button class="sf-q sf-q-on" data-q="none">Kein Datum</button><button class="sf-q" data-q="today">Heute</button><button class="sf-q" data-q="tom">Morgen</button></div><input class="sf-date" type="date"><div class="sf-foot"><button class="sf-cancel">Abbrechen</button><button class="sf-ok">OK</button></div></div>`;
    this.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeAssign(); });
    ov.querySelectorAll(".sf-tgt").forEach(b => b.addEventListener("click", () => {
      this._sel = b.dataset.e;
      ov.querySelectorAll(".sf-tgt").forEach(x => x.classList.toggle("sf-tgt-on", x === b));
    }));
    const dateInp = ov.querySelector(".sf-date");
    ov.querySelectorAll(".sf-q").forEach(b => b.addEventListener("click", () => {
      const q = b.dataset.q;
      if (q === "none") { this._due = ""; dateInp.value = ""; }
      else { const d = new Date(); if (q === "tom") d.setDate(d.getDate() + 1); this._due = this._isoDate(d); dateInp.value = this._due; }
      ov.querySelectorAll(".sf-q").forEach(x => x.classList.toggle("sf-q-on", x === b));
    }));
    dateInp.addEventListener("change", () => { this._due = dateInp.value; ov.querySelectorAll(".sf-q").forEach(x => x.classList.remove("sf-q-on")); });
    ov.querySelector(".sf-cancel").addEventListener("click", () => this._closeAssign());
    ov.querySelector(".sf-ok").addEventListener("click", () => { this._addItem(name, this._sel || def, this._due); this._closeAssign(); });
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
    const dueHtml = this.config.show_due ? `<div class="sf-sub">Bis wann?</div><div class="sf-dates"><button class="sf-q sf-q-on" data-q="none">Kein Datum</button><button class="sf-q" data-q="today">Heute</button><button class="sf-q" data-q="tom">Morgen</button></div><input class="sf-date" type="date">` : "";
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._aov = ov;
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">${CP(0x2795)} ${this._esc(this.config.add_label || "Hinzufügen")}</div><input class="sf-addtext" type="text" placeholder="Eingeben..."/>${favChips ? `<div class="sf-sub">Favoriten</div><div class="sf-favs">${favChips}</div>` : ""}${tbtns ? `<div class="sf-sub">${this._esc(this.config.target_label || "Wer?")}</div><div class="sf-tgts">${tbtns}</div>` : ""}${dueHtml}<div class="sf-foot"><button class="sf-cancel">Abbrechen</button><button class="sf-ok">Hinzufügen</button></div></div>`;
    this.appendChild(ov);
    const txt = ov.querySelector(".sf-addtext");
    setTimeout(() => { txt.focus(); }, 30);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeAssign(); });
    ov.querySelectorAll(".sf-favpick").forEach(b => b.addEventListener("click", () => { txt.value = b.dataset.n; txt.focus(); }));
    ov.querySelectorAll(".sf-tgt").forEach(b => b.addEventListener("click", () => { this._sel = b.dataset.e; ov.querySelectorAll(".sf-tgt").forEach(x => x.classList.toggle("sf-tgt-on", x === b)); }));
    const dateInp = ov.querySelector(".sf-date");
    if (dateInp) {
      ov.querySelectorAll(".sf-q").forEach(b => b.addEventListener("click", () => {
        const q = b.dataset.q;
        if (q === "none") { this._due = ""; dateInp.value = ""; }
        else { const d = new Date(); if (q === "tom") d.setDate(d.getDate() + 1); this._due = this._isoDate(d); dateInp.value = this._due; }
        ov.querySelectorAll(".sf-q").forEach(x => x.classList.toggle("sf-q-on", x === b));
      }));
      dateInp.addEventListener("change", () => { this._due = dateInp.value; ov.querySelectorAll(".sf-q").forEach(x => x.classList.remove("sf-q-on")); });
    }
    const submit = () => { const t = txt.value.trim(); if (!t) { txt.focus(); return; } this._addItem(t, this._sel || def, this._due); this._closeAssign(); };
    txt.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    ov.querySelector(".sf-cancel").addEventListener("click", () => this._closeAssign());
    ov.querySelector(".sf-ok").addEventListener("click", submit);
  }
  _flash(b) {
    const o = b.innerHTML; b.classList.add("sf-added"); b.innerHTML = CP(0x2713) + " Hinzugefuegt";
    setTimeout(() => { b.classList.remove("sf-added"); b.innerHTML = o; }, 850);
  }
  _render() {
    this._built = true;
    if (this.config.add_button) {
      this.innerHTML = `<ha-card class="sf-card sf-addcard">${this.config.title ? `<div class="sf-title">${this._esc(this.config.title)}</div>` : ""}<button class="sf-addbig">${CP(0x2795)} ${this._esc(this.config.add_label || "Aufgabe hinzufügen")}</button></ha-card>${this._styles()}`;
      const ab = this.querySelector(".sf-addbig");
      if (ab) ab.addEventListener("click", () => this._openAdd());
      return;
    }
    const items = this._items();
    const cols = this.config.columns || 3;
    const big = this.config.big ? " sf-big" : "";
    const chips = items.map(it => `<button class="sf-chip${big}" data-n="${this._esc(it)}">${this._emoji(it)} ${this._esc(it)}</button>`).join("");
    this.innerHTML = `<ha-card class="sf-card">${this.config.title ? `<div class="sf-title">${this._esc(this.config.title)}</div>` : ""}<div class="sf-grid" style="grid-template-columns:repeat(${cols},1fr);">${chips || `<div class="sf-empty">Noch keine Favoriten</div>`}</div><div class="sf-editbar"><button class="sf-edit">${CP(0x270F) + CP(0xFE0F)} Favoriten bearbeiten</button></div></ha-card>${this._styles()}`;
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
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">Favoriten bearbeiten</div><div class="sf-list"></div><div class="sf-addrow"><input class="sf-new" type="text" placeholder="Neuer Favorit..."><button class="sf-addbtn">${CP(0x2795)} Hinzufuegen</button></div><div class="sf-foot"><button class="sf-done">Fertig</button></div></div>`;
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
      .sf-addbtn{border:none;border-radius:10px;padding:10px 12px;background:rgba(79,195,247,.95);color:#013;font-weight:700;cursor:pointer;white-space:nowrap;}
      .sf-foot{margin-top:16px;display:flex;justify-content:flex-end;}
      .sf-done{border:none;border-radius:10px;padding:10px 18px;background:rgba(120,144,156,.22);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .sf-chip.sf-big{height:66px;font-size:1.05rem;border-radius:14px;}
      .sf-sub{font-size:.8rem;font-weight:700;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.03em;margin:14px 0 6px;}
      .sf-tgts,.sf-dates{display:flex;gap:8px;flex-wrap:wrap;}
      .sf-tgt{flex:1;min-width:84px;border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .sf-tgt-on{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:transparent;}
      .sf-q{flex:1;min-width:70px;border:1px solid var(--divider-color);border-radius:10px;padding:9px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;font-size:.9rem;}
      .sf-q-on{background:rgba(79,195,247,.95);color:#013;border-color:transparent;font-weight:600;}
      .sf-date{width:100%;box-sizing:border-box;margin-top:8px;border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-foot .sf-cancel{border:none;border-radius:10px;padding:10px 16px;background:rgba(120,144,156,.20);color:var(--primary-text-color);font-weight:600;cursor:pointer;margin-right:8px;}
      .sf-foot .sf-ok{border:none;border-radius:10px;padding:10px 22px;background:rgba(79,195,247,.95);color:#013;font-weight:700;cursor:pointer;}
      .sf-addcard{padding:12px;}
      .sf-addbig{width:100%;border:none;border-radius:12px;padding:14px;background:rgba(79,195,247,.95);color:#013;font-weight:700;font-size:1rem;cursor:pointer;}
      .sf-addbig:hover{background:rgba(79,195,247,1);}
      .sf-addtext{width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;padding:11px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-favs{display:flex;gap:6px;flex-wrap:wrap;}
      .sf-favpick{border:1px solid var(--divider-color);border-radius:16px;padding:6px 10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.85rem;cursor:pointer;}
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

/* ===== nav-card v2 (wraps any card; pointer/text-cursor children stay interactive) ===== */
(() => {
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
    wrap.appendChild(el);
    this.innerHTML = "";
    this.appendChild(wrap);
    wrap.addEventListener("click", e => this._onClick(e));
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

/* ===== fp-todo-card v5 (native todo-list-Wrapper; optimistisch auch beim nativen Freitext-Feld) ===== */
(() => {
class FpTodoCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error("entity erforderlich");
    this.config = config;
    this._pending = [];
    this._built = false;
    this._onAdd = e => { const d = e.detail || {}; if (d.entity === this.config.entity && d.summary) this._optimistic(String(d.summary)); };
    this._onInlineKey = e => { if (e.key === "Enter") this._maybeInline(e); };
    this._onInlineClick = e => this._maybeInline(e);
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
  }
  _maybeInline(e) {
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.some(el => el && el.classList && el.classList.contains("addRow"))) return;
    if (e.type === "click" && !path.some(el => el && el.classList && el.classList.contains("addButton"))) return;
    const inp = path.find(el => el && el.localName === "ha-input");
    const val = inp && inp.value != null ? String(inp.value).trim() : "";
    if (val) this._optimistic(val);
  }
  set hass(hass) { this._hass = hass; if (this._child) this._child.hass = hass; else this._build(); }
  async _build() {
    if (this._built || !this._hass || !this.isConnected) return;
    this._built = true;
    let el;
    try {
      const helpers = await window.loadCardHelpers();
      const cfg = Object.assign({}, this.config);
      cfg.type = "todo-list";
      el = helpers.createCardElement(cfg);
    } catch (e) { this._built = false; return; }
    el.hass = this._hass;
    this._child = el;
    this.innerHTML = "";
    this.appendChild(el);
  }
  _list() {
    try { return this._child && this._child.shadowRoot && this._child.shadowRoot.querySelector("ha-list"); } catch (e) { return null; }
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
