// BL-084 EQ-1: lee el EQUIPO de una ficha de Snow Crows, solo como datos (ids oficiales de la API de Guild Wars 2).
// Snow Crows marca cada pieza con GW2 Armory: data-armory-ids (objeto), data-armory-<id>-stat (estadística, /v2/itemstats),
// data-armory-<id>-upgrades (runa o sellos). No copia textos: los nombres, íconos y descripciones salen de la API en castellano.
// Forma (RUN-227): tabla 1 = armadura (6 filas; en PvP, una fila con la runa); tabla 2 = abalorios + reliquia (en PvP: amuleto
// de /v2/pvp/amulets + reliquia); tabla 3 = «Primary/Secondary Weapon Set» (fila = arma, mano y sellos) y «Other Items»
// (infusión ×N, comida, utilidad, núcleo de robot de jade, enriquecimiento).
// Resultado compacto, una línea por build en el catálogo:
//   { armor: [[objeto, estadística]×6], rune, trinkets: [[objeto, estadística]×6], relic, amulet,
//     weapons: [[juego 1|2|3 (3 = acuática), 'm'|'o' (mano), objeto, estadística, [sellos]]],
//     infusion: [objeto, cantidad], food, utility, jade, enrich }
// Si las runas no son todas iguales, cada pieza de armadura lleva la suya como tercer valor y no hay «rune».
'use strict';

const strip = (h) => String(h || '').replace(/<!--[\s\S]*?-->/g, '');
const words = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function sectionOf(t, cur) {
  t = t.toLowerCase();
  if (/primary weapon/.test(t)) return 'w1';
  if (/secondary weapon/.test(t)) return 'w2';
  if (/aquatic/.test(t)) return 'wa';
  if (/other items/.test(t)) return 'other';
  return cur;
}

function parseGear(html) {
  html = strip(html);
  const a = html.indexOf('<table'), b = html.indexOf('data-armory-embed="specializations"');
  if (a < 0) return null;
  const seg = html.slice(a, b > a ? b : undefined);
  const g = { armor: [], runes: [], trinkets: [], weapons: [] };
  let table = -1, sec = '', m;
  const re = /<table\b|<th\b[^>]*>([\s\S]*?)<\/th>|<tr\b([\s\S]*?)<\/tr>/g;
  while ((m = re.exec(seg))) {
    if (m[0].indexOf('<table') === 0) { table++; sec = table === 0 ? 'armor' : table === 1 ? 'trinkets' : ''; continue; }
    if (m[1] != null) { sec = sectionOf(words(m[1]), sec); continue; }
    const r = m[2].replace(/^[^>]*>/, '');
    const idm = r.match(/data-armory-ids="(\d+)"/);
    if (!idm) { if (/<th\b/.test(r)) sec = sectionOf(words(r), sec); continue; }
    const item = Number(idm[1]);
    const st = r.match(new RegExp('data-armory-' + item + '-stat="(\\d+)"'));
    const up = r.match(new RegExp('data-armory-' + item + '-upgrades="([\\d,]*)"'));
    const stat = st ? Number(st[1]) : 0;
    const ups = up && up[1] ? up[1].split(',').map(Number).filter((x) => x > 0) : [];
    const embed = (r.match(/data-armory-embed="([a-z]+)"/) || [])[1] || '';
    const label = words((r.match(/<span class="text-neutral-400[^"]*">([\s\S]*?)<\/span>/) || [])[1] || '');
    const tx = words(r);
    if (sec === 'armor') {
      if (st || ups.length) { g.armor.push([item, stat]); g.runes.push(ups[0] || 0); } else if (/rune/i.test(label || tx)) g.rune = item;
    } else if (sec === 'trinkets') {
      if (embed === 'amulets') g.amulet = item;
      else if (!st && /relic/i.test(label || tx)) g.relic = item;
      else if (st) g.trinkets.push([item, stat]);
    } else if (sec === 'w1' || sec === 'w2' || sec === 'wa') {
      g.weapons.push([sec === 'w1' ? 1 : sec === 'w2' ? 2 : 3, /off hand/i.test(label) ? 'o' : 'm', item, stat, ups]);
    } else if (sec === 'other') {
      const k = tx.toLowerCase();
      if (/^infusion/.test(k)) g.infusion = [item, Number((k.match(/x\s*(\d+)/) || [])[1]) || 1];
      else if (/^food/.test(k)) g.food = item;
      else if (/^utility/.test(k)) g.utility = item;
      else if (/^jade bot/.test(k)) g.jade = item;
      else if (/^enrichment/.test(k)) g.enrich = item;
    }
  }
  // runas: una sola si todas son iguales; si no, cada pieza con la suya
  const same = g.runes.length && g.runes.every((x) => x === g.runes[0]);
  if (same && g.runes[0]) g.rune = g.runes[0];
  else if (!same && g.runes.length) g.armor = g.armor.map((p, i) => p.concat([g.runes[i] || 0]));
  if (g.armor.length > 6 || g.trinkets.length > 6 || g.weapons.length > 6) return null;
  if (!g.armor.length && !g.trinkets.length && !g.weapons.length && !g.amulet) return null;
  const out = {};
  ['armor', 'rune', 'trinkets', 'relic', 'amulet', 'weapons', 'infusion', 'food', 'utility', 'jade', 'enrich'].forEach((k) => {
    const v = g[k];
    if (v == null || (Array.isArray(v) && !v.length)) return;
    out[k] = v;
  });
  return out;
}

// ¿El equipo leído tiene sentido? (ids enteros positivos; 6 piezas o ninguna, como en PvP). Lista vacía = bien.
function gearProblems(gear) {
  const p = [];
  if (!gear) return ['sin equipo'];
  const pos = (n) => Number.isInteger(n) && n > 0;
  if (gear.armor && gear.armor.length !== 6) p.push('armadura con ' + gear.armor.length + ' piezas');
  if (gear.trinkets && gear.trinkets.length !== 6) p.push('abalorios con ' + gear.trinkets.length + ' piezas');
  if (!gear.armor && !gear.amulet) p.push('sin armadura ni amuleto');
  (gear.armor || []).concat(gear.trinkets || []).forEach((x) => { if (!pos(x[0]) || !Number.isInteger(x[1])) p.push('pieza inválida'); });
  (gear.weapons || []).forEach((w) => { if (!pos(w[2]) || !(w[4] || []).every(pos)) p.push('arma inválida'); });
  if (!gear.weapons || !gear.weapons.length) p.push('sin armas');
  return p;
}

module.exports = { parseGear, gearProblems };
