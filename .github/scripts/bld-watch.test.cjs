// BL-082 BLD-10/14: vigía semanal de builds (.github/scripts/bld-watch.cjs). Sin red.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./bld-watch.cjs');

test('lee la fecha del parche declarado y se queda con la más nueva', () => {
  assert.equal(W.parsePatch('Section builds are up to date for the September 29, 2026 patch. Otra: up to date for the July 14, 2026 patch'), '2026-09-29');
  assert.equal(W.parsePatch('up to date for the March 3, 2027 patch'), '2027-03-03');
  assert.equal(W.parsePatch('nada que ver'), '');
  assert.equal(W.parsePatch('up to date for the Smarch 3, 2027 patch'), '');
});

test('CUR-1: la fecha partida por etiquetas también se lee (forma real de MetaBattle, RUN-215)', () => {
  assert.equal(W.parsePatch('<p>Builds are up to date for the <b>\n September 15, 2026 </b> patch.</p>'), '2026-09-15');
});

test('primera vez: anota sin avisar; parche nuevo o biblioteca nueva: avisa', () => {
  const first = W.nextWatch(null, { patch: '2026-09-29', gameBuild: 1, catalogHash: 'a', catalogLatest: '2026-09-29' }, 't0');
  assert.equal(first.next.latestPatch, '2026-09-29');
  assert.deepEqual(first.events, []);
  const same = W.nextWatch(first.next, { patch: '2026-09-29', gameBuild: 2, catalogHash: 'a' }, 't1');
  assert.deepEqual(same.events, []);
  const p = W.nextWatch(first.next, { patch: '2026-11-10', gameBuild: 3, catalogHash: 'a' }, 't2');
  assert.deepEqual(p.events, [{ kind: 'patch', patch: '2026-11-10' }]);
  const c = W.nextWatch(p.next, { patch: '', gameBuild: 3, catalogHash: 'b' }, 't3');
  assert.equal(c.next.latestPatch, '2026-11-10', 'si la página no responde, no se pierde lo sabido');
  assert.deepEqual(c.events, [{ kind: 'catalog' }]);
});

test('el mensaje de Discord no menciona a nadie y dice qué pasó', () => {
  const m = W.message([{ kind: 'patch', patch: '2026-11-10' }, { kind: 'catalog' }], { builds: [1, 2, 3] }, '2026-11-10');
  assert.match(m, /parche de balance \(2026-11-10\)/);
  assert.match(m, /3 builds/);
  assert.doesNotMatch(m, /@everyone|@here/);
});
