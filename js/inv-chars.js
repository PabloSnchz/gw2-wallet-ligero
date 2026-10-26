/*!
 * js/inv-chars.js — Personajes: la pestaña de tus personajes en Inventario y Personajes (BL-070, INV-5)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.1 (2026-10-25) — INV-6: cada ítem de «Qué lleva» abre la ficha del ítem
 *          1.0.0 (2026-10-25) — INV-5: Personajes renovado, como pestaña del módulo
 *
 * Una tarjeta por personaje con lo que la API sí informa:
 *  - nombre, nivel, profesión y especialización de élite (la de su build de JcE) con el ícono oficial;
 *  - raza, oficios con su nivel (los activos primero), tiempo jugado y cumpleaños (cuándo lo creaste y
 *    cuántos años cumple; si es hoy, lo digo);
 *  - «Qué lleva»: lo que hay en sus bolsas, con ícono y cantidad.
 * D2: sin Mapa ni Punto de interés (la API no informa dónde está un personaje); las asignaciones viejas
 * no se tocan. Filtros: profesión y nombre (sin tildes ni mayúsculas).
 * Datos: /v2/characters?ids=all con el lector del Multicuenta (InvMulti.read, la misma caché de 5 minutos
 * que Buscar); se pide al abrir la pestaña (D1). Nombres en español de profesiones, élites, razas y oficios
 * en assets/data/inventory/professions.json (verificados en la API y la wiki oficial).
 * Se suma como pestaña con InvView.register (después de Armería legendaria); se carga por js/modules.json.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.1';
  var LOG = '[InvChars]';
  var DATA_URL = 'assets/data/inventory/professions.json';

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
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // La élite: la tercera línea de la build de JcE (formato viejo) o de la pestaña de build activa (nuevo).
  function eliteOf(c, data) {
    var el = (data && data.elites) || {}, lines = null;
    if (c && c.specializations && Array.isArray(c.specializations.pve)) lines = c.specializations.pve;
    else if (c && Array.isArray(c.build_tabs)) {
      var on = c.build_tabs.filter(function (t) { return t && t.is_active; })[0] || c.build_tabs[0];
      lines = on && on.build && on.build.specializations;
    }
    if (!Array.isArray(lines)) return null;
    for (var i = lines.length - 1; i >= 0; i--) {
      var id = lines[i] && lines[i].id;
      if (id && el[id] && el[id].profession === c.profession) return { id: id, name: el[id].name, icon: el[id].icon };
    }
    return null;
  }

  function hours(sec) { return Math.floor((Number(sec) || 0) / 3600); }
  function played(sec) {
    var h = hours(sec);
    if (h < 1) return 'menos de 1 hora';
    return fmtInt(h) + (h === 1 ? ' hora' : ' horas');
  }

  // Cumpleaños en UTC: cuándo lo creaste, cuántos años cumple y cuándo.
  function birthday(created, now) {
    var d = created ? new Date(created) : null;
    if (!d || isNaN(d.getTime())) return null;
    var n = now || new Date();
    var y = n.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    var today = Date.UTC(y, n.getUTCMonth(), n.getUTCDate());
    var next = Date.UTC(y, m, day);
    if (next < today) { y++; next = Date.UTC(y, m, day); }
    var years = y - d.getUTCFullYear();
    return { created: pad(day) + '/' + pad(m + 1) + '/' + d.getUTCFullYear(), years: years, today: next === today,
      days: Math.round((next - today) / 86400000), next: pad(day) + '/' + pad(m + 1) + '/' + y };
  }
  function birthdayText(b) {
    if (!b) return '';
    if (b.years < 1) return 'Creado el ' + b.created + '.';
    if (b.today) return 'Hoy cumple ' + b.years + (b.years === 1 ? ' año' : ' años') + '.';
    return 'Cumple ' + b.years + (b.years === 1 ? ' año' : ' años') + ' el ' + b.next + (b.days === 1 ? ' (mañana)' : ' (en ' + b.days + ' días)') + '.';
  }

  function crafting(c, data) {
    var names = (data && data.crafting) || {};
    return (Array.isArray(c.crafting) ? c.crafting : []).slice()
      .sort(function (a, b) { return (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.rating || 0) - (a.rating || 0); })
      .map(function (x) { return { name: names[x.discipline] || x.discipline, rating: x.rating || 0, active: !!x.active }; });
  }

  function raceText(c, data) {
    var r = data && data.races && data.races[c.race];
    if (!r) return c.race || '';
    return c.gender === 'Female' ? r[1] : r[0];
  }

  // Lo que lleva en las bolsas, sumado por ítem.
  function carried(c) {
    var by = {}, out = [];
    (Array.isArray(c.bags) ? c.bags : []).forEach(function (b) {
      if (!b || !Array.isArray(b.inventory)) return;
      b.inventory.forEach(function (s) {
        if (!s || !s.id) return;
        if (!by[s.id]) { by[s.id] = { id: s.id, count: 0 }; out.push(by[s.id]); }
        by[s.id].count += s.count || 1;
      });
    });
    return out;
  }

  // chars: lista de /v2/characters; ui: { q, prof }; now: Date.
  function model(chars, data, ui, now) {
    ui = ui || {};
    var list = (Array.isArray(chars) ? chars : []).filter(function (c) { return c && c.name; }).map(function (c) {
      var p = data && data.professions && data.professions[c.profession];
      return { name: c.name, level: c.level || 0, profession: c.profession, profName: p ? p.name : c.profession, profIcon: p ? p.icon : null,
        elite: eliteOf(c, data), race: raceText(c, data), age: c.age || 0, deaths: c.deaths, crafting: crafting(c, data),
        birthday: birthday(c.created, now), carried: carried(c) };
    });
    var profs = [];
    list.forEach(function (c) { if (profs.indexOf(c.profession) < 0) profs.push(c.profession); });
    profs.sort(function (a, b) { return String((data.professions[a] || {}).name || a).localeCompare(String((data.professions[b] || {}).name || b), 'es'); });
    var q = fold(ui.q).trim(), prof = profs.indexOf(ui.prof) >= 0 ? ui.prof : '';
    var shown = list.filter(function (c) { return (!prof || c.profession === prof) && (!q || fold(c.name).indexOf(q) >= 0); });
    return { all: list, shown: shown, profs: profs, prof: prof, q: ui.q || '',
      total: { count: list.length, max: list.filter(function (c) { return c.level >= 80; }).length,
        hours: list.reduce(function (s, c) { return s + hours(c.age); }, 0),
        birthdays: list.filter(function (c) { return c.birthday && c.birthday.today && c.birthday.years > 0; }).map(function (c) { return c.name; }) } };
  }

  function summaryText(m) {
    var t = m.total;
    if (!t.count) return '';
    var s = (t.count === 1 ? '1 personaje' : fmtInt(t.count) + ' personajes') + ', ' + fmtInt(t.max) + ' en nivel 80 y ' + fmtInt(t.hours) + ' horas jugadas entre todos.';
    if (t.birthdays.length) s += ' Hoy ' + (t.birthdays.length === 1 ? 'cumple años ' + t.birthdays[0] : 'cumplen años ' + t.birthdays.join(', ')) + '.';
    return s;
  }

  function cardHTML(c, items, open) {
    var ic = c.elite ? c.elite.icon : c.profIcon, spec = c.elite ? c.elite.name : c.profName;
    var id = 'icB-' + fold(c.name).replace(/[^a-z0-9]+/g, '-');
    var h = '<li class="ic-card"><div class="ic-top"><span class="ic-ico">' + (ic ? '<img src="' + esc(ic) + '" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>' +
      '<div class="ic-id"><h3>' + esc(c.name) + '</h3><p>Nivel ' + c.level + ' · ' + esc(spec) + (c.elite ? ' <span class="ic-prof">(' + esc(c.profName) + ')</span>' : '') + ' · ' + esc(c.race) + '</p></div></div>';
    h += '<dl class="ic-dl"><div><dt>Tiempo jugado</dt><dd>' + esc(played(c.age)) + '</dd></div>';
    h += '<div><dt>Cumpleaños</dt><dd>' + (c.birthday ? esc(birthdayText(c.birthday)) + (c.birthday.years >= 1 ? ' <small>Creado el ' + esc(c.birthday.created) + '.</small>' : '') : 'sin datos') + '</dd></div>';
    h += '<div><dt>Oficios</dt><dd>' + (c.crafting.length ? c.crafting.map(function (x) {
      return esc(x.name) + ' ' + x.rating + (x.active ? '' : ' <small>(inactivo)</small>');
    }).join(' · ') : 'ninguno') + '</dd></div></dl>';
    var n = c.carried.length;
    h += '<button type="button" class="iv-btn ic-bags" id="' + id + '" data-ic-bags="' + esc(c.name) + '" aria-expanded="' + !!open + '">' +
      (n ? 'Qué lleva (' + n + (n === 1 ? ' ítem' : ' ítems') + ')' : 'Sus bolsas están vacías') + '</button>';
    if (open && n) {
      h += '<ul class="ic-items">' + c.carried.map(function (s) {
        var meta = items[s.id] || {};
        return '<li><button type="button" class="iv-open" data-inv-item="' + s.id + '" aria-haspopup="dialog">' + (meta.icon ? '<img src="' + esc(meta.icon) + '" alt="" width="24" height="24" loading="lazy" referrerpolicy="no-referrer">' : '') +
          '<span>' + esc(meta.name || 'Ítem ' + s.id) + '</span><b>' + fmtInt(s.count) + '</b></button></li>';
      }).join('') + '</ul>';
    }
    return h + '</li>';
  }

  // s: { hasToken, state: 'idle'|'loading'|'done'|'error', m, items, open }
  function html(s) {
    if (!s.hasToken) return '<p class="iv-note">Sin API Key no puedo leer tus personajes.</p>';
    if (s.state === 'error') return '<p class="iv-err" role="status">No pude leer tus personajes. Revisá que la API Key tenga permiso de personajes e inventarios.</p>';
    if (s.state !== 'done' || !s.m) return '<p class="iv-note" role="status">Leyendo tus personajes…</p>';
    var m = s.m;
    if (!m.all.length) return '<p class="iv-note">Esta cuenta todavía no tiene personajes.</p>';
    var h = '<p class="ic-sum" role="status">' + esc(summaryText(m)) + (m.shown.length < m.all.length ? ' Te muestro ' + m.shown.length + '.' : '') + '</p>';
    if (!m.shown.length) return h + '<p class="iv-note">Ningún personaje coincide con el filtro.</p>';
    return h + '<ul class="ic-list">' + m.shown.map(function (c) { return cardHTML(c, s.items || {}, s.open === c.name); }).join('') + '</ul>' +
      '<p class="iv-src">La API no informa dónde está cada personaje, por eso ya no muestro mapa ni punto de interés.</p>';
  }

  function toolsHTML(m, data, q) {
    var h = '<label class="iv-search"><span class="iv-sr">Buscar personaje por nombre</span><input type="search" id="icQ" placeholder="Buscar personaje…" value="' + esc(q) + '" autocomplete="off" spellcheck="false"></label>';
    if (m && m.profs.length > 1) {
      h += '<label class="iv-sel"><span class="iv-sr">Profesión</span><select id="icProf"><option value="">Todas las profesiones</option>';
      m.profs.forEach(function (p) { h += '<option value="' + esc(p) + '"' + (p === m.prof ? ' selected' : '') + '>' + esc((data.professions[p] || {}).name || p) + '</option>'; });
      h += '</select></label>';
    }
    return h;
  }

  var CSS = [
    '.ic-sum{margin:0 0 10px;font-size:.86rem;color:var(--tx-2)}',
    '.ic-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}',
    '.ic-card{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:12px 14px;min-width:0}',
    '.ic-top{display:flex;gap:10px;align-items:center}',
    '.ic-ico{width:44px;height:44px;border-radius:10px;background:var(--bg-2);box-shadow:inset 0 0 0 2px var(--bd-2);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.ic-ico img{width:36px;height:36px}',
    '.ic-id{min-width:0}.ic-id h3{margin:0;font-size:1rem;color:var(--tx-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ic-id p{margin:2px 0 0;font-size:.8rem;color:var(--tx-2)}.ic-prof{color:var(--tx-2)}',
    '.ic-dl{margin:10px 0;display:grid;gap:6px}.ic-dl div{display:grid;grid-template-columns:110px 1fr;gap:8px}',
    '.ic-dl dt{font-size:.74rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.04em}.ic-dl dd{margin:0;font-size:.84rem;color:var(--tx-1)}',
    '.ic-dl small{display:block;font-size:.74rem;color:var(--tx-2)}',
    '.ic-items{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px;max-height:280px;overflow:auto}',
    '.ic-items li{display:flex;gap:8px;align-items:center;font-size:.82rem;color:var(--tx-1)}.ic-items span{flex:1;min-width:0}.ic-items b{color:var(--tx-1)}',
    '.ic-items img{border-radius:6px;flex-shrink:0}',
    '@media (max-width:900px){.ic-bags{min-height:44px}.ic-list{grid-template-columns:1fr}.ic-dl div{grid-template-columns:96px 1fr}}'
  ].join('\n');

  // ------------------------------------------------------------------ datos y DOM
  var doc = root.document;
  var st = { data: null, dataP: null, tk: null, state: 'idle', chars: null, meta: {}, q: '', prof: '', open: null, seq: 0, timer: null };

  function view() { var V = root.InvView; return V && typeof V.getSnapshot === 'function' ? V.getSnapshot().data || {} : {}; }

  function paint() {
    if (st.timer) return;
    st.timer = setTimeout(function () {
      st.timer = null;
      if (root.InvView && typeof root.InvView.renderTab === 'function') root.InvView.renderTab('chars');
    }, 60);
  }

  function loadData() {
    if (st.data) return Promise.resolve(st.data);
    if (st.dataP) return st.dataP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.dataP = root.fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('profesiones ' + r.status); return r.json(); })
      .then(function (j) { st.data = j; return j; })
      .catch(function (e) { st.dataP = null; if (root.console) root.console.warn(LOG, 'profesiones', e); return null; });
    return st.dataP;
  }

  function load(nocache) {
    var d = view(), tk = d.tk, my = ++st.seq, R = root.InvMulti && root.InvMulti.read;
    st.tk = tk || null;
    if (!tk) { st.state = 'idle'; return Promise.resolve(); }
    st.state = 'loading';
    paint();
    var read = typeof R === 'function' ? R('/v2/characters?ids=all', tk, !!nocache) : Promise.reject(new Error('sin lector'));
    return Promise.all([loadData(), read.then(function (v) { return v; }, function (e) { return { error: e }; })]).then(function (r) {
      if (my !== st.seq) return;
      if (!r[0] || !Array.isArray(r[1])) { st.state = 'error'; paint(); return; }
      st.chars = r[1];
      st.state = 'done';
      paint();
    });
  }

  // Nombres e íconos de lo que lleva, cuando abrís sus bolsas.
  function names(c) {
    var A = root.GW2Api, known = view().items || {}, ids = [];
    carried(c).forEach(function (s) { if (!known[s.id] && !st.meta[s.id]) ids.push(s.id); });
    if (!ids.length || !A || typeof A.getItemsMany !== 'function') return;
    A.getItemsMany(ids, { nocache: false }).then(function (r) {
      (r || []).forEach(function (it) { if (it && it.id) st.meta[it.id] = { name: it.name, icon: it.icon }; });
      paint();
    }, function (e) { if (root.console) root.console.warn(LOG, 'ítems', e); });
  }

  function snapshot() {
    var d = view();
    if (d.tk !== st.tk && st.state !== 'idle') { st.state = 'idle'; st.chars = null; st.open = null; }
    var m = st.state === 'done' && st.data ? model(st.chars, st.data, { q: st.q, prof: st.prof }, new Date()) : null;
    var items = {}, k, known = d.items || {};
    for (k in st.meta) items[k] = st.meta[k];
    for (k in known) items[k] = known[k];
    return { hasToken: !!d.hasToken, state: st.state, m: m, items: items, open: st.open };
  }

  function attr(t, name) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) if (n.getAttribute && n.getAttribute(name) != null) return n.getAttribute(name);
    return null;
  }

  function onEvent(e) {
    var t = e && e.target, v;
    if (!t) return false;
    if ((e.type === 'input' || e.type === 'change') && t.id === 'icQ') { st.q = String(t.value || ''); paint(); return true; }
    if (e.type === 'change' && t.id === 'icProf') { st.prof = String(t.value || ''); if (root.InvView && root.InvView.render) root.InvView.render(); return true; }
    if (e.type === 'click' && (v = attr(t, 'data-ic-bags')) != null) {
      st.open = st.open === v ? null : v;
      var c = (st.chars || []).filter(function (x) { return x && x.name === v; })[0];
      if (st.open && c) names(c);
      paint();
      return true;
    }
    return false;
  }

  function ensureCss() {
    if (!doc || !doc.createElement || !doc.head || (doc.getElementById && doc.getElementById('inv-chars-css'))) return;
    var s = doc.createElement('style');
    s.id = 'inv-chars-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  var TAB = {
    id: 'chars', label: 'Personajes', order: 100,
    html: function () { ensureCss(); return html(snapshot()); },
    tools: function () { var s = snapshot(); return toolsHTML(s.m, st.data || {}, st.q); },
    onEvent: onEvent,
    onShow: function () { var d = view(); if (d.tk && (st.state === 'idle' || d.tk !== st.tk)) load(false); },
    refresh: function (nocache) { return st.state === 'idle' ? Promise.resolve() : load(nocache); }
  };

  function register() {
    if (root.InvView && typeof root.InvView.register === 'function') { root.InvView.register(TAB); return true; }
    return false;
  }
  if (!register() && doc && doc.addEventListener) {
    doc.addEventListener('DOMContentLoaded', register);
    doc.addEventListener('gn:boot-ready', register);
  }

  root.InvChars = {
    version: VERSION, tab: TAB,
    getSnapshot: function () { return { state: st.state, q: st.q, prof: st.prof, open: st.open }; },
    _pure: { esc: esc, eliteOf: eliteOf, played: played, birthday: birthday, birthdayText: birthdayText, crafting: crafting, raceText: raceText,
      carried: carried, model: model, summaryText: summaryText, html: html, toolsHTML: toolsHTML, CSS: CSS }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
