/*!
 * js/wv-purchase-detail.js — Vista de Detalle de Compras (Wizard's Vault)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.2.1 (2026-03-04)
 *
 * Parches de estabilidad (vs 1.2.0):
 *  - Apertura tras F5 sólo en gn:nav-active con reopen guard (sin setTimeout inicial).
 *  - MutationObserver del toolbar con throttle en rAF y sin re-asignar innerHTML innecesariamente.
 *  - Catálogo de ítems: sólo item_id de columnas activas (pinned), lazy en idle + cap de seguridad, con backfill de headers.
 *  - refresh() coalesced: guardia in-flight + seq (last-win).
 *  - Se preservan: iconos AA/ítems, purchased+marks, persistencia wvpd_open y botón con imagen por URL.
 */

(function (root) {
  'use strict';
  var LOG = '[WV-PurchaseDetail]';

  // ------------------------------ Utils DOM ------------------------------
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtInt(n){ n=Number(n||0); return n.toLocaleString('es-AR'); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }
  function rIC(fn, opts){
    try { if ('requestIdleCallback' in window) return window.requestIdleCallback(fn, opts||{timeout:1200}); } catch(_){}
    return setTimeout(fn, (opts && opts.timeout) || 200);
  }

  // ------------------------------ Constantes LS --------------------------
  var LS_KEYS             = 'gw2_keys';
  var LS_WV_SHOP_PINNED   = 'gw2_wv_pinned_v1';
  var LS_WV_SHOP_MARKS    = 'gw2_wv_marks_v1';
  var LS_WVPD_ICON_URL    = 'wvpd_icon_url';
  var LS_WVPD_OPEN        = 'wvpd_open';

  // ------------------------------ Estado --------------------------------
  var state = {
    inited: false,
    season: null,
    keys: [],
    accounts: [],             // [{ fp,label,token,aa,aaIcon,itemsById,rows,pinned,marks }]
    pinnedUnion: [],          // [listingId...]
    globalItemsById: new Map(), // Map(item_id -> item meta) - reducido a columnas activas
    filters: { q:'', onlyPending:false, onlyPendingCols:false, sort:'delta' },
    loading: false,
    prevTab: 'shop',
    tabsHidden: false,
    accessIconUrl: null
  };

  // Guards
  var _reopenOnceToken = 0;
  var _refreshInFlight = null;
  var _refreshSeq = 0;

  // ------------------------------ Estilos --------------------------------
  function injectStyles(){
    if (document.getElementById('wv-pd-styles')) return;
    var css = `
      #wvPDPanel.panel{ margin-top: 12px; }
      #wvPDPanel[hidden]{ display:none !important; }

      .wvpd-header{
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        background: linear-gradient(90deg, #0f1013 0%, #181b22 100%);
        border:1px solid #26262b; border-radius:12px; padding:10px 12px; margin-bottom:10px;
      }
      .wvpd-header__left{ display:flex; align-items:center; gap:10px; }
      .wvpd-banner{
        display:flex; align-items:center; gap:10px;
        background: #0b0e13; border:1px solid #20242d; border-radius:10px; padding:8px 10px;
      }
      .wvpd-banner__icon{
        width:36px; height:36px; border-radius:8px; background:#111726; display:flex; align-items:center; justify-content:center;
        box-shadow: 0 0 0 1px #2a2a30 inset;
      }
      .wvpd-banner__title{ font-weight:700; }
      .wvpd-help{ color:#a0a6b3; font-size:12px; }
      .wvpd-stickyhint{ color:#a0a6b3; font-size:12px; margin-left:8px; }

      .wvpd-filters{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; }
      .wvpd-filters input[type="text"]{ min-width:220px; }

      .wv-shop-toolbar .group{ display:flex; align-items:center; }
      #wvPDOpenBtn{ margin-left:auto; }
      .wvpd-iconbtn{
        width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;
        background:#111319; border:1px solid #2c2f36; cursor:pointer;
      }
      .wvpd-iconbtn:hover{ border-color:#3b4352; }
      .wvpd-iconbtn img{ width:18px; height:18px; border-radius:4px; display:block; }

      .wvpd-tablewrap{ overflow:auto; border:1px solid #26262b; border-radius:10px; }
      table.wvpd{ border-collapse:separate; border-spacing:0; width:100%; }
      table.wvpd th, table.wvpd td{ padding:8px 10px; border-bottom:1px solid #24252a; white-space:nowrap; }
      table.wvpd thead th{ position:sticky; top:0; background:#101217; z-index:2; }
      table.wvpd th:first-child, table.wvpd td:first-child{ position:sticky; left:0; background:#0e1116; z-index:1; }

      th.wvpd-th-item{ text-align:center; min-width:48px; }
      th.wvpd-th-item img{ width:22px; height:22px; border-radius:6px; vertical-align:middle; box-shadow:0 0 0 1px #2a2a30 inset; }

      .wvpd-aahead{ display:inline-flex; align-items:center; gap:6px; }
      .wvpd-aahead img{ width:16px; height:16px; vertical-align:middle; border-radius:4px; box-shadow:0 0 0 1px #2a2a30 inset; }

      .right{ text-align:right; }
      .center{ text-align:center; }
      .wvpd-muted{ color:#9aa0aa; }
      .wvpd-green{ color:#a0ffc8; }
      .wvpd-red{ color:#ff9d9d; }
      .wvpd-pill{ display:inline-block; padding:2px 6px; border-radius:6px; font-size:12px; border:1px solid #2b2b30; color:#cfd2d8; }

      .wvpd-status-ok{ color:#a0ffc8; }
      .wvpd-status-bad{ color:#ff9d9d; }

      .wvpd-compact table.wvpd th, .wvpd-compact table.wvpd td{ padding:6px 8px; }
    `;
    var s = document.createElement('style'); s.id='wv-pd-styles'; s.textContent = css; document.head.appendChild(s);
  }

  // ------------------------------ Botón acceso (toolbar) -----------------
  function svgCamera(){
    return (
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'+
        '<path fill="#8ab4f8" d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4z"/>'+
        '<circle cx="12" cy="12" r="4" fill="#c3e88d"/>'+
      '</svg>'
    );
  }
  function accessIconHTML(){
    var u = state.accessIconUrl || (function(){ try{ return localStorage.getItem(LS_WVPD_ICON_URL)||''; }catch(_){ return ''; } })();
    if (u && /^https?:\/\//i.test(u)) {
      return '<img src="'+esc(u)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
    }
    return svgCamera();
  }
  function ensureToolbarButton(){
    try{
      var host = document.getElementById('wvShopToolbarHost'); if (!host) return;
      var toolbar = host.querySelector('.wv-shop-toolbar'); if (!toolbar) return;

      var group = toolbar.querySelector('.group') || toolbar;
      var clearBtn = group.querySelector('#wvClearSynced');
      var insertAfter = clearBtn || group.lastElementChild;

      var existing = group.querySelector('#wvPDOpenBtn');
      if (existing) {
        existing.classList.add('wvpd-iconbtn');
        existing.setAttribute('data-wvpd-open','1');
        existing.title = 'Detalle de compras (todas las cuentas)';
        existing.style.marginLeft = 'auto';
        // Evitar loop por innerHTML: sólo tocar img src si cambió
        var wantUrl = state.accessIconUrl || (function(){ try{ return localStorage.getItem(LS_WVPD_ICON_URL)||''; }catch(_){ return ''; } })();
        var img = existing.querySelector('img');
        if (img && wantUrl && img.src !== wantUrl) img.src = wantUrl;
        if (!img && wantUrl) existing.innerHTML = accessIconHTML();
        return;
      }

      var btn = document.createElement('button');
      btn.id = 'wvPDOpenBtn';
      btn.setAttribute('data-wvpd-open','1');
      btn.className = 'wvpd-iconbtn';
      btn.title = 'Detalle de compras (todas las cuentas)';
      btn.setAttribute('aria-label','Detalle de compras');
      btn.innerHTML = accessIconHTML();
      btn.style.marginLeft = 'auto';

      if (insertAfter && insertAfter.parentNode === group) insertAfter.insertAdjacentElement('afterend', btn);
      else group.appendChild(btn);

    }catch(e){ console.warn(LOG, 'ensureToolbarButton', e); }
  }
  function observeToolbar(){
    var host = document.getElementById('wvShopToolbarHost');
    if (!host) return;

    // Delegación click
    if (!host.__wvpdDelegated){
      host.__wvpdDelegated = true;
      host.addEventListener('click', function(ev){
        var t = ev.target;
        while (t && t !== host && !t.hasAttribute('data-wvpd-open')) t = t.parentElement;
        if (t && t.hasAttribute('data-wvpd-open')) {
          try { WVPurchaseDetail.show(); } catch (e) { console.warn(LOG, 'show error', e); }
        }
      });
    }

    // MO con throttle en rAF
    if (!host.__wvpdObs){
      var scheduled = false;
      var mo = new MutationObserver(function(){
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function(){ scheduled = false; ensureToolbarButton(); });
      });
      try { mo.observe(host, { childList:true, subtree:true }); host.__wvpdObs = mo; } catch(_){}
    }

    ensureToolbarButton();
  }

  // ------------------------------ Panel / Vista -------------------------
  function firstWVTabNode(){ return $('#wvTabDaily') || $('#wvTabWeekly') || $('#wvTabSpecial') || $('#wvTabShop'); }
  function setTabsVisible(visible){
    ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function(id){
      var n = document.getElementById(id);
      if (!n) return;
      if (visible) n.removeAttribute('hidden'); else n.setAttribute('hidden','');
    });
    state.tabsHidden = !visible;
  }

  function ensurePanel(){
    var wvPanel = document.getElementById('wvPanel'); if (!wvPanel) return null;

    var panel = document.getElementById('wvPDPanel');
    if (!panel){
      panel = document.createElement('section');
      panel.id = 'wvPDPanel';
      panel.className = 'panel';
      panel.setAttribute('hidden','');
      var anchor = firstWVTabNode();
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      else wvPanel.appendChild(panel);
    }

    if (!panel.__wired){
      panel.__wired = true;
      panel.innerHTML = [
        '<div class="panel-head"><h3 class="panel-head__title">Detalle de compras — Wizard’s Vault</h3></div>',
        '<div class="panel__body">',
          '<div class="wvpd-header">',
            '<div class="wvpd-header__left">',
              '<div class="wvpd-banner">',
                '<div class="wvpd-banner__icon">'+svgCamera()+'</div>',
                '<div>',
                  '<div class="wvpd-banner__title">Cámara del brujo</div>',
                  '<div class="wvpd-help">Progreso por cuenta e ítems fijados. Usá las tabs de WV para volver.</div>',
                '</div>',
              '</div>',
              '<span class="wvpd-stickyhint">Desplazá lateralmente para ver todas las columnas.</span>',
            '</div>',
          '</div>',
          '<div class="wvpd-filters">',
            '<input type="text" id="wvpdSearch" placeholder="Buscar cuenta…">',
            '<label><input type="checkbox" id="wvpdOnlyPending"> Solo pendientes</label>',
            '<label><input type="checkbox" id="wvpdOnlyPendingCols"> Solo columnas con pendientes</label>',
            '<label>Orden: ',
              '<select id="wvpdSort">',
                '<option value="delta">Δ (desc)</option>',
                '<option value="label">Cuenta (A→Z)</option>',
              '</select>',
            '</label>',
            '<label class="wvpd-compact-toggle"><input type="checkbox" id="wvpdCompact"> Vista compacta</label>',
          '</div>',
          '<div id="wvpdStatus" class="muted" style="margin:6px 0 10px 0">—</div>',
          '<div class="wvpd-tablewrap"><table class="wvpd" id="wvpdTable"><thead></thead><tbody></tbody></table></div>',
        '</div>'
      ].join('');

      // Filtros
      var t=null, rootPanel = panel;
      rootPanel.querySelector('#wvpdSearch')?.addEventListener('input', function(e){
        clearTimeout(t); t=setTimeout(function(){ state.filters.q = e.target.value.trim().toLowerCase(); renderTable(); }, 160);
      });
      rootPanel.querySelector('#wvpdOnlyPending')?.addEventListener('change', function(e){ state.filters.onlyPending = !!e.target.checked; renderTable(); });
      rootPanel.querySelector('#wvpdOnlyPendingCols')?.addEventListener('change', function(e){ state.filters.onlyPendingCols = !!e.target.checked; safeRefresh(false); });
      rootPanel.querySelector('#wvpdSort')?.addEventListener('change', function(e){ state.filters.sort = e.target.value||'delta'; renderTable(); });
      rootPanel.querySelector('#wvpdCompact')?.addEventListener('change', function(e){
        var wrap = panel.closest('.panel'); if (!wrap) wrap = panel;
        wrap.classList.toggle('wvpd-compact', !!e.target.checked);
      });

      // Tabs de WV cierran esta vista
      ['wvTabBtnDaily','wvTabBtnWeekly','wvTabBtnSpecial','wvTabBtnShop'].forEach(function(id){
        var b = document.getElementById(id);
        if (b && !b.__wvpdWired){
          b.__wvpdWired = true;
          b.addEventListener('click', function(){ try { WVPurchaseDetail.hide(); } catch(_){ } });
        }
      });
    }
    return panel;
  }

  function setStatus(msg, kind){
    var el = document.getElementById('wvpdStatus'); if (!el) return;
    el.textContent = String(msg||'');
    el.classList.remove('error','muted');
    if (kind==='error') el.classList.add('error'); else el.classList.add('muted');
  }
  function showPanel(){ var p = ensurePanel(); if (p) p.removeAttribute('hidden'); }
  function hidePanel(){ var p = ensurePanel(); if (p) p.setAttribute('hidden',''); }

  // ------------------------------ Datos / Carga --------------------------
  function loadKeys(){
    try { var list = JSON.parse(localStorage.getItem(LS_KEYS)||'[]'); return Array.isArray(list)?list:[]; }
    catch(_){ return []; }
  }
  function loadPinnedNS(ns){
    try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_PINNED)||'{}'); var bag = all && all[ns]; return (bag && typeof bag==='object') ? bag : {}; }
    catch(_){ return {}; }
  }
  function loadMarksNS(ns){
    try { var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS)||'{}');  var bag = all && all[ns]; return (bag && typeof bag==='object') ? bag : {}; }
    catch(_){ return {}; }
  }
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }
  function marksNamespace(token, season){
    var fp = fpToken(token);
    var sid = (season && (season.id || season.title)) || 'season';
    return fp + ':' + sid;
  }

  function computePinnedUnion(accounts){
    var ids = new Set();
    accounts.forEach(function(acc){
      var p = acc.pinned || {};
      Object.keys(p).forEach(function(id){ if (p[id]) ids.add(Number(id)); });
    });
    return Array.from(ids.values()).sort(function(a,b){ return a-b; });
  }

  async function loadAll(forceNoCache){
    state.loading = true;
    setStatus('Cargando datos de cuentas…');

    try { state.season = await root.GW2Api.getWVSeason({ nocache: !!forceNoCache }); }
    catch(e){ console.warn(LOG,'season', e); state.season = null; }

    state.keys = loadKeys();
    if (!state.keys.length){
      state.accounts = []; state.pinnedUnion = []; state.globalItemsById.clear();
      setStatus('No hay API Keys guardadas. Agregá una desde el menú de keys.', 'error');
      state.loading=false; return;
    }

    var out = [];
    var idx = 0, ACTIVE=0, MAX=2;
    await new Promise(function(resolve){
      function next(){
        if (idx>=state.keys.length && ACTIVE===0) return resolve();
        while (ACTIVE<MAX && idx<state.keys.length){
          var it = state.keys[idx++]; ACTIVE++;
          (function(k){
            var token = k.value; var label = k.label || ('Key '+fpToken(token));
            var ns = marksNamespace(token, state.season);
            var pinned = loadPinnedNS(ns);
            var marks  = loadMarksNS(ns);
            root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache })
              .then(function(pkg){
                out.push({
                  token: token,
                  fp: fpToken(token),
                  label: label,
                  aa: Number(pkg && pkg.aa || 0),
                  aaIcon: (pkg && pkg.aaIconUrl) || null,
                  itemsById: pkg && pkg.itemsById || new Map(),
                  rows: Array.isArray(pkg && pkg.rows) ? pkg.rows : [],
                  pinned: pinned || {},
                  marks: marks || {}
                });
              })
              .catch(function(e){
                console.warn(LOG, 'getWVShopMerged', e);
                out.push({ token: token, fp: fpToken(token), label: label, aa:0, aaIcon:null, itemsById:new Map(), rows:[], pinned: pinned||{}, marks:marks||{}, error: e });
              })
              .finally(function(){ ACTIVE--; next(); });
          })(it);
        }
      }
      next();
    });

    state.accounts = out;
    state.pinnedUnion = computePinnedUnion(out);
    state.globalItemsById.clear(); // se poblara lazy para columnas activas

    setStatus(state.pinnedUnion.length ? 'Listo.' : 'No hay ítems fijados en ninguna cuenta.');
    state.loading = false;
  }

  // ------------------------------ Helpers ítems/AA -----------------------
  function anyAAIcon(){
    for (var i=0;i<state.accounts.length;i++){
      var u = state.accounts[i] && state.accounts[i].aaIcon;
      if (u) return String(u);
    }
    return null; // fallback
  }
  function aaIconHTML(size){
    var url = anyAAIcon();
    if (!url) return 'AA';
    var s = Number(size||16);
    return '<img src="'+esc(url)+'" alt="AA" width="'+s+'" height="'+s+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }
  function getItemMeta(itemId){
    var meta = state.globalItemsById.get(Number(itemId));
    if (meta) return meta;
    // fallback por cuenta
    for (var i=0;i<state.accounts.length;i++){
      var acc = state.accounts[i];
      var map = acc.itemsById;
      try {
        var it = (typeof map.get==='function') ? map.get(Number(itemId)) : map[Number(itemId)];
        if (it) return it;
      }catch(_){}
    }
    return null;
  }
  function findRowByListingId(rows, listingId){
    for (var i=0;i<rows.length;i++){ if (String(rows[i].id)===String(listingId)) return rows[i]; }
    return null;
  }
  function purchasedEff(limit, purchased, marked){
    var eff = Number(purchased||0) + Number(marked||0);
    if (limit==null) return eff;
    return Math.min(eff, Number(limit));
  }
  function cellHTMLForAccountItem(acc, listingId){
    var row = findRowByListingId(acc.rows||[], listingId);
    if (!row) return '<span class="wvpd-muted">—</span>';
    var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
    var purchased = Number(row.purchased||0);
    var marked    = Number((acc.marks||{})[String(listingId)]||0);

    var left = (root.GW2Api && typeof root.GW2Api.wvComputeRemaining==='function')
      ? root.GW2Api.wvComputeRemaining(limit, purchased, marked)
      : (limit==null ? Infinity : Math.max(0, limit - (purchased+marked)));

    var eff = purchasedEff(limit, purchased, marked);
    if (limit==null) return '<span class="wvpd-muted">'+fmtInt(eff)+' / ∞</span>';
    if (left===0)   return '<span class="wvpd-status-ok">Sin stock</span>';
    return '<span class="wvpd-status-bad">'+fmtInt(eff)+' / '+fmtInt(limit)+' — Restante: '+fmtInt(left)+'</span>';
  }
  function cellColorClass(acc, listingId){
    var row = findRowByListingId(acc.rows||[], listingId);
    if (!row) return '';
    var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
    var purchased = Number(row.purchased||0);
    var marked    = Number((acc.marks||{})[String(listingId)]||0);
    if (limit==null) return 'wvpd-muted';
    var left = (root.GW2Api && typeof root.GW2Api.wvComputeRemaining==='function')
      ? root.GW2Api.wvComputeRemaining(limit, purchased, marked)
      : Math.max(0, limit - (purchased+marked));
    return left===0 ? 'wvpd-green' : 'wvpd-red';
  }
  function aaNeededForPinned(acc){
    var sum = 0, pins = acc.pinned || {}, rows = acc.rows || [];
    Object.keys(pins).forEach(function(idStr){
      if (!pins[idStr]) return;
      var row = findRowByListingId(rows, Number(idStr)); if (!row) return;
      var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
      var purchased = Number(row.purchased||0);
      var marked    = Number((acc.marks||{})[String(idStr)]||0);
      var cost      = Number(row.cost||0);
      if (limit==null || !isFinite(cost) || cost<=0) return;
      var left = (root.GW2Api && typeof root.GW2Api.wvComputeRemaining==='function')
        ? root.GW2Api.wvComputeRemaining(limit, purchased, marked)
        : Math.max(0, limit - (purchased+marked));
      sum += left * cost;
    });
    return sum;
  }
  function countPendingForAccount(acc){
    var c = 0, pins = acc.pinned || {}, rows = acc.rows || [];
    Object.keys(pins).forEach(function(idStr){
      if (!pins[idStr]) return;
      var row = findRowByListingId(rows, Number(idStr)); if (!row) return;
      var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
      var purchased = Number(row.purchased||0);
      var marked    = Number((acc.marks||{})[String(idStr)]||0);
      if (limit==null) return;
      var left = (root.GW2Api && typeof root.GW2Api.wvComputeRemaining==='function')
        ? root.GW2Api.wvComputeRemaining(limit, purchased, marked)
        : Math.max(0, limit - (purchased+marked));
      if (left>0) c++;
    });
    return c;
  }

  // ------------------------------ Render Tabla --------------------------
  function renderTable(){
    var table = document.getElementById('wvpdTable');
    var thead = table?.querySelector('thead');
    var tbody = table?.querySelector('tbody');
    if (!thead || !tbody) return;

    var pins = state.pinnedUnion.slice();
    if (state.filters.onlyPendingCols){
      pins = pins.filter(function(listingId){
        for (var i=0;i<state.accounts.length;i++){
          var acc = state.accounts[i];
          var isPinned = !!(acc.pinned && acc.pinned[String(listingId)]);
          if (!isPinned) continue;
          var row = findRowByListingId(acc.rows, listingId); if (!row) continue;
          var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
          var purchased = Number(row.purchased||0);
          var marked    = Number((acc.marks||{})[String(listingId)]||0);
          if (limit==null) continue;
          var left = (root.GW2Api && typeof root.GW2Api.wvComputeRemaining==='function')
            ? root.GW2Api.wvComputeRemaining(limit, purchased, marked)
            : Math.max(0, limit - (purchased+marked));
          if (left>0) return true;
        }
        return false;
      });
    }

    // ----- Encabezado -----
    var hcells = ['<th>Cuenta</th>'];
    pins.forEach(function(listingId){
      // Buscar item_id en cualquier cuenta y meta disponible (puede no estar aún)
      var itemId = null, meta = null, name = '';
      for (var i=0;i<state.accounts.length;i++){
        var acc = state.accounts[i];
        var row = findRowByListingId(acc.rows||[], listingId);
        if (row && row.item_id != null){ itemId = Number(row.item_id); break; }
      }
      if (itemId != null) meta = getItemMeta(itemId);
      if (meta && meta.icon){
        name = meta.name ? esc(meta.name) : ('#'+listingId);
        var icon = '<img src="'+esc(meta.icon)+'" alt="'+name+'" width="22" height="22" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
        hcells.push('<th class="wvpd-th-item" data-listing-id="'+esc(String(listingId))+'" data-item-id="'+esc(String(itemId))+'" title="'+name+' (ID '+esc(String(listingId))+')">'+icon+'</th>');
      } else {
        hcells.push('<th class="wvpd-th-item" data-listing-id="'+esc(String(listingId))+'" title="Item #'+esc(String(listingId))+'">#'+esc(String(listingId))+'</th>');
      }
    });

    var aaI = aaIconHTML(16);
    hcells.push('<th class="right" title="Astral Acclaim disponible"><span class="wvpd-aahead">'+aaI+'<span>disp</span></span></th>');
    hcells.push('<th class="right" title="AA necesarios para completar los ítems fijados"><span class="wvpd-aahead">'+aaI+'<span>necesario</span></span></th>');
    hcells.push('<th class="right" title="Δ AA = disponible − necesario"><span class="wvpd-aahead">'+aaI+'<span>Δ</span></span></th>');

    thead.innerHTML = '<tr>'+hcells.join('')+'</tr>';

    // ----- Filas -----
    var rowsAcc = state.accounts.slice();
    if (state.filters.q){
      var q = state.filters.q;
      rowsAcc = rowsAcc.filter(function(a){ return (a.label||'').toLowerCase().includes(q) || (a.fp||'').toLowerCase().includes(q); });
    }
    if (state.filters.onlyPending){
      rowsAcc = rowsAcc.filter(function(a){ return countPendingForAccount(a) > 0; });
    }
    if (state.filters.sort==='label'){
      rowsAcc.sort(function(a,b){ return String(a.label||'').localeCompare(String(b.label||''),'es'); });
    } else {
      rowsAcc.sort(function(a,b){
        var da = (Number(a.aa||0) - aaNeededForPinned(a));
        var db = (Number(b.aa||0) - aaNeededForPinned(b));
        return db - da;
      });
    }

    var body = rowsAcc.map(function(acc){
      var cells = [];
      var fpBadge = '<span class="wvpd-pill" title="Fingerprint de la key">'+esc(acc.fp||'anon')+'</span>';
      cells.push('<td><strong>'+esc(acc.label||('Key '+esc(acc.fp||'')))+'</strong> '+fpBadge+'</td>');

      pins.forEach(function(listingId){
        var isPinned = !!(acc.pinned && acc.pinned[String(listingId)]);
        if (!isPinned){ cells.push('<td class="center wvpd-muted">—</td>'); return; }
        var cls = cellColorClass(acc, listingId);
        cells.push('<td class="center '+cls+'">'+cellHTMLForAccountItem(acc, listingId)+'</td>');
      });

      var aa = Number(acc.aa||0);
      var aaNeed = aaNeededForPinned(acc);
      var delta = aa - aaNeed;
      var deltaCls = (delta>=0) ? 'wvpd-green' : 'wvpd-red';

      cells.push('<td class="right">'+fmtInt(aa)+'</td>');
      cells.push('<td class="right">'+fmtInt(aaNeed)+'</td>');
      cells.push('<td class="right '+deltaCls+'">'+(delta>=0?'+':'')+fmtInt(delta)+'</td>');

      return '<tr>'+cells.join('')+'</tr>';
    }).join('');

    tbody.innerHTML = body || '<tr><td colspan="'+(1 + pins.length + 3)+'" class="center wvpd-muted">Sin datos para mostrar.</td></tr>';

    // Backfill lazy de iconos en headers si aún no estaban
    lazyBuildItemsCatalogForActiveColumns();
  }

  // ------------------------------ Catálogo ítems (lazy + cap) -----------
  var _itemsBackfillScheduled = false;
  function collectActiveItemIds(){
    // Recolectar sólo los item_id de las columnas (pinned en uso)
    var setIds = new Set();
    var ths = $$('#wvpdTable thead th[data-listing-id]');
    ths.forEach(function(th){
      var listingId = Number(th.getAttribute('data-listing-id'));
      // hallar item_id en cualquier cuenta
      for (var i=0;i<state.accounts.length;i++){
        var acc = state.accounts[i];
        var row = findRowByListingId((acc.rows||[]), listingId);
        if (row && row.item_id != null){ setIds.add(Number(row.item_id)); break; }
      }
    });
    return Array.from(setIds.values());
  }
  function lazyBuildItemsCatalogForActiveColumns(){
    if (_itemsBackfillScheduled) return;
    _itemsBackfillScheduled = true;
    rIC(async function(){
      _itemsBackfillScheduled = false;
      try {
        var ids = collectActiveItemIds();
        if (!ids.length) return;

        // Cap de seguridad
        var cap = 800;
        ids = ids.slice(0, cap);

        // Resta por pedir (si ya tenemos algunos en cache local)
        ids = ids.filter(function(id){ return !state.globalItemsById.has(Number(id)); });
        if (!ids.length) return;

        if (root.GW2Api && typeof root.GW2Api.getItemsMany==='function'){
          var items = await root.GW2Api.getItemsMany(ids, { nocache:false });
          (items||[]).forEach(function(it){ if (it && it.id!=null) state.globalItemsById.set(Number(it.id), it); });
          // Backfill de headers
          backfillHeaderIcons();
        }
      } catch(e){ console.warn(LOG, 'items lazy', e); }
    }, { timeout: 1200 });
  }
  function backfillHeaderIcons(){
    var ths = $$('#wvpdTable thead th[data-listing-id]');
    ths.forEach(function(th){
      // si ya hay img, no tocar
      if (th.querySelector('img')) return;

      var listingId = Number(th.getAttribute('data-listing-id'));
      var itemMeta = null, itemId = null;
      for (var i=0;i<state.accounts.length;i++){
        var acc = state.accounts[i];
        var row = findRowByListingId((acc.rows||[]), listingId);
        if (row && row.item_id != null){
          itemId = Number(row.item_id);
          itemMeta = getItemMeta(itemId);
          if (itemMeta) break;
        }
      }
      if (itemMeta && itemMeta.icon){
        var name = itemMeta.name ? esc(itemMeta.name) : ('#'+listingId);
        th.setAttribute('title', name+' (ID '+esc(String(listingId))+')');
        th.innerHTML = '<img src="'+esc(itemMeta.icon)+'" alt="'+name+'" width="22" height="22" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
      }
    });
  }

  // ------------------------------ API pública ---------------------------
  var WVPurchaseDetail = {
    async initOnce(){
      if (state.inited) return;
      injectStyles();
      observeToolbar();
      ensurePanel();
      try { state.accessIconUrl = localStorage.getItem(LS_WVPD_ICON_URL) || null; } catch(_){}

      state.inited = true;

      // Reapertura tras F5 SOLO en gn:nav-active (guard por navegación)
      document.addEventListener('gn:nav-active', function(ev){
        try {
          var h = String(ev && ev.detail && ev.detail.hash || '').toLowerCase();
          if (h !== '#/account/wizards-vault') return;

          var myToken = ++_reopenOnceToken;
          var open = null; try { open = localStorage.getItem(LS_WVPD_OPEN); } catch(_){}
          if (open === '1') {
            requestAnimationFrame(function(){ if (_reopenOnceToken === myToken) WVPurchaseDetail.show(); });
          }
          observeToolbar(); // asegurar botón
        } catch(_){}
      });

      // Storage (throttle) — refrescar si está visible
      var _stTimer = null;
      window.addEventListener('storage', function(e){
        if (!e) return;
        if (e.key!==LS_KEYS && e.key!==LS_WV_SHOP_PINNED && e.key!==LS_WV_SHOP_MARKS) return;
        var p = document.getElementById('wvPDPanel');
        if (!p || p.hasAttribute('hidden')) return;
        clearTimeout(_stTimer);
        _stTimer = setTimeout(function(){ safeRefresh(false); }, 400);
      });

      // Tabs de WV cierran esta vista
      ['wvTabBtnDaily','wvTabBtnWeekly','wvTabBtnSpecial','wvTabBtnShop'].forEach(function(id){
        var b = document.getElementById(id);
        if (b && !b.__wvpdWired){
          b.__wvpdWired = true;
          b.addEventListener('click', function(){ try { WVPurchaseDetail.hide(); } catch(_){ } });
        }
      });
    },

    async show(){
      await this.initOnce();
      try { localStorage.setItem(LS_WVPD_OPEN, '1'); } catch(_){}
      setTabsVisible(false);
      showPanel();
      try { document.getElementById('wvPanel')?.scrollIntoView({ behavior:'smooth', block:'start' }); }
      catch(_){ window.scrollTo({ top: 0, behavior: 'smooth' }); }
      await safeRefresh(false);
    },

    hide(){
      try { localStorage.setItem(LS_WVPD_OPEN, '0'); } catch(_){}
      setTabsVisible(true);
      try { if (root.WV && typeof root.WV.setActiveTab==='function') root.WV.setActiveTab(state.prevTab || 'shop'); } catch(_){}
      hidePanel();
      try { document.getElementById('wvPanel')?.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(_){}
    },

    // Mantengo por compat; internamente usa safeRefresh
    async refresh(forceNoCache){ await safeRefresh(!!forceNoCache); },

    // Imagen custom del botón acceso (persistente)
    setIcon: function(url){
      state.accessIconUrl = (url && String(url).trim()) || null;
      try {
        if (state.accessIconUrl) localStorage.setItem(LS_WVPD_ICON_URL, state.accessIconUrl);
        else localStorage.removeItem(LS_WVPD_ICON_URL);
      } catch(_){}
      ensureToolbarButton();
    }
  };

  async function safeRefresh(forceNoCache){
    const mySeq = ++_refreshSeq;
    if (_refreshInFlight){
      try { await _refreshInFlight; } catch(_){}
      if (mySeq !== _refreshSeq) return; // ya vino un pedido más nuevo
    }

    _refreshInFlight = (async () => {
      setStatus('Actualizando…');
      await loadAll(!!forceNoCache);
      renderTable(); // pinta rápido; backfill de iconos va en idle
      setStatus('Listo.');
    })();

    try { await _refreshInFlight; }
    finally { if (mySeq === _refreshSeq) _refreshInFlight = null; }
  }

  // Exponer en window
  root.WVPurchaseDetail = WVPurchaseDetail;

  // Bootstrap
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ WVPurchaseDetail.initOnce(); });
  else WVPurchaseDetail.initOnce();

  console.info(LOG, 'ready 1.2.1');

})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));