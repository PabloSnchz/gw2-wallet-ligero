/*!
 * js/bld-mine.js — Builds: pestaña Mis builds (BL-082 BLD-6, B7)
 * Versión: 1.5.0 (2026-10-30) · EQ-3b: con js/bld-rows.js, la misma fila que la Biblioteca (emblema, nombre, élite, editada, DPS
 *          de la build en que se basa) y cada una abre su ficha en pantalla propia (#/builds/ver/m:<id>, js/bld-sheet.js) con
 *          nombre y notas, Editar, Duplicar y Borrar; al volver, el foco vuelve a esa fila · antes 1.4.0 (2026-10-29) · BENCH-2: cada build muestra el bench de la build de la Biblioteca en que se basa o,
 *          si no hay, la «Referencia» medida más parecida (js/bld-bench.js), sin inventar su DPS · antes 1.3.0 BUI-6b: la tarjeta pasa su profesión al marco (franja con el arte de su élite,
 *          filo y tinte del color de la profesión) · antes 1.2.0 BUI-6: como la Biblioteca, la tarjeta lleva el fondo de su élite de borde a borde y el
 *          emblema a 56 px · antes 1.1.0 BUI-4: la misma tarjeta que la Biblioteca: emblema de la élite, «Copiar código»,
 *          «Ver ficha» y el menú ⋯ (editar, duplicar, borrar con confirmación) · antes 1.0.0 BLD-6
 *
 * Tus builds guardadas en este navegador (js/bld-store.js): copiar el código, abrir la ficha, editar en el Editor,
 * duplicar, renombrar, anotar y borrar (con confirmación). Viajan en tu archivo de respaldo.
 */
