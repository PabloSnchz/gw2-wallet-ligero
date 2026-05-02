/*!
 * WV Theme — diseño unificado para Cámara del Brujo
 * v1.0.0 (2026-05-01)
 *
 * Aplica la receta visual unificada a las cards de la Tienda y Objetivos:
 *  - Borde neutro rgba(255,255,255,0.08)
 *  - Glow suave rgba(90,110,154,0.12)
 *  - Borde izquierdo de 3px del color de rareza (tienda) o modo (objetivos)
 *  - Hover: translateY(-3px) + sombra profunda (heredado de .card)
 *  - Observer para nuevas cards inyectadas dinámicamente
 *
 * NO modifica la lógica de renderizado ni el estado.
 * Si falla, la tienda se ve como antes.
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[WVTheme] wv-theme.js v1.0.0 — unificación visual de WV');

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  // ==========================================================================
  // CONSTANTES DE LA RECETA UNIFICADA
  // ==========================================================================

  var bNeutral = 'rgba(255, 255, 255, 0.08)';
  var gNeutral = 'rgba(90, 110, 154, 0.12)';

  // Colores de referencia para modos de objetivos (si no se detecta color)
  var MODE_COLORS = {
    'pve': '#a0ffc8',
    'pvp': '#cfd1ff',
    'wvw': '#ffd3b3'
  };

  // ==========================================================================
  // DETECCIÓN DE COLOR PARA BORDER-LEFT
  // ==========================================================================

  function detectColor(card) {
    // 1) Leer el color aplicado por router.js en el título (rareza)
    var nameEl = card.querySelector('.wv-card__name');
    if (nameEl) {
      var color = nameEl.style.color;
      if (color && color !== 'rgb(233, 233, 241)' && color !== '#e9e9f1') return color;
    }

    // 2) Buscar modo PvE/PvP/WvW en objetivos
    var modeEl = card.querySelector('.wv-obj-mode, [data-wv-mode], [data-mode]');
    if (modeEl) {
      var mode = (modeEl.getAttribute('data-wv-mode') || modeEl.getAttribute('data-mode') || modeEl.textContent || '').trim().toLowerCase();
      if (MODE_COLORS[mode]) return MODE_COLORS[mode];
    }

    // 3) Fallback: color neutro
    return '#FFFFFF';
  }

  // ==========================================================================
  // APLICAR TEMA A UNA CARD
  // ==========================================================================

  function applyCardTheme(card) {
    if (!card || card.__wvThemed) return;
    card.__wvThemed = true;

    try {
      var color = detectColor(card);
      var bLeft = hexToRGBA(color, 0.5);

      card.style.border = 'none';
      card.style.borderLeft = '3px solid ' + bLeft;
      card.style.borderTop = '1px solid ' + bNeutral;
      card.style.borderRight = '1px solid ' + bNeutral;
      card.style.borderBottom = '1px solid ' + bNeutral;
      card.style.boxShadow = '0 0 8px ' + gNeutral;
      card.classList.add('card');
    } catch (_) {}
  }

  // ==========================================================================
  // APLICAR A TODAS LAS CARDS EXISTENTES
  // ==========================================================================

  function themeAllNow(root) {
    var host = root || document;
    var cards = host.querySelectorAll('.wv-card, .wv-obj-card');
    cards.forEach(function(card) {
      applyCardTheme(card);
    });
  }

  // ==========================================================================
  // OBSERVER PARA NUEVAS CARDS
  // ==========================================================================

  function observePanel() {
    var panel = document.getElementById('wvPanel');
    if (!panel || panel.__wvThemeObs) return;
    panel.__wvThemeObs = true;

    var mo = new MutationObserver(function (muts) {
      var needsTheme = false;
      muts.forEach(function (m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.wv-card') || n.matches('.wv-obj-card'))) {
            applyCardTheme(n);
            needsTheme = true;
          } else if (n.querySelectorAll) {
            var cards = n.querySelectorAll('.wv-card, .wv-obj-card');
            if (cards.length) {
              cards.forEach(applyCardTheme);
              needsTheme = true;
            }
          }
        });
      });
    });

    mo.observe(panel, { childList: true, subtree: true });
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================

  function init() {
    observePanel();
    // Aplicar a cards ya renderizadas
    var panel = document.getElementById('wvPanel');
    if (panel && !panel.hasAttribute('hidden')) {
      themeAllNow(panel);
    }
  }

  // Disparar en múltiples momentos para cubrir todos los casos
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Al navegar a WV
  window.addEventListener('hashchange', function () {
    var p = document.getElementById('wvPanel');
    if (p && !p.hasAttribute('hidden')) {
      setTimeout(function () { themeAllNow(p); }, 150);
    }
  });

  document.addEventListener('gn:tabchange', function (ev) {
    if (ev.detail && ev.detail.view === 'wv') {
      setTimeout(function () {
        var p = document.getElementById('wvPanel');
        if (p) themeAllNow(p);
      }, 200);
    }
  });

  // Al cambiar de API key (se recargan objetivos/tienda)
  document.addEventListener('gn:tokenchange', function () {
    setTimeout(function () {
      var p = document.getElementById('wvPanel');
      if (p && !p.hasAttribute('hidden')) themeAllNow(p);
    }, 400);
  });
  // Forzar aplicación del tema después de que todo esté listo
  window.addEventListener('load', function() {
    setTimeout(function() {
      var panel = document.getElementById('wvPanel');
      if (panel && !panel.hasAttribute('hidden')) {
        themeAllNow(panel);
      }
    }, 1000);
  });
  
  // También al cambiar a la tab de tienda
  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'wv') {
      setTimeout(function() {
        var panel = document.getElementById('wvPanel');
        if (panel) themeAllNow(panel);
      }, 500);
    }
  });
  console.info('[WVTheme] ready v1.0.0');
})();