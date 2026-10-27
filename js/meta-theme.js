/*!
 * js/meta-theme.js — Cabecera de Metas y Eventos y mi voz (BL-057, MET-2)
 * v2.2.0 (2026-10-27)
 *
 * v2.2.0 (BL-076 SHV-5d): mi voz dice «Lo sé por»: el horario de metas y, solo si la API respondió, lo que
 *   hiciste hoy. El botón del waypoint va antes de esa línea, así «Lo sé por» queda al final.
 *
 * v2.1.0 (MET-2b): la cabecera vuelve al diseño de la propuesta MET-0, como pidió Pablo.
 *   - Una fila: ícono, «Metas y Eventos», «Horarios en tu hora local · N metas» y, a la derecha,
 *     cuatro botones sutiles: Local, Servidor (UTC), Reset diario y Reset semanal con cuenta
 *     regresiva; el reset que está cerca se resalta en dorado.
 *   - Debajo: «Hoy en tu cuenta» (N de 19 que puedo seguir por la API), barra fina con degradé,
 *     «↻ Actualizar» y «¿Por qué 19?», que explica qué informa la API.
 *   - Mi voz avisa lo que está en curso y cuándo termina, con el nombre en negrita y el waypoint
 *     a un clic. Prioridad: reset cerca con una meta pendiente en curso > fijada que empieza o
 *     está en curso > meta pendiente en curso > lo que está en curso o empieza pronto >
 *     Key sin permiso > día completo.
 * v2.0.0 (MET-2): cabecera nueva sobre Meta.snapshot(); se fue lo de la 1.x.
 * Lee Meta.snapshot() (meta.js 4.x) con gn:meta-rendered. No pide nada a la API ni guarda nada.
 * No toca index.html ni meta.js (LES-028).
 */
