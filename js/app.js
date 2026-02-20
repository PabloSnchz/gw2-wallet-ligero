// ==========================
//  GW2 Wallet (ligero) – Estilo ArenaNet (v1.2.0)
//  Five-pack: tema oscuro, header, tarjetas, hovers/botones rojos,
//  tipografía compacta
// ==========================

const LS_KEYS = 'gw2.wallet.keys.v1';
const LS_CURRENCIES = 'gw2.wallet.currencies.v1';

let keys = loadKeys();
let currencies = null; // catálogo
let wallet = []; // último resultado de la billetera

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const statusEl = $('#status');
const nf = new Intl.NumberFormat('es-AR');

function status(msg, cls=''){
  if(!statusEl) return;
  statusEl.className = 'status ' + cls;
  statusEl.textContent = msg;
}

function loadKeys(){
  try{ return JSON.parse(localStorage.getItem(LS_KEYS)) || []; }
  catch{ return []; }
}
function persistKeys(){ localStorage.setItem(LS_KEYS, JSON.stringify(keys)); }

function mask(key){ return key ? key.slice(0,8) + '…' + key.slice(-6) : ''; }

function renderKeySelect(){
  const sel = $('#keySelect');
  if(!sel) return;
  sel.innerHTML = '';
  if(keys.length === 0){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— No hay API Keys guardadas —';
    sel.appendChild(opt);
    return;
  }
  keys.forEach((k, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${k.name || '(sin nombre)'} · ${mask(k.id)}`;
    sel.appendChild(opt);
  });
  sel.selectedIndex = 0;
}

// --- Validación de key (/v2/tokeninfo) ---
async function validateKey(id){
  const url = `https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(id)}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Token inválido (${r.status})`);
  const data = await r.json();
  const perms = new Set(data.permissions || []);
  const need = ['account','wallet'];
  const missing = need.filter(p => !perms.has(p));
  return { ok: missing.length === 0, data, missing };
}

// --- Catálogo de divisas ---
async function loadCurrenciesCatalog(force=false){
  if(!force){
    try {
      const cached = JSON.parse(localStorage.getItem(LS_CURRENCIES));
      if(cached && Array.isArray(cached.items) && (Date.now() - cached.ts) < (1000*60*60*24*7)){
        currencies = cached.items;
        return currencies;
      }
    } catch {}
  }
  const url = 'https://api.guildwars2.com/v2/currencies?ids=all';
  const r = await fetch(url);
  if(!r.ok) throw new Error('No se pudo cargar /v2/currencies');
  currencies = await r.json();
  localStorage.setItem(LS_CURRENCIES, JSON.stringify({ts:Date.now(), items:currencies}));
  return currencies;
}

// --- Billetera ---
async function fetchWallet(id){
  const url = `https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(id)}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`No se pudo leer la billetera (${r.status})`);
  return await r.json();
}

// --- Formateo de monedas ---
function formatCoins(totalCopper){
  const g = Math.floor(totalCopper / 10000);
  const s = Math.floor((totalCopper % 10000) / 100);
  const c = totalCopper % 100;
  return { g, s, c };
}

// --- Mapeo de categorías (comunitario) ---
const CATEGORY_MAP = {
  // Generales
  4:['general','blacklion'], 1:['general'], 2:['general'], 23:['general'],
  3:['general'], 16:['general'], 18:['general','blacklion'], 63:['general'],
  // Competitivas
  30:['competitive'], 15:['competitive'], 26:['competitive'], 31:['competitive'],
  36:['competitive'], 65:['competitive'], 33:['competitive'],
  // Mapas
  25:['map'],27:['map'],19:['map'],22:['map'],20:['map'],29:['map'],32:['map'],34:['map'],35:['map'],45:['map'],47:['map'],50:['map'],57:['map'],58:['map'],60:['map'],67:['map'],72:['map'],73:['map'],75:['map'],76:['map'],28:['map'],70:['map'],53:['map'],77:['map'],
  // Llaves
  43:['key'],41:['key'],37:['key'],42:['key'],38:['key'],44:['key'],49:['key'],51:['key'],54:['key'],71:['key'],40:['key'],
  // Mazmorras/Fractales
  7:['dungeon'],24:['dungeon'],69:['dungeon'],59:['dungeon'],
  // Históricas
  39:['historic'],55:['historic'],52:['historic'],56:['historic'],5:['historic'],9:['historic'],11:['historic'],10:['historic'],13:['historic'],12:['historic'],14:['historic'],6:['historic'],74:['historic']
};

