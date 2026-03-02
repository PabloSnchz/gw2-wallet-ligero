/*!
 * Router y Vistas (WV Objetivos cards + Tienda unificada con getWVShopMerged + auto‑refresh + Pin)
 * v2.8.4 (2026‑03‑01)
 *
 * Novedades v2.8.4:
 *  - Tarjetas: outline + halo por rareza (borde y glow sutil en el contenedor y el ícono).
 *
 * Incluye (v2.8.3 y previos):
 *  - "Comprado"=(API+Marcas), botón Max, "Limpiar sincronizados", reconciliación automática,
 *    filtro "Recompensas Legado", títulos y (tabla) nombres coloreados por rareza,
 *    layout pills, WV global, fixes de promesas/timers.
 */

(function () {
  'use strict';

  console.info('[WV] router-wv.js v2.8.4 — outline + halo por rareza en tarjetas + hydrateWVModePills');

  // ------------------------------- Utils DOM -------------------------------
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var el = function (id) { return document.getElementById(id); };

  function show(node){ if (node) node.hidden = false; }
  function hide(node){ if (node) node.hidden = true; }

  function normHash(s) {
    s = String(s || '').trim();
    if (!s) return '#/cards';
    if (s[0] !== '#') { s = (s[0] === '/' ? '#' + s : '#' + s); }
    s = s.toLowerCase().replace(/\/+$/, '');
    if (s === '#') s = '#/cards';
    return s;
  }

  // ------------------ Colores de rareza (según GW2 Wiki) ------------------
  // Monobook (claro): Junk #AAAAAA, Basic #000000, Fine #62A4DA, Masterwork #1A9306,
  //                   Rare #FCD00B, Exotic #FFA405, Ascended #FB3E8D, Legendary #4C139D
  // Vector (oscuro): ajusta tonos; usamos Legendary #974EFF para mejor contraste.
  var RARITY_COLORS = {
    'junk':       '#AAAAAA',
    'basic':      '#FFFFFF',  // en tema oscuro preferimos blanco
    'fine':       '#62A4DA',
    'masterwork': '#1A9306',
    'rare':       '#FCD00B',
    'exotic':     '#FFA405',
    'ascended':   '#FB3E8D',
    'legendary':  '#974EFF'
  };
  function rarityColor(r) {
    if (!r) return null;
    var key = String(r).trim().toLowerCase();
    return RARITY_COLORS[key] || null;
  }

  // Helper: HEX (#RRGGBB) -> rgba(r,g,b,a)
  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) { h = h.split('').map(function(c){return c+c;}).join(''); }
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0,2),16),
          g = parseInt(h.slice(2,4),16),
          b = parseInt(h.slice(4,6),16);
      var a = Math.max(0, Math.min(1, Number(alpha)));
      if (Number.isNaN(a)) a = 1;
      return 'rgba('+r+','+g+','+b+','+a+')';
    } catch (e) { return null; }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }
  function fmtNumber(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function now() { return Date.now(); }

  // ------------------------------------------------------------------------
  // WV: Hydrate de pastillas de modo (PvE / PvP / WvW)
  // ------------------------------------------------------------------------
  // Usa window.WV_MODE_ICONS (definido en index.html) para reemplazar texto por <img>.
  function hydrateWVModePills(scope) {
    try {
      var ICONS = (window.WV_MODE_ICONS || {});
      if (!ICONS || typeof ICONS !== 'object') return;
      var root = scope || document;
      // Soportamos varios selectores por robustez, pero la clase real en tus tarjetas es .wv-obj-mode
      var nodes = root.querySelectorAll('.wv-obj-mode, .wv-mode-pill, [data-wv-mode], [data-mode]');
      if (!nodes || !nodes.length) return;

      Array.prototype.forEach.call(nodes, function (node) {
        try {
          if (!node || node.__wvIconHydrated) return;

          // Leer modo: prioridad a data-wv-mode -> data-mode -> texto del nodo
          var raw = (node.getAttribute('data-wv-mode')
                  || node.getAttribute('data-mode')
                  || (node.textContent || '')).trim().toLowerCase();

          // Normalización simple (por si llega "pve"/"pvp"/"wvw" con casing raro)
          var mode = (raw === 'pvp' || raw === 'pve' || raw === 'wvw') ? raw : (
            raw.indexOf('pvp') >= 0 ? 'pvp' :
            raw.indexOf('wvw') >= 0 ? 'wvw' : 'pve' // fallback
          );

          var url = ICONS[mode];
          if (!url) return; // si no hay icono para ese modo, no tocamos el contenido (deja texto)

          // Si ya hay una imagen dentro y coincide, no duplicar
          var hasImg = node.querySelector('img');
          if (hasImg) { node.__wvIconHydrated = true; return; }

          // Limpiar texto y colocar <img> accesible
          node.textContent = '';
          var img = document.createElement('img');
          img.src = url;
          img.alt = mode.toUpperCase();
          img.width = 16; img.height = 16;
          img.decoding = 'async';
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.className = 'wv-mode-pill__img';
          node.appendChild(img);

          // Marcas auxiliares
          node.setAttribute('data-mode', mode);
          node.classList.add('wv-mode-pill--hydrated');

          node.__wvIconHydrated = true;
        } catch (_e) {}
      });
    } catch (_eAll) {}
  }

  // ---------------------- Sidebar: link activo por hash --------------------
  function setActiveNav(hash) {
    try {
      var h = normHash(hash || location.hash || '#/cards');

      var links = Array.prototype.slice.call(document.querySelectorAll('.side-nav a, .side-nav__link'));
      if (!links.length) return;

      links.forEach(function (a) {
        a.classList.remove('is-active');
        a.removeAttribute('aria-current');
      });

      var found = null;
      var norm = function (s) { return normHash(s); };

      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.getAttribute('href');
        var dh   = a.getAttribute('data-hash');
        if ((href && norm(href) === h) || (dh && norm(dh) === h)) { found = a; break; }
      }

      if (!found) {
        var map = {
          '#/cards': 'cards',
          '#/meta': 'meta',
          '#/account/achievements': 'achievements',
          '#/account/wizards-vault': 'wv'
        };
        var dv = map[h];
        if (dv) {
          found = links.find(function (a) { return (a.getAttribute('data-view') || '').trim().toLowerCase() === dv; }) || null;
        }
      }

      if (found) {
        found.classList.add('is-active');
        found.setAttribute('aria-current', 'page');
      }

      document.dispatchEvent(new CustomEvent('gn:nav-active', { detail: { hash: h, link: found } }));
    } catch (e) {
      console.warn('[router] setActiveNav error', e);
    }
  }

  // ------------------------ Sidebar: layout por vista -----------------------
  function updateSidebarFor(view /* 'cards'|'meta'|'achievements'|'wv' */) {
    try {
      var conv     = el('asideConvSection');
      var next     = el('asideNextFeatures');
      var metaNext = el('metaAsideNext');
      var achPanel = el('achAsidePanel');

      if (conv)     conv.hidden = true;
      if (next)     next.hidden = true;
      if (metaNext) metaNext.hidden = true;
      if (achPanel) achPanel.hidden = true;

      if (view === 'cards') {
        if (conv) conv.hidden = false;
        if (next) next.hidden = false;
      } else if (view === 'meta') {
        if (metaNext) metaNext.hidden = false;
      } else if (view === 'achievements') {
        if (achPanel) achPanel.hidden = false;
      }
    } catch (e) {
      console.warn('[router] updateSidebarFor error', e);
    }
  }

  // ------------------------------ Panels main ------------------------------
  function showPanel(idToShow) {
    ['walletPanel', 'metaPanel', 'achievementsPanel', 'wvPanel'].forEach(function (id) {
      var node = el(id); if (!node) return;
      if (id === idToShow) node.removeAttribute('hidden'); else node.setAttribute('hidden', 'hidden');
    });
    $$('.overlay-tab').forEach(function (btn) {
      var view = btn.getAttribute('data-view');
      var active = (idToShow === 'walletPanel' && view === 'cards') ||
                   (idToShow === 'metaPanel'   && view === 'meta');
      btn.classList.toggle('overlay-tab--active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function getSelectedToken() {
    var sel = el('keySelectGlobal'); if (!sel) return null;
    var tok = (sel.value || '').trim();
    return tok || null;
  }

  // ------------------------------- WV State --------------------------------
  var WV = (function () {
    var els = {
      panel:    el('wvPanel'),
      noteSync: el('wvSyncNote'),
      btnDaily:   el('wvTabBtnDaily'),
      btnWeekly:  el('wvTabBtnWeekly'),
      btnSpecial: el('wvTabBtnSpecial'),
      btnShop:    el('wvTabBtnShop'),
      tabDaily:   el('wvTabDaily'),
      tabWeekly:  el('wvTabWeekly'),
      tabSpecial: el('wvTabSpecial'),
      tabShop:    el('wvTabShop'),
      shopToolbarHost: el('wvShopToolbarHost'),
      seasonTitle: el('wvSeasonTitle'),
      seasonDates: el('wvSeasonDates')
    };

    var state = {
      inited: false,
      lastTab: 'daily',
      loaded: { daily:false, weekly:false, special:false, shop:false },
      shop: {
        merged: [],
        itemsById: new Map(),
        aa: 0,
        aaIconUrl: null,
        lastSyncTs: 0,
        autoRefreshTimer: null,
        autoRefreshEveryMs: 75 * 1000,
        marks: {},
        pinned: {},
        view: 'cards',
        q: '',
        sort: 'name',
        legacyFilter: 'show', // 'show' | 'hide'
        lastToken: null
      }
    };

    // ---- Persistencia ----
    var LS_WV_SHOP_MARKS   = 'gw2_wv_marks_v1';
    var LS_WV_SHOP_PINNED  = 'gw2_wv_pinned_v1';
    var LS_WV_SHOP_VIEW    = 'gw2_wv_view_v1';
    var LS_WV_LAST_TAB     = 'gw2_wv_lasttab_v1';
    var LS_WV_LEGACY_VIS   = 'gw2_wv_legacy_filter_v1';

    function marksNamespace() {
      var token = getSelectedToken() || 'anon';
      var fp = token ? (token.slice(0,4) + '…' + token.slice(-4)) : 'anon';
      var st = state.shop; var seasonId = (st && st.season && (st.season.id || st.season.title)) || 'season';
      return fp + ':' + seasonId;
    }
    function loadMarks(ns) { try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}'); return all[ns] || {}; } catch (_){ return {}; } }
    function saveMarks(ns, marks) { try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}'); all[ns] = marks || {}; localStorage.setItem(LS_WV_SHOP_MARKS, JSON.stringify(all)); } catch (_){ } }
    function loadPinned(ns) { try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_PINNED) || '{}'); return all[ns] || {}; } catch (_){ return {}; } }
    function savePinned(ns, pinned) { try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_PINNED) || '{}'); all[ns] = pinned || {}; localStorage.setItem(LS_WV_SHOP_PINNED, JSON.stringify(all)); } catch (_){ } }
    function saveView(view) { try { localStorage.setItem(LS_WV_SHOP_VIEW, view); } catch(_){ } }
    function loadView() { try { return localStorage.getItem(LS_WV_SHOP_VIEW) || 'cards'; } catch(_){ return 'cards'; } }
    function saveLastTab(tab) { try { localStorage.setItem(LS_WV_LAST_TAB, tab); } catch(_){ } }
    function loadLastTab() { try { return localStorage.getItem(LS_WV_LAST_TAB) || 'daily'; } catch(_){ return 'daily'; } }
    function saveLegacyFilter(v) { try { localStorage.setItem(LS_WV_LEGACY_VIS, v); } catch(_){ } }
    function loadLegacyFilter() { try { return localStorage.getItem(LS_WV_LEGACY_VIS) || 'show'; } catch(_){ return 'show'; } }

    // ---- Temporada (cabecera) ----
    function setWVSeasonHeader(season) {
      if (!season) return;
      if (els.seasonTitle) els.seasonTitle.textContent = season.title || '—';
      if (els.seasonDates) {
        if (season.start && season.end) {
          var start = new Date(season.start), end = new Date(season.end);
          els.seasonDates.textContent = start.toLocaleDateString() + ' → ' + end.toLocaleDateString();
        } else {
          els.seasonDates.textContent = '—';
        }
      }
    }

    // ---- Objetivos (igual a previos) ----
    function normalizeObjectives(raw) {
      var arr = (raw && raw.objectives) || [];
      return arr.map(function (o) {
        var id = (o.id != null ? o.id : (o.objective_id != null ? o.objective_id : null));
        var title = o.title || o.name || ('Objetivo #' + id);
        var track = String(o.track || '').toLowerCase();
        var progress = (o.progress_current != null ? o.progress_current : (o.progress != null ? o.progress : 0));
        var total    = (o.progress_complete != null ? o.progress_complete : (o.total != null ? o.total : 0));
        var acclaim  = (o.acclaim != null ? o.acclaim : (o.rewardAA != null ? o.rewardAA : (o.reward_aa != null ? o.reward_aa : 0)));
        var claimed  = !!o.claimed;
        var pct = (total > 0 ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : (progress ? 100 : 0));
        return { id:id, title:title, track:track, progress:progress, total:total, acclaim:acclaim, claimed:claimed, pct:pct };
      });
    }

    function renderObjectivesTab(host, data) {
      if (!host) return;
      if (!data || !Array.isArray(data.objectives)) {
        host.innerHTML = '<p class="muted">Sin objetivos para mostrar.</p>';
        return;
      }
      var list = normalizeObjectives(data);
      var html = ['<div class="wv-obj-grid">'];

      if (typeof data.meta_progress_current === 'number' && typeof data.meta_progress_complete === 'number') {
        var metaPct = (data.meta_progress_complete > 0)
          ? Math.max(0, Math.min(100, Math.round((data.meta_progress_current / data.meta_progress_complete) * 100)))
          : 0;
        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">Meta de la temporada</div>',
              (data.meta_reward_astral ? ('<span class="aa-badge">+'+fmtNumber(data.meta_reward_astral)+' AA</span>') : ''),
            '</div>',
            '<div class="wv-obj-prog">',
              '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:'+metaPct+'%;"></div></div>',
              '<div class="wv-obj-stats"><span>'+fmtNumber(data.meta_progress_current)+' / '+fmtNumber(data.meta_progress_complete)+'</span><span>'+metaPct+'%</span></div>',
            '</div>',
          '</div>'
        );
      }

      list.forEach(function (o) {
        var statusClass = o.claimed ? '' : (o.pct >= 100 ? '' : ' wv-obj-status--pending');
        var statusText  = o.claimed ? '✅ Reclamado' : (o.pct >= 100 ? '✔️ Completado' : '… En progreso');
        // o.track ya viene en lower-case; si está vacío, mostramos PvE
        var pillText = (o.track || 'pve').toUpperCase();

        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">',
                escapeHtml(o.title),
              '</div>',
              // Pastilla: la hidratamos luego para reemplazar por <img>
              '<span class="wv-obj-mode" data-wv-mode="'+escapeHtml(o.track || 'pve')+'">'+pillText+'</span>',
            '</div>',

            '<div class="wv-obj-meta">',
              '<span class="wv-obj-reward">'+(o.acclaim ? ('+'+fmtNumber(o.acclaim)+' AA') : '')+'</span>',
              '<span class="wv-obj-status'+statusClass+'">'+statusText+'</span>',
            '</div>',

            '<div class="wv-obj-prog">',
              '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:'+o.pct+'%;"></div></div>',
              '<div class="wv-obj-stats"><span>'+ (o.total ? (fmtNumber(o.progress)+' / '+fmtNumber(o.total)) : fmtNumber(o.progress)) +'</span><span>'+o.pct+'%</span></div>',
            '</div>',
          '</div>'
        );
      });

      html.push('</div>');
      host.innerHTML = html.join('');

      // —— HIDRATAR pastillas de modo ahora que ya están en el DOM ——
      hydrateWVModePills(host);
    }

    // ---- Toolbar ----
    function shopSyncLine() {
      var ts = state.shop.lastSyncTs;
      if (!ts) return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado: —</span></div>';
      var secs = Math.max(0, Math.floor((now() - ts)/1000));
      return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado hace '+secs+'s</span></div>';
    }

    function syncShopToggleLabel() {
      var v = el('wvShopToggleView');
      if (v) v.textContent = 'Vista: ' + (state.shop.view === 'cards' ? 'Tarjetas' : 'Tabla');
    }

    function ensureShopToolbar() {
      if (!els.shopToolbarHost || els.shopToolbarHost.__wired) return;
      els.shopToolbarHost.__wired = true;

      var legacyVis = state.shop.legacyFilter || 'show';

      els.shopToolbarHost.innerHTML = [
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
            '<button id="wvShopToggleView" class="btn btn--ghost">Vista: '+(state.shop.view==='cards'?'Tarjetas':'Tabla')+'</button>',
            '<button id="wvShopRefresh" class="btn btn--ghost">Refrescar</button>',
            '<label for="wvLegacyFilter" class="muted" style="margin-left:8px;">Recompensas Legado:</label>',
            '<select id="wvLegacyFilter">',
              '<option value="show"'+(legacyVis==='show'?' selected':'')+'>Mostrar</option>',
              '<option value="hide"'+(legacyVis==='hide'?' selected':'')+'>Ocultar</option>',
            '</select>',
            '<button id="wvClearSynced" class="btn btn--ghost" title="Borrar o recortar marcas ya cubiertas por el API">Limpiar sincronizados</button>',
          '</div>',
          shopSyncLine(),
          '<div id="wvShopHeader" class="muted" style="margin-top:4px">—</div>',
        '</div>'
      ].join('');

      var q = el('wvShopSearch');
      var s = el('wvShopSort');
      var v = el('wvShopToggleView');
      var r = el('wvShopRefresh');
      var lf = el('wvLegacyFilter');
      var cls = el('wvClearSynced');

      if (q) q.addEventListener('input', function(){ state.shop.q = (q.value||'').trim().toLowerCase(); renderShopArea(); });
      if (s) s.addEventListener('change', function(){ state.shop.sort = s.value; renderShopArea(); });
      if (v) v.addEventListener('click', function(){
        state.shop.view = (state.shop.view === 'cards') ? 'table' : 'cards';
        saveView(state.shop.view);
        syncShopToggleLabel();
        renderShopArea();
      });
      if (r) r.addEventListener('click', function(){ refreshShopData(true); });

      if (lf) lf.addEventListener('change', function(){
        state.shop.legacyFilter = lf.value || 'show';
        saveLegacyFilter(state.shop.legacyFilter);
        renderShopArea();
      });

      if (cls) cls.addEventListener('click', function(){
        var st = state.shop, marks = st.marks || {}, changed = false;
        (st.merged || []).forEach(function(row){
          var id = String(row.id);
          var limit = (typeof row.purchase_limit === 'number') ? row.purchase_limit : null;
          var purchasedApi = (typeof row.purchased === 'number') ? row.purchased : 0;
          var m = +marks[id] || 0;
          if (limit == null) return;
          if (purchasedApi >= limit && m) { delete marks[id]; changed = true; }
          else if (m > 0 && purchasedApi + m > limit) { marks[id] = Math.max(0, limit - purchasedApi); changed = true; }
        });
        if (changed) {
          state.shop.marks = marks;
          saveMarks(marksNamespace(), marks);
          renderShopArea();
          window.toast?.('success', 'Marcas sincronizadas con el API', { ttl: 1800 });
        } else {
          window.toast?.('info', 'No hay marcas para limpiar', { ttl: 1500 });
        }
      });

      syncShopToggleLabel();
    }

    // ---- Cabecera (AA) ----
    function setShopHeader(aa, spentApi, reservedMarks, iconUrl) {
      var host = el('wvShopHeader'); if (!host) return;
      var icon = iconUrl ? ('<img src="'+escapeHtml(iconUrl)+'" alt="" width="16" height="16" style="vertical-align:middle;margin-right:6px;" loading="lazy"/>') : '';
      var aaLeft = Math.max(0, Number(aa||0) - Number(reservedMarks||0));
      host.innerHTML = icon +
        '<strong>Aclamación Astral</strong> — Disponible: <strong>'+fmtNumber(aa||0)+'</strong>' +
        ' • Gastado (API): <strong>'+fmtNumber(spentApi||0)+'</strong>' +
        ' • Reservado (marcas): <strong>'+fmtNumber(reservedMarks||0)+'</strong>' +
        ' • Restante: <strong>'+fmtNumber(aaLeft)+'</strong>';
    }

    function computeShopNumbers(rows) {
      var spentApi = 0;
      (rows||[]).forEach(function(x){ var cost=+x.cost||0, pc=+x.purchased||0; if (cost>0 && pc>0) spentApi += cost*pc; });
      var marks = state.shop.marks || {};
      var reserved = 0;
      Object.keys(marks).forEach(function(id){
        var m = +marks[id] || 0;
        var row = (rows||[]).find(function(x){ return String(x.id) === String(id); });
        if (row && m>0) reserved += (row.cost || 0) * m;
      });
      return { spentApi: spentApi, reservedMarks: reserved };
    }

    // ---- Filtro + Orden ----
    function passSearchAndSort(list) {
      var q = (state.shop.q || '').toLowerCase();
      var sort = state.shop.sort || 'name';
      var legacy = state.shop.legacyFilter || 'show';
      var itemsById = state.shop.itemsById || new Map();

      var filtered = (list||[]).filter(function (x) {
        if (legacy === 'hide' && String(x.type||'').toLowerCase() === 'legacy') return false;
        if (!q) return true;
        var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
        var name = it && it.name ? String(it.name) : '';
        return name.toLowerCase().includes(q) || String(x.id||'').includes(q);
      });

      var sorted = filtered.slice();
      switch (sort) {
        case 'cost':     sorted.sort(function(a,b){ return (a.cost||0)-(b.cost||0); }); break;
        case 'costDesc': sorted.sort(function(a,b){ return (b.cost||0)-(a.cost||0); }); break;
        case 'id':       sorted.sort(function(a,b){ return (a.id||0)-(b.id||0); }); break;
        default:         sorted.sort(function(a,b){
                           var ia = itemsById.get(a.item_id)||{}, ib = itemsById.get(b.item_id)||{};
                           return String(ia.name||'').localeCompare(String(ib.name||''),'es');
                         });
      }

      var pinned = state.shop.pinned || {};
      sorted.sort(function (a,b) {
        var pa = !!pinned[a.id], pb = !!pinned[b.id];
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;
        return 0;
      });

      return sorted;
    }

    // ---- Render principal de Tienda ----
    function renderShopArea() {
      var host = els.tabShop; if (!host) return;
      ensureShopToolbar();
      syncShopToggleLabel();

      var toolbar = els.shopToolbarHost && els.shopToolbarHost.querySelector('.wv-shop-toolbar');
      if (toolbar) {
        var line = toolbar.querySelector('.wv-syncline');
        if (line) line.outerHTML = shopSyncLine();
      }

      var st = state.shop;
      var sums = computeShopNumbers(st.merged);
      setShopHeader(st.aa, sums.spentApi, sums.reservedMarks, st.aaIconUrl);

      var areaId = 'wvShopList';
      var area = host.querySelector('#'+areaId);
      if (!area) {
        area = document.createElement('div');
        area.id = areaId;
        host.appendChild(area);
      }

      var itemsById = st.itemsById || new Map();
      var rows = passSearchAndSort(st.merged).slice(0, 1200);

      // (debug) publicar en WV para inspección
      try { if (typeof window !== 'undefined' && window.WV) window.WV.__debugRows = rows; } catch (_){}

      if (st.view === 'table') {
        var trs = rows.map(function (x) {
          var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
          var icon = it && it.icon ? ('<img class="wv-item-icon" src="'+escapeHtml(it.icon)+'" alt="" loading="lazy"/> ') : '';
          var name = it && it.name ? it.name : (x.item_id != null ? ('Item #'+x.item_id) : (x.type || '—'));
          var rarity = it && it.rarity ? String(it.rarity) : null;
          var color  = rarityColor(rarity);
          var qty  = (x.item_count && x.item_count>1) ? (' <span class="muted">×'+x.item_count+'</span>') : '';
          var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : null;
          var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;

          var marks = st.marks || {};
          var marked = Number(marks[x.id] || 0);
          var purchasedEff = purchasedApi + marked;
          var leftVal = (limit == null) ? '∞' : GW2Api.wvComputeRemaining(limit, purchasedApi, marked);

          // nombre coloreado por rareza
          var nameHtml = '<span'+(color?' style="color:'+color+'"':'')+'>'+escapeHtml(name)+'</span>';

          var pinActive = !!(st.pinned && st.pinned[x.id]);
          var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
          var pinBtn = '<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';

          var ctr = (limit == null)
            ? '<span class="wv-counter"><span class="muted" style="min-width:24px; display:inline-block; text-align:center;">—</span></span>'
            : (
                '<span class="wv-counter" data-id="'+x.id+'">' +
                '<button class="btn btn--ghost wv-dec" title="-">−</button>' +
                '<span class="muted" style="min-width:24px; display:inline-block; text-align:center;">'+marked+'</span>' +
                '<button class="btn btn--ghost wv-inc" title="+">+</button>' +
                '</span>'
              );

          var maxBtn = (limit != null && purchasedEff < limit)
            ? '<button class="btn btn--ghost wv-markall" data-id="'+x.id+'" title="Marcar todo (llenar hasta el máximo)">Max</button>'
            : '';

          return (
            '<tr data-id="'+x.id+'">' +
              '<td class="nowrap">'+icon+ nameHtml + qty +'</td>' +
              '<td>' + escapeHtml(x.type || '') + '</td>' +
              '<td class="right">' + (x.cost || 0) + '</td>' +
              '<td class="right">' + purchasedEff + ' / ' + (limit==null?'∞':limit) + '</td>' +
              '<td class="right">' + leftVal + '</td>' +
              '<td class="right">' + ctr + (maxBtn ? ' ' + maxBtn : '') + '</td>' +
              '<td class="right">' + pinBtn + '</td>' +
            '</tr>'
          );
        }).join('');

        area.innerHTML =
          '<div class="table-wrap">' +
            '<table class="simple">' +
              '<thead><tr>' +
                '<th>Ítem</th><th>Tipo</th><th class="right">Costo (AA)</th><th class="right">Comprado</th><th class="right">Restante</th><th class="right">Marcar</th><th class="right">Fijar</th>' +
              '</tr></thead>' +
              '<tbody>'+trs+'</tbody>' +
            '</table>' +
          '</div>';

      } else {
        var cards = rows.map(function (x) {
          var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
          var icon = it && it.icon ? it.icon : '';
          var name = it && it.name ? it.name : (x.item_id != null ? ('Item #'+x.item_id) : (x.type || '—'));
          var rarity = it && it.rarity ? String(it.rarity) : null;
          var color = rarityColor(rarity);

          var cost = (x.cost || 0);
          var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : null;
          var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;

          var marks = st.marks || {};
          var marked = Number(marks[x.id] || 0);
          var purchasedEff = purchasedApi + marked;
          var leftVal = (limit == null) ? '∞' : GW2Api.wvComputeRemaining(limit, purchasedApi, marked);

          // ---- NUEVO: outline + halo por rareza (card + icon) ----
          var b1 = color ? hexToRGBA(color, 0.32) : null;  // borde interior
          var g1 = color ? hexToRGBA(color, 0.36) : null;  // glow exterior
          var cardDeco = (b1 && g1)
            ? ' style="border:1px solid '+b1+'; box-shadow: 0 0 0 1px '+b1+' inset, 0 0 14px '+g1+';"'
            : '';
          var iconDeco = (b1 && g1)
            ? ' style="box-shadow: 0 0 0 2px '+b1+', 0 0 10px '+g1+'; border-radius:6px;"'
            : '';

          var ctr = (limit == null)
            ? '<span class="wv-counter wv-counter--card wv-counter--disabled"><span class="muted">—</span></span>'
            : (
              '<span class="wv-counter wv-counter--card" data-id="'+x.id+'">' +
                '<button class="btn btn--ghost wv-dec" title="-">−</button>' +
                '<span class="muted" style="min-width:26px; display:inline-block; text-align:center;">'+marked+'</span>' +
                '<button class="btn btn--ghost wv-inc" title="+">+</button>' +
              '</span>'
            );

          var maxBtn = (limit != null && purchasedEff < limit)
            ? '<button class="btn btn--ghost wv-markall" data-id="'+x.id+'" title="Marcar todo (llenar hasta el máximo)">Max</button>'
            : '';

          var pinActive = !!(st.pinned && st.pinned[x.id]);
          var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
          var pinBtn = '<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';

          var rowStyle = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';

          return (
            '<div class="wv-card" data-id="'+x.id+'"'+cardDeco+'>' +
              '<div class="wv-card__top">' +
                '<div class="wv-card__iconWrap"'+iconDeco+'>' + (icon ? ('<img class="wv-card__icon" src="'+escapeHtml(icon)+'" alt="" loading="lazy"/>') : '') + '</div>' +
                '<div class="wv-card__name" title="'+escapeHtml(name)+'"'+(color?' style="color:'+color+'"':'')+'>'+escapeHtml(name)+'</div>' +
                pinBtn +
              '</div>' +
              '<div class="wv-card__meta">' +
                '<span class="wv-badge">Costo: <strong>'+cost+'</strong> AA</span>' +
                '<span class="wv-type">'+escapeHtml(x.type || '—')+'</span>' +
              '</div>' +
              '<div class="wv-card__body">' +
                '<div class="sep"></div>' +
                '<div class="wv-card__row" style="'+rowStyle+'"><span class="muted">Comprado:</span><span class="pill">'+purchasedEff+' / '+(limit==null?'∞':limit)+'</span></div>' +
                '<div class="wv-card__row" style="'+rowStyle+'"><span class="muted">Restante:</span><span class="pill">'+leftVal+'</span></div>' +
              '</div>' +
              '<div class="wv-card__bottom" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                '<span class="wv-id">ID '+x.id+'</span>' +
                '<span>'+ctr + (maxBtn ? ' ' + maxBtn : '') + '</span>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        area.innerHTML = '<div class="wv-card-grid">' + cards + '</div>';
      }

      // Wire contadores y pin
      $$('.wv-counter', area).forEach(function (host) {
        var id = host.getAttribute('data-id');
        var btnDec = $('.wv-dec', host), btnInc = $('.wv-inc', host);
        var spanVal = $('span.muted', host);
        var findRow = function(){ return state.shop.merged.find(function(x){ return String(x.id)===String(id); }); };
        var limitOf = function(row){ return (typeof row.purchase_limit === 'number') ? row.purchase_limit : null; };
        var purchasedApiOf = function(row){ return (typeof row.purchased === 'number') ? row.purchased : 0; };

        function refresh(val){ spanVal.textContent = String(val); renderShopArea(); }

        if (btnDec && !btnDec.__wired) {
          btnDec.__wired = true;
          btnDec.addEventListener('click', function(){
            var row = findRow(); if (!row) return;
            var marks = state.shop.marks || {};
            var cur = +marks[id] || 0;
            if (cur <= 0) return;
            cur -= 1; marks[id] = cur;
            state.shop.marks = marks;
            saveMarks(marksNamespace(), marks);
            refresh(cur);
          });
        }

        if (btnInc && !btnInc.__wired) {
          btnInc.__wired = true;
          btnInc.addEventListener('click', function(){
            var row = findRow(); if (!row) return;
            var marks = state.shop.marks || {};
            var cur = +marks[id] || 0;
            var lim = limitOf(row); // null => ilimitado
            var cap = (lim == null) ? Infinity : Math.max(0, lim - purchasedApiOf(row));
            if (cur >= cap) return;
            cur += 1; marks[id] = cur;
            state.shop.marks = marks;
            saveMarks(marksNamespace(), marks);
            refresh(cur);
          });
        }
      });

      // Wire botón MAX (Marcar todo)
      $$('.wv-markall', area).forEach(function (btn) {
        if (btn.__wired) return; btn.__wired = true;
        btn.addEventListener('click', function(){
          var id = btn.getAttribute('data-id');
          var row = state.shop.merged.find(function(x){ return String(x.id) === String(id); });
          if (!row) return;
          var limit = (typeof row.purchase_limit === 'number') ? row.purchase_limit : null;
          var purchasedApi = (typeof row.purchased === 'number') ? row.purchased : 0;
          if (limit == null) return; // ilimitado: no aplica
          var cap = Math.max(0, limit - purchasedApi);
          var marks = state.shop.marks || {};
          marks[id] = cap;
          state.shop.marks = marks;
          saveMarks(marksNamespace(), marks);
          renderShopArea();
        });
      });

      // Wire PIN
      $$('[data-pin]', area).forEach(function (btn) {
        if (btn.__wired) return; btn.__wired = true;
        btn.addEventListener('click', function(){
          var id = btn.getAttribute('data-pin');
          var pinned = state.shop.pinned || {};
          if (pinned[id]) { delete pinned[id]; }
          else { pinned[id] = true; }
          state.shop.pinned = pinned;
          savePinned(marksNamespace(), pinned);
          renderShopArea();
        });
      });
    }

    function ensureShopAutoRefresh(on) {
      var st = state.shop;
      if (on) {
        if (st.autoRefreshTimer) return;
        st.autoRefreshTimer = setInterval(function(){ refreshShopData(false); }, st.autoRefreshEveryMs);
      } else {
        if (st.autoRefreshTimer) { clearInterval(st.autoRefreshTimer); st.autoRefreshTimer = null; }
      }
    }

    // Retorna Promise para permitir .finally()
    function refreshShopData(forceNoCache) {
      var token = getSelectedToken();
      if (!token) {
        if (els.tabShop) els.tabShop.innerHTML = '<p class="muted">Seleccioná una API Key para ver la Tienda.</p>';
        return Promise.resolve();
      }
      state.shop.lastToken = token;

      return GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache })
        .then(function (pkg) {
          state.shop.merged    = pkg.rows || [];
          state.shop.itemsById = pkg.itemsById || new Map();
          state.shop.aa        = pkg.aa || 0;
          state.shop.aaIconUrl = pkg.aaIconUrl || null;
          state.shop.lastSyncTs = now();

          // Restaurar prefs
          state.shop.view = loadView();
          state.shop.legacyFilter = loadLegacyFilter();

          // Cargar marcas/pins por namespace
          var ns = marksNamespace();
          state.shop.marks  = loadMarks(ns);
          state.shop.pinned = loadPinned(ns);

          // Reconciliación suave (API vs marcas)
          (function(){
            var st = state.shop, marks = st.marks || {}, changed = false;
            (st.merged || []).forEach(function(row){
              var id = String(row.id);
              var limit = (typeof row.purchase_limit === 'number') ? row.purchase_limit : null;
              var purchasedApi = (typeof row.purchased === 'number') ? row.purchased : 0;
              var m = +marks[id] || 0;
              if (limit == null) return;
              if (purchasedApi >= limit && m) { delete marks[id]; changed = true; }
              else if (m > 0 && purchasedApi + m > limit) { marks[id] = Math.max(0, limit - purchasedApi); changed = true; }
            });
            if (changed) { st.marks = marks; saveMarks(marksNamespace(), marks); }
          })();

          try { if (typeof window !== 'undefined' && window.WV) window.WV.__debugRows = state.shop.merged.slice(); } catch(_){}

          renderShopArea();
        })
        .catch(function (e) {
          console.warn('[WV] refresh shop error:', e);
        });
    }

    function setActiveTab(tab) {
      state.lastTab = tab;
      saveLastTab(tab);

      var mapBtns = { daily: els.btnDaily, weekly: els.btnWeekly, special: els.btnSpecial, shop: els.btnShop };
      var mapTabs = { daily: els.tabDaily, weekly: els.tabWeekly, special: els.tabSpecial, shop: els.tabShop };

      Object.keys(mapBtns).forEach(function (k) { var b = mapBtns[k]; if (b) b.setAttribute('aria-selected', k===tab ? 'true' : 'false'); });
      Object.keys(mapTabs).forEach(function (k) { var p = mapTabs[k]; if (p) (k===tab ? show(p) : hide(p)); });

      ensureShopAutoRefresh(tab === 'shop');
    }

    function onTabClick(ev) {
      var btn = ev.currentTarget;
      var tab = btn && btn.getAttribute('data-tab');
      if (!tab) return;
      setActiveTab(tab);
      ensureLoadTab(tab);
    }

    function wireTabsOnce() {
      if (els.panel && els.panel.__tabsWired) return;
      if (els.btnDaily)   els.btnDaily.addEventListener('click', onTabClick);
      if (els.btnWeekly)  els.btnWeekly.addEventListener('click', onTabClick);
      if (els.btnSpecial) els.btnSpecial.addEventListener('click', onTabClick);
      if (els.btnShop)    els.btnShop.addEventListener('click', onTabClick);
      if (els.panel) els.panel.__tabsWired = true;
    }

    function ensureLoadTab(tab) {
      if (state.loaded[tab] && tab !== 'shop') return;
      var token = getSelectedToken();

      if (!state.loaded.__season) {
        GW2Api.getWVSeason({ nocache:false }).then(function (season) {
          state.shop.season = season;
          setWVSeasonHeader(season);
        }).catch(function(){});
        state.loaded.__season = true;
      }

      if (!token) {
        if (els.noteSync) els.noteSync.classList.remove('hidden');
        if (tab === 'daily')   els.tabDaily.innerHTML   = '<p class="muted">Seleccioná una API Key para ver objetivos diarios.</p>';
        if (tab === 'weekly')  els.tabWeekly.innerHTML  = '<p class="muted">Seleccioná una API Key para ver objetivos semanales.</p>';
        if (tab === 'special') els.tabSpecial.innerHTML = '<p class="muted">Seleccioná una API Key para ver objetivos especiales.</p>';
        if (tab === 'shop')    els.tabShop.innerHTML    = '<p class="muted">Seleccioná una API Key para ver la Tienda.</p>';
        return;
      } else {
        if (els.noteSync) els.noteSync.classList.add('hidden');
      }

      if (tab === 'daily') {
        els.tabDaily.innerHTML = '<p class="muted">Cargando…</p>';
        GW2Api.getWVDaily(token, { nocache:false }).then(function (data) {
          renderObjectivesTab(els.tabDaily, data);
          state.loaded.daily = true;
        }).catch(function (e) {
          els.tabDaily.innerHTML = '<p class="error">Error: '+(e&&e.message||'')+'</p>';
        });
      }

      if (tab === 'weekly') {
        els.tabWeekly.innerHTML = '<p class="muted">Cargando…</p>';
        GW2Api.getWVWeekly(token, { nocache:false }).then(function (data) {
          renderObjectivesTab(els.tabWeekly, data);
          state.loaded.weekly = true;
        }).catch(function (e) {
          els.tabWeekly.innerHTML = '<p class="error">Error: '+(e&&e.message||'')+'</p>';
        });
      }

      if (tab === 'special') {
        els.tabSpecial.innerHTML = '<p class="muted">Cargando…</p>';
        GW2Api.getWVSpecial(token, { nocache:false }).then(function (data) {
          renderObjectivesTab(els.tabSpecial, data);
          state.loaded.special = true;
        }).catch(function (e) {
          els.tabSpecial.innerHTML = '<p class="error">Error: '+(e&&e.message||'')+'</p>';
        });
      }

      if (tab === 'shop') {
        state.shop.view = loadView();
        state.shop.legacyFilter = loadLegacyFilter();
        ensureShopToolbar();

        var ns = marksNamespace();
        state.shop.marks  = loadMarks(ns);
        state.shop.pinned = loadPinned(ns);

        if (els.tabShop) els.tabShop.insertAdjacentHTML('beforeend', '<div class="muted">Cargando Tienda…</div>');
        return refreshShopData(false).finally(function(){ state.loaded.shop = true; });
      }
    }

    function activate() {
      if (!state.inited) {
        state.inited = true;
        wireTabsOnce();
        var last = loadLastTab();
        if (['daily','weekly','special','shop'].indexOf(last) === -1) last = 'daily';
        setActiveTab(last);
      }
      ensureLoadTab(state.lastTab || 'daily');
    }

    function deactivate() { ensureShopAutoRefresh(false); }

    function onVisibilityChange(hidden) {
      if (state.lastTab === 'shop') {
        if (hidden) {
          ensureShopAutoRefresh(false);
        } else {
          ensureShopAutoRefresh(true);
          refreshShopData(false);
        }
      }
    }

    function onTokenChanged(newToken) {
      var prev = state.shop.lastToken || null;
      state.shop.lastToken = newToken || null;
      if (state.lastTab === 'shop' && prev !== state.shop.lastToken) {
        state.loaded.shop = false;
        if (els.tabShop) els.tabShop.innerHTML = '';
        refreshShopData(true);
      }
    }

    // PUBLICAR WV PARA CONSOLA/DEBUG (y exponer hidratación de pastillas)
    var api = {
      activate: activate,
      setActiveTab: setActiveTab,
      ensureLoadTab: ensureLoadTab,
      deactivate: deactivate,
      onVisibilityChange: onVisibilityChange,
      onTokenChanged: onTokenChanged,
      hydrateModePills: function(scope){ hydrateWVModePills(scope || el('wvPanel')); },
      __debugRows: []
    };
    try { if (typeof window !== 'undefined') window.WV = api; } catch (_){}

    // Observer para re-hidratar si el panel cambia dinámicamente
    try {
      var wvPanel = els.panel || el('wvPanel');
      if (wvPanel && 'MutationObserver' in window) {
        var mo = new MutationObserver(function(muts){
          for (var i=0;i<muts.length;i++){
            if (muts[i].addedNodes && muts[i].addedNodes.length) { hydrateWVModePills(wvPanel); break; }
          }
        });
        mo.observe(wvPanel, { childList:true, subtree:true });
      }
    } catch (_obsErr) {}

    return api;
  })();

  // ----------------------------- ROUTER ------------------------------------
  function route() {
    var h = normHash(location.hash || '#/cards');

    if (h !== '#/account/wizards-vault' && WV && typeof WV.deactivate === 'function') {
      WV.deactivate();
    }

    if (h === '#/cards') {
      try { showPanel('walletPanel'); }
      catch (e) { console.warn('[router] show wallet error', e); }
      finally { updateSidebarFor('cards'); setActiveNav(h); }
      return;
    }

    if (h === '#/meta') {
      try {
        showPanel('metaPanel');
        document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view: 'meta' } }));
      } catch (e) { console.warn('[router] show meta error', e); }
      finally { updateSidebarFor('meta'); setActiveNav(h); }
      return;
    }

    if (h === '#/account/achievements') {
      try {
        showPanel('achievementsPanel');
        if (window.Achievements && typeof window.Achievements.render === 'function') {
          window.Achievements.render();
        }
      } catch (e) { console.warn('[router] show achievements error', e); }
      finally { updateSidebarFor('achievements'); setActiveNav(h); }
      return;
    }

    if (h === '#/account/wizards-vault') {
      try {
        showPanel('wvPanel');
        if (WV && typeof WV.activate === 'function') WV.activate();
        // por si el contenido ya estaba, hidratamos rápidamente
        hydrateWVModePills(el('wvPanel'));
      } catch (e) { console.error('[router] WV.activate error', e); }
      finally { updateSidebarFor('wv'); setActiveNav(h); }
      return;
    }

    try { showPanel('walletPanel'); }
    catch (e) { console.warn('[router] fallback show wallet error', e); }
    finally { updateSidebarFor('cards'); setActiveNav('#/cards'); }
  }

  function onKeySelectChange() {
    var h = normHash(location.hash || '#/cards');
    var token = getSelectedToken();

    try {
      if (h === '#/account/achievements') {
        if (window.Achievements && typeof window.Achievements.render === 'function') window.Achievements.render();
      } else if (h === '#/account/wizards-vault') {
        WV.onTokenChanged && WV.onTokenChanged(token);
        WV.ensureLoadTab && WV.ensureLoadTab('shop');
        WV.activate && WV.activate();
        hydrateWVModePills(el('wvPanel'));
      }
    } catch (e) {
      console.warn('[router] onKeySelectChange error', e);
    }
  }

  function onDomReady() {
    $$('.overlay-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (view === 'cards') location.hash = '#/cards';
        else if (view === 'meta') location.hash = '#/meta';
      });
    });

    var sel = el('keySelectGlobal');
    if (sel && !sel.__routerWired) {
      sel.__routerWired = true;
      sel.addEventListener('change', onKeySelectChange);
    }

    window.addEventListener('hashchange', route);

    document.addEventListener('visibilitychange', function(){
      if (WV && typeof WV.onVisibilityChange === 'function') {
        WV.onVisibilityChange(document.hidden);
      }
    });

    route();
    // Hidratación defensiva por si WV ya está visible al cargar
    hydrateWVModePills(el('wvPanel'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }

})();