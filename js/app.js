/* eslint-disable no-console */
// js/app.js  (ES module)
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

console.info('%cGW2 Wallet app.js v1.3.4','color:#0bf; font-weight:700');

const state = {
  keys: [], selected: null, accountName: '—',
  currencies: new Map(), currenciesLoaded: false,
  wallet: [],
  filters: { q:'', cat:'', sort:'order', onlyPos:false, onlyMain:false },
  favs: new Set(),
  view: 'cards',
};

const LS_KEYS='gw2_keys';
const LS_FAVS='gw2_favs';
const LS_CURR='gw2_currencies_cache_v1';
const CURR_TTL = 1000*60*60*24*7;

const API = {
  withToken: (url,t)=>`${url}${url.includes('?')?'&':'?'}access_token=${encodeURIComponent(t)}`,
  async json(url){ const r=await fetch(url,{headers:{'Accept':'application/json'},cache:'no-store'}); if(!r.ok) throw new Error(await r.text()||`HTTP ${r.status}`); return r.json(); },
  tokenInfo: (t)=>API.json(API.withToken('https://api.guildwars2.com/v2/tokeninfo',t)),
  account:   (t)=>API.json(API.withToken('https://api.guildwars2.com/v2/account',t)),
  wallet:    (t)=>API.json(API.withToken('https://api.guildwars2.com/v2/account/wallet',t)),
  currencies:()=>API.json('https://api.guildwars2.com/v2/currencies?ids=all&lang=es'),
};

const el = {
  ownerLabel:$('#ownerLabel'), keySelect:$('#keySelect'),
  addKeyBtn:$('#addKeyBtn'), keyPopover:$('#keyPopover'),
  newKeyLabel:$('#newKeyLabel'), newKeyValue:$('#newKeyValue'),
  cancelKeyBtn:$('#cancelKeyBtn'),
  copyKeyBtn:$('#copyKeyBtn'), renameKeyBtn:$('#renameKeyBtn'),
  deleteKeyBtn:$('#deleteKeyBtn'), refreshBtn:$('#refreshBtn'),
  searchBox:$('#searchBox'), category:$('#categorySelect'),
  sort:$('#sortSelect'), onlyPos:$('#onlyPositive'), onlyMain:$('#onlyMain'),
  clearBtn:$('#clearFiltersBtn'), toggleViewBtn:$('#toggleViewBtn'),
  status:$('#status'),
  walletCards:$('#walletCards'), favBlock:$('#favBlock'), favCards:$('#favCards'),
  tableWrap:$('#walletTableWrap'), tableBody:$('#walletTable tbody'),
};

function setStatus(m,k='info'){ if(!el.status) return; el.status.style.color=k==='error'?'#f28b82':(k==='ok'?'#a7f3d0':'#a0a0a6'); el.status.textContent=m; }
function obfuscate(t){ return !t||t.length<8 ? 'Key' : `Key ${t.slice(0,4)}…${t.slice(-4)}`; }
function ensureOption(label,value){ if(![...el.keySelect.options].some(o=>o.value===value)){ const opt=document.createElement('option'); opt.value=value; opt.textContent=label; el.keySelect.appendChild(opt);} }
function esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

function splitCoins(v){ const g=Math.floor(v/10000), s=Math.floor((v%10000)/100), c=v%100; return {g,s,c}; }
function isCoins(cur){ const n=(cur?.name||'').toLowerCase(); return cur?.id===1 || n.includes('moneda') || n.includes('coin'); }
function amountRightHTML(cur,amount){ if(isCoins(cur)) return ''; return `<span class="card__amount">${amount.toLocaleString()}</span>`; }
function coinBadgesHTML(cur,amount){ if(!isCoins(cur)) return ''; const {g,s,c}=splitCoins(amount); return `<div class="coin-badges">${g?`<span class="coin coin--g">${g.toLocaleString()}</span>`:''}${s?`<span class="coin coin--s">${s.toLocaleString()}</span>`:''}${c?`<span class="coin coin--c">${c.toLocaleString()}</span>`:''}</div>`; }

