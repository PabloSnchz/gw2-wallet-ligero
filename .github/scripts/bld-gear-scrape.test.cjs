// BL-084 EQ-1: lectura del equipo de las fichas de Snow Crows (.github/scripts/bld-gear-scrape.cjs).
// Sin red: HTML con la forma real de las fichas (RUN-227: raids, PvP, WvW y mundo abierto).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./bld-gear-scrape.cjs');

// Fila como la de Snow Crows: ícono con GW2 Armory + nombre con la ranura en gris.
function piece(id, stat, ups, name, slot) {
  const u = ups ? ups.join(',') : '';
  return '<tr> <td> <div data-armory-embed="items"' + (stat != null ? ' data-armory-' + id + '-stat="' + stat + '"' : '') + ' data-armory-ids="' + id + '"' +
    (stat != null ? ' data-armory-' + id + '-upgrades' + (u ? '="' + u + '"' : '=') + ' data-armory-' + id + '-upgrade-count=\'{"' + id + '": 1}\'' : '') + '></div> </td> <td> ' +
    '<p class="mb-1">' + name + '<span class="text-neutral-400 text-sm ml-2">' + slot + '</span></p> ' +
    (ups || []).map((x) => '<div data-armory-embed="items" data-armory-ids="' + x + '" data-armory-size="20" data-armory-inline-text="wiki"></div>').join('') +
    ' </td> </tr> <!--[if ENDBLOCK]><![endif]-->';
}
function other(id, label) {
  return '<tr> <td> <div data-armory-embed="items" data-armory-ids="' + id + '"></div> </td> <td> <p class="mb-1">' + label + '</p>' +
    '<div data-armory-embed="items" data-armory-ids="' + id + '" data-armory-size="20" data-armory-inline-text="wiki"></div> </td> </tr>';
}
const ARMOR = [48087, 48089, 48085, 48086, 48088, 48084], SLOTS = ['Helm', 'Shoulders', 'Coat', 'Gloves', 'Leggings', 'Boots'];
const TRINK = [79837, 79745, 79444, 81169, 79710, 81167], TSLOTS = ['Backpiece', 'Accessory', 'Accessory', 'Amulet', 'Ring', 'Ring'];
const SPECS = '<div data-armory-embed="specializations" data-armory-ids="6" data-armory-6-traits="1882,482,1947"></div>';

function page(o) {
  return '<main><h3>Gear</h3>' +
    '<table> <thead> <th>Item</th><th>Stat</th> </thead> <tbody>' + o.armor + '</tbody> </table>' +
    '<table> <thead> <th>Item</th><th>Stat</th> </thead> <tbody>' + o.trinkets + '</tbody> </table>' +
    '<table> <thead> <th colspan="2">Primary Weapon Set</th> </thead> <tbody>' + o.w1 + '</tbody>' +
    (o.w2 ? '<thead> <th colspan="2">Secondary Weapon Set</th> </thead> <tbody>' + o.w2 + '</tbody>' : '') +
    (o.other ? '<thead> <th colspan="2">Other Items</th> </thead> <tbody>' + o.other + '</tbody>' : '') + '</table>' +
    '<h3>Traits &amp; Skills</h3>' + SPECS + '<table><tr><td><div data-armory-embed="items" data-armory-ids="1"></div></td></tr></table></main>';
}

test('raids: armadura con una runa, abalorios, reliquia, rifle con dos sellos y otros', () => {
  const html = page({
    armor: ARMOR.map((id, i) => piece(id, 1077, [74978], 'Berserker&#039;s', SLOTS[i])).join(''),
    trinkets: TRINK.map((id, i) => piece(id, 1077, null, 'Berserker&#039;s', TSLOTS[i])).join('') +
      '<tr> <td> <div data-armory-embed="items" data-armory-ids="100916"></div> </td> <td> <p class="mb-1">Relic of the Thief<span class="text-neutral-400 text-sm ml-2">Relic</span></p> </td> </tr>',
    w1: piece(46768, 1077, [24615, 24554], 'Berserker&#039;s Rifle', 'Main Hand'),
    other: other(39620, 'Infusion x18') + other(91805, 'Food') + other(43451, 'Utility') + other(96613, 'Jade Bot Core') + other(91401, 'Enrichment'),
  });
  const g = G.parseGear(html);
  assert.deepEqual(g, {
    armor: ARMOR.map((id) => [id, 1077]), rune: 74978, trinkets: TRINK.map((id) => [id, 1077]), relic: 100916,
    weapons: [[1, 'm', 46768, 1077, [24615, 24554]]], infusion: [39620, 18], food: 91805, utility: 43451, jade: 96613, enrich: 91401,
  });
  assert.deepEqual(G.gearProblems(g), []);
  assert.equal(JSON.stringify(g).length < 420, true, 'cabe en una línea corta del catálogo');
});

