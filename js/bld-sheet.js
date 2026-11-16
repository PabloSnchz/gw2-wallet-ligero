/*!
 * js/bld-sheet.js — Builds: la ficha de una build de la Biblioteca en su propia pantalla (BL-084 EQ-3)
 * Versión: 1.6.0 (2026-11-15) · EQ-9a: «Copiar AE2 (Alter Ego)» con el equipo real de la ficha (js/bld-ae2.js 1.1.0
 *          fromSheetCode), en la Biblioteca y en las propias basadas en una de ella · antes 1.5.1 (2026-10-31) · EQ-8: le pasa el modo a «Cómo se juega» (en WvW y PvP el control es contra jugadores)
 *          · antes 1.5.0 EQ-7: «Cómo se juega» con js/bld-play.js (conceptos, apertura, bucle y control, con íconos
 *          en línea; sin nota, el enlace a la guía original) · antes 1.4.0 EQ-6: desplegables de notas con js/bld-notes.js (habilidades y rasgos al pie de «Rasgos y
 *          habilidades», equipo y reliquia al pie de «Equipo»), con la descripción oficial debajo · antes 1.3.0 EQ-5: «Rasgos y habilidades» como en el juego con js/bld-traitview.js (barra de armas y
 *          habilidades con sus teclas, 3 líneas con su fondo oficial, guía de teclas); con un ref viejo, la vista anterior
 *          · antes 1.2.0 EQ-4: el equipo lo pinta js/bld-gearview.js (3 tarjetas como Snow Crows, íconos con su
 *          rareza, descripción oficial con Tab, toque o cursor; Escape la cierra) · antes 1.1.0 EQ-3b: también la ficha de Mis builds (#/builds/ver/m:<id>): nombre y notas, Editar, Duplicar
 *          y Borrar (con confirmación); si se basa en una build de la Biblioteca, su equipo y su bench · antes 1.0.0
 *
 * Ruta #/builds/ver/<id> (js/bld-view.js 1.6.0 la manda acá; la pestaña Biblioteca queda marcada).
 * Arriba: «← Biblioteca» (vuelve con los mismos filtros, orden y foco en la build), el camino modo · profesión · élite
 * y «anterior / siguiente» dentro de lo que la Biblioteca está mostrando (GNBldLib.list()).
 * La ficha: franja con el arte de la élite, emblema, nombre, datos, bench de daño y acciones; después secciones plegables
 * como en Snow Crows: Equipo (js/bld-items.js, en castellano desde la API oficial), Rasgos y habilidades (el código de
 * la build resuelto con js/bld-ref.js y validado contra la API) y Cómo se juega (mis notas llegan en EQ-6 a EQ-8).
 * Lo que se abre o se cierra se recuerda mientras dure la visita (en memoria, sin localStorage). Los textos son los del
 * juego o míos (DEC-046); de cada fuente, solo datos y el enlace.
 */
