// BL-082 CUR-1: re-curación semanal (.github/scripts/bld-curate.cjs). Sin red: HTML con la forma real de las fuentes (RUN-215).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('./bld-curate.cjs');

const DH_OLD = '[&DQEqOhA/Gzm8EgAAihIAAEgBAAD+AAAAtRIAAAAAAAAAAAAAAAAAAAAAAAA=]';
const DH_NEW = '[&DQEQPy41Gzm8EgAA/hIAAAQBAACKEgAANwEAAAAAAAAAAAAAAAAAAAAAAAADIwBaAFcAAA==]'; // Longbow, Sword, Shield
const DH_ALT = '[&DQEqOhA+GysDAQAA/gAAAIoSAAD+EgAANwEAAAAAAAAAAAAAAAAAAAAAAAA=]';
const WB = '[&DQEqORA+QS84AQMBBAE2AUcBBAHYGi0BNwE3AQAAAAAAAAAAAAAAAAAAAAADMgBaADEAAA==]'; // Subyugador (65)

function row(o) {
  const dots = Array.from({ length: 5 }, (_, i) => '<i class="fa-solid fa-circle-small text-xs ml-1 ' + (i < o.diff ? 'text-orange-400' : 'text-neutral-600') + '"></i>').join('<!--[if ENDBLOCK]><![endif]-->');
  return '<div class="flex-grow"><div class="md:flex-grow"><div class="uppercase text-xs font-bold text-' + o.prof + '"> ' + o.label + ' </div>' +
    '<a href="/builds/raids/' + o.prof + '/' + o.slug + '" class="font-medium line-clamp-1"> Nombre <!--[if BLOCK]><![endif]--></a>' +
    '<div class="text-xs"><span class="mr-1">Pistol &amp; Warhorn</span><span class="inline-block" data-tippy-content="Build Difficulty"> ' + dots + ' </span></div></div>' +
    '<div><div class="bg-neutral-800 rounded-full mt-2 text-xs"><div class="bg-' + o.prof + ' rounded-full px-2 py-px" style="width: 98%"> <i class="fas fa-angle-double-up z-20 isolate relative top-px"></i> ' + o.max + ' </div></div>' +
    '<div class="text-xs mt-1 text-neutral-300 px-2"> <i class="fas fa-tilde z-20 isolate relative top-px"></i> ' + o.avg + ' </div></div></div>' +
    '<div class="flex-none w-16 text-right">' + (o.log ? '<a target="_blank" href="https://dps.report/' + o.log + '" class="ml-4"><i class="fa-solid fa-file-chart-column"></i></a>' : '') + '</div>';
}

test('fechas de las fuentes a ISO', () => {
  assert.equal(K.toIso('Apr 19, 2026'), '2026-04-19');
  assert.equal(K.toIso('September 15, 2026'), '2026-09-15');
  assert.equal(K.toIso('23 September 2026'), '2026-09-23');
  assert.equal(K.toIso('Smarch 3, 2026'), '');
});

test('bench: lee élite, dificultad, DPS máx/prom, log, daño y bendición; ordena por DPS', () => {
  const html = '<main>' + row({ prof: 'elementalist', label: 'Weaver', slug: 'condition-weaver-pistol-warhorn', diff: 3, max: '45,711', avg: '45,300', log: 'Yt2F-20260805-122746_golem' }) +
    row({ prof: 'thief', label: 'Thief', slug: 'condition-thief-axe-dagger-only', diff: 2, max: '43,023', avg: '42,700', log: '' }) +
    row({ prof: 'mesmer', label: 'Chronomancer', slug: 'power-boon-chronomancer-spear-dagger-sword', diff: 3, max: '35,435', avg: '35,000', log: 'eRsi-1' }) +
    row({ prof: 'elementalist', label: 'Tempest', slug: 'inferno-tempest-scepter-dagger', diff: 2, max: '46,000', avg: '41,100', log: '' }) + '</main>';
  const rows = K.parseBench(html);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], ['elementalist/inferno-tempest-scepter-dagger', 6, 48, 'hybrid', '', 2, 46000, 41100, '']);
  assert.deepEqual(rows[1], ['elementalist/condition-weaver-pistol-warhorn', 6, 56, 'condition', '', 3, 45711, 45300, 'Yt2F-20260805-122746_golem']);
  assert.deepEqual(rows[2], ['thief/condition-thief-axe-dagger-only', 5, 0, 'condition', '', 2, 43023, 42700, '']);
  assert.deepEqual(rows[3].slice(1, 6), [7, 40, 'power', 'boon', 3]);
});

