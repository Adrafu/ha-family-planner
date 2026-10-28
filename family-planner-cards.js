/* Family Planner custom cards v3.8.3 - meal-grid-card + family-calendar-card + kids-routine-card + shopping-fav-card + nav-card + fp-todo-card + fp-glance-card + fp-cookbook-card + dobby-clock-card + fp-feeding-card + fp-weight-card + fp-diaper-card + fp-milestone-card + fp-baby-overview-card + fp-assistant-card */

/* ===== shared utils (einmal global, von allen Karten genutzt; lightbox: Dialoge als nativer Dialog in der obersten Ebene; Hinweise erscheinen bei offenem Dialog auch im Dialog) ===== */
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
    // Hinweis mit Knopf "Rueckgaengig" (HA zeigt ihn ms lang, Vorgabe 8 s); fn laeuft beim Tipp darauf.
    undo: (el, msg, fn, ms) => { try { el.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: msg, duration: ms || 8000, action: { text: "Rückgängig", action: fn } }, bubbles: true, composed: true })); } catch (e) {} },
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
    // Wie fill, aber im HA-Stapel (horizontal-stack) bleibt alles, wie HA es setzt.
    // Dort gilt "#root > hui-card { display: contents }" und die Breite verteilt
    // "#root > hui-card > * { flex: 1 1 0 }". Ein Inline-"display:block" am hui-card
    // hebt das auf: er wird selbst zum Flex-Item mit Breite nach Inhalt, und eine
    // Karte mit container-type:inline-size hat dann Eigenbreite 0 — alle Karten
    // kleben zusammengedrueckt (~0 px) nebeneinander. Ein height:100% an der Karte
    // verhindert dort ausserdem das Strecken auf gleiche Hoehe (Prozenthoehe in
    // einer Zeile ohne feste Hoehe zaehlt nicht mehr als "auto").
    // Also: nur wenn der hui-card nicht "contents" ist (Sections-Raster,
    // vertical-stack), wird die Zelle geschlossen. Das braucht den berechneten Stil
    // eines eingehaengten hui-card; vorher gilt die Raster-Annahme, und die Karte
    // ruft nach dem Einhaengen (connectedCallback) noch einmal auf.
    fillZelle: el => {
      const p = el.parentElement;
      const da = !!p && p.localName === "hui-card" && p.isConnected;
      // Eigene Werte aus einem frueheren Aufruf (oder von fill) erst entfernen,
      // sonst liest man unten das eigene "block" statt HAs Regel.
      if (da && p.style.display === "block" && p.style.height === "100%") { p.style.removeProperty("display"); p.style.removeProperty("height"); }
      const stapel = da && getComputedStyle(p).display === "contents";
      el.style.display = "block";
      if (stapel) el.style.removeProperty("height"); else el.style.height = "100%";
      if (da && !stapel) { p.style.display = "block"; p.style.height = "100%"; }
    },
    // Zeit fuer Home Assistant (calendar.create_event, calendar/event/update) mit
    // Zeitzonen-Offset, z. B. 2026-10-25T02:30:00+01:00. Ohne Offset liest HA die Zeit in
    // seiner Zeitzone und nimmt in der doppelten Stunde beim Ende der Sommerzeit (02:00-03:00)
    // immer die Sommerzeit: ein Eintrag aus der winterlichen Stunde landet eine Stunde zu frueh,
    // einer ueber die Umstellung bekommt ein Ende vor dem Beginn. Nur fuer Zeiten an HA, nicht
    // fuer Anzeige, Schluessel oder <input type="datetime-local">.
    haZeit: d => {
      const p = n => String(n).padStart(2, "0"), o = Math.round(-d.getTimezoneOffset()), a = Math.abs(o);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${o < 0 ? "-" : "+"}${p(Math.floor(a / 60))}:${p(a % 60)}`;
    },
    // Uhrzeit aus Eingabefeldern (Datum + "HH:MM") -> Date. Anders als new Date(y, mo, d, h, mi) eindeutig
    // in der doppelten Stunde beim Ende der Sommerzeit (Wien: 02:00-02:59 gibt es zweimal): JavaScript nimmt
    // dort immer das erste Vorkommen (Sommerzeit), ein Eintrag aus der winterlichen Stunde rutschte beim
    // Speichern - auch ohne Aenderung - eine Stunde nach vorn. mo ist 0-basiert wie bei Date, d/h/mi duerfen
    // ueberlaufen (d + 1 = Folgetag). s (Sekunden) ist optional und ist 0, wenn nichts gegeben ist.
    // Gibt es zwei passende Zeitpunkte, entscheidet ref (Date oder ms) - aber nur, wenn er in der Naehe liegt
    // (hoechstens 12 h), sonst gilt die Regel ohne ref:
    //   - Normal (Ende eines neuen Eintrags, ref = Beginn): der erste, der nicht vor ref liegt, also ein Ende nach dem
    //     Beginn - auch ueber die Umstellung hinweg (Beginn 02:50 Sommerzeit, Ende 02:05 -> Winterzeit). Liegen beide
    //     vor ref, der spaetere. Ist ref selbst einer der beiden Zeitpunkte, bleibt es dieser.
    //   - wieRef = true (Bearbeiten, ref = urspruenglicher Zeitpunkt des Eintrags): der mit demselben Offset wie ref.
    //     Ein unveraendert gespeicherter Eintrag bleibt exakt gleich, und wer einen Eintrag aus der winterlichen
    //     Stunde nur um die Minuten verschiebt, bleibt im Winter.
    //   - Ohne ref: der spaetere der beiden, wenn er nicht in der Zukunft liegt, sonst der fruehere. Wer nachtraegt,
    //     meint damit die Stunde, die gerade vorbei ist.
    // Luecke beim Beginn der Sommerzeit (02:00-02:59 gibt es nicht): bleibt beim Verhalten von Date, also die Zeit
    // eine Stunde spaeter (02:30 -> 03:30). Eindeutige Zeiten kommen wie von new Date unveraendert zurueck.
    ortZeit: (y, mo, d, h, mi, ref, s, wieRef) => {
      const t0 = new Date(y, mo, d, h, mi, s || 0, 0);
      if (isNaN(t0)) return t0;
      const wand = x => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), x.getSeconds());
      const W = wand(t0), kand = new Set([+t0]);
      // Offsets kurz davor und danach ausprobieren (getTimezoneOffset: Minuten westlich von UTC, also UTC = Wand + Offset).
      for (const dt of [-86400000, 86400000]) {
        const c = W + new Date(W + dt).getTimezoneOffset() * 60000;
        if (wand(new Date(c)) === W) kand.add(c);
      }
      const k = [...kand].sort((p, q) => p - q);
      if (k.length < 2) return new Date(k[0]);
      const a = k[0], b = k[k.length - 1];
      const r = ref && typeof ref.getTime === "function" ? ref.getTime() : typeof ref === "number" ? ref : NaN;
      if (isFinite(r) && Math.min(Math.abs(a - r), Math.abs(b - r)) <= 12 * 3600000) {
        if (wieRef) {
          const o = new Date(r).getTimezoneOffset();
          if (new Date(b).getTimezoneOffset() === o) return new Date(b);
          if (new Date(a).getTimezoneOffset() === o) return new Date(a);
        }
        return new Date(a >= r ? a : b);
      }
      return new Date(b <= Date.now() ? b : a);
    },
    // Dialog („Lightbox“) als nativer <dialog> in der obersten Ebene (Top Layer): steht immer mittig im sichtbaren
    // Bildschirm, egal wie lang die Karte ist. Ein position:fixed-Overlay im Kartenbaum hängt dagegen am Rahmen eines
    // Vorfahren mit Containment (container-type: inline-size) oder transform und erscheint mitten in der Karte, am iPad
    // unter dem Fold. host = Element, an dem das Overlay bisher hing (Kartenstile, Theme-Variablen und Container-
    // Abfragen greifen weiter, weil der Dialog dort im Baum steht); ov = das Overlay der Karte (Klasse, Stile und
    // Vollbild bleiben, es füllt den Dialog); onCancel = der gewohnte Schließen-Weg der Karte. Er läuft bei Escape (und
    // der Zurück-Taste am Android-Gerät) und wenn die Karte abgehängt wird, während der Dialog offen ist. Ohne onCancel
    // schließt Escape nichts. Aufgeräumt wird, sobald ov aus dem Dialog verschwindet, egal wie die Karte es entfernt
    // (ov.remove(), removeChild, innerHTML): ein modaler Dialog ohne Inhalt bleibt so nie stehen.
    // Gibt den Dialog zurück, im Rückfall (kein <dialog>/showModal, Host nicht angehängt) null: dann hängt ov wie
    // früher direkt an host.
    // Offene Dialoge stehen in window.__fpLbOpen (seitenweit, der zuletzt geöffnete bzw. zuletzt wieder aufgestellte hinten):
    // Hinweise von Home Assistant (hass-notification) liegen unter einem modalen Dialog verdeckt, deshalb zeigt sie der
    // Zuhörer weiter unten (window.__fpLbToast) zusätzlich im obersten Dialog.
    lightbox: (host, ov, onCancel) => {
      const rueckfall = () => { host.appendChild(ov); return null; };
      const D = window.HTMLDialogElement;
      if (!D || typeof D.prototype.showModal !== "function" || !host.isConnected) return rueckfall();
      // Frühere Dialoge dieser Stelle zuerst wegräumen: hat die Karte ihr altes Overlay gerade entfernt, ist der Dialog dazu
      // noch da (der Beobachter unten läuft erst nach dem Aufruf) und stünde kurz doppelt im Baum. Ein noch offener Dialog
      // mit derselben Overlay-Klasse (zweimal schnell geöffnet) wird vom neuen abgelöst; verschiedene Klassen stapeln sich
      // (Foto in Vollbild über dem Blatt der Meilensteinkarte).
      for (const c of [...host.children]) if (c.localName === "dialog" && c._fpEnd && (c._fpOv.parentNode !== c || c._fpOv.className === ov.className)) c._fpEnd();
      const dlg = document.createElement("dialog");
      dlg.className = "fp-lb";
      dlg.setAttribute("tabindex", "-1");
      // Inline, damit keine Kartenregel nötig ist; überstimmt die Vorgaben des Browsers für Dialoge (Rahmen, Rand,
      // Hintergrund, Höchstgröße, Scrollen). Das Overlay darin ist selbst position:fixed und dunkelt selbst ab.
      // Breite 100 % statt 100vw: vw schließt eine sichtbare Scrollleiste ein und verschöbe das Overlay um deren halbe Breite.
      dlg.style.cssText = "position:fixed;inset:0;width:100%;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;color:inherit;outline:none;";
      const st = document.createElement("style");
      st.textContent = "dialog.fp-lb::backdrop{background:transparent}";
      dlg.append(st, ov);
      host.appendChild(dlg);
      try { dlg.showModal(); }
      catch (e) { dlg.remove(); return rueckfall(); }
      let fertig = false, mo = null, io = null, raf = 0;
      // Wer zuletzt showModal() aufgerufen hat, liegt in der obersten Ebene ganz oben und steht deshalb hinten in der Liste.
      const offen = Array.isArray(window.__fpLbOpen) ? window.__fpLbOpen : (window.__fpLbOpen = []);
      const nachOben = () => { const i = offen.indexOf(dlg); if (i >= 0) offen.splice(i, 1); offen.push(dlg); };
      nachOben();
      // showModal() fokussiert das erste Feld; am Handy öffnete das die Tastatur. Dort bleibt der Fokus auf dem Dialog.
      const fokus = () => { try { if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) dlg.focus({ preventScroll: true }); } catch (e) {} };
      const ende = () => {
        if (fertig) return; fertig = true;
        if (mo) mo.disconnect();
        if (io) io.disconnect();
        cancelAnimationFrame(raf);
        const i = offen.indexOf(dlg); if (i >= 0) offen.splice(i, 1);
        if (typeof dlg._fpHinweisWeg === "function") { try { dlg._fpHinweisWeg(); } catch (e) {} }
        try { if (dlg.open) dlg.close(); } catch (e) {}
        dlg.remove();
      };
      const abbruch = () => { if (!fertig && ov.parentNode === dlg && onCancel) { try { onCancel(); } catch (e) { console.warn("[fp-lightbox] Schließen fehlgeschlagen:", e); } } };
      dlg._fpOv = ov; dlg._fpEnd = ende;
      // Escape: die Karte schließt auf ihrem gewohnten Weg. Der Browser soll den Dialog nicht selbst schließen.
      dlg.addEventListener("cancel", ev => { ev.preventDefault(); abbruch(); });
      // Hat der Browser ihn doch geschlossen (Escape ohne vorherige Nutzeraktion ist nicht abbrechbar), die Karte das
      // Overlay aber behalten will, steht er wieder auf.
      dlg.addEventListener("close", () => { if (!fertig && ov.parentNode === dlg && dlg.isConnected) { try { const war = dlg.open && dlg.matches(":modal"); dlg.showModal(); if (!war) nachOben(); } catch (e) {} } });
      mo = new MutationObserver(() => { if (ov.parentNode !== dlg) ende(); });
      mo.observe(dlg, { childList: true });
      // Wird die Karte abgehängt, verliert der Dialog den modalen Zustand von selbst. Beim nächsten Bild räumt das hier
      // ihn ganz weg und sagt der Karte Bescheid (sonst bliebe ihr Zustand „Dialog offen“ stehen).
      if (window.IntersectionObserver) {
        io = new IntersectionObserver(() => { if (!fertig && !dlg.isConnected) { abbruch(); ende(); } });
        io.observe(dlg);
      }
      // Hängt Home Assistant die Karte beim Neuaufbau im selben Takt ab und wieder an (Drehen des iPads, Raster ändert sich),
      // ist der Dialog danach zwar angehängt und offen, aber nicht mehr modal und stünde wieder im Rahmen der Karte. Ein
      // Wächter pro Bild stellt das wieder her; solange der Dialog offen ist, kostet er eine Abfrage je Bild.
      const wacht = () => {
        if (fertig) return;
        try { if (dlg.isConnected && dlg.open && !dlg.matches(":modal")) { dlg.close(); dlg.showModal(); nachOben(); fokus(); } }
        catch (e) { return; }   // ":modal" unbekannt oder showModal geht nicht: kein Wächter mehr
        raf = requestAnimationFrame(wacht);
      };
      raf = requestAnimationFrame(wacht);
      fokus();
      return dlg;
    },
  };
  // In dasselbe Objekt hineinschreiben, nicht ersetzen: Karten der anderen
  // Datei halten bereits eine Referenz darauf.
  const u = window.__fpUtils || (window.__fpUtils = {});
  for (const k of Object.keys(defaults)) if (!(k in u)) u[k] = defaults[k];

  // ---------- Einträge anlegen, die einen Ausfall der Liste überstehen ----------
  // Cloud-Listen (Bring!, Todoist …) sind bei einem Verbindungsabriss kurz
  // "unavailable". Ein todo.add_item in dieser Zeit nimmt HA kommentarlos an und
  // verwirft es (nur eine Warnung im Log) — die Karte bekommt keinen Fehler zu sehen.
  // addItem prüft deshalb vorher, ob die Liste erreichbar ist, und schickt bei
  // Ausfall oder Fehler aus einer Warteschlange nach, sobald sie wieder da ist.
  // Die Warteschlange lebt im Speicher der Seite (gemeinsam für alle Karten);
  // ein Neuladen der Seite verwirft sie.
  const queue = (() => {
    const RETRY_MS = 10000;               // so oft wird nachgesehen, ob die Liste wieder da ist
    const MAX_AGE_MS = 6 * 3600 * 1000;   // danach aufgeben und Bescheid geben
    const KEEP_MS = 60000;                // so lange merkt sich addState den Ausgang
    const q = [];                         // { id, data, el, t, n, next }
    const done = new Map();               // id -> Zeitpunkt der Zustellung | "failed"
    let seq = 0, timer = null, busy = false, lastHass = null, lastNote = 0;
    const host = el => (el && el.isConnected ? el : document.querySelector("home-assistant"));
    const note = (el, msg) => u.toast(host(el), msg);
    const curHass = () => {
      try { const ha = document.querySelector("home-assistant"); if (ha && ha.hass) return ha.hass; } catch (e) {}
      return lastHass;
    };
    const emit = () => { try { window.dispatchEvent(new CustomEvent("fp-todo-queue")); } catch (e) {} };
    const forget = id => setTimeout(() => done.delete(id), KEEP_MS);
    // Liste erreichbar? Fehlt sie (noch nicht geladen) oder ist sie "unavailable", nein.
    const listUp = (hass, ent) => {
      const s = hass && hass.states ? hass.states[ent] : null;
      return !!s && s.state !== "unavailable";
    };
    const schedule = ms => { if (!timer && q.length) timer = setTimeout(pump, ms == null ? RETRY_MS : ms); };
    async function pump() {
      timer = null;
      if (busy) return;
      busy = true;
      const delivered = [];
      try {
        const hass = curHass(), now = Date.now();
        for (const e of [...q]) {
          if (now - e.t > MAX_AGE_MS) {
            q.splice(q.indexOf(e), 1); done.set(e.id, "failed"); forget(e.id);
            note(e.el, `„${e.data.item}“ konnte nicht angelegt werden – die Liste war zu lange nicht erreichbar`);
            continue;
          }
          if (now < e.next || !hass || !listUp(hass, e.data.entity_id)) continue;
          try {
            await hass.callService("todo", "add_item", e.data);
            q.splice(q.indexOf(e), 1); done.set(e.id, Date.now()); forget(e.id); delivered.push(e);
          } catch (err) {
            e.n++; e.next = Date.now() + Math.min(RETRY_MS * Math.pow(2, e.n), 120000);   // Fehler trotz Verbindung: langsamer nachfassen
          }
        }
      } finally {
        busy = false;
        if (delivered.length) {
          const last = delivered[delivered.length - 1];
          note(last.el, delivered.length === 1 ? `„${last.data.item}“ nachgetragen` : `${delivered.length} Einträge nachgetragen`);
        }
        emit();
        schedule();
      }
    }
    const enqueue = (id, el, data) => {
      q.push({ id, data, el, t: Date.now(), n: 0, next: 0 });
      // pro Ausfall nur ein Hinweis, nicht für jeden Eintrag
      if (Date.now() - lastNote > 30000) { lastNote = Date.now(); note(el, `Liste gerade nicht erreichbar – „${data.item}“ wird nachgeschickt`); }
      emit();
      schedule();
    };
    return {
      // Legt data (entity_id, item, …) auf die Liste. Liefert sofort { id, done };
      // done wird zu "sent" (zugestellt) oder "queued" (wartet auf die Liste).
      addItem(el, hass, data) {
        const id = "fpq-" + (++seq);
        if (hass) lastHass = hass;
        const h = curHass() || hass;
        if (!h || !listUp(h, data.entity_id)) { enqueue(id, el, data); return { id, done: Promise.resolve("queued") }; }
        const p = h.callService("todo", "add_item", data).then(
          () => { done.set(id, Date.now()); forget(id); return "sent"; },
          err => { console.warn("[fp] Anlegen fehlgeschlagen, wird nachgeschickt:", data.entity_id, err); enqueue(id, el, data); return "queued"; });
        return { id, done: p };
      },
      // "queued" (wartet), Zeitpunkt der Zustellung, "failed" (aufgegeben) oder null (unbekannt/abgelaufen)
      addState(id) { return q.some(e => e.id === id) ? "queued" : (done.get(id) || null); },
      // Namen der Einträge, die für diese Liste noch warten
      addPending(ent) { return q.filter(e => e.data.entity_id === ent).map(e => String(e.data.item)); },
      listUp,
    };
  })();
  for (const k of Object.keys(queue)) if (!(k in u)) u[k] = queue[k];

  // ---------- Hinweise bei offenem Dialog auch im Dialog zeigen ----------
  // Home Assistant zeigt seinen Hinweis (hass-notification) nicht in der obersten Ebene: unter einem offenen modalen
  // Dialog (U.lightbox) bleibt er verdeckt, "Änderung fehlgeschlagen" oder "Bitte ein Datum wählen" wären nicht zu sehen.
  // Solange ein modaler Dialog offen ist, erscheint jeder Hinweis deshalb zusätzlich als kleine Pille unten mittig im
  // obersten Dialog (Text aus detail.message, bei einer action mit Knopf, der sie aufruft). toast/undo bleiben unberührt:
  // Auf dem Beta-Dashboard stammen sie aus der zuerst geladenen Datei. Darum gibt es genau einen Zuhörer je Seite (globale
  // Marke window.__fpLbToast), egal welche Datei ihn anlegt. Das Ereignis wird nicht gestoppt, Home Assistant zeigt seinen
  // Hinweis weiter (sichtbar, sobald der Dialog zu ist). Capture-Phase, damit ein stopPropagation weiter unten im Baum den
  // Zuhörer nicht umgeht. Die Pille hängt als zusätzliches Kind im Dialog; der Beobachter der lightbox schaut nur, ob ov noch
  // im Dialog steckt, und reagiert deshalb weder auf ihr Kommen noch auf ihr Gehen.
  if (!window.__fpLbToast) {
    try {
      const STD_MS = 4000, MAX_MS = 8000;
      let akt = null;   // die Pille, die gerade steht: { weg }
      // Oberster offener, modaler Dialog: der letzte in der Liste, den es noch gibt (die lightbox führt sie).
      const oberster = () => {
        const l = window.__fpLbOpen;
        if (!Array.isArray(l)) return null;
        for (let i = l.length - 1; i >= 0; i--) {
          const d = l[i];
          if (!d || !d.isConnected || !d.open) continue;
          let modal = true;
          try { modal = d.matches(":modal"); } catch (e) {}   // ":modal" unbekannt: dann gilt "offen" als modal
          if (modal) return d;
        }
        return null;
      };
      const zeige = (dlg, det) => {
        const msg = det && det.message;
        if (typeof msg !== "string" || !msg.trim()) return;
        const act = det.action && typeof det.action.action === "function" ? det.action : null;
        const dauer = Number(det.duration);
        const ms = isFinite(dauer) && dauer > 0 ? Math.min(dauer, MAX_MS) : STD_MS;
        // Ein Rückgängig-Knopf soll nur einmal wirken: Home Assistant zeigt denselben Hinweis nach dem Schließen des Dialogs
        // noch einmal mit Knopf, und ein zweiter Tipp würde sonst ein zweites Mal rückgängig machen.
        if (act && !act.action._fpEinmal) {
          const orig = act.action; let schon = false;
          const einmal = function () { if (schon) return; schon = true; return orig.apply(act, arguments); };
          einmal._fpEinmal = true;
          try { act.action = einmal; } catch (e) {}
        }
        if (akt) akt.weg();   // der neue ersetzt den alten
        // Behälter mit role="status" zuerst leer einhängen, Inhalt einen Augenblick später: so liest ein Screenreader den Text vor.
        const wrap = document.createElement("div");
        wrap.className = "fp-lb-toast";
        wrap.setAttribute("role", "status");
        wrap.setAttribute("aria-live", "polite");
        wrap.setAttribute("aria-atomic", "true");
        wrap.style.cssText = "position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom, 0px));z-index:2147483647;display:flex;justify-content:center;box-sizing:border-box;margin:0;padding:0 16px;pointer-events:none;";
        let tFuell = 0, tEnde = 0;
        const me = { weg: () => {
          clearTimeout(tFuell); clearTimeout(tEnde);
          wrap.remove();
          if (akt === me) akt = null;
          if (dlg._fpHinweisWeg === me.weg) dlg._fpHinweisWeg = null;
        } };
        akt = me; dlg._fpHinweisWeg = me.weg;
        dlg.appendChild(wrap);
        tFuell = setTimeout(() => {
          const pille = document.createElement("div");
          pille.style.cssText = "pointer-events:auto;display:inline-flex;align-items:center;gap:12px;box-sizing:border-box;max-width:min(100%,480px);min-height:40px;padding:8px 18px;border-radius:999px;background:var(--primary-text-color);color:var(--card-background-color);box-shadow:0 6px 24px rgba(0,0,0,.35);font-size:14px;font-weight:500;line-height:1.35;text-align:left;text-shadow:none;letter-spacing:normal;text-transform:none;white-space:normal;overflow-wrap:anywhere;cursor:pointer;";
          const tx = document.createElement("span");
          tx.textContent = msg;
          pille.appendChild(tx);
          if (act) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = String(act.text || "OK");
            b.style.cssText = "flex:none;min-height:32px;margin:-6px -8px -6px 0;padding:6px 8px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;";
            b.addEventListener("click", ev => {
              ev.stopPropagation();
              me.weg();
              try { act.action(); } catch (e) { console.warn("[fp-lightbox] Knopf im Hinweis fehlgeschlagen:", e); }
            });
            pille.appendChild(b);
          }
          pille.addEventListener("click", ev => { ev.stopPropagation(); me.weg(); });
          wrap.appendChild(pille);
          try { if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) pille.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" }); } catch (e) {}
        }, 30);
        tEnde = setTimeout(me.weg, ms);
      };
      window.__fpLbToast = { zeige, oberster };
      window.addEventListener("hass-notification", ev => {
        try {
          const dlg = oberster();
          if (dlg) zeige(dlg, ev.detail);
        } catch (e) { console.warn("[fp-lightbox] Hinweis im Dialog fehlgeschlagen:", e); }
      }, true);
    } catch (e) { console.warn("[fp-lightbox] Hinweise im Dialog nicht verfügbar:", e); }
  }

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

  // Nachfassen fuer Symbole, die zu frueh gefragt haben.
  //
  // ha-icon loest den Symbolsatz nur auf, wenn sich seine icon-Eigenschaft
  // aendert. Die Tab-Leiste des Dashboards wird aber gezeichnet, bevor die
  // Lovelace-Ressourcen geladen sind — zu dem Zeitpunkt kennt niemand den
  // Praefix "fp". ha-icon schaltet dann auf seinen Altpfad um und rendert ein
  // <iron-icon>, das es in modernen Versionen gar nicht mehr gibt: leere
  // Stelle, kein zweiter Versuch. Karten im View entstehen spaeter und sind
  // deshalb in Ordnung — genau das Muster "Ueberschrift ja, Tab nein".
  //
  // Wir stupsen daher die kaputten Elemente einmal an. Erkennbar sind sie am
  // <iron-icon> in ihrem Schattenbaum — an internen Feldnamen haengt hier
  // nichts, die koennen minifiziert sein.
  const nachfassen = () => {
    const treffer = [];
    const lauf = (n, tiefe) => {
      if (!n || tiefe > 30) return;
      if (n.localName === "ha-icon" && typeof n.icon === "string" && n.icon.startsWith("fp:")
          && n.shadowRoot && n.shadowRoot.querySelector("iron-icon")) treffer.push(n);
      const kinder = n.children ? Array.from(n.children) : [];
      if (n.shadowRoot) kinder.push(...Array.from(n.shadowRoot.children));
      for (const k of kinder) lauf(k, tiefe + 1);
    };
    try { lauf(document.body, 0); } catch (e) { return; }
    for (const el of treffer) {
      const wunsch = el.icon;
      // Erst ein echtes MDI-Symbol: das nimmt den anderen Zweig in ha-icon und
      // loescht den Altpfad-Zustand. Danach zurueck auf unseres. Zwei getrennte
      // Durchlaeufe sind noetig, sonst fasst Lit beide Zuweisungen zusammen.
      el.icon = "mdi:magnify";
      Promise.resolve(el.updateComplete).then(() => { el.icon = wunsch; }).catch(() => {});
    }
  };
  // Dreimal, weil die Leiste je nach Geraet unterschiedlich frueh steht.
  // Wer schon sitzt, wird nicht angefasst — die Suche findet nur Kaputtes.
  for (const ms of [0, 500, 2000]) setTimeout(nachfassen, ms);
})();

/* ===== meal-grid-card v34 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: Heute groß: oben so viel Luft wie seitlich, Nächste Tage enger; davor: Kopf mit „📖 Kochbuch“, wenn cookbook_path gesetzt ist; davor: am Tablet als Tabelle: Tage als Zeilen, Mahlzeiten als Spalten mit Punkt nur im Kopf, leer als leises ＋; davor: Nächste Tage zeigen alles Geplante je Tag; davor: Liste nach Tagen als Vorgabe, layout: today für „Heute groß, Woche kurz“ mit days_ahead, layout: grid für die alte Tabelle, schlichter Kopf mit ‹ Woche ›, Mahlzeiten nur als Punkt (fp-meal0–2), feste Farben im Dialog durch Theme-Werte ersetzt; davor: auf schmalen Karten gedreht, Heute als Ring, Feldfarbe je Mahlzeit, meal_labels und empty_text, hide_header, „Zum Rezept“ springt ins eigene Kochbuch, sonst Web-Suche) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class MealGridCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Wochenplan", mode: "week", week_offset: 0, nav_path: "",
      layout: "list",                       // Wochenansicht: "list" (Liste nach Tagen, ab 640 px als Tabelle), "today" (Heute groß, Woche kurz) oder "grid" (Tabelle)
      days_ahead: 4,                        // nur layout "today": wie viele Tage nach heute in der kurzen Liste stehen
      show_emojis: true, meal_icons: true, background: "",
      ai_suggest: true, ai_entity: "", recipe_url: "https://www.chefkoch.de/rs/s0/{q}/Rezepte.html",
      hide_header: false,                   // Wochenansicht ohne Kopfleiste und Wochennavigation (fuer die Uebersicht)
      meal_labels: true,                    // Beschriftung neben dem Mahlzeit-Symbol
      empty_text: "＋",                     // was in einer leeren Zelle steht (leise dargestellt)
      cookbook_entity: "todo.kochbuch", weather_entity: "weather.home", cookbook_path: "",
      meals: [
        { label: "Frühstück", start: 0, end: 11 },
        { label: "Mittag", start: 11, end: 15 },
        { label: "Abend", start: 15, end: 24 },
      ],
    }, config || {});
    if (!this.config.entity) throw new Error("Bitte 'entity' (einen Kalender) angeben");
    this._titleSet = !!(config && config.title); // „Essen heute“ nur, wenn kein eigener Titel gesetzt ist
    this._offset = this.config.week_offset || 0;
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
  }
  set hass(hass) { this._hass = hass; this._maybeFetch(); }
  // Darstellung: compact (Heute/Morgen, Altbestand) ignoriert layout; sonst list (Vorgabe), today oder grid.
  _layout() {
    if (this.config.mode === "compact") return "compact";
    const l = this.config.layout;
    return l === "grid" || l === "today" ? l : "list";
  }
  // Grid: unter 560 px (Handy) wird das Raster gedreht, sieben Spalten wären dort zu schmal für die Gerichte.
  // Today: unter ca. 110 px je Mahlzeit stehen die Mahlzeiten untereinander statt nebeneinander.
  // List: ab 640 px (bei mehr als drei Mahlzeiten entsprechend breiter) steht statt der Liste eine Tabelle,
  // Tage als Zeilen, Mahlzeiten als Spalten. Darunter bleibt die Liste nach Tagen, in jeder Breite brauchbar.
  // Gemessen wird wie beim Raster an der Breite der Karte selbst: Ein Container mit container-type würde
  // in schrumpfenden Umgebungen (horizontal-stack) auf Breite 0 fallen, und die Liste braucht kein zweites DOM.
  // Neu zeichnen nur, wenn die Breite die Schwelle überschreitet.
  _istSchmal() {
    const l = this._layout(), w = this.clientWidth;
    if (!(w > 0) || (l !== "grid" && l !== "today")) return false;
    return l === "today" ? w < 110 * Math.max(1, (this.config.meals || []).length) : w < 560;
  }
  _istBreit() {
    const w = this.clientWidth, n = (this.config.meals || []).length;
    return this._layout() === "list" && n > 0 && w >= Math.max(640, 160 + 160 * n);
  }
  _daysAhead() { const n = Number(this.config.days_ahead); return Number.isFinite(n) ? Math.max(0, Math.min(13, Math.floor(n))) : 4; }
  connectedCallback() {
    // Als Block, sonst ist das Element inline: Breite 0 und kein ResizeObserver-Signal.
    if (!this.style.display) this.style.display = "block";
    if (!this._ro && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => { if (this._istSchmal() !== !!this._quer || this._istBreit() !== !!this._breit) this._render(); });
      this._ro.observe(this);
    }
  }
  disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }

  _range() {
    const now = new Date();
    let startDate, days;
    if (this.config.mode === "compact") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); days = 2;
    } else if (this._layout() === "today") {
      // heute plus die nächsten Tage, dürfen in die nächste Woche reichen
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); days = 1 + this._daysAhead();
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
  async _createEvent(meal, date, text, evForTime) {
    let hour = this._mealHour(meal), mins = 0;
    if (evForTime && evForTime.start) { const d = new Date(evForTime.start); hour = d.getHours(); mins = d.getMinutes(); }
    const sd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, mins);
    const ed = new Date(sd.getTime() + 3600000); // +1h, rollt korrekt über Mitternacht
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this.config.entity, summary: text, start_date_time: U.haZeit(sd), end_date_time: U.haZeit(ed) });
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
    const close = () => { this._editing = false; if (ov.parentNode) ov.parentNode.removeChild(ov); this._render(); };
    ov.appendChild(box); U.lightbox(this, ov, close);
    this._editing = true; // blockiert Re-Renders, solange der Dialog offen ist
    setTimeout(() => { input.focus(); input.select(); }, 30);
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
    const layout = this._layout();
    const meals = this.config.meals;
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const mn = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
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
    const wd = d => dn[(d.getDay() + 6) % 7];
    const colLabel = (d, i) => compact ? (i === 0 ? "Heute" : "Morgen") : wd(d);
    const quer = this._quer = this._istSchmal();
    const breit = this._breit = this._istBreit();

    // ---------- Kopf ----------
    // Woche füllen / Leeren sitzen als kleine Pillen im Kopf (nicht in „Heute groß“: dort ist keine ganze Woche geladen)
    const ki = (!compact && layout !== "today" && this.config.ai_suggest)
      ? `<button class="mg-fill">${CP(0x2728)} Woche füllen</button><button class="mg-clear">${CP(0x1F5D1)} Leeren</button>` : "";
    const aktionen = ki ? `<div class="mg-acts">${ki}</div>` : "";
    let head = "";
    if (compact) {
      if (this.config.title) head = `<div class="mg-h">${this._esc(this.config.title)}</div>`;
    } else if (this.config.hide_header) {
      // ohne Kopf, aber die Aktionen gehen nicht verloren (vorher eigene Reihe unter dem Kopf)
      head = aktionen ? `<div class="mg-head mg-head-a">${aktionen}</div>` : "";
    } else if (layout === "today") {
      const t = this._titleSet ? this.config.title : "Essen heute";
      head = `<div class="mg-head"><div class="mg-title">${this._esc(t)}</div><span class="mg-dp">${wd(cols[0])}, ${cols[0].getDate()}. ${mn[cols[0].getMonth()]}</span></div>`;
    } else {
      const a = cols[0], b = cols[cols.length - 1];
      const range = a.getMonth() === b.getMonth()
        ? `${a.getDate()}.–${b.getDate()}. ${mn[b.getMonth()]}`
        : `${a.getDate()}. ${mn[a.getMonth()]} – ${b.getDate()}. ${mn[b.getMonth()]}`;
      const heute = this._offset !== 0 ? `<button class="mg-today-btn" data-d="0" title="Aktuelle Woche">Heute</button>` : "";
      // „📖 Kochbuch“ führt zur Kochbuch-Unteransicht; steht vor den Aktionen, damit es beim Umbruch in der ersten Reihe bleibt
      // und nicht neben dem „Leeren“ sitzt. Nur im vollen Kopf (nicht bei hide_header, nicht in „Heute groß“).
      const buch = this.config.cookbook_path ? `<button class="mg-book">${CP(0x1F4D6)} Kochbuch</button>` : "";
      const acts = (buch || ki) ? `<div class="mg-acts${buch && ki ? " mg-acts3" : ""}">${buch}${ki}</div>` : "";
      head = `<div class="mg-head"><div class="mg-title">${this._esc(this.config.title)}</div>
        <div class="mg-hr">${heute}<div class="mg-wk">
          <button class="mg-nav" data-d="-1" title="Vorige Woche" aria-label="Vorige Woche">${CP(0x2039)}</button>
          <span class="mg-range">${range}</span>
          <button class="mg-nav" data-d="1" title="Nächste Woche" aria-label="Nächste Woche">${CP(0x203A)}</button>
        </div></div>${acts}</div>`;
    }

    // ---------- Bausteine ----------
    // Gerichte einer Zelle (mit Emoji), mehrere Einträge getrennt durch sep
    const gericht = (mi, ci, sep) => cells[mi][ci].filter(o => o.summary).map(o => {
      const em = this.config.show_emojis ? this._food(o.summary) : "";
      return (em ? `<span class="mg-em">${em}</span>` : "") + this._esc(o.summary);
    }).join(sep);
    const leer = this._esc(this.config.empty_text);
    // Punktfarbe: fp-meal0..2, ab der vierten Mahlzeit wie die dritte
    const dcls = mi => `mg-d${Math.min(mi, 2)}`;
    const lblOn = this.config.meal_labels !== false;

    // Tabelle (layout: grid und mode: compact)
    const tabelle = () => {
      const kopfMahlzeit = (m, cls) => {
        const ic = this.config.meal_icons ? `<div class="mg-meal-ic">${this._mealIcon(m.label)}</div>` : "";
        const tx = this.config.meal_labels ? `<div class="mg-meal-tx">${this._esc(m.label)}</div>` : "";
        return `<th class="${cls}">${ic}${tx}</th>`;
      };
      const kopfTag = (d, i, cls) => `<th class="${cls} ${isToday(d) ? "mg-today" : ""}"><div class="mg-day">${colLabel(d, i)}</div><div class="mg-date">${d.getDate()}.${d.getMonth() + 1}.</div></th>`;
      const zelle = (mi, ci, d) => {
        const s = gericht(mi, ci, "<br>");
        const inner = s ? `<span>${s}</span>` : `<span class="mg-plus">${leer}</span>`;
        // mg-m<mi>: Feldfarbe je Mahlzeit, auch wenn die Mahlzeiten Spalten sind
        return `<td class="mg-cell mg-m${mi} ${isToday(d) ? "mg-today" : ""}" data-mi="${mi}" data-ci="${ci}">${inner}</td>`;
      };
      let t = `<div class="mg-wrap${head && !compact ? " mg-wrap-w" : ""}"><table class="mg${quer ? " mg-quer" : ""}"><thead><tr><th class="mg-corner"></th>`;
      if (quer) {
        meals.forEach(m => { t += kopfMahlzeit(m, "mg-meal-h"); });
        t += "</tr></thead><tbody>";
        cols.forEach((d, ci) => {
          t += `<tr>${kopfTag(d, ci, "mg-dayh")}${meals.map((m, mi) => zelle(mi, ci, d)).join("")}</tr>`;
        });
      } else {
        cols.forEach((d, i) => { t += kopfTag(d, i, ""); });
        t += "</tr></thead><tbody>";
        meals.forEach((m, mi) => {
          // Zeilenklasse: jede Mahlzeit darf eine eigene Feldfarbe bekommen
          t += `<tr class="mg-r${mi}">${kopfMahlzeit(m, "mg-meal")}${cols.map((d, ci) => zelle(mi, ci, d)).join("")}</tr>`;
        });
      }
      return t + "</tbody></table></div>";
    };

    // Liste nach Tagen (layout: list)
    const liste = () => {
      // feste Breite der Bezeichnung nach der längsten, damit die Gerichte bündig stehen
      const maxL = Math.max(4, ...meals.map(m => String(m.label || "").length));
      const zeile = (mi, ci) => {
        const s = gericht(mi, ci, " &middot; ");
        return `<button type="button" class="mg-cell mg-mr ${dcls(mi)}" data-mi="${mi}" data-ci="${ci}"><i class="mg-dot"></i>${lblOn ? `<span class="mg-lb">${this._esc(meals[mi].label)}</span>` : ""}<span class="mg-ds${s ? "" : " mg-e"}">${s || leer}</span></button>`;
      };
      return `<div class="mg-list" style="--mg-ll:${maxL}">` + cols.map((d, ci) => {
        const t = isToday(d);
        return `<div class="mg-dr${t ? " mg-today" : ""}"><div class="mg-dl"><div class="mg-dw">${t ? "Heute" : wd(d)}</div><div class="mg-dd">${d.getDate()}.${d.getMonth() + 1}.</div></div><div class="mg-dm">${meals.map((m, mi) => zeile(mi, ci)).join("")}</div></div>`;
      }).join("") + `</div>`;
    };

    // Liste als Tabelle (layout: list auf breiten Karten): Tage als Zeilen, Mahlzeiten als Spalten.
    // Punkt und Name stehen nur im Kopf, die Zellen zeigen das Gericht oder das leise ＋ und sind wie in der Liste antippbar.
    const listeBreit = () => {
      const kopf = `<div class="mg-tr mg-tk"><span></span>` + meals.map((m, mi) =>
        `<span class="mg-tmh ${dcls(mi)}"${lblOn ? "" : ` title="${this._esc(m.label)}"`}><i class="mg-dot"></i>${lblOn ? `<span class="mg-tml">${this._esc(m.label)}</span>` : ""}</span>`).join("") + `</div>`;
      const zelle = (mi, ci, d) => {
        const s = gericht(mi, ci, "<br>");
        // ohne Mahlzeit-Name in der Zelle braucht die Vorlesehilfe Tag und Mahlzeit am Knopf
        const klar = cells[mi][ci].filter(o => o.summary).map(o => o.summary).join(", ");
        const al = `${wd(d)} ${d.getDate()}.${d.getMonth() + 1}., ${meals[mi].label}: ${klar || "leer"}`;
        return `<button type="button" class="mg-cell mg-tz" data-mi="${mi}" data-ci="${ci}" aria-label="${this._esc(al)}"><span class="mg-tzs${s ? "" : " mg-e"}">${s || leer}</span></button>`;
      };
      return `<div class="mg-lt" style="--mg-n:${meals.length}">${kopf}` + cols.map((d, ci) => {
        const t = isToday(d);
        return `<div class="mg-tr${t ? " mg-today" : ""}"><div class="mg-tw"><div class="mg-dw">${t ? "Heute" : wd(d)}</div><div class="mg-dd">${d.getDate()}.${d.getMonth() + 1}.</div></div>${meals.map((m, mi) => zelle(mi, ci, d)).join("")}</div>`;
      }).join("") + `</div>`;
    };

    // Heute groß, Woche kurz (layout: today)
    const heuteGross = () => {
      const last = meals.length - 1;
      // ohne Kopf (hide_header) sitzt der Kasten ganz oben: dann gilt oben derselbe Rand wie seitlich
      let t = `<div class="mg-tbox${quer ? " mg-st" : ""}${head ? "" : " mg-tb0"}">` + meals.map((m, mi) => {
        const s = gericht(mi, 0, "<br>");
        return `<button type="button" class="mg-cell mg-tc ${dcls(mi)}" data-mi="${mi}" data-ci="0"><span class="mg-tl"><i class="mg-dot"></i>${this._esc(m.label)}</span><span class="mg-td${s ? "" : " mg-e"}">${s || leer}</span></button>`;
      }).join("") + `</div>`;
      if (cols.length > 1 && last >= 0) {
        // alles Geplante je Tag: eingetragene Mahlzeiten nebeneinander (Punkt + Gericht), leere fallen weg
        t += `<div class="mg-nt">Nächste Tage</div><div class="mg-nx">`
          + cols.slice(1).map((d, k) => {
            const ci = k + 1;
            const geplant = meals.map((m, mi) => ({ mi, s: gericht(mi, ci, " &middot; ") })).filter(x => x.s);
            const inhalt = geplant.length
              ? geplant.map(x => `<button type="button" class="mg-cell mg-nxg ${dcls(x.mi)}" data-mi="${x.mi}" data-ci="${ci}"><i class="mg-dot"></i><span class="mg-nxs">${x.s}</span></button>`).join("")
              : `<button type="button" class="mg-cell mg-nxg" data-mi="${last}" data-ci="${ci}"><span class="mg-nxs mg-e">noch nichts geplant</span></button>`;
            return `<div class="mg-nxr"><span class="mg-nxw">${wd(d)}</span><div class="mg-nxm">${inhalt}</div></div>`;
          }).join("") + `</div>`;
      }
      return t;
    };

    const body = (compact || layout === "grid") ? tabelle() : (layout === "today" ? heuteGross() : (breit ? listeBreit() : liste()));
    const html = `<ha-card class="mg-card">${head}${body}</ha-card>`;

    let bgImg = "";
    if (this.config.background) {
      const _b = this.config.background;
      const _isImg = /^(https?:|\/|data:)/.test(_b) || /\.(jpe?g|png|webp|gif|avif)/i.test(_b);
      if (_isImg) {
        // Altbestand: Bild mit dunklem Overlay und weißer Schrift. Die Variablen färben auch Kopf, Liste und Heute-Kasten um.
        bgImg = `.mg-card{background-image:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.72)),url('${_b}');background-size:cover;background-position:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);--primary-text-color:#fff;--secondary-text-color:rgba(255,255,255,.78);--divider-color:rgba(255,255,255,.28);--fp-surface:rgba(255,255,255,.16);--fp-surface-2:rgba(255,255,255,.26);--fp-accent:#fff;} .mg-card .mg-title,.mg-card .mg-range,.mg-card .mg-meal-tx{color:#fff;} .mg-card thead th,.mg-card thead .mg-day,.mg-card thead .mg-date{color:#fff !important;} .mg-card td.mg-cell{background:rgba(255,255,255,.14);font-weight:600;color:#fff !important;} .mg-card td.mg-cell span{color:#fff !important;} .mg-card .mg-plus{color:#fff !important;opacity:.65;} .mg-card td.mg-cell:hover{background:rgba(255,255,255,.26);} .mg-card .mg-today{--mg-cell-bg:rgba(255,255,255,.32);}`;
      } else {
        bgImg = `.mg-card{background:${_b};}`;
      }
    }
    const css = `
      /* Farben kommen aus dem Theme (--fp-*, HA-Variablen); was nach dem Komma steht, ist der Rückfall. */
      .mg-card{overflow:hidden;}
      .mg-h{padding:12px 16px 4px;font-size:1.25rem;font-weight:600;}
      /* Schlichter Kopf: Titel links, rechts die Wochen-Pille ‹ 13.–19. Okt ›, Aktionen als kleine Pillen; bricht am Handy um */
      .mg-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:14px 16px 8px;}
      .mg-head-a{padding:10px 16px 0;}
      .mg-title{flex:1 1 auto;min-width:0;font-size:1.05rem;font-weight:900;letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere;}
      .mg-hr{flex:none;display:flex;align-items:center;gap:6px;}
      .mg-wk{display:flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));}
      .mg-range{min-width:76px;padding:0 2px;text-align:center;font-size:.82rem;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;}
      .mg-nav{flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--primary-text-color);font-size:1.25rem;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .mg-nav:active{background:var(--fp-surface-2,var(--divider-color));}
      .mg-today-btn{flex:none;min-height:32px;padding:0 12px;border:none;border-radius:999px;background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 16%,transparent);color:var(--fp-accent,var(--primary-color));font-size:.76rem;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      /* max-width: drei Pillen dürfen auf schmalen Karten in der Reihe umbrechen statt überzulaufen */
      .mg-acts{flex:none;max-width:100%;display:flex;flex-wrap:wrap;gap:6px;}
      .mg-book,.mg-fill,.mg-clear{flex:none;min-height:32px;padding:0 12px;border:1px solid var(--divider-color);border-radius:999px;background:transparent;color:var(--secondary-text-color);font-size:.76rem;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      /* drei Pillen: auf Handybreite etwas enger, damit „Leeren“ nicht allein in eine dritte Reihe fällt (ab ca. 335 px Kartenbreite) */
      @media (max-width:420px){.mg-acts3{gap:5px;}.mg-acts3 .mg-book,.mg-acts3 .mg-fill,.mg-acts3 .mg-clear{padding:0 10px;}}
      .mg-fill:disabled,.mg-clear:disabled{opacity:.6;cursor:default;}
      @media (hover:hover){
        .mg-nav:hover{background:var(--fp-surface-2,var(--divider-color));}
        .mg-book:hover,.mg-fill:hover{color:var(--fp-accent,var(--primary-color));border-color:var(--fp-accent,var(--primary-color));}
        .mg-clear:hover{color:var(--error-color,#db4437);border-color:var(--error-color,#db4437);}
      }
      /* Datum als kleine Pille im Kopf von „Heute groß“ */
      .mg-dp{flex:none;padding:5px 12px;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));font-size:.78rem;font-weight:800;white-space:nowrap;}

      /* Punkt je Mahlzeit: fp-meal0/1/2, ab der vierten wie die dritte */
      .mg-d0{--mg-dot:var(--fp-meal0,#C9A15A);}
      .mg-d1{--mg-dot:var(--fp-meal1,#6E9A62);}
      .mg-d2{--mg-dot:var(--fp-meal2,#C97A3D);}
      .mg-dot{flex:none;display:block;width:8px;height:8px;border-radius:50%;background:var(--mg-dot);}
      .mg-em{margin-right:3px;}
      .mg-ds{flex:1 1 0;min-width:0;font-size:.9rem;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--primary-text-color);}
      .mg-e{font-weight:400;color:var(--secondary-text-color);opacity:.6;}

      /* Liste nach Tagen: Linien statt Kästen; Heute mit Strich am Kartenrand */
      .mg-list{padding:0 0 6px;}
      .mg-dr{position:relative;display:flex;align-items:flex-start;gap:12px;padding:6px 16px;box-sizing:border-box;}
      .mg-dr+.mg-dr,.mg-tr+.mg-tr{border-top:1px solid var(--divider-color);}
      .mg-dr.mg-today::before,.mg-tr.mg-today::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--fp-accent,var(--primary-color));}
      .mg-dl{flex:none;width:56px;padding-top:8px;line-height:1.2;}
      .mg-dw{font-size:.95rem;font-weight:800;}
      .mg-dd{margin-top:1px;font-size:.68rem;color:var(--secondary-text-color);font-variant-numeric:tabular-nums;}
      .mg-dr.mg-today .mg-dw,.mg-dr.mg-today .mg-dd,.mg-tr.mg-today .mg-dw,.mg-tr.mg-today .mg-dd{color:var(--fp-accent,var(--primary-color));}
      .mg-dm{flex:1 1 0;min-width:0;display:flex;flex-direction:column;}
      .mg-mr{display:flex;align-items:center;gap:8px;align-self:stretch;min-height:36px;box-sizing:border-box;margin:0 -8px;padding:0 8px;border:none;border-radius:var(--fp-radius-sm,12px);background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .mg-lb{flex:none;width:calc(var(--mg-ll,6) * .82em);max-width:96px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

      /* Liste als Tabelle (ab 640 px): Kopf mit Punkt und Name je Mahlzeit, je Tag eine Zeile, Zellen nur mit dem Gericht.
         Jede Zeile ist ein eigenes Raster mit gleichen Spalten, so liegen Kopf und Tage bündig und Heute lässt sich als ganze Zeile tönen. */
      .mg-lt{padding:0 0 6px;}
      .mg-tr{position:relative;display:grid;grid-template-columns:120px repeat(var(--mg-n,3),minmax(0,1fr));box-sizing:border-box;}
      .mg-tr.mg-today{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 12%,transparent);}
      .mg-tmh{display:flex;align-items:center;gap:8px;min-width:0;padding:6px 12px;}
      .mg-tml{min-width:0;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .mg-tw{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:10px 12px 10px 16px;line-height:1.2;}
      .mg-tz{display:flex;align-items:center;min-width:0;min-height:44px;box-sizing:border-box;margin:4px 2px;padding:6px 10px;border:none;border-radius:var(--fp-radius-sm,12px);background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .mg-tzs{min-width:0;font-size:.9rem;font-weight:700;line-height:1.3;overflow-wrap:break-word;hyphens:auto;color:var(--primary-text-color);}
      .mg-tzs.mg-e{font-weight:400;color:var(--secondary-text-color);}

      /* Heute groß: Mahlzeiten von heute nebeneinander in einem Kasten, darunter die nächsten Tage als kurze Liste */
      .mg-tbox{display:flex;margin:4px 16px 0;border:1px solid var(--divider-color);border-radius:var(--fp-radius-sm,12px);overflow:hidden;}
      .mg-tc{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;box-sizing:border-box;padding:12px;border:none;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .mg-tbox.mg-tb0{margin-top:16px;}
      .mg-tc+.mg-tc{border-left:1px solid var(--divider-color);}
      .mg-tbox.mg-st{flex-direction:column;}
      .mg-tbox.mg-st .mg-tc+.mg-tc{border-left:none;border-top:1px solid var(--divider-color);}
      .mg-tl{display:flex;align-items:center;gap:6px;max-width:100%;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);}
      .mg-td{max-width:100%;font-size:1rem;font-weight:900;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;hyphens:auto;color:var(--primary-text-color);}
      .mg-td.mg-e{font-weight:400;color:var(--secondary-text-color);}
      .mg-nt{margin:20px 16px 2px;font-size:.64rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--secondary-text-color);}
      .mg-nx{display:flex;flex-direction:column;padding:0 16px 6px;}
      /* Nächste Tage: links der Wochentag, rechts alle eingetragenen Mahlzeiten nebeneinander, bei Platzmangel umbrechend.
         Eine Zeile misst 36 px (Fläche 32 px + je 2 px Luft), umbrochene Gerichte im selben Abstand (4 px Lücke). Tag und Gericht teilen sich
         Schriftgröße und Zeilenhöhe, so stehen beide auf einer Grundlinie. */
      .mg-nxr{display:flex;align-items:flex-start;gap:12px;box-sizing:border-box;padding:2px 0;}
      .mg-nxw{flex:none;width:44px;min-height:32px;display:flex;align-items:center;font-size:.9rem;font-weight:800;line-height:1.25;}
      .mg-nxm{flex:1 1 0;min-width:0;margin-left:-8px;display:flex;flex-wrap:wrap;gap:4px 12px;}
      .mg-nxg{display:flex;align-items:center;gap:8px;box-sizing:border-box;min-width:0;max-width:100%;min-height:32px;padding:0 8px;border:none;border-radius:var(--fp-radius-sm,12px);background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .mg-nxs{min-width:0;font-size:.9rem;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--primary-text-color);}
      .mg-nxs.mg-e{font-weight:400;color:var(--secondary-text-color);}
      .mg-tc:active,.mg-mr:active,.mg-nxg:active,.mg-tz:active{background:var(--fp-surface,var(--secondary-background-color));}
      @media (hover:hover){.mg-tc:hover,.mg-mr:hover,.mg-nxg:hover,.mg-tz:hover{background:var(--fp-surface,var(--secondary-background-color));}}
      /* in der getönten Heute-Zeile hebt sich die Fläche nur durch etwas mehr Akzent ab */
      .mg-tr.mg-today .mg-tz:active{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 14%,transparent);}
      @media (hover:hover){.mg-tr.mg-today .mg-tz:hover{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 14%,transparent);}}

      /* Tabelle (layout: grid, mode: compact) */
      .mg-wrap{padding:14px 16px 18px;overflow-x:auto;}
      .mg-wrap.mg-wrap-w{padding-top:6px;}
      table.mg{width:100%;border-collapse:separate;border-spacing:7px;table-layout:fixed;}
      table.mg th,table.mg td{text-align:center;}
      table.mg thead th{font-size:.8rem;color:var(--secondary-text-color);padding:2px;}
      table.mg thead .mg-day{font-weight:700;color:var(--primary-text-color);}
      table.mg thead .mg-date{font-size:.7rem;}
      th.mg-meal{width:54px;}
      /* Gedrehte Ansicht (Handy): links der Tag, oben die Mahlzeiten */
      table.mg-quer{border-spacing:6px;}
      table.mg-quer th.mg-corner{width:44px;}
      table.mg-quer tbody th.mg-dayh{font-size:.8rem;color:var(--secondary-text-color);padding:2px;}
      table.mg-quer tbody th.mg-dayh .mg-day{font-weight:700;color:var(--primary-text-color);}
      table.mg-quer tbody th.mg-dayh .mg-date{font-size:.7rem;}
      table.mg-quer tbody th.mg-dayh.mg-today .mg-day,table.mg-quer tbody th.mg-dayh.mg-today .mg-date{color:var(--fp-head,var(--primary-color));}
      .mg-meal-ic{font-size:1.15rem;line-height:1.2;}
      .mg-meal-tx{font-size:.6rem;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.03em;}
      /* Feldfarbe je Mahlzeit: das Theme setzt fp-meal0/1/2-bg, ohne Theme
         bleiben alle drei Zeilen gleich (Tönung des Akzents). */
      tr.mg-r0,td.mg-m0{--mg-cell-bg:var(--fp-meal0-bg,color-mix(in srgb,var(--fp-accent,var(--primary-color)) 10%,transparent));}
      tr.mg-r1,td.mg-m1{--mg-cell-bg:var(--fp-meal1-bg,color-mix(in srgb,var(--fp-accent,var(--primary-color)) 10%,transparent));}
      tr.mg-r2,td.mg-m2{--mg-cell-bg:var(--fp-meal2-bg,color-mix(in srgb,var(--fp-accent,var(--primary-color)) 10%,transparent));}
      td.mg-cell{background:var(--mg-cell-bg,color-mix(in srgb,var(--fp-accent,var(--primary-color)) 10%,transparent));border:1px solid var(--fp-meal-border,var(--divider-color));border-radius:var(--fp-meal-radius,14px);min-height:var(--fp-meal-h,48px);height:var(--fp-meal-h,48px);padding:6px;font-size:.82rem;line-height:1.2;color:var(--primary-text-color);cursor:pointer;vertical-align:middle;transition:background .15s,transform .1s;}
      td.mg-cell:hover{background:var(--mg-cell-bg-hover,color-mix(in srgb,var(--fp-accent,var(--primary-color)) 20%,transparent));transform:translateY(-1px);}
      td.mg-cell span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .mg-plus{color:var(--secondary-text-color);opacity:.38;font-size:.78rem;font-weight:400;}
      /* Heute nicht mehr einfaerben — das uebermalte die Farbe der Mahlzeit.
         Stattdessen ein Ring um die Zelle und ein hervorgehobenes Datum. */
      td.mg-cell.mg-today{box-shadow:inset 0 0 0 2px var(--fp-head,var(--primary-color));}
      thead th.mg-today .mg-day,thead th.mg-today .mg-date{color:var(--fp-head,var(--primary-color));}
      th.mg-corner{width:54px;}

      /* Dialog */
      .mg-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9;}
      .mg-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,360px);border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);text-shadow:none;}
      .mg-modal-t{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .mg-input{width:100%;box-sizing:border-box;padding:11px 12px;font-size:1rem;border:1px solid var(--divider-color);border-radius:12px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);}
      .mg-suggest-row{margin-top:10px;}
      .mg-cook-row{margin-top:10px;}
      .mg-recipe-row{margin-top:10px;}
      .mg-recipe,.mg-tocook{width:100%;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font-weight:600;}
      .mg-suggest{width:100%;background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 16%,transparent);color:var(--fp-accent,var(--primary-color));font-weight:600;}
      .mg-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
      .mg-btn{border:none;border-radius:10px;padding:9px 14px;font-size:.9rem;cursor:pointer;}
      .mg-cancel{background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);}
      .mg-del{background:color-mix(in srgb,var(--error-color,#db4437) 15%,transparent);color:var(--error-color,#db4437);}
      .mg-save{background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));font-weight:700;}
      ${bgImg}
    `;
    this.innerHTML = `<style>${css}</style>${html}`;
    const kb = this.querySelector(".mg-book");
    if (kb) kb.addEventListener("click", () => this._nav(this.config.cookbook_path));
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
  getCardSize() {
    const l = this._layout(), n = (this.config.meals || []).length || 3;
    if (l === "compact") return 3;
    if (l === "today") return Math.ceil((60 + 90 + 40 + 36 * this._daysAhead()) / 50);
    if (l === "list") return Math.ceil((60 + 7 * (36 * n + 12)) / 50);
    return 6;
  }
}
if (!customElements.get("meal-grid-card")) {
  customElements.define("meal-grid-card", MealGridCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "meal-grid-card", name: "Meal Grid Card", description: "Wochenplan grid fed from a calendar" });
}
})();

/* ===== family-calendar-card v2.14 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Uhrzeit-Eingaben in der doppelten Stunde (Ende der Sommerzeit) eindeutig; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: Woche füllt die volle Breite, Tagesansicht ebenso, fill_height lässt die Karte bis zum Bildschirmrand reichen, Vorgaben day_start/day_end wieder wirksam; davor: schlichter Kopf statt Leiste: Titel, Ansichten als Segment, Datum als Pille, ＋ Termin in Akzent; Personenfilter als Chips mit Punkt; feste Farben durch Theme ersetzt; davor: Tagesansicht day mit Datumsleiste, am Tablet eine Spalte je Person mit Avatar, am Handy eine Zeitliste mit Personenfilter und Wischen zum Tageswechsel; Personenfilter mit Alle, Tippen auf freie Fläche legt an; Woche mit großen Terminkacheln, am Tablet eine Spalte je Tag, am Handy die Tage untereinander, Stundenraster mit week_grid; Datums- und Uhrzeitfelder passen aufs iPhone; durchlaufende Tage in der Ganztagszeile, mehrtägige Termine mit ab/bis je Tag, Termine mit Beginn- und Enddatum auch über Mitternacht; Mehrtagesansicht agenda mit days/hide_header/hide_legend; Farben über Theme-Variablen) ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
class FamilyCalendarCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      title: "Kalender", initial_view: "week",   // week | month | day | agenda
      day_start: 6, day_end: 23, persons: [],
      days: 4,                 // nur fuer initial_view: "agenda"
      hide_header: false,      // Kopfleiste mit Navigation und Ansichtswechsel
      hide_legend: false,      // Personenfilter unter der Kopfleiste
      week_grid: false,        // Woche als Stundenraster statt Terminkacheln
      fill_height: false,      // Karte reicht mindestens bis zum unteren Bildschirmrand (Tag, Woche, Monat)
    }, config || {});
    if (!this.config.persons || !this.config.persons.length) throw new Error("Bitte 'persons' konfigurieren");
    this._view = ["month", "agenda", "day"].includes(this.config.initial_view) ? this.config.initial_view : "week";
    this._offset = 0;
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
    this._hidden = this._loadHidden();
    this._filter = new Set(); // Personen-Chips in Tag und Woche; leer = alle
  }
  set hass(hass) { this._hass = hass; this._maybeFetch(); }
  _istSchmal() { return this.clientWidth > 0 && this.clientWidth < 560; }
  connectedCallback() {
    if (!this._clock) this._clock = setInterval(() => this._tickNow(), 60000);
    // Als Block, sonst ist das Element inline: Breite 0 und kein ResizeObserver-Signal.
    this.style.display = "block";
    if (!this._ro && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => { if (this._istSchmal() !== !!this._schmal) this._render(); });
      this._ro.observe(this);
    }
  }
  disconnectedCallback() {
    if (this._clock) { clearInterval(this._clock); this._clock = null; }
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }
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
    if (this._view === "day") {
      // _offset zaehlt hier Tage; geladen wird die ganze Woche der Datumsleiste
      const sel = new Date(now); sel.setDate(sel.getDate() + this._offset);
      const ws = new Date(sel); ws.setDate(ws.getDate() - (ws.getDay() + 6) % 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      return { start: ws, end: we, gridStart: ws, sel };
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

  _fetchSpan() {
    const r = this._range();
    const fs = this._view === "month" ? r.gridStart : r.start;
    const fe = this._view === "month" ? r.gridEnd : r.end;
    return { fs, fe, key: this._view + "|" + fs.toISOString() + "|" + fe.toISOString() };
  }
  // Nach Navigation: innerhalb des geladenen Zeitraums nur neu zeichnen
  _go() { if (this._events && this._fetchSpan().key === this._rangeKey) this._render(); else this._maybeFetch(true); }

  async _maybeFetch(force) {
    if (!this._hass) return;
    const { fs, fe, key } = this._fetchSpan();
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

  // alle: Legende ignorieren (Tag und Woche filtern ueber die Personen-Chips)
  _items(alle) {
    const out = []; this._evMap = {};
    (this._events || []).forEach(ev => {
      const cl = this._classify(ev); if (!cl) return;
      if (!alle && this._hidden.has(cl.person.name)) return;
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
      h += `<button class="fcc-chip${off}" data-person="${this._esc(p.name)}" aria-pressed="${!off}"><span class="fcc-dot" style="background:${p.color || "var(--secondary-text-color)"}"></span>${this._esc(p.name)}</button>`;
    });
    h += "</div>";
    return h;
  }

  _zeigt(p) { return !this._filter.size || this._filter.has(p.name); }
  _kannAnlegen() { return this.config.persons.some(p => p.calendar && !p.no_create); }
  _addBtnHTML() { return this._kannAnlegen() ? `<button class="fcc-btn fcc-add" aria-label="Neuer Termin"><span class="fcc-add-i">+</span>Termin</button>` : ""; }

  // Neuer Termin: Tag aus der Ansicht (oder dataset), Person aus dem Filter,
  // wenn genau eine gewaehlt ist. Heute: naechste volle Stunde, sonst 9 Uhr.
  _neuerTermin(dateIso, person) {
    const n = new Date(); const heute = new Date(n); heute.setHours(0, 0, 0, 0);
    const iso = d => `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}`;
    if (!dateIso) {
      const r = this._range();
      const d = this._view === "day" ? r.sel : (r.start <= heute && heute < r.end ? heute : r.start);
      dateIso = iso(d);
    }
    if (!person && this._filter.size === 1) person = [...this._filter][0];
    this._openEvent({ dateIso, hour: dateIso === iso(heute) ? Math.min(22, n.getHours() + 1) : 9, personName: person || null });
  }

  // Kurzer Zeitraum für die Datumspille: „12.–18. Okt“, am Tag „Mi, 14. Okt“;
  // der Monat bleibt wie die Ansicht ihn liefert. Ein fremdes Jahr steht dabei.
  _rangeKurz(label) {
    const mn = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    if (this._view === "month") return label;
    const r = this._range();
    const jahr = d => d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "";
    if (this._view === "day") { const s = r.sel; return `${wd[s.getDay()]}, ${s.getDate()}. ${mn[s.getMonth()]}${jahr(s)}`; }
    const a = r.start, b = new Date(r.end); b.setDate(b.getDate() - 1);
    if (this._sameDay(a, b)) return `${a.getDate()}. ${mn[a.getMonth()]}${jahr(a)}`;
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}.–${b.getDate()}. ${mn[b.getMonth()]}${jahr(b)}`
      : `${a.getDate()}. ${mn[a.getMonth()]} – ${b.getDate()}. ${mn[b.getMonth()]}${jahr(b)}`;
  }

  // Schlichter Kopf: Titel, Ansichten als Segment, Datum als Pille, „Heute“ nur abseits der aktuellen Periode, ＋ Termin rechts
  _headerHTML(label) {
    const heute = this._offset !== 0 ? `<button class="fcc-btn fcc-today" data-d="0" title="Zur aktuellen Periode">Heute</button>` : "";
    return `<div class="fcc-bar">
      <div class="fcc-title">${this._esc(this.config.title)}</div>
      <div class="fcc-views" role="group" aria-label="Ansicht">
        <button class="fcc-btn fcc-vw${this._view === "day" ? " fcc-vw-on" : ""}" data-v="day">Tag</button>
        <button class="fcc-btn fcc-vw${this._view === "week" ? " fcc-vw-on" : ""}" data-v="week">Woche</button>
        <button class="fcc-btn fcc-vw${this._view === "month" ? " fcc-vw-on" : ""}" data-v="month">Monat</button>
      </div>
      <div class="fcc-nav">
        <button class="fcc-btn fcc-nav-b" data-d="-1" aria-label="Zurück">${CP(0x2039)}</button>
        <span class="fcc-range">${this._esc(this._rangeKurz(label))}</span>
        <button class="fcc-btn fcc-nav-b" data-d="1" aria-label="Weiter">${CP(0x203A)}</button>
      </div>
      ${heute}
      ${this._addBtnHTML()}
    </div>`;
  }

  _avatar(p) {
    const c = p.color || "#888888";
    let pic = p.picture || "";
    const st = p.entity && this._hass && this._hass.states[p.entity];
    if (!pic && st) pic = st.attributes.entity_picture || "";
    if (pic) return `<span class="fcc-dy-av" style="background-image:url('${this._esc(pic)}');border-color:${c}"></span>`;
    const ini = String(p.name || "?").trim().charAt(0).toUpperCase();
    return `<span class="fcc-dy-av" style="background:${c};border-color:${c};color:${this._textOn(c)}">${this._esc(ini)}</span>`;
  }

  // Tagesansicht: Datumsleiste oben, darunter eine Spalte je Person mit
  // grossen, gut lesbaren Terminkarten in der Personenfarbe.
  _dayHTML() {
    const r = this._range(), sel = r.sel;
    const selEnd = new Date(sel); selEnd.setDate(selEnd.getDate() + 1);
    const items = this._items(true);
    const now = new Date();
    const heute = new Date(now); heute.setHours(0, 0, 0, 0);
    const hhmm = t => `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`;
    const kurz = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const selIdx = (sel.getDay() + 6) % 7;
    const alleLeute = this.config.persons.filter(p => !p.no_create);

    let strip = `<div class="fcc-dy-strip"><button class="fcc-dy-arr" data-o="${this._offset - 7}">${CP(0x2039)}</button>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(r.start); d.setDate(d.getDate() + i);
      const de = new Date(d); de.setDate(de.getDate() + 1);
      const hat = items.some(it => !it.person.no_create && this._zeigt(it.person) && it.start < de && it.end > d);
      const cls = (i === selIdx ? " fcc-dy-sel" : "") + (this._sameDay(d, heute) ? " fcc-dy-today" : "");
      strip += `<button class="fcc-dy-d${cls}" data-o="${this._offset + i - selIdx}"><span class="fcc-dy-wd">${kurz[i]}</span><span class="fcc-dy-n">${d.getDate()}</span><span class="fcc-dy-dot${hat ? "" : " fcc-dy-leer"}"></span></button>`;
    }
    strip += `<button class="fcc-dy-arr" data-o="${this._offset + 7}">${CP(0x203A)}</button></div>`;

    const label = sel.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    let html = this._chipsHTML(alleLeute) + strip;
    if (this.config.hide_header) html += `<div class="fcc-dy-title">${this._sameDay(sel, heute) ? '<span class="fcc-dy-badge">Heute</span>' : ""}${this._esc(label)}</div>`;

    const amTag = items.filter(it => it.start < selEnd && it.end > sel)
      .sort((a, b) => (a.allDay === b.allDay) ? (a.start - b.start || a.end - b.end) : (a.allDay ? -1 : 1));
    // Personen ohne eigene Termine (no_create, z. B. Feiertage) als Zeile ueber den Spalten
    const extra = amTag.filter(it => it.person.no_create);
    if (extra.length) {
      html += '<div class="fcc-dy-extra">' + extra.map(it => `<span class="fcc-dy-chip" data-key="${this._esc(it.key)}" data-ent="${it.entity}"><span class="fcc-dot" style="background:${it.person.color}"></span>${this._esc(it.display)}</span>`).join("") + "</div>";
    }

    const ds = `${sel.getFullYear()}-${this._pad(sel.getMonth() + 1)}-${this._pad(sel.getDate())}`;
    const zeitVon = it => {
      const ab = it.start >= sel, bis = it.end <= selEnd;
      if (it.allDay || (!ab && !bis)) return "ganztägig";
      if (ab && bis) return it.end - it.start > 0 ? `${hhmm(it.start)} – ${hhmm(it.end)}` : hhmm(it.start);
      return ab ? "ab " + hhmm(it.start) : "bis " + hhmm(it.end);
    };
    const leute = alleLeute.filter(p => this._zeigt(p));
    if (this._schmal) return { label, html: `<div class="fcc-dy fcc-dy-mob">${html}${this._dayListHTML(amTag.filter(it => !it.person.no_create), leute, sel)}</div>` };
    html += '<div class="fcc-dy-cols">';
    leute.forEach(p => {
      const c = p.color || "#888888";
      const list = amTag.filter(it => it.person === p);
      html += `<div class="fcc-dy-col" data-date="${ds}" data-person="${this._esc(p.name)}"><div class="fcc-dy-h" style="border-bottom-color:${c}">${this._avatar(p)}<span class="fcc-dy-name">${this._esc(p.name)}</span>`
        + "</div>";
      if (!list.length) html += '<div class="fcc-dy-free">frei</div>';
      list.forEach(it => {
        const zeit = zeitVon(it);
        const vorbei = it.allDay ? it.end <= heute : it.end <= now;
        const laeuft = !it.allDay && it.start <= now && it.end > now;
        html += `<div class="fcc-dy-ev${vorbei ? " fcc-dy-done" : ""}${laeuft ? " fcc-dy-now" : ""}" data-key="${this._esc(it.key)}" data-ent="${it.entity}" style="background:${this._rgba(c, 0.22)};--c:${c}">`
          + `<div class="fcc-dy-s">${this._esc(it.display)}</div><div class="fcc-dy-t">${this._esc(zeit)}</div>`
          + (vorbei ? `<span class="fcc-dy-ok" style="background:${c};color:${this._textOn(c)}">${CP(0x2713)}</span>` : "")
          + "</div>";
      });
      html += "</div>";
    });
    html += "</div>";
    return { label, html: `<div class="fcc-dy">${html}</div>` };
  }

  // Personenfilter als Chips (Punkt in der Personenfarbe + Name, gewählt = gefüllt),
  // dazu "Alle". Mehrfachauswahl; ohne Auswahl ist niemand ausgefiltert.
  _chipsHTML(leute) {
    [...this._filter].forEach(n => { if (!leute.some(p => p.name === n)) this._filter.delete(n); });
    let h = `<div class="fcc-flt" role="group" aria-label="Personen filtern"><button class="fcc-fc fcc-fc-alle${this._filter.size ? "" : " fcc-fc-on"}" data-person="" aria-pressed="${!this._filter.size}">Alle</button>`;
    leute.forEach(p => {
      const on = this._filter.has(p.name);
      h += `<button class="fcc-fc${on ? " fcc-fc-on" : ""}" data-person="${this._esc(p.name)}" aria-pressed="${on}"><span class="fcc-dot" style="background:${p.color || "var(--secondary-text-color)"}"></span><span>${this._esc(p.name)}</span></button>`;
    });
    if (this.config.hide_header) h += this._addBtnHTML();
    return h + "</div>";
  }

  // Zeitliste eines Tages: Ganztaegiges oben, dann nach Uhrzeit mit Jetzt-Linie.
  // liste enthaelt nur Termine, die an diesem Tag liegen.
  _listRows(liste, tag) {
    const now = new Date();
    const heute = new Date(now); heute.setHours(0, 0, 0, 0);
    const tagEnde = new Date(tag); tagEnde.setDate(tagEnde.getDate() + 1);
    const morgenEnde = new Date(tagEnde); morgenEnde.setDate(morgenEnde.getDate() + 1);
    const hhmm = t => `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`;
    const istGanz = it => it.allDay || (it.start <= tag && it.end >= tagEnde);
    const marke = it => `<span class="fcc-dy-who1"><span class="fcc-dot" style="background:${it.person.color}"></span>${this._esc(it.person.name)}</span>`;
    let h = "";
    liste.filter(istGanz).forEach(it => {
      const c = it.person.color || "#888888";
      h += `<div class="fcc-dy-ev fcc-dy-ganz${(it.end <= heute) ? " fcc-dy-done" : ""}" data-key="${this._esc(it.key)}" data-ent="${it.entity}" style="background:${this._rgba(c, 0.22)};border-left-color:${c};--c:${c}">`
        + `<div class="fcc-dy-s">${this._esc(it.display)}</div><div class="fcc-dy-meta">${marke(it)}<span>ganztägig</span></div></div>`;
    });
    const zeit = liste.filter(it => !istGanz(it));
    let jetztGesetzt = !this._sameDay(tag, heute);
    const jetzt = `<div class="fcc-dy-jetzt"><span>${hhmm(now)}</span></div>`;
    zeit.forEach(it => {
      const c = it.person.color || "#888888";
      if (!jetztGesetzt && it.start > now) { h += jetzt; jetztGesetzt = true; }
      const vorbei = it.end <= now, laeuft = it.start <= now && it.end > now;
      // Linke Spalte: Beginn gross, Ende klein; laeuft der Termin ueber den Tag hinaus, steht dort wann
      let z1, z2;
      if (it.start < tag) { z1 = hhmm(it.end); z2 = "Ende"; }
      else if (it.end > tagEnde) { z1 = hhmm(it.start); z2 = it.end <= morgenEnde ? "bis morgen" : `bis ${it.end.getDate()}.${it.end.getMonth() + 1}.`; }
      else { z1 = hhmm(it.start); z2 = it.end - it.start > 0 ? hhmm(it.end) : ""; }
      h += `<div class="fcc-dy-row${vorbei ? " fcc-dy-done" : ""}"><div class="fcc-dy-zeit"><b>${this._esc(z1)}</b>${z2 ? `<span>${this._esc(z2)}</span>` : ""}</div>`
        + `<div class="fcc-dy-ev${laeuft ? " fcc-dy-now" : ""}" data-key="${this._esc(it.key)}" data-ent="${it.entity}" style="background:${this._rgba(c, 0.22)};border-left-color:${c};--c:${c}">`
        + `<div class="fcc-dy-s">${this._esc(it.display)}</div><div class="fcc-dy-meta">${marke(it)}${laeuft ? '<span class="fcc-dy-live">läuft</span>' : ""}</div>`
        + (vorbei ? `<span class="fcc-dy-ok" style="background:${c};color:${this._textOn(c)}">${CP(0x2713)}</span>` : "")
        + "</div></div>";
    });
    if (!jetztGesetzt && zeit.length) h += jetzt;
    return h;
  }

  _dayListHTML(amTag, leute, sel) {
    const liste = amTag.filter(it => leute.includes(it.person));
    let h = '<div class="fcc-dy-list">';
    if (!liste.length) h += `<div class="fcc-dy-none">${this._filter.size === 1 ? this._esc([...this._filter][0]) + " hat an diesem Tag keine Termine." : "An diesem Tag stehen keine Termine an."}</div>`;
    return h + this._listRows(liste, sel) + "</div>";
  }

  _zeitText(it, tag) {
    const tagEnde = new Date(tag); tagEnde.setDate(tagEnde.getDate() + 1);
    const hhmm = t => `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`;
    const ab = it.start >= tag, bis = it.end <= tagEnde;
    if (it.allDay || (!ab && !bis)) return "ganztägig";
    if (ab && bis) return it.end - it.start > 0 ? `${hhmm(it.start)} – ${hhmm(it.end)}` : hhmm(it.start);
    return ab ? "ab " + hhmm(it.start) : "bis " + hhmm(it.end);
  }

  // Woche am Tablet: eine Spalte je Tag mit grossen Terminkacheln, oben die
  // Personenleiste als Filter. Ist die Karte zu schmal fuer sieben Spalten,
  // brechen die Tage in eine zweite Zeile um statt seitlich zu scrollen.
  _weekTilesHTML(r, cols, items) {
    const now = new Date();
    const heute = new Date(now); heute.setHours(0, 0, 0, 0);
    const iso = d => `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}`;
    const hhmm = t => `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`;
    const alleLeute = this.config.persons.filter(p => !p.no_create);
    const leute = alleLeute.filter(p => this._zeigt(p));
    const kurz = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    let h = this._chipsHTML(alleLeute) + '<div class="fcc-wt">';
    cols.forEach((d, i) => {
      const de = new Date(d); de.setDate(de.getDate() + 1);
      const amTag = items.filter(it => it.start < de && it.end > d)
        .sort((a, b) => {
          const ga = a.allDay || (a.start <= d && a.end >= de), gb = b.allDay || (b.start <= d && b.end >= de);
          return ga === gb ? (a.start - b.start || a.end - b.end) : (ga ? -1 : 1);
        });
      const liste = amTag.filter(it => leute.includes(it.person));
      const extra = amTag.filter(it => it.person.no_create);
      const istHeute = this._sameDay(d, heute);
      h += `<div data-date="${iso(d)}" class="fcc-wt-day${istHeute ? " fcc-wl-heute" : ""}${d < heute ? " fcc-wl-vorbei" : ""}">`
        + `<button class="fcc-wl-h fcc-wt-h" data-o="${Math.round((d - heute) / 864e5)}"><span class="fcc-wl-w">${kurz[i]}</span><span class="fcc-wl-n">${d.getDate()}</span>`
        + (istHeute ? '<span class="fcc-dy-badge">Heute</span>' : "") + "</button>";
      extra.forEach(it => { h += `<span class="fcc-dy-chip" data-key="${this._esc(it.key)}" data-ent="${it.entity}"><span class="fcc-dot" style="background:${it.person.color}"></span>${this._esc(it.display)}</span>`; });
      if (!liste.length) h += '<div class="fcc-dy-free">frei</div>';
      let jetztGesetzt = !istHeute;
      liste.forEach(it => {
        const c = it.person.color || "#888888";
        const ganz = it.allDay || (it.start <= d && it.end >= de);
        if (!jetztGesetzt && !ganz && it.start > now) { h += `<div class="fcc-wt-jetzt"><span>${hhmm(now)}</span></div>`; jetztGesetzt = true; }
        const vorbei = it.allDay ? it.end <= heute : it.end <= now;
        const laeuft = !it.allDay && it.start <= now && it.end > now;
        h += `<div class="fcc-dy-ev${vorbei ? " fcc-dy-done" : ""}${laeuft ? " fcc-dy-now" : ""}" data-key="${this._esc(it.key)}" data-ent="${it.entity}" style="background:${this._rgba(c, 0.22)};--c:${c}">`
          + `<div class="fcc-dy-s">${this._esc(it.display)}</div><div class="fcc-dy-t">${this._esc(this._zeitText(it, d))}</div>`
          + `<div class="fcc-wt-who"><span class="fcc-dot" style="background:${c}"></span>${this._esc(it.person.name)}</div>`
          + (vorbei ? `<span class="fcc-dy-ok" style="background:${c};color:${this._textOn(c)}">${CP(0x2713)}</span>` : "")
          + "</div>";
      });
      if (!jetztGesetzt && liste.length) h += `<div class="fcc-wt-jetzt"><span>${hhmm(now)}</span></div>`;
      h += "</div>";
    });
    return `<div class="fcc-dy">${h}</div></div>`;
  }

  // Woche am Handy: die Tage untereinander, jeder mit derselben Zeitliste
  // wie die Tagesansicht. Antippen des Tageskopfs oeffnet den Tag.
  _weekListHTML(r, cols, items) {
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const iso = d => `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}`;
    const alleLeute = this.config.persons.filter(p => !p.no_create);
    const leute = alleLeute.filter(p => this._zeigt(p));
    const wd = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    let h = this._chipsHTML(alleLeute) + '<div class="fcc-wl">';
    cols.forEach((d, i) => {
      const de = new Date(d); de.setDate(de.getDate() + 1);
      const amTag = items.filter(it => it.start < de && it.end > d)
        .sort((a, b) => (a.allDay === b.allDay) ? (a.start - b.start || a.end - b.end) : (a.allDay ? -1 : 1));
      const liste = amTag.filter(it => leute.includes(it.person));
      const extra = amTag.filter(it => it.person.no_create);
      const istHeute = this._sameDay(d, heute);
      const o = Math.round((d - heute) / 864e5);
      h += `<div class="fcc-wl-day${istHeute ? " fcc-wl-heute" : ""}${d < heute ? " fcc-wl-vorbei" : ""}">`
        + `<button class="fcc-wl-h" data-o="${o}"><span class="fcc-wl-n">${d.getDate()}</span><span class="fcc-wl-w">${wd[i]}</span>`
        + (istHeute ? '<span class="fcc-dy-badge">Heute</span>' : "")
        + `<span class="fcc-wl-cnt">${liste.length ? liste.length + (liste.length === 1 ? " Termin" : " Termine") : "frei"}</span></button>`;
      if (extra.length) h += '<div class="fcc-dy-extra">' + extra.map(it => `<span class="fcc-dy-chip" data-key="${this._esc(it.key)}" data-ent="${it.entity}"><span class="fcc-dot" style="background:${it.person.color}"></span>${this._esc(it.display)}</span>`).join("") + "</div>";
      if (liste.length) h += `<div class="fcc-dy-list">${this._listRows(liste, d)}</div>`;
      h += "</div>";
    });
    return `<div class="fcc-dy fcc-dy-mob">${h}</div></div>`;
  }

  _weekHTML() {
    const r = this._range();
    const dn = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const cols = []; for (let i = 0; i < 7; i++) { const d = new Date(r.start); d.setDate(d.getDate() + i); cols.push(d); }
    const HH = 46, h0 = this.config.day_start, h1 = this.config.day_end;
    const gridH = (h1 - h0) * HH;
    const items = this._items(!this.config.week_grid);
    const label = `${cols[0].getDate()}.${cols[0].getMonth() + 1}. - ${cols[6].getDate()}.${cols[6].getMonth() + 1}.${cols[6].getFullYear()}`;
    if (!this.config.week_grid) {
      return { label, html: this._schmal ? this._weekListHTML(r, cols, items) : this._weekTilesHTML(r, cols, items) };
    }

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
      if (opts.personName) { const pi = persons.findIndex(p => p.name === opts.personName); if (pi >= 0) personIdx = pi; }
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
    const close = () => { this._editing = false; if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.appendChild(box); U.lightbox(this, ov, close);
    this._editing = true; // blockiert Re-Renders, solange der Dialog offen ist
    const ti = box.querySelector(".fcc-title");
    const adCb = box.querySelector(".fcc-allday");
    const timesEl = box.querySelector(".fcc-times");
    const syncTimes = () => { timesEl.style.display = adCb.checked ? "none" : "flex"; };
    syncTimes(); adCb.addEventListener("change", syncTimes);
    setTimeout(() => { ti.focus(); }, 30);
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
        const v = box.querySelector(".fcc-von").value || "09:00";
        const b = box.querySelector(".fcc-bis").value || v;
        // Datum + "HH:MM" -> Date. In der doppelten Stunde beim Ende der Sommerzeit (02:00-02:59) gibt es zwei Zeitpunkte:
        // beim Bearbeiten gilt der urspruengliche Zeitpunkt als Bezug (ein unveraendert gespeicherter Termin bleibt exakt gleich,
        // auch einer, der ueber die Umstellung geht), beim Neuanlegen liegt das Ende nach dem Beginn. Ein ganztaegiger
        // Termin hat keine Uhrzeit, die als Bezug taugt.
        const zeit = (ds, hm, ref, wie) => {
          const dp = String(ds).split("-").map(Number), tp = String(hm).split(":").map(Number);
          return U.ortZeit(dp[0], dp[1] - 1, dp[2], tp[0], tp[1] || 0, ref, 0, wie);
        };
        const alt = edit && !it.allDay;
        const sD = zeit(d, v, alt ? it.start : undefined, alt);
        let eD = zeit(d2, b, alt ? it.end : sD, alt);
        // Nur innerhalb desselben Tages muss das Ende nach dem Beginn liegen;
        // ueber Mitternacht hinweg ist eine kleinere Uhrzeit voellig richtig.
        if (d2 === d && eD <= sD) {
          const plus = new Date(+sD + 3600000);
          eD = iso(plus) !== d ? zeit(d, "23:59", sD) : plus;
        }
        startDT = U.haZeit(sD); endDT = U.haZeit(eD);
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
        else { msg.event.dtstart = startDT; msg.event.dtend = endDT; }
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
    this._schmal = this._istSchmal();
    const view = this._view === "month" ? this._monthHTML()
      : this._view === "agenda" ? this._agendaHTML()
      : this._view === "day" ? this._dayHTML() : this._weekHTML();
    const css = this._css();
    const kopf = this.config.hide_header ? "" : this._headerHTML(view.label);
    // Tag und Woche filtern ueber die Personen-Chips statt ueber die Legende
    const legende = this.config.hide_legend || this._view === "day" || (this._view === "week" && !this.config.week_grid) ? "" : this._legendHTML();
    // fill_height gilt nicht in der Mehrtagesansicht (Startseite): dort bleibt die Karte so hoch wie ihr Inhalt
    const fuell = this.config.fill_height && this._view !== "agenda";
    this.innerHTML = `<style>${css}</style><ha-card class="fcc-card${this._schmal ? " fcc-narrow" : ""}${fuell ? " fcc-fill" : ""}" lang="de">${kopf}${legende}${view.html}</ha-card>`;
    this.querySelectorAll(".fcc-bar .fcc-nav-b,.fcc-bar .fcc-today").forEach(b => b.addEventListener("click", () => { const dd = parseInt(b.dataset.d, 10); this._offset = dd === 0 ? 0 : this._offset + dd; this._go(); }));
    this.querySelectorAll(".fcc-vw").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; if (v !== this._view) { this._view = v; this._offset = 0; this._maybeFetch(true); } }));
    this.querySelectorAll(".fcc-chip").forEach(b => b.addEventListener("click", () => { const n = b.dataset.person; if (this._hidden.has(n)) this._hidden.delete(n); else this._hidden.add(n); this._saveHidden(); this._render(); }));
    this.querySelectorAll(".fcc-dy-d,.fcc-dy-arr").forEach(b => b.addEventListener("click", () => { this._offset = parseInt(b.dataset.o, 10) || 0; this._go(); }));
    this.querySelectorAll(".fcc-add").forEach(b => b.addEventListener("click", () => this._neuerTermin()));
    // Freie Flaeche eines Tages bzw. einer Personenspalte legt dort einen Termin an
    this.querySelectorAll(".fcc-wt-day,.fcc-dy-col").forEach(el => el.addEventListener("click", e => {
      if (e.target.closest(".fcc-dy-ev,.fcc-dy-chip,.fcc-wl-h")) return;
      this._neuerTermin(el.dataset.date, el.dataset.person);
    }));
    this.querySelectorAll(".fcc-wl-h").forEach(b => b.addEventListener("click", () => { this._view = "day"; this._offset = parseInt(b.dataset.o, 10) || 0; this._go(); }));
    this.querySelectorAll(".fcc-fc").forEach(b => b.addEventListener("click", () => {
      const n = b.dataset.person;
      if (!n) this._filter.clear(); else if (this._filter.has(n)) this._filter.delete(n); else this._filter.add(n);
      this._render();
    }));
    const mob = this.querySelector(".fcc-dy-mob");
    if (mob) {
      // Wischen nach links/rechts wechselt den Tag
      let x0 = null, y0 = 0;
      mob.addEventListener("touchstart", e => { if (e.target.closest(".fcc-dy-strip,.fcc-flt")) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      mob.addEventListener("touchend", e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { this._offset += dx < 0 ? 1 : -1; this._go(); }
      }, { passive: true });
    }
    this.querySelectorAll(".fcc-ev,.fcc-ad-ev,.fcc-m-ev,.fcc-ag-ev,.fcc-dy-ev,.fcc-dy-chip").forEach(el => el.addEventListener("click", e => {
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
    /* Schlichter Kopf wie beim Essensplan: Titel, Ansichten als Segment, Datum als Pille, Heute, ＋ Termin rechts; bricht um */
    .fcc-bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:14px 14px 6px;background:transparent;color:var(--primary-text-color);}
    .fcc-bar .fcc-title{flex:0 1 auto;min-width:0;margin-right:2px;font-size:1.05rem;font-weight:900;letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere;}
    .fcc-in.fcc-title{font-weight:700;}
    .fcc-btn{flex:none;margin:0;border:none;background:transparent;color:inherit;font:inherit;line-height:1.2;cursor:pointer;-webkit-tap-highlight-color:transparent;}
    .fcc-views{display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));}
    .fcc-vw{min-height:30px;padding:0 13px;border-radius:999px;color:var(--secondary-text-color);font-size:.78rem;font-weight:800;white-space:nowrap;}
    .fcc-vw-on{background:var(--card-background-color);color:var(--primary-text-color);box-shadow:0 1px 3px color-mix(in srgb,var(--primary-text-color) 20%,transparent);}
    .fcc-nav{display:flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));}
    .fcc-nav-b{display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border-radius:50%;color:var(--primary-text-color);font-size:1.25rem;line-height:1;}
    .fcc-nav-b:active{background:var(--fp-surface-2,var(--divider-color));}
    .fcc-range{min-width:76px;padding:0 2px;text-align:center;font-size:.82rem;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;}
    .fcc-bar .fcc-today{min-height:32px;padding:0 12px;border:1px solid var(--divider-color);border-radius:999px;color:var(--primary-text-color);font-size:.76rem;font-weight:800;}
    .fcc-add{display:inline-flex;align-items:center;gap:5px;margin-left:auto;min-height:36px;padding:0 15px 0 12px;border-radius:999px;background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));font-size:.82rem;font-weight:800;white-space:nowrap;}
    .fcc-add-i{font-size:1.2rem;line-height:1;font-weight:700;}
    .fcc-flt .fcc-add{min-height:32px;}
    @media (hover:hover){
      .fcc-nav-b:hover{background:var(--fp-surface-2,var(--divider-color));}
      .fcc-bar .fcc-today:hover{background:var(--fp-surface,var(--secondary-background-color));}
      .fcc-vw:not(.fcc-vw-on):hover{color:var(--primary-text-color);}
      .fcc-add:hover{filter:brightness(1.08);}
    }
    /* Handy: Titel + Termin oben, darunter Datum + Heute, darunter die Ansichten */
    .fcc-narrow .fcc-bar{display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:"title title title add" "nav today . ." "views views views views";align-items:center;gap:8px 10px;}
    .fcc-narrow .fcc-bar .fcc-title{grid-area:title;}
    .fcc-narrow .fcc-nav{grid-area:nav;}
    .fcc-narrow .fcc-bar .fcc-today{grid-area:today;}
    .fcc-narrow .fcc-bar .fcc-add{grid-area:add;margin-left:0;}
    .fcc-narrow .fcc-views{grid-area:views;}
    .fcc-narrow .fcc-views .fcc-vw{flex:1;}
    /* Personenfilter (Chips): Punkt in der Personenfarbe; „Alle“ und gewählte Personen gefüllt, ausgeblendete blass */
    .fcc-flt{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 14px 10px;}
    .fcc-fc,.fcc-chip{display:inline-flex;align-items:center;gap:6px;min-height:28px;box-sizing:border-box;padding:4px 11px;border:none;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font:inherit;font-size:.78rem;font-weight:800;line-height:1.2;cursor:pointer;-webkit-tap-highlight-color:transparent;}
    .fcc-fc .fcc-dot,.fcc-chip .fcc-dot{flex:none;width:8px;height:8px;}
    .fcc-fc-on{background:var(--primary-text-color);color:var(--card-background-color);}
    .fcc-fc-on .fcc-dot{box-shadow:0 0 0 1.5px var(--card-background-color);}
    .fcc-legend{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 6px;}
    .fcc-bar + .fcc-legend{padding-top:2px;}
    .fcc-chip.fcc-off{opacity:.4;}
    @media (hover:hover){.fcc-fc:not(.fcc-fc-on):hover,.fcc-chip:hover{background:var(--fp-surface-2,var(--divider-color));}}
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
    /* Tagesansicht */
    .fcc-dy{padding:10px 0 14px;}
    .fcc-dy-strip{display:flex;align-items:stretch;gap:4px;padding:0 10px 10px;}
    .fcc-dy-d,.fcc-dy-arr{border:none;background:none;color:var(--primary-text-color);cursor:pointer;font:inherit;border-radius:14px;}
    .fcc-dy-arr{flex:0 0 30px;font-size:1.4rem;color:var(--secondary-text-color);}
    .fcc-dy-d{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 5px;}
    .fcc-dy-d:hover{background:var(--secondary-background-color,rgba(0,0,0,.05));}
    .fcc-dy-wd{font-size:.78rem;font-weight:600;color:var(--secondary-text-color);}
    .fcc-dy-n{font-size:1.2rem;font-weight:700;line-height:1.2;}
    .fcc-dy-dot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.5;}
    .fcc-dy-dot.fcc-dy-leer{visibility:hidden;}
    .fcc-dy-today .fcc-dy-n,.fcc-dy-today .fcc-dy-wd{color:var(--fp-head,var(--primary-color));}
    .fcc-dy-d.fcc-dy-sel{background:var(--fp-accent,var(--primary-color));}
    .fcc-dy-d.fcc-dy-sel span{color:var(--fp-accent-fg,var(--text-primary-color,#fff));}
    .fcc-dy-title{display:flex;align-items:center;gap:8px;padding:0 16px 10px;font-size:1.15rem;font-weight:700;color:var(--primary-text-color);}
    .fcc-dy-badge{font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 20%,transparent);color:var(--fp-head,var(--primary-color));}
    .fcc-dy-extra{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;}
    .fcc-dy-chip{display:inline-flex;align-items:center;gap:6px;font-size:.88rem;padding:4px 10px;border-radius:999px;background:var(--secondary-background-color,rgba(0,0,0,.05));color:var(--primary-text-color);cursor:pointer;}
    .fcc-dy-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 12px;padding:0 14px 4px;}
    .fcc-dy-col{min-width:0;display:flex;flex-direction:column;gap:8px;}
    .fcc-dy-h{display:flex;align-items:center;gap:8px;padding-bottom:8px;margin-bottom:2px;border-bottom:3px solid #888;}
    .fcc-dy-av{flex:0 0 38px;width:38px;height:38px;border-radius:50%;border:2px solid #888;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:1.05rem;font-weight:700;background-size:cover;background-position:center;}
    .fcc-dy-name{flex:1;min-width:0;font-size:1.05rem;font-weight:700;color:var(--primary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .fcc-dy-ev{position:relative;border-radius:16px;padding:12px 14px;cursor:pointer;}
    .fcc-dy-ev:hover{filter:brightness(.96);}
    .fcc-dy-s{font-size:1.05rem;font-weight:700;line-height:1.3;color:var(--primary-text-color);overflow-wrap:break-word;-webkit-hyphens:auto;hyphens:auto;}
    .fcc-dy-t{margin-top:4px;font-size:.9rem;font-weight:500;color:var(--primary-text-color);opacity:.75;}
    .fcc-dy-done{opacity:.55;}
    .fcc-dy-done .fcc-dy-s{padding-right:26px;}
    .fcc-dy-ok{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;}
    .fcc-dy-now{box-shadow:0 0 0 2px var(--c);}
    /* Tagesansicht am Handy */
    .fcc-dy-list{display:flex;flex-direction:column;gap:8px;padding:0 12px 4px;min-height:120px;}
    .fcc-dy-mob .fcc-dy-ev{border-left:5px solid #888;border-radius:12px;padding:10px 12px;}
    .fcc-dy-ganz{margin-left:62px;}
    .fcc-dy-row{display:flex;gap:10px;align-items:stretch;}
    .fcc-dy-row .fcc-dy-ev{flex:1;min-width:0;}
    .fcc-dy-row.fcc-dy-done .fcc-dy-ev{opacity:1;}
    .fcc-dy-zeit{flex:0 0 52px;display:flex;flex-direction:column;align-items:flex-end;padding-top:9px;color:var(--primary-text-color);}
    .fcc-dy-zeit b{font-size:1rem;}
    .fcc-dy-zeit span{font-size:.82rem;color:var(--secondary-text-color);text-align:right;line-height:1.15;}
    .fcc-dy-meta{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:.85rem;color:var(--primary-text-color);opacity:.8;}
    .fcc-dy-who1{display:inline-flex;align-items:center;gap:5px;}
    .fcc-dy-live{font-weight:700;}
    .fcc-dy-jetzt{position:relative;height:0;border-top:2px solid var(--error-color,#db4437);margin:4px 0 4px 62px;}
    .fcc-dy-jetzt span{position:absolute;left:-58px;top:-10px;font-size:.75rem;font-weight:700;color:var(--error-color,#db4437);width:52px;text-align:right;}
    .fcc-dy-none{padding:24px 8px;text-align:center;font-size:.95rem;color:var(--secondary-text-color);}
    .fcc-wl{display:flex;flex-direction:column;gap:6px;}
    .fcc-wl-day{padding:4px 0 8px;}
    .fcc-wl-day+.fcc-wl-day{border-top:1px solid var(--divider-color,#e5e5e5);}
    .fcc-wl-h{display:flex;align-items:baseline;gap:8px;width:100%;border:none;background:none;font:inherit;cursor:pointer;text-align:left;padding:10px 14px 8px;color:var(--primary-text-color);}
    .fcc-wl-n{flex:0 0 46px;text-align:right;font-size:1.6rem;font-weight:700;line-height:1;}
    .fcc-wl-w{font-size:1.05rem;font-weight:600;}
    .fcc-wl-cnt{margin-left:auto;font-size:.85rem;color:var(--secondary-text-color);}
    .fcc-wl-heute .fcc-wl-n,.fcc-wl-heute .fcc-wl-w{color:var(--fp-head,var(--primary-color));}
    .fcc-wl-vorbei .fcc-wl-h{opacity:.55;}
    .fcc-wl-day .fcc-dy-extra{padding-left:68px;}
    /* auto-fit statt auto-fill: auto-fill legt auch leere Spuren an, dann nähmen sieben Tage nur einen Teil der Breite ein */
    .fcc-wt{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:14px 10px;padding:0 14px 4px;}
    .fcc-wt-day{min-width:0;display:flex;flex-direction:column;gap:7px;cursor:pointer;min-height:90px;}
    .fcc-dy-col{cursor:pointer;min-height:120px;}
    .fcc-wt-h{padding:2px 2px 7px;border-bottom:3px solid var(--divider-color,#e5e5e5);flex-wrap:wrap;}
    .fcc-wt-h .fcc-wl-n{flex:0 0 auto;font-size:1.5rem;}
    .fcc-wt-h .fcc-wl-w{font-size:.95rem;color:var(--secondary-text-color);}
    .fcc-wl-heute .fcc-wt-h{border-bottom-color:var(--fp-head,var(--primary-color));}
    .fcc-wt-day .fcc-dy-ev{padding:10px 11px;border-radius:14px;}
    .fcc-wt-day .fcc-dy-s{font-size:1rem;}
    .fcc-wt-day .fcc-dy-ok{top:8px;right:8px;width:18px;height:18px;font-size:.68rem;}
    .fcc-wt-day .fcc-dy-done .fcc-dy-s{padding-right:18px;}
    .fcc-wt-day .fcc-dy-t{font-size:.85rem;margin-top:3px;}
    .fcc-wt-who{display:flex;align-items:center;gap:5px;margin-top:5px;font-size:.8rem;color:var(--primary-text-color);opacity:.8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
    .fcc-wt-day .fcc-dy-chip{align-self:flex-start;max-width:100%;font-size:.8rem;}
    .fcc-wt-jetzt{position:relative;height:0;border-top:2px solid var(--error-color,#db4437);margin:3px 0;}
    .fcc-wt-jetzt span{position:absolute;right:0;top:-9px;font-size:.7rem;font-weight:700;color:var(--error-color,#db4437);background:var(--card-background-color,#fff);padding-left:4px;}
    .fcc-dy-free{font-size:.9rem;color:var(--secondary-text-color);opacity:.7;padding:6px 2px;}
    .fcc-gutter{width:48px;flex:0 0 48px;}
    .fcc-wk-head{display:flex;padding:6px 8px 0;}
    .fcc-dcol{flex:1;min-width:0;text-align:center;border-radius:8px 8px 0 0;padding:2px;}
    .fcc-dn{font-size:.72rem;color:var(--secondary-text-color);font-weight:700;}
    .fcc-dd{font-size:.7rem;color:var(--secondary-text-color);}
    .fcc-dcol.fcc-today .fcc-dn,.fcc-dcol.fcc-today .fcc-dd{color:var(--fp-head,var(--primary-color));}
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
    .fcc-today-col{background-color:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 10%,transparent);}
    .fcc-ev{position:absolute;border-radius:7px;color:#fff;padding:2px 5px;overflow:hidden;font-size:.72rem;line-height:1.05;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;box-sizing:border-box;}
    .fcc-ev-t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .fcc-ev-h{font-size:.62rem;opacity:.9;}
    .fcc-past{position:absolute;left:0;right:0;top:0;background:rgba(0,0,0,.16);pointer-events:none;}
    .fcc-now{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--error-color,#db4437);z-index:6;pointer-events:none;}
    .fcc-now::before{content:"";position:absolute;left:-1px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--error-color,#db4437);}
    .fcc-m-head{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:6px 8px 0;}
    .fcc-m-head>div{text-align:center;font-size:.72rem;font-weight:700;color:var(--secondary-text-color);}
    .fcc-m-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:6px 8px 8px;}
    .fcc-m-cell{min-width:0;overflow:hidden;min-height:84px;border-radius:8px;border:1px solid var(--divider-color);background:var(--secondary-background-color,rgba(0,0,0,.03));padding:3px;}
    .fcc-m-cell.fcc-dim{opacity:.45;}
    .fcc-m-cell.fcc-today{outline:2px solid var(--fp-head,var(--primary-color));}
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
    .fcc-in[type=date],.fcc-in[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;} .fcc-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
    .fcc-row2{display:flex;gap:10px;}
    .fcc-row2>div{flex:1;}
    .fcc-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
    .fcc-btn2{border:none;border-radius:10px;padding:9px 14px;font-size:.9rem;cursor:pointer;}
    .fcc-cancel{background:var(--secondary-background-color,#eee);color:var(--primary-text-color);}
    .fcc-save{background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));font-weight:700;}
    .fcc-del{background:rgba(229,57,53,.15);color:#c62828;}
    .fcc-check{display:flex;align-items:center;gap:8px;font-size:.85rem;margin:10px 0 2px;color:var(--primary-text-color);}
    /* fill_height: mindestens bis zum unteren Bildschirmrand (Kopfzeile, Safe-Area und --fcc-fill-offset abgezogen); die Spalten wachsen mit, freie Fläche gehört zur Spalte */
    .fcc-fill{box-sizing:border-box;display:flex;flex-direction:column;min-height:calc(100vh - var(--header-height,56px) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - var(--fcc-fill-offset,8px));min-height:calc(100dvh - var(--header-height,56px) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - var(--fcc-fill-offset,8px));}
    .fcc-fill>.fcc-dy,.fcc-fill>.fcc-m,.fcc-fill>.fcc-wk{flex:1 1 auto;display:flex;flex-direction:column;}
    .fcc-fill .fcc-wt,.fcc-fill .fcc-dy-cols,.fcc-fill .fcc-m-grid{flex:1 1 auto;}
    .fcc-fill .fcc-scroll{flex:1 1 0;min-height:240px;max-height:none;}
    `;
  }
  getCardSize() { return 10; }
}
if (!customElements.get("family-calendar-card")) {
  customElements.define("family-calendar-card", FamilyCalendarCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "family-calendar-card", name: "Family Calendar Card", description: "Tag, Woche und Monat mit Praefix-Personen" });
}
})();

/* ===== kids-routine-card v7 (ein Schritt groß, Tageszeit, Theme-Farben) ===== */
(() => {
const U = window.__fpUtils;
const CPR = U.cp;
class KidsRoutineCard extends HTMLElement {
  setConfig(config) {
    const c = Object.assign({ name: "", title: "", color: "", points_entity: "", reward_button: "", penalty_button: "", routines: [] }, config || {});
    if (!Array.isArray(c.routines)) c.routines = [];
    this.config = c;
    this._sig = ""; this._stSig = ""; this._built = false;
    this._manual = null; this._manualAuto = null; this._lastKey = null;
    this._clearBusy();
  }
  connectedCallback() {
    if (this._tick) return;
    // Tageszeit-Wechsel: einmal pro Minute neu berechnen, gerendert wird nur bei Änderung.
    this._tick = setInterval(() => this._update(), 60000);
    this._update();
  }
  disconnectedCallback() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    this._clearBusy();
  }
  set hass(hass) {
    this._hass = hass;
    this._update();
  }
  _esc(s) { return U.esc(s); }
  _toast(msg) { U.toast(this, msg); }
  _isOn(e) { const s = this._hass && this._hass.states[e]; return !!(s && s.state === "on"); }
  _fmtStars(v) { const n = parseFloat(v); return isNaN(n) ? v : String(Math.round(n)); }
  _reduced() { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  _domain(e) { return String(e).split(".")[0]; }
  // Nur Schritte mit Entity zählen, ohne Entity lässt sich nichts speichern.
  _tasks(g) { return ((g && g.tasks) || []).filter(t => t && t.entity); }

  // ---- Tageszeit ----
  _parseFrom(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string") {
      const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (m) return +m[1] + (+m[2]) / 60;
      const n = parseFloat(v.replace(",", "."));
      return isFinite(n) ? n : null;
    }
    return null;
  }
  _froms() {
    const out = [];
    this.config.routines.forEach((g, i) => {
      const f = this._parseFrom(g && g.from);
      out.push(f != null ? f : (i === 0 ? 0 : i === 1 ? 12 : out[i - 1]));
    });
    return out;
  }
  _autoIdx() {
    const f = this._froms();
    if (!f.length) return -1;
    const d = new Date(), now = d.getHours() + d.getMinutes() / 60;
    let best = -1, top = 0;
    f.forEach((v, i) => {
      if (v <= now && (best < 0 || v >= f[best])) best = i;
      if (v >= f[top]) top = i;
    });
    return best >= 0 ? best : top;
  }
  // Aktive Routine. Verwirft nebenbei die manuelle Wahl, sobald die automatische wechselt.
  _activeIdx() {
    const n = this.config.routines.length;
    if (!n) return -1;
    const auto = this._autoIdx();
    if (this._manual != null && (this._manualAuto !== auto || this._manual >= n)) this._manual = null;
    return this._manual != null ? this._manual : auto;
  }
  _pick(i) {
    if (!(i >= 0 && i < this.config.routines.length)) return;
    this._manual = i; this._manualAuto = this._autoIdx();
    this._update();
  }

  // ---- Zustand ----
  _stateSig() {
    const st = this._hass.states;
    const pe = this.config.points_entity;
    let sig = pe && st[pe] ? st[pe].state : "";
    this.config.routines.forEach(g => this._tasks(g).forEach(t => { const s = st[t.entity]; sig += "|" + (s ? s.state : "?"); }));
    return sig;
  }
  _update() {
    if (!this._hass || !this.config) return;
    const stSig = this._stateSig();
    const sig = this._activeIdx() + "#" + stSig;
    if (this._busy && stSig !== this._stSig) this._arrived();
    this._stSig = stSig;
    if (sig === this._sig) return;
    this._sig = sig;
    this._render();
  }

  // ---- Doppeltipp-Schutz ----
  _lock() {
    this._clearBusy();
    this._busy = true; this._busyT0 = Date.now();
    this._busyMax = setTimeout(() => this._unlock(), 3000);
    this._applyBusy();
  }
  // Neue Zustandsänderung ist da: frühestens nach 600 ms wieder freigeben.
  _arrived() {
    if (!this._busy) return;
    const rest = this._busyT0 + 600 - Date.now();
    if (rest <= 0) { this._unlock(); return; }
    clearTimeout(this._busyMin);
    this._busyMin = setTimeout(() => this._unlock(), rest);
  }
  _clearBusy() {
    clearTimeout(this._busyMax); clearTimeout(this._busyMin);
    this._busyMax = null; this._busyMin = null; this._busy = false;
  }
  _unlock() { this._clearBusy(); this._applyBusy(); }
  _applyBusy() {
    if (!this._content) return;
    this._content.querySelectorAll(".kr-act").forEach(b => { b.disabled = !!this._busy; });
  }

  // ---- Aktionen ----
  _call(domain, service, entity, onOk) {
    if (!this._hass) return;
    this._lock();
    let p;
    try { p = this._hass.callService(domain, service, { entity_id: entity }); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(() => {
      try { if (onOk) onOk(); } catch (e) {}
    }, () => {
      this._unlock();
      this._toast("Schritt konnte nicht gespeichert werden");
    });
  }
  _press(entity) {
    try { Promise.resolve(this._hass.callService("button", "press", { entity_id: entity })).catch(() => {}); } catch (e) {}
  }
  _done() {
    if (this._busy || !this._hass) return;
    const r = this.config.routines[this._activeIdx()];
    if (!r) return;
    const tasks = this._tasks(r);
    const ci = tasks.findIndex(t => !this._isOn(t.entity));
    if (ci < 0) return;
    const last = tasks.every((t, i) => i === ci || this._isOn(t.entity));
    this._call(this._domain(tasks[ci].entity), "turn_on", tasks[ci].entity, () => {
      if (this.config.reward_button) this._press(this.config.reward_button);
      if (last) this._celebrate(tasks.map(t => t.emoji));
    });
  }
  _back() {
    if (this._busy || !this._hass) return;
    const r = this.config.routines[this._activeIdx()];
    if (!r) return;
    const tasks = this._tasks(r);
    let ti = -1;
    tasks.forEach((t, i) => { if (this._isOn(t.entity)) ti = i; });
    if (ti < 0) return;
    this._call(this._domain(tasks[ti].entity), "turn_off", tasks[ti].entity, () => {
      if (this.config.penalty_button) this._press(this.config.penalty_button);
    });
  }
  _onClick(ev) {
    const b = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!b || !this._content.contains(b) || b.disabled) return;
    const act = b.dataset.act;
    if (act === "tab") this._pick(+b.dataset.i);
    else if (act === "done") this._done();
    else if (act === "back") this._back();
  }
  _celebrate(emojis) {
    if (!this._fx || this._reduced()) return;
    const pool = (emojis || []).filter(Boolean);
    pool.push(CPR(0x1F389));
    const h = (this._fx.offsetHeight || 420) + 50;
    for (let i = 0; i < 18; i++) {
      const s = document.createElement("span");
      s.className = "kr-drop"; s.textContent = pool[Math.floor(Math.random() * pool.length)];
      s.style.left = (Math.random() * 100) + "%";
      s.style.fontSize = (18 + Math.random() * 22) + "px";
      s.style.animationDelay = (Math.random() * 0.3) + "s";
      s.style.animationDuration = (1.1 + Math.random() * 0.9) + "s";
      s.style.setProperty("--kr-h", h + "px");
      this._fx.appendChild(s);
      setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 2400);
    }
  }

  // ---- Darstellung ----
  _render() {
    if (!this._hass) return;
    if (!this._built) {
      this.innerHTML = `<style>${this._css()}</style><ha-card class="kr-card"><div class="kr-fx"></div><div class="kr-content"></div></ha-card>`;
      this._fx = this.querySelector(".kr-fx"); this._content = this.querySelector(".kr-content");
      // Ein delegierter Listener auf dem Container, überlebt jedes innerHTML.
      this._content.addEventListener("click", ev => this._onClick(ev));
      this._built = true;
    }
    const c = this.config, routines = c.routines;
    const ai = this._activeIdx();
    const dis = this._busy ? " disabled" : "";

    // Kopf
    const pe = c.points_entity && this._hass.states[c.points_entity];
    let html = `<div class="kr-head">` +
      (c.color ? `<span class="kr-dotc" style="background:${this._esc(c.color)}"></span>` : "") +
      `<div class="kr-title">${this._esc(c.title || c.name || "Routinen")}</div>` +
      (pe ? `<div class="kr-stars">${CPR(0x2B50)} ${this._esc(this._fmtStars(pe.state))}</div>` : "") + `</div>`;

    // Umschalter
    if (routines.length > 1) {
      html += `<div class="kr-tabs">`;
      routines.forEach((g, i) => {
        const ts = this._tasks(g);
        const n = ts.filter(t => this._isOn(t.entity)).length;
        html += `<button class="kr-tab${i === ai ? " kr-sel" : ""}" aria-pressed="${i === ai}" data-act="tab" data-i="${i}"><span>${this._esc(((g.icon || "") + " " + (g.label || "")).trim())}</span><span class="kr-n">${n}/${ts.length}</span></button>`;
      });
      html += `</div>`;
    }

    // Aktive Routine
    const r = routines[ai];
    const tasks = r ? this._tasks(r) : [];
    if (!tasks.length) {
      this._lastKey = ai + ":-";
      html += `<div class="kr-empty">Keine Schritte eingetragen</div>`;
    } else {
      const on = tasks.map(t => this._isOn(t.entity));
      const doneN = on.filter(Boolean).length;
      const ci = on.indexOf(false);               // aktueller Schritt, -1 = alles erledigt
      const key = ai + ":" + (ci < 0 ? "end" : ci);
      const pop = this._lastKey != null && this._lastKey !== key && !this._reduced();
      this._lastKey = key;

      html += `<div class="kr-dots" aria-hidden="true">`;
      tasks.forEach((t, i) => {
        html += `<span class="kr-d${on[i] ? " kr-dn" : ""}${i === ci ? " kr-cur" : ""}">${this._esc(t.emoji || "")}</span>`;
      });
      html += `</div>`;

      if (ci < 0) {
        html += `<div class="kr-stage kr-fin"><div class="kr-big${pop ? " kr-pop" : ""}">${CPR(0x1F389)}</div>` +
          `<div class="kr-txt">${this._esc(c.name ? "Geschafft, " + c.name + "!" : "Geschafft!")}</div>` +
          `<div class="kr-sub">${this._esc(r.label ? r.label + " fertig" : "Alles erledigt")}</div>` +
          `<button class="kr-act kr-back" data-act="back"${dis}>Letzten Schritt zurücknehmen</button></div>`;
      } else {
        const t = tasks[ci];
        html += `<div class="kr-stage"><div class="kr-step">Schritt ${ci + 1} von ${tasks.length}</div>` +
          `<div class="kr-big${pop ? " kr-pop" : ""}">${this._esc(t.emoji || "")}</div>` +
          `<div class="kr-txt">${this._esc(t.label || "")}</div>` +
          `<button class="kr-act kr-go" data-act="done"${dis}>Fertig ${CPR(0x2713)}</button>` +
          (doneN > 0 ? `<button class="kr-act kr-back" data-act="back"${dis}>Zurück</button>` : "") + `</div>`;
      }
    }
    this._content.innerHTML = html;
  }
  _css() {
    return `
    .kr-card{position:relative;overflow:hidden;padding:14px;box-sizing:border-box;}
    .kr-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;}
    .kr-drop{position:absolute;top:-34px;animation-name:kr-fall;animation-timing-function:linear;animation-fill-mode:forwards;}
    @keyframes kr-fall{to{transform:translateY(var(--kr-h,420px)) rotate(45deg);opacity:0;}}
    .kr-content{display:flex;flex-direction:column;gap:14px;}
    .kr-head{display:flex;align-items:center;gap:8px;}
    .kr-dotc{flex:none;width:12px;height:12px;border-radius:50%;}
    .kr-title{flex:1;min-width:0;font-size:1.2rem;font-weight:700;color:var(--primary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .kr-stars{flex:none;padding:3px 10px;border-radius:999px;font-size:.95rem;font-weight:700;color:var(--primary-text-color);background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 14%,transparent);}
    .kr-tabs{display:flex;flex-wrap:wrap;gap:6px;}
    .kr-tab{flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;box-sizing:border-box;padding:6px 12px;border:none;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font-size:.9rem;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}
    .kr-tab.kr-sel{background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));}
    .kr-n{font-size:.78rem;font-weight:700;opacity:.8;}
    .kr-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
    .kr-d{width:38px;height:38px;box-sizing:border-box;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;line-height:1;background:var(--fp-surface,var(--secondary-background-color));}
    .kr-d.kr-dn{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 22%,transparent);opacity:.7;}
    .kr-d.kr-cur{box-shadow:inset 0 0 0 3px var(--fp-accent,var(--primary-color));}
    .kr-stage{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding-top:4px;}
    .kr-step{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--secondary-text-color);}
    .kr-big{font-size:4.6rem;line-height:1.1;}
    .kr-big.kr-pop{animation:kr-pop .2s ease-out;}
    @keyframes kr-pop{from{transform:scale(.85);opacity:0;}to{transform:scale(1);opacity:1;}}
    .kr-txt{font-size:1.35rem;font-weight:800;line-height:1.2;color:var(--primary-text-color);overflow-wrap:anywhere;}
    .kr-sub{font-size:.9rem;color:var(--secondary-text-color);}
    .kr-go{width:100%;box-sizing:border-box;min-height:56px;margin-top:4px;padding:16px;border:none;border-radius:var(--fp-radius,16px);background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));font-size:1.15rem;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .1s;}
    .kr-go:active:not(:disabled){transform:scale(.97);}
    .kr-back{min-height:40px;padding:8px 14px;border:none;border-radius:var(--fp-radius-sm,12px);background:transparent;color:var(--secondary-text-color);font-size:.9rem;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;}
    .kr-act:disabled{opacity:.55;cursor:default;}
    .kr-act:focus-visible,.kr-tab:focus-visible{outline:2px solid var(--fp-accent,var(--primary-color));outline-offset:2px;}
    .kr-empty{text-align:center;padding:16px 0;font-size:.9rem;color:var(--secondary-text-color);}
    @media (prefers-reduced-motion: reduce){.kr-drop,.kr-big.kr-pop{animation:none !important;}.kr-go{transition:none;}.kr-go:active:not(:disabled){transform:none;}}
    `;
  }
  getCardSize() { return 5; }
}
if (!customElements.get("kids-routine-card")) {
  customElements.define("kids-routine-card", KidsRoutineCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "kids-routine-card", name: "Kids Routine Card", description: "Kinder-Routinen Schritt für Schritt" });
}
})();

/* ===== shopping-fav-card v26 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Liste kurz nicht erreichbar: Eintrag wartet und wird nachgeschickt statt still verloren, wartende Favoriten bleiben mit ✓ markiert; davor: embedded: true ohne eigenen Rahmen, kompakter, für die Aufgabenkarte; davor: großer Knopf unter der Schnellauswahl, wenn beides sichtbar ist; davor: Favoriten als gleich breite Chips mit Emoji oben, schon auf der Liste mit ✓ und ohne Doppel, ✏️ im Kopf, großer Knopf in Akzent, Farben nur aus dem Theme; davor: Datumsfeld passt aufs iPhone, Datumsfeld als vierter Knopf in der Bis-wann-Reihe, Wiederholung mit eigenen Intervallen wie „alle 2 Wochen") ===== */
(() => {
const U = window.__fpUtils;
const CP = U.cp;
// Die Liste list_entity wird live gelesen (todo/item/subscribe), damit Favoriten, die schon
// offen auf der Liste stehen, mit ✓ markiert sind und nicht doppelt angelegt werden.
class ShoppingFavCard extends HTMLElement {
  constructor() {
    super();
    this._timers = new Set();
    this._gen = 0; this._unsub = null; this._subbing = false; this._failAt = 0;
    this._open = [];           // Namen der offenen Einträge, normalisiert
    this._optim = new Map();   // gerade angelegt, noch nicht im Abo: Name -> Zeit
    this._markSig = ""; this._flashing = 0;
    this._onQueue = () => this._sync();   // Warteschlange hat sich bewegt: Markierungen neu
  }
  setConfig(config) {
    if (!config || !config.list_entity) throw new Error("list_entity (todo-Liste) erforderlich");
    this._unsubscribe();
    this.config = Object.assign({
      columns: 3, store_entity: "", title: "", assign: false, targets: [], default_target: "",
      big: false, fallback: "", add_button: false, add_label: "", show_due: true, target_label: "Wer?",
      // Serienaufgaben: nur moeglich, wenn das Ziel eine Todoist-Liste mit project_id ist.
      // Home Assistant reicht kein Wiederholungsmuster durch, deshalb legt die Karte solche
      // Aufgaben direkt ueber die Todoist-Schnittstelle an (rest_command).
      repeat_options: [], repeat_label: "Wiederholung", todoist_service: "rest_command.todoist_add_task",
      // embedded: sitzt in der Aufgabenkarte (fp-todo-card, Option favorites), die den Rahmen stellt
      embedded: false,
    }, config || {});
    this._editing = false; this._lastVal = null; this._built = false;
    this._open = []; this._optim.clear(); this._markSig = ""; this._failAt = 0;
    if (this.isConnected) this._subscribe();
  }
  connectedCallback() { window.addEventListener("fp-todo-queue", this._onQueue); this._subscribe(); this._sync(); }
  disconnectedCallback() {
    window.removeEventListener("fp-todo-queue", this._onQueue);
    this._timers.forEach(t => clearTimeout(t)); this._timers.clear();
    this._unsubscribe();
  }
  set hass(hass) {
    this._hass = hass;
    this._subscribe();
    if (this._editing) return;
    const v = this._storeVal();
    if (v !== this._lastVal || !this._built) { this._lastVal = v; this._render(); }
  }
  _after(fn, ms) {
    const t = setTimeout(() => { this._timers.delete(t); fn(); }, ms);
    this._timers.add(t);
  }
  // Dialoge öffnen über U.lightbox als nativer <dialog> in der obersten Ebene (immer mittig im Bildschirm) und hängen im
  // Baum an der Karte selbst; eingebettet in die Aufgabenkarte am Element der Aufgabenkarte.
  _ovRoot() { return this.config.embedded && this._ovHost && this._ovHost.isConnected ? this._ovHost : this; }

  // ---------- „Schon auf der Liste“ (Abo auf list_entity) ----------
  // Tipp legt direkt an (kein Zuweisen-Blatt) und es gibt Favoriten, die man markieren kann
  _assigning() { return !!(this.config.assign && (this.config.targets || []).length); }
  _marking() { return !!(this.config.store_entity && !this._assigning()); }
  _showFavs() {
    // Favoriten und Hinzufügen-Knopf sind kombinierbar. Ohne ausdrückliche
    // Angabe bleibt das alte Verhalten: mit Knopf nur der Knopf (kompakte
    // Übersicht), ohne Knopf nur die Favoriten.
    return this.config.show_favorites !== undefined ? !!this.config.show_favorites : !this.config.add_button;
  }
  _live() { return !!(this._unsub || this._subbing); }
  _subscribe() {
    if (this._unsub || this._subbing || !this._hass || !this.isConnected || !this.config || !this._marking()) return;
    if (Date.now() - this._failAt < 30000) return;   // nach einem Fehler nicht bei jedem hass-Update neu versuchen
    const conn = this._hass.connection;
    if (!conn || !conn.subscribeMessage) return;
    const gen = this._gen;
    this._subbing = true;
    let p;
    try { p = conn.subscribeMessage(msg => { if (gen === this._gen) this._onItems(msg); }, { type: "todo/item/subscribe", entity_id: this.config.list_entity }); }
    catch (e) { p = Promise.reject(e); }
    p.then(unsub => {
      if (gen !== this._gen) { try { const r = unsub(); if (r && r.catch) r.catch(() => {}); } catch (e) {} return; }   // inzwischen abgehängt oder umkonfiguriert
      this._subbing = false; this._unsub = unsub;
    }).catch(() => {
      if (gen !== this._gen) return;
      this._subbing = false; this._failAt = Date.now();   // still: dann eben ohne Markierung
    });
  }
  _unsubscribe() {
    this._gen++; this._subbing = false;
    const u = this._unsub; this._unsub = null;
    if (u) { try { const r = u(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  }
  _key(s) { return this._norm(String(s == null ? "" : s)).replace(/\s+/g, " ").trim(); }
  _onItems(msg) {
    const items = Array.isArray(msg && msg.items) ? msg.items : [];
    this._open = items.filter(i => i && i.status === "needs_action").map(i => this._key(i.summary)).filter(Boolean);
    // Vorab-Markierungen weg, sobald das Abo den Eintrag bringt (oder sie abgelaufen sind)
    const now = Date.now();
    for (const [k, t] of [...this._optim]) if (this._isOpen(k) || now - t >= 20000) this._optim.delete(k);
    this._sync();
  }
  // offener Eintrag mit gleichem Namen, oder mit Menge davor („200 g Butter“)
  _isOpen(k) { return this._open.some(s => s === k || s.endsWith(" " + k)); }
  _isMarked(name) {
    if (!this._marking()) return false;
    const k = this._key(name);
    if (!k) return false;
    if (this._isOpen(k)) return true;
    // wartet noch in der Warteschlange (Liste kurz nicht erreichbar): zählt als „auf der Liste“, kein Doppel
    if (U.addPending(this.config.list_entity).some(s => this._key(s) === k)) return true;
    const t = this._optim.get(k);
    return !!t && Date.now() - t < 20000;
  }
  _markOptimistic(name) {
    if (!this._marking() || !this._live()) return;
    const k = this._key(name);
    if (!k) return;
    this._optim.set(k, Date.now());
    this._after(() => this._sync(), 20100);   // abgelaufene Vorab-Markierung wieder wegnehmen
  }
  _marksSig() {
    if (!this._showFavs() || !this._marking()) return "";
    return this._items().map(f => this._isMarked(f) ? "1" : "0").join("");
  }
  // Neu zeichnen nur, wenn sich Markierungen ändern; nie unter einem offenen Blatt oder mitten im „Hinzugefügt“
  _sync() {
    if (!this._built) return;
    if (this._aov) this._paintPicks();
    if (this._editing || this._flashing) return;
    if (this._marksSig() !== this._markSig) this._render();
  }
  // Favoriten-Chips im Hinzufügen-Blatt: markiert nur, wenn das gewählte Ziel die überwachte Liste ist
  _paintPicks() {
    if (!this._aov) return;
    const on = this._marking() && this._sel === this.config.list_entity;
    this._aov.querySelectorAll(".sf-favpick").forEach(b => b.classList.toggle("sf-on", on && this._isMarked(b.dataset.n)));
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
    if (ent === this.config.list_entity) this._markOptimistic(name);   // gilt sofort als „auf der Liste“, bis das Abo es bringt
    // Ist die Liste gerade weg, wartet der Eintrag und wird nachgeschickt (U.addItem, mit Hinweis)
    const t = U.addItem(this, this._hass, data);
    window.dispatchEvent(new CustomEvent("fp-todo-add", { detail: { entity: ent, summary: name, due: due || null, qid: t.id } }));
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
    U.lightbox(this._ovRoot(), ov, () => this._closeAssign());
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
    this._sync();   // Markierungen, die sich unter dem Blatt geändert haben
  }
  _openAdd() {
    this._editing = true;
    const targets = this.config.targets || [];
    const def = this.config.default_target || this.config.list_entity || (targets[0] && targets[0].entity) || "";
    this._sel = def; this._due = "";
    const favs = this._items();
    const favChips = favs.map(f => `<button class="sf-favpick" data-n="${this._esc(f)}">${this._emoji(f)} ${this._esc(f)}<span class="sf-ck">${CP(0x2713)}</span></button>`).join("");
    const tbtns = targets.map(t => `<button class="sf-tgt${t.entity === def ? " sf-tgt-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    const dueHtml = this.config.show_due ? this._dueHtml() : "";
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._aov = ov;
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">${CP(0x2795)} ${this._esc(this.config.add_label || "Hinzufügen")}</div><input class="sf-addtext" type="text" placeholder="Eingeben..."/>${favChips ? `<div class="sf-sub">Favoriten</div><div class="sf-favs">${favChips}</div>` : ""}${tbtns ? `<div class="sf-sub">${this._esc(this.config.target_label || "Wer?")}</div><div class="sf-tgts">${tbtns}</div>` : ""}${dueHtml}${this._repeatHtml()}<div class="sf-foot"><button class="sf-cancel">Abbrechen</button><button class="sf-ok">Hinzufügen</button></div></div>`;
    U.lightbox(this._ovRoot(), ov, () => this._closeAssign());
    const txt = ov.querySelector(".sf-addtext");
    const syncRep = this._wireRepeat(ov);
    ov.addEventListener("click", e => { if (e.target === ov) this._closeAssign(); });
    ov.querySelectorAll(".sf-favpick").forEach(b => b.addEventListener("click", () => { txt.value = b.dataset.n; }));
    ov.querySelectorAll(".sf-tgt").forEach(b => b.addEventListener("click", () => { this._sel = b.dataset.e; ov.querySelectorAll(".sf-tgt").forEach(x => x.classList.toggle("sf-tgt-on", x === b)); if (syncRep) syncRep(); this._paintPicks(); }));
    this._paintPicks();
    this._wireDue(ov);
    const submit = () => { const t = txt.value.trim(); if (!t) { txt.focus(); return; } this._addItem(t, this._sel || def, this._due, this._rep); this._closeAssign(); };
    txt.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    ov.querySelector(".sf-cancel").addEventListener("click", () => this._closeAssign());
    ov.querySelector(".sf-ok").addEventListener("click", submit);
  }
  _flash(b) {
    const o = b.innerHTML; b.classList.add("sf-added"); b.innerHTML = CP(0x2713) + " Hinzugefügt";
    this._flashing++;   // währenddessen nicht neu zeichnen, sonst verschwindet die Rückmeldung
    setTimeout(() => {
      b.classList.remove("sf-added"); b.innerHTML = o;
      this._flashing = Math.max(0, this._flashing - 1);
      this._sync();   // jetzt darf der Favorit als „auf der Liste“ erscheinen
    }, 850);
  }
  _render() {
    this._built = true;
    const showFavs = this._showFavs();
    const assign = this._assigning();
    const mark = this._marking();
    let top = "", body = "", bottom = "";
    if (this.config.add_button) {
      // Mit Favoriten („Schnell anlegen“) unter den Kacheln, sonst allein als Kachel
      const bar = `<div class="sf-addbar${showFavs ? " sf-below" : ""}"><button class="sf-addbig"><span class="sf-ic">${CP(0x2795)}</span><span>${this._esc(this.config.add_label || "Aufgabe hinzufügen")}</span></button></div>`;
      if (showFavs) bottom = bar; else top = bar;
    }
    if (showFavs) {
      const items = this._items();
      const cols = Math.max(1, parseInt(this.config.columns, 10) || 3);
      const big = this.config.big ? " sf-big" : "";
      const chips = items.map(it => {
        const on = mark && this._isMarked(it);
        return `<button class="sf-chip${big}${on ? " sf-on" : ""}" data-n="${this._esc(it)}"><span class="sf-em">${this._emoji(it)}</span><span class="sf-nm">${this._esc(it)}</span>${on ? `<span class="sf-ck">${CP(0x2713)}</span>` : ""}</button>`;
      }).join("");
      // Kopf: Titel (oder kleiner Abschnittstitel) links, Bearbeiten rechts
      const lead = this.config.title ? `<div class="sf-title">${this._esc(this.config.title)}</div>` : `<div class="sf-sec">Favoriten</div>`;
      body = `<div class="sf-head">${lead}<button class="sf-edit" aria-label="Favoriten bearbeiten"><span class="sf-ic">${CP(0x270F) + CP(0xFE0F)}</span><span>Bearbeiten</span></button></div>`
           + `<div class="sf-grid" lang="de" style="--sf-cols:${cols};">${chips || `<div class="sf-empty">Noch keine Favoriten</div>`}</div>`;
    }
    this._markSig = this._marksSig();
    if (this.config.embedded) {
      // ohne ha-card: Rahmen, Hintergrund und Schatten gehören der Aufgabenkarte
      this.style.display = "block";
      this.innerHTML = `<div class="sf-card sf-emb">${top}${body}${bottom}</div>${this._styles()}`;
    } else this.innerHTML = `<ha-card class="sf-card${this.config.add_button && !showFavs ? " sf-addcard" : ""}">${top}${body}${bottom}</ha-card>${this._styles()}`;

    const ab = this.querySelector(".sf-addbig");
    if (ab) ab.addEventListener("click", () => this._openAdd());
    this.querySelectorAll(".sf-chip").forEach(b => b.addEventListener("click", () => {
      const n = b.dataset.n;
      if (assign) { this._openAssign(n); return; }
      // steht schon offen auf der Liste: nichts anlegen
      if (this._isMarked(n)) { this._toast(`„${n}“ steht schon auf der Liste`); return; }
      this._addItem(n, this.config.list_entity); this._flash(b);
    }));
    const eb = this.querySelector(".sf-edit"); if (eb) eb.addEventListener("click", () => this._openEditor());
  }
  _openEditor() {
    this._editing = true;
    this._draft = this._items();
    const ov = document.createElement("div"); ov.className = "sf-ov"; this._ov = ov;
    ov.innerHTML = `<div class="sf-modal"><div class="sf-mhead">Favoriten bearbeiten</div><div class="sf-list"></div><div class="sf-addrow"><input class="sf-new" type="text" placeholder="Neuer Favorit..."><button class="sf-addbtn">${CP(0x2795)} Hinzufügen</button></div><div class="sf-foot"><button class="sf-done">Fertig</button></div></div>`;
    U.lightbox(this._ovRoot(), ov, () => this._closeEditor());
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
      /* Farben und Radien kommen aus dem Theme (--fp-*); nach dem Komma steht der Rückfall für Themes ohne diese Zeilen. */
      .sf-card{padding:14px;}
      /* Kopf: Titel (oder kleiner Abschnittstitel) links, Bearbeiten rechts */
      .sf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;min-height:36px;}
      .sf-title{font-weight:700;min-width:0;overflow-wrap:anywhere;}
      .sf-sec{font-size:.64rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--secondary-text-color);}
      .sf-edit{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:36px;box-sizing:border-box;padding:0 12px;border:1px solid var(--divider-color);border-radius:999px;background:transparent;color:var(--secondary-text-color);font-size:.76rem;font-weight:800;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      /* Raster: höchstens --sf-cols Spalten, auf schmalen Karten weniger (mindestens 96px), alle gleich breit */
      .sf-grid{display:grid;gap:var(--sf-gap,8px);grid-template-columns:repeat(auto-fill,minmax(max(var(--sf-min,96px),calc((100% - (var(--sf-cols,3) - 1) * var(--sf-gap,8px)) / var(--sf-cols,3) - 1px)),1fr));}
      .sf-chip{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:68px;box-sizing:border-box;padding:8px 6px;border:none;border-radius:var(--fp-radius-sm,12px);background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font-size:.82rem;font-weight:700;line-height:1.15;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .sf-ic{flex:none;line-height:1;}
      .sf-em{font-size:1.45rem;line-height:1;}
      /* Namen trennen nach Silben (lang="de" am Raster), nie mitten im Wort hart umbrechen; zwei Zeilen, ein zu langes Wort wird am Rand abgeschnitten */
      .sf-nm{max-width:100%;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:normal;word-break:normal;-webkit-hyphens:auto;hyphens:auto;}
      .sf-chip.sf-big{min-height:84px;}
      .sf-chip.sf-big .sf-em{font-size:1.7rem;}
      .sf-chip.sf-big .sf-nm{font-size:.92rem;}
      @media (hover:hover){.sf-chip:not(.sf-on):hover{background:var(--fp-surface-2,var(--divider-color));}}
      .sf-chip:active{transform:scale(.97);}
      /* steht schon offen auf der Liste: Rand und Schrift in Akzent, kleines ✓ oben rechts */
      .sf-chip.sf-on{background:transparent;color:var(--fp-accent,var(--primary-color));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--fp-accent,var(--primary-color)) 60%,transparent);}
      .sf-chip .sf-ck{position:absolute;top:5px;right:7px;font-size:.7rem;font-weight:800;line-height:1;}
      .sf-added{background:var(--fp-accent,var(--primary-color))!important;color:var(--fp-accent-fg,var(--text-primary-color,#fff))!important;box-shadow:none!important;}
      .sf-empty{grid-column:1/-1;color:var(--secondary-text-color);padding:8px;text-align:center;}
      /* embedded: in der Aufgabenkarte ohne eigenen Rahmen und Innenabstand; Titel als kleines Abschnitts-Label, Kacheln kompakter */
      .sf-card.sf-emb{padding:0;}
      .sf-emb .sf-head{min-height:0;margin-bottom:8px;}
      .sf-emb .sf-title,.sf-emb .sf-sec{font-size:.64rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--secondary-text-color);}
      .sf-emb .sf-edit{min-height:30px;gap:4px;padding:0 10px;font-size:.7rem;}
      .sf-emb .sf-grid{--sf-min:78px;--sf-gap:6px;}
      .sf-emb .sf-chip{min-height:56px;gap:2px;padding:6px 4px;font-size:.78rem;}
      .sf-emb .sf-em{font-size:1.2rem;}
      .sf-emb .sf-chip.sf-big{min-height:64px;}
      .sf-emb .sf-chip.sf-big .sf-em{font-size:1.35rem;}
      .sf-emb .sf-chip.sf-big .sf-nm{font-size:.82rem;}
      .sf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:20;}
      .sf-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(92vw,420px);max-height:82vh;overflow:auto;border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
      .sf-mhead{font-size:1.05rem;font-weight:700;margin-bottom:12px;}
      .sf-list{display:flex;flex-direction:column;gap:6px;}
      .sf-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--fp-surface,var(--secondary-background-color));border-radius:10px;padding:6px 8px;}
      .sf-rlbl{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .sf-acts{display:flex;gap:2px;flex:none;}
      .sf-acts button{border:none;background:transparent;cursor:pointer;font-size:1rem;padding:4px 7px;color:var(--secondary-text-color);border-radius:8px;}
      .sf-acts button:hover{background:color-mix(in srgb,var(--primary-text-color) 12%,transparent);}
      .sf-acts .sf-x{color:var(--error-color,#c62828);}
      .sf-addrow{display:flex;gap:8px;margin-top:14px;}
      .sf-new{flex:1;border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-addbtn{border:none;border-radius:10px;padding:10px 12px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;cursor:pointer;white-space:nowrap;}
      .sf-foot{margin-top:16px;display:flex;justify-content:flex-end;}
      .sf-done{border:none;border-radius:10px;padding:10px 18px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font-weight:600;cursor:pointer;}
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
      .sf-date[type=date],.sf-date[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;} .sf-date::-webkit-date-and-time-value{text-align:center;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
      /* Leeres date-Feld zeigt sonst nur "tt.mm.jjjj" auf Weiß — die Auflage
         beschriftet es wie einen Knopf und lässt Tipps durch (pointer-events). */
      .sf-datewrap.sf-dempty::after{content:"Datum wählen";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:.9rem;pointer-events:none;}
      .sf-datewrap.sf-dsel .sf-date{background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);border-color:transparent;font-weight:600;}
      .sf-foot .sf-cancel{border:none;border-radius:10px;padding:10px 16px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font-weight:600;cursor:pointer;margin-right:8px;}
      .sf-foot .sf-ok{border:none;border-radius:10px;padding:10px 22px;background:rgba(var(--fp-accent-rgb,79,195,247),.95);color:var(--fp-accent-fg,#013);font-weight:700;cursor:pointer;}
      /* Großer Knopf: volle Breite in Akzent; bei „Schnell anlegen“ unter den Kacheln mit den Favoriten */
      .sf-addbar{display:flex;margin-bottom:14px;}
      .sf-addbar.sf-below{margin:14px 0 0;}
      .sf-addbig{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;box-sizing:border-box;border:none;border-radius:var(--fp-radius-sm,12px);padding:12px;background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));font-weight:800;font-size:1rem;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .sf-addbig:active{transform:scale(.99);}
      @media (hover:hover){.sf-addbig:hover{filter:brightness(1.06);}}
      /* Zeigt die Karte nur den Knopf, ist der Knopf die Kachel: kein Rahmen,
         keine Innenabstaende, eine durchgehende Flaeche. */
      .sf-addcard{padding:0;background:transparent;border:none;box-shadow:none;}
      .sf-addcard .sf-addbar{margin:0;}
      .sf-addcard .sf-addbig{border-radius:var(--ha-card-border-radius,12px);padding:15px 12px;}
      .sf-addtext{width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;padding:11px;background:var(--card-background-color);color:var(--primary-text-color);font-size:1rem;}
      .sf-favs{display:flex;gap:8px;flex-wrap:wrap;}
      .sf-favpick{border:1px solid var(--divider-color);border-radius:12px;padding:12px 14px;min-height:46px;box-sizing:border-box;display:flex;align-items:center;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:1rem;font-weight:600;cursor:pointer;}
      .sf-favpick:active{transform:scale(.97);}
      .sf-favpick:hover{background:var(--primary-color);color:var(--text-primary-color,#fff);}
      /* schon auf der Liste (nur wenn das Ziel die überwachte Liste ist) */
      .sf-favpick .sf-ck{display:none;margin-left:8px;font-weight:800;}
      .sf-favpick.sf-on,.sf-favpick.sf-on:hover{background:transparent;color:var(--fp-accent,var(--primary-color));border-color:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 60%,transparent);}
      .sf-favpick.sf-on .sf-ck{display:inline;}
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

/* ===== nav-card v4 (in horizontal-stack wieder nebeneinander statt zusammengedrueckt (fuellt die Rasterzelle, ohne HAs Stapel-Aufteilung zu ueberschreiben); davor: fuellt die Rasterzelle aus; wraps any card; pointer/text-cursor children stay interactive) ===== */
(() => {
const U = window.__fpUtils;
class NavCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.card) throw new Error("card (zu umhuellende Karte) erforderlich");
    this.config = config;
    this._built = false;
  }
  connectedCallback() {
    // _build kann vor dem Einhaengen laufen; dann war der hui-card noch nicht erreichbar
    const fz = U.fillZelle || U.fill;
    if (fz) fz(this);
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
    const fz = U.fillZelle || U.fill; // defensiv: fehlender Helfer darf die Karte nie killen
    if (fz) fz(this);
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

/* ===== fp-todo-card v22 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Änderungsdialog richtet sich nach den Fähigkeiten der Liste: „Bis wann?“ und due_date nur bei Listen mit Datum (Bring! hat keins), optionales Feld für die Beschreibung/Menge (description_label, description_placeholder), eigener Kopf und eigene Beschriftung für „Wer?“ (edit_title, targets_label), Enter speichert, Escape schließt; davor: Liste kurz nicht erreichbar: neue Einträge bleiben ausgegraut mit Hinweis stehen und werden nachgeschickt, Verschieben bricht ab statt den Eintrag zu verlieren; davor: Einkauf in einer Karte: add_placeholder, create_position: top, header_actions, eingebettete Favoriten, empty_style: compact; davor: in horizontal-stack wieder nebeneinander statt zusammengedrückt (füllt die Rasterzelle, ohne HAs Stapel-Aufteilung zu überschreiben); davor: Aufgaben ohne Datum bleiben auch mit due_date_period sichtbar, hide_undated blendet sie aus; davor: Beschreibung als zweite Zeile (show_description); schmale Karten: Chip unter dem Text; davor: zeichnet die Liste selbst statt die HA-Liste einzubetten: Gruppen nach Fälligkeit, Chips, großer Kreis zum Abhaken mit „Rückgängig“, Personenfarbe, empty_text, Liste ohne Kachelflächen; Datumsfeld passt aufs iPhone, Namens-Pille als Kartenkopf, Farben über Theme-Variablen, eigene Wiederholungs-Intervalle im Änderungsdialog) ===== */
// Die Liste kommt live aus dem Abo todo/item/subscribe und wird im Stil der Baby-Übersicht
// selbst gezeichnet. Der eigene Änderungsdialog (edit_dialog) und das optimistische
// Hinzufügen über das Ereignis fp-todo-add bleiben.
(() => {
const U = window.__fpUtils;
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];   // Date.getDay(): 0 = Sonntag
class FpTodoCard extends HTMLElement {
  constructor() {
    super();
    this._items = null;        // null = noch nichts geladen
    this._pending = [];        // gerade angelegt, noch nicht im Abo: { uid, summary, description, key, due, base, t }
    this._ovr = new Map();     // abgehakt/wieder geöffnet, noch unbestätigt: uid -> { status, t }
    this._keep = new Map();    // gerade abgehakt, bleibt kurz sichtbar: uid -> { until, item }
    this._timers = new Set();
    this._gen = 0; this._pseq = 0; this._failAt = 0;
    this._unsub = null; this._subbing = false; this._built = false; this._sig = "";
    this._acts = [];           // header_actions: Pillen im Kopf, die einen Dienst rufen
    this._busy = new Set();    // Pillen, deren Dienst gerade läuft (Index in _acts)
    this._favEl = null;        // eingebettete Favoriten (shopping-fav-card), einmal angelegt und behalten
    this._onAdd = e => {
      const d = e.detail || {};
      if (this.config && d.entity === this.config.entity && d.summary) this._optimistic(String(d.summary), d.due || null, d.description, d.qid);
    };
    // Warteschlange (U.addItem) hat sich bewegt: wartende Zeilen neu zeichnen, zugestellte nach 20 s aufräumen
    this._onQueue = () => { this._paint(); this._after(() => this._paint(), 20100); };
    // Escape schließt den Änderungsdialog, auch wenn der Fokus nicht im Dialog liegt (nur solange er offen ist)
    this._onKey = e => { if (e.key === "Escape" && this._ov) { e.stopPropagation(); e.preventDefault(); this._closeEdit(); } };
  }
  setConfig(config) {
    if (!config || !config.entity) throw new Error("entity erforderlich");
    this._unsubscribe();
    this.config = config;
    // Eigener Änderungsdialog statt des nativen: erlaubt Verschieben in eine
    // andere Liste, Datum-Schnellauswahl und Serien (letztere nur bei Todoist).
    this._edit = !!config.edit_dialog;
    this._targets = config.edit_targets || config.targets || [];
    this._repeats = config.repeat_options || [];
    // Beschriftungen des Dialogs; leer = Vorgabe. Das Beschreibungsfeld gibt es nur, wenn
    // description_label oder description_placeholder gesetzt ist (und die Liste Beschreibungen kann).
    const txt = v => v == null ? "" : String(v).trim();
    this._editTitle = txt(config.edit_title) || "Aufgabe bearbeiten";
    this._tgtLabel = txt(config.targets_label) || "Wer?";
    this._descLabel = txt(config.description_label);
    this._descPh = txt(config.description_placeholder);
    this._descEdit = !!(this._descLabel || this._descPh);
    this._items = null; this._err = false; this._errShown = false; this._loadedOnce = false; this._failAt = 0;
    this._pending = []; this._ovr.clear(); this._keep.clear();
    // Kopf-Pillen: nur Einträge mit Dienst „domain.service“ und etwas zum Beschriften
    this._acts = (Array.isArray(config.header_actions) ? config.header_actions : [])
      .filter(a => a && typeof a.service === "string" && a.service.indexOf(".") > 0 && (a.label || a.icon));
    this._busy.clear(); this._favEl = null;
    this._built = false;
    if (this.isConnected) { this._build(); this._subscribe(); this._paint(); }
  }
  connectedCallback() {
    window.addEventListener("fp-todo-add", this._onAdd);
    window.addEventListener("fp-todo-queue", this._onQueue);
    if (!this._tick) this._tick = setInterval(() => this._paint(), 60000);   // „heute/morgen“ wandert mit dem Tag
    if (!this._built && this.config) this._build();
    const fz = U.fillZelle || U.fill;
    if (fz) fz(this);   // jetzt hängt die Karte im DOM, hui-card ist erreichbar
    this._subscribe();
    this._paint();
  }
  disconnectedCallback() {
    window.removeEventListener("fp-todo-add", this._onAdd);
    window.removeEventListener("fp-todo-queue", this._onQueue);
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    this._timers.forEach(t => clearTimeout(t)); this._timers.clear();
    this._unsubscribe();
    this._closeEdit();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._built && this.config) this._build();
    if (this._favEl) this._favEl.hass = hass;
    this._subscribe();
  }
  _after(fn, ms) {
    const t = setTimeout(() => { this._timers.delete(t); fn(); }, ms);
    this._timers.add(t);
  }

  // ---------- Daten (Abo) ----------
  _subscribe() {
    if (this._unsub || this._subbing || !this._hass || !this.isConnected || !this.config) return;
    if (Date.now() - this._failAt < 30000) return;   // nach einem Fehler nicht bei jedem hass-Update neu versuchen
    const conn = this._hass.connection;
    if (!conn || !conn.subscribeMessage) return;
    const gen = this._gen, ent = this.config.entity;
    this._subbing = true;
    let p;
    try { p = conn.subscribeMessage(msg => { if (gen === this._gen) this._onItems(msg); }, { type: "todo/item/subscribe", entity_id: ent }); }
    catch (e) { p = Promise.reject(e); }
    p.then(unsub => {
      if (gen !== this._gen) { try { const r = unsub(); if (r && r.catch) r.catch(() => {}); } catch (e) {} return; }   // inzwischen abgehängt oder umkonfiguriert
      this._subbing = false; this._unsub = unsub;
    }).catch(err => {
      if (gen !== this._gen) return;
      this._subbing = false; this._failAt = Date.now();
      console.warn("[fp-todo-card] Abo fehlgeschlagen:", ent, err);
      if (this._items === null) this._err = true;
      // allerersten Ladefehler (Startup-Flackern) nicht melden, danach nur einmal je Störung
      if (this._loadedOnce && !this._errShown) U.toast(this, "Aufgabenliste konnte nicht geladen werden");
      this._errShown = true; this._loadedOnce = true;
      this._paint();
    });
  }
  _unsubscribe() {
    this._gen++; this._subbing = false;
    const u = this._unsub; this._unsub = null;
    if (u) { try { const r = u(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  }
  _key(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  _onItems(msg) {
    this._items = Array.isArray(msg && msg.items) ? msg.items : [];
    this._err = false; this._errShown = false; this._loadedOnce = true;
    const byUid = new Map(this._items.map(i => [i.uid, i]));
    // bestätigte (oder verschwundene) Zeilen brauchen die Vorab-Anzeige nicht mehr
    for (const [uid, o] of this._ovr) { const it = byUid.get(uid); if (!it || it.status === o.status) this._ovr.delete(uid); }
    // „ausstehend“: weg, sobald mehr offene Einträge gleichen Namens da sind als beim Anlegen
    const open = {};
    for (const i of this._items) if (i.status !== "completed") { const k = this._key(i.summary); open[k] = (open[k] || 0) + 1; }
    this._pending = this._pending.filter(p => (open[p.key] || 0) <= p.base);
    this._paint();
  }
  _expire() {
    const now = Date.now();
    // Vorab-Zeilen: 20 s ab Anlegen bzw. ab Zustellung aus der Warteschlange; wartende bleiben stehen
    this._pending = this._pending.filter(p => {
      const s = p.qid ? U.addState(p.qid) : null;
      if (s === "queued") return true;
      if (s === "failed") return false;
      return now - (typeof s === "number" ? Math.max(p.t, s) : p.t) < 20000;
    });
    for (const [uid, o] of this._ovr) if (now - o.t >= 20000) this._ovr.delete(uid);
    for (const [uid, k] of this._keep) if (k.until <= now) this._keep.delete(uid);
  }

  // ---------- Fälligkeit ----------
  _dayNum(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
  // due: "YYYY-MM-DD" oder ISO mit Uhrzeit -> { d: Date, day: Tageszahl, t: ms, time: "HH:MM" | "" }
  _parseDue(s) {
    if (!s) return null;
    s = String(s);
    let d, hasTime = false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
    else {
      d = new Date(s.replace(" ", "T")); hasTime = true;
      if (isNaN(d)) {
        const m2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (!m2) return null;
        d = new Date(+m2[1], +m2[2] - 1, +m2[3]); hasTime = false;
      }
    }
    const time = hasTime && (d.getHours() || d.getMinutes()) ? U.pad(d.getHours()) + ":" + U.pad(d.getMinutes()) : "";
    return { d, day: this._dayNum(d), t: d.getTime(), time };
  }
  // due_date_period: Tageszahl, bis zu der Aufgaben mit Datum gezeigt werden (Überfälliges eingeschlossen); null = kein Filter.
  // Aufgaben ohne Datum betrifft der Filter nicht (die blendet hide_undated aus).
  _limit(now) {
    const per = this.config.due_date_period;
    const c = per && per.calendar;
    if (!c) return null;
    const off = parseInt(c.offset, 10) || 0;
    const y = now.getFullYear(), mo = now.getMonth(), da = now.getDate();
    let end;
    if (c.period === "week") end = new Date(y, mo, da - ((now.getDay() + 6) % 7) + (off + 1) * 7 - 1);   // Woche beginnt am Montag, endet Sonntag
    else if (c.period === "month") end = new Date(y, mo + off + 1, 0);
    else if (c.period === "year") end = new Date(y + off + 1, 0, 0);
    else end = new Date(y, mo, da + off);
    return this._dayNum(end);
  }
  _dm(d) { return d.getDate() + "." + (d.getMonth() + 1) + "."; }
  // Beschreibung für die zweite Zeile: Zeilenumbrüche werden zu Leerzeichen, leer = keine Zeile
  _descText(v) { return v == null ? "" : String(v).replace(/\s*[\r\n]+\s*/g, " ").trim(); }
  _chip(due, today) {
    const diff = due.day - today;
    if (diff < 0) return { c: "ov", t: diff === -1 ? "gestern" : diff >= -6 ? "seit " + WD[due.d.getDay()] : "seit " + this._dm(due.d) };
    if (diff === 0) return { c: "td", t: due.time ? "heute " + due.time : "heute" };
    if (diff === 1) return { c: "nx", t: "morgen" };
    return { c: "nx", t: diff <= 6 ? WD[due.d.getDay()] : this._dm(due.d) };
  }

  // ---------- Aufbereiten ----------
  // Aus Abo-Daten, Vorab-Anzeigen und Einstellungen die Zeilen samt Gruppen bauen.
  _model() {
    const cfg = this.config, nowD = new Date(), nowMs = nowD.getTime(), today = this._dayNum(nowD);
    const hideDone = cfg.hide_completed !== false;
    const lim = this._limit(nowD);
    const hideUndated = cfg.hide_undated === true;   // Vorgabe aus: Aufgaben ohne Datum bleiben sichtbar
    const showDesc = cfg.show_description !== false;   // Vorgabe an: Beschreibung (z. B. Menge bei Einkaufslisten) als zweite Zeile
    const src = [];
    for (const p of this._pending) src.push({ uid: p.uid, summary: p.summary, description: p.description, status: "needs_action", due: p.due, pend: true, wait: !!p.qid && U.addState(p.qid) === "queued" });
    const seen = new Set();
    for (const it of (this._items || [])) { src.push(it); seen.add(it.uid); }
    // gerade abgehakt und aus der Liste schon verschwunden (z. B. Cloud-Listen): kurz noch zeigen
    for (const [uid, k] of this._keep) if (!seen.has(uid) && k.until > nowMs) src.push(k.item);
    const rows = [];
    src.forEach((it, i) => {
      const ov = this._ovr.get(it.uid);
      const done = (ov ? ov.status : it.status) === "completed";
      const k = this._keep.get(it.uid);
      const kept = !it.pend && !!k && k.until > nowMs;
      if (done && hideDone && !kept) return;
      const due = this._parseDue(it.due);
      if (lim !== null && !it.pend) {   // Filter: nur Offenes, mit Datum nur bis Zeitraumende; ohne Datum bleibt (frisch Angelegtes bleibt kurz als Rückmeldung)
        if (done && !kept) return;
        if (due && due.day > lim) return;
      }
      if (hideUndated && !due && !it.pend) return;   // hide_undated: Aufgaben ohne Datum ausblenden
      const grp = done && !kept ? "done" : !due ? "none" : due.day < today ? "ov" : due.day === today ? "td" : "nx";
      rows.push({ u: it.uid, s: String(it.summary == null ? "" : it.summary), d: it.wait ? "⏳ Liste nicht erreichbar – wird nachgeschickt" : showDesc ? this._descText(it.description) : "", done, pend: !!it.pend, due, i, grp, chip: !done && due ? this._chip(due, today) : null });
    });
    const open = rows.filter(r => !r.done).length;
    const groups = [];
    if (cfg.display_order === "duedate_asc") {
      const byDue = (a, b) => (a.due.t - b.due.t) || (a.i - b.i);
      const add = (key, title, list, sort) => { if (list.length) groups.push({ key, title, rows: sort ? list.sort(byDue) : list }); };
      const pick = g => rows.filter(r => r.grp === g);
      add("ov", "Überfällig", pick("ov"), true);
      add("td", "Heute", pick("td"), true);
      add("nx", "Demnächst", pick("nx"), true);
      add("none", "Ohne Datum", pick("none"), false);
      add("done", "Erledigt", pick("done"), false);
    } else {
      const act = rows.filter(r => r.grp !== "done"), dn = rows.filter(r => r.grp === "done");
      if (cfg.display_order === "alpha_asc") {
        const byName = (a, b) => a.s.localeCompare(b.s, "de") || (a.i - b.i);
        act.sort(byName); dn.sort(byName);
      }
      if (act.length) groups.push({ key: "all", title: "", rows: act });
      if (dn.length) groups.push({ key: "done", title: "Erledigt", rows: dn });
    }
    return { groups, open };
  }

  // ---------- Zeichnen ----------
  _build() {
    this._closeEdit();
    this._built = true; this._sig = "";
    const c = this.config;
    // add_placeholder: Platzhalter der Eingabe (Vorgabe „Neue Aufgabe“); create_position: top setzt die Eingabe unter den Kopf
    const ph = c.add_placeholder != null && String(c.add_placeholder) !== "" ? String(c.add_placeholder) : "";
    const top = c.create_position === "top";
    const add = c.hide_create === true ? "" :
      `<div class="fpt-add${top ? " fpt-add-top" : ""}"><input class="fpt-in" type="text" placeholder="${U.esc(ph || "Neue Aufgabe")}" aria-label="${U.esc(ph || "Neue Aufgabe")}" enterkeyhint="done" autocomplete="off"><button type="button" class="fpt-plus" aria-label="${ph ? "Hinzufügen" : "Aufgabe hinzufügen"}">＋</button></div>`;
    // Favoriten (eingebettete shopping-fav-card) unter der Liste, bei unten stehender Eingabe unter dieser
    const favs = c.favorites && typeof c.favorites === "object" ? `<div class="fpt-favs"></div>` : "";
    // Farbe des Abhak-Kreises: die Personenfarbe der Pille, bei der alten Form (bg + color) und ohne Farbe der Akzent
    const pc = c.pill;
    const dot = pc && typeof pc === "object" && pc.color && !pc.bg ? String(pc.color) : "";
    this.innerHTML = `<ha-card class="fpt-card"${dot ? ` style="${U.esc("--fpt-dot:" + dot)}"` : ""}><div class="fpt-body"><div class="fpt-head${this._acts.length ? " fpt-head-a" : ""}" hidden></div>${top ? add : ""}<div class="fpt-list" lang="de"></div>${top ? "" : add}${favs}</div></ha-card>${this._styles()}`;
    const fz = U.fillZelle || U.fill;
    if (fz) fz(this);
    const card = this.querySelector(".fpt-card");
    this._head = card.querySelector(".fpt-head");
    this._list = card.querySelector(".fpt-list");
    if (favs) this._mountFavs(card.querySelector(".fpt-favs"));
    card.addEventListener("click", e => this._onClick(e));
    const inp = card.querySelector(".fpt-in");
    if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); this._add(); } });
    this._paint();
  }
  // Die Favoriten sind eine shopping-fav-card mit embedded: true. Die Instanz bleibt über Neuzeichnen und
  // hass-Updates erhalten (neu angelegt wird sie nur mit setConfig); list_entity ist die eigene Liste.
  _mountFavs(slot) {
    if (!slot) return;
    if (!this._favEl) {
      const tag = "shopping-fav-card";
      if (!customElements.get(tag)) { console.warn("[fp-todo-card] shopping-fav-card nicht geladen: Favoriten fehlen"); return; }
      const el = document.createElement(tag);
      try { el.setConfig(Object.assign({}, this.config.favorites, { list_entity: this.config.favorites.list_entity || this.config.entity, embedded: true })); }
      catch (e) { console.warn("[fp-todo-card] favorites:", e); return; }
      el._ovHost = this;   // Dialoge der Favoriten hängen an dieser Karte, nicht an deren Rahmen (siehe _ovRoot der Favoriten)
      this._favEl = el;
    }
    slot.appendChild(this._favEl);
    if (this._hass) this._favEl.hass = this._hass;
  }
  _pillStyle(p) {
    const bg = p.bg ? String(p.bg) : "", col = p.color ? String(p.color) : "";
    let b, f;
    if (bg && col) { b = bg; f = col; }   // alte Form: Hintergrund plus Schriftfarbe, genau diese beiden Werte
    else if (col) {                        // eine Farbe je Person: Grund und Schrift daraus, passt hell und dunkel
      b = `color-mix(in srgb, ${col} 22%, var(--ha-card-background, var(--card-background-color, #fff)))`;
      f = `color-mix(in srgb, ${col} 65%, var(--primary-text-color, #222))`;
    } else if (bg) { b = bg; f = "var(--primary-text-color)"; }
    else return "";                        // neutrale Pille über das CSS
    return U.esc(`--fpt-pbg:${b};--fpt-pfg:${f}`);
  }
  _headHtml(open) {
    const c = this.config;
    let p = c.pill;
    if (typeof p === "string") p = { label: p };
    let left = "";
    if (p) {
      const label = p.label || c.title || "";
      const st = this._pillStyle(p);
      if (label) left = `<span class="fpt-pill"${st ? ` style="${st}"` : ""}>${U.esc(label)}</span>`;
    } else if (c.title) left = `<div class="fpt-title">${U.esc(c.title)}</div>`;
    const right = open > 0 ? `<div class="fpt-cnt"><b>${open}</b><small>offen</small></div>` : "";
    return left + right + this._actsHtml();
  }
  // header_actions: kleine Pillen ganz rechts im Kopf; während der Dienst läuft, ist die Pille gesperrt
  _actsHtml() {
    if (!this._acts.length) return "";
    return `<div class="fpt-acts">${this._acts.map((a, i) =>
      `<button type="button" class="fpt-act" data-act="${i}"${this._busy.has(i) ? ` disabled aria-busy="true"` : ""}>${a.icon ? `<span class="fpt-act-i">${U.esc(a.icon)}</span>` : ""}${a.label ? `<span>${U.esc(a.label)}</span>` : ""}</button>`).join("")}</div>`;
  }
  _rowHtml(r) {
    const uid = U.esc(r.u);
    const ed = this._edit && !r.pend;
    return `<div class="fpt-row${r.done ? " fpt-done" : ""}${r.pend ? " fpt-pend" : ""}">`
      + `<button type="button" class="fpt-chk" role="checkbox" aria-checked="${r.done ? "true" : "false"}" aria-label="${r.done ? "Wieder öffnen" : "Erledigt"}"${r.pend ? " disabled" : ` data-uid="${uid}"`}><span class="fpt-circ"></span></button>`
      + `<div class="fpt-txt${ed ? " fpt-edit" : ""}"${ed ? ` data-uid="${uid}"` : ""}><span>${U.esc(r.s)}</span>${r.d ? `<div class="fpt-desc">${U.esc(r.d)}</div>` : ""}</div>`
      + (r.chip ? `<span class="fpt-chip fpt-c-${r.chip.c}">${U.esc(r.chip.t)}</span>` : "")
      + `</div>`;
  }
  // Neu zeichnen nur, wenn sich etwas Sichtbares ändert (Signatur): Daten, Vorab-Anzeigen oder der Tag.
  _paint() {
    if (!this._built || !this.config) return;
    this._expire();
    const m = this._model();
    const state = this._items !== null ? "ok" : this._err ? "err" : "wait";
    const sig = JSON.stringify([state, m.open, [...this._busy].join(), m.groups.map(g => [g.key, g.title, g.rows.map(r => [r.u, r.s, r.d, r.done, r.pend, r.chip ? r.chip.c + ":" + r.chip.t : ""])])]);
    if (sig === this._sig) return;
    this._sig = sig;
    this._nRows = m.groups.reduce((n, g) => n + g.rows.length, 0);
    const head = this._headHtml(m.open);
    this._head.innerHTML = head;
    this._head.hidden = !head;
    let html = "";
    if (m.groups.length) {
      html = m.groups.map(g =>
        (g.title ? `<div class="fpt-sec${g.key === "ov" ? " fpt-sec-ov" : ""}">${g.title}</div>` : "")
        + `<div class="fpt-rows">${g.rows.map(r => this._rowHtml(r)).join("")}</div>`).join("");
    } else if (state === "ok") {
      const t = this.config.empty_text != null ? String(this.config.empty_text) : "Alles erledigt";
      // empty_style: compact = eine leise Zeile „✓ Text“ statt des großen Hinweises mit Kreis
      html = this.config.empty_style === "compact"
        ? `<div class="fpt-empty fpt-empty-c"><i>✓</i>${t ? `<span>${U.esc(t)}</span>` : ""}</div>`
        : `<div class="fpt-empty"><div class="fpt-empty-i">✓</div>${t ? `<div>${U.esc(t)}</div>` : ""}</div>`;
    } else if (state === "err") {
      html = `<div class="fpt-empty"><div>Liste konnte nicht geladen werden</div></div>`;
    }
    this._list.innerHTML = html;
  }
  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .fpt-card{--fpt-s:var(--fp-surface,var(--secondary-background-color));--fpt-s2:var(--fp-surface-2,var(--divider-color));
        --fpt-mut:var(--secondary-text-color);--fpt-acc:var(--fp-accent,var(--primary-color,#4F6B57));--fpt-dot:var(--fpt-acc);--fpt-err:var(--error-color,#db4437);
        --fpt-al:var(--fp-alert,var(--warning-color,#b97f06));--fpt-alb:var(--fp-alert-bg,color-mix(in srgb,var(--warning-color,#b97f06) 18%,transparent));
        --fpt-r:var(--fp-radius-sm,12px);
        box-sizing:border-box;height:100%;display:flex;flex-direction:column;container-type:inline-size;color:var(--primary-text-color);}
      .fpt-body{flex:1 1 auto;min-height:0;box-sizing:border-box;padding:14px;display:flex;flex-direction:column;}
      :where(.fpt-card) button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;}
      /* Kopf: Pille (oder Titel) links, Zahl der offenen Aufgaben rechts */
      .fpt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;min-height:30px;}
      .fpt-head[hidden]{display:none;}
      .fpt-title{font-size:1.05rem;font-weight:800;letter-spacing:-.01em;min-width:0;overflow-wrap:break-word;}
      .fpt-pill{display:inline-block;min-width:0;max-width:100%;padding:4px 12px;border-radius:999px;font-size:.82rem;font-weight:800;letter-spacing:.01em;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        background:var(--fpt-pbg,var(--fp-surface,var(--secondary-background-color)));color:var(--fpt-pfg,var(--primary-text-color));}
      .fpt-cnt{display:flex;align-items:baseline;gap:5px;flex:none;margin-left:auto;white-space:nowrap;}
      .fpt-cnt b{font-size:1.45rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;}
      .fpt-cnt small{font-size:.72rem;font-weight:600;color:var(--fpt-mut);}
      /* mit Kopf-Pillen: Zahl rückt neben den Titel, die Pillen sitzen ganz rechts und brechen auf schmalen Karten um */
      .fpt-head-a{flex-wrap:wrap;justify-content:flex-start;row-gap:8px;}
      .fpt-head-a .fpt-cnt{margin-left:0;}
      .fpt-acts{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto;justify-content:flex-end;}
      .fpt-act{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:32px;box-sizing:border-box;padding:0 12px;border:1px solid var(--fpt-acc);border-radius:999px;background:transparent;color:var(--fpt-acc);font-size:.76rem;font-weight:800;white-space:nowrap;cursor:pointer;}
      .fpt-act-i{line-height:1;}
      .fpt-act:disabled{opacity:.55;cursor:default;}
      @media (hover:hover){.fpt-act:not(:disabled):hover{background:color-mix(in srgb,var(--fpt-acc) 12%,transparent);}}
      /* Liste */
      .fpt-list{flex:1 1 auto;min-height:0;}
      .fpt-sec{margin:12px 0 0;font-size:.64rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--fpt-mut);}
      .fpt-list>.fpt-sec:first-child{margin-top:0;}
      .fpt-sec-ov{color:var(--fpt-err);}
      .fpt-rows{display:flex;flex-direction:column;}
      /* Zeilen liegen ohne Fläche auf der Karte; eine Linie trennt sie innerhalb einer Gruppe (nicht über der ersten) */
      .fpt-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;min-height:46px;box-sizing:border-box;padding:0;}
      .fpt-row+.fpt-row{border-top:1px solid var(--divider-color);}
      .fpt-chk{flex:none;align-self:stretch;width:44px;min-height:44px;margin:0 0 0 -10px;padding:0;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;}
      .fpt-chk:disabled{cursor:default;}
      /* Kreis: Personenfarbe mit etwas Textfarbe gemischt — im Hellen dunkler, im Dunkeln heller, damit er auch bei dunklen Farben nicht verschwindet */
      .fpt-circ{position:relative;display:block;box-sizing:border-box;width:24px;height:24px;border-radius:50%;border:2px solid color-mix(in srgb, var(--fpt-dot) 75%, var(--primary-text-color, #222));transition:background .15s,border-color .15s,transform .1s;}
      .fpt-chk:active .fpt-circ{transform:scale(.86);}
      .fpt-done .fpt-circ{background:color-mix(in srgb, var(--fpt-dot) 75%, var(--primary-text-color, #222));}
      .fpt-done .fpt-circ::after{content:"";position:absolute;left:6px;top:2px;width:6px;height:11px;border:solid var(--fp-accent-fg,#fff);border-width:0 2.5px 2.5px 0;transform:rotate(45deg);}
      .fpt-txt{flex:1 1 0;min-width:0;align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding:8px 8px 8px 4px;font-size:.92rem;font-weight:700;line-height:1.3;overflow-wrap:break-word;word-break:normal;hyphens:auto;color:var(--primary-text-color);}
      .fpt-txt.fpt-edit{cursor:pointer;}
      /* Beschreibung: kleine zweite Zeile, höchstens zwei Zeilen */
      .fpt-desc{margin-top:1px;font-size:.76rem;font-weight:600;line-height:1.3;color:var(--secondary-text-color);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;word-break:normal;hyphens:auto;}
      .fpt-done .fpt-txt{color:var(--fpt-mut);font-weight:600;opacity:.65;}
      .fpt-done .fpt-txt span{text-decoration:line-through;}
      .fpt-pend{opacity:.5;}
      /* Fälligkeit */
      .fpt-chip{flex:none;margin-left:4px;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:800;line-height:1.4;white-space:nowrap;}
      .fpt-c-ov{background:color-mix(in srgb,var(--fpt-err) 16%,transparent);color:color-mix(in srgb,var(--fpt-err) 75%,var(--primary-text-color));}
      .fpt-c-td{background:var(--fpt-alb);color:color-mix(in srgb,var(--fpt-al) 75%,var(--primary-text-color));}
      .fpt-c-nx{background:var(--fpt-s2);color:var(--fpt-mut);}
      /* leer / Fehler */
      .fpt-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 8px;text-align:center;font-size:.9rem;font-weight:600;color:var(--fpt-mut);}
      .fpt-empty-i{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--fpt-s);color:var(--fpt-acc);font-size:1.1rem;font-weight:800;}
      .fpt-empty.fpt-empty-c{flex-direction:row;justify-content:flex-start;gap:8px;padding:4px 2px;text-align:left;font-size:.88rem;font-weight:700;}
      .fpt-empty-c i{flex:none;font-style:normal;font-weight:900;color:var(--fpt-acc);}
      /* Eingabezeile */
      .fpt-add{display:flex;gap:8px;margin-top:12px;}
      .fpt-add.fpt-add-top{margin:0 0 12px;}
      .fpt-in{flex:1 1 auto;min-width:0;box-sizing:border-box;min-height:46px;padding:0 14px;border:none;border-radius:var(--fpt-r);background:var(--fpt-s);color:var(--primary-text-color);font-size:1rem;font-weight:600;}
      .fpt-in::placeholder{color:var(--fpt-mut);font-weight:600;opacity:1;}
      .fpt-in:focus{outline:2px solid color-mix(in srgb,var(--fpt-acc) 55%,transparent);outline-offset:0;}
      .fpt-plus{flex:none;width:46px;min-height:46px;padding:0;border:none;border-radius:var(--fpt-r);background:var(--fpt-acc);color:var(--fp-accent-fg,#fff) !important;font-size:1.3rem;font-weight:700;line-height:1;cursor:pointer;}
      .fpt-plus:active{opacity:.8;}
      /* Favoriten unter der Liste: durch eine dünne Linie abgesetzt, ohne eigenen Rahmen */
      .fpt-favs{margin-top:14px;padding-top:12px;border-top:1px solid var(--divider-color);}
      /* schmale Karten (Handy-Spalten, ca. 120–140 px): Chip unter den Text, kleinere Tippfläche und Polster */
      @container (max-width: 280px){
        .fpt-body{padding:10px;}
        .fpt-head{gap:6px;}
        .fpt-row{min-height:40px;}
        .fpt-chk{width:36px;min-height:36px;margin-left:-8px;}
        .fpt-circ{width:20px;height:20px;}
        .fpt-done .fpt-circ::after{left:5px;top:1.5px;width:5px;height:9px;border-width:0 2px 2px 0;}
        .fpt-txt{padding:6px 4px;}
        .fpt-chip{grid-column:2;grid-row:2;justify-self:start;margin:0 0 6px 4px;}
        .fpt-in{min-height:40px;padding:0 10px;}
        .fpt-plus{width:40px;min-height:40px;}
      }
    </style>`;
  }

  // ---------- Bedienung ----------
  _onClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const chk = t.closest(".fpt-chk[data-uid]");
    if (chk) { this._toggle(chk.dataset.uid); return; }
    if (t.closest(".fpt-plus")) { this._add(); return; }
    const act = t.closest(".fpt-act[data-act]");
    if (act) { this._runAction(+act.dataset.act); return; }
    const txt = t.closest(".fpt-txt[data-uid]");
    if (txt && this._edit && !this._ov && !this._opening) {
      this._opening = true;
      this._openEdit(txt.dataset.uid).finally(() => { this._opening = false; });
    }
  }
  _byUid(uid) {
    const it = (this._items || []).find(i => i.uid === uid);
    if (it) return it;
    const k = this._keep.get(uid);
    return k ? k.item : null;
  }
  _toggle(uid) {
    const it = this._byUid(uid);
    if (!it || !this._hass) return;
    const ov = this._ovr.get(uid);
    const cur = ov ? ov.status : it.status;
    this._setStatus(uid, it, cur === "completed" ? "needs_action" : "completed", true);
  }
  // Sofort zeigen, dann beim Dienst melden. Schlägt er fehl: Zeile zurück und Fehler-Toast.
  _setStatus(uid, it, status, withUndo) {
    const now = Date.now();
    this._ovr.set(uid, { status, t: now });
    if (status === "completed") {
      this._keep.set(uid, { until: now + 1400, item: Object.assign({}, it, { status: "completed" }) });   // kurz sichtbar, dann ausgeblendet
      this._after(() => this._paint(), 1450);
    } else this._keep.delete(uid);
    this._paint();
    this._hass.callService("todo", "update_item", { entity_id: this.config.entity, item: uid, status }).catch(err => {
      console.warn("[fp-todo-card] Status setzen fehlgeschlagen:", this.config.entity, uid, err);
      this._ovr.delete(uid); this._keep.delete(uid); this._paint();
      U.toast(this, status === "completed" ? "Abhaken fehlgeschlagen" : "Wieder öffnen fehlgeschlagen");
    });
    if (withUndo) U.undo(this, `„${it.summary || ""}“ erledigt`, () => this._setStatus(uid, it, "needs_action", false));
  }
  _add() {
    const inp = this.querySelector(".fpt-in");
    const v = inp ? inp.value.trim() : "";
    if (!v || !this._hass) return;
    inp.value = "";
    // Ist die Liste gerade weg, wartet der Eintrag (ausgegraut mit Hinweis) und wird nachgeschickt.
    const t = U.addItem(this, this._hass, { entity_id: this.config.entity, item: v });
    this._optimistic(v, null, null, t.id);
    t.done.then(() => this._paint());
  }
  // Kopf-Pille: Dienst rufen, danach Hinweis. Die Pille bleibt währenddessen gesperrt (ein Skript kann dauern).
  async _runAction(i) {
    const a = this._acts[i];
    if (!a || !this._hass || this._busy.has(i)) return;
    if (a.confirm_text && !window.confirm(String(a.confirm_text))) return;
    const label = String(a.label || a.icon);
    const k = a.service.indexOf(".");
    this._busy.add(i); this._paint();
    try {
      await this._hass.callService(a.service.slice(0, k), a.service.slice(k + 1), a.data && typeof a.data === "object" ? a.data : {});
      U.toast(this, `✓ ${label}`);
    } catch (err) {
      console.warn("[fp-todo-card] Kopf-Aktion fehlgeschlagen:", a.service, err);
      U.toast(this, `${label} hat nicht geklappt`);
    }
    this._busy.delete(i); this._paint();
  }
  // Neuer Eintrag sofort in der Liste (leicht ausgegraut), bis er im Abo auftaucht, höchstens 20 s.
  // qid: Ticket aus U.addItem — solange der Eintrag dort wartet, bleibt die Zeile stehen.
  _optimistic(summary, due, description, qid) {
    const text = String(summary).trim();
    if (!text) return null;
    const key = this._key(text);
    const base = (this._items || []).filter(i => i.status !== "completed" && this._key(i.summary) === key).length;
    const p = { uid: "fpt-pend-" + (++this._pseq), summary: text, description: description == null ? "" : String(description), key, due: due || null, base, t: Date.now(), qid: qid || null };
    this._pending.push(p);
    this._after(() => this._paint(), 20100);
    this._paint();
    return p;
  }

  // ---------- Änderungsdialog ----------
  _esc(s) { return U.esc(s); }
  _iso(d) { return d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate()); }
  _projectOf(entity) {
    const t = this._targets.find(x => x.entity === entity);
    return (t && t.project_id) || "";
  }
  // Fähigkeiten der Liste (supported_features der Entität): 16/32 = Datum, 64 = Beschreibung. null = unbekannt.
  // Bring! kann nur Beschreibung (71), Todoist alles (127). Home Assistant lehnt due_date/description an einer
  // Liste ohne das Merkmal ab, auch mit null; deshalb wird dort gar nichts davon mitgeschickt.
  _feat(entity) {
    const st = this._hass && this._hass.states && this._hass.states[entity];
    const f = st && st.attributes ? Number(st.attributes.supported_features) : NaN;
    return isNaN(f) ? null : f;
  }
  _canDate(entity) { const f = this._feat(entity); return f === null || (f & 48) !== 0; }   // unbekannt: wie bisher mit Datum
  _canDesc(entity) { const f = this._feat(entity); return f !== null && (f & 64) !== 0; }
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
    const dateOn = this._canDate(src);                       // „Bis wann?“ nur bei Listen mit Datum
    const descOn = this._descEdit && this._canDesc(src);     // Beschreibungsfeld nur auf Wunsch und bei Listen mit Beschreibung
    const tbtns = this._targets.map(t => `<button class="ft-tgt${t.entity === src ? " ft-on" : ""}" data-e="${this._esc(t.entity)}">${this._esc(t.label)}</button>`).join("");
    const rbtns = [`<button class="ft-rep ft-on" data-r="">Unverändert</button>`]
      .concat(this._repeats.map(o => `<button class="ft-rep" data-r="${this._esc(o.due_string)}">${this._esc(o.label)}</button>`))
      .concat([`<button class="ft-rep" data-r="__custom">Eigene …</button>`]).join("");
    const ubtns = [["day", "Tage"], ["week", "Wochen"], ["month", "Monate"], ["year", "Jahre"]]
      .map(([u, l]) => `<button class="ft-cu${u === "week" ? " ft-on" : ""}" data-u="${u}">${l}</button>`).join("");

    const ov = document.createElement("div"); ov.className = "ft-ov"; this._ov = ov;
    const descHtml = descOn
      ? `<div class="ft-sub ft-dsub">${this._esc(this._descLabel || "Beschreibung")}</div><input class="ft-name ft-desc" type="text" value="${this._esc(item.description == null ? "" : item.description)}"${this._descPh ? ` placeholder="${this._esc(this._descPh)}"` : ""} style="margin-top:0">`
      : "";
    const dateHtml = dateOn
      ? `<div class="ft-sub">Bis wann?</div>
      <div class="ft-row"><button class="ft-q" data-q="none">Kein Datum</button><button class="ft-q" data-q="today">Heute</button><button class="ft-q" data-q="tom">Morgen</button><button class="ft-q" data-q="week">In 1 Woche</button><div class="ft-datewrap${due ? "" : " ft-dempty"}"><input class="ft-date" type="date" value="${this._esc(due)}"></div></div>`
      : "";
    ov.innerHTML = `<div class="ft-modal">
      <div class="ft-head">${this._esc(this._editTitle)}</div>
      <input class="ft-name" type="text" value="${this._esc(item.summary || "")}">${descHtml}
      ${tbtns ? `<div class="ft-sub">${this._esc(this._tgtLabel)}</div><div class="ft-row">${tbtns}</div>` : ""}
      ${dateHtml}
      ${this._repeats.length ? `<div class="ft-sub ft-rsub">Wiederholung</div><div class="ft-row ft-reps">${rbtns}</div>`
        + `<div class="ft-cust" style="display:none"><span class="ft-cust-lbl">alle</span><input class="ft-cust-n" type="number" min="1" max="99" value="2"><div class="ft-cus">${ubtns}</div></div>` : ""}
      <div class="ft-foot"><button class="ft-btn ft-save">Speichern</button><button class="ft-btn ft-cancel">Abbrechen</button><button class="ft-btn ft-del">🗑</button></div>
    </div>${this._editStyles()}`;
    U.lightbox(this, ov, () => this._closeEdit());
    document.addEventListener("keydown", this._onKey);

    const nameInp = ov.querySelector(".ft-name:not(.ft-desc)");
    const descInp = ov.querySelector(".ft-desc");   // null ohne Beschreibungsfeld
    const descBase = descInp ? descInp.value : "";  // Ausgangswert: mehrzeilige Beschreibungen werden im Feld einzeilig, nur eine echte Änderung wird geschickt
    const dateInp = ov.querySelector(".ft-date");   // null bei Listen ohne Datum
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
    // Datum und Beschreibung verschwinden, wenn man in eine Liste ohne dieses Merkmal verschiebt (sie würden dort nicht gespeichert)
    const dateWrap = ov.querySelector(".ft-datewrap");
    const dateBlk = dateWrap ? [dateWrap.parentNode.previousElementSibling, dateWrap.parentNode] : [];
    const descBlk = descInp ? [ov.querySelector(".ft-dsub"), descInp] : [];
    const syncCaps = () => {
      dateBlk.forEach(x => x.style.display = this._canDate(sel) ? "" : "none");
      descBlk.forEach(x => x.style.display = this._canDesc(sel) ? "" : "none");
    };
    ov.querySelectorAll(".ft-tgt").forEach(b => b.addEventListener("click", () => {
      sel = b.dataset.e;
      ov.querySelectorAll(".ft-tgt").forEach(x => x.classList.toggle("ft-on", x === b));
      syncRep();
      syncCaps();
    }));
    if (dateInp) {
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
    }
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
      const name = nameInp.value.trim() || item.summary;
      // desc: nur gesetzt, wenn die Angabe im Feld geändert wurde (leer = löschen); sonst undefined
      const desc = descInp && descInp.value.trim() !== descBase.trim() ? descInp.value.trim() : undefined;
      try {
        await this._saveEdit({ uid, src, sel, name, due, rep, old: item, desc });
        this._closeEdit();
      } catch (err) { U.toast(this, err && err.message === "Liste nicht erreichbar" ? "Liste gerade nicht erreichbar – bitte gleich nochmal versuchen" : "Änderung fehlgeschlagen"); btn.disabled = false; }
    });
    // Enter im Namens- oder Beschreibungsfeld speichert (Escape schließt über _onKey)
    [nameInp, descInp].forEach(inp => inp && inp.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); ov.querySelector(".ft-save").click(); }
    }));
    // Fokus ins Namensfeld nur mit Maus/Trackpad; am Handy würde die Tastatur aufspringen und das Layout verschieben
    try { if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) { nameInp.focus(); const n = nameInp.value.length; nameInp.setSelectionRange(n, n); } } catch (e) {}
  }
  async _saveEdit({ uid, src, sel, name, due, rep, old, desc }) {
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
      // Ist eine der Listen gerade weg, würde HA das Anlegen still verwerfen und danach
      // das Original löschen — der Eintrag wäre verloren. Dann lieber abbrechen.
      if (!U.listUp(this._hass, sel) || !U.listUp(this._hass, src)) throw new Error("Liste nicht erreichbar");
      const data = { entity_id: sel, item: name };
      if (due && this._canDate(sel)) data.due_date = due;   // Zielliste ohne Datum: Datum entfällt
      // Beschreibung mitnehmen (geändert: Wert aus dem Feld, sonst die ursprüngliche), wenn die Zielliste sie kann
      const dsc = desc !== undefined ? desc : (old.description == null ? "" : String(old.description));
      if (dsc && this._canDesc(sel)) data.description = dsc;
      await this._hass.callService("todo", "add_item", data);
      await this._hass.callService("todo", "remove_item", { entity_id: src, item: uid });
      U.toast(this, `„${name}" verschoben`);
    } else {
      const data = { entity_id: src, item: uid, rename: name };
      if (this._canDate(src)) data.due_date = due ? due : null;   // Liste ohne Datum: gar nichts mitschicken (auch nicht null)
      // Leere Angabe = leerer String (HA erlaubt string oder null; Bring! macht daraus eine leere Angabe und löscht sie)
      if (desc !== undefined && this._canDesc(src)) data.description = desc;
      await this._hass.callService("todo", "update_item", data);
    }
    const refresh = moved || rep ? [src, sel] : [src];
    setTimeout(() => this._hass.callService("homeassistant", "update_entity", { entity_id: refresh }).catch(() => {}), 2500);
  }
  _closeEdit() {
    document.removeEventListener("keydown", this._onKey);
    if (this._ov && this._ov.parentNode) this._ov.parentNode.removeChild(this._ov);
    this._ov = null;
  }
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
      .ft-date[type=date],.ft-date[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;} .ft-date::-webkit-date-and-time-value{text-align:center;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
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

  getCardSize() { return 2 + Math.max(1, this._nRows || 1) + (this._favEl ? 3 : 0); }
}
if (!customElements.get("fp-todo-card")) {
  customElements.define("fp-todo-card", FpTodoCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-todo-card", name: "FP Todo Card", description: "Eigene Aufgabenliste: Gruppen nach Fälligkeit, Abhaken mit Rückgängig, sofortiges Hinzufügen" });
}
})();

/* ===== fp-glance-card v9 (Baby-Zeilen unter dem Gruß über die Option baby; davor: in horizontal-stack wieder nebeneinander statt zusammengedrückt (füllt die Rasterzelle, ohne HAs Stapel-Aufteilung zu überschreiben); davor: Farben aus dem Theme: Hintergrund je Tageszeit, Schrift, Rand und Schatten über --fp-glance-*; Schriftfarben der Wetterkarte kommen von der Glance-Karte; fuellt die Rasterzelle aus, forecast_rows statt forecast_days, hide_today_section fuer flaches Banner; Wetter-Klick via transparentes Overlay; Pro-Element-Navigation Datum/Termin->Kalender, Essen->Essensplan, Wetter->Wetter-Tab; Wetter via eingebettete clock-weather-card) ===== */
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
      baby: null,                           // Konfiguration einer fp-baby-overview-card (kids, nav_path, meal_pause_entity …): je Kind eine Zeile unter dem Gruß
    }, config || {});
    const bb = this.config.baby;
    if (bb && !(typeof bb === "object" && Array.isArray(bb.kids) && bb.kids.length)) throw new Error("fp-glance-card: baby braucht kids (wie fp-baby-overview-card)");
    this._events = null; this._rangeKey = ""; this._lastFetch = 0;
    this._built = false; this._wc = null; this._baby = null; this._curBg = ""; this._curMode = ""; this._curFg = null;
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
      // Schriftfarben kommen nicht mehr von hier, sondern von .fpg-wc der Glance-Karte (erben hinein)
      if (!base.card_mod) base.card_mod = { style: "ha-card{background:transparent!important;box-shadow:none!important;border:none!important;} img{filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));} svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}" };
      this._wcConfig = base;
    }
  }
  set hass(hass) {
    this._hass = hass;
    if (this._wc) this._wc.hass = hass;
    if (this._baby) this._baby.hass = hass;   // die Leiste entscheidet selbst, ob sie neu zeichnet (nur bei geändertem Schalter oder Text)
    if (!this._built) this._build(); else this._paint();
    this._maybeFetch();
  }
  connectedCallback() {
    if (!this._clock) this._clock = setInterval(() => { this._maybeFetch(); this._paint(); }, 60000);
    // _build kann vor dem Einhängen laufen; dann war der hui-card noch nicht erreichbar
    const fz = U.fillZelle || U.fill;
    if (fz) fz(this);
  }
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
  // Rückgabe: style + mode ("light" = weiße Schrift auf Bild/Vorgabe, "dark" = Theme-Schrift auf eigener Farbe,
  // "theme" = Hintergrund und Schrift aus --fp-glance-*), bei "theme" zusätzlich fg = --fp-glance-fg gesetzt
  _bg() {
    const part = this._daypart();
    const bgs = this.config.backgrounds || {};
    const bRaw = bgs[part] || this.config.background || "";
    const isImg = bRaw && (/^(https?:|\/|data:)/.test(bRaw) || /\.(jpe?g|png|webp|gif|avif)/i.test(bRaw));
    if (isImg) return { style: `background-image:linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.58)),url('${bRaw}');background-size:cover;background-position:center;`, mode: "light" };
    if (bRaw) return { style: `background:${bRaw};`, mode: "dark" };
    // Theme-Variable der Tageszeit: var(...) in den Stil, nicht der gelesene Wert,
    // damit der Hell/Dunkel-Wechsel des Themes ohne Neuzeichnen greift.
    const cs = getComputedStyle(this);
    if (cs.getPropertyValue("--fp-glance-" + part).trim()) {
      return { style: `background:var(--fp-glance-${part});`, mode: "theme", fg: !!cs.getPropertyValue("--fp-glance-fg").trim() };
    }
    return { style: `background:${this._defaultBg(part)};`, mode: "light" };
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
             Reihenfolge: Karten-Option "shadow" (--fpg-shadow), Theme-Variable
             --fp-glance-shadow, fester Wert. Die Theme-Variable muss ein gueltiger
             Schattenwert sein (z. B. "0 4px 14px rgba(0,0,0,.16)"), nicht "none". */
          filter:drop-shadow(var(--fpg-shadow,var(--fp-glance-shadow,0 4px 14px rgba(0,0,0,.16))));
          border-width:var(--ha-card-border-width,0);border-style:solid;
          border-color:var(--fp-glance-border,var(--ha-card-border-color,var(--divider-color)));}
        .fpg-light{color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.55);}
        .fpg-dark{color:var(--primary-text-color);}
        .fpg-theme{color:var(--fp-glance-fg,var(--primary-text-color));}
        /* Schriftfarben der eingebetteten Wetterkarte kommen von hier (erben hinein);
           bei "dark" bleiben die Theme-Werte, bei "theme" ohne --fp-glance-fg ebenso. */
        .fpg-light .fpg-wc{--primary-text-color:#fff;--secondary-text-color:rgba(255,255,255,.9);}
        .fpg-theme.fpg-fg .fpg-wc{--primary-text-color:var(--fp-glance-fg);--secondary-text-color:color-mix(in srgb, var(--fp-glance-fg) 80%, transparent);}
        .fpg-clk{cursor:pointer;}
        .fpg-date.fpg-clk:hover,.fpg-chip.fpg-clk:hover{text-decoration:underline;}
        .fpg-wc.fpg-clk{cursor:pointer;}
        .fpg-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;}
        .fpg-date{font-size:.82rem;opacity:.88;}
        .fpg-hi{font-size:1.3rem;font-weight:700;margin-top:2px;}
        .fpg-info{display:flex;gap:16px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.28);font-size:.9rem;}
        .fpg-dark .fpg-info{border-top-color:var(--divider-color);}
        .fpg-theme .fpg-info{border-top-color:color-mix(in srgb, var(--fp-glance-fg, var(--primary-text-color)) 22%, transparent);}
        .fpg-chip{display:inline-flex;align-items:center;gap:6px;}
        .fpg-dot{width:9px;height:9px;border-radius:50%;display:inline-block;}
        .fpg-muted{opacity:.72;}
        /* Baby-Zeilen: eingebettete fp-baby-overview-card (bar_style: inline) unter der Trennlinie, die dann von der Termin-Zeile hierher wandert;
           Schrift erbt von hier, Zeilenabstand der Kind-Zeilen (3 px oben und unten) mitgerechnet, damit die Luft zur Linie und zur Termin-Zeile
           der sonstigen Zeilen entspricht. */
        .fpg-baby{margin-top:13px;padding-top:8px;border-top:1px solid rgba(255,255,255,.28);font-size:.9rem;}
        .fpg-baby > *{display:block;}
        .fpg-dark .fpg-baby{border-top-color:var(--divider-color);}
        .fpg-theme .fpg-baby{border-top-color:color-mix(in srgb, var(--fp-glance-fg, var(--primary-text-color)) 22%, transparent);}
        .fpg-info.fpg-nl{margin-top:8px;padding-top:0;border-top:0;}
        .fpg-wc{margin-top:8px;position:relative;}
        .fpg-wc-ov{position:absolute;inset:0;z-index:2;cursor:pointer;}
        .fpg-wc-hidden{display:none;}
      </style>
      <div class="fpg-card">
        <div class="fpg-top">
          <div class="fpg-greet"><div class="fpg-date"></div><div class="fpg-hi"></div></div>
        </div>${this.config.baby ? `
        <div class="fpg-baby"></div>` : ""}
        <div class="fpg-info${this.config.baby ? " fpg-nl" : ""}"></div>
        <div class="fpg-wc"></div>
      </div>`;
    const fz = U.fillZelle || U.fill; // defensiv: fehlender Helfer darf die Karte nie killen
    if (fz) fz(this);
    if (this.config.shadow) this.style.setProperty("--fpg-shadow", this.config.shadow);
    this._elCard = this.querySelector(".fpg-card");
    this._elDate = this.querySelector(".fpg-date");
    this._elGreet = this.querySelector(".fpg-hi");
    this._elInfo = this.querySelector(".fpg-info");
    this._elWc = this.querySelector(".fpg-wc");
    // Baby-Zeilen: einmal angelegt wie die Wetterkarte, _paint fasst sie nicht an; hass kommt in set hass
    this._elBaby = this.querySelector(".fpg-baby");
    if (this._elBaby) {
      try {
        const el = document.createElement("fp-baby-overview-card");
        el.setConfig(Object.assign({}, this.config.baby, { layout: "bar", bar_style: "inline" }));
        if (this._hass) el.hass = this._hass;
        this._baby = el; this._elBaby.appendChild(el);
      } catch (e) { this._elBaby.remove(); this._elInfo.classList.remove("fpg-nl"); if (this._loadedOnce) this._toast("Baby-Zeilen konnten nicht geladen werden"); }
    }
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
    const fg = !!bg.fg;
    if (bg.mode !== this._curMode || fg !== this._curFg) {
      this._elCard.classList.toggle("fpg-light", bg.mode === "light");
      this._elCard.classList.toggle("fpg-dark", bg.mode === "dark");
      this._elCard.classList.toggle("fpg-theme", bg.mode === "theme");
      this._elCard.classList.toggle("fpg-fg", bg.mode === "theme" && fg);
      this._curMode = bg.mode; this._curFg = fg;
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

  getCardSize() {
    const kz = this.config.baby ? Math.round(this.config.baby.kids.length * .6) : 0;   // eine Kind-Zeile ist rund 28 px, eine Einheit 50
    return ((this._wc && this._wc.getCardSize) ? (this._wc.getCardSize() + 2) : 4) + kz;
  }
}
if (!customElements.get("fp-glance-card")) {
  customElements.define("fp-glance-card", FpGlanceCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-glance-card", name: "FP Glance Card", description: "Today at a glance: greeting + next event + dinner, with embedded animated clock-weather-card" });
}
})();

/* ===== fp-cookbook-card v26 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: KI-Bild kann über ai_image_entity eine eigene KI nutzen, z. B. Gemini, während der Rest auf einer anderen läuft; davor: Zutaten → Einkauf übersteht einen Ausfall der Einkaufsliste: wird nachgeschickt; davor: ruhige Bildkacheln mit Name, Zeit und kcal, Suche und Hinweise als Pillen im Kopf, Filter als wischbare Chips, feste Farben durch Theme ersetzt, Mahlzeit und zuletzt gekocht auf der Rezeptseite; davor: Bilder zu den Rezepten (eigenes Foto, Openverse, KI-Bild, Bildadresse); Zutaten → Einkauf fasst Mengen mit offenen Einträgen zusammen; Import per Link; Rezepte bearbeiten; Filter „schnell“ und „proteinreich“ aus Zeit und Eiweißwert) ===== */
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
      ai_image_entity: "",          // eigene ai_task-Entity nur fürs KI-Bild (z. B. Gemini); leer = ai_entity
      weather_entity: "weather.home",
      base_portions: 2,
      quick_max_min: 20,            // bis hierher gilt ein Gericht als „schnell"
      import_service: "",           // z. B. rest_command.kochbuch_import — blendet das Link-Feld ein
      protein_min_g: 25,            // ab hier gilt eine Portion als „proteinreich"
      image_folder: "kochbuch",     // Unterordner im HA-Medienordner für eigene Fotos
      style: "viel vegetarisch, bunt gemischt, proteinreich, schnell zu kochen",
      meals: [
        { label: "Frühstück", at: 8 },
        { label: "Mittag", at: 12 },
        { label: "Abend", at: 18 },
      ],
    }, config || {});
    this._dishes = null; this._sig = ""; this._built = false;
    this._search = ""; this._filter = "Alle"; this._ov = null; this._recentSuggestions = [];
    this._imgCache = {}; this._queryCache = {};
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
  async _addToPlan(d, date, mealLabel) {
    const sd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), this._mealHour(mealLabel), 0);
    const ed = new Date(sd.getTime() + 3600000);
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this.config.essensplan_entity, summary: d.name, start_date_time: U.haZeit(sd), end_date_time: U.haZeit(ed) });
      d.last_cooked = new Date().toISOString().slice(0, 10); d.times_cooked = (d.times_cooked || 0) + 1;
      await this._save(d, d.uid);
      this._toast(`„${d.name}" für ${mealLabel} eingeplant`);
      return true;
    } catch (e) { this._toast("Konnte nicht in den Essensplan legen"); return false; }
  }
  _scale(q, factor) { const v = (Number(q) || 0) * factor; if (v >= 10) return Math.round(v); if (v >= 1) return Math.round(v * 2) / 2; return Math.round(v * 10) / 10; }
  _zahl(v) { return v ? String(v).replace(".", ",") : ""; }   // 1.5 → „1,5"
  _ingLine(i, factor) { return `${this._zahl(this._scale(i.qty, factor))} ${i.unit || ""} ${i.item || ""}`.trim(); }
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
      try {
        const { neu, zus } = await this._addShopping(lines);
        this._toast(zus ? `${neu + zus} Zutaten auf die Einkaufsliste, ${zus} davon zu vorhandenen addiert` : `${neu} Zutaten auf die Einkaufsliste`);
        this._closeOv();
      }
      catch (err) { this._toast("Zutaten konnten nicht hinzugefügt werden"); btn.disabled = false; }
    });
  }

  // ---------- Einkaufsliste: Mengen zusammenfassen ----------
  // Einheiten, die als solche erkannt werden. Gewicht und Volumen rechnen in eine
  // Grundeinheit (g bzw. ml) um, alles andere zählt nur mit derselben Einheit zusammen.
  _einheit(t) {
    const k = String(t || "").toLowerCase().replace(/\.$/, "");
    const metrisch = { g: ["g", 1], gramm: ["g", 1], kg: ["g", 1000], mg: ["g", 0.001],
      ml: ["ml", 1], l: ["ml", 1000], liter: ["ml", 1000], cl: ["ml", 10], dl: ["ml", 100] };
    if (metrisch[k]) return { dim: metrisch[k][0], f: metrisch[k][1] };
    const sonst = { el: "el", tl: "tl", stk: "stück", "stück": "stück", prise: "prise", prisen: "prise", bund: "bund",
      dose: "dose", dosen: "dose", pkg: "packung", pck: "packung", packung: "packung", packungen: "packung",
      zehe: "zehe", zehen: "zehe", becher: "becher", scheibe: "scheibe", scheiben: "scheibe", glas: "glas", "gläser": "glas",
      tasse: "tasse", tassen: "tasse", handvoll: "handvoll", msp: "msp", "würfel": "würfel", blatt: "blatt", "blätter": "blatt",
      zweig: "zweig", zweige: "zweig", stange: "stange", stangen: "stange", kopf: "kopf", "köpfe": "kopf" };
    return sonst[k] ? { dim: sonst[k], f: 1 } : null;
  }
  // „200 g Butter", „200g Butter", „1.5 kg Mehl", „2 Eier" → Menge, Einheit, Name. Ohne Zahl vorne: null.
  _parseZeile(s) {
    const m = String(s || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (!m || !m[2].trim()) return null;
    const q = Number(m[1].replace(",", ".")); let rest = m[2].trim(), label = "", e = { dim: "", f: 1 };
    const w = rest.match(/^(\S+)\s+(.+)$/), eh = w && this._einheit(w[1]);
    if (eh) { e = eh; label = w[1]; rest = w[2]; }
    return { menge: q * e.f, dim: e.dim, label, name: rest, key: rest.toLowerCase().replace(/\s+/g, " ") };
  }
  // Bring-Art: Name im Titel, Menge in der Beschreibung („200 g", „4").
  _parseMenge(s) {
    const m = String(s || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(\S*)$/);
    if (!m) return null;
    const e = m[2] ? this._einheit(m[2]) : { dim: "", f: 1 };
    return e ? { menge: Number(m[1].replace(",", ".")) * e.f, dim: e.dim, label: m[2] } : null;
  }
  _fmtMenge(dim, menge, label) {
    const r = v => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
    if (dim === "g") return menge >= 1000 ? `${this._zahl(Math.round(menge / 10) / 100)} kg` : `${this._zahl(r(menge))} g`;
    if (dim === "ml") return menge >= 1000 ? `${this._zahl(Math.round(menge / 10) / 100)} l` : `${this._zahl(r(menge))} ml`;
    return `${this._zahl(r(menge))}${label ? ` ${label}` : ""}`;
  }
  // Neue Zeilen erst untereinander, dann mit offenen Einträgen gleichen Namens und
  // verträglicher Einheit zusammenfassen. Erledigte Einträge bleiben unberührt; was
  // nicht passt, kommt wie bisher als eigene Zeile dazu.
  async _addShopping(lines) {
    const ent = this.config.shopping_entity, gruppen = [], einzeln = [];
    lines.forEach(l => {
      const p = this._parseZeile(l);
      if (!p) { einzeln.push(l); return; }
      const g = gruppen.find(x => x.key === p.key && x.dim === p.dim);
      if (g) g.menge += p.menge; else gruppen.push(p);
    });
    let ziele = [];
    // Liste gerade nicht erreichbar: nichts zusammenfassen (ein Ändern würde HA still verwerfen),
    // alles als neue Zeilen über die Warteschlange anlegen, die sie nachschickt
    if (U.listUp(this._hass, ent)) try {
      const res = await this._hass.callWS({ type: "todo/item/list", entity_id: ent });
      ziele = (res.items || []).filter(x => x.status === "needs_action").map(x => {
        const p = this._parseZeile(x.summary);
        if (p) return Object.assign(p, { uid: x.uid, art: "titel" });
        const d = this._parseMenge(x.description);
        return d ? Object.assign(d, { uid: x.uid, art: "beschreibung", name: x.summary, key: String(x.summary).trim().toLowerCase().replace(/\s+/g, " ") }) : null;
      }).filter(Boolean);
    } catch (e) { ziele = []; }   // Liste nicht lesbar: einfach wie bisher anhängen
    let neu = 0, zus = 0;
    for (const g of gruppen) {
      const z = ziele.find(x => x.key === g.key && x.dim === g.dim);
      if (z) {
        const menge = this._fmtMenge(z.dim, z.menge + g.menge, z.label || g.label);
        try {
          await this._hass.callService("todo", "update_item", z.art === "titel"
            ? { entity_id: ent, item: z.uid, rename: `${menge} ${z.name}` }
            : { entity_id: ent, item: z.uid, description: menge });
          z.menge += g.menge; zus++;
          continue;
        } catch (e) { /* Ändern fehlgeschlagen: als eigene Zeile anlegen, damit nichts verloren geht */ }
      }
      await U.addItem(this, this._hass, { entity_id: ent, item: `${this._fmtMenge(g.dim, g.menge, g.label)} ${g.name}` }).done;
      neu++;
    }
    for (const l of einzeln) { await U.addItem(this, this._hass, { entity_id: ent, item: l }).done; neu++; }
    return { neu, zus };
  }

  // ---------- Bilder ----------
  // d.image = { src, credit?, link? }; src ist eine https-Adresse oder eine
  // media-source-ID (eigene Fotos, KI-Bilder). Letztere brauchen eine signierte Adresse.
  _imgSrc(d) { const i = d && d.image; return i ? (typeof i === "string" ? i : i.src || "") : ""; }
  _imgTag(d, cls) {
    const src = this._imgSrc(d);
    if (!src) return `<div class="${cls} cb-noimg">${CP(0x1F37D)}</div>`;
    return `<img class="${cls}" data-img="${this._esc(src)}" alt="" loading="lazy">`;
  }
  async _resolveImg(src) {
    if (!/^media-source:\/\//.test(src)) return src;
    const c = this._imgCache[src];
    if (c && c.until > Date.now()) return c.url;
    const r = await this._hass.callWS({ type: "media_source/resolve_media", media_content_id: src, expires: 86400 });
    this._imgCache[src] = { url: r.url, until: Date.now() + 82800000 };
    return r.url;
  }
  _fillImgs(root) {
    (root || this).querySelectorAll("img[data-img]").forEach(img => {
      const src = img.dataset.img;
      this._resolveImg(src).then(u => { img.src = u; }).catch(() => { img.replaceWith(Object.assign(document.createElement("div"), { className: img.className + " cb-noimg", textContent: CP(0x1F37D) })); });
      img.onerror = () => { img.classList.add("cb-img-err"); };
    });
  }
  async _setImage(d, image) {
    d.image = image || null;
    if (!image) delete d.image;
    return this._save(d, d.uid);
  }
  // Foto verkleinern (lange Seite 1280 px, JPEG) und in den Medienordner laden
  async _uploadPhoto(d, file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.84));
      const slug = U.norm(d.name).replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "rezept";
      const fd = new FormData();
      fd.append("media_content_id", `media-source://media_source/local/${this.config.image_folder}`);
      fd.append("file", blob, `${slug}-${Date.now().toString(36)}.jpg`);
      const res = await this._hass.fetchWithAuth("/api/media_source/local_source/upload", { method: "POST", body: fd });
      if (res.status === 401 || res.status === 403) throw new Error("admin");
      if (!res.ok) throw new Error("upload " + res.status);
      const j = await res.json();
      return { src: j.media_content_id };
    } finally { URL.revokeObjectURL(url); }
  }
  // Englischer Suchbegriff fuer die Fotosuche (freie Fotos sind meist englisch beschriftet)
  async _imageQuery(d) {
    if (this._queryCache[d.name]) return this._queryCache[d.name];
    let q = d.name;
    try {
      const data = { task_name: "Bildsuche", instructions: `Gib NUR einen kurzen englischen Suchbegriff (2 bis 4 Woerter, ohne Anfuehrungszeichen) fuer ein Foto des Gerichts "${d.name}" zurueck.` };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
      let t = r && r.response && r.response.data;
      if (t && typeof t === "object") t = t.text || "";
      t = String(t || "").split("\n")[0].replace(/["'„“.]/g, "").trim();
      if (t && t.length < 60) q = t;
    } catch (e) { /* ohne KI mit dem deutschen Namen suchen */ }
    return (this._queryCache[d.name] = q);
  }
  async _searchPhotos(q) {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=12&mature=false`);
    if (!r.ok) throw new Error("openverse " + r.status);
    const j = await r.json();
    return (j.results || []).filter(x => x.url).map(x => ({
      thumb: x.thumbnail || x.url, src: x.url, link: x.foreign_landing_url || "",
      credit: `Foto: ${x.creator || "unbekannt"}, ${String(x.license || "").toUpperCase() === "CC0" ? "CC0" : "CC " + String(x.license || "").toUpperCase() + " " + (x.license_version || "")}`.trim(),
    }));
  }
  async _aiImage(d) {
    const data = { task_name: "Kochbuch-Bild", instructions: `Appetizing realistic food photograph of the dish "${d.name}"${(d.ingredients || []).length ? ` (main ingredients: ${(d.ingredients || []).slice(0, 6).map(i => i.item).join(", ")})` : ""}, served on a plate on a wooden kitchen table, natural daylight, shallow depth of field, landscape 4:3, no text, no people.` };
    const imgEnt = this.config.ai_image_entity || this.config.ai_entity;
    if (imgEnt) data.entity_id = imgEnt;
    const r = await this._hass.callService("ai_task", "generate_image", data, undefined, false, true);
    const id = r && r.response && r.response.media_source_id;
    if (!id) throw new Error("kein Bild");
    return { src: id, credit: "KI-Bild" };
  }
  _aiImageOk() {
    const imgEnt = this.config.ai_image_entity || this.config.ai_entity;
    const st = imgEnt && this._hass.states[imgEnt];
    return !!(st && (Number(st.attributes.supported_features) & 4));
  }

  _openImage(d) {
    const cur = this._imgSrc(d);
    const ov = this._overlay(`
      <div class="cb-m-head"><span>Bild für „${this._esc(d.name)}"</span><button class="cb-x">${CP(0x2715)}</button></div>
      ${cur ? `<div class="cb-im-cur">${this._imgTag(d, "cb-im-prev")}</div>` : ""}
      <div class="cb-m-foot cb-im-btns">
        <label class="cb-btn cb-im-photo">${CP(0x1F4F7)} Eigenes Foto<input type="file" accept="image/*" hidden></label>
        <button class="cb-btn cb-im-find">${CP(0x1F50E)} Foto suchen</button>
        ${this._aiImageOk() ? `<button class="cb-btn cb-im-ai">${CP(0x2728)} KI-Bild</button>` : ""}
      </div>
      <div class="cb-im-search" hidden>
        <div class="cb-imp-row"><input class="cb-in cb-im-q" type="text" placeholder="Suchbegriff"><button class="cb-btn cb-im-go">Suchen</button></div>
        <div class="cb-im-grid"></div>
        <div class="cb-e-hint">Freie Fotos von Openverse (Creative Commons). Der Hinweis auf den Fotografen wird mitgespeichert.</div>
      </div>
      <div class="cb-sub">Oder Bildadresse einfügen</div>
      <div class="cb-imp-row"><input class="cb-in cb-im-url" type="url" inputmode="url" placeholder="https://…"><button class="cb-btn cb-im-urlok">Übernehmen</button></div>
      <div class="cb-m-foot">
        ${cur ? `<button class="cb-btn cb-e-cancel cb-im-del">Bild entfernen</button>` : ""}
        <button class="cb-btn cb-e-cancel cb-im-back">Zurück</button>
      </div>`);
    this._fillImgs(ov);
    const fertig = async (image, msg) => { if (await this._setImage(d, image)) { this._toast(msg); this._openDetail(d); } };
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelector(".cb-im-back").addEventListener("click", () => this._openDetail(d));
    const del = ov.querySelector(".cb-im-del");
    if (del) del.addEventListener("click", () => fertig(null, "Bild entfernt"));
    const fileIn = ov.querySelector(".cb-im-photo input");
    fileIn.addEventListener("change", async () => {
      const file = fileIn.files && fileIn.files[0]; if (!file) return;
      const lab = ov.querySelector(".cb-im-photo"); lab.classList.add("cb-busy"); lab.firstChild.textContent = `${CP(0x23F3)} Lädt hoch …`;
      try { await fertig(await this._uploadPhoto(d, file), "Foto gespeichert"); }
      catch (e) { lab.classList.remove("cb-busy"); lab.firstChild.textContent = `${CP(0x1F4F7)} Eigenes Foto`; this._toast(e.message === "admin" ? "Hochladen geht nur mit einem Admin-Konto" : "Foto konnte nicht hochgeladen werden"); }
    });
    const box = ov.querySelector(".cb-im-search"), qIn = ov.querySelector(".cb-im-q"), grid = ov.querySelector(".cb-im-grid");
    const suchen = async () => {
      const q = qIn.value.trim(); if (!q) return;
      grid.innerHTML = `<div class="cb-e-hint">${CP(0x23F3)} Suche …</div>`;
      try {
        const hits = await this._searchPhotos(q);
        if (!hits.length) { grid.innerHTML = `<div class="cb-e-hint">Nichts gefunden. Probier einen anderen Begriff.</div>`; return; }
        grid.innerHTML = hits.map((h, i) => `<button class="cb-im-hit" data-i="${i}"><img src="${this._esc(h.thumb)}" alt="" loading="lazy"></button>`).join("");
        grid.querySelectorAll(".cb-im-hit").forEach(b => b.addEventListener("click", () => { const h = hits[+b.dataset.i]; fertig({ src: h.src, credit: h.credit, link: h.link }, "Bild gespeichert"); }));
      } catch (e) { grid.innerHTML = `<div class="cb-e-hint">Fotosuche gerade nicht erreichbar.</div>`; }
    };
    ov.querySelector(".cb-im-find").addEventListener("click", async e => {
      box.hidden = false;
      if (!qIn.value) { const btn = e.currentTarget; btn.disabled = true; qIn.value = await this._imageQuery(d); btn.disabled = false; }
      suchen();
    });
    ov.querySelector(".cb-im-go").addEventListener("click", suchen);
    qIn.addEventListener("keydown", e => { if (e.key === "Enter") suchen(); });
    const ai = ov.querySelector(".cb-im-ai");
    if (ai) ai.addEventListener("click", async () => {
      ai.disabled = true; ai.textContent = `${CP(0x2728)} Malt …`;
      try { await fertig(await this._aiImage(d), "KI-Bild gespeichert"); }
      catch (e) { ai.disabled = false; ai.textContent = `${CP(0x2728)} KI-Bild`; this._toast("KI-Bild nicht möglich. Google erzeugt Bilder nur mit bezahltem Kontingent."); }
    });
    ov.querySelector(".cb-im-urlok").addEventListener("click", () => {
      const u = ov.querySelector(".cb-im-url").value.trim();
      if (!/^https:\/\/\S+$/i.test(u)) { this._toast("Bitte eine vollständige https-Adresse einfügen"); return; }
      fertig({ src: u }, "Bild gespeichert");
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
  // Kachelzeile: nur Gesamtzeit und kcal je Portion, z. B. „55 Min · 520 kcal"; leer, wenn beides fehlt
  _tileMetaTxt(d) {
    const t = Number(d.total_min) || 0, k = Number(d.kcal) || 0;
    return [t ? `${t} Min` : "", k ? `${k} kcal` : ""].filter(Boolean).join(" · ");
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
    // Hinweise als kleine Pillen im Kopf (volle Wörter stehen im Tooltip)
    const timeBar = nNoTime ? `<button class="cb-fixtimes" title="Zubereitungszeit für ${nNoTime} Rezept${nNoTime === 1 ? "" : "e"} nachrechnen">${CP(0x23F1)} Zeiten für ${nNoTime} nachrechnen</button>` : "";
    const nNoNutri = (this._dishes || []).filter(d => this._nutriMissing(d)).length;
    const nutriBar = nNoNutri ? `<button class="cb-fixnutri" title="Nährwerte für ${nNoNutri} Rezept${nNoNutri === 1 ? "" : "e"} berechnen">${CP(0x1F525)} Nährwerte für ${nNoNutri} berechnen</button>` : "";
    const cards = dishes.length ? dishes.map(d => `
${this._tileHTML(d)}`).join("")
      : `<div class="cb-empty">Noch keine Rezepte. Tippe auf „＋ Neu", um eins per KI zu erzeugen.</div>`;

    this.innerHTML = `
      <ha-card class="cb-card">
        <div class="cb-bar">
          <div class="cb-title">${CP(0x1F4D6)} ${this._esc(this.config.title)}</div>
          <input class="cb-search" type="text" placeholder="Suchen …" aria-label="Suchen" value="${this._esc(this._search)}">
          ${timeBar}
          ${nutriBar}
          <button class="cb-add">＋ Neu</button>
        </div>
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
    this._fillImgs(this.querySelector(".cb-grid"));
  }
  // Ruhige Bildkachel: Foto, darunter Name und eine Zeile mit Zeit und kcal; alles Weitere steht auf der Rezeptseite
  _tileHTML(d) {
    const meta = this._tileMetaTxt(d);
    return `<button class="cb-dish" data-uid="${this._esc(d.uid)}">
        ${this._imgTag(d, "cb-d-img")}
        <div class="cb-d-body">
          <div class="cb-d-name">${this._esc(d.name)}</div>
          ${meta ? `<div class="cb-d-meta">${this._esc(meta)}</div>` : ""}
        </div>
      </button>`;
  }
  _renderGridOnly() {
    const grid = this.querySelector(".cb-grid"); if (!grid) return;
    const dishes = this._filtered();
    grid.innerHTML = dishes.length ? dishes.map(d => `
${this._tileHTML(d)}`).join("") : `<div class="cb-empty">Keine Treffer.</div>`;
    grid.querySelectorAll(".cb-dish").forEach(b => b.addEventListener("click", () => { const d = this._dishes.find(x => x.uid === b.dataset.uid); if (d) this._openDetail(d); }));
    this._fillImgs(grid);
  }

  _overlay(html) {
    this._closeOv();
    const ov = document.createElement("div"); ov.className = "cb-ov"; ov.innerHTML = `<div class="cb-modal">${html}</div>` + this._styles();
    ov.addEventListener("click", e => { if (e.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov; return ov;
  }

  _openDetail(d) {
    let portions = d.portions_base || this.config.base_portions;
    // Mahlzeit (außer „egal") und „zuletzt gekocht" gibt es nur noch hier, nicht mehr auf der Kachel
    const since = this._sinceTxt(d.last_cooked);
    const subTxt = [d.category && d.category !== "egal" ? d.category : "", /^vor /.test(since) ? `zuletzt gekocht ${since}` : since].filter(Boolean).join(" · ");
    const ov = this._overlay(`
      <div class="cb-m-head"><span>${this._esc(d.name)}</span><button class="cb-x">${CP(0x2715)}</button></div>
      <div class="cb-m-sub">${this._esc(subTxt)}</div>
      ${this._imgSrc(d)
        ? `<div class="cb-hero">${this._imgTag(d, "cb-hero-img")}<button class="cb-hero-btn">${CP(0x1F4F7)} Bild ändern</button></div>`
          + (d.image && (d.image.credit || d.image.temp) ? `<div class="cb-credit">${d.image.temp ? '<span class="cb-temp">Vorläufiges Foto</span>' : ""}${d.image.credit ? (d.image.link ? `<a href="${this._esc(d.image.link)}" target="_blank" rel="noopener">${this._esc(d.image.credit)}</a>` : this._esc(d.image.credit)) : ""}</div>` : "")
        : `<button class="cb-hero cb-hero-add">${CP(0x1F4F7)} Bild hinzufügen</button>`}
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
      ov.querySelector(".cb-ing").innerHTML = (d.ingredients || []).map(i => `<li>${this._esc(this._zahl(this._scale(i.qty, factor)))} ${this._esc(i.unit || "")} ${this._esc(i.item || "")}</li>`).join("") || "<li>—</li>";
      ov.querySelector(".cb-port-val").textContent = portions;
    };
    renderIng();
    const renderStars = () => { ov.querySelector(".cb-rate-stars").innerHTML = [1, 2, 3, 4, 5].map(i => `<span class="cb-star" data-v="${i}">${i <= (d.rating || 0) ? CP(0x2605) : CP(0x2606)}</span>`).join(""); };
    renderStars();
    ov.querySelector(".cb-x").addEventListener("click", () => this._closeOv());
    ov.querySelectorAll(".cb-hero-btn,.cb-hero-add").forEach(b => b.addEventListener("click", () => this._openImage(d)));
    this._fillImgs(ov);
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
      .cb-card{padding:14px;container-type:inline-size;}
      /* Kopf in einer Zeile: Titel, Suche als Pille, Hinweis-Pillen, ＋ Neu rechts; bricht um */
      .cb-bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin-bottom:10px;}
      .cb-title{flex:0 1 auto;min-width:0;font-size:1.05rem;font-weight:900;letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere;}
      .cb-search{flex:1 1 140px;min-width:140px;box-sizing:border-box;margin:0;padding:7px 12px;border:none;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font:inherit;font-size:.9rem;line-height:1.3;-webkit-appearance:none;appearance:none;}
      .cb-search::placeholder{color:var(--secondary-text-color);opacity:1;}
      .cb-search:focus{outline:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--fp-accent,var(--primary-color)) 55%,transparent);}
      @media (pointer:coarse){.cb-search{font-size:1rem;}}
      .cb-fixtimes,.cb-fixnutri{flex:none;box-sizing:border-box;min-height:28px;padding:4px 11px;border:1px solid var(--divider-color);border-radius:999px;background:transparent;color:var(--secondary-text-color);font:inherit;font-size:.74rem;font-weight:800;line-height:1.2;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .cb-fixtimes:disabled,.cb-fixnutri:disabled{opacity:.7;cursor:default;}
      .cb-add{flex:none;margin-left:auto;box-sizing:border-box;min-height:32px;padding:0 14px;border:none;border-radius:999px;background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color));font:inherit;font-size:.82rem;font-weight:800;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      @media (hover:hover){
        .cb-fixtimes:not(:disabled):hover,.cb-fixnutri:not(:disabled):hover{background:var(--fp-surface,var(--secondary-background-color));}
        .cb-add:hover{filter:brightness(1.08);}
      }
      /* Handy: Titel und ＋ Neu oben, darunter die Suche über die volle Breite, dann die Hinweise */
      @container (max-width:560px){
        .cb-title{order:1;}
        .cb-add{order:2;}
        .cb-search{order:3;flex:1 1 100%;}
        .cb-fixtimes,.cb-fixnutri{order:4;}
      }
      /* Filter: eine Zeile, waagrecht wischbar, Scrollleiste ausgeblendet */
      .cb-chips{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin:0 -14px 14px;padding:0 14px;}
      .cb-chips::-webkit-scrollbar{display:none;}
      .cb-chip{flex:none;display:inline-flex;align-items:center;min-height:28px;box-sizing:border-box;padding:4px 11px;border:none;border-radius:999px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);font:inherit;font-size:.78rem;font-weight:800;line-height:1.2;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .cb-chip-on{background:var(--primary-text-color);color:var(--card-background-color);}
      @media (hover:hover){.cb-chip:not(.cb-chip-on):hover{background:var(--fp-surface-2,var(--divider-color));}}
      .cb-src{margin-top:12px;font-size:.85rem;}
      .cb-src a{color:var(--primary-color,currentColor);}
      /* Ruhige Bildkacheln: keine Fläche, kein Rand; das Foto ist der Inhalt */
      .cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px 12px;}
      .cb-dish{display:flex;flex-direction:column;gap:8px;min-width:0;padding:0;border:none;border-radius:var(--fp-radius-sm,12px);background:transparent;color:var(--primary-text-color);text-align:left;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .cb-d-img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--fp-radius-sm,12px);background:var(--fp-surface,var(--secondary-background-color));transition:filter .15s;}
      .cb-noimg{display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--fp-surface,var(--secondary-background-color));}
      .cb-d-img.cb-noimg{aspect-ratio:4/3;}
      .cb-d-body{display:flex;flex-direction:column;gap:2px;min-width:0;padding:0 2px;}
      .cb-d-name{font-size:.92rem;font-weight:800;line-height:1.2;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;}
      .cb-d-meta{font-size:.76rem;font-weight:700;line-height:1.2;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .cb-dish:focus-visible{outline:2px solid color-mix(in srgb,var(--fp-accent,var(--primary-color)) 70%,transparent);outline-offset:3px;}
      @media (hover:hover){.cb-dish:hover .cb-d-img{filter:brightness(1.06);}}
      .cb-hero{position:relative;display:block;width:100%;margin:0 0 8px;border-radius:12px;overflow:hidden;}
      .cb-hero-img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;}
      .cb-hero-img.cb-noimg{aspect-ratio:16/10;}
      .cb-hero-btn{position:absolute;right:8px;bottom:8px;border:none;border-radius:999px;padding:6px 11px;font-size:.8rem;font-weight:600;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;}
      .cb-hero-add{border:1.5px dashed var(--divider-color);background:var(--fp-surface,var(--secondary-background-color));color:var(--secondary-text-color);padding:16px;font:inherit;font-weight:600;cursor:pointer;}
      .cb-credit{font-size:.7rem;color:var(--secondary-text-color);margin:-4px 0 8px;}
      .cb-credit a{color:inherit;}
      .cb-temp{font-weight:700;margin-right:6px;}
      .cb-temp::after{content:" ·";font-weight:400;}
      .cb-im-cur{margin-bottom:6px;}
      .cb-im-prev{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;}
      .cb-im-btns .cb-btn{display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;}
      .cb-im-photo{cursor:pointer;}
      .cb-busy{opacity:.7;pointer-events:none;}
      .cb-im-search{margin-top:10px;}
      .cb-im-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:4px;}
      .cb-im-hit{border:none;padding:0;border-radius:8px;overflow:hidden;cursor:pointer;background:var(--fp-surface,var(--secondary-background-color));aspect-ratio:1;}
      .cb-im-hit img{width:100%;height:100%;object-fit:cover;display:block;}
      .cb-im-hit:hover{outline:3px solid var(--fp-accent,var(--primary-color));}
      .cb-time{font-size:.9rem;color:var(--secondary-text-color);margin:4px 0 2px;}
      .cb-imp-row{display:flex;gap:8px;align-items:stretch;}
      .cb-imp-row .cb-in{flex:1;margin:0;}
      .cb-imp-go{white-space:nowrap;}
      .cb-imp-go:disabled{opacity:.7;cursor:default;}
      .cb-tag{font-size:.68rem;font-weight:700;background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 16%,transparent);color:var(--fp-head,var(--primary-text-color));border-radius:8px;padding:1px 6px;}
      .cb-empty{grid-column:1/-1;color:var(--secondary-text-color);text-align:center;padding:18px;}
      .cb-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:20;}
      .cb-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);width:min(94vw,460px);max-height:86vh;overflow:auto;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.4);}
      .cb-m-head{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:1.1rem;margin-bottom:8px;}
      .cb-m-sub{font-size:.82rem;font-weight:700;color:var(--secondary-text-color);margin:-4px 0 8px;}
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
      .cb-btn{flex:1;border:none;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color));}
      .cb-btn.cb-e-cancel{background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);}
      .cb-btn.cb-del{flex:none;background:color-mix(in srgb,var(--error-color,#db4437) 15%,transparent);color:var(--error-color,#db4437);}
      .cb-in{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--divider-color);border-radius:10px;background:var(--card-background-color);color:var(--primary-text-color);margin-bottom:8px;font-size:1rem;}
      textarea.cb-free{min-height:70px;resize:vertical;}
      .cb-ck-tools{display:flex;gap:14px;margin:2px 0 8px;}
      .cb-linkbtn{border:none;background:transparent;color:var(--primary-color,currentColor);cursor:pointer;font-size:.85rem;padding:2px 0;text-decoration:underline;}
      .cb-cklist{max-height:46vh;overflow:auto;display:flex;flex-direction:column;gap:2px;}
      .cb-ck{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;cursor:pointer;}
      .cb-ck:hover{background:var(--fp-surface,var(--secondary-background-color));}
      .cb-ck input{width:18px;height:18px;flex:none;}
      .cb-e-cats,.cb-e-tags{display:flex;gap:6px;flex-wrap:wrap;}
      .cb-e-hint{font-size:.75rem;color:var(--secondary-text-color);margin-top:6px;}
      .cb-e-hint-inline{font-weight:400;text-transform:none;letter-spacing:0;}
      .cb-e-nums{display:flex;gap:8px;flex-wrap:wrap;}
      .cb-e-nums label{flex:1;min-width:96px;display:flex;flex-direction:column;gap:3px;font-size:.72rem;color:var(--secondary-text-color);}
      .cb-e-in{padding:8px 9px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font-size:.95rem;box-sizing:border-box;width:100%;}
      .cb-e-row{display:flex;gap:5px;margin-bottom:5px;align-items:center;}
      .cb-e-q{flex:0 0 68px;} .cb-e-u{flex:0 0 74px;} .cb-e-i{flex:1;min-width:0;}
      .cb-e-x{flex:none;border:none;background:color-mix(in srgb,var(--error-color,#db4437) 12%,transparent);color:var(--error-color,#db4437);border-radius:8px;width:30px;height:34px;cursor:pointer;font-size:.85rem;}
      textarea.cb-e-steps{min-height:150px;resize:vertical;line-height:1.45;font-family:inherit;}
      .cb-btn.cb-edit,.cb-btn.cb-del{flex:none;}
      .cb-btn.cb-edit{background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);}
      .cb-days,.cb-meals{display:flex;gap:6px;flex-wrap:wrap;}
      .cb-day,.cb-meal{border:1px solid var(--divider-color);border-radius:10px;padding:9px 11px;background:var(--fp-surface,var(--secondary-background-color));color:var(--primary-text-color);cursor:pointer;}
      .cb-day.cb-on,.cb-meal.cb-on{background:var(--primary-text-color);color:var(--card-background-color);border-color:transparent;}
    </style>`;
  }
  getCardSize() { return 8; }
}
if (!customElements.get("fp-cookbook-card")) {
  customElements.define("fp-cookbook-card", FpCookbookCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-cookbook-card", name: "FP Cookbook Card", description: "Kochbuch mit Rezepten, KI-Generierung, in Essensplan legen, Zutaten -> Einkauf" });
}

/* ===== dobby-clock-card v10 (ruhiger: Uhrenfelder ohne Fläche, nur die laufende Seite in Akzent getönt, Pause als Pille, feste Farben durch Theme ersetzt; davor: neutrale Vorgabe-Spieler, Bestenliste mit den drei längsten Verstecken samt Zeitraum) ===== */
class DobbyClockCard extends HTMLElement {
  setConfig(config) {
    this.config = Object.assign({
      select: "input_select.dobby_versteckt_von",
      players: [
        { name: "Person A", total: "input_number.dobby_gesamtzeit_person_a" },
        { name: "Person B", total: "input_number.dobby_gesamtzeit_person_b" },
      ],
      since: "input_datetime.dobby_letzter_wechsel",
      highscore: "input_text.dobby_highscore",   // leer lassen blendet die Bestenliste aus
      highscore_label: "Beste Verstecke",
      highscore_empty: "Noch keine Runde zu Ende gespielt",
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
        ${this.config.highscore ? `<div class="dc-hs"><div class="dc-hs-h">${U.esc(this.config.highscore_label)}</div><div class="dc-hs-list"></div></div>` : ""}
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
    this._paintHighscore();
  }

  // Bestenliste. Die Zeichenkette kommt kompakt aus einem input_text:
  // „Name~Sekunden~Startzeit", Einträge durch | getrennt, schon sortiert.
  // Ein input_text fasst 255 Zeichen — drei Einträge brauchen rund 75.
  _paintHighscore() {
    if (!this.config.highscore) return;
    const el = this.querySelector(".dc-hs-list");
    if (!el) return;
    const st = this._hass.states[this.config.highscore];
    const raw = st && typeof st.state === "string" ? st.state : "";
    // Nur neu zeichnen, wenn sich wirklich etwas geändert hat — _paint läuft
    // jede Sekunde, die Liste ändert sich aber nur beim Rundenwechsel.
    if (raw === this._hsRaw) return;
    this._hsRaw = raw;

    const eintraege = raw.split("|").map(e => e.split("~")).filter(p => p.length === 3 && p[0] && Number(p[1]) > 0);
    if (!eintraege.length) {
      el.innerHTML = `<div class="dc-hs-leer">${U.esc(this.config.highscore_empty)}</div>`;
      return;
    }
    const d = ts => new Date(Number(ts) * 1000).toLocaleDateString("de-AT", { day: "numeric", month: "numeric", year: "2-digit" });
    el.innerHTML = eintraege.slice(0, 3).map(([name, sek, start], i) => {
      const s = Number(sek), von = Number(start);
      const zeitraum = von > 0 ? `${d(von)} – ${d(von + s)}` : "";
      return `<div class="dc-hs-row">
        <span class="dc-hs-rang dc-hs-r${i}">${i + 1}</span>
        <span class="dc-hs-name">${U.esc(name)}</span>
        <span class="dc-hs-dauer">${U.esc(this._langfmt(s))}</span>
        <span class="dc-hs-datum">${U.esc(zeitraum)}</span>
      </div>`;
    }).join("");
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
      .dc-paddle.dc-up{background:var(--fp-accent,var(--primary-color));
        box-shadow:0 6px 14px color-mix(in srgb,var(--fp-accent,var(--primary-color)) 32%,transparent);}
      /* Das Scharnier dreht nicht mit — daran hängt der Balken. */
      .dc-hinge{position:absolute;left:50%;top:26px;transform:translateX(-50%);
        width:34px;height:4px;border-radius:2px;background:var(--divider-color);}

      /* --- Gehäuse: keine eigene Fläche, zwei Anzeigen, ein Haarstrich dazwischen.
         Nur die laufende Seite ist in Akzent getönt. --- */
      .dc-body{display:flex;align-items:stretch;border-radius:20px;overflow:hidden;
        background:transparent;}
      .dc-hair{width:1px;background:var(--divider-color);opacity:.6;flex:none;margin:14px 0;}
      .dc-side{flex:1 1 0;min-width:0;border:none;border-radius:var(--fp-radius-sm,14px);background:transparent;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px 18px;
        color:var(--primary-text-color);transition:background .3s;}
      .dc-side:active{background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);}
      .dc-side.dc-on{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 12%,transparent);}
      .dc-name{font-size:.8rem;font-weight:590;letter-spacing:.04em;text-transform:uppercase;
        color:var(--secondary-text-color);opacity:.75;}
      .dc-time{display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;
        font-variant-numeric:tabular-nums;color:var(--secondary-text-color);opacity:.45;
        transition:color .3s,opacity .3s;}
      .dc-big{font-size:3.1rem;font-weight:600;line-height:.98;letter-spacing:-.025em;}
      .dc-sec{font-size:1.4rem;font-weight:500;letter-spacing:-.005em;margin-left:2px;opacity:.85;}
      .dc-rest{font-size:.92rem;font-weight:590;color:var(--secondary-text-color);
        opacity:.6;min-height:1.2em;transition:color .3s,opacity .3s;}
      .dc-side.dc-on .dc-rest{color:var(--fp-accent,var(--primary-color));opacity:.9;}
      .dc-side.dc-on .dc-time{color:var(--fp-accent,var(--primary-color));opacity:1;}
      .dc-total{font-size:.76rem;color:var(--secondary-text-color);opacity:.7;min-height:1.1em;}

      .dc-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin-top:14px;padding:0 4px;}
      .dc-state{font-size:.82rem;color:var(--secondary-text-color);opacity:.8;}
      .dc-pause{border:1px solid var(--divider-color);border-radius:999px;padding:8px 16px;min-height:36px;
        background:transparent;color:var(--secondary-text-color);
        cursor:pointer;font-size:.78rem;font-weight:800;transition:background .2s;}
      .dc-pause:hover{background:color-mix(in srgb,var(--fp-accent,var(--primary-color)) 12%,transparent);}

      /* --- Bestenliste --- */
      .dc-hs{margin-top:16px;padding-top:14px;border-top:1px solid var(--divider-color);}
      .dc-hs-h{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
        color:var(--secondary-text-color);opacity:.7;margin-bottom:10px;}
      .dc-hs-row{display:grid;grid-template-columns:22px 1fr auto;grid-template-areas:"r n d" "r z d";
        align-items:center;gap:0 10px;padding:6px 0;}
      .dc-hs-row + .dc-hs-row{border-top:1px solid var(--divider-color);}
      .dc-hs-rang{grid-area:r;width:22px;height:22px;border-radius:50%;display:flex;
        align-items:center;justify-content:center;font-size:.72rem;font-weight:700;
        background:var(--secondary-background-color);color:var(--secondary-text-color);}
      /* Nur der erste Platz bekommt Farbe — drei bunte Medaillen waeren Laerm. */
      .dc-hs-rang.dc-hs-r0{background:var(--fp-accent,var(--primary-color));color:var(--fp-accent-fg,var(--text-primary-color,#fff));}
      .dc-hs-name{grid-area:n;font-size:.92rem;font-weight:600;}
      .dc-hs-datum{grid-area:z;font-size:.72rem;color:var(--secondary-text-color);opacity:.7;
        font-variant-numeric:tabular-nums;}
      .dc-hs-dauer{grid-area:d;font-size:.92rem;font-weight:700;color:var(--fp-head,var(--primary-color));
        font-variant-numeric:tabular-nums;text-align:right;}
      .dc-hs-leer{font-size:.82rem;color:var(--secondary-text-color);opacity:.7;}
    </style>`;
  }
  getCardSize() { return 4; }
}
if (!customElements.get("dobby-clock-card")) {
  customElements.define("dobby-clock-card", DobbyClockCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "dobby-clock-card", name: "Dobby Clock Card", description: "Schachuhr, die hochzaehlt — fuer Versteckspiele zu zweit" });
}

/* ===== fp-feeding-card v14 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Uhrzeit-Eingaben in der doppelten Stunde (Ende der Sommerzeit) eindeutig; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: Farben und Radien aus dem Theme, Kinderfarbe im Dunkeln lesbar; 7-Tage-Ansicht mit Spalte Stillzeit je Tag, gleichmaessige Spalten, Zahlen rechtsbuendig; Auswahl Tag/Seite im Dialog bleibt stehen; Fläschchen-Zeit ist das Ende: Beginn wird bottle_minutes früher geschätzt, Feld „Fertig um“; Mahlzeit = Einträge mit höchstens meal_pause_minutes Pause dazwischen, Erinnerungsgrenze tags/nachts aus Helfern; Fläschchen: 40 ml vorausgewählt, Schnellwahl 40/60/90/120; Uhrzeitfelder passen aufs iPhone; auf schmalen Karten Start/Stopp in eigener Zeile, Tabelle ohne Umbrüche; Bericht neu gegliedert: Kennzahlen, Mahlzeiten und Windeln getrennt, nur Tage mit Daten, am Handy als Karten; Bericht im Fenster ueber der Karte statt Pop-up, Drucken nur des Berichts, Teilen als Datei; Zeit seit der letzten Mahlzeit gross mit Balken bis zur Erinnerung, Rueckblick ueber 7 Tage, Bericht der letzten 7 Tage zum Drucken oder als PDF, auf Wunsch mit Windeln und Gewicht; Akzentfarbe auch im Dialog, vorher im hellen Modus unsichtbare Knoepfe; Stillprotokoll je Kind: Start/Stopp mit laufender Uhr, Seite mit Vorschlag, Flaeschchen in ml, Heute/Gestern mit Tagessummen, Zeilen bearbeiten und loeschen) ===== */
// Die Karte schreibt Stillen nie selbst: sie schaltet nur den input_boolean, den
// auch Alexa schaltet. Den Termin legt die Protokoll-Automation an. So gibt es
// genau einen Schreiber, egal ob per Knopf, per Stimme oder per Auto-Ende.
// Fläschchen und Korrekturen schreibt die Karte direkt in den Kalender.
class FpFeedingCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.calendar || !config.switch) throw new Error("fp-feeding-card braucht calendar und switch");
    this.config = Object.assign({
      name: "",
      side: "",            // input_select mit links/rechts
      start: "",           // input_datetime mit dem Beginn der laufenden Mahlzeit
      color: "",           // Akzent fürs Kind, sonst Theme-Akzent
      auto_minutes: 60,
      bottle_presets: [40, 60, 90, 120],   // die erste Menge ist im Fläschchen-Dialog vorausgewählt
      diaper_calendar: "",  // optional für den Bericht: Kalender der fp-diaper-card
      reminder_hours: 3,           // Grenze bis zur Erinnerung, falls keine Helfer angegeben sind
      reminder_entity: "",         // optional: input_number (Stunden) für tagsüber, wie in der Erinnerungs-Automation
      reminder_night_entity: "",   // optional: input_number (Stunden) für nachts
      night_start: 22, night_end: 6,
      meal_pause_minutes: 45,      // höchstens so viel Pause zwischen zwei Einträgen derselben Mahlzeit
      meal_pause_entity: "",       // optional: input_number (Minuten), überschreibt meal_pause_minutes
      bottle_minutes: 15,          // Fläschchen werden nach dem Trinken eingetragen: geschätzte Trinkdauer davor
      weight_calendar: "",  // optional für den Bericht: Kalender der fp-weight-card
      weight_key: "",       // und der Schlüssel dieses Kinds dort (kids[].key)
    }, config);
    this._built = false; this._events = null; this._windeln = null; this._sig = ""; this._ticks = 0;
    this._wkKey = `fp-feeding-woche:${this.config.calendar}`;
    try { this._woche = localStorage.getItem(this._wkKey) === "1"; } catch (e) { this._woche = false; }
  }

  set hass(hass) {
    const prev = this._hass; this._hass = hass;
    this.classList.toggle("ff-dark", !!(hass && hass.themes && hass.themes.darkMode));   // hell oder dunkel entscheidet das Gerät; am Host, damit auch der Dialog es sieht
    if (!this._built) { this._build(); this._load(); }
    // Beim Stopp schreibt die Automation den Termin — aber nicht sofort: erst
    // ~2 s Echo-Erkennung, bei Alexa-Stopp bis zu 30 s Rueckfrage nach der Seite.
    // Deshalb mehrfach nachladen; der Seitenwechsel danach ist das sichere Signal.
    const nun = hass.states[this.config.switch], vorher = prev && prev.states[this.config.switch];
    if (vorher && nun && vorher.state === "on" && nun.state === "off") this._nachladen([3000, 6000, 12000, 25000, 40000]);
    const sNun = this.config.side && hass.states[this.config.side], sVor = this.config.side && prev && prev.states[this.config.side];
    if (sNun && sVor && sNun.state !== sVor.state) this._nachladen([800]);
    this._paintControls();
  }
  _nachladen(zeiten) {
    (this._nachTimer || []).forEach(clearTimeout);
    this._nachTimer = zeiten.map(ms => setTimeout(() => this._load(), ms));
  }
  connectedCallback() { if (!this._timer) this._timer = setInterval(() => this._tick(), 1000); }
  disconnectedCallback() { clearInterval(this._timer); this._timer = null; }
  // Die Uhr tickt im Browser, nicht als Sensor. Alle 20 s wird der Kalender
  // neu gelesen — fuer Eintraege von anderen Geraeten oder per Sprache (Flaeschchen).
  _tick() { this._paintControls(); if (++this._ticks % 20 === 0) this._load(); }

  // ---------- Hilfen ----------
  _p(n) { return String(n).padStart(2, "0"); }
  _hm(d) { return `${this._p(d.getHours())}:${this._p(d.getMinutes())}`; }
  _dur(sek) {
    const m = Math.max(0, Math.round(sek / 60));
    if (m < 60) return `${m} Min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} Std ${r} Min` : `${h} Std`;
  }
  _uhr(sek) {   // laufende Mahlzeit: 12:34 bzw. 1:02:07
    const s = Math.max(0, Math.floor(sek)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${this._p(m)}:${this._p(r)}` : `${m}:${this._p(r)}`;
  }
  _hmDauer(ms) {   // 2:05 h
    const m = Math.max(0, Math.floor(ms / 60000));
    return `${Math.floor(m / 60)}:${this._p(m % 60)} h`;
  }
  _artText(a) { return a === "beides" ? "nass + voll" : a; }
  _vor(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return "gerade eben";
    if (m < 60) return `vor ${m} Min`;
    const h = Math.floor(m / 60), r = m % 60;
    return `vor ${h} Std${r ? ` ${r} Min` : ""}`;
  }
  _tag(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  _laeuft() { const s = this._hass && this._hass.states[this.config.switch]; return !!s && s.state === "on"; }
  _beginn() {
    const s = this._hass && this.config.start && this._hass.states[this.config.start];
    const t = s && s.attributes ? Number(s.attributes.timestamp) : 0;
    return t > 0 ? t : 0;
  }
  _seite() {
    const s = this._hass && this.config.side && this._hass.states[this.config.side];
    return s ? s.state : "";
  }

  // Termin lesen. Die Beschreibung trägt die Daten als JSON; fehlt sie (jemand
  // hat im HA-Kalender von Hand eingetragen), wird aus der Überschrift geraten.
  _parse(ev, cal) {
    const s = new Date((ev.start && (ev.start.dateTime || ev.start.date)) || ev.start);
    const e = new Date((ev.end && (ev.end.dateTime || ev.end.date)) || ev.end);
    let meta = {};
    try { meta = JSON.parse(ev.description || "{}") || {}; } catch (x) { meta = {}; }
    const sum = String(ev.summary || "");
    const typ = meta.typ || (cal && cal === this.config.diaper_calendar ? "windel" : /fl[äa]sch/i.test(sum) ? "flasche" : "stillen");
    let ml = Number(meta.ml) || 0;
    if (!ml) { const m = sum.match(/(\d+)\s*ml/i); if (m) ml = Number(m[1]); }
    const seite = meta.seite || (/rechts/i.test(sum) ? "rechts" : /links/i.test(sum) ? "links" : "");
    const art = meta.art || (/beides|\+/.test(sum) ? "beides" : /voll/i.test(sum) ? "voll" : "nass");
    return { uid: ev.uid, cal, start: s, end: e, typ, ml, seite, art, auto: !!meta.auto };
  }

  // Zahl aus einem input_number, sonst der Vorgabewert.
  _zahl(entity, vorgabe) {
    const st = entity && this._hass && this._hass.states[entity];
    const v = st ? parseFloat(st.state) : NaN;
    return isFinite(v) && v > 0 ? v : vorgabe;
  }
  // Wie die Erinnerungs-Automation: Eine Mahlzeit umfasst alle Einträge, zwischen denen
  // höchstens meal_pause_minutes Pause liegt, gemessen vom Ende des vorigen zum Beginn des
  // nächsten. So bleibt eine Fütterung über eine Stunde (Stillen, Fläschchen, nochmal
  // Stillen) eine Mahlzeit; gezählt wird ab ihrem Beginn.
  // Fläschchen stehen mit der Uhrzeit, zu der sie fertig waren; ihr Beginn liegt geschätzt
  // bottle_minutes davor. Beginnt eine Mahlzeit mit einem Fläschchen, ist ihr Start geschätzt.
  _mahlzeiten(evs) {
    const pause = this._zahl(this.config.meal_pause_entity, this.config.meal_pause_minutes) * 60000, out = [];
    const flasche = (Number(this.config.bottle_minutes) || 0) * 60000;
    let ende = 0;
    evs.filter(e => e.typ !== "windel")
      .map(e => ({ e, ab: e.typ === "flasche" ? +e.start - flasche : +e.start }))
      .sort((a, b) => a.ab - b.ab)
      .forEach(({ e, ab }) => {
        if (!out.length || ab - ende > pause) out.push({ start: new Date(ab), geschaetzt: e.typ === "flasche", evs: [] });
        out[out.length - 1].evs.push(e);
        ende = Math.max(ende, +e.end);
      });
    return out;
  }
  // Grenze in Stunden, die zu einem Zeitpunkt gilt (nachts eine eigene).
  _grenze(t) {
    const h = new Date(t).getHours(), c = this.config;
    const nacht = c.night_start > c.night_end ? (h >= c.night_start || h < c.night_end) : (h >= c.night_start && h < c.night_end);
    const tag = this._zahl(c.reminder_entity, c.reminder_hours);
    return nacht ? this._zahl(c.reminder_night_entity, tag) : tag;
  }
  // Erste Minute, in der die Erinnerung auslöst — so prüft es die Automation jede Minute.
  _erinnerungAb(start) {
    for (let i = 0; i <= 12 * 60; i++) {
      const t = start + i * 60000;
      if (t - start >= this._grenze(t) * 3600000) return t;
    }
    return start + this._grenze(start) * 3600000;
  }

  async _load() {
    if (!this._hass) return;
    const jetzt = new Date();
    // Acht Tage: heute und gestern für die Tabelle, die sieben Tage für den Rückblick
    // und davor einer, damit auch die erste Mahlzeit des ältesten Tags einen Abstand hat.
    const von = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 7);
    const bis = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1);
    const s = encodeURIComponent(von.toISOString()), e = encodeURIComponent(bis.toISOString());
    const holen = async cal => {
      const evts = await this._hass.callApi("GET", `calendars/${cal}?start=${s}&end=${e}`);
      return (Array.isArray(evts) ? evts : []).map(x => this._parse(x, cal)).filter(x => !isNaN(x.start));
    };
    try {
      const dc = this.config.diaper_calendar;
      const [still, windeln] = await Promise.all([holen(this.config.calendar), dc ? holen(dc) : []]);
      this._events = still; this._windeln = windeln;
    } catch (err) {
      if (this._loadedOnce) U.toast(this, "Stillprotokoll konnte nicht geladen werden");
      this._events = this._events || []; this._windeln = this._windeln || [];
    }
    this._loadedOnce = true;   // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._paintTable();
    this._paintControls();
  }

  // ---------- Aufbau ----------
  _build() {
    this._built = true;
    const c = this.config;
    // Am Host statt an der ha-card: der Dialog hängt daneben und braucht den Akzent auch.
    // Schrift auf der Kinderfarbe ist weiß, auf dem Theme-Akzent --fp-accent-fg (kommt im CSS).
    if (c.color) { this.style.setProperty("--ff-akzent", c.color); this.style.setProperty("--ff-akzent-fg", "#fff"); }
    else { this.style.removeProperty("--ff-akzent"); this.style.removeProperty("--ff-akzent-fg"); }
    this.innerHTML = `
      <ha-card class="ff-card">
        <div class="ff-head">
          <div class="ff-name"><span class="ff-dot"></span>${U.esc(c.name)}</div>
          ${c.side ? `<div class="ff-seite">
            <span class="ff-seite-lbl">nächste Seite</span>
            <div class="ff-seg"><button data-s="links">Links</button><button data-s="rechts">Rechts</button></div>
          </div>` : ""}
        </div>
        <div class="ff-actions">
          <button class="ff-main"><span class="ff-main-txt">▶ Stillen starten</span><span class="ff-main-uhr"></span></button>
          <button class="ff-bottle">🍼 Fläschchen</button>
          <button class="ff-bottle ff-nach" title="Vergessen zu starten? Stillen nachtragen">✎ Nachtragen</button>
        </div>
        <div class="ff-since" hidden>
          <div class="ff-since-top"><span class="ff-since-big"></span><span class="ff-since-txt"></span></div>
          <div class="ff-bar"><div class="ff-bar-fill"></div></div>
        </div>
        <div class="ff-table"></div>
        <div class="ff-foot2">
          <button class="ff-txtbtn ff-rep">🖨 Bericht</button>
          <button class="ff-txtbtn ff-wk-tgl"></button>
        </div>
        <div class="ff-week" hidden></div>
      </ha-card>
      ${this._styles()}`;
    this.querySelector(".ff-main").addEventListener("click", () => this._toggle());
    this.querySelector(".ff-bottle:not(.ff-nach)").addEventListener("click", () => this._openBottle());
    this.querySelector(".ff-nach").addEventListener("click", () => this._openNachtrag());
    this.querySelector(".ff-rep").addEventListener("click", () => this._bericht());
    this.querySelector(".ff-wk-tgl").addEventListener("click", () => {
      this._woche = !this._woche;
      try { localStorage.setItem(this._wkKey, this._woche ? "1" : "0"); } catch (e) { /* nur Komfort */ }
      this._paintTable();
    });
    this.querySelectorAll(".ff-head .ff-seg button").forEach(b => b.addEventListener("click", () => {
      this._hass.callService("input_select", "select_option", { entity_id: c.side, option: b.dataset.s });
    }));
    // Ein Klick irgendwo in der Tabelle — die Zeile weiß, welcher Eintrag sie ist.
    this.querySelector(".ff-table").addEventListener("click", ev => {
      const tr = ev.target.closest("tr[data-uid]");
      if (!tr) return;
      const e = (this._events || []).find(x => x.uid === tr.dataset.uid);
      if (e) this._openEdit(e);
    });
  }

  _toggle() {
    const laeuft = this._laeuft();
    const svc = laeuft ? "turn_off" : "turn_on";
    if (laeuft && this._beginn() && Date.now() / 1000 - this._beginn() < 30)
      U.toast(this, "Unter 30 Sekunden – als Fehltipp verworfen, nicht protokolliert");
    this._hass.callService("input_boolean", svc, { entity_id: this.config.switch });
  }

  _paintControls() {
    if (!this._built || !this._hass) return;
    const laeuft = this._laeuft();
    const main = this.querySelector(".ff-main");
    main.classList.toggle("ff-run", laeuft);
    main.querySelector(".ff-main-txt").textContent = laeuft ? "■ Stoppen" : "▶ Stillen starten";
    main.querySelector(".ff-main-uhr").textContent = laeuft && this._beginn() ? this._uhr(Date.now() / 1000 - this._beginn()) : "";

    const seite = this._seite();
    // Nur der Kartenkopf — sonst trifft es die Knöpfe im offenen Dialog (Tag, Seite) mit.
    this.querySelectorAll(".ff-head .ff-seg button").forEach(b => b.classList.toggle("ff-on", b.dataset.s === seite));
    const lbl = this.querySelector(".ff-seite-lbl");
    if (lbl) lbl.textContent = laeuft ? "Seite" : "nächste Seite";

    // Hebammen zählen Abstände von Beginn zu Beginn — deshalb der Beginn der
    // letzten Mahlzeit, nicht ihr Ende. Während des Stillens steht die Uhr im Knopf.
    const since = this.querySelector(".ff-since");
    since.hidden = laeuft || !this._events;
    if (since.hidden) return;
    const big = since.querySelector(".ff-since-big"), txt = since.querySelector(".ff-since-txt");
    const bar = since.querySelector(".ff-bar"), fill = since.querySelector(".ff-bar-fill");
    const meals = this._mahlzeiten(this._events);
    if (!meals.length) {
      big.textContent = ""; txt.textContent = "Noch keine Mahlzeit eingetragen"; bar.hidden = true;
      since.classList.remove("ff-bald", "ff-faellig");
      return;
    }
    const letzte = meals[meals.length - 1].start, ca = meals[meals.length - 1].geschaetzt ? "ca. " : "";
    const ms = Date.now() - letzte.getTime(), ziel = this._erinnerungAb(letzte.getTime()) - letzte.getTime();
    const um = `${ca}${this._tag(letzte) === this._tag(new Date()) ? "" : `${letzte.getDate()}.${letzte.getMonth() + 1}. `}${this._hm(letzte)}`;
    // Über 8 Stunden erinnert auch die Automation nicht mehr — dann nur noch die Zeit.
    const lang = ms > 8 * 3600000, faellig = !lang && ms >= ziel;
    big.textContent = this._hmDauer(ms);
    txt.textContent = lang ? `seit der letzten Mahlzeit (${um})`
      : faellig ? `seit der letzten Mahlzeit (${um}), fällig seit ${this._hmDauer(ms - ziel)}`
      : `seit der letzten Mahlzeit (${um}) · Erinnerung um ${this._hm(new Date(letzte.getTime() + ziel))}`;
    bar.hidden = lang;
    fill.style.width = `${Math.min(100, (ms / ziel) * 100)}%`;
    since.classList.toggle("ff-bald", !lang && !faellig && ms >= ziel * 0.85);
    since.classList.toggle("ff-faellig", faellig);
  }

  _paintTable() {
    const el = this.querySelector(".ff-table");
    if (!el || !this._events) return;
    // Nur neu zeichnen, wenn sich etwas geändert hat — _load läuft alle 20 s. Das
    // Datum gehört dazu, damit um Mitternacht „Heute" zu „Gestern" wird.
    const sig = JSON.stringify([this._tag(new Date()), this._woche,
      this._events.map(e => [e.uid, +e.start, +e.end, e.typ, e.ml, e.seite, e.auto])]);
    if (sig === this._sig) return;
    this._sig = sig;

    const heute = new Date(), gestern = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - 1);
    const tage = [["Heute", this._tag(heute)], ["Gestern", this._tag(gestern)]];
    const amTag = (arr, key) => arr.filter(e => this._tag(e.start) === key);
    el.innerHTML = tage.map(([titel, key]) => this._dayHTML(titel, amTag(this._events, key))).join("");
    this._paintWeek();
  }

  _dayHTML(titel, evs) {
    evs = evs.slice().sort((a, b) => b.start - a.start);   // neueste oben — nachts will man die letzte sehen
    const stillen = evs.filter(e => e.typ === "stillen"), flaschen = evs.filter(e => e.typ === "flasche");
    const minuten = stillen.reduce((s, e) => s + Math.max(0, (e.end - e.start) / 1000), 0);
    const ml = flaschen.reduce((s, e) => s + (e.ml || 0), 0);
    const zeilen = evs.map(e => {
      if (e.typ === "flasche") {
        return `<tr data-uid="${U.esc(e.uid)}" class="ff-r-flasche">
          <td>${this._hm(e.start)}</td><td class="ff-leer">–</td><td class="ff-leer">–</td><td class="ff-leer">–</td>
          <td class="ff-ml">${e.ml ? `${e.ml} ml` : "–"}</td></tr>`;
      }
      return `<tr data-uid="${U.esc(e.uid)}">
        <td>${this._hm(e.start)}</td>
        <td>${this._hm(e.end)}${e.auto ? `<span class="ff-auto" title="Automatisch nach ${this.config.auto_minutes} Minuten beendet">auto</span>` : ""}</td>
        <td>${this._dur((e.end - e.start) / 1000)}</td>
        <td>${U.esc(e.seite || "–")}</td>
        <td class="ff-leer">–</td></tr>`;
    }).join("");
    const leer = `<tr class="ff-nichts"><td colspan="5">Noch nichts eingetragen</td></tr>`;
    const summe = evs.length ? `<tfoot><tr>
        <td colspan="2">${stillen.length} × gestillt${flaschen.length ? ` · ${flaschen.length} × Flasche` : ""}</td>
        <td>${stillen.length ? this._dur(minuten) : "–"}</td><td></td>
        <td class="ff-ml">${ml ? `${ml} ml` : "–"}</td></tr></tfoot>` : "";
    return `<div class="ff-day">
      <div class="ff-dayhead">${titel}</div>
      <table class="ff-tab">
        <thead><tr><th>Beginn</th><th>Ende</th><th>Dauer</th><th>Seite</th><th>Fläschchen</th></tr></thead>
        <tbody>${zeilen || leer}</tbody>${summe}
      </table></div>`;
  }

  // Rückblick: je Tag Mahlzeiten (gruppiert wie die Erinnerung), Ø Abstand von
  // Beginn zu Beginn, Fläschchen-ml und Windeln. Abstände über 8 h zählen nicht.
  _paintWeek() {
    const tgl = this.querySelector(".ff-wk-tgl"), box = this.querySelector(".ff-week");
    if (!tgl || !box) return;
    tgl.textContent = `Letzte 7 Tage ${this._woche ? "▾" : "▸"}`;
    box.hidden = !this._woche;
    if (!this._woche) { box.innerHTML = ""; return; }
    const evs = this._events || [], meals = this._mahlzeiten(evs), wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const heute = new Date(), zeilen = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - i), key = this._tag(d);
      const idx = meals.map((m, j) => j).filter(j => this._tag(meals[j].start) === key);
      const abst = idx.filter(j => j > 0).map(j => meals[j].start - meals[j - 1].start).filter(x => x <= 8 * 3600000);
      const ml = evs.filter(e => e.typ === "flasche" && this._tag(e.start) === key).reduce((t, e) => t + (e.ml || 0), 0);
      // Gesamte Stilldauer des Tages, gezählt am Tag des Beginns
      const still = evs.filter(e => e.typ === "stillen" && this._tag(e.start) === key).reduce((t, e) => t + Math.max(0, e.end - e.start), 0);
      zeilen.push({ titel: i ? `${wt[d.getDay()]} ${d.getDate()}.` : "Heute", n: idx.length, ml, still,
        avg: abst.length ? abst.reduce((a, b) => a + b, 0) / abst.length : 0 });
    }
    const maxN = Math.max(1, ...zeilen.map(z => z.n));
    box.innerHTML = `<table class="ff-tab ff-wk">
      <colgroup><col class="ff-wk-c1"><col class="ff-wk-c2"><col><col><col></colgroup>
      <thead><tr><th>Tag</th><th>Mahlzeiten</th><th>Stillzeit</th><th>Ø&nbsp;Abstand</th><th>Fläschchen</th></tr></thead>
      <tbody>${zeilen.map(z => `<tr>
        <td>${z.titel}</td>
        <td><div class="ff-wk-n"><span class="ff-wk-track"><span class="ff-wk-bar" style="width:${(z.n / maxN) * 100}%"></span></span><b>${z.n}</b></div></td>
        <td>${z.still ? this._hmDauer(z.still) : "–"}</td>
        <td>${z.avg ? this._hmDauer(z.avg) : "–"}</td>
        <td>${z.ml ? `${z.ml} ml` : "–"}</td></tr>`).join("")}</tbody>
    </table>`;
  }

  // ---------- Bericht ----------
  // Fenster über der Karte mit der druckfertigen Seite in einem iframe. Kein Pop-up:
  // die Home-Assistant-App auf dem Handy öffnet keine neuen Fenster. Gedruckt wird nur
  // das iframe; „Als PDF sichern" bietet der Druckdialog an. Wo das Gerät Dateien teilen
  // kann, gibt es zusätzlich „Teilen" mit dem Bericht als HTML-Datei.
  async _bericht() {
    let gewichte = [];
    const wc = this.config.weight_calendar;
    if (wc) {
      try {
        const jetzt = new Date(), von = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 60);
        const evts = await this._hass.callApi("GET",
          `calendars/${wc}?start=${encodeURIComponent(von.toISOString())}&end=${encodeURIComponent(jetzt.toISOString())}`);
        gewichte = (Array.isArray(evts) ? evts : []).map(ev => {
          let m = {}; try { m = JSON.parse(ev.description || "{}") || {}; } catch (x) { m = {}; }
          const sum = String(ev.summary || ""), g = Number(m.g) || Number((sum.match(/(\d+)\s*g\b/) || [])[1]) || 0;
          const passt = this.config.weight_key ? m.kind === this.config.weight_key : sum.startsWith(this.config.name);
          return passt && g ? { d: new Date((ev.start && (ev.start.date || ev.start.dateTime)) || ev.start), g } : null;
        }).filter(Boolean).sort((a, b) => a.d - b.d);
      } catch (e) { gewichte = []; }
    }
    this._berichtZeigen(gewichte);
  }

  _berichtZeigen(gewichte) {
    this._closeOv();
    const name = this.config.name || "", heute = new Date();
    const datei = `Stillprotokoll ${name} ${heute.getFullYear()}-${this._p(heute.getMonth() + 1)}-${this._p(heute.getDate())}.html`.replace(/\s+/g, " ");
    const ov = document.createElement("div");
    ov.className = "ff-ov ff-rep-ov";
    ov.innerHTML = `<div class="ff-rep-box">
      <div class="ff-rep-bar">
        <button class="ff-btn ff-ok ff-rep-print">🖨 Drucken / PDF</button>
        <button class="ff-btn ff-rep-share" hidden>Teilen</button>
        <span class="ff-flex"></span>
        <button class="ff-btn ff-rep-close">Schließen</button>
      </div>
      <iframe class="ff-rep-frame" title="Bericht"></iframe>
    </div>`;
    ov.addEventListener("click", e => { if (e.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov;
    const fr = ov.querySelector(".ff-rep-frame");
    fr.srcdoc = this._berichtHTML(gewichte, false);
    ov.querySelector(".ff-rep-close").addEventListener("click", () => this._closeOv());
    ov.querySelector(".ff-rep-print").addEventListener("click", () => {
      try { fr.contentWindow.focus(); fr.contentWindow.print(); }
      catch (e) { U.toast(this, "Drucken geht auf diesem Gerät nicht – bitte „Teilen“ verwenden"); }
    });
    // Teilen nur anbieten, wenn das Gerät Dateien teilen kann (iPhone, Android, manche Desktops).
    let file = null;
    try { file = new File([this._berichtHTML(gewichte, true)], datei, { type: "text/html" }); } catch (e) { file = null; }
    const share = ov.querySelector(".ff-rep-share");
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      share.hidden = false;
      share.addEventListener("click", async () => {
        try { await navigator.share({ files: [file], title: datei.replace(/\.html$/, "") }); }
        catch (e) { if (e && e.name !== "AbortError") U.toast(this, "Teilen hat nicht geklappt"); }
      });
    }
  }

  // knopf: eigener Drucken-Knopf in der Seite, nur für die geteilte Datei (im Fenster
  // über der Karte gibt es die Leiste darüber).
  _berichtHTML(gewichte, knopf) {
    const evs = this._events || [], win = this._windeln || [], meals = this._mahlzeiten(evs), dc = !!this.config.diaper_calendar;
    const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const kurz = d => `${wt[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`, lang = d => `${kurz(d)}${d.getFullYear()}`;
    const kg = g => `${(g / 1000).toFixed(3).replace(".", ",")} kg`, zahl = v => String(Math.round(v * 10) / 10).replace(".", ",");
    const hm = sek => { const m = Math.round(sek / 60); return m < 60 ? `${m} Min` : `${Math.floor(m / 60)}:${this._p(m % 60)} h`; };
    const heute = new Date(), amTag = (arr, key) => arr.filter(e => this._tag(e.start) === key);
    // Nur Tage mit Einträgen: vor Beginn des Protokolls stünden sonst lauter Striche da.
    const tage = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - i), key = this._tag(d);
      const e = amTag(evs, key), w = amTag(win, key);
      if (!e.length && !w.length) continue;
      const still = e.filter(x => x.typ === "stillen"), fl = e.filter(x => x.typ === "flasche");
      const idx = meals.map((m, j) => j).filter(j => this._tag(meals[j].start) === key);
      const abst = idx.filter(j => j > 0).map(j => meals[j].start - meals[j - 1].start), kurzAbst = abst.filter(x => x <= 8 * 3600000);
      tage.push({ d, voll: i > 0, n: idx.length, still: still.length,
        min: still.reduce((t, x) => t + Math.max(0, (x.end - x.start) / 1000), 0),
        fl: fl.length, ml: fl.reduce((t, x) => t + (x.ml || 0), 0),
        avg: kurzAbst.length ? kurzAbst.reduce((p, q) => p + q, 0) / kurzAbst.length : 0, max: abst.length ? Math.max(...abst) : 0,
        nass: w.filter(x => x.art !== "voll").length, stuhl: w.filter(x => x.art !== "nass").length,
        essen: e.slice().sort((p, q) => p.start - q.start), windeln: w.slice().sort((p, q) => p.start - q.start) });
    }
    // Kennzahlen aus den vollständigen Tagen (heute läuft noch); gibt es keinen, dann aus allen.
    const basis = tage.filter(t => t.voll).length ? tage.filter(t => t.voll) : tage;
    const schnitt = f => basis.length ? basis.reduce((t, x) => t + f(x), 0) / basis.length : 0;
    const mitAbst = basis.filter(t => t.avg), avgAbst = mitAbst.length ? mitAbst.reduce((t, x) => t + x.avg, 0) / mitAbst.length : 0;
    let zunahme = "";
    if (gewichte.length > 1) {
      const a = gewichte[0], z = gewichte[gewichte.length - 1], tg = (z.d - a.d) / 86400000;
      if (tg >= 1) zunahme = `${Math.round(((z.g - a.g) / tg) * 7)} g pro Woche`;
    }
    const kachel = (wert, text) => `<div class="k"><b>${wert}</b><span>${text}</span></div>`;
    const kacheln = [
      kachel(zahl(schnitt(t => t.n)), "Mahlzeiten pro Tag"),
      kachel(avgAbst ? hm(avgAbst / 1000) : "–", "Ø Abstand"),
      kachel(hm(schnitt(t => t.min)), "Stillzeit pro Tag"),
      kachel(`${Math.round(schnitt(t => t.ml))} ml`, "Fläschchen pro Tag"),
      ...(dc ? [kachel(`${zahl(schnitt(t => t.nass))} / ${zahl(schnitt(t => t.stuhl))}`, "Windeln nass / voll pro Tag")] : []),
      ...(gewichte.length ? [kachel(kg(gewichte[gewichte.length - 1].g), zunahme || `am ${kurz(gewichte[gewichte.length - 1].d)}`)] : []),
    ].join("");
    // Auf schmalen Bildschirmen werden Tabellenzeilen zu Karten; data-l liefert die Beschriftung.
    const td = (l, v) => `<td data-l="${l}"><span>${v}</span></td>`;
    const essenTab = `<table class="t"><thead><tr><th>Tag</th><th>Mahlzeiten</th><th>Stillzeit</th><th>Fläschchen</th><th>Ø Abstand</th><th>Längste Pause</th></tr></thead><tbody>${
      tage.map(t => `<tr><td class="tag">${kurz(t.d)}${t.voll ? "" : " <i>(läuft)</i>"}</td>${td("Mahlzeiten", t.n)}${td("Stillzeit", t.still ? hm(t.min) : "–")}${
        td("Fläschchen", t.fl ? `${t.ml} ml <small>(${t.fl}×)</small>` : "–")}${td("Ø Abstand", t.avg ? hm(t.avg / 1000) : "–")}${td("Längste Pause", t.max ? hm(t.max / 1000) : "–")}</tr>`).join("")}</tbody></table>`;
    const windelTab = dc ? `<h2>Windeln</h2><table class="t"><thead><tr><th>Tag</th><th>Nass</th><th>Voll</th><th>Zeiten</th></tr></thead><tbody>${
      tage.map(t => `<tr><td class="tag">${kurz(t.d)}</td>${td("Nass", t.nass)}${td("Voll", t.stuhl)}${
        td("Zeiten", t.windeln.map(w => `${this._hm(w.start)} ${w.art === "beides" ? "💧💩" : w.art === "voll" ? "💩" : "💧"}`).join(", ") || "–")}</tr>`).join("")}</tbody></table>` : "";
    const gew = gewichte.length ? `<h2>Gewicht</h2><table class="t"><thead><tr><th>Datum</th><th>Gewicht</th><th>Änderung</th></tr></thead><tbody>${
      gewichte.map((x, i) => {
        const v = i ? gewichte[i - 1] : null, diff = v ? x.g - v.g : 0, tg = v ? Math.round((x.d - v.d) / 86400000) : 0;
        return `<tr><td class="tag">${lang(x.d)}</td>${td("Gewicht", kg(x.g))}${td("Änderung", v ? `${diff >= 0 ? "+" : "−"}${Math.abs(diff)} g in ${tg} ${tg === 1 ? "Tag" : "Tagen"}` : "–")}</tr>`;
      }).join("")}</tbody></table>` : "";
    const zeile = x => x.typ === "flasche"
      ? `<tr><td class="z">${this._hm(x.start)}</td><td>🍼 Fläschchen ${x.ml ? `${x.ml} ml` : ""}</td></tr>`
      : `<tr><td class="z">${this._hm(x.start)}–${this._hm(x.end)}</td><td>Stillen ${U.esc(x.seite || "")} · ${this._dur((x.end - x.start) / 1000)}</td></tr>`;
    const eintraege = tage.filter(t => t.essen.length).map(t => `<div class="tagbox"><h3>${lang(t.d)}</h3><table class="e"><tbody>${t.essen.map(zeile).join("")}</tbody></table></div>`).join("");
    const name = U.esc(this.config.name || ""), von = tage.length ? tage[0].d : heute;
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stillprotokoll ${name} ${lang(von)} – ${lang(heute)}</title>
<style>
  body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#222;margin:20px;font-size:14px;line-height:1.35;}
  h1{font-size:22px;margin:0 0 2px;} h2{font-size:16px;margin:24px 0 8px;} h3{font-size:14px;margin:14px 0 4px;}
  .sub{color:#666;font-size:13px;} i{color:#888;font-style:normal;font-size:12px;} small{color:#777;}
  .kacheln{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:16px;}
  .k{background:#f3f1ec;border-radius:10px;padding:10px 12px;} .k b{display:block;font-size:20px;} .k span{color:#555;font-size:12px;}
  table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
  th,td{border-bottom:1px solid #e3e0d8;padding:6px 8px;text-align:left;vertical-align:top;} th{font-size:12px;color:#666;font-weight:600;}
  td.tag{font-weight:600;white-space:nowrap;}
  .tage{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;} .tagbox{break-inside:avoid;}
  .e td{padding:3px 6px;font-size:13px;} .e td.z{white-space:nowrap;color:#555;width:92px;}
  .hinweis{color:#777;font-size:12px;margin-top:20px;}
  .knopf{position:fixed;top:16px;right:16px;padding:10px 16px;border:0;border-radius:10px;background:#3C5343;color:#fff;font-size:14px;font-weight:600;cursor:pointer;}
  @media print{.knopf{display:none;} body{margin:12mm;font-size:12px;} @page{size:A4;margin:0;} .k{border:1px solid #ddd;background:none;}}
  @media (max-width:560px){
    body{margin:14px;} .tage{grid-template-columns:1fr;}
    table.t thead{display:none;}
    table.t tr{display:grid;grid-template-columns:1fr 1fr;column-gap:18px;border-bottom:1px solid #e3e0d8;padding:8px 0;}
    table.t td{display:flex;justify-content:space-between;gap:8px;border:0;padding:2px;}
    table.t td.tag{grid-column:1 / -1;display:block;padding-bottom:4px;}
    table.t td[data-l]::before{content:attr(data-l);color:#666;}
    table.t td[data-l="Zeiten"]{grid-column:1 / -1;display:block;} table.t td[data-l="Zeiten"]::before{display:block;font-size:12px;}
  }
</style></head><body>
${knopf ? `<button class="knopf" onclick="window.print()">Drucken / als PDF</button>` : ""}
<h1>Stillprotokoll ${name}</h1>
<div class="sub">${lang(von)} bis ${lang(heute)} · erstellt am ${lang(heute)} um ${this._hm(heute)}</div>
${tage.length ? `<div class="kacheln">${kacheln}</div>
<h2>Mahlzeiten</h2>${essenTab}${windelTab}${gew}
<h2>Einträge</h2><div class="tage">${eintraege}</div>` : `<p>In den letzten 7 Tagen ist nichts eingetragen.</p>${gew}`}
<p class="hinweis">Durchschnitte über die vollständigen Tage (heute läuft noch). Fläschchen werden nach dem Trinken eingetragen; ihr Beginn ist ${Number(this.config.bottle_minutes) || 0} Minuten früher geschätzt. Eine Mahlzeit umfasst alle Einträge, zwischen denen höchstens ${this._zahl(this.config.meal_pause_entity, this.config.meal_pause_minutes)} Minuten Pause liegen (vom Ende des einen bis zum Beginn des nächsten), auch wenn die Fütterung über eine Stunde dauert. Abstände von Beginn zu Beginn; Pausen über 8 Stunden zählen nicht zum Durchschnitt.</p>
</body></html>`;
  }

  // ---------- Schreiben ----------
  _eventData(typ, seite, ml, art) {
    if (typ === "flasche") return { summary: `Fläschchen ${ml} ml`, description: JSON.stringify({ typ: "flasche", ml }) };
    // Wer einen Eintrag von Hand korrigiert, macht ihn genau — die Markierung
    // „automatisch beendet" fällt dann weg.
    return { summary: `Stillen ${seite}`, description: JSON.stringify({ typ: "stillen", seite, auto: false }) };
  }
  async _create(typ, start, end, seite, ml, art) {
    const d = this._eventData(typ, seite, ml, art);
    try {
      await this._hass.callService("calendar", "create_event", {
        entity_id: this.config.calendar, summary: d.summary, description: d.description,
        start_date_time: U.haZeit(start), end_date_time: U.haZeit(end),
      });
      return true;
    } catch (e) { U.toast(this, "Eintrag konnte nicht gespeichert werden"); return false; }
  }
  async _delete(uid, leise, cal) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: cal || this.config.calendar, uid }); return true; }
    catch (e) { if (!leise) U.toast(this, "Eintrag konnte nicht gelöscht werden"); return false; }
  }
  async _update(ev, typ, start, end, seite, ml, art) {
    const d = this._eventData(typ, seite, ml, art);
    const msg = { type: "calendar/event/update", entity_id: ev.cal || this.config.calendar, uid: ev.uid,
      event: { summary: d.summary, description: d.description, dtstart: U.haZeit(start), dtend: U.haZeit(end) } };
    try { await this._hass.callWS(msg); return true; }
    catch (e) {
      // Rückfall: neu anlegen, dann alt löschen. Bleibt der alte stehen, sagen
      // wir es laut statt still ein Duplikat zu hinterlassen.
      if (!(await this._create(typ, start, end, seite, ml, art))) return false;
      if (!(await this._delete(ev.uid, true, ev.cal))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  // ---------- Dialoge ----------
  _overlay(html) {
    this._closeOv();
    const ov = document.createElement("div");
    ov.className = "ff-ov";
    ov.innerHTML = `<div class="ff-modal">${html}</div>`;
    ov.addEventListener("click", e => { if (e.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov;
    return ov;
  }
  _closeOv() { if (this._ov) { this._ov.remove(); this._ov = null; } }

  _mlField(start) {
    const presets = (this.config.bottle_presets || []).map(v => `<button class="ff-chip" data-ml="${Number(v)}">${Number(v)} ml</button>`).join("");
    return `<div class="ff-lbl">Menge</div>
      <div class="ff-chips">${presets}</div>
      <div class="ff-mlrow">
        <button class="ff-step" data-d="-10">−</button>
        <input class="ff-in ff-ml-in" type="number" inputmode="numeric" min="0" max="400" step="5" value="${Number(start) || ""}" placeholder="ml">
        <button class="ff-step" data-d="10">＋</button>
      </div>`;
  }
  _wireMl(ov) {
    const inp = ov.querySelector(".ff-ml-in");
    const mark = () => ov.querySelectorAll(".ff-chip").forEach(c => c.classList.toggle("ff-on", Number(c.dataset.ml) === Number(inp.value)));
    ov.querySelectorAll(".ff-chip").forEach(c => c.addEventListener("click", () => { inp.value = c.dataset.ml; mark(); }));
    ov.querySelectorAll(".ff-step").forEach(b => b.addEventListener("click", () => {
      inp.value = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.d)); mark();
    }));
    inp.addEventListener("input", mark);
    mark();
    return () => Math.round(Number(inp.value) || 0);
  }
  // Uhrzeit auf das Datum eines Bezugstags setzen. o.tage verschiebt um ganze Kalendertage (1 = Folgetag),
  // o.ref und o.wie entscheiden in der doppelten Stunde beim Ende der Sommerzeit, welche der beiden Zeiten gemeint ist
  // (siehe U.ortZeit): beim Bearbeiten ref = ursprünglicher Zeitpunkt mit wie, beim Ende eines neuen Eintrags ref = Beginn.
  _at(basis, hhmm, o) {
    o = o || {};
    const [h, m] = String(hhmm || "").split(":").map(Number);
    return U.ortZeit(basis.getFullYear(), basis.getMonth(), basis.getDate() + (o.tage || 0), h || 0, m || 0, o.ref, 0, o.wie);
  }

  _openBottle() {
    const jetzt = new Date();
    const ov = this._overlay(`
      <div class="ff-mhead">🍼 Fläschchen${this.config.name ? ` für ${U.esc(this.config.name)}` : ""}</div>
      ${this._mlField((this.config.bottle_presets || [])[0] || "")}
      <div class="ff-lbl">Fertig um</div>
      <input class="ff-in ff-zeit" type="time" value="${this._hm(jetzt)}">
      <div class="ff-foot"><button class="ff-btn ff-cancel">Abbrechen</button><button class="ff-btn ff-ok">Eintragen</button></div>`);
    const ml = this._wireMl(ov);
    ov.querySelector(".ff-cancel").addEventListener("click", () => this._closeOv());
    ov.querySelector(".ff-ok").addEventListener("click", async () => {
      const menge = ml();
      if (!menge) { U.toast(this, "Bitte eine Menge angeben"); return; }
      const zeit = ov.querySelector(".ff-zeit").value;
      let start = this._at(jetzt, zeit);
      // Eine Uhrzeit nach „jetzt" meint gestern Abend — nachts trägt man nach.
      if (start - jetzt > 5 * 60000) start = this._at(jetzt, zeit, { tage: -1 });
      const end = new Date(start.getTime() + 60000);
      this._closeOv();
      if (await this._create("flasche", start, end, "", menge)) this._load();
    });
  }

  // Vergessen zu starten: Stillen mit Beginn/Ende von Hand eintragen.
  _openNachtrag() {
    const jetzt = new Date();
    const evs = (this._events || []).filter(x => x.typ === "stillen");
    const letzteEnde = evs.length ? Math.max(...evs.map(x => +x.end)) : 0;
    let tag = "heute", seite = this._seite() || "links";
    const vorschlagBis = this._hm(jetzt), vorschlagVon = this._hm(new Date(jetzt.getTime() - 15 * 60000));
    const ov = this._overlay(`
      <div class="ff-mhead">Stillen nachtragen${this.config.name ? ` für ${U.esc(this.config.name)}` : ""}</div>
      <div class="ff-lbl">Tag</div>
      <div class="ff-seg ff-seg-edit ff-seg-tag"><button data-t="heute">Heute</button><button data-t="gestern">Gestern</button></div>
      <div class="ff-zeiten">
        <label><span class="ff-lbl">Beginn</span><input class="ff-in ff-von" type="time" value="${vorschlagVon}"></label>
        <label><span class="ff-lbl">Ende</span><input class="ff-in ff-bis" type="time" value="${vorschlagBis}"></label>
      </div>
      <div class="ff-lbl">Seite</div>
      <div class="ff-seg ff-seg-edit ff-seg-seite"><button data-s="links">Links</button><button data-s="rechts">Rechts</button></div>
      <div class="ff-foot"><span class="ff-flex"></span><button class="ff-btn ff-cancel">Abbrechen</button><button class="ff-btn ff-ok">Eintragen</button></div>`);
    const mark = () => {
      ov.querySelectorAll(".ff-seg-tag button").forEach(b => b.classList.toggle("ff-on", b.dataset.t === tag));
      ov.querySelectorAll(".ff-seg-seite button").forEach(b => b.classList.toggle("ff-on", b.dataset.s === seite));
    };
    ov.querySelectorAll(".ff-seg-tag button").forEach(b => b.addEventListener("click", () => { tag = b.dataset.t; mark(); }));
    ov.querySelectorAll(".ff-seg-seite button").forEach(b => b.addEventListener("click", () => { seite = b.dataset.s; mark(); }));
    mark();
    ov.querySelector(".ff-cancel").addEventListener("click", () => this._closeOv());
    ov.querySelector(".ff-ok").addEventListener("click", async () => {
      const basis = new Date(jetzt); if (tag === "gestern") basis.setDate(basis.getDate() - 1);
      const bis = ov.querySelector(".ff-bis").value;
      const start = this._at(basis, ov.querySelector(".ff-von").value);
      let end = this._at(basis, bis, { ref: start });   // ref = Beginn: das Ende liegt nach dem Beginn, auch über die Zeitumstellung
      // Über Mitternacht: ein Ende vor dem Beginn liegt am Folgetag.
      if (end <= start) end = this._at(basis, bis, { ref: start, tage: 1 });
      if (start - jetzt > 5 * 60000) { U.toast(this, "Der Beginn liegt in der Zukunft – Tag prüfen"); return; }
      if (end - start > 3 * 3600000) { U.toast(this, "Länger als 3 Stunden – Zeiten prüfen"); return; }
      if (end - jetzt > 5 * 60000) end.setTime(Math.max(start.getTime() + 60000, jetzt.getTime()));
      this._closeOv();
      if (!(await this._create("stillen", start, end, seite, 0))) return;
      // Ist das die jüngste Mahlzeit, gilt für das nächste Mal die andere Seite.
      if (this.config.side && +end >= letzteEnde)
        this._hass.callService("input_select", "select_option", { entity_id: this.config.side, option: seite === "links" ? "rechts" : "links" });
      this._load();
    });
  }

  _openEdit(e) {
    const flasche = e.typ === "flasche";
    const ov = this._overlay(`
      <div class="ff-mhead">${flasche ? "🍼 Fläschchen" : "Stillen"} bearbeiten</div>
      ${flasche ? `
        ${this._mlField(e.ml)}
        <div class="ff-lbl">Fertig um</div>
        <input class="ff-in ff-zeit" type="time" value="${this._hm(e.start)}">`
      : `
        <div class="ff-zeiten">
          <label><span class="ff-lbl">Beginn</span><input class="ff-in ff-von" type="time" value="${this._hm(e.start)}"></label>
          <label><span class="ff-lbl">Ende</span><input class="ff-in ff-bis" type="time" value="${this._hm(e.end)}"></label>
        </div>
        <div class="ff-lbl">Seite</div>
        <div class="ff-seg ff-seg-edit"><button data-s="links">Links</button><button data-s="rechts">Rechts</button></div>`}
      <div class="ff-foot">
        <button class="ff-btn ff-del">Löschen</button>
        <span class="ff-flex"></span>
        <button class="ff-btn ff-cancel">Abbrechen</button><button class="ff-btn ff-ok">Speichern</button>
      </div>`);
    let seite = e.seite || "links";
    const mark = () => ov.querySelectorAll(".ff-seg-edit button").forEach(b => b.classList.toggle("ff-on", b.dataset.s === seite));
    ov.querySelectorAll(".ff-seg-edit button").forEach(b => b.addEventListener("click", () => { seite = b.dataset.s; mark(); }));
    mark();
    const ml = flasche ? this._wireMl(ov) : null;
    ov.querySelector(".ff-cancel").addEventListener("click", () => this._closeOv());
    ov.querySelector(".ff-del").addEventListener("click", async () => {
      if (!window.confirm("Diesen Eintrag löschen?")) return;
      this._closeOv();
      if (await this._delete(e.uid, false, e.cal)) this._load();
    });
    ov.querySelector(".ff-ok").addEventListener("click", async () => {
      let start, end;
      if (flasche) {
        if (!ml()) { U.toast(this, "Bitte eine Menge angeben"); return; }
        start = this._at(e.start, ov.querySelector(".ff-zeit").value, { ref: e.start, wie: true });
        end = new Date(start.getTime() + 60000);
      } else {
        // ref = ursprünglicher Beginn/Ende: ein unverändert gespeicherter Eintrag bleibt exakt gleich, auch in der doppelten Stunde.
        const bis = ov.querySelector(".ff-bis").value;
        start = this._at(e.start, ov.querySelector(".ff-von").value, { ref: e.start, wie: true });
        end = this._at(e.start, bis, { ref: e.end, wie: true });
        // Über Mitternacht: ein Ende vor dem Beginn liegt am Folgetag.
        if (end <= start) end = this._at(e.start, bis, { ref: e.end, wie: true, tage: 1 });
      }
      this._closeOv();
      if (await this._update(e, e.typ, start, end, seite, flasche ? ml() : 0)) this._load();
    });
  }

  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .ff-card,.ff-ov{--ff-a:var(--ff-akzent,var(--fp-head,var(--primary-color)));--ff-at:var(--ff-a);--ff-on:var(--ff-akzent-fg,var(--fp-accent-fg,#fff));
        --ff-s:var(--fp-surface,var(--secondary-background-color));--ff-s2:var(--fp-surface-2,var(--divider-color));
        --ff-alert:var(--fp-alert,var(--warning-color,#b97f06));--ff-alert-bg:var(--fp-alert-bg,rgba(217,154,11,.18));
        --ff-r:var(--fp-radius,16px);--ff-rs:var(--fp-radius-sm,12px);}
      /* ff-dark (am Host, folgt hass.themes.darkMode): Kinderfarbe als Schrift und dünne Linie mit der Textfarbe aufgehellt, sonst unlesbar auf dunklem Grund.
         --ff-a (Punkt, Knopffläche) bleibt die reine Kinderfarbe. */
      .ff-dark .ff-card,.ff-dark .ff-ov{--ff-at:color-mix(in srgb,var(--ff-a) 55%,var(--primary-text-color));}
      .ff-card{padding:16px 16px 12px;container-type:inline-size;}
      .ff-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}
      .ff-name{display:flex;align-items:center;gap:9px;font-size:1.25rem;font-weight:700;letter-spacing:-.01em;}
      .ff-dot{width:12px;height:12px;border-radius:50%;background:var(--ff-a);flex:none;}
      .ff-seite{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
      .ff-seite-lbl{font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color);opacity:.75;}
      .ff-seg{display:inline-flex;background:var(--ff-s);border-radius:var(--ff-rs);padding:3px;gap:2px;}
      .ff-seg button{border:none;background:transparent;color:var(--secondary-text-color);font-size:.85rem;font-weight:600;
        padding:7px 13px;border-radius:calc(var(--ff-rs) - 3px);cursor:pointer;min-width:62px;}
      .ff-seg button.ff-on{background:var(--ff-s2);color:var(--ff-at);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.12);}

      .ff-actions{display:flex;gap:10px;}
      .ff-main{flex:1 1 auto;min-height:56px;border:none;border-radius:var(--ff-rs);cursor:pointer;font-size:1.05rem;font-weight:700;
        display:flex;align-items:center;justify-content:center;gap:12px;padding:0 16px;
        background:rgba(var(--fp-accent-rgb,79,195,247),.14);color:var(--ff-at);transition:background .2s,color .2s;}
      .ff-main.ff-run{background:var(--ff-a);color:var(--ff-on);}
      .ff-main-uhr{font-variant-numeric:tabular-nums;font-size:1.25rem;font-weight:700;letter-spacing:-.01em;}
      .ff-nach{padding:0 12px !important;font-size:.88rem !important;}
      .ff-bottle{flex:0 0 auto;min-height:56px;border:none;border-radius:var(--ff-rs);cursor:pointer;
        background:var(--ff-s);color:var(--primary-text-color);font-size:.95rem;font-weight:600;padding:0 16px;}
      .ff-since{margin:12px 2px 4px;}
      .ff-since-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
      .ff-since-big{font-size:1.6rem;font-weight:700;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--primary-text-color);}
      .ff-since-txt{font-size:.82rem;color:var(--secondary-text-color);}
      .ff-bar{height:6px;border-radius:3px;background:var(--ff-s2);margin-top:7px;overflow:hidden;}
      .ff-bar-fill{height:100%;width:0;border-radius:3px;background:var(--ff-at);transition:width .4s,background .3s;}
      .ff-since.ff-bald .ff-bar-fill{background:var(--ff-alert);}
      .ff-since.ff-faellig .ff-bar-fill{background:var(--ff-alert);}
      .ff-since.ff-faellig .ff-since-big{color:var(--ff-alert);}

      .ff-day{margin-top:14px;}
      .ff-dayhead{font-size:.7rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--secondary-text-color);
        opacity:.8;margin:0 2px 6px;}
      .ff-tab{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums;}
      .ff-tab th{font-size:.7rem;font-weight:600;color:var(--secondary-text-color);text-align:left;padding:4px 6px;
        border-bottom:1px solid var(--divider-color);}
      .ff-tab td{padding:9px 6px;border-bottom:1px solid var(--divider-color);white-space:nowrap;}
      .ff-tab tfoot td{white-space:normal;}
      /* Schmale Karte (Handy): Start/Stopp über die ganze Breite, darunter Fläschchen und Nachtragen. */
      @container (max-width: 440px){ .ff-actions{flex-wrap:wrap;} .ff-main{flex:1 1 100%;} .ff-bottle{flex:1 1 0;padding:0 10px;} .ff-tab th,.ff-tab td{padding-left:4px;padding-right:4px;} }
      .ff-tab tbody tr[data-uid]{cursor:pointer;}
      .ff-tab tbody tr[data-uid]:active{background:var(--ff-s);}
      .ff-tab th:last-child,.ff-tab td:last-child{text-align:right;}
      .ff-leer{color:var(--secondary-text-color);opacity:.5;}
      .ff-ml{font-weight:600;}
      .ff-r-flasche td:first-child{color:var(--ff-at);font-weight:600;}
      .ff-auto{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;font-size:.62rem;font-weight:700;
        letter-spacing:.04em;text-transform:uppercase;background:var(--ff-alert-bg);color:color-mix(in srgb,var(--ff-alert) 75%,var(--primary-text-color));vertical-align:1px;}
      .ff-nichts td{color:var(--secondary-text-color);opacity:.7;font-size:.82rem;text-align:left !important;}
      .ff-foot2{display:flex;justify-content:space-between;align-items:center;margin-top:14px;}
      .ff-txtbtn{border:none;background:transparent;cursor:pointer;padding:6px 2px;
        font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);}
      .ff-week{margin-top:4px;}
      .ff-wk{table-layout:fixed;}
      .ff-wk td{padding:8px 10px;}
      .ff-wk th{padding:4px 10px 6px;}
      .ff-wk th:first-child,.ff-wk td:first-child{padding-left:4px;}
      .ff-wk th:last-child,.ff-wk td:last-child{padding-right:4px;}
      .ff-wk-c1{width:14%;} .ff-wk-c2{width:38%;}
      .ff-wk th:nth-child(n+3),.ff-wk td:nth-child(n+3){text-align:right;}
      .ff-wk td:nth-child(2){padding-right:22px;}
      .ff-wk-n{display:flex;align-items:center;gap:10px;}
      .ff-wk-n b{flex:0 0 2ch;text-align:right;}
      .ff-wk-track{flex:1;height:8px;border-radius:4px;background:var(--ff-s2);overflow:hidden;}
      .ff-wk-bar{display:block;height:100%;border-radius:4px;background:var(--ff-at);}
      @container (max-width: 440px){ .ff-wk{table-layout:auto;} .ff-wk th,.ff-wk td{padding-left:4px;padding-right:4px;} .ff-wk td:nth-child(2){padding-right:4px;} .ff-wk-track{display:none;} .ff-wk-n b{flex:none;} .ff-wk th{white-space:nowrap;font-size:.66rem;} }
      .ff-tab tfoot td{border-bottom:none;font-weight:700;font-size:.82rem;color:var(--secondary-text-color);padding-top:8px;}

      .ff-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;}
      .ff-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--ff-r);padding:18px;
        width:100%;max-width:380px;box-shadow:0 12px 40px rgba(0,0,0,.25);}
      .ff-mhead{font-size:1.1rem;font-weight:700;margin-bottom:12px;}
      .ff-lbl{display:block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
        color:var(--secondary-text-color);margin:12px 0 6px;}
      .ff-chips{display:flex;gap:6px;flex-wrap:wrap;}
      .ff-chip{flex:1;min-width:64px;border:1px solid var(--divider-color);border-radius:var(--ff-rs);padding:10px 6px;
        background:var(--ff-s);color:var(--primary-text-color);font-weight:600;cursor:pointer;}
      .ff-chip.ff-on{background:var(--ff-a);color:var(--ff-on);border-color:transparent;}
      .ff-mlrow{display:flex;gap:8px;margin-top:8px;}
      .ff-step{width:48px;border:1px solid var(--divider-color);border-radius:var(--ff-rs);background:var(--ff-s);
        color:var(--primary-text-color);font-size:1.2rem;cursor:pointer;}
      .ff-in{flex:1;width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--divider-color);border-radius:var(--ff-rs);
        background:var(--ff-s);color:var(--primary-text-color);font-size:1rem;}
      .ff-in[type=date],.ff-in[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;color-scheme:light;} .ff-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
      .ff-dark .ff-in[type=date],.ff-dark .ff-in[type=time]{color-scheme:dark;}
      .ff-zeiten{display:flex;gap:10px;} .ff-zeiten label{flex:1;}
      .ff-seg-edit{display:flex;} .ff-seg-edit button{flex:1;}
      .ff-foot{display:flex;gap:8px;margin-top:18px;align-items:center;}
      .ff-flex{flex:1;}
      .ff-btn{border:none;border-radius:var(--ff-rs);padding:11px 16px;font-weight:600;cursor:pointer;
        background:var(--ff-s);color:var(--primary-text-color);}
      .ff-ok{background:var(--ff-a);color:var(--ff-on);}
      .ff-del{background:transparent;color:var(--error-color,#c0392b);padding-left:4px;padding-right:4px;}
      .ff-rep-ov{padding:12px;}
      .ff-rep-box{background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--ff-r);
        width:min(900px,100%);height:min(92vh,1100px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);}
      .ff-rep-bar{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--divider-color);}
      .ff-rep-frame{flex:1;width:100%;border:0;background:#fff;}   /* der Bericht ist zum Drucken gedacht und bleibt hell */
      @media (max-width:600px){.ff-rep-ov{padding:0;} .ff-rep-box{border-radius:0;height:100%;width:100%;}
        .ff-rep-bar{padding-top:max(10px, env(safe-area-inset-top));}}   /* iPhone: nicht unter die Statusleiste */
    </style>`;
  }
  getCardSize() { return 9; }
}
if (!customElements.get("fp-feeding-card")) {
  customElements.define("fp-feeding-card", FpFeedingCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-feeding-card", name: "FP Feeding Card", description: "Stillprotokoll je Kind: Start/Stopp, Seite, Fläschchen in ml, Heute/Gestern mit Summen, Rückblick über 7 Tage, Bericht" });
}
})();

/* ===== fp-weight-card v9 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Wiegezeit: die Uhrzeit der Eingabe wird als Wiegezeit mitgespeichert und beim Korrigieren behalten; davor: Farben und Radien aus dem Theme, Kinderfarbe im Dunkeln lesbar; Datumsfeld passt aufs iPhone, Kopfzeile bricht nur ganze Werte um; Perzentilkurven aus lokaler Datei growth_data: Fruehgeborene nach Alter ab Beginn der Schwangerschaft, danach WHO nach korrigiertem Alter, Perzentile des letzten Werts; Eintragen-Knopf mit Theme-Textfarbe; neutrale Vorgabe-Kinder; Gewicht mit drei Nachkommastellen; Gewichtsverlauf mehrerer Kinder auf einer Zeitachse, Eintragen per Dialog: Kind, Datum, Gewicht; Punkt antippen zum Bearbeiten/Loeschen) ===== */
// Ein Eintrag = ein Ganztagstermin im Kalender: Titel "Kind A 3450 g",
// Beschreibung {"typ":"gewicht","kind":"kind_a","g":3450}. Pro Kind und Tag gibt
// es höchstens einen Wert — wer denselben Tag nochmal einträgt, korrigiert ihn.
(() => {
const U = window.__fpUtils;
class FpWeightCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.calendar) throw new Error("fp-weight-card braucht calendar");
    this.config = Object.assign({
      title: "Gewicht",
      kids: [{ key: "kind_a", name: "Kind A", color: "#4A7A3A" }, { key: "kind_b", name: "Kind B", color: "#7A4A78" }],
      height: 230,
      growth_data: "",   // optional: URL einer JSON-Datei mit Referenzkurven (nicht Teil dieses Repos), dazu je Kind birth, ga, sex
    }, config);
    this._built = false; this._data = null; this._sig = ""; this._ref = null;
    if (this.config.growth_data) this._loadRef();
  }

  // Referenzkurven einmal pro Seite laden; mehrere Karten teilen sich das Ergebnis.
  async _loadRef() {
    const url = this.config.growth_data, cache = (window.__fpGrowth = window.__fpGrowth || {});
    try {
      cache[url] = cache[url] || fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      this._ref = await cache[url];
    } catch (e) {
      delete cache[url];
      U.toast(this, "Perzentilkurven konnten nicht geladen werden");
      this._ref = null;
    }
    this._paint(true);
  }
  set hass(hass) {
    this._hass = hass;
    this.classList.toggle("fw-dark", !!(hass && hass.themes && hass.themes.darkMode));   // hell oder dunkel entscheidet das Gerät
    if (!this._built) { this._build(); this._load(); }
  }
  connectedCallback() {
    if (!this._timer) this._timer = setInterval(() => this._load(), 5 * 60000);
    if (!this._ro && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => { const w = this._chartW(); if (w && w !== this._lastW) this._paint(true); });
      this._ro.observe(this);
    }
  }
  disconnectedCallback() {
    clearInterval(this._timer); this._timer = null;
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }

  // ---------- Hilfen ----------
  _p(n) { return String(n).padStart(2, "0"); }
  _iso(d) { return `${d.getFullYear()}-${this._p(d.getMonth() + 1)}-${this._p(d.getDate())}`; }
  _dm(d) { return `${d.getDate()}.${d.getMonth() + 1}.`; }
  _dmy(d) { return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`; }
  _day(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
  _kg(g) { return (g / 1000).toLocaleString("de-AT", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " kg"; }
  _kid(key) { return this.config.kids.find(k => k.key === key) || { key, name: key, color: "var(--primary-color)" }; }
  _chartW() { const el = this.querySelector(".fw-chart"); return el ? Math.round(el.clientWidth) : 0; }
  // Eingabe in Gramm oder Kilo: "3450", "3,45", "3.45 kg" → 3450
  _gramm(v) {
    const s = String(v || "").trim().toLowerCase().replace(/\s*(kg|g)$/, "").replace(",", ".");
    const n = Number(s);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n < 30 ? n * 1000 : n);
  }

  // ---------- Perzentilen ----------
  // Alter in Tagen ab Beginn der Schwangerschaft (Gestationsalter + Lebenstage).
  _pmaTage(kid, t) {
    const [w, d] = String(kid.ga || "40+0").split("+").map(Number);
    return (w || 40) * 7 + (d || 0) + (t - this._day(kid.birth)) / 86400000;
  }
  // Perzentilen 3/10/50/90/97 in Gramm. Frühgeborene: INTERGROWTH-21st-Tabelle nach
  // Wochen ab Beginn der Schwangerschaft (27–64). Danach WHO mit L/M/S nach
  // korrigiertem Alter (ab dem errechneten Termin, 40+0).
  _refAt(sex, pma) {
    const ref = this._ref; if (!ref || !ref.who) return null;
    const lerp = (rows, v, i) => {
      if (v < rows[0][0] || v > rows[rows.length - 1][0]) return null;
      let k = rows.findIndex(r => r[0] >= v); if (k <= 0) return rows[Math.max(0, k)][i];
      const a = rows[k - 1], b = rows[k], f = (v - a[0]) / (b[0] - a[0]);
      return a[i] + f * (b[i] - a[i]);
    };
    const pre = ref.preterm && ref.preterm[sex], wPma = pma / 7;
    if (pre && pre.length && wPma >= pre[0][0] && wPma <= pre[pre.length - 1][0])
      return [1, 2, 3, 4, 5].map(i => lerp(pre, wPma, i) * 1000);
    const who = ref.who[sex], alter = pma - 280;
    if (!who || alter < 0) return null;
    const rows = alter <= 91 ? who.w : who.mo, v = alter <= 91 ? alter / 7 : alter / 30.4375;
    const L = lerp(rows, v, 1), M = lerp(rows, v, 2), S = lerp(rows, v, 3);
    if (L == null) return null;
    return [-1.8808, -1.2816, 0, 1.2816, 1.8808].map(z => M * Math.pow(1 + L * S * z, 1 / L) * 1000);
  }
  _kidHasRef(kid) { return !!(this._ref && kid.birth && kid.sex); }
  // Ungefähre Perzentile eines Werts: zwischen den fünf Linien linear verteilt.
  _perzentil(kid, p) {
    if (!this._kidHasRef(kid)) return "";
    const c = this._refAt(kid.sex, this._pmaTage(kid, +p.date)); if (!c) return "";
    const P = [3, 10, 50, 90, 97];
    if (p.g < c[0]) return "unter P3";
    if (p.g > c[4]) return "über P97";
    for (let i = 1; i < 5; i++) if (p.g <= c[i]) return `≈ P${Math.round(P[i - 1] + (p.g - c[i - 1]) / (c[i] - c[i - 1]) * (P[i] - P[i - 1]))}`;
    return "";
  }

  _parse(ev) {
    let meta = {};
    try { meta = JSON.parse(ev.description || "{}") || {}; } catch (x) { meta = {}; }
    const sum = String(ev.summary || "");
    const kidByName = this.config.kids.find(k => sum.toLowerCase().startsWith(k.name.toLowerCase()));
    const kind = meta.kind || (kidByName ? kidByName.key : "");
    let g = Number(meta.g) || 0;
    if (!g) { const m = sum.match(/([\d.,]+)\s*(kg|g)/i); if (m) g = this._gramm(m[1] + m[2]); }
    const start = (ev.start && (ev.start.date || ev.start.dateTime)) || ev.start;
    const zeit = /^\d{2}:\d{2}$/.test(String(meta.zeit || "")) ? meta.zeit : "";   // Wiegezeit = Eingabezeit (ab v3.1.5)
    return { uid: ev.uid, kind, g, zeit, date: this._day(start) };
  }

  async _load() {
    if (!this._hass) return;
    const bis = new Date(); bis.setDate(bis.getDate() + 2);
    try {
      const s = encodeURIComponent(new Date(2020, 0, 1).toISOString()), e = encodeURIComponent(bis.toISOString());
      const evts = await this._hass.callApi("GET", `calendars/${this.config.calendar}?start=${s}&end=${e}`);
      this._data = (Array.isArray(evts) ? evts : []).map(x => this._parse(x)).filter(x => x.kind && x.g > 0 && !isNaN(x.date));
    } catch (err) {
      if (this._loadedOnce) U.toast(this, "Gewichte konnten nicht geladen werden");
      this._data = this._data || [];
    }
    this._loadedOnce = true;
    this._paint();
  }

  // ---------- Aufbau ----------
  _build() {
    this._built = true;
    this.innerHTML = `
      <ha-card class="fw-card">
        <div class="fw-head">
          <div class="fw-title">${U.esc(this.config.title)}</div>
          <button class="fw-add">＋ Eintragen</button>
        </div>
        <div class="fw-sum"></div>
        <div class="fw-chart"></div>
      </ha-card>${this._styles()}`;
    this.querySelector(".fw-add").addEventListener("click", () => this._openDialog(null));
    this.querySelector(".fw-chart").addEventListener("click", ev => {
      const hit = ev.target.closest("[data-uid]");
      if (!hit) return;
      const e = (this._data || []).find(x => x.uid === hit.getAttribute("data-uid"));
      if (e) this._openDialog(e);
    });
  }

  _paint(force) {
    if (!this._built || !this._data) return;
    const sig = JSON.stringify(this._data.map(e => [e.uid, e.kind, e.g, +e.date]));
    if (!force && sig === this._sig && this._lastW === this._chartW()) return;
    this._sig = sig;
    this._paintSummary();
    this._paintChart();
  }

  _reihen() {
    return this.config.kids.map(k => ({ kid: k, pts: this._data.filter(e => e.kind === k.key).sort((a, b) => a.date - b.date) }));
  }

  _paintSummary() {
    const el = this.querySelector(".fw-sum");
    el.innerHTML = this._reihen().map(({ kid, pts }) => {
      if (!pts.length) return `<div class="fw-chip"><span class="fw-dot" style="background:${U.esc(kid.color)}"></span>${U.esc(kid.name)} <span class="fw-muted">noch kein Wert</span></div>`;
      const last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2] : null;
      let delta = "";
      if (prev) {
        const d = last.g - prev.g, tage = Math.max(1, Math.round((last.date - prev.date) / 86400000));
        delta = `<span class="fw-delta ${d >= 0 ? "fw-up" : "fw-down"}">${d >= 0 ? "+" : "−"}${Math.abs(d)} g</span><span class="fw-muted"> in ${tage} ${tage === 1 ? "Tag" : "Tagen"}</span>`;   // bleibt als Ganzes zusammen
      }
      const pz = this._perzentil(kid, last);
      return `<div class="fw-chip"><span class="fw-dot" style="background:${U.esc(kid.color)}"></span><b>${U.esc(kid.name)}</b><span>${this._kg(last.g)}</span><span class="fw-muted">(${this._dm(last.date)}${last.zeit ? `, ${last.zeit}` : ""})</span><span>${delta}</span>${pz ? `<span class="fw-pz">${pz}</span>` : ""}</div>`;
    }).join("");
  }

  _paintChart() {
    const box = this.querySelector(".fw-chart");
    const W = this._chartW() || 600, H = Number(this.config.height) || 230;
    this._lastW = W;
    const reihen = this._reihen(), alle = reihen.flatMap(r => r.pts);
    if (!alle.length) {
      box.innerHTML = `<div class="fw-empty">Noch kein Gewicht eingetragen.<br>Tipp auf „＋ Eintragen“ — zum Beispiel das Geburtsgewicht.</div>`;
      return;
    }
    const L = 52, R = 14, T = 12, B = 28;
    // Zeitachse: erster Eintrag bis heute; ein einzelner Tag bekommt Luft links und rechts.
    let t0 = Math.min(...alle.map(e => +e.date)), t1 = Math.max(Date.now(), ...alle.map(e => +e.date));
    if (t1 - t0 < 4 * 86400000) { const mid = (t0 + t1) / 2; t0 = mid - 3 * 86400000; t1 = mid + 3 * 86400000; }
    // Referenzkurven: eine Schar je Geschlecht/Geburt/Gestationsalter — Zwillinge teilen sich eine.
    const scharen = [];
    this.config.kids.filter(k => this._kidHasRef(k)).forEach(k => {
      const sig = `${k.sex}|${k.birth}|${k.ga}`, s = scharen.find(x => x.sig === sig);
      if (s) s.kids.push(k); else scharen.push({ sig, kids: [k] });
    });
    const proben = Math.max(2, Math.min(240, Math.round((t1 - t0) / 86400000) * 2));
    scharen.forEach(s => {
      s.pts = [];
      for (let i = 0; i <= proben; i++) {
        const t = t0 + (t1 - t0) * i / proben, c = this._refAt(s.kids[0].sex, this._pmaTage(s.kids[0], t));
        if (c) s.pts.push({ t, c });
      }
    });
    // Gewichtsachse auf „runde" Schritte, damit die Beschriftung lesbar bleibt.
    const refG = scharen.flatMap(s => s.pts.flatMap(p => [p.c[0], p.c[4]]));
    let g0 = Math.min(...alle.map(e => e.g), ...refG), g1 = Math.max(...alle.map(e => e.g), ...refG);
    const span = Math.max(g1 - g0, 200);
    const step = [50, 100, 200, 250, 500, 1000, 2000].find(s => span / s <= 5) || 2000;
    g0 = Math.floor((g0 - span * 0.08) / step) * step; g1 = Math.ceil((g1 + span * 0.08) / step) * step;
    const x = t => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y = g => T + (1 - (g - g0) / (g1 - g0)) * (H - T - B);

    let grid = "";
    for (let g = g0; g <= g1 + 0.5; g += step) {
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="fw-grid"/>` +
        `<text x="${L - 6}" y="${y(g) + 4}" class="fw-ylab">${(g / 1000).toLocaleString("de-AT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</text>`;
    }
    // Datumsmarken: etwa alle 90 px eine, auf ganze Tage gerundet.
    const n = Math.max(2, Math.floor((W - L - R) / 90)), tage = (t1 - t0) / 86400000;
    const dStep = Math.max(1, Math.ceil(tage / n));
    let xl = "";
    const start = new Date(t0); start.setHours(12, 0, 0, 0);
    for (let d = new Date(start); +d <= t1; d.setDate(d.getDate() + dStep)) {
      xl += `<text x="${x(+d)}" y="${H - 8}" class="fw-xlab">${this._dm(d)}</text>`;
    }
    const heute = x(Date.now());
    let kurven = "";
    scharen.forEach(s => {
      if (s.pts.length < 2) return;
      const c = s.kids.length > 1 ? "var(--secondary-text-color)" : U.esc(s.kids[0].color);
      const band = (lo, hi) => s.pts.map(p => `${x(p.t)},${y(p.c[hi])}`).join(" ") + " " + s.pts.slice().reverse().map(p => `${x(p.t)},${y(p.c[lo])}`).join(" ");
      const last = s.pts[s.pts.length - 1];
      kurven += `<g class="fw-ser" style="--k:${c}"><polygon points="${band(0, 4)}" fill="var(--kl)" opacity=".07"/><polygon points="${band(1, 3)}" fill="var(--kl)" opacity=".09"/>` +
        `<polyline points="${s.pts.map(p => `${x(p.t)},${y(p.c[2])}`).join(" ")}" fill="none" stroke="var(--kl)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".55"/></g>` +
        [[0, "3"], [2, "50"], [4, "97"]].map(([i, l]) => `<text x="${x(last.t) - 3}" y="${y(last.c[i]) - 3}" class="fw-plab">P${l}</text>`).join("");
    });
    let linien = "", punkte = "";
    reihen.forEach(({ kid, pts }) => {
      if (!pts.length) return;
      const c = U.esc(kid.color);
      if (pts.length > 1) linien += `<g class="fw-ser" style="--k:${c}"><polyline points="${pts.map(p => `${x(+p.date)},${y(p.g)}`).join(" ")}" fill="none" stroke="var(--kl)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></g>`;
      pts.forEach(p => {
        const tip = `${kid.name}: ${this._kg(p.g)} am ${this._dmy(p.date)}${p.zeit ? ` um ${p.zeit}` : ""}`;
        punkte += `<g data-uid="${U.esc(p.uid)}" class="fw-pt fw-ser" style="--k:${c}"><title>${U.esc(tip)}</title>` +
          `<circle cx="${x(+p.date)}" cy="${y(p.g)}" r="14" fill="transparent"/>` +
          `<circle cx="${x(+p.date)}" cy="${y(p.g)}" r="4.5" fill="var(--kl)" stroke="var(--ha-card-background,var(--card-background-color,#fff))" stroke-width="2"/></g>`;
      });
    });
    box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf">
      ${grid}<text x="6" y="${T + 4}" class="fw-ylab fw-unit" text-anchor="start">kg</text>
      ${kurven}<line x1="${heute}" x2="${heute}" y1="${T}" y2="${H - B}" class="fw-today"/>
      ${xl}${linien}${punkte}</svg>${scharen.length ? `<div class="fw-quelle">Kurven P3–P97: ${this._ref.preterm && Object.keys(this._ref.preterm).length
      ? "INTERGROWTH-21st für Frühgeborene bis 64 Wochen nach Beginn der Schwangerschaft, danach WHO" : "WHO"} nach korrigiertem Alter.</div>` : ""}`;
  }

  // ---------- Schreiben ----------
  // Wiegezeit: wer einträgt, hat gerade gewogen — die Uhrzeit der Eingabe ist die Wiegezeit.
  _jetztHM() { const n = new Date(); return `${this._p(n.getHours())}:${this._p(n.getMinutes())}`; }
  _ev(kind, g, zeit) {
    const k = this._kid(kind);
    return { summary: `${k.name} ${g} g`, description: JSON.stringify(Object.assign({ typ: "gewicht", kind, g }, zeit ? { zeit } : {})) };
  }
  async _create(kind, date, g, zeit = this._jetztHM()) {
    const d = this._ev(kind, g, zeit), nach = new Date(date); nach.setDate(nach.getDate() + 1);
    try {
      await this._hass.callService("calendar", "create_event", {
        entity_id: this.config.calendar, summary: d.summary, description: d.description,
        start_date: this._iso(date), end_date: this._iso(nach),
      });
      return true;
    } catch (e) { U.toast(this, "Gewicht konnte nicht gespeichert werden"); return false; }
  }
  async _delete(uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this.config.calendar, uid }); return true; }
    catch (e) { if (!leise) U.toast(this, "Eintrag konnte nicht gelöscht werden"); return false; }
  }
  // Korrigieren behält die Wiegezeit; wer am selben Tag neu wiegt, übergibt die neue.
  async _update(alt, kind, date, g, zeit = alt.zeit) {
    const d = this._ev(kind, g, zeit), nach = new Date(date); nach.setDate(nach.getDate() + 1);
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: this.config.calendar, uid: alt.uid,
        event: { summary: d.summary, description: d.description, dtstart: this._iso(date), dtend: this._iso(nach) } });
      return true;
    } catch (e) {
      // Rückfall wie im Stillprotokoll: neu anlegen, dann alt löschen — und laut sagen, falls der alte bleibt.
      if (!(await this._create(kind, date, g, zeit))) return false;
      if (!(await this._delete(alt.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  // ---------- Dialog ----------
  _closeOv() { if (this._ov) { this._ov.remove(); this._ov = null; } }
  _openDialog(e) {
    this._closeOv();
    const kids = this.config.kids;
    let kind = e ? e.kind : kids[0].key;
    const ov = document.createElement("div");
    ov.className = "fw-ov";
    ov.innerHTML = `<div class="fw-modal">
      <div class="fw-mhead">${e ? "Gewicht bearbeiten" : "Gewicht eintragen"}</div>
      <span class="fw-lbl">Kind</span>
      <div class="fw-seg">${kids.map(k => `<button data-k="${U.esc(k.key)}"><span class="fw-dot" style="background:${U.esc(k.color)}"></span>${U.esc(k.name)}</button>`).join("")}</div>
      <div class="fw-row">
        <label><span class="fw-lbl">Datum</span><input class="fw-in fw-datum" type="date" value="${this._iso(e ? e.date : new Date())}" max="${this._iso(new Date())}"></label>
        <label><span class="fw-lbl">Gewicht (g)</span><input class="fw-in fw-g" type="text" inputmode="decimal" placeholder="z. B. 3450" value="${e ? e.g : ""}"></label>
      </div>
      <div class="fw-hint">Gramm oder Kilo — „3450“ und „3,45“ ergeben dasselbe.</div>
      <div class="fw-foot">
        ${e ? `<button class="fw-btn fw-del">Löschen</button>` : ""}
        <span class="fw-flex"></span>
        <button class="fw-btn fw-cancel">Abbrechen</button><button class="fw-btn fw-ok">Speichern</button>
      </div></div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov;
    const mark = () => ov.querySelectorAll(".fw-seg button").forEach(b => b.classList.toggle("fw-on", b.dataset.k === kind));
    ov.querySelectorAll(".fw-seg button").forEach(b => b.addEventListener("click", () => { kind = b.dataset.k; mark(); }));
    mark();
    if (!e) setTimeout(() => ov.querySelector(".fw-g").focus(), 50);
    ov.querySelector(".fw-cancel").addEventListener("click", () => this._closeOv());
    if (e) ov.querySelector(".fw-del").addEventListener("click", async () => {
      if (!window.confirm(`${this._kid(e.kind).name}: ${this._kg(e.g)} vom ${this._dmy(e.date)} löschen?`)) return;
      this._closeOv();
      if (await this._delete(e.uid)) this._load();
    });
    ov.querySelector(".fw-ok").addEventListener("click", async () => {
      const g = this._gramm(ov.querySelector(".fw-g").value);
      const ds = ov.querySelector(".fw-datum").value;
      if (!ds) { U.toast(this, "Bitte ein Datum wählen"); return; }
      if (g < 500 || g > 30000) { U.toast(this, "Das Gewicht sieht nicht richtig aus – bitte prüfen"); return; }
      const date = this._day(ds);
      if (date - new Date() > 86400000) { U.toast(this, "Das Datum liegt in der Zukunft"); return; }
      // Gleiches Kind am gleichen Tag gibt es nur einmal: dann wird korrigiert, nicht verdoppelt.
      const gleich = (this._data || []).find(x => x.kind === kind && this._iso(x.date) === ds && (!e || x.uid !== e.uid));
      this._closeOv();
      let ok;
      if (e) ok = await this._update(e, kind, date, g);
      else if (gleich) { ok = await this._update(gleich, kind, date, g, this._jetztHM()); if (ok) U.toast(this, `Wert vom ${this._dmy(date)} ersetzt`); }
      else ok = await this._create(kind, date, g);
      if (ok) this._load();
    });
  }

  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .fw-card,.fw-ov{--fw-s:var(--fp-surface,var(--secondary-background-color));--fw-s2:var(--fp-surface-2,var(--divider-color));
        --fw-up:var(--success-color,#3c7a3c);--fw-down:var(--error-color,#c0392b);
        --fw-r:var(--fp-radius,16px);--fw-rs:var(--fp-radius-sm,12px);}
      /* Kinderfarbe der Kurven: --k ist die Farbe des Kindes, --kl die Variante für Linien und Punkte.
         fw-dark (am Host, folgt hass.themes.darkMode): im Dunkeln mit der Textfarbe aufgehellt, sonst verschwindet das Grün auf dem dunklen Grund. */
      .fw-ser{--kl:var(--k);}
      .fw-dark .fw-ser{--kl:color-mix(in srgb,var(--k) 55%,var(--primary-text-color));}
      .fw-card{padding:16px 16px 10px;}
      .fw-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      .fw-title{font-size:1.25rem;font-weight:700;letter-spacing:-.01em;}
      .fw-add{border:none;border-radius:var(--fw-rs);padding:10px 16px;font-size:.95rem;font-weight:700;cursor:pointer;
        background:rgba(var(--fp-accent-rgb,79,195,247),.14);color:var(--fp-head,var(--primary-color));}
      .fw-sum{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.9rem;margin:0 2px 8px;font-variant-numeric:tabular-nums;}
      .fw-chip{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 6px;}
      .fw-chip>*{white-space:nowrap;}   /* Wert, Änderung und Perzentile brechen nur als Ganzes um */
      .fw-chip .fw-dot{align-self:center;}
      .fw-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none;}
      .fw-muted{color:var(--secondary-text-color);font-size:.82rem;}
      .fw-delta{font-weight:700;font-size:.85rem;} .fw-up{color:var(--fw-up);} .fw-down{color:var(--fw-down);}
      .fw-chart{width:100%;min-height:60px;}
      .fw-chart svg{display:block;overflow:visible;}
      .fw-grid{stroke:var(--divider-color);stroke-width:1;}
      .fw-today{stroke:var(--secondary-text-color);stroke-width:1;stroke-dasharray:3 4;opacity:.5;}
      .fw-plab{font-size:9.5px;fill:var(--secondary-text-color);text-anchor:end;opacity:.8;}
      .fw-pz{font-size:.78rem;font-weight:700;color:var(--secondary-text-color);background:var(--fw-s);border-radius:6px;padding:1px 6px;}
      .fw-quelle{font-size:.7rem;color:var(--secondary-text-color);opacity:.75;margin-top:4px;}
      .fw-ylab{font-size:11px;fill:var(--secondary-text-color);text-anchor:end;font-variant-numeric:tabular-nums;}
      .fw-unit{font-weight:700;}
      .fw-xlab{font-size:11px;fill:var(--secondary-text-color);text-anchor:middle;}
      .fw-pt{cursor:pointer;}
      .fw-empty{padding:26px 8px;text-align:center;color:var(--secondary-text-color);font-size:.9rem;line-height:1.5;}
      .fw-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;}
      .fw-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--fw-r);padding:18px;
        width:100%;max-width:400px;box-shadow:0 12px 40px rgba(0,0,0,.25);}
      .fw-mhead{font-size:1.1rem;font-weight:700;margin-bottom:6px;}
      .fw-lbl{display:block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);margin:12px 0 6px;}
      .fw-seg{display:flex;background:var(--fw-s);border-radius:var(--fw-rs);padding:3px;gap:2px;}
      .fw-seg button{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;border:none;background:transparent;
        color:var(--secondary-text-color);font-size:.95rem;font-weight:600;padding:9px 12px;border-radius:calc(var(--fw-rs) - 3px);cursor:pointer;}
      .fw-seg button.fw-on{background:var(--fw-s2);color:var(--primary-text-color);box-shadow:0 1px 3px rgba(0,0,0,.12);}
      .fw-row{display:flex;gap:10px;} .fw-row label{flex:1;min-width:0;}
      .fw-in{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--divider-color);border-radius:var(--fw-rs);
        background:var(--fw-s);color:var(--primary-text-color);font-size:1rem;}
      .fw-in[type=date],.fw-in[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;color-scheme:light;} .fw-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
      .fw-dark .fw-in[type=date],.fw-dark .fw-in[type=time]{color-scheme:dark;}
      .fw-hint{font-size:.78rem;color:var(--secondary-text-color);margin-top:6px;}
      .fw-foot{display:flex;gap:8px;margin-top:18px;align-items:center;} .fw-flex{flex:1;}
      .fw-btn{border:none;border-radius:var(--fw-rs);padding:11px 16px;font-weight:600;cursor:pointer;
        background:var(--fw-s);color:var(--primary-text-color);}
      .fw-ok{background:var(--fp-head,var(--primary-color));color:var(--fp-accent-fg,#fff);}
      .fw-del{background:transparent;color:var(--fw-down);padding-left:4px;padding-right:4px;}
    </style>`;
  }
  getCardSize() { return 6; }
}
if (!customElements.get("fp-weight-card")) {
  customElements.define("fp-weight-card", FpWeightCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-weight-card", name: "FP Weight Card", description: "Gewichtsverlauf mehrerer Kinder auf einer Zeitachse" });
}
})();

/* ===== fp-diaper-card v7 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Uhrzeit-Eingaben in der doppelten Stunde (Ende der Sommerzeit) eindeutig; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: Farben und Radien aus dem Theme, Kinderfarbe im Dunkeln lesbar; liest den Kalender alle 20 s statt jede Minute, Einträge von außen erscheinen schneller; Uhrzeitfeld passt aufs iPhone, Knöpfe auf schmalen Karten kleiner; Windelprotokoll je Kind: nass/voll/beides per Tipp, Zeit seit der letzten Windel und dem letzten Stuhl, Heute/Gestern mit Summen, Rueckblick ueber 7 Tage) ===== */
// Ein Eintrag = ein kurzer Termin im eigenen Kalender: Titel "Windel nass",
// Beschreibung {"typ":"windel","art":"nass|voll|beides"}. Nicht in den
// Stillkalender schreiben: die 3-h-Erinnerung zählt dort jeden Eintrag als Mahlzeit.
(() => {
const U = window.__fpUtils;
class FpDiaperCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.calendar) throw new Error("fp-diaper-card braucht calendar");
    this.config = Object.assign({ name: "", color: "" }, config);
    this._built = false; this._evs = null; this._sig = ""; this._ticks = 0;
    this._wkKey = `fp-diaper-woche:${this.config.calendar}`;
    try { this._woche = localStorage.getItem(this._wkKey) === "1"; } catch (e) { this._woche = false; }
  }
  set hass(hass) {
    this._hass = hass;
    this.classList.toggle("fd-dark", !!(hass && hass.themes && hass.themes.darkMode));   // hell oder dunkel entscheidet das Gerät; am Host, damit auch der Dialog es sieht
    if (!this._built) { this._build(); this._load(); }
  }
  connectedCallback() { if (!this._timer) this._timer = setInterval(() => this._tick(), 20000); }
  disconnectedCallback() { clearInterval(this._timer); this._timer = null; }
  // Alle 20 s Kalender neu lesen — Einträge kommen auch von außen (Hue-Schalter, andere Geräte).
  _tick() { this._load(); }

  _p(n) { return String(n).padStart(2, "0"); }
  _hm(d) { return `${this._p(d.getHours())}:${this._p(d.getMinutes())}`; }
  _tag(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  _hmDauer(ms) { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}:${this._p(m % 60)} h`; }
  _artText(a) { return a === "beides" ? "nass + voll" : a; }
  _artIcon(a) { return a === "beides" ? "💧💩" : a === "voll" ? "💩" : "💧"; }
  // Uhrzeit auf das Datum eines Bezugstags setzen. ref = ursprünglicher Zeitpunkt des Eintrags: in der doppelten Stunde beim Ende der
  // Sommerzeit bleibt dadurch Sommer- oder Winterzeit, wie sie war (siehe U.ortZeit, wieRef).
  _at(basis, hhmm, ref) { const [h, m] = String(hhmm || "").split(":").map(Number); return U.ortZeit(basis.getFullYear(), basis.getMonth(), basis.getDate(), h || 0, m || 0, ref, 0, true); }

  _parse(ev) {
    const s = new Date((ev.start && (ev.start.dateTime || ev.start.date)) || ev.start);
    let meta = {};
    try { meta = JSON.parse(ev.description || "{}") || {}; } catch (x) { meta = {}; }
    const sum = String(ev.summary || "");
    const art = meta.art || (/beides|\+/.test(sum) ? "beides" : /voll/i.test(sum) ? "voll" : "nass");
    return { uid: ev.uid, start: s, art };
  }
  async _load() {
    if (!this._hass) return;
    const jetzt = new Date();
    const von = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 7);
    const bis = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1);
    try {
      const evts = await this._hass.callApi("GET",
        `calendars/${this.config.calendar}?start=${encodeURIComponent(von.toISOString())}&end=${encodeURIComponent(bis.toISOString())}`);
      this._evs = (Array.isArray(evts) ? evts : []).map(x => this._parse(x)).filter(x => !isNaN(x.start));
    } catch (err) {
      if (this._loadedOnce) U.toast(this, "Windelprotokoll konnte nicht geladen werden");
      this._evs = this._evs || [];
    }
    this._loadedOnce = true;   // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._paint();
  }

  _build() {
    this._built = true;
    const c = this.config;
    // Am Host statt an der ha-card: der Dialog hängt daneben und braucht den Akzent auch.
    // Schrift auf der Kinderfarbe ist weiß, auf dem Theme-Akzent --fp-accent-fg (kommt im CSS).
    if (c.color) { this.style.setProperty("--fd-akzent", c.color); this.style.setProperty("--fd-akzent-fg", "#fff"); }
    else { this.style.removeProperty("--fd-akzent"); this.style.removeProperty("--fd-akzent-fg"); }
    this.innerHTML = `
      <ha-card class="fd-card">
        <div class="fd-name"><span class="fd-dot"></span>${U.esc(c.name)}</div>
        <div class="fd-actions">
          <button class="fd-btn" data-art="nass">💧 Nass</button>
          <button class="fd-btn" data-art="voll">💩 Voll</button>
          <button class="fd-btn" data-art="beides">💧💩 Beides</button>
        </div>
        <div class="fd-since"></div>
        <div class="fd-table"></div>
        <div class="fd-foot2"><button class="fd-txtbtn fd-wk-tgl"></button></div>
        <div class="fd-week" hidden></div>
      </ha-card>
      ${this._styles()}`;
    this.querySelectorAll(".fd-btn").forEach(b => b.addEventListener("click", () => this._add(b.dataset.art)));
    this.querySelector(".fd-wk-tgl").addEventListener("click", () => {
      this._woche = !this._woche;
      try { localStorage.setItem(this._wkKey, this._woche ? "1" : "0"); } catch (e) { /* nur Komfort */ }
      this._sig = ""; this._paint();
    });
    this.querySelector(".fd-table").addEventListener("click", ev => {
      const tr = ev.target.closest("tr[data-uid]");
      const e = tr && (this._evs || []).find(x => x.uid === tr.dataset.uid);
      if (e) this._openEdit(e);
    });
  }

  _paintSince() {
    const el = this.querySelector(".fd-since");
    if (!el || !this._evs) return;
    const jetzt = Date.now(), nach = this._evs.slice().sort((a, b) => b.start - a.start);
    const letzte = nach[0], stuhl = nach.find(e => e.art !== "nass");
    const teil = (titel, e) => e ? `<div><span class="fd-since-lbl">${titel}</span><span class="fd-since-big">${this._hmDauer(jetzt - e.start)}</span>
      <span class="fd-since-sub">um ${this._hm(e.start)}${this._tag(e.start) === this._tag(new Date()) ? "" : ` (${e.start.getDate()}.${e.start.getMonth() + 1}.)`}</span></div>` : "";
    el.innerHTML = letzte ? teil("Letzte Windel", letzte) + teil("Letzter Stuhl", stuhl) : `<div class="fd-since-sub">Noch keine Windel eingetragen</div>`;
  }

  _paint() {
    this._paintSince();
    const el = this.querySelector(".fd-table");
    if (!el || !this._evs) return;
    const sig = JSON.stringify([this._tag(new Date()), this._woche, this._evs.map(e => [e.uid, +e.start, e.art])]);
    if (sig === this._sig) return;
    this._sig = sig;
    const heute = new Date(), gestern = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - 1);
    el.innerHTML = [["Heute", heute], ["Gestern", gestern]].map(([titel, d]) => {
      const evs = this._evs.filter(e => this._tag(e.start) === this._tag(d)).sort((a, b) => b.start - a.start);
      const nass = evs.filter(e => e.art !== "voll").length, voll = evs.filter(e => e.art !== "nass").length;
      return `<div class="fd-day"><div class="fd-dayhead">${titel}</div><table class="fd-tab"><tbody>${evs.length
        ? evs.map(e => `<tr data-uid="${U.esc(e.uid)}"><td>${this._hm(e.start)}</td><td>${this._artIcon(e.art)} ${this._artText(e.art)}</td></tr>`).join("")
        : `<tr class="fd-nichts"><td colspan="2">Noch nichts eingetragen</td></tr>`}</tbody>${evs.length
        ? `<tfoot><tr><td colspan="2">💧 ${nass} nass · 💩 ${voll} voll</td></tr></tfoot>` : ""}</table></div>`;
    }).join("");
    this._paintWeek();
  }

  // „Beides" zählt bei nass und bei voll mit — so zählen auch Hebammen.
  _paintWeek() {
    const tgl = this.querySelector(".fd-wk-tgl"), box = this.querySelector(".fd-week");
    tgl.textContent = `Letzte 7 Tage ${this._woche ? "▾" : "▸"}`;
    box.hidden = !this._woche;
    if (!this._woche) { box.innerHTML = ""; return; }
    const wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"], heute = new Date(), zeilen = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - i);
      const evs = this._evs.filter(e => this._tag(e.start) === this._tag(d));
      zeilen.push({ titel: i ? `${wt[d.getDay()]} ${d.getDate()}.` : "Heute",
        nass: evs.filter(e => e.art !== "voll").length, voll: evs.filter(e => e.art !== "nass").length });
    }
    const max = Math.max(1, ...zeilen.map(z => Math.max(z.nass, z.voll)));
    const balken = (n, cls) => `<div class="fd-wk-n"><span class="fd-wk-track"><span class="fd-wk-bar ${cls}" style="width:${(n / max) * 100}%"></span></span><b>${n}</b></div>`;
    box.innerHTML = `<table class="fd-tab fd-wk"><thead><tr><th>Tag</th><th>💧 nass</th><th>💩 voll</th></tr></thead><tbody>${
      zeilen.map(z => `<tr><td>${z.titel}</td><td>${balken(z.nass, "")}</td><td>${balken(z.voll, "fd-voll")}</td></tr>`).join("")}</tbody></table>`;
  }

  async _add(art) {
    if (this._busy) return;   // ein Doppeltipp soll keine zwei Windeln eintragen
    this._busy = true; setTimeout(() => { this._busy = false; }, 1500);
    const start = new Date(), end = new Date(start.getTime() + 60000);
    try {
      await this._hass.callService("calendar", "create_event", {
        entity_id: this.config.calendar, summary: `Windel ${this._artText(art)}`, description: JSON.stringify({ typ: "windel", art }),
        start_date_time: U.haZeit(start), end_date_time: U.haZeit(end),
      });
      U.toast(this, `Windel ${this._artText(art)} eingetragen`);
      this._load();
    } catch (e) { U.toast(this, "Eintrag konnte nicht gespeichert werden"); }
  }
  async _delete(uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this.config.calendar, uid }); return true; }
    catch (e) { if (!leise) U.toast(this, "Eintrag konnte nicht gelöscht werden"); return false; }
  }
  async _update(ev, start, art) {
    const end = new Date(start.getTime() + 60000), summary = `Windel ${this._artText(art)}`, description = JSON.stringify({ typ: "windel", art });
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: this.config.calendar, uid: ev.uid,
        event: { summary, description, dtstart: U.haZeit(start), dtend: U.haZeit(end) } });
      return true;
    } catch (e) {
      // Rückfall: neu anlegen, dann alt löschen. Bleibt der alte stehen, sagen
      // wir es laut statt still ein Duplikat zu hinterlassen.
      try {
        await this._hass.callService("calendar", "create_event", { entity_id: this.config.calendar, summary, description,
          start_date_time: U.haZeit(start), end_date_time: U.haZeit(end) });
      } catch (x) { U.toast(this, "Eintrag konnte nicht gespeichert werden"); return false; }
      if (!(await this._delete(ev.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  _closeOv() { if (this._ov) { this._ov.remove(); this._ov = null; } }
  _openEdit(e) {
    this._closeOv();
    let art = e.art;
    const ov = document.createElement("div");
    ov.className = "fd-ov";
    ov.innerHTML = `<div class="fd-modal">
      <div class="fd-mhead">Windel bearbeiten</div>
      <div class="fd-lbl">Art</div>
      <div class="fd-seg"><button data-a="nass">💧 Nass</button><button data-a="voll">💩 Voll</button><button data-a="beides">Beides</button></div>
      <div class="fd-lbl">Uhrzeit</div>
      <input class="fd-in" type="time" value="${this._hm(e.start)}">
      <div class="fd-mfoot">
        <button class="fd-mbtn fd-del">Löschen</button><span class="fd-flex"></span>
        <button class="fd-mbtn fd-cancel">Abbrechen</button><button class="fd-mbtn fd-ok">Speichern</button>
      </div></div>`;
    ov.addEventListener("click", x => { if (x.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov;
    const mark = () => ov.querySelectorAll(".fd-seg button").forEach(b => b.classList.toggle("fd-on", b.dataset.a === art));
    ov.querySelectorAll(".fd-seg button").forEach(b => b.addEventListener("click", () => { art = b.dataset.a; mark(); }));
    mark();
    ov.querySelector(".fd-cancel").addEventListener("click", () => this._closeOv());
    ov.querySelector(".fd-del").addEventListener("click", async () => {
      if (!window.confirm("Diesen Eintrag löschen?")) return;
      this._closeOv();
      if (await this._delete(e.uid)) this._load();
    });
    ov.querySelector(".fd-ok").addEventListener("click", async () => {
      const start = this._at(e.start, ov.querySelector(".fd-in").value, e.start);
      this._closeOv();
      if (await this._update(e, start, art)) this._load();
    });
  }

  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .fd-card,.fd-ov{--fd-a:var(--fd-akzent,var(--fp-head,var(--primary-color)));--fd-at:var(--fd-a);--fd-on:var(--fd-akzent-fg,var(--fp-accent-fg,#fff));
        --fd-s:var(--fp-surface,var(--secondary-background-color));--fd-s2:var(--fp-surface-2,var(--divider-color));
        --fd-nass:var(--fp-c-diaper,#3E9DB0);--fd-voll:var(--fp-c-stool,#A77446);
        --fd-r:var(--fp-radius,16px);--fd-rs:var(--fp-radius-sm,12px);}
      /* fd-dark (am Host, folgt hass.themes.darkMode): Kinderfarbe als Schrift mit der Textfarbe aufgehellt, sonst unlesbar auf dunklem Grund.
         --fd-a (Punkt, Knopffläche) bleibt die reine Kinderfarbe. */
      .fd-dark .fd-card,.fd-dark .fd-ov{--fd-at:color-mix(in srgb,var(--fd-a) 55%,var(--primary-text-color));}
      .fd-card{padding:16px 16px 12px;container-type:inline-size;}
      .fd-name{display:flex;align-items:center;gap:9px;font-size:1.25rem;font-weight:700;letter-spacing:-.01em;margin-bottom:14px;}
      .fd-dot{width:12px;height:12px;border-radius:50%;background:var(--fd-a);flex:none;}
      .fd-actions{display:flex;gap:10px;}
      .fd-btn{flex:1 1 0;min-height:56px;border:none;border-radius:var(--fd-rs);cursor:pointer;padding:0 6px;
        background:var(--fd-s);color:var(--primary-text-color);font-size:1rem;font-weight:600;}
      @container (max-width: 400px){ .fd-btn{font-size:.86rem;padding:0 4px;white-space:nowrap;} }
      .fd-btn:active{background:var(--fd-s2);}
      .fd-since{display:flex;gap:22px;flex-wrap:wrap;margin:14px 2px 4px;}
      .fd-since>div{display:flex;flex-direction:column;}
      .fd-since-lbl{font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color);opacity:.8;}
      .fd-since-big{font-size:1.45rem;font-weight:700;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--primary-text-color);}
      .fd-since-sub{font-size:.8rem;color:var(--secondary-text-color);}
      .fd-day{margin-top:14px;}
      .fd-dayhead{font-size:.7rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--secondary-text-color);opacity:.8;margin:0 2px 6px;}
      .fd-tab{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums;}
      .fd-tab th{font-size:.7rem;font-weight:600;color:var(--secondary-text-color);text-align:left;padding:4px 6px;border-bottom:1px solid var(--divider-color);}
      .fd-tab td{padding:9px 6px;border-bottom:1px solid var(--divider-color);}
      .fd-tab tbody tr[data-uid]{cursor:pointer;}
      .fd-tab tbody tr[data-uid]:active{background:var(--fd-s);}
      .fd-tab tbody td:first-child{width:64px;}
      .fd-nichts td{color:var(--secondary-text-color);opacity:.7;font-size:.82rem;}
      .fd-tab tfoot td{border-bottom:none;font-weight:700;font-size:.82rem;color:var(--secondary-text-color);padding-top:8px;}
      .fd-foot2{display:flex;justify-content:flex-end;margin-top:14px;}
      .fd-txtbtn{border:none;background:transparent;cursor:pointer;padding:6px 2px;
        font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);}
      .fd-wk td{padding:7px 6px;}
      .fd-wk-n{display:flex;align-items:center;gap:6px;}
      .fd-wk-track{flex:1;height:8px;border-radius:4px;background:var(--fd-s2);overflow:hidden;}
      .fd-wk-bar{display:block;height:100%;border-radius:4px;background:var(--fd-nass);}   /* nass und voll in den Tätigkeitsfarben des Themes */
      .fd-wk-bar.fd-voll{background:var(--fd-voll);}

      .fd-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;}
      .fd-modal{background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--fd-r);padding:18px;
        width:100%;max-width:380px;box-shadow:0 12px 40px rgba(0,0,0,.25);}
      .fd-mhead{font-size:1.1rem;font-weight:700;margin-bottom:12px;}
      .fd-lbl{display:block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);margin:12px 0 6px;}
      .fd-seg{display:flex;background:var(--fd-s);border-radius:var(--fd-rs);padding:3px;gap:2px;}
      .fd-seg button{flex:1;border:none;background:transparent;color:var(--secondary-text-color);font-size:.85rem;font-weight:600;padding:8px 6px;border-radius:calc(var(--fd-rs) - 3px);cursor:pointer;}
      .fd-seg button.fd-on{background:var(--fd-s2);color:var(--fd-at);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.12);}
      .fd-in{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--divider-color);border-radius:var(--fd-rs);
        background:var(--fd-s);color:var(--primary-text-color);font-size:1rem;}
      .fd-in[type=date],.fd-in[type=time]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;color-scheme:light;} .fd-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum/Uhrzeit sonst breiter als der Dialog */
      .fd-dark .fd-in[type=date],.fd-dark .fd-in[type=time]{color-scheme:dark;}
      .fd-mfoot{display:flex;gap:8px;margin-top:18px;align-items:center;}
      .fd-flex{flex:1;}
      .fd-mbtn{border:none;border-radius:var(--fd-rs);padding:11px 16px;font-weight:600;cursor:pointer;background:var(--fd-s);color:var(--primary-text-color);}
      .fd-ok{background:var(--fd-a);color:var(--fd-on);}
      .fd-del{background:transparent;color:var(--error-color,#c0392b);padding-left:4px;padding-right:4px;}
    </style>`;
  }
  getCardSize() { return 6; }
}
if (!customElements.get("fp-diaper-card")) {
  customElements.define("fp-diaper-card", FpDiaperCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-diaper-card", name: "FP Diaper Card", description: "Windelprotokoll je Kind: nass/voll per Tipp, seit wann, Heute/Gestern, Rückblick über 7 Tage" });
}
})();

/* ===== fp-milestone-card v5 (Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor: Foto je Meilenstein: hochladen beim Festhalten und später, rund im Album statt des Symbols, klein in Entwicklung und Bewegung, groß in der Erinnerung; davor: Farben und Radien aus dem Theme, Kinderfarbe im Dunkeln lesbar; Heute-Linie in der Bewegung immer sichtbar, auch vor dem errechneten Termin, kräftiger und mit „heute“ an der Achse; Meilensteine je Kind zum Abhaken: Erste Male als Sticker-Album, Entwicklung nach Alter nach den CDC-Checklisten 2022, Bewegung mit den Zeitfenstern der WHO; Abhaken mit Konfetti, Datum und Notiz, auch nachträglich und für mehrere Kinder auf einmal; eigene Momente; Frühgeborene nach korrigiertem Alter) ===== */
// Ein erreichter Meilenstein = ein Ganztagstermin im eigenen Kalender an dem Tag,
// an dem es passiert ist: Titel "🐢 Kind A: Krabbelt", Beschreibung
// {"typ":"meilenstein","kind":"kind_a","id":"krabbeln"}, dazu optional notiz,
// ca (Datum nur ungefähr), foto (ein Foto: media-source-ID aus dem Medienordner,
// Unterordner image_folder) und bei eigenen Momenten t (Titel) und e (Symbol).
// Dieselbe id in mehreren Bereichen ist derselbe Meilenstein: „Sitzt allein“ bei
// den Ersten Malen hakt auch „Sitzt ohne Hilfe“ (Entwicklung, 9 Monate) und das
// WHO-Fenster ab. Ids nie umbenennen — sie stehen in den Kalendereinträgen.
(() => {
const U = window.__fpUtils;

// Erste Male: [id, Symbol, Titel]. Kein Zeitplan, nur Erinnerung.
const FIRSTS = [
  { g: "Bewegung", e: "🤸", items: [
    ["drehen_br", "🔄", "Dreht sich vom Bauch auf den Rücken"],
    ["drehen_rb", "🙃", "Dreht sich vom Rücken auf den Bauch"],
    ["robben", "🐛", "Robbt"],
    ["sitzen", "🧘", "Sitzt allein"],
    ["krabbeln", "🐢", "Krabbelt"],
    ["hochziehen", "💪", "Zieht sich hoch in den Stand"],
    ["gehen_hilfe", "🤝", "Erste Schritte mit Festhalten"],
    ["stehen_frei", "🙌", "Steht frei"],
    ["gehen", "👣", "Erste freie Schritte"],
    ["treppe", "🪜", "Erste Stufen hinauf"],
  ] },
  { g: "Gefühle & Sprache", e: "💛", items: [
    ["laecheln", "😊", "Erstes Lächeln"],
    ["lachen", "😄", "Erstes Lachen"],
    ["mama_papa", "👪", "Sagt Mama oder Papa"],
    ["erstes_wort", "🗣️", "Erstes Wort"],
    ["winken", "👋", "Winkt"],
    ["klatschen", "👏", "Klatscht in die Hände"],
    ["kuesschen", "😘", "Erstes Küsschen"],
    ["zweiwort", "💬", "Erster Zwei-Wort-Satz"],
  ] },
  { g: "Essen & Trinken", e: "🥣", items: [
    ["brei", "🥣", "Erster Brei"],
    ["fingeressen", "🥕", "Isst selbst mit den Fingern"],
    ["becher", "🥛", "Trinkt aus dem Becher"],
    ["loeffel", "🥄", "Isst selbst mit dem Löffel"],
    ["abgestillt", "🤱", "Abgestillt"],
  ] },
  { g: "Schlafen & Pflege", e: "🌙", items: [
    ["nabel", "🩹", "Nabel abgefallen"],
    ["baden", "🛁", "Erstes Bad"],
    ["durchschlafen", "🌙", "Erste Nacht durchgeschlafen"],
    ["eigenes_bett", "🛏️", "Erste Nacht im eigenen Bett"],
    ["zahn", "🦷", "Erster Zahn"],
    ["zaehneputzen", "🪥", "Erstes Zähneputzen"],
    ["haarschnitt", "✂️", "Erster Haarschnitt"],
  ] },
  { g: "Erlebnisse", e: "🌍", items: [
    ["spaziergang", "🌳", "Erster Spaziergang"],
    ["ausflug", "🚗", "Erster Ausflug"],
    ["wasser", "🌊", "Erstes Mal im Wasser"],
    ["schnee", "❄️", "Erster Schnee"],
    ["urlaub", "🧳", "Erster Urlaub"],
    ["oma_opa", "🏡", "Erste Nacht bei Oma und Opa"],
    ["weihnachten", "🎄", "Erstes Weihnachten"],
    ["geburtstag", "🎂", "Erster Geburtstag"],
    ["kita", "🎒", "Erster Kita-Tag"],
  ] },
  { g: "Später", e: "🌈", items: [
    ["schuhe", "👟", "Erste Schuhe"],
    ["kritzeln", "🖍️", "Erstes Gekritzel"],
    ["laufrad", "🚲", "Erste Runde am Laufrad"],
    ["ohne_windel", "🩲", "Tagsüber ohne Windel"],
  ] },
];

// Entwicklung nach Alter: CDC „Learn the Signs. Act Early.“, Checklisten von 2022,
// übersetzt. Jeden Punkt schaffen mindestens 75 % der Kinder bis zu diesem Alter.
// [id, Bereich, Text]; Bereiche: s Gefühle & Miteinander, p Sprache, d Entdecken, b Bewegung.
const AREAS = { s: ["💛", "Gefühle & Miteinander"], p: ["💬", "Sprache"], d: ["💡", "Entdecken"], b: ["🤸", "Bewegung"] };
const CDC = [
  { m: 2, items: [
    ["c2_beruhigt", "s", "Beruhigt sich, wenn du es ansprichst oder hochnimmst"],
    ["c2_gesicht", "s", "Schaut dir ins Gesicht"],
    ["c2_freut", "s", "Freut sich, wenn du kommst"],
    ["laecheln", "s", "Lächelt zurück, wenn du es anlächelst oder ansprichst"],
    ["c2_laute", "p", "Macht andere Laute als Weinen"],
    ["c2_geraeusch", "p", "Reagiert auf laute Geräusche"],
    ["c2_folgt", "d", "Folgt dir mit den Augen"],
    ["c2_spielzeug", "d", "Schaut ein Spielzeug einige Sekunden lang an"],
    ["c2_kopf", "b", "Hebt in Bauchlage den Kopf"],
    ["c2_arme", "b", "Bewegt beide Arme und beide Beine"],
    ["c2_haende", "b", "Öffnet kurz die Hände"],
  ] },
  { m: 4, items: [
    ["c4_laecheln", "s", "Lächelt von sich aus, um deine Aufmerksamkeit zu bekommen"],
    ["c4_glucksen", "s", "Gluckst, wenn du es zum Lachen bringen willst"],
    ["c4_aufmerksam", "s", "Holt sich mit Blicken, Bewegungen oder Lauten deine Aufmerksamkeit"],
    ["c4_gurrt", "p", "Gurrt („oooh“, „aaah“)"],
    ["c4_antwortet", "p", "Antwortet mit Lauten, wenn du mit ihm sprichst"],
    ["c4_stimme", "p", "Dreht den Kopf zu deiner Stimme"],
    ["c4_hunger", "d", "Öffnet bei Hunger den Mund, wenn es Brust oder Fläschchen sieht"],
    ["c4_haende", "d", "Schaut sich neugierig die eigenen Hände an"],
    ["c4_kopf", "b", "Hält den Kopf ohne Stütze, wenn du es hältst"],
    ["c4_halten", "b", "Hält ein Spielzeug fest, das du ihm in die Hand gibst"],
    ["c4_schlagen", "b", "Schlägt mit dem Arm nach Spielzeug"],
    ["c4_mund", "b", "Steckt die Hände in den Mund"],
    ["c4_unterarm", "b", "Stützt sich in Bauchlage auf die Unterarme"],
  ] },
  { m: 6, items: [
    ["c6_kennt", "s", "Erkennt vertraute Menschen"],
    ["c6_spiegel", "s", "Schaut sich gern im Spiegel an"],
    ["lachen", "s", "Lacht"],
    ["c6_abwechselnd", "p", "„Unterhält“ sich mit dir: Laute hin und her"],
    ["c6_prusten", "p", "Macht Prustgeräusche mit den Lippen"],
    ["c6_quietschen", "p", "Quietscht"],
    ["c6_mund", "d", "Erkundet Dinge mit dem Mund"],
    ["c6_greift", "d", "Greift gezielt nach einem Spielzeug"],
    ["c6_satt", "d", "Macht den Mund zu, wenn es nichts mehr essen will"],
    ["drehen_br", "b", "Dreht sich vom Bauch auf den Rücken"],
    ["c6_arme", "b", "Stützt sich in Bauchlage auf gestreckte Arme"],
    ["c6_abstuetzen", "b", "Stützt sich im Sitzen mit den Händen ab"],
  ] },
  { m: 9, items: [
    ["c9_fremdeln", "s", "Fremdelt – ist bei Fremden schüchtern oder anhänglich"],
    ["c9_gesichter", "s", "Zeigt verschiedene Gesichter: fröhlich, traurig, wütend, überrascht"],
    ["c9_name", "s", "Schaut, wenn du seinen Namen rufst"],
    ["c9_weggehen", "s", "Merkt, wenn du weggehst – schaut, streckt sich oder weint"],
    ["c9_kuckuck", "s", "Lacht bei Kuckuck-Spielen"],
    ["c9_silben", "p", "Plappert Silbenketten wie „mamama“ und „bababa“"],
    ["c9_arme", "p", "Streckt die Arme hoch, um hochgenommen zu werden"],
    ["c9_sucht", "d", "Sucht Dinge, die hinuntergefallen sind"],
    ["c9_klopfen", "d", "Schlägt zwei Dinge aneinander"],
    ["c9_aufsetzen", "b", "Setzt sich allein auf"],
    ["sitzen", "b", "Sitzt ohne Hilfe"],
    ["c9_wechseln", "b", "Gibt Dinge von einer Hand in die andere"],
    ["c9_harken", "b", "Holt sich Essen mit den Fingern heran"],
  ] },
  { m: 12, items: [
    ["c12_spiele", "s", "Spielt Spiele wie „Backe, backe Kuchen“"],
    ["winken", "p", "Winkt „Tschüss“"],
    ["mama_papa", "p", "Sagt „Mama“ oder „Papa“ (oder einen anderen Namen) zu euch"],
    ["c12_nein", "p", "Versteht „Nein“ und hält kurz inne"],
    ["c12_behaelter", "d", "Legt etwas in einen Behälter, zum Beispiel einen Klotz in einen Becher"],
    ["c12_versteck", "d", "Findet Dinge, die du vor seinen Augen versteckst"],
    ["hochziehen", "b", "Zieht sich hoch in den Stand"],
    ["gehen_hilfe", "b", "Läuft an Möbeln entlang"],
    ["becher", "b", "Trinkt aus einem offenen Becher, den du hältst"],
    ["c12_pinzette", "b", "Hebt Kleines mit Daumen und Zeigefinger auf"],
  ] },
  { m: 15, items: [
    ["c15_nachmachen", "s", "Macht andere Kinder beim Spielen nach"],
    ["c15_zeigt", "s", "Zeigt dir etwas, das es mag"],
    ["klatschen", "s", "Klatscht vor Freude"],
    ["c15_kuscheltier", "s", "Umarmt ein Kuscheltier oder eine Puppe"],
    ["c15_zuneigung", "s", "Zeigt Zuneigung: umarmt, kuschelt, gibt Küsschen"],
    ["c15_woerter", "p", "Versucht ein, zwei Wörter außer Mama und Papa („ba“ für Ball)"],
    ["c15_benennen", "p", "Schaut zum Gegenstand, wenn du ihn benennst"],
    ["c15_gib", "p", "Gibt dir etwas, wenn du die Hand hinhältst und darum bittest"],
    ["c15_zeigen", "p", "Zeigt mit dem Finger, wenn es etwas möchte oder Hilfe braucht"],
    ["c15_richtig", "d", "Benutzt Dinge richtig: Becher, Telefon, Buch"],
    ["c15_stapeln", "d", "Stapelt zwei Klötze aufeinander"],
    ["gehen", "b", "Macht ein paar Schritte allein"],
    ["fingeressen", "b", "Isst einiges selbst mit den Fingern"],
  ] },
  { m: 18, items: [
    ["c18_entfernt", "s", "Entfernt sich, schaut aber, ob du in der Nähe bist"],
    ["c18_zeigt", "s", "Zeigt auf etwas Spannendes, um es dir zu zeigen"],
    ["c18_waschen", "s", "Hält dir die Hände zum Waschen hin"],
    ["c18_buch", "s", "Schaut mit dir ein paar Seiten in einem Buch an"],
    ["c18_anziehen", "s", "Hilft beim Anziehen: Arm in den Ärmel, Fuß hoch"],
    ["c18_woerter", "p", "Versucht drei oder mehr Wörter außer Mama und Papa"],
    ["c18_bitte", "p", "Folgt einfachen Bitten ohne Geste („Gib es mir“)"],
    ["c18_hausarbeit", "d", "Macht Hausarbeit nach, zum Beispiel Kehren"],
    ["c18_spielt", "d", "Spielt mit Spielzeug, schiebt zum Beispiel ein Auto"],
    ["c18_laeuft", "b", "Läuft frei, ohne sich festzuhalten"],
    ["kritzeln", "b", "Kritzelt"],
    ["c18_becher", "b", "Trinkt allein aus einem offenen Becher, auch wenn noch etwas danebengeht"],
    ["c18_finger", "b", "Isst selbst mit den Fingern"],
    ["loeffel", "b", "Versucht, mit dem Löffel zu essen"],
    ["c18_klettern", "b", "Klettert allein aufs Sofa und wieder hinunter"],
  ] },
  { m: 24, items: [
    ["c24_mitgefuehl", "s", "Merkt, wenn andere traurig sind oder sich wehgetan haben"],
    ["c24_schaut", "s", "Schaut in neuen Situationen zu dir, um zu sehen, wie du reagierst"],
    ["c24_buch", "p", "Zeigt im Buch auf Dinge, wenn du danach fragst"],
    ["zweiwort", "p", "Sagt zwei Wörter zusammen („mehr Milch“)"],
    ["c24_koerper", "p", "Zeigt auf mindestens zwei Körperteile, wenn du fragst"],
    ["c24_gesten", "p", "Nutzt Gesten wie Kusshand oder Nicken"],
    ["c24_haende", "d", "Hält etwas in einer Hand und arbeitet mit der anderen, etwa einen Deckel abschrauben"],
    ["c24_knoepfe", "d", "Probiert Schalter, Knöpfe und Tasten an Spielzeug aus"],
    ["c24_spielen", "d", "Spielt mit mehreren Sachen zusammen, etwa Essen auf den Spielteller"],
    ["c24_ball", "b", "Kickt einen Ball"],
    ["c24_rennt", "b", "Rennt"],
    ["treppe", "b", "Geht ein paar Stufen hinauf, mit oder ohne Hilfe"],
    ["c24_loeffel", "b", "Isst mit dem Löffel"],
  ] },
];

// WHO Motor Development Study (2006): Zeitfenster vom 1. bis zum 99. Perzentil in
// Monaten, gesunde Kinder aus fünf Ländern. Gilt nach korrigiertem Alter.
// [id, Symbol, Titel, von, bis]
const WHO = [
  ["sitzen", "🧘", "Sitzen ohne Hilfe", 3.8, 9.2],
  ["stehen_hilfe", "🧍", "Stehen mit Festhalten", 4.8, 11.4],
  ["krabbeln", "🐢", "Krabbeln auf Händen und Knien", 5.2, 13.5],
  ["gehen_hilfe", "🤝", "Gehen mit Festhalten", 5.9, 13.7],
  ["stehen_frei", "🙌", "Stehen ohne Festhalten", 6.9, 16.9],
  ["gehen", "👣", "Gehen ohne Festhalten", 8.2, 17.6],
];
const WHO_MAX = 18;

// Ein Name je id für Kalendertitel und Dialog — die Ersten Male haben die schönsten.
const INDEX = {};
const merk = (id, e, t) => { if (!INDEX[id]) INDEX[id] = { e, t }; };
FIRSTS.forEach(g => g.items.forEach(([id, e, t]) => merk(id, e, t)));
WHO.forEach(([id, e, t]) => merk(id, e, t));
CDC.forEach(b => b.items.forEach(([id, a, t]) => merk(id, AREAS[a][0], t)));

// Erlebnisse haben Geschwister meist gemeinsam: dort ist „Auch für …“ schon angehakt.
const GEMEINSAM = new Set(FIRSTS.find(g => g.g === "Erlebnisse").items.map(([id]) => id));

const CHEERS = ["Juhu!", "Hurra!", "Wie schön!", "Bravo!", "Wow!", "Großartig!"];
const CONFETTI = ["#F2B53A", "#F07C6C", "#6CB4EE", "#7CC9A0", "#F29BC4", "#B794F4"];
const JUBILAEEN = [10, 25, 50, 75, 100, 150];
const KIDCOLORS = ["#4A7A3A", "#7A4A78", "#3A6A8A", "#A0603A"];
const SECTIONS = ["firsts", "development", "motor"];
const TABS = { firsts: "✨ Erste Male", development: "🌱 Entwicklung", motor: "👣 Bewegung" };

class FpMilestoneCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.calendar) throw new Error("fp-milestone-card braucht calendar");
    this.config = Object.assign({
      title: "Meilensteine",
      kids: [{ key: "kind_a", name: "Kind A", color: "#4A7A3A" }],   // je Kind key, name, color, dazu birth und ga wie bei der fp-weight-card
      sections: SECTIONS,
      image_folder: "meilensteine",   // Unterordner im HA-Medienordner für die Fotos
    }, config);
    if (!Array.isArray(this.config.kids) || !this.config.kids.length) throw new Error("fp-milestone-card braucht mindestens ein Kind unter kids");
    // Fehlt eine Angabe, trotzdem etwas Sinnvolles zeigen statt einer kaputten Farbe.
    this.config.kids = this.config.kids.map((k, i) => Object.assign({}, k, {
      key: String(k.key || k.name || `kind_${i + 1}`), name: String(k.name || k.key || `Kind ${i + 1}`), color: k.color || KIDCOLORS[i % KIDCOLORS.length] }));
    const s = [].concat(this.config.sections || []).filter(x => SECTIONS.includes(x));
    this._secs = s.length ? s : SECTIONS;
    this._built = false; this._data = null; this._pend = []; this._hat = new Map(); this._sig = "";
    this._img = new Map();   // aufgelöste Foto-Adressen je media-source-ID, damit das häufige Neuzeichnen nicht jedes Mal nachfragt
    this._pfx = `fp-milestone:${this.config.calendar}`;
    this._kind = this._pref("kind", "");
    if (!this.config.kids.some(k => k.key === this._kind)) this._kind = this.config.kids[0].key;
    this._tab = this._pref("tab", "");
    if (!this._secs.includes(this._tab)) this._tab = this._secs[0];
    this._band = null;   // gewählte Altersstufe, null = die, die gerade dran ist
  }
  set hass(hass) {
    this._hass = hass;
    this.classList.toggle("fm-dark", !!(hass && hass.themes && hass.themes.darkMode));   // hell oder dunkel entscheidet das Gerät; am Host, damit auch der Dialog es sieht
    if (!this._built) { this._build(); this._load(); }
  }
  connectedCallback() { if (!this._timer) this._timer = setInterval(() => this._load(), 5 * 60000); }
  disconnectedCallback() { clearInterval(this._timer); this._timer = null; this._closeFull(); }

  // Gewähltes Kind und Bereich merken — reine Komfort-Einstellung.
  _pref(n, d) { try { return localStorage.getItem(`${this._pfx}:${n}`) || d; } catch (e) { return d; } }
  _setPref(n, v) { try { localStorage.setItem(`${this._pfx}:${n}`, v); } catch (e) { /* nur Komfort */ } }

  // ---------- Hilfen ----------
  _p(n) { return String(n).padStart(2, "0"); }
  _iso(d) { return `${d.getFullYear()}-${this._p(d.getMonth() + 1)}-${this._p(d.getDate())}`; }
  _day(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
  _heute() { return this._day(this._iso(new Date())); }
  _dm(d) { return `${d.getDate()}.${d.getMonth() + 1}.`; }
  _dmy(d) { return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; }
  _kid(key) { return this.config.kids.find(k => k.key === key) || this.config.kids[0]; }
  // Kinderfarbe als durchscheinende Fläche; Hex direkt, alles andere über color-mix.
  _tint(c, a) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
    let h = m[1]; if (h.length === 3) h = h.split("").map(x => x + x).join("");
    const n = parseInt(h, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  _farbe(el, c) {
    el.style.setProperty("--fm-k", c);
    el.style.setProperty("--fm-k1", this._tint(c, .12));
    el.style.setProperty("--fm-k2", this._tint(c, .24));
    el.style.setProperty("--fm-k3", this._tint(c, .36));
    // --fm-kt (Schrift und dünne Linien in Kinderfarbe) kommt aus dem CSS: hell die reine Farbe, im Dunkeln mit der Textfarbe aufgehellt.
  }
  _info(id, h) {
    if (id.startsWith("eigen_")) return { e: (h && h.e) || "✨", t: (h && h.t) || "Eigener Moment" };
    return INDEX[id] || { e: "⭐", t: id };
  }

  // ---------- Alter ----------
  // Tage, die ein Kind zu früh kam. Korrigiert wird ab drei Wochen vor dem Termin, wie bei der CDC.
  _frueh(kid) {
    if (!kid.ga) return 0;
    const [w, d] = String(kid.ga).split("+").map(Number), ga = (w || 40) * 7 + (d || 0);
    return ga < 259 ? 280 - ga : 0;
  }
  // Ab wann gezählt wird: die Geburt oder, korrigiert, der errechnete Termin.
  _basis(kid, korr) {
    if (!kid.birth) return null;
    const b = this._day(kid.birth);
    if (korr) b.setDate(b.getDate() + this._frueh(kid));
    return b;
  }
  // „mit 7 Monaten“ bzw. kurz „7 Mon.“
  _alter(kid, d, korr, kurz) {
    const b = this._basis(kid, korr); if (!b) return "";
    const tage = Math.round((d - b) / 86400000);
    if (tage < 0) return "";
    let m = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth();
    if (d.getDate() < b.getDate()) m--;
    const n = (x, e, mz) => `${x} ${x === 1 ? e : mz}`;
    if (tage === 0) return kurz ? "1. Tag" : "am ersten Tag";
    if (tage < 14) return kurz ? `${tage} T.` : `mit ${n(tage, "Tag", "Tagen")}`;
    if (m < 2) { const w = Math.floor(tage / 7); return kurz ? `${w} Wo.` : `mit ${n(w, "Woche", "Wochen")}`; }
    if (m < 24) return kurz ? `${m} Mon.` : `mit ${n(m, "Monat", "Monaten")}`;
    const j = Math.floor(m / 12), r = m % 12;
    return kurz ? `${j} J.${r ? ` ${r} M.` : ""}` : `mit ${n(j, "Jahr", "Jahren")}${r ? ` und ${n(r, "Monat", "Monaten")}` : ""}`;
  }
  _alterMon(kid, d) { const b = this._basis(kid, true); return b ? (d - b) / 86400000 / 30.4375 : null; }

  // ---------- Daten ----------
  _parse(ev) {
    let meta = {};
    try { meta = JSON.parse(ev.description || "{}") || {}; } catch (x) { meta = {}; }
    if (meta.typ !== "meilenstein" || !meta.id || !meta.kind) return null;   // fremde Termine im selben Kalender überspringen
    const start = (ev.start && (ev.start.date || ev.start.dateTime)) || ev.start;
    return { uid: ev.uid, kind: String(meta.kind), id: String(meta.id), date: this._day(start), ca: !!meta.ca,
      notiz: meta.notiz ? String(meta.notiz) : "", t: meta.t ? String(meta.t) : "", e: meta.e ? String(meta.e) : "",
      foto: typeof meta.foto === "string" && meta.foto.startsWith("media-source://") ? meta.foto : "" };   // nur Medienordner-IDs, nichts Fremdes laden
  }
  // Je Kind und Meilenstein zählt der früheste Eintrag; noch nicht gespeicherte stehen schon mit drin.
  _index() {
    const map = new Map();
    for (const e of [...(this._data || []), ...this._pend]) {
      const k = `${e.kind}|${e.id}`, alt = map.get(k);
      if (!alt || e.date < alt.date) map.set(k, e);
    }
    this._hat = map;
  }
  _get(kind, id) { return this._hat.get(`${kind}|${id}`) || null; }
  _zahl(kind) { let n = 0; for (const e of this._hat.values()) if (e.kind === kind) n++; return n; }

  async _load() {
    if (!this._hass) return;
    const bis = new Date(); bis.setDate(bis.getDate() + 2);
    try {
      const s = encodeURIComponent(new Date(2015, 0, 1).toISOString()), e = encodeURIComponent(bis.toISOString());
      const evts = await this._hass.callApi("GET", `calendars/${this.config.calendar}?start=${s}&end=${e}`);
      this._data = (Array.isArray(evts) ? evts : []).map(x => this._parse(x)).filter(x => x && !isNaN(x.date));
    } catch (err) {
      if (this._loadedOnce) U.toast(this, "Meilensteine konnten nicht geladen werden");
      this._data = this._data || [];
    }
    this._loadedOnce = true;   // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._index();
    this._paint();
  }

  _ev(kind, id, x) {
    const info = this._info(id, x), meta = { typ: "meilenstein", kind, id };
    if (x.ca) meta.ca = true;
    if (x.notiz) meta.notiz = x.notiz;
    if (x.foto) meta.foto = x.foto;
    if (id.startsWith("eigen_")) { meta.t = info.t; meta.e = info.e; }
    return { summary: `${info.e} ${this._kid(kind).name}: ${info.t}`, description: JSON.stringify(meta) };
  }
  // Erscheint sofort (optimistisch), der Kalender zieht nach.
  async _create(kind, id, date, x) {
    const tmp = { uid: `tmp-${Math.random()}`, kind, id, date, ca: !!x.ca, notiz: x.notiz || "", t: x.t || "", e: x.e || "", foto: x.foto || "" };
    this._pend.push(tmp);
    const d = this._ev(kind, id, x), nach = new Date(date); nach.setDate(nach.getDate() + 1);
    try {
      await this._hass.callService("calendar", "create_event", {
        entity_id: this.config.calendar, summary: d.summary, description: d.description,
        start_date: this._iso(date), end_date: this._iso(nach),
      });
      return true;
    } catch (e) { U.toast(this, "Konnte nicht gespeichert werden – bitte nochmal versuchen"); return false; }
    finally { this._pend = this._pend.filter(p => p !== tmp); }
  }
  async _delete(uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this.config.calendar, uid }); return true; }
    catch (e) { if (!leise) U.toast(this, "Eintrag konnte nicht gelöscht werden"); return false; }
  }
  async _update(alt, date, x) {
    const d = this._ev(alt.kind, alt.id, x), nach = new Date(date); nach.setDate(nach.getDate() + 1);
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: this.config.calendar, uid: alt.uid,
        event: { summary: d.summary, description: d.description, dtstart: this._iso(date), dtend: this._iso(nach) } });
      return true;
    } catch (e) {
      // Rückfall wie bei Gewicht und Stillprotokoll: neu anlegen, dann alt löschen — und laut sagen, falls der alte bleibt.
      if (!(await this._create(alt.kind, alt.id, date, x))) return false;
      if (!(await this._delete(alt.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  // ---------- Fotos ----------
  // Ein Foto je Meilenstein, wie im Kochbuch: verkleinert in den Medienordner laden, im Eintrag steht nur die
  // media-source-ID. Zum Anzeigen braucht jede ID eine signierte Adresse — die wird einmal geholt und fast
  // einen Tag gemerkt, sonst fragte jedes Neuzeichnen der Karte neu nach und die Bilder flackerten.
  _fotoUrl(src) {
    const t = Date.now(), c = this._img.get(src);
    if (c && c.until > t) return c.p;
    const c2 = { url: "", fail: false, until: t + 82800000 };
    c2.p = this._hass.callWS({ type: "media_source/resolve_media", media_content_id: src, expires: 86400 })
      .then(r => (c2.url = r.url))
      .catch(err => { c2.fail = true; c2.until = Date.now() + 60000; throw err; });   // nach einer Minute nochmal versuchen
    this._img.set(src, c2);
    return c2.p;
  }
  // Ein Bild-Tag; ist die Adresse schon bekannt, steht sie gleich drin (kein Flackern), sonst setzt _fillImgs sie nach dem Zeichnen.
  // fb = Symbol, das an die Stelle tritt, falls das Foto sich nicht laden lässt; ohne fb verschwindet das Bild einfach.
  _foto(src, cls, fb) {
    const c = this._img.get(src), url = c && !c.fail && c.until > Date.now() ? c.url : "";
    return `<img class="${cls}" data-img="${U.esc(src)}"${fb ? ` data-fb="${U.esc(fb)}"` : ""}${url ? ` src="${U.esc(url)}"` : ""} alt="">`;
  }
  _fillImgs(root) {
    root.querySelectorAll("img[data-img]").forEach(img => {
      const src = img.dataset.img;
      img.addEventListener("error", () => {   // Adresse abgelaufen oder Datei weg: eine Minute lang nicht erneut versuchen
        const p = Promise.reject(new Error("img")); p.catch(() => {});
        this._img.set(src, { url: "", fail: true, until: Date.now() + 60000, p });
        this._noImg(img);
      }, { once: true });
      if (img.getAttribute("src")) return;
      this._fotoUrl(src).then(u => { if (img.isConnected) img.src = u; }).catch(() => this._noImg(img));
    });
  }
  _noImg(img) {
    if (!img.isConnected) return;
    if (img.dataset.fb) { const s = document.createElement("span"); s.className = "fm-st-e"; s.textContent = img.dataset.fb; img.replaceWith(s); }
    else img.remove();
  }
  // Foto verkleinern (lange Seite 1280 px, JPEG) und hochladen; liefert die media-source-ID.
  async _uploadFoto(file, id, tag) {
    const url = URL.createObjectURL(file), fehler = code => Object.assign(new Error(code), { code });
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.84));
      if (!blob) throw fehler("bild");
      // Dateiname ohne Namen von Personen: Meilenstein, Tag und eine Zufallsmarke
      const slug = String(id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "moment";
      const fd = new FormData();
      fd.append("media_content_id", `media-source://media_source/local/${this.config.image_folder}`);
      fd.append("file", blob, `${slug}-${tag}-${Date.now().toString(36)}.jpg`);
      const res = await this._hass.fetchWithAuth("/api/media_source/local_source/upload", { method: "POST", body: fd });
      if (res.status === 401 || res.status === 403) throw fehler("admin");
      if (res.status === 400) throw fehler("ordner");
      if (!res.ok) throw fehler("upload");
      const j = await res.json();
      if (!j || !j.media_content_id) throw fehler("upload");
      return j.media_content_id;
    } finally { URL.revokeObjectURL(url); }
  }
  // Ein hochgeladenes, aber nie gespeichertes Foto wieder aus dem Medienordner räumen. Gespeicherte Fotos fasst das
  // nie an: dieselbe ID kann bei Geschwistern am Eintrag hängen. Schlägt das Löschen fehl, bleibt eben eine Datei liegen.
  async _verwerfeFoto(ref) {
    this._img.delete(ref);
    try { await this._hass.callWS({ type: "media_source/local_source/remove", media_content_id: ref }); } catch (e) { /* bleibt liegen */ }
  }
  // Foto bildschirmfüllend; ein Tipp oder Escape schließt es wieder.
  _vollbild(src) {
    this._closeFull();
    const f = document.createElement("div");
    f.className = "fm-full";
    f.innerHTML = `${this._foto(src, "fm-full-img")}<button class="fm-full-x" aria-label="Schließen">✕</button>`;
    f.addEventListener("click", () => this._closeFull());
    U.lightbox(this, f, () => this._closeFull()); this._full = f;   // eigener Dialog über dem Blatt (das Blatt ist selbst modal)
    this._fillImgs(f);
    this._fullKey = ev => { if (ev.key === "Escape") { ev.stopPropagation(); ev.preventDefault(); this._closeFull(); } };
    document.addEventListener("keydown", this._fullKey, true);
  }
  _closeFull() {
    if (!this._full) return;
    this._full.remove(); this._full = null;
    document.removeEventListener("keydown", this._fullKey, true);
  }

  // ---------- Aufbau ----------
  _build() {
    this._built = true;
    this.innerHTML = `
      <ha-card class="fm-card">
        <div class="fm-head"><div class="fm-title">${U.esc(this.config.title)}</div><div class="fm-count"></div></div>
        <div class="fm-kids"></div>
        <div class="fm-tabs"></div>
        <div class="fm-body"></div>
      </ha-card>${this._styles()}`;
    this.querySelector(".fm-kids").addEventListener("click", ev => {
      const b = ev.target.closest("[data-kind]"); if (!b || b.dataset.kind === this._kind) return;
      this._kind = b.dataset.kind; this._setPref("kind", this._kind); this._band = null; this._paint(true);
    });
    this.querySelector(".fm-tabs").addEventListener("click", ev => {
      const b = ev.target.closest("[data-tab]"); if (!b) return;
      this._tab = b.dataset.tab; this._setPref("tab", this._tab); this._paint(true);
    });
    this.querySelector(".fm-body").addEventListener("click", ev => {
      const band = ev.target.closest("[data-band]");
      if (band) { this._band = Number(band.dataset.band); this._paint(true); return; }
      if (ev.target.closest(".fm-add")) { this._openSheet({ id: "", custom: true, src: ev.target.closest(".fm-add") }); return; }
      const t = ev.target.closest("[data-id]"); if (!t) return;
      const h = this._get(this._kind, t.dataset.id);
      if (!h) this._burst(t, 10, true);   // schon beim Antippen ein kleines Funkeln
      this._openSheet({ id: t.dataset.id, label: t.dataset.label || "", edit: h, custom: t.dataset.id.startsWith("eigen_"), src: t });
    });
  }

  _paint(force) {
    if (!this._built || !this._data) return;
    // Ohne uid: wird aus dem vorläufigen Eintrag der echte, bleibt alles stehen und der Sticker hüpft zu Ende.
    const sig = JSON.stringify([this._kind, this._tab, this._band, this._iso(new Date()),
      [...this._hat.values()].map(e => [e.kind, e.id, +e.date, e.ca, e.notiz, e.t, e.e, e.foto])]);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    const kid = this._kid(this._kind);
    this._farbe(this, kid.color);   // am Host: der Dialog hängt daneben und braucht die Farbe auch
    this._paintHead(kid);
    const body = this.querySelector(".fm-body");
    body.innerHTML = this._tab === "development" ? this._htmlDev(kid) : this._tab === "motor" ? this._htmlMotor(kid) : this._htmlFirsts(kid);
    this._fillImgs(body);
    // Am Handy passt die Leiste der Altersstufen nicht ganz drauf: die gewählte in die Mitte holen.
    const leiste = body.querySelector(".fm-bands"), sel = leiste && leiste.querySelector(".fm-sel");
    if (sel && leiste.scrollWidth > leiste.clientWidth) leiste.scrollLeft = sel.offsetLeft - (leiste.clientWidth - sel.offsetWidth) / 2;
  }

  _paintHead(kid) {
    const n = this._zahl(kid.key);
    this.querySelector(".fm-count").innerHTML = n ? `⭐ <b>${n}</b> ${n === 1 ? "Moment" : "Momente"}` : "";
    const kids = this.config.kids;
    this.querySelector(".fm-kids").innerHTML = kids.length < 2 ? "" : kids.map(k => {
      const alt = k.birth ? this._alter(k, this._heute(), false, true) : "";
      return `<button class="fm-kid${k.key === kid.key ? " fm-sel" : ""}" data-kind="${U.esc(k.key)}" style="--c:${U.esc(k.color)};--c1:${this._tint(k.color, .14)}">
        <span class="fm-av" style="background:${U.esc(k.color)}">${U.esc(String(k.name).slice(0, 1))}</span>${U.esc(k.name)}${alt ? `<span class="fm-kage">${alt}</span>` : ""}</button>`;
    }).join("");
    this.querySelector(".fm-tabs").innerHTML = this._secs.length < 2 ? "" : this._secs.map(s =>
      `<button class="${s === this._tab ? "fm-sel" : ""}" data-tab="${s}">${TABS[s]}</button>`).join("");
  }

  // Kleine Punkte in den Farben der anderen Kinder, die das schon haben — für Geschwister und Zwillinge.
  _andere(kid, id) {
    const o = this.config.kids.filter(k => k.key !== kid.key && this._get(k.key, id));
    return o.length ? `<span class="fm-others">${o.map(k => `<span class="fm-od" style="background:${U.esc(k.color)}" title="${U.esc(k.name)}">${U.esc(String(k.name).slice(0, 1))}</span>`).join("")}</span>` : "";
  }

  // ---------- Erste Male ----------
  _htmlFirsts(kid) {
    const gruppe = (titel, sym, items, extra) => {
      const n = items.filter(it => this._get(kid.key, it.id)).length;
      return `<div class="fm-grp"><div class="fm-gh"><span>${sym} ${U.esc(titel)}</span>${n ? `<span class="fm-gn">⭐ ${n}</span>` : ""}</div>
        <div class="fm-stickers">${items.map(it => this._sticker(kid, it)).join("")}${extra || ""}</div></div>`;
    };
    const eigene = [...this._hat.values()].filter(e => e.kind === kid.key && e.id.startsWith("eigen_"))
      .sort((a, b) => a.date - b.date).map(e => ({ id: e.id, ...this._info(e.id, e) }));
    const tipp = this._zahl(kid.key) ? "" : `<div class="fm-hint">Tipp auf einen Moment, sobald er passiert – oder trag ihn nachträglich mit Datum ein. ✨</div>`;
    return tipp + FIRSTS.map(g => gruppe(g.g, g.e, g.items.map(([id, e, t]) => ({ id, e, t })))).join("")
      + gruppe("Eigene Momente", "✨", eigene, `<button class="fm-st fm-add"><span class="fm-st-e">＋</span><span class="fm-st-t">Eigener Moment</span></button>`);
  }
  _sticker(kid, it) {
    const h = this._get(kid.key, it.id);
    const wann = h ? `${h.ca ? "ca. " : ""}${this._alter(kid, h.date, false, true) || this._dm(h.date)}` : "";
    return `<button class="fm-st${h ? " fm-on" : ""}" data-id="${U.esc(it.id)}" data-label="${U.esc(it.t)}" aria-pressed="${h ? "true" : "false"}"${h ? ` title="${U.esc(`${it.t}: ${this._dmy(h.date)}`)}"` : ""}>
      ${h ? `<span class="fm-st-star">⭐</span>` : ""}${this._andere(kid, it.id)}
      ${h && h.foto ? this._foto(h.foto, "fm-st-ph", it.e) : `<span class="fm-st-e">${U.esc(it.e)}</span>`}<span class="fm-st-t">${U.esc(it.t)}</span>${h ? `<span class="fm-st-d">${wann}</span>` : ""}</button>`;
  }

  // ---------- Entwicklung ----------
  // Die Stufe, die gerade dran ist: die nächste ab dem (korrigierten) Alter, mit einem halben Monat Spielraum.
  // Ohne Geburtsdatum die erste, in der noch etwas offen ist.
  _aktBand(kid) {
    const m = this._alterMon(kid, this._heute());
    if (m == null) { const b = CDC.find(b => b.items.some(([id]) => !this._get(kid.key, id))); return (b || CDC[CDC.length - 1]).m; }
    const b = CDC.find(b => b.m >= m - 0.5);
    return (b || CDC[CDC.length - 1]).m;
  }
  _bandKurz(m) { return m < 24 ? `${m} Mon.` : `${m / 12} Jahre`; }
  _bandLang(m) { return m < 24 ? `${m} Monaten` : `${m / 12} Jahren`; }
  _htmlDev(kid) {
    const akt = this._aktBand(kid), band = CDC.some(b => b.m === this._band) ? this._band : akt;
    const stufe = CDC.find(b => b.m === band);
    const chips = CDC.map(b => {
      const n = b.items.filter(([id]) => this._get(kid.key, id)).length;
      return `<button class="fm-band${b.m === band ? " fm-sel" : ""}" data-band="${b.m}">${b.m === akt ? `<span class="fm-jetzt">jetzt</span>` : ""}${this._bandKurz(b.m)}${
        n === b.items.length ? " 🎉" : n ? ` <small>⭐${n}</small>` : ""}</button>`;
    }).join("");
    const n = stufe.items.filter(([id]) => this._get(kid.key, id)).length;
    let html = `<div class="fm-bands">${chips}</div>
      <div class="fm-bandhead"><div class="fm-bt">Mit etwa ${this._bandLang(band)}</div>${band === akt ? `<div class="fm-bs">🌱 Das wird gerade spannend</div>` : ""}</div>`;
    if (n === stufe.items.length) html += `<div class="fm-alles">🎉 Alles entdeckt – wie schön!</div>`;
    for (const a of Object.keys(AREAS)) {
      const items = stufe.items.filter(it => it[1] === a);
      if (items.length) html += `<div class="fm-area"><div class="fm-gh"><span>${AREAS[a][0]} ${AREAS[a][1]}</span></div>${items.map(([id, , t]) => this._row(kid, id, t)).join("")}</div>`;
    }
    const korr = this._frueh(kid) && kid.birth ? ` „Jetzt“ richtet sich nach dem korrigierten Alter (${this._alter(kid, this._heute(), true, true)}).` : "";
    return html + `<div class="fm-quelle">Nach den Checklisten der CDC (2022): Das können die meisten Kinder bis zu diesem Alter. Viele brauchen etwas länger – jedes Kind hat sein eigenes Tempo.${korr}</div>`;
  }
  _row(kid, id, t) {
    const h = this._get(kid.key, id);
    return `<button class="fm-row${h ? " fm-on" : ""}" data-id="${U.esc(id)}" data-label="${U.esc(t)}" aria-pressed="${h ? "true" : "false"}">
      <span class="fm-bub">${h ? "✓" : ""}</span><span class="fm-rt">${U.esc(t)}</span>${this._andere(kid, id)}${h && h.foto ? this._foto(h.foto, "fm-mini") : ""}${h ? `<span class="fm-rd">${h.ca ? "ca. " : ""}${this._dm(h.date)}</span>` : ""}</button>`;
  }

  // ---------- Bewegung ----------
  _htmlMotor(kid) {
    const pos = m => `${(Math.max(0, Math.min(WHO_MAX, m)) / WHO_MAX * 100).toFixed(2)}%`;
    // Die Heute-Linie steht immer, sobald das Alter bekannt ist. Vor dem errechneten Termin
    // (korrigiertes Alter unter 0) steht sie am linken Rand, nach 18 Monaten am rechten.
    const jetzt = this._alterMon(kid, this._heute());
    const jx = jetzt == null ? null : Math.max(0, Math.min(WHO_MAX, jetzt));
    const now = jx != null ? `<span class="fm-now" style="left:${pos(jx)}"></span>` : "";
    const rows = WHO.map(([id, e, t, lo, hi]) => {
      const h = this._get(kid.key, id);
      // Der eigene Punkt zuletzt, damit er oben liegt.
      const dots = this.config.kids.slice().sort((a, b) => (a.key === kid.key) - (b.key === kid.key)).map(k => {
        const x = this._get(k.key, id), m = x && this._alterMon(k, x.date);
        if (m == null || m < 0) return "";
        return `<span class="fm-dot${k.key === kid.key ? " fm-me" : ""}" style="left:${pos(m)};background:${U.esc(k.color)}" title="${U.esc(`${k.name}: ${this._dmy(x.date)}`)}">${U.esc(String(k.name).slice(0, 1))}</span>`;
      }).join("");
      return `<button class="fm-mo${h ? " fm-on" : ""}" data-id="${id}" data-label="${U.esc(t)}" aria-pressed="${h ? "true" : "false"}">
        <span class="fm-ml"><span class="fm-mi">${e}</span><span class="fm-mt">${U.esc(t)}</span>${h ? `<span class="fm-md">⭐ ${h.ca ? "ca. " : ""}${this._dm(h.date)}</span>` : ""}${h && h.foto ? this._foto(h.foto, "fm-mini") : ""}</span>
        <span class="fm-track"><span class="fm-win" style="left:${pos(lo)};width:${pos(hi - lo)}"></span>${now}${dots}</span></button>`;
    }).join("");
    // Zahlen, die mit „heute“ zusammenstoßen würden, fallen weg; am Rand steht „heute“ bündig statt mittig.
    const ticks = [0, 3, 6, 9, 12, 15, 18].filter(m => jx == null || Math.abs(m - jx) >= 1).map(m => `<span style="left:${pos(m)}">${m}</span>`).join("")
      + (jx != null ? `<span class="fm-nowl" style="left:${pos(jx)};transform:translateX(${jx < .7 ? "0" : jx > WHO_MAX - .7 ? "-100%" : "-50%"})">heute</span>` : "");
    const korr = this._frueh(kid) && kid.birth ? ", nach korrigiertem Alter" : "";
    const linie = jx == null ? "" : jetzt < 0 ? ", die Linie steht bei heute (noch vor dem errechneten Termin)" : ", die Linie steht bei heute";
    return `<div class="fm-motor">${rows}<div class="fm-axis"><span class="fm-axl">Monate</span><span class="fm-ticks">${ticks}</span></div></div>
      <div class="fm-quelle">Farbiges Feld: In dieser Zeit lernen es gesunde Kinder – so breit ist die Spanne (WHO-Motorikstudie, 1.–99. Perzentil). Punkte zeigen, wann es so weit war${korr}${linie}.</div>`;
  }

  // ---------- Feiern ----------
  _bewegungArm() { try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  // Konfetti aus einem Element heraus: bunte Schnipsel, ab und zu ein Stern oder das Symbol.
  _burst(src, n, klein, sym) {
    if (this._bewegungArm()) return;
    const fx = document.createElement("div"); fx.className = "fm-fx"; this.appendChild(fx);
    // Relativ zur Ebene selbst rechnen: liegt ein Vorfahr mit transform darüber, ist „fixed“ nicht mehr das Fenster.
    const r = (src && src.isConnected ? src : this).getBoundingClientRect(), f = fx.getBoundingClientRect();
    const x0 = r.left - f.left + r.width / 2, y0 = r.top - f.top + r.height / 2;
    const farben = [this._kid(this._kind).color, ...CONFETTI];
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      if (!s.animate) break;
      if (!klein && i % 6 === 0) { s.className = "fm-cf fm-cf-e"; s.textContent = sym && i % 12 === 0 ? sym : ["⭐", "💛", "✨"][i % 3]; }
      else {
        s.className = "fm-cf"; s.style.background = farben[i % farben.length];
        const w = 6 + Math.random() * 6; s.style.width = `${w}px`; s.style.height = `${Math.random() < .5 ? w : w * .45}px`;
        if (Math.random() < .35) s.style.borderRadius = "50%";
      }
      s.style.left = `${x0}px`; s.style.top = `${y0}px`;
      fx.appendChild(s);
      const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.4;   // überwiegend nach oben
      const v = (klein ? 40 : 110) + Math.random() * (klein ? 50 : 170);
      const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v, fall = (klein ? 40 : 160) + Math.random() * 140;
      const rot = (Math.random() - .5) * 720, dur = (klein ? 650 : 1300) + Math.random() * 700;
      s.animate([
        { transform: "translate(-50%,-50%) scale(.5)", opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: .35 },
        { transform: `translate(-50%,-50%) translate(${dx * 1.3}px,${dy + fall}px) rotate(${rot}deg) scale(.85)`, opacity: 0 },
      ], { duration: dur, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" });
    }
    setTimeout(() => fx.remove(), 2400);
  }
  _feiern(id, kids) {
    const kid = this._kid(this._kind);
    const el = this.querySelector(`.fm-body [data-id="${CSS.escape(id)}"]`);
    if (el) { el.classList.add("fm-pop"); if (!this._bewegungArm()) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    this._burst(el, 44, false, this._info(id, this._get(kid.key, id)).e);
    const c = this.querySelector(".fm-count");
    if (c) { c.classList.remove("fm-bump"); void c.offsetWidth; c.classList.add("fm-bump"); }
    try { if (navigator.vibrate) navigator.vibrate([18, 40, 28]); } catch (e) { /* nicht überall */ }
    const voll = CDC.find(b => b.items.some(([x]) => x === id) && b.items.every(([x]) => this._get(kid.key, x)));
    if (voll) { U.toast(this, `🎉 Alles aus „${this._bandKurz(voll.m)}“ entdeckt – toll, ${kid.name}!`); return; }
    for (const k of kids) {
      const n = this._zahl(k);
      if (JUBILAEEN.includes(n)) { U.toast(this, `🏆 Schon ${n} Momente mit ${this._kid(k).name} gesammelt!`); break; }
    }
  }

  // ---------- Dialog ----------
  _closeOv() {
    this._closeFull();
    if (!this._ov) return;
    const o = this._ov; this._ov = null; o.remove();
    if (o._aufraeumen) o._aufraeumen();   // ein noch ungespeichertes, gerade hochgeladenes Foto verwerfen
  }
  _openSheet({ id, label, edit, custom }) {
    this._closeOv();
    const kid = this._kid(this._kind), e = edit || null, info = this._info(id || "eigen_", e);
    const titel = custom ? (e ? info.t : "Eigener Moment") : (label || info.t);
    const andere = this.config.kids.filter(k => k.key !== kid.key);
    const schon = id ? andere.map(k => ({ k, h: this._get(k.key, id) })).filter(x => x.h) : [];
    const frei = e ? [] : andere.filter(k => !id || !this._get(k.key, id));   // „auch für …“ nur, wer es noch nicht hat
    const heute = this._heute(), gestern = new Date(heute); gestern.setDate(gestern.getDate() - 1);
    const minD = kid.birth ? this._iso(this._day(kid.birth)) : "";
    const ov = document.createElement("div");
    ov.className = "fm-ov";
    ov.innerHTML = `<div class="fm-sheet" role="dialog" aria-label="${U.esc(titel)}">
      <div class="fm-sh-top">
        <span class="fm-spark" style="left:12%;top:20%">✨</span><span class="fm-spark" style="right:13%;top:14%;animation-delay:.5s">⭐</span><span class="fm-spark" style="right:24%;bottom:18%;animation-delay:1s">✨</span>
        <div class="fm-sh-e">${U.esc(info.e)}</div>
        <div class="fm-sh-cheer">${e ? "Erinnerung" : custom ? "Ein besonderer Moment" : CHEERS[Math.floor(Math.random() * CHEERS.length)]}</div>
        <div class="fm-sh-t">${U.esc(kid.name)} · ${U.esc(titel)}</div>
        ${schon.map(x => `<div class="fm-sh-other"><span class="fm-od" style="background:${U.esc(x.k.color)}">${U.esc(String(x.k.name).slice(0, 1))}</span>Bei ${U.esc(x.k.name)} war’s am ${this._dmy(x.h.date)}</div>`).join("")}
      </div>
      <div class="fm-sh-body">
        <div class="fm-gbox"></div>
        ${custom ? `<div class="fm-two"><label class="fm-emo"><span class="fm-lbl">Symbol</span><input class="fm-in fm-e" maxlength="12" value="${U.esc(e ? info.e : "✨")}"></label>
          <label class="fm-grow"><span class="fm-lbl">Was ist passiert?</span><input class="fm-in fm-t" maxlength="60" placeholder="z. B. Erstes Mal im Tiergarten" value="${e ? U.esc(info.t) : ""}"></label></div>` : ""}
        <span class="fm-lbl">Wann war’s?</span>
        <div class="fm-when"><button data-d="${this._iso(heute)}">Heute</button><button data-d="${this._iso(gestern)}">Gestern</button>
          <input class="fm-in fm-datum" type="date" value="${this._iso(e ? e.date : heute)}" max="${this._iso(heute)}"${minD ? ` min="${minD}"` : ""}></div>
        <div class="fm-age"></div>
        <label class="fm-check"><input type="checkbox" class="fm-ca"${e && e.ca ? " checked" : ""}> Datum nur ungefähr</label>
        ${frei.map(k => `<label class="fm-check"><input type="checkbox" class="fm-also" value="${U.esc(k.key)}"${GEMEINSAM.has(id) ? " checked" : ""}> Auch für ${U.esc(k.name)} festhalten</label>`).join("")}
        <span class="fm-lbl">Notiz <span class="fm-opt">– wenn du magst</span></span>
        <textarea class="fm-in fm-notiz" rows="2" maxlength="500" placeholder="Wo wart ihr? Was war lustig?">${e ? U.esc(e.notiz) : ""}</textarea>
        <span class="fm-lbl">Foto <span class="fm-opt">– wenn du magst</span></span>
        <div class="fm-foto"></div>
      </div>
      <div class="fm-foot">${e ? `<button class="fm-btn fm-del">Nicht mehr abhaken</button>` : ""}<span class="fm-flex"></span>
        <button class="fm-btn fm-cancel">${e ? "Schließen" : "Abbrechen"}</button><button class="fm-btn fm-ok">${e ? "Speichern" : "Festhalten ✨"}</button></div>
    </div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov) this._closeOv(); });
    U.lightbox(this, ov, () => this._closeOv()); this._ov = ov;
    const datum = ov.querySelector(".fm-datum"), ageEl = ov.querySelector(".fm-age");
    const zeig = () => {
      ov.querySelectorAll(".fm-when button").forEach(b => b.classList.toggle("fm-sel", b.dataset.d === datum.value));
      if (!datum.value) { ageEl.textContent = ""; return; }
      const d = this._day(datum.value), a = this._alter(kid, d, false, false), k = this._frueh(kid) ? this._alter(kid, d, true, true) : "";
      ageEl.textContent = a ? `${a}${k && k !== this._alter(kid, d, false, true) ? ` · korrigiert ${k}` : ""}` : "";
    };
    ov.querySelectorAll(".fm-when button").forEach(b => b.addEventListener("click", () => { datum.value = b.dataset.d; zeig(); }));
    datum.addEventListener("change", zeig); datum.addEventListener("input", zeig);
    zeig();
    if (custom && !e) setTimeout(() => ov.querySelector(".fm-t").focus(), 50);

    // Foto: wird sofort beim Auswählen hochgeladen, der Verweis im Eintrag aber erst mit „Speichern“ festgehalten.
    // neu = Foto, das erst in diesem Dialog hochgeladen wurde und noch an keinem Eintrag hängt: bei Abbruch, Tausch
    // oder Entfernen wird es wieder gelöscht. Ein schon gespeichertes Foto bleibt dagegen immer liegen (siehe _verwerfeFoto).
    let foto = e ? e.foto : "", neu = "", laedt = false;
    let gross = !!foto;   // eine Erinnerung mit Foto zeigt es groß oben; die Vorschau unten gibt es dann nicht doppelt
    const fotoBox = ov.querySelector(".fm-foto"), grossBox = ov.querySelector(".fm-gbox");
    const fotoZeigen = () => {
      grossBox.innerHTML = foto && gross ? this._foto(foto, "fm-gfoto") : "";
      fotoBox.innerHTML = `${foto && !gross ? this._foto(foto, "fm-vorschau") : ""}<div class="fm-fotoact">${laedt
        ? `<span class="fm-btn fm-busy">⏳ Lädt hoch …</span>`
        : `<label class="fm-btn fm-fbtn">${foto ? "Tauschen" : "📷 Foto"}<input type="file" accept="image/*" hidden></label>${foto ? `<button type="button" class="fm-btn fm-fdel">Entfernen</button>` : ""}`}</div>`;
      this._fillImgs(grossBox); this._fillImgs(fotoBox);
    };
    const fotoFehler = err => U.toast(this, err && err.code === "admin" ? "Hochladen geht nur mit einem Admin-Konto"
      : err && err.code === "ordner" ? `Ordner „${this.config.image_folder}“ fehlt im Medienordner – bitte einmal anlegen` : "Foto konnte nicht hochgeladen werden");
    const fotoWahl = async file => {
      laedt = true; fotoZeigen();
      let ref = "";
      try {
        const tag = /^\d{4}-\d{2}-\d{2}$/.test(datum.value) ? datum.value : this._iso(heute);
        ref = await this._uploadFoto(file, id, tag);
      } catch (err) { laedt = false; if (this._ov === ov) { fotoZeigen(); fotoFehler(err); } return; }
      if (this._ov !== ov) { this._verwerfeFoto(ref); return; }   // Dialog wurde währenddessen geschlossen
      if (neu) this._verwerfeFoto(neu);   // ein zuvor in diesem Dialog hochgeladenes Foto ist jetzt überholt
      foto = neu = ref; laedt = false; fotoZeigen();
    };
    fotoBox.addEventListener("change", ev => {
      const f = ev.target.files && ev.target.files[0];
      if (f && ev.target.matches("input[type=file]")) fotoWahl(f);
    });
    fotoBox.addEventListener("click", ev => {
      if (ev.target.closest(".fm-fdel")) {
        if (neu) { this._verwerfeFoto(neu); neu = ""; }
        foto = ""; gross = false; fotoZeigen();
      } else if (ev.target.closest(".fm-vorschau")) this._vollbild(foto);
    });
    grossBox.addEventListener("click", () => { if (foto) this._vollbild(foto); });
    ov._aufraeumen = () => { if (neu) { this._verwerfeFoto(neu); neu = ""; } };
    fotoZeigen();

    ov.querySelector(".fm-cancel").addEventListener("click", () => this._closeOv());
    if (e) ov.querySelector(".fm-del").addEventListener("click", async () => {
      if (!window.confirm(`${kid.name}: „${titel}“ nicht mehr abhaken?`)) return;
      this._closeOv();   // räumt auch ein neu hochgeladenes Foto ab; das gespeicherte bleibt (kann bei Geschwistern hängen)
      const alle = (this._data || []).filter(x => x.kind === e.kind && x.id === e.id);   // Duplikate gleich mit
      for (const x of alle) await this._delete(x.uid);
      this._load();
    });
    ov.querySelector(".fm-ok").addEventListener("click", async () => {
      if (laedt) { U.toast(this, "Das Foto lädt noch hoch – einen Moment"); return; }
      if (!datum.value) { U.toast(this, "Bitte ein Datum wählen"); return; }
      const d = this._day(datum.value);
      if (d > heute) { U.toast(this, "Das Datum liegt in der Zukunft"); return; }
      if (kid.birth && d < this._day(kid.birth)) { U.toast(this, "Das Datum liegt vor der Geburt"); return; }
      const x = { ca: ov.querySelector(".fm-ca").checked, notiz: ov.querySelector(".fm-notiz").value.trim(), foto };
      let mid = id;
      if (custom) {
        x.t = ov.querySelector(".fm-t").value.trim(); x.e = ov.querySelector(".fm-e").value.trim() || "✨";
        if (!x.t) { U.toast(this, "Wie soll der Moment heißen?"); return; }
        if (!mid) mid = `eigen_${Date.now().toString(36)}`;
      }
      const auch = [...ov.querySelectorAll(".fm-also:checked")].map(c => c.value);
      const eigenes = neu; neu = "";   // hängt gleich am Eintrag, _closeOv soll es nicht mehr löschen
      this._closeOv();
      // Klappt das Speichern nicht, hängt das neue Foto an nichts: dann weg damit.
      if (e) { if (await this._update(e, d, x)) this._load(); else if (eigenes) this._verwerfeFoto(eigenes); return; }
      const kids = [kid.key, ...auch];
      const jobs = kids.map(k => this._create(k, mid, d, x));   // legt die Einträge sofort vorläufig an; alle teilen sich dasselbe Foto
      this._index(); this._paint(true); this._feiern(mid, kids);
      const ok = await Promise.all(jobs);
      if (ok.includes(false)) { this._index(); this._paint(true); }
      if (eigenes && !ok.includes(true)) this._verwerfeFoto(eigenes);
      this._load();
    });
  }

  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .fm-card,.fm-ov{--fm-kt:var(--fm-k);--fm-s:var(--fp-surface,var(--secondary-background-color));--fm-s2:var(--fp-surface-2,var(--divider-color));
        --fm-r:var(--fp-radius,16px);--fm-rs:var(--fp-radius-sm,12px);}
      /* fm-dark (am Host, folgt hass.themes.darkMode): --fm-kt, die Kinderfarbe für Schrift und dünne Linien, wird mit der Textfarbe aufgehellt,
         sonst ist das dunkle Grün oder Lila auf dunklem Grund unlesbar. Flächen und Punkte bleiben in der reinen Kinderfarbe (--fm-k). */
      .fm-dark .fm-card,.fm-dark .fm-ov{--fm-kt:color-mix(in srgb,var(--fm-k) 55%,var(--primary-text-color));}
      .fm-card{padding:16px 16px 14px;container-type:inline-size;}
      .fm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
      .fm-title{font-size:1.25rem;font-weight:700;letter-spacing:-.01em;}
      .fm-count{font-size:.9rem;font-weight:600;color:var(--fm-kt,var(--fm-k));background:var(--fm-k1);border-radius:999px;padding:5px 12px;white-space:nowrap;}
      .fm-count:empty{display:none;}
      .fm-bump{animation:fm-bump .6s cubic-bezier(.3,1.6,.5,1);}
      @keyframes fm-bump{40%{transform:scale(1.25);}}
      .fm-kids{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;} .fm-kids:empty{display:none;}
      .fm-kid{display:flex;align-items:center;gap:8px;border:2px solid transparent;border-radius:999px;padding:3px 14px 3px 3px;cursor:pointer;
        --ct:var(--c);background:var(--fm-s);color:var(--primary-text-color);font-size:.95rem;font-weight:700;}
      .fm-dark .fm-kid{--ct:color-mix(in srgb,var(--c) 55%,var(--primary-text-color));}
      .fm-kid.fm-sel{border-color:var(--ct);background:var(--c1);}
      .fm-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.9rem;font-weight:800;flex:none;}
      .fm-kage{font-size:.78rem;font-weight:600;color:var(--secondary-text-color);}
      .fm-tabs{display:flex;background:var(--fm-s);border-radius:var(--fm-rs);padding:3px;gap:2px;margin-bottom:16px;} .fm-tabs:empty{display:none;}
      .fm-tabs button{flex:1;border:none;background:transparent;color:var(--secondary-text-color);font-size:.92rem;font-weight:700;padding:9px 6px;border-radius:calc(var(--fm-rs) - 3px);cursor:pointer;white-space:nowrap;}
      .fm-tabs button.fm-sel{background:var(--fm-s2);color:var(--primary-text-color);box-shadow:0 1px 3px rgba(0,0,0,.12);}
      @container (max-width: 420px){ .fm-tabs button{font-size:.8rem;padding:9px 2px;} }
      .fm-hint{background:var(--fm-k1);border-radius:var(--fm-rs);padding:10px 14px;font-size:.88rem;line-height:1.4;margin-bottom:14px;}
      .fm-grp{margin-bottom:18px;}
      .fm-gh{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color);margin:0 2px 8px;}
      .fm-gn{color:var(--fm-kt,var(--fm-k));letter-spacing:0;text-transform:none;font-size:.82rem;}

      /* Erste Male: offene Plätze im Album gestrichelt, Gesammeltes als Sticker in der Kinderfarbe */
      .fm-stickers{display:grid;grid-template-columns:repeat(auto-fill,minmax(102px,1fr));gap:10px;}
      .fm-st{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;min-height:112px;padding:12px 6px 10px;border-radius:var(--fm-rs);cursor:pointer;
        border:2px dashed var(--divider-color);background:transparent;color:var(--primary-text-color);font:inherit;transition:transform .15s;-webkit-tap-highlight-color:transparent;}
      .fm-st:active{transform:scale(.93);}
      .fm-st-e{font-size:2.1rem;line-height:1.15;opacity:.55;filter:saturate(.5);}
      .fm-st-t{font-size:.76rem;font-weight:600;line-height:1.15;text-align:center;color:var(--secondary-text-color);}
      .fm-st.fm-on{border:2px solid var(--fm-kt,var(--fm-k));background:linear-gradient(160deg,var(--fm-k1),var(--fm-k2));box-shadow:0 3px 10px var(--fm-k2);}
      .fm-st.fm-on .fm-st-e{opacity:1;transform:rotate(-6deg);filter:drop-shadow(0 0 1px var(--card-background-color,#fff)) drop-shadow(0 3px 3px rgba(0,0,0,.2));}
      .fm-st.fm-on .fm-st-t{color:var(--primary-text-color);font-weight:700;}
      /* Foto statt Symbol: rund, so hoch wie die Symbolzeile (2.1rem bei 1.15 Zeilenhöhe), damit die Kacheln gleich hoch bleiben */
      .fm-st-ph{display:block;flex:none;width:2.6rem;height:2.6rem;margin:-.09rem 0;box-sizing:border-box;border-radius:50%;object-fit:cover;
        border:2px solid var(--card-background-color,#fff);background:var(--fm-s2);box-shadow:0 3px 6px var(--fm-k3);}
      .fm-st-d{margin-top:auto;font-size:.7rem;font-weight:800;color:var(--fm-kt,var(--fm-k));background:var(--card-background-color,#fff);border-radius:999px;padding:1px 8px;}
      .fm-st-star{position:absolute;top:-9px;right:-5px;font-size:1.15rem;transform:rotate(14deg);}
      .fm-add{border-style:dashed;border-color:color-mix(in srgb,var(--fm-kt,var(--fm-k)) 36%,transparent);}
      .fm-add .fm-st-e{opacity:1;filter:none;color:var(--fm-kt,var(--fm-k));font-weight:400;}
      .fm-add .fm-st-t{color:var(--fm-kt,var(--fm-k));font-weight:700;}
      .fm-others{position:absolute;top:6px;left:6px;display:flex;gap:2px;}
      .fm-od{width:17px;height:17px;border-radius:50%;color:#fff;font-size:.6rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none;}
      .fm-pop{animation:fm-pop .75s cubic-bezier(.3,1.7,.5,1);}
      @keyframes fm-pop{0%{transform:scale(.6) rotate(-8deg);}60%{transform:scale(1.12) rotate(3deg);}100%{transform:none;}}

      /* Entwicklung */
      .fm-bands{position:relative;display:flex;gap:6px;overflow-x:auto;padding:10px 2px 8px;margin:-10px -2px 4px;scrollbar-width:none;}
      .fm-bands::-webkit-scrollbar{display:none;}
      .fm-band{position:relative;flex:none;border:2px solid transparent;border-radius:999px;padding:7px 13px;cursor:pointer;
        background:var(--fm-s);color:var(--primary-text-color);font-size:.88rem;font-weight:700;}
      .fm-band small{color:var(--fm-kt,var(--fm-k));font-weight:800;font-size:.78rem;}
      .fm-band.fm-sel{border-color:var(--fm-kt,var(--fm-k));background:var(--fm-k1);}
      .fm-jetzt{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--fm-k);color:#fff;font-size:.56rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:1px 6px;}
      .fm-bandhead{margin:6px 2px 12px;}
      .fm-bt{font-size:1.1rem;font-weight:800;}
      .fm-bs{font-size:.86rem;font-weight:700;color:var(--fm-kt,var(--fm-k));margin-top:2px;}
      .fm-alles{background:linear-gradient(90deg,var(--fm-k1),var(--fm-k2));border-radius:var(--fm-rs);padding:10px 14px;font-weight:800;margin-bottom:12px;}
      .fm-area{margin-bottom:14px;}
      .fm-row{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;border:1.5px solid var(--divider-color);border-radius:var(--fm-rs);padding:10px 12px;margin-bottom:6px;cursor:pointer;
        background:transparent;color:var(--primary-text-color);font:inherit;font-size:.92rem;line-height:1.3;transition:transform .12s;-webkit-tap-highlight-color:transparent;}
      .fm-row:active{transform:scale(.98);}
      .fm-bub{flex:none;width:28px;height:28px;box-sizing:border-box;border-radius:50%;border:2px dashed var(--secondary-text-color);opacity:.5;
        display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:.95rem;}
      .fm-row.fm-on{background:linear-gradient(100deg,var(--fm-k2),var(--fm-k1));border-color:color-mix(in srgb,var(--fm-kt,var(--fm-k)) 36%,transparent);}
      .fm-row.fm-on .fm-bub{border:none;opacity:1;background:var(--fm-k);box-shadow:0 2px 6px var(--fm-k3);}
      .fm-rt{flex:1;min-width:0;}
      .fm-rd{flex:none;font-size:.78rem;font-weight:800;color:var(--fm-kt,var(--fm-k));}
      .fm-row .fm-others{position:static;}
      /* kleines rundes Foto am erledigten Eintrag (Entwicklung und Bewegung) */
      .fm-mini{flex:none;width:28px;height:28px;box-sizing:border-box;border-radius:50%;object-fit:cover;
        border:2px solid var(--card-background-color,#fff);background:var(--fm-s2);box-shadow:0 1px 3px var(--fm-k3);}

      /* Bewegung: Zeitfenster als Balken, Punkte zeigen, wann es so weit war */
      .fm-motor{display:flex;flex-direction:column;gap:8px;}
      .fm-mo,.fm-axis{display:grid;grid-template-columns:1fr;column-gap:14px;row-gap:8px;}
      .fm-mo{width:100%;border:none;border-radius:var(--fm-rs);padding:10px 14px;cursor:pointer;text-align:left;font:inherit;
        background:var(--fm-s);color:var(--primary-text-color);-webkit-tap-highlight-color:transparent;}
      .fm-mo:active{transform:scale(.99);}
      .fm-axis{padding:0 14px;}
      .fm-axl{display:none;font-size:.7rem;color:var(--secondary-text-color);text-align:right;}
      @container (min-width: 560px){ .fm-mo,.fm-axis{grid-template-columns:230px 1fr;align-items:center;} .fm-axl{display:block;} }
      .fm-ml{display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:700;min-width:0;}
      .fm-mi{font-size:1.35rem;flex:none;}
      .fm-mt{min-width:0;}
      .fm-md{margin-left:auto;font-size:.76rem;font-weight:800;color:var(--fm-kt,var(--fm-k));white-space:nowrap;}
      .fm-track{position:relative;height:28px;border-radius:14px;background:var(--fm-s2);}
      .fm-win{position:absolute;top:5px;bottom:5px;border-radius:9px;--w1:color-mix(in srgb,var(--fm-kt,var(--fm-k)) 18%,transparent);--w2:color-mix(in srgb,var(--fm-kt,var(--fm-k)) 42%,transparent);
        background:linear-gradient(90deg,var(--w1,var(--fm-k1)),var(--w2,var(--fm-k3)) 50%,var(--w1,var(--fm-k1)));}
      .fm-mo.fm-on .fm-win{--w1:color-mix(in srgb,var(--fm-kt,var(--fm-k)) 30%,transparent);}
      .fm-now{position:absolute;top:-5px;bottom:-5px;width:2px;margin-left:-1px;border-radius:1px;background:var(--primary-text-color);opacity:.7;pointer-events:none;}
      .fm-ticks .fm-nowl{font-weight:800;color:var(--primary-text-color);}
      .fm-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:20px;height:20px;box-sizing:border-box;border-radius:50%;color:#fff;font-size:.6rem;font-weight:800;
        display:flex;align-items:center;justify-content:center;border:2px solid var(--card-background-color,#fff);box-shadow:0 1px 3px rgba(0,0,0,.25);}
      .fm-dot.fm-me{width:26px;height:26px;font-size:.78rem;box-shadow:0 0 0 3px var(--fm-k3),0 1px 3px rgba(0,0,0,.25);}
      .fm-ticks{position:relative;height:16px;font-size:.7rem;color:var(--secondary-text-color);font-variant-numeric:tabular-nums;}
      .fm-ticks span{position:absolute;transform:translateX(-50%);}
      .fm-quelle{font-size:.72rem;line-height:1.45;color:var(--secondary-text-color);opacity:.85;margin-top:12px;}

      /* Dialog */
      .fm-ov{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;animation:fm-fade .2s;}
      @keyframes fm-fade{from{opacity:0;}}
      .fm-sheet{background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--fm-r);width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;
        box-shadow:0 16px 50px rgba(0,0,0,.3);animation:fm-up .4s cubic-bezier(.3,1.4,.5,1);}
      @keyframes fm-up{from{transform:translateY(30px) scale(.94);opacity:0;}}
      .fm-sh-top{position:relative;overflow:hidden;text-align:center;padding:22px 18px 16px;background:linear-gradient(170deg,var(--fm-k3),var(--fm-k1) 65%,transparent);}
      .fm-sh-e{display:inline-block;font-size:3.6rem;line-height:1.1;animation:fm-hop 1.6s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(0,0,0,.15));}
      @keyframes fm-hop{0%,100%{transform:translateY(0) rotate(-5deg);}50%{transform:translateY(-8px) rotate(5deg);}}
      .fm-sh-cheer{font-size:1.5rem;font-weight:800;margin-top:6px;color:var(--fm-kt,var(--fm-k));}
      .fm-sh-t{font-size:1rem;font-weight:700;margin-top:2px;}
      .fm-sh-other{display:flex;align-items:center;justify-content:center;gap:6px;font-size:.84rem;color:var(--secondary-text-color);margin-top:8px;}
      .fm-spark{position:absolute;font-size:1.1rem;animation:fm-twinkle 1.8s ease-in-out infinite;}
      @keyframes fm-twinkle{0%,100%{opacity:.25;transform:scale(.7);}50%{opacity:1;transform:scale(1.15);}}
      .fm-sh-body{padding:2px 18px 0;}
      .fm-lbl{display:block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--secondary-text-color);margin:14px 0 6px;}
      .fm-opt{text-transform:none;letter-spacing:0;font-weight:600;opacity:.8;}
      .fm-two{display:flex;gap:10px;} .fm-emo{flex:0 0 76px;} .fm-emo .fm-in{text-align:center;font-size:1.3rem;padding:7px;} .fm-grow{flex:1;min-width:0;}
      .fm-when{display:flex;gap:6px;}
      .fm-when button{flex:none;border:2px solid transparent;border-radius:var(--fm-rs);padding:8px 12px;font-weight:700;font-size:.9rem;cursor:pointer;
        background:var(--fm-s);color:var(--primary-text-color);}
      .fm-when button.fm-sel{border-color:var(--fm-kt,var(--fm-k));background:var(--fm-k1);}
      .fm-when .fm-in{flex:1;}
      .fm-in{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid var(--divider-color);border-radius:var(--fm-rs);
        background:var(--fm-s);color:var(--primary-text-color);font-size:1rem;}
      .fm-in[type=date]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;color-scheme:light;} .fm-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum sonst breiter als der Dialog */
      .fm-dark .fm-in[type=date]{color-scheme:dark;}
      textarea.fm-in{resize:vertical;}
      .fm-age{min-height:1.1em;font-size:.84rem;font-weight:700;color:var(--fm-kt,var(--fm-k));margin-top:7px;}
      .fm-check{display:flex;align-items:center;gap:9px;font-size:.9rem;margin-top:9px;cursor:pointer;}
      .fm-check input{width:19px;height:19px;margin:0;accent-color:var(--fm-k);flex:none;}
      .fm-foot{display:flex;gap:8px;align-items:center;padding:18px;}
      .fm-flex{flex:1;}
      .fm-btn{border:none;border-radius:var(--fm-rs);padding:12px 16px;font-weight:700;font-size:.95rem;cursor:pointer;background:var(--fm-s);color:var(--primary-text-color);}
      .fm-ok{background:var(--fm-k);color:#fff;box-shadow:0 4px 12px var(--fm-k3);}
      .fm-del{background:transparent;color:var(--secondary-text-color);font-size:.85rem;font-weight:600;padding-left:2px;padding-right:2px;}
      /* Foto im Dialog: groß oben in der Erinnerung, sonst als Vorschau unter der Notiz; ein Tipp zeigt es bildschirmfüllend */
      .fm-gbox{margin-top:14px;} .fm-gbox:empty{display:none;}
      .fm-gfoto{display:block;width:100%;min-height:150px;max-height:min(320px,48vh);object-fit:cover;border-radius:var(--fm-rs);background:var(--fm-s);cursor:zoom-in;}
      .fm-vorschau{display:block;max-width:100%;max-height:200px;min-width:120px;min-height:120px;object-fit:cover;border-radius:var(--fm-rs);background:var(--fm-s);cursor:zoom-in;margin-bottom:8px;}
      .fm-fotoact{display:flex;flex-wrap:wrap;gap:8px;}
      .fm-fbtn,.fm-busy{display:inline-block;text-align:center;}
      .fm-busy{opacity:.75;cursor:default;}
      .fm-full{position:fixed;inset:0;z-index:1002;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;cursor:zoom-out;
        background:color-mix(in srgb,var(--fp-scrim,#000) 92%,transparent);animation:fm-fade .2s;}
      .fm-full-img{max-width:100%;max-height:100%;object-fit:contain;}
      .fm-full-x{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;width:40px;height:40px;border:none;border-radius:50%;cursor:pointer;
        background:color-mix(in srgb,var(--fp-scrim,#000) 50%,transparent);color:var(--text-primary-color,#fff);font-size:1.15rem;}

      /* Konfetti */
      .fm-fx{position:fixed;inset:0;pointer-events:none;z-index:1000;overflow:hidden;}
      .fm-cf{position:absolute;display:block;border-radius:2px;}
      .fm-cf-e{font-size:20px;line-height:1;}
      @media (prefers-reduced-motion: reduce){ .fm-sh-e,.fm-spark,.fm-pop,.fm-bump,.fm-sheet,.fm-ov,.fm-full{animation:none !important;} }
    </style>`;
  }
  getCardSize() { return 10; }
}
if (!customElements.get("fp-milestone-card")) {
  customElements.define("fp-milestone-card", FpMilestoneCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-milestone-card", name: "FP Milestone Card", description: "Meilensteine je Kind zum Abhaken: Erste Male, Entwicklung nach Alter, Bewegung mit WHO-Zeitfenstern" });
}
})();


/* ===== fp-baby-overview-card v32 (swipe_views am Handy: Wischen wechselt die Ansicht auch über den eingebetteten Karten in Protokoll und Momente, gesperrt nur in Eingabefeldern, offenen Blättern und Dialogen und in waagrecht scrollbaren Flächen (Chips, Meilenstein-Bänder); davor: Lightboxen öffnen als nativer Dialog in der obersten Ebene, immer mittig im Bildschirm; davor:Handy: der Platz für den Sprachassistenten (.fo-pipslot) nimmt dessen Figur als Kind auf (display: flex, overflow: visible) und gibt sie beim Neuzeichnen der Leiste an den neuen Platz weiter; davor: dock_gap setzt in die Kinder-Leiste einen echten Platz für den Sprachassistenten (.fo-pipslot, gemeldet in window.__fpPipSlots), Pip setzt sich darauf; swipe_views – die Randfläche ist eine kurze Lasche auf Bildschirmmitte statt eines Streifens über die ganze Höhe, die Tageszeile zeigt heute das Datum statt „Heute“; davor: Handy: kids_dock – mit mindestens zwei Kindern mit Schlafschalter sitzt ganz rechts in der Leiste ein Mond-Knopf, der ein Schlaf-Blatt für alle öffnet (eine Zeile je Kind zum Umschalten, darunter „Beide schlafen“ bzw. „Beide aufwecken“); davor: Handy: kids_dock – unten eine Leiste mit einer Pille je Kind, ein Tipp öffnet ein Blatt mit Schlafen und Stillen; swipe_views – Ansichten per Wischen mit Namenszeile unter der Kinderwahl statt Ansichtsleiste; dock_gap – Platz links für den Sprachassistenten; davor: Uhrzeit-Eingaben in der doppelten Stunde (Ende der Sommerzeit) eindeutig; davor: Zeiten gehen mit Zeitzone an Home Assistant (Zeitumstellung); davor: action_bar: false blendet die Aktionsleiste am Handy aus; davor: Wiegezeit: die Uhrzeit der Eingabe wird als Wiegezeit mitgespeichert, beim Korrigieren behalten, in Wachstum und „Frag nach“ gezeigt; davor: „Frag nach“ bleibt am Gerät gespeichert und überlebt Tab-Wechsel und Neuladen, bis „Neues Gespräch“ getippt wird; davor: Leiste unten fehlte am Tablet manchmal: die Ansichtsleiste steht schon beim Aufbau da und hängt an keiner :has()-Regel mehr, die Safari nach dem Laden nicht immer neu auswertet; davor: bar_style: inline für die Begrüßung – die Leiste ohne Pille, eine Zeile je Kind in Farbe und Größe des Behälters; davor: layout: bar – schmale Baby-Leiste für die Startseite mit letzter und nächster Mahlzeit je Kind, Tipp öffnet den Baby-Tab bei diesem Kind; davor: ein Tipp auf „Nächste Mahlzeit“, Stillen, Fläschchen oder Windel öffnet das Protokoll dieses Kindes an der passenden Stelle; davor: am Handy klebt der Kopf mit der Kinderwahl beim Scrollen oben, mit Fläche und Schatten; „Beide“ in der Aktionsleiste statt Schlafblock oben; davor: startet beim Öffnen des Tabs immer auf „Heute“ und dem heutigen Tag; davor: „Muster“ und „Wachstum“ in der Listen-Sprache wie „Heute“; davor: „Heute“ ruhiger mit „Jetzt“ als Liste, Tagesstreifen mit Zahlen als Textzeile, Einträgen ohne Kachelflächen und „wach seit“ im Schlaf; davor: am Handy Aktionsleiste unten für das gewählte Kind, Schnellknöpfe dort entfallen, oben nur „Beide schlafen“; weniger Doppeltes in „Heute“; Farben und Radien aus dem Theme; Kindwechsel als Segment-Schalter und per Wischen; Leiste unten mit Heute, Protokoll, Muster, Wachstum und Momente; jeder Eintrag antippbar zum Ändern und Löschen, „Rückgängig“, „＋ Nachtragen“; ⚙ Einstellungen für Erinnerung und Pause; Schlaf per Knopf mit Prognose aus den eigenen Wachphasen; Wachstum mit Perzentilkurven aus growth_data; im Stil von Buma: Karte „Nächste Mahlzeit“, Tagesstreifen, ✦ „Frag nach“) ===== */
// Liest, was die anderen Karten schreiben: Stillprotokoll (fp-feeding-card), Windeln
// (fp-diaper-card), Gewicht (fp-weight-card) und Meilensteine (fp-milestone-card), dazu den
// eigenen Schlafkalender je Kind (sleep_calendar, geschrieben von der Protokoll-Automation).
// Schreibt selbst Windeln, Fläschchen, Gewichte und nachgetragenes oder geändertes Stillen im Format
// jener Karten und schaltet den Still-Schalter wie die Stillkarte — den Termin dazu legt weiterhin die Automation an.
// Mit layout: bar wird daraus eine schmale Leiste für die Startseite (letzte und nächste Mahlzeit je Kind, ohne Protokoll,
// Schlaf, Wachstum oder Meilensteine); sie lädt nur die Stillkalender und führt per Tipp in den Baby-Tab.
// Mit bar_style: inline fehlt der Pille Rahmen und Fläche: eine Zeile je Kind in Farbe und Größe des Behälters, so sitzt die Leiste
// in der fp-glance-card (Option baby).
(() => {
const U = window.__fpUtils;
const MIN = 60000, STD = 3600000, TAG = 86400000;
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const KIDCOLORS = ["#4A7A3A", "#7A4A78", "#3A6A8A", "#A0603A"];
const LADETAGE = 28;   // für Muster: zwei Wochen und die zwei davor zum Vergleich
const BARTAGE = 4;     // Leiste: so viele Tage Stillkalender (die Prognose braucht 72 h)
const BARTAKT = 15000; // Leiste: alle 15 s prüfen, ob sich der Text geändert hat (Minuten), jede Minute neu laden
// Kleine eigene Symbole für die Leiste unten, 24er-Raster.
const ICO = {
  heute: '<path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  muster: '<rect x="4" y="11" width="4" height="9" rx="1.5"/><rect x="10" y="5" width="4" height="15" rx="1.5"/><rect x="16" y="8" width="4" height="12" rx="1.5"/>',
  wachstum: '<path d="M3 20h18" stroke-width="2" stroke="currentColor" fill="none"/><path d="m4 16 5-5 4 3 7-8" stroke-width="2.4" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  momente: '<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="2" fill="var(--b-bar)"/><path d="m5 18 5-5 3 3 2-2 4 4z" fill="var(--b-bar)"/>',
  protokoll: '<rect x="4.5" y="4" width="15" height="17" rx="3"/><rect x="8.5" y="2.5" width="7" height="4" rx="1.5"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="var(--b-bar)" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
};
const MOND = '<svg class="fo-mond" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2c.7 5.2 4.5 9.1 10 10-5.5.9-9.3 4.8-10 10-.7-5.2-4.5-9.1-10-10 5.5-.9 9.3-4.8 10-10Z"/></svg>';

class FpBabyOverviewCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.kids) || !config.kids.length) throw new Error("fp-baby-overview-card braucht kids");
    this.config = Object.assign({
      weight_calendar: "",       // Kalender der fp-weight-card (alle Kinder)
      milestone_calendar: "",    // Kalender der fp-milestone-card (alle Kinder)
      chat: true,                // ✦ „Frag nach“
      action_bar: true,          // Handy: Aktionsleiste (Schlaf, Beide, Stillen, Windel, Fläschchen) über der Ansichtsleiste; false = nicht rendern, kein Platz im Dock
      kids_dock: false,          // Handy, mehrere Kinder: statt Aktions- und Ansichtsleiste eine Leiste mit einer Pille je Kind; ein Tipp öffnet ein Blatt mit Schlafen und Stillen
      swipe_views: false,        // Handy: Ansichten per Wischen wechseln, unter der Kinderwahl steht eine Namenszeile; die Ansichtsleiste unten entfällt, das Kind wechselt man nur noch oben
      dock_gap: 0,               // Handy mit kids_dock: so viele px bleiben links in der Leiste frei (0–120), z. B. für einen schwebenden Sprachassistenten
      ai_entity: "",             // ai_task-Entity für den Chat; leer = die in HA voreingestellte
      days: 14,                  // so viele Tage bekommt die KI
      growth_data: "",           // optional: Perzentilkurven wie bei der fp-weight-card (dazu je Kind birth, ga, sex)
      memories_path: "",         // nur noch Rückfall ohne milestone_calendar: Tab, zu dem „Momente“ springt
      bottle_presets: [40, 60, 90, 120],
      reminder_hours: 3,         // ab hier ist die Mahlzeit „fällig“, wie in der Stillkarte (Rückfall ohne Helfer)
      reminder_entity: "",       // optional: input_number (Stunden) tagsüber, dieselben Helfer wie Stillkarte und Automation
      reminder_night_entity: "", // optional: input_number (Stunden) nachts
      night_start: 22, night_end: 6,
      meal_pause_entity: "",     // optional: input_number (Minuten), überschreibt meal_pause_minutes
      meal_pause_minutes: 45,    // höchstens so viel Pause zwischen zwei Einträgen derselben Mahlzeit
      bottle_minutes: 15,        // Fläschchen stehen mit „fertig um“: so viel früher war ihr Beginn
      layout: "",                // "bar" = schmale Baby-Leiste für die Startseite statt der Übersicht
      nav_path: "",              // Leiste: Pfad des Baby-Tabs, den ein Tipp auf ein Kind öffnet; leer = Tipp tut nichts
      bar_style: "",             // Leiste: "inline" = ohne Pille, eine Zeile je Kind in Farbe und Größe des Behälters (für die fp-glance-card)
    }, config);
    this.config.kids = this.config.kids.map((k, i) => Object.assign({}, k, {
      key: String(k.key || k.name || `kind_${i + 1}`), name: String(k.name || k.key || `Kind ${i + 1}`),
      color: k.color || KIDCOLORS[i % KIDCOLORS.length] }));
    this._built = false; this._d = null; this._sig = ""; this._busy = false;
    this._pfx = `fp-overview:${this.config.kids.map(k => k.key).join(",")}`;
    this._chat = this._chatLaden();   // „Frag nach“ bleibt am Gerät, bis „Neues Gespräch“ getippt wird
    this._kind = this._pref("kind", "");
    if (!this.config.kids.some(k => k.key === this._kind)) this._kind = this.config.kids[0].key;
    this._view = "heute";   // beim Öffnen des Tabs immer „Heute“; die Ansicht wird nicht gemerkt
    this._filter = this._pref("filter", "alle");
    this._spanne = this._pref("spanne", "7") === "14" ? 14 : 7;
    this._off = 0;   // 0 = heute, -1 = gestern …
    this._wAlle = false;   // Wachstum: alle Messungen statt der letzten
    this._eAlle = false;   // Heute: alle Einträge des Tages statt der letzten fünf
    this._emb = {};        // Protokoll: eingebettete Still- und Windelkarte je Kind, einmal angelegt
    this._ref = null;
    // Leiste: nur Stillkalender und Schalter. Kurven, Perzentile und Raster der Übersicht braucht sie nicht; die Rasterhöhe
    // (Sections-View) richtet sich nach der Leiste, volle Breite, Höhe nach Inhalt. Als Eigenschaft der Instanz, damit die Übersicht
    // von Home Assistant nichts Neues angeboten bekommt.
    this._bar = this.config.layout === "bar";
    this._inline = this._bar && this.config.bar_style === "inline";
    if (this._bar) this.getGridOptions = () => ({ columns: "full", rows: "auto" });
    else delete this.getGridOptions;
    this._barHtml = "";
    // Handy-Optionen (nur Übersicht): Kinder-Leiste unten braucht mehrere Kinder, Wischen zwischen Ansichten nicht.
    this._kd = !this._bar && this.config.kids_dock === true && this.config.kids.length > 1;
    this._sw = !this._bar && this.config.swipe_views === true;
    this._dg = Math.min(120, Math.max(0, Math.round(Number(this.config.dock_gap) || 0)));
    this._kdOffen = null;   // Kind (oder „*“ = Schlaf-Blatt für alle), dessen Blatt aus der Kinder-Leiste offen ist
    if (this._timer) { clearInterval(this._timer); this._timer = setInterval(() => this._tick(), this._bar ? BARTAKT : 1000); }   // Editor: Takt passt zur Darstellung
    if (this.config.growth_data && !this._bar) this._loadRef();
  }
  // Referenzkurven wie in der fp-weight-card; beide Karten teilen sich den Abruf über window.__fpGrowth.
  async _loadRef() {
    const url = this.config.growth_data, cache = (window.__fpGrowth = window.__fpGrowth || {});
    try {
      cache[url] = cache[url] || fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      this._ref = await cache[url];
    } catch (e) {
      delete cache[url];
      U.toast(this, "Perzentilkurven konnten nicht geladen werden");
      this._ref = null;
    }
    this._paint(true);
  }
  set hass(hass) {
    this._hass = hass;
    if (this._bar) { this._hassBar(); return; }
    if (this._ms) this._ms.hass = hass;
    Object.values(this._emb).forEach(e => { if (e.feed) e.feed.hass = hass; if (e.diaper) e.diaper.hass = hass; });
    // Verglichen wird mit dem, was die Karte zuletzt gesehen hat — nicht mit dem vorigen hass-Objekt.
    const kids = this.config.kids, lauf = kids.map(k => this._laeuft(k)), schlaf = kids.map(k => this._schlaeft(k));
    const sig = JSON.stringify([lauf, schlaf, kids.map((k, i) => [this._seite(k), lauf[i] ? this._beginn(k) : 0, schlaf[i] ? this._schlafBeginn(k) : 0]), this._dunkel(),
      this._pauseMin(), kids.map(k => this._grenze(k, Date.now()))]);   // Erinnerung und Pause aus den Helfern (⚙)
    const vorher = this._lauf, vorherS = this._schlaf;
    this._lauf = lauf; this._schlaf = schlaf;
    if (this._einstOffen) this._einstZeichne();   // das Einstellungsblatt folgt dem Zustand der Helfer
    if (!this._built) { this._swSig = sig; this._build(); this._load(); return; }
    // Beim Stopp schreibt die Automation den Termin erst nach ein paar Sekunden — mehrfach nachladen.
    const gestoppt = (alt, neu) => alt && alt.some((v, i) => v && !neu[i]);
    if (gestoppt(vorher, lauf) || gestoppt(vorherS, schlaf)) this._nachladen([3000, 8000, 20000, 40000]);
    if (sig !== this._swSig) { this._swSig = sig; this._paint(true); if (this._kdOffen) this._kindZeichne(); }   // das Blatt der Kinder-Leiste folgt dem Zustand
  }
  _nachladen(zeiten) {
    (this._nachT || []).forEach(clearTimeout);
    this._nachT = zeiten.map(ms => setTimeout(() => this._load(), ms));
  }
  connectedCallback() {
    // Leiste: nach dem Wiederanhängen (zurück auf der Startseite) gleich frisch zeichnen und laden, der Takt stand solange still.
    if (this._bar) {
      if (this._abgehaengt) { this._abgehaengt = false; this._paintBar(); this._load(); }
      if (!this._timer) this._timer = setInterval(() => this._tick(), BARTAKT);
      return;
    }
    // Home Assistant hängt die Karte beim Tabwechsel ab und wieder an: wer zurückkehrt, landet auf „Heute“ am heutigen Tag.
    // Muster-Spanne, eingebettete Karten und Daten bleiben. Das Kind liest sie neu aus der Merkung: Die Baby-Leiste auf der Startseite
    // legt dort das getippte Kind ab, der Baby-Tab soll bei ihm landen.
    if (this._abgehaengt) {
      this._abgehaengt = false;
      this._closeSheet();
      this._view = "heute"; this._off = 0; this._eAlle = false;
      const gemerkt = this._pref("kind", "");
      if (this.config.kids.some(k => k.key === gemerkt)) this._kind = gemerkt;
      if (this._built) this._paint(true);
    }
    if (!this._timer) this._timer = setInterval(() => this._tick(), 1000);
    // Die Wachstumskurve wird für ihre echte Breite gezeichnet, sonst schrumpft am Handy die Schrift mit.
    if (!this._ro && window.ResizeObserver) { this._ro = new ResizeObserver(() => { if (this._view === "wachstum") this._zeichne(); }); this._ro.observe(this); }
    if (this._built) { this._klebt(); this._slotMelden(); }   // nach dem Wiederanhängen den Beobachter für den klebenden Kopf neu anlegen, den Platz für Pip wieder melden
  }
  disconnectedCallback() {
    this._abgehaengt = true;
    clearInterval(this._timer); this._timer = null; (this._nachT || []).forEach(clearTimeout);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    this._zielEnde();
    this._klebtEnde();   // die Beobachter hängen an Wächter und Karte im Gerüst; beim Wiederanhängen legt connectedCallback sie neu an
    this._slotMelden();   // isConnected ist false: der Platz wird ausgetragen
  }
  // Jede Sekunde nur die laufenden Uhren; jede halbe Minute die „her“-Zeiten, jede Minute die Kalender.
  _tick() {
    this._t = (this._t || 0) + 1;
    // Leiste: zeichnet nur neu, wenn sich ein Text geändert hat (Minuten), und lädt jede Minute (vier Takte)
    if (this._bar) { this._paintBar(); if (this._t % 4 === 0) this._load(); return; }
    this.querySelectorAll(".fo-uhr[data-ab]").forEach(el => { el.textContent = this._uhr((Date.now() - Number(el.dataset.ab)) / 1000); });
    this.querySelectorAll(".fo-dauer[data-ab]").forEach(el => { el.textContent = this._hDauer(Date.now() - Number(el.dataset.ab)); });   // Schlaf: ohne Sekunden
    if (this._t % 30 === 0) this._paint();
    if (this._t % 60 === 0) this._load();
  }
  _dunkel() { return !!(this._hass && this._hass.themes && this._hass.themes.darkMode); }   // hell oder dunkel entscheidet das Gerät
  _pref(n, d) { try { return localStorage.getItem(`${this._pfx}:${n}`) || d; } catch (e) { return d; } }
  _setPref(n, v) { try { localStorage.setItem(`${this._pfx}:${n}`, v); } catch (e) { /* nur Komfort */ } }
  _chatLaden() {
    try { const a = JSON.parse(this._pref("chat", "[]")); return Array.isArray(a) ? a.filter(m => m && (m.role === "me" || m.role === "ai") && typeof m.text === "string").slice(-12) : []; }
    catch (e) { return []; }
  }
  _chatMerken() { this._setPref("chat", JSON.stringify(this._chat.slice(-12))); }

  // ---------- Hilfen ----------
  _p(n) { return String(n).padStart(2, "0"); }
  _hm(d) { return `${this._p(d.getHours())}:${this._p(d.getMinutes())}`; }
  _dm(d) { return `${d.getDate()}.${d.getMonth() + 1}.`; }
  _dmy(d) { return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; }
  _tag(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  _mitternacht(d, plus) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (plus || 0)); }
  _day(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
  _local(d, sep) { return `${d.getFullYear()}-${this._p(d.getMonth() + 1)}-${this._p(d.getDate())}${sep}${this._hm(d)}:${this._p(d.getSeconds())}`; }
  _hDauer(ms) { const m = Math.max(0, Math.round(ms / MIN)); return `${Math.floor(m / 60)}:${this._p(m % 60)} h`; }
  _minText(ms) { const m = Math.max(0, Math.round(ms / MIN)); return m < 60 ? `${m} Min` : this._hDauer(ms); }
  _uhr(sek) { const s = Math.max(0, Math.floor(sek)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${this._p(m)}:${this._p(s % 60)}` : `${m}:${this._p(s % 60)}`; }
  _vor(t) {
    const m = Math.floor((Date.now() - t) / MIN);
    if (m < 1) return "gerade eben";
    if (m < 60) return `vor ${m} Min`;
    if (m < 24 * 60) return `vor ${Math.floor(m / 60)}:${this._p(m % 60)} h`;   // kurz, wie die große Zahl oben
    const tg = Math.round(m / 1440);
    return `vor ${tg} ${tg === 1 ? "Tag" : "Tagen"}`;
  }
  _wann(t) { const d = new Date(t); return this._tag(d) === this._tag(new Date()) ? this._hm(d) : `${this._dm(d)} ${this._hm(d)}`; }
  _kg(g) { return (g / 1000).toLocaleString("de-AT", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " kg"; }
  _kid(key) { return this.config.kids.find(k => k.key === key) || this.config.kids[0]; }
  _tint(c, a) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || "").trim());
    if (!m) return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
    let h = m[1]; if (h.length === 3) h = h.split("").map(x => x + x).join("");
    const n = parseInt(h, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  _kidStyle(k) {
    return `--k:${U.esc(k.color)};--k1:${this._tint(k.color, .1)};--k2:${this._tint(k.color, .22)};--k3:${this._tint(k.color, .4)};--kt:color-mix(in srgb, ${U.esc(k.color)} 62%, var(--primary-text-color))`;
  }
  _median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) / 2; return (s[Math.floor(i)] + s[Math.ceil(i)]) / 2; }
  _quantil(a, q) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))]; }

  // Alter wie in der Meilensteinkarte: ab drei Wochen zu früh zusätzlich korrigiert.
  _frueh(kid) {
    if (!kid.ga) return 0;
    const [w, d] = String(kid.ga).split("+").map(Number), ga = (w || 40) * 7 + (d || 0);
    return ga < 259 ? 280 - ga : 0;
  }
  _alter(kid, korr) {
    if (!kid.birth) return "";
    const b = this._day(kid.birth); if (korr) b.setDate(b.getDate() + this._frueh(kid));
    const d = this._day(this._local(new Date(), " ")), tage = Math.round((d - b) / TAG);
    if (tage < 0) return "";
    let m = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth();
    if (d.getDate() < b.getDate()) m--;
    if (m < 2) { const w = Math.floor(tage / 7); return w < 2 ? `${tage} ${tage === 1 ? "Tag" : "Tage"}` : `${w} Wochen`; }
    if (m < 24) return `${m} ${m === 1 ? "Monat" : "Monate"}`;
    const j = Math.floor(m / 12), r = m % 12;
    return `${j} ${j === 1 ? "Jahr" : "Jahre"}${r ? ` ${r} M.` : ""}`;
  }
  _alterText(kid) {
    const a = this._alter(kid, false), k = this._frueh(kid) ? this._alter(kid, true) : "";
    return a ? `${a}${k && k !== a ? ` · korrigiert ${k}` : ""}` : "";
  }

  // ---------- Daten ----------
  _start(ev) { return new Date((ev.start && (ev.start.dateTime || ev.start.date)) || ev.start); }
  _ende(ev) { return new Date((ev.end && (ev.end.dateTime || ev.end.date)) || ev.end); }
  _datum(ev) { const s = (ev.start && (ev.start.date || ev.start.dateTime)) || ev.start; return this._day(String(s).slice(0, 10)); }
  _meta(ev) { try { return JSON.parse(ev.description || "{}") || {}; } catch (x) { return {}; } }
  // Wie fp-feeding-card: fehlt die Beschreibung, wird aus der Überschrift geraten.
  _parseFeed(ev) {
    const meta = this._meta(ev), sum = String(ev.summary || "");
    if (meta.typ === "windel") return null;
    const typ = meta.typ || (/fl[äa]sch/i.test(sum) ? "flasche" : "stillen");
    let ml = Number(meta.ml) || 0;
    if (!ml) { const m = sum.match(/(\d+)\s*ml/i); if (m) ml = Number(m[1]); }
    const seite = meta.seite || (/rechts/i.test(sum) ? "rechts" : /links/i.test(sum) ? "links" : "");
    return { uid: ev.uid, start: this._start(ev), end: this._ende(ev), typ, ml, seite };
  }
  _parseDiaper(ev) {
    const meta = this._meta(ev), sum = String(ev.summary || "");
    const art = meta.art || (/beides|\+/.test(sum) ? "beides" : /voll/i.test(sum) ? "voll" : "nass");
    return { uid: ev.uid, start: this._start(ev), art };
  }
  _parseSleep(ev) {
    const meta = this._meta(ev);
    if (meta.typ && meta.typ !== "schlaf") return null;   // fremde Termine im selben Kalender überspringen
    return { uid: ev.uid, start: this._start(ev), end: this._ende(ev), auto: !!meta.auto };
  }
  _parseWeight(ev) {
    const meta = this._meta(ev), sum = String(ev.summary || "");
    const kid = this.config.kids.find(k => (k.weight_key || k.key) === meta.kind) || this.config.kids.find(k => sum.toLowerCase().startsWith(k.name.toLowerCase()));
    let g = Number(meta.g) || 0;
    if (!g) { const m = sum.match(/([\d.,]+)\s*(kg|g)\b/i); if (m) { const n = Number(m[1].replace(",", ".")); g = Math.round(/kg/i.test(m[2]) || n < 30 ? n * 1000 : n); } }
    const zeit = /^\d{2}:\d{2}$/.test(String(meta.zeit || "")) ? meta.zeit : "";   // Wiegezeit = Eingabezeit (ab v3.1.5)
    return kid && g > 0 ? { uid: ev.uid, kind: kid.key, g, zeit, date: this._datum(ev) } : null;
  }
  _parseMilestone(ev) {
    const meta = this._meta(ev);
    if (meta.typ !== "meilenstein" || !meta.kind) return null;
    const kid = this.config.kids.find(k => (k.milestone_key || k.key) === meta.kind); if (!kid) return null;
    // Titel steht nach „Name: “, das Symbol davor — so braucht es den Katalog der Meilensteinkarte nicht.
    const sum = String(ev.summary || ""), i = sum.indexOf(": ");
    const t = meta.t || (i >= 0 ? sum.slice(i + 2) : sum), e = meta.e || (sum.split(" ")[0] || "⭐");
    return { kind: kid.key, t, e, date: this._datum(ev) };
  }

  async _load() {
    if (!this._hass) return;
    // Leiste: nur der Stillkalender der letzten Tage; Windeln, Schlaf, Gewichte und Meilensteine bleiben aus (leerer Kalender = kein Abruf)
    const bar = this._bar, nur = c => (bar ? "" : c);
    const jetzt = new Date(), von = this._mitternacht(jetzt, bar ? -BARTAGE : -Math.max(LADETAGE, Number(this.config.days || 14))), bis = this._mitternacht(jetzt, 1);
    let fehler = 0;
    const holen = async (cal, ab) => {
      if (!cal) return [];
      try {
        const evts = await this._hass.callApi("GET", `calendars/${cal}?start=${encodeURIComponent(ab.toISOString())}&end=${encodeURIComponent(bis.toISOString())}`);
        return Array.isArray(evts) ? evts : [];
      } catch (e) { fehler++; return null; }
    };
    const alt = this._d || { kids: {}, weights: [], milestones: [] }, d = { kids: {}, weights: alt.weights, milestones: alt.milestones };
    const lange = new Date(2015, 0, 1);
    await Promise.all([
      ...this.config.kids.map(async k => {
        const [f, w, sl] = await Promise.all([holen(k.feeding_calendar, von), holen(nur(k.diaper_calendar), von), holen(nur(k.sleep_calendar), von)]);
        const a = alt.kids[k.key] || { feeds: [], diapers: [], sleeps: [] };
        d.kids[k.key] = {
          feeds: f ? f.map(x => this._parseFeed(x)).filter(x => x && !isNaN(x.start)).sort((x, y) => x.start - y.start) : a.feeds,
          diapers: w ? w.map(x => this._parseDiaper(x)).filter(x => !isNaN(x.start)).sort((x, y) => x.start - y.start) : a.diapers,
          sleeps: sl ? sl.map(x => this._parseSleep(x)).filter(x => x && !isNaN(x.start) && !isNaN(x.end)).sort((x, y) => x.start - y.start) : (a.sleeps || []),
        };
      }),
      holen(nur(this.config.weight_calendar), lange).then(r => { if (r) d.weights = r.map(x => this._parseWeight(x)).filter(Boolean).sort((x, y) => x.date - y.date); }),
      holen(nur(this.config.milestone_calendar), lange).then(r => { if (r) d.milestones = r.map(x => this._parseMilestone(x)).filter(Boolean).sort((x, y) => x.date - y.date); }),
    ]);
    if (fehler && this._loadedOnce) U.toast(this, "Einige Einträge konnten nicht geladen werden");
    this._loadedOnce = true;   // allerersten Ladefehler (Startup-Flackern) nicht melden
    this._d = d;
    this._paint();
  }

  // Mahlzeiten wie in der Stillkarte: Einträge mit höchstens meal_pause_minutes Pause gehören zusammen.
  // Zahl aus einem Helfer, sonst der Rückfallwert — wie in der Stillkarte.
  _zahl(e, d) { const st = e && this._hass && this._hass.states[e], n = st ? Number(st.state) : NaN; return isFinite(n) && n > 0 ? n : Number(d); }
  // Erinnerungsgrenze in Stunden zu einem Zeitpunkt, nachts eine eigene (wie Stillkarte und Erinnerungs-Automation).
  _grenze(kid, t) {
    const c = this.config, h = new Date(t).getHours();
    const nacht = c.night_start > c.night_end ? (h >= c.night_start || h < c.night_end) : (h >= c.night_start && h < c.night_end);
    const tag = this._zahl(c.reminder_entity, kid.reminder_hours || c.reminder_hours);
    return nacht ? this._zahl(c.reminder_night_entity, tag) : tag;
  }
  _pauseMin() { return this._zahl(this.config.meal_pause_entity, this.config.meal_pause_minutes); }
  _mahlzeiten(feeds) {
    const pause = this._pauseMin() * MIN, flasche = Number(this.config.bottle_minutes) * MIN, out = [];
    let ende = 0;
    feeds.map(e => ({ e, ab: e.typ === "flasche" ? +e.start - flasche : +e.start })).sort((a, b) => a.ab - b.ab).forEach(({ e, ab }) => {
      if (!out.length || ab - ende > pause) out.push({ start: ab, end: ab, geschaetzt: e.typ === "flasche", evs: [] });
      const m = out[out.length - 1];
      m.evs.push(e); m.end = Math.max(m.end, +e.end, ab); ende = Math.max(ende, +e.end);
    });
    return out;
  }
  _laeuft(kid) { const s = this._hass && kid.switch && this._hass.states[kid.switch]; return !!s && s.state === "on"; }
  _beginn(kid) {
    const s = this._hass && kid.start && this._hass.states[kid.start];
    const t = s && s.attributes ? Number(s.attributes.timestamp) * 1000 : 0;
    const sw = this._hass && kid.switch && this._hass.states[kid.switch], lc = sw && sw.last_changed ? Date.parse(sw.last_changed) : 0;
    // Direkt nach dem Einschalten steht im Helfer noch der Beginn der vorigen Mahlzeit, bis die Automation ihn setzt.
    if (t > 0 && (!lc || t >= lc - MIN)) return t;
    return lc || Date.now();
  }
  _seite(kid) { const s = this._hass && kid.side && this._hass.states[kid.side]; return s ? s.state : ""; }
  _schlaeft(kid) { const s = this._hass && kid.sleep_switch && this._hass.states[kid.sleep_switch]; return !!s && s.state === "on"; }
  // Beginn aus dem Helfer. Nur in der ersten Minute nach dem Einschalten kann dort noch der vorige
  // Schlaf stehen — dann gilt der Schaltzeitpunkt. Später nicht mehr, denn nach dem nächtlichen
  // Neustart steht last_changed auf dem Neustart, der Helfer aber weiter richtig.
  _schlafBeginn(kid) {
    const s = this._hass && kid.sleep_start && this._hass.states[kid.sleep_start];
    const t = s && s.attributes ? Number(s.attributes.timestamp) * 1000 : 0;
    const sw = this._hass && kid.sleep_switch && this._hass.states[kid.sleep_switch], lc = sw && sw.last_changed ? Date.parse(sw.last_changed) : 0;
    if (t > 0 && !(lc && Date.now() - lc < MIN && t < lc - MIN)) return t;
    return lc || Date.now();
  }
  _ueber(a, b, t0, t1) { return Math.max(0, Math.min(b, t1) - Math.max(a, t0)); }

  // Alles, was eine Spalte zeigt — und was die KI als Zusammenfassung bekommt.
  _vm(kid) {
    const raw = (this._d && this._d.kids[kid.key]) || { feeds: [], diapers: [], sleeps: [] };
    const jetzt = Date.now(), heute0 = +this._mitternacht(new Date());
    const meals = this._mahlzeiten(raw.feeds), letzte = meals[meals.length - 1] || null;
    const heute = raw.feeds.filter(e => +e.start >= heute0), mealsHeute = meals.filter(m => m.start >= heute0);
    const still = heute.filter(e => e.typ === "stillen").reduce((s, e) => s + Math.max(0, e.end - e.start), 0);
    const ml = heute.filter(e => e.typ === "flasche").reduce((s, e) => s + (e.ml || 0), 0);
    const wHeute = raw.diapers.filter(e => +e.start >= heute0);
    const weights = ((this._d && this._d.weights) || []).filter(w => w.kind === kid.key);
    const ms = ((this._d && this._d.milestones) || []).filter(m => m.kind === kid.key);
    // Laufender Schlaf als offener Abschnitt bis jetzt, damit Summen und Streifen ihn mitzählen.
    const schlaeft = this._schlaeft(kid), schlafAb = schlaeft ? this._schlafBeginn(kid) : 0;
    const schlaf = schlaeft ? (raw.sleeps || []).concat([{ start: new Date(schlafAb), end: new Date(jetzt), laeuft: true }]) : (raw.sleeps || []);
    return {
      schlaf, schlaeft, schlafAb, schlafProg: this._schlafPrognose(schlaf, jetzt, schlaeft),
      kid, meals, letzte, mealsHeute, still, ml, raw,
      nass: wHeute.filter(e => e.art !== "voll").length, voll: wHeute.filter(e => e.art !== "nass").length,
      windel: raw.diapers[raw.diapers.length - 1] || null,
      stuhl: raw.diapers.filter(e => e.art !== "nass").pop() || null,
      weights, ms, prog: this._prognose(meals, jetzt),
    };
  }

  // Nächste Mahlzeit: Median der Abstände (Beginn zu Beginn) der letzten 72 h, getrennt nach
  // Tag und Nacht (22–6 Uhr), Spanne vom 25. bis zum 75. Perzentil. Ab vier Abständen.
  _prognose(meals, jetzt) {
    const nacht = t => { const h = new Date(t).getHours(); return h >= 22 || h < 6; };
    const ab = jetzt - 72 * STD, paare = [];
    for (let i = 1; i < meals.length; i++) {
      const a = meals[i - 1].start, b = meals[i].start;
      if (a >= ab && b - a <= 8 * STD) paare.push({ n: nacht(a), d: b - a });
    }
    const letzte = meals[meals.length - 1]; if (!letzte) return null;
    let set = paare.filter(p => p.n === nacht(letzte.start)).map(p => p.d), teil = nacht(letzte.start) ? "nachts" : "tagsüber";
    if (set.length < 4) { set = paare.map(p => p.d); teil = ""; }
    if (set.length < 4) return null;
    const med = this._median(set), lo = Math.min(this._quantil(set, .25), med - 10 * MIN), hi = Math.max(this._quantil(set, .75), med + 10 * MIN);
    return { t: letzte.start + med, lo: letzte.start + lo, hi: letzte.start + hi, med, teil };
  }

  // Nächster Schlaf wie bei Napper und Buma über die Wachzeit: Median der Wachphasen (Aufwachen bis
  // nächstes Einschlafen) der letzten 72 h, getrennt nach Tag und Nacht (22–6 Uhr), ab drei Wachphasen.
  // Bewusst ohne Alterstabelle: dafür gibt es keine belastbare Quelle, die Vorhersage kommt nur aus den eigenen Daten.
  _schlafPrognose(schlaf, jetzt, schlaeft) {
    if (schlaeft || !schlaf.length) return null;
    const nacht = t => { const h = new Date(t).getHours(); return h >= 22 || h < 6; };
    const ab = jetzt - 72 * STD, paare = [];
    for (let i = 1; i < schlaf.length; i++) {
      const a = +schlaf[i - 1].end, b = +schlaf[i].start;
      if (a >= ab && b > a && b - a <= 8 * STD) paare.push({ n: nacht(a), d: b - a });
    }
    const l = +schlaf[schlaf.length - 1].end;
    let set = paare.filter(p => p.n === nacht(l)).map(p => p.d), teil = nacht(l) ? "nachts" : "tagsüber";
    if (set.length < 3) { set = paare.map(p => p.d); teil = ""; }
    if (set.length < 3) return null;
    const med = this._median(set), lo = Math.min(this._quantil(set, .25), med - 10 * MIN), hi = Math.max(this._quantil(set, .75), med + 10 * MIN);
    return { lo: l + lo, hi: l + hi, med, teil };
  }

  // Nacht = 19 bis 7 Uhr, benannt nach dem Morgen. Längste Pause zwischen zwei Mahlzeiten,
  // die beide zwischen 18 und 8 Uhr beginnen.
  _naechte(meals, n) {
    const out = [], jetzt = new Date();
    let morgen = this._mitternacht(jetzt); if (jetzt.getHours() < 7) morgen = this._mitternacht(jetzt, -1);
    for (let i = 0; i < n; i++) {
      const m0 = this._mitternacht(morgen, -i), von = +m0 - 6 * STD, bis = +m0 + 8 * STD;
      const st = meals.filter(m => m.start >= von && m.start < bis).map(m => m.start);
      let best = 0, a = 0;
      for (let j = 1; j < st.length; j++) if (st[j] - st[j - 1] > best) { best = st[j] - st[j - 1]; a = st[j - 1]; }
      const inNacht = meals.filter(m => m.start >= +m0 - 5 * STD && m.start < +m0 + 7 * STD).length;
      out.push({ morgen: m0, n: inNacht, best, von: a, bis: a + best, daten: st.length > 0 });
    }
    return out;
  }

  // Bemerkt: ein paar freundliche Beobachtungen ohne KI, aus den eigenen Daten gerechnet.
  _bemerkt(vm) {
    const out = [], jetzt = new Date(), heute0 = this._mitternacht(jetzt), seit = jetzt - heute0;
    const alle = this._naechte(vm.meals, 14), l = alle[0];
    if (l && l.daten && l.best) {
      const frueher = alle.slice(1).filter(x => x.daten && x.best).map(x => x.best);
      let t = `🌙 Längste Pause letzte Nacht: <b>${this._hDauer(l.best)}</b>`;
      if (frueher.length >= 3 && l.best > Math.max(...frueher)) t += ` – die längste seit ${frueher.length + 1} Nächten 🎉`;
      else if (frueher.length >= 3) t += ` <span>(sonst ~${this._hDauer(this._median(frueher.slice(0, 7)))})</span>`;
      out.push(t);
    }
    // Schlaf der letzten Nacht (19–7 Uhr), auf die Nacht zugeschnitten
    if (vm.schlaf.length) {
      let m0 = this._mitternacht(jetzt); if (jetzt.getHours() < 7) m0 = this._mitternacht(jetzt, -1);
      const von = +m0 - 5 * STD, bis = Math.min(+m0 + 7 * STD, +jetzt);
      const teile = vm.schlaf.map(e => ({ a: Math.max(+e.start, von), b: Math.min(+e.end, bis) })).filter(x => x.b > x.a);
      if (teile.length) {
        const lang = teile.reduce((m, x) => (x.b - x.a > m.b - m.a ? x : m)), sum = teile.reduce((s2, x) => s2 + x.b - x.a, 0);
        out.push(`😴 Längster Schlaf letzte Nacht: <b>${this._hDauer(lang.b - lang.a)}</b> <span>(${this._hm(new Date(lang.a))}–${this._hm(new Date(lang.b))}, insgesamt ${this._hDauer(sum)})</span>`);
      }
    }
    // Vergleich mit den Vortagen bis zur selben Uhrzeit — sonst wirkt der Vormittag immer „zu wenig“.
    const vortage = [];
    for (let i = 1; i <= 7; i++) {
      const t0 = +this._mitternacht(jetzt, -i), t1 = t0 + seit;
      const hatDaten = vm.meals.some(m => m.start >= t0 && m.start < t0 + TAG) || vm.raw.diapers.some(e => +e.start >= t0 && +e.start < t0 + TAG);
      if (hatDaten) vortage.push({ m: vm.meals.filter(m => m.start >= t0 && m.start < t1).length,
        w: vm.raw.diapers.filter(e => +e.start >= t0 && +e.start < t1 && e.art !== "voll").length });
    }
    if (vortage.length >= 3 && vm.meals.length) {
      const s = Math.round(this._median(vortage.map(v => v.m)));
      out.push(`🍼 Bis jetzt <b>${vm.mealsHeute.length}</b> ${vm.mealsHeute.length === 1 ? "Mahlzeit" : "Mahlzeiten"} <span>(sonst um diese Zeit ~${s})</span>`);
    }
    if (vortage.length >= 3 && vm.raw.diapers.length) {
      const s = Math.round(this._median(vortage.map(v => v.w)));
      out.push(`💧 <b>${vm.nass}</b> nasse ${vm.nass === 1 ? "Windel" : "Windeln"} bis jetzt <span>(sonst ~${s})</span>`);
    }
    const w = vm.weights;
    if (w.length >= 2) {
      const a = w[w.length - 1], vor = w.slice().reverse().find(x => a.date - x.date >= 5 * TAG) || w[w.length - 2], dg = a.g - vor.g;
      out.push(`⚖️ <b>${dg >= 0 ? "+" : "−"}${Math.abs(dg)} g</b> seit ${this._dm(vor.date)}`);
    }
    const neu = vm.ms.filter(m => jetzt - m.date < 14 * TAG).pop();
    if (neu) {
      const n = Math.round((+heute0 - +this._mitternacht(neu.date)) / TAG);
      out.push(`${U.esc(neu.e)} Neu: <b>${U.esc(neu.t)}</b> <span>(${n <= 0 ? "heute" : n === 1 ? "gestern" : `vor ${n} Tagen`})</span>`);
    }
    return out;
  }

  // „8 Mon. 28 T.“ wie Buma („3mo 11d“).
  _alterKurz(kid, korr) {
    if (!kid.birth) return "";
    const b = this._day(kid.birth); if (korr) b.setDate(b.getDate() + this._frueh(kid));
    const d = this._day(this._local(new Date(), " ")), tage = Math.round((d - b) / TAG);
    if (tage < 0) return "";
    let m = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth();
    if (d.getDate() < b.getDate()) m--;
    const anker = new Date(b); anker.setMonth(anker.getMonth() + m);
    const t = Math.round((d - anker) / TAG);
    if (m < 1) return tage < 14 ? `${tage} T.` : `${Math.floor(tage / 7)} Wo. ${tage % 7} T.`;
    if (m < 24) return `${m} Mon.${t ? ` ${t} T.` : ""}`;
    return `${Math.floor(m / 12)} J. ${m % 12} Mon.`;
  }
  // Alter und, bei Frühgeborenen, das korrigierte Alter getrennt (der Kindschalter am Handy braucht dafür zwei Zeilen).
  _alterTeile(kid) {
    const a = this._alterKurz(kid, false), k = this._frueh(kid) ? this._alterKurz(kid, true) : "";
    return [a, a && k && k !== a ? `korr. ${k.replace(/ \d+ T\.$/, "")}` : ""];
  }
  _alterZeile(kid) { return this._alterTeile(kid).filter(Boolean).join(" · "); }
  _avatar(kid, px) {
    let bild = kid.picture || "";
    const st = !bild && kid.entity && this._hass && this._hass.states[kid.entity];
    if (st && st.attributes && st.attributes.entity_picture) bild = st.attributes.entity_picture;
    return `<span class="fo-av" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .42)}px;background:${U.esc(kid.color)}">${bild
      ? `<img src="${U.esc(bild)}" alt="">` : U.esc(kid.name.slice(0, 1))}</span>`;
  }
  _her(ms) { return ms < TAG ? this._hDauer(ms) : `${Math.floor(ms / TAG)} T. ${Math.floor((ms % TAG) / STD)} h`; }
  _farbe(typ) { return { stillen: "var(--c-nurse)", flasche: "var(--c-bottle)", nass: "var(--c-diaper)", voll: "var(--c-stool)", beides: "var(--c-stool)" }[typ] || "var(--b-mut)"; }

  // Nächste Windel wie die nächste Mahlzeit: übliche Abstände der letzten 72 h, Spanne 25.–75. Perzentil.
  _prognoseWindel(w, jetzt) {
    const ab = jetzt - 72 * STD, d = [];
    for (let i = 1; i < w.length; i++) if (+w[i - 1].start >= ab && w[i].start - w[i - 1].start <= 8 * STD) d.push(w[i].start - w[i - 1].start);
    const l = w[w.length - 1];
    if (!l || d.length < 4) return null;
    const med = this._median(d);
    return { t: +l.start + med, lo: +l.start + Math.min(this._quantil(d, .25), med - 15 * MIN), hi: +l.start + Math.max(this._quantil(d, .75), med + 15 * MIN), med };
  }

  // Muster über n abgeschlossene Tage (ab gestern zurück), dazu die n Tage davor zum Vergleich.
  _muster(vm, n) {
    const h0 = +this._mitternacht(new Date());
    const tag = i => {
      const t0 = h0 - i * TAG, t1 = t0 + TAG;
      const m = vm.meals.filter(x => x.start >= t0 && x.start < t1).length;
      const f = vm.raw.feeds.filter(e => +e.start >= t0 && +e.start < t1), w = vm.raw.diapers.filter(e => +e.start >= t0 && +e.start < t1);
      return { m, still: f.filter(e => e.typ === "stillen").reduce((s, e) => s + Math.max(0, e.end - e.start), 0),
        ml: f.filter(e => e.typ === "flasche").reduce((s, e) => s + (e.ml || 0), 0), w: w.length, voll: w.filter(e => e.art !== "nass").length,
        daten: m > 0 || w.length > 0,
        // Schlaf am Kalendertag und in der Nacht davor (19–7 Uhr); eigene Datenmarke, damit Schlaf allein die Mahlzeiten-Schnitte nicht verzerrt
        schlaf: vm.schlaf.reduce((s, e) => s + this._ueber(+e.start, +e.end, t0, t1), 0),
        nacht: vm.schlaf.reduce((s, e) => s + this._ueber(+e.start, +e.end, t0 - 5 * STD, t0 + 7 * STD), 0) };
    };
    const A = [], B = [];
    for (let i = 1; i <= n; i++) { A.push(tag(i)); B.push(tag(i + n)); }
    const mit = arr => arr.filter(x => x.daten), schnitt = (arr, k) => { const a = mit(arr); return a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : 0; };
    const mitS = A.filter(x => x.schlaf > 0), schnittS = k => mitS.length ? mitS.reduce((s, x) => s + x[k], 0) / mitS.length : 0;
    const von = h0 - n * TAG, abst = [];
    for (let i = 1; i < vm.meals.length; i++) {
      const a = vm.meals[i - 1].start, b = vm.meals[i].start;
      if (a >= von && b < h0 && b - a <= 8 * STD) abst.push(b - a);
    }
    const naechte = this._naechte(vm.meals, 2 * n + 1).slice(1);   // die laufende Nacht nicht mitzählen, wenn sie noch nicht vorbei ist
    const nA = naechte.slice(0, n).filter(x => x.daten && x.best).map(x => x.best), nB = naechte.slice(n).filter(x => x.daten && x.best).map(x => x.best);
    return { n, tageA: mit(A).length, tageB: mit(B).length, mA: schnitt(A, "m"), mB: schnitt(B, "m"), still: schnitt(A, "still"), ml: schnitt(A, "ml"),
      flaschenTage: A.filter(x => x.ml > 0).length, w: schnitt(A, "w"), voll: schnitt(A, "voll"),
      p25: abst.length >= 6 ? this._quantil(abst, .25) : 0, p75: abst.length >= 6 ? this._quantil(abst, .75) : 0,
      nachtA: nA.length >= 3 ? this._median(nA) : 0, nachtB: nB.length >= 3 ? this._median(nB) : 0,
      schlafTage: mitS.length, schlaf: schnittS("schlaf"), schlafNacht: schnittS("nacht") };
  }
  _komma(x) { return (Math.round(x * 10) / 10).toLocaleString("de-AT"); }
  // Überschrift und ein, zwei Sätze wie „A bit of everything“ in Buma — gerechnet, nicht erfunden.
  _musterText(s) {
    if (s.tageA < 2) return { h: "Noch zu wenig Einträge", t: "Sobald ein paar Tage protokolliert sind, steht hier, wie sich der Rhythmus entwickelt." };
    const naechteLaenger = s.nachtA && s.nachtB && s.nachtA - s.nachtB >= 15 * MIN;
    const gleich = s.p75 && s.p75 - s.p25 <= 50 * MIN;
    const h = naechteLaenger ? "Die Nächte werden länger 🌙" : gleich ? "Ein gleichmäßiger Rhythmus" : "Ein bisschen von allem";
    const t = [s.schlafTage >= 2
      ? `${this._komma(s.mA)} Mahlzeiten, ${this._komma(s.w)} Windeln und ${this._hDauer(s.schlaf)} Schlaf am Tag in den letzten ${s.n} Tagen.`
      : `${this._komma(s.mA)} Mahlzeiten und ${this._komma(s.w)} Windeln am Tag in den letzten ${s.n} Tagen.`];
    if (s.tageB >= s.n / 2 && s.mB) {
      const p = Math.round((s.mA - s.mB) / s.mB * 100);
      t.push(Math.abs(p) >= 5 ? `Das sind etwa ${Math.abs(p)} % ${p > 0 ? "mehr" : "weniger"} Mahlzeiten als davor.` : "Ungefähr so viele wie davor.");
    }
    if (naechteLaenger) t.push(`Die längste Pause pro Nacht liegt jetzt bei etwa ${this._hDauer(s.nachtA)} statt ${this._hDauer(s.nachtB)}.`);
    else if (s.p75) t.push(gleich ? `Die Abstände sind recht gleich, meist ${this._hDauer(s.p25)}–${this._hDauer(s.p75)}.` : `Die Abstände schwanken, meist ${this._hDauer(s.p25)}–${this._hDauer(s.p75)}.`);
    return { h, t: t.join(" ") };
  }

  // ---------- Leiste (layout: bar) ----------
  // Schmale Pille für die Startseite: je Kind ein Element mit Kürzel oder Foto, Name, letzter Mahlzeit und der Spanne der nächsten.
  // Die Daten und Regeln sind die der Hauptkarte (_vm, _naechsteKarte): Leiste und Baby-Tab sagen dasselbe. Geladen wird nur der
  // Stillkalender (siehe _load), gezeichnet wird, wenn sich ein Schalter ändert oder der Text (Minuten) — also nicht bei jedem hass.
  // Ein Tipp merkt das Kind in derselben Preference wie der Baby-Tab und öffnet nav_path; der Tab liest sie beim Wiederanhängen.
  _hassBar() {
    const kids = this.config.kids, sts = this._hass.states;
    const st = e => { const s = e && sts[e]; return s ? [s.state, s.last_changed, s.attributes && s.attributes.timestamp] : 0; };
    const sig = JSON.stringify([kids.map(k => [st(k.switch), st(k.start), k.entity && sts[k.entity] && sts[k.entity].attributes && sts[k.entity].attributes.entity_picture]), this._pauseMin()]);
    const lauf = kids.map(k => this._laeuft(k)), vorher = this._lauf;
    this._lauf = lauf;
    if (!this._built) { this._swSig = sig; this._buildBar(); this._load(); return; }
    // Beim Stopp schreibt die Automation den Termin erst nach ein paar Sekunden — mehrfach nachladen, wie in der Übersicht.
    if (vorher && vorher.some((v, i) => v && !lauf[i])) this._nachladen([3000, 8000, 20000, 40000]);
    if (sig !== this._swSig) { this._swSig = sig; this._paintBar(); }
  }
  _buildBar() {
    this._built = true; this._barHtml = "";
    this.innerHTML = `<div class="fb-card${this._inline ? " fb-inline" : ""}"><div class="fb-pill"></div></div>${this._stylesBar()}`;
    this.querySelector(".fb-card").addEventListener("click", ev => { const b = ev.target.closest("[data-kid]"); if (b) this._barTipp(b.dataset.kid); });
    this._paintBar();
  }
  // Neu zeichnen nur, wenn der Text ein anderer ist (jede Minute ändert sich „satt seit“ bzw. „stillt“).
  _paintBar() {
    const pille = this._built && this.querySelector(".fb-pill");
    if (!pille) return;
    const html = this.config.kids.map(k => this._barKind(k)).join(this._inline ? "" : `<i class="fb-sep" aria-hidden="true"></i>`);
    if (html === this._barHtml) return;
    this._barHtml = html; pille.innerHTML = html;
  }
  // Ein Kind: Kürzel, Name und der Zustand nach den Regeln von _naechsteKarte. Spanne und „Fällig“ nur mit Prognose (ab vier Abständen)
  // und höchstens acht Stunden nach der letzten Mahlzeit; danach „letzte vor …“. Ohne nav_path ist es kein Knopf.
  _barKind(k) {
    const jetzt = Date.now(), nav = !!this.config.nav_path, hm = t => this._hm(new Date(t));
    // inline: Gedämpftes über Deckkraft in eigenem Span (Farbe erbt vom Behälter); Fett und „Fällig“ bleiben davon unberührt
    const m = s => this._inline ? `<span class="fb-m">${s}</span>` : s;
    let dot = "", txt;
    if (!this._d) txt = m("lädt …");
    else if (this._laeuft(k)) { dot = `<i class="fb-puls" aria-hidden="true"></i>`; txt = `<b>stillt</b>${m(` · ${this._minText(jetzt - this._beginn(k))}`)}`; }
    else {
      const vm = this._vm(k), l = vm.letzte, p = vm.prog, seit = l ? jetzt - l.start : 0;
      if (!l) txt = m("noch nichts eingetragen");
      else if (seit > 8 * STD) txt = m(`letzte vor ${this._her(seit)}`);
      else {
        txt = m(`satt seit ${this._hDauer(seit)}`);
        if (p) txt += m(" · ") + (jetzt < p.lo ? `<b>${hm(p.lo)}–${hm(p.hi)}</b>` : jetzt <= p.hi ? `<b>jetzt–${hm(p.hi)}</b>` : `<span class="fb-due">Fällig</span>`);
      }
    }
    return `<${nav ? `button type="button"` : "div"} class="fb-k" data-kid="${U.esc(k.key)}" style="${this._kidStyle(k)}">${this._avatar(k, 22)}
      <b class="fb-n">${U.esc(k.name)}</b><span class="fb-o">·</span>${dot}<span class="fb-t">${txt}</span></${nav ? "button" : "div"}>`;
  }
  _barTipp(key) {
    const p = this.config.nav_path;
    if (!p || !this.config.kids.some(k => k.key === key)) return;
    this._kind = key; this._setPref("kind", key);   // derselbe Schlüssel wie im Baby-Tab (_pfx hängt an den Kinder-Keys)
    history.pushState(null, "", p);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
  }
  _stylesBar() {
    return `<style>
      /* Farben und Radien aus dem Theme (--fp-*), nach dem Komma der Rückfall; hell und dunkel macht das Theme */
      .fb-card{display:block;--b-bg:var(--ha-card-background, var(--card-background-color, #fff));--b-line:var(--divider-color, rgba(0,0,0,.12));
        --b-text:var(--primary-text-color, #212121);--b-mut:var(--secondary-text-color, #727272);--b-alert:var(--fp-alert, var(--warning-color, #B97F06));
        --c-nurse:var(--fp-c-nurse, #D9719F);container:fb-card / inline-size;}
      .fb-pill{display:flex;align-items:center;box-sizing:border-box;padding:7px 14px;border:1px solid var(--b-line);border-radius:999px;background:var(--b-bg);
        color:var(--b-text);font-size:.9rem;line-height:1.3;font-variant-numeric:tabular-nums;}
      .fb-k{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;margin:0;padding:3px 8px;border:0;border-radius:999px;
        background:none;font:inherit;color:inherit;text-align:left;cursor:default;-webkit-tap-highlight-color:transparent;}
      button.fb-k{cursor:pointer;}
      button.fb-k:active{background:var(--k1);}
      @media (hover:hover){ button.fb-k:hover{background:var(--k1);} }
      button.fb-k:focus-visible{outline:2px solid var(--k);outline-offset:1px;}
      .fb-card .fo-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex:none;overflow:hidden;font-size:11px !important;}   /* wie .fo-av der Hauptkarte: weiße Initiale auf der Kinderfarbe, in beiden Themes lesbar; nur größer als der Standard von _avatar */
      .fb-card .fo-av img{width:100%;height:100%;object-fit:cover;}
      .fb-n{flex:0 1 auto;min-width:2.5ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;}
      .fb-o{flex:none;color:var(--b-mut);margin:0 -2px;}
      .fb-t{flex:0 .0001 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--b-mut);font-weight:600;}
      .fb-t b{color:var(--b-text);font-weight:800;}
      .fb-due{display:inline-block;padding:0 9px;border-radius:999px;font-size:.84em;font-weight:800;line-height:1.5;color:var(--b-alert);
        background:var(--fp-alert-bg, color-mix(in srgb, var(--b-alert) 18%, transparent));}
      .fb-puls{flex:none;width:8px;height:8px;border-radius:50%;background:var(--c-nurse);margin:0 -1px;animation:fb-puls 1.4s ease-in-out infinite;}
      @keyframes fb-puls{50%{transform:scale(1.7);opacity:.35;}}
      .fb-sep{flex:none;width:1px;align-self:stretch;margin:2px 8px;background:var(--b-line);}
      /* Schmal (unter 700 px, gemessen: zwei Kinder mit „Name · satt seit 1:10 h · 22:24–22:49“ brauchen nebeneinander rund 690 px):
         eine Zeile je Kind untereinander, die Pille nur noch abgerundet statt rund. Etwas enger gesetzt, damit eine Zeile in
         343 px passt; der Name gibt als Erster nach (Ellipse). */
      @container fb-card (max-width: 699px){
        .fb-pill{flex-direction:column;align-items:stretch;gap:2px;padding:7px 12px;border-radius:var(--fp-radius, 16px);font-size:.86rem;}
        .fb-k{flex:none;justify-content:flex-start;gap:6px;padding:3px 4px;}
        .fb-sep{display:none;}
      }
      /* bar_style: inline (Begrüßung): keine Pille, kein Rahmen, keine Fläche, kein Außenabstand; immer eine Zeile je Kind untereinander.
         Farbe und Größe kommen vom Behälter (color/font-size: inherit); Gedämpftes über opacity statt --secondary-text-color, damit es auch
         auf dem farbigen Verlauf lesbar bleibt. Name und Text kürzen mit Ellipse, nichts läuft über. Steht hinter dem Container-Query,
         damit es dessen schmale Werte der Pille überstimmt. */
      .fb-inline .fb-pill{flex-direction:column;align-items:stretch;gap:0;padding:0;margin:0;border:0;border-radius:0;background:none;color:inherit;font-size:inherit;}
      .fb-inline .fb-k{flex:none;justify-content:flex-start;gap:7px;padding:3px 0;border-radius:6px;}
      .fb-inline .fb-sep{display:none;}
      .fb-inline .fb-o{color:inherit;opacity:.72;}
      .fb-inline .fb-t{color:inherit;}
      .fb-inline .fb-t b{color:inherit;}
      .fb-inline .fb-m{opacity:.8;}
      .fb-inline .fb-due{text-shadow:none;}   /* der Schatten der Begrüßung auf Bild/Blauverlauf verschmiert sonst den Chip */
      .fb-inline button.fb-k:active{background:none;opacity:.7;}
      @media (hover:hover){ .fb-inline button.fb-k:hover{background:none;} .fb-inline button.fb-k:hover .fb-n{text-decoration:underline;} }
      @media (prefers-reduced-motion: reduce){ .fb-puls{animation:none !important;} }
    </style>`;
  }

  // ---------- Aufbau ----------
  _build() {
    this._built = true;
    this._klebtEnde();   // Gerüst wird neu gebaut (z. B. nach setConfig): alte Beobachter hängen an Elementen, die es nicht mehr gibt
    this.innerHTML = `
      <ha-card class="fo-card">
        <div class="fo-sky"></div>
        <div class="fo-wacht" aria-hidden="true"></div>
        <div class="fo-top"></div>
        ${this._sw ? '<div class="fo-bw">' : ""}<div class="fo-body"><div class="fo-laden">Einträge werden geladen …</div></div>${this._sw ? '<i class="fo-edge fo-edge-l" hidden><b></b></i><i class="fo-edge fo-edge-r" hidden><b></b></i></div>' : ""}
        <div class="fo-dock">${this.config.action_bar === false ? "" : '<div class="fo-act"></div>'}<nav class="fo-tabbar">${this._tabsHtml()}</nav>${this._kd ? `<div class="fo-kdock" style="--fo-dgx:${Math.max(0, this._dg - 67)}px">${this._kdockHtml()}</div>` : ""}</div>
      </ha-card>${this._styles()}`;
    this._card = this.querySelector(".fo-card");
    if (this._kd) this._card.classList.add("fo-kd");
    if (this._sw) this._card.classList.add("fo-sw");
    if (this._sw && !this._kd && this.config.action_bar === false) this._card.classList.add("fo-noact");   // Dock wäre am Handy leer: ganz ausblenden
    this._card.classList.toggle("fo-dark", this._dunkel());
    this._slotMelden();
    this._card.addEventListener("click", ev => this._klick(ev));
    this._wischen(this.querySelector(".fo-body"));
  }
  // Der Kopf klebt am Handy (mehrere Kinder) unter der festen HA-Kopfzeile und bekommt dabei Fläche und Schatten. Ob er gerade klebt,
  // sagt der Wächter (.fo-wacht): ein 1-px-Streifen direkt vor .fo-top, der mit dem Inhalt scrollt. Verlässt er den
  // Bildschirm oben — der Rand ist der aufgelöste top-Wert der Kopfzeile —, klebt sie, und die Karte bekommt fo-stuck.
  // Das geht mit jedem Scroll-Container und ohne Scroll-Ereignisse. Den Rand liest die Funktion aus dem CSS; am Tablet
  // und mit einem Kind ist die Kopfzeile nicht sticky, dann gibt es keinen Beobachter. Eine zweite Beobachtung der
  // Kartenbreite stößt die Prüfung neu an, wenn Drehen oder Fensterbreite die Container-Query umschalten.
  _klebt() {
    const card = this._card, top = this.querySelector(".fo-top"), wacht = this.querySelector(".fo-wacht");
    if (!this._built || !card || !top || !wacht || !this.isConnected || !window.IntersectionObserver) return;
    if (!this._roK && window.ResizeObserver) {
      this._roK = new ResizeObserver(() => { if (card.clientWidth !== this._klebtW) { this._klebtW = card.clientWidth; this._klebt(); if (this._sw) this._pagerMitte(); } });
      this._roK.observe(card);
    }
    const cs = getComputedStyle(top), px = cs.position === "sticky" ? parseFloat(cs.top) : NaN;
    const rand = isFinite(px) ? Math.max(0, Math.round(px)) : -1;
    if (rand === this._klebtRand && (rand < 0 || this._io)) return;   // nichts geändert, nicht doppelt anlegen
    this._klebtAus();
    this._klebtRand = rand;
    if (rand < 0) return;
    this._io = new IntersectionObserver(es => {
      const e = es[es.length - 1], oben = e.rootBounds ? e.rootBounds.top : rand;
      this._card.classList.toggle("fo-stuck", !e.isIntersecting && e.boundingClientRect.top < oben);   // oben hinausgescrollt, nicht unten
    }, { rootMargin: `-${rand}px 0px 0px 0px`, threshold: 0 });
    this._io.observe(wacht);
  }
  _klebtAus() {
    if (this._io) { this._io.disconnect(); this._io = null; }
    this._klebtRand = null;
    if (this._card) this._card.classList.remove("fo-stuck");
  }
  _klebtEnde() {
    this._klebtAus();
    if (this._roK) { this._roK.disconnect(); this._roK = null; }
    this._klebtW = 0;
  }
  // Kind wählen (Schalter im Kopf, Wischen) — die Ansichten zeichnen sich danach für das neue Kind.
  _kindWahl(key) {
    if (key === this._kind || !this.config.kids.some(k => k.key === key)) return;
    this._kind = key; this._setPref("kind", key); this._paint(true);
  }
  // Ist nur eine Spalte zu sehen? Dieselbe Grenze wie die Container-Query im CSS: 680 px Inhaltsbreite (ohne 2 × 16 px Rand).
  _handy() { return this._card.clientWidth - 32 < 680; }
  _eineSpalte() { return this.config.kids.length > 1 && this._handy(); }
  // Waagrechtes Wischen über dem Inhalt wechselt das Kind: nach links das nächste, nach rechts das vorige
  // (mit swipe_views am Handy stattdessen die Ansicht, siehe _ansichtSchritt).
  // Nicht in Bereichen, die selbst wischen oder tippen (siehe _wischSperre).
  _wischen(body) {
    let von = null;
    body.addEventListener("touchstart", ev => {
      const t = ev.touches.length === 1 && ev.touches[0];
      von = t && !this._wischSperre(ev, body) ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    body.addEventListener("touchcancel", () => { von = null; }, { passive: true });
    body.addEventListener("touchend", ev => {
      const t = von && ev.changedTouches[0]; if (!t) return;
      const dx = t.clientX - von.x, dy = t.clientY - von.y; von = null;
      if (Math.abs(dx) <= 70 || Math.abs(dx) <= 2 * Math.abs(dy)) return;
      if (this._sw && this._handy()) { this._ansichtSchritt(dx < 0 ? 1 : -1); return; }   // swipe_views: Wischen wechselt die Ansicht, nicht das Kind
      if (!this._eineSpalte()) return;
      const kids = this.config.kids, i = kids.findIndex(k => k.key === this._kind), j = i + (dx < 0 ? 1 : -1);   // am Ende nicht herumspringen
      if (j >= 0 && j < kids.length) this._kindWahl(kids[j].key);
    }, { passive: true });
  }
  // Soll eine Berührung, die hier beginnt, nicht als Wischen der Karte zählen? Ohne swipe_views (Kindwechsel) sperren Chips, Blätter,
  // eingebettete Karten (Protokoll, Momente) und Eingabefelder, wie immer. Mit swipe_views am Handy füllen die eingebetteten Karten
  // fast den ganzen Inhalt, darum beginnt ein Wischen auch über ihnen (Knöpfe eingeschlossen: ein bewegter Finger löst keinen Klick
  // aus). Gesperrt ist dann nur, was selbst eine Geste braucht: Eingabefelder, offene Blätter und Dialoge (auch die der eingebetteten
  // Karten, sie hängen im Inhalt), die Chips und jedes Element im Pfad bis zum Inhalt, das waagrecht scrollen kann (Meilenstein-Bänder,
  // breite Tabellen). Der Pfad kommt aus composedPath(), so zählt auch ein Element in einem Shadow DOM.
  _wischSperre(ev, body) {
    if (!(this._sw && this._handy())) return !!(ev.target.closest && ev.target.closest(".fo-chips,.fo-sheet,.fo-emb,.fo-ms-host,input,textarea"));
    const pfad = ev.composedPath ? ev.composedPath() : [ev.target];
    for (const el of pfad) {
      if (el === body) break;
      if (!el || el.nodeType !== 1) continue;
      if (el.matches(".fo-chips,.fo-sheet,dialog,input,textarea,select,[contenteditable]:not([contenteditable=false])")) return true;
      if (el.scrollWidth > el.clientWidth + 1 && /^(auto|scroll)$/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  }
  _klick(ev) {
    const z = sel => ev.target.closest(sel);
    let b;
    // Klicks in eingebetteten Karten (Momente, Protokoll) gehören der jeweiligen Karte, die Übersicht ignoriert sie.
    // Die Karten bauen dabei Teile neu auf, der angeklickte Knopf hängt danach nicht mehr im Dokument —
    // deshalb über den Pfad beim Auslösen prüfen. Hat die Meilensteinkarte das Kind gewechselt, zieht der Kopf nach.
    const pfad = ev.composedPath ? ev.composedPath() : [];
    if (pfad.some(el => el.classList && el.classList.contains("fo-emb"))) {
      if (this._ms && pfad.includes(this._ms)) {
        const k = this.config.kids.find(x => (x.milestone_key || x.key) === this._ms._kind);
        if (k && k.key !== this._kind) { this._kind = k.key; this._setPref("kind", k.key); this.querySelector(".fo-top").innerHTML = this._kopf(); }
      }
      return;
    }
    if ((b = z(".fo-spark"))) { this._openChat(); return; }
    if ((b = z(".fo-gear"))) { this._sheetEinst(); return; }
    if ((b = z("[data-kind-sel]"))) { this._kindWahl(b.dataset.kindSel); return; }
    if ((b = z("[data-off]"))) { this._off = Math.min(0, Math.max(-(LADETAGE - 1), this._off + Number(b.dataset.off))); this._eAlle = false; this._paint(true); return; }
    // Hauptkarte und Jetzt-Zeilen in „Heute“ führen ins Protokoll dieses Kindes. Sie stehen vor [data-view], und ein Knopf darin
    // (■ Stoppen) gehört weiter sich selbst: Trifft der Tipp ein [data-act] innerhalb, geht es unten bei den Aktionen weiter.
    if ((b = z("[data-proto]"))) {
      const knopf = z("[data-act]");
      if (!(knopf && b.contains(knopf))) { this._zumProtokoll(b.dataset.kind, b.dataset.proto); return; }
    }
    if ((b = z("[data-kdock]"))) { if (b.dataset.kdock === "*") this._sheetSchlafAlle(); else this._sheetKind(this._kid(b.dataset.kdock)); return; }
    if ((b = z("[data-view]"))) { this._ansichtWechsel(b.dataset.view); return; }
    if ((b = z("[data-nav]"))) { const p = this.config[b.dataset.nav]; if (p) { history.pushState(null, "", p); window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true })); } return; }
    if ((b = z("[data-f]"))) { this._filter = b.dataset.f; this._setPref("filter", this._filter); this._paint(true); return; }
    if ((b = z("[data-sp]"))) { this._spanne = Number(b.dataset.sp); this._setPref("spanne", String(this._spanne)); this._paint(true); return; }
    if ((b = z("[data-schlaf]"))) { this._schlafToggle(b.dataset.schlaf); return; }
    if ((b = z("[data-schlaf-neu]"))) { this._sheetSchlaf(null, null); return; }
    if ((b = z("[data-suid]"))) {
      const kid = this._kid(b.dataset.kind), e = this._vm(kid).schlaf.find(x => x.uid === b.dataset.suid);
      if (e) this._sheetSchlaf(kid, e); return;
    }
    if ((b = z("[data-walle]"))) { this._wAlle = !this._wAlle; this._paint(true); return; }
    if ((b = z("[data-ealle]"))) { this._eAlle = !this._eAlle; this._paint(true); return; }
    if ((b = z("[data-euid]"))) {
      // Stillen und Fläschchen liegen im Stillkalender, Windeln im Windelkalender
      const kid = this._kid(b.dataset.kind), raw = this._d && this._d.kids[kid.key], windel = b.dataset.ek === "w";
      const e = raw && (windel ? raw.diapers : raw.feeds).find(x => x.uid === b.dataset.euid);
      if (e) this._sheetEintrag(kid, windel ? "windel" : e.typ, e);
      return;
    }
    if ((b = z("[data-nt]"))) { this._sheetNachtrag(this._kid(b.dataset.kind)); return; }
    if ((b = z("[data-wuid]"))) { const w = ((this._d && this._d.weights) || []).find(x => x.uid === b.dataset.wuid); if (w) this._sheetWiegen(this._kid(w.kind), w); return; }
    if ((b = z("[data-act]"))) {
      const kid = this._kid(b.dataset.kind);
      if (b.dataset.act === "still") this._toggle(kid);
      if (b.dataset.act === "windel") this._sheetWindel(kid);
      if (b.dataset.act === "flasche") this._sheetFlasche(kid);
      if (b.dataset.act === "wiegen") this._sheetWiegen(kid, null);
      return;
    }
  }

  // Ansicht wechseln (Leiste, Chip, Namenszeile oder Wischen). gleit = 1 (nächste) oder -1 (vorige): nur beim Wischen gleitet der Inhalt kurz.
  _ansichtWechsel(v, gleit) {
    const vorher = this._view;
    this._zielEnde();   // eine Ansicht per Leiste oder Chip ist ein eigener Wunsch: kein Nachführen mehr
    this._view = v; this._off = 0; this._paint(true);
    if (gleit) this._gleiten(gleit);
    if (vorher === "protokoll" && this._view !== vorher) this._load();   // was dort eingetragen wurde, soll gleich in den anderen Ansichten stehen
    // Am Handy mit mehreren Kindern klebt der Kopf unter der HA-Kopfzeile: den Kartenanfang dorthin scrollen, nicht darunter,
    // sonst verdeckt die klebende Zeile den Tagesschalter.
    this._card.style.scrollMarginTop = this._eineSpalte() ? "calc(var(--header-height, 56px) + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))" : "";
    window.scrollTo && this._card.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  // swipe_views: eine Ansicht weiter (1) oder zurück (-1); am Ende und am Anfang bleibt es stehen.
  _ansichtSchritt(richtung) {
    const liste = this._ansichten().views.map(x => x[0]), i = liste.indexOf(this._view), j = i + richtung;
    if (i < 0 || j < 0 || j >= liste.length) return;
    this._ansichtWechsel(liste[j], richtung);
  }
  // Kurzes Gleiten des Inhalts beim Wischen (Animation auf .fo-body, 220 ms); mit „weniger Bewegung“ entfällt es, auch per CSS.
  _gleiten(richtung) {
    const b = this.querySelector(".fo-body");
    if (!b || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    b.classList.remove("fo-gl-n", "fo-gl-v"); void b.offsetWidth;
    b.classList.add(richtung > 0 ? "fo-gl-n" : "fo-gl-v");
    clearTimeout(this._glT); this._glT = setTimeout(() => b.classList.remove("fo-gl-n", "fo-gl-v"), 300);
  }
  // swipe_views: die schmalen Randflächen zeigen, ob links oder rechts eine weitere Ansicht folgt.
  _randFlaechen() {
    const liste = this._ansichten().views, i = liste.findIndex(x => x[0] === this._view);
    const l = this.querySelector(".fo-edge-l"), r = this.querySelector(".fo-edge-r");
    if (l) l.hidden = !(i > 0);
    if (r) r.hidden = !(i >= 0 && i < liste.length - 1);
  }
  // Die Namenszeile ist schmaler als alle Namen: die aktuelle Ansicht liegt in der Mitte der Zeile.
  _pagerMitte() {
    const p = this.querySelector(".fo-pager"), c = p && p.querySelector(".fo-pg-cur");
    if (p && c && p.clientWidth) p.scrollLeft = c.offsetLeft - (p.clientWidth - c.offsetWidth) / 2;
  }

  _paint(force) {
    if (this._bar) { this._paintBar(); return; }
    if (!this._built || !this._d) return;
    if ((this._view === "protokoll" && !this._hatProtokoll()) || (this._view === "wachstum" && !this.config.weight_calendar) || (this._view === "momente" && !this.config.milestone_calendar)) this._view = "heute";
    const kids = this.config.kids, vms = kids.map(k => this._vm(k)), dunkel = this._dunkel();
    const sig = JSON.stringify([this._kind, this._view, this._off, this._filter, this._spanne, this._wAlle, this._eAlle, !!this._ref, dunkel, Math.floor(Date.now() / 30000),
      kids.map(k => [this._laeuft(k), this._seite(k), this._schlaeft(k)]),
      vms.map(v => [v.raw.feeds.map(e => `${e.uid}:${+e.start}:${+e.end}:${e.typ}:${e.ml}:${e.seite}`).join(), v.raw.diapers.map(e => `${e.uid}:${+e.start}:${e.art}`).join(), v.weights.map(w => `${w.uid}:${w.g}:${+w.date}:${w.zeit}`).join(), v.ms.length,
        v.schlaf.filter(x => !x.laeuft).map(x => `${x.uid}:${+x.start}:${+x.end}`).join()])]);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    this._card.classList.toggle("fo-dark", dunkel);
    this._card.classList.toggle("fo-multi", kids.length > 1);
    this.querySelector(".fo-top").innerHTML = this._kopf();
    const body = this.querySelector(".fo-body");
    // Jede Spalte besteht aus denselben Bausteinen in derselben Reihenfolge (leere bleiben als Platzhalter
    // stehen). Am Tablet teilen sich die Spalten die Zeilenhöhen (Subgrid), so steht nebeneinander, was zusammengehört.
    const teile = vms.map(vm => this._view === "muster" ? this._musterSpalte(vm) : this._view === "wachstum" ? this._wachstumSpalte(vm) : this._heuteSpalte(vm));
    const multi = kids.length > 1, n = Math.max(...teile.map(t => t.length));
    const spalten = vms.map((vm, i) => `<section class="fo-col${vm.kid.key === this._kind ? " fo-sel" : ""}">
      ${multi ? `<div class="fo-blk"><div class="fo-colhead">${this._avatar(vm.kid, 30)}<b>${U.esc(vm.kid.name)}</b><small>${this._alterZeile(vm.kid)}</small></div></div>` : ""}
      ${Array.from({ length: n }, (_, j) => `<div class="fo-blk">${teile[i][j] || ""}</div>`).join("")}</section>`).join("");
    const kopf = this._view === "muster" ? this._musterKopf() : this._view === "wachstum" ? this._wachstumKopf() : this._tagNav() + (this._off === 0 ? this._schlafLeiste() : "");
    if (this._view === "momente") this._zeigeMomente(body);
    else if (this._view === "protokoll") this._zeigeProtokoll(body);
    else body.innerHTML = kopf + `<div class="fo-grid" style="--rows:${n + (multi ? 1 : 0)}">${spalten}</div>`;
    this.querySelector(".fo-tabbar").innerHTML = this._tabsHtml();
    const act = this.querySelector(".fo-act");   // fehlt mit action_bar: false, dann steht im Dock nur die Ansichtsleiste
    if (act) act.innerHTML = this._aktionsleiste();   // in jeder Ansicht; am Tablet per CSS aus
    if (this._kd) {
      // Neu geschrieben wird die ganze Leiste, auch der Platz: eine Figur, die Pip hineingehängt hat, zieht in den neuen Platz um (kein Flackern, bis Pip sie wieder einhängt)
      const dock = this.querySelector(".fo-kdock"), alt = dock.querySelector(".fo-pipslot"), gast = alt ? Array.from(alt.childNodes) : [];
      dock.innerHTML = this._kdockHtml();
      const neu = dock.querySelector(".fo-pipslot");
      if (neu) for (const g of gast) neu.appendChild(g);
      this._slotMelden();
    }
    if (this._sw) { this._randFlaechen(); this._pagerMitte(); }
    this._klebt();   // fo-multi ist gesetzt: jetzt steht fest, ob die Kopfzeile klebt
    if (this._view === "wachstum") this._zeichne();
  }

  // Ansichtsleiste unten. Hängt nur an der Konfiguration und der gewählten Ansicht, nicht an den Daten — deshalb steht sie
  // schon im Gerüst (_build) und ist nie leer. Früher war sie bis zum ersten Laden leer und der Behälter per
  // „.fo-dock:has(.fo-tabbar:empty)“ ausgeblendet; Safari (Wand-Tablet) wertet diese Regel nach dem Füllen nicht immer
  // neu aus, dann fehlte die Leiste bis zum nächsten Neuaufbau.
  // Die verfügbaren Ansichten in fester Reihenfolge; nav = „Momente“ als Sprung in einen anderen Tab (memories_path), keine Ansicht der Karte.
  _ansichten() {
    const views = [["heute", "Heute"]];
    if (this._hatProtokoll()) views.push(["protokoll", "Protokoll"]);
    views.push(["muster", "Muster"]);
    if (this.config.weight_calendar) views.push(["wachstum", "Wachstum"]);
    if (this.config.milestone_calendar) views.push(["momente", "Momente"]);
    return { views, nav: !this.config.milestone_calendar && !!this.config.memories_path };
  }
  _tabsHtml() {
    const views = this._ansichten().views;
    const tabs = views.map(([v, t]) => `<button class="${this._view === v ? "fo-on" : ""}" data-view="${v}"><svg viewBox="0 0 24 24">${ICO[v]}</svg><span>${t}</span></button>`);
    if (!this.config.milestone_calendar && this.config.memories_path) tabs.push(`<button data-nav="memories_path"><svg viewBox="0 0 24 24">${ICO.momente}</svg><span>Momente</span></button>`);
    return tabs.join("");
  }

  // Kopf wie in Buma: Foto, Name, Alter; rechts ⚙ (nur mit Helfern) und ✦ für „Frag nach“.
  // Bei mehreren Kindern steht statt des Namens ein Schalter mit einem großen Knopf je Kind (Foto, Name, Alter);
  // der gewählte ist in der Kinderfarbe gefüllt. Am Tablet stehen Zwillinge nebeneinander — dann zeigt der Kopf beide.
  // Bei mehreren Kindern klebt der Kopf am Handy beim Scrollen unter der HA-Kopfzeile (Klasse fo-stuck an der Karte, siehe
  // _klebt und das CSS). Er behält dabei Größe und Inhalt; nur Fläche und Schatten dahinter blenden ein.
  _kopf() {
    const kids = this.config.kids, k = this._kid(this._kind);
    const gleichAlt = kids.every(x => x.birth === kids[0].birth && x.ga === kids[0].ga);
    const einer = kids.length > 1
      ? `<div class="fo-who fo-who-one fo-kseg">${kids.map(x => `<button type="button" class="fo-kb${x.key === k.key ? " fo-on" : ""}" data-kind-sel="${U.esc(x.key)}" style="--k:${U.esc(x.color)};--k2:${U.esc(this._tint(x.color, .22))}" aria-pressed="${x.key === k.key}">${this._avatar(x, 30)}<span class="fo-kbn"><b>${U.esc(x.name)}</b><small>${this._alterTeile(x).filter(Boolean).join("<br>")}</small></span></button>`).join("")}</div>`
      : `<div class="fo-who fo-who-one">${this._avatar(k, 46)}<span class="fo-wn"><b>${U.esc(k.name)}</b><small>${this._alterZeile(k)}</small></span></div>`;
    const alle = kids.length > 1 ? `<div class="fo-who fo-who-all"><span class="fo-avs">${kids.map(x => this._avatar(x, 46)).join("")}</span>
      <span class="fo-wn"><b>${kids.map(x => U.esc(x.name)).join(" & ")}</b><small>${gleichAlt ? this._alterZeile(kids[0]) : ""}</small></span></div>` : "";
    const c = this.config, gear = c.reminder_entity || c.reminder_night_entity || c.meal_pause_entity
      ? `<button class="fo-gear" type="button" aria-label="Einstellungen" title="Einstellungen">⚙\uFE0E</button>` : "";
    const spark = c.chat ? `<button class="fo-spark" type="button" aria-label="Frag nach" title="Frag nach">${SPARK}</button>` : "";
    return einer + alle + gear + spark + (this._sw ? this._pagerHtml() : "");
  }
  // swipe_views: Namen aller Ansichten unter der Kinderwahl. Die aktuelle ist größer und unterstrichen, die direkten Nachbarn
  // gedämpft, die übrigen blasser. Jeder Name ist ein Knopf (Tipp wechselt die Ansicht). Am Tablet per CSS aus.
  _pagerHtml() {
    const a = this._ansichten(), i = a.views.findIndex(x => x[0] === this._view);
    const knoepfe = a.views.map(([v, t], n) => {
      const d = Math.abs(n - i), cls = d === 0 ? "fo-pg-cur" : d === 1 ? "fo-pg-nb" : "";
      return `<button type="button" class="fo-pg${cls ? ` ${cls}` : ""}" data-view="${v}"${d === 0 ? ' aria-current="true"' : ""}>${t}</button>`;
    });
    if (a.nav) knoepfe.push('<button type="button" class="fo-pg" data-nav="memories_path">Momente</button>');
    return `<nav class="fo-pager" aria-label="Ansichten">${knoepfe.join("")}</nav>`;
  }
  _tagNav() {
    const d = this._mitternacht(new Date(), this._off);
    // Mit swipe_views am Handy steht der Tag schon in der Namenszeile („Heute“): die Tageszeile zeigt dann das Datum
    const name = this._off === 0 && !(this._sw && this._handy()) ? "Heute" : this._off === -1 ? "Gestern" : d.toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });
    return `<div class="fo-daynav"><button type="button" data-off="-1" aria-label="Tag zurück" ${this._off <= -(LADETAGE - 1) ? "disabled" : ""}>‹</button>
      <span>${name}</span><button type="button" data-off="1" aria-label="Tag vor" ${this._off >= 0 ? "disabled" : ""}>›</button></div>`;
  }

  // Schlaf wie bei Napper und Buma per Knopf: „Beide schlafen“ und je Kind, über den Spalten — nur am Tablet.
  // Schläft ein Kind, ist sein Knopf gefüllt und zeigt die Dauer; die kleine Zeile sagt, was der nächste Tipp tut.
  // Am Handy ist die ganze Leiste per CSS aus: Das gewählte Kind und „Beide“ schaltet die Aktionsleiste unten
  // (_aktionsleiste), Schlaf nachtragen geht dort über „＋ Nachtragen“ bei den Einträgen.
  _schlafLeiste() {
    const kids = this.config.kids.filter(k => k.sleep_switch);
    if (!kids.length) return "";
    const jetzt = Date.now(), an = kids.filter(k => this._schlaeft(k)), alle = an.length === kids.length;
    const knopf = (key, emoji, text, sub, aktiv) => `<button type="button" class="fo-sl${aktiv ? " fo-sl-an" : ""}" data-schlaf="${U.esc(key)}">
      <span class="fo-sle">${emoji}</span><span class="fo-slx"><span class="fo-slt">${text}</span>${sub ? `<span class="fo-sls">${sub}</span>` : ""}</span></button>`;
    const zwei = kids.length === 2, beideText = zwei ? "Beide schlafen" : "Alle schlafen";
    const tablet = alle ? `☀️ ${zwei ? "Beide" : "Alle"} aufgewacht` : an.length ? `${an.map(k => U.esc(k.name)).join(", ")} schläft schon` : "";
    const beide = kids.length > 1 ? knopf("*", alle ? "💤" : "😴", beideText, tablet, alle) : "";
    const einzeln = kids.map(k => {
      if (this._schlaeft(k)) {
        const ab = this._schlafBeginn(k);
        return knopf(k.key, "💤", `${U.esc(k.name)} · <span class="fo-dauer" data-ab="${ab}">${this._hDauer(jetzt - ab)}</span>`, "☀️ Aufgewacht", true);
      }
      const l = this._vm(k).schlaf.slice(-1)[0], wach = l && jetzt - l.end < TAG ? `wach seit ${this._hDauer(jetzt - l.end)}` : "";
      return knopf(k.key, "😴", `${U.esc(k.name)} schläft`, wach, false);
    }).join("");
    const plus = this.config.kids.some(k => k.sleep_calendar) ? `<button type="button" class="fo-sl-plus" data-schlaf-neu aria-label="Schlaf nachtragen" title="Schlaf nachtragen">＋</button>` : "";
    // Zwei Reihen (oben „Beide schlafen“, darunter je Kind), am Tablet macht das CSS daraus eine.
    return `<div class="fo-sleep">${beide ? `<div class="fo-sl-row">${beide}${plus}</div><div class="fo-sl-row">${einzeln}</div>` : `<div class="fo-sl-row">${einzeln}${plus}</div>`}</div>`;
  }
  // Wie lange das Kind schon wach ist („H:MM h“), solange die letzte Schlafphase weniger als einen Tag zurückliegt; sonst leer.
  _wachSeit(kid, jetzt) {
    const raw = this._d && this._d.kids[kid.key], s = (raw && raw.sleeps) || [], l = s[s.length - 1];
    return l && jetzt - l.end < TAG ? this._hDauer(jetzt - l.end) : "";
  }

  // Aktionsleiste unten am Handy, in jeder Ansicht: Schlaf, „Beide“ (bzw. „Alle“), Stillen, Windel und Fläschchen,
  // nur was konfiguriert ist. Schlaf, Stillen, Windel und Fläschchen gelten für das gewählte Kind; „Beide“ schaltet
  // wie „Beide schlafen“ am Tablet alle Kinder mit Schlafschalter (data-schlaf="*"), es steht nur da, wo es mindestens zwei sind.
  // Die Knöpfe tragen dieselben data-Attribute wie Schnellknöpfe und Schlafleiste, _klick behandelt sie also mit.
  // Am Tablet ist die Leiste per CSS aus (dort stehen die Schnellknöpfe in der Spalte). Gezeichnet wird sie bei jedem
  // _paint; dessen Signatur enthält Laufen und Schlafen aller Kinder, „Beide“ folgt also auch dem Schalter des anderen Kindes.
  _aktionsleiste() {
    const k = this._kid(this._kind), jetzt = Date.now(), key = U.esc(k.key), name = U.esc(k.name), out = [];
    const knopf = (farbe, attr, cls, label, emoji, text, sub, fuerAlle) => `<button type="button" class="fo-q fo-qa${cls ? ` ${cls}` : ""}" style="--q:${farbe}" ${attr}${fuerAlle ? "" : ` data-kind="${key}"`} aria-label="${label}${fuerAlle ? "" : ` · ${name}`}">
      <span class="fo-qe">${emoji}</span><span class="fo-qt">${text}</span>${sub ? `<span class="fo-qs">${sub}</span>` : ""}</button>`;
    if (k.sleep_switch) {
      if (this._schlaeft(k)) {
        const ab = this._schlafBeginn(k);
        out.push(knopf("var(--c-sleep)", `data-schlaf="${key}"`, "fo-qa-an", "Schlaf beenden", "💤", `<span class="fo-dauer" data-ab="${ab}">${this._hDauer(jetzt - ab)}</span>`, "Aufgewacht"));
      } else {
        const wach = this._wachSeit(k, jetzt);
        out.push(knopf("var(--c-sleep)", `data-schlaf="${key}"`, "", "Schlaf", "😴", "Schläft", wach ? `wach ${wach}` : ""));
      }
    }
    const schlafKids = this.config.kids.filter(x => x.sleep_switch);
    if (schlafKids.length > 1) {
      const wer = schlafKids.length === 2 ? "Beide" : "Alle", alleAn = schlafKids.every(x => this._schlaeft(x));
      out.push(alleAn ? knopf("var(--c-sleep)", `data-schlaf="*"`, "fo-qa-an", `${wer} aufwecken`, "☀️", `${wer} wach`, "", true)
        : knopf("var(--c-sleep)", `data-schlaf="*"`, "", `${wer} schlafen`, "😴", wer, "", true));
    }
    if (k.switch) {
      const lauf = this._laeuft(k);
      out.push(knopf("var(--c-nurse)", `data-act="still"`, lauf ? "fo-q-run" : "", lauf ? "Stillen stoppen" : "Stillen", lauf ? "■" : "🤱", lauf ? "Stopp" : "Stillen", ""));
    }
    if (k.diaper_calendar) out.push(knopf("var(--c-diaper)", `data-act="windel"`, "", "Windel", "💩", "Windel", ""));
    if (k.feeding_calendar) out.push(knopf("var(--c-bottle)", `data-act="flasche"`, "", "Fläschchen", "🍼", "Fläschchen", ""));
    return out.join("");
  }

  // ---------- Heute ----------
  // Feste Bausteine (sechs): Schnellknöpfe, Hauptkarte, Jetzt, Tag, Chips (Wachstum, Momente), Einträge.
  _heuteSpalte(vm) {
    const k = vm.kid, heute = this._off === 0, tag = this._mitternacht(new Date(), this._off);
    const b = ["", "", ""];
    if (heute) {
      const lauf = this._laeuft(k), ab = lauf ? this._beginn(k) : 0;
      b[0] = `<div class="fo-quick">
        ${k.switch ? `<button class="fo-q${lauf ? " fo-q-run" : ""}" style="--q:var(--c-nurse)" data-act="still" data-kind="${U.esc(k.key)}"><span class="fo-qe">${lauf ? "■" : "🤱"}</span><span>${lauf ? "Stopp" : "Stillen"}</span></button>` : ""}
        ${k.diaper_calendar ? `<button class="fo-q" style="--q:var(--c-diaper)" data-act="windel" data-kind="${U.esc(k.key)}"><span class="fo-qe">💩</span><span>Windel</span></button>` : ""}
        ${k.feeding_calendar ? `<button class="fo-q" style="--q:var(--c-bottle)" data-act="flasche" data-kind="${U.esc(k.key)}"><span class="fo-qe">🍼</span><span>Fläschchen</span></button>` : ""}
      </div>`;
      b[1] = this._naechsteKarte(vm, lauf, ab);
      b[2] = this._jetztKarten(vm, lauf, ab);
    }
    // Zahlen, Streifen und Einträge des gewählten Tags
    const t0 = +tag, t1 = t0 + TAG;
    const meals = vm.meals.filter(m => m.start >= t0 && m.start < t1), fe = vm.raw.feeds.filter(e => +e.start >= t0 && +e.start < t1);
    const wi = vm.raw.diapers.filter(e => +e.start >= t0 && +e.start < t1);
    const still = fe.filter(e => e.typ === "stillen").reduce((s, e) => s + Math.max(0, e.end - e.start), 0), ml = fe.filter(e => e.typ === "flasche").reduce((s, e) => s + (e.ml || 0), 0);
    const schlafTag = vm.schlaf.reduce((s, e) => s + this._ueber(+e.start, +e.end, t0, t1), 0), sl = vm.schlaf.filter(e => +e.start >= t0 && +e.start < t1);
    // Immer dieselben Zahlen (nach Konfiguration, nicht nach Daten): Zahl fett, Wort leise, ohne Trennzeichen (Abstand per gap)
    const zahl = (z, w) => `<span><b>${z}</b> ${w}</span>`;
    const zahlen = [
      k.feeding_calendar ? zahl(meals.length, meals.length === 1 ? "Mahlzeit" : "Mahlzeiten") : "",
      k.feeding_calendar ? zahl(still ? this._hDauer(still) : "–", "gestillt") : "",
      k.feeding_calendar ? zahl(ml ? `${ml} ml` : "–", "Fläschchen") : "",
      k.diaper_calendar ? zahl(wi.length, wi.length === 1 ? "Windel" : "Windeln") : "",
      k.sleep_calendar || k.sleep_switch ? zahl(schlafTag ? this._hDauer(schlafTag) : "–", "Schlaf") : "",
    ].filter(Boolean);
    const tagKarte = `<div class="fo-sec">Tag</div><div class="fo-box fo-tag">${this._streifen(vm, tag, "alle", true)}${zahlen.length ? `<div class="fo-zahlen">${zahlen.join("")}</div>` : ""}</div>`;
    return [...b, tagKarte, heute ? this._chips(vm) : "", this._liste(vm, fe, wi, sl)];
  }

  // Die hervorgehobene Karte — bei Buma „Next sleep“, hier die nächste Mahlzeit.
  // Ein Tipp auf die Karte (außer auf „■ Stoppen“) öffnet das Protokoll dieses Kindes bei der Stillkarte, ohne sichtbaren Hinweis.
  _naechsteKarte(vm, lauf, ab) {
    const jetzt = Date.now(), l = vm.letzte, p = vm.prog, k = vm.kid;
    const ziel = this._protoZiel(k, "still");
    const zuletzt = l ? `${l.evs.map(e => e.typ === "flasche" ? `Fläschchen${e.ml ? ` ${e.ml} ml` : ""}` : `Stillen${e.seite ? ` ${e.seite}` : ""} ${this._minText(e.end - e.start)}`).join(" + ")} um ${l.geschaetzt ? "ca. " : ""}${this._wann(l.start)}` : "";
    if (lauf) {
      const s = this._seite(k);
      return `<div class="fo-next fo-next-run"${ziel}><div class="fo-nl"><i class="fo-puls"></i>Stillt gerade</div>
        <div class="fo-nb fo-uhr" data-ab="${ab}">${this._uhr((jetzt - ab) / 1000)}</div>
        <div class="fo-ns">${s ? `${U.esc(s)} · ` : ""}seit ${this._hm(new Date(ab))}</div>
        <button class="fo-nbtn" type="button" data-act="still" data-kind="${U.esc(k.key)}">■ Stoppen</button></div>`;
    }
    if (!l) return `<div class="fo-next"${ziel}><div class="fo-nl">Mahlzeiten</div><div class="fo-nb">–</div><div class="fo-ns">Noch nichts eingetragen</div></div>`;
    const seit = jetzt - l.start;
    if (!p || seit > 8 * STD) {
      return `<div class="fo-next"${ziel}><div class="fo-nl">Letzte Mahlzeit</div><div class="fo-nb">${this._her(seit)}</div><div class="fo-nf">${U.esc(zuletzt)}</div></div>`;
    }
    const big = jetzt < p.lo ? `${this._hm(new Date(p.lo))} – ${this._hm(new Date(p.hi))}` : jetzt <= p.hi ? `jetzt – ${this._hm(new Date(p.hi))}` : "Fällig";
    return `<div class="fo-next${jetzt > p.hi ? " fo-next-due" : ""}"${ziel}><div class="fo-nl">Nächste Mahlzeit</div>
      <div class="fo-nb">${big}</div>
      <div class="fo-ns">satt seit ${this._hDauer(seit)} · Abstand ${p.teil ? `${p.teil} ` : ""}meist ~${this._hDauer(p.med)}</div></div>`;
  }

  // „Jetzt“ als Liste: je Tätigkeit eine Zeile mit farbigem Symbol, dem Wert (wie lange es her ist) und einer kleinen Zeile
  // „Tätigkeit · Detail“; rechts optional, wann es wieder so weit sein dürfte oder „Fällig“.
  _jetztKarten(vm, lauf, ab) {
    const k = vm.kid, jetzt = Date.now(), zeilen = [];
    // Welche Zeilen es gibt, hängt nur an der Konfiguration — so stehen sie bei Zwillingen auf einer Linie.
    // Stillen und Fläschchen führen per Tipp zur Stillkarte dieses Kindes im Protokoll, die Windelzeile zur Windelkarte.
    // Ohne Stillkarte (kein Schalter) bleibt für Stillen und Fläschchen der alte Weg in die Ansicht „Protokoll“.
    const still = this._protoZiel(k, "still") || (this._hatProtokoll() ? ` data-view="protokoll"` : ""), windel = this._protoZiel(k, "windel");
    // alarm: Wert in Alarmfarbe; rechts: HTML der rechten Spalte (oder leer); link: "still" oder "windel" = antippbar
    const zeile = (farbe, emoji, wert, unter, rechts, link, alarm) => `<div class="fo-nr"${link === "still" ? still : link === "windel" ? windel : ""} style="--nr:${farbe}">
      <span class="fo-nrk">${emoji}</span><div class="fo-nrm"><b${alarm ? ` class="fo-nr-due"` : ""}>${wert}</b><small>${unter}</small></div>${rechts ? `<div class="fo-nrr">${rechts}</div>` : ""}</div>`;
    const faellig = `<span class="fo-nr-due">Fällig</span>`;
    // Unter einem Tag nur „1:47 h“, sonst Wochentag und Uhrzeit statt „2 T. 11 h“, dazu „vor n Tagen“
    const her = t => { const d = jetzt - t; if (d < TAG) return [this._her(d), ""]; const n = Math.floor(d / TAG); return [`${WT[new Date(t).getDay()]} ${this._hm(new Date(t))}`, `vor ${n} ${n === 1 ? "Tag" : "Tagen"}`]; };
    const leer = (farbe, emoji, text, link) => zeile(farbe, emoji, "–", text, "", link);
    if (k.sleep_calendar || k.sleep_switch) {
      const l = vm.schlaf[vm.schlaf.length - 1], p = vm.schlafProg;
      if (vm.schlaeft) {
        // Die laufende Zeit steht im Schlafknopf. Die Zeile nennt den Beginn und, wie lange es sonst dauert.
        const dauern = vm.schlaf.filter(x => !x.laeuft && +x.end > +x.start && +x.end >= jetzt - 72 * STD).map(x => +x.end - +x.start);
        zeilen.push(zeile("var(--c-sleep)", "😴", `seit ${this._hm(new Date(vm.schlafAb))}`, dauern.length >= 3 ? `Schlaf · meist ~${this._hDauer(this._median(dauern))}` : "Schlaf"));
      } else if (l && jetzt - l.end < TAG) {
        // Wach: der Ausblick auf den nächsten Schlaf (Spanne aus den eigenen Wachphasen), ohne Prognose nur „wach seit“
        const wach = `wach seit ${this._hm(new Date(l.end))}`;
        if (!p) zeilen.push(zeile("var(--c-sleep)", "😴", wach, "Schlaf"));
        else if (jetzt <= p.hi) zeilen.push(zeile("var(--c-sleep)", "😴", jetzt < p.lo ? `~${this._hm(new Date(p.lo))}–${this._hm(new Date(p.hi))}` : `jetzt – ${this._hm(new Date(p.hi))}`, `nächster Schlaf · ${wach}`));
        else zeilen.push(zeile("var(--c-sleep)", "😴", "Länger wach", `als sonst · ${wach}`, "", false, jetzt - l.end <= 8 * STD));
      } else zeilen.push(leer("var(--c-sleep)", "😴", l ? "Schlaf · länger nichts eingetragen" : "Schlaf · noch nichts eingetragen"));
    }
    if (k.feeding_calendar || k.switch) {
      const st = vm.raw.feeds.filter(e => e.typ === "stillen").pop(), l = vm.letzte;
      const ziel = this._grenze(k, jetzt) * STD, due = !lauf && l && jetzt - l.start >= ziel && jetzt - l.start <= 8 * STD;
      if (lauf) {
        // Die laufende Uhr steht nur in der Hauptkarte. Die Zeile nennt die Seite und den Beginn.
        const sd = this._seite(k);
        zeilen.push(zeile("var(--c-nurse)", "🤱", sd ? U.esc(sd.charAt(0).toUpperCase() + sd.slice(1)) : "läuft", `Stillen · seit ${this._hm(new Date(ab))}`, "", "still"));
      } else if (st) {
        // Die Spanne der nächsten Mahlzeit steht nur in der Hauptkarte. Unter einem Tag: Seite und Dauer des letzten Stillens.
        const [w, u] = her(+st.start), davon = U.esc([st.seite, this._minText(+st.end - +st.start)].filter(Boolean).join(" "));
        zeilen.push(zeile("var(--c-nurse)", "🤱", w, `Stillen${jetzt - st.start < TAG ? (davon ? ` · ${davon}` : "") : ` · ${u}`}`, due ? faellig : "", "still"));
      } else zeilen.push(leer("var(--c-nurse)", "🤱", "Stillen · noch nichts eingetragen", "still"));
    }
    if (k.feeding_calendar) {
      const fl = vm.raw.feeds.filter(e => e.typ === "flasche").pop();
      if (fl) { const [w, u] = her(+fl.start); zeilen.push(zeile("var(--c-bottle)", "🍼", w, ["Fläschchen", u, fl.ml ? `${fl.ml} ml` : ""].filter(Boolean).join(" · "), "", "still")); }
      else zeilen.push(leer("var(--c-bottle)", "🍼", "Fläschchen · noch keins", "still"));
    }
    if (k.diaper_calendar) {
      if (vm.windel) {
        const p = this._prognoseWindel(vm.raw.diapers, jetzt), due = p && jetzt > p.hi && jetzt - vm.windel.start <= 8 * STD, [w, u] = her(+vm.windel.start);
        // Stuhl als Zusatz in der Windelzeile statt als eigene Zeile
        const stuhl = !vm.stuhl ? "noch kein Stuhl" : vm.stuhl === vm.windel ? "mit Stuhl" : `Stuhl ${jetzt - vm.stuhl.start < TAG ? `vor ${this._her(jetzt - vm.stuhl.start)}` : her(+vm.stuhl.start)[0]}`;
        zeilen.push(zeile("var(--c-diaper)", "💩", w, ["Windel", u, stuhl].filter(Boolean).join(" · "),
          due ? faellig : p ? `<span>Nächste</span><span>~${this._hm(new Date(p.lo))}–${this._hm(new Date(p.hi))}</span>` : "", "windel"));
      } else zeilen.push(leer("var(--c-diaper)", "💩", "Windel · noch nichts eingetragen", "windel"));
    }
    return zeilen.length ? `<div class="fo-sec">Jetzt</div><div class="fo-box fo-now">${zeilen.join("")}</div>` : "";
  }

  // Ein Tag als Streifen von 0 bis 24 Uhr: Stillen rosa, Fläschchen orange, Windeln als schmale Striche.
  _streifen(vm, tag, filter, ticks) {
    const t0 = +tag, t1 = t0 + TAG, pos = t => Math.max(0, Math.min(100, (t - t0) / TAG * 100));
    const teile = [];
    if (filter === "alle" || filter === "schlaf") {
      vm.schlaf.filter(e => +e.end > t0 && +e.start < t1).forEach(e => teile.push(`<i class="fo-s${filter === "schlaf" ? " fo-s1" : ""}" style="left:${pos(+e.start).toFixed(2)}%;width:${Math.max(.5, pos(+e.end) - pos(+e.start)).toFixed(2)}%" title="${this._hm(e.start)}–${e.laeuft ? "jetzt" : this._hm(e.end)} Schlaf"></i>`));
    }
    if (filter === "alle" || filter === "stillen" || filter === "flasche") {
      vm.raw.feeds.filter(e => (filter === "alle" || e.typ === filter) && +e.end >= t0 && +e.start < t1).forEach(e => {
        const flasche = e.typ === "flasche", a = flasche ? +e.start - 10 * MIN : +e.start, b = flasche ? +e.start : Math.max(+e.end, +e.start + 4 * MIN);
        teile.push(`<i class="fo-b" style="left:${pos(a).toFixed(2)}%;width:${Math.max(.7, pos(b) - pos(a)).toFixed(2)}%;background:${this._farbe(e.typ)}" title="${this._hm(e.start)} ${flasche ? `Fläschchen${e.ml ? ` ${e.ml} ml` : ""}` : `Stillen ${this._minText(e.end - e.start)}`}"></i>`);
      });
    }
    if (filter === "alle" || filter === "windel") {
      vm.raw.diapers.filter(e => +e.start >= t0 && +e.start < t1).forEach(e =>
        teile.push(`<i class="fo-w" style="left:${pos(+e.start).toFixed(2)}%;background:${this._farbe(e.art)}" title="${this._hm(e.start)} Windel ${e.art}"></i>`));
    }
    const now = Date.now() >= t0 && Date.now() < t1 ? `<i class="fo-jetzt" style="left:${pos(Date.now()).toFixed(2)}%"></i>` : "";
    return `<div class="fo-strip${ticks ? " fo-strip-l" : ""}"><div class="fo-track">${teile.join("")}${now}</div>${ticks ? this._ticks() : ""}</div>`;
  }
  _ticks() { return `<div class="fo-ticks">${[0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${h}</span>`).join("")}</div>`; }

  _liste(vm, fe, wi, sl) {
    // ek: s = Schlaf, f = Stillen/Fläschchen, w = Windel — jede Zeile mit uid lässt sich per Tipp ändern oder löschen
    const z = [
      ...(sl || []).map(e => ({ t: +e.start, f: "var(--c-sleep)", s: e.laeuft ? "Schläft" : `Schlaf bis ${this._hm(e.end)}`, d: this._minText(e.end - e.start), uid: e.laeuft ? "" : e.uid, ek: "s" })),
      ...fe.map(e => ({ t: +e.start, f: this._farbe(e.typ), s: e.typ === "flasche" ? `Fläschchen${e.ml ? ` ${e.ml} ml` : ""}` : `Stillen${e.seite ? ` ${e.seite}` : ""}`, d: e.typ === "flasche" ? "" : this._minText(e.end - e.start), uid: e.uid, ek: "f" })),
      ...wi.map(e => ({ t: +e.start, f: this._farbe(e.art), s: `Windel ${e.art === "beides" ? "nass + voll" : e.art}`, d: "", uid: e.uid, ek: "w" })),
    ].sort((a, b) => b.t - a.t);
    const kk = U.esc(vm.kid.key), plus = this._nachtragOptionen(vm.kid).length
      ? `<button type="button" class="fo-plus" data-nt data-kind="${kk}">＋ Nachtragen</button>` : "";
    const kopf = `<div class="fo-sec fo-sech"><span>Einträge</span>${plus}</div>`;
    if (!z.length) return `${kopf}<div class="fo-leer">An diesem Tag ist nichts eingetragen.</div>`;
    const zeile = x => `<i style="background:${x.f}"></i><span>${U.esc(x.s)}</span><small>${x.d}</small><time>${this._hm(new Date(x.t))}</time>`;
    const zeig = this._eAlle ? z : z.slice(0, 5);   // standardmäßig die letzten fünf
    return `${kopf}<div class="fo-box">${zeig.map(x => !x.uid ? `<div class="fo-li">${zeile(x)}</div>`
      : x.ek === "s" ? `<button type="button" class="fo-li fo-wli" data-suid="${U.esc(x.uid)}" data-kind="${kk}">${zeile(x)}</button>`
      : `<button type="button" class="fo-li fo-wli" data-euid="${U.esc(x.uid)}" data-ek="${x.ek}" data-kind="${kk}">${zeile(x)}</button>`).join("")}</div>${z.length > 5 ? `<button class="fo-more" type="button" data-ealle>${this._eAlle ? "Weniger zeigen" : `Alle ${z.length} Einträge`}</button>` : ""}`;
  }

  // Wachstum und Momente — in Buma eigene Bereiche, hier zwei kleine Chips; ein Tipp öffnet die jeweilige Ansicht.
  _chips(vm) {
    const w = vm.weights, wl = w[w.length - 1], vor = wl && (w.slice().reverse().find(x => wl.date - x.date >= 5 * TAG) || w[w.length - 2]), mz = vm.ms[vm.ms.length - 1];
    const chips = [];
    if (this.config.weight_calendar) chips.push(`<button type="button" class="fo-mchip" data-view="wachstum"><span>⚖️</span><span class="fo-mchip-t">${wl
      ? `${this._kg(wl.g)}${vor ? ` · ${this._g(wl.g - vor.g)}` : ` · am ${this._dm(wl.date)}`}` : "noch nicht gewogen"}</span></button>`);
    if (this.config.milestone_calendar) chips.push(`<button type="button" class="fo-mchip" data-view="momente"><span>${mz ? U.esc(mz.e) : "⭐"}</span><span class="fo-mchip-t">${mz
      ? `<span class="fo-mchip-cut">${U.esc(mz.t)}</span><span class="fo-mchip-d">· ${this._dm(mz.date)}</span>` : "noch kein Meilenstein"}</span></button>`);
    return chips.length ? `<div class="fo-mchips">${chips.join("")}</div>` : "";
  }

  // ---------- Muster ----------
  _musterKopf() {
    const chips = [["alle", "Alle", ""], ["stillen", "Stillen", "var(--c-nurse)"], ["flasche", "Fläschchen", "var(--c-bottle)"], ["windel", "Windel", "var(--c-diaper)"]];
    if (this.config.kids.some(k => k.sleep_calendar)) chips.push(["schlaf", "Schlaf", "var(--c-sleep)"]);
    const bericht = this._hatProtokoll() ? `<div class="fo-bericht"><button type="button" data-view="protokoll">🖨 Bericht</button><span>Bericht je Kind im Stillprotokoll</span></div>` : "";
    return `<div class="fo-mtitle"><b>Muster</b><span>Jeder Tag nebeneinander</span></div>${bericht}
      <div class="fo-mctl"><div class="fo-seg"><button type="button" data-sp="7" class="${this._spanne === 7 ? "fo-on" : ""}">Woche</button><button type="button" data-sp="14" class="${this._spanne === 14 ? "fo-on" : ""}">2 Wochen</button></div>
      <div class="fo-chips">${chips.map(([f, t, c]) => `<button type="button" data-f="${f}" class="${this._filter === f ? "fo-on" : ""}" style="--chip:${c || "var(--b-acc)"}">${c ? `<i></i>` : ""}${t}</button>`).join("")}</div></div>`;
  }
  _musterSpalte(vm) {
    const n = this._spanne, s = this._muster(vm, n), txt = this._musterText(s), f = this._filter;
    const p = s.p75 ? `meist alle ${this._hDauer(s.p25)}–${this._hDauer(s.p75)}` : "";
    const avg = f === "stillen" ? [`Ø ${this._hDauer(s.still)} am Tag gestillt`, p]
      : f === "flasche" ? [`Ø ${Math.round(s.ml)} ml Fläschchen am Tag`, `an ${s.flaschenTage} von ${n} Tagen`]
      : f === "windel" ? [`Ø ${this._komma(s.w)} Windeln am Tag`, `davon ${this._komma(s.voll)} mit Stuhl`]
      : f === "schlaf" ? (s.schlafTage ? [`Ø ${this._hDauer(s.schlaf)} Schlaf am Tag`, `nachts (19–7 Uhr) ~${this._hDauer(s.schlafNacht)}`] : ["Noch kein Schlaf eingetragen", ""])
      : [`Ø ${this._komma(s.mA)} Mahlzeiten am Tag`, `und ${this._komma(s.w)} Windeln${p ? `, ${p}` : ""}`];
    const h0 = this._mitternacht(new Date()), rows = [];
    for (let i = 0; i < n; i++) {
      const d = this._mitternacht(h0, -i), t0 = +d, t1 = t0 + TAG;
      const fe = vm.raw.feeds.filter(e => +e.start >= t0 && +e.start < t1), wi = vm.raw.diapers.filter(e => +e.start >= t0 && +e.start < t1);
      const summe = f === "stillen" ? (() => { const x = fe.filter(e => e.typ === "stillen").reduce((a, e) => a + Math.max(0, e.end - e.start), 0); return x ? this._hDauer(x) : "–"; })()
        : f === "flasche" ? (() => { const x = fe.filter(e => e.typ === "flasche").reduce((a, e) => a + (e.ml || 0), 0); return x ? `${x} ml` : "–"; })()
        : f === "windel" ? (wi.length ? `${wi.length}` : "–")
        : f === "schlaf" ? (() => { const x = vm.schlaf.reduce((a, e) => a + this._ueber(+e.start, +e.end, t0, t1), 0); return x ? this._hDauer(x) : "–"; })()
        : (() => { const x = vm.meals.filter(m => m.start >= t0 && m.start < t1).length; return x ? `${x} ×` : "–"; })();
      rows.push(`<div class="fo-row"><span class="fo-rl">${i === 0 ? "Heute" : `${WT[d.getDay()]} ${d.getDate()}.`}</span>${this._streifen(vm, d, f, false)}<span class="fo-rt">${summe}</span></div>`);
    }
    const bem = this._bemerkt(vm);
    // Drei Bausteine, alle als .fo-box: Zusammenfassung samt Tagesschnitt (unter einer Linie), die Tage, Bemerkt
    return [`<div class="fo-box fo-mcard"><div class="fo-mh">${U.esc(txt.h)}</div><div class="fo-mt">${U.esc(txt.t)}</div>
      <div class="fo-avgz"><div class="fo-avg"><b>${avg[0]}</b>${avg[1] ? `<span> ${avg[1]}</span>` : ""}</div>
      <div class="fo-hint">Tage schwanken – der Trend zählt mehr als ein einzelner Tag.</div></div></div>`,
      `<div class="fo-box fo-rows"><div class="fo-row fo-row-ticks"><span class="fo-rl"></span>${this._ticks()}<span class="fo-rt"></span></div>${rows.join("")}</div>`,
      bem.length ? `<div class="fo-sec">Bemerkt</div><div class="fo-box fo-ins">${bem.map(b => `<div>${b}</div>`).join("")}</div>` : ""];
  }

  // ---------- Momente ----------
  // Die fp-milestone-card steckt als eigene Ansicht in der Übersicht, statt in einem eigenen Tab.
  // Sie wird einmal angelegt und bleibt bestehen (gewählter Bereich, offener Dialog); die Farben der
  // Übersicht bekommt sie über die Theme-Variablen ihres Rahmens.
  _momente() {
    if (!this._ms) {
      if (!customElements.get("fp-milestone-card")) return null;
      this._ms = document.createElement("fp-milestone-card");
      this._ms.setConfig({ calendar: this.config.milestone_calendar, title: "",
        kids: this.config.kids.map(k => ({ key: k.milestone_key || k.key, name: k.name, color: k.color, birth: k.birth, ga: k.ga })) });
    }
    if (this._hass) this._ms.hass = this._hass;
    return this._ms;
  }
  _zeigeMomente(body) {
    // Nur beim Wechsel in die Ansicht neu aufbauen; sonst würde jedes Neuzeichnen die Karte umhängen
    // und einem offenen Dialog den Fokus nehmen.
    let host = body.querySelector(":scope > .fo-ms-host");
    if (!host) { body.innerHTML = `<div class="fo-mtitle"><b>Momente</b><span>Erste Male, Entwicklung und Bewegung</span></div><div class="fo-emb fo-ms-host"></div>`; host = body.querySelector(".fo-ms-host"); }
    const ms = this._momente();
    if (!ms) { host.innerHTML = `<div class="fo-leer">Die Meilensteinkarte ist nicht geladen.</div>`; return; }
    if (ms.parentNode !== host) host.appendChild(ms);
    // Gewähltes Kind der Übersicht übernehmen
    const k = this._kid(this._kind), key = k.milestone_key || k.key;
    if (ms._kind !== key && ms.config.kids.some(x => x.key === key)) { ms._kind = key; ms._band = null; if (ms._paint) ms._paint(true); }
  }

  // ---------- Protokoll ----------
  // Stillprotokoll und Windeln als eigene Ansicht statt einer Unterseite im Dashboard: je Kind die fp-feeding-card
  // (mit Bericht) und die fp-diaper-card, eingebettet wie die Meilensteinkarte und einmal angelegt. Ihre Konfiguration
  // ergibt sich aus der der Übersicht; die Karten bringen Ändern, Nachtragen und Bericht selbst mit.
  _hatProtokoll() { return this.config.kids.some(k => k.feeding_calendar || k.diaper_calendar); }
  // Eine Stillkarte bekommt, wer Stillkalender und Schalter hat; die Windelkarte, wer einen Windelkalender hat.
  _hatStillkarte(kid) { return !!(kid.feeding_calendar && kid.switch); }
  // Attribute für ein antippbares Stück in „Heute“ (data-proto, siehe _zumProtokoll); leer, wenn das Kind diese Karte nicht hat.
  _protoZiel(kid, art) {
    const da = art === "windel" ? kid.diaper_calendar : this._hatStillkarte(kid);
    return this._hatProtokoll() && da ? ` data-proto="${art}" data-kind="${U.esc(kid.key)}"` : "";
  }
  _protokollKarten(kid) {
    const c = this.config, e = this._emb[kid.key] = this._emb[kid.key] || {};
    const rein = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));   // leere Werte nicht übergeben, die Karte hat eigene Vorgaben
    if (!e.feed && this._hatStillkarte(kid) && customElements.get("fp-feeding-card")) {
      e.feed = document.createElement("fp-feeding-card");
      e.feed.setConfig(rein({ name: kid.name, color: kid.color, calendar: kid.feeding_calendar, switch: kid.switch, side: kid.side, start: kid.start,
        diaper_calendar: kid.diaper_calendar, weight_calendar: c.weight_calendar, weight_key: kid.weight_key || kid.key,
        reminder_entity: c.reminder_entity, reminder_night_entity: c.reminder_night_entity, meal_pause_entity: c.meal_pause_entity }));
    }
    if (!e.diaper && kid.diaper_calendar && customElements.get("fp-diaper-card")) {
      e.diaper = document.createElement("fp-diaper-card");
      e.diaper.setConfig({ name: kid.name, color: kid.color, calendar: kid.diaper_calendar });
    }
    if (this._hass) { if (e.feed) e.feed.hass = this._hass; if (e.diaper) e.diaper.hass = this._hass; }
    return e;
  }
  _zeigeProtokoll(body) {
    const kids = this.config.kids;
    // Nur beim Wechsel in die Ansicht neu aufbauen; sonst würde jedes Neuzeichnen die Karten umhängen
    // und einem offenen Dialog darin den Fokus nehmen. Zwei Bausteine je Spalte (Stillen, Windeln), damit sie
    // am Tablet Zeile für Zeile auf einer Höhe stehen; am Handy zeigt das CSS nur die Spalte des gewählten Kinds.
    let grid = body.querySelector(":scope > .fo-pgrid");
    if (!grid) {
      body.innerHTML = `<div class="fo-mtitle"><b>Protokoll</b><span>Stillen und Windeln – zum Ändern, Nachtragen und für den Bericht</span></div>
        <div class="fo-grid fo-pgrid" style="--rows:2">${kids.map(() => `<section class="fo-col"><div class="fo-blk fo-emb"></div><div class="fo-blk fo-emb"></div></section>`).join("")}</div>`;
      grid = body.querySelector(".fo-pgrid");
      kids.forEach((k, i) => {
        const [stillen, windeln] = grid.children[i].children, alt = this._emb[k.key] || {}, bestand = [alt.feed, alt.diaper], e = this._protokollKarten(k);
        // Beim Zurückkehren stehen die schon vorhandenen Karten noch mit altem Stand da — gleich neu lesen.
        bestand.forEach(c => { if (c && c._load) c._load(); });
        if (e.feed) stillen.appendChild(e.feed);
        else if (this._hatStillkarte(k)) stillen.innerHTML = `<div class="fo-leer">Die Stillkarte ist nicht geladen.</div>`;
        if (e.diaper) windeln.appendChild(e.diaper);
        else if (k.diaper_calendar) windeln.innerHTML = `<div class="fo-leer">Die Windelkarte ist nicht geladen.</div>`;
        if (!stillen.firstChild && !windeln.firstChild) stillen.innerHTML = `<div class="fo-leer">Für ${U.esc(k.name)} ist kein Protokoll eingerichtet.</div>`;
      });
    }
    Array.from(grid.children).forEach((col, i) => col.classList.toggle("fo-sel", kids[i].key === this._kind));
  }
  // Tipp in „Heute“ auf Hauptkarte oder Jetzt-Zeile: das Kind der Spalte wählen, ins Protokoll wechseln und dort zur Still- (art
  // „still“) oder Windelkarte (art „windel“) dieses Kindes scrollen. Genau ein Neuzeichnen; am Tablet stehen weiter beide Spalten da.
  _zumProtokoll(key, art) {
    if (this.config.kids.some(k => k.key === key)) { this._kind = key; this._setPref("kind", key); }
    this._view = "protokoll"; this._off = 0; this._paint(true);
    this._zielHalten(key, art);
  }
  // Das Ziel ansteuern und kurz nachführen: Die eingebetteten Karten laden erst jetzt und werden dabei höher, die Windelkarte rutscht
  // nach unten, und anfangs ist die Seite zu kurz, um bis dorthin zu scrollen. Darum wird das Ziel nach jeder Änderung der Rasterhöhe
  // neu angesteuert, aber nur 4 s lang und nur, bis der Nutzer selbst eingreift (Rad, Tippen, Taste; Scroll-Ereignisse zählen nicht,
  // das Ansteuern löst selbst welche aus). Der Baustein bekommt als Rand unter der festen HA-Kopfzeile die klebende Kopfzeile (.fo-top
  // samt der Fläche, die 6 px darüber und darunter reicht) und etwas Luft.
  _zielHalten(key, art) {
    this._zielEnde();
    const grid = this.querySelector(".fo-pgrid"), top = this.querySelector(".fo-top"), i = this.config.kids.findIndex(k => k.key === key);
    const blk = grid && top && i >= 0 && grid.children[i] && grid.children[i].children[art === "windel" ? 1 : 0];
    if (!blk) return;
    const gehe = () => {
      if (this._view !== "protokoll" || !blk.isConnected) { this._zielEnde(); return; }
      const px = getComputedStyle(top).position === "sticky" ? 6 + top.getBoundingClientRect().height + 6 + 8 : 8;
      blk.style.scrollMarginTop = `calc(var(--header-height, 56px) + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + ${Math.ceil(px)}px)`;
      if (window.scrollTo) blk.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    const z = this._ziel = { evs: ["wheel", "touchstart", "pointerdown", "keydown"], stop: () => this._zielEnde(), ro: null, timer: setTimeout(() => this._zielEnde(), 4000) };
    z.evs.forEach(t => window.addEventListener(t, z.stop, { capture: true, passive: true }));
    if (window.ResizeObserver) {
      let h = grid.offsetHeight;
      z.ro = new ResizeObserver(() => { if (Math.abs(grid.offsetHeight - h) >= 1) { h = grid.offsetHeight; gehe(); } });
      z.ro.observe(grid);
    }
    gehe();
  }
  _zielEnde() {
    const z = this._ziel; if (!z) return;
    this._ziel = null;
    clearTimeout(z.timer);
    if (z.ro) z.ro.disconnect();
    z.evs.forEach(t => window.removeEventListener(t, z.stop, true));
  }

  // ---------- Wachstum ----------
  // Perzentilen wie in der fp-weight-card: bis 64 Wochen ab Beginn der Schwangerschaft
  // INTERGROWTH-21st für Frühgeborene, danach WHO mit L/M/S nach korrigiertem Alter.
  _pmaTage(kid, t) {
    const [w, d] = String(kid.ga || "40+0").split("+").map(Number);
    return (w || 40) * 7 + (d || 0) + (t - this._day(kid.birth)) / TAG;
  }
  _refAt(sex, pma) {
    const ref = this._ref; if (!ref || !ref.who) return null;
    const lerp = (rows, v, i) => {
      if (v < rows[0][0] || v > rows[rows.length - 1][0]) return null;
      const k = rows.findIndex(r => r[0] >= v); if (k <= 0) return rows[Math.max(0, k)][i];
      const a = rows[k - 1], b = rows[k], f = (v - a[0]) / (b[0] - a[0]);
      return a[i] + f * (b[i] - a[i]);
    };
    const pre = ref.preterm && ref.preterm[sex], wPma = pma / 7;
    if (pre && pre.length && wPma >= pre[0][0] && wPma <= pre[pre.length - 1][0]) return [1, 2, 3, 4, 5].map(i => lerp(pre, wPma, i) * 1000);
    const who = ref.who[sex], alter = pma - 280;
    if (!who || alter < 0) return null;
    const rows = alter <= 91 ? who.w : who.mo, v = alter <= 91 ? alter / 7 : alter / 30.4375;
    const L = lerp(rows, v, 1), M = lerp(rows, v, 2), S = lerp(rows, v, 3);
    if (L == null) return null;
    return [-1.8808, -1.2816, 0, 1.2816, 1.8808].map(z => M * Math.pow(1 + L * S * z, 1 / L) * 1000);
  }
  _hatRef(kid) { return !!(this._ref && kid.birth && kid.sex); }
  // Ungefähre Perzentile als Zahl, zwischen den fünf Linien linear verteilt; 2 heißt unter P3, 98 über P97.
  _pz(kid, w) {
    if (!this._hatRef(kid)) return null;
    const c = this._refAt(kid.sex, this._pmaTage(kid, +w.date)); if (!c) return null;
    const P = [3, 10, 50, 90, 97];
    if (w.g < c[0]) return 2;
    if (w.g > c[4]) return 98;
    for (let i = 1; i < 5; i++) if (w.g <= c[i]) return Math.round(P[i - 1] + (w.g - c[i - 1]) / (c[i] - c[i - 1]) * (P[i] - P[i - 1]));
    return null;
  }
  _pzText(p) { return p == null ? "" : p <= 2 ? "unter P3" : p >= 98 ? "über P97" : `≈ P${p}`; }
  _g(d) { return `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))} g`; }
  _alterAm(kid, d) {
    if (!kid.birth) return "";
    const tage = Math.round((d - this._day(kid.birth)) / TAG);
    if (tage < 0) return "";
    if (tage === 0) return "bei der Geburt";
    if (tage < 14) return `mit ${tage} ${tage === 1 ? "Tag" : "Tagen"}`;
    if (tage < 61) return `mit ${Math.floor(tage / 7)} Wochen`;
    const m = Math.floor(tage / 30.4375);
    return m < 24 ? `mit ${m} Monaten` : `mit ${Math.floor(m / 12)} Jahren`;
  }
  // Der erste Wert am Tag der Geburt (± 1 Tag) gilt als Geburtsgewicht.
  _geburtsgewicht(kid, w) { return kid.birth ? w.find(x => Math.abs(x.date - this._day(kid.birth)) <= 1.5 * TAG) || null : null; }

  _wachstumKopf() {
    return `<div class="fo-mtitle"><b>Wachstum</b><span>Gewicht nach Alter${this._ref ? ", mit Perzentilkurven" : ""}</span></div>`;
  }
  _wachstumSpalte(vm) {
    const k = vm.kid, w = vm.weights, l = w[w.length - 1], kk = U.esc(k.key);
    const wiegen = `<button class="fo-nbtn" type="button" data-act="wiegen" data-kind="${kk}">⚖️ Wiegen</button>`;
    if (!l) return [`<div class="fo-next"><div class="fo-nl">Gewicht</div><div class="fo-nb">–</div>
      <div class="fo-ns">Noch nicht gewogen. Am besten mit dem Geburtsgewicht anfangen.</div>${wiegen}</div>`];
    const vor = w.slice(0, -1).reverse().find(x => l.date - x.date >= 5 * TAG) || w[w.length - 2];
    const tage = vor ? Math.max(1, Math.round((l.date - vor.date) / TAG)) : 0;
    const geb = this._geburtsgewicht(k, w), erst = geb || w[0], pzL = this._pz(k, l), alt = this._alterAm(k, l.date);
    const b = [`<div class="fo-next"><div class="fo-nl">Aktuelles Gewicht</div>
      <div class="fo-nb">${this._kg(l.g)}</div>
      <div class="fo-ns">am ${this._dm(l.date)}${l.zeit ? ` um ${l.zeit}` : ""}${alt ? ` · ${alt}` : ""}${pzL != null ? ` · ${this._pzText(pzL)}` : ""}</div>
      ${vor ? `<div class="fo-nf">${this._g(l.g - vor.g)} seit ${this._dm(vor.date)} · Ø ${this._g((l.g - vor.g) / tage)} am Tag</div>` : ""}
      ${wiegen}</div>`];
    // Kennzahlen als Liste wie „Jetzt“ in „Heute“, nur ohne Symbolkreis: Wert groß, darunter klein „Titel · Unterzeile“.
    // Zunahme seit der Geburt, Schnitt pro Woche, Perzentile jetzt und damals
    const zeile = (titel, wert, unter) => `<div class="fo-nr"><div class="fo-nrm"><b>${wert}</b><small>${titel} · ${unter}</small></div></div>`;
    const zeilen = [], seit = geb ? "seit der Geburt" : `seit ${this._dm(erst.date)}`;
    if (w.length > 1) {
      zeilen.push(zeile(geb ? "Seit der Geburt" : `Seit ${this._dm(erst.date)}`, this._g(l.g - erst.g), `${geb ? "Geburtsgewicht" : "erste Messung"} ${this._kg(erst.g)}`));
      zeilen.push(zeile("Pro Woche", `Ø ${this._g((l.g - erst.g) / Math.max(1, (l.date - erst.date) / TAG) * 7)}`, seit));
    }
    const pzE = w.length > 1 ? this._pz(k, erst) : null;
    if (pzL != null) zeilen.push(zeile("Perzentile", this._pzText(pzL), pzE != null ? `${geb ? "bei der Geburt" : `am ${this._dm(erst.date)}`} ${this._pzText(pzE)}` : "nach Alter"));
    b.push(zeilen.length ? `<div class="fo-box fo-kenn">${zeilen.join("")}</div>` : "");
    // Kurve: wird nach dem Einfügen für die echte Breite gezeichnet (_zeichne)
    b.push(`<div class="fo-sec">Verlauf</div><div class="fo-box fo-gcard" style="${this._kidStyle(k)}"><div class="fo-gchart" data-kind="${kk}"></div>
      ${this._hatRef(k) ? `<div class="fo-gleg"><span><i class="fo-gl-line"></i>${U.esc(k.name)}</span><span><i class="fo-gl-band"></i>P3–P97</span><span><i class="fo-gl-mid"></i>P50</span></div>` : ""}</div>`);
    const bem = this._wBemerkt(k, w, geb, l);
    b.push(bem.length ? `<div class="fo-sec">Bemerkt</div><div class="fo-box fo-ins">${bem.map(x => `<div>${x}</div>`).join("")}</div>` : "");
    const liste = w.slice().reverse(), zeig = this._wAlle ? liste : liste.slice(0, 6);
    b.push(`<div class="fo-sec">Messungen</div><div class="fo-box">${zeig.map(x => {
      const i = w.indexOf(x), p = i > 0 ? w[i - 1] : null, pz = this._pz(k, x);
      return `<button class="fo-li fo-wli" type="button" data-wuid="${U.esc(x.uid)}"><i style="background:${U.esc(k.color)}"></i><span>${this._kg(x.g)}${x === geb ? "<em>Geburt</em>" : ""}</span>
        <small>${[p ? this._g(x.g - p.g) : "", this._pzText(pz)].filter(Boolean).join(" · ")}</small><time>${this._dm(x.date)}${x.zeit ? ` ${x.zeit}` : ""}</time></button>`;
    }).join("")}</div>${liste.length > 6 ? `<button class="fo-more" type="button" data-walle>${this._wAlle ? "Weniger zeigen" : `Alle ${liste.length} Messungen`}</button>` : ""}`);
    b.push(!this._hatRef(k) ? "" : `<div class="fo-quelle">Kurven P3–P97: ${this._ref.preterm && Object.keys(this._ref.preterm).length
      ? "INTERGROWTH-21st für Frühgeborene bis 64 Wochen nach Beginn der Schwangerschaft, danach WHO" : "WHO"} nach korrigiertem Alter. Einzelne Messungen schwanken – der Verlauf zählt.</div>`);
    return b;
  }
  // Gerechnete Beobachtungen, keine Bewertung: Tiefpunkt nach der Geburt, Geburtsgewicht wieder erreicht, Kilomarken.
  _wBemerkt(k, w, geb, l) {
    const out = [];
    if (geb) {
      const tief = w.filter(x => x.date > geb.date && x.date - geb.date <= 21 * TAG).reduce((m, x) => (!m || x.g < m.g ? x : m), null);
      if (tief && tief.g < geb.g) {
        out.push(`Tiefster Wert ${this._kg(tief.g)} am ${this._dm(tief.date)} <span>– ${this._komma((geb.g - tief.g) / geb.g * 100)} % unter dem Geburtsgewicht</span>`);
        const zurueck = w.find(x => x.date > tief.date && x.g >= geb.g);
        if (zurueck) out.push(`Geburtsgewicht wieder erreicht am ${this._dm(zurueck.date)} <span>– ${this._alterAm(k, zurueck.date)}</span>`);
        else if (l.g < geb.g) out.push(`Noch ${geb.g - l.g} g bis zum Geburtsgewicht <span>(${this._kg(geb.g)})</span>`);
      }
      const doppelt = l.g >= 2 * geb.g && w.find(x => x.g >= 2 * geb.g);
      if (doppelt) out.push(`Geburtsgewicht verdoppelt am ${this._dm(doppelt.date)} <span>– ${this._alterAm(k, doppelt.date)}</span>`);
    }
    const marke = Math.floor(l.g / 1000) * 1000, erreicht = marke >= 1000 && w[0].g < marke && w.find(x => x.g >= marke);
    if (erreicht && l.date - erreicht.date <= 14 * TAG) out.push(`${marke / 1000} kg geschafft am ${this._dm(erreicht.date)} 🎉`);
    const her = Math.round((this._day(this._local(new Date(), " ")) - l.date) / TAG);
    if (her >= 7) out.push(`Zuletzt vor ${her} Tagen gewogen`);
    return out;
  }
  _zeichne() {
    this.querySelectorAll(".fo-gchart[data-kind]").forEach(el => {
      const W = Math.round(el.clientWidth);
      if (!W || (el.dataset.w === String(W) && el.firstChild)) return;   // ausgeblendete Spalte oder schon passend
      el.dataset.w = String(W);
      el.innerHTML = this._kurve(this._vm(this._kid(el.dataset.kind)), W);
    });
  }
  // Gewicht über dem Alter: Perzentilbänder in der Kinderfarbe, ein Stück Kurve voraus, Linie bei heute.
  _kurve(vm, W) {
    const k = vm.kid, w = vm.weights;
    if (!w.length) return "";
    const H = 230, L = 38, R = 34, T = 22, B = 26;
    const geb = k.birth ? +this._day(k.birth) : null, jetzt = Date.now();
    const t0 = geb != null ? Math.min(geb, +w[0].date) : +w[0].date - 2 * TAG;
    const tEnde = Math.max(jetzt, +w[w.length - 1].date), t1 = tEnde + Math.max(4 * TAG, (tEnde - t0) * .12);
    const ref = [];
    if (this._hatRef(k)) {
      const n = Math.max(2, Math.min(200, Math.round((t1 - t0) / TAG)));
      for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, c = this._refAt(k.sex, this._pmaTage(k, t)); if (c) ref.push({ t, c }); }
    }
    let g0 = Math.min(...w.map(x => x.g), ...ref.map(p => p.c[0])), g1 = Math.max(...w.map(x => x.g), ...ref.map(p => p.c[4]));
    const span = Math.max(g1 - g0, 300), step = [100, 200, 250, 500, 1000, 2000].find(s => span / s <= 6) || 2000;
    g0 = Math.floor((g0 - span * .05) / step) * step; g1 = Math.ceil((g1 + span * .05) / step) * step;
    const x = t => +(L + (t - t0) / (t1 - t0) * (W - L - R)).toFixed(1), y = g => +(T + (1 - (g - g0) / (g1 - g0)) * (H - T - B)).toFixed(1);
    let s = "";
    for (let g = g0; g <= g1 + .5; g += step) s += `<line class="fo-ggrid" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text class="fo-gy" x="${L - 7}" y="${y(g) + 4}">${(g / 1000).toLocaleString("de-AT", { maximumFractionDigits: 2 })}</text>`;
    s += `<text class="fo-gy fo-gunit" x="${L - 7}" y="${T - 9}">kg</text>`;
    // Achse nach Alter: Wochen in den ersten drei Monaten, danach Monate; ohne Geburtstag nach Datum.
    const platz = Math.max(2, Math.floor((W - L - R) / 64)), ticks = [];
    if (geb == null) {
      const st = Math.max(1, Math.ceil((t1 - t0) / TAG / platz));
      for (let d = 0; t0 + d * TAG <= t1; d += st) ticks.push([t0 + d * TAG, this._dm(new Date(t0 + d * TAG))]);
    } else if ((t1 - geb) / TAG <= 98) {
      const st = Math.max(1, Math.ceil((t1 - geb) / TAG / 7 / platz));
      for (let i = 0; geb + i * 7 * TAG <= t1; i += st) ticks.push([geb + i * 7 * TAG, i ? `${i} Wo.` : "Geburt"]);
    } else {
      const st = [1, 2, 3, 6, 12].find(m => (t1 - geb) / TAG / 30.4375 / m <= platz) || 12;
      for (let i = 0; i <= 240; i += st) {
        const d = new Date(geb); d.setMonth(d.getMonth() + i); if (+d > t1) break;
        ticks.push([+d, !i ? "Geburt" : i % 12 ? `${i} Mon.` : `${i / 12} J.`]);
      }
    }
    s += ticks.map(([t, txt]) => `<text class="fo-gx" x="${x(t)}" y="${H - 7}">${txt}</text>`).join("");
    if (ref.length > 1) {
      const band = (lo, hi) => ref.map(p => `${x(p.t)},${y(p.c[hi])}`).join(" ") + " " + ref.slice().reverse().map(p => `${x(p.t)},${y(p.c[lo])}`).join(" ");
      const e = ref[ref.length - 1];
      s += `<polygon class="fo-gb1" points="${band(0, 4)}"/><polygon class="fo-gb2" points="${band(1, 3)}"/><polyline class="fo-gmid" points="${ref.map(p => `${x(p.t)},${y(p.c[2])}`).join(" ")}"/>`
        + [[0, "P3"], [2, "P50"], [4, "P97"]].map(([i, t]) => `<text class="fo-gp" x="${x(e.t) + 4}" y="${y(e.c[i]) + 3.5}">${t}</text>`).join("");
    }
    s += `<line class="fo-gheute" x1="${x(jetzt)}" x2="${x(jetzt)}" y1="${T}" y2="${H - B}"/><text class="fo-gheutel" x="${x(jetzt)}" y="${T - 9}">heute</text>`;
    if (w.length > 1) s += `<polyline class="fo-gline" points="${w.map(p => `${x(+p.date)},${y(p.g)}`).join(" ")}"/>`;
    s += w.map((p, i) => {
      const letzt = i === w.length - 1, cx = x(+p.date), cy = y(p.g);
      return `<g class="fo-gpt" data-wuid="${U.esc(p.uid)}"><title>${U.esc(`${this._kg(p.g)} am ${this._dmy(p.date)}`)}</title><circle cx="${cx}" cy="${cy}" r="14" fill="transparent"/>`
        + `${letzt ? `<circle class="fo-ghalo" cx="${cx}" cy="${cy}" r="11"/>` : ""}<circle class="fo-gdot" cx="${cx}" cy="${cy}" r="${letzt ? 6 : 4}"/></g>`;
    }).join("");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf ${U.esc(k.name)}">${s}</svg>`;
  }

  // ---------- Schreiben ----------
  _toggle(kid) {
    if (!kid.switch) return;
    const laeuft = this._laeuft(kid);
    if (laeuft && Date.now() - this._beginn(kid) < 30000) U.toast(this, "Unter 30 Sekunden – als Fehltipp verworfen, nicht protokolliert");
    this._hass.callService("input_boolean", laeuft ? "turn_off" : "turn_on", { entity_id: kid.switch })
      .then(() => { if (!laeuft) this._rueckAus(`${kid.name}: Stillen gestartet`, [kid.switch]); }, () => U.toast(this, "Stillen konnte nicht umgeschaltet werden"));
  }
  // Hinweis mit „Rückgängig“ nach dem Einschalten: schaltet aus, was dann noch läuft. Kurze Einträge verwirft die Automation selbst.
  _rueckAus(text, schalter) {
    const fn = () => {
      const noch = schalter.filter(e => { const st = this._hass.states[e]; return st && st.state === "on"; });
      if (!noch.length) return;
      this._hass.callService("input_boolean", "turn_off", { entity_id: noch })
        .then(() => U.toast(this, "Rückgängig gemacht"), () => U.toast(this, "Rückgängig ging nicht – bitte von Hand ausschalten"));
    };
    if (U.undo) U.undo(this, text, fn); else U.toast(this, text);
  }
  // „*“ = alle mit Schlafschalter: schläft noch keiner oder nur einer, legen sich alle hin; schlafen alle, wachen alle auf.
  // Die Karte schaltet nur — den Termin schreibt wie beim Stillen die Protokoll-Automation.
  _schlafToggle(key) {
    const kids = this.config.kids.filter(k => k.sleep_switch), ziel = key === "*" ? kids : kids.filter(k => k.key === key);
    if (!ziel.length) return;
    const an = !ziel.every(k => this._schlaeft(k)), betroffen = ziel.filter(k => this._schlaeft(k) !== an);
    if (!an && betroffen.some(k => Date.now() - this._schlafBeginn(k) < MIN)) U.toast(this, "Unter einer Minute – als Fehltipp verworfen, nicht protokolliert");
    this._hass.callService("input_boolean", an ? "turn_on" : "turn_off", { entity_id: betroffen.map(k => k.sleep_switch) })
      .then(() => { if (an && betroffen.length) this._rueckAus(`${betroffen.map(k => k.name).join(" und ")}: Schlaf gestartet`, betroffen.map(k => k.sleep_switch)); },
        () => U.toast(this, "Schlaf konnte nicht umgeschaltet werden"));
  }
  async _eintrag(cal, summary, meta, start, okText) {
    try {
      await this._hass.callService("calendar", "create_event", {
        entity_id: cal, summary, description: JSON.stringify(meta),
        start_date_time: U.haZeit(start), end_date_time: U.haZeit(new Date(+start + MIN)),
      });
      const zurueck = () => this._rueckgaengig(cal, summary, start);
      if (U.undo) U.undo(this, okText, zurueck); else U.toast(this, okText);
      this._load();
      return true;
    } catch (e) { U.toast(this, "Konnte nicht gespeichert werden"); return false; }
  }
  // „Rückgängig“ nach einem Schnelleintrag: das eben angelegte Ereignis im Kalender suchen (gleiche Überschrift,
  // Beginn innerhalb einer Minute) und löschen.
  async _rueckgaengig(cal, summary, start) {
    try {
      const von = new Date(+start - MIN), bis = new Date(+start + 2 * MIN);
      const evts = await this._hass.callApi("GET", `calendars/${cal}?start=${encodeURIComponent(von.toISOString())}&end=${encodeURIComponent(bis.toISOString())}`);
      const ev = (Array.isArray(evts) ? evts : []).filter(x => x.uid && x.summary === summary && Math.abs(this._start(x) - start) <= MIN)
        .sort((x, y) => Math.abs(this._start(x) - start) - Math.abs(this._start(y) - start))[0];
      if (!ev) { U.toast(this, "Eintrag nicht gefunden – bitte in der Liste löschen"); return; }
      await this._hass.callWS({ type: "calendar/event/delete", entity_id: cal, uid: ev.uid });
      U.toast(this, "Rückgängig gemacht");
      this._load();
    } catch (e) { U.toast(this, "Rückgängig ging nicht – bitte in der Liste löschen"); }
  }

  // ---------- Blätter (Windel, Fläschchen, Nachtragen, Ändern, Einstellungen, Frag nach) ----------
  _closeSheet() { if (this._ov) { this._ov.remove(); this._ov = null; this._chatOffen = false; this._einstOffen = false; if (this._kdOffen) { this._kdOffen = null; this._kdockMarke(); } } }
  _sheet(inner, cls) {
    this._closeSheet();
    const ov = document.createElement("div");
    ov.className = "fo-ov";
    ov.innerHTML = `<div class="fo-sheet ${cls || ""}" role="dialog">${inner}</div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov || ev.target.closest(".fo-x")) this._closeSheet(); });
    U.lightbox(this._card, ov, () => this._closeSheet()); this._ov = ov;
    return ov;
  }
  // kids_dock (Handy): die Pillen unten, eine je Kind. Keine Zustandsanzeige, nur Avatar und Name in der Kinderfarbe.
  // Ganz rechts der Mond (nur mit mindestens zwei Kindern mit Schlafschalter): öffnet das Schlaf-Blatt für alle, gefüllt wenn alle schlafen, getönt wenn einige.
  _kdockHtml() {
    // dock_gap > 0: erstes Kind der Leiste ist der Platz für den Sprachassistenten (52 × 52, unsichtbar); Pip misst ihn über window.__fpPipSlots
    const platz = this._dg > 0 ? '<span class="fo-pipslot" aria-hidden="true"></span>' : "";
    const pillen = platz + this.config.kids.map(k => `<button type="button" class="fo-kpill" data-kdock="${U.esc(k.key)}" aria-haspopup="dialog" aria-expanded="${this._kdOffen === k.key}" style="--k:${U.esc(k.color)}">${this._avatar(k, 26)}<span class="fo-kpn">${U.esc(k.name)}</span></button>`).join("");
    const sk = this._schlafKids();
    if (sk.length < 2) return pillen;
    const n = sk.filter(k => this._schlaeft(k)).length, st = n === sk.length ? " fo-kmoon-alle" : n ? " fo-kmoon-teil" : "";
    return pillen + `<button type="button" class="fo-kmoon${st}" data-kdock="*" aria-label="Schlafen" aria-haspopup="dialog" aria-expanded="${this._kdOffen === "*"}">${MOND}</button>`;
  }
  _schlafKids() { return this.config.kids.filter(k => k.sleep_switch); }
  // Der Platz für den Sprachassistenten steht in einer seitenweiten Liste (window.__fpPipSlots, Prod- und Beta-Datei teilen sie);
  // Pip sucht dort ein sichtbares Element und setzt sich darauf. Die Leiste wird bei jedem Zeichnen neu geschrieben: dann das neue Element eintragen.
  // Nur bei Änderung wird „fp-pip-slot“ gesendet.
  _slotMelden() {
    const neu = (this._kd && this._dg > 0 && this._built && this.isConnected && this.querySelector(".fo-pipslot")) || null;
    if (neu === (this._slotEl || null)) return;
    const S = window.__fpPipSlots = window.__fpPipSlots || new Set();
    if (this._slotEl) S.delete(this._slotEl);
    this._slotEl = neu;
    if (neu) S.add(neu);
    window.dispatchEvent(new Event("fp-pip-slot"));
  }
  _kdockMarke() { this.querySelectorAll("[data-kdock]").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.kdock === this._kdOffen))); }
  // Blatt zu einem Kind: Schlafen und Stillen als zwei große Knöpfe, nur was das Kind an Schaltern hat. Ein Tipp schaltet und schließt das Blatt;
  // Hinweis und „Rückgängig“ kommen aus _schlafToggle und _toggle.
  _sheetKind(kid) {
    const ov = this._sheet(this._kindInner(kid), "fo-sheet-kind");
    this._kdOffen = kid.key; this._kdockMarke();
    ov.addEventListener("click", ev => {
      const b = ev.target.closest && ev.target.closest("[data-kdo]"); if (!b) return;
      const k = this._kid(this._kdOffen);
      this._closeSheet();
      if (b.dataset.kdo === "schlaf") this._schlafToggle(k.key); else this._toggle(k);
    });
  }
  _kindZeichne() {
    const sh = this._ov && this._kdOffen && this._ov.querySelector(".fo-sheet");
    if (sh) sh.innerHTML = this._kdOffen === "*" ? this._schlafAlleInner() : this._kindInner(this._kid(this._kdOffen));
  }
  // Schlaf-Blatt für alle (Mond in der Kinder-Leiste): eine Zeile je Kind schaltet dessen Schlaf und das Blatt bleibt offen (es folgt dem Zustand
  // über set hass); der große Knopf darunter schaltet alle auf einmal und schließt das Blatt. Hinweis und „Rückgängig“ kommen aus _schlafToggle.
  _sheetSchlafAlle() {
    const ov = this._sheet(this._schlafAlleInner(), "fo-sheet-schlaf");
    this._kdOffen = "*"; this._kdockMarke();
    ov.addEventListener("click", ev => {
      const t = ev.target.closest && ev.target.closest("[data-ks],[data-kalle]"); if (!t) return;
      if (t.dataset.kalle !== undefined) { this._closeSheet(); this._schlafToggle("*"); } else this._schlafToggle(t.dataset.ks);
    });
  }
  _schlafAlleInner() {
    const jetzt = Date.now(), kids = this._schlafKids(), alle = kids.length > 0 && kids.every(k => this._schlaeft(k)), wer = kids.length > 2 ? "Alle" : "Beide";
    const zeilen = kids.map(k => {
      const s = this._schlaeft(k); let sub = "";
      if (s) { const ab = this._schlafBeginn(k); sub = `schläft seit <span class="fo-dauer" data-ab="${ab}">${this._hDauer(jetzt - ab)}</span>`; }
      else { const w = this._wachSeit(k, jetzt); if (w) sub = `wach seit ${U.esc(w)}`; }
      return `<button type="button" class="fo-ks${s ? " fo-ks-an" : ""}" data-ks="${U.esc(k.key)}" role="switch" aria-checked="${s}">${this._avatar(k, 26)}<span class="fo-ksx"><span class="fo-ksn">${U.esc(k.name)}</span>${sub ? `<span class="fo-kss">${sub}</span>` : ""}</span><span class="fo-ksw" aria-hidden="true"></span></button>`;
    }).join("");
    return `<div class="fo-sh-head"><b>${MOND}Schlafen</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-ks-liste">${zeilen}</div>
      <button type="button" class="fo-kalle${alle ? " fo-kalle-aus" : ""}" data-kalle>${MOND}${wer} ${alle ? "aufwecken" : "schlafen"}</button>`;
  }
  _kindInner(kid) {
    const jetzt = Date.now(), kn = [], seite = this._seite(kid), gross = seite.charAt(0).toUpperCase() + seite.slice(1);
    const knopf = (art, farbe, emoji, text, sub, an) => `<button type="button" class="fo-kn${an ? " fo-kn-an" : ""}" data-kdo="${art}" style="--q:${farbe}">
      <span class="fo-kne">${emoji}</span><span class="fo-knx"><span class="fo-knt">${text}</span>${sub ? `<span class="fo-kns">${sub}</span>` : ""}</span></button>`;
    if (kid.sleep_switch) {
      if (this._schlaeft(kid)) {
        const ab = this._schlafBeginn(kid);
        kn.push(knopf("schlaf", "var(--c-sleep)", "💤", `Schläft · <span class="fo-dauer" data-ab="${ab}">${this._hDauer(jetzt - ab)}</span>`, "tippen = aufgewacht", true));
      } else {
        const wach = this._wachSeit(kid, jetzt);
        kn.push(knopf("schlaf", "var(--c-sleep)", "😴", "Schlafen", wach ? `wach seit ${wach}` : "", false));
      }
    }
    if (kid.switch) {
      if (this._laeuft(kid)) {
        const ab = this._beginn(kid);
        kn.push(knopf("still", "var(--c-nurse)", "🤱", `Stillen läuft · <span class="fo-uhr" data-ab="${ab}">${this._uhr((jetzt - ab) / 1000)}</span>`, `${seite ? `${U.esc(gross)} · ` : ""}tippen = Ende`, true));
      } else {
        const l = this._vm(kid).letzte;
        kn.push(knopf("still", "var(--c-nurse)", "🤱", "Stillen", [l ? this._vor(+l.start) : "", seite ? `${U.esc(gross)} als Nächstes` : ""].filter(Boolean).join(" · "), false));
      }
    }
    return `<div class="fo-sh-head"><b>${this._avatar(kid, 34)}${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-kn-liste">${kn.join("") || '<div class="fo-leer">Für dieses Kind ist kein Schalter eingerichtet.</div>'}</div>`;
  }
  _sheetWindel(kid) {
    const ov = this._sheet(`<div class="fo-sh-head"><b>💩 Windel · ${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-big3"><button type="button" data-art="nass" style="--q:var(--c-diaper)"><span>💧</span>Nass</button><button type="button" data-art="voll" style="--q:var(--c-stool)"><span>💩</span>Voll</button><button type="button" data-art="beides" style="--q:var(--c-stool)"><span>💧💩</span>Beides</button></div>`);
    ov.querySelectorAll("[data-art]").forEach(b => b.addEventListener("click", () => {
      if (this._sperre) return;   // Doppeltipp = eine Windel
      this._sperre = true; setTimeout(() => { this._sperre = false; }, 1500);
      const art = b.dataset.art, text = art === "beides" ? "nass + voll" : art;
      this._closeSheet();
      this._eintrag(kid.diaper_calendar, `Windel ${text}`, { typ: "windel", art }, new Date(), `${kid.name}: Windel ${text} eingetragen ✓`);
    }));
  }
  _sheetFlasche(kid) {
    const pre = (this.config.bottle_presets || []).map(Number).filter(x => x > 0), jetzt = new Date();
    let ml = pre[0] || 0;
    const ov = this._sheet(`<div class="fo-sh-head"><b>🍼 Fläschchen · ${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-lbl">Menge</div>
      <div class="fo-mls">${pre.map(x => `<button type="button" data-ml="${x}">${x} ml</button>`).join("")}<input class="fo-in fo-mlin" type="number" inputmode="numeric" min="1" max="400" placeholder="ml"></div>
      <div class="fo-lbl">Fertig getrunken um</div>
      <input class="fo-in fo-zeit" type="time" value="${this._hm(jetzt)}">
      <button class="fo-ok" type="button">Eintragen</button>`);
    const mark = () => ov.querySelectorAll("[data-ml]").forEach(b => b.classList.toggle("fo-on", Number(b.dataset.ml) === ml));
    ov.querySelectorAll("[data-ml]").forEach(b => b.addEventListener("click", () => { ml = Number(b.dataset.ml); ov.querySelector(".fo-mlin").value = ""; mark(); }));
    ov.querySelector(".fo-mlin").addEventListener("input", e => { ml = Number(e.target.value) || 0; mark(); });
    mark();
    ov.querySelector(".fo-ok").addEventListener("click", () => {
      if (!(ml > 0 && ml <= 400)) { U.toast(this, "Bitte eine Menge angeben"); return; }
      const zeit = ov.querySelector(".fo-zeit").value;
      let start = this._at(new Date(), zeit);
      if (start - Date.now() > 5 * MIN) start = this._at(new Date(), zeit, { tage: -1 });   // eine Uhrzeit nach „jetzt“ meint gestern Abend
      this._closeSheet();
      this._eintrag(kid.feeding_calendar, `Fläschchen ${ml} ml`, { typ: "flasche", ml }, start, `${kid.name}: Fläschchen ${ml} ml eingetragen ✓`);
    });
  }
  // ＋ Nachtragen: Art wählen, danach dasselbe Blatt wie beim Ändern (mit Tag Heute/Gestern). Schlaf hat sein eigenes Blatt.
  _nachtragOptionen(kid) {
    const o = [];
    if (kid.feeding_calendar) o.push("stillen", "flasche");
    if (kid.diaper_calendar) o.push("windel");
    if (kid.sleep_calendar) o.push("schlaf");
    return o;
  }
  _sheetNachtrag(kid) {
    const opt = this._nachtragOptionen(kid);
    if (!opt.length) return;
    const los = typ => (typ === "schlaf" ? this._sheetSchlaf(kid, null) : this._sheetEintrag(kid, typ, null));
    if (opt.length === 1) { los(opt[0]); return; }
    const T = { stillen: ["🤱", "Stillen", "var(--c-nurse)"], flasche: ["🍼", "Fläschchen", "var(--c-bottle)"], windel: ["💩", "Windel", "var(--c-diaper)"], schlaf: ["😴", "Schlaf", "var(--c-sleep)"] };
    const ov = this._sheet(`<div class="fo-sh-head"><b>＋ Nachtragen · ${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-big3 fo-big2">${opt.map(t => `<button type="button" data-nt-typ="${t}" style="--q:${T[t][2]}"><span>${T[t][0]}</span>${T[t][1]}</button>`).join("")}</div>`);
    ov.querySelectorAll("[data-nt-typ]").forEach(b => b.addEventListener("click", () => los(b.dataset.ntTyp)));
  }
  // Uhrzeit auf das Datum eines Bezugstags setzen. o.tage verschiebt um ganze Kalendertage (1 = Folgetag), o.ref und o.wie entscheiden
  // in der doppelten Stunde beim Ende der Sommerzeit, welche der beiden Zeiten gemeint ist (siehe U.ortZeit): beim Ändern ref = ursprünglicher
  // Zeitpunkt mit wie, beim Ende eines neuen Eintrags ref = Beginn.
  _at(basis, hhmm, o) {
    o = o || {};
    const [h, m] = String(hhmm || "").split(":").map(Number);
    return U.ortZeit(basis.getFullYear(), basis.getMonth(), basis.getDate() + (o.tage || 0), h || 0, m || 0, o.ref, 0, o.wie);
  }
  _artText(a) { return a === "beides" ? "nass + voll" : a; }
  // Stillen, Fläschchen oder Windel ändern und löschen (e gesetzt) oder nachtragen (e leer, mit Tag Heute/Gestern).
  // Das Datum eines vorhandenen Eintrags bleibt; ein Ende vor dem Beginn heißt über Mitternacht.
  _sheetEintrag(kid, typ, e) {
    const neu = !e, jetzt = new Date(), pre = (this.config.bottle_presets || []).map(Number).filter(x => x > 0);
    let tag = this._off === -1 ? "gestern" : "heute", seite = e ? e.seite : this._seite(kid), ml = e ? e.ml : (pre[0] || 0), art = e ? e.art : "nass";
    if (seite !== "links" && seite !== "rechts") seite = "links";
    const von = e ? e.start : typ === "stillen" ? new Date(+jetzt - 15 * MIN) : jetzt, bis = (e && e.end) || jetzt;   // Windeln haben kein Ende
    const titel = { stillen: "🤱 Stillen", flasche: "🍼 Fläschchen", windel: "💩 Windel" }[typ];
    const felder = {
      stillen: `<div class="fo-zeitrow"><div><div class="fo-lbl">Beginn</div><input class="fo-in fo-von" type="time" value="${this._hm(von)}"></div>
          <div><div class="fo-lbl">Ende</div><input class="fo-in fo-bis" type="time" value="${this._hm(bis)}"></div></div>
        <div class="fo-sh-hint">Liegt das Ende vor dem Beginn, war es am nächsten Tag.</div>
        <div class="fo-lbl">Seite</div>
        <div class="fo-wahl"><button type="button" data-seite="links">Links</button><button type="button" data-seite="rechts">Rechts</button></div>`,
      flasche: `<div class="fo-lbl">Menge</div>
        <div class="fo-mls">${pre.map(x => `<button type="button" data-ml="${x}">${x} ml</button>`).join("")}<input class="fo-in fo-mlin" type="number" inputmode="numeric" min="1" max="400" placeholder="ml" value="${ml && !pre.includes(ml) ? ml : ""}"></div>
        <div class="fo-lbl">Fertig getrunken um</div>
        <input class="fo-in fo-zeit" type="time" value="${this._hm(von)}">`,
      windel: `<div class="fo-lbl">Art</div>
        <div class="fo-big3"><button type="button" data-art="nass" style="--q:var(--c-diaper)"><span>💧</span>Nass</button><button type="button" data-art="voll" style="--q:var(--c-stool)"><span>💩</span>Voll</button><button type="button" data-art="beides" style="--q:var(--c-stool)"><span>💧💩</span>Beides</button></div>
        <div class="fo-lbl">Uhrzeit</div>
        <input class="fo-in fo-zeit" type="time" value="${this._hm(von)}">`,
    }[typ];
    if (!felder) return;
    const ov = this._sheet(`<div class="fo-sh-head"><b>${titel} · ${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      ${neu ? `<div class="fo-lbl">Tag</div><div class="fo-wahl"><button type="button" data-tag="heute">Heute</button><button type="button" data-tag="gestern">Gestern</button></div>` : ""}
      ${felder}
      <button class="fo-ok" type="button">${neu ? "Eintragen" : "Speichern"}</button>
      ${neu ? "" : `<button class="fo-del" type="button">Eintrag löschen</button>`}`);
    const mark = () => {
      ov.querySelectorAll("[data-tag]").forEach(b => b.classList.toggle("fo-on", b.dataset.tag === tag));
      ov.querySelectorAll("[data-seite]").forEach(b => b.classList.toggle("fo-on", b.dataset.seite === seite));
      ov.querySelectorAll("[data-ml]").forEach(b => b.classList.toggle("fo-on", Number(b.dataset.ml) === ml));
      ov.querySelectorAll("[data-art]").forEach(b => b.classList.toggle("fo-on", b.dataset.art === art));
    };
    ov.querySelectorAll("[data-tag]").forEach(b => b.addEventListener("click", () => { tag = b.dataset.tag; mark(); }));
    ov.querySelectorAll("[data-seite]").forEach(b => b.addEventListener("click", () => { seite = b.dataset.seite; mark(); }));
    ov.querySelectorAll("[data-art]").forEach(b => b.addEventListener("click", () => { art = b.dataset.art; mark(); }));
    ov.querySelectorAll("[data-ml]").forEach(b => b.addEventListener("click", () => { ml = Number(b.dataset.ml); ov.querySelector(".fo-mlin").value = ""; mark(); }));
    const mlin = ov.querySelector(".fo-mlin");
    if (mlin) mlin.addEventListener("input", ev => { ml = Number(ev.target.value) || 0; mark(); });
    mark();
    ov.querySelector(".fo-ok").addEventListener("click", async () => {
      const basis = neu ? this._mitternacht(new Date(), tag === "gestern" ? -1 : 0) : e.start;
      let a, b, p;
      if (typ === "stillen") {
        const vz = ov.querySelector(".fo-von").value, bz = ov.querySelector(".fo-bis").value;
        if (!vz || !bz) { U.toast(this, "Bitte Beginn und Ende angeben"); return; }
        // Ändern: ref = ursprünglicher Beginn/Ende, ein unverändert gespeicherter Eintrag bleibt exakt gleich (auch in der doppelten Stunde
        // beim Ende der Sommerzeit). Neu: das Ende liegt nach dem Beginn.
        a = this._at(basis, vz, neu ? undefined : { ref: e.start, wie: true });
        const ob = neu ? { ref: a } : { ref: e.end, wie: true };
        b = this._at(basis, bz, ob);
        if (b <= a) b = this._at(basis, bz, Object.assign({ tage: 1 }, ob));   // über Mitternacht
        if (a - Date.now() > 5 * MIN) { U.toast(this, "Der Beginn liegt in der Zukunft – Tag prüfen"); return; }
        if (b - a > 3 * STD) { U.toast(this, "Länger als 3 Stunden – Zeiten prüfen"); return; }
        if (neu && b - Date.now() > 5 * MIN) b = new Date(Math.max(+a + MIN, Date.now()));
        p = { seite };
      } else {
        const zt = ov.querySelector(".fo-zeit").value;
        if (!zt) { U.toast(this, "Bitte die Uhrzeit angeben"); return; }
        if (typ === "flasche" && !(ml > 0 && ml <= 400)) { U.toast(this, "Bitte eine Menge angeben"); return; }
        a = this._at(basis, zt, neu ? undefined : { ref: e.start, wie: true });
        if (a - Date.now() > 5 * MIN) { U.toast(this, "Die Uhrzeit liegt in der Zukunft – Tag prüfen"); return; }
        b = new Date(+a + MIN);   // Fläschchen und Windel sind Punkte: eine Minute ab der Uhrzeit
        p = typ === "flasche" ? { ml } : { art };
      }
      const raw = this._d && this._d.kids[kid.key], letzteEnde = Math.max(0, ...((raw && raw.feeds) || []).filter(x => x.typ === "stillen").map(x => +x.end));
      this._closeSheet();
      let ok;
      if (neu) {
        ok = await this._evNeu(kid, typ, p, a, b);
        if (ok) {
          U.toast(this, `${kid.name}: ${this._evDaten(typ, p).summary} eingetragen ✓`);
          // Ist es die jüngste Mahlzeit, gilt für das nächste Mal die andere Seite — wie beim Nachtragen in der Stillkarte.
          if (typ === "stillen" && kid.side && !this._laeuft(kid) && +b >= letzteEnde)
            this._hass.callService("input_select", "select_option", { entity_id: kid.side, option: seite === "links" ? "rechts" : "links" }).catch(() => { /* nur Komfort */ });
        }
      } else {
        ok = await this._evAendern(kid, typ, e, p, a, b);
        if (ok) U.toast(this, "Eintrag geändert ✓");
      }
      if (ok) this._load();
    });
    if (!neu) ov.querySelector(".fo-del").addEventListener("click", async () => {
      const was = typ === "stillen" ? `Stillen${e.seite ? ` ${e.seite}` : ""} ${this._hm(e.start)}–${this._hm(e.end)}`
        : typ === "flasche" ? `Fläschchen${e.ml ? ` ${e.ml} ml` : ""} um ${this._hm(e.start)}` : `Windel ${this._artText(e.art)} um ${this._hm(e.start)}`;
      if (!window.confirm(`${kid.name}: ${was} löschen?`)) return;
      this._closeSheet();
      if (await this._evLoeschen(kid, typ, e.uid)) this._load();
    });
  }
  // Überschrift und Beschreibung genau wie die Stillkarte und die Windelkarte sie schreiben.
  _evDaten(typ, p) {
    if (typ === "stillen") return { summary: `Stillen ${p.seite}`, description: JSON.stringify({ typ: "stillen", seite: p.seite, auto: false }) };
    if (typ === "flasche") return { summary: `Fläschchen ${p.ml} ml`, description: JSON.stringify({ typ: "flasche", ml: p.ml }) };
    return { summary: `Windel ${this._artText(p.art)}`, description: JSON.stringify({ typ: "windel", art: p.art }) };
  }
  _evKal(kid, typ) { return typ === "windel" ? kid.diaper_calendar : kid.feeding_calendar; }
  async _evNeu(kid, typ, p, a, b) {
    const d = this._evDaten(typ, p);
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this._evKal(kid, typ), summary: d.summary, description: d.description,
        start_date_time: U.haZeit(a), end_date_time: U.haZeit(b) });
      return true;
    } catch (x) { U.toast(this, "Eintrag konnte nicht gespeichert werden"); return false; }
  }
  async _evLoeschen(kid, typ, uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this._evKal(kid, typ), uid }); return true; }
    catch (x) { if (!leise) U.toast(this, "Eintrag konnte nicht gelöscht werden"); return false; }
  }
  // Ändern wie in Still- und Windelkarte: erst aktualisieren, sonst neu anlegen und den alten löschen.
  async _evAendern(kid, typ, alt, p, a, b) {
    const d = this._evDaten(typ, p);
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: this._evKal(kid, typ), uid: alt.uid,
        event: { summary: d.summary, description: d.description, dtstart: U.haZeit(a), dtend: U.haZeit(b) } });
      return true;
    } catch (x) {
      if (!(await this._evNeu(kid, typ, p, a, b))) return false;
      if (!(await this._evLoeschen(kid, typ, alt.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  // ⚙ Erinnerung und Pause: direkt am Helfer, dieselben wie in Stillkarte und Erinnerungs-Automation.
  _sheetEinst() {
    const ov = this._sheet(`<div class="fo-sh-head"><b>⚙ Einstellungen</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-einst"></div>
      <div class="fo-sh-hint">Dieselben Helfer nutzen die Stillkarte und die Erinnerung.</div>`);
    this._einstOffen = true; this._einstHtml = "";
    ov.querySelector(".fo-einst").addEventListener("click", ev => {
      const b = ev.target.closest("[data-es]");
      if (b && !b.disabled) this._einstSetzen(b.dataset.es, Number(b.dataset.d));
    });
    this._einstZeichne();
  }
  _einstZeichne() {
    const box = this._ov && this._ov.querySelector(".fo-einst"); if (!box) return;
    const c = this.config;
    const html = [["reminder_entity", "Erinnerung tagsüber"], ["reminder_night_entity", `Erinnerung nachts (${c.night_start}–${c.night_end} Uhr)`], ["meal_pause_entity", "Pause bis neue Mahlzeit"]]
      .filter(([opt]) => c[opt]).map(([opt, titel]) => {
        const st = this._hass && this._hass.states[c[opt]], a = (st && st.attributes) || {}, n = st ? parseFloat(st.state) : NaN, da = isFinite(n);
        const min = a.min != null && isFinite(Number(a.min)) ? Number(a.min) : -Infinity, max = a.max != null && isFinite(Number(a.max)) ? Number(a.max) : Infinity;
        const wert = da ? `${n.toLocaleString("de-AT", { maximumFractionDigits: 2 })}${a.unit_of_measurement ? ` ${U.esc(a.unit_of_measurement)}` : ""}` : "–";
        return `<div class="fo-er"><span>${U.esc(titel)}</span>
          <button type="button" data-es="${opt}" data-d="-1" aria-label="weniger" ${!da || n <= min ? "disabled" : ""}>−</button>
          <b class="fo-er-v">${wert}</b>
          <button type="button" data-es="${opt}" data-d="1" aria-label="mehr" ${!da || n >= max ? "disabled" : ""}>＋</button></div>`;
      }).join("");
    if (html === this._einstHtml) return;   // der Zustand hat sich nicht geändert
    this._einstHtml = html; box.innerHTML = html;
  }
  _einstSetzen(opt, richtung) {
    const id = this.config[opt], st = id && this._hass && this._hass.states[id], n = st ? parseFloat(st.state) : NaN;
    if (!isFinite(n)) return;
    const a = st.attributes || {}, step = Number(a.step) > 0 ? Number(a.step) : 1;
    let v = Number((n + richtung * step).toFixed(6));
    if (a.min != null && isFinite(Number(a.min))) v = Math.max(Number(a.min), v);
    if (a.max != null && isFinite(Number(a.max))) v = Math.min(Number(a.max), v);
    if (v === n) return;
    this._hass.callService(id.split(".")[0], "set_value", { entity_id: id, value: v }).catch(() => U.toast(this, "Der Wert konnte nicht geändert werden"));
  }

  // Wiegen und Ändern im Format der fp-weight-card: Ganztagstermin „Name 3450 g“, höchstens ein Wert je Kind und Tag.
  _sheetWiegen(kid, e) {
    const heute = this._isoTag(new Date());
    const ov = this._sheet(`<div class="fo-sh-head"><b>⚖️ ${e ? "Gewicht ändern" : "Wiegen"} · ${U.esc(kid.name)}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-lbl">Gewicht</div>
      <input class="fo-in fo-gin" type="text" inputmode="decimal" placeholder="z. B. 3450 oder 3,45" value="${e ? e.g : ""}">
      <div class="fo-sh-hint">Gramm oder Kilo – „3450“ und „3,45“ ergeben dasselbe.</div>
      <div class="fo-lbl">Datum</div>
      <input class="fo-in fo-datum" type="date" value="${e ? this._isoTag(e.date) : heute}" max="${heute}">
      <button class="fo-ok" type="button">${e ? "Speichern" : "Eintragen"}</button>
      ${e ? `<button class="fo-del" type="button">Messung löschen</button>` : ""}`);
    if (!e) setTimeout(() => { const i = ov.querySelector(".fo-gin"); if (i) i.focus(); }, 50);
    ov.querySelector(".fo-ok").addEventListener("click", async () => {
      const g = this._gramm(ov.querySelector(".fo-gin").value), ds = ov.querySelector(".fo-datum").value;
      if (!ds) { U.toast(this, "Bitte ein Datum wählen"); return; }
      if (g < 500 || g > 30000) { U.toast(this, "Das Gewicht sieht nicht richtig aus – bitte prüfen"); return; }
      if (ds > heute) { U.toast(this, "Das Datum liegt in der Zukunft"); return; }
      const date = this._day(ds);
      const gleich = ((this._d && this._d.weights) || []).find(x => x.kind === kid.key && this._isoTag(x.date) === ds && (!e || x.uid !== e.uid));
      this._closeSheet();
      let ok;
      if (e) ok = await this._gewichtAendern(e, kid, date, g);
      else if (gleich) { ok = await this._gewichtAendern(gleich, kid, date, g, this._jetztHM()); if (ok) U.toast(this, `Wert vom ${this._dmy(date)} ersetzt`); }
      else { ok = await this._gewichtNeu(kid, date, g); if (ok) U.toast(this, `${kid.name}: ${this._kg(g)} eingetragen ✓`); }
      if (ok) this._load();
    });
    if (e) ov.querySelector(".fo-del").addEventListener("click", async () => {
      if (!window.confirm(`${kid.name}: ${this._kg(e.g)} vom ${this._dmy(e.date)} löschen?`)) return;
      this._closeSheet();
      if (await this._gewichtLoeschen(e.uid)) this._load();
    });
  }
  // Schlaf nachtragen (auch für beide auf einmal) oder eine Schlafphase ändern bzw. löschen.
  _sheetSchlaf(kid, e) {
    const kids = this.config.kids.filter(k => k.sleep_calendar);
    if (!kids.length) return;
    let key = (kid || kids[0]).key;
    const jetzt = new Date(), von = e ? new Date(e.start) : new Date(+jetzt - STD), bis = e ? new Date(e.end) : jetzt;
    const wahl = !e && kids.length > 1 ? `<div class="fo-lbl">Kind</div><div class="fo-mls fo-kids">${kids.map(k => `<button type="button" data-k="${U.esc(k.key)}">${U.esc(k.name)}</button>`).join("")}${kids.length === 2 ? `<button type="button" data-k="*">Beide</button>` : ""}</div>` : "";
    const ov = this._sheet(`<div class="fo-sh-head"><b>😴 ${e ? `Schlaf ändern · ${U.esc(kid.name)}` : "Schlaf nachtragen"}</b><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      ${wahl}
      <div class="fo-lbl">Eingeschlafen</div>
      <div class="fo-zeitrow"><input class="fo-in fo-vd" type="date" value="${this._isoTag(von)}" max="${this._isoTag(jetzt)}"><input class="fo-in fo-vz" type="time" value="${this._hm(von)}"></div>
      <div class="fo-lbl">Aufgewacht</div>
      <input class="fo-in fo-bz" type="time" value="${this._hm(bis)}">
      <div class="fo-sh-hint">Liegt das Aufwachen vor dem Einschlafen, war es am nächsten Tag.</div>
      <button class="fo-ok" type="button">${e ? "Speichern" : "Eintragen"}</button>
      ${e ? `<button class="fo-del" type="button">Schlaf löschen</button>` : ""}`);
    const mark = () => ov.querySelectorAll("[data-k]").forEach(b => b.classList.toggle("fo-on", b.dataset.k === key));
    ov.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => { key = b.dataset.k; mark(); }));
    mark();
    ov.querySelector(".fo-ok").addEventListener("click", async () => {
      const ds = ov.querySelector(".fo-vd").value, vz = ov.querySelector(".fo-vz").value, bz = ov.querySelector(".fo-bz").value;
      if (!ds || !vz || !bz) { U.toast(this, "Bitte Datum und beide Uhrzeiten angeben"); return; }
      // Ändern: ref = ursprünglicher Beginn/Ende (in der doppelten Stunde beim Ende der Sommerzeit bleibt alles, wie es war); neu: Ende nach Beginn.
      const dag = this._day(ds);
      const a = this._at(dag, vz, e ? { ref: e.start, wie: true } : undefined);
      const ob = e ? { ref: e.end, wie: true } : { ref: a };
      let b = this._at(dag, bz, ob);
      if (b <= a) b = this._at(dag, bz, Object.assign({ tage: 1 }, ob));   // über Mitternacht
      if (b - Date.now() > 5 * MIN) { U.toast(this, "Das Aufwachen liegt in der Zukunft"); return; }
      if (b - a > 16 * STD) { U.toast(this, "Länger als 16 Stunden – bitte die Zeiten prüfen"); return; }
      const ziel = e ? [kid] : key === "*" ? kids : [this._kid(key)];
      // Wie die Kollisionsprüfung bei Napper: keine zwei Schlafphasen eines Kinds übereinander.
      for (const k of ziel) {
        const x = this._vm(k).schlaf.find(y => (!e || y.uid !== e.uid) && +y.start < +b && +y.end > +a);
        if (x) { U.toast(this, `${k.name}: überschneidet sich mit ${this._hm(x.start)}–${x.laeuft ? "jetzt" : this._hm(x.end)}`); return; }
      }
      this._closeSheet();
      let ok = true;
      for (const k of ziel) ok = (e ? await this._schlafAendern(e, k, a, b) : await this._schlafNeu(k, a, b)) && ok;
      if (ok) U.toast(this, e ? "Schlaf geändert ✓" : `${ziel.map(k => k.name).join(" und ")}: Schlaf ${this._hm(a)}–${this._hm(b)} eingetragen ✓`);
      this._load();
    });
    if (e) ov.querySelector(".fo-del").addEventListener("click", async () => {
      if (!window.confirm(`${kid.name}: Schlaf ${this._hm(e.start)}–${this._hm(e.end)} löschen?`)) return;
      this._closeSheet();
      if (await this._schlafLoeschen(kid, e.uid)) this._load();
    });
  }
  async _schlafNeu(kid, a, b) {
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: kid.sleep_calendar, summary: "Schlaf", description: JSON.stringify({ typ: "schlaf", auto: false }),
        start_date_time: U.haZeit(a), end_date_time: U.haZeit(b) });
      return true;
    } catch (x) { U.toast(this, "Schlaf konnte nicht gespeichert werden"); return false; }
  }
  async _schlafLoeschen(kid, uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: kid.sleep_calendar, uid }); return true; }
    catch (x) { if (!leise) U.toast(this, "Schlaf konnte nicht gelöscht werden"); return false; }
  }
  // Ändern entfernt die Markierung „automatisch beendet“, wie bei der Stillkarte.
  async _schlafAendern(alt, kid, a, b) {
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: kid.sleep_calendar, uid: alt.uid,
        event: { summary: "Schlaf", description: JSON.stringify({ typ: "schlaf", auto: false }), dtstart: U.haZeit(a), dtend: U.haZeit(b) } });
      return true;
    } catch (x) {
      if (!(await this._schlafNeu(kid, a, b))) return false;
      if (!(await this._schlafLoeschen(kid, alt.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }
  _isoTag(d) { return `${d.getFullYear()}-${this._p(d.getMonth() + 1)}-${this._p(d.getDate())}`; }
  // Eingabe in Gramm oder Kilo: "3450", "3,45", "3.45 kg" → 3450
  _gramm(v) {
    const n = Number(String(v || "").trim().toLowerCase().replace(/\s*(kg|g)$/, "").replace(",", "."));
    return isFinite(n) && n > 0 ? Math.round(n < 30 ? n * 1000 : n) : 0;
  }
  // Wiegezeit: wer einträgt, hat gerade gewogen — die Uhrzeit der Eingabe ist die Wiegezeit.
  _jetztHM() { const n = new Date(); return `${this._p(n.getHours())}:${this._p(n.getMinutes())}`; }
  _gewichtEv(kid, date, g, zeit) {
    const nach = new Date(date); nach.setDate(nach.getDate() + 1);
    return { summary: `${kid.name} ${g} g`, description: JSON.stringify(Object.assign({ typ: "gewicht", kind: kid.weight_key || kid.key, g }, zeit ? { zeit } : {})), von: this._isoTag(date), bis: this._isoTag(nach) };
  }
  async _gewichtNeu(kid, date, g, zeit = this._jetztHM()) {
    const d = this._gewichtEv(kid, date, g, zeit);
    try {
      await this._hass.callService("calendar", "create_event", { entity_id: this.config.weight_calendar, summary: d.summary, description: d.description, start_date: d.von, end_date: d.bis });
      return true;
    } catch (x) { U.toast(this, "Gewicht konnte nicht gespeichert werden"); return false; }
  }
  async _gewichtLoeschen(uid, leise) {
    try { await this._hass.callWS({ type: "calendar/event/delete", entity_id: this.config.weight_calendar, uid }); return true; }
    catch (x) { if (!leise) U.toast(this, "Messung konnte nicht gelöscht werden"); return false; }
  }
  // Korrigieren behält die Wiegezeit; wer am selben Tag neu wiegt, übergibt die neue.
  async _gewichtAendern(alt, kid, date, g, zeit = alt.zeit) {
    const d = this._gewichtEv(kid, date, g, zeit);
    try {
      await this._hass.callWS({ type: "calendar/event/update", entity_id: this.config.weight_calendar, uid: alt.uid,
        event: { summary: d.summary, description: d.description, dtstart: d.von, dtend: d.bis } });
      return true;
    } catch (x) {
      // Rückfall wie in der Gewichtskarte: neu anlegen, dann alt löschen — und laut sagen, falls der alte bleibt.
      if (!(await this._gewichtNeu(kid, date, g, zeit))) return false;
      if (!(await this._gewichtLoeschen(alt.uid, true))) U.toast(this, "Gespeichert, aber der alte Eintrag blieb stehen – bitte Duplikat prüfen");
      return true;
    }
  }

  _openChat() {
    const ov = this._sheet(`<div class="fo-sh-head"><b class="fo-sh-ai">${SPARK} Frag nach</b><button class="fo-neu" type="button" hidden>Neues Gespräch</button><button class="fo-x" type="button" aria-label="Schließen">✕</button></div>
      <div class="fo-sh-sub">Antworten aus euren Einträgen – kein ärztlicher Rat</div>
      <div class="fo-msgs"></div><div class="fo-sugg"></div>
      <form class="fo-ask"><input class="fo-in" type="text" enterkeyhint="send" autocomplete="off" placeholder="Frag etwas, z. B. „Wie war die letzte Nacht?“"><button class="fo-send" type="submit" aria-label="Fragen">➤</button></form>`, "fo-chat");
    this._chatOffen = true;
    ov.querySelector(".fo-ask").addEventListener("submit", ev => {
      ev.preventDefault();
      const inp = ov.querySelector(".fo-ask .fo-in"), q = inp.value.trim();
      if (q) { inp.value = ""; this._frage(q); }
    });
    ov.querySelector(".fo-sugg").addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) this._frage(b.textContent); });
    ov.querySelector(".fo-neu").addEventListener("click", () => { if (!this._busy) { this._chat = []; this._chatMerken(); this._paintChat(); } });
    if (!this._busy) this._chat = this._chatLaden();   // eine Antwort, die nach dem Rausklicken noch kam, steht schon im Gerät
    this._paintChat();
  }
  _paintSugg() {
    const box = this._chatOffen && this._ov.querySelector(".fo-sugg"); if (!box) return;
    const kids = this.config.kids, n = kids.map(k => k.name);
    const s = ["Wie war die letzte Nacht?", "Fasse den heutigen Tag zusammen", "Siehst du ein Muster bei den Abständen?"];
    if (kids.length === 2) s.push(`Vergleiche ${n[0]} und ${n[1]} diese Woche`);
    if (kids.some(k => k.sleep_calendar)) s.push(kids.length === 2 ? `Wie haben ${n[0]} und ${n[1]} geschlafen?` : `Wie hat ${n[0]} geschlafen?`);
    if (this.config.weight_calendar) s.push("Wie entwickelt sich das Gewicht?");
    box.innerHTML = s.map(x => `<button type="button">${U.esc(x)}</button>`).join("");
    box.hidden = this._chat.length > 0;
  }
  _paintChat() {
    const box = this._chatOffen && this._ov.querySelector(".fo-msgs"); if (!box) return;
    box.innerHTML = this._chat.map(m => `<div class="fo-msg fo-${m.role}">${m.role === "ai" ? this._md(m.text) : U.esc(m.text)}</div>`).join("")
      + (this._busy ? `<div class="fo-msg fo-ai fo-tipp"><i></i><i></i><i></i></div>` : "");
    box.hidden = !this._chat.length && !this._busy;
    box.scrollTop = box.scrollHeight;
    this._ov.querySelector(".fo-neu").hidden = !this._chat.length;
    this._paintSugg();
  }
  // Ein kleines, sicheres Markdown: erst alles maskieren, dann **fett** und Aufzählungen.
  _md(txt) {
    const zeilen = U.esc(String(txt || "").trim()).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n/);
    let html = "", liste = false;
    for (const z of zeilen) {
      const m = z.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!liste) { html += "<ul>"; liste = true; } html += `<li>${m[1]}</li>`; continue; }
      if (liste) { html += "</ul>"; liste = false; }
      if (z.trim()) html += `<p>${z.replace(/^#+\s*/, "")}</p>`;
    }
    return html + (liste ? "</ul>" : "");
  }
  async _frage(q) {
    if (this._busy) return;
    if (!this._d) { U.toast(this, "Die Einträge laden noch – gleich nochmal versuchen"); return; }
    this._chat.push({ role: "me", text: q }); this._busy = true; this._chatMerken(); this._paintChat();
    try {
      const data = { task_name: "Frag nach", instructions: this._prompt(q) };
      if (this.config.ai_entity) data.entity_id = this.config.ai_entity;
      const r = await this._hass.callService("ai_task", "generate_data", data, undefined, false, true);
      let txt = r && r.response && r.response.data;
      if (txt && typeof txt === "object") txt = txt.text || JSON.stringify(txt);
      if (!txt) throw new Error("leer");
      this._chat.push({ role: "ai", text: String(txt) });
    } catch (e) {
      this._chat.push({ role: "ai", text: "Das hat leider nicht geklappt. Ist eine KI (ai_task) in Home Assistant eingerichtet?" });
    }
    this._busy = false;
    this._chat = this._chat.slice(-12);
    this._chatMerken();
    this._paintChat();
  }
  _prompt(q) {
    const jetzt = new Date(), kids = this.config.kids;
    const verlauf = this._chat.slice(0, -1).slice(-8).map(m => `${m.role === "me" ? "Eltern" : "Assistent"}: ${m.text}`).join("\n");
    return [
      `Du bist der freundliche Assistent im Familienplaner einer Familie mit ${kids.length === 1 ? "einem Baby" : kids.length === 2 ? "zwei Babys" : `${kids.length} Kindern`} (${kids.map(k => k.name).join(", ")}).`,
      "Die Eltern fragen nach den protokollierten Daten: Stillen, Fläschchen, Windeln, Schlaf, Gewicht und Meilensteine.",
      "Regeln:",
      "- Antworte auf Deutsch (österreichisch), warm und kurz: höchstens 6 Sätze oder eine kurze Liste.",
      "- Stütze dich nur auf die Daten unten. Rechne sorgfältig und nenne konkrete Zahlen und Uhrzeiten. Wenn die Daten etwas nicht hergeben, sag das ehrlich.",
      "- Bei Fragen nach Mustern: vergleiche Tage und Nächte miteinander und nenne, worauf du dich stützt. Lücken in den Daten können auch vergessene Einträge sein.",
      "- Keine Diagnosen. Wirkt etwas besorgniserregend (z. B. deutlich weniger nasse Windeln, Gewichtsverlust, sehr lange Pausen bei einem Neugeborenen), empfiehl freundlich, mit Hebamme oder Kinderärztin zu sprechen.",
      "- Format: einfacher Text, Aufzählungen mit „- “, Wichtiges mit **fett**. Keine Tabellen, keine Überschriften.",
      "",
      `Jetzt ist ${jetzt.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${this._hm(jetzt)} Uhr.`,
      "",
      "DATEN",
      this._kontext(),
      verlauf ? `\nBISHERIGES GESPRÄCH\n${verlauf}` : "",
      `\nFRAGE DER ELTERN: ${q}`,
    ].join("\n");
  }
  // Alles als knappe Textzeilen: Tageswerte für zwei Wochen (vorgerechnet, damit die KI nicht
  // selbst zählen muss), Nächte, und die einzelnen Einträge der letzten drei Tage.
  _kontext() {
    const L = [], jetzt = new Date(), tage = Number(this.config.days || 14);
    const tagName = d => `${WT[d.getDay()]} ${this._dm(d)}`;
    for (const kid of this.config.kids) {
      const vm = this._vm(kid), raw = vm.raw;
      L.push(`\n## ${kid.name}`);
      if (kid.birth) L.push(`Geboren ${this._dmy(this._day(kid.birth))}${kid.ga ? ` in SSW ${kid.ga}` : ""}, heute ${this._alterText(kid)} alt.`);
      if (this._laeuft(kid)) L.push(`Gerade läuft: Stillen seit ${this._hm(new Date(this._beginn(kid)))}${this._seite(kid) ? ` (${this._seite(kid)})` : ""}.`);
      if (kid.feeding_calendar || kid.diaper_calendar) {
        L.push(`Tageswerte (0–24 Uhr; eine Mahlzeit = Einträge mit höchstens ${this._pauseMin()} Min Pause; Abstand = Beginn zu Beginn):`);
        L.push("Tag | Mahlzeiten | gestillt Min | Fläschchen ml | Ø Abstand | längster Abstand | Windeln nass/voll");
        for (let i = tage - 1; i >= 0; i--) {
          const d0 = this._mitternacht(jetzt, -i), t0 = +d0, t1 = t0 + TAG;
          const ms = vm.meals.filter(m => m.start >= t0 && m.start < t1);
          const idx = vm.meals.map((m, j) => j).filter(j => vm.meals[j].start >= t0 && vm.meals[j].start < t1 && j > 0);
          const abst = idx.map(j => ({ d: vm.meals[j].start - vm.meals[j - 1].start, a: vm.meals[j - 1].start })).filter(x => x.d <= 8 * STD);
          const lang = abst.reduce((b, x) => x.d > (b ? b.d : 0) ? x : b, null);
          const fe = raw.feeds.filter(e => +e.start >= t0 && +e.start < t1);
          const st = Math.round(fe.filter(e => e.typ === "stillen").reduce((s, e) => s + Math.max(0, e.end - e.start), 0) / MIN);
          const ml = fe.filter(e => e.typ === "flasche").reduce((s, e) => s + (e.ml || 0), 0);
          const wi = raw.diapers.filter(e => +e.start >= t0 && +e.start < t1);
          if (!ms.length && !wi.length) { L.push(`${tagName(d0)} | keine Einträge`); continue; }
          L.push(`${tagName(d0)}${i === 0 ? " (bis jetzt)" : ""} | ${ms.length} | ${st} | ${ml} | ${abst.length ? this._hDauer(abst.reduce((s, x) => s + x.d, 0) / abst.length) : "–"} | ${lang ? `${this._hDauer(lang.d)} ab ${this._hm(new Date(lang.a))}` : "–"} | ${wi.filter(e => e.art !== "voll").length}/${wi.filter(e => e.art !== "nass").length}`);
        }
        const n = this._naechte(vm.meals, 7).filter(x => x.daten);
        if (n.length) {
          L.push("Nächte (19–7 Uhr, benannt nach dem Morgen):");
          n.forEach(x => L.push(`Nacht auf ${tagName(x.morgen)}: ${x.n} Mahlzeiten, längste Pause ${x.best ? `${this._hDauer(x.best)} (${this._hm(new Date(x.von))}–${this._hm(new Date(x.bis))})` : "–"}`));
        }
        if (vm.prog) L.push(`Typischer Abstand zuletzt: ${this._hDauer(vm.prog.med)}; nächste Mahlzeit erwartet etwa ${this._hm(new Date(vm.prog.t))}.`);
        const ab = +this._mitternacht(jetzt, -2);
        const einzel = [
          ...raw.feeds.filter(e => +e.start >= ab).map(e => ({ t: +e.start, s: e.typ === "flasche" ? `Fläschchen${e.ml ? ` ${e.ml} ml` : ""} (Uhrzeit = fertig getrunken)` : `Stillen${e.seite ? ` ${e.seite}` : ""} bis ${this._hm(e.end)} (${Math.round((e.end - e.start) / MIN)} Min)` })),
          ...raw.diapers.filter(e => +e.start >= ab).map(e => ({ t: +e.start, s: `Windel ${e.art}` })),
        ].sort((a, b) => a.t - b.t);
        if (einzel.length) { L.push("Einzelne Einträge seit vorgestern:"); einzel.forEach(x => L.push(`${tagName(new Date(x.t))} ${this._hm(new Date(x.t))} ${x.s}`)); }
      }
      if (kid.sleep_calendar || kid.sleep_switch) {
        if (vm.schlaeft) L.push(`Gerade läuft: Schlaf seit ${this._hm(new Date(vm.schlafAb))}.`);
        L.push("Schlaf je Tag (0–24 Uhr, Schlaf über Mitternacht aufgeteilt; nachts = 19–7 Uhr vor dem Morgen dieses Tags):");
        L.push("Tag | Schlaf gesamt | nachts | Schlafphasen | längste");
        for (let i = tage - 1; i >= 0; i--) {
          const d0 = this._mitternacht(jetzt, -i), t0 = +d0, t1 = t0 + TAG;
          const ph = vm.schlaf.filter(e => +e.end > t0 && +e.start < t1);
          if (!vm.schlaf.length || t1 <= +vm.schlaf[0].start) continue;   // vor dem ersten Eintrag wurde noch nicht protokolliert
          if (!ph.length) { L.push(`${tagName(d0)} | kein Schlaf eingetragen`); continue; }
          const sum = ph.reduce((a, e) => a + this._ueber(+e.start, +e.end, t0, t1), 0), nacht = vm.schlaf.reduce((a, e) => a + this._ueber(+e.start, +e.end, t0 - 5 * STD, t0 + 7 * STD), 0);
          const lang = ph.reduce((m, e) => (e.end - e.start > m.end - m.start ? e : m));
          L.push(`${tagName(d0)}${i === 0 ? " (bis jetzt)" : ""} | ${this._hDauer(sum)} | ${this._hDauer(nacht)} | ${ph.length} | ${this._hDauer(lang.end - lang.start)} ab ${+lang.start < t0 ? `${WT[lang.start.getDay()]} ` : ""}${this._hm(lang.start)}`);
        }
        const ab2 = +this._mitternacht(jetzt, -2), neu = vm.schlaf.filter(e => +e.end >= ab2);
        if (neu.length) { L.push("Schlafphasen seit vorgestern:"); neu.forEach(e => L.push(`${tagName(new Date(e.start))} ${this._hm(e.start)}–${e.laeuft ? "jetzt" : this._hm(e.end)} (${this._hDauer(e.end - e.start)})${e.auto ? " automatisch beendet, Ende unsicher" : ""}`)); }
        if (vm.schlafProg) L.push(`Typische Wachzeit zuletzt: ${this._hDauer(vm.schlafProg.med)}; nächster Schlaf erwartet etwa ${this._hm(new Date(vm.schlafProg.lo))}–${this._hm(new Date(vm.schlafProg.hi))}.`);
      }
      if (vm.weights.length) L.push(`Gewicht: ${vm.weights.map(w => `${this._dmy(w.date)}${w.zeit ? ` ${w.zeit}` : ""} ${w.g} g`).join("; ")}`);
      if (vm.ms.length) L.push(`Meilensteine: ${vm.ms.map(m => `${this._dmy(m.date)} ${m.t}`).join("; ")}`);
    }
    return L.join("\n");
  }

  _styles() {
    return `<style>
      /* Farben und Radien kommen aus dem Theme (Variablen --fp-*, siehe familienplaner-warm.yaml);
         was nach dem Komma steht, ist der Rückfall für Themes ohne diese Zeilen. */
      .fo-card{--b-bg:var(--ha-card-background, var(--card-background-color, #fff));--b-card:var(--fp-surface, var(--secondary-background-color, #f2f0ea));
        --b-card2:var(--fp-surface-2, var(--divider-color, #e0ddd4));--b-track:var(--b-card2);--b-line:var(--divider-color, rgba(0,0,0,.12));
        --b-text:var(--primary-text-color, #212121);--b-mut:var(--secondary-text-color, #727272);--b-faint:var(--disabled-text-color, var(--secondary-text-color, #9e9e9e));
        --b-acc:var(--fp-accent, var(--primary-color, #4F6B57));--b-acc2:rgba(var(--fp-accent-rgb, 79, 107, 87), .14);
        --b-alert:var(--fp-alert, var(--warning-color, #B97F06));
        --b-on:var(--fp-c-on, #1E1C18);--b-bar:var(--b-bg);--b-shadow:rgba(0,0,0,.18);
        --c-nurse:var(--fp-c-nurse, #D9719F);--c-bottle:var(--fp-c-bottle, #E3A43A);--c-diaper:var(--fp-c-diaper, #3E9DB0);--c-stool:var(--fp-c-stool, #A77446);--c-sleep:var(--fp-c-sleep, #8A87E0);
        --fo-hero-fb:linear-gradient(180deg, rgba(var(--fp-tint-rgb, 125,155,132), .28) 0%, rgba(var(--fp-tint-rgb, 125,155,132), 0) 100%);
        position:relative;padding:18px 16px 14px;background:var(--b-bg);color:var(--b-text);border-radius:var(--fp-radius, var(--ha-card-border-radius, 16px));container:fo-card / inline-size;}
      /* fo-dark: nur für die Rückfälle, die vom Modus abhängen (Nachthimmel, Schatten, Uhrzeitfelder, Kinderfarbe in der Kurve) */
      .fo-card.fo-dark{--fo-hero-fb:linear-gradient(180deg, #26324D 0%, rgba(38,50,77,0) 100%);--b-shadow:rgba(0,0,0,.45);}
      :where(.fo-card) button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;}   /* ohne Gewicht, damit Klassen mit eigener Schriftgröße gewinnen */
      .fo-sky{position:absolute;left:0;right:0;top:0;height:200px;border-radius:var(--fp-radius, var(--ha-card-border-radius, 16px)) var(--fp-radius, var(--ha-card-border-radius, 16px)) 0 0;pointer-events:none;
        background:var(--fp-hero-bg, var(--fo-hero-fb));}
      .fo-top,.fo-body{position:relative;}
      .fo-laden,.fo-leer{padding:24px 8px;text-align:center;color:var(--b-mut);font-size:.9rem;}

      /* Kopf */
      .fo-top{display:flex;align-items:center;gap:10px;min-height:50px;}
      .fo-who{display:flex;align-items:center;gap:12px;flex:1;min-width:0;}
      .fo-who-all{display:none;}
      .fo-card.fo-multi .fo-who-all{display:none;}
      @container fo-card (min-width: 680px){ .fo-card.fo-multi .fo-who-one{display:none;} .fo-card.fo-multi .fo-who-all{display:flex;} }
      /* Kindwechsel am Handy: ein großer Knopf je Kind, der gewählte in der Kinderfarbe gefüllt */
      .fo-kseg{gap:8px;align-items:stretch;}
      .fo-kb{flex:1 1 0;min-width:0;min-height:48px;display:flex;align-items:center;gap:8px;padding:6px 10px;border:2px solid transparent;border-radius:var(--fp-radius-sm, 12px);background:var(--b-card);text-align:left;cursor:pointer;}
      .fo-kb.fo-on{background:var(--k2);border-color:var(--k);}
      .fo-kb:active{transform:scale(.97);}
      .fo-kbn{display:flex;flex-direction:column;min-width:0;line-height:1.15;}
      .fo-kbn b,.fo-kbn small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .fo-kbn b{font-size:.98rem;font-weight:800;}
      .fo-kbn small{font-size:.72rem;color:var(--b-mut);font-weight:600;}
      @container fo-card (max-width: 420px){ .fo-kb{gap:6px;padding:6px 8px;} }
      .fo-wn{display:flex;flex-direction:column;min-width:0;}
      .fo-wn b{font-size:1.45rem;font-weight:800;letter-spacing:-.01em;line-height:1.15;}
      .fo-wn small{font-size:.86rem;color:var(--b-mut);font-weight:600;}
      .fo-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex:none;overflow:hidden;}
      .fo-av img{width:100%;height:100%;object-fit:cover;}
      .fo-avs{display:flex;} .fo-avs .fo-av{box-shadow:0 0 0 2px var(--b-bg);} .fo-avs .fo-av+.fo-av{margin-left:-12px;}
      .fo-spark{flex:none;width:44px;height:44px;border:none;border-radius:50%;background:transparent;color:var(--accent-color, var(--b-acc));cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .fo-spark:active{background:var(--b-acc2);}
      .fo-gear{flex:none;width:44px;height:44px;border:none;border-radius:50%;background:transparent;color:var(--b-mut) !important;font-size:1.45rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .fo-gear:active{background:var(--b-acc2);}
      /* Kopf klebt am Handy (nur mit mehreren Kindern) unter der festen HA-Kopfzeile, 6 px tiefer, damit Luft bleibt. Er behält
         Größe und Inhalt; beim Kleben blenden nur Fläche und Schatten dahinter ein (::before, randlos über die Kartenbreite und
         je 6 px über und unter der Zeile). Die Klasse fo-stuck setzt _klebt. Ganz oben (ohne fo-stuck) ist die Fläche durchsichtig,
         alles sieht aus wie ohne Kleben. Am Tablet und mit einem Kind gilt davon nichts. sticky mit z-index 5 macht .fo-top zu
         einem eigenen Stapelkontext: Die Fläche (z-index -1) liegt hinter den Knöpfen, die ganze Zeile über dem Inhalt der Karte. */
      .fo-wacht{height:1px;margin-top:-1px;pointer-events:none;}
      @container fo-card (max-width: 679px){
        .fo-card.fo-multi .fo-top{position:sticky;top:calc(var(--header-height, 56px) + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 6px);z-index:5;}
        .fo-card.fo-multi .fo-top::before{content:"";position:absolute;z-index:-1;left:-16px;right:-16px;top:-6px;bottom:-6px;pointer-events:none;
          background:var(--b-bg);box-shadow:0 8px 12px -8px var(--b-shadow);opacity:0;transition:opacity .2s ease-out;}
        .fo-card.fo-multi.fo-stuck .fo-top::before{opacity:1;pointer-events:auto;}   /* die Fläche fängt Tipps ab, sonst griffe man durch sie auf den Inhalt */
      }
      @media (prefers-reduced-motion: reduce){ .fo-top::before{transition:none !important;} }

      /* Tag blättern */
      .fo-daynav{display:flex;align-items:center;justify-content:center;gap:28px;margin:14px 0 12px;font-weight:700;font-size:1rem;}
      .fo-daynav span{min-width:110px;text-align:center;}
      .fo-daynav button{border:none;background:transparent;font-size:1.6rem;line-height:1;width:40px;height:36px;border-radius:var(--fp-radius-sm, 12px);color:var(--b-mut);cursor:pointer;}
      .fo-daynav button:disabled{opacity:.25;cursor:default;}

      /* Spalten: Zwillinge am Tablet nebeneinander, am Handy eins mit Wechsel im Kopf */
      .fo-grid{display:grid;grid-template-columns:1fr;gap:22px;}
      @container fo-card (min-width: 680px){
        .fo-card.fo-multi .fo-grid{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));grid-template-rows:repeat(var(--rows),auto);row-gap:0;}
        .fo-card.fo-multi .fo-col{display:grid;grid-template-rows:subgrid;grid-row:span var(--rows);}
      }
      .fo-blk{display:flex;flex-direction:column;min-width:0;}
      .fo-blk > .fo-next,.fo-blk > .fo-mcard,.fo-blk > .fo-kenn,.fo-blk > .fo-now,.fo-blk > .fo-tag{flex:1;}   /* nebeneinander gleich hoch */
      @container fo-card (max-width: 679px){ .fo-card.fo-multi .fo-col:not(.fo-sel){display:none;} .fo-colhead{display:none !important;} }
      .fo-col{min-width:0;}
      .fo-colhead{display:flex;align-items:center;gap:10px;margin:0 2px 12px;}
      .fo-colhead b{font-size:1.1rem;font-weight:800;} .fo-colhead small{color:var(--b-mut);font-weight:600;font-size:.8rem;}

      /* Schlafleiste: Beide schlafen und je Kind */
      /* So kräftig wie die Schnellknöpfe, damit sie nachts im Halbdunkel sofort zu finden sind.
         Wach: volle Schlaffarbe. Schläft: dunkel mit leuchtendem Rand und großer Dauer. */
      .fo-sleep{display:flex;flex-direction:column;gap:10px;margin:0 0 18px;}
      .fo-sl-row{display:flex;gap:10px;}
      @container fo-card (min-width: 680px){ .fo-sleep{flex-direction:row;} .fo-sl-row{display:contents;} .fo-sl-plus{order:9;} }
      .fo-sl{flex:1 1 0;min-width:0;min-height:76px;display:flex;align-items:center;gap:12px;border:none;border-radius:var(--fp-radius-sm, 12px);padding:12px 16px;cursor:pointer;text-align:left;
        background:var(--c-sleep);color:var(--b-on) !important;box-shadow:0 4px 16px color-mix(in srgb,var(--c-sleep) 40%,transparent);}
      .fo-sl:active{transform:scale(.97);}
      .fo-sl.fo-sl-an{background:color-mix(in srgb,var(--c-sleep) 24%,var(--b-bg));color:var(--b-text) !important;
        box-shadow:inset 0 0 0 3px var(--c-sleep),0 0 22px color-mix(in srgb,var(--c-sleep) 45%,transparent);}
      .fo-sle{font-size:2rem;line-height:1;flex:none;}
      .fo-slx{display:flex;flex-direction:column;min-width:0;}
      .fo-slt{font-weight:800;font-size:1.08rem;line-height:1.2;font-variant-numeric:tabular-nums;}
      .fo-sls{font-size:.84rem;opacity:.8;font-variant-numeric:tabular-nums;margin-top:2px;}
      .fo-sl-an .fo-sls{color:var(--c-sleep);opacity:1;font-weight:700;}
      /* Handy: die ganze Schlafleiste entfällt. Das gewählte Kind und „Beide“ stehen in der Aktionsleiste unten,
         nachgetragen wird über „＋ Nachtragen“ bei den Einträgen. */
      @container fo-card (max-width: 679px){ .fo-sleep{display:none;} }
      .fo-sl-plus{flex:none;width:56px;min-height:76px;border:none;border-radius:var(--fp-radius-sm, 12px);background:var(--b-card);color:var(--b-mut) !important;font-size:1.5rem;cursor:pointer;}
      .fo-s{position:absolute;top:0;bottom:0;border-radius:2px;background:var(--c-sleep);opacity:.4;}
      .fo-s.fo-s1{opacity:.9;}
      .fo-zeitrow{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .fo-kids button.fo-on{background:var(--c-sleep);color:var(--b-on) !important;}

      /* Schnellknöpfe */
      .fo-quick{display:flex;gap:10px;margin-bottom:14px;}
      .fo-q{flex:1 1 0;min-width:0;height:68px;border:none;border-radius:var(--fp-radius-sm, 12px);background:var(--q);color:var(--b-on) !important;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:.74rem;font-weight:700;box-shadow:0 4px 14px color-mix(in srgb,var(--q) 35%,transparent);}
      .fo-q:active{transform:scale(.95);}
      .fo-qe{font-size:1.45rem;line-height:1;}
      .fo-q-run{outline:3px solid color-mix(in srgb,var(--q) 45%,transparent);outline-offset:2px;}
      /* Handy: die Schnellknöpfe entfallen, Schlaf, Stillen, Windel und Fläschchen stehen in der Aktionsleiste unten */
      @container fo-card (max-width: 679px){ .fo-quick{display:none;} }
      /* Knöpfe der Aktionsleiste: wie .fo-q, aber niedriger (mindestens 52 px) und ohne eigenen Schatten, den trägt die Leiste.
         Der Schlafknopf zeigt wach seit … bzw. die Dauer; schläft das Kind, ist er gefüllt wie .fo-sl-an.
         „Beide“ daneben ist gefüllt, wenn alle schlafen. */
      .fo-qa{height:auto;min-height:52px;padding:5px 2px;gap:2px;box-shadow:none;}
      .fo-qa .fo-qe{font-size:1.25rem;}
      .fo-qt{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;}
      .fo-qs{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.66rem;font-weight:600;line-height:1.1;opacity:.8;font-variant-numeric:tabular-nums;}
      .fo-qa.fo-qa-an{background:color-mix(in srgb,var(--c-sleep) 24%,var(--b-bg));color:var(--b-text) !important;
        box-shadow:inset 0 0 0 3px var(--c-sleep),0 0 22px color-mix(in srgb,var(--c-sleep) 45%,transparent);}
      .fo-qa-an .fo-qs{color:var(--c-sleep);opacity:1;font-weight:700;}
      @container fo-card (max-width: 360px){ .fo-qa{font-size:.68rem;} }

      /* „Nächste Mahlzeit“ */
      .fo-next{border-radius:var(--fp-radius, 16px);padding:16px 18px;background:var(--b-card);border:1.5px solid var(--b-acc);box-shadow:0 8px 24px var(--b-shadow);}
      .fo-nl{display:flex;align-items:center;gap:8px;font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--b-acc);}
      .fo-nb{font-size:2rem;font-weight:800;letter-spacing:-.01em;line-height:1.15;margin-top:4px;font-variant-numeric:tabular-nums;}
      .fo-next-due .fo-nb{color:var(--b-alert);}
      .fo-ns{font-size:.92rem;color:var(--b-mut);margin-top:4px;}
      .fo-nf{font-size:.88rem;color:var(--b-faint);margin-top:6px;}
      .fo-nbtn{margin-top:12px;border:none;border-radius:var(--fp-radius-sm, 12px);padding:10px 16px;background:var(--b-acc2);color:var(--b-acc) !important;font-weight:800;cursor:pointer;}
      .fo-puls{width:9px;height:9px;border-radius:50%;background:var(--c-nurse);animation:fo-puls 1.4s ease-in-out infinite;}
      @keyframes fo-puls{50%{transform:scale(1.7);opacity:.35;}}

      /* Jetzt */
      .fo-sec{font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--b-faint);margin:18px 2px 8px;}
      .fo-sech{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .fo-plus{flex:none;min-height:36px;border:none;border-radius:999px;padding:8px 14px;background:var(--b-acc2);color:var(--b-acc) !important;font-size:.82rem;font-weight:800;letter-spacing:0;text-transform:none;cursor:pointer;}
      /* Behälter für „Jetzt“, „Tag“, die Einträge und alles in „Muster“ und „Wachstum“: Rand statt beiger Fläche, getrennt durch Linien */
      .fo-box{box-sizing:border-box;min-width:0;background:var(--b-bg);border:1px solid var(--b-line);border-radius:var(--fp-radius, 16px);padding:2px 12px;}
      /* Jetzt als Liste: runder Kreis in der Tätigkeitsfarbe mit Symbol, Wert groß, „Tätigkeit · Detail“ klein, rechts Ausblick oder „Fällig“ */
      .fo-nr{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--b-line);min-width:0;}
      .fo-nr:first-child{border-top:none;}
      .fo-nr[data-view],.fo-nr[data-proto],.fo-next[data-proto]{cursor:pointer;}
      .fo-nrk{flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.05rem;line-height:1;background:color-mix(in srgb,var(--nr) 22%,var(--b-bg));}
      .fo-nrm{flex:1;min-width:0;display:flex;flex-direction:column;}
      .fo-nrm b{font-size:1rem;font-weight:900;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .fo-nrm small{font-size:.76rem;line-height:1.3;color:var(--b-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .fo-nrr{flex:none;display:flex;flex-direction:column;align-items:flex-end;text-align:right;font-size:.74rem;font-weight:700;line-height:1.25;color:var(--b-mut);font-variant-numeric:tabular-nums;}
      .fo-nr-due{color:var(--b-alert);font-weight:900;}
      /* Kennzahlen in Wachstum: dieselben Zeilen (.fo-nr/.fo-nrm), nur ohne Symbolkreis */
      .fo-kenn{margin-top:14px;}

      /* Tag: Streifen mit Stunden und darunter die Zahlen als Textzeile (Abstand per gap, keine Trennzeichen) */
      .fo-tag{padding:11px 12px;}
      .fo-tag .fo-strip-l{margin-top:0;}
      .fo-zahlen{display:flex;flex-wrap:wrap;gap:3px 14px;margin-top:8px;font-size:.8rem;line-height:1.35;color:var(--b-mut);}
      .fo-zahlen span{white-space:nowrap;}
      .fo-zahlen b{font-weight:800;color:var(--b-text);font-variant-numeric:tabular-nums;}

      /* Streifen */
      .fo-strip{position:relative;flex:1;min-width:0;}
      .fo-strip-l{margin-top:14px;}
      .fo-track{position:relative;height:16px;border-radius:5px;background:var(--b-track);overflow:hidden;}
      .fo-strip-l .fo-track{height:36px;border-radius:8px;}
      .fo-b{position:absolute;top:0;bottom:0;border-radius:2px;}
      .fo-w{position:absolute;top:0;bottom:0;width:3px;margin-left:-1.5px;border-radius:2px;}
      .fo-jetzt{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--b-acc);}
      .fo-ticks{position:relative;height:16px;font-size:.68rem;color:var(--b-faint);font-variant-numeric:tabular-nums;flex:1;}
      .fo-ticks span{position:absolute;top:2px;transform:translateX(-50%);}
      .fo-ticks span:first-child{transform:none;} .fo-ticks span:last-child{transform:translateX(-100%);}

      /* Einträge (Heute) und Messungen (Wachstum): Zeilen im .fo-box, getrennt durch Linien */
      .fo-li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b-line);font-size:.9rem;}
      .fo-li:last-child{border-bottom:none;}
      .fo-li i{width:9px;height:9px;border-radius:50%;flex:none;}
      .fo-li span{flex:1;min-width:0;font-weight:600;} .fo-li small{color:var(--b-mut);} .fo-li time{color:var(--b-mut);font-variant-numeric:tabular-nums;min-width:42px;text-align:right;}

      /* Wachstum & Momente als zwei Chips */
      .fo-mchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
      .fo-mchip{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-width:0;box-sizing:border-box;border:none;border-radius:999px;padding:5px 11px;background:var(--b-card);
        font-size:.78rem;font-weight:700;text-align:left;cursor:pointer;}
      .fo-mchip:active{transform:scale(.97);}
      .fo-mchip-t{display:flex;min-width:0;white-space:nowrap;}
      .fo-mchip-cut{max-width:26ch;overflow:hidden;text-overflow:ellipsis;}
      .fo-mchip-d{margin-left:.35em;}

      /* Muster */
      .fo-mtitle{display:flex;flex-direction:column;margin:16px 2px 12px;}
      .fo-mtitle b{font-size:1.5rem;font-weight:800;} .fo-mtitle span{color:var(--b-mut);font-size:.9rem;}
      .fo-bericht{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin:-4px 2px 14px;}
      .fo-bericht button{border:none;border-radius:999px;padding:8px 14px;background:var(--b-acc2);color:var(--b-acc) !important;font-size:.86rem;font-weight:800;cursor:pointer;}
      .fo-bericht span{font-size:.8rem;color:var(--b-mut);}
      .fo-mctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin-bottom:16px;}
      .fo-seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--b-card);}
      .fo-seg button{border:none;background:transparent;border-radius:999px;padding:6px 14px;font-weight:700;font-size:.86rem;color:var(--b-mut) !important;cursor:pointer;}
      .fo-seg button.fo-on{background:var(--b-acc2);color:var(--b-acc) !important;}
      .fo-chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;max-width:100%;padding-bottom:2px;} .fo-chips::-webkit-scrollbar{display:none;}
      .fo-chips button{flex:none;display:flex;align-items:center;gap:7px;border:none;border-radius:999px;padding:8px 14px;background:var(--b-card);font-weight:700;font-size:.88rem;cursor:pointer;}
      .fo-chips i{width:9px;height:9px;border-radius:50%;background:var(--chip);}
      .fo-chips button.fo-on{background:var(--chip);color:var(--b-on) !important;} .fo-chips button.fo-on i{background:var(--b-on);opacity:.35;}
      /* Zusammenfassung mit Tagesschnitt: ein .fo-box; unter einer Linie der Schnitt, bei Zwillingen am unteren Rand auf einer Linie */
      .fo-mcard{display:flex;flex-direction:column;padding:12px 14px;}
      .fo-mh{font-size:1.2rem;font-weight:800;}
      .fo-mt{font-size:.92rem;color:var(--b-mut);line-height:1.45;margin:6px 0 10px;}
      .fo-avgz{margin-top:auto;padding:9px 0 2px;border-top:1px solid var(--b-line);}
      .fo-avg{font-size:.95rem;} .fo-avg span{color:var(--b-mut);}
      .fo-hint{font-size:.8rem;color:var(--b-mut);margin-top:3px;opacity:.9;}
      /* Tage: eine Zeile je Tag (Tag, Streifen, Summe), getrennt durch Linien; die Stundenmarken oben sind die Kopfzeile ohne Linie */
      .fo-rows{margin-top:14px;}
      .fo-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--b-line);}
      .fo-row:first-child,.fo-row-ticks + .fo-row{border-top:none;}
      .fo-rl{flex:0 0 48px;font-size:.84rem;font-weight:700;color:var(--b-mut);font-variant-numeric:tabular-nums;}
      .fo-rt{flex:0 0 58px;text-align:right;font-size:.84rem;font-weight:700;font-variant-numeric:tabular-nums;}
      .fo-row .fo-track{height:22px;}
      .fo-row-ticks{padding:8px 0 0;}
      .fo-row-ticks .fo-ticks{height:14px;}
      /* Bemerkt (Muster und Wachstum): Zeilen im .fo-box mit Linien */
      .fo-ins > div{padding:9px 0;border-top:1px solid var(--b-line);font-size:.88rem;line-height:1.35;}
      .fo-ins > div:first-child{border-top:none;}
      .fo-ins span{color:var(--b-mut);}

      /* Eingebettete Karten (Momente, Protokoll) ohne eigenen Kartenrahmen; ihre Farben kommen wie die der Übersicht aus dem Theme */
      .fo-emb{--ha-card-box-shadow:none;--ha-card-border-width:0;}
      .fo-emb ha-card{background:transparent !important;box-shadow:none !important;border:none !important;}
      .fo-ms-host .fm-card{padding:0 0 8px;}
      .fo-ms-host .fm-title:empty{display:none;}
      /* Am Handy wählt der Schalter im Kopf das Kind, der eigene der Meilensteinkarte wäre doppelt. Am Tablet bleibt er. */
      @container fo-card (max-width: 679px){ .fo-card.fo-multi .fo-ms-host .fm-kids{display:none;} }
      .fo-emb .ff-card,.fo-emb .fd-card{padding:0 0 8px;}
      .fo-pgrid .fo-blk:not(:empty) + .fo-blk:not(:empty){margin-top:14px;}

      /* Wachstum: Kurve in der Kinderfarbe */
      .fo-gcard{padding:12px 8px 10px;--kl:var(--k);}   /* Kasten kommt von .fo-box */
      .fo-card.fo-dark .fo-gcard{--kl:color-mix(in srgb,var(--k) 55%,var(--b-text));}   /* im Dunkeln aufgehellt */
      .fo-gchart{height:230px;}
      .fo-gchart svg{display:block;overflow:visible;}
      .fo-ggrid{stroke:var(--b-line);stroke-width:1;}
      .fo-gy{font-size:11px;fill:var(--b-faint);text-anchor:end;font-variant-numeric:tabular-nums;}
      .fo-gunit{font-weight:800;}
      .fo-gx{font-size:11px;fill:var(--b-faint);text-anchor:middle;}
      .fo-gb1{fill:var(--kl);opacity:.1;} .fo-gb2{fill:var(--kl);opacity:.14;}
      .fo-gmid{fill:none;stroke:var(--kl);stroke-width:1.2;stroke-dasharray:4 4;opacity:.6;}
      .fo-gp{font-size:10px;fill:var(--b-mut);}
      .fo-gheute{stroke:var(--b-acc);stroke-width:1.5;}
      .fo-gheutel{font-size:10.5px;font-weight:800;fill:var(--b-acc);text-anchor:middle;}
      .fo-gline{fill:none;stroke:var(--kl);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round;}
      .fo-gdot{fill:var(--kl);stroke:var(--b-bg);stroke-width:2;}
      .fo-ghalo{fill:var(--kl);opacity:.25;}
      .fo-gpt{cursor:pointer;}
      .fo-gleg{display:flex;flex-wrap:wrap;gap:6px 16px;padding:4px 10px 0;font-size:.76rem;color:var(--b-mut);}
      .fo-gleg span{display:flex;align-items:center;gap:6px;}
      .fo-gleg i{display:inline-block;width:16px;}
      .fo-gl-line{height:3px;border-radius:2px;background:var(--kl);}
      .fo-gl-band{height:10px;border-radius:3px;background:var(--kl);opacity:.3;}
      .fo-gl-mid{border-top:1.5px dashed var(--kl);opacity:.8;}
      .fo-wli{width:100%;border:none;border-bottom:1px solid var(--b-line);background:transparent;text-align:left;cursor:pointer;}
      .fo-wli em{font-style:normal;font-size:.72rem;font-weight:800;color:var(--b-acc);margin-left:8px;}
      .fo-more{display:block;margin:8px auto 0;border:none;background:transparent;color:var(--b-acc) !important;font-weight:700;font-size:.86rem;cursor:pointer;}
      .fo-quelle{font-size:.72rem;line-height:1.45;color:var(--b-faint);margin-top:12px;}

      /* Leiste unten: der Behälter klebt am unteren Rand, darin am Handy die Aktionsleiste über der Ansichtsleiste.
         Er selbst nimmt keine Tipps an, damit er den Inhalt daneben nicht verdeckt. */
      .fo-dock{position:sticky;bottom:12px;z-index:4;display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:22px;pointer-events:none;}
      .fo-dock > *{pointer-events:auto;}
      .fo-act{display:none;}
      @container fo-card (max-width: 679px){
        .fo-act{display:flex;align-self:stretch;gap:8px;box-sizing:border-box;padding:8px;border-radius:var(--fp-radius, 16px);
          background:var(--b-bar);box-shadow:0 10px 30px var(--b-shadow);border:1px solid var(--b-line);}
        .fo-act:empty{display:none;}
        /* Fünf Knöpfe (mit „Beide“): Abstand und Rand enger. Jeder Knopf bleibt mindestens so breit wie sein längster Text
           (Fläschchen, „wach 1:23 h“), die übrige Breite teilen sich alle gleich — so wird nichts abgeschnitten, ohne die Schrift
           zu verkleinern. Bei 359 px Kartenbreite bleiben knapp 60 px je Knopf, bei 320 px reicht es gerade noch. */
        .fo-act:has(> :nth-child(5)){gap:5px;padding:6px;}
        .fo-act:has(> :nth-child(5)) .fo-qa{min-width:max-content;}
      }
      /* ab etwa 320-px-Handys reicht selbst das nicht: bei fünf Knöpfen die Schrift eine Stufe kleiner */
      @container fo-card (max-width: 300px){ .fo-act:has(> :nth-child(5)) .fo-qa{font-size:.62rem;} .fo-act:has(> :nth-child(5)) .fo-qs{font-size:.6rem;} }
      .fo-tabbar{display:flex;gap:4px;width:max-content;max-width:100%;padding:6px;border-radius:999px;
        background:var(--b-bar);box-shadow:0 10px 30px var(--b-shadow);border:1px solid var(--b-line);}
      .fo-tabbar:empty{display:none;}
      .fo-tabbar button{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:68px;border:none;border-radius:999px;padding:7px 12px;background:transparent;color:var(--b-mut) !important;font-size:.72rem;font-weight:700;cursor:pointer;}
      .fo-tabbar button.fo-on{background:var(--b-card2);color:var(--b-acc) !important;}
      .fo-tabbar svg{width:22px;height:22px;fill:currentColor;}

      /* kids_dock (Handy, mehrere Kinder): eine volle Pillenleiste statt Aktionsleiste (und, mit swipe_views, Ansichtsleiste).
         68 px hoch (1 px Rand + 7 px Polster + 52 px Pillen); links bleibt dock_gap px frei (--fo-dg), dort sitzt der schwebende Assistent. */
      .fo-kdock{display:none;}
      /* Platz für den schwebenden Assistenten (dock_gap > 0): unsichtbar, Pip hängt seine Figur als Kind hinein (läuft so mit der klebenden Leiste mit); sie darf mit Blatt,
         Ringen und Schatten über die Leiste hinausragen (overflow: visible), nur die Figur selbst nimmt Berührungen an; --fo-dgx = was dock_gap über 67 px (7 Polster + 52 + 8 Lücke) hinausgeht */
      .fo-pipslot{flex:none;display:flex;position:relative;overflow:visible;align-self:center;width:52px;height:52px;border-radius:50%;margin-right:var(--fo-dgx,0px);pointer-events:none;}
      .fo-kpill{flex:1 1 0;min-width:0;height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;
        border:1.5px solid var(--k);border-radius:999px;background:var(--b-bg);color:var(--b-text) !important;font-weight:800;font-size:.95rem;cursor:pointer;}
      .fo-kpill:active{transform:scale(.97);}
      .fo-kpill[aria-expanded="true"]{background:var(--k2);}
      .fo-kpn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      /* Mond ganz rechts: Rand in der Schlaf-Farbe; einige schlafen = getönt, alle = gefüllt */
      .fo-mond{width:24px;height:24px;flex:none;fill:none;stroke:var(--c-sleep);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
      .fo-kmoon{flex:none;width:52px;height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:0;
        border:1.5px solid var(--c-sleep);border-radius:50%;background:var(--b-bg);cursor:pointer;}
      .fo-kmoon:active{transform:scale(.95);}
      .fo-kmoon.fo-kmoon-teil{background:color-mix(in srgb,var(--c-sleep) 24%,var(--b-bg));}
      .fo-kmoon.fo-kmoon-alle{background:var(--c-sleep);}
      .fo-kmoon.fo-kmoon-alle .fo-mond{stroke:var(--b-on);}
      /* swipe_views (Handy): Namenszeile im Kopf, Randflächen am Inhalt, Gleiten beim Wischen */
      .fo-pager,.fo-edge{display:none;}
      .fo-pg{flex:none;margin:0;padding:6px 2px 4px;border:none;border-bottom:3px solid transparent;border-radius:0;background:none;color:var(--b-faint) !important;
        font-size:.8125rem;font-weight:700;line-height:1.2;cursor:pointer;}
      .fo-pg.fo-pg-nb{color:var(--b-mut) !important;}
      .fo-pg.fo-pg-cur{color:var(--b-text) !important;font-size:.9375rem;font-weight:800;border-bottom-color:var(--b-acc);}
      .fo-pg:focus-visible{outline:2px solid var(--b-acc);outline-offset:1px;border-radius:4px;}
      .fo-bw{position:relative;}
      .fo-edge[hidden]{display:none !important;}
      @keyframes fo-gl-n{from{transform:translateX(16px);opacity:.25;}}
      @keyframes fo-gl-v{from{transform:translateX(-16px);opacity:.25;}}
      .fo-body.fo-gl-n{animation:fo-gl-n .22s ease-out;}
      .fo-body.fo-gl-v{animation:fo-gl-v .22s ease-out;}
      @media (prefers-reduced-motion: reduce){ .fo-body.fo-gl-n,.fo-body.fo-gl-v{animation:none !important;} }
      @container fo-card (max-width: 679px){
        .fo-card.fo-kd .fo-act{display:none;}
        .fo-card.fo-kd .fo-kdock{display:flex;align-self:stretch;gap:8px;box-sizing:border-box;height:68px;padding:7px;
          border-radius:999px;background:var(--b-bar);box-shadow:0 10px 30px var(--b-shadow);border:1px solid var(--b-line);}
        .fo-card.fo-sw .fo-tabbar{display:none;}
        .fo-card.fo-noact .fo-dock{display:none;}
        .fo-card.fo-sw .fo-top{flex-wrap:wrap;row-gap:2px;}
        .fo-card.fo-sw .fo-pager{display:flex;flex:0 0 100%;box-sizing:border-box;position:relative;align-items:baseline;gap:20px;padding:0 20px;overflow-x:auto;scrollbar-width:none;
          -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);mask-image:linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);}
        .fo-card.fo-sw .fo-pager::-webkit-scrollbar{display:none;}
        .fo-card.fo-sw .fo-pg:first-child{margin-left:auto;}
        .fo-card.fo-sw .fo-pg:last-child{margin-right:auto;}
        /* Randfläche: unsichtbare Spalte über die ganze Höhe, darin eine kurze Lasche (6 × 56 px), die beim Scrollen auf Bildschirmmitte bleibt */
        .fo-card.fo-sw .fo-edge{display:block;position:absolute;top:0;bottom:0;width:6px;pointer-events:none;z-index:2;}
        .fo-card.fo-sw .fo-edge > b{display:block;position:sticky;top:calc(50vh - 28px);width:6px;height:56px;border-radius:6px;background:var(--b-card2);opacity:.9;}
        .fo-card.fo-sw .fo-edge-l{left:-12px;}
        .fo-card.fo-sw .fo-edge-r{right:-12px;}
      }

      /* Blätter */
      .fo-ov{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;animation:fo-fade .2s;}
      @keyframes fo-fade{from{opacity:0;}}
      .fo-sheet{width:100%;max-width:560px;max-height:88vh;overflow:auto;box-sizing:border-box;background:var(--b-bg);color:var(--b-text);
        border-radius:var(--fp-radius, 16px) var(--fp-radius, 16px) 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px var(--b-shadow);animation:fo-up .3s cubic-bezier(.2,.9,.3,1);}
      @media (min-width: 700px){ .fo-ov{align-items:center;} .fo-sheet{border-radius:var(--fp-radius, 16px);} }
      @keyframes fo-up{from{transform:translateY(40px);opacity:0;}}
      .fo-sh-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
      .fo-sh-head b{flex:1;font-size:1.15rem;font-weight:800;display:flex;align-items:center;gap:8px;}
      .fo-sh-ai svg{color:var(--accent-color, var(--b-acc));}
      .fo-x{border:none;background:var(--b-card);width:34px;height:34px;border-radius:50%;cursor:pointer;flex:none;}
      .fo-neu{border:none;background:transparent;color:var(--b-mut) !important;font-size:.8rem;font-weight:700;cursor:pointer;}
      .fo-sh-sub{font-size:.8rem;color:var(--b-mut);margin:-6px 0 12px;}
      /* Blatt der Kinder-Leiste: Schlafen und Stillen als volle Knöpfe, aktiv gefüllt in der Farbe der Tätigkeit */
      .fo-kn-liste{display:flex;flex-direction:column;gap:10px;}
      .fo-kn{display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;min-height:58px;border:none;border-radius:var(--fp-radius-sm, 12px);padding:12px 16px;text-align:left;cursor:pointer;
        background:color-mix(in srgb,var(--q) 22%,var(--b-card));color:var(--b-text) !important;}
      .fo-kn:active{transform:scale(.98);}
      .fo-kn.fo-kn-an{background:var(--q);color:var(--b-on) !important;box-shadow:0 4px 16px color-mix(in srgb,var(--q) 40%,transparent);}
      .fo-kne{font-size:1.9rem;line-height:1;flex:none;}
      .fo-knx{display:flex;flex-direction:column;min-width:0;}
      .fo-knt{font-weight:800;font-size:1.08rem;line-height:1.2;font-variant-numeric:tabular-nums;}
      .fo-kns{font-size:.84rem;opacity:.85;margin-top:2px;font-variant-numeric:tabular-nums;}
      /* Schlaf-Blatt für alle (Mond): eine Zeile je Kind mit Schalter-Symbol, darunter der große Knopf für alle */
      .fo-ks-liste{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;}
      .fo-ks{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:54px;border:1.5px solid transparent;border-radius:var(--fp-radius-sm, 12px);padding:9px 14px;text-align:left;cursor:pointer;
        background:var(--b-card);color:var(--b-text) !important;}
      .fo-ks:active{transform:scale(.98);}
      .fo-ks.fo-ks-an{background:color-mix(in srgb,var(--c-sleep) 24%,var(--b-bg));border-color:var(--c-sleep);}
      .fo-ksx{display:flex;flex-direction:column;min-width:0;flex:1;}
      .fo-ksn{font-weight:800;font-size:1.05rem;line-height:1.2;}
      .fo-kss{font-size:.84rem;color:var(--b-mut);margin-top:2px;font-variant-numeric:tabular-nums;}
      .fo-ksw{position:relative;flex:none;width:46px;height:28px;border-radius:999px;background:var(--b-line);}
      .fo-ksw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--b-bg);transition:left .15s;}
      .fo-ks.fo-ks-an .fo-ksw{background:var(--c-sleep);}
      .fo-ks.fo-ks-an .fo-ksw::after{left:21px;}
      .fo-kalle{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;min-height:58px;border:1.5px solid var(--c-sleep);border-radius:var(--fp-radius-sm, 12px);padding:12px 16px;
        background:var(--c-sleep);color:var(--b-on) !important;font-weight:800;font-size:1.05rem;cursor:pointer;}
      .fo-kalle .fo-mond{stroke:var(--b-on);}
      .fo-kalle:active{transform:scale(.98);}
      .fo-kalle.fo-kalle-aus{background:var(--b-bg);color:var(--b-text) !important;}
      .fo-kalle.fo-kalle-aus .fo-mond{stroke:var(--c-sleep);}
      .fo-big3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      .fo-big3 button{display:flex;flex-direction:column;align-items:center;gap:6px;border:none;border-radius:var(--fp-radius-sm, 12px);padding:16px 6px;background:color-mix(in srgb,var(--q) 22%,var(--b-card));font-weight:800;cursor:pointer;}
      .fo-big3 span{font-size:1.8rem;}
      .fo-big3 button.fo-on{box-shadow:inset 0 0 0 3px var(--q);}
      .fo-big2{grid-template-columns:repeat(2,1fr);}
      .fo-wahl{display:flex;gap:8px;}
      .fo-wahl button{flex:1 1 0;border:none;border-radius:var(--fp-radius-sm, 12px);padding:11px 14px;background:var(--b-card);font-weight:700;cursor:pointer;}
      .fo-wahl button.fo-on{background:var(--b-acc);color:var(--fp-accent-fg, #fff) !important;}
      .fo-er{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--b-line);}
      .fo-er:last-child{border-bottom:none;}
      .fo-er>span{flex:1;min-width:0;font-weight:700;}
      .fo-er-v{min-width:70px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;}
      .fo-er button{flex:none;width:44px;height:44px;border:none;border-radius:50%;background:var(--b-card);font-size:1.4rem;font-weight:800;line-height:1;cursor:pointer;}
      .fo-er button:disabled{opacity:.3;cursor:default;}
      .fo-lbl{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--b-faint);margin:14px 0 8px;}
      .fo-mls{display:flex;flex-wrap:wrap;gap:8px;}
      .fo-mls button{border:none;border-radius:var(--fp-radius-sm, 12px);padding:10px 14px;background:var(--b-card);font-weight:700;cursor:pointer;}
      .fo-mls button.fo-on{background:var(--c-bottle);color:var(--b-on) !important;}
      .fo-mls .fo-in{width:90px;}
      .fo-in{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid var(--b-line);border-radius:var(--fp-radius-sm, 12px);background:var(--b-card);color:var(--b-text);font:inherit;font-size:1rem;}
      .fo-in[type=time],.fo-in[type=date]{-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;display:block;text-align:left;color-scheme:light;}
      .fo-in::-webkit-date-and-time-value{text-align:left;}   /* iPhone: Datum und Uhrzeit sonst breiter als das Blatt */
      .fo-card.fo-dark .fo-in[type=time],.fo-card.fo-dark .fo-in[type=date]{color-scheme:dark;}
      .fo-sh-hint{font-size:.78rem;color:var(--b-mut);margin-top:6px;}
      .fo-ok{display:block;width:100%;margin-top:18px;border:none;border-radius:var(--fp-radius-sm, 12px);padding:13px;background:var(--b-acc);color:var(--fp-accent-fg, #fff) !important;font-weight:800;font-size:1rem;cursor:pointer;}
      .fo-del{display:block;width:100%;margin-top:6px;border:none;background:transparent;padding:11px;color:var(--b-mut) !important;font-weight:700;cursor:pointer;}

      /* Frag nach */
      .fo-chat{display:flex;flex-direction:column;height:min(640px,82vh);}
      .fo-msgs{flex:1;display:flex;flex-direction:column;gap:8px;overflow-y:auto;margin-bottom:10px;min-height:0;}
      .fo-msgs[hidden]{display:none;}
      .fo-chat .fo-sugg{margin-top:auto;}
      .fo-msg{max-width:88%;border-radius:var(--fp-radius, 16px);padding:10px 14px;font-size:.93rem;line-height:1.45;overflow-wrap:anywhere;}
      .fo-msg p{margin:0 0 6px;} .fo-msg p:last-child{margin-bottom:0;} .fo-msg ul{margin:4px 0;padding-left:20px;} .fo-msg li{margin:2px 0;}
      .fo-me{align-self:flex-end;background:var(--b-acc);color:var(--fp-accent-fg, #fff);border-bottom-right-radius:6px;}
      .fo-ai{align-self:flex-start;background:var(--b-card);border-bottom-left-radius:6px;}
      .fo-tipp{display:flex;gap:5px;padding:14px 16px;}
      .fo-tipp i{width:8px;height:8px;border-radius:50%;background:var(--b-mut);opacity:.4;animation:fo-tipp 1.2s infinite;}
      .fo-tipp i:nth-child(2){animation-delay:.2s;} .fo-tipp i:nth-child(3){animation-delay:.4s;}
      @keyframes fo-tipp{30%{opacity:1;transform:translateY(-3px);}}
      .fo-sugg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
      .fo-sugg[hidden]{display:none;}
      .fo-sugg button{border:1px solid var(--b-line);border-radius:999px;padding:8px 13px;background:var(--b-card);font-size:.86rem;font-weight:600;cursor:pointer;text-align:left;}
      .fo-ask{display:flex;gap:8px;}
      .fo-ask .fo-in{flex:1;min-width:0;}
      .fo-send{flex:none;width:48px;border:none;border-radius:var(--fp-radius-sm, 12px);background:var(--b-acc);color:var(--fp-accent-fg, #fff) !important;font-size:1.1rem;cursor:pointer;}
      @media (prefers-reduced-motion: reduce){ .fo-puls,.fo-tipp i,.fo-sheet,.fo-ov{animation:none !important;} }
    </style>`;
  }
  getCardSize() { return this._bar ? 1 : 12; }
}
if (!customElements.get("fp-baby-overview-card")) {
  customElements.define("fp-baby-overview-card", FpBabyOverviewCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-baby-overview-card", name: "FP Baby Overview Card", description: "Übersicht je Kind im Stil von Buma: nächste Mahlzeit, Jetzt-Liste, Tagesstreifen, Muster und KI-Chat „Frag nach“; mit layout: bar eine schmale Leiste für die Startseite" });
}
})();

/* ===== fp-assistant-card v19 (Klingeln per Stimme abstellen: solange es klingelt (Timer, Wecker, Erinnerung), bleibt das Weckwort-Mikrofon auch mit mic_pause offen, auch während der Ansage; das Aktivierungswort stellt das Klingeln sofort ab (auf allen Geräten, wie der Stopp-Knopf) und Pip hört danach wie gewohnt zu; davor: Rückfragen: das Weckwort-Mikrofon geht bei mic_pause kurz vor dem Ende des Vorlesens wieder auf (PRE_OPEN_MS), Pip hört nach dem Vorlesen sofort zu statt erst nach knapp 3 Sekunden; sobald nach einer Rückfrage zugehört wird, spielt ein kurzer Ton, ab dem man sprechen kann (er geht nicht an Home Assistant); davor: Handy: baut Home Assistant die Karten neu auf (Herunterziehen zum Aktualisieren) und ist der Platz in der Kinder-Leiste kurz weg, bleibt die feste Figur bis zu 1 Sekunde unsichtbar und wartet auf den neuen Platz, statt kurz in der Ecke aufzutauchen und zurückzuspringen, auch wenn dabei die unsichtbare Karte neu angelegt wird und das Dock kurz aus- und wieder eingeblendet wird (setVisible); bei Seitenwechsel, ab 700 px Breite oder wenn der Platz nicht wiederkommt steht sie wie bisher sofort bzw. nach der Wartezeit in der Ecke; davor: Handy: die Figur steckt als echte Kopie (fp-pip-dock-slotfig) im Platz der Kinder-Leiste und läuft deshalb mit der klebenden Leiste mit, auch beim Ausrollen und Nachfedern am iPhone, wo kein scroll-Ereignis kommt; die feste Figur ist dann unsichtbar und steht beim Verschwinden des Platzes sofort wieder in der Ecke; Pillen und Anker folgen weiter dem Platz; davor: setzt sich auf der Seite selbst in den Platz der Kinder-Leiste der Baby-Karte (window.__fpPipSlots, dock_gap), ohne lift; im Dunkelmodus kräftiger: Theme-Variable --fp-pip, Aufhellung mit der Schriftfarbe statt mit dem dunklen Hintergrund, dunkle Augen; davor: Fehlauslöser aufzeichnen über wake_clip: bei jeder Reaktion des Weckwort-Modells (Schwelle erreicht) gehen die letzten 3 Sekunden Mikrofon-Ton plus 1 Sekunde danach als WAV an ein Skript, mit Art, Höchstwert, Blöcken, Folge und Gerät, gedrosselt; davor: Bühne auch beim Tipp auf die Figur, Ende 5 s nach der Antwort oder nach 30 s ohne Eingabe, Berührung hält 30 s, begonnener Text hält bis zum Löschen; davor: Bühne (stage): beim Aktivierungswort wird das Dashboard abgedunkelt, die Figur rollt groß in die Mitte und das Gespräch steht darunter, Ende kurz nach der Antwort; davor: Protokoll der Aktivierungswort-Werte über wake_log: Erkennungen mit dem danach verstandenen Text, knappe Werte unter der Schwelle; davor: Bildschirmschoner weg bei Aktivierungswort (wake_screen), bleibt bis zum Ende des Gesprächs weg; davor: Mikrofon zu, solange Pip spricht oder es klingelt (mic_pause), kein Ton nach Aufnahme-Ende an HA, keine Ereignis-Abos für Nicht-Admins; davor: früheres Vorlesen nur noch mit early_tts: true, Vorgabe aus, weil es am iPad rauschte; davor: lernt mit: protokolliert Bitten, die an den Gesprächsagenten gingen, über learn; davor: liest früher vor: spielt die Sprachausgabe schon während des Erzeugens, wenn Home Assistant sie streamt; davor: Timer, Wecker und Erinnerungen: Pillen mit Countdown neben der Figur, Klingeln mit Ansage und Stopp (alarms); davor: kein Knacken am iPad bei offenem Mikrofon: Audio mit der Rate des Geräts, Aufnahme nicht mehr am Lautsprecher-Ausgang; davor: Aktivierungswort auch auf iOS 17: onnxruntime-web 1.18 ohne geteilten Speicher, Fehlerursache am Schalter; davor: position: left, Aktivierungswort im Browser (wake_word, openWakeWord über onnxruntime-web); davor: Pip: Sprachassistent mit Figur, Gespräch, Mikrofon, Vorlesen, Karten mit Rückgängig und Bestätigen; hebt sich über Aktionsleisten) ===== */
(() => {
const U = window.__fpUtils;
// Die Karte selbst bleibt unsichtbar. Sie legt ihre Konfiguration im Browser ab und sorgt dafür,
// dass genau eine schwebende Figur ("Dock") an document.body hängt. Das Dock lebt weiter, wenn man
// zwischen den Tabs wechselt, und startet beim Laden des Moduls von selbst, sobald für den
// aktuellen Dashboard-Pfad eine Konfiguration gespeichert ist.
// Auf dem Beta-Dashboard sind Prod- und Beta-Datei gleichzeitig geladen: Element-Name und
// Speicher-Schlüssel tragen deshalb den Namen "fp-pip-dock" (in der Beta mit Endung), mehr teilen sich beide nicht.
const TAG = "fp-pip-dock";
const STORE = "fp-pip-dock:";
// Schalter "Aktivierungswort" je Gerät (Beta: fp-pip-wake-beta:), Vorgabe aus.
const WAKE_STORE = TAG.replace("-dock", "-wake") + ":";
// Schalter "An diesem Gerät klingeln" je Gerät (Beta: fp-pip-ring-beta:), Vorgabe an; "0" = aus.
const RING_STORE = TAG.replace("-dock", "-ring") + ":";
// Zuletzt hier behandeltes Klingel-Signal (Beta: fp-pip-ringseen-beta:): { key, st } mit st = on (klingelt) | rang (ausgeklungen) | stop (abgestellt).
const SEEN_STORE = TAG.replace("-dock", "-ringseen") + ":";
const EVT = "fp_pip_karte";
const SUGG = [
  { icon: "📅", text: "Was steht heute an?" },
  { icon: "🍽", text: "Was gibt's heute zum Abendessen?" },
  { icon: "🍼", text: "Wann haben die Zwillinge zuletzt getrunken?" },
  { icon: "🛒", text: "Was steht auf der Einkaufsliste?" },
  { icon: "☂️", text: "Brauchen wir morgen einen Schirm?" },
  { icon: "🔒", text: "Ist die Wohnungstür zugesperrt?" },
];
const THEME_VARS = ["--fp-accent", "--fp-accent-fg", "--fp-surface", "--fp-surface-2", "--fp-radius", "--fp-radius-sm",
  "--primary-color", "--text-primary-color", "--card-background-color", "--primary-text-color", "--secondary-text-color",
  "--divider-color", "--secondary-background-color", "--primary-font-family", "--fp-pip"];
const STATUS = { idle: "Bereit", listen: "Hört zu …", think: "Denkt nach …", speak: "Spricht" };
const ERR = {
  conn: "Ich habe gerade keine Verbindung zu Home Assistant.",
  timeout: "Das hat zu lange gedauert. Versuch es bitte noch einmal.",
  pipeline: "Die Assist-Pipeline wurde nicht gefunden. Bitte die Einstellung prüfen.",
  "pipeline-not-found": "Die Assist-Pipeline wurde nicht gefunden. Bitte die Einstellung prüfen.",
  "stt-no-text-recognized": "Ich habe dich nicht verstanden. Versuch es bitte noch einmal.",
  "stt-stream-failed": "Die Spracherkennung hat gerade nicht geklappt.",
  "stt-provider-missing": "In der Pipeline ist keine Spracherkennung eingerichtet. Du kannst mir schreiben.",
  "intent-failed": "Dabei konnte ich gerade nicht helfen.",
  generic: "Das hat leider nicht geklappt.",
};
const ICON = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/></svg>',
};
const GO_LABEL = { mic: "Sprechen", send: "Senden", stop: "Aufnahme beenden" };
// Hinweise am Schalter "Aktivierungswort" bei einem Fehler
const WAKE_ERR = {
  model: "Das Modell für das Aktivierungswort konnte nicht geladen werden.",
  ort: "Die Erkennung konnte nicht geladen werden (Internet?).",
  perm: "Das Mikrofon ist nicht erlaubt.",
  mic: "Das Mikrofon ist nicht verfügbar.",
  run: "Die Erkennung ist ausgefallen.",
};
// Eigentliche Ursache zum Fehler ("CompileError: WebAssembly.Module doesn't parse …"), auf etwa 90 Zeichen gekürzt; ein schlichtes "Error: " entfällt
const wkDetail = e => {
  if (!e) return "";
  const m = e.message != null ? String(e.message) : String(e), n = e.name && e.name !== "Error" ? e.name + ": " : "";
  const t = (n + m).replace(/\s+/g, " ").trim();
  return t.length > 90 ? t.slice(0, 89).trimEnd() + "…" : t;
};
const WAKE_QUIET = 1200;    // so lange nach Antwort und Vorlesen noch taub (Nachhall)
const WAKE_IDLE = 30000;    // per Weckwort geöffnetes Fenster schließt sich so lange nach der Antwort von selbst
const STAGE_LINGER = 5000; // stage: so lange nach dem Ende der Antwort bleibt die Bühne noch stehen
const STAGE_IDLE = 30000;   // stage: so lange bleibt die Bühne stehen, wenn nach dem Tipp auf die Figur nichts passiert; auch eine Berührung oder Eingabe im Fenster hält sie so lange
const STAGE_OUT = 800;     // stage: so lange dauert der Rückweg (Figur rollt zurück, Fenster geht, Fläche blendet aus)
const SLOT_WAIT = 1000;    // Handy: ist der Platz in der Kinder-Leiste weg, die Seite aber dieselbe (Karten werden neu aufgebaut, z. B. beim Herunterziehen zum Aktualisieren), wartet die Figur so lange unsichtbar auf den neuen Platz
const CHIME_MS = 170;       // Länge des Erkennungstons; erst danach geht Ton an Home Assistant
const CHIME_TAIL = 50;      // Ton beim Zuhören nach einer Rückfrage: so lange nach CHIME_MS (Nachhall im Mikrofon) wird noch nichts gesendet
const PRE_OPEN_MS = 1200;   // mic_pause: wird eine Rückfrage vorgelesen, geht das Weckwort-Mikrofon so lange vor dem Ende des Vorlesens wieder auf
const SAY_CPS = 13;         // Zeichen pro Sekunde: Schätzung der Sprechdauer aus der Textlänge, nur zum Planen des Vor-Öffnens (nie zum Abschneiden)
const SCR_GAP = 4000;       // wake_screen: höchstens ein Knopfdruck in so vielen ms
const WAKE_LOG_MIN = 0.5;   // wake_log: ab diesem Wert beginnt eine "knappe" Episode (Wert unter der Schwelle, aber nicht Rauschen)
const WAKE_LOG_WAIT = 20000; // wake_log: so lange darf nach einer Erkennung der Lauf auf sich warten lassen, danach "abbruch"
const WAKE_LOG_GAP = 5000;  // wake_log: höchstens ein Knapp-Eintrag in so vielen ms
const WAKE_LOG_HOUR = 60;   // wake_log: höchstens so viele Knapp-Einträge pro Stunde (gleitend)
const WAKE_LOG_BLK = 1000;  // wake_log: bleibt der Block-Takt (80 ms) so lange aus, ist die Episode zu Ende
const WAKE_CLIP_PRE = 3;    // wake_clip: so viele Sekunden Ton vor der Reaktion des Modells kommen in den Clip
const WAKE_CLIP_POST = 1;   // wake_clip: ... und so viele Sekunden danach
const WAKE_CLIP_GAP = 10;   // wake_clip: höchstens ein Clip in so vielen Sekunden
const WAKE_CLIP_HOUR = 30;  // wake_clip: höchstens so viele Clips pro Stunde (gleitend)
const WAKE_CLIP_HZ = 16000; // wake_clip: Abtastrate des Mikrofontons an der Erkennung
const WAKE_CLIP_SAFE = 5000; // wake_clip: so lange darf ein Clip ohne angenommene Erkennung offen bleiben (Notausstieg), dann geht er mit dem, was da ist
const RING_AGE = 180;       // ein Klingel-Signal ist höchstens so viele Sekunden alt (danach nimmt Home Assistant es selbst zurück)
const RING_GAP = 1500;      // Abstand der Glockenschläge
const ANN_WAIT = 20000;     // so lange darf die Ansage (Assist-Pipeline) auf sich warten lassen
const STRM_WAIT = 15000;    // so lange darf ein früh gestarteter Ton nach tts-end noch auf sich warten lassen, danach wird er verworfen
const PILL_MAX = 3;         // so viele Pillen neben der Figur, der Rest als "+N"
const RING_ICON = { timer: "⏱", wecker: "⏰", erinnerung: "🔔" };
const PIP = '<span class="pip st-idle"><span class="ring r1"></span><span class="ring r2"></span><span class="ball"><span class="eye"></span><span class="eye"></span></span></span>';
// AudioWorklet für die Aufnahme: sammelt je 2048 Werte und reicht sie an die Seite weiter.
const WORKLET = 'class P extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(2048);this.n=0;}'
  + 'process(i){var c=i[0]&&i[0][0];if(c){for(var k=0;k<c.length;k++){this.b[this.n++]=c[k];if(this.n===2048){this.port.postMessage(this.b.slice(0));this.n=0;}}}return true;}}'
  + 'registerProcessor("fp-pip-rec",P);';
// Stilles WAV (ein paar Byte): iOS erlaubt späteres Abspielen erst, wenn das Audio-Element einmal per Tipp gestartet wurde.
const SILENT = (() => {
  try {
    const n = 8, b = new Uint8Array(44 + n * 2), dv = new DataView(b.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
    let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return "data:audio/wav;base64," + btoa(s);
  } catch (e) { return ""; }
})();

const delay = ms => new Promise(r => setTimeout(r, ms));
// wake_clip: WAV (PCM 16 Bit, mono, 16 kHz) aus zwei Int16-Stücken, als Base64. Die Umwandlung läuft stückweise (Vielfache von 3 Byte), damit
// weder btoa noch String.fromCharCode.apply an eine Grenze stoßen.
function clipWav(a, b) {
  const n = a.length + b.length, u = new Uint8Array(44 + n * 2), dv = new DataView(u.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) u[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, WAKE_CLIP_HZ, true); dv.setUint32(28, WAKE_CLIP_HZ * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
  let o = 44;
  for (const p of [a, b]) for (let i = 0; i < p.length; i++, o += 2) dv.setInt16(o, p[i], true);
  let s = "";
  for (let i = 0; i < u.length; i += 6144) s += btoa(String.fromCharCode.apply(null, u.subarray(i, i + 6144)));
  return s;
}
// wake_clip: grobe Gerätekennung ohne Personendaten, z. B. "iPad 1180x820"
function clipDevice() {
  let k = "Sonst";
  try {
    const ua = navigator.userAgent || "", pf = navigator.platform || "";
    if (/iPad/.test(ua) || (/Mac/.test(pf) && navigator.maxTouchPoints > 1)) k = "iPad";
    else if (/iPhone|iPod/.test(ua)) k = "iPhone";
    else if (/Android/.test(ua)) k = "Android";
    else if (/Mac/.test(pf + ua)) k = "Mac";
  } catch (e) {}
  return `${k} ${window.innerWidth}x${window.innerHeight}`;
}
const pathPart = () => { try { return location.pathname.split("/").filter(Boolean)[0] || ""; } catch (e) { return ""; } };
const loadCfg = p => { try { const s = localStorage.getItem(STORE + p); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const saveCfg = (p, c) => { try { const s = JSON.stringify(c); if (localStorage.getItem(STORE + p) !== s) localStorage.setItem(STORE + p, s); } catch (e) {} };

// wake-engine:start (Audio und Aktivierungswort-Erkennung ohne Bezug zur Oberfläche; der Test zieht genau diesen Block heraus)
const toI16 = x => { const s = x > 1 ? 1 : x < -1 ? -1 : x; return s < 0 ? Math.round(s * 32768) : Math.round(s * 32767); };
// Auf 16 kHz herunterrechnen (Mitteln) und in 16-Bit-Zahlen wandeln. st = { ratio, acc, need } wird fortgeschrieben.
// Flächenmittel: Jeder Ausgangswert ist der Mittelwert über genau ratio Eingangswerte, Randwerte anteilig. Bei 48 kHz sind das
// exakt 3 Werte; bei 44,1 kHz (Verhältnis 2,756) bleiben die Abstände gleichmäßig, statt abwechselnd 2 und 3 Werte zu mitteln
// (gemessen gegen einen idealen Resampler: Mel-Abweichung bei sauberem Signal auf etwa ein Drittel). Eine längere
// Tiefpass-Vorfilterung änderte die Trefferquote nicht messbar, kostet am iPad aber Rechenzeit.
function downsample(st, f) {
  const r = st.ratio;
  if (r <= 1.0001) {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) out[i] = toI16(f[i]);
    return out;
  }
  const buf = new Int16Array(Math.ceil(f.length / r) + 2);
  let n = 0, acc = st.acc || 0, need = st.need > 0 ? st.need : r;
  for (let i = 0; i < f.length; i++) {
    const x = f[i];
    let w = 1;
    while (w > 1e-9) {
      const t = w < need ? w : need;
      acc += x * t; need -= t; w -= t;
      if (need <= 1e-9) { buf[n++] = toI16(acc / r); acc = 0; need += r; }
    }
  }
  st.acc = acc; st.need = need;
  return buf.subarray(0, n);
}

// Aktivierungswort: openWakeWord im Browser. Dieselbe Kette wie openwakeword/utils.py (AudioFeatures, streaming) und model.py:
// Audio in Blöcken zu 1280 Werten (80 ms, 16 kHz, Int16-Maßstab) -> melspectrogram.onnx (letzte 1280 + 480 Werte, danach x/10+2)
// -> embedding_model.onnx (die letzten 76 Mel-Frames ergeben je Block ein 96er-Embedding) -> Weckwort-Modell (die letzten
// 16 Embeddings, [1,16,96]) -> Wahrscheinlichkeit. onnxruntime-web kommt aus einem festen Ordner von jsDelivr, einmal pro Seite.
// Bewusst 1.18.0 und nur das WASM-Backend (ort.wasm.min.js): Ab 1.19 gibt es nur noch den Build ort-wasm-simd-threaded.wasm, der
// geteilten WebAssembly-Speicher (SharedArrayBuffer) importiert. Der braucht Cross-Origin-Isolation, die Home Assistant nicht setzt;
// unter iOS 17 (HA-App, Safari) schlägt das Laden dann fehl. 1.18 hat noch ort-wasm-simd.wasm ohne Threads und ohne geteilten Speicher.
// Ist bereits ein anderes window.ort geladen (z. B. 1.20 aus einer älteren Datei, Prod und Beta teilen sich window.ort und
// window.__fpOrtLoad), wird es in loadOrt() unverändert genutzt: keine zweite Version in dieselbe globale Variable laden.
const ORT_VER = "1.18.0";
const ORT_DIR = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VER + "/dist/";
const WK_CHUNK = 1280;
const WAKE_SKIP = 5;   // die ersten Blöcke nach dem Start zählen nicht (wie im Original)
const wkErr = (e, k) => { e = e instanceof Error ? e : new Error(String(e)); e.wk = k; return e; };
function loadOrt() {
  if (window.ort && window.ort.InferenceSession) return Promise.resolve(window.ort);
  if (!window.__fpOrtLoad) {
    const p = window.__fpOrtLoad = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = ORT_DIR + "ort.wasm.min.js";
      s.onload = () => (window.ort && window.ort.InferenceSession ? res(window.ort) : rej(new Error("ort")));
      s.onerror = () => { s.remove(); rej(new Error("ort laden: " + s.src.replace(/^https?:\/\//, ""))); };
      document.head.appendChild(s);
    }).then(ort => {
      // ein Thread (ohne geteilten Speicher läuft nur ort-wasm-simd.wasm); die WASM-Dateien liegen im selben Ordner.
      // Nur für die hier geladene Version: ein fremdes window.ort behält seine eigenen Pfade (es sucht seine .wasm selbst).
      try { ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmPaths = ORT_DIR; ort.env.logLevel = "error"; } catch (e) {}
      return ort;
    });
    p.catch(() => { if (window.__fpOrtLoad === p) window.__fpOrtLoad = null; });
  }
  return window.__fpOrtLoad.catch(e => { throw wkErr(e, "ort"); });
}
const wkSess = {};
function loadModel(url) {
  if (!wkSess[url]) {
    const p = wkSess[url] = (async () => {
      const ort = await loadOrt();
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
        return await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      } catch (e) { throw wkErr(e, "model"); }
    })();
    p.catch(() => { if (wkSess[url] === p) delete wkSess[url]; });
  }
  return wkSess[url];
}
// Wie viele Embeddings das Weckwort-Modell erwartet ([1, n, 96]): aus den Metadaten (neuere ORT), sonst durch Probieren.
async function wakeFrames(ort, s) {
  try {
    const m = s.inputMetadata, d = m && (Array.isArray(m) ? m[0] : m[s.inputNames[0]]);
    if (d && d.shape && d.shape[1] > 0) return d.shape[1];
  } catch (e) {}
  let n = 16;
  for (let t = 0; t < 2; t++) {
    try { await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", new Float32Array(n * 96), [1, n, 96]) }); return n; }
    catch (e) {
      const m = /Expected:?\s*(\d+)/i.exec(String((e && e.message) || e));
      if (!m || +m[1] === n) throw wkErr(e, "model");
      n = +m[1];
    }
  }
  throw wkErr(new Error("Eingabeform"), "model");
}
// Wie im Original startet der Embedding-Puffer mit Embeddings aus Rauschen (4 s dort, hier 3 s); einmal berechnet, bei jedem Zurücksetzen benutzt.
const wkNoise = {};
function noiseFeats(ort, mel, emb, key) {
  if (!wkNoise[key]) {
    const p = wkNoise[key] = (async () => {
      const n = 48000, x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = Math.floor(Math.random() * 2000 - 1000);
      const mo = (await mel.run({ [mel.inputNames[0]]: new ort.Tensor("float32", x, [1, n]) }))[mel.outputNames[0]];
      const T = mo.dims[2], spec = new Float32Array(T * 32);
      for (let i = 0; i < spec.length; i++) spec[i] = mo.data[i] / 10 + 2;
      const starts = [];
      for (let s = 0; s + 76 <= T; s += 8) starts.push(s);
      const b = new Float32Array(starts.length * 76 * 32);
      starts.forEach((s, i) => b.set(spec.subarray(s * 32, (s + 76) * 32), i * 76 * 32));
      const eo = (await emb.run({ [emb.inputNames[0]]: new ort.Tensor("float32", b, [starts.length, 76, 32, 1]) }))[emb.outputNames[0]];
      return starts.map((s, i) => eo.data.slice(i * 96, (i + 1) * 96));
    })();
    p.catch(() => { if (wkNoise[key] === p) delete wkNoise[key]; });
  }
  return wkNoise[key];
}
// w = { model, base, threshold, patience }. push() nimmt 16-kHz-Int16-Audio in beliebiger Länge; onwake(score) kommt, wenn
// mindestens `patience` Blöcke in Folge die Schwelle erreichen. Nach reset() (oder dispose()) werden Rechenreste verworfen.
class WakeEngine {
  constructor(w) {
    this.w = w;
    this.onwake = null;
    this.onscore = null;
    this.onerror = null;
    this.ort = this.mel = this.emb = this.mdl = this.noise = null;
    this.nf = 16;
    this.gen = 0;
    this.busy = false;
    this._p = null;
    this._clear();
  }
  load() {
    if (!this._p) {
      const p = this._p = (async () => {
        const w = this.w, ort = await loadOrt();
        const [mel, emb, mdl] = await Promise.all([loadModel(w.base + "melspectrogram.onnx"), loadModel(w.base + "embedding_model.onnx"), loadModel(w.model)]);
        this.nf = await wakeFrames(ort, mdl);
        this.noise = await noiseFeats(ort, mel, emb, w.base);
        this.ort = ort; this.mel = mel; this.emb = emb; this.mdl = mdl;
        this.reset();
      })();
      p.catch(() => { if (this._p === p) this._p = null; });
    }
    return this._p;
  }
  _clear() {
    this.q = [];
    this.acc = new Int16Array(WK_CHUNK);
    this.an = 0;
    this.raw = new Float32Array(0);
    this.mb = [];
    for (let i = 0; i < 76; i++) this.mb.push(new Float32Array(32).fill(1));
    this.fb = this.noise ? this.noise.slice() : [];
    this.frames = 0;
    this.run = 0;
    this.pk = 0;
  }
  reset() { this.gen++; this._clear(); }
  dispose() { this.gen++; this._clear(); this.onwake = this.onscore = this.onerror = null; this.mdl = null; }
  push(i16) {
    if (!this.mdl || !i16 || !i16.length) return;
    for (let i = 0; i < i16.length; i++) {
      this.acc[this.an++] = i16[i];
      if (this.an === WK_CHUNK) { this.q.push(this.acc.slice(0)); this.an = 0; }
    }
    // Rechnet das Gerät hinterher (über 2 s), die ältesten Blöcke fallen lassen statt immer weiter zu stauen.
    if (this.q.length > 25) this.q.splice(0, this.q.length - 3);
    if (!this.busy) this._pump();
  }
  async _pump() {
    this.busy = true;
    try {
      while (this.q.length && this.mdl) await this._step(this.q.shift(), this.gen);
    } catch (e) {
      this.q = [];
      if (this.onerror) this.onerror(e);
    } finally { this.busy = false; }
  }
  async _step(c, g) {
    const ort = this.ort, mk = (d, sh) => new ort.Tensor("float32", d, sh);
    // Mel-Spektrogramm über die letzten 1280 + 480 Werte (480 = Überlappung wie im Original)
    const all = new Float32Array(this.raw.length + c.length);
    all.set(this.raw);
    all.set(c, this.raw.length);
    this.raw = all.length > WK_CHUNK + 480 ? all.slice(all.length - WK_CHUNK - 480) : all;
    const mo = (await this.mel.run({ [this.mel.inputNames[0]]: mk(this.raw, [1, this.raw.length]) }))[this.mel.outputNames[0]];
    if (g !== this.gen) return;
    const n = mo.dims[2], d = mo.data;
    for (let t = 0; t < n; t++) {
      const r = new Float32Array(32);
      for (let k = 0; k < 32; k++) r[k] = d[t * 32 + k] / 10 + 2;
      this.mb.push(r);
    }
    if (this.mb.length > 152) this.mb.splice(0, this.mb.length - 152);
    // die letzten 76 Mel-Frames ergeben ein 96er-Embedding
    const win = new Float32Array(76 * 32);
    for (let i = 0; i < 76; i++) win.set(this.mb[this.mb.length - 76 + i], i * 32);
    const eo = (await this.emb.run({ [this.emb.inputNames[0]]: mk(win, [1, 76, 32, 1]) }))[this.emb.outputNames[0]];
    if (g !== this.gen) return;
    this.fb.push(eo.data.slice(0, 96));
    if (this.fb.length > 64) this.fb.splice(0, this.fb.length - 64);
    this.frames++;
    if (this.fb.length < this.nf) return;
    const f = new Float32Array(this.nf * 96);
    for (let i = 0; i < this.nf; i++) f.set(this.fb[this.fb.length - this.nf + i], i * 96);
    const so = (await this.mdl.run({ [this.mdl.inputNames[0]]: mk(f, [1, this.nf, 96]) }))[this.mdl.outputNames[0]];
    if (g !== this.gen) return;
    this._score(this.frames <= WAKE_SKIP ? 0 : so.data[0]);
  }
  _score(s) {
    if (this.onscore) this.onscore(s);
    const w = this.w;
    if (s >= w.threshold) { this.run++; if (s > this.pk) this.pk = s; } else { this.run = 0; this.pk = 0; }
    if (this.run >= w.patience) {
      const pk = this.pk;
      this.run = 0; this.pk = 0;
      if (this.onwake) this.onwake(pk);
    }
  }
}
// wake-engine:end
const MIC = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
// AudioContext immer mit der Rate des Geräts: Eine fremde Rate (z. B. 16 kHz) zwingt iOS, die Hardware umzuschalten bzw. schlecht
// zu resampeln, das knackt und rauscht im Lautsprecher, solange der Kontext läuft (beim Aktivierungswort also dauernd).
// Auf 16 kHz herunter rechnet downsample().
const mkCtx = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  try { return new AC(); } catch (e) { return null; }
};
// Hängt der Worklet am MediaStream-Ausgang nicht, rechnet der Browser ihn nicht: dann (und nur dann) wieder der stumme Gain am
// Lautsprecher-Ausgang. Wird pro Seite einmal festgestellt.
let SINK_BAD = false;
const SINK_WAIT = 500;   // so lange darf nach dem Start des Kontexts das erste Audio-Paket auf sich warten lassen

function normCfg(c) {
  c = c || {};
  let sug = Array.isArray(c.suggestions) ? c.suggestions : SUGG;
  sug = sug.map(s => typeof s === "string" ? { icon: "", text: s } : { icon: String((s && s.icon) || ""), text: String((s && s.text) || "") })
    .filter(s => s.text.trim());
  // lift: { <letzter Pfadteil>: px }. Am Handy (unter 700 px) rückt die Figur auf diesen Seiten so weit nach oben,
  // damit sie eine klebende Aktionsleiste (Baby-Tab) nicht verdeckt.
  let lift = { baby: 76 };
  if (c.lift && typeof c.lift === "object" && !Array.isArray(c.lift)) {
    lift = {};
    for (const k of Object.keys(c.lift)) { const v = Number(c.lift[k]); if (isFinite(v) && v > 0) lift[k] = Math.min(v, 400); }
  }
  const name = String(c.name || "").trim() || "Pip";
  // wake_word: Aktivierungswort im Browser. Ohne model gibt es die Funktion nicht; base = Ordner mit
  // melspectrogram.onnx und embedding_model.onnx (Vorgabe: der Ordner von model).
  let wake = null;
  const w = c.wake_word;
  if (w && typeof w === "object" && String(w.model || "").trim()) {
    const model = String(w.model).trim();
    let base = String(w.base || "").trim() || model.replace(/[^/]*$/, "");
    if (base && !base.endsWith("/")) base += "/";
    const th = Number(w.threshold), pa = Math.round(Number(w.patience));
    wake = {
      name: String(w.name || "").trim() || "Hey " + name,
      model,
      base,
      threshold: isFinite(th) && th > 0 && th < 1 ? th : 0.5,
      patience: isFinite(pa) && pa >= 1 ? Math.min(pa, 10) : 2,
    };
  }
  // alarms: Timer, Wecker und Erinnerungen aus Helfern in Home Assistant (Zustände in hass.states, keine Ereignisse).
  // Ohne diesen Block gibt es die Funktion nicht. slots brauchen Zeit und Text (leerer Text = Platz frei).
  let alarms = null;
  const al = c.alarms;
  if (al && typeof al === "object" && !Array.isArray(al)) {
    const ent = (v, dom) => { v = String(v || "").trim(); return v.indexOf(dom + ".") === 0 ? v : ""; };
    const list = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x === "object");
    const timers = list(al.timers).map(x => ({ timer: ent(x.timer, "timer"), name: ent(x.name, "input_text") })).filter(x => x.timer);
    const slots = list(al.slots).map(x => ({ zeit: ent(x.zeit, "input_datetime"), text: ent(x.text, "input_text") })).filter(x => x.zeit && x.text);
    const klingel = ent(al.klingel, "input_text");
    const rs = Number(al.ring_seconds), ph = Number(al.preview_hours);
    if (klingel || timers.length || slots.length) {
      alarms = {
        klingel, timers, slots,
        ring_seconds: isFinite(rs) && rs > 0 ? Math.min(Math.max(rs, 5), 600) : 60,
        preview_hours: isFinite(ph) && ph > 0 ? Math.min(Math.max(ph, 1), 168) : 24,
      };
    }
  }
  // learn: Skript, das nach jeder Bitte an den Gesprächsagenten (nicht lokal erledigt) aufgerufen wird; ohne gültige Angabe keine Funktion
  const lr = String(c.learn || "").trim();
  // wake_screen: Knopf oder Skript, das beim Aktivierungswort den Bildschirmschoner beendet (Kiosker: "Bildschirmschoner beenden"); ohne gültige Angabe keine Funktion
  const ws = String(c.wake_screen || "").trim();
  // wake_log: Skript, das jede angenommene Erkennung des Aktivierungsworts (mit dem danach verstandenen Text) und knappe Werte unter der Schwelle
  // protokolliert; ohne gültige Angabe (oder ohne wake_word) keine Funktion
  const wl = String(c.wake_log || "").trim();
  // wake_clip: Skript, das bei jeder Reaktion des Weckwort-Modells (Schwelle erreicht) den Mikrofon-Ton davor und danach als WAV (Base64) bekommt,
  // um Fehlauslöser als Trainingsdaten zu sammeln; ohne gültige Angabe (oder ohne wake_word) keine Funktion
  const wc = String(c.wake_clip || "").trim();
  return {
    name,
    pipeline_id: String(c.pipeline_id || "").trim(),
    speak: c.speak === "always" || c.speak === "never" ? c.speak : "auto",
    suggestions: sug,
    dashboard: String(c.dashboard || "").replace(/^\/+|\/+$/g, "").trim(),
    lift,
    position: c.position === "left" ? "left" : "right",
    wake_word: wake,
    alarms,
    learn: /^script\.[a-z0-9_]+$/.test(lr) ? lr : "",
    // early_tts: Sprachausgabe schon abspielen, während Home Assistant sie erzeugt (stream_response); Vorgabe aus (am iPad rauschte es)
    early_tts: c.early_tts === true,
    // mic_pause: Das Weckwort-Mikrofon ist zu, solange Pip eine Antwort vorliest (iOS bleibt sonst im Aufnahmemodus und rauscht); Vorgabe an.
    // Beim Klingeln (Ton und Ansage) bleibt es offen, damit das Aktivierungswort das Klingeln abstellen kann.
    mic_pause: c.mic_pause !== false,
    wake_screen: /^(button|input_button|script)\.[a-z0-9_]+$/.test(ws) ? ws : "",
    wake_log: /^script\.[a-z0-9_]+$/.test(wl) ? wl : "",
    wake_clip: /^script\.[a-z0-9_]+$/.test(wc) ? wc : "",
    // stage (Bühne): bei Gesprächen per Aktivierungswort und per Tipp auf die Figur, ab 700 px Breite, wird das Dashboard abgedunkelt, die Figur groß, das Gespräch darunter; Vorgabe aus
    stage: c.stage === true,
  };
}
// Zeitpunkt als "JJJJ-MM-TT HH:MM:SS" in der Zeitzone von Home Assistant.
function localStr(iso, tz) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const p = {};
    for (const x of f.formatToParts(d)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  } catch (e) {
    const z = U.pad;
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  }
}
function errKey(err) {
  if (typeof err === "number") return "conn";
  if (err && typeof err.code === "number") return "conn";
  if (err && err.code === "not_found") return "pipeline";
  return "generic";
}

// ---------- Timer, Wecker, Erinnerungen: Helfer ohne Bezug zur Oberfläche ----------
// JSON-Objekt aus einem input_text; leer, unbekannt oder kaputt -> null (der Platz ist frei).
const jsonObj = v => {
  v = String(v == null ? "" : v).trim();
  if (!v || v.charAt(0) !== "{") return null;
  try { const o = JSON.parse(v); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch (e) { return null; }
};
// "H:MM:SS" (auch "1 day, 2:03:04" und Bruchteile) von Home Assistant -> Sekunden, sonst null
function parseDur(s) {
  const m = /^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(String(s == null ? "" : s).trim());
  return m ? (+(m[1] || 0)) * 86400 + (+m[2]) * 3600 + (+m[3]) * 60 + (+m[4]) : null;
}
// Restzeit als "4:32" bzw. "1:02:10"
function fmtCount(sec) {
  sec = Math.max(0, Math.ceil(sec - 1e-6));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, z = U.pad;
  return h ? `${h}:${z(m)}:${z(s)}` : `${m}:${z(s)}`;
}
// Klingel-Signal aus dem input_text: { art, text, t (Unix-Sekunden), key } oder null (leer, kaputt, ohne t)
function parseKl(raw) {
  const o = jsonObj(raw), t = o ? Number(o.t) : NaN;
  if (!o || !isFinite(t) || t <= 0) return null;
  const art = o.art === "timer" || o.art === "wecker" ? o.art : "erinnerung";
  const text = String(o.text == null ? "" : o.text).trim();
  return { art, text, t, key: art + "|" + text + "|" + t };
}
function ringTitle(r) {
  if (r.art === "timer") return r.text ? `Timer „${r.text}“ ist abgelaufen` : "Der Timer ist abgelaufen";
  if (r.art === "wecker") return "Wecker";
  return r.text ? `Erinnerung: ${r.text}` : "Erinnerung";
}
// Text der Ansage (gesprochen, deshalb ohne Anführungszeichen)
function ringSay(r) {
  if (r.art === "timer") return r.text ? `Der Timer ${r.text} ist abgelaufen.` : "Der Timer ist abgelaufen.";
  if (r.art === "wecker") return r.text ? `Wecker. ${r.text}` : "Der Wecker klingelt.";
  return r.text ? `Erinnerung: ${r.text}` : "Du hast eine Erinnerung.";
}
// Zeitpunkt einer Uhrzeit-Pille in der Zeitzone von Home Assistant: "6:30", "morgen 6:30" oder, weiter weg, "Sa 6:30".
function slotWhen(ts, now, tz) {
  const a = localStr(new Date(ts).toISOString(), tz), b = localStr(new Date(now).toISOString(), tz);
  if (!a || !b) return "";
  const hm = (+a.slice(11, 13)) + ":" + a.slice(14, 16);
  const dn = x => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10)) / 86400000;
  const d = Math.round(dn(a) - dn(b));
  if (d <= 0) return hm;
  if (d === 1) return "morgen " + hm;
  return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(dn(a) * 86400000).getUTCDay()] + " " + hm;
}

let dock = null;       // das eine Dock
let lastCard = null;   // zuletzt aktive Karteninstanz (liefert hass)

// hass immer frisch holen: von der Karte, solange sie am Bildschirm hängt, sonst direkt aus Home Assistant.
function getHass() {
  if (lastCard && lastCard.isConnected && lastCard._hass) return lastCard._hass;
  const ha = document.querySelector("home-assistant");
  if (ha && ha.hass) return ha.hass;
  return lastCard && lastCard._hass ? lastCard._hass : null;
}
// Theme-Werte der Karte aufs Dock übertragen (falls die Karte sie anders sieht als <html>).
function copyTheme(from) {
  if (!dock || !from) return;
  try {
    const cs = getComputedStyle(from);
    for (const v of THEME_VARS) {
      const val = cs.getPropertyValue(v).trim();
      if (val) dock.style.setProperty(v, val); else dock.style.removeProperty(v);
    }
  } catch (e) {}
}
// Linker Rand des Inhaltsbereichs, also rechts neben der HA-Seitenleiste (ausgeklappt ca. 256 px, eingeklappt ca. 56 px,
// im Kiosk-Modus und am Handy 0). Gemessen am Panel, sonst am rechten Rand der Seitenleiste; el = Element zum Beobachten.
function contentEdge() {
  let x = 0, el = null;
  try {
    const ha = document.querySelector("home-assistant");
    const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
    const mr = main && main.shadowRoot;
    if (mr) {
      const panel = mr.querySelector("partial-panel-resolver") || mr.querySelector("ha-panel-lovelace");
      const side = mr.querySelector("ha-sidebar");
      if (panel) { el = panel; x = panel.getBoundingClientRect().left; }
      else if (side) { el = side; const r = side.getBoundingClientRect(); x = r.width > 0 ? r.right : 0; }
    }
  } catch (e) { x = 0; }
  x = Math.round(x);
  return { x: x > 0 && x < window.innerWidth * 0.5 ? x : 0, el };
}
function ensureDock() {
  if (dock) return dock;
  if (!document.body) return null;
  dock = document.querySelector(TAG) || null;
  if (!dock) {
    dock = document.createElement(TAG);
    dock.hidden = true;
    document.body.appendChild(dock);
  }
  return dock;
}
// Passt das Dock zum aktuellen Pfad? Mit gespeicherter Konfiguration zeigen, sonst verstecken (nicht entfernen).
function syncDock() {
  const cfg = loadCfg(pathPart());
  if (cfg) {
    const d = ensureDock();
    if (d && typeof d.configure === "function") { d.configure(normCfg(cfg)); d.setVisible(true); d.applyLift(); d.applyPos(); }
  } else if (dock && typeof dock.setVisible === "function") dock.setVisible(false);
}

class FpAssistantCard extends HTMLElement {
  setConfig(config) {
    this._cfg = normCfg(config);
    saveCfg(this._cfg.dashboard || pathPart(), this._cfg);
    this._look();
    syncDock();
  }
  connectedCallback() {
    lastCard = this;
    this._look();
    syncDock();
    if (this._hass) copyTheme(this);
  }
  set hass(h) {
    this._hass = h;
    lastCard = this;
    // Theme gewechselt (hell/dunkel, anderes Theme)? Dann die Werte neu übertragen, sobald HA sie gesetzt hat.
    const t = h && h.themes;
    const sig = t ? String(t.theme) + "|" + String(t.darkMode) : "";
    if (sig !== this._themeSig) {
      this._themeSig = sig;
      clearTimeout(this._tt);
      this._tt = setTimeout(() => copyTheme(this), 150);
    }
    if (dock && typeof dock.hassUpdated === "function") dock.hassUpdated();
  }
  get hass() { return this._hass; }
  _editing() {
    try { return !!this.closest("hui-card-edit-mode, hui-card-options, hui-card-preview, hui-dialog-edit-card"); } catch (e) { return false; }
  }
  // Im Dashboard unsichtbar. Nur beim Bearbeiten bleibt ein kleiner Platzhalter, damit man die Karte findet.
  _look() {
    const p = this.parentElement, hc = p && p.localName === "hui-card" ? p : null;
    if (this._editing()) {
      this.style.display = "block";
      this.innerHTML = `<div style="padding:12px 16px;border:1px dashed var(--divider-color);border-radius:var(--fp-radius-sm,12px);font-size:.9rem;color:var(--secondary-text-color);">${U.esc((this._cfg && this._cfg.name) || "Pip")}: Sprachassistent. Die Karte ist unsichtbar, sie zeigt eine schwebende Figur.</div>`;
      if (hc) hc.style.removeProperty("display");
    } else {
      this.innerHTML = "";
      this.style.display = "none";
      if (hc) hc.style.display = "none";
    }
  }
  getCardSize() { return 0; }
  getGridOptions() { return { columns: "full", rows: "auto", min_rows: 0 }; }
  static getStubConfig() { return { name: "Pip" }; }
}

// Der Figur-Teil des Stylesheets (Kugel, Augen, Ringe, Ohr-Punkt, Zustände): gemeinsam für die feste Figur im Dock und die Kopie im Platz der Kinder-Leiste (fp-pip-dock-slotfig).
const FIG_CSS = `
/* Dunkles Theme (Klasse dk, vom Skript nach hass.themes.darkMode gesetzt): die Kugel wird zur Mitte hin mit der hellen Schriftfarbe aufgehellt statt mit dem dunklen Hintergrund, die Augen bleiben dunkel */
:host{--a:var(--fp-accent,var(--primary-color));--bg:var(--card-background-color,#fff);--tx:var(--primary-text-color,#000);--pip:var(--fp-pip,var(--a));--hl:var(--bg);--eye:var(--tx);}
:host(.dk){--hl:var(--tx);--eye:var(--bg);}
*{box-sizing:border-box;}
button{font:inherit;color:inherit;}
.fig{padding:0;margin:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.fig.gone{opacity:0;transform:scale(.6);pointer-events:none;visibility:hidden;transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s;}
.fig:focus-visible{outline:3px solid var(--a);outline-offset:4px;}
.ear{position:absolute;right:3px;bottom:3px;width:13px;height:13px;border-radius:50%;background:var(--pip);border:2px solid var(--bg);opacity:0;transform:scale(.5);transition:opacity .25s ease,transform .25s ease;pointer-events:none;}
.fig.wk-on .ear{opacity:1;transform:none;animation:pp-ear 3.4s ease-in-out infinite;}
.fig.wk-wait .ear{opacity:1;transform:none;background:var(--bg);border-color:var(--pip);}
.pip{position:relative;display:block;width:100%;height:100%;--rs:1.9;}
.pip.mini{width:44px;height:44px;flex:none;--rs:1.45;}
.ball{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:17%;border-radius:50%;background:radial-gradient(circle at 34% 28%,color-mix(in srgb,var(--pip) 30%,var(--hl)) 0,color-mix(in srgb,var(--pip) 65%,var(--hl)) 48%,var(--pip) 100%);box-shadow:0 6px 18px color-mix(in srgb,var(--pip) 45%,transparent);}
.ball::before{content:"";position:absolute;left:47%;bottom:90%;width:27%;height:34%;border-radius:100% 0 100% 0;background:linear-gradient(135deg,color-mix(in srgb,var(--pip) 38%,var(--hl)),color-mix(in srgb,var(--pip) 82%,var(--tx)));transform:rotate(-18deg);transform-origin:0 100%;}
.eye{display:block;width:13%;height:20%;margin-top:6%;border-radius:50%;background:color-mix(in srgb,var(--pip) 25%,var(--eye));}
.ring{position:absolute;inset:0;border-radius:50%;border:2px solid color-mix(in srgb,var(--pip) 70%,transparent);opacity:0;pointer-events:none;}
.st-idle .ball{animation:pp-float 3.6s ease-in-out infinite;}
.st-idle .eye{animation:pp-blink 5.2s infinite;}
.st-listen .ring{animation:pp-ring 1.8s ease-out infinite;}
.st-listen .r2{animation-delay:.9s;}
.st-listen .eye{scale:1.3;}
.st-think .ball{animation:pp-wobble 1.3s ease-in-out infinite;}
.st-think .eye{animation:pp-look 1.5s ease-in-out infinite;}
.st-speak .ball{animation:pp-pulse .8s ease-in-out infinite;}
.fig.ringing .ring{animation:pp-ring 1.4s ease-out infinite;}
.fig.ringing .r2{animation-delay:.7s;}
.fig.ringing .ball{animation:pp-wobble .45s ease-in-out infinite;}
@keyframes pp-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
@keyframes pp-blink{0%,91%,100%{scale:1 1;}95%{scale:1 .1;}}
@keyframes pp-ring{0%{transform:scale(1);opacity:.6;}100%{transform:scale(var(--rs));opacity:0;}}
@keyframes pp-wobble{0%,100%{transform:rotate(-3deg);}50%{transform:rotate(3deg);}}
@keyframes pp-look{0%,100%{translate:-45% 0;}50%{translate:45% 0;}}
@keyframes pp-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.09);}}
@keyframes pp-ear{0%,100%{opacity:1;}50%{opacity:.4;}}
@media (prefers-reduced-motion:reduce){
  .ball,.eye,.ring,.fig .ear{animation:none !important;}
  .fig,.ear{transition:none !important;}
  .st-listen .r1,.fig.ringing .r1{opacity:.55;transform:scale(1.25);}
}
`;

const CSS = `
:host{display:block;--afg:var(--fp-accent-fg,var(--text-primary-color,#fff));--s1:var(--fp-surface,var(--secondary-background-color));--s2:var(--fp-surface-2,var(--divider-color));--rad:var(--fp-radius,16px);--rsm:var(--fp-radius-sm,12px);--tx2:var(--secondary-text-color);--dv:var(--divider-color);font-family:var(--primary-font-family,inherit);color:var(--tx);-webkit-text-size-adjust:100%;}
:host([hidden]){display:none !important;}

/* Figur */
/* --gx = linker Rand des Inhaltsbereichs (rechts neben der HA-Seitenleiste), nur bei position: left gesetzt */
.fig{position:fixed;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px) + var(--lift,0px));z-index:6;width:60px;height:60px;transition:opacity .2s ease,transform .2s ease,bottom .25s ease,left .2s ease;}
.fig.left{right:auto;left:calc(16px + var(--gx,0px) + env(safe-area-inset-left,0px));}
/* Platz in der Kinder-Leiste der Baby-Karte (Handy, window.__fpPipSlots): Anker und Pillen sitzen mit festen Werten (--sl links, --st oben, --sz Größe, --sr rechts, vom Skript
   aus dem Rechteck des Platzes gesetzt) dort; die Figur selbst steckt als echte Kopie (fp-pip-dock-slotfig) im Platz und läuft mit der Leiste mit, die feste Figur ist dann unsichtbar (.inslot). */
.fig.inslot{visibility:hidden;pointer-events:none;transition:none;}
/* Bühne (stage): .anc sitzt wie die Figur, bleibt aber unverschoben und unsichtbar; daran wird gemessen, wohin die Figur rollen muss.
   .veil dunkelt das Dashboard ab (unter Figur und Fenster, Tippen darauf beendet die Bühne). Beides nur ab 700 px Breite sichtbar bzw. in Gebrauch. */
.anc{position:fixed;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px) + var(--lift,0px));width:60px;height:60px;visibility:hidden;pointer-events:none;}
.anc.left{right:auto;left:calc(16px + var(--gx,0px) + env(safe-area-inset-left,0px));}
.anc.slot{right:auto;bottom:auto;left:var(--sl,0px);top:var(--st,0px);width:var(--sz,52px);height:var(--sz,52px);}
.veil{display:none;position:fixed;inset:0;z-index:5;background:color-mix(in srgb,var(--tx) 60%,transparent);opacity:0;pointer-events:none;transition:opacity .4s ease;-webkit-tap-highlight-color:transparent;}
.veil.dk{background:color-mix(in srgb,var(--bg) 70%,transparent);}
.veil.on{opacity:1;pointer-events:auto;}
${FIG_CSS}
@keyframes pp-dot{30%{opacity:1;transform:translateY(-3px);}}
@keyframes pp-rec{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--a) 50%,transparent);}100%{box-shadow:0 0 0 12px transparent;}}
@keyframes pp-alert{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--a) 45%,transparent),0 14px 40px color-mix(in srgb,var(--tx) 26%,transparent);}100%{box-shadow:0 0 0 16px transparent,0 14px 40px color-mix(in srgb,var(--tx) 26%,transparent);}}
@keyframes pp-bell{0%,45%,100%{transform:none;}8%{transform:rotate(-16deg);}16%{transform:rotate(14deg);}24%{transform:rotate(-10deg);}32%{transform:rotate(6deg);}40%{transform:rotate(-2deg);}}

/* Gesprächs-Panel */
.panel{position:fixed;z-index:7;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--tx);border:1px solid var(--dv);box-shadow:0 18px 50px color-mix(in srgb,var(--tx) 24%,transparent);visibility:hidden;transition:transform .28s cubic-bezier(.2,.9,.3,1),visibility 0s linear .28s;}
@media (min-width:700px){
  .panel{top:calc(12px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));width:min(400px,calc(100vw - 24px - var(--gx,0px)));border-radius:22px;transform:translateX(calc(100% + 40px));}
  .panel.left{right:auto;left:calc(12px + var(--gx,0px) + env(safe-area-inset-left,0px));transform:translateX(calc(-100% - var(--gx,0px) - 40px));}
  .bar{padding-bottom:12px;}
  /* Bühne (stage): Die Figur rollt mit einer einzigen Verschiebung und Vergrößerung (transform) in die Mitte oben, das Fenster steht darunter.
     --sx, --sy, --ss (Verschiebung, Maßstab) und --stage-top (Oberkante des Fensters) setzt das Skript aus der Lage der Figur. */
  .veil{display:block;}
  .fig.stg{transition:transform .75s cubic-bezier(.35,.9,.3,1);}
  .fig.stage{transform:translate(var(--sx,0px),var(--sy,0px)) scale(var(--ss,3.2));transform-origin:50% 50%;}
  .panel.stage,.panel.left.stage{top:var(--stage-top,300px);right:auto;bottom:calc(24px + env(safe-area-inset-bottom,0px));left:max(24px,calc(50vw - 380px));width:min(760px,calc(100vw - 48px));}
  .panel.stage:not(.open),.panel.left.stage:not(.open){transform:translateY(calc(100% + 60px));transition:transform .45s cubic-bezier(.4,0,.8,.4),visibility 0s linear .45s;}
  .panel.stage.open,.panel.left.stage.open{transform:none;transition:transform .5s cubic-bezier(.2,.9,.3,1) .3s,visibility 0s;}
  .panel.stage .head,.panel.stage .wk{display:none;}
  .panel.stage .ib.sx{display:flex;}
  .panel.stage .log{padding:46px 20px 6px;gap:12px;}
  .panel.stage .hello,.panel.stage .ai{font-size:1.25rem;}
  .panel.stage .me{font-size:1.2rem;}
  .panel.stage .note{font-size:1.03rem;}
}
@media (max-width:699.98px){
  .panel{left:8px;right:8px;bottom:var(--kb,0px);height:min(82vh,calc(var(--vvh,100vh) - 12px));border-radius:22px 22px 0 0;transform:translateY(calc(100% + 40px));}
}
.panel.open{visibility:visible;transform:none;transition:transform .28s cubic-bezier(.2,.9,.3,1),visibility 0s;}
.head{flex:none;display:flex;align-items:center;gap:10px;padding:18px 10px 10px 14px;border-bottom:1px solid var(--dv);}
.who{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.nm{font-weight:800;font-size:1.05rem;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.stt{font-size:.8rem;color:var(--tx2);}
.ib{flex:none;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:50%;background:var(--s1);color:var(--tx);font-size:1.15rem;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent;}
@media (hover:hover){.ib:hover{background:var(--s2);}}
.ib.sx{display:none;position:absolute;top:8px;right:10px;z-index:2;width:38px;height:38px;font-size:1rem;}
.ib:focus-visible,.chip:focus-visible,.go:focus-visible,.in:focus-visible,.ac button:focus-visible,.pl:focus-visible,.pm button:focus-visible,.al-b:focus-visible{outline:2px solid var(--a);outline-offset:2px;}

/* Schalter "Aktivierungswort" */
.wk{flex:none;display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--dv);}
.wk[hidden]{display:none;}
.wk-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.wk-l{font-size:.9rem;font-weight:700;line-height:1.25;}
.wk-h{font-size:.78rem;line-height:1.3;color:var(--tx2);}
.wk-h:empty{display:none;}
.wk.err .wk-h{color:var(--error-color,var(--tx));font-weight:600;}
.sw{flex:none;position:relative;width:48px;height:28px;padding:0;border:0;border-radius:999px;background:var(--s2);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s ease;}
.sw::after{content:"";position:absolute;inset:-9px -4px;}
.sw .kn{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--bg);box-shadow:0 1px 3px color-mix(in srgb,var(--tx) 30%,transparent);transition:transform .2s ease;}
.sw[aria-checked="true"]{background:var(--a);}
.sw[aria-checked="true"] .kn{transform:translateX(20px);}
.sw:disabled{opacity:.45;cursor:default;}
.sw:focus-visible{outline:2px solid var(--a);outline-offset:2px;}

/* Verlauf */
.log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;}
.hello{align-self:flex-start;max-width:92%;font-size:1rem;line-height:1.45;}
.me{align-self:flex-end;max-width:85%;padding:9px 14px;border-radius:var(--rad) var(--rad) 6px var(--rad);background:var(--a);color:var(--afg);font-size:.95rem;line-height:1.4;overflow-wrap:anywhere;white-space:pre-wrap;}
.ai{align-self:flex-start;max-width:94%;font-size:.98rem;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap;}
.note{align-self:center;max-width:92%;padding:2px 6px;text-align:center;font-size:.82rem;line-height:1.4;color:var(--tx2);}
.dots{align-self:flex-start;display:flex;gap:5px;padding:8px 2px;}
.dots i{display:block;width:7px;height:7px;border-radius:50%;background:var(--tx2);opacity:.45;animation:pp-dot 1.2s infinite;}
.dots i:nth-child(2){animation-delay:.2s;}
.dots i:nth-child(3){animation-delay:.4s;}

/* Aktionskarten */
.ac{align-self:stretch;display:flex;flex-direction:column;gap:6px;padding:11px 13px;border-radius:var(--rsm);background:var(--s1);}
.ac-t{font-size:.7rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--tx2);}
.ac-r{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:.92rem;line-height:1.35;}
.ac-r b{min-width:0;font-weight:700;overflow-wrap:anywhere;}
.ac-r span{max-width:55%;text-align:right;color:var(--tx2);overflow-wrap:anywhere;}
.ac-f{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px;}
.ac-s{font-size:.82rem;font-weight:600;color:var(--tx2);}
.ac button{min-height:40px;padding:8px 14px;border:0;border-radius:var(--rsm);font-size:.88rem;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.ac .pri{background:var(--a);color:var(--afg);}
.ac .ghost{background:transparent;color:var(--tx);box-shadow:inset 0 0 0 1px var(--dv);}
.ac button:disabled{opacity:.5;cursor:default;}

/* Vorschläge und Eingabe */
.chips{flex:none;display:flex;gap:8px;overflow-x:auto;padding:6px 14px 8px;scrollbar-width:thin;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;}
.chips:empty{display:none;}
@media (hover:none){.chips{scrollbar-width:none;}.chips::-webkit-scrollbar{display:none;}}
.chip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:8px 13px;border:1px solid var(--dv);border-radius:999px;background:var(--s1);color:var(--tx);font-size:.86rem;font-weight:600;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;}
@media (hover:hover){.chip:not(:disabled):hover{background:var(--s2);}}
.chip:disabled{opacity:.5;cursor:default;}
.bar{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px calc(12px + env(safe-area-inset-bottom,0px));}
.in{flex:1;min-width:0;height:46px;padding:0 16px;border:1px solid var(--dv);border-radius:999px;background:var(--s1);color:var(--tx);font:inherit;font-size:16px;}
.in::placeholder{color:var(--tx2);opacity:.85;}
.go{flex:none;display:flex;align-items:center;justify-content:center;width:46px;height:46px;padding:0;border:0;border-radius:50%;background:var(--a);color:var(--afg);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .1s;}
.go svg{width:22px;height:22px;}
.go:active:not(:disabled){transform:scale(.94);}
.go:disabled{opacity:.45;cursor:default;}
.go.rec{animation:pp-rec 1.2s ease-out infinite;}

/* Pillen (Timer, Wecker, Erinnerungen) und Klingel-Hinweis: stehen über der Figur, auf ihrer Seite, und heben sich mit (--lift).
   Der Stapel wächst nach oben: unten der Hinweis, darüber die Pillen, die nächste Fälligkeit zuerst. */
.stk{position:fixed;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(86px + env(safe-area-inset-bottom,0px) + var(--lift,0px));z-index:8;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:10px;max-width:calc(100% - 32px);pointer-events:none;transition:bottom .25s ease,left .2s ease;}
.stk.left{right:auto;left:calc(16px + var(--gx,0px) + env(safe-area-inset-left,0px));max-width:calc(100% - 32px - var(--gx,0px));align-items:flex-start;}
.stk.slot{right:auto;left:var(--sl,0px);top:auto;bottom:calc(100% - var(--st,0px) + 10px);max-width:calc(100% - var(--sl,0px) - 16px);align-items:flex-start;transition:none;}
.stk.slot.rt{left:auto;right:calc(100% - var(--sr,0px));max-width:calc(var(--sr,0px) - 16px);align-items:flex-end;}
.stk > *{pointer-events:auto;}
.stk.open .pls{display:none;}
.pls{display:flex;flex-direction:column-reverse;align-items:inherit;gap:8px;max-width:100%;}
.pls:empty{display:none;}
.pl{display:inline-flex;align-items:center;gap:7px;max-width:min(320px,100%);min-height:38px;padding:7px 14px;border:1px solid var(--dv);border-radius:999px;background:var(--bg);color:var(--tx);font-size:.92rem;font-weight:700;line-height:1.2;box-shadow:0 4px 14px color-mix(in srgb,var(--tx) 14%,transparent);cursor:pointer;-webkit-tap-highlight-color:transparent;}
@media (hover:hover){.pl:hover{background:var(--s1);}}
.pi{flex:none;font-size:1rem;line-height:1;}
.pt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pc{flex:none;font-variant-numeric:tabular-nums;color:var(--a);}
.pl.more{padding:7px 12px;color:var(--tx2);}
.pm{display:flex;flex-direction:column;gap:8px;width:min(290px,100%);padding:10px 12px;border:1px solid var(--dv);border-radius:var(--rsm);background:var(--bg);color:var(--tx);box-shadow:0 8px 26px color-mix(in srgb,var(--tx) 20%,transparent);}
.pm-h{display:flex;align-items:center;gap:7px;min-width:0;padding:0 2px;font-size:.92rem;font-weight:700;line-height:1.25;}
.pm-f{display:flex;gap:8px;}
.pm button{flex:1;min-height:42px;padding:8px 12px;border:0;border-radius:var(--rsm);font-size:.9rem;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.pm .pri{background:var(--a);color:var(--afg);}
.pm .ghost{background:transparent;color:var(--tx);box-shadow:inset 0 0 0 1px var(--dv);}
.pm button:disabled{opacity:.5;cursor:default;}
.al{display:flex;flex-direction:column;gap:12px;width:360px;max-width:100%;padding:14px;border:3px solid var(--a);border-radius:var(--rad);background:color-mix(in srgb,var(--a) 9%,var(--bg));color:var(--tx);box-shadow:0 14px 40px color-mix(in srgb,var(--tx) 26%,transparent);animation:pp-alert 1.6s ease-out infinite;}
.al[hidden]{display:none;}
.al-r{display:flex;align-items:center;gap:12px;}
.al-i{flex:none;display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:50%;background:var(--bg);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--a) 35%,transparent);font-size:1.7rem;line-height:1;animation:pp-bell 1.4s ease-in-out infinite;transform-origin:50% 20%;}
.al-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.al-ti{font-size:1.12rem;font-weight:800;line-height:1.25;overflow-wrap:anywhere;}
.al-su{font-size:.95rem;line-height:1.35;color:var(--tx2);overflow-wrap:anywhere;}
.al-hi{font-size:.82rem;line-height:1.3;color:var(--tx2);}
.al-su:empty,.al-hi:empty{display:none;}
.al-b{min-height:58px;padding:0 16px;border:0;border-radius:var(--rsm);background:var(--a);color:var(--afg);font-size:1.2rem;font-weight:800;letter-spacing:.02em;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.al-b:active{transform:scale(.98);}
.al.quiet,.al.quiet .al-i{animation:none;}

@media (prefers-reduced-motion:reduce){
  .dots i,.go.rec,.al,.al-i{animation:none !important;}
  .panel,.go,.sw,.sw .kn,.stk,.veil{transition:none !important;}
}
`;

// Kopie der Figur für den Platz in der Kinder-Leiste der Baby-Karte (Handy). Sie ist ein echtes Kind des Platzes (.fo-pipslot) und läuft deshalb mit der
// klebenden Leiste mit, auch wenn iOS sie im Compositor bewegt und beim Ausrollen oder Nachfedern keine scroll-Ereignisse liefert. Das Dock hängt sie
// ein und aus und spiegelt Klassen und Theme-Werte der festen Figur auf sie (_copySync); ein Tipp darauf wirkt wie ein Tipp auf die feste Figur.
// Der Name leitet sich vom Dock ab ("fp-pip-dock-slotfig", in der Beta "fp-pip-dock-beta-slotfig"), damit Prod- und Beta-Datei sich nicht stören.
const SLOTFIG_TAG = TAG + "-slotfig";
class FpPipSlotFig extends HTMLElement {
  constructor() {
    super();
    const r = this.attachShadow({ mode: "open" });
    r.innerHTML = `<style>${FIG_CSS}
:host{display:block;flex:none;width:100%;height:100%;pointer-events:auto;}
:host([hidden]){display:none !important;}
.fig{position:relative;display:block;width:100%;height:100%;transition:opacity .2s ease,transform .2s ease;}
</style><button class="fig" type="button">${PIP}<span class="ear" aria-hidden="true"></span></button>`;
    this.btn = r.querySelector(".fig");
    this.pip = r.querySelector(".pip");
  }
  focus(o) { this.btn.focus(o); }
}
if (!customElements.get(SLOTFIG_TAG)) customElements.define(SLOTFIG_TAG, FpPipSlotFig);

class FpPipDock extends HTMLElement {
  constructor() {
    super();
    this._cfg = normCfg({});
    this._cfgSig = "";
    this._items = [];
    this._seq = 0;
    this._cur = null;          // laufende Anfrage
    this._st = "idle";
    this._speaking = false;
    this._auto = false;        // nach dem Vorlesen automatisch weiter zuhören
    this._convId = null;
    this._convAt = 0;
    this._ansAt = 0;           // Ende der letzten Antwort (für fremde Karten-Ereignisse)
    this._isOpen = false;
    this._visible = false;
    this._evConn = null;
    this._evUnsub = null;
    this._noteHttps = false;
    this._unlocked = false;
    this._a = null;
    // Seite: linker Rand des Inhaltsbereichs beobachten (nur bei position: left)
    this._edgeEl = null;
    this._edgeRO = null;
    this._edgeRaf = 0;
    this._edgeT = null;
    this._edgeTry = 0;
    this._dockedSig = "";
    // Aktivierungswort
    this._wakeOn = false;      // Schalter an diesem Gerät
    this._wk = { st: "off", why: "" };   // off | load | wait (Tipp nötig) | on | err
    this._eng = null;          // Erkennung (WakeEngine)
    this._wm = null;           // offenes Mikrofon fürs Weckwort: { ctx, stream, W, run, live }
    this._wkTok = 0;
    this._wkLoading = false;
    this._wkHold = false;      // zwischen Erkennung und Start der Aufnahme
    this._wkWas = false;
    this._wkQuiet = 0;
    this._wkArmed = false;
    this._wkTry = 0;
    this._wkRetry = null;
    this._wkIdleT = null;
    this._mp = null;           // Mikrofon-Pause (mic_pause): { ctx } = Weckwort-Mikrofon ist zu, der (schlafende) AudioContext bleibt für das Wiederöffnen
    this._mpT = null;          // Zeitgeber fürs Wiederöffnen (nach dem Ton plus WAKE_QUIET)
    this._preOpen = null;      // Rückfrage wird vorgelesen und das Weckwort-Mikrofon ist schon wieder auf (PRE_OPEN_MS vor dem Ende): { run }; hält _micHold() auf false
    this._preT = null;         // Zeitgeber, der kurz vor dem Vor-Öffnen nachsieht (_preCheck)
    this._preLen = 0;          // Zeichen der Antwort, die als Rückfrage vorgelesen wird (Schätzung der Dauer, falls der Ton seine Länge nicht verrät)
    this._wkOpening = null;    // laufendes Öffnen des Weckwort-Mikrofons
    this._wkResume = false;    // ... und zwar das Wiederöffnen nach einer Pause
    this._wakeOpened = false;  // Fenster wurde vom Weckwort geöffnet
    this._scrWake = false;     // Gespräch per Aktivierungswort begonnen (bis zum Schließen oder "Neu"): wake_screen hält den Bildschirm wach
    this._scrAt = 0;           // Zeit des letzten Drucks auf wake_screen (Drosselung, SCR_GAP)
    this._stg = null;          // Bühne (stage) läuft: { t: Zeitgeber fürs Ende }
    this._stgOut = null;       // Zeitgeber: nach dem Rückweg die Bühnen-Klassen von Figur und Fenster nehmen
    this._stgRz = () => this._stageLay();   // Größe oder Ausrichtung geändert: Ziel der Figur neu messen
    this._wl = null;           // wake_log: offener Eintrag zur letzten Erkennung { wert, bloecke, run, timer }, bis feststeht, was danach kam
    this._wlEp = null;         // wake_log: laufende Episode mit Werten ab WAKE_LOG_MIN { max, n, t, skip }
    this._wlKn = [];           // wake_log: Zeiten der letzten Knapp-Einträge (Drosselung)
    this._clBuf = null;        // wake_clip: Ringpuffer der letzten WAKE_CLIP_PRE Sekunden { b: Int16Array, w: Schreibzeiger, n: gefüllt }; nur mit wake_clip, nur bei offenem Mikrofon
    this._cl = null;           // wake_clip: offener Clip { pre, post, pn, wert, bloecke, ep, t, art, folge, acc, rej, run, timer }, bis er geschickt ist
    this._clKn = [];           // wake_clip: Zeiten der letzten Clips (Drosselung)
    // Timer, Wecker, Erinnerungen und Klingeln (alarms)
    this._alT = null;          // Takt für Countdown und Vorschau (setTimeout)
    this._alIds = [];          // alle Entitäten aus alarms
    this._alRefs = null;       // ihre Zustände beim letzten Durchlauf: unverändert -> nichts zu rechnen
    this._alItems = [];        // Pillen: laufende Timer, Wecker und Erinnerungen der nächsten Stunden
    this._alSig = "";
    this._pmKey = "";          // Pille mit offenem Menü
    this._pmBusy = "";         // Pille, deren Dienst gerade läuft
    this._plAll = false;       // alle Pillen statt der ersten drei
    this._klRaw = null;        // zuletzt gelesenes Klingel-Signal
    this._ring = null;         // laufendes Klingeln: { art, text, t, key, begin, until, silent, mute, over, wait, tone, ann, timer }
    this._ringOn = true;       // Schalter "An diesem Gerät klingeln"
    this._rc = null;           // eigener AudioContext fürs Klingeln; schläft, solange nichts klingt
    this._rcOk = false;        // per Tipp freigeschaltet
    this._rcArmed = false;
    this._annc = null;         // Ansage des Klingelns, die gerade über das Audio-Element läuft
    this._strm = null;         // früh gestartete Sprachausgabe (Home Assistant streamt): { run, ann, url, token, st: wait|play|end|fail|stop, tts }
    this._playTok = 0;         // zählt die Wiedergaben: ein spätes Scheitern einer abgelösten Wiedergabe zählt nicht
    this._rcGest = () => this._unlockAudio();
    this._kd = e => { if (e.key === "Escape") this._close(); };
    this._vv = () => this._onViewport();
    this._wkGest = () => this._wakeKick();
    // Platz in der Kinder-Leiste der Baby-Karte (window.__fpPipSlots, nur Handy)
    this._slotEl = null;       // Platz, in dem die Kopie der Figur gerade steckt
    this._slotRO = null;       // beobachtet seine Größe
    this._copy = null;         // Kopie der Figur (fp-pip-dock-slotfig), genau eine; nur im Platz eingehängt
    this._copyMO = null;       // spiegelt Klassen und Beschriftung der festen Figur auf die Kopie
    this._copyMH = null;       // spiegelt Theme-Werte und Dunkelmodus des Docks auf die Kopie
    this._slotRaf = 0;
    this._slotSig = "";
    this._slotPath = "";       // Seite (location.pathname), auf der zuletzt ein Platz da war
    this._slotLost = 0;        // Zeitpunkt (performance.now), seit dem der Platz fehlt; 0 = nicht in der Wartezeit
    this._slotWaitT = 0;       // Zeitgeber, der während der Wartezeit regelmäßig neu prüft und sie beendet
    this._slotRun = () => { this._slotRaf = 0; this._slotApply(); };
    this._slotCb = () => this._slotSched();
    this.attachShadow({ mode: "open" });
    this._build();
    document.addEventListener("visibilitychange", () => this._wakeSync());
    // Nachführen: Platz gemeldet oder weg, Fenster gedreht oder verändert, Inhalt gescrollt (HA scrollt in einem inneren Element, daher capture).
    // Die Handler kehren sofort zurück, solange kein Platz gemeldet ist.
    window.addEventListener("fp-pip-slot", this._slotCb);
    window.addEventListener("resize", this._slotCb);
    window.addEventListener("orientationchange", this._slotCb);
    window.addEventListener("scroll", this._slotCb, { passive: true, capture: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", this._slotCb);
      window.visualViewport.addEventListener("scroll", this._slotCb);
    }
  }

  // ---------- Aufbau ----------
  _build() {
    const r = this.shadowRoot;
    r.innerHTML = `<style>${CSS}</style>
<div class="veil" aria-hidden="true"></div>
<span class="anc" aria-hidden="true"></span>
<button class="fig" type="button" aria-label="Pip öffnen">${PIP}<span class="ear" aria-hidden="true"></span></button>
<div class="stk">
  <div class="al" role="alert" hidden>
    <div class="al-r"><span class="al-i" aria-hidden="true"></span><div class="al-t"><b class="al-ti"></b><span class="al-su"></span></div></div>
    <span class="al-hi" role="status"></span>
    <button class="al-b" type="button" data-a="ring">Stopp</button>
  </div>
  <div class="pls"></div>
</div>
<section class="panel" role="dialog" aria-label="Pip">
  <button class="ib sx" type="button" aria-label="Schließen" title="Schließen">✕</button>
  <header class="head">${PIP.replace('class="pip st-idle"', 'class="pip mini st-idle"')}
    <div class="who"><b class="nm">Pip</b><span class="stt" role="status">Bereit</span></div>
    <button class="ib" type="button" data-a="new" aria-label="Neues Gespräch" title="Neues Gespräch">↺</button>
    <button class="ib" type="button" data-a="close" aria-label="Schließen" title="Schließen">✕</button>
  </header>
  <div class="wk" hidden><div class="wk-t"><span class="wk-l"></span><span class="wk-h" role="status"></span></div><button class="sw" type="button" role="switch" aria-checked="false"><span class="kn"></span></button></div>
  <div class="wk rg" hidden><div class="wk-t"><span class="wk-l">An diesem Gerät klingeln</span><span class="wk-h" role="status"></span></div><button class="sw" type="button" role="switch" aria-checked="true" aria-label="An diesem Gerät klingeln"><span class="kn"></span></button></div>
  <div class="log" role="log" aria-live="polite"></div>
  <div class="chips"></div>
  <div class="bar"><input class="in" type="text" autocomplete="off" enterkeyhint="send" aria-label="Nachricht"><button class="go" type="button" data-m=""></button></div>
</section>`;
    this._fig = r.querySelector(".fig");
    this._anc = r.querySelector(".anc");
    this._veil = r.querySelector(".veil");
    this._panel = r.querySelector(".panel");
    this._log = r.querySelector(".log");
    this._chips = r.querySelector(".chips");
    this._in = r.querySelector(".in");
    this._go = r.querySelector(".go");
    this._nm = r.querySelector(".nm");
    this._stt = r.querySelector(".stt");
    this._wkRow = r.querySelector(".wk");
    this._wkLbl = r.querySelector(".wk-l");
    this._wkHint = r.querySelector(".wk-h");
    this._wkSw = r.querySelector(".sw");
    this._pips = Array.from(r.querySelectorAll(".pip"));
    this._stk = r.querySelector(".stk");
    this._pls = r.querySelector(".pls");
    this._al = r.querySelector(".al");
    this._alI = r.querySelector(".al-i");
    this._alTi = r.querySelector(".al-ti");
    this._alSu = r.querySelector(".al-su");
    this._alHi = r.querySelector(".al-hi");
    this._rgRow = r.querySelector(".rg");
    this._rgHint = r.querySelector(".rg .wk-h");
    this._rgSw = r.querySelector(".rg .sw");
    this._fig.addEventListener("click", () => this._figTap());
    r.querySelector(".sx").addEventListener("click", () => this._close());
    this._veil.addEventListener("click", () => this._close());
    this._stk.addEventListener("click", e => this._onStk(e));
    r.querySelector(".head").addEventListener("click", e => {
      const b = e.target.closest ? e.target.closest("[data-a]") : null;
      if (!b) return;
      if (b.dataset.a === "close") this._close(); else if (b.dataset.a === "new") this._reset();
    });
    this._log.addEventListener("click", e => this._onLogClick(e));
    this._chips.addEventListener("click", e => {
      const b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b || b.disabled) return;
      const s = this._cfg.suggestions[+b.dataset.i];
      if (s) this._send(s.text);
    });
    this._in.addEventListener("input", () => this._syncBtn());
    this._in.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); this._sendInput(); }
    });
    this._go.addEventListener("click", () => this._onGo());
    this._wkSw.addEventListener("click", () => this._wakeToggle());
    this._rgSw.addEventListener("click", () => this._ringToggle());
    // Wer das Fenster anfasst, will es behalten: dann schließt es sich nach einer Weckwort-Frage nicht von selbst, und die Bühne bleibt
    // STAGE_IDLE stehen. Ein begonnener Text hält sie, solange er im Feld steht (siehe _stageArm).
    this._panel.addEventListener("pointerdown", () => { this._wakeTouched(); this._stageArm(STAGE_IDLE); });
    this._in.addEventListener("input", () => { this._wakeTouched(); this._stageArm(STAGE_IDLE); });
    this._renderChips();
    this._renderLog();
    this._syncBtn();
  }

  configure(cfg) {
    const sig = JSON.stringify(cfg);
    if (sig === this._cfgSig) return;
    const prev = this._cfg;
    this._cfgSig = sig;
    this._cfg = cfg;
    if (prev && prev.pipeline_id !== cfg.pipeline_id) this._convId = null;
    this._nm.textContent = cfg.name;
    this._in.placeholder = `Frag ${cfg.name} …`;
    this._fig.setAttribute("aria-label", `${cfg.name} öffnen`);
    this._panel.setAttribute("aria-label", cfg.name);
    this._renderChips();
    this._applyBusy();
    if (!cfg.stage) this._stageEnd();
    // Aktivierungswort: neue Einstellung -> alte Erkennung weg, Schalter dieses Geräts neu lesen
    if (!prev || JSON.stringify(prev.wake_word) !== JSON.stringify(cfg.wake_word)) {
      this._wakeOff();
      if (this._eng) { this._eng.dispose(); this._eng = null; }
      this._wakeSet("off");
    }
    this._wakeOn = !!cfg.wake_word && this._wakeLoad();
    this._wakeRender();
    this._wakeSync();
    this._alCfg();
    this._darkSync();
    this._slotSched();
  }

  setVisible(v) {
    v = !!v;
    if (v === this._visible) return;
    this._visible = v;
    this.hidden = !v;
    if (v) { this._subs(); this._wakeSync(); this._alStart(); this._darkSync(); this._slotSched(); } else this._teardown();
  }
  // Dunkles Theme? Die Klasse dk am Host färbt die Kugel kräftiger (:host(.dk) im CSS)
  _darkSync() {
    const h = getHass();
    this.classList.toggle("dk", !!(h && h.themes && h.themes.darkMode));
  }
  hassUpdated() {
    this._darkSync();
    if (!this._visible) return;
    this._subs();
    if (this._cfg.alarms) this._alSync(false);
    if (this._cfg.position === "left") {
      // Seitenleiste ein- oder ausgeklappt? Dann nach der Animation neu messen.
      const h = getHass(), ds = String(h && h.dockedSidebar);
      if (ds !== this._dockedSig) {
        this._dockedSig = ds;
        setTimeout(() => this.applyPos(), 80);
        setTimeout(() => this.applyPos(), 500);
      }
    }
  }
  // Figur über eine klebende Aktionsleiste heben (nur schmale Fenster, nur für Seiten aus `lift`).
  applyLift() {
    let px = 0;
    try {
      if (window.innerWidth < 700) {
        const last = location.pathname.split("/").filter(Boolean).pop();
        const L = this._cfg.lift;
        if (last && L && Object.prototype.hasOwnProperty.call(L, last) && L[last] > 0) px = L[last];
      }
    } catch (e) {}
    this._fig.style.setProperty("--lift", px + "px");
    this._stk.style.setProperty("--lift", px + "px");
    this._anc.style.setProperty("--lift", px + "px");
    this._slotSched();
  }
  // Figur und Fenster auf die gewählte Seite setzen. Links sitzen sie am Rand des Inhaltsbereichs, nicht über der HA-Seitenleiste.
  applyPos() {
    const left = this._cfg.position === "left";
    this._fig.classList.toggle("left", left);
    this._anc.classList.toggle("left", left);
    this._stk.classList.toggle("left", left);
    this._panel.classList.toggle("left", left);
    this._slotSched();
    clearTimeout(this._edgeT);
    if (!left) { this._edgeWatch(null); this._edgeTry = 0; this.style.removeProperty("--gx"); return; }
    const e = contentEdge();
    this.style.setProperty("--gx", e.x + "px");
    this._edgeWatch(e.el);
    // Home Assistant noch nicht aufgebaut (Seite direkt neu geladen)? Dann eine Weile später noch einmal messen.
    if (e.el) this._edgeTry = 0;
    else if (this._edgeTry++ < 24) this._edgeT = setTimeout(() => this.applyPos(), 500);
  }
  _edgeWatch(el) {
    if (el === this._edgeEl) return;
    if (this._edgeRO) { try { this._edgeRO.disconnect(); } catch (e) {} this._edgeRO = null; }
    this._edgeEl = el;
    if (!el || typeof ResizeObserver !== "function") return;
    // Die Seitenleiste ändert die Breite des Panels: daran merkt man das Ein- und Ausklappen.
    this._edgeRO = new ResizeObserver(() => {
      if (this._edgeRaf) return;
      this._edgeRaf = requestAnimationFrame(() => { this._edgeRaf = 0; this.applyPos(); });
    });
    this._edgeRO.observe(el);
  }

  // ---------- Platz in der Kinder-Leiste ----------
  // Am Handy (Fenster < 700 px) meldet die Baby-Karte mit kids_dock und dock_gap > 0 einen unsichtbaren Platz (52 × 52) in window.__fpPipSlots.
  // Gibt es ein sichtbares Element, hängt sich eine Kopie der Figur (fp-pip-dock-slotfig) als Kind hinein und die feste Figur wird unsichtbar: die Kopie ist Teil der
  // Leiste und bewegt sich mit ihr, ohne dass ein Skript sie nachführen muss (iOS liefert beim Ausrollen und Nachfedern keine scroll-Ereignisse). Anker und Pillen
  // sitzen mit festen px-Werten aus dem Rechteck des Platzes darüber; sonst bleibt alles wie bisher in der Ecke (mit lift).
  // Die Bühne (ab 700 px) und das Gesprächsfenster sind davon unberührt.
  _slotSched() {
    if (this._slotRaf) return;
    const S = window.__fpPipSlots;
    if (!this._slotEl && !(S && S.size)) return;   // nichts gemeldet und nichts zu räumen: keine Arbeit
    this._slotRaf = requestAnimationFrame(this._slotRun);
  }
  _slotFind() {
    const S = window.__fpPipSlots;
    if (!S || !S.size || window.innerWidth >= 700) return null;
    for (const el of S) {
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (r.width > 0 && r.height > 0 && cx > 0 && cx < window.innerWidth && cy > 0 && cy < window.innerHeight) return { el, r };
    }
    return null;
  }
  _slotApply() {
    const f = this._visible ? this._slotFind() : null;
    if (!f) { if (!this._slotHold()) this._slotOff(); return; }
    this._slotLost = 0;   // Platz da (wieder): Wartezeit zu Ende
    if (this._slotWaitT) { clearTimeout(this._slotWaitT); this._slotWaitT = 0; }
    const { el, r } = f, left = this._cfg.position === "left";
    if (el !== this._slotEl) {
      this._slotPath = location.pathname;   // Seite merken, wenn ein (neuer) Platz übernommen wird; nicht bei jedem Lauf, sonst ginge ein Seitenwechsel verloren, solange die alte Karte noch im DOM steht
      if (this._slotRO) { try { this._slotRO.disconnect(); } catch (e) {} this._slotRO = null; }
      this._slotEl = el;
      if (typeof ResizeObserver === "function") { this._slotRO = new ResizeObserver(this._slotCb); this._slotRO.observe(el); }
    }
    this._copyPlace(el);   // die Figur selbst: als Kopie im Platz, ohne Skript-Nachführen
    const q = v => Math.round(v * 100) / 100;
    const sig = [q(r.left), q(r.top), q(r.width), q(r.right), left].join("|");
    if (sig === this._slotSig) return;
    this._slotSig = sig;
    this.style.setProperty("--sl", q(r.left) + "px");
    this.style.setProperty("--st", q(r.top) + "px");
    this.style.setProperty("--sz", q(r.width) + "px");
    this.style.setProperty("--sr", q(r.right) + "px");
    for (const e of [this._anc, this._stk]) e.classList.add("slot");   // Anker und Pillen folgen dem Rechteck des Platzes
    this._stk.classList.toggle("rt", !left);
  }
  // Platz weg, obwohl vorher einer da war: Baut Home Assistant die Karten neu auf (Herunterziehen zum Aktualisieren), wird die alte Baby-Karte getrennt und die neue meldet
  // kurz darauf einen neuen Platz. In der Lücke bleibt die feste Figur unsichtbar (inslot), Anker und Pillen behalten ihre letzten Werte; kommt der Platz (fp-pip-slot, oder die
  // regelmäßige Prüfung hier), zieht die Kopie dort ein. Ohne Platz nach SLOT_WAIT gilt wie bisher _slotOff (feste Figur in der Ecke).
  // Auch ein Dock, das in der Lücke kurz unsichtbar und wieder sichtbar wird (setVisible(false), dann (true) beim Neuanlegen der unsichtbaren Karte), verkürzt die Wartezeit nicht:
  // _teardown räumt den Platz nicht mehr sofort, sondern lässt ihn über diese Wartezeit auslaufen; die feste Figur bleibt als .inslot unsichtbar.
  // Sofort aus (false): Platz war nie da, Seite gewechselt, Fenster ab 700 px.
  _slotHold() {
    if (!this._slotEl || window.innerWidth >= 700 || location.pathname !== this._slotPath) return false;
    const now = performance.now();
    if (!this._slotLost) this._slotLost = now;
    const rest = SLOT_WAIT - (now - this._slotLost);
    if (rest <= 0) return false;
    if (this._slotWaitT) clearTimeout(this._slotWaitT);
    this._slotWaitT = setTimeout(() => { this._slotWaitT = 0; this._slotApply(); }, Math.max(1, Math.min(100, Math.ceil(rest))));
    return true;
  }
  _slotOff() {
    if (this._slotWaitT) { clearTimeout(this._slotWaitT); this._slotWaitT = 0; }
    this._slotLost = 0;
    this._slotPath = "";
    if (this._slotRO) { try { this._slotRO.disconnect(); } catch (e) {} this._slotRO = null; }
    this._copyOff();
    if (!this._slotEl && !this._slotSig) return;
    this._slotEl = null;
    this._slotSig = "";
    for (const e of [this._anc, this._stk]) e.classList.remove("slot");
    this._stk.classList.remove("rt");
    for (const v of ["--sl", "--st", "--sz", "--sr"]) this.style.removeProperty(v);
  }
  // Kopie der Figur in den Platz hängen (oder in den neuen Platz, wenn die Leiste neu gezeichnet wurde; es gibt nie zwei Kopien) und die feste Figur ausblenden.
  _copyPlace(el) {
    let c = this._copy;
    if (!c) c = this._copy = document.createElement(SLOTFIG_TAG);
    if (c.parentNode !== el) {
      el.appendChild(c);
      c.addEventListener("click", this._copyTap || (this._copyTap = () => this._figTap()));
    }
    if (!this._copyMO && typeof MutationObserver === "function") {
      const cb = () => this._copySync();
      this._copyMO = new MutationObserver(cb);
      this._copyMO.observe(this._fig, { attributes: true, attributeFilter: ["class", "aria-label", "title"], subtree: true });
      this._copyMH = new MutationObserver(cb);
      this._copyMH.observe(this, { attributes: true, attributeFilter: ["class", "style"] });
    }
    this._fig.classList.add("inslot");
    this._fig.setAttribute("tabindex", "-1");
    this._fig.setAttribute("aria-hidden", "true");
    this._copySync();
  }
  // Kopie wieder aus dem Platz nehmen; die feste Figur steht sofort wieder in der Ecke (mit lift).
  _copyOff() {
    if (this._copyMO) { this._copyMO.disconnect(); this._copyMO = null; }
    if (this._copyMH) { this._copyMH.disconnect(); this._copyMH = null; }
    if (this._copy && this._copy.parentNode) this._copy.remove();
    if (this._fig.classList.contains("inslot")) {
      this._fig.classList.remove("inslot");
      this._fig.removeAttribute("tabindex");
      this._fig.removeAttribute("aria-hidden");
    }
  }
  // Alles, was die feste Figur an Klassen (Zustand, wk-on, wk-wait, ringing, gone), Beschriftung, Dunkelmodus und Theme-Werten hat, bekommt die Kopie auch.
  _copySync() {
    const c = this._copy;
    if (!c || !c.parentNode) return;
    const cls = Array.from(this._fig.classList).filter(n => n !== "slot" && n !== "inslot" && n !== "left" && n !== "stg" && n !== "stage").concat("fig").join(" ");
    if (c.btn.className !== cls) c.btn.className = cls;
    const pc = this._fig.querySelector(".pip").className;
    if (c.pip.className !== pc) c.pip.className = pc;
    for (const a of ["aria-label", "title"]) {
      const v = this._fig.getAttribute(a);
      if (v === null) c.btn.removeAttribute(a); else if (c.btn.getAttribute(a) !== v) c.btn.setAttribute(a, v);
    }
    c.classList.toggle("dk", this.classList.contains("dk"));
    for (const v of THEME_VARS) {
      const val = this.style.getPropertyValue(v);
      if (val) { if (c.style.getPropertyValue(v) !== val) c.style.setProperty(v, val); } else if (c.style.getPropertyValue(v)) c.style.removeProperty(v);
    }
  }

  // Tipp auf die Figur (die feste oder ihre Kopie im Platz): ebenfalls Bühne (falls stage und breit genug); vor _openPanel, damit die Figur nicht mit .gone verschwindet.
  // Passiert danach nichts, geht die Bühne nach STAGE_IDLE von selbst zu.
  _figTap() {
    if (!this._isOpen) { this._stageBegin(); this._openPanel(); this._stageArm(STAGE_IDLE); } else this._openPanel();
  }

  // Verstecken: Panel zu, Mikrofon und Ton aus, Karten-Abo beenden. Das Gespräch bleibt im Speicher.
  _teardown() {
    this._slotApply();   // unsichtbar: kein Platz mehr gesucht; läuft die Wartezeit nicht, wird sofort geräumt, sonst nach SLOT_WAIT (siehe _slotHold)
    this._close();
    this._unsubEvents();
    this._wakeOff();
    this._alStop();
  }

  _renderChips() {
    this._chips.innerHTML = this._cfg.suggestions.map((s, i) =>
      `<button class="chip" type="button" data-i="${i}">${s.icon ? `<span aria-hidden="true">${U.esc(s.icon)}</span>` : ""}<span>${U.esc(s.text)}</span></button>`).join("");
  }

  // ---------- Panel ----------
  _micOk() {
    return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      && (window.AudioContext || window.webkitAudioContext));
  }
  _openPanel() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._unlockAudio();
    if (lastCard && lastCard.isConnected) copyTheme(lastCard);
    this._subs();
    this._panel.classList.add("open");
    this._stk.classList.add("open");
    if (!this._stg) this._fig.classList.add("gone");   // auf der Bühne bleibt die große Figur zu sehen
    document.addEventListener("keydown", this._kd);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", this._vv);
      window.visualViewport.addEventListener("scroll", this._vv);
      this._onViewport();
    }
    if (!this._micOk() && !this._noteHttps) {
      this._noteHttps = true;
      this._push({ k: "note", text: "Das Mikrofon geht nur über eine sichere Verbindung (https). Du kannst mir schreiben." });
    }
    this._renderLog(true);
    this._syncBtn();
    this._setState(this._st);
    try {
      if (window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches) this._in.focus({ preventScroll: true });
    } catch (e) {}
  }
  _close() {
    const wasOpen = this._isOpen;
    this._isOpen = false;
    this._abortMedia();
    this._wakeTouched();
    this._scrWake = false;
    this._stageEnd();
    this._wlEnd("abbruch", "");   // Erkennung ohne Lauf (Fenster zu, bevor zugehört wurde)
    if (!wasOpen) return;
    this._panel.classList.remove("open");
    this._stk.classList.remove("open");
    this._fig.classList.remove("gone");
    document.removeEventListener("keydown", this._kd);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this._vv);
      window.visualViewport.removeEventListener("scroll", this._vv);
    }
    if (this.shadowRoot.activeElement && this._panel.contains(this.shadowRoot.activeElement)) {
      try { (this._copy && this._copy.isConnected ? this._copy : this._fig).focus({ preventScroll: true }); } catch (e) {}
    }
  }
  // Am Handy schiebt die Bildschirmtastatur das Blatt nach oben und kürzt es.
  _onViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
    this._panel.style.setProperty("--kb", (kb > 80 ? kb : 0) + "px");
    this._panel.style.setProperty("--vvh", Math.round(vv.height) + "px");
  }
  _abortMedia() {
    this._auto = false;
    const run = this._cur;
    if (run && run.voice) this._cancelRun(run);
    this._stopAudio();
  }
  _setState(s) {
    this._st = s;
    for (const p of this._pips) {
      p.classList.remove("st-idle", "st-listen", "st-think", "st-speak");
      p.classList.add("st-" + s);
    }
    if (this._stt) this._stt.textContent = STATUS[s] || "";
  }

  // ---------- Verlauf ----------
  _push(it) {
    it.id = ++this._seq;
    this._items.push(it);
    while (this._items.length > 40) {
      const o = this._items.shift();
      if (o.timer) clearTimeout(o.timer);
    }
    return it;
  }
  _remove(it) {
    if (!it) return;
    const i = this._items.indexOf(it);
    if (i >= 0) this._items.splice(i, 1);
    if (it.timer) clearTimeout(it.timer);
  }
  _note(text) { this._push({ k: "note", text }); this._renderLog(true); }
  _micFail() { this._note("Das Mikrofon ist hier nicht verfügbar. Du kannst mir schreiben."); }
  _ensureAi(run) {
    if (!run.ai) run.ai = this._push({ k: "ai", text: "", pending: true });
    return run.ai;
  }
  _renderLog(stick) {
    const log = this._log;
    if (!log) return;
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    log.innerHTML = this._logHTML();
    if (stick || near) log.scrollTop = log.scrollHeight;
  }
  _logHTML() {
    const esc = U.esc;
    let h = "";
    if (!this._items.some(i => i.k !== "note")) h += `<div class="hello">Hallo! Frag mich zu Terminen, Essen, Einkauf oder den Zwillingen.</div>`;
    for (const it of this._items) {
      if (it.k === "me") h += `<div class="me">${esc(it.text)}</div>`;
      else if (it.k === "ai") {
        if (it.text) h += `<div class="ai">${esc(it.text)}</div>`;
        else if (it.pending) h += `<div class="dots" role="img" aria-label="${esc(this._cfg.name)} denkt nach"><i></i><i></i><i></i></div>`;
      } else if (it.k === "note") h += `<div class="note">${esc(it.text)}</div>`;
      else if (it.k === "card") h += this._cardHTML(it);
    }
    return h;
  }
  _cardHTML(it) {
    const esc = U.esc;
    let h = `<div class="ac">`;
    if (it.titel) h += `<div class="ac-t">${esc(it.titel)}</div>`;
    for (const z of it.zeilen) h += `<div class="ac-r"><b>${esc(z[0])}</b>${z[1] !== "" ? `<span>${esc(z[1])}</span>` : ""}</div>`;
    const id = ` data-id="${it.id}"`;
    let f = "";
    if (it.st === "open") f = `<button class="ghost" type="button" data-act="undo"${id}>Rückgängig</button>`;
    else if (it.st === "undoing") f = `<span class="ac-s">Wird rückgängig gemacht …</span>`;
    else if (it.st === "done") f = `<span class="ac-s">✓ erledigt</span>`;
    else if (it.st === "undone") f = `<span class="ac-s">Rückgängig gemacht</span>`;
    else if (it.st === "undofail") f = `<span class="ac-s">Rückgängig hat nicht geklappt</span>`;
    else if (it.st === "ask") {
      const dis = this._cur ? " disabled" : "";
      f = `<button class="pri" type="button" data-act="yes"${id}${dis}>Ja, mach das</button><button class="ghost" type="button" data-act="no"${id}${dis}>Abbrechen</button>`;
    }
    if (f) h += `<div class="ac-f">${f}</div>`;
    return h + `</div>`;
  }
  _onLogClick(e) {
    const b = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!b || b.disabled) return;
    const it = this._items.find(x => x.id === +b.dataset.id);
    if (!it) return;
    const act = b.dataset.act;
    if (act === "undo" && it.st === "open") this._undo(it);
    else if ((act === "yes" || act === "no") && it.st === "ask") {
      if (this._cur) return;
      it.st = "answered";
      this._renderLog();
      this._send(act === "yes" ? "Ja" : "Nein");
    }
  }

  // ---------- Bedienelemente ----------
  _applyBusy() {
    const busy = !!this._cur;
    for (const b of this._chips.querySelectorAll(".chip")) b.disabled = busy;
    for (const b of this._log.querySelectorAll('button[data-act="yes"],button[data-act="no"]')) b.disabled = busy;
    this._syncBtn();
  }
  _syncBtn() {
    const run = this._cur;
    const recording = !!(run && run.rec && !run.rec.stopped);
    const has = !!this._in.value.trim();
    const mode = recording ? "stop" : (!has && this._micOk()) ? "mic" : "send";
    const dis = mode === "stop" ? false : (!!run || (mode === "send" && !has));
    if (this._go.dataset.m !== mode) {
      this._go.dataset.m = mode;
      this._go.innerHTML = ICON[mode];
      this._go.setAttribute("aria-label", GO_LABEL[mode]);
      this._go.title = GO_LABEL[mode];
    }
    this._go.disabled = dis;
    this._go.classList.toggle("rec", recording);
  }
  _onGo() {
    const m = this._go.dataset.m;
    if (m === "stop") this._stopRec(this._cur);
    else if (m === "mic") this._listen(false);
    else this._sendInput();
  }
  _sendInput() {
    const t = this._in.value.trim();
    if (!t || this._cur) return;
    this._in.value = "";
    this._syncBtn();
    this._send(t);
  }

  // ---------- Ton ----------
  _aud() {
    if (this._a) return this._a;
    const a = this._a = new Audio();
    a.preload = "auto";
    a.addEventListener("ended", () => this._audioDone(false));
    a.addEventListener("error", () => this._audioDone(true));
    a.addEventListener("playing", () => this._audioPlaying());
    // Rückfrage: Länge und Stand des Vorlesens verfolgen (Vor-Öffnen des Mikrofons, _preCheck)
    for (const ev of ["timeupdate", "durationchange", "loadedmetadata", "progress", "suspend"]) a.addEventListener(ev, () => this._preCheck());
    return a;
  }
  // iOS: Das Audio-Element muss einmal per Tipp gestartet worden sein, sonst bleibt spätere Wiedergabe stumm.
  _unlockAudio() {
    this._rcUnlock();
    if (this._unlocked || !SILENT || (this._speaking && this._strm)) return;   // während eines früh gestarteten (auch noch wartenden) Streams die Quelle nicht anfassen
    this._unlocked = true;
    try {
      const a = this._aud();
      a.src = SILENT;
      const p = a.play();
      if (p && p.then) p.then(() => { if (a.src === SILENT) a.pause(); }, () => { this._unlocked = false; });
    } catch (e) { this._unlocked = false; }
  }
  // ann: Ansage des Klingelns (kein Gespräch: danach wird nicht zugehört)
  // str: früh gestarteter Stream (siehe _streamBegin): Die Anzeige "Spricht" folgt erst, wenn Ton da ist.
  _play(url, ann, str) {
    const hass = getHass();
    let src = url;
    try { if (hass && hass.hassUrl) src = hass.hassUrl(url); } catch (e) {}
    const a = this._aud();
    const tok = ++this._playTok;
    this._speaking = true;
    this._annc = ann || null;
    this._strm = str || null;
    this._preClear();   // ein neuer Ton: das vorab geöffnete Mikrofon (falls eines) gehörte zum alten
    this._micSync();   // zuerst das Mikrofon frei geben (iOS in den reinen Wiedergabemodus), dann abspielen
    a.src = src;
    if (!str) this._setState("speak");
    try {
      const p = a.play();
      if (p && p.catch) p.catch(() => { if (tok === this._playTok) this._audioDone(true); });
    } catch (e) { this._audioDone(true); }
  }
  _audioDone(failed) {
    if (!this._speaking) return;
    this._speaking = false;
    const s = this._strm;
    this._strm = null;
    if (s) { s.st = failed ? "fail" : "end"; clearTimeout(s.timer); }
    const ann = this._annc;
    this._annc = null;
    const run = this._cur;
    // Früh gestarteter Ton schon zu Ende, bevor run-end da ist: _finishRun entscheidet über das Weiterhören
    if (s && s.run && s.run === run && !ann && !failed) run.lateGo = true;
    const go = !ann && !failed && this._auto && this._isOpen && this._visible && !run;
    this._auto = false;
    this._setState(run ? "think" : "idle");
    this._preClear();
    this._micSync();
    if (ann) this._annEnd(ann); else this._screenWake(true);   // Antwort vorgelesen: Bildschirm wach halten (Ansagen beim Klingeln nicht)
    if (go) this._listen(true, true); else this._stageArm();   // ohne Nachfrage geht die Bühne kurz nach dem Vorlesen zu
  }
  // Der früh gestartete Ton läuft: Anzeige "Spricht", bei der Ansage ist der Klingelton jetzt aus
  _audioPlaying() {
    const s = this._strm;
    if (!s || !this._speaking || s.st !== "wait") return;
    s.st = "play";
    clearTimeout(s.timer);
    this._streamUp(s);
  }
  _streamUp(s) {
    if (this._strm !== s || !this._speaking) return;
    this._setState("speak");
    if (s.ann) { clearTimeout(s.ann.timer); this._toneOff(s.ann.ring); }
  }
  _stopAudio() {
    this._auto = false;
    const s = this._strm;
    this._strm = null;
    if (s) { s.st = "stop"; clearTimeout(s.timer); }
    this._playTok++;
    if (this._a) {
      try { this._a.pause(); } catch (e) {}
      // Ein Stream hält die Anfrage an Home Assistant offen: Quelle wechseln, damit sie abbricht
      if (s) { try { if (SILENT) this._a.src = SILENT; else this._a.removeAttribute("src"); } catch (e) {} }
    }
    if (this._speaking) {
      this._speaking = false;
      if (this._st === "speak") this._setState(this._cur ? "think" : "idle");
    }
    const ann = this._annc;
    this._annc = null;
    this._preClear();
    this._micSync();
    if (ann) this._annEnd(ann);
  }
  // Home Assistant streamt die Sprachausgabe (run-start: tts_output.stream_response, ab 2025.6 bei Gesprächsagenten mit Streaming und
  // TTS mit Streaming-Eingang): Die Adresse liefert den Ton schon, während der Text noch entsteht. Der Server hält die Anfrage, bis es
  // etwas zu sagen gibt. Bei tts-end wird dieselbe Adresse nicht noch einmal gestartet (_streamSkip).
  // Bei Sprachanfragen erst ab stt-end (die Aufnahme ist da zu Ende), bei Text sofort. Nur mit early_tts: true (Vorgabe aus: am iPad rauschte es).
  _streamBegin(run) {
    const o = run.early;
    if (!o || run.str || run.ended || this._cur !== run) return;
    if (!(this._isOpen && this._visible && this._cfg.speak !== "never")) return;
    const s = run.str = { run, ann: null, url: o.url, token: o.token || "", st: "wait", tts: false };
    this._play(o.url, null, s);
  }
  // tts-end: Ist es dieselbe Adresse wie beim früh gestarteten Stream, bleibt es dabei (true = nichts weiter tun).
  // Eine andere Adresse oder ein gescheiterter bzw. abgebrochener Stream: wie bisher normal abspielen (false).
  _streamSkip(owner, o) {
    const s = owner.str;
    if (!s || !o) return false;
    if (!((o.token && s.token && o.token === s.token) || (o.url && o.url === s.url))) {
      if (this._strm === s) this._stopAudio();
      return false;
    }
    if (s.st === "fail" || s.st === "stop") return false;
    s.tts = true;
    // Kommt nach tts-end gar kein Ton, nicht ewig "Spricht" anzeigen und Wecken verhindern
    if (s.st === "wait" && this._strm === s && !s.timer) s.timer = setTimeout(() => { if (this._strm === s && s.st === "wait") this._stopAudio(); }, STRM_WAIT);
    this._streamUp(s);
    return true;
  }

  // ---------- Anfragen ----------
  _newRun(voice) {
    return { voice, ended: false, unsub: null, handlerId: null, rec: null, me: null, ai: null, cont: false, timer: null, endSent: false,
      text: "", t0: Date.now(), tEnd: 0, ie: false, local: undefined, tools: [], logged: false };
  }
  _expireConv() {
    if (this._convId && Date.now() - this._convAt > 300000) this._convId = null;
  }
  _send(text) {
    text = String(text || "").trim();
    if (!text || this._cur) return;
    this._stageDisarm();   // ein Lauf beginnt: die Bühne bleibt, bis er zu Ende ist (danach armiert _finishRun)
    this._stopAudio();
    this._expireConv();
    const run = this._newRun(false);
    run.text = text;
    run.me = this._push({ k: "me", text });
    this._ensureAi(run);
    this._cur = run;
    this._convAt = Date.now();
    this._setState("think");
    this._renderLog(true);
    this._applyBusy();
    this._runPipe({
      type: "assist_pipeline/run",
      start_stage: "intent",
      end_stage: this._cfg.speak === "always" ? "tts" : "intent",
      input: { text },
    }, run);
  }
  _runPipe(msg, run) {
    const hass = getHass();
    if (!hass || !hass.connection || !hass.connection.subscribeMessage) { this._finishRun(run, "conn"); return; }
    if (this._cfg.pipeline_id) msg.pipeline = this._cfg.pipeline_id;
    if (this._convId) msg.conversation_id = this._convId;
    run.timer = setTimeout(() => this._finishRun(run, "timeout"), 60000);
    let p;
    // Ohne erneutes Abonnieren nach einem Verbindungsabbruch: sonst liefe ein Befehl ein zweites Mal.
    try { p = hass.connection.subscribeMessage(ev => { try { this._onEvent(ev, run); } catch (e) {} }, msg, { resubscribe: false }); }
    catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(u => {
      run.unsub = u;
      if (run.ended) this._unsubRun(run);
    }, err => this._finishRun(run, errKey(err)));
  }
  _unsubRun(run) {
    const u = run.unsub;
    run.unsub = null;
    if (u) { try { const r = u(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  }
  _onEvent(ev, run) {
    if (!ev || run.ended) return;
    const d = ev.data || {};
    switch (ev.type) {
      case "run-start": {
        const id = d.runner_data && d.runner_data.stt_binary_handler_id;
        if (run.voice && id != null) {
          run.handlerId = id;
          if (run.rec) {
            if (run.fup && !run.rec.stopped && this._fupChime(run)) { /* Zuhören nach Rückfrage: erst der Ton, danach wird aufgenommen */ }
            else this._flush(run);
            if (run.rec.stopped && run.rec.endPending) this._sendEnd(run);
          }
        }
        const o = d.tts_output;
        if (this._cfg.early_tts && o && o.stream_response === true && typeof o.url === "string" && o.url) {
          run.early = o;
          if (!run.voice) this._streamBegin(run);
        }
        break;
      }
      case "stt-vad-end":
        this._stopRec(run, true, false);
        break;
      case "stt-end": {
        this._stopRec(run, true, false);
        const t = d.stt_output && d.stt_output.text;
        if (run.me && run.voice && typeof t === "string" && t.trim()) run.me.text = t.trim();
        if (run.voice) { run.text = typeof t === "string" ? t.trim() : ""; run.t0 = Date.now(); }   // Dauer zählt ab hier: ohne die Zeit, die gesprochen wurde
        this._wlEnd(run.text ? "text" : "leer", run.text, run);
        this._ensureAi(run);
        this._setState("think");
        this._renderLog(true);
        if (run.early) this._streamBegin(run);
        break;
      }
      case "intent-start":
        this._ensureAi(run);
        this._setState("think");
        this._renderLog();
        break;
      case "intent-progress": {
        const dl = d.chat_log_delta, c = dl && dl.content;
        if (typeof c === "string" && c) { this._ensureAi(run).text += c; this._renderLog(); }
        if (dl && Array.isArray(dl.tool_calls)) this._learnTools(run, dl.tool_calls);
        break;
      }
      case "intent-end": {
        const out = d.intent_output || {};
        const sp = out.response && out.response.speech && out.response.speech.plain && out.response.speech.plain.speech;
        const ai = this._ensureAi(run);
        if (typeof sp === "string" && sp.trim()) ai.text = sp.trim();
        ai.pending = false;
        if (out.conversation_id) this._convId = out.conversation_id;
        run.cont = !!out.continue_conversation;
        run.ie = true;
        run.tEnd = Date.now();
        run.local = d.processed_locally;
        this._convAt = Date.now();
        this._ansAt = Date.now();
        this._auto = !!(run.voice && run.cont && this._cfg.speak !== "never");
        this._preLen = this._auto ? ai.text.length : 0;
        this._renderLog(true);
        if (this._auto) this._preCheck();   // läuft das Vorlesen schon (früh gestarteter Ton), kann das Mikrofon jetzt eingeplant werden
        break;
      }
      case "tts-end": {
        const url = d.tts_output && d.tts_output.url;
        if (this._streamSkip(run, d.tts_output)) break;
        if (url && this._isOpen && this._visible && this._cfg.speak !== "never") this._play(url);
        break;
      }
      case "run-end":
        this._finishRun(run);
        break;
      case "error":
        this._finishRun(run, d.code || "generic");
        break;
    }
  }
  // Ende einer Anfrage, mit oder ohne Fehler. Fehler beim Vorlesen stören nicht, wenn die Antwort schon da ist.
  _finishRun(run, err) {
    if (run.ended) return;
    run.ended = true;
    clearTimeout(run.timer);
    this._unsubRun(run);
    if (run.rec) this._stopRec(run, false, false);
    if (this._cur === run) this._cur = null;
    // wake_log: ohne Text bis hierher: nichts erkannt (stt-no-text-recognized, run-end ohne Text) ist "leer", jeder andere Fehler "fehler"
    this._wlEnd(!err || err === "stt-no-text-recognized" ? "leer" : "fehler", "", run);
    // Früh gestarteter Ton: Bei einem Fehler oder ohne tts-end kommt kein (weiterer) Ton, die offene Anfrage würde hängen
    if (this._strm && this._strm.run === run && (err || !this._strm.tts)) this._stopAudio();
    this._learnLog(run);
    const go = !err && run.lateGo && run.voice && run.cont && this._cfg.speak !== "never" && this._isOpen && this._visible && !this._cur;
    const had = !!(run.ai && run.ai.text && run.ai.text.trim());
    if (run.ai) { run.ai.pending = false; if (!had) this._remove(run.ai); }
    if (err && !had) {
      if (run.voice && run.me && run.me.text === "…") this._remove(run.me);
      this._push({ k: "note", text: ERR[err] || ERR.generic });
    } else if (!err && !had) {
      this._push({ k: "note", text: "Dazu habe ich keine Antwort." });
    }
    this._ansAt = Date.now();
    if (!this._speaking) { this._auto = false; this._setState("idle"); this._screenWake(true); }   // ohne Vorlesen ist die Antwort jetzt fertig; sonst folgt _audioDone
    this._renderLog(true);
    this._applyBusy();
    if (go) this._listen(true, true); else this._stageArm();   // ohne Vorlesen und ohne Nachfrage geht die Bühne kurz nach dem Lauf zu
  }
  // Werkzeugaufrufe des Gesprächsagenten aus intent-progress (chat_log_delta.tool_calls: [{id, tool_name, tool_args, external}])
  _learnTools(run, list) {
    for (const tc of list) {
      if (!tc || typeof tc !== "object" || typeof tc.tool_name !== "string" || !tc.tool_name || run.tools.length >= 20) continue;
      if (tc.id != null && run.tools.some(x => x.id === tc.id)) continue;
      run.tools.push({ id: tc.id, name: tc.tool_name, args: tc.tool_args && typeof tc.tool_args === "object" ? tc.tool_args : {} });
    }
  }
  // Lernen (learn): Nach einem abgeschlossenen Lauf, der an den Gesprächsagenten ging (intent-end, processed_locally nicht true),
  // ruft die Karte das Skript einmal auf. Nicht bei Abbruch (kommt hier nicht an), ohne intent-end (Fehlerlauf) oder ohne Text.
  // Fehler beim Aufruf bleiben still.
  _learnLog(run) {
    const id = this._cfg.learn;
    if (!id || run.logged || !run.ie || run.local === true) return;
    const text = String(run.text || "").trim();
    if (!text) return;
    run.logged = true;
    const hass = getHass();
    if (!hass || typeof hass.callService !== "function") return;
    let ans = run.ai && run.ai.text ? String(run.ai.text).trim() : "";
    if (ans.length > 300) ans = ans.slice(0, 299).trimEnd() + "…";
    const data = {
      text,
      antwort: ans,
      werkzeuge: run.tools.map(x => ({ name: x.name, args: x.args })),
      dauer_ms: Math.max(0, Math.round((run.tEnd || Date.now()) - run.t0)),
      quelle: run.voice ? "stimme" : "text",
    };
    // notifyOnError = false (5. Parameter von hass.callService): sonst zeigt das HA-Frontend bei einem Fehler selbst einen Hinweis
    try { const p = hass.callService("script", id.slice(7), data, undefined, false); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // Abbrechen ohne Meldung: Mikrofon aus, Abo weg, Platzhalter entfernen.
  _cancelRun(run) {
    if (!run || run.ended) return;
    run.ended = true;
    clearTimeout(run.timer);
    this._unsubRun(run);
    if (run.rec) { run.rec.stopped = true; clearTimeout(run.rec.timer); this._closeRec(run.rec); }
    if (this._cur === run) this._cur = null;
    this._wlEnd("abbruch", "", run);
    if (run.voice && run.me && run.me.text === "…") this._remove(run.me);
    if (run.ai && !run.ai.text) this._remove(run.ai);
    if (this._strm && this._strm.run === run) this._stopAudio();
    this._setState(this._speaking ? "speak" : "idle");
    this._renderLog();
    this._applyBusy();
    this._stageArm();
  }
  _reset() {
    if (this._cur) this._cancelRun(this._cur);
    this._stopAudio();
    for (const it of this._items) if (it.timer) clearTimeout(it.timer);
    this._items = [];
    this._convId = null;
    this._convAt = 0;
    this._ansAt = 0;
    this._scrWake = false;   // ein neues Gespräch per Tipp ist kein Gespräch per Aktivierungswort
    this._stageEnd();
    this._wlEnd("abbruch", "");
    this._setState("idle");
    this._renderLog(true);
    this._applyBusy();
  }

  // ---------- Mikrofon ----------
  // auto: kein Tipp auf den Mikrofon-Knopf (Weckwort oder Rückfrage); fup: Weiterhören nach einer Rückfrage (kurzer Ton, sobald zugehört wird)
  async _listen(auto, fup) {
    if (this._cur || !this._isOpen || !this._visible) return;
    if (!this._micOk()) { if (!auto) this._micFail(); return; }
    this._stageDisarm();   // es wird zugehört: die Bühne bleibt, bis dieser Lauf zu Ende ist
    this._screenWake(true);   // es wird (wieder) zugehört: Bildschirm wach halten
    this._unlockAudio();
    this._ringSilence();   // wer jetzt spricht, will den Klingelton nicht im Mikrofon
    this._stopAudio();
    // Mikrofon-Pause (mic_pause): das Weckwort-Mikrofon ist zu, weil gesprochen wurde. Jetzt wird zugehört: sofort
    // wieder öffnen (nicht erst nach der Ruhezeit), mit dem schon freigeschalteten Kontext, und dann wie unten den Strom teilen.
    let wm = this._wm, pre = null;
    if (!(wm && wm.live) && (this._mp || this._wkResume)) {
      pre = this._beginVoice(fup);
      try { if (this._wkOpening && this._wkResume) await this._wkOpening; else await this._wakeOpen(); } catch (e) {}
      wm = this._wm;
      if (pre.ended) return;   // inzwischen abgebrochen (Schließen, neues Gespräch)
      if (!(wm && wm.live)) { this._cancelRun(pre); if (!auto) this._micFail(); return; }
    }
    // Hört das Aktivierungswort schon mit, ist das Mikrofon offen: denselben Strom nehmen, kein zweites getUserMedia.
    if (wm && wm.live) {
      try { if (wm.ctx.state !== "running") wm.ctx.resume(); } catch (e) {}
      const run = pre || this._beginVoice(fup);
      run.rec = { ctx: wm.ctx, stream: wm.stream, shared: wm, queue: [], qlen: 0, stopped: false, endPending: false, timer: null };
      wm.run = run;
      this._voicePipe(run);
      return;
    }
    // Der AudioContext entsteht noch im Tipp, sonst bleibt er auf iOS stumm.
    let ctx = mkCtx();
    if (!ctx) { if (!auto) this._micFail(); return; }
    try { ctx.resume(); } catch (e) {}
    const run = this._beginVoice(fup);
    let stream = null, rec = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC);
      const o = await this._openChain(ctx, stream, run);
      rec = o.rec;
      ctx = o.ctx;
    } catch (e) { rec = null; }
    if (run.ended || !rec) {
      // abgebrochen oder gescheitert: alles freigeben
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
      if (!run.ended) { this._cancelRun(run); if (!auto) this._micFail(); }
      return;
    }
    this._voicePipe(run);
  }
  // Neue Sprachanfrage im Verlauf anlegen (Platzhalter "…" für das, was gesagt wird).
  _beginVoice(fup) {
    this._expireConv();
    const run = this._newRun(true);
    run.fup = !!fup;
    run.me = this._push({ k: "me", text: "…" });
    this._wlAttach(run);
    this._clAttach(run);
    this._cur = run;
    this._convAt = Date.now();
    this._setState("listen");
    this._renderLog(true);
    this._applyBusy();
    return run;
  }
  // Pipeline ab Spracherkennung starten; der Ton folgt, sobald Home Assistant die Kennung des Stroms meldet.
  _voicePipe(run) {
    run.rec.timer = setTimeout(() => this._stopRec(run), 15000);
    this._runPipe({
      type: "assist_pipeline/run",
      start_stage: "stt",
      end_stage: this._cfg.speak === "never" ? "intent" : "tts",
      input: { sample_rate: 16000 },
    }, run);
    this._syncBtn();
  }
  // Aufnahmekette öffnen; scheitert sie, einmal mit einem frischen Kontext versuchen.
  async _openChain(ctx, stream, run) {
    let rec = null;
    for (let pass = 0; pass < 2 && !rec && ctx && !run.ended; pass++) {
      try { rec = await this._openRec(ctx, stream, run); }
      catch (e) { try { ctx.close(); } catch (e2) {} ctx = pass === 0 ? mkCtx() : null; }
    }
    return { rec, ctx };
  }
  async _openRec(ctx, stream, run) {
    try { await Promise.race([Promise.resolve(ctx.resume()).catch(() => {}), delay(600)]); } catch (e) {}
    // Fürs Weckwort darf der Kontext noch schlafen (iOS: bis zum ersten Tipp); für ein Gespräch nicht.
    if (ctx.state !== "running" && !run.wake) throw new Error("ctx");
    const rec = { ctx, stream, src: null, node: null, sink: null, mute: null, got: false, wd: null, wdChk: null, ratio: ctx.sampleRate / 16000, acc: 0, need: 0, queue: [], qlen: 0, stopped: false, endPending: false, timer: null };
    run.rec = rec;
    try {
      rec.src = ctx.createMediaStreamSource(stream);
      const on = f => { rec.got = true; this._onFrames(run, f); };
      let ok = false;
      if (ctx.audioWorklet && typeof AudioWorkletNode === "function") {
        // Der Prozessor lässt sich je Kontext nur einmal registrieren: beim Wiederöffnen nach einer Mikrofon-Pause ist er schon da
        const url = ctx.__fpRec ? "" : URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
        try {
          if (url) { await ctx.audioWorklet.addModule(url); ctx.__fpRec = true; }
          const node = new AudioWorkletNode(ctx, "fp-pip-rec", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
          node.port.onmessage = e => on(e.data);
          rec.src.connect(node);
          this._recOut(rec, node);
          rec.node = node;
          ok = true;
        } catch (e) { ok = false; this._recUnhook(rec); try { rec.src.disconnect(); } catch (e2) {} }
        finally { if (url) URL.revokeObjectURL(url); }
      }
      if (!ok) {
        const node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = e => on(new Float32Array(e.inputBuffer.getChannelData(0)));
        rec.src.connect(node);
        this._recOut(rec, node);
        rec.node = node;
      }
      if (rec.sink) this._recWatch(rec);
    } catch (e) {
      this._dropNodes(rec);
      run.rec = null;
      throw e;
    }
    return rec;
  }
  // Ausgang der Aufnahmekette. Normalfall: ein MediaStream-Ziel. Browser rechnen den Worklet dafür von selbst (automatic pull), und
  // der Lautsprecher-Ausgang bleibt unbenutzt (am iPad knackte der Lautsprecher, solange das Mikrofon offen war).
  // Rückfall: stummer Gain am Ausgang, siehe _recWatch.
  _recOut(rec, node) {
    const ctx = rec.ctx;
    if (!SINK_BAD && typeof ctx.createMediaStreamDestination === "function") {
      try {
        rec.sink = ctx.createMediaStreamDestination();
        node.connect(rec.sink);
        return;
      } catch (e) { try { if (rec.sink) node.disconnect(rec.sink); } catch (e2) {} rec.sink = null; SINK_BAD = true; }
    }
    rec.mute = ctx.createGain();
    rec.mute.gain.value = 0;   // stumm gegen Rückkopplung
    rec.mute.connect(ctx.destination);
    node.connect(rec.mute);
  }
  // Kommt nach dem Start des Kontexts innerhalb von SINK_WAIT kein Audio-Paket, rechnet dieser Browser den Worklet am
  // MediaStream-Ausgang nicht: auf den stummen Gain am Ausgang umhängen (und das für die Seite merken). Schläft der Kontext
  // noch (iOS: bis zum ersten Tipp), wird erst gewartet, bis er läuft.
  _recWatch(rec) {
    const chk = () => {
      clearTimeout(rec.wd);
      if (rec.got || rec.stopped || !rec.sink || rec.ctx.state !== "running") return;
      rec.wd = setTimeout(() => {
        if (rec.got || rec.stopped || !rec.sink || rec.ctx.state !== "running") return;
        SINK_BAD = true;
        try { rec.node.disconnect(rec.sink); } catch (e) {}
        rec.sink = null;
        rec.mute = rec.ctx.createGain();
        rec.mute.gain.value = 0;
        rec.mute.connect(rec.ctx.destination);
        rec.node.connect(rec.mute);
      }, SINK_WAIT);
    };
    rec.wdChk = chk;
    try { rec.ctx.addEventListener("statechange", chk); } catch (e) {}
    chk();
  }
  _recUnhook(rec) {
    clearTimeout(rec.wd);
    try { if (rec.wdChk) rec.ctx.removeEventListener("statechange", rec.wdChk); } catch (e) {}
    rec.wdChk = null;
    try { if (rec.sink) rec.sink.disconnect(); } catch (e) {}
    try { if (rec.mute) rec.mute.disconnect(); } catch (e) {}
    rec.sink = null;
    rec.mute = null;
  }
  // Auf 16 kHz herunterrechnen (Mitteln) und in 16-Bit-Zahlen wandeln. Der Ton des Weckwort-Mikrofons geht an die Erkennung
  // oder, während eines Gesprächs, in dessen Warteschlange.
  _onFrames(run, f) {
    const rec = run.rec;
    if (!rec || rec.stopped || !f || !f.length) return;
    const out = downsample(rec, f);
    if (run.wake) this._wakeFrames(out); else this._queue(run, out);
  }
  // Vormerken und ab ~100 ms senden.
  _queue(run, out) {
    const rec = run.rec;
    if (!rec || rec.stopped) return;
    let first = false;
    if (rec.dropUntil) { if (Date.now() < rec.dropUntil) return; rec.dropUntil = 0; first = true; }   // Ton nach einer Rückfrage: nichts davon an Home Assistant; der erste Block danach geht gleich los
    rec.queue.push(out);
    rec.qlen += out.length;
    if (run.handlerId != null && (first || rec.qlen >= 1600)) this._flush(run);
  }
  _sock() {
    const h = getHass(), c = h && h.connection;
    return c && c.socket ? c.socket : null;
  }
  // Binärnachricht: erstes Byte = Kennung des Stroms, danach 16-Bit-PCM (Little Endian).
  _flush(run) {
    const rec = run.rec;
    if (!rec || run.ended || run.handlerId == null || !rec.qlen) return;   // nach dem Ende des Laufs gilt der Strom in Home Assistant nicht mehr
    const all = new Int16Array(rec.qlen);
    let o = 0;
    for (const q of rec.queue) { all.set(q, o); o += q.length; }
    rec.queue = [];
    rec.qlen = 0;
    const sock = this._sock();
    if (!sock || sock.readyState !== 1) return;
    const STEP = 1600;
    for (let s = 0; s < all.length; s += STEP) {
      const n = Math.min(STEP, all.length - s);
      const bytes = new Uint8Array(1 + n * 2), dv = new DataView(bytes.buffer);
      bytes[0] = run.handlerId;
      for (let i = 0; i < n; i++) dv.setInt16(1 + i * 2, all[s + i], true);
      try { sock.send(bytes); } catch (e) { return; }
    }
  }
  _sendEnd(run) {
    if (run.endSent || run.ended || run.handlerId == null) return;
    run.endSent = true;
    const sock = this._sock();
    if (sock && sock.readyState === 1) { try { sock.send(new Uint8Array([run.handlerId])); } catch (e) {} }
  }
  // Aufnahme beenden: Rest senden, Ende melden, Mikrofon und AudioContext freigeben.
  // rest === false: Rest verwerfen und nur das Ende-Paket schicken (Home Assistant hat das Ende der Sprache schon erkannt).
  _stopRec(run, sendEnd, rest) {
    const rec = run && run.rec;
    if (!rec || rec.stopped) return;
    rec.stopped = true;
    clearTimeout(rec.timer);
    if (rest === false) { rec.queue = []; rec.qlen = 0; } else this._flush(run);
    if (sendEnd !== false && !run.ended) {
      if (run.handlerId != null) this._sendEnd(run); else rec.endPending = true;
    }
    this._closeRec(rec);
    if (!run.ended) this._ensureAi(run);
    if (this._cur === run && this._st === "listen") this._setState("think");
    if (!run.ended) this._renderLog(true);
    this._syncBtn();
  }
  _dropNodes(rec) {
    try { if (rec.node && rec.node.port) rec.node.port.onmessage = null; } catch (e) {}
    try { if (rec.node) rec.node.onaudioprocess = null; } catch (e) {}
    try { if (rec.node) rec.node.disconnect(); } catch (e) {}
    try { if (rec.src) rec.src.disconnect(); } catch (e) {}
    this._recUnhook(rec);
  }
  _closeRec(rec) {
    // Das Weckwort-Mikrofon bleibt offen: ein Gespräch löst sich nur davon.
    if (rec.shared) { if (rec.shared.run && rec.shared.run.rec === rec) rec.shared.run = null; this._micSync(); return; }
    this._dropNodes(rec);
    try { rec.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { const r = rec.ctx.close(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  }

  // ---------- Aktivierungswort ----------
  // Pro Gerät ein Schalter. Ist er an, bleibt das Mikrofon offen und die Erkennung läuft im Browser; Ton geht erst an
  // Home Assistant, wenn das Wort erkannt ist (dann wie beim Mikrofon-Knopf, aus demselben Strom). Solange ein Gespräch läuft
  // oder die Antwort vorgelesen wird, ist die Erkennung taub, damit Pip sich nicht selbst weckt.
  _wakeKey() { return WAKE_STORE + (this._cfg.dashboard || pathPart()); }
  _wakeLoad() { try { return localStorage.getItem(this._wakeKey()) === "1"; } catch (e) { return false; } }
  _wakeSave(on) { try { if (on) localStorage.setItem(this._wakeKey(), "1"); else localStorage.removeItem(this._wakeKey()); } catch (e) {} }
  _wakeWant() { return !!(this._visible && this._cfg.wake_word && this._wakeOn && this._micOk() && !document.hidden); }
  // Taub: Gespräch läuft, Erkennung gerade angenommen oder Pip liest eine Antwort vor. Klingelton und Ansage des Klingelns zählen nicht:
  // Dort soll das Aktivierungswort gerade das Klingeln abstellen (_onWake). Ob das Mikrofon dabei offen ist, regelt _micHold.
  _wakeBusy() { return this._wkHold || !!this._cur || (this._speaking && !this._ringSpk()); }
  // Läuft gerade die Ansage des aktuellen Klingelns (kein gewöhnliches Vorlesen)?
  _ringSpk() { return !!(this._annc && this._annc.ring && this._annc.ring === this._ring); }
  // Klingelt es laut (Klingelton oder Ansage)? Dann schließt sich ein per Aktivierungswort geöffnetes Fenster nicht von selbst.
  _ringLoud() { return !!(this._ring && (this._ring.tone || this._ringSpk())); }
  _wakeSet(st, why, err) {
    if (st === "err") console.warn("[fp-assistant] Aktivierungswort:", err || why);
    this._wk = { st, why: why || "", det: st === "err" ? wkDetail(err) : "" };
    this._wakeRender();
  }
  _wakeRender() {
    const w = this._cfg.wake_word, k = this._wk, ok = this._micOk();
    this._wkRow.hidden = !w;
    const on = !!(w && this._wakeOn && ok);
    let hint = "", err = false;
    if (w) {
      this._wkLbl.textContent = `Auf „${w.name}“ hören`;
      this._wkSw.setAttribute("aria-label", `Auf „${w.name}“ hören`);
      if (!ok) hint = "Das geht nur über eine sichere Verbindung (https).";
      else if (on && k.st === "load") hint = "Lädt die Erkennung …";
      else if (on && k.st === "wait") hint = `Einmal tippen, dann hört ${this._cfg.name} zu.`;
      else if (on && k.st === "on") hint = `Hört zu. Sag „${w.name}“.`;
      else if (on && k.st === "err") { hint = (WAKE_ERR[k.why] || WAKE_ERR.run) + (k.det ? ` (${k.det})` : ""); err = true; }
    }
    this._wkHint.textContent = hint;
    this._wkRow.classList.toggle("err", err);
    this._wkSw.setAttribute("aria-checked", on ? "true" : "false");
    this._wkSw.disabled = !ok;
    this._fig.classList.toggle("wk-on", on && k.st === "on");
    this._fig.classList.toggle("wk-wait", on && k.st === "wait");
  }
  _wakeToggle() {
    if (!this._cfg.wake_word || !this._micOk()) return;
    this._wakeOn = !this._wakeOn;
    this._wakeSave(this._wakeOn);
    this._wkTry = 0;
    this._wakeOff();
    this._wakeSet("off");
    // Der Tipp aufs Schalter-Feld zählt: AudioContext und Vorlesen lassen sich jetzt freischalten.
    if (this._wakeOn) { this._unlockAudio(); this._wakeSync(); }
  }
  // Soll die Erkennung laufen? Dann öffnen, sonst alles schließen (aus, Dock versteckt, Tab im Hintergrund).
  _wakeSync() {
    if (!this._wakeWant()) {
      if (this._wm || this._wkLoading || this._wkArmed) this._wakeOff();
      if (this._wk.st !== "off" && this._wk.st !== "err") this._wakeSet("off");
      return;
    }
    if (this._mp && this._micHold()) return;   // Mikrofon-Pause: erst nach dem Ton wieder öffnen
    if (!this._wm && !this._wkLoading) this._wakeOpen();
  }
  _wakeOff() {
    this._wkTok++;
    this._wkLoading = false;
    clearTimeout(this._wkRetry);
    clearTimeout(this._wkIdleT);
    this._wkWas = false;
    this._wakeDisarm();
    this._mpClear();
    this._wmClose();
  }
  // Öffnet das Mikrofon für die Erkennung; Rückgabe: Promise (endet auch bei Fehlern ohne Ausnahme)
  _wakeOpen() {
    const resuming = !!this._mp;
    this._wkResume = resuming;
    const p = this._wkOpening = this._wakeOpenRun(resuming);
    const done = () => { if (this._wkOpening === p) { this._wkOpening = null; this._wkResume = false; } };
    p.then(done, done);
    return p;
  }
  async _wakeOpenRun(resuming) {
    const w = this._cfg.wake_word, tok = ++this._wkTok, stale = () => tok !== this._wkTok;
    this._wkLoading = true;
    // Nach einer Mikrofon-Pause bleibt die Anzeige, wie sie ist; der schlafende AudioContext wird weiterverwendet (iOS lässt einen
    // neuen außerhalb eines Tipps oft nicht anlaufen, einen schon freigeschalteten dagegen schon)
    if (!resuming) this._wakeSet("load");
    const keep = this._mp;
    clearTimeout(this._mpT);
    this._mpT = null;
    this._mp = null;
    // Der AudioContext entsteht gleich hier (meist im Tipp), sonst bleibt er auf iOS stumm.
    let ctx = keep && keep.ctx && keep.ctx.state !== "closed" ? keep.ctx : mkCtx(), stream = null, ok = false;
    try { if (ctx) ctx.resume(); } catch (e) {}
    try {
      if (!ctx) throw wkErr(new Error("ctx"), "mic");
      if (typeof WebAssembly !== "object") throw wkErr(new Error("wasm"), "ort");
      if (!this._eng) {
        this._eng = new WakeEngine(w);
        this._eng.onwake = sc => this._onWake(sc);
        if (this._cfg.wake_log || this._cfg.wake_clip) this._eng.onscore = s => { this._wlScore(s); try { this._clScore(s); } catch (e) { this._cl = null; } };
        this._eng.onerror = e => { if (this._wm) this._wakeFail("run", e); };
      }
      const eng = this._eng;
      await eng.load();
      if (stale()) return;
      try { stream = await navigator.mediaDevices.getUserMedia(MIC); }
      catch (e) { throw wkErr(e, e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "perm" : "mic"); }
      if (stale()) return;
      const W = { wake: true, rec: null, ended: false };
      const o = await this._openChain(ctx, stream, W);
      ctx = o.ctx;
      if (stale()) return;
      if (!o.rec) throw wkErr(new Error("rec"), "mic");
      const m = this._wm = { ctx, stream, W, run: null, live: true };
      stream.getAudioTracks().forEach(t => t.addEventListener("ended", () => this._wakeLost(m)));
      ctx.onstatechange = () => this._wakeCtxState();
      ok = true;
      this._wkTry = 0;
      this._wkLoading = false;
      eng.reset();
      this._wakeCtxState();
      this._micSync();   // läuft inzwischen schon wieder Ton: gleich wieder zu
    } catch (e) {
      if (!stale()) {
        this._wkLoading = false;
        const why = (e && e.wk) || "mic";
        this._wakeSet("err", why, e);
        // Mikrofon verweigert oder getrennt: ein späterer Tipp versucht es noch einmal
        if (why === "perm" || why === "mic") this._wakeArm();
      }
    } finally {
      if (!ok) {
        try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        try { if (ctx) ctx.close(); } catch (e) {}
      }
    }
  }
  // Der Kontext läuft (Erkennung aktiv) oder schläft (iOS: bis zum nächsten Tipp).
  _wakeCtxState() {
    const m = this._wm;
    if (!m) return;
    if (m.ctx.state === "running") {
      this._wakeDisarm();
      if (this._wk.st !== "on") { if (this._eng) this._eng.reset(); this._wakeSet("on"); }
    } else {
      this._wakeSet("wait");
      this._wakeArm();
      try { m.ctx.resume(); } catch (e) {}
    }
  }
  _wakeFail(why, e) {
    this._wmClose();
    this._wakeSet("err", why, e);
  }
  // Das Mikrofon wurde uns genommen (Gerät getrennt, andere App): ein paar Mal neu versuchen, dann auf den nächsten Tipp warten.
  _wakeLost(m) {
    if (this._wm !== m) return;
    this._wmClose();
    this._wakeSet("wait");
    this._wakeArm();
    clearTimeout(this._wkRetry);
    if (this._wkTry++ < 3) this._wkRetry = setTimeout(() => this._wakeSync(), 2500);
  }
  _wmClose() {
    this._preClear();
    const m = this._wm;
    if (!m) return;
    this._wm = null;
    m.live = false;
    try { m.ctx.onstatechange = null; } catch (e) {}
    this._clClose();
    const run = m.run;
    m.run = null;
    if (run && !run.ended) this._cancelRun(run);
    if (m.W.rec) { m.W.rec.stopped = true; this._closeRec(m.W.rec); }
    else {
      try { m.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      try { m.ctx.close(); } catch (e) {}
    }
  }
  // ---------- Mikrofon-Pause (mic_pause) ----------
  // Solange Pip eine Antwort vorliest, ist das Weckwort-Mikrofon zu: Ein offener Aufnahmestrom hält iOS im Modus
  // "Wiedergabe und Aufnahme" (mit Sprachverarbeitung); die Wiedergabe rauscht dann gelegentlich. Freigegeben werden die Spuren
  // (stop() beendet die Aufnahme und damit den Modus) und die Aufnahmekette; der AudioContext bleibt, wird aber angehalten:
  // So konkurriert er nicht mit der Wiedergabe, und er ist schon freigeschaltet, das Wiederöffnen braucht dann keinen Tipp
  // (ein neuer Kontext bliebe auf iOS ohne Tipp oft stumm). Nach dem Ton plus WAKE_QUIET kommt ein neuer Strom (getUserMedia).
  // Ausnahme Klingeln: Klingelton und Ansage des Klingelns halten nicht. Das Mikrofon bleibt die ganze Zeit offen, damit das
  // Aktivierungswort das Klingeln abstellen kann (_onWake); es gibt kein Auf und Zu im Takt der Glockenschläge. Am iPad kann die
  // Glocke bei offenem Mikrofon etwas anders klingen (Sprachverarbeitung), das ist der Preis dafür.
  _micHold() { return !!(this._cfg.mic_pause && !this._preOpen && this._speaking && !this._ringSpk()); }
  // Ton hat begonnen oder geendet: Mikrofon schließen bzw. das Wiederöffnen einplanen
  _micSync() {
    if (!this._cfg.mic_pause) return;
    if (this._micHold()) {
      clearTimeout(this._mpT);
      this._mpT = null;
      this._micPause();
    } else if (this._mp) {
      if (!this._mpT) this._mpT = setTimeout(() => { this._mpT = null; if (this._mp && !this._micHold()) this._wakeSync(); }, WAKE_QUIET);
      this._wakeIdleArm();
    }
  }
  _micPause() {
    const m = this._wm;
    if (!m || !m.live || this._wkHold) return;
    const run = m.run;
    if (run && !run.ended && run.rec && !run.rec.stopped) return;   // es wird gerade aufgenommen: nach dem Ende der Aufnahme (_closeRec)
    this._wm = null;
    m.live = false;
    m.run = null;
    try { m.ctx.onstatechange = null; } catch (e) {}
    this._clClose();
    if (m.W.rec) { m.W.rec.stopped = true; this._dropNodes(m.W.rec); }
    try { m.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { const r = m.ctx.suspend(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    if (this._eng) this._eng.reset();
    this._mp = { ctx: m.ctx };
  }
  // Pause verwerfen (Erkennung aus, Dock versteckt, Tab im Hintergrund): auch der angehaltene Kontext wird geschlossen
  _mpClear() {
    clearTimeout(this._mpT);
    this._mpT = null;
    const mp = this._mp;
    this._mp = null;
    if (mp && mp.ctx) { try { const r = mp.ctx.close(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  }
  // Rückfrage (mic_pause): Pip stellt eine Frage und wird danach zuhören. Das Weckwort-Mikrofon ist während des Vorlesens zu; es wieder zu
  // öffnen (getUserMedia, Kontext fortsetzen) dauert am iPad knapp eine Sekunde. Deshalb geht es PRE_OPEN_MS vor dem Ende des Vorlesens auf
  // (nicht früher: der Großteil des Satzes läuft ohne offenes Mikrofon und ohne Rauschen). _preOpen hält _micHold() so lange auf false,
  // bis das Vorlesen endet oder abbricht (_preClear). Bis dahin ist _wakeBusy() wahr: die Erkennung bekommt keinen Ton, ans Gespräch
  // hängt nichts, an Home Assistant geht nichts. Endet das Vorlesen, findet _listen ein offenes Mikrofon und startet sofort.
  _preCheck() {
    if (!this._auto || !this._speaking || this._annc || this._preOpen || !this._mp || !this._cfg.mic_pause) return;
    clearTimeout(this._preT);
    this._preT = null;
    if (this._wm || this._wkLoading || (this._ring && this._ring.tone) || !this._isOpen || !this._wakeWant()) return;
    // Erst wenn der Ton wirklich läuft (iOS soll zuerst im reinen Wiedergabemodus anlaufen), auch bei sehr kurzen Sätzen
    const a = this._a, rem = a && !a.paused && a.currentTime > 0.15 ? this._preRemain() : NaN;
    if (rem >= 0 && rem <= PRE_OPEN_MS) {
      this._preOpen = { run: this._cur };
      this._wakeSync();   // mic_pause hält nicht mehr (_preOpen): öffnet mit dem schon freigeschalteten Kontext
      return;
    }
    // Länge unbekannt oder noch weit: später nachsehen (die Audio-Ereignisse tun das auch), kurz vor dem Ziel genau
    this._preT = setTimeout(() => { this._preT = null; this._preCheck(); }, rem > PRE_OPEN_MS ? Math.max(30, Math.min(rem - PRE_OPEN_MS, 250)) : 250);
  }
  // Restzeit des Vorlesens in ms; NaN = (noch) nicht zu sagen. Reihenfolge: bekannte Länge (audio.duration; bei einem Stream erst, wenn er
  // fertig geladen ist), sonst die Länge aus dem Puffer, sobald nichts mehr nachkommt (networkState IDLE nach suspend), sonst eine Schätzung
  // aus der Textlänge (SAY_CPS ist bewusst langsam gewählt: zu spät ist unschädlich, zu früh nicht). Ist die Schätzung aufgebraucht, aber
  // der Ton läuft weiter, wird nicht geraten, sondern auf die echte Länge gewartet. IDLE heißt auch "genug vorgeladen" (der Browser hält den
  // Abruf an): Dann liegt der Puffer aber weit vor der Wiedergabe (Chrome: ab etwa 2,5 s), die Restzeit bleibt über PRE_OPEN_MS und löst nichts
  // aus; sie schrumpft erst, wenn wirklich alles geladen ist und der Puffer das Ende erreicht.
  _preRemain() {
    const a = this._a;
    if (!a) return NaN;
    try {
      const ct = a.currentTime || 0, d = a.duration, n = a.buffered ? a.buffered.length : 0, be = n ? a.buffered.end(n - 1) : 0;
      const done = a.networkState === 1 && n > 0;   // NETWORK_IDLE: es kommt nichts mehr nach
      let total = NaN, est = false;
      if (isFinite(d) && d > 0 && (done || !this._strm)) total = d;
      else if (done) total = be;
      else if (this._preLen > 0) { total = Math.max(this._preLen / SAY_CPS, isFinite(d) ? d : 0, be); est = true; }
      if (!(total > 0)) return NaN;
      const rem = (total - ct) * 1000;
      return est && rem <= 0 ? NaN : Math.max(0, rem);
    } catch (e) { return NaN; }
  }
  // Markierung weg (Vorlesen zu Ende oder abgebrochen, Klingeln, neuer Ton, Weckwort aus): Ein schon offenes Mikrofon bleibt für das
  // Weckwort offen, die Erkennung bleibt aber WAKE_QUIET lang taub (_wkWas); wer danach Ton macht, schließt es über _micSync wieder.
  _preClear() {
    clearTimeout(this._preT);
    this._preT = null;
    if (!this._preOpen) return;
    this._preOpen = null;
    if (this._wm && this._wm.live) this._wkWas = true;
  }
  // Zuhören nach einer Rückfrage hat begonnen (run-start mit Kennung des Tonstroms): kurzer Ton als Zeichen, dass jetzt gesprochen werden kann.
  // Wie beim Weckwort zählt die Aufnahme erst nach dem Ton: Alles davor (Nachhall der Frage) und der Ton selbst (plus CHIME_TAIL) wird verworfen.
  // false: kein Ton (Kontext läuft nicht, etwa iOS vor dem ersten Tipp), dann wird wie gewohnt gesendet.
  _fupChime(run) {
    const rec = run.rec;
    if (!rec || rec.stopped || !rec.ctx || rec.ctx.state !== "running") return false;
    rec.queue = [];
    rec.qlen = 0;
    rec.dropUntil = Date.now() + CHIME_MS + CHIME_TAIL;
    this._chime(rec.ctx);
    return true;
  }
  // Erster Tipp irgendwo auf der Seite: AudioContext fortsetzen (iOS), Vorlesen freischalten, notfalls neu öffnen.
  _wakeArm() {
    if (this._wkArmed) return;
    this._wkArmed = true;
    for (const t of ["pointerdown", "touchend", "click", "keydown"]) document.addEventListener(t, this._wkGest, true);
  }
  _wakeDisarm() {
    if (!this._wkArmed) return;
    this._wkArmed = false;
    for (const t of ["pointerdown", "touchend", "click", "keydown"]) document.removeEventListener(t, this._wkGest, true);
  }
  _wakeKick() {
    this._unlockAudio();
    const m = this._wm;
    if (m) { try { if (m.ctx.state !== "running") m.ctx.resume(); } catch (e) {} return; }
    const k = this._wk;
    if (this._wkLoading || (k.st === "err" && k.why !== "perm" && k.why !== "mic")) return;
    this._wakeSync();
  }
  // Ton des offenen Mikrofons (16 kHz, Int16): gehört dem Gespräch, solange eines am Mikrofon hängt, sonst der Erkennung.
  _wakeFrames(out) {
    const m = this._wm, eng = this._eng;
    if (!m || !eng) return;
    if (this._cfg.wake_clip) this._clFeed(out);   // wake_clip: Ringpuffer und Nach-Teil, auch während Ton-Signal und Gespräch
    const run = m.run;
    if (run && !run.ended && run.rec && !run.rec.stopped) { this._queue(run, out); return; }
    if (this._wakeBusy()) { this._wkWas = true; return; }
    const now = Date.now();
    if (this._wkWas) {
      // Antwort und Vorlesen sind vorbei: kurz taub bleiben (Nachhall), Puffer leeren
      this._wkWas = false;
      this._wkQuiet = now + WAKE_QUIET;
      eng.reset();
      this._wakeIdleArm();
    }
    if (now < this._wkQuiet) return;
    eng.push(out);
  }
  _onWake(score) {
    const m = this._wm;
    // wake_log: Die laufende Episode ist mit dieser Erkennung entschieden (auch bei einer abgewiesenen), sie wird nie als "knapp" geschrieben;
    // sie läuft aber weiter, damit der Nachhall des Worts keine neue Episode beginnt
    const ep = this._wlEp;
    if (ep) ep.skip = true;
    if (!m || !this._visible || this._wakeBusy()) { this._clReject(); return; }
    this._wlOpen(score, ep);
    this._clAccept(score);
    // Bildschirmschoner (wake_screen) sofort beenden, noch vor dem Ton; _scrWake hält ihn bis zum Ende des Gesprächs weg
    this._scrWake = true;
    this._screenWake();
    this._wkHold = true;
    // Es klingelt (laut, still gestellt oder ausgeklungen mit Hinweisfeld): das Aktivierungswort stellt es ab, wie der Stopp-Knopf
    // (Ton aus, Ansage ab, Signal in Home Assistant leeren, dann hören alle Geräte auf). Nach _wkHold, damit _micPause (über _micSync in
    // _toneOff/_stopAudio) nichts anfasst; ein dabei gesetztes "idle" überschreibt gleich das "listen" unten.
    if (this._ring) this._ringStop();
    if (this._eng) this._eng.reset();
    this._chime(m.ctx);
    if (!this._isOpen) { this._wakeOpened = true; this._stageBegin(); this._openPanel(); }
    this._setState("listen");
    // Erst nach dem Ton aufnehmen, sonst hört Home Assistant den Ton mit.
    setTimeout(() => {
      if (this._wm === m && this._isOpen && !this._cur) this._listen(true);
      this._wkHold = false;
      this._stageArm();   // kommt kein Lauf zustande, geht die Bühne trotzdem wieder zu
      if (!this._cur) this._setState(this._speaking ? "speak" : "idle");
      this._micSync();
    }, CHIME_MS);
  }
  // Bildschirmschoner beenden (wake_screen): drückt den Knopf (button, input_button) bzw. startet das Skript. In der Kiosker-App ist das
  // "Bildschirmschoner beenden"; der Schoner kommt sonst etwa eine Minute nach der letzten Berührung, auch wenn Pip gerade zuhört oder antwortet.
  // keep: nur wenn das Gespräch per Aktivierungswort begann (_scrWake); Gespräche per Tipp, auch am Handy, drücken nie. Höchstens alle SCR_GAP ms.
  // notifyOnError = false (5. Parameter von hass.callService): sonst zeigt das HA-Frontend bei einem Fehler selbst einen Hinweis; Fehler bleiben still.
  _screenWake(keep) {
    const id = this._cfg.wake_screen;
    if (!id || (keep && !this._scrWake)) return;
    const hass = getHass();
    if (!hass || typeof hass.callService !== "function") return;
    const now = Date.now(), dt = now - this._scrAt;
    if (dt >= 0 && dt < SCR_GAP) return;
    this._scrAt = now;
    const dom = id.slice(0, id.indexOf("."));
    try { const p = hass.callService(dom, dom === "script" ? "turn_on" : "press", { entity_id: id }, undefined, false); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // ---------- Protokoll der Aktivierungswort-Werte (wake_log) ----------
  // Zweck: Schwelle und patience mit echten Werten einstellen. Zwei Arten von Einträgen, beide als ein Aufruf des Skripts:
  // "ausgeloest": angenommene Erkennung, geschrieben erst, wenn feststeht, was danach kam (text, leer, fehler, abbruch);
  // "knapp": Wert zwischen WAKE_LOG_MIN und der Schwelle, ohne Erkennung (gedrosselt). Abgewiesene Erkennungen (Pip spricht gerade) und
  // Nachfragen im selben Gespräch (kein neues Aktivierungswort) erzeugen nichts. Fehler beim Aufruf bleiben still.
  _wlCall(data) {
    const id = this._cfg.wake_log;
    if (!id) return;
    const hass = getHass();
    if (!hass || typeof hass.callService !== "function") return;
    const w = this._cfg.wake_word || {};
    data.wert = Math.round(data.wert * 1000) / 1000;
    data.schwelle = w.threshold;
    data.geduld = w.patience;
    // notifyOnError = false (5. Parameter von hass.callService): sonst zeigt das HA-Frontend bei einem Fehler selbst einen Hinweis
    try { const p = hass.callService("script", id.slice(7), data, undefined, false); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // Erkennung angenommen: Eintrag offen halten. Kommt binnen WAKE_LOG_WAIT kein Lauf, zählt das als Abbruch.
  _wlOpen(score, ep) {
    if (!this._cfg.wake_log) return;
    this._wlEnd("abbruch", "");   // ein noch offener Eintrag der vorigen Erkennung
    const w = this._cfg.wake_word || {};
    const e = { wert: Number(score) || 0, bloecke: Math.max(ep ? ep.n : 0, w.patience || 1), run: null, timer: null };
    e.timer = setTimeout(() => { if (this._wl === e) this._wlEnd("abbruch", ""); }, WAKE_LOG_WAIT);
    this._wl = e;
  }
  // Der Lauf zur Erkennung ist da (erste Sprachanfrage nach der Erkennung): ab jetzt entscheiden dessen Ereignisse.
  _wlAttach(run) {
    const e = this._wl;
    if (!e || e.run) return;
    e.run = run;
    clearTimeout(e.timer);
    e.timer = null;
  }
  // Eintrag abschließen und schreiben. run: nur wenn der Eintrag zu diesem Lauf gehört (sonst egal, z. B. beim Schließen).
  _wlEnd(ende, text, run) {
    this._clEnd(ende, run);   // wake_clip: gleiches Ende (unabhängig von wake_log)
    const e = this._wl;
    if (!e || (run && e.run !== run)) return;
    this._wl = null;
    clearTimeout(e.timer);
    let t = String(text || "").trim();
    if (t.length > 120) t = t.slice(0, 119).trimEnd() + "…";
    this._wlCall({ art: "ausgeloest", wert: e.wert, text: t, ende, bloecke: e.bloecke });
  }
  // Jeder Block der Erkennung (80 ms): Episoden verfolgen. Eine Episode läuft, solange der Wert bei WAKE_LOG_MIN oder darüber bleibt.
  _wlScore(s) {
    if (!this._cfg.wake_log || !this._cfg.wake_word) return;
    const w = this._cfg.wake_word, now = Date.now();
    let ep = this._wlEp;
    if (this._wakeBusy()) { this._wlEp = null; return; }
    if (ep && now - ep.t > WAKE_LOG_BLK) { this._wlEp = null; this._wlKnapp(ep); ep = null; }   // Pause im Block-Takt (Ruhezeit, Mikrofon-Pause)
    if (s >= WAKE_LOG_MIN) {
      if (!ep) ep = this._wlEp = { max: 0, n: 0, t: now, skip: false };
      if (s > ep.max) ep.max = s;
      if (s >= w.threshold) ep.n++;
      ep.t = now;
    } else if (ep) {
      this._wlEp = null;
      this._wlKnapp(ep);
    }
  }
  // Episode zu Ende ohne Erkennung: "knapp" schreiben, höchstens alle WAKE_LOG_GAP ms und WAKE_LOG_HOUR pro Stunde. Liegt die Schwelle selbst
  // bei WAKE_LOG_MIN oder darunter, ist jeder Wert dieser Höhe schon eine Erkennung und es gibt kein "knapp".
  _wlKnapp(ep) {
    const w = this._cfg.wake_word;
    if (!ep || ep.skip || !w || w.threshold <= WAKE_LOG_MIN) return;
    const now = Date.now(), l = this._wlKn;
    while (l.length && now - l[0] >= 3600000) l.shift();
    if (l.length >= WAKE_LOG_HOUR || (l.length && now - l[l.length - 1] < WAKE_LOG_GAP)) return;
    l.push(now);
    this._wlCall({ art: "knapp", wert: ep.max, text: "", ende: "", bloecke: ep.n });
  }
  // ---------- Fehlauslöser aufzeichnen (wake_clip) ----------
  // Zweck: Echte Fehlauslöser des Weckwort-Modells (z. B. Babyschreien) als Trainingsdaten sammeln. Solange das Weckwort-Mikrofon läuft, hält ein
  // Ringpuffer die letzten WAKE_CLIP_PRE Sekunden (fester Speicher, keine Kopien des Tons). Erreicht der erste Block einer Episode die Schwelle, wird ein
  // Clip angelegt: Momentaufnahme des Puffers plus WAKE_CLIP_POST Sekunden danach. Er geht als ein Aufruf des Skripts hinaus (Felder art, wert, bloecke,
  // folge, geraet, audio = WAV als Base64), danach bleibt nichts davon im Speicher:
  // - art "ausgeloest": das Modell hat die Geduld erreicht. folge = wie bei wake_log das Ende (text, leer, fehler, abbruch), geschickt, wenn es feststeht;
  //   wurde die Erkennung abgewiesen (Pip beschäftigt, Fenster unsichtbar): folge "abgewiesen", geschickt, sobald die Nach-Sekunde voll ist.
  // - art "schwelle": Wert über der Schwelle, Geduld nicht erreicht. folge "keine", geschickt, sobald die Nach-Sekunde voll und die Episode vorbei ist.
  // Höchstens ein offener Clip; ein gedrosselter Clip (alle WAKE_CLIP_GAP s, WAKE_CLIP_HOUR pro Stunde) wird gar nicht erst angelegt.
  // Ist die Nach-Sekunde beim Ende noch nicht voll (Mikrofon zu, Fenster sofort geschlossen), geht der Clip mit dem, was da ist.
  _clOn() { return !!(this._cfg.wake_clip && this._cfg.wake_word); }
  // Ton des Weckwort-Mikrofons (16 kHz, Int16): in den Ringpuffer und, bei offenem Clip, in dessen Nach-Teil
  _clFeed(out) {
    if (!this._clOn() || !out || !out.length) return;
    let r = this._clBuf;
    if (!r) r = this._clBuf = { b: new Int16Array(WAKE_CLIP_PRE * WAKE_CLIP_HZ), w: 0, n: 0 };
    const b = r.b, L = b.length, len = out.length;
    if (len >= L) { b.set(out.subarray(len - L)); r.w = 0; r.n = L; }
    else {
      const k = Math.min(len, L - r.w);
      b.set(out.subarray(0, k), r.w);
      if (k < len) b.set(out.subarray(k), 0);
      r.w = (r.w + len) % L;
      r.n = Math.min(L, r.n + len);
    }
    const c = this._cl;
    if (!c) return;
    if (c.pn < c.post.length) {
      const k = Math.min(len, c.post.length - c.pn);
      c.post.set(out.subarray(0, k), c.pn);
      c.pn += k;
    }
    this._clCheck();
  }
  // Jeder Block der Erkennung (80 ms): der erste ab der Schwelle legt den Clip an, weitere zählen nur Höchstwert und Blöcke mit
  _clScore(s) {
    if (!this._clOn()) return;
    const w = this._cfg.wake_word, now = Date.now();
    let c = this._cl;
    if (s >= w.threshold) {
      if (!c) c = this._clOpen(now);
      if (!c) return;
      if (s > c.wert) c.wert = s;
      c.bloecke++;
      c.ep = true;
      c.t = now;
    } else if (c && c.ep) {
      c.ep = false;
      this._clCheck();
    }
  }
  // Clip anlegen (null, wenn gedrosselt): Momentaufnahme des Ringpuffers, ältester Wert zuerst
  _clOpen(now) {
    const l = this._clKn;
    while (l.length && now - l[0] >= 3600000) l.shift();
    if (l.length >= WAKE_CLIP_HOUR || (l.length && now - l[l.length - 1] < WAKE_CLIP_GAP * 1000)) return null;
    l.push(now);
    const r = this._clBuf, n = r ? r.n : 0, pre = new Int16Array(n);
    if (n) {
      const L = r.b.length, a = (r.w - n + L) % L, k = Math.min(n, L - a);
      pre.set(r.b.subarray(a, a + k), 0);
      if (k < n) pre.set(r.b.subarray(0, n - k), k);
    }
    const c = this._cl = { pre, post: new Int16Array(WAKE_CLIP_POST * WAKE_CLIP_HZ), pn: 0, wert: 0, bloecke: 0, ep: true, t: now, art: "schwelle", folge: "keine", acc: false, rej: false, run: null, timer: null };
    c.timer = setTimeout(() => { if (this._cl === c) this._clSend(); }, WAKE_CLIP_SAFE);
    return c;
  }
  // Erkennung angenommen: der Clip wartet auf das Ende des Gesprächs (wie wake_log); kommt binnen WAKE_LOG_WAIT kein Lauf, zählt das als Abbruch
  _clAccept(score) {
    if (!this._clOn()) return;
    let c = this._cl;
    if (c && c.acc) { this._clEnd("abbruch"); c = null; }   // die Erkennung davor ist nicht zu Ende gekommen
    if (!c) c = this._clOpen(Date.now());
    if (!c) return;
    const v = Number(score) || 0;
    if (v > c.wert) c.wert = v;
    if (!c.bloecke) c.bloecke = 1;
    c.art = "ausgeloest";
    c.acc = true;
    c.rej = false;
    c.folge = "";
    clearTimeout(c.timer);
    c.timer = setTimeout(() => { if (this._cl === c) this._clEnd("abbruch"); }, WAKE_LOG_WAIT);
  }
  // Erkennung abgewiesen (Pip beschäftigt, nicht sichtbar): Clip geht, sobald die Nach-Sekunde voll ist
  _clReject() {
    const c = this._cl;
    if (!c || c.acc) return;
    c.art = "ausgeloest";
    c.folge = "abgewiesen";
    c.rej = true;
    this._clCheck();
  }
  // Der Lauf zur Erkennung ist da: ab jetzt entscheiden dessen Ereignisse
  _clAttach(run) {
    const c = this._cl;
    if (!c || !c.acc || c.run) return;
    c.run = run;
    clearTimeout(c.timer);
    c.timer = null;
  }
  // Ende des Gesprächs zur angenommenen Erkennung (gleiche Stellen wie _wlEnd): Clip mit dieser Folge schicken
  _clEnd(ende, run) {
    const c = this._cl;
    if (!c || !c.acc || (run && c.run !== run)) return;
    c.folge = ende;
    this._clSend();
  }
  // Nicht angenommene Clips: schicken, sobald die Nach-Sekunde voll ist und (bei "schwelle") die Episode vorbei ist
  _clCheck() {
    const c = this._cl;
    if (!c || c.acc || c.pn < c.post.length) return;
    if (!c.rej && c.ep && Date.now() - c.t <= WAKE_LOG_BLK) return;
    this._clSend();
  }
  // Mikrofon zu (geschlossen oder pausiert): ein noch wartender, nicht angenommener Clip geht mit dem, was da ist; der Ringpuffer wird freigegeben
  _clClose() {
    const c = this._cl;
    if (c && !c.acc) this._clSend();
    this._clBuf = null;
  }
  // Clip hinausschicken und alle Verweise darauf loslassen. Fehler (auch beim Aufruf) bleiben still.
  _clSend() {
    const c = this._cl;
    if (!c) return;
    this._cl = null;
    clearTimeout(c.timer);
    c.timer = null;
    const id = this._cfg.wake_clip, hass = getHass();
    if (!id || !hass || typeof hass.callService !== "function") return;
    try {
      const data = { art: c.art, wert: Math.round(c.wert * 1000) / 1000, bloecke: c.bloecke, folge: c.folge, geraet: clipDevice(), audio: clipWav(c.pre, c.post.subarray(0, c.pn)) };
      // notifyOnError = false (5. Parameter von hass.callService): sonst zeigt das HA-Frontend bei einem Fehler selbst einen Hinweis
      const p = hass.callService("script", id.slice(7), data, undefined, false);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  // Zwei kurze, aufsteigende Töne aus Oszillatoren (keine Datei). Nur für diesen Ton hängt etwas am Lautsprecher-Ausgang:
  // danach werden Oszillatoren und Gain getrennt (auch wenn der Kontext schläft und "ended" nie kommt).
  _chime(ctx) {
    const nodes = [];
    let done = false, open = 0;
    const off = () => {
      if (done) return;
      done = true;
      nodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
    };
    try {
      const t = ctx.currentTime, g = ctx.createGain();
      nodes.push(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      g.gain.setValueAtTime(0.16, t + 0.07);
      g.gain.exponentialRampToValueAtTime(0.0001, t + CHIME_MS / 1000 - 0.01);
      [[659.25, 0], [880, 0.075]].forEach(([f, d]) => {
        const o = ctx.createOscillator();
        nodes.push(o);
        o.type = "sine";
        o.frequency.value = f;
        o.connect(g);
        open++;
        o.onended = () => { if (--open <= 0) off(); };
        o.start(t + d);
        o.stop(t + d + 0.09);
      });
      setTimeout(off, CHIME_MS + 250);
    } catch (e) { off(); }
  }
  // Ein per Weckwort geöffnetes Fenster schließt sich nach einer Weile von selbst, wenn niemand etwas anfasst.
  _wakeIdleArm() {
    clearTimeout(this._wkIdleT);
    if (!this._wakeOpened) return;
    this._wkIdleT = setTimeout(() => {
      if (this._wakeOpened && this._isOpen && !this._wakeBusy() && !this._ringLoud()) this._close();
    }, WAKE_IDLE);
  }
  _wakeTouched() {
    this._wakeOpened = false;
    clearTimeout(this._wkIdleT);
  }

  // ---------- Bühne (stage) ----------
  // Bei Gesprächen per Aktivierungswort und per Tipp auf die Figur, nur ab 700 px Breite (wie die Spalte rechts) und nur mit stage: true. Das Dashboard
  // wird abgedunkelt, die Figur rollt (ein einziges transform: verschieben und vergrößern) in die Mitte oben, das Fenster steht darunter.
  // Ende: STAGE_LINGER nach der Antwort, außer es folgt eine Nachfrage oder im Eingabefeld steht ein Entwurf; per Tipp geöffnet ohne weiteres Tun
  // nach STAGE_IDLE; eine Berührung des Fensters hält die Bühne STAGE_IDLE. ✕, Tipp auf die Fläche, _close und _reset beenden sofort.
  _stageOk() {
    try { return !!(window.matchMedia && window.matchMedia("(min-width:700px)").matches); } catch (e) { return false; }
  }
  _stageBegin() {
    if (this._stg || !this._cfg.stage || !this._stageOk()) return;
    clearTimeout(this._stgOut);
    this._stgOut = null;
    this._stg = { t: null };
    this._stageLay();
    const h = getHass();
    this._veil.classList.toggle("dk", !!(h && h.themes && h.themes.darkMode));
    this.classList.add("stage");
    this._veil.classList.add("on");
    this._fig.classList.add("stg", "stage");
    this._panel.classList.add("stage");
    void this._panel.offsetWidth;   // Fenster steht zu (unten), bevor _openPanel es hochfahren lässt
    window.addEventListener("resize", this._stgRz);
    window.addEventListener("orientationchange", this._stgRz);
  }
  // Ziel messen: Mitte der Figur bei 50 % der Breite und etwa 22 % der Höhe, mindestens so tief, dass die Ringe oben nicht abgeschnitten werden.
  // Gemessen wird am unverschobenen Anker (.anc), nicht an der Figur selbst, denn die ist ja gerade unterwegs.
  _stageLay() {
    if (!this._stg) return;
    if (!this._stageOk()) { this._stageEnd(); return; }   // Fenster zu schmal geworden: normale Ansicht
    const a = this._anc.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    if (!a.width) return;
    let rs = 1.9;
    try { rs = parseFloat(getComputedStyle(this._fig.querySelector(".pip")).getPropertyValue("--rs")) || 1.9; } catch (e) {}
    const r = a.width / 2, sc = H >= 640 ? 3.2 : Math.max(1.8, 3.2 * H / 640);   // in sehr niedrigen Fenstern etwas kleiner
    const cx = W / 2, cy = Math.max(H * 0.22, 12 + r * sc * rs);
    this._fig.style.setProperty("--sx", Math.round(cx - (a.left + r)) + "px");
    this._fig.style.setProperty("--sy", Math.round(cy - (a.top + r)) + "px");
    this._fig.style.setProperty("--ss", String(Math.round(sc * 100) / 100));
    this._panel.style.setProperty("--stage-top", Math.round(cy + r * sc + 24) + "px");
  }
  // Nach ms (Vorgabe STAGE_LINGER nach der Antwort; STAGE_IDLE nach Tipp, Berührung oder Eingabe) schließen. Nicht, solange etwas läuft, gesprochen
  // wird oder im Eingabefeld ein Entwurf steht (dann bleibt die Bühne bis zum ✕; wird der Entwurf gelöscht, armiert das input-Ereignis neu).
  _stageArm(ms = STAGE_LINGER) {
    const g = this._stg;
    if (!g) return;
    clearTimeout(g.t);
    g.t = null;
    if (this._cur || this._speaking || this._in.value.trim()) return;
    g.t = setTimeout(() => {
      g.t = null;
      if (this._stg === g && !this._cur && !this._speaking && !this._in.value.trim()) this._close();
    }, ms);
  }
  _stageDisarm() {
    const g = this._stg;
    if (g) { clearTimeout(g.t); g.t = null; }
  }
  // Bühne abbauen. Das Fenster schließt der Aufrufer (_close); ist es noch offen (Klingeln, "Neu", Fenster zu schmal), bleibt es als Spalte stehen
  // und die Figur verschwindet wie sonst bei offenem Fenster. Sonst rollt die Figur zurück, das Fenster geht nach unten und die Fläche blendet aus.
  _stageEnd() {
    const g = this._stg;
    if (!g) return;
    this._stg = null;
    clearTimeout(g.t);
    window.removeEventListener("resize", this._stgRz);
    window.removeEventListener("orientationchange", this._stgRz);
    this.classList.remove("stage");
    this._veil.classList.remove("on");
    this._fig.classList.remove("stage");
    if (this._isOpen) {
      this._fig.classList.remove("stg");
      this._fig.classList.add("gone");
      this._panel.classList.remove("stage");
      return;
    }
    clearTimeout(this._stgOut);
    this._stgOut = setTimeout(() => {
      this._stgOut = null;
      if (this._stg) return;
      this._fig.classList.remove("stg");
      this._panel.classList.remove("stage");
    }, STAGE_OUT);
  }

  // ---------- Timer, Wecker, Erinnerungen und Klingeln (alarms) ----------
  // Alles kommt aus Zuständen in hass.states, damit auch Konten ohne Ereignis-Abo (das Wand-Tablet) es sehen: Timer (timer.*,
  // Name als JSON in einem input_text), Uhrzeit-Plätze (input_datetime + input_text mit JSON) und ein Klingel-Signal (input_text
  // mit JSON). Pillen über der Figur zeigen, was läuft oder ansteht; das Klingel-Signal löst Hinweisfeld, Klingelton und Ansage
  // aus. Stoppen und Löschen gehen als Dienste an Home Assistant, das Stellen und Auslösen übernehmen dort Skripte und Automationen.
  _ringKey() { return RING_STORE + (this._cfg.dashboard || pathPart()); }
  _ringLoad() { try { return localStorage.getItem(this._ringKey()) !== "0"; } catch (e) { return true; } }
  _seenKey() { return SEEN_STORE + (this._cfg.dashboard || pathPart()); }
  _seenGet() { try { const s = localStorage.getItem(this._seenKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  _seenSet(key, st) { try { localStorage.setItem(this._seenKey(), JSON.stringify({ key, st })); } catch (e) {} }
  // Konfiguration neu gelesen: Entitäten merken, Schalter und Pillen neu aufbauen
  _alCfg() {
    const al = this._cfg.alarms, ids = [];
    if (al) {
      if (al.klingel) ids.push(al.klingel);
      for (const t of al.timers) { ids.push(t.timer); if (t.name) ids.push(t.name); }
      for (const x of al.slots) ids.push(x.zeit, x.text);
    }
    this._alIds = ids;
    this._alRefs = null;
    this._klRaw = null;
    this._alSig = "";
    this._pmKey = this._pmBusy = "";
    this._plAll = false;
    this._ringOn = !!(al && al.klingel) && this._ringLoad();
    this._ringSwRender();
    this._rcPrep();
    if (al) { this._alStart(); return; }
    this._alStop();
    this._alItems = [];
    this._pls.innerHTML = "";
  }
  _alStart() {
    if (!this._cfg.alarms || !this._visible) return;
    this._rcPrep();
    if (this._alT) this._alSync(true); else this._alLoop();
  }
  _alStop() {
    clearTimeout(this._alT);
    this._alT = null;
    this._klRaw = null;
    this._alRefs = null;
    this._rcDisarm();
    this._ringKill();
  }
  // Zustände lesen: Klingel-Signal und Pillen. Im Sekundentakt (tick) wird immer gerechnet (Countdown, Fenster der Vorschau),
  // sonst nur, wenn sich einer der Zustände geändert hat.
  _alSync(tick) {
    const al = this._cfg.alarms, hass = getHass(), st = hass && hass.states;
    if (!al || !st) return;
    const refs = this._alIds.map(id => st[id]), old = this._alRefs;
    const same = !!old && refs.length === old.length && refs.every((r, i) => r === old[i]);
    this._alRefs = refs;
    if (same && !tick) return;
    this._klSync(hass);
    this._alItems = this._alCompute(hass, Date.now());
    this._plRender();
    if (this._alT && !tick) this._alNext();
  }
  _alLoop() {
    try { this._alSync(true); } catch (e) {}
    this._alNext();
  }
  // Nächster Takt kurz nach dem nächsten Sprung der Restzeit eines laufenden Timers (sonst jede Sekunde): Die Anzeige springt
  // dann mit der Uhr statt bis zu einer Sekunde daneben zu liegen.
  _alNext() {
    clearTimeout(this._alT);
    this._alT = null;
    if (!this._cfg.alarms || !this._visible) return;
    const now = Date.now();
    let ms = 1000;
    for (const i of this._alItems) {
      if (i.kind !== "timer" || i.paused) continue;
      let rem = (i.end - now) % 1000;
      if (rem <= 0) rem += 1000;
      ms = Math.min(ms, rem + 20);
    }
    this._alT = setTimeout(() => this._alLoop(), Math.max(40, ms));
  }
  // Pillen: laufende Timer (aktiv oder pausiert) und Wecker/Erinnerungen der nächsten preview_hours, nach Fälligkeit sortiert.
  _alCompute(hass, now) {
    const al = this._cfg.alarms, st = hass.states, tz = hass.config && hass.config.time_zone, out = [];
    const obj = ent => (ent && st[ent] ? jsonObj(st[ent].state) : null);
    for (const t of al.timers) {
      const s = st[t.timer];
      if (!s || (s.state !== "active" && s.state !== "paused")) continue;
      const o = obj(t.name) || {}, art = o.art === "erinnerung" ? "erinnerung" : "timer";
      const paused = s.state === "paused", a = s.attributes || {};
      let end = 0, rem = 0;
      if (paused) { rem = parseDur(a.remaining); if (rem == null) continue; }
      else { end = Date.parse(a.finishes_at); if (!isFinite(end)) continue; }
      out.push({ key: t.timer, kind: "timer", art, icon: art === "erinnerung" ? "🔔" : "⏱", lbl: String(o.text == null ? "" : o.text).trim(), paused, end, rem, at: paused ? Infinity : end, ent: t.timer, nameEnt: t.name });
    }
    const lim = now + al.preview_hours * 3600000;
    for (const x of al.slots) {
      const z = st[x.zeit], o = obj(x.text);   // leerer Text = Platz frei
      if (!z || !o) continue;
      const ts = Number(z.attributes && z.attributes.timestamp) * 1000;
      if (!isFinite(ts) || ts <= now || ts > lim) continue;
      const art = o.art === "erinnerung" ? "erinnerung" : "wecker", text = String(o.text == null ? "" : o.text).trim();
      out.push({ key: x.zeit, kind: "slot", art, icon: art === "wecker" ? "⏰" : "🔔", lbl: slotWhen(ts, now, tz) + (text ? " " + text : ""), paused: false, at: ts, ent: x.zeit, textEnt: x.text });
    }
    out.sort((p, q) => (p.at < q.at ? -1 : p.at > q.at ? 1 : 0));
    return out;
  }
  _plCount(it, now) { return it.paused ? "‖ " + fmtCount(it.rem) : fmtCount((it.end - now) / 1000); }
  // Pillen zeichnen. Der Aufbau ändert sich nur, wenn sich etwas ändert (Eintrag, Text, Menü); der Countdown läuft in den
  // vorhandenen Elementen weiter, damit ein Tipp nicht ins Leere geht, weil die Pille unter dem Finger neu gebaut wurde.
  _plRender() {
    const items = this._alItems;
    if (this._pmKey && !items.some(i => i.key === this._pmKey)) { this._pmKey = this._pmBusy = ""; clearTimeout(this._pmT); }
    const rest = items.length - PILL_MAX, show = this._plAll ? items : items.slice(0, PILL_MAX);
    const sig = show.map(i => [i.key, i.icon, i.lbl, i.kind, i.paused ? 1 : 0, i.key === this._pmKey ? (this._pmBusy ? 2 : 1) : 0].join("|")).join("\n")
      + "#" + (this._plAll ? "a" : rest > 0 ? rest : "");
    if (sig !== this._alSig) {
      this._alSig = sig;
      const esc = U.esc;
      let h = "";
      for (const i of show) {
        const body = `<span class="pi" aria-hidden="true">${i.icon}</span>${i.lbl ? `<span class="pt">${esc(i.lbl)}</span>` : ""}${i.kind === "timer" ? `<span class="pc" data-k="${esc(i.key)}"></span>` : ""}`;
        if (i.key === this._pmKey) {
          const dis = this._pmBusy ? " disabled" : "";
          h += `<div class="pm" role="group" aria-label="${i.kind === "timer" ? "Timer" : i.art === "wecker" ? "Wecker" : "Erinnerung"}"><div class="pm-h">${body}</div><div class="pm-f"><button class="pri" type="button" data-a="do" data-k="${esc(i.key)}"${dis}>${i.kind === "timer" ? "Stoppen" : "Löschen"}</button><button class="ghost" type="button" data-a="close"${dis}>Schließen</button></div></div>`;
        } else h += `<button class="pl" type="button" data-a="pill" data-k="${esc(i.key)}" aria-haspopup="true">${body}</button>`;
      }
      if (this._plAll && rest > 0) h += `<button class="pl more" type="button" data-a="more">weniger</button>`;
      else if (!this._plAll && rest > 0) h += `<button class="pl more" type="button" data-a="more" aria-label="${rest} weitere anzeigen">+${rest}</button>`;
      this._pls.innerHTML = h;
    }
    const now = Date.now();
    for (const c of this._pls.querySelectorAll(".pc[data-k]")) {
      const it = items.find(i => i.key === c.dataset.k), t = it ? this._plCount(it, now) : "";
      if (c.textContent !== t) c.textContent = t;
    }
  }
  _onStk(e) {
    const b = e.target.closest ? e.target.closest("[data-a]") : null;
    if (!b || b.disabled) return;
    this._unlockAudio();   // jeder Tipp hier schaltet Ton frei (iOS)
    const a = b.dataset.a, k = b.dataset.k || "";
    if (a === "ring") { this._ringStop(); return; }
    if (a === "pill") this._pmKey = this._pmKey === k ? "" : k;
    else if (a === "more") { this._plAll = !this._plAll; this._pmKey = ""; }
    else if (a === "close") this._pmKey = "";
    else if (a === "do") {
      const it = this._alItems.find(x => x.key === k);
      if (it) { this._pmBusy = k; this._alDo(it); } else this._pmKey = "";
    }
    this._plRender();
  }
  // Timer stoppen (und seinen Namen freigeben) bzw. einen Uhrzeit-Platz leeren: direkte Dienste, die auch Nicht-Admins dürfen.
  async _alDo(it) {
    const hass = getHass();
    let ok = false;
    try {
      if (!hass || !hass.callService) throw new Error("hass");
      const clear = id => hass.callService("input_text", "set_value", { entity_id: id, value: "" });
      if (it.kind === "timer") await Promise.all([hass.callService("timer", "cancel", { entity_id: it.ent }), it.nameEnt ? clear(it.nameEnt) : null]);
      else await clear(it.textEnt);
      ok = true;
    } catch (e) { ok = false; }
    if (ok) {
      // Das Menü schließt sich, sobald der Zustand aus Home Assistant da ist; kommt er nicht, nach 4 s von selbst.
      clearTimeout(this._pmT);
      this._pmT = setTimeout(() => { if (this._pmBusy === it.key) { this._pmBusy = this._pmKey = ""; this._plRender(); } }, 4000);
      return;
    }
    if (this._pmBusy === it.key) this._pmBusy = this._pmKey = "";
    this._toast(it.kind === "timer" ? "Stoppen hat nicht geklappt" : "Löschen hat nicht geklappt");
    this._plRender();
  }

  // Klingel-Signal lesen: ein JSON mit t (höchstens 3 Minuten alt), das hier noch nicht abgestellt wurde, löst das Klingeln aus.
  // Wird es leer (anderes Gerät, Sprachbefehl, Zeitablauf in Home Assistant), hört es auch hier auf.
  _klSync(hass) {
    const al = this._cfg.alarms, s = al && al.klingel ? hass.states[al.klingel] : null;
    if (!s) return;
    const raw = String(s.state == null ? "" : s.state);
    if (raw === "unavailable" || raw === "unknown" || raw === this._klRaw) return;   // Verbindung weg: nichts ändern
    this._klRaw = raw;
    const o = parseKl(raw), r = this._ring;
    if (!o) { if (r) this._ringKill(); return; }
    if (r && r.key === o.key) return;
    if (r) this._ringKill();
    if (Date.now() / 1000 - o.t > RING_AGE) return;   // altes Signal (etwa nach dem Neuladen): still
    const sn = this._seenGet();
    let silent = false;
    if (sn && sn.key === o.key) { if (sn.st === "stop") return; silent = sn.st === "rang"; }
    this._ringBegin(o, silent);
  }
  // silent: Das Signal hat hier schon ausgeklungen (Neuladen): nur das Hinweisfeld, ohne Ton und Ansage.
  _ringBegin(o, silent) {
    this._stageEnd();   // Klingel-Hinweis wie bisher: die Bühne geht zu, das Fenster bleibt als Spalte
    const r = this._ring = { art: o.art, text: o.text, t: o.t, key: o.key, begin: Date.now(), until: 0, silent: !!silent, mute: false, over: !!silent, wait: false, tone: null, ann: null, timer: null };
    r.until = r.begin + this._cfg.alarms.ring_seconds * 1000;
    if (!silent) this._seenSet(o.key, "on");
    this._ringView();
    if (!silent && this._ringOn) this._ringAudio(r);
  }
  _ringView() {
    const r = this._ring;
    this._al.hidden = !r;
    this._fig.classList.toggle("ringing", !!r && !r.over);
    if (!r) return;
    this._al.classList.toggle("quiet", r.over);
    this._alI.textContent = RING_ICON[r.art] || "🔔";
    this._alTi.textContent = ringTitle(r);
    this._alSu.textContent = r.art === "wecker" ? r.text : "";
    this._alHi.textContent = r.wait && this._ringOn ? "Einmal tippen, dann klingelt es." : "";
  }
  _ringSwRender() {
    const k = !!(this._cfg.alarms && this._cfg.alarms.klingel);
    this._rgRow.hidden = !k;
    this._rgSw.setAttribute("aria-checked", k && this._ringOn ? "true" : "false");
    this._rgHint.textContent = !k ? "" : this._ringOn ? "Timer, Wecker und Erinnerungen läuten hier." : "Nur ein Hinweis auf dem Bildschirm, kein Ton.";
  }
  _ringToggle() {
    if (!this._cfg.alarms || !this._cfg.alarms.klingel) return;
    this._ringOn = !this._ringOn;
    try { if (this._ringOn) localStorage.removeItem(this._ringKey()); else localStorage.setItem(this._ringKey(), "0"); } catch (e) {}
    const r = this._ring;
    if (this._ringOn) {
      this._unlockAudio();   // der Tipp auf den Schalter zählt
      if (r && !r.over && !r.silent) this._ringAudio(r);
    } else this._ringSilence();
    this._rcPrep();
    this._ringSwRender();
    this._ringView();
  }
  // Stopp: Ton aus, Ansage ab, Signal in Home Assistant leeren (dann hören alle Geräte auf). Das Signal gilt hier als abgestellt.
  _ringStop() {
    const r = this._ring, al = this._cfg.alarms;
    if (!r) return;
    this._seenSet(r.key, "stop");
    this._ringKill();
    const hass = getHass();
    if (!al || !al.klingel || !hass || !hass.callService) return;
    const fail = () => this._toast("Stopp hat nicht geklappt");
    try { Promise.resolve(hass.callService("input_text", "set_value", { entity_id: al.klingel, value: "" })).catch(fail); } catch (e) { fail(); }
  }
  // Klingeln beenden, ohne Home Assistant anzusprechen (Signal von außen weg, Dock versteckt, Neues Signal)
  _ringKill() {
    const r = this._ring;
    this._ring = null;
    if (r) {
      clearTimeout(r.timer);
      this._toneOff(r);
      const ann = r.ann;
      if (ann && !ann.done) { if (this._annc === ann) this._stopAudio(); else this._annEnd(ann); }
      this._rcIdle();
    }
    this._ringView();
  }
  // Ton und Ansage aus, das Hinweisfeld bleibt (Schalter aus, Mikrofon-Knopf)
  _ringSilence() {
    const r = this._ring;
    if (!r) return;
    r.mute = true;
    clearTimeout(r.timer);
    this._toneOff(r);
    const ann = r.ann;
    if (ann && !ann.done) { if (this._annc === ann) this._stopAudio(); else this._annEnd(ann); }
    this._rcIdle();
  }
  // Ton starten, sobald der Kontext läuft; sonst (iOS vor dem ersten Tipp) Hinweis zeigen und beim nächsten Tipp nachholen.
  _ringAudio(r) {
    r.mute = false;
    const ctx = this._rcGet();
    if (!ctx) return;
    let p;
    try { p = ctx.resume(); } catch (e) {}
    Promise.race([Promise.resolve(p).catch(() => {}), delay(400)]).then(() => {
      if (this._ring !== r || r.over || r.mute) return;
      if (ctx.state === "running") { this._rcOk = true; this._ringGo(r); }
      else { this._rcOk = false; r.wait = true; this._rcArm(); this._ringView(); }
    });
  }
  _ringGo(r) {
    if (this._ring !== r || r.over || r.mute) return;
    r.wait = false;
    this._ringView();
    const left = r.until - Date.now();
    if (left <= 0) { this._ringOver(r); return; }
    clearTimeout(r.timer);
    r.timer = setTimeout(() => this._ringOver(r), left);
    this._toneOn(r);
    if (!r.ann) this._annStart(r);
  }
  // Nach ring_seconds ist es still; das Hinweisfeld bleibt mit Stopp, bis es abgestellt wird oder Home Assistant das Signal zurücknimmt.
  _ringOver(r) {
    if (this._ring !== r || r.over) return;
    r.over = true;
    clearTimeout(r.timer);
    this._toneOff(r);
    this._seenSet(r.key, "rang");
    if (!r.ann || r.ann.done) this._rcIdle();
    this._ringView();
  }

  // Eigener AudioContext fürs Klingeln (Rate des Geräts). Er schläft, solange nichts klingt, und hängt nur während des Tons am Ausgang.
  _rcGet() {
    if (!this._rc || this._rc.state === "closed") { this._rc = mkCtx(); this._rcOk = false; }
    return this._rc;
  }
  _rcIdle() {
    const c = this._rc, r = this._ring;
    if (!c || c.state !== "running" || (r && (r.tone || (!r.over && !r.mute)))) return;
    try { const p = c.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // Im Tipp den Kontext starten (iOS lässt Ton nur nach einer Berührung zu); danach darf er schlafen und lässt sich ohne Tipp wecken.
  _rcUnlock() {
    const al = this._cfg.alarms;
    if (!al || !al.klingel || !this._ringOn || (this._rcOk && this._rc && this._rc.state !== "closed")) return;
    const ctx = this._rcGet();
    if (!ctx) return;
    let p;
    try { p = ctx.resume(); } catch (e) { return; }
    Promise.resolve(p).then(() => {
      if (ctx.state !== "running" || this._rc !== ctx) return;
      this._rcOk = true;
      this._rcDisarm();
      const r = this._ring;
      if (r && r.wait && !r.over && !r.mute) this._ringGo(r); else this._rcIdle();
    }, () => {});
  }
  _rcPrep() {
    const al = this._cfg.alarms;
    if (al && al.klingel && this._ringOn && this._visible && !this._rcOk) this._rcArm();
    else if (!this._ring || !this._ring.wait) this._rcDisarm();
  }
  _rcArm() {
    if (this._rcArmed) return;
    this._rcArmed = true;
    for (const t of ["pointerdown", "touchend", "click", "keydown"]) document.addEventListener(t, this._rcGest, true);
  }
  _rcDisarm() {
    if (!this._rcArmed) return;
    this._rcArmed = false;
    for (const t of ["pointerdown", "touchend", "click", "keydown"]) document.removeEventListener(t, this._rcGest, true);
  }
  // Klingelton: alle RING_GAP ms ein Glockenschlag aus Oszillatoren (keine Datei). Nur solange er klingt, hängt ein Gain am Ausgang.
  _toneOn(r) {
    const ctx = this._rc;
    if (!ctx || r.tone || r.over || r.mute || this._ring !== r || (this._annc && this._annc.ring === r)) return;
    let mg;
    try { mg = ctx.createGain(); mg.gain.value = 1; mg.connect(ctx.destination); } catch (e) { return; }
    const tn = r.tone = { mg, nodes: new Set(), timer: null };
    const strike = () => {
      if (r.tone !== tn) return;
      tn.timer = setTimeout(strike, RING_GAP);
      try { this._bell(ctx, tn); } catch (e) {}
    };
    this._preClear();   // es klingelt: auch ein vorab geöffnetes Mikrofon (Rückfrage) geht wieder zu
    this._micSync();   // erst das Mikrofon frei geben, dann läuten
    strike();
  }
  // Ein Schlag: zwei Töne (A5, E6), je mit einem leicht unharmonischen Oberton, weich ausklingend.
  _bell(ctx, tn) {
    const t = ctx.currentTime + 0.02;
    [[880, 0], [1318.5, 0.22]].forEach(([f, d]) => {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t + d);
      env.gain.exponentialRampToValueAtTime(0.2, t + d + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.05);
      env.connect(tn.mg);
      tn.nodes.add(env);
      let open = 2;
      [[1, 1], [2.76, 0.3]].forEach(([m, a]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f * m;
        g.gain.value = a;
        o.connect(g);
        g.connect(env);
        tn.nodes.add(o);
        tn.nodes.add(g);
        o.onended = () => {
          try { o.disconnect(); g.disconnect(); } catch (e) {}
          tn.nodes.delete(o);
          tn.nodes.delete(g);
          if (--open === 0) { try { env.disconnect(); } catch (e) {} tn.nodes.delete(env); }
        };
        o.start(t + d);
        o.stop(t + d + 1.1);
      });
    });
  }
  _toneOff(r) {
    const tn = r && r.tone;
    if (!tn) return;
    r.tone = null;
    clearTimeout(tn.timer);
    for (const n of tn.nodes) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
    tn.nodes.clear();
    try { tn.mg.disconnect(); } catch (e) {}
    this._micSync();
  }

  // Ansage zu Beginn: Assist-Pipeline nur mit Sprachausgabe (tts -> tts); die Adresse wird wie eine Antwort abgespielt.
  // Der Klingelton pausiert dabei und läuft danach weiter. Ein laufendes Gespräch geht vor.
  _annStart(r) {
    if (r.ann) return;
    const hass = getHass(), conn = hass && hass.connection;
    if (!conn || !conn.subscribeMessage || this._cur || (this._speaking && !this._annc)) return;
    const msg = { type: "assist_pipeline/run", start_stage: "tts", end_stage: "tts", input: { text: ringSay(r) } };
    if (this._cfg.pipeline_id) msg.pipeline = this._cfg.pipeline_id;
    const ann = r.ann = { ring: r, done: false, got: false, unsub: null, timer: null };
    ann.timer = setTimeout(() => this._annEnd(ann), ANN_WAIT);
    let p;
    try { p = conn.subscribeMessage(ev => { try { this._annEvent(ann, ev); } catch (e) {} }, msg, { resubscribe: false }); }
    catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(u => { ann.unsub = u; if (ann.done) this._annUnsub(ann); }, () => this._annEnd(ann));
  }
  _annUnsub(ann) {
    const u = ann.unsub;
    ann.unsub = null;
    if (u) { try { const x = u(); if (x && x.catch) x.catch(() => {}); } catch (e) {} }
  }
  _annEvent(ann, ev) {
    if (!ev || ann.done) return;
    if (ev.type === "run-start") this._annEarly(ann, ev.data);
    else if (ev.type === "tts-end") {
      const o = ev.data && ev.data.tts_output, url = o && o.url;
      if (url) { ann.got = true; if (!this._streamSkip(ann, o)) this._annPlay(ann, url); }
    } else if (ev.type === "error") this._annEnd(ann);
    else if (ev.type === "run-end") { this._annUnsub(ann); if (!ann.got) this._annEnd(ann); }
  }
  // Liefert run-start schon einen Stream (stream_response), wird die Ansage dort gestartet; der Klingelton läuft, bis Ton da ist.
  _annEarly(ann, d) {
    const o = d && d.tts_output, r = ann.ring;
    if (!this._cfg.early_tts || !o || o.stream_response !== true || typeof o.url !== "string" || !o.url) return;
    if (this._ring !== r || r.over || r.mute || this._cur || (this._speaking && !this._annc)) return;
    const s = ann.str = { run: null, ann, url: o.url, token: o.token || "", st: "wait", tts: false };
    this._play(o.url, ann, s);
  }
  _annPlay(ann, url) {
    const r = ann.ring;
    if (this._ring !== r || r.over || r.mute || this._cur || (this._speaking && !this._annc)) { this._annEnd(ann); return; }
    clearTimeout(ann.timer);
    this._toneOff(r);
    this._play(url, ann);
  }
  // Ansage zu Ende, gescheitert oder abgebrochen: der Klingelton läuft weiter, solange noch Zeit ist.
  _annEnd(ann) {
    if (!ann || ann.done) return;
    ann.done = true;
    clearTimeout(ann.timer);
    this._annUnsub(ann);
    if (this._annc === ann && this._strm && this._strm.ann === ann) this._stopAudio();   // früh gestartete Ansage, die nicht mehr kommt
    const r = ann.ring;
    if (this._ring === r && !r.over && !r.mute && r.until > Date.now()) this._toneOn(r); else this._rcIdle();
  }

  // ---------- Aktionskarten (Ereignis fp_pip_karte) ----------
  _subs() {
    const hass = getHass(), conn = hass && hass.connection;
    if (!conn || !conn.subscribeEvents || this._evConn === conn) return;
    // Konten ohne Administratorrechte dürfen keine Ereignisse abonnieren (Home Assistant lehnt es ab und schreibt es ins Protokoll): gar nicht erst versuchen
    if (hass.user && hass.user.is_admin === false) return;
    this._unsubEvents();
    this._evConn = conn;
    let p;
    try { p = conn.subscribeEvents(ev => { try { this._onCardEvent(ev); } catch (e) {} }, EVT); }
    catch (e) { return; }
    // Fehler (z. B. kein Admin) still ignorieren: dann gibt es eben keine Karten.
    Promise.resolve(p).then(u => {
      if (this._evConn === conn) this._evUnsub = u;
      else { try { const r = u(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    }, () => {});
  }
  _unsubEvents() {
    const u = this._evUnsub;
    this._evUnsub = null;
    this._evConn = null;
    if (u) { try { const r = u(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  }
  _onCardEvent(ev) {
    const d = ev && ev.data;
    if (!d || typeof d !== "object") return;
    // Nur während einer Frage oder kurz danach, sonst kämen Karten aus Gesprächen anderer Geräte.
    if (!this._cur && Date.now() - this._ansAt > 20000) return;
    const art = d.art;
    if (art !== "neu" && art !== "bestaetigen" && art !== "info") return;
    const zeilen = (Array.isArray(d.zeilen) ? d.zeilen : []).map(z => Array.isArray(z)
      ? [z[0] == null ? "" : String(z[0]), z[1] == null ? "" : String(z[1])] : [z == null ? "" : String(z), ""]);
    const it = { k: "card", art, titel: d.titel == null ? "" : String(d.titel), zeilen, rueck: d.rueckgaengig || null, code: d.code, st: art === "bestaetigen" ? "ask" : art === "neu" ? "open" : "info" };
    if (art === "neu") {
      if (!this._undoOk(it.rueck)) it.st = "done";
      else it.timer = setTimeout(() => {
        // Nach 10 s ist "Rückgängig" weg (rückgängig lässt sich dann in der Liste oder im Kalender selbst).
        if (it.st === "open") { it.st = "done"; this._renderLog(); }
      }, 10000);
    }
    this._push(it);
    this._renderLog();
  }
  _undoOk(r) {
    if (!r || typeof r !== "object") return false;
    if (r.typ === "kalender") return !!(r.kalender && r.summary && r.start);
    if (r.typ === "liste") return !!(r.liste && Array.isArray(r.eintraege) && r.eintraege.length);
    return false;
  }
  async _undo(it) {
    it.st = "undoing";
    this._renderLog();
    let ok = false;
    try { await this._doUndo(it.rueck); ok = true; } catch (e) { ok = false; }
    it.st = ok ? "undone" : "undofail";
    this._renderLog();
    if (!ok) this._toast("Rückgängig hat nicht geklappt");
  }
  async _doUndo(r) {
    const hass = getHass();
    if (!hass || !r) throw new Error("hass");
    if (r.typ === "kalender") {
      const m = String(r.start).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
      if (!m) throw new Error("start");
      // Weites Fenster um den Tag; der Beginn wird unten in der Zeitzone von Home Assistant verglichen.
      const day = Date.UTC(+m[1], +m[2] - 1, +m[3]);
      const von = new Date(day - 86400000).toISOString(), bis = new Date(day + 2 * 86400000).toISOString();
      const evts = await hass.callApi("GET", `calendars/${r.kalender}?start=${encodeURIComponent(von)}&end=${encodeURIComponent(bis)}`);
      const timed = m[4] !== undefined;
      const want = timed ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`;
      const tz = hass.config && hass.config.time_zone;
      const sum = String(r.summary).trim();
      const ev = (Array.isArray(evts) ? evts : []).find(x => {
        if (!x || !x.uid || String(x.summary || "").trim() !== sum) return false;
        const s = x.start || {};
        if (timed) return !!s.dateTime && localStr(s.dateTime, tz).slice(0, 16) === want;
        return !!s.date && String(s.date).slice(0, 10) === want;
      });
      if (!ev) throw new Error("nicht gefunden");
      const msg = { type: "calendar/event/delete", entity_id: r.kalender, uid: ev.uid };
      if (ev.recurrence_id) msg.recurrence_id = ev.recurrence_id;
      await hass.callWS(msg);
    } else if (r.typ === "liste") {
      const items = (Array.isArray(r.eintraege) ? r.eintraege : []).map(String).filter(Boolean);
      if (!r.liste || !items.length) throw new Error("liste");
      for (const item of items) await hass.callService("todo", "remove_item", { entity_id: r.liste, item });
    } else throw new Error("typ");
  }
  // Hinweis über ein Element im HA-Baum senden: das Dock hängt außerhalb davon.
  _toast(msg) {
    const t = lastCard && lastCard.isConnected ? lastCard : (document.querySelector("home-assistant") || this);
    U.toast(t, msg);
  }
}

if (!customElements.get("fp-pip-dock")) customElements.define("fp-pip-dock", FpPipDock);
if (!customElements.get("fp-assistant-card")) {
  customElements.define("fp-assistant-card", FpAssistantCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "fp-assistant-card", name: "FP Assistant Card (Pip)", description: "Unsichtbare Karte: schaltet den schwebenden Sprachassistenten Pip in allen Tabs des Dashboards frei (Assist-Pipeline, Mikrofon, Vorlesen, Aktionskarten, Seite links oder rechts, optional Aktivierungswort im Browser sowie Timer, Wecker und Erinnerungen als Pillen mit Klingeln)", preview: false });
}

// Selbststart: Gibt es für den aktuellen Dashboard-Pfad eine gespeicherte Konfiguration, kommt die Figur von allein,
// auch wenn direkt ein anderer Tab neu geladen wird. Beim Seitenwechsel wird neu entschieden.
const nav = () => { try { syncDock(); } catch (e) {} };
window.addEventListener("location-changed", nav);
window.addEventListener("popstate", nav);
window.addEventListener("resize", () => { try { if (dock && typeof dock.applyLift === "function") { dock.applyLift(); dock.applyPos(); } } catch (e) {} });
if (document.body) nav(); else document.addEventListener("DOMContentLoaded", nav, { once: true });
})();
