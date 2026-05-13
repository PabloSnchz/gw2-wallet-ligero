/*!
 * js/wv-purchase-detail.js — Vista de Detalle de Compras (Wizard's Vault)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.13.0 (2026-04-05) — Estado online basado en last_modified
 *
 * Cambios v1.13.0:
 *  - REEMPLAZADA lógica de PvP por last_modified de /v2/account
 *  - Estado online basado en CUALQUIER actividad de la cuenta (PvP, PvE, WvW, economía)
 *  - Más preciso y con menor delay que el endpoint de partidas PvP
 *  - Eliminada dependencia de permiso 'pvp' (usa 'account' que todas las keys tienen)
 *
 * Cambios v1.12.0:
 *  - Botón "Online" en el dashboard (junto a Sincronizar)
 *  - Colores de nombre de cuenta según progreso semanal (rojo/amarillo/verde)
 *
 * Cambios v1.11.0:
 *  - Input numérico para marcas manuales (sin botones +/-)
 *  - Botón MAX para llenar automáticamente con el límite máximo
 *  - Auto-guardado con debounce (500ms)
 *  - Función dual: Math.max(apiPurchased, manualMarks)
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
  function formatTimestamp(date){
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ------------------------------ Estado -------------------------------
  var state = {
    inited: false,

    currentSeason: { year:null, seq:null, season_id:null, title:null, start:null, end:null },

    keys: [],
    accounts: [],
    pinnedUnion: [],
    globalItemsById: new Map(),

    filters: { q:'', onlyPending:false, onlyPendingCols:false, sort:'delta' },

    loading: false,
    prevTab: 'shop',
    tabsHidden: false,
    accessIconUrl: null,
    dashTimer: null,
    lastRefreshTime: null
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
      
      /* Animación de entrada */
      #wvPDPanel {
        animation: wvpdFadeInScale 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
      }
      @keyframes wvpdFadeInScale {
        0% {
          opacity: 0;
          transform: scale(0.98);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      .wvpd-dash{ display:grid; gap:10px; margin-bottom:12px; }
      .wvpd-dash__grid{ display:grid; gap:10px; grid-template-columns: repeat(3, minmax(0,1fr)); }
      .wvpd-card{ background: linear-gradient(180deg, #0f1116 0%, #0d0f14 100%); border:1px solid #26262b; border-radius:12px; padding:10px 12px; }}
      
      /* ====== Skeleton Loader ====== */
      .wvpd-skeleton {
        background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%);
        background-size: 200% 100%;
        animation: wvpdShimmer 1.2s infinite;
        border-radius: 8px;
      }
      @keyframes wvpdShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .wvpd-skeleton-bar {
        height: 24px;
        background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%);
        background-size: 200% 100%;
        animation: wvpdShimmer 1.2s infinite;
        border-radius: 6px;
      }
      .wvpd-skeleton-table-wrap {
        padding: 20px;
        text-align: center;
      }
      .wvpd-skeleton-table-wrap .wvpd-skeleton-bar {
        height: 200px;
        width: 100%;
      }
      
      /* ====== KPIs con borde lateral y glow ====== */
      .wvpd-kpi{ 
        display:flex; 
        align-items:center; 
        justify-content:space-between; 
        gap:10px;
        transition: all 0.2s ease;
        border-left-width: 3px;
        border-left-style: solid;
        border-left-color: transparent;
      }
      .wvpd-kpi--ok { 
        border-left-color: #a0ffc8;
        box-shadow: 0 0 6px rgba(160, 255, 200, 0.2);
      }
      .wvpd-kpi--warn { 
        border-left-color: #ffd36b;
        box-shadow: 0 0 6px rgba(255, 211, 107, 0.2);
      }
      .wvpd-kpi--bad { 
        border-left-color: #ff9d9d;
        box-shadow: 0 0 6px rgba(255, 157, 157, 0.2);
      }
      .wvpd-kpi__lbl{ color:#b4bad0; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:0.5px; }
      .wvpd-kpi__val{ font-size:20px; font-weight:800; letter-spacing:0.2px; }
      .wvpd-kpi--ok .wvpd-kpi__val{ color:#a0ffc8; }
      .wvpd-kpi--warn .wvpd-kpi__val{ color:#ffd36b; }
      .wvpd-kpi--bad .wvpd-kpi__val{ color:#ff9d9d; }
      
      .wvpd-rows{ display:grid; gap:8px; grid-template-columns: 1.2fr 1.8fr; }
      @media (max-width: 980px){ .wvpd-rows{ grid-template-columns: 1fr; } }
      .wvpd-rot{ display:flex; gap:10px; flex-wrap:wrap; align-items: center; }
      .wvpd-rot__pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #0c0e14;
        padding: 4px 12px;
        border-radius: 20px;
        border: 1px solid #2a2c35;
      }
      .wvpd-rot__pill .clock-ico {
        display: inline-flex;
        align-items: center;
      }
      .wvpd-rot__pill .clock-ico img {
        width: 18px;
        height: 18px;
        filter: brightness(0.9);
      }
      .wvpd-cols{ display:flex; gap:10px; flex-wrap:wrap; }
      .wvpd-col{ flex:1 1 240px; min-width:220px; }
      .wvpd-list{ margin:0; padding:0; list-style:none; display:grid; gap:6px; }
      .wvpd-li{ display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0c0e13; border:1px solid #222631; border-radius:10px; padding:8px 10px; transition: all 0.15s ease; }
      .wvpd-li:hover { background: #11131c; border-color: #2e3342; }
      .wvpd-li__icon img{ width:22px; height:22px; border-radius:6px; }
      
      /* ====== Header rediseñado ====== */
      .wvpd-header{ 
        display:flex; 
        align-items:center; 
        justify-content:space-between; 
        gap:8px; 
        background: linear-gradient(135deg, #0f1118 0%, #0b0d12 100%);
        border: 1px solid #2a2c35;
        border-radius: 16px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .wvpd-banner{ 
        display:flex; 
        align-items:center; 
        gap:10px; 
        background: rgba(20, 22, 32, 0.6);
        backdrop-filter: blur(4px);
        border-radius: 12px;
        padding: 8px 12px;
        border-left: 3px solid #7bc2ff;
      }
      .wvpd-banner__icon img, .wvpd-banner__icon svg { width: 32px; height: 32px; border-radius: 8px; }
      .wvpd-banner__title { font-weight: 700; font-size: 1rem; color: #e8ecf5; }
      .wvpd-help { font-size: 0.7rem; color: #8e94a8; }
      .wvpd-stickyhint { font-size: 0.7rem; color: #6a7080; background: #0c0e14; padding: 4px 10px; border-radius: 20px; }
      
      /* ====== Filtros mejorados ====== */
      .wvpd-filters{ 
        display: flex; 
        gap: 12px; 
        flex-wrap: wrap; 
        align-items: center;
        margin: 12px 0 8px; 
        background: #0c0e14;
        padding: 8px 16px;
        border-radius: 40px;
        width: fit-content;
      }
      .wvpd-filters input, 
      .wvpd-filters select {
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 20px;
        padding: 6px 12px;
        color: #e0e4ed;
        font-size: 0.8rem;
      }
      .wvpd-filters input:focus, 
      .wvpd-filters select:focus {
        outline: none;
        border-color: #5a6e9a;
      }
      .wvpd-filters label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: #b4bad0;
        cursor: pointer;
      }
      .wvpd-filters button {
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 20px;
        padding: 6px 12px;
        color: #e0e4ed;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .wvpd-filters button:hover {
        background: #252830;
        border-color: #3a3e4a;
      }
      
      /* ====== Status bar con timestamp ====== */
      .wvpd-status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 6px 0 10px 0;
        font-size: 0.75rem;
      }
      .wvpd-status-msg {
        color: #9aa2b5;
      }
      .wvpd-status-msg.error {
        color: #ff9d9d;
      }
      .wvpd-timestamp {
        color: #6a7080;
        font-family: monospace;
        font-size: 0.7rem;
      }
      
      .wvpd-tablewrap{ overflow:auto; border:1px solid #26262b; border-radius:12px; margin-top: 8px; margin-left: -8px; margin-right: -8px; width: calc(100% + 16px); }
      table.wvpd{ border-collapse:separate; border-spacing:0; width:100%; }
      table.wvpd th, table.wvpd td{ padding:6px 8px; border-bottom:1px solid #24252a; white-space:nowrap; vertical-align: middle; }
      table.wvpd thead th{ 
        position:sticky; 
        top:0; 
        background: #0f1118; 
        z-index:2;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #9aa2b8;
        border-bottom: 1px solid #2a2c35;
      }
      table.wvpd th:first-child, table.wvpd td:first-child{ position:sticky; left:0; background:#0e1116; z-index:1; }
      .wvpd-th-item {
        min-width: 50px;
      }

      /* ====== Encabezados tipo pill ====== */
      .wvpd-header-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 24px;
        padding: 4px 12px;
        font-weight: 500;
        font-size: 0.7rem;
        text-transform: none;
        letter-spacing: normal;
        white-space: nowrap;
      }
      .wvpd-header-pill .wvpd-header-label {
        color: #b4bad0;
      }
      .wvpd-header-icon {
        display: inline-flex;
        align-items: center;
      }

      /* ====== Celdas de AA con estilo consistente ====== */
      .wvpd-aa-cell {
        font-weight: 500;
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
      }
      .wvpd-aa-delta {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .wvpd-aa-delta-icon {
        font-size: 0.7rem;
        opacity: 0.8;
      }

      /* ====== Colores canónicos para PD ====== */
      .wvpd-green{ color:#a0ffc8 !important; font-weight:700; }
      .wvpd-red{   color:#ff9d9d !important; font-weight:700; }
      .wvpd-acc--red{ color:#ff9d9d !important; font-weight:800; }
      .wvpd-acc--yellow{ color:#ffd36b !important; font-weight:800; }
      .wvpd-acc--green{ color:#a0ffc8 !important; font-weight:900; }

      /* Delta en Top cuentas */
      .wvpd-li__delta--bad{ color:#ff9d9d !important; font-weight:700; }
      .wvpd-li__delta--ok{  color:#a0ffc8 !important; font-weight:700; }
      
      /* ====== Badges con hover ====== */
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 500;
        transition: transform 0.1s ease, filter 0.1s ease;
        cursor: default;
      }
      .badge:hover {
        transform: scale(1.02);
        filter: brightness(1.1);
      }
      .badge--success {
        background: #1a3a2a;
        color: #a0ffc8;
        border: 1px solid #2a6a4a;
      }
      .badge--warning {
        background: #3a2a1a;
        color: #ffd966;
        border: 1px solid #aa8a3a;
      }
      .badge--info {
        background: #1a2a3a;
        color: #7bc2ff;
        border: 1px solid #3a6a9a;
      }
      .badge--infinite {
        background: #1a2a2a;
        color: #7bc2ff;
        border: 1px solid #2a6a6a;
      }
      
      /* ====== Barra de progreso ultra compacta ====== */
      .wvpd-item-progress--compact {
        min-width: 140px;
        max-width: 180px;
      }
      .wvpd-item-progress__status {
        font-size: 0.65rem;
        font-weight: 600;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wvpd-item-progress__bar {
        height: 4px;
        background: #2a2c35;
        border-radius: 2px;
        overflow: hidden;
      }
      .wvpd-item-progress__fill {
        height: 100%;
        background: linear-gradient(90deg, #7bc2ff, #a0ffc8);
        border-radius: 2px;
        transition: width 0.2s ease;
      }
      
      /* ====== Input numérico para marcas manuales ====== */
      .wvpd-manual-input {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #2a2c35;
      }
      .wvpd-manual-input label {
        font-size: 0.65rem;
        color: #9aa2b8;
      }
      .wvpd-manual-input input {
        width: 80px;
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 6px;
        padding: 4px 6px;
        color: #e0e4ed;
        font-size: 0.7rem;
        text-align: center;
      }
      .wvpd-manual-input input:focus {
        outline: none;
        border-color: #5a6e9a;
      }
      .wvpd-manual-input .btn-max {
        padding: 4px 8px;
        font-size: 0.65rem;
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 6px;
        color: #ffd36b;
        cursor: pointer;
      }
      .wvpd-manual-input .btn-max:hover {
        background: #252830;
        border-color: #3a3e4a;
      }
      
      /* ====== Progreso semanal en celda de cuenta ====== */
      .wvpd-account-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 100px;
      }
      .wvpd-account-name {
        font-weight: 600;
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .wvpd-account-progress {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .wvpd-account-progress__bar {
        flex: 1;
        height: 3px;
        background: #2a2c35;
        border-radius: 2px;
        overflow: hidden;
      }
      .wvpd-account-progress__fill {
        height: 100%;
        background: linear-gradient(90deg, #7bc2ff, #a0ffc8);
        border-radius: 2px;
        transition: width 0.2s ease;
      }
      .wvpd-account-progress__text {
        font-size: 0.6rem;
        color: #9aa2b8;
        min-width: 28px;
        text-align: right;
      }
      
      /* Pill de cuenta (contenedor) */
      .wvpd-account-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #1a1c24;
        border: 1px solid #2a2c35;
        border-radius: 24px;
        padding: 4px 12px;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      .wvpd-account-pill:hover {
        background: #20222c;
        border-color: #3a3e4a;
      }

      /* Tooltip mejorado para badges */
      [data-tip] {
        position: relative;
        cursor: help;
      }
      [data-tip]:hover:after {
        content: attr(data-tip);
        position: absolute;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        background: #0c0e14;
        color: #e0e4ed;
        font-size: 0.7rem;
        padding: 4px 8px;
        border-radius: 8px;
        white-space: nowrap;
        z-index: 1000;
        border: 1px solid #3a3e4a;
        pointer-events: none;
      }
      
      /* Bloque de temporada */
      .wv-season {
        margin: 4px 0 12px 0;
        padding: 8px 12px;
        background: #0f1116;
        border-radius: 12px;
        border-left: 3px solid #7bc2ff;
      }
      .wv-season strong {
        font-size: 0.9rem;
      }
      .wv-season span {
        font-size: 0.75rem;
        color: #9aa2b8;
        margin-left: 12px;
      }
      
      /* ====== Estado online (punto verde/rojo) ====== */
      .wvpd-online-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .wvpd-online-dot--green {
        background-color: #a0ffc8;
        box-shadow: 0 0 4px #a0ffc8;
      }
      .wvpd-online-dot--red {
        background-color: #ff9d9d;
        box-shadow: 0 0 4px #ff9d9d;
      }
      .wvpd-online-info {
        font-size: 0.65rem;
        color: #9aa2b8;
        margin-top: 2px;
      }
    `;

    var s = document.createElement('style');
    s.id='wv-pd-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ------------------------------ Skeleton Render --------------------------
  function showSkeleton(){
    var panel = ensurePanel();
    if (!panel) return;
    
    var kpis = ['wvpdKpiAAAvail', 'wvpdKpiAANeed', 'wvpdKpiAADelta'];
    kpis.forEach(function(id){
      var el = document.getElementById(id);
      if (el) {
        var valEl = el.querySelector('.wvpd-kpi__val');
        if (valEl) valEl.innerHTML = '<div class="wvpd-skeleton-bar" style="width:60px; height:28px;"></div>';
      }
    });
    
    var countdowns = ['wvpdCountDaily', 'wvpdCountWeekly', 'wvpdCountSeason'];
    countdowns.forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="wvpd-skeleton-bar" style="width:80px; height:20px;"></div>';
    });
    
    var useful = document.getElementById('wvpdUsefulContent');
    if (useful) {
      useful.innerHTML = '<div class="wvpd-col"><div class="wvpd-skeleton-bar" style="height:40px;"></div><div class="wvpd-skeleton-bar" style="height:40px; margin-top:8px;"></div></div><div class="wvpd-col"><div class="wvpd-skeleton-bar" style="height:40px;"></div><div class="wvpd-skeleton-bar" style="height:40px; margin-top:8px;"></div></div>';
    }
    
    var topAcc = document.getElementById('wvpdTopAccounts');
    if (topAcc) {
      topAcc.innerHTML = '<li class="wvpd-li"><span><div class="wvpd-skeleton-bar" style="width:100px; height:18px;"></div></span><span><div class="wvpd-skeleton-bar" style="width:50px; height:18px;"></div></span></li>'.repeat(3);
    }
    
    var topItems = document.getElementById('wvpdTopItems');
    if (topItems) {
      topItems.innerHTML = '<li class="wvpd-li"><span><div class="wvpd-skeleton-bar" style="width:120px; height:18px;"></div></span><span><div class="wvpd-skeleton-bar" style="width:60px; height:18px;"></div></span></li>'.repeat(3);
    }
    
    var tableWrap = document.getElementById('wvpdTableWrap');
    if (tableWrap) {
      var originalTable = tableWrap.querySelector('table.wvpd');
      if (originalTable) {
        tableWrap.__originalTable = originalTable.cloneNode(true);
      }
      tableWrap.innerHTML = '<div class="wvpd-skeleton-table-wrap"><div class="wvpd-skeleton-bar" style="height:200px;"></div></div>';
    }
  }
  
  function hideSkeletonAndRestoreTable(){
    var tableWrap = document.getElementById('wvpdTableWrap');
    if (!tableWrap) return;
    
    if (tableWrap.__originalTable) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(tableWrap.__originalTable);
      delete tableWrap.__originalTable;
    } else {
      tableWrap.innerHTML = '<table class="wvpd" id="wvpdTable"><thead></thead><tbody></tbody>^<\/table>';
    }
  }

  // ------------------------------ Íconos para countdowns ------------------
  function getCountdownIcon(type){
    var icons = {
      daily: 'assets/icons/523379.png',
      weekly: 'assets/icons/523380.png',
      season: 'assets/icons/523381.png'
    };
    var iconUrl = icons[type] || icons.daily;
    return '<img src="' + iconUrl + '" width="18" height="18" alt="" style="filter: brightness(0.9);">';
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
    return '<img src="assets/icons/3126787.png" alt="" loading="lazy" width="32" height="32">';
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
        // El botón ya lo crea wv-shop-ui.js. Solo wirear el click.
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
      // Evitar que la imagen bloquee los clics
      var img = btn.querySelector('img');
      if (img) img.style.pointerEvents = 'none';
      btn.style.marginLeft = 'auto';

      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        try { window.WVPurchaseDetail?.show(); }
        catch(e){ console.warn('[WV-PD] show() error (new)', e); }
      });

      // Botón Online ELIMINADO - ahora está en el dashboard

      if (insertAfter && insertAfter.parentNode === group) {
        insertAfter.insertAdjacentElement('afterend', btn);
      } else {
        group.appendChild(btn);
      }

      console.debug('[WV-PD] Toolbar button ready');

    }catch(e){ console.warn('[WV-PD] ensureToolbarButton', e); }
  }

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
        '<div class="panel__body">',
          '<div class="wvpd-banner" style="margin-bottom:16px;">',
            '<div class="wvpd-banner__icon" id="wvpdBannerIcon">'+bannerIconHTML()+'</div>',
            '<div>',
              '<div class="wvpd-banner__title">Seguimiento de compras</div>',
              '<div class="wvpd-help">Resumen estratégico y detalle por cuenta/ítem fijado.</div>',
            '</div>',
          '</div>',
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
              '<div class="card">',
                '<div class="wvpd-rot">',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+getCountdownIcon('daily')+'</span><strong id="wvpdCountDaily">—</strong></span>',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+getCountdownIcon('weekly')+'</span><strong id="wvpdCountWeekly">—</strong></span>',
                  '<span class="wvpd-rot__pill"><span class="clock-ico">'+getCountdownIcon('season')+'</span><strong id="wvpdCountSeason">—</strong></span>',
                '</div>',
                '<div id="wvpdUsefulBox" style="margin-top:10px; display:grid; gap:8px">',
                  '<div class="wvpd-kpi__lbl">Datos útiles</div>',
                  '<div id="wvpdUsefulContent" class="wvpd-cols"></div>',
                '</div>',
              '</div>',
              '<div class="card">',
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
          '<div class="wvpd-filters" id="wvpdFilters">',
            '<input type="text" id="wvpdSearch" placeholder="Buscar cuenta…">',
            '<span class="wvpd-stickyhint">Tip: "Pendientes" y orden Δ priorizan lo crítico.</span>',
            '<label><input type="checkbox" id="wvpdOnlyPending"> Solo pendientes</label>',
            '<label><input type="checkbox" id="wvpdOnlyPendingCols"> Solo columnas con pendientes</label>',
            '<label>Orden: <select id="wvpdSort"><option value="delta">Δ (desc)</option><option value="label">Cuenta (A→Z)</option></select></label>',
            '<button id="wvpdSyncBtn" class="btn btn--ghost" title="Forzar sincronización con la API" style="display: inline-flex; align-items: center; gap: 6px;">',
              '<img src="assets/icons/2015716.png" width="14" height="14" alt="Sincronizar">',
              'Sincronizar',
            '</button>',
          '</div>',
          '<div class="wvpd-status-bar" id="wvpdStatusBar">',
            '<span id="wvpdStatusMsg" class="wvpd-status-msg">—</span>',
            '<span id="wvpdTimestamp" class="wvpd-timestamp"></span>',
          '</div>',
          '<div class="wvpd-tablewrap" id="wvpdTableWrap">',
            '<table class="wvpd" id="wvpdTable"><thead></thead><tbody></tbody></table>',
          '</div>',
        '</div>'
      ].join('');

      var rootPanel = panel, t=null;

      rootPanel.querySelector('#wvpdSearch')?.addEventListener('input', function(e){
        clearTimeout(t); t=setTimeout(function(){ state.filters.q = e.target.value.trim().toLowerCase(); renderTable(); updateDashboard(); }, 160);
      });
      rootPanel.querySelector('#wvpdOnlyPending')?.addEventListener('change', function(e){ state.filters.onlyPending = !!e.target.checked; renderTable(); updateDashboard(); });
      rootPanel.querySelector('#wvpdOnlyPendingCols')?.addEventListener('change', function(e){ state.filters.onlyPendingCols = !!e.target.checked; safeRefresh(false); });
      rootPanel.querySelector('#wvpdSort')?.addEventListener('change', function(e){ state.filters.sort = e.target.value||'delta'; renderTable(); });
      rootPanel.querySelector('#wvpdSyncBtn')?.addEventListener('click', function(){ safeRefresh(true); });

      // ====== Botón Online en el dashboard (junto a Sincronizar) ======
      var syncBtn = rootPanel.querySelector('#wvpdSyncBtn');
      if (syncBtn && !rootPanel.querySelector('#wvpdOnlineBtn')) {
        var onlineBtn = document.createElement('button');
        onlineBtn.id = 'wvpdOnlineBtn';
        onlineBtn.className = 'btn btn--ghost';
        onlineBtn.title = 'Actualizar solo estado online (vía last_modified)';
        onlineBtn.style.display = 'inline-flex';
        onlineBtn.style.alignItems = 'center';
        onlineBtn.style.gap = '6px';
        onlineBtn.innerHTML = '<span class="wvpd-online-dot wvpd-online-dot--green" style="width:10px;height:10px;display:inline-block;border-radius:50%;background-color:#a0ffc8;box-shadow:0 0 4px #a0ffc8;"></span> Online';
        onlineBtn.addEventListener('click', function(ev) {
          ev.preventDefault();
          // ✅ Usar el método público expuesto
          if (window.WVPurchaseDetail && typeof window.WVPurchaseDetail.refreshOnlineStatus === 'function') {
            window.WVPurchaseDetail.refreshOnlineStatus();
          } else {
            console.error('[WV-PD] WVPurchaseDetail.refreshOnlineStatus no está disponible');
          }
        });
        syncBtn.insertAdjacentElement('afterend', onlineBtn);
      }

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
    var msgEl = document.getElementById('wvpdStatusMsg');
    if (!msgEl) return;
    msgEl.textContent = String(msg||'');
    msgEl.classList.remove('error');
    if (kind==='error') msgEl.classList.add('error');
  }
  
  function updateTimestamp(){
    var tsEl = document.getElementById('wvpdTimestamp');
    if (tsEl && state.lastRefreshTime) {
      tsEl.textContent = 'Última actualización: ' + formatTimestamp(state.lastRefreshTime);
    } else if (tsEl) {
      tsEl.textContent = '';
    }
  }

  function showPanel(){ 
  var p = ensurePanel(); 
  if (p) {
    p.hidden = false;
    p.removeAttribute('hidden');
    p.style.display = 'block';
  }
}

function hidePanel(){ 
  var p = ensurePanel(); 
  if (p) {
    p.setAttribute('hidden','');
    p.style.display = 'none';
  }
}

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
    updateSeasonDisplay();
  }
  
  function updateSeasonDisplay() {
    var season = state.currentSeason;
    var titleEl = document.getElementById('wvSeasonTitle');
    var datesEl = document.getElementById('wvSeasonDates');
    
    if (!titleEl || !datesEl) return;
    
    if (season && season.title) {
      titleEl.textContent = season.title;
    } else {
      titleEl.textContent = '—';
    }
    
    if (season && season.start && season.end) {
      var startDate = new Date(season.start);
      var endDate = new Date(season.end);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        var options = { year: 'numeric', month: 'short', day: 'numeric' };
        var startStr = startDate.toLocaleDateString('es-ES', options);
        var endStr = endDate.toLocaleDateString('es-ES', options);
        datesEl.textContent = startStr + ' — ' + endStr;
      } else {
        datesEl.textContent = '—';
      }
    } else {
      datesEl.textContent = '—';
    }
  }

  function extractSeasonMetaSteps(weeklyData){
    try {
      var cur = Number(weeklyData && weeklyData.meta_progress_current || 0);
      var tot = Number(weeklyData && weeklyData.meta_progress_complete || 0);
      if (!isFinite(cur) || !isFinite(tot) || tot <= 0){
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

  // ====== FUNCIÓN DUAL ======
  function getTotalPurchased(acc, listingId) {
    const row = findRowByListingId(acc.rows, listingId);
    if (!row) return 0;
    const apiPurchased = row.purchased || 0;
    const manualMarks = (acc.marks && acc.marks[listingId]) || 0;
    return Math.max(apiPurchased, manualMarks);
  }

  // ====== FUNCIÓN PARA ACTUALIZAR UNA SOLA FILA EN LA TABLA (POR TOKEN) ======
  function updateSingleAccountRow(token, updatedAccount) {
    var table = document.getElementById('wvpdTable');
    if (!table) return;
    
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Buscar la fila por data-token en lugar de por índice
    var row = tbody.querySelector('tr[data-token="' + esc(token) + '"]');
    if (!row) return;
    
    var firstCell = row.cells[0];
    if (!firstCell) return;
    
    var isOnline = updatedAccount.isOnline || false;
    var statusColor = isOnline ? 'green' : 'red';
    var statusTitle = isOnline ? 'Activo (actividad reciente)' : 'Inactivo';
    var lastPlayedInfo = isOnline && updatedAccount.lastPlayedChar ? 
        '<div class="wvpd-online-info"><img src="assets/icons/523381.png" width="14" height="14" alt="" style="vertical-align: middle; margin-right: 4px;">' + esc(updatedAccount.lastPlayedChar) + '</div>' : '';
    
    // Mantener el color según progreso semanal
    var stp = Number(updatedAccount.seasonMetaSteps || 0);
    var nameColorClass = (stp >= 6) ? 'wvpd-acc--green' : (stp >= 4 ? 'wvpd-acc--yellow' : 'wvpd-acc--red');
    
    firstCell.innerHTML = `
      <div class="wvpd-account-cell">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="wvpd-online-dot wvpd-online-dot--${statusColor}" title="${statusTitle}"></span>
          <div class="wvpd-account-name ${nameColorClass}">${esc(updatedAccount.label)}</div>
        </div>
        ${lastPlayedInfo}
      </div>
    `;
  }

  // ====== FUNCIÓN PARA ACTUALIZAR TODOS LOS ESTADOS ONLINE (VÍA LAST_MODIFIED) ======
  async function refreshAllOnlineStatus() {
    console.log(LOG, 'Actualizando estado online de todas las cuentas (vía last_modified)...');
    if (!state.accounts || state.accounts.length === 0) {
      console.warn(LOG, 'No hay cuentas cargadas');
      return;
    }
    
    if (window.toast) {
      window.toast('info', 'Actualizando estado online...', { ttl: 1500 });
    }
    
    var updatedCount = 0;
    var onlineCount = 0;
    
    for (var i = 0; i < state.accounts.length; i++) {
      var acc = state.accounts[i];
      try {
        // Obtener account info con last_modified
        const accountInfo = await root.GW2Api.getAccountInfo(acc.token, { nocache: true });
        const isOnline = root.GW2Api.isRecentlyActive(accountInfo, 10); // 10 minutos de umbral
        var lastPlayedChar = null;
        
        if (isOnline && accountInfo && accountInfo.last_modified) {
          const lastModified = new Date(accountInfo.last_modified);
          const now = new Date();
          const minutesSince = Math.floor((now - lastModified) / (1000 * 60));
          lastPlayedChar = `Actividad hace ${minutesSince} min`;
        }
        
        if (acc.isOnline !== isOnline || acc.lastPlayedChar !== lastPlayedChar) {
          acc.isOnline = isOnline;
          acc.lastPlayedChar = lastPlayedChar;
          // Buscar por token en vez de por índice
          updateSingleAccountRow(acc.token, acc);
          updatedCount++;
        }
        if (isOnline) onlineCount++;
        
      } catch(e) {
        console.warn(LOG, 'Error refreshing online status for', acc.label, e);
      }
    }
    
    if (window.toast) {
      if (onlineCount > 0) {
        window.toast('success', onlineCount + ' cuenta(s) activa(s) en los últimos 10 min', { ttl: 2000 });
      } else {
        window.toast('info', 'No se encontraron cuentas con actividad reciente', { ttl: 1500 });
      }
    }
    console.log(LOG, 'Actualización completada: ' + updatedCount + ' cambios, ' + onlineCount + ' activas');
  }

  // ====== LOADALL CON ESTADO ONLINE BASADO EN LAST_MODIFIED ======
  async function loadAll(forceNoCache){
    state.loading = true;
    setStatus('Cargando datos…');
    showSkeleton();

    await initCurrentSeason();

    state.keys = loadKeys();

    if (!state.keys.length){
      state.accounts = [];
      state.pinnedUnion = [];
      state.globalItemsById.clear();
      setStatus('No hay API Keys guardadas. Agregá una desde el menú de keys.', 'error');
      state.loading=false;
      hideSkeletonAndRestoreTable();
      return;
    }

    var out = [];
    var idx = 0, ACTIVE=0, MAX=2;
    var cur = state.currentSeason;

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

            Promise.all([
              root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache }),
              root.GW2Api.getWVWeekly(token, { nocache: !!forceNoCache }).catch(function(e){ return null; })
            ])
            .then(async function(results){
              var pkg = results[0], weekly = results[1];
              var steps = extractSeasonMetaSteps(weekly);
              
              // ====== NUEVO: Estado online basado en last_modified (no bloqueante) ======
              var isOnline = false;
              var lastPlayedChar = null;
              
              try {
                const accountInfo = await root.GW2Api.getAccountInfo(token, { nocache: !!forceNoCache });
                isOnline = root.GW2Api.isRecentlyActive(accountInfo, 10); // 10 minutos de umbral
                
                if (isOnline && accountInfo && accountInfo.last_modified) {
                  const lastModified = new Date(accountInfo.last_modified);
                  const now = new Date();
                  const minutesSince = Math.floor((now - lastModified) / (1000 * 60));
                  lastPlayedChar = `Actividad hace ${minutesSince} min`;
                }
              } catch(e) {
                console.warn(LOG, 'Error getting account info for', label, e);
              }
              // ====== FIN ONLINE ======

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
                seasonMetaSteps: steps,
                isOnline: isOnline,
                lastPlayedChar: lastPlayedChar
              });
            })
            .catch(function(e){
              console.warn(LOG, 'getWVShopMerged/Weekly', e);
              out.push({
                token: token, fp: fp, label: label,
                aa:0, aaIcon:null, itemsById:new Map(), rows:[],
                pinned: pinned||{}, marks: marks||{}, seasonMetaSteps: 0, error: e,
                isOnline: false,
                lastPlayedChar: null
              });
            })
            .finally(function(){ ACTIVE--; next(); });

          })(it);
        }
      }
      next();
    });

    state.accounts = out;
    state.pinnedUnion = computePinnedUnion(out);
    state.globalItemsById.clear();

    state.lastRefreshTime = new Date();
    updateTimestamp();
    setStatus('Listo.');
    state.loading = false;
    
    hideSkeletonAndRestoreTable();
    renderTable();
    updateDashboard();
  }

  function computePinnedUnion(accounts){
    var ids = new Set();
    accounts.forEach(function(acc){
      var p = acc.pinned || {};
      Object.keys(p).forEach(function(id){ if (p[id]) ids.add(Number(id)); });
    });
    return Array.from(ids.values()).sort(function(a,b){ return a-b; });
  }

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
    var kind = (delta >= 0) ? 'ok' : 'bad';
    return { aaAvail: aaAvail, aaNeed: aaNeed, delta: delta, kind: kind };
  }

  function aaNeededForPinned(acc){
    var sum = 0, pins = acc.pinned || {}, rows = acc.rows || [];
    Object.keys(pins).forEach(function(idStr){
      if (!pins[idStr]) return;
      var row = findRowByListingId(rows, Number(idStr)); if (!row) return;
      var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
      var purchased = getTotalPurchased(acc, Number(idStr));
      var cost      = Number(row.cost||0);
      if (limit==null || !isFinite(cost) || cost<=0) return;
      var left = (limit - purchased);
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
      var purchased = getTotalPurchased(acc, Number(idStr));
      if (limit==null) return;
      var left = Math.max(0, limit - purchased);
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
    var purchased = getTotalPurchased(acc, listingId);
    if (limit==null) return 0;
    return Math.max(0, limit - purchased);
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
        var purchased = getTotalPurchased(acc, Number(idStr));
        if (limit!=null){
          var left = Math.max(0, limit - purchased);
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
    
    kpiSet('wvpdKpiAAAvail', k.aaAvail, 'ok');
    kpiSet('wvpdKpiAANeed', k.aaNeed, k.aaNeed <= 0 ? 'ok' : 'warn');
    kpiSet('wvpdKpiAADelta', k.delta, k.kind);

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
        var aaNeeded = 0;
        var totalItems = 0;
        for (var a = 0; a < state.accounts.length; a++) {
          var row = findRowByListingId(state.accounts[a].rows || [], x.listingId);
          if (row) {
            var left = leftForListingInAccount(state.accounts[a], x.listingId);
            aaNeeded += left * (row.cost || 0);
            totalItems += left * (row.item_count || 1);
          }
        }
        var totalItemsText = totalItems > 1 ? (' → <span style="color:#b4bad0;font-weight:700;">' + fmtInt(totalItems) + ' uds</span>') : '';
        return '<li class="wvpd-li" title="'+esc(name)+'">'+
                 '<span class="wvpd-li__left">'+icon+'<span class="wvpd-li__name" style="display:none">'+esc(name)+'</span></span>'+
                 '<span class="wvpd-li__rest">' + fmtInt(aaNeeded) + ' AA' + totalItemsText + '</span>'+
               '</li>';
      }).join('') : '<li class="wvpd-li"><span class="wvpd-li__name">—</span><span class="wvpd-li__rest">—</span></li>';
    }

    updateCountdowns();
    updateUsefulBox();

    try { if (state.dashTimer) clearInterval(state.dashTimer); } catch(_){}
    state.dashTimer = setInterval(updateCountdowns, 1000);
  }

  // ====== Barra de progreso con función dual ======
  function getStatusBadge(limit, purchased, marked, left, cost) {
    if (limit === null) {
      return '<span class="badge badge--infinite" data-tip="Sin límite de compra">∞ Ilimitado</span>';
    }
    
    const totalPurchased = Math.max(purchased, marked);
    const totalRemainingAA = left * cost;
    const progressPercent = limit > 0 ? (totalPurchased / limit) * 100 : 0;
    const isCompleted = left === 0;
    const statusIcon = isCompleted ? '✅' : '⚠️';
    const statusText = isCompleted ? 'Completado' : 'Pendiente';
    const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
    const pendingText = `${fmtInt(left)} (${fmtInt(totalRemainingAA)} AA)`;
    
    return `
      <div class="wvpd-item-progress wvpd-item-progress--compact">
        <div class="wvpd-item-progress__status" style="color: ${statusColor}" title="${isCompleted ? 'Completado' : `Faltan ${fmtInt(left)} unidades (${fmtInt(totalRemainingAA)} AA)`}">
          ${statusIcon} ${statusText}: ${pendingText}
        </div>
        <div class="wvpd-item-progress__bar">
          <div class="wvpd-item-progress__fill" style="width:${Math.min(100, progressPercent)}%"></div>
        </div>
      </div>
    `;
  }

  // ====== Badge de meta semanal ======
  function getWeeklyMetaBadge(steps) {
    if (steps >= 6) {
      return '<span class="badge badge--success" data-tip="Meta semanal completada (6/6)">✅ Semanal</span>';
    }
    if (steps >= 4) {
      return `<span class="badge badge--warning" data-tip="Progreso semanal: ${steps}/6">⚠️ ${steps}/6</span>`;
    }
    return `<span class="badge badge--info" data-tip="Progreso semanal: ${steps}/6">📦 ${steps}/6</span>`;
  }

  // ------------------------------ Render Tabla -----------------------------
  function renderTable(){
    var table = document.getElementById('wvpdTable');
    if (!table) {
      var tableWrap = document.getElementById('wvpdTableWrap');
      if (tableWrap && tableWrap.querySelector('.wvpd-skeleton-table-wrap')) {
        hideSkeletonAndRestoreTable();
        table = document.getElementById('wvpdTable');
      }
      if (!table) return;
    }
    
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
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
          var purchased = getTotalPurchased(acc, listingId);
          if (limit==null) continue;
          var left = Math.max(0, limit - purchased);
          if (left>0) return true;
        }
        return false;
      });
    }

    // ENCABEZADO
    var hcells = ['<th class="wvpd-account-header">Cuenta</th>'];
    
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

    var aaI = aaIconHTML(14);
    hcells.push('<th class="right"><div class="wvpd-header-pill"><span class="wvpd-header-icon">'+aaI+'</span><span class="wvpd-header-label">disp</span></div></th>');
    hcells.push('<th class="right"><div class="wvpd-header-pill"><span class="wvpd-header-icon">'+aaI+'</span><span class="wvpd-header-label">necesario</span></div></th>');
    hcells.push('<th class="right"><div class="wvpd-header-pill"><span class="wvpd-header-icon">'+aaI+'</span><span class="wvpd-header-label">Δ</span></div></th>');

    thead.innerHTML = '                <tr>' + hcells.join('') + ' <\/tr>';

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
      
      // Progreso semanal con barra debajo del nombre
      var stp = Number(acc.seasonMetaSteps || 0);
      var progressPercent = (stp / 6) * 100;
      var accountName = esc(acc.label || ('Key ' + esc(acc.fp || '')));
      
      // Color del nombre según progreso semanal
      var nameColorClass = (stp >= 6) ? 'wvpd-acc--green' : (stp >= 4 ? 'wvpd-acc--yellow' : 'wvpd-acc--red');
      
      // ====== INDICADOR DE ESTADO ONLINE ======
      var isOnline = acc.isOnline || false;
      var statusColor = isOnline ? 'green' : 'red';
      var statusTitle = isOnline ? 'Activo (actividad reciente)' : 'Inactivo';
      var lastPlayedInfo = isOnline && acc.lastPlayedChar ? 
          '<div class="wvpd-online-info"><img src="assets/icons/523381.png" width="14" height="14" alt="" style="vertical-align: middle; margin-right: 4px;">' + esc(acc.lastPlayedChar) + '</div>' : '';
      
      var nameHtml = `
        <div class="wvpd-account-cell">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="wvpd-online-dot wvpd-online-dot--${statusColor}" title="${statusTitle}"></span>
            <div class="wvpd-account-name ${nameColorClass}">${accountName}</div>
          </div>
          ${lastPlayedInfo}
          <div class="wvpd-account-progress">
            <div class="wvpd-account-progress__bar">
              <div class="wvpd-account-progress__fill" style="width:${progressPercent}%"></div>
            </div>
            <div class="wvpd-account-progress__text">${stp}/6</div>
          </div>
        </div>
      `;
      cells.push('<' + 'td>' + nameHtml + '<\/td>');

      pins.forEach(function(listingId){
        var isPinned = !!(acc.pinned && acc.pinned[String(listingId)]);
        if (!isPinned){ cells.push('<td class="center wvpd-muted">—<\/td>'); return; }
        var row = findRowByListingId(acc.rows||[], listingId);
        if (!row){ cells.push('<td class="center wvpd-muted">—<\/td>'); return; }
        var limit     = (row.purchase_limit==null? null : Number(row.purchase_limit));
        var purchased = getTotalPurchased(acc, listingId);
        var marked    = Number((acc.marks||{})[String(listingId)]||0);
        var left = limit != null ? Math.max(0, limit - purchased) : null;
        var cost = Number(row.cost||0);
        
        if (limit==null){
          cells.push('<td class="center wvpd-muted">' + fmtInt(purchased) + ' / ∞<\/td>');
        } else {
          cells.push('<td class="center">' + getStatusBadge(limit, purchased, marked, left, cost) + '<\/td>');
        }
      });

      var aa = Number(acc.aa||0);
      var aaNeed = aaNeededForPinned(acc);
      var delta = aa - aaNeed;
      
      cells.push('<td class="right wvpd-green wvpd-aa-cell">' + fmtInt(aa) + '<\/td>');
      cells.push('<td class="right wvpd-aa-cell">' + (aaNeed > 0 ? '<span class="wvpd-acc--yellow">' + fmtInt(aaNeed) + '</span>' : '—') + '<\/td>');
      
      var deltaCls = (delta >= 0) ? 'wvpd-green' : 'wvpd-red';
      var deltaIcon = (delta > 0) ? '↑' : (delta < 0) ? '↓' : '';
      var deltaNumber = (delta >= 0 ? '+' : '') + fmtInt(delta);
      cells.push('<td class="right"><span class="wvpd-aa-delta"><span class="' + deltaCls + '">' + deltaNumber + '</span>' + (deltaIcon ? '<span class="wvpd-aa-delta-icon ' + deltaCls + '">' + deltaIcon + '</span>' : '') + '</span><\/td>');

      return '                <tr data-token="' + esc(acc.token) + '">' + cells.join('') + '<\/tr>';
    }).join('');

    tbody.innerHTML = body || '                <tr><td colspan="'+(1 + pins.length + 3)+'" class="center wvpd-muted">Sin datos para mostrar.<\/td><\/tr>';

    lazyBuildItemsCatalogForActiveColumns();
  }

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

  // ====== Guardar marca manual en WVSeasonStore ======
  async function updateManualMark(listingId, newValue, fp, token) {
    if (!window.WVSeasonStore || !state.currentSeason) return;
    
    const season = state.currentSeason;
    const currentMarks = WVSeasonStore.getMarks(season.year, season.seq, fp);
    const newMarks = { ...currentMarks, [listingId]: newValue };
    
    await WVSeasonStore.setMarks(season.year, season.seq, fp, newMarks);
    
    for (let i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].fp === fp) {
        state.accounts[i].marks = newMarks;
        break;
      }
    }
    
    updateSingleShopCard(listingId, newValue);
    
    const panel = document.getElementById('wvPDPanel');
    if (panel && !panel.hidden) {
      renderTable();
      updateDashboard();
    }
  }

  function updateSingleShopCard(listingId, newValue) {
    const shopContainer = document.getElementById('wvTabShop');
    if (!shopContainer) return;
    
    const card = shopContainer.querySelector(`.wv-card[data-id="${listingId}"]`);
    if (!card) return;
    
    let accData = null;
    let rowData = null;
    for (let i = 0; i < state.accounts.length && !accData; i++) {
      const acc = state.accounts[i];
      const row = findRowByListingId(acc.rows, Number(listingId));
      if (row && acc.pinned && acc.pinned[listingId]) {
        accData = acc;
        rowData = row;
      }
    }
    
    if (!accData || !rowData) return;
    
    const limit = rowData.purchase_limit;
    const purchased = getTotalPurchased(accData, Number(listingId));
    const left = limit ? Math.max(0, limit - purchased) : null;
    const cost = rowData.cost || 0;
    const totalRemainingAA = left * cost;
    const progressPercent = limit ? (purchased / limit) * 100 : 0;
    const isCompleted = left === 0;
    const statusIcon = isCompleted ? '✅' : '⚠️';
    const statusText = isCompleted ? 'Completado' : 'Pendiente';
    const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
    
    const existingProgress = card.querySelector('.wvpd-item-progress');
    if (existingProgress) {
      const statusDiv = existingProgress.querySelector('.wvpd-item-progress__status');
      if (statusDiv) {
        statusDiv.style.color = statusColor;
        statusDiv.setAttribute('title', isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`);
        statusDiv.innerHTML = `${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}`;
      }
      const fillDiv = existingProgress.querySelector('.wvpd-item-progress__fill');
      if (fillDiv) {
        fillDiv.style.width = `${Math.min(100, progressPercent)}%`;
      }
    }
    
    const inputField = card.querySelector(`#manual-input-${listingId}`);
    if (inputField && inputField.value != purchased) {
      inputField.value = purchased;
    }
    
    const badgeSpan = card.querySelector('.wv-card__body .pill');
    if (badgeSpan && left !== null) {
      badgeSpan.textContent = `${purchased} / ${limit}`;
    }
  }
  
  function refreshCardDisplay(cardElement, listingId, accData, newValue) {
    const limit = accData.rows.find(r => r.id == listingId)?.purchase_limit;
    const cost = accData.rows.find(r => r.id == listingId)?.cost || 0;
    const left = limit ? Math.max(0, limit - newValue) : null;
    const totalRemainingAA = left * cost;
    const progressPercent = limit ? (newValue / limit) * 100 : 0;
    const isCompleted = left === 0;
    const statusIcon = isCompleted ? '✅' : '⚠️';
    const statusText = isCompleted ? 'Completado' : 'Pendiente';
    const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
    
    const statusDiv = cardElement.querySelector('.wvpd-item-progress__status');
    if (statusDiv) {
      statusDiv.style.color = statusColor;
      statusDiv.setAttribute('title', isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`);
      statusDiv.innerHTML = `${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}`;
    }
    
    const fillDiv = cardElement.querySelector('.wvpd-item-progress__fill');
    if (fillDiv) {
      fillDiv.style.width = `${Math.min(100, progressPercent)}%`;
    }
    
    const percentDiv = cardElement.querySelector('.wvpd-item-progress__percent');
    if (percentDiv) {
      percentDiv.textContent = `${Math.round(progressPercent)}%`;
    }
  }
  
  function setupAutoSaveForCard(cardElement, listingId, accData) {
    const inputField = cardElement.querySelector(`#manual-input-${listingId}`);
    if (!inputField) return;
    
    if (inputField.hasAttribute('data-auto-save-setup')) return;
    inputField.setAttribute('data-auto-save-setup', 'true');
    
    let debounceTimer;
    inputField.addEventListener('input', function(e) {
      clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(async () => {
        let newValue = parseInt(e.target.value, 10);
        if (isNaN(newValue)) newValue = 0;
        
        const limit = accData.rows.find(r => r.id == listingId)?.purchase_limit;
        if (limit && newValue > limit) newValue = limit;
        if (newValue < 0) newValue = 0;
        
        if (inputField.value != newValue) {
          inputField.value = newValue;
        }
        
        await updateManualMark(listingId, newValue, accData.fp, accData.token);
        refreshCardDisplay(cardElement, listingId, accData, newValue);
      }, 500);
    });
  }

  function getSelectedToken() {
    try {
      var sel = document.getElementById('keySelectGlobal');
      if (sel && sel.value) return sel.value.trim();
      var stored = localStorage.getItem('gw2_selected_key_v1');
      if (stored) return stored;
    } catch(e) {}
    return null;
  }

  function enhanceShopCards() {
    const shopContainer = document.getElementById('wvTabShop');
    if (!shopContainer) return;
    
    const placeholders = shopContainer.querySelectorAll('.wv-counter-placeholder');
    placeholders.forEach(placeholder => {
      if (placeholder.__wvpdProcessed) return;
      placeholder.__wvpdProcessed = true;
      
      const card = placeholder.closest('.wv-card');
      if (!card) return;
      
      const existingManualInput = card.querySelector('.wvpd-manual-input');
      if (existingManualInput) existingManualInput.remove();
      
      const listingId = placeholder.dataset.id;
      if (!listingId) return;
      
      let accData = null;
      let rowData = null;
      for (let i = 0; i < state.accounts.length && !accData; i++) {
        const acc = state.accounts[i];
        const row = findRowByListingId(acc.rows, Number(listingId));
        if (row && acc.pinned && acc.pinned[listingId]) {
          accData = acc;
          rowData = row;
        }
      }
      
      if (!accData || !rowData) {
        placeholder.remove();
        return;
      }
      
      const purchased = getTotalPurchased(accData, Number(listingId));
      const limit = rowData.purchase_limit;
      const cost = rowData.cost || 0;
      const manualValue = (accData.marks && accData.marks[listingId]) || purchased;
      const fp = accData.fp;
      const token = accData.token;
      
      const container = document.createElement('div');
      container.className = 'wvpd-manual-input';
      container.innerHTML = `
        <label>Compras manuales:</label>
        <input type="number" id="manual-input-${listingId}" value="${manualValue}" min="0" max="${limit || 999}" step="1">
        <button class="btn-max" data-listing-id="${listingId}" data-limit="${limit || 0}">MAX</button>
      `;
      
      placeholder.replaceWith(container);
      
      const inputField = container.querySelector(`#manual-input-${listingId}`);
      const maxBtn = container.querySelector('.btn-max');
      
      let debounceTimer;
      if (inputField) {
        inputField.addEventListener('input', function(e) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            let newValue = parseInt(e.target.value, 10);
            if (isNaN(newValue)) newValue = 0;
            if (limit && newValue > limit) newValue = limit;
            if (newValue < 0) newValue = 0;
            if (inputField.value != newValue) inputField.value = newValue;
            await updateManualMark(listingId, newValue, fp, token);
            
            const left = limit ? Math.max(0, limit - newValue) : null;
            const totalRemainingAA = left * cost;
            const progressPercent = limit ? (newValue / limit) * 100 : 0;
            const isCompleted = left === 0;
            const statusIcon = isCompleted ? '✅' : '⚠️';
            const statusText = isCompleted ? 'Completado' : 'Pendiente';
            const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
            
            const existingProgress = card.querySelector('.wvpd-item-progress');
            if (existingProgress) {
              const statusDiv = existingProgress.querySelector('.wvpd-item-progress__status');
              if (statusDiv) {
                statusDiv.style.color = statusColor;
                statusDiv.setAttribute('title', isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`);
                statusDiv.innerHTML = `${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}`;
              }
              const fillDiv = existingProgress.querySelector('.wvpd-item-progress__fill');
              if (fillDiv) {
                fillDiv.style.width = `${Math.min(100, progressPercent)}%`;
              }
            }
            
            const badgeSpan = card.querySelector('.wv-card__body .pill');
            if (badgeSpan && left !== null) {
              badgeSpan.textContent = `${newValue} / ${limit}`;
            }
          }, 500);
        });
      }
      
      if (maxBtn) {
        maxBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const maxLimit = parseInt(maxBtn.dataset.limit, 10);
          if (maxLimit > 0 && inputField) {
            inputField.value = maxLimit;
            await updateManualMark(listingId, maxLimit, fp, token);
            
            const left = limit ? Math.max(0, limit - maxLimit) : null;
            const totalRemainingAA = left * cost;
            const progressPercent = limit ? (maxLimit / limit) * 100 : 0;
            const isCompleted = left === 0;
            const statusIcon = isCompleted ? '✅' : '⚠️';
            const statusText = isCompleted ? 'Completado' : 'Pendiente';
            const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
            
            const existingProgress = card.querySelector('.wvpd-item-progress');
            if (existingProgress) {
              const statusDiv = existingProgress.querySelector('.wvpd-item-progress__status');
              if (statusDiv) {
                statusDiv.style.color = statusColor;
                statusDiv.setAttribute('title', isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`);
                statusDiv.innerHTML = `${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}`;
              }
              const fillDiv = existingProgress.querySelector('.wvpd-item-progress__fill');
              if (fillDiv) {
                fillDiv.style.width = `${Math.min(100, progressPercent)}%`;
              }
            }
            
            const badgeSpan = card.querySelector('.wv-card__body .pill');
            if (badgeSpan && left !== null) {
              badgeSpan.textContent = `${maxLimit} / ${limit}`;
            }
          }
        });
      }
    });
    
    const cards = shopContainer.querySelectorAll('.wv-card');
    cards.forEach(card => {
      const listingId = card.dataset.id;
      if (!listingId) return;
      
      let isPinned = false;
      let rowData = null;
      let accData = null;
      
      for (let i = 0; i < state.accounts.length && !isPinned; i++) {
        const acc = state.accounts[i];
        if (acc.pinned && acc.pinned[listingId]) {
          isPinned = true;
          rowData = findRowByListingId(acc.rows, Number(listingId));
          accData = acc;
        }
      }
      
      if (!isPinned || !rowData) return;
      if (card.querySelector('.wvpd-manual-input')) return;
      
      const limit = rowData.purchase_limit;
      const purchased = getTotalPurchased(accData, Number(listingId));
      const left = limit ? Math.max(0, limit - purchased) : null;
      const cost = rowData.cost || 0;
      const totalRemainingAA = left * cost;
      const progressPercent = limit ? (purchased / limit) * 100 : 0;
      const manualValue = (accData.marks && accData.marks[listingId]) || 0;
      const isCompleted = left === 0;
      const statusIcon = isCompleted ? '✅' : '⚠️';
      const statusText = isCompleted ? 'Completado' : 'Pendiente';
      const statusColor = isCompleted ? '#a0ffc8' : '#ffd36b';
      
      let bodyDiv = card.querySelector('.wv-card__body');
      if (!bodyDiv) {
        bodyDiv = document.createElement('div');
        bodyDiv.className = 'wv-card__body';
        card.appendChild(bodyDiv);
      }
      
      const existingProgress = bodyDiv.querySelector('.wvpd-item-progress');
      const existingInput = bodyDiv.querySelector(`#manual-input-${listingId}`);
      
      if (existingProgress && existingInput) {
        const statusDiv = existingProgress.querySelector('.wvpd-item-progress__status');
        if (statusDiv) {
          statusDiv.style.color = statusColor;
          statusDiv.setAttribute('title', isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`);
          statusDiv.innerHTML = `${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}`;
        }
        const fillDiv = existingProgress.querySelector('.wvpd-item-progress__fill');
        if (fillDiv) {
          fillDiv.style.width = `${Math.min(100, progressPercent)}%`;
        }
        
        if (existingInput.value != manualValue) {
          existingInput.value = manualValue;
        }
        return;
      }
      
      const oldManualInput = bodyDiv.querySelector('.wvpd-manual-input');
      if (oldManualInput) oldManualInput.remove();
      
      bodyDiv.classList.add('wv-enhanced');
      bodyDiv.innerHTML = `
        <div class="sep"></div>
        <div class="wvpd-item-progress wvpd-item-progress--compact">
          <div class="wvpd-item-progress__status" style="color: ${statusColor}" title="${isCompleted ? 'Completado' : `Faltan ${left} unidades (${totalRemainingAA} AA)`}">
            ${statusIcon} ${statusText}: ${left ? `${left} (${totalRemainingAA} AA)` : `${limit} (${limit * cost} AA)`}
          </div>
          <div class="wvpd-item-progress__bar">
            <div class="wvpd-item-progress__fill" style="width:${Math.min(100, progressPercent)}%"></div>
          </div>
        </div>
        <div class="wvpd-manual-input">
          <label>Compras manuales:</label>
          <input type="number" id="manual-input-${listingId}" value="${manualValue}" min="0" max="${limit || 999}" step="1">
          <button class="btn-max" data-listing-id="${listingId}" data-limit="${limit || 0}">MAX</button>
        </div>
      `;
      
      setupAutoSaveForCard(card, listingId, accData);
      
      const maxBtn = bodyDiv.querySelector('.btn-max');
      if (maxBtn) {
        maxBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const inputField = bodyDiv.querySelector(`#manual-input-${listingId}`);
          const maxLimit = parseInt(maxBtn.dataset.limit, 10);
          if (maxLimit > 0) {
            inputField.value = maxLimit;
            await updateManualMark(listingId, maxLimit, accData.fp, accData.token);
            refreshCardDisplay(card, listingId, accData, maxLimit);
          }
        });
      }
    });
  }
  
  window.enhanceShopCards = enhanceShopCards;
  console.log(LOG, 'enhanceShopCards expuesta globalmente');

    function observeShop() {
      const shopContainer = document.getElementById('wvTabShop');
      if (!shopContainer || shopContainer.__wvEnhancedObs) return;
      
      shopContainer.__wvEnhancedObs = true;
      
      var _ensuring = false;
      function ensureDataAndEnhance() {
        if (_ensuring) return;
        if (state.accounts && state.accounts.length > 0) {
          setTimeout(enhanceShopCards, 50);
        } else {
          _ensuring = true;
          console.log(LOG, 'Cargando datos antes de mejorar tarjetas...');
          safeRefresh(false).then(() => {
            console.log(LOG, 'Datos cargados, mejorando tarjetas...');
            setTimeout(enhanceShopCards, 100);
            _ensuring = false;
          }).catch(e => {
            console.warn(LOG, 'Error cargando datos:', e);
            _ensuring = false;
          });
        }
      }
      
      var _observerTimer = null;
      const observer = new MutationObserver(() => {
        if (!shopContainer.hidden) {
          clearTimeout(_observerTimer);
          _observerTimer = setTimeout(ensureDataAndEnhance, 500);
        }
      });
      observer.observe(shopContainer, { childList: true, subtree: true });
      
      const shopTab = document.getElementById('wvTabBtnShop');
      if (shopTab && !shopTab.__wvpdObsWired) {
        shopTab.__wvpdObsWired = true;
        shopTab.addEventListener('click', () => {
          setTimeout(ensureDataAndEnhance, 100);
        });
      }
      
      window.addEventListener('wv:shop:rendered', () => {
        ensureDataAndEnhance();
      });
      
      window.addEventListener('wv:season-store:mutate', () => {
        if (!shopContainer.hidden) {
          safeRefresh(false).then(() => setTimeout(enhanceShopCards, 100));
        }
      });
      
      ensureDataAndEnhance();
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
      
      try {
        window.addEventListener('wv:season-store:mutate', function(){
          var p = document.getElementById('wvPDPanel');
          if (!p || p.hasAttribute('hidden')) return;
          safeRefresh(false);
        });
      } catch(_){}
      
      ['wvTabBtnDaily','wvTabBtnWeekly','wvTabBtnSpecial','wvTabBtnShop'].forEach(function(id){
        var b = document.getElementById(id);
        if (b && !b.__wvpdWired2){
          b.__wvpdWired2 = true;
          b.addEventListener('click', function(){ try { WVPurchaseDetail.hide(); } catch(_){ } });
        }
      });
      
      await initCurrentSeason();
      
      setTimeout(observeShop, 1000);
    },

    async show(){
      await this.initOnce();
      try { localStorage.setItem('wvpd_open', '1'); } catch(_){}
      setTabsVisible(false);
      showPanel();
      try { document.getElementById('wvPanel')?.scrollIntoView({ behavior:'smooth', block:'start' }); }
      catch(_){ window.scrollTo({ top: 0, behavior: 'smooth' }); }
      await safeRefresh(false);
      setTimeout(enhanceShopCards, 300);
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
    },
    
    // Exponer función pública para actualizar estado online
    refreshOnlineStatus: refreshAllOnlineStatus
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
      setTimeout(enhanceShopCards, 300);
    })();

    try { await _refreshInFlight; }
    finally { if (mySeq === _refreshSeq) _refreshInFlight = null; }
  }

  root.WVPurchaseDetail = WVPurchaseDetail;

  if (document.readyState==='loading')
    document.addEventListener('DOMContentLoaded', function(){ WVPurchaseDetail.initOnce(); });
  else
    WVPurchaseDetail.initOnce();

  // Exponer funciones globalmente
  window.enhanceShopCards = enhanceShopCards;
  window.updateManualMark = updateManualMark;
  window.refreshCardDisplay = refreshCardDisplay;
  window.getTotalPurchased = getTotalPurchased;
  window.findRowByListingId = findRowByListingId;
  window.__wvpdState = state;

  console.info(LOG, 'ready 1.13.0 — Estado online basado en last_modified (actividad general)');
})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));