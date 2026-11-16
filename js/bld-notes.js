/*!
 * js/bld-notes.js — Builds: desplegables de notas de la ficha (BL-084 EQ-6)
 * Versión: 1.1.0 (2026-10-30) · EQ-7: inline(texto, ref, equipo) para que «Cómo se juega» (js/bld-play.js) use las mismas
 *          referencias con ícono y nombre oficial · antes 1.0.0
 *
 * Cuatro desplegables como en Snow Crows: notas de habilidades y de rasgos (bajo «Rasgos y habilidades») y notas de
 * equipo y de la reliquia (bajo «Equipo»). Arriba va mi nota, escrita con palabras propias (DEC-046), y debajo la
 * descripción oficial en castellano de lo que la build usa (API de Guild Wars 2): habilidades de la barra, rasgos
 * elegidos, runa, sigilos o amuleto, y reliquia. Si todavía no escribí la nota, lo digo y queda la descripción oficial.
 * Las notas viven en assets/data/builds/notes.json: { version, notes: { <id>: { patch, review, skills: [párrafos],
 * traits, gear, relic } } }. En un párrafo, {s:ID} es una habilidad, {t:ID} un rasgo y {i:ID} un objeto: la ficha pone
 * su ícono y su nombre oficial. Se lee una vez por visita, en memoria (sin estado guardado).
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var URL = 'assets/data/builds/notes.json';
  var KEYS = { skills: 'Notas de habilidades', traits: 'Notas de rasgos', gear: 'Notas de equipo', relic: 'Notas de la reliquia' };
  var OFFICIAL = 'Descripción oficial · API de Guild Wars 2 en castellano';
  var TOKEN = /\{([sti]):(\d+)\}/g;
  var st = { data: null, p: null, err: false };

  function S() { return root.GNBldShow; }
  function esc(s) {
    return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plain(s) { return String(s == null ? '' : s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function img(src, size) { return S() && src ? S().img(src, '', size, 'bld-ic') : ''; }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

  // ---------------------------------------------------------------- datos
  function load(opts) {
    opts = opts || {};
    if (st.data) return Promise.resolve(st.data);
    if (!st.p) {
      var f = opts.fetch || root.fetch;
      if (typeof f !== 'function') { st.err = true; return Promise.reject(new Error('Sin conexión.')); }
      st.p = Promise.resolve(f(URL, { cache: 'no-cache' })).then(function (r) {
        if (!r || !r.ok) throw new Error('respondió ' + (r ? r.status : 'nada'));
        return r.json();
      }).then(function (j) { st.data = (j && j.notes) || {}; st.err = false; return st.data; },
        function (e) { st.p = null; st.err = true; throw e; });
    }
    return st.p;
  }
  function loaded() { return !!st.data || st.err; }
  function noteSync(id) { return st.data && Object.prototype.hasOwnProperty.call(st.data, id) ? st.data[id] : null; }

  // ---------------------------------------------------------------- qué es cada id (puro)
  // Objetos del equipo (vista de GNBldItems.sheet) por id, para {i:ID}.
  function itemsOf(gear) {
    var m = {};
    var put = function (x) { if (x && x.id && !x.missing) m[x.id] = x; };
    if (!gear) return m;
    (gear.armor || []).forEach(function (r) { put(r.item); put(r.rune); });
    put(gear.rune); put(gear.relic); put(gear.amulet);
    (gear.trinkets || []).forEach(function (r) { put(r.item); });
    (gear.sets || []).forEach(function (s) { (s.hands || []).forEach(function (h) { put(h.item); (h.sigils || []).forEach(put); }); });
    (gear.extras || []).forEach(function (x) { put(x.item); });
    return m;
  }
  function lookup(ref, gear) {
    var items = itemsOf(gear);
    return function (k, id) {
      if (k === 's') return (ref && ref.skills && ref.skills[id]) || null;
      if (k === 't') return (ref && ref.traits && ref.traits[id]) || null;
      return items[id] || null;
    };
  }
  // Un párrafo de la nota: texto escapado; {s:ID}/{t:ID}/{i:ID} pasan a ícono y nombre oficial.
  function inlineWith(text, look) {
    return esc(text).replace(TOKEN, function (_, k, id) {
      var x = look ? look(k, Number(id)) : null;
      return x ? '<span class="bld-ntr">' + img(x.icon, 20) + '<b>' + esc(x.name) + '</b></span>' : '<b>#' + id + '</b>';
    });
  }
  function para(text, look) { return '<p>' + inlineWith(text, look) + '</p>'; }
  // EQ-7: un texto con {s|t|i:ID}, sin párrafo (lo usa js/bld-play.js).
  function inline(text, ref, gear) { return inlineWith(text, lookup(ref, gear)); }

  // Lo oficial que va debajo de cada desplegable: [{ name, icon, lines }]
  function itemLines(x) {
    var l = [];
    if (x.desc) l.push(x.desc);
    if (x.buff) l.push(x.buff);
    if (x.effect) l.push(x.effect);
    (x.bonuses || []).forEach(function (b, i) { l.push('(' + (i + 1) + ') ' + b); });
    return l;
  }
  function official(key, view, gear) {
    var out = [], seen = {};
    var add = function (x, lines) {
      if (!x || !x.name || x.missing || seen[x.name]) return;
      seen[x.name] = 1;
      out.push({ name: x.name, icon: x.icon || '', lines: lines.filter(Boolean) });
    };
    if (key === 'skills') ((view && view.land) || []).forEach(function (s) { if (s) add(s, [plain(s.description)]); });
    if (key === 'traits') ((view && view.specs) || []).forEach(function (sp) { (sp.traits || []).forEach(function (t) { if (t) add(t, [plain(t.description)]); }); });
    if (key === 'gear' && gear) {
      if (gear.rune) add(gear.rune, itemLines(gear.rune));
      (gear.armor || []).forEach(function (r) { if (r.rune) add(r.rune, itemLines(r.rune)); });
      (gear.sets || []).forEach(function (s) { (s.hands || []).forEach(function (h) { (h.sigils || []).forEach(function (g) { if (g) add(g, itemLines(g)); }); }); });
      if (gear.amulet) {
        var A = root.GNBldItems;
        add(gear.amulet, [(gear.amulet.attrs || []).map(function (a) { return (A ? A.attrName(a[0]) : a[0]) + ' ' + a[1]; }).join(', ')]);
      }
    }
    if (key === 'relic' && gear && gear.relic) add(gear.relic, itemLines(gear.relic));
    return out;
  }

  // ---------------------------------------------------------------- vista (pura)
  function blockHTML(key, m) {
    var n = m.note, ps = n && Array.isArray(n[key]) ? n[key].filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
    var body;
    if (!m.loaded) body = '<p class="bld-muted" role="status">Buscando mis notas…</p>';
    else if (ps.length) {
      var look = lookup(m.ref, m.gear);
      body = '<p class="bld-ntm"><small>Notas de Shiruvana' + (fmtDate(n.patch) ? ' · revisadas para el parche ' + fmtDate(n.patch) : '') + '</small>' +
        (n.review ? ' <span class="bld-tag is-old">para revisar: la build cambió</span>' : '') + '</p>' + ps.map(function (p) { return para(p, look); }).join('');
    } else body = '<p class="bld-muted">Nota en preparación. Mientras, abajo está la descripción oficial de lo que usa la build.</p>';
    var off = official(key, m.view, m.gear);
    var offH = off.length ? '<div class="bld-nto"><p class="bld-cap">' + OFFICIAL + '</p><ul>' + off.map(function (x) {
      return '<li>' + img(x.icon, 24) + '<div><b>' + esc(x.name) + '</b>' + x.lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div></li>';
    }).join('') + '</ul></div>' : '';
    return '<details class="bld-nt" data-note="' + key + '"><summary>' + esc(KEYS[key]) + (ps.length || !m.loaded ? '' : ' <small>(en preparación)</small>') + '</summary>' +
      '<div class="bld-ntb">' + body + offH + '</div></details>';
  }
  // m = { keys: ['skills', 'traits'], note, loaded, ref, view, gear }
  function html(m) {
    m = m || {};
    var keys = (m.keys || []).filter(function (k) { return Object.prototype.hasOwnProperty.call(KEYS, k); });
    return keys.length ? '<div class="bld-nts">' + keys.map(function (k) { return blockHTML(k, m); }).join('') + '</div>' : '';
  }

  // ---------------------------------------------------------------- CSS (tokens de los 19 temas)
  var P_ = '#buildsPanel ';
  var CSS = [
    P_ + '.bld-nts{display:grid;gap:6px}',
    P_ + '.bld-nt{border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0)}',
    P_ + '.bld-nt>summary{cursor:pointer;padding:8px 12px;color:var(--tx-1);font-weight:600}' + P_ + '.bld-nt>summary small{font-weight:400;color:var(--tx-2)}',
    P_ + '.bld-nt>summary:focus-visible{outline:2px solid var(--gn-mod);outline-offset:2px}',
    P_ + '.bld-ntb{display:grid;gap:8px;padding:4px 12px 12px;font-size:.88rem;color:var(--tx-1)}' + P_ + '.bld-ntb p{margin:0}',
    P_ + '.bld-ntm small{color:var(--tx-2)}',
    P_ + '.bld-ntr{display:inline-flex;align-items:center;gap:4px;vertical-align:middle}' + P_ + '.bld-ntr img,' + P_ + '.bld-nto img{border-radius:4px}',
    P_ + '.bld-nto{border-top:1px solid var(--bd-1);padding-top:8px}' + P_ + '.bld-nto ul{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:8px}',
    P_ + '.bld-nto li{display:flex;gap:8px;align-items:flex-start}' + P_ + '.bld-nto li>div{display:grid;gap:2px}',
    P_ + '.bld-nto span{color:var(--tx-2);font-size:.82rem}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-notes-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-notes-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  var api = { version: VERSION, URL: URL, KEYS: KEYS, load: load, loaded: loaded, noteSync: noteSync, html: html, inline: inline, ensureCss: ensureCss,
    _pure: { itemsOf: itemsOf, lookup: lookup, para: para, official: official, blockHTML: blockHTML, CSS: CSS, TOKEN: TOKEN },
    _test: { reset: function () { st = { data: null, p: null, err: false }; } } };
  root.GNBldNotes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
