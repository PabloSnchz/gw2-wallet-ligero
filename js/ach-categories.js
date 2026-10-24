/*!
 * js/ach-categories.js — Logros: «Por categoría», agrupada por expansión o modo (BL-067, LOG-3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Arma el contenido de la pestaña «Por categoría» de ach-view.js (1.1.0 o más):
 *  - Las categorías van dentro de su grupo oficial de Guild Wars 2 (expansión, Mundo Viviente,
 *    modo de juego…), en el orden del juego. Un solo pedido público a /v2/achievements/groups,
 *    en español, guardado en memoria mientras la página esté abierta.
 *  - Cada grupo dice cuántas categorías muestra y cuánto llevás; cada categoría, su ícono
 *    oficial, «N de M» terminados, una barra verde (dorada desde el 95 %) y cuántos tenés cerca.
 *  - Buscador de categoría o grupo, y «Con pendientes» / «Todas».
 *  - Tocar una categoría con pendientes abre «Casi listos» con todos sus logros (lo hace
 *    ach-view.js con data-achx-cat). Reemplaza el panel de Logros que vivía en la Sidebar.
 * Si los grupos no llegan, muestra las categorías juntas y lo dice. Sin API Key ni claves.
 * Se carga por js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[AchCategories]';
  var URL_GROUPS = 'https://api.guildwars2.com/v2/achievements/groups?ids=all&lang=es';
  var NEAR = 0.8, STEP = 0.95, RETRY_MS = 60000;
  var MODES = [['pending', 'Con pendientes'], ['all', 'Todas']];

  // ------------------------------------------------------------------ puro
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    return String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function plural(n, uno, varios) { return fmtInt(n) + ' ' + (n === 1 ? uno : varios); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function achIds(cat) {
    return (cat && Array.isArray(cat.achievements) ? cat.achievements : [])
      .map(function (e) { return typeof e === 'number' ? e : e && e.id; })
      .filter(function (id) { return id != null; });
  }

  // Por categoría: total del juego, terminados, pendientes y cerca (≥ 80 %), con la cuenta.
  function catStats(snap, calc) {
    var by = {};
    if (!snap || !calc || !snap.catById) return by;
    snap.catById.forEach(function (cat, id) {
      by[String(id)] = { id: String(id), name: (cat && cat.name) || ('#' + id), icon: (cat && cat.icon) || '', order: Number(cat && cat.order) || 0,
        total: achIds(cat).length, done: 0, pending: 0, near: 0 };
    });
    (snap.acc || []).forEach(function (r) {
      var meta = snap.metaById ? snap.metaById.get(r.id) : null;
      var cid = snap.achIdToCat ? snap.achIdToCat.get(String(r.id)) : '';
      var c = cid ? by[String(cid)] : null;
      if (!meta || !c) return;
      var pr = calc.computeProgress(r, meta);
      if (!pr) return;
      if (pr.pct >= 1) { c.done++; return; }
      c.pending++;
      if (pr.pct >= NEAR) c.near++;
    });
    Object.keys(by).forEach(function (k) { var c = by[k]; if (c.total < c.done + c.pending) c.total = c.done + c.pending; });
    return by;
  }

  // Grupos oficiales (o uno solo si no llegaron) con las categorías que se ven.
  // opts = { mode: 'pending' | 'all', q: '' }
  function buildGroups(stats, groups, opts) {
    opts = opts || {};
    var mode = opts.mode === 'all' ? 'all' : 'pending', q = norm(opts.q), used = {}, out = [];
    function visible(c, groupHit) {
      if (!c || !c.total) return false;
      if (mode === 'pending' && !c.pending) return false;
      return !q || groupHit || norm(c.name).indexOf(q) >= 0;
    }
    function pack(id, name, cats, order) {
      var g = { id: id, name: name, order: order, cats: cats, done: 0, total: 0, pending: 0, near: 0 };
      cats.forEach(function (c) { g.done += c.done; g.total += c.total; g.pending += c.pending; g.near += c.near; });
      return g;
    }
    (Array.isArray(groups) ? groups.slice() : []).sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); })
      .forEach(function (gr) {
        var hit = !!q && norm(gr.name).indexOf(q) >= 0, cats = [];
        (gr.categories || []).forEach(function (id) {
          var c = stats[String(id)];
          if (!c || used[c.id]) return;
          used[c.id] = true;
          if (visible(c, hit)) cats.push(c);
        });
        if (cats.length) out.push(pack(String(gr.id), gr.name || 'Grupo', cats, Number(gr.order) || 0));
      });
    var rest = Object.keys(stats).map(function (k) { return stats[k]; })
      .filter(function (c) { return !used[c.id] && visible(c, false); })
      .sort(function (a, b) { return (a.order - b.order) || a.name.localeCompare(b.name, 'es'); });
    if (rest.length) out.push(pack('otras', Array.isArray(groups) && groups.length ? 'Otras categorías' : 'Todas las categorías', rest, 1e9));
    return out;
  }

  function pctOf(done, total) { return total ? Math.min(100, Math.floor(done / total * 100)) : 0; }

  function rowHTML(c) {
    var p = pctOf(c.done, c.total), step = c.total && c.done / c.total >= STEP;
    var ico = c.icon ? '<img src="' + esc(c.icon) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">' : '<span class="achg-noicon" aria-hidden="true"></span>';
    var meta = c.pending ? (c.near ? '<b>' + fmtInt(c.near) + ' cerca</b> · ' : '') + plural(c.pending, 'pendiente', 'pendientes') : 'Sin pendientes';
    var inner = ico + '<span class="achg-cn">' + esc(c.name) + '</span><span class="achg-cc">' + fmtInt(c.done) + ' de ' + fmtInt(c.total) + '</span>' +
      '<span class="achg-pb' + (step ? ' achg-pb--step' : '') + '" aria-hidden="true"><i style="width:' + p + '%"></i></span><span class="achg-cm">' + meta + '</span>';
    return c.pending
      ? '<li><button type="button" class="achg-row" data-achx-cat="' + esc(c.id) + '">' + inner + '</button></li>'
      : '<li><div class="achg-row achg-row--off">' + inner + '</div></li>';
  }

  function groupHTML(g) {
    var hid = 'achgH-' + String(g.id).replace(/[^\w-]/g, '');
    return '<section class="achg-grp" aria-labelledby="' + hid + '"><h3 id="' + hid + '"><span>' + esc(g.name) + '</span><small>' +
      plural(g.cats.length, 'categoría', 'categorías') + ' · ' + pctOf(g.done, g.total) + ' %' + (g.near ? ' · <b>' + fmtInt(g.near) + ' cerca</b>' : '') +
      '</small></h3><ul>' + g.cats.map(rowHTML).join('') + '</ul></section>';
  }

  // Cuerpo: nota de estado y grupos. status: 'loading' | 'ok' | 'error'
  function bodyHTML(list, opts) {
    opts = opts || {};
    var h = [];
    if (opts.status === 'loading') h.push('<p class="achx-note">Agrupando por expansión y modo…</p>');
    if (opts.status === 'error') h.push('<p class="achx-note">No pude traer los grupos de Guild Wars 2: te muestro las categorías juntas.</p>');
    if (!list.length) {
      if (opts.q) h.push('<p class="achx-note">Ninguna categoría coincide con «' + esc(opts.q) + '». <button type="button" class="achg-link" data-achg-act="clear">Limpiar búsqueda</button></p>');
      else h.push('<p class="achx-note">' + (opts.mode === 'all' ? 'No hay categorías para mostrar.' : 'No tenés logros pendientes.') + '</p>');
      return h.join('');
    }
    h.push('<div class="achg-grid">' + list.map(groupHTML).join('') + '</div>');
    return h.join('');
  }

  function countText(list) {
    var n = list.reduce(function (a, g) { return a + g.cats.length; }, 0);
    return n ? plural(n, 'categoría', 'categorías') + ' en ' + plural(list.length, 'grupo', 'grupos') + '.' : '';
  }

  function controlsHTML(opts) {
    var h = ['<div class="achg-ctrl"><label class="achg-search"><span class="achg-sr">Buscar categoría</span><input type="search" id="achgSearch" placeholder="Buscar categoría o expansión…" autocomplete="off" value="' + esc(opts.q || '') + '"></label>'];
    h.push('<div class="achg-seg" role="group" aria-label="Qué categorías">');
    MODES.forEach(function (m) { h.push('<button type="button" data-achg-mode="' + m[0] + '" aria-pressed="' + (opts.mode === m[0]) + '">' + m[1] + '</button>'); });
    h.push('</div></div>');
    return h.join('');
  }

  var CSS = [
    '.achg-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 6px}',
    '.achg-search{flex:1 1 220px;display:flex;min-width:0}',
    '.achg-search input{font:inherit;font-size:.86rem;width:100%;min-height:36px;padding:6px 10px;border:1px solid var(--bd-2);border-radius:10px;background:var(--bg-0);color:var(--tx-1)}',
    '.achg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.achg-seg{display:inline-flex;border:1px solid var(--bd-2);border-radius:10px;overflow:hidden}',
    '.achg-seg button{font:inherit;font-size:.82rem;background:none;border:0;border-right:1px solid var(--bd-1);padding:6px 12px;color:var(--tx-2);cursor:pointer;min-height:36px}',
    '.achg-seg button:last-child{border-right:0}.achg-seg button[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);font-weight:600}',
    '.achg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;align-items:start}',
    '.achg-grp{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 12px}',
    '.achg-grp h3{margin:0 0 6px;display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:.92rem;color:var(--tx-1)}',
    '.achg-grp h3 small{font-size:.74rem;font-weight:500;color:var(--tx-2);white-space:nowrap}.achg-grp h3 b{color:var(--color-amber,#F2B94B);font-weight:600}',
    '.achg-grp ul{list-style:none;margin:0;padding:0}',
    '.achg-row{font:inherit;width:100%;display:grid;grid-template-columns:32px 1fr auto;column-gap:10px;row-gap:3px;align-items:center;text-align:left;background:none;border:0;border-top:1px solid var(--bd-1);padding:8px 4px;color:var(--tx-1);min-height:48px}',
    'button.achg-row{cursor:pointer;border-radius:8px}button.achg-row:hover{background:var(--bg-2)}',
    '.achg-row img,.achg-noicon{grid-row:1/4;width:32px;height:32px;border-radius:6px;background:var(--bg-2)}',
    '.achg-cn{font-weight:600;font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.achg-cc{font-size:.76rem;color:var(--tx-2);white-space:nowrap}',
    '.achg-pb{grid-column:2/4;height:5px;border-radius:5px;background:var(--bg-2);overflow:hidden}.achg-pb i{display:block;height:100%;border-radius:5px;background:var(--color-green,#3CC48A)}',
    '.achg-pb--step i{background:var(--color-amber,#F2B94B)}',
    '.achg-cm{grid-column:2/4;font-size:.74rem;color:var(--tx-2)}.achg-cm b{color:var(--color-amber,#F2B94B);font-weight:600}',
    '.achg-row--off .achg-cn{font-weight:500;color:var(--tx-2)}',
    '.achg-link{font:inherit;background:none;border:0;padding:0;color:var(--acc-1);text-decoration:underline;cursor:pointer}',
    '#achxCats button.achg-row:focus-visible,.achg-seg button:focus-visible,.achg-search input:focus-visible,.achg-link:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.achg-grid{grid-template-columns:1fr}.achg-seg{display:flex;width:100%}.achg-seg button{flex:1;min-height:44px}.achg-search input{min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { mode: 'pending', q: '', groups: null, status: 'idle', failedAt: 0, timer: null, wired: false };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }

  function ensureCss() {
    if (byId('ach-categories-css') || !doc || !doc.createElement || !doc.head) return;
    var s = doc.createElement('style');
    s.id = 'ach-categories-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  // Un solo pedido: los grupos son iguales para todas las cuentas.
  function loadGroups() {
    if (st.status === 'loading' || st.status === 'ok') return;
    if (st.status === 'error' && Date.now() - st.failedAt < RETRY_MS) return;
    if (typeof root.fetch !== 'function') { st.status = 'error'; st.failedAt = Date.now(); return; }
    st.status = 'loading';
    Promise.resolve(root.fetch(URL_GROUPS)).then(function (r) { return r && r.ok ? r.json() : Promise.reject(new Error('HTTP ' + (r && r.status))); })
      .then(function (arr) {
        if (!Array.isArray(arr) || !arr.length) throw new Error('sin grupos');
        st.groups = arr.map(function (g) { return { id: g.id, name: g.name, order: g.order, categories: Array.isArray(g.categories) ? g.categories : [] }; });
        st.status = 'ok';
      })
      .catch(function (e) { st.status = 'error'; st.failedAt = Date.now(); if (root.console) root.console.warn(LOG, 'grupos', e); })
      .then(function () { if (byId('achxCats') && root.AchView && typeof root.AchView.render === 'function') root.AchView.render(); });
  }

  function current() {
    var A = root.Achievements;
    if (!A || typeof A.getSnapshot !== 'function' || !A._calc) return [];
    return buildGroups(catStats(A.getSnapshot(), A._calc), st.status === 'ok' ? st.groups : null, { mode: st.mode, q: st.q });
  }

  // Lo llama ach-view.js al pintar la pestaña: controles, conteo y grupos.
  function html(snap, calc) {
    ensureCss();
    wireOnce();
    loadGroups();
    var list = buildGroups(catStats(snap, calc), st.status === 'ok' ? st.groups : null, { mode: st.mode, q: st.q });
    return controlsHTML(st) + '<p class="achg-count achx-note" id="achgCount" aria-live="polite">' + esc(countText(list)) + '</p>' +
      '<div id="achgBody">' + bodyHTML(list, { status: st.status, q: st.q, mode: st.mode }) + '</div>';
  }

  // Búsqueda y modo: solo cambia la lista (el buscador no pierde el foco).
  function paintList() {
    var body = byId('achgBody'), count = byId('achgCount');
    if (!body) return;
    var list = current();
    body.innerHTML = bodyHTML(list, { status: st.status, q: st.q, mode: st.mode });
    if (count) count.textContent = countText(list);
  }

  function attr(t, k) {
    for (var n = t, i = 0; n && i < 5; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(k) != null) return { node: n, value: n.getAttribute(k) };
    return null;
  }

  function wireOnce() {
    if (st.wired || !doc || !doc.addEventListener) return;
    st.wired = true;
    doc.addEventListener('click', function (e) {
      var m = attr(e.target, 'data-achg-mode'), a = attr(e.target, 'data-achg-act');
      if (m) {
        st.mode = m.value === 'all' ? 'all' : 'pending';
        var host = byId('achxCats');
        Array.prototype.forEach.call(host && host.querySelectorAll ? host.querySelectorAll('[data-achg-mode]') : [], function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-achg-mode') === st.mode));
        });
        paintList();
      } else if (a && a.value === 'clear') {
        st.q = '';
        var input = byId('achgSearch');
        if (input) { input.value = ''; if (input.focus) input.focus(); }
        paintList();
      }
    });
    doc.addEventListener('input', function (e) {
      if (!e.target || e.target.id !== 'achgSearch') return;
      var v = e.target.value;
      clearTimeout(st.timer);
      st.timer = setTimeout(function () { st.q = String(v || ''); paintList(); }, 150);
    });
  }

  root.AchCategories = {
    version: VERSION, html: html, paint: paintList,
    _pure: { catStats: catStats, buildGroups: buildGroups, bodyHTML: bodyHTML, groupHTML: groupHTML, rowHTML: rowHTML,
      controlsHTML: controlsHTML, countText: countText, norm: norm, CSS: CSS, URL_GROUPS: URL_GROUPS },
    _state: st
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
