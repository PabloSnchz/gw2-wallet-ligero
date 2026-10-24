/*!
 * js/ach-armory.js — Logros: de una colección a su legendaria en la Armería (BL-067, LOG-4)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Une Logros con la Armería sin pedir nada nuevo a la API:
 *  - Arma un índice «pieza → legendaria» con las recetas que ya carga la Armería
 *    (LegendaryRecipes, las 206 legendarias; y LegendaryPrecursors cuando está, para bajar
 *    a los precursores y sus partes).
 *  - Una recompensa de logro lleva a una legendaria solo si es la legendaria misma o una pieza
 *    de UNA sola legendaria. Las piezas que comparten muchas (Don de la Maestría, tréboles…)
 *    no llevan a ninguna: sería un salto engañoso.
 *  - linkHTML(x) da el enlace «Ver en la Armería →» para la tarjeta (lo pinta ach-cards.js).
 *  - Al tocarlo, la ruta cambia a la Armería y, cuando está lista, se abre la ficha de esa
 *    legendaria con LegendaryTracker.openItemModal(id) (API pública de la Armería).
 *  - En «Colecciones legendarias» pide una vez los precursores (los mismos que baja la Armería
 *    al abrir una ficha) para encontrar también las colecciones de partes.
 * Sin API Key ni claves. Se carga por js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[AchArmory]';
  var ROUTE = '#/account/legendary-armory';
  var MAX_DEPTH = 12, WAIT_MS = 100, WAIT_TRIES = 40;

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // entry(id) → { name, nameEs, dataStatus, ingredients: [{ itemId }] } o null.
  // Índice: pieza → ids de las legendarias en cuyo árbol aparece (la legendaria se apunta a sí misma).
  function buildIndex(rootIds, entry) {
    var idx = {};
    function add(piece, leg) {
      var k = String(piece), s = idx[k] || (idx[k] = []);
      if (s.indexOf(leg) < 0) s.push(leg);
    }
    (rootIds || []).forEach(function (rid) {
      var leg = Number(rid), e = entry(leg);
      if (!e || e.dataStatus === 'placeholder') return;
      add(leg, leg);
      var seen = {};
      (function walk(x, depth) {
        if (!x || depth > MAX_DEPTH) return;
        (x.ingredients || []).forEach(function (ing) {
          var cid = Number(ing && ing.itemId);
          if (!cid || seen[cid]) return;
          seen[cid] = true;
          add(cid, leg);
          walk(entry(cid), depth + 1);
        });
      })(e, 0);
    });
    return idx;
  }

  // La legendaria a la que lleva un logro: la primera recompensa de tipo ítem que es una
  // legendaria o pieza de una sola. null si ninguna lo es.
  function legendaryIdFor(meta, idx) {
    var rw = meta && Array.isArray(meta.rewards) ? meta.rewards : [];
    for (var i = 0; i < rw.length; i++) {
      var r = rw[i];
      if (!r || r.type !== 'Item' || r.id == null) continue;
      var legs = idx[String(r.id)];
      if (legs && legs.indexOf(Number(r.id)) >= 0) return Number(r.id); // la recompensa es la legendaria
      if (legs && legs.length === 1) return legs[0];
    }
    return null;
  }

  function nameOf(e, id) { return (e && (e.nameEs || e.name)) || ('#' + id); }

  function linkMarkup(id, name) {
    return '<a class="achc-armory" href="' + ROUTE + '" data-ach-armory="' + esc(id) + '" title="Ver «' + esc(name) + '» en la Armería"' +
      ' aria-label="Ver la legendaria «' + esc(name) + '» en la Armería">Ver en la Armería →</a>';
  }

  // ------------------------------------------------------------------ datos de la Armería
  var st = { idx: null, withPrec: false, pending: null, timer: null, asked: false, wired: false };

  function entryFn() {
    var T = root.LegendaryTree, R = root.LegendaryRecipes, P = root.LegendaryPrecursors;
    if (T && typeof T.entry === 'function') return function (id) { return T.entry(id); };
    return function (id) {
      var e = R && typeof R.get === 'function' ? R.get(id) : null;
      if (!e && P && typeof P.get === 'function') e = P.get(id);
      return e || null;
    };
  }

  // El índice se arma una vez, y otra más cuando llegan los precursores.
  function index() {
    var R = root.LegendaryRecipes, hasPrec = !!root.LegendaryPrecursors;
    if (!R || !R.byItem) return null;
    if (!st.idx || (hasPrec && !st.withPrec)) {
      st.idx = buildIndex(Object.keys(R.byItem), entryFn());
      st.withPrec = hasPrec;
    }
    return st.idx;
  }

  // Lo que necesita la tarjeta: { id, name } o null.
  function legendaryFor(x) {
    var idx = index();
    var id = idx ? legendaryIdFor(x && x.meta, idx) : null;
    return id == null ? null : { id: id, name: nameOf(entryFn()(id), id) };
  }

  function linkHTML(x) {
    var l = legendaryFor(x);
    return l ? linkMarkup(l.id, l.name) : '';
  }

  // En «Colecciones legendarias»: los precursores, una sola vez, y se vuelven a pintar las tarjetas.
  function wantDeep() {
    if (st.asked || root.LegendaryPrecursors) return;
    var UI = root.LegendaryTreeUI;
    if (!UI || typeof UI.ensurePrecursors !== 'function') return;
    st.asked = true;
    UI.ensurePrecursors(function (ok) {
      if (!ok) return;
      st.idx = null;
      if (root.AchCards && typeof root.AchCards.render === 'function') root.AchCards.render();
      if (root.AchView && typeof root.AchView.render === 'function') root.AchView.render();
    });
  }

  // ------------------------------------------------------------------ el salto
  var doc = root.document;
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function armoryReady() {
    var p = byId('legendaryArmoryPanel'), LT = root.LegendaryTracker;
    return !!(p && !p.hidden && p.getAttribute && p.getAttribute('hidden') == null && byId('legendaryModeContent') &&
      LT && typeof LT.openItemModal === 'function');
  }

  // Espera a que el router muestre la Armería y abre la ficha. Si no llega, queda el catálogo.
  function openWhenReady(id, tries) {
    clearTimeout(st.timer);
    if (st.pending !== id) return false;
    var onRoute = root.location && String(root.location.hash || '') === ROUTE;
    if (onRoute && armoryReady()) {
      st.pending = null;
      try { root.LegendaryTracker.openItemModal(id); } catch (e) { if (root.console) root.console.warn(LOG, 'ficha', e); }
      return true;
    }
    if (tries >= WAIT_TRIES) { st.pending = null; return false; }
    st.timer = setTimeout(function () { openWhenReady(id, tries + 1); }, WAIT_MS);
    return false;
  }

  function go(id) {
    st.pending = Number(id);
    if (root.location && String(root.location.hash || '') !== ROUTE) root.location.hash = ROUTE;
    return openWhenReady(st.pending, 0);
  }

  function attr(t, k) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(k) != null) return n.getAttribute(k);
    return null;
  }

  function init() {
    if (st.wired || !doc || !doc.addEventListener) return;
    st.wired = true;
    // Clic normal: salto con ficha abierta. Con Ctrl, Shift o el botón del medio, el enlace hace lo suyo.
    doc.addEventListener('click', function (e) {
      var id = attr(e && e.target, 'data-ach-armory');
      if (id == null || (e.button && e.button !== 0) || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.preventDefault) e.preventDefault();
      go(Number(id));
    });
  }

  root.AchArmory = {
    version: VERSION, linkHTML: linkHTML, legendaryFor: legendaryFor, wantDeep: wantDeep, go: go,
    _pure: { buildIndex: buildIndex, legendaryIdFor: legendaryIdFor, linkMarkup: linkMarkup, ROUTE: ROUTE },
    _state: st
  };

  init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
