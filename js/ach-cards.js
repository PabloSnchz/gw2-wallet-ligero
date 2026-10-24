/*!
 * js/ach-cards.js — Logros: filtros y tarjetas «te falta» (BL-067, LOG-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.2.0 (2026-10-24)
 *  - 1.2.0 (LOG-5): el lector de pantalla oye cuántos logros quedan al filtrar (un aviso corto
 *    en role=status, en lugar de leer toda la grilla) y en el celular «Ver en la Armería →» y
 *    «Wiki ↗» tienen 44 px de alto para el dedo.
 *  - 1.1.0 (LOG-4): si js/ach-armory.js está cargado, la tarjeta suma «Ver en la Armería →» cuando
 *    lo que da el logro es una legendaria o una pieza de una sola; en «Colecciones legendarias»
 *    le pide los precursores para encontrar también las partes.
 *
 * Pinta la barra de filtros y la grilla de Logros con el estado de achievements.js
 * (3.4.0 o más: Achievements.cardsByModule, getSnapshot, setFilter y el evento gn:achievements).
 *  - Filtros accesibles: búsqueda, umbral y recompensa con botones (aria-pressed) y la
 *    categoría con un <select> nativo. En el celular van en un bloque «Filtros · N».
 *  - Tarjetas «te falta»: lo que falta en grande, barra verde que pasa a dorada al 95 %
 *    (nunca roja), recompensas con su ícono y AP al terminar.
 *  - El ícono oficial de Guild Wars 2 de cada logro va arriba, a 48 px, siempre visible
 *    (regla de Pablo, LOG-0). Si el logro no trae ícono, va el de Logros.
 *  - Recompensas: un pedido por tipo (ítems, títulos, maestrías), en español, y al llegar se
 *    actualizan solo esas etiquetas: la grilla no se repinta ni pierde el foco.
 *  - Wiki: búsqueda en la wiki oficial en español (los nombres llegan en español).
 * Con un achievements.js anterior no hace nada. Se carga por js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.2.0';
  var LOG = '[AchCards]';
  var ICON = 'assets/icons/155059.png';
  var ICON_AP = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var WIKI = 'https://wiki-es.guildwars2.com/index.php?search=';
  var API = 'https://api.guildwars2.com/v2/';
  var FALLBACK = { Item: 'assets/icons/Welcome/1228903.png', Title: 'assets/icons/Welcome/605001.png', Mastery: 'assets/icons/Welcome/1078543.png', Coins: 'assets/icons/733322.png' };
  var STEP = 0.95, MAX = 60, NEAR = 0.8;
  var PCTS = [[0.8, '≥ 80 %'], [0.9, '≥ 90 %'], [0.95, '≥ 95 %'], [0, 'Todos']];
  var REWARDS = [['', 'Todas'], ['Item', 'Ítem'], ['Title', 'Título'], ['Mastery', 'Maestría']];

  // ------------------------------------------------------------------ puro
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function missing(pr) { return Math.max(0, Math.round((Number(pr && pr.max) || 0) - (Number(pr && pr.cur) || 0))); }

  // Porcentaje que se muestra: nunca 100 si todavía falta algo.
  function shownPct(pr) { return Math.max(0, Math.min(99, Math.floor((Number(pr && pr.pct) || 0) * 100))); }

  // 12345 cobre → «1 oro 23 plata 45 cobre».
  function coins(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    var g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), c = n % 100, out = [];
    if (g) out.push(fmtInt(g) + ' oro');
    if (s) out.push(s + ' plata');
    if (c || !out.length) out.push(c + ' cobre');
    return out.join(' ');
  }

  // Una recompensa → ícono y texto, con lo que ya está en la caché.
  function rewardInfo(r, cache) {
    var c = cache && cache[r.type] ? cache[r.type][r.id] : null;
    var n = Number(r.count) > 1 ? ' ×' + fmtInt(r.count) : '';
    if (r.type === 'Item') return { key: 'Item:' + r.id, n: Number(r.count) || 1, icon: (c && c.icon) || FALLBACK.Item, label: (c ? c.name : 'Ítem') + n, pending: !c };
    if (r.type === 'Title') return { key: 'Title:' + r.id, icon: FALLBACK.Title, label: c ? 'Título «' + c.name + '»' : 'Título', pending: !c };
    if (r.type === 'Mastery') return { key: 'Mastery:' + r.id, icon: (c && c.icon) || FALLBACK.Mastery, label: c ? 'Maestría: ' + c.name : 'Punto de maestría', pending: !c };
    if (r.type === 'Coins') return { key: 'Coins:' + (r.count || 0), icon: FALLBACK.Coins, label: coins(r.count), pending: false };
    return null;
  }

  // Ids que faltan en la caché, por tipo, para las filas que se muestran.
  function missingIds(rows, cache, asked) {
    var out = { Item: [], Title: [], Mastery: [] };
    (rows || []).forEach(function (x) {
      (x && x.meta && Array.isArray(x.meta.rewards) ? x.meta.rewards : []).forEach(function (r) {
        if (!r || !out[r.type] || r.id == null) return;
        if (cache[r.type][r.id] || (asked && asked[r.type][r.id]) || out[r.type].indexOf(r.id) >= 0) return;
        out[r.type].push(r.id);
      });
    });
    return out;
  }

  function rewardLi(info) {
    return '<li data-achc-rw="' + esc(info.key) + '"' + (info.n > 1 ? ' data-achc-n="' + info.n + '"' : '') + '>' + rewardInner(info) + '</li>';
  }
  function rewardInner(info) {
    return '<img src="' + esc(info.icon) + '" alt="" width="20" height="20" loading="lazy" referrerpolicy="no-referrer"><span>' + esc(info.label) + '</span>';
  }

  function apLeft(x, calc) {
    if (!calc || !x || !x.meta) return 0;
    return Math.max(0, (Number(calc.totalAP(x.meta)) || 0) - (Number(calc.earnedAP(x.r, x.meta)) || 0));
  }

  // Una tarjeta. ctx = { catById, achIdToCat, cache, calc, legendary }
  function cardHTML(x, ctx) {
    var meta = x.meta || {}, pr = x.pr || {}, id = x.r && x.r.id;
    var name = meta.name || ('Logro #' + id);
    var k = missing(pr), max = Math.max(0, Math.round(Number(pr.max) || 0)), pct = shownPct(pr), step = (Number(pr.pct) || 0) >= STEP;
    var cid = ctx.achIdToCat ? ctx.achIdToCat.get(String(id)) : '', cat = cid && ctx.catById ? ctx.catById.get(String(cid)) : null;
    var rw = (Array.isArray(meta.rewards) ? meta.rewards : []).map(function (r) { return r ? rewardInfo(r, ctx.cache) : null; }).filter(Boolean);
    var ap = apLeft(x, ctx.calc), arm = '';
    if (typeof ctx.armory === 'function') { try { arm = ctx.armory(x) || ''; } catch (e) { arm = ''; } }
    var h = [];
    h.push('<article class="achc-card' + (step ? ' achc-card--step' : '') + '" data-id="' + esc(id) + '">');
    h.push('<div class="achc-top"><img class="achc-ico" src="' + esc(meta.icon || ICON) + '" alt="" width="48" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer">');
    h.push('<div class="achc-name"><h3 class="achc-title">' + esc(name) + '</h3>');
    if (cat) h.push('<span class="achc-cat">' + (cat.icon ? '<img src="' + esc(cat.icon) + '" alt="" width="16" height="16" loading="lazy" referrerpolicy="no-referrer">' : '') + esc(cat.name || '') + '</span>');
    h.push('</div></div>');
    h.push('<p class="achc-miss">' + (k === 1 ? 'Te falta <b>1</b>' : 'Te faltan <b>' + fmtInt(k) + '</b>') + (max > 1 ? ' de ' + fmtInt(max) : '') + '</p>');
    h.push('<div class="achc-prog' + (step ? ' achc-prog--step' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct +
      '" aria-label="Progreso de «' + esc(name) + '»: ' + pct + ' %"><i style="width:' + pct + '%"></i></div>');
    if (rw.length) h.push('<ul class="achc-rw" aria-label="' + (ctx.legendary ? 'Te da' : 'Recompensas') + '">' + rw.map(rewardLi).join('') + '</ul>');
    h.push('<div class="achc-foot"><span class="achc-ap">' + (ap ? '<img src="' + ICON_AP + '" alt="" width="16" height="16">+' + fmtInt(ap) + ' AP al terminar' : '') + '</span>');
    h.push('<span class="achc-links">' + arm + '<a class="achc-wiki" href="' + WIKI + encodeURIComponent(name) + '" target="_blank" rel="noopener" aria-label="Buscar «' + esc(name) + '» en la wiki (se abre en otra pestaña)">Wiki ↗</a></span></div>');
    h.push('</article>');
    return h.join('');
  }

  function gridHTML(snap, ctx) {
    if (!snap.hasToken) return '<p class="achc-empty">Cargá tu API Key para ver tus logros.</p>';
    var rows = snap.rows || [];
    if (!rows.length) {
      return '<p class="achc-empty">' + (ctx.legendary ? 'No tenés colecciones legendarias en curso.' : 'No hay logros con estos filtros.') +
        (activeCount(snap) ? ' <button type="button" class="achc-link" data-achc-act="reset">Ver todos los pendientes</button>' : '') + '</p>';
    }
    var h = rows.slice(0, MAX).map(function (x) { return cardHTML(x, ctx); });
    if (rows.length > MAX) h.push('<p class="achc-note">Ves los ' + MAX + ' más cercanos de ' + fmtInt(rows.length) + '. Usá los filtros para encontrar el resto.</p>');
    return h.join('');
  }

  // Lo que oye el lector de pantalla al filtrar: corto, sin leer la grilla.
  function countText(snap, legendary) {
    if (!snap || !snap.hasToken || !snap.loaded) return '';
    var n = (snap.rows || []).length;
    if (!n) return legendary ? 'No tenés colecciones legendarias en curso.' : 'No hay logros con estos filtros.';
    var what = legendary ? (n === 1 ? 'colección legendaria' : 'colecciones legendarias') : (n === 1 ? 'logro' : 'logros');
    return n > MAX ? 'Ves los ' + MAX + ' más cercanos de ' + fmtInt(n) + ' ' + what + '.' : 'Ves ' + fmtInt(n) + ' ' + what + '.';
  }

  // Filtros distintos de los de entrada (≥ 80 %, sin recompensa, sin categoría, sin búsqueda).
  function activeCount(snap) {
    return (Number(snap.pct) !== NEAR ? 1 : 0) + (snap.reward ? 1 : 0) + (snap.cat ? 1 : 0) + (String(snap.q || '').trim() ? 1 : 0);
  }

  // Categorías con logros pendientes, por nombre; la elegida siempre está.
  function pendingCats(snap, calc) {
    var seen = {}, out = [];
    (snap.acc || []).forEach(function (r) {
      var meta = snap.metaById && snap.metaById.get(r.id);
      if (!meta || !calc) return;
      var pr = calc.computeProgress(r, meta);
      var cid = snap.achIdToCat ? snap.achIdToCat.get(String(r.id)) : '';
      if (pr && pr.pct < 1 && cid) seen[cid] = true;
    });
    if (snap.cat) seen[String(snap.cat)] = true;
    Object.keys(seen).forEach(function (id) {
      var c = snap.catById ? snap.catById.get(String(id)) : null;
      out.push({ id: String(id), name: (c && c.name) || ('#' + id) });
    });
    return out.sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
  }

  function controlsHTML(snap, cats) {
    var h = ['<div class="achc-seg" role="group" aria-label="Qué tan cerca">'];
    PCTS.forEach(function (p) { h.push('<button type="button" data-achc-pct="' + p[0] + '" aria-pressed="' + (Number(snap.pct) === p[0]) + '">' + p[1] + '</button>'); });
    h.push('</div><div class="achc-seg" role="group" aria-label="Recompensa">');
    REWARDS.forEach(function (r) { h.push('<button type="button" data-achc-reward="' + r[0] + '" aria-pressed="' + (String(snap.reward || '') === r[0]) + '">' + r[1] + '</button>'); });
    h.push('</div><label class="achc-sel"><span>Categoría</span><select id="achcCat"><option value="">Todas</option>');
    cats.forEach(function (c) { h.push('<option value="' + esc(c.id) + '"' + (String(snap.cat || '') === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'); });
    h.push('</select></label>');
    return h.join('');
  }

  var CSS = [
    '.achc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}',
    '.achc-search{flex:1 1 220px;display:flex;min-width:0}',
    '.achc-search input{font:inherit;font-size:.86rem;width:100%;min-height:36px;padding:6px 10px;border:1px solid var(--bd-2);border-radius:10px;background:var(--bg-0);color:var(--tx-1)}',
    '.achc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.achc-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.achc-seg{display:inline-flex;border:1px solid var(--bd-2);border-radius:10px;overflow:hidden}',
    '.achc-seg button{font:inherit;font-size:.82rem;background:none;border:0;border-right:1px solid var(--bd-1);padding:6px 10px;color:var(--tx-2);cursor:pointer;min-height:36px;white-space:nowrap}',
    '.achc-seg button:last-child{border-right:0}.achc-seg button[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);font-weight:600}',
    '.achc-sel{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;color:var(--tx-2)}',
    '.achc-sel select{font:inherit;font-size:.82rem;min-height:36px;max-width:240px;padding:4px 8px;border:1px solid var(--bd-2);border-radius:10px;background:var(--bg-0);color:var(--tx-1)}',
    '.achc-more{display:none;font:inherit;font-size:.84rem;border:1px solid var(--bd-2);border-radius:10px;padding:6px 12px;background:transparent;color:var(--tx-1);cursor:pointer;min-height:44px}',
    '#achievementsMain{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
    '.achc-card{display:flex;flex-direction:column;gap:8px;min-width:0;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:12px}',
    '.achc-card--step{border-color:var(--color-amber,#F2B94B)}',
    '.achc-top{display:flex;gap:12px;align-items:flex-start}.achc-name{min-width:0}',
    '.achc-ico{width:48px;height:48px;flex-shrink:0;border-radius:10px;background:var(--bg-2);padding:3px;box-shadow:0 0 0 1px var(--bd-2)}',
    '.achc-title{margin:0;font-size:.95rem;line-height:1.3;color:var(--tx-1);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
    '.achc-cat{display:inline-flex;align-items:center;gap:5px;margin-top:3px;font-size:.76rem;color:var(--tx-2)}.achc-cat img{border-radius:3px}',
    '.achc-miss{margin:0;font-size:.88rem;color:var(--tx-1)}.achc-miss b{font-size:1.2rem;color:var(--color-amber,#F2B94B)}',
    '.achc-prog{height:8px;border-radius:8px;background:var(--bg-2);overflow:hidden}.achc-prog i{display:block;height:100%;border-radius:8px;background:var(--color-green,#3CC48A)}',
    '.achc-prog--step i{background:var(--color-amber,#F2B94B)}',
    '.achc-rw{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}',
    '.achc-rw li{display:inline-flex;align-items:center;gap:6px;max-width:100%;font-size:.76rem;color:var(--tx-2);border:1px solid var(--bd-1);border-radius:999px;padding:2px 10px 2px 3px;background:var(--bg-0)}',
    '.achc-rw img{border-radius:4px;flex-shrink:0}.achc-rw span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.achc-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;font-size:.78rem;color:var(--tx-2)}',
    '.achc-ap{display:inline-flex;align-items:center;gap:5px}.achc-ap img{border-radius:3px}',
    '.achc-wiki{display:inline-flex;align-items:center;min-height:28px;padding:2px 8px;border:1px solid var(--bd-2);border-radius:8px;color:var(--acc-1);text-decoration:none}',
    '.achc-wiki:hover{border-color:var(--acc-1)}',
    '.achc-links{display:inline-flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}',
    '.achc-armory{display:inline-flex;align-items:center;min-height:28px;padding:2px 8px;border:1px solid var(--color-amber,#F2B94B);border-radius:8px;color:var(--tx-1);text-decoration:none;font-weight:600}',
    '.achc-armory:hover{background:var(--bg-2)}',
    '.achc-empty,.achc-note{grid-column:1/-1;margin:4px 0;color:var(--tx-2);font-size:.88rem}.achc-note{font-size:.8rem}',
    '.achc-link{font:inherit;background:none;border:0;padding:0;color:var(--acc-1);text-decoration:underline;cursor:pointer}',
    '.achc-bar button:focus-visible,.achc-bar input:focus-visible,.achc-bar select:focus-visible,.achc-wiki:focus-visible,.achc-armory:focus-visible,.achc-link:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.achc-more{display:inline-flex;align-items:center}.achc-search input,.achc-sel select{min-height:44px}.achc-wiki,.achc-armory{min-height:44px;padding:4px 12px}',
    '.achc-ctrl{display:none;width:100%;flex-direction:column;align-items:stretch;padding:10px;border:1px solid var(--bd-2);border-radius:12px;background:var(--bg-1)}',
    '.achc-ctrl.achc-open{display:flex}.achc-seg{display:flex}.achc-seg button{flex:1;min-height:44px}.achc-sel{justify-content:space-between}.achc-sel select{max-width:none;flex:1}',
    '#achievementsMain{grid-template-columns:1fr}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { cache: { Item: {}, Title: {}, Mastery: {} }, asked: { Item: {}, Title: {}, Mastery: {} }, open: false, timer: null, count: null };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function api() { var A = root.Achievements; return A && A.cardsByModule && typeof A.getSnapshot === 'function' && typeof A.setFilter === 'function' ? A : null; }

  function ensureBar(main) {
    if (!byId('ach-cards-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'ach-cards-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var bar = byId('achcBar');
    if (bar) return bar;
    bar = doc.createElement('div');
    bar.id = 'achcBar';
    bar.className = 'ach-toolbar achc-bar';
    bar.setAttribute('role', 'search');
    bar.setAttribute('aria-label', 'Filtros de Logros');
    bar.innerHTML = '<label class="achc-search"><span class="achc-sr">Buscar logro</span><input type="search" id="achcSearch" placeholder="Buscar logro…" autocomplete="off"></label>' +
      '<button type="button" class="achc-more" id="achcMore" data-achc-act="more" aria-expanded="false" aria-controls="achcCtrl">Filtros</button>' +
      '<div class="achc-ctrl" id="achcCtrl"></div><p class="achc-sr" id="achcCount" role="status" aria-live="polite"></p>';
    var parent = main.parentNode || byId('achievementsPanel');
    if (parent && parent.insertBefore) parent.insertBefore(bar, main);
    wire(bar, main);
    return bar;
  }

  function focusKey() {
    var a = doc.activeElement;
    if (!a || !a.getAttribute) return null;
    var p = a.getAttribute('data-achc-pct'), r = a.getAttribute('data-achc-reward');
    return p != null ? '[data-achc-pct="' + p + '"]' : r != null ? '[data-achc-reward="' + r + '"]' : a.id === 'achcCat' ? '#achcCat' : null;
  }

  function render() {
    var A = api(), main = byId('achievementsMain');
    if (!A || !main) return null;
    var snap = A.getSnapshot(), bar = ensureBar(main);
    var legendary = !!(snap.legendaryCatId && String(snap.cat || '') === String(snap.legendaryCatId));
    bar.hidden = !snap.hasToken;
    var ctrl = byId('achcCtrl'), more = byId('achcMore'), input = byId('achcSearch');
    if (ctrl) {
      var fk = focusKey();
      ctrl.innerHTML = controlsHTML(snap, pendingCats(snap, A._calc));
      if (ctrl.classList) ctrl.classList[st.open ? 'add' : 'remove']('achc-open');
      if (fk && ctrl.querySelector) { var b = ctrl.querySelector(fk); if (b && b.focus) b.focus(); }
    }
    var n = activeCount(snap);
    if (more) { more.textContent = 'Filtros' + (n ? ' · ' + n : ''); more.setAttribute('aria-expanded', String(st.open)); }
    if (input && doc.activeElement !== input && input.value !== String(snap.q || '')) input.value = String(snap.q || '');
    if (snap.hasToken && !snap.loaded) return snap;
    var AR = root.AchArmory, armory = AR && typeof AR.linkHTML === 'function' ? AR.linkHTML : null;
    if (legendary && AR && typeof AR.wantDeep === 'function') AR.wantDeep();
    main.innerHTML = gridHTML(snap, { catById: snap.catById, achIdToCat: snap.achIdToCat, cache: st.cache, calc: A._calc, legendary: legendary, armory: armory });
    askRewards((snap.rows || []).slice(0, MAX), main);
    var live = byId('achcCount'), txt = countText(snap, legendary);
    if (live && st.count !== txt) { st.count = txt; live.textContent = txt; }
    return snap;
  }

  // Un pedido por tipo; al llegar, solo se cambian esas etiquetas (sin repintar la grilla).
  function askRewards(rows, main) {
    var ids = missingIds(rows, st.cache, st.asked);
    Object.keys(ids).forEach(function (type) {
      var list = ids[type];
      if (!list.length) return;
      list.forEach(function (id) { st.asked[type][id] = true; });
      fetchType(type, list).then(function (arr) {
        (arr || []).forEach(function (o) { if (o && o.id != null) st.cache[type][o.id] = { name: o.name || '', icon: o.icon || '' }; });
        list.forEach(function (id) {
          if (!st.cache[type][id]) st.cache[type][id] = { name: type === 'Item' ? 'Ítem #' + id : '', icon: '' };
          patchRewards(main, type, id);
        });
      }, function (e) {
        list.forEach(function (id) { delete st.asked[type][id]; });
        if (root.console) root.console.warn(LOG, 'recompensas', type, e);
      });
    });
  }

  function fetchType(type, ids) {
    if (type === 'Item') {
      var G = root.GW2Api;
      return G && typeof G.getItemsMany === 'function' ? Promise.resolve(G.getItemsMany(ids, { nocache: false })) : Promise.resolve([]);
    }
    if (typeof root.fetch !== 'function') return Promise.resolve([]);
    var url = API + (type === 'Title' ? 'titles' : 'masteries') + '?ids=' + ids.join(',') + '&lang=es';
    return root.fetch(url).then(function (r) { return r && r.ok ? r.json() : []; });
  }

  function patchRewards(main, type, id) {
    if (!main || !main.querySelectorAll) return;
    Array.prototype.forEach.call(main.querySelectorAll('[data-achc-rw="' + type + ':' + id + '"]'), function (li) {
      var info = rewardInfo({ type: type, id: id, count: Number(li.getAttribute('data-achc-n')) || 1 }, st.cache);
      if (info) li.innerHTML = rewardInner(info);
    });
  }

  function attr(t, k, stop) {
    for (var n = t, i = 0; n && n !== stop && i < 6; n = n.parentNode, i++) {
      if (n.getAttribute && n.getAttribute(k) != null) return n.getAttribute(k);
    }
    return null;
  }

  function wire(bar, main) {
    bar.addEventListener('click', function (e) {
      var A = api();
      if (!A) return;
      var p = attr(e.target, 'data-achc-pct', bar), r = attr(e.target, 'data-achc-reward', bar), act = attr(e.target, 'data-achc-act', bar);
      if (p != null) A.setFilter({ pct: Number(p) });
      else if (r != null) A.setFilter({ reward: r });
      else if (act === 'more') { st.open = !st.open; render(); }
    });
    bar.addEventListener('change', function (e) {
      var A = api();
      if (A && e.target && e.target.id === 'achcCat') A.setFilter({ cat: e.target.value || '' });
    });
    bar.addEventListener('input', function (e) {
      if (!e.target || e.target.id !== 'achcSearch') return;
      var v = e.target.value;
      clearTimeout(st.timer);
      st.timer = setTimeout(function () { var A = api(); if (A) A.setFilter({ q: v }); }, 200);
    });
    main.addEventListener('click', function (e) {
      var A = api();
      if (A && attr(e.target, 'data-achc-act', main) === 'reset') A.setFilter({ pct: 0, reward: '', q: '', cat: '' });
    });
  }

  function init() {
    if (!byId('achievementsMain')) return;
    if (doc.addEventListener) {
      doc.addEventListener('gn:achievements', function () { render(); });
      doc.addEventListener('gn:boot-ready', function () { setTimeout(render, 0); });
    }
    render();
  }

  root.AchCards = {
    version: VERSION, render: render,
    _pure: { fmtInt: fmtInt, missing: missing, shownPct: shownPct, coins: coins, rewardInfo: rewardInfo, missingIds: missingIds,
      cardHTML: cardHTML, gridHTML: gridHTML, activeCount: activeCount, pendingCats: pendingCats, controlsHTML: controlsHTML, countText: countText, CSS: CSS, WIKI: WIKI },
    _state: st
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
