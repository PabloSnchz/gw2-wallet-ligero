/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente (mejorada)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.12.0-modular (2026-04-08) — Raids: getAccountRaids
 *
 * Cobertura de este archivo:
 *  - Token / permisos (tokeninfo)
 *  - Wallet + currencies (fallback AA)
 *  - Items batch (con caché por id)
 *  - Achievements (cuenta + metadatos)
 *  - Account info (con last_modified para detectar actividad)
 *  - Raids (getAccountRaids para seguimiento semanal)
 *  - Delegados Wizard’s Vault (retrocompatibles)
 *
 * Cambios v2.12.0:
 *  - NUEVA función getAccountRaids(token, opts) para obtener encuentros de raid completados
 *  - Endpoint: /v2/account/raids
 *  - TTL de 5 minutos (el reset es semanal)
 *  - Requiere permiso 'progression'
 *
 * Cambios v2.11.0:
 *  - NUEVA función getAccountInfo(token) que devuelve last_modified
 *  - ELIMINADA lógica de PvP (getPvPGames, isRecentlyActiveInPvP)
 *  - La detección de actividad ahora se basa en last_modified de /v2/account
 *  - last_modified se actualiza con CUALQUIER cambio en la cuenta
 *
 * Cambios v2.10.0:
 *  - Eliminada función isInActivePvPGame (no servía para tiempo real)
 *  - Nueva función isRecentlyActiveInPvP(games, minutesThreshold)
 *
 * Cambios v2.9.0:
 *  - Eliminada función getCharactersAgeMap
 *  - Nueva función getPvPGames(token) con detalles de partidas
 *
 * Cambios v2.7.0-modular:
 *  - Nuevo fetchWithRetry() con backoff exponencial + jitter
 *  - De-duplicación de concurrencia (inflight promises)
 *  - Idioma configurable en __cfg.LANG + __cfg.setLang(lang)
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms) — mantenemos los existentes
  var TTL = {
    TOKENINFO:   10 * 60 * 1000,            // 10 min
    ACCOUNT:     30 * 1000,                 // 30 segundos (para detectar actividad reciente)
    RAIDS:        5 * 60 * 1000,            // 5 minutos (el reset es semanal)
    WV_SEASON:    6 * 60 * 60 * 1000,       // 6 h  (delegado)
    WV_LISTINGS: 30 * 60 * 1000,            // 30 min (delegado)
    WV_ACCOUNT:   5 * 60 * 1000,            // 5 min (delegado)
    WV_OBJ:       5 * 60 * 1000,            // 5 min (delegado)
    ITEMS:       24 * 60 * 60 * 1000,       // 24 h (por id)
    CURR:         7 * 24 * 60 * 60 * 1000,  // 7 días
    WALLET:       2 * 60 * 1000,            // 2 min
    ACH_ACC:      2 * 60 * 1000,            // 2 min
    ACH_META:    12 * 60 * 60 * 1000        // 12 h
  };

  // Config ampliable (aditivo a la API pública)
  var CFG = {
    API_BASE: API_BASE,
    TTL: TTL,
    LANG: 'es',          // idioma para endpoints localizables
    RETRIES: 2,          // reintentos ante 429/503/504
    RETRY_BASE_MS: 600   // base del backoff exponencial
  };

  // Caché en memoria e inflight (de-dupe de concurrencia)
  var __mem = new Map();       // mkey -> { ts, data }
  var __inflight = new Map();  // ikey -> Promise

  // Helpers caché persistente
  function lsGet(key) {
    try { var j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function now() { return Date.now(); }
  function isFresh(entry, ttl) { return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl; }

  // Fingerprint de token para namespaces por cuenta
  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0,4) + '…' + t.slice(-4)) : 'anon'; }

  // Construye claves (mem/LS)
  function kMem(base, token) { return token ? (base + '::' + fpToken(token)) : base; }
  function kLS(base, token)  { return token ? (base + ':'  + fpToken(token)) : base; }

  // De-dup concurrente (si hay una promesa en vuelo para la misma clave, la reusamos)
  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }

  // Coerciones seguras
  function toNum(v, d) { var n = (v == null || v === '') ? NaN : +v; return isFinite(n) ? n : (d == null ? 0 : d); }

  // URL helpers
  function withToken(url, token) { var u = new URL(url); if (token) u.searchParams.set('access_token', token); return u.toString(); }
  function withParams(url, params) {
    var u = new URL(url);
    if (params) Object.keys(params).forEach(function (k) {
      var val = params[k];
      if (val != null) u.searchParams.set(k, String(val));
    });
    return u.toString();
  }

  // HTTP base
  function jfetch(url, opts) {
    opts = opts || {};
    var nocache = !!opts.nocache;
    var headers = Object.assign({ 'Accept': 'application/json' }, (opts.headers || {}));
    var init = {
      headers: headers,
      cache: nocache ? 'no-store' : 'default',
      mode: 'cors'
    };
    if (opts.signal) init.signal = opts.signal;

    return fetch(url, init).then(function (res) {
      return res.text().then(function (raw) {
        if (!res.ok) {
          var msg = raw || ('HTTP ' + res.status);
          try {
            var o = raw ? JSON.parse(raw) : null;
            if (o && (o.text || o.error)) msg = o.text || o.error;
          } catch (_){}
          var err = new Error(msg); err.status = res.status; err.url = url; throw err;
        }
        try { return raw ? JSON.parse(raw) : null; }
        catch (e) { var er = new Error('JSON inválido en ' + url + ': ' + String(raw).slice(0,200)); er.url = url; throw er; }
      });
    });
  }

  // Reintentos con backoff (429/503/504)
  function fetchWithRetry(url, opts) {
    opts = opts || {};
    var max = (opts.retries != null) ? opts.retries : CFG.RETRIES;
    var attempt = 0;
    var lastErr;

    function jitter() { return Math.floor(Math.random() * 200); }

    function loop() {
      return jfetch(url, opts).catch(function (e) {
        lastErr = e;
        var retriable = e && (e.status === 429 || e.status === 503 || e.status === 504);
        if (!retriable || attempt >= max) throw lastErr;
        var backoff = Math.min(5000, CFG.RETRY_BASE_MS * Math.pow(2, attempt)) + jitter();
        attempt++;
        return new Promise(function (r) { setTimeout(r, backoff); }).then(loop);
      });
    }
    return loop();
  }

  // Lectura/escritura cachés (mem + LS con TTL)
  function getCache(baseKey, ttl, token, nocache) {
    if (nocache) return null;
    // 1) Memoria
    var mkey = kMem(baseKey, token);
    var mval = __mem.get(mkey);
    if (isFresh(mval, ttl)) return mval.data;
    // 2) LocalStorage
    var lkey = kLS(baseKey, token);
    var lval = lsGet(lkey);
    if (isFresh(lval, ttl)) {
      __mem.set(mkey, { ts: lval.ts, data: lval.data }); // rehidratar
      return lval.data;
    }
    return null;
  }
  function putCache(baseKey, data, token, ttl) {
    var entry = { ts: now(), data: data };
    __mem.set(kMem(baseKey, token), entry);
    lsSet(kLS(baseKey, token), entry);
  }

  // ========================================================================
  // Token info + permisos
  // ========================================================================
  function getTokenInfo(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'tokeninfo';
    var cached = getCache(key, TTL.TOKENINFO, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/tokeninfo', token);
    var ikey = 'if:tokeninfo:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.TOKENINFO);
        return data;
      });
    });
  }
  function tokenHasWVPermissions(tokenInfo) {
    try {
      var p = new Set((tokenInfo && tokenInfo.permissions) || []);
      // Con 'wizardsvault' o 'progression' alcanza para WV
      return p.has('wizardsvault') || p.has('progression');
    } catch (_){ return false; }
  }

  // ========================================================================
  // Account info (con last_modified para detectar actividad)
  // ========================================================================
  /**
   * Obtiene información básica de la cuenta, incluyendo last_modified
   * @param {string} token - API Key de la cuenta
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Object>} - Datos de la cuenta { id, name, age, last_modified, ... }
   */
  function getAccountInfo(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_info';
    var cached = getCache(key, TTL.ACCOUNT, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account?v=latest', token);
    var ikey = 'if:account_info:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.ACCOUNT);
        return data;
      });
    });
  }

  /**
   * Determina si una cuenta ha tenido actividad reciente basado en last_modified
   * @param {Object} accountInfo - Datos de getAccountInfo()
   * @param {number} minutesThreshold - Umbral en minutos (default 10)
   * @returns {boolean} - true si hubo actividad en el período
   */
  function isRecentlyActive(accountInfo, minutesThreshold) {
    if (!accountInfo || !accountInfo.last_modified) return false;
    
    var threshold = (minutesThreshold || 10) * 60 * 1000;
    var now = Date.now();
    var lastModified = new Date(accountInfo.last_modified).getTime();
    
    if (isNaN(lastModified)) return false;
    
    return (now - lastModified) <= threshold;
  }

  // ========================================================================
  // Raids - Obtener encuentros completados en la semana actual
  // ========================================================================
  /**
   * Obtiene los encuentros de raid completados en la semana actual
   * @param {string} token - API Key (requiere permiso 'progression')
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<string[]>} - Array de IDs de encuentros (ej: ["vale_guardian", "gorseval"])
   */
  function getAccountRaids(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_raids';
    var ttl = TTL.RAIDS;
    
    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/raids', token);
    var ikey = 'if:account_raids:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var raids = Array.isArray(data) ? data : [];
        putCache(key, raids, token, ttl);
        return raids;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account raids:', error);
        // Si hay error (ej: falta permiso progression), devolvemos array vacío
        return [];
      });
    });
  }

  // ========================================================================
  // Wallet / Currencies (fallback para Astral Acclaim)
  // ========================================================================
  function getAccountWallet(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'wallet';
    var cached = getCache(key, TTL.WALLET, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/wallet', token);
    var ikey = 'if:wallet:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.WALLET);
        return data;
      });
    });
  }

  function getCurrenciesAll(opts) {
    opts = opts || {};
    var key = 'currencies_all:' + CFG.LANG;
    var cached = getCache(key, TTL.CURR, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withParams(CFG.API_BASE + '/v2/currencies', { ids: 'all', lang: CFG.LANG });
    var ikey = 'if:currencies_all:' + CFG.LANG;

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, null, TTL.CURR);
        return data;
      });
    });
  }

  function getAstralAcclaimBalance(token, opts) {
    opts = opts || {};
    return Promise.all([
      getAccountWallet(token, { nocache: !!opts.nocache }),
      getCurrenciesAll({ nocache: !!opts.nocache })
    ]).then(function (arr) {
      var wallet = arr[0] || [];
      var currs  = arr[1] || [];
      var aaMeta = currs.find(function (c) {
        var n = String(c && c.name || '').toLowerCase();
        return n.includes('astral') || n.includes('reconocimiento'); // ES: "Reconocimiento Astral"
      });
      if (!aaMeta) return { value: 0, meta: { icon: null, id: null } };
      var w = wallet.find(function (x) { return x.id === aaMeta.id; });
      var value = Number(w && w.value || 0);
      return { value: value, meta: { icon: aaMeta.icon || null, id: aaMeta.id } };
    });
  }

  // ========================================================================
  // Achievements (cuenta + metadatos)
  // ========================================================================
  function getAccountAchievements(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'ach_acc';
    var cached = getCache(key, TTL.ACH_ACC, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/achievements', token);
    var ikey = 'if:ach_acc:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.ACH_ACC);
        return data;
      });
    });
  }

  function getAchievementsMeta(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    if (!ids.length) return Promise.resolve([]);

    var out = [];
    var chunk = 200;

    var chain = Promise.resolve();
    for (var i=0; i<ids.length; i+=chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var key = 'ach_meta:' + CFG.LANG + ':' + slice.join(',');
          var cached = getCache(key, TTL.ACH_META, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }

          var url = withParams(CFG.API_BASE + '/v2/achievements', { ids: slice.join(','), lang: CFG.LANG });
          var ikey = 'if:' + key;

          return inflightOnce(ikey, function () {
            return fetchWithRetry(url, opts).then(function (data) {
              data = data || [];
              putCache(key, data, null, TTL.ACH_META);
              out = out.concat(data);
            });
          });
        });
      })(ids.slice(i, i+chunk));
    }
    return chain.then(function () { return out; });
  }

  // ========================================================================
  // Items batch (con caché por id persistente)
  // ========================================================================
  function getItemsMany(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function (x) { return x != null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    var lkey = 'items_cache_v1:' + CFG.LANG;
    var bag = lsGet(lkey) || { ts: 0, data: {} };
    var per = bag.data || {}; // { [id]: { ts, val } }

    var out = [];
    var missing = [];
    ids.forEach(function (id) {
      var k = String(id);
      var c = per[k];
      if (!opts.nocache && c && isFresh(c, TTL.ITEMS)) {
        out.push(c.val);
      } else {
        missing.push(id);
      }
    });

    var chain = Promise.resolve();
    var chunk = 200;
    for (var i=0; i<missing.length; i+=chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var url = withParams(CFG.API_BASE + '/v2/items', { ids: slice.join(','), lang: CFG.LANG });
          var ikey = 'if:items:' + CFG.LANG + ':' + slice.join(',');
          return inflightOnce(ikey, function () {
            return fetchWithRetry(url, opts).then(function (arr) {
              (arr || []).forEach(function (it) {
                out.push(it);
                per[String(it.id)] = { ts: now(), val: it };
              });
            }).catch(function (e) {
              console.warn(LOGP, 'items batch error', e);
            });
          });
        });
      })(missing.slice(i, i+chunk));
    }

    return chain.then(function () {
      lsSet(lkey, { ts: now(), data: per });
      return out;
    });
  }

  // ========================================================================
  // WV — Delegados (retrocompatibilidad)
  // ========================================================================
  function _WV(){
    var WV = (typeof root !== 'undefined' && root.WizardsVault) ? root.WizardsVault : null;
    if (!WV) throw new Error('WizardsVault no cargado. Incluí js/wizards-vault.js después de api-gw2.js.');
    return WV;
  }
  function getWVSeason(opts){                return _WV().getWVSeason(opts); }
  function getWVDaily(token, opts){          return _WV().getWVDaily(token, opts); }
  function getWVWeekly(token, opts){         return _WV().getWVWeekly(token, opts); }
  function getWVSpecial(token, opts){        return _WV().getWVSpecial(token, opts); }
  function getWVAccount(token, opts){        return _WV().getWVAccount(token, opts); }
  function getWVListings(opts){              return _WV().getWVListings(opts); }
  function getAccountWVListings(token, opts){return _WV().getAccountWVListings(token, opts); }
  function wvComputeRemaining(limit, purchased, marked){ return _WV().wvComputeRemaining(limit, purchased, marked); }
  function wvMergeShopListings(acc, glb){    return _WV().wvMergeShopListings(acc, glb); }
  function getWVShopMerged(token, opts){     return _WV().getWVShopMerged(token, opts); }
  function wvInvalidateTargets(token){       return _WV().wvInvalidateTargets(token); }
  function wvPreloadTargets(token, opts){    return _WV().wvPreloadTargets(token, opts); }

  // ========================================================================
  // Utilidades públicas de debug
  // ========================================================================
  function indexArrayByKey(arr, key) {
    var map = new Map();
    (arr || []).forEach(function (o) { if (o && o[key] != null) map.set(o[key], o); });
    return map;
  }
  function cacheClear() {
    try { __mem.clear(); __inflight.clear(); } catch (_){}
  }

  // ========================================================================
  // API pública
  // ========================================================================
  var API = {
    // Token / Permisos
    getTokenInfo: getTokenInfo,
    tokenHasWVPermissions: tokenHasWVPermissions,

    // Account info (con last_modified para detectar actividad)
    getAccountInfo: getAccountInfo,
    isRecentlyActive: isRecentlyActive,

    // Raids
    getAccountRaids: getAccountRaids,

    // Wallet / Currencies (fallback AA)
    getAccountWallet: getAccountWallet,
    getCurrenciesAll: getCurrenciesAll,
    getAstralAcclaimBalance: getAstralAcclaimBalance,

    // Achievements
    getAccountAchievements: getAccountAchievements,
    getAchievementsMeta: getAchievementsMeta,

    // Wizard’s Vault (delegados)
    getWVSeason: getWVSeason,
    getWVDaily: getWVDaily,
    getWVWeekly: getWVWeekly,
    getWVSpecial: getWVSpecial,
    getWVAccount: getWVAccount,
    getWVListings: getWVListings,
    getAccountWVListings: getAccountWVListings,

    // Shop helpers (delegados)
    wvComputeRemaining: wvComputeRemaining,
    wvMergeShopListings: wvMergeShopListings,
    getWVShopMerged: getWVShopMerged,

    // Items
    getItemsMany: getItemsMany,

    // WV targets helpers (delegados)
    wvInvalidateTargets: wvInvalidateTargets,
    wvPreloadTargets: wvPreloadTargets,

    // Debug / util
    __cfg: {
      API_BASE: CFG.API_BASE,
      TTL: CFG.TTL,
      LANG: CFG.LANG,
      setLang: function (lang) { if (lang) CFG.LANG = String(lang); },
      setRetries: function (n) { var x = +n; if (isFinite(x) && x >= 0 && x <= 5) CFG.RETRIES = x|0; }
    },
    __cacheClear: cacheClear,
    __indexArrayByKey: indexArrayByKey
  };

  root.GW2Api = API;
  console.info(LOGP, 'listo — métodos:', Object.keys(API).join(', '), 'lang=' + CFG.LANG, 'retries=' + CFG.RETRIES);

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));