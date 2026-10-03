/*!
 * js/commerce-delivery-theme.js — Capa 3 (color semántico) del banner de caja del TP
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.0 (2026-09-29)
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * El banner "caja del Trading Post sin cobrar" (js/converter-modal.js v1.1.0,
 * `renderDeliveryBanner()`) necesita un borde izquierdo de color que comunique
 * el estado de un vistazo. Ese color es SEMÁNTICO, no temático:
 *
 *   pending → hay plata esperando: oro/ámbar (atención, acción)
 *   error   → no se pudo leer: rojo (algo está mal de verdad)
 *
 * 'empty' no se dibuja, así que no necesita color. Esa asimetría es
 * intencional: el silencio es el estado normal, y el color se reserva para
 * los dos estados que exigen una acción.
 *
 * REGLAS QUE RESPETA (AGENTS.md, "Arquitectura CSS en 3 capas")
 *  - Este archivo escribe UNA sola propiedad: `borderLeft`.
 *    Jamás `border`, `boxShadow`, `borderRadius` ni `transition` — esas son
 *    de theme-polish.css (capa 2). Nunca `!important`.
 *  - La estructura (padding, flex, gap, tipografía) vive en main.css (capa 1).
 *  - No depende del tema activo: los dos colores son estados, no skins. Por
 *    eso no re-aplica nada al cambiar de tema; solo garantiza que el elemento
 *    recién renderizado conserve su color.
 *
 * Patrón de aplicación: `MutationObserver` sobre el contenedor del modal, igual
 * que js/fractal-tracker-theme.js. Así `converter-modal.js` no necesita saber
 * que este archivo existe: alcanza con marcar `data-cv-color` en el markup.
 */

(function () {
  'use strict';

  var LOG = '[CommerceDeliveryTheme]';
  var VERSION = '1.0.0';

  // Receta visual unificada (AGENTS.md): borde izquierdo 3px al 50% del color.
  var COLORS = {
    'pending': 'rgba(255,211,107,0.5)', // ítems sin cobrar: el estado que alerta
    'error':   'rgba(255,157,157,0.5)'  // no se pudo leer: hay que reintentar
  };

  var DEFAULT_ROLE = 'pending';
  var SELECTOR = '.cv-delivery[data-cv-color]';

  function roleOf(el) {
    var r = el.getAttribute('data-cv-color');
    return (r && COLORS[r]) ? r : DEFAULT_ROLE;
  }

  /**
   * Aplica el color semántico. ÚNICA escritura de estilo de todo el archivo.
   */
  function paint(el) {
    if (!el) return;
    var color = COLORS[roleOf(el)];
    if (el.__cvPainted === color) return;
    // `borderLeft` es un SHORTHAND: asignarle solo el color resetea las otras
    // longhands a su valor inicial (width=medium, style=none), y con style=none
    // el borde no se dibuja. Hay que pasar el shorthand completo, igual que
    // achievements-theme.js:104, characters-theme.js:103, meta-theme.js:400,
    // wallet-theme.js:148 y wv-theme.js:87.
    el.style.borderLeft = '3px solid ' + color;
    el.__cvPainted = color;
  }

  function paintAll(root) {
    var nodes = (root || document).querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) paint(nodes[i]);
  }

  function start() {
    if (!document.body) return false;
    // El modal se renderiza on demand, así que no hay nodo fijo al que
    // pegarse: se observa el documento entero, que es donde aparece.
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(SELECTOR)) paint(n);
          if (n.querySelectorAll) paintAll(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // El banner también puede re-renderizarse sobre un nodo ya existente.
    paintAll(document);
    console.info(LOG + ' v' + VERSION + ' activo (capas 1-2 en CSS, borderLeft acá)');
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Re-aplica al reabrir el modal, por si el observer perdiera un nodo.
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#convModal')) {
      setTimeout(function () { paintAll(document); }, 0);
    }
  });
})();
