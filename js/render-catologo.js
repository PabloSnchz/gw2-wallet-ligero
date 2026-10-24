/*!
 * js/render-catologo.js — Render del catálogo y filtros
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * v1.6.1 (2026-10-23) — BL-064: «Modo: Catálogo / Mi progreso» del tracker oculto de verdad
 *   (su display:flex en línea le ganaba a la regla; ahora va con !important). Las pestañas lo reemplazan.
 * v1.6.0 (2026-10-23) — BL-064, ARM-5: guarda de contraste de la Bienvenida sobre el panel (19 themes)
 *   y el foco vuelve al mismo control cuando el tracker repinta (filtros, listas, cola, pestañas).
 * v1.2.0–1.5.0 (2026-10-23) — BL-064, ARM-1 a ARM-4 (FEAT-010): cabecera con resumen, pestañas
 *   «Catálogo / Mi cola» y buscador; filtros en una fila, tarjetas nuevas y grilla adaptable por
 *   expansión; «Mi cola» renovada y mi línea; armaduras por set. legendary-tracker.js no cambia.
 * v1.1.0 (2026-10-21) — BL-046: chips con la jerga de la comunidad (Abalorio,
 *   Espaldar) y la expansión real de cada legendaria (Secrets of the Obscure,
 *   Janthir Wilds y Visions of Eternity incluidas), con filtros en orden de salida.
 * v1.0.0 (Phase 3 Commit 1)
 *
 * Funciones de render para el grid del catálogo de legendarias y la barra
 * de filtros. Registra funciones en window.LegendaryTracker.registerRender().
 *
 * Consume:
 *  - window.LegendaryCatalog.items (js/legendary-data.js)
 *  - window.LegendaryTracker.getState() — filtros, owned
 */