const CATEGORY_OVERRIDES = { 18:['general','blacklion'], 4:['general','blacklion'], 63:['general'] };
function categorize(cur){
  if (CATEGORY_OVERRIDES[cur.id]) return CATEGORY_OVERRIDES[cur.id];
  const t=`${(cur.name||'').toLowerCase()} ${(cur.description||'').toLowerCase()}`, has=s=>t.includes(s), cats=new Set();
  if (has('león negro')||has('black lion')) cats.add('blacklion');
  if (has('pvp')||has('wvw')||has('torneo')||has('fractal')||has('mazmorra')||has('dungeon')) cats.add('competitiva');
  if (has('geoda')||has('geode')||has('mapa')||has('map ')) cats.add('mapa');
  if (has('histórico')||has('gloria')||has('glory')) cats.add('histórica');
  if (!cats.size) cats.add('general');
  return [...cats];
}
function isMainCurrency(cur){ const n=(cur.name||'').toLowerCase(), any=(...ws)=>ws.some(w=>n.includes(w)); return cur.id===1||any('karma','laurel','gem','gema')||any('fragmento de espíritu','spirit shard')||any('reconocimiento astral','astral acclaim')||any('mención de clan','guild commendation'); }

function renderSkeleton(count=8){
  if (state.view==='table'){
    el.tableBody.innerHTML = Array.from({length:count}).map(()=>`
      <tr>
        <td><span class="skel skel-icon"></span></td>
        <td><span class="skel skel-title" style="display:inline-block;width:160px;"></span></td>
        <td class="right"><span class="skel skel-amount" style="display:inline-block;"></span></td>
        <td><span class="skel skel-cats" style="display:inline-block;"></span></td>
        <td class="right"><span class="skel skel-icon"></span></td>
      </tr>`).join('');
    return;
  }
  el.walletCards.innerHTML = Array.from({length:count}).map(()=>`
    <article class="card card--skeleton">
      <div class="card__head"><div class="skel skel-title"></div><div class="skel skel-amount"></div></div>
      <div class="card__desc"><div class="skel skel-line"></div><div class="skel skel-line" style="width:70%"></div></div>
      <div class="card__meta"><span class="meta-left"><span class="skel skel-icon"></span></span><span class="skel skel-cats"></span></div>
    </article>`).join('');
}

