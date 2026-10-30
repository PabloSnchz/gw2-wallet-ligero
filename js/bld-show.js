/*!
 * js/bld-show.js — Builds: cómo se ve una build (ficha) y las acciones comunes (BL-082 BLD-4)
 * Versión: 1.1.0 (2026-10-28) · BUI-1: emblem() con los íconos oficiales de profesión y élite (GNBldRef.identity) y la
 *          ficha encabezada por el emblema grande de su élite · antes 1.0.0 BLD-4
 *
 * Ficha de una build ya resuelta por js/bld-ref.js: profesión, las 3 líneas con sus rasgos, la barra de tierra
 * (y la de agua si tiene algo), mascotas o leyendas, armas y lo que dice la validación contra la API (D3).
 * Acciones de la ficha (data-bld-act): copiar el código, copiar el enlace para compartir, abrir en gw2skills
 * (copia el código y abre su editor: su API pide IP fija, D5), guardar en Mis builds y editar.
 * La usan Importar, la Biblioteca y Mis builds. Todo texto que viene de afuera pasa por esc().
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var GW2SKILLS = 'https://en.gw2skills.net/editor/';
  var TIER = ['Adepto', 'Maestro', 'Gran maestro'];
  var SLOT = ['Curación', 'Utilidad', 'Utilidad', 'Utilidad', 'Élite'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Las descripciones de la API traen etiquetas del juego (<c=@reminder>…</c>): solo el texto.
  function plain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function img(src, alt, size, cls) {
    if (!src || !/^https:\/\/render\.guildwars2\.com\/|^assets\//.test(src)) return '<span class="bld-ph ' + (cls || '') + '" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true"></span>';
    return '<img class="' + (cls || '') + '" src="' + esc(src) + '" width="' + size + '" height="' + size + '" alt="' + esc(alt || '') + '" loading="lazy">';
  }

  // BUI-1: emblema oficial. Con élite, el de la élite; si no, el de la profesión; sin datos, un hueco del mismo tamaño.
  // ident = GNBldRef.identitySync() (o el que se pase). Más de 32 px usa el ícono grande. opts: { ident, label, cls }
  function emblemOf(prof, elite, big, ident) {
    var R = root.GNBldRef;
    ident = ident || (R && typeof R.identitySync === 'function' ? R.identitySync() : null);
    var e = ident && elite ? ident.elites[elite] : null, p = ident && prof ? ident.profs[prof] : null;
    if (e) return { src: big ? e.iconBig : e.icon, name: e.name };
    if (p) return { src: big ? p.iconBig : p.icon, name: p.name };
    return { src: '', name: '' };
  }
  function emblem(prof, elite, size, opts) {
    opts = opts || {};
    var x = emblemOf(prof, elite, size > 32, opts.ident);
    return '<span class="bld-emb' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.label && x.name ? ' title="' + esc(x.name) + '"' : '') + '>' +
      img(x.src, opts.label ? x.name : '', size, '') + '</span>';
  }

  function specHTML(s, i) {
    if (!s || !s.id) return '<div class="bld-spec is-empty"><span class="bld-muted">Línea ' + (i + 1) + ' vacía</span></div>';
    var tr = s.traits.map(function (t, k) {
      if (!t) return '<li class="bld-tr is-empty"><span class="bld-muted">' + TIER[k] + ': sin elegir</span></li>';
      return '<li class="bld-tr" title="' + esc(plain(t.description)) + '">' + img(t.icon, '', 26, 'bld-ic') + '<span><small>' + TIER[k] + '</small> ' + esc(t.name) + '</span></li>';
    }).join('');
    return '<div class="bld-spec' + (s.elite ? ' is-elite' : '') + '">' +
      '<div class="bld-spec-h">' + img(s.icon, '', 30, 'bld-ic') + '<b>' + esc(s.name) + '</b>' + (s.elite ? ' <span class="bld-tag">élite</span>' : '') + '</div>' +
      '<ul class="bld-trs">' + tr + '</ul></div>';
  }

  function barHTML(list, label) {
    var any = (list || []).some(Boolean);
    if (!any) return '';
    return '<div class="bld-bar"><span class="bld-cap">' + esc(label) + '</span><ol>' + list.map(function (s, i) {
      return '<li class="bld-sk' + (i === 0 ? ' is-heal' : i === 4 ? ' is-elite' : '') + '" title="' + esc(s ? plain(s.description) : '') + '">' +
        img(s && s.icon, '', 36, 'bld-ic') + '<span><small>' + SLOT[i] + '</small> ' + (s ? esc(s.name) : '<span class="bld-muted">vacío</span>') + '</span></li>';
    }).join('') + '</ol></div>';
  }

  function extrasHTML(v) {
    var h = [];
    if (v.pets) {
      var p = function (x) { return x ? img(x.icon, '', 22, 'bld-ic') + esc(x.name) : '<span class="bld-muted">—</span>'; };
      h.push('<p><span class="bld-cap">Mascotas</span> ' + p(v.pets.land[0]) + ' · ' + p(v.pets.land[1]) +
        (v.pets.water[0] || v.pets.water[1] ? ' <small class="bld-muted">(agua: ' + p(v.pets.water[0]) + ' · ' + p(v.pets.water[1]) + ')</small>' : '') + '</p>');
    }
    if (v.legends) {
      var l = function (x) { return x ? img(x.icon, '', 22, 'bld-ic') + esc(x.name) : '<span class="bld-muted">—</span>'; };
      h.push('<p><span class="bld-cap">Leyendas</span> ' + l(v.legends.land[0]) + ' · ' + l(v.legends.land[1]) + '</p>');
    }
    if (v.weapons && v.weapons.length) h.push('<p><span class="bld-cap">Armas</span> ' + v.weapons.map(function (w) { return esc(w.name); }).join(' · ') + '</p>');
    if (v.overrides && v.overrides.length) h.push('<p><span class="bld-cap">Variantes</span> ' + v.overrides.map(function (s) { return img(s.icon, '', 22, 'bld-ic') + esc(s.name); }).join(' · ') + '</p>');
    return h.join('');
  }

  function checksHTML(list) {
    if (!list) return '';
    if (!list.length) return '<p class="bld-ok" role="status">✓ Válida: la comprobé contra la API oficial del juego.</p>';
    return '<ul class="bld-checks" role="status">' + list.map(function (c) {
      return '<li class="' + (c.level === 'err' ? 'bld-err' : 'bld-muted') + '">' + (c.level === 'err' ? '✗ ' : '! ') + esc(c.msg) + '</li>';
    }).join('') + '</ul>';
  }

  // opts: { title, meta (html ya escapado), code, checks, actions: ['copy','share','gw2skills','save','edit'], extraHTML }
  function detailHTML(v, opts) {
    opts = opts || {};
    var acts = opts.actions || ['copy', 'share', 'gw2skills', 'save', 'edit'];
    var label = { copy: 'Copiar código', share: 'Copiar enlace para compartir', gw2skills: 'Abrir en gw2skills ↗', save: 'Guardar en Mis builds', edit: 'Editar' };
    var elite = (v.specs || []).filter(function (s) { return s && s.elite; })[0];
    return '<article class="bld-card bld-detail" aria-label="' + esc(opts.title || 'Build') + '">' +
      '<header class="bld-detail-h"><span class="bld-emb is-big">' + img((elite && (elite.profIconBig || elite.profIcon)) || v.profIconBig || v.profIcon, '', 40, '') + '</span><div><h3>' + esc(opts.title || ((elite ? elite.name : v.profName) + ' · build')) + '</h3>' +
      '<p class="bld-muted">' + esc(v.profName) + (elite ? ' · ' + esc(elite.name) : '') + (opts.meta ? ' · ' + opts.meta : '') + '</p></div></header>' +
      '<div class="bld-specs">' + (v.specs || []).map(specHTML).join('') + '</div>' +
      barHTML(v.land, 'Barra') + barHTML(v.water, 'Bajo el agua') + extrasHTML(v) + (opts.extraHTML || '') +
      checksHTML(opts.checks) +
      (opts.code ? '<div class="bld-code"><span class="bld-cap">Código del juego</span><code>' + esc(opts.code) + '</code></div>' : '') +
      '<div class="bld-acts">' + acts.map(function (a) { return label[a] ? '<button type="button" class="bld-btn" data-bld-act="' + a + '">' + label[a] + '</button>' : ''; }).join(' ') + '</div>' +
      '</article>';
  }

  // Copiar al portapapeles: API moderna y, si no está (http o navegador viejo), el camino clásico.
  function copy(text) {
    var nav = root.navigator;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      return nav.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var d = root.document;
    if (!d || !d.createElement) return false;
    var t = d.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    d.body.appendChild(t); t.select();
    var ok = false;
    try { ok = d.execCommand('copy'); } catch (_) {}
    d.body.removeChild(t);
    return ok;
  }

  // Acciones de la ficha. get() devuelve { code, build, title, source } de la build que se está viendo.
  function act(name, get, ctx) {
    var x = get();
    if (!x || !x.code) return;
    if (name === 'copy') return copy(x.code).then(function (ok) { ctx.toast(ok ? 'Código copiado: pegalo en el chat del juego o en tu plantilla.' : 'No pude copiar: seleccioná el código y copialo a mano.', ok ? 'ok' : 'err'); });
    if (name === 'share') return copy(ctx.shareUrl(x.code)).then(function (ok) { ctx.toast(ok ? 'Enlace copiado: quien lo abra ve esta build en la Bóveda.' : 'No pude copiar el enlace.', ok ? 'ok' : 'err'); });
    if (name === 'gw2skills') {
      return copy(x.code).then(function () {
        if (root.open) root.open(GW2SKILLS, '_blank', 'noopener');
        ctx.toast('Copié el código: en gw2skills tocá «Load build» y pegalo.', 'ok');
      });
    }
    if (name === 'save') {
      if (!ctx.store) { ctx.toast('Mis builds todavía no cargó: probá en un momento.', 'err'); return; }
      var r = ctx.store.save({ code: x.code, title: x.title, source: x.source || null });
      ctx.toast(r && r.ok ? (r.dup ? 'Ya estaba en Mis builds.' : 'Guardada en Mis builds.') : ((r && r.error) || 'No pude guardarla.'), r && r.ok ? 'ok' : 'err');
      return;
    }
    if (name === 'edit') return ctx.go('editor', x.code.replace(/^\[&/, '').replace(/\]$/, ''));
  }
  function wire(host, get, ctx) {
    host.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-bld-act]') : null;
      if (!b || !host.contains(b)) return;
      e.preventDefault();
      act(b.getAttribute('data-bld-act'), function () { return get(b); }, ctx);
    });
  }

  var CSS = [
    '#buildsPanel .bld-detail{display:grid;gap:10px}',
    '#buildsPanel .bld-emb{display:inline-grid;place-items:center;flex:none;border-radius:10px;background:var(--bg-0);box-shadow:inset 0 0 0 1px var(--bd-1);padding:3px}',
    '#buildsPanel .bld-emb.is-big{padding:6px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--bd-1),0 0 0 2px color-mix(in srgb,var(--gn-mod) 45%,transparent)}',
    '#buildsPanel .bld-emb img,#buildsPanel .bld-emb .bld-ph{display:block}',
    '#buildsPanel .bld-detail-h{display:flex;gap:10px;align-items:center}#buildsPanel .bld-detail-h h3{margin:0;font-size:1.05rem;color:var(--tx-1)}#buildsPanel .bld-detail-h p{margin:2px 0 0;font-size:.85rem}',
    '#buildsPanel .bld-specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}',
    '#buildsPanel .bld-spec{border:1px solid var(--bd-1);border-radius:10px;padding:8px;background:var(--bg-2)}#buildsPanel .bld-spec.is-elite{border-color:var(--gn-mod)}',
    '#buildsPanel .bld-spec-h{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--tx-1)}',
    '#buildsPanel .bld-trs,#buildsPanel .bld-bar ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}',
    '#buildsPanel .bld-tr,#buildsPanel .bld-sk{display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--tx-1)}',
    '#buildsPanel .bld-tr small,#buildsPanel .bld-sk small,#buildsPanel .bld-cap{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.04em}',
    '#buildsPanel .bld-bar ol{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}',
    '#buildsPanel .bld-sk.is-heal img{box-shadow:0 0 0 2px var(--color-green,#3fb950)}#buildsPanel .bld-sk.is-elite img{box-shadow:0 0 0 2px var(--color-amber,#F2B94B)}',
    '#buildsPanel .bld-ic{border-radius:6px;flex:none}#buildsPanel .bld-ph{display:inline-block;border-radius:6px;background:var(--bg-2);flex:none}',
    '#buildsPanel .bld-tag{font-size:.7rem;border:1px solid var(--gn-mod);border-radius:999px;padding:0 6px;color:var(--tx-1)}',
    '#buildsPanel .bld-code code{display:block;word-break:break-all;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:8px;padding:8px;font-size:.8rem;color:var(--tx-1);user-select:all}',
    '#buildsPanel .bld-acts{display:flex;flex-wrap:wrap;gap:6px}',
    '#buildsPanel .bld-checks{margin:0;padding-left:0;list-style:none;font-size:.85rem}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head || d.getElementById('bld-show-css')) return;
    var s = d.createElement('style'); s.id = 'bld-show-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  root.GNBldShow = { version: VERSION, detailHTML: detailHTML, copy: copy, act: act, wire: wire, ensureCss: ensureCss, esc: esc, plain: plain, img: img,
    emblem: emblem, emblemOf: emblemOf,
    GW2SKILLS: GW2SKILLS, _pure: { specHTML: specHTML, barHTML: barHTML, checksHTML: checksHTML, CSS: CSS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GNBldShow;
})(typeof window !== 'undefined' ? window : globalThis);
