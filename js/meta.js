/*!
 * js/meta.js — Metas y Eventos · Bóveda del Gato Negro
 * Versión: 4.0.1 (2026-10-23) — BL-057
 * 4.0.1 (MET-1c, DEC-031): vistas previas desde assets/previews/; si falta o no carga, «Sin vista previa»
 *   limpio (nunca la imagen rota ni el texto alternativo suelto).
 * 4.0.0 (MET-1): Ahora, Próximas 3 horas, Fijadas (6) y Todas las metas por expansión; filtros desde los
 *   datos; «Hecho hoy» solo donde la API lo sabe; tick de 30 s; BL-041; sin «Vista compacta»;
 *   Meta.snapshot() y gn:meta-rendered para la cabecera (MET-2). Historia: CHANGELOG.md y git.
 */
(function () {
  'use strict';

  var VERSION = '4.0.1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  console.info('%cMetaEventos meta.js v' + VERSION, 'color:#7dd3fc; font-weight:700');

  var el = {
    panel: $('#metaPanel'),
    status: $('#metaStatus'),
    miniNext: $('#metaMiniNext'),
    refreshFlagsBtn: $('#metaRefreshFlags')
  };

  var LS_FAVS = ((typeof Storage !== 'undefined' && Storage.STORAGE_KEYS) ? Storage.STORAGE_KEYS.META_FAVS : null) || 'gn:meta:favs';
  var SOON_MIN = 20;
  var TICK_MS = 30000;
  var AGENDA_H = 3;
  var MAX_PINS = 6;
  var DAY = 86400000;
  var ICON = 'assets/icons/';

  // --------- Normalización de expansiones/temporadas ----------
  const EXP_MAP = {
    'core':'core', 'core tyria':'core',
    'hot':'hot', 'heart of thorns':'hot',
    'pof':'pof', 'path of fire':'pof',
    'eod':'eod', 'end of dragons':'eod',
    'soto':'soto', 'secrets of the obscure':'soto',
    'janthir':'janthir',
    'voe':'visionseternity', 'visions of eternity':'visionseternity',
    'lw2':'livingworlds2', 'living world s2':'livingworlds2',
    'living world season 2':'livingworlds2', 'livingworlds2':'livingworlds2',
    'lw3':'livingworlds3', 'living world s3':'livingworlds3',
    'living world season 3':'livingworlds3', 'livingworlds3':'livingworlds3',
    'ls4':'livingworlds4', 'living world s4':'livingworlds4',
    'living world season 4':'livingworlds4', 'livingworlds4':'livingworlds4',
    'ibs':'icebroodsaga', 'icebrood saga':'icebroodsaga',
    'the icebrood saga':'icebroodsaga', 'living world season 5':'icebroodsaga',
    'lw5':'icebroodsaga',
    'visions of the past':'icebroodsaga',
    'steel and fire':'icebroodsaga'
  };
  var EXP_TINT = {
    core: '#DC241F', hot: '#1E8D39', pof: '#f5a14c', eod: '#15C3B7', soto: '#A6A75A',
    janthir: '#3A6EEB', visionseternity: '#C28E0E', livingworlds2: '#f6654f',
    livingworlds3: '#1E8D39', livingworlds4: '#e545ca', icebroodsaga: '#7EC3FF'
  };
  var EXP_ICON = {
    core: 'core.png', hot: 'HoT.png', pof: 'PoF.png', eod: 'EoD.webp', soto: 'SoTO.webp',
    janthir: 'JW.webp', visionseternity: 'VoE.webp', livingworlds2: 'ls2.png',
    livingworlds3: 'ls2.png', livingworlds4: 'ls4.png', icebroodsaga: 'is ls5.png'
  };
  // Orden de salida y nombres para el jugador.
  var EXP_ORDER = ['Core', 'Living World S2', 'HoT', 'PoF', 'Living World S4', 'Icebrood Saga',
                   'EoD', 'SotO', 'Janthir', 'Visions of Eternity'];
  var EXP_NAME = {
    'Core': 'Tyria Central', 'Living World S2': 'Mundo Viviente T2', 'HoT': 'Heart of Thorns',
    'PoF': 'Path of Fire', 'Living World S4': 'Mundo Viviente T4', 'Icebrood Saga': 'Icebrood Saga',
    'EoD': 'End of Dragons', 'SotO': 'Secrets of the Obscure', 'Janthir': 'Janthir Wilds',
    'Visions of Eternity': 'Visions of Eternity'
  };
  var TYPE_ONE = { worldboss: 'Jefe del mundo', meta: 'Meta de mapa', event: 'Evento', temple: 'Templo',
                   convergence: 'Convergencia', global: 'Global', instance: 'Instancia', fractal: 'Incursión fractal' };
  var TYPE_MANY = { worldboss: 'Jefes del mundo', meta: 'Metas de mapa', event: 'Eventos', temple: 'Templos',
                    convergence: 'Convergencias', global: 'Globales', instance: 'Instancias', fractal: 'Incursiones fractales' };

  function expKeyOf(meta) {
    var raw = String((meta && meta.expansion) || '').toLowerCase().trim();
    return EXP_MAP[raw] || raw.replace(/\s+/g, '');
  }
  function expName(v) { return EXP_NAME[v] || v || '—'; }
  function typeOne(t) { return TYPE_ONE[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'); }
  function typeMany(t) { return TYPE_MANY[t] || typeOne(t); }

  // Opciones de expansión que faltan en index.html (v3.5.0).
  var EXP_LABEL = { 'Janthir': 'Janthir Wilds' };
  function expansionOptions(existing, metas) {
    var have = new Set(existing || []);
    var out = [];
    (metas || []).forEach(function (m) {
      var v = m && m.expansion;
      if (!v || have.has(v)) return;
      have.add(v);
      out.push({ value: v, label: EXP_LABEL[v] || v });
    });
    var rank = function (v) { var i = EXP_ORDER.indexOf(v); return i < 0 ? EXP_ORDER.length : i; };
    return out.sort(function (a, b) { return rank(a.value) - rank(b.value); });
  }

  // ── REGLAS PURAS (tiempo, filtros, agenda) — probadas en tests/meta-view.test.cjs ──
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  // Inicios (ms) de ayer a pasado mañana en UTC; con los de ayer, BL-041.
  function startsAround(meta, now) {
    var t = new Date(+now);
    var base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    var out = [];
    [-1, 0, 1, 2].forEach(function (d) {
      (meta.windowsUTC || []).forEach(function (w) {
        var p = String(w).split(':');
        out.push(base + d * DAY + (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) * 60000);
      });
    });
    return out.sort(function (a, b) { return a - b; });
  }

  // Estado: 'active' | 'soon' (≤ 20 min) | 'later' | 'none'; mins redondeado hacia arriba.
  function instanceAt(meta, now) {
    var t = +now, dur = (meta.durationMin || 15) * 60000, starts = startsAround(meta, now);
    if (!starts.length) return { state: 'none', start: null, end: null, nextAt: null, mins: null, upcoming: [] };
    for (var i = 0; i < starts.length; i++) {
      var s = starts[i];
      if (t >= s && t < s + dur) {
        return { state: 'active', start: new Date(s), end: new Date(s + dur), nextAt: new Date(s + dur),
          mins: Math.max(1, Math.ceil((s + dur - t) / 60000)),
          upcoming: starts.filter(function (x) { return x > s; }).slice(0, 3).map(function (x) { return new Date(x); }) };
      }
    }
    var fut = starts.filter(function (x) { return x > t; });
    var n = fut[0], mins = Math.max(1, Math.ceil((n - t) / 60000));
    return { state: mins <= SOON_MIN ? 'soon' : 'later', start: new Date(n), end: new Date(n + dur), nextAt: new Date(n),
      mins: mins, upcoming: fut.slice(0, 3).map(function (x) { return new Date(x); }) };
  }

  // Inicios en las próximas `hours` horas (sin el que está en curso).
  function startsWithin(meta, now, hours) {
    var t = +now, lim = t + hours * 3600000;
    return startsAround(meta, now).filter(function (x) { return x > t && x <= lim; }).map(function (x) { return new Date(x); });
  }

  // Agenda por hora local: [{key, label, count, slots:[{at, ids}]}].
  function agendaOf(metas, now, hours) {
    var items = [];
    metas.forEach(function (m) { startsWithin(m, now, hours).forEach(function (at) { items.push({ at: at, m: m }); }); });
    items.sort(function (a, b) { return a.at - b.at || String(a.m.name).localeCompare(String(b.m.name), 'es'); });
    var groups = [], byKey = {};
    items.forEach(function (it) {
      var hourStart = new Date(+it.at); hourStart.setMinutes(0, 0, 0);
      var key = String(+hourStart);
      var g = byKey[key];
      if (!g) { g = byKey[key] = { key: key, label: pad2(it.at.getHours()) + ':00', count: 0, slots: [] }; groups.push(g); }
      var last = g.slots[g.slots.length - 1];
      if (!last || +last.at !== +it.at) { last = { at: it.at, ids: [] }; g.slots.push(last); }
      last.ids.push(it.m.id);
      g.count++;
    });
    return groups;
  }

  function isTracked(meta) { var a = meta && meta.api; return !!(a && (a.worldBossId || a.mapChestId)); }
  // true / false si la API lo sabe; null si no hay forma de saberlo.
  function doneOf(meta, flags) {
    if (!isTracked(meta) || !flags || flags.state !== 'ok') return null;
    return !!((meta.api.worldBossId && flags.worldbosses.has(meta.api.worldBossId)) ||
              (meta.api.mapChestId && flags.mapchests.has(meta.api.mapChestId)));
  }
  function hasDrop(meta) {
    if (meta.highlightItemId) return true;
    var ext = Array.isArray(meta._extItems) ? meta._extItems[0] : null;
    return !!(ext && ext.itemName && ext.itemName !== '—');
  }

  // Filtros de «Todas las metas». row = { meta, inst, done }.
  function matches(row, f) {
    var m = row.meta, i = row.inst;
    if (f.q) {
      var q = fold(f.q).trim();
      if (q && fold(m.name + ' ' + (m.map || '') + ' ' + typeOne(m.type)).indexOf(q) < 0) return false;
    }
    if (f.type && m.type !== f.type) return false;
    if (f.exp && m.expansion !== f.exp) return false;
    if (f.when === 'hour' && !(i.state === 'active' || (i.mins != null && i.mins <= 60))) return false;
    if (f.when === 'pending' && row.done !== false) return false;
    if (f.hideDone && row.done === true) return false;
    if (f.onlyDrop && !hasDrop(m)) return false;
    return true;
  }

  function countBy(metas, key) {
    var c = {};
    metas.forEach(function (m) { var v = m[key]; if (v) c[v] = (c[v] || 0) + 1; });
    return c;
  }
  function typeCounts(metas) {
    var c = countBy(metas, 'type');
    return Object.keys(c).map(function (k) { return { value: k, label: typeMany(k), n: c[k] }; })
      .sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label, 'es'); });
  }
  function expCounts(metas) {
    var c = countBy(metas, 'expansion');
    var rank = function (v) { var i = EXP_ORDER.indexOf(v); return i < 0 ? EXP_ORDER.length : i; };
    return Object.keys(c).sort(function (a, b) { return rank(a) - rank(b) || a.localeCompare(b); })
      .map(function (k) { return { value: k, label: expName(k), n: c[k] }; });
  }

  var RANK = { active: 0, soon: 1, later: 2, none: 3 };
  function byTime(a, b) {
    var r = RANK[a.inst.state] - RANK[b.inst.state];
    if (r) return r;
    var an = a.inst.nextAt ? +a.inst.nextAt : Infinity, bn = b.inst.nextAt ? +b.inst.nextAt : Infinity;
    return an - bn || String(a.meta.name).localeCompare(String(b.meta.name), 'es');
  }
  // Grupos por expansión en orden de salida; lo que no tiene horario, al final y aparte.
  function groupByExp(rows) {
    var timed = rows.filter(function (r) { return r.inst.state !== 'none'; });
    var none = rows.filter(function (r) { return r.inst.state === 'none'; });
    var out = expCounts(timed.map(function (r) { return r.meta; })).map(function (e) {
      return { exp: e.value, label: e.label, rows: timed.filter(function (r) { return r.meta.expansion === e.value; }).sort(byTime) };
    });
    if (none.length) out.push({ exp: null, label: 'Sin horario fijo', rows: none.sort(byTime) });
    return out;
  }

  function nextResetUTC(now) {
    var d = new Date(now ? +now : Date.now());
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  }

  // ── ESTADO ──
  var seed = [];
  var favs = [];
  var rows = [];
  var openIds = new Set();
  var wpOverride = {};
  var filters = { q: '', type: '', exp: '', when: 'all', hideDone: false, onlyDrop: false };
  var flags = { state: 'none', worldbosses: new Set(), mapchests: new Set(), lastTs: 0, lastHuman: '—' };
  var _flagsSeq = 0, _flagsAbort = null;
  var root = null, tickT = null, midnightT = null, qT = null, inited = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function setStatus(msg, kind) {
    if (!el.status) return;
    el.status.textContent = msg;
    el.status.style.color = kind === 'error' ? 'var(--color-red)' : (kind === 'ok' ? 'var(--color-green)' : 'var(--muted)');
  }
  function notify(kind, msg, ttl) {
    if (typeof toast !== 'function') return;
    if (toast.legacy) toast.legacy(msg, kind === 'success' ? 'ok' : kind, ttl);
    else toast(kind, msg, { ttl: ttl });
  }
  function token() { return (window.__GN__ && typeof window.__GN__.getSelectedToken === 'function') ? window.__GN__.getSelectedToken() : null; }

  // --------- Datos ----------
  var externalDrops = new Map();
  async function loadExternalDrops() {
    try {
      var r = await fetch('assets/meta-drops.json?v=2.6.0', { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return;
      var arr = await r.json();
      externalDrops = new Map(arr.map(function (x) { return [String(x.metaId || '').trim(), x]; }));
    } catch (e) { console.warn('[meta] meta-drops.json no disponible', e); }
  }
  async function loadSeed() {
    var r = await fetch('assets/meta-events.json?v=2.6.0', { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('No se pudo cargar meta-events.json');
    seed = await r.json();
    await loadExternalDrops();
    seed = seed.map(function (m) {
      var ext = externalDrops.get(m.id);
      if (!ext) return m;
      var merged = Object.assign({}, m);
      if (Object.prototype.hasOwnProperty.call(ext, 'highlightItemId')) merged.highlightItemId = ext.highlightItemId;
      if (Array.isArray(ext.items)) merged._extItems = ext.items;
      return merged;
    });
  }
  function loadFavs() {
    try { var v = Storage.get(LS_FAVS); favs = Array.isArray(v) ? v.filter(function (x, i, a) { return a.indexOf(x) === i; }) : []; }
    catch (_) { favs = []; }
  }
  function saveFavs() { try { Storage.set(LS_FAVS, favs.slice()); } catch (_) {} }

  // --------- API: lo hecho hoy (jefes del mundo y cofres de mapa) ----------
  // null = la Key no tiene permiso (401/403); un fallo de red lanza (no es «no hiciste nada»).
  async function fetchAccountSet(kind, tok, signal) {
    var r = await fetch('https://api.guildwars2.com/v2/account/' + kind + '?access_token=' + encodeURIComponent(tok),
      { headers: { 'Accept': 'application/json' }, signal: signal });
    if (r.status === 401 || r.status === 403) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status + ' /v2/account/' + kind);
    var arr = await r.json();
    return new Set(Array.isArray(arr) ? arr : []);
  }
  async function refreshAccountFlags(opts) {
    var tok = (opts && opts.token != null) ? opts.token : token();
    if (!tok) {
      flags.state = 'none'; flags.worldbosses = new Set(); flags.mapchests = new Set(); flags.lastTs = 0; flags.lastHuman = '—';
      return;
    }
    var seq = ++_flagsSeq;
    try {
      if (_flagsAbort) _flagsAbort.abort();
      _flagsAbort = typeof AbortController === 'function' ? new AbortController() : null;
      var signal = _flagsAbort ? _flagsAbort.signal : undefined;
      flags.state = 'loading'; renderFlags();
      var res = await Promise.all([fetchAccountSet('worldbosses', tok, signal), fetchAccountSet('mapchests', tok, signal)]);
      if (seq !== _flagsSeq) return;
      if (res[0] === null && res[1] === null) { flags.state = 'noperm'; flags.worldbosses = new Set(); flags.mapchests = new Set(); return; }
      flags.worldbosses = res[0] || new Set();
      flags.mapchests = res[1] || new Set();
      flags.lastTs = Date.now();
      flags.lastHuman = hhmm(new Date(flags.lastTs));
      flags.state = 'ok';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (seq !== _flagsSeq) return;
      console.warn('[meta] hecho hoy', e);
      flags.state = 'error';
    }
  }

  // --------- Anomalía de Línea Ley (waypoint según el mapa activo) ----------
  // /v2/events retirado (503, 2026-09-29): waypoint fijo de meta.chat.
  var LEY_LINE_ENDPOINT_RETIRED = true;
  var _leyLineCache = { mapId: null, ts: 0 };
  async function fetchLeyLineActiveMap(eventIds) {
    if (!eventIds || !eventIds.length || LEY_LINE_ENDPOINT_RETIRED) return _leyLineCache.mapId;
    if (_leyLineCache.mapId && Date.now() - _leyLineCache.ts < 120000) return _leyLineCache.mapId;
    try {
      var r = await fetch('https://api.guildwars2.com/v2/events?ids=' + eventIds.join(','), { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return _leyLineCache.mapId;
      var evs = await r.json();
      for (var i = 0; i < evs.length; i++) {
        if (evs[i] && (evs[i].state === 'Active' || evs[i].state === 'Warmup')) { _leyLineCache = { mapId: evs[i].map_id, ts: Date.now() }; break; }
      }
    } catch (_) {}
    return _leyLineCache.mapId;
  }
  function getWaypointForMapId(mapId, waypoints) {
    var names = { 25: 'Gendarran Fields', 28: 'Iron Marches', 34: 'Timberline Falls' };
    return (waypoints && names[mapId]) ? waypoints[names[mapId]] : null;
  }
  async function refreshLeyLines() {
    for (var i = 0; i < seed.length; i++) {
      var m = seed[i];
      if (m.api && Array.isArray(m.api.eventIds) && m.api.eventIds.length) {
        var mapId = await fetchLeyLineActiveMap(m.api.eventIds);
        var wp = mapId ? getWaypointForMapId(mapId, m.api.waypoints) : null;
        if (wp) wpOverride[m.id] = wp; else delete wpOverride[m.id];
      }
    }
  }

  // --------- Ítems de los drops (ícono y nombre en español) ----------
  var itemCache = new Map();
  async function batchItems(ids) {
    for (var i = 0; i < ids.length; i += 100) {
      try {
        var r = await fetch('https://api.guildwars2.com/v2/items?ids=' + ids.slice(i, i + 100).join(',') + '&lang=es', { headers: { 'Accept': 'application/json' } });
        if (!r.ok) continue;
        var arr = await r.json();
        (arr || []).forEach(function (it) { if (it && it.id != null) itemCache.set(it.id, it); });
      } catch (_) {}
    }
  }
  var INFUSION_WHITELIST = new Set([
    'echo of the dragonvoid', 'winter\'s heart infusion', 'frost legion infusion', 'queen bee infusion',
    'liquid aurillium infusion', 'chak infusion', 'festive confetti infusion', 'crystal infusion',
    'infusión de corazón del invierno', 'infusión de la legión de escarcha', 'infusión de la reina abeja',
    'infusión de aurilio líquido', 'infusión chak', 'infusión festiva de confeti', 'infusión de cristal'
  ]);
  function isInfusionMeta(meta) {
    var it = meta.highlightItemId ? itemCache.get(meta.highlightItemId) : null;
    if (it) {
      if (it.details && Array.isArray(it.details.infusion_upgrade_flags) && it.details.infusion_upgrade_flags.indexOf('Infusion') >= 0) return true;
      if (it.type === 'UpgradeComponent') return true;
    }
    var n = Array.isArray(meta._extItems) && meta._extItems.length ? String(meta._extItems[0].itemName || '').toLowerCase() : '';
    return n.indexOf('infusión') >= 0 || n.indexOf('infusion') >= 0 || INFUSION_WHITELIST.has(n);
  }

  // ── DIBUJO ──
  function iconTag(url, size, cls) {
    var u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(u) + '" width="' + size + '" height="' + size + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }
  function expIcon(meta, size) {
    var k = expKeyOf(meta), f = EXP_ICON[k];
    if (f) return '<img class="mt-exi" src="' + ICON + 'expansions/' + esc(f) + '" width="' + size + '" height="' + size + '" alt="" loading="lazy">';
    return '<span class="mt-exi mt-exi--txt" aria-hidden="true">' + esc(String(meta.expansion || '?').charAt(0)) + '</span>';
  }
  function tint(meta) { return EXP_TINT[expKeyOf(meta)] || 'var(--tx-3)'; }
  function inText(mins) {
    if (mins == null) return '';
    var h = Math.floor(mins / 60), m = mins % 60;
    return h ? h + ' h' + (m ? ' ' + pad2(m) + ' min' : '') : m + ' min';
  }

  function stateChip(inst) {
    if (inst.state === 'active') return '<span class="mt-st mt-st--on"><i aria-hidden="true">●</i>En curso · termina en ' + inText(inst.mins) + '</span>';
    if (inst.state === 'soon') return '<span class="mt-st mt-st--soon"><i aria-hidden="true">◐</i>Empieza ' + hhmm(inst.start) + ' · en ' + inText(inst.mins) + '</span>';
    if (inst.state === 'later') return '<span class="mt-st"><i aria-hidden="true">○</i>Próxima ' + hhmm(inst.start) + ' · en ' + inText(inst.mins) + '</span>';
    return '<span class="mt-st"><i aria-hidden="true">○</i>Sin horario fijo</span>';
  }
  function doneChip(done) {
    if (done === true) return '<span class="mt-dn mt-dn--ok" title="La API dice que hoy ya la hiciste">✓ Hecho hoy</span>';
    if (done === false) return '<span class="mt-dn" title="La API dice que hoy todavía no la hiciste">Pendiente hoy</span>';
    return '';
  }

  // Drop destacado, con la vista previa de la infusión (mouse, teclado o toque).
  function dropHTML(meta) {
    if (!hasDrop(meta)) return '';
    var ext = Array.isArray(meta._extItems) ? meta._extItems[0] : null;
    var item = meta.highlightItemId ? itemCache.get(meta.highlightItemId) : null;
    var extName = ext && ext.itemName && ext.itemName !== '—' ? ext.itemName : '';
    var name = (item && item.name) || extName || (meta.highlightItemId ? 'cargando…' : '—');
    var inf = isInfusionMeta(meta);
    var pv = previewOf(ext);
    var tip = (meta._extItems || []).filter(function (x) { return x && x.itemName && x.itemName !== '—'; })
      .map(function (x) { return x.itemName + (x.wiki ? ' — ' + x.wiki : ''); }).join('\n') || name;
    var attrs = pv.state === 'none' ? '' : ' data-preview="' + esc(pv.url) + '" data-pv="' + pv.state + '" tabindex="0" role="button" aria-label="' +
      (pv.state === 'ok' ? 'Ver vista previa de ' : 'Sin vista previa de ') + esc(name) + '"';
    return '<div class="mt-drop' + (pv.state === 'ok' ? ' mt-drop--prev' : pv.state === 'missing' ? ' mt-drop--nopv' : '') + '"' + attrs + ' title="' + esc(tip) + '">' +
      '<span class="mt-dtag mt-dtag--' + (inf ? 'inf' : 'drop') + '">' + (inf ? 'Infusión' : 'Drop') + '</span>' +
      (item && item.icon ? iconTag(item.icon, 24, 'mt-dico') : '') +
      '<span class="mt-dname">' + esc(name) + '</span>' + hintHTML(pv.state) + '</div>';
  }
  function hintHTML(state) {
    if (state === 'ok') return '<span class="mt-dhint">Vista previa</span>';
    if (state === 'missing') return '<span class="mt-dhint mt-dhint--none">Sin vista previa</span>';
    return '';
  }

  // Vista previa: 'ok', 'missing' (falta o no cargó, DEC-031) o 'none'.
  var badPreviews = new Set();
  function previewOf(ext) {
    var url = ext && ext.preview ? String(ext.preview) : '';
    if (ext && ext.previewMissing) return { state: 'missing', url: '' };
    if (!url) return { state: 'none', url: '' };
    return badPreviews.has(url) ? { state: 'missing', url: '' } : { state: 'ok', url: url };
  }

  function actionsHTML(meta, labeled) {
    var wp = wpOverride[meta.id] || meta.chat || '';
    var wiki = meta.wiki ? String(meta.wiki).replace('wiki.guildwars2.com', 'wiki-es.guildwars2.com') : '';
    var map = meta.map ? 'https://maps.gw2.io/#/?q=' + encodeURIComponent(meta.map) : '';
    function lbl(t) { return labeled ? '<span>' + t + '</span>' : '<span class="mt-sr">' + t + '</span>'; }
    var cls = 'mt-act' + (labeled ? '' : ' mt-act--ic');
    return '<div class="mt-acts">' +
      (wp ? '<button type="button" class="' + cls + '" data-mt-act="copy" data-copy="' + esc(wp) + '" title="Copiar waypoint ' + esc(wp) + '"><img src="' + ICON + '733330.png" alt="">' + lbl('Copiar waypoint') + '</button>' : '') +
      (map ? '<a class="' + cls + '" href="' + map + '" target="_blank" rel="noopener" title="Mapa: ' + esc(meta.map) + '"><img src="' + ICON + '1770688.png" alt="">' + lbl('Mapa') + '</a>' : '') +
      (wiki ? '<a class="' + cls + '" href="' + esc(wiki) + '" target="_blank" rel="noopener" title="Wiki"><img src="' + ICON + '1602819.png" alt="">' + lbl('Wiki') + '</a>' : '') +
      '<button type="button" class="' + cls + '" data-mt-act="share" title="Copiar para compartir"><img src="' + ICON + '3380750.png" alt="">' + lbl('Compartir') + '</button>' +
      '</div>';
  }

  function detailsHTML(r) {
    var m = r.meta, now = new Date();
    var all = startsWithin(m, now, 24);
    return '<div class="mt-more">' +
      (all.length ? '<div class="mt-lbl">Horarios de las próximas 24 h <small>(tu hora)</small></div><div class="mt-ws">' +
        all.map(function (d, i) { return '<span class="mt-w' + (i === 0 && r.inst.state !== 'active' ? ' mt-w--next' : '') + '">' + hhmm(d) + '</span>'; }).join('') + '</div>'
        : '<div class="mt-lbl">Sin horario fijo</div><div>Depende de los jugadores del mapa.</div>') +
      '<div class="mt-lbl">Dura</div><div>' + (m.durationMin || 15) + ' min · waypoint <code>' + esc(wpOverride[m.id] || m.chat || '—') + '</code></div>' +
      (isTracked(m) ? '' : '<div class="mt-lbl">Hecho hoy</div><div>La API de GW2 no informa esta meta: no la marco ni como hecha ni como pendiente.</div>') +
      '</div>';
  }

  // where: 'now' (tarjeta grande de «Ahora»), 'pin' o 'grid'.
  function cardHTML(r, where) {
    var m = r.meta, i = r.inst, big = where === 'now', open = !big && openIds.has(m.id);
    var bar = '';
    if (big && i.state === 'active') {
      var dur = (m.durationMin || 15), pct = Math.max(0, Math.min(100, Math.round(100 * (dur - i.mins) / dur)));
      bar = '<div class="mt-bar" role="progressbar" aria-label="Avance de la meta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
    }
    var head = big
      ? '<div class="mt-big"><b>' + i.mins + '</b><small>min</small><span>' + (i.state === 'active' ? 'para que termine' : 'empieza a las ' + hhmm(i.start)) + '</span></div>'
      : '';
    return '<article class="mt-card mt-card--' + i.state + (r.done === true ? ' mt-card--done' : '') + (big ? ' mt-card--big' : '') + (open ? ' mt-card--open' : '') + '"' +
      (where === 'grid' ? ' id="mt-card-' + esc(m.id) + '"' : '') + ' data-id="' + esc(m.id) + '" data-where="' + where + '" style="--mt-x:' + tint(m) + '">' +
      '<div class="mt-top">' + expIcon(m, big ? 48 : 40) +
        '<div class="mt-id"><h4>' + esc(m.name) + '</h4><div class="mt-sub">' + esc(m.map || '') + ' · ' + esc(typeOne(m.type)) + (big ? ' · ' + esc(expName(m.expansion)) : '') + '</div></div>' +
        head +
        '<button type="button" class="mt-pin' + (r.pin ? ' is-on' : '') + '" data-mt-act="pin" aria-pressed="' + r.pin + '" title="' + (r.pin ? 'Quitar de Fijadas' : 'Fijar') + '" aria-label="' + (r.pin ? 'Quitar de Fijadas: ' : 'Fijar: ') + esc(m.name) + '">★</button>' +
      '</div>' + bar +
      '<div class="mt-sts">' + stateChip(i) + doneChip(r.done) + '</div>' +
      dropHTML(m) +
      (!big && i.upcoming.length ? '<div class="mt-next"><span>Próximas:</span> ' + i.upcoming.map(hhmm).join(' · ') + '</div>' : '') +
      (open ? detailsHTML(r) : '') +
      '<div class="mt-foot">' + actionsHTML(m, big) +
        (big ? '' : '<button type="button" class="mt-tog" data-mt-act="more" aria-expanded="' + open + '">' + (open ? 'Menos ▴' : 'Horarios y detalle ▾') + '</button>') +
      '</div></article>';
  }

  function computeRows(now) {
    return seed.map(function (m) {
      return { meta: m, inst: instanceAt(m, now), pin: favs.indexOf(m.id) >= 0, done: doneOf(m, flags) };
    });
  }

  function renderNow(now) {
    var box = $('#mtNow', root); if (!box) return;
    var list = rows.filter(function (r) { return r.inst.state === 'active' || r.inst.state === 'soon'; }).sort(byTime);
    if (list.length) { box.innerHTML = list.map(function (r) { return cardHTML(r, 'now'); }).join(''); return; }
    var next = rows.filter(function (r) { return r.inst.state === 'later'; }).sort(byTime)[0];
    box.innerHTML = '<p class="mt-empty">Nada en curso ahora.' + (next ? ' Lo próximo: <button type="button" class="mt-link" data-mt-go="' + esc(next.meta.id) + '">' +
      esc(next.meta.name) + '</button> a las ' + hhmm(next.inst.start) + ' (en ' + inText(next.inst.mins) + ').' : '') + '</p>';
  }

  function renderAgenda(now) {
    var box = $('#mtAgenda', root); if (!box) return;
    var byId = {}; rows.forEach(function (r) { byId[r.meta.id] = r; });
    var groups = agendaOf(seed, now, AGENDA_H);
    if (!groups.length) { box.innerHTML = '<p class="mt-empty">No hay metas con horario en las próximas ' + AGENDA_H + ' horas.</p>'; return; }
    box.innerHTML = groups.map(function (g) {
      return '<div class="mt-ag"><h4>' + g.label + '<span>' + g.count + (g.count === 1 ? ' meta' : ' metas') + '</span></h4><ol>' +
        g.slots.map(function (s) {
          return '<li><time>' + hhmm(s.at) + '</time><span class="mt-agns">' + s.ids.map(function (id) {
            var r = byId[id];
            return '<button type="button" class="mt-agn" data-mt-go="' + esc(id) + '" style="--mt-x:' + tint(r.meta) + '" title="Ir a ' + esc(r.meta.name) + '">' + esc(r.meta.name) +
              (r.done === true ? '<b class="mt-ag-ok" aria-label="hecho hoy"> ✓</b>' : '') + (r.pin ? '<b class="mt-ag-pin" aria-label="fijada"> ★</b>' : '') + '</button>';
          }).join('') + '</span></li>';
        }).join('') + '</ol></div>';
    }).join('');
  }

  function renderPins() {
    var box = $('#mtPins', root); if (!box) return;
    var byId = {}; rows.forEach(function (r) { byId[r.meta.id] = r; });
    var list = favs.map(function (id) { return byId[id]; }).filter(Boolean).slice(0, MAX_PINS);
    var cnt = $('#mtPinsN', root); if (cnt) cnt.textContent = list.length + ' de ' + MAX_PINS;
    box.innerHTML = list.length ? list.map(function (r) { return cardHTML(r, 'pin'); }).join('')
      : '<p class="mt-empty">Tocá ★ en una meta para tenerla siempre a mano.</p>';
  }

  function renderFilters() {
    var t = $('#mtTypes', root), x = $('#mtExps', root);
    function chip(attr, v, label, n, on, color) {
      return '<button type="button" class="mt-ch' + (on ? ' is-on' : '') + (color ? ' mt-ch--x' : '') + '" ' + attr + '="' + esc(v) + '" aria-pressed="' + on + '"' +
        (color ? ' style="--mt-x:' + color + '"' : '') + '>' + esc(label) + '<span>' + n + '</span></button>';
    }
    if (t) t.innerHTML = chip('data-mt-type', '', 'Todos los tipos', seed.length, !filters.type) +
      typeCounts(seed).map(function (o) { return chip('data-mt-type', o.value, o.label, o.n, filters.type === o.value); }).join('');
    if (x) x.innerHTML = chip('data-mt-exp', '', 'Todas las expansiones', seed.length, !filters.exp) +
      expCounts(seed).map(function (o) { return chip('data-mt-exp', o.value, o.label, o.n, filters.exp === o.value, EXP_TINT[expKeyOf({ expansion: o.value })]); }).join('');
    $$('[data-mt-when]', root).forEach(function (b) {
      var on = b.getAttribute('data-mt-when') === filters.when;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
      if (b.getAttribute('data-mt-when') === 'pending') {
        var ok = flags.state === 'ok';
        b.disabled = !ok;
        b.title = ok ? 'Las que la API sigue y todavía no hiciste hoy' : 'Necesita una cuenta con permiso progression';
      }
    });
    $$('[data-mt-sw]', root).forEach(function (b) {
      var on = !!filters[b.getAttribute('data-mt-sw')];
      b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on));
    });
  }

  function renderCatalog() {
    var box = $('#mtAll', root); if (!box) return;
    var list = rows.filter(function (r) { return matches(r, filters); });
    var cnt = $('#mtCount', root);
    if (cnt) cnt.textContent = list.length === rows.length ? rows.length + ' metas' : 'Mostrando ' + list.length + ' de ' + rows.length;
    if (!list.length) {
      box.innerHTML = '<div class="mt-empty">Ninguna meta coincide con lo que elegiste. <button type="button" class="mt-link" data-mt-act="reset">Ver todas</button></div>';
      return;
    }
    box.innerHTML = groupByExp(list).map(function (g) {
      var head = g.exp
        ? '<img src="' + ICON + 'expansions/' + esc(EXP_ICON[expKeyOf({ expansion: g.exp })] || 'core.png') + '" alt="" width="22" height="22">'
        : '';
      return '<section class="mt-grp"><div class="mt-grph" style="--mt-x:' + (g.exp ? tint({ expansion: g.exp }) : 'var(--bd-2)') + '">' + head +
        '<h4>' + esc(g.label) + '</h4><span class="mt-cnt">' + g.rows.length + '</span><span class="mt-line"></span></div>' +
        (g.exp ? '' : '<p class="mt-hint">Los templos de Orr dependen de los jugadores del mapa: no tienen hora.</p>') +
        '<div class="mt-grid">' + g.rows.map(function (r) { return cardHTML(r, 'grid'); }).join('') + '</div></section>';
    }).join('');
  }

  function renderFlags() {
    var box = $('#mtFlags', root); if (!box) return;
    var tracked = seed.filter(isTracked), n = tracked.length;
    var html;
    if (flags.state === 'ok') {
      var done = tracked.filter(function (m) { return doneOf(m, flags) === true; }).length;
      html = '<b>Hoy en tu cuenta: ' + done + ' de ' + n + '</b> <span>que la API puede seguir · leído ' + esc(flags.lastHuman) + '</span>';
    } else if (flags.state === 'loading') html = '<span>Leyendo lo que hiciste hoy…</span>';
    else if (flags.state === 'noperm') html = '<span>Tu API Key no tiene el permiso <code>progression</code>: no puedo saber qué hiciste hoy. Los horarios funcionan igual.</span>';
    else if (flags.state === 'error') html = '<span>No se pudo leer qué hiciste hoy.</span>';
    else html = '<span>Elegí una cuenta para ver qué hiciste hoy. Los horarios funcionan igual.</span>';
    box.innerHTML = html + (flags.state === 'none' || flags.state === 'loading' ? '' :
      '<button type="button" class="mt-act" data-mt-act="flags">↻ ' + (flags.state === 'error' ? 'Reintentar' : 'Actualizar') + '</button>');
  }

  function renderMiniNext() {
    if (!el.miniNext) return;
    var next = rows.filter(function (r) { return r.inst.state === 'active' || r.inst.state === 'soon'; }).sort(byTime).slice(0, 3);
    el.miniNext.innerHTML = next.length
      ? next.map(function (r) { return '<div class="mini-next-item">• <strong>' + esc(r.meta.name) + '</strong> ' + (r.inst.state === 'active' ? '— En curso' : '— Empieza ' + hhmm(r.inst.start)) + '</div>'; }).join('')
      : '<div class="mini-next-item muted">Sin eventos próximos</div>';
  }

  // Redibuja todo sin perder el foco del teclado (el tick corre cada 30 s).
  function renderAll() {
    if (!root || !seed.length) return;
    var now = new Date();
    var a = document.activeElement, keep = null;
    if (a && a.closest && root.contains && root.contains(a)) {
      var card = a.closest('.mt-card');
      keep = { id: card ? card.getAttribute('data-id') : null, where: card ? card.getAttribute('data-where') : null,
        act: a.getAttribute('data-mt-act') || a.getAttribute('data-mt-go') || (a.hasAttribute('data-preview') ? 'preview' : null) };
    }
    var pc = popFor && popFor.closest ? popFor.closest('.mt-card') : null;
    var popAt = pc ? '.mt-card[data-id="' + pc.getAttribute('data-id') + '"][data-where="' + pc.getAttribute('data-where') + '"] [data-preview]' : null;
    rows = computeRows(now);
    renderFlags(); renderNow(now); renderAgenda(now); renderPins(); renderFilters(); renderCatalog(); renderMiniNext();
    // La vista previa abierta sigue a su tarjeta nueva (o se cierra).
    if (pop) { var np = popAt ? $(popAt, root) : null; if (np) popFor = np; else hidePreview(true); }
    if (keep && keep.id && keep.act) {
      var sel = '.mt-card[data-id="' + keep.id + '"][data-where="' + keep.where + '"] ' +
        (keep.act === 'preview' ? '[data-preview]' : '[data-mt-act="' + keep.act + '"]');
      try { var back = $(sel, root); if (back && back.focus) back.focus(); } catch (_) {}
    }
    try { document.dispatchEvent(new CustomEvent('gn:meta-rendered', { detail: { version: VERSION } })); } catch (_) {}
  }

  function renderSkeleton() {
    var box = $('#mtAll', root); if (!box) return;
    box.innerHTML = '<div class="skel-grid">' + Array.from({ length: 6 }).map(function () {
      return '<article class="skel-card skel-anim"><div class="skel-row w70"></div><div class="skel-row w30"></div><div class="skel-row"></div></article>';
    }).join('') + '</div>';
  }

  // ── INTERACCIÓN (un solo oyente por tipo, sobre la raíz) ──
  function copy(text, okMsg) {
    var done = function () { setStatus(okMsg, 'ok'); notify('success', okMsg, 1500); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { setStatus('No se pudo copiar: ' + text, 'error'); });
      else setStatus('Copiá a mano: ' + text, 'info');
    } catch (_) { setStatus('Copiá a mano: ' + text, 'info'); }
  }
  function rowOf(id) { for (var i = 0; i < rows.length; i++) if (rows[i].meta.id === id) return rows[i]; return null; }

  function togglePin(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1);
    else {
      if (favs.length >= MAX_PINS) {
        var msg = 'Ya tenés ' + MAX_PINS + ' fijadas: quitá una para sumar otra.';
        setStatus(msg, 'error'); notify('warning', msg, 2400);
        return;
      }
      favs.push(id);
    }
    saveFavs(); renderAll();
  }

  function goTo(id) {
    var card = $('#mt-card-' + id, root);
    if (!card) {
      filters = { q: '', type: '', exp: '', when: 'all', hideDone: false, onlyDrop: false };
      var q = $('#mtQ', root); if (q) q.value = '';
      renderAll(); card = $('#mt-card-' + id, root);
    }
    if (!card) return;
    if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('mt-flash');
    card.setAttribute('tabindex', '-1');
    if (card.focus) card.focus();
    setTimeout(function () { card.classList.remove('mt-flash'); }, 1600);
  }

  // Vista previa de la infusión: mouse, foco o toque.
  var pop = null, popFor = null, hideT = null;
  function nameIn(target) { var n = target.querySelector && target.querySelector('.mt-dname'); return n ? n.textContent : ''; }
  // Sin imagen: estado limpio, nunca la imagen rota ni el alt suelto (DEC-031).
  function noPreviewHTML(name) {
    return '<div class="mt-pvx"><i class="mt-pvx-ic" aria-hidden="true">◇</i><div>' +
      '<b>Sin vista previa</b>' + (name ? '<span>' + esc(name) + '</span>' : '') +
      '<small>Todavía no tengo su animación.</small></div></div>';
  }
  // La que no cargó pasa a «Sin vista previa» sin redibujar todo.
  function markMissing(target, url) {
    if (url) badPreviews.add(url);
    $$('[data-preview]', root || document).forEach(function (b) {
      if (b !== target && b.getAttribute('data-preview') !== url) return;
      b.setAttribute('data-pv', 'missing');
      b.setAttribute('aria-label', 'Sin vista previa de ' + nameIn(b));
      b.classList.remove('mt-drop--prev'); b.classList.add('mt-drop--nopv');
      var h = b.querySelector('.mt-dhint');
      if (h) { h.textContent = 'Sin vista previa'; h.classList.add('mt-dhint--none'); }
    });
  }
  function showPreview(target, ev) {
    clearTimeout(hideT);
    var url = target.getAttribute('data-preview'); if (url == null) return;
    if (pop && popFor === target) { place(target, ev); return; }
    hidePreview(true);
    var name = nameIn(target);
    pop = document.createElement('div');
    pop.className = 'inf-prev on mt-pv';
    pop.setAttribute('role', 'tooltip');
    if (!url || target.getAttribute('data-pv') === 'missing' || badPreviews.has(url)) {
      pop.innerHTML = noPreviewHTML(name);
    } else {
      var box = pop, img = document.createElement('img');
      box.classList.add('is-loading');
      box.innerHTML = '<span class="mt-pv-load">Cargando vista previa…</span>';
      img.alt = '';
      img.onload = function () {
        box.classList.remove('is-loading');
        var l = box.querySelector('.mt-pv-load'); if (l && l.parentNode) l.parentNode.removeChild(l);
        img.alt = 'Vista previa: ' + name;
        if (pop === box) place(target, null);
      };
      img.onerror = function () {
        console.warn('[meta] vista previa no disponible:', url);
        markMissing(target, url);
        if (pop !== box) return;
        box.classList.remove('is-loading');
        box.innerHTML = noPreviewHTML(name);
        place(target, null);
      };
      img.src = url;
      box.appendChild(img);
    }
    document.body.appendChild(pop);
    popFor = target;
    place(target, ev);
  }
  function place(target, ev) {
    if (!pop) return;
    var x, y, h = pop.offsetHeight || 280;
    if (ev && ev.pageX != null && ev.type && ev.type.indexOf('mouse') === 0) { x = ev.pageX + 14; y = ev.pageY - h - 16; }
    else if (target.getBoundingClientRect) {
      var rc = target.getBoundingClientRect();
      x = rc.left + (window.scrollX || 0); y = rc.top + (window.scrollY || 0) - h - 10;
    } else { x = 0; y = 0; }
    pop.style.left = Math.max(8, x) + 'px';
    pop.style.top = Math.max(8, y) + 'px';
  }
  function hidePreview(now) {
    clearTimeout(hideT);
    var go = function () { if (pop && pop.parentNode) pop.parentNode.removeChild(pop); pop = null; popFor = null; };
    if (now) go(); else hideT = setTimeout(go, 90);
  }

  function onClick(e) {
    var t = e.target, b;
    if (!t || !t.closest) return;
    if ((b = t.closest('[data-preview]'))) { if (popFor === b) hidePreview(true); else showPreview(b, null); return; }
    if ((b = t.closest('[data-mt-go]'))) { goTo(b.getAttribute('data-mt-go')); return; }
    if ((b = t.closest('[data-mt-type]'))) { filters.type = b.getAttribute('data-mt-type'); renderFilters(); renderCatalog(); return; }
    if ((b = t.closest('[data-mt-exp]'))) { filters.exp = b.getAttribute('data-mt-exp'); renderFilters(); renderCatalog(); return; }
    if ((b = t.closest('[data-mt-when]'))) { if (!b.disabled) { filters.when = b.getAttribute('data-mt-when'); renderFilters(); renderCatalog(); } return; }
    if ((b = t.closest('[data-mt-sw]'))) { var k = b.getAttribute('data-mt-sw'); filters[k] = !filters[k]; renderFilters(); renderCatalog(); return; }
    if ((b = t.closest('[data-mt-act]'))) {
      var act = b.getAttribute('data-mt-act'), card = b.closest('.mt-card'), id = card && card.getAttribute('data-id');
      if (act === 'pin' && id) togglePin(id);
      else if (act === 'more' && id) { if (openIds.has(id)) openIds.delete(id); else openIds.add(id); renderAll(); }
      else if (act === 'copy') copy(b.getAttribute('data-copy') || '', 'Waypoint copiado: ' + (b.getAttribute('data-copy') || ''));
      else if (act === 'share' && id) {
        var r = rowOf(id); if (!r) return;
        var st = r.inst.state === 'active' ? 'en curso, termina en ' + inText(r.inst.mins)
          : (r.inst.start ? 'empieza a las ' + hhmm(r.inst.start) + ' (en ' + inText(r.inst.mins) + ')' : 'sin horario fijo');
        copy(r.meta.name + ' — ' + st + ' ' + (wpOverride[id] || r.meta.chat || ''), 'Copiado para compartir.');
      }
      else if (act === 'flags') window.Meta.refresh({ token: token(), nocache: true });
      else if (act === 'reset') {
        filters = { q: '', type: '', exp: '', when: 'all', hideDone: false, onlyDrop: false };
        var q = $('#mtQ', root); if (q) q.value = '';
        renderFilters(); renderCatalog();
      }
      return;
    }
    // Tocar la tarjeta (fuera de botones y enlaces) abre o cierra el detalle.
    var c = t.closest('.mt-card');
    if (c && c.getAttribute('data-where') !== 'now' && !t.closest('a') && !t.closest('button')) {
      var cid = c.getAttribute('data-id');
      if (openIds.has(cid)) openIds.delete(cid); else openIds.add(cid);
      renderAll();
    }
  }
  function onKey(e) {
    var t = e.target;
    if (e.key === 'Escape' && pop) { hidePreview(true); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t && t.hasAttribute && t.hasAttribute('data-preview')) {
      e.preventDefault(); if (popFor === t) hidePreview(true); else showPreview(t, null);
    }
  }
  function onOver(e) { var b = e.target && e.target.closest && e.target.closest('[data-preview]'); if (b) showPreview(b, e); }
  function onMove(e) { if (pop && popFor && e.target && e.target.closest && e.target.closest('[data-preview]') === popFor) place(popFor, e); }
  function onOut(e) {
    var b = e.target && e.target.closest && e.target.closest('[data-preview]');
    if (b && b === popFor && !(e.relatedTarget && b.contains && b.contains(e.relatedTarget))) hidePreview(false);
  }
  function onFocusOut(e) { if (popFor && e.target === popFor) hidePreview(false); }
  function onInput(e) {
    if (!e.target || e.target.id !== 'mtQ') return;
    filters.q = e.target.value || '';
    clearTimeout(qT); qT = setTimeout(renderCatalog, 120);
  }

  // ── ESTRUCTURA Y ESTILOS ──
  var CSS = [
'#metaPanel.mt-on .meta-filters,#metaPanel.mt-on .panel__body .hr-hairline,#metaPanel.mt-on #metaFavBlock,#metaPanel.mt-on #metaList{display:none}',
'.mt{display:grid;gap:4px;color:var(--tx-1)}',
'.mt-flags{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;background:var(--bg-1);border:1px solid var(--bd-1);border-radius:12px;padding:8px 12px;font-size:.85rem}',
'.mt-flags span{color:var(--tx-3)}.mt-flags .mt-act{margin-left:auto}',
'.mt-voice:empty{display:none}',
'.mt-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin:18px 0 10px}',
'.mt-h h3{margin:0;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-3)}',
'.mt-hint{font-size:.78rem;color:var(--tx-3);margin:0 0 8px}.mt-h .mt-hint{margin:0}',
'.mt-sec--all{margin-top:14px;padding-top:6px;border-top:1px solid var(--bd-1)}.mt-sec--all .mt-h h3{color:var(--tx-1);font-size:.88rem}',
'.mt-now{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}',
'.mt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}',
'.mt-empty{color:var(--tx-3);font-size:.88rem;margin:4px 0;padding:10px 12px;border:1px dashed var(--bd-1);border-radius:12px}',
'.mt-link{background:none;border:0;padding:0;color:var(--acc-1);font:inherit;text-decoration:underline;cursor:pointer}',
'.mt-card{position:relative;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:14px;padding:12px 12px 10px 15px;display:flex;flex-direction:column;gap:8px;min-width:0;transition:border-color .15s,transform .15s}',
'.mt-card::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--mt-x)}',
'.mt-card:hover{border-color:var(--bd-2)}.mt-card[data-where="grid"],.mt-card[data-where="pin"]{cursor:pointer}',
'.mt-card--active{border-color:var(--color-green)}.mt-card--soon{border-color:var(--color-amber)}',
'.mt-card--done{opacity:.75}.mt-card--big{padding:14px 16px 12px 18px;border-radius:16px}',
'.mt-flash{box-shadow:0 0 0 2px var(--acc-1)}',
'.mt-top{display:flex;align-items:center;gap:10px;min-width:0}',
'.mt-exi{width:40px;height:40px;border-radius:10px;object-fit:contain;flex-shrink:0;background:var(--bg-2);box-shadow:0 0 0 1px var(--mt-x)}',
'.mt-card--big .mt-exi{width:48px;height:48px}',
'.mt-exi--txt{display:grid;place-items:center;font-weight:800;color:var(--mt-x)}',
'.mt-id{flex:1;min-width:0}.mt-id h4{margin:0;font-size:.92rem;line-height:1.25;overflow-wrap:anywhere}.mt-card--big .mt-id h4{font-size:1.02rem}',
'.mt-sub{font-size:.75rem;color:var(--tx-3)}',
'.mt-big{text-align:right;flex-shrink:0}.mt-big b{font-size:1.6rem;line-height:1;font-variant-numeric:tabular-nums}.mt-big small{font-size:.75rem;color:var(--tx-3);margin-left:3px}.mt-big span{display:block;font-size:.72rem;color:var(--tx-3)}',
'.mt-pin{background:none;border:0;color:var(--tx-3);font-size:1.1rem;line-height:1;cursor:pointer;padding:6px;border-radius:8px;align-self:flex-start}.mt-pin:hover{color:var(--tx-1);background:var(--bg-2)}.mt-pin.is-on{color:var(--gn-gold)}',
'.mt-bar{height:6px;border-radius:999px;background:var(--bg-2);overflow:hidden}.mt-bar i{display:block;height:100%;background:var(--color-green);border-radius:inherit}',
'.mt-sts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
'.mt-st{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;color:var(--tx-2);background:var(--bg-1);border:1px solid var(--bd-1);border-radius:999px;padding:3px 10px;font-variant-numeric:tabular-nums}',
'.mt-st i{font-style:normal;font-size:.7rem;color:var(--tx-3)}',
'.mt-st--on{border-color:var(--color-green);background:var(--color-green-bg)}.mt-st--on i{color:var(--color-green)}',
'.mt-st--soon{border-color:var(--color-amber);background:var(--color-amber-bg)}.mt-st--soon i{color:var(--color-amber)}',
'.mt-dn{font-size:.74rem;border:1px dashed var(--bd-2);border-radius:999px;padding:3px 9px;color:var(--tx-2)}',
'.mt-dn--ok{border-style:solid;border-color:var(--color-green);color:var(--color-green)}',
'.mt-drop{display:flex;align-items:center;gap:8px;min-width:0;background:var(--bg-1);border:1px solid var(--bd-1);border-radius:10px;padding:5px 8px}',
'.mt-drop--prev{cursor:zoom-in}.mt-drop--prev:hover,.mt-drop--prev:focus-visible{border-color:var(--gn-gold)}',
'.mt-dtag{font-size:.68rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;border-radius:999px;padding:2px 7px;flex-shrink:0;border:1px solid var(--bd-2);color:var(--tx-2)}',
'.mt-dtag--inf{border-color:var(--gn-gold);color:var(--gn-gold)}',
'.mt-dico{width:24px;height:24px;border-radius:5px;flex-shrink:0}',
'.mt-dname{flex:1;min-width:0;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.mt-dhint{font-size:.7rem;color:var(--tx-3);flex-shrink:0}',
'.mt-drop--nopv{cursor:help}.mt-dhint--none{border:1px dashed var(--bd-2);border-radius:999px;padding:1px 7px}',
'.mt-pv.is-loading img{position:absolute;opacity:0;width:1px;height:1px}',
'.mt-pv-load{display:block;padding:18px 22px;font-size:.8rem;color:var(--tx-3)}',
'.mt-pvx{display:flex;align-items:center;gap:12px;max-width:300px;padding:8px 10px 8px 6px}',
'.mt-pvx-ic{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;border:1px dashed var(--bd-2);background:var(--bg-2);color:var(--gn-gold);font-size:1.2rem;font-style:normal}',
'.mt-pvx b{display:block;font-size:.85rem;color:var(--tx-1)}.mt-pvx span{display:block;font-size:.8rem;color:var(--tx-2);overflow-wrap:anywhere}',
'.mt-pvx small{display:block;margin-top:4px;font-size:.74rem;color:var(--tx-3)}',
'.mt-next{font-size:.78rem;color:var(--tx-2);font-variant-numeric:tabular-nums}.mt-next span{color:var(--tx-3)}',
'.mt-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
'.mt-acts{display:flex;flex-wrap:wrap;gap:6px}',
'.mt-act{display:inline-flex;align-items:center;gap:6px;background:var(--bg-1);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:10px;padding:5px 10px;font:inherit;font-size:.78rem;cursor:pointer;text-decoration:none}',
'.mt-act img{width:20px;height:20px}.mt-act:hover{border-color:var(--acc-1);color:var(--tx-1)}',
'.mt-act--ic{padding:4px}.mt-act--ic img{width:24px;height:24px}',
'.mt-tog{margin-left:auto;background:none;border:0;color:var(--tx-3);font:inherit;font-size:.76rem;cursor:pointer;padding:4px 6px;border-radius:8px}.mt-tog:hover{color:var(--tx-1)}',
'.mt-more{display:grid;gap:4px;font-size:.8rem;color:var(--tx-2);border-top:1px solid var(--bd-1);padding-top:8px}',
'.mt-lbl{font-size:.7rem;color:var(--tx-3);text-transform:uppercase;letter-spacing:.05em;margin-top:4px}',
'.mt-ws{display:flex;flex-wrap:wrap;gap:4px}.mt-w{font-size:.75rem;border:1px solid var(--bd-1);border-radius:8px;padding:1px 6px;font-variant-numeric:tabular-nums}.mt-w--next{border-color:var(--color-amber);color:var(--color-amber)}',
'.mt-agenda{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}',
'.mt-ag{background:var(--bg-0);border:1px solid var(--bd-1);border-radius:14px;padding:10px 12px}',
'.mt-ag h4{margin:0 0 6px;font-size:.88rem;display:flex;justify-content:space-between;align-items:baseline}.mt-ag h4 span{font-size:.72rem;color:var(--tx-3);font-weight:500}',
'.mt-ag ol{list-style:none;margin:0;padding:0}',
'.mt-ag li{display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-top:1px solid var(--bd-1)}.mt-ag li:first-child{border-top:0}',
'.mt-ag time{width:42px;flex-shrink:0;font-weight:700;font-size:.8rem;font-variant-numeric:tabular-nums;padding-top:3px}',
'.mt-agns{display:flex;flex-wrap:wrap;gap:4px;min-width:0}',
'.mt-agn{display:inline-flex;align-items:center;gap:5px;max-width:100%;background:var(--bg-1);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:999px;padding:2px 9px 2px 7px;font:inherit;font-size:.76rem;cursor:pointer;text-align:left}',
'.mt-agn::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--mt-x);flex-shrink:0}.mt-agn:hover{border-color:var(--acc-1);color:var(--tx-1)}',
'.mt-ag-ok{color:var(--color-green);font-weight:700}.mt-ag-pin{color:var(--gn-gold)}',
'.mt-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px}',
'.mt-search{flex:1 1 260px;display:flex;align-items:center;gap:8px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:10px;padding:7px 12px}',
'.mt-search:focus-within{border-color:var(--acc-1)}.mt-search input{background:none;border:0;outline:none;color:var(--tx-1);font:inherit;width:100%;padding:0}',
'.mt-seg{display:inline-flex;border:1px solid var(--bd-1);border-radius:10px;overflow:hidden}',
'.mt-seg button{background:var(--bg-0);border:0;color:var(--tx-3);padding:7px 11px;font:inherit;font-size:.8rem;cursor:pointer}',
'.mt-seg button.is-on{background:var(--bg-2);color:var(--tx-1);box-shadow:inset 0 -2px 0 var(--acc-1)}.mt-seg button:disabled{opacity:.5;cursor:not-allowed}',
'.mt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}',
'.mt-ch{background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:999px;padding:5px 11px;font:inherit;font-size:.8rem;cursor:pointer;white-space:nowrap}',
'.mt-ch span{color:var(--tx-3);margin-left:6px;font-size:.72rem}.mt-ch.is-on{background:var(--color-blue-bg);border-color:var(--acc-1);color:var(--tx-1)}',
'.mt-ch--x{box-shadow:inset 3px 0 0 var(--mt-x)}',
'.mt-sw{display:inline-flex;align-items:center;gap:8px;background:none;border:0;color:var(--tx-2);font:inherit;font-size:.82rem;cursor:pointer;padding:4px}',
'.mt-sw i{width:34px;height:20px;border-radius:999px;background:var(--bd-2);position:relative;display:inline-block}',
'.mt-sw i::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}',
'.mt-sw.is-on i{background:var(--acc-1)}.mt-sw.is-on i::after{left:17px}',
'.mt-count{font-size:.78rem;color:var(--tx-3);margin:4px 0}',
'.mt-grp{margin-top:14px}.mt-grph{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
'.mt-grph img{border-radius:6px;box-shadow:0 0 0 1px var(--mt-x)}.mt-grph h4{margin:0;font-size:.95rem}',
'.mt-cnt{font-size:.75rem;color:var(--tx-3)}.mt-line{flex:1;height:1px;background:var(--bd-1)}',
'.mt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
'.mt button:focus-visible,.mt a:focus-visible,.mt input:focus-visible,.mt [data-preview]:focus-visible,.mt-card:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
'@media (max-width:720px){.mt-now,.mt-grid,.mt-agenda{grid-template-columns:1fr}.mt-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.mt-act,.mt-pin,.mt-agn,.mt-ch,.mt-seg button{min-height:40px}.mt-flags .mt-act{margin-left:0}}',
'@media (prefers-reduced-motion:reduce){.mt-card,.mt-sw i::after{transition:none}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('mt-style')) return;
    var s = document.createElement('style'); s.id = 'mt-style'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function shellHTML() {
    function when(v, label) { return '<button type="button" data-mt-when="' + v + '" aria-pressed="false">' + label + '</button>'; }
    function sw(k, label) { return '<button type="button" class="mt-sw" role="switch" data-mt-sw="' + k + '" aria-checked="false"><i aria-hidden="true"></i>' + label + '</button>'; }
    return '<div id="mtFlags" class="mt-flags" aria-live="polite"></div>' +
      '<div id="mtVoice" class="mt-voice"></div>' +
      '<section class="mt-sec" aria-labelledby="mtNowT"><div class="mt-h"><h3 id="mtNowT">Ahora</h3><span class="mt-hint">En curso y lo que empieza en los próximos ' + SOON_MIN + ' minutos</span></div><div id="mtNow" class="mt-now"></div></section>' +
      '<section class="mt-sec" aria-labelledby="mtAgT"><div class="mt-h"><h3 id="mtAgT">Próximas ' + AGENDA_H + ' horas</h3><span class="mt-hint">Tu hora local · ✓ hecho hoy · ★ fijada · tocá una para ir a su tarjeta</span></div><div id="mtAgenda" class="mt-agenda"></div></section>' +
      '<section class="mt-sec" aria-labelledby="mtPinT"><div class="mt-h"><h3 id="mtPinT">Fijadas</h3><span id="mtPinsN" class="mt-hint"></span></div><div id="mtPins" class="mt-grid"></div></section>' +
      '<section class="mt-sec mt-sec--all" aria-labelledby="mtAllT"><div class="mt-h"><h3 id="mtAllT">Todas las metas</h3><span class="mt-hint">Por expansión, en orden de salida; dentro de cada una, lo más cercano primero</span></div>' +
        '<div class="mt-tools"><label class="mt-search"><span aria-hidden="true">🔍</span><input id="mtQ" type="search" placeholder="Buscar meta, jefe o mapa…" aria-label="Buscar meta, jefe o mapa" autocomplete="off"></label>' +
        '<div class="mt-seg" role="group" aria-label="Mostrar">' + when('all', 'Todas') + when('hour', 'Próxima hora') + when('pending', 'Pendientes hoy') + '</div></div>' +
        '<div id="mtTypes" class="mt-chips" role="group" aria-label="Tipo"></div>' +
        '<div id="mtExps" class="mt-chips" role="group" aria-label="Expansión"></div>' +
        '<div class="mt-tools">' + sw('hideDone', 'Ocultar las hechas hoy') + sw('onlyDrop', 'Solo con infusión o drop') + '</div>' +
        '<div id="mtCount" class="mt-count" aria-live="polite"></div><div id="mtAll"></div>' +
      '</section>';
  }

  function ensureShell() {
    if (root) return root;
    if (!el.panel) return null;
    var body = $('.panel__body', el.panel) || el.panel;
    injectCSS();
    el.panel.classList.add('mt-on');
    root = document.createElement('div');
    root.id = 'mtRoot';
    root.className = 'mt';
    root.innerHTML = shellHTML();
    body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    root.addEventListener('input', onInput);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseout', onOut);
    root.addEventListener('focusout', onFocusOut);
    if (document.body && document.body.removeAttribute) document.body.removeAttribute('data-meta-compact');
    return root;
  }

  // ── CICLO DE VIDA ──
  function visible() { return !!(el.panel && !el.panel.hasAttribute('hidden') && !document.hidden); }
  function tick() { if (visible()) renderAll(); }
  function scheduleMidnight() {
    clearTimeout(midnightT);
    var delta = +nextResetUTC() - Date.now();
    if (delta > 0 && delta < 36 * 3600000) {
      midnightT = setTimeout(async function () {
        await window.Meta.refresh({ token: token(), nocache: true });
        scheduleMidnight();
      }, delta + 1200);
    }
  }

  async function loadItems() {
    var ids = seed.map(function (m) { return m.highlightItemId; }).filter(function (id, i, a) { return id && a.indexOf(id) === i && !itemCache.has(id); });
    if (ids.length) { await batchItems(ids); renderAll(); }
  }

  async function initOnce() {
    if (!ensureShell()) return;
    try {
      setStatus('Cargando Metas y Eventos…');
      renderSkeleton();
      loadFavs();
      await loadSeed();
      window._metaSeed = seed;
      renderAll();
      await refreshAccountFlags({ token: token() });
      await refreshLeyLines();
      renderAll();
      setStatus('Listo.', 'ok');
      loadItems();
      clearInterval(tickT); tickT = setInterval(tick, TICK_MS);
      scheduleMidnight();
    } catch (e) {
      console.error(e);
      setStatus('No se pudo cargar Metas y Eventos.', 'error');
      notify('error', 'No se pudo cargar Metas y Eventos', 2400);
    }
  }

  // ── API PÚBLICA ──
  window.Meta = window.Meta || {};
  window.Meta.version = VERSION;
  window.Meta._expansionOptions = expansionOptions;
  window.Meta.refresh = async function metaRefresh(opts) {
    opts = opts || {};
    try {
      await refreshAccountFlags({ token: opts.token != null ? opts.token : token() });
      renderAll();
      if (flags.state === 'ok') setStatus('Listo.', 'ok');
      else if (flags.state === 'error') setStatus('No se pudo leer qué hiciste hoy.', 'error');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.warn('[Meta.refresh] error', e);
    }
  };
  // Estado para la cabecera y mis mensajes (MET-2): datos, sin HTML.
  window.Meta.snapshot = function () {
    var now = new Date();
    return {
      now: now,
      resetAt: nextResetUTC(now),
      flags: { state: flags.state, lastHuman: flags.lastHuman },
      pins: favs.slice(),
      rows: rows.map(function (r) {
        return { id: r.meta.id, name: r.meta.name, type: r.meta.type, expansion: r.meta.expansion, chat: wpOverride[r.meta.id] || r.meta.chat,
          state: r.inst.state, mins: r.inst.mins, start: r.inst.start, end: r.inst.end, tracked: isTracked(r.meta), done: r.done, pinned: r.pin };
      })
    };
  };
  window.Meta._pure = {
    instanceAt: instanceAt, startsWithin: startsWithin, agendaOf: agendaOf, matches: matches, typeCounts: typeCounts,
    expCounts: expCounts, groupByExp: groupByExp, isTracked: isTracked, doneOf: doneOf, hasDrop: hasDrop, fold: fold,
    nextResetUTC: nextResetUTC, typeOne: typeOne, expName: expName
  };
  window.Meta._view = { dropHTML: dropHTML, previewOf: previewOf, showPreview: showPreview, hidePreview: hidePreview, badPreviews: badPreviews };
  window.Meta._debug = function () { return { inited: inited, flags: flags.state, rows: rows.length, open: Array.from(openIds), filters: Object.assign({}, filters) }; };
  window._metaFlags = flags;

  // ---------- Eventos del shell ----------
  document.addEventListener('gn:tabchange', function (ev) {
    if (!ev || !ev.detail || ev.detail.view !== 'meta') return;
    if (!inited) { inited = true; initOnce(); } else renderAll();
  });
  document.addEventListener('visibilitychange', function () { if (inited) tick(); });

  if (el.refreshFlagsBtn) el.refreshFlagsBtn.addEventListener('click', function () { window.Meta.refresh({ token: token(), nocache: true }); });

  // Auto-refresh al cambiar de API Key (app.js emite gn:meta-refresh).
  (function () {
    var FLAG = '__gn_meta_autorefresh_wired__';
    if (window[FLAG]) return;
    window[FLAG] = true;
    document.addEventListener('gn:meta-refresh', function (ev) {
      try {
        var tok = (ev && ev.detail && ev.detail.token) || token();
        window.Meta.refresh({ token: tok, nocache: true });
      } catch (e) { console.warn('[Meta] auto-refresh error:', e); }
    });
  })();
})();
