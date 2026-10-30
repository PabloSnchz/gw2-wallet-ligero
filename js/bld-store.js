/*!
 * js/bld-store.js — Builds: «Mis builds», guardadas en este navegador (BL-082 BLD-6, B7)
 * Versión: 1.0.0 (2026-10-28)
 *
 * La Bóveda no tiene servidor ni cuentas (D4): tus builds viven en localStorage (gn:builds:mine) y viajan en tu
 * archivo de respaldo (js/settings-manager.js las exporta e importa con el resto de tus datos «gn:»).
 * Cada build: { id, code, title, notes, source, created, updated }. Solo se guarda un código que el lector
 * acepta; títulos y notas se recortan. Tope: 300 builds. Avisa los cambios con el evento gn:builds-changed.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var KEY = 'gn:builds:mine';
  var MAX = 300, MAX_TITLE = 80, MAX_NOTES = 1000;

  function ls() { try { return root.localStorage || null; } catch (_) { return null; } }
  function now() { return Date.now(); }
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }

  function read() {
    var s = ls(); if (!s) return [];
    try { var v = JSON.parse(s.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(valid) : []; } catch (_) { return []; }
  }
  function write(list) {
    var s = ls(); if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(list)); } catch (_) { return false; }
    try {
      var d = root.document;
      if (d && typeof root.CustomEvent === 'function') d.dispatchEvent(new root.CustomEvent('gn:builds-changed', { detail: { count: list.length } }));
    } catch (_) {}
    return true;
  }
  function valid(b) { return b && typeof b === 'object' && typeof b.id === 'string' && typeof b.code === 'string'; }
  function norm(code) {
    var C = root.GNBldCode;
    if (!C) return { ok: false, error: 'Falta el lector de códigos.' };
    var r = C.parse(code);
    return r.ok ? { ok: true, code: r.code, build: r.build } : { ok: false, error: r.error };
  }
  function newId() { return 'b' + now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function list() { return read().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }); }
  function get(id) { return read().filter(function (b) { return b.id === id; })[0] || null; }

  // save({ code, title, notes, source }) → { ok, id, dup } · si el mismo código ya está, no lo duplica.
  function save(x) {
    x = x || {};
    var n = norm(x.code);
    if (!n.ok) return { ok: false, error: n.error };
    var all = read();
    var same = all.filter(function (b) { return b.code === n.code; })[0];
    if (same) return { ok: true, id: same.id, dup: true };
    if (all.length >= MAX) return { ok: false, error: 'Llegaste a ' + MAX + ' builds guardadas: borrá alguna para sumar otra.' };
    var C = root.GNBldCode;
    var b = { id: newId(), code: n.code, title: clip(x.title, MAX_TITLE) || ((C && C.PROF_ES[n.build.profession]) || 'Build') + ' · mía',
      notes: clip(x.notes, MAX_NOTES), source: x.source && x.source.url ? { name: clip(x.source.name, 60), url: clip(x.source.url, 300) } : null,
      profession: n.build.profession, created: now(), updated: now() };
    all.push(b);
    return write(all) ? { ok: true, id: b.id, dup: false } : { ok: false, error: 'El navegador no me dejó guardar (¿almacenamiento lleno o privado?).' };
  }

  // update(id, { code?, title?, notes? })
  function update(id, patch) {
    var all = read(), i = -1;
    all.forEach(function (b, k) { if (b.id === id) i = k; });
    if (i < 0) return { ok: false, error: 'No encontré esa build.' };
    var b = all[i];
    if (patch.code != null) {
      var n = norm(patch.code);
      if (!n.ok) return { ok: false, error: n.error };
      b.code = n.code; b.profession = n.build.profession;
    }
    if (patch.title != null) b.title = clip(patch.title, MAX_TITLE) || b.title;
    if (patch.notes != null) b.notes = clip(patch.notes, MAX_NOTES);
    b.updated = now();
    return write(all) ? { ok: true, id: id } : { ok: false, error: 'No pude guardar el cambio.' };
  }
  function remove(id) {
    var all = read(), out = all.filter(function (b) { return b.id !== id; });
    if (out.length === all.length) return { ok: false, error: 'No encontré esa build.' };
    return write(out) ? { ok: true } : { ok: false, error: 'No pude borrarla.' };
  }
  function duplicate(id) {
    var b = get(id);
    if (!b) return { ok: false, error: 'No encontré esa build.' };
    var all = read();
    if (all.length >= MAX) return { ok: false, error: 'Llegaste a ' + MAX + ' builds guardadas.' };
    var c = { id: newId(), code: b.code, title: clip(b.title + ' (copia)', MAX_TITLE), notes: b.notes, source: b.source, profession: b.profession, created: now(), updated: now() };
    all.push(c);
    return write(all) ? { ok: true, id: c.id } : { ok: false, error: 'No pude duplicarla.' };
  }

  var api = { version: VERSION, KEY: KEY, MAX: MAX, list: list, get: get, save: save, update: update, remove: remove, duplicate: duplicate };
  root.GNBldStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
