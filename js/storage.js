/* eslint-disable no-console */
/**
 * storage.js v1.0.1 — Centralización de localStorage
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

  // ── Catálogo de claves estáticas (para export/import) ──────
  const STATIC_KEYS = [
    'gn:account:keys', 'gn:account:selected', 'gn:account:last_file', 'gn:account:favs',
    'gn:activities:home:nodes', 'gn:activities:toggles', 'gn:activities:stones',
    'gn:global:welcome_seen', 'gn:theme',
    'gn:wallet:compact', 'gn:wallet:state', 'gn:wallet:sort', 'gn:wallet:currencies',
    'gn:wallet:pins', 'gn:wallet:snapshots',
    'gn:wv:season:index', 'gn:wv:season', 'gn:wv:shop:view', 'gn:wv:shop:legacy_filter',
    'gn:wv:last_tab', 'gn:wv:purchase:icon_url', 'gn:wv:purchase:open',
    'gn:inventory:selected_items', 'gn:inventory:active_set', 'gn:inventory:sort',
    'gn:inventory:active_tiers', 'gn:inventory:hide_zero',
    'gn:meta:compact', 'gn:meta:hecho_hoy', 'gn:meta:favs',
    'gn:raids:strike:view', 'gn:converter:state', 'gn:github:token', 'gn:github:gist_id',
  ];

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
    { from: 'gn_converter_state',      to: 'gn:converter:state' },
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
    'gn:wv:shop:legacy_filter': 'gw2_wv_legacy_filter_v1',
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
    'gn:wv:purchase:icon_url':     'wvpd_icon_url',
    'gn:wv:purchase:open':         'wvpd_open',
    'gn:wv:last_tab':              'gn_wv_last_tab',
  };

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
  const Storage = {

    PREFIX: PREFIX,
    DEBUG: DEBUG,
    MIGRATION_MODE: MIGRATION_MODE,

    get: function (key, fallback) {
      var raw = safe(function () { return localStorage.getItem(key); }, null, 'get');
      if (raw !== null) {
        try { return JSON.parse(raw); } catch (_) { return raw; }
      }
      var oldKey = FALLBACK_MAP[key];
      if (oldKey) {
        var oldRaw = safe(function () { return localStorage.getItem(oldKey); }, null, 'getFallback');
        if (oldRaw !== null) {
          try { return JSON.parse(oldRaw); } catch (_) { return oldRaw; }
        }
      }
      return fallback !== undefined ? fallback : null;
    },

    getRaw: function (key, fallback) {
      var raw = safe(function () { return localStorage.getItem(key); }, null, 'getRaw');
      if (raw !== null) return raw;
      var oldKey = FALLBACK_MAP[key];
      if (oldKey) {
        var oldRaw = safe(function () { return localStorage.getItem(oldKey); }, null, 'getRawFallback');
        if (oldRaw !== null) return oldRaw;
      }
      return fallback !== undefined ? fallback : null;
    },

    set: function (key, value) {
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      safe(function () { localStorage.setItem(key, str); }, null, 'set');
    },

    remove: function (key) {
      safe(function () { localStorage.removeItem(key); }, null, 'remove');
    },

    has: function (key) {
      if (safe(function () { return localStorage.getItem(key) !== null; }, false, 'has')) return true;
      var oldKey = FALLBACK_MAP[key];
      if (oldKey) return safe(function () { return localStorage.getItem(oldKey) !== null; }, false, 'hasFallback');
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
        var legacy = FALLBACK_MAP['gn:' + ns] ? [FALLBACK_MAP['gn:' + ns]] : [];
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
      console.info('[Storage] storage.js v1.0.1 inicializado. Prefijo:', PREFIX, '| Modo:', MIGRATION_MODE);
    },
  };

  window.Storage = Storage;
  if (document.readyState !== 'loading') Storage.init();
})();