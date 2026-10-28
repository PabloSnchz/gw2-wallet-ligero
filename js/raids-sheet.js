/**
 * raids-sheet.js — Ficha de cada encuentro de Raids a pantalla completa (BL-070 RAI-3).
 * Versión: 1.4.0 (2026-10-28) — BL-078 UNI-7b: íconos del juego en las pestañas del celular, desde GNKit · antes 1.3.0 (2026-10-27) — BL-076 SHV-5a: mi línea dice «Lo sé por» y usa los tipos de DEC-024 · antes 1.2.0 (2026-10-25) — RAI-6: enlaces AA en los 19 themes y pestañas con teclado · antes 1.1.0 (2026-10-24) — RAI-4: «Cómo se pelea» (fases, mecánicas, modo desafío y fuentes)
 *
 * Como la ficha de la legendaria: reemplaza la lista dentro del módulo, con
 * «← Volver a Raids» y Escape, y vuelve al mismo lugar y a la misma fila.
 * Muestra lo que te llevás esa semana (conocimiento legendario, fragmentos o
 * cristales y el cofre del encuentro con lo garantizado), lo que te puede tocar
 * del cofre por rareza y lo que suma el modo desafío.
 *
 * Datos: assets/data/raids/catalog.json (RAI-1, vía RaidsView) y
 * assets/data/raids/rewards.json (cofres verificados en la wiki oficial; se pide
 * solo al abrir la primera ficha). El nombre en español y el ícono oficial de cada
 * cofre los trae /v2/items con GW2Api.getItemsMany (con su caché). Lo que no está
 * verificado no se muestra. Fases y mecánicas: assets/data/raids/mechanics/<expansión>.json,
 * por tandas (RAI-4), listadas en mechanics/index.json; se piden al abrir una ficha de esa
 * expansión. En el celular, dos pestañas: Recompensas y Cómo se pelea.
 *
 * Se carga por js/modules.json después de raids-view.js (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.4.0';
  var LOG = '[RaidsSheet]';
  var DATA = 'assets/data/raids/rewards.json';
  var MECH_DIR = 'assets/data/raids/mechanics/';
  var PANEL = 'raidTrackerPanel';
  var ROUTE = '#/account/raids';
  var ICON = 'assets/icons/raids/raid-icon.png';
  var WIKI_SEARCH = 'https://wiki.guildwars2.com/index.php?search=';
  var RARITY = { common: 'Común', uncommon: 'Poco común', rare: 'Raro', superrare: 'Muy raro' };
  var STATE = { done: '✓ Hecho esta semana', hand: '✓ Marcado por vos', todo: 'Pendiente esta semana',
    na: 'La API no lo informa', unknown: 'Sin datos de esta semana', nokey: '' };
  var TYPE = { boss: 'Jefe', event: 'Evento', encounter: 'Encuentro' };
  var CUR = { magnetite: 'Fragmentos de magnetita', gaeting: 'Cristales de Gaets' };

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function amount(v) { return String(v).replace('-', '–'); }

  // Ítem de una tabla: texto, o familia de armas o armaduras con su cantidad.
  function itemText(x) {
    if (x && typeof x === 'object') return x.n + ' (' + x.count + ' ' + (x.kind || 'armas') + ')';
    return String(x == null ? '' : x);
  }

  // Id de /v2/items que se muestra: el último es la variante posterior a la unificación.
  function shownId(c) { return c && Array.isArray(c.ids) && c.ids.length ? c.ids[c.ids.length - 1] : null; }

  // Todo lo que muestra la ficha, sin tocar el DOM.
  function sheetModel(cat, rw, id, data, stateOf) {
    if (!cat || !Array.isArray(cat.encounters)) return null;
    var e = cat.encounters.filter(function (x) { return x.id === id; })[0];
    if (!e) return null;
    var g = (cat.groups || []).filter(function (x) { return x.id === e.group; })[0] || { id: e.group, name: '' };
    var sib = cat.encounters.filter(function (x) { return x.group === e.group; });
    var i = sib.indexOf(e);
    var r = (rw && rw.encounters && rw.encounters[id]) || {};
    var cof = r.coffer && rw.coffers ? rw.coffers[r.coffer] || null : null;
    var mag = r.cm && rw.magnificent ? rw.magnificent[r.cm] || null : null;
    var rules = cat.rules || {};
    var s = typeof stateOf === 'function' ? stateOf(e, data) : 'nokey';
    var cur = e.currency === 'gaeting' ? 'gaeting' : 'magnetite';
    return {
      e: e, g: g, idx: i + 1, n: sib.length, prev: i > 0 ? sib[i - 1] : null, next: i < sib.length - 1 ? sib[i + 1] : null,
      state: s, cof: cof, mag: mag, extra: r.extra || null, note: r.note || '',
      wiki: r.wiki || WIKI_SEARCH + encodeURIComponent(e.nameEn || e.name), wikiDirect: !!r.wiki,
      cur: cur, cap: cur === 'gaeting' ? rules.gaetingCap : rules.magnetiteCap, cmBonus: rules.cmBonus || 10,
      exp: (cat.expansions || {})[g.expansion] || '', hpNoMag: !!(rw && rw.hpNoMag) && (g.expansion === 'hot' || g.expansion === 'pof'),
      currencies: cat.currencies || {}, verified: (rw && rw.verified) || '', rarity: (rw && rw.rarity) || RARITY
    };
  }

  // Voz de Shiruvana: solo hechos del catálogo y del estado de tu semana.
  function voiceOf(m) {
    if (!m) return null;
    var e = m.e;
    if (m.state === 'done' || m.state === 'hand') return { kind: 'saluda', basis: m.state === 'hand' ? 'lo que marcaste esta semana' : 'tus raids de esta semana (API oficial)', text: 'Ya lo cobraste esta semana. Vuelve a dar recompensas con el reset del lunes a las 07:30 UTC.' };
    if (m.state !== 'todo' && m.state !== 'na') return null;
    var parts = [];
    if (e.li) parts.push(e.li + ' de conocimiento legendario');
    if (e.amount != null) parts.push(amount(e.amount) + (m.cur === 'gaeting' ? ' cristales de Gaets' : ' fragmentos de magnetita'));
    if (!parts.length) return null;
    return { kind: 'explica', basis: 'tu semana de raids (API oficial) y las recompensas de la wiki', text: 'Esta semana todavía te esperan ' + parts.join(' y ') + (e.cm ? ', y ' + m.cmBonus + ' más si lo hacés en modo desafío.' : '.') };
  }

  function dots(n) {
    if (!n) return '';
    var h = '<span class="rs-dots" role="img" aria-label="Dificultad ' + n + ' de 5">';
    for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return h + '</span>';
  }

  function img(src, size, cls) {
    return '<img class="' + (cls || '') + '" src="' + esc(src || ICON) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" referrerpolicy="no-referrer">';
  }

  function rowHTML(icon, label, note, qty) {
    return '<li class="rs-row">' + (icon ? img(icon, 32, 'rs-ri') : '<span class="rs-ri rs-ri--g" aria-hidden="true">◈</span>') +
      '<span class="rs-rl">' + esc(label) + (note ? '<small>' + esc(note) + '</small>' : '') + '</span>' +
      (qty != null && qty !== '' ? '<b class="rs-q">' + esc(qty) + '</b>' : '') + '</li>';
  }

  function cofferName(c, items) { var it = items && items[shownId(c)]; return (it && it.name) || c.name; }
  function cofferIcon(c, items) { var it = items && items[shownId(c)]; return (it && it.icon) || ''; }

  // Lo garantizado del cofre (sin el conocimiento legendario, que va arriba con su ícono).
  function guaranteedHTML(c) {
    var h = '';
    (c.guaranteed || []).forEach(function (x) {
      if (x.cur === 'li') return;
      h += rowHTML('', x.n, x.es ? 'garantizada' : 'garantizado', x.q || '');
    });
    return h;
  }

  function tiersHTML(c, rarity, title) {
    if (!c.tiers || !c.tiers.length) return '';
    var h = '<h4 class="rs-h4">' + esc(title) + (c.pick ? ' <small>· ' + esc(c.pick) + '</small>' : '') + '</h4><ul class="rs-drops">';
    c.tiers.forEach(function (t) {
      (t.items || []).forEach(function (x) {
        h += '<li class="rs-r-' + esc(t.r) + '"><span aria-hidden="true">◇</span> ' + esc(itemText(x)) + ' <em>' + esc(rarity[t.r] || t.r) + '</em></li>';
      });
    });
    h += '</ul>';
    if (c.note) h += '<p class="rs-note">' + esc(c.note) + '</p>';
    return h;
  }

  function srcHTML(c, verified) {
    return '<p class="rs-src">Fuente: wiki oficial, <a href="' + esc(c.page) + '" target="_blank" rel="noopener noreferrer">«' + esc(c.name) + '» ↗</a>' +
      (verified ? ', consultada el ' + esc(verified) : '') + '.' + (c.src ? ' ' + esc(c.src) : '') + '</p>';
  }

  function link(s) {
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + ' ↗</a>';
  }

  // «Cómo se pelea». M = { e: entrada del encuentro, roles, sources, verified } o null si su tanda no llegó.
  function fightHTML(m, M) {
    var h = '<section id="rsPaneFight" class="rs-card rs-fight" data-rs-pane="fight" aria-labelledby="rsFight"><h3 id="rsFight">Cómo se pelea</h3>';
    if (!M || !M.e) {
      return h + '<p class="rs-note">Las fases y mecánicas de este encuentro llegan en una próxima tanda, verificadas. Mientras tanto: ' +
        '<a href="' + esc(m.wiki) + '" target="_blank" rel="noopener noreferrer">wiki oficial ↗</a></p></section>';
    }
    var E = M.e, R = M.roles || {}, S = M.sources || {};
    if (E.summary) h += '<p class="rs-sum">' + esc(E.summary) + '</p>';
    if (E.pre) h += '<p class="rs-pre"><b>Antes del jefe: ' + esc(E.pre.name) + '.</b> ' + esc(E.pre.text) + '</p>';
    if (E.tip) h += '<p class="rs-tip"><b>Shiruvana recomienda</b> ' + esc(E.tip.text) + '</p>';
    h += '<div class="rs-fgrid">';
    if (E.phases && E.phases.length) {
      h += '<div><h4 class="rs-h4">Fases <small>· ' + E.phases.length + '</small></h4><ol class="rs-phases">';
      E.phases.forEach(function (p) {
        h += '<li><b>' + esc(p.at) + '</b> <span>' + esc(p.label) + '</span><p>' + esc(p.text) + '</p></li>';
      });
      h += '</ol></div>';
    }
    h += '<div><h4 class="rs-h4">Mecánicas que importan</h4><ul class="rs-mechs">';
    (E.mechanics || []).forEach(function (x) {
      h += '<li><div class="rs-mh"><b>' + esc(x.name) + '</b>' + (x.en ? ' <small lang="en">' + esc(x.en) + '</small>' : '');
      (x.roles || []).forEach(function (r) { h += '<span class="rs-role">' + esc(R[r] || r) + '</span>'; });
      h += '</div><p>' + esc(x.text) + '</p></li>';
    });
    h += '</ul></div></div>';
    if (E.cm && E.cm.length && m.e.cm) {
      h += '<h4 class="rs-h4">En modo desafío cambia</h4><ul class="rs-cmlist">';
      E.cm.forEach(function (t) { h += '<li>' + esc(t) + '</li>'; });
      h += '</ul>';
    }
    var used = (E.links || []).filter(function (k) { return S[k]; });
    if (used.length) {
      h += '<h4 class="rs-h4">Para aprender más</h4><p class="rs-links">' + used.map(function (k) { return link(S[k]); }).join(' · ') + '</p>';
      h += '<p class="rs-src">Fuentes: ' + used.map(function (k) { return esc(S[k].name); }).join(' y ') + (M.verified ? ', consultadas el ' + esc(M.verified) : '') + '. Sin videos inventados: solo enlaces verificados.</p>';
    }
    return h + '</section>';
  }

  function tabsHTML(pane) {
    var h = '<div class="rs-tabs" role="tablist" aria-label="Secciones de la ficha">';
    [['rew', 'Recompensas'], ['fight', 'Cómo se pelea']].forEach(function (t) {
      var on = pane === t[0];
      h += '<button type="button" role="tab" id="rsTab-' + t[0] + '" data-rs-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="' +
        (t[0] === 'fight' ? 'rsPaneFight' : 'rsPaneRew') + '" tabindex="' + (on ? '0' : '-1') + '">' +
        (root.GNKit ? root.GNKit.icon(t[0] === 'fight' ? 'tab.rs.pelea' : 'tab.rs.recompensas') : '') + t[1] + '</button>';
    });
    return h + '</div>';
  }

  function sheetHTML(m, items, M, pane) {
    var e = m.e, g = m.g, h = [], ic = e.icon || {};
    var where = g.kind === 'wing' ? 'Ala ' + g.wing + ' · ' + g.name : g.name;
    var liIcon = m.currencies.li && m.currencies.li.icon, curIcon = m.currencies[m.cur] && m.currencies[m.cur].icon;
    h.push('<nav class="rs-bar" aria-label="Ficha del encuentro"><button type="button" class="rs-btn" data-rs="back">← Volver a Raids</button>' +
      '<span>' + esc(where) + ' · ' + (e.type === 'event' ? 'paso ' : 'encuentro ') + m.idx + ' de ' + m.n + '</span></nav>');
    h.push('<header class="rs-head"><span class="rs-mini' + (ic.kind === 'next-boss' ? ' rs-mini--ev' : '') + '">' + img(ic.src, 96) + '</span>');
    h.push('<div class="rs-t"><h2 id="rsTitle" tabindex="-1">' + esc(e.name) + '</h2>' + (e.nameEn && e.nameEn !== e.name ? '<p lang="en">' + esc(e.nameEn) + '</p>' : ''));
    h.push('<div class="rs-tags">' + (m.exp ? '<span class="rs-tag">' + esc(m.exp) + '</span>' : '') + '<span class="rs-tag">' + esc(TYPE[e.type] || '') + '</span>');
    if (e.difficulty) h.push('<span class="rs-tag">Dificultad ' + dots(e.difficulty) + '</span>');
    if (e.cm) h.push('<span class="rs-tag rs-tag--cm">Modo desafío</span>');
    if (STATE[m.state]) h.push('<span class="rs-tag rs-st-' + esc(m.state) + '">' + esc(STATE[m.state]) + '</span>');
    h.push('</div><div class="rs-acts"><a class="rs-btn" href="' + esc(m.wiki) + '" target="_blank" rel="noopener noreferrer">' + (m.wikiDirect ? 'Abrir en la wiki ↗' : 'Buscar en la wiki ↗') + '</a>');
    if (m.prev) h.push('<button type="button" class="rs-btn" data-rs-go="' + esc(m.prev.id) + '">‹ ' + esc(m.prev.name) + '</button>');
    if (m.next) h.push('<button type="button" class="rs-btn" data-rs-go="' + esc(m.next.id) + '">Siguiente: ' + esc(m.next.name) + ' ›</button>');
    h.push('</div></div></header><div id="rsVoice" class="rs-voice" aria-live="polite"></div>' + tabsHTML(pane === 'fight' ? 'fight' : 'rew'));

    h.push('<div class="rs-grid"><section id="rsPaneRew" class="rs-card" data-rs-pane="rew" aria-labelledby="rsWeek"><h3 id="rsWeek">Lo que te llevás <small>1 vez por semana</small></h3><ul class="rs-rows">');
    if (e.li) h.push(rowHTML(liIcon, 'Conocimiento legendario', m.cof ? 'dentro del cofre, garantizado' : 'al completarlo', String(e.li)));
    if (e.amount != null) h.push(rowHTML(curIcon, CUR[m.cur], m.cap ? 'tope semanal de ' + m.cap + ' para todas las raids' : '', amount(e.amount)));
    if (m.cof) {
      h.push(rowHTML(cofferIcon(m.cof, items), cofferName(m.cof, items), 'cofre del encuentro', '1'));
      h.push(guaranteedHTML(m.cof));
    }
    h.push('</ul>');
    if (!m.cof && m.note) h.push('<p class="rs-note">' + esc(m.note) + '</p>');
    if (m.cof) h.push(tiersHTML(m.cof, m.rarity, 'Lo que te puede tocar del cofre'));
    if (m.extra) {
      h.push('<h4 class="rs-h4">' + esc(m.extra.title) + '</h4><ul class="rs-rows">');
      (m.extra.guaranteed || []).forEach(function (x) { h.push(rowHTML('', x.n, 'garantizado', x.q || '')); });
      h.push('</ul>' + tiersHTML(m.extra, m.rarity, 'Además'));
    }
    if (m.cof) h.push(srcHTML(m.cof, m.verified));
    else if (m.extra) h.push(srcHTML({ name: 'Mount Balrior', page: m.extra.page }, m.verified));
    h.push('</section>');

    if (e.cm) {
      h.push('<section class="rs-card rs-card--cm" data-rs-pane="rew" aria-labelledby="rsCm"><h3 id="rsCm">Modo desafío <small>extra, 1 vez por semana</small></h3><ul class="rs-rows">');
      if (e.amount != null) h.push(rowHTML(curIcon, CUR[m.cur], 'además de lo normal', '+' + m.cmBonus));
      if (m.mag) h.push(rowHTML(cofferIcon(m.mag, items), cofferName(m.mag, items), 'desde la unificación ya no da conocimiento legendario', '1'));
      if (m.mag && !m.mag.unverified) h.push(guaranteedHTML(m.mag));
      h.push('</ul>');
      if (m.mag && m.mag.unverified) h.push('<p class="rs-note">Todavía no pude verificar qué trae este cofre. <a href="' + esc(m.mag.page) + '" target="_blank" rel="noopener noreferrer">Miralo en la wiki ↗</a></p>');
      else if (m.mag) h.push(tiersHTML(m.mag, m.rarity, 'Lo que te puede tocar') + srcHTML(m.mag, m.verified));
      else if (m.hpNoMag) h.push('<p class="rs-note">Heart of Thorns y Path of Fire no dan cofre magnífico: el modo desafío suma los fragmentos.</p>');
      h.push('</section>');
    }
    h.push(fightHTML(m, M) + '</div>');
    return h.join('');
  }

  var CSS = [
    '#rsRoot{--rs-mod:var(--gn-mod,#F47C7C)}#rsRoot[hidden]{display:none!important}',
    '.rs-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;color:var(--tx-2);font-size:.84rem;margin-bottom:12px}',
    '.rs-btn{font:inherit;font-size:.82rem;border:1px solid var(--bd-2);border-radius:999px;padding:6px 14px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:36px;text-decoration:none;display:inline-flex;align-items:center}',
    '.rs-btn:hover{border-color:var(--acc-1)}',
    '.rs-head{display:flex;gap:18px;align-items:flex-start;border:1px solid var(--bd-1);border-radius:16px;padding:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--rs-mod) 12%,transparent),var(--bg-1) 75%)}',
    '.rs-mini{position:relative;flex-shrink:0;width:96px;height:96px;border-radius:16px;background:radial-gradient(circle at 50% 40%,var(--bg-2),var(--bg-1));box-shadow:0 0 0 2px color-mix(in srgb,var(--rs-mod) 70%,transparent)}',
    '.rs-mini img{width:96px;height:96px;border-radius:16px;object-fit:contain;display:block}',
    '.rs-mini--ev img{opacity:.55;filter:grayscale(.4)}.rs-mini--ev::after{content:"Evento";position:absolute;left:0;right:0;bottom:0;font-size:.7rem;text-align:center;color:var(--tx-1);background:var(--bg-0);border-radius:0 0 16px 16px}',
    '.rs-t{flex:1;min-width:0}.rs-t h2{margin:0;font-size:1.45rem;color:var(--tx-1)}.rs-t h2:focus{outline:none}.rs-t>p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.rs-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}',
    '.rs-tag{display:inline-flex;gap:6px;align-items:center;font-size:.76rem;border:1px solid var(--bd-1);border-radius:999px;padding:3px 10px;color:var(--tx-2);background:var(--bg-0)}',
    '.rs-tag--cm{color:var(--color-amber,#F2B94B);border-color:color-mix(in srgb,var(--color-amber,#F2B94B) 60%,transparent)}',
    '.rs-st-done,.rs-st-hand{color:var(--color-green,#3CC48A);border-color:color-mix(in srgb,var(--color-green,#3CC48A) 60%,transparent);font-weight:700}',
    '.rs-dots{display:inline-flex;gap:2px}.rs-dots i{width:6px;height:6px;border-radius:50%;background:var(--bd-2)}.rs-dots i.on{background:var(--rs-mod)}',
    '.rs-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.rs-voice{margin-top:12px}.rs-voice:empty{display:none}.rs-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.rs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:12px;align-items:start}',
    '.rs-card{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:14px 16px;min-width:0}',
    '.rs-card--cm{border-color:color-mix(in srgb,var(--color-amber,#F2B94B) 45%,var(--bd-1))}',
    '.rs-card h3{margin:0 0 10px;font-size:1rem;color:var(--tx-1)}.rs-card h3 small,.rs-h4 small{font-weight:500;color:var(--tx-2);font-size:.78rem}',
    '.rs-rows{list-style:none;margin:0;padding:0}',
    '.rs-row{display:grid;grid-template-columns:32px 1fr auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--bd-1)}.rs-row:first-child{border-top:0}',
    '.rs-ri{width:32px;height:32px;border-radius:6px;object-fit:contain}.rs-ri--g{display:flex;align-items:center;justify-content:center;background:var(--bg-2);color:var(--tx-2)}',
    '.rs-rl{min-width:0;color:var(--tx-1);font-size:.88rem}.rs-rl small{display:block;color:var(--tx-2);font-size:.74rem}',
    '.rs-q{font-size:1rem;color:var(--tx-1)}',
    '.rs-h4{margin:14px 0 6px;font-size:.88rem;color:var(--tx-1)}',
    '.rs-drops{list-style:none;margin:0;padding:0;display:grid;gap:4px}.rs-drops li{font-size:.84rem;color:var(--tx-1)}',
    '.rs-drops em{font-style:normal;font-size:.72rem;color:var(--tx-2);margin-left:4px}',
    '.rs-r-uncommon span{color:var(--color-green,#3CC48A)}.rs-r-rare span{color:var(--gn-link,var(--acc-1))}.rs-r-superrare span{color:var(--color-amber,#F2B94B)}',
    '.rs-note,.rs-src{margin:10px 0 0;color:var(--tx-2);font-size:.8rem}.rs-src{font-size:.72rem}.rs-src a,.rs-note a{color:var(--gn-link,var(--acc-1))}',
    '.rs-fight{grid-column:1/-1}.rs-sum{margin:0 0 10px;color:var(--tx-1);font-size:.9rem}',
    '.rs-pre,.rs-tip{margin:0 0 10px;padding:8px 12px;border-radius:10px;background:var(--bg-0);border:1px solid var(--bd-1);font-size:.84rem;color:var(--tx-1)}',
    '.rs-tip{border-color:color-mix(in srgb,var(--rs-mod) 55%,var(--bd-1))}.rs-tip b{color:var(--tx-1);margin-right:4px}',
    '.rs-fgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px}',
    '.rs-phases{list-style:none;margin:0;padding:0;border-left:2px solid var(--bd-2)}',
    '.rs-phases li{position:relative;padding:0 0 10px 14px}.rs-phases li::before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--rs-mod)}',
    '.rs-phases b{font-size:.8rem;color:var(--tx-2)}.rs-phases span{font-weight:700;color:var(--tx-1);font-size:.88rem}.rs-phases p{margin:2px 0 0;font-size:.82rem;color:var(--tx-1)}',
    '.rs-mechs{list-style:none;margin:0;padding:0;display:grid;gap:8px}.rs-mechs li{border:1px solid var(--bd-1);border-radius:10px;padding:8px 10px;background:var(--bg-0)}',
    '.rs-mh{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}.rs-mh b{color:var(--tx-1);font-size:.88rem}.rs-mh small{color:var(--tx-2);font-size:.74rem}',
    '.rs-role{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--bd-2);border-radius:999px;padding:0 7px;color:var(--tx-2)}',
    '.rs-mechs p{margin:4px 0 0;font-size:.82rem;color:var(--tx-1)}.rs-cmlist{margin:0;padding-left:18px;font-size:.84rem;color:var(--tx-1)}',
    '.rs-links{margin:0;font-size:.84rem}.rs-links a{color:var(--gn-link,var(--acc-1))}',
    '.rs-tabs{display:none;gap:4px;margin-top:12px;border-bottom:1px solid var(--bd-1)}',
    '.rs-tabs [role=tab]{font:inherit;font-size:.9rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);cursor:pointer;min-height:44px;flex:1}',
    '.rs-tabs [role=tab][aria-selected=true]{color:var(--tx-1);font-weight:700;border-bottom-color:var(--rs-mod)}',
    '#rsRoot button:focus-visible,#rsRoot a:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){#rsRoot *{transition:none!important;animation:none!important}}',
    '@media (max-width:720px){.rs-head{padding:12px;gap:12px}.rs-mini,.rs-mini img{width:64px;height:64px}.rs-t h2{font-size:1.15rem}',
    '.rs-grid{grid-template-columns:1fr}.rs-btn{min-height:44px}.rs-card{padding:12px}.rs-fgrid{grid-template-columns:1fr}.rs-tabs{display:flex}',
    '#rsRoot[data-pane=rew] [data-rs-pane=fight],#rsRoot[data-pane=fight] [data-rs-pane=rew]{display:none}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { rw: null, rwP: null, open: null, scroll: 0, items: {}, seq: 0, voiceKey: null, pane: 'rew', idx: null, idxP: null, mech: {} };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function hash() { return String((root.location && root.location.hash) || ''); }
  function view() { return root.RaidsView || null; }

  function loadRewards() {
    if (st.rw) return Promise.resolve(st.rw);
    if (st.rwP) return st.rwP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.rwP = root.fetch(DATA, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('recompensas ' + r.status); return r.json(); })
      .then(function (d) { st.rw = d; return d; })
      .catch(function (e) { st.rwP = null; if (root.console) root.console.warn(LOG, 'recompensas', e); return null; });
    return st.rwP;
  }

  function getJSON(url) {
    return root.fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }

  // Mecánicas de una expansión: solo si su tanda figura en mechanics/index.json. Sin tanda, null.
  function loadMech(exp) {
    if (!exp || typeof root.fetch !== 'function') return Promise.resolve(null);
    if (exp in st.mech) return Promise.resolve(st.mech[exp]);
    if (!st.idxP) {
      st.idxP = getJSON(MECH_DIR + 'index.json').then(function (d) { st.idx = (d && d.files) || {}; return st.idx; },
        function (e) { st.idxP = null; if (root.console) root.console.warn(LOG, 'mecánicas', e); return {}; });
    }
    return st.idxP.then(function (idx) {
      var f = idx[exp];
      if (!f || !/^[\w-]+\.json$/.test(f)) return null;
      return getJSON(MECH_DIR + f).then(function (d) { st.mech[exp] = d; return d; },
        function (e) { if (root.console) root.console.warn(LOG, 'mecánicas ' + exp, e); return null; });
    });
  }

  function mechFor(cat, id) {
    var e = cat && cat.encounters ? cat.encounters.filter(function (x) { return x.id === id; })[0] : null;
    var g = e && cat.groups ? cat.groups.filter(function (x) { return x.id === e.group; })[0] : null;
    var d = g ? st.mech[g.expansion] : null;
    if (!d || !d.encounters || !d.encounters[id]) return null;
    return { e: d.encounters[id], roles: d.roles, sources: d.sources, verified: d.verified };
  }

  function expOf(cat, id) {
    var e = cat && cat.encounters ? cat.encounters.filter(function (x) { return x.id === id; })[0] : null;
    var g = e && cat.groups ? cat.groups.filter(function (x) { return x.id === e.group; })[0] : null;
    return g ? g.expansion : null;
  }

  function ensureHost() {
    var panel = byId(PANEL);
    if (!panel) return null;
    if (!byId('raids-sheet-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'raids-sheet-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var host = byId('rsRoot');
    if (!host) {
      host = doc.createElement('section');
      host.id = 'rsRoot';
      host.setAttribute('aria-labelledby', 'rsTitle');
      host.setAttribute('hidden', '');
      var rv = byId('rvRoot');
      if (rv && rv.nextSibling) panel.insertBefore(host, rv.nextSibling); else panel.appendChild(host);
      wire(host);
    }
    return host;
  }

  function snapshot() {
    var V = view();
    return V && typeof V.getSnapshot === 'function' ? V.getSnapshot() : { cat: null, data: null };
  }

  function stateFn() {
    var V = view();
    return V && V._pure && typeof V._pure.stateOf === 'function' ? V._pure.stateOf : null;
  }

  function renderVoice(m) {
    var box = byId('rsVoice');
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    var msg = voiceOf(m);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text, basis: msg.basis + ' · en este navegador' }));
  }

  function draw(focus) {
    var host = byId('rsRoot'), snap = snapshot();
    if (!host || !st.open) return null;
    var m = sheetModel(snap.cat, st.rw, st.open, snap.data, stateFn());
    if (!m) return null;
    host.setAttribute('data-pane', st.pane);
    host.innerHTML = sheetHTML(m, st.items, mechFor(snap.cat, st.open), st.pane);
    renderVoice(m);
    if (focus) { var t = byId('rsTitle'); if (t && t.focus) t.focus(); }
    return m;
  }

  // Nombre en español e ícono oficial de los cofres, con la caché de GW2Api.
  function loadItems(m) {
    var A = root.GW2Api, ids = [];
    if (!m || !A || typeof A.getItemsMany !== 'function') return;
    [m.cof, m.mag].forEach(function (c) { var i = shownId(c); if (i && !st.items[i]) ids.push(i); });
    if (!ids.length) return;
    var seq = st.seq, id = st.open;
    Promise.resolve().then(function () { return A.getItemsMany(ids); }).then(function (list) {
      (list || []).forEach(function (it) { if (it && it.id) st.items[it.id] = { name: it.name, icon: it.icon }; });
      if (st.open === id && seq === st.seq) draw(false);
    }, function (e) { if (root.console) root.console.warn(LOG, 'ítems', e); });
  }

  function open(id) {
    var host = ensureHost(), rv = byId('rvRoot');
    if (!host) return Promise.resolve(null);
    if (!st.open) { st.scroll = root.scrollY || root.pageYOffset || 0; st.pane = 'rew'; }
    st.open = id;
    st.seq++;
    var seq = st.seq;
    return Promise.all([loadRewards(), loadMech(expOf(snapshot().cat, id))]).then(function () {
      if (seq !== st.seq) return null;
      if (rv) rv.setAttribute('hidden', '');
      host.removeAttribute('hidden');
      var m = draw(true);
      if (host.scrollIntoView) { try { host.scrollIntoView({ block: 'start' }); } catch (e) { host.scrollIntoView(); } }
      loadItems(m);
      return m;
    });
  }

  function close(quiet) {
    var host = byId('rsRoot'), rv = byId('rvRoot'), id = st.open;
    if (!id) return;
    st.open = null;
    st.seq++;
    if (host) { host.setAttribute('hidden', ''); host.innerHTML = ''; }
    if (rv) rv.removeAttribute('hidden');
    if (quiet) return;
    if (typeof root.scrollTo === 'function') root.scrollTo(0, st.scroll);
    var row = rv && rv.querySelector ? rv.querySelector('[data-rv-open="' + id + '"]') : null;
    if (row && row.focus) row.focus();
  }

  // Pestañas del celular: cambia la sección y deja el foco en la pestaña elegida.
  function setPane(host, tab) {
    st.pane = tab === 'fight' ? 'fight' : 'rew';
    draw(false);
    var b = host.querySelector ? host.querySelector('[data-rs-tab="' + st.pane + '"]') : null;
    if (b && b.focus) b.focus();
  }

  function wire(host) {
    // Flechas, Inicio y Fin entre las dos pestañas (patrón tablist), como en la lista.
    host.addEventListener('keydown', function (e) {
      var t = e && e.target && e.target.getAttribute ? e.target.getAttribute('data-rs-tab') : null;
      if (!t) return;
      var to = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? (t === 'fight' ? 'rew' : 'fight') : e.key === 'Home' ? 'rew' : e.key === 'End' ? 'fight' : null;
      if (!to) return;
      if (e.preventDefault) e.preventDefault();
      setPane(host, to);
    });
    host.addEventListener('click', function (e) {
      for (var n = e.target, i = 0; n && n !== host && i < 6; n = n.parentNode, i++) {
        if (!n.getAttribute) continue;
        if (n.getAttribute('data-rs') === 'back') { close(false); return; }
        var tab = n.getAttribute('data-rs-tab');
        if (tab) { setPane(host, tab); return; }
        var go = n.getAttribute('data-rs-go');
        if (go) { open(go); return; }
      }
    });
  }

  function init() {
    if (!byId(PANEL) || !doc.addEventListener) return;
    doc.addEventListener('keydown', function (e) {
      if (st.open && e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); close(false); }
    });
    if (root.addEventListener) root.addEventListener('hashchange', function () { if (st.open && hash() !== ROUTE) close(true); });
    doc.addEventListener('gn:tokenchange', function () { if (st.open) close(true); });
  }

  root.RaidsSheet = {
    version: VERSION, open: open, close: function () { close(false); },
    isOpen: function () { return !!st.open; },
    _pure: { esc: esc, amount: amount, itemText: itemText, shownId: shownId, sheetModel: sheetModel, sheetHTML: sheetHTML, fightHTML: fightHTML,
      voiceOf: voiceOf, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
