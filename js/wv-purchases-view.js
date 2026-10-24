/*!
 * js/wv-purchases-view.js — Cámara del Brujo: cómo se ve «Compras fijadas» (BL-064, CAM-5)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Funciones puras (números y HTML) y estilos de Todas las cuentas → Compras fijadas.
 * Los datos, el almacén y las acciones viven en js/wv-purchase-detail.js, que pinta
 * con WVPurchasesView.viewHTML(estado). Se carga por js/modules.json (DEC-035).
 * Mismo idioma visual que Objetivos semanales (CAM-4) y mismas reglas de unidades que
 * la Tienda (CAM-3): la marca suma a lo que vio la API, con tope, y la AA disponible
 * descuenta lo marcado.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var UNDO_SECONDS = 10;
  var TAG_LABEL = { main: 'main', alter: 'alter', f2p: 'f2p' };
  var ACCOUNT_TYPE_ICONS = {
    main: 'assets/icons/Cuentas/547827.png',
    alter: 'assets/icons/Cuentas/157375.png',
    f2p: 'assets/icons/Cuentas/102538.png'
  };
  var DECORATIVE_ICONS = ['1770678', '1770679', '1770680', '1770681', '1770682', '1770683', '1770684', '1770685', '1770686'];
  var SORTS = [['need', 'a la que más le falta'], ['name', 'nombre'], ['keys', 'como en Cuentas'], ['aa', 'más AA']];
  var ACTIONS = [
    { id: 'sync', label: 'Ajustar marcas a la API', desc: 'En todas las cuentas · quita lo que el juego ya registró' },
    { id: 'copy', label: 'Copiar los fijados de la cuenta seleccionada', desc: 'A las demás cuentas · agrega, no borra · pide confirmación' },
    { id: 'clear', label: 'Quitar fijados de todas las cuentas…', desc: 'Pide confirmación · se puede deshacer durante ' + UNDO_SECONDS + ' s', danger: true }
  ];

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }

  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0, 4) + '…' + t.slice(-4)) : 'anon'; }

  // Unidades de un listado, con las mismas reglas que la Tienda (wv-shop-ui.js rowNumbers).
  function units(row, marks) {
    var limit = typeof row.purchase_limit === 'number' ? row.purchase_limit : null;
    var api = Math.max(0, Number(row.purchased) || 0);
    var max = limit == null ? 999 : Math.max(0, limit - api);
    var marked = Math.min(max, Math.max(0, Number((marks || {})[row.id]) || 0));
    var left = limit == null ? null : Math.max(0, limit - api - marked);
    return { limit: limit, api: api, marked: marked, max: max, left: left, apiFull: limit != null && api >= limit, done: left === 0 };
  }

  function findRow(rows, id) {
    for (var i = 0; i < (rows || []).length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }

  // Números de una cuenta. AA disponible = la de la API menos lo marcado (como la Tienda).
  function accountNumbers(acc) {
    var k = { aa: Number(acc.aa) || 0, marked: 0, reserved: 0, cells: 0, done: 0, leftUnits: 0 };
    var pinned = acc.pinned || {};
    (acc.rows || []).forEach(function (r) {
      var cost = Number(r.cost) || 0, n = units(r, acc.marks);
      k.marked += cost * n.marked;
      if (!pinned[r.id] || n.limit == null) return;
      k.cells++;
      if (n.done) k.done++;
      k.leftUnits += n.left;
      k.reserved += cost * n.left;
    });
    k.avail = k.aa - k.marked;
    k.diff = k.avail - k.reserved;
    return k;
  }

  function summarize(accounts) {
    var s = { avail: 0, reserved: 0, leftUnits: 0, cells: 0, done: 0, short: 0, shortAA: 0, readable: 0, marked: 0 };
    (accounts || []).forEach(function (a) {
      if (a.error) return;
      var k = accountNumbers(a);
      s.readable++;
      s.avail += k.avail; s.reserved += k.reserved; s.leftUnits += k.leftUnits; s.marked += k.marked;
      s.cells += k.cells; s.done += k.done;
      if (k.diff < 0) { s.short++; s.shortAA += -k.diff; }
    });
    return s;
  }

  // Ítems fijados en alguna cuenta, con nombre e ícono si se conocen. Orden por nombre:
  // así marcar una compra no mueve las columnas.
  function itemColumns(accounts, metaOf) {
    var seen = {}, out = [];
    (accounts || []).forEach(function (a) {
      var p = a.pinned || {};
      Object.keys(p).forEach(function (id) {
        if (!p[id] || seen[id]) return;
        var row = findRow(a.rows, id);
        if (!row) return;
        seen[id] = true;
        var meta = (row.item_id != null && metaOf) ? metaOf(row.item_id) : null;
        out.push({ id: String(id), itemId: row.item_id, cost: Number(row.cost) || 0, count: Number(row.item_count) || 1,
          name: (meta && meta.name) || (row.item_id != null ? 'Ítem #' + row.item_id : 'Compra #' + id), icon: (meta && meta.icon) || '' });
      });
    });
    out.sort(function (x, y) { return x.name.localeCompare(y.name, 'es') || (Number(x.id) - Number(y.id)); });
    return out;
  }

  function itemTotals(accounts, col) {
    var t = { left: 0, aa: 0, accounts: 0, pinnedIn: 0 };
    (accounts || []).forEach(function (a) {
      if (a.error || !(a.pinned || {})[col.id]) return;
      var row = findRow(a.rows, col.id);
      if (!row) return;
      var n = units(row, a.marks);
      if (n.limit == null) return;
      t.pinnedIn++;
      if (n.left) { t.left += n.left; t.aa += n.left * (Number(row.cost) || 0); t.accounts++; }
    });
    return t;
  }

  // Búsqueda, «Solo con pendientes» y orden de las filas.
  function arrangeRows(accounts, o) {
    o = o || {};
    var q = String(o.q || '').trim().toLowerCase();
    var rows = (accounts || []).map(function (a, i) { return { a: a, i: i, k: accountNumbers(a) }; });
    if (q) rows = rows.filter(function (r) { return String(r.a.name || '').toLowerCase().indexOf(q) >= 0; });
    if (o.pendingOnly) rows = rows.filter(function (r) { return r.a.error || r.k.leftUnits > 0; });
    rows.sort(function (x, y) {
      if (o.sort === 'name') return String(x.a.name).localeCompare(String(y.a.name), 'es');
      if (o.sort === 'aa') return (y.k.avail - x.k.avail) || (x.i - y.i);
      if (o.sort === 'need') {
        if (!!x.a.error !== !!y.a.error) return x.a.error ? 1 : -1;
        return (x.k.diff - y.k.diff) || (y.k.leftUnits - x.k.leftUnits) || (x.i - y.i);
      }
      return x.i - y.i;
    });
    return rows.map(function (r) { return r.a; });
  }

  // Ícono de la cuenta: por tipo, o uno decorativo fijo según la key (como Objetivos semanales).
  function accountIcon(tag, token) {
    if (ACCOUNT_TYPE_ICONS[tag]) return ACCOUNT_TYPE_ICONS[tag];
    var t = String(token || 'anon'), h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return 'assets/icons/Cuentas/' + DECORATIVE_ICONS[h % DECORATIVE_ICONS.length] + '.png';
  }

  // ------------------------------------------------------------------ HTML
  function aa(n, sign) { return (sign && n > 0 ? '+' : '') + fmtInt(n) + '<span class="wvp-aa">AA</span>'; }

  function statsHTML(s, total) {
    var pct = s.cells ? Math.round(s.done * 100 / s.cells) : 0;
    return '<div class="wvp-stats">' +
      '<div class="wvp-st"><small>AA disponible</small><b>' + aa(s.avail) + '</b><em>' +
        (s.marked ? 'ya descontada la que marcaste' : 'en ' + plural(s.readable, 'cuenta', 'cuentas')) + '</em></div>' +
      '<div class="wvp-st"><small>Reservada para fijados</small><b>' + aa(s.reserved) + '</b><em>' +
        (s.leftUnits ? plural(s.leftUnits, 'compra pendiente', 'compras pendientes') : 'nada pendiente') + '</em></div>' +
      '<div class="wvp-st"><small>Cuentas que no llegan</small><b' + (s.short ? ' class="wvp-bad"' : '') + '>' + s.short + ' <span>de ' + total + '</span></b><em>' +
        (s.short ? 'les faltan ' + aa(s.shortAA) : 'todas llegan con su AA') + '</em></div>' +
      '<div class="wvp-st"><small>Fijados completos</small><b>' + s.done + ' <span>de ' + s.cells + '</span></b>' +
        '<div class="wvp-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div>' +
      '</div>';
  }

  function menuHTML() {
    return '<div class="wvp-menu" role="menu" aria-label="Gestionar compras de todas las cuentas">' + ACTIONS.map(function (a) {
      return (a.danger ? '<hr>' : '') + '<button type="button" role="menuitem" data-wvp-act="' + a.id + '"' + (a.danger ? ' class="wvp-danger"' : '') + '>' +
        esc(a.label) + '<small>' + esc(a.desc) + '</small></button>';
    }).join('') + '</div>';
  }

  function toolHTML(o) {
    return '<div class="wvp-tool">' +
      '<input type="search" class="wvp-q" data-wvp-q placeholder="Buscar cuenta…" aria-label="Buscar cuenta" value="' + esc(o.q || '') + '">' +
      '<button type="button" class="wvp-chip" data-wvp-pending aria-pressed="' + !!o.pendingOnly + '">Solo con pendientes</button>' +
      '<label class="wvp-sel">Orden: <select data-wvp-sort aria-label="Ordenar cuentas">' + SORTS.map(function (s) {
        return '<option value="' + s[0] + '"' + (o.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
      }).join('') + '</select></label>' +
      '<span class="wvp-mwrap"><button type="button" class="wvp-chip" data-wvp-menu aria-haspopup="menu" aria-expanded="' + !!o.menuOpen + '">Gestionar ▾</button>' +
        (o.menuOpen ? menuHTML() : '') + '</span>' +
      '<button type="button" class="wvp-chip" data-wvp-online-all title="Actualizar el estado online de todas las cuentas"><i class="wvp-dot wvp-dot--on" aria-hidden="true"></i>Quién está online</button>' +
      (o.syncedAt ? '<small class="wvp-sync">Datos de la API de las ' + esc(o.syncedAt) + '</small>' : '') +
      '</div>';
  }

  var LEGEND = '<div class="wvp-lgd" aria-hidden="true"><span><i class="wvp-sw wvp-sw--a"></i>Comprado según la API</span>' +
    '<span><i class="wvp-sw wvp-sw--m"></i>Marcado por vos</span><span>− / + marca compras que la API todavía no vio</span></div>';

  function onlineHTML(acc) {
    if (acc.isOnline === true) return '<i class="wvp-dot wvp-dot--on" aria-hidden="true"></i>Activa' + (acc.lastPlayedChar ? '<small>' + esc(acc.lastPlayedChar) + '</small>' : '');
    if (acc.isOnline === false) return '<i class="wvp-dot" aria-hidden="true"></i><span class="wvp-mut">Sin actividad reciente</span>';
    return '<span class="wvp-mut">—</span>';
  }

  function cellHTML(acc, col) {
    var pinned = !!(acc.pinned || {})[col.id], row = pinned ? findRow(acc.rows, col.id) : null;
    if (!pinned || !row) {
      var why = pinned ? 'No está en la tienda de esta cuenta' : 'No fijado en esta cuenta';
      return '<td class="wvp-c wvp-c--off"><span aria-hidden="true">—</span><span class="wvp-sr">' + why + '</span></td>';
    }
    var n = units(row, acc.marks);
    if (n.limit == null) return '<td class="wvp-c">' + n.api + ' / ∞<span class="wvp-sr">sin límite</span></td>';
    var lbl = 'Comprado ' + n.api + (n.marked ? ', marcado ' + n.marked : '') + ' de ' + n.limit;
    var pa = Math.round(n.api * 100 / n.limit), pm = Math.round(n.marked * 100 / n.limit);
    var h = '<td class="wvp-c' + (n.done ? ' wvp-c--done' : '') + '"><span class="wvp-cnt">' + n.api + (n.marked ? '<em>+' + n.marked + '</em>' : '') + ' / ' + n.limit +
      (n.done ? ' <b class="wvp-ok">Completo</b>' : '') + '</span>' +
      '<span class="wvp-u" role="img" aria-label="' + lbl + '"><i class="a" style="width:' + pa + '%"></i><i class="m" style="width:' + pm + '%"></i></span>';
    if (!n.apiFull) {
      var who = esc(col.name) + ' en ' + esc(acc.name), ids = ' data-fp="' + esc(acc.fp) + '" data-id="' + esc(col.id) + '"';
      h += '<span class="wvp-step" role="group" aria-label="Compras marcadas por vos: ' + who + '">' +
        '<button type="button" data-wvp-step="-1"' + ids + ' aria-label="Una menos"' + (n.marked <= 0 ? ' disabled' : '') + '>−</button>' +
        '<output aria-live="polite">' + n.marked + '</output>' +
        '<button type="button" data-wvp-step="1"' + ids + ' aria-label="Una más"' + (n.marked >= n.max ? ' disabled' : '') + '>+</button></span>';
    }
    return h + '</td>';
  }

  function matrixHTML(rows, cols, all, selFp) {
    if (!cols.length) {
      return '<div class="wvp-empty"><p>Todavía no fijaste compras en ninguna cuenta: fijalas con ★ en la Tienda.</p>' +
        '<button type="button" class="wvp-chip" data-wvp-shop>Ir a la Tienda</button></div>';
    }
    if (!rows.length) return '<p class="wvp-empty">Ninguna cuenta coincide: todas tienen sus fijados completos o la búsqueda no encontró nada.</p>';
    var h = ['<div class="wvp-wrap"><table class="wvp-t"><caption class="wvp-sr">Compras fijadas de todas las cuentas</caption><thead><tr>' +
      '<th scope="col" class="wvp-acc">Cuenta</th><th scope="col" class="wvp-n">AA disponible</th><th scope="col" class="wvp-n">Reservada</th><th scope="col" class="wvp-n">Balance</th>'];
    cols.forEach(function (c) {
      h.push('<th scope="col" class="wvp-it" title="' + esc(c.name) + '">' + (c.icon ? '<img src="' + esc(c.icon) + '" alt="" width="28" height="28" loading="lazy">' : '') +
        '<span class="wvp-in">' + esc(c.name) + (c.count > 1 ? ' ×' + c.count : '') + '</span><span class="wvp-ic">' + aa(c.cost) + ' c/u</span></th>');
    });
    h.push('<th scope="col">Online</th></tr></thead><tbody>');
    rows.forEach(function (a) {
      var k = accountNumbers(a);
      h.push('<tr' + (a.error ? ' class="wvp-err"' : '') + '><th scope="row" class="wvp-acc"><span class="wvp-an">' +
        '<img src="' + esc(accountIcon(a.tag, a.token)) + '" alt="" width="24" height="24" loading="lazy"><span>' + esc(a.name) +
        (TAG_LABEL[a.tag] ? '<small>' + TAG_LABEL[a.tag] + '</small>' : '') + (a.fp === selFp ? '<small class="wvp-sel-acc">seleccionada</small>' : '') + '</span></span>' +
        (a.error ? '<em class="wvp-warn">No se pudo leer</em>' : '') + '</th>');
      if (a.error) {
        h.push('<td class="wvp-n">—</td><td class="wvp-n">—</td><td class="wvp-n">—</td>');
        cols.forEach(function () { h.push('<td class="wvp-c wvp-c--off"><span aria-hidden="true">—</span><span class="wvp-sr">Sin datos</span></td>'); });
      } else {
        h.push('<td class="wvp-n">' + aa(k.avail) + '</td><td class="wvp-n">' + (k.reserved ? aa(k.reserved) : '—') + '</td>' +
          '<td class="wvp-n ' + (k.diff < 0 ? 'wvp-bad' : 'wvp-good') + '">' + aa(k.diff, true) + '<span class="wvp-sr">' + (k.diff < 0 ? ' le falta' : ' le sobra') + '</span></td>');
        cols.forEach(function (c) { h.push(cellHTML(a, c)); });
      }
      h.push('<td class="wvp-on" data-wvp-online="' + esc(a.fp) + '">' + onlineHTML(a) + '</td></tr>');
    });
    var s = summarize(all);
    h.push('</tbody><tfoot><tr><th scope="row" class="wvp-acc">Faltan</th><td class="wvp-n">' + aa(s.avail) + '</td><td class="wvp-n">' + aa(s.reserved) + '</td><td class="wvp-n"></td>');
    cols.forEach(function (c) {
      var t = itemTotals(all, c);
      h.push('<td class="wvp-c">' + (t.left ? '<b>' + plural(t.left, 'compra', 'compras') + '</b><small>' + aa(t.aa) + ' · ' + plural(t.accounts, 'cuenta', 'cuentas') + '</small>'
        : '<b class="wvp-ok">Completo</b>') + '</td>');
    });
    h.push('<td></td></tr></tfoot></table></div>');
    return h.join('');
  }

  function undoHTML(u, now) {
    if (!u || u.until <= now) return '';
    return '<div class="wvp-undo" role="status"><span>' + esc(u.msg) + '</span><button type="button" class="wvp-chip" data-wvp-undo>Deshacer</button>' +
      '<small data-wvp-left>' + Math.ceil((u.until - now) / 1000) + ' s</small></div>';
  }

  function viewHTML(st, now) {
    if (st.loading && !st.accounts.length) {
      return '<div class="wvp"><p class="wvp-empty" role="status">Leyendo las compras fijadas de tus cuentas…</p><div class="skeleton skeleton--block wvp-sk"></div>' +
        '<p id="wvpdStatusMsg" class="wvp-status" role="status"></p></div>';
    }
    if (st.error && !st.accounts.length) {
      return '<div class="wvp"><p class="wvp-empty" role="alert">' + esc(st.error) + '</p><button type="button" class="wvp-chip" data-wvp-retry>Reintentar</button></div>';
    }
    var s = summarize(st.accounts), selFp = st.selFp || '';
    var cols = itemColumns(st.accounts, st.metaOf);
    if (st.view.pendingOnly) cols = cols.filter(function (c) { return itemTotals(st.accounts, c).left > 0; });
    var failed = st.accounts.length - s.readable;
    return '<div class="wvp">' + statsHTML(s, st.accounts.length) +
      toolHTML({ q: st.view.q, pendingOnly: st.view.pendingOnly, sort: st.view.sort, menuOpen: st.menuOpen, syncedAt: st.syncedAt }) +
      '<div data-wvp-undo-host>' + undoHTML(st.undo, now || Date.now()) + '</div>' +
      '<p id="wvpdStatusMsg" class="wvp-status' + (st.statusKind === 'error' ? ' wvp-status--err' : '') + '" role="status">' + esc(st.status || '') + '</p>' +
      (failed ? '<p class="wvp-note" role="status">' + (failed === 1 ? '1 cuenta no se pudo leer' : failed + ' cuentas no se pudieron leer') +
        ': tocá «↻ Actualizar» arriba para reintentar.</p>' : '') +
      LEGEND + matrixHTML(arrangeRows(st.accounts, st.view), cols, st.accounts, selFp) + '</div>';
  }

  var CSS = [
    '.wvp{padding:0 0 12px}',
    '.wvp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.wvp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}',
    '.wvp-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 12px;min-width:0}',
    '.wvp-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.wvp-st b{font-size:1.25rem;color:var(--tx-1)}.wvp-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.wvp-st em{display:block;font-style:normal;font-size:.76rem;color:var(--tx-2);margin-top:2px}',
    '.wvp-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:7px}.wvp-bar i{display:block;height:100%;background:var(--color-green,#3CC48A)}',
    '.wvp-aa{font-size:.62rem;font-weight:800;margin-left:2px;color:#4FC3D9}',
    '.wvp-bad,.wvp-st b.wvp-bad{color:var(--color-red,#F47C7C)!important}.wvp-good{color:var(--color-green,#3CC48A)}.wvp-ok{color:var(--color-green,#3CC48A);font-weight:700}',
    '.wvp-mut{color:var(--tx-2)}',
    '.wvp-tool{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}',
    '.wvp-q{font:inherit;font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:6px 12px;background:transparent;color:var(--tx-1);min-height:34px;min-width:150px}',
    '.wvp-chip{font:inherit;font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:6px 12px;background:transparent;color:var(--tx-2);cursor:pointer;min-height:34px;display:inline-flex;align-items:center;gap:6px}',
    '.wvp-chip[aria-pressed=true],.wvp-chip[aria-expanded=true]{border-color:var(--acc-1);color:var(--tx-1);background:var(--bg-2);font-weight:600}',
    '.wvp-sel{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:var(--tx-2);border:1px solid var(--bd-1);border-radius:999px;padding:2px 4px 2px 12px}',
    '.wvp-sel select{font:inherit;background:transparent;color:var(--tx-1);border:0;padding:5px}',
    '.wvp-sync{margin-left:auto;color:var(--tx-2);font-size:.76rem}',
    '.wvp-mwrap{position:relative}',
    '.wvp-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;min-width:280px;background:var(--bg-1);border:1px solid var(--bd-2);border-radius:12px;padding:6px;box-shadow:var(--elev-2)}',
    '.wvp-menu button{display:block;width:100%;text-align:left;font:inherit;font-size:.84rem;color:var(--tx-1);background:transparent;border:0;border-radius:8px;padding:8px 10px;cursor:pointer}',
    '.wvp-menu button:hover{background:var(--bg-2)}.wvp-menu small{display:block;color:var(--tx-2);font-size:.72rem}',
    '.wvp-menu hr{border:0;border-top:1px solid var(--bd-1);margin:4px 0}.wvp-menu .wvp-danger{color:var(--color-red,#F47C7C)}',
    '.wvp-undo{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--bd-2);border-radius:12px;background:var(--bg-2);padding:6px 10px;margin:0 0 8px;font-size:.84rem}',
    '.wvp-undo small{color:var(--tx-2)}',
    '.wvp-status{margin:0 0 6px;font-size:.78rem;color:var(--tx-2);min-height:1em}.wvp-status--err{color:var(--color-red,#F47C7C)}',
    '.wvp-note{margin:0 0 8px;font-size:.84rem;color:var(--color-amber,#F2B94B)}',
    '.wvp-empty{color:var(--tx-2);font-size:.9rem;margin:14px 0}.wvp-sk{height:220px;border-radius:12px}',
    '.wvp-lgd{display:flex;flex-wrap:wrap;gap:14px;font-size:.76rem;color:var(--tx-2);margin:0 0 8px}.wvp-lgd>span{display:inline-flex;align-items:center;gap:6px}',
    '.wvp-sw{display:inline-block;width:14px;height:6px;border-radius:3px}.wvp-sw--a{background:var(--color-green,#3CC48A)}.wvp-sw--m{background:#9B7BFF}',
    '.wvp-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--bd-2);box-sizing:border-box;margin-right:6px;vertical-align:middle}',
    '.wvp-dot--on{background:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A)}',
    '.wvp-wrap{overflow-x:auto;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    '.wvp-t{border-collapse:separate;border-spacing:0;width:100%;font-size:.84rem}',
    '.wvp-t th,.wvp-t td{border-bottom:1px solid var(--bd-1);padding:8px 10px;color:var(--tx-1);vertical-align:middle}',
    '.wvp-t thead th{vertical-align:bottom;font-weight:500;font-size:.72rem;color:var(--tx-2)}',
    '.wvp-it{text-align:center;min-width:112px;max-width:150px}.wvp-it img{display:block;margin:0 auto 4px;border-radius:6px}',
    '.wvp-in{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.76rem;line-height:1.25;color:var(--tx-1)}',
    '.wvp-ic{display:block;font-size:.7rem;margin-top:2px}',
    '.wvp-acc{position:sticky;left:0;z-index:1;background:var(--bg-1);text-align:left;min-width:170px;font-weight:500}',
    '.wvp-t thead .wvp-acc{z-index:2;text-transform:uppercase;letter-spacing:.06em}',
    '.wvp-an{display:flex;align-items:center;gap:10px}.wvp-an img{border-radius:6px;flex-shrink:0}.wvp-an span{min-width:0}',
    '.wvp-an small{display:block;font-size:.7rem;color:var(--tx-2)}.wvp-an .wvp-sel-acc{color:var(--acc-1)}',
    '.wvp-warn{display:block;font-style:normal;font-size:.72rem;color:var(--color-amber,#F2B94B);margin-top:2px}',
    '.wvp-n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.wvp-c{text-align:center;white-space:nowrap}.wvp-c--off{color:var(--tx-2)}.wvp-c small{display:block;font-size:.72rem;color:var(--tx-2)}',
    '.wvp-cnt{display:block;font-variant-numeric:tabular-nums}.wvp-cnt em{font-style:normal;color:#9B7BFF;font-weight:700}',
    '.wvp-u{display:flex;width:72px;height:5px;margin:4px auto;border-radius:3px;background:var(--bg-2);overflow:hidden}.wvp-u .a{background:var(--color-green,#3CC48A)}.wvp-u .m{background:#9B7BFF}',
    '.wvp-step{display:inline-flex;align-items:center;border:1px solid var(--bd-1);border-radius:999px;overflow:hidden}',
    '.wvp-step button{font:inherit;width:30px;height:28px;background:transparent;border:0;color:var(--tx-1);cursor:pointer}',
    '.wvp-step button:disabled{opacity:.35;cursor:default}.wvp-step output{min-width:20px;text-align:center;font-size:.8rem}',
    '.wvp-on{white-space:nowrap;font-size:.8rem}.wvp-on small{display:block;font-size:.72rem;color:var(--tx-2)}',
    '.wvp-t tbody tr:hover>*{background:var(--bg-2)}',
    '.wvp-t tfoot th,.wvp-t tfoot td{border-bottom:0;font-size:.8rem;color:var(--tx-2)}',
    '.wvp button:focus-visible,.wvp select:focus-visible,.wvp input:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.wvp-stats{grid-template-columns:1fr 1fr;gap:6px}.wvp-st{padding:8px 10px}.wvp-st b{font-size:1.05rem}',
    '.wvp-chip,.wvp-q{min-height:40px}.wvp-q{flex:1 1 100%}.wvp-sync{margin-left:0;flex-basis:100%}.wvp-acc{min-width:128px}',
    '.wvp-step button{width:36px;height:36px}.wvp-menu{min-width:240px}}'
  ].join('\n');

  root.WVPurchasesView = {
    version: VERSION, UNDO_SECONDS: UNDO_SECONDS, ACTIONS: ACTIONS, SORTS: SORTS,
    esc: esc, fmtInt: fmtInt, plural: plural, fpToken: fpToken, units: units, findRow: findRow,
    accountNumbers: accountNumbers, summarize: summarize, itemColumns: itemColumns, itemTotals: itemTotals,
    arrangeRows: arrangeRows, accountIcon: accountIcon, statsHTML: statsHTML, toolHTML: toolHTML, onlineHTML: onlineHTML,
    cellHTML: cellHTML, matrixHTML: matrixHTML, undoHTML: undoHTML, viewHTML: viewHTML, CSS: CSS
  };
})(typeof window !== 'undefined' ? window : this);