(function (root) {
  'use strict';

  var LOG = '[LegendaryCatalogUI]';

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  function fmtInt(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }

  // =======================================================================
  // MAPAS DE TRADUCCIÓN + COLORES
  // =======================================================================
  var TYPE_LABELS = {
    'weapon':           'Arma',
    'armor':            'Armadura',
    // Jerga de la comunidad hispana (pedido de Pablo, BL-046).
    'trinket':          'Abalorio',
    'back':             'Espaldar',
    'upgradecomponent': 'Componente',
    'relic':            'Reliquia'
  };

  var TYPE_COLORS = {
    'weapon':           '#974EFF',
    'armor':            '#4DA6FF',
    'trinket':          '#FFD700',
    'back':             '#9370DB',
    'upgradecomponent': '#FB3E8D',
    'relic':            '#63B37A'
  };

  var EXPANSION_LABELS = {
    'Core': 'Clásico',
    'HoT':  'Heart of Thorns',
    'PoF':  'Path of Fire',
    'EoD':  'End of Dragons',
    'SotO': 'Secrets of the Obscure',
    'JW':   'Janthir Wilds',
    'VoE':  'Visions of Eternity'
  };

  var EXPANSION_COLORS = {
    'Core': '#974EFF',
    'HoT':  '#63B37A',
    'PoF':  '#D5A021',
    'EoD':  '#4DA6FF',
    'SotO': '#E0663F',
    'JW':   '#3FB8AF',
    'VoE':  '#E46FB5'
  };

  // Orden de salida del juego. Lo usan los filtros y la grilla.
  var EXPANSION_ORDER = ['Core', 'HoT', 'PoF', 'EoD', 'SotO', 'JW', 'VoE'];

  // =======================================================================
  // EXPANSION REAL DE CADA LEGENDARIA (BL-046)
  // =======================================================================
  // legendary-data.js adivinó la expansión por generación; la real vive acá (83 KB, LES-028).
  // Regla: la expansión que hace falta para conseguir la pieza; si ninguna, Clásico. Fuentes: wiki
  // oficial, GuildJen y Snow Crows (2026-10-21).
  var EXPANSION_FIX = {
    // Heart of Thorns: Chuka y Champawat (una de las 4 de segunda generacion con
    // coleccion) y Aurora (Mundo Viviente 3). Ad Infinitum ya venia bien.
    78556: 'HoT',   // Chuka y Champawat
    81908: 'HoT',   // Aurora
    // Path of Fire
    87109: 'PoF',   // Garra del Khan-Ur (segunda generacion, no tercera)
    95380: 'PoF',   // Insignia de Campeon Prismatico (Mundo Viviente 2 a 5)
    // Clasico: competitivo y mejoras que no piden expansion
    92991: 'Core',  // Trascendencia (PvP)
    93105: 'Core',  // Confluencia (WvW)
    95093: 'Core',  // marcador de cuenta
    77474: 'Core',  // La Ascension (PvP)
    91505: 'Core',  // Sello legendario
    91536: 'Core',  // Runa legendaria
    // Secrets of the Obscure
    101582: 'SotO', // Reliquia legendaria
    // Janthir Wilds
    103815: 'JW',   // Klobjarne Geirr
    104857: 'JW',   // Orrax Manifestado
    // Visions of Eternity
    105653: 'VoE',  // Ancora Pax
    106273: 'VoE',  // Ancora Bellum
    110020: 'VoE',  // Jornal Estelar
    107022: 'VoE',  // Verano Infinito
    109012: 'VoE',  // Conflicto Interminable (WvW, pide VoE)
    109070: 'VoE'   // Estela radiante
  };

  // Armaduras: por set, con el nombre en ingles del catalogo.
  var EXPANSION_FIX_ARMOR = [
    [/^Perfected Envoy/, 'HoT'],                    // incursiones
    [/^Obsidian /, 'SotO'],                         // mundo abierto de SotO
    [/^Selachimorpha/, 'VoE'],                      // respirador acuatico
    [/^Eikasia/, 'Core'],                           // fractales, actualizacion gratuita
    [/Hero's|^Ardent Glorious|^Mistforged|^Sublime Mistforged/, 'Core'] // PvP y WvW
  ];

  function expansionReal(item) {
    if (!item) return null;
    if (Object.prototype.hasOwnProperty.call(EXPANSION_FIX, item.id)) return EXPANSION_FIX[item.id];
    if (item.type === 'armor') {
      for (var i = 0; i < EXPANSION_FIX_ARMOR.length; i++) {
        if (EXPANSION_FIX_ARMOR[i][0].test(item.name || '')) return EXPANSION_FIX_ARMOR[i][1];
      }
    }
    return item.expansion;
  }

  // Corrige el catalogo en el lugar. Idempotente: se puede llamar en cada render.
  function corregirExpansiones(items) {
    (items || []).forEach(function (it) {
      var e = expansionReal(it);
      if (e && it.expansion !== e) it.expansion = e;
    });
    return items;
  }

  function ordenExpansion(e) {
    var i = EXPANSION_ORDER.indexOf(e);
    return i === -1 ? EXPANSION_ORDER.length : i;
  }

  if (root.LegendaryCatalog && root.LegendaryCatalog.items) corregirExpansiones(root.LegendaryCatalog.items);

  var GEN_LABELS = { 1: 'Gen 1', 2: 'Gen 2', 3: 'Gen 3' };

  function typeLabel(item) {
    return TYPE_LABELS[item.type] || item.type;
  }
  function typeColor(item) {
    return TYPE_COLORS[item.type] || 'var(--tx-3)';
  }
  function expansionLabel(item) {
    return EXPANSION_LABELS[item.expansion] || item.expansion || '—';
  }
  function expansionColor(item) {
    return EXPANSION_COLORS[item.expansion] || 'var(--tx-3)';
  }
  function genLabel(item) {
    if (!item.generation) return '—';
    return GEN_LABELS[item.generation] || ('Gen ' + item.generation);
  }
  // Precio TP con el componente de oro de la Cartera (.coin de main.css): una
  // pastilla por unidad, sin las que valen cero (hb119-1-1). Historia: git.
  function tpCoinHTML(copper) {
    var g = Math.floor((copper || 0) / 10000);
    var s = Math.floor(((copper || 0) % 10000) / 100);
    var c = (copper || 0) % 100;
    var parts = [];
    if (g > 0) parts.push('<span class="coin coin--g">' + g.toLocaleString('es-AR') + '</span>');
    if (s > 0) parts.push('<span class="coin coin--s">' + s + '</span>');
    if (c > 0) parts.push('<span class="coin coin--c">' + c + '</span>');
    return parts.length ? parts.join('') : '<span class="coin coin--c">0</span>';
  }

  // =======================================================================
  // COLLECTION DE OPCIÓN DE FILTROS (derivado del catálogo)
  // =======================================================================
  function getFilterOptions(catalog) {
    var types = {};
    var gens = {};
    var exps = {};
    catalog.forEach(function (item) {
      if (!item) return;
      if (item.type) types[item.type] = (types[item.type] || 0) + 1;
      if (item.generation) gens[item.generation] = (gens[item.generation] || 0) + 1;
      if (item.expansion) exps[item.expansion] = (exps[item.expansion] || 0) + 1;
    });
    return { types: types, gens: gens, exps: exps };
  }

  // =======================================================================
  // ARM-1 (BL-064): CABECERA, PESTAÑAS Y BUSCADOR
  // =======================================================================
  // El marco se pinta junto con la barra de filtros (renderFilterBar), así que
  // la firma del contrato de renderers no cambia. Solo colores del theme para el
  // texto; el color del módulo (el mismo de la Sidebar) va en bordes y barras.
  var ARM_COLOR = '#E545CA';
  var ARM_CSS = [
    '#legendaryArmoryPanel>.panel__title,#legendaryArmoryBody>.legendary-view-toggle{display:none!important}',
    '.arm-hero{border:1px solid var(--bd-1);border-radius:16px;padding:16px 18px;margin:0 0 14px;' +
      'background:linear-gradient(180deg,rgba(229,69,202,.10),var(--bg-1) 70%)}',
    '.arm-hrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.arm-hrow>img{width:56px;height:56px;border-radius:12px;background:var(--bg-2,var(--bg-0));padding:6px;flex-shrink:0}',
    '.arm-hrow h2{margin:0;font-size:1.3rem;line-height:1.2;color:var(--tx-1)}',
    '.arm-sub{margin:2px 0 0;font-size:.85rem;color:var(--tx-2)}',
    '.arm-hbtns{margin-left:auto;display:flex;gap:6px}',
    '.arm-btn{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 12px;border:1px solid var(--bd-1);' +
      'border-radius:999px;background:transparent;color:var(--tx-2);font:inherit;font-size:.8rem;cursor:pointer}',
    '.arm-btn:hover{border-color:' + ARM_COLOR + ';color:var(--tx-1)}',
    '.arm-stats{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.arm-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.arm-st small{display:block;font-size:.75rem;color:var(--tx-3);text-transform:uppercase;letter-spacing:.05em}',
    '.arm-st b{font-size:1.25rem;color:var(--tx-1)}',
    '.arm-st b span{font-size:.8rem;color:var(--tx-3);font-weight:500}',
    '.arm-bar{height:6px;border-radius:6px;background:var(--bg-2,var(--bg-1));overflow:hidden;margin-top:7px}',
    '.arm-bar i{display:block;height:100%;border-radius:6px;background:' + ARM_COLOR + '}',
    '.arm-tabs{display:flex;gap:4px;margin:0 0 12px;border-bottom:1px solid var(--bd-1)}',
    '.arm-tab{padding:8px 14px;margin-bottom:-1px;border:0;border-bottom:2px solid transparent;background:transparent;' +
      'color:var(--tx-3);font:inherit;font-size:.92rem;cursor:pointer}',
    '.arm-tab span{margin-left:4px;font-size:.78rem;color:var(--tx-3);font-weight:500}',
    '.arm-tab[aria-current="page"]{color:var(--tx-1);font-weight:700;border-bottom-color:' + ARM_COLOR + '}',
    '.arm-tool{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}',
    '.arm-search{flex:1 1 280px;min-height:40px;padding:8px 12px;border:1px solid var(--bd-2,var(--bd-1));border-radius:10px;' +
      'background:var(--bg-1);color:var(--tx-1);font:inherit;font-size:.9rem}',
    '.arm-search::placeholder{color:var(--tx-3)}',
    '.arm-count{margin:0 0 10px;font-size:.8rem;color:var(--tx-3)}',
    '.arm-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.arm-btn:focus-visible,.arm-tab:focus-visible,.arm-search:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '.arm-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}',
    '.arm-seg,.arm-fgroup{display:flex;gap:4px;align-items:center;flex-wrap:wrap}',
    '.arm-seg{padding:3px;border:1px solid var(--bd-1);border-radius:999px;background:var(--bg-1)}',
    '.arm-flabel,.arm-fsel label{font-size:.75rem;color:var(--tx-3);margin:0 2px 0 6px}',
    '.arm-chip{min-height:32px;padding:4px 12px;border:1px solid var(--bd-1);border-radius:999px;background:var(--bg-1);' +
      'color:var(--tx-2);font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap}',
    '.arm-seg .arm-chip{border-color:transparent;background:transparent}',
    '.arm-chip:hover{color:var(--tx-1);border-color:' + ARM_COLOR + '}',
    '.arm-chip[aria-pressed="true"]{color:var(--tx-1);border-color:' + ARM_COLOR + ';background:rgba(229,69,202,.14)}',
    '.arm-fsel{display:inline-flex;align-items:center;gap:4px}',
    '.arm-select{min-height:32px;padding:4px 8px;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-1);' +
      'color:var(--tx-1);font:inherit;font-size:.8rem}',
    '.arm-clear{margin-left:auto}',
    '.arm-note{margin:0 0 10px;font-size:.75rem;color:var(--tx-3)}',
    '.arm-section{margin:0 0 18px}',
    '.arm-sec{margin:0 0 8px;font-size:.95rem;font-weight:700;color:var(--tx-1)}',
    '.arm-sec span{font-size:.8rem;font-weight:500;color:var(--tx-3)}',
    '.arm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}',
    '#legendaryModeContent .lt-item-card{display:flex;gap:10px;align-items:flex-start;margin:0;padding:10px 12px;' +
      'border:1px solid var(--bd-1);border-left:3px solid var(--bd-1);border-radius:12px;background:var(--bg-1);' +
      'cursor:pointer;min-width:0;animation:none;transform:none}',
    '#legendaryModeContent .lt-item-card:hover{border-color:' + ARM_COLOR + '}',
    '#legendaryModeContent .lt-item-card[data-own]{border-left-color:var(--color-green,#3fb950)}',
    '#legendaryModeContent .lt-item-card[data-q]{border-left-color:' + ARM_COLOR + '}',
    '.arm-cicon{width:44px;height:44px;border-radius:8px;background:var(--bg-0);object-fit:contain;flex-shrink:0}',
    '.arm-cbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.arm-cname{all:unset;display:block;cursor:pointer;font-size:.9rem;font-weight:700;color:var(--tx-1);' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:4px}',
    '.arm-cname:hover{text-decoration:underline}',
    '.arm-cmeta{margin:0;display:flex;align-items:center;gap:6px;min-width:0;font-size:.75rem;color:var(--tx-3)}',
    '.arm-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    '.arm-cfoot{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}',
    '.arm-price{display:inline-flex;align-items:center;gap:4px;font-size:.75rem;color:var(--tx-2)}',
    '.arm-nosell{font-size:.75rem;color:var(--tx-3)}',
    '.arm-own{padding:2px 8px;border:1px solid var(--color-green,#3fb950);border-radius:999px;' +
      'background:rgba(63,185,80,.10);font-size:.75rem;font-weight:700;color:var(--tx-1)}',
    '.arm-qbtn{margin-left:auto;min-height:30px;padding:3px 10px;border:1px solid var(--bd-1);border-radius:999px;' +
      'background:transparent;color:var(--tx-2);font:inherit;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap}',
    '.arm-qbtn:hover{color:var(--tx-1);border-color:' + ARM_COLOR + '}',
    '[data-q] .arm-qbtn{color:var(--tx-1);border-color:' + ARM_COLOR + ';background:rgba(229,69,202,.14)}',
    '.arm-empty{text-align:center;padding:32px 12px;font-size:.85rem;color:var(--tx-3)}',
    '.arm-empty p{margin:4px 0}',
    '.arm-chip:focus-visible,.arm-select:focus-visible,.arm-cname:focus-visible,.arm-qbtn:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '.arm-voice{display:flex;align-items:center;gap:10px;margin-top:12px;padding:8px 12px;border:1px solid var(--bd-1);' +
      'border-radius:12px;background:var(--bg-0)}',
    '.arm-voice img{width:32px;height:32px;border-radius:50%;flex-shrink:0}',
    '.arm-voice p{margin:0;font-size:.85rem;line-height:1.4;color:var(--tx-2)}',
    '.arm-voice b{color:var(--tx-1)}',
    '.arm-btn--pri{border-color:' + ARM_COLOR + ';color:var(--tx-1);font-weight:600}',
    '.arm-qview~*{display:none!important}',
    '.arm-qlist{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.arm-qrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--bd-1);' +
      'border-left:3px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    '.arm-qrow[data-top]{border-left-color:' + ARM_COLOR + '}',
    '.arm-qpos{width:22px;text-align:center;font-size:.9rem;font-weight:700;color:var(--tx-3);flex-shrink:0}',
    '.arm-qbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;align-items:flex-start}',
    '.arm-qname{font-size:.95rem;color:var(--tx-1)}',
    '.arm-qacts{display:flex;gap:6px;flex-shrink:0}',
    '.arm-set{min-width:0;border:1px solid var(--bd-1);border-left:3px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    '.arm-set[data-full]{border-left-color:var(--color-green,#3fb950)}',
    '.arm-set[data-q]{border-left-color:' + ARM_COLOR + '}',
    '.arm-set[open]{grid-column:1 / -1}',
    '.arm-set>summary{display:flex;gap:10px;align-items:center;padding:10px 12px;cursor:pointer;list-style:none;border-radius:12px}',
    '.arm-set>summary::-webkit-details-marker{display:none}',
    '.arm-set>summary:hover .arm-sname{text-decoration:underline}',
    '.arm-set>summary:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '.arm-sname{font-size:.9rem;color:var(--tx-1)}',
    '.arm-chev{font-size:1.2rem;color:var(--tx-3);transition:transform .15s}',
    '.arm-set[open] .arm-chev{transform:rotate(90deg)}',
    '.arm-set>.arm-grid{padding:0 12px 12px}',
    '@media (prefers-reduced-motion:reduce){.lt-skeleton-card,.lt-skeleton-card *{animation:none!important}}',
    '@media (prefers-reduced-motion:reduce){.arm-chev{transition:none}}',
    '@media (max-width:1199px){.arm-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.arm-stats .arm-st:first-child{grid-column:1 / -1}}',
    '@media (max-width:900px){.arm-hero{padding:12px}.arm-hrow>img{width:40px;height:40px;padding:4px}.arm-hrow h2{font-size:1.05rem}' +
      '.arm-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.arm-tab,.arm-btn,.arm-search{min-height:44px}}',
    '@media (max-width:900px){.arm-filters{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.arm-seg,.arm-fgroup{flex-wrap:nowrap}' +
      '.arm-chip,.arm-select,.arm-qbtn{min-height:44px}.arm-cname{line-height:44px}.arm-voice{display:none}}',
    '@media (max-width:900px){.arm-set>summary{min-height:44px}}',
    '@media (max-width:560px){.arm-grid{grid-template-columns:1fr}}',
    '@media (max-width:560px){.arm-qrow{flex-wrap:wrap}.arm-qacts{width:100%}.arm-qacts .arm-btn{flex:1;justify-content:center}}'
  ].join('\n');

  var ui = { q: '', raw: '', lastItems: null, lastOwned: null };

  function ensureArmCss() {
    var d = root.document;
    if (!d || typeof d.getElementById !== 'function' || typeof d.createElement !== 'function' || !d.head) return;
    if (d.getElementById('arm-css')) return;
    var st = d.createElement('style');
    st.id = 'arm-css';
    st.textContent = ARM_CSS;
    d.head.appendChild(st);
  }

  // ARM-5: la guarda de contraste de la Bienvenida (como la Sidebar), solo dentro del panel.
  var GUARD = ['--bg-0', '--bg-1', '--tx-1', '--tx-3', '--muted', '--color-green', '--gn-gold', '--color-amber', '--acc-1',
    '--color-green-bg', '--color-amber-bg'];
  var guard = { applied: [], watching: false };
  function armContrast(tokens) {
    var d = root.document, W = root.Welcome;
    var host = d && d.getElementById ? d.getElementById('legendaryArmoryPanel') : null;
    if (!host || !host.style || !W || !W._pure || typeof W._pure.contrastFixes !== 'function') return {};
    if (!tokens) {
      tokens = {};
      var cs = typeof root.getComputedStyle === 'function' && d.documentElement ? root.getComputedStyle(d.documentElement) : null;
      GUARD.forEach(function (k) { tokens[k] = cs && cs.getPropertyValue ? cs.getPropertyValue(k) : ''; });
    }
    var fixes = W._pure.contrastFixes(tokens) || {};
    guard.applied.forEach(function (k) { if (!(k in fixes)) host.style.removeProperty(k); });
    Object.keys(fixes).forEach(function (k) { host.style.setProperty(k, fixes[k]); });
    guard.applied = Object.keys(fixes);
    if (!guard.watching && typeof root.MutationObserver === 'function' && d.documentElement) {
      guard.watching = true;
      new root.MutationObserver(function () { armContrast(); })
        .observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      if (d.addEventListener) d.addEventListener('load', function (e) { if (e && e.target && e.target.id === 'themeStylesheet') armContrast(); }, true);
    }
    return fixes;
  }

  // ARM-5: el tracker rearma todo con cada filtro; el foco vuelve al control equivalente.
  function focusKey(el) {
    var g = el && el.getAttribute ? function (k) { return el.getAttribute(k); } : null;
    if (!g) return '';
    if (g('data-action') === 'clear-filters') return '[data-ftype="ownership"][data-fvalue=""]';
    if (g('data-ftype')) return '[data-ftype="' + g('data-ftype') + '"][data-fvalue="' + (g('data-fvalue') || '') + '"]';
    var ks = ['data-card-queue', 'data-arm-tab', 'data-arm-act', 'data-arm-qopen'];
    for (var i = 0; i < ks.length; i++) if (g(ks[i])) return '[' + ks[i] + '="' + g(ks[i]) + '"]';
    if (el.id) return '#' + el.id;
    var p = typeof el.closest === 'function' ? el.closest('[data-id],[data-set]') : null;
    if (!p) return '';
    return p.getAttribute('data-set') ? '[data-set="' + p.getAttribute('data-set') + '"]>summary' :
      '[data-id="' + p.getAttribute('data-id') + '"] .arm-cname';
  }
  function keepFocus() {
    var d = root.document;
    var c = d && d.getElementById ? d.getElementById('legendaryModeContent') : null;
    var a = d && d.activeElement;
    if (!c || !a || typeof c.contains !== 'function' || !c.contains(a)) return;
    var key = focusKey(a);
    if (!key || typeof root.setTimeout !== 'function') return;
    root.setTimeout(function () {
      var now = d.activeElement;
      if (now && now !== d.body && c.contains(now)) return;
      var el = c.querySelector ? c.querySelector(key) : null;
      if (el && el.focus) el.focus();
    }, 0);
  }

  // Sin tildes y en minúscula: «crepusculo» encuentra «Crepúsculo».
  function norm(s) {
    var t = String(s || '').toLowerCase();
    return typeof t.normalize === 'function' ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
  }
  function matchesSearch(item, q) {
    return !q || norm(item.nameEs).indexOf(q) !== -1 || norm(item.name).indexOf(q) !== -1;
  }

  function trackerState() {
    var T = root.LegendaryTracker;
    try { return T && typeof T.getState === 'function' ? (T.getState() || null) : null; } catch (_) { return null; }
  }

  // Resumen de la cabecera: lo que tenés de cada tipo sobre el catálogo completo.
  function armorySummary(catalog, owned, queue) {
    var sum = { total: 0, owned: 0, weapon: { n: 0, of: 0 }, armor: { n: 0, of: 0 }, other: { n: 0, of: 0 },
      queue: (queue || []).length, max: (root.LegendaryTracker && root.LegendaryTracker.QUEUE_MAX) || 5 };
    (catalog || []).forEach(function (it) {
      if (!it) return;
      var has = !!(owned && owned[it.id] > 0);
      var k = it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor' : 'other';
      sum.total++; sum[k].of++;
      if (has) { sum.owned++; sum[k].n++; }
    });
    return sum;
  }

  function subLine(st, sum) {
    if (st && st.loading) return 'Leyendo la armería de tu cuenta…';
    if (st && st.error) return 'No pude leer la armería de tu cuenta: ves el catálogo completo, sin marcar las tuyas.';
    if (st && !st.token) return 'Sin API Key ves el catálogo completo; para marcar las tuyas, cargá una en Inicio.';
    return fmtInt(sum.total) + ' legendarias · lo que tenés en la armería de tu cuenta';
  }

  function headerHTML(sum, st) {
    var pct = sum.total ? Math.round(sum.owned * 1000 / sum.total) / 10 : 0;
    var stat = function (label, n, of, bar) {
      return '<div class="arm-st"><small>' + label + '</small><b>' + fmtInt(n) + ' <span>de ' + fmtInt(of) + '</span></b>' +
        (bar ? '<div class="arm-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
    };
    return '<section class="arm-hero" aria-labelledby="armTitle">' +
      '<div class="arm-hrow"><img src="assets/icons/Cuentas/157085.png" alt="" width="56" height="56">' +
        '<div><h2 id="armTitle">Armería Legendaria</h2><p class="arm-sub">' + esc(subLine(st, sum)) + '</p></div>' +
        '<div class="arm-hbtns"><button type="button" class="arm-btn" data-arm-act="refresh">↻ Actualizar</button></div>' +
      '</div>' +
      '<div class="arm-stats">' +
        stat('Desbloqueadas', sum.owned, sum.total, true) +
        stat('Armas', sum.weapon.n, sum.weapon.of) +
        stat('Armaduras', sum.armor.n, sum.armor.of) +
        stat('Abalorios y más', sum.other.n, sum.other.of) +
        stat('En tu cola', sum.queue, sum.max) +
      '</div>' + voiceHTML(st, sum) +
    '</section>';
  }

  function tabsHTML(mode, sum) {
    var tab = function (id, label, extra) {
      return '<button type="button" class="arm-tab" data-arm-tab="' + id + '"' +
        (mode === id ? ' aria-current="page"' : '') + '>' + label + '<span>' + extra + '</span></button>';
    };
    return '<nav class="arm-tabs" aria-label="Vistas de la Armería">' +
      tab('catalog', 'Catálogo', fmtInt(sum.total)) + tab('progress', 'Mi cola', sum.queue + ' de ' + sum.max) + '</nav>';
  }

  function toolbarHTML() {
    return '<div class="arm-tool"><label class="arm-sr" for="armSearch">Buscar legendaria</label>' +
      '<input type="search" id="armSearch" class="arm-search" autocomplete="off" ' +
      'placeholder="Buscar por nombre, en español o en inglés…" value="' + esc(ui.raw) + '">' +
      '<span id="armSearchLive" class="arm-sr" role="status" aria-live="polite"></span></div>';
  }

  function shellHTML(catalog) {
    ensureArmCss();
    wireArm();
    armContrast();
    keepFocus();
    var st = trackerState();
    var mode = st && st.mode === 'progress' ? 'progress' : 'catalog';
    var sum = armorySummary(catalog, (st && st.owned) || {}, colaActual());
    return headerHTML(sum, st) + tabsHTML(mode, sum) + (mode === 'catalog' ? toolbarHTML() : '');
  }

  function countLine(n, q) {
    if (!q) return '';
    return '<p class="arm-count">' + (n === 1 ? '1 legendaria' : fmtInt(n) + ' legendarias') + ' para «' + esc(ui.raw) + '»</p>';
  }

  // Un solo oyente por contenedor (el tracker rearma su contenido en cada filtro).
  function wireArm() {
    var d = root.document;
    var c = d && typeof d.getElementById === 'function' ? d.getElementById('legendaryModeContent') : null;
    if (!c || c._armWired || typeof c.addEventListener !== 'function') return;
    c._armWired = true;
    c.addEventListener('input', function (e) {
      var t = e && e.target;
      if (!t || t.id !== 'armSearch') return;
      searchFor(t.value);
    });
    // Los <select> de expansión y generación van por `setFilter`.
    c.addEventListener('change', function (e) {
      var t = e && e.target;
      var k = t && t.getAttribute ? t.getAttribute('data-arm-filter') : null;
      var T = root.LegendaryTracker;
      if (k && T && typeof T.setFilter === 'function') T.setFilter(k, t.value);
    });
    // En captura: un clic sobre un <option> (Firefox lo dispara) no puede llegar
    // a `wireFilterBar`, que leería su `data-ftype` y alternaría el filtro.
    c.addEventListener('click', function (e) {
      var t = e && e.target;
      var tag = t && t.tagName ? String(t.tagName).toUpperCase() : '';
      if (tag === 'OPTION' || tag === 'SELECT') { if (e.stopPropagation) e.stopPropagation(); return; }
      while (t && t !== c) {
        if (t.getAttribute) {
          var tab = t.getAttribute('data-arm-tab');
          var act = t.getAttribute('data-arm-act');
          var T = root.LegendaryTracker;
          if (tab) { if (T && typeof T.setMode === 'function') T.setMode(tab); return; }
          if (act === 'refresh') { if (T && typeof T.refresh === 'function') T.refresh(); return; }
          var qo = t.getAttribute('data-arm-qopen');
          if (qo) { if (T && typeof T.openItemModal === 'function') T.openItemModal(qo); return; }
          var qr = t.getAttribute('data-arm-qrm');
          if (qr) { removeFromQueue(qr, c); return; }
        }
        t = t.parentNode;
      }
    }, true);
  }

  // Filtra la grilla sin rearmar la página: el buscador no pierde el foco.
  function searchFor(value) {
    ui.raw = String(value || '');
    ui.q = norm(ui.raw).trim();
    var d = root.document;
    var host = d && d.getElementById ? d.getElementById('armGridHost') : null;
    var html = gridInner(ui.lastItems || [], ui.lastOwned || {});
    if (host) host.innerHTML = html;
    var live = d && d.getElementById ? d.getElementById('armSearchLive') : null;
    if (live) {
      var n = (ui.lastItems || []).filter(function (it) { return matchesSearch(it, ui.q); }).length;
      live.textContent = ui.q ? (n === 1 ? '1 legendaria' : n + ' legendarias') : '';
    }
    return html;
  }

  // =======================================================================
  // ARM-3 (BL-064): «MI COLA» Y MI LÍNEA EN LA CABECERA
  // =======================================================================
  // La cola la sigue guardando el tracker (gn:legendary:queue, hasta 5). Su panel
  // viejo (`renderQueuePanel`) se sigue pintando detrás de esta vista y queda
  // oculto con `.arm-qview~*`: legendary-tracker.js está a 1 KB del límite de
  // publicación (LES-028) y no lo toco. Cuando el tracker adelgace, el panel viejo
  // se borra allá y esta regla se va (DEBT anotada en ARM-3).
  //
  // En «Mi cola» no van los filtros del catálogo: la cola no se filtra (decisión
  // de producto de HB#147) y un filtro que no cambia nada es un control que miente.

  // Una línea, una vez por pantalla (DEC-024), solo sobre la Armería (N1–N2,
  // DEC-033). Sin Key o leyendo no digo nada: la cabecera ya lo cuenta.
  function voiceText(st, sum) {
    if (!st || st.loading || !st.token) return '';
    if (st.error) {
      return /permis|unlock|desbloque|scope|403/i.test(String(st.error))
        ? 'Tu Key no me deja ver tu armería: le falta el permiso «desbloqueos». Te explico cómo arreglarlo en Inicio.'
        : 'No pude leer tu armería. Probá «↻ Actualizar» en un rato; si sigue, revisá tu Key en Inicio.';
    }
    var have = sum.owned === sum.total ? 'Tenés las ' + fmtInt(sum.total) + '. ' :
      'Tenés ' + fmtInt(sum.owned) + ' de ' + fmtInt(sum.total) + '. ';
    if (!sum.queue) return have + 'Abrí cualquier legendaria y sumala a tu cola: te muestro la receta y lo que te falta.';
    return have + 'En tu cola ' + (sum.queue === 1 ? 'hay 1' : 'hay ' + sum.queue) +
      ': abrí una para ver qué materiales te faltan.';
  }

  function voiceHTML(st, sum) {
    var text = voiceText(st, sum);
    if (!text) return '';
    var S = root.Shiruvana;
    var img = S && typeof S.AVATAR === 'string' && S.AVATAR.indexOf('data:image/') === 0 ?
      '<img src="' + S.AVATAR + '" alt="" width="32" height="32">' : '';
    return '<aside class="arm-voice" aria-label="Shiruvana">' + img +
      '<p><b>Shiruvana</b> · ' + esc(text) + '</p></aside>';
  }

  function queueItemsOf(ids) {
    var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    var byId = {};
    cat.forEach(function (it) { if (it) byId[it.id] = it; });
    return (ids || []).map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function queueRow(item, pos, owned) {
    var name = item.nameEs || item.name;
    var state = '';
    if (owned[item.id] > 0) state = '<span class="arm-own">✓ La tengo</span>';
    else if (item.tpTradeable && item.tpSell > 0) state = '<span class="arm-price">≈ ' + tpCoinHTML(item.tpSell) + '</span>';
    else state = '<span class="arm-nosell">No se vende</span>';
    return '<li class="arm-qrow" data-qid="' + item.id + '"' + (pos < 3 ? ' data-top="1"' : '') + '>' +
      '<span class="arm-qpos" aria-hidden="true">' + (pos + 1) + '</span>' +
      '<img class="arm-cicon" src="' + esc(item.icon || '') + '" width="44" height="44" alt="" loading="lazy" referrerpolicy="no-referrer">' +
      '<div class="arm-qbody"><b class="arm-qname">' + esc(name) + '</b>' +
        '<p class="arm-cmeta"><i class="arm-dot" style="background:' + typeColor(item) + '" aria-hidden="true"></i>' +
          esc(kindLabel(item) + ' · ' + expansionLabel(item)) + '</p>' + state + '</div>' +
      '<div class="arm-qacts">' +
        '<button type="button" class="arm-btn arm-btn--pri" data-arm-qopen="' + item.id + '">Ver receta y materiales</button>' +
        '<button type="button" class="arm-btn" data-arm-qrm="' + item.id + '" aria-label="' + esc('Quitar ' + name + ' de tu cola') + '">Quitar</button>' +
      '</div></li>';
  }

  function queueViewHTML(st, sum) {
    var items = queueItemsOf(colaActual());
    var owned = (st && st.owned) || {};
    var max = sum.max;
    var head = '<h3 class="arm-sec" id="armQTitle">Tu cola <span>· ' + items.length + ' de ' + max + '</span></h3>';
    if (!items.length) {
      return '<section class="arm-qview" aria-labelledby="armQTitle">' + head +
        '<div class="arm-empty"><p>Tu cola está vacía.</p>' +
        '<p>Sumá hasta ' + max + ' legendarias desde el catálogo con «+ A la cola»: acá las tenés a mano, con su receta.</p>' +
        '<button type="button" class="arm-btn arm-btn--pri" data-arm-tab="catalog">Ir al catálogo</button></div></section>';
    }
    var left = max - items.length;
    var foot = left > 0 ?
      'Te ' + (left === 1 ? 'queda 1 lugar' : 'quedan ' + left + ' lugares') + '. Sumá legendarias desde el catálogo con «+ A la cola».' :
      'Tu cola está completa: para sumar otra, quitá una.';
    var priced = items.some(function (it) { return !(owned[it.id] > 0) && it.tpTradeable && it.tpSell > 0; });
    var d = priceDate();
    return '<section class="arm-qview" aria-labelledby="armQTitle">' + head +
      '<ol class="arm-qlist">' + items.map(function (it, i) { return queueRow(it, i, owned); }).join('') + '</ol>' +
      '<p class="arm-note">' + foot + (priced && d ? ' ≈ Precio de referencia del bazar del ' + d + ', no en vivo.' : '') + '</p>' +
    '</section>';
  }

  // Una región «polite» fija, fuera de lo que el tracker repinta.
  function announce(text) {
    var d = root.document;
    if (!d || !d.body || typeof d.createElement !== 'function') return;
    var live = d.getElementById('armLive');
    if (!live) {
      live = d.createElement('div');
      live.id = 'armLive';
      live.className = 'arm-sr';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      d.body.appendChild(live);
    }
    live.textContent = text;
  }

  function removeFromQueue(id, c) {
    var T = root.LegendaryTracker;
    if (!T || typeof T.toggleQueue !== 'function') return;
    var before = colaActual();
    var pos = before.indexOf(Number(id));
    var it = queueItemsOf([Number(id)])[0];
    var res = T.toggleQueue(id);
    if (!res || !res.ok) return;
    if (typeof T.setMode === 'function') T.setMode('progress');
    var n = before.length - 1;
    announce('Quitaste ' + (it ? (it.nameEs || it.name) : 'la legendaria') + ' de tu cola. ' +
      (n === 1 ? 'Queda 1.' : 'Quedan ' + n + '.'));
    // El foco va al «Quitar» que quedó en ese lugar, o al anterior, o a «Ir al catálogo».
    if (c && typeof c.querySelectorAll === 'function') {
      var rm = c.querySelectorAll('[data-arm-qrm]');
      var next = rm[Math.min(pos, rm.length - 1)] || c.querySelector('[data-arm-tab="catalog"].arm-btn');
      if (next && typeof next.focus === 'function') next.focus();
    }
  }

  // =======================================================================
  // RENDER: BARRA DE FILTROS (ARM-2: una sola fila)
  // =======================================================================
  // Los botones son hojas, sin elementos adentro: `wireFilterBar` del tracker
  // lee el atributo de `e.target` sin subir, así que un <span> interno se
  // comería el clic. Expansión y generación son <select>: los cambia `wireArm`
  // con `setFilter`, y sus <option> conservan `data-ftype` (contrato de tests).
  // «Todas» manda `data-fvalue=""`: el tracker guarda '' (falso) y muestra todo.
  //
  // Tengo / Me faltan los cuenta el tracker (`getOwnershipCounts`), no el render:
  // contarlos acá obligaría a duplicar `passesFilters`. La firma
  // `renderFilterBar(filters, catalog)` es el contrato de renderers y no cambia.
  var TYPE_ORDER = ['weapon', 'armor', 'trinket', 'back', 'upgradecomponent', 'relic'];

  function chip(ft, value, label, active) {
    return '<button type="button" class="lt-filter-btn arm-chip' + (active ? ' active' : '') + '" ' +
      'data-ftype="' + ft + '" data-fvalue="' + value + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
      esc(label) + '</button>';
  }

  function selectHTML(key, label, values, labels, counts, current) {
    var id = 'armF-' + key;
    var cur = current === null || current === undefined ? '' : String(current);
    var opts = '<option value=""' + (cur ? '' : ' selected') + '>Todas</option>' + values.map(function (v) {
      return '<option value="' + v + '" data-ftype="' + key + '" data-fvalue="' + v + '"' +
        (cur === String(v) ? ' selected' : '') + '>' + esc(labels[v] || v) + ' (' + (counts[v] || 0) + ')</option>';
    }).join('');
    return '<span class="arm-fsel"><label for="' + id + '">' + label + '</label>' +
      '<select id="' + id + '" class="arm-select" data-arm-filter="' + key + '">' + opts + '</select></span>';
  }

  function renderFilterBar(filters, catalog) {
    corregirExpansiones(catalog);
    filters = filters || {};
    var st0 = trackerState();
    if (st0 && st0.mode === 'progress') {
      return shellHTML(catalog) + queueViewHTML(st0, armorySummary(catalog, st0.owned || {}, colaActual()));
    }
    var opts = getFilterOptions(catalog || []);
    var own = { tengo: 0, faltan: 0 };
    var T = root.LegendaryTracker;
    if (T && typeof T.getOwnershipCounts === 'function') own = T.getOwnershipCounts() || own;
    var o = filters.ownership || '';

    var seg = '<div class="arm-seg" role="group" aria-label="Qué legendarias ver">' +
      chip('ownership', '', 'Todas', !o) +
      chip('ownership', 'tengo', 'Las tengo · ' + fmtInt(own.tengo), o === 'tengo') +
      chip('ownership', 'faltan', 'Me faltan · ' + fmtInt(own.faltan), o === 'faltan') + '</div>';

    var types = '<div class="arm-fgroup" role="group" aria-label="Tipo"><span class="arm-flabel" aria-hidden="true">Tipo</span>' +
      TYPE_ORDER.map(function (t) {
        return chip('type', t, (TYPE_LABELS[t] || t) + ' (' + (opts.types[t] || 0) + ')', filters.type === t);
      }).join('') + '</div>';

    var hasActive = filters.type || filters.generation || filters.expansion || filters.ownership;
    var clear = hasActive ?
      '<button type="button" class="lt-filter-clear arm-chip arm-clear" data-action="clear-filters">✕ Limpiar</button>' : '';

    return shellHTML(catalog) +
      '<div class="lt-filter-bar arm-filters">' + seg + types +
        selectHTML('expansion', 'Expansión', EXPANSION_ORDER, EXPANSION_LABELS, opts.exps, filters.expansion) +
        selectHTML('generation', 'Gen.', [3, 2, 1], GEN_LABELS, opts.gens, filters.generation) +
        clear +
      '</div>';
  }

  // =======================================================================
  // RENDER: GRILLA DEL CATÁLOGO (ARM-2: secciones por expansión, grilla adaptable)
  // =======================================================================
  // La cola se lee UNA vez por grilla y se pasa a cada tarjeta.
  function colaActual() {
    if (root.LegendaryTracker && typeof root.LegendaryTracker.getQueue === 'function') {
      return root.LegendaryTracker.getQueue() || [];
    }
    return [];
  }

  function renderCatalogGrid(items, owned) {
    ui.lastItems = items || [];
    ui.lastOwned = owned || {};
    return '<div id="armGridHost">' + gridInner(ui.lastItems, ui.lastOwned) + '</div>';
  }

  // Fecha del precio: la del catálogo generado, no la del bazar en vivo (LES-021).
  function priceDate() {
    var g = root.LegendaryCatalog && root.LegendaryCatalog.generated;
    var m = /^\d{4}-\d{2}-\d{2}/.exec(String(g || ''));
    return m ? m[0] : '';
  }

  // Sin Key (o si la API falló) no sé cuáles tenés: no digo «tenés 0».
  function hasKey() {
    var st = trackerState();
    return !!(st && st.token && !st.error);
  }

  function emptyHTML(a, b) {
    return '<div class="lt-empty-state arm-empty"><p>' + a + '</p><p>' + b + '</p></div>';
  }

  function gridInner(all, owned) {
    owned = owned || {};
    var items = (all || []).filter(function (it) { return matchesSearch(it, ui.q); });
    if (ui.q && items.length === 0 && all.length) {
      return emptyHTML('No encontré ninguna legendaria que se llame «' + esc(ui.raw) + '».',
        'Probá con otra parte del nombre, en español o en inglés.');
    }
    if (!items.length) {
      return emptyHTML('No hay legendarias con estos filtros.', 'Probá con «✕ Limpiar».');
    }

    // Agrupada por expansión, en orden de salida; dentro de cada una, el orden
    // del catálogo (BL-046). Ahora cada grupo tiene su título y su avance.
    var ordenados = items.map(function (it, i) { return { it: it, i: i }; });
    ordenados.sort(function (a, b) {
      return (ordenExpansion(expansionReal(a.it)) - ordenExpansion(expansionReal(b.it))) || (a.i - b.i);
    });
    var secs = [];
    ordenados.forEach(function (x) {
      var e = expansionReal(x.it) || 'otras';
      var s = secs[secs.length - 1];
      if (!s || s.e !== e) { s = { e: e, items: [] }; secs.push(s); }
      s.items.push(x.it);
    });

    var cola = colaActual();
    var key = hasKey();
    var body = secs.map(function (s) {
      var n = s.items.filter(function (it) { return owned[it.id] > 0; }).length;
      var id = 'armSec-' + esc(s.e);
      var meta = key ? 'tenés ' + fmtInt(n) + ' de ' + fmtInt(s.items.length) :
        fmtInt(s.items.length) + (s.items.length === 1 ? ' legendaria' : ' legendarias');
      return '<section class="arm-section" aria-labelledby="' + id + '">' +
        '<h3 class="arm-sec" id="' + id + '">' + esc(EXPANSION_LABELS[s.e] || s.e) + ' <span>· ' + meta + '</span></h3>' +
        '<div class="lt-catalog-grid arm-grid">' +
          sectionHTML(s.items, owned, cola, key) +
        '</div></section>';
    }).join('');

    var d = priceDate();
    var note = d ? '<p class="arm-note">≈ Precio de referencia del bazar del ' + d + ', no en vivo.</p>' : '';
    return countLine(items.length, ui.q) + note + body;
  }

  // =======================================================================
  // TARJETA (ARM-2)
  // =======================================================================
  var WEAPON_ES = {
    axe: 'Hacha', dagger: 'Daga', focus: 'Foco', greatsword: 'Mandoble', hammer: 'Martillo',
    harpoon: 'Lanza', longbow: 'Arco largo', mace: 'Maza', pistol: 'Pistola', rifle: 'Rifle',
    scepter: 'Cetro', shield: 'Escudo', shortbow: 'Arco corto', speargun: 'Arpón', staff: 'Báculo',
    sword: 'Espada', torch: 'Antorcha', trident: 'Tridente', warhorn: 'Cuerno de guerra',
    accessory: 'Accesorio', amulet: 'Amuleto', ring: 'Anillo', back: 'Espaldar'
  };
  var PIECE_ES = {
    helm: 'Casco', helmaquatic: 'Casco acuático', shoulders: 'Hombreras', coat: 'Pechera',
    gloves: 'Guantes', leggings: 'Perneras', boots: 'Botas'
  };
  var WEIGHT_ES = { heavy: 'Pesada', medium: 'Media', light: 'Ligera' };

  // «Hacha · Gen 1», «Casco · Pesada · Gen 3», «Componente».
  function kindLabel(item) {
    var s = String(item.subtype || '');
    var m = /^(heavy|medium|light) (\w+)$/.exec(s);
    var parts = m ? [PIECE_ES[m[2]] || m[2], WEIGHT_ES[m[1]]] : [WEAPON_ES[s] || typeLabel(item)];
    var g = genLabel(item);
    if (g !== '—') parts.push(g);
    return parts.join(' · ');
  }

  // Un artículo con dos controles reales y separados: el nombre (botón que abre
  // la ficha; el clic en cualquier lado de la tarjeta también, vía
  // `wireItemCards`) y «+ A la cola» (`data-card-queue`, que el tracker atiende
  // antes que la tarjeta). Nunca un botón dentro de otro.
  // `class="card lt-item-card"` y `data-id` son contrato de los tests heredados:
  // el estado va en `data-own` / `data-q`, no en la clase.
  function renderItemCard(item, owned, idx, queue) {
    var cola = queue || [];
    owned = owned || {};
    var enCola = cola.indexOf(Number(item.id)) !== -1;
    var isOwned = !!(owned[item.id] && owned[item.id] > 0);
    var name = item.nameEs || item.name;
    var d = priceDate();

    var state;
    if (isOwned) {
      state = '<span class="arm-own">✓ La tengo</span>';
    } else if (item.tpTradeable && item.tpSell > 0) {
      state = '<span class="lt-tp-badge arm-price" title="Precio de referencia del bazar' + (d ? ' del ' + d : '') +
        ', no en vivo">≈ ' + tpCoinHTML(item.tpSell) + '</span>';
    } else {
      state = '<span class="arm-nosell">No se vende</span>';
    }

    var qBtn = '';
    if (!isOwned || enCola) {
      var qLabel = enCola ? 'Quitar ' + name + ' de tu cola' : 'Agregar ' + name + ' a tu cola';
      qBtn = '<button type="button" class="lt-card-queue-btn arm-qbtn" data-card-queue="' + item.id + '" ' +
        'aria-label="' + esc(qLabel) + '" title="' + esc(qLabel) + '">' + (enCola ? '✓ En tu cola' : '+ A la cola') + '</button>';
    }

    return '<article class="card lt-item-card" data-id="' + item.id + '" data-type="' + esc(item.type) + '"' +
      (isOwned ? ' data-own="1"' : '') + (enCola ? ' data-q="1"' : '') + '>' +
      '<img class="arm-cicon" src="' + esc(item.icon || '') + '" width="44" height="44" alt="" loading="lazy" referrerpolicy="no-referrer">' +
      '<div class="arm-cbody">' +
        '<button type="button" class="arm-cname" title="Ver receta y materiales">' + esc(name) + '</button>' +
        '<p class="arm-cmeta"><i class="arm-dot" style="background:' + typeColor(item) + '" aria-hidden="true"></i>' +
          esc(kindLabel(item)) + '</p>' +
        '<div class="arm-cfoot">' + state + qBtn + '</div>' +
      '</div></article>';
  }

  // =======================================================================
  // ARM-4 (BL-064): ARMADURAS POR SET
  // =======================================================================
  // 132 de las 206 son piezas sueltas. Las agrupo por set y peso: una tarjeta
  // por set con «tenés N de 6 piezas»; al abrirla (<details>, teclado nativo)
  // aparecen sus piezas con la tarjeta de siempre (`card lt-item-card`, que
  // abre la ficha y encola como antes; los tests heredados las siguen
  // contando). Una armadura que no reconozco va suelta: nunca la escondo.
  // Eikasia (guantes) y Selachimorpha (casco acuático) son una pieza por peso:
  // van en una sola tarjeta con los 3 pesos.
  var ARMOR_SETS = [
    [/^(Sublime )?Mistforged Triumphant/, 'mtri', 'Héroe triunfal forjado en la Niebla'],
    [/^Mistforged Glorious/, 'mglo', 'Héroe glorioso forjado en la Niebla'],
    [/^Triumphant Hero/, 'tri', 'Héroe triunfal'],
    [/^Glorious Hero/, 'glo', 'Héroe glorioso'],
    [/^Ardent Glorious/, 'ard', 'Glorioso ardiente'],
    [/^Perfected Envoy/, 'env', 'Enviado perfeccionado'],
    [/^Obsidian /, 'obs', 'Obsidiana'],
    [/^Eikasia/, 'eik', 'Eikasia, aferranieblas', 1],
    [/^Selachimorpha/, 'sel', 'Selaquimorfo', 1]
  ];
  var setCache = {};

  function setOf(it) {
    if (!it || it.type !== 'armor') return null;
    if (setCache[it.id] !== undefined) return setCache[it.id];
    var r = null;
    for (var i = 0; i < ARMOR_SETS.length && !r; i++) {
      var s = ARMOR_SETS[i];
      if (!s[0].test(it.name || '')) continue;
      var m = /^(heavy|medium|light) (\w+)$/.exec(it.subtype || '') || [];
      r = { key: s[1] + (s[3] ? '' : '-' + (m[1] || '')), single: !!s[3],
        name: s[2] + (s[3] || !m[1] ? '' : ' · ' + WEIGHT_ES[m[1]]), piece: PIECE_ES[m[2]] || '' };
    }
    return (setCache[it.id] = r);
  }

  function sectionHTML(items, owned, cola, key) {
    var all = (root.LegendaryCatalog && root.LegendaryCatalog.items) || items;
    var done = {};
    return items.map(function (it) {
      var s = setOf(it);
      if (!s) return renderItemCard(it, owned, 0, cola);
      if (done[s.key]) return '';
      done[s.key] = 1;
      var inSet = function (x) { var o = setOf(x); return !!o && o.key === s.key; };
      return setCardHTML(s, items.filter(inSet), all.filter(inSet), owned, cola, key);
    }).join('');
  }

  function setCardHTML(s, shown, pieces, owned, cola, key) {
    var t = pieces.length;
    var n = pieces.filter(function (x) { return owned[x.id] > 0; }).length;
    var q = shown.filter(function (x) { return cola.indexOf(Number(x.id)) !== -1; }).length;
    var full = key && n === t;
    var g = genLabel(pieces[0] || shown[0]);
    var meta = [s.single ? s.piece + ' · los 3 pesos' : 'Armadura'];
    if (g !== '—') meta.push(g);
    meta.push(key ? (full ? '✓ Completo · ' : 'tenés ') + n + ' de ' + t + (t === 1 ? ' pieza' : ' piezas') :
      t + (t === 1 ? ' pieza' : ' piezas'));
    if (q) meta.push(q + ' en tu cola');
    var pct = t ? Math.round(n * 1000 / t) / 10 : 0;
    return '<details class="arm-set" data-set="' + s.key + '"' + (full ? ' data-full="1"' : '') +
      (q ? ' data-q="1"' : '') + (ui.q ? ' open' : '') + '>' +
      '<summary><img class="arm-cicon" src="' + esc((shown[0] || {}).icon || '') + '" width="44" height="44" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<div class="arm-cbody"><b class="arm-sname">' + esc(s.name) + '</b>' +
          '<p class="arm-cmeta"><i class="arm-dot" style="background:' + typeColor({ type: 'armor' }) + '" aria-hidden="true"></i>' +
            esc(meta.join(' · ')) + '</p>' +
          (key ? '<div class="arm-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' : '') +
        '</div><span class="arm-chev" aria-hidden="true">›</span></summary>' +
      '<div class="arm-grid">' + shown.map(function (x) { return renderItemCard(x, owned, 0, cola); }).join('') + '</div>' +
    '</details>';
  }

  // =======================================================================
  // RENDER: PROGRESS VIEW
  // =======================================================================
  function renderProgress(state, stats) {
    var catalog = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];

    // Recibe la lista ya recortada por el tracker en `state.items`; sin ella,
    // cae a las que tenés (consumidores viejos). Historia: git (punto 2.2).
    var items;
    if (Array.isArray(state.items)) {
      items = state.items.slice();
    } else {
      items = catalog.filter(function (item) {
        return state.owned[item.id] && state.owned[item.id] > 0;
      });
    }

    items.sort(function (a, b) {
      return (a.nameEs || a.name).localeCompare(b.nameEs || b.name, 'es');
    });

    if (items.length === 0) {
      // Un vacío que afirma algo falso es peor que ninguno: el mensaje depende del motivo.
      var hayFiltro = !!(state.filters && (state.filters.type || state.filters.generation || state.filters.expansion));
      var soloFaltantes = state.scope === 'missing';
      var msg, sub;
      if (hayFiltro) {
        msg = 'No hay legendarias con los filtros aplicados.';
        sub = 'Probá limpiar los filtros para ver el progreso completo.';
      } else if (soloFaltantes) {
        msg = 'No te falta ninguna legendaria de esta vista.';
        sub = 'Tenés todas las legendarias desbloqueadas. Cambiá a <strong>Desbloqueadas</strong> para verlas.';
      } else {
        msg = 'Aún no poseés ninguna legendaria.';
        sub = 'Cambiá a la vista <strong>Catálogo</strong> para explorar todas las legendarias.';
      }
      return '<div class="lt-progress-empty" style="text-align:center;padding:40px;color:var(--tx-3);">' +
        '<div style="font-size:0.85rem;margin-bottom:8px;">' + msg + '</div>' +
        '<div style="font-size:0.75rem;">' + sub + '</div>' +
        '</div>';
    }

    var cola = colaActual();
    var cards = items.map(function (item, idx) {
      return renderItemCard(item, state.owned, idx, cola);
    });

    return '<div class="lt-progress-summary" style="margin-bottom:16px;">' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:0.75rem;color:var(--tx-3);">Completado:</span>' +
          '<strong style="font-size:1rem;color:#974EFF;">' + fmtInt(stats.owned) + ' / ' + fmtInt(stats.total) + '</strong>' +
        '</div>' +
        '<div style="width:120px;height:8px;background:var(--bg-1);border-radius:4px;overflow:hidden;">' +
          '<div style="width:' + stats.pct + '%;height:100%;background:#974EFF;border-radius:4px;"></div>' +
        '</div>' +
        '<span style="font-size:0.7rem;color:var(--tx-3);">' + stats.pct + '%</span>' +
      '</div>' +
      '</div>' +
      '<div class="lt-progress-grid arm-grid">' +
        cards.join('') +
      '</div>';
  }

  // =======================================================================
  // RENDER: MODAL DE MATERIALES (ARME 1.2)
  // =======================================================================
  // Pinta lo que calcula `computeMaterials`; no consulta la API. Los cuatro
  // status se dibujan distintos a propósito (un filtro invisible no avisa).
  function renderItemModal(datos, item) {
    if (!datos) {
      return '<div style="padding:18px;color:var(--tx-3);font-size:0.78rem;">Sin datos.</div>';
    }

    // El motivo lo da el contrato: no se inventa texto acá.
    if (datos.status !== 'recipe') {
      var icon = datos.status === 'unknown' ? '?' : '!';
      return '<div style="padding:16px 4px;">' +
        '<div style="display:flex;gap:10px;align-items:flex-start;">' +
          '<div style="flex:0 0 22px;height:22px;border-radius:50%;border:1px solid rgba(255,196,84,0.5);' +
            'color:#ffc454;font-size:0.7rem;font-weight:700;display:flex;align-items:center;' +
            'justify-content:center;">' + icon + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:0.7rem;font-weight:700;color:#ffc454;letter-spacing:0.04em;' +
              'text-transform:uppercase;">' + esc(datos.status) + '</div>' +
            '<div style="font-size:0.78rem;color:var(--tx-2);margin-top:5px;line-height:1.5;">' +
              esc(datos.note || '') + '</div>' +
            (datos.craftType
              ? '<div style="font-size:0.7rem;color:var(--tx-3);margin-top:6px;">craftType: <code>' +
                esc(datos.craftType) + '</code></div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var COL = {
      ok: { l: '#68ff9f', t: 'TENGO' },
      partial: { l: '#ffc454', t: 'FALTA' },
      missing: { l: '#ff7a7a', t: 'FALTA' }
    };

    var filas = datos.rows.map(function (r) {
      var c = COL[r.state] || COL.missing;
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;' +
          'border-bottom:1px solid var(--bd-1);">' +
        '<div style="flex:1;min-width:0;font-size:0.78rem;color:var(--tx-1);' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(r.name) + '">' +
          esc(r.name) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--tx-3);white-space:nowrap;">' +
          '<span style="color:' + c.l + ';font-weight:700;">' + esc(c.t) + '</span> ' +
          fmtInt(r.have) + '/' + fmtInt(r.need) + '</div>' +
      '</div>';
    });

    var resumen = datos.allHave
      ? '<span style="color:#68ff9f;">Tenes todos los materiales.</span>'
      : '<span style="color:#ffc454;">Te faltan ' + fmtInt(datos.totals.missing) +
        ' de ' + fmtInt(datos.totals.need) + ' unidades.</span>';

    return '<div style="padding:4px 2px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;' +
        'padding-bottom:9px;margin-bottom:5px;border-bottom:1px solid var(--bd-1);">' +
        '<span style="font-size:0.72rem;color:var(--tx-2);">' + resumen + '</span>' +
        '<span style="font-size:0.65rem;color:var(--tx-3);text-transform:uppercase;' +
          'letter-spacing:0.04em;">' + esc(datos.craftType || '—') +
          (datos.disciplines && datos.disciplines.length
            ? ' · ' + esc(datos.disciplines.join(', ')) : '') +
        '</span>' +
      '</div>' +
      (filas.length ? filas.join('') :
        '<div style="padding:14px 0;font-size:0.76rem;color:var(--tx-3);">La receta no lista ingredientes.</div>') +
      (item && item.tpTradeable && item.tpSell
        ? '<div style="margin-top:10px;font-size:0.68rem;color:var(--tx-3);">' +
          'En trading post: ' + tpCoinHTML(item.tpSell) + '</div>'
        : '') +
    '</div>';
  }

  function renderSkeleton() {
    ensureArmCss();
    var skelCard = function () {
      return '<div class="lt-skeleton-card card" style="padding:10px;border-radius:12px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="width:40px;height:40px;border-radius:6px;background:linear-gradient(90deg,var(--bg-1) 25%,var(--bg-2) 50%,var(--bg-1) 75%);background-size:200% 100%;animation:ltShimmer 1.5s infinite;"></div>' +
          '<div style="flex:1;">' +
            '<div style="height:12px;background:var(--bg-1);border-radius:4px;margin-bottom:4px;width:70%;animation:ltShimmer 1.5s infinite;"></div>' +
            '<div style="height:10px;background:var(--bg-2);border-radius:4px;width:40%;"></div>' +
          '</div>' +
        '</div>' +
        '<div style="height:10px;background:var(--bg-1);border-radius:4px;margin-top:6px;width:30%;"></div>' +
      '</div>';
    };

    var buttons = Array(10).fill(0).map(function () {
      return '<div style="width:70px;height:26px;background:var(--bg-1);border-radius:20px;"></div>';
    }).join('');

    return '<div class="lt-filter-bar" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;"><span style="font-size:0.65rem;color:var(--tx-3);padding:4px 8px;">Tipo:</span>' + buttons.substring(0, buttons.length / 2) + '</div>' +
    '</div>' +
    '<div class="lt-catalog-grid arm-grid">' +
      Array(15).fill(0).map(skelCard).join('') +
    '</div>';
  }

  // =======================================================================
  // INYECTAR ESTILOS DINÁMICOS (skeleton animation)
  // =======================================================================
  function injectSkeletonStyles() {
    if (document.getElementById('lt-skeleton-styles')) return;
    var css = '@keyframes ltShimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}';
    var s = document.createElement('style');
    s.id = 'lt-skeleton-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  root.LegendaryCatalogUI = {
    expansionReal: expansionReal,
    corregirExpansiones: corregirExpansiones,
    EXPANSION_ORDER: EXPANSION_ORDER.slice(),
    TYPE_LABELS: TYPE_LABELS,
    // ARM-1: lo que prueban los tests.
    _arm: { CSS: ARM_CSS, norm: norm, summary: armorySummary, search: searchFor, state: ui, kind: kindLabel, card: renderItemCard, voice: voiceText, queue: queueViewHTML, setOf: setOf,
      contrast: armContrast, focusKey: focusKey }
  };

  // =======================================================================
  // REGISTRO
  // =======================================================================
  if (root.LegendaryTracker && typeof root.LegendaryTracker.registerRender === 'function') {
    root.LegendaryTracker.registerRender({
      filterBar: renderFilterBar,
      catalogGrid: renderCatalogGrid,
      skeleton: renderSkeleton,
      progress: renderProgress
    });
    injectSkeletonStyles();
    // El modal de materiales (ARME 1.2) se registra por su PUERTA PROPIA, no
    // como quinta clave del registro de arriba: ese registro rechaza lo
    // incompleto a proposito, y meterlo ahi haria que el modulo dejara de
    // pintar el catalogo entero si este render no llegara.
    if (typeof root.LegendaryTracker.registerItemModal === 'function') {
      root.LegendaryTracker.registerItemModal(renderItemModal);
    }
    console.info(LOG, 'render functions registered');
  } else {
    // Retry en próximo tick (el módulo principal puede no estar listo)
    setTimeout(function () {
      if (root.LegendaryTracker && typeof root.LegendaryTracker.registerRender === 'function') {
        root.LegendaryTracker.registerRender({
          filterBar: renderFilterBar,
          catalogGrid: renderCatalogGrid,
          skeleton: renderSkeleton,
          progress: renderProgress
        });
        injectSkeletonStyles();
        if (typeof root.LegendaryTracker.registerItemModal === 'function') {
          root.LegendaryTracker.registerItemModal(renderItemModal);
        }
        console.info(LOG, 'render functions registered (retry)');
      } else {
        console.warn(LOG, 'LegendaryTracker no disponible, render functions no registradas');
      }
    }, 50);
  }

})(typeof window !== 'undefined' ? window : this);
