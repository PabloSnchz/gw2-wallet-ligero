/**
 * legendary-tree-ui.js — el árbol de fabricación y los totales, pintados.
 * v2.2.0 (2026-10-22) - La legendaria como PANTALLA dentro de la Armería
 *   (BL-049, pedido de Pablo: la ficha en diálogo todavía quedaba chica).
 *   Estilos `.lt-ficha`: botón "Volver", cabecera grande con ícono de 80 px,
 *   la receta sin scroll interno (scrollea la página) y Materiales totales
 *   fijo al costado mientras bajás. renderIconStatusHTML: aviso visible
 *   cuando los íconos no llegan, con "Reintentar".
 * v2.1.0 (2026-10-21) - Ficha de pantalla completa (BL-047, pedido de Pablo:
 *   "en el modal queda comprimido, no tiene aire"). renderHeroHTML pinta la
 *   cabecera grande (ícono, nombre, tipo, expansión, generación) y
 *   renderSheetHTML la ficha: resumen en tarjetas (piezas, materiales,
 *   completos, unidades que faltan) y Receta y Materiales totales LADO A LADO,
 *   cada uno con su scroll. En pantallas angostas se apilan y las pestañas
 *   eligen cuál se ve (data-lt-view, el mismo atributo que ya escucha el tracker).
 * v2.0.0 (2026-10-21) - Diseño aprobado por Pablo (BL-047): íconos de 24 px
 *   (raíz 32, primer nivel 28), líneas guía, columnas Pieza / Cantidad / Origen
 *   con título, chips "Material", "Se compra", "Receta · N" (antes "+N"),
 *   leyenda arriba del árbol, el chevron es un botón de verdad (teclado) y, en
 *   Materiales totales, barra de progreso por material, "✓ 0" cuando está
 *   completo y "Completo: X de Y materiales". Estilos en <style id="ltTreeStyle">
 *   con las variables del theme. tests/legendary-tree-ui.test.cjs.
 *
 * QUÉ ES Y QUÉ NO ES
 * El motor está en `legendary-tree.js` y este archivo NO calcula cantidades:
 * las pide ahí con `build()` y las muestra. Si este archivo hiciera aritmética
 * sería el segundo motor, y dos motores divergen sin que nadie lo note.
 * Las únicas cuentas de acá dependen del inventario del usuario, no de la
 * receta: `falta = max(0, necesito - tengo)` y el porcentaje de la barra.
 *
 * POR QUÉ ESTÁ SEPARADO DE `legendary-tracker.js`
 * El tracker tiene el catálogo, la cola, los filtros y el modal. El árbol es
 * una vista: el motor se prueba sin DOM y la UI se prueba sin API.
 *
 * LA CARGA PEREZOSA
 * `legendary-precursors.js` son 268 KB y la mayoría de quien abre la app nunca
 * abre un árbol. Se pide la PRIMERA vez que se abre un árbol. Si la carga
 * falla, `ensurePrecursors` responde `false` y la vista lo dice con un botón
 * "Reintentar": el control queda, no desaparece.
 *
 * POR QUÉ `esc` Y `de` VIENEN POR PARÁMETRO
 * `esc` ya tiene dos copias en el repo; el tracker pasa la suya. `de` (ícono,
 * nombre en español y color de rareza) lo inyecta el tracker, que es el único
 * que sabe de dónde salen. Sin `de`, se dibuja sin ícono y sin color.
 */
