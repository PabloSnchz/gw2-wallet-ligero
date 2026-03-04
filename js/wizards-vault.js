/*!
 * js/wizards-vault.js — Módulo Wizard's Vault (season, objetivos, cuenta, listados, shop)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.1.0 (2026-03-03) — backoff + de-dupe + lang centralizado + AA vía wallet
 *
 * Notas:
 *  - Requiere que js/api-gw2.js haya definido window.GW2Api antes de cargar.
 *  - Mantiene misma API pública expuesta vía GW2Api.* (retrocompat).
 *  - Escucha 'gn:wv-targets-refresh' y emite 'gn:wv-targets-refreshed'.
 *  - Usa ?access_token= para evitar preflight CORS.
 */

(function (root) {
  'use strict';

  var LOGW = '[WizardsVault]';
  var API_BASE = (root.GW2Api && root.GW2Api.__cfg && root.GW2Api.__cfg.API_BASE) || 'https://api.guildwars2.com';
  var LANG = (root.GW2Api && root.GW2Api.__cfg && root.GW2Api.__cfg.LANG) || 'es';
  var RETRIES = (root.GW2Api && root.GW2Api.__cfg && typeof root.GW2Api.__cfg.RETRIES === 'number')
                ? root.GW2Api.__cfg.RETRIES : 2;
  var RETRY_BASE_MS = 600; // mismo base que api-gw2.js

  // TTLs (ms) — específicos del módulo
  var TTL = {
    WV_SEASON:    6 * 60 * 60 * 1000,  // 6 h
    WV_LISTINGS: 30 * 60 * 1000,       // 30 min
    WV_ACCOUNT:   5 * 60 * 1000,       // 5 min
    WV_OBJ:       5 * 60 * 1000        // 5 min
  };

  // Caché en memoria + LS + in-flight (de-dupe)
  var __mem = new Map();
  var __inflight = new Map();

  function now() { return Date.now(); }
  function lsGet(k){ try{ var j=localStorage.getItem(k); return j?JSON.parse(j):null; }catch(_){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(_){ } }

  function isFresh(entry, ttl) {
    return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl;
  }
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }
  function kMem(base, token){ return token ? (base+'::'+fpToken(token)) : base; }
  function kLS(base, token){ return token ? (base+':'+fpToken(token)) : base; }

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
  function delCache(baseKey, token) {
    __mem.delete(kMem(baseKey, token));
    lsDel(kLS(baseKey, token));
  }

  function toNum(v, d){ var n=(v==null||v==='')?NaN:+v; return isFinite(n)?n:(d==null?0:d); }
  function toNullableNum(v){ var n=(v==null||v==='')?NaN:+v; return isFinite(n)?n:null; }

  function withToken(url, token) {
    var u = new URL(url);
    if (token) u.searchParams.set('access_token', token);
    return u.toString();
  }
  function withParams(url, params) {
    var u = new URL(url);
    if (params) Object.keys(params).forEach(function (k) {
      var val = params[k];
      if (val != null) u.searchParams.set(k, String(val));
    });
    return u.toString();
  }

  // jfetch base
  function jfetch(url, opts) {
    opts = opts || {};
    var nocache = !!opts.nocache;
    var headers = Object.assign({ 'Accept': 'application/json' }, (opts.headers || {}));
    var init = { headers: headers, cache: nocache ? 'no-store' : 'default', mode: 'cors' };
    if (opts.signal) init.signal = opts.signal;

    return fetch(url, init).then(function(res){
      return res.text().then(function(raw){
        if (!res.ok){
          var msg = raw || ('HTTP '+res.status);
          try{ var o=raw ? JSON.parse(raw) : null; if (o && (o.text || o.error)) msg = o.text || o.error; }catch(_){}
          var err=new Error(msg); err.status=res.status; err.url=url; throw err;
        }
        try{ return raw?JSON.parse(raw):null; }
        catch(e){ var er=new Error('JSON inválido en '+url+': '+String(raw).slice(0,200)); er.url=url; throw er; }
      });
    });
  }

  // Backoff con reintentos (429/503/504)
  function fetchWithRetry(url, opts) {
    opts = opts || {};
    var max = (opts.retries != null) ? opts.retries : RETRIES;
    var attempt = 0;
    var lastErr;

    function jitter() { return Math.floor(Math.random() * 200); }

    function loop() {
      return jfetch(url, opts).catch(function (e) {
        lastErr = e;
        var retriable = e && (e.status === 429 || e.status === 503 || e.status === 504);
        if (!retriable || attempt >= max) throw lastErr;
        var backoff = Math.min(5000, RETRY_BASE_MS * Math.pow(2, attempt)) + jitter();
        attempt++;
        return new Promise(function (r) { setTimeout(r, backoff); }).then(loop);
      });
    }
    return loop();
  }

  // De-dup de concurrencia por clave
  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }

  function jtry(url, opts){
    return fetchWithRetry(url, opts).catch(function(e){ if (e && e.status===404) return null; throw e; });
  }

  // ----------------------------- WV: Season -----------------------------
  function getWVSeason(opts){
    opts = opts || {};
    var key = 'wv_season';
    var cached = getCache(key, TTL.WV_SEASON, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Canon: /v2/wizardsvault (season actual)
    // Fallbacks: rutas con guion o /season si existiera (compat)
    var u1 = API_BASE + '/v2/wizardsvault';
    var u2 = API_BASE + '/v2/wizardsvault/season';
    var u3 = API_BASE + '/v2/wizards-vault/season';

    var ikey = 'if:wv_season';

    return inflightOnce(ikey, function () {
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
    });
  }

  // -------------------- WV: Objetivos (daily/weekly/special) --------------------
  function _getWVObjectives(kind, token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_obj_' + kind + ':' + LANG;
    var cached = getCache(key, TTL.WV_OBJ, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Canon: /v2/account/wizardsvault/{kind}
    var u1 = withToken(withParams(API_BASE + '/v2/account/wizardsvault/' + kind, { lang: LANG }), token);
    // Fallbacks (compat):
    var u2 = withToken(withParams(API_BASE + '/v2/wizardsvault/objectives/' + kind, { lang: LANG }), token);
    var u3 = withToken(withParams(API_BASE + '/v2/account/wizards-vault/' + kind, { lang: LANG }), token);
    var u4 = withToken(withParams(API_BASE + '/v2/wizards-vault/objectives/' + kind, { lang: LANG }), token);

    var ikey = 'if:' + key + ':' + fpToken(token);

    return inflightOnce(ikey, function () {
      return jtry(u1, opts).then(function(a){
        if (a && a.objectives) return a;
        return jtry(u2, opts).then(function(b){
          if (b && b.objectives) return b;
          return jtry(u3, opts).then(function(c){
            if (c && c.objectives) return c;
            return jtry(u4, opts).then(function(d){
              return (d && d.objectives) ? d : { objectives: [] };
            });
          });
        });
      }).then(function (data) {
        putCache(key, data, token, TTL.WV_OBJ);
        return data;
      });
    });
  }
  function getWVDaily(token, opts){   return _getWVObjectives('daily',   token, opts); }
  function getWVWeekly(token, opts){  return _getWVObjectives('weekly',  token, opts); }
  function getWVSpecial(token, opts){ return _getWVObjectives('special', token, opts); }

  // -------- WV: Objetivos — catálogo global (meta de objetivos) --------
  function getWVObjectivesAll(opts) {
    opts = opts || {};
    var key = 'wv_obj_catalog:' + LANG;
    var cached = getCache(key, TTL.WV_OBJ, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withParams(API_BASE + '/v2/wizardsvault/objectives', { ids: 'all', lang: LANG });
    var ikey = 'if:' + key;

    return inflightOnce(ikey, function () {
      return jtry(url, opts).then(function(arr){
        var list = Array.isArray(arr) ? arr : [];
        putCache(key, list, null, TTL.WV_OBJ);
        return list;
      });
    });
  }
  function getWVObjectivesMeta(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function(x){ return x!=null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    var out = [];
    var chunk = 200;
    var chain = Promise.resolve();

    for (var i=0; i<ids.length; i+=chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var key = 'wv_obj_meta:' + LANG + ':' + slice.join(',');
          var cached = getCache(key, TTL.WV_OBJ, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }

          var url = withParams(API_BASE + '/v2/wizardsvault/objectives', { ids: slice.join(','), lang: LANG });
          var ikey = 'if:' + key;
          return inflightOnce(ikey, function () {
            return jtry(url, opts).then(function (data) {
              data = data || [];
              putCache(key, data, null, TTL.WV_OBJ);
              out = out.concat(data);
            });
          });
        });
      })(ids.slice(i, i+chunk));
    }
    return chain.then(function () { return out; });
  }

  // ----------------------------- WV: Cuenta (AA vía Wallet/Currencies) -----------------------------
  function getWVAccount(token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_account_v2'; // nueva clave para evitar colisión con caches viejos
    var cached = getCache(key, TTL.WV_ACCOUNT, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var hasApi = (root.GW2Api && typeof root.GW2Api.getAstralAcclaimBalance === 'function');
    if (!hasApi) return Promise.resolve({ astral_acclaim: 0, icon: null });

    var ikey = 'if:' + key + ':' + fpToken(token);
    return inflightOnce(ikey, function () {
      return root.GW2Api.getAstralAcclaimBalance(token, { nocache: !!opts.nocache })
        .then(function (aa){
          var out = { astral_acclaim: (aa && aa.value) || 0, icon: (aa && aa.meta && aa.meta.icon) || null };
          putCache(key, out, token, TTL.WV_ACCOUNT);
          return out;
        }).catch(function (){
          var out = { astral_acclaim: 0, icon: null };
          putCache(key, out, token, TTL.WV_ACCOUNT);
          return out;
        });
    });
  }

  // ----------------------------- WV: Listados -----------------------------
  function getWVListings(opts){
    opts = opts || {};
    var key = 'wv_listings_all';
    var cached = getCache(key, TTL.WV_LISTINGS, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Canon: /v2/wizardsvault/listings?ids=all
    var u1 = API_BASE + '/v2/wizardsvault/listings?ids=all';
    // Fallbacks:
    var u2 = API_BASE + '/v2/wizards-vault/listings?ids=all';
    var u3 = API_BASE + '/v2/wizardsvault/listings';
    var u4 = API_BASE + '/v2/wizards-vault/listings';

    var ikey = 'if:' + key;

    return inflightOnce(ikey, function () {
      return jtry(u1, opts).then(function(a){
        if (Array.isArray(a)) return a;
        return jtry(u2, opts).then(function(b){
          if (Array.isArray(b)) return b;
          return jtry(u3, opts).then(function(c){
            if (Array.isArray(c)) return c;
            return jtry(u4, opts).then(function(d){
              return Array.isArray(d) ? d : [];
            });
          });
        });
      }).then(function(arr){
        var norm = (arr || []).map(function (x) {
          return {
            id: toNum(x.id, null),
            item_id: toNullableNum(x.item_id),
            item_count: toNullableNum(x.item_count),
            type: x.type || null,
            cost: toNullableNum(x.cost)
          };
        });
        putCache(key, norm, null, TTL.WV_LISTINGS);
        return norm;
      });
    });
  }

  function getAccountWVListings(token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_acc_listings';
    var cached = getCache(key, TTL.WV_OBJ, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Canon: /v2/account/wizardsvault/listings
    var u1 = withToken(API_BASE + '/v2/account/wizardsvault/listings', token);
    // Fallbacks:
    var u2 = withToken(API_BASE + '/v2/wizardsvault/account/listings', token);
    var u3 = withToken(API_BASE + '/v2/account/wizards-vault/listings', token);

    var ikey = 'if:' + key + ':' + fpToken(token);

    return inflightOnce(ikey, function () {
      return jtry(u1, opts).then(function(a){
        if (Array.isArray(a)) return a;
        return jtry(u2, opts).then(function(b){
          if (Array.isArray(b)) return b;
          return jtry(u3, opts).then(function(c){
            return Array.isArray(c) ? c : [];
          });
        });
      }).then(function(arr){
        var norm = (arr || []).map(function (x) {
          return {
            id: toNum(x.id, null),
            item_id: toNullableNum(x.item_id),
            item_count: toNullableNum(x.item_count),
            type: x.type || null,
            cost: toNullableNum(x.cost),
            purchased: (x.purchased == null ? 0 : toNum(x.purchased, 0)),
            purchase_limit: (x.purchase_limit == null ? null : toNum(x.purchase_limit, null))
          };
        });
        putCache(key, norm, token, TTL.WV_OBJ);
        return norm;
      });
    });
  }

  // ----------------------------- WV: Shop helpers -----------------------------
  function wvComputeRemaining(purchase_limit, purchased, marked) {
    var limit = (purchase_limit == null ? null : toNum(purchase_limit, null));
    var bought = toNum(purchased, 0) + toNum(marked, 0);
    if (limit == null) return Infinity;
    var left = Math.max(0, limit - bought);
    return left;
  }
  function wvMergeShopListings(accountListings, globalListings) {
    var byId = new Map((globalListings || []).map(function (g) { return [g.id, g]; }));
    var merged = (accountListings || []).map(function (acc) {
      var g = byId.get(acc.id) || {};
      return {
        id: acc.id,
        item_id: (acc.item_id != null ? acc.item_id : g.item_id != null ? g.item_id : null),
        item_count: (acc.item_count != null ? acc.item_count : g.item_count != null ? g.item_count : null),
        type: acc.type || g.type || null,
        cost: (acc.cost != null ? acc.cost : g.cost != null ? g.cost : null),
        purchased: acc.purchased || 0,
        purchase_limit: (acc.purchase_limit != null ? acc.purchase_limit : null)
      };
    });
    return merged;
  }
  function indexArrayByKey(arr, key) {
    var map = new Map();
    (arr || []).forEach(function (o) { if (o && o[key] != null) map.set(o[key], o); });
    return map;
  }

  // getWVShopMerged — versión que espera items antes de resolver (primer render completo)
  function getWVShopMerged(token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    // 1) En paralelo: catálogo, account listings y AA (vía wallet)
    return Promise.all([
      getWVListings({ nocache: !!opts.nocache }),
      getAccountWVListings(token, { nocache: !!opts.nocache }),
      getWVAccount(token, { nocache: !!opts.nocache })
    ]).then(function ([catalog, accShop, wvAcc]) {

      // 2) Merge rápido
      var merged = wvMergeShopListings(accShop || [], catalog || []);

      // 3) Prefetch de items ASAP (lista única)
      var itemIds = merged.map(function (m) { return m.item_id; }).filter(function (x) { return x != null; });
      var uniqueIds = Array.from(new Set(itemIds));

      var itemsPromise = (root.GW2Api && typeof root.GW2Api.getItemsMany === 'function')
        ? root.GW2Api.getItemsMany(uniqueIds, { nocache: !!opts.nocache })
        : Promise.resolve([]);

      // 4) Devolver cuando items estén listos (evita "Item #id")
      return itemsPromise.then(function (items) {
        return {
          rows: merged,
          itemsById: indexArrayByKey(items, 'id'),
          aa: (wvAcc && typeof wvAcc.astral_acclaim === 'number') ? wvAcc.astral_acclaim : 0,
          aaIconUrl: (wvAcc && wvAcc.icon) ? wvAcc.icon : null
        };
      });
    });
  }

  // ----------------------------- WV: Targets helpers + listener -----------------------------
  function wvInvalidateTargets(token){
    delCache('wv_obj_daily:'+LANG, token);
    delCache('wv_obj_weekly:'+LANG, token);
    delCache('wv_obj_special:'+LANG, token);
    delCache('wv_account_v2', token);
  }

  function wvPreloadTargets(token, opts){
    opts = opts || {};
    if (!token) return Promise.resolve({ daily:null, weekly:null, special:null, account:null });
    var force = { nocache: true };
    return Promise.all([
      getWVDaily(token, force),
      getWVWeekly(token, force),
      getWVSpecial(token, force),
      getWVAccount(token, force)
    ]).then(function (arr) {
      return { daily: arr[0], weekly: arr[1], special: arr[2], account: arr[3] };
    }).catch(function (e) {
      console.warn(LOGW, 'wvPreloadTargets error', e);
      return { daily:null, weekly:null, special:null, account:null, error: e };
    });
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('gn:wv-targets-refresh', function (ev) {
      try {
        var token = (ev && ev.detail && ev.detail.token) || null;
        var src   = (ev && ev.detail && ev.detail.source) || 'unknown';
        wvInvalidateTargets(token);
        wvPreloadTargets(token, { nocache: true }).then(function(){
          document.dispatchEvent(new CustomEvent('gn:wv-targets-refreshed', {
            detail: { token: token, source: src, ts: Date.now() }
          }));
        });
        console.info(LOGW, 'targets invalidated + preloaded for', fpToken(token), 'src:', src);
      } catch (e) {
        console.warn(LOGW, 'wv-targets-refresh handler error', e);
      }
    });
  }

  // ----------------------------- Export -----------------------------
  var WizardsVault = {
    // Season / Objetivos / Cuenta
    getWVSeason: getWVSeason,
    getWVDaily: getWVDaily,
    getWVWeekly: getWVWeekly,
    getWVSpecial: getWVSpecial,
    getWVAccount: getWVAccount,
    // Listados
    getWVListings: getWVListings,
    getAccountWVListings: getAccountWVListings,
    // Catálogo/Meta de objetivos
    getWVObjectivesAll: getWVObjectivesAll,
    getWVObjectivesMeta: getWVObjectivesMeta,
    // Shop
    wvComputeRemaining: wvComputeRemaining,
    wvMergeShopListings: wvMergeShopListings,
    getWVShopMerged: getWVShopMerged,
    // Targets helpers
    wvInvalidateTargets: wvInvalidateTargets,
    wvPreloadTargets: wvPreloadTargets,
    // Debug
    __cfg: { API_BASE: API_BASE, TTL: TTL, LANG: LANG }
  };

  root.WizardsVault = WizardsVault;

  // Colgar la API en GW2Api (retrocompatibilidad total)
  if (root.GW2Api) {
    var ap = root.GW2Api;
    [
      'getWVSeason','getWVDaily','getWVWeekly','getWVSpecial','getWVAccount',
      'getWVListings','getAccountWVListings',
      'getWVObjectivesAll','getWVObjectivesMeta',
      'wvComputeRemaining','wvMergeShopListings','getWVShopMerged',
      'wvInvalidateTargets','wvPreloadTargets'
    ].forEach(function(name){
      ap[name] = WizardsVault[name];
    });
    console.info(LOGW, 'integrado con GW2Api — métodos WV listos. lang=' + LANG + ' retries=' + RETRIES);
  } else {
    console.warn(LOGW, 'GW2Api no encontrado. Verificá el orden de carga (api-gw2.js antes de wizards-vault.js).');
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));