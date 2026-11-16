/*!
 * js/bld-import.js — Builds: pestaña Importar (BL-082 BLD-4, C1 y D3)
 * Versión: 1.1.0 (2026-11-15) · BL-084 EQ-9b: la build importada se ve con la misma ficha que la Biblioteca: emblema,
 *          «Rasgos y habilidades» como en el juego (js/bld-traitview.js) y, si el código es el de una build de la
 *          Biblioteca, su equipo (js/bld-gearview.js), «Copiar AE2 (Alter Ego)» y el enlace a su ficha; con un ref viejo
 *          o sin esos módulos, la vista de antes · antes 1.0.0 (2026-10-28)
 *
 * Pegás un código del juego ([&DQ…]) y ves la build completa con nombres en castellano, o un error claro.
 * Lee también los enlaces para compartir (#/builds/c/<código>). Valida contra la API oficial (js/bld-ref.js):
 * profesión, líneas, rasgos, habilidades en su casillero, armas, mascotas y leyendas.
 * Desde la ficha: copiar, compartir, abrir en gw2skills, guardar en Mis builds o llevarla al Editor.
 * Si js/bld-ae2.js está cargado, también acepta códigos AE2 (equipo completo, etapa 2).
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var st = { text: '', result: null, view: null, checks: null, loading: false, error: '', reqId: 0,
    ref: null, build: null, lib: null, gear: undefined };

  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }

  function formHTML() {
    return '<form class="bld-card bld-imp" id="bldImpForm" autocomplete="off">' +
      '<label for="bldImpText"><b>Pegá el código de la build</b> <span class="bld-muted">(el que copiás en el juego desde la plantilla, o un enlace de la Bóveda)</span></label>' +
      '<textarea id="bldImpText" rows="3" maxlength="700" spellcheck="false" placeholder="[&amp;DQ…]">' + esc(st.text) + '</textarea>' +
      '<div class="bld-acts"><button type="submit" class="bld-btn">Leer la build</button>' +
      '<button type="button" class="bld-btn" data-bld-imp="clear">Limpiar</button></div>' +
      '</form>';
  }

  // ---------------------------------------------------------------- EQ-9b: la misma ficha que la Biblioteca
  function eliteOf(v) { return ((v && v.specs) || []).filter(function (s) { return s && s.elite; })[0] || null; }
  function titleOf() {
    var r = st.result, v = st.view, el = eliteOf(v);
    if (r && r.ae2 && r.ae2.name) return r.ae2.name;
    if (st.lib) return st.lib.name;
    return v ? ((el ? el.name : v.profName) + ' importada') : 'Build';
  }
  function canSheet() {
    var TV = root.GNBldTraitView;
    return !!(TV && root.GNBldShow && st.ref && st.build && TV.ready(st.ref));
  }
  function gearPartHTML() {
    var r = st.result, b = st.lib, GV = root.GNBldGearView;
    if (r.ae2 && root.GNBldAe2) return root.GNBldAe2.gearHTML(r.ae2);
    if (!b) {
      return '<p class="bld-muted">El código del juego no trae el equipo. Si es una build de la Biblioteca, lo muestro solo; si no, ' +
        'elegilo en el Editor («Equipo y código AE2») o pegá acá un código AE2.</p>';
    }
    if (st.gear === undefined) return '<p class="bld-muted" role="status">Es «' + esc(b.name) + '» de la Biblioteca: busco su equipo en la API del juego…</p>';
    if (!st.gear) return '<p class="bld-muted">Es «' + esc(b.name) + '» de la Biblioteca, pero no pude traer su equipo: probá abrir su ficha.</p>';
    return '<p class="bld-muted bld-gsum">Es «' + esc(b.name) + '» de la Biblioteca (mismo código): este es su equipo.</p>' +
      (GV ? GV.html(st.gear, b) : '<p class="bld-muted">No pude mostrar el equipo: recargá la página.</p>');
  }
  function sheetHTML() {
    var S = root.GNBldShow, v = st.view, r = st.result, el = eliteOf(v), b = st.lib;
    var emb = S.emblem ? S.emblem(st.build.profession, el ? el.id : 0, 56, { label: true }) : '';
    var ae2 = b && st.gear && root.GNBldAe2 && typeof root.GNBldAe2.fromSheetCode === 'function'
      ? '<button type="button" class="bld-btn" data-bld-imp="ae2" title="Con estadísticas, runa, sigilos y reliquia, para el complemento Alter Ego">Copiar AE2 (Alter Ego)</button>' : '';
    var open = b ? '<button type="button" class="bld-btn" data-bld-imp="open">Ver su ficha en la Biblioteca</button>' : '';
    var tv = root.GNBldTraitView.html({ build: st.build, ref: st.ref, view: v, checks: st.checks, code: r.code, gear: st.gear || null,
      title: titleOf(), actions: ['share', 'gw2skills', 'edit'] });
    return '<article class="bld-card bld-imp-sheet" aria-labelledby="bldImpTitle">' +
      '<header class="bld-imp-h">' + emb + '<div><h3 id="bldImpTitle">' + esc(titleOf()) + '</h3>' +
      '<p class="bld-muted">' + esc(v.profName) + (el ? ' · ' + esc(el.name) : '') + (r.ae2 ? ' · código AE2 (' + esc(r.ae2.mode || 'PvE') + ')' : '') + '</p></div></header>' +
      '<div class="bld-acts"><button type="button" class="bld-btn is-primary" data-bld-act="copy">Copiar código</button>' +
      '<button type="button" class="bld-btn" data-bld-act="save">Guardar en Mis builds</button>' + ae2 + open + '</div>' +
      '<section class="bld-imp-sec" aria-labelledby="bldImpGear"><h4 id="bldImpGear">Equipo</h4>' + gearPartHTML() + '</section>' +
      '<section class="bld-imp-sec" aria-labelledby="bldImpTraits"><h4 id="bldImpTraits">Rasgos y habilidades</h4>' + tv + '</section>' +
      '</article>';
  }

  function resultHTML() {
    if (st.loading) return '<div class="bld-card" role="status"><p>Leyendo la build y buscando los nombres en la API del juego…</p></div>';
    if (st.error) return '<div class="bld-card bld-err" role="alert"><p>' + esc(st.error) + '</p></div>';
    if (!st.view) return '<div class="bld-card bld-muted"><p>Acá vas a ver la build: sus 3 líneas con los rasgos, la barra de habilidades, armas y si es válida para el juego.</p></div>';
    if (canSheet()) return sheetHTML();
    var extra = st.result.ae2 && root.GNBldAe2 ? root.GNBldAe2.gearHTML(st.result.ae2) : '';
    return root.GNBldShow.detailHTML(st.view, { code: st.result.code, checks: st.checks, extraHTML: extra,
      title: st.result.ae2 && st.result.ae2.name ? st.result.ae2.name : null });
  }

  function viewHTML() { return formHTML() + '<div id="bldImpOut" aria-live="polite">' + resultHTML() + '</div>'; }

  // Texto → { ok, build, code, ae2? } o { ok:false, error }. AE2 si está el módulo; si no, el código del juego.
  function parseAny(text) {
    var t = String(text || '').trim();
    if (root.GNBldAe2 && /^AE2:/i.test(t)) return root.GNBldAe2.parse(t);
    return root.GNBldCode.parse(t);
  }

  // EQ-9b: la build de la Biblioteca con el mismo código (los del catálogo ya están normalizados), o null.
  function libOf(code) {
    var L = root.GNBldLib;
    if (!L || !code) return Promise.resolve(null);
    var p;
    try { p = L._state && L._state.cat ? Promise.resolve() : Promise.resolve(typeof L.preload === 'function' ? L.preload() : null); }
    catch (_) { return Promise.resolve(null); }
    return p.then(function () {
      var c = L._state && L._state.cat;
      return ((c && c.builds) || []).filter(function (b) { return b.code === code; })[0] || null;
    }, function () { return null; });
  }
  function loadLib(ctx, my) {
    var r = st.result;
    if (!r || r.ae2) return Promise.resolve();
    return libOf(r.code).then(function (b) {
      if (my !== st.reqId || !b) return;
      st.lib = b; st.gear = undefined; paint(ctx);
      var I = root.GNBldItems;
      if (!I || typeof I.load !== 'function') { st.gear = null; paint(ctx); return; }
      return I.load(b.id).then(function (x) { if (my !== st.reqId) return; st.gear = (x && x.view) || null; paint(ctx); },
        function () { if (my !== st.reqId) return; st.gear = null; paint(ctx); });
    });
  }

  function reset() { st.view = null; st.checks = null; st.ref = null; st.build = null; st.lib = null; st.gear = undefined; }

  function read(ctx, text) {
    st.text = String(text || '').trim();
    st.error = ''; reset();
    if (!root.GNBldCode) { st.error = 'Falta el lector de códigos: recargá la página.'; return paint(ctx); }
    var r = parseAny(st.text);
    if (!r.ok) { st.result = null; st.error = r.error; return paint(ctx); }
    st.result = r; st.loading = true; paint(ctx);
    var my = ++st.reqId;
    if (!ctx.ref) { st.loading = false; st.error = 'Falta el módulo de datos del juego: recargá la página.'; return paint(ctx); }
    return ctx.ref.load(r.build.profession).then(function (ref) {
      if (my !== st.reqId) return;
      st.view = ctx.ref.resolve(r.build, ref);
      st.ref = ref; st.build = r.build;
      st.checks = ctx.ref.check(r.build, ref).concat((r.problems || []).map(function (p) {
        return { level: 'err', msg: p.code === 'DUP_SKILL' ? 'La misma habilidad está dos veces en la barra' + (p.bar === 'water' ? ' de agua' : '') + ': el juego no carga ese código.' : 'La misma especialización está dos veces.' };
      }));
      st.loading = false; paint(ctx);
      return loadLib(ctx, my);
    }, function (e) {
      if (my !== st.reqId) return;
      st.loading = false; st.error = 'Leí el código, pero no pude traer los nombres: ' + (e && e.message || 'sin conexión') + ' Probá de nuevo en un rato.';
      paint(ctx);
    });
  }

  function paint(ctx) {
    var out = ctx.host && ctx.host.querySelector ? ctx.host.querySelector('#bldImpOut') : null;
    if (out) out.innerHTML = resultHTML();
  }

  // EQ-9b: botones propios de la ficha importada (Copiar AE2 y Ver su ficha). Devuelve qué hizo (para los tests).
  function onOut(ctx, e) {
    var t = e && e.target, x = t && t.closest ? t.closest('[data-bld-imp]') : null;
    var k = x && x.getAttribute('data-bld-imp');
    var toast = function (m, kind) { if (ctx && ctx.toast) ctx.toast(m, kind); };
    if (k === 'open' && st.lib) { if (e.preventDefault) e.preventDefault(); ctx.go('sheet', st.lib.id); return 'open'; }
    if (k === 'ae2' && st.lib && st.result) {
      if (e.preventDefault) e.preventDefault();
      var A = root.GNBldAe2, code = A && A.fromSheetCode ? A.fromSheetCode(st.gear || null, { code: st.result.code, mode: st.lib.mode, sub: st.lib.sub }) : '';
      if (!code) { toast('No pude armar el código AE2 de esta build.', 'err'); return 'ae2'; }
      Promise.resolve(root.GNBldShow ? root.GNBldShow.copy(code) : false).then(function (ok) {
        toast(ok ? 'AE2 copiado: pegalo en Alter Ego (Build Library → Import).' : 'No pude copiar el AE2: probá de nuevo.', ok ? 'ok' : 'err');
      });
      return 'ae2';
    }
    return '';
  }

  var CSS = [
    '#buildsPanel .bld-imp-sheet{display:grid;gap:12px}',
    '#buildsPanel .bld-imp-h{display:flex;gap:12px;align-items:center}#buildsPanel .bld-imp-h h3{margin:0;font-size:1.15rem;color:var(--tx-1)}#buildsPanel .bld-imp-h p{margin:2px 0 0;font-size:.85rem}',
    '#buildsPanel .bld-imp-sec{display:grid;gap:10px;border-top:1px solid var(--bd-1);padding-top:10px}#buildsPanel .bld-imp-sec>h4{margin:0;font-size:1rem;color:var(--tx-1)}',
    '#buildsPanel .bld-imp-sec .bld-gsum{margin:0}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-import-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-import-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  function render(host, ctx) {
    if (root.GNBldShow) root.GNBldShow.ensureCss();
    if (root.GNBldTraitView) root.GNBldTraitView.ensureCss();
    if (root.GNBldGearView) root.GNBldGearView.ensureCss();
    ensureCss();
    ctx.host = host;
    var fromLink = ctx.arg ? '[&' + ctx.arg.replace(/^\[&/, '').replace(/\]$/, '') + ']' : '';
    if (fromLink && fromLink !== st.text) st.text = fromLink;
    host.innerHTML = viewHTML();
    var form = host.querySelector('#bldImpForm');
    form.addEventListener('submit', function (e) { e.preventDefault(); read(ctx, host.querySelector('#bldImpText').value); });
    form.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-bld-imp') === 'clear') {
        st.text = ''; st.result = null; st.error = ''; reset(); st.reqId++;
        host.querySelector('#bldImpText').value = ''; paint(ctx); host.querySelector('#bldImpText').focus();
      }
    });
    var out = host.querySelector('#bldImpOut');
    if (out) {
      out.addEventListener('click', function (e) { onOut(ctx, e); });
      if (root.GNBldGearView) root.GNBldGearView.wire(out);
      if (root.GNBldTraitView) root.GNBldTraitView.wire(out);
    }
    if (root.GNBldShow) root.GNBldShow.wire(out, function () {
      return st.result ? { code: st.result.code, title: st.view ? titleOf() : 'Build', source: st.lib ? st.lib.source || null : null } : null;
    }, ctx);
    if (fromLink && (!st.result || st.result.code !== fromLink)) read(ctx, fromLink);
  }

  var api = { version: VERSION, render: render,
    _pure: { parseAny: parseAny, formHTML: formHTML, read: read, resultHTML: resultHTML, libOf: libOf, onOut: onOut, titleOf: titleOf, CSS: CSS },
    _state: st };
  root.GNBldImport = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('import', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
