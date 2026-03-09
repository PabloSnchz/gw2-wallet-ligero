/*!
 * Router y Vistas (WV Objetivos + Tienda unificada)
 * v2.9.8 (2026‑03‑09)
 *
 * Cambios v2.9.8:
 *  - [WV/Tienda] Handlers robustos de persistencia:
 *      · Pin/Unpin: await + rollback on error (toast).
 *      · Marks inc/dec/max: micro‑batch (120ms por fp) + toast + refresh on error.
 *  - [WV/Tienda] Se mantiene skeleton, de‑dupe y mutate-event para repintar en vivo.
 *  - [Compat] No se tocan APIs públicas ni invariantes del BAI.
 *
 * Cambios v2.9.7:
 *  - [WV/Tienda] Persistencia de pins/marks migrada a WVSeasonStore (single‑season).
 *  - [WV/Tienda] Actualización en vivo ante 'wv:season-store:mutate'.
 *  - [UX] Se mantiene skeleton + de-dupe y funcionamiento previo.
 */

(function () {
  'use strict';

  console.info('[WV] router-wv.js v2.9.8 — Persistencia robusta + micro-batching');

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
      .replace(/&amp;amp;amp;amp;amp;/g,'&amp;amp;amp;amp;amp;amp;').replace(/&amp;amp;amp;amp;lt;/g,'&amp;amp;amp;amp;amp;lt;').replace(/&amp;amp;amp;amp;gt;/g,'&amp;amp;amp;amp;amp;gt;')
      .replace(/"/g,'&amp;amp;amp;amp;amp;quot;').replace(/'/g,'&amp;amp;amp;amp;amp;#039;');
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
        var map = {'#/cards':'cards','#/meta':'meta','#/account/achievements':'achievements','#/account/wizards-vault':'wv'};
        var dv = map[h]; if (dv) found = links.find(function (a) { return (a.getAttribute('data-view')||'').trim().toLowerCase()===dv; }) || null;
      }
      if (found) { found.classList.add('is-active'); found.setAttribute('aria-current','page'); }
      document.dispatchEvent(new CustomEvent('gn:nav-active', { detail: { hash: h, link: found } }));
    } catch (e) { console.warn('[router] setActiveNav error', e); }
  }

  function updateSidebarFor(view) {
    try {
      var conv=el('asideConvSection'), next=el('asideNextFeatures'), metaNext=el('metaAsideNext'), ach=el('achAsidePanel');
      if (conv) conv.hidden = true; if (next) next.hidden = true; if (metaNext) metaNext.hidden = true; if (ach) ach.hidden = true;
      if (view==='cards'){ if (conv) conv.hidden=false; if (next) next.hidden=false; }
      else if (view==='meta'){ if (metaNext) metaNext.hidden=false; }
      else if (view==='achievements'){ if (ach) ach.hidden=false; }
    } catch (e) { console.warn('[router] updateSidebarFor error', e); }
  }

  function showPanel(idToShow) {
    ['walletPanel','metaPanel','achievementsPanel','wvPanel','activitiesPanel'].forEach(function(id){
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
    var _shopInFlight = null; // de-dupe

    // Preferencias UI (se mantienen en LS)
    var LS_WV_SHOP_VIEW='gw2_wv_view_v1',
        LS_WV_LAST_TAB='gw2_wv_lasttab_v1', LS_WV_LEGACY_VIS='gw2_wv_legacy_filter_v1';

        // ---- SeasonStore bridge ----
    var lastSS = null; // {year,seq} resuelto desde WVSeasonStore.getCurrentSeasonInfo()

    function marksNamespace(){
      var token=getSelectedToken()||'anon', fp=token?(token.slice(0,4)+'…'+token.slice(-4)):'anon';
      var st=state.shop, seasonId=(st && st.season && (st.season.id || st.season.title)) || 'season';
      // La parte "seasonId" es solo informativa; el store usa fp+{year,seq}
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

    // --- Micro-batching de marks por fp (120ms) ---
    var __marksTimers = new Map();   // fp -> timer
    var __marksBuffers = new Map();  // fp -> { id: val, ... }

    function saveMarksBatched(fp, patch, onError){
      var buf = __marksBuffers.get(fp) || {};
      Object.assign(buf, patch||{});
      __marksBuffers.set(fp, buf);

      if (__marksTimers.has(fp)) return; // ya programado

      var ns = marksNamespace(); // resuelto al momento del batch
      var t = setTimeout(async function(){
        __marksTimers.delete(fp);
        var payload = __marksBuffers.get(fp) || {};
        __marksBuffers.delete(fp);
        try {
          await saveMarks(ns, payload);
          // mutate-event disparado por SeasonStore repinta en vivo
        } catch(e){
          try { window.toast?.('error','No se pudo guardar marcas (espacio de almacenamiento)',{ttl:1800}); } catch(_){}
          // Recuperación: refrescar la tienda para alinear con el store real
          try { refreshShopData(false); } catch(_){}
          if (typeof onError === 'function') { try { onError(e); } catch(_){ } }
        }
      }, 120);
      __marksTimers.set(fp, t);
    }

    function saveView(v){ try{ localStorage.setItem(LS_WV_SHOP_VIEW,v); }catch(_){ } }
    function loadView(){ try{ return localStorage.getItem(LS_WV_SHOP_VIEW)||'cards'; }catch(_){ return 'cards'; } }
    function saveLastTab(t){ try{ localStorage.setItem(LS_WV_LAST_TAB,t); }catch(_){ } }
    function loadLastTab(){ try{ return localStorage.getItem(LS_WV_LAST_TAB)||'daily'; }catch(_){ return 'daily'; } }
    function saveLegacyFilter(v){ try{ localStorage.setItem(LS_WV_LEGACY_VIS,v); }catch(_){ } }
    function loadLegacyFilter(){ try{ return localStorage.getItem(LS_WV_LEGACY_VIS)||'show'; }catch(_){ return 'show'; } }

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

    // ---- Loading con SKELETON ----
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
        var body = (viewPref === 'table') ? skShopTable(8) : skShopCards(8);
        node.innerHTML = '<div style="margin:6px 0 10px 0">'+escapeHtml(String(msg || 'Cargando Tienda…'))+'</div>' + body;
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

    function renderObjectivesTab(host, data, kind){
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

    function renderObjectivesZero(kind){
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

    function shopSyncLine(){
      var ts=state.shop.lastSyncTs;
      if (!ts) return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado: —</span></div>';
      var secs=Math.max(0,Math.floor((now()-ts)/1000));
      return '<div class="wv-syncline"><span class="wv-sync-badge">Sincronizado hace '+secs+'s</span></div>';
    }
    function syncShopToggleLabel(){ var v=el('wvShopToggleView'); if (v) v.textContent='Vista: '+(state.shop.view==='cards'?'Tarjetas':'Tabla'); }

    function ensureShopToolbar(){
      var host=ensureShopHost();
      if (host.__wired && host.querySelector('.wv-shop-toolbar')) return;
      host.__wired=true;

      var legacyVis=state.shop.legacyFilter||'show';
      host.innerHTML=[
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

      var q=host.querySelector('#wvShopSearch'), s=host.querySelector('#wvShopSort'),
          v=host.querySelector('#wvShopToggleView'), r=host.querySelector('#wvShopRefresh'),
          lf=host.querySelector('#wvLegacyFilter'), cls=host.querySelector('#wvClearSynced');

      if (q) q.addEventListener('input', function(){ state.shop.q=(q.value||'').trim().toLowerCase(); renderShopArea(); });
      if (s) s.addEventListener('change', function(){ state.shop.sort=s.value; renderShopArea(); });
      if (v) v.addEventListener('click', function(){ state.shop.view=(state.shop.view==='cards')?'table':'cards'; saveView(state.shop.view); syncShopToggleLabel(); renderShopArea(); });
      if (r) r.addEventListener('click', function(){ refreshShopData(true); });
      if (lf) lf.addEventListener('change', function(){ state.shop.legacyFilter=lf.value||'show'; saveLegacyFilter(state.shop.legacyFilter); renderShopArea(); });

      if (cls) cls.addEventListener('click', async function(){
        var st=state.shop, marks=st.marks||{}, changed=false;
        (st.merged||[]).forEach(function(row){
          var id=String(row.id), limit=(typeof row.purchase_limit==='number')?row.purchase_limit:null, purchasedApi=(typeof row.purchased==='number')?row.purchased:0;
          var m=+marks[id]||0; if (limit==null) return;
          if (purchasedApi>=limit && m){ delete marks[id]; changed=true; }
          else if (m>0 && purchasedApi+m>limit){ marks[id]=Math.max(0,limit-purchasedApi); changed=true; }
        });
        if (changed){
          st.marks=marks;
          var ns=marksNamespace(), fp=parseNs(ns);
          try {
            await saveMarks(ns, marks); // persistir completo
            renderShopArea();
            window.toast?.('success','Marcas sincronizadas con el API',{ttl:1800});
          } catch(e){
            window.toast?.('error','No se pudo limpiar marcas (espacio de almacenamiento)',{ttl:1800});
            refreshShopData(false);
          }
        } else window.toast?.('info','No hay marcas para limpiar',{ttl:1500});
      });

      syncShopToggleLabel();
    }

    function setShopHeader(aa, spentApi, reservedMarks, iconUrl){
      var host=el('wvShopHeader'); if (!host) return;
      var icon=iconUrl?('<img src="'+escapeHtml(iconUrl)+'" alt="" width="16" height="16" style="vertical-align:middle;margin-right:6px;" loading="lazy"/>'):'';
      var aaLeft=Math.max(0, Number(aa||0)-Number(reservedMarks||0));
      host.innerHTML=icon+'<strong>Aclamación Astral</strong> — Disponible: <strong>'+fmtNumber(aa||0)+'</strong> • Gastado (API): <strong>'+fmtNumber(spentApi||0)+'</strong> • Reservado (marcas): <strong>'+fmtNumber(reservedMarks||0)+'</strong> • Restante: <strong>'+fmtNumber(aaLeft)+'</strong>';
    }
    function computeShopNumbers(rows){
      var spentApi=0; (rows||[]).forEach(function(x){ var cost=+x.cost||0, pc=+x.purchased||0; if(cost>0&&pc>0) spentApi+=cost*pc; });
      var marks=state.shop.marks||{}, reserved=0;
      Object.keys(marks).forEach(function(id){ var m=+marks[id]||0; var row=(rows||[]).find(function(x){ return String(x.id)===String(id); }); if(row&&m>0) reserved += (row.cost||0)*m; });
      return { spentApi:spentApi, reservedMarks:reserved };
    }

    function passSearchAndSort(list){
      var q=(state.shop.q||'').toLowerCase(), sort=state.shop.sort||'name', legacy=state.shop.legacyFilter||'show', itemsById=state.shop.itemsById||new Map();
      var filtered=(list||[]).filter(function(x){
        if (legacy==='hide' && String(x.type||'').toLowerCase()==='legacy') return false;
        if (!q) return true;
        var it=(x.item_id!=null)?itemsById.get(x.item_id):null; var name=it&&it.name?String(it.name):'';
        return name.toLowerCase().includes(q) || String(x.id||'').includes(q);
      });
      var sorted=filtered.slice();
      switch(sort){
        case 'cost': sorted.sort(function(a,b){return (a.cost||0)-(b.cost||0);}); break;
        case 'costDesc': sorted.sort(function(a,b){return (b.cost||0)-(a.cost||0);}); break;
        case 'id': sorted.sort(function(a,b){return (a.id||0)-(b.id||0);}); break;
        default:
          sorted.sort(function(a,b){ var ia=itemsById.get(a.item_id)||{}, ib=itemsById.get(b.item_id)||{}; return String(ia.name||'').localeCompare(String(ib.name||''),'es'); });
      }
      var pinned=state.shop.pinned||{};
      sorted.sort(function(a,b){ var pa=!!pinned[a.id], pb=!!pinned[b.id]; return pa&& !pb ? -1 : (!pa && pb ? 1 : 0); });
      return sorted;
    }

    function renderShopArea(){
      var host=els.tabShop; if (!host) return;

      ensureShopToolbar(); syncShopToggleLabel();

      var toolbarHost=ensureShopHost(), toolbar = toolbarHost.querySelector('.wv-shop-toolbar');
      if (toolbar){ var line=toolbar.querySelector('.wv-syncline'); if (line) line.outerHTML = shopSyncLine(); }

      var st=state.shop, sums=computeShopNumbers(st.merged);
      setShopHeader(st.aa, sums.spentApi, sums.reservedMarks, st.aaIconUrl);

      var areaId='wvShopList', area=host.querySelector('#'+areaId);
      if (!area){ area=document.createElement('div'); area.id=areaId; host.appendChild(area); }

      var itemsById=st.itemsById||new Map(), rows=passSearchAndSort(st.merged).slice(0,1200);
      try { if (typeof window!=='undefined' && window.WV) window.WV.__debugRows=rows; } catch {}

      setShopLoading(false);

      if (st.view==='table'){
        var trs=rows.map(function(x){
          var it=(x.item_id!=null)?itemsById.get(x.item_id):null;
          var icon=it&&it.icon?('<img class="wv-item-icon" src="'+escapeHtml(it.icon)+'" alt="" loading="lazy"/> '):'';
          var name=it&&it.name?it.name:(x.item_id!=null?('Item #'+x.item_id):(x.type||'—'));
          var rarity=it&&it.rarity?String(it.rarity):null, color=rarityColor(rarity);
          var qty=(x.item_count && x.item_count>1)?(' <span class="muted">×'+x.item_count+'</span>'):'';
          var limit=(typeof x.purchase_limit==='number')?x.purchase_limit:null;
          var purchasedApi=(typeof x.purchased==='number')?x.purchased:0;

          var marks=st.marks||{}, marked=Number(marks[x.id]||0), purchasedEff=purchasedApi+marked;
          var leftVal=(limit==null)?'∞':GW2Api.wvComputeRemaining(limit, purchasedApi, marked);

          var nameHtml='<span'+(color?' style="color:'+color+'"':'')+'>'+escapeHtml(name)+'</span>';

          var pinActive=!!(st.pinned && st.pinned[x.id]);
          var pinCls='wv-pin'+(pinActive?' wv-pin--active':''), pinBtn='<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';

          var ctr=(limit==null)
            ? '<span class="wv-counter"><span class="muted" style="min-width:24px; display:inline-block; text-align:center;">—</span></span>'
            : '<span class="wv-counter" data-id="'+x.id+'"><button class="btn btn--ghost wv-dec" title="-">−</button><span class="muted" style="min-width:24px; display:inline-block; text-align:center;">'+marked+'</span><button class="btn btn--ghost wv-inc" title="+">+</button></span>';

          var maxBtn=(limit!=null && purchasedEff<limit)?'<button class="btn btn--ghost wv-markall" data-id="'+x.id+'" title="Marcar todo (llenar hasta el máximo)">Max</button>':'';

          return '<tr data-id="'+x.id+'"><td class="nowrap">'+icon+nameHtml+qty+'</td><td>'+escapeHtml(x.type||'')+'</td><td class="right">'+(x.cost||0)+'</td><td class="right">'+purchasedEff+' / '+(limit==null?'∞':limit)+'</td><td class="right">'+leftVal+'</td><td class="right">'+ctr+(maxBtn?' '+maxBtn:'')+'</td><td class="right">'+pinBtn+'</td></tr>';
        }).join('');

        area.innerHTML='<div class="table-wrap"><table class="simple"><thead><tr><th>Ítem</th><th>Tipo</th><th class="right">Costo (AA)</th><th class="right">Comprado</th><th class="right">Restante</th><th class="right">Marcar</th><th class="right">Fijar</th></tr></thead><tbody>'+trs+'</tbody></table></div>';

      } else {
        var cards=rows.map(function(x){
          var it=(x.item_id!=null)?itemsById.get(x.item_id):null;
          var icon=it&&it.icon?it.icon:'';
          var name=it&&it.name?it.name:(x.item_id!=null?('Item #'+x.item_id):(x.type||'—'));
          var rarity=it&&it.rarity?String(it.rarity):null, color=rarityColor(rarity);

          var cost=(x.cost||0), limit=(typeof x.purchase_limit==='number')?x.purchase_limit:null, purchasedApi=(typeof x.purchased==='number')?x.purchased:0;
          var marks=st.marks||{}, marked=Number(marks[x.id]||0), purchasedEff=purchasedApi+marked;
          var leftVal=(limit==null)?'∞':GW2Api.wvComputeRemaining(limit, purchasedApi, marked);

          var b1=color?hexToRGBA(color,0.32):null, g1=color?hexToRGBA(color,0.36):null;
          var cardDeco=(b1&&g1)?' style="border:1px solid '+b1+'; box-shadow: 0 0 0 1px '+b1+' inset, 0 0 14px '+g1+';"':'';
          var iconDeco=(b1&&g1)?' style="box-shadow: 0 0 0 2px '+b1+', 0 0 10px '+g1+'; border-radius:6px;"':'';

          var ctr=(limit==null)
            ? '<span class="wv-counter wv-counter--card wv-counter--disabled"><span class="muted">—</span></span>'
            : '<span class="wv-counter wv-counter--card" data-id="'+x.id+'"><button class="btn btn--ghost wv-dec" title="-">−</button><span class="muted" style="min-width:26px; display:inline-block; text-align:center;">'+marked+'</span><button class="btn btn--ghost wv-inc" title="+">+</button></span>';

          var maxBtn=(limit!=null && purchasedEff<limit)?'<button class="btn btn--ghost wv-markall" data-id="'+x.id+'" title="Marcar todo (llenar hasta el máximo)">Max</button>':'';
          var pinActive=!!(st.pinned && st.pinned[x.id]), pinCls='wv-pin'+(pinActive?' wv-pin--active':''), pinBtn='<button class="'+pinCls+'" data-pin="'+x.id+'" title="'+(pinActive?'Desfijar':'Fijar')+'">📌</button>';
          var rowStyle='display:flex;justify-content:space-between;align-items:center;gap:8px;';

          return '<div class="wv-card" data-id="'+x.id+'"'+cardDeco+'><div class="wv-card__top"><div class="wv-card__iconWrap"'+iconDeco+'>'+ (icon?('<img class="wv-card__icon" src="'+escapeHtml(icon)+'" alt="" loading="lazy"/>'):'') +'</div><div class="wv-card__name" title="'+escapeHtml(name)+'"'+(color?' style="color:'+color+'"':'')+'>'+escapeHtml(name)+'</div>'+pinBtn+'</div><div class="wv-card__meta"><span class="wv-badge">Costo: <strong>'+cost+'</strong> AA</span><span class="wv-type">'+escapeHtml(x.type||'—')+'</span></div><div class="wv-card__body"><div class="sep"></div><div class="wv-card__row" style="'+rowStyle+'"><span class="muted">Comprado:</span><span class="pill">'+purchasedEff+' / '+(limit==null?'∞':limit)+'</span></div><div class="wv-card__row" style="'+rowStyle+'"><span class="muted">Restante:</span><span class="pill">'+leftVal+'</span></div></div><div class="wv-card__bottom" style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><span class="wv-id">ID '+x.id+'</span><span>'+ctr+(maxBtn?' '+maxBtn:'')+'</span></div></div>';
        }).join('');

        area.innerHTML = '<div class="wv-card-grid">'+cards+'</div>';
      }

      // Wire de contadores y pin (actualiza SeasonStore)
      $$('.wv-counter', area).forEach(function(host){
        var id=host.getAttribute('data-id'), btnDec=$('.wv-dec',host), btnInc=$('.wv-inc',host), spanVal=$('span.muted',host);
        var findRow=function(){ return state.shop.merged.find(function(x){ return String(x.id)===String(id); }); };
        var limitOf=function(row){ return (typeof row.purchase_limit==='number')?row.purchase_limit:null; };
        var purchasedApiOf=function(row){ return (typeof row.purchased==='number')?row.purchased:0; };
        function refresh(val){ if (spanVal) spanVal.textContent=String(val); renderShopArea(); }

        if (btnDec && !btnDec.__wired){ btnDec.__wired=true; btnDec.addEventListener('click', async function(){
          var row=findRow(); if(!row) return;
          var marks=state.shop.marks||{}; var cur=+marks[id]||0; if(cur<=0) return;
          cur-=1; marks[id]=cur; state.shop.marks=marks;
          var ns=marksNamespace(); var fp=parseNs(ns);
          // Micro-batch: no bloqueamos UI; en error -> toast + refresh
          saveMarksBatched(fp, ({[id]:cur}), function(){ /* hook opcional */ });
          refresh(cur);
        }); }
        if (btnInc && !btnInc.__wired){ btnInc.__wired=true; btnInc.addEventListener('click', async function(){
          var row=findRow(); if(!row) return;
          var marks=state.shop.marks||{}; var cur=+marks[id]||0;
          var lim=limitOf(row); var cap=(lim==null)?Infinity:Math.max(0, lim - purchasedApiOf(row));
          if(cur>=cap) return;
          cur+=1; marks[id]=cur; state.shop.marks=marks;
          var ns=marksNamespace(); var fp=parseNs(ns);
          saveMarksBatched(fp, ({[id]:cur}), function(){ /* onError */ });
          refresh(cur);
        }); }
      });

      $$('.wv-markall', area).forEach(function(btn){
        if (btn.__wired) return; btn.__wired=true;
        btn.addEventListener('click', async function(){
          var id=btn.getAttribute('data-id'); var row=state.shop.merged.find(function(x){ return String(x.id)===String(id); }); if(!row) return;
          var limit=(typeof row.purchase_limit==='number')?row.purchase_limit:null; var purchasedApi=(typeof row.purchased==='number')?row.purchased:0;
          if (limit==null) return; var cap=Math.max(0, limit - purchasedApi);
          var marks=state.shop.marks||{}; var prev=+marks[id]||0; marks[id]=cap; state.shop.marks=marks;
          var ns=marksNamespace(); var fp=parseNs(ns);
          try {
            await saveMarks(ns, ({[id]:cap}));
            renderShopArea();
          } catch(e){
            marks[id]=prev; state.shop.marks=marks;
            renderShopArea();
            window.toast?.('error','No se pudo guardar marcas (espacio de almacenamiento)',{ttl:1800});
          }
        });
      });

      $$('[data-pin]', area).forEach(function(btn){
        if (btn.__wired) return; btn.__wired=true;
        btn.addEventListener('click', async function(){
          var id=btn.getAttribute('data-pin'); var pinned=state.shop.pinned||{};
          var ns=marksNamespace(); var fp=parseNs(ns);
          if (pinned[id]) {
            // Unpin con rollback on error
            delete pinned[id];
            try {
              await delPinnedIds(fp, [id]);
              state.shop.pinned=pinned;
              renderShopArea();
            } catch(e){
              // Revertir
              pinned[id]=true; state.shop.pinned=pinned; renderShopArea();
              window.toast?.('error','No se pudo desfijar (espacio de almacenamiento)',{ttl:1800});
            }
          } else {
            // Pin con rollback on error
            pinned[id]=true;
            try {
              await setPinnedPatch(fp, ({[id]:true}));
              state.shop.pinned=pinned;
              renderShopArea();
            } catch(e){
              delete pinned[id]; state.shop.pinned=pinned; renderShopArea();
              window.toast?.('error','No se pudo fijar (espacio de almacenamiento)',{ttl:1800});
            }
          }
        });
      });
    }

    function ensureShopAutoRefresh(on){
      var st=state.shop;
      if (on){ if (st.autoRefreshTimer) return; st.autoRefreshTimer=setInterval(function(){ refreshShopData(false); }, st.autoRefreshEveryMs); }
      else { if (st.autoRefreshTimer){ clearInterval(st.autoRefreshTimer); st.autoRefreshTimer=null; } }
    }

    // de-dupe
    function refreshShopData(forceNoCache){
      var token=getSelectedToken();
      if (!token){ if (els.tabShop) els.tabShop.innerHTML='<p class="muted">Seleccioná una API Key para ver la Tienda.</p>'; return Promise.resolve(); }
      state.shop.lastToken=token;

      if (_shopInFlight) return _shopInFlight;

      setShopLoading(true, 'Cargando Tienda…');

      // Asegurar season visible y {year,seq} del store
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

        // Saneamiento de marcas frente a límites del API
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

        renderShopArea();
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
    }

    function onTabClick(ev){ var btn=ev.currentTarget; var tab=btn && btn.getAttribute('data-tab'); if(!tab) return; setActiveTab(tab); ensureLoadTab(tab); }

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
        GW2Api.getWVSeason({ nocache:false }).then(function(season){ state.shop.season=season; setWVSeasonHeader(season); scheduleSeasonReset(); }).catch(function(){});
        // Warm lastSS si está el store
        if (window.WVSeasonStore && WVSeasonStore.getCurrentSeasonInfo) {
          WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss) lastSS={year:ss.year,seq:ss.seq}; }).catch(function(){});
        }
        state.loaded.__season=true;
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
        state.shop.view=loadView(); state.shop.legacyFilter=loadLegacyFilter();
        ensureShopToolbar();

        var ns=marksNamespace();
        // asegurar lastSS si aún no está
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
        var at = nextSeasonResetUTC(); if (!at) return;
        var ms = msUntil(at);
        if (ms === 0) ms = 500;
        if (state.resetTimers.special) clearTimeout(state.resetTimers.special);
        state.resetTimers.special = setTimeout(function(){
          renderObjectivesZero('special');
          try{ if (GW2Api && typeof GW2Api.wvInvalidateTargets==='function') GW2Api.wvInvalidateTargets(getSelectedToken()); }catch(_){}
          refreshObjectives(true);
          GW2Api.getWVSeason({ nocache:true }).then(function(season){ state.shop.season=season; setWVSeasonHeader(season); scheduleSeasonReset(); }).catch(function(){});
          // actualizar lastSS por rollover
          if (window.WVSeasonStore && WVSeasonStore.getCurrentSeasonInfo) {
            WVSeasonStore.getCurrentSeasonInfo().then(function(ss){ if (ss) lastSS={year:ss.year,seq:ss.seq}; }).catch(function(){});
          }
        }, ms);
      }catch(e){ console.warn('[WV] scheduleSeasonReset error', e); }
    }
    function scheduleAllResets(){
      clearResetTimers();
      scheduleDailyReset();
      scheduleWeeklyReset();
      scheduleSeasonReset();
    }

    function activate(){
      if (state._active) return;
      state._active = true;

      if (!state.inited){
        state.inited=true;
        wireTabsOnce();
        var last=loadLastTab();
        if(['daily','weekly','special','shop'].indexOf(last)===-1) last='daily';
        setActiveTab(last);
      }

      try {
        const token = window.__GN__?.getSelectedToken?.() ?? null;
        if (GW2Api?.wvInvalidateTargets && token) GW2Api.wvInvalidateTargets(token);
        state.skipObjFetchOnce = true;
        if (typeof WV?.refreshObjectives === 'function') WV.refreshObjectives(true);
      } catch (e) {
        console.warn('[WV] auto-refresh on activate error', e);
      }

      ensureLoadTab(state.lastTab||'daily');
      scheduleAllResets();
    }
    function deactivate(){
      if (!state._active) return;
      state._active = false;
      ensureShopAutoRefresh(false);
      clearResetTimers();
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
        if (els.tabShop){ var list=els.tabShop.querySelector('#wvShopList'); if (list) list.remove(); }
        setShopLoading(true, 'Cargando Tienda…');
        refreshShopData(true);
      }
    }

    function onTargetsRefresh(evToken){
      state.loaded.daily=false; state.loaded.weekly=false; state.loaded.special=false;
      var onWV = normHash(location.hash||'#/cards') === '#/account/wizards-vault';
      if (onWV) refreshObjectives(true);
      scheduleAllResets();
    }

    // Refresco por mutación del SeasonStore (pin/mark desde otra vista/pestaña)
    try {
      window.addEventListener('wv:season-store:mutate', function(){
        // Recalcular números y repintar si la tienda está visible
        var onWV = normHash(location.hash||'#/cards') === '#/account/wizards-vault';
        if (onWV && state.lastTab==='shop') {
          renderShopArea();
        }
      });
    } catch(_){}

    var api={
      activate:activate, setActiveTab:setActiveTab, ensureLoadTab:ensureLoadTab,
      deactivate:deactivate, onVisibilityChange:onVisibilityChange, onTokenChanged:onTokenChanged,
      refreshObjectives:refreshObjectives, onTargetsRefresh:onTargetsRefresh,
      hydrateModePills:function(scope){ hydrateWVModePills(scope||el('wvPanel')); }, __debugRows:[]
    };
    try{ if (typeof window!=='undefined') window.WV=api; }catch(_){}

    try{
      var wvPanel=els.panel||el('wvPanel');
      if (wvPanel && 'MutationObserver' in window){
        var mo=new MutationObserver(function(muts){ for (var i=0;i<muts.length;i++){ if (muts[i].addedNodes && muts[i].addedNodes.length){ hydrateWVModePills(wvPanel); break; } } });
        mo.observe(wvPanel,{childList:true,subtree:true});
      }
    }catch(_){}

    return api;
  })();

  // ----------------------------- ROUTER ------------------------------------
  var _routeT = null; // debounce
  function route() {
    clearTimeout(_routeT);
    _routeT = setTimeout(function () {
      var h = normHash(location.hash || '#/cards');

      // Desactivar WV si salimos de su pantalla
      if (h !== '#/account/wizards-vault' && WV && typeof WV.deactivate === 'function') {
        try { WV.deactivate(); } catch (_) {}
      }
      // (Opcional) Desactivar Activities si salimos de su pantalla
      if (h !== '#/activities' && window.Activities && typeof window.Activities.deactivate === 'function') {
        try { window.Activities.deactivate(); } catch (_) {}
      }

      // CARDS (Wallet)
      if (h === '#/cards') {
        try { showPanel('walletPanel'); }
        catch (e) { console.warn('[router] show wallet error', e); }
        finally { updateSidebarFor('cards'); setActiveNav(h); }
        return;
      }

      // META & EVENTOS
      if (h === '#/meta') {
        try {
          showPanel('metaPanel');
          document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view: 'meta' } }));
        } catch (e) {
          console.warn('[router] show meta error', e);
        } finally {
          updateSidebarFor('meta');
          setActiveNav(h);
        }
        return;
      }

      // ACHIEVEMENTS
      if (h === '#/account/achievements') {
        try {
          showPanel('achievementsPanel');
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

      // WIZARD'S VAULT
      if (h === '#/account/wizards-vault') {
        try {
          showPanel('wvPanel');
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

      // ACTIVITIES (NUEVO)
      if (h === '#/activities') {
        try {
          showPanel('activitiesPanel');
          window.Activities?.activate?.();
        } catch (e) {
          console.warn('[router] Activities.activate error', e);
        } finally {
          updateSidebarFor('activities');
          setActiveNav(h);
        }
        return;
      }

      // Fallback -> Wallet
      try { showPanel('walletPanel'); }
      catch (e) { console.warn('[router] fallback show wallet error', e); }
      finally { updateSidebarFor('cards'); setActiveNav('#/cards'); }
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

      } else if (h === '#/account/wizards-vault') {
        if (WV && typeof WV.onTokenChanged === 'function') WV.onTokenChanged(token);
        if (WV && typeof WV.ensureLoadTab === 'function') WV.ensureLoadTab('shop');
        if (WV && typeof WV.refreshObjectives === 'function') WV.refreshObjectives(true);
        if (WV && typeof WV.activate === 'function') WV.activate();
        hydrateWVModePills(el('wvPanel'));

      // ===== NUEVO: Panel de Actividades =====
      } else if (h === '#/activities') {
        var p = document.getElementById('activitiesPanel');
        if (p && !p.hasAttribute('hidden')) {
          try {
            window.Activities?.activate?.();
          } catch (e) {
            console.warn('[router] Activities.activate error', e);
          }
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

    route(); hydrateWVModePills(el('wvPanel'));
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', onDomReady);
  else onDomReady();

})();
``