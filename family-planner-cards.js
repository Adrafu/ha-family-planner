/* Family Planner custom cards - meal-grid-card + family-calendar-card (same-origin local file) */

/* ===== meal-grid-card v5 (week auto-fill) ===== */
(() => {
const CP = cp => String.fromCodePoint(cp);
class MealGridCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Wochenplan", mode: "week", week_offset: 0,
      show_emojis: true, meal_icons: true, background: "",
      ai_suggest: true, ai_entity: "",
      meals: [
        { label: "Fruehstueck", start: 0, end: 11 },
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
    } catch (err) { this._events = []; }
    this._render();
  }

  _norm(s) {
    let out = "";
    for (const ch of String(s).toLowerCase()) {
      const c = ch.codePointAt(0);
      if (c === 0xe4) out += "a"; else if (c === 0xf6) out += "o";
      else if (c === 0xfc) out += "u"; else if (c === 0xdf) out += "ss";
      else out += ch;
    }
    return out;
  }
  _clean(t) { return t ? String(t).replace(/^[\s\p{P}\p{S}]+/u, "").trim() : ""; }
  _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  _pad(n) { return String(n).padStart(2, "0"); }
  _evDate(ev) { const dt = (ev.start && (ev.start.dateTime || ev.start.date)) || ev.start; return new Date(dt); }

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
      ["brokkoli", 0x1F966], ["broccoli", 0x1F966], ["gemuese", 0x1F966], ["gemuse", 0x1F966],
      ["banane", 0x1F34C], ["apfel", 0x1F34E], ["beere", 0x1F353], ["obst", 0x1F34E], ["frucht", 0x1F34E],
      ["kuchen", 0x1F370], ["torte", 0x1F370], ["eis", 0x1F368], ["dessert", 0x1F368], ["pudding", 0x1F368],
      ["kaffee", 0x2615], ["tee", 0x1F375],
    ];
    for (const [k, cp] of map) { if (n.includes(k)) return CP(cp); }
    return "";
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

  async _delEvent(ev, noRefresh) {
    if (!ev || !ev.uid) return;
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this.config.entity, uid: ev.uid }); } catch (e) {}
    if (!noRefresh) await this._maybeFetch(true);
  }
  async _createEvent(meal, date, text, evForTime) {
    let hour = this._mealHour(meal), mins = 0;
    if (evForTime && evForTime.start) { const d = new Date(evForTime.start); hour = d.getHours(); mins = d.getMinutes(); }
    const ds = `${date.getFullYear()}-${this._pad(date.getMonth() + 1)}-${this._pad(date.getDate())}`;
    const start = `${ds} ${this._pad(hour)}:${this._pad(mins)}:00`;
    const end = `${ds} ${this._pad(Math.min(hour + 1, 23))}:${this._pad(mins)}:00`;
    try { await this._hass.callService("calendar", "create_event", { entity_id: this.config.entity, summary: text, start_date_time: start, end_date_time: end }); } catch (e) {}
  }
  async _saveCell(meal, date, ev, text) {
    if (ev && text === "") { await this._delEvent(ev); return; }
    if (ev && text !== "" && text !== ev.summary) { await this._delEvent(ev, true); await this._createEvent(meal, date, text, ev); await this._maybeFetch(true); return; }
    if (!ev && text !== "") { await this._createEvent(meal, date, text); await this._maybeFetch(true); }
  }

  async _suggest(meal, input, btn) {
    const prev = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = CP(0x2728) + " ...";
    try {
      const existing = [];
      this._cells.forEach(r => r.forEach(c => c.forEach(o => { if (o.summary) existing.push(o.summary); })));
      const prompt = `Schlage genau EIN Gericht fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. Kurz, alltagstauglich, auf Deutsch. Antworte NUR mit dem Gerichtnamen, ohne Erklaerung, ohne Anfuehrungszeichen, ohne Satzzeichen am Ende.` + (existing.length ? ` Vermeide diese bereits geplanten Gerichte: ${existing.join(", ")}.` : "");
      const data = { task_name: "Essensvorschlag", instructions: prompt };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
      let txt = r && r.response && r.response.data;
      if (txt && typeof txt === "object") txt = txt.text || txt.result || JSON.stringify(txt);
      txt = String(txt || "").trim().replace(/^["'\s]+/, "").replace(/["'\s.]+$/, "");
      if (txt) { input.value = txt; input.focus(); }
      else throw new Error("leer");
    } catch (e) {
      input.placeholder = "KI nicht verfuegbar - bitte Text eingeben";
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
        const prompt = `Schlage ${emptyDays.length} verschiedene, einfache, alltagstaugliche Gerichte fuer die Mahlzeit "${meal.label}" fuer eine Familie vor. Auf Deutsch. Antworte als reine Liste, ein Gericht pro Zeile, ohne Nummerierung und ohne Aufzaehlungszeichen.` + (existing.length ? ` Vermeide diese Gerichte: ${existing.join(", ")}.` : "");
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
    } catch (e) {}
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
    box.innerHTML = `<div class="mg-modal-t"></div><input class="mg-input" type="text" placeholder="Gericht eingeben...">${suggestBtn}<div class="mg-modal-btns"><button class="mg-btn mg-cancel">Abbrechen</button><button class="mg-btn mg-del">Loeschen</button><button class="mg-btn mg-save">Speichern</button></div>`;
    box.querySelector(".mg-modal-t").textContent = title;
    const input = box.querySelector(".mg-input");
    input.value = ev ? (ev.summary || "") : "";
    const delBtn = box.querySelector(".mg-del");
    if (!ev) delBtn.style.display = "none";
    ov.appendChild(box); this.appendChild(ov);
    setTimeout(() => { input.focus(); input.select(); }, 30);
    const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    const save = async () => { const t = input.value.trim(); close(); await this._saveCell(meal, date, ev, t); };
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    box.querySelector(".mg-cancel").addEventListener("click", close);
    delBtn.addEventListener("click", async () => { close(); await this._delEvent(ev); });
    box.querySelector(".mg-save").addEventListener("click", save);
    const sb = box.querySelector(".mg-suggest");
    if (sb) sb.addEventListener("click", () => this._suggest(meal, input, sb));
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { close(); } });
  }

  _render() {
    if (!this._hass) return;
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
      cells[mi][ci].push({ uid: ev.uid, summary: this._clean(ev.summary || ev.message || ""), start: dt });
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
        <button class="mg-nav" data-d="1" title="Naechste Woche">${CP(0x203A)}</button>
      </div>`;
    } else if (this.config.title) {
      head = `<div class="mg-h">${this._esc(this.config.title)}</div>`;
    }

    let html = `<ha-card class="mg-card">${head}${(!compact && this.config.ai_suggest) ? `<div class="mg-fillrow"><button class="mg-fill">${CP(0x2728)} Ganze Woche f&uuml;llen</button></div>` : ""}<div class="mg-wrap"><table class="mg"><thead><tr><th class="mg-corner"></th>`;
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

    const bgImg = this.config.background ? `.mg-card{background-image:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.72)),url('${this.config.background}');background-size:cover;background-position:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);} .mg-card .mg-day,.mg-card .mg-date,.mg-card .mg-bar-t,.mg-card .mg-bar-s,.mg-card .mg-meal-tx{color:#fff;} .mg-card td.mg-cell{background:rgba(255,255,255,.14);font-weight:600;} .mg-card td.mg-cell:hover{background:rgba(255,255,255,.26);} .mg-card .mg-today{--mg-cell-bg:rgba(255,255,255,.32);}` : "";
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
      .mg-suggest{width:100%;background:rgba(79,195,247,.18);color:#0277bd;font-weight:600;}
      .mg-fillrow{padding:0 14px 10px;}
      .mg-fill{width:100%;border:none;border-radius:10px;padding:10px;background:rgba(79,195,247,.20);color:#0277bd;font-weight:700;cursor:pointer;}
      .mg-fill:hover{background:rgba(79,195,247,.32);}
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
    this.querySelectorAll(".mg-nav,.mg-today-btn").forEach(b => {
      b.addEventListener("click", e => {
        e.stopPropagation();
        const d = parseInt(b.dataset.d, 10);
        this._offset = d === 0 ? 0 : this._offset + d;
        this._maybeFetch(true);
      });
    });
    this.querySelectorAll(".mg-cell").forEach(cell => {
      cell.addEventListener("click", () => this._openEditor(parseInt(cell.dataset.mi, 10), parseInt(cell.dataset.ci, 10)));
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

/* ===== family-calendar-card v1.2 (adaptive text color) ===== */
(() => {
const CP = c => String.fromCodePoint(c);
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

  _key() { return "fcc_hidden_" + (this.config.title || "cal"); }
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
    const all = [];
    await Promise.all(ents.map(async ent => {
      try {
        const s = encodeURIComponent(fs.toISOString()), e = encodeURIComponent(fe.toISOString());
        const evts = await this._hass.callApi("GET", `calendars/${ent}?start=${s}&end=${e}`);
        (evts || []).forEach(ev => { ev._entity = ent; all.push(ev); });
      } catch (err) {}
    }));
    this._events = all;
    this._render();
  }

  _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  _pad(n) { return String(n).padStart(2, "0"); }

  _textOn(bg) { let h = String(bg).replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join(""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); if (isNaN(r) || isNaN(g) || isNaN(b)) return "#fff"; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#222" : "#fff"; }
  _matchPrefix(title, prefix) { const re = new RegExp("^" + prefix + "[ :._-]"); return re.test(title); }
  _stripPrefix(title, prefix) { return title.replace(new RegExp("^" + prefix + "[ :._-]\\s*"), ""); }

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
    const start = new Date(s.dateTime || s.date);
    const end = new Date(e.dateTime || e.date || s.dateTime || s.date);
    return { allDay, start, end };
  }

  _items() {
    const out = [];
    (this._events || []).forEach(ev => {
      const cl = this._classify(ev); if (!cl) return;
      if (this._hidden.has(cl.person.name)) return;
      const t = this._parse(ev);
      out.push({ person: cl.person, display: cl.display, allDay: t.allDay, start: t.start, end: t.end, uid: ev.uid, entity: ev._entity });
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
        cell += `<div class="fcc-ad-ev" style="background:${it.person.color};color:${this._textOn(it.person.color)}" data-uid="${this._esc(it.uid || "")}" data-ent="${it.entity}">${this._esc(it.display)}</div>`;
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
      let col = `<div class="fcc-col${this._isToday(d) ? " fcc-today-col" : ""}" style="height:${gridH}px;background-size:100% ${HH}px">`;
      dayItems.forEach(e => {
        const sd = Math.max(h0, e.start.getHours() + e.start.getMinutes() / 60);
        const ed = Math.min(h1, Math.max(sd + 0.25, e.end.getHours() + e.end.getMinutes() / 60 || h1));
        const top = (sd - h0) * HH, hgt = Math.max(16, (ed - sd) * HH);
        const w = 100 / (e._n || 1), left = (e._c || 0) * w;
        col += `<div class="fcc-ev" data-uid="${this._esc(e.uid || "")}" data-ent="${e.entity}" style="top:${top}px;height:${hgt}px;left:${left}%;width:${w}%;background:${e.person.color};color:${this._textOn(e.person.color)}"><span class="fcc-ev-t">${this._esc(e.display)}</span><span class="fcc-ev-h">${this._pad(e.start.getHours())}:${this._pad(e.start.getMinutes())}</span></div>`;
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
      let cell = `<div class="fcc-m-cell${inMonth ? "" : " fcc-dim"}${this._isToday(c) ? " fcc-today" : ""}"><div class="fcc-m-num">${c.getDate()}</div>`;
      dayEv.slice(0, 4).forEach(it => { const tm = it.allDay ? "" : `${this._pad(it.start.getHours())}:${this._pad(it.start.getMinutes())} `; cell += `<div class="fcc-m-ev" data-uid="${this._esc(it.uid || "")}" data-ent="${it.entity}" style="border-left-color:${it.person.color}"><span class="fcc-m-t">${this._esc(tm)}${this._esc(it.display)}</span></div>`; });
      if (dayEv.length > 4) cell += `<div class="fcc-m-more">+${dayEv.length - 4}</div>`;
      cell += "</div>"; grid += cell;
    });
    grid += "</div>";
    return { label: mlabel, html: `<div class="fcc-m">${head}${grid}</div>` };
  }

  _render() {
    if (!this._hass) return;
    const view = this._view === "month" ? this._monthHTML() : this._weekHTML();
    const css = this._css();
    this.innerHTML = `<style>${css}</style><ha-card class="fcc-card">${this._headerHTML(view.label)}${this._legendHTML()}${view.html}</ha-card>`;
    this.querySelectorAll(".fcc-nav-b,.fcc-today").forEach(b => b.addEventListener("click", () => { const dd = parseInt(b.dataset.d, 10); this._offset = dd === 0 ? 0 : this._offset + dd; this._maybeFetch(true); }));
    this.querySelectorAll(".fcc-vw").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; if (v !== this._view) { this._view = v; this._offset = 0; this._maybeFetch(true); } }));
    this.querySelectorAll(".fcc-chip").forEach(b => b.addEventListener("click", () => { const n = b.dataset.person; if (this._hidden.has(n)) this._hidden.delete(n); else this._hidden.add(n); this._saveHidden(); this._render(); }));
    this.querySelectorAll(".fcc-ev,.fcc-ad-ev,.fcc-m-ev").forEach(el => el.addEventListener("click", e => { e.stopPropagation(); const ent = el.dataset.ent; if (ent) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: ent }, bubbles: true, composed: true })); }));
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
