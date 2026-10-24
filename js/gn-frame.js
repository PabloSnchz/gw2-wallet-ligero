/*!
 * js/gn-frame.js — Marco común de la Bóveda para los módulos heredados (BL-067, pasos 4 a 8)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Actividades, Raids y Strikes, Inventario y Personajes y Cuentas viven en archivos grandes y
 * congelados (53 a 100 KB, DEC-035). En vez de reescribirlos, este marco les da lo mismo que ya
 * tienen la Cámara del Brujo y Logros, sin tocar su comportamiento:
 *  - superficies de js/gn-surface.js (bandeja, tarjeta elevada, pista, bordes);
 *  - cabecera común: el ícono oficial a 40 px en su placa, con el color del módulo (el mismo de la
 *    Bienvenida) y el título con jerarquía;
 *  - profundidad en tarjetas, pistas visibles en las barras;
 *  - guarda de contraste: cada color de texto que usan esos módulos llega a 4.5:1 sobre la tarjeta y
 *    la bandeja reales, en los 19 themes (solo se corrige lo que falla, conservando el tono);
 *  - accesibilidad: foco visible, movimiento reducido, objetivos de 44 px en el celular y la región
 *    nombrada por su título.
 * Los paneles que arma el JS al navegar (Actividades, Personajes) se marcan cuando aparecen.
 * Se carga por js/modules.json, después de gn-surface.js. Sin pedidos ni almacenamiento.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[GNFrame]';
  // id del panel → módulo, color (el de la Bienvenida) e ícono oficial de su cabecera
  var PANELS = [
    { id: 'activitiesPanel', mod: 'activities', name: 'Actividades', color: '#3CC48A', icon: 'assets/icons/1302773.png' },
    { id: 'raidTrackerPanel', mod: 'raids', name: 'Raids', color: '#F47C7C', icon: 'assets/icons/raids/raid-icon.png' },
    { id: 'strikeTrackerPanel', mod: 'raids', name: 'Strikes', color: '#F47C7C', icon: 'assets/icons/raids/raid-icon.png' },
    { id: 'inventoryPanel', mod: 'characters', name: 'Inventario y Personajes', color: '#7EC3FF', icon: 'assets/icons/Welcome/358409.png' },
    { id: 'charactersPanel', mod: 'characters', name: 'Personajes', color: '#7EC3FF', icon: 'assets/icons/Welcome/358409.png' },
    { id: 'inventoryDashboardPanel', mod: 'characters', name: 'Inventario', color: '#7EC3FF', icon: 'assets/icons/Welcome/358409.png' },
    { id: 'accountsPanel', mod: 'accounts', name: 'Cuentas', color: '#8E96A3', icon: 'assets/icons/3601748.png' }
  ];
  // colores de texto que usan esos módulos (RUN-016): los que cuida la guarda
  var TEXT_KEYS = ['--tx-2', '--tx-3', '--muted', '--gw-muted', '--color-green', '--color-amber', '--color-red', '--color-blue', '--gn-gold'];
  var FALLBACK = { '--color-green': '#3fb950', '--color-amber': '#F2B94B', '--color-red': '#F47C7C', '--color-blue': '#6EA3FF', '--gn-gold': '#F2B94B' };
  var AA = 4.5;

  // ------------------------------------------------------------------ guarda (pura)
  // tokens del theme (con la bandeja y la tarjeta reales como --bg-0 y --bg-1) → correcciones.
  // Cada color que no llega a 4.5:1 sobre las dos se acerca al texto principal lo justo.
  function guardFixes(tokens, P) {
    var out = {};
    if (!P || !tokens) return out;
    var tray = P.parse(tokens['--bg-0']), card = P.parse(tokens['--bg-1']), t1 = P.parse(tokens['--tx-1']);
    if (!tray || !card || !t1) return out;
    tray = P.over(tray, [255, 255, 255, 1]); card = P.over(card, tray); t1 = P.over(t1, card);
    TEXT_KEYS.forEach(function (k) {
      var raw = tokens[k] || FALLBACK[k];
      var c = P.parse(raw);
      if (!c) return;
      var onCard = P.over(c, card), onTray = P.over(c, tray);
      if (P.contrast(onCard, card) >= AA && P.contrast(onTray, tray) >= AA) return;
      out[k] = P.hex(P.readable(onCard, t1, [card, tray]));
    });
    return out;
  }

  // ------------------------------------------------------------------ CSS
  var F = '[data-gn-frame]';
  var CSS = [
    // cabecera común: ícono oficial en placa con el anillo del módulo y título con jerarquía
    F + ' .panel__title{font-size:1.3rem;font-weight:800;letter-spacing:.01em;color:var(--tx-1);padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--bd-1);background:linear-gradient(90deg,var(--gn-mod),transparent) 0 100%/140px 2px no-repeat}',
    F + ' .panel__title > img,' + F + ' .panel__title > span:first-child > img:first-child{width:40px;height:40px;padding:4px;border-radius:10px;background:var(--gn-plate);box-shadow:0 0 0 2px color-mix(in srgb,var(--gn-mod) 70%,transparent);box-sizing:content-box}',
    // profundidad: tarjetas de los módulos heredados
    F + ' :is(.card,.raid-wing-card,.raid-encounter-card,.fractal-card,.psna-day,.psna-wp,.kpi-badge,.raid-kpis > *){box-shadow:var(--gn-elev);border-color:var(--bd-1)}',
    F + ' :is(.raid-wing-card,.card):hover{border-color:var(--bd-2)}',
    // barras: la pista vuelve a verse
    F + ' :is(.bar,.raid-wing-progress){background:var(--bg-2)}',
    F + ' :is(.badge,.pill,.chip){border-color:var(--bd-1)}',
    // teclado: foco visible en todo lo que se puede tocar
    F + ' :is(a,button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + F + ' *{transition:none!important;animation:none!important}}',
    '@media (max-width:720px){' + F + ' :is(button,.btn,select,input[type=search],input[type=text]){min-height:44px}' + F + ' .panel__title{font-size:1.15rem}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { marked: {}, fixes: {}, timers: [] };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function surf() { return root.GNSurface && root.GNSurface._pure ? root.GNSurface : null; }

  function readTokens() {
    var t = {}, cs = typeof root.getComputedStyle === 'function' && doc && doc.documentElement ? root.getComputedStyle(doc.documentElement) : null;
    ['--bg-0', '--bg-1', '--tx-1', '--tx-2', '--acc-1'].concat(TEXT_KEYS).forEach(function (k) {
      var v = cs && cs.getPropertyValue ? String(cs.getPropertyValue(k) || '').trim() : '';
      if (v) t[k] = v;
    });
    return t;
  }

  function ensureCss() {
    if (!doc || byId('gn-frame-css') || !doc.createElement || !doc.head) return;
    var s = doc.createElement('style');
    s.id = 'gn-frame-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  // La región se nombra por su título: si el h2 no tiene id, le doy uno.
  function label(p, cfg) {
    if (!p.querySelector || !p.setAttribute) return;
    var h = p.querySelector('.panel__title');
    if (!h) return;
    if (!h.id) h.id = cfg.id + 'GnTitle';
    if (!p.getAttribute || !p.getAttribute('aria-labelledby') || !byId(p.getAttribute('aria-labelledby'))) p.setAttribute('aria-labelledby', h.id);
  }

  // Marca los paneles que existen, registra sus superficies y pone la guarda. Devuelve los marcados.
  function apply(tokens) {
    ensureCss();
    var GS = surf(), tk = tokens || readTokens();
    var fixes = GS ? guardFixes(GS.surfaceTokens(tk), GS._pure) : {};
    var done = [];
    PANELS.forEach(function (cfg) {
      var p = byId(cfg.id);
      if (!p || !p.style || typeof p.style.setProperty !== 'function') return;
      if (GS && GS.scopes().indexOf(cfg.id) < 0) GS.register(cfg.id);
      if (p.setAttribute) { p.setAttribute('data-gn-frame', cfg.mod); }
      p.style.setProperty('--gn-mod', cfg.color);
      var prev = st.fixes[cfg.id] || {};
      Object.keys(prev).forEach(function (k) { if (!(k in fixes)) p.style.removeProperty(k); });
      Object.keys(fixes).forEach(function (k) { p.style.setProperty(k, fixes[k]); });
      st.fixes[cfg.id] = fixes;
      label(p, cfg);
      st.marked[cfg.id] = true;
      done.push(cfg.id);
    });
    return done;
  }

  // Los paneles que arma el JS aparecen al navegar: reviso un poco después de cada cambio.
  function soon() {
    st.timers.forEach(function (t) { clearTimeout(t); });
    st.timers = [0, 300, 1200].map(function (ms) { return setTimeout(function () { apply(); }, ms); });
  }

  function init() {
    apply();
    if (root.addEventListener) { root.addEventListener('hashchange', soon); root.addEventListener('load', soon); }
    if (doc && doc.addEventListener) {
      ['gn:boot-ready', 'gn:tabchange', 'gn:render-home-nodes'].forEach(function (e) { doc.addEventListener(e, soon); });
    }
    if (doc && doc.documentElement && typeof root.MutationObserver === 'function') {
      new root.MutationObserver(function () { setTimeout(function () { apply(); }, 450); })
        .observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  root.GNFrame = {
    version: VERSION, apply: apply,
    marked: function () { return Object.keys(st.marked); },
    _pure: { PANELS: PANELS, TEXT_KEYS: TEXT_KEYS, guardFixes: guardFixes, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
