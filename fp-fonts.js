/* fp-fonts v1 — laedt Nunito fuer das Theme familienplaner-warm.
 *
 * Warum eine eigene Datei und nicht einfach eine CSS-Ressource in Lovelace?
 * Der Ressourcentyp wird beim Anlegen auf "module" gesetzt; eine Stylesheet-URL
 * wuerde dann als JavaScript geladen und scheitern. Ein Modul darf sich das
 * Stylesheet aber selbst in den Kopf haengen.
 *
 * Bewusst getrennt von family-planner-cards.js: Die Karten sollen niemanden
 * zu einer Schriftart zwingen, der sie nur die Karten haben will.
 *
 * Nach /local/fp-fonts.js kopieren und als Lovelace-Ressource (Modul) eintragen.
 * Ist das Geraet offline, passiert schlicht nichts — das Theme faellt dann auf
 * die Systemschrift zurueck.
 */
(() => {
  const ID = "fp-font-nunito";
  if (document.getElementById(ID)) return;
  const l = document.createElement("link");
  l.id = ID;
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap";
  document.head.appendChild(l);
})();
