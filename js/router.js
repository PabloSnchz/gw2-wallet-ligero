/*!
 * Router y Vistas (WV Objetivos + Tienda unificada)
 * v2.21.0 (2026-10-25) — BL-070 ACT-7b: Actividades ya no usa js/activities.js
 *
 * Cambios de BL-070 (el detalle de cada paso está en ai-memory/status.md):
 *  - 2.21.0 (ACT-7b): js/activities.js se retiró: el módulo viejo no se precarga, activa ni desactiva;
 *    #activitiesPanel vive en index.html y lo dibuja js/act-view.js (escucha gn:tokenchange solo).
 *  - 2.20.0 (ACT-5): ruta #/account/homestead y #homesteadPanel (js/home-view.js, BL-055).
 *  - 2.19.1 (INV-7b): MODULOS_CON_LATCH y showPanel ya no nombran a InventoryHub ni a sus 2 paneles.
 *  - 2.19.0 (INV-7a): #/account/characters es la vista nueva (js/inv-*.js); #/inventory/dashboard
 *    abre la pestaña Multicuenta; cambiar de cuenta ya no refresca los módulos viejos.
 *  - 2.18.2 (RAI-6) y 2.18.1 (RAI-5b): sin StrikeTracker; #/account/strikes muestra Raids.
 *
 * Antes, v2.18.0 — Sin la copia vieja de la Tienda (BL-064 CAM-6)
 *
 * Cambios v2.18.0:
 *  - Se fue la Tienda de respaldo (barra, tarjetas, tabla, campo numérico y sus marcas):
 *    la pinta js/wv-shop-ui.js desde la 2.0.0 (CAM-3) y siempre está cargada.
 *    ensureShopToolbar, syncShopToggleLabel y renderShopArea quedan como pasamanos.
 *
 * Cambios v2.17.0: Soporte Strike Tracker + F5 fix + skeleton ampliado
 * Antes: v2.13.0 a v2.16.0 (historia en git).
 */

