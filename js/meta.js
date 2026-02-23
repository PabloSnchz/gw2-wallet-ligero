/* eslint-disable no-console */
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  console.info('%cMetaEventos meta.js v2.5.0','color:#fb0; font-weight:700');

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
    miniNext:   $('#metaMiniNext')
  };

  // --------- Constantes / Estado ----------
  const LS_FAVS  = 'gw2_meta_favs';
  const SOON_MIN = 20;

  // Normalización para badge de expansión (coincide con CSS)
  const EXP_MAP = {
    'core': 'core', 'core tyria': 'core',
    'hot': 'hot', 'heart of thorns': 'hot',
    'pof': 'pof', 'path of fire': 'pof',
    'eod': 'eod', 'end of dragons': 'eod',
    'soto': 'soto', 'secrets of the obscure': 'soto',
    'ls4': 'livingworlds4', 'living world s4': 'livingworlds4',
    'living world season 4': 'livingworlds4', 'livingworlds4': 'livingworlds4',
    'janthir': 'janthir'
  };

  let seed = [];                   // metas (desde assets/meta-events.json)
  let favs = new Set();            // favoritos (ids)
  let filters = {                  // filtros actuales
    type: '', exp: '',
    onlyActive: false, onlySoon: false, onlyInf: false
  };
  let accountFlags = {             // banderas de cuenta (completado hoy)
    worldbosses: new Set(),
    mapchests:   new Set(),
    lastTs:      0
  };

  // --------- Utilidades ----------
  function setStatus(msg, kind='info'){
    if(!el.status) return;
    el.status.textContent = msg;
    el.status.style.color = (kind==='error') ? '#f28b82' : '#a0a0a6';
  }

  const nowLocal = () => new Date();
  const pad2 = (n) => String(n).padStart(2,'0');
  const fmtLocalTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const minutesTo = (d) => Math.floor((d - nowLocal())/60000);

  function nextResetUTC(){
    const n = new Date();
    const reset = new Date(n);
    reset.setUTCHours(24,0,0,0); // próximo 00:00 UTC
    return reset;
  }

  function updateClock(){
    if (!el.localTime || !el.reset) return; // FIX condición
    el.localTime.textContent = fmtLocalTime(new Date());
    const mins = minutesTo(nextResetUTC());
    const hh = Math.max(0, Math.floor(mins/60));
    const mm = Math.max(0, mins%60);
    el.reset.textContent = `Próximo reset en ${pad2(hh)}:${pad2(mm)} h`;
  }

  // --------- Carga de datos (seed + drops) ----------
  let externalDrops = new Map();

  async function loadExternalDrops(){
    try{
      // Alineado a 2.5.0 para coherencia de cache-bust
      const r = await fetch('assets/meta-drops.json?v=2.5.0', { headers:{'Accept':'application/json'} });
      if(!r.ok) return;
      const arr = await r.json();
      // Map por metaId
      externalDrops = new Map(arr.map(x => [String(x.metaId ?? '').trim(), x]));
    }catch(e){
      console.warn('[meta] meta-drops.json no disponible', e);
    }
  }

  async function loadSeed(){
    // Alineado a 2.5.0 para coherencia de cache-bust
    const r = await fetch('assets/meta-events.json?v=2.5.0', { headers:{'Accept':'application/json'} });
    if(!r.ok) throw new Error('No se pudo cargar meta-events.json');
    seed = await r.json();
    await loadExternalDrops();

    // Merge: seed + externalDrops (mantener semántica de "anular con null" si corresponde)
    seed = seed.map(m => {
      const ext = externalDrops.get(m.id);
      if(!ext) return m;
      const merged = { ...m };
      if (Object.prototype.hasOwnProperty.call(ext, 'highlightItemId')) {
        // Mantener semántica actual: si viene null, ANULA el seed.
        merged.highlightItemId = ext.highlightItemId;
      }
      if (Array.isArray(ext.items)) merged._extItems = ext.items;
      return merged;
    });
  }

  // --------- Persistencia de favoritos ----------
  function loadFavs(){
    try{
      favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS)) ?? []);
    }catch{
      favs = new Set();
    }
  }
  function saveFavs(){
    try{
      localStorage.setItem(LS_FAVS, JSON.stringify([...favs]));
    }catch{}
  }

  // --------- API GW2: banderas de cuenta ----------
  async function fetchWorldBosses(token){
    if(!token) return new Set();
    const url = `https://api.guildwars2.com/v2/account/worldbosses?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { headers:{'Accept':'application/json'} });
    if(r.status===401 || r.status===403) return new Set();
    const arr = await r.json().catch(() => []);
    return new Set(Array.isArray(arr) ? arr : []);
  }
  async function fetchMapChests(token){
    if(!token) return new Set();
    const url = `https://api.guildwars2.com/v2/account/mapchests?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { headers:{'Accept':'application/json'} });
    if(r.status===401 || r.status===403) return new Set();
    const arr = await r.json().catch(() => []);
    return new Set(Array.isArray(arr) ? arr : []);
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

  function iconTag(url, size=18, alt=''){
    const u = String(url ?? '').trim();
    if(!/^https?:\/\//i.test(u)) return '';
    const safe = u.replace(/"/g,'&quot;');
    const a    = (alt ?? '').replace(/"/g,'&quot;');
    return `<img src="${safe}" alt="${a}" width="${size}" height="${size}" loading="lazy" decoding="async" style="vertical-align:middle;border-radius:3px">`;
  }

  function wpIcon(size=16){
  // Ícono waypoint estilo “diamante” azul, sin dependencias externas
    const url = "https://wiki.guildwars2.com/images/d/d2/Waypoint_(map_icon).png";
  return `<img src="${url}" width="${size}" height="${size}" 
              alt="Waypoint" loading="lazy" decoding="async"
              referrerpolicy="no-referrer" />`;
  }

  // --------- Instancias y estado temporal ----------
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
      // próximo ciclo: sumar 24h al primero
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

  function doneToday(meta){
    if(meta.api?.worldBossId && accountFlags.worldbosses.has(meta.api.worldBossId)) return true;
    if(meta.api?.mapChestId  && accountFlags.mapchests.has(meta.api.mapChestId))   return true;
    return false;
  }

  function stateBadge(s){
    if(s==='active') return `<span class="m-badge m-badge--active">Activo</span>`;
    if(s==='soon')   return `<span class="m-badge m-badge--soon">Próximo</span>`;
    return `<span class="m-badge">Más tarde</span>`;
  }

  // ---------- Heurística Infusiones ----------
  const INFUSION_WHITELIST = new Set([
    // inglés
    'echo of the dragonvoid','winter\'s heart infusion','frost legion infusion','queen bee infusion',
    'liquid aurillium infusion','chak infusion','festive confetti infusion','crystal infusion',
    // español
    'infusión de corazón del invierno','infusión de la legión de escarcha','infusión de la reina abeja',
    'infusión de aurilio líquido','infusión chak','infusión festiva de confeti','infusión de cristal'
  ]);

  function isInfusionItemObj(item){
    try{
      if(!item || typeof item!=='object') return false;
      if(item?.details?.infusion_upgrade_flags?.includes('Infusion')) return true;
      if(item?.type === 'UpgradeComponent') return true;
      return false;
    }catch{ return false; }
  }

  function isInfusionNameOrWhitelist(name){
    const n = String(name ?? '').toLowerCase();
    return n.includes('infusión') || n.includes('infusion') || INFUSION_WHITELIST.has(n);
  }

  function labelByItemOrName(item, fallbackName){
    if(isInfusionItemObj(item)) return 'Infusión destacada';
    if(isInfusionNameOrWhitelist(fallbackName)) return 'Infusión destacada';
    return 'Drop destacado';
  }

  function isInfusionMeta(meta){
    // 1) Si ya resolvimos item por API, usamos la verdad del objeto
    if (meta.highlightItemId && itemCache.has(meta.highlightItemId)) {
      return isInfusionItemObj(itemCache.get(meta.highlightItemId));
    }
    // 2) Si no, inferimos por nombre whitelisteado / "infusion"
    const n = Array.isArray(meta._extItems) && meta._extItems.length ? (meta._extItems[0].itemName ?? '') : '';
    return isInfusionNameOrWhitelist(n);
  }

  function footerDropHTML(meta, item){
    // Lista extendida para tooltip (si existe)
    const listFromExt = Array.isArray(meta._extItems) ? meta._extItems : [];
    const tipText = (listFromExt.length
      ? listFromExt.map(it => `• ${it.itemName ?? '—'}${it.wiki ? `\n ${it.wiki}` : ''}`).join('\n')
      : (item && item.name ? `• ${item.name}` : '—')
    );
    const tipAttr = String(tipText ?? '').replace(/"/g,'&quot;');

    // Con itemId resuelto (icono + nombre)
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
      const name  = item.name ?? '—';
      const css   = (label === 'Infusión destacada') ? 'tag--inf' : 'tag--drop';
      return `
        <div class="m-foot" data-tip="${tipAttr}">
          <span class="m-tag ${css}">${label}</span>
          <span class="m-item">${icon}<span class="m-item__name">${name}</span></span>
        </div>
      `;
    }

    // Sin itemId: usar nombre desde meta-drops.json (texto plano + tooltip)
    const nameFromList = listFromExt.length ? (listFromExt[0].itemName ?? '—') : '—';
    const label = labelByItemOrName(null, nameFromList);
    const css   = (label === 'Infusión destacada') ? 'tag--inf' : 'tag--drop';
    return `
      <div class="m-foot" data-tip="${tipAttr}">
        <span class="m-tag ${css}">${label}</span>
        <span class="m-item"><span class="m-item__name">${nameFromList}</span></span>
      </div>
    `;
  }

  // ---------- Render ----------
  function cardHTML(meta, inst, item, isFav){
    const now = nowLocal();
    const minsRemaining = inst?.nextAt ? Math.max(1, Math.floor((inst.nextAt - now)/60000)) : null;
    const nextTxt = (inst?.state==='active')
      ? `Termina en ${minsRemaining} min`
      : (minsRemaining!=null ? `Próximo en ${minsRemaining} min` : '—');

    const done = doneToday(meta);
    const star = `<button class="m-star ${isFav?'m-star--on':''}" data-pin="${meta.id}" title="${isFav?'Quitar de favoritos':'Añadir a favoritos'}">★</button>`;
    const doneHtml = `<span class="m-done ${done?'m-done--on':''}" title="Hecho hoy">${done?'✔':'—'}</span>`;
    const wikiHtml = meta.wiki ? `<a class="m-wiki" href="${meta.wiki}" target="_blank" rel="noopener">🔗 Wiki</a>` : '';

    // Badge de expansión (normalizada)
    const rawExp = String(meta.expansion ?? '').toLowerCase().trim();
    const expKey = EXP_MAP[rawExp] ?? rawExp.replace(/\s+/g,'');
    const expClass = `badge-exp badge-exp--${expKey}`;
    const expBadgeHtml = `<span class="${expClass}" title="Expansión / Temporada: ${meta.expansion}">${meta.expansion}</span>`;

    return `
      <article class="m-card" data-id="${meta.id}">
        ${star}
        <header class="m-head">
          <h3 class="m-title">${meta.name}</h3>
          <div class="m-right">
            ${expBadgeHtml}
            ${stateBadge(inst.state)}
            <span class="m-next">${nextTxt}</span>
          </div>
        </header>
        <div class="m-sub">
          <span class="m-map">${meta.map ?? '—'}</span>
          <span class="m-sep">•</span>
          <span class="m-exp">${meta.expansion}</span>
          <span class="m-sep">•</span>
          <span class="m-type">${meta.type}</span>
          <span class="m-sep">•</span>
          ${doneHtml}
        </div>
        <div class="m-actions">
          ${meta.chat ? `<button class="btn btn--ghost m-copy" data-copy="${meta.chat}" title="Copiar waypoint" aria-label="Copiar waypoint">${wpIcon(16)}</button>` : ''}
          ${wikiHtml}
        </div>
        ${footerDropHTML(meta, item)}
      </article>`;
  }

  function computeAllInstances(){
    return seed.map(m => ({ meta:m, inst:buildInstance(m), fav:favs.has(m.id) }));
  }

  function minutesDiff(d){
    return Math.max(0, Math.floor((d - nowLocal())/60000));
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
      const copyBtn = r.meta.chat ? `<button class="btn btn--ghost meta-mini_copy" data-copy="${r.meta.chat}" title="Copiar waypoint" aria-label="Copiar waypoint">${wpIcon(14)}</button>` : '';
      return `
        <li class="meta-mini">
          <div class="meta-mini__top">
            <span class="meta-mini__name">${r.meta.name}</span>
            <span class="meta-mini__next">${nextTxt}</span>
          </div>
          <div class="meta-mini__sub">
            <span>${r.meta.map ?? '—'}</span>
            <span>•</span>
            <span>${r.meta.expansion}</span>
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
        navigator.clipboard.writeText(v).then(()=> setStatus('Copiado al portapapeles.','ok'));
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

    // Orden: favoritos, estado (active > soon > later), proximidad de nextAt
    const rankState = (s) => s==='active'?0 : (s==='soon'?1:2);
    rows.sort((a,b)=>{
      if(a.fav!==b.fav) return a.fav? -1 : 1;
      const rs = rankState(a.inst.state) - rankState(b.inst.state);
      if(rs!==0) return rs;
      const an = a.inst.nextAt? a.inst.nextAt.getTime() : Infinity;
      const bn = b.inst.nextAt? b.inst.nextAt.getTime() : Infinity;
      return an - bn;
    });

    // Resolver items faltantes (para iconos/nombres de drops)
    const ids     = [...new Set(rows.map(x=>x.meta.highlightItemId).filter(Boolean))];
    const missing = ids.filter(id => !itemCache.has(id));
    if(missing.length) await batchItems(missing);

    // Favoritos (máx. 6 en bloque)
    const favRows = rows.filter(r=>r.fav).slice(0,6);
    if(favRows.length){
      el.favBlock?.removeAttribute('hidden');
      el.favGrid.innerHTML = favRows.map(r=>cardHTML(r.meta, r.inst, itemCache.get(r.meta.highlightItemId), true)).join('');
    }else{
      el.favBlock?.setAttribute('hidden','');
      el.favGrid.innerHTML='';
    }

    // Resto
    const rest = rows.filter(r=>!r.fav);
    el.list.innerHTML = rest.map(r=>cardHTML(r.meta, r.inst, itemCache.get(r.meta.highlightItemId), false)).join('');

    // Acciones de tarjeta
    $$('.m-copy', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const v = btn.getAttribute('data-copy') ?? '';
        if(!v) return;
        navigator.clipboard.writeText(v).then(()=> setStatus('Copiado al portapapeles.','ok'));
      });
    });
    $$('.m-star', el.panel).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-pin');
        if(!id) return;
        if(favs.has(id)){
          favs.delete(id);
        }else{
          if(favs.size>=6){
            if(!confirm('Ya tenés 6 favoritos. ¿Reemplazar alguno?')) return;
            const last=[...favs][favs.size-1]; favs.delete(last);
          }
          favs.add(id);
        }
        saveFavs();
        render();
      });
    });

    // Sidebar Top 3
    renderMiniNext(rowsRaw);

    // Tooltips de infusiones (debe correrse DESPUÉS del render)
    bindInfusionPreviews();
  }

  // ---------- Reloj ----------
  let clockT = null;
  function startClock(){
    if(clockT) return;
    updateClock();
    clockT = setInterval(updateClock, 1000);
  }

  // ---------- Flags de cuenta (al cambiar token) ----------
  async function refreshAccountFlags(){
    const token = window.__GN__?.getSelectedToken?.() ?? null;
    try{
      const [wb, mc] = await Promise.all([ fetchWorldBosses(token), fetchMapChests(token) ]);
      accountFlags.worldbosses = wb;
      accountFlags.mapchests   = mc;
      accountFlags.lastTs      = Date.now();
    }catch(e){
      console.warn('[meta] account flags', e);
    }
  }

  // ---------- Inicialización ----------
  async function initOnce(){
    if(!el.panel) return;
    try{
      setStatus('Cargando MetaEventos…');
      loadFavs();
      await loadSeed();
      await refreshAccountFlags();
      setStatus('Listo.','ok');
      startClock();
      render();

      // Auto-chequeo básico (debug no intrusivo)
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
    }
  }

  // ---------- Eventos del shell (app.js) ----------
  let inited=false;

  // Navegación por tabs: solo inicializar la PRIMERA vez que entramos a Meta
  document.addEventListener('gn:tabchange', (ev)=>{
    if(ev.detail?.view==='meta' && !inited){
      inited=true;
      initOnce();
    }
  });

  // Caso borde: si el panel ya está visible por defecto
  if($('#metaPanel') && !$('#metaPanel').hasAttribute('hidden')){
    inited=true; initOnce();
  }

  // Cambio de token (refrescar flags y re-render)
  document.addEventListener('gn:tokenchange', async ()=>{
    if(!inited) return;
    await refreshAccountFlags();
    render();
  });

  // Filtros
  ['change','input'].forEach(ev=>{
    el.type?.addEventListener(ev, render);
    el.exp?.addEventListener(ev, render);
    el.onlyActive?.addEventListener(ev, render);
    el.onlySoon?.addEventListener(ev, render);
    el.onlyInf?.addEventListener('change', render);
  });

  // ---------- Tooltips de infusiones (deben correr después del render) ----------
  function bindInfusionPreviews(){
    // Limpiar previos si re-renderizamos
    document.querySelectorAll('.inf-prev').forEach(n=>n.remove());

    const escAttr = (s) => String(s ?? '').replace(/"/g, '&quot;');
    const cards = Array.from(document.querySelectorAll('.m-card'));

    for (const card of cards) {
      const id = card.getAttribute('data-id');
      const meta = seed.find(m => m.id === id);
      if (!meta) continue;

      // ¿Este meta es de infusión?
      if (!isInfusionMeta(meta)) continue;

      // target: el "item" del pie (icono + nombre del drop)
      const target = card.querySelector('.m-foot .m-item');
      if (!target) continue;

      // Obtener URL de preview (JSON externo) o fallback al icono del item (API)
      let preview = '';
      if (Array.isArray(meta._extItems) && meta._extItems.length && meta._extItems[0].preview) {
        preview = meta._extItems[0].preview;
      } else if (meta.highlightItemId && itemCache.has(meta.highlightItemId)) {
        preview = itemCache.get(meta.highlightItemId)?.icon ?? '';
      }
      if (!preview) continue; // Nada que mostrar

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
        const src = escAttr(preview);
        pop.innerHTML = `<img src="${src}" alt="Preview de infusión" decoding="async" referrerpolicy="no-referrer">`;
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
})();
