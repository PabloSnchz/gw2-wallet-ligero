/*!
 * js/acc-vault.js — El Llavero: abrir tu archivo cifrado sin perder nada (BL-070, paso 4, CTA-3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-26)
 *
 * Núcleo sin pantalla: no pide a la API, no guarda y no toca el DOM. La vista es js/acc-vault-view.js.
 *  - Lee tu archivo de hoy (el formato de CryptoJS que arma el asistente viejo: «Salted__», clave con
 *    EVP_BytesToKey y MD5, AES-256-CBC) con la criptografía del navegador, sin depender de CryptoJS.
 *  - Lee y escribe el formato nuevo (D2): PBKDF2-SHA256 con 600.000 iteraciones, sal de 16 bytes y
 *    AES-256-GCM, que además detecta si alguien tocó el archivo.
 *  - No pierde datos: el contenido descifrado se conserva tal cual (también los campos que no conozco) y
 *    solo se lee para mostrarlo. La lista de campos que muestra la vista sale de FIELDS.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var ITER = 600000, MAX_ITER = 5000000, SALT = 16, IV = 12;
  var MAGIC = 'Salted__';

  function subtle() { var c = root.crypto; return c && c.subtle ? c.subtle : null; }
  function rand(n) { var a = new Uint8Array(n); root.crypto.getRandomValues(a); return a; }
  function enc(s) { return new root.TextEncoder().encode(String(s)); }
  function dec(b) { return new root.TextDecoder('utf-8', { fatal: true }).decode(b); }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
  function b64e(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return root.btoa(s); }
  function b64d(str) { var s = root.atob(String(str).replace(/\s+/g, '')), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }

  // ------------------------------------------------------------------ MD5 (solo para leer el formato viejo)
  var K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (var k = 0; k < 64; k++) K[k] = Math.floor(Math.abs(Math.sin(k + 1)) * 4294967296) >>> 0;
  function md5(bytes) {
    var n = bytes.length, len = ((n + 8) >>> 6) + 1, w = new Uint32Array(len * 16), i;
    for (i = 0; i < n; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[n >> 2] |= 0x80 << ((n % 4) * 8);
    w[len * 16 - 2] = (n * 8) >>> 0;
    w[len * 16 - 1] = Math.floor(n / 536870912) >>> 0;
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;
    for (var b = 0; b < len * 16; b += 16) {
      var a = h0, bb = h1, c = h2, d = h3;
      for (var j = 0; j < 64; j++) {
        var f, g, r = j >> 4;
        if (r === 0) { f = (bb & c) | (~bb & d); g = j; }
        else if (r === 1) { f = (d & bb) | (~d & c); g = (5 * j + 1) % 16; }
        else if (r === 2) { f = bb ^ c ^ d; g = (3 * j + 5) % 16; }
        else { f = c ^ (bb | ~d); g = (7 * j) % 16; }
        var t = d; d = c; c = bb;
        var x = (a + f + K[j] + w[b + g]) >>> 0, s = S[r * 4 + (j % 4)];
        bb = (bb + ((x << s) | (x >>> (32 - s)))) >>> 0;
        a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    }
    var out = new Uint8Array(16);
    [h0, h1, h2, h3].forEach(function (h, q) { for (var z = 0; z < 4; z++) out[q * 4 + z] = (h >>> (8 * z)) & 255; });
    return out;
  }

  // EVP_BytesToKey de OpenSSL con MD5 y 1 iteración: lo que hace CryptoJS con una contraseña.
  function evpKDF(pass, salt, keyLen, ivLen) {
    var p = enc(pass), out = new Uint8Array(0), prev = new Uint8Array(0);
    while (out.length < keyLen + ivLen) { prev = md5(concat(concat(prev, p), salt)); out = concat(out, prev); }
    return { key: out.slice(0, keyLen), iv: out.slice(keyLen, keyLen + ivLen) };
  }

  // ------------------------------------------------------------------ formatos
  function parseV2(text) {
    try {
      var o = JSON.parse(String(text));
      if (o && o.gnVault === 2 && o.kdf && o.cipher && typeof o.ct === 'string') return o;
    } catch (e) {}
    return null;
  }
  function detect(text) {
    if (parseV2(text)) return 'v2';
    try { var b = b64d(String(text).trim()); if (b.length > 16 && dec(b.slice(0, 8)) === MAGIC) return 'legacy'; } catch (e) {}
    return null;
  }

  function bad() { var e = new Error('Contraseña incorrecta o archivo dañado'); e.code = 'BAD_PASSWORD'; return e; }
  function toData(bytes) {
    var d;
    try { d = JSON.parse(dec(new Uint8Array(bytes))); } catch (e) { throw bad(); }
    if (!d || typeof d !== 'object') throw bad();
    return d;
  }

  function decryptLegacy(text, pass) {
    var S2 = subtle();
    if (!S2) return Promise.reject(new Error('Tu navegador no tiene la criptografía necesaria'));
    var raw = b64d(String(text).trim()), salt = raw.slice(8, 16), ct = raw.slice(16);
    var kv = evpKDF(pass, salt, 32, 16);
    return S2.importKey('raw', kv.key, { name: 'AES-CBC' }, false, ['decrypt'])
      .then(function (key) { return S2.decrypt({ name: 'AES-CBC', iv: kv.iv }, key, ct); })
      .then(toData, function (e) { if (e && e.code === 'BAD_PASSWORD') throw e; throw bad(); });
  }

  function deriveKey(pass, salt, iter, usage) {
    var S2 = subtle();
    return S2.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return S2.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
    });
  }

  function decryptV2(text, pass) {
    var o = parseV2(text);
    if (!o) return Promise.reject(bad());
    if (!subtle()) return Promise.reject(new Error('Tu navegador no tiene la criptografía necesaria'));
    var iter = Number(o.kdf.iter);
    if (o.kdf.name !== 'PBKDF2' || o.kdf.hash !== 'SHA-256' || o.cipher.name !== 'AES-GCM' || !(iter >= 1 && iter <= MAX_ITER)) return Promise.reject(bad());
    return deriveKey(pass, b64d(o.kdf.salt), iter, 'decrypt')
      .then(function (key) { return subtle().decrypt({ name: 'AES-GCM', iv: b64d(o.cipher.iv) }, key, b64d(o.ct)); })
      .then(toData, function (e) { if (e && e.code === 'BAD_PASSWORD') throw e; throw bad(); });
  }

  // opts.iter / opts.salt / opts.iv solo para los tests: en uso real siempre 600.000 y al azar.
  function encryptV2(data, pass, opts) {
    opts = opts || {};
    if (!subtle()) return Promise.reject(new Error('Tu navegador no tiene la criptografía necesaria'));
    if (!pass || String(pass).length < 8) return Promise.reject(new Error('La contraseña tiene que tener al menos 8 caracteres'));
    var iter = opts.iter || ITER, salt = opts.salt || rand(SALT), iv = opts.iv || rand(IV);
    return deriveKey(pass, salt, iter, 'encrypt')
      .then(function (key) { return subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, enc(JSON.stringify(data))); })
      .then(function (ct) {
        return JSON.stringify({ gnVault: 2, app: 'Bóveda del Gato Negro', kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: iter, salt: b64e(salt) }, cipher: { name: 'AES-GCM', iv: b64e(iv) }, ct: b64e(new Uint8Array(ct)) });
      });
  }

  function open(text, pass) {
    var f = detect(text);
    if (f === 'v2') return decryptV2(text, pass).then(function (d) { return { format: 'v2', data: d }; });
    if (f === 'legacy') return decryptLegacy(text, pass).then(function (d) { return { format: 'legacy', data: d }; });
    var e = new Error('Este archivo no es un Llavero de la Bóveda'); e.code = 'NOT_VAULT';
    return Promise.reject(e);
  }

  // ------------------------------------------------------------------ lo que se muestra
  // kind: secret (enmascarado, con Ver y Copiar), text (a la vista, con Copiar), flag (sí/no), note.
  var FIELDS = [
    { key: 'email', label: 'Email', path: ['login', 'email'], kind: 'secret', icon: 'assets/icons/Cuentas/gmail.png', partial: true },
    { key: 'password', label: 'Contraseña', path: ['login', 'password'], kind: 'secret', icon: 'assets/icons/Cuentas/733265.png' },
    { key: 'gmailPassword', label: 'Contraseña de Gmail', path: ['login', 'gmailPassword'], kind: 'secret', icon: 'assets/icons/Cuentas/passgoogle.png' },
    { key: 'twitchUser', label: 'Twitch: usuario', path: ['services', 'twitch', 'username'], kind: 'text', icon: 'assets/icons/Cuentas/twitchlogo.png' },
    { key: 'twitchEmail', label: 'Twitch: email', path: ['services', 'twitch', 'email'], kind: 'secret', icon: 'assets/icons/Cuentas/twitchlogo.png', partial: true },
    { key: 'twitchPassword', label: 'Twitch: contraseña', path: ['services', 'twitch', 'password'], kind: 'secret', icon: 'assets/icons/Cuentas/twitchlogo.png' },
    { key: 'geforce', label: 'GeForce NOW', path: ['services', 'geforceNow', 'linked'], kind: 'flag', icon: 'assets/icons/Cuentas/gforce.png' },
    { key: 'apiKey', label: 'API Key', path: ['apiKey'], kind: 'secret', icon: 'assets/icons/Cuentas/155048.png', partial: true },
    { key: 'notes', label: 'Notas', path: ['notes'], kind: 'note', icon: 'assets/icons/Cuentas/1228929.png' }
  ];

  function at(o, path) {
    var v = o;
    for (var i = 0; i < path.length; i++) { if (v == null || typeof v !== 'object') return undefined; v = v[path[i]]; }
    if (v && typeof v === 'object' && path[path.length - 1] === 'apiKey') v = v.value; // { value: 'XXXX' } o 'XXXX'
    return v;
  }
  function value(acc, key) {
    var f = FIELDS.filter(function (x) { return x.key === key; })[0];
    var v = f ? at(acc, f.path) : undefined;
    if (f && f.kind === 'flag') return v === true || v === 'TRUE' || v === 'true';
    return v == null ? '' : String(v);
  }
  // Máscara: nunca el valor; en email y Key, lo justo para reconocerlos.
  function mask(v, f) {
    var s = String(v || '');
    if (!s) return '';
    if (f && f.partial) {
      var at2 = s.indexOf('@');
      if (at2 > 0) return s.slice(0, Math.min(3, at2)) + '•••' + s.slice(at2);
      if (s.length > 12) return s.slice(0, 4) + '-••••-' + s.slice(-4);
    }
    return '••••••••';
  }

  // Huella de la Key (la misma FNV-1a de 32 bits que usa Mis cuentas): une la cuenta del Llavero con su tarjeta.
  function fingerprint(token) {
    var s = String(token || ''), h = 0x811c9dc5;
    if (!s) return '';
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function tagsOf(acc) {
    var t = acc && acc.tags;
    if (Array.isArray(t)) return t.map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (typeof t === 'string') return t.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }

  // Una fila por cuenta, sin secretos: lo que necesita la vista para armar la lista y Mis cuentas para sumar etiquetas.
  function entries(data) {
    var list = data && Array.isArray(data.accounts) ? data.accounts : [];
    return list.map(function (acc, i) {
      var key = value(acc, 'apiKey');
      return {
        i: i, name: String((acc && acc.name) || '') || 'Cuenta ' + (i + 1),
        accountName: String((acc && acc.gw2 && acc.gw2.accountName) || ''),
        tags: tagsOf(acc), keyFp: fingerprint(key),
        fields: FIELDS.filter(function (f) { var v = value(acc, f.key); return f.kind === 'flag' ? at(acc, f.path) !== undefined : v !== ''; }).map(function (f) { return f.key; })
      };
    });
  }

  root.AccVault = {
    version: VERSION, ITER: ITER, FIELDS: FIELDS,
    detect: detect, open: open, encryptV2: encryptV2, decryptV2: decryptV2, decryptLegacy: decryptLegacy,
    entries: entries, value: value, mask: mask, fingerprint: fingerprint,
    _pure: { md5: md5, evpKDF: evpKDF, b64e: b64e, b64d: b64d, parseV2: parseV2, tagsOf: tagsOf, at: at }
  };
  if (root.console && root.console.info) root.console.info('[AccVault] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
