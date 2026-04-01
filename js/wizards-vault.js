/*!
 * js/wizards-vault.js — Módulo Wizard's Vault (season, objetivos, cuenta, listados, shop)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.3.0 (2026-03-30) — Botón de recarga forzada de temporada
 *
 * Cambios v1.3.0:
 *  - Agregado botón de recarga forzada de temporada (junto al tooltip de info)
 *  - Función forceReloadSeason() para actualizar temporada manualmente
 *  - Exposición global de forceReloadWVSeason para debug
 *
 * Cambios v1.2.1:
 *  - getWVSeason() robusto: acepta respuesta plana o anidada
 *  - Nunca retorna null/undefined
 */

(function (root) {
  'use strict';

  var LOGW = '[WizardsVault]';
  var API_BASE = (root.GW2Api && root.GW2Api.__cfg && root.GW2Api.__cfg.API_BASE) || 'https://api.guildwars2.com';
  var LANG = (root.GW2Api && root.GW2Api.__cfg && root.GW2Api.__cfg.LANG) || 'es';
  var RETRIES = (root.GW2Api && root.GW2Api.__cfg && typeof root.GW2Api.__cfg.RETRIES === 'number')
                ? root.GW2Api.__cfg.RETRIES : 2;
  var RETRY_BASE_MS = 600;

  var TTL = {
    WV_SEASON:    6 * 60 * 60 * 1000,
    WV_LISTINGS: 30 * 60 * 1000,
    WV_ACCOUNT:   5 * 60 * 1000,
    WV_OBJ:       5 * 60 * 1000
  };

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

  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }
  function jtry(url, opts){
    return fetchWithRetry(url, opts).catch(function(e){ if (e && e.status===404) return null; throw e; });
  }

  // -------- HOTFIX: normalizador de season --------
  function normalizeSeason(any){
    if (!any || typeof any!=='object') return { title:'—', start:null, end:null };
    // casos: plano {id,title,start,end} o anidado {season:{id,start,end},title}
    var id    = any.id || (any.season && any.season.id) || null;
    var start = any.start || (any.season && any.season.start) || null;
    var end   = any.end   || (any.season && any.season.end)   || null;
    var title = any.title || (any.season && any.season.title) || any.name || '—';
    return { id:id||null, title:title||'—', start:start||null, end:end||null };
  }

  function getWVSeason(opts){
    opts = opts || {};
    var key = 'wv_season';
    var cached = getCache(key, TTL.WV_SEASON, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    // Canon + fallbacks (SOLO estos tres)
    var u1 = API_BASE + '/v2/wizardsvault';
    var u2 = API_BASE + '/v2/wizardsvault/season';
    var u3 = API_BASE + '/v2/wizards-vault/season';

    var ikey = 'if:wv_season';

    return inflightOnce(ikey, function () {
      return jtry(u1, opts).then(function (a) {
        if (a && (a.title || a.id || (a.season && (a.season.id || a.season.title)))) return a;
        return jtry(u2, opts).then(function (b) {
          if (b && (b.title || b.id || (b.season && (b.season.id || b.season.title)))) return b;
          return jtry(u3, opts).then(function (c) {
            return (c && (c.title || c.id || (c.season && (c.season.id || c.season.title)))) ? c : { title:'—', start:null, end:null };
          });
        });
      }).then(function (raw) {
        var data = normalizeSeason(raw);
        putCache(key, data, null, TTL.WV_SEASON);
        return data;
      }).catch(function(e){
        console.warn(LOGW, 'getWVSeason failed, returning safe object', e);
        var data = { title:'—', start:null, end:null };
        putCache(key, data, null, TTL.WV_SEASON);
        return data;
      });
    });
  }

  // ====== FUNCIÓN PARA FORZAR RECARGA DE TEMPORADA ======
  function forceReloadSeason() {
    console.log(LOGW, 'Forzando recarga de temporada...');

  // Evento Analytics
  if (typeof Analytics !== 'undefined') Analytics.forceReloadSeason();
    
    var token = (function() {
      var sel = document.getElementById('keySelectGlobal');
      return sel ? (sel.value || '').trim() : null;
    })();
    
    if (!token) {
      console.warn(LOGW, 'No hay token para recargar temporada');
      if (window.toast) window.toast('warning', 'No hay API key seleccionada', { ttl: 2000 });
      return;
    }
    
    // Mostrar feedback visual
    if (window.toast) window.toast('info', 'Recargando información de temporada...', { ttl: 1500 });
    
    getWVSeason({ nocache: true })
      .then(function(season) {
        console.log(LOGW, 'Temporada recargada:', season);
        
        // Actualizar UI de temporada en el header de WV
        var seasonTitleEl = document.getElementById('wvSeasonTitle');
        var seasonDatesEl = document.getElementById('wvSeasonDates');
        
        if (seasonTitleEl && season.title) {
          seasonTitleEl.textContent = season.title;
        }
        
        if (seasonDatesEl && season.start && season.end) {
          var start = new Date(season.start);
          var end = new Date(season.end);
          seasonDatesEl.textContent = start.toLocaleDateString() + ' → ' + end.toLocaleDateString();
        } else if (seasonDatesEl) {
          seasonDatesEl.textContent = '—';
        }
        
        // Actualizar WVSeasonStore si está disponible
        if (window.WVSeasonStore && season.start) {
          var startDate = new Date(season.start);
          var year = startDate.getUTCFullYear() % 100;
          var seq = 1;
          WVSeasonStore.saveSeasonInfo(year, seq, {
            season_id: season.id || null,
            title: season.title,
            start: season.start,
            end: season.end
          }).catch(function(e) { console.warn(LOGW, 'Error guardando en store:', e); });
        }
        
        // Disparar evento para que otros módulos se actualicen
        window.dispatchEvent(new CustomEvent('wv:season:reloaded', { detail: { season: season } }));
        
        if (window.toast) window.toast('success', 'Temporada actualizada: ' + (season.title || '—'), { ttl: 3000 });
        
        // Si la tienda está visible, sugerir recarga (el router la recargará automáticamente)
        var shopTab = document.getElementById('wvTabShop');
        if (shopTab && !shopTab.hidden) {
          console.log(LOGW, 'Tienda visible, se actualizará automáticamente');
        }
      })
      .catch(function(e) {
        console.error(LOGW, 'Error recargando temporada:', e);
        if (window.toast) window.toast('error', 'No se pudo recargar la temporada', { ttl: 2000 });
      });
  }

  // -------------------- WV: Objetivos (daily/weekly/special) --------------------
  function _getWVObjectives(kind, token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'wv_obj_' + kind + ':' + LANG;
    var cached = getCache(key, TTL.WV_OBJ, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var u1 = withToken(withParams(API_BASE + '/v2/account/wizardsvault/' + kind, { lang: LANG }), token);
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

    var key = 'wv_account_v2';
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

    var u1 = API_BASE + '/v2/wizardsvault/listings?ids=all';
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

    var u1 = withToken(API_BASE + '/v2/account/wizardsvault/listings', token);
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

  // getWVShopMerged — espera items antes de resolver (primer render completo)
  function getWVShopMerged(token, opts){
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    return Promise.all([
      getWVListings({ nocache: !!opts.nocache }),
      getAccountWVListings(token, { nocache: !!opts.nocache }),
      getWVAccount(token, { nocache: !!opts.nocache })
    ]).then(function ([catalog, accShop, wvAcc]) {

      var merged = wvMergeShopListings(accShop || [], catalog || []);
      var itemIds = merged.map(function (m) { return m.item_id; }).filter(function (x) { return x != null; });
      var uniqueIds = Array.from(new Set(itemIds));

      var itemsPromise = (root.GW2Api && typeof root.GW2Api.getItemsMany === 'function')
        ? root.GW2Api.getItemsMany(uniqueIds, { nocache: !!opts.nocache })
        : Promise.resolve([]);

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

  // ----------------------------- Targets helpers + listener -----------------------------
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

  // ----------------------------- Inyectar ícono de recarga en UI -----------------------------
  function injectReloadSeasonButton() {
    // Esperar a que el DOM esté listo
    var checkInterval = setInterval(function() {
      var wvSyncNote = document.getElementById('wvSyncNote');
      var existingBtn = document.getElementById('wvReloadSeasonBtn');
      
      if (existingBtn) {
        clearInterval(checkInterval);
        return;
      }
      
      if (wvSyncNote && wvSyncNote.parentNode) {
        clearInterval(checkInterval);
        
        // Crear ícono clickeable (sin apariencia de botón)
        var reloadIcon = document.createElement('span');
        reloadIcon.id = 'wvReloadSeasonBtn';
        reloadIcon.title = 'Forzar recarga de información de temporada';
        reloadIcon.setAttribute('aria-label', 'Recargar temporada');
        reloadIcon.style.cursor = 'pointer';
        reloadIcon.style.display = 'inline-flex';
        reloadIcon.style.alignItems = 'center';
        reloadIcon.style.marginLeft = '8px';
        reloadIcon.style.opacity = '0.7';
        reloadIcon.style.transition = 'opacity 0.2s ease';
        reloadIcon.innerHTML = '<img src="assets/icons/Welcome/834002.png" width="16" height="16" alt="Recargar" style="vertical-align: middle;">';
        
        // Efecto hover
        reloadIcon.addEventListener('mouseenter', function() {
          reloadIcon.style.opacity = '1';
        });
        reloadIcon.addEventListener('mouseleave', function() {
          reloadIcon.style.opacity = '0.7';
        });
        
        // Evento click
        reloadIcon.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          forceReloadSeason();
        });
        
        // Insertar después del tooltip
        wvSyncNote.insertAdjacentElement('afterend', reloadIcon);
        console.log(LOGW, 'Ícono de recarga de temporada injectado');
      }
    }, 500);
    
    // Timeout para no seguir buscando indefinidamente
    setTimeout(function() { clearInterval(checkInterval); }, 10000);
  }
  // ----------------------------- Export base (compat 1.1.0) -----------------------------
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
    // Recarga forzada de temporada
    forceReloadSeason: forceReloadSeason,
    injectReloadSeasonButton: injectReloadSeasonButton,
    // Debug
    __cfg: { API_BASE: API_BASE, TTL: TTL, LANG: LANG }
  };

  // Exponer globalmente para debug en consola
  root.forceReloadWVSeason = forceReloadSeason;

  // ----------------------------- Hook opcional a WVSeasonStore -----------------------------
  (function hookSeasonStore(){
    if (!root.WVSeasonStore) return;
    try {
      if (typeof root.WVSeasonStore.migrateFromLegacy === 'function') {
        root.WVSeasonStore.migrateFromLegacy()
          .then(function(r){ if (r && r.moved) console.info(LOGW, 'Migrated legacy WV data to season store', r.details); })
          .catch(function(e){ console.warn(LOGW, 'migrateFromLegacy error', e); });
      }
      WizardsVault.wvStore = {
        getCurrentSeasonInfo: root.WVSeasonStore.getCurrentSeasonInfo,
        listSeasons: root.WVSeasonStore.listSeasons,
        readSeason: root.WVSeasonStore.readSeason,
        getPinned: root.WVSeasonStore.getPinned,
        setPinned: root.WVSeasonStore.setPinned,
        delPinned: root.WVSeasonStore.delPinned,
        getMarks: root.WVSeasonStore.getMarks,
        setMarks: root.WVSeasonStore.setMarks,
        getPrefs: root.WVSeasonStore.getPrefs,
        setPrefs: root.WVSeasonStore.setPrefs
      };
    } catch(e){
      console.warn(LOGW, 'season-store hook failed', e);
    }
  })();

  // Inyectar botón cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectReloadSeasonButton);
  } else {
    injectReloadSeasonButton();
  }

  // También intentar inyectar cuando se navega a WV
  document.addEventListener('gn:nav-active', function(ev) {
    try {
      var h = String(ev && ev.detail && ev.detail.hash || '').toLowerCase();
      if (h === '#/account/wizards-vault') {
        setTimeout(injectReloadSeasonButton, 500);
      }
    } catch(_) {}
  });

  // ----------------------------- Integración con GW2Api (contrato v1.1.0) -----------------------------
  root.WizardsVault = WizardsVault;

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