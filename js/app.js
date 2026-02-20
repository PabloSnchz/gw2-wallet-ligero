
// v1.6.0-alpha1 — MetaEventos (grid + timers + favs + íconos de infusiones) — no toca Wallet
(function(){
  'use strict';
  // ===== Claves de LS existentes + nuevas =====
  const LS_KEYS='gw2.wallet.keys.v1';
  const LS_FAVS='gw2.wallet.favorites.v1';
  const LS_META_DONE='gw2.meta.done.v1';
  const LS_META_FAVS='gw2.meta.favorites.v1';

  const $=s=>document.querySelector(s);
  const nf=new Intl.NumberFormat('es-AR');

  // ======= UTIL =======
  function setStatus(msg,cls=''){ const el=$('#status'); if(!el) return; el.className='status '+cls; el.textContent=msg; }
  function todayKey(){ const d=new Date(); const y=d.getUTCFullYear(); const m=('0'+(d.getUTCMonth()+1)).slice(-2); const dd=('0'+d.getUTCDate()).slice(-2); return `${y}-${m}-${dd}`; }
  function loadJSON(k,def){ try{ const v=JSON.parse(localStorage.getItem(k)); return v??def; }catch{ return def; } }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  // ======= META: Catálogo (español + subtítulo inglés) =======
  // Nota: drop.itemIds se usa solo para resolver íconos vía /v2/items. Si no hay o falla → icono genérico.
  const META_DATA=[
    {
      id:'choya', name:'Choya', en:'Choya Piñata', map:'Amnoon — Crystal Oasis',
      bg:'assets/meta/choya.jpg', waypoint:'[&BLsKAAA=]',
      drop:{ kind:'infusion', itemIds:[84882] } // Festive Confetti Infusion (variante), icono // fuente wiki
    },
    {
      id:'chak_gerent', name:'Regente Chak', en:'Chak Gerent', map:'Tangled Depths',
      bg:'assets/meta/chak_gerent.jpg', waypoint:'[&BPUHAAA=]',
      drop:{ kind:'infusion', itemIds:[72021] } // Chak Egg Sac → Chak Infusion // fuente wiki
    },
    {
      id:'vinewrath', name:'Furienhiedra', en:'Mordrem Vinewrath', map:'The Silverwastes',
      bg:'assets/meta/vinewrath.jpg', waypoint:'[&BPoHAAA=]',
      drop:{ kind:'infusion', itemIds:[68440] } // Preserved Queen Bee → Queen Bee Infusion // fuente wiki
    },
    {
      id:'shatterer', name:'El Despedazador', en:'The Shatterer', map:'Jahai Bluffs',
      bg:'assets/meta/shatterer.jpg', waypoint:'[&BJMLAAA=]',
      drop:{ kind:'infusion', itemIds:[88771] }, // Crystal Infusion // fuente wiki
      worldbossId:'the_shatterer'
    },
    {
      id:'dragonstorm', name:'Tormenta Dragón', en:'Dragonstorm', map:'Eye of the North',
      bg:'assets/meta/dragonstorm.jpg', waypoint:'[&BAkMAAA=]',
      drop:{ kind:'infusion', itemIds:[94948] } // Jormag Right Eye Infusion (instanciado, caja de ojo de dragón)
    },
    {
      id:'tarir', name:'Tarir (Octovino)', en:'Auric Basin — Octovine', map:'Auric Basin',
      bg:'assets/meta/tarir.jpg', waypoint:'[&BN0HAAA=]',
      drop:{ kind:'infusion', itemIds:[] } // Liquid Aurillium: si falla, cae en icono genérico
    },
  ];

  // ======= Meta: estado diario (API + fallback manual) =======
  function loadMetaState(){ return loadJSON(LS_META_DONE, {}); }
  function isDoneTodayLocal(id){ const st=loadMetaState(); return st[id]===todayKey(); }
  function toggleMetaDoneLocal(id){ const st=loadMetaState(); const k=todayKey(); if(st[id]===k){ delete st[id]; } else { st[id]=k; } saveJSON(LS_META_DONE, st); renderMetaGrid(); }

  // /v2/account/worldbosses para marcar world bosses hechos hoy (solo algunos) — si falla, mantenemos manual
  async function fetchWorldbossesDone(token){
    const u=`https://api.guildwars2.com/v2/account/worldbosses?access_token=${encodeURIComponent(token)}`;
    const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json(); // array de strings
  }

  // ======= Íconos de infusiones vía /v2/items =======
  const iconCache={};
  async function resolveDropIcon(itemIds){
    try{
      const ids=itemIds?.filter(Boolean) || [];
      if(ids.length===0) return null;
      const miss=ids.filter(id=>!iconCache[id]);
      if(miss.length){
        const r=await fetch(`https://api.guildwars2.com/v2/items?ids=${miss.join(',')}`,{cache:'force-cache'});
        if(r.ok){ const arr=await r.json(); arr.forEach(it=>{ iconCache[it.id]=it.icon; }); }
      }
      for(const id of ids){ if(iconCache[id]) return iconCache[id]; }
      return null;
    }catch{ return null; }
  }

  // ======= Timers (opcional) con Widget de la Wiki; si CORS falla → fallback a link =======
  let timersData=null;
  async function loadTimers(){
    if(timersData) return timersData;
    try{
      const r=await fetch('https://wiki.guildwars2.com/wiki/Special:RunScript/Widget:Event_timer/data.json');
      if(!r.ok) throw 0; timersData=await r.json(); return timersData;
    }catch{ timersData=false; return timersData; }
  }
  function formatTime(dt){ const z=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}); return z.format(dt); }
  function relCountdown(ms){ if(ms<0) ms=0; const min=Math.floor(ms/60000); const sec=Math.floor((ms%60000)/1000); return `${min}m ${('0'+sec).slice(-2)}s`; }
  // Simplificado: mostramos link si no se pudo cargar timers

  // ======= Favoritos (sidebar define el grid) =======
  function loadMetaFavs(){ return loadJSON(LS_META_FAVS, null); }
  function saveMetaFavs(arr){ saveJSON(LS_META_FAVS, arr); }
  function ensureDefaultFavs(){
    let favs=loadMetaFavs();
    if(!Array.isArray(favs) || favs.length===0){
      favs=['choya','chak_gerent','vinewrath','shatterer','dragonstorm','tarir'];
      saveMetaFavs(favs);
    }
  }

  // ======= UI render =======
  async function renderMetaGrid(){
    ensureDefaultFavs();
    const favSet=new Set(loadMetaFavs());
    const grid=$('#metaGrid'); if(!grid) return; grid.innerHTML='';

    // Sidebar (si existe) → lista completa con ⭐
    const sb=$('#sideBar'); if(sb){
      let list=$('#metaSideList'); if(!list){ list=document.createElement('div'); list.id='metaSideList'; list.className='panel'; list.innerHTML=`<h3 class="panel__title">MetaEventos — Lista</h3><div class="panel__body" id="metaSideBody"></div>`; sb.prepend(list); }
      const body=$('#metaSideBody'); body.innerHTML='';
      META_DATA.forEach(ev=>{
        const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='8px'; row.style.padding='6px 0';
        const left=document.createElement('div'); left.innerHTML=`<div style="font-weight:600">${ev.name}</div><div class="muted" style="font-size:11px">(${ev.en})</div>`;
        const star=document.createElement('button'); star.className='icon-btn'; star.title=favSet.has(ev.id)?'Quitar de favoritos':'Agregar a favoritos'; star.innerHTML='★'; star.style.color=favSet.has(ev.id)?'#f2b01e':'#777';
        star.addEventListener('click',()=>{ const favs=loadMetaFavs()||[]; const i=favs.indexOf(ev.id); if(i>=0) favs.splice(i,1); else favs.push(ev.id); saveMetaFavs(favs); renderMetaGrid(); });
        row.append(left,star); body.appendChild(row);
      });
    }

    // Tarjetas visibles = favoritos (en orden guardado)
    const favOrder=loadMetaFavs();
    const visible=META_DATA.filter(ev=>favSet.has(ev.id)).sort((a,b)=>favOrder.indexOf(a.id)-favOrder.indexOf(b.id));

    // Intentamos cargar /v2/items icons en lote sencillo (se resuelve por tarjeta cuando haga falta)

    // Option: worldboss done (si hay key seleccionada)
    let worldbossDone=null;
    try{
      const selIdx=$('#keySelect')?.value; const arr=loadJSON(LS_KEYS,[]);
      if(selIdx!=='' && arr[selIdx] && arr[selIdx].id){ worldbossDone=await fetchWorldbossesDone(arr[selIdx].id); }
    }catch{ worldbossDone=null; }

    for(const ev of visible){
      const card=document.createElement('div'); card.className='meta-card '+(isDone(ev,worldbossDone)?'done':'pending');
      const bg=document.createElement('div'); bg.className='meta-bg'; bg.style.backgroundImage=`url(${ev.bg})`;
      const body=document.createElement('div'); body.className='meta-body';

      const h=document.createElement('div'); h.className='meta-title'; h.innerHTML=`${ev.name}`;
      const en=document.createElement('div'); en.className='muted'; en.style.fontSize='11px'; en.textContent=`(${ev.en})`;
      const p=document.createElement('div'); p.className='meta-desc'; p.textContent=ev.map;

      const row1=document.createElement('div'); row1.className='meta-row';
      const chat=document.createElement('span'); chat.className='meta-pill'; chat.textContent=ev.waypoint;
      const copy=document.createElement('button'); copy.className='btn'; copy.textContent='Copiar'; copy.addEventListener('click',()=>navigator.clipboard?.writeText(ev.waypoint));
      row1.append(chat,copy);

      const row2=document.createElement('div'); row2.className='meta-row';
      const infWrap=document.createElement('span'); infWrap.className='meta-pill';
      const infIcon=document.createElement('img'); infIcon.className='meta-badge'; infIcon.alt='Infusión';
      const infTxt=document.createElement('span'); infTxt.textContent='Posible infusión';
      infWrap.append(infIcon,infTxt);

      // Resolver icono (si hay id); si no, usar genérico
      (async()=>{
        const url=await resolveDropIcon(ev.drop?.itemIds||[]);
        infIcon.src=url || 'assets/icons/infusion.svg';
      })();

      const row3=document.createElement('div'); row3.className='meta-row';
      const when=document.createElement('span'); when.className='meta-pill'; when.textContent='Próximo horario: '; // si no hay timers, queda texto base
      const timersLink=document.createElement('a'); timersLink.href='https://wiki.guildwars2.com/wiki/Event_timers'; timersLink.target='_blank'; timersLink.rel='noopener'; timersLink.textContent='Ver horarios';
      const timerBox=document.createElement('span'); timerBox.className='muted'; timerBox.style.fontSize='12px'; timerBox.style.marginLeft='6px'; timerBox.appendChild(timersLink);
      row3.append(when,timerBox);

      // Toggle hecho hoy (manual si no es worldboss, lectura si es worldboss)
      const row4=document.createElement('div'); row4.className='meta-row';
      const toggle=document.createElement('label'); toggle.className='meta-toggle';
      const chk=document.createElement('input'); chk.type='checkbox';
      const lb=document.createElement('span'); lb.textContent='Hecho hoy';
      const wb=!!ev.worldbossId;
      if(wb && Array.isArray(worldbossDone)){
        chk.checked=worldbossDone.includes(ev.worldbossId);
        chk.disabled=true; lb.title='Marcado por API (world boss)';
      } else {
        chk.checked=isDoneTodayLocal(ev.id);
        chk.addEventListener('change',()=>toggleMetaDoneLocal(ev.id));
      }
      toggle.append(chk,lb); row4.append(toggle);

      body.append(h,en,p,row1,infWrap,row3,row4); card.append(bg,body); grid.appendChild(card);
    }
  }

  function isDone(ev,worldbossDone){
    if(ev.worldbossId && Array.isArray(worldbossDone)) return worldbossDone.includes(ev.worldbossId);
    return isDoneTodayLocal(ev.id);
  }

  // ======= INIT: hook en tab Meta sin afectar Wallet =======
  function initMeta(){
    const metaTab=$('#tabMeta'); if(metaTab){ metaTab.addEventListener('click',()=>{ const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='none'; if(sb) sb.style.display='none'; if(mp) mp.style.display='block'; renderMetaGrid(); }); }
  }

  // Arranque seguro (no interferir con código previo)
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initMeta);
  else initMeta();

})();
