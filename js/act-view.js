/*!
 * js/act-view.js — Actividades renovado: cabecera con los 3 relojes, 4 indicadores y pestañas Hoy y Semana (BL-070, ACT-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.5.0 (2026-10-27) — BL-076 SHV-5c: sin mi globo, mi línea también dice «Lo sé por» · antes 1.4.0 (2026-10-25) — ACT-7: el PSNA lo dibuja js/act-psna.js; ya no reubico nada de js/activities.js
 *          1.3.0 (2026-10-25) — ACT-5: los nodos de casa se mudaron a la Heredad (js/home-view.js, #/account/homestead)
 *          1.2.0 (2026-10-25) — ACT-4: la pestaña Semana la dibuja js/act-week.js (llave como señal, guía y piedras por moneda)
 * Versión: 1.1.0 (2026-10-25) — ACT-3: los fractales del día en Hoy, por rango y escala, con tu progreso y los de mañana (D4)
 *          1.0.1 (2026-10-25) — ACT-2: la ruta real del módulo es #/activities (la de js/router.js), no #/account/activities
 *          1.0.0 (2026-10-25) — ACT-2: la vista nueva sobre el modelo de js/act-model.js
 *
 * Toma el panel #activitiesPanel (#/activities); lo que traiga adentro de antes queda oculto:
 *  - Cabecera con el ícono del módulo y los 3 relojes en tu hora local: reset diario (00:00 UTC), cambio del
 *    PSNA (08:00 UTC) y reset semanal (lunes 07:30 UTC). Mi línea solo si hay algo que te falta hoy.
 *  - 4 indicadores leídos de la cuenta: fabricación diaria (las 5 de la API, con el cristal de cuarzo cargado),
 *    fractales del día (categoría de logros 88 y tu progreso), llave semanal («Probable» con un personaje de
 *    nivel 10 o más creado desde el reset, de cualquier profesión: la API no informa el capítulo terminado) y
 *    piedras vetustas (lo que marcaste esta semana).
 *  - Hoy (abre siempre acá, D6): la fabricación diaria con su ícono oficial, los fractales del día y el PSNA
 *    (js/act-psna.js, con las mismas funciones puras de siempre).
 *  - Semana: la dibuja js/act-week.js (llave, guía y piedras por moneda); los nodos de casa están en la Heredad.
 * Una lectura por fuente: los personajes en un pedido (/v2/characters?ids=all, no uno por uno), con un
 * reintento ante 429 y caché en memoria de 5 minutos. Estados honestos: lo que no se pudo leer dice «sin
 * datos» y se nombra, nunca «te falta» ni 0. La Key queda en memoria, nunca se guarda.
 * Se carga por js/modules.json, después de js/act-model.js (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.5.0';
  var LOG = '[ActView]';
  var PANEL = 'activitiesPanel';
  var ROUTE = '#/activities'; // la misma que usa js/router.js
  var ICON = 'assets/icons/1302773.png';
  var CAT_URL = 'assets/data/activities/catalog.json';
  var API = 'https://api.guildwars2.com';
  var TTL = 5 * 60 * 1000, TIMEOUT = 20000, TICK = 30000;
  var TABS = [['hoy', 'Hoy'], ['semana', 'Semana']];
  var RARITY = {
    Basic: ['Básico', '#C9D0DA'], Fine: ['Bueno', '#62A4DA'], Masterwork: ['Obra maestra', '#1A9306'],
    Rare: ['Raro', '#FCD00B'], Exotic: ['Exótico', '#FFA405'], Ascended: ['Ascendido', '#FB3E8D'], Legendary: ['Legendario', '#974EFF']
  };
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var UNREAD_TXT = { crafting: 'la fabricación diaria', chars: 'tus personajes', progress: 'tu progreso de fractales' };
  var PSNA_SOON = 3 * 3600000; // con menos de 3 h para el cambio del PSNA, lo digo

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function A() { return root.ActModel && root.ActModel._pure; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function and(parts) { return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1]; }
  function rarityOf(r) { return RARITY[r] || RARITY.Basic; }
  function dayText(ms) { var d = new Date(ms); return DIAS[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }

  // Los 3 relojes, en tu hora local.
  function clocks(now) {
    var P = A(), t = Number(now);
    if (!P) return null;
    var nd = P.nextDaily(t), np = P.nextPsna(t), nw = P.nextWeekly(t), w = new Date(nw);
    return { daily: P.left(nd - t), psna: P.left(np - t), psnaMs: np - t, weekly: DIAS[w.getDay()] + ' ' + hhmm(w),
      dailyAt: hhmm(new Date(nd)), psnaAt: hhmm(new Date(np)), day: P.dayKey(t) };
  }

  // Todo lo que muestra la pantalla, sin tocar el DOM.
  // data: { loaded, hasToken, crafting, chars, fractals: [{id, name}], progress, stones, items, unread }
  // ui: { tab }
  function buildModel(data, cat, ui, now) {
    ui = ui || {};
    var P = A(), d = data || {}, c = cat || {}, ok = !!d.loaded && !!d.hasToken;
    var m = { tab: ui.tab === 'semana' ? 'semana' : 'hoy', loaded: !!d.loaded, hasToken: !!d.hasToken, unread: d.unread || [],
      items: d.items || {}, clocks: clocks(now), crafting: null, fr: null, frProg: null,
      key: { state: 'unknown', chars: [] }, stones: null, stonesTotal: (c.leivas && c.leivas.perWeek) || 5, voice: null };
    if (!P) return m;
    if (c.dailyCrafting) m.crafting = P.dailyCrafting(c.dailyCrafting.items, ok ? d.crafting : null);
    if (c.fractals && Array.isArray(d.fractals)) {
      m.fr = P.fractals(d.fractals, c.fractals.patterns, c.fractals.tierMinScale);
      m.frProg = P.fractalProgress(m.fr, ok ? d.progress : null);
    }
    m.frTomorrow = c.fractals && Array.isArray(d.tomorrow) ? P.fractals(d.tomorrow, c.fractals.patterns, c.fractals.tierMinScale) : null;
    if (ok) m.key = P.weeklyKey(d.chars, now, (c.weeklyKey && c.weeklyKey.storyLevel) || 10, d.keyMark);
    m.lastWeekly = P.lastWeekly(now);
    if (ok && typeof d.stones === 'number') m.stones = Math.max(0, Math.min(m.stonesTotal, d.stones));
    m.voice = pickVoice(m);
    return m;
  }

  // Mi línea: solo si hoy te falta algo. Sin datos, nada.
  function pickVoice(m) {
    if (!m.loaded || !m.hasToken || !m.crafting || m.crafting.missing == null) return null;
    var parts = [], n = m.crafting.missing, soon = m.clocks && m.clocks.psnaMs < PSNA_SOON;
    if (n > 0) parts.push(n === 1 ? 'Hoy te falta 1 fabricación diaria.' : 'Hoy te faltan ' + n + ' fabricaciones diarias.');
    if (n > 0 && soon) parts.push('El PSNA cambia en ' + m.clocks.psna + ': si vas a comprar, es ahora.');
    if (!parts.length) return null;
    return { key: 'c' + n + (soon ? 's' : ''), kind: 'recomienda', text: parts.join(' ') };
  }

  function errorText(m) {
    var k = m.unread.filter(function (x) { return x !== 'fractals'; }), out = [];
    if (k.length) out.push('No pude leer ' + and(k.map(function (x) { return UNREAD_TXT[x] || x; })) + '. Revisá que la API Key tenga los permisos de progreso y de personajes.');
    if (m.unread.indexOf('fractals') >= 0) out.push('No pude leer los fractales del día de la API del juego.');
    return out.join(' ');
  }

  function subtitle(m) {
    if (!m.hasToken) return 'Cargá tu API Key (con permisos de progreso y de personajes) para ver lo que te falta.';
    if (!m.loaded) return 'Leyendo tu cuenta…';
    return 'Lo que te falta hoy y esta semana.';
  }

  function stat(label, value, note, bar) {
    return '<div class="av-st"><small>' + label + '</small><b>' + value + '</b>' +
      (bar != null ? '<div class="av-bar" aria-hidden="true"><i style="width:' + bar + '%"></i></div>' : '') + '<em>' + note + '</em></div>';
  }
  function frac(n, total) { return n + ' <span>/ ' + total + '</span>'; }
  function pct(n, total) { return total ? Math.round(n * 100 / total) : 0; }

  function statsHTML(m) {
    var ok = m.loaded && m.hasToken, nd = m.loaded ? 'sin datos' : 'leyendo…', h = '', c = m.crafting, p = m.frProg, k = m.key;
    if (ok && c && c.done != null) h += stat('Fabricación diaria', frac(c.done, c.total), c.missing ? (c.missing === 1 ? 'te falta 1' : 'te faltan ' + c.missing) : 'todo hecho hoy', pct(c.done, c.total));
    else h += stat('Fabricación diaria', '—', nd);
    var names = m.fr && m.fr.fractals.length ? esc(m.fr.fractals.map(function (f) { return f.name; }).join(', ')) : null;
    if (ok && p && p.done != null) h += stat('Fractales del día', frac(p.done, p.total), names || 'logros del día', pct(p.done, p.total));
    else h += stat('Fractales del día', '—', names || nd);
    if (ok && k.state === 'probable') {
      var ch = k.chars[0];
      h += stat('Llave semanal', 'Probable', esc(ch.name) + ', nivel ' + ch.level + ', creado el ' + esc(dayText(Date.parse(ch.created))));
    } else if (ok && k.state === 'claimed') h += stat('Llave semanal', 'Ya la sacaste', 'lo confirmaste vos');
    else if (ok && k.state === 'pending') h += stat('Llave semanal', 'Todavía no', 'lo confirmaste vos');
    else if (ok && k.state === 'none') h += stat('Llave semanal', 'Sin señal', 'ningún personaje nuevo de nivel 10');
    else h += stat('Llave semanal', '—', nd);
    if (m.stones != null) h += stat('Piedras vetustas', frac(m.stones, m.stonesTotal), m.stones >= m.stonesTotal ? 'las ' + m.stonesTotal + ' de la semana' : 'compradas esta semana', pct(m.stones, m.stonesTotal));
    else h += stat('Piedras vetustas', '—', nd);
    return h;
  }

  function badge(state) {
    if (state === true) return '<span class="av-badge av-badge--ok">Hecho</span>';
    if (state === false) return '<span class="av-badge av-badge--pend">Te falta</span>';
    return '<span class="av-badge av-badge--nd">Sin datos</span>';
  }

  function craftingHTML(m) {
    var c = m.crafting, clk = m.clocks;
    var h = '<section class="av-card" aria-labelledby="avCraftT"><div class="av-card-h"><h3 id="avCraftT">Fabricación diaria</h3>' +
      '<small>una vez por día, por cuenta' + (clk ? ' · se reinicia a las ' + clk.dailyAt : '') + '</small></div>';
    if (!c) return h + '<p class="av-note">Sin datos del catálogo.</p></section>';
    h += '<ul class="av-chk">';
    c.rows.forEach(function (r) {
      var meta = m.items[r.item], rr = rarityOf((meta && meta.rarity) || r.rarity);
      var st = m.loaded && m.hasToken ? r.done : null;
      h += '<li><span class="av-ic" style="--av-r:' + rr[1] + '">' + (meta && meta.icon ? '<img src="' + esc(meta.icon) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>' +
        '<span class="av-nm">' + esc(r.name) + '<span class="av-sr">, ' + esc(rr[0]) + '</span></span>' + (m.loaded || !m.hasToken ? badge(st) : '<span class="av-badge av-badge--nd">Leyendo…</span>') + '</li>';
    });
    h += '</ul><p class="av-note">' + (m.hasToken ? 'Se marca sola con tu cuenta.' : 'Con tu API Key se marca sola.') + '</p></section>';
    return h;
  }

  function keyHTML(m) {
    var k = m.key, clk = m.clocks, h = '<section class="av-card" aria-labelledby="avKeyT"><div class="av-card-h"><h3 id="avKeyT">Llave del León Negro</h3><small>1 por semana, por cuenta</small></div>' +
      '<p class="av-txt">Se gana al terminar el capítulo de nivel 10 de la historia personal, con cualquier profesión.</p>';
    if (k.state === 'probable') {
      h += '<ul class="av-chk">' + k.chars.map(function (ch) {
        return '<li><span class="av-nm">' + esc(ch.name) + ' · nivel ' + ch.level + ' · creado el ' + esc(dayText(Date.parse(ch.created))) + '</span><span class="av-badge av-badge--pend">Probable</span></li>';
      }).join('') + '</ul>';
    } else if (k.state === 'none') {
      h += '<p class="av-txt">Ningún personaje creado desde el reset del ' + esc(dayText(m.lastWeekly)) + ' llegó a nivel 10.</p>';
    } else h += '<p class="av-txt">' + badge(null) + '</p>';
    return h + '<p class="av-note">La API no dice si terminaste el capítulo: si un personaje creado esta semana llegó a nivel 10, te aviso que es probable. Se reinicia el ' +
      esc(clk ? clk.weekly : 'lunes') + '.</p></section>';
  }

  // ------------------------------------------------------------------ fractales del día (ACT-3)
  // Estado de un logro del día: true hecho, false te falta, null sin datos (nunca «te falta» sin leer la cuenta).
  function fracState(m, id) {
    var p = m.frProg;
    if (!m.loaded || !m.hasToken || !p || p.done == null) return null;
    return !!p.ids[id];
  }
  function tierChip(label, sub, state) {
    var cls = state === true ? ' av-tier--ok' : state === false ? ' av-tier--pend' : '';
    var said = state === true ? 'hecho' : state === false ? 'te falta' : 'sin datos';
    return '<li class="av-tier' + cls + '"><i aria-hidden="true"></i><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') +
      '<span class="av-sr">: ' + said + '</span></li>';
  }
  function fractalsHTML(m) {
    var clk = m.clocks, fr = m.fr, tm = m.frTomorrow;
    var h = '<section class="av-card" aria-labelledby="avFrT"><div class="av-card-h"><h3 id="avFrT">Fractales del día</h3>' +
      '<small>los 3 de hoy en sus 4 rangos y las escalas recomendadas' + (clk ? ' · cambian a las ' + clk.dailyAt : '') + '</small></div>';
    if (!fr) return h + '<p class="av-note">' + (m.loaded && m.hasToken ? 'No pude leer los fractales del día de la API del juego.' : m.loaded ? 'Sin datos de los fractales del día.' : 'Leyendo los fractales del día…') + '</p></section>';
    if (!fr.fractals.length && !fr.recommended.length) return h + '<p class="av-note">La API no trae fractales del día en este momento.</p></section>';
    h += '<ul class="av-frs">';
    fr.fractals.forEach(function (f) {
      h += '<li class="av-fr"><b class="av-frn">' + esc(f.name) + '</b><ul class="av-tiers" aria-label="Rangos de ' + esc(f.name) + '">';
      [1, 2, 3, 4].forEach(function (k) { var x = f.tiers[k]; if (x) h += tierChip('R' + k, x.minScale ? 'escala ' + x.minScale + '+' : '', fracState(m, x.id)); });
      h += '</ul></li>';
    });
    if (fr.recommended.length) {
      h += '<li class="av-fr"><b class="av-frn">Recomendados</b><ul class="av-tiers" aria-label="Fractales recomendados">' +
        fr.recommended.map(function (r) { return tierChip('Escala ' + r.scale, '', fracState(m, r.id)); }).join('') + '</ul></li>';
    }
    h += '</ul>';
    if (fr.unknown.length) h += '<p class="av-note">' + (fr.unknown.length === 1 ? 'Hay 1 logro del día que no reconozco' : 'Hay ' + fr.unknown.length + ' logros del día que no reconozco') + ': no lo cuento.</p>';
    if (tm && (tm.fractals.length || tm.recommended.length)) {
      h += '<p class="av-tmw"><b>Mañana:</b> ' + esc(tm.fractals.map(function (f) { return f.name; }).join(', ')) +
        (tm.recommended.length ? (tm.fractals.length ? ' · ' : '') + 'recomendados escala ' + tm.recommended.map(function (r) { return r.scale; }).join(', ') : '') + '</p>';
    }
    return h + '<p class="av-note">' + (m.hasToken ? 'Se marcan solos con los logros del día de tu cuenta.' : 'Con tu API Key se marcan solos.') + '</p></section>';
  }

  function hoyHTML(m) {
    var S = root.ActPsna;
    return craftingHTML(m) + fractalsHTML(m) + (S && typeof S.html === 'function' ? S.html() : '');
  }
  function semanaHTML(m) {
    var W = root.ActWeek;
    return (W && typeof W.html === 'function' ? W.html(m) : keyHTML(m)) +
      '<section class="av-card" aria-labelledby="avNodesT"><div class="av-card-h"><h3 id="avNodesT">Nodos de casa</h3></div>' +
      '<p class="av-txt">Se mudaron a su propio módulo, <a class="av-link" href="#/account/homestead">la Heredad</a>, con tus marcas de siempre.</p></section>';
  }

  function viewHTML(m) {
    var h = [], err = errorText(m), clk = m.clocks;
    h.push('<div class="av-hero"><div class="av-row"><img class="av-ico" src="' + ICON + '" alt="" width="56" height="56">');
    h.push('<div class="av-title"><h2 id="avTitle">Actividades</h2><p>' + esc(subtitle(m)) + '</p></div>');
    h.push('<div class="av-acts">');
    if (clk) {
      h.push('<span class="av-pill" title="00:00 UTC">Reset diario <b id="avClkD">en ' + esc(clk.daily) + '</b></span>' +
        '<span class="av-pill" title="08:00 UTC">PSNA cambia <b id="avClkP">en ' + esc(clk.psna) + '</b></span>' +
        '<span class="av-pill" title="lunes 07:30 UTC">Semanal <b id="avClkW">' + esc(clk.weekly) + '</b></span>');
    }
    h.push('<button type="button" class="av-btn" data-av="refresh">Actualizar</button></div></div>');
    h.push('<div class="av-stats" id="avStats">' + statsHTML(m) + '</div>');
    if (err) h.push('<p class="av-err" role="status">' + esc(err) + '</p>');
    h.push('<div id="avVoice" class="av-voice" aria-live="polite"></div></div>');
    h.push('<div class="av-tabs" role="tablist" aria-label="Secciones de Actividades">');
    TABS.forEach(function (t) {
      var on = m.tab === t[0];
      h.push('<button type="button" role="tab" id="avTab-' + t[0] + '" data-av-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="avPanel-' + t[0] + '" tabindex="' + (on ? '0' : '-1') + '">' + t[1] + '</button>');
    });
    h.push('</div>');
    TABS.forEach(function (t) {
      h.push('<div id="avPanel-' + t[0] + '" role="tabpanel" aria-labelledby="avTab-' + t[0] + '"' + (m.tab === t[0] ? '' : ' hidden') + '>' +
        (t[0] === 'hoy' ? hoyHTML(m) : semanaHTML(m)) + '</div>');
    });
    h.push('<p class="av-src">Fabricación diaria, fractales y personajes: API oficial del juego, en español. Regla de la llave y resets: wiki oficial.</p>');
    return h.join('');
  }

  var R = '#avRoot';
  var CSS = [
    '#' + PANEL + '.av-on>.panel__title,#' + PANEL + '.av-on>.panel__body{display:none!important}',
    R + '{--av-mod:var(--gn-mod,#3CC48A)}',
    '.av-hero{border:1px solid var(--bd-1);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--av-mod) 12%,transparent),var(--bg-1) 70%);padding:16px 18px}',
    '.av-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.av-ico{width:56px;height:56px;border-radius:12px;background:var(--bg-2);padding:6px;box-shadow:0 0 0 2px color-mix(in srgb,var(--av-mod) 70%,transparent);flex-shrink:0;box-sizing:border-box}',
    '.av-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.av-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.av-acts{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.av-pill{font-size:.78rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 10px;color:var(--tx-2);background:var(--bg-0);white-space:nowrap}.av-pill b{color:var(--tx-1)}',
    '.av-btn{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px}',
    '.av-btn:hover{border-color:var(--acc-1)}',
    '.av-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.av-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.av-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.av-st b{font-size:1.25rem;color:var(--tx-1)}.av-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.av-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis}',
    '.av-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:6px}.av-bar i{display:block;height:100%;background:var(--av-mod)}',
    '.av-err{margin:10px 0 0;padding-left:8px;border-left:3px solid var(--color-red,#F47C7C);font-size:.82rem;color:var(--tx-1)}',
    '.av-voice{margin-top:12px}.av-voice:empty{display:none}.av-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.av-voice .shv-voice__avatar{width:36px;height:36px}.av-voice .shv-voice__label{font-size:.78rem}.av-voice .shv-voice__body p{font-size:.86rem}',
    '.av-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1);overflow-x:auto}',
    '.av-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);cursor:pointer;white-space:nowrap;min-height:40px}',
    '.av-tabs [role=tab][aria-selected=true]{color:var(--tx-1);font-weight:700;border-bottom-color:var(--av-mod)}',
    '.av-card{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:12px 16px;margin-bottom:12px}',
    '.av-card-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}.av-card-h h3{margin:0;font-size:1rem;color:var(--tx-1)}',
    '.av-card-h small{font-size:.78rem;color:var(--tx-2)}',
    '.av-chk{list-style:none;margin:0;padding:0}',
    '.av-chk li{display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--bd-1);padding:7px 0;min-height:44px;box-sizing:border-box}.av-chk li:last-child{border-bottom:0}',
    '.av-nm{flex:1;min-width:0;font-size:.9rem;color:var(--tx-1)}',
    '.av-ic{display:inline-block;width:32px;height:32px;flex-shrink:0;border-radius:7px;background:var(--bg-2);box-shadow:inset 0 0 0 2px var(--av-r),0 0 0 1px var(--bd-1);line-height:0}',
    '.av-ic img{display:block;width:32px;height:32px;border-radius:7px;padding:2px;box-sizing:border-box}',
    '.av-badge{font-size:.74rem;font-weight:700;border:1px solid var(--bd-2);border-radius:999px;padding:1px 9px;color:var(--tx-1);white-space:nowrap}',
    '.av-badge--ok{border-color:var(--color-green,#3CC48A)}',
    '.av-badge--pend{border-color:var(--color-amber,#F2B94B)}.av-badge--nd{color:var(--tx-2)}',
    '.av-txt{margin:4px 0 8px;font-size:.88rem;color:var(--tx-1)}.av-link{color:var(--tx-1);font-weight:700;text-decoration:underline}',
    '.av-note,.av-src{margin:8px 0 0;color:var(--tx-2);font-size:.8rem}.av-src{font-size:.74rem;margin-top:12px}',
    '.av-frs{list-style:none;margin:0;padding:0}',
    '.av-fr{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--bd-1);padding:8px 0}.av-fr:last-child{border-bottom:0}',
    '.av-frn{min-width:150px;font-size:.9rem;color:var(--tx-1)}',
    '.av-tiers{list-style:none;margin:0;padding:0;display:flex;gap:6px;flex-wrap:wrap}',
    '.av-tier{display:inline-flex;align-items:center;gap:5px;font-size:.76rem;border:1px solid var(--bd-2);border-radius:8px;padding:2px 8px;color:var(--tx-1);min-height:28px;box-sizing:border-box}',
    '.av-tier b{font-weight:700}.av-tier small{font-size:.7rem;color:var(--tx-2)}',
    '.av-tier i{width:8px;height:8px;border-radius:50%;background:var(--bd-2);flex-shrink:0}',
    '.av-tier--ok{border-color:var(--color-green,#3CC48A)}.av-tier--ok i{background:var(--color-green,#3CC48A)}.av-tier--pend{border-color:var(--color-amber,#F2B94B)}',
    '.av-tmw{margin:10px 0 0;font-size:.84rem;color:var(--tx-2)}.av-tmw b{color:var(--tx-1)}',
    '.av-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    R + ' button:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + R + ' *{transition:none!important;animation:none!important}}',
    '@media (max-width:900px){.av-hero{padding:12px}.av-ico{width:40px;height:40px;padding:4px}.av-title h2{font-size:1.05rem}',
    '.av-acts{margin-left:0;width:100%}.av-stats{grid-template-columns:1fr 1fr;gap:6px}.av-st{padding:8px 10px}.av-st b{font-size:1.05rem}',
    '.av-tabs [role=tab],.av-btn{min-height:44px}.av-pill{white-space:normal}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { cat: null, catP: null, data: null, ui: { tab: 'hoy' }, voiceKey: null, seq: 0, cache: {}, shown: false, tick: null, day: null };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function hash() { return String((root.location && root.location.hash) || ''); }
  function storage() { var S = root.Storage; return S && typeof S.get === 'function' ? S : null; }
  function now() { return Date.now(); }

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
    st.catP = root.fetch(CAT_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('catálogo ' + r.status); return r.json(); })
      .then(function (c) { st.cat = c || {}; return st.cat; })
      .catch(function (e) { st.catP = null; if (root.console) root.console.warn(LOG, 'catálogo', e); return null; });
    return st.catP;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Lector mínimo: tiempo límite, un reintento ante 429 y caché en memoria. empty404: la API responde 404
  // cuando ninguno de los logros pedidos tiene progreso en tu cuenta; eso es «nada hecho», no un error.
  function readJSON(path, tk, nocache, empty404, retry) {
    var key = path + '|' + (tk ? tk.slice(-8) + tk.length : '-'), c = st.cache[key];
    if (!nocache && c && now() - c.t < TTL) return Promise.resolve(c.v);
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var url = API + path + (tk ? (path.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(tk) : '');
    return root.fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (to) clearTimeout(to);
      if (r.status === 429 && !retry) return wait(1000).then(function () { return readJSON(path, tk, true, empty404, true); });
      if (r.status === 404 && empty404) return [];
      if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status);
      return r.json().then(function (v) { st.cache[key] = { t: now(), v: v }; return v; });
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }

  function settle(p) {
    return Promise.resolve().then(p).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  // Los fractales de hoy y de mañana (D4): la categoría 88 trae los ids de los dos días; los nombres en
  // español, de /v2/achievements, en un solo pedido.
  function fractalsToday(nocache) {
    var ids = function (x) { return (Array.isArray(x) ? x : []).map(function (a) { return typeof a === 'number' ? a : a && a.id; }).filter(Boolean); };
    return readJSON('/v2/achievements/categories/88?v=latest', null, nocache).then(function (c) {
      var today = ids(c && c.achievements), tomorrow = ids(c && c.tomorrow), all = today.concat(tomorrow.filter(function (id) { return today.indexOf(id) < 0; }));
      if (!all.length) return { today: [], tomorrow: [] };
      return readJSON('/v2/achievements?ids=' + all.join(',') + '&lang=es', null, nocache).then(function (list) {
        var by = {};
        (Array.isArray(list) ? list : []).forEach(function (a) { if (a && a.id) by[a.id] = a.name; });
        var named = function (l) { return l.filter(function (id) { return by[id]; }).map(function (id) { return { id: id, name: by[id] }; }); };
        return { today: named(today), tomorrow: named(tomorrow) };
      });
    });
  }

  // Cada lectura falla por su lado: lo que llegó se muestra, lo que no se dice.
  function load(nocache) {
    var mySeq = ++st.seq, tk = token(), G = root.GW2Api;
    if (!tk) { st.data = { loaded: true, hasToken: false, items: (st.data && st.data.items) || {} }; render(); return Promise.resolve(st.data); }
    if (!st.data || st.data.tk !== tk) { st.data = { loaded: false, hasToken: true, tk: tk, items: (st.data && st.data.items) || {} }; render(); }
    var items = st.data.items;
    return Promise.all([
      settle(function () { return readJSON('/v2/account/dailycrafting', tk, nocache); }),
      settle(function () { return readJSON('/v2/characters?ids=all', tk, nocache); }),
      settle(function () { return fractalsToday(nocache); })
    ]).then(function (r) {
      if (mySeq !== st.seq) return null;
      var arr = function (x) { return x.ok && Array.isArray(x.v) ? x.v : null; };
      var chars = arr(r[1]);
      var d = { loaded: true, hasToken: true, tk: tk, items: items, unread: [], crafting: arr(r[0]), progress: null,
        chars: chars ? chars.map(function (c) { return { name: c && c.name, level: c && c.level, created: c && c.created, race: c && c.race, profession: c && c.profession, backstory: c && c.backstory }; }) : null,
        fractals: r[2].ok && r[2].v ? r[2].v.today : null, tomorrow: r[2].ok && r[2].v ? r[2].v.tomorrow : null };
      if (!d.crafting) d.unread.push('crafting');
      if (!d.chars) d.unread.push('chars');
      if (!d.fractals) d.unread.push('fractals');
      st.data = d;
      render();
      var jobs = [];
      if (d.fractals && d.fractals.length) {
        jobs.push(settle(function () { return readJSON('/v2/account/achievements?ids=' + d.fractals.map(function (f) { return f.id; }).join(','), tk, nocache, true); })
          .then(function (x) {
            if (mySeq !== st.seq) return;
            if (x.ok && Array.isArray(x.v)) d.progress = x.v; else d.unread.push('progress');
            render();
          }));
      }
      var ids = ((st.cat && st.cat.dailyCrafting && st.cat.dailyCrafting.items) || []).map(function (i) { return i.item; }).filter(function (id) { return !items[id]; });
      if (ids.length && G && typeof G.getItemsMany === 'function') {
        jobs.push(G.getItemsMany(ids, { nocache: false }).then(function (list) {
          (list || []).forEach(function (it) { if (it && it.id) items[it.id] = { icon: it.icon, rarity: it.rarity }; });
          if (mySeq === st.seq) render();
        }, function (e) { if (root.console) root.console.warn(LOG, 'ítems', e); }));
      }
      return Promise.all(jobs).then(function () { return d; });
    });
  }

  function ensureHost(panel) {
    if (!byId('act-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'act-view-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var host = byId('avRoot');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'avRoot';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
    }
    if (panel.classList) panel.classList.add('av-on');
    if (panel.setAttribute) panel.setAttribute('aria-labelledby', 'avTitle');
    return host;
  }

  function model() {
    var W = root.ActWeek, wk = W && typeof W.state === 'function' ? W.state(Date.now()) : null;
    var d = Object.assign({}, st.data || {}, { stones: wk ? wk.bought : null, keyMark: wk ? wk.keyMark : undefined });
    return buildModel(d, st.cat, { tab: st.ui.tab }, now());
  }

  // Para volver el foco al mismo botón después de redibujar (también los de la pestaña Semana).
  function focusSel(a) {
    var ks = ['data-av', 'data-aw-key', 'data-aw-stone', 'data-aw-wp', 'data-ap-copy', 'data-ap-all'];
    for (var i = 0; i < ks.length; i++) { var v = a.getAttribute(ks[i]); if (v) return '[' + ks[i] + '="' + v + '"]'; }
    return null;
  }
  function render() {
    var panel = byId(PANEL);
    if (!panel || !st.cat || !st.shown) return null;
    var host = ensureHost(panel), m = model();
    var a = doc.activeElement, fk = a && host.contains && host.contains(a) && a.getAttribute ? (a.id ? '#' + a.id : focusSel(a)) : null;
    host.innerHTML = viewHTML(m);
    st.voiceKey = null;
    renderVoice(m.voice);
    if (root.ActWeek && typeof root.ActWeek.afterRender === 'function') root.ActWeek.afterRender(m);
    if (fk && host.querySelector) { var b = host.querySelector(fk); if (b && b.focus) b.focus(); }
    return m;
  }

  function renderVoice(msg) {
    var box = byId('avVoice');
    if (!box) return;
    var key = msg ? msg.key : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.ShvBubble && root.ShvBubble.speak) root.ShvBubble.speak(box, msg, { module: 'actividades', source: 'tus Actividades (API oficial) y los relojes del juego', key: key }); else if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text, basis: 'tus Actividades (API oficial) y los relojes del juego · en este navegador' })); // SHE-3 (DEC-038): mi globo
  }

  function go(tab) {
    if (tab !== 'hoy' && tab !== 'semana') return null;
    st.ui.tab = tab;
    var m = render();
    return m;
  }

  // Los relojes corren solos; al pasar el reset diario se vuelve a leer la cuenta.
  function tickOnce() {
    if (!visible()) { stopTick(); return; }
    var c = clocks(now());
    if (!c) return;
    var set = function (id, txt) { var n = byId(id); if (n) n.textContent = txt; };
    set('avClkD', 'en ' + c.daily); set('avClkP', 'en ' + c.psna); set('avClkW', c.weekly);
    if (root.ActPsna && typeof root.ActPsna.tick === 'function' && root.ActPsna.tick(now())) render(); // 08:00 UTC: lugares nuevos
    if (st.day && st.day !== c.day) { st.day = c.day; load(true); }
    st.day = c.day;
  }
  function startTick() { if (!st.tick && typeof root.setInterval === 'function') st.tick = root.setInterval(tickOnce, TICK); }
  function stopTick() { if (st.tick && typeof root.clearInterval === 'function') root.clearInterval(st.tick); st.tick = null; }

  function attrOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = { act: n.getAttribute('data-av'), tab: n.getAttribute('data-av-tab') };
      if (a.act || a.tab) return a;
    }
    return null;
  }

  function wire(host) {
    host.addEventListener('click', function (e) {
      if (root.ActWeek && typeof root.ActWeek.onClick === 'function' && root.ActWeek.onClick(e)) return;
      if (root.ActPsna && typeof root.ActPsna.onClick === 'function' && root.ActPsna.onClick(e)) return;
      var a = attrOf(e.target);
      if (!a) return;
      if (a.act === 'refresh') {
        if (root.toast) root.toast('info', 'Actualizando tus actividades…', { ttl: 1500 });
        load(true);
        if (root.ActWeek && typeof root.ActWeek.refresh === 'function') root.ActWeek.refresh();
        if (root.ActPsna && typeof root.ActPsna.refresh === 'function') root.ActPsna.refresh();
      } else if (a.tab) go(a.tab);
    });
    // Flechas, Inicio y Fin entre las pestañas (patrón tablist).
    host.addEventListener('keydown', function (e) {
      var a = attrOf(e.target);
      if (!a || !a.tab) return;
      var ids = TABS.map(function (t) { return t[0]; }), i = ids.indexOf(a.tab), to = null;
      if (e.key === 'ArrowRight') to = ids[(i + 1) % ids.length];
      else if (e.key === 'ArrowLeft') to = ids[(i + ids.length - 1) % ids.length];
      else if (e.key === 'Home') to = ids[0];
      else if (e.key === 'End') to = ids[ids.length - 1];
      if (!to) return;
      if (e.preventDefault) e.preventDefault();
      go(to);
      var b = byId('avTab-' + to);
      if (b && b.focus) b.focus();
    });
  }

  function visible() { return hash() === ROUTE && !isHidden(byId(PANEL)); }

  function onShow() {
    if (!visible()) { st.shown = false; stopTick(); return; }
    var first = !st.shown;
    st.shown = true;
    if (first) st.ui.tab = 'hoy'; // D6: abre siempre en Hoy
    startTick();
    loadCat().then(function () { render(); if (first || !st.data) load(false); });
  }

  function init() {
    if (doc.addEventListener) {
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { st.data = null; st.cache = {}; setTimeout(function () { if (visible()) { st.shown = true; loadCat().then(function () { load(false); }); } }, 80); });
    }
    if (root.addEventListener) root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
    onShow();
  }

  root.ActView = {
    version: VERSION, render: render, go: go, refresh: function () { return load(true); },
    getSnapshot: function () { return { data: st.data, ui: { tab: st.ui.tab } }; },
    _cat: function () { return st.cat; },
    _pure: { esc: esc, clocks: clocks, buildModel: buildModel, pickVoice: pickVoice, errorText: errorText, subtitle: subtitle,
      statsHTML: statsHTML, viewHTML: viewHTML, RARITY: RARITY, TABS: TABS, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
