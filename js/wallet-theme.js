/*!
 * Wallet Theme (divisas) — outline + halo por color + título tintado + badges de categorías + card canónica
 * v1.3.0 (2026-03-21)
 *
 * Cambios 1.3.0:
 *  - Migración de tarjetas a clase .card canónica (hereda hover con glow, gradiente)
 *  - Compatibilidad total con theme-polish.css v2.0
 *
 * Cambios 1.2.0:
 *  - Migración automática de categorías a badges visuales
 *  - Preservación de glows especiales por divisa
 *
 * Cambios 1.1.0:
 *  - Prioridad absoluta a data-cur / data-key (determinista)
 *  - Soporte explícito de selectores de Wallet
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[WalletTheme] wallet-theme.js v1.3.0 — card canónica + badges de categorías');

  // === DEBUG opcional ===
  var DEBUG = false;

  // --- Normalización -----------------------------------------------------------
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- Colores -----------------------------------------------------------------
  var COLOR_MAP = {
    gems:            '#4BBDF0',
    coins:           '#F4C542',
    karma:           '#AF63DF',
    laurels:         '#2BC14E',
    trade_contracts: '#28C3BB',
    elegy_mosaic:    '#E2AE43',
    default:         '#FFFFFF'
  };

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
    } catch (e) { return null; }
  }

  function colorForKey(key) { return COLOR_MAP[key] || COLOR_MAP.default; }

  // --- Diccionarios de equivalencias -------------------------------------------
  var EXACT = new Map([
    ['gema', 'gems'], ['gemas', 'gems'],
    ['moneda', 'coins'], ['monedas', 'coins'],
    ['karma', 'karma'],
    ['laurel', 'laurels'], ['laureles', 'laurels'],
    ['contrato comercial', 'trade_contracts'], ['contratos comerciales', 'trade_contracts'],
    ['mosaico de elegia', 'elegy_mosaic'], ['mosaicos de elegia', 'elegy_mosaic'],
    ['gem', 'gems'], ['gems', 'gems'],
    ['coin', 'coins'], ['coins', 'coins'],
    ['laurel', 'laurels'], ['laurels', 'laurels'],
    ['trade contract', 'trade_contracts'], ['trade contracts', 'trade_contracts'],
    ['elegy mosaic', 'elegy_mosaic'], ['elegy mosaics', 'elegy_mosaic']
  ]);

  var STARTS = [
    ['gema', 'gems'], ['gem', 'gems'],
    ['moneda', 'coins'], ['coin', 'coins'],
    ['contrato comercial', 'trade_contracts'], ['trade contract', 'trade_contracts'],
    ['mosaico de elegia', 'elegy_mosaic'], ['elegy mosaic', 'elegy_mosaic']
  ];

  var TOKENS = new Map([
    ['gema', 'gems'], ['gem', 'gems'],
    ['moneda', 'coins'], ['coin', 'coins'],
    ['oro', 'coins'], ['gold', 'coins'], ['plata', 'coins'], ['silver', 'coins'], ['cobre', 'coins'], ['copper', 'coins'],
    ['karma', 'karma'],
    ['laurel', 'laurels'], ['laurels', 'laurels'],
    ['contrato', 'trade_contracts'], ['contracts', 'trade_contracts'],
    ['elegia', 'elegy_mosaic'], ['elegy', 'elegy_mosaic']
  ]);

  // --- Lectura de título -------------------------------------------------------
  function readTitle(card) {
    var node =
      card.querySelector('.wv-card__top .wv-card__name') ||
      card.querySelector('.wv-card__name') ||
      card.querySelector('.wallet-card__name') ||
      card.querySelector('.cur-card__title') ||
      card.querySelector('.wallet-card__title') ||
      card.querySelector('.w-card__title') ||
      card.querySelector('.title, .name');
    return node ? (node.textContent || '') : '';
  }

  // --- Resolver la key ---------------------------------------------------------
  function resolveCurrencyKey(card) {
    var dataKey = card.getAttribute('data-cur') || card.getAttribute('data-key') || '';
    if (dataKey) {
      var dk = normalize(dataKey);
      if (COLOR_MAP[dk]) return dk;
      if (EXACT.has(dk)) return EXACT.get(dk);
    }

    var tRaw = readTitle(card);
    var t = normalize(tRaw);

    if (EXACT.has(t)) return EXACT.get(t);
    for (var i = 0; i < STARTS.length; i++) {
      var p = STARTS[i][0], key = STARTS[i][1];
      if (t.startsWith(p)) return key;
    }

    var toks = t.split(' ');
    for (var j = 0; j < toks.length; j++) {
      var tok = toks[j];
      if (TOKENS.has(tok)) return TOKENS.get(tok);
    }

    return 'default';
  }

    // --- Aplicar tema (colores y glows unificados v1.4.0) -----------------------
  function applyCurrencyTheme(card) {
      if (!card) return;

      var key = resolveCurrencyKey(card);
      var hex = colorForKey(key);
      var isColorful = (key !== 'default');
      var bLeft = hexToRGBA(isColorful ? hex : '#FFFFFF', 0.5);

      // Solo: borde izquierdo de color
      try {
        card.style.borderLeft = '3px solid ' + bLeft;
      } catch (_) {}

      // Solo: título tintado
      try {
        var title =
          card.querySelector('.wv-card__top .wv-card__name') ||
          card.querySelector('.wv-card__name') ||
          card.querySelector('.wallet-card__name') ||
          card.querySelector('.cur-card__title') ||
          card.querySelector('.wallet-card__title') ||
          card.querySelector('.w-card__title') ||
          card.querySelector('.title, .name');
        if (title) title.style.color = isColorful ? hex : '#FFFFFF';
      } catch (_) {}
          // Glow en el ícono (mismo patrón que WV Tienda)
    try {
      var iconWrap = card.querySelector('.wallet-card__iconWrap');
      if (iconWrap) {
        if (isColorful) {
          var iconGlow = hexToRGBA(hex, 0.36);
          var iconBorder = hexToRGBA(hex, 0.32);
          iconWrap.style.boxShadow = '0 0 0 2px ' + iconBorder + ', 0 0 10px ' + iconGlow;
        } else {
          // Glow neutro para divisas sin color asignado
          iconWrap.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.12), 0 0 8px rgba(255,255,255,0.06)';
        }
        iconWrap.style.borderRadius = '10px';
      }
    } catch (_) {}
    }

  // --- Migración de categorías a badges ----------------------------------------
  function migrateCategoriesToBadges(root) {
    var panel = root || document;
    var host = panel.querySelector('#walletPanel') || panel;
    
    var categorySpans = host.querySelectorAll('.cats');
    
    categorySpans.forEach(function(span) {
      if (span.parentElement && span.parentElement.classList && span.parentElement.classList.contains('badge')) {
        return;
      }
      
      var categoryText = span.textContent || '';
      if (!categoryText.trim()) return;
      
      var badge = document.createElement('span');
      badge.className = 'badge badge--info';
      badge.textContent = categoryText;
      
      if (span.id) badge.id = span.id;
      if (span.title) badge.title = span.title;
      if (span.getAttribute('data-tip')) badge.setAttribute('data-tip', span.getAttribute('data-tip'));
      
      span.parentNode.replaceChild(badge, span);
    });
  }

  // --- Migración de Wallet a clase .card canónica -----------------------------
  function migrateWalletToCardClass(root) {
    var panel = root || document;
    var host = panel.querySelector('#walletPanel') || panel;
    
    var walletCards = host.querySelectorAll('.wallet-card:not(.card)');
    
    walletCards.forEach(function(card) {
      card.classList.add('card');
    });
  }

  // --- Observadores -----------------------------------------------------------
  function observeCategoriesForBadges() {
    var panel = document.getElementById('walletPanel');
    if (!panel) return;
    
    var observer = new MutationObserver(function(mutations) {
      var needsMigration = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && node.classList.contains('cats')) {
                needsMigration = true;
              }
              if (node.querySelectorAll && node.querySelectorAll('.cats').length) {
                needsMigration = true;
              }
            }
          });
        }
      });
      
      if (needsMigration) {
        setTimeout(function() {
          migrateCategoriesToBadges(panel);
        }, 10);
      }
    });
    
    observer.observe(panel, { childList: true, subtree: true });
  }

  function observeWalletCardsForMigration() {
    var panel = document.getElementById('walletPanel');
    if (!panel) return;
    
    var observer = new MutationObserver(function(mutations) {
      var needsMigration = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && node.classList.contains('wallet-card')) {
                needsMigration = true;
              }
              if (node.querySelectorAll && node.querySelectorAll('.wallet-card').length) {
                needsMigration = true;
              }
            }
          });
        }
      });
      
      if (needsMigration) {
        setTimeout(function() {
          migrateWalletToCardClass(panel);
        }, 10);
      }
    });
    
    observer.observe(panel, { childList: true, subtree: true });
  }

  // --- Aplicar tema a todas las tarjetas ---------------------------------------
  function themeWalletNow(root) {
    var panel = root || document;
    var host = panel.querySelector('#walletPanel') || panel;

    var cards = $$('.wallet-card, .wv-card, .cur-card, .w-card', host);
    cards.forEach(applyCurrencyTheme);
    
    setTimeout(function() {
      migrateCategoriesToBadges(host);
      migrateWalletToCardClass(host);
    }, 20);
  }

  // --- Observer para nuevas tarjetas (glows) -----------------------------------
  var mo = null;
  function ensureObserver() {
    if (mo) return;
    var panel = $('#walletPanel') || document;
    mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.wallet-card, .wv-card, .cur-card, .w-card'))) {
            applyCurrencyTheme(n);
            setTimeout(function() {
              migrateCategoriesToBadges(n);
              migrateWalletToCardClass(n);
            }, 10);
          } else {
            $$('.wallet-card, .wv-card, .cur-card, .w-card', n).forEach(applyCurrencyTheme);
            if (n.querySelectorAll) {
              if (n.querySelectorAll('.cats').length) {
                setTimeout(function() {
                  migrateCategoriesToBadges(n);
                }, 10);
              }
              if (n.querySelectorAll('.wallet-card').length) {
                setTimeout(function() {
                  migrateWalletToCardClass(n);
                }, 10);
              }
            }
          }
        });
      });
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  // --- Hooks de navegación / arranque ------------------------------------------
  function onRoute() {
    requestAnimationFrame(function () { 
      themeWalletNow(document);
    });
  }

  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'cards') {
      setTimeout(function() {
        themeWalletNow(document);
      }, 50);
    }
  });

  document.addEventListener('gn:tokenchange', function() {
    setTimeout(function() {
      themeWalletNow(document);
    }, 100);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { 
      onRoute(); 
      ensureObserver();
      observeCategoriesForBadges();
      observeWalletCardsForMigration();
    });
  } else {
    onRoute(); 
    ensureObserver();
    observeCategoriesForBadges();
    observeWalletCardsForMigration();
  }

  window.addEventListener('hashchange', function () {
    var w = $('#walletPanel');
    if (w && !w.hasAttribute('hidden')) onRoute();
  });

  window.WalletTheme = {
    applyCurrencyTheme: applyCurrencyTheme,
    migrateCategoriesToBadges: migrateCategoriesToBadges,
    migrateWalletToCardClass: migrateWalletToCardClass,
    themeWalletNow: themeWalletNow,
    version: '1.3.0'
  };

  console.info('[WalletTheme] ready v1.3.0 — card canónica + glows especiales + badges de categorías');
})();