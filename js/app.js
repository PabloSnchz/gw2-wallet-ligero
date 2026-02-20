
// v1.3.1 — Estilo ArenaNet con sidebar, API Keys funcionales y textura
const LS_KEYS='gw2.wallet.keys.v1';
const LS_CURRENCIES='gw2.wallet.currencies.v1';
let keys=loadKeys();let currencies=null;let wallet=[];
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));const nf=new Intl.NumberFormat('es-AR');
function loadKeys(){try{return JSON.parse(localStorage.getItem(LS_KEYS))||[]}catch{return[]}}
function persistKeys(){localStorage.setItem(LS_KEYS,JSON.stringify(keys))}
function maskKey(id){return id?id.slice(0,8)+'…'+id.slice(-6):''}

function renderKeys(){
  const list=$('#keyList'); const select=$('#keySelect');
  if(!list||!select) return;
  list.innerHTML=''; select.innerHTML='';
  if(keys.length===0){
    list.innerHTML='<div class="muted">No hay claves guardadas.</div>';
    const opt=document.createElement('option'); opt.value=''; opt.textContent='—'; select.appendChild(opt); return;
  }
  keys.forEach((k,idx)=>{
    const item=document.createElement('div'); item.className='key-item';
    const head=document.createElement('div'); head.className='key-head';
    const name=document.createElement('div'); name.className='key-name'; name.textContent=k.name||'(sin nombre)';
    const secret=document.createElement('div'); secret.className='key-mask'; secret.textContent=maskKey(k.id);
    const chips=document.createElement('div'); (k.meta?.token?.permissions||[]).forEach(p=>{const c=document.createElement('span'); c.className='chip'; c.textContent=p; chips.appendChild(c);});
    head.append(name,secret,chips);
    const actions=document.createElement('div'); actions.className='key-actions';
    actions.innerHTML=`
      <button class="icon-btn" title="Copiar"><svg class="icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>
      <button class="icon-btn" title="Editar nombre"><svg class="icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04l-2.34-2.34-1.42 1.42 2.34 2.34 1.42-1.42z"/></svg></button>
      <button class="icon-btn" title="Eliminar"><svg class="icon" viewBox="0 0 24 24"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"/></svg></button>`;
    actions.children[0].addEventListener('click',()=>navigator.clipboard?.writeText(k.id));
    actions.children[1].addEventListener('click',()=>{const nuevo=prompt('Nuevo nombre para la key:',k.name||''); if(nuevo!==null){k.name=nuevo; persistKeys(); renderKeys();}});
    actions.children[2].addEventListener('click',()=>{ if(confirm('¿Eliminar esta key?')){ keys.splice(idx,1); persistKeys(); renderKeys(); $('#ownerLabel').textContent='—'; $('#walletCards').innerHTML=''; const tb=$('#walletTable tbody'); if(tb) tb.innerHTML=''; }});
    item.append(head,actions); list.appendChild(item);
    const opt=document.createElement('option'); opt.value=idx; opt.textContent=(k.name||'(sin nombre)')+' · '+maskKey(k.id); select.appendChild(opt);
  });
  select.selectedIndex=0;
}

async function validateKey(id){
  const url=`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`;
  const r=await fetch(url); if(!r.ok) throw new Error(`Token inválido (${r.status})`);
  const data=await r.json(); const perms=new Set(data.permissions||[]);
  const need=['account','wallet']; const missing=need.filter(p=>!perms.has(p));
  return {ok:missing.length===0, data, missing};
}

async function loadCurrenciesCatalog(force=false){
  if(!force){ try{ const cached=JSON.parse(localStorage.getItem(LS_CURRENCIES)); if(cached&&Array.isArray(cached.items)&&(Date.now()-cached.ts)<(1000*60*60*24*7)){ currencies=cached.items; return currencies; } }catch{}
  }
  const url='https://api.guildwars2.com/v2/currencies?ids=all';
  const r=await fetch(url); if(!r.ok) throw new Error('No se pudo cargar /v2/currencies');
  currencies=await r.json(); localStorage.setItem(LS_CURRENCIES, JSON.stringify({ts:Date.now(), items:currencies}));
  return currencies;
}

