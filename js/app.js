
// v1.6.0-alpha1-hotfix2 — Restaura botón "+" para agregar API Keys
// - Mantiene el hotfix anterior (exponer refreshSelected y binding seguro)
// - Inserta botón Add (JS) sin tocar HTML ni estilos globales
(function(){
  const LS_KEYS='gw2.wallet.keys.v1';
  const LS_CURRENCIES='gw2.wallet.currencies.v1';
  const LS_FAVS='gw2.wallet.favorites.v1';
  const LS_META='gw2.meta.done.v1';
  let keys=loadKeys(); let currencies=null; let wallet=[]; let favs=loadFavs();
  const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
  const nf=new Intl.NumberFormat('es-AR');

  function loadKeys(){ try{return JSON.parse(localStorage.getItem(LS_KEYS))||[]}catch{return[]} }
  function persistKeys(){ localStorage.setItem(LS_KEYS, JSON.stringify(keys)); }
  function loadFavs(){ try{return JSON.parse(localStorage.getItem(LS_FAVS))||[]}catch{return[]} }
  function persistFavs(){ localStorage.setItem(LS_FAVS, JSON.stringify(favs)); }
  function maskKey(id){ return id ? id.slice(0,8)+'…'+id.slice(-6) : ''; }

  async function robustFetch(url,{retries=1,timeoutMs=8000}={}){
    for(let a=0;a<=retries;a++){
      const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(), timeoutMs);
      try{ const r=await fetch(url,{signal:ctrl.signal,cache:'no-store',mode:'cors'}); clearTimeout(t);
        if(!r.ok){ if((r.status===429||r.status>=500)&&a<retries){ await new Promise(res=>setTimeout(res,600)); continue;} throw new Error('HTTP '+r.status); }
        return await r.json();
      }catch(e){ clearTimeout(t); if(a<retries){ await new Promise(res=>setTimeout(res,600)); continue;} throw e; }
    }
  }

  async function validateKey(id){ return await robustFetch(`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`,{retries:1}); }
  async function fetchAccount(id){ return await robustFetch(`https://api.guildwars2.com/v2/account?access_token=${encodeURIComponent(id)}`,{retries:1}); }
  async function loadCurrenciesCatalog(force=false){
    if(!force){ try{ const c=JSON.parse(localStorage.getItem(LS_CURRENCIES)); if(c&&Array.isArray(c.items)&&(Date.now()-c.ts)<(1000*60*60*24*7)){ currencies=c.items; return currencies; } }catch{}
    }
    currencies=await robustFetch('https://api.guildwars2.com/v2/currencies?ids=all',{retries:1});
    localStorage.setItem(LS_CURRENCIES, JSON.stringify({ts:Date.now(),items:currencies}));
    return currencies;
  }
  async function fetchWallet(id){ return await robustFetch(`https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(id)}`,{retries:1}); }

  function setStatus(m,c=''){ const el=$('#status'); if(!el) return; el.className='status '+c; el.textContent=m; }
  function formatCoins(t){ const g=Math.floor(t/10000); const s=Math.floor((t%10000)/100); const c=t%100; return {g,s,c}; }
  function coinBoxes(t){ const {g,s,c}=formatCoins(t),w=document.createElement('div'); w.className='coins';
    const G=document.createElement('span'); G.className='coin-box g'; G.textContent=`${nf.format(g)} g`;
    const S=document.createElement('span'); S.className='coin-box s'; S.textContent=`${s} s`;
    const C=document.createElement('span'); C.className='coin-box c'; C.textContent=`${c} c`;
    w.append(G,S,C); return w; }

  function renderKeySelect(){ const sel=$('#keySelect'); if(!sel) return; sel.innerHTML='';
    if(keys.length===0){ const o=document.createElement('option'); o.value=''; o.textContent='— No hay API Keys guardadas —'; sel.appendChild(o); return; }
    keys.forEach((k,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${k.name||'(sin nombre)'} · ${maskKey(k.id)}`; sel.appendChild(o); });
    if(sel.options.length>0) sel.selectedIndex=0;
  }

  function showWallet(){ const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='block'; if(sb) sb.style.display='block'; if(mp) mp.style.display='none'; }
  function showCards(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a) a.style.display='grid'; if(b) b.style.display='none'; showWallet(); }
  function showCompact(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a) a.style.display='none'; if(b) b.style.display='block'; showWallet(); }
  function showMeta(){ const wp=$('#walletPanel'), sb=$('#sideBar'), mp=$('#metaPanel'); if(wp) wp.style.display='none'; if(sb) sb.style.display='none'; if(mp) mp.style.display='block'; renderMetaGrid(); }

  const CATEGORY_MAP={ 4:['general','blacklion'],1:['general'],2:['general'],23:['general'],3:['general'],16:['general'],18:['general','blacklion'],63:['general'] };
  const MAIN_IDS=[1,4,2,23,3,16,18,63];
  function isTableView(){ const w=$('#walletTableWrap'); return w && w.style.display==='block'; }

  function applyFilters(){ if(!currencies) return; const txt=($('#searchBox')?.value||'').trim().toLowerCase(); const cat=$('#categorySelect')?.value||''; const onlyPos=$('#onlyPositive')?.checked||false; const onlyMain=$('#onlyMain')?.checked||false; const sort=$('#sortSelect')?.value||'order';
    const byId=new Map(currencies.map(c=>[c.id,c])); let list=wallet.slice(); list=list.filter(e=>{ if(onlyPos && e.value<=0) return false; if(onlyMain && !MAIN_IDS.includes(e.id)) return false; const m=byId.get(e.id)||{}; if(txt){ const h=(m.name||'').toLowerCase(); if(!h.includes(txt)) return false; } if(cat){ const cs=(CATEGORY_MAP[e.id]||[]); if(!cs.includes(cat)) return false; } return true; });
    list.sort((a,b)=>{ if(sort==='name'){ const A=(byId.get(a.id)?.name||'').toLowerCase(); const B=(byId.get(b.id)?.name||'').toLowerCase(); return A.localeCompare(B);} if(sort==='amount') return (b.value||0)-(a.value||0); const oa=byId.get(a.id)?.order??0, ob=byId.get(b.id)?.order??0; return oa-ob; });
    const favSet=new Set(favs); const favList=list.filter(x=>favSet.has(x.id)); const rest=list.filter(x=>!favSet.has(x.id)); if(isTableView()){ const block=$('#favBlock'); if(block){ block.hidden=true; const fc=$('#favCards'); if(fc) fc.innerHTML=''; } renderTable(favList.concat(rest),byId,favSet);} else { renderFavCards(favList,byId); renderCards(rest,byId,favSet);} }

  function renderFavCards(list,byId){ const block=$('#favBlock'), cont=$('#favCards'); if(!block||!cont) return; if(!list||list.length===0){ block.hidden=true; cont.innerHTML=''; return; } block.hidden=false; cont.innerHTML=''; list.forEach(e=>{ const m=byId.get(e.id)||{name:`ID ${e.id}`,icon:'',description:''}; const card=document.createElement('div'); card.className='card card-col'; const star=document.createElement('div'); star.className='star active'; star.textContent='★'; star.title='Quitar de favoritas'; star.addEventListener('click',()=>toggleFav(e.id)); const title=document.createElement('div'); title.className='title'; title.textContent=m.name; const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=m.description||''; const footer=document.createElement('div'); footer.className='card-footer'; const icon=document.createElement('img'); icon.alt=m.name; icon.src=m.icon||''; icon.width=22; icon.height=22; icon.loading='lazy'; const amount=document.createElement('div'); amount.className='value'; if(e.id===1){ amount.appendChild(coinBoxes(e.value)); } else { amount.textContent=nf.format(e.value); } footer.append(icon,amount); card.append(star,title,desc,footer); cont.appendChild(card); }); }
  function renderCards(list,byId,favSet){ const container=$('#walletCards'); if(!container) return; container.innerHTML=''; list.forEach(e=>{ const m=byId.get(e.id)||{name:`ID ${e.id}`,icon:'',description:''}; const card=document.createElement('div'); card.className='card card-col'; const star=document.createElement('div'); star.className='star'+(favSet.has(e.id)?' active':''); star.textContent='★'; star.title=favSet.has(e.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(e.id)); const title=document.createElement('div'); title.className='title'; title.textContent=m.name; const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=m.description||''; const footer=document.createElement('div'); footer.className='card-footer'; const icon=document.createElement('img'); icon.alt=m.name; icon.src=m.icon||''; icon.width=22; icon.height=22; icon.loading='lazy'; const amount=document.createElement('div'); amount.className='value'; if(e.id===1){ amount.appendChild(coinBoxes(e.value)); } else { amount.textContent=nf.format(e.value); } footer.append(icon,amount); card.append(star,title,desc,footer); container.appendChild(card); }); }
  function renderTable(list,byId,favSet){ const tbody=document.querySelector('#walletTable tbody'); if(!tbody) return; tbody.innerHTML=''; list.forEach(e=>{ const m=byId.get(e.id)||{name:`ID ${e.id}`,icon:''}; const tr=document.createElement('tr'); const tdI=document.createElement('td'); const img=document.createElement('img'); img.src=m.icon||''; img.alt=m.name; img.width=20; img.height=20; img.style.borderRadius='2px'; tdI.appendChild(img); const tdN=document.createElement('td'); tdN.textContent=m.name; const tdV=document.createElement('td'); tdV.className='right'; if(e.id===1){ tdV.appendChild(coinBoxes(e.value)); } else { tdV.textContent=nf.format(e.value); } const tdC=document.createElement('td'); tdC.textContent=(CATEGORY_MAP[e.id]||[]).join(', '); const tdF=document.createElement('td'); tdF.className='right'; const star=document.createElement('span'); star.textContent='★'; star.className='star'+(favSet.has(e.id)?' active':''); star.style.position='static'; star.title=favSet.has(e.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(e.id)); tdF.appendChild(star); tr.append(tdI,tdN,tdV,tdC,tdF); tbody.appendChild(tr); }); }
  function toggleFav(id){ const i=favs.indexOf(id); if(i>=0) favs.splice(i,1); else favs.push(id); persistFavs(); applyFilters(); }

  function parseGoldInput(s){ if(!s) return 0; let g=0,sil=0,c=0; s=s.toLowerCase(); const rg=/(\d+)\s*g/; const rs=/(\d+)\s*s/; const rc=/(\d+)\s*c/; const mg=rg.exec(s); const ms=rs.exec(s); const mc=rc.exec(s); if(mg) g=parseInt(mg[1]); if(ms) sil=parseInt(ms[1]); if(mc) c=parseInt(mc[1]); if(!mg&&!ms&&!mc){ const n=parseFloat(s.replace(/,/g,'.'))||0; g=Math.floor(n);} return g*10000 + sil*100 + c; }

  let lastExchangeTs=0; let lastGemsResp=null; let lastCoinsResp=null; const EX_TTL=30000;

  async function refreshSelected(){
    const idx=$('#keySelect')?.value; if(idx===''||idx===undefined){ setStatus('No hay key seleccionada.','warn'); return; }
    const k=(JSON.parse(localStorage.getItem(LS_KEYS)||'[]'))[idx]; if(!k||!k.id){ setStatus('No hay key válida.','warn'); return; }
    setStatus('Cargando datos…');
    try{
      const token=await validateKey(k.id);
      if(!new Set(token.permissions||[]).has('account')){ setStatus('Falta permiso: account','err'); $('#ownerLabel').textContent='—'; return; }
      const acc=await fetchAccount(k.id); const lab=$('#ownerLabel'); if(lab) lab.textContent=acc.name||'—';
      await loadCurrenciesCatalog(false);
      if(!new Set(token.permissions||[]).has('wallet')){ setStatus('Falta permiso: wallet (no se podrán leer saldos)','warn'); wallet=[]; applyFilters(); return; }
      wallet=await fetchWallet(k.id);
      setStatus('Listo.','ok'); applyFilters();
    }catch(e){ setStatus(String(e.message||e),'err'); const lab=$('#ownerLabel'); if(lab) lab.textContent='—'; }
  }

  function insertAddKeyButton(){
    const right=$('.owner-right'); if(!right) return;
    // ¿Ya existe?
    if(document.getElementById('addKeyBtn')) return;
    const btn=document.createElement('button');
    btn.id='addKeyBtn'; btn.className='icon-btn'; btn.title='Agregar API Key'; btn.ariaLabel='Agregar API Key';
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>`;
    const sel=$('#keySelect');
    if(sel && sel.nextSibling){ right.insertBefore(btn, sel.nextSibling); } else { right.appendChild(btn); }
    btn.addEventListener('click', addKeyFlow);
  }

  async function addKeyFlow(){
    try{
      const raw=prompt('Pegá tu API Key (ArenaNet)'); if(!raw||!raw.trim()){ return; }
      const id=raw.trim(); setStatus('Validando API Key…');
      const token=await validateKey(id);
      // Evitar duplicadas
      const exists=(JSON.parse(localStorage.getItem(LS_KEYS)||'[]')||[]).some(k=>k.id===id);
      if(exists){ setStatus('Esa key ya está guardada.','warn'); return; }
      // Tomar nombre sugerido o pedirlo
      let name = token && token.name ? token.name : '';
      name = prompt('Nombre para identificar la key', name||'') ?? '';
      const arr=JSON.parse(localStorage.getItem(LS_KEYS)||'[]');
      arr.push({id, name:name.trim()||undefined});
      localStorage.setItem(LS_KEYS, JSON.stringify(arr));
      keys=arr; renderKeySelect();
      const sel=$('#keySelect'); if(sel){ sel.selectedIndex=arr.length-1; }
      setStatus('Key agregada. Cargando datos…');
      await refreshSelected();
    }catch(e){ setStatus('Error al validar la key: '+String(e.message||e),'err'); }
  }

  function bindUI(){
    $('#tabCards')?.addEventListener('click',()=>{ showCards(); applyFilters(); toggleTabs('cards'); });
    $('#tabCompact')?.addEventListener('click',()=>{ showCompact(); applyFilters(); toggleTabs('compact'); });
    $('#tabMeta')?.addEventListener('click',()=>{ showMeta(); toggleTabs('meta'); });
    $('#copyKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; const arr=JSON.parse(localStorage.getItem(LS_KEYS)||'[]'); if(i===''||!arr[i]) return; navigator.clipboard?.writeText(arr[i].id); });
    $('#renameKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; let arr=JSON.parse(localStorage.getItem(LS_KEYS)||'[]'); if(i===''||!arr[i]) return; const nuevo=prompt('Nuevo nombre para la key:', arr[i].name||''); if(nuevo!==null){ arr[i].name=nuevo; localStorage.setItem(LS_KEYS,JSON.stringify(arr)); renderKeySelect(); }});
    $('#deleteKeyBtn')?.addEventListener('click',()=>{ const i=$('#keySelect')?.value; let arr=JSON.parse(localStorage.getItem(LS_KEYS)||'[]'); if(i===''||!arr[i]) return; if(confirm('¿Eliminar esta key?')){ const removed=arr.splice(i,1)[0]; localStorage.setItem(LS_KEYS,JSON.stringify(arr)); renderKeySelect(); const lab=$('#ownerLabel'); if(lab) lab.textContent='—'; $('#walletCards')&&( $('#walletCards').innerHTML='' ); const tb=document.querySelector('#walletTable tbody'); if(tb) tb.innerHTML=''; setStatus(`Key eliminada: ${removed.name||maskKey(removed.id)}`,'ok'); }});
    $('#refreshBtn')?.addEventListener('click', refreshSelected);
    $('#keySelect')?.addEventListener('change', refreshSelected);

    ['searchBox','categorySelect','onlyPositive','onlyMain','sortSelect'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; const ev=(el.tagName==='INPUT'&&el.type==='text')?'input':'change'; el.addEventListener(ev, applyFilters); });

    // Restaura botón "+" junto al selector
    insertAddKeyButton();

    // Exponer global
    window.refreshSelected = refreshSelected;
  }

  function toggleTabs(which){ ['tabCards','tabCompact','tabMeta'].forEach(id=>$('#'+id)?.classList.remove('an-tab--active')); if(which==='cards') $('#tabCards')?.classList.add('an-tab--active'); else if(which==='compact') $('#tabCompact')?.classList.add('an-tab--active'); else if(which==='meta') $('#tabMeta')?.classList.add('an-tab--active'); }

  // ===== MetaEventos (de momento dejamos solo Choya; luego completamos el grid) =====
  const META_DATA=[
    {id:'choya_pinata', name:'Choya Piñata', image:'assets/meta/choya.jpg', infusionIcon:'assets/icons/infusion.svg', waypoint:'[&BIAKAAA=]', desc:'Meta de festival en Amnoon, puede soltar una infusión rara.'},
  ];
  function todayKey(){ const d=new Date(); const y=d.getFullYear(); const m=('0'+(d.getMonth()+1)).slice(-2); const dd=('0'+d.getDate()).slice(-2); return `${y}-${m}-${dd}`; }
  function loadMetaState(){ try{return JSON.parse(localStorage.getItem(LS_META))||{}}catch{return{}} }
  function saveMetaState(st){ localStorage.setItem(LS_META, JSON.stringify(st)); }
  function isDoneToday(id){ const st=loadMetaState(); return st[id]===todayKey(); }
  function toggleMetaDone(id){ const st=loadMetaState(); const key=todayKey(); if(st[id]===key){ delete st[id]; } else { st[id]=key; } saveMetaState(st); renderMetaGrid(); }
  function renderMetaGrid(){ const grid=$('#metaGrid'); if(!grid) return; grid.innerHTML=''; META_DATA.forEach(ev=>{ const card=document.createElement('div'); card.className='meta-card '+(isDoneToday(ev.id)?'done':'pending'); const bg=document.createElement('div'); bg.className='meta-bg'; bg.style.backgroundImage=`url(${ev.image})`; const body=document.createElement('div'); body.className='meta-body'; const h=document.createElement('div'); h.className='meta-title'; h.textContent=ev.name; const p=document.createElement('div'); p.className='meta-desc'; p.textContent=ev.desc; const row1=document.createElement('div'); row1.className='meta-row'; const chat=document.createElement('span'); chat.className='meta-pill'; chat.textContent=ev.waypoint; const copy=document.createElement('button'); copy.className='btn'; copy.textContent='Copiar'; copy.addEventListener('click',()=>{ navigator.clipboard?.writeText(ev.waypoint); }); row1.append(chat,copy); const row2=document.createElement('div'); row2.className='meta-row'; const infWrap=document.createElement('span'); infWrap.className='meta-pill'; const infIcon=document.createElement('img'); infIcon.className='meta-badge'; infIcon.src=ev.infusionIcon; infIcon.alt='Infusión'; const infTxt=document.createElement('span'); infTxt.textContent='Infusión (posible drop)'; infWrap.append(infIcon,infTxt); const toggle=document.createElement('label'); toggle.className='meta-toggle'; const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=isDoneToday(ev.id); chk.addEventListener('change',()=>toggleMetaDone(ev.id)); const lb=document.createElement('span'); lb.textContent='Hecho hoy'; toggle.append(chk,lb); row2.append(infWrap,toggle); body.append(h,p,row1,row2); card.append(bg,body); grid.appendChild(card); }); }

  function init(){ renderKeySelect(); bindUI(); showCards(); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

})();
