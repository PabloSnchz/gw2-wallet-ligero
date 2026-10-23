/*!
 * js/sidebar-nav.js — La Sidebar: la navegación de la Bóveda (BL-061)
 * Versión: 2.1.0 (2026-10-23) · propuesta SBR-0 aprobada por Pablo (Sidebar a la izquierda)
 *
 * La Sidebar es solo navegación (como la Bienvenida, DEC-032: no muestra contenido de ningún módulo).
 * Arma su lista desde la de la Bienvenida (Welcome._pure.MODULES): mismo orden, nombre, ícono y color.
 * Inicio primero, los módulos y Cuentas aparte. Mismos ids de enlace que antes (navCards, navMeta…)
 * y las mismas clases que busca el router (.side-nav a), así que router.js no cambia.
 *
 * Sin tocar index.html (69 KB, LES-028): rearmo #sideNavPanel al cargar y pongo mis estilos con
 * #appSidebar, que le ganan a las tres capas viejas (<style> de index.html, main.css y theme-polish.css).
 * Desde 901 px la Sidebar va a la izquierda, fija al hacer scroll. Debajo de 900 px queda como estaba
 * hasta SBR-3 (barra de abajo en el celular).
 *
 * Contraste: uso la guarda de la Bienvenida (Welcome._pure.contrastFixes) dentro de #appSidebar.
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
 * 1.2: resaltado de respaldo y nombre de la cuenta en «Gato identificado».
 */
