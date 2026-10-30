// BL-082 BLD-10 (D4) y BLD-14 (D6): vigía semanal de las builds.
// - Lee la fecha del último parche de balance que declaran las páginas públicas de MetaBattle
//   («builds are up to date for the <fecha> patch») y la versión del juego (/v2/build).
// - Si hay un parche más nuevo, lo anota en assets/data/builds/watch.json: la Biblioteca marca «revisar»
//   las builds revisadas para un parche anterior.
// - Discord (D6): si existe el secreto DISCORD_WEBHOOK_URL, avisa cuando sale un parche o cambia la biblioteca.
//   El webhook nunca llega al navegador: vive solo en los secretos de GitHub Actions.
// Solo lee páginas públicas, una por vez, con un User-Agent que dice quién es.
// CUR-1: la fecha puede venir partida por etiquetas («the <b> September 15, 2026 </b> patch»): se lee sobre el texto.
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const WATCH = 'assets/data/builds/watch.json';
const CATALOG = 'assets/data/builds/catalog.json';
const PAGES = ['https://metabattle.com/wiki/WvW', 'https://metabattle.com/wiki/WvW_Roaming', 'https://metabattle.com/wiki/Build:Specter_-_Support_Specter'];
const UA = { headers: { 'User-Agent': 'LaBovedaDelGatoNegro/1.0 (+https://github.com/PabloSnchz/gw2-factory-dev; vigia semanal de builds)' } };
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

// «up to date for the September 29, 2026 patch» → '2026-09-29' (la más nueva de la página).
function parsePatch(html) {
  const t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const re = /up to date for the ([A-Z][a-z]+) (\d{1,2}), (\d{4}) patch/g;
  let m, best = '';
  while ((m = re.exec(t))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) continue;
    const iso = m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
    if (iso > best) best = iso;
  }
  return best;
}
function hash(s) { return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12); }

// prev = watch.json anterior; found = { patch, gameBuild, catalogHash, catalogLatest } → { next, events }
function nextWatch(prev, found, now) {
  prev = prev || {};
  const latest = [prev.latestPatch || '', found.patch || '', found.catalogLatest || ''].sort().pop();
  const events = [];
  if (latest && latest !== prev.latestPatch && prev.latestPatch) events.push({ kind: 'patch', patch: latest });
  if (found.catalogHash && prev.catalogHash && found.catalogHash !== prev.catalogHash) events.push({ kind: 'catalog' });
  const next = { version: 1, latestPatch: latest, gameBuild: found.gameBuild || prev.gameBuild || 0, catalogHash: found.catalogHash || prev.catalogHash || '',
    checkedAt: now, source: 'MetaBattle (parche declarado en sus páginas públicas) y /v2/build' };
  return { next, events };
}
function message(events, cat, latest) {
  const n = (cat && cat.builds || []).length;
  return events.map((e) => e.kind === 'patch'
    ? '🐈‍⬛ La Bóveda: salió un parche de balance (' + e.patch + '). Las builds revisadas para un parche anterior quedan marcadas «revisar» hasta que las revise.'
    : '🐈‍⬛ La Bóveda: la biblioteca de builds cambió (' + n + ' builds, último parche ' + latest + ').').join('\n');
}

async function main() {
  const prev = fs.existsSync(WATCH) ? JSON.parse(fs.readFileSync(WATCH, 'utf8')) : null;
  const catRaw = fs.existsSync(CATALOG) ? fs.readFileSync(CATALOG, 'utf8') : '';
  const cat = catRaw ? JSON.parse(catRaw) : null;
  let patch = '';
  for (const u of PAGES) {
    try { const r = await fetch(u, UA); if (r.ok) { const p = parsePatch(await r.text()); if (p > patch) patch = p; } } catch (_) {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  let gameBuild = 0;
  try { const r = await fetch('https://api.guildwars2.com/v2/build'); if (r.ok) gameBuild = (await r.json()).id || 0; } catch (_) {}
  const { next, events } = nextWatch(prev, { patch, gameBuild, catalogHash: catRaw ? hash(catRaw) : '', catalogLatest: cat && cat.patch && cat.patch.latest }, new Date().toISOString());
  const changed = !prev || prev.latestPatch !== next.latestPatch || prev.catalogHash !== next.catalogHash || prev.gameBuild !== next.gameBuild;
  if (changed) fs.writeFileSync(WATCH, JSON.stringify(next, null, 2) + '\n');
  console.log('vigía: parche declarado ' + (patch || '—') + ' · último ' + next.latestPatch + ' · juego ' + gameBuild + ' · eventos ' + events.length + (changed ? ' · watch.json actualizado' : ''));
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (hook && events.length) {
    try {
      const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message(events, cat, next.latestPatch), allowed_mentions: { parse: [] } }) });
      console.log('Discord: ' + r.status);
    } catch (e) { console.log('Discord: no se pudo avisar (' + e.message + ')'); }
  } else if (events.length) console.log('Discord: sin secreto DISCORD_WEBHOOK_URL, no aviso');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
}

module.exports = { parsePatch, nextWatch, message, hash };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