(function (root) {
  'use strict';

  var LOG = '[LegendaryTreeUI]';

  // ==========================================================================
  // 1. CARGA PEREZOSA DE LOS PRECURSORES
  // ==========================================================================

  var _cargando = false;
  var _listo = false;
  var _fallo = false;
  var _espera = [];

  function _resolver(ok) {
    var cola = _espera;
    _espera = [];
    for (var i = 0; i < cola.length; i++) {
      try { cola[i](ok); } catch (e) { /* un consumidor roto no corta al resto */ }
    }
  }

  // Callback con true si los precursores quedaron cargados, false si no.
  // Idempotente; un fallo no se reintenta solo (sería una tormenta de red),
  // lo reintenta el botón con `_resetCache()`.
  function ensurePrecursors(cb) {
    if (_listo || root.LegendaryPrecursors) { _listo = true; if (cb) cb(true); return; }
    if (_fallo) { if (cb) cb(false); return; }

    _espera.push(cb || function () {});
    // Dos clics rápidos: el segundo espera al primero, no baja 268 KB otra vez.
    if (_cargando) return;

    if (typeof document === 'undefined' || !document.head) {
      _cargando = false; _fallo = true; _resolver(false); return;
    }

    _cargando = true;
    var s = document.createElement('script');
    s.src = 'js/legendary-precursors.js?v=1.0.0';
    s.async = true;
    s.onload = function () {
      _cargando = false;
      if (root.LegendaryPrecursors) { _listo = true; _resolver(true); }
      else { _fallo = true; _resolver(false); }
    };
    s.onerror = function () { _cargando = false; _fallo = true; _resolver(false); };
    document.head.appendChild(s);
  }

  // Para los tests y el botón "Reintentar": olvidar lo que se sabe.
  function _resetCache() { _cargando = false; _listo = false; _fallo = false; _espera = []; }

  // ==========================================================================
  // 2. ESTADO DE EXPANSIÓN
  // ==========================================================================

  // Dos niveles abiertos de entrada: con uno se ven los 4 ingredientes de la
  // Forja y no se ve que cada uno es una subreceta.
  var NIVEL_ABIERTO_POR_DEFECTO = 2;

  // Un valor EXPLÍCITO gana siempre y se mira PRIMERO: si no, cerrar un nodo
  // de nivel 2 no tendría efecto.
  function _abierto(node, abiertos) {
    if (!node) return false;
    if (abiertos && Object.prototype.hasOwnProperty.call(abiertos, node.id)) {
      return !!abiertos[node.id];
    }
    if (!node.isLeaf && node.level <= NIVEL_ABIERTO_POR_DEFECTO) return true;
    return false;
  }

  // ==========================================================================
  // 3. ESTILOS (una sola vez, con las variables del theme)
  // ==========================================================================

  var CSS = [
    '.lt-tree-wrap{padding:12px 14px 16px}',
    '.lt-legend{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:.72rem;color:var(--tx-3,#8a91a8);padding:8px 10px;border:1px dashed var(--bd-1,rgba(255,255,255,.14));border-radius:10px;margin-bottom:12px}',
    '.lt-legend b{color:var(--tx-2,#b9bfd3);font-weight:600}',
    '.lt-cols,.lt-node{display:grid;grid-template-columns:minmax(0,1fr) 86px 118px;gap:10px;align-items:center}',
    '.lt-cols{font-size:.68rem;color:var(--tx-3,#8a91a8);text-transform:uppercase;letter-spacing:.04em;padding:0 10px 6px;border-bottom:1px solid var(--bd-1,rgba(255,255,255,.1));margin-bottom:4px}',
    '.lt-cols span:nth-child(n+2){text-align:right}',
    '.lt-tree,.lt-tree ul{list-style:none;margin:0;padding:0}',
    '.lt-tree ul{margin-left:22px;padding-left:12px;border-left:2px solid rgba(155,123,255,.28)}',
    '.lt-node{position:relative;padding:7px 10px;border-radius:9px;margin:3px 0}',
    '.lt-tree ul .lt-node::before{content:"";position:absolute;left:-14px;top:50%;width:12px;border-top:2px solid rgba(155,123,255,.28)}',
    '.lt-node[data-lt-toggle]{cursor:pointer}',
    '.lt-node:hover{background:var(--bg-2,rgba(255,255,255,.04))}',
    '.lt-node--root{background:linear-gradient(90deg,rgba(151,78,255,.18),transparent);border:1px solid rgba(151,78,255,.35)}',
    '.lt-node--lvl1{background:var(--bg-2,rgba(255,255,255,.04));border:1px solid var(--bd-1,rgba(255,255,255,.1))}',
    '.lt-name{display:flex;align-items:center;gap:9px;min-width:0}',
    '.lt-chev{width:22px;height:22px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:5px;background:none;color:var(--tx-3,#8a91a8);font-size:.75rem;cursor:pointer}',
    '.lt-chev:focus-visible{outline:2px solid var(--accent,#9b7bff);outline-offset:1px}',
    '.lt-chev--none{cursor:default}',
    '.lt-ic{flex-shrink:0;border-radius:5px;box-shadow:0 0 0 1px rgba(255,255,255,.08)}',
    '.lt-nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8rem}',
    '.lt-node--root .lt-nm{font-weight:700;font-size:.95rem}',
    '.lt-node--lvl1 .lt-nm{font-weight:600}',
    '.lt-qty{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;font-size:.8rem}',
    '.lt-qty small{color:var(--tx-3,#8a91a8);font-weight:400}',
    '.lt-qty--one{color:var(--tx-3,#8a91a8);font-weight:400}',
    '.lt-orig{display:flex;justify-content:flex-end}',
    '.lt-chip{font-size:.7rem;padding:3px 9px;border-radius:999px;white-space:nowrap;border:1px solid}',
    '.lt-chip--base{color:var(--color-blue,#6fb3e8);border-color:rgba(111,179,232,.4);background:rgba(111,179,232,.08)}',
    '.lt-chip--buy{color:var(--color-amber,#e2b45a);border-color:rgba(226,180,90,.4);background:rgba(226,180,90,.08)}',
    '.lt-chip--craft{color:var(--accent,#9b7bff);border-color:rgba(155,123,255,.4);background:rgba(155,123,255,.08)}',
    '.lt-chip--other{color:var(--tx-3,#8a91a8);border-color:var(--bd-1,rgba(255,255,255,.14))}',
    '.lt-note{font-size:.66rem;color:var(--tx-3,#8a91a8);padding:0 10px 4px 41px}',
    '.lt-foot{font-size:.68rem;color:var(--tx-3,#8a91a8);margin-top:8px}',
    '.lt-foot:first-of-type{margin-top:12px;padding-top:9px;border-top:1px solid var(--bd-1,rgba(255,255,255,.08))}',
    '.lt-tot{width:100%;border-collapse:collapse;font-size:.8rem}',
    '.lt-tot th{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-3,#8a91a8);text-align:right;padding:6px 8px;border-bottom:1px solid var(--bd-1,rgba(255,255,255,.1));font-weight:600}',
    '.lt-tot th:first-child{text-align:left}',
    '.lt-tot td{padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid rgba(255,255,255,.04)}',
    '.lt-tot td:first-child{text-align:left;max-width:0;width:100%}',
    '.lt-mat{display:flex;align-items:center;gap:8px;min-width:0}',
    '.lt-mat span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.lt-bar{height:4px;border-radius:3px;background:var(--bd-1,rgba(255,255,255,.1));margin-top:4px;overflow:hidden}',
    '.lt-bar i{display:block;height:100%;background:var(--color-green,#5fd39a)}',
    '.lt-done{color:var(--color-green,#5fd39a)}',
    '.lt-part{color:var(--color-amber,#e2b45a);font-weight:600}',
    '.lt-miss{color:var(--color-red,#e0855c);font-weight:600}',
    '.lt-sum{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:10px;font-size:.78rem;color:var(--tx-3,#8a91a8)}',
    '.lt-sum strong{color:var(--tx-1,#eceef5)}',
    // ---- Ficha de pantalla completa (v2.1.0) ----
    '.lt-hero{display:flex;align-items:center;gap:16px;min-width:0}',
    '.lt-hero__ic{width:64px;height:64px;flex-shrink:0;border-radius:12px;box-shadow:0 0 0 2px rgba(151,78,255,.55),0 0 22px rgba(151,78,255,.35)}',
    '.lt-hero__txt{min-width:0}',
    '.lt-hero__kicker{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--tx-3,#8a91a8)}',
    '.lt-hero__name{margin:2px 0 6px;font-size:1.45rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lt-hero__tags{display:flex;flex-wrap:wrap;gap:6px}',
    '.lt-tag{font-size:.72rem;padding:2px 9px;border-radius:999px;border:1px solid var(--bd-1,rgba(255,255,255,.14));color:var(--tx-2,#b9bfd3);background:var(--bg-2,rgba(255,255,255,.04))}',
    '.lt-sheet-wrap{padding:16px 20px 20px}',
    '.lt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}',
    '.lt-stat{padding:12px 14px;border-radius:12px;background:var(--bg-2,rgba(255,255,255,.04));border:1px solid var(--bd-1,rgba(255,255,255,.1))}',
    '.lt-stat__lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--tx-3,#8a91a8)}',
    '.lt-stat__val{font-size:1.5rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--tx-1,#eceef5);margin-top:2px}',
    '.lt-stat__val small{font-size:.8rem;font-weight:400;color:var(--tx-3,#8a91a8)}',
    '.lt-stat--ok .lt-stat__val{color:var(--color-green,#5fd39a)}',
    '.lt-stat--miss .lt-stat__val{color:var(--color-amber,#e2b45a)}',
    '.lt-stat .lt-bar{height:6px;margin-top:8px}',
    '.lt-tabs{display:none;gap:6px;margin-bottom:12px}',
    '.lt-tab{padding:7px 14px;border-radius:999px;border:1px solid var(--bd-1,rgba(255,255,255,.14));background:var(--bg-2,rgba(255,255,255,.04));color:var(--tx-2,#b9bfd3);font:inherit;font-size:.8rem;cursor:pointer}',
    '.lt-tab[aria-pressed="true"]{border-color:var(--accent,#9b7bff);color:var(--tx-1,#eceef5);background:rgba(155,123,255,.15)}',
    '.lt-tab:focus-visible{outline:2px solid var(--accent,#9b7bff);outline-offset:2px}',
    '.lt-sheet{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(380px,1fr);gap:16px;align-items:start}',
    '.lt-pane{background:var(--bg-1,rgba(255,255,255,.02));border:1px solid var(--bd-1,rgba(255,255,255,.1));border-radius:14px;overflow:hidden;min-width:0}',
    '.lt-pane__head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid var(--bd-1,rgba(255,255,255,.1))}',
    '.lt-pane__title{margin:0;font-size:.95rem}',
    '.lt-pane__hint{font-size:.72rem;color:var(--tx-3,#8a91a8)}',
    '.lt-pane__body{max-height:calc(100vh - 330px);min-height:260px;overflow:auto}',
    '.lt-pane .lt-tot th{position:sticky;top:0;z-index:1;background:var(--bg-1,#171a23)}',
    // ---- La legendaria como pantalla (v2.2.0) ----
    '.lt-ficha{display:flex;flex-direction:column;gap:16px}',
    '.lt-ficha[hidden]{display:none}',
    '.lt-ficha__bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
    '.lt-back{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;border:1px solid var(--bd-1,rgba(255,255,255,.14));background:var(--bg-2,rgba(255,255,255,.04));color:var(--tx-1,#eceef5);font:inherit;font-size:.85rem;cursor:pointer}',
    '.lt-back:hover{border-color:var(--accent,#9b7bff)}',
    '.lt-back:focus-visible,.lt-icons button:focus-visible{outline:2px solid var(--accent,#9b7bff);outline-offset:2px}',
    '.lt-ficha__crumb{font-size:.78rem;color:var(--tx-3,#8a91a8)}',
    '.lt-ficha__head{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:20px 22px;border-radius:16px;background:linear-gradient(90deg,rgba(151,78,255,.18),transparent 70%);border:1px solid rgba(151,78,255,.35)}',
    '.lt-ficha__title{flex:1;min-width:240px}',
    '.lt-ficha__actions{display:flex;gap:8px;flex-wrap:wrap}',
    '.lt-ficha .lt-hero__ic{width:80px;height:80px}',
    '.lt-ficha .lt-hero__name{font-size:1.8rem;white-space:normal}',
    '.lt-ficha .lt-sheet-wrap{padding:0}',
    '.lt-ficha .lt-node{padding:9px 12px}',
    '.lt-ficha .lt-nm{font-size:.88rem}',
    '.lt-ficha .lt-pane--arbol .lt-pane__body{max-height:none;min-height:0;overflow:visible}',
    '.lt-ficha .lt-pane--totales{position:sticky;top:16px}',
    '.lt-ficha .lt-pane--totales .lt-pane__body{max-height:calc(100vh - 140px)}',
    '.lt-icons{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.8rem;padding:8px 12px;border-radius:10px;border:1px solid rgba(226,180,90,.4);background:rgba(226,180,90,.08);color:var(--tx-2,#b9bfd3)}',
    '.lt-icons--cargando{border-color:var(--bd-1,rgba(255,255,255,.14));background:transparent;color:var(--tx-3,#8a91a8)}',
    '.lt-icons button{padding:4px 12px;border-radius:999px;border:1px solid var(--bd-1,rgba(255,255,255,.14));background:var(--bg-2,rgba(255,255,255,.04));color:var(--tx-1,#eceef5);font:inherit;font-size:.78rem;cursor:pointer}',
    '@media (max-width:1000px){.lt-sheet{grid-template-columns:minmax(0,1fr)}.lt-tabs{display:flex}' +
      '.lt-ficha .lt-pane--totales{position:static}.lt-ficha .lt-pane--totales .lt-pane__body{max-height:none}' +
      '.lt-ficha__head{padding:14px}.lt-ficha .lt-hero__ic{width:56px;height:56px}.lt-ficha .lt-hero__name{font-size:1.3rem}' +
      '.lt-sheet--arbol .lt-pane--totales,.lt-sheet--totales .lt-pane--arbol{display:none}' +
      '.lt-pane__body{max-height:none;min-height:0}.lt-hero__ic{width:48px;height:48px}.lt-hero__name{font-size:1.15rem;white-space:normal}' +
      '.lt-sheet-wrap{padding:12px}}',
    '@media (max-width:560px){.lt-cols,.lt-node{grid-template-columns:minmax(0,1fr) 64px 96px;gap:6px}.lt-tree ul{margin-left:10px;padding-left:8px}.lt-tree ul .lt-node::before{left:-10px;width:8px}}'
  ].join('\n');

  function _ensureStyle() {
    if (typeof document === 'undefined' || !document.head || !document.getElementById) return;
    if (document.getElementById('ltTreeStyle')) return;
    var st = document.createElement('style');
    st.id = 'ltTreeStyle';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ==========================================================================
  // 4. PIEZAS
  // ==========================================================================

  // Miles con punto, como se lee en castellano: 1.000, 2.400. Fijo y no
  // toLocaleString, para que el mismo número se vea igual en todos lados.
  function _num(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function _descendientes(node) {
    var n = 0;
    (function walk(x) {
      (x.children || []).forEach(function (c) { n++; walk(c); });
    })(node);
    return n;
  }

  // El origen de la pieza: SIEMPRE con texto, nunca solo color.
  function _chip(node) {
    var k = node.kind;
    if (k === 'material') return '<span class="lt-chip lt-chip--base">Material</span>';
    if (k === 'vendor') return '<span class="lt-chip lt-chip--buy">Se compra</span>';
    if (k === 'recipe' || k === 'root') {
      var d = _descendientes(node);
      return '<span class="lt-chip lt-chip--craft">' + (d ? 'Receta · ' + _num(d) : 'Receta') + '</span>';
    }
    var otro = { no_recipe: 'Sin receta', placeholder: 'Marcador', unknown: 'Desconocido', sinId: 'Sin id' }[k];
    return otro ? '<span class="lt-chip lt-chip--other">' + otro + '</span>' : '';
  }

  function _tamIcono(profundidad) { return profundidad === 0 ? 32 : (profundidad === 1 ? 28 : 24); }

  function _nodo(node, abiertos, esc, profundidad, de) {
    var abierto = _abierto(node, abiertos);
    var tieneHijos = !node.isLeaf && node.children && node.children.length;
    var info = de ? de(node.id) : null;
    // Primero el nombre de la API (español); el de la receta es inglés de origen.
    var nombre = (info && info.name) || node.name;
    var clase = 'lt-node' + (profundidad === 0 ? ' lt-node--root' : (profundidad === 1 ? ' lt-node--lvl1' : ''));
    var out = '<li>';

    // Toda la fila abre y cierra con el mouse; el teclado usa el botón del
    // chevron (un <button> de verdad: Enter y Espacio funcionan solos).
    out += '<div class="' + clase + '"' + (tieneHijos ? ' data-lt-toggle="' + node.id + '"' : '') + '>';
    out += '<div class="lt-name">';
    if (tieneHijos) {
      out += '<button type="button" class="lt-chev" data-lt-toggle="' + node.id + '" aria-expanded="' +
        (abierto ? 'true' : 'false') + '" aria-label="' + (abierto ? 'Cerrar ' : 'Abrir ') + esc(nombre) + '">' +
        (abierto ? '▾' : '▸') + '</button>';
    } else {
      out += '<span class="lt-chev lt-chev--none" aria-hidden="true"></span>';
    }
    var t = _tamIcono(profundidad);
    if (info && info.icon) {
      out += '<img class="lt-ic" src="' + esc(info.icon) + '" alt="" width="' + t + '" height="' + t +
        '" loading="lazy" style="width:' + t + 'px;height:' + t + 'px;">';
    }
    out += '<span class="lt-nm" style="color:' + ((info && info.color) || 'var(--tx-1)') + ';" title="' +
      esc(nombre) + '">' + esc(nombre) + '</span>';
    out += '</div>';

    var c = Number(node.count) || 0;
    out += c > 1
      ? '<div class="lt-qty">' + _num(c) + ' <small>u.</small></div>'
      : '<div class="lt-qty lt-qty--one">' + _num(c) + '</div>';
    out += '<div class="lt-orig">' + _chip(node) + '</div>';
    out += '</div>';

    if (node.note) out += '<div class="lt-note">' + esc(node.note) + '</div>';

    if (tieneHijos && abierto) {
      out += '<ul>';
      for (var i = 0; i < node.children.length; i++) {
        out += _nodo(node.children[i], abiertos, esc, profundidad + 1, de);
      }
      out += '</ul>';
    }
    return out + '</li>';
  }

  var LEYENDA = '<div class="lt-legend">' +
    '<span><b>Cantidad</b>: cuántas hacen falta de esa pieza</span>' +
    '<span><span class="lt-chip lt-chip--base">Material</span> se junta o se compra en el bazar</span>' +
    '<span><span class="lt-chip lt-chip--buy">Se compra</span> a un NPC</span>' +
    '<span><span class="lt-chip lt-chip--craft">Receta · N</span> se fabrica; adentro hay N piezas</span>' +
    '</div>';

  // ==========================================================================
  // 5. PINTAR EL ÁRBOL
  // ==========================================================================

  // Puro: recibe el resultado de build() y devuelve HTML. Sin API.
  function renderTreeHTML(res, opts) {
    opts = opts || {};
    var esc = opts.esc || function (s) { return String(s == null ? '' : s); };
    var abiertos = opts.abiertos || {};
    var de = opts.de || null;
    _ensureStyle();

    // EL ORDEN DE ESTAS DOS GUARDAS ES LO QUE IMPORTA: `needsPrecursors` es un
    // estado conocido ("cargando"), no un error. Y sin precursores NO se dibuja
    // un árbol de un nivel: se leería que la legendaria se hace con 4 cosas.
    if (res && res.needsPrecursors) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;" data-lt-pending="1">' +
        '<div style="margin-bottom:8px;">Cargando las recetas completas…</div>' +
        '<button type="button" data-lt-retry="1" style="padding:6px 12px;border-radius:20px;' +
        'font-size:0.7rem;cursor:pointer;border:1px solid var(--bd-1);background:var(--bg-1);' +
        'color:var(--tx-2);">Reintentar</button></div>';
    }

    if (!res || !res.node) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;">' +
        'No se pudo construir el árbol de este item.</div>';
    }

    var html = '<div class="lt-tree-wrap lt-arbol" data-lt-tree="1">' + LEYENDA +
      '<div class="lt-cols" aria-hidden="true"><span>Pieza</span><span>Cantidad</span><span>Origen</span></div>' +
      '<ul class="lt-tree">' + _nodo(res.node, abiertos, esc, 0, de) + '</ul>';

    // Lo que NO entra en la cuenta, dicho: si desaparece, nadie puede reportarlo.
    var t = res.totals || {};
    if (t.vendor && t.vendor.length) {
      html += '<div class="lt-foot">No entra en el total: ' + t.vendor.length + ' pieza(s) que se compran a un NPC.</div>';
    }
    if (t.sinId && t.sinId.length) {
      html += '<div class="lt-foot">No entra en el total: ' + t.sinId.length + ' ingrediente(s) sin id en la fuente, ' +
        'no se pueden contar contra tu inventario.</div>';
    }
    if (t.unknown && t.unknown.length) {
      html += '<div class="lt-foot">No entra en el total: ' + t.unknown.length + ' pieza(s) no están en el catálogo de recetas.</div>';
    }
    return html + '</div>';
  }

  // ==========================================================================
  // 6. PINTAR LOS TOTALES
  // ==========================================================================

  // Tengo / Necesito / Falta, con barra de progreso y resumen. "Tengo" es el
  // inventario de materiales que pasa el tracker (stockMap, BL-045).
  function renderTotalsHTML(res, owned, opts) {
    opts = opts || {};
    var esc = opts.esc || function (s) { return String(s == null ? '' : s); };
    owned = owned || {};

    if (res && res.needsPrecursors) return renderTreeHTML(res, opts);
    _ensureStyle();

    var rows = (res && res.totals && res.totals.rows) || [];
    if (!rows.length) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;">' +
        'Este item no tiene materiales base que contar.</div>';
    }

    var h = '<div class="lt-tree-wrap">';
    h += '<table class="lt-tot"><thead><tr>' +
      '<th scope="col">Material</th><th scope="col">Tengo</th><th scope="col">Necesito</th><th scope="col">Falta</th>' +
      '</tr></thead><tbody>';

    var totF = 0, completos = 0;
    rows.forEach(function (r) {
      var tengo = Number(owned[r.itemId]) || 0;
      var necesito = Number(r.need) || 0;
      var falta = Math.max(0, necesito - tengo);
      var pct = necesito > 0 ? Math.min(100, Math.floor(tengo * 100 / necesito)) : 100;
      totF += falta;
      if (!falta) completos++;
      var info = opts.de ? opts.de(r.itemId) : null;
      var nombre = (info && info.name) || r.name;
      var cls = !falta ? 'lt-done' : (tengo > 0 ? 'lt-part' : 'lt-miss');
      h += '<tr><td title="' + esc(nombre) + '"><div class="lt-mat">' +
        (info && info.icon
          ? '<img class="lt-ic" src="' + esc(info.icon) + '" alt="" width="20" height="20" loading="lazy" style="width:20px;height:20px;">'
          : '') +
        '<span style="color:' + ((info && info.color) || 'var(--tx-1)') + ';">' + esc(nombre) + '</span></div>' +
        '<div class="lt-bar" role="progressbar" aria-label="' + esc(nombre) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<i style="width:' + pct + '%"></i></div></td>' +
        '<td>' + _num(tengo) + '</td>' +
        '<td>' + _num(necesito) + '</td>' +
        '<td class="' + cls + '">' + (falta ? _num(falta) : '✓ 0') + '</td></tr>';
    });

    h += '</tbody></table>';
    h += '<div class="lt-sum"><span>Completo: <strong>' + completos + '</strong> de ' + rows.length + ' materiales</span>' +
      '<span>Faltan <strong>' + _num(totF) + '</strong> unidades</span></div>';
    return h + '</div>';
  }

  // ==========================================================================
  // 7. FICHA DE PANTALLA COMPLETA (v2.1.0)
  // ==========================================================================

  // Mismas etiquetas que el catálogo (render-catologo.js EXPANSION_LABELS).
  var EXP_LABELS = { Core: 'Clásico', HoT: 'Heart of Thorns', PoF: 'Path of Fire', EoD: 'End of Dragons',
    SotO: 'Secrets of the Obscure', JW: 'Janthir Wilds', VoE: 'Visions of Eternity' };

  // Cabecera de la ficha. `meta` lo arma el tracker con el catálogo:
  // { name, icon, color, tipo, expansion, generation }.
  function renderHeroHTML(meta, esc) {
    meta = meta || {};
    esc = esc || function (s) { return String(s == null ? '' : s); };
    _ensureStyle();
    var tags = [];
    if (meta.tipo) tags.push(meta.tipo);
    if (meta.expansion) tags.push(EXP_LABELS[meta.expansion] || meta.expansion);
    if (meta.generation) tags.push('Gen ' + meta.generation);
    return '<div class="lt-hero">' +
      (meta.icon ? '<img class="lt-hero__ic" src="' + esc(meta.icon) + '" alt="" width="64" height="64">' : '') +
      '<div class="lt-hero__txt"><div class="lt-hero__kicker">Armería legendaria</div>' +
      '<h3 class="lt-hero__name" style="color:' + esc(meta.color || 'var(--tx-1)') + ';">' + esc(meta.name || '') + '</h3>' +
      (tags.length ? '<div class="lt-hero__tags">' + tags.map(function (t) {
        return '<span class="lt-tag">' + esc(t) + '</span>';
      }).join('') + '</div>' : '') +
      '</div></div>';
  }

  // Cuentas del resumen. Solo dependen del inventario: la receta la cuenta el motor.
  function _resumen(res, owned) {
    owned = owned || {};
    var rows = (res && res.totals && res.totals.rows) || [];
    var completos = 0, faltan = 0;
    rows.forEach(function (r) {
      var f = Math.max(0, (Number(r.need) || 0) - (Number(owned[r.itemId]) || 0));
      faltan += f;
      if (!f) completos++;
    });
    var vendor = (res && res.totals && res.totals.vendor) || [];
    return {
      piezas: res && res.node ? _descendientes(res.node) : 0,
      materiales: rows.length,
      completos: completos,
      faltan: faltan,
      compran: vendor.length,
      pct: rows.length ? Math.floor(completos * 100 / rows.length) : 0
    };
  }

  // La ficha: resumen + Receta y Materiales totales lado a lado. `opts.vista`
  // ('arbol' | 'totales') decide cuál se ve en pantallas angostas.
  function renderSheetHTML(res, owned, opts) {
    opts = opts || {};
    // Cargando o sin árbol: se dice lo mismo que en el árbol, sin inventar el resto.
    if (!res || res.needsPrecursors || !res.node) return renderTreeHTML(res, opts);
    _ensureStyle();
    var vista = opts.vista === 'totales' ? 'totales' : 'arbol';
    var s = _resumen(res, owned);

    var stat = function (cls, lbl, val, extra) {
      return '<div class="lt-stat' + (cls ? ' lt-stat--' + cls : '') + '"><div class="lt-stat__lbl">' + lbl +
        '</div><div class="lt-stat__val">' + val + '</div>' + (extra || '') + '</div>';
    };
    var h = '<div class="lt-sheet-wrap" data-lt-sheet="1">';
    h += '<div class="lt-stats">' +
      stat('', 'Piezas en la receta', _num(s.piezas)) +
      stat('', 'Materiales base', _num(s.materiales)) +
      stat(s.materiales && s.completos === s.materiales ? 'ok' : '', 'Completos',
        _num(s.completos) + ' <small>de ' + _num(s.materiales) + '</small>',
        '<div class="lt-bar" role="progressbar" aria-label="Materiales completos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
          s.pct + '"><i style="width:' + s.pct + '%"></i></div>') +
      stat(s.faltan ? 'miss' : 'ok', 'Unidades que faltan', s.faltan ? _num(s.faltan) : '✓ 0') +
      (s.compran ? stat('', 'Se compran a un NPC', _num(s.compran) + ' <small>pieza(s)</small>') : '') +
      '</div>';

    h += '<div class="lt-tabs" role="group" aria-label="Qué ver">' +
      '<button type="button" class="lt-tab" data-lt-view="arbol" aria-pressed="' + (vista === 'arbol') + '">Receta</button>' +
      '<button type="button" class="lt-tab" data-lt-view="totales" aria-pressed="' + (vista === 'totales') + '">Materiales totales</button>' +
      '</div>';

    h += '<div class="lt-sheet lt-sheet--' + vista + '">' +
      '<section class="lt-pane lt-pane--arbol" aria-label="Receta">' +
        '<div class="lt-pane__head"><h4 class="lt-pane__title">Receta</h4>' +
        '<span class="lt-pane__hint">Tocá una pieza para abrirla</span></div>' +
        '<div class="lt-pane__body">' + renderTreeHTML(res, opts) + '</div></section>' +
      '<section class="lt-pane lt-pane--totales" aria-label="Materiales totales">' +
        '<div class="lt-pane__head"><h4 class="lt-pane__title">Materiales totales</h4>' +
        '<span class="lt-pane__hint">Banco y almacén de materiales</span></div>' +
        '<div class="lt-pane__body">' + renderTotalsHTML(res, owned, opts) + '</div></section>' +
      '</div>';
    return h + '</div>';
  }

  // Aviso de íconos (v2.2.0). `s` lo arma el tracker:
  // { estado: 'cargando' | 'ok' | 'fallo', con, total }. Con 'ok' no se dice nada.
  function renderIconStatusHTML(s) {
    if (!s || s.estado === 'ok') return '';
    if (s.estado === 'cargando') {
      return '<div class="lt-icons lt-icons--cargando" role="status">Cargando íconos y nombres en español…</div>';
    }
    return '<div class="lt-icons" role="status"><span>No pude traer los íconos de la API de Guild Wars 2' +
      (s.total ? ' (' + _num(s.con || 0) + ' de ' + _num(s.total) + ')' : '') +
      '. La receta y las cantidades están completas.</span>' +
      '<button type="button" data-lt-icons-retry="1">Reintentar</button></div>';
  }

  // ==========================================================================
  // 8. API
  // ==========================================================================

  root.LegendaryTreeUI = {
    ensurePrecursors: ensurePrecursors,
    renderTreeHTML: renderTreeHTML,
    renderTotalsHTML: renderTotalsHTML,
    renderHeroHTML: renderHeroHTML,
    renderSheetHTML: renderSheetHTML,
    renderIconStatusHTML: renderIconStatusHTML,
    NIVEL_ABIERTO_POR_DEFECTO: NIVEL_ABIERTO_POR_DEFECTO,
    _resetCache: _resetCache,
    _num: _num,
    CSS: CSS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.LegendaryTreeUI;

})((typeof window !== 'undefined' ? window : globalThis));
