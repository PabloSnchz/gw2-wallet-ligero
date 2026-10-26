/*!
 * js/act-week.js — Actividades, pestaña Semana: la llave del León Negro y las piedras de Leivas (BL-070, ACT-4)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.1.0 (2026-10-25) — ACT-7c: sin el paso del −/+ de la pantalla vieja (retirada en ACT-7b)
 *
 * La pestaña Semana de js/act-view.js la dibuja este archivo:
 *  - Llave semanal: «Probable» con un personaje de nivel 10 o más creado desde el reset (cualquier profesión).
 *    Como pidió Pablo, la raza, la clase social de la biografía y la profesión suben la confianza, no filtran:
 *    un humano «Plebeyo» es la combinación que usa la comunidad, y lo digo con mi voz. La API no informa el
 *    capítulo terminado: vos confirmás «Ya la saqué» o «Todavía no» (D2) y vale hasta el reset del lunes.
 *  - Cómo la saca la comunidad: raza y clase social, las profesiones más usadas con su ícono oficial y los pasos.
 *  - Piedras de invocación vetustas: una casilla por moneda (D3), con lo que tenés de cada una en la cartera.
 *    El paso del −/+ de la pantalla vieja se fue con ella en ACT-7c: esa pantalla ya no existe desde ACT-7b.
 * Marcas por cuenta con una huella (nunca la Key) en gn:activities:week. Datos: assets/data/activities/key-farm.json
 * (RUN-060 y wiki oficial) y la cartera por GW2Api.getAccountWallet (con su caché). Se carga por js/modules.json,
 * después de js/act-view.js; sin este archivo, Semana queda como en ACT-2.
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var LOG = '[ActWeek]';
  var DATA_URL = 'assets/data/activities/key-farm.json';
  var STORE = 'gn:activities:week';
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayText(ms) { var d = new Date(ms); return DIAS[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function M() { return root.ActModel && root.ActModel._pure; }

  // La señal de farmeo de un personaje: raza, clase social de la biografía y profesión. commoner es null si la API
  // no trajo la biografía (sin datos, no «no»).
  function signal(ch, data) {
    var c = (data && data.combo) || {}, ans = c.backstory && c.backstory.answer, bs = ch && Array.isArray(ch.backstory) ? ch.backstory : null;
    var human = !!ch && ch.race === c.race, commoner = bs ? bs.indexOf(ans) >= 0 : null;
    return { human: human, commoner: commoner, combo: human && commoner === true, profession: (ch && ch.profession) || '' };
  }

  // La llave: el estado de ActModel.weeklyKey y, si es probable, cada personaje con su señal (la combinación primero).
  function keyModel(k, chars, data) {
    var all = Array.isArray(chars) ? chars : [];
    var list = ((k && k.chars) || []).map(function (kc) {
      var ch = all.filter(function (x) { return x && x.name === kc.name; })[0] || kc;
      return { name: kc.name, level: kc.level, created: kc.created, sig: signal(ch, data) };
    }).sort(function (a, b) { return (b.sig.combo ? 1 : 0) - (a.sig.combo ? 1 : 0); });
    var combo = list.some(function (c) { return c.sig.combo; });
    return { state: (k && k.state) || 'unknown', chars: list, combo: combo };
  }

  // Mi voz en la llave: lo que la API no confirma y lo que la comunidad sí. null si no hay nada que decir.
  function keyVoice(km, data, since) {
    var c = (data && data.combo) || {}, cs = (c.backstory && c.backstory.name) || 'Plebeyo';
    if (km.state === 'probable' && km.combo) {
      var a = km.chars[0];
      return { kind: 'explica', text: 'La API no me dice si terminaste el capítulo de nivel 10, pero ' + a.name + ' es humano, eligió «' + cs +
        '» y llegó a nivel 10 esta semana: es la combinación que usa la comunidad para farmear la llave. Si ya la sacaste, confirmalo y la cuento.' };
    }
    if (km.state === 'probable') {
      var b = km.chars[0];
      return { kind: 'explica', text: b.name + ' llegó a nivel 10 esta semana. La API no confirma el capítulo y no es la combinación de farmeo (humano y «' + cs +
        '»), así que no lo doy por hecho: si sacaste la llave, confirmalo.' };
    }
    if (km.state === 'none') {
      return { kind: 'recomienda', text: 'No veo personajes nuevos de nivel 10 desde el reset del ' + dayText(since) + '. La llave de esta semana sigue disponible: abajo te dejo cómo la saca la comunidad.' };
    }
    if (km.state === 'claimed') return { kind: 'saluda', text: 'Anotado: la llave de esta semana ya la sacaste. La próxima, desde el reset del lunes.' };
    return null;
  }

  // Las piedras: ActModel.leivas con el ícono y el nombre de cada moneda.
  function stones(offers, wallet, marks, data) {
    var P = M(), cur = (data && data.currencies) || {};
    var s = P ? P.leivas(offers, wallet, marks) : { rows: [], bought: 0, total: 0, missing: [] };
    s.rows.forEach(function (r) { var c = cur[r.currency] || {}; r.icon = c.icon || ''; r.name = c.label || String(r.label || '').toLowerCase(); });
    return s;
  }
  function amount(r, n) { return r.currency === 1 ? fmtInt(Math.floor(n / 10000)) + ' de oro' : fmtInt(n) + ' de ' + r.name; }
  function stoneNote(r) {
    var cost = r.currency === 1 ? '1 de oro' : fmtInt(r.cost) + ' de ' + r.name;
    if (r.have == null) return 'cuesta ' + cost;
    return 'cuesta ' + cost + ' · tenés ' + amount(r, r.have) + (r.afford === false ? ' · te faltan ' + amount(r, r.cost - r.have) : '');
  }

  var BADGE = { claimed: ['ok', 'Ya la sacaste'], pending: ['pend', 'Todavía no'], none: ['nd', 'Sin señal'], unknown: ['nd', 'Sin datos'] };

  function chip(on, yes, no, nd) {
    if (on === null) return '<span class="aw-chip">' + esc(nd) + '</span>';
    return '<span class="aw-chip' + (on ? ' aw-chip--ok' : '') + '">' + esc(on ? yes : no) + '</span>';
  }

  // s: { data, hasToken, loaded, key: keyModel, mark, weekly, since, stones, walletState }
  function keyHTML(s) {
    var d = s.data || {}, km = s.key, c = d.combo || {}, cs = (c.backstory && c.backstory.name) || 'Plebeyo', pn = d.professionNames || {}, pi = d.professionIcons || {};
    var b = km.state === 'probable' ? (km.combo ? ['pend', 'Muy probable'] : ['pend', 'Probable']) : BADGE[km.state] || BADGE.unknown;
    var h = '<section class="av-card" aria-labelledby="avKeyT"><div class="aw-kh">' +
      (d.key && d.key.icon ? '<img class="aw-kic" src="' + esc(d.key.icon) + '" alt="" width="40" height="40" referrerpolicy="no-referrer">' : '') +
      '<div class="aw-kt"><h3 id="avKeyT">Llave del León Negro</h3><small>1 por semana, por cuenta · se reinicia el ' + esc(s.weekly || 'lunes') + '</small></div>' +
      '<span class="av-badge av-badge--' + b[0] + '">' + b[1] + '</span></div>';
    if (km.state === 'claimed') h += '<p class="av-txt">La confirmaste vos esta semana.</p>';
    else if (km.state === 'pending') h += '<p class="av-txt">Marcaste que todavía no la sacaste.</p>';
    else if (km.state === 'none') h += '<p class="av-txt">Ningún personaje creado desde el reset del ' + esc(dayText(s.since)) + ' llegó a nivel 10.</p>';
    else if (km.state === 'probable') {
      h += '<ul class="aw-chars">' + km.chars.map(function (ch) {
        var g = ch.sig, ic = pi[g.profession];
        return '<li>' + (ic ? '<img src="' + esc(ic) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">' : '<span class="aw-noic" aria-hidden="true"></span>') +
          '<span class="aw-cn"><b>' + esc(ch.name) + '</b><small>nivel ' + esc(ch.level) + ' · creado el ' + esc(dayText(Date.parse(ch.created))) + '</small></span>' +
          '<span class="aw-sig">' + chip(g.human, 'Humano', 'Otra raza', '') + chip(g.commoner, cs, 'Otra clase social', 'Clase social: sin datos') +
          (g.profession ? '<span class="aw-chip">' + esc(pn[g.profession] || g.profession) + '</span>' : '') +
          (g.combo ? '<span class="aw-chip aw-chip--ok">Combinación de farmeo</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    } else h += '<p class="av-txt">' + (s.hasToken ? 'No pude leer tus personajes.' : 'Con tu API Key te digo si es probable que ya la hayas sacado.') + '</p>';
    h += '<div id="awKeyVoice" class="aw-voice" aria-live="polite"></div>';
    if (s.hasToken) {
      h += '<div class="aw-acts" role="group" aria-label="Confirmar la llave de esta semana">' +
        '<button type="button" class="av-btn" data-aw-key="yes" aria-pressed="' + (s.mark === true) + '">Ya la saqué</button>' +
        '<button type="button" class="av-btn" data-aw-key="no" aria-pressed="' + (s.mark === false) + '">Todavía no</button>' +
        (s.mark === true || s.mark === false ? '<button type="button" class="av-btn" data-aw-key="auto">Que lo detecte solo</button>' : '') + '</div>';
    }
    return h + '</section>';
  }

  function guideHTML(s) {
    var d = s.data || {}, c = d.combo || {}, cs = (c.backstory && c.backstory.name) || 'Plebeyo';
    var h = '<section class="av-card" aria-labelledby="awGuideT"><div class="av-card-h"><h3 id="awGuideT">Cómo la saca la comunidad</h3><small>el personaje recomendado</small></div>' +
      '<div class="aw-combo"><span class="aw-pick"><small>Raza</small><b>' + esc(c.raceName || 'Humano') + '</b></span>' +
      '<span class="aw-pick"><small>' + esc((c.backstory && c.backstory.questionName) || 'Clase social') + ' (biografía)</small><b>' + esc(cs) + '</b></span>' +
      '<span class="aw-why">' + esc(c.why || '') + '</span></div>';
    var pr = d.professions || [];
    if (pr.length) {
      h += '<p class="aw-lbl">Profesiones más usadas</p><ul class="aw-profs">' + pr.map(function (p) {
        return '<li><img src="' + esc(p.icon) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer"><span>' + esc(p.name) +
          (p.by === 'community' ? '<small>la comunidad</small>' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    if ((d.steps || []).length) h += '<ol class="aw-steps">' + d.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    return h + '<p class="av-src">Wiki oficial, «Key farming», y la experiencia de la comunidad. Íconos y nombres: API oficial del juego.</p></section>';
  }

  function stonesHTML(s) {
    var st = s.stones;
    var h = '<section class="av-card" aria-labelledby="awStT"><div class="av-card-h"><h3 id="awStT">Piedras de invocación vetustas</h3>' +
      '<small>Leivas, Piedra Arbórea · 5 por semana, una por moneda · ' + st.bought + ' de ' + st.total + ' compradas</small></div><ul class="aw-stones">';
    st.rows.forEach(function (r) {
      h += '<li><button type="button" class="aw-stone" data-aw-stone="' + r.currency + '" aria-pressed="' + r.bought + '"' + (s.hasToken ? '' : ' disabled') + '>' +
        '<span class="aw-box" aria-hidden="true"></span>' + (r.icon ? '<img src="' + esc(r.icon) + '" alt="" width="28" height="28" loading="lazy" referrerpolicy="no-referrer">' : '') +
        '<span class="aw-sn"><b>Con ' + esc(r.name) + '</b><small>' + esc(stoneNote(r)) + '</small></span>' +
        '<span class="av-sr">' + (r.bought ? ', comprada' : ', sin comprar') + '</span></button></li>';
    });
    h += '</ul><div class="aw-acts"><button type="button" class="av-btn" data-aw-wp="1">Copiar el punto de ruta de Piedra Arbórea</button></div>';
    var note = s.hasToken ? 'Marcá las que compraste: valen hasta el reset del ' + (s.weekly || 'lunes') + '.' : 'Con tu API Key marcás las que compraste y ves lo que tenés de cada moneda.';
    if (s.hasToken && s.walletState === 'error') note += ' No pude leer tu cartera: no sé cuánto tenés de cada moneda.';
    return h + '<p class="av-note">' + esc(note) + '</p></section>';
  }

  function html(s) { return keyHTML(s) + guideHTML(s) + stonesHTML(s); }

  var R = '#avRoot';
  var CSS = [
    '.aw-kh{display:flex;align-items:center;gap:12px;margin-bottom:8px}.aw-kt{flex:1;min-width:0}',
    '.aw-kt h3{margin:0;font-size:1rem;color:var(--tx-1)}.aw-kt small{font-size:.78rem;color:var(--tx-2)}',
    '.aw-kic{width:40px;height:40px;border-radius:8px;background:var(--bg-2);padding:2px;box-sizing:border-box;flex-shrink:0}',
    '.aw-chars{list-style:none;margin:0;padding:0}',
    '.aw-chars li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--bd-1);padding:8px 0}.aw-chars li:last-child{border-bottom:0}',
    '.aw-chars img,.aw-noic{width:32px;height:32px;border-radius:6px;background:var(--bg-2);flex-shrink:0}',
    '.aw-cn{flex:1;min-width:140px}.aw-cn b{display:block;font-size:.9rem;color:var(--tx-1)}.aw-cn small{font-size:.76rem;color:var(--tx-2)}',
    '.aw-sig{display:flex;gap:6px;flex-wrap:wrap}',
    '.aw-chip{font-size:.74rem;border:1px solid var(--bd-2);border-radius:999px;padding:1px 9px;color:var(--tx-1)}.aw-chip--ok{border-color:var(--color-green,#3CC48A);font-weight:700}',
    '.aw-voice{margin-top:10px}.aw-voice:empty{display:none}.aw-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.aw-voice .shv-voice__avatar{width:36px;height:36px}.aw-voice .shv-voice__label{font-size:.78rem}.aw-voice .shv-voice__body p{font-size:.86rem}',
    '.aw-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    R + ' .aw-acts .av-btn[aria-pressed=true]{background:var(--bg-2);border-color:var(--color-green,#3CC48A);font-weight:700}',
    '.aw-combo{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.aw-pick{border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);padding:6px 10px}.aw-pick small{display:block;font-size:.7rem;color:var(--tx-2)}.aw-pick b{font-size:.95rem;color:var(--tx-1)}',
    '.aw-why{flex:1;min-width:200px;font-size:.82rem;color:var(--tx-2)}',
    '.aw-lbl{margin:12px 0 6px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--tx-2)}',
    '.aw-profs{list-style:none;margin:0;padding:0;display:flex;gap:8px;flex-wrap:wrap}',
    '.aw-profs li{display:flex;align-items:center;gap:8px;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);padding:4px 10px 4px 4px;font-size:.84rem;color:var(--tx-1)}',
    '.aw-profs img{width:32px;height:32px;border-radius:6px}.aw-profs small{display:block;font-size:.7rem;color:var(--tx-2)}',
    '.aw-steps{margin:12px 0 0;padding-left:20px;font-size:.86rem;color:var(--tx-1);display:grid;gap:4px}',
    '.aw-stones{list-style:none;margin:0;padding:0;display:grid;gap:6px}',
    '.aw-stone{display:flex;align-items:center;gap:10px;width:100%;font:inherit;text-align:left;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);color:var(--tx-1);padding:6px 10px;min-height:44px;cursor:pointer;box-sizing:border-box}',
    '.aw-stone[disabled]{cursor:not-allowed;opacity:.75}.aw-stone img{width:28px;height:28px;border-radius:5px}',
    '.aw-box{width:18px;height:18px;border:2px solid var(--bd-2);border-radius:4px;flex-shrink:0;box-sizing:border-box}',
    '.aw-stone[aria-pressed=true]{border-color:var(--color-green,#3CC48A)}.aw-stone[aria-pressed=true] .aw-box{background:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A)}',
    '.aw-sn{flex:1;min-width:0}.aw-sn b{display:block;font-size:.88rem}.aw-sn small{font-size:.76rem;color:var(--tx-2)}',
    R + ' .aw-stone:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){' + R + ' .aw-acts .av-btn{min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado y DOM
  var doc = root.document;
  var st = { data: null, dataP: null, wallet: {}, walletState: {} };

  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }
  function view() { var V = root.ActView; return V && typeof V.getSnapshot === 'function' ? V.getSnapshot() : null; }
  function token() { var v = view(); return v && v.data && v.data.hasToken ? v.data.tk || null : null; }
  function fp() { var P = M(), tk = token(); return P && tk ? P.fingerprint(tk) : ''; }
  function offers() { var c = root.ActView && root.ActView._cat ? root.ActView._cat() : null; return (c && c.leivas && c.leivas.offers) || []; }
  function repaint() { if (root.ActView && typeof root.ActView.render === 'function') root.ActView.render(); }

  // Lo que marcaste esta semana para la cuenta (por huella, nunca la Key).
  function marks(now) {
    var P = M(), S = storage(), f = fp();
    if (!P || !S || !f) return null;
    return P.marksFor(S.get(STORE) || {}, f, now);
  }

  // Para los indicadores de act-view: cuántas piedras marcaste y qué confirmaste de la llave (null sin Key).
  function state(now) {
    var m = marks(now || Date.now());
    if (!m) return null;
    return { bought: Object.keys(m.stones || {}).length, keyMark: m.key };
  }

  function save(what, value) {
    var P = M(), S = storage(), f = fp();
    if (!P || !S || !f) return false;
    S.set(STORE, P.setMark(S.get(STORE) || {}, f, Date.now(), what, value));
    return true;
  }

  function ensureCss() {
    if (!doc || !doc.createElement || !doc.head || (doc.getElementById && doc.getElementById('act-week-css'))) return;
    var s = doc.createElement('style'); s.id = 'act-week-css'; s.textContent = CSS; doc.head.appendChild(s);
  }

  function loadData() {
    if (st.data || st.dataP || typeof root.fetch !== 'function') return st.dataP;
    st.dataP = root.fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('datos ' + r.status); return r.json(); })
      .then(function (d) { st.data = d; repaint(); }, function (e) { st.dataP = null; if (root.console) root.console.warn(LOG, 'datos', e); });
    return st.dataP;
  }
  function loadWallet(nocache) {
    var tk = token(), A = root.GW2Api;
    if (!tk || !A || typeof A.getAccountWallet !== 'function') return null;
    if (!nocache && st.walletState[tk]) return null;
    st.walletState[tk] = 'loading';
    return Promise.resolve().then(function () { return A.getAccountWallet(tk, { nocache: !!nocache }); })
      .then(function (w) { st.wallet[tk] = Array.isArray(w) ? w : null; st.walletState[tk] = Array.isArray(w) ? 'done' : 'error'; repaint(); },
        function () { st.walletState[tk] = 'error'; repaint(); });
  }

  // La pestaña Semana. m: el modelo de act-view (hasToken, key, clocks, lastWeekly).
  function snapshot(m) {
    var tk = token(), now = Date.now(), mk = marks(now), d = st.data || {};
    var v = view(), chars = v && v.data ? v.data.chars : null;
    return { data: d, hasToken: !!m.hasToken, loaded: !!m.loaded, mark: mk ? mk.key : undefined, weekly: m.clocks ? m.clocks.weekly : '', since: m.lastWeekly,
      key: keyModel(m.key, chars, d), stones: stones(offers(), tk ? st.wallet[tk] || null : null, mk ? mk.stones : {}, d),
      walletState: tk ? st.walletState[tk] : null };
  }
  function semana(m) { ensureCss(); loadData(); return html(snapshot(m)); }

  function afterRender(m) {
    if (!m || m.tab !== 'semana') return;
    loadData(); loadWallet(false);
    var box = doc && doc.getElementById ? doc.getElementById('awKeyVoice') : null, s = snapshot(m), msg = keyVoice(s.key, s.data, m.lastWeekly);
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text }));
  }

  function attr(t, name) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(name) != null) return n.getAttribute(name);
    return null;
  }
  function copyWp() {
    var c = root.ActView && root.ActView._cat ? root.ActView._cat() : null, wp = c && c.leivas && c.leivas.map ? c.leivas.map.waypoint : '', nav = root.navigator;
    var done = function (ok) { if (root.toast) root.toast(ok ? 'success' : 'warn', ok ? 'Copié el punto de ruta de Piedra Arbórea.' : 'No pude copiar el punto de ruta.', { ttl: 1500 }); };
    if (wp && nav && nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText(wp).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }

  // Clics de la pestaña (act-view los pasa primero acá). true = ya lo atendí.
  function onClick(e) {
    var t = e && e.target, v;
    if (!t) return false;
    if ((v = attr(t, 'data-aw-key')) != null) { save('key', v === 'yes' ? true : v === 'no' ? false : null); repaint(); return true; }
    if ((v = attr(t, 'data-aw-stone')) != null) {
      var cur = Number(v), m = marks(Date.now());
      save('stone', { currency: cur, on: !(m && m.stones && m.stones[cur]) }); repaint(); return true;
    }
    if (attr(t, 'data-aw-wp') != null) { copyWp(); return true; }
    return false;
  }

  function refresh() { return loadWallet(true); }

  root.ActWeek = {
    version: VERSION, html: semana, afterRender: afterRender, onClick: onClick, state: state, refresh: refresh,
    _pure: { signal: signal, keyModel: keyModel, keyVoice: keyVoice, stones: stones, stoneNote: stoneNote, keyHTML: keyHTML, guideHTML: guideHTML, stonesHTML: stonesHTML, html: html, CSS: CSS, STORE: STORE }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