// Lista de principales (filtro)
const MAIN_IDS = [1,4,2,23,3,16,18,63];

// --- Render tarjetas (layout header+footer) ---
function renderCards(list){
  const byId = new Map(currencies.map(c => [c.id, c]));
  const container = $('#walletCards');
  if(!container) return;
  container.innerHTML = '';

  list.forEach(entry => {
    const meta = byId.get(entry.id) || { name:`ID ${entry.id}`, icon:'', description:'' };

    const card = document.createElement('div');
    card.className = 'card card-col';

    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('div'); title.className = 'title'; title.textContent = meta.name || `ID ${entry.id}`;
    const desc = document.createElement('div'); desc.className = 'muted'; desc.style.fontSize = '12px'; desc.textContent = meta.description || '';
    const cats = document.createElement('div');
    const c = CATEGORY_MAP[entry.id] || [];
    if(c.length){ cats.className = 'muted'; cats.style.fontSize = '11px'; cats.textContent = c.join(', '); }
    header.append(title, desc, cats);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const icon = document.createElement('img'); icon.alt = meta.name; icon.src = meta.icon || ''; icon.width = 22; icon.height = 22; icon.loading='lazy';

    const amount = document.createElement('div'); amount.className = 'value';
    if(entry.id === 1){
      const {g,s,c:cc} = formatCoins(entry.value);
      const wrap = document.createElement('div'); wrap.className = 'coins';
      const cg = document.createElement('span'); cg.className = 'coin g'; cg.textContent = nf.format(g)+' g';
      const cs = document.createElement('span'); cs.className = 'coin s'; cs.textContent = s+' s';
      const ccc = document.createElement('span'); ccc.className = 'coin c'; ccc.textContent = cc+' c';
      wrap.append(cg, cs, ccc);
      amount.appendChild(wrap);
    } else {
      amount.textContent = nf.format(entry.value);
    }

    footer.append(icon, amount);
    card.append(header, footer);
    container.appendChild(card);
  });
}

// --- Render tabla compacta ---
function renderTable(list){
  const byId = new Map(currencies.map(c => [c.id, c]));
  const tbody = $('#walletTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  list.forEach(entry => {
    const meta = byId.get(entry.id) || { name:`ID ${entry.id}`, icon:'' };
    const tr = document.createElement('tr');
    const tdI = document.createElement('td');
    const img = document.createElement('img'); img.src = meta.icon || ''; img.alt = meta.name; img.width = 20; img.height = 20; img.style.borderRadius='2px';
    tdI.appendChild(img);
    const tdN = document.createElement('td'); tdN.textContent = meta.name || `ID ${entry.id}`;
    const tdV = document.createElement('td'); tdV.className = 'right';
    if(entry.id === 1){
      const {g,s,c} = formatCoins(entry.value);
      tdV.textContent = `${nf.format(g)} g ${s} s ${c} c`;
    } else { tdV.textContent = nf.format(entry.value); }
    const tdC = document.createElement('td');
    const cats = CATEGORY_MAP[entry.id] || [];
    tdC.textContent = cats.join(', ');
    tr.append(tdI, tdN, tdV, tdC);
    tbody.appendChild(tr);
  });
}

