/*!
 * js/gn-kit.js — Piezas comunes de la Bóveda: el reloj y los íconos (BL-078, UNI-1)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.4.0 (2026-10-29) — BUI-4b: las 4 pestañas de Builds (Biblioteca, Editor, Mis builds, Importar), elegidas por Pablo
 *   · antes 1.3.0 (2026-10-28) — UNI-7b: las 4 pestañas que faltaban (Cuentas y la ficha de Raids), elegidas por Pablo
 *   · antes 1.2.0 (2026-10-28) — UNI-6b: Ayuda del menú Enlaces con el ícono de «Primeros pasos» (Welcome/102367), elegido por
 *   Pablo; Foros y Sitio oficial siguen con el mismo 156384 por su elección · antes 1.1.0 (2026-10-28) — UNI-4b: el mapa de íconos con la elección de Pablo (todas las claves elegidas); el ícono va con
 *   margen a la derecha para pestañas e indicadores · antes 1.0.1 (2026-10-27) — UNI-2: lo carga js/modules.json antes de quien lo usa; lo usan Metas (meta-theme.js 2.3.0) y Raids
 *   (raids-view.js 1.4.0). · antes 1.0.0 (2026-10-27) — inerte.
 *
 * Propuesta UNI-0 aprobada por Pablo (2026-10-27 22:53Z, D1 a D6 como recomendé):
 *  - El reloj común (D1, opción C): nace del de Metas. Ícono del juego, el nombre arriba y el valor abajo, y dorado
 *    cuando está cerca: menos de 1 h para el reset diario y el PSNA, menos de 24 h para el semanal (la regla de Metas).
 *    Compacto en las cabeceras y grande en Metas. Al pasar el mouse, la hora fija («Los lunes a las 07:30 UTC»).
 *    Un solo temporizador para toda la Bóveda: start() lo prende y se apaga solo si no queda ningún reloj a la vista.
 *  - Los íconos (D3): un mapa por clave (GNKit.icon('tab.raids.alas')). Cada entrada dice si la Bóveda ya usa ese ícono
 *    con ese mismo significado (ok) o si es una propuesta para que Pablo la mire; las que faltan quedan en null y no dibujan nada.
 * Solo dibuja: no pide nada a la API ni guarda nada. Sin este archivo, los módulos se ven como hoy.
 */
