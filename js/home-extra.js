/*!
 * js/home-extra.js — La Heredad: pestañas Glifos y Decoraciones (BL-070 ACT-6, BL-055)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25) — ACT-6
 *
 * Se suma a js/home-view.js (1.1.0 o más), que dibuja las pestañas y me pide el contenido con
 * HomeExtra.html(tab, ctx); los clics, la búsqueda y el selector de categoría me los pasa a mí.
 *  - Glifos: los 12 glifos que se guardan en las 3 cajas de recolección de la heredad (cosecha, tala y
 *    minería): 36 en total (/v2/homestead/glyphs). Nombre e ícono del ítem en español (/v2/items) y el
 *    efecto de la wiki oficial («Glyph (upgrade)»), en assets/data/homestead/glyphs.json. Cuáles tenés sale
 *    de /v2/account/homestead/glyphs.
 *  - Decoraciones: las 1.210 de la API (/v2/homestead/decorations y sus 27 categorías, en español), se
 *    piden recién cuando abrís la pestaña y quedan en memoria. Cuántas tenés de cada una sale de
 *    /v2/account/homestead/decorations (tope 250 por decoración). Filtros por categoría, «Las tengo»,
 *    «Me faltan» y búsqueda sin tildes; muestro de a 120.
 * Estados honestos: si una lectura falla digo «sin datos» y nombro el permiso, nunca «no lo tenés».
 * No guardo nada en el navegador: ni claves nuevas ni la Key.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[HomeExtra]';
  var GLYPHS_URL = 'assets/data/homestead/glyphs.json';
  var API = 'https://api.guildwars2.com';
  var CHUNK = 200, SHOW = 120, TTL = 5 * 60 * 1000, TIMEOUT = 20000, MAXC = 250;
  var ONLY = [['all', 'Todas'], ['have', 'Las tengo'], ['missing', 'Me faltan']];
  var PERM = 'Sin datos: tu API Key necesita los permisos «account» y «unlocks».';

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
  function clean(s) { return String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function chunks(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }

  /** Glifos: filas por tipo, con las 3 cajas y si la tenés (owned null = sin datos). */
  function glyphModel(data, owned) {
    var slots = (data && data.slots) || [], set = {}, have = 0, total = 0;
    if (Array.isArray(owned)) owned.forEach(function (id) { set[String(id)] = true; });
    var rows = ((data && data.glyphs) || []).map(function (g) {
      var n = 0;
      var sl = slots.map(function (s) {
        var id = g.id + '_' + s.id, h = owned ? !!set[id] : null;
        total++; if (h) { n++; have++; }
        return { id: id, slot: s.id, label: s.es, have: h };
      });
      return { id: g.id, name: g.name, icon: g.icon, kind: g.kind, kindLabel: (data.kinds || {})[g.kind] || '', effect: g.effect, slots: sl, have: owned ? n : null };
    });
    return { rows: rows, have: owned ? have : null, total: total, slots: slots };
  }

  /** Decoraciones: catálogo + cuenta + filtros. owned: [{id,count}] o null (sin datos). */
  function decorModel(decos, cats, owned, ui) {
    ui = ui || {};
    var cnt = {}, catName = {}, byCat = {}, haveTypes = 0, pieces = 0, full = 0;
    (cats || []).forEach(function (c) { catName[c.id] = clean(c.name); });
    if (Array.isArray(owned)) owned.forEach(function (o) { if (o && o.count > 0) cnt[o.id] = (cnt[o.id] || 0) + Number(o.count); });
    var q = fold(ui.q), only = ui.only || 'all', cat = ui.cat == null ? 'all' : String(ui.cat), list = [];
    (decos || []).forEach(function (d) {
      var c = owned ? (cnt[d.id] || 0) : null, max = d.max_count || MAXC;
      if (c) { haveTypes++; pieces += c; if (c >= max) full++; }
      (d.categories || []).forEach(function (k) {
        var b = byCat[k] || (byCat[k] = { total: 0, have: 0 });
        b.total++; if (c) b.have++;
      });
      if (cat !== 'all' && (d.categories || []).map(String).indexOf(cat) < 0) return;
      if (owned && only === 'have' && !c) return;
      if (owned && only === 'missing' && c) return;
      var name = clean(d.name);
      if (q && fold(name).indexOf(q) < 0) return;
      list.push({ id: d.id, name: name, icon: d.icon, count: c, max: max, cats: (d.categories || []).map(function (k) { return catName[k] || ''; }).filter(Boolean) });
    });
    list.sort(function (a, b) { return (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name, 'es'); });
    var limit = ui.limit || SHOW;
    var catList = (cats || []).map(function (c) { var b = byCat[c.id] || { total: 0, have: 0 }; return { id: c.id, name: catName[c.id], total: b.total, have: owned ? b.have : null }; });
    return { total: (decos || []).length, haveTypes: owned ? haveTypes : null, pieces: owned ? pieces : null, full: owned ? full : null,
      matched: list.length, shown: list.slice(0, limit), more: Math.max(0, list.length - limit), cats: catList, ui: { q: ui.q || '', only: only, cat: cat } };
  }

  function statusText(s) {
    if (!s || s === 'ok') return '';
    if (s === 'nokey') return 'Cargá tu API Key para ver lo que tenés.';
    if (s === 'perm') return PERM;
    if (s === 'loading') return 'Leyendo tu cuenta…';
    return 'Sin datos: no pude leer tu cuenta ahora. Probá con «Actualizar».';
  }
  function badge(h) {
    return h == null ? '<span class="hx-b hx-b--nd">sin datos</span>' : h ? '<span class="hx-b hx-b--ok">La tenés</span>' : '<span class="hx-b hx-b--no">Te falta</span>';
  }

  function glyphsHTML(g, acct) {
    var note = statusText(acct);
    var h = '<section class="hs-card" aria-labelledby="hxGlyH"><div class="hs-card-h"><h3 id="hxGlyH">Glifos de las cajas de recolección</h3><small>' +
      (g.have == null ? 'de ' + g.total : 'Tenés ' + g.have + ' de ' + g.total) + '</small></div>' +
      '<p class="hs-txt">Cada glifo se guarda en una de las tres cajas de la heredad: cosecha, tala o minería. Lo que hace es el mismo que en tus herramientas.</p>' +
      (note ? '<p class="hx-st" role="status">' + esc(note) + '</p>' : '') + '<ul class="hx-gly">';
    g.rows.forEach(function (r) {
      h += '<li class="hx-g' + (r.have === 0 ? ' hx-g--off' : '') + '"><img src="' + esc(r.icon) + '" alt="" width="40" height="40" loading="lazy">' +
        '<div class="hx-gt"><b>' + esc(r.name) + '</b><small>' + esc(r.kindLabel) + '</small><p>' + esc(r.effect) + '</p></div><ul class="hx-sl" aria-label="Cajas">';
      r.slots.forEach(function (s) { h += '<li><span>' + esc(s.label) + '</span>' + badge(s.have) + '</li>'; });
      h += '</ul></li>';
    });
    return h + '</ul><p class="hs-note">Nombres e íconos: API oficial del juego. Efectos: wiki oficial, «Glyph (upgrade)».</p></section>';
  }

  function decorHTML(m, state) {
    var note = statusText(state.acct);
    var h = '<section class="hs-card" aria-labelledby="hxDecH"><div class="hs-card-h"><h3 id="hxDecH">Decoraciones</h3><small>' +
      (m.haveTypes == null ? fmt(m.total) + ' en el juego' : 'Tenés ' + fmt(m.haveTypes) + ' de ' + fmt(m.total) + ' · ' + fmt(m.pieces) + ' piezas · ' + fmt(m.full) + ' al tope') + '</small></div>';
    if (note) h += '<p class="hx-st" role="status">' + esc(note) + '</p>';
    if (m.haveTypes === 0) h += '<p class="hx-st" role="status">La API no te muestra ninguna. Si todavía no desbloqueaste la heredad de Janthir Wilds, la lista viene vacía.</p>';
    if (state.cat === 'loading') return h + '<p class="hx-st" role="status">Cargando el catálogo de decoraciones del juego…</p></section>';
    if (state.cat === 'error') return h + '<p class="hx-st" role="status">Sin datos: no pude leer el catálogo de decoraciones. Probá con «Actualizar».</p></section>';
    h += '<div class="hs-filters"><label class="hx-sel"><span class="hs-sr">Categoría</span><select id="hxCat"><option value="all">Todas las categorías</option>';
    m.cats.forEach(function (c) {
      h += '<option value="' + esc(c.id) + '"' + (String(c.id) === m.ui.cat ? ' selected' : '') + '>' + esc(c.name) + ' (' + (c.have == null ? '' : c.have + '/') + c.total + ')</option>';
    });
    h += '</select></label>';
    if (m.haveTypes != null) {
      h += '<div class="hs-pills" role="group" aria-label="Mostrar">';
      ONLY.forEach(function (o) { h += '<button type="button" class="hs-pill" data-hx-only="' + o[0] + '" aria-pressed="' + (m.ui.only === o[0]) + '">' + o[1] + '</button>'; });
      h += '</div>';
    }
    h += '<label class="hs-q"><span class="hs-sr">Buscar decoración</span><input id="hxQ" type="search" placeholder="Buscar decoración" value="' + esc(m.ui.q) + '" autocomplete="off"></label></div>';
    if (!m.shown.length) return h + '<p class="hs-txt">No hay decoraciones con ese filtro.</p></section>';
    h += '<p class="hs-note" role="status">' + fmt(m.matched) + ' decoraciones</p><ul class="hx-dec">';
    m.shown.forEach(function (d) {
      var c = d.count, cls = c == null ? '' : c ? ' hx-d--on' : ' hx-d--off';
      h += '<li class="hx-d' + cls + '"><img src="' + esc(d.icon) + '" alt="" width="40" height="40" loading="lazy"><div class="hx-dt"><b>' + esc(d.name) + '</b><small>' + esc(d.cats.join(' · ')) + '</small></div>' +
        (c == null ? '<span class="hx-b hx-b--nd">sin datos</span>' : '<span class="hx-b' + (c ? ' hx-b--ok' : ' hx-b--no') + '">' + (c ? fmt(c) + ' / ' + fmt(d.max) : 'Te falta') + '</span>') + '</li>';
    });
    h += '</ul>';
    if (m.more) h += '<button type="button" class="hs-btn hx-more" data-hx-more="1">Mostrar ' + Math.min(SHOW, m.more) + ' más (quedan ' + fmt(m.more) + ')</button>';
    return h + '<p class="hs-note">Catálogo y categorías: API oficial del juego, en español. Tope por decoración: ' + MAXC + '.</p></section>';
  }

  var CSS = [
    '.hx-st{margin:4px 0 10px;padding-left:8px;border-left:3px solid var(--hs-mod);font-size:.84rem;color:var(--tx-1)}',
    '.hx-gly,.hx-sl,.hx-dec{list-style:none;margin:0;padding:0}',
    '.hx-gly{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:8px}',
    '.hx-g{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px}',
    '.hx-g img,.hx-d img{width:40px;height:40px;border-radius:8px;background:var(--bg-2);flex-shrink:0}.hx-g--off img{opacity:.55}',
    '.hx-gt{flex:1;min-width:180px}.hx-gt b,.hx-dt b{display:block;font-size:.88rem;color:var(--tx-1)}',
    '.hx-gt small,.hx-dt small{font-size:.72rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.04em}.hx-dt small{text-transform:none;letter-spacing:0}',
    '.hx-gt p{margin:4px 0 0;font-size:.82rem;color:var(--tx-1)}',
    '.hx-sl{display:flex;gap:6px;flex-wrap:wrap;width:100%}.hx-sl li{display:flex;gap:6px;align-items:center;font-size:.76rem;color:var(--tx-2);border:1px solid var(--bd-1);border-radius:999px;padding:2px 4px 2px 10px}',
    '.hx-b{font-size:.72rem;font-weight:700;border:1px solid var(--bd-2);border-radius:999px;padding:1px 8px;color:var(--tx-1);white-space:nowrap}',
    '.hx-b--ok{border-color:var(--color-green,#3CC48A)}.hx-b--no{border-color:var(--color-amber,#F2B94B)}.hx-b--nd{color:var(--tx-2)}',
    '.hx-sel select{font:inherit;font-size:.85rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;background:var(--bg-0);color:var(--tx-1);min-height:32px;max-width:100%}',
    '.hx-dec{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;margin-top:6px}',
    '.hx-d{display:flex;gap:10px;align-items:center;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:8px 10px}',
    '.hx-d--on{border-color:color-mix(in srgb,var(--color-green,#3CC48A) 60%,var(--bd-1))}.hx-d--off img{opacity:.55}',
    '.hx-dt{flex:1;min-width:0}.hx-dt b{overflow-wrap:anywhere}',
    '.hx-more{margin-top:10px}',
    '#hsRoot select:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.hx-gly,.hx-dec{grid-template-columns:1fr}.hx-sel,.hx-sel select{width:100%}.hx-sel select{min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado y red
  var doc = root.document;
  var st = { gd: null, gdP: null, gdErr: false, decos: null, cats: null, decP: null, decErr: false, acct: {}, ui: { cat: 'all', only: 'all', q: '', limit: SHOW } };

  function repaint() { if (root.HomeView && typeof root.HomeView.render === 'function') root.HomeView.render(); }
  function ensureCss() {
    if (!doc || !doc.getElementById || doc.getElementById('hx-css')) return;
    var s = doc.createElement('style'); s.id = 'hx-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function getJSON(url, tk) {
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var t = ctl && root.setTimeout ? root.setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var opt = {}; if (ctl) opt.signal = ctl.signal;
    if (tk) url += (url.indexOf('?') < 0 ? '?' : '&') + 'access_token=' + encodeURIComponent(tk);
    return root.fetch(url, opt).then(function (r) {
      if (t && root.clearTimeout) root.clearTimeout(t);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }, function (e) { if (t && root.clearTimeout) root.clearTimeout(t); throw e; });
  }
  function fp(tk) {
    var P = root.HomeView && root.HomeView._pure;
    return P && P.fingerprint ? P.fingerprint(tk) : (tk ? String(tk).slice(-6) : null);
  }

  function loadGlyphs() {
    if (st.gd || st.gdP) return st.gdP;
    st.gdP = getJSON(GLYPHS_URL).then(function (d) { st.gd = d; st.gdErr = false; }, function () { st.gdErr = true; })
      .then(function () { st.gdP = null; repaint(); });
    return st.gdP;
  }
  function loadDecor() {
    if (st.decos || st.decP) return st.decP;
    st.decP = Promise.all([getJSON(API + '/v2/homestead/decorations'), getJSON(API + '/v2/homestead/decorations/categories?ids=all&lang=es')])
      .then(function (r) {
        st.cats = (r[1] || []).slice().sort(function (a, b) { return a.id - b.id; });
        return Promise.all(chunks(r[0] || [], CHUNK).map(function (ids) { return getJSON(API + '/v2/homestead/decorations?lang=es&ids=' + ids.join(',')); }));
      })
      .then(function (pages) { st.decos = [].concat.apply([], pages); st.decErr = false; }, function (e) { st.decErr = true; if (root.console) root.console.warn(LOG, 'catálogo', e && e.message); })
      .then(function () { st.decP = null; repaint(); });
    return st.decP;
  }
  /** Cuenta: glifos y decoraciones, por huella de la Key (nunca la Key), en memoria y 5 min. */
  function loadAcct(tk, what, force) {
    var f = fp(tk);
    if (!f) return null;
    var a = st.acct[f] || (st.acct[f] = {}), cur = a[what];
    if (cur && (cur.p || (!force && Date.now() - cur.at < TTL))) return cur;
    var path = what === 'glyphs' ? '/v2/account/homestead/glyphs' : '/v2/account/homestead/decorations';
    a[what] = { state: 'loading', data: cur ? cur.data : null, at: 0 };
    a[what].p = getJSON(API + path, tk).then(function (d) {
      a[what] = { state: 'ok', data: Array.isArray(d) ? d : [], at: Date.now() };
    }, function (e) {
      a[what] = { state: e && (e.status === 401 || e.status === 403) ? 'perm' : 'error', data: null, at: Date.now() };
    }).then(repaint);
    return a[what];
  }

  /** Lo llama HomeView.render() para la pestaña activa. ctx: { token }. */
  function html(tab, ctx) {
    ensureCss();
    var tk = ctx && ctx.token, acc = tk ? loadAcct(tk, tab === 'glyphs' ? 'glyphs' : 'decor', false) : null;
    var as = !tk ? 'nokey' : (acc ? (acc.state === 'loading' && acc.data ? 'ok' : acc.state) : 'error');
    var data = acc && acc.data;
    if (tab === 'glyphs') {
      if (!st.gd) { if (!st.gdErr) loadGlyphs(); return '<p class="hx-st" role="status">' + (st.gdErr ? 'Sin datos: no pude leer la lista de glifos. Probá con «Actualizar».' : 'Cargando los glifos…') + '</p>'; }
      return glyphsHTML(glyphModel(st.gd, as === 'ok' ? data : null), as);
    }
    if (!st.decos && !st.decErr) loadDecor();
    var cs = st.decos ? 'ok' : (st.decErr ? 'error' : 'loading');
    return decorHTML(decorModel(st.decos || [], st.cats || [], as === 'ok' ? data : null, st.ui), { acct: as, cat: cs });
  }

  function attr(t, k) {
    for (var n = t, i = 0; n && i < 5; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(k) != null) return n.getAttribute(k);
    return null;
  }
  /** Devuelven true si el evento era mío (HomeView no hace nada más). */
  function onClick(e) {
    var t = e && e.target, o = attr(t, 'data-hx-only'), more = attr(t, 'data-hx-more');
    if (o) { st.ui.only = o; st.ui.limit = SHOW; repaint(); return true; }
    if (more) { st.ui.limit += SHOW; repaint(); return true; }
    return false;
  }
  function onInput(e) {
    var t = e && e.target;
    if (!t || t.id !== 'hxQ') return false;
    st.ui.q = String(t.value || ''); st.ui.limit = SHOW; repaint();
    return true;
  }
  function onChange(e) {
    var t = e && e.target;
    if (!t || t.id !== 'hxCat') return false;
    st.ui.cat = String(t.value || 'all'); st.ui.limit = SHOW; repaint();
    return true;
  }
  function refresh() { st.acct = {}; st.decErr = false; st.gdErr = false; }

  if (doc && doc.addEventListener) doc.addEventListener('gn:tokenchange', function () { st.acct = {}; });

  root.HomeExtra = {
    version: VERSION, html: html, onClick: onClick, onInput: onInput, onChange: onChange, refresh: refresh,
    tabs: [['glyphs', 'Glifos'], ['decor', 'Decoraciones']],
    _pure: { esc: esc, fold: fold, clean: clean, fmt: fmt, chunks: chunks, glyphModel: glyphModel, decorModel: decorModel, statusText: statusText,
      glyphsHTML: glyphsHTML, decorHTML: decorHTML, CSS: CSS, SHOW: SHOW, MAXC: MAXC, GLYPHS_URL: GLYPHS_URL },
    _state: function () { return st; }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
