/*!
 * js/inv-sheet.js — Ficha del ítem de Inventario y Personajes (BL-070, INV-6)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25) — INV-6: la ficha nueva al tocar cualquier ítem
 *
 * Al tocar un ítem en Materiales, Banco, Armería legendaria, Buscar o «Qué lleva» de Personajes
 * (cualquier botón con data-inv-item dentro del módulo) se abre su ficha:
 *  - ícono grande con el anillo de su rareza y la rareza en texto, nivel y descripción del juego;
 *  - dónde está en tu cuenta: depósito, banco y su pestaña, ranuras compartidas y cada personaje;
 *  - D3: precio del Bazar, la venta más barata y el pedido de compra más alto, con cuántos hay; si está
 *    ligado, lo digo; el valor del inventario entero queda afuera;
 *  - lo que paga el mercader, el código para el chat (con «Copiar») y la búsqueda en la wiki oficial en español.
 * Diálogo accesible: aria-modal, el foco entra al abrir, Tab no se escapa, Escape cierra y el foco vuelve
 * al ítem. En el celular ocupa la pantalla. Datos: GW2Api.getItemsMany y getCommercePrices (con su caché) y,
 * para las bolsas, el lector del Multicuenta (InvMulti.read, la misma caché que Buscar y Personajes).
 * Se carga por js/modules.json, después de inv-chars.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[InvSheet]';
  var WIKI = 'https://wiki-es.guildwars2.com/index.php?search=';
  var BOUND = ['AccountBound', 'SoulbindOnAcquire'];

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
  // Cobre → «12 o 34 p 56 c» (sin las partes en cero, salvo que todo sea 0).
  function coins(cu) {
    cu = Math.max(0, Math.floor(Number(cu) || 0));
    var g = Math.floor(cu / 10000), s = Math.floor((cu % 10000) / 100), c = cu % 100, out = [];
    if (g) out.push(fmtInt(g) + ' o');
    if (s) out.push(s + ' p');
    if (c || !out.length) out.push(c + ' c');
    return out.join(' ');
  }
  function clean(s) { return String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function rarityOf(meta) {
    var R = (root.InvView && root.InvView._pure && root.InvView._pure.RARITY) || {};
    return R[(meta && meta.rarity) || 'Basic'] || R.Basic || ['Básico', '#C9D0DA'];
  }
  function bound(item) { var f = (item && item.flags) || []; return BOUND.some(function (b) { return f.indexOf(b) >= 0; }); }
  function placeText(p) {
    return (p.kind === 'materials' ? 'Depósito de materiales' : p.kind === 'bank' ? 'Banco, pestaña ' + p.tab :
      p.kind === 'shared' ? 'Ranuras compartidas' : p.name || 'Personaje') + ' ' + fmtInt(p.count);
  }

  // El Bazar: lo que digo según lo que llegó.
  function priceLines(item, price, state) {
    if (bound(item)) return { kind: 'bound', lines: ['Está ligado: no se puede vender en el Bazar.'] };
    if (state !== 'done') return { kind: 'loading', lines: ['Consultando el Bazar…'] };
    if (!price || (!price.sells && !price.buys)) return { kind: 'none', lines: ['Sin precio en el Bazar ahora.'] };
    var out = [];
    var s = price.sells || {}, b = price.buys || {};
    out.push(s.quantity ? 'Venta más barata: ' + coins(s.unit_price) + ' (' + fmtInt(s.quantity) + ' a la venta)' : 'Nadie lo vende ahora.');
    out.push(b.quantity ? 'Pedido de compra más alto: ' + coins(b.unit_price) + ' (' + fmtInt(b.quantity) + ' pedidos)' : 'Nadie lo está pidiendo ahora.');
    return { kind: 'ok', lines: out };
  }

  // s: { id, meta, item, itemState, where: {total, places, unread, bags}, price, priceState }
  function html(s) {
    var meta = s.item || s.meta || {}, r = rarityOf(meta), name = meta.name || 'Ítem ' + s.id, h = [];
    h.push('<div class="ish-head"><span class="ish-ic" style="--iv-r:' + r[1] + '">' + (meta.icon ? '<img src="' + esc(meta.icon) + '" alt="" width="64" height="64" referrerpolicy="no-referrer">' : '') + '</span>');
    h.push('<div class="ish-t"><h2 id="ishTitle">' + esc(name) + '</h2><p>' + esc(r[0]) + (s.item && s.item.level ? ' · Nivel ' + s.item.level : '') + '</p></div>');
    h.push('<button type="button" class="iv-btn ish-x" id="ishClose" data-ish-close="1">Cerrar<span class="iv-sr"> la ficha</span></button></div>');
    if (s.itemState === 'error') h.push('<p class="ish-note" role="status">No pude leer los datos de este ítem en la API.</p>');
    var desc = s.item ? clean(s.item.description) : '';
    if (desc) h.push('<p class="ish-desc">' + esc(desc) + '</p>');
    var w = s.where || {};
    h.push('<section class="ish-sec" aria-labelledby="ishWhere"><h3 id="ishWhere">Dónde está</h3>');
    if (!w.index) h.push('<p class="ish-note">Sin datos de tu cuenta.</p>');
    else {
      h.push('<p class="ish-big"><b>' + fmtInt(w.total) + '</b> en tu cuenta</p>');
      if (w.places.length) h.push('<ul class="ish-pl">' + w.places.map(function (p) { return '<li>' + esc(placeText(p)) + '</li>'; }).join('') + '</ul>');
      if (w.bags === 'loading') h.push('<p class="ish-note" role="status">Leyendo las bolsas de tus personajes y las ranuras compartidas…</p>');
      if (w.unread && w.unread.length) h.push('<p class="ish-note">No pude leer todo: lo que falta no suma.</p>');
    }
    h.push('</section>');
    var pl = priceLines(s.item, s.price, s.priceState);
    h.push('<section class="ish-sec" aria-labelledby="ishTp"><h3 id="ishTp">Bazar</h3><ul class="ish-tp" aria-live="polite">' +
      pl.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>');
    if (s.item && s.item.vendor_value && (s.item.flags || []).indexOf('NoSell') < 0) h.push('<p class="ish-note">Al mercader: ' + coins(s.item.vendor_value) + ' cada uno.</p>');
    h.push('</section><section class="ish-sec" aria-labelledby="ishMore"><h3 id="ishMore">Más</h3><div class="ish-more">');
    if (s.item && s.item.chat_link) h.push('<span class="ish-code"><span class="iv-sr">Código para el chat: </span><code>' + esc(s.item.chat_link) + '</code></span><button type="button" class="iv-btn" id="ishCopy" data-ish-copy="1">Copiar código</button>');
    h.push('<a class="iv-btn" id="ishWiki" href="' + WIKI + encodeURIComponent(name) + '" target="_blank" rel="noopener">Buscar en la wiki oficial<span class="iv-sr"> (se abre en otra pestaña)</span></a></div></section>');
    return h.join('');
  }

  var CSS = [
    '.ish-back{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.ish-back[hidden]{display:none}',
    '.ish{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--bd-1);border-radius:16px;background:var(--bg-1);box-shadow:0 18px 48px rgba(0,0,0,.45);padding:16px 18px;color:var(--tx-1);box-sizing:border-box}',
    '.ish-head{display:flex;gap:12px;align-items:center}',
    '.ish-ic{width:64px;height:64px;flex-shrink:0;border-radius:12px;background:var(--bg-2);box-shadow:inset 0 0 0 3px var(--iv-r),0 0 0 1px var(--bd-1);line-height:0}',
    '.ish-ic img{width:64px;height:64px;border-radius:12px;padding:3px;box-sizing:border-box}',
    '.ish-t{flex:1;min-width:0}.ish-t h2{margin:0;font-size:1.15rem;color:var(--tx-1)}.ish-t p{margin:2px 0 0;font-size:.84rem;color:var(--tx-2)}',
    '.ish-x{align-self:flex-start}',
    '.ish-desc{margin:12px 0 0;font-size:.86rem;color:var(--tx-2)}',
    '.ish-sec{margin-top:14px;border-top:1px solid var(--bd-1);padding-top:10px}',
    '.ish-sec h3{margin:0 0 6px;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--tx-2)}',
    '.ish-big{margin:0 0 4px;font-size:.9rem;color:var(--tx-2)}.ish-big b{font-size:1.3rem;color:var(--tx-1)}',
    '.ish-pl,.ish-tp{list-style:none;margin:0;padding:0;display:grid;gap:3px;font-size:.86rem;color:var(--tx-1)}',
    '.ish-note{margin:6px 0 0;font-size:.8rem;color:var(--tx-2)}',
    '.ish-more{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ish-more a{text-decoration:none;display:inline-flex;align-items:center}',
    '.ish-code code{font-size:.82rem;color:var(--tx-1);background:var(--bg-2);border-radius:6px;padding:3px 6px}',
    '.ish :is(button,a):focus-visible,.ish:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:520px){.ish-back{padding:0}.ish{width:100%;max-height:100vh;height:100%;border-radius:0}.ish .iv-btn{min-height:44px}}',
    '@media (prefers-reduced-motion:reduce){.ish-back,.ish{transition:none!important;animation:none!important}}'
  ].join('\n');

  // ------------------------------------------------------------------ datos y DOM
  var doc = root.document;
  var st = { open: false, id: null, opener: null, item: null, itemState: 'idle', price: null, priceState: 'idle', bags: 'idle',
    shared: null, chars: null, bagsTk: null, seq: 0 };

  function view() { var V = root.InvView; return V && typeof V.getSnapshot === 'function' ? V.getSnapshot().data || {} : {}; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }

  function where() {
    var P = root.InvModel && root.InvModel._pure, d = view();
    if (!P || !d.loaded || (!d.bank && !d.materials)) return { index: null };
    var wait = st.bags !== 'done';
    var index = P.indexPlaces({ materials: d.materials, bank: d.bank, shared: wait ? [] : st.shared, characters: wait ? [] : st.chars });
    var p = P.placesOf(index, st.id);
    return { index: index, total: p.total, places: p.places, unread: index.unread, bags: st.bags };
  }

  function snapshot() {
    var known = view().items || {};
    return { id: st.id, meta: known[st.id] || null, item: st.item, itemState: st.itemState, where: where(), price: st.price, priceState: st.priceState };
  }

  function host() {
    var back = byId('ishBack');
    if (back) return back;
    if (!doc || !doc.createElement || !doc.body) return null;
    if (!byId('inv-sheet-css') && doc.head) {
      var s = doc.createElement('style');
      s.id = 'inv-sheet-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    back = doc.createElement('div');
    back.id = 'ishBack';
    back.className = 'ish-back';
    back.setAttribute('hidden', '');
    var box = doc.createElement('div');
    box.id = 'ishBox';
    box.className = 'ish';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'ishTitle');
    box.setAttribute('tabindex', '-1');
    back.appendChild(box);
    doc.body.appendChild(back);
    back.addEventListener('click', function (e) {
      if (e.target === back || attr(e.target, 'data-ish-close') != null) { close(); return; }
      if (attr(e.target, 'data-ish-copy') != null) copy();
    });
    back.addEventListener('keydown', trap);
    return back;
  }

  function paint() {
    var box = byId('ishBox');
    if (!st.open || !box) return;
    box.innerHTML = html(snapshot());
  }

  function settle(p) {
    return Promise.resolve().then(p).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  function load(my) {
    var A = root.GW2Api, d = view(), R = root.InvMulti && root.InvMulti.read;
    st.itemState = 'loading'; st.priceState = 'loading';
    var jobs = [];
    jobs.push(settle(function () { return A.getItemsMany([st.id], { nocache: false }); }).then(function (r) {
      if (my !== st.seq) return;
      var it = r.ok && Array.isArray(r.v) ? r.v.filter(function (x) { return x && x.id === st.id; })[0] : null;
      st.item = it || null; st.itemState = it ? 'done' : 'error'; paint();
    }));
    jobs.push(settle(function () { return A.getCommercePrices([st.id], { nocache: false }); }).then(function (r) {
      if (my !== st.seq) return;
      st.price = r.ok && Array.isArray(r.v) ? r.v.filter(function (x) { return x && x.id === st.id; })[0] || null : null;
      st.priceState = 'done'; paint();
    }));
    if (d.tk && (st.bags === 'idle' || st.bagsTk !== d.tk)) {
      st.bags = 'loading'; st.bagsTk = d.tk;
      var read = function (p) { return typeof R === 'function' ? R(p, d.tk, false) : Promise.reject(new Error('sin lector')); };
      jobs.push(Promise.all([settle(function () { return read('/v2/account/inventory'); }), settle(function () { return read('/v2/characters?ids=all'); })]).then(function (r) {
        st.shared = r[0].ok && Array.isArray(r[0].v) ? r[0].v : null;
        st.chars = r[1].ok && Array.isArray(r[1].v) ? r[1].v.map(function (c) { return { name: c && c.name, bags: Array.isArray(c && c.bags) ? c.bags : [] }; }) : null;
        st.bags = 'done'; paint();
      }));
    }
    return Promise.all(jobs);
  }

  function open(id, opener) {
    id = Number(id);
    if (!id || !host() || !root.GW2Api) return null;
    var back = byId('ishBack'), my = ++st.seq;
    st.open = true; st.id = id; st.item = null; st.price = null;
    st.opener = opener || (doc.activeElement || null);
    back.removeAttribute('hidden');
    paint();
    var c = byId('ishClose');
    if (c && c.focus) c.focus();
    return load(my);
  }

  function close() {
    var back = byId('ishBack');
    if (!st.open) return;
    st.open = false; st.seq++;
    if (back) back.setAttribute('hidden', '');
    var o = st.opener;
    st.opener = null;
    if (o && o.focus) o.focus();
  }

  function copy() {
    var code = st.item && st.item.chat_link, nav = root.navigator;
    if (!code) return;
    var done = function (ok) { if (root.toast) root.toast(ok ? 'ok' : 'warn', ok ? 'Copié el código para el chat.' : 'No pude copiar el código.', { ttl: 1800 }); };
    if (nav && nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }

  // Tab y Mayús+Tab no se escapan del diálogo; Escape lo cierra.
  function trap(e) {
    if (!st.open) return;
    if (e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var box = byId('ishBox'), list = box && box.querySelectorAll ? Array.prototype.slice.call(box.querySelectorAll('button,a[href]')) : [];
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || a === box)) { if (e.preventDefault) e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { if (e.preventDefault) e.preventDefault(); first.focus(); }
  }

  function attr(t, name) {
    for (var n = t, i = 0; n && i < 8; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(name) != null) return n.getAttribute(name);
    return null;
  }
  function opener(t) {
    for (var n = t, i = 0; n && i < 8; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute('data-inv-item') != null) return n;
    return null;
  }
  function inModule(n) {
    for (var i = 0; n && i < 40; n = n.parentNode, i++) if (n.id === 'ivRoot') return true;
    return false;
  }

  function onClick(e) {
    var o = opener(e && e.target);
    if (!o || !inModule(o)) return;
    open(o.getAttribute('data-inv-item'), o);
  }

  if (doc && doc.addEventListener) {
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', function (e) { if (st.open && e && e.key === 'Escape') trap(e); });
    doc.addEventListener('gn:tokenchange', function () { st.bags = 'idle'; st.shared = null; st.chars = null; close(); });
  }

  root.InvSheet = {
    version: VERSION, open: open, close: close,
    getSnapshot: function () { return { open: st.open, id: st.id, itemState: st.itemState, priceState: st.priceState, bags: st.bags }; },
    _pure: { esc: esc, fmtInt: fmtInt, coins: coins, clean: clean, bound: bound, placeText: placeText, priceLines: priceLines, html: html, CSS: CSS }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
