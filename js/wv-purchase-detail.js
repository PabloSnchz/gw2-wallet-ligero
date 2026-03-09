/*!
 * js/wv-purchase-detail.js — Vista de Detalle de Compras (Wizard's Vault)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.6.0 (2026-03-09) — Progreso semanal por cuenta + colores internos (sin script externo)
 *
 * Cambios:
 *  - Cuenta coloreada según progreso de “Meta de la temporada” (0–3/6 rojo, 4–5/6 amarillo, 6/6 verde).
 *  - Estilos internos para .wvpd-red / .wvpd-green / .wvpd-acc--{red|yellow|green} y delta ok/bad.
 *  - Se mantiene “Sin stock” en verde y “Restante” en rojo (clases propias).
 *  - Sin dependencias del script de index.html que coloreaba "Restante".
 */

(function (root) {
  'use strict';
  var LOG = '[WV-PurchaseDetail]';

  // ------------------------------ Utils DOM ------------------------------
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtInt(n){ if (n==null || !isFinite(n)) return '—'; n=Number(n||0); return n.toLocaleString('es-AR'); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function rIC(fn, opts){
    try { if ('requestIdleCallback' in window) return window.requestIdleCallback(fn, opts||{timeout:1200}); } catch(_){}
    return setTimeout(fn, (opts && opts.timeout) || 200);
  }
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }

  // ------------------------------ Estado -------------------------------
  var state = {
    inited: false,

    currentSeason: { year:null, seq:null, season_id:null, title:null, start:null, end:null },

    // Single-season: no hay selectedSeason ni seasonsIdx
    keys: [],
    accounts: [],            // cada cuenta ahora incluye seasonMetaSteps (0..6)
    pinnedUnion: [],
    globalItemsById: new Map(),

    filters: { q:'', onlyPending:false, onlyPendingCols:false, sort:'delta' },

    loading: false,
    prevTab: 'shop',
    tabsHidden: false,
    accessIconUrl: null,
    dashTimer: null
  };

  var _refreshInFlight = null;
  var _refreshSeq = 0;
  var _itemsBackfillScheduled = false;

  // ------------------------------ Estilos --------------------------------
  function injectStyles(){
    if (document.getElementById('wv-pd-styles')) return;

    var css = `
      /* ====== Purchase Detail skin ====== */
      #wvPDPanel.panel{ margin-top: 12px; }
      #wvPDPanel[hidden]{ display:none !important; }
      .wvpd-dash{ display:grid; gap:10px; margin-bottom:12px; }
      .wvpd-dash__grid{ display:grid; gap:10px; grid-template-columns: repeat(3, minmax(0,1fr)); }
      .wvpd-card{ background: linear-gradient(180deg, #0f1116 0%, #0d0f14 100%); border:1px solid #26262b; border-radius:12px; padding:10px 12px; }
      .wvpd-kpi{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .wvpd-kpi__lbl{ color:#a0a6b3; font-size:12px; display:inline-flex; align-items:center; gap:8px; }
      .wvpd-kpi__val{ font-size:20px; font-weight:800; letter-spacing:0.2px; }
      .wvpd-kpi--ok .wvpd-kpi__val{ color:#a0ffc8; }
      .wvpd-kpi--warn .wvpd-kpi__val{ color:#ffd36b; }
      .wvpd-kpi--bad .wvpd-kpi__val{ color:#ff9d9d; }
      .wvpd-rows{ display:grid; gap:8px; grid-template-columns: 1.2fr 1.8fr; }
      @media (max-width: 980px){ .wvpd-rows{ grid-template-columns: 1fr; } }
      .wvpd-rot{ display:flex; gap:10px; flex-wrap:wrap; }
      .wvpd-cols{ display:flex; gap:10px; flex-wrap:wrap; }
      .wvpd-col{ flex:1 1 240px; min-width:220px; }
      .wvpd-list{ margin:0; padding:0; list-style:none; display:grid; gap:6px; }
      .wvpd-li{ display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0c0e13; border:1px solid #222631; border-radius:10px; padding:8px 10px; }
      .wvpd-li__icon img{ width:22px; height:22px; border-radius:6px; }
      .wvpd-header{ display:flex; align-items:center; justify-content:space-between; gap:8px; background:#0f1013; border:1px solid #26262b; border-radius:12px; padding:10px 12px; margin-bottom:10px; }
      .wvpd-banner{ display:flex; align-items:center; gap:10px; background:#0b0e13; border:1px solid #20242d; border-radius:10px; padding:8px 10px; }
      .wvpd-filters{ display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; }
      .wvpd-tablewrap{ overflow:auto; border:1px solid #26262b; border-radius:10px; }
      table.wvpd{ border-collapse:separate; border-spacing:0; width:100%; }
      table.wvpd th, table.wvpd td{ padding:8px 10px; border-bottom:1px solid #24252a; white-space:nowrap; }
      table.wvpd thead th{ position:sticky; top:0; background:#101217; z-index:2; }
      table.wvpd th:first-child, table.wvpd td:first-child{ position:sticky; left:0; background:#0e1116; z-index:1; }

      /* ====== Colores canónicos para PD ====== */
      .wvpd-green{ color:#a0ffc8 !important; font-weight:700; }
      .wvpd-red{   color:#ff9d9d !important; font-weight:700; }
      .wvpd-acc--red{ color:#ff9d9d !important; font-weight:800; }
      .wvpd-acc--yellow{ color:#ffd36b !important; font-weight:800; }
      .wvpd-acc--green{ color:#a0ffc8 !important; font-weight:900; }

      /* Delta en Top cuentas */
      .wvpd-li__delta--bad{ color:#ff9d9d !important; font-weight:700; }
      .wvpd-li__delta--ok{  color:#a0ffc8 !important; font-weight:700; }
    `;

    var s = document.createElement('style');
    s.id='wv-pd-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ------------------------------ Acceso ícono / banner ------------------
  function svgCamera() {
    return (
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
        '<path fill="#8ab4f8" d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4z"/>' +
        '<circle cx="12" cy="12" r="4" fill="#c3e88d"/>' +
      '</svg>'
    );
  }

  function accessIconHTML(){
    var u = state.accessIconUrl || localStorage.getItem('wvpd_icon_url') || '';
    if (u && /^https?:\/\//i.test(u)) {
      return '<img src="'+esc(u)+'" alt="" loading="lazy">';
    }
    return svgCamera();
  }
  function bannerIconHTML(){ return accessIconHTML(); }

  function updateBannerIcon(){
    var el = document.getElementById('wvpdBannerIcon');
    if (!el) return;
    el.innerHTML = bannerIconHTML();
  }

  // ------------------------------ Toolbar button Tienda ------------------
  function ensureToolbarButton(){
    try{
      var host = document.getElementById('wvShopToolbarHost');
      if (!host) return;
      var toolbar = host.querySelector('.wv-shop-toolbar');
      if (!toolbar) return;

      var group = toolbar.querySelector('.group') || toolbar;
      var clearBtn = group.querySelector('#wvClearSynced');
      var insertAfter = clearBtn || group.lastElementChild;

      var existing = group.querySelector('#wvPDOpenBtn');
      if (existing) {
        existing.classList.add('wvpd-iconbtn');
        existing.setAttribute('data-wvpd-open','1');
        existing.title = 'Detalle de compras (todas las cuentas)';
        existing.style.marginLeft = 'auto';
        existing.innerHTML = accessIconHTML();

        if (!existing.__wvpdClick){
          existing.__wvpdClick = true;
          existing.addEventListener('click', function(ev){
            ev.preventDefault();
            try { window.WVPurchaseDetail?.show(); }
            catch(e){ console.warn('[WV-PD] show() error (existing)', e); }
          });
        }
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

      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        try { window.WVPurchaseDetail?.show(); }
        catch(e){ console.warn('[WV-PD] show() error (new)', e); }
      });

      if (insertAfter && insertAfter.parentNode === group)
        insertAfter.insertAdjacentElement('afterend', btn);
      else
        group.appendChild(btn);

      console.debug('[WV-PD] Toolbar button ready');

    }catch(e){ console.warn('[WV-PD] ensureToolbarButton', e); }
  }

  // --- Mantener el delegado (por si el botón se re-renderiza) ---
  function observeToolbar(){
    var host = document.getElementById('wvShopToolbarHost');
    if (!host) return;

    if (!host.__wvpdDelegated){
      host.__wvpdDelegated = true;
      host.addEventListener('click', function(ev){
        var t = ev.target;
        while (t && t !== host && !t.hasAttribute('data-wvpd-open')) t = t.parentElement;
        if (t && t.hasAttribute('data-wvpd-open')) {
          ev.preventDefault();
          try { window.WVPurchaseDetail?.show(); }
          catch (e) { console.warn('[WV-PD] show error (delegated)', e); }
        }
      });
    }

    if (!host.__wvpdObs){
      var scheduled = false;
      var mo = new MutationObserver(function(){
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function(){
          scheduled = false;
          ensureToolbarButton(); // reinyecta/re-cablea tras cambios en toolbar
        });
      });
      try { mo.observe(host, { childList:true, subtree:true }); host.__wvpdObs = mo; } catch(_){}
    }

    ensureToolbarButton();
  }

  // ------------------------------ Panel ------------------------------------
  function firstWVTabNode(){ return $('#wvTabDaily') || $('#wvTabWeekly') || $('#wvTabSpecial') || $('#wvTabShop'); }

  function setTabsVisible(visible){
    ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function(id){
      var n = document.getElementById(id);
      if (!n) return;
      if (visible) n.removeAttribute('hidden'); 
      else n.setAttribute('hidden','');
    });
    state.tabsHidden = !visible;
  }

  function ensurePanel(){
    var wvPanel = document.getElementById('wvPanel'); 
    if (!wvPanel) return null;

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

          // DASHBOARD
          '<div id="wvpdDash" class="wvpd-dash">',

            '<div class="wvpd-dash__grid">',
              '<div class="wvpd-card wvpd-kpi" id="wvpdKpiAAAvail">',
                '<div class="wvpd-kpi__lbl"><span class="aa-ico"></span><span>Total disponible</span></div>',
                '<div class="wvpd-kpi__val">—</div>',
              '</div>',
              '<div class="wvpd-card wvpd-kpi" id="wvpdKpiAANeed">',
                '<div class="wvpd-kpi__lbl"><span class="aa-ico"></span><span>Necesaria (fijados)</span></div>',
                '<div class="wvpd-kpi__val">—</div>',
              '</div>',
              '<div class="wvpd-card wvpd-kpi" id="wvpdKpiAADelta">',
                '<div class="wvpd-kpi__lbl"><span class="aa-ico"></span><span>Δ Global</span></div>',
                '<div class="wvpd-kpi__val">—</div>',
              '</div>',
            '</div>',

            '<div class="wvpd-rows">',
              '<div class="wvpd-card">',
                '<div class="wvpd-rot">',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+clockSvg()+'</span><strong id="wvpdCountDaily">—</strong></span>',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+clockSvg()+'</span><strong id="wvpdCountWeekly">—</strong></span>',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+clockSvg()+'</span><strong id="wvpdCountSeason">—</strong></span>',
                '</div>',

                '<div id="wvpdUsefulBox" style="margin-top:10px; display:grid; gap:8px">',
                  '<div class="wvpd-kpi__lbl">Datos útiles</div>',
                  '<div id="wvpdUsefulContent" class="wvpd-cols"></div>',
                '</div>',
              '</div>',

              '<div class="wvpd-card">',
                '<div class="wvpd-cols">',
                  '<div class="wvpd-col">',
                    '<div class="wvpd-kpi__lbl" style="margin-bottom:6px">Top cuentas deficitarias</div>',
                    '<ul id="wvpdTopAccounts" class="wvpd-list"></ul>',
                  '</div>',
                  '<div class="wvpd-col">',
                    '<div class="wvpd-kpi__lbl" style="margin-bottom:6px">Top ítems más pendientes</div>',
                    '<ul id="wvpdTopItems" class="wvpd-list"></ul>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',

          '</div>',

          // TOOLBAR
          '<div class="wvpd-header">',
            '<div class="wvpd-header__left">',
              '<div class="wvpd-banner">',
                '<div class="wvpd-banner__icon" id="wvpdBannerIcon">'+bannerIconHTML()+'</div>',
                '<div>',
                  '<div class="wvpd-banner__title">Cámara del brujo</div>',
                  '<div class="wvpd-help">Resumen estratégico y detalle por cuenta/ítem fijado.</div>',
                '</div>',
              '</div>',
              '<span class="wvpd-stickyhint">Tip: “Solo pendientes” y orden por Δ priorizan lo crítico.</span>',
            '</div>',
          '</div>',

          // FILTROS
          '<div class="wvpd-filters" id="wvpdFilters">',
            '<input type="text" id="wvpdSearch" placeholder="Buscar cuenta…">',
            '<label><input type="checkbox" id="wvpdOnlyPending"> Solo pendientes</label>',
            '<label><input type="checkbox" id="wvpdOnlyPendingCols"> Solo columnas con pendientes</label>',
            '<label>Orden: <select id="wvpdSort"><option value="delta">Δ (desc)</option><option value="label">Cuenta (A→Z)</option></select></label>',
            '<label class="wvpd-compact-toggle"><input type="checkbox" id="wvpdCompact"> Vista compacta</label>',
          '</div>',

          '<div id="wvpdStatus" class="muted" style="margin:6px 0 10px 0">—</div>',

          // TABLA
          '<div class="wvpd-tablewrap" id="wvpdTableWrap">',
            '<table class="wvpd" id="wvpdTable">',
              '<thead></thead>',
              '<tbody></tbody>',
            '</table>',
          '</div>',

        '</div>'
      ].join('');

      // Wires filtros
      var rootPanel = panel, t=null;

      rootPanel.querySelector('#wvpdSearch')?.addEventListener('input', function(e){
        clearTimeout(t); t=setTimeout(function(){ state.filters.q = e.target.value.trim().toLowerCase(); renderTable(); updateDashboard(); }, 160);
      });
      rootPanel.querySelector('#wvpdOnlyPending')?.addEventListener('change', function(e){ state.filters.onlyPending = !!e.target.checked; renderTable(); updateDashboard(); });
      rootPanel.querySelector('#wvpdOnlyPendingCols')?.addEventListener('change', function(e){ state.filters.onlyPendingCols = !!e.target.checked; safeRefresh(false); });
      rootPanel.querySelector('#wvpdSort')?.addEventListener('change', function(e){ state.filters.sort = e.target.value||'delta'; renderTable(); });

      rootPanel.querySelector('#wvpdCompact')?.addEventListener('change', function(e){
        var wrap = panel.closest('.panel') || panel;
        wrap.classList.toggle('wvpd-compact', !!e.target.checked);
      });

      // Tabs WV cierran esta vista
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

  function clockSvg(){
    return '<svg viewBox="0 0 24 24"><g fill="none" stroke="#cdd2da" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/></g></svg>';
  }

  function setStatus(msg, kind){
    var el = document.getElementById('wvpdStatus'); if (!el) return;
    el.textContent = String(msg||'');
    el.classList.remove('error','muted');
    if (kind==='error') el.classList.add('error'); 
    else el.classList.add('muted');
  }

  function showPanel(){ var p = ensurePanel(); if (p) p.removeAttribute('hidden'); }
  function hidePanel(){ var p = ensurePanel(); if (p) p.setAttribute('hidden',''); }

  // ------------------------------ Datos ------------------------------------
  function loadKeys(){
    try { var list = JSON.parse(localStorage.getItem('gw2_keys')||'[]'); return Array.isArray(list)?list:[]; }
    catch(_){ return []; }
  }

  function getPinnedFromStore(year, seq, fp){
    if (!root.WVSeasonStore) return {};
    try { return root.WVSeasonStore.getPinned(year, seq, fp) || {}; } catch(_){ return {}; }
  }
  function getMarksFromStore(year, seq, fp){
    if (!root.WVSeasonStore) return {};
    try { return root.WVSeasonStore.getMarks(year, seq, fp) || {}; } catch(_){ return {}; }
  }

  async function initCurrentSeason(){
    if (root.WVSeasonStore && typeof root.WVSeasonStore.getCurrentSeasonInfo==='function'){
      try { state.currentSeason = await root.WVSeasonStore.getCurrentSeasonInfo(); }
      catch(e){ console.warn(LOG,'getCurrentSeasonInfo',e); }
    } else {
      var y = (new Date()).getUTCFullYear() % 100;
      state.currentSeason = { year:y, seq:1, season_id:null, title:null, start:null, end:null };
    }
  }

  // --------- Progreso semanal (steps /6) ----------
  function extractSeasonMetaSteps(weeklyData){
    try {
      var cur = Number(weeklyData && weeklyData.meta_progress_current || 0);
      var tot = Number(weeklyData && weeklyData.meta_progress_complete || 0);
      if (!isFinite(cur) || !isFinite(tot) || tot <= 0){
        // Fallback: intentar por objetivos con nombre que contenga "Meta de la temporada"
        var list = (weeklyData && Array.isArray(weeklyData.objectives)) ? weeklyData.objectives : [];
        var meta = list.find(function(o){
          var t = String(o && (o.title || o.name) || '').toLowerCase();
          return t.includes('meta de la temporada');
        });
        if (meta && typeof meta.progress_current==='number' && typeof meta.progress_complete==='number'){
          cur = meta.progress_current; tot = meta.progress_complete;
        } else {
          return 0;
        }
      }
      var step = Math.round((cur / tot) * 6);
      return Math.max(0, Math.min(6, step));
    } catch(_){ return 0; }
  }

  // Carga principal (solo temporada actual)
  async function loadAll(forceNoCache){
    state.loading = true;
    setStatus('Cargando datos…');

    await initCurrentSeason();

    // keys configuradas
    state.keys = loadKeys();

    if (!state.keys.length){
      state.accounts = [];
      state.pinnedUnion = [];
      state.globalItemsById.clear();
      setStatus('No hay API Keys guardadas. Agregá una desde el menú de keys.', 'error');
      state.loading=false; 
      return;
    }

    var out = [];
    var idx = 0, ACTIVE=0, MAX=2;
    var cur = state.currentSeason;

    // Carga paralela por key
    await new Promise(function(resolve){
      function next(){
        if (idx>=state.keys.length && ACTIVE===0) return resolve();
        while (ACTIVE<MAX && idx<state.keys.length){
          var it = state.keys[idx++]; ACTIVE++;
          (function(k){
            var token = k.value; var label = k.label || ('Key '+fpToken(token));
            var fp = fpToken(token);
            var pinned = getPinnedFromStore(cur.year, cur.seq, fp);
            var marks  = getMarksFromStore(cur.year, cur.seq, fp);

            // Merge shop + weekly (para meta steps /6)
            Promise.all([
              root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache }),
              root.GW2Api.getWVWeekly(token, { nocache: !!forceNoCache }).catch(function(e){ return null; })
            ])
            .then(function(results){
              var pkg = results[0], weekly = results[1];
              var steps = extractSeasonMetaSteps(weekly);

              out.push({
                token: token,
                fp: fp,
                label: label,
                aa: Number(pkg && pkg.aa || 0),
                aaIcon: (pkg && pkg.aaIconUrl) || null,
                itemsById: pkg && pkg.itemsById || new Map(),
                rows: Array.isArray(pkg && pkg.rows) ? pkg.rows : [],
                pinned: pinned || {},
                marks: marks || {},
                seasonMetaSteps: steps // 0..6
              });
            })
            .catch(function(e){
              console.warn(LOG, 'getWVShopMerged/Weekly', e);
              out.push({
                token: token, fp: fp, label: label,
                aa:0, aaIcon:null, itemsById:new Map(), rows:[],
                pinned: pinned||{}, marks: marks||{}, seasonMetaSteps: 0, error: e
              });
            })
            .finally(function(){ ACTIVE--; next(); });

          })(it);
        }
      }
      next();
    });

    state.accounts = out;

    // Union de pins solo actual
    state.pinnedUnion = computePinnedUnion(out);
    state.globalItemsById.clear();

    setStatus('Listo.');
    state.loading = false;
  }

  function computePinnedUnion(accounts){
    var ids = new Set();
    accounts.forEach(function(acc){
      var p = acc.pinned || {};
      Object.keys(p).forEach(function(id){ if (p[id]) ids.add(Number(id)); });
    });
    return Array.from(ids.values()).sort(function(a,b){ return a-b; });
  }

  // ------------------------------ Helpers AA / Items -----------------------
  function anyAAIcon(){
    for (var i=0;i<state.accounts.length;i++){
      var u = state.accounts[i] && state.accounts[i].aaIcon;
      if (u) return String(u);
    }
    return null;
  }
  function aaIconHTML(size){
    var url = anyAAIcon();
    if (!url) return 'AA';
    var s = Number(size||16);
    return '<img src="'+esc(url)+'" alt="AA" width="'+s+'" height="'+s+'" loading="lazy" referrerpolicy="no-referrer">';
  }
  function getItemMeta(itemId){
    var meta = state.globalItemsById.get(Number(itemId));
    if (meta) return meta;
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

  // ------------------------------ Dashboard -------------------------------
  function kpiSet(elId, val, kind){
    var host = document.getElementById(elId); if (!host) return;
    host.classList.remove('wvpd-kpi--ok','wvpd-kpi--warn','wvpd-kpi--bad');
    if (kind) host.classList.add('wvpd-kpi--'+kind);
    var v = host.querySelector('.wvpd-kpi__val'); if (v) v.textContent = fmtInt(val);
    var lbl = host.querySelector('.wvpd-kpi__lbl .aa-ico');
    if (lbl) lbl.innerHTML = aaIconHTML(16);
  }

  function fmtCountdown(ms){
    if (!isFinite(ms) || ms<=0) return '—';
    var s = Math.floor(ms/1000);
    var d = Math.floor(s/86400); s%=86400;
    var h = Math.floor(s/3600); s%=3600;
    var m = Math.floor(s/60);   s%=60;
    var parts = [];
    if (d>0) parts.push(d+'d');
    parts.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
    return parts.join(' ');
  }
  function msUntil(ts){ var t = (ts instanceof Date) ? ts.getTime() : Number(ts||0); return Math.max(0, t - Date.now()); }
  function nextDailyResetUTC(){
    var now = new Date();
    var y=now.getUTCFullYear(), m=now.getUTCMonth(), d=now.getUTCDate();
    var next = new Date(Date.UTC(y, m, d, 24, 0, 0, 0));
    if (next.getTime() <= Date.now()) next = new Date(Date.UTC(y, m, d+1, 0, 0, 0, 0));
    return next;
  }
  function nextWeeklyResetUTC(){
    var now = new Date();
    var day = now.getUTCDay();
    var daysUntilMonday = (1 - day + 7) % 7;
    var base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 30, 0, 0));
    var next = new Date(base.getTime() + daysUntilMonday*24*60*60*1000);
    if (next.getTime() <= Date.now()) next = new Date(next.getTime() + 7*24*60*60*1000);
    return next;
  }
  function seasonEndUTC(){
    var s = state.currentSeason; if (!s || !s.end) return null;
    var t = new Date(s.end); return isNaN(t.getTime()) ? null : t;
  }

  function recomputeKpis(){
    var aaAvail = 0;
    state.accounts.forEach(function(a){ aaAvail += Number(a.aa||0); });
    var aaNeed = 0;
    state.accounts.forEach(function(acc){ aaNeed += aaNeededForPinned(acc); });
    var delta = aaAvail - aaNeed;
    var kind = (delta >= 0) ? 'ok' : (delta >= -500 ? 'warn' : 'bad');
    return { aaAvail: aaAvail, aaNeed: aaNeed, delta: delta, kind: kind };
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
      var left = (limit - (purchased+marked));
      if (left>0) sum += left * cost;
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
      var left = Math.max(0, limit - (purchased+marked));
      if (left>0) c++;
    });
    return c;
  }

  function topDeficitAccounts(n){
    var rows = state.accounts.map(function(a){
      var need = aaNeededForPinned(a);
      var d = Number(a.aa||0) - need;
      return { label: a.label || a.fp || 'Key', delta: d };
    });
    rows.sort(function(x,y){ return x.delta - y.delta; });
    return rows.slice(0, n||3);
  }

  function leftForListingInAccount(acc, listingId){
    var row = findRowByListingId(acc.rows||[], listingId);
    if (!row) return 0;
    var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
    var purchased = Number(row.purchased||0);
    var marked    = Number((acc.marks||{})[String(listingId)]||0);
    if (limit==null) return 0;
    return Math.max(0, limit - (purchased+marked));
  }

  function topPendingItems(n){
    var out = [];
    state.pinnedUnion.forEach(function(listingId){
      var leftSum = 0, countAcc = 0, itemId = null, meta = null;
      state.accounts.forEach(function(acc){
        var left = leftForListingInAccount(acc, listingId);
        if (left > 0){ leftSum += left; countAcc++; }
        if (itemId==null){
          var row = findRowByListingId(acc.rows||[], listingId);
          if (row && row.item_id!=null) itemId = Number(row.item_id);
        }
      });
      if (leftSum > 0){
        meta = (itemId!=null) ? getItemMeta(itemId) : null;
        out.push({ listingId: listingId, leftSum: leftSum, countAcc: countAcc, itemId: itemId, meta: meta });
      }
    });
    out.sort(function(a,b){
      if (b.leftSum !== a.leftSum) return b.leftSum - a.leftSum;
      return b.countAcc - a.countAcc;
    });
    return out.slice(0, n||3);
  }

  function updateCountdowns(){
    var elD = document.getElementById('wvpdCountDaily');
    var elW = document.getElementById('wvpdCountWeekly');
    var elS = document.getElementById('wvpdCountSeason');
    var d = nextDailyResetUTC();
    var w = nextWeeklyResetUTC();
    var s = seasonEndUTC();
    if (elD) elD.textContent = fmtCountdown(msUntil(d));
    if (elW) elW.textContent = fmtCountdown(msUntil(w));
    if (elS) elS.textContent = s ? fmtCountdown(msUntil(s)) : '—';
  }

  function buildUsefulBoxHTML(){
    var totalPinned = 0, totalPinnedDone = 0, accountsWithPinned = 0;
    var totalMarks = 0;

    state.accounts.forEach(function(acc){
      var pins = acc.pinned || {};
      var marks = acc.marks || {};
      var pinIds = Object.keys(pins).filter(function(k){ return !!pins[k]; });
      totalPinned += pinIds.length;
      if (pinIds.length>0) accountsWithPinned++;

      Object.keys(marks).forEach(function(id){ totalMarks += Number(marks[id]||0); });

      var rows = acc.rows || [];
      pinIds.forEach(function(idStr){
        var row = findRowByListingId(rows, Number(idStr));
        if (!row) return;
        var limit = (row.purchase_limit==null? null : Number(row.purchase_limit));
        var purchased = Number(row.purchased||0);
        var marked    = Number((acc.marks||{})[String(idStr)]||0);
        if (limit!=null){
          var left = Math.max(0, limit - (purchased+marked));
          if (left===0) totalPinnedDone++;
        }
      });
    });

    var k1 = '<div class="wvpd-li"><span>Ítems fijados (suma)</span><span class="wvpd-li__rest">'+fmtInt(totalPinned)+'</span></div>';
    var k2 = '<div class="wvpd-li"><span>Cuentas con fijados</span><span class="wvpd-li__rest">'+fmtInt(accountsWithPinned)+' / '+fmtInt(state.accounts.length)+'</span></div>';
    var k3 = '<div class="wvpd-li"><span>Fijados completos</span><span class="wvpd-li__rest">'+fmtInt(totalPinnedDone)+'</span></div>';
    var k4 = '<div class="wvpd-li"><span>Marcas acumuladas</span><span class="wvpd-li__rest">'+fmtInt(totalMarks)+'</span></div>';

    return '<div class="wvpd-col">'+k1+k2+'</div><div class="wvpd-col">'+k3+k4+'</div>';
  }

  function updateUsefulBox(){
    var host = document.getElementById('wvpdUsefulContent');
    if (!host) return;
    host.innerHTML = buildUsefulBoxHTML();
  }

  function updateDashboard(){
    var k = recomputeKpis();
    kpiSet('wvpdKpiAAAvail', k.aaAvail, k.kind || 'ok');
    kpiSet('wvpdKpiAANeed',  k.aaNeed,  k.aaNeed<=0 ? 'ok' : (k.aaNeed < 500 ? 'warn' : 'bad'));
    kpiSet('wvpdKpiAADelta', k.delta,   k.kind);

    var listA = document.getElementById('wvpdTopAccounts');
    if (listA){
      var topA = topDeficitAccounts(3);
      var aaI = aaIconHTML(14);
      listA.innerHTML = topA.length ? topA.map(function(a){
        var cls = (a.delta >= 0) ? 'wvpd-li__delta--ok' : 'wvpd-li__delta--bad';
        return '<li class="wvpd-li"><span class="wvpd-li__name">'+esc(a.label)+'</span><span class="wvpd-li__delta '+cls+'">'+aaI+(a.delta>=0?'+':'')+fmtInt(a.delta)+'</span></li>';
      }).join('') : '<li class="wvpd-li"><span class="wvpd-li__name">—</span><span class="wvpd-li__delta">—</span></li>';
    }

    var listI = document.getElementById('wvpdTopItems');
    if (listI){
      var topI = topPendingItems(3);
      listI.innerHTML = topI.length ? topI.map(function(x){
        var name = x.meta?.name || (x.itemId!=null ? ('#'+x.itemId) : ('#'+x.listingId));
        var icon = x.meta?.icon ? ('<span class="wvpd-li__icon"><img src="'+esc(x.meta.icon)+'" alt="'+esc(name)+'" loading="lazy"></span>') : '<span class="wvpd-li__icon"></span>';
        return '<li class="wvpd-li" title="'+esc(name)+'">'+
                 '<span class="wvpd-li__left">'+icon+'<span class="wvpd-li__name" style="display:none">'+esc(name)+'</span></span>'+
                 '<span class="wvpd-li__rest">restante: '+fmtInt(x.leftSum)+'</span>'+
               '</li>';
      }).join('') : '<li class="wvpd-li"><span class="wvpd-li__name">—</span><span class="wvpd-li__rest">—</span></li>';
    }

    updateCountdowns();
    updateUsefulBox();

    try { if (state.dashTimer) clearInterval(state.dashTimer); } catch(_){}
    state.dashTimer = setInterval(updateCountdowns, 1000);
  }

  // ------------------------------ Render Tabla -----------------------------
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
          var left = Math.max(0, limit - (purchased+marked));
          if (left>0) return true;
        }
        return false;
      });
    }

    // ENCABEZADO
    var hcells = ['<th>Cuenta</th>'];
    pins.forEach(function(listingId){
      var itemId = null, meta = null, name = '';
      for (var i=0;i<state.accounts.length;i++){
        var acc = state.accounts[i];
        var row = findRowByListingId(acc.rows||[], listingId);
        if (row && row.item_id != null){ itemId = Number(row.item_id); break; }
      }
      if (itemId != null) meta = getItemMeta(itemId);
      if (meta && meta.icon){
        name = meta.name ? esc(meta.name) : ('#'+listingId);
        var icon = '<img src="'+esc(meta.icon)+'" alt="'+name+'" width="22" height="22" loading="lazy">';
        hcells.push('<th class="wvpd-th-item" data-listing-id="'+esc(String(listingId))+'" data-item-id="'+esc(String(itemId))+'" title="'+name+' (ID '+esc(String(listingId))+')">'+icon+'</th>');
      } else {
        hcells.push('<th class="wvpd-th-item" data-listing-id="'+esc(String(listingId))+'" title="Item #'+esc(String(listingId))+'">#'+esc(String(listingId))+'</th>');
      }
    });

    var aaI = aaIconHTML(16);
    hcells.push('<th class="right"><span class="wvpd-aahead">'+aaI+'<span>disp</span></span></th>');
    hcells.push('<th class="right"><span class="wvpd-aahead">'+aaI+'<span>necesario</span></span></th>');
    hcells.push('<th class="right"><span class="wvpd-aahead">'+aaI+'<span>Δ</span></span></th>');

    thead.innerHTML = '<tr>'+hcells.join('')+'</tr>';

    // FILAS
    var rowsAcc = state.accounts.slice();
    if (state.filters.q){
      var q = state.filters.q;
      rowsAcc = rowsAcc.filter(function(a){
        return (a.label||'').toLowerCase().includes(q) || (a.fp||'').toLowerCase().includes(q);
      });
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

      // Color por progreso semanal /6
      var stp = Number(acc.seasonMetaSteps || 0); // 0..6
      var accCls = (stp >= 6) ? 'wvpd-acc--green' : (stp >= 4 ? 'wvpd-acc--yellow' : 'wvpd-acc--red');
      var nameHtml = '<strong class="'+accCls+'" title="Meta semanal: '+stp+'/6">'+esc(acc.label||('Key '+esc(acc.fp||'')))+'</strong>';
      cells.push('<td>'+nameHtml+' '+fpBadge+'</td>');

      // Columnas de pins fijados
      pins.forEach(function(listingId){
        var isPinned = !!(acc.pinned && acc.pinned[String(listingId)]);
        if (!isPinned){ cells.push('<td class="center wvpd-muted">—</td>'); return; }
        var row = findRowByListingId(acc.rows||[], listingId);
        if (!row){ cells.push('<td class="center wvpd-muted">—</td>'); return; }
        var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
        var purchased = Number(row.purchased||0);
        var marked    = Number((acc.marks||{})[String(listingId)]||0);
        if (limit==null){
          cells.push('<td class="center wvpd-muted">'+fmtInt(purchased+marked)+' / ∞</td>');
        } else {
          var left = Math.max(0, limit - (purchased+marked));
          if (left===0)
            cells.push('<td class="center wvpd-green">Sin stock</td>');
          else
            cells.push('<td class="center wvpd-red">'+fmtInt(purchased+marked)+' / '+fmtInt(limit)+' — Restante: '+fmtInt(left)+'</td>');
        }
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

    lazyBuildItemsCatalogForActiveColumns();
  }

  // ------------------------------ Catálogo ítems (lazy) -------------------
  function collectActiveItemIds(){
    var setIds = new Set();
    var ths = $$('#wvpdTable thead th[data-listing-id]');
    ths.forEach(function(th){
      var listingId = Number(th.getAttribute('data-listing-id'));
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
        var cap = 800;
        ids = ids.slice(0, cap);
        ids = ids.filter(function(id){ return !state.globalItemsById.has(Number(id)); });
        if (!ids.length) return;

        if (root.GW2Api && typeof root.GW2Api.getItemsMany==='function'){
          var items = await root.GW2Api.getItemsMany(ids, { nocache:false });
          (items||[]).forEach(function(it){ if (it && it.id!=null) state.globalItemsById.set(Number(it.id), it); });
          backfillHeaderIcons();
          updateDashboard(); 
        }
      } catch(e){ console.warn(LOG, 'items lazy', e); }
    }, { timeout: 1200 });
  }

  function backfillHeaderIcons(){
    var ths = $$('#wvpdTable thead th[data-listing-id]');
    ths.forEach(function(th){
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
        th.innerHTML = '<img src="'+esc(itemMeta.icon)+'" alt="'+name+'" width="22" height="22" loading="lazy">';
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
      try { state.accessIconUrl = localStorage.getItem('wvpd_icon_url') || null; } catch(_){}
      updateBannerIcon();

      state.inited = true;

      // Reapertura tras F5 SOLO en gn:nav-active
      document.addEventListener('gn:nav-active', function(ev){
        try {
          var h = String(ev && ev.detail && ev.detail.hash || '').toLowerCase();
          if (h !== '#/account/wizards-vault') return;

          var myToken = ++_refreshSeq;
          var open = localStorage.getItem('wvpd_open');
          if (open === '1') {
            requestAnimationFrame(function(){ 
              if (myToken === _refreshSeq) WVPurchaseDetail.show(); 
            });
          }
          observeToolbar();
        } catch(_){}
      });

      // Storage (throttle) — refrescar si está visible
      var _stTimer = null;
      window.addEventListener('storage', function(e){
        if (!e) return;
        var p = document.getElementById('wvPDPanel');
        if (e.key==='wvpd_icon_url'){ 
          state.accessIconUrl = localStorage.getItem('wvpd_icon_url') || null; 
          ensureToolbarButton(); 
          updateBannerIcon(); 
          return; 
        }
        if (!p || p.hasAttribute('hidden')) return;
        if (e.key && e.key.startsWith('wv:season:')){
          clearTimeout(_stTimer);
          _stTimer = setTimeout(function(){ safeRefresh(false); }, 300);
        }
      });

      // Evento SeasonStore mutate → refresco en vivo si abierto
      try {
        window.addEventListener('wv:season-store:mutate', function(){
          var p = document.getElementById('wvPDPanel');
          if (!p || p.hasAttribute('hidden')) return;
          safeRefresh(false);
        });
      } catch(_){}

      // Tabs WV cierran esta vista
      ['wvTabBtnDaily','wvTabBtnWeekly','wvTabBtnSpecial','wvTabBtnShop'].forEach(function(id){
        var b = document.getElementById(id);
        if (b && !b.__wvpdWired2){
          b.__wvpdWired2 = true;
          b.addEventListener('click', function(){ try { WVPurchaseDetail.hide(); } catch(_){ } });
        }
      });
    },

    async show(){
      await this.initOnce();
      try { localStorage.setItem('wvpd_open', '1'); } catch(_){}
      setTabsVisible(false);
      showPanel();
      try { document.getElementById('wvPanel')?.scrollIntoView({ behavior:'smooth', block:'start' }); }
      catch(_){ window.scrollTo({ top: 0, behavior: 'smooth' }); }
      await safeRefresh(false);
    },

    hide(){
      try { localStorage.setItem('wvpd_open', '0'); } catch(_){}
      setTabsVisible(true);
      try { if (root.WV && typeof root.WV.setActiveTab==='function') root.WV.setActiveTab(state.prevTab || 'shop'); } catch(_){}
      hidePanel();
      try { if (state.dashTimer) clearInterval(state.dashTimer); } catch(_){}
      state.dashTimer = null;
    },

    async refresh(forceNoCache){ await safeRefresh(!!forceNoCache); },

    setIcon: function(url){
      state.accessIconUrl = (url && String(url).trim()) || null;
      try {
        if (state.accessIconUrl) localStorage.setItem('wvpd_icon_url', state.accessIconUrl);
        else localStorage.removeItem('wvpd_icon_url');
      } catch(_){}
      ensureToolbarButton();
      updateBannerIcon();
    }
  };

  async function safeRefresh(forceNoCache){
    const mySeq = ++_refreshSeq;
    if (_refreshInFlight){
      try { await _refreshInFlight; } catch(_){}
      if (mySeq !== _refreshSeq) return;
    }

    _refreshInFlight = (async () => {
      setStatus('Actualizando…');

      await initCurrentSeason();
      await loadAll(!!forceNoCache);

      renderTable();
      updateDashboard();

      setStatus('Listo.');
    })();

    try { await _refreshInFlight; }
    finally { if (mySeq === _refreshSeq) _refreshInFlight = null; }
  }

  root.WVPurchaseDetail = WVPurchaseDetail;

  if (document.readyState==='loading')
    document.addEventListener('DOMContentLoaded', function(){ WVPurchaseDetail.initOnce(); });
  else
    WVPurchaseDetail.initOnce();

  console.info(LOG, 'ready 1.6.0 (single-season + weekly progress color)');
})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));
