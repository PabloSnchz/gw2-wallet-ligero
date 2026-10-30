/*!
 * js/bld-code.js — Códec del código de plantilla de builds de Guild Wars 2 (BL-082 BLD-2)
 * Versión: 1.0.0
 *
 * Lee y escribe el código que el juego copia y pega en el chat: [&DQ…]. Puro: sin red, sin DOM.
 * Formato público (wiki oficial, «Chat link format», sección Build template link):
 *   0x0D · profesión (1–9) · 3 × (especialización, rasgos en 2 bits: adepto, maestro, gran maestro)
 *   · 10 × u16 LE de paleta (curación, 3 utilidades y élite; tierra y agua intercalados)
 *   · 16 bytes propios de la profesión (mascotas del Guardabosques o leyendas del Retornado)
 *   · desde el 2023-06-27: n armas (u16) y m variantes de habilidad (u32).
 * Los códigos viejos (44 bytes, sin armas) se leen y se vuelven a escribir igual (legacy).
 * Seguridad: solo acepta [&…] o base64 pelado, con largo máximo, y valida cada tramo antes de leerlo.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var HEADER = 0x0D;
  var MAX_TEXT = 600;     // el chat del juego no admite más; cortamos antes de decodificar
  var MAX_WEAPONS = 8;
  var MAX_OVERRIDES = 32;

  var PROFESSIONS = ['', 'Guardian', 'Warrior', 'Engineer', 'Ranger', 'Thief', 'Elementalist', 'Mesmer', 'Necromancer', 'Revenant'];
  var PROF_ES = ['', 'Guardián', 'Guerrero', 'Ingeniero', 'Guardabosques', 'Ladrón', 'Elementalista', 'Hipnotizador', 'Nigromante', 'Retornado'];
  var WEAPONS = { 5: 'Axe', 35: 'Longbow', 47: 'Dagger', 49: 'Focus', 50: 'Greatsword', 51: 'Hammer', 53: 'Mace', 54: 'Pistol',
    85: 'Rifle', 86: 'Scepter', 87: 'Shield', 89: 'Staff', 90: 'Sword', 102: 'Torch', 103: 'Warhorn', 107: 'Shortbow', 265: 'Spear' };
  var WEAPONS_ES = { Axe: 'Hacha', Longbow: 'Arco largo', Dagger: 'Daga', Focus: 'Foco', Greatsword: 'Mandoble', Hammer: 'Martillo',
    Mace: 'Maza', Pistol: 'Pistola', Rifle: 'Rifle', Scepter: 'Cetro', Shield: 'Escudo', Staff: 'Báculo', Sword: 'Espada',
    Torch: 'Antorcha', Warhorn: 'Cuerno de guerra', Shortbow: 'Arco corto', Spear: 'Lanza' };
  var LEGENDS_ES = ['', 'Dragón (Glint)', 'Asesino (Shiro)', 'Enano (Jalis)', 'Demonio (Mallyx)', 'Renegado (Kalla)', 'Centauro (Ventari)', 'Alianza', 'Entidad'];
  var SLOT_NAMES = ['heal', 'utility1', 'utility2', 'utility3', 'elite'];

  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }

  // ---------------------------------------------------------------- base64 (navegador y Node)
  function b64ToBytes(s) {
    if (typeof root.atob === 'function') {
      var bin = root.atob(s), out = new Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (typeof Buffer !== 'undefined') return Array.prototype.slice.call(Buffer.from(s, 'base64'));
    throw err('E_ENV', 'sin decodificador base64');
  }
  function bytesToB64(bytes) {
    if (typeof root.btoa === 'function') {
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return root.btoa(bin);
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    throw err('E_ENV', 'sin codificador base64');
  }

  // ---------------------------------------------------------------- limpieza del texto pegado
  // Devuelve el base64 del código o lanza un error con mensaje claro en castellano.
  function clean(text) {
    if (typeof text !== 'string') throw err('E_EMPTY', 'Pegá un código de plantilla: [&DQ…].');
    var s = text.trim();
    if (!s) throw err('E_EMPTY', 'Pegá un código de plantilla: [&DQ…].');
    if (s.length > MAX_TEXT) throw err('E_LONG', 'El texto es demasiado largo para ser un código del juego.');
    var m = s.match(/\[&([A-Za-z0-9+/=]+)\]/);
    var b = m ? m[1] : s.replace(/^\[?&?/, '').replace(/\]$/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b)) throw err('E_CHARS', 'Eso no parece un código del juego: tiene caracteres que no van.');
    if (b.length % 4 === 1) throw err('E_B64', 'El código está cortado: falta un pedazo.');
    while (b.length % 4) b += '=';
    return b;
  }

  // ---------------------------------------------------------------- lectura
  function Reader(bytes) { this.b = bytes; this.i = 0; }
  Reader.prototype.need = function (n, what) {
    if (this.i + n > this.b.length) throw err('E_SHORT', 'El código está cortado (falta ' + what + ').');
  };
  Reader.prototype.u8 = function (what) { this.need(1, what); return this.b[this.i++]; };
  Reader.prototype.u16 = function (what) { this.need(2, what); var v = this.b[this.i] | (this.b[this.i + 1] << 8); this.i += 2; return v; };
  Reader.prototype.u32 = function (what) {
    this.need(4, what);
    var v = (this.b[this.i] | (this.b[this.i + 1] << 8) | (this.b[this.i + 2] << 16)) + this.b[this.i + 3] * 16777216;
    this.i += 4; return v;
  };

  function decodeBytes(bytes) {
    var r = new Reader(bytes);
    var h = r.u8('el encabezado');
    if (h !== HEADER) throw err('E_TYPE', 'Es un código del juego, pero no de una build (tipo 0x' + (h < 16 ? '0' : '') + h.toString(16).toUpperCase() + ').');
    var prof = r.u8('la profesión');
    if (prof < 1 || prof > 9) throw err('E_PROF', 'La profesión del código (' + prof + ') no existe.');
    var specs = [];
    for (var s = 0; s < 3; s++) {
      var id = r.u8('las especializaciones'), t = r.u8('los rasgos');
      specs.push({ id: id, traits: [t & 3, (t >> 2) & 3, (t >> 4) & 3] });
    }
    var land = [], water = [];
    for (var k = 0; k < 5; k++) { land.push(r.u16('las habilidades')); water.push(r.u16('las habilidades')); }
    var extra = [];
    for (var x = 0; x < 16; x++) extra.push(r.u8('los datos de la profesión'));
    var build = { profession: prof, specs: specs, skills: { land: land, water: water }, pets: null, legends: null,
      weapons: [], overrides: [], legacy: false, extra: null };
    if (prof === 4) {
      build.pets = { land: [extra[0], extra[1]], water: [extra[2], extra[3]] };
      if (anyNonZero(extra, 4)) build.extra = extra.slice();
    } else if (prof === 9) {
      var inact = [];
      for (var q = 0; q < 6; q++) inact.push(extra[4 + q * 2] | (extra[5 + q * 2] << 8));
      build.legends = { land: [extra[0], extra[1]], water: [extra[2], extra[3]],
        inactiveLand: inact.slice(0, 3), inactiveWater: inact.slice(3, 6) };
    } else if (anyNonZero(extra, 0)) {
      build.extra = extra.slice();
    }
    if (r.i === bytes.length) { build.legacy = true; return build; }
    var nw = r.u8('la cantidad de armas');
    if (nw > MAX_WEAPONS) throw err('E_WEAPONS', 'El código dice tener ' + nw + ' armas; el juego admite hasta ' + MAX_WEAPONS + '.');
    for (var w = 0; w < nw; w++) build.weapons.push(r.u16('las armas'));
    var no = r.u8('la cantidad de variantes');
    if (no > MAX_OVERRIDES) throw err('E_OVR', 'El código trae demasiadas variantes de habilidad (' + no + ').');
    for (var o = 0; o < no; o++) build.overrides.push(r.u32('las variantes'));
    if (r.i !== bytes.length) throw err('E_TAIL', 'El código trae datos de más al final: no lo adivino.');
    return build;
  }
  function anyNonZero(a, from) { for (var i = from; i < a.length; i++) if (a[i]) return true; return false; }

  function decode(text) { return decodeBytes(b64ToBytes(clean(text))); }

  // ---------------------------------------------------------------- escritura
  function u8(out, v, what) {
    v = Number(v) || 0;
    if (v < 0 || v > 255 || v !== Math.floor(v)) throw err('E_RANGE', what + ' fuera de rango: ' + v);
    out.push(v);
  }
  function u16(out, v, what) {
    v = Number(v) || 0;
    if (v < 0 || v > 65535 || v !== Math.floor(v)) throw err('E_RANGE', what + ' fuera de rango: ' + v);
    out.push(v & 255, (v >> 8) & 255);
  }
  function u32(out, v, what) {
    v = Number(v) || 0;
    if (v < 0 || v > 4294967295 || v !== Math.floor(v)) throw err('E_RANGE', what + ' fuera de rango: ' + v);
    out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  }

  function encodeBytes(b) {
    if (!b || typeof b !== 'object') throw err('E_BUILD', 'Falta la build.');
    var out = [HEADER];
    var prof = Number(b.profession);
    if (!(prof >= 1 && prof <= 9)) throw err('E_PROF', 'Elegí una profesión.');
    out.push(prof);
    var specs = b.specs || [];
    for (var s = 0; s < 3; s++) {
      var sp = specs[s] || { id: 0, traits: [0, 0, 0] };
      var t = sp.traits || [0, 0, 0];
      for (var j = 0; j < 3; j++) if (!(t[j] >= 0 && t[j] <= 3)) throw err('E_RANGE', 'Rasgo inválido en la línea ' + (s + 1));
      u8(out, sp.id, 'Especialización');
      out.push((t[0] & 3) | ((t[1] & 3) << 2) | ((t[2] & 3) << 4));
    }
    var land = (b.skills && b.skills.land) || [], water = (b.skills && b.skills.water) || [];
    for (var k = 0; k < 5; k++) { u16(out, land[k], 'Habilidad'); u16(out, water[k], 'Habilidad'); }
    var extra = [];
    if (prof === 4 && b.pets) {
      extra = [b.pets.land[0], b.pets.land[1], b.pets.water[0], b.pets.water[1]].map(function (v) { return Number(v) || 0; });
      var keep = b.extra && b.extra.length === 16 ? b.extra.slice(4) : [];
      while (extra.length < 16) extra.push(keep[extra.length - 4] || 0);
    } else if (prof === 9 && b.legends) {
      var L = b.legends;
      extra = [L.land[0], L.land[1], L.water[0], L.water[1]].map(function (v) { return Number(v) || 0; });
      var ia = (L.inactiveLand || [0, 0, 0]).concat(L.inactiveWater || [0, 0, 0]);
      for (var q = 0; q < 6; q++) u16(extra, ia[q], 'Habilidad de leyenda');
    } else if (b.extra && b.extra.length === 16) {
      extra = b.extra.slice();
    }
    while (extra.length < 16) extra.push(0);
    extra.forEach(function (v) { u8(out, v, 'Dato de la profesión'); });
    if (!b.legacy) {
      var ws = b.weapons || [], os = b.overrides || [];
      if (ws.length > MAX_WEAPONS) throw err('E_WEAPONS', 'Hasta ' + MAX_WEAPONS + ' armas.');
      if (os.length > MAX_OVERRIDES) throw err('E_OVR', 'Demasiadas variantes de habilidad.');
      out.push(ws.length);
      ws.forEach(function (w) { u16(out, w, 'Arma'); });
      out.push(os.length);
      os.forEach(function (o) { u32(out, o, 'Variante'); });
    }
    return out;
  }

  function encode(b) { return '[&' + bytesToB64(encodeBytes(b)) + ']'; }

  // ---------------------------------------------------------------- reglas que el juego exige
  // El juego no reconoce un código con la misma habilidad en dos casilleros de la misma barra.
  function problems(b) {
    var out = [];
    ['land', 'water'].forEach(function (bar) {
      var seen = {};
      ((b.skills && b.skills[bar]) || []).forEach(function (p, i) {
        if (!p) return;
        if (seen[p] != null) out.push({ code: 'DUP_SKILL', bar: bar, slots: [seen[p], i], palette: p });
        else seen[p] = i;
      });
    });
    var ids = (b.specs || []).map(function (s) { return s && s.id; }).filter(Boolean);
    ids.forEach(function (id, i) { if (ids.indexOf(id) !== i) out.push({ code: 'DUP_SPEC', spec: id }); });
    return out;
  }

  // Lectura segura para la interfaz: nunca lanza.
  function parse(text) {
    try {
      var b = decode(text);
      return { ok: true, build: b, code: encode(b), problems: problems(b) };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Código inválido.', errorCode: (e && e.code) || 'E_UNKNOWN' };
    }
  }

  function empty(prof) {
    var b = { profession: prof || 1, specs: [{ id: 0, traits: [0, 0, 0] }, { id: 0, traits: [0, 0, 0] }, { id: 0, traits: [0, 0, 0] }],
      skills: { land: [0, 0, 0, 0, 0], water: [0, 0, 0, 0, 0] }, pets: null, legends: null, weapons: [], overrides: [], legacy: false, extra: null };
    if (b.profession === 4) b.pets = { land: [0, 0], water: [0, 0] };
    if (b.profession === 9) b.legends = { land: [0, 0], water: [0, 0], inactiveLand: [0, 0, 0], inactiveWater: [0, 0, 0] };
    return b;
  }

  function clone(b) { return JSON.parse(JSON.stringify(b)); }

  var api = {
    version: VERSION, HEADER: HEADER, PROFESSIONS: PROFESSIONS, PROF_ES: PROF_ES, WEAPONS: WEAPONS, WEAPONS_ES: WEAPONS_ES,
    LEGENDS_ES: LEGENDS_ES, SLOT_NAMES: SLOT_NAMES,
    clean: clean, decode: decode, decodeBytes: decodeBytes, encode: encode, encodeBytes: encodeBytes,
    parse: parse, problems: problems, empty: empty, clone: clone
  };
  root.GNBldCode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