function buildRows(){
  if (!state.currenciesLoaded || state.currencies.size===0) return [];
  const rows = state.wallet.map(w=>{
    const c=state.currencies.get(w.id)||{id:w.id,name:`#${w.id}`,order:9999,icon:'',description:''};
    return { id:w.id, amount:w.value, name:c.name||`#${w.id}`, desc:c.description||'', order:Number.isFinite(c.order)?c.order:9999,
             cats:categorize(c), isMain:isMainCurrency(c), isFav:state.favs.has(String(w.id)), _cur:c };
  });

  let list=rows;
  if (state.filters.onlyPos) list=list.filter(r=>r.amount>0);
  if (state.filters.onlyMain) list=list.filter(r=>r.isMain);
  if (state.filters.cat) list=list.filter(r=>r.cats.includes(state.filters.cat));
  if (state.filters.q){ const q=state.filters.q.toLowerCase(); list=list.filter(r=>r.name.toLowerCase().includes(q)||r.desc.toLowerCase().includes(q)); }
  if (state.filters.sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  else if (state.filters.sort==='amount') list.sort((a,b)=>b.amount-a.amount);
  else list.sort((a,b)=>a.order-b.order);
  return list;
}

function catsLine(r){ return `<span class="cats">${(r.cats&&r.cats.length)?r.cats.join(', '):'—'}</span>`; }
function cardHTML(r){
  const iconHTML = r._cur?.icon
    ? `<img src="${esc(r._cur.icon)}" alt="${esc(r.name)}" loading="lazy" width="18" height="18">`
    : `<span></span>`;

  return `
  <article class="card" data-id="${r.id}">
    <button class="star ${r.isFav?'star--on':''}" data-star="${r.id}" title="Favorita">★</button>
    <div class="card__head">
      <h3 class="card__title">${esc(r.name)}</h3>
      <div class="card__amount-wrap">${amountRightHTML(r._cur,r.amount)}</div>
    </div>
    <div class="card__desc">
      ${r.desc?esc(r.desc):''}
      ${coinBadgesHTML(r._cur,r.amount)}
    </div>
    <div class="card__meta">
      <span class="meta-left">${iconHTML}</span>
      ${catsLine(r)}
    </div>
  </article>`;
}
function renderCards(rows){
  const favs=rows.filter(r=>r.isFav), rest=rows.filter(r=>!r.isFav);
  if (favs.length){ el.favBlock?.removeAttribute('hidden'); el.favCards.innerHTML=favs.map(cardHTML).join(''); }
  else { el.favBlock?.setAttribute('hidden',''); el.favCards.innerHTML=''; }
  el.walletCards.innerHTML=rest.map(cardHTML).join('');
}

function rowHTML(r){
  const icon = r._cur?.icon
    ? `<img src="${esc(r._cur.icon)}" alt="${esc(r.name)}" loading="lazy" width="18" height="18">`
    : '';
  const star = `<span class="star ${r.isFav?'star--on':''}" data-star="${r.id}" title="Favorita">★</span>`;
  const cats = (r.cats && r.cats.length) ? r.cats.join(', ') : '—';
  const amount = isCoins(r._cur) ? (()=>{ const {g,s,c}=splitCoins(r.amount); return `${g.toLocaleString()} g ${s} s ${c} c`; })() : r.amount.toLocaleString();

  return `<tr data-id="${r.id}"><td>${icon}</td><td>${esc(r.name)}</td><td class="right">${amount}</td><td>${esc(cats)}</td><td class="right">${star}</td></tr>`;
}
function renderTable(rows){ el.tableBody.innerHTML = rows.map(rowHTML).join(''); }

function render(){
  const rows=buildRows();
  if (!rows.length){
    if (state.view==='table'){ el.walletCards.style.display='none'; el.tableWrap.hidden=false; renderSkeleton(8); }
    else { el.tableWrap.hidden=true; el.walletCards.style.display='grid'; renderSkeleton(8); }
    return;
  }
  if (state.view==='table'){
    el.walletCards.style.display='none'; el.tableWrap.hidden=false; el.favBlock?.setAttribute('hidden',''); el.favCards.innerHTML=''; renderTable(rows);
  } else {
    el.tableWrap.hidden=true; el.walletCards.style.display='grid'; renderCards(rows);
  }
}

/* Cache catálogo */
function loadCurrCache(){ try{ const raw=localStorage.getItem(LS_CURR); if(!raw) return null; const {ts,items}=JSON.parse(raw); if(!Array.isArray(items)||!ts) return null; if((Date.now()-ts)>CURR_TTL) return null; return items; }catch{ return null } }
function saveCurrCache(list){ try{ localStorage.setItem(LS_CURR, JSON.stringify({ts:Date.now(),items:list})); }catch{} }
async function ensureCurrencies(){
  const cached=loadCurrCache();
  if (cached && cached.length){ state.currencies=new Map(cached.map(c=>[c.id,c])); state.currenciesLoaded=true; console.info('[gw2] currencies (cache):',state.currencies.size); return; }
  console.info('[gw2] fetching /v2/currencies?ids=all&lang=es …');
  const list=await API.currencies();
  state.currencies=new Map(list.map(c=>[c.id,c])); state.currenciesLoaded=true; saveCurrCache(list);
  console.info('[gw2] currencies OK:',state.currencies.size);
}

/* Data flow */
async function loadAllForToken(token){
  setStatus('Cargando datos…'); renderSkeleton(8);
  await ensureCurrencies();
  const [acct, w] = await Promise.all([ API.account(token).catch(()=>null), API.wallet(token) ]);
  state.accountName = acct?.name || '—'; state.wallet = w || [];
  el.ownerLabel.textContent = state.accountName; setStatus('Listo.','ok'); render();
}

/* Events */
function wireEvents(){
  const pop=()=>el.keyPopover?.removeAttribute('hidden');
  el.addKeyBtn?.addEventListener('click', ()=> el.keyPopover?.hasAttribute('hidden') ? pop() : el.keyPopover?.setAttribute('hidden','') );
  el.cancelKeyBtn?.addEventListener('click', ()=>{ el.keyPopover?.setAttribute('hidden',''); el.newKeyLabel.value=''; el.newKeyValue.value=''; });

  el.keyPopover?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const label=el.newKeyLabel.value.trim(), value=el.newKeyValue.value.trim();
    if(!value) return setStatus('Ingresá una API key.','error');
    try{
      setStatus('Validando API key…');
      const tokenInfo=await API.tokenInfo(value); const perms=new Set(tokenInfo.permissions||[]); if(!perms.has('account')) throw new Error('Falta permiso account');
      state.keys.push({label,value}); localStorage.setItem(LS_KEYS, JSON.stringify(state.keys));
      ensureOption(label||obfuscate(value), value); el.keySelect.value=value; state.selected=value;
      el.keyPopover.setAttribute('hidden',''); el.newKeyLabel.value=''; el.newKeyValue.value='';
      await loadAllForToken(value);
    }catch(err){ console.error(err); setStatus(err.message||'La API key no es válida.','error'); }
  });

  el.keySelect?.addEventListener('change', async ()=>{ const token=el.keySelect.value; state.selected=token||null; if(!state.selected) return; await loadAllForToken(state.selected); });

  el.copyKeyBtn?.addEventListener('click', ()=>{ const opt=el.keySelect.selectedOptions[0]; if(!opt) return; navigator.clipboard.writeText(opt.value).then(()=>setStatus('API key copiada.','ok')); });
  el.renameKeyBtn?.addEventListener('click', ()=>{ const opt=el.keySelect.selectedOptions[0]; if(!opt) return; const item=state.keys.find(k=>k.value===opt.value); if(!item) return; const name=prompt('Nuevo nombre para la key:', item.label||''); if(name===null) return; item.label=name; localStorage.setItem(LS_KEYS, JSON.stringify(state.keys)); opt.textContent=name||obfuscate(item.value); });
  el.deleteKeyBtn?.addEventListener('click', ()=>{ const opt=el.keySelect.selectedOptions[0]; if(!opt) return; if(!confirm('¿Eliminar esta API key de tu navegador?')) return; state.keys=state.keys.filter(k=>k.value!==opt.value); localStorage.setItem(LS_KEYS, JSON.stringify(state.keys)); opt.remove(); el.ownerLabel.textContent='—'; state.selected=null; state.wallet=[]; render(); });
  el.refreshBtn?.addEventListener('click', async ()=>{ if(!state.selected) return; await loadAllForToken(state.selected); });

  el.searchBox?.addEventListener('input', ()=>{ state.filters.q=el.searchBox.value.trim(); render(); });
  el.category?.addEventListener('change', ()=>{ state.filters.cat=el.category.value||''; render(); });
  el.sort?.addEventListener('change', ()=>{ state.filters.sort=el.sort.value; render(); });
  el.onlyPos?.addEventListener('change', ()=>{ state.filters.onlyPos=el.onlyPos.checked; render(); });
  el.onlyMain?.addEventListener('change', ()=>{ state.filters.onlyMain=el.onlyMain.checked; render(); });
  el.clearBtn?.addEventListener('click', (e)=>{ e.preventDefault(); state.filters={ q:'', cat:'', sort:'order', onlyPos:false, onlyMain:false }; el.searchBox.value=''; el.category.value=''; el.sort.value='order'; el.onlyPos.checked=false; el.onlyMain.checked=false; render(); setStatus('Filtros reiniciados.','ok'); });

  el.toggleViewBtn?.addEventListener('click', ()=>{ state.view = (state.view==='cards') ? 'table' : 'cards'; el.toggleViewBtn.textContent = (state.view==='cards') ? 'Vista tabla' : 'Vista tarjetas'; render(); });

  function handleStarClick(e){ const btn=e.target.closest('[data-star]'); if(!btn) return; const id=String(btn.getAttribute('data-star')); if(state.favs.has(id)) state.favs.delete(id); else state.favs.add(id); localStorage.setItem(LS_FAVS, JSON.stringify([...state.favs])); render(); }
  el.walletCards.addEventListener('click', handleStarClick);
  el.favCards?.addEventListener('click', handleStarClick);
  el.tableBody?.addEventListener('click', handleStarClick);

  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') el.keyPopover?.setAttribute('hidden',''); });
  document.addEventListener('click',(e)=>{ const t=e.target; const inside=t===el.addKeyBtn || el.keyPopover?.contains(t); if(!inside) el.keyPopover?.setAttribute('hidden',''); }, true);
}

