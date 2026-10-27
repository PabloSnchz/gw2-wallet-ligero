/*!
 * js/gn-idb.js — Cachés de la Bóveda en IndexedDB (BL-074 BLS-1)
 * Versión: 1.2.0 (2026-10-26) · BLS-4: al cargar borra restos viejos que ya no lee ningún módulo (sweep) y la copia
 *          vieja del Llavero (accounts:lastFile) solo si ya está la nueva (accounts:vault2); items_cache_v1 sin idioma
 *          deja de ser caché (nadie lo lee).
 *          1.1.0 (2026-10-26) · BLS-3: también el conversor (gw2_conv_cache_v3) y los logros de Cuentas
 *          (gn:accounts:achmeta); ready() para esperar a que termine de abrir.
 *          1.0.0 (2026-10-26)
 *
 * localStorage tiene ~5 M de caracteres por sitio y lo comparten tus datos (Keys, ajustes, fijados)
 * con los cachés que se pueden volver a pedir a la API. Este módulo saca los cachés de ahí:
 *  - handles(key): ¿esta clave es un caché? (por prefijo; tus datos nunca lo son);
 *  - get/set/has/del: lectura y escritura SÍNCRONAS desde una copia en memoria (como hoy con
 *    localStorage); la escritura a IndexedDB va después, en lote, sin frenar la pantalla;
 *  - al arrancar lee IndexedDB y muda los cachés que todavía están en localStorage:
 *    primero los copia, y recién cuando IndexedDB confirma, los borra de localStorage;
 *  - clear(): vacía todos los cachés (memoria, IndexedDB y lo que quede en localStorage).
 * Si el navegador no tiene IndexedDB (o falla al abrir), handles() devuelve false y quien llama
 * sigue usando localStorage como siempre: nunca rompe.
 * Los valores se guardan como texto JSON: cada get() devuelve un objeto nuevo, igual que hoy.
 * BLS-2: index.html lo carga (sin defer) y js/api-gw2.js le delega sus cachés (lsGet/lsSet/lsDel/lsHas).
 */
