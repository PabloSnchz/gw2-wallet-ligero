/* eslint-disable no-console */
(function(){
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

  console.info('%cMetaEventos meta.js v3.3.1 — Sin marcado manual (solo API)',
    'color:#7dd3fc; font-weight:700');

  // --------- Elementos del DOM ----------
  const el = {
    panel:      $('#metaPanel'),
    status:     $('#metaStatus'),
    localTime:  $('#metaLocalTime'),
    reset:      $('#metaReset'),
    type:       $('#metaType'),
    exp:        $('#metaExp'),
    onlyActive: $('#metaOnlyActive'),
    onlySoon:   $('#metaOnlySoon'),
    onlyInf:    $('#metaOnlyInfusions'),
    favBlock:   $('#metaFavBlock'),
    favGrid:    $('#metaFavGrid'),
    list:       $('#metaList'),
    miniNext:   $('#metaMiniNext'),
    refreshFlagsBtn: $('#metaRefreshFlags'),
    flagsTs:    $('#metaFlagsTs')
  };

  // --------- Constantes / Estado ----------
  const LS_FAVS   = 'gw2_meta_favs';
  const SOON_MIN  = 20;



  const LS_META_COMPACT = 'gw2_meta_compact';

  const BODY = document.body;
  const COMPACT_DEFAULT = (localStorage.getItem(LS_META_COMPACT) ?? 'off') === 'on';

  
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


  // --------- Tinte/colores por expansión/temporada ----------
  const EXP_TINT = {
    core: '#DC241F',
    hot: '#1E8D39',
    pof: '#f5a14c',
    eod: '#15C3B7',
    soto: '#A6A75A',
    janthir: '#3A6EEB',
    visionseternity: '#C28E0E',
    livingworlds2: '#f6654f',
    livingworlds3: '#1E8D39',
    livingworlds4: '#e545ca',
    icebroodsaga: '#7EC3FF'
  };

  // --------- Iconos oficiales ----------
  const EXP_ICON = {
    core: 'https://wiki.guildwars2.com/images/thumb/d/df/GW2Logo_new.png/600px-GW2Logo_new.png',
    hot: 'https://wiki.guildwars2.com/images/thumb/5/52/HoT_Texture_Centered_Trans.png/600px-HoT_Texture_Centered_Trans.png',
    pof: 'https://wiki.guildwars2.com/images/thumb/0/0e/GW2-PoF_Texture_Centered_Trans.png/600px-GW2-PoF_Texture_Centered_Trans.png',
    eod: 'https://wiki.guildwars2.com/images/thumb/c/cc/EoD_Texture_Trans.png/600px-EoD_Texture_Trans.png',
    soto: 'https://wiki.guildwars2.com/images/4/44/Secrets_of_the_Obscure_logo.png',
    janthir: 'https://wiki.guildwars2.com/images/thumb/6/60/Janthir_Wilds_logo.png/600px-Janthir_Wilds_logo.png',
    visionseternity: 'https://wiki.guildwars2.com/images/thumb/c/cd/Visions_of_Eternity_logo.png/600px-Visions_of_Eternity_logo.png',
    livingworlds2: 'https://wiki.guildwars2.com/images/e/e8/Living_World_logo.png',
    livingworlds3: 'https://wiki.guildwars2.com/images/thumb/c/ca/Living_World_Season_3_logo.png/450px-Living_World_Season_3_logo.png',
    livingworlds4: 'https://wiki.guildwars2.com/images/thumb/a/a1/Living_World_Season_4_logo.png/450px-Living_World_Season_4_logo.png',
    icebroodsaga: 'https://wiki.guildwars2.com/images/thumb/1/19/Living_World_Season_5_logo.png/450px-Living_World_Season_5_logo.png'
  };

  let seed = [];
  let favs = new Set();
  let filters = { type: '', exp: '', onlyActive: false, onlySoon: false, onlyInf: false };

  let accountFlags = {
    worldbosses: new Set(),
    mapchests:   new Set(),
    lastTs:      0,
    lastHuman:   '—'
  };

  let _flagsSeq = 0;
  let _flagsAbort = null;

  // --------- Utilidades ----------
  function esc(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function setStatus(msg, kind='info'){
    if(!el.status) return;
    el.status.textContent = msg;
    el.status.style.color = (kind==='error') ? '#f28b82' : (kind==='ok' ? '#a7f3d0' : '#a0a0a6');
  }
  const nowLocal = () => new Date();
  const pad2 = (n) => String(n).padStart(2,'0');
  const fmtLocalTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const minutesTo = (d) => Math.floor((d - nowLocal())/60000);

  function nextResetUTC(){
    const n = new Date();
    const reset = new Date(n);
    reset.setUTCHours(24,0,0,0);
    return reset;
  }

  function updateClock(){
    if (!el.localTime || !el.reset) return;
    el.localTime.textContent = fmtLocalTime(new Date());
    const mins = minutesTo(nextResetUTC());
    const hh = Math.max(0, Math.floor(mins/60));
    const mm = Math.max(0, mins%60);
    el.reset.textContent = `Próximo reset en ${pad2(hh)}:${pad2(mm)} h`;
  }

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  // --- SKELETON HELPERS ---
  function renderSkeletonMeta(count=8){
    if(!el.list) return;
    const cards = Array.from({length: count}).map(()=>`
      <article class="skel-card skel-anim">
        <div class="skel-row w70"></div>
        <div class="skel-row w30"></div>
        <div class="skel-row"></div>
        <div class="skel-row w50"></div>
      </article>
    `).join('');
    el.list.innerHTML = `<div class="skel-grid">${cards}</div>`;
    if(el.favBlock){ el.favBlock.setAttribute('hidden',''); el.favGrid.innerHTML=''; }
  }

  // --------- Carga de datos (seed + drops) ----------
  let externalDrops = new Map();

  async function loadExternalDrops(){
    try{
      const r = await fetch('assets/meta-drops.json?v=2.5.0', { headers:{'Accept':'application/json'} });
      if(!r.ok) return;
      const arr = await r.json();
      externalDrops = new Map(arr.map(x => [String(x.metaId ?? '').trim(), x]));
    }catch(e){
      console.warn('[meta] meta-drops.json no disponible', e);
    }
  }

  async function loadSeed(){
    const r = await fetch('assets/meta-events.json?v=2.5.0', { headers:{'Accept':'application/json'} });
    if(!r.ok) throw new Error('No se pudo cargar meta-events.json');
    seed = await r.json();
    await loadExternalDrops();

    seed = seed.map(m => {
      const ext = externalDrops.get(m.id);
      if(!ext) return m;
      const merged = { ...m };
      if (Object.prototype.hasOwnProperty.call(ext, 'highlightItemId')) {
        merged.highlightItemId = ext.highlightItemId;
      }
      if (Array.isArray(ext.items)) merged._extItems = ext.items;
      return merged;
    });
  }

  // --------- Persistencia de fijados ----------
  function loadFavs(){
    try{ favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS)) ?? []); }
    catch{ favs = new Set(); }
  }
  function saveFavs(){
    try{ localStorage.setItem(LS_FAVS, JSON.stringify([...favs])); }catch{}
  }

  // --------- Hecho HOY (SOLO API - v3.3.1) ----------
  function todayUTCKey(){
    const d = new Date();
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
  }

  function isManualEligible(meta){
    // v3.3.1: Marcado manual eliminado. Solo API.
    return false;
  }
  function isManualDone(meta){ return false; }
  function toggleManual(meta){ return false; }

  // --------- API GW2: banderas de cuenta ----------
  async function fetchWorldBosses(token, opts = {}){
    if(!token) return new Set();
    const url = `https://api.guildwars2.com/v2/account/worldbosses?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { headers:{'Accept':'application/json'}, signal: opts.signal });
    if (r.status === 401 || r.status === 403) return new Set();
    const arr = await r.json().catch(() => []);
    return new Set(Array.isArray(arr) ? arr : []);
  }
  async function fetchMapChests(token, opts = {}){
    if(!token) return new Set();
    const url = `https://api.guildwars2.com/v2/account/mapchests?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { headers:{'Accept':'application/json'}, signal: opts.signal });
    if (r.status === 401 || r.status === 403) return new Set();
    const arr = await r.json().catch(() => []);
    return new Set(Array.isArray(arr) ? arr : []);
  }



  // --------- API GW2: Ley Line Anomaly (evento rotativo) ----------
  var _leyLineCache = { mapName: null, ts: 0 };
  var LEY_LINE_TTL = 2 * 60 * 1000; // 2 minutos

  async function fetchLeyLineActiveMap(eventIds) {
    if (!eventIds || !eventIds.length) return null;
    var now = Date.now();
    if (_leyLineCache.mapName && (now - _leyLineCache.ts) < LEY_LINE_TTL) {
      return _leyLineCache.mapName;
    }
    try {
      var url = 'https://api.guildwars2.com/v2/events?ids=' + eventIds.join(',');
      var r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return _leyLineCache.mapName || null;
      var events = await r.json();
      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (e && (e.state === 'Active' || e.state === 'Warmup')) {
          _leyLineCache = { mapName: e.map_id, ts: now };
          return e.map_id;
        }
      }
      // Si ninguno está activo, devolver el último conocido
      _leyLineCache.ts = now;
      return _leyLineCache.mapName || null;
    } catch (e) {
      return _leyLineCache.mapName || null;
    }
  }

  function getWaypointForMapId(mapId, waypoints) {
    if (!waypoints || !mapId) return null;
    var mapNames = {
      25: 'Gendarran Fields',
      28: 'Iron Marches',
      34: 'Timberline Falls'
    };
    var mapName = mapNames[mapId];
    return mapName ? waypoints[mapName] : null;
  }

  // --------- API GW2: items (para drops destacados) ----------
  const itemCache = new Map();
  async function batchItems(ids){
    const out = new Map();
    const chunk = 100;
    for(let i=0; i<ids.length; i+=chunk){
      const part = ids.slice(i,i+chunk).join(',');
      const r = await fetch(`https://api.guildwars2.com/v2/items?ids=${part}&lang=es`, { headers:{'Accept':'application/json'} });
      if(!r.ok) continue;
      const arr = await r.json().catch(()=>[]);
      arr.forEach(it => {
        out.set(it.id, it);
        itemCache.set(it.id, it);
      });
    }
    return out;
  }

  /// === Helpers de ICONOS (devuelven <img>) ===
  function iconTag(url, size = 18, alt = '') {
    const u = String(url ?? '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    const s = Number(size || 18);
    const a = esc(String(alt ?? ''));
    return `<img src="${u}" width="${s}" height="${s}" alt="${a}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  function wpIcon(size = 16) {
    const u = 'https://wiki.guildwars2.com/images/d/d2/Waypoint_(map_icon).png';
    const s = Number(size || 16);
    return `<img src="${u}" width="${s}" height="${s}" alt="Waypoint" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  // --------- Instancias y estado ----------
  function localDateFromUTC_HHMM(hhmm){
    const [H,M] = hhmm.split(':').map(x=>parseInt(x,10));
    const d = new Date();
    d.setUTCHours(H, M, 0, 0);
    return d;
  }

  function buildInstance(meta){
    const list = Array.isArray(meta.windowsUTC) ? meta.windowsUTC : [];
    const now = nowLocal();
    let nextAt = null, state='later';

    for(const w of list){
      const start = localDateFromUTC_HHMM(w);
      const end   = new Date(start.getTime() + (meta.durationMin ?? 15)*60000);

      if(now>=start && now<end){
        state='active'; nextAt=end; break;
      }
      if(start>now){
        if(!nextAt || start<nextAt) nextAt = start;
      }
    }
    if(!nextAt && list.length){
      const first = localDateFromUTC_HHMM(list[0]);
      nextAt = new Date(first.getTime() + 24*3600*1000);
    }
    if(state!=='active' && nextAt){
      const mins = Math.floor((nextAt - now)/60000);
      state = (mins <= SOON_MIN) ? 'soon' : 'later';
    }
    return { state, nextAt };
  }

  function readFilters(){
    filters.type       = el.type?.value ?? '';
    filters.exp        = el.exp?.value ?? '';
    filters.onlyActive = !!el.onlyActive?.checked;
    filters.onlySoon   = !!el.onlySoon?.checked;
    filters.onlyInf    = !!el.onlyInf?.checked;
  }



  function doneTodayDetail(meta){
    if(meta.api?.worldBossId && accountFlags.worldbosses.has(meta.api.worldBossId))
      return { done:true, src:'worldbosses' };
    if(meta.api?.mapChestId && accountFlags.mapchests.has(meta.api.mapChestId))
      return { done:true, src:'mapchests' };
    return { done:false, src:null };
  }
  const doneToday = (meta) => doneTodayDetail(meta).done;

  const INFUSION_WHITELIST = new Set([
    'echo of the dragonvoid','winter\'s heart infusion','frost legion infusion','queen bee infusion',
    'liquid aurillium infusion','chak infusion','festive confetti infusion','crystal infusion',
    'infusión de corazón del invierno','infusión de la legión de escarcha','infusión de la reina abeja',
    'infusión de aurilio líquido','infusión chak','infusión festiva de confeti','infusión de cristal'
  ]);
  const isInfusionItemObj = (item) => {
    try{
      if(!item || typeof item!=='object') return false;
      if(item?.details?.infusion_upgrade_flags?.includes('Infusion')) return true;
      if(item?.type === 'UpgradeComponent') return true;
      return false;
    }catch{ return false; }
  };
  const isInfusionNameOrWhitelist = (name) => {
    const n = String(name ?? '').toLowerCase();
    return n.includes('infusión') || n.includes('infusion') || INFUSION_WHITELIST.has(n);
  };
  function isInfusionMeta(meta){
    if (meta.highlightItemId && itemCache.has(meta.highlightItemId)) {
      return isInfusionItemObj(itemCache.get(meta.highlightItemId));
    }
    const n = Array.isArray(meta._extItems) && meta._extItems.length ? (meta._extItems[0].itemName ?? '') : '';
    return isInfusionNameOrWhitelist(n);
  }

  function footerDropHTML(meta, item){
    const listFromExt = Array.isArray(meta._extItems) ? meta._extItems : [];
    const tipText = (listFromExt.length
      ? listFromExt.map(it => `• ${it.itemName ?? '—'}${it.wiki ? `\n ${it.wiki}` : ''}`).join('\n')
      : (item && item.name ? `• ${item.name}` : '—')
    );
    const tipAttr = String(tipText ?? '')
      .replace(/&/g,'&amp;')
      .replace(/"/g,'&quot;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\n/g,'&#10;');

    // Obtener URL de preview desde meta._extItems
    var previewUrl = '';
    if (listFromExt.length && listFromExt[0].preview) {
      previewUrl = listFromExt[0].preview;
    }

    // Determinar si es infusión
    var isInfusion = false;
    if (meta.highlightItemId && itemCache.has(meta.highlightItemId)) {
      isInfusion = isInfusionItemObj(itemCache.get(meta.highlightItemId));
    }
    if (!isInfusion) {
      const n = listFromExt.length ? (listFromExt[0].itemName ?? '') : '';
      isInfusion = isInfusionNameOrWhitelist(n);
    }

    if (meta.highlightItemId){
      if (!item){
        return `
          <div class="m-foot" data-tip="Cargando…">
            <span class="m-tag tag--drop">Drop destacado</span>
            <span class="m-item"><span class="m-item__name">cargando…</span></span>
          </div>
        `;
      }
      const label = isInfusion ? 'Infusión destacada' : 'Drop destacado';
      const tagClass = isInfusion ? 'm-tag--infusion' : 'tag--drop';
      const icon  = iconTag(item.icon, 24, item.name ?? 'Drop');
      const name  = esc(item.name ?? '—');
      return `
        <div class="m-foot" data-tip="${tipAttr}">
          <span class="m-tag ${tagClass}">${label}</span>
          <span class="m-item m-item--large" data-preview="${esc(previewUrl)}">${icon}<span class="m-item__name">${name}</span></span>
        </div>
      `;
    }

    const nameFromList = listFromExt.length ? esc(listFromExt[0].itemName ?? '—') : '—';
    const label = isInfusion ? 'Infusión destacada' : 'Drop destacado';
    const tagClass = isInfusion ? 'm-tag--infusion' : 'tag--drop';
    return `
      <div class="m-foot" data-tip="${tipAttr}">
        <span class="m-tag ${tagClass}">${label}</span>
        <span class="m-item" data-preview="${esc(previewUrl)}"><span class="m-item__name">${nameFromList}</span></span>
      </div>
    `;
  }

  // ========== Ícono de expansión con glow (como Cartera/WV) ==========
  function expKeyOf(meta){
    const raw = String(meta.expansion ?? '').toLowerCase().trim();
    return EXP_MAP[raw] ?? raw.replace(/\s+/g,'');
  }
  function expTintColor(meta){
    const k = expKeyOf(meta);
    return EXP_TINT[k] || '#e9e9f1';
  }

  function expIconHTML(meta) {
    var k = expKeyOf(meta);
    var tint = expTintColor(meta);
    var url = EXP_ICON[k] || '';
    var label = String(meta.expansion || '—');

    var iconGlowColor = hexToRGBA(tint, 0.36);
    var iconBorderColor = hexToRGBA(tint, 0.32);
    var iconDeco = (iconBorderColor && iconGlowColor)
      ? ' style="box-shadow: 0 0 0 2px ' + iconBorderColor + ', 0 0 10px ' + iconGlowColor + '; border-radius:10px;"'
      : '';

    var iconSize = 'width:36px;height:36px;';
    if (url) {
      return '<div class="meta-card__iconWrap"' + iconDeco + ' title="' + esc(label) + '" aria-label="Expansión: ' + esc(label) + '" style="' + iconSize + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;"><img class="meta-card__icon" src="' + esc(url) + '" alt="' + esc(label) + '" loading="lazy" style="width:28px;height:28px;object-fit:contain;"/></div>';
    }
    var initial = label.charAt(0).toUpperCase();
    return '<div class="meta-card__iconWrap meta-card__iconWrap--fallback"' + iconDeco + ' title="' + esc(label) + '" aria-label="Expansión: ' + esc(label) + '" style="' + iconSize + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="meta-card__icon--fallback" style="color:' + tint + ';font-size:18px;font-weight:700;">' + initial + '</span></div>';
  }

  function chipsForTiming(inst, minsRemaining){
    var chips = [];
    if(inst.state === 'active'){
      chips.push('<span class="meta-chip meta-chip--active">Activo</span>');
      chips.push('<span class="meta-chip">Termina en ' + minsRemaining + ' min</span>');
    } else if(minsRemaining != null){
      chips.push('<span class="meta-chip meta-chip--soon">Próximo</span>');
      chips.push('<span class="meta-chip">En ' + minsRemaining + ' min</span>');
    } else {
      chips.push('<span class="meta-chip meta-chip--later">Más tarde</span>');
    }
    return chips;
  }

  // ========== cardHTML (estructura unificada, sin marcado manual) ==========
  function cardHTML(meta, inst, item, isFav){
    const now = nowLocal();
    const minsRemaining = inst?.nextAt ? Math.max(1, Math.floor((inst.nextAt - now)/60000)) : null;

    const dt = doneTodayDetail(meta);
    const when = accountFlags.lastHuman || '—';
    const srcTxt = dt.src
      ? (dt.src === 'worldbosses' ? 'worldbosses' : (dt.src === 'mapchests' ? 'mapchests' : '—'))
      : '—';

    const doneTitle = dt.done
      ? `Hecho hoy (fuente: ${srcTxt}; actualizado ${when})`
      : `No hecho hoy (fuente: ${srcTxt}; actualizado ${when})`;

    // Waypoint dinámico para Ley Line
    var activeWp = inst._activeWaypoint || meta.chat;
    var wpTitle = inst._activeMapId ? 'Waypoint confirmado por API' : 'Waypoint';

    // Acciones
    const wikiUrlEs = meta.wiki ? meta.wiki.replace('wiki.guildwars2.com', 'wiki-es.guildwars2.com') : '';
    const wikiHtml = wikiUrlEs
      ? `<a href="${esc(wikiUrlEs)}" target="_blank" rel="noopener" title="Wiki">Wiki</a>`
      : '';
    const mapHref = meta.map ? `https://maps.gw2.io/#/?q=${encodeURIComponent(meta.map)}` : '';
    const mapBtn  = !!mapHref;

    // Pin
    const pinBtn = `<button class="wv-pin ${isFav?'wv-pin--active':''}" data-pin="${meta.id}" aria-pressed="${isFav?'true':'false'}" title="${isFav?'Desfijar':'Fijar'}">📌</button>`;

    // Ícono de expansión con glow
    const expIcon = expIconHTML(meta);

    // Tinte de título
    const tint = expTintColor(meta);
    const styleTint = tint ? ` style="--meta-title-color:${tint}"` : '';

    // ===== CHIPS DE TIMING =====
    var timingHtml = '';
    if (inst.state === 'active') {
      timingHtml = '<span class="meta-chip meta-chip--active">Activo</span>' +
                   '<span class="meta-chip meta-chip--neutral">Termina en ' + minsRemaining + ' min</span>';
    } else if (minsRemaining != null) {
      timingHtml = '<span class="meta-chip meta-chip--soon">Próximo</span>' +
                   '<span class="meta-chip meta-chip--neutral">En ' + minsRemaining + ' min</span>';
    } else {
      timingHtml = '<span class="meta-chip meta-chip--neutral">Más tarde</span>';
    }

    // ===== FOOTER CON DROP =====
    const foot = footerDropHTML(meta, item);

    // ===== ESTRUCTURA UNIFICADA (sin data-manual, sin role=button) =====
    // Convertir horarios UTC a hora local
    var localWindows = Array.isArray(meta.windowsUTC) ? meta.windowsUTC.map(function(hhmm) {
      var d = localDateFromUTC_HHMM(hhmm);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }) : [];

    return `
      <article class="meta-card" data-id="${meta.id}"${styleTint} style="background:#0f1116;border:1px solid #26262b;border-radius:16px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #26262b;overflow:hidden;">
          <div style="width:36px;height:36px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${expIcon}
          </div>
          <div style="flex:1;min-width:0;overflow:hidden;display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:0.9rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(meta.name)}">${esc(meta.name)}</span>
            <span style="font-size:0.6rem;color:${expTintColor(meta)};background:#1a1c24;padding:2px 6px;border-radius:10px;white-space:nowrap;flex-shrink:0;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${esc(meta.expansion || '—')}</span>
            ${pinBtn}
          </div>
        </div>
        <div style="height:3px;background:#2a2c35;overflow:hidden;">
          <div style="width:${dt.done ? '100' : '0'}%;height:100%;background:linear-gradient(90deg,#7bc2ff,#a0ffc8);transition:width 0.3s ease;"></div>
        </div>
        <div style="padding:0;display:flex;flex-direction:column;gap:0;">
          <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:#0a0c10;border-radius:12px;border:1px solid ${dt.done ? '#2a6a4a' : '#26262b'};transition:all 0.2s ease;">
            <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:0.65rem;color:${inst.state === 'active' ? '#a0ffc8' : (inst.state === 'soon' ? '#ffd36b' : '#7bc2ff')};background:#1a1c24;padding:2px 6px;border-radius:12px;">${inst.state === 'active' ? 'ACTIVO' : (inst.state === 'soon' ? 'PRÓXIMO' : 'MÁS TARDE')}</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:0.65rem;color:#9aa2b8;">${minsRemaining != null ? (inst.state === 'active' ? 'Termina en ' + minsRemaining + ' min' : 'En ' + minsRemaining + ' min') : 'Sin horario'}</span>
                <span style="display:flex;align-items:center;gap:4px;font-size:0.65rem;color:${dt.done ? '#a0ffc8' : '#ff9d9d'};">
                  <img src="assets/icons/Welcome/${dt.done ? '156108' : '156107'}.png" width="12" height="12" alt="">
                  ${dt.done ? 'Completado' : 'Pendiente'}
                </span>
              </div>
              ${localWindows.length ? '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:4px;">' + localWindows.slice(0,12).map(function(lhhm, idx){ var hhmm = meta.windowsUTC[idx]; var wStart = localDateFromUTC_HHMM(hhmm); var wEnd = new Date(wStart.getTime() + (meta.durationMin || 15)*60000); var now = new Date(); var wState = (now >= wStart && now < wEnd) ? 'active' : (wStart > now && ((wStart - now)/60000) <= SOON_MIN) ? 'soon' : 'later'; var chipColor = wState === 'active' ? '#a0ffc8' : (wState === 'soon' ? '#ffd36b' : '#9aa2b8'); var chipBg = wState === 'active' ? 'rgba(160,255,200,0.12)' : (wState === 'soon' ? 'rgba(255,211,107,0.12)' : '#1a1c24'); var chipBorder = wState === 'active' ? 'rgba(160,255,200,0.3)' : (wState === 'soon' ? 'rgba(255,211,107,0.3)' : '#2a2c35'); return '<span style="font-size:0.6rem;color:' + chipColor + ';background:' + chipBg + ';padding:1px 4px;border-radius:8px;border:1px solid ' + chipBorder + ';text-align:center;">' + esc(lhhm) + '</span>'; }).join('') + '</div>' : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding:8px 16px 8px 16px;">
            ${activeWp ? '<button class="m-copy" data-copy="' + esc(activeWp) + '" title="' + esc(wpTitle) + '" style="background:none;border:none;cursor:pointer;padding:2px;opacity:0.7;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'"><img src="assets/icons/733330.png" width="24" height="24" alt="Waypoint"></button>' : ''}
            ${mapBtn ? '<a href="' + mapHref + '" target="_blank" rel="noopener" title="Mapa" style="opacity:0.7;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'"><img src="assets/icons/1770688.png" width="24" height="24" alt="Mapa"></a>' : ''}
            <button class="m-share" data-id="${meta.id}" title="Compartir" style="background:none;border:none;cursor:pointer;padding:2px;opacity:0.7;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'"><img src="assets/icons/3380750.png" width="24" height="24" alt="Compartir"></button>
            ${wikiHtml ? '<a href="' + esc(meta.wiki) + '" target="_blank" rel="noopener" title="Wiki" style="opacity:0.7;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.7\'"><img src="assets/icons/1602819.png" width="24" height="24" alt="Wiki"></a>' : ''}
          </div>
          ${foot ? '<div style="padding:4px 16px 8px 16px;">' + foot + '</div>' : ''}
        </div>
      </article>`;
  }
  


  function computeAllInstances(){
    return seed.map(m => ({ meta:m, inst:buildInstance(m), fav:favs.has(m.id) }));
  }
  
  // ---------- Render principal ----------
  async function render(){
    if(!el.list) return;

    readFilters();
    const rowsRaw = computeAllInstances();

    let rows = rowsRaw;
    if(filters.type)       rows = rows.filter(r => r.meta.type===filters.type);
    if(filters.exp)        rows = rows.filter(r => r.meta.expansion===filters.exp);
    if(filters.onlyActive) rows = rows.filter(r => r.inst.state==='active');
    if(filters.onlySoon)   rows = rows.filter(r => r.inst.state==='soon');
    if(filters.onlyInf)    rows = rows.filter(r => isInfusionMeta(r.meta));

    const rankState = (s) => s==='active'?0 : (s==='soon'?1:2);
    rows.sort((a,b)=>{
      if(a.fav!==b.fav) return a.fav? -1 : 1;
      const rs = rankState(a.inst.state) - rankState(b.inst.state);
      if(rs!==0) return rs;
      const an = a.inst.nextAt? a.inst.nextAt.getTime() : Infinity;
      const bn = b.inst.nextAt? b.inst.nextAt.getTime() : Infinity;
      return an - bn;
    });

    // Ley Line Anomaly: consultar API para waypoint correcto
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.meta.api && Array.isArray(r.meta.api.eventIds) && r.meta.api.eventIds.length) {
        var activeMapId = await fetchLeyLineActiveMap(r.meta.api.eventIds);
        if (activeMapId && r.meta.api.waypoints) {
          r._activeWaypoint = getWaypointForMapId(activeMapId, r.meta.api.waypoints);
          r._activeMapId = activeMapId;
        }
      }
    }

    const ids     = [...new Set(rows.map(x=>x.meta.highlightItemId).filter(Boolean))];
    const missing = ids.filter(id => !itemCache.has(id));
    if(missing.length) await batchItems(missing);

    const favRows = rows.filter(r=>r.fav).slice(0,6);
    if(favRows.length){
      el.favBlock?.removeAttribute('hidden');
      el.favGrid.innerHTML = favRows
        .map(r=>cardHTML(r.meta, r.inst, itemCache.get(r.meta.highlightItemId), true))
        .join('');
    }else{
      el.favBlock?.setAttribute('hidden','');
      el.favGrid.innerHTML='';
    }

    const rest = rows.filter(r=>!r.fav);
    el.list.innerHTML = rest
      .map(r=>cardHTML(r.meta, r.inst, itemCache.get(r.meta.highlightItemId), false))
      .join('');

    // Tooltips de infusión
    bindInfusionPreviews();

    // Acciones de tarjeta
    $$('.m-copy', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const v = btn.getAttribute('data-copy') ?? '';
        if(!v) return;
        navigator.clipboard.writeText(v).then(()=>{
          setStatus('Copiado al portapapeles.','ok');
          if (typeof toast === 'function' && toast.legacy) toast.legacy('Copiado al portapapeles','ok', 1600);
          else if (typeof toast === 'function') toast('success','Copiado al portapapeles',{ttl:1600});
        });
      });
    });

    // PIN
    $$('.wv-pin', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-pin');
        if(!id) return;
        if(favs.has(id)){
          favs.delete(id);
        }else{
          if(favs.size>=6){
            if(!confirm('Ya tenés 6 fijados. ¿Reemplazar alguno?')) return;
            const last=[...favs][favs.size-1]; favs.delete(last);
          }
          favs.add(id);
        }
        saveFavs();
        render();
      });
    });

    // v3.3.1: Eliminados listeners de marcado manual

    // Compartir
    $$('.m-share', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        const r = [...rowsRaw, ...rows].find(x => x.meta.id===id) || rowsRaw.find(x=>x.meta.id===id);
        if(!r) return;
        const meta = r.meta, inst = r.inst;
        const now = nowLocal();
        const minsRemaining = inst?.nextAt ? Math.max(1, Math.floor((inst.nextAt - now)/60000)) : null;
        const stateTxt = (inst?.state==='active')
          ? `Activo (${minsRemaining}m)`
          : (minsRemaining != null ? `Próx en ${minsRemaining}m` : '—');
        const piece = `${meta.name} — ${stateTxt}${meta.chat ? ` ${meta.chat}`:''}`;
        navigator.clipboard.writeText(piece).then(()=>{
          setStatus('Texto copiado para compartir.','ok');
          if (typeof toast === 'function' && toast.legacy) toast.legacy('Copiado para compartir','ok', 1200);
          else if (typeof toast === 'function') toast('success','Copiado para compartir',{ttl:1200});
        });
      });
    });

    // Horarios (toggle)
    $$('.m-win__toggle', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const card = btn.closest('.m-card');
        const pane = card?.querySelector('.m-win');
        if(!pane) return;
        const open = !pane.hasAttribute('hidden');
        pane.toggleAttribute('hidden', open);
        btn.setAttribute('aria-expanded', String(!open));
      });
    });

    // Sidebar Top 3
    renderMiniNext(rowsRaw);

    if(el.flagsTs){
      el.flagsTs.textContent = `Actualizado ${accountFlags.lastHuman || '—'}`;
      el.flagsTs.title = `Última actualización de 'Hecho hoy': ${accountFlags.lastHuman || '—'}`;
    }
  }

  function renderMiniNext(rowsRaw){
    if(!el.miniNext) return;
    const next = rowsRaw
      .filter(r => r.inst.state==='active' || r.inst.state==='soon')
      .sort((a,b) => {
        const an = a.inst.nextAt ? a.inst.nextAt.getTime() : Infinity;
        const bn = b.inst.nextAt ? b.inst.nextAt.getTime() : Infinity;
        return an - bn;
      })
      .slice(0, 3);
    el.miniNext.innerHTML = next.length
      ? next.map(r => `<div class="mini-next-item">• <strong>${esc(r.meta.name)}</strong> ${r.inst.state==='active' ? '— Activo' : '— Próximo'}</div>`).join('')
      : '<div class="mini-next-item muted">Sin eventos próximos</div>';
  }

  // ---------- Reloj + Auto-refresh UTC ----------
  let clockT = null;
  let midnightTimer = null;

  function scheduleMidnightAutoRefresh(){
    clearTimeout(midnightTimer);
    const delta = nextResetUTC().getTime() - Date.now();
    if(delta > 0 && delta < 36*3600*1000){
      midnightTimer = setTimeout(async ()=>{
        await window.Meta.refresh({ token: window.__GN__?.getSelectedToken?.() ?? null, nocache: true });
        render();
        scheduleMidnightAutoRefresh();
      }, delta + 1200);
    }
  }
  function startClock(){
    if(clockT) return;
    updateClock();
    clockT = setInterval(updateClock, 1000);
    scheduleMidnightAutoRefresh();
  }

  // ---------- Flags de cuenta ----------
  async function refreshAccountFlags(opts = {}){
    const token = opts.token ?? (window.__GN__?.getSelectedToken?.() ?? null);

    if(!token){
      accountFlags = { worldbosses:new Set(), mapchests:new Set(), lastTs:0, lastHuman:'—' };
      if(el.flagsTs) el.flagsTs.textContent = 'Actualizado —';
      return;
    }

    _flagsSeq += 1;
    const seq = _flagsSeq;
    try{
      if (_flagsAbort) _flagsAbort.abort();
      _flagsAbort = new AbortController();

      setStatus('Actualizando "Hecho hoy"…');

      const [wb, mc] = await Promise.all([
        fetchWorldBosses(token, { signal: _flagsAbort.signal }),
        fetchMapChests(token, { signal: _flagsAbort.signal })
      ]);

      if (seq !== _flagsSeq || _flagsAbort.signal.aborted) return;

      accountFlags.worldbosses = wb;
      accountFlags.mapchests   = mc;
      accountFlags.lastTs      = Date.now();
      accountFlags.lastHuman   = fmtLocalTime(new Date(accountFlags.lastTs));
      setStatus('Listo.','ok');
    }catch(e){
      if (e?.name === 'AbortError') return;
      console.warn('[meta] account flags', e);
      setStatus('No se pudo actualizar "Hecho hoy".','error');
    }
  }

  // ---------- Compact toggle ----------
  function setCompact(on){ BODY.setAttribute('data-meta-compact', on ? 'on' : 'off'); }
  function injectUIToggles(){
    const actions = $('#metaPanel .filters-actions');
    if(!actions) return;
    if(actions.querySelector('#metaToggleCompact')) return;

    const btnCompact = document.createElement('button');
    btnCompact.id = 'metaToggleCompact';
    btnCompact.className = 'btn btn--ghost';
    btnCompact.type = 'button';
    btnCompact.title = 'Alternar Vista compacta / detallada';
    btnCompact.textContent = (BODY.getAttribute('data-meta-compact')==='on') ? 'Vista detallada' : 'Vista compacta';

    btnCompact.addEventListener('click', ()=>{
      const nowOn = BODY.getAttribute('data-meta-compact')!=='on';
      setCompact(nowOn);
      btnCompact.textContent = nowOn ? 'Vista detallada' : 'Vista compacta';
      localStorage.setItem(LS_META_COMPACT, nowOn ? 'on' : 'off');
      render();
    });

    actions.appendChild(btnCompact);
  }

  // ---------- Tooltips de infusiones ----------
  function bindInfusionPreviews(){
    document.querySelectorAll('.inf-prev').forEach(n=>n.remove());

    var cards = document.querySelectorAll('.meta-card, .m-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var target = card.querySelector('.m-item[data-preview]');
      if (!target) continue;

      var preview = target.getAttribute('data-preview') || '';
      if (!preview) continue;

      (function(target, preview) {
        var pop = null, hideT = null;

        target.addEventListener('mouseenter', function(e) {
          clearTimeout(hideT);
          if (pop) pop.remove();
          pop = document.createElement('div');
          pop.className = 'inf-prev on';
          var a = document.createElement('img');
          a.src = preview;
          a.alt = 'Preview de infusión';
          pop.appendChild(a);
          document.body.appendChild(pop);
          var x = (e.pageX || 0) + 14;
          var y = (e.pageY || 0) - (pop.offsetHeight || 280) - 16;
          pop.style.left = x + 'px';
          pop.style.top = y + 'px';
        });

        target.addEventListener('mousemove', function(e) {
          if (!pop) return;
          var x = (e.pageX || 0) + 14;
          var y = (e.pageY || 0) - (pop.offsetHeight || 280) - 16;
          pop.style.left = x + 'px';
          pop.style.top = y + 'px';
        });

        target.addEventListener('mouseleave', function() {
          hideT = setTimeout(function() {
            if (pop) { pop.remove(); pop = null; }
          }, 90);
        });
      })(target, preview);
    }
  }

  // ---------- Inicialización ----------
  async function initOnce(){
    if(!el.panel) return;
    try{
      setStatus('Cargando MetaEventos…');
      renderSkeletonMeta(8);
      loadFavs();
      await loadSeed();
      window._metaSeed = seed;

      await refreshAccountFlags({ token: window.__GN__?.getSelectedToken?.() ?? null });
      await render();

      setCompact(COMPACT_DEFAULT);
      injectUIToggles();

      setStatus('Listo.','ok');
      startClock();

      setTimeout(()=>{
        const issues = [];
        if(!Array.isArray(seed) || seed.length===0) issues.push('Seed vacío (meta-events.json).');
        if(!el.list) issues.push('Contenedor de lista no encontrado.');
        if(typeof window.__GN__?.getSelectedToken !== 'function') issues.push('Hook de token no disponible desde app.js.');
        if(issues.length){
          console.warn('[meta:selfcheck] Observaciones:', issues);
        }else{
          console.info('[meta:selfcheck] OK');
        }
      }, 300);

    }catch(e){
      console.error(e);
      setStatus('No se pudo cargar MetaEventos.','error');
      if (typeof toast === 'function' && toast.legacy) toast.legacy('No se pudo cargar MetaEventos','error', 2400);
      else if (typeof toast === 'function') toast('error','No se pudo cargar MetaEventos', { ttl:2400 });
    }
  }

  // ---------- API pública ----------
  window.Meta = window.Meta || {};
  window.Meta.refresh = async function metaRefresh({ token, nocache = false } = {}){
    try {
      await refreshAccountFlags({ token: token ?? (window.__GN__?.getSelectedToken?.() ?? null) });
      // Asegurar que el DOM refleje los flags actualizados
      await new Promise(function(r) { setTimeout(r, 50); });
      await render();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('[Meta.refresh] error', e);
    }
  };

  // ---------- Eventos del shell ----------
  let inited=false;

  document.addEventListener('gn:tabchange', (ev) => {
    if (ev.detail?.view === 'meta' && !inited) {
      inited = true;
      initOnce();
    }
  });

  ['change','input'].forEach(ev=>{
    el.type?.addEventListener(ev, render);
    el.exp?.addEventListener(ev, render);
    el.onlyActive?.addEventListener(ev, render);
    el.onlySoon?.addEventListener(ev, render);
  });
  el.onlyInf?.addEventListener('change', render);

  el.refreshFlagsBtn?.addEventListener('click', async ()=>{
    const old = el.refreshFlagsBtn.textContent;
    try{
      el.refreshFlagsBtn.disabled = true;
      el.refreshFlagsBtn.textContent = 'Actualizando…';
      await window.Meta.refresh({ token: window.__GN__?.getSelectedToken?.() ?? null, nocache: true });
      if (typeof toast === 'function' && toast.legacy) toast.legacy('Estado "Hecho hoy" actualizado','ok', 1400);
      else if (typeof toast === 'function') toast('success','Estado "Hecho hoy" actualizado', { ttl:1400 });
    }finally{
      el.refreshFlagsBtn.disabled = false;
      el.refreshFlagsBtn.textContent = old;
    }
  });

  /* === Auto-refresh Meta & Eventos al cambiar de API Key === */
  (function () {
    var FLAG = '__gn_meta_autorefresh_wired__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    document.addEventListener('gn:meta-refresh', function (ev) {
      try {
        var status = document.getElementById('metaStatus');
        if (status) {
          status.textContent = 'Cargando…';
          status.classList.remove('error');
          status.classList.add('muted');
        }

        var token = (ev && ev.detail && ev.detail.token)
                 || (window.__GN__ && typeof window.__GN__.getSelectedToken === 'function'
                      ? window.__GN__.getSelectedToken()
                      : null);

        window.Meta.refresh({ token: token, nocache: true });

      } catch (e) {
        console.warn('[Meta] auto-refresh error:', e);
      }
    });
  })();

  // Debug: exponer estado interno (se actualiza en cada render)
  window._metaFlags = accountFlags;

})();