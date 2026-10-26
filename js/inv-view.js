/*!
 * js/inv-view.js — Inventario y Personajes renovado: cabecera, pestañas Materiales, Banco y Armería legendaria (BL-070, INV-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.5.0 (2026-10-25) — INV-7b: sin los caminos a las pantallas viejas (se retiraron)
 *          1.4.0 (2026-10-25) — INV-6: cada ítem es un botón (data-inv-item) que abre su ficha (js/inv-sheet.js)
 *          1.3.0 (2026-10-25) — INV-5: las pestañas sumadas con order de 100 o más van después de las propias (Personajes)
 *          1.2.0 (2026-10-25) — INV-4: una pestaña sumada puede traer su propio campo (tools) y recibe lo que se escribe; la segunda, Buscar
 *          1.1.0 (2026-10-25) — INV-3: pestañas que suman otros archivos (InvView.register); la primera, Multicuenta
 *          1.0.0 (2026-10-25) — INV-2: la vista nueva sobre el modelo de js/inv-model.js
 *
 * Toma el panel #inventoryPanel (#/account/characters) y oculta lo viejo sin borrarlo, como Raids:
 *  - Cabecera con el ícono del módulo, 4 indicadores (banco, materiales, armería legendaria y
 *    personajes, leídos de la cuenta y no de otra pantalla) y mi línea si el banco está por llenarse.
 *  - Pestañas Materiales (las 9 categorías del juego, por la categoría que trae la API de cada
 *    material), Banco (por pestaña de 30, como en el juego) y Armería legendaria (por tipo).
 *  - Multicuenta (js/inv-multi.js), Buscar (js/inv-search.js) y Personajes (js/inv-chars.js) son pestañas
 *    que suman otros archivos: la primera vez abre en Multicuenta y después recuerda la última (D6).
 * Íconos y nombres en español de /v2/items (GW2Api.getItemsMany, con su caché). La rareza va en un
 * anillo alrededor del ícono y en texto para el lector, nunca como color de letra. Estados honestos:
 * lo que no se pudo leer dice «Sin datos», nunca 0. Recuerda la última pestaña (gn:inventory:tab).
 * Se carga por js/modules.json, después de js/inv-model.js (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.5.0';
  var LOG = '[InvView]';
  var PANEL = 'inventoryPanel';
  var ICON = 'assets/icons/Welcome/358409.png';
  var CATS_URL = 'assets/data/inventory/material-categories.json';
  var TAB_KEY = 'gn:inventory:tab';
  var TABS = [['mat', 'Materiales'], ['bank', 'Banco'], ['armory', 'Armería legendaria']];
  var RARITY = {
    Junk: ['Chatarra', '#AAAAAA'], Basic: ['Básico', '#C9D0DA'], Fine: ['Bueno', '#62A4DA'], Masterwork: ['Obra maestra', '#1A9306'],
    Rare: ['Raro', '#FCD00B'], Exotic: ['Exótico', '#FFA405'], Ascended: ['Ascendido', '#FB3E8D'], Legendary: ['Legendario', '#974EFF']
  };
  var ARMORY_GROUPS = [['Weapon', 'Armas'], ['Armor', 'Armaduras'], ['Back', 'Espaldares'], ['Trinket', 'Abalorios'], ['UpgradeComponent', 'Mejoras'], ['', 'Otros']];
  var BANK_TIGHT = 0.1; // con menos del 10 % libre, aviso
  // Pestañas que suman otros archivos con InvView.register: {id, label, order, isDefault, html, tools, onEvent, onShow, refresh}.
  var PLUGINS = [];
  // Las sumadas con order menor que 100 van antes de las propias; las de 100 o más, después.
  function tabsAll() {
    var all = PLUGINS.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var pick = function (late) { return all.filter(function (p) { return ((p.order || 0) >= 100) === late; }).map(function (p) { return [p.id, p.label]; }); };
    return pick(false).concat(TABS, pick(true));
  }
  function pluginOf(id) { for (var i = 0; i < PLUGINS.length; i++) if (PLUGINS[i].id === id) return PLUGINS[i]; return null; }
  function defaultTab() { for (var i = 0; i < PLUGINS.length; i++) if (PLUGINS[i].isDefault) return PLUGINS[i].id; return 'mat'; }
  function isTab(id) { return tabsAll().some(function (t) { return t[0] === id; }); }

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }
  function M() { return root.InvModel && root.InvModel._pure; }
  function fold(s) { var P = M(); return P ? P.fold(s) : String(s || '').toLowerCase(); }
  function rarityOf(meta) { return RARITY[(meta && meta.rarity) || 'Basic'] || RARITY.Basic; }
  function nameOf(meta, id) { return meta && meta.name ? meta.name : 'Ítem ' + id; }

  // Todo lo que muestra la pantalla, sin tocar el DOM.
  // data: { loaded, hasToken, bank, materials, armory, chars, items: {id: meta}, unread: [...] }
  function buildModel(data, cats, ui) {
    ui = ui || {};
    var P = M(), d = data || {};
    var tab = isTab(ui.tab) ? ui.tab : defaultTab();
    var m = { tab: tab, q: ui.q || '', cat: ui.cat || 'all', loaded: !!d.loaded, hasToken: !!d.hasToken,
      items: d.items || {}, unread: d.unread || [], voice: null,
      bank: P ? P.bankSummary(d.bank) : { used: null, total: null, free: null, tabs: null },
      matGroups: [], matHeld: null, armory: Array.isArray(d.armory) ? d.armory.slice() : null,
      chars: typeof d.chars === 'number' ? d.chars : null };
    if (Array.isArray(d.materials) && P) {
      m.matGroups = P.groupMaterials(d.materials, cats || []);
      m.matHeld = m.matGroups.reduce(function (s, g) { return s + g.held; }, 0);
    }
    if (m.cat !== 'all' && !m.matGroups.some(function (g) { return String(g.id) === String(m.cat); })) m.cat = 'all';
    m.bankSlots = Array.isArray(d.bank) ? d.bank : null;
    m.voice = pickVoice(m);
    return m;
  }

  // Mi línea: solo si el banco está por llenarse. Sin datos, nada.
  function pickVoice(m) {
    var b = m.bank;
    if (!m.loaded || !m.hasToken || b.total == null || !b.total) return null;
    if (b.free > b.total * BANK_TIGHT) return null;
    var n = b.free;
    return { key: 'bank:' + n, kind: 'recomienda',
      text: n === 0 ? 'Tu banco está lleno: ' + fmtInt(b.total) + ' de ' + fmtInt(b.total) + ' espacios ocupados.'
        : 'Te ' + (n === 1 ? 'queda 1 espacio libre' : 'quedan ' + fmtInt(n) + ' espacios libres') + ' en el banco, de ' + fmtInt(b.total) + '.' };
  }

  var UNREAD_TXT = { bank: 'el banco', materials: 'los materiales', armory: 'la armería legendaria', chars: 'tus personajes' };
  function errorText(m) {
    if (!m.unread.length) return '';
    var list = m.unread.map(function (k) { return UNREAD_TXT[k] || k; });
    var said = list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
    return 'No pude leer ' + said + '. Revisá que la API Key tenga permiso de inventarios.';
  }

  function subtitle(m) {
    if (!m.hasToken) return 'Cargá tu API Key (con permiso de inventarios) para ver tu inventario.';
    if (!m.loaded) return 'Leyendo tu banco, tus materiales y tu armería legendaria…';
    return 'Tu banco, tu depósito de materiales y tu armería legendaria.';
  }

  function stat(label, value, note, bar) {
    return '<div class="iv-st"><small>' + label + '</small><b>' + value + '</b>' +
      (bar != null ? '<div class="iv-bar" aria-hidden="true"><i style="width:' + bar + '%"></i></div>' : '') + '<em>' + note + '</em></div>';
  }
  function statsHTML(m) {
    var ok = m.loaded && m.hasToken, b = m.bank, nd = 'sin datos';
    var pct = b.total ? Math.round(b.used * 100 / b.total) : 0;
    var cats = m.matGroups.filter(function (g) { return g.held; }).length;
    return stat('Banco', ok && b.total != null ? fmtInt(b.used) + ' <span>de ' + fmtInt(b.total) + '</span>' : '—',
        ok && b.total != null ? fmtInt(b.free) + ' espacios libres' : nd, ok && b.total != null ? pct : null) +
      stat('Materiales', ok && m.matHeld != null ? fmtInt(m.matHeld) + ' <span>tipos</span>' : '—', ok && m.matHeld != null ? 'guardados en ' + cats + (cats === 1 ? ' categoría' : ' categorías') : nd) +
      stat('Armería legendaria', ok && m.armory ? fmtInt(m.armory.length) : '—', ok && m.armory ? 'legendarias desbloqueadas' : nd) +
      stat('Personajes', ok && m.chars != null ? fmtInt(m.chars) : '—', ok && m.chars != null ? 'en tu cuenta' : nd);
  }

  // Un ítem: ícono con el anillo de su rareza, nombre y cantidad. La rareza también en texto.
  function icon(meta, id, size) {
    var r = rarityOf(meta);
    return '<span class="iv-ic" style="--iv-r:' + r[1] + '">' + (meta && meta.icon
      ? '<img src="' + esc(meta.icon) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>';
  }
  function tile(id, count, meta, extra) {
    var r = rarityOf(meta), name = nameOf(meta, id);
    return '<li class="iv-tile" title="' + esc(name + ' · ' + r[0]) + '"><button type="button" class="iv-open" data-inv-item="' + id + '" aria-haspopup="dialog">' + icon(meta, id, 32) +
      '<span class="iv-tn">' + esc(name) + '<span class="iv-sr">, ' + esc(r[0]) + '</span>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</span>' +
      '<b class="iv-tc">' + fmtInt(count) + '</b></button></li>';
  }
  function matches(m, meta, id) { return !m.q || fold(nameOf(meta, id)).indexOf(fold(m.q).trim()) >= 0; }

  function materialsHTML(m) {
    if (!m.matGroups.length) return '<p class="iv-note">' + (m.loaded ? 'Sin datos de tus materiales.' : 'Cargando…') + '</p>';
    var h = '', any = false;
    m.matGroups.forEach(function (g) {
      if (m.cat !== 'all' && String(g.id) !== String(m.cat)) return;
      var rows = g.items.filter(function (it) { return matches(m, m.items[it.id], it.id); });
      if (!rows.length) return;
      any = true;
      var pct = g.slots ? Math.round(g.held * 100 / g.slots) : 0;
      h += '<section class="iv-grp" aria-labelledby="ivC-' + g.id + '"><div class="iv-grp-h"><h3 id="ivC-' + g.id + '">' + esc(g.name) + '</h3>' +
        '<small>' + fmtInt(g.held) + ' de ' + fmtInt(g.slots) + ' con algo guardado</small><div class="iv-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div>' +
        '<ul class="iv-tiles">' + rows.map(function (it) { return tile(it.id, it.count, m.items[it.id]); }).join('') + '</ul></section>';
    });
    return any ? h : '<p class="iv-note">Ningún material coincide con «' + esc(m.q) + '».</p>';
  }

  function bankHTML(m) {
    var slots = m.bankSlots;
    if (!slots) return '<p class="iv-note">' + (m.loaded ? 'Sin datos de tu banco.' : 'Cargando…') + '</p>';
    var P = M(), per = P ? P.BANK_TAB : 30, h = '';
    if (m.q) {
      var rows = [];
      slots.forEach(function (s, i) { if (s && s.id && matches(m, m.items[s.id], s.id)) rows.push(tile(s.id, s.count || 1, m.items[s.id], 'Pestaña ' + (Math.floor(i / per) + 1))); });
      return rows.length ? '<ul class="iv-tiles">' + rows.join('') + '</ul>' : '<p class="iv-note">Nada en tu banco coincide con «' + esc(m.q) + '».</p>';
    }
    for (var t = 0; t * per < slots.length; t++) {
      var part = slots.slice(t * per, (t + 1) * per), used = part.filter(function (s) { return s && s.id; }).length;
      h += '<section class="iv-grp" aria-labelledby="ivB-' + (t + 1) + '"><div class="iv-grp-h"><h3 id="ivB-' + (t + 1) + '">Pestaña ' + (t + 1) + '</h3>' +
        '<small>' + used + ' de ' + part.length + ' ocupados</small></div><ul class="iv-slots">';
      part.forEach(function (s) {
        if (!s || !s.id) { h += '<li class="iv-slot iv-slot--empty"><span class="iv-sr">vacío</span></li>'; return; }
        var meta = m.items[s.id], r = rarityOf(meta), n = s.count || 1, name = nameOf(meta, s.id);
        h += '<li class="iv-slot" title="' + esc(name + (n > 1 ? ' ×' + n : '') + ' · ' + r[0]) + '"><button type="button" class="iv-open" data-inv-item="' + s.id + '" aria-haspopup="dialog">' + icon(meta, s.id, 40) +
          (n > 1 ? '<b class="iv-sc" aria-hidden="true">' + fmtInt(n) + '</b>' : '') + '<span class="iv-sr">' + esc(name) + ', ' + fmtInt(n) + ', ' + esc(r[0]) + '</span></button></li>';
      });
      h += '</ul></section>';
    }
    return h;
  }

  function armoryHTML(m) {
    if (!m.armory) return '<p class="iv-note">' + (m.loaded ? 'Sin datos de tu armería legendaria.' : 'Cargando…') + '</p>';
    if (!m.armory.length) return '<p class="iv-note">Todavía no tenés legendarias en la armería.</p>';
    var h = '', any = false, known = ARMORY_GROUPS.map(function (g) { return g[0]; });
    ARMORY_GROUPS.forEach(function (g, gi) {
      var rows = m.armory.filter(function (a) {
        var t = (m.items[a.id] && m.items[a.id].type) || '';
        return (g[0] ? t === g[0] : known.indexOf(t) < 0) && matches(m, m.items[a.id], a.id);
      }).sort(function (a, b) { return nameOf(m.items[a.id], a.id).localeCompare(nameOf(m.items[b.id], b.id), 'es'); });
      if (!rows.length) return;
      any = true;
      h += '<section class="iv-grp" aria-labelledby="ivA-' + gi + '"><div class="iv-grp-h"><h3 id="ivA-' + gi + '">' + g[1] + '</h3><small>' + rows.length + '</small></div>' +
        '<ul class="iv-tiles">' + rows.map(function (a) { return tile(a.id, a.count || 1, m.items[a.id]); }).join('') + '</ul></section>';
    });
    return any ? h : '<p class="iv-note">Ninguna legendaria coincide con «' + esc(m.q) + '».</p>';
  }

  function listHTML(m) {
    var pl = pluginOf(m.tab);
    if (pl) return pl.html(m);
    if (!m.hasToken) return '<p class="iv-note">Sin API Key no puedo leer tu inventario.</p>';
    return m.tab === 'bank' ? bankHTML(m) : m.tab === 'armory' ? armoryHTML(m) : materialsHTML(m);
  }

  function toolsHTML(m) {
    var tp = pluginOf(m.tab);
    if (tp) return tp.tools ? '<div class="iv-tools">' + tp.tools(m) + '</div>' : '';
    var h = '<div class="iv-tools"><label class="iv-search"><span class="iv-sr">Filtrar por nombre</span>' +
      '<input type="search" id="ivQ" placeholder="Filtrar por nombre…" value="' + esc(m.q) + '" autocomplete="off"></label>';
    if (m.tab === 'mat' && m.matGroups.length) {
      h += '<label class="iv-sel"><span class="iv-sr">Categoría</span><select id="ivCat"><option value="all">Todas las categorías</option>';
      m.matGroups.forEach(function (g) { h += '<option value="' + g.id + '"' + (String(g.id) === String(m.cat) ? ' selected' : '') + '>' + esc(g.name) + '</option>'; });
      h += '</select></label>';
    }
    return h + '</div>';
  }

  function viewHTML(m) {
    var h = [], err = errorText(m);
    h.push('<div class="iv-hero"><div class="iv-row"><img class="iv-ico" src="' + ICON + '" alt="" width="56" height="56">');
    h.push('<div class="iv-title"><h2 id="ivTitle">Inventario y Personajes</h2><p>' + esc(subtitle(m)) + '</p></div>');
    h.push('<div class="iv-acts">' +
      '<button type="button" class="iv-btn" data-iv="refresh">↻ Actualizar</button></div></div>');
    h.push('<div class="iv-stats">' + statsHTML(m) + '</div>');
    if (err) h.push('<p class="iv-err" role="status">' + esc(err) + '</p>');
    h.push('<div id="ivVoice" class="iv-voice" aria-live="polite"></div></div>');
    h.push('<div class="iv-tabs" role="tablist" aria-label="Secciones del inventario">');
    tabsAll().forEach(function (t) {
      var on = m.tab === t[0];
      h.push('<button type="button" role="tab" id="ivTab-' + t[0] + '" data-iv-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="ivPanel" tabindex="' + (on ? '0' : '-1') + '">' + t[1] + '</button>');
    });
    h.push('</div><div id="ivPanel" role="tabpanel" aria-labelledby="ivTab-' + m.tab + '">' + toolsHTML(m));
    h.push('<div id="ivList">' + listHTML(m) + '</div>');
    h.push('<p class="iv-src">Nombres, íconos y rarezas: API oficial del juego, en español.</p></div>');
    return h.join('');
  }

  var R = '#ivRoot';
  var CSS = [
    '#' + PANEL + '.iv-on>.panel__title,#' + PANEL + '.iv-on>.panel__body{display:none!important}',
    R + '{--iv-mod:var(--gn-mod,#7EC3FF)}',
    '.iv-hero{border:1px solid var(--bd-1);border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--iv-mod) 12%,transparent),var(--bg-1) 70%);padding:16px 18px}',
    '.iv-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.iv-ico{width:56px;height:56px;border-radius:12px;background:var(--bg-2);padding:6px;box-shadow:0 0 0 2px color-mix(in srgb,var(--iv-mod) 70%,transparent);flex-shrink:0;box-sizing:border-box}',
    '.iv-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.iv-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.iv-acts{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}',
    '.iv-btn{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px}',
    '.iv-btn:hover{border-color:var(--acc-1)}',
    '.iv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.iv-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.iv-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.iv-st b{font-size:1.25rem;color:var(--tx-1)}.iv-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.iv-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px}',
    '.iv-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:6px}.iv-bar i{display:block;height:100%;background:var(--iv-mod)}',
    '.iv-err{margin:10px 0 0;padding-left:8px;border-left:3px solid var(--color-red,#F47C7C);font-size:.82rem;color:var(--tx-1)}',
    '.iv-voice{margin-top:12px}.iv-voice:empty{display:none}.iv-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.iv-voice .shv-voice__avatar{width:36px;height:36px}.iv-voice .shv-voice__label{font-size:.78rem}.iv-voice .shv-voice__body p{font-size:.86rem}',
    '.iv-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1);overflow-x:auto}',
    '.iv-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);cursor:pointer;white-space:nowrap;min-height:40px}',
    '.iv-tabs [role=tab][aria-selected=true]{color:var(--tx-1);font-weight:700;border-bottom-color:var(--iv-mod)}',
    '.iv-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.iv-search{flex:1;min-width:200px}',
    '.iv-tools input,.iv-tools select{font:inherit;font-size:.86rem;width:100%;box-sizing:border-box;border:1px solid var(--bd-2);border-radius:10px;background:var(--bg-0);color:var(--tx-1);padding:7px 12px;min-height:36px}',
    '.iv-note,.iv-src{margin:4px 0 10px;color:var(--tx-2);font-size:.84rem}.iv-src{font-size:.74rem;margin-top:12px}',
    '.iv-grp{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:12px 14px;margin-bottom:12px}',
    '.iv-grp-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}.iv-grp-h h3{margin:0;font-size:.95rem;color:var(--tx-1)}',
    '.iv-grp-h small{font-size:.76rem;color:var(--tx-2)}.iv-grp-h .iv-bar{flex-basis:100%;margin-top:0}',
    '.iv-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}',
    '.iv-tile{display:flex;gap:8px;align-items:center;border:1px solid var(--bd-1);border-radius:10px;padding:6px 8px;background:var(--bg-0);min-width:0}',
    '.iv-tn{flex:1;min-width:0;font-size:.82rem;color:var(--tx-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.iv-tn small{display:block;font-size:.72rem;color:var(--tx-2)}',
    '.iv-tc{font-size:.86rem;color:var(--tx-1)}',
    '.iv-open{display:flex;gap:8px;align-items:center;flex:1;min-width:0;background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:8px}',
    '.iv-slot>.iv-open{display:block;width:100%;height:100%}',
    '.iv-ic{position:relative;display:inline-block;flex-shrink:0;border-radius:8px;background:var(--bg-2);box-shadow:inset 0 0 0 2px var(--iv-r),0 0 0 1px var(--bd-1);line-height:0}',
    '.iv-ic img{display:block;border-radius:8px;padding:2px;box-sizing:border-box}.iv-tile .iv-ic{width:32px;height:32px}.iv-tile .iv-ic img{width:32px;height:32px}',
    '.iv-slots{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(10,minmax(0,44px));gap:4px}',
    '.iv-slot{position:relative;width:44px;height:44px}.iv-slot .iv-ic{width:44px;height:44px}.iv-slot .iv-ic img{width:44px;height:44px}',
    '.iv-slot--empty{border:1px dashed var(--bd-2);border-radius:8px;box-sizing:border-box}',
    '.iv-sc{position:absolute;right:2px;bottom:1px;font-size:.68rem;color:var(--tx-1);background:var(--bg-0);border-radius:6px;padding:0 3px;line-height:1.3}',
    '.iv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    R + ' button:focus-visible,' + R + ' input:focus-visible,' + R + ' select:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + R + ' *{transition:none!important;animation:none!important}}',
    '@media (max-width:900px){.iv-hero{padding:12px}.iv-ico{width:40px;height:40px;padding:4px}.iv-title h2{font-size:1.05rem}',
    '.iv-acts{margin-left:0;width:100%}.iv-stats{grid-template-columns:1fr 1fr;gap:6px}.iv-st{padding:8px 10px}.iv-st b{font-size:1.05rem}',
    '.iv-tabs [role=tab],.iv-btn,.iv-tools input,.iv-tools select{min-height:44px}.iv-tiles{grid-template-columns:1fr 1fr}',
    '.iv-slots{grid-template-columns:repeat(auto-fill,minmax(40px,1fr))}.iv-slot,.iv-slot .iv-ic,.iv-slot .iv-ic img{width:40px;height:40px}}',
    '@media (max-width:520px){.iv-tiles{grid-template-columns:1fr}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { cats: null, catsP: null, data: null, ui: { tab: null, q: '', cat: 'all' }, voiceKey: null, seq: 0 };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function hash() { return String((root.location && root.location.hash) || ''); }
  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }

  function token() {
    try {
      var sel = byId('keySelectGlobal');
      if (sel && sel.value) return String(sel.value).trim();
      var S = storage();
      if (S && S.STORAGE_KEYS) return S.get(S.STORAGE_KEYS.ACCOUNT_SELECTED) || null;
    } catch (e) {}
    return null;
  }

  function savedTab() {
    var S = storage(), t = S ? S.get(TAB_KEY) : null;
    return isTab(t) ? t : defaultTab();
  }

  function loadCats() {
    if (st.cats) return Promise.resolve(st.cats);
    if (st.catsP) return st.catsP;
    if (typeof root.fetch !== 'function') return Promise.resolve([]);
    st.catsP = root.fetch(CATS_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('categorías ' + r.status); return r.json(); })
      .then(function (c) { st.cats = (c && c.categories) || []; return st.cats; })
      .catch(function (e) { st.catsP = null; if (root.console) root.console.warn(LOG, 'categorías', e); return []; });
    return st.catsP;
  }

  function settle(p) {
    return Promise.resolve().then(function () { return p(); })
      .then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; });
  }

  // Cada lectura falla por su lado: lo que llegó se muestra, lo que no se dice.
  function load(nocache) {
    var mySeq = ++st.seq, tk = token(), A = root.GW2Api, opt = { nocache: !!nocache };
    if (!tk || !A) { st.data = { loaded: true, hasToken: false }; render(); return Promise.resolve(st.data); }
    if (!st.data || st.data.tk !== tk) { st.data = { loaded: false, hasToken: true, tk: tk, items: {} }; render(); }
    var items = st.data.items || {};
    return Promise.all([
      settle(function () { return A.getAccountBank(tk, opt); }),
      settle(function () { return A.getAccountMaterials(tk, opt); }),
      settle(function () { return A.getAccountLegendaryArmory(tk, opt); }),
      settle(function () { return A.getCharacterCount(tk, opt); })
    ]).then(function (r) {
      if (mySeq !== st.seq) return null;
      var arr = function (x) { return x.ok && Array.isArray(x.v) ? x.v : null; };
      var d = { loaded: true, hasToken: true, tk: tk, items: items, unread: [],
        bank: arr(r[0]), materials: arr(r[1]), armory: arr(r[2]), chars: r[3].ok && typeof r[3].v === 'number' ? r[3].v : null };
      ['bank', 'materials', 'armory', 'chars'].forEach(function (k) { if (d[k] == null) d.unread.push(k); });
      st.data = d;
      render();
      var ids = {};
      (d.bank || []).forEach(function (s) { if (s && s.id) ids[s.id] = 1; });
      (d.materials || []).forEach(function (s) { if (s && s.id && s.count > 0) ids[s.id] = 1; });
      (d.armory || []).forEach(function (s) { if (s && s.id) ids[s.id] = 1; });
      var missing = Object.keys(ids).filter(function (id) { return !items[id]; }).map(Number);
      if (!missing.length || typeof A.getItemsMany !== 'function') return d;
      return A.getItemsMany(missing, { nocache: false }).then(function (list) {
        (list || []).forEach(function (it) { if (it && it.id) items[it.id] = { name: it.name, icon: it.icon, rarity: it.rarity, type: it.type }; });
        if (mySeq === st.seq) render();
        return d;
      }, function (e) { if (root.console) root.console.warn(LOG, 'ítems', e); return d; });
    });
  }

  function ensureHost(panel) {
    if (!byId('inv-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style');
      s.id = 'inv-view-css';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var host = byId('ivRoot');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'ivRoot';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
    }
    if (panel.classList) panel.classList.add('iv-on');
    if (panel.setAttribute) panel.setAttribute('aria-labelledby', 'ivTitle');
    return host;
  }

  function model() { if (!st.ui.tab) st.ui.tab = savedTab(); return buildModel(st.data, st.cats, st.ui); }

  function render() {
    var panel = byId(PANEL);
    if (!panel || !st.cats) return null;
    var host = ensureHost(panel), m = model();
    st.ui.cat = m.cat;
    var a = doc.activeElement, fk = a && host.contains && host.contains(a) && a.getAttribute ? (a.id ? '#' + a.id : a.getAttribute('data-iv') ? '[data-iv="' + a.getAttribute('data-iv') + '"]' : null) : null;
    host.innerHTML = viewHTML(m);
    st.voiceKey = null;
    renderVoice(m.voice);
    if (fk && host.querySelector) { var b = host.querySelector(fk); if (b && b.focus) b.focus(); }
    var pl = pluginOf(m.tab);
    if (pl && pl.onShow) pl.onShow();
    return m;
  }

  // Al filtrar solo se redibuja la lista: el campo conserva el foco y lo escrito.
  function renderList() {
    var box = byId('ivList');
    if (!box) return render();
    var m = model(), a = doc.activeElement, fk = a && box.contains && box.contains(a) && a.id ? a.id : null;
    box.innerHTML = listHTML(m);
    if (fk) { var b = byId(fk); if (b && b.focus) b.focus(); }
    return m;
  }

  // Una pestaña sumada pide redibujar su lista cuando le llegan datos (solo si es la que se ve).
  function renderTab(id) {
    var panel = byId(PANEL);
    if (!panel || isHidden(panel) || !byId('ivRoot') || !st.ui.tab || st.ui.tab !== id) return null;
    return renderList();
  }

  function register(p) {
    if (!p || !p.id || typeof p.html !== 'function' || pluginOf(p.id)) return false;
    PLUGINS.push(p);
    if (!st.ui.chosen) st.ui.tab = null;
    var panel = byId(PANEL);
    if (panel && !isHidden(panel) && byId('ivRoot')) render();
    return true;
  }

  function renderVoice(msg) {
    var box = byId('ivVoice');
    if (!box) return;
    var key = msg ? msg.key : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text }));
  }

  function go(tab) {
    if (!isTab(tab)) return null;
    st.ui.chosen = true;
    st.ui.tab = tab; st.ui.q = ''; st.ui.cat = 'all';
    var S = storage();
    if (S) S.set(TAB_KEY, tab);
    return render();
  }

  function actOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = { act: n.getAttribute('data-iv'), tab: n.getAttribute('data-iv-tab') };
      if (a.act || a.tab) return a;
    }
    return null;
  }

  function wire(host) {
    host.addEventListener('click', function (e) {
      var pl = pluginOf(st.ui.tab);
      if (pl && pl.onEvent && pl.onEvent(e)) return;
      var a = actOf(e.target);
      if (!a) return;
      if (a.act === 'refresh') {
        if (root.toast) root.toast('info', 'Actualizando tu inventario…', { ttl: 1500 });
        load(true);
        if (pl && pl.refresh) pl.refresh(true);
      }
      else if (a.tab) go(a.tab);
    });
    host.addEventListener('input', function (e) {
      var pl = pluginOf(st.ui.tab);
      if (pl && pl.onEvent && pl.onEvent(e)) return;
      var t = e.target;
      if (t && t.id === 'ivQ') { st.ui.q = String(t.value || ''); renderList(); }
    });
    host.addEventListener('change', function (e) {
      var pl = pluginOf(st.ui.tab);
      if (pl && pl.onEvent && pl.onEvent(e)) return;
      var t = e.target;
      if (t && t.id === 'ivCat') { st.ui.cat = String(t.value || 'all'); renderList(); }
    });
    // Flechas, Inicio y Fin entre las pestañas (patrón tablist).
    host.addEventListener('keydown', function (e) {
      var a = actOf(e.target);
      if (!a || !a.tab) return;
      var ids = tabsAll().map(function (t) { return t[0]; }), i = ids.indexOf(a.tab), to = null;
      if (e.key === 'ArrowRight') to = ids[(i + 1) % ids.length];
      else if (e.key === 'ArrowLeft') to = ids[(i + ids.length - 1) % ids.length];
      else if (e.key === 'Home') to = ids[0];
      else if (e.key === 'End') to = ids[ids.length - 1];
      if (!to) return;
      if (e.preventDefault) e.preventDefault();
      go(to);
      var b = byId('ivTab-' + to);
      if (b && b.focus) b.focus();
    });
  }

  function onShow() {
    if (hash() !== '#/account/characters' || isHidden(byId(PANEL))) return;
    loadCats().then(function () { render(); load(false); });
  }

  function init() {
    if (!byId(PANEL)) return;
    if (doc.addEventListener) {
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { st.data = null; setTimeout(onShow, 50); });
    }
    if (root.addEventListener) root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
    onShow();
  }

  root.InvView = {
    version: VERSION, render: render, go: go, refresh: function () { return load(true); }, register: register, renderTab: renderTab,
    getSnapshot: function () { return { data: st.data, ui: { tab: st.ui.tab, q: st.ui.q, cat: st.ui.cat } }; },
    _pure: { esc: esc, fmtInt: fmtInt, buildModel: buildModel, pickVoice: pickVoice, errorText: errorText, subtitle: subtitle,
      viewHTML: viewHTML, listHTML: listHTML, RARITY: RARITY, TABS: TABS, tabsAll: tabsAll, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
