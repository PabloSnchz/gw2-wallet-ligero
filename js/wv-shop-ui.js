/*!
 * js/wv-shop-ui.js — UI de la Tienda de Wizard's Vault
 * v1.0.2 (2026-05-02)
 *
 * Extraído de router.js para separar renderizado de navegación.
 * Responsabilidades:
 *  - Renderizar la grilla de tienda (cards y tabla)
 *  - Manejar filtros, ordenamiento, vista, búsqueda
 *  - Skeleton loader
 *  - Toolbar de tienda
 *  - Auto-refresh
 *
 * v1.0.2: Fix visual — glow solo en ícono, no en tarjeta. Borde izquierdo lo aplica wv-theme.js
 * v1.0.1: Fix de timing — verifica que window.WV esté disponible antes de operar.
 *
 * Depende de:
 *  - window.WV (estado de tienda: state.shop)
 *  - window.GW2Api (para getWVShopMerged, getWVSeason)
 *  - window.WVSeasonStore (persistencia de marcas/pins)
 */

(function (root) {
  'use strict';

  var LOG = '[WV-ShopUI]';
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var el = function (id) { return document.getElementById(id); };

  function now() { return Date.now(); }
  function fmtInt(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function esc(s) {
    return String(s || '').replace(/[&<>]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  // ==========================================================================
  // COLORES Y UTILIDADES VISUALES
  // ==========================================================================

  var RARITY_COLORS = {
    'junk': '#AAAAAA', 'basic': '#FFFFFF', 'fine': '#62A4DA',
    'masterwork': '#1A9306', 'rare': '#FCD00B', 'exotic': '#FFA405',
    'ascended': '#FB3E8D', 'legendary': '#974EFF'
  };
  function rarityColor(r) { return r ? (RARITY_COLORS[String(r).toLowerCase()] || null) : null; }

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  // ==========================================================================
  // REFERENCIA AL ESTADO DE TIENDA (window.WV)
  // ==========================================================================

  function getState() {
    try { return root.WV.__getShopState(); } catch (_) { return null; }
  }

  function getSelectedToken() {
    var sel = document.getElementById('keySelectGlobal');
    return sel ? (sel.value || '').trim() : null;
  }

  // ==========================================================================
  // SKELETON LOADER
  // ==========================================================================

  function skShopCards(n) {
    var html = ['<div class="wv-sk-grid">'];
    for (var i = 0; i < n; i++) {
      html.push(
        '<div class="wv-sk-card">',
          '<div class="wv-sk-card__top">',
            '<div class="skeleton wv-sk-icon"></div>',
            '<div>',
              '<div class="skeleton skeleton--line lg" style="width:70%"></div>',
              '<div class="skeleton skeleton--line sm" style="width:46%"></div>',
            '</div>',
            '<div class="skeleton wv-sk-btn"></div>',
          '</div>',
          '<div class="wv-sk-card__meta">',
            '<div class="skeleton wv-sk-chip"></div>',
            '<div class="skeleton wv-sk-chip"></div>',
          '</div>',
          '<div class="skeleton skeleton--block"></div>',
          '<div class="wv-sk-card__meta">',
            '<div class="skeleton wv-sk-pill"></div>',
            '<div class="skeleton wv-sk-pill"></div>',
          '</div>',
        '</div>'
      );
    }
    html.push('</div>');
    return html.join('');
  }

  function skShopTable(n) {
    var html = ['<div class="wv-sk-table">'];
    for (var i = 0; i < n; i++) {
      html.push(
        '<div class="wv-sk-row">',
          '<div class="skeleton wv-sk-icon"></div>',
          '<div class="skeleton wv-sk-name"></div>',
          '<div class="skeleton wv-sk-thin"></div>',
          '<div class="skeleton wv-sk-thin"></div>',
          '<div class="skeleton wv-sk-thin"></div>',
          '<div class="skeleton wv-sk-btn"></div>',
          '<div class="skeleton wv-sk-btn"></div>',
        '</div>'
      );
    }
    html.push('</div>');
    return html.join('');
  }

  function setShopLoading(on, msg) {
    var st = getState();
    var host = el('wvTabShop');
    if (!host) return;
    var node = host.querySelector('#wvShopLoading');
    if (on) {
      if (!node) {
        node = document.createElement('div');
        node.id = 'wvShopLoading';
        node.className = 'muted';
        var toolbarHost = el('wvShopToolbarHost');
        if (toolbarHost && toolbarHost.parentElement === host) {
          toolbarHost.insertAdjacentElement('afterend', node);
        } else {
          host.prepend(node);
        }
      }
      var viewPref = st ? (st.view || 'cards') : 'cards';
      var body = (viewPref === 'table') ? skShopTable(8) : skShopCards(8);
      node.innerHTML = '<div style="margin:6px 0 10px 0">' + esc(String(msg || 'Cargando Tienda…')) + '</div>' + body;
      node.hidden = false;
    } else {
      if (node) node.hidden = true;
    }
  }

  // ==========================================================================
  // TOOLBAR DE TIENDA
  // ==========================================================================

  function shopSyncLine() {
    var st = getState();
    var ts = st ? st.lastSyncTs : 0;
    if (!ts) return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado: —</span></div>';
    var secs = Math.max(0, Math.floor((now() - ts) / 1000));
    return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado hace ' + secs + 's</span></div>';
  }

  function ensureShopHost() {
    var host = el('wvShopToolbarHost');
    if (!host || !host.isConnected) {
      host = document.createElement('div');
      host.id = 'wvShopToolbarHost';
      var tabShop = el('wvTabShop');
      if (tabShop) tabShop.prepend(host);
    }
    return host;
  }

  function ensureShopToolbar() {
    var st = getState();
    if (!st) return;
    var host = ensureShopHost();
    if (host.__wired && host.querySelector('.wv-shop-toolbar')) return;
    host.__wired = true;

    // Inyectar estilos del botón PD si no existen
    if (!document.getElementById('wvpd-hotfix-ui')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'wvpd-hotfix-ui';
      styleEl.textContent = '.wvpd-iconbtn{background:none!important;border:none!important;padding:0!important;margin:0 0 0 auto!important;width:auto!important;height:auto!important;display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer}.wvpd-iconbtn img{width:40px!important;height:40px!important;display:block!important;border-radius:8px!important;box-shadow:none!important;background:transparent!important;pointer-events:none!important}.wvpd-iconbtn:hover img{filter:brightness(1.08)}';
      document.head.appendChild(styleEl);
    }

    var legacyVis = st.legacyFilter || 'show';
    host.innerHTML = [
      '<div class="wv-shop-toolbar">',
        '<div class="group" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">',
          '<strong style="margin-right:6px">Tienda:</strong>',
          '<input id="wvShopSearch" type="text" placeholder="Buscar (nombre o ID)…" />',
          '<select id="wvShopSort">',
            '<option value="name">Nombre (A→Z)</option>',
            '<option value="cost">Costo AA (↑)</option>',
            '<option value="costDesc">Costo AA (↓)</option>',
            '<option value="id">ID (↑)</option>',
          '</select>',
          '<button id="wvShopToggleView" class="btn btn--ghost">Vista: ' + (st.view === 'cards' ? 'Tarjetas' : 'Tabla') + '</button>',
          '<button id="wvShopRefresh" class="btn btn--ghost">Refrescar</button>',
          '<label for="wvLegacyFilter" class="muted" style="margin-left:8px;">Recompensas Legado:</label>',
          '<select id="wvLegacyFilter">',
            '<option value="show"' + (legacyVis === 'show' ? ' selected' : '') + '>Mostrar</option>',
            '<option value="hide"' + (legacyVis === 'hide' ? ' selected' : '') + '>Ocultar</option>',
          '</select>',
          '<button id="wvClearSynced" class="btn btn--ghost" title="Borrar o recortar marcas ya cubiertas por el API">Limpiar sincronizados</button>',
          '<button id="wvPDOpenBtn" class="btn btn--ghost" title="Detalle de compras (todas las cuentas)" style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:6px 12px;font-size:0.78rem;">' +
  '<img src="' + (localStorage.getItem('wvpd_icon_url') || 'assets/icons/3126787.png') + '" alt="" loading="lazy" width="18" height="18">Detalle de compras' +
'</button>',
        '</div>',
        shopSyncLine(),
        '<div id="wvShopHeader" class="muted" style="margin-top:4px">—</div>',
      '</div>'
    ].join('');

    // Wire events
    var q = host.querySelector('#wvShopSearch');
    var s = host.querySelector('#wvShopSort');
    var v = host.querySelector('#wvShopToggleView');
    var r = host.querySelector('#wvShopRefresh');
    var lf = host.querySelector('#wvLegacyFilter');
    var cls = host.querySelector('#wvClearSynced');

    if (q) q.addEventListener('input', function () { st.q = (q.value || '').trim().toLowerCase(); WVShopUI.render(); });
    if (s) s.addEventListener('change', function () { st.sort = s.value; WVShopUI.render(); });
    if (v) v.addEventListener('click', function () {
      st.view = (st.view === 'cards') ? 'table' : 'cards';
      try { localStorage.setItem('gw2_wv_view_v1', st.view); } catch (_) {}
      WVShopUI.render();
    });
    if (r) r.addEventListener('click', function () { WVShopUI.refresh(true); });
    if (lf) lf.addEventListener('change', function () {
      st.legacyFilter = lf.value || 'show';
      try { localStorage.setItem('gw2_wv_legacy_filter_v1', st.legacyFilter); } catch (_) {}
      WVShopUI.render();
    });

    // Asignar evento al botón de Purchase Detail
    var pdBtn = host.querySelector('#wvPDOpenBtn');
    if (pdBtn && !pdBtn.__wvpdClick) {
      pdBtn.__wvpdClick = true;
      pdBtn.addEventListener('click', function(ev) {
        ev.preventDefault();
        try { window.WVPurchaseDetail?.show(); } catch(e) { console.warn('[WV-PD] show error', e); }
      });
    }

    if (cls) cls.addEventListener('click', async function () {
      var marks = st.marks || {};
      var changed = false;
      (st.merged || []).forEach(function (row) {
        var id = String(row.id);
        var limit = (typeof row.purchase_limit === 'number') ? row.purchase_limit : null;
        var purchasedApi = (typeof row.purchased === 'number') ? row.purchased : 0;
        var m = +marks[id] || 0;
        if (limit == null) return;
        if (purchasedApi >= limit && m) { delete marks[id]; changed = true; }
        else if (m > 0 && purchasedApi + m > limit) { marks[id] = Math.max(0, limit - purchasedApi); changed = true; }
      });
      if (changed) {
        st.marks = marks;
        try {
          var token = getSelectedToken();
          var fp = token ? token.slice(0, 4) + '…' + token.slice(-4) : 'anon';
          if (root.WVSeasonStore && st.season) {
            await root.WVSeasonStore.setMarks(st.season.year, st.season.seq, fp, marks);
          }
          WVShopUI.render();
          root.toast?.('success', 'Marcas sincronizadas con el API', { ttl: 1800 });
        } catch (e) {
          WVShopUI.refresh(false);
          root.toast?.('error', 'No se pudo limpiar marcas', { ttl: 1800 });
        }
      } else {
        root.toast?.('info', 'No hay marcas para limpiar', { ttl: 1500 });
      }
    });
  }

  function syncShopToggleLabel() {
    var st = getState();
    var v = el('wvShopToggleView');
    if (v) v.textContent = 'Vista: ' + (st ? (st.view === 'cards' ? 'Tarjetas' : 'Tabla') : 'Tarjetas');
  }

  function setShopHeader(aa, spentApi, reservedMarks, iconUrl) {
    var host = el('wvShopHeader');
    if (!host) return;
    var icon = iconUrl ? ('<img src="' + esc(iconUrl) + '" alt="" width="16" height="16" style="vertical-align:middle;margin-right:6px;" loading="lazy"/>') : '';
    var aaLeft = Math.max(0, Number(aa || 0) - Number(reservedMarks || 0));
    host.innerHTML = icon + '<strong>Aclamación Astral</strong> — Disponible: <strong>' + fmtInt(aa || 0) + '</strong> • Gastado (API): <strong>' + fmtInt(spentApi || 0) + '</strong> • Reservado: <strong>' + fmtInt(reservedMarks || 0) + '</strong> • Restante: <strong>' + fmtInt(aaLeft) + '</strong>';
  }

  function computeShopNumbers(rows, marks) {
    var spentApi = 0;
    (rows || []).forEach(function (x) { var cost = +x.cost || 0, pc = +x.purchased || 0; if (cost > 0 && pc > 0) spentApi += cost * pc; });
    var reserved = 0;
    Object.keys(marks || {}).forEach(function (id) {
      var m = +marks[id] || 0;
      var row = (rows || []).find(function (x) { return String(x.id) === String(id); });
      if (row && m > 0) reserved += (row.cost || 0) * m;
    });
    return { spentApi: spentApi, reservedMarks: reserved };
  }

  function passSearchAndSort(list) {
    var st = getState();
    if (!st) return list || [];
    var q = (st.q || '').toLowerCase();
    var sort = st.sort || 'name';
    var legacy = st.legacyFilter || 'show';
    var itemsById = st.itemsById || new Map();

    var filtered = (list || []).filter(function (x) {
      if (legacy === 'hide' && String(x.type || '').toLowerCase() === 'legacy') return false;
      if (!q) return true;
      var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
      var name = it && it.name ? String(it.name) : '';
      return name.toLowerCase().includes(q) || String(x.id || '').includes(q);
    });

    var sorted = filtered.slice();
    switch (sort) {
      case 'cost': sorted.sort(function (a, b) { return (a.cost || 0) - (b.cost || 0); }); break;
      case 'costDesc': sorted.sort(function (a, b) { return (b.cost || 0) - (a.cost || 0); }); break;
      case 'id': sorted.sort(function (a, b) { return (a.id || 0) - (b.id || 0); }); break;
      default:
        sorted.sort(function (a, b) {
          var ia = itemsById.get(a.item_id) || {}, ib = itemsById.get(b.item_id) || {};
          return String(ia.name || '').localeCompare(String(ib.name || ''), 'es');
        });
    }

    var pinned = st.pinned || {};
    sorted.sort(function (a, b) { var pa = !!pinned[a.id], pb = !!pinned[b.id]; return pa && !pb ? -1 : (!pa && pb ? 1 : 0); });
    return sorted;
  }

  // ==========================================================================
  // RENDERIZADO PRINCIPAL
  // ==========================================================================

  function renderShopArea() {
    var st = getState();
    if (!st) {
      console.warn('[WV-ShopUI] Estado no disponible aún, reintentando...');
      setTimeout(function () { WVShopUI.render(); }, 200);
      return;
    }
    var host = el('wvTabShop');
    if (!host) return;

    // Margen interior como Wallet y Meta
    host.style.padding = '0 12px 12px 12px';

    ensureShopToolbar();
    syncShopToggleLabel();

    var sums = computeShopNumbers(st.merged, st.marks);
    setShopHeader(st.aa, sums.spentApi, sums.reservedMarks, st.aaIconUrl);

    var areaId = 'wvShopList';
    var area = host.querySelector('#' + areaId);
    if (!area) {
      area = document.createElement('div');
      area.id = areaId;
      area.style.padding = '0 6px'; // Margen horizontal como Wallet
      host.appendChild(area);
    }

    var itemsById = st.itemsById || new Map();
    var rows = passSearchAndSort(st.merged).slice(0, 1200);

    setShopLoading(false);

    if (st.view === 'table') {
      renderShopTable(area, rows, itemsById, st);
    } else {
      renderShopCards(area, rows, itemsById, st);
    }

    wirePinButtons(area, st);
    wireManualInputs(area, st);

    // v1.0.2: Aplicar tema visual a las cards recién renderizadas
    setTimeout(function () {
      var cards = area.querySelectorAll('.wv-card, .wv-obj-card');
      cards.forEach(function (card) {
        card.__wvThemed = false;
        var nameEl = card.querySelector('.wv-card__name');
        var borderColor = 'rgba(255, 255, 255, 0.5)'; // fallback neutro
        if (nameEl && nameEl.style.color && nameEl.style.color !== 'rgb(233, 233, 241)' && nameEl.style.color !== '#e9e9f1') {
          // Convertir rgb(26, 147, 6) a rgba(26, 147, 6, 0.5)
          var match = nameEl.style.color.match(/[\d.]+/g);
          if (match && match.length >= 3) {
            borderColor = 'rgba(' + match[0] + ', ' + match[1] + ', ' + match[2] + ', 0.5)';
          }
        }
        card.style.borderLeft = '3px solid ' + borderColor;
        card.classList.add('card');
      });
    }, 80);
  }

  function renderShopTable(area, rows, itemsById, st) {
    var marks = st.marks || {};
    var trs = rows.map(function (x) {
      var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
      var icon = it && it.icon ? ('<img class="wv-item-icon" src="' + esc(it.icon) + '" alt="" loading="lazy"/> ') : '';
      var name = it && it.name ? it.name : (x.item_id != null ? ('Item #' + x.item_id) : (x.type || '—'));
      var rarity = it && it.rarity ? String(it.rarity) : null;
      var color = rarityColor(rarity);
      var qty = (x.item_count && x.item_count > 1) ? (' <span class="muted">×' + x.item_count + '</span>') : '';
      var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : null;
      var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;
      var marked = Number(marks[x.id] || 0);
      var purchasedEff = purchasedApi + marked;
      var leftVal = (limit == null) ? '∞' : Math.max(0, limit - purchasedEff);

      var nameHtml = '<span' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(name) + '</span>';
      var pinActive = !!(st.pinned && st.pinned[x.id]);
      var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
      var pinBtn = '<button class="' + pinCls + '" data-pin="' + x.id + '" title="' + (pinActive ? 'Desfijar' : 'Fijar') + '">📌</button>';

      return '<tr data-id="' + x.id + '">' +
        '<td class="nowrap">' + icon + nameHtml + qty + '</td>' +
        '<td>' + esc(x.type || '') + '</td>' +
        '<td class="right">' + (x.cost || 0) + '</td>' +
        '<td class="right">' + purchasedEff + ' / ' + (limit == null ? '∞' : limit) + '</td>' +
        '<td class="right">' + leftVal + '</td>' +
        '<td class="right"><div class="wvpd-manual-input" style="display:flex;gap:4px;"><input type="number" class="wvpd-manual-input-field" data-id="' + x.id + '" value="' + marked + '" min="0" max="' + (limit || 999) + '" step="1" style="width:60px;"><button class="btn-max" data-id="' + x.id + '" data-limit="' + (limit || 0) + '" style="padding:2px 6px;">MAX</button></div></td>' +
        '<td class="right">' + pinBtn + '</td>' +
        '</tr>';
    }).join('');

    area.innerHTML = '<div class="table-wrap"><table class="simple"><thead>' +
      '<tr><th>Ítem</th><th>Tipo</th><th class="right">Costo (AA)</th><th class="right">Comprado</th><th class="right">Restante</th><th class="right">Marcar</th><th class="right">Fijar</th></tr>' +
      '</thead><tbody>' + trs + '</tbody></table></div>';
  }

  function renderShopCards(area, rows, itemsById, st) {
    var marks = st.marks || {};
    var cards = rows.map(function (x) {
      var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
      var icon = it && it.icon ? it.icon : '';
      var name = it && it.name ? it.name : (x.item_id != null ? ('Item #' + x.item_id) : (x.type || '—'));
      var rarity = it && it.rarity ? String(it.rarity) : null;
      var color = rarityColor(rarity);
      var cost = (x.cost || 0);
      var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : null;
      var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;
      var marked = Number(marks[x.id] || 0);
      var purchasedEff = purchasedApi + marked;
      var leftVal = (limit == null) ? null : Math.max(0, limit - purchasedEff);
      var leftDisplay = (limit == null) ? '∞' : leftVal;
      var totalRemainingAA = leftVal !== null ? leftVal * cost : 0;
      var progressPercent = limit ? (purchasedEff / limit) * 100 : 0;
      var isCompleted = leftVal !== null && leftVal === 0;
      var statusIcon = isCompleted ? '✅' : '⚠️';
      var statusText = isCompleted ? 'Completado' : (limit === null ? 'Ilimitado' : 'Pendiente');
      var statusColor = isCompleted ? '#a0ffc8' : (limit === null ? '#7bc2ff' : '#ffd36b');

      var pinActive = !!(st.pinned && st.pinned[x.id]);
      var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
      var pinBtn = '<button class="' + pinCls + '" data-pin="' + x.id + '" title="' + (pinActive ? 'Desfijar' : 'Fijar') + '">📌</button>';

      // ===== NUEVO v1.0.2: Glow solo en el ícono, no en la tarjeta =====
      var iconGlowColor = color ? hexToRGBA(color, 0.36) : null;
      var iconBorderColor = color ? hexToRGBA(color, 0.32) : null;
      var iconDeco = (iconBorderColor && iconGlowColor)
        ? ' style="box-shadow: 0 0 0 2px ' + iconBorderColor + ', 0 0 10px ' + iconGlowColor + '; border-radius:6px;"'
        : '';

      // La tarjeta NO recibe glow ni border inline — lo hereda de .card (theme-polish.css) + wv-theme.js (border-left)
      // ===== FIN NUEVO =====

      var rowStyle = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';

      var progressHtml = '<div class="wvpd-item-progress wvpd-item-progress--compact">' +
        '<div class="wvpd-item-progress__status" style="color:' + statusColor + '" title="' + (isCompleted ? 'Completado' : (limit === null ? 'Sin límite' : 'Faltan ' + leftVal + ' unidades (' + totalRemainingAA + ' AA)')) + '">' +
        statusIcon + ' ' + statusText + ': ' + (leftDisplay === '∞' ? '∞' : leftDisplay + ' (' + totalRemainingAA + ' AA)') +
        '</div>' +
        '<div class="wvpd-item-progress__bar">' +
        '<div class="wvpd-item-progress__fill" style="width:' + Math.min(100, progressPercent) + '%"></div>' +
        '</div>' +
        '</div>';

      var manualInputHtml = '<div class="wvpd-manual-input" data-id="' + x.id + '">' +
        '<label>Compras manuales:</label>' +
        '<input type="number" class="wvpd-manual-input-field" data-id="' + x.id + '" value="' + marked + '" min="0" max="' + (limit || 999) + '" step="1">' +
        '<button class="btn-max" data-id="' + x.id + '" data-limit="' + (limit || 0) + '">MAX</button>' +
        '</div>';

      return '<div class="wv-card" data-id="' + x.id + '">' +
        '<div class="wv-card__top">' +
          '<div class="wv-card__iconWrap"' + iconDeco + '>' + (icon ? ('<img class="wv-card__icon" src="' + esc(icon) + '" alt="" loading="lazy"/>') : '') + '</div>' +
          '<div class="wv-card__name" title="' + esc(name) + '"' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(name) + '</div>' +
          pinBtn +
        '</div>' +
        '<div class="wv-card__meta">' +
          '<span class="wv-badge">Costo: <strong>' + cost + '</strong> AA</span>' +
          '<span class="wv-type">' + esc(x.type || '—') + '</span>' +
        '</div>' +
        '<div class="wv-card__body">' +
          '<div class="sep"></div>' +
          '<div class="wv-card__row" style="' + rowStyle + '"><span class="muted">Comprado (API):</span><span class="pill">' + purchasedApi + ' / ' + (limit == null ? '∞' : limit) + '</span></div>' +
          '<div class="wv-card__row" style="' + rowStyle + '"><span class="muted">Restante:</span><span class="pill">' + leftDisplay + '</span></div>' +
          progressHtml +
          manualInputHtml +
        '</div>' +
        '<div class="wv-card__bottom" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<span class="wv-id">ID ' + x.id + '</span>' +
        '</div>' +
        '</div>';
    }).join('');

    area.innerHTML = '<div class="wv-card-grid">' + cards + '</div>';
  }

  function wirePinButtons(area, st) {
    $$('[data-pin]', area).forEach(function (btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-pin');
        var pinned = st.pinned || {};
        var token = getSelectedToken();
        var fp = token ? token.slice(0, 4) + '…' + token.slice(-4) : 'anon';
        if (pinned[id]) {
          delete pinned[id];
          try {
            if (root.WVSeasonStore && st.season) {
              await root.WVSeasonStore.delPinned(st.season.year, st.season.seq, fp, [id]);
            }
            st.pinned = pinned;
            WVShopUI.render();
          } catch (e) {
            pinned[id] = true;
            st.pinned = pinned;
            WVShopUI.render();
            root.toast?.('error', 'No se pudo desfijar', { ttl: 1800 });
          }
        } else {
          pinned[id] = true;
          try {
            if (root.WVSeasonStore && st.season) {
              await root.WVSeasonStore.setPinned(st.season.year, st.season.seq, fp, { [id]: true });
            }
            st.pinned = pinned;
            WVShopUI.render();
          } catch (e) {
            delete pinned[id];
            st.pinned = pinned;
            WVShopUI.render();
            root.toast?.('error', 'No se pudo fijar', { ttl: 1800 });
          }
        }
      });
    });
  }

  function wireManualInputs(area, st) {
    $$('.wvpd-manual-input-field', area).forEach(function (input) {
      if (input.__wired) return;
      input.__wired = true;
      var listingId = input.getAttribute('data-id');
      var maxVal = parseInt(input.getAttribute('max'), 10);
      input.addEventListener('change', function () {
        var newValue = parseInt(input.value, 10);
        if (isNaN(newValue)) newValue = 0;
        if (!isNaN(maxVal) && newValue > maxVal) newValue = maxVal;
        if (newValue < 0) newValue = 0;
        if (input.value != newValue) input.value = newValue;
        st.marks[listingId] = newValue;
        try {
          var token = getSelectedToken();
          var fp = token ? token.slice(0, 4) + '…' + token.slice(-4) : 'anon';
          if (root.WVSeasonStore && st.season) {
            root.WVSeasonStore.setMarks(st.season.year, st.season.seq, fp, st.marks);
          }
        } catch (_) {}
        var sums = computeShopNumbers(st.merged, st.marks);
        setShopHeader(st.aa, sums.spentApi, sums.reservedMarks, st.aaIconUrl);
      });
    });

    $$('.btn-max', area).forEach(function (btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var listingId = btn.getAttribute('data-id');
        var maxLimit = parseInt(btn.getAttribute('data-limit'), 10);
        if (!isNaN(maxLimit) && maxLimit > 0) {
          var input = area.querySelector('.wvpd-manual-input-field[data-id="' + listingId + '"]');
          if (input) {
            input.value = maxLimit;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    });
  }

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  var _refreshInFlight = null;

  async function refreshShopData(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    var token = getSelectedToken();
    if (!token) {
      var host = el('wvTabShop');
      if (host) host.innerHTML = '<p class="muted">Seleccioná una API Key para ver la Tienda.</p>';
      return Promise.resolve();
    }

    var st = getState();
    if (!st) {
      console.warn('[WV-ShopUI] Estado no disponible, reintentando refresh...');
      await new Promise(function (r) { setTimeout(r, 300); });
      return refreshShopData(forceNoCache);
    }

    setShopLoading(true, 'Cargando Tienda…');

    _refreshInFlight = (async function () {
      try {
        var pkg = await root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache });
        st.merged = pkg.rows || [];
        st.itemsById = pkg.itemsById || new Map();
        st.aa = pkg.aa || 0;
        st.aaIconUrl = pkg.aaIconUrl || null;
        st.lastSyncTs = now();
        st.lastToken = token;

        // Cargar marcas y pins
        var fp = token.slice(0, 4) + '…' + token.slice(-4);
        if (root.WVSeasonStore && st.season) {
          st.marks = root.WVSeasonStore.getMarks(st.season.year, st.season.seq, fp) || {};
          st.pinned = root.WVSeasonStore.getPinned(st.season.year, st.season.seq, fp) || {};
        }

        WVShopUI.render();
      } catch (e) {
        console.warn(LOG, 'refresh error:', e);
        setShopLoading(false);
        root.toast?.('error', 'No se pudo cargar Tienda', { ttl: 2000 });
      }
    })();

    try { await _refreshInFlight; } finally { _refreshInFlight = null; }
  }

  // ==========================================================================
  // API PÚBLICA
  // ==========================================================================

  var WVShopUI = {
    render: renderShopArea,
    refresh: refreshShopData,
    setShopLoading: setShopLoading,
    ensureShopToolbar: ensureShopToolbar,
    syncShopToggleLabel: syncShopToggleLabel
  };

  root.WVShopUI = WVShopUI;
  console.info(LOG, 'ready v1.0.2 — glow solo en ícono, tarjeta sin glow inline');

})(typeof window !== 'undefined' ? window : this);