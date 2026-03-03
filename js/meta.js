/* eslint-disable no-console */
(function(){
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

  console.info('%cMetaEventos meta.js v3.2.1 — Recuadro + logo de expansión (borde del color del título)',
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
  const LS_FAVS   = 'gw2_meta_favs';      // fijados (antes favoritos)
  const SOON_MIN  = 20;

  const LS_FLAGS      = 'gw2_meta_flags_v1';
  const FLAGS_TTL_MS  = 5 * 60 * 1000;
  const LS_MANUAL     = 'gw2_meta_manual_v1';

  // Persistencia de toggles de UI
  const LS_META_DELUXE  = 'gw2_meta_deluxe';
  const LS_META_COMPACT = 'gw2_meta_compact';

  const BODY = document.body;
  const DELUXE_DEFAULT  = (localStorage.getItem(LS_META_DELUXE)  ?? 'on')  === 'on';
  const COMPACT_DEFAULT = (localStorage.getItem(LS_META_COMPACT) ?? 'off') === 'on';

  
// --------- Normalización de expansiones/temporadas ----------
const EXP_MAP = {
  // Core
  'core':'core', 'core tyria':'core',

  // Heart of Thorns
  'hot':'hot', 'heart of thorns':'hot',

  // Path of Fire
  'pof':'pof', 'path of fire':'pof',

  // End of Dragons
  'eod':'eod', 'end of dragons':'eod',

  // Secrets of the Obscure
  'soto':'soto', 'secrets of the obscure':'soto',

  // Janthir
  'janthir':'janthir',

  // Visions of Eternity
  'voe':'visionseternity', 'visions of eternity':'visionseternity',

  // Living World Season 2
  'lw2':'livingworlds2', 'living world s2':'livingworlds2',
  'living world season 2':'livingworlds2', 'livingworlds2':'livingworlds2',

  // Living World Season 3
  'lw3':'livingworlds3', 'living world s3':'livingworlds3',
  'living world season 3':'livingworlds3', 'livingworlds3':'livingworlds3',

  // Living World Season 4 (ya existía, lo mantenemos)
  'ls4':'livingworlds4', 'living world s4':'livingworlds4',
  'living world season 4':'livingworlds4', 'livingworlds4':'livingworlds4',

  // The Icebrood Saga (Living World Season 5)
  'ibs':'icebroodsaga', 'icebrood saga':'icebroodsaga',
  'the icebrood saga':'icebroodsaga', 'living world season 5':'icebroodsaga',
  'lw5':'icebroodsaga',

  // Agrupadores/aliases comunes dentro de IBS
  'visions of the past':'icebroodsaga',
  'steel and fire':'icebroodsaga'
};


  // --------- Tinte/colores por expansión/temporada ----------
const EXP_TINT = {
  // Core (rojo oficial del logo)
  core: '#DC241F',     // fuente: página del logo oficial GW2

  // Expansions (paleta práctica y consistente en UI)
  hot: '#1E8D39',      // verde Maguuma
  pof: '#f5a14c',      // magenta del desierto
  eod: '#15C3B7',      // jade/teal Cantha
  soto: '#A6A75A',     // violeta/azul “sky”
  janthir: '#3A6EEB',  // verde-oliva/“wilds”
  visionseternity: '#C28E0E', // azul “castoran/mist”

  // Living World / Saga
  livingworlds2: '#f6654f',   // dorado (pre-HoT, Tyria central)
  livingworlds3: '#1E8D39',   // sigue paleta HoT
  livingworlds4: '#e545ca',   // sigue paleta PoF
  icebroodsaga: '#7EC3FF'     // azul “ice/tundra”
};

  // --------- Iconos oficiales (páginas File:/artículos de la wiki) ----------
const EXP_ICON = {
  // Core (Tyria base)
  core: 'https://wiki.guildwars2.com/images/thumb/d/df/GW2Logo_new.png/600px-GW2Logo_new.png',

  // Expansions
  hot: 'https://wiki.guildwars2.com/images/thumb/5/52/HoT_Texture_Centered_Trans.png/600px-HoT_Texture_Centered_Trans.png',
  pof: 'https://wiki.guildwars2.com/images/thumb/0/0e/GW2-PoF_Texture_Centered_Trans.png/600px-GW2-PoF_Texture_Centered_Trans.png',
  eod: 'https://wiki.guildwars2.com/images/thumb/c/cc/EoD_Texture_Trans.png/600px-EoD_Texture_Trans.png',
  soto: 'https://wiki.guildwars2.com/images/4/44/Secrets_of_the_Obscure_logo.png',
  janthir: 'https://wiki.guildwars2.com/images/thumb/6/60/Janthir_Wilds_logo.png/600px-Janthir_Wilds_logo.png',
  visionseternity: 'https://wiki.guildwars2.com/images/thumb/c/cd/Visions_of_Eternity_logo.png/600px-Visions_of_Eternity_logo.png',

  // Living World / Saga
  livingworlds2: 'https://wiki.guildwars2.com/images/e/e8/Living_World_logo.png',
  livingworlds3: 'https://wiki.guildwars2.com/images/thumb/c/ca/Living_World_Season_3_logo.png/450px-Living_World_Season_3_logo.png',
  livingworlds4: 'https://wiki.guildwars2.com/images/thumb/a/a1/Living_World_Season_4_logo.png/450px-Living_World_Season_4_logo.png',
  icebroodsaga: 'https://wiki.guildwars2.com/images/thumb/1/19/Living_World_Season_5_logo.png/450px-Living_World_Season_5_logo.png'
};

  let seed = [];                 // metas (assets/meta-events.json)
  let favs = new Set();          // fijados (ids)
  let filters = { type: '', exp: '', onlyActive: false, onlySoon: false, onlyInf: false };

  let accountFlags = {           // banderas de cuenta (completado hoy)
    worldbosses: new Set(),
    mapchests:   new Set(),
    lastTs:      0,
    lastHuman:   '—'
  };

  // >>> NUEVO: control de concurrencia para flags
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

    // Merge: seed + externalDrops
    seed = seed.map(m => {
      const ext = externalDrops.get(m.id);
      if(!ext) return m;
      const merged = { ...m };
      if (Object.prototype.hasOwnProperty.call(ext, 'highlightItemId')) {
        merged.highlightItemId = ext.highlightItemId; // null anula
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

  // --------- Hecho HOY (MANUAL) ----------
  function tokenFingerprint(){
    const t = window.__GN__?.getSelectedToken?.() ?? null;
    if(!t) return null;
    return `${t.slice(0,4)}…${t.slice(-4)}`; // no exponemos completa
  }
  function tokenFingerprintFrom(t){
    if(!t) return null;
    return `${t.slice(0,4)}…${t.slice(-4)}`;
  }
  function todayUTCKey(){
    const d = new Date();
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
  }
  function manualKeyNamespace(){
    return `${LS_MANUAL}:${tokenFingerprint() || 'anon'}:${todayUTCKey()}`;
  }
  function loadManualDone(){
    try{
      const all = JSON.parse(localStorage.getItem(manualKeyNamespace()) || '[]');
      return new Set(Array.isArray(all) ? all : []);
    }catch{
      return new Set();
    }
  }
  function saveManualDone(set){
    try{ localStorage.setItem(manualKeyNamespace(), JSON.stringify([...set])); }catch{}
  }
  let manualDoneSet = loadManualDone();

  function isManualEligible(meta){
    const hasAPI = !!(meta?.api?.worldBossId || meta?.api?.mapChestId);
    return !!meta?.manualCheck && !hasAPI;
  }
  function isManualDone(meta){ return isManualEligible(meta) && manualDoneSet.has(meta.id); }
  function toggleManual(meta){
    if(!isManualEligible(meta)) return false;
    if(manualDoneSet.has(meta.id)) manualDoneSet.delete(meta.id);
    else manualDoneSet.add(meta.id);
    saveManualDone(manualDoneSet);
    return manualDoneSet.has(meta.id);
  }

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

  // --------- Cache por Key (TTL 5min) ----------
  function loadFlagsFromCache(tokenOpt){
    try{
      const all = JSON.parse(localStorage.getItem(LS_FLAGS) || '{}');
      const fp = tokenFingerprintFrom(tokenOpt ?? (window.__GN__?.getSelectedToken?.() ?? null));
      if(!fp) return null;
      const item = all[fp]; if(!item) return null;
      if(!item.ts || (Date.now() - item.ts) > FLAGS_TTL_MS) return null;
      return {
        worldbosses: new Set(item.worldbosses || []),
        mapchests: new Set(item.mapchests || []),
        lastTs: item.ts,
        lastHuman: item.human || '—'
      };
    }catch{ return null; }
  }
  function saveFlagsToCache(tokenOpt){
    try{
      const all = JSON.parse(localStorage.getItem(LS_FLAGS) || '{}');
      const fp = tokenFingerprintFrom(tokenOpt ?? (window.__GN__?.getSelectedToken?.() ?? null));
      if(!fp) return;
      all[fp] = {
        worldbosses: [...accountFlags.worldbosses],
        mapchests:   [...accountFlags.mapchests],
        ts:          accountFlags.lastTs,
        human:       accountFlags.lastHuman
      };
      localStorage.setItem(LS_FLAGS, JSON.stringify(all));
    }catch{}
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
    const now = nowLocal();                // FIX parseo
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

  // --- Contexto (línea adicional) ---
  function buildContext(meta){
    const hasWB = !!meta?.api?.worldBossId;
    const hasMC = !!meta?.api?.mapChestId;
    const t = String(meta?.type || '').toLowerCase();

    if (hasWB) return '• Cofre diario (worldboss) • Recom. 40+';
    if (hasMC) return '• Cofre diario: Hero’s Choice';
    if (t==='global')   return '• Evento rotativo / no marcado por API';
    if (t==='instance') return '• Instancia pública • no marcado por API';
    if (t==='temple')   return '• Evento de templo • no marcado por API';
    if (t==='event')    return '• Evento de mapa • no marcado por API';
    return '';
  }

  function doneTodayDetail(meta){
    if(meta.api?.worldBossId && accountFlags.worldbosses.has(meta.api.worldBossId))
      return { done:true, src:'worldbosses' };
    if(meta.api?.mapChestId && accountFlags.mapchests.has(meta.api.mapChestId))
      return { done:true, src:'mapchests' };
    if(isManualDone(meta)) return { done:true, src:'manual' };
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
  function labelByItemOrName(item, fallbackName){
    if(isInfusionItemObj(item)) return 'Infusión destacada';
    if(isInfusionNameOrWhitelist(fallbackName)) return 'Infusión destacada';
    return 'Drop destacado';
  }
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

    if (meta.highlightItemId){
      if (!item){
        return `
          <div class="m-foot" data-tip="Cargando…">
            <span class="m-tag tag--drop">Drop destacado</span>
            <span class="m-item"><span class="m-item__name">cargando…</span></span>
          </div>
        `;
      }
      const label = labelByItemOrName(item, item.name);
      const icon  = iconTag(item.icon, 18, item.name ?? 'Drop');
      const name  = esc(item.name ?? '—');
      const css   = (label === 'Infusión destacada') ? 'tag--inf' : 'tag--drop';
      return `
        <div class="m-foot" data-tip="${tipAttr}">
          <span class="m-tag ${css}">${label}</span>
          <span class="m-item">${icon}<span class="m-item__name">${name}</span></span>
        </div>
      `;
    }

    const nameFromList = listFromExt.length ? esc(listFromExt[0].itemName ?? '—') : '—';
    const label = labelByItemOrName(null, nameFromList);
    const css   = (label === 'Infusión destacada') ? 'tag--inf' : 'tag--drop';
    return `
      <div class="m-foot" data-tip="${tipAttr}">
        <span class="m-tag ${css}">${label}</span>
        <span class="m-item"><span class="m-item__name">${nameFromList}</span></span>
      </div>
    `;
  }

  // ---------- NUEVO: chips y color por expansión ----------
  function expKeyOf(meta){
    const raw = String(meta.expansion ?? '').toLowerCase().trim();
    return EXP_MAP[raw] ?? raw.replace(/\s+/g,'');
  }
  function expTintColor(meta){
    const k = expKeyOf(meta);
    return EXP_TINT[k] || '#e9e9f1';
  }

  // >>> MOD: chip (recuadro) por expansión con logo + clase específica
  function chipForExp(meta){
    const k = expKeyOf(meta);
    const cls = `meta-chip meta-chip--exp meta-chip--${k}`;
    const label = String(meta.expansion || '—');
    const url = EXP_ICON[k] || '';
    if (url) {
      // img + title para accesibilidad; sin texto redundante
      return `<span class="${cls}" title="Expansión / Temporada: ${esc(label)}" aria-label="Expansión / Temporada: ${esc(label)}">${iconTag(url, 16, label)}</span>`;
    }
    // Fallback textual si aún no definiste el logo
    return `<span class="${cls}" title="Expansión / Temporada: ${esc(label)}" aria-label="Expansión / Temporada: ${esc(label)}">${esc(label)}</span>`;
  }

  function chipsForTiming(inst, minsRemaining){
    if(inst.state === 'active'){
      return [
        '<span class="meta-chip">Activo</span>',
        `<span class="meta-chip">Termina en ${minsRemaining} min</span>`
      ];
    }
    if(minsRemaining != null){
      return [
        '<span class="meta-chip">Más tarde</span>',
        `<span class="meta-chip">Próximo en ${minsRemaining} min</span>`
      ];
    }
    return ['<span class="meta-chip">Más tarde</span>'];
  }

  // ---------- Render ----------
  function cardHTML(meta, inst, item, isFav){
    const now = nowLocal();
    const minsRemaining = inst?.nextAt ? Math.max(1, Math.floor((inst.nextAt - now)/60000)) : null;

    const dt = doneTodayDetail(meta);
    const when = accountFlags.lastHuman || '—';
    const srcTxt = dt.src
      ? (dt.src === 'worldbosses' ? 'worldbosses' : (dt.src === 'mapchests' ? 'mapchests' : 'manual'))
      : '—';
    const manualEligible = isManualEligible(meta);

    const doneTitle = dt.done
      ? `Hecho hoy (fuente: ${srcTxt}; actualizado ${when})${manualEligible ? ' — Click para desmarcar' : ''}`
      : manualEligible
        ? `No hecho hoy (fuente: ${srcTxt}) — Click para marcar manualmente`
        : `No hecho hoy (fuente: ${srcTxt}; actualizado ${when})`;

    // Estado al estilo WV (verde/amarillo)
    const doneAttrs = manualEligible
      ? `data-manual="1" data-id="${meta.id}" role="button" tabindex="0" aria-pressed="${dt.done?'true':'false'}"`
      : '';
    const statusHtml = dt.done
      ? `<span class="meta-status meta-status--done" ${doneAttrs} title="${esc(doneTitle)}">✅ Hecho hoy</span>`
      : `<span class="meta-status meta-status--pending" ${doneAttrs} title="${esc(doneTitle)}">Pendiente</span>`;

    // Acciones (wiki/mapa/compartir/horarios)
    const wikiHtml = meta.wiki
      ? `<a class="m-wiki" href="${esc(meta.wiki)}" target="_blank" rel="noopener">Wiki</a>`
      : '';

    const mapHref = meta.map ? `https://maps.gw2.io/#/?q=${encodeURIComponent(meta.map)}` : '';
    const mapBtn  = mapHref
      ? `<a class="btn btn--ghost m-map" href="${mapHref}" target="_blank" rel="noopener" title="Abrir mapa (gw2.io)">Mapa</a>`
      : '';
    const shareBtn = `<button class="btn btn--ghost m-share" data-id="${meta.id}" title="Copiar texto para compartir">Compartir</button>`;

    const hasWins = Array.isArray(meta.windowsUTC) && meta.windowsUTC.length>0;
    const winBtn  = hasWins ? `<button class="btn btn--ghost m-win__toggle" aria-expanded="false" title="Ver horarios">Horarios</button>` : '';
    const winPane = hasWins ? buildWindowsChips(meta) : '';

    const ctx = buildContext(meta);
    const ctxHtml = ctx ? `<div class="m-context">${esc(ctx)}</div>` : '';

    // Botón pin (en lugar de estrella)
    const pinBtn = `<button class="wv-pin ${isFav?'wv-pin--active':''}" data-pin="${meta.id}" aria-pressed="${isFav?'true':'false'}" title="${isFav?'Desfijar':'Fijar'}">📌</button>`;

    // Chips (expansión [logo], timing)
    const chips = [ chipForExp(meta), ...chipsForTiming(inst, minsRemaining) ].join('');

    // Tinte de título por expansión
    const tint = expTintColor(meta);
    const styleTint = tint ? ` style="--meta-title-color:${tint}"` : '';

    // >>> MOD: Línea secundaria SIN el pill textual de "expansión"
    const subLine = `
      <div class="meta-tags">
        <span class="meta-pill">${meta.map ? esc(meta.map) : '—'}</span>
        <span class="meta-pill">${esc(meta.type)}</span>
        ${statusHtml}
      </div>
    `;

    // Acciones
    const actions = `
      <div class="meta-linkbar">
        ${meta.chat ? `<button class="btn btn--ghost m-copy" data-copy="${esc(meta.chat)}" title="Copiar waypoint" aria-label="Copiar waypoint">${wpIcon(16)}</button>` : ''}
        ${wikiHtml}
        ${mapBtn}
        ${shareBtn}
        ${winBtn}
      </div>
    `;

    // Footer drops (con imagen/tooltip)
    const foot = footerDropHTML(meta, item);

    // Estructura final (conserva .m-card para compat)
    return `
      <article class="m-card meta-card meta-card--tint-title" data-id="${meta.id}" data-type="${esc(meta.type)}" data-exp="${esc(meta.expansion)}"${styleTint}>
        <div class="meta-card__top">
          <div>
            <div class="meta-card__title">${esc(meta.name)}</div>
            <div class="meta-card__subtitle">${chips}</div>
          </div>
            ${pinBtn}
        </div>

        <div class="meta-sep"></div>

        <div class="meta-body">
          ${subLine}
          ${ctxHtml}
          ${actions}
          ${winPane}
        </div>

        <div class="meta-sep"></div>

        <div class="meta-footer">
          ${foot}
        </div>
      </article>`;
  }

  function computeAllInstances(){
    return seed.map(m => ({ meta:m, inst:buildInstance(m), fav:favs.has(m.id) }));
  }
  const minutesDiff = (d) => Math.max(0, Math.floor((d - nowLocal())/60000));

  function buildWindowsChips(meta){
    const list = Array.isArray(meta.windowsUTC) ? meta.windowsUTC : [];
    if (!list.length) return '';
    const now = nowLocal();
    const chips = list.map(hhmm => {
      const start = localDateFromUTC_HHMM(hhmm);
      const end   = new Date(start.getTime() + (meta.durationMin ?? 15)*60000);
      let cls = 'chip chip--ghost';
      if (now >= start && now < end) cls += ' chip--now';
      else {
        const diffMin = Math.floor((start - now)/60000);
        if (diffMin >=0 && diffMin <= SOON_MIN) cls += ' chip--soon';
      }
      return `<span class="${cls}" title="Ventana ${hhmm} UTC">${hhmm}</span>`;
    }).join('');
    return `<div class="m-win" hidden><div class="chips">${chips}</div></div>`;
  }

  function renderMiniNext(rowsRaw){
    if(!el.miniNext) return;
    const list = rowsRaw
      .map(r => ({...r, nextAt:r.inst.nextAt ?? null}))
      .filter(r => !!r.nextAt)
      .sort((a,b) => a.nextAt.getTime() - b.nextAt.getTime())
      .slice(0,3);

    if(!list.length){
      el.miniNext.innerHTML = `<li class="muted">Sin próximas metas en la ventana actual</li>`;
      return;
    }

    const html = list.map(r=>{
      const mins = minutesDiff(r.nextAt);
      const nextTxt = (r.inst.state==='active') ? '¡Activo!' : `En ${mins} min`;
      const copyBtn = r.meta.chat ? `<button class="btn btn--ghost meta-mini_copy" data-copy="${esc(r.meta.chat)}" title="Copiar waypoint" aria-label="Copiar waypoint">${wpIcon(14)}</button>` : '';
      return `
        <li class="meta-mini">
          <div class="meta-mini__top">
            <span class="meta-mini__name">${esc(r.meta.name)}</span>
            <span class="meta-mini__next">${nextTxt}</span>
          </div>
          <div class="meta-mini__sub">
            <span>${r.meta.map ? esc(r.meta.map) : '—'}</span>
            <span>•</span>
            <span>${esc(r.meta.expansion)}</span>
          </div>
          <div class="meta-mini__actions">
            ${copyBtn}
            <button class="btn meta-mini_focus" data-id="${r.meta.id}">Ver</button>
          </div>
        </li>`;
    }).join('');

    el.miniNext.innerHTML = html;

    // Bind acciones del Top 3
    $$('.meta-mini_copy', el.miniNext).forEach(b=>{
      b.addEventListener('click', ()=>{
        const v=b.getAttribute('data-copy') ?? '';
        if(!v) return;
        navigator.clipboard.writeText(v).then(()=>{
          setStatus('Copiado al portapapeles.','ok');
          if (typeof toast === 'function' && toast.legacy) toast.legacy('Copiado al portapapeles','ok', 1600);
          else if (typeof toast === 'function') toast('success','Copiado al portapapeles',{ttl:1600});
        });
      });
    });
    $$('.meta-mini_focus', el.miniNext).forEach(b=>{
      b.addEventListener('click', ()=>{
        const id=b.getAttribute('data-id');
        if(!id) return;
        const n = $(`.m-card[data-id="${id}"]`, el.list) || $(`.m-card[data-id="${id}"]`, el.favGrid);
        if(n) n.scrollIntoView({behavior:'smooth', block:'center'});
      });
    });
  }

  // ---------- Render principal ----------
  async function render(){
    if(!el.list) return;

    readFilters();
    const rowsRaw = computeAllInstances();

    // Filtros
    let rows = rowsRaw;
    if(filters.type)       rows = rows.filter(r => r.meta.type===filters.type);
    if(filters.exp)        rows = rows.filter(r => r.meta.expansion===filters.exp);
    if(filters.onlyActive) rows = rows.filter(r => r.inst.state==='active');
    if(filters.onlySoon)   rows = rows.filter(r => r.inst.state==='soon');
    if(filters.onlyInf)    rows = rows.filter(r => isInfusionMeta(r.meta));

    // Orden (fijados primero, luego estado, luego proximidad)
    const rankState = (s) => s==='active'?0 : (s==='soon'?1:2);
    rows.sort((a,b)=>{
      if(a.fav!==b.fav) return a.fav? -1 : 1;
      const rs = rankState(a.inst.state) - rankState(b.inst.state);
      if(rs!==0) return rs;
      const an = a.inst.nextAt? a.inst.nextAt.getTime() : Infinity;
      const bn = b.inst.nextAt? b.inst.nextAt.getTime() : Infinity;
      return an - bn;
    });

    // Resolver items para drops
    const ids     = [...new Set(rows.map(x=>x.meta.highlightItemId).filter(Boolean))];
    const missing = ids.filter(id => !itemCache.has(id));
    if(missing.length) await batchItems(missing);

    // Fijados (máx. 6)
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

    // Resto
    const rest = rows.filter(r=>!r.fav);
    el.list.innerHTML = rest
      .map(r=>cardHTML(r.meta, r.inst, itemCache.get(r.meta.highlightItemId), false))
      .join('');

    // Acciones de tarjeta
    // Copiar WP
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

    // PIN (reemplaza estrella). Mantengo límite 6 fijados
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

    // ✔ manual (con aria-pressed) — soporta selector viejo (.m-done) y nuevo (.meta-status)
    $$('.m-done[data-manual="1"], .meta-status[data-manual="1"]', el.panel).forEach(x=>{
      const id = x.getAttribute('data-id');
      if(!id) return;
      x.addEventListener('click', ()=>{
        const meta = seed.find(m => m.id===id);
        if(!meta) return;
        const state = toggleManual(meta);
        x.setAttribute('aria-pressed', String(state));
        setStatus(state ? 'Marcado como “Hecho hoy” (manual).' : 'Desmarcado (manual).','ok');
        render();
      });
      x.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' || e.key===' ') { e.preventDefault(); x.click(); }
      });
    });

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

    // Tooltips de infusión
    bindInfusionPreviews();

    // TS visible (API)
    if(el.flagsTs){
      el.flagsTs.textContent = `Actualizado ${accountFlags.lastHuman || '—'}`;
      el.flagsTs.title = `Última actualización de 'Hecho hoy': ${accountFlags.lastHuman || '—'}`;
    }
  }

  // ---------- Reloj + Auto-refresh UTC ----------
  let clockT = null;
  let midnightTimer = null;

  function scheduleMidnightAutoRefresh(){
    clearTimeout(midnightTimer);
    const delta = nextResetUTC().getTime() - Date.now();
    if(delta > 0 && delta < 36*3600*1000){
      midnightTimer = setTimeout(async ()=>{
        // >>> usar el pipeline con control de concurrencia
        await window.Meta.refresh({ token: window.__GN__?.getSelectedToken?.() ?? null, nocache: true });
        manualDoneSet = loadManualDone();
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
  async function refreshAccountFlags(force=false, opts = {}){
    const token = opts.token ?? (window.__GN__?.getSelectedToken?.() ?? null);

    if(!token){
      accountFlags = { worldbosses:new Set(), mapchests:new Set(), lastTs:0, lastHuman:'—' };
      if(el.flagsTs) el.flagsTs.textContent = 'Actualizado —';
      return;
    }

    if(!force){
      const cached = loadFlagsFromCache(token);
      if(cached){
        accountFlags = cached;
        return;
      }
    }

    // Concurrencia: abortar petición anterior y marcar secuencia
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

      // Si llegó una respuesta vieja, la descartamos (última gana)
      if (seq !== _flagsSeq || _flagsAbort.signal.aborted) return;

      accountFlags.worldbosses = wb;
      accountFlags.mapchests   = mc;
      accountFlags.lastTs      = Date.now();
      accountFlags.lastHuman   = fmtLocalTime(new Date(accountFlags.lastTs));
      saveFlagsToCache(token);
      setStatus('Listo.','ok');
    }catch(e){
      if (e?.name === 'AbortError') return; // fue reemplazada por otra actualización: OK
      console.warn('[meta] account flags', e);
      setStatus('No se pudo actualizar "Hecho hoy".','error');
    }
  }

  // ---------- Deluxe toggles ----------
  function setDeluxe(on){ BODY.setAttribute('data-meta-deluxe', on ? 'on' : 'off'); }
  function setCompact(on){ BODY.setAttribute('data-meta-compact', on ? 'on' : 'off'); }
  function injectUIToggles(){
    const actions = $('#metaPanel .filters-actions');
    if(!actions) return;
    if(actions.querySelector('#metaToggleDeluxe')) return;

    const btnDeluxe = document.createElement('button');
    btnDeluxe.id = 'metaToggleDeluxe';
    btnDeluxe.className = 'btn btn--ghost';
    btnDeluxe.type = 'button';
    btnDeluxe.title = 'Alternar Modo Deluxe / Clásico';
    btnDeluxe.textContent = (BODY.getAttribute('data-meta-deluxe')==='on') ? 'Modo: Deluxe' : 'Modo: Clásico';

    const btnCompact = document.createElement('button');
    btnCompact.id = 'metaToggleCompact';
    btnCompact.className = 'btn btn--ghost';
    btnCompact.type = 'button';
    btnCompact.title = 'Alternar Vista compacta / detallada';
    btnCompact.textContent = (BODY.getAttribute('data-meta-compact')==='on') ? 'Vista detallada' : 'Vista compacta';

    btnDeluxe.addEventListener('click', ()=>{
      const nowOn = BODY.getAttribute('data-meta-deluxe')!=='on';
      setDeluxe(nowOn);
      btnDeluxe.textContent = nowOn ? 'Modo: Deluxe' : 'Modo: Clásico';
      localStorage.setItem(LS_META_DELUXE, nowOn ? 'on' : 'off');
      render();
    });
    btnCompact.addEventListener('click', ()=>{
      const nowOn = BODY.getAttribute('data-meta-compact')!=='on';
      setCompact(nowOn);
      btnCompact.textContent = nowOn ? 'Vista detallada' : 'Vista compacta';
      localStorage.setItem(LS_META_COMPACT, nowOn ? 'on' : 'off');
      render();
    });

    actions.appendChild(btnDeluxe);
    actions.appendChild(btnCompact);
  }

  // ---------- Tooltips de infusiones ----------
  function bindInfusionPreviews(){
    // Limpiar previos
    document.querySelectorAll('.inf-prev').forEach(n=>n.remove());

    const cards = Array.from(document.querySelectorAll('.m-card'));
    for (const card of cards) {
      const id = card.getAttribute('data-id');
      const meta = seed.find(m => m.id === id);
      if (!meta) continue;
      if (!isInfusionMeta(meta)) continue;

      const target = card.querySelector('.m-foot .m-item');
      if (!target) continue;

      let preview = '';
      if (Array.isArray(meta._extItems) && meta._extItems.length && meta._extItems[0].preview) {
        preview = meta._extItems[0].preview;
      } else if (meta.highlightItemId && itemCache.has(meta.highlightItemId)) {
        preview = itemCache.get(meta.highlightItemId)?.icon ?? '';
      }
      if (!preview) continue;

      let pop = null, hideT = null;

      function position(e){
        if (!pop) return;
        const pageX = e?.pageX ?? (target.getBoundingClientRect().left + window.scrollX + 12);
        const pageY = e?.pageY ?? (target.getBoundingClientRect().top + window.scrollY - 12);
        const x = Math.max(8, pageX + 14);
        const y = Math.max(8, pageY - (pop.offsetHeight + 16));
        pop.style.left = `${x}px`;
        pop.style.top  = `${y}px`;
      }

      function show(e){
        clearTimeout(hideT);
        if (pop) pop.remove();
        pop = document.createElement('div');
        pop.className = 'inf-prev';
        const a = document.createElement('img');
        a.src = preview;
        a.alt = 'Preview de infusión';
        a.decoding = 'async';
        a.referrerPolicy = 'no-referrer';
        pop.appendChild(a);
        document.body.appendChild(pop);
        position(e);
        requestAnimationFrame(() => pop.classList.add('on'));
      }

      function hide(){
        hideT = setTimeout(() => {
          if (pop) {
            pop.classList.remove('on');
            setTimeout(() => pop && pop.remove(), 120);
          }
        }, 90);
      }

      target.addEventListener('mouseenter', show);
      target.addEventListener('mousemove', position);
      target.addEventListener('mouseleave', hide);
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

      // >>> primer pass de flags (usa cache si hay)
      await refreshAccountFlags(false, { token: window.__GN__?.getSelectedToken?.() ?? null });

      manualDoneSet = loadManualDone();
      setDeluxe(DELUXE_DEFAULT);
      setCompact(COMPACT_DEFAULT);
      injectUIToggles();

      setStatus('Listo.','ok');
      startClock();
      render();

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

  // ---------- API pública (refresh con single-flight) ----------
  window.Meta = window.Meta || {};
  window.Meta.refresh = async function metaRefresh({ token, nocache = false } = {}){
    try {
      await refreshAccountFlags(!!nocache, { token: token ?? (window.__GN__?.getSelectedToken?.() ?? null) });
      manualDoneSet = loadManualDone();
      await render();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('[Meta.refresh] error', e);
    }
  };

  // ---------- Eventos del shell ----------
  let inited=false;

  // Navegación por tabs (legacy)
  document.addEventListener('gn:tabchange', (ev) => {
    if (ev.detail?.view === 'meta' && !inited) {
      inited = true;
      initOnce();   // inicializa el panel MetaEventos
    }
  });

  // Filtros
  ['change','input'].forEach(ev=>{
    el.type?.addEventListener(ev, render);
    el.exp?.addEventListener(ev, render);
    el.onlyActive?.addEventListener(ev, render);
    el.onlySoon?.addEventListener(ev, render);
  });
  el.onlyInf?.addEventListener('change', render);

  // Refrescar estado manual
  el.refreshFlagsBtn?.addEventListener('click', async ()=>{
    const old = el.refreshFlagsBtn.textContent;
    try{
      el.refreshFlagsBtn.disabled = true;
      el.refreshFlagsBtn.textContent = 'Actualizando…';

      // >>> canal único de refresco (single-flight)
      await window.Meta.refresh({ token: window.__GN__?.getSelectedToken?.() ?? null, nocache: true });

      if (typeof toast === 'function' && toast.legacy) toast.legacy('Estado “Hecho hoy” actualizado','ok', 1400);
      else if (typeof toast === 'function') toast('success','Estado “Hecho hoy” actualizado', { ttl:1400 });
    }finally{
      el.refreshFlagsBtn.disabled = false;
      el.refreshFlagsBtn.textContent = old;
    }
  });

  /* === Auto-refresh Meta & Eventos al cambiar de API Key (Opción A) === */
  (function () {
    // Evitamos registrar múltiples veces si meta.js se evalúa de nuevo.
    var FLAG = '__gn_meta_autorefresh_wired__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    document.addEventListener('gn:meta-refresh', function (ev) {
      try {
        // Feedback inmediato
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

        // >>> canal único de refresco (single-flight)
        window.Meta.refresh({ token: token, nocache: true });

      } catch (e) {
        console.warn('[Meta] auto-refresh error:', e);
      }
    });
  })();

})();