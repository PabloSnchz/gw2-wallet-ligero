/*!
 * js/bld-bench.js — Builds: referencia de daño por parecido (BL-082 BENCH-2)
 * Versión: 1.0.0 (2026-10-29) · primera versión
 *
 * Snow Crows mide el DPS de sus builds contra el golem (assets/data/builds/bench.json, BENCH-1). Una build propia o una
 * variante de la Biblioteca sin medición no tiene ese número, y no lo invento: busco la build MEDIDA más parecida
 * (misma profesión y élite; después tipo de daño, rol de bendiciones y armas) y la muestro como «Referencia», diciendo
 * en qué se parece y que no es el DPS de esa build. Para Mis builds, primero miro de qué build de la Biblioteca salió
 * (fuente o código) y, si no, cuál se le parece más por líneas y rasgos.
 * Puro salvo ensureCss(): sin red. Lo usan js/bld-lib.js y js/bld-mine.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var MIN_LIKE = 50;          // % de parecido (líneas y rasgos) para heredar daño y rol de una build de la Biblioteca
  var MODES = { pve: 'PvE', wvw: 'WvW', pvp: 'PvP' };
  var memo = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmtN(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function parse(code) {
    if (!code) return null;
    if (Object.prototype.hasOwnProperty.call(memo, code)) return memo[code];
    var C = root.GNBldCode, r = null;
    try { r = C && C.parse(code); } catch (_) { r = null; }
    memo[code] = r && r.ok ? r.build : null;
    return memo[code];
  }
  function isHeal(b) { var r = (b && b.roles) || []; return r.indexOf('heal') >= 0 || r.indexOf('support') >= 0; }

  // ---------------------------------------------------------------- modelo (puro)
  // Rol de bendiciones como lo escribe Snow Crows: '', 'quickness', 'alacrity' o 'boon'.
  function boonOf(roles) {
    roles = roles || [];
    if (roles.indexOf('quickness') >= 0) return 'quickness';
    if (roles.indexOf('alacrity') >= 0) return 'alacrity';
    if (roles.indexOf('boon') >= 0) return 'boon';
    return '';
  }
  function targetOf(b) {
    return { prof: b.prof, elite: b.elite || 0, damage: b.damage || '', boon: boonOf(b.roles), weapons: (b.weapons || []).slice() };
  }
  function tokens(path) { return String(path || '').split('/').pop().split('-'); }
  // Puntaje de una fila medida contra lo que se busca. Profesión y élite son obligatorias.
  // t.boon: '' = solo daño, un rol = ese rol, null = no se sabe (no suma ni resta).
  function score(t, r) {
    if (r.prof !== t.prof || (r.elite || 0) !== (t.elite || 0)) return null;
    var s = 0, why = ['misma élite'];
    if (t.damage && r.damage === t.damage) { s += 4; why.push('mismo tipo de daño'); }
    if (t.boon != null) {
      if (r.boon === t.boon) { s += 2; why.push(t.boon ? 'mismo rol de bendiciones' : 'mismo rol (solo daño)'); }
      else if (r.boon === 'boon' && t.boon) s += 1;
    }
    var tk = tokens(r.path), w = (t.weapons || []).filter(function (x, i, a) { return a.indexOf(x) === i && tk.indexOf(String(x).toLowerCase()) >= 0; }).length;
    if (w) { s += w; why.push(w === 1 ? '1 arma en común' : w + ' armas en común'); }
    return { s: s, why: why };
  }
  // La fila medida más parecida; a igual puntaje, la de más DPS (el techo de esa forma de jugar).
  function ref(t, idx) {
    if (!t || !idx || !idx.rows) return null;
    var best = null;
    Object.keys(idx.rows).forEach(function (k) {
      var r = idx.rows[k], x = score(t, r);
      if (!x) return;
      if (!best || x.s > best.score || (x.s === best.score && r.max > best.row.max)) best = { kind: 'ref', row: r, score: x.s, why: x.why };
    });
    return best;
  }
  // Biblioteca (sin bench exacto): solo PvE y solo si la build hace daño (curación y tanque no se comparan con un DPS).
  function forLib(b, idx) {
    if (!b || b.mode !== 'pve' || isHeal(b)) return null;
    return ref(targetOf(b), idx);
  }
  // Parecido entre dos builds leídas del código: líneas iguales y rasgos iguales (máximo 12 = 3 × (1 + 3)).
  function likeness(a, b) {
    if (!a || !b || a.profession !== b.profession) return 0;
    var pts = 0;
    (a.specs || []).forEach(function (s) {
      if (!s || !s.id) return;
      var o = (b.specs || []).filter(function (x) { return x && x.id === s.id; })[0];
      if (!o) return;
      pts += 1;
      for (var i = 0; i < 3; i++) if (s.traits[i] && s.traits[i] === o.traits[i]) pts += 1;
    });
    return Math.round(pts / 12 * 100);
  }
  // Élite de un código: la tercera línea, si es una élite conocida (por el catálogo o el bench); si no, 0 (núcleo).
  function eliteOfBuild(me, cat, idx) {
    var id = me.specs[2] && me.specs[2].id;
    if (!id) return 0;
    if (((cat && cat.builds) || []).some(function (b) { return b.elite === id; })) return id;
    if (idx && idx.rows && Object.keys(idx.rows).some(function (k) { return idx.rows[k].elite === id; })) return id;
    return 0;
  }
  // Mis builds. exact(b, idx) = el bench exacto de una build de la Biblioteca (GNBldLib._pure.benchOf).
  function forMine(item, cat, idx, exact) {
    var me = parse(item && item.code);
    if (!me || !cat || !idx || !idx.n) return null;
    var builds = cat.builds || [], url = item.source && item.source.url, elite = eliteOfBuild(me, cat, idx);
    var base = builds.filter(function (b) { return b.code === item.code; })[0] ||
      builds.filter(function (b) { return url && b.source && b.source.url === url && b.prof === me.profession; })[0] || null;
    var like = 100;
    if (!base) {
      var best = null;
      builds.forEach(function (b) {
        if (b.prof !== me.profession || (b.elite || 0) !== elite) return;
        // a igual parecido gana PvE (es donde hay golem) y después el orden de la biblioteca
        var p = likeness(me, parse(b.code)), k = p * 10 + (b.mode === 'pve' ? 1 : 0);
        if (!best || k > best.k) best = { b: b, p: p, k: k };
      });
      if (best && best.p >= MIN_LIKE) { base = best.b; like = best.p; }
    }
    var C = root.GNBldCode, ws = (me.weapons || []).map(function (w) { return C && C.WEAPONS ? C.WEAPONS[w] : ''; }).filter(Boolean);
    if (base) {
      var info = { name: base.name, mode: base.mode, pct: like, same: base.code === item.code };
      if (base.mode !== 'pve') return { kind: 'mode', like: info };
      if (isHeal(base)) return { kind: 'heal', like: info };
      var m = exact ? exact(base, idx) : null;
      if (m && like === 100) return { kind: 'base', row: m, like: info };
      var t = targetOf(base);
      if (ws.length) t.weapons = ws;
      var r = ref(t, idx);
      if (r) r.like = info;
      return r;
    }
    return ref({ prof: me.profession, elite: elite, damage: '', boon: null, weapons: ws }, idx);
  }

  // ---------------------------------------------------------------- vista
  function human(path) { var t = tokens(path).join(' '); return t.charAt(0).toUpperCase() + t.slice(1); }
  function logA(r) {
    return r.log ? '<a class="bld-muted" href="https://dps.report/' + esc(r.log) + '" target="_blank" rel="noopener">registro ↗</a>' : '';
  }
  function bar(pct) { return '<span class="bld-bench-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'; }
  function html(res, idx) {
    if (!res) return '';
    var L = res.like;
    if (res.kind === 'mode') return '<p class="bld-bench is-none bld-muted">Sin bench de daño: se parece más a «' + esc(L.name) + '» (' + esc(MODES[L.mode] || L.mode) + ') y ahí no hay golem que mida el daño.</p>';
    if (res.kind === 'heal') return '<p class="bld-bench is-none bld-muted">Sin bench de daño: se parece más a «' + esc(L.name) + '», que cura o sostiene al grupo, y eso Snow Crows no lo mide.</p>';
    var r = res.row, top = (idx && idx.top) || r.max, pct = Math.max(1, Math.min(100, Math.round(r.max / top * 100)));
    if (res.kind === 'base') {
      return '<div class="bld-bench" title="Bench de Snow Crows contra el golem: el techo ideal; en una pelea real se hace menos.">' +
        '<p class="bld-bench-t"><b>' + fmtN(r.max) + ' DPS</b><span class="bld-muted">promedio ' + fmtN(r.avg) + ' · ' + pct + ' % de la mejor · bench de «' + esc(L.name) + '», la build de la Biblioteca en que se basa' +
        (L.same ? '' : ' (la cambiaste: tu DPS puede ser otro)') + '</span>' + logA(r) + '</p>' + bar(pct) + '</div>';
    }
    var why = (res.why || []).join(', ');
    var from = L ? (L.pct === 100 ? '«' + esc(L.name) + '» no tiene medición propia' : 'se parece en un ' + L.pct + ' % a «' + esc(L.name) + '» de la Biblioteca') + '; ' : '';
    return '<div class="bld-bench is-ref" title="Referencia: DPS medido por Snow Crows en otra build parecida, no en esta.">' +
      '<p class="bld-bench-t"><span class="bld-ref-k">Referencia</span><b>' + fmtN(r.max) + ' DPS</b><span class="bld-muted">' + esc(human(r.path)) + ' · ' + pct + ' % de la mejor</span>' + logA(r) + '</p>' +
      '<p class="bld-ref-why bld-muted">No es el DPS de esta build: ' + from + 'es la medición más parecida (' + esc(why) + ').</p>' + bar(pct) + '</div>';
  }

  // Mis builds puede abrirse sin pasar por la Biblioteca: estas reglas valen solas (las de .bld-bench son las mismas que en bld-lib).
  var CSS = [
    '#buildsPanel .bld-bench{grid-column:1/-1;display:grid;gap:5px;margin:0}#buildsPanel .bld-bench-t{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;margin:0;font-size:.78rem}',
    '#buildsPanel .bld-bench-t b{color:var(--tx-1);font-size:.95rem}#buildsPanel .bld-bench-t a{margin-left:auto}',
    '#buildsPanel .bld-bench-bar{display:block;height:6px;border-radius:999px;background:var(--bg-0);box-shadow:inset 0 0 0 1px var(--bd-1);overflow:hidden}',
    '#buildsPanel .bld-bench-bar>i{display:block;height:100%;border-radius:999px;background:var(--bld-prof,var(--gn-mod))}#buildsPanel .bld-bench.is-none{font-size:.75rem}',
    '#buildsPanel .bld-bench.is-ref .bld-bench-bar>i{background:repeating-linear-gradient(135deg,var(--bld-prof,var(--gn-mod)) 0 6px,transparent 6px 9px)}',
    '#buildsPanel .bld-ref-k{font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-1);border:1px solid var(--bd-1);border-radius:999px;padding:0 7px}',
    '#buildsPanel .bld-ref-why{margin:0;font-size:.72rem}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-bench-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-bench-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  var api = { version: VERSION, forLib: forLib, forMine: forMine, html: html, ensureCss: ensureCss,
    _pure: { boonOf: boonOf, targetOf: targetOf, score: score, ref: ref, likeness: likeness, eliteOfBuild: eliteOfBuild, human: human, CSS: CSS, MIN_LIKE: MIN_LIKE } };
  root.GNBldBench = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