/* Boot */
async function boot(){
  try{ state.keys = JSON.parse(localStorage.getItem(LS_KEYS))||[] }catch{ state.keys=[] }
  try{ state.favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS))||[]) }catch{ state.favs = new Set() }
  state.keys.forEach(k=>ensureOption(k.label||obfuscate(k.value), k.value));

  const raw=localStorage.getItem(LS_CURR);
  if(raw){ try{ const {ts,items}=JSON.parse(raw); if(Array.isArray(items)&&ts&&(Date.now()-ts)<=CURR_TTL){ state.currencies=new Map(items.map(c=>[c.id,c])); state.currenciesLoaded=true; console.info('[gw2] currencies (cache):',state.currencies.size); } }catch{} }
  if(!state.currenciesLoaded){ console.info('[gw2] fetching /v2/currencies?ids=all&lang=es …'); const list=await API.currencies(); state.currencies=new Map(list.map(c=>[c.id,c])); state.currenciesLoaded=true; localStorage.setItem(LS_CURR, JSON.stringify({ts:Date.now(),items:list})); console.info('[gw2] currencies OK:',state.currencies.size); }

  if(state.keys.length && !state.selected){ state.selected=state.keys[0].value; el.keySelect.value=state.selected; await loadAllForToken(state.selected); }
  else { renderSkeleton(8); }
  wireEvents();
}
boot();