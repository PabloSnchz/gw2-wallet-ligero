// BL-082 CUR-1: re-curación semanal y autónoma de la Biblioteca de builds (DEC-041: corre sola en DEV y en PRD).
// 1) Bench: relee snowcrows.com/en/benchmarks y rehace assets/data/builds/bench.json (DPS máx/promedio, dificultad, log).
// 2) Catálogo: relee la página de origen de cada build de assets/data/builds/catalog.json, una por vez y con pausa:
//    - Snow Crows: código de plantilla (botón copiar) y fecha «Updated».
//    - MetaBattle: código, parche que la página declara y fecha de última edición.
//    Si la fuente cambió el código y el código es válido para la misma profesión y élite, lo actualiza (y las armas).
//    Una build pasa al último parche solo si su fuente se actualizó después de ese parche: si no, sigue «para revisar».
//    Nunca borra builds ni inventa datos: lo que no puede resolver solo queda en catalog.review para que lo mire yo.
// Seguridad: solo páginas públicas (robots «Allow»), User-Agent que dice quién es, y frenos si la fuente cambia de forma
// (bench con muchas menos filas, o demasiadas páginas sin respuesta): en ese caso no escribe nada.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'js', 'bld-code.js'));

const DIR = 'assets/data/builds/';
const FILES = { catalog: DIR + 'catalog.json', bench: DIR + 'bench.json', watch: DIR + 'watch.json' };
const BENCH_URL = 'https://snowcrows.com/en/benchmarks';
const UA = { headers: { 'User-Agent': 'LaBovedaDelGatoNegro/1.0 (+https://github.com/PabloSnchz/gw2-factory-dev; curacion semanal de builds)' } };
const PAUSE = 1200;
const PROFS = ['', 'guardian', 'warrior', 'engineer', 'ranger', 'thief', 'elementalist', 'mesmer', 'necromancer', 'revenant'];
const ELITES = { druid: 5, daredevil: 7, berserker: 18, dragonhunter: 27, reaper: 34, chronomancer: 40, scrapper: 43, tempest: 48, herald: 52,
  soulbeast: 55, weaver: 56, holosmith: 57, deadeye: 58, mirage: 59, scourge: 60, spellbreaker: 61, firebrand: 62, renegade: 63, harbinger: 64,
  willbender: 65, virtuoso: 66, catalyst: 67, bladesworn: 68, vindicator: 69, mechanist: 70, specter: 71, untamed: 72, troubadour: 73, paragon: 74,
  amalgam: 75, ritualist: 76, antiquary: 77, galeshot: 78, conduit: 79, evoker: 80, luminary: 81 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const text = (h) => String(h || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const num = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0;
function iso(y, mon, d) {
  const m = MONTHS.indexOf(String(mon || '').slice(0, 3).toLowerCase()) + 1;
  if (!m || !(d >= 1 && d <= 31) || !(y >= 2012 && y <= 2100)) return '';
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
// «Apr 19, 2026», «September 15, 2026» o «23 September 2026» → '2026-04-19'
function toIso(s) {
  s = String(s || '').trim();
  let m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) return iso(+m[3], m[1], +m[2]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  return m ? iso(+m[3], m[2], +m[1]) : '';
}
const maxIso = (...a) => a.filter(Boolean).sort().pop() || '';

// ---------------------------------------------------------------- bench de Snow Crows
// Cada fila: rótulo de élite, <a href="/builds/raids/<prof>/<slug>" class="font-medium line-clamp-1">, puntos de dificultad
// naranjas, DPS máximo tras fa-angle-double-up, promedio tras fa-tilde y log opcional en dps.report.
function parseBench(html) {
  html = String(html || '');
  const re = /<a href="(?:https:\/\/snowcrows\.com)?(?:\/en)?\/builds\/raids\/([a-z]+)\/([a-z0-9-]+)"\s+class="font-medium line-clamp-1"/g;
  const hits = []; let m;
  while ((m = re.exec(html))) hits.push({ i: m.index, prof: m[1], slug: m[2] });
  const rows = [], seen = {};
  hits.forEach((h, k) => {
    const seg = html.slice(h.i, k + 1 < hits.length ? hits[k + 1].i : h.i + 6000);
    const before = html.slice(Math.max(0, h.i - 600), h.i);
    const prof = PROFS.indexOf(h.prof);
    const max = num((seg.match(/fa-angle-double-up[^>]*>\s*<\/i>\s*([\d,.]+)/) || [])[1]);
    const avg = num((seg.match(/fa-tilde[^>]*>\s*<\/i>\s*([\d,.]+)/) || [])[1]);
    if (prof < 1 || !max || seen[h.prof + '/' + h.slug]) return;
    seen[h.prof + '/' + h.slug] = 1;
    const labels = [...before.matchAll(/font-bold text-[a-z]+">\s*([A-Za-z ]+?)\s*<\/div>/g)];
    const label = labels.length ? labels[labels.length - 1][1].toLowerCase() : '';
    const words = h.slug.split('-');
    const elite = ELITES[label] || words.map((w) => ELITES[w]).find(Boolean) || 0;
    const damage = words[0] === 'power' || words[0] === 'condition' ? words[0] : 'hybrid';
    const boon = ['quickness', 'alacrity', 'boon'].find((b) => words.indexOf(b) >= 0) || '';
    const diffSpan = (seg.match(/data-tippy-content="Build Difficulty"[\s\S]*?<\/span>/) || [''])[0];
    const difficulty = (diffSpan.match(/text-orange-400/g) || []).length;
    const log = (seg.match(/href="https:\/\/dps\.report\/([A-Za-z0-9_-]+)"/) || [])[1] || '';
    rows.push([h.prof + '/' + h.slug, prof, elite, damage, boon, difficulty, max, avg || max, log]);
  });
  return rows.sort((a, b) => b[6] - a[6] || (a[0] < b[0] ? -1 : 1));
}
// Freno: si la página cambió de forma y trae muchas menos filas, no se pisa el bench bueno.
function mergeBench(prev, rows, today) {
  const before = (prev && prev.rows) || [];
  if (rows.length < 20 || rows.length < before.length * 0.6) return { next: prev, changed: false, refused: 'bench con ' + rows.length + ' filas (antes ' + before.length + '): no lo pisé' };
  const changed = JSON.stringify(before) !== JSON.stringify(rows);
  if (!changed) return { next: prev, changed: false };
  const next = Object.assign({}, prev || {}, { version: 1, fetched: today, rows });
  if (!next.source) next.source = { name: 'Snow Crows', url: BENCH_URL };
  if (!next.fields) next.fields = ['path', 'prof', 'elite', 'damage', 'boon', 'difficulty', 'max', 'avg', 'log'];
  return { next, changed: true };
}
function benchText(b) {
  const head = Object.assign({}, b); delete head.rows;
  const s = JSON.stringify(head);
  return s.slice(0, -1) + ',"rows":[\n' + b.rows.map((r) => JSON.stringify(r)).join(',\n') + ']}\n';
}
// Mismo formato que la curación a mano: cabecera en una línea y una build por línea (diffs legibles).
function catalogText(c) {
  const head = Object.assign({}, c); delete head.builds;
  const s = JSON.stringify(head);
  return s.slice(0, -1) + ',\n"builds":[\n' + (c.builds || []).map((b) => JSON.stringify(b)).join(',\n') + '\n]}\n';
}

// ---------------------------------------------------------------- páginas de origen
function codesIn(html) {
  return [...new Set([...String(html || '').matchAll(/\[&(?:amp;)?(DQ[A-Za-z0-9+/]{40,}={0,2})\]/g)].map((x) => '[&' + x[1] + ']'))];
}
function parseSc(html) {
  const wt = String(html || '').match(/writeText\('\[&(?:amp;)?(DQ[A-Za-z0-9+/]+={0,2})\]'\)/);
  const up = text(html).match(/Updated\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},\s+\d{4})/);
  return { codes: wt ? ['[&' + wt[1] + ']'] : codesIn(html), updated: up ? toIso(up[1]) : '', patch: '' };
}
function parseMb(html) {
  const t = text(html);
  let patch = '';
  for (const m of t.matchAll(/up to date for the\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+patch/g)) patch = maxIso(patch, toIso(m[1]));
  const ed = t.match(/last edited on\s+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/);
  return { codes: codesIn(html), updated: ed ? toIso(ed[1]) : '', patch };
}
function weaponsOf(build) {
  const out = [];
  (build.weapons || []).forEach((w) => { const n = C.WEAPONS[w]; if (n && out.indexOf(n) < 0) out.push(n); });
  return out;
}
const norm = (code) => { const r = C.parse(code); return r.ok ? r.code : ''; };

// b = build del catálogo; page = { status, codes, updated, patch }; ctx = { latest, today }
// → { build, changes: [..], issue: '' }
function curateBuild(b, page, ctx) {
  const out = Object.assign({}, b), changes = [];
  if (!page || page.status === 'error') return { build: b, changes, issue: '' };
  if (page.status === 404) return { build: b, changes, issue: 'la página de origen ya no existe (404)' };
  let issue = '';
  const mine = norm(b.code);
  const valid = page.codes.map((c) => ({ c, r: C.parse(c) })).filter((x) => x.r.ok && x.r.build.profession === b.prof && x.r.build.specs[2].id === b.elite);
  if (!page.codes.length) issue = 'la página no muestra código';
  else if (!valid.some((x) => x.r.code === mine)) {
    if (valid.length === 1) {
      out.code = page.codes[page.codes.indexOf(valid[0].c)];
      const ws = weaponsOf(valid[0].r.build);
      if (ws.length) out.weapons = ws;
      changes.push('código');
    } else issue = valid.length ? 'la página trae ' + valid.length + ' códigos distintos para esta élite' : 'el código de la página no es de esta profesión y élite';
  }
  if (page.updated && page.updated > (b.sourceUpdated || '')) { out.sourceUpdated = page.updated; changes.push('fecha de la fuente'); }
  const declared = page.patch || (out.sourceUpdated >= ctx.latest ? ctx.latest : '');
  if (declared && declared > (b.patch || '') && declared <= ctx.latest) { out.patch = declared; changes.push('parche ' + declared); }
  if (!changes.length) return { build: b, changes, issue };
  out.reviewed = ctx.today;
  return { build: out, changes, issue };
}

// results: { [id]: page } → { next, changed, log, refused }
function curateCatalog(cat, results, ctx) {
  const builds = cat.builds || [];
  const answered = builds.filter((b) => results[b.id] && results[b.id].status !== 'error').length;
  if (builds.length && answered < builds.length * 0.7) return { next: cat, changed: false, log: [], refused: 'respondieron ' + answered + ' de ' + builds.length + ' páginas: no toqué el catálogo' };
  const log = [], review = [];
  const next = Object.assign({}, cat, { builds: builds.map((b) => {
    const r = curateBuild(b, results[b.id], ctx);
    if (r.changes.length) log.push(b.id + ': ' + r.changes.join(', '));
    if (r.issue) review.push({ id: b.id, issue: r.issue, since: ((cat.review || []).find((x) => x.id === b.id && x.issue === r.issue) || {}).since || ctx.today });
    return r.build;
  }) });
  const latest = maxIso(cat.patch && cat.patch.latest, ctx.latest);
  if (latest !== (cat.patch && cat.patch.latest)) next.patch = Object.assign({}, cat.patch, { latest });
  if (review.length) next.review = review; else delete next.review;
  const changed = JSON.stringify(next) !== JSON.stringify(cat);
  if (changed) next.curated = ctx.today;
  return { next, changed, log, review };
}

// ---------------------------------------------------------------- red
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchPage(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, UA)); clearTimeout(t);
      if (r.ok) return { status: 200, html: await r.text() };
      if (r.status === 404 || r.status === 410) return { status: 404, html: '' };
    } catch (_) {}
    await sleep(3000);
  }
  return { status: 'error', html: '' };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
  // CURATE_DRY=1: mira y cuenta, no escribe. CURATE_SAMPLE=n: solo n builds repartidas (prueba rápida en diagnóstico).
  const dry = process.env.CURATE_DRY === '1', sample = Number(process.env.CURATE_SAMPLE) || 0;
  let cat = read(FILES.catalog);
  const bench = read(FILES.bench), watch = read(FILES.watch) || {};
  if (cat && sample) { const all = cat.builds || [], k = Math.max(1, Math.floor(all.length / sample)); cat = Object.assign({}, cat, { builds: all.filter((_, i) => i % k === 0).slice(0, sample) }); }
  if (dry) fs.writeFileSync = (f) => console.log('(prueba: no escribo ' + f + ')');
  const ctx = { today, latest: maxIso(watch.latestPatch, cat && cat.patch && cat.patch.latest) };
  const summary = ['## Curación semanal de builds (' + today + ')', '', '- Último parche conocido: ' + (ctx.latest || '—')];
  let changed = false;

  const bp = await fetchPage(BENCH_URL);
  const rows = bp.status === 200 ? parseBench(bp.html) : [];
  const mb = mergeBench(bench, rows, today);
  const old = new Set(((bench && bench.rows) || []).map((x) => JSON.stringify(x)));
  const diff = rows.filter((x) => !old.has(JSON.stringify(x))).length;
  summary.push('- Bench: ' + rows.length + ' filas leídas · ' + (mb.refused || (mb.changed ? 'actualizado (' + diff + ' filas nuevas o distintas)' : 'sin cambios')));
  if (mb.changed) { fs.writeFileSync(FILES.bench, benchText(mb.next)); changed = true; }

  if (cat) {
    const results = {};
    for (const b of cat.builds || []) {
      const url = b.source && b.source.url;
      const kind = /snowcrows\.com/.test(url || '') ? 'sc' : /metabattle\.com/.test(url || '') ? 'mb' : '';
      if (!kind) continue;
      await sleep(PAUSE);
      const p = await fetchPage(url);
      results[b.id] = p.status === 200 ? Object.assign({ status: 200 }, kind === 'sc' ? parseSc(p.html) : parseMb(p.html)) : { status: p.status };
    }
    const cc = curateCatalog(cat, results, ctx);
    summary.push('- Catálogo: ' + Object.keys(results).length + ' páginas · ' + (cc.refused || (cc.changed ? cc.log.length + ' builds actualizadas' : 'sin cambios')));
    (cc.log || []).forEach((l) => summary.push('  - ' + l));
    (cc.review || []).forEach((r) => summary.push('  - para revisar a mano: ' + r.id + ' — ' + r.issue));
    if (cc.changed) { fs.writeFileSync(FILES.catalog, catalogText(cc.next)); changed = true; }
  }
  console.log(summary.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
}

module.exports = { toIso, parseBench, mergeBench, benchText, catalogText, parseSc, parseMb, curateBuild, curateCatalog, ELITES };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
