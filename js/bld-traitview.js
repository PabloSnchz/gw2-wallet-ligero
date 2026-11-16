/*!
 * js/bld-traitview.js — Builds: rasgos y habilidades de la ficha, como en el juego (BL-084 EQ-5)
 * Versión: 1.0.1 (2026-11-15) · EQ-10: el tinte de la profesión detrás de la barra baja de 26% a 14% (con 26% el texto no
 *          llegaba a 4.5:1 en catppuccin, everforest y one-dark; RUN-284/286) · antes 1.0.0 (2026-10-30)
 *
 * html(m) arma la sección «Rasgos y habilidades» de la ficha con los datos oficiales que trae js/bld-ref.js 1.3.0:
 *   1. La barra: armas 1–5 de cada juego (del equipo de la build o, si no lo hay, de las armas del código), curación,
 *      3 utilidades y élite, y la mecánica de la profesión (F1–F5) cuando el juego deja una sola opción por tecla.
 *   2. Las 3 líneas con su fondo oficial: emblema, los 3 rasgos menores y las 3 columnas de mayores; el elegido se ve
 *      encendido y los otros apagados (el lector los nombra como «otras opciones»).
 *   3. La guía de teclas (las teclas por defecto del juego) en un desplegable.
 *   4. Mascotas o leyendas, la validación contra la API, el código y las acciones de siempre (data-bld-act).
 * Cada habilidad y cada rasgo elegido se alcanza con Tab y muestra su descripción oficial al pasar el cursor, tocarlo o
 * enfocarlo (role=tooltip + aria-describedby); Escape la cierra. Textos del juego (DEC-046). Sin red, sin estado guardado.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.1';
  var TIER = ['Adepto', 'Maestro', 'Gran maestro'];
  var KEYS = { heal: '6', util: ['7', '8', '9'], elite: '0' };
  var OFFICIAL = 'Descripción oficial · API de Guild Wars 2 en castellano';
  var RG = /^https:\/\/render\.guildwars2\.com\//;

  function S() { return root.GNBldShow; }
  function esc(s) {
    return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plain(s) { return S() ? S().plain(s) : String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function img(src, size, cls) { return S() ? S().img(src, '', size, cls || 'bld-ic') : ''; }

  // ---------------------------------------------------------------- armas (puro)
  // Nombre del tipo de arma de un objeto (/v2/items) → clave de /v2/professions (Longbow, Shortbow, Spear…).
  function weaponKey(ref, sub) {
    var s = String(sub || '').toLowerCase();
    if (s === 'harpoon') s = 'spear';
    var ks = Object.keys((ref && ref.weapons) || {});
    for (var i = 0; i < ks.length; i++) if (ks[i].toLowerCase() === s) return ks[i];
    return '';
  }
  function hasFlag(ref, k, f) { var w = ref.weapons[k]; return !!(w && (w.flags || []).indexOf(f) >= 0); }
  // Juegos de armas: [{ label, main, off }] desde el equipo (GNBldItems.sheet) o, si no hay, desde las armas del código.
  function weaponSets(ref, gear, build) {
    var out = [];
    if (gear && gear.sets && gear.sets.length) {
      gear.sets.forEach(function (s) {
        var m = '', o = '';
        s.hands.forEach(function (h) { var k = weaponKey(ref, h.item && h.item.sub); if (!k) return; if (h.hand === 'o') o = k; else m = k; });
        if (m || o) out.push({ label: s.label, main: m, off: o, from: 'gear' });
      });
      if (out.length) return out;
    }
    var C = root.GNBldCode, pend = '';
    ((build && build.weapons) || []).forEach(function (id) {
      var k = C && C.WEAPONS[id];
      if (!k || !ref.weapons[k]) return;
      if (hasFlag(ref, k, 'TwoHand')) { out.push({ main: k, off: '' }); return; }
      if (!pend && hasFlag(ref, k, 'Mainhand')) { pend = k; return; }
      if (pend && hasFlag(ref, k, 'Offhand')) { out.push({ main: pend, off: k }); pend = ''; return; }
      out.push(hasFlag(ref, k, 'Mainhand') ? { main: k, off: '' } : { main: '', off: k });
    });
    if (pend) out.push({ main: pend, off: '' });
    out.forEach(function (s, i) { s.label = 'Juego de armas ' + (i + 1); s.from = 'code'; });
    return out;
  }
  // Las 5 habilidades de un juego. Elementalista: las de Fuego. Ladrón: la 3 según la mano secundaria.
  function setSkills(ref, set) {
    var W = ref.weapons || {}, m = W[set.main], o = W[set.off], two = set.main && hasFlag(ref, set.main, 'TwoHand');
    var pick = function (w, n) {
      var c = ((w && w.skills) || []).filter(function (x) { return x[1] === 'Weapon_' + n; });
      if (!c.length) return 0;
      if (n === 3 && c.some(function (x) { return x[2]; })) {
        var want = set.off || 'Nothing';
        var hit = c.filter(function (x) { return x[2] === want; })[0] || c.filter(function (x) { return !x[2]; })[0];
        if (hit) return hit[0];
      }
      var x = c.filter(function (y) { return !y[3] || y[3] === 'Fire'; })[0] || c[0];
      return x[0];
    };
    var ids = [1, 2, 3, 4, 5].map(function (n) { return n <= 3 || two ? pick(m, n) : pick(o, n); });
    var att = [m, o].some(function (w) { return ((w && w.skills) || []).some(function (x) { return x[3]; }); });
    return { ids: ids, attunement: att ? 'Fire' : '' };
  }
  // Mecánica de profesión: por tecla, la de la élite elegida si existe; si no, la base. Solo si queda una opción.
  function profSkills(ref, eliteId) {
    var out = [];
    for (var n = 1; n <= 5; n++) {
      var c = (ref.prof || []).filter(function (x) { return x[1] === 'Profession_' + n && ref.skills[x[0]]; });
      var el = c.filter(function (x) { return eliteId && ref.skills[x[0]].spec === eliteId; });
      var base = c.filter(function (x) { return !ref.skills[x[0]].spec; });
      var pickL = el.length ? el : base;
      var uniq = pickL.map(function (x) { return x[0]; }).filter(function (id, i, a) { return a.indexOf(id) === i; });
      if (uniq.length === 1) out.push({ key: 'F' + n, id: uniq[0] });
    }
    return out;
  }

  // ---------------------------------------------------------------- modelo (puro)
  // m = { build, ref, view, gear } → { bars: [{ label, note, slots: [{ key, skill, kind }] }], prof, lines, keys }
  function model(m) {
    var ref = m.ref, b = m.build, R = root.GNBldRef;
    var specById = function (id) { return R ? R.specById(ref, id) : (ref.specs || []).filter(function (s) { return s.id === id; })[0] || null; };
    var lines = (b.specs || []).map(function (s) {
      var sp = specById(s.id);
      if (!sp) return { id: s.id, empty: true };
      var minor = (sp.minor || []).map(function (id) { return ref.traits[id]; }).filter(Boolean)
        .sort(function (a, c) { return (a.tier || 0) - (c.tier || 0); });
      return { id: sp.id, name: sp.name, icon: sp.icon, background: sp.background, elite: !!sp.elite,
        tiers: [0, 1, 2].map(function (t) {
          var ids = sp.major[t] || [], pickId = s.traits[t] >= 1 ? ids[s.traits[t] - 1] : 0;
          return { minor: minor[t] || null, majors: ids.map(function (id) { return ref.traits[id]; }).filter(Boolean), chosen: pickId || 0 };
        }) };
    });
    var eliteLine = lines[2] && lines[2].elite ? lines[2].id : 0;
    var land = (m.view && m.view.land) || [];
    var util = [];
    land.forEach(function (sk, i) {
      if (i === 0) util.push({ key: KEYS.heal, skill: sk, kind: 'Curación' });
      else if (i === 4) util.push({ key: KEYS.elite, skill: sk, kind: 'Élite' });
      else util.push({ key: KEYS.util[i - 1], skill: sk, kind: 'Utilidad' });
    });
    var sets = weaponSets(ref, m.gear, b).map(function (s) {
      var r = setSkills(ref, s);
      var name = function (k) { var C = root.GNBldCode; return k ? ((C && C.WEAPONS_ES[k]) || k) : ''; };
      return { label: s.label, from: s.from, weapons: [name(s.main), name(s.off)].filter(Boolean).join(' + '), note: r.attunement ? 'en Fuego' : '',
        slots: r.ids.map(function (id, i) { return { key: String(i + 1), skill: id ? ref.skills[id] || { id: id, name: '#' + id } : null, kind: 'Arma' }; }) };
    });
    var prof = profSkills(ref, eliteLine).map(function (x) { return { key: x.key, skill: ref.skills[x.id], kind: 'Profesión' }; });
    return { sets: sets, util: util, prof: prof, lines: lines };
  }

  // ---------------------------------------------------------------- vista (pura)
  function tip(id, name, desc, extra) {
    return '<span class="bld-tvtip" role="tooltip" id="' + id + '"><b>' + esc(name) + '</b>' + (extra ? '<i>' + esc(extra) + '</i>' : '') +
      (desc ? '<span>' + esc(desc) + '</span>' : '') + '<em>' + OFFICIAL + '</em></span>';
  }
  function slotHTML(s, n) {
    if (!s.skill) return '<li class="bld-tvs is-empty" aria-label="' + esc(s.key) + ': vacío"><span class="bld-tvi">' + img('', 44) + '</span><kbd aria-hidden="true">' + esc(s.key) + '</kbd></li>';
    var id = 'bldTv-' + n;
    return '<li class="bld-tvs bld-tvt" tabindex="0" aria-describedby="' + id + '" aria-label="' + esc(s.key + ': ' + s.skill.name) + '">' +
      '<span class="bld-tvi">' + img(s.skill.icon, 44) + '</span><kbd aria-hidden="true">' + esc(s.key) + '</kbd>' +
      tip(id, s.skill.name, plain(s.skill.description), s.kind + ' · tecla ' + s.key) + '</li>';
  }
  function barsHTML(md, ctr) {
    var h = '';
    var sets = md.sets.length ? md.sets : [{ label: '', slots: [], none: true }];
    sets.forEach(function (s, i) {
      h += '<div class="bld-tvrow">' +
        '<div class="bld-tvgrp"><small>' + esc(s.none ? 'Armas' : (s.label || 'Armas') + (s.weapons ? ' · ' + s.weapons : '') + (s.note ? ' (' + s.note + ')' : '')) + '</small>' +
        (s.none ? '<p class="bld-muted">Las habilidades de arma salen del equipo de la build o de las armas del código: esta no trae ninguno.</p>'
          : '<ol class="bld-tvbar" aria-label="' + esc('Habilidades de arma: ' + (s.weapons || s.label)) + '">' + s.slots.map(function (x) { return slotHTML(x, ctr.n++); }).join('') + '</ol>') + '</div>' +
        (i === 0 ? '<div class="bld-tvgrp"><small>Curación, utilidades y élite</small><ol class="bld-tvbar" aria-label="Curación, utilidades y élite">' +
          md.util.map(function (x) { return slotHTML(x, ctr.n++); }).join('') + '</ol></div>' : '') +
        '</div>';
    });
    if (md.prof.length) {
      h += '<div class="bld-tvrow"><div class="bld-tvgrp"><small>Mecánica de la profesión</small><ol class="bld-tvbar is-prof" aria-label="Mecánica de la profesión">' +
        md.prof.map(function (x) { return slotHTML(x, ctr.n++); }).join('') + '</ol></div></div>';
    }
    return '<div class="bld-tvband">' + h + '</div>';
  }
  function traitHTML(t, on, label, n) {
    var id = 'bldTv-' + n;
    return '<span class="bld-tvtr bld-tvt' + (on ? ' is-on' : '') + '" tabindex="0" aria-describedby="' + id + '" aria-label="' + esc(label + ': ' + t.name) + '">' +
      img(t.icon, on === null ? 30 : 34, 'bld-tvti') + tip(id, t.name, plain(t.description), label) + '</span>';
  }
  function lineHTML(l, i, ctr) {
    if (l.empty) return '<section class="bld-tvl is-empty"><p class="bld-muted">Línea ' + (i + 1) + ' vacía.</p></section>';
    var bg = l.background && RG.test(l.background) ? ' style="--tv-bg:url(&quot;' + esc(l.background) + '&quot;)"' : '';
    var cols = l.tiers.map(function (t, k) {
      var others = t.majors.filter(function (x) { return x.id !== t.chosen; }).map(function (x) { return x.name; });
      var chosen = t.majors.filter(function (x) { return x.id === t.chosen; })[0];
      return (t.minor ? '<span class="bld-tvmin">' + traitHTML(t.minor, null, 'Rasgo menor ' + TIER[k].toLowerCase(), ctr.n++) + '</span>' : '') +
        '<span class="bld-tvcol" role="group" aria-label="' + esc(TIER[k]) + '">' + t.majors.map(function (x) {
          return x.id === t.chosen ? traitHTML(x, true, TIER[k] + ' · elegido', ctr.n++)
            : '<span class="bld-tvtr is-off" aria-hidden="true" title="' + esc(x.name) + '">' + img(x.icon, 34, 'bld-tvti') + '</span>';
        }).join('') + (chosen ? '' : '<span class="bld-tvnone">sin elegir</span>') +
        (others.length ? '<span class="bld-sr">Otras opciones: ' + esc(others.join(', ')) + '.</span>' : '') + '</span>';
    }).join('');
    return '<section class="bld-tvl' + (l.elite ? ' is-elite' : '') + '"' + bg + ' aria-label="' + esc('Línea ' + (i + 1) + ': ' + l.name) + '">' +
      '<header class="bld-tvlh"><span class="bld-tvhex">' + img(l.icon, 40, 'bld-tvhi') + '</span><b>' + esc(l.name) + '</b>' + (l.elite ? '<span class="bld-tag">élite</span>' : '') + '</header>' +
      '<div class="bld-tvgrid">' + cols + '</div></section>';
  }
  function keysHTML(md) {
    var rows = [];
    md.sets.slice(0, 1).forEach(function (s) { s.slots.forEach(function (x) { if (x.skill) rows.push(x); }); });
    md.util.concat(md.prof).forEach(function (x) { if (x.skill) rows.push(x); });
    if (!rows.length) return '';
    return '<details class="bld-tvk"><summary>Guía de teclas <small>(las del juego por defecto)</small></summary><table><thead><tr><th scope="col">Tecla</th><th scope="col">Habilidad</th><th scope="col">Tipo</th></tr></thead><tbody>' +
      rows.map(function (x) { return '<tr><td><kbd>' + esc(x.key) + '</kbd></td><td>' + img(x.skill.icon, 20) + ' ' + esc(x.skill.name) + '</td><td>' + esc(x.kind) + '</td></tr>'; }).join('') +
      '</tbody></table></details>';
  }
  function extrasHTML(v) {
    if (!v) return '';
    var nm = function (x) { return x ? img(x.icon, 22) + esc(x.name) : '<span class="bld-muted">—</span>'; };
    var h = '';
    if (v.pets) h += '<p><span class="bld-cap">Mascotas</span> ' + nm(v.pets.land[0]) + ' · ' + nm(v.pets.land[1]) + '</p>';
    if (v.legends) h += '<p><span class="bld-cap">Leyendas</span> ' + nm(v.legends.land[0]) + ' · ' + nm(v.legends.land[1]) + '</p>';
    return h;
  }
  // m = { build, ref, view, checks, code, gear, title, actions }
  function html(m) {
    var md = model(m), ctr = { n: 0 }, sh = S(), P = sh && sh._pure;
    var acts = m.actions || ['share', 'gw2skills', 'edit'];
    var label = { share: 'Copiar enlace para compartir', gw2skills: 'Abrir en gw2skills ↗', save: 'Guardar en Mis builds', edit: 'Editar' };
    return '<div class="bld-tv">' + barsHTML(md, ctr) +
      '<div class="bld-tvlines">' + md.lines.map(function (l, i) { return lineHTML(l, i, ctr); }).join('') + '</div>' +
      keysHTML(md) + extrasHTML(m.view) + (P && P.checksHTML ? P.checksHTML(m.checks) : '') +
      (m.code ? '<div class="bld-code"><span class="bld-cap">Código del juego</span><code>' + esc(m.code) + '</code></div>' : '') +
      '<div class="bld-acts">' + acts.map(function (a) { return label[a] ? '<button type="button" class="bld-btn" data-bld-act="' + a + '">' + label[a] + '</button>' : ''; }).join(' ') + '</div>' +
      '<p class="bld-muted bld-ghint"><small>Pasá el cursor, tocá o llegá con Tab a una habilidad o a un rasgo para ver su descripción oficial; Escape la cierra.</small></p></div>';
  }

  // ---------------------------------------------------------------- CSS (tokens de los 19 temas)
  var P_ = '#buildsPanel ';
  var CSS = [
    P_ + '.bld-tv{display:grid;gap:12px}',
    P_ + '.bld-tvband{display:grid;gap:10px;padding:12px;border:1px solid var(--bd-1);border-radius:12px;background:linear-gradient(90deg,color-mix(in srgb,var(--bld-prof,var(--gn-mod)) 14%,var(--bg-0)),var(--bg-1) 70%)}',
    P_ + '.bld-tvrow{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:flex-end}',
    P_ + '.bld-tvgrp{display:grid;gap:4px}' + P_ + '.bld-tvgrp>small{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-2)}' + P_ + '.bld-tvgrp>p{margin:0;font-size:.85rem}',
    P_ + '.bld-tvbar{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}',
    P_ + '.bld-tvs{position:relative;display:grid;justify-items:center;gap:2px}',
    P_ + '.bld-tvi{display:grid;place-items:center;width:48px;height:48px;border-radius:8px;background:var(--bg-0);box-shadow:inset 0 0 0 1px var(--bd-1)}',
    P_ + '.bld-tvi img,' + P_ + '.bld-tvi .bld-ph{border-radius:6px;display:block}',
    P_ + '.bld-tvs kbd,' + P_ + '.bld-tvk kbd{font:600 .72rem/1.2 inherit;color:var(--tx-1);background:var(--bg-0);border:1px solid var(--bd-1);border-radius:4px;padding:0 5px}',
    P_ + '.bld-tvbar.is-prof .bld-tvi{box-shadow:inset 0 0 0 2px var(--gn-mod)}',
    P_ + '.bld-tvlines{display:grid;gap:8px}',
    P_ + '.bld-tvl{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--bd-1);border-radius:12px;' +
      'background:linear-gradient(90deg,color-mix(in srgb,var(--bg-0) 55%,transparent),color-mix(in srgb,var(--bg-0) 85%,transparent)),var(--tv-bg,none) left center/cover no-repeat,var(--bg-1)}',
    P_ + '.bld-tvl.is-elite{border-color:var(--gn-mod)}' + P_ + '.bld-tvl.is-empty{display:block}',
    P_ + '.bld-tvlh{display:grid;justify-items:center;gap:4px;text-align:center;color:var(--tx-1);font-size:.85rem}' + P_ + '.bld-tvlh b{background:color-mix(in srgb,var(--bg-0) 75%,transparent);border-radius:6px;padding:0 6px}',
    P_ + '.bld-tvhex{display:grid;place-items:center;width:56px;height:56px;clip-path:polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0 50%);background:color-mix(in srgb,var(--bg-0) 70%,transparent)}',
    P_ + '.bld-tvgrid{display:grid;grid-template-columns:repeat(3,auto auto);justify-content:space-around;align-items:center;gap:6px}',
    P_ + '.bld-tvcol{display:grid;gap:4px;justify-items:center}' + P_ + '.bld-tvmin{display:grid;place-items:center}',
    P_ + '.bld-tvtr{position:relative;display:grid;place-items:center;border-radius:6px}',
    P_ + '.bld-tvtr.is-on{box-shadow:0 0 0 2px var(--gn-mod)}' + P_ + '.bld-tvtr.is-off{opacity:.38;filter:grayscale(1)}',
    P_ + '.bld-tvmin .bld-tvti,' + P_ + '.bld-tvmin .bld-ph{border-radius:50%}',
    P_ + '.bld-tvnone{font-size:.7rem;color:var(--tx-2)}',
    P_ + '.bld-tvt[tabindex]{cursor:help}' + P_ + '.bld-tvt:focus-visible{outline:2px solid var(--gn-mod);outline-offset:2px}',
    P_ + '.bld-tvtip{display:none;position:absolute;left:0;top:calc(100% + 4px);z-index:7;width:min(320px,calc(100vw - 48px));padding:10px 12px;border-radius:10px;text-align:left;' +
      'background:var(--bg-0);border:1px solid var(--gn-mod);box-shadow:0 10px 30px color-mix(in srgb,var(--bg-0) 70%,transparent);font-size:.8rem;color:var(--tx-2)}',
    P_ + '.bld-tvtip b{display:block;color:var(--tx-1)}' + P_ + '.bld-tvtip i{display:block;font-style:normal;font-size:.72rem;margin-bottom:4px}' + P_ + '.bld-tvtip span{display:block}',
    P_ + '.bld-tvtip em{display:block;margin-top:6px;font-style:normal;font-size:.7rem}',
    P_ + '.bld-tvt:hover>.bld-tvtip,' + P_ + '.bld-tvt:focus>.bld-tvtip{display:block}' + P_ + '.bld-tvt.is-tipoff>.bld-tvtip{display:none}',
    P_ + '.bld-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    P_ + '.bld-tvk{border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0)}' + P_ + '.bld-tvk>summary{cursor:pointer;padding:8px 12px;color:var(--tx-1)}',
    P_ + '.bld-tvk table{width:100%;border-collapse:collapse;font-size:.85rem}' + P_ + '.bld-tvk th,' + P_ + '.bld-tvk td{padding:4px 12px;border-top:1px solid var(--bd-1);text-align:left;color:var(--tx-1)}',
    P_ + '.bld-tvk th{font-size:.7rem;text-transform:uppercase;color:var(--tx-2)}' + P_ + '.bld-tvk td img,' + P_ + '.bld-tvk td .bld-ph{vertical-align:middle}',
    '@media (max-width:720px){' + P_ + '.bld-tvl{grid-template-columns:1fr}' + P_ + '.bld-tvlh{grid-auto-flow:column;justify-content:start}' + P_ + '.bld-tvtip{left:-8px}}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-traitview-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-traitview-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  // ---------------------------------------------------------------- Escape cierra la descripción abierta
  function onKey(e) {
    if (!e || (e.key !== 'Escape' && e.key !== 'Esc')) return false;
    var r = e.target && e.target.closest ? e.target.closest('.bld-tvt') : null;
    if (!r || !r.classList || r.classList.contains('is-tipoff')) return false;
    r.classList.add('is-tipoff');
    if (e.stopPropagation) e.stopPropagation();
    return true;
  }
  function onLeave(e) {
    var r = e && e.target && e.target.closest ? e.target.closest('.bld-tvt') : null;
    if (!r || !r.classList) return false;
    var to = e.relatedTarget;
    if (to && r.contains && r.contains(to)) return false;
    r.classList.remove('is-tipoff');
    return true;
  }
  function wire(host) {
    if (!host || host.__bldTv || typeof host.addEventListener !== 'function') return false;
    host.__bldTv = true;
    host.addEventListener('keydown', onKey);
    host.addEventListener('focusout', onLeave);
    host.addEventListener('mouseout', onLeave);
    return true;
  }
  // ¿Alcanza el ref para dibujar? (lo guardado con bld-ref < 1.3.0 no trae armas ni mecánica)
  function ready(ref) { return !!(ref && Array.isArray(ref.specs) && ref.traits && ref.skills && ref.weapons && Array.isArray(ref.prof)); }

  var api = { version: VERSION, html: html, ensureCss: ensureCss, wire: wire, ready: ready,
    _pure: { model: model, weaponKey: weaponKey, weaponSets: weaponSets, setSkills: setSkills, profSkills: profSkills,
      slotHTML: slotHTML, lineHTML: lineHTML, keysHTML: keysHTML, onKey: onKey, onLeave: onLeave, CSS: CSS } };
  root.GNBldTraitView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
