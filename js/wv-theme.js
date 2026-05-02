/*!
 * WV Theme — diseño unificado para Cámara del Brujo
 * v1.0.1 (2026-05-02)
 *
 * Cambios v1.0.1:
 *  - CORRECCIÓN: solo aplica border-left de color, el resto lo hereda de .card (theme-polish.css)
 *  - Eliminada la sobrescritura de border-top/right/bottom y box-shadow
 *  - La clase .card ya se agrega (se mantiene) para heredar el tema base
 *  - Mismo patrón que wallet-theme.js v1.3.0, meta-theme.js v1.4.2, etc.
 *
 * v1.0.0:
 *  - Aplica la receta visual unificada a las cards de la Tienda y Objetivos
 *  - Borde izquierdo de 3px del color de rareza (tienda) o modo (objetivos)
 *  - Observer para nuevas cards inyectadas dinámicamente
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[WVTheme] wv-theme.js v1.0.1 — solo border-left, hereda .card de theme-polish.css');

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

  // Colores de referencia para modos de objetivos (si no se detecta color)
  var MODE_COLORS = {
    'pve': '#a0ffc8',
    'pvp': '#ff6b6b',
    'wvw': '#ffd36b'
  };

  // ==========================================================================
  // DETECCIÓN DE COLOR PARA BORDER-LEFT
  // ==========================================================================

  function detectColor(card) {
    // 1) Leer el color aplicado en el título (rareza para tienda)
    var nameEl = card.querySelector('.wv-card__name');
    if (nameEl) {
      var color = nameEl.style.color;
      if (color && color !== 'rgb(233, 233, 241)' && color !== '#e9e9f1') return color;
    }

    // 2) Buscar modo PvE/PvP/WvW en objetivos
    var modeEl = card.querySelector('.wv-obj-mode, [data-wv-mode], [data-mode]');
    if (modeEl) {
      var mode = (modeEl.getAttribute('data-wv-mode') || modeEl.getAttribute('data-mode') || modeEl.textContent || '').trim().toLowerCase();
      if (mode === 'pve' || mode.includes('pve')) return '#a0ffc8';      // Verde PvE
      if (mode === 'pvp' || mode.includes('pvp')) return '#ff6b6b';      // Rojo PvP
      if (mode === 'wvw' || mode.includes('wvw')) return '#ffd36b';      // Ámbar WvW
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

      // Solo borde izquierdo de color — el resto lo hereda de .card (theme-polish.css)
      card.style.borderLeft = '3px solid ' + bLeft;
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
      muts.forEach(function (m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.wv-card') || n.matches('.wv-obj-card'))) {
            applyCardTheme(n);
          } else if (n.querySelectorAll) {
            var cards = n.querySelectorAll('.wv-card, .wv-obj-card');
            if (cards.length) {
              cards.forEach(applyCardTheme);
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
    var panel = document.getElementById('wvPanel');
    if (panel && !panel.hasAttribute('hidden')) {
      themeAllNow(panel);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

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

  document.addEventListener('gn:tokenchange', function () {
    setTimeout(function () {
      var p = document.getElementById('wvPanel');
      if (p && !p.hasAttribute('hidden')) themeAllNow(p);
    }, 400);
  });

  window.addEventListener('load', function() {
    setTimeout(function() {
      var panel = document.getElementById('wvPanel');
      if (panel && !panel.hasAttribute('hidden')) {
        themeAllNow(panel);
      }
    }, 1000);
  });

  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'wv') {
      setTimeout(function() {
        var panel = document.getElementById('wvPanel');
        if (panel) themeAllNow(panel);
      }, 500);
    }
  });

    console.info('[WVTheme] ready v1.0.1 — solo border-left, hereda .card de theme-polish.css');

  // ==========================================================================
  // API PÚBLICA — expuesta para que wv-shop-ui.js pueda forzar la aplicación
  // ==========================================================================
  window.WVTheme = {
    themeAllNow: themeAllNow
  };

})();   // ← cierre de la IIFE