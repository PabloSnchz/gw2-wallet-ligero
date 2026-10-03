/**
 * legendary-tree-ui.js — el árbol de fabricación y los totales, pintados.
 *
 * QUÉ ES Y QUÉ NO ES
 * El motor esta en `legendary-tree.js` y este archivo NO calcula cantidades:
 * las pide ahi con `build()` y las muestra. Si este archivo hiciera aritmetica
 * seria el segundo motor, y dos motores divergen sin que nadie lo note.
 * La unica cuenta que se hace ACA es `falta = max(0, necesito - tengo)`, que
 * depende del inventario del usuario y no de la receta.
 *
 * POR QUÉ ESTÁ SEPARADO DE `legendary-tracker.js`
 * El tracker ya tiene el catalogo, la cola, los filtros y el modal. El arbol es
 * una vista, y una vista que crece dentro del tracker termina pidiendo sus
 * propios helpers. Ademas el motor se puede testear sin DOM y la UI se puede
 * testear sin API: estan en archivos distintos porque se prueban distinto.
 *
 * LA CARGA PEREZOSA
 * `legendary-precursors.js` son 268 KB y la mayoria de quien abre la app nunca
 * abre un arbol. Se pide la PRIMERA vez que se abre un arbol y no antes. Si la
 * carga falla, `ensurePrecursors` responde `false` y la vista dice "receta no
 * disponible para este item" — el control queda, no desaparece: un boton que
 * se esconde cuando falla le deja al usuario sin forma de saber que paso.
 *
 * POR QUÉ `esc` VIENE POR PARAMETRO
 * Hay dos copias de `esc` en el repo ya (transversal #4). Agregar una tercera
 * aqui seria tapar el problema en vez de resolverlo. El tracker tiene la suya
 * y la pasa.
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
  // Idempotente: la segunda llamada con los datos ya presentes responde al
  // instante, sin volver a tocar el DOM.
  function ensurePrecursors(cb) {
    if (_listo || root.LegendaryPrecursors) { _listo = true; if (cb) cb(true); return; }
    // Un fallo previo no se reintenta en el mismo ciclo: reinyectar el script
    // cada vez que el usuario abre y cierra el modal es una tormenta de red.
    if (_fallo) { if (cb) cb(false); return; }

    _espera.push(cb || function () {});

    // Si varias cards se abren a la vez (o dos clics rapidos), la segunda
    // espera a la primera. Un `script` por callable descargaria 268 KB N veces.
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

  // Para los tests: olvidar lo que se sabe, sin tocar el DOM.
  function _resetCache() { _cargando = false; _listo = false; _fallo = false; _espera = []; }

  // ==========================================================================
  // 2. ESTADO DE EXPANSION
  // ==========================================================================

  // Cuantos niveles salen abiertos de entrada. Dos, y no uno por otra razon:
  // con UNO el usuario ve la raiz y sus 4 ingredientes directos —los 4 que
  // entran en la Forja Mistica— y no ve que ninguno es una bolsa de materiales.
  // Con DOS ve que cada uno de esos 4 se abre en subrecetas.
  var NIVEL_ABIERTO_POR_DEFECTO = 2;

  // Un valor EXPLICITO gana siempre, y hay que mirarlo PRIMERO.
  // Si se preguntara primero "¿esta en el nivel que sale abierto por defecto?",
  // el `false` que el usuario pone al tocar el chevron de un nivel 2 nunca se
  // leeria: el chevron se dibujaria, el nodo se cerraria y la fila seguiria
  // abierta. Un control que se ve y no hace nada es peor que no tenerlo.
  function _abierto(node, abiertos) {
    if (!node) return false;
    if (abiertos && Object.prototype.hasOwnProperty.call(abiertos, node.id)) {
      return !!abiertos[node.id];
    }
    if (!node.isLeaf && node.level <= NIVEL_ABIERTO_POR_DEFECTO) return true;
    return false;
  }

  // ==========================================================================
  // 3. PINTAR EL ARBOL
  // ==========================================================================

  var BADGE = {
    material:     { txt: 'material',    col: '#5aa0d6' },
    no_recipe:    { txt: 'sin receta',  col: '#d68a5a' },
    placeholder:  { txt: 'marcador',    col: '#8a8f9a' },
    vendor:       { txt: 'se compra',   col: '#c9a227' },
    unknown:      { txt: 'desconocido', col: '#a06a8f' },
    sinId:        { txt: 'sin id',      col: '#a06a8f' }
  };

  // El color del badge es 6 digitos (#rrggbb), asi que la version translucida
  // se arma APENDANDO alpha y no multiplicando. Multiplicar un hex por 0.6 da un
  // color equivocado y, peor, uno que NO es el mismo que el resto de la app.
  function _hexAlfa(hex, alpha) {
    var a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16);
    return hex + (a.length < 2 ? '0' + a : a);
  }

  function _badgeHTML(kind) {
    var b = BADGE[kind];
    if (!b) return '';   // 'recipe': lo normal, no lleva chapa
    return '<span style="font-size:0.58rem;padding:1px 6px;border-radius:20px;' +
      'border:1px solid ' + _hexAlfa(b.col, 0.35) + ';' +
      'color:' + _hexAlfa(b.col, 0.95) + ';letter-spacing:0.02em;white-space:nowrap;">' +
      b.txt + '</span>';
  }

  function _descendientes(node) {
    var n = 0;
    (function walk(x) {
      (x.children || []).forEach(function (c) { n++; walk(c); });
    })(node);
    return n;
  }

  function _fila(node, abiertos, esc, profundidad, de) {
    var abierto = _abierto(node, abiertos);
    var tieneHijos = !node.isLeaf && node.children && node.children.length;
    var sangria = 10 + profundidad * 14;
    var out = '';

    out += '<div class="lt-nodo-row" style="display:flex;align-items:center;gap:7px;' +
      'padding:4px 8px;margin-left:' + sangria + 'px;border-radius:7px;' +
      (tieneHijos ? 'cursor:pointer;' : 'cursor:default;') +
      'transition:background 0.15s ease;"' +
      (tieneHijos ? ' data-lt-toggle="' + node.id + '" role="button" tabindex="0"' +
        ' aria-expanded="' + (abierto ? 'true' : 'false') + '"' : '') + '>';

    // El chevron es lo UNICO que indica que hay algo abajo. Sin hijos, el hueco
    // se deja para que el texto de todas las filas empiece en el mismo pixel:
    // si el alineadovara con la profundidad, la columna de nombres se ve rota.
    out += '<span style="width:13px;flex-shrink:0;text-align:center;font-size:0.6rem;' +
      'color:var(--tx-3);">' + (tieneHijos ? (abierto ? '▾' : '▸') : '·') + '</span>';

    // Icono y color de rareza salen del MISMO resolvedor. El arbol y la tabla
    // lo comparten, y el arbol lo pasa entero a los hijos.
    var info = de ? de(node.id) : null;
    if (info && info.icon) {
      out += '<img src="' + esc(info.icon) + '" alt="" width="14" height="14" loading="lazy"' +
        ' style="width:14px;height:14px;flex-shrink:0;border-radius:2px;">';
    }

    // El nombre: primero el de la API (espanol, `lang=es`), y el de la receta
    // como respaldo. El orden importa y va al reves de como se caeria por
    // defecto: `node.name` sale de `tools/cl_recipes.json`, que es ingles de
    // origen y NO pasa por la API, asi que usarlo primero deja la pantalla
    // entera en ingles aunque el nombre traducido este disponible. Los ids que
    // no tengan ficha resuelta siguen mostrando el nombre de la receta, que es
    // mejor que mostrar el id.
    var nombreNodo = (info && info.name) || node.name;

    out += '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;' +
      'white-space:nowrap;font-size:0.76rem;color:' + ((info && info.color) || 'var(--tx-1)') + ';"' +
      ' title="' + esc(nombreNodo) + '">' + esc(nombreNodo) + '</span>';

    // La multiplicidad solo cuando es > 1. Un "×1" en todas las filas es ruido.
    if (node.count > 1) {
      out += '<span style="font-size:0.66rem;color:var(--tx-3);font-variant-numeric:tabular-nums;' +
        'white-space:nowrap;">×' + node.count + '</span>';
    }

    out += _badgeHTML(node.kind);

    // Cuanto hay debajo, sin abrirlo: el numero que hace decidir si vale la
    // pena hacer el clic.
    if (tieneHijos && !abierto) {
      var d = _descendientes(node);
      if (d) out += '<span style="font-size:0.6rem;color:var(--tx-3);white-space:nowrap;">+' + d + '</span>';
    }

    out += '</div>';

    if (node.note) {
      out += '<div style="margin-left:' + (sangria + 20) + 'px;font-size:0.62rem;' +
        'color:var(--tx-3);padding:1px 0 3px;">' + esc(node.note) + '</div>';
    }

    if (tieneHijos && abierto) {
      var hijos = '';
      for (var i = 0; i < node.children.length; i++) {
        hijos += _fila(node.children[i], abiertos, esc, profundidad + 1, de);
      }
      out += '<div class="lt-nodo-hijos">' + hijos + '</div>';
    }

    return out;
  }

  // Puro: recibe el resultado de build() y devuelve HTML. Sin DOM, sin API.
  function renderTreeHTML(res, opts) {
    opts = opts || {};
    var esc = opts.esc || function (s) { return String(s == null ? '' : s); };
    var abiertos = opts.abiertos || {};
    // `opts.de` lo inyecta el tracker, que es el unico que sabe de donde
    // salen los iconos. La vista no pide nada por su cuenta, igual que no
    // pide `esc`: si nadie lo pasa, se dibuja sin icono y sin color.
    var de = opts.de || null;

    // EL ORDEN DE ESTAS DOS GUARDAS ES LO QUE IMPORTA
    // `build()` devuelve `node: null` con `needsPrecursors: true` cuando faltan
    // los precursores. Si la guarda de `!res.node` corriera primero, el estado
    // "cargando" caeria en el mensaje de ERROR y el usuario leeria "no se pudo
    // construir el arbol" de algo que todavia no se intento construir. Por eso
    // `needsPrecursors` se mira PRIMERO: es un estado conocido, no un fallo.
    //
    // Sin los precursores NO se dibuja un arbol de un solo nivel. Se verian
    // 4 hijos y el usuario concluiria que la legendaria se hace con eso, que
    // es la lectura FALSA mas caro que puede tener esta pantalla.
    if (res && res.needsPrecursors) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;" data-lt-pending="1">' +
        '<div style="margin-bottom:8px;">Cargando las recetas completas…</div>' +
        '<button type="button" data-lt-retry="1" style="padding:6px 12px;border-radius:20px;' +
        'font-size:0.7rem;cursor:pointer;border:1px solid var(--bd-1);background:var(--bg-1);' +
        'color:var(--tx-2);">Reintentar</button></div>';
    }

    // Aca si: sin motor, o con algo que no es un resultado, no hay nada que
    // dibujar y hay que decirlo.
    if (!res || !res.node) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;">' +
        'No se pudo construir el arbol de este item.</div>';
    }

    var html = '<div class="lt-arbol" data-lt-tree="1">';
    html += _fila(res.node, abiertos, esc, 0, de);
    html += '</div>';

    // Lo que NO entra en la cuenta, dicho. Si desaparece, el usuario no tiene
    // forma de reportar el dato que falta.
    var pie = [];
    if (res.totals.vendor && res.totals.vendor.length) {
      pie.push('<div style="font-size:0.66rem;color:var(--tx-3);margin-top:10px;' +
        'padding-top:9px;border-top:1px solid rgba(255,255,255,0.06);">' +
        'No entra en el total: ' + res.totals.vendor.length + ' pieza(s) que se compran a un NPC.</div>');
    }
    if (res.totals.sinId && res.totals.sinId.length) {
      pie.push('<div style="font-size:0.66rem;color:var(--tx-3);margin-top:5px;">' +
        'No entra en el total: ' + res.totals.sinId.length + ' ingrediente(s) sin id en la fuente, ' +
        'no se pueden contar contra tu inventario.</div>');
    }
    if (res.totals.unknown && res.totals.unknown.length) {
      pie.push('<div style="font-size:0.66rem;color:var(--tx-3);margin-top:5px;">' +
        'No entra en el total: ' + res.totals.unknown.length + ' pieza(s) no estan en el catalogo de recetas.</div>');
    }
    return html + pie.join('');
  }

  // ==========================================================================
  // 4. PINTAR LOS TOTALES
  // ==========================================================================

  // Cada fila tiene las TRES columnas que pidio Pablo: tengo / necesito / falta.
  // "Tengo" sale del inventario del usuario, no de la receta, asi que la cuenta
  // se hace aca y no en el motor.
  function renderTotalsHTML(res, owned, opts) {
    opts = opts || {};
    var esc = opts.esc || function (s) { return String(s == null ? '' : s); };
    owned = owned || {};

    if (res && res.needsPrecursors) return renderTreeHTML(res, opts);

    var rows = (res && res.totals && res.totals.rows) || [];
    if (!rows.length) {
      return '<div style="padding:16px;color:var(--tx-3);font-size:0.78rem;">' +
        'Este item no tiene materiales base que contar.</div>';
    }

    var h = '<div style="padding:12px 14px;">';
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.74rem;">';
    h += '<thead><tr>' +
      '<th style="text-align:left;padding:5px 6px;font-size:0.62rem;color:var(--tx-3);' +
      'font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);">Material</th>' +
      '<th style="text-align:right;padding:5px 6px;font-size:0.62rem;color:var(--tx-3);' +
      'font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);width:58px;">Tengo</th>' +
      '<th style="text-align:right;padding:5px 6px;font-size:0.62rem;color:var(--tx-3);' +
      'font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);width:66px;">Necesito</th>' +
      '<th style="text-align:right;padding:5px 6px;font-size:0.62rem;color:var(--tx-3);' +
      'font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);width:58px;">Falta</th>' +
      '</tr></thead><tbody>';

    var totT = 0, totN = 0, totF = 0;
    rows.forEach(function (r, i) {
      var tengo = owned[r.itemId] || 0;
      var necesito = r.need || 0;
      var falta = Math.max(0, necesito - tengo);
      totT += tengo; totN += necesito; totF += falta;
      var borde = i ? 'border-top:1px solid rgba(255,255,255,0.04);' : '';
      // El mismo `de` que el arbol. Sin el, la celda queda en var(--tx-1)
      // como estaba: que la red falle no puede sacar la tabla de pantalla.
      var infoFila = opts.de ? opts.de(r.itemId) : null;
      // MEDIDO (HB#157): los ids de estas filas estan 100% cubiertos por el
      // contrato de precursores, o sea que el icono estaba DISPONIBLE y la
      // tabla no lo pedia — solo leia el color. Por eso el <img> faltaba.
      var nombreFila = (infoFila && infoFila.name) || r.name;
      h += '<tr style="' + borde + '">' +
        '<td style="padding:5px 6px;color:' + ((infoFila && infoFila.color) || 'var(--tx-1)') +
        ';overflow:hidden;text-overflow:ellipsis;' +
        'max-width:0;" title="' + esc(nombreFila) + '">' +
        (infoFila && infoFila.icon
          ? '<img src="' + esc(infoFila.icon) + '" alt="" width="14" height="14" loading="lazy"' +
            ' style="width:14px;height:14px;vertical-align:-2px;margin-right:5px;' +
            'border-radius:2px;">'
          : '') +
        esc(nombreFila) + '</td>' +
        '<td style="padding:5px 6px;text-align:right;color:var(--tx-3);' +
        'font-variant-numeric:tabular-nums;">' + tengo + '</td>' +
        '<td style="padding:5px 6px;text-align:right;color:var(--tx-1);' +
        'font-variant-numeric:tabular-nums;">' + necesito + '</td>' +
        '<td style="padding:5px 6px;text-align:right;font-variant-numeric:tabular-nums;' +
        (falta ? 'color:' + (falta > tengo ? '#d68a5a' : '#d6b05a') + ';' : 'color:var(--tx-3);') +
        'font-weight:' + (falta ? '600' : '400') + ';">' + falta + '</td>' +
        '</tr>';
    });

    h += '</tbody></table>';

    h += '<div style="display:flex;justify-content:space-between;margin-top:9px;padding-top:8px;' +
      'border-top:1px solid rgba(255,255,255,0.08);font-size:0.68rem;color:var(--tx-3);">' +
      '<span>' + rows.length + ' material(es)</span>' +
      '<span>faltan <strong style="color:var(--tx-1);">' + totF + '</strong> unidades</span>' +
      '</div>';

    return h + '</div>';
  }

  // ==========================================================================
  // 5. API
  // ==========================================================================

  root.LegendaryTreeUI = {
    ensurePrecursors: ensurePrecursors,
    renderTreeHTML: renderTreeHTML,
    renderTotalsHTML: renderTotalsHTML,
    NIVEL_ABIERTO_POR_DEFECTO: NIVEL_ABIERTO_POR_DEFECTO,
    _resetCache: _resetCache
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.LegendaryTreeUI;

})((typeof window !== 'undefined' ? window : globalThis));