(function (root) {
  'use strict';
  var VERSION = '2.1.0';
  var LOG = '[SidebarNav]';

  // Respaldo idéntico a Welcome._pure.MODULES (lo vigila tests/sidebar-nav.test.cjs).
  var MODULES_FALLBACK = [
    { id: 'cards', name: 'Cartera', href: '#/cards', icon: 'assets/icons/733322.png', color: '#F2B94B' },
    { id: 'meta', name: 'Metas y Eventos', href: '#/meta', icon: 'assets/icons/102420.png', color: '#A896FF' },
    { id: 'armory', name: 'Armería Legendaria', href: '#/account/legendary-armory', icon: 'assets/icons/Cuentas/157085.png', color: '#E545CA' },
    { id: 'achievements', name: 'Logros', href: '#/account/achievements', icon: 'assets/icons/155059.png', color: '#6EA3FF' },
    { id: 'wv', name: 'Cámara del Brujo', href: '#/account/wizards-vault', icon: 'assets/icons/3172791.png', color: '#15C3B7' },
    { id: 'activities', name: 'Actividades', href: '#/activities', icon: 'assets/icons/1302773.png', color: '#3CC48A' },
    { id: 'raids', name: 'Raids y Strikes', href: '#/account/raids', icon: 'assets/icons/raids/raid-icon.png', color: '#F47C7C' },
    { id: 'characters', name: 'Inventario y Personajes', href: '#/account/characters', icon: 'assets/icons/Welcome/358409.png', color: '#7EC3FF' },
    { id: 'accounts', name: 'Cuentas', href: '#/account/accounts', icon: 'assets/icons/3601748.png', color: '#8E96A3' }
  ];
  var HOME = { id: 'home', name: 'Inicio', href: '#/welcome', icon: 'assets/icons/Welcome/3380755.png', color: 'var(--acc-1)' };
  // Ids y data-view que ya usaban el router y otros módulos.
  var LINK_ID = { home: 'navHome', cards: 'navCards', meta: 'navMeta', armory: 'navLegendaryArmory', achievements: 'navAch',
    wv: 'navWV', activities: 'navAC', raids: 'navRaids', characters: 'navChars', accounts: 'navAccounts' };
  var VIEW = { home: 'welcome', cards: 'cards', meta: 'meta', armory: 'legendaryArmory', achievements: 'achievements',
    wv: 'wv', activities: 'activities', raids: 'raids', characters: 'inventory', accounts: 'accounts' };
  // Pantallas que viven dentro de un módulo de la lista.
  var ALIAS = { '#/wallet/dashboard': '#/cards', '#/account/strikes': '#/account/raids', '#/inventory/dashboard': '#/account/characters' };
  var DEFAULT_HASH = '#/cards'; // lo que muestra el router cuando no hay hash

  var CSS = [
    '@media (min-width:901px){' +
      '.container.layout{grid-template-columns:252px minmax(0,1fr)}' +
      '.container.layout>#appSidebar{grid-column:1;grid-row:1;position:sticky;top:12px;align-self:start;max-height:calc(100vh - 24px);overflow-y:auto}' +
      '.container.layout>:not(#appSidebar){grid-column:2}}',
    '#sideNavPanel.sbr-host{background:transparent;border:0;box-shadow:none;padding:0;margin:0}',
    '#appSidebar .sbr{display:flex;flex-direction:column;gap:2px;padding:4px 0}',
    '#appSidebar .sbr-cap{margin:12px 12px 4px;font-size:.68rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--tx-3);line-height:1.2}',
    '#appSidebar .sbr-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}',
    '#appSidebar .sbr-list li{margin:0;padding:0}',
    '#appSidebar .sbr-list a{position:relative;display:flex;align-items:center;gap:11px;min-height:40px;padding:7px 10px 7px 12px;' +
      'border:1px solid transparent;border-radius:9px;background:transparent;box-shadow:none;transform:none;color:var(--tx-2);' +
      'font-size:.92rem;font-weight:500;letter-spacing:0;text-decoration:none;transition:background-color .12s ease,border-color .12s ease}',
    '#appSidebar .sbr-list a span{color:inherit;font:inherit;letter-spacing:inherit}',
    '#appSidebar .sbr-list a:hover{background:var(--bg-1);border-color:var(--bd-1);transform:none}',
    '#appSidebar .sbr-list a.is-active{background:var(--bg-1);border-color:var(--bd-2,var(--bd-1));color:var(--tx-1);font-weight:600;box-shadow:none}',
    '#appSidebar .sbr-list a.is-active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--x,var(--acc-1))}',
    '#appSidebar .sbr-list a:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '#appSidebar .sbr-ic{width:24px;height:24px;border-radius:6px;object-fit:contain;flex-shrink:0;filter:none}',
    '#appSidebar .sbr-sep{height:1px;background:var(--bd-1);margin:8px 6px}',
    '@media (prefers-reduced-motion:reduce){#appSidebar .sbr-list a{transition:none}}',
    // SBR-2: paneles viejos fuera; cuenta activa; avisos en los enlaces.
    '#asideNextFeatures,#metaAsideNext{display:none!important}',
    '#sideAccountPanel.sbr-host{background:transparent;border:0;box-shadow:none;padding:0;margin:0 0 4px}',
    '#appSidebar .sbr-acct{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:2px 10px;align-items:center;' +
      'padding:10px 12px;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    '#appSidebar .sbr-acct img{grid-row:span 2;width:36px;height:36px;border-radius:9px;background:var(--bg-2,var(--bg-0));padding:4px;object-fit:contain}',
    '#appSidebar .sbr-acct small{font-size:.68rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-3);line-height:1.2}',
    '#appSidebar .sbr-acct b{grid-column:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-1);font-size:.92rem}',
    '#appSidebar .sbr-chg{grid-column:3;grid-row:1 / span 2;display:inline-flex;align-items:center;min-height:30px;padding:2px 10px;' +
      'border:1px solid var(--bd-1);border-radius:999px;background:transparent;color:var(--tx-2);font:inherit;font-size:.75rem;cursor:pointer;text-decoration:none}',
    '#appSidebar .sbr-chg:hover{border-color:var(--acc-1);color:var(--tx-1)}',
    '#appSidebar .sbr-chg:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '#appSidebar .sbr-st{grid-column:1 / -1;display:flex;align-items:center;gap:7px;margin-top:8px;font-size:.78rem;color:var(--tx-3)}',
    '#appSidebar .sbr-st span{color:inherit}',
    '#appSidebar .sbr-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--color-green)}',
    '#appSidebar .sbr-dot.is-warn{background:var(--gn-gold,var(--color-amber))}',
    '#appSidebar .sbr-dot.is-info{background:var(--tx-3)}',
    '#appSidebar .sbr-w{margin-left:auto;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--gn-gold,var(--color-amber))}',
    '#appSidebar .sbr-new{margin-left:auto;flex-shrink:0;font-size:.6rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;' +
      'color:var(--gn-gold,var(--color-amber));border:1px solid var(--gn-gold,var(--color-amber));border-radius:999px;padding:0 6px;line-height:1.5}',
    '#appSidebar .sbr-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}'
  ].join('\n');

  var state = { built: false, watching: false, applied: [], lastToken: null, acctCtrl: null, accName: '', news: null, newsLoading: false };
  var NEWS_URL = 'assets/welcome-news.json';
  var ACCOUNT_ICON = 'assets/icons/3601748.png';

  function doc() { return root.document; }
  function $(s, r) { return (r || doc()).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc()).querySelectorAll(s)); }

  // ---------------------------------------------------------------- modelo (puro)
  function modules() {
    var W = root.Welcome;
    var list = W && W._pure && Array.isArray(W._pure.MODULES) && W._pure.MODULES.length ? W._pure.MODULES : MODULES_FALLBACK;
    return list.map(function (m) { return { id: m.id, name: m.name, href: m.href, icon: m.icon, color: m.color }; });
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

  // ---------------------------------------------------------------- DOM
  function ensureCSS() {
    var d = doc();
    if (d.getElementById('sbr-css')) return;
    var st = d.createElement('style');
    st.setAttribute('id', 'sbr-css');
    st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  function linkEl(d, m) {
    var a = d.createElement('a');
    a.setAttribute('href', m.href);
    a.setAttribute('id', LINK_ID[m.id] || ('nav-' + m.id));
    a.setAttribute('data-view', VIEW[m.id] || m.id);
    a.setAttribute('data-mod', m.id);
    a.setAttribute('style', '--x:' + m.color);
    var img = d.createElement('img');
    img.className = 'sbr-ic';
    img.setAttribute('src', m.icon);
    img.setAttribute('alt', '');
    img.setAttribute('width', '24');
    img.setAttribute('height', '24');
    var t = d.createElement('span');
    t.textContent = m.name;
    a.appendChild(img);
    a.appendChild(t);
    var li = d.createElement('li');
    li.appendChild(a);
    return li;
  }

  function listEl(d, items, labelId) {
    var ul = d.createElement('ul');
    ul.className = 'sbr-list side-nav';
    if (labelId) ul.setAttribute('aria-labelledby', labelId);
    items.forEach(function (m) { ul.appendChild(linkEl(d, m)); });
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
    nav.appendChild(listEl(d, g.home));
    var cap = d.createElement('p');
    cap.className = 'sbr-cap';
    cap.setAttribute('id', 'sbrModsCap');
    cap.textContent = 'Módulos';
    nav.appendChild(cap);
    nav.appendChild(listEl(d, g.modules, 'sbrModsCap'));
    if (g.tail.length) {
      var sep = d.createElement('div');
      sep.className = 'sbr-sep';
      sep.setAttribute('role', 'presentation');
      nav.appendChild(sep);
      nav.appendChild(listEl(d, g.tail));
    }
    while (host.firstChild) host.removeChild(host.firstChild);
    host.removeAttribute('aria-labelledby');
    host.className = 'sbr-host';
    host.appendChild(nav);
    state.built = true;
    syncActive();
    renderAccount();
    decorate();
    applyContrast();
    return nav;
  }

  // «Cuenta activa»: reemplaza a «Gato identificado».
  function renderAccount() {
    var d = doc();
    var host = d.getElementById('sideAccountPanel');
    if (!host) return null;
    var m = accountModel();
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
    name.setAttribute('id', 'accountIdLabel');
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
    while (host.firstChild) host.removeChild(host.firstChild);
    host.removeAttribute('aria-labelledby');
    host.setAttribute('aria-label', 'Cuenta activa');
    host.className = 'sbr-host';
    host.appendChild(box);
    return box;
  }

  // «Cambiar» lleva al selector de cuenta de arriba (el mismo de siempre).
  function focusSelector() {
    var sel = $('#keySelectGlobal');
    if (!sel) return;
    if (typeof sel.focus === 'function') sel.focus();
    if (typeof sel.showPicker === 'function') { try { sel.showPicker(); } catch (_) {} }
  }

  // «Falta permiso» y «Nuevo» en los enlaces de módulo.
  function decorate() {
    var d = doc();
    var m = accountModel();
    var missing = {};
    ((m && m.state === 'back' && m.activeMods) || []).forEach(function (id) { missing[id] = true; });
    var fresh = newModules(state.news);
    links().forEach(function (a) {
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
        n.textContent = 'Nuevo';
        a.appendChild(n);
      }
    });
  }

  function loadNews() {
    if (state.news !== null || state.newsLoading || typeof root.fetch !== 'function') return null;
    var W = root.Welcome;
    var pick = W && W._pure && typeof W._pure.pickNews === 'function' ? W._pure.pickNews : null;
    if (!pick) { state.news = []; return null; }
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
    updateAccountId();
  }

  function links() { return $$('#sbrNav a'); }

  function syncActive(hash) {
    var all = links();
    if (!all.length) return null;
    var h = hash != null ? hash : (root.location ? root.location.hash : '');
    var href = activeFor(h, all.map(function (a) { return a.getAttribute('href'); }));
    var on = null;
    all.forEach(function (a) {
      var is = a.getAttribute('href') === href;
      if (is) { on = a; a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
      else { a.classList.remove('is-active'); a.removeAttribute('aria-current'); }
    });
    return on;
  }

  // ---------------------------------------------------------------- contraste
  var TOKENS = ['--bg-0', '--bg-1', '--tx-1', '--tx-3', '--muted', '--color-green', '--gn-gold', '--color-amber', '--acc-1', '--color-green-bg', '--color-amber-bg'];
  function applyContrast() {
    var side = doc().getElementById('appSidebar');
    var W = root.Welcome;
    if (!side || !side.style || !W || !W._pure || typeof W._pure.contrastFixes !== 'function') return {};
    var t = {};
    if (typeof root.getComputedStyle === 'function' && doc().documentElement) {
      var cs = root.getComputedStyle(doc().documentElement);
      TOKENS.forEach(function (k) { t[k] = cs && cs.getPropertyValue ? cs.getPropertyValue(k) : ''; });
    }
    var fixes = W._pure.contrastFixes(t) || {};
    state.applied.forEach(function (k) { if (!(k in fixes)) side.style.removeProperty(k); });
    Object.keys(fixes).forEach(function (k) { side.style.setProperty(k, fixes[k]); });
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
  function updateAccountId() {
    var out = $('#accountIdLabel');
    var sel = $('#keySelectGlobal');
    if (!out || !sel) return null;
    var token = String(sel.value || '').trim();
    if (!token) { state.lastToken = null; state.accName = ''; return null; }
    if (token === state.lastToken && state.accName) { out.textContent = state.accName; return null; }
    if (typeof root.fetch !== 'function') return null;
    if (state.acctCtrl) { try { state.acctCtrl.abort(); } catch (_) {} }
    state.acctCtrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var url = 'https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(token);
    return root.fetch(url, { headers: { Accept: 'application/json' }, signal: state.acctCtrl ? state.acctCtrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        state.accName = (j && j.name) || '';
        state.lastToken = token;
        var now = $('#accountIdLabel');
        if (now && state.accName) now.textContent = state.accName;
      })
      .catch(function () { state.accName = ''; });
  }

  // ---------------------------------------------------------------- arranque
  function init() {
    build();
    watchTheme();
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
    _pure: { groups: groups, activeFor: activeFor, normHash: normHash, keyLine: keyLine, newModules: newModules,
      MODULES_FALLBACK: MODULES_FALLBACK, HOME: HOME,
      LINK_ID: LINK_ID, VIEW: VIEW, ALIAS: ALIAS, CSS: CSS }
  };

  // Welcome (welcome-panel.js) se carga después: armo en DOMContentLoaded, cuando ya están todos.
  if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', init);
  else init();

})(typeof window !== 'undefined' ? window : this);
