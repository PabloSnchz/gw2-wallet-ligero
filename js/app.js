
// v1.4.0-preview4 — Full build con exclusividad estricta integrada
// - Account Name (nombre.####) junto al combo (desde /v2/account)
// - Exclusividad estricta Tarjetas/Compacta con style.display
// - Iconos de acciones junto al combo
// - Densidad ArenaNet por defecto (sin selector)

const LS_KEYS='gw2.wallet.keys.v1';
const LS_CURRENCIES='gw2.wallet.currencies.v1';
let keys=loadKeys(); let currencies=null; let wallet=[];
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
const nf=new Intl.NumberFormat('es-AR');

function loadKeys(){ try{return JSON.parse(localStorage.getItem(LS_KEYS))||[]}catch{return[]} }
function persistKeys(){ localStorage.setItem(LS_KEYS, JSON.stringify(keys)); }
function maskKey(id){ return id ? id.slice(0,8)+'…'+id.slice(-6) : ''; }

// ---- API helpers ----
async function validateKey(id){
  const url=`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`;
  const r=await fetch(url); if(!r.ok) throw new Error(`Token inválido (${r.status})`);
  return await r.json(); // {name, permissions:[...], ...}
}
async function fetchAccount(id){
  const url=`https://api.guildwars2.com/v2/account?access_token=${encodeURIComponent(id)}`;
  const r=await fetch(url); if(!r.ok) throw new Error(`No se pudo leer /v2/account (${r.status})`);
  return await r.json(); // { id (GUID), name (shiruvano.3084), ... }
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

function setStatus(msg, cls=''){ const el=$('#status'); if(!el) return; el.className='status '+cls; el.textContent=msg; }
function formatCoins(total){ const g=Math.floor(total/10000); const s=Math.floor((total%10000)/100); const c=total%100; return {g,s,c}; }

function renderKeySelect(){
  const sel=$('#keySelect'); sel.innerHTML='';
  if(keys.length===0){ const opt=document.createElement('option'); opt.value=''; opt.textContent='— No hay API Keys guardadas —'; sel.appendChild(opt); return; }
  keys.forEach((k,idx)=>{ const opt=document.createElement('option'); opt.value=idx; opt.textContent=`${k.name||'(sin nombre)'} · ${maskKey(k.id)}`; sel.appendChild(opt); });
  sel.selectedIndex=0;
}

// ---- Exclusividad estricta
function showCards(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='grid'} if(b){b.style.display='none'} }
function showCompact(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='none'} if(b){b.style.display='block'} }

// Tabs
$('#tabCards')?.addEventListener('click',()=>{ showCards(); applyFilters(); $('#tabCards').classList.add('an-tab--active'); $('#tabCompact').classList.remove('an-tab--active'); });
$('#tabCompact')?.addEventListener('click',()=>{ showCompact(); applyFilters(); $('#tabCompact').classList.add('an-tab--active'); $('#tabCards').classList.remove('an-tab--active'); });

// categorías (mapeo resumido)
const CATEGORY_MAP={ 4:['general','blacklion'],1:['general'],2:['general'],23:['general'],3:['general'],16:['general'],18:['general','blacklion'],63:['general'], 30:['competitive'],15:['competitive'],26:['competitive'],31:['competitive'],36:['competitive'],65:['competitive'],33:['competitive'], 25:['map'],27:['map'],19:['map'],22:['map'],20:['map'],29:['map'],32:['map'],34:['map'],35:['map'],45:['map'],47:['map'],50:['map'],57:['map'],58:['map'],60:['map'],67:['map'],72:['map'],73:['map'],75:['map'],76:['map'],28:['map'],70:['map'],53:['map'],77:['map'], 43:['key'],41:['key'],37:['key'],42:['key'],38:['key'],44:['key'],49:['key'],51:['key'],54:['key'],71:['key'],40:['key'], 7:['dungeon'],24:['dungeon'],69:['dungeon'],59:['dungeon'], 39:['historic'],55:['historic'],52:['historic'],56:['historic'],5:['historic'],9:['historic'],11:['historic'],10:['historic'],13:['historic'],12:['historic'],14:['historic'],6:['historic'],74:['historic'] };
const MAIN_IDS=[1,4,2,23,3,16,18,63];