(function (root) {
  'use strict';

  var VERSION = '1.5.0';
  var st = { open: '', confirm: '', view: {}, checks: {}, last: '', back: false, ctx: null };

  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }
  function fmt(t) { try { return new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return ''; } }

  // Élite de la build (tercera línea) leyendo su código; 0 si no se puede.
  function eliteOf(b) {
    var C = root.GNBldCode;
    try { var r = C && C.parse(b.code); return r && r.ok && r.build.specs[2] ? r.build.specs[2].id || 0 : 0; } catch (_) { return 0; }
  }
  function emblem(b, size) {
    var S = root.GNBldShow;
    return S && typeof S.emblem === 'function' ? S.emblem(b.profession, eliteOf(b), size, { label: true, cls: 'bld-mine-emb' }) : '';
  }
  // BENCH-2: bench de la build de la Biblioteca en que se basa o la «Referencia» medida más parecida (js/bld-bench.js).
  // Usa el catálogo y el bench que ya cargó la Biblioteca (GNBldLib.preload); si no están, no muestra nada.
  function benchLine(b) {
    var Lb = root.GNBldLib, Bb = root.GNBldBench, s = Lb && Lb._state;
    if (!Bb || !s || !s.cat || !s.bidx) return '';
    try { return Bb.html(Bb.forMine(b, s.cat, s.bidx, Lb._pure.benchOf), s.bidx); } catch (_) { return ''; }
  }
  function rowHTML(b) {
    var C = root.GNBldCode, on = st.open === b.id, ask = st.confirm === b.id;
    var V = root.GNBld, band = V && typeof V.bandStyle === 'function' ? V.bandStyle(eliteOf(b), null, b.profession) : '';
    var h = '<li class="bld-card bld-mine-row bld-band' + (on ? ' is-open' : '') + '" data-id="' + esc(b.id) + '"' + band + '>' +
      '<div class="bld-mine-h">' + emblem(b, 56) + '<div class="bld-mine-t"><b>' + esc(b.title) + '</b><p class="bld-muted">' + esc(C ? C.PROF_ES[b.profession] || '' : '') + ' · editada ' + fmt(b.updated) +
      (b.source && b.source.url ? ' · basada en <a href="' + esc(b.source.url) + '" target="_blank" rel="noopener">' + esc(b.source.name || 'la fuente') + ' ↗</a>' : '') + '</p></div></div>' + benchLine(b) +
      '<div class="bld-acts">' +
      '<button type="button" class="bld-btn is-primary" data-mine="copy">Copiar código</button>' +
      '<button type="button" class="bld-btn" data-mine="toggle" aria-expanded="' + on + '">' + (on ? 'Cerrar ficha' : 'Ver ficha') + '</button>' +
      '<details class="bld-menu"><summary class="bld-btn" aria-label="Más acciones: ' + esc(b.title) + '" title="Más acciones">⋯</summary><div class="bld-menu-l">' +
      '<button type="button" class="bld-btn" data-mine="edit">Editar en el Editor</button>' +
      '<button type="button" class="bld-btn" data-mine="dup">Duplicar</button>' +
      '<button type="button" class="bld-btn" data-mine="del">Borrar…</button>' +
      '</div></details></div>' +
      (ask ? '<div class="bld-mine-ask" role="alert"><span>¿Borro «' + esc(b.title) + '»? No se puede deshacer (salvo desde tu respaldo).</span>' +
        '<button type="button" class="bld-btn bld-err" data-mine="del-yes">Sí, borrar</button><button type="button" class="bld-btn" data-mine="del-no">No</button></div>' : '');
    if (on) {
      h += '<div class="bld-mine-more"><label><small>Nombre</small><input data-mine-field="title" maxlength="80" value="' + esc(b.title) + '"></label>' +
        '<label><small>Notas</small><textarea data-mine-field="notes" rows="2" maxlength="1000">' + esc(b.notes || '') + '</textarea></label>' +
        '<button type="button" class="bld-btn" data-mine="savemeta">Guardar nombre y notas</button>' +
        (st.view[b.id] ? root.GNBldShow.detailHTML(st.view[b.id], { code: b.code, checks: st.checks[b.id], title: b.title, actions: ['share', 'gw2skills'] })
          : '<p class="bld-muted" role="status">Cargando la ficha…</p>') + '</div>';
    }
    return h + '</li>';
  }

  // EQ-3b: la build de la Biblioteca en que se basa (mismo código o misma fuente); null si no hay o no cargó.
  function baseOf(b) {
    var Lb = root.GNBldLib, s = Lb && Lb._state, list = s && s.cat && s.cat.builds;
    if (!list || !b) return null;
    var same = list.filter(function (x) { return x.code === b.code; })[0];
    if (same) return same;
    var u = b.source && b.source.url;
    return (u && list.filter(function (x) { return x.source && x.source.url === u; })[0]) || null;
  }
  // EQ-3b: la fila (la de la Biblioteca, en lista plana); toda la fila es un enlace a su ficha.
  function mineRowHTML(b) {
    var C = root.GNBldCode, el = eliteOf(b), V = root.GNBld, R = root.GNBldRows, Lb = root.GNBldLib, base = baseOf(b);
    var col = V && V._pure && V._pure.PROF_COLOR ? V._pure.PROF_COLOR[b.profession] : '';
    var Rf = root.GNBldRef, idn = Rf && typeof Rf.identitySync === 'function' ? Rf.identitySync() : null;
    var eName = (idn && idn.elites && idn.elites[el] && idn.elites[el].name) || (base && base.eliteName) || '';
    var meta = [C ? C.PROF_ES[b.profession] || '' : '', eName, 'editada ' + fmt(b.updated)].filter(Boolean).join(' · ');
    var tags = (base ? '<span class="bld-tag">basada en la Biblioteca</span>' : b.source && b.source.name ? '<span class="bld-tag">basada en ' + esc(b.source.name) + '</span>' : '<span class="bld-tag">propia</span>') +
      (b.notes ? '<span class="bld-tag is-boon">con notas</span>' : '');
    var dps = base && R && R._pure && Lb ? R._pure.dpsHTML(base, { lib: Lb._pure, idx: Lb._state && Lb._state.bidx }) : '<span class="bld-rdps is-none">Tuya · sin bench propio</span>';
    var S = root.GNBldShow, emb = S && typeof S.emblem === 'function' ? S.emblem(b.profession, el, 32, { label: true }) : '';
    return '<a class="bld-row is-flat is-mine" href="#/builds/ver/' + encodeURIComponent('m:' + b.id) + '" data-id="' + esc(b.id) + '"' +
      (/^#[0-9A-Fa-f]{6}$/.test(col || '') ? ' style="--bld-prof:' + col + '"' : '') + '>' + emb +
      '<span class="bld-rt"><b>' + esc(b.title) + '</b><small>' + esc(meta) + '</small></span><span class="bld-rtags">' + tags + '</span>' + dps +
      '<span class="bld-rgo" aria-hidden="true">›</span></a>';
  }
  // Al volver de la ficha, el foco va a la fila de esa build (una sola vez).
  function remember(id) { st.last = String(id || ''); st.back = !!id; }
  function focusBack(ctx) {
    if (!st.back || !st.last || !ctx || !ctx.host || !ctx.host.querySelector) return false;
    st.back = false;
    var x = ctx.host.querySelector('a.bld-row[data-id="' + st.last.replace(/["\\\]]/g, '') + '"]');
    if (!x) return false;
    if (x.scrollIntoView) x.scrollIntoView({ block: 'center' });
    if (x.focus) x.focus({ preventScroll: true });
    return true;
  }
  function viewHTML(list) {
    if (!list.length) {
      return '<div class="bld-card"><p><b>Todavía no guardaste builds.</b></p><p class="bld-muted">Armá una en el <a href="#/builds/editor">Editor</a>, ' +
        'importá un código en <a href="#/builds/importar">Importar</a> o guardá una de la <a href="#/builds">Biblioteca</a>. Quedan en este navegador y viajan en tu respaldo.</p></div>';
    }
    return '<p class="bld-muted">' + list.length + (list.length === 1 ? ' build guardada' : ' builds guardadas') + ' en este navegador · viajan en tu respaldo.</p>' +
      (root.GNBldRows ? '<div class="bld-rlist is-flat">' + list.map(mineRowHTML).join('') + '</div>' : '<ul class="bld-mine">' + list.map(rowHTML).join('') + '</ul>');
  }

  var CSS = [
    '#buildsPanel .bld-mine{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}',
    '#buildsPanel .bld-mine-row{display:grid;gap:8px;align-content:start}#buildsPanel .bld-mine-row.is-open{grid-column:1/-1}',
    '#buildsPanel .bld-mine-h{display:flex;gap:12px;align-items:flex-start}#buildsPanel .bld-mine-t{min-width:0}#buildsPanel .bld-mine-t b{color:var(--tx-1)}',
    '#buildsPanel .bld-mine-h p{margin:2px 0 0;font-size:.78rem}',
    '#buildsPanel .bld-mine-row>.bld-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '#buildsPanel .bld-mine-ask{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border:1px solid var(--color-red,#F47C7C);border-radius:10px;font-size:.85rem;color:var(--tx-1)}',
    '#buildsPanel .bld-mine-ask span{flex:1 1 200px}',
    '@media (max-width:560px){#buildsPanel .bld-mine{grid-template-columns:1fr}}',
    '#buildsPanel .bld-mine-more{display:grid;gap:8px;margin-top:10px}',
    '#buildsPanel .bld-mine-more input,#buildsPanel .bld-mine-more textarea{width:100%;box-sizing:border-box;background:var(--bg-0);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:8px;padding:6px 8px;font:inherit}',
    '#buildsPanel .bld-mine-more small{display:block;color:var(--tx-2);font-size:.7rem;text-transform:uppercase}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-mine-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-mine-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  function loadView(ctx, b) {
    var r = root.GNBldCode.parse(b.code);
    if (!r.ok || !ctx.ref) return;
    ctx.ref.load(r.build.profession).then(function (ref) {
      st.view[b.id] = ctx.ref.resolve(r.build, ref);
      st.checks[b.id] = ctx.ref.check(r.build, ref);
      if (st.open === b.id) paint(ctx);
    }, function (e) { ctx.toast('No pude traer los nombres del juego: ' + (e && e.message || ''), 'err'); });
  }

  function paint(ctx) {
    if (!ctx.host || !ctx.store) return;
    var a = root.document && root.document.activeElement;
    var keep = a && a.getAttribute ? [a.closest && a.closest('[data-id]') ? a.closest('[data-id]').getAttribute('data-id') : '', a.getAttribute('data-mine') || ''] : null;
    ctx.host.innerHTML = viewHTML(ctx.store.list());
    // BUI-4: lo del menú ⋯ ya no se ve al redibujar: el foco va a la confirmación o al botón principal.
    if (keep) keep[1] = { del: 'del-yes', 'del-yes': 'copy', 'del-no': 'copy', dup: 'copy', edit: 'copy' }[keep[1]] || keep[1];
    if (keep && keep[0] && keep[1]) {
      var el = ctx.host.querySelector('[data-id="' + keep[0] + '"] [data-mine="' + keep[1] + '"]');
      if (el && el.focus) el.focus();
    }
  }

  function onClick(ctx, e) {
    var a = e.target && e.target.closest ? e.target.closest('a.bld-row') : null;
    if (a) { remember(a.getAttribute('data-id')); return 'row'; }
    var b = e.target && e.target.closest ? e.target.closest('[data-mine]') : null;
    if (!b) return;
    var row = b.closest('[data-id]'), id = row && row.getAttribute('data-id'), act = b.getAttribute('data-mine');
    var item = id && ctx.store.get(id);
    if (!item) return;
    e.preventDefault();
    if (act === 'copy') return root.GNBldShow.copy(item.code).then(function (ok) { ctx.toast(ok ? 'Código copiado.' : 'No pude copiar.', ok ? 'ok' : 'err'); });
    if (act === 'toggle') { st.open = st.open === id ? '' : id; if (st.open && !st.view[id]) loadView(ctx, item); return paint(ctx); }
    if (act === 'edit') return ctx.go('editor', 'm:' + id);
    if (act === 'dup') { var r = ctx.store.duplicate(id); ctx.toast(r.ok ? 'Duplicada.' : r.error, r.ok ? 'ok' : 'err'); return paint(ctx); }
    if (act === 'del') { st.confirm = id; return paint(ctx); }
    if (act === 'del-no') { st.confirm = ''; return paint(ctx); }
    if (act === 'del-yes') { st.confirm = ''; var d = ctx.store.remove(id); ctx.toast(d.ok ? 'Borrada.' : d.error, d.ok ? 'ok' : 'err'); return paint(ctx); }
    if (act === 'savemeta') {
      var t = row.querySelector('[data-mine-field="title"]'), n = row.querySelector('[data-mine-field="notes"]');
      var u = ctx.store.update(id, { title: t ? t.value : null, notes: n ? n.value : null });
      ctx.toast(u.ok ? 'Guardado.' : u.error, u.ok ? 'ok' : 'err');
      return paint(ctx);
    }
  }

  function render(host, ctx) {
    if (root.GNBldShow) root.GNBldShow.ensureCss();
    if (root.GNBldBench) root.GNBldBench.ensureCss();
    if (root.GNBldRows) root.GNBldRows.ensureCss();
    ensureCss();
    ctx.host = host;
    st.ctx = ctx;
    if (!ctx.store) { host.innerHTML = '<div class="bld-card bld-err">Mis builds no cargó: recargá la página.</div>'; return; }
    // EQ-3b: si la pestaña se vuelve a dibujar sobre el mismo contenedor, no sumo otra vez los oyentes.
    if (!host.__bldMine) {
      host.__bldMine = true;
      host.addEventListener('click', function (e) { onClick(st.ctx, e); });
      if (root.GNBldShow) root.GNBldShow.wire(host, function (btn) {
        var row = btn.closest('[data-id]'), item = row && st.ctx.store.get(row.getAttribute('data-id'));
        return item ? { code: item.code, title: item.title } : null;
      }, ctx);
    }
    paint(ctx);
    focusBack(ctx);
    // BENCH-2: el bench vive en la Biblioteca; si todavía no se cargó, lo pido y vuelvo a dibujar.
    var Lb = root.GNBldLib;
    if (Lb && typeof Lb.preload === 'function' && !(Lb._state && Lb._state.cat)) Lb.preload().then(function () { paint(ctx); }, function () {});
  }

  var api = { version: VERSION, render: render, remember: remember,
    _pure: { viewHTML: viewHTML, rowHTML: rowHTML, mineRowHTML: mineRowHTML, eliteOf: eliteOf, baseOf: baseOf, focusBack: focusBack, onClick: onClick }, _state: st };
  root.GNBldMine = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('mine', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
