/*!
 * Router y Vistas (Achievements + Wizard's Vault v2.4.0 + active sidebar)
 * - Vista por defecto: Tarjetas (grid) en Tienda.
 * - Botón de cambio de vista (#wvViewToggle) siempre visible (auto-repara toolbars viejas).
 * - Filtros Tienda: Stock, Categoría, Tipo, OR entre (Oro/Laurel/Mística) y (Extra1/Extra2).
 * - Cabecera AA: Disponible (API), Gastado (API), Reservado (marcas), Restante (sim).
 * - Objetivos: toolbar sólo PvE / PvP / WvW.
 * - Rediseño de tarjetas: layout robusto, sin desbordes, mejor legibilidad en dark mode.
 * - Sidebar: resalta la sección activa con .is-active en los links.
 */

(function () {
  'use strict';

  console.info('[WV] router.js v2.4.0 + active-sidebar');

  // ------------------------------- Utils DOM -------------------------------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (id) { return document.getElementById(id); };

  // ---------------------- Sidebar: link activo por hash --------------------
  function setActiveNav(hash) {
    try {
      var links = document.querySelectorAll('.side-nav__link');
      links.forEach(function (a) { a.classList.remove('is-active'); });

      var map = {
        '#/cards': '#navCards',
        '#/meta': '#navMeta',
        '#/account/achievements': '#navAch',
        '#/account/wizards-vault': '#navWV'
      };

      var key = map[hash] ? hash : '#/cards';
      var targetSel = map[key];
      var node = targetSel ? document.querySelector(targetSel) : null;
      if (node) node.classList.add('is-active');
    } catch (_) {}
  }

  // ------------------------------- Estado ----------------------------------
  var __wvShopState = {
    merged: [],
    itemsMap: new Map(),
    season: null,
    aa: 0,
    aaIconUrl: null,
    filters: {
      onlyStock: false,
      showGold: false,
      showLaurel: false,
      showMystic: false,
      category: '',
      type: '',
      extra1: '',
      extra2: '',
      view: 'cards' // — por defecto Tarjetas
    },
    optionsList: [],
    typeOptions: [],
    marks: {}
  };

  var __wvObjState = { filters: { pve: true, pvp: true, wvw: true } };

  // Persistencia
  var LS_WV_SHOP_MARKS   = 'gw2_wv_marks_v1';
  var LS_WV_SHOP_FILTERS = 'gw2_wv_shop_filters_v2';
  var LS_WV_OBJ_FILTERS  = 'gw2_wv_obj_filters_v2';

  function saveShopMarks(ns, marks) {
    try {
      var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}');
      all[ns] = marks || {};
      localStorage.setItem(LS_WV_SHOP_MARKS, JSON.stringify(all));
    } catch (_) {}
  }
  function loadShopMarks(ns) {
    try {
      var all = JSON.parse(localStorage.getItem(LS_WV_SHOP_MARKS) || '{}');
      return all[ns] || {};
    } catch (_) { return {}; }
  }
  function saveShopFilters() {
    try { localStorage.setItem(LS_WV_SHOP_FILTERS, JSON.stringify(__wvShopState.filters)); } catch (_){}
  }
  function loadShopFilters() {
    try {
      var f = JSON.parse(localStorage.getItem(LS_WV_SHOP_FILTERS) || '{}');
      Object.assign(__wvShopState.filters, f || {});
      if (__wvShopState.filters.view !== 'cards' && __wvShopState.filters.view !== 'table') {
        __wvShopState.filters.view = 'cards';
      }
    } catch (_){}
  }
  function saveObjFilters() {
    try { localStorage.setItem(LS_WV_OBJ_FILTERS, JSON.stringify(__wvObjState.filters)); } catch (_){}
  }
  function loadObjFilters() {
    try {
      var f = JSON.parse(localStorage.getItem(LS_WV_OBJ_FILTERS) || '{}');
      if (f && typeof f === 'object') {
        __wvObjState.filters.pve = (f.pve !== false);
        __wvObjState.filters.pvp = (f.pvp !== false);
        __wvObjState.filters.wvw = (f.wvw !== false);
      }
    } catch (_){}
  }

  // ------------------------------- Varios ----------------------------------
  function ensureRuntimeStyles() {
    if (document.getElementById('gw2-runtime-styles')) return;
    var css = `
      .tab-panel[hidden]{display:none!important;}
      .muted{color:#a0a0a6}.error{color:#f28b82}.right{text-align:right}
      .nowrap{white-space:nowrap}
      img.wv-item-icon{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:6px}

      /* Toolbars */
      .wv-obj-toolbar,.wv-shop-toolbar{
        display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:10px 0;
        padding:10px 12px; background:#0f1013; border:1px solid #26262b; border-radius:12px;
      }
      .wv-obj-toolbar[hidden],.wv-shop-toolbar[hidden]{display:none!important;}
      .wv-obj-toolbar .group,.wv-shop-toolbar .group{display:flex; align-items:center; gap:10px; flex-wrap:wrap}

      /* ---- Objetivos ---- */
      .wv-prog{display:grid;gap:4px}
      .wv-bar{position:relative;height:8px;background:#18181c;border:1px solid #2a2a2f;border-radius:999px;overflow:hidden}
      .wv-bar__fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:linear-gradient(90deg,#5ce0a3,#a7f3d0);transition:width .15s ease}
      .wv-obj-row .tag{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #2a2a2f;background:#121216}
      .tag--pve{color:#b9f3c8;background:#1b2a21;border-color:#2f4f3d}
      .tag--pvp{color:#cfd1ff;background:#1b1d2a;border-color:#313a75}
      .tag--wvw{color:#ffd3b3;background:#2a241b;border-color:#5a4c2e}

      /* ---- Tabla Tienda ---- */
      #wvTabShop table.simple tbody tr td{vertical-align:middle}
      .wv-counter{display:inline-flex;align-items:center;gap:8px}
      .wv-counter button{width:24px;height:24px;border-radius:8px}
      .wv-counter--card button{width:28px;height:28px}

      /* Rareza */
      .rar-legendary{color:#b24bd4}.rar-ascended{color:#fb3e8d}.rar-exotic{color:#ffa405}
      .rar-rare{color:#fcd00b}.rar-masterwork{color:#1a9306}.rar-fine{color:#62a4da}
      .rar-basic{color:#eee}.rar-junk{color:#9d9d9d}

      /* ======= Tarjetas (nuevo diseño) ======= */
      .wv-card-grid{
        display:grid; gap:14px; margin-top:10px;
        grid-template-columns:repeat(auto-fill, minmax(260px,1fr));
      }

      .wv-card{
        position:relative; display:grid; grid-template-rows:auto auto 1fr auto; gap:10px;
        background:linear-gradient(180deg,#14151a 0%, #111216 100%);
        border:1px solid #23252b; border-radius:14px;
        box-shadow:0 1px 0 0 #1a1b20 inset, 0 0 0 1px rgba(255,255,255,0.02);
        padding:12px; min-height:172px; overflow:hidden;
        transition:transform .12s ease, box-shadow .12s ease, border-color .12s;
      }
      .wv-card:hover{
        transform:translateY(-1px);
        border-color:#2d2f36;
        box-shadow:0 6px 16px rgba(0,0,0,.35), 0 0 0 1px rgba(82,118,255,.12);
      }

      /* Top: icono + nombre (recorte seguro) */
      .wv-card__top{display:grid; grid-template-columns:44px 1fr; gap:10px; align-items:center;}
      .wv-card__iconWrap{
        width:44px; height:44px; border-radius:10px; background:#0e0f12;
        display:flex; align-items:center; justify-content:center; border:1px solid #262a33;
        overflow:hidden;
      }
      .wv-card__icon{width:36px; height:36px; object-fit:contain}
      .wv-card__name{
        font-weight:700; line-height:1.15; color:#e9e9f1;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
      }

      /* Meta (costo/tipo) */
      .wv-card__meta{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap}
      .wv-badge{
        display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px;
        font-size:12px; color:#d7eaff; background:#0f1522; border:1px solid #22314f;
      }
      .wv-type{color:#9aa0ab; font-size:12px}

      /* Body (comprado/restante) */
      .wv-card__body{
        display:grid; grid-auto-rows:min-content; gap:6px; color:#cfd2d8; font-size:13px;
        overflow:hidden;
      }
      .wv-card__row{display:flex; align-items:center; justify-content:space-between; gap:8px}

      /* Bottom (ID + counter) */
      .wv-card__bottom{display:flex; align-items:center; justify-content:space-between; gap:8px}
      .wv-id{color:#7f8794; font-size:12px}

      /* Píldoras (restante) */
      .pill{
        padding:2px 8px; border-radius:999px; background:#10131a; border:1px solid #253045;
        color:#bcd0ff; font-size:12px;
      }

      /* Separador suave */
      .sep{height:1px; background:linear-gradient(90deg, transparent, #23252b, transparent); opacity:.8}

      /* Estado sin límite (∞) */
      .wv-counter--disabled{opacity:.5; filter:grayscale(0.2)}

      /* Responsivo opcional */
      @media (max-width: 1480px){
        .wv-card-grid{ grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
      }
      @media (max-width: 920px){
        .wv-card-grid{ grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      }
    `;
    var style = document.createElement('style');
    style.id = 'gw2-runtime-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showPanel(idToShow) {
    var ids = ['walletPanel', 'metaPanel', 'achievementsPanel', 'wvPanel'];
    ids.forEach(function (id) {
      var node = el(id);
      if (!node) return;
      if (id === idToShow) node.removeAttribute('hidden');
      else node.setAttribute('hidden', 'hidden');
    });
    var heroTabs = document.querySelectorAll('.overlay-tab');
    heroTabs.forEach(function (btn) {
      var view = btn.getAttribute('data-view');
      var active = (idToShow === 'walletPanel' && view === 'cards') ||
                   (idToShow === 'metaPanel'   && view === 'meta');
      btn.classList.toggle('overlay-tab--active', active);
    });
  }

  function getSelectedToken() {
    var sel = el('keySelectGlobal');
    if (!sel) return null;
    var tok = (sel.value || '').trim();
    return tok || null;
  }

  function fmtPct(p) { return (Math.round(p * 1000) / 10).toFixed(1) + '%'; }
  function setText(id, text) { var n = el(id); if (n) n.textContent = text; }
  function escapeHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function norm(s){ return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }

  // ========================= Achievements (placeholder neutralizado) =======
  var __achFallbackIconUrl = null, __achFallbackFetched = false;
  async function getAchFallbackIconUrl() {
    if (__achFallbackFetched) return __achFallbackIconUrl;
    __achFallbackFetched = true;
    try {
      var res = await fetch('https://api.guildwars2.com/v2/files?ids=map_complete', { mode: 'cors' });
      if (res.ok) { var data = await res.json(); if (Array.isArray(data) && data[0] && data[0].icon) __achFallbackIconUrl = data[0].icon; }
    } catch (_){}
    return __achFallbackIconUrl;
  }
  async function renderAchievements() { /* deprecated: usar Achievements.render() */ }

  // ========================================================================
  //              CÁMARA DEL BRUJO (Wizard's Vault) + TIENDA
  // ========================================================================

  // ---------- Permisos WV ----------
  async function ensureWVPermissionsOrMessage() {
    var token = getSelectedToken();
    if (!token) return { ok:false, reason:'notoken' };
    try {
      var info = await GW2Api.getTokenInfo(token, { nocache:true });
      if (GW2Api.tokenHasWVPermissions(info)) return { ok:true, info:info };
      var msg = 'Tu API Key no tiene permisos para Wizard’s Vault. Generá una nueva con permisos “wizardsvault” o “progression”.';
      renderWVErrorAllTabs(msg);
      return { ok:false, reason:'noperms' };
    } catch (e) {
      renderWVErrorAllTabs('No se pudo validar permisos de la API Key.');
      return { ok:false, reason:'err' };
    }
  }

  function renderWVErrorAllTabs(msg) {
    ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function (id) {
      var c = el(id); if (c) c.innerHTML = '<p class="error">' + escapeHtml(msg) + '</p>';
    });
    setText('wvSeasonTitle','—'); setText('wvSeasonDates','—');
    var syncNote = el('wvSyncNote'); if (syncNote) syncNote.classList.add('hidden');
    setObjToolbarVisibility(false); setShopToolbarVisibility(false);
  }

  function setWVSeasonHeader(season) {
    if (!season) return;
    setText('wvSeasonTitle', season.title || '—');
    if (season.start && season.end) {
      var start = new Date(season.start), end = new Date(season.end);
      setText('wvSeasonDates', start.toLocaleDateString() + ' → ' + end.toLocaleDateString());
    } else setText('wvSeasonDates', '—');
  }

  function ensureWVObjToolbar() {
    var panel = el('wvPanel'); if (!panel) return;
    if (el('wvObjToolbar')) return;

    var tabsNav = $('.tabs', panel);
    var hostBefore = tabsNav ? tabsNav : $('.tabs-content', panel);

    var tb = document.createElement('div');
    tb.id = 'wvObjToolbar';
    tb.className = 'wv-obj-toolbar';
    tb.innerHTML = [
      '<div class="group"><strong style="margin-right:6px">Objetivos:</strong>',
        '<label><input type="checkbox" id="wvObjPve"> PvE</label>',
        '<label><input type="checkbox" id="wvObjPvp"> PvP</label>',
        '<label><input type="checkbox" id="wvObjWvw"> WvW</label>',
      '</div>'
    ].join('');

    if (hostBefore && hostBefore.parentNode) hostBefore.parentNode.insertBefore(tb, hostBefore.nextSibling);
    else panel.insertBefore(tb, panel.firstChild);

    loadObjFilters();
    el('wvObjPve').checked = !!__wvObjState.filters.pve;
    el('wvObjPvp').checked = !!__wvObjState.filters.pvp;
    el('wvObjWvw').checked = !!__wvObjState.filters.wvw;

    wireWVObjToolbar();
  }
  function setObjToolbarVisibility(on) {
    var tb = el('wvObjToolbar'); if (!tb) return;
    if (on) tb.removeAttribute('hidden'); else tb.setAttribute('hidden','hidden');
  }
  function setShopToolbarVisibility(on) {
    var c = el('wvTabShop'); if (!c) return;
    var t = $('.wv-shop-toolbar', c);
    if (t) { if (on) t.removeAttribute('hidden'); else t.setAttribute('hidden','hidden'); }
  }
  function wireWVObjToolbar() {
    ['wvObjPve','wvObjPvp','wvObjWvw'].forEach(function(id){
      var n = el(id); if (!n || n.__wired) return; n.__wired = true;
      n.addEventListener('change', function(){
        __wvObjState.filters.pve = !!el('wvObjPve').checked;
        __wvObjState.filters.pvp = !!el('wvObjPvp').checked;
        __wvObjState.filters.wvw = !!el('wvObjWvw').checked;
        saveObjFilters();
        var active = $('.tab-panel:not(.hidden):not([hidden])', el('wvPanel'));
        if (!active) return;
        if (active.id === 'wvTabDaily')   renderWVTabObjectives('wvTabDaily',   __wvCache.daily);
        if (active.id === 'wvTabWeekly')  renderWVTabObjectives('wvTabWeekly',  __wvCache.weekly);
        if (active.id === 'wvTabSpecial') renderWVTabObjectives('wvTabSpecial', __wvCache.special);
      });
    });
  }

  function badgeForTrack(track) {
    var k = String(track||'').toLowerCase();
    if (k==='pve') return '<span class="tag tag--pve">PvE</span>';
    if (k==='pvp') return '<span class="tag tag--pvp">PvP</span>';
    if (k==='wvw') return '<span class="tag tag--wvw">WvW</span>';
    return '<span class="tag">—</span>';
  }
  var __wvCache = { daily:null, weekly:null, special:null };

  function objectivePassesFilters(o) {
    var f = __wvObjState.filters;
    var t = String(o.track || '').toLowerCase();
    if ((t==='pve' && !f.pve) || (t==='pvp' && !f.pvp) || (t==='wvw' && !f.wvw)) return false;
    return true;
  }

  function htmlObjectiveRow(o) {
    var status = (o.claimed ? '✅' : (o.progress_current >= o.progress_complete ? '✔️' : '…'));
    var progTxt = (typeof o.progress_complete === 'number' && o.progress_complete > 0)
      ? (o.progress_current + ' / ' + o.progress_complete)
      : (o.progress_current || 0);

    var pct = 0;
    if (typeof o.progress_complete === 'number' && o.progress_complete > 0) {
      pct = Math.max(0, Math.min(100, Math.round((o.progress_current / o.progress_complete) * 100)));
    }

    return (
      '<div class="wv-obj-row">' +
        '<div class="row row--space">' +
          '<div class="grow"><strong>' + escapeHtml(o.title || ('#'+o.id)) + '</strong> ' + badgeForTrack(o.track) + '</div>' +
          '<div class="muted">+' + (o.acclaim || 0) + ' AA</div>' +
          '<div>' + progTxt + '</div>' +
          '<div>' + status + '</div>' +
        '</div>' +
        '<div class="wv-prog">' +
          '<div class="wv-bar"><div class="wv-bar__fill" style="width:' + pct + '%;"></div></div>' +
          '<div class="muted">' + fmtPct(pct/100) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderWVTabObjectives(containerId, dataset) {
    var c = el(containerId);
    if (!c) return;

    if (!dataset || !Array.isArray(dataset.objectives)) {
      c.innerHTML = '<p class="muted">Sin objetivos para mostrar.</p>';
      return;
    }

    var filtered = dataset.objectives.filter(objectivePassesFilters);

    var html = [];
    if (typeof dataset.meta_progress_current === 'number' && typeof dataset.meta_progress_complete === 'number') {
      html.push(
        '<div class="bar-wrap" style="margin-bottom:8px;">' +
          '<div class="row row--space">' +
            '<div class="grow muted">Meta: ' + dataset.meta_progress_current + ' / ' + dataset.meta_progress_complete + '</div>' +
            (dataset.meta_reward_astral ? ('<div class="muted">Recompensa: +' + dataset.meta_reward_astral + ' AA</div>') : '') +
          '</div>' +
        '</div>'
      );
    }
    filtered.forEach(function (o) { html.push(htmlObjectiveRow(o)); });
    if (!filtered.length) html.push('<p class="muted">No hay objetivos que coincidan con los filtros.</p>');
    c.innerHTML = html.join('');
  }

  // ========================================================================
  //                              TIENDA WV
  // ========================================================================

  function isLaurelEntry(entry, it) { var n = norm(it && it.name); return /\blaurel(s)?\b/.test(n) || /bolsa de laureles/.test(n); }
  function isMysticCoinEntry(entry, it) { var n = norm(it && it.name); return /\bmystic coin(s)?\b/.test(n) || /moneda(s)? mistica(s)?/.test(n); }
  function isGoldEntry(entry, it) { var n = norm(it && it.name); return /\b1 ?gold\b/.test(n) || /bag of coins/.test(n) || /bolsa de moneda(s)?/.test(n) || /\boro\b/.test(n); }

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

  function categoryOf(it) {
    if (!it || !it.type) return 'other';
    var t = String(it.type).toLowerCase();
    if (t.includes('upgradecomponent') || t.includes('gizmo')) return 'account';
    if (t.includes('container') || t.includes('consumable') || t.includes('tool')) return 'consumable';
    if (t.includes('trinket') || t.includes('armor') || t.includes('weapon') || t.includes('back')) return 'cosmetic';
    if (t.includes('craftingmaterial') || t.includes('trophy')) return 'material';
    return 'other';
  }

  function buildOptionsList(merged, itemsMap) {
    var set = new Set();
    (merged || []).forEach(function (m) {
      var it = (m.item_id != null) ? itemsMap.get(m.item_id) : null;
      var name = it && it.name ? it.name : null;
      if (!name) return;
      set.add(name);
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); }).slice(0, 600);
  }
  function buildTypeOptions(merged) {
    var set = new Set();
    (merged || []).forEach(function(m){ if (m && m.type) set.add(m.type); });
    return Array.from(set).sort(function(a,b){ return String(a).localeCompare(String(b)); }).slice(0,200);
  }

  function passShopFilters(entry, it, st) {
    var name = it && it.name ? it.name : '';

    var left = (typeof entry.purchase_limit === 'number')
      ? Math.max(0, entry.purchase_limit - (entry.purchased || 0) - Number((st.marks||{})[entry.id] || 0))
      : '∞';
    if (st.filters.onlyStock) {
      if (left !== '∞' && left <= 0) return false;
    }

    if (st.filters.category && categoryOf(it) !== st.filters.category) return false;
    if (st.filters.type && String(entry.type || '') !== st.filters.type) return false;

    var wantsGold   = !!st.filters.showGold;
    var wantsLaurel = !!st.filters.showLaurel;
    var wantsMystic = !!st.filters.showMystic;
    var ex1 = (st.filters.extra1 || '').trim();
    var ex2 = (st.filters.extra2 || '').trim();

    var anyUnionSelected = wantsGold || wantsLaurel || wantsMystic || ex1 || ex2;
    if (!anyUnionSelected) return true;

    var matchToggle = (wantsGold   && isGoldEntry(entry, it)) ||
                      (wantsLaurel && isLaurelEntry(entry, it)) ||
                      (wantsMystic && isMysticCoinEntry(entry, it));
    var matchExtra  = (!!ex1 && name === ex1) || (!!ex2 && name === ex2);

    return (matchToggle || matchExtra);
  }

  function createShopToolbarHtml() {
    return (
      '<div class="wv-shop-toolbar">' +
        '<div class="group">' +
          '<strong style="margin-right:6px">Tienda:</strong>' +
          '<label><input type="checkbox" id="wvOnlyStock"> Solo con stock</label>' +
        '</div>' +
        '<div class="group">' +
          '<label><input type="checkbox" id="wvShowGold"> Oro</label> ' +
          '<label><input type="checkbox" id="wvShowLaurel"> Laureles</label> ' +
          '<label><input type="checkbox" id="wvShowMystic"> Moneda Mística</label>' +
        '</div>' +
        '<div class="group">' +
          '<label>Categoría: <select id="wvCat">' +
            '<option value="">(Todas)</option>' +
            '<option value="account">Mejoras de Cuenta</option>' +
            '<option value="cosmetic">Cosméticos</option>' +
            '<option value="consumable">Consumibles</option>' +
            '<option value="material">Materiales</option>' +
            '<option value="other">Otros</option>' +
          '</select></label>' +
          '<label>Tipo: <select id="wvType"><option value="">(Todos)</option></select></label>' +
          '<label>Extra 1: <select id="wvExtra1"><option value="">(Todos)</option></select></label>' +
          '<label>Extra 2: <select id="wvExtra2"><option value="">(Todos)</option></select></label>' +
          '<button id="wvViewToggle" class="btn btn--ghost" title="Cambiar vista">Vista: Tarjetas</button>' +
          '<button id="wvFiltersClear" class="btn btn--ghost">Limpiar filtros</button>' +
        '</div>' +
      '</div>'
    );
  }

  function mountWVShopControls(container) {
    var host = container.querySelector('.wv-shop-toolbar');
    if (host) return host;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = createShopToolbarHtml();
    var toolbar = wrapper.firstElementChild;
    container.prepend(toolbar);
    return toolbar;
  }

  function ensureShopToolbarStructure(container) {
    var tb = container.querySelector('.wv-shop-toolbar');
    if (!tb) return mountWVShopControls(container);
    var needRebuild = !tb.querySelector('#wvViewToggle') || !tb.querySelector('#wvType');
    if (needRebuild) {
      console.info('[WV] reconstruyendo toolbar Tienda (faltaban controles nuevos)…');
      tb.remove();
      return mountWVShopControls(container);
    }
    return tb;
  }

  function renderShopTable(area, rows, itemsMap, headerHtml) {
    var trs = rows.map(function (x) {
      var it = (x.item_id != null) ? itemsMap.get(x.item_id) : null;
      var icon = it && it.icon ? ('<img class="wv-item-icon" src="' + it.icon + '" alt="" loading="lazy"/>') : '';
      var name = it && it.name ? it.name : (x.item_id != null ? ('Item #' + x.item_id) : (x.type || '—'));
      var qty = (x.item_count && x.item_count > 1) ? (' <span class="muted">×' + x.item_count + '</span>') : '';
      var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : '∞';
      var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;
      var marks = __wvShopState.marks || {};
      var marked = Number(marks[x.id] || 0);
      var effectivePurchased = purchasedApi + marked;
      var left = (limit === '∞') ? '∞' : Math.max(0, limit - effectivePurchased);
      var rc = rarityClass(it && it.rarity);
      var nameHtml = '<span class="' + rc + '">' + escapeHtml(name) + '</span>';
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
          '<td class="nowrap">' + icon + nameHtml + qty + '</td>' +
          '<td>' + escapeHtml(x.type || '') + '</td>' +
          '<td class="right">' + (x.cost || 0) + '</td>' +
          '<td class="right">' + purchasedApi + ' / ' + limit + '</td>' +
          '<td class="right">' + left + '</td>' +
          '<td class="right">' + ctr + '</td>' +
        '</tr>'
      );
    }).join('');
    area.innerHTML =
      headerHtml +
      '<div class="table-wrap">' +
        '<table class="simple">' +
          '<thead><tr>' +
            '<th>Ítem</th><th>Tipo</th><th class="right">Costo (AA)</th><th class="right">Comprado</th><th class="right">Restante</th><th class="right">Marcar</th>' +
          '</tr></thead>' +
          '<tbody>' + trs + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function renderShopCards(area, rows, itemsMap, headerHtml) {
    var cards = rows.map(function(x){
      var it = (x.item_id != null) ? itemsMap.get(x.item_id) : null;
      var icon = it && it.icon ? it.icon : '';
      var name = it && it.name ? it.name : (x.item_id != null ? ('Item #' + x.item_id) : (x.type || '—'));
      var rc = rarityClass(it && it.rarity);

      var cost = (x.cost || 0);
      var limit = (typeof x.purchase_limit === 'number') ? x.purchase_limit : '∞';
      var purchasedApi = (typeof x.purchased === 'number') ? x.purchased : 0;

      var marks = __wvShopState.marks || {};
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

      return (
        '<div class="wv-card">' +
          '<div class="wv-card__top">' +
            '<div class="wv-card__iconWrap">' + (icon ? ('<img class="wv-card__icon" src="'+icon+'" alt="" loading="lazy"/>') : '') + '</div>' +
            '<div class="wv-card__name '+rc+'" title="'+escapeHtml(name)+'">'+escapeHtml(name)+'</div>' +
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

    area.innerHTML = headerHtml + '<div class="wv-card-grid">' + cards + '</div>';
  }

  function applyShopFiltersAndRender(containerId) {
    var c = el(containerId); if (!c) return;
    var area = c.querySelector('#wvShopTableArea'); if (!area) return;

    var st = __wvShopState;
    var merged  = st.merged || [];
    var itemsMap= st.itemsMap || new Map();

    var spentApi = 0;
    merged.forEach(function(x){ var cost=+x.cost||0, pc=+x.purchased||0; if (cost>0 && pc>0) spentApi += cost*pc; });
    var reservedMarks = 0;
    Object.keys(st.marks || {}).forEach(function(id){
      var m = +st.marks[id] || 0;
      var row = merged.find(function(x){ return String(x.id) === String(id); });
      if (row && m > 0) reservedMarks += (row.cost || 0) * m;
    });
    var aaAvail = (typeof st.aa === 'number') ? st.aa : 0;
    var aaLeft  = Math.max(0, aaAvail - reservedMarks);
    var iconHtml = st.aaIconUrl ? ('<img src="'+st.aaIconUrl+'" alt="" width="16" height="16" style="vertical-align:middle;margin-right:6px;" loading="lazy"/>') : '';
    var headerHtml =
      '<p class="muted">Aclamación Astral — Disponible: ' + iconHtml + '<strong>' + aaAvail + '</strong>' +
      ' • Gastado (API): <strong>' + spentApi + '</strong>' +
      ' • Reservado (marcas): <strong>' + reservedMarks + '</strong>' +
      ' • Restante: <strong>' + aaLeft + '</strong></p>';

    var rows = merged.filter(function (x) {
      var it = (x.item_id != null) ? itemsMap.get(x.item_id) : null;
      return passShopFilters(x, it, st);
    }).slice(0, 1000);

    if (st.filters.view === 'cards') renderShopCards(area, rows, itemsMap, headerHtml);
    else renderShopTable(area, rows, itemsMap, headerHtml);

    area.querySelectorAll('.wv-counter').forEach(function(host){
      var id = host.getAttribute('data-id');
      var btnDec = $('.wv-dec', host), btnInc = $('.wv-inc', host);
      var spanVal = $('span.muted', host);
      var findRow = function(){ return __wvShopState.merged.find(function(x){ return String(x.id)===String(id); }); };
      var limitOf = function(row){ return (typeof row.purchase_limit === 'number') ? row.purchase_limit : Infinity; };
      var purchasedApiOf = function(row){ return (typeof row.purchased === 'number') ? row.purchased : 0; };

      function refresh(val){ spanVal.textContent = String(val); applyShopFiltersAndRender('wvTabShop'); }

      btnDec && btnDec.addEventListener('click', function(){
        var row = findRow(); if (!row) return;
        var marks = __wvShopState.marks || {};
        var cur = +marks[id] || 0;
        if (cur <= 0) return;
        cur -= 1; marks[id] = cur;
        __wvShopState.marks = marks;
        saveShopMarks(marksNamespace(), marks);
        refresh(cur);
      });

      btnInc && btnInc.addEventListener('click', function(){
        var row = findRow(); if (!row) return;
        var marks = __wvShopState.marks || {};
        var cur = +marks[id] || 0;
        var cap = Math.max(0, limitOf(row) - purchasedApiOf(row));
        if (cur >= cap) return;
        cur += 1; marks[id] = cur;
        __wvShopState.marks = marks;
        saveShopMarks(marksNamespace(), marks);
        refresh(cur);
      });
    });
  }

  function ensureWVShopControls(containerId) {
    var c = el(containerId);
    if (!c) return;

    var toolbar = ensureShopToolbarStructure(c);

    var area = c.querySelector('#wvShopTableArea');
    if (!area) {
      area = document.createElement('div');
      area.id = 'wvShopTableArea';
      if (toolbar.nextSibling) c.insertBefore(area, toolbar.nextSibling);
      else c.appendChild(area);
    }

    var optList = __wvShopState.optionsList || [];
    ['wvExtra1','wvExtra2'].forEach(function(id){
      var s = el(id); if (!s || s.__filled) return;
      var frag = document.createDocumentFragment();
      optList.forEach(function (name) { var o = document.createElement('option'); o.value=name; o.textContent=name; frag.appendChild(o); });
      s.appendChild(frag); s.__filled = true;
    });

    var typeList = __wvShopState.typeOptions || [];
    var sType = el('wvType');
    if (sType && !sType.__filled) {
      var fragT = document.createDocumentFragment();
      typeList.forEach(function (t) { var o = document.createElement('option'); o.value=t; o.textContent=t; fragT.appendChild(o); });
      sType.appendChild(fragT); sType.__filled = true;
    }

    loadShopFilters();
    el('wvOnlyStock').checked = !!__wvShopState.filters.onlyStock;
    el('wvShowGold').checked  = !!__wvShopState.filters.showGold;
    el('wvShowLaurel').checked= !!__wvShopState.filters.showLaurel;
    el('wvShowMystic').checked= !!__wvShopState.filters.showMystic;
    el('wvCat').value         = __wvShopState.filters.category || '';
    if (el('wvType')) el('wvType').value = __wvShopState.filters.type || '';
    if (__wvShopState.filters.extra1) el('wvExtra1').value = __wvShopState.filters.extra1;
    if (__wvShopState.filters.extra2) el('wvExtra2').value = __wvShopState.filters.extra2;

    var vbtn = el('wvViewToggle');
    if (vbtn) vbtn.textContent = 'Vista: ' + (__wvShopState.filters.view === 'cards' ? 'Tarjetas' : 'Tabla');

    wireShopToolbar(containerId);
  }

  function wireShopToolbar(containerId) {
    var ids = ['wvOnlyStock','wvShowGold','wvShowLaurel','wvShowMystic','wvCat','wvType','wvExtra1','wvExtra2','wvViewToggle','wvFiltersClear'];
    ids.forEach(function (id) {
      var n = el(id); if (!n || n.__wired) return; n.__wired = true;

      if (id === 'wvFiltersClear') {
        n.addEventListener('click', function(){
          __wvShopState.filters = { onlyStock:false, showGold:false, showLaurel:false, showMystic:false, category:'', type:'', extra1:'', extra2:'', view:(__wvShopState.filters.view || 'cards') };
          saveShopFilters();
          el('wvOnlyStock').checked=false; el('wvShowGold').checked=false; el('wvShowLaurel').checked=false; el('wvShowMystic').checked=false;
          el('wvCat').value=''; if (el('wvType')) el('wvType').value='';
          if (el('wvExtra1')) el('wvExtra1').value=''; if (el('wvExtra2')) el('wvExtra2').value='';
          applyShopFiltersAndRender('wvTabShop');
        });
        return;
      }

      if (id === 'wvViewToggle') {
        n.addEventListener('click', function(){
          __wvShopState.filters.view = (__wvShopState.filters.view === 'cards') ? 'table' : 'cards';
          n.textContent = 'Vista: ' + (__wvShopState.filters.view === 'cards' ? 'Tarjetas' : 'Tabla');
          saveShopFilters();
          applyShopFiltersAndRender('wvTabShop');
        });
        return;
      }

      var handler = function(){
        __wvShopState.filters.onlyStock = !!el('wvOnlyStock').checked;
        __wvShopState.filters.showGold  = !!el('wvShowGold').checked;
        __wvShopState.filters.showLaurel= !!el('wvShowLaurel').checked;
        __wvShopState.filters.showMystic= !!el('wvShowMystic').checked;
        __wvShopState.filters.category  = el('wvCat').value || '';
        __wvShopState.filters.type      = (el('wvType') && el('wvType').value) || '';
        __wvShopState.filters.extra1    = el('wvExtra1').value || '';
        __wvShopState.filters.extra2    = el('wvExtra2').value || '';
        saveShopFilters();
        applyShopFiltersAndRender('wvTabShop');
      };
      n.addEventListener('change', handler);
      if (n.tagName === 'SELECT') n.addEventListener('input', handler);
    });
  }

  function marksNamespace() {
    var token = getSelectedToken() || 'anon';
    var fp = token ? (token.slice(0,4) + '…' + token.slice(-4)) : 'anon';
    var seasonId = __wvShopState.season && (__wvShopState.season.id || __wvShopState.season.title) || 'season';
    return fp + ':' + seasonId;
  }

  function renderWVShopFull(containerId, merged, itemsMap, aa, aaIconUrl, season) {
    var c = el(containerId); if (!c) return;

    __wvShopState.merged   = merged || [];
    __wvShopState.itemsMap = itemsMap || new Map();
    __wvShopState.aa       = (typeof aa === 'number') ? aa : 0;
    __wvShopState.aaIconUrl= aaIconUrl || null;
    __wvShopState.season   = season || null;

    __wvShopState.optionsList = buildOptionsList(__wvShopState.merged, itemsMap);
    __wvShopState.typeOptions = buildTypeOptions(__wvShopState.merged);

    __wvShopState.marks = loadShopMarks(marksNamespace());

    ensureWVShopControls(containerId);
    applyShopFiltersAndRender(containerId);
  }

  function mountWVTabBehavior() {
    var btns = [
      el('wvTabBtnDaily'),
      el('wvTabBtnWeekly'),
      el('wvTabBtnSpecial'),
      el('wvTabBtnShop')
    ].filter(Boolean);

    var panels = {
      daily:   el('wvTabDaily'),
      weekly:  el('wvTabWeekly'),
      special: el('wvTabSpecial'),
      shop:    el('wvTabShop')
    };

    function selectTab(name) {
      Object.keys(panels).forEach(function (k) {
        var p = panels[k];
        if (!p) return;
        if (k === name) p.removeAttribute('hidden');
        else p.setAttribute('hidden', 'hidden');
      });
      btns.forEach(function (b) {
        var isSel = (b && b.getAttribute('data-tab') === name);
        if (b) b.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });

      if (name === 'shop') {
        setObjToolbarVisibility(false);
        setShopToolbarVisibility(true);
      } else {
        setObjToolbarVisibility(true);
        setShopToolbarVisibility(false);
      }
    }

    btns.forEach(function (b) {
      if (!b) return;
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        var name = b.getAttribute('data-tab');
        selectTab(name);
      });
    });

    selectTab('daily');
  }

  function ensureWVRefreshButton() {
    var panel = el('wvPanel');
    if (!panel) return;
    if (panel.__refreshAdded) return;
    panel.__refreshAdded = true;

    var head = panel.querySelector('.panel-head');
    if (!head) return;

    var btn = document.createElement('button');
    btn.className = 'btn btn--ghost';
    btn.textContent = 'Refrescar';
    btn.title = 'Volver a consultar (sin caché)';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', function () { renderWV({ nocache: true }); });

    var title = head.querySelector('.panel-head__title');
    if (title && title.parentNode) title.parentNode.appendChild(btn);
    else head.appendChild(btn);
  }

  async function renderWV(opts) {
    opts = opts || {};
    ensureRuntimeStyles();
    ensureWVObjToolbar();
    var token = getSelectedToken();
    var syncNote = el('wvSyncNote');

    setText('wvSeasonTitle', '—'); setText('wvSeasonDates', '—');
    ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function (id) {
      var c = el(id); if (c) c.innerHTML = '<p class="muted">Cargando…</p>';
    });
    if (syncNote) syncNote.classList.add('hidden');

    var perm = await ensureWVPermissionsOrMessage();
    if (!perm.ok) return;

    try {
      var season = await GW2Api.getWVSeason({ nocache: !!opts.nocache });
      setWVSeasonHeader(season);

      if (!token) {
        ['wvTabDaily','wvTabWeekly','wvTabSpecial','wvTabShop'].forEach(function (id) {
          var c = el(id);
          if (c) c.innerHTML = '<p class="muted">Seleccioná una API Key para ver objetivos y tienda.</p>';
        });
        setObjToolbarVisibility(false); setShopToolbarVisibility(false);
        return;
      }

      var results = await Promise.allSettled([
        GW2Api.getWVDaily(token,  { nocache: !!opts.nocache }),
        GW2Api.getWVWeekly(token, { nocache: !!opts.nocache }),
        GW2Api.getWVSpecial(token,{ nocache: !!opts.nocache }),
        GW2Api.getAccountWVListings(token, { nocache: !!opts.nocache }),
        GW2Api.getWVAccount(token, { nocache: !!opts.nocache })
      ]);

      var dailyRes   = results[0].status === 'fulfilled' ? results[0].value : null;
      var weeklyRes  = results[1].status === 'fulfilled' ? results[1].value : null;
      var specialRes = results[2].status === 'fulfilled' ? results[2].value : null;
      var accShopRes = results[3].status === 'fulfilled' ? results[3].value : [];
      var wvAccRes   = results[4].status === 'fulfilled' ? results[4].value : null;

      __wvCache.daily   = dailyRes;
      __wvCache.weekly  = weeklyRes;
      __wvCache.special = specialRes;

      renderWVTabObjectives('wvTabDaily',   dailyRes);
      renderWVTabObjectives('wvTabWeekly',  weeklyRes);
      renderWVTabObjectives('wvTabSpecial', specialRes);

      var looksStale = [dailyRes, weeklyRes, specialRes].some(function (d) {
        return !d || !d.objectives || !d.objectives.length;
      });
      if (looksStale && syncNote) syncNote.classList.remove('hidden');

      var aaValue = 0, aaIconUrl = null;
      if (wvAccRes && typeof wvAccRes.astral_acclaim === 'number') {
        aaValue = wvAccRes.astral_acclaim; aaIconUrl = wvAccRes.icon || null;
      } else {
        try {
          var aaFB = await GW2Api.getAstralAcclaimBalance(token, { nocache: !!opts.nocache });
          aaValue = aaFB.value || 0; aaIconUrl = (aaFB.meta && aaFB.meta.icon) ? aaFB.meta.icon : null;
        } catch (_){}
      }

      var globalListings = await GW2Api.getWVListings({ nocache: !!opts.nocache }) || [];
      var mapGlobalById  = new Map(globalListings.map(function (g) { return [g.id, g]; }));

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
      var items = itemIds.length ? await GW2Api.getItemsMany(itemIds, { nocache: !!opts.nocache }) : [];
      var itemsMap = new Map(items.map(function (it) { return [it.id, it]; }));

      ensureRuntimeStyles();
      __wvShopState.optionsList = buildOptionsList(merged, itemsMap);
      __wvShopState.typeOptions = buildTypeOptions(merged);

      renderWVShopFull('wvTabShop', merged, itemsMap, aaValue, aaIconUrl, season);
      ensureWVRefreshButton();

      // Ajustar toolbars según la pestaña actual
      var activeBtn = $('.tabs [aria-selected="true"]', el('wvPanel'));
      var name = activeBtn ? activeBtn.getAttribute('data-tab') : 'daily';
      if (name === 'shop') { setObjToolbarVisibility(false); setShopToolbarVisibility(true); }
      else { setObjToolbarVisibility(true); setShopToolbarVisibility(false); }

    } catch (e) {
      console.error('[WizardVault] error:', e);
      renderWVErrorAllTabs('Error al cargar. Verificá tu API Key.');
      ensureWVRefreshButton();
    }
  }

  // ============================ ROUTER ============================
  function route() {
    var h = (location.hash || '').trim();

    // Normalizar hash vacío a '#/cards' (Wallet)
    if (h === '' || h === '#' || h === '#/' || h === '#/cards') {
      showPanel('walletPanel');

      // Asides
      el('asideConvSection') && el('asideConvSection').removeAttribute('hidden');
      el('asideNextFeatures') && el('asideNextFeatures').removeAttribute('hidden');
      var achAside = el('achAsidePanel'); if (achAside) achAside.setAttribute('hidden','hidden');
      var metaAside = el('metaAsideNext'); if (metaAside) metaAside.setAttribute('hidden','hidden');

      setActiveNav('#/cards');
      return;
    }

    if (h === '#/meta') {
      showPanel('metaPanel');

      // Asides
      el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
      el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
      var achAside2 = el('achAsidePanel'); if (achAside2) achAside2.setAttribute('hidden','hidden');
      var metaAside2 = el('metaAsideNext'); if (metaAside2) metaAside2.removeAttribute('hidden');

      // 🔥 AVISO AL MÓDULO MetaEventos: inicia / re-renderiza
      document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view: 'meta' } }));

      setActiveNav('#/meta');
      return;
    }

    if (h === '#/account/achievements') {
      showPanel('achievementsPanel');
      ensureRuntimeStyles();

      // Asides
      el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
      el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
      var metaAside3 = el('metaAsideNext'); if (metaAside3) metaAside3.setAttribute('hidden','hidden');
      var achAside3 = el('achAsidePanel'); if (achAside3) achAside3.removeAttribute('hidden');

      if (window.Achievements && typeof window.Achievements.render === 'function') {
        window.Achievements.render();
      }

      setActiveNav('#/account/achievements');
      return;
    }

    if (h === '#/account/wizards-vault') {
      showPanel('wvPanel');
      ensureRuntimeStyles();
      ensureWVObjToolbar();
      mountWVTabBehavior();
      renderWV();

      // Asides
      el('asideConvSection') && el('asideConvSection').setAttribute('hidden','hidden');
      el('asideNextFeatures') && el('asideNextFeatures').setAttribute('hidden','hidden');
      var achAside4 = el('achAsidePanel'); if (achAside4) achAside4.setAttribute('hidden','hidden');
      var metaAside4 = el('metaAsideNext'); if (metaAside4) metaAside4.setAttribute('hidden','hidden');

      setActiveNav('#/account/wizards-vault');
      return;
    }

    // Fallback
    showPanel('walletPanel');
    setActiveNav('#/cards');
  }

  // ----------------------------- Event wiring ------------------------------
  function onKeySelectChange() {
    var h = (location.hash || '');
    if (h === '#/account/achievements') {
      if (window.Achievements && typeof window.Achievements.render === 'function') {
        window.Achievements.render();
      }
    }
    else if (h === '#/account/wizards-vault') {
      renderWV();
    }
    // Meta escucha gn:tokenchange desde app.js
  }

  function onDomReady() {
    ensureRuntimeStyles();

    var heroTabs = document.querySelectorAll('.overlay-tab');
    heroTabs.forEach(function (btn) {
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
    route(); // setActiveNav se dispara dentro de route()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }

})();