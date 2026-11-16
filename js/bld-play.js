/*!
 * js/bld-play.js — Builds: «Cómo se juega» en la ficha (BL-084 EQ-7)
 * Versión: 1.2.0 (2026-11-02) · EQ-8 PvP: fuera de PvE, el control avisa al pie que duraciones y recargas son las de
 *          PvE (la API oficial no separa los valores por modo) · 1.1.0 (2026-10-31) · EQ-8: en WvW y PvP el control se titula «Control (contra jugadores)», porque la barra de
 *          desafío es solo de PvE; el modo llega de la ficha (m.mode) · antes 1.0.0 (2026-10-30)
 *
 * La tercera sección de la ficha, como «Rotation & Extras» de Snow Crows pero con mis palabras (DEC-046):
 * Conceptos (qué hace la build y qué cuidar), Apertura (pasos numerados), Bucle (lo que se repite) y Control (cómo
 * romper la barra de desafío). Cada paso puede nombrar habilidades, rasgos u objetos con {s:ID}, {t:ID} o {i:ID}: van
 * con su ícono y su nombre oficial en castellano (js/bld-notes.js 1.1.0, inline()).
 * Las notas son las mismas de assets/data/builds/notes.json (claves concepts, opener, loop, cc: listas de textos); las
 * lee js/bld-notes.js una vez por visita, en memoria (sin estado guardado). Sin nota, lo digo y queda el enlace a la
 * rotación completa de la guía original, que siempre está al pie.
 */
(function (root) {
  'use strict';

  var VERSION = '1.2.0';
  // [clave, título, lista numerada]
  var PARTS = [['concepts', 'Conceptos', false], ['opener', 'Apertura', true], ['loop', 'Bucle', true], ['cc', 'Control (barra de desafío)', false]];
  var KEYS = PARTS.map(function (p) { return p[0]; });
  var TOKEN = /\{([sti]):(\d+)\}/g;
  // EQ-8: contra jugadores (WvW y PvP) no hay barra de desafío: el control se titula distinto.
  var CC_PVP = 'Control (contra jugadores)';
  // La API publica los valores de PvE y no los separa por modo: en WvW y PvP lo aviso al pie del control.
  var CC_SPLIT = 'Duraciones y recargas: las de la API oficial, que publica los valores de PvE; en WvW y PvP algunas son distintas.';
  function vsPlayers(mode) { return mode === 'wvw' || mode === 'pvp'; }
  function titleOf(p, mode) { return p[0] === 'cc' && (mode === 'wvw' || mode === 'pvp') ? CC_PVP : p[1]; }

  function S() { return root.GNBldShow; }
  function N() { return root.GNBldNotes; }
  function esc(s) {
    return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

  // ---------------------------------------------------------------- modelo (puro)
  // Los textos válidos de una parte de la nota (lista de textos no vacíos).
  function partOf(note, key) {
    var v = note && note[key];
    return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
  }
  function hasPlay(note) { return KEYS.some(function (k) { return partOf(note, k).length > 0; }); }
  // Un texto con {s|t|i:ID}: ícono y nombre oficial con bld-notes; sin ese módulo, el texto escapado y #ID.
  function inline(text, ref, gear) {
    var n = N();
    if (n && typeof n.inline === 'function') return n.inline(text, ref, gear);
    return esc(text).replace(TOKEN, function (_, k, id) { return '<b>#' + id + '</b>'; });
  }

  // ---------------------------------------------------------------- vista (pura)
  function partHTML(p, m) {
    var xs = partOf(m.note, p[0]);
    if (!xs.length) return '';
    var items = xs.map(function (x) { return inline(x, m.ref, m.gear); });
    var body = p[2] ? '<ol class="bld-pl-seq">' + items.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ol>'
      : items.map(function (h) { return '<p>' + h + '</p>'; }).join('');
    return '<section class="bld-pl" data-play="' + p[0] + '" aria-labelledby="bldPl-' + p[0] + '"><h5 id="bldPl-' + p[0] + '">' + esc(titleOf(p, m.mode)) + '</h5>' + body +
      (p[0] === 'cc' && vsPlayers(m.mode) ? '<p class="bld-muted bld-pl-split"><small>' + esc(CC_SPLIT) + '</small></p>' : '') + '</section>';
  }
  function sourceHTML(src, has) {
    if (!src || !src.url) return '';
    return '<p class="bld-muted bld-pl-src">' + (has ? 'La rotación completa, paso a paso, está en la guía original: ' : 'Mientras, la rotación completa está en la guía original: ') +
      '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.name || 'la fuente') + ' ↗</a>.</p>';
  }
  // m = { note, loaded, ref, gear, source, mode }
  function html(m) {
    m = m || {};
    if (!m.loaded) return '<p class="bld-muted" role="status">Buscando mis notas para jugarla…</p>';
    var n = m.note, has = hasPlay(n);
    if (!has) {
      return '<p class="bld-muted">Mis notas para jugar esta build (conceptos, apertura, bucle y control) están en preparación.</p>' + sourceHTML(m.source, false);
    }
    return '<div class="bld-play">' +
      '<p class="bld-ntm"><small>Notas de Shiruvana' + (fmtDate(n.patch) ? ' · revisadas para el parche ' + fmtDate(n.patch) : '') + '</small>' +
      (n.review ? ' <span class="bld-tag is-old">para revisar: la build cambió</span>' : '') + '</p>' +
      PARTS.map(function (p) { return partHTML(p, m); }).join('') + sourceHTML(m.source, true) + '</div>';
  }

  // ---------------------------------------------------------------- CSS (tokens de los 19 temas)
  var P_ = '#buildsPanel ';
  var CSS = [
    P_ + '.bld-play{display:grid;gap:10px;font-size:.9rem;color:var(--tx-1)}' + P_ + '.bld-play p{margin:0}',
    P_ + '.bld-play .bld-ntm small{color:var(--tx-2)}',
    P_ + '.bld-pl{display:grid;gap:6px;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);padding:8px 12px 10px}',
    P_ + '.bld-pl h5{margin:0;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:var(--tx-2)}',
    P_ + '.bld-pl-seq{margin:0;padding-left:1.6em;display:grid;gap:6px}' + P_ + '.bld-pl-seq li::marker{color:var(--gn-mod);font-weight:700}',
    P_ + '.bld-pl .bld-ntr{display:inline-flex;align-items:center;gap:4px;vertical-align:middle}' + P_ + '.bld-pl .bld-ntr img{border-radius:4px}',
    P_ + '.bld-pl-src{font-size:.82rem}',
    P_ + '.bld-pl-src a:focus-visible{outline:2px solid var(--gn-mod);outline-offset:2px}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-play-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-play-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  var api = { version: VERSION, KEYS: KEYS, html: html, hasPlay: hasPlay, ensureCss: ensureCss,
    _pure: { PARTS: PARTS, titleOf: titleOf, CC_PVP: CC_PVP, CC_SPLIT: CC_SPLIT, vsPlayers: vsPlayers, partOf: partOf, inline: inline, partHTML: partHTML, sourceHTML: sourceHTML, CSS: CSS, TOKEN: TOKEN } };
  root.GNBldPlay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
