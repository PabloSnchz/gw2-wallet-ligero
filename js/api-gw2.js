/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.5.0-fallbacks (2026-02-27)
 *
 * Cobertura:
 *  - Token / permisos (tokeninfo)
 *  - Wizard’s Vault: season, objetivos (daily/weekly/special), cuenta (AA), listados
 *  - Wallet + currencies (fallback AA)
 *  - Items batch (con caché por id)
 *  - Achievements (cuenta + metadatos)
 *
 * Notas:
 *  - Se usa ?access_token= para evitar preflight CORS (apps estáticas).
 *  - Fallbacks para rutas WV: "wizardsvault" y "wizards-vault", con/ sin "account".
 *  - Caché en memoria + localStorage con TTL por clave (incluye por-token).
 *  - Todos los métodos aceptan { nocache: true } para forzar salto de caché.
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms)
  var TTL = {
    TOKENINFO:   10 * 60 * 1000,       // 10 min
    WV_SEASON:    6 * 60 * 60 * 1000,  // 6 h
    WV_LISTINGS: 30 * 60 * 1000,       // 30 min
    WV_ACCOUNT:   5 * 60 * 1000,       // 5 min (cuenta WV, AA, objetivos, listados por cuenta)
    WV_OBJ:       5 * 60 * 1000,       // 5 min
    ITEMS:       24 * 60 * 60 * 1000,  // 24 h (por id)
    CURR:         7 * 24 * 60 * 60 * 1000, // 7 días
    WALLET:       2 * 60 * 1000,       // 2 min
    ACH_ACC:      2 * 60 * 1000,       // 2 min (account achievements)
    ACH_META:    12 * 60 * 60 * 1000   // 12 h
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
  // Igual que jfetch pero si 404 devuelve null (para hacer fallback)
  function jtry(url, opts) {
    return jfetch(url, opts).catch(function (e) {
      if (e && e.status === 404) return null;
      throw e;
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
      // rehidratar a memoria
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
    var url = withToken(API_BASE + '/v2/tokeninfo', token);
    return jfetch(url, opts).then(function (data) {
      putCache(key, data, token, TTL.TOKENINFO);
      return data;
    });
  }
  function tokenHasWVPermissions(tokenInfo) {
    try {
      var p = new Set((tokenInfo && tokenInfo.permissions) || []);
      // Suficiente tener 'wizardsvault' o 'progression'
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
      // Intento robusto: buscar por nombre/fragmento
      var aaMeta = currs.find(function (c) {
        var n = String(c && c.name || '').toLowerCase();
        return n.includes('astral') || n.includes('reconocimiento'); // es/es-ES
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

    // No hacemos per-id persistente (serían demasiadas claves); chunk por petición
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
  // Wizard’s Vault — fallbacks
  // ========================================================================

  // Season (público) — intenta varias rutas
  function getWVSeason(opts) {
    opts = opts || {};
    var key = 'wv_season';
    var cached = getCache(key, TTL.WV_SEASON, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Intentos en orden:
    var u1 = API_BASE + '/v2/wizardsvault';             // algunos devuelven season directo
    var u2 = API_BASE + '/v2/wizardsvault/season';
    var u3 = API_BASE + '/v2/wizards-vault/season';

    return jtry(u1, opts).then(function (a) {
      if (a && (a.title || a.id)) return a;
      return jtry(u2, opts).then(function (b) {
        if (b && (b.title || b.id)) return b;
        return jtry(u3, opts).then(function (c) {
          return (c && (c.title || c.id)) ? c : { title: '—', start: null, end: null };
        });
      });
    }).then(function (data) {
      putCache(key, data, null, TTL.WV_SEASON);
      return data;
    });
  }

  // Objetivos (privado) — helper con fallbacks
  function _getWVObjectives(kind, token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_obj_' + kind;
    var cached = getCache(key, TTL.WV_OBJ, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // 1) Ruta de cuenta sin guion (tu implementación original)
    var u1 = withToken(API_BASE + '/v2/account/wizardsvault/' + kind, token) + '&lang=es';
    // 2) Ruta moderna (sin account)
    var u2 = withToken(API_BASE + '/v2/wizardsvault/objectives/' + kind, token) + '&lang=es';
    // 3) Con guion
    var u3 = withToken(API_BASE + '/v2/account/wizards-vault/' + kind, token) + '&lang=es';
    var u4 = withToken(API_BASE + '/v2/wizards-vault/objectives/' + kind, token) + '&lang=es';

    return jtry(u1, opts).then(function (a) {
      if (a && a.objectives) return a;
      return jtry(u2, opts).then(function (b) {
        if (b && b.objectives) return b;
        return jtry(u3, opts).then(function (c) {
          if (c && c.objectives) return c;
          return jtry(u4, opts).then(function (d) {
            return (d && d.objectives) ? d : { objectives: [] };
          });
        });
      });
    }).then(function (data) {
      putCache(key, data, token, TTL.WV_OBJ);
      return data;
    });
  }
  function getWVDaily(token, opts)   { return _getWVObjectives('daily',   token, opts); }
  function getWVWeekly(token, opts)  { return _getWVObjectives('weekly',  token, opts); }
  function getWVSpecial(token, opts) { return _getWVObjectives('special', token, opts); }

  // Cuenta WV (AA + icon) — fallbacks
  function getWVAccount(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_account';
    var cached = getCache(key, TTL.WV_ACCOUNT, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var u1 = withToken(API_BASE + '/v2/account/wizardsvault', token);
    var u2 = withToken(API_BASE + '/v2/wizardsvault/account', token);
    var u3 = withToken(API_BASE + '/v2/account/wizards-vault', token);

    return jtry(u1, opts).then(function (a) {
      if (a && (a.astral_acclaim != null || a.icon)) return a;
      return jtry(u2, opts).then(function (b) {
        if (b && (b.astral_acclaim != null || b.icon)) return b;
        return jtry(u3, opts).then(function (c) {
          return (c && (c.astral_acclaim != null || c.icon)) ? c : null;
        });
      });
    }).then(function (data) {
      putCache(key, data, token, TTL.WV_ACCOUNT);
      return data;
    });
  }

  // Listados públicos — fallbacks (con y sin ?ids=all)
  function getWVListings(opts) {
    opts = opts || {};
    var key = 'wv_listings_all';
    var cached = getCache(key, TTL.WV_LISTINGS, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var u1 = API_BASE + '/v2/wizardsvault/listings?ids=all';
    var u2 = API_BASE + '/v2/wizards-vault/listings?ids=all';
    var u3 = API_BASE + '/v2/wizardsvault/listings';
    var u4 = API_BASE + '/v2/wizards-vault/listings';

    return jtry(u1, opts).then(function (a) {
      if (Array.isArray(a)) return a;
      return jtry(u2, opts).then(function (b) {
        if (Array.isArray(b)) return b;
        return jtry(u3, opts).then(function (c) {
          if (Array.isArray(c)) return c;
          return jtry(u4, opts).then(function (d) {
            return Array.isArray(d) ? d : [];
          });
        });
      });
    }).then(function (arr) {
      putCache(key, arr, null, TTL.WV_LISTINGS);
      return arr;
    });
  }

  // Listados por cuenta — fallbacks
  function getAccountWVListings(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_acc_listings';
    var cached = getCache(key, TTL.WV_OBJ, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var u1 = withToken(API_BASE + '/v2/account/wizardsvault/listings', token);
    var u2 = withToken(API_BASE + '/v2/wizardsvault/account/listings', token);
    var u3 = withToken(API_BASE + '/v2/account/wizards-vault/listings', token);

    return jtry(u1, opts).then(function (a) {
      if (Array.isArray(a)) return a;
      return jtry(u2, opts).then(function (b) {
        if (Array.isArray(b)) return b;
        return jtry(u3, opts).then(function (c) {
          return Array.isArray(c) ? c : [];
        });
      });
    }).then(function (arr) {
      putCache(key, arr, token, TTL.WV_OBJ);
      return arr;
    });
  }

  // ========================================================================
  // Items batch (con caché por id persistente)
  // ========================================================================
  function getItemsMany(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function (x) { return x != null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    // Caché por-id en LS (para no recargar lo mismo siempre)
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
      // Persistir bolsa
      lsSet(lkey, { ts: now(), data: per });
      return out;
    });
  }

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
    try {
      // opcional: limpiar solo nuestras keys conocidas (no borramos todo el LS)
      // Si querés un reset total, descomenta:
      // localStorage.clear();
    } catch (_){}
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

    // Wizard’s Vault
    getWVSeason: getWVSeason,
    getWVDaily: getWVDaily,
    getWVWeekly: getWVWeekly,
    getWVSpecial: getWVSpecial,
    getWVAccount: getWVAccount,
    getWVListings: getWVListings,
    getAccountWVListings: getAccountWVListings,

    // Items
    getItemsMany: getItemsMany,

    // Debug / util
    __cfg: { API_BASE: API_BASE, TTL: TTL },
    __cacheClear: cacheClear,
    __indexArrayByKey: indexArrayByKey
  };

  root.GW2Api = API;
  console.info(LOGP, 'listo — métodos:', Object.keys(API).join(', '));

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));