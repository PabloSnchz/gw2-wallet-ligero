
// v1.5.0-pre2 API patch — SOLO lógica de llamadas (sin cambios de diseño)
// - Normaliza llamadas a GW2 API con fetch robusto (timeout, reintentos, no-store)
// - Corrige/asegura uso de campos quantity / coins_per_gem en Exchange
// - No cambia HTML/CSS ni otras interacciones

const LS_KEYS='gw2.wallet.keys.v1';
const LS_CURRENCIES='gw2.wallet.currencies.v1';
const LS_FAVS='gw2.wallet.favorites.v1';
let keys=loadKeys(); let currencies=null; let wallet=[]; let favs=loadFavs();
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));
const nf=new Intl.NumberFormat('es-AR');

function loadKeys(){ try{return JSON.parse(localStorage.getItem(LS_KEYS))||[]}catch{return[]} }
function persistKeys(){ localStorage.setItem(LS_KEYS, JSON.stringify(keys)); }
function loadFavs(){ try{return JSON.parse(localStorage.getItem(LS_FAVS))||[]}catch{return[]} }
function persistFavs(){ localStorage.setItem(LS_FAVS, JSON.stringify(favs)); }
function maskKey(id){ return id ? id.slice(0,8)+'…'+id.slice(-6) : ''; }

// ---- Fetch robusto (timeout + reintentos + cache control) ----
async function robustFetch(url, {retries=1, timeoutMs=8000}={}){
  for(let attempt=0; attempt<=retries; attempt++){
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      const r=await fetch(url, {signal: ctrl.signal, cache:'no-store', mode:'cors'});
      clearTimeout(t);
      if(!r.ok){
        // 429/5xx: reintentar si queda intento
        if((r.status===429 || r.status>=500) && attempt<retries) { await new Promise(res=>setTimeout(res, 600)); continue; }
        throw new Error(`HTTP ${r.status}`);
      }
      return await r.json();
    }catch(err){
      clearTimeout(t);
      if(attempt<retries) { await new Promise(res=>setTimeout(res, 600)); continue; }
      throw err;
    }
  }
}

// ---- API helpers (usan robustFetch) ----
async function validateKey(id){
  const url=`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`;
  return await robustFetch(url, {retries:1});
}
async function fetchAccount(id){
  const url=`https://api.guildwars2.com/v2/account?access_token=${encodeURIComponent(id)}`;
  return await robustFetch(url, {retries:1});
}
async function loadCurrenciesCatalog(force=false){
  if(!force){ try{ const cached=JSON.parse(localStorage.getItem(LS_CURRENCIES)); if(cached&&Array.isArray(cached.items)&&(Date.now()-cached.ts)<(1000*60*60*24*7)){ currencies=cached.items; return currencies; } }catch{}
  }
  const url='https://api.guildwars2.com/v2/currencies?ids=all';
  currencies=await robustFetch(url, {retries:1});
  localStorage.setItem(LS_CURRENCIES, JSON.stringify({ts:Date.now(), items:currencies}));
  return currencies;
}
async function fetchWallet(id){
  const url=`https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(id)}`;
  return await robustFetch(url, {retries:1});
}

// ---- UI helpers ----
function setStatus(msg, cls=''){ const el=$('#status'); if(!el) return; el.className='status '+cls; el.textContent=msg; }
function formatCoins(total){ const g=Math.floor(total/10000); const s=Math.floor((total%10000)/100); const c=total%100; return {g,s,c}; }
function coinBoxes(total){ const {g,s,c}=formatCoins(total); const wrap=document.createElement('div'); wrap.className='coins';
  const G=document.createElement('span'); G.className='coin-box g'; G.textContent=`${nf.format(g)} g`;
  const S=document.createElement('span'); S.className='coin-box s'; S.textContent=`${s} s`;
  const C=document.createElement('span'); C.className='coin-box c'; C.textContent=`${c} c`;
  wrap.append(G,S,C); return wrap; }

function renderKeySelect(){
  const sel=$('#keySelect'); sel.innerHTML='';
  if(keys.length===0){ const opt=document.createElement('option'); opt.value=''; opt.textContent='— No hay API Keys guardadas —'; sel.appendChild(opt); return; }
  keys.forEach((k,idx)=>{ const opt=document.createElement('option'); opt.value=idx; opt.textContent=`${k.name||'(sin nombre)'} · ${maskKey(k.id)}`; sel.appendChild(opt); });
  sel.selectedIndex=0;
}

function showCards(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='grid'} if(b){b.style.display='none'} }
function showCompact(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='none'} if(b){b.style.display='block'} }
$('#tabCards')?.addEventListener('click',()=>{ showCards(); applyFilters(); $('#tabCards').classList.add('an-tab--active'); $('#tabCompact').classList.remove('an-tab--active'); });
$('#tabCompact')?.addEventListener('click',()=>{ showCompact(); applyFilters(); $('#tabCompact').classList.add('an-tab--active'); $('#tabCards').classList.remove('an-tab--active'); });

