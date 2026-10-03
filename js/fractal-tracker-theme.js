/*!
 * js/fractal-tracker-theme.js — Capa 3 (color semántico) del bloque de fractales
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.1 (2026-09-29) — fix: borderLeft shorthand completo (COMM 022)
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * El commit `27b8394` (fix de datos falsos de la rotación diaria) corrigió el
 * contenido del panel de fractales, pero dejó sus estilos en `style=` inline.
 * Eso mezclaba las 3 capas de CSS en un solo atributo y, peor, metía tres
 * `rgba(...)` literales dentro del JS: color semántico vivido exactamente en el
 * lugar donde la arquitectura dice que no debe.
 *
 * REGLAS QUE RESPETA (AGENTS.md, "Arquitectura CSS en 3 capas")
 *  - Este archivo escribe UNA sola propiedad: `borderLeft`.
 *    Jamás `border`, `boxShadow`, `borderRadius` ni `transition` — esas son de
 *    `theme-polish.css`. Nunca `!important`.
 *  - La estructura (padding, flex, grid, tipografía) vive en
 *    `theme-polish.css` bajo `.fractal-card` / `.fractal-notice`.
 *  - Este componente NO cambia con el tema activo: los tres `borderLeft` son
 *    semánticos (info / T4 / T4 con Challenge Mode), no temáticos. Por eso no
 *    re-aplica nada al cambiar de tema; sólo garantiza que el elemento recién
 *    renderizado conserve su color.
 *
 * Patrón de aplicación: `MutationObserver` sobre `#fractalsBody`. Es el mismo
 * enfoque que usa `activities-theme.js` para el glow de los nodos, y evita
 * que `activities.js` tenga que conocer la existencia de este archivo.
 */

(function () {
  'use strict';

  var LOG = '[FractalTrackerTheme]';
  var VERSION = '1.0.0';

  // Receta visual unificada (AGENTS.md): borde izquierdo 3px al 50% del color.
  var COLORS = {
    'info': 'rgba(123,194,255,0.5)',   // aviso: la API no expone la rotación
    't4': 'rgba(160,255,200,0.5)',     // fractal T4 disponible
    'cm': 'rgba(255,211,107,0.5)'      // fractal T4 con Challenge Mode
  };

  var DEFAULT_ROLE = 't4';

  function roleOf(el) {
    var r = el.getAttribute('data-fl-color');
    return (r && COLORS[r]) ? r : DEFAULT_ROLE;
  }

  /**
   * Aplica el color semántico. ÚNICA escritura de estilo del archivo.
   */
  function paint(el) {
    if (!el || el.__flPainted === COLORS[roleOf(el)]) return;
    // `borderLeft` es un SHORTHAND: asignarle solo el color resetea las otras
    // longhands a su valor inicial (width=medium, style=none), y con style=none
    // el borde no se dibuja. Mismo fix que commerce-delivery-theme.js.
    el.style.borderLeft = '3px solid ' + COLORS[roleOf(el)];
    el.__flPainted = COLORS[roleOf(el)];
  }

  function paintAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('.fractal-card[data-fl-color], .fractal-notice[data-fl-color]');
    for (var i = 0; i < nodes.length; i++) paint(nodes[i]);
  }

  function ensureObserver() {
    var body = document.getElementById('fractalsBody');
    if (!body || body.__flObserved) return;

    var observer = new MutationObserver(function (mutations) {
      // El panel se re-renderiza con innerHTML completo: repintamos lo que
      // acaba de aparecer. Es barato (decenas de nodos) y no depende de que
      // activities.js nos avise.
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && (n.classList.contains('fractal-card') || n.classList.contains('fractal-notice'))) {
            paint(n);
          }
          if (n.querySelectorAll) paintAll(n);
        }
      }
    });

    observer.observe(body, { childList: true, subtree: true });
    body.__flObserved = true;
    body.__flObserver = observer;
  }

  function init() {
    paintAll();
    ensureObserver();
    console.info(LOG, 'ready v' + VERSION + ' — borderLeft para .fractal-card / .fractal-notice');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // El panel puede montarse después del DOMContentLoaded (routing por hash).
  // Reintentamos unas pocas veces sin dejar observers huérfanos.
  var attempts = 0;
  var retry = setInterval(function () {
    if (document.getElementById('fractalsBody')) {
      clearInterval(retry);
      ensureObserver();
      paintAll();
    } else if (++attempts > 20) {
      clearInterval(retry);
      console.warn(LOG, '#fractalsBody no apareció; color semántico sin aplicar');
    }
  }, 500);
})();