(function (root) {
  'use strict';

  var VERSION = '1.6.0';
  var MODES = { pve: 'PvE', wvw: 'WvW', pvp: 'PvP' };
  var SUB = { raids: 'raids y strikes', fractals: 'fractales', 'open-world': 'mundo abierto', accessibuilds: 'accesible', roaming: 'roaming', zerg: 'zerg', conquest: 'conquista' };
  var SECTIONS = [['gear', 'Equipo'], ['traits', 'Rasgos y habilidades'], ['play', 'Cómo se juega']];
  var MINE_SECTIONS = [['notes', 'Nombre y notas'], ['gear', 'Equipo'], ['traits', 'Rasgos y habilidades']];
  var st = { id: '', ctx: null, gear: {}, gearErr: {}, views: {}, checks: {}, refs: {}, builds: {}, viewErr: {}, closed: {}, focusTitle: false, confirm: '' };

  function S() { return root.GNBldShow; }
  function esc(s) { return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function img(src, alt, size) { return S() ? S().img(src, alt, size, 'bld-ic') : ''; }
  function Lib() { return root.GNBldLib; }
  function profName(p) { var C = root.GNBldCode; return (C && C.PROF_ES && C.PROF_ES[p]) || ''; }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '—'); }

  // ---------------------------------------------------------------- modelo (puro)
  // Dónde está la build dentro de lo que muestra la Biblioteca: { i, n, prev, next } (null si no está en la lista).
  function navOf(list, id) {
    var ids = (list || []).map(function (b) { return b.id; }), i = ids.indexOf(id);
    if (i < 0) return { i: -1, n: ids.length, prev: null, next: null };
    return { i: i, n: ids.length, prev: i > 0 ? list[i - 1] : null, next: i < ids.length - 1 ? list[i + 1] : null };
  }
  // EQ-3b: las de Mis builds se abren con «m:<id>»; se arman con la forma de las de la Biblioteca.
  function isMine(id) { return /^m:/.test(String(id || '')); }
  function mineB(raw) {
    var T = root.GNBldStore, x = T && typeof T.get === 'function' ? T.get(raw) : null;
    if (!x) return null;
    var M = root.GNBldMine, MP = M && M._pure, base = MP && MP.baseOf ? MP.baseOf(x) : null;
    var elite = MP && MP.eliteOf ? MP.eliteOf(x) : 0, R = root.GNBldRef, idn = R && typeof R.identitySync === 'function' ? R.identitySync() : null;
    return { id: 'm:' + x.id, raw: x.id, mine: x, base: base, name: x.title, prof: x.profession, elite: elite,
      eliteName: (idn && idn.elites && idn.elites[elite] && idn.elites[elite].name) || (base && base.eliteName) || '',
      code: x.code, source: x.source || null, mode: base ? base.mode : '', sub: base ? base.sub : '', difficulty: base ? base.difficulty : 0 };
  }
  function crumb(b) {
    if (b.mine) return ['Mis builds', profName(b.prof), b.eliteName || ''].filter(Boolean);
    return [(MODES[b.mode] || b.mode) + (b.sub ? ' (' + (SUB[b.sub] || b.sub) + ')' : ''), profName(b.prof), b.eliteName || ''].filter(Boolean);
  }

  // ---------------------------------------------------------------- vista (pura)
  function navHTML(b, nav) {
    var pn = function (dir, x) {
      var lab = dir === 'prev' ? '‹ Anterior' : 'Siguiente ›';
      return x ? '<button type="button" class="bld-btn" data-sheet="' + dir + '" aria-label="' + (dir === 'prev' ? 'Build anterior: ' : 'Build siguiente: ') + esc(x.name) + '">' + lab + '</button>'
        : '<button type="button" class="bld-btn" disabled>' + lab + '</button>';
    };
    return '<nav class="bld-sh-nav" aria-label="Navegación de la ficha">' +
      '<button type="button" class="bld-btn" data-sheet="back">' + (b.mine ? '← Mis builds' : '← Biblioteca') + '</button>' +
      '<ol class="bld-crumb">' + crumb(b).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ol>' +
      (nav && nav.i >= 0 ? '<span class="bld-sh-pn">' + pn('prev', nav.prev) + '<small class="bld-muted">' + (nav.i + 1) + ' de ' + nav.n + '</small>' + pn('next', nav.next) + '</span>' : '') +
      '</nav>';
  }
  function tagsHTML(b, latest) {
    var L = Lib(), P = L && L._pure, C = root.GNBldCode, t = [];
    var s = P && P.stateOf ? P.stateOf(b, latest) : 'vigente';
    t.push('<span class="bld-tag ' + (s === 'vigente' ? 'is-ok' : 'is-old') + '">' + (s === 'vigente' ? 'vigente · parche ' : 'revisar · era del parche ') + fmtDate(b.patch) + '</span>');
    var roles = P && P.ROLES || {}, dmg = { power: 'Poder', condition: 'Condición', hybrid: 'Híbrido' };
    if (b.damage) t.push('<span class="bld-tag">' + esc(dmg[b.damage] || b.damage) + '</span>');
    (b.roles || []).forEach(function (r) { if (r !== 'dps' || (b.roles || []).length === 1) t.push('<span class="bld-tag">' + esc(roles[r] || r) + '</span>'); });
    (b.weapons || []).forEach(function (w) { t.push('<span class="bld-tag">' + esc((C && C.WEAPONS_ES[w]) || w) + '</span>'); });
    return '<div class="bld-tags">' + t.join(' ') + '</div>';
  }

  // Equipo. v = GNBldItems.sheet(); null = la build no tiene equipo cargado; undefined = todavía buscando.
  function gearHTML(v, b) {
    if (v === undefined) return '<p class="bld-muted" role="status">Buscando el equipo en la API del juego…</p>';
    if (v === null && b && b.mine) {
      return '<p class="bld-muted">Esta build es tuya: el equipo lo elegís en el Editor (sección «Equipo y código AE2»).' +
        (b.source ? ' Se basa en una build que no está en la Biblioteca.' : '') + '</p>';
    }
    if (v === null) {
      return '<p class="bld-muted">Todavía no tengo el equipo de esta build' + (b && b.source ? ' (viene de ' + esc(b.source.name) + ')' : '') +
        '. Lo sumo con sus notas; mientras, está en la guía original.</p>';
    }
    // EQ-4: el equipo lo pinta js/bld-gearview.js (se carga antes que esta ficha, js/modules.json).
    var GV = root.GNBldGearView;
    return GV ? GV.html(v, b) : '<p class="bld-muted">No pude mostrar el equipo: recargá la página.</p>';
  }
  function traitsHTML(id, b) {
    if (st.viewErr[id]) return '<p class="bld-err" role="alert">' + esc(st.viewErr[id]) + '</p>';
    if (!st.views[id] || !S()) return '<p class="bld-muted" role="status">Buscando los rasgos y las habilidades en la API del juego…</p>';
    // EQ-5: con el ref de bld-ref 1.3.0, como en el juego (js/bld-traitview.js); las armas salen del equipo si ya llegó.
    var TV = root.GNBldTraitView, ref = st.refs[id];
    if (TV && ref && st.builds[id] && TV.ready(ref)) {
      return TV.html({ build: st.builds[id], ref: ref, view: st.views[id], checks: st.checks[id], code: b.code, gear: st.gear[id] || null,
        title: b.name, actions: ['share', 'gw2skills', 'edit'] });
    }
    return S().detailHTML(st.views[id], { code: b.code, checks: st.checks[id], title: b.name, actions: ['share', 'gw2skills', 'edit'] });
  }
  function playHTML(b) {
    // EQ-7: con js/bld-play.js, mis notas para jugarla (las lee bld-notes); sin el módulo, el aviso de antes.
    var PL = root.GNBldPlay, N = root.GNBldNotes;
    if (PL) return PL.html({ note: N ? N.noteSync(b.id) : null, loaded: N ? N.loaded() : true, ref: st.refs[b.id] || null, gear: st.gear[b.id] || null, source: b.source || null, mode: b.mode || '' });
    return '<p class="bld-muted">Mis notas para jugar esta build (conceptos, apertura y rotación) están en preparación.' +
      (b.source ? ' Mientras, la rotación completa está en la guía original: <a href="' + esc(b.source.url) + '" target="_blank" rel="noopener">' + esc(b.source.name) + ' ↗</a>.' : '') + '</p>';
  }
  // EQ-6: los desplegables de notas (js/bld-notes.js) van al pie de su sección; las propias tienen sus notas arriba.
  function notesHTML(b, keys) {
    var N = root.GNBldNotes;
    if (!N || b.mine) return '';
    return N.html({ keys: keys, note: N.noteSync(b.id), loaded: N.loaded(), ref: st.refs[b.id] || null, view: st.views[b.id] || null, gear: st.gear[b.id] || null });
  }
  function sectionHTML(key, label, body) {
    return '<details class="bld-sec" data-sheet-sec="' + key + '"' + (st.closed[key] ? '' : ' open') + '><summary><h4>' + esc(label) + '</h4></summary><div class="bld-sec-b">' + body + '</div></details>';
  }
  function fmtTime(t) { try { return t ? new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; } catch (_) { return ''; } }
  // EQ-3b: la ficha de una build de Mis builds. Encabezado con «editada», tus acciones y tu nombre y notas.
  function mineHTML(m) {
    var b = m.b, x = b.mine, L = Lib(), P = L && L._pure, V = root.GNBld;
    var band = V && typeof V.bandStyle === 'function' ? V.bandStyle(b.elite, null, b.prof) : '';
    var emb = S() && S().emblem ? S().emblem(b.prof, b.elite, 56, { label: true }) : '';
    var bench = b.base && P && P.benchHTML ? P.benchHTML(b.base, m.bidx) : '';
    var ask = st.confirm === b.id ? '<div class="bld-mine-ask" role="alert"><span>¿Borro «' + esc(b.name) + '»? No se puede deshacer (salvo desde tu respaldo).</span>' +
      '<button type="button" class="bld-btn bld-err" data-sheet="del-yes">Sí, borrar</button><button type="button" class="bld-btn" data-sheet="del-no">No</button></div>' : '';
    var notes = '<div class="bld-sh-notes"><label for="bldShTitle"><small>Nombre</small></label><input id="bldShTitle" maxlength="80" value="' + esc(x.title) + '">' +
      '<label for="bldShNotes"><small>Tus notas</small></label><textarea id="bldShNotes" rows="3" maxlength="1000">' + esc(x.notes || '') + '</textarea>' +
      '<p><button type="button" class="bld-btn" data-sheet="savemeta">Guardar nombre y notas</button> <small class="bld-muted">Quedan en este navegador y viajan en tu respaldo.</small></p></div>';
    var body = { notes: notes, gear: gearHTML(m.gear, b), traits: traitsHTML(b.id, b) };
    return navHTML(b, m.nav) +
      '<article class="bld-card bld-band bld-sheet" aria-labelledby="bldSheetTitle"' + band + '>' +
      '<header class="bld-sheet-h">' + emb + '<div class="bld-sheet-t"><h3 id="bldSheetTitle" tabindex="-1">' + esc(b.name) + '</h3>' +
      '<p class="bld-muted">' + esc(crumb(b).join(' · ')) + (x.updated ? ' · editada ' + esc(fmtTime(x.updated)) : '') +
      (b.source && b.source.url ? ' · basada en <a href="' + esc(b.source.url) + '" target="_blank" rel="noopener">' + esc(b.source.name || 'la fuente') + ' ↗</a>' : '') + '</p></div></header>' +
      bench +
      '<div class="bld-acts"><button type="button" class="bld-btn is-primary" data-bld-act="copy">Copiar código</button>' +
      '<button type="button" class="bld-btn" data-bld-act="share">Copiar enlace</button>' +
      '<button type="button" class="bld-btn" data-sheet="edit">Editar en el Editor</button>' + ae2BtnHTML(m) +
      '<button type="button" class="bld-btn" data-sheet="dup">Duplicar</button>' +
      '<button type="button" class="bld-btn" data-sheet="del">Borrar…</button></div>' + ask +
      MINE_SECTIONS.map(function (s) { return sectionHTML(s[0], s[1], body[s[0]]); }).join('') +
      '</article>';
  }
  // EQ-9a: copiar la build en AE2 (Alter Ego) con el equipo real: aparece cuando el equipo ya llegó.
  function ae2BtnHTML(m) {
    var A = root.GNBldAe2;
    if (!A || typeof A.fromSheetCode !== 'function' || !m || !m.gear || !m.b) return '';
    if (m.b.mine && !m.b.base) return '';
    return '<button type="button" class="bld-btn" data-sheet="ae2" title="Con estadísticas, runa, sigilos y reliquia, para el complemento Alter Ego">Copiar AE2 (Alter Ego)</button>';
  }
  // m = { b, nav, latest, bidx, gear }
  function sheetHTML(m) {
    if (m.b && m.b.mine) return mineHTML(m);
    var b = m.b, L = Lib(), P = L && L._pure, V = root.GNBld;
    var band = V && typeof V.bandStyle === 'function' ? V.bandStyle(b.elite, null, b.prof) : '';
    var emb = S() && S().emblem ? S().emblem(b.prof, b.elite, 56, { label: true }) : '';
    var bench = P && P.benchHTML ? P.benchHTML(b, m.bidx) : '';
    var issue = P && P.issueUrl ? P.issueUrl(b, m.latest) : '';
    var body = { gear: gearHTML(m.gear, b) + notesHTML(b, ['gear', 'relic']), traits: traitsHTML(b.id, b) + notesHTML(b, ['skills', 'traits']), play: playHTML(b) };
    return navHTML(b, m.nav) +
      '<article class="bld-card bld-band bld-sheet" aria-labelledby="bldSheetTitle"' + band + '>' +
      '<header class="bld-sheet-h">' + emb + '<div class="bld-sheet-t"><h3 id="bldSheetTitle" tabindex="-1">' + esc(b.name) + '</h3>' +
      '<p class="bld-muted">' + esc(crumb(b).join(' · ')) + ' · dificultad ' + (b.difficulty || '?') + '/5 · fuente actualizada ' + fmtDate(b.sourceUpdated) +
      (b.source ? ' · <a href="' + esc(b.source.url) + '" target="_blank" rel="noopener">' + esc(b.source.name) + ' ↗</a>' : '') + '</p>' + tagsHTML(b, m.latest) + '</div></header>' +
      bench +
      '<div class="bld-acts"><button type="button" class="bld-btn is-primary" data-bld-act="copy">Copiar código</button>' +
      '<button type="button" class="bld-btn" data-bld-act="save">Guardar en Mis builds</button>' + ae2BtnHTML(m) +
      '<button type="button" class="bld-btn" data-bld-act="share">Copiar enlace</button>' +
      (issue ? '<a class="bld-btn" href="' + esc(issue) + '" target="_blank" rel="noopener" title="Abre un aviso en GitHub ya escrito">Avisar que está vieja ↗</a>' : '') + '</div>' +
      SECTIONS.map(function (s) { return sectionHTML(s[0], s[1], body[s[0]]); }).join('') +
      '<p class="bld-muted"><small>Datos de la build: ' + (b.source ? esc(b.source.name) : 'la Biblioteca') + ' (élite, armas, equipo, código y fecha). Nombres, íconos y descripciones: API oficial de Guild Wars 2, en castellano.</small></p>' +
      '</article>';
  }
  function missingHTML(id) {
    if (isMine(id)) {
      return '<nav class="bld-sh-nav" aria-label="Navegación de la ficha"><button type="button" class="bld-btn" data-sheet="back">← Mis builds</button></nav>' +
        '<div class="bld-card" role="alert"><h3 id="bldSheetTitle" tabindex="-1">No encontré esa build en Mis builds</h3><p class="bld-muted">Puede que la hayas borrado ' +
        'o que esté guardada en otro navegador. Tus builds viajan en tu archivo de respaldo.</p></div>';
    }
    return '<nav class="bld-sh-nav" aria-label="Navegación de la ficha"><button type="button" class="bld-btn" data-sheet="back">← Biblioteca</button></nav>' +
      '<div class="bld-card" role="alert"><h3 id="bldSheetTitle" tabindex="-1">No encontré esa build</h3><p class="bld-muted">«' + esc(id) +
      '» no está en la Biblioteca: puede que la haya retirado o renombrado. Volvé a la Biblioteca para buscarla.</p></div>';
  }

  // ---------------------------------------------------------------- CSS (tokens de los 19 temas; el marco lo da bld-view)
  var P_ = '#buildsPanel ';
  var CSS = [
    P_ + '.bld-sh-nav{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:0 0 10px}',
    P_ + '.bld-crumb{display:flex;flex-wrap:wrap;gap:4px;list-style:none;margin:0;padding:0;color:var(--tx-2);font-size:.85rem}',
    P_ + '.bld-crumb li+li::before{content:"›";margin-right:4px;color:var(--tx-2)}',
    P_ + '.bld-sh-pn{margin-left:auto;display:flex;gap:6px;align-items:center}',
    P_ + '.bld-sheet{display:grid;gap:12px;cursor:default}' + P_ + '.bld-card.bld-band.bld-sheet:hover{transform:none}',
    P_ + '.bld-sheet-h{display:flex;gap:12px;align-items:flex-start}' + P_ + '.bld-sheet-h .bld-emb{margin-top:-38px;position:relative;box-shadow:0 0 0 2px var(--bg-1),0 0 0 3px var(--bld-prof,var(--gn-mod))}',
    P_ + '.bld-sheet-t{display:grid;gap:4px;min-width:0}' + P_ + '.bld-sheet-t h3{margin:0;font-size:1.2rem;color:var(--tx-1)}' + P_ + '.bld-sheet-t p{margin:0;font-size:.82rem}',
    P_ + '.bld-sec{border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-1)}',
    P_ + '.bld-sec>summary{cursor:pointer;padding:10px 12px;list-style:none;display:flex;align-items:center;gap:8px}' + P_ + '.bld-sec>summary::-webkit-details-marker{display:none}',
    P_ + '.bld-sec>summary::before{content:"+";font-weight:800;color:var(--gn-mod);width:1em;text-align:center}' + P_ + '.bld-sec[open]>summary::before{content:"—"}',
    P_ + '.bld-sec>summary h4{margin:0;font-size:1rem;color:var(--tx-1)}' + P_ + '.bld-sec[open]>summary{border-bottom:1px solid var(--bd-1)}',
    P_ + '.bld-sec-b{padding:10px 12px;display:grid;gap:10px}',
    P_ + '.bld-sec-b>.bld-detail{border:0;padding:0;background:none;box-shadow:none}' + P_ + '.bld-sec-b>.bld-detail>.bld-detail-h{display:none}',
    P_ + '.bld-gsum{margin:0}',
    P_ + '.bld-sh-notes{display:grid;gap:4px;max-width:640px}' + P_ + '.bld-sh-notes small{color:var(--tx-2);font-size:.7rem;text-transform:uppercase}' + P_ + '.bld-sh-notes p{margin:4px 0 0}',
    P_ + '.bld-sh-notes input,' + P_ + '.bld-sh-notes textarea{width:100%;box-sizing:border-box;background:var(--bg-0);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:8px;padding:6px 8px;font:inherit}',
    P_ + '.bld-sheet>.bld-mine-ask{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border:1px solid var(--bld-err);border-radius:10px;font-size:.85rem;color:var(--tx-1)}',
    '@media (max-width:720px){' + P_ + '.bld-sh-pn{margin-left:0;width:100%;justify-content:space-between}' + '}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-sheet-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-sheet-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  // ---------------------------------------------------------------- datos y comportamiento
  function current() {
    if (isMine(st.id)) return mineB(st.id.slice(2));
    var L = Lib(); return L && typeof L.byId === 'function' ? L.byId(st.id) : null;
  }
  // Lo que recorren «anterior / siguiente»: lo filtrado en la Biblioteca o, en una propia, Mis builds.
  function listFor(id) {
    if (isMine(id)) {
      var T = root.GNBldStore, xs = T && typeof T.list === 'function' ? T.list() : [];
      return xs.map(function (x) { return { id: 'm:' + x.id, name: x.title }; });
    }
    var L = Lib(); return L && typeof L.list === 'function' ? L.list() : [];
  }
  function model(b) {
    var L = Lib(), ls = (L && L._state) || {}, P = L && L._pure;
    var latest = P && P.latestPatch ? P.latestPatch(ls.cat, ls.watch) : '';
    return { b: b, nav: navOf(listFor(b.id), b.id), latest: latest, bidx: ls.bidx,
      gear: Object.prototype.hasOwnProperty.call(st.gear, b.id) ? st.gear[b.id] : (st.gearErr[b.id] ? null : undefined) };
  }
  function paint(ctx) {
    if (!ctx || !ctx.host) return;
    var b = current();
    var L = Lib(), ls = L && L._state;
    if (!b) ctx.host.innerHTML = (ls && ls.cat) || isMine(st.id) ? missingHTML(st.id) : '<div class="bld-card" role="status">Cargando la ficha…</div>';
    else ctx.host.innerHTML = sheetHTML(model(b));
    if (st.focusTitle) {
      var t = ctx.host.querySelector && ctx.host.querySelector('#bldSheetTitle');
      if (t && t.focus) { st.focusTitle = false; t.focus(); }
    }
  }
  function loadParts(ctx, b) {
    var I = root.GNBldItems, gid = b.mine ? (b.base && b.base.id) : b.id;
    if (b.mine && !gid) { st.gear[b.id] = null; I = null; }
    if (I && !Object.prototype.hasOwnProperty.call(st.gear, b.id) && !st.gearErr[b.id]) {
      I.load(gid).then(function (r) { st.gear[b.id] = r.view; if (st.id === b.id) paint(ctx); },
        function () { st.gearErr[b.id] = true; if (st.id === b.id) paint(ctx); });
    } else if (!I && !b.mine) st.gearErr[b.id] = true;
    var N = root.GNBldNotes;
    if (N && !N.loaded() && !st.notesAsk) {
      st.notesAsk = true;
      var again = function () { st.notesAsk = false; if (st.id === b.id) paint(ctx); };
      N.load().then(again, again);
    }
    var C = root.GNBldCode, R = ctx.ref;
    if (st.views[b.id] || st.viewErr[b.id] || !C || !R) return;
    var r = C.parse(b.code);
    if (!r.ok) { st.viewErr[b.id] = r.error; return; }
    R.load(r.build.profession).then(function (ref) {
      st.views[b.id] = R.resolve(r.build, ref); st.checks[b.id] = R.check(r.build, ref); st.refs[b.id] = ref; st.builds[b.id] = r.build;
      if (st.id === b.id) paint(ctx);
    }, function (e) { st.viewErr[b.id] = 'No pude traer los nombres del juego (' + (e && e.message || '') + ').'; if (st.id === b.id) paint(ctx); });
  }
  function show(ctx) {
    var b = current();
    paint(ctx);
    if (b) loadParts(ctx, b);
  }
  // Un clic: devuelve qué hizo (para los tests).
  function onClick(ctx, e) {
    var t = e.target, x = t && t.closest ? t.closest('[data-sheet]') : null;
    if (!x) return '';
    var k = x.getAttribute('data-sheet'), L = Lib(), mine = isMine(st.id);
    if (k === 'back') {
      var M = root.GNBldMine, back = mine ? M : L;
      if (back && typeof back.remember === 'function' && st.id) back.remember(mine ? st.id.slice(2) : st.id);
      ctx.go(mine ? 'mine' : 'lib');
      return 'back';
    }
    if (k === 'prev' || k === 'next') {
      var nav = navOf(listFor(st.id), st.id);
      var to = k === 'prev' ? nav.prev : nav.next;
      if (to) { st.focusTitle = true; st.confirm = ''; ctx.go('sheet', to.id); return k; }
      return '';
    }
    if (k === 'ae2') return ae2Act(ctx);
    if (mine) return mineAct(ctx, k);
    return '';
  }
  // EQ-9a: el AE2 de la build que se está viendo, con el equipo ya traído ('' si no se puede).
  function ae2Code() {
    var b = current(), A = root.GNBldAe2;
    if (!b || !A || typeof A.fromSheetCode !== 'function') return '';
    return A.fromSheetCode(st.gear[b.id] || null, { code: b.code, mode: b.mode, sub: b.sub });
  }
  function ae2Act(ctx) {
    var code = ae2Code(), toast = function (m, kind) { if (ctx && ctx.toast) ctx.toast(m, kind); };
    if (!code) { toast('No pude armar el código AE2 de esta build.', 'err'); return 'ae2'; }
    Promise.resolve(S() ? S().copy(code) : false).then(function (ok) {
      toast(ok ? 'AE2 copiado: pegalo en Alter Ego (Build Library → Import).' : 'No pude copiar el AE2: probá de nuevo.', ok ? 'ok' : 'err');
    });
    return 'ae2';
  }
  // EQ-3b: acciones de una build propia (Mis builds, js/bld-store.js).
  function mineAct(ctx, k) {
    var T = ctx.store || root.GNBldStore, raw = st.id.slice(2), b = current();
    var toast = function (m, kind) { if (ctx.toast) ctx.toast(m, kind); };
    if (!T || !b) return '';
    if (k === 'edit') { ctx.go('editor', 'm:' + raw); return 'edit'; }
    if (k === 'dup') {
      var d = T.duplicate(raw);
      toast(d && d.ok ? 'Duplicada: ahora estás en la copia.' : (d && d.error) || 'No pude duplicarla.', d && d.ok ? 'ok' : 'err');
      if (d && d.ok) { st.focusTitle = true; ctx.go('sheet', 'm:' + d.id); }
      return 'dup';
    }
    if (k === 'del') { st.confirm = b.id; paint(ctx); focusIn(ctx, '[data-sheet="del-yes"]'); return 'del'; }
    if (k === 'del-no') { st.confirm = ''; paint(ctx); focusIn(ctx, '[data-sheet="del"]'); return 'del-no'; }
    if (k === 'del-yes') {
      st.confirm = '';
      var r = T.remove(raw);
      toast(r && r.ok ? 'Borrada.' : (r && r.error) || 'No pude borrarla.', r && r.ok ? 'ok' : 'err');
      if (r && r.ok) ctx.go('mine');
      return 'del-yes';
    }
    if (k === 'savemeta') {
      var h = ctx.host, ti = h && h.querySelector && h.querySelector('#bldShTitle'), no = h && h.querySelector && h.querySelector('#bldShNotes');
      var u = T.update(raw, { title: ti ? ti.value : null, notes: no ? no.value : null });
      toast(u && u.ok ? 'Guardado.' : (u && u.error) || 'No pude guardarlo.', u && u.ok ? 'ok' : 'err');
      paint(ctx);
      return 'savemeta';
    }
    return '';
  }
  function focusIn(ctx, sel) { var e = ctx.host && ctx.host.querySelector && ctx.host.querySelector(sel); if (e && e.focus) e.focus(); }

  function render(host, ctx) {
    if (S()) S().ensureCss();
    if (root.GNBldBench) root.GNBldBench.ensureCss();
    ensureCss();
    if (root.GNBldGearView) root.GNBldGearView.ensureCss();
    if (root.GNBldTraitView) root.GNBldTraitView.ensureCss();
    if (root.GNBldNotes) root.GNBldNotes.ensureCss();
    if (root.GNBldPlay) root.GNBldPlay.ensureCss();
    ctx.host = host;
    st.ctx = ctx;
    if (st.id !== ctx.arg) { st.id = ctx.arg || ''; st.focusTitle = true; st.confirm = ''; }
    if (!host.__bldSheet) {
      host.__bldSheet = true;
      host.addEventListener('click', function (e) { onClick(st.ctx, e); });
      if (root.GNBldGearView) root.GNBldGearView.wire(host);
      if (root.GNBldTraitView) root.GNBldTraitView.wire(host);
      host.addEventListener('toggle', function (e) {
        var d = e.target, k = d && d.getAttribute && d.getAttribute('data-sheet-sec');
        if (k) st.closed[k] = !d.open;
      }, true);
      if (S()) S().wire(host, function () { var b = current(); return b ? { code: b.code, title: b.name, source: b.source } : null; }, ctx);
    }
    var L = Lib();
    if (L && typeof L.preload === 'function' && !(L._state && L._state.cat)) {
      paint(ctx);
      return L.preload().then(function () { if (st.ctx === ctx) show(ctx); }, function (e) {
        host.innerHTML = '<div class="bld-card bld-err" role="alert">No pude cargar la Biblioteca (' + esc(e && e.message || '') + ').</div>';
      });
    }
    show(ctx);
  }

  var api = { version: VERSION, render: render,
    _pure: { navOf: navOf, crumb: crumb, sheetHTML: sheetHTML, gearHTML: gearHTML, navHTML: navHTML, missingHTML: missingHTML, onClick: onClick, CSS: CSS, SECTIONS: SECTIONS,
      isMine: isMine, mineB: mineB, listFor: listFor, MINE_SECTIONS: MINE_SECTIONS, ae2Code: ae2Code, ae2BtnHTML: ae2BtnHTML },
    _state: st };
  root.GNBldSheet = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('sheet', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
