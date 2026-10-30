/*!
 * js/bld-gear.js — Builds: equipo, sugerencia por reglas y código AE2 en el Editor (BL-082 BLD-12 y BLD-13: B4, C3 y D2)
 * Versión: 1.0.0 (2026-10-28)
 *
 * Optimizador por reglas (D2): según el modo y el rol de la build sugiere estadísticas, runa, reliquia y sigilos como
 * punto de partida. No es un optimizador matemático (eso lo hace Snow Crows para PvE): son reglas conocidas y simples.
 * «Lo que ya tenés»: con tu API Key (permiso de inventarios) miro tu Armería legendaria y te digo qué piezas
 * legendarias ya cubren esa sugerencia sin gastar nada.
 * El equipo elegido se copia en formato AE2 (js/bld-ae2.js) para el complemento Alter Ego. En PvP el equipo es el
 * amuleto: se elige en el juego. Los ids salen de la API oficial (/v2/itemstats y /v2/items, 2026-10-28).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var API = 'https://api.guildwars2.com';
  // Estadísticas (ids de /v2/itemstats) y objetos (ids de /v2/items) que usan las reglas.
  var STATS = { 1077: "Berserker's", 1130: "Viper's", 1538: "Diviner's", 1686: "Ritualist's", 1052: 'Celestial', 1345: "Harrier's",
    1123: "Minstrel's", 1125: "Commander's", 1111: 'Marauder', 1681: "Dragon's", 1064: 'Sinister', 1220: 'Seraph', 1085: "Trailblazer's", 1119: 'Valkyrie' };
  var RUNES = { 24836: 'Scholar', 24848: 'Nightmare', 24842: 'Monk', 73653: 'Durability', 70600: 'Leadership', 24723: 'Eagle', 24765: 'Balthazar', 83338: 'Firebrand', 24691: 'Traveler' };
  var RELICS = { 100916: 'Thief', 100262: 'Fireworks', 100153: 'Fractal', 100031: 'Monk', 100455: 'Durability', 99965: 'Flock', 100849: 'Aristocracy', 100579: 'Nightmare', 101801: 'Mosyn' };
  var SIGILS = { 24615: 'Force', 24618: 'Accuracy', 24868: 'Impact', 24560: 'Earth', 44944: 'Bursting', 24548: 'Fire', 24605: 'Geomancy', 74326: 'Transference', 72339: 'Concentration', 44950: 'Malice', 24554: 'Air', 24609: 'Doom' };
  var TWO_HAND = { Greatsword: 1, Hammer: 1, Longbow: 1, Rifle: 1, Shortbow: 1, Staff: 1, Spear: 1 };
  var ARMOR = ['Helm', 'Shoulders', 'Coat', 'Gloves', 'Leggings', 'Boots'], TRINKETS = ['Backpack', 'Accessory1', 'Accessory2', 'Amulet', 'Ring1', 'Ring2'];
  var st = { names: null, namesLoading: false, owned: null, ownedErr: '', ownedLoading: false };

  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }

  // ---------------------------------------------------------------- reglas (puro)
  // profile = { mode: 'pve'|'wvw'|'pvp', damage: 'power'|'condition'|'hybrid'|null, roles: [...] }
  function suggest(p) {
    p = p || {};
    var r = p.roles || [], boon = r.indexOf('quickness') >= 0 || r.indexOf('alacrity') >= 0, why;
    if (p.mode === 'pvp') return { pvp: true, why: 'En PvP el equipo es el amuleto y se elige en el juego.' };
    var s;
    if (r.indexOf('heal') >= 0) { s = { stat: 1345, rune: 24842, relic: 100031, sigils: [74326, 72339] }; why = 'curación con bendiciones'; }
    else if (r.indexOf('support') >= 0 || r.indexOf('boon') >= 0) {
      s = p.mode === 'wvw' ? { stat: 1123, rune: 73653, relic: 100455, sigils: [74326, 72339] } : { stat: 1345, rune: 24842, relic: 100031, sigils: [74326, 72339] };
      why = p.mode === 'wvw' ? 'apoyo de grupo en WvW: aguante y duración de bendiciones' : 'apoyo con curación';
    } else if (p.damage === 'condition') {
      s = boon ? { stat: 1686, rune: 24848, relic: 100153, sigils: [24560, 44944] } : { stat: 1130, rune: 24848, relic: 100153, sigils: [24560, 44944] };
      why = boon ? 'condición con bendiciones (duración de bendiciones)' : 'daño de condición';
    } else if (p.damage === 'hybrid') { s = { stat: 1052, rune: 24848, relic: 100153, sigils: [24560, 24615] }; why = 'celestial: un poco de todo'; }
    else if (p.mode === 'wvw') { s = { stat: 1111, rune: 24836, relic: 100916, sigils: [24615, 24618] }; why = 'daño de poder en WvW con algo de vida'; }
    else { s = boon ? { stat: 1538, rune: 24836, relic: 100916, sigils: [24615, 24618] } : { stat: 1077, rune: 24836, relic: 100916, sigils: [24615, 24618] }; why = boon ? 'poder con bendiciones' : 'daño de poder'; }
    s.why = why;
    return s;
  }
  // Armas de la build → casilleros de AE2 (las de dos manos ocupan un juego entero).
  function weaponSlots(weapons) {
    var out = [], set = 0, hand = 0;
    (weapons || []).forEach(function (w) {
      if (set > 1) return;
      if (TWO_HAND[w]) { if (hand) { set++; hand = 0; } if (set > 1) return; out.push({ slot: set ? 'WeaponB1' : 'WeaponA1', type: w, two: true }); set++; hand = 0; return; }
      out.push({ slot: (set ? 'WeaponB' : 'WeaponA') + (hand + 1), type: w, two: false });
      hand++; if (hand > 1) { set++; hand = 0; }
    });
    return out;
  }
  // gear del Editor → objeto gear de AE2
  function toAe2Gear(g, weapons) {
    var out = {};
    ARMOR.concat(TRINKETS).forEach(function (s) { if (g.stat) out[s] = { statId: g.stat }; });
    weaponSlots(weapons).forEach(function (w, i) {
      out[w.slot] = { statId: g.stat || 0, weaponType: w.type, sigilId: (g.sigils || [])[w.two ? 0 : (i % 2)] || 0 };
      if (w.two) out[w.slot].sigil2Id = (g.sigils || [])[1] || 0;
    });
    return out;
  }

  // ---------------------------------------------------------------- nombres en castellano (API, una vez)
  function loadNames() {
    if (st.names || st.namesLoading || typeof root.fetch !== 'function') return Promise.resolve(st.names);
    st.namesLoading = true;
    var items = Object.keys(RUNES).concat(Object.keys(RELICS), Object.keys(SIGILS));
    return Promise.all([
      root.fetch(API + '/v2/itemstats?lang=es&ids=' + Object.keys(STATS).join(',')).then(function (r) { return r.json(); }),
      root.fetch(API + '/v2/items?lang=es&ids=' + items.join(',')).then(function (r) { return r.json(); })
    ]).then(function (r) {
      var n = { stats: {}, items: {} };
      (r[0] || []).forEach(function (s) { n.stats[s.id] = s.name; });
      (r[1] || []).forEach(function (s) { n.items[s.id] = s.name; });
      st.names = n;
      if (root.GNBldAe2) root.GNBldAe2._names = n;
      st.namesLoading = false;
      return n;
    }, function () { st.namesLoading = false; return null; });
  }
  function nm(kind, id) {
    var n = st.names;
    if (kind === 'stat') return (n && n.stats[id]) || STATS[id] || ('#' + id);
    return (n && n.items[id]) || (RUNES[id] && 'Runa: ' + RUNES[id]) || (RELICS[id] && 'Reliquia: ' + RELICS[id]) || (SIGILS[id] && 'Sigilo: ' + SIGILS[id]) || ('#' + id);
  }

  // ---------------------------------------------------------------- lo que ya tenés (Armería legendaria)
  function token() {
    try { var s = root.document && root.document.getElementById('keySelectGlobal'); return s && s.value ? String(s.value).trim() : ''; } catch (_) { return ''; }
  }
  function loadOwned(repaint) {
    var t = token();
    if (!t) { st.ownedErr = 'Elegí una API Key arriba (con permiso de inventarios) para ver lo que ya tenés.'; repaint(); return; }
    st.ownedLoading = true; st.ownedErr = ''; repaint();
    root.fetch(API + '/v2/account/legendaryarmory?access_token=' + encodeURIComponent(t)).then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 || r.status === 401 ? 'la Key no tiene permiso de inventarios' : 'la API respondió ' + r.status);
      return r.json();
    }).then(function (list) {
      var ids = (list || []).map(function (x) { return x.id; });
      if (!ids.length) return [];
      return root.fetch(API + '/v2/items?lang=es&ids=' + ids.slice(0, 200).join(',')).then(function (r) { return r.json(); });
    }).then(function (items) {
      var o = { armor: 0, trinkets: 0, weapons: 0, rune: false, sigils: 0, relic: false };
      (items || []).forEach(function (it) {
        var d = it.details || {};
        if (it.type === 'Armor') o.armor++;
        else if (it.type === 'Trinket' || it.type === 'Back') o.trinkets++;
        else if (it.type === 'Weapon') o.weapons++;
        else if (it.type === 'UpgradeComponent' && d.type === 'Rune') o.rune = true;
        else if (it.type === 'UpgradeComponent' && d.type === 'Sigil') o.sigils++;
        else if (it.type === 'Relic') o.relic = true;
      });
      st.owned = o; st.ownedLoading = false; repaint();
    }).catch(function (e) { st.ownedLoading = false; st.ownedErr = 'No pude leer tu Armería legendaria: ' + (e && e.message || '') + '.'; repaint(); });
  }
  function ownedHTML() {
    if (st.ownedLoading) return '<p class="bld-muted" role="status">Mirando tu Armería legendaria…</p>';
    if (st.ownedErr) return '<p class="bld-muted">' + esc(st.ownedErr) + '</p>';
    if (!st.owned) return '<button type="button" class="bld-btn" data-gear="owned">¿Qué ya tengo? (Armería legendaria)</button>';
    var o = st.owned, ok = function (b) { return b ? '✓' : '✗'; };
    return '<p class="bld-muted"><b>En tu Armería legendaria</b> (sirve para cualquier estadística): armadura ' + o.armor + ' piezas · abalorios ' + o.trinkets +
      ' · armas ' + o.weapons + ' · runa legendaria ' + ok(o.rune) + ' · sigilos legendarios ' + o.sigils + ' · reliquia legendaria ' + ok(o.relic) +
      '. Lo que no tengas, lo armás con piezas exóticas o ascendidas.</p>';
  }

  // ---------------------------------------------------------------- panel del Editor
  function opt(map, cur, kind) {
    return '<option value="0">—</option>' + Object.keys(map).map(function (id) {
      return '<option value="' + id + '"' + (Number(id) === Number(cur) ? ' selected' : '') + '>' + esc(nm(kind, Number(id))) + '</option>';
    }).join('');
  }
  // g = { mode, stat, rune, relic, sigils:[a,b] } · weapons = ['Greatsword', …]
  function panelHTML(g, weapons, code) {
    loadNames();
    var ae2 = '';
    try { if (root.GNBldAe2 && code) ae2 = root.GNBldAe2.encode({ code: code, mode: g.mode === 'wvw' ? 'WvW' : g.mode === 'raid' ? 'Raid' : g.mode === 'fractal' ? 'Fractal' : 'PvE', gear: toAe2Gear(g, weapons), runeId: g.rune, relicId: g.relic }); } catch (e) { ae2 = ''; }
    var sg = suggest({ mode: g.mode === 'wvw' ? 'wvw' : 'pve', damage: g.damage, roles: g.roles });
    return '<details class="bld-card bld-gear-ed"' + (g.open ? ' open' : '') + ' data-gear-box><summary><b>Equipo y código AE2</b> <small class="bld-muted">(estadísticas, runa, reliquia y sigilos)</small></summary>' +
      '<div class="bld-gear-grid">' +
      '<label><small>Modo</small><select id="bldGearmode" data-gear="mode"><option value="pve"' + (g.mode === 'pve' ? ' selected' : '') + '>PvE</option><option value="raid"' + (g.mode === 'raid' ? ' selected' : '') + '>Raids</option>' +
      '<option value="fractal"' + (g.mode === 'fractal' ? ' selected' : '') + '>Fractales</option><option value="wvw"' + (g.mode === 'wvw' ? ' selected' : '') + '>WvW</option></select></label>' +
      '<label><small>Rol</small><select id="bldGearrole" data-gear="role">' + [['dps-power', 'DPS de poder'], ['dps-condition', 'DPS de condición'], ['boon-power', 'Poder con bendiciones'], ['boon-condition', 'Condición con bendiciones'],
        ['hybrid', 'Celestial'], ['heal', 'Curación'], ['support', 'Apoyo']].map(function (x) { return '<option value="' + x[0] + '"' + (g.roleKey === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label><small>Estadísticas</small><select id="bldGearstat" data-gear="stat">' + opt(STATS, g.stat, 'stat') + '</select></label>' +
      '<label><small>Runa</small><select id="bldGearrune" data-gear="rune">' + opt(RUNES, g.rune, 'item') + '</select></label>' +
      '<label><small>Reliquia</small><select id="bldGearrelic" data-gear="relic">' + opt(RELICS, g.relic, 'item') + '</select></label>' +
      '<label><small>Sigilo 1</small><select id="bldGearsigil0" data-gear="sigil0">' + opt(SIGILS, (g.sigils || [])[0], 'item') + '</select></label>' +
      '<label><small>Sigilo 2</small><select id="bldGearsigil1" data-gear="sigil1">' + opt(SIGILS, (g.sigils || [])[1], 'item') + '</select></label></div>' +
      '<p><button type="button" class="bld-btn" data-gear="suggest">Usar la sugerencia</button> <small class="bld-muted">Sugerencia (' + esc(sg.why || '') + '): reglas simples como punto de partida, no un optimizador matemático.' +
      (g.mode !== 'wvw' ? ' Para afinar el DPS: <a href="https://snowcrows.com/" target="_blank" rel="noopener">simulador de Snow Crows ↗</a>.' : '') + '</small></p>' +
      '<p class="bld-muted"><small>Armas del código: ' + (weapons && weapons.length ? weaponSlots(weapons).map(function (w) { return esc((root.GNBldCode.WEAPONS_ES[w.type] || w.type)) + (w.two ? ' (2 manos)' : ''); }).join(' · ') : 'ninguna (elegilas arriba para que AE2 las incluya)') + '</small></p>' +
      ownedHTML() +
      (ae2 ? '<div class="bld-code"><span class="bld-cap">Código AE2 (Alter Ego)</span><code>' + esc(ae2) + '</code></div><button type="button" class="bld-btn" data-gear="copy">Copiar AE2</button>' : '') +
      '</details>';
  }
  function applyRole(g) {
    var k = g.roleKey || 'dps-power';
    g.roles = k === 'heal' ? ['heal'] : k === 'support' ? ['support'] : k.indexOf('boon') === 0 ? ['dps', 'quickness'] : ['dps'];
    g.damage = k === 'hybrid' ? 'hybrid' : /condition/.test(k) ? 'condition' : /power/.test(k) ? 'power' : null;
    return g;
  }
  function applySuggest(g) {
    applyRole(g);
    var s = suggest({ mode: g.mode === 'wvw' ? 'wvw' : 'pve', damage: g.damage, roles: g.roles });
    if (s.pvp) return g;
    g.stat = s.stat; g.rune = s.rune; g.relic = s.relic; g.sigils = s.sigils.slice();
    return g;
  }
  function fresh() { return applySuggest({ mode: 'pve', roleKey: 'dps-power', open: false }); }
  // Eventos del panel (los llama el Editor). Devuelve true si cambió algo.
  function onEvent(e, g, code, repaint) {
    var t = e.target && e.target.closest ? e.target.closest('[data-gear]') : null;
    if (!t) { if (e.type === 'toggle' || (e.target && e.target.hasAttribute && e.target.hasAttribute('data-gear-box'))) g.open = e.target.open; return false; }
    var k = t.getAttribute('data-gear');
    if (e.type === 'change') {
      var v = t.value;
      if (k === 'mode') { g.mode = v; applySuggest(g); }
      else if (k === 'role') { g.roleKey = v; applySuggest(g); }
      else if (k === 'stat') g.stat = Number(v) || 0;
      else if (k === 'rune') g.rune = Number(v) || 0;
      else if (k === 'relic') g.relic = Number(v) || 0;
      else if (k === 'sigil0' || k === 'sigil1') { g.sigils = (g.sigils || [0, 0]).slice(); g.sigils[k === 'sigil0' ? 0 : 1] = Number(v) || 0; }
      else return false;
      g.open = true; return true;
    }
    if (e.type === 'click') {
      if (k === 'suggest') { applySuggest(g); g.open = true; return true; }
      if (k === 'owned') { g.open = true; loadOwned(repaint); return false; }
      if (k === 'copy') {
        var box = t.closest('[data-gear-box]'), c = box && box.querySelector('code');
        if (c && root.GNBldShow) root.GNBldShow.copy(c.textContent).then(function (ok) { var b = root.GNBld; if (b && b.toast) b.toast(ok ? 'AE2 copiado: pegalo en Alter Ego (Build Library → Import).' : 'No pude copiar.', ok ? 'ok' : 'err'); });
        return false;
      }
    }
    return false;
  }

  var CSS = [
    '#buildsPanel .bld-gear-ed summary{cursor:pointer}',
    '#buildsPanel .bld-gear-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}',
    '#buildsPanel .bld-gear-grid small{display:block;color:var(--tx-2);font-size:.7rem;text-transform:uppercase}',
    '#buildsPanel .bld-gear-grid select{width:100%;background:var(--bg-0);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:8px;padding:5px 8px;font:inherit}',
    '#buildsPanel .bld-gear-l{list-style:none;margin:4px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2px 10px;font-size:.82rem}',
    '#buildsPanel .bld-gear-l small{color:var(--tx-2)}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head || d.getElementById('bld-gear-css')) return;
    var s = d.createElement('style'); s.id = 'bld-gear-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  var api = { version: VERSION, STATS: STATS, RUNES: RUNES, RELICS: RELICS, SIGILS: SIGILS, suggest: suggest, weaponSlots: weaponSlots, toAe2Gear: toAe2Gear,
    panelHTML: panelHTML, onEvent: onEvent, fresh: fresh, applySuggest: applySuggest, loadNames: loadNames, ensureCss: ensureCss, _state: st };
  root.GNBldGear = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
