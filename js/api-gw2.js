/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente (perffix)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.7.2-perffix (2026-03-04)
 *
 * Cambios vs 2.7.1:
 *  - Achievements meta: concurrencia controlada (chunk=80, concurrency=3),
 *    split del lote en fallos (hasta 2 niveles) y abortabilidad real.
 *  - fetchWithRetry: respeta Retry-After y tiene sleep abortable.
 *  - jtry(url): 404 tolerado => null (con backoff en 429/503/504).
 *  - __cfg.setApiBase() + __cacheClearLS() (purga selectiva).
 *  - Sin llamadas top-level: solo define y exporta window.GW2Api.
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms)
  var TTL = {
    TOKENINFO:   10 * 60 * 1000,            // 10 min
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

  // Config ampliable
  var CFG = {
    API_BASE: API_BASE,
    TTL: TTL,
    LANG: 'es',
    RETRIES: 2,
    RETRY_BASE_MS: 600
  };

  // Caché en memoria e inflight
  var __mem = new Map();       // mkey -> { ts, data }
  var __inflight = new Map();  // ikey -> Promise

  // Helpers LocalStorage
  function lsGet(key) {
    try { var j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (_) {} }
  function now() { return Date.now(); }
  function isFresh(entry, ttl) { return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl; }

  // Fingerprint de token (para namespacing de cache)
  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0,4) + '…' + t.slice(-4)) : 'anon'; }

  // Keys de caché
  function kMem(base, token) { return token ? (base + '::' + fpToken(token)) : base; }
  function kLS(base, token)  { return token ? (base + ':'  + fpToken(token)) : base; }

  // De-dup concurrente
  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }

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
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
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
          var err = new Error(msg);
          err.status = res.status;
          err.url = url;
          try {
            var ra = res.headers && (res.headers.get('retry-after') || res.headers.get('Retry-After'));
            if (ra) err.retryAfter = ra;
          } catch (_){}
          throw err;
        }
        try { return raw ? JSON.parse(raw) : null; }
        catch (e) { var er = new Error('JSON inválido en ' + url + ': ' + String(raw).slice(0,200)); er.url = url; throw er; }
      });
    });
  }

  // Reintentos con backoff + Retry-After + sleep abortable
  function fetchWithRetry(url, opts) {
    opts = opts || {};
    var max = (opts.retries != null) ? opts.retries : CFG.RETRIES;
    var attempt = 0;
    var lastErr;
    var signal = opts.signal;

    function jitter() { return Math.floor(Math.random() * 200); }
    function toNum(v, d) { var n = (v == null || v === '') ? NaN : +v; return isFinite(n) ? n : (d == null ? 0 : d); }
    function parseRetryAfter(v) {
      if (!v) return 0;
      var secs = toNum(v, NaN);
      if (isFinite(secs) && secs >= 0) return secs * 1000;
      var t = Date.parse(v);
      if (isFinite(t)) {
        var ms = t - Date.now();
        return ms > 0 ? ms : 0;
      }
      return 0;
    }

    function sleepAbortable(ms) {
      if (ms <= 0) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var t = setTimeout(done, ms);
        function done() { cleanup(); resolve(); }
        function onAbort() { cleanup(); reject(new DOMException('Aborted', 'AbortError')); }
        function cleanup() {
          try { clearTimeout(t); } catch (_){}
          if (signal) signal.removeEventListener('abort', onAbort);
        }
        if (signal) {
          if (signal.aborted) return onAbort();
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });
    }

    function loop() {
      return jfetch(url, opts).catch(function (e) {
        lastErr = e;
        var retriable = e && (e.status === 429 || e.status === 503 || e.status === 504);
        if (!retriable || attempt >= max) throw lastErr;

        var base = CFG.RETRY_BASE_MS * Math.pow(2, attempt);
        var raMs = parseRetryAfter(e.retryAfter);
        var backoff = Math.min(8000, Math.max(raMs, base) + jitter());
        attempt++;
        return sleepAbortable(backoff).then(loop);
      });
    }
    return loop();
  }

  // jtry: 404 tolerado => null
  function jtry(url, opts) {
    opts = opts || {};
    return fetchWithRetry(url, opts).catch(function (e) {
      if (e && e.status === 404) return null;
      throw e;
    });
  }

  // Lectura/escritura cachés (mem + LS)
  function getCache(baseKey, ttl, token, nocache) {
    if (nocache) return null;
    // Memoria
    var mkey = kMem(baseKey, token);
    var mval = __mem.get(mkey);
    if (isFresh(mval, ttl)) return mval.data;
    // LocalStorage
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

  // Achievements meta — Caché por id + concurrencia controlada + split en fallos + abort
  function getAchievementsMeta(ids, opts) {
    opts = opts || {};
    var signal = opts.signal;

    ids = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    if (!ids.length) return Promise.resolve([]);

    var lkey = 'ach_meta_cache_v1:' + CFG.LANG;
    var bag = lsGet(lkey) || { ts: 0, data: {} };
    var per = bag.data || {}; // { [id]: { ts, val } }

    var out = [];
    var missing = [];

    // Hits por-id desde cache
    ids.forEach(function (id) {
      var k = String(id);
      var c = per[k];
      if (!opts.nocache && c && isFresh(c, TTL.ACH_META)) {
        out.push(c.val);
      } else {
        missing.push(id);
      }
    });

    if (!missing.length) return Promise.resolve(out);

    // Config de cola
    var CHUNK = 80;
    var CONCURRENCY = 3;
    var MAX_SPLIT_DEPTH = 2;

    var tasks = [];
    for (var i = 0; i < missing.length; i += CHUNK) {
      tasks.push({ ids: missing.slice(i, i + CHUNK), depth: 0 });
    }

    var active = 0;
    var idx = 0;
    var aborted = false;

    function checkAbort() {
      if (signal && signal.aborted) {
        aborted = true;
        throw new DOMException('Aborted', 'AbortError');
      }
    }

    function runQueue() {
      return new Promise(function (resolve, reject) {
        function next() {
          if (aborted) return;
          try { checkAbort(); } catch (e) { return reject(e); }

          if (idx >= tasks.length && active === 0) {
            try { lsSet(lkey, { ts: now(), data: per }); } catch (_){}
            return resolve(out);
          }

          while (active < CONCURRENCY && idx < tasks.length) {
            var task = tasks[idx++]; active++;
            runTask(task).then(function () {
              active--; next();
            }).catch(function (e) {
              active--;
              if (e && e.name === 'AbortError') return reject(e);
              // error manejado (split o descartar), continuar
              next();
            });
          }
        }

        function runTask(task) {
          checkAbort();
          var slice = task.ids || [];
          if (!slice.length) return Promise.resolve();

          var url = withParams(CFG.API_BASE + '/v2/achievements', { ids: slice.join(','), lang: CFG.LANG });
          var ikey = 'if:ach_meta:' + CFG.LANG + ':' + slice.join(',');

          return inflightOnce(ikey, function () {
            return fetchWithRetry(url, { signal: signal }).then(function (arr) {
              (arr || []).forEach(function (it) {
                out.push(it);
                per[String(it.id)] = { ts: now(), val: it };
              });
            });
          }).catch(function (e) {
            if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (slice.length > 1 && task.depth < MAX_SPLIT_DEPTH) {
              var mid = Math.floor(slice.length / 2);
              var left = slice.slice(0, mid);
              var right = slice.slice(mid);
              tasks.push({ ids: left, depth: task.depth + 1 });
              tasks.push({ ids: right, depth: task.depth + 1 });
            } else {
              console.warn(LOGP, 'ach meta batch error (descartado)', e && (e.status || e.message), 'ids=', slice.slice(0,5), '('+slice.length+' ids)');
            }
          });
        }

        next();
      });
    }

    return runQueue().then(function () { return out; });
  }

  // ========================================================================
  // Items (caché por id persistente)
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
              console.warn(LOGP, 'items batch error', e && (e.status || e.message));
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
  function cacheClearLS() {
    try {
      var prefixes = [
        'tokeninfo', 'wallet', 'ach_acc',
        'currencies_all:', 'items_cache_v1:', 'ach_meta_cache_v1:',
        'ach_meta:' // legado
      ];
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (!k) continue;
        for (var j=0; j<prefixes.length; j++) {
          if (k.indexOf(prefixes[j]) === 0) { try { localStorage.removeItem(k); } catch (_){ } break; }
        }
      }
    } catch (_){}
  }

  // ========================================================================
  // API pública
  // ========================================================================
  var API = {
    // Token / Permisos
    getTokenInfo: getTokenInfo,
    tokenHasWVPermissions: tokenHasWVPermissions,

    // Wallet / Currencies / AA
    getAccountWallet: getAccountWallet,
    getCurrenciesAll: getCurrenciesAll,
    getAstralAcclaimBalance: getAstralAcclaimBalance,

    // Achievements
    getAccountAchievements: getAccountAchievements,
    getAchievementsMeta: getAchievementsMeta,

    // Wizards’ Vault (delegados)
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
      setLang: function (lang) { if (lang) { CFG.LANG = String(lang); this.LANG = CFG.LANG; } },
      setRetries: function (n) { var x = +n; if (isFinite(x) && x >= 0 && x <= 5) { CFG.RETRIES = x|0; } },
      setApiBase: function (base) { if (base) { CFG.API_BASE = String(base); this.API_BASE = CFG.API_BASE; } }
    },
    __cacheClear: cacheClear,
    __cacheClearLS: cacheClearLS,
    __indexArrayByKey: indexArrayByKey,
    jtry: jtry
  };

  root.GW2Api = API;
  console.info(LOGP, 'listo', { lang: CFG.LANG, retries: CFG.RETRIES });

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));