/**
 * item-icons.js — icono y color de rareza de un item, resueltos desde la API.
 *
 * QUE ES Y QUE NO ES
 * Este archivo NO es un cliente de items. El cliente ya existe y esta probado:
 * `GW2Api.getItemsMany(ids, opts)` (api-gw2.js:1779) corta en lotes de 200,
 * cachea por id en `items_cache_v1:<lang>`, deduplica la entrada, reintenta el
 * 206 parcial y degrada lote por lote cuando la red falla. Escribir un segundo
 * cliente aca seria el defecto exacto que la arquitectura prohibe: dos caminos
 * para pedir lo mismo, y el que se rompe es el que nadie prueba.
 *
 * Lo UNICO que hace este archivo es:
 *   1) juntar los ids de un arbol entero en UNA llamada a `getItemsMany`
 *   2) guardar el resultado en un mapa id -> {icon, rarity, color, name}
 *   3) derivar el color con el mapa de rareza que ya usa el resto de la app
 *
 * DE DONDE SALE EL COLOR, Y POR QUE NO SE AGRUPA POR rarity_color
 * El color sale de `RARITY_COLORS[rarity]`. La API tambien trae `rarity_color`,
 * pero ese NO se usa: los coleccionables tienen un color propio que no es el de
 * su rareza, y usarlo solo aca dejaria la Armeria pintando de una forma y los
 * otros cuatro modulos de otra. Es la regla del transversal #6 al reves.
 *
 * La rareza llega YA TRADUCIDA. `CFG.LANG` es 'es' (api-gw2.js:457), y con
 * lang=es el endpoint devuelve "Ascendido", "Legendario", "Exotico". Por eso
 * `RARITY_COLORS[rarity]` funciona sin mapa de traduccion: es lo que ya hacen
 * los otros consumidores (converter-modal.js:620). Si alguna vez `rarity`
 * llegara en ingles, el acceso directo daria undefined y TODA la app saldria
 * en blanco, no solo este modulo.
 *
 * LA QUINTA COPIA DEL MAPA
 * RARITY_COLORS ya esta copiado en inventory-hub.js:26, router.js:44,
 * wv-shop-ui.js:42 y converter-modal.js:411. Este es el quinto, y se declara
 * como deuda en vez de esconderse. La salida correcta es exponer uno solo y
 * apuntar los cinco a el; es un cambio de cuatro archivos que no se hizo aca
 * porque ninguno de los cuatro estaba en el alcance de este trabajo.
 * Si `window.RARITY_COLORS` aparece algun dia, esta copia se apaga sola.
 *
 * PRESUPUESTO PROPIO DE PERSISTENCIA, NO SEGUNDO CLIENTE
 * El cliente sigue siendo UNO: `getItemsMany`. Lo que cambia es DONDE guarda.
 * Este mapa es de memoria de sesion (se pierde al recargar), y ademas se le
 * pide a `getItemsMany` un presupuesto propio en disco: `cacheKey:
 * 'items_cache_armory_v1'` con `cacheTrim:1300` y `cacheCap:1200`.
 *
 * POR QUE EXISTE. El cap por defecto esta dimensado para una tanda corta de
 * ids: en api-gw2.js el recorte son DOS numeros en la MISMA linea, el umbral
 * que dispara (500) y lo que deja cuando dispara (400). La Armeria pide 906
 * ids de una vez, y con el default el cache se recortaba a si mismo: de los 906
 * quedaban 400 con icono y color para la sesion siguiente, y los 506 restantes
 * se perdian al recargar. Por eso "subir el tope" no era una constante sino
 * dos, y por eso van los tres numeros juntos.
 *
 * LO QUE ESTO NO ES. Sigue sin haber batching aca, ni cache por id, ni
 * reintento del 206 parcial, ni degradacion por lote: todo eso es de
 * `getItemsMany`, y no se reimplementa. Un segundo cache EN MEMORIA sobre los
 * mismos ids si seria una segunda fuente de verdad; darle a un cliente una
 * clave distinta, no.
 *
 * Y los otros 9 call sites no se mueven: no pasan ninguna de las tres opciones,
 * asi que leen los defaults y hacen byte a byte lo que hacen hoy. Eso esta
 * afirmado como comportamiento en tests/armeria-item-icons.test.js, en la
 * seccion [5], y es el candado de este cambio.
 *
 * CUANDO FALLA LA RED
 * `getItemsMany` ya degrada: cada lote va con su propio `.catch`, asi que un
 * fallo devuelve lo que se pudo traer y no lanza. Este modulo no re-inventa el
 * camino degradado: resuelve igual, deja los ids sin datos, y la vista los
 * dibuja sin icono y sin color. Un arbol con el nombre sin pintar es mil veces
 * mejor que un arbol que no se dibuja.
 */
