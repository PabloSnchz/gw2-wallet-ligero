/*!
 * js/bld-rows.js — Builds: la lista de la Biblioteca en filas, agrupada por profesión y élite (BL-084 EQ-3b)
 * Versión: 1.0.0 (2026-10-30)
 *
 * La estructura de Snow Crows con nuestro marco (maqueta docs/propuestas/bld2-biblioteca.html): un grupo por profesión
 * (con su color oficial), adentro una columna por élite y una fila por build: nombre, armas, modo y dificultad,
 * etiquetas (vigente, daño, rol) y el DPS del bench con su barra. Toda la fila es un enlace a su ficha
 * (#/builds/ver/<id>, js/bld-sheet.js): se abre con clic, con Enter o en otra pestaña.
 * Con «Más DPS primero» la lista es plana (sin grupos) y cada fila lleva el emblema de su élite.
 * Puro: no pide nada ni guarda nada; js/bld-lib.js le pasa la lista ya filtrada y ordenada y sus funciones (_pure).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';

  function S() { return root.GNBldShow; }
  function esc(s) { return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emblem(prof, elite, size, label) { return S() && S().emblem ? S().emblem(prof, elite, size, { label: !!label }) : ''; }
  function ident() { var R = root.GNBldRef; return R && typeof R.identitySync === 'function' ? R.identitySync() : null; }
  function profColor(p) { var V = root.GNBld, c = V && V._pure && V._pure.PROF_COLOR && V._pure.PROF_COLOR[p]; return /^#[0-9A-Fa-f]{6}$/.test(c || '') ? c : ''; }
  function profName(p, idn) { var C = root.GNBldCode; return (idn && idn.profs && idn.profs[p] && idn.profs[p].name) || (C && C.PROF_ES && C.PROF_ES[p]) || ''; }
  function eliteName(b, idn) { return (idn && idn.elites && idn.elites[b.elite] && idn.elites[b.elite].name) || b.eliteName || ''; }

  // ---------------------------------------------------------------- modelo (puro)
  // Agrupa respetando el orden de la lista: [{ prof, builds, elites: [{ elite, name, builds }] }].
  function group(list, idn) {
    var out = [], byProf = {};
    (list || []).forEach(function (b) {
      var g = byProf[b.prof];
      if (!g) { g = byProf[b.prof] = { prof: b.prof, builds: [], elites: [], byEl: {} }; out.push(g); }
      var e = g.byEl[b.elite];
      if (!e) { e = g.byEl[b.elite] = { elite: b.elite, name: eliteName(b, idn), builds: [] }; g.elites.push(e); }
      e.builds.push(b); g.builds.push(b);
    });
    out.forEach(function (g) { delete g.byEl; });
    return out;
  }

  // ---------------------------------------------------------------- vista (pura)
  // o = { lib (GNBldLib._pure), latest, idx (bench), flat }
  function dpsHTML(b, o) {
    var P = o.lib || {}, m = P.benchOf ? P.benchOf(b, o.idx) : null;
    if (m && o.idx && o.idx.top) {
      var pct = Math.max(1, Math.min(100, Math.round(m.max / o.idx.top * 100)));
      return '<span class="bld-rdps" title="Bench de Snow Crows contra el golem: el techo ideal de la build"><b>' + (P.fmtN ? P.fmtN(m.max) : m.max) + '</b> DPS · ' + pct + ' %' +
        '<span class="bld-rbar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></span>';
    }
    var M = P.MODES || {};
    return '<span class="bld-rdps is-none">' + (b.mode !== 'pve' ? 'Sin golem en ' + esc(M[b.mode] || b.mode) : 'Sin bench propio · referencia en la ficha') + '</span>';
  }
  function rowHTML(b, o) {
    var P = o.lib || {}, C = root.GNBldCode, W = (C && C.WEAPONS_ES) || {}, M = P.MODES || {}, SUB = P.SUB || {}, R = P.ROLES || {}, D = P.DAMAGE || {};
    var s = P.stateOf ? P.stateOf(b, o.latest) : 'vigente';
    var meta = [(b.weapons || []).map(function (w) { return W[w] || w; }).join(' y '), (M[b.mode] || b.mode) + (b.sub ? ' (' + (SUB[b.sub] || b.sub) + ')' : ''),
      'dificultad ' + (b.difficulty || '?') + '/5'].filter(Boolean);
    var tags = ['<span class="bld-tag ' + (s === 'vigente' ? 'is-ok' : 'is-old') + '">' + (s === 'vigente' ? 'vigente' : 'revisar') + '</span>'];
    if (b.damage) tags.push('<span class="bld-tag">' + esc(D[b.damage] || b.damage) + '</span>');
    (b.roles || []).forEach(function (r) { if (r !== 'dps') tags.push('<span class="bld-tag is-boon">' + esc(R[r] || r) + '</span>'); });
    var c = o.flat ? profColor(b.prof) : '';
    return '<a class="bld-row' + (o.flat ? ' is-flat' : '') + '" href="#/builds/ver/' + encodeURIComponent(b.id) + '" data-id="' + esc(b.id) + '"' + (c ? ' style="--bld-prof:' + c + '"' : '') + '>' +
      (o.flat ? emblem(b.prof, b.elite, 32, true) : '') +
      '<span class="bld-rt"><b>' + esc(b.name) + '</b><small>' + esc(meta.join(' · ')) + '</small></span>' +
      '<span class="bld-rtags">' + tags.join('') + '</span>' + dpsHTML(b, o) + '<span class="bld-rgo" aria-hidden="true">›</span></a>';
  }
  function listHTML(list, o) {
    o = o || {};
    var idn = ident();
    if (o.flat) return '<div class="bld-rlist is-flat">' + list.map(function (b) { return rowHTML(b, o); }).join('') + '</div>';
    return group(list, idn).map(function (g) {
      var c = profColor(g.prof), name = profName(g.prof, idn);
      return '<section class="bld-grp" aria-label="' + esc(name) + '"' + (c ? ' style="--bld-prof:' + c + '"' : '') + '>' +
        '<h3 class="bld-grp-h">' + emblem(g.prof, 0, 24, false) + '<span>' + esc(name) + '</span><small>' + g.elites.length + (g.elites.length === 1 ? ' élite' : ' élites') +
        ' · ' + g.builds.length + (g.builds.length === 1 ? ' build' : ' builds') + '</small></h3>' +
        g.elites.map(function (e) {
          return '<div class="bld-eg"><div class="bld-eg-n">' + emblem(g.prof, e.elite, 32, false) + '<b>' + esc(e.name) + '</b></div>' +
            '<div class="bld-eg-r">' + e.builds.map(function (b) { return rowHTML(b, o); }).join('') + '</div></div>';
        }).join('') + '</section>';
    }).join('');
  }

  // ---------------------------------------------------------------- CSS (tokens de los temas; el color de la profesión al 8 %, como las tarjetas)
  var P_ = '#buildsPanel ';
  var TINT = 'color-mix(in srgb,var(--bld-prof,var(--gn-mod)) 8%,';
  var CSS = [
    P_ + '.bld-grp{margin:0 0 14px;border:1px solid var(--bd-1);border-radius:14px;overflow:hidden;background:var(--bg-1);box-shadow:inset 3px 0 0 var(--bld-prof,var(--gn-mod))}',
    P_ + '.bld-grp-h{margin:0;padding:9px 16px;display:flex;gap:10px;align-items:center;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase;color:var(--tx-1);' +
      'background:linear-gradient(90deg,' + TINT + 'var(--bg-2)),var(--bg-2) 60%);border-bottom:1px solid var(--bd-1)}',
    P_ + '.bld-grp-h small{margin-left:auto;font-weight:400;text-transform:none;letter-spacing:0;color:var(--tx-2)}' + P_ + '.bld-grp-h .bld-emb{background:none;box-shadow:none;padding:0}',
    P_ + '.bld-eg{display:grid;grid-template-columns:170px minmax(0,1fr);border-bottom:1px solid var(--bd-1)}' + P_ + '.bld-eg:last-child{border-bottom:0}',
    P_ + '.bld-eg-n{padding:10px 14px;display:flex;gap:10px;align-items:center;border-right:1px solid var(--bd-1);background:linear-gradient(135deg,' + TINT + 'var(--bg-1)),var(--bg-1));color:var(--tx-1)}',
    P_ + '.bld-eg-n .bld-emb{border-radius:50%;box-shadow:0 0 0 2px var(--bld-prof,var(--gn-mod));padding:2px}' + P_ + '.bld-eg-n b{font-size:.88rem}',
    P_ + '.bld-eg-r,' + P_ + '.bld-rlist{display:grid}' + P_ + '.bld-rlist.is-flat{border:1px solid var(--bd-1);border-radius:14px;overflow:hidden;background:var(--bg-1)}',
    P_ + '.bld-row{position:relative;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) 170px 20px;gap:12px;align-items:center;padding:10px 14px;color:var(--tx-1);text-decoration:none;' +
      'border-bottom:1px solid var(--bd-1)}' + P_ + '.bld-row:last-child{border-bottom:0}',
    P_ + '.bld-row.is-flat{grid-template-columns:auto minmax(0,1.6fr) minmax(0,1fr) 170px 20px}',
    P_ + '.bld-row:hover,' + P_ + '.bld-row:focus-visible{background:' + TINT + 'var(--bg-1))}',
    P_ + '.bld-row:hover::before,' + P_ + '.bld-row:focus-visible::before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:3px;border-radius:3px;background:var(--bld-prof,var(--gn-mod))}',
    P_ + '.bld-rt{display:grid;min-width:0}' + P_ + '.bld-rt b{font-weight:600}' + P_ + '.bld-rt small{color:var(--tx-2);font-size:.76rem}',
    P_ + '.bld-rtags{display:flex;flex-wrap:wrap;gap:4px}' + P_ + '.bld-rtags .bld-tag{border-color:var(--bd-1);background:var(--bg-0)}' + P_ + '.bld-rtags .bld-tag.is-boon{border-color:var(--gn-mod)}',
    P_ + '.bld-rtags .bld-tag.is-ok{border-color:var(--color-green,#3fb950)}' + P_ + '.bld-rtags .bld-tag.is-old{border-color:var(--color-amber,#F2B94B)}',
    P_ + '.bld-rdps{font-size:.78rem;color:var(--tx-2)}' + P_ + '.bld-rdps b{color:var(--tx-1);font-size:.9rem}' + P_ + '.bld-rdps.is-none{font-size:.72rem}',
    P_ + '.bld-rbar{display:block;height:5px;margin-top:3px;border-radius:999px;background:var(--bg-0);box-shadow:inset 0 0 0 1px var(--bd-1);overflow:hidden}' +
      P_ + '.bld-rbar>i{display:block;height:100%;border-radius:999px;background:var(--bld-prof,var(--gn-mod))}',
    P_ + '.bld-rgo{color:var(--tx-2);font-size:1.1rem;text-align:right}',
    '@media (max-width:820px){' + P_ + '.bld-eg{grid-template-columns:1fr}' + P_ + '.bld-eg-n{border-right:0;border-bottom:1px solid var(--bd-1)}' +
      P_ + '.bld-row,' + P_ + '.bld-row.is-flat{grid-template-columns:minmax(0,1fr) 20px;gap:6px 10px}' + P_ + '.bld-row>.bld-emb{display:none}' +
      P_ + '.bld-rtags,' + P_ + '.bld-rdps{grid-column:1}' + P_ + '.bld-rgo{grid-row:1;grid-column:2}}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-rows-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-rows-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  var api = { version: VERSION, listHTML: listHTML, ensureCss: ensureCss, _pure: { group: group, rowHTML: rowHTML, dpsHTML: dpsHTML, CSS: CSS } };
  root.GNBldRows = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
