/*!
 * js/ach-view.js — Logros: cabecera, pestañas y mi línea (BL-067, LOG-1)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.3.0 (2026-10-24)
 *  - 1.3.0 (CAM-POLISH-001): si js/gn-surface.js está cargado, la guarda de contraste se calcula
 *    sobre la bandeja y la tarjeta reales (GNSurface.surfaceTokens), no sobre el fondo del theme.
 *  - 1.2.0 (LOG-4): en «Colecciones legendarias», mi línea dice cuál es la colección más
 *    avanzada y, si js/ach-armory.js la une a una legendaria, que lo que falta está en la Armería.
 *  - 1.1.0 (LOG-3): «Por categoría» la arma js/ach-categories.js si está cargado (grupos por
 *    expansión o modo); si no, queda la lista de antes. Devuelve el foco al buscador al redibujar.
 *
 * Capa de vista sobre achievements.js (3.3.0 o más), como wv-view.js sobre la Cámara:
 *  - Cabecera con el ícono oficial de Logros, el dato en el subtítulo, «Al alcance» y
 *    4 indicadores: puntos de logro, al alcance, a un paso y con recompensa.
 *  - Tres pestañas: Casi listos (la grilla de siempre), Por categoría (las categorías con
 *    logros pendientes) y Colecciones legendarias (el filtro de legendarias de siempre).
 *  - Mi voz en una línea, solo si hay algo cerca (DEC-024, DEC-033).
 *  - Guarda de contraste de la Bienvenida sobre #achievementsPanel.
 * Lee el estado con Achievements.getSnapshot() y escucha gn:achievements: ningún pedido nuevo.
 * Los íconos oficiales de Guild Wars 2 se quedan donde están (pedido de Pablo, LOG-0).
 * Si achievements.js todavía no publica su estado, no hace nada: la pantalla queda como estaba.
 * Se carga por js/modules.json (DEC-035): arranca aunque el documento ya esté listo.
 */
