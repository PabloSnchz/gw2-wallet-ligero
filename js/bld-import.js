/*!
 * js/bld-import.js — Builds: pestaña Importar (BL-082 BLD-4, C1 y D3)
 * Versión: 1.0.0 (2026-10-28)
 *
 * Pegás un código del juego ([&DQ…]) y ves la build completa con nombres en castellano, o un error claro.
 * Lee también los enlaces para compartir (#/builds/c/<código>). Valida contra la API oficial (js/bld-ref.js):
 * profesión, líneas, rasgos, habilidades en su casillero, armas, mascotas y leyendas.
 * Desde la ficha: copiar, compartir, abrir en gw2skills, guardar en Mis builds o llevarla al Editor.
 * Si js/bld-ae2.js está cargado, también acepta códigos AE2 (equipo completo, etapa 2).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var st = { text: '', result: null, view: null, checks: null, loading: false, error: '', reqId: 0 };

  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }

  function formHTML() {
    return '<form class="bld-card bld-imp" id="bldImpForm" autocomplete="off">' +
      '<label for="bldImpText"><b>Pegá el código de la build</b> <span class="bld-muted">(el que copiás en el juego desde la plantilla, o un enlace de la Bóveda)</span></label>' +
      '<textarea id="bldImpText" rows="3" maxlength="700" spellcheck="false" placeholder="[&amp;DQ…]">' + esc(st.text) + '</textarea>' +
      '<div class="bld-acts"><button type="submit" class="bld-btn">Leer la build</button>' +
      '<button type="button" class="bld-btn" data-bld-imp="clear">Limpiar</button></div>' +
      '</form>';
  }

  function resultHTML() {
    if (st.loading) return '<div class="bld-card" role="status"><p>Leyendo la build y buscando los nombres en la API del juego…</p></div>';
    if (st.error) return '<div class="bld-card bld-err" role="alert"><p>' + esc(st.error) + '</p></div>';
    if (!st.view) return '<div class="bld-card bld-muted"><p>Acá vas a ver la build: sus 3 líneas con los rasgos, la barra de habilidades, armas y si es válida para el juego.</p></div>';
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

  function read(ctx, text) {
    st.text = String(text || '').trim();
    st.error = ''; st.view = null; st.checks = null;
    if (!root.GNBldCode) { st.error = 'Falta el lector de códigos: recargá la página.'; return paint(ctx); }
    var r = parseAny(st.text);
    if (!r.ok) { st.result = null; st.error = r.error; return paint(ctx); }
    st.result = r; st.loading = true; paint(ctx);
    var my = ++st.reqId;
    if (!ctx.ref) { st.loading = false; st.error = 'Falta el módulo de datos del juego: recargá la página.'; return paint(ctx); }
    return ctx.ref.load(r.build.profession).then(function (ref) {
      if (my !== st.reqId) return;
      st.view = ctx.ref.resolve(r.build, ref);
      st.checks = ctx.ref.check(r.build, ref).concat((r.problems || []).map(function (p) {
        return { level: 'err', msg: p.code === 'DUP_SKILL' ? 'La misma habilidad está dos veces en la barra' + (p.bar === 'water' ? ' de agua' : '') + ': el juego no carga ese código.' : 'La misma especialización está dos veces.' };
      }));
      st.loading = false; paint(ctx);
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

  function render(host, ctx) {
    if (root.GNBldShow) root.GNBldShow.ensureCss();
    ctx.host = host;
    var fromLink = ctx.arg ? '[&' + ctx.arg.replace(/^\[&/, '').replace(/\]$/, '') + ']' : '';
    if (fromLink && fromLink !== st.text) st.text = fromLink;
    host.innerHTML = viewHTML();
    var form = host.querySelector('#bldImpForm');
    form.addEventListener('submit', function (e) { e.preventDefault(); read(ctx, host.querySelector('#bldImpText').value); });
    form.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-bld-imp') === 'clear') {
        st.text = ''; st.result = null; st.view = null; st.error = '';
        host.querySelector('#bldImpText').value = ''; paint(ctx); host.querySelector('#bldImpText').focus();
      }
    });
    if (root.GNBldShow) root.GNBldShow.wire(host.querySelector('#bldImpOut'), function () {
      return st.result ? { code: st.result.code, title: st.view ? (st.view.specs[2] && st.view.specs[2].name || st.view.profName) + ' importada' : 'Build', source: null } : null;
    }, ctx);
    if (fromLink && (!st.result || st.result.code !== fromLink)) read(ctx, fromLink);
  }

  var api = { version: VERSION, render: render, _pure: { parseAny: parseAny, formHTML: formHTML, read: read }, _state: st };
  root.GNBldImport = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('import', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
