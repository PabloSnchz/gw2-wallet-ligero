/*!
 * js/bld-ae2.js — Builds: código AE2 con el equipo completo (BL-082 BLD-12: B4 y C3)
 * Versión: 1.0.0 (2026-10-28)
 *
 * Formato público «Alter Ego Shared Build Template», versión 3 (PieOrCake/alter_ego, docs/shared-build-spec.md,
 * abril 2026, licencia MIT). Implementación propia a partir de la especificación, sin dependencias:
 *   AE2:<base64>  ·  versión (3; acepta 2) · banderas (modo en 3 bits, 0x08 equipo, 0x10 runa, 0x20 reliquia)
 *   · largo y bytes del código del juego · máscara de 16 casilleros + estadística por casillero (u16)
 *   · runa (u32) · reliquia exótica (u32) · por cada arma: sigilo (u32), tipo de arma (u16) y, en v3, segundo sigilo (u32).
 * Así se copia la build con estadísticas, runa, sigilos y reliquia para el complemento Alter Ego, y se lee una de vuelta.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var MODES = ['PvE', 'WvW', 'PvP', 'Raid', 'Fractal', 'Other'];
  var SLOTS = ['Helm', 'Shoulders', 'Coat', 'Gloves', 'Leggings', 'Boots', 'WeaponA1', 'WeaponA2', 'WeaponB1', 'WeaponB2',
    'Backpack', 'Accessory1', 'Accessory2', 'Amulet', 'Ring1', 'Ring2'];
  var SLOTS_ES = { Helm: 'Casco', Shoulders: 'Hombreras', Coat: 'Pechera', Gloves: 'Guantes', Leggings: 'Perneras', Boots: 'Botas',
    WeaponA1: 'Arma 1 (mano principal)', WeaponA2: 'Arma 1 (mano secundaria)', WeaponB1: 'Arma 2 (mano principal)', WeaponB2: 'Arma 2 (mano secundaria)',
    Backpack: 'Espalda', Accessory1: 'Accesorio 1', Accessory2: 'Accesorio 2', Amulet: 'Amuleto', Ring1: 'Anillo 1', Ring2: 'Anillo 2' };
  var MAX_TEXT = 400;

  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function C() { return root.GNBldCode; }
  function isWeapon(i) { return i >= 6 && i <= 9; }

  function b64ToBytes(s) {
    if (typeof root.atob === 'function') { var b = root.atob(s), o = []; for (var i = 0; i < b.length; i++) o.push(b.charCodeAt(i)); return o; }
    return Array.prototype.slice.call(Buffer.from(s, 'base64'));
  }
  function bytesToB64(a) {
    if (typeof root.btoa === 'function') { var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return root.btoa(s); }
    return Buffer.from(a).toString('base64');
  }
  function u16(o, v) { v = Number(v) || 0; if (v < 0 || v > 65535) throw err('E_RANGE', 'Valor fuera de rango: ' + v); o.push(v & 255, (v >> 8) & 255); }
  function u32(o, v) { v = Number(v) || 0; if (v < 0 || v > 4294967295) throw err('E_RANGE', 'Valor fuera de rango: ' + v); o.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }

  // x = { code: '[&DQ…]', mode: 'PvE'|'WvW'|…, gear: { Helm: { statId }, WeaponA1: { statId, sigilId, weaponType, sigil2Id } … }, runeId, relicId }
  function encode(x) {
    var Cc = C();
    if (!Cc) throw err('E_ENV', 'Falta el lector de códigos.');
    var link = Cc.encodeBytes(Cc.decode(x.code));
    if (link.length > 255) throw err('E_LONG', 'El código del juego es demasiado largo para AE2.');
    var mode = Math.max(0, MODES.indexOf(x.mode || 'PvE'));
    var gear = x.gear || {}, mask = 0;
    SLOTS.forEach(function (s, i) { if (gear[s] && (gear[s].statId || (isWeapon(i) && (gear[s].weaponType || gear[s].sigilId)))) mask |= (1 << i); });
    var flags = mode & 7;
    if (mask) flags |= 0x08;
    if (x.runeId) flags |= 0x10;
    if (x.relicId) flags |= 0x20;
    var o = [3, flags, link.length].concat(link);
    if (mask) {
      u16(o, mask);
      SLOTS.forEach(function (s, i) { if (mask & (1 << i)) u16(o, gear[s].statId || 0); });
    }
    if (x.runeId) u32(o, x.runeId);
    if (x.relicId) u32(o, x.relicId);
    if (mask) {
      SLOTS.forEach(function (s, i) {
        if (!isWeapon(i) || !(mask & (1 << i))) return;
        var g = gear[s], wt = typeof g.weaponType === 'string' ? weaponId(g.weaponType) : (Number(g.weaponType) || 0);
        u32(o, g.sigilId || 0); u16(o, wt); u32(o, g.sigil2Id || 0);
      });
    }
    return 'AE2:' + bytesToB64(o);
  }
  function weaponId(name) { var W = C().WEAPONS; for (var k in W) if (W[k] === name) return Number(k); return 0; }

  function decode(text) {
    var s = String(text || '').trim();
    if (s.length > MAX_TEXT) throw err('E_LONG', 'El texto es demasiado largo para un código AE2.');
    var m = s.match(/^AE2:([A-Za-z0-9+/]+={0,2})$/i);
    if (!m) throw err('E_CHARS', 'Un código AE2 empieza con «AE2:» y sigue con letras y números.');
    var b = b64ToBytes(m[1]), i = 0;
    function need(n, what) { if (i + n > b.length) throw err('E_SHORT', 'El código AE2 está cortado (falta ' + what + ').'); }
    function r8(w) { need(1, w); return b[i++]; }
    function r16(w) { need(2, w); var v = b[i] | (b[i + 1] << 8); i += 2; return v; }
    function r32(w) { need(4, w); var v = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 16777216; i += 4; return v; }
    var ver = r8('la versión');
    if (ver !== 2 && ver !== 3) throw err('E_VER', 'Versión de AE2 desconocida (' + ver + '): no la adivino.');
    var flags = r8('las banderas'), len = r8('el largo');
    need(len, 'el código del juego');
    var link = b.slice(i, i + len); i += len;
    var build = C().decodeBytes(link);
    var out = { version: ver, mode: MODES[flags & 7] || 'Other', build: build, code: C().encode(build), gear: {}, runeId: 0, relicId: 0 };
    var mask = 0;
    if (flags & 0x08) {
      mask = r16('la máscara del equipo');
      SLOTS.forEach(function (s, k) { if (mask & (1 << k)) out.gear[s] = { statId: r16('las estadísticas') }; });
    }
    if (flags & 0x10) out.runeId = r32('la runa');
    if (flags & 0x20) out.relicId = r32('la reliquia');
    if (mask) {
      SLOTS.forEach(function (s, k) {
        if (!isWeapon(k) || !(mask & (1 << k))) return;
        var g = out.gear[s];
        g.sigilId = r32('un sigilo');
        var wt = r16('el tipo de arma');
        g.weaponType = C().WEAPONS[wt] || (wt ? String(wt) : '');
        if (ver === 3) { var s2 = r32('el segundo sigilo'); if (s2) g.sigil2Id = s2; }
      });
    }
    if (i !== b.length) throw err('E_TAIL', 'El código AE2 trae datos de más al final.');
    return out;
  }

  // Lectura segura para la interfaz (misma forma que GNBldCode.parse, más ae2).
  function parse(text) {
    try {
      var d = decode(text);
      return { ok: true, build: d.build, code: d.code, problems: C().problems(d.build), ae2: d };
    } catch (e) { return { ok: false, error: (e && e.message) || 'Código AE2 inválido.', errorCode: (e && e.code) || 'E_UNKNOWN' }; }
  }

  // Equipo en la ficha. names = { stats: {id: nombre}, items: {id: nombre} } (opcional, de la API).
  function gearHTML(ae2, names) {
    var esc = root.GNBldShow ? root.GNBldShow.esc : function (s) { return String(s); };
    names = names || root.GNBldAe2._names || { stats: {}, items: {} };
    var st = function (id) { return id ? esc(names.stats[id] || ('estadística #' + id)) : '—'; };
    var it = function (id) { return id ? esc(names.items[id] || ('#' + id)) : '—'; };
    var rows = SLOTS.filter(function (s) { return ae2.gear && ae2.gear[s]; }).map(function (s) {
      var g = ae2.gear[s], w = g.weaponType ? ' · ' + esc((C().WEAPONS_ES[g.weaponType] || g.weaponType)) : '';
      var sg = g.sigilId ? ' · ' + it(g.sigilId) + (g.sigil2Id ? ' + ' + it(g.sigil2Id) : '') : '';
      return '<li><small>' + esc(SLOTS_ES[s]) + '</small> ' + st(g.statId) + w + sg + '</li>';
    });
    return '<div class="bld-gear"><span class="bld-cap">Equipo (AE2 · ' + esc(ae2.mode || 'PvE') + ')</span>' +
      (rows.length ? '<ul class="bld-gear-l">' + rows.join('') + '</ul>' : '<p class="bld-muted">Sin estadísticas cargadas.</p>') +
      '<p><span class="bld-cap">Runa</span> ' + it(ae2.runeId) + ' · <span class="bld-cap" style="display:inline">Reliquia</span> ' + it(ae2.relicId) + '</p></div>';
  }

  var api = { version: VERSION, MODES: MODES, SLOTS: SLOTS, SLOTS_ES: SLOTS_ES, encode: encode, decode: decode, parse: parse, gearHTML: gearHTML,
    _names: { stats: {}, items: {} } };
  root.GNBldAe2 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
