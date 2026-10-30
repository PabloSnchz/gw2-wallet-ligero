/*!
 * js/bld-lib.js — Builds: pestaña Biblioteca (BL-082 BLD-7, BLD-8, BLD-10 y BLD-15: A1–A6, C2, D4)
 * Versión: 1.7.0 (2026-10-29) · BENCH-2: sin bench exacto, la build de PvE que hace daño muestra la «Referencia» medida más
 *          parecida (js/bld-bench.js), diciendo en qué se parece y que no es su DPS · antes 1.6.0 BENCH-1: cada build de PvE con bench publicado muestra su DPS en el golem de Snow Crows
 *          (máximo, promedio, % de la mejor y barra), «Más DPS primero» y, si no hay bench, por qué · antes 1.5.0 BUI-6b: la tarjeta pasa su profesión al marco (franja con el arte de su élite,
 *          filo y tinte del color de la profesión) · antes 1.4.0 BUI-6: la tarjeta lleva el fondo oficial de su élite de borde a borde (GNBld.bandStyle)
 *          y el emblema a 56 px · antes 1.3.0 BUI-5: contraste AA en los 19 temas: lo elegido sobre --bg-0 al 14 % y las profesiones
 *          sin elegir se atenúan solo en el ícono (el texto queda entero) · antes 1.2.0 BUI-4: preload() trae el
 *          catálogo sin dibujar (para la cabecera de Builds); el estilo del
 *          menú ⋯ y del botón principal pasa al marco común (js/bld-view.js) · antes 1.1.0 (2026-10-28) · BUI-2: las 9 profesiones y sus élites como íconos oficiales, modo y rol como chips,
 *          «Más filtros» (arma, daño, vigencia, búsqueda) y tarjeta con emblema, «Copiar código» y menú ⋯ · antes 1.0.0
 *
 * Builds curadas por mí (assets/data/builds/catalog.json): solo datos factuales (élite, modo, rol, armas, código,
 * fecha) con crédito y enlace a la fuente; ni textos ni imágenes de terceros (D1).
 * Filtros: profesión y élite (íconos), modo y rol (chips) y, en «Más filtros», arma, tipo de daño, vigencia y búsqueda.
 * Profesión, modo y rol en 3 toques. Vigencia (D4): cada build dice para qué parche la revisé; si la vigía semanal
 * (assets/data/builds/watch.json) detecta un parche de balance más nuevo, pasa a «revisar».
 * Cada build: copiar código, ver la ficha (con validación contra la API) y, en el menú ⋯, guardar en Mis builds,
 * abrir la fuente y «avisar que está vieja» (un issue de GitHub ya escrito, A6 sin servidor).
 * Bench (BENCH-1): assets/data/builds/bench.json = benchmarks públicos de Snow Crows (DPS contra el golem, el techo
 * ideal); se cruza por la dirección de la build en la fuente. WvW, PvP, curación y tanque no tienen golem: se dice.
 * Íconos: GNBldRef.identity() (API oficial); hasta que llegan, las profesiones se muestran con su nombre.
 */