// --- Filtro/orden/vista ---
function applyFilters(){
  const txt = $('#searchBox')?.value.trim().toLowerCase() || '';
  const cat = $('#categorySelect')?.value || '';
  const onlyPos = $('#onlyPositive')?.checked || false;
  const onlyMain = $('#onlyMain')?.checked || false;
  const sort = $('#sortSelect')?.value || 'order';

  const byId = new Map(currencies.map(c => [c.id, c]));

  let list = wallet.slice();
  list = list.filter(e => {
    if(onlyPos && e.value <= 0) return false;
    if(onlyMain && !MAIN_IDS.includes(e.id)) return false;
    const meta = byId.get(e.id) || {};
    if(txt){
      const hay = (meta.name || '').toLowerCase();
      if(!hay.includes(txt)) return false;
    }
    if(cat){
      const cs = CATEGORY_MAP[e.id] || [];
      if(!cs.includes(cat)) return false;
    }
    return true;
  });

  list.sort((a,b)=>{
    if(sort === 'name'){
      const A = (byId.get(a.id)?.name || '').toLowerCase();
      const B = (byId.get(b.id)?.name || '').toLowerCase();
      return A.localeCompare(B);
    }
    if(sort === 'amount'){
      return (b.value||0) - (a.value||0);
    }
    const oa = byId.get(a.id)?.order ?? 0;
    const ob = byId.get(b.id)?.order ?? 0;
    return oa - ob;
  });

  const view = $('#viewSelect')?.value || 'cards';
  if(view === 'compact'){
    $('#walletCards').hidden = true;
    $('#walletTableWrap').hidden = false;
    renderTable(list);
  } else {
    $('#walletTableWrap').hidden = true;
    $('#walletCards').hidden = false;
    renderCards(list);
  }
}

// --- Eventos de UI ---
$('#saveBtn')?.addEventListener('click', async ()=>{
  const id = $('#apiKey').value.trim();
  if(!id){ status('Ingresá una API Key.', 'warn'); return; }
  status('Validando key…');
  try{
    const res = await validateKey(id);
    if(!res.ok){ status(`Faltan permisos: ${res.missing.join(', ')}`, 'err'); return; }
    const name = $('#keyName').value.trim();
    keys.push({ id, name, meta: { token: res.data } });
    persistKeys();
    renderKeySelect();
    $('#apiKey').value = ''; $('#keyName').value = '';
    status('Key agregada correctamente.', 'ok');
  }catch(e){ status(String(e.message || e), 'err'); }
});

$('#deleteBtn')?.addEventListener('click', ()=>{
  const i = $('#keySelect').value;
  if(i === '' || !keys[i]) return;
  const removed = keys.splice(i,1)[0];
  persistKeys();
  renderKeySelect();
  $('#walletCards').innerHTML = '';
  $('#walletTable tbody').innerHTML = '';
  $('#ownerLabel').textContent = '—';
  status(`Key eliminada: ${removed.name || mask(removed.id)}`, 'ok');
});

async function refreshSelected(){
  const idx = $('#keySelect').value;
  if(idx === '' || !keys[idx]){ status('No hay key seleccionada.', 'warn'); return; }
  const k = keys[idx];
  status('Cargando divisas…');
  try{
    await loadCurrenciesCatalog(false);
    wallet = await fetchWallet(k.id);
    const owner = (k.meta?.token?.name ? `“${k.meta.token.name}”` : mask(k.id));
    $('#ownerLabel').textContent = owner;
    status('Listo.', 'ok');
    applyFilters();
  }catch(e){ status(String(e.message || e), 'err'); }
}

$('#refreshBtn')?.addEventListener('click', refreshSelected);
$('#keySelect')?.addEventListener('change', refreshSelected);

['searchBox','categorySelect','onlyPositive','onlyMain','sortSelect','viewSelect'].forEach(id=>{
  const el = document.getElementById(id);
  el && el.addEventListener(el.tagName==='INPUT' && el.type==='text' ? 'input' : 'change', applyFilters);
});

// Init
renderKeySelect();
loadCurrenciesCatalog(false).catch(()=>{});
