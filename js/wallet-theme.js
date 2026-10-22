/*!
 * js/wallet-theme.js — La Cartera renovada (BL-056, propuesta aprobada por Pablo el 2026-10-22)
 * v2.0.0 (2026-10-22)
 *
 * Capa de vista sobre lo que dibuja app.js. app.js sigue siendo el dueño de los datos,
 * los filtros de búsqueda y orden, la vista tarjetas/tabla y los botones de fijar: acá
 * no se pide nada a la API ni se escribe nada del jugador salvo una preferencia propia
 * («Ocultar las que están en 0»). Cada vez que app.js dibuja, esta capa toma sus
 * tarjetas y filas (los mismos nodos, con sus mismos listeners) y las reordena:
 *  - cabecera con la cuenta y pestañas: Mi cartera · Todas las cuentas · Cambio de divisas
 *    (las pestañas también van arriba de «Todas las cuentas», en #walletDashboardPanel);
 *  - Destacadas: las fijadas con ★ o, si no hay, las principales, en grande;
 *  - buscador grande, chips de categoría en español con su cantidad, orden, interruptor
 *    de las que están en 0 y selector Tarjetas/Tabla;
 *  - tarjetas compactas agrupadas por categoría (la descripción, al tocar o con el mouse);
 *  - tabla agrupada, con la cabecera arreglada (en index.html le falta la apertura de la fila).
 * No toca index.html ni app.js (LES-028). Los nombres públicos de la 1.x siguen existiendo.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var LS_HIDEZERO = 'gn:wallet:hidezero';
  var LS_CURR = 'gw2_currencies_cache_v1';
  var ICON = 'assets/icons/';

  // ---------------------------------------------------------------- datos puros
  var CAT_ORDER = ['general', 'mapa', 'competitiva', 'blacklion', 'histórica', 'otro'];
  var CAT_LABEL = {
    general: 'Generales', mapa: 'De mapa', competitiva: 'Competitivas',
    blacklion: 'León Negro', 'histórica': 'Históricas', historica: 'Históricas', otro: 'Otras'
  };
  var COLOR_MAP = {
    gems: '#4BBDF0', coins: '#F2B94B', karma: '#C27BEF', laurels: '#3CCB63',
    trade_contracts: '#28C3BB', elegy_mosaic: '#E2AE43'
  };
  var MAX_STARS = 6;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }
  function catLabel(k) { return CAT_LABEL[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Otras'); }

  // "1.284.371" -> 1284371 (es-AR usa punto de miles).
  function parseAmount(t) {
    var s = String(t == null ? '' : t).replace(/[^\d-]/g, '');
    return s && s !== '-' ? parseInt(s, 10) : 0;
  }
  // "1.284 g 37 s 12 c" (formato de la tabla de app.js) -> cobre.
  function parseCoinText(t) {
    var s = String(t || ''), g = s.match(/([\d.]+)\s*g/), sv = s.match(/(\d+)\s*s/), c = s.match(/(\d+)\s*c/);
    return (g ? parseAmount(g[1]) : 0) * 10000 + (sv ? +sv[1] : 0) * 100 + (c ? +c[1] : 0);
  }
  function coinParts(copper) {
    var c = Math.max(0, Math.floor(Number(copper) || 0));
    return { g: Math.floor(c / 10000), s: Math.floor((c % 10000) / 100), c: c % 100 };
  }
  function coinHTML(copper) {
    var p = coinParts(copper), out = '';
    if (p.g) out += '<span class="wn-g">' + fmt(p.g) + '</span><small>g</small> ';
    if (p.g || p.s) out += '<span class="wn-s">' + p.s + '</span><small>s</small> ';
    out += '<span class="wn-c">' + p.c + '</span><small>c</small>';
    return '<span class="wn-coin">' + out + '</span>';
  }
  function valueHTML(m) { return m.id === 1 ? coinHTML(m.amount) : '<span class="wn-num">' + fmt(m.amount) + '</span>'; }

  // Categoría con la que se agrupa: la primera según el orden de la Cartera.
  function primaryCat(m) {
    var cats = m.cats || [];
    for (var i = 0; i < CAT_ORDER.length; i++) if (cats.indexOf(CAT_ORDER[i]) >= 0) return CAT_ORDER[i];
    return cats[0] || 'otro';
  }
  function filterRows(models, st) {
    return models.filter(function (m) {
      if (st.hideZero && m.amount === 0) return false;
      return !st.cat || (m.cats || []).indexOf(st.cat) >= 0;
    });
  }
  // Grupos en el orden de la Cartera; con un chip elegido, un solo grupo con ese nombre.
  // starsFirst: en la tabla, las fijadas van en su propio grupo «★ Destacadas».
  function groupRows(rows, cat, starsFirst) {
    var out = [], by = {}, order = [];
    var rest = rows;
    if (starsFirst) {
      var pinned = rows.filter(function (m) { return m.pinned; });
      if (pinned.length) out.push({ key: 'stars', label: '★ Destacadas', rows: pinned });
      rest = rows.filter(function (m) { return !m.pinned; });
    }
    if (cat) {
      if (rest.length) out.push({ key: cat, label: catLabel(cat), rows: rest });
      return out;
    }
    rest.forEach(function (m) {
      var k = primaryCat(m);
      if (!by[k]) { by[k] = []; order.push(k); }
      by[k].push(m);
    });
    order.sort(function (a, b) {
      var ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    order.forEach(function (k) { out.push({ key: k, label: catLabel(k), rows: by[k] }); });
    return out;
  }
  // Cantidad por categoría (una divisa puede estar en dos) y total, respetando «ocultar en 0».
  function catCounts(models, hideZero) {
    var c = { _all: 0 };
    models.forEach(function (m) {
      if (hideZero && m.amount === 0) return;
      c._all++;
      (m.cats || []).forEach(function (k) { c[k] = (c[k] || 0) + 1; });
    });
    return c;
  }
  // Destacadas: las fijadas; si no hay ninguna, las principales.
  function pickStars(models) {
    var p = models.filter(function (m) { return m.pinned; });
    if (p.length) return { pinned: true, list: p.slice(0, MAX_STARS) };
    return { pinned: false, list: models.filter(function (m) { return m.isMain; }).slice(0, MAX_STARS) };
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).filter(function (w) { return w.length > 2; })
      .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || String(name || '?').charAt(0).toUpperCase();
  }

  // ---------------------------------------------------------------- DOM
  var doc = root.document;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function txt(n) { return n ? String(n.textContent || '').trim() : ''; }
  function el(tag, cls, html) { var n = doc.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  var S = { cat: '', hideZero: true, models: [], tmodels: [], lastAt: 0, busy: false, mo: null, catalog: null };
  try { S.hideZero = root.localStorage.getItem(LS_HIDEZERO) !== '0'; } catch (_) {}

  function catalog() {
    if (S.catalog) return S.catalog;
    var map = {};
    try {
      var raw = JSON.parse(root.localStorage.getItem(LS_CURR) || 'null');
      (raw && raw.items || []).forEach(function (c) { map[c.id] = c; });
    } catch (_) {}
    return (S.catalog = map);
  }
  function iconHTML(m, size) {
    if (m.icon) return '<img class="wn-ic" src="' + esc(m.icon) + '" width="' + size + '" height="' + size + '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    return '<span class="wn-ic wn-ph" aria-hidden="true">' + esc(initials(m.name)) + '</span>';
  }
  function setPin(btn, m) {
    if (!btn) return;
    btn.className = 'wn-pin' + (m.pinned ? ' is-on' : '');
    btn.textContent = m.pinned ? '★' : '☆';
    btn.setAttribute('aria-label', (m.pinned ? 'Quitar de Destacadas: ' : 'Destacar: ') + m.name);
    btn.title = m.pinned ? 'Quitar de Destacadas' : 'Destacar';
  }

  // Tarjeta de app.js -> modelo (los nodos y el botón de fijar son los mismos).
  function readCard(card) {
    var wrap = $('.wallet-card__body', card), body = wrap && wrap.children[0];
    var desc = body && !body.classList.contains('coin-badges') && !body.classList.contains('wallet-pills') ? txt(body) : '';
    var img = $('.wallet-card__iconWrap img', card), pin = $('[data-wallet-pin]', card);
    return {
      id: parseInt(card.getAttribute('data-id'), 10) || 0,
      name: txt($('.wallet-card__name', card)),
      amount: parseAmount(txt($('.wallet-amount', card))),
      icon: img ? img.getAttribute('src') : '',
      cats: $$('.wallet-pill', card).map(txt).filter(Boolean),
      isMain: !!$('.wallet-sub', card),
      pinned: !!(pin && pin.getAttribute('aria-pressed') === 'true'),
      desc: desc, cur: card.getAttribute('data-cur') || '', el: card, pin: pin
    };
  }
  function decorateCard(m) {
    var card = m.el;
    if (m.pin && m.pin.parentNode) m.pin.parentNode.removeChild(m.pin);
    card.className = 'wallet-card wn-card';
    card.innerHTML = iconHTML(m, 40) +
      '<div class="wn-nm">' + esc(m.name) + '</div><div class="wn-v">' + valueHTML(m) + '</div>' +
      (m.desc ? '<div class="wn-desc">' + esc(m.desc) + '</div>' : '');
    if (COLOR_MAP[m.cur]) card.setAttribute('style', '--wn-c:' + COLOR_MAP[m.cur]); else card.removeAttribute('style');
    if (m.desc) { card.title = m.desc; card.setAttribute('tabindex', '0'); card.setAttribute('aria-expanded', 'false'); }
    if (m.pin) { setPin(m.pin, m); card.appendChild(m.pin); }
  }

  // Fila de app.js: [ícono, nombre, cantidad, categorías, fijar] -> modelo.
  function readRow(tr) {
    var td = tr.children, id = parseInt(tr.getAttribute('data-id'), 10) || 0, pin = $('[data-wallet-pin]', tr);
    var img = td[0] ? $('img', td[0]) : null, c = catalog()[id] || {};
    return {
      id: id, name: txt(td[1] && ($('strong', td[1]) || td[1])) || c.name || '',
      amount: id === 1 ? parseCoinText(txt(td[2])) : parseAmount(txt(td[2])),
      icon: img ? img.getAttribute('src') : (c.icon || ''),
      cats: td[3] ? $$('.badge', td[3]).map(txt).filter(function (t) { return t && t !== '—'; }) : [],
      isMain: false, pinned: !!(pin && pin.getAttribute('aria-pressed') === 'true'),
      desc: c.description || '', el: tr, pin: pin
    };
  }
  function decorateRow(m) {
    var tr = m.el;
    if (m.pin && m.pin.parentNode) m.pin.parentNode.removeChild(m.pin);
    tr.className = 'wn-row';
    tr.innerHTML = '<td class="wn-tpin"></td>' +
      '<td><div class="wn-dn">' + iconHTML(m, 28) + '<div><b>' + esc(m.name) + '</b>' +
      (m.desc ? '<div class="wn-tdesc">' + esc(m.desc) + '</div>' : '') + '</div></div></td>' +
      '<td>' + (m.cats.length ? m.cats.map(function (k) { return '<span class="wn-chip">' + esc(catLabel(k)) + '</span>'; }).join(' ') : '') + '</td>' +
      '<td class="right">' + valueHTML(m) + '</td>';
    if (m.pin) { setPin(m.pin, m); tr.children[0].appendChild(m.pin); }
  }

  function isTable() { var w = $('#walletTableWrap'); return !!(w && !w.hidden); }
  function keyCount() {
    try {
      var St = root.Storage, list = St && St.STORAGE_KEYS ? St.get(St.STORAGE_KEYS.ACCOUNT_KEYS) : JSON.parse(root.localStorage.getItem('gn:account:keys') || '[]');
      return Array.isArray(list) ? list.length : 0;
    } catch (_) { return 0; }
  }
  function tabsHTML(active) {
    var n = keyCount();
    function tab(go, icon, label, extra) {
      var on = go === active;
      return '<button type="button" class="wn-tab' + (on ? ' is-on' : '') + '" data-wn-go="' + go + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<img src="' + ICON + icon + '" width="18" height="18" alt="">' + label + (extra || '') + '</button>';
    }
    return '<nav class="wn-tabs" aria-label="Secciones de la Cartera">' +
      tab('cards', '733322.png', 'Mi cartera') +
      tab('dashboard', '578844.png', 'Todas las cuentas', n ? ' <span class="wn-n">' + n + '</span>' : '') +
      tab('cambio', '502065.png', 'Cambio de divisas') + '</nav>';
  }
  function heroHTML(sub, withAccount) {
    return '<div class="wn-hero"><div class="wn-hico"><img src="' + ICON + '733322.png" width="30" height="30" alt=""></div>' +
      '<div class="wn-htx"><div class="wn-h2slot"></div><div class="wn-sub">' + sub + '</div></div>' +
      (withAccount ? '<div class="wn-hr"><button type="button" class="wn-acc" title="Cambiar de cuenta"><span class="wn-dot" aria-hidden="true"></span><span class="wn-accname">—</span></button>' +
        '<button type="button" class="wn-ibtn" data-wn-refresh="1" title="Actualizar" aria-label="Actualizar la cartera">↻</button></div>' : '') + '</div>';
  }

  function ensureShell() {
    var panel = $('#walletPanel');
    if (!panel || panel.classList.contains('wn-ready')) return panel;
    var body = $('.panel__body', panel), h2 = $('#walletTitle', panel);
    if (!body || !h2) return null;
    panel.classList.add('wn-ready');
    var head = el('div', 'wn-head', heroHTML('<span class="wn-count"></span><span class="wn-at"></span>', true) + tabsHTML('cards'));
    panel.insertBefore(head, panel.firstChild);
    h2.innerHTML = 'Cartera';
    $('.wn-h2slot', head).appendChild(h2);
    var status = $('#status', panel);
    if (status) { status.classList.add('wn-status'); $('.wn-sub', head).appendChild(status); }

    var stars = el('section', 'wn-stars', '<div class="wn-sec"><h3>Destacadas</h3><span class="wn-hint"></span></div><div class="wn-strip"></div>');
    stars.setAttribute('aria-label', 'Destacadas');
    var tools = el('div', 'wn-toolbar',
      '<div class="wn-row1"><label class="wn-search"><span aria-hidden="true">🔍</span></label><div class="wn-cats" role="group" aria-label="Categorías"></div></div>' +
      '<div class="wn-row2"><span class="wn-sortslot"></span>' +
      '<button type="button" class="wn-switch" role="switch" aria-checked="true"><i aria-hidden="true"></i>Ocultar las que están en 0</button>' +
      '<div class="wn-seg" role="group" aria-label="Vista"><button type="button" data-wn-view="cards">▦ Tarjetas</button><button type="button" data-wn-view="table">☰ Tabla</button></div></div>');
    var anchor = $('#favBlock', body) || $('#walletCards', body);
    body.insertBefore(stars, anchor);
    body.insertBefore(tools, anchor);
    var search = $('#searchBox', panel), sort = $('#sortSelect', panel);
    if (search) { search.placeholder = 'Buscar divisa…'; search.setAttribute('aria-label', 'Buscar divisa'); $('.wn-search', tools).appendChild(search); }
    if (sort) { sort.classList.add('wn-sel'); $('.wn-sortslot', tools).appendChild(sort); }
    $$('.panel-head, .chips, hr.hr-hairline', body).forEach(function (n) { n.classList.add('wn-hide'); });
    var wc = $('#walletCards', panel); if (wc) wc.classList.add('wn-on');
    return panel;
  }

  // «Todas las cuentas» es otro panel (wallet-dashboard.js): mismas pestañas arriba.
  function ensureDashTabs() {
    var panel = $('#walletDashboardPanel');
    if (!panel || !$('.wd-content', panel) || $('.wn-head', panel)) return;
    panel.classList.add('wn-dash');
    var head = el('div', 'wn-head', heroHTML('Todas tus cuentas, lado a lado', false) + tabsHTML('dashboard'));
    $('.wn-h2slot', head).innerHTML = '<h2 class="panel__title">Cartera</h2>';
    panel.insertBefore(head, panel.firstChild);
  }

  function renderChips(models) {
    var host = $('#walletPanel .wn-cats'); if (!host) return;
    var c = catCounts(models, S.hideZero), keys = CAT_ORDER.filter(function (k) { return c[k] || S.cat === k; });
    Object.keys(c).forEach(function (k) { if (k !== '_all' && keys.indexOf(k) < 0 && CAT_ORDER.indexOf(k) < 0 && k !== 'historica') keys.push(k); });
    function chip(k, label, n) {
      var on = S.cat === k;
      return '<button type="button" class="wn-cat' + (on ? ' is-on' : '') + '" data-wn-cat="' + esc(k) + '" aria-pressed="' + on + '">' + esc(label) + '<span class="wn-k">' + (n || 0) + '</span></button>';
    }
    host.innerHTML = chip('', 'Todas', c._all) + keys.map(function (k) { return chip(k, catLabel(k), c[k]); }).join('');
  }
  function renderStars() {
    var sec = $('#walletPanel .wn-stars'); if (!sec) return;
    var table = isTable(), pick = pickStars(S.models);
    sec.hidden = table || !pick.list.length;
    $('.wn-hint', sec).textContent = pick.pinned ? 'Las que fijaste con ★.' : 'Las principales. Fijá las tuyas con ★ y suben acá.';
    $('.wn-strip', sec).innerHTML = pick.list.map(function (m) {
      return '<div class="wn-star"' + (COLOR_MAP[m.cur] ? ' style="--wn-c:' + COLOR_MAP[m.cur] + '"' : '') + '>' + iconHTML(m, 40) +
        '<div><div class="wn-snm">' + esc(m.name) + '</div><div class="wn-sv">' + valueHTML(m) + '</div></div></div>';
    }).join('') + '<button type="button" class="wn-star wn-add" data-wn-addstar="1">＋ Fijar otra</button>';
  }
  function renderChrome() {
    var panel = $('#walletPanel'); if (!panel) return;
    var table = isTable(), models = table ? S.tmodels : S.models;
    var acc = $('.wn-accname', panel), owner = $('#ownerLabel');
    if (acc) acc.textContent = txt(owner) || '—';
    var cnt = $('.wn-count', panel), at = $('.wn-at', panel);
    if (cnt) cnt.textContent = models.length ? models.length + (models.length === 1 ? ' divisa' : ' divisas') : '';
    if (at) at.textContent = S.lastAt ? ' · actualizado ' + new Date(S.lastAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' · ' : '';
    var sw = $('.wn-switch', panel); if (sw) { sw.setAttribute('aria-checked', String(S.hideZero)); sw.classList.toggle('is-on', S.hideZero); }
    $$('[data-wn-view]', panel).forEach(function (b) {
      var on = (b.getAttribute('data-wn-view') === 'table') === table;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
    renderChips(models);
    renderStars();
  }

  function emptyHTML(total) {
    var why = S.cat ? 'No hay divisas de «' + esc(catLabel(S.cat)) + '» para mostrar.' : 'Todas tus divisas están en 0.';
    return '<div class="wn-empty"><p>' + why + ' Hay ' + total + ' en esta cuenta.</p><button type="button" class="wn-cat" data-wn-reset="1">Ver todas</button></div>';
  }
  function groupHeader(g) {
    return '<div class="wn-gh"><h4>' + esc(g.label) + '</h4><span class="wn-cnt">' + g.rows.length + '</span><span class="wn-line"></span></div>';
  }
  function layoutCards() {
    var wc = $('#walletCards'); if (!wc || !S.models.length) return;
    var rows = filterRows(S.models, S), groups = groupRows(rows, S.cat, false);
    wc.innerHTML = '';
    if (!rows.length) { wc.innerHTML = emptyHTML(S.models.length); return; }
    groups.forEach(function (g) {
      var sec = el('section', 'wn-group', groupHeader(g)), grid = el('div', 'wn-grid');
      g.rows.forEach(function (m) { grid.appendChild(m.el); });
      sec.appendChild(grid); wc.appendChild(sec);
    });
  }
  function fixHead() {
    var thead = $('#walletTable thead');
    if (thead && !$('.wn-thr', thead)) {
      thead.innerHTML = '<tr class="wn-thr"><th class="wn-tpin"><span class="wn-sr">Destacar</span></th><th>Divisa</th><th>Categoría</th><th class="right">Cantidad</th></tr>';
    }
  }
  function layoutTable() {
    var tb = $('#walletTable tbody'); if (!tb || !S.tmodels.length) return;
    var rows = filterRows(S.tmodels, S), groups = groupRows(rows, S.cat, true);
    tb.innerHTML = '';
    if (!rows.length) { tb.innerHTML = '<tr class="wn-grow"><td colspan="4">' + emptyHTML(S.tmodels.length) + '</td></tr>'; return; }
    groups.forEach(function (g) {
      var h = el('tr', 'wn-grow', '<td colspan="4">' + esc(g.label) + ' · ' + g.rows.length + '</td>');
      tb.appendChild(h);
      g.rows.forEach(function (m) { tb.appendChild(m.el); });
    });
  }
  function relayout() { if (isTable()) layoutTable(); else layoutCards(); renderChrome(); }

  // Corre después de cada dibujo de app.js (y nunca dentro de uno propio).
  function process() {
    if (!ensureShell()) return;
    fixHead();
    var fresh = $$('#favCards .wallet-card, #walletCards .wallet-card').filter(function (c) { return !c.classList.contains('wn-card'); });
    if (fresh.length) {
      S.models = fresh.map(readCard); S.models.forEach(decorateCard); S.lastAt = Date.now(); layoutCards();
    } else if (!$('#walletCards .wn-card') && !$('#walletCards .wn-empty')) {
      S.models = [];
    }
    var rows = $$('#walletTable tbody tr').filter(function (tr) { return !tr.classList.contains('wn-row') && !tr.classList.contains('wn-grow') && tr.getAttribute('data-id'); });
    if (rows.length) { S.tmodels = rows.map(readRow); S.tmodels.forEach(decorateRow); S.lastAt = Date.now(); layoutTable(); }
    renderChrome();
  }
  function guarded(fn) {
    if (S.busy) return;
    S.busy = true;
    try { fn(); } catch (e) { if (root.console) root.console.warn('[WalletTheme]', e); }
    finally { if (S.mo) S.mo.takeRecords(); S.busy = false; }
  }

  function onClick(e) {
    var t = e.target, b;
    if (!t || !t.closest) return;
    if ((b = t.closest('[data-wn-go]'))) {
      var go = b.getAttribute('data-wn-go');
      if (go === 'cards') root.location.hash = '#/cards';
      else if (go === 'dashboard') root.location.hash = '#/wallet/dashboard';
      else if (root.ConverterModal && typeof root.ConverterModal.open === 'function') root.ConverterModal.open();
      return;
    }
    if ((b = t.closest('[data-wn-cat]'))) { S.cat = b.getAttribute('data-wn-cat'); guarded(relayout); return; }
    if (t.closest('[data-wn-reset]')) { S.cat = ''; S.hideZero = false; saveHideZero(); guarded(relayout); return; }
    if (t.closest('.wn-switch')) { S.hideZero = !S.hideZero; saveHideZero(); guarded(relayout); return; }
    if ((b = t.closest('[data-wn-view]'))) {
      var want = b.getAttribute('data-wn-view') === 'table', tg = $('#toggleViewBtn');
      if (want !== isTable() && tg) tg.click();
      return;
    }
    if (t.closest('[data-wn-addstar]')) { var s = $('#searchBox'); if (s) s.focus(); return; }
    if (t.closest('[data-wn-refresh]')) { var k = $('#keySelectGlobal'); if (k && k.value) k.dispatchEvent(new root.Event('change', { bubbles: true })); return; }
    if (t.closest('.wn-acc')) {
      var sel = $('#keySelectGlobal');
      if (sel) { sel.focus(); if (typeof sel.showPicker === 'function') { try { sel.showPicker(); } catch (_) {} } }
      return;
    }
    var card = t.closest('.wn-card');
    if (card && !t.closest('[data-wallet-pin]') && card.getAttribute('aria-expanded') !== null) {
      var open = !card.classList.contains('wn-open');
      card.classList.toggle('wn-open', open); card.setAttribute('aria-expanded', String(open));
    }
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('wn-card')) { e.preventDefault(); onClick(e); }
  }
  function saveHideZero() { try { root.localStorage.setItem(LS_HIDEZERO, S.hideZero ? '1' : '0'); } catch (_) {} }

  // ---------------------------------------------------------------- estilos
  var CSS = [
    '#walletPanel.wn-ready{padding:0}',
    '#walletPanel.wn-ready #walletTableWrap{overflow:auto;max-height:70vh}',
    '.wn-hide,#walletPanel.wn-ready #favBlock,#walletDashboardPanel.wn-dash .wd-content>.panel__head,#walletDashboardPanel.wn-dash #wdBackBtn{display:none}',
    '.wn-head{border-bottom:1px solid var(--bd-1);border-radius:var(--radius-lg,12px) var(--radius-lg,12px) 0 0;overflow:hidden}',
    '.wn-hero{display:flex;align-items:center;gap:14px;padding:18px 20px;background:linear-gradient(180deg,var(--glow-base,rgba(168,150,255,.10)),transparent)}',
    '.wn-hico{width:48px;height:48px;border-radius:12px;background:var(--bg-0);display:grid;place-items:center;box-shadow:0 0 0 1px var(--bd-2),0 0 18px rgba(242,185,75,.18);flex-shrink:0}',
    '.wn-htx{min-width:0}.wn-hero h2,.wn-hero .panel__title{margin:0;font-size:1.3rem;padding:0;border:0;background:none}',
    '.wn-sub{color:var(--tx-3);font-size:.82rem;display:flex;flex-wrap:wrap;align-items:center}.wn-sub .wn-status{margin:0;font-size:.82rem}',
    '.wn-hr{margin-left:auto;display:flex;gap:8px;align-items:center}',
    '.wn-acc,.wn-ibtn{display:inline-flex;align-items:center;gap:8px;background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-1);border-radius:10px;padding:7px 11px;font:inherit;cursor:pointer}',
    '.wn-dot{width:8px;height:8px;border-radius:50%;background:var(--color-green)}',
    '.wn-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:0 20px}',
    '.wn-tab{background:none;border:0;border-bottom:2px solid transparent;color:var(--tx-3);padding:12px 14px;font:inherit;font-weight:600;cursor:pointer;display:flex;gap:8px;align-items:center}',
    '.wn-tab:hover{color:var(--tx-1)}.wn-tab.is-on{color:var(--tx-1);border-bottom-color:var(--acc-1)}',
    '.wn-n{font-size:.72rem;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:999px;padding:0 7px;color:var(--tx-2)}',
    '#walletPanel.wn-ready>.panel__body{padding:18px 20px 22px}',
    '.wn-sec{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin:0 0 10px}.wn-sec h3{margin:0;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-3)}.wn-hint{font-size:.78rem;color:var(--tx-3)}',
    '.wn-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:18px}',
    '.wn-star{position:relative;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;min-width:0}',
    '.wn-star::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px var(--wn-c,transparent),0 0 22px -12px var(--wn-c,transparent);opacity:.6}',
    '.wn-snm{font-size:.78rem;color:var(--tx-3)}.wn-sv{font-size:1.2rem;font-weight:700;line-height:1.2}',
    '.wn-add{border-style:dashed;color:var(--tx-3);justify-content:center;font:inherit;font-size:.85rem;cursor:pointer}',
    '.wn-toolbar{display:grid;gap:10px;margin-bottom:6px}.wn-row1,.wn-row2{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.wn-search{flex:1 1 220px;display:flex;align-items:center;gap:8px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:10px;padding:8px 12px}',
    '.wn-search:focus-within{border-color:var(--acc-1)}.wn-search input{background:none;border:0;color:var(--tx-1);font:inherit;width:100%;outline:none;padding:0}',
    '.wn-cats{display:flex;flex-wrap:wrap;gap:6px}',
    '.wn-cat{background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:999px;padding:5px 11px;font:inherit;font-size:.8rem;cursor:pointer}',
    '.wn-cat.is-on{background:var(--color-blue-bg);border-color:var(--acc-1);color:var(--tx-1)}.wn-k{color:var(--tx-3);margin-left:6px;font-size:.72rem}',
    '.wn-sel{border-radius:10px;padding:7px 10px;font:inherit;font-size:.82rem}',
    '.wn-switch{display:inline-flex;align-items:center;gap:8px;background:none;border:0;color:var(--tx-2);font:inherit;font-size:.82rem;cursor:pointer;padding:4px}',
    '.wn-switch i{width:34px;height:20px;border-radius:999px;background:var(--bd-2);position:relative;display:inline-block;transition:background .15s}',
    '.wn-switch i::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}',
    '.wn-switch.is-on i{background:var(--acc-1)}.wn-switch.is-on i::after{left:17px}',
    '.wn-seg{display:inline-flex;border:1px solid var(--bd-1);border-radius:10px;overflow:hidden;margin-left:auto}',
    '.wn-seg button{background:var(--bg-0);border:0;color:var(--tx-3);padding:7px 12px;font:inherit;font-size:.82rem;cursor:pointer}.wn-seg button.is-on{background:var(--bg-2);color:var(--tx-1);box-shadow:inset 0 -2px 0 var(--acc-1)}',
    '#walletCards.wn-on{grid-template-columns:1fr;gap:0;margin-top:0}',
    '.wn-group{margin-top:16px}.wn-gh{display:flex;align-items:center;gap:10px;margin-bottom:8px}.wn-gh h4{margin:0;font-size:.95rem;color:var(--tx-1)}.wn-cnt{font-size:.75rem;color:var(--tx-3)}.wn-line{flex:1;height:1px;background:var(--bd-1)}',
    '.wn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}',
    '#walletPanel .wn-card{position:relative;background:var(--bg-0);border:1px solid var(--bd-1);border-left:1px solid var(--bd-1);border-radius:12px;padding:11px 12px;display:grid;grid-template-columns:40px 1fr auto;grid-template-rows:auto;gap:2px 12px;align-items:center;transition:border-color .15s,transform .15s;cursor:default;min-height:0}',
    '#walletPanel .wn-card::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:3px;background:var(--wn-c,transparent)}',
    '#walletPanel .wn-card[tabindex]{cursor:pointer}#walletPanel .wn-card:hover{border-color:var(--bd-2);transform:translateY(-1px)}',
    '.wn-card>.wn-ic{grid-row:1/3}.wn-ic{width:40px;height:40px;border-radius:9px;object-fit:contain;flex-shrink:0}',
    '.wn-ph{display:grid;place-items:center;font-weight:800;font-size:.85rem;color:var(--tx-1);background:var(--bg-2);border:1px solid var(--bd-1)}',
    '.wn-nm{font-weight:600;font-size:.9rem;line-height:1.2;color:var(--tx-1);min-width:0;overflow-wrap:anywhere}',
    '.wn-v{grid-column:2;font-size:1.05rem;font-weight:700;color:var(--tx-1)}',
    '.wn-card>.wn-pin{grid-row:1/3;grid-column:3}',
    '.wn-desc{display:none;grid-column:1/-1;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd-1);font-size:.8rem;color:var(--tx-2)}.wn-card.wn-open .wn-desc{display:block}',
    '.wn-pin{background:none;border:0;color:var(--tx-3);font-size:1.05rem;line-height:1;cursor:pointer;padding:6px;border-radius:8px}.wn-pin:hover{background:var(--bg-2);color:var(--tx-1)}.wn-pin.is-on{color:var(--gn-gold)}',
    '.wn-num,.wn-coin{font-variant-numeric:tabular-nums;white-space:nowrap}.wn-coin small{color:var(--tx-3);font-weight:500;margin:0 3px 0 1px}',
    '.wn-g{color:var(--gn-gold)}.wn-s,.wn-c{color:var(--tx-1)}',
    '.wn-empty{text-align:center;padding:24px;color:var(--tx-3)}.wn-empty p{margin:0 0 10px}',
    '#walletTable .wn-thr th{text-align:left}#walletTable th.right,#walletTable td.right{text-align:right}',
    '#walletTable td.wn-tpin,#walletTable th.wn-tpin{width:40px}',
    '.wn-dn{display:flex;align-items:center;gap:10px}.wn-dn .wn-ic{width:28px;height:28px;border-radius:7px;font-size:.7rem}',
    '.wn-tdesc{color:var(--tx-3);font-size:.78rem;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.wn-chip{display:inline-block;font-size:.72rem;padding:2px 9px;border-radius:999px;border:1px solid var(--bd-2);color:var(--tx-2)}',
    '#walletTable tr.wn-grow td{background:var(--bg-1);color:var(--tx-2);font-weight:700;font-size:.8rem;padding-top:14px}',
    '.wn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.wn-tab:focus-visible,.wn-cat:focus-visible,.wn-switch:focus-visible,.wn-seg button:focus-visible,.wn-pin:focus-visible,.wn-acc:focus-visible,.wn-ibtn:focus-visible,.wn-add:focus-visible,#walletPanel .wn-card:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:720px){.wn-hero{flex-wrap:wrap}.wn-hr{margin-left:0}.wn-tabs{padding:0 12px}.wn-tab{padding:10px 8px;font-size:.85rem}#walletPanel.wn-ready>.panel__body{padding:14px 12px}.wn-seg{margin-left:0}}',
    '@media (prefers-reduced-motion:reduce){#walletPanel .wn-card,.wn-switch i,.wn-switch i::after{transition:none}}'
  ].join('\n');

  function injectCSS() {
    if (doc.getElementById('wn-style')) return;
    var s = doc.createElement('style'); s.id = 'wn-style'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function init() {
    injectCSS();
    guarded(process);
    ensureDashTabs();
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('gn:tokenchange', function () { S.cat = ''; });
    root.addEventListener('hashchange', function () { ensureDashTabs(); });
    if (typeof root.MutationObserver === 'function') {
      S.mo = new root.MutationObserver(function () { guarded(process); ensureDashTabs(); });
      var p = $('#walletPanel'), d = $('#walletDashboardPanel');
      if (p) S.mo.observe(p, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
      if (d) S.mo.observe(d, { childList: true });
    }
  }

  function noop() {}
  root.WalletTheme = {
    version: VERSION,
    process: function () { guarded(process); },
    themeWalletNow: function () { guarded(process); },
    applyCurrencyTheme: function (card) { var k = card && card.getAttribute('data-cur'); if (k && COLOR_MAP[k]) card.setAttribute('style', '--wn-c:' + COLOR_MAP[k]); },
    migrateCategoriesToBadges: noop,
    migrateWalletToCardClass: noop,
    _state: S,
    _pure: { catLabel: catLabel, parseAmount: parseAmount, parseCoinText: parseCoinText, coinParts: coinParts, coinHTML: coinHTML,
      primaryCat: primaryCat, filterRows: filterRows, groupRows: groupRows, catCounts: catCounts, pickStars: pickStars, initials: initials }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
