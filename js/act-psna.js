/*!
 * js/act-psna.js — Actividades, pestaña Hoy: el PSNA, los 6 agentes de la Red de Suministros del Pacto (BL-070, ACT-7)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25) — ACT-7: el PSNA deja de vivir en js/activities.js y pasa a la vista nueva
 *
 * Lo mismo que hacía el PSNA de siempre (BL-013, BL-044 y BL-048), con las mismas funciones puras:
 *  - Los 6 lugares del día salen de assets/data/psna-schedule.json (rotación por día de la semana, verificada con
 *    la wiki oficial; cambia a las 08:00 UTC: antes de esa hora valen los del día anterior). Si el archivo no se
 *    puede leer, lo digo («sin datos»): nunca muestro un día equivocado.
 *  - De qué día son, cuánto falta para el cambio en tu hora y el botón «Copiar» con el código de cada punto de
 *    ruta para el chat del juego, más «Copiar los 6».
 * js/act-view.js me pide la tarjeta con ActPsna.html() y me pasa los clics. No guardo nada en el navegador.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[ActPsna]';
  var DATA_URL = 'assets/data/psna-schedule.json';
  var WP_ICON = 'assets/icons/733330.png';
  var REGIONS = ['Maguuma Wastes', 'Maguuma Jungle', 'Ruins of Orr', 'Kryta', 'Shiverpeaks', 'Ascalon'];
  var NPCS = ['Mehem the Traveled', 'The Fox', 'Specialist Yana', 'Lady Derwena', 'Despina Katelyn', 'Verma Giftrender'];

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // PSNA-DAY:BEGIN — funciones puras, las de js/activities.js 3.23.0 sin cambios (BL-013, BL-044, BL-048)
  // Devuelve { date, weekday, waypoints, source } con los 6 lugares vigentes en
  // `now`, o null si no hay datos. La ubicacion cambia a las 08:00 UTC (o
  // data.resetUtcHour): antes de esa hora vale el dia anterior.
  // Orden: rotacion semanal -> fecha exacta en schedule -> mismo dia de la
  // semana en schedule. Nunca devuelve el dia equivocado.
  var PSNA_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function psnaPickDay(data, now) {
    if (!data || !now || isNaN(now.getTime())) return null;
    var hour = typeof data.resetUtcHour === 'number' ? data.resetUtcHour : 8;
    var t = new Date(now.getTime() - hour * 3600000);
    var key = t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
    var wd = PSNA_WEEKDAYS[t.getUTCDay()];
    function six(w) { return Array.isArray(w) && w.length === 6 ? w : null; }
    function out(w, source) { return { date: key, weekday: wd, waypoints: w, source: source }; }
    if (data.rotation && six(data.rotation[wd])) return out(data.rotation[wd], 'rotation');
    var list = Array.isArray(data.schedule) ? data.schedule : [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].date === key && six(list[i].waypoints)) return out(list[i].waypoints, 'date');
    }
    for (i = 0; i < list.length; i++) {
      var d = list[i] && list[i].date ? new Date(list[i].date + 'T12:00:00Z') : null;
      if (d && !isNaN(d.getTime()) && PSNA_WEEKDAYS[d.getUTCDay()] === wd && six(list[i].waypoints)) return out(list[i].waypoints, 'weekday');
    }
    return null;
  }

  // Proximo cambio de ubicacion (Date) despues de `now`, o null.
  function psnaNextChange(data, now) {
    if (!now || isNaN(now.getTime())) return null;
    var hour = (data && typeof data.resetUtcHour === 'number') ? data.resetUtcHour : 8;
    var n = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    if (n.getTime() <= now.getTime()) n = new Date(n.getTime() + 86400000);
    return n;
  }

  // Texto para el jugador: de que dia son los lugares y cuanto falta para el cambio.
  // Ej.: "Lugares del miércoles 21/10 · cambian en 3 h 05 min (08:00 UTC)".
  var PSNA_DIAS_ES = { sunday: 'domingo', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
    thursday: 'jueves', friday: 'viernes', saturday: 'sábado' };
  // Cuanto falta para `next`: "9 h 05 min" o "45 min" ('' si no hay datos).
  function psnaFalta(next, now) {
    if (!next || !now) return '';
    var min = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60000));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min';
  }
  function psnaDayText(day, next, now) {
    if (!day || !day.date) return '';
    var p = day.date.split('-');
    var txt = 'Lugares del ' + (PSNA_DIAS_ES[day.weekday] || day.weekday) + ' ' + p[2] + '/' + p[1];
    if (next && now) {
      txt += ' · cambian en ' + psnaFalta(next, now) +
        ' (' + String(next.getUTCHours()).padStart(2, '0') + ':00 UTC)';
    }
    return txt;
  }
  // PSNA-DAY:END

  function label(x, i, fb) { return typeof x === 'string' ? x : (x && (x.es || x.name)) || fb[i] || ''; }

  /** Los 6 lugares de `now`: [{ name, code, npc, region }] y el texto del día. state: 'ok' | 'loading' | 'error'. */
  function buildModel(data, now, state) {
    var t = now instanceof Date ? now : new Date(now);
    var m = { state: state || (data ? 'ok' : 'loading'), rows: [], day: null, next: null, falta: '', text: '', valid: 0 };
    if (!data) return m;
    var day = psnaPickDay(data, t);
    m.next = psnaNextChange(data, t);
    m.falta = psnaFalta(m.next, t);
    if (!day) { m.state = 'empty'; return m; }
    m.day = day;
    m.text = psnaDayText(day, m.next, t);
    var regions = Array.isArray(data.regions) ? data.regions : [], npcs = Array.isArray(data.npcs) ? data.npcs : [];
    m.rows = day.waypoints.map(function (w, i) {
      var name = w && typeof w === 'object' ? w.name : String(w || ''), code = w && typeof w === 'object' ? (w.code || '') : '';
      return { name: name, code: code, npc: label(npcs[i], i, NPCS), region: label(regions[i], i, REGIONS) };
    });
    m.valid = m.rows.filter(function (r) { return r.code; }).length;
    return m;
  }

  function cardHTML(m, copied) {
    var h = '<section class="av-card ap-card" aria-labelledby="apT"><div class="av-card-h"><h3 id="apT">PSNA · Agentes de la Red de Suministros del Pacto</h3>' +
      '<small>6 agentes, cambian de lugar todos los días a las 08:00 UTC</small></div>';
    if (m.state === 'loading') return h + '<p class="av-note" role="status">Leyendo los lugares de hoy…</p></section>';
    if (m.state === 'error') return h + '<p class="av-note" role="status">Sin datos: no pude leer los lugares del PSNA. Probá con «Actualizar».</p></section>';
    if (m.state === 'empty' || !m.day) return h + '<p class="av-note" role="status">Sin datos de los lugares de hoy: no muestro un día equivocado.</p></section>';
    var p = m.day.date.split('-'), dia = PSNA_DIAS_ES[m.day.weekday] || m.day.weekday;
    var hora = m.next ? String(m.next.getHours()).padStart(2, '0') + ':' + String(m.next.getMinutes()).padStart(2, '0') : '';
    h += '<div class="ap-day" role="group" aria-label="' + esc(m.text) + '"><div><small>Lugares del día</small><b>' +
      esc(dia.charAt(0).toUpperCase() + dia.slice(1)) + ' ' + p[2] + '/' + p[1] + '</b></div>' +
      (m.next ? '<div><small>Cambian en</small><b id="apFalta">' + esc(m.falta) + '</b><em>08:00 UTC · ' + esc(hora) + ' tu hora</em></div>' : '') +
      '<button type="button" class="av-btn" data-ap-all="1"' + (m.valid ? '' : ' disabled') + '>' + (copied === 'all' ? 'Copiados' : 'Copiar los ' + m.valid) + '</button></div><ul class="ap-wps">';
    m.rows.forEach(function (r, i) {
      var on = !!r.code, done = copied === i;
      h += '<li><button type="button" class="ap-wp" data-ap-copy="' + i + '"' + (on ? '' : ' disabled') +
        ' aria-label="' + esc((on ? 'Copiar el punto de ruta de ' : 'Sin código: ') + r.name) + '">' +
        '<img src="' + WP_ICON + '" alt="" width="32" height="32" loading="lazy"><span class="ap-nm"><b>' + esc(r.name) + '</b><small>' +
        esc(r.npc) + ' · ' + esc(r.region) + '</small></span><span class="av-badge' + (done ? ' av-badge--ok' : on ? '' : ' av-badge--nd') + '">' +
        (done ? 'Copiado' : on ? 'Copiar' : 'Sin código') + '</span></button></li>';
    });
    return h + '</ul><p class="av-note" id="apSay" role="status" aria-live="polite">' + (copied === 'all' ? 'Copié los ' + m.valid + ' códigos: pegalos en el chat del juego.' : copied != null ? 'Copié el código: pegalo en el chat del juego.' : '') + '</p>' +
      '<p class="av-note">Rotación por día de la semana: wiki oficial («Pact Supply Network Agent»), verificada el 2026-10-21. Los nombres de los lugares, como los trae la wiki.</p></section>';
  }

  var CSS = [
    '.ap-day{display:flex;align-items:center;gap:10px 24px;flex-wrap:wrap;border:1px solid var(--bd-1);border-left:4px solid var(--av-mod,#3CC48A);border-radius:10px;background:var(--bg-0);padding:10px 14px;margin-bottom:10px}',
    '.ap-day small{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--tx-2)}',
    '.ap-day b{font-size:1.15rem;color:var(--tx-1);font-variant-numeric:tabular-nums}.ap-day em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2)}',
    '.ap-day .av-btn{margin-left:auto}',
    '.ap-wps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}',
    '.ap-wp{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 10px;text-align:left;font:inherit;color:var(--tx-1);background:var(--bg-0);border:1px solid var(--bd-1);border-radius:10px;cursor:pointer;box-sizing:border-box}',
    '.ap-wp:hover:not(:disabled){border-color:var(--acc-1)}.ap-wp:disabled{cursor:not-allowed}.ap-wp:disabled img{opacity:.55}',
    '.ap-wp:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '.ap-wp img{width:32px;height:32px;flex-shrink:0}',
    '.ap-nm{flex:1;min-width:0}.ap-nm b{display:block;font-size:.9rem;color:var(--tx-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ap-nm small{display:block;font-size:.74rem;color:var(--tx-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#apSay:empty{display:none}',
    '@media (max-width:900px){.ap-wps{grid-template-columns:1fr}.ap-day .av-btn{margin-left:0;min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado
  var doc = root.document;
  var st = { data: null, p: null, err: false, copied: null, dayKey: null, t: null };

  function repaint() { if (root.ActView && typeof root.ActView.render === 'function') root.ActView.render(); }
  function ensureCss() {
    if (!doc || !doc.getElementById || doc.getElementById('act-psna-css') || !doc.createElement) return;
    var s = doc.createElement('style'); s.id = 'act-psna-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function load() {
    if (st.data || st.p || typeof root.fetch !== 'function') return st.p;
    st.p = root.fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('datos ' + r.status); return r.json(); })
      .then(function (d) { st.data = d; st.err = false; }, function (e) { st.err = true; if (root.console) root.console.warn(LOG, 'datos', e && e.message); })
      .then(function () { st.p = null; repaint(); });
    return st.p;
  }
  function model(now) {
    var t = new Date(now == null ? Date.now() : now);
    var m = buildModel(st.data, t, st.data ? 'ok' : st.err ? 'error' : 'loading');
    st.dayKey = m.day ? m.day.date : null;
    return m;
  }

  /** La tarjeta para la pestaña Hoy (la llama act-view en cada dibujo). */
  function html() {
    ensureCss();
    if (!st.data && !st.err) load();
    return cardHTML(model(), st.copied);
  }

  /** Lo llama el reloj de act-view: actualiza la cuenta regresiva y, si cambió el día, avisa para redibujar. */
  function tick(now) {
    if (!st.data) return false;
    var m = buildModel(st.data, new Date(now == null ? Date.now() : now));
    var n = doc && doc.getElementById ? doc.getElementById('apFalta') : null;
    if (n) n.textContent = m.falta;
    return !!(m.day && st.dayKey && m.day.date !== st.dayKey);
  }

  function copy(text, what) {
    var done = function () {
      st.copied = what; repaint();
      if (st.t && root.clearTimeout) root.clearTimeout(st.t);
      st.t = root.setTimeout ? root.setTimeout(function () { st.copied = null; st.t = null; repaint(); }, 2000) : null;
    };
    var nav = root.navigator, cb = nav && nav.clipboard;
    if (cb && typeof cb.writeText === 'function') {
      return cb.writeText(text).then(done, function () { if (root.toast) root.toast('error', 'No pude copiar: copialo a mano, ' + text); });
    }
    if (root.toast) root.toast('info', text);
    return Promise.resolve();
  }
  function attr(t, k) {
    for (var n = t, i = 0; n && i < 5; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(k) != null) return n.getAttribute(k);
    return null;
  }
  /** Devuelve true si el clic era mío. */
  function onClick(e) {
    var t = e && e.target, one = attr(t, 'data-ap-copy'), all = attr(t, 'data-ap-all');
    if (one == null && all == null) return false;
    var m = model();
    if (all != null) {
      var codes = m.rows.filter(function (r) { return r.code; }).map(function (r) { return r.code; });
      if (codes.length) copy(codes.join(' '), 'all');
      return true;
    }
    var r = m.rows[Number(one)];
    if (r && r.code) copy(r.code, Number(one));
    return true;
  }
  function refresh() { if (st.err) { st.err = false; load(); } }

  root.ActPsna = {
    version: VERSION, html: html, tick: tick, onClick: onClick, refresh: refresh,
    _pure: { esc: esc, psnaPickDay: psnaPickDay, psnaNextChange: psnaNextChange, psnaFalta: psnaFalta, psnaDayText: psnaDayText,
      buildModel: buildModel, cardHTML: cardHTML, CSS: CSS, DATA_URL: DATA_URL, WP_ICON: WP_ICON }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
