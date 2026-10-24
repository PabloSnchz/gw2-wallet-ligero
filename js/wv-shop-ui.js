/*!
 * js/wv-shop-ui.js — Cámara del Brujo: Tienda (BL-064, CAM-3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 2.0.0 (2026-10-24)
 *
 * Pinta la Tienda de la Cámara del Brujo con el estado que guarda router.js
 * (window.WV.__getShopState). API de siempre: render, refresh, setShopLoading,
 * ensureShopToolbar y syncShopToggleLabel.
 *
 * 2.0.0 (CAM-3):
 *  - Línea de AA para planificar: disponible, marcada sin registrar, reservada
 *    para lo fijado y lo que sobra o falta.
 *  - Tarjetas (y lista) con progreso por unidades: verde = la API ya lo vio,
 *    violeta = marcado por vos. Selector −/+ y «Máx» en lugar del campo numérico.
 *  - Segmentos «Fijados primero», «Todos» y «Me falta».
 *  - Las acciones masivas viven en el menú «Gestionar» (js/wv-shop-manage.js,
 *    por manifiesto), con confirmación y «Deshacer».
 *  - Clases nuevas (wvs-*): wv-theme.js y enhanceShopCards (wv-purchase-detail.js)
 *    ya no escriben sobre estas tarjetas. Una sola fuente de marcas.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var LOG = '[WV-ShopUI]';
  var doc = root.document;
  var el = function (id) { return doc.getElementById(id); };

  var RARITY_COLORS = {
    junk: '#AAAAAA', basic: '#FFFFFF', fine: '#62A4DA', masterwork: '#1A9306',
    rare: '#FCD00B', exotic: '#FFA405', ascended: '#FB3E8D', legendary: '#974EFF'
  };
  var TYPE_LABEL = { featured: 'Destacado', normal: 'Normal', legacy: 'Legado' };
  var SEGS = [['pinned', 'Fijados primero'], ['all', 'Todos'], ['need', 'Me falta']];
  var UNIT_SEGMENTS_MAX = 12;

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

  function rarityColor(r) { return r ? (RARITY_COLORS[String(r).toLowerCase()] || null) : null; }
  function typeLabel(t) { return TYPE_LABEL[String(t || '').toLowerCase()] || (t ? String(t) : '—'); }

  // Unidades de un listado: lo que vio la API, lo marcado y lo que queda.
  function rowNumbers(row, marks) {
    var limit = typeof row.purchase_limit === 'number' ? row.purchase_limit : null;
    var api = Math.max(0, Number(row.purchased) || 0);
    var max = limit == null ? 999 : Math.max(0, limit - api);
    var marked = Math.min(max, Math.max(0, Number((marks || {})[row.id]) || 0));
    var left = limit == null ? null : Math.max(0, limit - api - marked);
    return { limit: limit, api: api, marked: marked, max: max, left: left, apiFull: limit != null && api >= limit, done: left === 0 };
  }

  // Números de la línea de AA. Misma cuenta de «reservada» que la cabecera (wv-view.js).
  function aaSummary(rows, aa, pinned, marks) {
    var marked = 0, reserved = 0, spentApi = 0;
    (rows || []).forEach(function (r) {
      var cost = Number(r.cost) || 0, n = rowNumbers(r, marks);
      spentApi += cost * n.api;
      marked += cost * n.marked;
      if (pinned && pinned[r.id] && n.left) reserved += cost * n.left;
    });
    var avail = (Number(aa) || 0) - marked;
    return { aa: Number(aa) || 0, marked: marked, avail: avail, reserved: reserved, diff: avail - reserved, spent: spentApi + marked };
  }

  function itemName(row, it) {
    return it && it.name ? it.name : (row.item_id != null ? 'Ítem #' + row.item_id : (row.type || '—'));
  }

  // Búsqueda, Legado, segmento y orden.
  function filterRows(list, o) {
    var itemsById = o.itemsById || new Map(), pinned = o.pinned || {}, q = String(o.q || '').toLowerCase();
    var out = (list || []).filter(function (x) {
      if (o.legacy === 'hide' && String(x.type || '').toLowerCase() === 'legacy') return false;
      if (o.seg === 'need') { var n = rowNumbers(x, o.marks); if (n.limit == null || !n.left) return false; }
      if (!q) return true;
      var it = x.item_id != null ? itemsById.get(x.item_id) : null;
      return itemName(x, it).toLowerCase().indexOf(q) >= 0 || String(x.id).indexOf(q) >= 0;
    });
    var name = function (x) { return itemName(x, x.item_id != null ? itemsById.get(x.item_id) : null); };
    out.sort(function (a, b) {
      if (o.sort === 'cost') return (a.cost || 0) - (b.cost || 0);
      if (o.sort === 'costDesc') return (b.cost || 0) - (a.cost || 0);
      if (o.sort === 'id') return (a.id || 0) - (b.id || 0);
      return name(a).localeCompare(name(b), 'es');
    });
    if (o.seg !== 'all') {
      out.sort(function (a, b) { return (pinned[b.id] ? 1 : 0) - (pinned[a.id] ? 1 : 0); });
    }
    return out;
  }

  // Progreso por unidades: un segmento por unidad (hasta 12) o una barra doble.
  function unitsHTML(n) {
    if (n.limit == null) return '<span class="wvs-unl">Sin límite</span>';
    var lbl = 'Comprado ' + n.api + (n.marked ? ', marcado ' + n.marked : '') + ' de ' + n.limit;
    if (n.limit <= UNIT_SEGMENTS_MAX) {
      var h = '';
      for (var i = 0; i < n.limit; i++) h += '<i' + (i < n.api ? ' class="a"' : (i < n.api + n.marked ? ' class="m"' : '')) + '></i>';
      return '<span class="wvs-units" role="img" aria-label="' + lbl + '">' + h + '</span>';
    }
    var pa = Math.round(n.api * 100 / n.limit), pm = Math.round(n.marked * 100 / n.limit);
    return '<span class="wvs-units wvs-units--bar" role="img" aria-label="' + lbl + '"><i class="a" style="width:' + pa + '%"></i><i class="m" style="width:' + pm + '%"></i></span>';
  }

  function countText(n) {
    if (n.limit == null) return n.api + (n.marked ? ' + ' + n.marked : '');
    return n.api + (n.marked ? ' + ' + n.marked : '') + ' / ' + n.limit;
  }

  function stepHTML(row, n, name) {
    var id = esc(row.id);
    return '<span class="wvs-step" role="group" aria-label="Compras marcadas por vos: ' + esc(name) + '">' +
      '<button type="button" data-wvs-step="-1" data-id="' + id + '" aria-label="Una menos"' + (n.marked <= 0 ? ' disabled' : '') + '>−</button>' +
      '<output aria-live="polite">' + n.marked + '</output>' +
      '<button type="button" data-wvs-step="1" data-id="' + id + '" aria-label="Una más"' + (n.marked >= n.max ? ' disabled' : '') + '>+</button></span>' +
      (n.limit != null && n.max > 1 ? '<button type="button" class="wvs-max" data-wvs-max="' + id + '"' + (n.marked >= n.max ? ' disabled' : '') + '>Máx</button>' : '');
  }

  function pinHTML(row, on, name, compact) {
    return '<button type="button" class="wvs-pin' + (on ? ' wvs-pin--on' : '') + '" data-wvs-pin="' + esc(row.id) + '" aria-pressed="' + on +
      '" aria-label="' + (on ? 'Desfijar ' : 'Fijar ') + esc(name) + '">' + (on ? '★' : '☆') + (compact ? '' : (on ? ' Fijado' : ' Fijar')) + '</button>';
  }

  function cardHTML(row, it, ctx) {
    var n = rowNumbers(row, ctx.marks), name = itemName(row, it), color = rarityColor(it && it.rarity);
    var on = !!(ctx.pinned && ctx.pinned[row.id]);
    var qty = row.item_count > 1 ? ' ×' + row.item_count : '';
    var foot = n.apiFull
      ? '<span class="wvs-st wvs-st--ok">Completo ' + n.api + ' / ' + n.limit + '</span>'
      : '<span class="wvs-cnt">' + countText(n) + '</span>' + stepHTML(row, n, name);
    return '<article class="wvs-it' + (on ? ' wvs-it--pinned' : '') + (n.apiFull ? ' wvs-it--full' : '') + '" data-id="' + esc(row.id) + '">' +
      (it && it.icon ? '<img class="wvs-ic" src="' + esc(it.icon) + '" alt="" loading="lazy" width="44" height="44"' + (color ? ' style="box-shadow:0 0 0 2px ' + color + '55"' : '') + '>' : '<span class="wvs-ic"></span>') +
      '<span class="wvs-n"' + (color ? ' style="color:' + color + '"' : '') + ' title="' + esc(name + qty) + '">' + esc(name) + qty + '</span>' +
      pinHTML(row, on, name) +
      '<span class="wvs-s">' + fmtInt(row.cost) + ' AA · ' + typeLabel(row.type) + '</span>' +
      '<div class="wvs-f">' + unitsHTML(n) + foot + '</div></article>';
  }

  function cardsHTML(rows, ctx) {
    if (!rows.length) return emptyHTML(ctx);
    return '<div class="wvs-grid">' + rows.map(function (r) { return cardHTML(r, r.item_id != null ? ctx.itemsById.get(r.item_id) : null, ctx); }).join('') + '</div>';
  }

  function tableHTML(rows, ctx) {
    if (!rows.length) return emptyHTML(ctx);
    var trs = rows.map(function (r) {
      var it = r.item_id != null ? ctx.itemsById.get(r.item_id) : null;
      var n = rowNumbers(r, ctx.marks), name = itemName(r, it), color = rarityColor(it && it.rarity);
      var on = !!(ctx.pinned && ctx.pinned[r.id]);
      return '<tr data-id="' + esc(r.id) + '"' + (on ? ' class="wvs-tr--pinned"' : '') + '>' +
        '<td class="wvs-tn">' + (it && it.icon ? '<img src="' + esc(it.icon) + '" alt="" loading="lazy" width="28" height="28">' : '') +
        '<span' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(name) + (r.item_count > 1 ? ' ×' + r.item_count : '') + '</span></td>' +
        '<td>' + typeLabel(r.type) + '</td><td class="r">' + fmtInt(r.cost) + '</td>' +
        '<td class="r">' + countText(n) + '</td><td class="r">' + (n.left == null ? '∞' : n.left) + '</td>' +
        '<td>' + (n.apiFull ? '<span class="wvs-st wvs-st--ok">Completo</span>' : stepHTML(r, n, name)) + '</td>' +
        '<td>' + pinHTML(r, on, name, true) + '</td></tr>';
    }).join('');
    return '<div class="wvs-tw"><table class="wvs-tbl"><thead><tr><th scope="col">Ítem</th><th scope="col">Tipo</th><th scope="col" class="r">AA</th>' +
      '<th scope="col" class="r">Comprado</th><th scope="col" class="r">Quedan</th><th scope="col">Marcadas</th><th scope="col">Fijar</th></tr></thead><tbody>' +
      trs + '</tbody></table></div>';
  }

  function emptyHTML(ctx) {
    if (ctx.seg === 'need') return '<p class="wvs-empty">No te falta nada: lo que tiene límite ya está comprado o marcado.</p>';
    return '<p class="wvs-empty">' + (ctx.q ? 'Nada coincide con «' + esc(ctx.q) + '».' : 'La Tienda está vacía.') + '</p>';
  }

  function aaLineHTML(s, iconUrl, syncedAt) {
    var tot = Math.max(1, s.avail, s.reserved);
    var rs = Math.round(Math.min(s.reserved, Math.max(0, s.avail)) * 100 / tot);
    var free = Math.round(Math.max(0, s.diff) * 100 / tot);
    var h = '<div class="wvs-aal">' +
      '<span>' + (iconUrl ? '<img src="' + esc(iconUrl) + '" alt="" width="18" height="18">' : '') + 'AA disponible <b>' + fmtInt(s.avail) + '</b></span>' +
      (s.marked ? '<span>Marcada sin registrar <b>' + fmtInt(-s.marked) + '</b></span>' : '') +
      '<span>Reservada para fijados <b>' + fmtInt(s.reserved) + '</b></span>' +
      (s.diff >= 0 ? '<span>Sobran <b class="wvs-ok">' + fmtInt(s.diff) + '</b></span>' : '<span>Faltan <b class="wvs-need">' + fmtInt(-s.diff) + '</b></span>') +
      '<span class="wvs-aabar" aria-hidden="true"><i class="rs" style="width:' + rs + '%"></i><i class="fr" style="width:' + free + '%"></i></span>' +
      '<small>Gastada esta temporada: ' + fmtInt(s.spent) + (syncedAt ? ' · datos de la API de las ' + syncedAt : '') + '</small></div>';
    return h;
  }

  function hhmm(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  var CSS = [
    '#wvTabShop{padding:0 0 12px}',
    '.wvs-aal{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 14px;margin:0 0 10px;font-size:.86rem;color:var(--tx-2)}',
    '.wvs-aal b{color:var(--tx-1)}.wvs-aal img{vertical-align:-4px;margin-right:6px}.wvs-ok{color:var(--color-green,#3CC48A)!important}.wvs-need{color:var(--color-red,#F47C7C)!important}',
    '.wvs-aabar{flex:1 1 160px;display:flex;height:7px;border-radius:6px;background:var(--bg-2);overflow:hidden}.wvs-aabar i{display:block;height:100%}.wvs-aabar .rs{background:var(--acc-1)}.wvs-aabar .fr{background:var(--color-green,#3CC48A)}',
    '.wvs-aal small{flex-basis:100%;font-size:.76rem}',
    '.wvs-tool{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}',
    '.wvs-q{flex:1 1 220px;min-width:0;font:inherit;font-size:.88rem;border:1px solid var(--bd-2);border-radius:10px;background:var(--bg-1);color:var(--tx-1);padding:8px 12px;min-height:38px}',
    '.wvs-seg{display:inline-flex;border:1px solid var(--bd-2);border-radius:10px;overflow:hidden}',
    '.wvs-seg button{font:inherit;font-size:.82rem;background:none;border:0;border-right:1px solid var(--bd-1);padding:7px 12px;color:var(--tx-2);cursor:pointer;min-height:36px;white-space:nowrap}',
    '.wvs-seg button:last-child{border-right:0}.wvs-seg button[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);font-weight:600}',
    '.wvs-sel{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:var(--tx-2);border:1px solid var(--bd-1);border-radius:999px;padding:2px 4px 2px 10px}',
    '.wvs-sel select{font:inherit;background:transparent;color:var(--tx-1);border:0;padding:4px}',
    '.wvs-btn{font:inherit;font-size:.8rem;border:1px solid var(--bd-2);border-radius:999px;padding:6px 12px;background:transparent;color:var(--tx-1);cursor:pointer;min-height:36px;white-space:nowrap}',
    '.wvs-btn:hover{border-color:var(--acc-1)}.wvs-menu{position:relative;margin-left:auto}',
    '.wvs-dd{position:absolute;right:0;top:42px;width:290px;background:var(--bg-1);border:1px solid var(--bd-2);border-radius:12px;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,.5);z-index:30}',
    '.wvs-dd button{display:block;width:100%;text-align:left;font:inherit;font-size:.86rem;background:none;border:0;border-radius:8px;padding:9px 10px;color:var(--tx-1);cursor:pointer}',
    '.wvs-dd button:hover,.wvs-dd button:focus-visible{background:var(--bg-2)}.wvs-dd small{display:block;color:var(--tx-2);font-size:.74rem}',
    '.wvs-dd .wvs-danger{color:var(--color-red,#F47C7C)}.wvs-dd hr{border:0;border-top:1px solid var(--bd-1);margin:4px 0}',
    '.wvs-undo{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--color-amber,#F2B94B);border-radius:10px;background:var(--bg-1);padding:8px 12px;margin:0 0 10px;font-size:.86rem;color:var(--tx-1)}',
    '.wvs-undo small{color:var(--tx-2)}',
    '.wvs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
    '.wvs-it{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 12px;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:4px 10px;align-items:center}',
    '.wvs-it--pinned{border-color:color-mix(in srgb,var(--color-amber,#F2B94B) 55%,var(--bd-1))}.wvs-it--full{opacity:.75}',
    '.wvs-ic{width:44px;height:44px;border-radius:8px;grid-row:span 2;background:var(--bg-0)}',
    '.wvs-n{font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tx-1)}',
    '.wvs-s{font-size:.78rem;color:var(--tx-2)}',
    '.wvs-pin{grid-row:span 2;font:inherit;font-size:.76rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 10px;background:transparent;color:var(--tx-2);cursor:pointer;min-height:32px;white-space:nowrap}',
    '.wvs-pin--on{border-color:var(--color-amber,#F2B94B);color:var(--color-amber,#F2B94B)}',
    '.wvs-f{grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:8px;border-top:1px solid var(--bd-1);font-size:.8rem;color:var(--tx-2)}',
    '.wvs-units{display:flex;gap:3px;flex:1;min-width:40px}.wvs-units i{flex:1;height:7px;border-radius:3px;background:var(--bg-2)}',
    '.wvs-units i.a{background:var(--color-green,#3CC48A)}.wvs-units i.m{background:var(--acc-1)}',
    '.wvs-units--bar{gap:0;height:7px;border-radius:4px;background:var(--bg-2);overflow:hidden}.wvs-units--bar i{flex:none;border-radius:0}',
    '.wvs-unl{flex:1;font-size:.78rem}.wvs-cnt{white-space:nowrap;color:var(--tx-1)}',
    '.wvs-step{display:inline-flex;align-items:center;border:1px solid var(--bd-2);border-radius:9px;overflow:hidden}',
    '.wvs-step button{font:inherit;background:transparent;border:0;color:var(--tx-1);width:32px;height:32px;font-size:1.05rem;cursor:pointer}',
    '.wvs-step button:disabled,.wvs-max:disabled{opacity:.35;cursor:default}',
    '.wvs-step output{min-width:26px;text-align:center;color:var(--tx-1);font-weight:700}',
    '.wvs-max{font:inherit;font-size:.74rem;border:1px solid var(--bd-2);border-radius:8px;padding:6px 8px;background:transparent;color:var(--tx-2);cursor:pointer}',
    '.wvs-st{font-size:.74rem;font-weight:700;border:1px solid;border-radius:999px;padding:2px 9px;white-space:nowrap}',
    '.wvs-st--ok{color:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A)}',
    '.wvs-tw{overflow-x:auto;border:1px solid var(--bd-1);border-radius:12px}',
    '.wvs-tbl{width:100%;border-collapse:collapse;font-size:.86rem}.wvs-tbl th{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--tx-2);text-align:left;padding:8px 10px;border-bottom:1px solid var(--bd-1)}',
    '.wvs-tbl td{padding:6px 10px;border-bottom:1px solid var(--bd-1);color:var(--tx-1);white-space:nowrap}.wvs-tbl .r{text-align:right}',
    '.wvs-tn img{vertical-align:middle;margin-right:8px;border-radius:6px}.wvs-tr--pinned td:first-child{box-shadow:inset 3px 0 0 var(--color-amber,#F2B94B)}',
    '.wvs-empty{color:var(--tx-2);font-size:.9rem;margin:14px 0}',
    '#wvTabShop button:focus-visible,#wvTabShop input:focus-visible,#wvTabShop select:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.wvs-aal{font-size:.8rem;padding:8px 10px}.wvs-seg{display:flex;width:100%}.wvs-seg button{flex:1;min-height:42px}',
    '.wvs-step button{width:40px;height:40px}.wvs-pin{min-height:40px}.wvs-menu{margin-left:0}',
    '.wvs-dd{position:fixed;left:8px;right:8px;bottom:8px;top:auto;width:auto;padding:10px}.wvs-dd button{padding:12px}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  function getState() {
    try { return root.WV.__getShopState(); } catch (_) { return null; }
  }

  function getSelectedToken() {
    var sel = el('keySelectGlobal');
    return sel ? (sel.value || '').trim() : null;
  }

  function fpOf(token) { return token ? token.slice(0, 4) + '…' + token.slice(-4) : 'anon'; }

  // Lista de cuentas para «Gestionar». Lectura cruda TOLERADA de la legacy gw2_keys:
  // idea61 la vigila por par ('wv-shop-ui.js[gw2_keys]'); mudarla a Storage es otro ciclo.
  function accountFps() {
    var keys = [];
    try { keys = JSON.parse(localStorage.getItem('gw2_keys') || '[]') || []; } catch (_) {}
    var seen = {}, out = [];
    keys.forEach(function (k) {
      var fp = fpOf(k && k.value);
      if (!k || !k.value || seen[fp]) return;
      seen[fp] = true;
      out.push({ fp: fp, label: k.label || fp });
    });
    return out;
  }

  function ensureCss() {
    if (!doc.head || el('wv-shop-ui-css')) return;
    var s = doc.createElement('style');
    s.id = 'wv-shop-ui-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function skeleton(view) {
    var n = view === 'table' ? 8 : 6, h = '';
    for (var i = 0; i < n; i++) h += '<div class="skeleton skeleton--block" style="height:' + (view === 'table' ? 34 : 96) + 'px;margin:0 0 8px;border-radius:12px"></div>';
    return h;
  }

  function setShopLoading(on, msg) {
    var st = getState(), host = el('wvTabShop');
    if (!host) return;
    var node = el('wvShopLoading');
    if (on) {
      if (!node) {
        node = doc.createElement('div');
        node.id = 'wvShopLoading';
        var tb = el('wvShopToolbarHost');
        if (tb && tb.parentElement === host) tb.insertAdjacentElement('afterend', node);
        else host.prepend(node);
      }
      node.innerHTML = '<p class="wvs-empty" role="status">' + esc(msg || 'Cargando la Tienda…') + '</p>' + skeleton(st && st.view);
      node.hidden = false;
    } else if (node) {
      node.hidden = true;
    }
  }

  function ensureShopHost() {
    var host = el('wvShopToolbarHost');
    if (!host || !host.isConnected) {
      host = doc.createElement('div');
      host.id = 'wvShopToolbarHost';
      var tab = el('wvTabShop');
      if (tab) tab.prepend(host);
    }
    return host;
  }

  function toolHTML(st) {
    var legacyVis = st.legacyFilter || 'show', seg = st.shopSeg || 'pinned';
    return '<div id="wvShopAA"></div>' +
      '<div class="wvs-tool">' +
      '<input id="wvShopSearch" class="wvs-q" type="search" placeholder="Buscar ítem (nombre o ID)…" aria-label="Buscar en la Tienda" value="' + esc(st.q || '') + '">' +
      '<div class="wvs-seg" role="group" aria-label="Qué mostrar">' + SEGS.map(function (s) {
        return '<button type="button" data-wvs-seg="' + s[0] + '" aria-pressed="' + (seg === s[0]) + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="wvs-sel">Legado <select id="wvLegacyFilter"><option value="show"' + (legacyVis === 'show' ? ' selected' : '') + '>Mostrar</option>' +
      '<option value="hide"' + (legacyVis === 'hide' ? ' selected' : '') + '>Ocultar</option></select></label>' +
      '<button type="button" id="wvShopToggleView" class="wvs-btn" aria-label="Cambiar vista">' + viewLabel(st.view) + '</button>' +
      '<div class="wvs-menu"><button type="button" class="wvs-btn" data-wvs-manage aria-haspopup="menu" aria-expanded="false" aria-controls="wvShopMenu">Gestionar ▾</button>' +
      '<div id="wvShopMenu" class="wvs-dd" role="menu" aria-label="Gestionar la Tienda" hidden></div></div>' +
      '</div><div id="wvShopUndo"></div>';
  }

  function viewLabel(v) { return v === 'table' ? '☰ Lista' : '▦ Tarjetas'; }

  function ensureShopToolbar() {
    var st = getState();
    if (!st) return;
    ensureCss();
    var host = ensureShopHost();
    if (host.__wired && host.querySelector('.wvs-tool')) return;
    host.__wired = true;
    host.innerHTML = toolHTML(st);
    wireToolbar(host, st);
  }

  function wireToolbar(host, st) {
    var q = host.querySelector('#wvShopSearch');
    var v = host.querySelector('#wvShopToggleView');
    var lf = host.querySelector('#wvLegacyFilter');
    if (q) q.addEventListener('input', function () { st.q = (q.value || '').trim().toLowerCase(); WVShopUI.render(); });
    if (v) v.addEventListener('click', function () {
      st.view = (st.view === 'cards') ? 'table' : 'cards';
      try { Storage.set(Storage.STORAGE_KEYS.WV_SHOP_VIEW, st.view); } catch (_) {}
      WVShopUI.render();
    });
    if (lf) lf.addEventListener('change', function () {
      st.legacyFilter = lf.value || 'show';
      try { Storage.set(Storage.STORAGE_KEYS.WV_SHOP_LEGACY_FILTER, st.legacyFilter); } catch (_) {}
      WVShopUI.render();
    });
    host.addEventListener('click', function (e) {
      var t = closest(e.target, '[data-wvs-seg],[data-wvs-manage],[data-wvs-act]');
      if (!t) return;
      if (t.getAttribute('data-wvs-seg')) {
        st.shopSeg = t.getAttribute('data-wvs-seg');
        Array.prototype.forEach.call(host.querySelectorAll('[data-wvs-seg]'), function (b) {
          b.setAttribute('aria-pressed', String(b === t));
        });
        WVShopUI.render();
      } else if (t.hasAttribute('data-wvs-manage')) {
        toggleMenu();
      } else {
        closeMenu(false);
        var M = root.WVShopManage;
        if (M && M.run) M.run(t.getAttribute('data-wvs-act'), manageCtx(st));
      }
    });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
    if (!doc.__wvsOutside) {
      doc.__wvsOutside = true;
      doc.addEventListener('click', function (e) {
        var m = el('wvShopMenu');
        if (m && !m.hidden && !closest(e.target, '.wvs-menu')) closeMenu(false);
      });
    }
  }

  function closest(n, sel) {
    for (var i = 0; n && i < 6; n = n.parentNode, i++) if (n.matches && n.matches(sel)) return n;
    return null;
  }

  function toggleMenu() {
    var m = el('wvShopMenu'), b = doc.querySelector('[data-wvs-manage]');
    if (!m) return;
    if (!m.hidden) { closeMenu(true); return; }
    var M = root.WVShopManage;
    m.innerHTML = M && M.menuHTML ? M.menuHTML() : '<p class="wvs-empty">Cargando…</p>';
    m.hidden = false;
    if (b) b.setAttribute('aria-expanded', 'true');
    var first = m.querySelector('button');
    if (first) first.focus();
  }

  function closeMenu(focusBtn) {
    var m = el('wvShopMenu'), b = doc.querySelector('[data-wvs-manage]');
    if (!m || m.hidden) return;
    m.hidden = true;
    if (b) { b.setAttribute('aria-expanded', 'false'); if (focusBtn) b.focus(); }
  }

  function syncShopToggleLabel() {
    var st = getState(), v = el('wvShopToggleView');
    if (v) v.textContent = viewLabel(st && st.view);
  }

  // Lo que necesita «Gestionar» para trabajar sobre el estado de la Tienda.
  function manageCtx(st) {
    return {
      state: st, fp: fpOf(getSelectedToken()), accounts: accountFps(), store: root.WVSeasonStore,
      season: st.season, render: renderShopArea, reload: reloadMarksAndPins,
      undoHost: el('wvShopUndo'), toast: root.toast, confirm: root.confirm ? root.confirm.bind(root) : null
    };
  }

  function renderShopArea() {
    var st = getState();
    if (!st) { setTimeout(function () { WVShopUI.render(); }, 200); return; }
    var host = el('wvTabShop');
    if (!host) return;
    host.style.padding = '';
    ensureShopToolbar();
    syncShopToggleLabel();

    var aaHost = el('wvShopAA');
    if (aaHost) aaHost.innerHTML = aaLineHTML(aaSummary(st.merged, st.aa, st.pinned, st.marks), st.aaIconUrl, hhmm(st.lastSyncTs));

    var area = el('wvShopList');
    if (!area) {
      area = doc.createElement('div');
      area.id = 'wvShopList';
      host.appendChild(area);
      wireList(area);
    }
    var ctx = {
      marks: st.marks || {}, pinned: st.pinned || {}, itemsById: st.itemsById || new Map(),
      seg: st.shopSeg || 'pinned', q: st.q || ''
    };
    var rows = filterRows(st.merged, {
      q: ctx.q, seg: ctx.seg, legacy: st.legacyFilter || 'show', sort: st.sort || 'name',
      pinned: ctx.pinned, marks: ctx.marks, itemsById: ctx.itemsById
    }).slice(0, 1200);
    setShopLoading(false);
    area.innerHTML = st.view === 'table' ? tableHTML(rows, ctx) : cardsHTML(rows, ctx);
  }

  function wireList(area) {
    area.addEventListener('click', function (e) {
      var st = getState();
      var t = closest(e.target, '[data-wvs-pin],[data-wvs-step],[data-wvs-max]');
      if (!st || !t || t.disabled) return;
      if (t.hasAttribute('data-wvs-pin')) { togglePin(st, t.getAttribute('data-wvs-pin')); return; }
      var id = t.getAttribute('data-id') || t.getAttribute('data-wvs-max');
      var row = (st.merged || []).find(function (r) { return String(r.id) === String(id); });
      if (!row) return;
      var n = rowNumbers(row, st.marks);
      var next = t.hasAttribute('data-wvs-max') ? n.max : n.marked + Number(t.getAttribute('data-wvs-step'));
      setMark(st, row, next, t.hasAttribute('data-wvs-max') ? '[data-wvs-step="-1"][data-id="' + id + '"]' : '[data-wvs-step="' + t.getAttribute('data-wvs-step') + '"][data-id="' + id + '"]');
    });
  }

  function refocus(sel) {
    var b = sel && doc.querySelector('#wvShopList ' + sel);
    if (b && b.disabled) b = doc.querySelector('#wvShopList [data-id="' + (b.getAttribute('data-id')) + '"]:not([disabled])');
    if (b && b.focus) b.focus();
  }

  function setMark(st, row, value, focusSel) {
    var n = rowNumbers(row, st.marks);
    var v = Math.max(0, Math.min(n.max, Math.round(Number(value) || 0)));
    if (v === n.marked) return;
    st.marks = st.marks || {};
    st.marks[row.id] = v;
    try {
      if (root.WVSeasonStore && st.season) root.WVSeasonStore.setMarks(st.season.year, st.season.seq, fpOf(getSelectedToken()), (function (p) { p[row.id] = v; return p; })({}));
    } catch (e) { if (root.console) root.console.warn(LOG, 'marcas', e); }
    renderShopArea();
    refocus(focusSel);
  }

  function togglePin(st, id) {
    var pinned = st.pinned = st.pinned || {};
    var was = !!pinned[id], fp = fpOf(getSelectedToken());
    if (was) delete pinned[id]; else pinned[id] = true;
    renderShopArea();
    refocus('[data-wvs-pin="' + id + '"]');
    var S = root.WVSeasonStore;
    if (!S || !st.season) return;
    var p = was ? S.delPinned(st.season.year, st.season.seq, fp, [id]) : S.setPinned(st.season.year, st.season.seq, fp, (function (o) { o[id] = true; return o; })({}));
    Promise.resolve(p).catch(function () {
      if (was) pinned[id] = true; else delete pinned[id];
      renderShopArea();
      if (root.toast) root.toast('error', was ? 'No se pudo desfijar' : 'No se pudo fijar', { ttl: 1800 });
    });
  }

  // Normaliza para comparar lo guardado (1) con lo de la sesión (true) y descartar ceros.
  function norm(o) {
    var out = {};
    Object.keys(o || {}).forEach(function (k) { var v = Number(o[k] === true ? 1 : o[k]) || 0; if (v) out[k] = v; });
    return JSON.stringify(Object.keys(out).sort().map(function (k) { return [k, out[k]]; }));
  }

  // Relee marcas y fijados de la cuenta seleccionada; redibuja solo si cambiaron.
  function reloadMarksAndPins() {
    var st = getState(), S = root.WVSeasonStore, tk = getSelectedToken();
    if (!st || !S || !st.season || !tk || st.lastToken !== tk) return false;
    var fp = fpOf(tk);
    var marks = S.getMarks(st.season.year, st.season.seq, fp) || {};
    var pinned = S.getPinned(st.season.year, st.season.seq, fp) || {};
    if (norm(marks) === norm(st.marks) && norm(pinned) === norm(st.pinned)) return false;
    st.marks = marks;
    st.pinned = pinned;
    if (el('wvShopList')) renderShopArea();
    return true;
  }

  var _refreshInFlight = null;

  function refreshShopData(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    var token = getSelectedToken();
    if (!token) {
      var host = el('wvTabShop');
      if (host) host.innerHTML = '<p class="wvs-empty">Elegí una cuenta para ver la Tienda.</p>';
      return Promise.resolve();
    }
    var st = getState();
    if (!st) return new Promise(function (r) { setTimeout(r, 300); }).then(function () { return refreshShopData(forceNoCache); });
    ensureShopToolbar();
    setShopLoading(true, 'Cargando la Tienda…');
    _refreshInFlight = Promise.resolve().then(function () {
      return root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache });
    }).then(function (pkg) {
      st.merged = pkg.rows || [];
      st.itemsById = pkg.itemsById || new Map();
      st.aa = pkg.aa || 0;
      st.aaIconUrl = pkg.aaIconUrl || null;
      st.lastSyncTs = Date.now();
      st.lastToken = token;
      var fp = fpOf(token);
      if (root.WVSeasonStore && st.season) {
        st.marks = root.WVSeasonStore.getMarks(st.season.year, st.season.seq, fp) || {};
        st.pinned = root.WVSeasonStore.getPinned(st.season.year, st.season.seq, fp) || {};
      }
      renderShopArea();
    }, function (e) {
      if (root.console) root.console.warn(LOG, 'refresh error:', e);
      setShopLoading(false);
      if (root.toast) root.toast('error', 'No se pudo cargar la Tienda', { ttl: 2000 });
    }).then(function () { _refreshInFlight = null; });
    return _refreshInFlight;
  }

  // Otro módulo (Compras fijadas) cambió marcas o fijados: la Tienda se pone al día.
  if (root.addEventListener) root.addEventListener('wv:season-store:mutate', function () { setTimeout(reloadMarksAndPins, 0); });

  var WVShopUI = {
    version: VERSION,
    render: renderShopArea,
    refresh: refreshShopData,
    setShopLoading: setShopLoading,
    ensureShopToolbar: ensureShopToolbar,
    syncShopToggleLabel: syncShopToggleLabel,
    _pure: { rowNumbers: rowNumbers, aaSummary: aaSummary, filterRows: filterRows, unitsHTML: unitsHTML, cardHTML: cardHTML,
      tableHTML: tableHTML, aaLineHTML: aaLineHTML, typeLabel: typeLabel, fmtInt: fmtInt, norm: norm, CSS: CSS }
  };

  root.WVShopUI = WVShopUI;
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