(function (root) {
  'use strict';

  var LOG = '[ItemIcons]';

  // Quinta copia, documentada arriba. Mismo orden y mismos valores que
  // inventory-hub.js:26-30.
  var RARITY_COLORS = {
    'Chatarra': '#AAAAAA',
    'Básico': '#FFFFFF',
    'Bueno': '#62A4DA',
    'Obra maestra': '#1A9306',
    'Raro': '#FCD00B',
    'Exótico': '#FFA405',
    'Ascendido': '#FB3E8D',
    'Legendario': '#974EFF'
  };

  // "id" -> { icon, rarity, color }
  var _datos = {};
  // La tanda en vuelo. Dos cargas seguidas sobre el mismo arbol no pueden
  // disparar dos peticiones del mismo set de ids: se pegarian y la segunda
  // recibiria un array vacio de la primera.
  // receberia un array vacio del primero.
  var _vuelo = null;

  function _mapaDeColores() {
    return (root.RARITY_COLORS && typeof root.RARITY_COLORS === 'object')
      ? root.RARITY_COLORS
      : RARITY_COLORS;
  }

  function _colorDe(rarity) {
    if (!rarity) return null;
    return _mapaDeColores()[rarity] || null;
  }

  function _api() {
    var api = root.GW2Api;
    return (api && typeof api.getItemsMany === 'function') ? api : null;
  }

  // Id 0 y null se van antes de pedir. `getItemsMany` solo filtra `!= null`
  // (api-gw2.js:1781), asi que el 0 PASARIA y la API lo rechaza con 404. Las
  // dos aristas con itemId 0 del contrato de precursores (Relic any en 101540,
  // Testimony of Castoran Heroics en 109686) no son items: filtrarlas aca es lo
  // que hace que un id 0 no pueda romper el render.
  function _idsUtiles(ids) {
    var vistos = {};
    var out = [];
    if (!ids || !ids.length) return out;
    for (var i = 0; i < ids.length; i++) {
      var id = Number(ids[i]);
      if (!id || !isFinite(id) || id < 0) continue;
      var k = String(id);
      if (vistos[k]) continue;
      vistos[k] = 1;
      out.push(id);
    }
    return out;
  }

  /**
   * Pide los datos de N ids. Resuelve siempre; nunca rechaza.
   * @param {number[]} ids
   * @returns {Promise<Object>} el mapa id -> {icon, rarity, color, name}
   */
  function cargar(ids) {
    var faltan = _idsUtiles(ids).filter(function (id) { return !_datos[String(id)]; });

    if (!faltan.length) return Promise.resolve(_datos);

    var api = _api();
    // Sin API todavia no es un error: el arbol se dibuja sin icono y sin color.
    if (!api) return Promise.resolve(_datos);

    if (_vuelo) return _vuelo.then(function () { return cargar(ids); });

    // Presupuesto propio de disco (ver el encabezado). MEDIDO en HB#157: el lote
    // que pide la Armeria son **1113 ids distintos**, no 906 — 907 del contrato
    // de precursores MAS las 206 legendarias del catalogo, que son las RAICES del
    // arbol y no viven en ese contrato. El cap tiene que quedar POR ENCIMA del
    // lote: si el cap fuera menor, el recorte se comeria ids que este mismo render
    // esta por traer — que es exactamente el bug que este presupuesto existe
    // para arreglar, reintroducido por el otro lado. Con cap=906 el recorte
    // echaba 207 ids y el trim (1000) disparaba. 1200/1300 dejan margen.
    _vuelo = api.getItemsMany(faltan, {
      nocache: false,
      cacheKey: 'items_cache_armory_v1',
      cacheTrim: 1300,
      cacheCap: 1200
    })
      .then(function (items) {
        (items || []).forEach(function (it) {
          if (!it || it.id == null) return;
          var id = Number(it.id);
          if (!id || !isFinite(id)) return;
          _datos[String(id)] = {
            icon: it.icon || null,
            rarity: it.rarity || null,
            color: _colorDe(it.rarity),
            // El NOMBRE, que se estaba tirando. `it.name` YA VINO en espanol:
            // la API se pide con lang=es (api-gw2.js:457, CFG.LANG='es'). Todo
            // item que pase por aca tiene su nombre traducido disponible y no
            // se estaba guardando. Sin esto, la Armeria muestra el nombre en
            // ingles que trae `cl_recipes.json` (fuente, no API) para TODO item
            // que tenga ficha, en vez de solo para los que no la tienen.
            name: it.name || null
          };
        });
      })
      .catch(function (e) {
        // `getItemsMany` degrada lote por lote, asi que llegar aca significa que
        // fallo algo mas serio que una llamada. Se avisa y se sigue: el arbol
        // tiene que verse igual.
        if (root.console && root.console.warn) root.console.warn(LOG, 'cargar', e);
      })
      .then(function () {
        _vuelo = null;
        return _datos;
      });

    return _vuelo;
  }

  /** Lo que se sabe de un id. SIEMPRE un objeto, nunca undefined. */
  function de(id) {
    return _datos[String(id)] || { icon: null, rarity: null, color: null, name: null };
  }

  function iconDe(id) { return de(id).icon; }
  function colorDe(id) { return de(id).color; }

  /** Para los tests: olvidar lo aprendido sin tocar la API. */
  function _reset() {
    _datos = {};
    _vuelo = null;
  }

  var ItemIcons = {
    cargar: cargar,
    de: de,
    iconDe: iconDe,
    colorDe: colorDe,
    RARITY_COLORS: RARITY_COLORS,
    _reset: _reset
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ItemIcons;
  if (typeof root !== 'undefined' && root) root.ItemIcons = ItemIcons;

})((typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));