function applyFilters(){
  if(!currencies) return;
  const txt=$('#searchBox')?.value.trim().toLowerCase()||'';
  const cat=$('#categorySelect')?.value||'';
  const onlyPos=$('#onlyPositive')?.checked||false;
  const onlyMain=$('#onlyMain')?.checked||false;
  const sort=$('#sortSelect')?.value||'order';

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
    if(sort==='name'){ const A=(byId.get(a.id)?.name||'').toLowerCase(); const B=(byId.get(b.id)?.name||'').toLowerCase(); return A.localeCompare(B); }
    if(sort==='amount'){ return (b.value||0)-(a.value||0); }
    const oa=byId.get(a.id)?.order??0; const ob=byId.get(b.id)?.order??0; return oa-ob;
  });

  // Respetar la vista actual por style.display
  if($('#walletTableWrap').style.display==='block'){
    renderTable(list);
  } else {
    renderCards(list);
  }
}

function renderCards(list){
  const byId=new Map(currencies.map(c=>[c.id,c]));
  const container=$('#walletCards'); container.innerHTML='';
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
  const tbody=$('#walletTable tbody'); tbody.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:''};
    const tr=document.createElement('tr');
    const tdI=document.createElement('td'); const img=document.createElement('img'); img.src=meta.icon||''; img.alt=meta.name; img.width=20; img.height=20; img.style.borderRadius='2px'; tdI.appendChild(img);
    const tdN=document.createElement('td'); tdN.textContent=meta.name||`ID ${entry.id}`;
    const tdV=document.createElement('td'); tdV.className='right';
    if(entry.id===1){ const {g,s,c}=formatCoins(entry.value); tdV.textContent=`${nf.format(g)} g ${s} s ${c} c`; } else { tdV.textContent=nf.format(entry.value); }
    const tdC=document.createElement('td'); const cats=CATEGORY_MAP[entry.id]||[]; tdC.textContent=cats.join(', ');
    tr.append(tdI,tdN,tdV,tdC); tbody.appendChild(tr);
  });
}

// ---- Acciones: combo y botones a la derecha ----
$('#copyKeyBtn')?.addEventListener('click', ()=>{ const i=$('#keySelect').value; if(i===''||!keys[i]) return; navigator.clipboard?.writeText(keys[i].id); });
$('#renameKeyBtn')?.addEventListener('click', ()=>{ const i=$('#keySelect').value; if(i===''||!keys[i]) return; const nuevo=prompt('Nuevo nombre para la key:', keys[i].name||''); if(nuevo!==null){ keys[i].name=nuevo; persistKeys(); renderKeySelect(); }});
$('#deleteKeyBtn')?.addEventListener('click', ()=>{ const i=$('#keySelect').value; if(i===''||!keys[i]) return; if(confirm('¿Eliminar esta key?')){ const removed=keys.splice(i,1)[0]; persistKeys(); renderKeySelect(); $('#ownerLabel').textContent='—'; $('#walletCards').innerHTML=''; const tb=$('#walletTable tbody'); if(tb) tb.innerHTML=''; setStatus(`Key eliminada: ${removed.name||maskKey(removed.id)}`,'ok'); }});
$('#refreshBtn')?.addEventListener('click', refreshSelected);
$('#keySelect')?.addEventListener('change', refreshSelected);

['searchBox','categorySelect','onlyPositive','onlyMain','sortSelect'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; const ev=(el.tagName==='INPUT'&&el.type==='text')?'input':'change'; el.addEventListener(ev, applyFilters); });

async function refreshSelected(){
  const idx=$('#keySelect').value; if(idx===''||!keys[idx]){ setStatus('No hay key seleccionada.','warn'); return; }
  const k=keys[idx]; setStatus('Cargando datos…');
  try{
    // Validar permisos y obtener Account NAME (name: nombre.####)
    const token=await validateKey(k.id); // token.permissions
    if(!new Set(token.permissions||[]).has('account')){ setStatus('Falta permiso: account','err'); $('#ownerLabel').textContent='—'; return; }
    const acc=await fetchAccount(k.id); // {id(GUID), name(nombre.####)}
    $('#ownerLabel').textContent=acc.name || '—';

    await loadCurrenciesCatalog(false);
    if(!new Set(token.permissions||[]).has('wallet')){ setStatus('Falta permiso: wallet (no se podrán leer saldos)', 'warn'); wallet=[]; applyFilters(); return; }

    wallet=await fetchWallet(k.id);
    setStatus('Listo.','ok');
    applyFilters();
  }catch(e){ setStatus(String(e.message||e),'err'); $('#ownerLabel').textContent='—'; }
}

// ---- Init ----
renderKeySelect();
loadCurrenciesCatalog(false).catch(()=>{});
showCards(); // vista por defecto
