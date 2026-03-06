/*!
 * js/wv-season-storage.js — Servicio de almacenamiento por temporada (Wizard's Vault)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.1.0 (2026-03-05) — Single-Season + mutate event
 *
 * Objetivo:
 *   - Persistir TODO lo relevante de Wizard's Vault por temporada en 1 "archivo" (entrada LS) por temporada.
 *   - Consumido por Tienda y Detalle de Compras.
 *   - Evitar QuotaExceeded: partición por temporada + compact() y escritura atómica.
 *   - (MODO SINGLE-SEASON) Mantener solo la temporada actual y resetear al iniciar una nueva.
 *   - Migración desde legacy: gw2_wv_pinned_v1 / gw2_wv_marks_v1
 *
 * Notas:
 *   - NO guarda catálogos ni caches pesadas; sólo "state" (pinned, marks, prefs).
 *   - Esquema multi-season original: "wv:season:YY:SEQ" + índice "wv:season:index".
 *   - En single-season se usa clave única "wv:season:current".
 */

(function (root) {
  'use strict';

  var LOG = '[WVSeasonStore]';

  // --- CONFIG ---
  var SINGLE_SEASON_MODE = true;                // << activar una sola season viva
  var KEY_INDEX = 'wv:season:index';            // JSON: [{year,seq,season_id?,title?,start?,end?}, ...]
  var FILE_PREFIX = 'wv:season:';               // Base para multi-season
  var CURRENT_KEY = 'wv:season:current';        // Clave única en single-season

  var SHADOW_SUFFIX = '.__shadow';              // Escritura atómica: primero shadow, luego commit real
  var LEGACY_PINNED = 'gw2_wv_pinned_v1';       // { "<fp>:<seasonId|title>": { listingId: true|1, ... }, ... }
  var LEGACY_MARKS  = 'gw2_wv_marks_v1';        // { "<fp>:<seasonId|title>": { listingId: n, ... }, ... }
  var LS_KEYS       = 'gw2_keys';               // listado de keys guardadas (para inferir fps disponibles)

  // ---- Pequeñas utilidades
  function now(){ return Date.now(); }
  function escJson(x){ try{ return JSON.stringify(x)||''; }catch(_){ return ''; } }
  function parseJson(txt, def){
    try { return JSON.parse(txt||''); } catch(_) { return (def===undefined? null : def); }
  }
  function getLS(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function setLS(k, v){ localStorage.setItem(k, v); }
  function delLS(k){ try{ localStorage.removeItem(k); }catch(_){ } }

  function twoDigitYear(d){ var y = (d instanceof Date ? d.getUTCFullYear() : new Date(d||now()).getUTCFullYear()); return y % 100; }
  function toDate(x){ var d = new Date(x); return isNaN(+d) ? null : d; }

  // Fingerprint igual que en WV anteriores
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }

  // ---- Construcción de claves
  function keySeasonFile(year, seq){
    if (SINGLE_SEASON_MODE) return CURRENT_KEY;
    return FILE_PREFIX + String(year) + ':' + String(seq);
  }
  function keyShadow(seasonKey){ return seasonKey + SHADOW_SUFFIX; }

  // ---- Carga/guarda de índice
  function loadIndex(){
    var arr = parseJson(getLS(KEY_INDEX), []);
    return Array.isArray(arr) ? arr : [];
  }
  function saveIndex(idx){
    try { setLS(KEY_INDEX, JSON.stringify(idx || [])); }
    catch (e) { console.warn(LOG, 'saveIndex quota?', e); }
  }

  // ---- Buscar/crear entrada (multi-season only)
  function indexFind(idx, year, season_id){
    if (!idx || !idx.length) return null;
    if (season_id){
      for (var i=0;i<idx.length;i++){ var it = idx[i]; if (it && it.season_id && it.season_id===season_id) return it; }
    }
    var last=null;
    for (var j=0;j<idx.length;j++){ var it2=idx[j]; if (it2 && it2.year===year) last=it2; }
    return last;
  }

  // ---- Determinar season actual a partir de GW2Api.getWVSeason()
  function deriveSeasonInfo(gw2Season){
    var y = twoDigitYear(gw2Season && (gw2Season.start || gw2Season.end));
    return {
      year: y,
      season_id: (gw2Season && (gw2Season.id || null)) || null,
      title: (gw2Season && gw2Season.title) || null,
      start: (gw2Season && gw2Season.start) || null,
      end:   (gw2Season && gw2Season.end)   || null
    };
  }

  // ---- Lectura/escritura de un archivo de temporada
  function readSeason(year, seq){
    var k = keySeasonFile(year, seq);
    var obj = parseJson(getLS(k), null);
    var defSeq = SINGLE_SEASON_MODE ? 1 : seq;
    var defYear = (typeof year === 'number') ? year : twoDigitYear();
    if (!obj || typeof obj!=='object') {
      obj = { version:1, season_info:{year: defYear, seq: defSeq}, keys: {}, prefs: {} };
    } else {
      obj.version = (typeof obj.version==='number') ? obj.version : 1;
      obj.season_info = obj.season_info || { year: defYear, seq: defSeq };
      obj.keys = obj.keys || {};
      obj.prefs = obj.prefs || {};
      obj.season_info.year = (typeof obj.season_info.year==='number') ? obj.season_info.year : defYear;
      obj.season_info.seq  = (typeof obj.season_info.seq==='number')  ? obj.season_info.seq  : defSeq;
    }
    return obj;
  }

  function writeSeasonAtomic(year, seq, data){
    var k = keySeasonFile(year, seq);
    var shadow = keyShadow(k);
    var json = escJson(data);

    function doWrite(useShadow) {
      if (useShadow) {
        setLS(shadow, json);   // 1) shadow
        setLS(k, json);        // 2) commit
        delLS(shadow);         // 3) cleanup
      } else {
        setLS(k, json);
      }
    }

    try {
      doWrite(true);
      return true;
    } catch (e1) {
      var quota = (e1 && (e1.name==='QuotaExceededError' || String(e1).includes('Quota')));
      try { delLS(shadow); } catch(_){}

      if (!quota) throw e1;

      console.warn(LOG, 'writeSeasonAtomic quota (shadow). Compact & retry no-shadow…', e1);
      try { compact({ keepPerYear: 1 }); } catch(_){}

      try {
        doWrite(false);
        console.info(LOG, 'writeSeasonAtomic fallback sin shadow OK');
        return true;
      } catch (e2) {
        console.error(LOG, 'writeSeasonAtomic failed after compact + no-shadow', e2);
        throw e2;
      }
    }
  }

  // In-flight guard por archivo temporada (para coalescer writes simultáneos)
  var __inflight = new Map();
  function writeSeason(year, seq, producer, opts){
    opts = opts || {};
    var k = keySeasonFile(year, seq);
    if (__inflight.has(k)) {
      var chain = __inflight.get(k);
      var next = chain.finally(function(){ return writeSeason(year, seq, producer, opts); });
      __inflight.set(k, next);
      return next;
    }
    var p = Promise.resolve().then(function(){
      var obj = readSeason(year, seq);
      try { producer && producer(obj); } catch(e){ console.warn(LOG,'producer error', e); }
      try {
        writeSeasonAtomic(year, seq, obj);
      } catch (e) {
        var quota = (e && (e.name==='QuotaExceededError' || String(e).indexOf('Quota')>=0));
        if (!quota) throw e;
        console.warn(LOG, 'QuotaExceeded on writeSeason', k, e);
        try { compact({ keepPerYear: 6 }); } catch(_){}
        writeSeasonAtomic(year, seq, obj);
      }
      // Evento de mutación tras escribir (para WV / WVPD)
      try { window.dispatchEvent(new CustomEvent('wv:season-store:mutate', { detail: { key: k } })); } catch(_){}
    }).finally(function(){ __inflight.delete(k); });
    __inflight.set(k, p);
    return p;
  }

  // ---- API helpers por cuenta (fp) ----
  function ensureKeyBag(obj, fp){
    var bag = obj.keys[fp];
    if (!bag || typeof bag!=='object') { bag = { pinned:{}, marks:{}, prefs:{} }; obj.keys[fp] = bag; }
    bag.pinned = bag.pinned || {};
    bag.marks  = bag.marks  || {};
    bag.prefs  = bag.prefs  || {};
    return bag;
  }

  function getPinned(year, seq, fp){
    var obj = readSeason(year, seq);
    var bag = ensureKeyBag(obj, fp);
    return Object.assign({}, bag.pinned);
  }
  function setPinned(year, seq, fp, patch){
    return writeSeason(year, seq, function(obj){
      var bag = ensureKeyBag(obj, fp);
      Object.assign(bag.pinned, (patch||{}));
    });
  }
  function delPinned(year, seq, fp, ids){
    ids = Array.isArray(ids)? ids: [];
    return writeSeason(year, seq, function(obj){
      var bag = ensureKeyBag(obj, fp);
      ids.forEach(function(id){ delete bag.pinned[id]; });
    });
  }

  function getMarks(year, seq, fp){
    var obj = readSeason(year, seq);
    var bag = ensureKeyBag(obj, fp);
    return Object.assign({}, bag.marks);
  }
  function setMarks(year, seq, fp, patch){
    return writeSeason(year, seq, function(obj){
      var bag = ensureKeyBag(obj, fp);
      Object.keys(patch||{}).forEach(function(id){ bag.marks[id] = Number(patch[id]||0); });
    });
  }

  function getPrefs(year, seq){
    var obj = readSeason(year, seq);
    return Object.assign({}, obj.prefs||{});
  }
  function setPrefs(year, seq, patch){
    return writeSeason(year, seq, function(obj){
      obj.prefs = obj.prefs || {};
      Object.assign(obj.prefs, (patch||{}));
    });
  }
  function getKeyPrefs(year, seq, fp){
    var obj = readSeason(year, seq);
    var bag = ensureKeyBag(obj, fp);
    return Object.assign({}, bag.prefs);
  }
  function setKeyPrefs(year, seq, fp, patch){
    return writeSeason(year, seq, function(obj){
      var bag = ensureKeyBag(obj, fp);
      Object.assign(bag.prefs, (patch||{}));
    });
  }

  // ---- Listado / obtención de temporada actual ----
  function listSeasons(){
    if (!SINGLE_SEASON_MODE) {
      var idx = loadIndex();
      idx.sort(function(a,b){ if (a.year!==b.year) return a.year-b.year; return a.seq-b.seq; });
      return idx.slice();
    }
    // single-season: devolver única entrada derivada del archivo actual (o de getCurrentSeasonInfo)
    try {
      var cur = parseJson(getLS(CURRENT_KEY), null);
      if (cur && cur.season_info) {
        return [{ year: cur.season_info.year || twoDigitYear(), seq: 1, season_id: cur.season_info.season_id || null,
                  title: cur.season_info.title || null, start: cur.season_info.start || null, end: cur.season_info.end || null }];
      }
    } catch (_){}
    return [{ year: twoDigitYear(), seq: 1 }];
  }

  // Crea/actualiza entrada de temporada actual
  function getCurrentSeasonInfo(){
    // Si no está GW2Api, devolvemos algo neutro y aseguramos archivo mínimo
    if (!root.GW2Api || typeof root.GW2Api.getWVSeason!=='function'){
      var y0 = twoDigitYear();
      if (SINGLE_SEASON_MODE) {
        try {
          var obj0 = readSeason(y0, 1);
          obj0.season_info = Object.assign({}, obj0.season_info||{}, { year:y0, seq:1 });
          writeSeasonAtomic(y0, 1, obj0);
          saveIndex([{ year: y0, seq: 1, season_id: obj0.season_info.season_id || null, title: obj0.season_info.title || null, start: obj0.season_info.start || null, end: obj0.season_info.end || null }]);
        } catch(e){ console.warn(LOG, 'init (no GW2Api) write', e); }
      }
      return Promise.resolve({ year: y0, seq: 1, season_id: null, title: null, start:null, end:null });
    }

    return root.GW2Api.getWVSeason({ nocache: false }).then(function (s){
      var base = deriveSeasonInfo(s); // {year, season_id, title, start, end}
      if (SINGLE_SEASON_MODE) {
        // SINGLE-SEASON: todo se guarda en CURRENT_KEY, seq=1
        var y = base.year || twoDigitYear();
        var cur = parseJson(getLS(CURRENT_KEY), null);
        var curInfo = cur && cur.season_info ? cur.season_info : null;

        var sameId = !!(curInfo && curInfo.season_id && base.season_id && curInfo.season_id === base.season_id);

        if (!cur) {
          // no existe archivo -> crear
          var objNew = { version:1, season_info: Object.assign({ year: y, seq:1 }, base), keys:{}, prefs:{} };
          try { writeSeasonAtomic(y, 1, objNew); } catch(eA){ console.warn(LOG, 'init new current write', eA); }
          saveIndex([{ year: y, seq: 1, season_id: base.season_id||null, title: base.title||null, start: base.start||null, end: base.end||null }]);
          return { year: y, seq: 1, season_id: base.season_id||null, title: base.title||null, start: base.start||null, end: base.end||null };
        }

        if (!sameId && base.season_id) {
          // Detectamos NUEVA temporada (id distinto) => RESET
          var objReset = { version:1, season_info: Object.assign({ year: y, seq:1 }, base), keys:{}, prefs:{} };
          try { writeSeasonAtomic(y, 1, objReset); } catch(eB){ console.warn(LOG, 'reset SINGLE_SEASON write', eB); }
          saveIndex([{ year: y, seq: 1, season_id: base.season_id||null, title: base.title||null, start: base.start||null, end: base.end||null }]);
          return { year: y, seq: 1, season_id: base.season_id||null, title: base.title||null, start: base.start||null, end: base.end||null };
        }

        // Misma season: refrescar metadata (por si cambia titulo/fechas)
        var objCur = readSeason(y, 1);
        objCur.season_info = Object.assign({}, objCur.season_info||{}, base, { year:y, seq:1 });
        try { writeSeasonAtomic(y, 1, objCur); } catch(eC){ console.warn(LOG, 'update SINGLE_SEASON write', eC); }
        saveIndex([{ year: y, seq: 1, season_id: objCur.season_info.season_id||null, title: objCur.season_info.title||null, start: objCur.season_info.start||null, end: objCur.season_info.end||null }]);
        return { year: y, seq: 1, season_id: objCur.season_info.season_id||null, title: objCur.season_info.title||null, start: objCur.season_info.start||null, end: objCur.season_info.end||null };
      }

      // MODO MULTI-SEASON (compat anterior)
      var idx = loadIndex();
      var found = indexFind(idx, base.year, base.season_id);
      var entry;

      if (found && found.season_id && base.season_id && found.season_id === base.season_id) {
        found.title = base.title || found.title || null;
        found.start = base.start || found.start || null;
        found.end   = base.end   || found.end   || null;
        entry = found;
      } else if (found && !base.season_id) {
        entry = found;
      } else {
        var lastSeq = 0;
        for (var i=0;i<idx.length;i++) if (idx[i] && idx[i].year===base.year) lastSeq = Math.max(lastSeq, Number(idx[i].seq||0));
        entry = {
          year: base.year,
          seq: (lastSeq||0) + 1,
          season_id: base.season_id || null,
          title: base.title || null,
          start: base.start || null,
          end: base.end || null
        };
        idx.push(entry);
      }
      saveIndex(idx);

      var obj = readSeason(entry.year, entry.seq);
      obj.season_info = Object.assign({}, obj.season_info||{}, entry);
      try { writeSeasonAtomic(entry.year, entry.seq, obj); } catch(e){ console.warn(LOG, 'init write Season file', e); }

      return { year: entry.year, seq: entry.seq, season_id: entry.season_id, title: entry.title, start: entry.start, end: entry.end };
    }).catch(function(e){
      console.warn(LOG, 'getCurrentSeasonInfo failed, fallback', e);
      var yy = twoDigitYear();
      if (SINGLE_SEASON_MODE) {
        try {
          var o = readSeason(yy, 1);
          o.season_info = Object.assign({}, o.season_info||{}, { year: yy, seq:1 });
          writeSeasonAtomic(yy, 1, o);
          saveIndex([{ year: yy, seq:1, season_id: o.season_info.season_id||null, title: o.season_info.title||null, start: o.season_info.start||null, end: o.season_info.end||null }]);
        } catch(_){}
      }
      return { year: yy, seq: 1, season_id: null, title: null, start:null, end:null };
    });
  }

  // ---- Compactación (purga temporadas viejas)
  // policy: { keepPerYear?: number, keepYears?: number[], keepRecent?: number }
  function compact(policy){
    policy = policy || { keepPerYear: 6 };

    if (SINGLE_SEASON_MODE) {
      // En single-season, mantener sólo CURRENT_KEY y el index con una sola entrada.
      var freed = 0, kept = 0;
      try {
        // Borrar cualquier wv:season:YY:SEQ residual
        for (var i=0; i<localStorage.length; i++){
          var k = localStorage.key(i);
          if (!k) continue;
          if (k.indexOf(FILE_PREFIX)===0 && k !== CURRENT_KEY && k !== KEY_INDEX) {
            var v = getLS(k);
            if (v != null) freed += (v.length || 0);
            delLS(k);
          }
        }
        // Reescribir index acorde al CURRENT_KEY si existe
        var cur = parseJson(getLS(CURRENT_KEY), null);
        if (cur && cur.season_info) {
          saveIndex([{ year: cur.season_info.year || twoDigitYear(), seq:1, season_id: cur.season_info.season_id||null,
                       title: cur.season_info.title||null, start: cur.season_info.start||null, end: cur.season_info.end||null }]);
          kept = 1;
        } else {
          saveIndex([{ year: twoDigitYear(), seq:1 }]);
          kept = 0;
        }
      } catch(e){ console.warn(LOG, 'compact single-season', e); }
      console.info(LOG, 'compact(single) freed', (freed/1024).toFixed(1)+'KB', 'kept', kept, 'policy', policy);
      return { freedBytes: freed, kept: kept };
    }

    // Multi-season (comportamiento original)
    var idx = loadIndex();
    if (!idx.length) return { freedBytes: 0, kept: 0 };

    var byYear = new Map();
    idx.forEach(function(it){ if(!byYear.has(it.year)) byYear.set(it.year, []); byYear.get(it.year).push(it); });

    var keepKeys = new Set();
    byYear.forEach(function(list, year){
      list.sort(function(a,b){ return a.seq-b.seq; }); // asc
      var keepN = Math.max(1, Number(policy.keepPerYear||6));
      var startKeep = Math.max(0, list.length - keepN);
      for (var i=startKeep; i<list.length; i++){
        var it = list[i];
        keepKeys.add(keySeasonFile(it.year, it.seq));
      }
    });

    var freed = 0, kept = 0;
    idx.forEach(function(it){
      var k = keySeasonFile(it.year, it.seq);
      var v = getLS(k);
      if (keepKeys.has(k)) {
        kept++;
      } else if (v != null) {
        freed += (v.length || 0);
        delLS(k);
      }
    });

    var newIdx = [];
    idx.forEach(function(it){ var k=keySeasonFile(it.year,it.seq); if (keepKeys.has(k)) newIdx.push(it); });
    saveIndex(newIdx);

    console.info(LOG, 'compact freed', (freed/1024).toFixed(1)+'KB', 'kept', kept, 'policy', policy);
    return { freedBytes: freed, kept: kept };
  }

  // ---- Migración desde legacy (se ejecuta una vez a demanda)
  function migrateFromLegacy(){
    var moved = false;
    var details = [];

    var legacyPinned = parseJson(getLS(LEGACY_PINNED), {}) || {};
    var legacyMarks  = parseJson(getLS(LEGACY_MARKS),  {}) || {};

    var promise = getCurrentSeasonInfo().then(function (cur){
      var year = cur.year, seq = cur.seq;
      var seasonId = (cur.season_id || cur.title || 'season');

      var keysList = parseJson(getLS(LS_KEYS), []) || [];
      var fps = [];
      try {
        fps = keysList.map(function(k){ return fpToken(k && k.value); }).filter(Boolean);
      } catch(_){}

      var writes = [];

      // PINNED
      Object.keys(legacyPinned).forEach(function(ns){
        var parts = String(ns).split(':');
        if (parts.length < 2) return;
        var fp = parts[0];
        var seasonTag = parts.slice(1).join(':');
        var bag = legacyPinned[ns] || {};

        var matches = (seasonTag === seasonId);
        if (matches || fps.indexOf(fp)>=0) {
          writes.push(writeSeason(year, seq, function(obj){
            var kb = ensureKeyBag(obj, fp);
            Object.assign(kb.pinned, bag);
          }));
          moved = true;
          details.push('pinned:'+ns+' -> '+keySeasonFile(year,seq)+'/'+fp);
        }
      });

      // MARKS
      Object.keys(legacyMarks).forEach(function(ns){
        var parts = String(ns).split(':');
        if (parts.length < 2) return;
        var fp = parts[0];
        var seasonTag = parts.slice(1).join(':');
        var bag = legacyMarks[ns] || {};

        var matches = (seasonTag === seasonId);
        if (matches || fps.indexOf(fp)>=0) {
          writes.push(writeSeason(year, seq, function(obj){
            var kb = ensureKeyBag(obj, fp);
            Object.keys(bag).forEach(function(id){ kb.marks[id] = Number(bag[id]||0); });
          }));
          moved = true;
          details.push('marks:'+ns+' -> '+keySeasonFile(year,seq)+'/'+fp);
        }
      });

      return Promise.all(writes).then(function(){
        if (moved){
          try { delLS(LEGACY_PINNED); }catch(_){}
          try { delLS(LEGACY_MARKS); }catch(_){}
        }
        return { moved: moved, details: details };
      });
    });

    return promise;
  }

  // ---- Export API
  var WVSeasonStore = {
    // Identidad actual y navegación por historial
    getCurrentSeasonInfo: getCurrentSeasonInfo,
    listSeasons: listSeasons,

    // Acceso a temporada
    readSeason: readSeason,
    writeSeason: writeSeason,

    // Helpers de cuenta (fp)
    getPinned: getPinned,
    setPinned: setPinned,
    delPinned: delPinned,
    getMarks: getMarks,
    setMarks: setMarks,

    // Preferencias
    getPrefs: getPrefs,
    setPrefs: setPrefs,
    getKeyPrefs: getKeyPrefs,
    setKeyPrefs: setKeyPrefs,

    // Mantenimiento / migración
    compact: compact,
    migrateFromLegacy: migrateFromLegacy,

    // Exponer utilidades por si fuesen útiles
    __util: {
      keySeasonFile: keySeasonFile,
      keyShadow: keyShadow,
      fpToken: fpToken
    },
    __cfg: { KEY_INDEX: KEY_INDEX, FILE_PREFIX: FILE_PREFIX, CURRENT_KEY: CURRENT_KEY, SINGLE_SEASON_MODE: SINGLE_SEASON_MODE }
  };

  // Colgar servicio en window
  root.WVSeasonStore = WVSeasonStore;
  console.info(LOG, 'ready v1.1.0 (single-season=' + SINGLE_SEASON_MODE + ')');

})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));