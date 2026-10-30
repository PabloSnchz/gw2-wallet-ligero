/*!
 * js/sidebar-nav.js — La Sidebar: la navegación de la Bóveda (BL-061)
 * Versión: 2.3.1 (2026-10-30) · BL-082 BLD-ICON: Builds con el ícono oficial de la pestaña Build del Panel del héroe (156720)
 *          2.3.0 (2026-10-28) · BL-082 BLD-1: Builds en la lista, antes de Cuentas (EXTRA)
 *          2.2.6 (2026-10-25) · propuesta SBR-0 aprobada por Pablo (Sidebar a la izquierda)
 *
 * La Sidebar es solo navegación (como la Bienvenida, DEC-032: no muestra contenido de ningún módulo).
 * Arma su lista desde la de la Bienvenida (Welcome._pure.MODULES): mismo orden, nombre, ícono y color.
 * Inicio primero, los módulos y Cuentas aparte. Mismos ids de enlace que antes (navCards, navMeta…)
 * y las mismas clases que busca el router (.side-nav a), así que router.js no cambia.
 *
 * Sin tocar index.html (69 KB, LES-028): rearmo #sideNavPanel al cargar y pongo mis estilos con
 * #appSidebar, que le ganan a las tres capas viejas (<style> de index.html, main.css y theme-polish.css).
 * Desde 901 px la Sidebar va a la izquierda, fija al hacer scroll. Hasta 900 px, barra fija abajo.
 *
 * Contraste: uso la guarda de la Bienvenida (Welcome._pure.contrastFixes) en la Sidebar, la barra y la hoja.
 *
 * 2.0.0 (SBR-1): todo lo anterior. Corrige el oyente de `gn:nav-active` que se agregaba de nuevo en
 *   cada cambio de módulo (estaba anidado por error) y el activo de rutas internas
 *   (#/account/legendary-armory/…, #/account/strikes, #/wallet/dashboard).
 * 2.1.0 (SBR-2): «Gato identificado» pasa a «Cuenta activa»: nombre, estado de su Key (completa, le falta
 *   un permiso, sin verificar o sin Key) y «Cambiar», que lleva al selector de arriba. Punto «Falta permiso»
 *   en los módulos que la Key activa no alcanza (Welcome._pure.buildModel: los mismos datos que «Tu Bóveda»)
 *   y «Nuevo» en los que tienen una novedad de 14 días o menos (assets/welcome-news.json, pickNews de la
 *   Bienvenida). Se ocultan «Próximas funciones» (vieja) y «Próximos (Top 3)» (repetía «Ahora» de Metas).
 *   Sin pedidos nuevos a la API: el nombre sale del mismo /v2/account de siempre.
 * 2.2.0 (SBR-3): en el celular (hasta 900 px) la cuenta y la navegación de la Sidebar ya no quedan al fondo
 *   de la página: barra fija abajo con Inicio, Cartera, Metas, Armería y «Más». «Más» abre una hoja
 *   (diálogo) con la cuenta activa y los otros 6 destinos; el foco queda adentro, Escape, «Cerrar» o
 *   tocar afuera la cierran y el foco vuelve a «Más». Punto ámbar en «Más» si adentro hay algo para
 *   revisar (la Key o un permiso). Controles de 44 px, zona segura del iPhone y lugar abajo para que nada
 *   quede tapado. El panel de Logros sigue donde estaba.
 * 2.2.1 (SBR-4a): arranco cuando ya cargaron todos los scripts. index.html los carga con `defer` y la
 *   Bienvenida viene después: arrancando antes, «Nuevo» no aparecía nunca y la guarda de contraste no se
 *   aplicaba hasta cambiar de theme (la tarjeta se arreglaba sola con el gn:tokenchange de app.js).
 *   Si la Bienvenida igual no está, las novedades se piden de nuevo en el próximo refresco.
 * 2.2.2 (SBR-5, revisión): «Nuevo» se lee igual en todos lados. En la barra del celular es un punto con
 *   el texto a tamaño 0, y algunos lectores de pantalla (VoiceOver) saltean ese texto. Ahora la marca
 *   visible queda oculta para el lector y se lee «(nuevo)» aparte, como «(falta permiso)».
 * 2.2.3 (BL-070, RAI-5a): el módulo de raids se llama «Raids» (sin Strikes). El juego unificó strikes y raids el
 *   2026-02-03 y el módulo ya es uno solo (Alas y Encuentros); #/account/strikes sigue marcando Raids.
 * 2.2.4 (BL-070, ACT-5): la Heredad (#/account/homestead) es un módulo propio, después de Actividades.
 * 2.2.5 (BL-070, PUL-3): el orden que eligió Pablo: Cartera; lo diario (Metas, Cámara, Actividades, Heredad);
 *   lo semanal (Raids); el progreso de la cuenta (Logros, Inventario y Personajes, Armería). La barra del celular no cambia.
 * 2.2.6 (BL-070, PUL-4): Inicio con el ícono oficial del punto de ruta (/v2/files, map_waypoint): el de la casa
 *   es de la Heredad. La brújula del mapa del mundo no está en la API ni en el servicio de imágenes con su firma.
 */
