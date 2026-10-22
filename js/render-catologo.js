/*!
 * js/render-catologo.js — Render del catálogo y filtros
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
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
  // `legendary-data.js` se genero cuando solo existian 4 expansiones y adivino
  // la de cada pieza por generacion: Klobjarne Geirr (Janthir Wilds) y Verano
  // Infinito (Visions of Eternity) salian como Path of Fire. Ese archivo pesa
  // 83 KB y no entra en una publicacion de la Factory (LES-028), asi que la
  // correccion vive aca y se aplica al catalogo al cargar: filtros, chips y
  // orden leen el mismo dato.
  //
  // Regla: la expansion es la que hace falta para conseguir la pieza. Si no hace
  // falta ninguna (PvP, WvW, fractales, mejoras gratuitas), es Clasico. Las de
  // segunda generacion que aceptan maestria de HoT o de PoF van con PoF, el ciclo
  // en que salieron. Fuentes (2026-10-21): wiki oficial (Legendary weapon,
  // Legendary trinket, Legendary back item, Legendary armor), GuildJen y Snow Crows.
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
  // Badge de precio TP.
  //
  // QUE CAMBIA (punto 1.1, 2026-10-02): antes era `formatCoinShort()`, que
  // devolvia texto plano ("1.889g") envuelto en un div con borde. Ahora usa
  // el MISMO componente que la Cartera (`app.js:162` `badgesHTMLFromCopper`):
  // las clases `.coin` / `.coin--g` de `main.css:224-232`.
  //
  // POR QUE NO SE INVENTA CSS NUEVO: `.coin` ya existe y ya se ve bien en la
  // Cartera. Lo que faltaba no era el estilo, era que la Armeria no lo
  // usara. Agregar un `.lt-coin` propio seria el camino corto y el que
  // diverge: dos clases para el mismo componente, y un cambio de tema futuro
  // toca una y no la otra.
  //
  // POR QUE SE DESCARTA `formatCoinShort` Y NO SE REAPROVECHA: las dos
  // funciones hacen lo mismo con salidas distintas. `badgesHTMLFromCopper`
  // emite una pastilla por unidad (oro, plata, cobre) y omite las que valen
  // cero; `formatCoinShort` colapsa a la unidad mayor. Para un badge chico
  // en una grilla de 206 cards, la version de una sola pastilla ocupa menos
  // y no muestra "0 s" al lado de "1 g". Se conservan las dos porque la
  // columna de stock del modal de materiales (2.3) si va a querer el
  // desglose completo, y no tiene por que reinventarlo.
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
  // RENDER: BARRA DE FILTROS
  // =======================================================================
  function renderFilterBar(filters, catalog) {
    corregirExpansiones(catalog);
    var opts = getFilterOptions(catalog || []);

    // Type buttons (orden: weapon, armor, trinket, back, upgradecomponent, relic)
    var typeOrder = ['weapon', 'armor', 'trinket', 'back', 'upgradecomponent', 'relic'];
    var typeBtns = typeOrder.map(function (t) {
      var label = TYPE_LABELS[t] || t;
      var count = opts.types[t] || 0;
      var active = filters.type === t;
      return '<button class="lt-filter-btn ' + (active ? 'active' : '') + '" ' +
        'data-ftype="type" data-fvalue="' + t + '" ' +
        'style="padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;cursor:pointer;' +
        'border:' + (active ? '1px solid ' + typeColor({type:t}) : '1px solid var(--bd-1)') + ';' +
        'background:' + (active ? typeColor({type:t}) + '20' : 'var(--bg-1)') + ';' +
        'color:' + (active ? typeColor({type:t}) : 'var(--tx-2)') + ';' +
        'transition:all 0.15s ease;">' +
        esc(label) + ' (' + count + ')</button>';
    });

    // Generation buttons (order: 3, 2, 1)
    var genOrder = [3, 2, 1];
    var genBtns = genOrder.map(function (g) {
      var label = GEN_LABELS[g] || ('Gen ' + g);
      var count = opts.gens[g] || 0;
      var active = String(filters.generation) === String(g);
      return '<button class="lt-filter-btn ' + (active ? 'active' : '') + '" ' +
        'data-ftype="generation" data-fvalue="' + g + '" ' +
        'style="padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;cursor:pointer;' +
        'border:' + (active ? '1px solid #974EFF' : '1px solid var(--bd-1)') + ';' +
        'background:' + (active ? 'rgba(151,78,255,0.2)' : 'var(--bg-1)') + ';' +
        'color:' + (active ? '#974EFF' : 'var(--tx-2)') + ';' +
        'transition:all 0.15s ease;">' +
        esc(label) + ' (' + count + ')</button>';
    });

    // Expansion buttons: en orden de salida (BL-046)
    var expOrder = EXPANSION_ORDER;
    var expBtns = expOrder.map(function (e) {
      var label = EXPANSION_LABELS[e] || e;
      var count = opts.exps[e] || 0;
      var active = filters.expansion === e;
      var color = EXPANSION_COLORS[e] || '#974EFF';
      return '<button class="lt-filter-btn ' + (active ? 'active' : '') + '" ' +
        'data-ftype="expansion" data-fvalue="' + e + '" ' +
        'style="padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;cursor:pointer;' +
        'border:' + (active ? '1px solid ' + color : '1px solid var(--bd-1)') + ';' +
        'background:' + (active ? color + '20' : 'var(--bg-1)') + ';' +
        'color:' + (active ? color : 'var(--tx-2)') + ';' +
        'transition:all 0.15s ease;">' +
        esc(label) + ' (' + count + ')</button>';
    });

    // Botones de posesion: "Tengo" / "Me faltan" (2026-10-02).
  //
  // Los dos comparten `data-ftype="ownership"`, y ESO es lo que los hace
  // excluyentes: el toggle generico de `wireFilterBar` escribe `filters[ft]`,
  // asi que apretar uno sobrescribe al otro. Con dos `data-ftype` distintos los
  // dos podrian quedar apretados a la vez, y el catalogo mostraria la
  // interseccion de dos filtros que el usuario nunca pidio.
  //
  // Los numeros de "Tengo / Me faltan" los PREGUNTA al tracker, y no llegan por
  // parametro. `renderFilterBar(filters, catalog)` tiene la firma del contrato
  // de renderers y esa firma es un contrato con `alert84.t3t4-registro`: leaky
  // un parametro obliga a cambiar el arnés para agregar un dato. Y contarlos
  // aca exige reimplementar el predicado de filtros —duplicarlo es como los
  // dos filtros se desincronicen, que es justo lo que `passesFilters` evita—.
  // El tracker ya es dependencia de este render: se registra ahi y se leen
  // filtros y `owned` por `getState()`.
  var own = { tengo: 0, faltan: 0 };
  if (root.LegendaryTracker && typeof root.LegendaryTracker.getOwnershipCounts === 'function') {
    own = root.LegendaryTracker.getOwnershipCounts() || own;
  }
  var ownBtn = function (value, label, count, color) {
    var active = filters.ownership === value;
    return '<button class="lt-filter-btn ' + (active ? 'active' : '') + '" ' +
      'data-ftype="ownership" data-fvalue="' + value + '" ' +
      'style="padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;cursor:pointer;' +
      'border:' + (active ? '1px solid ' + color : '1px solid var(--bd-1)') + ';' +
      'background:' + (active ? color + '26' : 'var(--bg-1)') + ';' +
      'color:' + (active ? color : 'var(--tx-2)') + ';' +
      'transition:all 0.15s ease;">' +
      esc(label) + ' (' + count + ')</button>';
  };
  // Verde = el tilde de la card; violeta = lo que queda por hacer. Los mismos
  // dos estados que ya distinguen "la tengo" de "no la tengo" en la grilla.
  var ownBtns = ownBtn('tengo', 'Tengo', own.tengo, '#68ff9f') +
    ownBtn('faltan', 'Me faltan', own.faltan, '#974EFF');

  // Clear button (solo si hay filtros activos)
    var hasActive = filters.type || filters.generation || filters.expansion || filters.ownership;
    var clearBtn = hasActive ?
      '<button class="lt-filter-clear" data-action="clear-filters" ' +
      'style="padding:4px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;cursor:pointer;' +
      'border:1px solid var(--bd-1);background:var(--bg-1);color:var(--tx-2);margin-left:auto;">✕ Limpiar</button>' :
      '';

    return '<div class="lt-filter-bar" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<span style="font-size:0.65rem;color:var(--tx-3);padding:4px 8px;">Tipo:</span>' +
        typeBtns.join('') +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<span style="font-size:0.65rem;color:var(--tx-3);padding:4px 8px;">Gen:</span>' +
        genBtns.join('') +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<span style="font-size:0.65rem;color:var(--tx-3);padding:4px 8px;">Exp:</span>' +
        expBtns.join('') +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<span style="font-size:0.65rem;color:var(--tx-3);padding:4px 8px;">Yo:</span>' +
        ownBtns +
      '</div>' +
      clearBtn +
    '</div>';
  }

  // =======================================================================
  // RENDER: GRID DEL CATÁLOGO (5 COLUMNAS)
  // =======================================================================
  // La cola se lee UNA vez por grilla y se pasa a cada card. `getQueue()` ya era
  // parte de la API publica del tracker; la firma de `renderCatalogGrid` queda
  // como la del contrato.
  function colaActual() {
    if (root.LegendaryTracker && typeof root.LegendaryTracker.getQueue === 'function') {
      return root.LegendaryTracker.getQueue() || [];
    }
    return [];
  }

  // `queue` es la cola de crafteo, y viaja hasta la card para que el boton de
  // encolar pueda decir EN QUE ESTADO esta sin que el usuario abra el modal.
  function renderCatalogGrid(items, owned) {
    if (!items || items.length === 0) {
      return '<div class="lt-empty-state" style="text-align:center;padding:32px;color:var(--tx-3);">' +
        '<div style="font-size:0.8rem;">No se encontraron legendarias con los filtros aplicados.</div>' +
        '<div style="font-size:0.7rem;margin-top:4px;">Intentá limpiar los filtros.</div>' +
        '</div>';
    }

    // Agrupada por expansion, en orden de salida; dentro de cada una se
    // conserva el orden del catalogo (BL-046).
    var ordenados = items.map(function (it, i) { return { it: it, i: i }; });
    ordenados.sort(function (a, b) {
      return (ordenExpansion(expansionReal(a.it)) - ordenExpansion(expansionReal(b.it))) || (a.i - b.i);
    });

    var cola = colaActual();
    var cards = ordenados.map(function (x, idx) {
      return renderItemCard(x.it, owned, idx, cola);
    });

    return '<div class="lt-catalog-grid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">' +
      cards.join('') +
    '</div>';
  }

  // `queue` es la cola de crafteo. La vista de progreso (`renderProgress`)
  // llama a esta funcion con 3 argumentos, asi que el default no es cosmetico:
  // sin el, un item de la vista de progreso lee `queue.indexOf` de `undefined`
  // y la vista de progreso deja de pintar entera.
  function renderItemCard(item, owned, idx, queue) {
    var cola = queue || [];
    var enCola = cola.indexOf(Number(item.id)) !== -1;
    var isOwned = !!(owned[item.id] && owned[item.id] > 0);
    var tColor = typeColor(item);
    var eColor = expansionColor(item);
    var gLabel = genLabel(item);
    var owns = isOwned ? (owned[item.id] || 1) : 0;

    // Overlay de estado
    var statusOverlay;
    if (isOwned) {
      statusOverlay = '<div class="lt-status-badge" style="position:absolute;top:6px;right:6px;' +
        'background:rgba(104,255,163,0.12);border:1px solid rgba(104,255,163,0.4);' +
        'border-radius:999px;padding:2px 8px;font-size:0.58rem;color:#68ff9f;font-weight:700;">✓</div>';
    } else {
      statusOverlay = '<div class="lt-status-badge" style="position:absolute;top:6px;right:6px;' +
        'background:rgba(255,255,255,0.06);border:1px solid var(--bd-1);' +
        'border-radius:999px;padding:2px 8px;font-size:0.58rem;color:var(--tx-3);">PENDING</div>';
    }

    // Badge TP (solo si tradeable)
    //
    // El wrapper `lt-tp-badge` conservaba su fondo/borde/padding INLINE, y
    // al meter adentro una pastilla `.coin` (que ya trae fondo, borde y
    // padding de main.css) quedaban dos cajas anidadas: un borde dentro de
    // otro borde, con el doble de padding. Por eso el wrapper solo aporta
    // `gap` entre unidades y el `font-size` chico de la grilla; el resto lo
    // pone `.coin`. Es el mismo criterio que usa la Cartera.
    var tpBadge = '';
    if (item.tpTradeable && item.tpSell > 0) {
      tpBadge = '<div class="lt-tp-badge" title="Precio TP (venta directa)" ' +
        'style="display:inline-flex;align-items:center;gap:4px;font-size:0.62rem;">' +
        tpCoinHTML(item.tpSell) + '</div>';
    }

    // Badges de tipo, gen, exp
    var badges = '<div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap;">' +
      '<span style="font-size:0.62rem;font-weight:600;background:' + tColor + '20;border:1px solid ' + tColor + '40;' +
      'border-radius:4px;padding:1px 6px;color:' + tColor + ';">' + esc(typeLabel(item)) + '</span>';

    if (gLabel !== '—') {
      badges += '<span style="font-size:0.6rem;color:var(--tx-3);font-weight:500;">' + esc(gLabel) + '</span>';
    }

    badges += '<span style="font-size:0.62rem;font-weight:600;background:' + eColor + '20;border:1px solid ' + eColor + '40;' +
      'border-radius:4px;padding:1px 6px;color:' + eColor + ';">' + esc(expansionLabel(item)) + '</span>';

    if (item.tpTradeable) {
      badges += '<span title="Tradeable en TP" style="font-size:0.6rem;opacity:0.6;">💎</span>';
    }

    badges += '</div>';

    // Nombre display (español si existe)
    var displayName = item.nameEs || item.name;

    // Boton de encolar, DENTRO de la card (2026-10-02).
    //
    // Va dentro a proposito: la card abre el arbol y el boton encola, asi que
    // el click del boton tiene que GOLPEAR la card para que no abra el modal al
    // mismo tiempo. `wireItemCards` lo intercepta antes de llegar a la card.
    //
    // El texto corto y el `title` largo no son dos mensajes distintos: el texto
    // es lo que entra en 5 columnas, y el `title` + `aria-label` son el texto
    // EXACTO del modal ("Quitar de la cola" / "Agregar a la cola"), que es lo
    // que el usuario necesita para saber el estado sin abrir nada. Un boton
    // que solo dice "+ Cola" cuando el item ya esta encolado es un boton que
    // obliga a abrir el modal para averiguarlo.
    var textoCola = enCola ? 'Quitar de la cola' : 'Agregar a la cola';
    var queueBtn = '<div style="margin-top:6px;display:flex;justify-content:flex-end;">' +
      '<button type="button" class="lt-card-queue-btn" data-card-queue="' + item.id + '" ' +
      'title="' + textoCola + '" aria-label="' + textoCola + '" ' +
      'style="padding:2px 8px;border-radius:999px;font-size:0.58rem;font-weight:600;cursor:pointer;' +
      'white-space:nowrap;border:1px solid ' + (enCola ? '#974EFF' : 'var(--bd-1)') + ';' +
      'background:' + (enCola ? 'rgba(151,78,255,0.18)' : 'rgba(255,255,255,0.06)') + ';' +
      'color:' + (enCola ? '#974EFF' : 'var(--tx-3)') + ';">' +
      (enCola ? '✓ En la cola' : '+ Cola') + '</button></div>';

    return '<div class="card lt-item-card" data-id="' + item.id + '" data-type="' + esc(item.type) + '" ' +
      'style="position:relative;cursor:pointer;padding:10px;border-radius:12px;' +
      'border-left:3px solid #974EFF;' +
      'animation-delay:' + (idx * 0.02) + 's">' +
      statusOverlay +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:40px;height:40px;border-radius:6px;background:var(--bg-1);display:flex;' +
        'align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' +
          '<img src="' + esc(item.icon || '') + '" width="36" height="36" alt="' + esc(displayName) + '" ' +
          'style="border-radius:4px;object-fit:contain;" loading="lazy" referrerpolicy="no-referrer">' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;font-size:0.8rem;color:var(--tx-1);overflow:hidden;' +
          'text-overflow:ellipsis;white-space:nowrap;" title="' + esc(displayName) + '">' + esc(displayName) + '</div>' +
          badges +
        '</div>' +
      '</div>' +
      (tpBadge ? '<div style="margin-top:6px;">' + tpBadge + '</div>' : '') +
      queueBtn +
      '</div>';
  }

  // =======================================================================
  // RENDER: PROGRESS VIEW
  // =======================================================================
  function renderProgress(state, stats) {
    var catalog = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];

    // QUE CAMBIA (punto 2.2, 2026-10-02): antes el render elegia sus propios
    // items con `catalog.filter(owned)`. Ahora RECIBE la lista ya recortada en
    // `state.items`, porque el recorte depende de dos cosas que el render no
    // tiene: los filtros que viven en el tracker y el alcance del switch.
    // Que el tracker decida el conjunto y el render solo lo pinte es lo que
    // hace que "Armas" muestre lo mismo en Catalogo y en Mi progreso.
    //
    // Se conserva el fallback a `owned` para cuando `state.items` no venga
    // (un consumidor viejo que llame a `progress()` con la firma anterior).
    // Sin ese fallback, ese consumidor veria una grilla vacia en vez de un
    // error: el modo de fallo silencioso.
    var items;
    if (Array.isArray(state.items)) {
      items = state.items.slice();
    } else {
      items = catalog.filter(function (item) {
        return state.owned[item.id] && state.owned[item.id] > 0;
      });
    }

    // Ordenar por rareza de progreso (no owned primero en catálogo, owned primero en progreso)
    items.sort(function (a, b) {
      return (a.nameEs || a.name).localeCompare(b.nameEs || b.name, 'es');
    });

    if (items.length === 0) {
      // El mensaje viejo decía SIEMPRE "Aún no poseés ninguna legendaria".
      // Con el switch y los filtros queda mentira en dos casos reales: si el
      // alcance es "Solo faltantes" y no falta ninguna, o si un filtro dejó la
      // lista vacia. Un empty state que afirma algo falso es peor que no
      // tener ninguno: el usuario cree que la API fallo.
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
      '<div class="lt-progress-grid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">' +
        cards.join('') +
      '</div>';
  }

  // =======================================================================
  // RENDER: SKELETON (LOADING)
  // =======================================================================
  // =======================================================================
  // RENDER: MODAL DE MATERIALES (ARME 1.2)
  // =======================================================================
  //
  // Recibe lo que calcula `computeMaterials` y lo pinta. El corte es el mismo
  // que los otros cuatro renders: aqui no se consulta la API ni se decide
  // nada de negocio, solo se dibuja.
  //
  // Los cuatro status se dibujan DISTINTOS a proposito. Un modal que para
  // 'no_recipe', 'placeholder' y 'unknown' dijera lo mismo seria un filtro
  // invisible: el dia que GW2 renombre el item 95093, el filtro dejaria de
  // matchear y nadie lo veria.
  function renderItemModal(datos, item) {
    if (!datos) {
      return '<div style="padding:18px;color:var(--tx-3);font-size:0.78rem;">Sin datos.</div>';
    }

    // Los tres status "sin fila" muestran el motivo, y el motivo es lo que
    // dice el contrato (o el tracker si el contrato no esta). No se inventa
    // texto aca: duplicar el motivo es la forma de que los dos se desincronicen.
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
    '<div class="lt-catalog-grid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">' +
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
    TYPE_LABELS: TYPE_LABELS
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