async function fetchWallet(id){
  const url=`https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(id)}`;
  const r=await fetch(url); if(!r.ok) throw new Error(`No se pudo leer la billetera (${r.status})`);
  return await r.json();
}

function formatCoins(total){const g=Math.floor(total/10000); const s=Math.floor((total%10000)/100); const c=total%100; return {g,s,c};}
const CATEGORY_MAP={4:['general','blacklion'],1:['general'],2:['general'],23:['general'],3:['general'],16:['general'],18:['general','blacklion'],63:['general'],30:['competitive'],15:['competitive'],26:['competitive'],31:['competitive'],36:['competitive'],65:['competitive'],33:['competitive'],25:['map'],27:['map'],19:['map'],22:['map'],20:['map'],29:['map'],32:['map'],34:['map'],35:['map'],45:['map'],47:['map'],50:['map'],57:['map'],58:['map'],60:['map'],67:['map'],72:['map'],73:['map'],75:['map'],76:['map'],28:['map'],70:['map'],53:['map'],77:['map'],43:['key'],41:['key'],37:['key'],42:['key'],38:['key'],44:['key'],49:['key'],51:['key'],54:['key'],71:['key'],40:['key'],7:['dungeon'],24:['dungeon'],69:['dungeon'],59:['dungeon'],39:['historic'],55:['historic'],52:['historic'],56:['historic'],5:['historic'],9:['historic'],11:['historic'],10:['historic'],13:['historic'],12:['historic'],14:['historic'],6:['historic'],74:['historic']};
const MAIN_IDS=[1,4,2,23,3,16,18,63];

function renderCards(list){
  const byId=new Map(currencies.map(c=>[c.id,c]));
  const container=$('#walletCards'); if(!container) return; container.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:'', description:''};
    const card=document.createElement('div'); card.className='card card-col';
    const header=document.createElement('div'); header.className='card-header';
    const title=document.createElement('div'); title.className='title'; title.textContent=meta.name||`ID ${entry.id}`;
    const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=meta.description||'';
    const cats=document.createElement('div'); const c=CATEGORY_MAP[entry.id]||[]; if(c.length){ cats.className='muted'; cats.style.fontSize='11px'; cats.textContent=c.join(', ');} 
    header.append(title,desc,cats);
    const footer=document.createElement('div'); footer.className='card-footer';
    const icon=document.createElement('img'); icon.alt=meta.name; icon.src=meta.icon||''; icon.width=22; icon.height=22; icon.loading='lazy';
    const amount=document.createElement('div'); amount.className='value';
    if(entry.id===1){ const {g,s,c}=formatCoins(entry.value); const wrap=document.createElement('div'); wrap.className='coins';
      const cg=document.createElement('span'); cg.className='coin g'; cg.textContent=nf.format(g)+' g';
      const cs=document.createElement('span'); cs.className='coin s'; cs.textContent=s+' s';
      const cc=document.createElement('span'); cc.className='coin c'; cc.textContent=c+' c';
      wrap.append(cg,cs,cc); amount.appendChild(wrap);
    } else { amount.textContent=nf.format(entry.value); }
    footer.append(icon,amount); card.append(header,footer); container.appendChild(card);
  });
}

function renderTable(list){
  const byId=new Map(currencies.map(c=>[c.id,c]));
  const tbody=$('#walletTable tbody'); if(!tbody) return; tbody.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:''};
    const tr=document.createElement('tr');
    const tdI=document.createElement('td'); const img=document.createElement('img'); img.src=meta.icon||''; img.alt=meta.name; img.width=20; img.height=20; img.style.borderRadius='2px'; tdI.appendChild(img);
    const tdN=document.createElement('td'); tdN.textContent=meta.name||`ID ${entry.id}`;
    const tdV=document.createElement('td'); tdV.className='right'; if(entry.id===1){ const {g,s,c}=formatCoins(entry.value); tdV.textContent=`${nf.format(g)} g ${s} s ${c} c`; } else { tdV.textContent=nf.format(entry.value);} 
    const tdC=document.createElement('td'); const cats=CATEGORY_MAP[entry.id]||[]; tdC.textContent=cats.join(', ');
    tr.append(tdI,tdN,tdV,tdC); tbody.appendChild(tr);
  });
}

