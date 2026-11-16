/*!
 * js/bld-gearview.js — Builds: el equipo de la ficha, como Snow Crows y con el estilo de la Bóveda (BL-084 EQ-4)
 * Versión: 1.0.0 (2026-10-30)
 *
 * Recibe lo que arma GNBldItems.sheet() (js/bld-items.js, en castellano desde la API oficial) y lo pinta en 3 tarjetas:
 *   1. Armadura (6 piezas): estadística, pieza y runa de cada una (en PvP, solo la runa).
 *   2. Abalorios y reliquia (o, en PvP, amuleto y reliquia).
 *   3. Armas (por juego, con mano y sigilos) y «Otros»: infusiones, comida, mejora, núcleo de jade, enriquecimiento.
 * Cada objeto lleva su ícono oficial con el borde de su rareza. Al pasar el cursor, al tocarlo o al llegar con Tab se
 * abre su descripción oficial (role=tooltip, unida con aria-describedby: el lector la lee sin abrirla). Escape la
 * cierra sin mover el foco (WCAG 1.4.13). Arriba, el resumen: cada estadística, cuántas piezas y qué atributos da.
 * Los textos son los del juego o míos (DEC-046). Sin estado propio, sin red y sin localStorage.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var RARITY = { Junk: 'junk', Basic: 'basic', Fine: 'fine', Masterwork: 'mw', Rare: 'rare', Exotic: 'exo', Ascended: 'asc', Legendary: 'leg' };
  var RARITY_ES = { Junk: 'basura', Basic: 'básico', Fine: 'refinado', Masterwork: 'obra maestra', Rare: 'excepcional', Exotic: 'exótico',
    Ascended: 'ascendido', Legendary: 'legendario' };
  var OFFICIAL = 'Descripción oficial · API de Guild Wars 2 en castellano';

  function S() { return root.GNBldShow; }
  function I() { return root.GNBldItems; }
  function esc(s) {
    return S() ? S().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function img(src, size) { return S() ? S().img(src, '', size, 'bld-gic') : ''; }
  function attrName(k) { var x = I(); return x && typeof x.attrName === 'function' ? x.attrName(k) : k; }

  // ---------------------------------------------------------------- textos (puros)
  // ['Potencia','Precisión','Ferocidad'] → «potencia, precisión y ferocidad»
  function andList(xs) {
    xs = (xs || []).filter(Boolean);
    if (xs.length < 2) return xs.join('');
    return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  }
  function statAttrs(stat) {
    return andList(((stat && stat.attrs) || []).map(function (a) { return attrName(a).toLowerCase(); }));
  }
  // Las líneas oficiales de un objeto: bonos numerados (runas), efecto (sigilos, reliquia, comida) y descripción.
  function itemLines(x) {
    if (!x) return [];
    var out = [];
    if (x.bonuses && x.bonuses.length) x.bonuses.forEach(function (b, i) { out.push('(' + (i + 1) + ') ' + b); });
    [x.buff, x.effect, x.desc].forEach(function (t) { if (t && out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function rarityOf(x) { return (x && RARITY[x.rarity]) || ''; }

  // ---------------------------------------------------------------- filas (puras)
  // r = { icon (objeto), main, sub, ups: [objeto], tip: [{ name, lines }] }
  function rowHTML(r, n) {
    var tid = 'bldTip-' + n, it = r.icon, rar = rarityOf(it);
    var tip = (r.tip || []).filter(function (t) { return t && (t.name || (t.lines && t.lines.length)); });
    var tipH = tip.length ? '<span class="bld-gtip" role="tooltip" id="' + tid + '">' + tip.map(function (t) {
      return (t.name ? '<b>' + esc(t.name) + '</b>' : '') + (t.lines || []).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
    }).join('') + '<em>' + OFFICIAL + '</em></span>' : '';
    var ups = (r.ups || []).filter(Boolean).map(function (u) {
      return '<span class="bld-gup">' + img(u.icon, 18) + esc(u.name) + (u.missing ? ' <small>(sin datos en la API)</small>' : '') + '</span>';
    }).join('');
    return '<li class="bld-gr"' + (tipH ? ' tabindex="0" aria-describedby="' + tid + '"' : '') + '>' +
      '<span class="bld-gico' + (rar ? ' is-' + rar : '') + '"' + (it && RARITY_ES[it.rarity] ? ' title="' + RARITY_ES[it.rarity] + '"' : '') + '>' + img(it && it.icon, 40) + '</span>' +
      '<span class="bld-git"><b>' + esc(r.main) + '</b>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + ups + '</span>' + tipH + '</li>';
  }
  function statTip(stat) { return stat && !stat.missing && stat.attrs && stat.attrs.length ? { name: stat.name, lines: ['Da ' + statAttrs(stat) + '.'] } : null; }
  function itemTip(x) { return x && !x.missing ? { name: x.name, lines: itemLines(x) } : null; }
  function mainOf(stat, item) { return stat ? stat.name : (item && item.name) || '—'; }

  // De la vista de GNBldItems.sheet() a las tarjetas: [{ key, title, count, note, groups: [{ label, rows }] }]
  function cards(v) {
    var out = [];
    if (!v) return out;
    if (v.armor.length) {
      out.push({ key: 'armor', title: 'Armadura', count: v.armor.length, note: v.runeMixed ? 'runas distintas por pieza' : '', groups: [{ label: '', rows: v.armor.map(function (a) {
        var rune = a.rune || v.rune;
        return { icon: a.item, main: mainOf(a.stat, a.item), sub: a.slot, ups: [rune], tip: [itemTip(a.item), statTip(a.stat), itemTip(rune)] };
      }) }] });
    } else if (v.rune) {
      out.push({ key: 'armor', title: 'Runa', count: 0, groups: [{ label: '', rows: [{ icon: v.rune, main: v.rune.name, sub: 'Runa de la armadura', ups: [], tip: [itemTip(v.rune)] }] }] });
    }
    var tr = v.trinkets.map(function (t) {
      return { icon: t.item, main: mainOf(t.stat, t.item), sub: t.slot, ups: [], tip: [itemTip(t.item), statTip(t.stat)] };
    });
    if (v.amulet) {
      var at = (v.amulet.attrs || []).map(function (a) { return attrName(a[0]) + ' ' + a[1]; });
      tr.push({ icon: v.amulet, main: v.amulet.name, sub: 'Amuleto' + (at.length ? ' · ' + at.join(', ') : ''), ups: [], tip: [{ name: v.amulet.name, lines: at }] });
    }
    if (v.relic) tr.push({ icon: v.relic, main: v.relic.name, sub: 'Reliquia', ups: [], tip: [itemTip(v.relic)] });
    if (tr.length) out.push({ key: 'trinkets', title: v.amulet ? 'Amuleto y reliquia' : 'Abalorios y reliquia', count: v.amulet ? 0 : tr.length, groups: [{ label: '', rows: tr }] });
    var groups = v.sets.map(function (s) {
      return { label: v.sets.length > 1 ? s.label : '', rows: s.hands.map(function (h) {
        return { icon: h.item, main: mainOf(h.stat, h.item), sub: [h.type, h.handLabel].filter(Boolean).join(' · '),
          ups: h.sigils, tip: [itemTip(h.item), statTip(h.stat)].concat(h.sigils.map(itemTip)) };
      }) };
    });
    var ex = v.extras.map(function (x) {
      return { icon: x.item, main: (x.item && x.item.name) || x.label, sub: x.label + (x.count > 1 ? ' ×' + x.count : ''), ups: [], tip: [itemTip(x.item)] };
    });
    if (groups.length) {
      if (ex.length) groups.push({ label: 'Otros', rows: ex });
      out.push({ key: 'weapons', title: 'Armas', count: 0, groups: groups });
    } else if (ex.length) {
      out.push({ key: 'weapons', title: 'Otros', count: 0, groups: [{ label: '', rows: ex }] });
    }
    return out;
  }

  // ---------------------------------------------------------------- vista (pura)
  function summaryHTML(v) {
    var chips = (v.stats || []).map(function (s) {
      var a = statAttrs(s.stat);
      return '<li class="bld-gchip"><b>' + esc(s.stat.name) + '</b> ×' + s.pieces + (a ? ' = ' + esc(a) : '') + '</li>';
    });
    if (!chips.length) return '';
    return '<ul class="bld-gstats" aria-label="Resumen de estadísticas">' + chips.join('') + '</ul>';
  }
  // html(v, b) → el equipo completo. v = GNBldItems.sheet(); b = la build (si es tuya y se basa en una de la Biblioteca, lo dice).
  function html(v, b) {
    if (!v) return '';
    var n = 0;
    var cs = cards(v).map(function (c) {
      return '<section class="bld-gcard" aria-labelledby="bldG-' + c.key + '"><h5 id="bldG-' + c.key + '">' + esc(c.title) +
        (c.count ? ' <span>' + c.count + (c.count === 1 ? ' pieza' : ' piezas') + '</span>' : '') + (c.note ? ' <span>' + esc(c.note) + '</span>' : '') + '</h5>' +
        c.groups.map(function (g) {
          return (g.label ? '<h6>' + esc(g.label) + '</h6>' : '') + '<ul class="bld-grows">' + g.rows.map(function (r) { return rowHTML(r, n++); }).join('') + '</ul>';
        }).join('') + '</section>';
    }).join('');
    var base = b && b.mine && b.base ? '<p class="bld-muted bld-gsum">Equipo de la build en que se basa: <b>' + esc(b.base.name) + '</b>. Si cambiaste rasgos o armas, revisalo en el Editor.</p>' : '';
    return base + summaryHTML(v) + '<div class="bld-gear">' + cs + '</div>' +
      '<p class="bld-muted bld-ghint"><small>Pasá el cursor, tocá o llegá con Tab a un objeto para ver su descripción oficial; Escape la cierra.</small></p>';
  }

  // ---------------------------------------------------------------- CSS (tokens de los 19 temas; la rareza solo tiñe el borde del ícono)
  var P_ = '#buildsPanel ';
  var CSS = [
    P_ + '.bld-gear{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}',
    P_ + '.bld-gcard{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0)}',
    P_ + '.bld-gcard h5{margin:0;padding:8px 12px;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-1);border-bottom:1px solid var(--bd-1);display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}',
    P_ + '.bld-gcard h5 span{font-weight:400;text-transform:none;letter-spacing:0;color:var(--tx-2)}',
    P_ + '.bld-gcard h6{margin:0;padding:8px 12px 2px;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-2);border-top:1px solid var(--bd-1)}',
    P_ + '.bld-gcard h5+h6{border-top:0}',
    P_ + '.bld-grows{list-style:none;margin:0;padding:0}',
    P_ + '.bld-gr{position:relative;display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;padding:7px 12px;border-top:1px solid var(--bd-1)}',
    P_ + '.bld-gr:first-child{border-top:0}',
    P_ + '.bld-gr[tabindex]{cursor:help}' + P_ + '.bld-gr:focus-visible{outline:2px solid var(--gn-mod);outline-offset:-2px;border-radius:8px}',
    P_ + '.bld-gico{display:grid;place-items:center;width:44px;height:44px;border-radius:8px;background:var(--bg-1);box-shadow:inset 0 0 0 2px var(--bld-rar,var(--bd-1))}',
    P_ + '.bld-gico img,' + P_ + '.bld-gico .bld-ph{border-radius:6px;display:block}',
    P_ + '.bld-gico.is-fine{--bld-rar:var(--gn-rar-fine,#62a4da)}' + P_ + '.bld-gico.is-mw{--bld-rar:var(--gn-rar-mw,#1a9306)}' + P_ + '.bld-gico.is-rare{--bld-rar:var(--gn-rar-rare,#fcd00b)}',
    P_ + '.bld-gico.is-exo{--bld-rar:var(--gn-rar-exo,#ffa405)}' + P_ + '.bld-gico.is-asc{--bld-rar:var(--gn-rar-asc,#fb3e8d)}' + P_ + '.bld-gico.is-leg{--bld-rar:var(--gn-rar-leg,#9a4cff)}',
    P_ + '.bld-git{display:grid;gap:1px;min-width:0;font-size:.88rem;color:var(--tx-1)}' + P_ + '.bld-git b{font-weight:600}',
    P_ + '.bld-git small{color:var(--tx-2);font-size:.76rem}',
    P_ + '.bld-gup{display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--tx-2)}' + P_ + '.bld-gup .bld-gic{border-radius:4px;flex:none}',
    P_ + '.bld-gtip{display:none;position:absolute;left:56px;top:calc(100% - 4px);z-index:6;width:min(320px,calc(100vw - 48px));padding:10px 12px;border-radius:10px;' +
      'background:var(--bg-0);border:1px solid var(--gn-mod);box-shadow:0 10px 30px color-mix(in srgb,var(--bg-0) 70%,transparent);font-size:.8rem;color:var(--tx-2)}',
    P_ + '.bld-gtip b{display:block;color:var(--tx-1);margin:6px 0 2px}' + P_ + '.bld-gtip b:first-child{margin-top:0}' + P_ + '.bld-gtip span{display:block}',
    P_ + '.bld-gtip em{display:block;margin-top:6px;font-style:normal;font-size:.7rem;color:var(--tx-2)}',
    P_ + '.bld-gr:hover>.bld-gtip,' + P_ + '.bld-gr:focus>.bld-gtip{display:block}' + P_ + '.bld-gr.is-tipoff>.bld-gtip{display:none}',
    P_ + '.bld-gstats{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0}',
    P_ + '.bld-gchip{font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:2px 10px;color:var(--tx-2);background:var(--bg-0)}' + P_ + '.bld-gchip b{color:var(--tx-1)}',
    P_ + '.bld-ghint{margin:0}',
    '@media (max-width:1100px){' + P_ + '.bld-gear{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media (max-width:720px){' + P_ + '.bld-gear{grid-template-columns:1fr}' + P_ + '.bld-gtip{left:12px}}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-gearview-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-gearview-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  // ---------------------------------------------------------------- comportamiento: Escape cierra la descripción abierta
  function onKey(e) {
    if (!e || (e.key !== 'Escape' && e.key !== 'Esc')) return false;
    var r = e.target && e.target.closest ? e.target.closest('.bld-gr') : null;
    if (!r || !r.classList || r.classList.contains('is-tipoff')) return false;
    r.classList.add('is-tipoff');
    if (e.stopPropagation) e.stopPropagation();
    return true;
  }
  // Al salir de la fila (foco o mouse), la próxima vez vuelve a abrirse.
  function onLeave(e) {
    var r = e && e.target && e.target.closest ? e.target.closest('.bld-gr') : null;
    if (!r || !r.classList) return false;
    var to = e.relatedTarget;
    if (to && r.contains && r.contains(to)) return false;
    r.classList.remove('is-tipoff');
    return true;
  }
  function wire(host) {
    if (!host || host.__bldGear || typeof host.addEventListener !== 'function') return false;
    host.__bldGear = true;
    host.addEventListener('keydown', onKey);
    host.addEventListener('focusout', onLeave);
    host.addEventListener('mouseout', onLeave);
    return true;
  }

  var api = { version: VERSION, html: html, ensureCss: ensureCss, wire: wire,
    _pure: { cards: cards, rowHTML: rowHTML, summaryHTML: summaryHTML, itemLines: itemLines, andList: andList, statAttrs: statAttrs,
      rarityOf: rarityOf, onKey: onKey, onLeave: onLeave, CSS: CSS, OFFICIAL: OFFICIAL } };
  root.GNBldGearView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