test('bench: no pisa el bueno si la página cambió de forma; sin cambios no reescribe', () => {
  const prev = { version: 1, fetched: '2026-10-29', rows: Array.from({ length: 100 }, (_, i) => ['a/b' + i, 1, 27, 'power', '', 2, 40000 - i, 39000, '']) };
  assert.match(K.mergeBench(prev, prev.rows.slice(0, 50), '2026-11-02').refused, /50 filas/);
  assert.equal(K.mergeBench(prev, prev.rows.slice(), '2026-11-02').changed, false);
  const r = K.mergeBench(prev, prev.rows.slice(0, 99), '2026-11-02');
  assert.equal(r.changed, true);
  assert.equal(r.next.fetched, '2026-11-02');
  const txt = K.benchText(r.next);
  assert.deepEqual(JSON.parse(txt).rows.length, 99);
  assert.match(txt, /"rows":\[\n\["a\/b0"/);
});

test('fichas: Snow Crows (botón copiar + Updated) y MetaBattle (parche declarado + última edición)', () => {
  const sc = K.parseSc('<button x-on:click="navigator.clipboard.writeText(\'[&amp;' + DH_NEW.slice(2, -1) + ']\')">Copy</button> Published Feb 11, 2025 <span>Updated</span> Apr 19, 2026 Raids');
  assert.deepEqual(sc, { codes: [DH_NEW], updated: '2026-04-19', patch: '' });
  const mb = K.parseMb('<p>Builds are up to date for the <b> September 15, 2026 </b> patch.</p><code>' + WB + '</code><code>' + WB + '</code><li>This page was last edited on 23 September 2026, at 18:57.</li>');
  assert.deepEqual(mb, { codes: [WB], updated: '2026-09-23', patch: '2026-09-15' });
});

const DH = { id: 'sc-dh', prof: 1, elite: 27, code: DH_OLD, weapons: ['Spear', 'Greatsword'], patch: '2026-09-29', reviewed: '2026-10-28', sourceUpdated: '2026-04-19', source: { name: 'Snow Crows', url: 'https://snowcrows.com/x' } };
const CTX = { latest: '2026-11-10', today: '2026-11-16' };

test('build: la fuente cambió el código → código y armas nuevos; parche nuevo solo si la fuente se actualizó después', () => {
  const r = K.curateBuild(DH, { status: 200, codes: [DH_NEW], updated: '2026-11-12', patch: '' }, CTX);
  assert.equal(r.build.code, DH_NEW);
  assert.deepEqual(r.build.weapons, ['Longbow', 'Sword', 'Shield']);
  assert.equal(r.build.sourceUpdated, '2026-11-12');
  assert.equal(r.build.patch, '2026-11-10');
  assert.equal(r.build.reviewed, '2026-11-16');
  assert.equal(r.issue, '');
  const viejo = K.curateBuild(DH, { status: 200, codes: [DH_OLD], updated: '2026-04-19', patch: '' }, CTX);
  assert.deepEqual(viejo.changes, []);
  assert.equal(viejo.issue, '');
  assert.equal(viejo.build.patch, '2026-09-29', 'sin actualización de la fuente sigue «para revisar»');
  assert.equal(viejo.build, DH);
});

test('build: lo que no puedo resolver solo queda para revisar y no se toca', () => {
  assert.match(K.curateBuild(DH, { status: 404 }, CTX).issue, /404/);
  assert.match(K.curateBuild(DH, { status: 200, codes: [WB], updated: '' }, CTX).issue, /no es de esta profesión/);
  assert.match(K.curateBuild(DH, { status: 200, codes: [DH_NEW, DH_ALT], updated: '' }, CTX).issue, /2 códigos/);
  assert.match(K.curateBuild(DH, { status: 200, codes: [], updated: '' }, CTX).issue, /no muestra código/);
  assert.equal(K.curateBuild(DH, { status: 'error' }, CTX).build, DH, 'si la página no respondió, no cambia nada');
  const mb = K.curateBuild(Object.assign({}, DH, { patch: '2026-09-15' }), { status: 200, codes: [DH_OLD, DH_ALT], updated: '', patch: '2026-11-10' }, CTX);
  assert.equal(mb.issue, '', 'si el código que tengo sigue en la página, está bien');
  assert.equal(mb.build.patch, '2026-11-10');
});

test('catálogo: freno si respondieron pocas páginas; lista de revisión estable; formato de una build por línea', () => {
  const cat = { version: 1, curated: '2026-10-28', patch: { latest: '2026-09-29', note: 'n' }, builds: [DH, Object.assign({}, DH, { id: 'sc-dh2' })] };
  assert.match(K.curateCatalog(cat, { 'sc-dh': { status: 'error' } }, CTX).refused, /respondieron 0 de 2/);
  const r = K.curateCatalog(cat, { 'sc-dh': { status: 200, codes: [DH_NEW], updated: '2026-11-12', patch: '' }, 'sc-dh2': { status: 404 } }, CTX);
  assert.equal(r.changed, true);
  assert.equal(r.next.curated, '2026-11-16');
  assert.equal(r.next.patch.latest, '2026-11-10');
  assert.deepEqual(r.next.review, [{ id: 'sc-dh2', issue: 'la página de origen ya no existe (404)', since: '2026-11-16' }]);
  const again = K.curateCatalog(r.next, { 'sc-dh': { status: 200, codes: [DH_NEW], updated: '2026-11-12', patch: '' }, 'sc-dh2': { status: 404 } }, { latest: '2026-11-10', today: '2026-11-23' });
  assert.equal(again.changed, false, 'una semana sin novedades no genera commit');
  const txt = K.catalogText(r.next);
  assert.equal(txt.split('\n').length, 2 + 2 + 2);
  assert.deepEqual(JSON.parse(txt), r.next);
});
