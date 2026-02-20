// v1.4.0-preview3 — Exclusividad estricta de vistas
const LS_KEYS='gw2.wallet.keys.v1';
const LS_CURRENCIES='gw2.wallet.currencies.v1';
let keys=loadKeys(); let currencies=null; let wallet=[];
const $=s=>document.querySelector(s);

function loadKeys(){ try{return JSON.parse(localStorage.getItem(LS_KEYS))||[]}catch{return[]} }
function persistKeys(){ localStorage.setItem(LS_KEYS, JSON.stringify(keys)); }
function maskKey(id){ return id ? id.slice(0,8)+'…'+id.slice(-6) : ''; }

// --- exclusividad: helpers sólidos usando style.display ---
function showCards(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='grid'} if(b){b.style.display='none'} }
function showCompact(){ const a=$('#walletCards'), b=$('#walletTableWrap'); if(a){a.style.display='none'} if(b){b.style.display='block'} }

// Tabs
$('#tabCards')?.addEventListener('click',()=>{ showCards(); applyFilters(); document.getElementById('tabCards').classList.add('an-tab--active'); document.getElementById('tabCompact').classList.remove('an-tab--active'); });
$('#tabCompact')?.addEventListener('click',()=>{ showCompact(); applyFilters(); document.getElementById('tabCompact').classList.add('an-tab--active'); document.getElementById('tabCards').classList.remove('an-tab--active'); });

// API helpers (mínimos para la prueba de vistas)
async function loadCurrenciesCatalog(force=false){
  if(!force){ try{ const cached=JSON.parse(localStorage.getItem(LS_CURRENCIES)); if(cached&&Array.isArray(cached.items)&&(Date.now()-cached.ts)<(1000*60*60*24*7)){ currencies=cached.items; return currencies; } }catch{}
  }
  const r=await fetch('https://api.guildwars2.com/v2/currencies?ids=all'); if(!r.ok) throw new Error('No se pudo cargar /v2/currencies');
  currencies=await r.json(); localStorage.setItem(LS_CURRENCIES, JSON.stringify({ts:Date.now(), items:currencies})); return currencies;
}

function setStatus(msg){ const el=$('#status'); if(el) el.textContent=msg }

function applyFilters(){
  // Respetar la vista actual por style.display
  if($('#walletTableWrap').style.display==='block'){
    // compacta
    renderTable(wallet||[]);
  } else {
    // tarjetas
    renderCards(wallet||[]);
  }
}

function renderCards(list){ const c=$('#walletCards'); c.innerHTML='';
  for(let i=0;i<6;i++){ const d=document.createElement('div'); d.className='card'; d.textContent='Card '+(i+1); c.appendChild(d); }
}

function renderTable(list){ const tb=document.querySelector('#walletTable tbody'); if(!tb) return; tb.innerHTML='';
  for(let i=0;i<6;i++){ const tr=document.createElement('tr'); tr.innerHTML='<td>•</td><td>Divisa '+(i+1)+'</td><td class="right">1,234</td><td>general</td>'; tb.appendChild(tr); }
}

// Init
showCards();
loadCurrenciesCatalog(false).then(()=>{ applyFilters(); }).catch(()=>{});
