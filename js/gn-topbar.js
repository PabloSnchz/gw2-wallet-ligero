/*!
 * js/gn-topbar.js — Barra de arriba y pie de la Bóveda (BL-070 paso 5, TOP-5 y TOP-6)
 * Versión: 1.1.0
 *
 * La barra tiene tres zonas: quién sos y dónde estás (logo, que lleva a Inicio, con la leyenda
 * «Sitio de la comunidad · no oficial» que pide ArenaNet), con qué cuenta mirás (#keySelectGlobal y Keys)
 * y las herramientas (Guías y los menús Enlaces y Ajustes). El marcado vive en index.html, así se ve
 * bien desde el primer cuadro; este módulo le pone la conducta:
 *  - Marca DEV: solo cuando la Bóveda corre desde gw2-factory-dev (clase gn-env-dev en <html>).
 *  - Menús con teclado: flechas, Inicio y Fin; Escape cierra y el foco vuelve a su botón; Tab sale y cierra;
 *    tocar afuera cierra. Al elegir algo, el menú se cierra ANTES de que corra la acción, así una ventana
 *    que se abra devuelve el foco a un botón visible.
 *  - Celular (hasta 900 px): una sola fila. «Opciones» abre la hoja con Guías, Enlaces y Ajustes; el foco
 *    queda adentro, Escape o tocar afuera la cierran y el foco vuelve a «Opciones». No uso las tres
 *    rayas: son el «Más» de la barra de abajo (sidebar-nav.js), y dos iguales confunden.
 *  - «Cambiar el tema» es el #themeToggleBtn de siempre: theme-selector.js ya no inyecta el suyo.
 * No guarda nada, no pide nada a la API y no cambia ningún id que usen otros módulos.
 *
 * 1.1.0 (TOP-6): el pie. El marcado (con el aviso de ArenaNet) vive en index.html; acá van sus estilos,
 *   porque index.html no puede pasar 48 KB y el pie no se ve en el primer cuadro, y sus atajos: «Guías de uso»
 *   y «Gestión de Keys» tocan los botones de siempre de la barra (#guideLink y #keysMenuBtn), así cada ventana
 *   abre igual que desde arriba y, al cerrarse, el foco vuelve al pie. El distintivo «Link in Bio» conserva
 *   sus colores fijos (DEC-025) y su foto se sirve desde assets/brand/ (D7).
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var DEV_PATH = /^\/gw2-factory-dev(\/|$)/;
  var MENUS = ['gnTbLinksBtn', 'gnTbSetBtn'];
  var st = { open: null, sheet: false, wired: false, foot: false };
  var FOOT_CSS = [
    '.site-footer.gn-ft { margin: 28px 0 0; padding: 22px 24px 18px; border-top: 1px solid var(--bd-1); background: var(--bg-0); color: var(--tx-2); font-size: .84rem; }',
    '.gn-ft p { margin: 0; color: var(--tx-2); }',
    '.gn-ft__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 20px 28px; max-width: 1200px; margin: 0 auto; }',
    '.gn-ft__brand { display: flex; gap: 12px; align-items: flex-start; }',
    '.gn-ft__brand b { color: var(--tx-1); }',
    '.gn-ft .footer-mark { width: 28px; height: 28px; flex-shrink: 0; }',
    '.gn-ft__col { display: flex; flex-direction: column; align-items: flex-start; }',
    '.gn-ft__h { margin-bottom: 4px; font-size: .74rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }',
    '.gn-ft__col a, .gn-ft__col button { display: inline-flex; align-items: center; min-height: 32px; padding: 0; border: 0; background: none; color: var(--tx-2); font: inherit; text-decoration: none; cursor: pointer; }',
    '.gn-ft__col a:hover, .gn-ft__col button:hover { color: var(--tx-1); text-decoration: underline; }',
    '.gn-ft a:focus-visible, .gn-ft button:focus-visible { outline: 2px solid var(--acc-1); outline-offset: 2px; border-radius: 4px; }',
    '.gn-ft__legal { display: grid; gap: 6px; max-width: 1200px; margin: 18px auto 0; padding-top: 12px; border-top: 1px solid var(--bd-1); font-size: .74rem; line-height: 1.5; }',
    '.gn-bio { display: inline-flex; height: 26px; margin-top: 12px; border-radius: 4px; overflow: hidden; font: 600 11px/1 system-ui, -apple-system, sans-serif; text-decoration: none; }',
    '.gn-bio span { display: flex; align-items: center; white-space: nowrap; }',
    '.gn-bio .gn-bio__a { gap: 6px; padding: 0 10px; background-color: #232A3A; color: #F4F6FA; }',
    '.gn-bio .gn-bio__b { padding: 0 12px; background-color: #5A3DDB; color: #FFFFFF; font-weight: 700; }',
    '.gn-bio img { width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); }',
    '@media (max-width: 900px) { .site-footer.gn-ft { padding: 20px 16px 16px; } .gn-ft__grid { grid-template-columns: 1fr 1fr; } .gn-ft__id { grid-column: 1 / -1; } .gn-ft__col a, .gn-ft__col button { min-height: 44px; } }'
  ].join('\n');

  function doc() { return root.document; }
  function byId(id) { return doc().getElementById(id); }
  function arr(x) { return Array.prototype.slice.call(x || []); }
  function focus(n) { if (n && typeof n.focus === 'function') n.focus(); }
  function hiddenUp(n) {
    for (; n && n.getAttribute; n = n.parentNode) if (n.getAttribute('hidden') !== null) return true;
    return false;
  }
  function inside(box, n) { for (; n; n = n.parentNode) if (n === box) return true; return false; }
  function stop(e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }

  function isDev(loc) {
    loc = loc || root.location || {};
    return DEV_PATH.test(String(loc.pathname || ''));
  }
  function markEnv(loc) {
    var html = doc().documentElement, dev = isDev(loc);
    if (html && html.classList) { if (dev) html.classList.add('gn-env-dev'); else html.classList.remove('gn-env-dev'); }
    return dev;
  }

  // ---------------------------------------------------------------- menús
  function menuOf(btn) { return btn ? byId(btn.getAttribute('aria-controls')) : null; }
  function items(menu) { return menu ? arr(menu.querySelectorAll('[role="menuitem"]')) : []; }

  function openMenu(btn, which) {
    var menu = menuOf(btn);
    if (!menu) return false;
    if (st.open && st.open !== btn) closeMenu(false);
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    st.open = btn;
    var list = items(menu);
    if (which === 'last') focus(list[list.length - 1]); else if (which !== 'none') focus(list[0]);
    return true;
  }

  function closeMenu(refocus) {
    var btn = st.open;
    if (!btn) return false;
    var menu = menuOf(btn);
    if (menu) menu.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
    st.open = null;
    if (refocus) focus(btn);
    return true;
  }

  function onMenuKey(e, btn) {
    var list = items(menuOf(btn)), i = list.indexOf(doc().activeElement), n = list.length;
    if (!n) return;
    if (e.key === 'ArrowDown') { stop(e); focus(list[(i + 1) % n]); }
    else if (e.key === 'ArrowUp') { stop(e); focus(list[(i - 1 + n) % n]); }
    else if (e.key === 'Home') { stop(e); focus(list[0]); }
    else if (e.key === 'End') { stop(e); focus(list[n - 1]); }
    else if (e.key === 'Escape' || e.key === 'Esc') { stop(e); closeMenu(true); }
    else if (e.key === 'Tab' && !st.sheet) closeMenu(false); // en la hoja el menú queda abierto y Tab sigue adentro
  }

  // ---------------------------------------------------------------- hoja del celular
  function tools() { return byId('gnTbTools'); }
  function more() { return byId('gnTbMore'); }
  function bar() { return byId('gnTopbar'); }

  function sheetFocusables() {
    var t = tools();
    var list = t ? arr(t.querySelectorAll('a, button')).filter(function (n) { return !n.disabled && !hiddenUp(n); }) : [];
    return [more()].filter(Boolean).concat(list);
  }

  function openSheet() {
    var b = bar(), m = more();
    if (!b || st.sheet) return false;
    st.sheet = true;
    b.classList.add('is-open');
    if (m) m.setAttribute('aria-expanded', 'true');
    focus(sheetFocusables()[1]);
    return true;
  }

  function closeSheet(refocus) {
    var b = bar(), m = more();
    if (!b || !st.sheet) return false;
    closeMenu(false);
    st.sheet = false;
    b.classList.remove('is-open');
    if (m) m.setAttribute('aria-expanded', 'false');
    if (refocus) focus(m);
    return true;
  }

  function trapTab(e) {
    var list = sheetFocusables();
    if (list.length < 2) return;
    var first = list[0], last = list[list.length - 1], cur = doc().activeElement;
    if (e.shiftKey && (cur === first || list.indexOf(cur) < 0)) { stop(e); focus(last); }
    else if (!e.shiftKey && (cur === last || list.indexOf(cur) < 0)) { stop(e); focus(first); }
  }

  // ---------------------------------------------------------------- oyentes
  function onKey(e) {
    if (!e) return;
    var btn = st.open, menu = menuOf(btn), cur = doc().activeElement;
    if (btn && menu && inside(menu, cur)) { onMenuKey(e, btn); if (e.key !== 'Tab' || !st.sheet) return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (cur && MENUS.indexOf(cur.id) >= 0) { stop(e); openMenu(cur, e.key === 'ArrowUp' ? 'last' : 'first'); }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (st.open) { stop(e); closeMenu(true); return; }
      if (st.sheet) { stop(e); closeSheet(true); }
      return;
    }
    if (e.key === 'Tab' && st.sheet) trapTab(e);
  }

  // Captura: elegir algo cierra el menú y la hoja ANTES de que corra la acción del botón.
  function onPick(e) {
    var t = e && e.target, n = t;
    for (; n && n !== tools(); n = n.parentNode) {
      if (n.getAttribute && (n.getAttribute('role') === 'menuitem' || n.id === 'guideLink')) break;
    }
    if (!n || n === tools()) return;
    var back = st.sheet ? more() : st.open;
    closeMenu(false);
    closeSheet(false);
    focus(back);
  }

  function onTrigger(e) {
    var btn = e.currentTarget || e.target;
    if (st.open === btn) closeMenu(false); else openMenu(btn, 'first');
  }

  function onOutside(e) {
    var b = bar();
    if (!b || inside(b, e && e.target)) return;
    closeMenu(false);
    closeSheet(false);
  }

  function onTheme(e) {
    if (e && e.preventDefault) e.preventDefault();
    var T = root.ThemeSelector;
    if (T && typeof T.openModal === 'function') T.openModal();
  }

  // ---------------------------------------------------------------- pie (TOP-6)
  function footCss() {
    var d = doc();
    if (!d.createElement || d.getElementById('gn-ft-css')) return false;
    var s = d.createElement('style');
    s.setAttribute('id', 'gn-ft-css');
    s.textContent = FOOT_CSS;
    (d.head || d.documentElement).appendChild(s);
    return true;
  }

  // «Guías de uso» y «Gestión de Keys» del pie tocan el botón de siempre de la barra.
  function onFoot(e) {
    var box = byId('gnFooter'), n = e && e.target;
    for (; n && n !== box; n = n.parentNode) {
      var id = n.getAttribute && n.getAttribute('data-gn-open');
      if (!id) continue;
      var t = byId(id);
      if (e.preventDefault) e.preventDefault();
      focus(n);
      if (t && typeof t.click === 'function') t.click();
      return;
    }
  }

  function footer() {
    var f = byId('gnFooter');
    if (!f || st.foot) return false;
    st.foot = true;
    footCss();
    f.addEventListener('click', onFoot);
    return true;
  }

  function wire() {
    if (st.wired || !bar()) return false;
    st.wired = true;
    MENUS.forEach(function (id) { var b = byId(id); if (b) b.addEventListener('click', onTrigger); });
    var m = more();
    if (m) m.addEventListener('click', function () { if (st.sheet) closeSheet(true); else openSheet(); });
    var t = tools();
    if (t) t.addEventListener('click', onPick, true);
    var th = byId('themeToggleBtn');
    if (th) th.addEventListener('click', onTheme);
    bar().addEventListener('keydown', onKey);
    doc().addEventListener('click', onOutside);
    if (typeof root.matchMedia === 'function') {
      var mq = root.matchMedia('(max-width:900px)');
      var on = function () { if (!mq.matches) closeSheet(false); };
      if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
    }
    return true;
  }

  function init() {
    markEnv();
    wire();
    footer();
    if (root.console && root.console.info) root.console.info('[GNTopbar] v' + VERSION);
  }

  root.GNTopbar = {
    version: VERSION, init: init, isDev: isDev, markEnv: markEnv,
    openMenu: openMenu, closeMenu: closeMenu, openSheet: openSheet, closeSheet: closeSheet, footer: footer,
    _state: function () { return { open: st.open ? st.open.id : null, sheet: st.sheet }; }
  };

  if (doc() && doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', init);
  else if (doc()) init();
})(typeof window !== 'undefined' ? window : this);
