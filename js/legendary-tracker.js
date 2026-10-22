/*!
 * js/legendary-tracker.js — Armería Legendaria
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.3.0 (2026-10-22) — BL-049: la legendaria se abre como PANTALLA dentro
 *   de la Armería (reemplaza al catálogo, con "Volver" y Escape), no en un
 *   diálogo. Íconos: primero los del árbol abierto; si el camino normal
 *   (ItemIcons) no responde en 6 s o vuelve vacío, se piden directo a la API
 *   con tiempo límite; y si igual fallan, la pantalla lo dice con "Reintentar".
 * Versión: 1.2.0 (2026-10-21) — BL-047: la legendaria se abre en una FICHA de
 *   pantalla completa (antes un modal de 680 px): cabecera grande con ícono,
 *   tipo, expansión y generación, resumen, y Receta y Materiales totales lado a
 *   lado (LegendaryTreeUI.renderSheetHTML). Ícono y nombre en español con
 *   respaldo del catálogo cuando la API todavía no los trajo.
 * Versión: 1.1.1 (2026-10-21) — BL-045: "Tengo" de Materiales totales lee el banco
 *   y el almacén de materiales (stockMap), no las legendarias desbloqueadas.
 * Versión: 1.1.0 (2026-09-30) — T3+T4 (ALERT-84): contrato de registro + render real
 *
 * Módulo que reemplaza al filtro Legendario dentro de Logros (achievements.js).
 * Proporciona un catálogo completo de armas/armaduras/trinketes legendarios
 * y un "Mi progreso" con seguimiento de componentes y precios TP.
 *
 * Ruta: #/account/legendary-armory
 * Persistencia: prefijo gn:legendary:
 *
 * Dependencias:
 *  - GW2Api.getAccountLegendaryArmory() — legendarias desbloqueadas
 *  - GW2Api.getItemsMany()              — detalles de ítems (nombre, icono, tipo)
 *  - GW2Api.getCommercePrices()          — precios TP (buy/sell)
 *  - GW2Api.getAccountBank()             — inventario del banco
 *  - GW2Api.getAccountMaterials()        — almacen de materiales
 *  - legendary-data.js                   — catálogo estático de legendarias (Phase 2)
 */