(function (root) {
  'use strict';

  var VERSION = '1.4.0';
  var DIR = 'assets/icons/';
  var MIN = 60000, HOUR = 3600000, DAY = 86400000;

  // ------------------------------------------------------------------ relojes
  var CLOCKS = {
    local: { label: 'Local', icon: '841720.png', fixed: 'Tu hora local' },
    server: { label: 'Servidor', icon: '460028.png', fixed: 'Hora del servidor (UTC)' },
    daily: { label: 'Reset diario', icon: '534745.png', soon: HOUR, fixed: 'Todos los días a las 00:00 UTC' },
    psna: { label: 'PSNA', icon: '1302773.png', soon: HOUR, fixed: 'El PSNA cambia todos los días a las 08:00 UTC' },
    weekly: { label: 'Reset semanal', icon: '155064.png', soon: DAY, fixed: 'Los lunes a las 07:30 UTC' }
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(t, utc) {
    var d = new Date(t);
    return utc ? pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) : pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function at(now, h, m) { var d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m || 0); }
  // Próximo 00:00 UTC, próximo 08:00 UTC (PSNA) y próximo lunes 07:30 UTC.
  function nextDaily(now) { return at(now, 0) + DAY; }
  function nextPsna(now) { var t = at(now, 8); return t > now ? t : t + DAY; }
  function nextWeekly(now) {
    var t = at(now, 7, 30) + ((1 - new Date(now).getUTCDay() + 7) % 7) * DAY;
    return t > now ? t : t + 7 * DAY;
  }
  // «3 d 7 h», «5 h 7 min», «5 h», «23 min», «menos de 1 min» (como Metas).
  function left(ms) {
    var m = Math.floor(Math.max(0, Number(ms) || 0) / MIN);
    if (m < 1) return 'menos de 1 min';
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), r = m % 60;
    if (d) return d + ' d ' + h + ' h';
    if (h) return h + ' h' + (r ? ' ' + r + ' min' : '');
    return r + ' min';
  }
  var NEXT = { daily: nextDaily, psna: nextPsna, weekly: nextWeekly };

  // Lo que dice un reloj en un instante: { kind, label, text, soon, title, icon }. null si no existe.
  function value(kind, now) {
    var c = CLOCKS[kind];
    if (!c) return null;
    now = Number(now);
    var out = { kind: kind, label: c.label, icon: DIR + c.icon, title: c.fixed, soon: false };
    if (kind === 'local') out.text = hhmm(now, false);
    else if (kind === 'server') out.text = hhmm(now, true) + ' UTC';
    else { var ms = NEXT[kind](now) - now; out.text = 'en ' + left(ms); out.soon = ms <= c.soon; }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Un reloj. opts.big: la versión grande (Metas).
  function clockHTML(kind, now, opts) {
    var v = value(kind, now);
    if (!v) return '';
    var big = !!(opts && opts.big), s = big ? 24 : 20;
    return '<span class="gk' + (big ? ' gk--big' : '') + (v.soon ? ' is-soon' : '') + '" data-gk="' + kind + '"' + (big ? ' data-gk-big="1"' : '') +
      ' title="' + esc(v.title) + '"><img src="' + esc(v.icon) + '" width="' + s + '" height="' + s + '" alt=""><span class="gk__t"><small>' +
      esc(v.label) + '</small><b>' + esc(v.text) + '</b></span></span>';
  }
  // Varios relojes, en el orden pedido.
  function clocksHTML(kinds, now, opts) {
    return '<span class="gk-row" role="group" aria-label="Relojes">' + (kinds || []).map(function (k) { return clockHTML(k, now, opts); }).join('') + '</span>';
  }

  // ------------------------------------------------------------------ íconos
  // ok: la Bóveda ya usa este ícono con este mismo significado. false: propuesta para que la mire Pablo. src null: falta elegir.
  // Elegidos por Pablo el 2026-10-28 (docs/propuestas/uni4-iconos.html). ok: elegido o ya en uso; false: propuesta mía.
  var ICONS = {
    'clock.local': { src: '841720.png', ok: true },
    'clock.server': { src: '460028.png', ok: true },
    'clock.daily': { src: '534745.png', ok: true },
    'clock.weekly': { src: '155064.png', ok: true },
    'clock.psna': { src: '1302773.png', ok: false, nota: 'el de Actividades; el PSNA no tiene uno propio en la Bóveda' },
    'tab.raids.alas': { src: 'raids/raid-icon.png', ok: true },
    'tab.raids.encuentros': { src: '784370.png', ok: true },
    'tab.act.hoy': { src: '534745.png', ok: true },
    'tab.act.semana': { src: '155064.png', ok: true },
    'tab.home.nodos': { src: 'Welcome/3380755.png', ok: true },
    'tab.home.glifos': { src: '1228929.png', ok: true },
    'tab.home.decoraciones': { src: '156016.png', ok: true },
    'tab.wv.objetivos': { src: '3172791.png', ok: true },
    'tab.wv.tienda': { src: '3594051.png', ok: true },
    'tab.wv.cuentas': { src: '578844.png', ok: true },
    'tab.ach.cerca': { src: '155059.png', ok: true },
    'tab.ach.categorias': { src: 'Welcome/1013045.png', ok: true },
    'tab.ach.legendarias': { src: 'Cuentas/157085.png', ok: true },
    'tab.inv.multi': { src: '578844.png', ok: true },
    'tab.inv.buscar': { src: 'Welcome/3124974.png', ok: true },
    'tab.inv.materiales': { src: '866124.png', ok: true },
    'tab.inv.banco': { src: 'Welcome/1228903.png', ok: true },
    'tab.inv.armeria': { src: '1228891.png', ok: true },
    'tab.inv.personajes': { src: 'Cuentas/156409.png', ok: true },
    'tab.acc.mias': { src: '578844.png', ok: true },
    'tab.acc.llavero': { src: 'Cuentas/LLave.png', ok: true },
    'tab.rs.recompensas': { src: 'Cuentas/255373.png', ok: true },
    'tab.rs.pelea': { src: '784370.png', ok: true },
    'tab.bld.lib': { src: '1228891.png', ok: true },
    'tab.bld.editor': { src: '63127.png', ok: true },
    'tab.bld.mine': { src: 'Cuentas/255373.png', ok: true },
    'tab.bld.import': { src: '155033.png', ok: true },
    'link.wiki': { src: 'Welcome/102353.png', ok: true },
    'link.foros': { src: 'Welcome/156384.png', ok: true },
    'link.ayuda': { src: 'Welcome/102367.png', ok: true },
    'link.oficial': { src: 'Welcome/156384.png', ok: true },
    'link.apikey': { src: 'Welcome/2604909.png', ok: true },
    'stat.act.fabricacion': { src: 'Welcome/102609.png', ok: true },
    'stat.act.fractales': { src: 'Fractal/2591.png', ok: true },
    'stat.act.llave': { src: 'Cuentas/LLave.png', ok: true },
    'stat.act.piedras': { src: 'Activities/96978.png', ok: true },
    'stat.home.recolectados': { src: 'Cuentas/23033.png', ok: true },
    'stat.home.gatos': { src: '3601748.png', ok: true },
    'stat.home.janthir': { src: 'Welcome/222580.png', ok: true },
    'stat.wv.aa': { src: 'Welcome/156108.png', ok: true },
    'stat.wv.gastada': { src: 'Welcome/156107.png', ok: true },
    'stat.ach.ap': { src: '155059.png', ok: true }
  };
  function iconSrc(key) { var e = ICONS[key]; return e && e.src ? (/^https:\/\//.test(e.src) ? e.src : DIR + e.src) : ''; }
  // El ícono es decorativo (alt vacío): el lector de pantalla sigue leyendo el texto de al lado.
  function icon(key, size, cls) {
    var src = iconSrc(key), s = Number(size) || 18;
    if (!src) return '';
    return '<img class="' + esc(cls || 'gk-ic') + '" src="' + esc(src) + '" width="' + s + '" height="' + s + '" alt="" loading="lazy">';
  }
  // Las claves que faltan elegir y las que son propuesta.
  function pending() {
    var out = { missing: [], proposed: [] };
    Object.keys(ICONS).forEach(function (k) {
      if (!ICONS[k].src) out.missing.push(k); else if (!ICONS[k].ok) out.proposed.push(k);
    });
    return out;
  }

  // ------------------------------------------------------------------ estilos
  var CSS = [
    '.gk-row{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.gk{display:inline-flex;align-items:center;gap:7px;padding:4px 10px 4px 5px;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);color:var(--tx-2);font-size:.8rem;line-height:1.15;white-space:nowrap}',
    '.gk img{width:20px;height:20px;border-radius:5px;flex-shrink:0}',
    '.gk__t{display:flex;flex-direction:column}',
    '.gk small{font-size:.66rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--tx-3)}',
    '.gk b{color:var(--tx-1);font-weight:700;font-variant-numeric:tabular-nums}',
    '.gk.is-soon{border-color:var(--gn-gold,#E8B34B)}.gk.is-soon b{color:var(--gn-gold,#E8B34B)}',
    '.gk--big{padding:7px 14px 7px 8px;font-size:.9rem}.gk--big img{width:24px;height:24px}',
    '.gk-ic{vertical-align:-3px;flex-shrink:0;border-radius:4px;margin-right:6px}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { timer: null, every: 30000 };

  function ensureCSS() {
    if (!doc || !doc.createElement || (doc.getElementById && doc.getElementById('gn-kit-css'))) return false;
    var s = doc.createElement('style');
    s.id = 'gn-kit-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
    return true;
  }

  // Pone al día todos los relojes de la página (solo su valor y su dorado: no redibuja, no mueve el foco).
  function tick(now) {
    if (!doc || !doc.querySelectorAll) return 0;
    var list = doc.querySelectorAll('[data-gk]'), t = now == null ? Date.now() : now;
    Array.prototype.forEach.call(list, function (n) {
      var v = value(n.getAttribute('data-gk'), t), b = n.querySelector ? n.querySelector('b') : null;
      if (!v || !b) return;
      if (b.textContent !== v.text) b.textContent = v.text;
      if (n.classList) { if (v.soon) n.classList.add('is-soon'); else n.classList.remove('is-soon'); }
    });
    if (!list.length) stop();
    return list.length;
  }
  function start() {
    ensureCSS();
    if (!st.timer && typeof root.setInterval === 'function') st.timer = root.setInterval(function () { tick(); }, st.every);
    return !!st.timer;
  }
  function stop() { if (st.timer && typeof root.clearInterval === 'function') root.clearInterval(st.timer); st.timer = null; }

  root.GNKit = {
    version: VERSION, clock: clockHTML, clocks: clocksHTML, icon: icon, iconSrc: iconSrc, tick: tick, start: start, stop: stop, ensureCSS: ensureCSS,
    _pure: { pad: pad, hhmm: hhmm, nextDaily: nextDaily, nextPsna: nextPsna, nextWeekly: nextWeekly, left: left, value: value,
      clockHTML: clockHTML, clocksHTML: clocksHTML, pending: pending, CLOCKS: CLOCKS, ICONS: ICONS, CSS: CSS },
    _state: function () { return { running: !!st.timer }; }
  };
  if (root.console && root.console.info) root.console.info('[GNKit] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