(function (root) {
  'use strict';
  var VERSION = '1.2.0';
  var DB_NAME = 'gn-cache', STORE = 'kv', DB_VERSION = 1;
  var DEL = {}; // marca de borrado en la cola de escritura
  var DEFAULT_PREFIXES = ['items_cache_v1:', 'items_cache_armory_v1', 'ach_meta_v3:', 'ach_acc', 'commerce_listings',
    'commerce_prices:', 'currencies_all:', 'gw2_conv_cache_v3', 'gn:accounts:achmeta'];
  // BLS-4: restos de versiones viejas que ya no lee ningún módulo (sondas RUN-146 a 148). Se borran al cargar.
  var DEAD = ['items_cache_v1', 'gw2_conv_cache_v1', 'gw2_conv_cache_v2', 'gh_token_encrypted', 'gh_gist_id',
    'gn:github:token', 'gn:github:gist_id', 'gn:github:last_upload'];
  var DEAD_PREFIXES = ['psna:', 'characters:cached', 'gn:characters:cached', 'gn:activities:psna:', 'gn:achievements:cache:', 'ach_meta_v1:'];
  var VAULT_OLD = 'accounts:lastFile', VAULT_NEW = 'accounts:vault2'; // la copia vieja del Llavero sobra cuando está la nueva (D3)

  var st = {
    prefixes: DEFAULT_PREFIXES.slice(), enabled: false, hydrated: false, db: null, idb: null, ls: null,
    mem: new Map(), queue: new Map(), timer: null, ready: null, migrated: 0, swept: 0, error: null
  };

  function lsGet(k) { try { return st.ls ? st.ls.getItem(k) : null; } catch (_) { return null; } }
  function lsDel(k) { try { if (st.ls) st.ls.removeItem(k); } catch (_) {} }
  function lsKeys() {
    var out = [];
    try { for (var i = 0; st.ls && i < st.ls.length; i++) out.push(st.ls.key(i)); } catch (_) {}
    return out;
  }

  function matches(key) {
    key = String(key);
    for (var i = 0; i < st.prefixes.length; i++) if (key.indexOf(st.prefixes[i]) === 0) return true;
    return false;
  }
  /** ¿Esta clave la guardo yo? Solo si es un caché y hay IndexedDB. */
  function handles(key) { return st.enabled && matches(key); }

  function isDead(key) {
    key = String(key);
    if (DEAD.indexOf(key) >= 0) return true;
    for (var i = 0; i < DEAD_PREFIXES.length; i++) if (key.indexOf(DEAD_PREFIXES[i]) === 0) return true;
    return false;
  }
  /** Borra de localStorage los restos viejos y, si ya está el Llavero nuevo, la copia vieja. Devuelve lo borrado. */
  function sweep() {
    var gone = lsKeys().filter(isDead);
    if (lsGet(VAULT_NEW) != null && lsGet(VAULT_OLD) != null) gone.push(VAULT_OLD);
    gone.forEach(lsDel);
    st.swept += gone.length;
    return gone;
  }

  function raw(key) {
    key = String(key);
    if (st.mem.has(key)) return st.mem.get(key);
    if (st.queue.get(key) === DEL) return null;
    return st.hydrated ? null : lsGet(key); // antes de leer IndexedDB, lo viejo sigue en localStorage
  }
  function get(key) {
    var s = raw(key);
    if (s == null) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function has(key) { return raw(key) != null; }
  function set(key, val) {
    var s;
    try { s = JSON.stringify(val); } catch (_) { return false; }
    if (s === undefined) return false;
    key = String(key);
    st.mem.set(key, s);
    enqueue(key, s);
    return true;
  }
  function del(key) {
    key = String(key);
    st.mem.delete(key);
    enqueue(key, DEL);
    lsDel(key);
  }

  function enqueue(key, v) {
    st.queue.set(key, v);
    if (!st.timer && st.db) st.timer = setTimeout(function () { st.timer = null; flush(); }, 50);
  }

  /** Escribe la cola en IndexedDB en una sola transacción. Resuelve true cuando IndexedDB confirma. */
  function flush() {
    if (!st.db || !st.queue.size) return Promise.resolve(!!st.db);
    var batch = st.queue; st.queue = new Map();
    return new Promise(function (resolve) {
      try {
        var tx = st.db.transaction(STORE, 'readwrite'), os = tx.objectStore(STORE);
        batch.forEach(function (v, k) { if (v === DEL) os['delete'](k); else os.put(v, k); });
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = tx.onabort = function () { resolve(false); };
      } catch (e) { st.error = String(e && e.message || e); resolve(false); }
    });
  }

  function open() {
    return new Promise(function (resolve, reject) {
      var req = st.idb.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error || new Error('no se pudo abrir IndexedDB')); };
    });
  }

  function readAll(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly'), os = tx.objectStore(STORE), keys = null, vals = null;
      function done() { if (keys && vals) resolve({ keys: keys, vals: vals }); }
      var rk = os.getAllKeys(), rv = os.getAll();
      rk.onsuccess = function (e) { keys = e.target.result || []; done(); };
      rv.onsuccess = function (e) { vals = e.target.result || []; done(); };
      rk.onerror = rv.onerror = function () { reject(new Error('no se pudo leer IndexedDB')); };
    });
  }

  /** Muda a IndexedDB los cachés que siguen en localStorage. Borra de localStorage solo tras confirmar. */
  function migrate() {
    var moved = [];
    lsKeys().forEach(function (k) {
      if (!matches(k)) return;
      var s = lsGet(k);
      if (s == null) return;
      if (!st.mem.has(k)) { st.mem.set(k, s); st.queue.set(k, s); }
      moved.push(k);
    });
    return flush().then(function (ok) {
      if (ok) { moved.forEach(lsDel); st.migrated += moved.length; }
      return ok ? moved.length : 0;
    });
  }

  function init(opts) {
    opts = opts || {};
    if (st.ready) return st.ready;
    st.idb = opts.indexedDB || root.indexedDB || null;
    st.ls = opts.localStorage || root.localStorage || null;
    if (Array.isArray(opts.prefixes)) st.prefixes = opts.prefixes.slice();
    sweep();
    if (!st.idb || typeof st.idb.open !== 'function') { st.hydrated = true; st.ready = Promise.resolve(false); return st.ready; }
    st.enabled = true;
    st.ready = open().then(function (db) {
      st.db = db;
      return readAll(db);
    }).then(function (all) {
      all.keys.forEach(function (k, i) {
        // Lo que se escribió o borró mientras abría es más nuevo que lo guardado.
        if (isDead(k)) { st.queue.set(k, DEL); return; } // lo que una versión anterior mudó y ya nadie lee
        if (!st.mem.has(k) && !st.queue.has(k) && typeof all.vals[i] === 'string') st.mem.set(k, all.vals[i]);
      });
      return migrate();
    }).then(function () {
      st.hydrated = true;
      return flush();
    }).then(function () { return true; }, function (e) {
      // Sin IndexedDB usable: quien llama vuelve a localStorage; lo que quedó en memoria vale para esta sesión.
      st.error = String(e && e.message || e); st.enabled = false; st.hydrated = true; st.db = null;
      return false;
    });
    return st.ready;
  }

  /** Vacía todos los cachés: memoria, IndexedDB y los que quedaran en localStorage. Tus datos no se tocan. */
  function clear() {
    var n = st.mem.size;
    st.mem.clear(); st.queue.clear();
    lsKeys().forEach(function (k) { if (matches(k)) { lsDel(k); n++; } });
    if (!st.db) return Promise.resolve(n);
    return new Promise(function (resolve) {
      try {
        var tx = st.db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = function () { resolve(n); };
        tx.onerror = tx.onabort = function () { resolve(n); };
      } catch (_) { resolve(n); }
    });
  }

  function stats() {
    var chars = 0;
    st.mem.forEach(function (s, k) { chars += k.length + s.length; });
    return { enabled: st.enabled, hydrated: st.hydrated, keys: st.mem.size, chars: chars, pending: st.queue.size, migrated: st.migrated, swept: st.swept, error: st.error };
  }

  root.GNIdb = {
    ready: function () { return st.ready || Promise.resolve(false); },
    sweep: sweep, isDead: isDead,
    version: VERSION, init: init, handles: handles, get: get, set: set, has: has, del: del, clear: clear,
    flush: flush, stats: stats, keys: function () { return Array.from(st.mem.keys()); },
    prefixes: function () { return st.prefixes.slice(); }, DEFAULT_PREFIXES: DEFAULT_PREFIXES.slice()
  };
  if (root.indexedDB && !root.GN_IDB_MANUAL) init();
})(typeof window !== 'undefined' ? window : globalThis);