(function () {
  'use strict';

  console.info('[WV] router-wv.js v2.19.0 — Fases 1-3 completas + fixes');

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

  var RARITY_COLORS = {
    'junk': '#AAAAAA', 'basic': '#FFFFFF', 'fine': '#62A4DA',
    'masterwork': '#1A9306', 'rare': '#FCD00B', 'exotic': '#FFA405',
    'ascended': '#FB3E8D', 'legendary': '#974EFF'
  };
  function rarityColor(r) { return r ? (RARITY_COLORS[String(r).toLowerCase()] || null) : null; }

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function(c){return c+c;}).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      var a = Number.isFinite(+alpha) ? Math.max(0, Math.min(1, +alpha)) : 1;
      return 'rgba('+r+','+g+','+b+','+a+')';
    } catch { return null; }
  }
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function fmtNumber(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function now() { return Date.now(); }

  function hydrateWVModePills(scope) {
    try {
      var ICONS = (window.WV_MODE_ICONS || {});
      if (!ICONS || typeof ICONS !== 'object') return;
      var root = scope || document;
      var nodes = root.querySelectorAll('.wv-obj-mode, .wv-mode-pill, [data-wv-mode], [data-mode]');
      if (!nodes || !nodes.length) return;
      Array.prototype.forEach.call(nodes, function (node) {
        try {
          if (!node || node.__wvIconHydrated) return;
          var raw = (node.getAttribute('data-wv-mode') || node.getAttribute('data-mode') || (node.textContent || '')).trim().toLowerCase();
          var mode = (raw === 'pvp' || raw === 'pve' || raw === 'wvw') ? raw : (raw.indexOf('pvp')>=0?'pvp':(raw.indexOf('wvw')>=0?'wvw':'pve'));
          var url = ICONS[mode]; if (!url) return;
          if (node.querySelector('img')) { node.__wvIconHydrated = true; return; }
          node.textContent = '';
          var img = document.createElement('img');
          img.src = url; img.alt = mode.toUpperCase(); img.width = 16; img.height = 16;
          img.decoding = 'async'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.className = 'wv-mode-pill__img';
          node.appendChild(img);
          node.setAttribute('data-mode', mode);
          node.classList.add('wv-mode-pill--hydrated');
          node.__wvIconHydrated = true;
        } catch {}
      });
    } catch {}
  }

  function setActiveNav(hash) {
    try {
      var h = normHash(hash || location.hash || '#/cards');
      var links = Array.prototype.slice.call(document.querySelectorAll('.side-nav a, .side-nav__link'));
      if (!links.length) return;
      links.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      var found = null, norm = function (s) { return normHash(s); };
      for (var i = 0; i < links.length; i++) {
        var a = links[i], href = a.getAttribute('href'), dh = a.getAttribute('data-hash');
        if ((href && norm(href)===h) || (dh && norm(dh)===h)) { found = a; break; }
      }
      if (!found) {
        var map = {
          '#/cards':'cards',
          '#/meta':'meta',
          '#/account/achievements':'achievements',
          '#/account/wizards-vault':'wv',
          '#/activities':'activities',
          '#/account/homestead':'homestead',
          '#/account/characters':'inventory',
          '#/account/accounts':'accounts',
          '#/welcome':'welcome',
          '#/wallet/dashboard':'walletDashboard',
          '#/inventory/dashboard':'inventoryDashboard',
          '#/account/raids':'raids',
          '#/account/strikes':'strikes',
          '#/account/legendary-armory':'legendaryArmory'
        };
        var dv = map[h]; if (dv) found = links.find(function (a) { return (a.getAttribute('data-view')||'').trim().toLowerCase()===dv; }) || null;
      }
      if (found) { found.classList.add('is-active'); found.setAttribute('aria-current','page'); }
      document.dispatchEvent(new CustomEvent('gn:nav-active', { detail: { hash: h, link: found } }));
    } catch (e) { console.warn('[router] setActiveNav error', e); }
  }

  function updateSidebarFor(view) {
    try {
      var next=el('asideNextFeatures'), metaNext=el('metaAsideNext'), ach=el('achAsidePanel');
      if (next) next.hidden = true; if (metaNext) metaNext.hidden = true; if (ach) ach.hidden = true;
      if (view==='cards'){ if (next) next.hidden=false; }
      else if (view==='meta'){ if (metaNext) metaNext.hidden=false; }
      else if (view==='achievements'){ if (ach) ach.hidden=false; }
      else if (view==='accounts'){ /* no sidebar específico por ahora */ }
      else if (view==='welcome'){ /* no sidebar específico para bienvenida */ }
      else if (view==='walletDashboard'){ /* no sidebar específico */ }
      else if (view==='raids'){ /* no sidebar específico para raids */ }
      else if (view==='legendaryArmory'){ /* no sidebar específico para arm. legendaria */ }
      else if (view==='inventory'){ /* no sidebar específico para inventario */ }
      else if (view==='inventoryDashboard'){ /* no sidebar específico */ }
    } catch (e) { console.warn('[router] updateSidebarFor error', e); }
  }

  function showPanel(idToShow) {
    ['walletPanel','metaPanel','achievementsPanel','wvPanel','activitiesPanel','homesteadPanel','inventoryPanel','accountsPanel','welcomePanel','walletDashboardPanel','wvObjectivesDashboardPanel','raidTrackerPanel','legendaryArmoryPanel'].forEach(function(id){
      var node=el(id); if (!node) return;
      if (id===idToShow) node.removeAttribute('hidden'); else node.setAttribute('hidden','hidden');
    });
    $$('.overlay-tab').forEach(function(btn){
      var view = btn.getAttribute('data-view');
      var active = (idToShow==='walletPanel' && view==='cards') || (idToShow==='metaPanel' && view==='meta');
      btn.classList.toggle('overlay-tab--active', active);
      btn.setAttribute('aria-selected', active?'true':'false');
    });
  }

  function getSelectedToken(){ var sel=el('keySelectGlobal'); var tok=sel?(sel.value||'').trim():null; return tok||null; }

  // ------------------------------- WV State --------------------------------
  var WV = (function(){
    var els = {
      panel: el('wvPanel'), noteSync: el('wvSyncNote'),
      btnDaily: el('wvTabBtnDaily'), btnWeekly: el('wvTabBtnWeekly'),
      btnSpecial: el('wvTabBtnSpecial'), btnShop: el('wvTabBtnShop'),
      tabDaily: el('wvTabDaily'), tabWeekly: el('wvTabWeekly'), tabSpecial: el('wvTabSpecial'), tabShop: el('wvTabShop'),
      shopToolbarHost: el('wvShopToolbarHost'),
      seasonTitle: el('wvSeasonTitle'), seasonDates: el('wvSeasonDates')
    };

    var state = {
      inited:false, lastTab:'daily',
      loaded:{ daily:false, weekly:false, special:false, shop:false, __season:false },
      shop:{
        merged:[], itemsById:new Map(), aa:0, aaIconUrl:null,
        lastSyncTs:0, autoRefreshTimer:null, autoRefreshEveryMs:75*1000,
        marks:{}, pinned:{}, view:'cards', q:'', sort:'name', legacyFilter:'show', lastToken:null, season:null
      },
      obj:{ daily:null, weekly:null, special:null },
      resetTimers:{ daily:null, weekly:null, special:null },
      skipObjFetchOnce: false,
      _active:false
    };

    var _objFetchSeq = 0;
    var _shopInFlight = null;

    var LS_WV_SHOP_VIEW=Storage.STORAGE_KEYS.WV_SHOP_VIEW,
        LS_WV_LAST_TAB=Storage.STORAGE_KEYS.WV_LAST_TAB, LS_WV_LEGACY_VIS=Storage.STORAGE_KEYS.WV_SHOP_LEGACY_FILTER;

    var lastSS = null;

    function marksNamespace(){
      var token=getSelectedToken()||'anon', fp=token?(token.slice(0,4)+'…'+token.slice(-4)):'anon';
      var st=state.shop, seasonId=(st && st.season && (st.season.id || st.season.title)) || 'season';
      return fp+':'+seasonId;
    }
    function parseNs(ns){ return String(ns||'').split(':')[0]||'anon'; }

    function loadMarks(ns){
      try{ if (!window.WVSeasonStore || !lastSS) return {};
           var fp = parseNs(ns);
           return WVSeasonStore.getMarks(lastSS.year, lastSS.seq, fp) || {}; }catch(_){ return {}; }
    }
    function saveMarks(ns,m){
      try{ if (!window.WVSeasonStore || !lastSS) return Promise.resolve();
           var fp = parseNs(ns);
           return WVSeasonStore.setMarks(lastSS.year, lastSS.seq, fp, m||{}); }catch(_){ return Promise.resolve(); }
    }
    function loadPinned(ns){
      try{ if (!window.WVSeasonStore || !lastSS) return {};
           var fp = parseNs(ns);
           return WVSeasonStore.getPinned(lastSS.year, lastSS.seq, fp) || {}; }catch(_){ return {}; }
    }
    function setPinnedPatch(fp, patchObj){
      try{ if (!window.WVSeasonStore || !lastSS) return Promise.resolve();
           return WVSeasonStore.setPinned(lastSS.year, lastSS.seq, fp, patchObj||{}); }catch(_){ return Promise.resolve(); }
    }
    function delPinnedIds(fp, ids){
      try{ if (!window.WVSeasonStore || !lastSS) return Promise.resolve();
           return WVSeasonStore.delPinned(lastSS.year, lastSS.seq, fp, ids||[]); }catch(_){ return Promise.resolve(); }
    }

    var __marksTimers = new Map();
    var __marksBuffers = new Map();

    function saveMarksBatched(fp, patch, onError){
      var buf = __marksBuffers.get(fp) || {};
      Object.assign(buf, patch||{});
      __marksBuffers.set(fp, buf);

      if (__marksTimers.has(fp)) return;

      var ns = marksNamespace();
      var t = setTimeout(async function(){
        __marksTimers.delete(fp);
        var payload = __marksBuffers.get(fp) || {};
        __marksBuffers.delete(fp);
        try {
          await saveMarks(ns, payload);
        } catch(e){
          try { window.toast?.('error','No se pudo guardar marcas (espacio de almacenamiento)',{ttl:1800}); } catch(_){}
          try { refreshShopData(false); } catch(_){}
          if (typeof onError === 'function') { try { onError(e); } catch(_){ } }
        }
      }, 120);
      __marksTimers.set(fp, t);
    }

    function loadView(){ try{ return Storage.get(LS_WV_SHOP_VIEW)||'cards'; }catch(_){ return 'cards'; } }
    function saveLastTab(t){ try{ Storage.set(LS_WV_LAST_TAB,t); }catch(_){ } }
    function loadLastTab(){ try{ return Storage.get(LS_WV_LAST_TAB)||'daily'; }catch(_){ return 'daily'; } }
    function loadLegacyFilter(){ try{ return Storage.get(LS_WV_LEGACY_VIS)||'show'; }catch(_){ return 'show'; } }

    function setWVSeasonHeader(season){
      if (!season) return;
      if (els.seasonTitle) els.seasonTitle.textContent = season.title || '—';
      if (els.seasonDates) {
        if (season.start && season.end) {
          var start=new Date(season.start), end=new Date(season.end);
          els.seasonDates.textContent = start.toLocaleDateString()+' → '+end.toLocaleDateString();
        } else els.seasonDates.textContent='—';
      }
    }

    function skShopCards(n){
      var html = ['<div class="wv-sk-grid">'];
      for (var i=0;i<n;i++){
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
    function skShopTable(n){
      var html = ['<div class="wv-sk-table">'];
      for (var i=0;i<n;i++){
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

    function setShopLoading(on, msg){
      var host = els.tabShop; if (!host) return;
      var node = host.querySelector('#wvShopLoading');
      if (on) {
        if (!node){
          node = document.createElement('div');
          node.id = 'wvShopLoading';
          node.className = 'muted';
          var afterToolbar = host.querySelector('.wv-shop-toolbar');
          if (afterToolbar && afterToolbar.parentElement === els.shopToolbarHost) {
            els.shopToolbarHost.insertAdjacentElement('afterend', node);
          } else {
            host.prepend(node);
          }
        }
        var viewPref = state.shop.view || loadView() || 'cards';
        var body = (viewPref === 'table') ? skShopTable(30) : skShopCards(24);
        node.innerHTML = '<div style="margin:6px 0 10px 0">'+escapeHtml(String(msg||'Cargando Tienda…'))+'</div>' + body;
        node.hidden = false;
      } else {
        if (node) node.hidden = true;
      }
    }

    function normalizeObjectives(raw){
      var arr=(raw && raw.objectives)||[];
      return arr.map(function(o){
        var id=(o.id!=null?o.id:(o.objective_id!=null?o.objective_id:null));
        var title=o.title||o.name||('Objetivo #'+id);
        var track=String(o.track||'').toLowerCase();
        var progress=(o.progress_current!=null?o.progress_current:(o.progress!=null?o.progress:0));
        var total=(o.progress_complete!=null?o.progress_complete:(o.total!=null?o.total:0));
        var acclaim=(o.acclaim!=null?o.acclaim:(o.rewardAA!=null?o.rewardAA:(o.reward_aa!=null?o.reward_aa:0)));
        var claimed=!!o.claimed;
        var pct=(total>0?Math.max(0,Math.min(100,Math.round((progress/total)*100))):(progress?100:0));
        return { id:id, title:title, track:track, progress:progress, total:total, acclaim:acclaim, claimed:claimed, pct:pct };
      });
    }

    // NUEVO FASE 3: Delegar a wv-objectives-ui.js si está disponible
    function renderObjectivesTab(host, data, kind){
      if (window.WVObjectivesUI) {
        WVObjectivesUI.renderTab(host, data, kind);
        return;
      }
      // Fallback: código original
      if (!host) return;
      if (!data || !Array.isArray(data.objectives)) {
        host.innerHTML='<p class="muted">Sin objetivos para mostrar.</p>';
        if (kind) state.obj[kind] = [];
        return;
      }

      var list=normalizeObjectives(data);
      if (kind) state.obj[kind] = list;

      var html=['<div class="wv-obj-grid">'];

      if (typeof data.meta_progress_current==='number' && typeof data.meta_progress_complete==='number'){
        var metaPct=(data.meta_progress_complete>0)?Math.max(0,Math.min(100,Math.round((data.meta_progress_current/data.meta_progress_complete)*100))):0;
        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">Meta de la temporada</div>',
              (data.meta_reward_astral?('<span class="aa-badge">+'+fmtNumber(data.meta_reward_astral)+' AA</span>'):''),
            '</div>',
            '<div class="wv-obj-prog">',
              '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:'+metaPct+'%;"></div></div>',
              '<div class="wv-obj-stats"><span>'+fmtNumber(data.meta_progress_current)+' / '+fmtNumber(data.meta_progress_complete)+'</span><span>'+metaPct+'%</span></div>',
            '</div>',
          '</div>'
        );
      }

      list.forEach(function(o){
        var statusClass=o.claimed?'':(o.pct>=100?'':' wv-obj-status--pending');
        var statusText=o.claimed?'✅ Reclamado':(o.pct>=100?'✔️ Completado':'… En progreso');
        var pillText=(o.track||'pve').toUpperCase();
        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">'+ escapeHtml(o.title) +'</div>',
              '<span class="wv-obj-mode" data-wv-mode="'+escapeHtml(o.track||'pve')+'">'+pillText+'</span>',
            '</div>',
            '<div class="wv-obj-meta">',
              '<span class="wv-obj-reward">'+ (o.acclaim?('+'+fmtNumber(o.acclaim)+' AA'):'') +'</span>',
              '<span class="wv-obj-status'+statusClass+'">'+ statusText +'</span>',
            '</div>',
            '<div class="wv-obj-prog">',
              '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:'+o.pct+'%;"></div></div>',
              '<div class="wv-obj-stats"><span>'+ (o.total?(fmtNumber(o.progress)+' / '+fmtNumber(o.total)):fmtNumber(o.progress)) +'</span><span>'+o.pct+'%</span></div>',
            '</div>',
          '</div>'
        );
      });

      html.push('</div>');
      host.innerHTML = html.join('');
      hydrateWVModePills(host);
    }

    // NUEVO FASE 3: Delegar a wv-objectives-ui.js si está disponible
    function renderObjectivesZero(kind){
      if (window.WVObjectivesUI) {
        WVObjectivesUI.renderZero(kind);
        return;
      }
      // Fallback: código original
      var host = (kind==='daily')   ? els.tabDaily
               : (kind==='weekly')  ? els.tabWeekly
               : (kind==='special') ? els.tabSpecial : null;
      if (!host) return;

      var list = Array.isArray(state.obj[kind]) ? state.obj[kind] : [];
      if (!list.length){
        host.innerHTML = '<p class="muted">Reseteado — esperando nuevo progreso…</p>';
        return;
      }
      var html=['<div class="wv-obj-grid">'];
      list.forEach(function(o){
        var pillText=(o.track||'pve').toUpperCase();
        html.push(
          '<div class="wv-obj-card">',
            '<div class="wv-obj-head">',
              '<div class="wv-obj-title">'+ escapeHtml(o.title) +'</div>',
              '<span class="wv-obj-mode" data-wv-mode="'+escapeHtml(o.track||'pve')+'">'+pillText+'</span>',
            '</div>',
            '<div class="wv-obj-meta">',
              '<span class="wv-obj-reward">'+ (o.acclaim?('+'+fmtNumber(o.acclaim)+' AA'):'') +'</span>',
              '<span class="wv-obj-status wv-obj-status--pending">… En progreso</span>',
            '</div>',
            '<div class="wv-obj-prog">',
              '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:0%;"></div></div>',
              '<div class="wv-obj-stats"><span>0'+ (o.total?(' / '+fmtNumber(o.total)):'') +'</span><span>0%</span></div>',
            '</div>',
          '</div>'
        );
      });
      html.push('</div>');
      host.innerHTML = html.join('');
      hydrateWVModePills(host);
    }

    function ensureShopHost(){
      if (!els.shopToolbarHost || !els.shopToolbarHost.isConnected) {
        els.shopToolbarHost = document.getElementById('wvShopToolbarHost');
        if (!els.shopToolbarHost) {
          els.shopToolbarHost = document.createElement('div');
          els.shopToolbarHost.id = 'wvShopToolbarHost';
          if (els.tabShop) els.tabShop.prepend(els.shopToolbarHost);
        }
        els.shopToolbarHost.__wired = false;
      }
      return els.shopToolbarHost;
    }

    // La Tienda la pinta js/wv-shop-ui.js (BL-064 CAM-3). La copia de respaldo que vivía acá
    // (barra, tarjetas, tabla y campo numérico) se fue en CAM-6: quedan los pasamanos.
    function syncShopToggleLabel(){ if (window.WVShopUI && WVShopUI.syncShopToggleLabel) WVShopUI.syncShopToggleLabel(); }
    function ensureShopToolbar(){ if (window.WVShopUI && WVShopUI.ensureShopToolbar) WVShopUI.ensureShopToolbar(); }
    function renderShopArea(){ if (window.WVShopUI) WVShopUI.render(); }

    function ensureShopAutoRefresh(on){
      var st=state.shop;
      if (on){ if (st.autoRefreshTimer) return; st.autoRefreshTimer=setInterval(function(){ refreshShopData(false); }, st.autoRefreshEveryMs); }
      else { if (st.autoRefreshTimer){ clearInterval(st.autoRefreshTimer); st.autoRefreshTimer=null; } }
    }

    function refreshShopData(forceNoCache){
      var token=getSelectedToken();
      if (!token){ if (els.tabShop) els.tabShop.innerHTML='<p class="muted">Seleccioná una API Key para ver la Tienda.</p>'; return Promise.resolve(); }
      state.shop.lastToken=token;

      if (_shopInFlight) return _shopInFlight;

      setShopLoading(true, 'Cargando Tienda…');

      var ensureSeason = Promise.resolve().then(function(){
        if (!state.shop.season) {
          return GW2Api.getWVSeason({ nocache:false })
            .then(function(season){ state.shop.season=season; setWVSeasonHeader(season); });
        }
      }).then(function(){
        if (window.WVSeasonStore && typeof WVSeasonStore.getCurrentSeasonInfo==='function'){
          return WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss && typeof ss.year==='number') lastSS={year:ss.year,seq:ss.seq}; });
        }
      });

      _shopInFlight = ensureSeason.then(function(){
        return GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache });
      }).then(function(pkg){
        state.shop.merged=pkg.rows||[]; state.shop.itemsById=pkg.itemsById||new Map();
        state.shop.aa=pkg.aa||0; state.shop.aaIconUrl=pkg.aaIconUrl||null; state.shop.lastSyncTs=now();
        state.shop.view=loadView(); state.shop.legacyFilter=loadLegacyFilter();

        var ns=marksNamespace();
        state.shop.marks=loadMarks(ns);
        state.shop.pinned=loadPinned(ns);

        (function(){
          var st=state.shop, marks=st.marks||{}, changed=false;
          (st.merged||[]).forEach(function(row){
            var id=String(row.id), limit=(typeof row.purchase_limit==='number')?row.purchase_limit:null, purchasedApi=(typeof row.purchased==='number')?row.purchased:0, m=+marks[id]||0;
            if (limit==null) return;
            if (purchasedApi>=limit && m){ delete marks[id]; changed=true; }
            else if (m>0 && purchasedApi+m>limit){ marks[id]=Math.max(0, limit - purchasedApi); changed=true; }
          });
          if (changed){ st.marks=marks; saveMarks(ns, marks); }
        })();

        // FIX: Si WVShopUI está disponible, delegar renderizado; si no, usar fallback
        if (window.WVShopUI) {
          WVShopUI.ensureShopToolbar();
          WVShopUI.render();
        } else {
          renderShopArea();
        }
      }).catch(function(e){
        console.warn('[WV] refresh shop error:', e);
        setShopLoading(false);
        window.toast?.('error','No se pudo cargar Tienda',{ ttl: 2000 });
      }).finally(function(){
        _shopInFlight = null;
      });

      return _shopInFlight;
    }

    function refreshObjectives(forceNoCache){
      const mySeq = ++_objFetchSeq;
      var token=getSelectedToken();
      if (!token){
        if (els.tabDaily)   els.tabDaily.innerHTML   = '<p class="muted">Seleccioná una API Key para ver objetivos diarios.</p>';
        if (els.tabWeekly)  els.tabWeekly.innerHTML  = '<p class="muted">Seleccioná una API Key para ver objetivos semanales.</p>';
        if (els.tabSpecial) els.tabSpecial.innerHTML = '<p class="muted">Seleccioná una API Key para ver objetivos especiales.</p>';
        return;
      }
      if (els.noteSync) els.noteSync.classList.add('hidden');

      if (els.tabDaily)   els.tabDaily.innerHTML   = '<p class="muted">Cargando…</p>';
      if (els.tabWeekly)  els.tabWeekly.innerHTML  = '<p class="muted">Cargando…</p>';
      if (els.tabSpecial) els.tabSpecial.innerHTML = '<p class="muted">Cargando…</p>';

      Promise.allSettled([
        GW2Api.getWVDaily(token,   { nocache: !!forceNoCache }),
        GW2Api.getWVWeekly(token,  { nocache: !!forceNoCache }),
        GW2Api.getWVSpecial(token, { nocache: !!forceNoCache })
      ]).then(function(res){
        if (mySeq !== _objFetchSeq) return;

        var rDaily   = res[0] && res[0].status==='fulfilled'   ? res[0].value   : null;
        var rWeekly  = res[1] && res[1].status==='fulfilled'   ? res[1].value   : null;
        var rSpecial = res[2] && res[2].status==='fulfilled'   ? res[2].value   : null;

        if (els.tabDaily)   (rDaily ? renderObjectivesTab(els.tabDaily,   rDaily,  'daily')  : els.tabDaily.innerHTML   = '<p class="error">Error al cargar diarios.</p>');
        if (els.tabWeekly)  (rWeekly ? renderObjectivesTab(els.tabWeekly,  rWeekly, 'weekly') : els.tabWeekly.innerHTML  = '<p class="error">Error al cargar semanales.</p>');
        if (els.tabSpecial) (rSpecial ? renderObjectivesTab(els.tabSpecial, rSpecial,'special'): els.tabSpecial.innerHTML = '<p class="error">Error al cargar especiales.</p>');

        if (rDaily)   state.loaded.daily   = true;
        if (rWeekly)  state.loaded.weekly  = true;
        if (rSpecial) state.loaded.special = true;
      }).catch(function(e){
        if (mySeq !== _objFetchSeq) return;
        console.warn('[WV] refresh objectives error:', e);
      });
    }

    function setActiveTab(tab){
      state.lastTab=tab; saveLastTab(tab);
      var mapBtns={daily:els.btnDaily,weekly:els.btnWeekly,special:els.btnSpecial,shop:els.btnShop};
      var mapTabs={daily:els.tabDaily,weekly:els.tabWeekly,special:els.tabSpecial,shop:els.tabShop};
      Object.keys(mapBtns).forEach(function(k){ var b=mapBtns[k]; if (b) b.setAttribute('aria-selected', k===tab?'true':'false'); });
      Object.keys(mapTabs).forEach(function(k){ var p=mapTabs[k]; if (p) (k===tab ? show(p) : hide(p)); });
      ensureShopAutoRefresh(tab==='shop');
      
      // Dashboard y Sincronizar visibles solo en Diarias/Semanales/Especiales
      // Purchase Detail visible solo en Tienda
      var dashBtn = document.getElementById('wvTabBtnObjDashboard');
      var pdBtn = document.getElementById('wvTabBtnPurchaseDetail');
      var syncBtn = document.getElementById('wvTabBtnSyncObjectives');
      if (dashBtn) {
        dashBtn.hidden = (tab !== 'daily' && tab !== 'weekly' && tab !== 'special');
      }
      if (pdBtn) {
        pdBtn.hidden = (tab !== 'shop');
      }
      if (syncBtn) {
        syncBtn.hidden = (tab !== 'daily' && tab !== 'weekly' && tab !== 'special');
      }
    }

    function onTabClick(ev){ 
      var btn=ev.currentTarget; 
      var tab=btn && btn.getAttribute('data-tab'); 
      if(!tab) return; 
      // Si el dashboard está abierto, cerrarlo y cargar la tab directamente
      var dashPanel = document.getElementById('wvObjectivesDashboardPanel');
      if (dashPanel && !dashPanel.hasAttribute('hidden')) {
        hideObjectivesDashboard();
        setActiveTab(tab);
        ensureLoadTab(tab);
        // Actualizar hash sin disparar navegación completa
        location.hash = '#/account/wizards-vault';
        return;
      }
      setActiveTab(tab); 
      ensureLoadTab(tab); 
    }

    function wireTabsOnce(){
      if (els.panel && els.panel.__tabsWired) return;
      if (els.btnDaily) els.btnDaily.addEventListener('click', onTabClick);
      if (els.btnWeekly) els.btnWeekly.addEventListener('click', onTabClick);
      if (els.btnSpecial) els.btnSpecial.addEventListener('click', onTabClick);
      if (els.btnShop) els.btnShop.addEventListener('click', onTabClick);
      if (els.panel) els.panel.__tabsWired = true;
    }

    function ensureLoadTab(tab){
      if (state.loaded[tab] && tab!=='shop') return;
      var token=getSelectedToken();

      if (!state.loaded.__season){
        GW2Api.getWVSeason({ nocache: false }).then(function(season){ 
          state.shop.season = season; 
          setWVSeasonHeader(season);
          if (!state.resetTimers.special) scheduleSeasonReset();
          state.loaded.__season = true;
        }).catch(function(e){ 
          console.warn('[WV] Error cargando temporada:', e);
          state.loaded.__season = true;
        });
        if (window.WVSeasonStore && WVSeasonStore.getCurrentSeasonInfo) {
          WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss) lastSS={year:ss.year,seq:ss.seq}; }).catch(function(){});
        }
      }

      if (!token){
        if (els.noteSync) els.noteSync.classList.remove('hidden');
        if (tab==='daily') els.tabDaily.innerHTML='<p class="muted">Seleccioná una API Key para ver objetivos diarios.</p>';
        if (tab==='weekly') els.tabWeekly.innerHTML='<p class="muted">Seleccioná una API Key para ver objetivos semanales.</p>';
        if (tab==='special') els.tabSpecial.innerHTML='<p class="muted">Seleccioná una API Key para ver objetivos especiales.</p>';
        if (tab==='shop') els.tabShop.innerHTML='<p class="muted">Seleccioná una API Key para ver la Tienda.</p>';
        return;
      } else { if (els.noteSync) els.noteSync.classList.add('hidden'); }

      var skipOnce = !!state.skipObjFetchOnce;

      if (tab==='daily'){
        els.tabDaily.innerHTML='<p class="muted">Cargando…</p>';
        if (skipOnce){ state.skipObjFetchOnce = false; return; }
        GW2Api.getWVDaily(token,{nocache:false}).then(function(data){ renderObjectivesTab(els.tabDaily,data,'daily'); state.loaded.daily=true; })
          .catch(function(e){ els.tabDaily.innerHTML='<p class="error">Error: '+(e&&e.message||'')+'</p>'; });
      }

      if (tab==='weekly'){
        els.tabWeekly.innerHTML='<p class="muted">Cargando…</p>';
        if (skipOnce){ state.skipObjFetchOnce = false; return; }
        GW2Api.getWVWeekly(token,{nocache:false}).then(function(data){ renderObjectivesTab(els.tabWeekly,data,'weekly'); state.loaded.weekly=true; })
          .catch(function(e){ els.tabWeekly.innerHTML='<p class="error">Error: '+(e&&e.message||'')+'</p>'; });
      }

      if (tab==='special'){
        els.tabSpecial.innerHTML='<p class="muted">Cargando…</p>';
        if (skipOnce){ state.skipObjFetchOnce = false; return; }
        GW2Api.getWVSpecial(token,{nocache:false}).then(function(data){ renderObjectivesTab(els.tabSpecial,data,'special'); state.loaded.special=true; })
          .catch(function(e){ els.tabSpecial.innerHTML='<p class="error">Error: '+(e&&e.message||'')+'</p>'; });
      }

      if (tab==='shop'){
        state.lastTab = 'shop'; saveLastTab('shop');
        state.shop.view=loadView(); state.shop.legacyFilter=loadLegacyFilter();
        
        // FASE 2: Delegar a wv-shop-ui.js si está disponible
        if (window.WVShopUI) {
          WVShopUI.ensureShopToolbar();
          return WVShopUI.refresh(false).finally(function(){ state.loaded.shop=true; });
        }
        
        // Fallback: código original
        ensureShopToolbar();

        var ns=marksNamespace();
        if (!lastSS && window.WVSeasonStore && WVSeasonStore.getCurrentSeasonInfo){
          WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss) lastSS={year:ss.year,seq:ss.seq}; }).catch(function(){});
        }
        state.shop.marks=loadMarks(ns); state.shop.pinned=loadPinned(ns);

        setShopLoading(true, 'Cargando Tienda…');

        if (els.tabShop){ var list=els.tabShop.querySelector('#wvShopList'); if (list) list.remove(); }

        return refreshShopData(false).finally(function(){ state.loaded.shop=true; });
      }
    }

    function msUntil(dateUtc){
      var t = (dateUtc instanceof Date) ? dateUtc.getTime() : Number(dateUtc||0);
      var d = t - Date.now();
      return Math.max(0, d);
    }
    function nextDailyResetUTC(){
      var nowUtc = new Date();
      var y=nowUtc.getUTCFullYear(), m=nowUtc.getUTCMonth(), d=nowUtc.getUTCDate();
      var next = new Date(Date.UTC(y, m, d, 24, 0, 0, 0));
      if (next.getTime() <= nowUtc.getTime()) next = new Date(Date.UTC(y, m, d+1, 0, 0, 0, 0));
      return next;
    }
    function nextWeeklyResetUTC(){
      var nowUtc = new Date();
      var day = nowUtc.getUTCDay();
      var daysUntilMonday = (1 - day + 7) % 7;
      var base = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 7, 30, 0, 0));
      var next = new Date(base.getTime() + daysUntilMonday*24*60*60*1000);
      if (next.getTime() <= nowUtc.getTime()) next = new Date(next.getTime() + 7*24*60*60*1000);
      return next;
    }

    function nextSeasonResetUTC(){
      var s = state.shop && state.shop.season;
      if (!s || !s.end) return null;
      var end = new Date(s.end);
      if (isNaN(end.getTime())) return null;
      if (end.getTime() <= Date.now()) return null;
      return end;
    }

    function clearResetTimers(){
      var t=state.resetTimers||{};
      try{ if (t.daily)   clearTimeout(t.daily); }catch(_){}
      try{ if (t.weekly)  clearTimeout(t.weekly); }catch(_){}
      try{ if (t.special) clearTimeout(t.special);}catch(_){}
      state.resetTimers = { daily:null, weekly:null, special:null };
    }

    function scheduleDailyReset(){
      try{
        if (!state._active) return;
        var at = nextDailyResetUTC(); if (!at) return;
        var ms = msUntil(at);
        if (ms === 0) ms = 500;
        if (state.resetTimers.daily) clearTimeout(state.resetTimers.daily);
        state.resetTimers.daily = setTimeout(function(){
          renderObjectivesZero('daily');
          try{ if (GW2Api && typeof GW2Api.wvInvalidateTargets==='function') GW2Api.wvInvalidateTargets(getSelectedToken()); }catch(_){}
          refreshObjectives(true);
          scheduleDailyReset();
        }, ms);
      }catch(e){ console.warn('[WV] scheduleDailyReset error', e); }
    }
    function scheduleWeeklyReset(){
      try{
        if (!state._active) return;
        var at = nextWeeklyResetUTC(); if (!at) return;
        var ms = msUntil(at);
        if (ms === 0) ms = 500;
        if (state.resetTimers.weekly) clearTimeout(state.resetTimers.weekly);
        state.resetTimers.weekly = setTimeout(function(){
          renderObjectivesZero('weekly');
          try{ if (GW2Api && typeof GW2Api.wvInvalidateTargets==='function') GW2Api.wvInvalidateTargets(getSelectedToken()); }catch(_){}
          refreshObjectives(true);
          scheduleWeeklyReset();
        }, ms);
      }catch(e){ console.warn('[WV] scheduleWeeklyReset error', e); }
    }

    function scheduleSeasonReset(){
      try{
        if (!state._active) return;
        
        var at = nextSeasonResetUTC();
        if (!at) return;
        var ms = msUntil(at);
        if (ms === 0) ms = 500;
        
        if (state.resetTimers.special) clearTimeout(state.resetTimers.special);
        
        state.resetTimers.special = setTimeout(function(){
          renderObjectivesZero('special');
          try{ if (GW2Api && typeof GW2Api.wvInvalidateTargets==='function') GW2Api.wvInvalidateTargets(getSelectedToken()); }catch(_){}
          refreshObjectives(true);
          
          GW2Api.getWVSeason({ nocache:true }).then(function(season){
            state.shop.season = season;
            setWVSeasonHeader(season);
          }).catch(function(){
            console.warn('[WV] Error obteniendo nueva temporada después del reset');
          });
          
          if (window.WVSeasonStore && WVSeasonStore.getCurrentSeasonInfo) {
            WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss) lastSS={year:ss.year,seq:ss.seq}; }).catch(function(){});
          }
          
          state.resetTimers.special = null;
        }, ms);
      }catch(e){ console.warn('[WV] scheduleSeasonReset error', e); }
    }

    function scheduleAllResets(){
      clearResetTimers();
      scheduleDailyReset();
      scheduleWeeklyReset();
      scheduleSeasonReset();
    }

    function showObjectivesDashboard(){
      // Inicializar WV si no está iniciado (necesario para F5 en dashboard)
      if (!state.inited) {
        state.inited = true;
        wireTabsOnce();
        var last = loadLastTab();
        if (['daily','weekly','special','shop'].indexOf(last) === -1) last = 'daily';
        state.lastTab = last;
      }
      // Asegurar que WV está activo
      state._active = true;
      // Ocultar tabs de contenido de objetivos/tienda
      ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.setAttribute('hidden','hidden');
      });
      // Deseleccionar botones de tabs
      ['wvTabBtnDaily','wvTabBtnWeekly','wvTabBtnSpecial','wvTabBtnShop'].forEach(function(id){
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute('aria-selected','false');
      });
      // Ocultar botones de navegación, mostrar botones de dashboard
      var dashBtn = document.getElementById('wvTabBtnObjDashboard');
      var pdBtn = document.getElementById('wvTabBtnPurchaseDetail');
      var syncBtn = document.getElementById('wvTabBtnSyncObjectives');
      var refreshBtn = document.getElementById('wvTabBtnRefreshDashboard');
      var backBtn = document.getElementById('wvTabBtnBackToWV');
      if (dashBtn) dashBtn.hidden = true;
      if (pdBtn) pdBtn.hidden = true;
      if (syncBtn) syncBtn.hidden = true;
      if (refreshBtn) refreshBtn.hidden = false;
      if (backBtn) backBtn.hidden = false;
      // Mostrar panel del dashboard
      var dashPanel = document.getElementById('wvObjectivesDashboardPanel');
      if (dashPanel) dashPanel.removeAttribute('hidden');
      // Activar el dashboard
      if (window.WVObjectivesDashboard && typeof window.WVObjectivesDashboard.activate === 'function') {
        window.WVObjectivesDashboard.activate();
      }
    }

    function hideObjectivesDashboard(){
      var dashPanel = document.getElementById('wvObjectivesDashboardPanel');
      if (dashPanel) dashPanel.setAttribute('hidden','hidden');
      // Ocultar botones del dashboard
      var refreshBtn = document.getElementById('wvTabBtnRefreshDashboard');
      var backBtn = document.getElementById('wvTabBtnBackToWV');
      if (refreshBtn) refreshBtn.hidden = true;
      if (backBtn) backBtn.hidden = true;
      // setActiveTab ya maneja mostrar la tab correcta, ocultar las demás, y mostrar/ocultar Sincronizar
      setActiveTab(state.lastTab || 'daily');
    }

    function activate(){
      if (state._active) return;
      state._active = true;

      if (!state.inited){
        state.inited=true;
        wireTabsOnce();
        var last=loadLastTab();
        if(['daily','weekly','special','shop'].indexOf(last)===-1) last='daily';
        state.lastTab=last;
        // Forzar persistencia antes de que cualquier otro módulo interfiera
        saveLastTab(last);
        setActiveTab(last);
      }

      try {
        const token = window.__GN__?.getSelectedToken?.() ?? null;
        if (GW2Api?.wvInvalidateTargets && token) GW2Api.wvInvalidateTargets(token);
        state.skipObjFetchOnce = true;
      } catch (e) {
        console.warn('[WV] auto-refresh on activate error', e);
      }

      // Solo cargar tab si no se cargó ya desde route
      if (!state.loaded[state.lastTab] || state.lastTab==='shop') {
        ensureLoadTab(state.lastTab);
      }
      scheduleAllResets();
    }
    function deactivate(){
      if (!state._active) return;
      state._active = false;
      ensureShopAutoRefresh(false);
      clearResetTimers();
      hideObjectivesDashboard();
    }

    function onVisibilityChange(hidden){
      if (state.lastTab==='shop'){
        if (hidden) ensureShopAutoRefresh(false);
        else { ensureShopAutoRefresh(true); refreshShopData(false); }
      }
      if (!hidden && state._active) {
        scheduleAllResets();
      }
    }

    function onTokenChanged(newToken){
      var prev=state.shop.lastToken||null; state.shop.lastToken=newToken||null;

      state.loaded.daily=false; state.loaded.weekly=false; state.loaded.special=false;
      refreshObjectives(true);
      scheduleAllResets();

      if (state.lastTab==='shop' && prev!==state.shop.lastToken){
        state.loaded.shop=false;
        if (window.WVShopUI) {
          WVShopUI.refresh(true);
        } else {
          if (els.tabShop){ var list=els.tabShop.querySelector('#wvShopList'); if (list) list.remove(); }
          setShopLoading(true, 'Cargando Tienda…');
          refreshShopData(true);
        }
      }
    }

    function onTargetsRefresh(evToken){
      state.loaded.daily=false; state.loaded.weekly=false; state.loaded.special=false;
      var onWV = normHash(location.hash||'#/cards') === '#/account/wizards-vault';
      if (onWV) refreshObjectives(true);
      scheduleAllResets();
    }

    var api={
      activate:activate, setActiveTab:setActiveTab, ensureLoadTab:ensureLoadTab,
      showObjectivesDashboard:showObjectivesDashboard, hideObjectivesDashboard:hideObjectivesDashboard,
      deactivate:deactivate, onVisibilityChange:onVisibilityChange, onTokenChanged:onTokenChanged,
      refreshObjectives:refreshObjectives, onTargetsRefresh:onTargetsRefresh,
      hydrateModePills:function(scope){ hydrateWVModePills(scope||el('wvPanel')); },
      __getShopState: function() { return state.shop; },
      __getObjState: function() { return state.obj; },
      __setObjState: function(kind, data) { state.obj[kind] = data; },
      __debugRows:[]
    };
    try{ if (typeof window!=='undefined') window.WV=api; }catch(_){}

    try{
      var wvPanel=els.panel||el('wvPanel');
      if (wvPanel && 'MutationObserver' in window){
        var mo=new MutationObserver(function(muts){ for (var i=0;i<muts.length;i++){ if (muts[i].addedNodes && muts[i].addedNodes.length){ hydrateWVModePills(wvPanel); break; } } });
        mo.observe(wvPanel,{childList:true,subtree:true});
      }
    }catch(_){}

    // Purchase Detail ahora en nav de tabs (index.html)

    return api;
  })();
  
  // ----------------------------- ROUTER ------------------------------------
  var _routeT = null;

  function hideBothNavButtons(){
    var dashBtn = document.getElementById('wvTabBtnObjDashboard');
    var pdBtn = document.getElementById('wvTabBtnPurchaseDetail');
    if (dashBtn) dashBtn.hidden = true;
    if (pdBtn) pdBtn.hidden = true;
  }

  // T13-a: los modulos con latch en activate() (`if (state.active) return;`)
  // nunca lo bajan, porque su deactivate() no llegaba desde acá. Medido en
  // HB#106/108: irse a Meta dejaba 6 timers vivos con 1 solo panel visible.
  //
  // El PREDICADO es el DOM, POSPUESTO a que el módulo resolvió la visibilidad.
  // NO es la pref y NO es el hash, y esa es la parte importante (veredicto del
  // Reviewer, P1): la pref gn:raids:strike:view NO es la verdad de "qué panel
  // va a quedar visible" porque hay DOS toggles y no coinciden. Medido en
  // tools/hb108-toggle-divergencia.mjs: wireViewToggle (raid-tracker.js)
  // escribe la pref; wireStrikeViewToggle (strike-tracker.js:1202) cambia la
  // visibilidad de los 2 paneles y NO toca la pref. O sea el estado
  // {visible=raids, pref=strikes} es alcanzable por un click y es estable: un
  // deactivate() keyed en la pref apagaría el módulo que Pablo está mirando.
  //
  // Por eso la condición es "mi panel NO quedó visible", y no "desactivo todo".
  // Si el panel de un módulo quedó visible, ese módulo es el dueño de la pantalla y no se toca.
  //
  // HomesteadTracker NO entra, y es una decisión explícita, no una omisión:
  // su deactivate() (homestead-tracker.js:403) solo hace abortLastFetch() y no
  // tiene panel propio -- escribe en `homesteadTrackerBody`, que no existe en
  // index.html (medido: 0 matches). Además nadie lo activa: `HomesteadTracker
  // .activate` no aparece en ningún call site de js/ (medido: 0 matches). Su
  // latch es inerte por partida doble, y sin panel no hay predicado posible.
  var MODULOS_CON_LATCH = [
    { mod: 'RaidTracker',     panel: 'raidTrackerPanel' },
    { mod: 'LegendaryTracker', panel: 'legendaryArmoryPanel' }
  ];

  function barridoLatch(){
    for (var i = 0; i < MODULOS_CON_LATCH.length; i++) {
      var e = MODULOS_CON_LATCH[i];
      var p = el(e.panel);
      // Su panel quedó visible: es el dueño de la pantalla, no se toca.
      if (p && !p.hasAttribute('hidden')) continue;
      var m = window[e.mod];
      if (!m || typeof m.deactivate !== 'function') continue;
      try { m.deactivate(); } catch (_) {}
    }
  }

  function route() {
      clearTimeout(_routeT);
      _routeT = setTimeout(function () {
        // T13-a: el barrido va en un `finally` que ABRAZA TODO EL CUERPO, y
        // no al final de la cadena de ifs. Motivo medido (P3 del Reviewer):
        // el callback tiene un `return` por rama (14 ramas, cada una con su
        // try/finally), así que un barrido escrito después de la cadena NUNCA
        // se ejecutaría. El código se vería bien y la suite de capitalización
        // daría igual, porque el barrido no corrió.
        //
        // Va al FINAL a propósito: tiene que ver el DOM POST-activate, o sea
        // después de que wireViewToggle/setActiveView movieran los paneles
        // según la pref. Ponerlo antes apagaría el módulo que quedó visible.
        try {
        var h = normHash(location.hash || '#/cards');

        if (h !== '#/account/wizards-vault' && WV && typeof WV.deactivate === 'function') {
          try { WV.deactivate(); } catch (_) {}
        }

        if (h === '#/wallet/dashboard') {
          try {
            showPanel('walletDashboardPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('wallet_dashboard');
            if (window.WalletDashboard && typeof window.WalletDashboard.activate === 'function') {
              window.WalletDashboard.activate();
            }
          } catch (e) {
            console.warn('[router] show wallet dashboard error', e);
          } finally {
            updateSidebarFor('walletDashboard');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/inventory/dashboard') {
          // BL-070 INV-7: el Dashboard multicuenta es la pestaña Multicuenta de Inventario y Personajes.
          try {
            if (window.InvView && typeof window.InvView.go === 'function') window.InvView.go('multi');
            else if (window.Storage && typeof window.Storage.set === 'function') window.Storage.set('gn:inventory:tab', 'multi');
          } catch (_) {}
          location.replace('#/account/characters');
          return;
        }

        if (h === '#/account/raids') {
          try {
            showPanel('raidTrackerPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('raids');
            if (window.RaidTracker && typeof window.RaidTracker.activate === 'function') {
              window.RaidTracker.activate();
            }
          } catch (e) {
            console.warn('[router] show raids error', e);
          } finally {
            updateSidebarFor('raids');
            setActiveNav(h);
          }
          return;
        }

        // BL-070 RAI-5b: desde el 2026-02-03 los strikes son encuentros de raid. La ruta vieja muestra
        // Raids y raids-view.js la lleva a la pestaña Encuentros. strike-tracker.js ya no se carga.
        if (h === '#/account/strikes') {
          showPanel('raidTrackerPanel');
          updateSidebarFor('raids');
          setActiveNav(h);
          return;
        }

        if (h === '#/account/legendary-armory') {
          try {
            showPanel('legendaryArmoryPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('legendary_armory');
            if (window.LegendaryTracker && typeof window.LegendaryTracker.activate === 'function') {
              window.LegendaryTracker.activate();
            }
          } catch (e) {
            console.warn('[router] show legendary armory error', e);
          } finally {
            updateSidebarFor('legendaryArmory');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/cards') {
          try { 
            showPanel('walletPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('wallet');
          }
          catch (e) { console.warn('[router] show wallet error', e); }
          finally { updateSidebarFor('cards'); setActiveNav(h); }
          return;
        }

        if (h === '#/meta') {
          try {
            showPanel('metaPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('meta_events');
            document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view: 'meta' } }));
          } catch (e) {
            console.warn('[router] show meta error', e);
          } finally {
            updateSidebarFor('meta');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/achievements') {
          try {
            showPanel('achievementsPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('achievements');
            if (window.Achievements && typeof window.Achievements.render === 'function') {
              window.Achievements.render();
            }
          } catch (e) {
            console.warn('[router] show achievements error', e);
          } finally {
            updateSidebarFor('achievements');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/wizards-vault/objectives-dashboard') {
          try {
            showPanel('wvPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('wv_objectives_dashboard');
            if (WV && typeof WV.showObjectivesDashboard === 'function') {
              WV.showObjectivesDashboard();
            }
          } catch (e) {
            console.warn('[router] WV Objectives Dashboard error', e);
          } finally {
            updateSidebarFor('wv');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/wizards-vault') {
          try {
            showPanel('wvPanel');
            // Cerrar dashboard si estaba abierto (sin cambiar lastTab)
            var dashPanel = document.getElementById('wvObjectivesDashboardPanel');
            if (dashPanel) dashPanel.setAttribute('hidden','hidden');
            var refreshBtn = document.getElementById('wvTabBtnRefreshDashboard');
            var backBtn = document.getElementById('wvTabBtnBackToWV');
            if (refreshBtn) refreshBtn.hidden = true;
            if (backBtn) backBtn.hidden = true;
            if (typeof Analytics !== 'undefined') Analytics.viewModule('wizards_vault');
            if (WV && typeof WV.activate === 'function') WV.activate();
            hydrateWVModePills(el('wvPanel'));
          } catch (e) {
            console.error('[router] WV.activate error', e);
          } finally {
            updateSidebarFor('wv');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/activities') {
          try {
            showPanel('activitiesPanel'); // la vista nueva (js/act-view.js) se dibuja sola al verse
            if (typeof Analytics !== 'undefined') Analytics.viewModule('activities');
          } catch (e) {
            console.warn('[router] activities', e);
          } finally {
            updateSidebarFor('activities');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/homestead') {
          try {
            showPanel('homesteadPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('homestead');
          } catch (e) {
            console.warn('[router] show homestead error', e);
          } finally {
            updateSidebarFor('homestead');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/characters') {
          try {
            showPanel('inventoryPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('inventory');
          } catch (e) {
            console.warn('[router] show inventory error', e);
          } finally {
            updateSidebarFor('inventory');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/account/accounts') {
          try {
            showPanel('accountsPanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('accounts');
            // BL-070 CTA-5: Cuentas es js/acc-view.js (por js/modules.json) y se dibuja sola al ver su ruta.
          } catch (e) {
            console.warn('[router] accounts show error', e);
          } finally {
            updateSidebarFor('accounts');
            setActiveNav(h);
          }
          return;
        }

        if (h === '#/welcome') {
          try {
            showPanel('welcomePanel');
            if (typeof Analytics !== 'undefined') Analytics.viewModule('welcome');
            window.Welcome?.activate?.();
          } catch (e) {
            console.warn('[router] Welcome.activate error', e);
          } finally {
            updateSidebarFor('welcome');
            setActiveNav(h);
          }
          return;
        }

        try { 
          showPanel('walletPanel');
          if (typeof Analytics !== 'undefined') Analytics.viewModule('wallet');
        }
        catch (e) { console.warn('[router] fallback show wallet error', e); }
        finally { updateSidebarFor('cards'); setActiveNav('#/cards'); }
        } finally {
          // Un panel visible con su módulo apagado es peor que un timer de más:
          // por eso el predicado mira el DOM y no la pref (ver arriba).
          barridoLatch();
        }
      }, 35);
    }

  function onKeySelectChange() {
    var h = normHash(location.hash || '#/cards');
    var token = (function(){ var s = el('keySelectGlobal'); return s ? (s.value || '').trim() : null; })();

    try {
      if (h === '#/meta') {
        if (window.Meta && typeof window.Meta.refresh === 'function') {
          window.Meta.refresh({ token: token, nocache: false });
        } else {
          var btn = document.getElementById('metaRefreshFlags');
          if (btn && typeof btn.click === 'function') btn.click();
          var status = document.getElementById('metaStatus');
          if (status) { status.textContent = 'Cargando…'; status.classList.remove('error'); status.classList.add('muted'); }
        }

      } else if (h === '#/account/achievements') {
        if (window.Achievements && typeof window.Achievements.render === 'function') {
          window.Achievements.render();
        }

      } else if (h === '#/account/wizards-vault/objectives-dashboard') {
        if (window.WVObjectivesDashboard && typeof window.WVObjectivesDashboard.refresh === 'function') {
          window.WVObjectivesDashboard.refresh(true);
        }
      } else if (h === '#/account/wizards-vault') {
        if (WV && typeof WV.onTokenChanged === 'function') WV.onTokenChanged(token);
        if (WV && typeof WV.refreshObjectives === 'function') WV.refreshObjectives(true);
        if (WV && typeof WV.activate === 'function') WV.activate();
        hydrateWVModePills(el('wvPanel'));

      } else if (h === '#/activities') {
        // BL-070 ACT-7: js/act-view.js y js/act-week.js escuchan gn:tokenchange y releen solas.

      } else if (h === '#/account/characters') {
        // BL-070 INV-7: la vista nueva escucha gn:tokenchange y relee sola.
      } else if (h === '#/account/accounts') {
        // BL-070 CTA-5: js/acc-view.js escucha gn:tokenchange y relee sola.
      } else if (h === '#/welcome') {
        var pWelcome = document.getElementById('welcomePanel');
        if (pWelcome && !pWelcome.hasAttribute('hidden')) {
          try {
            window.Welcome?.activate?.();
          } catch (e) {
            console.warn('[router] Welcome.activate error', e);
          }
        }
      } else if (h === '#/wallet/dashboard') {
        if (window.WalletDashboard && typeof window.WalletDashboard.activate === 'function') {
          window.WalletDashboard.activate();
        }
      } else if (h === '#/account/raids') {
        if (window.RaidTracker && typeof window.RaidTracker.refresh === 'function') {
          window.RaidTracker.refresh(true);
        } else if (window.RaidTracker && typeof window.RaidTracker.activate === 'function') {
          window.RaidTracker.activate();
        }
      } else if (h === '#/account/legendary-armory') {
        if (window.LegendaryTracker && typeof window.LegendaryTracker.refresh === 'function') {
          window.LegendaryTracker.refresh(true);
        } else if (window.LegendaryTracker && typeof window.LegendaryTracker.activate === 'function') {
          window.LegendaryTracker.activate();
        }
      }

    } catch (e) {
      console.warn('[router] onKeySelectChange error', e);
    }
  }

  function onDomReady(){
    if (onDomReady.__wired) return;
    onDomReady.__wired = true;

    $$('.overlay-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ var view=btn.getAttribute('data-view'); if (view==='cards') location.hash='#/cards'; else if (view==='meta') location.hash='#/meta'; });
    });

    var sel=el('keySelectGlobal');
    if (sel && !sel.__routerWired){ sel.__routerWired=true; sel.addEventListener('change', onKeySelectChange); }

    document.addEventListener('gn:wv-targets-refresh', function(ev){
      try {
        var token = (ev && ev.detail && ev.detail.token) || (el('keySelectGlobal')?.value||null) || null;
        if (WV && typeof WV.onTargetsRefresh === 'function') WV.onTargetsRefresh(token);
      } catch(e){ console.warn('[router] gn:wv-targets-refresh handler error', e); }
    });
    document.addEventListener('gn:wv-targets-refreshed', function(ev){
      try {
        var onWV = normHash(location.hash||'#/cards') === '#/account/wizards-vault';
        if (onWV && WV && typeof WV.refreshObjectives === 'function') {
          WV.refreshObjectives(false);
        }
      } catch(e){ console.warn('[router] gn:wv-targets-refreshed handler error', e); }
    });

    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', function(){ if (WV && typeof WV.onVisibilityChange==='function') WV.onVisibilityChange(document.hidden); });

    var firstVisit = !Storage.get(Storage.STORAGE_KEYS.GLOBAL_WELCOME_SEEN);
    var hasKey = !!getSelectedToken();
    
    if (!hasKey || firstVisit) {
      var currentHash = location.hash;
      if (currentHash === '#/cards' || currentHash === '#/' || currentHash === '') {
        location.hash = '#/welcome';
        if (firstVisit) {
          Storage.set(Storage.STORAGE_KEYS.GLOBAL_WELCOME_SEEN, 'true');
        }
      }
    }

    // Wirear botón Purchase Detail en tabs
    var pdTabBtn = document.getElementById('wvTabBtnPurchaseDetail');
    if (pdTabBtn && !pdTabBtn.__wired) {
      pdTabBtn.__wired = true;
      pdTabBtn.addEventListener('click', function(e) {
        e.preventDefault();
        hideBothNavButtons();
        try { window.WVPurchaseDetail?.show(); } catch(err) { console.warn('[router] PD show error', err); }
      });
    }

    // Wirear botones del dashboard (Refrescar / Volver)
    var refreshDashBtn = document.getElementById('wvTabBtnRefreshDashboard');
    var backDashBtn = document.getElementById('wvTabBtnBackToWV');
    if (refreshDashBtn && !refreshDashBtn.__wired) {
      refreshDashBtn.__wired = true;
      refreshDashBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.WVObjectivesDashboard && typeof window.WVObjectivesDashboard.refresh === 'function') {
          window.WVObjectivesDashboard.refresh(true);
        }
      });
    }
    if (backDashBtn && !backDashBtn.__wired) {
      backDashBtn.__wired = true;
      backDashBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (WV && typeof WV.hideObjectivesDashboard === 'function') {
          WV.hideObjectivesDashboard();
        }
        location.hash = '#/account/wizards-vault';
      });
    }

    // Wirear botón Sincronizar objetivos
    var syncObjBtn = document.getElementById('wvTabBtnSyncObjectives');
    if (syncObjBtn && !syncObjBtn.__wired) {
      syncObjBtn.__wired = true;
      syncObjBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (WV && typeof WV.refreshObjectives === 'function') {
          WV.refreshObjectives(true);
          window.toast?.('info', 'Sincronizando objetivos con la API...', { ttl: 1500 });
        }
      });
    }

    route(); hydrateWVModePills(el('wvPanel'));
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', onDomReady);
  else onDomReady();

})();