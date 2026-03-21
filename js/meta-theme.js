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
  /*!
 * Meta Theme (expansión/temporada) — outline + halo usando --meta-title-color
 * v1.1.0 (2026-03-21)
 *
 * Cambios v1.1.0:
 *  - Migración de badges de estado a canónicos (.badge--success/warning/info)
 *  - Migración de etiquetas de infusión/drop a badges
 *  - Migración de textos "Próximo en X" a pill
 *  - Añadida clase .card canónica a tarjetas
 *  - Compatibilidad total con theme-polish.css v2.0
 *
 * v1.0.0: glow por expansión via --meta-title-color
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[MetaTheme] meta-theme.js v1.1.0 — glow por expansión + badges canónicos');

  // === DEBUG opcional ===
  var DEBUG = false; // poné true para ver en consola el color detectado

  // --- Utils -------------------------------------------------------------------
  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim();
      if (!h) return null;
      if (/^rgba?\(/i.test(h)) return h.replace(/\s+/g,'');
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
      var inline = card.getAttribute('style') || '';
      var m = inline.match(/--meta-title-color\s*:\s*([^;]+)/i);
      if (m && m[1]) return String(m[1]).trim();
      var cs = getComputedStyle(card);
      var v = cs.getPropertyValue('--meta-title-color');
      if (v) return String(v).trim();
    } catch (_) {}
    return '';
  }

  function applyMetaTheme(card) {
    if (!card) return;

    var tint = getMetaTint(card) || '#FFFFFF';
    if (DEBUG) console.log('[MetaTheme] tint:', tint, 'for card', card.getAttribute('data-id') || '');

    var bColor = hexToRGBA(tint, 0.26);
    var gColor = hexToRGBA(tint, 0.34);

    try {
      var title = card.querySelector('.meta-card__title') || card.querySelector('.m-title');
      if (title) title.style.color = tint;
    } catch (_) {}

    try {
      if (bColor && gColor) {
        card.style.border = '1px solid ' + bColor;
        card.style.boxShadow = '0 0 0 1px ' + bColor + ' inset, 0 0 14px ' + gColor;
      }
      if (!card.style.borderRadius) card.style.borderRadius = '12px';
    } catch (_) {}
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

  window.addEventListener('hashchange', function () {
    var p = $('#metaPanel');
    if (p && !p.hasAttribute('hidden')) onRoute();
  });
  document.addEventListener('gn:tabchange', function (ev) {
    if (ev.detail && ev.detail.view === 'meta') onRoute();
  });

  /* ==========================================================================
     EXTENSIÓN v1.1.0 — Migración a componentes canónicos
     ========================================================================== */

  // Migración de tarjetas a clase .card canónica
  function migrateCardsToCardClass(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    var cards = metaPanel.querySelectorAll('.meta-card:not(.card), .m-card:not(.card)');
    cards.forEach(function(card) { card.classList.add('card'); });
  }

  // Migración de badges de estado
  function migrateStatusBadges(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    
    var activeBadges = metaPanel.querySelectorAll('.m-badge--active');
    activeBadges.forEach(function(badge) {
      if (!badge.classList.contains('migrated-status')) {
        badge.classList.remove('m-badge--active');
        badge.classList.add('badge', 'badge--success', 'migrated-status');
        if (!badge.innerHTML.includes('✅')) badge.innerHTML = '✅ ' + badge.textContent.trim();
      }
    });
    
    var soonBadges = metaPanel.querySelectorAll('.m-badge--soon');
    soonBadges.forEach(function(badge) {
      if (!badge.classList.contains('migrated-status')) {
        badge.classList.remove('m-badge--soon');
        badge.classList.add('badge', 'badge--warning', 'migrated-status');
        if (!badge.innerHTML.includes('⏰')) badge.innerHTML = '⏰ ' + badge.textContent.trim();
      }
    });
    
    var genericBadges = metaPanel.querySelectorAll('.m-badge:not(.m-badge--active):not(.m-badge--soon):not(.migrated-status)');
    genericBadges.forEach(function(badge) {
      badge.classList.remove('m-badge');
      badge.classList.add('badge', 'badge--info', 'migrated-status');
    });
    
    var doneButtons = metaPanel.querySelectorAll('.m-done.m-done--on');
    doneButtons.forEach(function(btn) {
      if (!btn.classList.contains('badge')) {
        btn.classList.add('badge', 'badge--success');
        if (!btn.innerHTML.includes('✅')) btn.innerHTML = '✅ ' + btn.textContent.trim();
      }
    });
  }

  // Migración de badges de expansión a pills
  function migrateExpansionBadges(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    var expBadges = metaPanel.querySelectorAll('.badge-exp');
    expBadges.forEach(function(badge) {
      if (!badge.classList.contains('pill')) {
        badge.classList.add('pill');
        var icon = badge.querySelector('img');
        if (icon) { icon.style.height = '24px'; icon.style.width = 'auto'; }
        badge.style.padding = '2px 10px';
        badge.style.fontSize = '0.75rem';
      }
    });
  }

  // Migración de etiquetas de infusión/drop
  function migrateItemTags(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    
    var infTags = metaPanel.querySelectorAll('.m-tag.tag--inf');
    infTags.forEach(function(tag) {
      if (!tag.classList.contains('badge')) {
        tag.classList.add('badge', 'badge--info');
        tag.classList.remove('m-tag', 'tag--inf');
        if (!tag.innerHTML.includes('💎')) tag.innerHTML = '💎 ' + tag.textContent.trim();
      }
    });
    
    var dropTags = metaPanel.querySelectorAll('.m-tag.tag--drop');
    dropTags.forEach(function(tag) {
      if (!tag.classList.contains('badge')) {
        tag.classList.add('badge', 'badge--warning');
        tag.classList.remove('m-tag', 'tag--drop');
        if (!tag.innerHTML.includes('📦')) tag.innerHTML = '📦 ' + tag.textContent.trim();
      }
    });
  }

  // Mejora de textos "Próximo en X"
  function migrateNextTime(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    var nextSpans = metaPanel.querySelectorAll('.m-next');
    nextSpans.forEach(function(span) {
      if (!span.classList.contains('pill') && span.textContent.trim()) {
        span.classList.add('pill');
        span.style.fontSize = '0.7rem';
        span.style.padding = '2px 8px';
      }
    });
  }

  // Aplicar todas las migraciones
  function applyMetaPolish(root) {
    var host = root || document;
    var metaPanel = host.querySelector('#metaPanel');
    if (!metaPanel || metaPanel.hasAttribute('hidden')) return;
    migrateCardsToCardClass(metaPanel);
    migrateStatusBadges(metaPanel);
    migrateExpansionBadges(metaPanel);
    migrateItemTags(metaPanel);
    migrateNextTime(metaPanel);
  }

  // Observer para mejoras visuales
  function ensurePolishObserver() {
    var panel = document.getElementById('metaPanel');
    if (!panel || panel.__metaPolishObserver) return;
    var observer = new MutationObserver(function(mutations) {
      var needsPolish = false;
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && (node.classList.contains('meta-card') || node.classList.contains('m-card'))) {
                needsPolish = true;
              }
              if (node.querySelectorAll && node.querySelectorAll('.meta-card, .m-card').length) {
                needsPolish = true;
              }
            }
          });
        }
      });
      if (needsPolish) setTimeout(function() { applyMetaPolish(panel); }, 20);
    });
    observer.observe(panel, { childList: true, subtree: true });
    panel.__metaPolishObserver = observer;
  }

  // Inicialización de mejoras
  function initMetaPolish() {
    var metaPanel = document.getElementById('metaPanel');
    if (metaPanel && !metaPanel.hasAttribute('hidden')) {
      setTimeout(function() { applyMetaPolish(document); }, 50);
    }
    ensurePolishObserver();
  }

  // Extender eventos existentes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMetaPolish);
  } else {
    initMetaPolish();
  }

  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'meta') {
      setTimeout(function() { applyMetaPolish(document); }, 60);
    }
  });

  document.addEventListener('gn:tokenchange', function() {
    setTimeout(function() { applyMetaPolish(document); }, 120);
  });

  console.info('[MetaTheme] Extensión v1.1.0 activa — badges canónicos + cards + pills');
})();
})();
