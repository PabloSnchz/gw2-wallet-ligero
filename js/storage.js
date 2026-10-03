/* eslint-disable no-console */
/**
 * storage.js v1.1.0 — Centralización de localStorage
 * 
 * Único punto de acceso a localStorage en toda la app.
 * 
 * Convención: todas las claves usan prefijo 'gn:' (Gato Negro).
 * 
 * MIGRATION_PREFIXES: lista de prefijos viejos → nuevos.
 *   Se ejecuta una vez al init. Migra todas las claves que
 *   empiecen con un prefijo viejo al nuevo.
 * 
 * MIGRATION_MODE:
 *   'copy' (Fase 1): solo copia, NO borra las claves viejas.
 *   'move' (Fase 4+): copia y borra.
 * 
 * FALLBACK: Storage.get('gn:account:keys') tiene fallback a
 *   'gw2_keys' si la clave nueva no existe.
 * 
 * NO toca: caches externos (psna:*, ach_*, etc).
 * 
 * DEBUG: si window.STORAGE_DEBUG es true, loguea errores en safe().
 */

(function () {
  'use strict';

  // ── DEBUG flag ─────────────────────────────────────────────
  const DEBUG = typeof window !== 'undefined' && window.STORAGE_DEBUG === true;

  // ── MIGRATION_MODE ─────────────────────────────────────────
  // 'copy' = solo copiar, no borrar viejas (Fase 1).
  // 'move' = copiar y borrar (Fase 4+, cuando todos los módulos usen Storage.get).
  const MIGRATION_MODE = 'copy';

  // ── Prefijo único ──────────────────────────────────────────
  const PREFIX = 'gn:';

  // ── Catálogo de claves estáticas (exportado como STORAGE_KEYS) ─
  const STATIC_KEYS = [
    'gn:account:keys', 'gn:account:selected', 'gn:account:last_file', 'gn:account:favs',
    'gn:activities:home:nodes', 'gn:activities:toggles', 'gn:activities:stones',
    'gn:global:welcome_seen', 'gn:theme',
    'gn:wallet:compact', 'gn:wallet:state', 'gn:wallet:sort', 'gn:wallet:currencies',
    'gn:wallet:pins', 'gn:wallet:snapshots', 'gn:wallet:dashboard:selected_currencies', 'gn:wallet:dashboard:sort',
    'gn:wv:season:index', 'gn:wv:season', 'gn:wv:shop:view', 'gn:wv:shop:legacy_filter',
    'gn:wv:last_tab', 'gn:wv:purchase:icon_url', 'gn:wv:purchase:open',
    'gn:inventory:selected_items', 'gn:inventory:active_set', 'gn:inventory:sort',
    'gn:inventory:active_tiers', 'gn:inventory:hide_zero',
    'gn:meta:compact', 'gn:meta:hecho_hoy', 'gn:meta:favs',
    'gn:raids:strike:view', 'gn:converter:state', 'gn:github:token', 'gn:github:gist_id',
  ];

  // ── STORAGE_KEYS: constantes nombradas para reemplazar strings hardcodeadas ──
  // USO: Storage.STORAGE_KEYS.WALLET_COMPACT en lugar de 'walletCompact'
  // Todas usan prefijo gn: consistente.
  var STORAGE_KEYS = {
    ACCOUNT_KEYS:          'gn:account:keys',
    ACCOUNT_SELECTED:      'gn:account:selected',
    ACCOUNT_LAST_FILE:     'gn:account:last_file',
    ACCOUNT_FAVS:          'gn:account:favs',
    ACTIVITIES_HOME_NODES: 'gn:activities:home:nodes',
    ACTIVITIES_TOGGLES:    'gn:activities:toggles',
    ACTIVITIES_STONES:     'gn:activities:stones',
    GLOBAL_WELCOME_SEEN:   'gn:global:welcome_seen',
    THEME:                 'gn:theme',
    WALLET_COMPACT:        'gn:wallet:compact',
    WALLET_STATE:          'gn:wallet:state',
    WALLET_SORT:           'gn:wallet:sort',
    WALLET_CURRENCIES:     'gn:wallet:currencies',
    WALLET_PINS:           'gn:wallet:pins',
    WALLET_SNAPSHOTS:      'gn:wallet:snapshots',
    WALLET_DASHBOARD_CURR: 'gn:wallet:dashboard:selected_currencies',
    WALLET_DASHBOARD_SORT: 'gn:wallet:dashboard:sort',
    WV_SEASON_INDEX:       'gn:wv:season:index',
    WV_SHOP_VIEW:          'gn:wv:shop:view',
    WV_SHOP_LEGACY_FILTER: 'gn:wv:shop:legacy_filter',
    WV_LAST_TAB:           'gn:wv:last_tab',
    WV_PURCHASE_ICON_URL:  'gn:wv:purchase:icon_url',
    WV_PURCHASE_OPEN:      'gn:wv:purchase:open',
    INVENTORY_SELECTED:    'gn:inventory:selected_items',
    INVENTORY_ACTIVE_SET:  'gn:inventory:active_set',
    INVENTORY_SORT:        'gn:inventory:sort',
    INVENTORY_ACTIVE_TIERS:'gn:inventory:active_tiers',
    INVENTORY_HIDE_ZERO:   'gn:inventory:hide_zero',
    META_COMPACT:          'gn:meta:compact',
    META_HECHO_HOY:        'gn:meta:hecho_hoy',
    META_FAVS:             'gn:meta:favs',
    RAIDS_STRIKE_VIEW:     'gn:raids:strike:view',
    CONVERTER_STATE:       'gn:converter:state',
    GITHUB_TOKEN:          'gn:github:token',
    GITHUB_GIST_ID:        'gn:github:gist_id',
    // HB#120 T20-c: la foto local que se saca ANTES de sobrescribir por el Gist.
    // Vive bajo 'github:' a proposito, asi que KNOWN_NAMESPACES la trae de vuelta
    // si alguien restaura un backup: una foto de seguridad que se puede perder
    // con la misma restauracion que pretendia recuperar no es una red.
    GIST_SAFETY_SNAPSHOT:  'gn:github:gist_snapshot',
    // HB#135 T20-b: el instante de la ULTIMA SUBIDA al Gist. Es la referencia
    // que hace falta para que el confirm de la descarga diga la DIRECCION: sin
    // ella, "el remoto esta viejo" no se puede contestar, porque el `exportedAt`
    // del propio JSON lo genera `exportData()` en el mismo comando que lo sube
    // y el remoto sale siempre mas nuevo. Mismo namespace que la foto, por el
    // mismo motivo: si se pierde en un restore, la comparacion deja de poder
    //Responderse y vuelve al default honesto ("no se pudo leer").
    GIST_LAST_UPLOAD:      'gn:github:last_upload',
    CHARACTERS_ASSIGNMENTS:    'gn:characters:assignments:',
    CHARACTERS_LOCATION_HISTORY: 'gn:characters:location_history:',
    PSNA_CACHE:            'gn:activities:psna:',
    ACHIEVEMENTS_CACHE:    'gn:achievements:cache:',
  };

  // ── Namespaces conocidos (para importAll) ──────────────────
  const KNOWN_NAMESPACES = [
    'account:', 'activities:', 'global:', 'theme:',
    'wallet:', 'wv:', 'inventory:', 'meta:',
    'raids:', 'converter:', 'github:', 'accounts:',
  ];

  // ── MIGRATION_PREFIXES: prefijos viejos → nuevos ────────────
  // Sin duplicados. 38 entradas: 18 exactas + 20 familias.
  const MIGRATION_PREFIXES = [
    { from: 'gw2_keys',                to: 'gn:account:keys' },
    { from: 'gw2_selected_key_v1',     to: 'gn:account:selected' },
    { from: 'gw2_favs',                to: 'gn:account:favs' },
    { from: 'gw2_wallet_pins_v1',      to: 'gn:wallet:pins' },
    { from: 'gw2_currencies_cache_v1', to: 'gn:wallet:currencies' },
    { from: 'gw2_meta_compact',        to: 'gn:meta:compact' },
    { from: 'gw2_wv_view_v1',          to: 'gn:wv:shop:view' },
    { from: 'gw2_wv_legacy_filter_v1', to: 'gn:wv:shop:legacy_filter' },
    { from: 'walletCompact',           to: 'gn:wallet:compact' },
    { from: 'gn_home_nodes_marked',    to: 'gn:activities:home:nodes' },
    { from: 'gn_activities_toggles',   to: 'gn:activities:toggles' },
    { from: 'wvpd_icon_url',           to: 'gn:wv:purchase:icon_url' },
    { from: 'wvpd_open',               to: 'gn:wv:purchase:open' },
    { from: 'raid_strike_view',        to: 'gn:raids:strike:view' },
    { from: 'gn_welcome_seen',         to: 'gn:global:welcome_seen' },
    { from: 'gh_token_encrypted',      to: 'gn:github:token' },
    { from: 'gh_gist_id',              to: 'gn:github:gist_id' },
    { from: 'wv:season:index',         to: 'gn:wv:season:index' },
    { from: 'wv:season:',              to: 'gn:wv:season:' },
    { from: 'walletPins:',             to: 'gn:wallet:pins:' },
    { from: 'walletSnapshot:',         to: 'gn:wallet:snapshots:' },
    { from: 'characters:',             to: 'gn:characters:' },
    { from: 'gn_meta_hecho_hoy:',      to: 'gn:meta:hecho_hoy:' },
    { from: 'gn_meta_favs:',           to: 'gn:meta:favs:' },
    { from: 'gw2_meta_favs',           to: 'gn:meta:favs' },
    { from: 'gn_activities_stones_',   to: 'gn:activities:stones:' },
    { from: 'gn_wallet_state',         to: 'gn:wallet:state' },
    { from: 'gn_wallet_sort',          to: 'gn:wallet:sort' },
    { from: 'gn_inv_sel_items',        to: 'gn:inventory:selected_items' },
    { from: 'gn_inv_active_set',       to: 'gn:inventory:active_set' },
    { from: 'gn_inv_sort',             to: 'gn:inventory:sort' },
    { from: 'gn_inv_active_tiers',     to: 'gn:inventory:active_tiers' },
    { from: 'gn_inv_hide_zero',        to: 'gn:inventory:hide_zero' },
    { from: 'gn_accounts_last_file',   to: 'gn:accounts:last_file' },
    { from: 'gn_wv_last_tab',           to: 'gn:wv:last_tab' },
    { from: 'gn_wv_legacy_filter_v1', to: 'gn:wv:shop:legacy_filter' },
    { from: 'gw2_wv_lasttab_v1', to: 'gn:wv:last_tab' },
    { from: 'gn_converter_state',      to: 'gn:converter:state' },
    { from: 'wallet_dashboard_selected_currencies', to: 'gn:wallet:dashboard:selected_currencies' },
    { from: 'wallet_dashboard_sort',                 to: 'gn:wallet:dashboard:sort' },
    { from: 'gn_theme',                to: 'gn:theme' },
  ];

  // ── FALLBACK_MAP: clave nueva → clave vieja de fallback ────
  const FALLBACK_MAP = {
    'gn:account:keys':         'gw2_keys',
    'gn:account:selected':     'gw2_selected_key_v1',
    'gn:account:favs':         'gw2_favs',
    'gn:wallet:pins':          'gw2_wallet_pins_v1',
    'gn:wallet:currencies':    'gw2_currencies_cache_v1',
    'gn:meta:compact':         'gw2_meta_compact',
    'gn:wv:shop:view':         'gw2_wv_view_v1',
    'gn:wv:shop:legacy_filter': ['gw2_wv_legacy_filter_v1', 'gn_wv_legacy_filter_v1'],
    'gn:wv:season:index':      'wv:season:index',
    'gn:global:welcome_seen':  'gn_welcome_seen',
    'gn:theme':                'gn_theme',
    'gn:converter:state':      'gn_converter_state',
    'gn:wallet:compact':       'walletCompact',
    'gn:wallet:state':         'gn_wallet_state',
    'gn:wallet:sort':          'gn_wallet_sort',
    'gn:inventory:selected_items': 'gn_inv_sel_items',
    'gn:inventory:active_set':     'gn_inv_active_set',
    'gn:inventory:sort':           'gn_inv_sort',
    'gn:inventory:active_tiers':   'gn_inv_active_tiers',
    'gn:inventory:hide_zero':      'gn_inv_hide_zero',
    'gn:activities:home:nodes':    'gn_home_nodes_marked',
    'gn:activities:toggles':       'gn_activities_toggles',
    'gn:activities:stones':        'gn_activities_stones_',
    'gn:accounts:last_file':       'gn_accounts_last_file',
    'gn:github:token':             'gh_token_encrypted',
    'gn:github:gist_id':           'gh_gist_id',
    'gn:raids:strike:view':        'raid_strike_view',
    'gn:wallet:dashboard:selected_currencies': 'wallet_dashboard_selected_currencies',
    'gn:wallet:dashboard:sort':              'wallet_dashboard_sort',
    'gn:wv:purchase:icon_url':     'wvpd_icon_url',
    'gn:wv:purchase:open':         'wvpd_open',
    'gn:wv:last_tab':              ['gn_wv_last_tab', 'gw2_wv_lasttab_v1'],
    'gn:meta:favs':                'gw2_meta_favs',
    'gn:meta:hecho_hoy':           'gn_meta_hecho_hoy:',
  };

  // ── MIRROR_MAP: la legacy SIGUE siendo la fuente de verdad ────
  //
  // Estas claves tienen un problema que FALLBACK_MAP no puede resolver por si
  // solo. Un modulo escribe la legacy a pelo (localStorage.setItem) y otro lee
  // la gn: con Storage.get. Como _migrateOne arranca con
  // `if (hasRaw(newKey)) return`, la gn: queda con la foto del PRIMER arranque
  // y no se refresca nunca: no esta desactualizada, esta CONGELADA. Y no hay
  // forma de notarlo, porque Storage.get devuelve un array bien formado.
  //
  // El caso caro es gn:account:keys: es la lista de cuentas, y la gn: es la
  // que sube el Gist (settings-manager.js). Con la foto congelada, el backup
  // sube una lista vieja; y al importar en un navegador nuevo, el import
  // escribe la gn: mientras app.js lee la legacy -> la app arranca vacia.
  //
  // DECLARACION, no heuristica: para estas claves la legacy manda. Se lee
  // primero, se escribe en las dos, y al arrancar la gn: se resincroniza
  // desde la legacy. Las claves que NO estan aca siguen el comportamiento
  // anterior (la gn: es la nueva, la legacy es solo el fallback de la
  // migracion) — que es el correcto para las que ya no tienen escritor crudo.
  const MIRROR_MAP = {
    'gn:account:keys':            'gw2_keys',
    'gn:account:selected':        'gw2_selected_key_v1',
    'gn:activities:home:nodes':   'gn_home_nodes_marked',
    'gn:activities:toggles':      'gn_activities_toggles',
  };

  /** Nombre de la legacy espejo de una gn:, o null si no es una clave espejo. */
  function mirrorOf(key) {
    return Object.prototype.hasOwnProperty.call(MIRROR_MAP, key) ? MIRROR_MAP[key] : null;
  }

  // ── Utilidades internas ────────────────────────────────────
  function safe(fn, fallback, context) {
    try { return fn(); } catch (e) {
      if (DEBUG) console.warn('[Storage]' + (context ? ' ' + context : '') + ':', e.message || e);
      return fallback;
    }
  }

  function isValidKey(key) {
    if (typeof key !== 'string') return false;
    if (key.indexOf(PREFIX) !== 0) return false;
    var rest = key.slice(PREFIX.length);
    for (var i = 0; i < KNOWN_NAMESPACES.length; i++) {
      if (rest.indexOf(KNOWN_NAMESPACES[i]) === 0) return true;
    }
    return false;
  }

  // ── API pública ────────────────────────────────────────────
  var STORAGE_KEYS_PUBLIC = STORAGE_KEYS;

  const Storage = {

    PREFIX: PREFIX,
    DEBUG: DEBUG,
    MIGRATION_MODE: MIGRATION_MODE,
    STORAGE_KEYS: STORAGE_KEYS_PUBLIC,

    get: function (key, fallback) {
      // Clave espejo: la legacy es la fuente de verdad, asi que se lee PRIMERO.
      // Sin esto, el que lee la gn: ve la foto del primer arranque.
      var mir = mirrorOf(key);
      if (mir) {
        var mRaw = safe(function () { return localStorage.getItem(mir); }, null, 'getMirror');
        if (mRaw !== null) {
          try { return JSON.parse(mRaw); } catch (_) { return mRaw; }
        }
      }
      var raw = safe(function () { return localStorage.getItem(key); }, null, 'get');
      if (raw !== null) {
        try { return JSON.parse(raw); } catch (_) { return raw; }
      }
      var oldKey = FALLBACK_MAP[key];
      var oldKeys = Array.isArray(oldKey) ? oldKey : [oldKey];
        for (var i = 0; i < oldKeys.length; i++) {
          var oldRaw = safe(function () { return localStorage.getItem(oldKeys[i]); }, null, 'getFallback');
          if (oldRaw !== null) {
            try { return JSON.parse(oldRaw); } catch (_) { return oldRaw; }
          }
        }
      return fallback !== undefined ? fallback : null;
    },

    getRaw: function (key, fallback) {
      var mir2 = mirrorOf(key);
      if (mir2) {
        var mRaw2 = safe(function () { return localStorage.getItem(mir2); }, null, 'getRawMirror');
        if (mRaw2 !== null) return mRaw2;
      }
      var raw = safe(function () { return localStorage.getItem(key); }, null, 'getRaw');
      if (raw !== null) return raw;
      var oldKey = FALLBACK_MAP[key];
      var oldKeys = Array.isArray(oldKey) ? oldKey : [oldKey];
        for (var i = 0; i < oldKeys.length; i++) {
          var oldRaw = safe(function () { return localStorage.getItem(oldKeys[i]); }, null, 'getRawFallback');
          if (oldRaw !== null) return oldRaw;
        }
      return fallback !== undefined ? fallback : null;
    },

    set: function (key, value) {
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      safe(function () { localStorage.setItem(key, str); }, null, 'set');
      // Clave espejo: se escribe en las DOS. El import del Gist entra por aca,
      // y si solo escribiera la gn: la app arrancaria sin cuentas en un
      // navegador limpio (no existe la legacy y app.js la lee a pelo).
      var mir = mirrorOf(key);
      if (mir) safe(function () { localStorage.setItem(mir, str); }, null, 'setMirror');
    },

    remove: function (key) {
      safe(function () { localStorage.removeItem(key); }, null, 'remove');
      // Clave espejo: si se borra solo la gn:, la legacy revive el valor en el
      // siguiente arranque por el resync. Se borran las dos.
      var mir = mirrorOf(key);
      if (mir) safe(function () { localStorage.removeItem(mir); }, null, 'removeMirror');
    },

    has: function (key) {
      if (safe(function () { return localStorage.getItem(key) !== null; }, false, 'has')) return true;
      var oldKey = FALLBACK_MAP[key];
        if (oldKey) {
          var oldKeys = Array.isArray(oldKey) ? oldKey : [oldKey];
          for (var i = 0; i < oldKeys.length; i++) {
            if (safe(function () { return localStorage.getItem(oldKeys[i]) !== null; }, false, 'hasFallback')) return true;
          }
        }
      return false;
    },

    // hasRaw: igual que has() pero SIN fallback. Solo chequea localStorage directamente.
    // USO: _migrateOne y migrate() necesitan saber si la clave NUEVA ya existe
    // sin que el fallback les dé falso positivo.
    hasRaw: function (key) {
      return safe(function () { return localStorage.getItem(key) !== null; }, false, 'hasRaw');
    },

    list: function (prefix) {
      var result = [];
      safe(function () {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(prefix) === 0) result.push(k);
        }
      }, null, 'list');
      return result;
    },

    // clearNamespace: recibe una lista explícita de sub-namespaces a borrar.
    // NO borra todo gn:wallet:*, solo lo que se indica.
    // USO: Storage.clearNamespace(['wallet:pins', 'wallet:snapshots']);
    clearNamespace: function (subNamespaces) {
      if (!Array.isArray(subNamespaces)) subNamespaces = [subNamespaces];
      var keysToDelete = [];
      subNamespaces.forEach(function (ns) {
        var prefix = 'gn:' + ns;
        Storage.list(prefix).forEach(function (k) { keysToDelete.push(k); });
        // legacyMap se deriva de FALLBACK_MAP para evitar duplicación.
        var _lk = FALLBACK_MAP['gn:' + ns];
        var legacy = _lk ? (Array.isArray(_lk) ? _lk : [_lk]) : [];
        legacy.forEach(function (k) { if (Storage.has(k)) keysToDelete.push(k); });
      });
      var unique = [], seen = {};
      keysToDelete.forEach(function (k) { if (!seen[k]) { seen[k] = true; unique.push(k); } });
      safe(function () {
        unique.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
      }, null, 'clearNamespace');
    },

    exportAll: function () {
      var result = {};
      safe(function () {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) {
            try { result[k] = JSON.parse(localStorage.getItem(k)); }
            catch (_) { result[k] = localStorage.getItem(k); }
          }
        }
      }, null, 'exportAll');
      return result;
    },

    importAll: function (data) {
      safe(function () {
        Object.keys(data).forEach(function (k) {
          if (!isValidKey(k)) {
            if (DEBUG) console.warn('[Storage] importAll: clave ignorada (no válida):', k);
            return;
          }
          var v = data[k];
          try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
          catch (_) {}
        });
      }, null, 'importAll');
    },

    migrate: function () {
      var migrated = [], failed = [];
      MIGRATION_PREFIXES.forEach(function (pair) {
        var from = pair.from, to = pair.to;
        var isFamily = from.slice(-1) === ':' || from.slice(-1) === '_';
        if (isFamily) {
          var keysToMigrate = [];
          safe(function () {
            for (var i = 0; i < localStorage.length; i++) {
              var k = localStorage.key(i);
              if (k && k.indexOf(from) === 0) keysToMigrate.push(k);
            }
          }, null, 'migrate:list');
          keysToMigrate.forEach(function (oldKey) {
            var newKey = to + oldKey.slice(from.length);
            Storage._migrateOne(oldKey, newKey, migrated, failed);
          });
        } else {
          // hasRaw: no usar has() porque si la clave nueva ya existe,
          // el fallback podría dar falso positivo y saltear la migración.
          if (Storage.hasRaw(from)) Storage._migrateOne(from, to, migrated, failed);
        }
      });
      if (failed.length) console.warn('[Storage] Migración falló para:', failed);
      if (migrated.length) console.info('[Storage] Migradas', migrated.length, 'claves (modo: ' + MIGRATION_MODE + '):', migrated.join(', '));
      Storage._resyncMirrors();
    },

    /* _resyncMirrors: la gn: CONGELADA se refresca desde su legacy.
     *
     * _migrateOne arranca con `if (hasRaw(newKey)) return`, y migrate() corre en
     * CADA arranque. O sea que para una gn: que ya existe, la migracion no la
     * vuelve a tocar nunca: se queda con la foto del primer arranque mientras un
     * modulo sigue escribiendo la legacy a pelo. Para las claves de MIRROR_MAP
     * eso es exactamente la condicion de congelacion, asi que la foto se
     * refresca aqui, en el mismo arranque, y solo si la legacy EXISTE.
     *
     * "Solo si la legacy existe" y no "si difieren": si la legacy no esta, no se
     * borra la gn:. Una gn: sola puede ser legitima (navegador nuevo, la legacy
     * todavia no se creo) y borrarla seria perder el dato.
     */
    _resyncMirrors: function () {
      var refreshed = [];
      Object.keys(MIRROR_MAP).forEach(function (gn) {
        var legacy = MIRROR_MAP[gn];
        var oldVal = safe(function () { return localStorage.getItem(legacy); }, null, 'resync');
        if (oldVal === null) return;
        if (oldVal === safe(function () { return localStorage.getItem(gn); }, null, 'resync')) return;
        try { localStorage.setItem(gn, oldVal); } catch (_) { return; }
        refreshed.push(gn);
      });
      if (refreshed.length) {
        console.info('[Storage] Claves resincronizadas desde su legacy:', refreshed.join(', '));
      }
      return refreshed;
    },

    _migrateOne: function (oldKey, newKey, migrated, failed) {
      // hasRaw: no usar has(newKey) porque el fallback haría que,
      // si newKey no existe pero oldKey sí, has() devolviera true
      // y la migración se salteara para siempre.
      if (Storage.hasRaw(newKey)) return;
      var oldVal;
      try {
        oldVal = localStorage.getItem(oldKey);
        if (oldVal === null) return;
      } catch (_) { failed.push(oldKey); return; }
      try { localStorage.setItem(newKey, oldVal); }
      catch (_) { failed.push(oldKey); return; }
      if (MIGRATION_MODE === 'move') {
        try { localStorage.removeItem(oldKey); }
        catch (_) {}
      }
      migrated.push(oldKey + ' → ' + newKey);
    },

    init: function () {
      Storage.migrate();
      console.info('[Storage] storage.js v1.1.0 inicializado. Prefijo:', PREFIX, '| Modo:', MIGRATION_MODE);
    },
  };

  window.Storage = Storage;
  if (document.readyState !== 'loading') {
    Storage.init();
  } else {
    document.addEventListener('DOMContentLoaded', Storage.init);
  }
})();