const CATEGORY_MAP={ 4:['general','blacklion'],1:['general'],2:['general'],23:['general'],3:['general'],16:['general'],18:['general','blacklion'],63:['general'] };
const MAIN_IDS=[1,4,2,23,3,16,18,63];

function isTableView(){ return $('#walletTableWrap').style.display==='block'; }

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
    if(cat){ const cs=(CATEGORY_MAP[e.id]||[]); if(!cs.includes(cat)) return false; }
    return true;
  });

  list.sort((a,b)=>{
    if(sort==='name'){ const A=(byId.get(a.id)?.name||'').toLowerCase(); const B=(byId.get(b.id)?.name||'').toLowerCase(); return A.localeCompare(B); }
    if(sort==='amount'){ return (b.value||0)-(a.value||0); }
    const oa=byId.get(a.id)?.order??0; const ob=byId.get(b.id)?.order??0; return oa-ob;
  });

  const favSet=new Set(favs);
  const favList=list.filter(x=>favSet.has(x.id));
  const rest=list.filter(x=>!favSet.has(x.id));

  if(isTableView()){
    const block=$('#favBlock'); if(block){ block.hidden=true; $('#favCards').innerHTML=''; }
    renderTable(favList.concat(rest), byId, favSet);
  } else {
    renderFavCards(favList, byId);
    renderCards(rest, byId, favSet);
  }
}

function renderFavCards(list, byId){
  const block=$('#favBlock'); const cont=$('#favCards');
  if(!list || list.length===0){ block.hidden=true; cont.innerHTML=''; return; }
  block.hidden=false; cont.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:'', description:''};
    const card=document.createElement('div'); card.className='card card-col';
    const star=document.createElement('div'); star.className='star active'; star.textContent='★'; star.title='Quitar de favoritas'; star.addEventListener('click',()=>toggleFav(entry.id));
    const title=document.createElement('div'); title.className='title'; title.textContent=meta.name||`ID ${entry.id}`;
    const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=meta.description||'';
    const footer=document.createElement('div'); footer.className='card-footer';
    const icon=document.createElement('img'); icon.alt=meta.name; icon.src=meta.icon||''; icon.width=22; icon.height=22; icon.loading='lazy';
    const amount=document.createElement('div'); amount.className='value';
    if(entry.id===1){ amount.appendChild(coinBoxes(entry.value)); } else { amount.textContent=nf.format(entry.value); }
    footer.append(icon,amount);
    card.append(star,title,desc,footer); cont.appendChild(card);
  });
}

function renderCards(list, byId, favSet){
  const container=$('#walletCards'); container.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:'', description:''};
    const card=document.createElement('div'); card.className='card card-col';
    const star=document.createElement('div'); star.className='star'+(favSet.has(entry.id)?' active':''); star.textContent='★'; star.title=favSet.has(entry.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(entry.id));
    const title=document.createElement('div'); title.className='title'; title.textContent=meta.name||`ID ${entry.id}`;
    const desc=document.createElement('div'); desc.className='muted'; desc.style.fontSize='12px'; desc.textContent=meta.description||'';
    const footer=document.createElement('div'); footer.className='card-footer';
    const icon=document.createElement('img'); icon.alt=meta.name; icon.src=meta.icon||''; icon.width=22; icon.height=22; icon.loading='lazy';
    const amount=document.createElement('div'); amount.className='value';
    if(entry.id===1){ amount.appendChild(coinBoxes(entry.value)); } else { amount.textContent=nf.format(entry.value); }
    footer.append(icon,amount);
    card.append(star,title,desc,footer); container.appendChild(card);
  });
}

function renderTable(list, byId, favSet){
  const tbody=$('#walletTable tbody'); tbody.innerHTML='';
  list.forEach(entry=>{
    const meta=byId.get(entry.id)||{name:`ID ${entry.id}`, icon:''};
    const tr=document.createElement('tr');
    const tdI=document.createElement('td'); const img=document.createElement('img'); img.src=meta.icon||''; img.alt=meta.name; img.width=20; img.height=20; img.style.borderRadius='2px'; tdI.appendChild(img);
    const tdN=document.createElement('td'); tdN.textContent=meta.name||`ID ${entry.id}`;
    const tdV=document.createElement('td'); tdV.className='right';
    if(entry.id===1){ tdV.appendChild(coinBoxes(entry.value)); } else { tdV.textContent=nf.format(entry.value); }
    const tdC=document.createElement('td'); const cats=(CATEGORY_MAP[entry.id]||[]); tdC.textContent=cats.join(', ');
    const tdF=document.createElement('td'); tdF.className='right'; const star=document.createElement('span'); star.textContent='★'; star.className='star'+(favSet.has(entry.id)?' active':''); star.style.position='static'; star.title=favSet.has(entry.id)?'Quitar de favoritas':'Marcar como favorita'; star.addEventListener('click',()=>toggleFav(entry.id)); tdF.appendChild(star);
    tr.append(tdI,tdN,tdV,tdC,tdF); tbody.appendChild(tr);
  });
}

