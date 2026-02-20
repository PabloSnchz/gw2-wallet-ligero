
// v1.6.0-alpha1 — FIX#2 (scoped)
// Corregidos 3 puntos específicos SIN tocar Wallet/Compacta/Conversor:
// 1) La lista de MetaEventos en el sidebar SOLO aparece en la pantalla MetaEventos.
// 2) Sidebar contiene listado ampliado de eventos principales; el grid muestra 6 favoritos por defecto
//    y si el usuario elige otros, se reemplazan (máximo 6 seleccionados).
// 3) Tildar "Hecho hoy" ya no oscurece ni bloquea: se actualiza la tarjeta al instante sin re-render completo.
(function(){
  'use strict';
  // ======= Constantes de LocalStorage =======
  const LS_KEYS='gw2.wallet.keys.v1';
  const LS_CURRENCIES='gw2.wallet.currencies.v1';
  const LS_FAVS='gw2.wallet.favorites.v1';
  const LS_META_DONE='gw2.meta.done.v1';
  const LS_META_FAVS='gw2.meta.favorites.v1';

  const $=s=>document.querySelector(s);
  const nf=new Intl.NumberFormat('es-AR');
  function loadJSON(k,def){ try{ const v=JSON.parse(localStorage.getItem(k)); return v??def; }catch{ return def; } }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  // ======= (Se mantiene Wallet/Compacta/Conversor del FIX anterior) =======
  // Solo incluimos funciones que tocan los tres puntos solicitados o son NO intrusivas.

  // ======= META: Catálogo ampliado (eventos principales) =======
  // Nota: para eventos sin imagen, bg puede omitirse; el CSS dará fondo neutro.
  const META_DATA=[
    { id:'choya', name:'Choya', en:'Choya Piñata', map:'Amnoon — Crystal Oasis', waypoint:'[&BLsKAAA=]', drop:{kind:'infusion', itemIds:[84882]}, bg:'assets/meta/choya.jpg' },
    { id:'chak_gerent', name:'Regente Chak', en:'Chak Gerent', map:'Tangled Depths', waypoint:'[&BPUHAAA=]', drop:{kind:'infusion', itemIds:[72021]}, bg:'assets/meta/chak_gerent.jpg' },
    { id:'vinewrath', name:'Furienhiedra', en:'Mordrem Vinewrath', map:'The Silverwastes', waypoint:'[&BPoHAAA=]', drop:{kind:'infusion', itemIds:[68440]}, bg:'assets/meta/vinewrath.jpg' },
    { id:'shatterer', name:'El Despedazador', en:'The Shatterer', map:'Jahai Bluffs', waypoint:'[&BJMLAAA=]', drop:{kind:'infusion', itemIds:[88771]}, worldbossId:'the_shatterer', bg:'assets/meta/shatterer.jpg' },
    { id:'dragonstorm', name:'Tormenta Dragón', en:'Dragonstorm', map:'Eye of the North', waypoint:'[&BAkMAAA=]', drop:{kind:'infusion', itemIds:[94948]}, bg:'assets/meta/dragonstorm.jpg' },
    { id:'tarir', name:'Tarir (Octovino)', en:'Auric Basin — Octovine', map:'Auric Basin', waypoint:'[&BN0HAAA=]', drop:{kind:'infusion', itemIds:[]}, bg:'assets/meta/tarir.jpg' },
    // Principales extra (sin imagen obligatoria)
    { id:'tequatl', name:'Tequatl el Sombrío', en:'Tequatl the Sunless', map:'Sparkfly Fen', waypoint:'[&BNABAAA=]', worldbossId:'tequatl_the_sunless', drop:{} },
    { id:'karka_queen', name:'Reina Karka', en:'Karka Queen', map:'Southsun Cove', waypoint:'[&BNUGAAA=]', worldbossId:'karka_queen', drop:{} },
    { id:'claw_jormag', name:'Garra de Jormag', en:'Claw of Jormag', map:'Frostgorge Sound', waypoint:'[&BHECAAA=]', worldbossId:'claw_of_jormag', drop:{} },
    { id:'shadow_behemoth', name:'Sombra del Desenlace', en:'Shadow Behemoth', map:'Queensdale', waypoint:'[&BPwAAAA=]', worldbossId:'shadow_behemoth', drop:{} },
    { id:'golem_mark_ii', name:'Gólem Mark II', en:'Inquest Golem Mark II', map:'Mount Maelstrom', waypoint:'[&BHoCAAA=]', worldbossId:'inquest_golem_mark_ii', drop:{} },
    { id:'megadestroyer', name:'Megadestructor', en:'Megadestroyer', map:'Mount Maelstrom', waypoint:'[&BM0CAAA=]', worldbossId:'megadestroyer', drop:{} },
    { id:'triple_wurm', name:'Triple Sierpe', en:'Triple Trouble Wurm', map:'Bloodtide Coast', waypoint:'[&BKoBAAA=]', worldbossId:'triple_trouble_wurm', drop:{} }
  ];

  // ======= Favoritos (máximo 6) =======
  function loadMetaFavs(){ return loadJSON(LS_META_FAVS, null); }
  function saveMetaFavs(arr){ saveJSON(LS_META_FAVS, arr); }
  function ensureDefaultMetaFavs(){ let favs=loadMetaFavs(); if(!Array.isArray(favs)||!favs.length){ favs=['choya','chak_gerent','vinewrath','shatterer','dragonstorm','tarir']; saveMetaFavs(favs); } }

  function addFavLimited(id){ let favs=loadMetaFavs()||[]; if(favs.includes(id)) return favs; if(favs.length>=6){ // reemplazo FIFO: elimino el primero
    favs.shift();
  }
  favs.push(id); saveMetaFavs(favs); return favs; }

  function removeFav(id){ let favs=loadMetaFavs()||[]; const i=favs.indexOf(id); if(i>=0) favs.splice(i,1); saveMetaFavs(favs); return favs; }

  // ======= Estado diario (API + local) =======
  function todayKey(){ const d=new Date(); const y=d.getUTCFullYear(); const m=('0'+(d.getUTCMonth()+1)).slice(-2); const dd=('0'+d.getUTCDate()).slice(-2); return `${y}-${m}-${dd}`; }
  function loadMetaState(){ return loadJSON(LS_META_DONE, {}); }
  function isDoneTodayLocalMeta(id){ const st=loadMetaState(); return st[id]===todayKey(); }
  function toggleMetaDoneLocal(id, checked){ const st=loadMetaState(); const k=todayKey(); st[id]=checked? k : undefined; if(!checked) delete st[id]; saveJSON(LS_META_DONE, st); setMetaCardState(id, checked); }

  async function fetchWorldbossesDone(token){ try{ const r=await fetch(`https://api.guildwars2.com/v2/account/worldbosses?access_token=${encodeURIComponent(token)}`,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }catch{ return null; } }

  const iconCache={};
  async function resolveDropIcon(itemIds){ try{ const ids=(itemIds||[]).filter(Boolean); if(!ids.length) return null; const miss=ids.filter(id=>!iconCache[id]); if(miss.length){ const r=await fetch(`https://api.guildwars2.com/v2/items?ids=${miss.join(',')}`,{cache:'force-cache'}); if(r.ok){ const arr=await r.json(); arr.forEach(it=>{ iconCache[it.id]=it.icon; }); } } for(const id of ids){ if(iconCache[id]) return iconCache[id]; } return null; }catch{ return null; } }

  // ======= Render =======
  function getMetaPanel(){ return $('#metaPanel'); }

  function ensureSidebarListVisible(isMeta){
    const sb=$('#sideBar'); if(!sb) return;
    let list=$('#metaSideList');
    if(isMeta){
      sb.style.display='block';
      if(!list){ list=document.createElement('div'); list.id='metaSideList'; list.className='panel'; list.innerHTML=`<h3 class="panel__title">MetaEventos — Lista</h3><div class="panel__body" id="metaSideBody"></div>`; sb.prepend(list); }
      list.style.display='block';
      renderSidebarList();
    } else {
      if(list){ list.style.display='none'; }
    }
  }

  function renderSidebarList(){ const body=$('#metaSideBody'); if(!body) return; body.innerHTML=''; const favSet=new Set(loadMetaFavs()||[]);
    META_DATA.forEach(ev=>{
      const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='8px'; row.style.padding='6px 0';
      const left=document.createElement('div'); left.innerHTML=`<div style="font-weight:600">${ev.name}</div><div class="muted" style="font-size:11px">(${ev.en})</div>`;
      const star=document.createElement('button'); star.className='icon-btn'; star.title=favSet.has(ev.id)?'Quitar de favoritos':'Agregar a favoritos'; star.innerHTML='★'; star.style.color=favSet.has(ev.id)?'#f2b01e':'#777';
      star.addEventListener('click',()=>{ let favs=loadMetaFavs()||[]; if(favSet.has(ev.id)){ favs=removeFav(ev.id); } else { favs=addFavLimited(ev.id); }
        renderSidebarList(); renderMetaGrid(); });
      row.append(left,star); body.appendChild(row);
    });
  }

  function setMetaCardState(id, done){ const card=document.querySelector(`.meta-card[data-id="${id}"]`); if(!card) return; card.classList.remove('done','pending'); card.classList.add(done? 'done':'pending'); }

  async function renderMetaGrid(){ const mp=getMetaPanel(); if(!mp) return; const grid=$('#metaGrid'); if(!grid) return; grid.innerHTML=''; ensureDefaultMetaFavs(); const favOrder=loadMetaFavs()||[]; const favSet=new Set(favOrder);
    // Mostrar SOLO favoritos (máximo 6), en el orden guardado
    const visible=META_DATA.filter(ev=>favSet.has(ev.id)).sort((a,b)=>favOrder.indexOf(a.id)-favOrder.indexOf(b.id)).slice(0,6);
    // worldboss hecho hoy si hay key
    let worldbossDone=null; try{ const idx=$('#keySelect')?.value; const arr=loadJSON(LS_KEYS,[]); if(idx!==''&&arr[idx]&&arr[idx].id){ worldbossDone=await fetchWorldbossesDone(arr[idx].id); } }catch{}

    for(const ev of visible){ const card=document.createElement('div'); card.className='meta-card'; card.dataset.id=ev.id; const done=(ev.worldbossId && Array.isArray(worldbossDone) && worldbossDone.includes(ev.worldbossId)) || (!ev.worldbossId && isDoneTodayLocalMeta(ev.id)); card.classList.add(done? 'done':'pending');
      const bg=document.createElement('div'); bg.className='meta-bg'; if(ev.bg){ bg.style.backgroundImage=`url(${ev.bg})`; }
      const body=document.createElement('div'); body.className='meta-body';
      const h=document.createElement('div'); h.className='meta-title'; h.textContent=ev.name;
      const en=document.createElement('div'); en.className='muted'; en.style.fontSize='11px'; en.textContent=`(${ev.en})`;
      const p=document.createElement('div'); p.className='meta-desc'; p.textContent=ev.map;
      const row1=document.createElement('div'); row1.className='meta-row';
      const chat=document.createElement('span'); chat.className='meta-pill'; chat.textContent=ev.waypoint;
      const copy=document.createElement('button'); copy.className='btn'; copy.textContent='Copiar'; copy.addEventListener('click',()=>navigator.clipboard?.writeText(ev.waypoint)); row1.append(chat,copy);
      const row2=document.createElement('div'); row2.className='meta-row';
      const infWrap=document.createElement('span'); infWrap.className='meta-pill'; const infIcon=document.createElement('img'); infIcon.className='meta-badge'; infIcon.alt='Infusión'; const infTxt=document.createElement('span'); infTxt.textContent='Posible infusión'; infWrap.append(infIcon,infTxt);
      (async()=>{ const url=await resolveDropIcon(ev.drop?.itemIds||[]); infIcon.src=url || 'assets/icons/infusion.svg'; })();
      const row3=document.createElement('div'); row3.className='meta-row'; const when=document.createElement('span'); when.className='meta-pill'; when.textContent='Próximo horario: '; const timersLink=document.createElement('a'); timersLink.href='https://wiki.guildwars2.com/wiki/Event_timers'; timersLink.target='_blank'; timersLink.rel='noopener'; timersLink.textContent='Ver horarios'; const timerBox=document.createElement('span'); timerBox.className='muted'; timerBox.style.fontSize='12px'; timerBox.style.marginLeft='6px'; timerBox.appendChild(timersLink); row3.append(when,timerBox);
      const row4=document.createElement('div'); row4.className='meta-row'; const toggle=document.createElement('label'); toggle.className='meta-toggle'; const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=done; const lb=document.createElement('span'); lb.textContent='Hecho hoy';
      if(ev.worldbossId && Array.isArray(worldbossDone)){ chk.disabled=true; lb.title='Marcado por API (world boss)'; } else {
        chk.addEventListener('change',()=>{ toggleMetaDoneLocal(ev.id, chk.checked); });
      }
      toggle.append(chk,lb); row4.append(toggle);

      body.append(h,en,p,row1,infWrap,row3,row4); card.append(bg,body); grid.appendChild(card);
    }
  }

  // ======= Hook de visibilidad de la lista en sidebar (Punto 1) =======
  function showCards(){ const cards=$('#walletCards'), table=$('#walletTableWrap'); if(cards) cards.style.display='grid'; if(table) table.style.display='none'; const wp=$('#walletPanel'), mp=$('#metaPanel'); if(wp) wp.style.display='block'; if(mp) mp.style.display='none'; ensureSidebarListVisible(false); toggleTabs('cards'); }
  function showCompact(){ const cards=$('#walletCards'), table=$('#walletTableWrap'); if(cards) cards.style.display='none'; if(table) table.style.display='block'; const wp=$('#walletPanel'), mp=$('#metaPanel'); if(wp) wp.style.display='block'; if(mp) mp.style.display='none'; ensureSidebarListVisible(false); toggleTabs('compact'); }
  function showMeta(){ const wp=$('#walletPanel'), mp=$('#metaPanel'); if(wp) wp.style.display='none'; if(mp) mp.style.display='block'; ensureSidebarListVisible(true); toggleTabs('meta'); renderMetaGrid(); }
  function toggleTabs(which){ ['tabCards','tabCompact','tabMeta'].forEach(id=>$('#'+id)?.classList.remove('an-tab--active')); if(which==='cards') $('#tabCards')?.classList.add('an-tab--active'); else if(which==='compact') $('#tabCompact')?.classList.add('an-tab--active'); else if(which==='meta') $('#tabMeta')?.classList.add('an-tab--active'); }

  // ======= Bind mínimo para tabs (no toca resto del Wallet) =======
  function bindTabsOnly(){ $('#tabCards')?.addEventListener('click', showCards); $('#tabCompact')?.addEventListener('click', showCompact); $('#tabMeta')?.addEventListener('click', showMeta); }

  // ======= INIT seguro =======
  function init(){ bindTabsOnly(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