(function (root) {
  'use strict';

  var VERSION = '1.3.0';
  var LOG = '[AchView]';
  var ICON = 'assets/icons/155059.png';
  var ICON_AP = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var NEAR = 0.8, STEP = 0.95, REWARD_NEAR = 0.9;
  var TABS = [['near', 'Casi listos'], ['cats', 'Por categoría'], ['legendary', 'Colecciones legendarias']];
  var REWARD_WORD = { Item: ['ítem', 'ítems'], Title: ['título', 'títulos'], Mastery: ['maestría', 'maestrías'] };

  // ------------------------------------------------------------------ puro
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }

  function plural(n, uno, varios) { return fmtInt(n) + ' ' + (n === 1 ? uno : varios); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Lo que falta para terminar: «te falta 1», «te faltan 3».
  function missing(pr) { return Math.max(0, Math.round((Number(pr && pr.max) || 0) - (Number(pr && pr.cur) || 0))); }
  function falta(k) { return k === 1 ? 'te falta 1' : 'te faltan ' + fmtInt(k); }

  function apLeft(x, calc) {
    if (!calc || !x || !x.meta) return 0;
    return Math.max(0, (Number(calc.totalAP(x.meta)) || 0) - (Number(calc.earnedAP(x.r, x.meta)) || 0));
  }

  function rewardTypes(meta) {
    var out = {};
    (meta && Array.isArray(meta.rewards) ? meta.rewards : []).forEach(function (r) { if (r && REWARD_WORD[r.type]) out[r.type] = true; });
    return out;
  }

  // La lista que muestra la grilla (snapshot.rows, ya filtrada y ordenada) en números.
  function summarize(rows, calc) {
    var s = { count: 0, apLeft: 0, step: [], withReward: 0, rewards: { Item: 0, Title: 0, Mastery: 0 }, prize: null, first: null };
    (rows || []).forEach(function (x) {
      if (!x || !x.pr) return;
      if (!s.first) s.first = x;
      s.count++;
      var left = apLeft(x, calc);
      s.apLeft += left;
      if (x.pr.pct >= STEP) s.step.push({ x: x, ap: left });
      var t = rewardTypes(x.meta), any = false;
      Object.keys(t).forEach(function (k) { s.rewards[k]++; any = true; });
      if (any) s.withReward++;
      if (!s.prize && x.pr.pct >= REWARD_NEAR && (t.Title || t.Mastery)) s.prize = { x: x, kind: t.Title ? 'Title' : 'Mastery' };
    });
    return s;
  }

  // Toda la cuenta: pendientes y cercanos por categoría, para las pestañas.
  function tally(snap, calc) {
    var out = { near: 0, legendary: 0, cats: [] };
    if (!snap || !calc || !snap.acc || !snap.metaById) return out;
    var by = {}, leg = String(snap.legendaryCatId || '');
    snap.acc.forEach(function (r) {
      var meta = snap.metaById.get(r.id);
      if (!meta) return;
      var pr = calc.computeProgress(r, meta);
      if (!pr || pr.pct >= 1) return;
      if (pr.pct >= NEAR) out.near++;
      var cid = snap.achIdToCat ? snap.achIdToCat.get(String(r.id)) : '';
      if (!cid) return;
      if (leg && String(cid) === leg) out.legendary++;
      var c = by[cid] || (by[cid] = { id: String(cid), pending: 0, near: 0 });
      c.pending++;
      if (pr.pct >= NEAR) c.near++;
    });
    out.cats = Object.keys(by).map(function (k) {
      var c = by[k], cat = snap.catById ? snap.catById.get(String(k)) : null;
      c.name = (cat && cat.name) || ('#' + k);
      c.icon = (cat && cat.icon) || '';
      return c;
    }).sort(function (a, b) { return (b.near - a.near) || (b.pending - a.pending) || a.name.localeCompare(b.name); });
    return out;
  }

  function nameOf(x) { return '«' + ((x.meta && x.meta.name) || '#' + x.r.id) + '»'; }

  // Mi línea: lo más barato primero, después una recompensa a mano. Si no hay nada cerca, nada.
  // En «Colecciones legendarias» hablo de la colección más avanzada y, si sé a qué legendaria
  // lleva (leg = { name }), de la Armería.
  function pickVoice(sum, tab, leg) {
    if (!sum || tab === 'cats') return null;
    if (tab === 'legendary') {
      if (!sum.first) return null;
      var c = sum.first, pc = Math.min(99, Math.floor((Number(c.pr.pct) || 0) * 100));
      return { key: 'leg', kind: 'recomienda', text: 'Tu colección más avanzada es ' + nameOf(c) + ': vas ' + pc + ' % y ' + falta(missing(c.pr)) + '.' +
        (leg && leg.name ? ' Es para «' + leg.name + '»: lo que falta de la legendaria lo ves en la Armería.' : '') };
    }
    if (sum.step.length) {
      var f = sum.step[0].x, n = sum.step.length, k = missing(f.pr);
      var ap = sum.step.reduce(function (a, s) { return a + s.ap; }, 0);
      if (n === 1) return { key: 'step1', kind: 'recomienda', text: 'Con ' + nameOf(f) + ' ' + (ap ? 'sumás ' + fmtInt(ap) + ' AP: ' : 'lo terminás: ') + falta(k) + '.' };
      return { key: 'step', kind: 'recomienda', text: 'Con ' + plural(n, 'logro', 'logros') + (ap ? ' sumás ' + fmtInt(ap) + ' AP' : ' a un paso') +
        ': el más cercano es ' + nameOf(f) + ' y ' + falta(k) + '.' };
    }
    if (sum.prize) {
      var x = sum.prize.x;
      return { key: 'prize', kind: 'recomienda', text: 'Para terminar ' + nameOf(x) + ' ' + falta(missing(x.pr)) +
        ', y te da ' + (sum.prize.kind === 'Title' ? 'un título' : 'una maestría') + '.' };
    }
    return null;
  }

  // Qué pestaña está activa: «Por categoría» la elige la persona; las otras dos salen del filtro.
  function activeTab(snap, chosen) {
    if (chosen === 'cats') return 'cats';
    var leg = snap && snap.legendaryCatId && String(snap.cat || '') === String(snap.legendaryCatId);
    return leg ? 'legendary' : 'near';
  }

  function subtitle(m) {
    if (!m.hasToken) return 'Cargá tu API Key para ver tus logros.';
    if (!m.loaded) return 'Cargando tus logros…';
    if (m.tab === 'cats') return m.cats.length ? 'Tenés logros pendientes en ' + plural(m.cats.length, 'categoría', 'categorías') + '.' : 'No tenés logros pendientes.';
    var n = m.sum.count;
    if (m.tab === 'legendary') return n ? 'Tenés ' + plural(n, 'colección legendaria en curso', 'colecciones legendarias en curso') + '.' : 'No tenés colecciones legendarias en curso.';
    var where = m.catName ? ' en «' + m.catName + '»' : '';
    var lvl = m.pct > 0 ? ' al ' + Math.round(m.pct * 100) + ' % o más' : (n === 1 ? ' pendiente' : ' pendientes');
    return n ? 'Tenés ' + plural(n, 'logro', 'logros') + lvl + where + '.' : 'No tenés logros' + lvl + where + ' con estos filtros.';
  }

  function stat(label, value, note) {
    return '<div class="achx-st"><small>' + label + '</small><b>' + value + '</b><em>' + note + '</em></div>';
  }

  function statsHTML(m) {
    if (!m.loaded) {
      return ['Puntos de logro', 'Al alcance', 'A un paso (≥ 95 %)', 'Con recompensa'].map(function (l) { return stat(l, '—', 'sin datos todavía'); }).join('');
    }
    var s = m.sum, parts = [];
    ['Item', 'Title', 'Mastery'].forEach(function (k) { if (s.rewards[k]) parts.push(fmtInt(s.rewards[k]) + ' ' + REWARD_WORD[k][s.rewards[k] === 1 ? 0 : 1]); });
    return stat('Puntos de logro', fmtInt(m.ap.perm + m.ap.daily), fmtInt(m.ap.perm) + ' permanentes · ' + fmtInt(m.ap.daily) + ' de diarios y mensuales') +
      stat('Al alcance', '+' + fmtInt(s.apLeft) + ' <span>AP</span>', 'en ' + plural(s.count, 'logro de la lista', 'logros de la lista')) +
      stat('A un paso (≥ 95 %)', fmtInt(s.step.length), s.step.length ? 'te falta muy poco en cada uno' : 'ninguno todavía') +
      stat('Con recompensa', fmtInt(s.withReward), parts.length ? parts.join(' · ') : 'sin ítems, títulos ni maestrías');
  }

  function headHTML(m) {
    var h = [];
    h.push('<div class="achx-hero"><div class="achx-row"><img src="' + ICON + '" alt="" width="56" height="56">');
    h.push('<div class="achx-title"><h2 id="achxTitle">Logros</h2><p>' + esc(subtitle(m)) + '</p></div><div class="achx-pills">');
    if (m.loaded) h.push('<span class="achx-pill achx-pill--hot"><img src="' + ICON_AP + '" alt="" width="18" height="18">Al alcance <b>+' + fmtInt(m.sum.apLeft) + ' AP</b></span>');
    h.push('<button type="button" class="achx-btn" data-achx="refresh">↻ Actualizar</button></div></div>');
    h.push('<div class="achx-stats">' + statsHTML(m) + '</div>');
    h.push('<div id="achxVoice" class="achx-voice" aria-live="polite"></div></div>');
    h.push(navHTML(m));
    if (m.tab === 'cats') h.push(catsHTML(m));
    return h.join('');
  }

  function navHTML(m) {
    var badge = { near: m.t.near, cats: m.cats.length, legendary: m.t.legendary };
    var h = ['<div class="achx-tabs" role="tablist" aria-label="Secciones de Logros">'];
    TABS.forEach(function (t) {
      var on = m.tab === t[0];
      h.push('<button type="button" role="tab" id="achxTab-' + t[0] + '" data-achx-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="' +
        (t[0] === 'cats' ? 'achxCats' : 'achievementsMain') + '" tabindex="' + (on ? '0' : '-1') + '">' + t[1] +
        (m.loaded && badge[t[0]] ? '<span class="achx-badge">' + fmtInt(badge[t[0]]) + '</span>' : '') + '</button>');
    });
    h.push('</div>');
    return h.join('');
  }

  function catsHTML(m) {
    var h = ['<div id="achxCats" class="achx-cats" role="tabpanel" aria-labelledby="achxTab-cats">'];
    if (m.catsBody != null) return h[0] + m.catsBody + '</div>';
    if (!m.loaded || !m.cats.length) {
      h.push('<p class="achx-note">' + esc(m.loaded ? 'No tenés logros pendientes.' : subtitle(m)) + '</p></div>');
      return h.join('');
    }
    h.push('<p class="achx-note">Tocá una categoría para ver todos sus logros pendientes, del más cercano al más lejano.</p><ul class="achx-clist">');
    m.cats.forEach(function (c) {
      h.push('<li><button type="button" data-achx-cat="' + esc(c.id) + '">' +
        (c.icon ? '<img src="' + esc(c.icon) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">' : '<span class="achx-noicon" aria-hidden="true"></span>') +
        '<span class="achx-cn">' + esc(c.name) + '</span><span class="achx-cc">' +
        (c.near ? '<b>' + fmtInt(c.near) + ' cerca</b> · ' : '') + plural(c.pending, 'pendiente', 'pendientes') + '</span></button></li>');
    });
    h.push('</ul></div>');
    return h.join('');
  }

  function legOf(x) {
    var AR = root.AchArmory;
    if (!x || !AR || typeof AR.legendaryFor !== 'function') return null;
    try { return AR.legendaryFor(x); } catch (e) { return null; }
  }

  function buildModel(snap, calc, chosen) {
    var tab = activeTab(snap, chosen);
    var cat = snap && snap.cat && snap.catById ? snap.catById.get(String(snap.cat)) : null;
    var t = tally(snap, calc), sum = summarize(snap && snap.rows, calc);
    return {
      tab: tab, loaded: !!(snap && snap.loaded), hasToken: !!(snap && snap.hasToken),
      pct: snap ? Number(snap.pct) || 0 : NEAR, catName: tab === 'near' && cat ? cat.name : '',
      ap: { perm: Number(snap && snap.ap && snap.ap.perm) || 0, daily: Number(snap && snap.ap && snap.ap.daily) || 0 },
      sum: sum, t: t, cats: t.cats, voice: pickVoice(sum, tab, tab === 'legendary' ? legOf(sum.first) : null)
    };
  }

  var CSS = [
    '#achievementsPanel.achx-on>.panel__title,#achievementsPanel.achx-on>.panel__body>.panel-head,#achievementsPanel.achx-on>.panel__body>.hr-hairline{display:none!important}',
    '#achievementsPanel.achx-cats-on .ach-toolbar,#achievementsPanel.achx-cats-on #achievementsMain{display:none!important}',
    '#achxHead{margin:0 0 12px}',
    '.achx-hero{border:1px solid var(--bd-1);border-radius:16px;background:linear-gradient(180deg,rgba(232,163,61,.10),var(--bg-1) 70%);padding:16px 18px}',
    '.achx-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.achx-row>img{width:56px;height:56px;border-radius:12px;background:var(--bg-2);padding:6px;flex-shrink:0}',
    '.achx-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.achx-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.achx-pills{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.achx-pill{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 10px;color:var(--tx-2);background:var(--bg-0);white-space:nowrap}',
    '.achx-pill img{border-radius:3px}.achx-pill b{color:var(--tx-1);font-weight:600}.achx-pill--hot{border-color:var(--color-amber,#F2B94B)}.achx-pill--hot b{color:var(--color-amber,#F2B94B)}',
    '.achx-btn{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px}',
    '.achx-btn:hover{border-color:var(--acc-1)}',
    '.achx-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.achx-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.achx-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.achx-st b{font-size:1.25rem;color:var(--tx-1)}.achx-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.achx-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px}',
    '.achx-voice{margin-top:12px}.achx-voice:empty{display:none}.achx-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.achx-voice .shv-voice__avatar{width:36px;height:36px}.achx-voice .shv-voice__label{font-size:.78rem}.achx-voice .shv-voice__body p{font-size:.86rem}',
    '.achx-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1);overflow-x:auto}',
    '.achx-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);cursor:pointer;white-space:nowrap;min-height:40px}',
    '.achx-tabs [role=tab][aria-selected=true]{color:var(--tx-1);font-weight:700;border-bottom-color:#E8A33D}',
    '.achx-badge{font-size:.72rem;color:var(--tx-2);margin-left:6px;font-weight:600;border:1px solid var(--bd-1);border-radius:999px;padding:0 6px}',
    '.achx-note{margin:4px 0 10px;color:var(--tx-2);font-size:.86rem}',
    '.achx-clist{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}',
    '.achx-clist button{font:inherit;width:100%;display:grid;grid-template-columns:32px 1fr;column-gap:10px;align-items:center;text-align:left;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 12px;color:var(--tx-1);cursor:pointer;min-height:56px}',
    '.achx-clist button:hover{border-color:var(--acc-1)}.achx-clist img,.achx-noicon{grid-row:1/3;width:32px;height:32px;border-radius:6px;background:var(--bg-2)}',
    '.achx-cn{font-weight:600;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.achx-cc{font-size:.76rem;color:var(--tx-2)}',
    '.achx-cc b{color:var(--color-amber,#F2B94B);font-weight:600}',
    '#achxHead button:focus-visible,#achievementsPanel [role=tabpanel]:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){#achxHead *{transition-duration:.001ms!important;animation-duration:.001ms!important}}',
    '@media (max-width:900px){.achx-hero{padding:12px}.achx-row>img{width:40px;height:40px;padding:4px}.achx-title h2{font-size:1.05rem}',
    '.achx-pills{margin-left:0;width:100%}.achx-stats{grid-template-columns:1fr 1fr;gap:6px}.achx-st{padding:8px 10px}.achx-st b{font-size:1.05rem}',
    '.achx-voice{display:none}.achx-tabs [role=tab]{padding:8px 10px;font-size:.86rem;min-height:44px}.achx-clist{grid-template-columns:1fr}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { chosen: 'near', nearFilter: null, voiceKey: null, guarded: [] };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function api() { var A = root.Achievements; return A && typeof A.getSnapshot === 'function' && typeof A.setFilter === 'function' && A._calc ? A : null; }
  function cls(n, c, on) { if (n && n.classList) n.classList[on ? 'add' : 'remove'](c); }

  function ensureHost(panel) {
    if (!byId('ach-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'ach-view-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var host = byId('achxHead');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'achxHead';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
    }
    cls(panel, 'achx-on', true);
    return host;
  }

  // Qué control tenía el foco, para devolverlo después de redibujar.
  function focusKey() {
    var a = doc.activeElement;
    if (!a || !a.getAttribute) return null;
    var t = a.getAttribute('data-achx-tab'), x = a.getAttribute('data-achx'), g = a.getAttribute('data-achg-mode');
    return t ? '[data-achx-tab="' + t + '"]' : x ? '[data-achx="' + x + '"]' : g ? '[data-achg-mode="' + g + '"]' : a.id === 'achgSearch' ? '#achgSearch' : null;
  }

  function render() {
    var A = api(), panel = byId('achievementsPanel');
    if (!A || !panel) return null;
    var host = ensureHost(panel);
    var snap = A.getSnapshot(), m = buildModel(snap, A._calc, st.chosen), C = root.AchCategories;
    st.chosen = m.tab;
    if (m.tab === 'cats' && m.loaded && C && typeof C.html === 'function') {
      try { m.catsBody = C.html(snap, A._calc); } catch (e) { if (root.console) root.console.warn(LOG, 'categorías', e); }
    }
    var fk = host.contains && host.contains(doc.activeElement) ? focusKey() : null;
    host.innerHTML = headHTML(m);
    cls(panel, 'achx-cats-on', m.tab === 'cats');
    var main = byId('achievementsMain');
    if (main && main.setAttribute) { main.setAttribute('role', 'tabpanel'); main.setAttribute('aria-labelledby', 'achxTab-' + (m.tab === 'cats' ? 'near' : m.tab)); }
    st.voiceKey = null;
    renderVoice(m.voice);
    if (fk && host.querySelector) { var b = host.querySelector(fk); if (b && b.focus) b.focus(); }
    applyGuard();
    return m;
  }

  function renderVoice(msg) {
    var box = byId('achxVoice');
    if (!box) return;
    var key = msg ? msg.key + '|' + msg.text : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text }));
  }

  function readTokens() {
    var t = {}, cs = typeof root.getComputedStyle === 'function' && doc.documentElement ? root.getComputedStyle(doc.documentElement) : null;
    ['--bg-0', '--bg-1', '--tx-1', '--tx-3', '--muted', '--color-green', '--gn-gold', '--color-amber', '--acc-1', '--color-green-bg', '--color-amber-bg']
      .forEach(function (k) { t[k] = cs && cs.getPropertyValue ? cs.getPropertyValue(k) : ''; });
    return t;
  }

  // La guarda de la Bienvenida: lo que el theme no alcanza a 4.5:1 se corrige solo dentro de Logros.
  function applyGuard(tokens) {
    var panel = byId('achievementsPanel'), W = root.Welcome;
    if (!panel || !panel.style || typeof panel.style.setProperty !== 'function' || !W || !W._pure || typeof W._pure.contrastFixes !== 'function') return {};
    var tk = tokens || readTokens(), GS = root.GNSurface;
    if (GS && typeof GS.surfaceTokens === 'function') tk = GS.surfaceTokens(tk);
    var fixes = W._pure.contrastFixes(tk) || {};
    st.guarded.forEach(function (k) { if (!(k in fixes)) panel.style.removeProperty(k); });
    Object.keys(fixes).forEach(function (k) { panel.style.setProperty(k, fixes[k]); });
    st.guarded = Object.keys(fixes);
    return fixes;
  }

  function watchTheme() {
    if (st.themeWatch || typeof root.MutationObserver !== 'function' || !doc.documentElement) return;
    st.themeWatch = true;
    new root.MutationObserver(function () { applyGuard(); setTimeout(function () { applyGuard(); }, 400); })
      .observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Cambiar de pestaña. «Casi listos» vuelve al filtro que tenías; las otras dos lo guardan antes.
  function go(tab) {
    var A = api();
    if (!A) return;
    var snap = A.getSnapshot(), cur = activeTab(snap, st.chosen);
    if (cur === 'near' && tab !== 'near') st.nearFilter = { cat: snap.cat || '', pct: Number(snap.pct) || 0 };
    st.chosen = tab;
    if (tab === 'near') { if (cur !== 'near') A.setFilter(st.nearFilter || { cat: '', pct: NEAR }); st.nearFilter = null; }
    else if (tab === 'legendary') { if (cur !== 'legendary') A.setFilter({ cat: snap.legendaryCatId || '', pct: 0 }); }
    render();
  }

  // Desde «Por categoría»: todos los pendientes de esa categoría, en «Casi listos».
  function openCat(id) {
    var A = api();
    if (!A) return;
    st.chosen = 'near';
    st.nearFilter = null;
    A.setFilter({ cat: String(id), pct: 0 });
    render();
    var b = byId('achxTab-near');
    if (b && b.focus) b.focus();
  }

  function refreshNow() {
    var A = root.Achievements;
    if (root.toast) root.toast('info', 'Actualizando tus logros…', { ttl: 1500 });
    try { if (A && typeof A.render === 'function') return A.render({ nocache: true }); } catch (e) { if (root.console) root.console.warn(LOG, 'actualizar', e); }
    return null;
  }

  function actOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = n.getAttribute('data-achx'), tab = n.getAttribute('data-achx-tab'), cat = n.getAttribute('data-achx-cat');
      if (a || tab || cat) return { act: a, tab: tab, cat: cat };
    }
    return null;
  }

  function wire(host) {
    host.addEventListener('click', function (e) {
      var a = actOf(e.target);
      if (!a) return;
      if (a.act === 'refresh') refreshNow();
      else if (a.tab) go(a.tab);
      else if (a.cat) openCat(a.cat);
    });
    // Flechas, Inicio y Fin entre las tres pestañas (patrón tablist).
    host.addEventListener('keydown', function (e) {
      var a = actOf(e.target);
      if (!a || !a.tab) return;
      var order = TABS.map(function (t) { return t[0]; }), i = order.indexOf(a.tab), j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % 3;
      else if (e.key === 'ArrowLeft') j = (i + 2) % 3;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = 2;
      if (j < 0) return;
      if (e.preventDefault) e.preventDefault();
      go(order[j]);
      var b = byId('achxTab-' + order[j]);
      if (b && b.focus) b.focus();
    });
  }

  function onShow() { if (!isHidden(byId('achievementsPanel'))) render(); }

  function init() {
    if (!byId('achievementsPanel')) return;
    watchTheme();
    if (doc.addEventListener) {
      doc.addEventListener('gn:achievements', function () { if (!isHidden(byId('achievementsPanel'))) render(); });
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { st.chosen = 'near'; st.nearFilter = null; setTimeout(onShow, 50); });
    }
    if (root.addEventListener) root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
    onShow();
  }

  root.AchView = {
    version: VERSION, render: render, go: go, openCat: openCat, refresh: refreshNow,
    _pure: { fmtInt: fmtInt, missing: missing, summarize: summarize, tally: tally, pickVoice: pickVoice, activeTab: activeTab,
      subtitle: subtitle, buildModel: buildModel, headHTML: headHTML, CSS: CSS, ICON: ICON },
    _guard: applyGuard
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