(function (root) {
  'use strict';

  var LOG = '[LegendaryTracker]';
  // 1.1.0 (ALERT-84 T3+T4): la puerta de registro existe y el render usa las
  // funciones registradas. NO es la T3 completa del PO (sigue sin datos de API:
  // loadLegendaryData() es un stub) — es el CONTRATO y el cableado.
  var VER = '1.3.0';

  // ========================================================================
  // 1. CONFIGURACIÓN / ESTADO
  // ========================================================================

  var STORAGE_PREFIX = 'gn:legendary:';

  // Contrato T4 (ALERT-84). Son las 4 claves que `render-catologo.js` entrega en
  // su `registerRender`, y el orden importa solo para el informe: no se ordena.
  //
  // POR QUE ESTA LISTA Y NO "lo que venga": `registerRender` sin lista aceptaria
  // un objeto con 1 clave y pondria el flag en true. El pipeline creeria que hay
  // contrato donde hay un hueco, y el hueco se descubre al PINTAR — que es tarde
  // y en la pantalla del usuario. Un registro parcial tiene que ser
  // indistinguible de NINGUN registro, y eso se consigue rechazandolo.
  var REQUIRED_RENDERERS = ['filterBar', 'catalogGrid', 'skeleton', 'progress'];

  // Límites de posesión por tipo (según spec)
  var POSSESSION_LIMITS = {
    weapon: 3,
    armor: 6,
    accessory: 5,
    back: 2
  };

  // Modos de vista
  var MODES = {
    CATALOG: 'catalog',      // Grid 5 columnas estilo InventoryHub
    PROGRESS: 'progress'     // Filas colapsables estilo Raid/Strike Tracker
  };

  // Estado interno
  var state = {
    inited: false,
    active: false,
    // 1.2. El render del modal de materiales entra por una puerta PROPIA y no
    // como quinta clave de REQUIRED_RENDERERS: ese registro es un candado que
    // rechaza lo incompleto a proposito (ALERT-84 T4), y agregar una clave
    // obligaria a un consumidor viejo a registrarla para poder pintar.
    itemModalRenderer: null,
    openItemId: null,
    mode: MODES.CATALOG,       // modo activo
    token: null,
    armory: [],               // legendarias desbloqueadas (del API)
    items: {},                // cache de items (id -> detalle)
    prices: {},               // cache de precios TP (itemId -> price)
    // Los tres de abajo los devuelve la API como ARRAY de slots, no como mapa
    // {id: count}. Antes se declaraban `{}` y el stub nunca los llenaba, asi
    // que el tipo nunca se Noto. Ahora se llenan de verdad y cualquier
    // consumidor que los lea tiene que tratar arrays — por eso se corrige el
    // tipo aca y no se deja que lo descubra el primer `.forEach`.
    materials: [],            // /v2/account/materials
    bank: [],                 // /v2/account/bank
    characterItems: [],       // inventarios de los personajes (aun no se pide)
    // "No pude leer" != "no tenes". Vacio = todo leido bien. Cada entrada es el
    // nombre de una fuente que FALLO, y se muestra al usuario en vez de dejar
    // que una key expirada se vea como una cuenta vacia.
    readErrors: [],
    loading: false,
    error: null,
    // T4: las funciones de render registradas por `render-catologo.js`. Null
    // hasta que ese script se carga y registra. Es un punto de observabilidad
    // DISTINTO del del catálogo (`root.LegendaryCatalog`, que se autoexpone al
    // cargarse): los dos pueden volverse falsos por separado, y por eso son
    // dos asserts y no uno.
    renderers: null,
    // Lo que le faltó al ÚLTIMO registro rechazado. Sin esto, `missing` tendría
    // que mentir: después de un intento parcial no hay contrato, y la pregunta
    // útil es "que le faltaba", no "que le falta a un contrato que nunca existió".
    _renderMissing: REQUIRED_RENDERERS.slice(),
    _refreshInFlight: null,
    // Cola de crafteo (paso 5). Es un array de ids EN ORDEN DE AGREGADO, no
    // un Set: el orden es lo que le da el "peso visual" a las 3 primeras y lo
    // que hace que quitar y volver a agregar la devuelva al final.
    queue: []
  };

  // Filtros activos. Los consume `renderFilterBar(filters, catalog)`; los
  // aplica `catalogItems()`.
  //
  // Catalogo y "Mi progreso" aplican los mismos filtros (punto 2.2). `ownership`
  // es "Tengo / Me faltan" del catalogo; arranca apagado (null).
  var filters = { type: null, generation: null, expansion: null, ownership: null };

  // Alcance de "Mi progreso" (punto 2.2). Es estado PROPIO y no un cuarto
  // filtro, porque responde otra pregunta: los tres de arriba eligen "de que
  // tipo", este elige "de cuales de esos me interesan".
  //   'unlocked' -> solo las que ya tengo
  //   'missing'  -> solo las que me faltan
  // No aplica al Catalogo: ahi se ve el catalogo entero, y "solo faltantes"
  // sobre un catalogo completo es "todo", o sea un switch que no cambia nada
  // visible. Por eso vive fuera de `filters` y no se dibuja ahi.

  // ========================================================================
  // 2. UTILIDADES
  // ========================================================================

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function getSelectedToken() {
    var s = el('keySelectGlobal');
    return s ? (s.value || '').trim() : null;
  }
  function el(id) { return document.getElementById(id); }

  function sSet(key, val) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val)); } catch (_) {}
  }
  function sGet(key) {
    try { var j = localStorage.getItem(STORAGE_PREFIX + key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }

  // Maximo de la cola. El plan lo fija en 5 y aclara que NO es el objetivo de
  // posesion del PO (16): 5 es foco, 16 es inventario. Son cosas distintas.
  var QUEUE_MAX = 5;
  var QUEUE_KEY = 'queue';

  // Normaliza lo que llega de localStorage a un array de ids enteros POSITIVOS,
  // sin duplicados y con tope. Todo lo que se pueda corregir se corrige solo:
  // una cola persistida con basura no puede dejar la vista sin pintar, y el
  // modulo ya decidio que "no pude leer" se muestra en vez de parecerse a vacio.
  function sanitizeQueue(raw) {
    var out = [], seen = {};
    if (!Array.isArray(raw)) return out;
    for (var i = 0; i < raw.length && out.length < QUEUE_MAX; i++) {
      var n = Number(raw[i]);
      if (!isFinite(n) || n <= 0 || Math.floor(n) !== n) continue;
      if (seen[n]) continue;
      seen[n] = true;
      out.push(n);
    }
    return out;
  }

  function loadQueue() {
    state.queue = sanitizeQueue(sGet(QUEUE_KEY));
    return state.queue.slice();
  }

  function saveQueue() {
    sSet(QUEUE_KEY, state.queue);
  }

  // Agrega o quita. Devuelve {ok, reason, queue} para que el que llama pueda
  // distinguir "no se pudo" de "no se quiso": reason es 'llena', 'ya-estaba'
  // o null en el camino de agregado.
  //
  // NO se valida craftType aqui. La pregunta "puede una legendaria SIN receta
  // estar en la cola" es de ALCANCE y esta enviada al Reviewer; hasta que
  // responda, la cola acepta cualquiera y el modal muestra el estado real
  // (craftType none = se puede agregar, no se puede fabricar). Cambiar esta
  // decision despues es UNA linea, y el test la fija en vez de suponerla.
  function toggleQueue(itemId) {
    var id = Number(itemId);
    // El entero se exige ACA y no solo en `sanitizeQueue`: sin esta linea un
    // id fraccionario (1.5) entra vivo, se persiste, y desaparece en la
    // recarga. Dos validadores que no coinciden hacen que la cola pierda items
    // sola, y "perdio uno" es el bug mas dificil de ver de este modulo.
    if (!isFinite(id) || id <= 0 || Math.floor(id) !== id) {
      return { ok: false, reason: 'id-invalido', queue: state.queue.slice() };
    }

    var at = state.queue.indexOf(id);
    if (at !== -1) {
      state.queue.splice(at, 1);
      saveQueue();
      return { ok: true, reason: null, added: false, queue: state.queue.slice() };
    }
    if (state.queue.length >= QUEUE_MAX) {
      return { ok: false, reason: 'llena', queue: state.queue.slice() };
    }
    state.queue.push(id);
    saveQueue();
    return { ok: true, reason: null, added: true, queue: state.queue.slice() };
  }

  // Los items de la cola, en orden, ya resueltos contra el catalogo.
  // Un id que ya no esta en el catalogo se SALTA en vez de romper: el
  // catalogo puede cambiar entre versiones y la cola es del usuario.
  function queueItems() {
    var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    var byId = {};
    cat.forEach(function (it) { byId[it.id] = it; });
    return state.queue.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function toast(msg, type) {
    var t = type || 'info';
    var detail = {
      message: msg,
      duration: t === 'success' ? 4000 : 3500,
      type: t
    };
    document.dispatchEvent(new CustomEvent('gn:toast', { detail: detail }));
  }

  // ========================================================================
  // 3. SKELETON DOM — estructura vacía con toggle
  // ========================================================================

  function ensurePanelContent() {
    var body = $('#legendaryArmoryBody');
    if (!body) return;

    // Si ya fue inicializado, no volver a inyectar
    if (body.getAttribute('data-initialized') === 'true') return;

    body.innerHTML = ''
      + '<div class="legendary-view-toggle" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">'
      +   '<span class="legendary-mode-label" style="font-size:0.77rem;color:var(--text-secondary);">Modo:</span>'
      +   '<button id="legendaryModeCatalog" class="btn btn--ghost btn--small" data-mode="catalog">'
      +     '<span class="btn__label">Catálogo</span>'
      +   '</button>'
      +   '<button id="legendaryModeProgress" class="btn btn--ghost btn--small" data-mode="progress">'
      +     '<span class="btn__label">Mi progreso</span>'
      +   '</button>'
      + '</div>'
      + '<div id="legendaryModeContent" class="legendary-mode-content">'
      +   '<!-- Contenido dinámico según modo -->'
      +   '<p class="status muted" style="padding:16px;">Seleccioná un modo para comenzar.</p>'
      + '</div>';

    body.setAttribute('data-initialized', 'true');

    wireViewToggle();
  }

  function wireViewToggle() {
    var btns = $$('#legendaryModeCatalog, #legendaryModeProgress');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-mode');
        setMode(mode);
      });
    });
  }

  function setMode(mode) {
    if (mode !== MODES.CATALOG && mode !== MODES.PROGRESS) return;

    state.mode = mode;

    // Persistir modo
    sSet('mode', mode);

    console.log(LOG, 'mode changed to:', mode);

    renderCurrentMode();
  }

  // ========================================================================
  // 3b. RENDER — usa lo que `render-catologo.js` registró (ALERT-84 T3)
  // ========================================================================
  //
  // La cadena anterior era:
  //
  //     doRefresh() -> loadLegendaryData()   // stub, resuelve [] en microsegundos
  //                 -> renderCatalogSkeleton()   // "modulo en construccion"
  //
  // El stub resuelve, no rechaza, y no hay timeout ni reintento: el ciclo
  // termina y lo que queda pintado es un mensaje que nunca se va. Un error se
  // investiga; un mensaje estatico coopera con el lector y lo hace creer que
  // hay algo que esperar.
  //
  // Ahora: si hay renderers registrados, se pintan ellos. Si NO los hay (el
  // script no se cargo, o registro a medias y fue rechazado), se vuelve al
  // mensaje honesto — y `state.renderersRegistered` queda en false, que es lo
  // que permite distinguir "el modulo todavia no esta" de "el modulo se rompio".
  // Predicado de filtro, separado de la fuente, para que Catalogo y Progreso
  // apliquen EXACTAMENTE la misma regla (punto 2.2). Antes estaba embebido en
  // `catalogItems()` y por eso el progreso no lo podia reutilizar sin
  // duplicarlo: duplicar un filtro es como se desincronizan dos filtros.
  // El filtro de posesion usa EXACTAMENTE la senal que ya esta en la card:
  // `owned[id] > 0` es lo que hace que `renderItemCard` pinte el tilde verde en
  // vez de "PENDING". Si el filtro usara otra cosa, "Tengo" y el tilde
  // contarian cosas distintas y el usuario veria un boton que no cuadra con lo
  // que tiene enfrente.
  //
  // `ignoreOwnership` existe para `ownershipCounts`: el boton tiene que contar
  // sobre el subconjunto que YA pasan tipo/gen/exp, y no sobre el que todavia
  // incluye el propio filtro de posesion.
  function passesFilters(item, owned, ignoreOwnership) {
    if (!item) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.generation && String(item.generation) !== String(filters.generation)) return false;
    if (filters.expansion && item.expansion !== filters.expansion) return false;
    if (!ignoreOwnership && filters.ownership) {
      var laTengo = !!(owned && owned[item.id] > 0);
      if (filters.ownership === 'tengo' && !laTengo) return false;
      if (filters.ownership === 'faltan' && laTengo) return false;
    }
    return true;
  }

  // Cuantos hay de cada lado, para lo que imprimen los botones. Los cuenta el
  // tracker y no el render: el render ya recibio la lista recortada y si los
  // contara el tendria que reimplementar el filtro para saber el denominador.
  function ownershipCounts(owned) {
    var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    var base = cat.filter(function (it) { return passesFilters(it, owned, true); });
    var n = 0;
    base.forEach(function (it) { if (owned && owned[it.id] > 0) n++; });
    return { tengo: n, faltan: base.length - n, total: base.length };
  }

  function catalogItems(owned) {
    var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    return cat.filter(function (it) { return passesFilters(it, owned); });
  }

  // Que items muestra "Mi progreso": los que pasan los filtros DE PRIMERO, y
  // despues el alcance. El orden importa y es el correcto: el switch es una
  // segunda capa sobre un conjunto ya recortado. Al reves, "Solo faltantes" con
  // filtro de Armas traeria las armas que faltan entre TODAS, y el filtro
  // actua como si no se hubiera tocado.

  // `owned` es {id: count}. El stub de API no trae nada, asi que hoy es {} y la
  // vista de progreso pinta su estado vacio honesto ("aun no posees ninguna").
  function ownedMap() {
    var m = {};
    (state.armory || []).forEach(function (it) {
      var id = typeof it === 'object' ? (it.id || it.item_id) : it;
      if (id) m[id] = (m[id] || 0) + 1;
    });
    return m;
  }

  function catalogStats(items, owned) {
    var total = items.length;
    var n = 0;
    items.forEach(function (item) { if (owned[item.id] > 0) n++; });
    return { owned: n, total: total, pct: total ? Math.round((n / total) * 100) : 0 };
  }

  // ========================================================================
  // 1.2 -- MATERIALES DE UNA LEGENDARIA
  // ========================================================================
  //
  // El catalogo decia 206 items y el banco/materiales de la cuenta ya se
  // pedian (loadLegendaryData) pero NO se leian nunca: dos fuentes a la vista
  // y un puente sin construir. Esto lo construye.
  //
  // Lo que NO se hace aqui, y es deliberado: la cola de crafteo. Esta funcion
  // responde "de que se hace y que me falta" para UNA legendaria; si la cola
  // entra, se apoya en esta y no la reimplementa.

  // Inventario agregado de las TRES fuentes de stock de una cuenta.
  //
  // Se SUMAN y no se elige una: un material puede estar partido entre el banco
  // y la bolsa de un personaje, y tomar el maximo (o el primero) rompe justo en
  // el caso donde el jugador esta mas cerca de poder fabricar. Un id que
  // aparece en dos fuentes cuenta una sola vez con el total, que es lo que
  // "tengo" significa para un contador.
  function stockMap() {
    var m = {};
    var meter = function (arr) {
      (arr || []).forEach(function (it) {
        if (!it) return;
        var id = typeof it === 'object' ? (it.id || it.item_id) : it;
        var c = typeof it === 'object' ? Number(it.count || 0) : 0;
        if (!id || !(c > 0)) return;
        m[id] = (m[id] || 0) + c;
      });
    };
    meter(state.bank);
    meter(state.materials);
    meter(state.characterItems);
    return m;
  }

  // Calcula los materiales de una legendaria. NO toca el DOM: devuelve datos.
  //
  // Los cuatro status NO son dos con nombre distinto, y esa es la parte que el
  // plan de noche pide explicita ("un filtro invisible que un dia deja de
  // matchear y no dice nada es un bug futuro"):
  //
  //   recipe      -- hay receta y materiales que comparar
  //   no_recipe   -- el id existe y se verifico, la fuente no publica receta
  //   placeholder -- el 95093, que es el marcador de cuenta y no una pieza
  //   unknown     -- el id no esta en el contrato. NO es "sin receta": es un
  //                  dato que no tenemos, y las dos cosas se responden distinto
  //
  // Un modal que seccionara estos cuatro a "no hay nada que mostrar" seria el bug.
  function computeMaterials(itemId) {
    var id = Number(itemId);
    var R = root.LegendaryRecipes;

    if (!R || typeof R.get !== 'function') {
      return { status: 'unknown', itemId: id, craftType: null, rows: [], disciplines: [],
               note: 'El contrato de fabricacion no esta cargado.' };
    }

    var e = R.get(id);

    // Ausencia de la clave: id desconocido. Es el unico caso que devuelve
    // 'unknown', y a proposito NO se fusiona con 'no_recipe'.
    if (!e) {
      return { status: 'unknown', itemId: id, craftType: null, rows: [], disciplines: [],
               note: 'Esta pieza no esta en el catalogo de legendarias.' };
    }

    var base = {
      itemId: id,
      craftType: e.craftType || null,
      disciplines: (e.disciplines || []).slice(),
      rows: [],
      note: null
    };

    if (e.dataStatus === 'placeholder') {
      base.status = 'placeholder';
      // `R.placeholder` es un OBJETO {id, name, note}, no la frase. Asignarlo
      // directo metia un [object Object] en pantalla: el arnes de este ciclo
      // lo cazó porque el stub del test es una copia de la forma real.
      base.note = (R.placeholder && R.placeholder.note) ||
        'Marcador de cuenta, no una legendaria.';
      return base;
    }

    if (e.dataStatus === 'no_recipe') {
      base.status = 'no_recipe';
      base.note = R.noRecipeNote || 'La fuente no publica receta para esta pieza.';
      return base;
    }

    var stock = stockMap();
    var ings = e.ingredients || [];
    var totNeed = 0, totHave = 0, totMissing = 0;

    ings.forEach(function (ing) {
      var need = Math.max(0, Number(ing.count || 0));
      // stockMap() ya garantiza > 0, pero el clamp queda porque 'have' se
      // muestra al lado de 'need' y un negativo ahi se lee como bug del juego.
      var have = Math.max(0, stock[ing.itemId] || 0);
      var missing = Math.max(0, need - have);
      var estado = missing === 0 ? 'ok' : (have > 0 ? 'partial' : 'missing');

      totNeed += need; totHave += Math.min(have, need); totMissing += missing;

      base.rows.push({
        itemId: ing.itemId,
        name: ing.name || ('#' + ing.itemId),
        need: need,
        have: Math.min(have, need),
        stock: have,
        missing: missing,
        state: estado
      });
    });

    base.status = 'recipe';
    base.totals = { need: totNeed, have: totHave, missing: totMissing };
    base.allHave = totMissing === 0;
    return base;
  }

  // La legendaria se abre como PANTALLA dentro de la Armería (BL-049). Pablo
  // probó el modal de 680 px y la ficha en diálogo de 96vw y en los dos casos
  // la receta quedaba chica. Ahora la ficha ocupa el lugar del catálogo, con la
  // página entera para la receta, y "Volver" lo trae de vuelta donde estaba.
  // Los ids `ltFichaTitle` / `ltFichaActions` / `ltFichaBody` son los que pinta
  // `pintarModalLegendaria`.
  var _scrollAntes = 0;

  function ensureItemModal() {
    var host = document.getElementById('ltFicha');
    if (host) return host;
    var body = $('#legendaryArmoryBody');
    if (!body) return null;
    host = document.createElement('section');
    host.id = 'ltFicha';
    host.className = 'lt-ficha';
    host.hidden = true;
    host.setAttribute('aria-labelledby', 'ltFichaTitle');
    host.innerHTML =
      '<div class="lt-ficha__bar">' +
        '<button type="button" class="lt-back" data-close="1">← Volver a la Armería</button>' +
        '<span class="lt-ficha__crumb">Armería legendaria · Receta</span>' +
      '</div>' +
      '<header class="lt-ficha__head">' +
        '<div id="ltFichaTitle" class="lt-ficha__title">Legendaria</div>' +
        '<div id="ltFichaActions" class="lt-ficha__actions"></div>' +
      '</header>' +
      '<div id="ltFichaIcons"></div>' +
      '<div id="ltFichaBody"></div>';
    body.appendChild(host);

    // Un solo listener para toda la pantalla, igual que antes en el modal.
    host.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;

      if (t.getAttribute('data-close') === '1') { closeItemModal(); return; }

      // Pestañas (pantalla angosta): cambian qué panel se ve.
      var v = t.getAttribute('data-lt-view');
      if (v) { vistaModal = v; pintarModalLegendaria(); return; }

      var q = t.getAttribute('data-lt-queue');
      if (q) {
        var res = encolarConAviso(q);
        if (!res.ok) return;
        pintarModalLegendaria();
        renderCurrentMode();
        return;
      }

      if (t.getAttribute('data-lt-retry') === '1') {
        var UI = root.LegendaryTreeUI;
        if (UI) {
          UI._resetCache();
          UI.ensurePrecursors(function () { pintarModalLegendaria(); });
        }
        pintarModalLegendaria();
        return;
      }

      if (t.getAttribute('data-lt-icons-retry') === '1') {
        pedirIconos(state.openItemId, true);
        return;
      }

      // Nodos del árbol: un listener para todos, no uno por nodo.
      var walk = t;
      while (walk && walk !== host) {
        var nid = walk.getAttribute && walk.getAttribute('data-lt-toggle');
        if (nid) {
          var k = Number(nid);
          if (abiertosArbol[k]) delete abiertosArbol[k]; else abiertosArbol[k] = true;
          pintarModalLegendaria();
          return;
        }
        walk = walk.parentNode;
      }
    });

    // Escape vuelve al catálogo, como cerrar un diálogo.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var h = document.getElementById('ltFicha');
      if (h && !h.hidden) closeItemModal();
    });

    return host;
  }

  // Muestra la pantalla de la legendaria o vuelve al catálogo. El catálogo no
  // se destruye: se oculta, y al volver queda en el mismo lugar del scroll.
  function mostrarFicha(abrir) {
    var host = document.getElementById('ltFicha');
    var toggle = $('#legendaryArmoryBody .legendary-view-toggle');
    var content = $('#legendaryModeContent');
    if (abrir) {
      _scrollAntes = (typeof window !== 'undefined' && window.scrollY) || 0;
      if (toggle) toggle.hidden = true;
      if (content) content.hidden = true;
      if (host) host.hidden = false;
      var panel = el('legendaryArmoryPanel') || host;
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'start' });
      var back = host && host.querySelector('.lt-back');
      if (back && back.focus) back.focus({ preventScroll: true });
    } else {
      if (host) host.hidden = true;
      if (toggle) toggle.hidden = false;
      if (content) content.hidden = false;
      if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, _scrollAntes);
    }
  }

  function closeItemModal() {
    var host = document.getElementById('ltFicha');
    if (!host || host.hidden) return;
    state.openItemId = null;
    mostrarFicha(false);
  }

  // Que vista esta abierta dentro del modal. El arbol es la de entrada porque
  // responde "¿como se hace?", que es la primera pregunta; los totales
  // responden "¿que me falta?", que es la siguiente.
  var vistaModal = 'arbol';

  // Que nodos estan abiertos. Vive FUERA del HTML a proposito: si viviera en
  // el DOM, abrir tres niveles, cerrar el modal y volver a abrirlo arrancaria
  // de nuevo, y el usuario tendria que recorrer el mismo camino cada vez.
  var abiertosArbol = {};

  // NO se llama `renderItemModal` a proposito: ese nombre es del renderer que
  // registra render-catologo.js, y el invariante de hb124 dice que el tracker
  // calcula y el archivo de render pinta. Esta funcion no pinta el catalogo:
  // despacha a LegendaryTreeUI para el arbol o los totales. Con el mismo nombre
  // habria dos cosas distintas con un solo nombre, que es la confusion que ese
  // invariante existe para evitar.
  // Ícono, nombre en español y color de una pieza. Primero lo que trajo la API
  // (ItemIcons); si todavía no llegó o falló, lo que ya tiene el catálogo para
  // las 206 legendarias (icono y nameEs vienen en legendary-data.js). Sin esto
  // la raíz del árbol salía en inglés y sin ícono (captura de Pablo, 23:18Z).
  var _catPorId = null;
  function itemDelCatalogo(iid) {
    if (!_catPorId) {
      var items = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
      if (!items.length) return null;
      _catPorId = {};
      items.forEach(function (x) { _catPorId[String(x.id)] = x; });
    }
    return _catPorId[String(iid)] || null;
  }
  function infoPieza(iid) {
    var Icons = root.ItemIcons;
    var info = Icons && Icons.de ? Icons.de(iid) : null;
    var dir = (typeof _iconosDirectos !== 'undefined') ? _iconosDirectos[String(iid)] : null;
    if (dir && !(info && info.icon)) {
      info = { icon: dir.icon, name: (info && info.name) || dir.name, color: (info && info.color) || dir.color,
        rarity: (info && info.rarity) || null };
    }
    var cat = itemDelCatalogo(iid);
    if (!cat) return info;
    return {
      icon: (info && info.icon) || cat.icon || null,
      name: (info && info.name) || cat.nameEs || cat.name || null,
      color: (info && info.color) || '#974EFF',
      rarity: (info && info.rarity) || null
    };
  }
  function metaCabecera(id) {
    var item = itemDelCatalogo(id);
    var info = infoPieza(id) || {};
    var CUI = root.LegendaryCatalogUI;
    var exp = item ? ((CUI && CUI.expansionReal) ? CUI.expansionReal(item) : item.expansion) : null;
    return {
      name: info.name || (item ? (item.nameEs || item.name) : '#' + id),
      icon: info.icon || null,
      color: info.color || 'var(--tx-1)',
      tipo: item && CUI && CUI.TYPE_LABELS ? (CUI.TYPE_LABELS[item.type] || item.type) : (item ? item.type : null),
      expansion: exp,
      generation: item ? item.generation : null
    };
  }

  function pintarModalLegendaria() {
    var body = document.getElementById('ltFichaBody');
    var actions = document.getElementById('ltFichaActions');
    var avisoIconos = document.getElementById('ltFichaIcons');
    if (!body) return;
    var id = state.openItemId;
    var UI = root.LegendaryTreeUI;
    var T = root.LegendaryTree;

    // Sin motor o sin vista: NO es un estado de carga. Decir "cargando" seria
    // mentir y ademas rompe el invariante de que el tracker no pinta
    // placeholders (alert84.leyenda-estado-honesto.test.js).
    if (!UI || !T) {
      body.innerHTML = '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;">' +
        'La vista de materiales no esta disponible todavia.</div>';
      return;
    }

    var res = T.build(id);

    // `de` lo aporta `ItemIcons` y es el MISMO para el arbol y para la tabla:
    // los dos lo piden al mismo resolvedor, no hay dos caminos. Si todavia no
    // esta, `de` es null y la vista dibuja sin icono y sin color, que es lo
    // que tiene que pasar mientras la red responde o si nunca responde.
    var opts = {
      esc: esc,
      abiertos: abiertosArbol,
      vista: vistaModal,
      de: infoPieza
    };

    // La cabecera grande se repinta con la ficha: cuando llegan los íconos de
    // la API, también cambia el de la cabecera.
    var titleEl = document.getElementById('ltFichaTitle');
    if (avisoIconos && UI.renderIconStatusHTML) avisoIconos.innerHTML = UI.renderIconStatusHTML(estadoIconos);
    if (titleEl && UI.renderHeroHTML) titleEl.innerHTML = UI.renderHeroHTML(metaCabecera(id), esc);

    // Ficha completa (BL-047): Receta y Materiales totales lado a lado.
    // "Tengo" es el inventario de materiales (stockMap, BL-045).
    if (UI.renderSheetHTML) body.innerHTML = UI.renderSheetHTML(res, stockMap(), opts);
    else body.innerHTML = (vistaModal === 'totales')
      // "Tengo" es el inventario de materiales (banco + almacen), no las
      // legendarias desbloqueadas: con ownedMap() la columna salia siempre en 0
      // (BL-045, tests/legendary-totals-stock.test.cjs).
      ? UI.renderTotalsHTML(res, stockMap(), opts)
      : UI.renderTreeHTML(res, opts);

    // El boton de la cola va en el HEADER. No en el pie: Frostfang son 55
    // nodos, y con el boton abajo agregar a la cola seria un trabajo de cuatro
    // clics, o sea la Armeria mas lenta y no mas rapida.
    if (actions) {
      var enCola = state.queue.indexOf(Number(id)) !== -1;
      var btn = 'padding:5px 11px;border-radius:20px;font-size:0.68rem;cursor:pointer;' +
        'border:1px solid var(--bd-1);white-space:nowrap;font:inherit;';
      // Con la ficha, Receta y Materiales totales se ven juntos (y en pantalla
      // angosta las pestañas están dentro de la ficha): en la cabecera queda la cola.
      actions.innerHTML = (UI.renderSheetHTML ? '' :
        '<button type="button" data-lt-view="' + (vistaModal === 'totales' ? 'arbol' : 'totales') +
          '" style="' + btn + 'background:var(--bg-1);color:var(--tx-2);">' +
          (vistaModal === 'totales' ? 'Ver árbol' : 'Materiales totales') + '</button>') +
        '<button type="button" data-lt-queue="' + Number(id) + '" style="' + btn + 'padding:10px 18px;font-size:0.85rem;' +
          'background:var(--bg-2);color:var(--tx-1);">' +
          (enCola ? 'Quitar de la cola' : 'Agregar a la cola') + '</button>';
    }
  }

  // Abre el modal de una legendaria. Es API publica a proposito: la cola de
  // crafteo va a llamarla con el item de la tarjeta, y un deep-link tambien.
  function openItemModal(itemId) {
    var host = ensureItemModal();
    var id = Number(itemId);
    if (!host) return;

    state.openItemId = id;
    vistaModal = 'arbol';
    abiertosArbol = {};
    estadoIconos = { estado: 'cargando' };
    mostrarFicha(true);
    pintarModalLegendaria();

    // Los precursores son 268 KB y se piden la PRIMERA vez que se abre un
    // arbol. `ensurePrecursors` es idempotente: si ya estan, responde al toque.
    var UI = root.LegendaryTreeUI;
    if (UI) {
      UI.ensurePrecursors(function (okPrec) {
        var abierto = fichaAbierta(id);
        if (okPrec && abierto) pedirIconos(id);
        // Sin precursores no hay arbol que iluminar: el aviso de carga se apaga.
        else if (abierto) { estadoIconos = { estado: 'ok' }; pintarModalLegendaria(); }
      });
    }
  }

  function fichaAbierta(id) {
    var h = document.getElementById('ltFicha');
    return !!(h && !h.hidden && state.openItemId === id);
  }

  // Íconos y nombres en español de las piezas, vía ItemIcons (GW2Api.getItemsMany).
  //
  // BL-049: Pablo sigue viendo la ficha sin íconos. Desde la Factory no se
  // puede ver la red del navegador, así que el camino se hizo más corto y más
  // honesto: (1) primero los ids del árbol ABIERTO (decenas, no 1.200), (2) si
  // ItemIcons no responde en 6 s o vuelve sin íconos, se piden esos ids directo
  // a /v2/items con tiempo límite, y (3) si igual no hay, la pantalla lo dice
  // con "Reintentar" en vez de quedar en silencio. El resto del contrato se
  // sigue pidiendo después, para que el próximo árbol abra con íconos.
  var estadoIconos = { estado: 'ok' };
  var _iconosDirectos = {};   // id -> { icon, name, color } del respaldo directo
  var COLOR_RAREZA = { Legendary: '#974EFF', Ascended: '#FB3E8D', Exotic: '#FFA405', Rare: '#FCD00B',
    Masterwork: '#1A9306', Fine: '#62A4DA', Basic: '#FFFFFF', Junk: '#AAAAAA',
    Legendario: '#974EFF', Ascendido: '#FB3E8D', 'Exótico': '#FFA405', Raro: '#FCD00B',
    'Obra maestra': '#1A9306', Bueno: '#62A4DA', 'Básico': '#FFFFFF', Chatarra: '#AAAAAA' };

  function idsDelArbol(res) {
    var ids = [];
    (function walk(n) {
      if (!n) return;
      if (n.id) ids.push(Number(n.id));
      (n.children || []).forEach(walk);
    })(res && res.node);
    ((res && res.totals && res.totals.rows) || []).forEach(function (r) { if (r.itemId) ids.push(Number(r.itemId)); });
    var visto = {};
    return ids.filter(function (x) { if (!x || visto[x]) return false; visto[x] = 1; return true; });
  }

  function conIcono(ids) {
    var n = 0;
    ids.forEach(function (x) { var i = infoPieza(x); if (i && i.icon) n++; });
    return n;
  }

  // Respaldo directo: lotes de 150 ids, 10 s de tiempo límite por lote.
  function traerDirecto(ids) {
    var faltan = ids.filter(function (x) { var i = infoPieza(x); return !(i && i.icon); });
    if (!faltan.length || typeof fetch !== 'function') return Promise.resolve(0);
    var lotes = [];
    for (var k = 0; k < faltan.length; k += 150) lotes.push(faltan.slice(k, k + 150));
    var traidos = 0;
    return Promise.all(lotes.map(function (lote) {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
      return fetch('https://api.guildwars2.com/v2/items?lang=es&ids=' + lote.join(','), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { return r.ok || r.status === 206 ? r.json() : []; })
        .then(function (arr) {
          (Array.isArray(arr) ? arr : []).forEach(function (it) {
            if (!it || !it.id) return;
            _iconosDirectos[String(it.id)] = { icon: it.icon || null, name: it.name || null,
              color: COLOR_RAREZA[it.rarity] || null };
            if (it.icon) traidos++;
          });
        })
        .catch(function (e) { console.warn(LOG, 'íconos: respaldo directo falló', e && e.name, e && e.message); })
        .then(function () { if (timer) clearTimeout(timer); });
    })).then(function () { return traidos; });
  }

  function pedirIconos(id, forzar) {
    var T = root.LegendaryTree;
    var res = T ? T.build(id) : null;
    var arbol = idsDelArbol(res);
    if (!arbol.length) { estadoIconos = { estado: 'ok' }; return; }
    if (forzar) { estadoIconos = { estado: 'cargando' }; if (fichaAbierta(id)) pintarModalLegendaria(); }

    var terminar = function () {
      var con = conIcono(arbol);
      // Alcanza con que estén casi todos: algunos ids de la fuente no existen en la API.
      estadoIconos = (con >= Math.ceil(arbol.length * 0.8)) ? { estado: 'ok' }
        : { estado: 'fallo', con: con, total: arbol.length };
      if (estadoIconos.estado === 'fallo') {
        console.warn(LOG, 'íconos: ' + con + ' de ' + arbol.length + ' para el árbol ' + id +
          ' (ItemIcons: ' + (root.ItemIcons ? 'sí' : 'no') + ', GW2Api: ' + (root.GW2Api ? 'sí' : 'no') + ')');
      }
      if (fichaAbierta(id)) pintarModalLegendaria();
    };

    var Icons = root.ItemIcons;
    var normal = (Icons && typeof Icons.cargar === 'function') ? Icons.cargar(arbol) : Promise.resolve();
    var limite = new Promise(function (r) { setTimeout(function () { r('tarde'); }, 6000); });

    Promise.race([normal.then(function () { return 'ok'; }, function () { return 'error'; }), limite])
      .then(function (como) {
        if (fichaAbierta(id)) pintarModalLegendaria();
        if (como === 'ok' && conIcono(arbol) >= Math.ceil(arbol.length * 0.8)) return null;
        console.warn(LOG, 'íconos: ItemIcons ' + como + ', ' + conIcono(arbol) + ' de ' + arbol.length + '; pruebo directo');
        return traerDirecto(arbol);
      })
      .then(terminar, terminar);

    // El resto del contrato, en segundo plano, para que el próximo árbol abra
    // con íconos (y el título de cada legendaria del catálogo).
    var Prec = root.LegendaryPrecursors;
    if (Icons && typeof Icons.cargar === 'function' && Prec && Prec.byItem) {
      var todos = Object.keys(Prec.byItem);
      var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
      for (var i = 0; i < cat.length; i++) if (cat[i].id) todos.push(String(cat[i].id));
      normal.then(function () { return Icons.cargar(todos); }, function () {}).then(function () {
        if (fichaAbierta(id)) pintarModalLegendaria();
      }, function () {});
    }
  }

  // Delegacion: un solo listener sobre el contenedor, no uno por card. Con
  // 206 cards, un listener por card es 206 closures que se reconstruyen en
  // cada repintado del filtro.
  // Agregar o quitar de la cola, con el aviso que corresponde. Vive ACÁ y no
  // duplicado en el boton del modal y el de la card: la accion es una sola y
  // los dos botones la llaman. Dos copias del aviso son dos lugares donde el
  // mensaje puede quedar viejo sin que nada lo note.
  function encolarConAviso(rawId) {
    var res = toggleQueue(rawId);
    if (!res.ok) {
      toast(res.reason === 'llena'
        ? 'La cola de crafteo esta llena (' + QUEUE_MAX + '). Quita una primero.'
        : 'No se pudo agregar a la cola.', 'warn');
      return res;
    }
    toast(res.added
      ? 'Agregada a la cola (' + state.queue.length + '/' + QUEUE_MAX + ').'
      : 'Quitada de la cola.', res.added ? 'success' : 'info');
    return res;
  }

  function wireItemCards() {
    var content = $('#legendaryModeContent');
    if (!content || content._ltCardsWired) return;
    content._ltCardsWired = true;

    content.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== content) {
        if (target.getAttribute) {
          // El boton de encolar de la card (2026-10-02). Va PRIMERO porque
          // esta DENTRO de la card: sin este chequeo, el `while` sube del boton
          // a la card y la abre, y un solo click encolaria y abriria el arbol a
          // la vez. Es el mismo criterio que usa `wireQueuePanel` con sus dos
          // botones, y el motivo por el que NO lleva un listener propio: 206
          // cards con un listener cada una son 206 listeners por repintado.
          var cq = target.getAttribute('data-card-queue');
          if (cq) {
            e.stopPropagation();
            var res = encolarConAviso(cq);
            if (res.ok) renderCurrentMode();
            return;
          }
        }
        if (target.classList && target.classList.contains('lt-item-card')) {
          onCardTapped(target.getAttribute('data-id'));
          return;
        }
        target = target.parentNode;
      }
    });
  }

  // DECISION DE PABLO, 2026-10-02, y esta REVOCA el comentario que estaba aca.
  // Antes decia: "el click de la card ya es agregar/quitar, y un gesto no puede
  // hacer dos cosas". La primera mitad era cierta y la segunda estaba mal
  // aplicada: el problema no era que el gesto hiciera dos cosas, era que el
  // MISMO gesto significaba "agregar" en el catalogo y "mirar" en la cola. La
  //solution no era Prohibition, era separar el gesto de la intention:
  //
  //     click en la card   -> abre el ARBOL (mirar como se hace)
  //     boton del header   -> agrega o quita de la cola (decidir que hago)
  //
  // El boton va en el header y no en el pie porque el arbol de Frostfang son 55
  // nodos: abajo seria un trabajo de cuatro clics, y la Armeria tiene que ser
  // mas rapida, no mas lenta. La fila de la cola conserva su boton de
  // Materiales, que es una tercera accion distinta y va en su propio lugar.
  function onCardTapped(rawId) {
    openItemModal(rawId);
  }

  // Boton de materiales de una fila de la cola. Ahi vive el modal: el click de
  // la card ya es "agregar/quitar", y un gesto no puede hacer dos cosas.
  function queueRowHTML(item, pos) {
    var nombre = item.nameEs || item.name || ('#' + item.id);
    // Las 3 primeras llevan el acento: es el "mas peso visual" del plan.
    var top3 = pos < 3;
    var borde = top3 ? '3px solid #974EFF' : '3px solid rgba(255,255,255,0.12)';
    var fondo = top3 ? 'rgba(151,78,255,0.08)' : 'transparent';
    return '<div class="lt-queue-row" data-queue-id="' + item.id + '" ' +
      'style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;' +
      'border-left:' + borde + ';background:' + fondo + ';margin-bottom:7px;">' +
      '<span style="font-size:0.62rem;color:var(--tx-3);width:14px;flex-shrink:0;' +
        'font-weight:700;' + (top3 ? 'color:#974EFF;' : '') + '">' + (pos + 1) + '</span>' +
      '<img src="' + esc(item.icon || '') + '" width="30" height="30" alt="" loading="lazy" ' +
        'style="border-radius:4px;object-fit:contain;flex-shrink:0;">' +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'font-size:0.78rem;color:var(--tx-1);" title="' + esc(nombre) + '">' + esc(nombre) + '</span>' +
      '<button data-queue-open="' + item.id + '" ' +
        'style="padding:4px 10px;border-radius:20px;font-size:0.68rem;cursor:pointer;' +
        'border:1px solid var(--bd-1);background:var(--bg-1);color:var(--tx-2);">Materiales</button>' +
      '<button data-queue-remove="' + item.id + '" ' +
        'style="padding:4px 8px;border-radius:20px;font-size:0.68rem;cursor:pointer;' +
        'border:1px solid var(--bd-1);background:var(--bg-1);color:var(--tx-3);">Quitar</button>' +
    '</div>';
  }

  // "Mi progreso" deja de ser la grilla global y pasa a ser la COLA. El
  // switch de alcance (2.2) se retira con ella: era un selector sobre una
  // lista que ya no existe, y sin la lista no hay nada que recortar.
  function renderQueuePanel() {
    var items = queueItems();
    var head = '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">' +
      '<span style="font-size:0.72rem;color:var(--tx-2);font-weight:600;">Cola de crafteo</span>' +
      '<span style="font-size:0.65rem;color:var(--tx-3);">' + items.length + '/' + QUEUE_MAX + '</span></div>';

    if (!items.length) {
      return head + '<p class="status muted" style="font-size:0.75rem;">' +
        'Todavia no hay nada en la cola. Abri una legendaria del catalogo y ' +
        'agregala con el boton de arriba.</p>';
    }
    var rows = items.map(function (it, i) { return queueRowHTML(it, i); }).join('');
    return head + '<div data-queue-panel="true">' + rows + '</div>';
  }

  // Botones de la cola: abrir materiales y quitar. Delegados como los
  // filtros y las cards: un listener sobre el contenedor, no uno por fila.
  function wireQueuePanel() {
    var panel = $('#legendaryModeContent [data-queue-panel="true"]');
    if (!panel || panel.getAttribute('data-wired') === 'true') return;
    panel.setAttribute('data-wired', 'true');
    panel.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== panel) {
        if (t.getAttribute) {
          var open = t.getAttribute('data-queue-open');
          if (open) { openItemModal(open); return; }
          var rm = t.getAttribute('data-queue-remove');
          if (rm) { toggleQueue(rm); toast('Quitada de la cola.', 'info'); renderCurrentMode(); return; }
        }
        t = t.parentNode;
      }
    });
  }

  function renderCurrentMode() {
    var content = $('#legendaryModeContent');
    if (!content) return;

    var r = state.renderers;

    // Sin contrato: mensaje honesto. Es el MISMO texto que pintaba el
    // skeleton, y ahora es verdad en vez de promesa.
    if (!r) {
      if (state.mode === MODES.CATALOG) {
        renderCatalogSkeleton();
      } else {
        renderProgressSkeleton();
      }
      return;
    }

    var all = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    var owned = ownedMap();

    if (state.mode === MODES.CATALOG) {
      var items = catalogItems(owned);
      // Dos argumentos, como siempre: la firma de `renderFilterBar` y
      // `renderCatalogGrid` es el CONTRATO de renderers y la vigila
      // `alert84.t3t4-registro`. Los conteos y la cola llegan por consulta
      // (`getOwnershipCounts` / `getQueue`), no por un parametro nuevo.
      content.innerHTML = r.filterBar(filters, all) + r.catalogGrid(items, owned);
      wireFilterBar();
      wireItemCards();
    } else {
      // Los items los calcula el tracker, no el render. Antes los elegia
      // `renderProgress()` por su cuenta desde `state.owned`, lo que hacia
      // imposible que los filtros del tracker llegaran a esa vista: los
      // filtros viven acá y el render no los tiene. Que el recorte se decida
      // en un solo lado es lo que hace que "Armas" signifique lo mismo en las
      // dos vistas.
      // En el modo cola NO se llama a `r.progress`: esa funcion RECIBE los
      // items y los ordena ALFABETICAMENTE, lo que destruye el orden de
      // agregado que es justamente lo que da peso visual a las 3 primeras.
      // Y su empty state ("aun no posees ninguna legendaria") seria FALSO con
      // la cola vacia. Las filas las pone `renderQueuePanel()`.
      content.innerHTML = r.filterBar(filters, all) + renderQueuePanel();
      wireFilterBar();
      wireQueuePanel();
      wireItemCards();
    }
  }



  // Delegación de eventos: los botones de filtro los genera `render-catologo.js`
  // y no tienen id, solo `data-ftype`/`data-fvalue`. Un listener por cada
  // re-render seria una fuga; uno por contenedor, no.
  function wireFilterBar() {
    var bar = $('#legendaryModeContent .lt-filter-bar');
    if (!bar || bar.getAttribute('data-wired') === 'true') return;
    bar.setAttribute('data-wired', 'true');
    bar.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;

      var ft = t.getAttribute('data-ftype');
      if (ft) {
        var v = t.getAttribute('data-fvalue');
        var cur = filters[ft];
        filters[ft] = (String(cur) === String(v)) ? null : v;
        renderCurrentMode();
        return;
      }
      if (t.getAttribute('data-action') === 'clear-filters') {
        filters.type = null;
        filters.generation = null;
        filters.expansion = null;
        // Sin esta linea "Limpiar" dejaria "Tengo" puesto: el catalogo
        // seguiria recortado y el boton, apagado. El usuario aprieta limpiar y
        // ve que no cambio nada.
        filters.ownership = null;
        renderCurrentMode();
      }
    });
  }

  // ALERT-84: mensaje honesto cuando el render no se registro (antes decia
  // "Cargando" para siempre). Se conservan los ids del contrato de render.
  function renderCatalogSkeleton() {
    var content = $('#legendaryModeContent');
    if (!content) return;

    content.innerHTML = ''
      + '<div class="legendary-catalog" id="legendaryCatalogGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">'
      +   '<p class="status muted">Armería legendaria: módulo en construcción. El catálogo todavía no está implementado.</p>'
      + '</div>';
  }

  function renderProgressSkeleton() {
    var content = $('#legendaryModeContent');
    if (!content) return;

    content.innerHTML = ''
      + '<div class="legendary-progress" id="legendaryProgressList">'
      +   '<p class="status muted">Armería legendaria: módulo en construcción. El seguimiento de progreso todavía no está implementado.</p>'
      + '</div>';
  }

  // ========================================================================
  // 4. API — stubs para Phase 2
  // ========================================================================

  // ========================================================================
  // 4. API — /v2/account/legendaryarmory (+ bank/materials para el modal)
  // ========================================================================
  //
  // Lee armeria, banco y materiales con allSettled: un origen que falla no
  // tumba a los otros, y "no pude leer" se distingue de "no tenes" (readErrors).
  async function loadLegendaryData(nocache) {
    var token = getSelectedToken();
    if (!token) {
      state.armory = [];
      state.bank = [];
      state.materials = [];
      state.readErrors = [];
      return [];
    }

    var api = root.GW2Api;
    if (!api || typeof api.getAccountLegendaryArmory !== 'function') {
      // No es un caso que "no debería pasar": GW2Api se carga antes que este
      // modulo (index.html lo incluye con defer, en orden). Si igual no esta,
      // el modulo no se puede cumplir y decirlo es mejor que pintar vacio.
      console.warn(LOG, 'GW2Api no disponible: no puedo leer la armería legendaria');
      state.armory = [];
      state.readErrors = ['armeria'];
      return [];
    }

    var opts = { nocache: !!nocache };
    var settled = await Promise.allSettled([
      api.getAccountLegendaryArmory(token, opts),
      // Los otros dos NO son para el arbol (eso viene del dataset estatico,
      // `legendary-recipes.js`): son para el modal de materiales, que tiene que
      // decir cuanto TENES. Un "necesito 500" sin el "tenes 0" es la mitad de
      // la informacion. Se piden ahora para que el modal no espere un segundo
      // round-trip cuando el usuario lo abre.
      typeof api.getAccountBank === 'function' ? api.getAccountBank(token, opts) : Promise.resolve([]),
      typeof api.getAccountMaterials === 'function' ? api.getAccountMaterials(token, opts) : Promise.resolve([])
    ]);

    var armoryRes = settled[0], bankRes = settled[1], matRes = settled[2];

    state.armory = (armoryRes.status === 'fulfilled' && Array.isArray(armoryRes.value)) ? armoryRes.value : [];
    state.bank = (bankRes.status === 'fulfilled' && Array.isArray(bankRes.value)) ? bankRes.value : [];
    state.materials = (matRes.status === 'fulfilled' && Array.isArray(matRes.value)) ? matRes.value : [];

    // "No pude leer" != "no tenes". Sin esto, una key expirada se ve
    // exactamente igual que una cuenta nueva.
    var errs = [];
    if (armoryRes.status === 'rejected') errs.push('armería');
    if (bankRes.status === 'rejected') errs.push('banco');
    if (matRes.status === 'rejected') errs.push('materiales');
    state.readErrors = errs;
    if (errs.length) {
      console.warn(LOG, 'No se pudieron leer:', errs.join(', '),
        armoryRes.reason || bankRes.reason || matRes.reason);
    }

    console.log(LOG, 'loadLegendaryData() — armería:', state.armory.length,
      'banco:', state.bank.length, 'materiales:', state.materials.length);
    return state.armory;
  }

  async function refresh(forceNoCache) {
    if (state._refreshInFlight) return state._refreshInFlight;
    try {
      state._refreshInFlight = doRefresh(!!forceNoCache);
      await state._refreshInFlight;
    } finally {
      state._refreshInFlight = null;
    }
  }

  async function doRefresh(nocache) {
    state.loading = true;
    state.error = null;

    var token = getSelectedToken();
    if (!token) {
      state.loading = false;
      return;
    }

    try {
      await loadLegendaryData(nocache);
      // T3: re-render con lo registrado. Sin renderers cae al mensaje honesto.
      renderCurrentMode();
    } catch (e) {
      state.error = e;
      console.warn(LOG, 'doRefresh error:', e);
    } finally {
      state.loading = false;
    }
  }

  // ========================================================================
  // 5. CICLO DE VIDA DEL MÓDULO
  // ========================================================================

  function activate() {
    if (state.active) return;
    state.active = true;

    console.log(LOG, 'activate()');

    var panel = el('legendaryArmoryPanel');
    if (panel) panel.removeAttribute('hidden');

    // Cargar modo persistido (o default)
    loadQueue();
    var savedMode = sGet('mode');
    state.mode = (savedMode === MODES.PROGRESS) ? MODES.PROGRESS : MODES.CATALOG;

    ensurePanelContent();

    // Activar botón del modo actual
    setMode(state.mode);

    // Cargar datos
    var token = getSelectedToken();
    state.token = token;
    if (token) {
      refresh(false).catch(function (e) {
        console.warn(LOG, 'activate refresh error:', e);
      });
    }
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;

    console.log(LOG, 'deactivate()');

    var panel = el('legendaryArmoryPanel');
    if (panel) panel.setAttribute('hidden', 'hidden');
    // Al salir de la Armería, la próxima vez se entra por el catálogo.
    var ficha = document.getElementById('ltFicha');
    if (ficha && !ficha.hidden) { state.openItemId = null; ficha.hidden = true;
      var tg = $('#legendaryArmoryBody .legendary-view-toggle'); if (tg) tg.hidden = false;
      var ct = $('#legendaryModeContent'); if (ct) ct.hidden = false; }
  }

  function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    var token = getSelectedToken();
    if (!token) return;
    return loadLegendaryData(false).catch(function (e) {
      console.debug(LOG, 'prefetch error (ignored)', e);
    });
  }

  function wireGlobalEvents() {
    // Escuchar cambios de cuenta (único canal: gn:tokenchange)
    document.addEventListener('gn:tokenchange', function () {
      if (!state.active) return;
      console.log(LOG, 'gn:tokenchange detected, reloading...');
      var token = getSelectedToken();
      state.token = token;
      refresh(true).catch(function (e) {
        console.warn(LOG, 'onTokenChanged refresh error:', e);
      });
    });
  }

  function initOnce() {
    if (state.inited) return;
    wireGlobalEvents();
    state.inited = true;
    console.log(LOG, 'ready v' + VER);
  }

  // ========================================================================
  // 6. API PÚBLICA
  // ========================================================================

  // ALERT-84 T4. La puerta que `render-catologo.js` pide en su bloque de
  // REGISTRO. Acepta SOLO un registro completo: las 4 claves de
  // REQUIRED_RENDERERS, y ademas cada una tiene que ser `function`.
  //
  // Por que se rechaza lo incompleto en vez de aceptarlo "para despues": un
  // registro a medias deja `registered` en true y el resto del modulo cree que
  // hay contrato. El error aparece al pintar — sin excepcion, en la pantalla,
  // como un modulo vacio — que es el modo de fallo mas dificil de leer. Aca se
  // puede rechazar en el momento en que pasa, nombrando lo que falta.
  function registerRender(map) {
    var missing = [];
    REQUIRED_RENDERERS.forEach(function (key) {
      if (!map || typeof map[key] !== 'function') missing.push(key);
    });

    if (missing.length > 0) {
      state.renderers = null;
      state._renderMissing = missing;
      console.warn(LOG, 'registro incompleto, rechazado. Faltan: ' + missing.join(', '));
      return false;
    }

    state.renderers = {
      filterBar: map.filterBar,
      catalogGrid: map.catalogGrid,
      skeleton: map.skeleton,
      progress: map.progress
    };
    state._renderMissing = [];
    console.info(LOG, 'renderers registrados (' + REQUIRED_RENDERERS.length + ')');

    // Si el panel ya esta montado, pintar ahora: el registro puede ocurrir
    // DESPUES del primer activate() (los <script> van con defer y el orden
    // solo garantiza tracker -> render-catologo). Sin esto, entrar a la ruta
    // antes del registro dejaria el mensaje honesto pegado.
    if (state.active) {
      try { renderCurrentMode(); } catch (e) { console.warn(LOG, 'render tras registro fallo:', e); }
    }
    return true;
  }

  // Punto de observabilidad del REGISTRO. Distinto del del catálogo
  // (`root.LegendaryCatalog.items.length`), y esa distincion es el motivo de
  // existir: los dos pueden fallar por separado y un solo assert no los separa.
  function getRenderState() {
    var r = state.renderers;
    return {
      registered: !!r,
      keys: r ? Object.keys(r) : [],
      missing: r ? [] : state._renderMissing.slice(),
      catalogItems: ((root.LegendaryCatalog && root.LegendaryCatalog.items) || []).length
    };
  }

  // Estado de la sesion, ya DERIVADO. Es la unica lectura que el render y los
  // modales necesitan, y expone copias: un consumidor que escribiera en
  // `owned` mutaria el interno del modulo sin pasar por ningun recalculo.
  //
  // `owned` sale de `ownedMap()` y no de `state.armory` directo, porque "tener"
  // y "estar en la respuesta cruda" no son la misma pregunta: la respuesta
  // trae slots con `id`, y lo que la UI necesita es un conteo por id.
  function getState() {
    return {
      mode: state.mode,
      token: state.token,
      loading: state.loading,
      error: state.error ? String(state.error.message || state.error) : null,
      owned: ownedMap(),
      // `armory` crudo sale en la API publica porque es lo que necesita el
      // conteo de "faltantes" (Pablo: faltante = NO esta en la armoria).
      armoryCount: state.armory.length,
      bank: state.bank.slice(),
      materials: state.materials.slice(),
      characterItems: state.characterItems.slice(),
      readErrors: state.readErrors.slice(),
      filters: { type: filters.type, generation: filters.generation, expansion: filters.expansion }
    };
  }

  var LegendaryTracker = {
    initOnce: initOnce,
    activate: activate,
    deactivate: deactivate,
    refresh: refresh,
    prefetch: prefetch,
    registerRender: registerRender,
    registerItemModal: function (fn) {
      if (typeof fn !== 'function') return false;
      state.itemModalRenderer = fn;
      // Si hay un modal abierto con el render viejo, se repinta con el nuevo:
      // el registro puede ocurrir DESPUES del primer click (los <script> van
      // con defer y el orden solo garantiza tracker -> render-catologo).
      if (state.openItemId && document.getElementById('ltFicha') && !document.getElementById('ltFicha').hidden) {
        openItemModal(state.openItemId);
      }
      return true;
    },
    openItemModal: openItemModal,
    // Cola de crafteo (paso 5). `toggleQueue` es la MISMA funcion que usa el
    // click de la card: un consumidor externo y un dedo no pueden tener
    // reglas distintas de las 5.
    toggleQueue: toggleQueue,
    getQueue: function () { return state.queue.slice(); },
    // Cuantos hay de cada lado del filtro de posesion, ya recortados por los
    // filtros de tipo/gen/exp que esten puestos. Lo consulta
    // `renderFilterBar` en vez de recibirlo por parametro, para no cambiar la
    // firma del contrato de renderers (`alert84.t3t4-registro` la mide).
    getOwnershipCounts: function () { return ownershipCounts(ownedMap()); },
    QUEUE_MAX: QUEUE_MAX,
    closeItemModal: closeItemModal,
    computeMaterials: computeMaterials,
    getRenderState: getRenderState,
    getState: getState,
    setMode: setMode,

    // Escritura de filtros y alcance por API publica (punto 2.2). No es
    // necesaria para los botones — esosvan por delegacion de eventos — pero si
    // para que un consumidor externo (los modales de 2.3, un test, un
    // deep-link) pueda fijar el recorte sin escribir en el objeto interno.
    // `null` limpia el filtro; el valor se valida contra el propio dato, no
    // contra una lista: un filtro de tipo que no existe en el catalogo es
    // legitimo (se ve la grilla vacia)
    // NO lo es y cae al default en vez de dejar la vista sin items.
    setFilter: function (key, value) {
      if (key !== 'type' && key !== 'generation' && key !== 'expansion') return false;
      filters[key] = (value === '' ? null : value);
      if (state.inited && state.active) renderCurrentMode();
      return true;
    },
    _debug: function () {
      return {
        version: VER,
        inited: state.inited,
        active: state.active,
        mode: state.mode,
        token: state.token ? (state.token.slice(0, 8) + '...') : null,
        armoryCount: state.armory.length,
        loading: state.loading,
        error: state.error ? String(state.error.message || state.error) : null,
        render: getRenderState(),
        filters: { type: filters.type, generation: filters.generation, expansion: filters.expansion },
        dom: {
          panel: !!el('legendaryArmoryPanel'),
          panelVisible: el('legendaryArmoryPanel') ? !el('legendaryArmoryPanel').hasAttribute('hidden') : false,
          body: !!el('legendaryArmoryBody'),
          catalogBtn: !!el('legendaryModeCatalog'),
          progressBtn: !!el('legendaryModeProgress')
        }
      };
    },
    Route: {
      path: 'account/legendary-armory',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    }
  };

  // ========================================================================
  // 7. BOOT
  // ========================================================================

  root.LegendaryTracker = LegendaryTracker;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    initOnce();
  }

  console.info(LOG, 'Módulo cargado v' + VER);

})(typeof window !== 'undefined' ? window : this);