function applyFilters(){
  const txt=$('#searchBox')?.value.trim().toLowerCase()||'';
  const cat=$('#categorySelect')?.value||'';
  const onlyPos=$('#onlyPositive')?.checked||false;
  const onlyMain=$('#onlyMain')?.checked||false;
  const sort=$('#sortSelect')?.value||'order';
  const dense=$('#denseMode')?.checked||false; document.body.classList.toggle('dense', dense);

  const byId=new Map(currencies.map(c=>[c.id,c]));
  let list=wallet.slice();
  list=list.filter(e=>{
    if(onlyPos && e.value<=0) return false;
    if(onlyMain && !MAIN_IDS.includes(e.id)) return false;
    const meta=byId.get(e.id)||{}; if(txt){ const hay=(meta.name||'').toLowerCase(); if(!hay.includes(txt)) return false; }
    if(cat){ const cs=CATEGORY_MAP[e.id]||[]; if(!cs.includes(cat)) return false; }
    return true;
  });

  list.sort((a,b)=>{
    if(sort==='name'){const A=(byId.get(a.id)?.name||'').toLowerCase(); const B=(byId.get(b.id)?.name||'').toLowerCase(); return A.localeCompare(B);} 
    if(sort==='amount'){return (b.value||0)-(a.value||0);} 
    const oa=byId.get(a.id)?.order??0; const ob=byId.get(b.id)?.order??0; return oa-ob; 
  });

  const view=$('#hiddenViewSelect')?.value||'cards';
  if(view==='compact'){ $('#walletCards').hidden=true; $('#walletTableWrap').hidden=false; renderTable(list);} else { $('#walletTableWrap').hidden=true; $('#walletCards').hidden=false; renderCards(list);} 
}

$('#saveBtn')?.addEventListener('click', async()=>{
  const id=$('#apiKey')?.value.trim(); if(!id){ setStatus('Ingresá una API Key.','warn'); return; }
  setStatus('Validando key…');
  try{ const res=await validateKey(id); if(!res.ok){ setStatus('Faltan permisos: '+res.missing.join(', '),'err'); return; }
    const name=$('#keyName')?.value.trim(); keys.push({id,name,meta:{token:res.data}}); persistKeys(); if($('#apiKey')) $('#apiKey').value=''; if($('#keyName')) $('#keyName').value=''; setStatus('Key agregada correctamente.','ok'); renderKeys(); }
  catch(e){ setStatus(String(e.message||e),'err'); }
});

function setStatus(msg,cls=''){ const el=$('#status'); if(!el) return; el.className='status '+cls; el.textContent=msg; }

$('#refreshBtn')?.addEventListener('click', refreshSelected);
$('#keySelect')?.addEventListener('change', refreshSelected);
['searchBox','categorySelect','onlyPositive','onlyMain','sortSelect','denseMode','hiddenViewSelect'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; const ev=(el.tagName==='INPUT'&&el.type==='text')?'input':'change'; el.addEventListener(ev, applyFilters); });

async function refreshSelected(){
  const sel=$('#keySelect'); if(!sel) return; const idx=sel.value; if(idx===''||!keys[idx]){ setStatus('No hay key seleccionada.','warn'); return; }
  const k=keys[idx]; setStatus('Cargando divisas…');
  try{ await loadCurrenciesCatalog(false); wallet=await fetchWallet(k.id); const owner=(k.meta?.token?.name?`“${k.meta.token.name}”`:maskKey(k.id)); $('#ownerLabel').textContent=owner; setStatus('Listo.','ok'); applyFilters(); }
  catch(e){ setStatus(String(e.message||e),'err'); }
}

// Init
renderKeys();
loadCurrenciesCatalog(false).catch(()=>{});