(function (root) {
  'use strict';

  var VERSION = '2.2.0';
  var ICON = 'assets/icons/';
  var SOON_RESET_MIN = 60;
  var SOON_WEEK_MIN = 24 * 60;
  var doc = root.document;

  // ---------------------------------------------------------------- reglas puras
  function pad2(n) { return String(n).padStart(2, '0'); }
  function hhmm(d, utc) { return utc ? pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) : pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // «3 d 7 h», «5 h 7 min», «23 min», «40 s».
  function countdown(ms) {
    if (!isFinite(ms) || ms <= 0) return 'ahora';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return d + ' d ' + h + ' h';
    if (h) return h + ' h' + (m ? ' ' + m + ' min' : '');
    if (m) return m + ' min';
    return s + ' s';
  }
  function minsText(m) {
    if (m == null) return '';
    var h = Math.floor(m / 60), r = m % 60;
    return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : m + ' min';
  }
  function nextDailyReset(now) {
    var t = new Date(+now);
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1));
  }
  // Lunes 07:30 UTC.
  function nextWeeklyReset(now) {
    var t = new Date(+now);
    var base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 7, 30);
    var next = base + ((1 - t.getUTCDay() + 7) % 7) * 86400000;
    if (next <= +t) next += 7 * 86400000;
    return new Date(next);
  }
  // Datos de la cabecera en un instante (puro: lo prueba el test).
  function headerData(now) {
    var dMs = +nextDailyReset(now) - +now, wMs = +nextWeeklyReset(now) - +now;
    return { local: hhmm(now, false), server: hhmm(now, true) + ' UTC',
      daily: 'en ' + countdown(dMs), dailySoon: dMs <= SOON_RESET_MIN * 60000,
      weekly: 'en ' + countdown(wMs), weeklySoon: wMs <= SOON_WEEK_MIN * 60000 };
  }
  // Lo hecho hoy, solo con lo que la API sigue. state: ok | loading | noperm | error | none.
  function todayStats(snap) {
    var rows = (snap && snap.rows) || [], st = snap && snap.flags ? snap.flags.state : 'none';
    var tracked = rows.filter(function (r) { return r.tracked; });
    var done = tracked.filter(function (r) { return r.done === true; }).length;
    var wb = tracked.filter(function (r) { return r.type === 'worldboss'; }).length;
    return { state: st, done: done, total: tracked.length, pending: st === 'ok' ? tracked.length - done : null,
      at: snap && snap.flags ? snap.flags.lastHuman : '—', all: rows.length, bosses: wb, chests: tracked.length - wb };
  }
  function todayView(st) {
    var n = st.total || 19;
    if (st.state === 'ok') return { val: st.done + ' de ' + st.total + ' que puedo seguir por la API', pct: st.total ? Math.round(100 * st.done / st.total) : 0 };
    if (st.state === 'loading') return { val: 'Leyendo lo que hiciste hoy…', pct: 0 };
    if (st.state === 'noperm') return { val: 'Tu Key no tiene el permiso «progression»', pct: 0 };
    if (st.state === 'error') return { val: 'No pude leerlo: probá ↻ Actualizar', pct: 0 };
    return { val: 'Elegí una cuenta para ver tus ' + n, pct: 0 };
  }
  function whyText(st) {
    return 'La API de GW2 solo me dice qué jefes del mundo (' + st.bosses + ') y cofres de mapa (' + st.chests + ') hiciste hoy. ' +
      'Las otras ' + Math.max(0, st.all - st.total) + ' metas no las informa: no las marco ni como hechas ni como pendientes.';
  }

  function bold(r) { return { b: r.name }; }
  function wpOf(r) { return r && r.chat ? r.chat : ''; }
  function msg(kind, label, parts, wp) {
    var text = parts.map(function (p) { return typeof p === 'string' ? p : p.b; }).join('');
    return { kind: kind, label: label, parts: parts, text: text, wp: wp || '' };
  }
  var L = { warn: 'Shiruvana advierte', rec: 'Shiruvana recomienda', info: 'Shiruvana te cuenta', expl: 'Shiruvana te explica', hi: 'Shiruvana' };

  // Un solo mensaje mío, por prioridad; null si no hay nada útil para decir.
  function pickVoice(snap, now) {
    if (!snap || !snap.rows) return null;
    var st = todayStats(snap), rows = snap.rows;
    var toReset = Math.ceil((+nextDailyReset(now) - +now) / 60000);
    var byMins = function (a, b) { return a.mins - b.mins; };
    var active = rows.filter(function (r) { return r.state === 'active'; }).sort(byMins);
    var pendingActive = st.state === 'ok' ? active.filter(function (r) { return r.tracked && r.done === false; }) : [];

    if (st.state === 'ok' && st.pending > 0 && toReset <= SOON_RESET_MIN) {
      var c = pendingActive.filter(function (r) { return r.mins <= toReset; })[0] || pendingActive[0];
      if (c) {
        var boss = c.type === 'worldboss';
        var tail = st.pending === 1
          ? (boss ? 'es el último jefe del mundo' : 'es la última meta') + ' que te cuenta para hoy y todavía no ' + (boss ? 'lo' : 'la') + ' hiciste.'
          : 'te quedan ' + st.pending + ' para hoy y esta todavía no la hiciste.';
        return msg('advierte', L.warn, ['Faltan ' + minsText(toReset) + ' para el reset diario. ', bold(c),
          ' está en curso y termina en ' + minsText(c.mins) + ': ' + tail + (wpOf(c) ? ' El waypoint está a un clic.' : '')], wpOf(c));
      }
      return msg('advierte', L.warn, ['Faltan ' + minsText(toReset) + ' para el reset diario y te ' +
        (st.pending === 1 ? 'queda 1 meta' : 'quedan ' + st.pending + ' metas') + ' que la API sigue. Lo que hagas después cuenta para mañana.']);
    }
    var pins = rows.filter(function (r) { return r.pinned && (r.state === 'active' || r.state === 'soon') && r.done !== true; })
      .sort(function (a, b) { return (a.state === 'active' ? 0 : 1) - (b.state === 'active' ? 0 : 1) || a.mins - b.mins; });
    if (pins.length) {
      var p = pins[0];
      return msg('recomienda', L.rec, p.state === 'active'
        ? ['Tu fijada ', bold(p), ' está en curso y termina en ' + minsText(p.mins) + '.' + (wpOf(p) ? ' El waypoint está a un clic.' : '')]
        : ['Tu fijada ', bold(p), ' empieza a las ' + hhmm(new Date(p.start)) + ', en ' + minsText(p.mins) + '.' + (wpOf(p) ? ' El waypoint está a un clic.' : '')], wpOf(p));
    }
    if (pendingActive.length) {
      var q = pendingActive[0];
      return msg('advierte', L.warn, [bold(q), ' está en curso y termina en ' + minsText(q.mins) + '. Hoy todavía no ' +
        (q.type === 'worldboss' ? 'lo' : 'la') + ' hiciste.' + (wpOf(q) ? ' El waypoint está a un clic.' : '')], wpOf(q));
    }
    if (active.length) {
      var a = active[0];
      return msg('explica', L.info, active.length === 1
        ? [bold(a), ' está en curso y termina en ' + minsText(a.mins) + '.' + (wpOf(a) ? ' El waypoint está a un clic.' : '')]
        : ['Hay ' + active.length + ' metas en curso. La que termina primero es ', bold(a), ', en ' + minsText(a.mins) + '.' + (wpOf(a) ? ' El waypoint está a un clic.' : '')], wpOf(a));
    }
    var soon = rows.filter(function (r) { return r.state === 'soon'; }).sort(byMins)[0];
    if (soon) {
      return msg('explica', L.info, ['En ' + minsText(soon.mins) + ' empieza ', bold(soon), ' (' + hhmm(new Date(soon.start)) + ').' +
        (wpOf(soon) ? ' El waypoint está a un clic.' : '')], wpOf(soon));
    }
    if (st.state === 'noperm') {
      return msg('explica', L.expl, ['Tu API Key no tiene el permiso «progression», así que no puedo saber qué hiciste hoy. Los horarios funcionan igual; si querés ver tu avance, creá una Key con ese permiso.']);
    }
    if (st.state === 'ok' && st.total && st.pending === 0) {
      return msg('saluda', L.hi, ['Hiciste hoy las ' + st.total + ' metas que la API puede seguir. Día completo: el próximo reset es a las ' + hhmm(nextDailyReset(now)) + '.']);
    }
    return null;
  }

  // ---------------------------------------------------------------- dibujo
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function pillHTML(key, icon, label, tip) {
    return '<div class="mh-pill" data-mh-pill="' + key + '" title="' + esc(tip) + '"><img src="' + ICON + icon + '" width="22" height="22" alt="">' +
      '<span>' + esc(label) + '</span><b id="mh-' + key + '">—</b></div>';
  }
  function headHTML() {
    return '<div class="mh-top"><div class="mh-hico"><img src="' + ICON + '102420.png" width="34" height="34" alt=""></div>' +
      '<div class="mh-htx"><div class="mh-h2slot"></div><div class="mh-sub"><span class="mh-subtx">Horarios en tu hora local</span></div></div>' +
      '<div class="mh-pills">' +
        pillHTML('local', '841720.png', 'Local', 'Tu hora local') +
        pillHTML('server', '460028.png', 'Servidor', 'Hora del servidor (UTC)') +
        pillHTML('daily', '534745.png', 'Reset diario', 'Todos los días a las 00:00 UTC') +
        pillHTML('weekly', '155064.png', 'Reset semanal', 'Los lunes a las 07:30 UTC') +
      '</div></div>' +
      '<div class="mh-today"><div class="mh-tl"><b>Hoy en tu cuenta</b><span id="mhToday">—</span></div>' +
        '<div class="mh-bar" role="progressbar" aria-label="Hoy en tu cuenta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="mhTodayBar"></i></div>' +
        '<button type="button" class="mh-btn" data-mh-refresh="1" title="Volver a leer qué hiciste hoy">↻ Actualizar</button>' +
        '<button type="button" class="mh-why" data-mh-why="1" aria-expanded="false" aria-controls="mhWhy">¿Por qué 19?</button>' +
      '</div><p class="mh-whytx" id="mhWhy" hidden></p>';
  }

  var S = { panel: null, head: null, timer: null, voiceKey: null, snap: null };
  function $(s, r) { return (r || doc).querySelector(s); }
  function byId(id) { return doc.getElementById(id); }
  function setText(id, v) { var n = byId(id); if (n && n.textContent !== v) n.textContent = v; }

  function onHeadClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-mh-refresh]')) { if (root.Meta && typeof root.Meta.refresh === 'function') root.Meta.refresh({ nocache: true }); return; }
    var w = t.closest('[data-mh-why]');
    if (w) {
      var box = byId('mhWhy'); if (!box) return;
      var open = box.hidden;
      box.hidden = !open; w.setAttribute('aria-expanded', String(open));
    }
  }
  function ensureHead() {
    var panel = $('#metaPanel');
    if (!panel) return null;
    if (panel.classList.contains('mh-ready')) return panel;
    var h2 = $('#metaTitle', panel), status = $('#metaStatus', panel);
    panel.classList.add('mh-ready');
    var head = doc.createElement('div');
    head.className = 'mh-head';
    head.innerHTML = headHTML();
    panel.insertBefore(head, panel.firstChild);
    if (h2) { h2.textContent = 'Metas y Eventos'; $('.mh-h2slot', head).appendChild(h2); }
    if (status) { status.classList.add('mh-status'); $('.mh-sub', head).appendChild(status); }
    head.addEventListener('click', onHeadClick);
    S.panel = panel; S.head = head;
    return panel;
  }

  function tickClocks() {
    var d = headerData(new Date());
    setText('mh-local', d.local);
    setText('mh-server', d.server);
    setText('mh-daily', d.daily);
    setText('mh-weekly', d.weekly);
    var h = S.head;
    if (h) {
      var dp = $('[data-mh-pill="daily"]', h), wp = $('[data-mh-pill="weekly"]', h);
      if (dp) dp.classList.toggle('is-soon', d.dailySoon);
      if (wp) wp.classList.toggle('is-soon', d.weeklySoon);
    }
  }
  function renderToday(snap) {
    var st = todayStats(snap), v = todayView(st);
    setText('mhToday', v.val);
    var bar = byId('mhTodayBar'); if (bar) bar.style.width = v.pct + '%';
    var pb = bar && bar.parentNode; if (pb && pb.setAttribute) pb.setAttribute('aria-valuenow', String(v.pct));
    if (snap && snap.rows && snap.rows.length) {
      setText('mhWhy', whyText(st));
      var why = S.head && $('[data-mh-why]', S.head); if (why) why.textContent = '¿Por qué ' + st.total + '?';
      var sub = S.head && $('.mh-subtx', S.head); if (sub) sub.textContent = 'Horarios en tu hora local · ' + st.all + ' metas';
    }
    var status = byId('metaStatus');
    if (status) status.hidden = /^Listo\.?$/.test(String(status.textContent || '').trim());
  }
  function copyWp(btn, wp) {
    var ok = function () { btn.textContent = '✓ Copiado'; setTimeout(function () { btn.textContent = 'Copiar waypoint ' + wp; }, 1500); };
    try { if (root.navigator && root.navigator.clipboard) root.navigator.clipboard.writeText(wp).then(ok, function () {}); } catch (_) {}
  }
  // SHV-5d: de dónde lo sé. Lo de tu día solo si la API respondió; los horarios son los del juego.
  function basisOf() {
    return (todayStats(S.snap).state === 'ok' ? 'el horario de metas y lo que hiciste hoy (API oficial)' : 'el horario de metas del juego') + ' · en este navegador';
  }
  // Mi mensaje: el componente oficial (Shiruvana.voice) con el nombre en negrita y el waypoint a un clic.
  function voiceEl(m) {
    var el = root.Shiruvana.voice({ kind: m.kind, text: '', basis: basisOf() });
    var label = el.querySelector && el.querySelector('.shv-voice__label'); if (label) label.textContent = m.label;
    if (el.setAttribute) el.setAttribute('aria-label', m.label);
    var p = el.querySelector && el.querySelector('.shv-voice__body p');
    if (p) {
      p.textContent = '';
      m.parts.forEach(function (x) {
        if (typeof x === 'string') p.appendChild(doc.createTextNode(x));
        else { var b = doc.createElement('b'); b.textContent = x.b; p.appendChild(b); }
      });
    }
    if (m.wp) {
      var btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'mh-vbtn'; btn.textContent = 'Copiar waypoint ' + m.wp;
      btn.addEventListener('click', function () { copyWp(btn, m.wp); });
      var main = el.querySelector && el.querySelector('.shv-voice__main'), bs = el.querySelector && el.querySelector('.shv-voice__basis');
      if (bs && bs.parentNode && bs.parentNode.insertBefore) bs.parentNode.insertBefore(btn, bs); else (main || el).appendChild(btn);
    }
    return el;
  }
  function renderVoice(snap) {
    var host = byId('mtVoice'); if (!host) return;
    var m = pickVoice(snap, new Date());
    var key = m ? m.kind + '|' + m.text + '|' + m.wp : null;
    if (key === S.voiceKey && (host.firstChild || !m)) return;
    S.voiceKey = key;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (m && root.Shiruvana && typeof root.Shiruvana.voice === 'function') host.appendChild(voiceEl(m));
  }
  function onRendered() {
    if (!ensureHead()) return;
    var snap = root.Meta && typeof root.Meta.snapshot === 'function' ? root.Meta.snapshot() : null;
    S.snap = snap;
    renderToday(snap);
    renderVoice(snap);
    tickClocks();
    startClock();
  }
  function visible() { var p = S.panel || $('#metaPanel'); return !!(p && !p.hasAttribute('hidden') && !doc.hidden); }
  function startClock() {
    if (S.timer) return;
    S.timer = setInterval(function () { if (visible()) tickClocks(); }, 1000);
  }

  // ---------------------------------------------------------------- estilos (propuesta MET-0, lenguaje de la Cartera)
  var CSS = [
    '#metaPanel.mh-ready{padding:0}',
    '#metaPanel.mh-ready>.panel__body{padding:18px 24px 22px}',
    '#metaPanel.mh-ready .panel__body>.panel-head,#metaPanel.mh-ready #mtFlags{display:none}',
    '.mh-head{border-bottom:1px solid var(--bd-1);border-radius:var(--radius-lg,12px) var(--radius-lg,12px) 0 0;overflow:hidden;background:linear-gradient(180deg,var(--glow-base,rgba(168,150,255,.08)),transparent)}',
    '.mh-top{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px;padding:20px 24px}',
    '.mh-hico{width:56px;height:56px;border-radius:14px;background:var(--bg-0);display:grid;place-items:center;box-shadow:0 0 0 1px var(--bd-1),0 6px 18px rgba(0,0,0,.25);flex-shrink:0}',
    '.mh-htx{min-width:0}.mh-top h2,.mh-top .panel__title{margin:0;font-size:1.45rem;font-weight:800;line-height:1.2;padding:0;border:0;background:none;display:block;color:var(--tx-1)}',
    '.mh-top .panel__title img{display:none}',
    '.mh-sub{color:var(--tx-3);font-size:.9rem;margin-top:2px}.mh-sub .mh-status{display:inline;margin:0 0 0 8px;font-size:.85rem}',
    '.mh-pills{margin-left:auto;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}',
    '.mh-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--bd-1);border-radius:10px;background:rgba(255,255,255,.02);color:var(--tx-3);font-size:.9rem;white-space:nowrap}',
    '.mh-pill img{width:22px;height:22px;opacity:.9}',
    '.mh-pill b{color:var(--tx-1);font-weight:700;font-variant-numeric:tabular-nums}',
    '.mh-pill.is-soon{border-color:var(--gn-gold);background:rgba(242,185,75,.06)}.mh-pill.is-soon b{color:var(--gn-gold)}',
    '.mh-today{display:flex;flex-wrap:wrap;align-items:center;gap:12px 22px;padding:14px 24px;border-top:1px solid var(--bd-1)}',
    '.mh-tl{display:grid;gap:2px;min-width:0}.mh-tl b{font-size:.95rem;color:var(--tx-1)}.mh-tl span{font-size:.9rem;color:var(--tx-3)}',
    '.mh-bar{flex:1 1 220px;max-width:500px;height:8px;border-radius:999px;background:var(--bg-2);overflow:hidden}',
    '.mh-bar i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--acc-1),var(--color-green));transition:width .4s ease}',
    '.mh-btn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--bd-1);color:var(--tx-1);border-radius:10px;padding:8px 14px;font:inherit;font-size:.9rem;cursor:pointer}',
    '.mh-btn:hover{border-color:var(--acc-1)}',
    '.mh-why{background:none;border:0;padding:0;color:var(--acc-1);font:inherit;font-size:.9rem;text-decoration:underline;cursor:pointer}',
    '.mh-whytx{margin:0;padding:0 24px 14px;font-size:.85rem;color:var(--tx-2);max-width:900px}',
    '.mh-btn:focus-visible,.mh-why:focus-visible,.mh-vbtn:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '#metaPanel.mh-ready .mt-voice .shv-voice{margin:0 0 8px;padding:14px 18px;border:1px solid var(--bd-2);border-radius:14px;background:var(--bg-1);align-items:center}',
    '#metaPanel.mh-ready .mt-voice .shv-voice__avatar{width:56px;height:56px}',
    '#metaPanel.mh-ready .mt-voice .shv-voice__label{color:var(--acc-1)}',
    '#metaPanel.mh-ready .mt-voice .shv-voice__body p{font-size:.98rem;color:var(--tx-1)}.mt-voice .shv-voice__body b{font-weight:700}',
    '#metaPanel.mh-ready .mt-voice .shv-voice--advierte{border-color:rgba(242,185,75,.45);background:linear-gradient(90deg,rgba(242,185,75,.06),var(--bg-1) 40%)}',
    '#metaPanel.mh-ready .mt-voice .shv-voice--advierte .shv-voice__label{color:var(--gn-gold)}',
    '#metaPanel.mh-ready .mt-voice .shv-voice--advierte .shv-voice__avatar{box-shadow:0 0 0 2px var(--gn-gold)}',
    '.mh-vbtn{justify-self:start;margin-top:4px;background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:999px;padding:4px 12px;font:inherit;font-size:.8rem;cursor:pointer}',
    '.mh-vbtn:hover{border-color:var(--acc-1);color:var(--tx-1)}',
    '@media (max-width:980px){.mh-pills{margin-left:0;justify-content:flex-start;width:100%}}',
    '@media (max-width:720px){.mh-top,.mh-today{padding-left:12px;padding-right:12px}.mh-whytx{padding:0 12px 12px}#metaPanel.mh-ready>.panel__body{padding:14px 12px}.mh-pill{padding:7px 10px;font-size:.84rem}.mh-btn,.mh-vbtn{min-height:40px}.mh-bar{max-width:none}}',
    '@media (prefers-reduced-motion:reduce){.mh-bar i{transition:none}}'
  ].join('\n');
  function injectCSS() {
    if (doc.getElementById('mh-style')) return;
    var s = doc.createElement('style'); s.id = 'mh-style'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function init() {
    injectCSS();
    doc.addEventListener('gn:meta-rendered', onRendered);
    doc.addEventListener('gn:tabchange', function (ev) {
      if (ev && ev.detail && ev.detail.view === 'meta' && ensureHead()) { tickClocks(); startClock(); }
    });
    if (visible() && ensureHead()) { tickClocks(); startClock(); }
  }

  root.MetaTheme = {
    version: VERSION,
    refresh: onRendered,
    _pure: { countdown: countdown, minsText: minsText, nextDailyReset: nextDailyReset, nextWeeklyReset: nextWeeklyReset, headerData: headerData,
      todayStats: todayStats, todayView: todayView, whyText: whyText, pickVoice: pickVoice, headHTML: headHTML }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
