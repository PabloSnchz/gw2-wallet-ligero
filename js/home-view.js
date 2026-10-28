/*!
 * js/home-view.js — La Heredad: tu casa y tu heredad de Janthir, módulo propio (BL-070 ACT-5, BL-055)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.4.0 (2026-10-28) — BL-078 UNI-4b: íconos del juego en las pestañas y en los 4 indicadores · antes 1.3.0 (2026-10-27) — BL-078 UNI-3: el reset diario con el reloj común de la Bóveda (GNKit) · antes 1.2.0 (2026-10-27) — BL-076 SHV-5b: sin mi globo, mi línea también dice «Lo sé por» · antes 1.1.0 (2026-10-25) — ACT-6: pestañas Glifos y Decoraciones (las dibuja js/home-extra.js); las
 *          pestañas se recorren con las flechas, Inicio y Fin
 * Versión: 1.0.0 (2026-10-25) — ACT-5: módulo, ruta, barra lateral y la pestaña Nodos y gatos
 *
 * Los nodos de casa salen de Actividades y pasan a su módulo (D1, decidido por Pablo en BL-055):
 *  - Ruta #/account/homestead (la de js/router.js) y panel #homesteadPanel; si index.html todavía no lo
 *    trae, lo creo al lado del de Actividades.
 *  - Un solo contenedor con el degradado del color del módulo, como la Cartera y Metas.
 *  - Cabecera con 4 indicadores: nodos que tenés (de los 57 de la API), recolectados hoy, gatos (de 35) y
 *    los de Janthir y contratos que marcaste vos.
 *  - Nodos y gatos: los 57 nodos de /v2/home/nodes con el ícono y el nombre en español del ítem que los
 *    desbloquea (assets/data/homestead/nodes.json), por herramienta (minería, tala, cosecha, cofres,
 *    contratos y otros), con «Me faltan», «Sin recolectar hoy» y búsqueda sin tildes. Desbloqueado o no
 *    sale de /v2/account/home/nodes; «Recolectado hoy» es tu marca de siempre (gn:activities:home:nodes,
 *    por día UTC: no se pierde nada) y se limpia sola a las 00:00 UTC. Los 6 nodos de Janthir y los 4
 *    contratos de las expansiones no están en la API (wiki oficial): los marcás vos con «Lo tengo» (D5),
 *    por cuenta con una huella, nunca la Key (gn:homestead:owned). Los contratos llegan por correo: no
 *    llevan «recolectado». Los 35 gatos con su pista de la API, traducida.
 * Estados honestos: lo que no se pudo leer dice «sin datos» y se nombra el permiso, nunca «no lo tenés».
 * Glifos y Decoraciones: si js/home-extra.js está cargado, sus pestañas aparecen y yo le paso los clics,
 * la búsqueda y el selector. Se carga por js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.4.0';
  var LOG = '[HomeView]';
  var PANEL = 'homesteadPanel';
  var ROUTE = '#/account/homestead'; // la misma que usa js/router.js
  var ICON = 'assets/icons/Welcome/3380755.png';
  var DATA_URL = 'assets/data/homestead/nodes.json';
  var API = 'https://api.guildwars2.com';
  var DONE_KEY = 'gn:activities:home:nodes';
  var OWNED_KEY = 'gn:homestead:owned';
  var TTL = 5 * 60 * 1000, TIMEOUT = 20000, TICK = 60000;
  var ONLY = [['all', 'Todos'], ['missing', 'Me faltan'], ['pending', 'Sin recolectar hoy']];

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // BL-078 UNI-4b: los íconos del juego vienen de GNKit (js/gn-kit.js, elegidos por Pablo); sin GNKit, sin ícono.
  function kitIcon(k, size) { var K = root.GNKit; return k && K && typeof K.icon === 'function' ? K.icon(k, size || 18) : ''; }
  var HS_TAB = { nodes: 'tab.home.nodos', glyphs: 'tab.home.glifos', decor: 'tab.home.decoraciones' };
  var HS_STAT = { 'Nodos': 'tab.home.nodos', 'Recolectados hoy': 'stat.home.recolectados', 'Gatos': 'stat.home.gatos', 'Janthir y contratos': 'stat.home.janthir' };
  // El día de las marcas: la fecha UTC, como siempre (el reset diario es a las 00:00 UTC).
  function dayKey(now) { var d = new Date(now); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function untilReset(now) {
    var d = new Date(now), next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1), m = Math.max(0, Math.round((next - now) / 60000));
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }
  // Huella de la Key (FNV-1a de 32 bits): separa cuentas sin guardar la Key.
  function fingerprint(token) {
    var s = String(token || ''), h = 0x811c9dc5;
    if (!s) return '';
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // Lo que marcaste hoy, con los ids viejos traducidos (expedition_board_s3 es black_lion_expedition_board).
  function doneToday(store, now, aliases) {
    var day = store && typeof store === 'object' ? store[dayKey(now)] : null, out = {};
    Object.keys(day || {}).forEach(function (id) { if (day[id]) out[(aliases && aliases[id]) || id] = true; });
    return out;
  }
  // Marca o desmarca un nodo hoy. Solo queda el día de hoy: lo de otros días ya no cuenta.
  function setDone(store, now, id, on) {
    var k = dayKey(now), day = Object.assign({}, (store && store[k]) || {}), s = {};
    if (on) day[id] = true; else delete day[id];
    s[k] = day;
    return s;
  }
  function ownedFor(store, fp) { return (store && fp && store[fp]) || {}; }
  function setOwned(store, fp, id, on) {
    var s = Object.assign({}, store || {}), b = Object.assign({}, s[fp] || {});
    if (!fp) return s;
    if (on) b[id] = true; else delete b[id];
    s[fp] = b;
    return s;
  }

  // data: { loaded, hasToken, unlocked: [ids]|null, cats: [ids]|null, unread: [], done: {}, owned: {} }
  function buildModel(data, cat, ui, now) {
    data = data || {}; cat = cat || {}; ui = ui || {};
    var ok = !!(data.loaded && data.hasToken), unl = ok && Array.isArray(data.unlocked) ? data.unlocked : null;
    var has = {}; (unl || []).forEach(function (id) { has[id] = true; });
    var done = data.done || {}, owned = data.owned || {};
    var nodes = (cat.nodes || []).map(function (n) {
      var have = n.api ? (unl ? !!has[n.id] : null) : (data.hasToken ? !!owned[n.id] : null);
      var gather = n.group !== 'mail';
      return { id: n.id, name: n.name, group: n.group, item: n.item, itemName: n.itemName, icon: n.icon, api: !!n.api,
        have: have, gather: gather, done: !!(have && gather && done[n.id]) };
    });
    var api = nodes.filter(function (n) { return n.api; }), man = nodes.filter(function (n) { return !n.api; });
    var mine = nodes.filter(function (n) { return n.have && n.gather; });
    var catIds = ok && Array.isArray(data.cats) ? data.cats.map(function (c) { return typeof c === 'object' && c ? c.id : c; }) : null;
    var catHas = {}; (catIds || []).forEach(function (id) { catHas[id] = true; });
    var cats = (cat.cats || []).map(function (c) { return { id: c.id, hint: c.hint, es: c.es, have: catIds ? !!catHas[c.id] : null }; });
    var q = fold(ui.q || ''), group = ui.group || 'all', only = ui.only || 'all';
    var shown = nodes.filter(function (n) {
      if (group !== 'all' && n.group !== group) return false;
      if (only === 'missing' && n.have !== false) return false;
      if (only === 'pending' && !(n.have && n.gather && !n.done)) return false;
      return !q || fold(n.name + ' ' + n.itemName).indexOf(q) >= 0;
    });
    return {
      loaded: !!data.loaded, hasToken: !!data.hasToken, unread: data.unread || [], groups: cat.groups || [],
      nodes: nodes, shown: shown, cats: cats, ui: { group: group, only: only, q: ui.q || '' },
      stats: {
        api: unl ? api.filter(function (n) { return n.have; }).length : null, apiTotal: api.length,
        mine: mine.length, done: mine.filter(function (n) { return n.done; }).length,
        cats: catIds ? cats.filter(function (c) { return c.have; }).length : null, catsTotal: cats.length,
        manual: data.hasToken ? man.filter(function (n) { return n.have; }).length : null, manualTotal: man.length
      },
      reset: untilReset(now), now: Number(now)
    };
  }

  // Mi línea: lo que te queda hoy en tu casa, y los de Janthir si todavía no marcaste ninguno.
  function pickVoice(m) {
    var s = m.stats;
    if (!m.hasToken || !m.loaded) return null;
    if (s.mine && s.done < s.mine) {
      var left = s.mine - s.done;
      return { kind: 'recomienda', key: 'left:' + left, text: (left === 1 ? 'Te queda 1 nodo' : 'Te quedan ' + left + ' nodos') + ' por recolectar hoy en tu casa. Se reinician a las 00:00 UTC, en ' + m.reset + '.' };
    }
    if (s.mine && s.done === s.mine) return { kind: 'saluda', key: 'all', text: 'Recolectaste todo lo de tu casa hoy. Mañana, desde las 00:00 UTC, otra vez.' };
    if (s.manual === 0) return { kind: 'explica', key: 'manual', text: 'La API no informa los nodos de Janthir ni los contratos de las expansiones: si los tenés, marcalos con «Lo tengo» y los cuento.' };
    return null;
  }

  var UNREAD = { nodes: 'tus nodos de casa', cats: 'tus gatos' };
  function errorText(m) {
    if (!m.unread.length) return '';
    return 'No pude leer ' + m.unread.map(function (x) { return UNREAD[x] || x; }).join(' ni ') + '. Revisá que la API Key tenga los permisos de cuenta, progreso y desbloqueos.';
  }

  function stat(label, value, note, bar) {
    label = kitIcon(HS_STAT[label], 16) + label;
    return '<div class="hs-st"><small>' + label + '</small><b>' + value + '</b>' + (bar != null ? '<div class="hs-bar" aria-hidden="true"><i style="--p:' + bar + '%"></i></div>' : '') + (note ? '<em>' + note + '</em>' : '') + '</div>';
  }
  function frac(n, t) { return n + ' <span>/ ' + t + '</span>'; }
  function pct(n, t) { return t ? Math.round(n * 100 / t) : 0; }

  function statsHTML(m) {
    var s = m.stats, nd = m.loaded ? 'sin datos' : 'leyendo…', h = '';
    h += s.api != null ? stat('Nodos', frac(s.api, s.apiTotal), 'de la API', pct(s.api, s.apiTotal)) : stat('Nodos', '—', m.hasToken ? nd : 'con tu API Key');
    h += s.api != null || s.manual ? stat('Recolectados hoy', frac(s.done, s.mine), s.mine && s.done === s.mine ? 'todo hecho hoy' : 'se reinician en ' + esc(m.reset), pct(s.done, s.mine)) : stat('Recolectados hoy', '—', m.hasToken ? nd : 'con tu API Key');
    h += s.cats != null ? stat('Gatos', frac(s.cats, s.catsTotal), '', pct(s.cats, s.catsTotal)) : stat('Gatos', '—', m.hasToken ? nd : 'con tu API Key');
    h += s.manual != null ? stat('Janthir y contratos', frac(s.manual, s.manualTotal), 'los marcás vos') : stat('Janthir y contratos', '—', 'con tu API Key');
    return h;
  }

  function badge(n) {
    if (!n.api && n.have === null) return '<span class="hs-badge hs-badge--nd">Con tu API Key</span>';
    if (n.have === null) return '<span class="hs-badge hs-badge--nd">Sin datos</span>';
    if (!n.have) return '<span class="hs-badge hs-badge--nd">No lo tenés</span>';
    if (!n.gather) return '<span class="hs-badge hs-badge--ok">Llega por correo</span>';
    return n.done ? '<span class="hs-badge hs-badge--ok">Recolectado hoy</span>' : '<span class="hs-badge hs-badge--pend">Sin recolectar</span>';
  }

  function nodeHTML(n, hasToken) {
    var h = '<li class="hs-node' + (n.have === false ? ' hs-node--off' : '') + '"><img src="' + esc(n.icon) + '" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">' +
      '<span class="hs-nm"><b>' + esc(n.name) + '</b><small>' + (n.api ? 'con «' + esc(n.itemName) + '»' : 'la API no lo informa · con «' + esc(n.itemName) + '»') + '</small></span>' + badge(n) + '<span class="hs-acts">';
    if (!n.api && hasToken) h += '<button type="button" class="hs-btn" data-hs-own="' + esc(n.id) + '" aria-pressed="' + !!n.have + '">Lo tengo<span class="hs-sr"> ' + esc(n.name) + '</span></button>';
    if (n.have && n.gather) h += '<button type="button" class="hs-btn hs-chk" data-hs-done="' + esc(n.id) + '" aria-pressed="' + n.done + '"><span class="hs-box" aria-hidden="true"></span>Recolectado<span class="hs-sr"> ' + esc(n.name) + '</span></button>';
    return h + '</span></li>';
  }

  function nodesHTML(m) {
    var h = '<section class="hs-card" aria-labelledby="hsNodesT"><div class="hs-card-h"><h3 id="hsNodesT">Nodos de casa</h3><small>se recolectan una vez por día y por cuenta · en tu casa y en tu heredad</small></div>';
    h += '<div class="hs-filters"><div class="hs-pills" role="group" aria-label="Por herramienta">' +
      [['all', 'Todos']].concat(m.groups).map(function (g) { return '<button type="button" class="hs-pill" data-hs-group="' + g[0] + '" aria-pressed="' + (m.ui.group === g[0]) + '">' + esc(g[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="hs-pills" role="group" aria-label="Mostrar">' + ONLY.map(function (o) { return '<button type="button" class="hs-pill" data-hs-only="' + o[0] + '" aria-pressed="' + (m.ui.only === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<label class="hs-q"><span class="hs-sr">Buscar un nodo</span><input type="search" id="hsQ" placeholder="Buscar un nodo" value="' + esc(m.ui.q) + '" autocomplete="off"></label></div>';
    if (!m.shown.length) h += '<p class="hs-txt">' + (m.ui.only === 'pending' && m.stats.mine ? 'No te queda nada por recolectar hoy con estos filtros.' : 'No hay nodos con estos filtros.') + '</p>';
    else h += '<ul class="hs-nodes">' + m.shown.map(function (n) { return nodeHTML(n, m.hasToken); }).join('') + '</ul>';
    return h + '<p class="hs-note">«Recolectado» es tu marca: vale hasta las 00:00 UTC. Los contratos llegan por correo al reset.</p></section>';
  }

  function catsHTML(m) {
    var s = m.stats, h = '<section class="hs-card" aria-labelledby="hsCatsT"><div class="hs-card-h"><h3 id="hsCatsT">Gatos de tu casa</h3><small>' +
      (s.cats != null ? s.cats + ' de ' + s.catsTotal : m.hasToken ? 'sin datos' : 'con tu API Key') + ' · se suman al darle de comer a un gato hambriento en Tyria</small></div><ul class="hs-cats">';
    m.cats.forEach(function (c) {
      h += '<li class="hs-cat' + (c.have ? ' hs-cat--on' : '') + '"><b>Gato ' + c.id + '</b><small>pista: ' + esc(c.es) + '</small><span class="hs-sr">' + (c.have === null ? ', sin datos' : c.have ? ', lo tenés' : ', te falta') + '</span></li>';
    });
    return h + '</ul><p class="hs-note">La API solo trae una pista por gato, en inglés: la traduje yo.</p></section>';
  }

  /** Pestañas: Nodos y gatos siempre; las de HomeExtra si está cargado. ext = { tabs, tab, html }. */
  function tabsHTML(tabs, cur) {
    var h = '<div class="hs-tabs" role="tablist" aria-label="Secciones de la Heredad">';
    tabs.forEach(function (t) {
      var on = t[0] === cur;
      h += '<button type="button" role="tab" id="hsTab-' + t[0] + '" data-hs-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="hsPanel-' + t[0] + '" tabindex="' + (on ? 0 : -1) + '">' + kitIcon(HS_TAB[t[0]]) + esc(t[1]) + '</button>';
    });
    return h + '</div>';
  }

  // UNI-3: el reset diario con el reloj común (GNKit); sin GNKit, la píldora de antes.
  function clockHTML(m) {
    var K = root.GNKit;
    if (K && typeof K.clock === 'function' && isFinite(m.now)) return K.clock('daily', m.now);
    return '<span class="hs-pillr">Reset diario <b id="hsClk">en ' + esc(m.reset) + '</b></span>';
  }

  function viewHTML(m, ext) {
    var tabs = [['nodes', 'Nodos y gatos']].concat((ext && ext.tabs) || []), tab = ext && ext.tab;
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'nodes';
    var err = errorText(m), h = '<div class="hs-hero"><div class="hs-row"><img class="hs-ico" src="' + ICON + '" alt="" width="56" height="56">' +
      '<div class="hs-title"><h2 id="hsTitle">Heredad</h2><p>Tu casa y tu heredad de Janthir: nodos, gatos, glifos y decoraciones</p></div>' +
      '<div class="hs-top">' + clockHTML(m) + '<button type="button" class="hs-btn" data-hs="refresh">Actualizar</button></div></div>' +
      '<div class="hs-stats" id="hsStats">' + statsHTML(m) + '</div>' + (err ? '<p class="hs-err" role="status">' + esc(err) + '</p>' : '') +
      '<div id="hsVoice" class="hs-voice" aria-live="polite"></div></div>';
    h += tabsHTML(tabs, tab);
    h += '<div id="hsPanel-' + tab + '" role="tabpanel" aria-labelledby="hsTab-' + tab + '">' + (tab === 'nodes' ? nodesHTML(m) + catsHTML(m) : (ext.html || '')) + '</div>';
    return h + '<p class="hs-src">Nodos, gatos, ítems e íconos: API oficial del juego, en español. Lo que la API no informa: wiki oficial, «Home instance».</p>';
  }

  var P = '#' + PANEL, R = '#hsRoot', MOD = 'var(--gn-mod,#D9A55B)';
  var CSS = [
    P + '.hs-on{padding:0 0 22px;background:linear-gradient(180deg,color-mix(in srgb,' + MOD + ' 12%,transparent),transparent 300px),var(--gn-tray,var(--bg-1))}',
    P + '.hs-on>:not(#hsRoot),' + R + '>:not(.hs-hero){margin-left:24px;margin-right:24px}',
    R + '{--hs-mod:' + MOD + ';margin:0 0 12px}',
    '.hs-hero{border-bottom:1px solid var(--bd-1);padding:20px 24px 18px}',
    '.hs-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.hs-ico{width:56px;height:56px;border-radius:12px;background:var(--bg-2);padding:6px;box-shadow:0 0 0 2px color-mix(in srgb,var(--hs-mod) 70%,transparent);flex-shrink:0;box-sizing:border-box}',
    '.hs-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.hs-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.hs-top{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.hs-pillr{font-size:.78rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 10px;color:var(--tx-2);background:var(--bg-0);white-space:nowrap}.hs-pillr b{color:var(--tx-1)}',
    '.hs-btn,.hs-pill{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:6px}',
    '.hs-btn:hover,.hs-pill:hover{border-color:var(--acc-1)}',
    '.hs-pill[aria-pressed=true],.hs-btn[aria-pressed=true]{background:var(--bg-2);border-color:var(--hs-mod);font-weight:700}',
    '.hs-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.hs-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.hs-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.hs-st b{font-size:1.25rem;color:var(--tx-1)}.hs-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.hs-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px}',
    '.hs-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:6px}.hs-bar i{display:block;height:100%;width:var(--p);background:var(--hs-mod)}',
    '.hs-err{margin:10px 0 0;padding-left:8px;border-left:3px solid var(--color-red,#F47C7C);font-size:.82rem;color:var(--tx-1)}',
    '.hs-voice{margin-top:12px}.hs-voice:empty{display:none}.hs-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.hs-voice .shv-voice__avatar{width:36px;height:36px}.hs-voice .shv-voice__label{font-size:.78rem}.hs-voice .shv-voice__body p{font-size:.86rem}',
    '.hs-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1)}',
    '.hs-tabs{overflow-x:auto}.hs-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);min-height:40px;cursor:pointer;white-space:nowrap}',
    '.hs-tabs [role=tab]:hover{color:var(--tx-1)}.hs-tabs [aria-selected=true]{border-bottom-color:var(--hs-mod);color:var(--tx-1);font-weight:700}',
    '.hs-card{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:12px 16px;margin-bottom:12px}',
    '.hs-card-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}.hs-card-h h3{margin:0;font-size:1rem;color:var(--tx-1)}.hs-card-h small{font-size:.78rem;color:var(--tx-2)}',
    '.hs-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.hs-pills{display:flex;gap:6px;flex-wrap:wrap}',
    '.hs-q{margin-left:auto}.hs-q input{font:inherit;font-size:.85rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;background:var(--bg-0);color:var(--tx-1);min-height:32px;box-sizing:border-box;min-width:180px}',
    '.hs-nodes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px}',
    '.hs-node{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:8px 10px}',
    '.hs-node img{width:36px;height:36px;border-radius:8px;background:var(--bg-2);flex-shrink:0}.hs-node--off img{opacity:.55}',
    '.hs-nm{flex:1;min-width:150px}.hs-nm b{display:block;font-size:.88rem;color:var(--tx-1)}.hs-nm small{font-size:.74rem;color:var(--tx-2)}',
    '.hs-badge{font-size:.72rem;font-weight:700;border:1px solid var(--bd-2);border-radius:999px;padding:1px 8px;color:var(--tx-1);white-space:nowrap}',
    '.hs-badge--ok{border-color:var(--color-green,#3CC48A)}.hs-badge--pend{border-color:var(--color-amber,#F2B94B)}.hs-badge--nd{color:var(--tx-2)}',
    '.hs-acts{display:flex;gap:6px;width:100%;justify-content:flex-end}.hs-acts:empty{display:none}',
    '.hs-box{width:14px;height:14px;border:2px solid var(--bd-2);border-radius:4px;box-sizing:border-box}',
    '.hs-chk[aria-pressed=true] .hs-box{background:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A)}',
    '.hs-cats{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}',
    '.hs-cat{border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);padding:6px 10px;font-size:.8rem}.hs-cat--on{border-color:var(--color-green,#3CC48A)}',
    '.hs-cat b{display:block;color:var(--tx-1)}.hs-cat small{color:var(--tx-2)}',
    '.hs-txt{margin:4px 0 8px;font-size:.88rem;color:var(--tx-1)}.hs-note,.hs-src{margin:8px 0 0;color:var(--tx-2);font-size:.78rem}.hs-src{font-size:.74rem}',
    '.hs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    R + ' :is(button,input):focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + R + ' *{transition:none!important;animation:none!important}}',
    '@media (max-width:900px){.hs-hero{padding:14px 12px 12px}' + P + '.hs-on>:not(#hsRoot),' + R + '>:not(.hs-hero){margin-left:12px;margin-right:12px}',
    '.hs-ico{width:40px;height:40px;padding:4px}.hs-title h2{font-size:1.05rem}.hs-top,.hs-q{margin-left:0;width:100%}.hs-q input{width:100%}',
    '.hs-stats{grid-template-columns:1fr 1fr;gap:6px}.hs-nodes{grid-template-columns:1fr}.hs-btn,.hs-pill,.hs-q input{min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado y DOM
  var doc = root.document;
  var st = { cat: null, catP: null, data: null, ui: { group: 'all', only: 'all', q: '', tab: 'nodes' }, cache: {}, shown: false, seq: 0, voiceKey: null, tick: null, day: null };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function hash() { return String((root.location && root.location.hash) || '').split('?')[0]; }
  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }
  function doneKey() { var S = storage(); return (S && S.STORAGE_KEYS && S.STORAGE_KEYS.ACTIVITIES_HOME_NODES) || DONE_KEY; }
  function token() {
    try {
      var sel = byId('keySelectGlobal');
      if (sel && sel.value) return String(sel.value).trim();
      var S = storage();
      if (S && S.STORAGE_KEYS) return S.get(S.STORAGE_KEYS.ACCOUNT_SELECTED) || null;
    } catch (e) {}
    return null;
  }

  function loadCat() {
    if (st.cat) return Promise.resolve(st.cat);
    if (st.catP) return st.catP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.catP = root.fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('datos ' + r.status); return r.json(); })
      .then(function (c) { st.cat = c || {}; return st.cat; })
      .catch(function (e) { st.catP = null; if (root.console) root.console.warn(LOG, 'datos', e); return null; });
    return st.catP;
  }

  function readJSON(path, tk, nocache) {
    var key = path + '|' + fingerprint(tk), c = st.cache[key];
    if (!nocache && c && Date.now() - c.t < TTL) return Promise.resolve(c.v);
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var url = API + path + (path.indexOf('?') < 0 ? '?' : '&') + 'access_token=' + encodeURIComponent(tk);
    return root.fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (to) clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (v) { st.cache[key] = { t: Date.now(), v: v }; return v; });
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }
  function settle(p) { return Promise.resolve().then(p).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }

  function load(nocache) {
    var tk = token(), seq = ++st.seq;
    if (!tk) { st.data = { loaded: true, hasToken: false, unread: [] }; render(); return Promise.resolve(st.data); }
    if (!st.data || !st.data.loaded) render();
    return Promise.all([
      settle(function () { return readJSON('/v2/account/home/nodes', tk, nocache); }),
      settle(function () { return readJSON('/v2/account/home/cats', tk, nocache); })
    ]).then(function (r) {
      if (seq !== st.seq) return st.data;
      var arr = function (x) { return x.ok && Array.isArray(x.v) ? x.v : null; }, unread = [];
      if (!arr(r[0])) unread.push('nodes');
      if (!arr(r[1])) unread.push('cats');
      st.data = { loaded: true, hasToken: true, unlocked: arr(r[0]), cats: arr(r[1]), unread: unread };
      render();
      return st.data;
    });
  }

  function marks() {
    var S = storage(), tk = token(), now = Date.now();
    var done = S ? doneToday(S.get(doneKey()), now, st.cat && st.cat.aliases) : {};
    var owned = S && tk ? ownedFor(S.get(OWNED_KEY), fingerprint(tk)) : {};
    return { done: done, owned: owned };
  }

  function model() {
    var mk = marks(), d = Object.assign({ loaded: false, hasToken: !!token(), unread: [] }, st.data || {}, mk);
    return buildModel(d, st.cat, st.ui, Date.now());
  }

  function ensurePanel() {
    var p = byId(PANEL);
    if (p || !doc || !doc.createElement) return p;
    var a = byId('activitiesPanel');
    if (!a || !a.parentNode) return null;
    p = doc.createElement('section');
    p.id = PANEL; p.className = 'panel col-main';
    p.setAttribute('hidden', 'hidden');
    a.parentNode.insertBefore(p, a.nextSibling);
    return p;
  }

  function ensureHost(panel) {
    if (!byId('home-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style'); s.id = 'home-view-css'; s.textContent = CSS; doc.head.appendChild(s);
    }
    if (root.GNKit && typeof root.GNKit.ensureCSS === 'function') root.GNKit.ensureCSS();
    var host = byId('hsRoot');
    if (!host) {
      host = doc.createElement('div'); host.id = 'hsRoot';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
      if (root.GNSurface && typeof root.GNSurface.register === 'function') root.GNSurface.register(PANEL);
    }
    if (panel.classList) panel.classList.add('hs-on');
    if (panel.setAttribute) panel.setAttribute('aria-labelledby', 'hsTitle');
    return host;
  }

  function focusSel(a) {
    var ks = ['data-hs', 'data-hs-tab', 'data-hs-group', 'data-hs-only', 'data-hs-done', 'data-hs-own', 'data-hx-only', 'data-hx-more'];
    for (var i = 0; i < ks.length; i++) { var v = a.getAttribute(ks[i]); if (v) return '[' + ks[i] + '="' + v + '"]'; }
    return null;
  }

  function render() {
    var panel = byId(PANEL);
    if (!panel || !st.cat || !st.shown) return null;
    var host = ensureHost(panel), m = model();
    var a = doc.activeElement, fk = a && host.contains && host.contains(a) && a.getAttribute ? (a.id ? '#' + a.id : focusSel(a)) : null;
    var caret = a && (a.id === 'hsQ' || a.id === 'hxQ') ? a.selectionStart : null;
    host.innerHTML = viewHTML(m, extFor(st.ui.tab));
    st.voiceKey = null;
    renderVoice(pickVoice(m));
    if (fk && host.querySelector) {
      var b = host.querySelector(fk);
      if (b && b.focus) b.focus();
      if (b && caret != null && b.setSelectionRange) b.setSelectionRange(caret, caret);
    }
    return m;
  }

  function extra() { var X = root.HomeExtra; return X && typeof X.html === 'function' && Array.isArray(X.tabs) ? X : null; }
  function extFor(tab) {
    var X = extra();
    if (!X) return null;
    var ok = X.tabs.some(function (t) { return t[0] === tab; }), html = '';
    if (ok) { try { html = X.html(tab, { token: token() }); } catch (e) { html = '<p class="hs-txt">Sin datos: no pude dibujar esta pestaña.</p>'; } }
    return { tabs: X.tabs, tab: ok ? tab : 'nodes', html: html };
  }
  function tabIds() { var X = extra(); return ['nodes'].concat(X ? X.tabs.map(function (t) { return t[0]; }) : []); }
  function goTab(id, focus) {
    st.ui.tab = id;
    render();
    var b = focus && byId('hsTab-' + id);
    if (b && b.focus) b.focus();
  }

  function renderVoice(msg) {
    var box = byId('hsVoice');
    if (!box) return;
    var key = msg ? msg.key : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.ShvBubble && root.ShvBubble.speak) root.ShvBubble.speak(box, msg, { module: 'heredad', source: 'tus nodos (API oficial) y lo que marcaste', key: key }); else if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text, basis: 'tus nodos (API oficial) y lo que marcaste · en este navegador' })); // SHE-3 (DEC-038): mi globo
  }

  function attrOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = { act: n.getAttribute('data-hs'), group: n.getAttribute('data-hs-group'), only: n.getAttribute('data-hs-only'), done: n.getAttribute('data-hs-done'), own: n.getAttribute('data-hs-own') };
      if (a.act || a.group || a.only || a.done || a.own) return a;
    }
    return null;
  }

  function toggleDone(id) {
    var S = storage(), k = doneKey(), now = Date.now();
    if (!S) return false;
    var cur = doneToday(S.get(k), now, st.cat && st.cat.aliases), base = {};
    base[dayKey(now)] = cur; // hoy, con los ids viejos ya traducidos
    S.set(k, setDone(base, now, id, !cur[id]));
    return true;
  }
  function toggleOwned(id) {
    var S = storage(), tk = token(), f = fingerprint(tk);
    if (!S || !f) return false;
    var store = S.get(OWNED_KEY) || {};
    S.set(OWNED_KEY, setOwned(store, f, id, !ownedFor(store, f)[id]));
    return true;
  }

  function wire(host) {
    host.addEventListener('click', function (e) {
      var X = extra(), tb = null;
      for (var n = e.target, i = 0; n && i < 4 && !tb; n = n.parentNode, i++) tb = n.getAttribute ? n.getAttribute('data-hs-tab') : null;
      if (tb) { goTab(tb, false); return; }
      if (X && typeof X.onClick === 'function' && X.onClick(e)) return;
      var a = attrOf(e.target);
      if (!a) return;
      if (a.act === 'refresh') {
        if (root.toast) root.toast('info', 'Actualizando tu heredad…', { ttl: 1500 });
        if (X && typeof X.refresh === 'function') X.refresh();
        load(true); return;
      }
      if (a.group) st.ui.group = a.group;
      else if (a.only) st.ui.only = a.only;
      else if (a.done) toggleDone(a.done);
      else if (a.own) toggleOwned(a.own);
      render();
    });
    host.addEventListener('keydown', function (e) {
      var t = e && e.target, id = t && t.getAttribute && t.getAttribute('data-hs-tab');
      if (!id) return;
      var ids = tabIds(), i = ids.indexOf(id), n = ids.length, k = e.key, j = -1;
      if (k === 'ArrowRight') j = (i + 1) % n; else if (k === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
      if (j < 0) return;
      if (e.preventDefault) e.preventDefault();
      goTab(ids[j], true);
    });
    host.addEventListener('change', function (e) { var X = extra(); if (X && typeof X.onChange === 'function') X.onChange(e); });
    host.addEventListener('input', function (e) {
      var t = e && e.target, X = extra();
      if (X && typeof X.onInput === 'function' && X.onInput(e)) return;
      if (!t || t.id !== 'hsQ') return;
      st.ui.q = String(t.value || '');
      render();
    });
  }

  function tickOnce() {
    if (!visible()) { stopTick(); return; }
    var n = byId('hsClk'), now = Date.now(), d = dayKey(now);
    if (n) n.textContent = 'en ' + untilReset(now);
    if (root.GNKit && typeof root.GNKit.tick === 'function') root.GNKit.tick(now);
    if (st.day && st.day !== d) render(); // pasó el reset diario: las marcas de ayer ya no cuentan
    st.day = d;
  }
  function startTick() { if (!st.tick && typeof root.setInterval === 'function') st.tick = root.setInterval(tickOnce, TICK); }
  function stopTick() { if (st.tick && typeof root.clearInterval === 'function') root.clearInterval(st.tick); st.tick = null; }

  function visible() { return hash() === ROUTE && !isHidden(byId(PANEL)); }

  function onShow() {
    ensurePanel();
    if (!visible()) { st.shown = false; stopTick(); return; }
    var first = !st.shown;
    st.shown = true;
    st.day = dayKey(Date.now());
    startTick();
    loadCat().then(function () { render(); if (first || !st.data) load(false); });
  }

  function init() {
    ensurePanel();
    if (doc.addEventListener) {
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { st.data = null; st.cache = {}; setTimeout(function () { if (visible()) { st.shown = true; loadCat().then(function () { load(false); }); } }, 80); });
    }
    if (root.addEventListener) root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
    onShow();
  }

  root.HomeView = {
    version: VERSION, render: render, refresh: function () { return load(true); },
    getSnapshot: function () { return { data: st.data, ui: Object.assign({}, st.ui) }; },
    _pure: { esc: esc, fold: fold, dayKey: dayKey, untilReset: untilReset, fingerprint: fingerprint, doneToday: doneToday, setDone: setDone,
      ownedFor: ownedFor, setOwned: setOwned, buildModel: buildModel, pickVoice: pickVoice, errorText: errorText, statsHTML: statsHTML,
      nodesHTML: nodesHTML, catsHTML: catsHTML, tabsHTML: tabsHTML, viewHTML: viewHTML, CSS: CSS, ROUTE: ROUTE, PANEL: PANEL, DONE_KEY: DONE_KEY, OWNED_KEY: OWNED_KEY }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
