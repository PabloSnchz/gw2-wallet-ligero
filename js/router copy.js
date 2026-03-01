/*!
 * Router y Vistas (WV Objetivos cards + Tienda con auto‑refresh + Pin)
 * v2.6.0 (2026‑02‑28) — listo para copiar/pegar
 * Requisitos: api-gw2.js (GW2Api) cargado antes
 */

(function () {
  'use strict';

  console.info('[WV] router.js v2.6.0 — objetivos cards + shop auto‑refresh + pin');

  // ------------------------------- Utils DOM -------------------------------
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var el = function (id) { return document.getElementById(id); };

  function show(node){ if (node) node.hidden = false; }
  function hide(node){ if (node) node.hidden = true; }

  // ---------------------- Sidebar: link activo por hash (robusto) --------------------
  function setActiveNav(hash) {
    try {
      // Normalizar hash actual
      var h = String(hash || location.hash || '#/cards')
        .trim().toLowerCase().replace(/\/+$/, '');
      if (!h || h === '#') h = '#/cards';

      // Seleccionar todos los links reales de la sidebar
      var links = Array.prototype.slice.call(
        document.querySelectorAll('.side-nav a, .side-nav__link')
      );
      if (!links.length) return;

      // Limpiar estado previo
      links.forEach(function (a) {
        a.classList.remove('is-active');
        a.removeAttribute('aria-current');
      });

      // Buscar candidato por href o data-hash (tolerante a trailing slash)
      function norm(s) { return String(s||'').toLowerCase().trim().replace(/\/+$/, ''); }
      var activeFound = false;
      links.forEach(function (a) {
        var href = norm(a.getAttribute('href'));
        var dh   = norm(a.getAttribute('data-hash'));
        if ((href && href === h) || (dh && dh === h)) {
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'page');
          activeFound = true;
        }
      });

      // Si no encontró por href, probá por data-view (fallback opcional)
      if (!activeFound) {
        var map = {
          '#/cards': 'cards',
          '#/meta': 'meta',
          '#/account/achievements': 'achievements',
          '#/account/wizards-vault': 'wv'
        };
        var dv = map[h];
        if (dv) {
          links.forEach(function (a) {
            if (a.getAttribute('data-view') === dv) {
              a.classList.add('is-active');
              a.setAttribute('aria-current', 'page');
            }
          });
        }
      }

      // Avisar a otros scripts para evitar que re‑pinten por su cuenta
      document.dispatchEvent(new CustomEvent('gn:nav-active', { detail: { hash: h } }));

      // Reparche tardío (por si otro script aplicó activo “tarde”)
      requestAnimationFrame(function () {
        // Repetimos una pasada rápida (idempotente)
        links.forEach(function (a) {
          var href = norm(a.getAttribute('href'));
          var dh   = norm(a.getAttribute('data-hash'));
          var shouldBeActive = (href && href === h) || (dh && dh === h);
          if (shouldBeActive) {
            a.classList.add('is-active');
            a.setAttribute('aria-current', 'page');
          } else {
            a.classList.remove('is-active');
            a.removeAttribute('aria-current');
          }
        });
      });

    } catch (e) {
      console.warn('[router] setActiveNav error', e);
    }
  }

  function showPanel(idToShow) {
    ['walletPanel', 'metaPanel', 'achievementsPanel', 'wvPanel'].forEach(function (id) {
      var node = el(id); if (!node) return;
      if (id === idToShow) node.removeAttribute('hidden'); else node.setAttribute('hidden', 'hidden');
    });
    // Tabs de hero (header)
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

  function escapeHtml(str) { return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

  function fmtNumber(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function now() { return Date.now(); }

  // -------------------------- Modo / Iconos (externos) ---------------------
  // Permitimos que el usuario setee rutas desde la wiki:
  // window.WV_MODE_ICONS = { pve:'https://…', pvp:'https://…', wvw:'https://…' }
  var MODE_ICONS = (window.WV_MODE_ICONS || {});

  function modeBadge(mode) {
    var k = String(mode || '').toLowerCase(); // pve|pvp|wvw
    var baseClass = 'wv-obj-mode wv-obj-mode--' + (k || 'pve');
    var url = MODE_ICONS[k];
    var label = (k === 'pvp') ? 'PvP' : (k === 'wvw' ? 'WvW' : 'PvE');
    if (url) {
      return '<span class="'+baseClass+'"><img src="'+escapeHtml(url)+'" alt="" loading="lazy"/>'+label+'</span>';
    }
    return '<span class="'+baseClass+'">'+label+'</span>';
  }

  // ------------------------------- WV State --------------------------------
  var WV = (function () {

    var els = {
      panel:    el('wvPanel'),
      noteSync: el('wvSyncNote'),

      // Tabs
      btnDaily:   el('wvTabBtnDaily'),
      btnWeekly:  el('wvTabBtnWeekly'),
      btnSpecial: el('wvTabBtnSpecial'),
      btnShop:    el('wvTabBtnShop'),

      tabDaily:   el('wvTabDaily'),
      tabWeekly:  el('wvTabWeekly'),
      tabSpecial: el('wvTabSpecial'),
      tabShop:    el('wvTabShop'),
      shopToolbarHost: el('wvShopToolbarHost'),

      // Temporada
      seasonTitle: el('wvSeasonTitle'),
      seasonDates: el('wvSeasonDates')
    };

    var state = {
      inited: false,
      lastTab: 'daily',
      loaded: { daily:false, weekly:false, special:false, shop:false },
      // Shop
      shop: {
        merged: [],
        itemsById: new Map(),
        aa: 0,
        aaIconUrl: null,
        lastSyncTs: 0,
        autoRefreshTimer: null,
        autoRefreshEveryMs: 75 * 1000, // 75s
        marks: {},    // { [listingId]: number }
        pinned: {},   // { [listingId]: true }
        // Filtros básicos (dejamos los avanzados para una iter posterior si querés)
        view: 'cards', // 'cards' | 'table'
        q: '',
        sort: 'name'   // 'name' | 'cost' | 'costDesc' | 'id'
      }
    };

    // -------------------------- Season header -----------------------------
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

    // ----------------------------- Helpers cache --------------------------
    function marksNamespace() {
      var token = getSelectedToken() || 'anon';
      var fp = token ? (token.slice(0,4) + '…' + token.slice(-4)) : 'anon';
      var st = state.shop; var seasonId = (st && st.season && (st.season.id || st.season.title)) || 'season';
      return fp + ':' + seasonId;
    }
    var LS_WV_SHOP_MARKS   = 'gw2_wv_marks_v1';
    var LS_WV_SHOP_PINNED  = 'gw2_wv_pinned_v1';
    var LS_WV_SHOP_VIEW    = 'gw2_wv_view_v1';
    var LS_WV_LAST_TAB     = 'gw2_wv_lasttab_v1';

    function loadMarks(ns) {
      try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}'); return all[ns] || {}; } catch (_){ return {}; }
    }
    function saveMarks(ns, marks) {
      try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}'); all[ns] = marks || {}; localStorage.setItem(LS_WV_SHOP_MARKS, JSON.stringify(all)); } catch (_){}
    }
    function loadPinned(ns) {
      try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_PINNED) || '{}'); return all[ns] || {}; } catch (_){ return {}; }
    }
    function savePinned(ns, pinned) {
      try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_PINNED) || '{}'); all[ns] = pinned || {}; localStorage.setItem(LS_WV_SHOP_PINNED, JSON.stringify(all)); } catch (_){}
    }
    function saveView(view) { try { localStorage.setItem(LS_WV_SHOP_VIEW, view); } catch(_){ } }
    function loadView() { try { return localStorage.getItem(LS_WV_SHOP_VIEW) || 'cards'; } catch(_){ return 'cards'; } }
    function saveLastTab(tab) { try { localStorage.setItem(LS_WV_LAST_TAB, tab); } catch(_){ } }
    function loadLastTab() { try { return localStorage.getItem(LS_WV_LAST_TAB) || 'daily'; } catch(_){ return 'daily'; } }

    // --------------------------- Objetivos (cards) -------------------------
    function normalizeObjectives(raw) {
      var arr = (raw && raw.objectives) || [];
      return arr.map(function (o) {
        var id = (o.id != null ? o.id : (o.objective_id != null ? o.objective_id : null));
        var title = o.title || o.name || ('Objetivo #' + id);
        var track = String(o.track || '').toLowerCase(); // pve|pvp|wvw|?
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

      // Grid de tarjetas
      var html = ['<div class="wv-obj-grid">'];

      // Meta global (si viene)
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
        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">',
                escapeHtml(o.title), 
              '</div>',
              modeBadge(o.track || 'pve'),
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
    }

    // ----------------------------- Tienda (Shop) ---------------------------
    function shopSyncLine() {
      var ts = state.shop.lastSyncTs;
      if (!ts) return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado: —</span></div>';
      var secs = Math.max(0, Math.floor((now() - ts)/1000));
      return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado hace '+secs+'s</span></div>';
    }

    function ensureShopToolbar() {
      if (!els.shopToolbarHost || els.shopToolbarHost.__wired) return;
      els.shopToolbarHost.__wired = true;
      els.shopToolbarHost.innerHTML = [
        '<div class="wv-shop-toolbar">',
          '<div class="group">',
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
          '</div>',
          shopSyncLine(),
          '<div id="wvShopHeader" class="muted" style="margin-top:4px">—</div>',
        '</div>'
      ].join('');
      // Wire
      var q = el('wvShopSearch');
      var s = el('wvShopSort');
      var v = el('wvShopToggleView');
      var r = el('wvShopRefresh');

      if (q) q.addEventListener('input', function(){ state.shop.q = (q.value||'').trim().toLowerCase(); renderShopArea(); });
      if (s) s.addEventListener('change', function(){ state.shop.sort = s.value; renderShopArea(); });
      if (v) v.addEventListener('click', function(){
        state.shop.view = (state.shop.view === 'cards') ? 'table' : 'cards';
        v.textContent = 'Vista: ' + (state.shop.view==='cards'?'Tarjetas':'Tabla');
        saveView(state.shop.view);
        renderShopArea();
      });
      if (r) r.addEventListener('click', function(){ refreshShopData(true/*nocache*/); });
    }

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

    function passSearchAndSort(list) {
      var q = (state.shop.q || '').toLowerCase();
      var sort = state.shop.sort || 'name';
      var itemsById = state.shop.itemsById || new Map();

      var filtered = (list||[]).filter(function (x) {
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

      // Pinned primero
      var pinned = state.shop.pinned || {};
      sorted.sort(function (a,b) {
        var pa = !!pinned[a.id], pb = !!pinned[b.id];
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;
        return 0;
      });

      return sorted;
    }

    function rarityClass(r) {
      if (!r) return '';
      var k = String(r).toLowerCase();
      if (k === 'junk') return 'rar-junk';
      if (k === 'basic') return 'rar-basic';
      if (k === 'fine') return 'rar-fine';
      if (k === 'masterwork') return 'rar-masterwork';
      if (k === 'rare') return 'rar-rare';
      if (k === 'exotic') return 'rar-exotic';
      if (k === 'ascended') return 'rar-ascended';
      if (k === 'legendary') return 'rar-legendary';
      return '';
    }

    function renderShopArea() {
      var host = els.tabShop; if (!host) return;
      ensureShopToolbar();

      // Sincronización (badge)
      var toolbar = els.shopToolbarHost && els.shopToolbarHost.querySelector('.wv-shop-toolbar');
      if (toolbar) {
        var line = toolbar.querySelector('.wv-syncline');
        if (line) line.outerHTML = shopSyncLine(); // reemplazo simple
      }

      // Números
      var st = state.shop;
      var sums = computeShopNumbers(st.merged);
      setShopHeader(st.aa, sums.spentApi, sums.reservedMarks, st.aaIconUrl);

      // Contenido
      var areaId = 'wvShopList';
      var area = host.querySelector('#'+areaId);
      if (!area) {
        area = document.createElement('div');
        area.id = areaId;
        host.appendChild(area);
      }

      var itemsById = st.itemsById || new Map();
      var rows = passSearchAndSort(st.merged).slice(0, 1200);

      if (st.view === 'table') {
        var trs = rows.map(function (x) {
          var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
          var icon = it && it.icon ? ('<img class="wv-item-icon" src="'+escapeHtml(it.icon)+'" alt="" loading="lazy"/> ') : '';
          var name = it && it.name ? it.name : (x.item_id != null ? ('Item #'+x.item_id) : (x.type || '—'));
          var qty  = (x.item_count && x.item_count>1) ? (' <span class="muted">×'+x.item_count+'</span>') : '';
          var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : '∞';
          var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;

          var marks = st.marks || {};
          var marked = Number(marks[x.id] || 0);
          var effectivePurchased = purchasedApi + marked;
          var left = (limit === '∞') ? '∞' : Math.max(0, limit - effectivePurchased);

          var rc = rarityClass(it && it.rarity);
          var nameHtml = '<span class="'+rc+'">'+escapeHtml(name)+'</span>';

          var pinActive = !!(st.pinned && st.pinned[x.id]);
          var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
          var pinBtn = '<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';

          var ctr = (limit === '∞')
            ? '<span class="wv-counter"><span class="muted" style="min-width:24px; display:inline-block; text-align:center;">—</span></span>'
            : (
                '<span class="wv-counter" data-id="'+x.id+'">' +
                '<button class="btn btn--ghost wv-dec" title="-">−</button>' +
                '<span class="muted" style="min-width:24px; display:inline-block; text-align:center;">'+marked+'</span>' +
                '<button class="btn btn--ghost wv-inc" title="+">+</button>' +
                '</span>'
              );

          return (
            '<tr>' +
              '<td class="nowrap">'+icon+nameHtml+qty+'</td>' +
              '<td>' + escapeHtml(x.type || '') + '</td>' +
              '<td class="right">' + (x.cost || 0) + '</td>' +
              '<td class="right">' + purchasedApi + ' / ' + limit + '</td>' +
              '<td class="right">' + left + '</td>' +
              '<td class="right">' + ctr + '</td>' +
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
        // Cards
        var cards = rows.map(function (x) {
          var it = (x.item_id != null) ? itemsById.get(x.item_id) : null;
          var icon = it && it.icon ? it.icon : '';
          var name = it && it.name ? it.name : (x.item_id != null ? ('Item #'+x.item_id) : (x.type || '—'));
          var rc = rarityClass(it && it.rarity);

          var cost = (x.cost || 0);
          var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : '∞';
          var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;

          var marks = st.marks || {};
          var marked = Number(marks[x.id] || 0);
          var effectivePurchased = purchasedApi + marked;
          var left = (limit === '∞') ? '∞' : Math.max(0, limit - effectivePurchased);

          var ctr = (limit === '∞')
            ? '<span class="wv-counter wv-counter--card wv-counter--disabled"><span class="muted">—</span></span>'
            : (
              '<span class="wv-counter wv-counter--card" data-id="'+x.id+'">' +
                '<button class="btn btn--ghost wv-dec" title="-">−</button>' +
                '<span class="muted" style="min-width:26px; display:inline-block; text-align:center;">'+marked+'</span>' +
                '<button class="btn btn--ghost wv-inc" title="+">+</button>' +
              '</span>'
            );

          var pinActive = !!(st.pinned && st.pinned[x.id]);
          var pinCls = 'wv-pin' + (pinActive ? ' wv-pin--active' : '');
          var pinBtn = '<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';

          return (
            '<div class="wv-card">' +
              '<div class="wv-card__top">' +
                '<div class="wv-card__iconWrap">' + (icon ? ('<img class="wv-card__icon" src="'+escapeHtml(icon)+'" alt="" loading="lazy"/>') : '') + '</div>' +
                '<div class="wv-card__name '+rc+'" title="'+escapeHtml(name)+'">'+escapeHtml(name)+'</div>' +
                pinBtn +
              '</div>' +
              '<div class="wv-card__meta">' +
                '<span class="wv-badge">Costo: <strong>'+cost+'</strong> AA</span>' +
                '<span class="wv-type">'+escapeHtml(x.type || '—')+'</span>' +
              '</div>' +
              '<div class="wv-card__body">' +
                '<div class="sep"></div>' +
                '<div class="wv-card__row"><span class="muted">Comprado:</span><span class="pill">'+purchasedApi+' / '+limit+'</span></div>' +
                '<div class="wv-card__row"><span class="muted">Restante:</span><span class="pill">'+left+'</span></div>' +
              '</div>' +
              '<div class="wv-card__bottom">' +
                '<span class="wv-id">ID '+x.id+'</span>' +
                ctr +
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
        var limitOf = function(row){ return (typeof row.purchase_limit === 'number') ? row.purchase_limit : Infinity; };
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
            var cap = Math.max(0, limitOf(row) - purchasedApiOf(row));
            if (cur >= cap) return;
            cur += 1; marks[id] = cur;
            state.shop.marks = marks;
            saveMarks(marksNamespace(), marks);
            refresh(cur);
          });
        }
      });

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
      // Activa/desactiva el polling liviano
      var st = state.shop;
      if (on) {
        if (st.autoRefreshTimer) return;
        st.autoRefreshTimer = setInterval(function(){ refreshShopData(false/*nocache*/); }, st.autoRefreshEveryMs);
      } else {
        if (st.autoRefreshTimer) { clearInterval(st.autoRefreshTimer); st.autoRefreshTimer = null; }
      }
    }

    function refreshShopData(forceNoCache) {
      var token = getSelectedToken();
      if (!token) {
        els.tabShop.innerHTML = '<p class="muted">Seleccioná una API Key para ver la Tienda.</p>';
        return;
      }
      // Pedimos listados por cuenta + AA y listados públicos (para tipos/ítems)
      Promise.allSettled([
        GW2Api.getAccountWVListings(token, { nocache: !!forceNoCache }),
        GW2Api.getWVAccount(token, { nocache: !!forceNoCache }),
        GW2Api.getWVListings({ nocache: !!forceNoCache })
      ]).then(function (arr) {
        var accShopRes = arr[0].status === 'fulfilled' ? (arr[0].value || []) : [];
        var wvAccRes   = arr[1].status === 'fulfilled' ? arr[1].value : null;
        var globalList = arr[2].status === 'fulfilled' ? (arr[2].value || []) : [];

        var mapGlobalById  = new Map(globalList.map(function (g) { return [g.id, g]; }));

        var merged = (accShopRes || []).map(function (acc) {
          var g = mapGlobalById.get(acc.id) || {};
          return {
            id: acc.id,
            item_id: g.item_id != null ? g.item_id : null,
            item_count: g.item_count != null ? g.item_count : null,
            type: g.type || null,
            cost: g.cost != null ? g.cost : null,
            purchased: acc.purchased != null ? acc.purchased : 0,
            purchase_limit: acc.purchase_limit != null ? acc.purchase_limit : null
          };
        });

        var itemIds = merged.map(function (m) { return m.item_id; }).filter(function (x) { return x != null; });
        return GW2Api.getItemsMany(Array.from(new Set(itemIds)), { nocache: !!forceNoCache })
          .then(function (items) {
            state.shop.merged = merged;
            state.shop.itemsById = GW2Api.__indexArrayByKey(items, 'id');
            state.shop.aa = (wvAccRes && typeof wvAccRes.astral_acclaim === 'number') ? wvAccRes.astral_acclaim : state.shop.aa;
            state.shop.aaIconUrl = (wvAccRes && wvAccRes.icon) ? wvAccRes.icon : state.shop.aaIconUrl;
            state.shop.lastSyncTs = now();

            // Cargar marks/pinned con namespace actualizado (si cambia de temporada)
            var ns = marksNamespace();
            state.shop.marks  = loadMarks(ns);
            state.shop.pinned = loadPinned(ns);

            renderShopArea();
          });
      }).catch(function (e) {
        console.warn('[WV] refresh shop error:', e);
      });
    }

    // --------------------------- Tabs wiring --------------------------------
    function setActiveTab(tab) {
      state.lastTab = tab;
      saveLastTab(tab);

      var mapBtns = {
        daily:   els.btnDaily,
        weekly:  els.btnWeekly,
        special: els.btnSpecial,
        shop:    els.btnShop
      };
      var mapTabs = {
        daily:   els.tabDaily,
        weekly:  els.tabWeekly,
        special: els.tabSpecial,
        shop:    els.tabShop
      };

      Object.keys(mapBtns).forEach(function (k) {
        var b = mapBtns[k]; if (!b) return;
        b.setAttribute('aria-selected', k===tab ? 'true' : 'false');
      });
      Object.keys(mapTabs).forEach(function (k) {
        var p = mapTabs[k]; if (!p) return;
        if (k===tab) show(p); else hide(p);
      });

      // Mostrar/ocultar auto‑refresh shop
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
      if (state.loaded[tab] && tab !== 'shop') return; // shop se refresca
      var token = getSelectedToken();

      // Temporada (una vez)
      if (!state.loaded.__season) {
        GW2Api.getWVSeason({ nocache:false }).then(function (season) {
          state.shop.season = season;
          setWVSeasonHeader(season);
        }).catch(function(){});
        state.loaded.__season = true;
      }

      if (!token) {
        if (els.noteSync) els.noteSync.classList.remove('hidden');
        // Mensaje neutro en cada panel
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
        // Preparar toolbar + espacio
        ensureShopToolbar();
        // Cargar marks/pinned según namespace actual (puede cambiar al cargar season)
        var ns = marksNamespace();
        state.shop.marks  = loadMarks(ns);
        state.shop.pinned = loadPinned(ns);
        // Vista preferida
        state.shop.view = loadView();

        els.tabShop.insertAdjacentHTML('beforeend', '<div class="muted">Cargando Tienda…</div>');
        refreshShopData(false /* nocache */).finally(function(){
          state.loaded.shop = true;
        });
      }
    }

    function activate() {
      if (!state.inited) {
        state.inited = true;
        wireTabsOnce();
        // Restaurar última sub‑pestaña
        var last = loadLastTab();
        if (['daily','weekly','special','shop'].indexOf(last) === -1) last = 'daily';
        setActiveTab(last);
      }
      ensureLoadTab(state.lastTab || 'daily');
    }

    return { activate: activate, setActiveTab: setActiveTab, ensureLoadTab: ensureLoadTab };
  })();

    // ----------------------------- ROUTER ------------------------------------
    function route() {
      var h = (location.hash || '').trim();

      if (h === '' || h === '#' || h === '#/' || h === '#/cards') {
        showPanel('walletPanel');

        el('asideConvSection') && el('asideConvSection').removeAttribute('hidden');
        el('asideNextFeatures') && el('asideNextFeatures').removeAttribute('hidden');
        var achAside = el('achAsidePanel'); if (achAside) achAside.setAttribute('hidden','hidden');
        var metaAside = el('metaAsideNext'); if (metaAside) metaAside.setAttribute('hidden','hidden');

        // ⬇️ aquí el cambio
        setActiveNav(location.hash || '#/cards');
        return;
      }

      if (h === '#/meta') {
        showPanel('metaPanel');

        el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
        el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
        var achAside2 = el('achAsidePanel'); if (achAside2) achAside2.setAttribute('hidden','hidden');
        var metaAside2 = el('metaAsideNext'); if (metaAside2) metaAside2.removeAttribute('hidden');

        // Avisar a módulo Meta (si escucha)
        document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view: 'meta' } }));

        // ⬇️ aquí el cambio
        setActiveNav(location.hash || '#/meta');
        return;
      }

      if (h === '#/account/achievements') {
        showPanel('achievementsPanel');

        el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
        el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
        var metaAside3 = el('metaAsideNext'); if (metaAside3) metaAside3.setAttribute('hidden','hidden');
        var achAside3 = el('achAsidePanel'); if (achAside3) achAside3.removeAttribute('hidden');

        if (window.Achievements && typeof window.Achievements.render === 'function') {
          window.Achievements.render();
        }

        // ⬇️ aquí el cambio
        setActiveNav(location.hash || '#/account/achievements');
        return;
      }

      if (h === '#/account/wizards-vault') {
        showPanel('wvPanel');
        WV.activate();

        el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
        el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
        var achAside4 = el('achAsidePanel'); if (achAside4) achAside4.setAttribute('hidden','hidden');
        var metaAside4 = el('metaAsideNext'); if (metaAside4) metaAside4.setAttribute('hidden','hidden');

        // ⬇️ aquí el cambio
        setActiveNav(location.hash || '#/account/wizards-vault');
        return;
      }

      // Fallback
      showPanel('walletPanel');
      // ⬇️ aquí el cambio
      setActiveNav(location.hash || '#/cards');
    }

  function onKeySelectChange() {
    var h = (location.hash || '');
    if (h === '#/account/achievements') {
      if (window.Achievements && typeof window.Achievements.render === 'function') window.Achievements.render();
    } else if (h === '#/account/wizards-vault') {
      WV.ensureLoadTab && WV.ensureLoadTab('shop'); // refrescá tienda con la nueva key
      WV.activate && WV.activate();
    }
    // Meta escucha gn:tokenchange desde app.js (si aplica)
  }

  function onDomReady() {
    // Hero tabs del header
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
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }

})();