/*!
 * js/inv-multi.js — Multicuenta: lo de valor de cada cuenta, set por set (BL-070, INV-3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.1.1 (2026-10-25) — INV-7b: el lector oye dónde está (el foco va al detalle y vuelve al número)
 *          1.1.0 (2026-10-25) — INV-7b: el nombre de cada ítem abre su ficha (precio del Bazar y dónde está)
 *          1.0.1 (2026-10-25) — INV-4: presta su lector (InvMulti.read) a Buscar, con la misma caché
 *          1.0.0 (2026-10-25) — INV-3: el Dashboard multicuenta como pestaña de Inventario y Personajes
 *
 * Todo lo que hacía el Dashboard multicuenta (js/inventory-dashboard.js), en una pestaña del módulo:
 *  - los 3 sets de assets/data/inventory-sets.json (Alto Valor, Materiales de artesanía con sus tiers y
 *    Símbolos y demás), el selector de ítems, ordenar por cualquier ítem, ocultar cuentas y columnas en
 *    cero y las cuentas principales, el total por ítem y el valor con el precio de venta del Bazar. Las
 *    preferencias son las mismas claves de siempre (inv_dashboard_*): lo que elegiste se respeta.
 *  - D5: cuenta las bolsas de TODOS los personajes y las ranuras compartidas (antes, solo el primer
 *    personaje de la lista). /v2/characters?ids=all trae todos los personajes de una cuenta en un pedido.
 *  - Tocar un número muestra dónde está: depósito, banco y su pestaña, ranuras compartidas y cada personaje.
 *  - Tocar el nombre de un ítem (arriba de la tabla) abre su ficha, como en el resto del módulo (js/inv-sheet.js).
 *  - Valor por cuenta en su fila. Las cuentas salen de la lista actual (gn:account:keys), no de gw2_keys.
 * Banco y materiales por GW2Api (con su caché). Ranuras compartidas y personajes no tienen función en
 * GW2Api, que está congelado (DEC-035): se leen acá, de a 3 cuentas, con un reintento ante 429 y caché
 * en memoria de 5 minutos. Una cuenta o una fuente que no se pudo leer se dice; nunca un 0 falso.
 * Se suma como pestaña con InvView.register; se carga por js/modules.json después de inv-view.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.1';
  var LOG = '[InvMulti]';
  var SETS_URL = 'assets/data/inventory-sets.json';
  var API = 'https://api.guildwars2.com';
  var POOL = 3, TTL = 5 * 60 * 1000, TIMEOUT = 20000;
  var KEY = { set: 'inv_dashboard_active_set', items: 'inv_dashboard_selected_items', tiers: 'inv_dashboard_active_tiers',
    sort: 'inv_dashboard_sort', hide: 'inv_dashboard_hide_zero' };
  var TIER_ORDER = ['t6', 't5', 't4', 't3'];
  var TAG_ICON = { main: 'assets/icons/Cuentas/547827.png', alter: 'assets/icons/Cuentas/157375.png', f2p: 'assets/icons/Cuentas/102538.png' };
  var TAG_TXT = { main: 'cuenta principal', alter: 'cuenta secundaria', f2p: 'cuenta gratuita' };
  var UNREAD = { bank: 'banco', materials: 'materiales', shared: 'ranuras compartidas', characters: 'bolsas de personajes' };

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
  // Cobre → «1.234 o 56 p» (oro y plata) o «56 p 12 c» si no llega a una de oro.
  function coins(cu) {
    cu = Math.max(0, Math.floor(Number(cu) || 0));
    var g = Math.floor(cu / 10000), s = Math.floor((cu % 10000) / 100), c = cu % 100;
    if (g) return fmtInt(g) + ' o' + (s ? ' ' + s + ' p' : '');
    return (s ? s + ' p ' : '') + c + ' c';
  }
  function M() { return root.InvModel && root.InvModel._pure; }
  function list(x) { return Array.isArray(x) ? x : []; }
  function and(parts) { return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1]; }

  // Preferencias de siempre (las del Dashboard), leídas con tolerancia.
  function readPrefs(get) {
    var sort = get(KEY.sort), hide = get(KEY.hide) || {};
    return {
      set: typeof get(KEY.set) === 'string' ? get(KEY.set) : null,
      items: list(get(KEY.items)).map(Number).filter(function (n) { return n > 0; }),
      tiers: list(get(KEY.tiers)).filter(function (t) { return TIER_ORDER.indexOf(t) >= 0; }),
      sort: sort && sort.column != null ? { column: Number(sort.column), direction: sort.direction === 'asc' ? 'asc' : 'desc' } : null,
      hide: { rows: !!hide.hideZeroRows, cols: !!hide.hideZeroColumns, main: !!hide.hideMainAccounts }
    };
  }

  function activeSet(sets, prefs) {
    var s = list(sets);
    for (var i = 0; i < s.length; i++) if (s[i].id === prefs.set) return s[i];
    return s[0] || null;
  }
  function tiersOf(set, prefs) {
    if (!set || !set.tiers) return [];
    var ok = prefs.tiers.filter(function (t) { return set.tiers[t]; });
    return ok.length ? ok : (set.defaultTiers || [Object.keys(set.tiers)[0]]);
  }
  // Todos los ítems del set (con todos sus tiers): lo que ofrece el selector.
  function allItems(set) {
    if (!set) return [];
    if (Array.isArray(set.items)) return set.items.slice();
    var out = [], seen = {};
    TIER_ORDER.forEach(function (k) {
      var t = set.tiers && set.tiers[k];
      if (t) t.items.forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; out.push({ id: it.id, name: it.name, tier: k }); } });
    });
    return out;
  }
  // Los ítems que se muestran: tu selección (solo la que es de este set) o los del set con sus tiers.
  function activeIds(sets, prefs) {
    var set = activeSet(sets, prefs), P = M();
    if (!set) return [];
    var inSet = allItems(set).map(function (i) { return i.id; });
    var pick = prefs.items.filter(function (id) { return inSet.indexOf(id) >= 0; });
    if (pick.length) return pick;
    return P ? P.setItems(set, tiersOf(set, prefs)).map(function (i) { return i.id; }) : [];
  }

  // Índice de «¿dónde está?» de una cuenta. Sin banco ni materiales, la cuenta queda sin datos.
  function accIndex(a) {
    var P = M();
    if (!P || !a || !a.loaded || (a.bank == null && a.materials == null)) return null;
    return P.indexPlaces({ materials: a.materials, bank: a.bank,
      shared: a.bagsPending ? [] : a.shared, characters: a.bagsPending ? [] : a.chars });
  }

  // La tabla: filtros, orden, totales y valor, como el Dashboard. accounts: [{label, tag, loaded, bagsPending, …}]
  function tableModel(accounts, ids, prices, prefs) {
    var P = M(), accs = list(accounts);
    if (!P) return { cols: [], rows: [], totals: [], value: 0 };
    var all = accs.map(function (a, i) { return { i: i, a: a, index: accIndex(a) }; });
    if (prefs.hide.main) all = all.filter(function (r) { return r.a.tag !== 'main'; });
    var first = P.multiTable(all.map(function (r) { return { label: r.a.label, index: r.index }; }), ids, prices);
    var cols = ids.filter(function (id, k) { return !prefs.hide.cols || first.totals[k] > 0; });
    var t = P.multiTable(all.map(function (r) { return { label: r.a.label, index: r.index }; }), cols, prices);
    var rows = all.map(function (r, k) { return { i: r.i, a: r.a, index: r.index, cells: t.rows[k].cells, value: t.rows[k].value, partial: t.rows[k].partial }; });
    if (prefs.hide.rows) rows = rows.filter(function (r) { return r.cells.some(function (c) { return c !== 0; }); });
    var s = prefs.sort, col = s ? cols.indexOf(s.column) : -1;
    if (col >= 0) {
      rows.sort(function (x, y) {
        var a = x.cells[col], b = y.cells[col];
        if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
        return s.direction === 'asc' ? a - b : b - a;
      });
    }
    var shown = P.multiTable(rows.map(function (r) { return { label: r.a.label, index: r.index }; }), cols, prices);
    return { cols: cols, rows: rows, totals: shown.totals, value: shown.value, sortCol: col >= 0 ? cols[col] : null, sortDir: s ? s.direction : null };
  }

  function rowNote(r) {
    if (!r.a.loaded) return 'leyendo…';
    if (!r.index) return 'sin datos: revisá la API Key';
    var miss = (r.partial || []).map(function (k) { return UNREAD[k] || k; });
    if (miss.length) return 'sin ' + and(miss) + ': falta un permiso';
    if (r.a.bagsPending) return 'leyendo bolsas…';
    return '';
  }

  function whereText(index, id, name, label) {
    var P = M(), p = P ? P.placesOf(index, id) : { total: 0, places: [] };
    if (!p.total) return name + ' en ' + label + ': no tenés.';
    return name + ' en ' + label + ': ' + fmtInt(p.total) + ' — ' + p.places.map(function (x) {
      var where = x.kind === 'materials' ? 'Depósito' : x.kind === 'bank' ? 'Banco, pestaña ' + x.tab : x.kind === 'shared' ? 'Ranuras compartidas' : x.name;
      return where + ' ' + fmtInt(x.count);
    }).join(' · ') + '.';
  }

  // ------------------------------------------------------------------ vista
  function nameOf(id, meta, sets) {
    if (meta && meta[id] && meta[id].name) return meta[id].name;
    var n = null;
    list(sets).forEach(function (s) { allItems(s).forEach(function (it) { if (it.id === id) n = it.name; }); });
    return n || 'Ítem ' + id;
  }
  function ico(id, meta, size) {
    var m = meta && meta[id];
    return m && m.icon ? '<img src="' + esc(m.icon) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" referrerpolicy="no-referrer">' : '';
  }

  // s: { sets, accounts, meta, prices, prefs, where, at, hasKeys, loading }
  function html(s) {
    if (!s.sets) return '<p class="iv-note">Cargando los sets…</p>';
    if (!s.hasKeys) return '<p class="iv-note">Todavía no hay cuentas cargadas. Sumalas en Cuentas y el Multicuenta las lee todas.</p>';
    var prefs = s.prefs, set = activeSet(s.sets, prefs), ids = activeIds(s.sets, prefs), meta = s.meta || {};
    var T = tableModel(s.accounts, ids, s.prices, prefs), h = [];
    var read = list(s.accounts).filter(function (a) { return a.loaded; }).length, total = list(s.accounts).length;
    h.push('<div class="im"><div class="im-bar"><div class="im-sets" role="group" aria-label="Set">');
    s.sets.forEach(function (x) {
      h.push('<button type="button" class="im-set" id="imSet-' + esc(x.id) + '" data-im-set="' + esc(x.id) + '" aria-pressed="' + (x === set) + '">' +
        (x.icon ? '<img src="' + esc(x.icon) + '" alt="" width="18" height="18">' : '') + esc(x.name) + '</button>');
    });
    h.push('</div><p class="im-val">Valor: <b>' + coins(T.value) + '</b><span class="iv-sr"> con el precio de venta del Bazar</span></p></div>');
    if (set && set.tiers) {
      var on = tiersOf(set, prefs);
      h.push('<fieldset class="im-opts"><legend>Tiers</legend>');
      TIER_ORDER.forEach(function (k) {
        if (!set.tiers[k]) return;
        h.push('<label><input type="checkbox" id="imTier-' + k + '" data-im-tier="' + k + '"' + (on.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(set.tiers[k].name) + '</label>');
      });
      h.push('</fieldset>');
    }
    var offer = allItems(set);
    h.push('<details class="im-pick"' + (s.pickOpen ? ' open' : '') + '><summary id="imPick">Ítems: ' + ids.length + ' de ' + offer.length + '</summary><div class="im-pick-b">' +
      '<button type="button" class="iv-btn" id="imAll" data-im-all="1">Volver a los del set</button><ul>');
    offer.forEach(function (it) {
      h.push('<li><label><input type="checkbox" id="imItem-' + it.id + '" data-im-item="' + it.id + '"' + (ids.indexOf(it.id) >= 0 ? ' checked' : '') + '> ' +
        ico(it.id, meta, 18) + esc(nameOf(it.id, meta, s.sets)) + (it.tier ? ' <small>' + esc(set.tiers[it.tier].name) + '</small>' : '') + '</label></li>');
    });
    h.push('</ul></div></details><fieldset class="im-opts"><legend class="iv-sr">Ocultar</legend>' +
      '<label><input type="checkbox" id="imHideRows" data-im-hide="rows"' + (prefs.hide.rows ? ' checked' : '') + '> Ocultar cuentas en cero</label>' +
      '<label><input type="checkbox" id="imHideCols" data-im-hide="cols"' + (prefs.hide.cols ? ' checked' : '') + '> Ocultar ítems en cero</label>' +
      '<label><input type="checkbox" id="imHideMain" data-im-hide="main"' + (prefs.hide.main ? ' checked' : '') + '> Ocultar cuentas principales</label></fieldset>');
    var stTxt = s.loading ? 'Leyendo cuentas: ' + read + ' de ' + total + '…' : 'Leí ' + read + ' de ' + total + (total === 1 ? ' cuenta' : ' cuentas') + (s.at ? ' a las ' + s.at : '') + '.';
    h.push('<p class="im-status" role="status">' + esc(stTxt) + '</p>');
    if (!T.cols.length) { h.push('<p class="iv-note">' + (ids.length ? 'Todos los ítems están en cero.' : 'Elegí al menos un ítem.') + '</p></div>'); return h.join(''); }
    h.push('<ul class="im-kpis">');
    T.cols.forEach(function (id, k) {
      var p = s.prices && s.prices[id], unit = p && p.sells ? p.sells.unit_price || 0 : 0;
      h.push('<li><button type="button" class="iv-open" data-inv-item="' + id + '" aria-haspopup="dialog">' + ico(id, meta, 24) + '<span><small>' + esc(nameOf(id, meta, s.sets)) + '</small><b>' + fmtInt(T.totals[k]) + '</b>' +
        (unit ? '<em>' + coins(unit * T.totals[k]) + '</em>' : '') + '<span class="iv-sr">. Ver la ficha</span></span></button></li>');
    });
    h.push('</ul><div class="im-wrap"><table class="im-table"><caption class="iv-sr">' + esc(set ? set.name : '') + ' por cuenta</caption><thead><tr><th scope="col">Cuenta</th>');
    T.cols.forEach(function (id) {
      var nm = nameOf(id, meta, s.sets), on2 = T.sortCol === id;
      h.push('<th scope="col"' + (on2 ? ' aria-sort="' + (T.sortDir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '><button type="button" class="im-sort" id="imSort-' + id + '" data-im-sort="' + id + '" title="' + esc(nm) + '">' +
        ico(id, meta, 24) + '<span class="iv-sr">Ordenar por ' + esc(nm) + '</span>' + (on2 ? '<span aria-hidden="true">' + (T.sortDir === 'asc' ? '↑' : '↓') + '</span>' : '') + '</button></th>');
    });
    h.push('<th scope="col">Valor</th></tr></thead><tbody>');
    T.rows.forEach(function (r) {
      var note = rowNote(r), tag = r.a.tag;
      h.push('<tr><th scope="row"><span class="im-acc">' + (TAG_ICON[tag] ? '<img src="' + TAG_ICON[tag] + '" alt="" width="18" height="18">' : '') +
        '<span>' + esc(r.a.label) + (TAG_TXT[tag] ? '<span class="iv-sr">, ' + TAG_TXT[tag] + '</span>' : '') + (note ? '<small>' + esc(note) + '</small>' : '') + '</span></span></th>');
      r.cells.forEach(function (c, k) {
        var id = T.cols[k];
        if (c == null) { h.push('<td><span aria-label="sin datos">—</span></td>'); return; }
        h.push('<td><button type="button" class="im-n' + (c ? '' : ' im-n--0') + '" id="imC-' + r.i + '-' + id + '" data-im-cell="' + r.i + ':' + id + '" aria-label="' +
          esc(r.a.label + ', ' + nameOf(id, meta, s.sets) + ': ' + fmtInt(c) + '. Ver dónde está') + '">' + fmtInt(c) + '</button></td>');
      });
      h.push('<td class="im-v">' + (r.value == null ? '—' : coins(r.value)) + '</td></tr>');
    });
    h.push('<tr class="im-tot"><th scope="row">Total</th>');
    T.totals.forEach(function (n) { h.push('<td>' + fmtInt(n) + '</td>'); });
    h.push('<td class="im-v">' + coins(T.value) + '</td></tr></tbody></table></div>');
    h.push('<div class="im-where" aria-live="polite">');
    var w = s.where, wa = w && list(s.accounts)[w.i], wi = wa ? accIndex(wa) : null;
    if (wi) h.push('<p id="imWhereText" tabindex="-1">' + esc(whereText(wi, w.id, nameOf(w.id, meta, s.sets), wa.label)) + '</p><button type="button" class="iv-btn" id="imWhereSheet" data-inv-item="' + w.id + '" aria-haspopup="dialog">Ver la ficha</button>' +
      '<button type="button" class="iv-btn" id="imWhereClose" data-im-close="1">Cerrar</button>');
    h.push('</div><p class="iv-src">Cuenta el depósito de materiales, el banco, las ranuras compartidas y las bolsas de todos tus personajes. Valor con el precio de venta del Bazar.</p></div>');
    return h.join('');
  }

  var CSS = [
    '.im-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
    '.im-sets{display:flex;gap:6px;flex-wrap:wrap}',
    '.im-set{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:.84rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;background:transparent;color:var(--tx-2);cursor:pointer;min-height:34px}',
    '.im-set[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);font-weight:700;border-color:var(--iv-mod)}',
    '.im-val{margin:0 0 0 auto;font-size:.86rem;color:var(--tx-2)}.im-val b{color:var(--tx-1)}',
    '.im-opts{display:flex;gap:14px;flex-wrap:wrap;align-items:center;border:0;margin:0 0 8px;padding:0;font-size:.84rem;color:var(--tx-2)}',
    '.im-opts legend{float:left;margin-right:4px;font-weight:600;color:var(--tx-1)}.im-opts label{display:inline-flex;gap:6px;align-items:center;cursor:pointer;min-height:32px}',
    '.im-pick{margin:0 0 8px;font-size:.84rem;color:var(--tx-2)}.im-pick summary{cursor:pointer;color:var(--tx-1);min-height:32px;display:list-item}',
    '.im-pick-b{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px;margin-top:6px}',
    '.im-pick ul{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px}',
    '.im-pick label{display:flex;gap:6px;align-items:center;cursor:pointer;min-height:32px;color:var(--tx-1)}.im-pick small{color:var(--tx-2)}',
    '.im-status{margin:4px 0 10px;font-size:.8rem;color:var(--tx-2)}',
    '.im-kpis{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}',
    '.im-kpis li{display:flex;gap:8px;align-items:center;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);padding:6px 8px;min-width:0}',
    '.im-kpis .iv-open{gap:8px;min-width:0;min-height:44px}.im-where .iv-btn+.iv-btn{margin-left:6px}',
    '.im-kpis img{border-radius:6px;flex-shrink:0}.im-kpis span{min-width:0}.im-kpis small{display:block;font-size:.72rem;color:var(--tx-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.im-kpis b{font-size:1rem;color:var(--tx-1)}.im-kpis em{display:block;font-style:normal;font-size:.72rem;color:var(--tx-2)}',
    '.im-wrap{overflow-x:auto;border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28))}',
    '.im-table{border-collapse:collapse;width:100%;font-size:.84rem;color:var(--tx-1)}',
    '.im-table th,.im-table td{padding:4px 8px;border-bottom:1px solid var(--bd-1);text-align:center;white-space:nowrap;color:var(--tx-1)}',
    '.im-table thead th{font-size:.74rem;color:var(--tx-2);font-weight:600}',
    '.im-table th[scope=row]{position:sticky;left:0;z-index:1;background:var(--bg-1);text-align:left;font-weight:600}',
    '.im-table thead th:first-child{position:sticky;left:0;z-index:2;background:var(--bg-1);text-align:left}',
    '.im-acc{display:flex;gap:6px;align-items:center}.im-acc small{display:block;font-size:.7rem;font-weight:500;color:var(--tx-2)}',
    '.im-sort{font:inherit;background:none;border:0;padding:2px;color:var(--tx-2);cursor:pointer;display:inline-flex;align-items:center;gap:2px;min-height:32px}',
    '.im-sort img{border-radius:6px}',
    '.im-n{font:inherit;background:none;border:0;border-radius:6px;padding:2px 6px;color:var(--tx-1);cursor:pointer;min-height:28px;min-width:36px}',
    '.im-n:hover{background:var(--bg-2)}.im-n--0{color:var(--tx-2)}',
    '.im-v{font-size:.78rem;color:var(--tx-2)}.im-table td.im-v{color:var(--tx-2)}',
    '.im-tot th,.im-tot td{font-weight:800;border-top:2px solid var(--bd-2);border-bottom:0}',
    '.im-where{margin-top:10px}.im-where:empty{display:none}',
    '.im-where p{display:inline;margin:0 10px 0 0;font-size:.86rem;color:var(--tx-1)}',
    '#ivRoot #imWhereText:focus{outline:2px solid var(--acc-1);outline-offset:2px}',
    '#ivRoot .im :is(input,summary,button):focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.im-set,.im-opts label,.im-pick summary,.im-pick label,.im-sort,.im-n{min-height:44px}.im-val{margin-left:0;width:100%}}'
  ].join('\n');

  // ------------------------------------------------------------------ datos y DOM
  var doc = root.document;
  var st = { sets: null, setsP: null, accounts: [], meta: {}, prices: {}, prefs: null, where: null, at: '', loading: false,
    hasKeys: false, started: false, seq: 0, cache: {}, timer: null, pickOpen: false };

  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }
  function get(k) { var S = storage(); try { return S ? S.get(k) : null; } catch (e) { return null; } }
  function put(k, v) { var S = storage(); if (S) S.set(k, v); }
  function prefs() { if (!st.prefs) st.prefs = readPrefs(get); return st.prefs; }

  function keys() {
    var S = storage(), name = S && S.STORAGE_KEYS ? S.STORAGE_KEYS.ACCOUNT_KEYS : 'gn:account:keys';
    return list(get(name)).filter(function (k) { return k && k.value; });
  }

  function loadSets() {
    if (st.sets) return Promise.resolve(st.sets);
    if (st.setsP) return st.setsP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.setsP = root.fetch(SETS_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('sets ' + r.status); return r.json(); })
      .then(function (j) { st.sets = list(j && j.sets); return st.sets; })
      .catch(function (e) { st.setsP = null; if (root.console) root.console.warn(LOG, 'sets', e); return null; });
    return st.setsP;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Lector mínimo para lo que GW2Api no trae: tiempo límite, un reintento ante 429 y caché en memoria.
  function readJSON(path, tk, nocache, retry) {
    var key = path + '|' + tk.slice(-8) + tk.length, c = st.cache[key];
    if (!nocache && c && Date.now() - c.t < TTL) return Promise.resolve(c.v);
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var url = API + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(tk);
    return root.fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (to) clearTimeout(to);
      if (r.status === 429 && !retry) return wait(1000).then(function () { return readJSON(path, tk, true, true); });
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json().then(function (v) {
        if (!Array.isArray(v)) throw new Error(path + ': forma no soportada');
        st.cache[key] = { t: Date.now(), v: v };
        return v;
      });
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }

  function settle(p) {
    return Promise.resolve().then(p).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  function pool(items, n, work) {
    var i = 0;
    function next() { if (i >= items.length) return Promise.resolve(); var it = items[i++]; return work(it).then(next, next); }
    var runners = [];
    for (var k = 0; k < Math.min(n, items.length); k++) runners.push(next());
    return Promise.all(runners);
  }

  function paint() {
    if (st.timer) return;
    st.timer = setTimeout(function () {
      st.timer = null;
      if (root.InvView && typeof root.InvView.renderTab === 'function') root.InvView.renderTab('multi');
      // Lector de pantalla: el detalle recién dibujado no se anuncia solo; el foco va a él y, al cerrar, vuelve al número.
      var f = st.focus && doc && doc.getElementById ? doc.getElementById(st.focus) : null;
      st.focus = null;
      if (f && typeof f.focus === 'function') f.focus();
    }, 120);
  }

  function clock() { var d = new Date(); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

  // Los ítems de los sets: íconos y nombres en español, y el precio de venta del Bazar.
  function loadItems() {
    var A = root.GW2Api, ids = [];
    list(st.sets).forEach(function (s) { allItems(s).forEach(function (it) { if (!st.meta[it.id]) ids.push(it.id); }); });
    if (!A || !ids.length) return Promise.resolve();
    return Promise.all([
      typeof A.getItemsMany === 'function' ? A.getItemsMany(ids, { nocache: false }).then(function (r) {
        list(r).forEach(function (it) { if (it && it.id) st.meta[it.id] = { name: it.name, icon: it.icon }; });
      }, function () {}) : null,
      typeof A.getCommercePrices === 'function' ? A.getCommercePrices(ids, { nocache: false }).then(function (r) {
        list(r).forEach(function (p) { if (p && p.id) st.prices[p.id] = p; });
      }, function () {}) : null
    ]).then(paint);
  }

  // Cada cuenta en dos tiempos: banco y materiales primero (con la caché de GW2Api), después las bolsas.
  function load(nocache) {
    var mySeq = ++st.seq, A = root.GW2Api, ks = keys();
    st.hasKeys = ks.length > 0;
    st.where = null;
    st.accounts = ks.map(function (k, i) {
      return { label: k.label || 'Cuenta ' + (i + 1), tag: k.tag || null, tk: String(k.value), loaded: false, bagsPending: true, bank: null, materials: null, shared: null, chars: null };
    });
    st.loading = st.hasKeys;
    paint();
    if (!A || !st.hasKeys) { st.loading = false; return Promise.resolve(); }
    var opt = { nocache: !!nocache };
    return pool(st.accounts, POOL, function (a) {
      return Promise.all([settle(function () { return A.getAccountBank(a.tk, opt); }), settle(function () { return A.getAccountMaterials(a.tk, opt); })])
        .then(function (r) {
          if (mySeq !== st.seq) return null;
          a.bank = r[0].ok && Array.isArray(r[0].v) ? r[0].v : null;
          a.materials = r[1].ok && Array.isArray(r[1].v) ? r[1].v : null;
          a.loaded = true;
          paint();
          return Promise.all([settle(function () { return readJSON('/v2/account/inventory', a.tk, nocache); }),
            settle(function () { return readJSON('/v2/characters?ids=all', a.tk, nocache); })]);
        })
        .then(function (r) {
          if (!r || mySeq !== st.seq) return;
          a.shared = r[0].ok ? r[0].v : null;
          a.chars = r[1].ok ? r[1].v.map(function (c) { return { name: c && c.name, bags: list(c && c.bags) }; }) : null;
          a.bagsPending = false;
          paint();
        });
    }).then(function () {
      if (mySeq !== st.seq) return;
      st.loading = false;
      st.at = clock();
      paint();
    });
  }

  function start(nocache) {
    st.started = true;
    return loadSets().then(function () { paint(); loadItems(); return load(nocache); });
  }

  function attr(t, name) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (n.getAttribute && n.getAttribute(name) != null) return n.getAttribute(name);
    }
    return null;
  }

  function saveHide(p) { put(KEY.hide, { hideZeroRows: p.hide.rows, hideZeroColumns: p.hide.cols, hideMainAccounts: p.hide.main }); }

  // Eventos de la pestaña (InvView los pasa primero acá). true = ya lo atendí.
  function onEvent(e) {
    var t = e && e.target, p = prefs(), v;
    if (!t) return false;
    if (e.type === 'click') {
      if ((v = attr(t, 'data-im-set')) != null) { p.set = v; p.items = []; put(KEY.set, v); put(KEY.items, []); st.where = null; paint(); return true; }
      if (attr(t, 'data-im-all') != null) { p.items = []; put(KEY.items, []); st.pickOpen = true; paint(); return true; }
      if ((v = attr(t, 'data-im-sort')) != null) {
        var id = Number(v);
        p.sort = p.sort && p.sort.column === id ? { column: id, direction: p.sort.direction === 'desc' ? 'asc' : 'desc' } : { column: id, direction: 'desc' };
        put(KEY.sort, p.sort); paint(); return true;
      }
      if ((v = attr(t, 'data-im-cell')) != null) { var x = v.split(':'); st.where = { i: Number(x[0]), id: Number(x[1]) }; st.focus = 'imWhereText'; paint(); return true; }
      if (attr(t, 'data-im-close') != null) { st.focus = st.where ? 'imC-' + st.where.i + '-' + st.where.id : null; st.where = null; paint(); return true; }
      if (attr(t, 'data-im-item') != null || attr(t, 'data-im-tier') != null || attr(t, 'data-im-hide') != null) return true;
      return false;
    }
    if (e.type === 'change') {
      var set = activeSet(st.sets, p);
      if ((v = attr(t, 'data-im-tier')) != null) {
        var tiers = tiersOf(set, p).slice(), at = tiers.indexOf(v);
        if (t.checked && at < 0) tiers.push(v);
        if (!t.checked && at >= 0) tiers.splice(at, 1);
        if (!tiers.length) tiers = [v];
        tiers.sort(function (a, b) { return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b); });
        p.tiers = tiers; put(KEY.tiers, tiers); paint(); return true;
      }
      if ((v = attr(t, 'data-im-item')) != null) {
        var cur = activeIds(st.sets, p), n = Number(v), i2 = cur.indexOf(n);
        if (t.checked && i2 < 0) cur.push(n);
        if (!t.checked && i2 >= 0) cur.splice(i2, 1);
        if (cur.length) { p.items = cur; put(KEY.items, cur); }
        st.pickOpen = true; paint(); return true;
      }
      if ((v = attr(t, 'data-im-hide')) != null) { p.hide[v] = !!t.checked; saveHide(p); paint(); return true; }
    }
    return false;
  }

  function snapshot() {
    return { sets: st.sets, accounts: st.accounts, meta: st.meta, prices: st.prices, prefs: prefs(), where: st.where, at: st.at,
      hasKeys: st.hasKeys, loading: st.loading, pickOpen: st.pickOpen };
  }

  function ensureCss() {
    if (!doc || !doc.createElement || !doc.head || (doc.getElementById && doc.getElementById('inv-multi-css'))) return;
    var s = doc.createElement('style');
    s.id = 'inv-multi-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  var TAB = {
    id: 'multi', label: 'Multicuenta', order: 1, isDefault: true,
    html: function () { ensureCss(); return html(snapshot()); },
    onEvent: onEvent,
    onShow: function () { if (!st.started) start(false); },
    refresh: function (nocache) { st.cache = nocache ? {} : st.cache; return start(nocache); }
  };

  function register() {
    if (root.InvView && typeof root.InvView.register === 'function') { root.InvView.register(TAB); return true; }
    return false;
  }
  if (!register() && doc && doc.addEventListener) {
    doc.addEventListener('DOMContentLoaded', register);
    doc.addEventListener('gn:boot-ready', register);
  }
  if (doc && doc.addEventListener) doc.addEventListener('gn:tokenchange', function () { st.started = false; });

  root.InvMulti = {
    version: VERSION, tab: TAB, refresh: TAB.refresh,
    // Solo las dos lecturas que GW2Api no trae; la Key queda en memoria, nunca se guarda.
    read: function (path, tk, nocache) { return readJSON(path, String(tk || ''), !!nocache); },
    getSnapshot: snapshot,
    _pure: { esc: esc, fmtInt: fmtInt, coins: coins, readPrefs: readPrefs, activeSet: activeSet, tiersOf: tiersOf, allItems: allItems,
      activeIds: activeIds, accIndex: accIndex, tableModel: tableModel, rowNote: rowNote, whereText: whereText, html: html, KEY: KEY, CSS: CSS }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
