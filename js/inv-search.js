/*!
 * js/inv-search.js — Buscar: «¿dónde está?» en tu cuenta (BL-070, INV-4)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.1 (2026-10-25) — INV-6: el nombre de cada resultado abre la ficha del ítem
 *          1.0.0 (2026-10-25) — INV-4: la pestaña Buscar de Inventario y Personajes
 *
 * Escribís el nombre de un ítem y te digo cuánto tenés y dónde: el depósito de materiales, el banco
 * (con su pestaña), las ranuras compartidas y las bolsas de cada personaje.
 *  - D1: las bolsas y las ranuras compartidas se piden solo al buscar, una vez, con el lector del
 *    Multicuenta (InvMulti.read: /v2/characters?ids=all trae todos los personajes en un pedido, caché
 *    de 5 minutos). El banco y los materiales salen de lo que ya leyó la vista (InvView.getSnapshot).
 *  - Sin tildes ni mayúsculas; primero lo que empieza igual y después lo que más tenés (InvModel.search).
 *  - Estados honestos: mientras leo las bolsas lo digo; si una fuente no se pudo leer, la nombro y no suma.
 *  - La rareza va en el anillo del ícono y en texto para el lector, nunca como color de letra.
 * Se suma como pestaña con InvView.register; se carga por js/modules.json después de inv-multi.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.1';
  var LOG = '[InvSearch]';
  var LIMIT = 50;
  var UNREAD = { materials: 'el depósito de materiales', bank: 'el banco', shared: 'las ranuras compartidas', characters: 'las bolsas de tus personajes' };

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function M() { return root.InvModel && root.InvModel._pure; }
  function and(parts) { return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1]; }
  function rarity(meta) {
    var R = (root.InvView && root.InvView._pure && root.InvView._pure.RARITY) || {};
    return R[(meta && meta.rarity) || 'Basic'] || R.Basic || ['Básico', '#C9D0DA'];
  }

  function placeText(p) {
    var where = p.kind === 'materials' ? 'Depósito de materiales' : p.kind === 'bank' ? 'Banco, pestaña ' + p.tab :
      p.kind === 'shared' ? 'Ranuras compartidas' : p.name || 'Personaje';
    return { where: where, count: p.count };
  }

  // src: { materials, bank, shared, chars, bags: 'idle'|'loading'|'done' }. Mientras leo las bolsas no son
  // «sin datos»: todavía no llegaron (cuentan como vacías y lo digo aparte).
  function buildIndex(src) {
    var P = M(), wait = src.bags !== 'done';
    if (!P) return null;
    return P.indexPlaces({ materials: src.materials, bank: src.bank,
      shared: wait ? [] : src.shared, characters: wait ? [] : src.chars });
  }

  // s: { hasToken, loaded, q, index, items, bags }
  function results(s) {
    var P = M(), q = String(s.q || '').trim();
    if (!P || !q || !s.index) return [];
    return P.search(s.index, s.items || {}, q, LIMIT);
  }

  function statusText(s, res) {
    var q = String(s.q || '').trim(), parts = [];
    if (!q) return '';
    var unread = s.index ? s.index.unread.map(function (k) { return UNREAD[k] || k; }) : [];
    if (!res.length) parts.push('No encontré nada que se llame «' + q + '» en tu cuenta.');
    else if (res.length >= LIMIT) parts.push('Hay muchos ítems con «' + q + '»: te muestro los primeros ' + LIMIT + '. Escribí un poco más para afinar.');
    else parts.push((res.length === 1 ? 'Encontré 1 ítem' : 'Encontré ' + res.length + ' ítems') + ' con «' + q + '».');
    if (s.bags === 'loading') parts.push('Estoy leyendo las bolsas de tus personajes y las ranuras compartidas…');
    if (unread.length) parts.push('No pude leer ' + and(unread) + ': revisá que la API Key tenga permiso de inventarios y de personajes.');
    return parts.join(' ');
  }

  function itemHTML(r, items) {
    var meta = items[r.id] || {}, rr = rarity(meta), name = meta.name || 'Ítem ' + r.id;
    var places = r.places.map(placeText);
    var said = places.map(function (p) { return p.where + ' ' + fmtInt(p.count); }).join(', ');
    return '<li class="is-it"><span class="iv-ic" style="--iv-r:' + rr[1] + '">' + (meta.icon ? '<img src="' + esc(meta.icon) +
      '" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>' +
      '<div class="is-b"><p class="is-n"><button type="button" class="iv-open" data-inv-item="' + r.id + '" aria-haspopup="dialog">' + esc(name) + '<span class="iv-sr">, ' + esc(rr[0]) + '. ' + fmtInt(r.total) + ' en total: ' + esc(said) + '.</span></button></p>' +
      '<ul class="is-pl" aria-hidden="true">' + places.map(function (p) {
        return '<li><span>' + esc(p.where) + '</span><b>' + fmtInt(p.count) + '</b></li>';
      }).join('') + '</ul></div><p class="is-t" aria-hidden="true"><b>' + fmtInt(r.total) + '</b><small>en total</small></p></li>';
  }

  function html(s) {
    if (!s.hasToken) return '<p class="iv-note">Sin API Key no puedo buscar en tu cuenta.</p>';
    var q = String(s.q || '').trim();
    if (!q) return '<p class="iv-note">Escribí el nombre de un ítem y te digo cuánto tenés y dónde: el depósito de materiales, el banco, las ranuras compartidas y las bolsas de cada personaje.</p>';
    if (!s.loaded) return '<p class="iv-note" role="status">Leyendo tu cuenta…</p>';
    var res = results(s), items = s.items || {};
    var h = '<p class="is-st" role="status">' + esc(statusText(s, res)) + '</p>';
    if (res.length) h += '<ul class="is-res">' + res.map(function (r) { return itemHTML(r, items); }).join('') + '</ul>';
    return h;
  }

  function toolsHTML(s) {
    return '<label class="iv-search"><span class="iv-sr">Buscar en tu cuenta</span><input type="search" id="isQ" placeholder="¿Qué buscás? Por ejemplo, ectoplasma" value="' +
      esc(s.q) + '" autocomplete="off" spellcheck="false"></label>';
  }

  var CSS = [
    '.is-st{margin:0 0 10px;font-size:.84rem;color:var(--tx-2)}',
    '.is-res{list-style:none;margin:0;padding:0;display:grid;gap:8px}',
    '.is-it{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:10px 12px}',
    '.is-it .iv-ic{width:40px;height:40px}.is-it .iv-ic img{width:40px;height:40px}',
    '.is-b{flex:1;min-width:0}.is-n{margin:0 0 4px;font-weight:700;font-size:.92rem;color:var(--tx-1)}',
    '.is-pl{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.8rem;color:var(--tx-2)}',
    '.is-pl li{display:inline-flex;gap:6px}.is-pl b{color:var(--tx-1)}',
    '.is-t{margin:0;text-align:right;flex-shrink:0}.is-t b{display:block;font-size:1.05rem;color:var(--tx-1)}.is-t small{font-size:.72rem;color:var(--tx-2)}',
    '@media (max-width:520px){.is-it{flex-wrap:wrap}.is-t{text-align:left;width:100%}.is-t b{display:inline;margin-right:6px}}'
  ].join('\n');

  // ------------------------------------------------------------------ datos y DOM
  var doc = root.document;
  var st = { q: '', tk: null, bags: 'idle', shared: null, chars: null, meta: {}, seq: 0, memo: null, timer: null };

  function view() { var V = root.InvView; return V && typeof V.getSnapshot === 'function' ? V.getSnapshot().data || {} : {}; }

  function paint() {
    if (st.timer) return;
    st.timer = setTimeout(function () {
      st.timer = null;
      if (root.InvView && typeof root.InvView.renderTab === 'function') root.InvView.renderTab('search');
    }, 60);
  }

  // Si cambió la cuenta, lo que leí de la anterior no sirve.
  function sync(d) {
    if (d.tk === st.tk) return;
    st.tk = d.tk || null; st.bags = 'idle'; st.shared = null; st.chars = null; st.memo = null; st.seq++;
  }

  function settle(p) {
    return Promise.resolve().then(p).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  function loadBags(nocache) {
    var d = view(), tk = d.tk, my = ++st.seq, R = root.InvMulti && root.InvMulti.read;
    if (!tk) return Promise.resolve();
    st.bags = 'loading';
    paint();
    var read = function (path) { return typeof R === 'function' ? R(path, tk, !!nocache) : Promise.reject(new Error('sin lector')); };
    return Promise.all([settle(function () { return read('/v2/account/inventory'); }), settle(function () { return read('/v2/characters?ids=all'); })])
      .then(function (r) {
        if (my !== st.seq) return null;
        st.shared = r[0].ok && Array.isArray(r[0].v) ? r[0].v : null;
        st.chars = r[1].ok && Array.isArray(r[1].v) ? r[1].v.map(function (c) { return { name: c && c.name, bags: Array.isArray(c && c.bags) ? c.bags : [] }; }) : null;
        st.bags = 'done';
        st.memo = null;
        paint();
        return names(my);
      });
  }

  // Nombres e íconos de lo que hay en bolsas y ranuras compartidas y la vista todavía no conoce.
  function names(my) {
    var A = root.GW2Api, known = view().items || {}, ids = {};
    var add = function (s) { if (s && s.id && !known[s.id] && !st.meta[s.id]) ids[s.id] = 1; };
    (st.shared || []).forEach(add);
    (st.chars || []).forEach(function (c) { c.bags.forEach(function (b) { if (b && Array.isArray(b.inventory)) b.inventory.forEach(add); }); });
    var list = Object.keys(ids).map(Number);
    if (!list.length || !A || typeof A.getItemsMany !== 'function') return null;
    return A.getItemsMany(list, { nocache: false }).then(function (r) {
      (r || []).forEach(function (it) { if (it && it.id) st.meta[it.id] = { name: it.name, icon: it.icon, rarity: it.rarity, type: it.type }; });
      if (my === st.seq) paint();
    }, function (e) { if (root.console) root.console.warn(LOG, 'ítems', e); });
  }

  // El índice se arma de nuevo solo si cambió alguna fuente, no en cada tecla.
  function snapshot() {
    var d = view();
    sync(d);
    var key = [d.bank, d.materials, st.shared, st.chars, st.bags];
    var same = st.memo && st.memo.key.every(function (x, i) { return x === key[i]; });
    if (!same) st.memo = { key: key, index: buildIndex({ materials: d.materials, bank: d.bank, shared: st.shared, chars: st.chars, bags: st.bags }) };
    var items = {}, k;
    for (k in st.meta) items[k] = st.meta[k];
    var known = d.items || {};
    for (k in known) items[k] = known[k];
    return { hasToken: !!d.hasToken, loaded: !!d.loaded, q: st.q, index: st.memo.index, items: items, bags: st.bags };
  }

  function onEvent(e) {
    var t = e && e.target;
    if (!t || t.id !== 'isQ' || (e.type !== 'input' && e.type !== 'change')) return false;
    st.q = String(t.value || '');
    sync(view());
    if (st.q.trim() && st.bags === 'idle') loadBags(false);
    paint();
    return true;
  }

  function ensureCss() {
    if (!doc || !doc.createElement || !doc.head || (doc.getElementById && doc.getElementById('inv-search-css'))) return;
    var s = doc.createElement('style');
    s.id = 'inv-search-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  var TAB = {
    id: 'search', label: 'Buscar', order: 2,
    html: function () { ensureCss(); return html(snapshot()); },
    tools: function () { return toolsHTML({ q: st.q }); },
    onEvent: onEvent,
    refresh: function (nocache) { return st.bags === 'idle' ? Promise.resolve() : loadBags(nocache); }
  };

  function register() {
    if (root.InvView && typeof root.InvView.register === 'function') { root.InvView.register(TAB); return true; }
    return false;
  }
  if (!register() && doc && doc.addEventListener) {
    doc.addEventListener('DOMContentLoaded', register);
    doc.addEventListener('gn:boot-ready', register);
  }

  root.InvSearch = {
    version: VERSION, tab: TAB,
    getSnapshot: function () { return { q: st.q, bags: st.bags }; },
    _pure: { esc: esc, fmtInt: fmtInt, placeText: placeText, buildIndex: buildIndex, results: results, statusText: statusText,
      html: html, toolsHTML: toolsHTML, CSS: CSS, LIMIT: LIMIT }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
