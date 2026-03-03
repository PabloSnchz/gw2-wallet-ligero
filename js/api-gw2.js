/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente (base)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.6.2-modular (2026-03-03) — WV externalizado (delegado)
 *
 * Cobertura de este archivo:
 *  - Token / permisos (tokeninfo)
 *  - Wallet + currencies (fallback AA)
 *  - Items batch (con caché por id)
 *  - Achievements (cuenta + metadatos)
 *
 * Cambios vs 2.6.1:
 *  - Se extrae Wizard’s Vault a js/wizards-vault.js.
 *  - La API pública WV (getWV*, wv*) sigue existiendo aquí, pero delega.
 *  - Se remueve el listener 'gn:wv-targets-refresh' (lo maneja WV).
 *  - 100% retrocompatible: router/app siguen llamando GW2Api.* igual.
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms) — parte base (mantenemos las entradas preexistentes)
  var TTL = {
    TOKENINFO:   10 * 60 * 1000,            // 10 min
    WV_SEASON:    6 * 60 * 60 * 1000,       // 6 h  (delegado, lo conserva WV)
    WV_LISTINGS: 30 * 60 * 1000,            // 30 min (delegado)
    WV_ACCOUNT:   5 * 60 * 1000,            // 5 min (delegado)
    WV_OBJ:       5 * 60 * 1000,            // 5 min (delegado)
    ITEMS:       24 * 60 * 60 * 1000,       // 24 h (por id)
    CURR:         7 * 24 * 60 * 60 * 1000,  // 7 días
    WALLET:       2 * 60 * 1000,            // 2 min
    ACH_ACC:      2 * 60 * 1000,            // 2 min
    ACH_META:    12 * 60 * 60 * 1000        // 12 h
  };

  // Caché en memoria
  var __mem = new Map();

  // Helpers caché persistente
  function lsGet(key) {
    try { var j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
  function now() { return Date.now(); }
  function isFresh(entry, ttl) {
    return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl;
  }

  // Fingerprint de token para namespaces por cuenta
  function fpToken(token) {
    var t = String(token || '');
    return t ? (t.slice(0,4) + '…' + t.slice(-4)) : 'anon';
  }

  // Construye claves (mem/LS)
  function kMem(base, token) { return token ? (base + '::' + fpToken(token)) : base; }
  function kLS(base, token)  { return token ? (base + ':'  + fpToken(token)) : base; }

  // Coerciones seguras
  function toNum(v, d) { var n = (v == null || v === '') ? NaN : +v; return isFinite(n) ? n : (d == null ? 0 : d); }

  // HTTP helpers
  function withToken(url, token) {
    var u = new URL(url);
    if (token) u.searchParams.set('access_token', token);
    return u.toString();
  }
  function jfetch(url, opts) {
    opts = opts || {};
    var nocache = !!opts.nocache;
    return fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: nocache ? 'no-store' : 'default',
      mode: 'cors'
    }).then(function (res) {
      return res.text().then(function (raw) {
        if (!res.ok) {
          var msg = raw || ('HTTP ' + res.status);
          try { var o = JSON.parse(raw); if (o && o.text) msg = o.text; } catch (_){}
          var err = new Error(msg); err.status = res.status; err.url = url; throw err;
        }
        try { return raw ? JSON.parse(raw) : null; }
        catch (e) { var er = new Error('JSON inválido en ' + url + ': ' + String(raw).slice(0,200)); er.url = url; throw er; }
      });
    });
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
      __mem.set(mkey, { ts: lval.ts, data: lval.data }); // rehidratar a memoria
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
    var url = withToken(API_BASE + '/v2/tokeninfo', token);
    return jfetch(url, opts).then(function (data) {
      putCache(key, data, token, TTL.TOKENINFO);
      return data;
    });
  }
  function tokenHasWVPermissions(tokenInfo) {
    try {
      var p = new Set((tokenInfo && tokenInfo.permissions) || []);
      // Con tener 'wizardsvault' o 'progression' ya alcanza para WV
      return p.has('wizardsvault') || p.has('progression');
    } catch (_){ return false; }
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
    var url = withToken(API_BASE + '/v2/account/wallet', token);
    return jfetch(url, opts).then(function (data) {
      putCache(key, data, token, TTL.WALLET);
      return data;
    });
  }
  function getCurrenciesAll(opts) {
    opts = opts || {};
    var key = 'currencies_all';
    var cached = getCache(key, TTL.CURR, null, opts.nocache);
    if (cached) return Promise.resolve(cached);
    var url = API_BASE + '/v2/currencies?ids=all&lang=es';
    return jfetch(url, opts).then(function (data) {
      putCache(key, data, null, TTL.CURR);
      return data;
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
        return n.includes('astral') || n.includes('reconocimiento');
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
    var url = withToken(API_BASE + '/v2/account/achievements', token);
    return jfetch(url, opts).then(function (data) {
      putCache(key, data, token, TTL.ACH_ACC);
      return data;
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
          var key = 'ach_meta:' + slice.join(',');
          var cached = getCache(key, TTL.ACH_META, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }
          var url = API_BASE + '/v2/achievements?ids=' + slice.join(',') + '&lang=es';
          return jfetch(url, opts).then(function (data) {
            putCache(key, data || [], null, TTL.ACH_META);
            out = out.concat(data || []);
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

    var lkey = 'items_cache_v1';
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
          var url = API_BASE + '/v2/items?ids=' + slice.join(',') + '&lang=es';
          return jfetch(url, opts).then(function (arr) {
            (arr || []).forEach(function (it) {
              out.push(it);
              per[String(it.id)] = { ts: now(), val: it };
            });
          }).catch(function (e) {
            console.warn(LOGP, 'items batch error', e);
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
  function getWVSeason(opts){          return _WV().getWVSeason(opts); }
  function getWVDaily(token, opts){    return _WV().getWVDaily(token, opts); }
  function getWVWeekly(token, opts){   return _WV().getWVWeekly(token, opts); }
  function getWVSpecial(token, opts){  return _WV().getWVSpecial(token, opts); }
  function getWVAccount(token, opts){  return _WV().getWVAccount(token, opts); }
  function getWVListings(opts){         return _WV().getWVListings(opts); }
  function getAccountWVListings(token, opts){ return _WV().getAccountWVListings(token, opts); }
  function wvComputeRemaining(limit, purchased, marked){ return _WV().wvComputeRemaining(limit, purchased, marked); }
  function wvMergeShopListings(acc, glb){ return _WV().wvMergeShopListings(acc, glb); }
  function getWVShopMerged(token, opts){ return _WV().getWVShopMerged(token, opts); }
  function wvInvalidateTargets(token){   return _WV().wvInvalidateTargets(token); }
  function wvPreloadTargets(token, opts){ return _WV().wvPreloadTargets(token, opts); }

  // ========================================================================
  // Utilidades públicas de debug
  // ========================================================================
  function indexArrayByKey(arr, key) {
    var map = new Map();
    (arr || []).forEach(function (o) { if (o && o[key] != null) map.set(o[key], o); });
    return map;
  }
  function cacheClear() {
    try { __mem.clear(); } catch (_){}
  }

  // ========================================================================
  // API pública
  // ========================================================================
  var API = {
    // Token / Permisos
    getTokenInfo: getTokenInfo,
    tokenHasWVPermissions: tokenHasWVPermissions,

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
    __cfg: { API_BASE: API_BASE, TTL: TTL },
    __cacheClear: cacheClear,
    __indexArrayByKey: indexArrayByKey
  };

  root.GW2Api = API;
  console.info(LOGP, 'listo — métodos:', Object.keys(API).join(', '));

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));