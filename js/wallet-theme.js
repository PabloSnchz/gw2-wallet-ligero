/*!
 * Wallet Theme (divisas) — outline + halo por color + título tintado
 * v1.0.2 (2026-03-01)
 *
 * Cambios 1.0.2:
 *  - Match explícito por títulos ES/EN (singular/plural) de Gema/Moneda/Karma/Laurel/
 *    Contratos comerciales/Mosaicos de elegía.
 *  - Selector del título afinado para WV cards (.wv-card__top .wv-card__name).
 *  - Modo diagnóstico (opcional) para log de resoluciones.
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[WalletTheme] wallet-theme.js v1.0.2 — matching explícito + WV title fix');

  // === DEBUG opcional ===
  var DEBUG = false; // poné true para ver en consola: titulo -> key

  // --- Normalización -----------------------------------------------------------
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
      .replace(/[^\w\s]/g, '')                            // sin signos
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- Colores -----------------------------------------------------------------
  var COLOR_MAP = {
    gems:               '#4BBDF0', // azul gemas
    coins:              '#F4C542', // dorado monedas (oro)
    karma:              '#AF63DF', // violeta karma
    laurels:            '#2BC14E', // verde laureles
    trade_contracts:    '#28C3BB', // teal contratos comerciales
    elegy_mosaic:       '#E2AE43', // amber mosaico de elegía
    default:            '#FFFFFF'  // resto blanco
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
  // EXACTOS (preferidos): títulos tal como aparecen en tus cards (ES/EN, sing/plural)
  var EXACT = new Map([
    // ES
    ['gema', 'gems'], ['gemas', 'gems'],
    ['moneda', 'coins'], ['monedas', 'coins'],
    ['karma', 'karma'],
    ['laurel', 'laurels'], ['laureles', 'laurels'],
    ['contrato comercial', 'trade_contracts'], ['contratos comerciales', 'trade_contracts'],
    ['mosaico de elegia', 'elegy_mosaic'], ['mosaicos de elegia', 'elegy_mosaic'],
    // EN
    ['gem', 'gems'], ['gems', 'gems'],
    ['coin', 'coins'], ['coins', 'coins'],
    ['laurel', 'laurels'], ['laurels', 'laurels'],
    ['trade contract', 'trade_contracts'], ['trade contracts', 'trade_contracts'],
    ['elegy mosaic', 'elegy_mosaic'], ['elegy mosaics', 'elegy_mosaic']
  ]);

  // STARTS WITH (por si viene “Moneda (oro/plata/cobre)” o variantes)
  var STARTS = [
    ['gema', 'gems'], ['gem', 'gems'],
    ['moneda', 'coins'], ['coin', 'coins'],
    ['karma', 'karma'],
    ['laurel', 'laurels'],
    ['contrato comercial', 'trade_contracts'], ['trade contract', 'trade_contracts'],
    ['mosaico de elegia', 'elegy_mosaic'], ['elegy mosaic', 'elegy_mosaic']
  ];

  // TOKENS (si contiene la palabra clave en cualquier parte)
  var TOKENS = new Map([
    ['gema', 'gems'], ['gem', 'gems'],
    ['moneda', 'coins'], ['coin', 'coins'], ['oro', 'coins'], ['gold', 'coins'], ['plata', 'coins'], ['silver', 'coins'], ['cobre', 'coins'], ['copper', 'coins'],
    ['karma', 'karma'],
    ['laurel', 'laurels'], ['laurels', 'laurels'],
    ['contrato', 'trade_contracts'], ['contracts', 'trade_contracts'],
    ['elegia', 'elegy_mosaic'], ['elegy', 'elegy_mosaic']
  ]);

  // --- Lectura de título (afinada para WV) -------------------------------------
  function readTitle(card) {
    // En WV cards el título “visible” suele estar aquí
    var node =
      card.querySelector('.wv-card__top .wv-card__name') ||
      card.querySelector('.wv-card__name') ||
      card.querySelector('.cur-card__title') ||
      card.querySelector('.wallet-card__title') ||
      card.querySelector('.w-card__title') ||
      card.querySelector('.title, .name');
    return node ? node.textContent : '';
  }

  // --- Resolver la key ----------------------------------------------------------
  function resolveCurrencyKey(card) {
    // 0) data attributes (si decidís agregarlos en el futuro)
    var dataKey = card.getAttribute('data-cur') || card.getAttribute('data-key') || '';
    if (dataKey) {
      var dk = normalize(dataKey);
      if (COLOR_MAP[dk]) return dk;
      if (EXACT.has(dk)) return EXACT.get(dk);
    }

    // 1) por título
    var tRaw = readTitle(card);
    var t = normalize(tRaw);

    // 1a) exacto
    if (EXACT.has(t)) return EXACT.get(t);

    // 1b) startsWith
    for (var i=0; i<STARTS.length; i++) {
      var p = STARTS[i][0], key = STARTS[i][1];
      if (t.startsWith(p)) return key;
    }

    // 1c) token match
    var toks = t.split(' ');
    for (var j=0; j<toks.length; j++) {
      var tok = toks[j];
      if (TOKENS.has(tok)) return TOKENS.get(tok);
    }

    return 'default';
  }

  // --- Aplicar tema -------------------------------------------------------------
  function applyCurrencyTheme(card) {
    if (!card) return;

    var key = resolveCurrencyKey(card);
    var hex = colorForKey(key);
    var isColorful = (key !== 'default');

    if (DEBUG) {
      var titleDbg = readTitle(card);
      console.log('[WalletTheme] resolve:', titleDbg, '→', key);
    }

    var bColor = hexToRGBA(isColorful ? hex : '#FFFFFF', isColorful ? 0.28 : 0.18);
    var gColor = hexToRGBA(isColorful ? hex : '#FFFFFF', isColorful ? 0.34 : 0.26);

    // Título
    try {
      var title =
        card.querySelector('.wv-card__top .wv-card__name') ||
        card.querySelector('.wv-card__name') ||
        card.querySelector('.cur-card__title') ||
        card.querySelector('.wallet-card__title') ||
        card.querySelector('.w-card__title') ||
        card.querySelector('.title, .name');
      if (title) title.style.color = isColorful ? hex : '#FFFFFF';
    } catch (_) {}

    // Contenedor tarjeta — borde + glow
    try {
      if (bColor && gColor) {
        card.style.border = '1px solid ' + bColor;
        card.style.boxShadow = '0 0 0 1px ' + bColor + ' inset, 0 0 12px ' + gColor;
      }
      card.style.borderRadius = '10px';
    } catch (_) {}

    // Marco del ícono
    try {
      var iconWrap =
        card.querySelector('.wv-card__iconWrap') ||
        card.querySelector('.cur-card__iconWrap') ||
        card.querySelector('.wallet-card__iconWrap') ||
        card.querySelector('.w-card__iconWrap') ||
        card.querySelector('.icon, .icon-wrap');
      if (iconWrap && bColor && gColor) {
        iconWrap.style.boxShadow = '0 0 0 2px ' + bColor + ', 0 0 10px ' + gColor;
        iconWrap.style.borderRadius = '6px';
      }
    } catch (_) {}

    // Cantidad/pill (solo coloreamos las “de color propio”, resto blanco)
    try {
      var amount =
        card.querySelector('.cur-amt, .wallet-amt, .w-amt, .pill.value, .value, .wv-badge strong');
      if (amount) amount.style.color = isColorful ? hex : '#FFFFFF';
    } catch (_) {}
  }

  function themeWalletNow(root) {
    var panel = root || document;
    var host = panel.querySelector('#walletPanel') || panel;

    // WV cards + posibles clases de wallet
    var cards = $$('.wv-card, .cur-card, .wallet-card, .w-card', host);
    cards.forEach(applyCurrencyTheme);
  }

  // --- Observer (re-render) -----------------------------------------------------
  var mo = null;
  function ensureObserver() {
    if (mo) return;
    var panel = $('#walletPanel') || document;
    mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.wv-card, .cur-card, .wallet-card, .w-card'))) {
            applyCurrencyTheme(n);
          } else {
            $$('.wv-card, .cur-card, .wallet-card, .w-card', n).forEach(applyCurrencyTheme);
          }
        });
      });
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  // --- Hooks de navegación / arranque ------------------------------------------
  function onRoute() {
    requestAnimationFrame(function () { themeWalletNow(document); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { onRoute(); ensureObserver(); });
  } else {
    onRoute(); ensureObserver();
  }

  window.addEventListener('hashchange', function () {
    var w = $('#walletPanel');
    if (w && !w.hasAttribute('hidden')) onRoute();
  });

  document.addEventListener('gn:tabchange', function (ev) {
    if (ev.detail && ev.detail.view === 'cards') onRoute();
  });
})();
