/*!
 * js/wv-season-storage.js — Servicio de almacenamiento por temporada (Wizard's Vault)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.0 (2026-03-04)
 *
 * Objetivo:
 *   - Persistir TODO lo relevante de Wizard's Vault por temporada en 1 "archivo" (entrada LS) por temporada.
 *   - Consumido por Tienda y Detalle de Compras.
 *   - Evitar QuotaExceeded: partición por temporada + compact() y escritura atómica.
 *   - Mantener historial de temporadas: índice maestro + selector por temporada.
 *   - Migración desde legacy: gw2_wv_pinned_v1 / gw2_wv_marks_v1
 *
 * Notas:
 *   - NO guarda catálogos ni caches pesadas; sólo "state" (pinned, marks, prefs).
 *   - Usa esquema: "wv:season:YY:SEQ" + índice "wv:season:index".
 *   - YY = año (2 dígitos) de la temporada; SEQ = n° de temporada dentro del año.
 *   - current season se determina con GW2Api.getWVSeason(); si es nueva, crea entrada con SEQ consecutivo.
 */

(function (root) {
  'use strict';

  var LOG = '[WVSeasonStore]';
  var KEY_INDEX = 'wv:season:index';             // JSON: [{year,seq,season_id?,title?,start?,end?}, ...]
  var FILE_PREFIX = 'wv:season:';                // Archivo por temporada: 'wv:season:26:1'
  var SHADOW_SUFFIX = '.__shadow';               // Escritura atómica: primero shadow, luego commit real
  var LEGACY_PINNED = 'gw2_wv_pinned_v1';        // { "<fp>:<seasonId|title>": { listingId: true|1, ... }, ... }
  var LEGACY_MARKS  = 'gw2_wv_marks_v1';         // { "<fp>:<seasonId|title>": { listingId: n, ... }, ... }
  var LS_KEYS       = 'gw2_keys';                // listado de keys guardadas (para inferir fps disponibles)

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
  function keySeasonFile(year, seq){ return FILE_PREFIX + String(year) + ':' + String(seq); }
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

  // ---- Buscar/crear entrada de temporada actual
  function indexFind(idx, year, season_id){
    if (!idx || !idx.length) return null;
    // Primero por season_id (si existe), luego por último SEQ del mismo año
    if (season_id){
      for (var i=0;i<idx.length;i++){ var it = idx[i]; if (it && it.season_id && it.season_id===season_id) return it; }
    }
    // nada por id, devolver el último del año (no crear)
    var last=null;
    for (var j=0;j<idx.length;j++){ var it2=idx[j]; if (it2 && it2.year===year) last=it2; }
    return last;
  }

  // ---- Determinar season actual a partir de GW2Api.getWVSeason()
  function deriveSeasonInfo(gw2Season){
    // year por start si existe; si no, por "ahora"
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
    if (!obj || typeof obj!=='object') {
      obj = { version:1, season_info:{year: year, seq: seq}, keys: {}, prefs: {} };
    } else {
      // asegurar estructura mínima
      obj.version = (typeof obj.version==='number') ? obj.version : 1;
      obj.season_info = obj.season_info || { year: year, seq: seq };
      obj.keys = obj.keys || {};
      obj.prefs = obj.prefs || {};
      // normalizar seq/year si faltara
      obj.season_info.year = (typeof obj.season_info.year==='number') ? obj.season_info.year : year;
      obj.season_info.seq  = (typeof obj.season_info.seq==='number')  ? obj.season_info.seq  : seq;
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
        // Fallback sin shadow (no atómico, pero entra en cuotas muy justas)
        setLS(k, json);
      }
    }

    // 1er intento: con shadow (atómico)
    try {
      doWrite(true);
      return true;
    } catch (e1) {
      var quota = (e1 && (e1.name==='QuotaExceededError' || String(e1).includes('Quota')));
      // Limpia shadow si quedó colgado
      try { delLS(shadow); } catch(_){}

      if (!quota) throw e1;

      console.warn('[WVSeasonStore] writeSeasonAtomic quota (shadow). Compact & retry no-shadow…', e1);
      try { compact({ keepPerYear: 1 }); } catch(_){}

      // 2do intento: sin shadow
      try {
        doWrite(false);
        console.info('[WVSeasonStore] writeSeasonAtomic fallback sin shadow OK');
        return true;
      } catch (e2) {
        console.error('[WVSeasonStore] writeSeasonAtomic failed after compact + no-shadow', e2);
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
      // coalesce: esperar a que termine el actual y luego ejecutar (último gana)
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
        // compact + retry (una vez)
        try { compact({ keepPerYear: 6 }); } catch(_){}
        writeSeasonAtomic(year, seq, obj);
      }
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
    var idx = loadIndex();
    // Orden natural: por year asc, seq asc
    idx.sort(function(a,b){ if (a.year!==b.year) return a.year-b.year; return a.seq-b.seq; });
    return idx.slice();
  }

  // Crea/actualiza entrada de temporada actual (si GW2Api disponible)
  function getCurrentSeasonInfo(){
    // Puede no estar GW2Api en tiempo de carga: devolvemos por defecto
    var pr = Promise.resolve();
    if (!root.GW2Api || typeof root.GW2Api.getWVSeason!=='function'){
      return Promise.resolve({ year: twoDigitYear(), seq: 1, season_id: null, title: null, start:null, end:null });
    }
    return root.GW2Api.getWVSeason({ nocache: false }).then(function (s){
      var base = deriveSeasonInfo(s); // {year, season_id, title, start, end}
      var idx = loadIndex();

      // ¿existe ya esta temporada?
      var found = indexFind(idx, base.year, base.season_id);
      var entry;

      if (found && found.season_id && base.season_id && found.season_id === base.season_id) {
        // ya existe entrada para este season_id
        // refrescamos metadata
        found.title = base.title || found.title || null;
        found.start = base.start || found.start || null;
        found.end   = base.end   || found.end   || null;
        entry = found;
      } else if (found && !base.season_id) {
        // Tenemos una del mismo año; usamos la última SEQ conocida
        entry = found;
      } else {
        // Nueva temporada => creamos SEQ = último del año + 1
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

      // Garantizar archivo temporada mínimo
      var obj = readSeason(entry.year, entry.seq);
      // Actualizar season_info si hay variaciones
      obj.season_info = Object.assign({}, obj.season_info||{}, entry);
      try { writeSeasonAtomic(entry.year, entry.seq, obj); } catch(e){ console.warn(LOG, 'init write Season file', e); }

      return { year: entry.year, seq: entry.seq, season_id: entry.season_id, title: entry.title, start: entry.start, end: entry.end };
    }).catch(function(e){
      console.warn(LOG, 'getCurrentSeasonInfo failed, fallback', e);
      // Fallback neutro (no creamos índice si API falla)
      return { year: twoDigitYear(), seq: 1, season_id: null, title: null, start:null, end:null };
    });
  }

  // ---- Compactación (purga temporadas viejas)
  // policy: { keepPerYear?: number, keepYears?: number[], keepRecent?: number }
  function compact(policy){
    policy = policy || { keepPerYear: 6 };
    var idx = loadIndex();
    if (!idx.length) return { freedBytes: 0, kept: 0 };

    // Agrupar por año
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

    // calcular a borrar
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

    // Re-escribir index sólo con los kept
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

    // Determinar temporada actual (para llevar legacy -> temporada actual)
    // No conocemos mapping de otras temporadas legacy => migramos sólo la "vigente"
    // con heurística de ns "<fp>:<seasonId|title actual>".
    var promise = getCurrentSeasonInfo().then(function (cur){
      var year = cur.year, seq = cur.seq;
      var seasonId = (cur.season_id || cur.title || 'season');

      // Obtener fps presentes (si están guardadas keys)
      var keysList = parseJson(getLS(LS_KEYS), []) || [];
      var fps = [];
      try {
        fps = keysList.map(function(k){ return fpToken(k && k.value); }).filter(Boolean);
      } catch(_){}

      // Recorrer todo legacy; mover ns que coincidan con temporada actual
      var writes = [];

      // PINNED
      Object.keys(legacyPinned).forEach(function(ns){
        // ns form legacy: "<fp>:<seasonId|title>"
        var parts = String(ns).split(':');
        if (parts.length < 2) return;
        var fp = parts[0];
        var seasonTag = parts.slice(1).join(':'); // por si el title tenía ':'
        var bag = legacyPinned[ns] || {};

        var matches = (seasonTag === seasonId);
        // Si no hay exact match por id/title, igual lo admitimos si el fp existe y aún no hay bag actual
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
        // Opcional: limpiar legacy sólo si movimos algo
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
    __cfg: { KEY_INDEX: KEY_INDEX, FILE_PREFIX: FILE_PREFIX }
  };

  // Colgar servicio en window
  root.WVSeasonStore = WVSeasonStore;
  console.info(LOG, 'ready v1.0.0');

})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));