/*!
 * js/raids-view.js — Raids renovado: cabecera, pestañas Alas y Encuentros, tarjetas (BL-070, RAI-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.2.0 (2026-10-25) — RAI-6: estados y error legibles (AA) en los 19 themes · antes 1.1.0 (2026-10-24) — RAI-3: toda la fila abre la ficha (js/raids-sheet.js)
 *
 * Un solo módulo Raids, como el juego desde el 2026-02-03 (D1 de RAI-0):
 *  - Cabecera con el ícono del módulo, hora local, servidor y reset semanal (lunes 07:30 UTC),
 *    4 indicadores (alas, conocimiento legendario, fragmentos por cobrar, encuentros) y mi línea.
 *  - Pestaña Alas: las 8 alas de /v2/account/raids. Pestaña Encuentros: los 16 encuentros, que se
 *    marcan con los objetivos del logro semanal 9125; Forjando acero y Nexo de la Eternidad no
 *    están en la API y se marcan a mano por semana (D2, clave gn:raids:marks, vale hasta el reset).
 *  - Tarjetas con la miniatura oficial del jefe, lo que da (conocimiento legendario, fragmentos o
 *    cristales con sus íconos oficiales, modo desafío) y la dificultad del juego (1 a 5).
 * Datos: assets/data/raids/catalog.json (RAI-1). Pedidos: los mismos de raid-tracker.js
 * (getAccountRaids y la cartera, con su caché) más /v2/account/achievements, que Logros ya cachea.
 * Toma el panel #raidTrackerPanel y oculta lo viejo sin borrarlo; #/account/strikes lleva a
 * Encuentros. Toda la fila abre la ficha del encuentro (RaidsSheet, RAI-3). Se carga por
 * js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.2.0';
  var LOG = '[RaidsView]';
  var CATALOG = 'assets/data/raids/catalog.json';
  var ICON = 'assets/icons/raids/raid-icon.png';
  var PANEL = 'raidTrackerPanel';
  var MARKS_KEY = 'gn:raids:marks';
  var VIEW_KEY = 'gn:raids:strike:view';
  var WEEK_MS = 7 * 864e5;
  var TABS = [['wings', 'Alas'], ['enc', 'Encuentros']];
  var STATES = [['all', 'Todos'], ['todo', 'Me faltan'], ['cm', 'Con modo desafío']];
  var EXP_SHORT = { hot: 'HoT', pof: 'PoF', jw: 'JW', core: 'Juego base', ibs: 'IBS', eod: 'EoD', soto: 'SotO', voe: 'VoE' };
  var STATE_TXT = { done: '✓ Hecho', hand: '✓ Marcado por vos', todo: 'Pendiente', na: 'La API no lo informa', unknown: 'Sin datos', nokey: '' };
  var TYPE_TXT = { boss: 'Jefe', event: 'Evento', encounter: 'Encuentro' };

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Último reset semanal (lunes 07:30 UTC) que ya pasó.
  function weekStart(now) {
    var d = new Date(now), back = (d.getUTCDay() + 6) % 7;
    var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back, 7, 30, 0, 0);
    if (t > d.getTime()) t -= WEEK_MS;
    return t;
  }

  function nextReset(now) { return weekStart(now) + WEEK_MS; }

  function countdown(ms) {
    ms = Math.max(0, ms);
    var m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    if (d) return 'en ' + d + ' d ' + h + ' h';
    return 'en ' + h + ' h ' + pad(m % 60) + ' min';
  }

  // Huella de la cuenta para las marcas a mano: la Key nunca se guarda.
  function fingerprint(token) {
    var h = 5381, s = String(token || '');
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'k' + h.toString(36);
  }

  // Marcas de esta semana para esta cuenta. Las de otra semana no cuentan.
  function marksFor(store, fp, now) {
    var w = new Date(weekStart(now)).toISOString();
    if (!store || store.week !== w || !store.acc || !Array.isArray(store.acc[fp])) return [];
    return store.acc[fp].slice();
  }

  function toggleMark(store, fp, id, now) {
    var w = new Date(weekStart(now)).toISOString();
    var next = { week: w, acc: {} };
    if (store && store.week === w && store.acc) Object.keys(store.acc).forEach(function (k) { next.acc[k] = (store.acc[k] || []).slice(); });
    var list = next.acc[fp] || (next.acc[fp] = []), i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    if (!list.length) delete next.acc[fp];
    return next;
  }

  function balance(wallet, id) {
    if (!Array.isArray(wallet)) return null;
    var w = wallet.filter(function (x) { return x && x.id === id; })[0];
    return w ? Number(w.value) || 0 : 0;
  }

  // Estado de cada encuentro esta semana.
  // data: { hasToken, raids: [ids] | null, achs: [registros] | null, marks: [ids] }
  function stateOf(e, data) {
    if (!data || !data.hasToken) return 'nokey';
    var t = e.track || {};
    if (t.by === 'account_raids') {
      if (!Array.isArray(data.raids)) return 'unknown';
      return data.raids.indexOf(t.event) >= 0 ? 'done' : 'todo';
    }
    if (t.by === 'weekly_achievement') {
      if (!Array.isArray(data.achs)) return 'unknown';
      var rec = data.achs.filter(function (r) { return r && r.id === t.achievement; })[0];
      if (!rec) return 'todo';
      if (Array.isArray(rec.bits)) return rec.bits.indexOf(t.bit) >= 0 ? 'done' : 'todo';
      return rec.done ? 'unknown' : 'todo';
    }
    return (data.marks || []).indexOf(e.id) >= 0 ? 'hand' : 'na';
  }

  function isDone(s) { return s === 'done' || s === 'hand'; }
  function isPending(s) { return s === 'todo' || s === 'na'; }

  // Todo lo que muestra la pantalla, sin tocar el DOM.
  function buildModel(cat, data, ui) {
    ui = ui || {};
    var m = { tab: ui.tab === 'enc' ? 'enc' : 'wings', filter: ui.filter || 'all', exp: ui.exp || 'all',
      loaded: !!(data && data.loaded), hasToken: !!(data && data.hasToken), groups: [], exps: [], voice: null,
      stats: { wDone: 0, wTotal: 0, eDone: 0, eTotal: 0, eKnown: true, liPending: 0, magPending: 0, gaePending: 0 },
      li: data ? balance(data.wallet, cat && cat.currencies ? cat.currencies.li.id : 70) : null,
      errors: (data && data.errors) || [], cur: (cat && cat.currencies) || {}, expNames: (cat && cat.expansions) || {}, verified: (cat && cat.verified) || '' };
    if (!cat || !Array.isArray(cat.encounters) || !Array.isArray(cat.groups)) return m;
    var groups = {};
    cat.groups.forEach(function (g) { groups[g.id] = { g: g, rows: [], done: 0, total: 0, unknown: false }; });
    cat.encounters.forEach(function (e) {
      var G = groups[e.group];
      if (!G) return;
      var s = stateOf(e, data), wing = G.g.kind === 'wing';
      G.rows.push({ e: e, s: s });
      G.total++;
      if (isDone(s)) G.done++;
      if (s === 'unknown') G.unknown = true;
      if (wing) { m.stats.wTotal++; if (isDone(s)) m.stats.wDone++; }
      else { m.stats.eTotal++; if (isDone(s)) m.stats.eDone++; if (s === 'unknown') m.stats.eKnown = false; }
      if (isPending(s)) {
        m.stats.liPending += Number(e.li) || 0;
        if (typeof e.amount === 'number') {
          if (e.currency === 'gaeting') m.stats.gaePending += e.amount; else m.stats.magPending += e.amount;
        }
      }
    });
    var kind = m.tab === 'enc' ? 'encounters' : 'wing';
    var all = cat.groups.filter(function (g) { return g.kind === kind; });
    all.forEach(function (g) { if (m.exps.indexOf(g.expansion) < 0) m.exps.push(g.expansion); });
    if (m.exp !== 'all' && m.exps.indexOf(m.exp) < 0) m.exp = 'all';
    all.forEach(function (g) {
      if (m.exp !== 'all' && g.expansion !== m.exp) return;
      var G = groups[g.id];
      var rows = G.rows.filter(function (r) {
        if (m.filter === 'todo') return isPending(r.s);
        if (m.filter === 'cm') return !!r.e.cm;
        return true;
      });
      if (rows.length) m.groups.push({ g: g, rows: rows, done: G.done, total: G.total, unknown: G.unknown, allRows: G.rows });
    });
    m.voice = pickVoice(cat, groups, m);
    return m;
  }

  function names(list) {
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
  }

  // Mi línea: el ala empezada que está más cerca de terminarse. Sin datos, nada.
  function pickVoice(cat, groups, m) {
    if (!m.loaded || !m.hasToken) return null;
    var best = null;
    cat.groups.forEach(function (g) {
      var G = groups[g.id];
      if (g.kind !== 'wing' || !G || G.unknown || !G.done || G.done === G.total) return;
      var left = G.rows.filter(function (r) { return r.s === 'todo' && r.e.type !== 'event'; });
      if (!left.length) return;
      if (!best || left.length < best.left.length || (left.length === best.left.length && G.done > best.G.done)) best = { g: g, G: G, left: left };
    });
    if (best) {
      var li = 0, mag = 0;
      best.left.forEach(function (r) { li += Number(r.e.li) || 0; if (typeof r.e.amount === 'number') mag += r.e.amount; });
      var n = best.left.length, who = names(best.left.map(function (r) { return r.e.name; }));
      return { key: 'wing:' + best.g.id + ':' + n, kind: 'recomienda',
        text: 'Te ' + (n === 1 ? 'queda 1 jefe' : 'quedan ' + n + ' jefes') + ' de ' + best.g.name + ': ' + who + '. ' +
          (n === 1 ? 'Es ' : 'Son ') + fmtInt(li) + ' de conocimiento legendario y ' + fmtInt(mag) + ' fragmentos antes del reset del lunes.' };
    }
    if (m.stats.wTotal && m.stats.wDone === m.stats.wTotal) {
      return { key: 'all-wings', kind: 'recomienda', text: 'Hiciste las 8 alas esta semana. Lo que queda está en Encuentros.' };
    }
    return null;
  }

  function subtitle(m) {
    if (!m.hasToken) return 'Cargá tu API Key (con permiso de progreso) para ver tu semana.';
    if (!m.loaded) return 'Cargando tu semana…';
    if (m.tab === 'enc') return m.stats.eKnown ? 'Esta semana: ' + fmtInt(m.stats.eDone) + ' de ' + fmtInt(m.stats.eTotal) + ' encuentros hechos.' : 'No pude leer tus encuentros de esta semana.';
    return 'Esta semana: ' + fmtInt(m.stats.wDone) + ' de ' + fmtInt(m.stats.wTotal) + ' encuentros de alas hechos.';
  }

  function stat(label, value, note, bar) {
    return '<div class="rv-st"><small>' + label + '</small><b>' + value + '</b>' +
      (bar != null ? '<div class="rv-bar" aria-hidden="true"><i style="width:' + bar + '%"></i></div>' : '') + '<em>' + note + '</em></div>';
  }

  function statsHTML(m) {
    var s = m.stats, ok = m.loaded && m.hasToken;
    var pct = s.wTotal ? Math.round(s.wDone * 100 / s.wTotal) : 0;
    var gae = s.gaePending ? ' y ' + fmtInt(s.gaePending) + ' cristales' : '';
    return stat('Alas esta semana', ok ? fmtInt(s.wDone) + ' <span>de ' + fmtInt(s.wTotal) + '</span>' : '—', ok ? pct + ' % de los encuentros de alas' : 'sin datos todavía', ok ? pct : null) +
      stat('Conocimiento legendario', ok && m.li != null ? fmtInt(m.li) : '—', ok ? 'en tu cartera · ' + fmtInt(s.liPending) + ' por cobrar esta semana' : 'sin datos todavía') +
      stat('Fragmentos por cobrar', ok ? fmtInt(s.magPending) : '—', ok ? 'en lo que te falta' + gae + ' · tope semanal 800' : 'sin datos todavía') +
      stat('Encuentros', ok && s.eKnown ? fmtInt(s.eDone) + ' <span>de ' + fmtInt(s.eTotal) + '</span>' : '—', '14 los informa la API · 2 los marcás vos');
  }

  function curIcon(m, key) { var c = m.cur[key]; return c && c.icon ? c.icon : ''; }

  function chip(img, text, label, cls) {
    return '<span class="rv-chip' + (cls ? ' ' + cls : '') + '" title="' + esc(label) + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" width="16" height="16" loading="lazy" referrerpolicy="no-referrer">' : '') +
      '<span class="rv-sr">' + esc(label) + ': </span>' + esc(text) + '</span>';
  }

  function dots(n) {
    if (!n) return '';
    var h = '<span class="rv-dots" role="img" aria-label="Dificultad ' + n + ' de 5">';
    for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return h + '</span>';
  }

  function rowHTML(r, m) {
    var e = r.e, s = r.s, ic = e.icon || {};
    var h = '<li class="rv-enc rv-s-' + s + '"><span class="rv-mini' + (ic.kind === 'next-boss' ? ' rv-mini--ev' : '') + '">' +
      '<img src="' + esc(ic.src || ICON) + '" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer"></span><div class="rv-main">' +
      '<div class="rv-n"><button type="button" class="rv-open" data-rv-open="' + esc(e.id) + '">' + esc(e.name) +
      '<span class="rv-sr">, ver ficha</span></button> <small>' + esc(TYPE_TXT[e.type] || '') + '</small></div><div class="rv-chips">';
    if (e.li) h += chip(curIcon(m, 'li'), String(e.li), 'Conocimiento legendario');
    if (e.amount != null) {
      var cur = e.currency === 'gaeting' ? 'gaeting' : 'magnetite';
      h += chip(curIcon(m, cur), String(e.amount), cur === 'gaeting' ? 'Cristales de Gaets' : 'Fragmentos de magnetita');
    }
    if (e.cm) h += chip('', 'MD +10', 'Modo desafío', 'rv-chip--cm');
    h += dots(e.difficulty) + '</div></div><div class="rv-state">';
    if (STATE_TXT[s]) h += '<span>' + esc(STATE_TXT[s]) + '</span>';
    if (s === 'na' || s === 'hand') {
      h += '<button type="button" class="rv-btn rv-btn--sm" data-rv-mark="' + esc(e.id) + '" aria-pressed="' + (s === 'hand') + '">' +
        (s === 'hand' ? 'Desmarcar' : 'Marcar hecho') + '<span class="rv-sr"> ' + esc(e.name) + '</span></button>';
    }
    return h + '</div><span class="rv-go" aria-hidden="true">›</span></li>';
  }

  function groupHTML(G, m) {
    var g = G.g, title = g.kind === 'wing' ? 'Ala ' + g.wing + ' · ' + g.name : g.name;
    var stack = G.allRows.filter(function (r) { return r.e.type !== 'event' && r.e.icon; }).slice(0, 3);
    var count = !m.hasToken || !m.loaded ? '' : G.unknown ? '—' : G.done + '/' + G.total;
    var sub = g.kind === 'wing' ? m.expNames[g.expansion] || '' : G.total + (G.total === 1 ? ' encuentro' : ' encuentros');
    var h = '<section class="rv-wing" aria-labelledby="rvG-' + esc(g.id) + '"><div class="rv-wing-h"><span class="rv-stack" aria-hidden="true">';
    stack.forEach(function (r) { h += '<img src="' + esc(r.e.icon.src) + '" alt="" width="30" height="30" loading="lazy" referrerpolicy="no-referrer">'; });
    h += '</span><div class="rv-wn"><h3 id="rvG-' + esc(g.id) + '">' + esc(title) + '</h3><small>' + esc(sub) + '</small></div>' +
      (count ? '<span class="rv-cnt' + (G.done === G.total ? ' rv-cnt--ok' : '') + '">' + count + '</span>' : '') + '</div><ul class="rv-list">';
    G.rows.forEach(function (r) { h += rowHTML(r, m); });
    return h + '</ul></section>';
  }

  function segHTML(name, opts, cur, label) {
    var h = '<div class="rv-seg" role="group" aria-label="' + esc(label) + '">';
    opts.forEach(function (o) {
      h += '<button type="button" data-rv-' + name + '="' + esc(o[0]) + '" aria-pressed="' + (o[0] === cur) + '">' + esc(o[1]) + '</button>';
    });
    return h + '</div>';
  }

  function clockHTML(now) {
    var d = new Date(now);
    return '<span class="rv-pill">Local <b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b></span>' +
      '<span class="rv-pill">Servidor <b>' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC</b></span>' +
      '<span class="rv-pill rv-pill--hot">Reset semanal <b>lun 07:30 UTC · ' + countdown(nextReset(now) - now) + '</b></span>';
  }

  function viewHTML(m, now) {
    var h = [];
    h.push('<div class="rv-hero"><div class="rv-row"><img class="rv-ico" src="' + ICON + '" alt="" width="56" height="56">');
    h.push('<div class="rv-title"><h2 id="rvTitle">Raids</h2><p>' + esc(subtitle(m)) + '</p></div>');
    h.push('<div class="rv-pills"><span id="rvClock" class="rv-clock">' + clockHTML(now) + '</span>');
    h.push('<button type="button" class="rv-btn" data-rv="refresh">↻ Actualizar</button></div></div>');
    h.push('<div class="rv-stats">' + statsHTML(m) + '</div>');
    if (m.errors.length) h.push('<p class="rv-err" role="status">' + esc(m.errors.join(' ')) + '</p>');
    h.push('<div id="rvVoice" class="rv-voice" aria-live="polite"></div></div>');
    h.push('<div class="rv-tabs" role="tablist" aria-label="Secciones de Raids">');
    TABS.forEach(function (t) {
      var on = m.tab === t[0];
      var badge = !m.loaded || !m.hasToken ? '' : t[0] === 'wings' ? m.stats.wDone + '/' + m.stats.wTotal : (m.stats.eKnown ? m.stats.eDone + '/' : '') + m.stats.eTotal;
      h.push('<button type="button" role="tab" id="rvTab-' + t[0] + '" data-rv-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="rvPanel" tabindex="' + (on ? '0' : '-1') + '">' +
        t[1] + (badge ? '<span class="rv-badge">' + badge + '</span>' : '') + '</button>');
    });
    h.push('</div><div class="rv-filters">' + segHTML('filter', STATES, m.filter, 'Mostrar'));
    h.push(segHTML('exp', [['all', 'Todas']].concat(m.exps.map(function (x) { return [x, EXP_SHORT[x] || x]; })), m.exp, 'Expansión') + '</div>');
    h.push('<div id="rvPanel" role="tabpanel" aria-labelledby="rvTab-' + m.tab + '">');
    if (m.tab === 'enc') h.push('<p class="rv-note">Desde febrero de 2026 los strikes son encuentros de raid. Forjando acero y Nexo de la Eternidad no los informa la API: marcalos vos y la marca vale hasta el reset del lunes.</p>');
    if (!m.groups.length) h.push('<p class="rv-note">No hay encuentros con este filtro.</p>');
    else { h.push('<div class="rv-wings">'); m.groups.forEach(function (G) { h.push(groupHTML(G, m)); }); h.push('</div>'); }
    h.push('<p class="rv-src">Fragmentos, cristales y conocimiento legendario: wiki oficial y API, verificados el ' + esc(m.verified) + '. Tocá un encuentro para ver su ficha.</p></div>');
    return h.join('');
  }

  var CSS = [
    '#' + PANEL + '.rv-on>.panel__title,#' + PANEL + '.rv-on>.panel__body{display:none!important}',
    '#rvRoot{--rv-mod:var(--gn-mod,#F47C7C)}',
    '.rv-hero{border:1px solid var(--bd-1);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--rv-mod) 12%,transparent),var(--bg-1) 70%);padding:16px 18px}',
    '.rv-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.rv-ico{width:56px;height:56px;border-radius:12px;background:var(--bg-2);padding:6px;box-shadow:0 0 0 2px color-mix(in srgb,var(--rv-mod) 70%,transparent);flex-shrink:0;box-sizing:border-box}',
    '.rv-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.rv-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.rv-pills{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rv-clock{display:contents}',
    '.rv-pill{font-size:.78rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 10px;color:var(--tx-2);background:var(--bg-0);white-space:nowrap}',
    '.rv-pill b{color:var(--tx-1);font-weight:600}.rv-pill--hot{border-color:var(--color-amber,#F2B94B)}.rv-pill--hot b{color:var(--color-amber,#F2B94B)}',
    '.rv-btn{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px}',
    '.rv-btn:hover{border-color:var(--acc-1)}.rv-btn--sm{font-size:.72rem;padding:2px 10px;min-height:28px;margin-top:4px}',
    '.rv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.rv-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.rv-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.rv-st b{font-size:1.25rem;color:var(--tx-1)}.rv-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.rv-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px}',
    '.rv-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:6px}.rv-bar i{display:block;height:100%;background:var(--color-green,#3CC48A)}',
    '.rv-err{margin:10px 0 0;padding-left:8px;border-left:3px solid var(--color-red,#F47C7C);font-size:.82rem;color:var(--tx-1)}',
    '.rv-voice{margin-top:12px}.rv-voice:empty{display:none}.rv-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.rv-voice .shv-voice__avatar{width:36px;height:36px}.rv-voice .shv-voice__label{font-size:.78rem}.rv-voice .shv-voice__body p{font-size:.86rem}',
    '.rv-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1);overflow-x:auto}',
    '.rv-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);cursor:pointer;white-space:nowrap;min-height:40px}',
    '.rv-tabs [role=tab][aria-selected=true]{color:var(--tx-1);font-weight:700;border-bottom-color:var(--rv-mod)}',
    '.rv-badge{font-size:.72rem;color:var(--tx-2);margin-left:6px;font-weight:600;border:1px solid var(--bd-1);border-radius:999px;padding:0 6px}',
    '.rv-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.rv-seg{display:inline-flex;border:1px solid var(--bd-2);border-radius:10px;overflow:hidden;flex-wrap:wrap}',
    '.rv-seg button{font:inherit;font-size:.82rem;background:none;border:0;border-right:1px solid var(--bd-1);padding:6px 12px;color:var(--tx-2);cursor:pointer;min-height:32px}',
    '.rv-seg button:last-child{border-right:0}.rv-seg button[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);font-weight:600}',
    '.rv-note,.rv-src{margin:4px 0 10px;color:var(--tx-2);font-size:.84rem}.rv-src{font-size:.74rem;margin-top:12px}',
    '.rv-wings{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px;align-items:start}',
    '.rv-wing{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));min-width:0}',
    '.rv-wing-h{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--bd-1)}',
    '.rv-stack{display:flex;flex-shrink:0}.rv-stack img{width:30px;height:30px;border-radius:8px;background:var(--bg-2);border:2px solid var(--bg-1);margin-left:-8px}.rv-stack img:first-child{margin-left:0}',
    '.rv-wn{flex:1;min-width:0}.rv-wn h3{margin:0;font-size:.95rem;color:var(--tx-1)}.rv-wn small{font-size:.76rem;color:var(--tx-2)}',
    '.rv-cnt{font-weight:800;font-size:.95rem;color:var(--tx-1)}.rv-cnt--ok{color:var(--color-green,#3CC48A)}',
    '.rv-list{list-style:none;margin:0;padding:0}',
    '.rv-enc{position:relative;display:grid;grid-template-columns:48px 1fr auto 10px;gap:12px;align-items:center;padding:10px 14px;border-top:1px solid var(--bd-1)}.rv-enc:first-child{border-top:0}',
    '.rv-enc:hover{background:color-mix(in srgb,var(--tx-1) 5%,transparent)}.rv-go{color:var(--tx-2);font-size:1.1rem}',
    '.rv-open{font:inherit;font-weight:650;color:inherit;background:none;border:0;padding:0;text-align:left;cursor:pointer}',
    '.rv-open::after{content:"";position:absolute;inset:0}.rv-state .rv-btn{position:relative;z-index:1}',
    '.rv-mini{position:relative;width:48px;height:48px;border-radius:10px;background:radial-gradient(circle at 50% 40%,var(--bg-2),var(--bg-1));box-shadow:0 0 0 1px var(--bd-2);display:block}',
    '.rv-mini img{width:48px;height:48px;border-radius:10px;display:block;object-fit:contain}',
    '.rv-mini--ev img{opacity:.55;filter:grayscale(.4)}.rv-mini--ev::after{content:"Evento";position:absolute;left:0;right:0;bottom:-2px;font-size:.58rem;text-align:center;color:var(--tx-1);background:var(--bg-0);border-radius:0 0 10px 10px}',
    '.rv-s-done .rv-mini,.rv-s-hand .rv-mini{box-shadow:0 0 0 2px var(--color-green,#3CC48A)}',
    '.rv-main{min-width:0}.rv-n{font-weight:650;color:var(--tx-1);font-size:.9rem}.rv-n small{font-weight:500;color:var(--tx-2);margin-left:4px}',
    '.rv-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:3px}',
    '.rv-chip{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;border:1px solid var(--bd-1);border-radius:999px;padding:1px 8px 1px 3px;color:var(--tx-2);background:var(--bg-0)}',
    '.rv-chip img{width:16px;height:16px;border-radius:3px}.rv-chip--cm{padding:1px 8px;color:var(--color-amber,#F2B94B);border-color:color-mix(in srgb,var(--color-amber,#F2B94B) 60%,transparent)}',
    '.rv-dots{display:inline-flex;gap:2px}.rv-dots i{width:6px;height:6px;border-radius:50%;background:var(--bd-2)}.rv-dots i.on{background:var(--rv-mod)}',
    '.rv-state{text-align:right;font-size:.76rem;font-weight:700;white-space:nowrap;color:var(--tx-2)}.rv-state>span{display:block}',
    '.rv-s-done .rv-state>span{color:var(--color-green,#3CC48A)}.rv-s-hand .rv-state>span{color:var(--gn-link,var(--acc-1))}.rv-s-na .rv-state>span,.rv-s-unknown .rv-state>span{font-weight:600}',
    '.rv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '#rvRoot button:focus-visible,#rvRoot [role=tabpanel]:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){#rvRoot *{transition:none!important;animation:none!important}}',
    '@media (max-width:900px){.rv-hero{padding:12px}.rv-ico{width:40px;height:40px;padding:4px}.rv-title h2{font-size:1.05rem}',
    '.rv-pills{margin-left:0;width:100%}.rv-stats{grid-template-columns:1fr 1fr;gap:6px}.rv-st{padding:8px 10px}.rv-st b{font-size:1.05rem}',
    '.rv-wings{grid-template-columns:1fr}.rv-tabs [role=tab],.rv-seg button,.rv-btn{min-height:44px}.rv-enc{grid-template-columns:44px 1fr;padding:10px}',
    '.rv-mini,.rv-mini img{width:44px;height:44px}.rv-state{grid-column:2;text-align:left}.rv-go{display:none}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { cat: null, catP: null, data: null, ui: { tab: 'wings', filter: 'all', exp: 'all' }, voiceKey: null, timer: null, seq: 0 };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function hash() { return String((root.location && root.location.hash) || ''); }
  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }

  function token() {
    try {
      var sel = byId('keySelectGlobal');
      if (sel && sel.value) return String(sel.value).trim();
      var S = storage();
      if (S && S.STORAGE_KEYS) return S.get(S.STORAGE_KEYS.ACCOUNT_SELECTED) || null;
    } catch (e) {}
    return null;
  }

  function loadCatalog() {
    if (st.cat) return Promise.resolve(st.cat);
    if (st.catP) return st.catP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.catP = root.fetch(CATALOG, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('catálogo ' + r.status); return r.json(); })
      .then(function (c) { st.cat = c; return c; })
      .catch(function (e) { st.catP = null; if (root.console) root.console.warn(LOG, 'catálogo', e); return null; });
    return st.catP;
  }

  function settle(p) {
    return Promise.resolve().then(function () { return p(); })
      .then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  // Lee la semana de la cuenta. Cada pedido falla por su lado: lo que llegó se muestra.
  function load(nocache) {
    var mySeq = ++st.seq, tk = token(), A = root.GW2Api, opt = { nocache: !!nocache };
    if (!tk || !A) {
      st.data = { loaded: true, hasToken: false, errors: [] };
      render();
      return Promise.resolve(st.data);
    }
    var fp = fingerprint(tk);
    if (!st.data || st.data.fp !== fp) { st.data = { loaded: false, hasToken: true, fp: fp, errors: [] }; render(); }
    return Promise.all([
      settle(function () { return A.getAccountRaids(tk, opt); }),
      settle(function () { return A.getAccountAchievements(tk, opt); }),
      settle(function () { return A.getAccountWallet(tk, opt); })
    ]).then(function (r) {
      if (mySeq !== st.seq) return st.data;
      var errs = [], perm = ' Revisá que la API Key tenga permiso de progreso.';
      if (!r[0].ok) errs.push('No pude leer tus alas.' + (/forma no soportada/.test(String(r[0].e && r[0].e.message)) ? '' : perm));
      if (!r[1].ok) errs.push('No pude leer tus encuentros.');
      var S = storage();
      st.data = { loaded: true, hasToken: true, fp: fp, errors: errs,
        raids: r[0].ok && Array.isArray(r[0].v) ? r[0].v : null,
        achs: r[1].ok && Array.isArray(r[1].v) ? r[1].v : null,
        wallet: r[2].ok ? r[2].v : null,
        marks: marksFor(S ? S.get(MARKS_KEY) : null, fp, Date.now()) };
      render();
      return st.data;
    });
  }

  function ensureHost(panel) {
    if (!byId('raids-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'raids-view-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var host = byId('rvRoot');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'rvRoot';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
    }
    if (panel.classList) panel.classList.add('rv-on');
    if (panel.setAttribute) panel.setAttribute('aria-labelledby', 'rvTitle');
    return host;
  }

  function focusKey() {
    var a = doc.activeElement;
    if (!a || !a.getAttribute) return null;
    var keys = ['data-rv-tab', 'data-rv-filter', 'data-rv-exp', 'data-rv-mark', 'data-rv-open', 'data-rv'];
    for (var i = 0; i < keys.length; i++) { var v = a.getAttribute(keys[i]); if (v) return '[' + keys[i] + '="' + v + '"]'; }
    return null;
  }

  function render() {
    var panel = byId(PANEL);
    if (!panel || !st.cat) return null;
    var host = ensureHost(panel), now = Date.now();
    var m = buildModel(st.cat, st.data, st.ui);
    st.ui.exp = m.exp;
    var fk = host.contains && host.contains(doc.activeElement) ? focusKey() : null;
    host.innerHTML = viewHTML(m, now);
    st.voiceKey = null;
    renderVoice(m.voice);
    if (fk && host.querySelector) { var b = host.querySelector(fk); if (b && b.focus) b.focus(); }
    return m;
  }

  function renderVoice(msg) {
    var box = byId('rvVoice');
    if (!box) return;
    var key = msg ? msg.key + '|' + msg.text : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text }));
  }

  function tick() {
    var c = byId('rvClock');
    if (c && !isHidden(byId(PANEL))) c.innerHTML = clockHTML(Date.now());
  }

  function mark(id) {
    var S = storage(), d = st.data;
    if (!S || !d || !d.fp) return;
    var next = toggleMark(S.get(MARKS_KEY), d.fp, id, Date.now());
    S.set(MARKS_KEY, next);
    d.marks = marksFor(next, d.fp, Date.now());
    render();
  }

  function actOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = { act: n.getAttribute('data-rv'), tab: n.getAttribute('data-rv-tab'), filter: n.getAttribute('data-rv-filter'),
        exp: n.getAttribute('data-rv-exp'), mark: n.getAttribute('data-rv-mark'), open: n.getAttribute('data-rv-open') };
      if (a.act || a.tab || a.filter || a.exp || a.mark || a.open) return a;
    }
    return null;
  }

  function go(tab) { st.ui.tab = tab === 'enc' ? 'enc' : 'wings'; st.ui.exp = 'all'; return render(); }

  function wire(host) {
    host.addEventListener('click', function (e) {
      var a = actOf(e.target);
      if (!a) return;
      if (a.act === 'refresh') { if (root.toast) root.toast('info', 'Actualizando tu semana de raids…', { ttl: 1500 }); load(true); }
      else if (a.tab) go(a.tab);
      else if (a.filter) { st.ui.filter = a.filter; render(); }
      else if (a.exp) { st.ui.exp = a.exp; render(); }
      else if (a.mark) mark(a.mark);
      else if (a.open && root.RaidsSheet && typeof root.RaidsSheet.open === 'function') root.RaidsSheet.open(a.open);
    });
    // Flechas, Inicio y Fin entre las dos pestañas (patrón tablist).
    host.addEventListener('keydown', function (e) {
      var a = actOf(e.target);
      if (!a || !a.tab) return;
      var to = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? (a.tab === 'wings' ? 'enc' : 'wings') : e.key === 'Home' ? 'wings' : e.key === 'End' ? 'enc' : null;
      if (!to) return;
      if (e.preventDefault) e.preventDefault();
      go(to);
      var b = byId('rvTab-' + to);
      if (b && b.focus) b.focus();
    });
  }

  // El interruptor viejo Raids/Strikes podía esconder este panel: queda fijo en Raids.
  function keepRaidsVisible() {
    var S = storage();
    try { if (S && typeof S.getRaw === 'function' && S.getRaw(VIEW_KEY) !== 'raids') S.set(VIEW_KEY, 'raids'); } catch (e) {}
    var p = byId(PANEL), sp = byId('strikeTrackerPanel');
    if (hash() === '#/account/raids' && p && isHidden(p)) { p.removeAttribute('hidden'); if (sp && sp.setAttribute) sp.setAttribute('hidden', ''); }
  }

  function onShow() {
    if (hash() === '#/account/strikes' && root.location && typeof root.location.replace === 'function') {
      st.ui.tab = 'enc';
      root.location.replace(String(root.location.href).split('#')[0] + '#/account/raids');
      return;
    }
    if (hash() !== '#/account/raids') return;
    keepRaidsVisible();
    loadCatalog().then(function (c) {
      if (!c) return;
      render();
      load(false);
    });
  }

  function init() {
    if (!byId(PANEL)) return;
    keepRaidsVisible();
    if (doc.addEventListener) {
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { st.data = null; setTimeout(onShow, 50); });
    }
    if (root.addEventListener) root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
    if (!st.timer && typeof root.setInterval === 'function') st.timer = root.setInterval(tick, 30000);
    onShow();
  }

  root.RaidsView = {
    version: VERSION, render: render, go: go, refresh: function () { return load(true); },
    getSnapshot: function () { return { cat: st.cat, data: st.data, ui: { tab: st.ui.tab, filter: st.ui.filter, exp: st.ui.exp } }; },
    _pure: { esc: esc, fmtInt: fmtInt, weekStart: weekStart, nextReset: nextReset, countdown: countdown, fingerprint: fingerprint,
      marksFor: marksFor, toggleMark: toggleMark, stateOf: stateOf, buildModel: buildModel, pickVoice: pickVoice, subtitle: subtitle,
      viewHTML: viewHTML, rowHTML: rowHTML, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