(function (root) {
  'use strict';
  var VERSION = '2.3.1';
  var LOG = '[SidebarNav]';

  // Respaldo idéntico a Welcome._pure.MODULES (lo vigila tests/sidebar-nav.test.cjs).
  var MODULES_FALLBACK = [
    { id: 'cards', name: 'Cartera', href: '#/cards', icon: 'assets/icons/733322.png', color: '#F2B94B' },
    { id: 'meta', name: 'Metas y Eventos', href: '#/meta', icon: 'assets/icons/102420.png', color: '#A896FF' },
    { id: 'wv', name: 'Cámara del Brujo', href: '#/account/wizards-vault', icon: 'assets/icons/3172791.png', color: '#15C3B7' },
    { id: 'activities', name: 'Actividades', href: '#/activities', icon: 'assets/icons/1302773.png', color: '#3CC48A' },
    { id: 'homestead', name: 'Heredad', href: '#/account/homestead', icon: 'assets/icons/Welcome/3380755.png', color: '#D9A55B' },
    { id: 'raids', name: 'Raids', href: '#/account/raids', icon: 'assets/icons/raids/raid-icon.png', color: '#F47C7C' },
    { id: 'achievements', name: 'Logros', href: '#/account/achievements', icon: 'assets/icons/155059.png', color: '#6EA3FF' },
    { id: 'characters', name: 'Inventario y Personajes', href: '#/account/characters', icon: 'assets/icons/Welcome/358409.png', color: '#7EC3FF' },
    { id: 'armory', name: 'Armería Legendaria', href: '#/account/legendary-armory', icon: 'assets/icons/Cuentas/157085.png', color: '#E545CA' },
    { id: 'accounts', name: 'Cuentas', href: '#/account/accounts', icon: 'assets/icons/3601748.png', color: '#8E96A3' }
  ];
  var HOME = { id: 'home', name: 'Inicio', href: '#/welcome', icon: 'https://render.guildwars2.com/file/32633AF8ADEA696A1EF56D3AE32D617B10D3AC57/157353.png', color: 'var(--acc-1)' };
  // Ids y data-view que ya usaban el router y otros módulos.
  var LINK_ID = { home: 'navHome', cards: 'navCards', meta: 'navMeta', armory: 'navLegendaryArmory', achievements: 'navAch',
    wv: 'navWV', activities: 'navAC', homestead: 'navHS', raids: 'navRaids', characters: 'navChars', accounts: 'navAccounts' };
  var VIEW = { home: 'welcome', cards: 'cards', meta: 'meta', armory: 'legendaryArmory', achievements: 'achievements',
    wv: 'wv', activities: 'activities', homestead: 'homestead', raids: 'raids', characters: 'inventory', accounts: 'accounts' };
  // Pantallas que viven dentro de un módulo de la lista.
  var ALIAS = { '#/wallet/dashboard': '#/cards', '#/account/strikes': '#/account/raids', '#/inventory/dashboard': '#/account/characters' };
  var DEFAULT_HASH = '#/cards'; // lo que muestra el router cuando no hay hash
  // Celular: los 3 módulos que van en la barra después de Inicio (los renovados y más usados). Se cambian acá.
  var TABS = ['cards', 'meta', 'armory'];
  var SHORT = { home: 'Inicio', cards: 'Cartera', meta: 'Metas', armory: 'Armería' };
  var SIDE = ':is(#appSidebar,#sbrSheet)';

  var CSS = [
    '@media (min-width:901px){' +
      '.container.layout{grid-template-columns:252px minmax(0,1fr)}' +
      '.container.layout>#appSidebar{grid-column:1;grid-row:1;position:sticky;top:12px;align-self:start;max-height:calc(100vh - 24px);overflow-y:auto}' +
      '.container.layout>:not(#appSidebar){grid-column:2}}',
    '#sideNavPanel.sbr-host{background:transparent;border:0;box-shadow:none;padding:0;margin:0}',
    '#appSidebar .sbr{display:flex;flex-direction:column;gap:2px;padding:4px 0}',
    '#appSidebar .sbr-cap{margin:12px 12px 4px;font-size:.68rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--tx-3);line-height:1.2}',
    SIDE + ' .sbr-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}',
    SIDE + ' .sbr-list li{margin:0;padding:0}',
    SIDE + ' .sbr-list a{position:relative;display:flex;align-items:center;gap:11px;min-height:40px;padding:7px 10px 7px 12px;' +
      'border:1px solid transparent;border-radius:9px;background:transparent;box-shadow:none;transform:none;color:var(--tx-2);' +
      'font-size:.92rem;font-weight:500;letter-spacing:0;text-decoration:none;transition:background-color .12s ease,border-color .12s ease}',
    SIDE + ' .sbr-list a span{color:inherit;font:inherit;letter-spacing:inherit}',
    SIDE + ' .sbr-list a:hover{background:var(--bg-1);border-color:var(--bd-1);transform:none}',
    SIDE + ' .sbr-list a.is-active{background:var(--bg-1);border-color:var(--bd-2,var(--bd-1));color:var(--tx-1);font-weight:600;box-shadow:none}',
    SIDE + ' .sbr-list a.is-active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--x,var(--acc-1))}',
    SIDE + ' .sbr-list a:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    SIDE + ' .sbr-ic{width:24px;height:24px;border-radius:6px;object-fit:contain;flex-shrink:0;filter:none}',
    '#appSidebar .sbr-sep{height:1px;background:var(--bd-1);margin:8px 6px}',
    '@media (prefers-reduced-motion:reduce){' + SIDE + ' .sbr-list a{transition:none}}',
    // SBR-2: paneles viejos fuera; cuenta activa; avisos en los enlaces.
    '#asideNextFeatures,#metaAsideNext{display:none!important}',
    '#sideAccountPanel.sbr-host{background:transparent;border:0;box-shadow:none;padding:0;margin:0 0 4px}',
    SIDE + ' .sbr-acct{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:2px 10px;align-items:center;' +
      'padding:10px 12px;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    SIDE + ' .sbr-acct img{grid-row:span 2;width:36px;height:36px;border-radius:9px;background:var(--bg-2,var(--bg-0));padding:4px;object-fit:contain}',
    SIDE + ' .sbr-acct small{font-size:.68rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-3);line-height:1.2}',
    SIDE + ' .sbr-acct b{grid-column:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-1);font-size:.92rem}',
    SIDE + ' .sbr-chg{grid-column:3;grid-row:1 / span 2;display:inline-flex;align-items:center;min-height:30px;padding:2px 10px;' +
      'border:1px solid var(--bd-1);border-radius:999px;background:transparent;color:var(--tx-2);font:inherit;font-size:.75rem;cursor:pointer;text-decoration:none}',
    SIDE + ' .sbr-chg:hover{border-color:var(--acc-1);color:var(--tx-1)}',
    SIDE + ' .sbr-chg:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    SIDE + ' .sbr-st{grid-column:1 / -1;display:flex;align-items:center;gap:7px;margin-top:8px;font-size:.78rem;color:var(--tx-3)}',
    SIDE + ' .sbr-st span{color:inherit}',
    ':is(#appSidebar,#sbrSheet,#sbrTabs) .sbr-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--color-green)}',
    ':is(#appSidebar,#sbrSheet,#sbrTabs) .sbr-dot.is-warn{background:var(--gn-gold,var(--color-amber))}',
    SIDE + ' .sbr-dot.is-info{background:var(--tx-3)}',
    SIDE + ' .sbr-w{margin-left:auto;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--gn-gold,var(--color-amber))}',
    SIDE + ' .sbr-new{margin-left:auto;flex-shrink:0;font-size:.6rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;' +
      'color:var(--gn-gold,var(--color-amber));border:1px solid var(--gn-gold,var(--color-amber));border-radius:999px;padding:0 6px;line-height:1.5}',
    '.sbr-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    // SBR-3: celular. La barra y la hoja solo existen hasta 900 px.
    '#sbrTabs,#sbrSheet,#sbrScrim{display:none}',
    '@media (max-width:900px){' +
      '#sideNavPanel,#sideAccountPanel{display:none!important}' +
      'body{padding-bottom:calc(68px + env(safe-area-inset-bottom,0px))}' +
      '#sbrTabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;left:0;right:0;bottom:0;z-index:900;' +
        'margin:0;padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px));background:var(--bg-1);border-top:1px solid var(--bd-2,var(--bd-1));' +
        'box-shadow:0 -6px 18px rgba(0,0,0,.25)}' +
      '#sbrTabs .sbr-tab{position:relative;display:grid;justify-items:center;align-content:center;gap:3px;min-height:52px;min-width:44px;padding:4px 2px;' +
        'border:0;border-radius:10px;background:transparent;color:var(--tx-3);font:inherit;font-size:.68rem;font-weight:500;line-height:1.1;text-decoration:none;cursor:pointer}' +
      '#sbrTabs .sbr-tab span{color:inherit;font:inherit}' +
      '#sbrTabs .sbr-tab img{width:24px;height:24px;object-fit:contain}' +
      '#sbrTabs .sbr-more-ic{font-size:1.15rem;line-height:24px;color:var(--tx-2)}' +
      '#sbrTabs .sbr-tab.is-active{color:var(--tx-1);font-weight:700}' +
      '#sbrTabs .sbr-tab.is-active::before{content:"";position:absolute;top:-6px;left:28%;right:28%;height:3px;border-radius:3px;background:var(--x,var(--acc-1))}' +
      '#sbrTabs .sbr-tab:focus-visible{outline:2px solid var(--acc-1);outline-offset:-2px}' +
      '#sbrTabs .sbr-w,#sbrTabs .sbr-new,#sbrTabs .sbr-dot{position:absolute;top:4px;right:calc(50% - 20px);width:9px;height:9px;padding:0;margin:0;border:0;' +
        'border-radius:50%;background:var(--gn-gold,var(--color-amber));box-shadow:0 0 0 2px var(--bg-1);font-size:0;line-height:0;overflow:hidden}' +
      '#sbrScrim:not([hidden]){display:block;position:fixed;inset:0;z-index:1000;background:rgba(5,6,10,.6)}' +
      '#sbrSheet:not([hidden]){display:block;position:fixed;left:0;right:0;bottom:0;z-index:1001;max-height:84vh;overflow-y:auto;' +
        'padding:8px 12px calc(14px + env(safe-area-inset-bottom,0px));background:var(--bg-1);border-top:1px solid var(--bd-2,var(--bd-1));' +
        'border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.35);animation:sbr-up .16s ease-out}' +
      '#sbrSheet .sbr-grab{width:40px;height:4px;border-radius:4px;background:var(--bd-2,var(--bd-1));margin:2px auto 8px}' +
      '#sbrSheet .sbr-shead{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px}' +
      '#sbrSheet .sbr-shead h2{margin:0;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-3)}' +
      '#sbrSheet .sbr-close{min-height:44px;min-width:44px;padding:0 12px;border:1px solid var(--bd-1);border-radius:999px;background:transparent;color:var(--tx-2);font:inherit;font-size:.85rem;cursor:pointer}' +
      '#sbrSheet .sbr-close:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}' +
      '#sbrSheet .sbr-acct{margin-bottom:10px}' +
      '#sbrSheet .sbr-chg{min-height:44px}' +
      '#sbrSheet .sbr-list a{min-height:48px}' +
      'html.sbr-lock,html.sbr-lock body{overflow:hidden}}',
    '@keyframes sbr-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){#sbrSheet:not([hidden]){animation:none}}'
  ].join('\n');

  var state = { built: false, watching: false, applied: [], lastToken: null, acctCtrl: null, accName: '', news: null, newsLoading: false,
    mobile: false, sheetOpen: false, lastFocus: null };
  var NEWS_URL = 'assets/welcome-news.json';
  var ACCOUNT_ICON = 'assets/icons/3601748.png';

  function doc() { return root.document; }
  function $(s, r) { return (r || doc()).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc()).querySelectorAll(s)); }

  // ---------------------------------------------------------------- modelo (puro)
  function modules() {
    var W = root.Welcome;
    var list = W && W._pure && Array.isArray(W._pure.MODULES) && W._pure.MODULES.length ? W._pure.MODULES : MODULES_FALLBACK;
    return withExtra(list).map(function (m) { return { id: m.id, name: m.name, href: m.href, icon: m.icon, color: m.color }; });
  }

  // BL-082 BLD-1: módulos que la Bienvenida todavía no lista (welcome-panel.js no tiene lugar: 48 KB).
  // Van antes de Cuentas y una sola vez: si algún día la Bienvenida los suma, no se repiten.
  var EXTRA = [{ id: 'builds', name: 'Builds', href: '#/builds', icon: 'assets/icons/156720.png', color: '#C9B6FF' }];
  function withExtra(list) {
    var out = list.filter(function (m) { return m.id !== 'accounts'; }), tail = list.filter(function (m) { return m.id === 'accounts'; });
    EXTRA.forEach(function (x) { if (!list.some(function (m) { return m.id === x.id; })) out.push(x); });
    return out.concat(tail);
  }

  // Los grupos de la Sidebar: Inicio, los módulos y Cuentas aparte.
  function groups() {
    var mods = modules();
    return {
      home: [HOME],
      modules: mods.filter(function (m) { return m.id !== 'accounts'; }),
      tail: mods.filter(function (m) { return m.id === 'accounts'; })
    };
  }

  // Celular: la barra (Inicio + TABS) y lo que va en «Más» (todo lo demás, en el mismo orden).
  function mobileGroups() {
    var mods = modules();
    var byId = {};
    mods.forEach(function (m) { byId[m.id] = m; });
    var tabs = [HOME].concat(TABS.map(function (id) { return byId[id]; }).filter(Boolean));
    var more = mods.filter(function (m) { return TABS.indexOf(m.id) < 0; });
    return { tabs: tabs, more: more };
  }

  function normHash(h) {
    var s = String(h == null ? '' : h).split('?')[0].replace(/\/+$/, '');
    if (!s || s === '#') return DEFAULT_HASH;
    return ALIAS[s] || s;
  }

  // Qué enlace va activo para un hash: el de href igual o el prefijo más largo («#/x/…»).
  function activeFor(hash, hrefs) {
    var h = normHash(hash), best = null;
    (hrefs || []).forEach(function (href) {
      if ((h === href || h.indexOf(href + '/') === 0) && (!best || href.length > best.length)) best = href;
    });
    return best;
  }

  function storageGet(name, fallback) {
    try {
      var S = root.Storage;
      if (!S || typeof S.get !== 'function') return null;
      return S.get((S.STORAGE_KEYS && S.STORAGE_KEYS[name]) || fallback);
    } catch (_) { return null; }
  }

  // Estado de la cuenta activa, con los mismos datos que «Tu Bóveda» (sin pedidos a la API).
  function accountModel() {
    var W = root.Welcome;
    if (!W || !W._pure || typeof W._pure.buildModel !== 'function') return null;
    var sel = $('#keySelectGlobal');
    var selected = storageGet('ACCOUNT_SELECTED', 'gn:account:selected') || (sel ? String(sel.value || '') : '');
    try { return W._pure.buildModel({ keys: storageGet('ACCOUNT_KEYS', 'gn:account:keys'), selected: selected }); }
    catch (_) { return null; }
  }

  // Qué dice la línea de estado de la tarjeta de cuenta.
  function keyLine(m) {
    if (!m || m.state !== 'back') return { level: 'warn', text: 'Todavía no cargaste una API Key' };
    if (m.activeStatus === 'missing') {
      var act = (m.keys || []).filter(function (k) { return k.active; })[0];
      var miss = act && act.missing && act.missing.length ? act.missing : [];
      return { level: 'warn', text: miss.length === 1 ? 'API Key · le falta «' + miss[0] + '»'
        : 'API Key · le faltan ' + miss.length + ' permisos' };
    }
    if (m.activeStatus === 'unknown') return { level: 'info', text: 'API Key sin verificar' };
    return { level: 'ok', text: 'API Key completa' };
  }

  // Módulos con una novedad marcada como «NUEVO» en la Bienvenida.
  function newModules(news) {
    var out = {};
    (Array.isArray(news) ? news : []).forEach(function (n) { if (n && n.isNew && n.module) out[n.module] = true; });
    return out;
  }

  // «Más» lleva punto si adentro hay algo para revisar: la Key de la cuenta activa o un permiso de sus módulos.
  function moreNeedsAttention(m, moreIds) {
    if (keyLine(m).level === 'warn') return true;
    var miss = (m && m.state === 'back' && m.activeMods) || [];
    return (moreIds || []).some(function (id) { return miss.indexOf(id) >= 0; });
  }

  // ---------------------------------------------------------------- DOM
  function ensureCSS() {
    var d = doc();
    if (d.getElementById('sbr-css')) return;
    var st = d.createElement('style');
    st.setAttribute('id', 'sbr-css');
    st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  function iconEl(d, m, cls, size) {
    var img = d.createElement('img');
    img.className = cls;
    img.setAttribute('src', m.icon);
    img.setAttribute('alt', '');
    img.setAttribute('width', size);
    img.setAttribute('height', size);
    return img;
  }

  // withIds: solo la Sidebar lleva los ids y data-view que usan el router y otros módulos.
  function linkEl(d, m, withIds) {
    var a = d.createElement('a');
    a.setAttribute('href', m.href);
    if (withIds) {
      a.setAttribute('id', LINK_ID[m.id] || ('nav-' + m.id));
      a.setAttribute('data-view', VIEW[m.id] || m.id);
    }
    a.setAttribute('data-mod', m.id);
    a.setAttribute('style', '--x:' + m.color);
    var t = d.createElement('span');
    t.textContent = m.name;
    a.appendChild(iconEl(d, m, 'sbr-ic', '24'));
    a.appendChild(t);
    var li = d.createElement('li');
    li.appendChild(a);
    return li;
  }

  function listEl(d, items, labelId, withIds, cls) {
    var ul = d.createElement('ul');
    ul.className = cls || 'sbr-list side-nav';
    if (labelId) ul.setAttribute('aria-labelledby', labelId);
    items.forEach(function (m) { ul.appendChild(linkEl(d, m, withIds)); });
    return ul;
  }

  // Rearma #sideNavPanel. Idempotente.
  function build() {
    var d = doc();
    var host = d.getElementById('sideNavPanel');
    if (!host) return null;
    ensureCSS();
    var g = groups();
    var nav = d.createElement('nav');
    nav.className = 'sbr';
    nav.setAttribute('id', 'sbrNav');
    nav.setAttribute('aria-label', 'Navegación de la Bóveda');
    nav.appendChild(listEl(d, g.home, null, true));
    var cap = d.createElement('p');
    cap.className = 'sbr-cap';
    cap.setAttribute('id', 'sbrModsCap');
    cap.textContent = 'Módulos';
    nav.appendChild(cap);
    nav.appendChild(listEl(d, g.modules, 'sbrModsCap', true));
    if (g.tail.length) {
      var sep = d.createElement('div');
      sep.className = 'sbr-sep';
      sep.setAttribute('role', 'presentation');
      nav.appendChild(sep);
      nav.appendChild(listEl(d, g.tail, null, true));
    }
    while (host.firstChild) host.removeChild(host.firstChild);
    host.removeAttribute('aria-labelledby');
    host.className = 'sbr-host';
    host.appendChild(nav);
    state.built = true;
    buildMobile();
    syncActive();
    renderAccount();
    decorate();
    applyContrast();
    return nav;
  }

  // ---------------------------------------------------------------- celular (SBR-3)
  function buildMobile() {
    var d = doc();
    if (!d.body) return null;
    var old = [d.getElementById('sbrTabs'), d.getElementById('sbrSheet'), d.getElementById('sbrScrim')];
    old.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    state.sheetOpen = false;
    var g = mobileGroups();

    var tabs = d.createElement('nav');
    tabs.setAttribute('id', 'sbrTabs');
    tabs.setAttribute('aria-label', 'Navegación principal');
    g.tabs.forEach(function (m) {
      var a = d.createElement('a');
      a.className = 'sbr-tab';
      a.setAttribute('href', m.href);
      a.setAttribute('data-mod', m.id);
      a.setAttribute('style', '--x:' + m.color);
      var t = d.createElement('span');
      t.textContent = SHORT[m.id] || m.name;
      a.appendChild(iconEl(d, m, 'sbr-tic', '24'));
      a.appendChild(t);
      tabs.appendChild(a);
    });
    var more = d.createElement('button');
    more.className = 'sbr-tab sbr-more';
    more.setAttribute('type', 'button');
    more.setAttribute('id', 'sbrMore');
    more.setAttribute('aria-haspopup', 'dialog');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', 'sbrSheet');
    var ic = d.createElement('i');
    ic.className = 'sbr-more-ic';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = '☰';
    var lb = d.createElement('span');
    lb.textContent = 'Más';
    more.appendChild(ic);
    more.appendChild(lb);
    more.addEventListener('click', function () { if (state.sheetOpen) closeSheet(); else openSheet(); });
    tabs.appendChild(more);

    var scrim = d.createElement('div');
    scrim.setAttribute('id', 'sbrScrim');
    scrim.setAttribute('hidden', '');
    scrim.addEventListener('click', function () { closeSheet(); });

    var sheet = d.createElement('div');
    sheet.setAttribute('id', 'sbrSheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'sbrSheetT');
    sheet.setAttribute('hidden', '');
    var grab = d.createElement('div');
    grab.className = 'sbr-grab';
    grab.setAttribute('aria-hidden', 'true');
    var head = d.createElement('div');
    head.className = 'sbr-shead';
    var h = d.createElement('h2');
    h.setAttribute('id', 'sbrSheetT');
    h.textContent = 'Más de la Bóveda';
    var close = d.createElement('button');
    close.className = 'sbr-close';
    close.setAttribute('type', 'button');
    close.textContent = 'Cerrar';
    close.addEventListener('click', function () { closeSheet(); });
    head.appendChild(h);
    head.appendChild(close);
    var acct = d.createElement('div');
    acct.setAttribute('id', 'sbrSheetAcct');
    var list = listEl(d, g.more, 'sbrSheetT', false, 'sbr-list');
    $$('a', list).forEach(function (a) { a.addEventListener('click', function () { closeSheet(); }); });
    [grab, head, acct, list].forEach(function (n) { sheet.appendChild(n); });
    sheet.addEventListener('keydown', onSheetKey);

    d.body.appendChild(tabs);
    d.body.appendChild(scrim);
    d.body.appendChild(sheet);
    return tabs;
  }

  function focusables(box) {
    return $$('a, button', box).filter(function (n) { return !n.disabled && n.getAttribute('tabindex') !== '-1'; });
  }

  function openSheet() {
    var d = doc(), sheet = d.getElementById('sbrSheet'), scrim = d.getElementById('sbrScrim'), more = d.getElementById('sbrMore');
    if (!sheet || state.sheetOpen) return false;
    state.sheetOpen = true;
    state.lastFocus = d.activeElement || more;
    renderAccount();
    sheet.removeAttribute('hidden');
    if (scrim) scrim.removeAttribute('hidden');
    if (more) more.setAttribute('aria-expanded', 'true');
    if (d.documentElement && d.documentElement.classList) d.documentElement.classList.add('sbr-lock');
    var f = focusables(sheet)[0];
    if (f && f.focus) f.focus();
    return true;
  }

  function closeSheet() {
    var d = doc(), sheet = d.getElementById('sbrSheet'), scrim = d.getElementById('sbrScrim'), more = d.getElementById('sbrMore');
    if (!sheet || !state.sheetOpen) return false;
    state.sheetOpen = false;
    sheet.setAttribute('hidden', '');
    if (scrim) scrim.setAttribute('hidden', '');
    if (more) more.setAttribute('aria-expanded', 'false');
    if (d.documentElement && d.documentElement.classList) d.documentElement.classList.remove('sbr-lock');
    var back = state.lastFocus && state.lastFocus.focus ? state.lastFocus : more;
    state.lastFocus = null;
    if (back && back.focus) back.focus();
    return true;
  }

  // Foco atrapado en la hoja; Escape la cierra.
  function onSheetKey(e) {
    if (!e) return;
    if (e.key === 'Escape' || e.key === 'Esc') { if (e.preventDefault) e.preventDefault(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables(doc().getElementById('sbrSheet'));
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1], cur = doc().activeElement;
    if (e.shiftKey && (cur === first || list.indexOf(cur) < 0)) { if (e.preventDefault) e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (cur === last || list.indexOf(cur) < 0)) { if (e.preventDefault) e.preventDefault(); first.focus(); }
  }

  // Si la pantalla pasa a desktop con la hoja abierta, la cierro.
  function watchWidth() {
    if (typeof root.matchMedia !== 'function') return;
    var mq = root.matchMedia('(max-width:900px)');
    var on = function () { state.mobile = !!mq.matches; if (!mq.matches) closeSheet(); };
    if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
    on();
  }

  // ---------------------------------------------------------------- cuenta activa
  function accountBox(d, m, withId) {
    var line = keyLine(m);
    var box = d.createElement('div');
    box.className = 'sbr-acct';
    var img = d.createElement('img');
    img.setAttribute('src', ACCOUNT_ICON);
    img.setAttribute('alt', '');
    img.setAttribute('width', '36');
    img.setAttribute('height', '36');
    var cap = d.createElement('small');
    cap.textContent = 'Cuenta activa';
    var name = d.createElement('b');
    name.className = 'sbr-accname';
    if (withId) name.setAttribute('id', 'accountIdLabel');
    name.textContent = state.accName || (m && m.activeLabel) || '—';
    var chg;
    if (m && m.state === 'back') {
      chg = d.createElement('button');
      chg.setAttribute('type', 'button');
      chg.setAttribute('aria-label', 'Cambiar de cuenta');
      chg.textContent = 'Cambiar';
      chg.addEventListener('click', focusSelector);
    } else {
      chg = d.createElement('a');
      chg.setAttribute('href', '#/welcome');
      chg.textContent = 'Empezar';
      if (!withId) chg.addEventListener('click', function () { closeSheet(); });
    }
    chg.className = 'sbr-chg';
    var st = d.createElement('div');
    st.className = 'sbr-st';
    st.setAttribute('data-level', line.level);
    var dot = d.createElement('i');
    dot.className = 'sbr-dot' + (line.level === 'ok' ? '' : ' is-' + line.level);
    dot.setAttribute('aria-hidden', 'true');
    var txt = d.createElement('span');
    txt.textContent = line.text;
    st.appendChild(dot);
    st.appendChild(txt);
    [img, cap, name, chg, st].forEach(function (n) { box.appendChild(n); });
    return box;
  }

  // «Cuenta activa»: reemplaza a «Gato identificado» y se repite en la hoja «Más».
  function renderAccount() {
    var d = doc();
    var m = accountModel();
    var host = d.getElementById('sideAccountPanel');
    var box = null;
    if (host) {
      box = accountBox(d, m, true);
      while (host.firstChild) host.removeChild(host.firstChild);
      host.removeAttribute('aria-labelledby');
      host.setAttribute('aria-label', 'Cuenta activa');
      host.className = 'sbr-host';
      host.appendChild(box);
    }
    var sh = d.getElementById('sbrSheetAcct');
    if (sh) {
      while (sh.firstChild) sh.removeChild(sh.firstChild);
      sh.appendChild(accountBox(d, m, false));
    }
    return box;
  }

  // «Cambiar» lleva al selector de cuenta de arriba (el mismo de siempre).
  function focusSelector() {
    closeSheet();
    var sel = $('#keySelectGlobal');
    if (!sel) return;
    if (typeof sel.focus === 'function') sel.focus();
    if (typeof sel.showPicker === 'function') { try { sel.showPicker(); } catch (_) {} }
  }

  // «Falta permiso» y «Nuevo» en los enlaces de módulo (Sidebar, barra y hoja); punto en «Más».
  function decorate() {
    var d = doc();
    var m = accountModel();
    var missing = {};
    ((m && m.state === 'back' && m.activeMods) || []).forEach(function (id) { missing[id] = true; });
    var fresh = newModules(state.news);
    allLinks().forEach(function (a) {
      Array.prototype.slice.call(a.children || []).forEach(function (c) {
        if (/\bsbr-(w|new|sr)\b/.test(c.className || '')) a.removeChild(c);
      });
      a.removeAttribute('title');
      var id = a.getAttribute('data-mod');
      if (missing[id]) {
        var w = d.createElement('i');
        w.className = 'sbr-w';
        w.setAttribute('aria-hidden', 'true');
        var sr = d.createElement('span');
        sr.className = 'sbr-sr';
        sr.textContent = ' (falta permiso)';
        a.appendChild(w);
        a.appendChild(sr);
        a.setAttribute('title', 'A tu API Key le falta un permiso para este módulo');
      } else if (fresh[id]) {
        var n = d.createElement('i');
        n.className = 'sbr-new';
        n.setAttribute('aria-hidden', 'true');
        n.textContent = 'Nuevo';
        var srn = d.createElement('span');
        srn.className = 'sbr-sr';
        srn.textContent = ' (nuevo)';
        a.appendChild(n);
        a.appendChild(srn);
      }
    });
    var more = d.getElementById('sbrMore');
    if (more) {
      Array.prototype.slice.call(more.children || []).forEach(function (c) {
        if (/\bsbr-(dot|sr)\b/.test(c.className || '')) more.removeChild(c);
      });
      if (moreNeedsAttention(m, mobileGroups().more.map(function (x) { return x.id; }))) {
        var dot = d.createElement('i');
        dot.className = 'sbr-dot is-warn';
        dot.setAttribute('aria-hidden', 'true');
        var s2 = d.createElement('span');
        s2.className = 'sbr-sr';
        s2.textContent = ' (hay algo para revisar)';
        more.appendChild(dot);
        more.appendChild(s2);
      }
    }
  }

  function loadNews() {
    if (state.news !== null || state.newsLoading || typeof root.fetch !== 'function') return null;
    var W = root.Welcome;
    var pick = W && W._pure && typeof W._pure.pickNews === 'function' ? W._pure.pickNews : null;
    if (!pick) return null; // sin la Bienvenida todavía: lo intento en el próximo refresco
    state.newsLoading = true;
    return root.fetch(NEWS_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (data) {
        state.newsLoading = false;
        try { state.news = pick(data && data.items ? data.items : data); } catch (_) { state.news = []; }
        decorate();
      });
  }

  // Cambió la Key o sus permisos: rearmo la tarjeta y los avisos.
  function refresh() {
    if (!state.built) return;
    renderAccount();
    decorate();
    applyContrast();
    updateAccountId();
    loadNews();
  }

  function links() { return $$('#sbrNav a'); }
  function sheetLinks() { return $$('#sbrSheet a').filter(function (a) { return !!a.getAttribute('data-mod'); }); }
  function allLinks() { return $$('#sbrNav a').concat($$('#sbrTabs a'), sheetLinks()); }

  function syncActive(hash) {
    var all = allLinks();
    if (!all.length) return null;
    var h = hash != null ? hash : (root.location ? root.location.hash : '');
    var hrefs = all.map(function (a) { return a.getAttribute('href'); });
    var href = activeFor(h, hrefs);
    var on = null, inSheet = false;
    all.forEach(function (a) {
      if (!a.getAttribute('data-mod')) return;
      var is = a.getAttribute('href') === href;
      if (is) {
        if (!on && links().indexOf(a) >= 0) on = a;
        a.classList.add('is-active'); a.setAttribute('aria-current', 'page');
        if (sheetLinks().indexOf(a) >= 0) inSheet = true;
      } else { a.classList.remove('is-active'); a.removeAttribute('aria-current'); }
    });
    var more = doc().getElementById('sbrMore');
    if (more) { if (inSheet) more.classList.add('is-active'); else more.classList.remove('is-active'); }
    return on;
  }

  // ---------------------------------------------------------------- contraste
  var TOKENS = ['--bg-0', '--bg-1', '--tx-1', '--tx-3', '--muted', '--color-green', '--gn-gold', '--color-amber', '--acc-1', '--color-green-bg', '--color-amber-bg'];
  function applyContrast() {
    var d = doc();
    var hosts = ['appSidebar', 'sbrTabs', 'sbrSheet'].map(function (id) { return d.getElementById(id); })
      .filter(function (n) { return n && n.style; });
    var W = root.Welcome;
    if (!hosts.length || !W || !W._pure || typeof W._pure.contrastFixes !== 'function') return {};
    var t = {};
    if (typeof root.getComputedStyle === 'function' && d.documentElement) {
      var cs = root.getComputedStyle(d.documentElement);
      TOKENS.forEach(function (k) { t[k] = cs && cs.getPropertyValue ? cs.getPropertyValue(k) : ''; });
    }
    var fixes = W._pure.contrastFixes(t) || {};
    hosts.forEach(function (host) {
      state.applied.forEach(function (k) { if (!(k in fixes)) host.style.removeProperty(k); });
      Object.keys(fixes).forEach(function (k) { host.style.setProperty(k, fixes[k]); });
    });
    state.applied = Object.keys(fixes);
    return fixes;
  }

  function watchTheme() {
    if (state.watching) return;
    state.watching = true;
    var d = doc();
    if (typeof root.MutationObserver === 'function' && d.documentElement) {
      new root.MutationObserver(function () { applyContrast(); })
        .observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    d.addEventListener('load', function (e) {
      var t = e && e.target;
      if (t && t.id === 'themeStylesheet') applyContrast();
    }, true);
  }

  // ---------------------------------------------------------------- nombre de la cuenta (/v2/account, como en 1.2)
  function setNames(v) { $$('.sbr-accname').forEach(function (n) { n.textContent = v; }); }
  function updateAccountId() {
    var out = $('#accountIdLabel');
    var sel = $('#keySelectGlobal');
    if (!out || !sel) return null;
    var token = String(sel.value || '').trim();
    if (!token) { state.lastToken = null; state.accName = ''; return null; }
    if (token === state.lastToken && state.accName) { setNames(state.accName); return null; }
    if (typeof root.fetch !== 'function') return null;
    if (state.acctCtrl) { try { state.acctCtrl.abort(); } catch (_) {} }
    state.acctCtrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var url = 'https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(token);
    return root.fetch(url, { headers: { Accept: 'application/json' }, signal: state.acctCtrl ? state.acctCtrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        state.accName = (j && j.name) || '';
        state.lastToken = token;
        if (state.accName) setNames(state.accName);
      })
      .catch(function () { state.accName = ''; });
  }

  // ---------------------------------------------------------------- arranque
  function init() {
    build();
    watchTheme();
    watchWidth();
    updateAccountId();
    loadNews();
    if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
  }

  // Oyentes una sola vez (en 1.2 el de gn:nav-active se volvía a agregar en cada cambio).
  if (typeof root.addEventListener === 'function') root.addEventListener('hashchange', function () { syncActive(); });
  // El router marca su activo y avisa: yo dejo el mío (mismo criterio para rutas internas).
  doc().addEventListener('gn:nav-active', function (ev) { syncActive(ev && ev.detail && ev.detail.hash); });
  doc().addEventListener('gn:tokenchange', function () { refresh(); });
  if (typeof root.addEventListener === 'function') root.addEventListener('storage', function () { refresh(); });
  (function () { var sel = $('#keySelectGlobal'); if (sel) sel.addEventListener('change', refresh); })();

  root.SidebarNav = {
    version: VERSION, init: init, build: build, syncActive: syncActive, applyContrast: applyContrast, refresh: refresh,
    openSheet: openSheet, closeSheet: closeSheet,
    _pure: { groups: groups, mobileGroups: mobileGroups, activeFor: activeFor, normHash: normHash, keyLine: keyLine, newModules: newModules,
      moreNeedsAttention: moreNeedsAttention, MODULES_FALLBACK: MODULES_FALLBACK, HOME: HOME, TABS: TABS, SHORT: SHORT,
      LINK_ID: LINK_ID, VIEW: VIEW, ALIAS: ALIAS, CSS: CSS, EXTRA: EXTRA }
  };

  // Welcome (welcome-panel.js) se carga después, y con `defer` el estado ya es «interactive» cuando corro:
  // armo en DOMContentLoaded, que llega cuando ya corrieron todos. Si la página ya terminó, armo ahora.
  if (doc().readyState === 'complete') init();
  else doc().addEventListener('DOMContentLoaded', init);

})(typeof window !== 'undefined' ? window : this);
