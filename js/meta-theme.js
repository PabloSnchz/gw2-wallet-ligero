/*!
 * Meta Theme (expansión/temporada) — outline + halo usando --meta-title-color
 * v1.0.0 (2026-03-01)
 *
 * Idea clave: meta.js ya define en cada tarjeta:
 *   <article class="meta-card meta-card--tint-title" style="--meta-title-color:#HEX">
 * Este script lee ese color y dibuja el glow/borde como en WV/Wallet.
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[MetaTheme] meta-theme.js v1.0.0 — glow por expansión via --meta-title-color');

  // === DEBUG opcional ===
  var DEBUG = false; // poné true para ver en consola el color detectado

  // --- Utils -------------------------------------------------------------------
  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim();
      if (!h) return null;
      // Aceptar "rgb(...)" o "rgba(...)" por flexibilidad (aunque esperamos #hex)
      if (/^rgba?\(/i.test(h)) return h.replace(/\s+/g,''); // ya es rgba/rgb
      // Normalizar #RGB y #RRGGBB
      h = h.replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  function getMetaTint(card) {
    try {
      // 1) Intento directo: atributo style inline (lo setea meta.js)
      var inline = card.getAttribute('style') || '';
      var m = inline.match(/--meta-title-color\s*:\s*([^;]+)/i);
      if (m && m[1]) return String(m[1]).trim();

      // 2) Fallback: leer la variable computada (por si viniera desde CSS externo)
      var cs = getComputedStyle(card);
      var v = cs.getPropertyValue('--meta-title-color');
      if (v) return String(v).trim();
    } catch (_) {}
    return ''; // no hay tinte
  }

  function applyMetaTheme(card) {
    if (!card) return;

    var tint = getMetaTint(card) || '#FFFFFF';
    if (DEBUG) console.log('[MetaTheme] tint:', tint, 'for card', card.getAttribute('data-id') || '');

    // Misma receta que WV/Wallet: borde interior sutil + glow exterior
    var bColor = hexToRGBA(tint, 0.26); // borde/overlay interior
    var gColor = hexToRGBA(tint, 0.34); // glow exterior

    // 1) Título: reforzar el color (si por alguna razón no lo tomó)
    try {
      var title =
        card.querySelector('.meta-card__title') || // skin moderna
        card.querySelector('.m-title');             // compat
      if (title) title.style.color = tint;
    } catch (_) {}

    // 2) Contenedor de tarjeta: borde + glow
    try {
      if (bColor && gColor) {
        card.style.border = '1px solid ' + bColor;
        // Dos sombras: una "inset" finita para integrar el color en el borde,
        // y otra suave hacia afuera para dar el halo.
        card.style.boxShadow = '0 0 0 1px ' + bColor + ' inset, 0 0 14px ' + gColor;
      }
      // Asegurar radio por consistencia con tu piel
      if (!card.style.borderRadius) card.style.borderRadius = '12px';
    } catch (_) {}

    // 3) (Opcional) Decorar un elemento “icon wrapper” si en el futuro sumás un ícono
    //    En Meta no hay ícono fijo de cabecera como en WV/Wallet; si lo agregás:
    // try {
    //   var iconWrap = card.querySelector('.meta-card__iconWrap');
    //   if (iconWrap && bColor && gColor) {
    //     iconWrap.style.boxShadow = '0 0 0 2px ' + bColor + ', 0 0 10px ' + gColor;
    //     iconWrap.style.borderRadius = '6px';
    //   }
    // } catch (_) {}
  }

  function themeMetaNow(root) {
    var host = (root || document).querySelector('#metaPanel') || root || document;
    var cards = $$('.meta-card, .m-card', host);
    cards.forEach(applyMetaTheme);
  }

  // --- Observer para re-renders de la lista ------------------------------------
  var mo = null;
  function ensureObserver() {
    if (mo) return;
    var panel = $('#metaPanel') || document;
    mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.meta-card, .m-card'))) {
            applyMetaTheme(n);
          } else {
            $$('.meta-card, .m-card', n).forEach(applyMetaTheme);
          }
        });
      });
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  // --- Hooks de navegación / arranque ------------------------------------------
  function onRoute() { requestAnimationFrame(function(){ themeMetaNow(document); }); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ onRoute(); ensureObserver(); });
  } else {
    onRoute(); ensureObserver();
  }

  // Si cambiás de tab con el header o por router
  window.addEventListener('hashchange', function () {
    var p = $('#metaPanel');
    if (p && !p.hasAttribute('hidden')) onRoute();
  });
  document.addEventListener('gn:tabchange', function (ev) {
    if (ev.detail && ev.detail.view === 'meta') onRoute();
  });
})();