test('WvW / mundo abierto: estadísticas mezcladas, dos juegos de armas con mano principal y secundaria', () => {
  const html = page({
    armor: ARMOR.map((id, i) => piece(id, i === 4 ? 1697 : 1077, [24836], 'X', SLOTS[i])).join(''),
    trinkets: TRINK.map((id, i) => piece(id, 1697, null, 'Dragon&#039;s', TSLOTS[i])).join('') +
      '<tr> <td> <div data-armory-embed="items" data-armory-ids="109942"></div> </td> <td> <p class="mb-1">Relic of the Last Tyrant<span class="text-neutral-400 text-sm ml-2">Relic</span></p> </td> </tr>',
    w1: piece(46766, 1077, [24615], 'Berserker&#039;s Mace', 'Main Hand') + piece(46759, 1077, [84505], 'Berserker&#039;s Axe', 'Off Hand'),
    w2: piece(46760, 1077, [24615], 'Berserker&#039;s Dagger', 'Main Hand') + piece(46766, 1077, [84505], 'Berserker&#039;s Mace', 'Off Hand'),
    other: other(91734, 'Food'),
  });
  const g = G.parseGear(html);
  assert.equal(g.armor[4][1], 1697);
  assert.equal(g.rune, 24836);
  assert.deepEqual(g.weapons, [[1, 'm', 46766, 1077, [24615]], [1, 'o', 46759, 1077, [84505]], [2, 'm', 46760, 1077, [24615]], [2, 'o', 46766, 1077, [84505]]]);
  assert.equal(g.relic, 109942);
  assert.equal(g.food, 91734);
  assert.equal(g.infusion, undefined);
});

test('runas distintas: cada pieza lleva la suya', () => {
  const html = page({
    armor: ARMOR.map((id, i) => piece(id, 1077, [i < 4 ? 24836 : 24723], 'X', SLOTS[i])).join(''),
    trinkets: TRINK.map((id, i) => piece(id, 1077, null, 'X', TSLOTS[i])).join(''),
    w1: piece(46768, 1077, [24615, 24554], 'X', 'Main Hand'),
  });
  const g = G.parseGear(html);
  assert.equal(g.rune, undefined);
  assert.deepEqual(g.armor.map((x) => x[2]), [24836, 24836, 24836, 24836, 24723, 24723]);
});

test('PvP: runa sola, amuleto de PvP, reliquia y armas sin estadística', () => {
  const html = page({
    armor: '<tr> <td> <div data-armory-embed="items" data-armory-ids="21210"></div> </td> <td> <p class="mb-1">Superior Rune of the Warrior (PvP)<span class="text-neutral-400 text-sm ml-2">Rune</span></p> </td> </tr>',
    trinkets: '<tr> <td> <div data-armory-embed="amulets" data-armory-ids="8"></div> </td> <td> <p class="mb-1">Berserker&#039;s Amulet</p> </td> </tr>' +
      '<tr> <td> <div data-armory-embed="items" data-armory-ids="100090"></div> </td> <td> <p class="mb-1">Relic of the Dragonhunter<span class="text-neutral-400 text-sm ml-2">Relic</span></p> </td> </tr>',
    w1: piece(31283, 0, [21152, 81254], 'Longbow', 'Main Hand'),
    w2: piece(31292, 0, [21152], 'Sword', 'Main Hand') + piece(31288, 0, [81254], 'Shield', 'Off Hand'),
  });
  const g = G.parseGear(html);
  assert.deepEqual(g, { rune: 21210, relic: 100090, amulet: 8,
    weapons: [[1, 'm', 31283, 0, [21152, 81254]], [2, 'm', 31292, 0, [21152]], [2, 'o', 31288, 0, [81254]]] });
  assert.deepEqual(G.gearProblems(g), []);
});

test('sin tablas o con la página cambiada: null y los problemas se dicen', () => {
  assert.equal(G.parseGear(''), null);
  assert.equal(G.parseGear('<main><p>Nada</p></main>'), null);
  assert.equal(G.parseGear('<table><tr><td>sin datos</td></tr></table>'), null);
  assert.deepEqual(G.gearProblems(null), ['sin equipo']);
  const raro = G.gearProblems({ armor: [[1, 1077]], trinkets: [], weapons: [[1, 'm', -3, 0, ['x']]] });
  assert.ok(raro.some((p) => /armadura con 1/.test(p)));
  assert.ok(raro.some((p) => /arma inválida/.test(p)));
  assert.ok(G.gearProblems({ armor: ARMOR.map((x) => [x, 1]), trinkets: TRINK.map((x) => [x, 1]) }).includes('sin armas'));
});

test('no se confunde con las tablas de habilidades que vienen después de las especializaciones', () => {
  const html = page({
    armor: ARMOR.map((id, i) => piece(id, 1077, [74978], 'X', SLOTS[i])).join(''),
    trinkets: TRINK.map((id, i) => piece(id, 1077, null, 'X', TSLOTS[i])).join(''),
    w1: piece(46768, 1077, [24615], 'X', 'Main Hand'),
  });
  const g = G.parseGear(html);
  assert.equal(g.weapons.length, 1, 'la tabla de después de las especializaciones no cuenta');
});
