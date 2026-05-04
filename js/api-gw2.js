/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente (mejorada)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.14.0-modular (2026-05-04) — Commerce: Listings + Prices para Ofertas TP
 *
 * Cobertura de este archivo:
 *  - Token / permisos (tokeninfo)
 *  - Wallet + currencies (fallback AA)
 *  - Items batch (con caché por id)
 *  - Achievements (cuenta + metadatos)
 *  - Account info (con last_modified para detectar actividad)
 *  - Raids (getAccountRaids para seguimiento semanal)
 *  - Inventory: Bank, Materials, Legendary Armory
 *  - Delegados Wizard's Vault (retrocompatibles)
 *
 * Cambios v2.13.0:
 *  - NUEVA función getAccountBank(token, opts) para obtener el banco de la cuenta
 *  - NUEVA función getAccountMaterials(token, opts) para obtener almacenamiento de materiales
 *  - NUEVA función getAccountLegendaryArmory(token, opts) para obtener armería legendaria
 *
 * Cambios v2.12.0:
 *  - NUEVA función getAccountRaids(token, opts) para obtener encuentros de raid completados
 *
 * Cambios v2.11.0:
 *  - NUEVA función getAccountInfo(token) que devuelve last_modified
 *  - ELIMINADA lógica de PvP (getPvPGames, isRecentlyActiveInPvP)
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms)
  var TTL = {
    TOKENINFO:    10 * 60 * 1000,            // 10 min
    ACCOUNT:      30 * 1000,                 // 30 segundos (actividad reciente)
    RAIDS:         5 * 60 * 1000,            // 5 minutos
    BANK:          2 * 60 * 1000,            // 2 min (inventario cambia poco)
    MATERIALS:     2 * 60 * 1000,            // 2 min
    ARMORY:        5 * 60 * 1000,            // 5 min (legendarios no cambian seguido)
    COMM_LISTINGS: 5 * 60 * 1000,            // 5 min (listado de items en TP)
    COMM_PRICES:   2 * 60 * 1000,            // 2 min (precios fluctúan rápido)
    WV_SEASON:     6 * 60 * 60 * 1000,       // 6 h
    WV_LISTINGS:  30 * 60 * 1000,            // 30 min
    WV_ACCOUNT:    5 * 60 * 1000,            // 5 min
    WV_OBJ:        5 * 60 * 1000,            // 5 min
    ITEMS:        24 * 60 * 60 * 1000,       // 24 h (por id)
    CURR:          7 * 24 * 60 * 60 * 1000,  // 7 días
    WALLET:        2 * 60 * 1000,            // 2 min
    ACH_ACC:       2 * 60 * 1000,            // 2 min
    ACH_META:     12 * 60 * 60 * 1000        // 12 h
  };

  var CFG = {
    API_BASE: API_BASE,
    TTL: TTL,
    LANG: 'es',
    RETRIES: 2,
    RETRY_BASE_MS: 600
  };

  var __mem = new Map();
  var __inflight = new Map();

  function lsGet(key) {
    try { var j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function now() { return Date.now(); }
  function isFresh(entry, ttl) { return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl; }

  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0,4) + '…' + t.slice(-4)) : 'anon'; }

  function kMem(base, token) { return token ? (base + '::' + fpToken(token)) : base; }
  function kLS(base, token)  { return token ? (base + ':'  + fpToken(token)) : base; }

  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }

  function toNum(v, d) { var n = (v == null || v === '') ? NaN : +v; return isFinite(n) ? n : (d == null ? 0 : d); }

  function withToken(url, token) { var u = new URL(url); if (token) u.searchParams.set('access_token', token); return u.toString(); }
  function withParams(url, params) {
    var u = new URL(url);
    if (params) Object.keys(params).forEach(function (k) {
      var val = params[k];
      if (val != null) u.searchParams.set(k, String(val));
    });
    return u.toString();
  }

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

  function getCache(baseKey, ttl, token, nocache) {
    if (nocache) return null;
    var mkey = kMem(baseKey, token);
    var mval = __mem.get(mkey);
    if (isFresh(mval, ttl)) return mval.data;
    var lkey = kLS(baseKey, token);
    var lval = lsGet(lkey);
    if (isFresh(lval, ttl)) {
      __mem.set(mkey, { ts: lval.ts, data: lval.data });
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
      return p.has('wizardsvault') || p.has('progression');
    } catch (_){ return false; }
  }

  // ========================================================================
  // Account info (con last_modified para detectar actividad)
  // ========================================================================
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

  function isRecentlyActive(accountInfo, minutesThreshold) {
    if (!accountInfo || !accountInfo.last_modified) return false;
    
    var threshold = (minutesThreshold || 10) * 60 * 1000;
    var now = Date.now();
    var lastModified = new Date(accountInfo.last_modified).getTime();
    
    if (isNaN(lastModified)) return false;
    
    return (now - lastModified) <= threshold;
  }

  // ========================================================================
  // Raids
  // ========================================================================
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
        return [];
      });
    });
  }

  // ========================================================================
  // COMMERCE: Listings, Prices y Transactions del Trading Post (v2.15.0)
  // ========================================================================

  /**
   * Obtiene las órdenes de compra activas del jugador
   * @param {string} token - API Key con permiso tradingpost
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>}
   */
  function getCommerceTransactionsBuys(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'commerce_transactions_buys';
    var ttl = 60 * 1000; // 1 minuto

    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/commerce/transactions/current/buys', token);
    var ikey = 'if:commerce_transactions_buys:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var tx = Array.isArray(data) ? data : [];
        putCache(key, tx, token, ttl);
        return tx;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce transactions (buys):', error);
        return [];
      });
    });
  }

  /**
   * Obtiene las órdenes de venta activas del jugador
   * @param {string} token - API Key con permiso tradingpost
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>}
   */
  function getCommerceTransactionsSells(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'commerce_transactions_sells';
    var ttl = 60 * 1000; // 1 minuto

    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/commerce/transactions/current/sells', token);
    var ikey = 'if:commerce_transactions_sells:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var tx = Array.isArray(data) ? data : [];
        putCache(key, tx, token, ttl);
        return tx;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce transactions (sells):', error);
        return [];
      });
    });
  }

  /**
   * Obtiene la lista de IDs de items disponibles en la Compañía de Comercio
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de IDs
   */
  function getCommerceListings(opts) {
    opts = opts || {};
    var key = 'commerce_listings';
    var cached = getCache(key, TTL.COMM_LISTINGS, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = CFG.API_BASE + '/v2/commerce/listings';
    var ikey = 'if:commerce_listings';

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var ids = Array.isArray(data) ? data : [];
        putCache(key, ids, null, TTL.COMM_LISTINGS);
        return ids;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce listings:', error);
        return [];
      });
    });
  }

  /**
   * Obtiene precios de compra/venta para items específicos
   * @param {Array} ids - Array de IDs de items
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de { id, buys: { quantity, unit_price }, sells: { quantity, unit_price } }
   */
  function getCommercePrices(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function (x) { return x != null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    var out = [];
    var chunk = 200;
    var chain = Promise.resolve();

    for (var i = 0; i < ids.length; i += chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var key = 'commerce_prices:' + slice.join(',');
          var cached = getCache(key, TTL.COMM_PRICES, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }

          var url = CFG.API_BASE + '/v2/commerce/prices?ids=' + slice.join(',');
          var ikey = 'if:' + key;

          return inflightOnce(ikey, function () {
            return fetchWithRetry(url, opts).then(function (data) {
              var prices = Array.isArray(data) ? data : [];
              putCache(key, prices, null, TTL.COMM_PRICES);
              out = out.concat(prices);
            }).catch(function (error) {
              console.warn(LOGP, 'Error getting commerce prices:', error);
            });
          });
        });
      })(ids.slice(i, i + chunk));
    }
    return chain.then(function () { return out; });
  }

  // ========================================================================
  // INVENTORY: Bank, Materials, Legendary Armory (NUEVO v2.13.0)
  // ========================================================================

  /**
   * Obtiene el contenido del banco de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de items en el banco (null = slot vacío)
   */
  function getAccountBank(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_bank';
    var cached = getCache(key, TTL.BANK, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/bank', token);
    var ikey = 'if:account_bank:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var bank = Array.isArray(data) ? data : [];
        putCache(key, bank, token, TTL.BANK);
        return bank;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account bank:', error);
        return [];
      });
    });
  }

  /**
   * Obtiene el almacenamiento de materiales de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de { id: number, category: number, binding: string, count: number }
   */
  function getAccountMaterials(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_materials';
    var cached = getCache(key, TTL.MATERIALS, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/materials', token);
    var ikey = 'if:account_materials:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var materials = Array.isArray(data) ? data : [];
        putCache(key, materials, token, TTL.MATERIALS);
        return materials;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account materials:', error);
        return [];
      });
    });
  }

  /**
   * Obtiene la armería legendaria de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de items en la armería legendaria
   */
  function getAccountLegendaryArmory(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_armory';
    var cached = getCache(key, TTL.ARMORY, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/legendaryarmory', token);
    var ikey = 'if:account_armory:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        var armory = Array.isArray(data) ? data : [];
        putCache(key, armory, token, TTL.ARMORY);
        return armory;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting legendary armory:', error);
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
          var key = 'ach_meta_v2:' + CFG.LANG + ':' + slice.join(',');
          var cached = getCache(key, TTL.ACH_META, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }

          var url = withParams(CFG.API_BASE + '/v2/achievements?v=latest', { ids: slice.join(','), lang: CFG.LANG });
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
    var per = bag.data || {};

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
      // Cap de 500 entradas: eliminar los 100 más viejos si se excede
      var keys = Object.keys(per);
      if (keys.length > 500) {
        var sorted = keys.sort(function(a, b) {
          return (per[a]?.ts || 0) - (per[b]?.ts || 0);
        });
        sorted.slice(0, keys.length - 400).forEach(function(k) { delete per[k]; });
      }
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

    // Commerce (v2.15.0)
    getCommerceListings: getCommerceListings,
    getCommercePrices: getCommercePrices,
    getCommerceTransactionsBuys: getCommerceTransactionsBuys,
    getCommerceTransactionsSells: getCommerceTransactionsSells,

    // Inventory (NUEVO v2.13.0)
    getAccountBank: getAccountBank,
    getAccountMaterials: getAccountMaterials,
    getAccountLegendaryArmory: getAccountLegendaryArmory,

    // Wallet / Currencies (fallback AA)
    getAccountWallet: getAccountWallet,
    getCurrenciesAll: getCurrenciesAll,
    getAstralAcclaimBalance: getAstralAcclaimBalance,

    // Achievements
    getAccountAchievements: getAccountAchievements,
    getAchievementsMeta: getAchievementsMeta,

    // Wizard's Vault (delegados)
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