(function (root) {
  'use strict';

  var VERSION = '1.7.0';
  var CATALOG = 'assets/data/builds/catalog.json';
  var WATCH = 'assets/data/builds/watch.json';
  var BENCH = 'assets/data/builds/bench.json';
  var ISSUES = 'https://github.com/PabloSnchz/gw2-factory-dev/issues/new';
  var MODES = { pve: 'PvE', wvw: 'WvW', pvp: 'PvP' };
  var SUB = { raids: 'raids y strikes', fractals: 'fractales', 'open-world': 'mundo abierto', accessibuilds: 'accesible', roaming: 'roaming', zerg: 'zerg', conquest: 'conquista' };
  var ROLES = { dps: 'DPS', quickness: 'Celeridad', alacrity: 'Alacridad', heal: 'Curación', support: 'Apoyo', boon: 'Bendiciones', cc: 'Control' };
  var DAMAGE = { power: 'Poder', condition: 'Condición', hybrid: 'Híbrido' };
  var SORT = { '': 'Orden de la biblioteca', dps: 'Más DPS primero' };
  var st = { cat: null, watch: null, bench: null, bidx: null, error: '', loading: false, f: { prof: 0, elite: 0, mode: '', role: '', weapon: '', damage: '', state: '', q: '', sort: '' },
    open: '', more: false, views: {}, checks: {}, viewErr: {} };

  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }
  function C() { return root.GNBldCode; }
  function ident() { var R = root.GNBldRef; return R && typeof R.identitySync === 'function' ? R.identitySync() : null; }
  function emblem(prof, elite, size, label) {
    var S = root.GNBldShow;
    return S && typeof S.emblem === 'function' ? S.emblem(prof, elite, size, { label: label }) : '';
  }

  // ---------------------------------------------------------------- modelo (puro)
  function latestPatch(cat, watch) {
    var a = (cat && cat.patch && cat.patch.latest) || '', b = (watch && watch.latestPatch) || '';
    return b > a ? b : a;
  }
  function stateOf(b, latest) { return b.patch && latest && b.patch < latest ? 'revisar' : 'vigente'; }
  function filter(builds, f, latest) {
    var q = String(f.q || '').trim().toLowerCase();
    return builds.filter(function (b) {
      if (f.prof && b.prof !== f.prof) return false;
      if (f.elite && b.elite !== f.elite) return false;
      if (f.mode && b.mode !== f.mode) return false;
      if (f.role && (b.roles || []).indexOf(f.role) < 0) return false;
      if (f.weapon && (b.weapons || []).indexOf(f.weapon) < 0) return false;
      if (f.damage && b.damage !== f.damage) return false;
      if (f.state && stateOf(b, latest) !== f.state) return false;
      if (q && (b.name + ' ' + (b.eliteName || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  // Cobertura (criterio 1): élites con al menos una build vigente por modo.
  // any = true cuenta también las que están «para revisar».
  function coverage(builds, latest, any) {
    var out = {};
    builds.forEach(function (b) { if (any || stateOf(b, latest) === 'vigente') { out[b.mode] = out[b.mode] || {}; out[b.mode][b.elite] = true; } });
    var n = {}; Object.keys(out).forEach(function (m) { n[m] = Object.keys(out[m]).length; });
    return n;
  }
  function issueUrl(b, latest) {
    var title = 'Build vieja: ' + b.name + ' (' + (MODES[b.mode] || b.mode) + ')';
    var body = 'Build de la Biblioteca: ' + b.id + '\nRevisada para el parche: ' + (b.patch || '?') + '\nÚltimo parche conocido: ' + (latest || '?') +
      '\nFuente: ' + (b.source && b.source.url || '') + '\n\n¿Qué cambió? (opcional)\n';
    return ISSUES + '?labels=' + encodeURIComponent('build-vieja') + '&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }
  // BENCH-1: bench de Snow Crows por la dirección de la build en la fuente (profesión/nombre, sin la sección).
  function benchKey(url) { var m = /^https:\/\/snowcrows\.com\/(?:en\/)?builds\/(?:[a-z-]+\/)?([a-z]+\/[a-z0-9-]+)\/?$/.exec(String(url || '')); return m ? m[1] : ''; }
  function benchIndex(bench) {
    var idx = { top: 0, n: 0, rows: {} }, F = bench && bench.fields;
    if (!Array.isArray(F) || !Array.isArray(bench.rows)) return idx;
    bench.rows.forEach(function (r) {
      var o = {}; F.forEach(function (k, i) { o[k] = r[i]; });
      if (typeof o.path !== 'string' || !(o.max > 0)) return;
      if (!/^[A-Za-z0-9_-]+$/.test(o.log || '')) o.log = '';
      idx.rows[o.path] = o; idx.n++; if (o.max > idx.top) idx.top = o.max;
    });
    return idx;
  }
  function benchOf(b, idx) { return idx && b && b.mode === 'pve' && b.source && b.source.name === 'Snow Crows' ? idx.rows[benchKey(b.source.url)] || null : null; }
  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  // «Más DPS primero»: las que tienen bench, de mayor a menor; después el resto en el orden de la biblioteca.
  function sortBuilds(list, sort, idx) {
    if (sort !== 'dps') return list;
    return list.map(function (b, i) { var m = benchOf(b, idx); return { b: b, i: i, v: m ? m.max : -1 }; })
      .sort(function (x, y) { return y.v - x.v || x.i - y.i; }).map(function (x) { return x.b; });
  }
  function benchHTML(b, idx) {
    var m = benchOf(b, idx);
    if (!m) {
      // BENCH-2: sin medición propia, la medida más parecida (solo PvE y si hace daño); si no hay, por qué.
      var B = root.GNBldBench, r = B && typeof B.forLib === 'function' ? B.forLib(b, idx) : null;
      if (r) return B.html(r, idx);
      var why = b.mode !== 'pve' ? 'en ' + (MODES[b.mode] || b.mode) + ' no hay golem que mida el daño' : 'Snow Crows no publica bench de esta variante (solo mide DPS; no curación ni tanque)';
      return '<p class="bld-bench is-none bld-muted">Sin bench de daño: ' + esc(why) + '.</p>';
    }
    var pct = Math.max(1, Math.min(100, Math.round(m.max / idx.top * 100)));
    var boon = (b.roles || []).some(function (r) { return r !== 'dps'; });
    return '<div class="bld-bench" title="Bench de Snow Crows contra el golem: el techo ideal de la build; en una pelea real se hace menos.">' +
      '<p class="bld-bench-t"><b>' + fmtN(m.max) + ' DPS</b><span class="bld-muted">promedio ' + fmtN(m.avg) + ' · ' + pct + ' % de la mejor' + (boon ? ' · además da bendiciones' : '') + '</span>' +
      (m.log ? '<a class="bld-muted" href="https://dps.report/' + esc(m.log) + '" target="_blank" rel="noopener">registro ↗</a>' : '') + '</p>' +
      '<span class="bld-bench-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></div>';
  }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '—'); }
  // Cuántos filtros de «Más filtros» están puestos (para mostrarlo en el botón y abrirlo solo).
  function moreCount(f) { return ['weapon', 'damage', 'state', 'q'].filter(function (k) { return f[k]; }).length; }

  // ---------------------------------------------------------------- vista
  function chips(label, key, map, cur) {
    return '<div class="bld-chips" role="group" aria-label="' + esc(label) + '">' +
      ['<button type="button" class="bld-chip" data-lib-p="' + key + '" data-v="" aria-pressed="' + (!cur) + '">' + (key === 'mode' ? 'Todos los modos' : key === 'role' ? 'Todos los roles' : 'Todos') + '</button>']
        .concat(Object.keys(map).map(function (k) {
          return '<button type="button" class="bld-chip" data-lib-p="' + key + '" data-v="' + k + '" aria-pressed="' + (cur === k) + '">' + esc(map[k]) + '</button>';
        })).join('') + '</div>';
  }
  function profsHTML(f, id) {
    var Cc = C();
    var all = '<button type="button" class="bld-pf is-all" data-lib-prof="0" aria-pressed="' + (!f.prof) + '">Todas</button>';
    return '<div class="bld-profs" role="group" aria-label="Profesión">' + all + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (p) {
      var name = (id && id.profs[p] && id.profs[p].name) || Cc.PROF_ES[p];
      return '<button type="button" class="bld-pf' + (id ? '' : ' is-text') + '" data-lib-prof="' + p + '" aria-pressed="' + (f.prof === p) + '" aria-label="' + esc(name) + '" title="' + esc(name) + '">' +
        (id ? emblem(p, 0, 30, false) : '<span>' + esc(name) + '</span>') + '</button>';
    }).join('') + '</div>';
  }
  function elitesHTML(cat, f, id) {
    if (!f.prof) return '';
    var seen = {}, list = [];
    cat.builds.forEach(function (b) { if (b.prof === f.prof && !seen[b.elite]) { seen[b.elite] = 1; list.push({ id: b.elite, name: b.eliteName }); } });
    if (id && id.profs[f.prof]) {
      var order = id.profs[f.prof].elites;
      list.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
    }
    var pname = (id && id.profs[f.prof] && id.profs[f.prof].name) || C().PROF_ES[f.prof];
    return '<div class="bld-elites" role="group" aria-label="Élites de ' + esc(pname) + '"><small>Élites:</small>' +
      '<button type="button" class="bld-el" data-lib-elite="0" aria-pressed="' + (!f.elite) + '">Todas</button>' +
      list.map(function (e) {
        var name = (id && id.elites[e.id] && id.elites[e.id].name) || e.name;
        return '<button type="button" class="bld-el" data-lib-elite="' + e.id + '" aria-pressed="' + (f.elite === e.id) + '">' + (id ? emblem(f.prof, e.id, 22, false) : '') + esc(name) + '</button>';
      }).join('') + '</div>';
  }
  function moreHTML(cat, f) {
    var Cc = C(), weapons = {};
    cat.builds.forEach(function (b) { (b.weapons || []).forEach(function (w) { weapons[w] = Cc.WEAPONS_ES[w] || w; }); });
    var n = moreCount(f), open = st.more || n > 0;
    var wopts = Object.keys(weapons).map(function (w) { return [w, weapons[w]]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
    return '<details class="bld-more" data-lib-more' + (open ? ' open' : '') + '><summary>Más filtros' + (n ? ' (' + n + ')' : '') + '</summary><div class="bld-more-b">' +
      '<label class="bld-f" for="bldLibQ"><small>Buscar</small><input id="bldLibQ" type="search" data-lib-f="q" value="' + esc(f.q) + '" placeholder="nombre o élite"></label>' +
      '<label class="bld-f" for="bldLibWeapon"><small>Arma</small><select id="bldLibWeapon" data-lib-f="weapon"><option value="">Todas</option>' +
      wopts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === f.weapon ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
      '<div class="bld-f"><small>Daño</small>' + chips('Daño', 'damage', DAMAGE, f.damage) + '</div>' +
      '<div class="bld-f"><small>Vigencia</small>' + chips('Vigencia', 'state', { vigente: 'Vigentes', revisar: 'Para revisar' }, f.state) + '</div>' +
      (n || f.prof || f.mode || f.role ? '<button type="button" class="bld-btn" data-lib="clear">Sacar todos los filtros</button>' : '') +
      '</div></details>';
  }
  function filtersHTML(cat, f) {
    var id = ident();
    return '<div class="bld-filters">' + profsHTML(f, id) + elitesHTML(cat, f, id) +
      '<div class="bld-chiprow">' + chips('Modo', 'mode', MODES, f.mode) + '<span class="bld-sep" aria-hidden="true"></span>' + chips('Rol', 'role', ROLES, f.role) +
      (st.bidx && st.bidx.n ? '<span class="bld-sep" aria-hidden="true"></span><div class="bld-chips" role="group" aria-label="Orden">' + Object.keys(SORT).map(function (k) {
        return '<button type="button" class="bld-chip" data-lib-p="sort" data-v="' + k + '" aria-pressed="' + ((f.sort || '') === k) + '">' + esc(SORT[k]) + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      moreHTML(cat, f) + '</div>';
  }
  function cardHTML(b, latest) {
    var Cc = C(), s = stateOf(b, latest), on = st.open === b.id;
    var tags = ['<span class="bld-tag ' + (s === 'vigente' ? 'is-ok' : 'is-old') + '">' + (s === 'vigente' ? 'vigente · parche ' + fmtDate(b.patch) : 'revisar · era del parche ' + fmtDate(b.patch)) + '</span>'];
    if (b.damage) tags.push('<span class="bld-tag">' + esc(DAMAGE[b.damage]) + '</span>');
    (b.roles || []).forEach(function (r) { if (r !== 'dps' || (b.roles || []).length === 1) tags.push('<span class="bld-tag">' + esc(ROLES[r] || r) + '</span>'); });
    (b.weapons || []).forEach(function (w) { tags.push('<span class="bld-tag">' + esc(Cc.WEAPONS_ES[w] || w) + '</span>'); });
    var V = root.GNBld, band = V && typeof V.bandStyle === 'function' ? V.bandStyle(b.elite, null, b.prof) : '';
    var h = '<li class="bld-card bld-lib-card bld-band' + (on ? ' is-open' : '') + '" data-id="' + esc(b.id) + '"' + band + '>' +
      emblem(b.prof, b.elite, 56, true).replace('class="bld-emb', 'class="bld-emb bld-lib-emb') +
      '<div class="bld-lib-main"><b class="bld-lib-t">' + esc(b.name) + '</b>' +
      '<p class="bld-muted">' + esc(Cc.PROF_ES[b.prof]) + ' · ' + esc(MODES[b.mode] || b.mode) + (b.sub ? ' (' + esc(SUB[b.sub] || b.sub) + ')' : '') +
      ' · dificultad ' + (b.difficulty || '?') + '/5 · fuente actualizada ' + fmtDate(b.sourceUpdated) + '</p>' +
      '<div class="bld-tags">' + tags.join(' ') + '</div></div>' + benchHTML(b, st.bidx) +
      '<div class="bld-acts"><button type="button" class="bld-btn is-primary" data-bld-act="copy">Copiar código</button>' +
      '<button type="button" class="bld-btn" data-lib="toggle" aria-expanded="' + on + '">' + (on ? 'Cerrar ficha' : 'Ver ficha') + '</button>' +
      '<details class="bld-menu"><summary class="bld-btn" aria-label="Más acciones: ' + esc(b.name) + '" title="Más acciones">⋯</summary><div class="bld-menu-l">' +
      '<button type="button" class="bld-btn" data-bld-act="save">Guardar en Mis builds</button>' +
      '<a class="bld-btn" href="' + esc(b.source.url) + '" target="_blank" rel="noopener">Abrir en ' + esc(b.source.name) + ' ↗</a>' +
      '<a class="bld-btn" href="' + esc(issueUrl(b, latest)) + '" target="_blank" rel="noopener" title="Abre un aviso en GitHub ya escrito">Avisar que está vieja ↗</a>' +
      '</div></details></div>';
    if (on) {
      h += st.views[b.id] ? root.GNBldShow.detailHTML(st.views[b.id], { code: b.code, checks: st.checks[b.id], title: b.name,
        meta: esc(MODES[b.mode]) + ' · <a href="' + esc(b.source.url) + '" target="_blank" rel="noopener">' + esc(b.source.name) + ' ↗</a>', actions: ['share', 'gw2skills', 'edit'] })
        : (st.viewErr[b.id] ? '<p class="bld-err" role="alert">' + esc(st.viewErr[b.id]) + '</p>' : '<p class="bld-muted" role="status">Buscando los nombres en la API del juego…</p>');
    }
    return h + '</li>';
  }
  function viewHTML() {
    if (st.loading) return '<div class="bld-card" role="status">Cargando la biblioteca…</div>';
    if (st.error) return '<div class="bld-card bld-err" role="alert">' + esc(st.error) + ' <button type="button" class="bld-btn" data-lib="retry">Reintentar</button></div>';
    if (!st.cat) return '';
    var latest = latestPatch(st.cat, st.watch), list = sortBuilds(filter(st.cat.builds, st.f, latest), st.f.sort, st.bidx);
    var nb = st.cat.builds.filter(function (b) { return benchOf(b, st.bidx); }).length;
    var old = st.cat.builds.filter(function (b) { return stateOf(b, latest) === 'revisar'; }).length;
    var cov = coverage(st.cat.builds, latest, true), ok = coverage(st.cat.builds, latest);
    var fresh = st.watch && st.watch.latestPatch && st.cat.patch && st.watch.latestPatch > st.cat.patch.latest;
    var line = old ? (fresh ? '<p class="bld-shv" role="status"><b>Ojo:</b> salió un parche de balance (' + fmtDate(latest) + ') y ' + old + (old === 1 ? ' build quedó' : ' builds quedaron') +
      ' para revisar. Las marco hasta que las revise. <small class="bld-muted">Lo sé por: la vigía semanal · en este navegador</small></p>'
      : '<p class="bld-shv" role="status">' + old + (old === 1 ? ' build dice' : ' builds dicen') + ' en su fuente que son de un parche anterior al último de balance (' + fmtDate(latest) +
      '). Las marco «para revisar»: sirven, pero conviene mirar la fuente. <small class="bld-muted">Lo sé por: la fecha que declara cada fuente</small></p>')
      : '<p class="bld-shv">Todas las builds están revisadas para el último parche de balance (' + fmtDate(latest) + '). <small class="bld-muted">Lo sé por: la biblioteca y la vigía semanal</small></p>';
    return line + filtersHTML(st.cat, st.f) +
      '<p class="bld-muted bld-count" aria-live="polite">' + list.length + ' de ' + st.cat.builds.length + ' builds · élites cubiertas: ' + ['pve', 'wvw', 'pvp'].filter(function (m) { return cov[m]; }).map(function (m) { return MODES[m] + ' ' + cov[m] + '/36' + (ok[m] !== cov[m] ? ' (' + (ok[m] || 0) + ' vigentes)' : ''); }).join(', ') + (nb ? ' · ' + nb + ' con bench de daño' : '') + '</p>' +
      (list.length ? '<ul class="bld-lib">' + list.map(function (b) { return cardHTML(b, latest); }).join('') + '</ul>'
        : '<div class="bld-card bld-muted">Ninguna build con esos filtros. <button type="button" class="bld-btn" data-lib="clear">Sacar todos los filtros</button></div>') +
      '<p class="bld-muted"><small>Builds curadas por mí con datos de ' + (st.cat.sources || []).map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>'; }).join(', ') +
      ': élite, modo, rol, armas, código y fecha; los textos, guías y rotaciones están en cada fuente.' +
      (nb ? ' Bench de daño: <a href="' + esc(st.bench.source && st.bench.source.url || '') + '" target="_blank" rel="noopener">benchmarks de Snow Crows</a> (DPS contra el golem, ' + esc(fmtDate(st.bench.fetched)) + '): es el techo ideal, en una pelea real se hace menos.' : '') + ' Íconos: API oficial de Guild Wars 2. Si una fuente pide retirar algo, se retira.</small></p>';
  }

  var CSS = [
    '#buildsPanel .bld-filters{display:grid;gap:10px;margin-bottom:12px}',
    '#buildsPanel .bld-profs{display:flex;flex-wrap:wrap;gap:6px}',
    '#buildsPanel .bld-pf{min-width:44px;height:44px;border-radius:10px;border:1px solid var(--bd-1);background:var(--bg-0);color:var(--tx-1);display:grid;place-items:center;padding:0 6px;cursor:pointer;font:inherit;font-size:.8rem}',
    '#buildsPanel .bld-pf .bld-emb{background:none;box-shadow:none;padding:0}',
    '#buildsPanel .bld-pf img{opacity:.7}#buildsPanel .bld-pf:hover img,#buildsPanel .bld-pf:focus-visible img,#buildsPanel .bld-pf[aria-pressed=true] img{opacity:1}',
    '#buildsPanel .bld-pf[aria-pressed=true]{opacity:1;border-color:var(--gn-mod);box-shadow:0 0 0 1px var(--gn-mod);background:color-mix(in srgb,var(--gn-mod) 14%,var(--bg-0))}',
    '#buildsPanel .bld-elites{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#buildsPanel .bld-elites small{color:var(--tx-2)}',
    '#buildsPanel .bld-el{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--bd-1);border-radius:999px;padding:2px 10px 2px 3px;font:inherit;font-size:.8rem;color:var(--tx-2);background:var(--bg-0);cursor:pointer;min-height:30px}',
    '#buildsPanel .bld-el[data-lib-elite="0"]{padding-left:10px}#buildsPanel .bld-el .bld-emb{background:none;box-shadow:none;padding:0}',
    '#buildsPanel .bld-el[aria-pressed=true]{border-color:var(--gn-mod);color:var(--tx-1);background:color-mix(in srgb,var(--gn-mod) 14%,var(--bg-0))}',
    '#buildsPanel .bld-chiprow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#buildsPanel .bld-sep{width:1px;height:20px;background:var(--bd-1);margin:0 4px}',
    '#buildsPanel .bld-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '#buildsPanel .bld-chip{font:inherit;font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 11px;color:var(--tx-2);background:var(--bg-0);cursor:pointer;min-height:30px}',
    '#buildsPanel .bld-chip[aria-pressed=true]{border-color:var(--gn-mod);color:var(--tx-1);background:color-mix(in srgb,var(--gn-mod) 14%,var(--bg-0))}',
    '#buildsPanel .bld-more>summary{cursor:pointer;color:var(--tx-1);font-size:.85rem;width:max-content;padding:4px 0}',
    '#buildsPanel .bld-more-b{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;padding:8px 0 2px}',
    '#buildsPanel .bld-f small{display:block;color:var(--tx-2);font-size:.7rem;text-transform:uppercase;margin-bottom:3px}',
    '#buildsPanel .bld-f select,#buildsPanel .bld-f input{background:var(--bg-0);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:8px;padding:5px 8px;font:inherit}',
    '#buildsPanel .bld-count{margin:0 0 8px}',
    '#buildsPanel .bld-lib{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}',
    '#buildsPanel .bld-lib-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 12px;align-content:start;cursor:pointer}',
    '#buildsPanel .bld-lib-card.is-open{grid-column:1/-1;cursor:default}',
    '#buildsPanel .bld-lib-emb{align-self:start}#buildsPanel .bld-lib-t{color:var(--tx-1)}',
    '#buildsPanel .bld-lib-main{display:grid;gap:4px;min-width:0}#buildsPanel .bld-lib-main p{margin:0;font-size:.78rem}',
    '#buildsPanel .bld-lib-card>.bld-acts,#buildsPanel .bld-lib-card>.bld-detail,#buildsPanel .bld-lib-card>p{grid-column:1/-1}',
    '#buildsPanel .bld-lib-card>.bld-acts{align-items:center}',
    '#buildsPanel .bld-tags{display:flex;flex-wrap:wrap;gap:4px}#buildsPanel .bld-tag.is-ok{border-color:var(--color-green,#3fb950)}#buildsPanel .bld-tag.is-old{border-color:var(--color-amber,#F2B94B)}',
    '#buildsPanel .bld-bench{grid-column:1/-1;display:grid;gap:5px;margin:0}#buildsPanel .bld-bench-t{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;margin:0;font-size:.78rem}',
    '#buildsPanel .bld-bench-t b{color:var(--tx-1);font-size:.95rem}#buildsPanel .bld-bench-t a{margin-left:auto}',
    '#buildsPanel .bld-bench-bar{display:block;height:6px;border-radius:999px;background:var(--bg-0);box-shadow:inset 0 0 0 1px var(--bd-1);overflow:hidden}',
    '#buildsPanel .bld-bench-bar>i{display:block;height:100%;border-radius:999px;background:var(--bld-prof,var(--gn-mod))}#buildsPanel .bld-bench.is-none{font-size:.75rem}',
    '#buildsPanel .bld-shv{border-left:3px solid var(--gn-mod);padding:6px 10px;background:var(--bg-1);border-radius:6px;color:var(--tx-1)}',
    '@media (max-width:560px){#buildsPanel .bld-lib{grid-template-columns:1fr}#buildsPanel .bld-pf{min-width:40px;height:40px}}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-lib-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-lib-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  // ---------------------------------------------------------------- datos y comportamiento
  function getJSON(url) {
    var f = root.fetch;
    if (typeof f !== 'function') return Promise.reject(new Error('sin red'));
    return f(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('respondió ' + r.status); return r.json(); });
  }
  // BUI-4: catálogo y vigía una sola vez (lo usan la Biblioteca y la cabecera de Builds). Si falla, se puede volver a pedir.
  function preload() {
    if (st.cat) return Promise.resolve(st);
    if (!st.pre) {
      st.pre = Promise.all([getJSON(CATALOG), getJSON(WATCH).catch(function () { return null; }), getJSON(BENCH).catch(function () { return null; })]).then(function (r) {
        st.cat = r[0]; st.watch = r[1]; st.bench = r[2]; st.bidx = benchIndex(r[2]); return st;
      }, function (e) { st.pre = null; throw e; });
    }
    return st.pre;
  }
  function load(ctx) {
    st.loading = true; st.error = ''; paint(ctx);
    return preload().then(function () {
      st.loading = false;
      var latest = latestPatch(st.cat, st.watch), old = st.cat.builds.filter(function (b) { return stateOf(b, latest) === 'revisar'; }).length;
      if (ctx.setSub) ctx.setSub(st.cat.builds.length + ' builds curadas · último parche de balance ' + fmtDate(latest) + (old ? ' · ' + old + ' para revisar' : ''));
      paint(ctx);
    }, function (e) { st.loading = false; st.error = 'No pude cargar la biblioteca (' + (e && e.message || '') + ').'; paint(ctx); });
  }
  // Los íconos llegan aparte: si fallan, la Biblioteca sigue con los nombres.
  function loadIcons(ctx) {
    var R = root.GNBldRef;
    if (!R || typeof R.identity !== 'function' || ident()) return;
    R.identity().then(function () { paint(ctx); }, function () {});
  }
  function focusKey(a) {
    if (!a || !a.getAttribute) return '';
    var ks = ['data-lib-prof', 'data-lib-elite'];
    for (var i = 0; i < ks.length; i++) if (a.getAttribute(ks[i]) != null) return '[' + ks[i] + '="' + a.getAttribute(ks[i]) + '"]';
    if (a.getAttribute('data-lib-p')) return '[data-lib-p="' + a.getAttribute('data-lib-p') + '"][data-v="' + a.getAttribute('data-v') + '"]';
    var card = a.closest && a.closest('[data-id]');
    if (card && a.getAttribute('data-lib') === 'toggle') return '[data-id="' + card.getAttribute('data-id') + '"] [data-lib="toggle"]';
    return '';
  }
  function paint(ctx, focus) {
    if (!ctx.host) return;
    var a = root.document && root.document.activeElement;
    var inside = a && ctx.host.contains && ctx.host.contains(a);
    var keep = focus || (inside ? (a.id ? '#' + a.id : focusKey(a)) : '');
    ctx.host.innerHTML = viewHTML();
    if (keep) { var el = ctx.host.querySelector(keep); if (el && el.focus) el.focus(); }
  }
  function byId(id) { return (st.cat && st.cat.builds.filter(function (b) { return b.id === id; })[0]) || null; }
  function openView(ctx, b) {
    var r = C().parse(b.code);
    if (!r.ok) { st.viewErr[b.id] = r.error; return; }
    ctx.ref.load(r.build.profession).then(function (ref) {
      st.views[b.id] = ctx.ref.resolve(r.build, ref); st.checks[b.id] = ctx.ref.check(r.build, ref);
      if (st.open === b.id) paint(ctx);
    }, function (e) { st.viewErr[b.id] = 'No pude traer los nombres del juego (' + (e && e.message || '') + ').'; if (st.open === b.id) paint(ctx); });
  }
  function toggle(ctx, b) {
    st.open = st.open === b.id ? '' : b.id;
    if (st.open && !st.views[b.id]) { delete st.viewErr[b.id]; openView(ctx, b); }
    paint(ctx);
  }
  function clearFilters() { st.f = { prof: 0, elite: 0, mode: '', role: '', weapon: '', damage: '', state: '', q: '', sort: st.f.sort || '' }; st.more = false; }

  // Un clic: devuelve qué hizo (para los tests). La tarjeta se abre tocándola, salvo en botones, enlaces y el menú.
  function onClick(ctx, e) {
    var t = e.target, near = function (sel) { return t && t.closest ? t.closest(sel) : null; };
    var x = near('[data-lib-prof]');
    if (x) { st.f.prof = Number(x.getAttribute('data-lib-prof')) || 0; st.f.elite = 0; paint(ctx); return 'prof'; }
    x = near('[data-lib-elite]');
    if (x) { st.f.elite = Number(x.getAttribute('data-lib-elite')) || 0; paint(ctx); return 'elite'; }
    x = near('[data-lib-p]');
    if (x) { st.f[x.getAttribute('data-lib-p')] = x.getAttribute('data-v'); paint(ctx); return 'chip'; }
    x = near('[data-lib]');
    if (x) {
      var k = x.getAttribute('data-lib');
      if (k === 'retry') { load(ctx); return 'retry'; }
      if (k === 'clear') { clearFilters(); paint(ctx); return 'clear'; }
      var row = x.closest('[data-id]'), b = row && byId(row.getAttribute('data-id'));
      if (b) { toggle(ctx, b); return 'toggle'; }
      return '';
    }
    if (near('button,a,summary,details,input,select,label,.bld-detail')) return '';
    var card = near('.bld-lib-card');
    if (card && !card.classList.contains('is-open')) { var c = byId(card.getAttribute('data-id')); if (c) { toggle(ctx, c); return 'card'; } }
    return '';
  }

  function render(host, ctx) {
    if (root.GNBldShow) root.GNBldShow.ensureCss();
    if (root.GNBldBench) root.GNBldBench.ensureCss();
    ensureCss();
    ctx.host = host;
    st.ctx = ctx;
    // Si la pestaña se vuelve a dibujar sobre el mismo contenedor, no sumo otra vez los oyentes.
    if (!host.__bldLib) {
      host.__bldLib = true;
      host.addEventListener('change', function (e) {
        var k = e.target && e.target.getAttribute && e.target.getAttribute('data-lib-f');
        if (!k || k === 'q') return;
        st.f[k] = e.target.value;
        paint(st.ctx);
      });
      host.addEventListener('input', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-lib-f') === 'q') {
          st.f.q = e.target.value; clearTimeout(st.qT);
          st.qT = setTimeout(function () { paint(st.ctx, '#bldLibQ'); var i = st.ctx.host.querySelector('#bldLibQ'); if (i && i.setSelectionRange) i.setSelectionRange(i.value.length, i.value.length); }, 200);
        }
      });
      host.addEventListener('toggle', function (e) {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-lib-more')) st.more = !!e.target.open;
      }, true);
      host.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var m = e.target && e.target.closest ? e.target.closest('.bld-menu[open]') : null;
        if (m) { m.open = false; var s = m.querySelector('summary'); if (s && s.focus) s.focus(); }
      });
      host.addEventListener('click', function (e) { onClick(st.ctx, e); });
      if (root.GNBldShow) root.GNBldShow.wire(host, function (btn) {
        var row = btn.closest('[data-id]'), b = row && byId(row.getAttribute('data-id'));
        var m = btn.closest('.bld-menu'); if (m) m.open = false;
        return b ? { code: b.code, title: b.name, source: b.source } : null;
      }, ctx);
    }
    loadIcons(ctx);
    if (!st.cat) return load(ctx);
    paint(ctx);
  }

  var api = { version: VERSION, render: render, preload: preload, _pure: { filter: filter, stateOf: stateOf, latestPatch: latestPatch, coverage: coverage, issueUrl: issueUrl, cardHTML: cardHTML, viewHTML: viewHTML,
    filtersHTML: filtersHTML, moreCount: moreCount, onClick: onClick, MODES: MODES, ROLES: ROLES, CSS: CSS,
    benchKey: benchKey, benchIndex: benchIndex, benchOf: benchOf, benchHTML: benchHTML, sortBuilds: sortBuilds, fmtN: fmtN }, _state: st };
  root.GNBldLib = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('lib', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
