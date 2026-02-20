
// v1.6.0-alpha1 — FIX integral
// Objetivo: restaurar Wallet/Compacta/Conversor tal como estaban + agregar MetaEventos SIN interferir.
// - Mantiene gestión de API Keys (agregar +, renombrar, eliminar, copiar).
// - Mantiene filtros, favoritas, render de tarjetas y tabla (compacta).
// - Conversor Gem ↔ Gold robusto.
// - MetaEventos encapsulado (sidebar de favoritos + grid) sin tocar el resto.
(function(){
  'use strict';
  // ======= Constantes de LocalStorage =======
  const LS_KEYS='gw2.wallet.keys.v1';
  const LS_CURRENCIES='gw2.wallet.currencies.v1';
  const LS_FAVS='gw2.wallet.favorites.v1';
  const LS_META_DONE='gw2.meta.done.v1';
  const LS_META_FAVS='gw2.meta.favorites.v1';

  // ======= Utils =======
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const nf=new Intl.NumberFormat('es-AR');

  function loadJSON(k,def){ try{ const v=JSON.parse(localStorage.getItem(k)); return v??def; }catch{ return def; } }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  function setStatus(msg, cls=''){ const el=$('#status'); if(!el) return; el.className='status '+cls; el.textContent=msg; }
  function maskKey(id){ return id ? id.slice(0,8)+'…'+id.slice(-6) : ''; }

  // ======= Estado (Wallet) =======
  let keys=loadJSON(LS_KEYS,[]);
  let currencies=null; // catálogo
  let wallet=[];       // datos de cuenta
  let favs=loadJSON(LS_FAVS,[]);

  // ======= Fetch robusto =======
  async function robustFetch(url,{retries=1,timeoutMs=8000}={}){
    for(let a=0;a<=retries;a++){
      const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(), timeoutMs);
      try{
        const r=await fetch(url,{signal:ctrl.signal,cache:'no-store',mode:'cors'});
        clearTimeout(t);
        if(!r.ok){ if((r.status===429||r.status>=500)&&a<retries){ await new Promise(res=>setTimeout(res,600)); continue; } throw new Error('HTTP '+r.status); }
        return await r.json();
      }catch(e){ clearTimeout(t); if(a<retries){ await new Promise(res=>setTimeout(res,600)); continue; } throw e; }
    }
  }

  // ======= GW2 API helpers =======
  async function validateKey(id){ return await robustFetch(`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`,{retries:1}); }
  async function fetchAccount(id){ return await robustFetch(`https://api.guildwars2.com/v2/account?access_token=${encodeURIComponent(id)}`,{retries:1}); }
  async function loadCurrenciesCatalog(force=false){
    if(!force){ const cached=loadJSON(LS_CURRENCIES,null); if(cached && Array.isArray(cached.items) && (Date.now()-cached.ts)<(1000*60*60*24*7)){ currencies=cached.items; return currencies; } }
    currencies=await robustFetch('https://api.guildwars2.com/v2/currencies?ids=all',{retries:1});
    saveJSON(LS_CURRENCIES,{ts:Date.now(),items:currencies});
    return currencies;
  }
  async function fetchWallet(id){ return await robustFetch(`https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(id)}`,{retries:1}); }

  // ======= Monedas (visual g/s/c) =======
  function formatCoins(total){ const g=Math.floor(total/10000); const s=Math.floor((total%10000)/100); const c=total%100; return {g,s,c}; }
  function coinBoxes(total){ const {g,s,c}=formatCoins(total); const wrap=document.createElement('div'); wrap.className='coins';
    const G=document.createElement('span'); G.className='coin-box g'; G.textContent=`${nf.format(g)} g`;
    const S=document.createElement('span'); S.className='coin-box s'; S.textContent=`${s} s`;
    const C=document.createElement('span'); C.className='coin-box c'; C.textContent=`${c} c`;
    wrap.append(G,S,C); return wrap; }

  // ======= Render de claves =======
  function renderKeySelect(){ const sel=$('#keySelect'); if(!sel) return; sel.innerHTML='';
    if(keys.length===0){ const o=document.createElement('option'); o.value=''; o.textContent='— No hay API Keys guardadas —'; sel.appendChild(o); return; }
    keys.forEach((k,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${k.name||'(sin nombre)'} · ${maskKey(k.id)}`; sel.appendChild(o); });
    if(sel.selectedIndex<0) sel.selectedIndex=0; }

  // ======= Vistas =======
  function showCards(){ const cards=$('#walletCards'), table=$('#walletTableWrap'); if(cards) cards.style.display='grid'; if(table) table.style.display='none'; const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='block'; if(sb) sb.style.display='block'; if(mp) mp.style.display='none'; toggleTabs('cards'); applyFilters(); }
  function showCompact(){ const cards=$('#walletCards'), table=$('#walletTableWrap'); if(cards) cards.style.display='none'; if(table) table.style.display='block'; const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='block'; if(sb) sb.style.display='block'; if(mp) mp.style.display='none'; toggleTabs('compact'); applyFilters(); }
  function showMeta(){ const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='none'; if(sb) sb.style.display='none'; if(mp) mp.style.display='block'; toggleTabs('meta'); renderMetaGrid(); }
  function toggleTabs(which){ ['tabCards','tabCompact','tabMeta'].forEach(id=>$('#'+id)?.classList.remove('an-tab--active')); if(which==='cards') $('#tabCards')?.classList.add('an-tab--active'); else if(which==='compact') $('#tabCompact')?.classList.add('an-tab--active'); else if(which==='meta') $('#tabMeta')?.classList.add('an-tab--active'); }

  // ======= Filtros / render Wallet =======
  const CATEGORY_MAP={ 4:['general','blacklion'],1:['general'],2:['general'],23:['general'],3:['general'],16:['general'],18:['general','blacklion'],63:['general'] };
  const MAIN_IDS=[1,4,2,23,3,16,18,63];
  function isTableView(){ return $('#walletTableWrap')?.style.display==='block'; }

  function applyFilters(){ if(!currencies) return; const txt=($('#searchBox')?.value||'').trim().toLowerCase(); const cat=$('#categorySelect')?.value||''; const onlyPos=$('#onlyPositive')?.checked||false; const onlyMain=$('#onlyMain')?.checked||false; const sort=$('#sortSelect')?.value||'order';
    const byId=new Map(currencies.map(c=>[c.id,c])); let list=wallet.slice();
    list=list.filter(e=>{ if(onlyPos && e.value<=0) return false; if(onlyMain && !MAIN_IDS.includes(e.id)) return false; const meta=byId.get(e.id)||{}; if(txt){ const hay=(meta.name||'').toLowerCase(); if(!hay.includes(txt)) return false; } if(cat){ const cs=(CATEGORY_MAP[e.id]||[]); if(!cs.includes(cat)) return false; } return true; });
    list.sort((a,b)=>{ if(sort==='name'){ const A=(byId.get(a.id)?.name||'').toLowerCase(); const B=(byId.get(b.id)?.name||'').toLowerCase(); return A.localeCompare(B);} if(sort==='amount') return (b.value||0)-(a.value||0); const oa=byId.get(a.id)?.order??0, ob=byId.get(b.id)?.order??0; return oa-ob; });
    const favSet=new Set(favs); const favList=list.filter(x=>favSet.has(x.id)); const rest=list.filter(x=>!favSet.has(x.id));
    if(isTableView()){ const block=$('#favBlock'); if(block){ block.hidden=true; $('#favCards') && ($('#favCards').innerHTML=''); } renderTable(favList.concat(rest), byId, favSet); }
    else { renderFavCards(favList, byId); renderCards(rest, byId, favSet); }
  }

  function renderFavCards(list, byId){ const block=$('#favBlock'), cont=$('#favCards'); if(!block||!cont) return; if(!list||list.length===0){ block.hidden=true; cont.innerHTML=''; return; } block.hidden=false; cont.innerHTML='';
    list.forEach(entry=>{ const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:'', description:''}; const card=document.createElement('div'); card.className='card card-col'; const star=document.createElement('div'); star.className='star active'; star.textContent='★'; star.title='Quitar de favoritas'; star.addEventListener('click',()=>toggleFav(entry.id)); const title=document.createElement('div'); title.className='title'; title.textContent=meta.name; const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=meta.description||''; const footer=document.createElement('div'); footer.className='card-footer'; const icon=document.createElement('img'); icon.alt=meta.name; icon.src=meta.icon||''; icon.width=22; icon.height=22; icon.loading='lazy'; const amount=document.createElement('div'); amount.className='value'; if(entry.id===1){ amount.appendChild(coinBoxes(entry.value)); } else { amount.textContent=nf.format(entry.value); } footer.append(icon,amount); card.append(star,title,desc,footer); cont.appendChild(card); }); }

  function renderCards(list, byId, favSet){ const container=$('#walletCards'); if(!container) return; container.innerHTML='';
    list.forEach(entry=>{ const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:'', description:''}; const card=document.createElement('div'); card.className='card card-col'; const star=document.createElement('div'); star.className='star'+(favSet.has(entry.id)?' active':''); star.textContent='★'; star.title=favSet.has(entry.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(entry.id)); const title=document.createElement('div'); title.className='title'; title.textContent=meta.name; const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=meta.description||''; const footer=document.createElement('div'); footer.className='card-footer'; const icon=document.createElement('img'); icon.alt=meta.name; icon.src=meta.icon||''; icon.width=22; icon.height=22; icon.loading='lazy'; const amount=document.createElement('div'); amount.className='value'; if(entry.id===1){ amount.appendChild(coinBoxes(entry.value)); } else { amount.textContent=nf.format(entry.value); } footer.append(icon,amount); card.append(star,title,desc,footer); container.appendChild(card); }); }

  function renderTable(list, byId, favSet){ const tbody=$('#walletTable tbody'); if(!tbody) return; tbody.innerHTML=''; list.forEach(entry=>{ const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:''}; const tr=document.createElement('tr'); const tdI=document.createElement('td'); const img=document.createElement('img'); img.src=meta.icon||''; img.alt=meta.name; img.width=20; img.height=20; img.style.borderRadius='2px'; tdI.appendChild(img); const tdN=document.createElement('td'); tdN.textContent=meta.name; const tdV=document.createElement('td'); tdV.className='right'; if(entry.id===1){ tdV.appendChild(coinBoxes(entry.value)); } else { tdV.textContent=nf.format(entry.value); } const tdC=document.createElement('td'); const cats=(CATEGORY_MAP[entry.id]||[]); tdC.textContent=cats.join(', '); const tdF=document.createElement('td'); tdF.className='right'; const star=document.createElement('span'); star.textContent='★'; star.className='star'+(favSet.has(entry.id)?' active':''); star.style.position='static'; star.title=favSet.has(entry.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(entry.id)); tdF.appendChild(star); tr.append(tdI,tdN,tdV,tdC,tdF); tbody.appendChild(tr); }); }

  function toggleFav(id){ const i=favs.indexOf(id); if(i>=0) favs.splice(i,1); else favs.push(id); saveJSON(LS_FAVS, favs); applyFilters(); }

  // ======= Refresh / Keys =======
  async function refreshSelected(){ const sel=$('#keySelect'); if(!sel) return; const idx=sel.value; if(idx===''||idx===undefined){ setStatus('No hay key seleccionada.','warn'); return; }
    const arr=loadJSON(LS_KEYS,[]); const k=arr[idx]; if(!k||!k.id){ setStatus('No hay key válida.','warn'); return; }
    setStatus('Cargando datos…');
    try{
      const token=await validateKey(k.id);
      if(!(token.permissions||[]).includes('account')){ setStatus('Falta permiso: account','err'); $('#ownerLabel') && ($('#ownerLabel').textContent='—'); return; }
      const acc=await fetchAccount(k.id); $('#ownerLabel') && ($('#ownerLabel').textContent=(acc.name||'—'));
      await loadCurrenciesCatalog(false);
      if(!(token.permissions||[]).includes('wallet')){ setStatus('Falta permiso: wallet (no se podrán leer saldos)','warn'); wallet=[]; applyFilters(); return; }
      wallet=await fetchWallet(k.id);
      setStatus('Listo.','ok'); applyFilters();
    }catch(e){ setStatus(String(e.message||e),'err'); $('#ownerLabel') && ($('#ownerLabel').textContent='—'); }
  }

  function insertAddKeyButton(){ const right=$('.owner-right'); if(!right) return; if(document.getElementById('addKeyBtn')) return; const btn=document.createElement('button'); btn.id='addKeyBtn'; btn.className='icon-btn'; btn.title='Agregar API Key'; btn.ariaLabel='Agregar API Key'; btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>`; const sel=$('#keySelect'); if(sel && sel.nextSibling){ right.insertBefore(btn, sel.nextSibling); } else { right.appendChild(btn); } btn.addEventListener('click', addKeyFlow); }

  async function addKeyFlow(){ try{ const raw=prompt('Pegá tu API Key (ArenaNet)'); if(!raw||!raw.trim()) return; const id=raw.trim(); setStatus('Validando API Key…'); const token=await validateKey(id); const arr=loadJSON(LS_KEYS,[]); if(arr.some(k=>k.id===id)){ setStatus('Esa key ya está guardada.','warn'); return; } let name = token && token.name ? token.name : ''; name = prompt('Nombre para identificar la key', name||'') ?? ''; arr.push({id, name:name.trim()||undefined}); saveJSON(LS_KEYS, arr); keys=arr; renderKeySelect(); const sel=$('#keySelect'); if(sel) sel.selectedIndex=arr.length-1; setStatus('Key agregada. Cargando datos…'); await refreshSelected(); }catch(e){ setStatus('Error al validar la key: '+String(e.message||e),'err'); } }

  function bindWalletUI(){ $('#tabCards')?.addEventListener('click', showCards); $('#tabCompact')?.addEventListener('click', showCompact); $('#tabMeta')?.addEventListener('click', showMeta);
    $('#copyKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; const arr=loadJSON(LS_KEYS,[]); if(i===''||!arr[i]) return; navigator.clipboard?.writeText(arr[i].id); });
    $('#renameKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; let arr=loadJSON(LS_KEYS,[]); if(i===''||!arr[i]) return; const nuevo=prompt('Nuevo nombre para la key:', arr[i].name||''); if(nuevo!==null){ arr[i].name=nuevo; saveJSON(LS_KEYS,arr); renderKeySelect(); }});
    $('#deleteKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; let arr=loadJSON(LS_KEYS,[]); if(i===''||!arr[i]) return; if(confirm('¿Eliminar esta key?')){ const removed=arr.splice(i,1)[0]; saveJSON(LS_KEYS,arr); keys=arr; renderKeySelect(); $('#ownerLabel') && ($('#ownerLabel').textContent='—'); $('#walletCards') && ($('#walletCards').innerHTML=''); const tb=$('#walletTable tbody'); if(tb) tb.innerHTML=''; setStatus(`Key eliminada: ${removed.name||maskKey(removed.id)}`,'ok'); }});
    $('#refreshBtn')?.addEventListener('click', refreshSelected);
    $('#keySelect')?.addEventListener('change', refreshSelected);
    ['searchBox','categorySelect','onlyPositive','onlyMain','sortSelect'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; const ev=(el.tagName==='INPUT'&&el.type==='text')?'input':'change'; el.addEventListener(ev, applyFilters); });
    insertAddKeyButton();
  }

  // ======= Conversor Gem ↔ Gold =======
  function parseGoldInput(s){ if(!s) return 0; let g=0,sil=0,c=0; s=s.toLowerCase(); const rg=/(\d+)\s*g/; const rs=/(\d+)\s*s/; const rc=/(\d+)\s*c/; const mg=rg.exec(s); const ms=rs.exec(s); const mc=rc.exec(s); if(mg) g=parseInt(mg[1]); if(ms) sil=parseInt(ms[1]); if(mc) c=parseInt(mc[1]); if(!mg&&!ms&&!mc){ const n=parseFloat(s.replace(/,/g,'.'))||0; g=Math.floor(n);} return g*10000 + sil*100 + c; }
  let lastExchangeTs=0; let lastGemsResp=null; let lastCoinsResp=null; const EX_TTL=30000;
  $('#btnG2C')?.addEventListener('click', async()=>{ const q=parseInt($('#convGems')?.value||'0'); if(!q||q<=0){ $('#outG2C') && ($('#outG2C').textContent='Ingrese una cantidad válida de gemas'); return; } try{ $('#convStatus') && ($('#convStatus').textContent='Consultando Exchange…'); const now=Date.now(); if(!lastGemsResp||(now-lastExchangeTs)>EX_TTL||lastGemsResp.q!==q){ lastGemsResp=await robustFetch(`https://api.guildwars2.com/v2/commerce/exchange/gems?quantity=${q}`,{retries:2}); lastGemsResp.q=q; lastExchangeTs=now; } const coins=Number(lastGemsResp.quantity)||0; const out=$('#outG2C'); if(out){ out.innerHTML=''; out.appendChild(coinBoxes(coins)); } $('#convStatus') && ($('#convStatus').textContent=`≈ ${lastGemsResp.coins_per_gem} cobre/gema · tasas actualizadas.`); }catch(err){ $('#outG2C') && ($('#outG2C').textContent='Error consultando Exchange'); $('#convStatus') && ($('#convStatus').textContent=String(err.message||err)); } });
  $('#btnC2G')?.addEventListener('click', async()=>{ const copper=parseGoldInput($('#convGold')?.value||''); if(!copper||copper<=0){ $('#outC2G') && ($('#outC2G').textContent='Ingrese un monto de oro válido'); return; } try{ $('#convStatus') && ($('#convStatus').textContent='Consultando Exchange…'); const now=Date.now(); if(!lastCoinsResp||(now-lastExchangeTs)>EX_TTL||lastCoinsResp.c!==copper){ lastCoinsResp=await robustFetch(`https://api.guildwars2.com/v2/commerce/exchange/coins?quantity=${copper}`,{retries:2}); lastCoinsResp.c=copper; lastExchangeTs=now; } const gems=Number(lastCoinsResp.quantity||lastCoinsResp.gems)||0; const out=$('#outC2G'); if(out){ out.innerHTML=''; out.appendChild(coinBoxes(copper)); out.appendChild(document.createTextNode(` ≈ ${gems} gemas`)); } $('#convStatus') && ($('#convStatus').textContent=`≈ ${lastCoinsResp.coins_per_gem} cobre/gema · tasas actualizadas.`); }catch(err){ $('#outC2G') && ($('#outC2G').textContent='Error consultando Exchange'); $('#convStatus') && ($('#convStatus').textContent=String(err.message||err)); } });

  // ======= META EVENTOS =======
  function todayKey(){ const d=new Date(); const y=d.getUTCFullYear(); const m=('0'+(d.getUTCMonth()+1)).slice(-2); const dd=('0'+d.getUTCDate()).slice(-2); return `${y}-${m}-${dd}`; }
  function loadMetaState(){ return loadJSON(LS_META_DONE, {}); }
  function isDoneTodayLocalMeta(id){ const st=loadMetaState(); return st[id]===todayKey(); }
  function toggleMetaDoneLocal(id){ const st=loadMetaState(); const k=todayKey(); if(st[id]===k){ delete st[id]; } else { st[id]=k; } saveJSON(LS_META_DONE, st); renderMetaGrid(); }

  const META_DATA=[
    { id:'choya', name:'Choya', en:'Choya Piñata', map:'Amnoon — Crystal Oasis', bg:'assets/meta/choya.jpg', waypoint:'[&BLsKAAA=]', drop:{kind:'infusion', itemIds:[84882]} },
    { id:'chak_gerent', name:'Regente Chak', en:'Chak Gerent', map:'Tangled Depths', bg:'assets/meta/chak_gerent.jpg', waypoint:'[&BPUHAAA=]', drop:{kind:'infusion', itemIds:[72021]} },
    { id:'vinewrath', name:'Furienhiedra', en:'Mordrem Vinewrath', map:'The Silverwastes', bg:'assets/meta/vinewrath.jpg', waypoint:'[&BPoHAAA=]', drop:{kind:'infusion', itemIds:[68440]} },
    { id:'shatterer', name:'El Despedazador', en:'The Shatterer', map:'Jahai Bluffs', bg:'assets/meta/shatterer.jpg', waypoint:'[&BJMLAAA=]', drop:{kind:'infusion', itemIds:[88771]}, worldbossId:'the_shatterer' },
    { id:'dragonstorm', name:'Tormenta Dragón', en:'Dragonstorm', map:'Eye of the North', bg:'assets/meta/dragonstorm.jpg', waypoint:'[&BAkMAAA=]', drop:{kind:'infusion', itemIds:[94948]} },
    { id:'tarir', name:'Tarir (Octovino)', en:'Auric Basin — Octovine', map:'Auric Basin', bg:'assets/meta/tarir.jpg', waypoint:'[&BN0HAAA=]', drop:{kind:'infusion', itemIds:[]} },
  ];

  async function fetchWorldbossesDone(token){ try{ const r=await fetch(`https://api.guildwars2.com/v2/account/worldbosses?access_token=${encodeURIComponent(token)}`,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }catch{ return null; } }
  const iconCache={};
  async function resolveDropIcon(itemIds){ try{ const ids=(itemIds||[]).filter(Boolean); if(!ids.length) return null; const miss=ids.filter(id=>!iconCache[id]); if(miss.length){ const r=await fetch(`https://api.guildwars2.com/v2/items?ids=${miss.join(',')}`,{cache:'force-cache'}); if(r.ok){ const arr=await r.json(); arr.forEach(it=>{ iconCache[it.id]=it.icon; }); } } for(const id of ids){ if(iconCache[id]) return iconCache[id]; } return null; }catch{ return null; } }

  function loadMetaFavs(){ return loadJSON(LS_META_FAVS, null); }
  function saveMetaFavs(arr){ saveJSON(LS_META_FAVS, arr); }
  function ensureDefaultMetaFavs(){ let favs=loadMetaFavs(); if(!Array.isArray(favs)||!favs.length){ favs=['choya','chak_gerent','vinewrath','shatterer','dragonstorm','tarir']; saveMetaFavs(favs); } }

  async function renderMetaGrid(){ ensureDefaultMetaFavs(); const favSet=new Set(loadMetaFavs()); const grid=$('#metaGrid'); if(!grid) return; grid.innerHTML='';
    // Sidebar lista (en sideBar) con ⭐
    const sb=$('#sideBar'); if(sb){ let list=$('#metaSideList'); if(!list){ list=document.createElement('div'); list.id='metaSideList'; list.className='panel'; list.innerHTML=`<h3 class="panel__title">MetaEventos — Lista</h3><div class="panel__body" id="metaSideBody"></div>`; sb.prepend(list); } const body=$('#metaSideBody'); if(body){ body.innerHTML=''; META_DATA.forEach(ev=>{ const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between'; row.style.gap='8px'; row.style.padding='6px 0'; const left=document.createElement('div'); left.innerHTML=`<div style="font-weight:600">${ev.name}</div><div class="muted" style="font-size:11px">(${ev.en})</div>`; const star=document.createElement('button'); star.className='icon-btn'; star.title=favSet.has(ev.id)?'Quitar de favoritos':'Agregar a favoritos'; star.innerHTML='★'; star.style.color=favSet.has(ev.id)?'#f2b01e':'#777'; star.addEventListener('click',()=>{ const favs=loadMetaFavs()||[]; const i=favs.indexOf(ev.id); if(i>=0) favs.splice(i,1); else favs.push(ev.id); saveMetaFavs(favs); renderMetaGrid(); }); row.append(left,star); body.appendChild(row); }); }
    }
    // Visibles = favoritos en orden
    const favOrder=loadMetaFavs(); const visible=META_DATA.filter(ev=>favSet.has(ev.id)).sort((a,b)=>favOrder.indexOf(a.id)-favOrder.indexOf(b.id));
    // worldboss hecho hoy si hay key
    let worldbossDone=null; try{ const idx=$('#keySelect')?.value; const arr=loadJSON(LS_KEYS,[]); if(idx!==''&&arr[idx]&&arr[idx].id){ worldbossDone=await fetchWorldbossesDone(arr[idx].id); } }catch{}
    for(const ev of visible){ const card=document.createElement('div'); card.className='meta-card '+((ev.worldbossId && Array.isArray(worldbossDone) && worldbossDone.includes(ev.worldbossId)) || (!ev.worldbossId && isDoneTodayLocalMeta(ev.id)) ? 'done' : 'pending'); const bg=document.createElement('div'); bg.className='meta-bg'; bg.style.backgroundImage=`url(${ev.bg})`; const body=document.createElement('div'); body.className='meta-body'; const h=document.createElement('div'); h.className='meta-title'; h.textContent=ev.name; const en=document.createElement('div'); en.className='muted'; en.style.fontSize='11px'; en.textContent=`(${ev.en})`; const p=document.createElement('div'); p.className='meta-desc'; p.textContent=ev.map;
      const row1=document.createElement('div'); row1.className='meta-row'; const chat=document.createElement('span'); chat.className='meta-pill'; chat.textContent=ev.waypoint; const copy=document.createElement('button'); copy.className='btn'; copy.textContent='Copiar'; copy.addEventListener('click',()=>navigator.clipboard?.writeText(ev.waypoint)); row1.append(chat,copy);
      const row2=document.createElement('div'); row2.className='meta-row'; const infWrap=document.createElement('span'); infWrap.className='meta-pill'; const infIcon=document.createElement('img'); infIcon.className='meta-badge'; infIcon.alt='Infusión'; const infTxt=document.createElement('span'); infTxt.textContent='Posible infusión'; infWrap.append(infIcon,infTxt); (async()=>{ const url=await resolveDropIcon(ev.drop?.itemIds||[]); infIcon.src=url || 'assets/icons/infusion.svg'; })();
      const row3=document.createElement('div'); row3.className='meta-row'; const when=document.createElement('span'); when.className='meta-pill'; when.textContent='Próximo horario: '; const timersLink=document.createElement('a'); timersLink.href='https://wiki.guildwars2.com/wiki/Event_timers'; timersLink.target='_blank'; timersLink.rel='noopener'; timersLink.textContent='Ver horarios'; const timerBox=document.createElement('span'); timerBox.className='muted'; timerBox.style.fontSize='12px'; timerBox.style.marginLeft='6px'; timerBox.appendChild(timersLink); row3.append(when,timerBox);
      const row4=document.createElement('div'); row4.className='meta-row'; const toggle=document.createElement('label'); toggle.className='meta-toggle'; const chk=document.createElement('input'); chk.type='checkbox'; const lb=document.createElement('span'); lb.textContent='Hecho hoy'; if(ev.worldbossId && Array.isArray(worldbossDone)){ chk.checked=worldbossDone.includes(ev.worldbossId); chk.disabled=true; lb.title='Marcado por API (world boss)'; } else { chk.checked=isDoneTodayLocalMeta(ev.id); chk.addEventListener('change',()=>toggleMetaDoneLocal(ev.id)); } toggle.append(chk,lb); row4.append(toggle);
      body.append(h,en,p,row1,infWrap,row3,row4); card.append(bg,body); grid.appendChild(card); }
  }

  // ======= INIT =======
  function init(){ renderKeySelect(); bindWalletUI(); showCards(); loadCurrenciesCatalog(false).catch(()=>{}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