function toggleFav(id){
  const i=favs.indexOf(id); if(i>=0) favs.splice(i,1); else favs.push(id);
  persistFavs(); applyFilters();
}

// ---- Acciones combo ----
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
    const token=await validateKey(k.id); // token.permissions
    if(!new Set(token.permissions||[]).has('account')){ setStatus('Falta permiso: account','err'); $('#ownerLabel').textContent='—'; return; }
    const acc=await fetchAccount(k.id);
    $('#ownerLabel').textContent=acc.name || '—';

    await loadCurrenciesCatalog(false);
    if(!new Set(token.permissions||[]).has('wallet')){ setStatus('Falta permiso: wallet (no se podrán leer saldos)', 'warn'); wallet=[]; applyFilters(); return; }

    wallet=await fetchWallet(k.id);
    setStatus('Listo.','ok');
    applyFilters();
  }catch(e){ setStatus(`Error cargando datos: ${String(e.message||e)}`,'err'); $('#ownerLabel').textContent='—'; }
}

// ---- Conversor Gem ↔ Gold (Exchange oficial)
function parseGoldInput(s){
  if(!s) return 0; let g=0,sil=0,c=0; s=s.toLowerCase();
  const rg=/(\d+)\s*g/; const rs=/(\d+)\s*s/; const rc=/(\d+)\s*c/;
  const mg=rg.exec(s); const ms=rs.exec(s); const mc=rc.exec(s);
  if(mg) g=parseInt(mg[1]); if(ms) sil=parseInt(ms[1]); if(mc) c=parseInt(mc[1]);
  if(!mg&&!ms&&!mc){ const n=parseFloat(s.replace(/,/g,'.'))||0; g=Math.floor(n); }
  return g*10000 + sil*100 + c;
}
function fmtCoins(c){ const {g,s,c:c2}=formatCoins(c); return `${nf.format(g)} g ${s} s ${c2} c`; }

let lastExchangeTs=0; let lastGemsResp=null; let lastCoinsResp=null;
const EX_TTL=30000;

$('#btnG2C')?.addEventListener('click', async()=>{
  const q=parseInt($('#convGems').value||'0'); if(!q||q<=0){ $('#outG2C').textContent='Ingrese una cantidad válida de gemas'; return; }
  try{
    $('#convStatus').textContent='Consultando Exchange…';
    const now=Date.now();
    if(!lastGemsResp || (now-lastExchangeTs)>EX_TTL || lastGemsResp.q!==q){
      const url=`https://api.guildwars2.com/v2/commerce/exchange/gems?quantity=${q}`;
      lastGemsResp=await robustFetch(url, {retries:2, timeoutMs:8000});
      lastGemsResp.q=q; lastExchangeTs=now;
    }
    const coins=Number(lastGemsResp.quantity)||0; // cobre que recibís
    const box=coinBoxes(coins); const out=$('#outG2C'); out.innerHTML=''; out.appendChild(box);
    $('#convStatus').textContent=`≈ ${lastGemsResp.coins_per_gem} cobre/gema · tasas actualizadas.`;
  }catch(err){ $('#outG2C').textContent='Error consultando Exchange'; $('#convStatus').textContent=String(err.message||err); }
});

$('#btnC2G')?.addEventListener('click', async()=>{
  const copper=parseGoldInput($('#convGold').value||''); if(!copper||copper<=0){ $('#outC2G').textContent='Ingrese un monto de oro válido'; return; }
  try{
    $('#convStatus').textContent='Consultando Exchange…';
    const now=Date.now();
    if(!lastCoinsResp || (now-lastExchangeTs)>EX_TTL || lastCoinsResp.c!==copper){
      const url=`https://api.guildwars2.com/v2/commerce/exchange/coins?quantity=${copper}`;
      lastCoinsResp=await robustFetch(url, {retries:2, timeoutMs:8000});
      lastCoinsResp.c=copper; lastExchangeTs=now;
    }
    const gems=Number(lastCoinsResp.quantity||lastCoinsResp.gems)||0; // tolerante a cambios
    $('#outC2G').textContent=`${fmtCoins(copper)} ≈ ${gems} gemas`;
    $('#convStatus').textContent=`≈ ${lastCoinsResp.coins_per_gem} cobre/gema · tasas actualizadas.`;
  }catch(err){ $('#outC2G').textContent='Error consultando Exchange'; $('#convStatus').textContent=String(err.message||err); }
});

// ---- Init ----
renderKeySelect();
loadCurrenciesCatalog(false).catch(()=>{});
showCards();
