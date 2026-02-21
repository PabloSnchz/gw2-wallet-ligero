
// patch v3.1 — Normaliza access_token, selector + botón "+", fallback de carga y WIRING de botones (copiar/renombrar/eliminar/refresh)
(function(){
  let _refreshing = false;
  let _internalChange = false;

  // === Storage utils ===
  function mask(k){ if (!k) return '—'; return k.length>8 ? k.slice(0,4)+'…'+k.slice(-4) : k; }
  function persistSelectedKey(v){ try{ if (v) localStorage.setItem('gw2_selected_key', v); }catch(e){} }
  function getLabels(){ try{ const o=JSON.parse(localStorage.getItem('gw2_key_labels')||'{}'); return (o && typeof o==='object')?o:{}; }catch(e){ return {}; } }
  function setLabel(key, label){ try{ const o=getLabels(); if (label) o[key]=label; else delete o[key]; localStorage.setItem('gw2_key_labels', JSON.stringify(o)); }catch(e){} }

  function readKeysFromStorage(){
    const out = [];
    try{
      const candidates = ['gw2_keys','api_keys','keys'];
      let found = null;
      for (const k of candidates){ const raw = localStorage.getItem(k); if (raw){ found = raw; break; } }
      if (found){
        const val = JSON.parse(found);
        if (Array.isArray(val)){
          for (const it of val){
            if (typeof it === 'string') out.push(it);
            else if (it && typeof it === 'object'){ const id = it.id || it.value || it.key; if (id) out.push(id); }
          }
        }
      }
      const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
      for (const s of singles){ const v = localStorage.getItem(s); if (v && !out.includes(v)) out.push(v); }
    }catch(e){}
    return out;
  }

  function getSelectedKey(){
    const sel = document.getElementById('keySelect');
    if (sel && sel.value && sel.value !== '__add__') return sel.value;
    const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
    for (const s of singles){ const v = localStorage.getItem(s); if (v) return v; }
    return null;
  }

  function populateSelectPreservandoAdd(){
    const sel = document.getElementById('keySelect'); if (!sel) return null;
    const labels = getLabels();
    const specialOpts = [];
    Array.from(sel.options).forEach(o => {
      if (o.dataset && (o.dataset.addKey!==undefined)) specialOpts.push(o.cloneNode(true));
      else if ((o.value||'').toLowerCase()==='__add__') specialOpts.push(o.cloneNode(true));
      else if ((o.className||'').split(/\s+/).includes('add-key')) specialOpts.push(o.cloneNode(true));
    });
    let placeholder = Array.from(sel.options).find(o => o.disabled && !o.value) || null;
    sel.innerHTML = '';
    if (!placeholder){ placeholder = document.createElement('option'); placeholder.value=''; placeholder.textContent='Seleccioná una API Key…'; placeholder.disabled = true; }
    sel.appendChild(placeholder);

    const keys = readKeysFromStorage();
    keys.forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent = labels[k] || mask(k); sel.appendChild(o); });

    if (specialOpts.length){
      const sep=document.createElement('option'); sep.disabled=true; sep.textContent='────────'; sep.value=''; sel.appendChild(sep);
      specialOpts.forEach(o=> sel.appendChild(o));
    }
    const current = localStorage.getItem('gw2_selected_key') || (keys[0]||'');
    if (current) sel.value = current;
    return sel;
  }

  function ensureAddButton(){
    const sel = document.getElementById('keySelect'); if (!sel) return;
    if (document.getElementById('addKeyBtn')) return;
    const btn=document.createElement('button');
    btn.id='addKeyBtn'; btn.type='button'; btn.className='icon-btn'; btn.title='Agregar API Key'; btn.setAttribute('aria-label','Agregar API Key');
    btn.innerHTML = "<svg class='icon' viewBox='0 0 24 24' aria-hidden='true'><path d='M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z'/></svg>";
    sel.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', onAddKeyClick);
  }

  async function onAddKeyClick(){
    const raw=(window.prompt && window.prompt('Pegá tu API Key de GW2'))||'';
    const key=(raw||'').trim(); if(!key) return;
    const info=await validateKey(key); if(!info){ alert('La API Key no es válida o no tiene permisos account + wallet.'); return; }
    let list=[]; try{ list=JSON.parse(localStorage.getItem('gw2_keys')||'[]'); if(!Array.isArray(list)) list=[]; }catch(e){ list=[]; }
    if(!list.includes(key)) list.push(key);
    try{ localStorage.setItem('gw2_keys', JSON.stringify(list)); }catch(e){}
    persistSelectedKey(key);
    const sel=populateSelectPreservandoAdd(); if(sel) sel.value=key;
    document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{ detail:{ key } }));
    kickLoad();
  }

  async function validateKey(key){
    try{ const r=await fetch(`https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(key)}`); if(!r.ok) return null; const info=await r.json(); const perms=info&&info.permissions||[]; if(!Array.isArray(perms)||perms.indexOf('account')===-1||perms.indexOf('wallet')===-1) return null; return info; }catch(e){ return null; }
  }

  function setStatus(msg){ const el=document.getElementById('status'); if(el) el.textContent=msg; }

  async function loadWalletFallback(){
    const key=getSelectedKey(); if(!key) return; setStatus('Cargando…');
    const wRes=await fetch(`https://api.guildwars2.com/v2/account/wallet?access_token=${encodeURIComponent(key)}`); if(!wRes.ok){ setStatus('Error al cargar wallet'); return; } const wallet=await wRes.json();
    const ids=wallet.map(x=>x.id).filter((v,i,a)=>a.indexOf(v)===i);
    const cRes=await fetch(`https://api.guildwars2.com/v2/currencies?ids=${ids.join(',')}`); const currencies=cRes.ok?await cRes.json():[]; const map=new Map(currencies.map(c=>[c.id,c]));
    const cards=document.getElementById('walletCards'); if(cards && cards.children && cards.children.length>0){ setStatus('Listo'); return; }
    if(cards){
      cards.innerHTML='';
      wallet.forEach(entry=>{ const meta=map.get(entry.id)||{name:`ID ${entry.id}`}; const d=document.createElement('div'); d.className='card'; const img=document.createElement('img'); img.alt=meta.name||''; img.src=(meta.icon||'').replace('http://','https://'); const name=document.createElement('div'); name.className='name'; name.textContent=meta.name||`ID ${entry.id}`; const val=document.createElement('div'); val.className='amount'; val.textContent=entry.value; d.appendChild(img); d.appendChild(name); d.appendChild(val); cards.appendChild(d); }); setStatus(`Listo — ${wallet.length} divisas`); document.dispatchEvent(new CustomEvent('gw2:walletData',{detail:{wallet,currencies}})); return; }
    setStatus(`Listo — ${wallet.length} divisas`); document.dispatchEvent(new CustomEvent('gw2:walletData',{detail:{wallet,currencies}}));
  }

  function kickLoad(){ if(_refreshing) return; _refreshing=true; try{ if(typeof window.refreshSelected==='function'){ window.refreshSelected(); } else if(typeof window.loadWallet==='function'){ window.loadWallet(); } else if(typeof window.refreshWallet==='function'){ window.refreshWallet(); } else { const btn=document.getElementById('refreshBtn'); if(btn) btn.click(); setTimeout(()=>{ loadWalletFallback(); },400); } } finally { setTimeout(()=>{ _refreshing=false; },0); } }

  function wireSelect(sel){ if(!sel) return; sel.addEventListener('change',()=>{ if(_internalChange||_refreshing) return; if(sel.value==='__add__' || (sel.selectedOptions[0] && (sel.selectedOptions[0].dataset.addKey!==undefined))){ document.dispatchEvent(new CustomEvent('gw2:addApiKeyRequested')); const prev=localStorage.getItem('gw2_selected_key')||''; sel.value=prev||''; return; } persistSelectedKey(sel.value); document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{detail:{key:sel.value}})); kickLoad(); }); }

  // === WIRING de botones de acción (fallback no intrusivo) ===
  function wireActionButtons(){
    const sel = document.getElementById('keySelect');
    const btnCopy = document.getElementById('copyKeyBtn');
    const btnRename = document.getElementById('renameKeyBtn');
    const btnDelete = document.getElementById('deleteKeyBtn');
    const btnRefresh = document.getElementById('refreshBtn');

    if (btnCopy) btnCopy.addEventListener('click', async (e)=>{
      const key=getSelectedKey(); if(!key){ alert('No hay una API Key seleccionada.'); return; }
      try{ await navigator.clipboard.writeText(key); setStatus('Key copiada al portapapeles'); }catch(err){ setStatus('No se pudo copiar la key'); }
      if (typeof window.onCopyApiKey==='function') window.onCopyApiKey(key);
    });

    if (btnRename) btnRename.addEventListener('click', ()=>{
      const key=getSelectedKey(); if(!key){ alert('Seleccioná una API Key para renombrar.'); return; }
      const labels=getLabels(); const current=labels[key]||''; const alias=prompt('Nuevo nombre/alias (solo visual):', current)||''; setLabel(key, alias.trim()); const s=populateSelectPreservandoAdd(); if(s) s.value=key; setStatus('Alias actualizado');
      if (typeof window.onRenameApiKey==='function') window.onRenameApiKey(key, alias);
    });

    if (btnDelete) btnDelete.addEventListener('click', ()=>{
      const key=getSelectedKey(); if(!key){ alert('Seleccioná una API Key para eliminar.'); return; }
      if(!confirm('¿Eliminar la API Key seleccionada?')) return;
      try{
        let list=[]; try{ list=JSON.parse(localStorage.getItem('gw2_keys')||'[]'); if(!Array.isArray(list)) list=[]; }catch(e){ list=[]; }
        const idx=list.indexOf(key); if(idx!==-1) list.splice(idx,1);
        localStorage.setItem('gw2_keys', JSON.stringify(list));
        // limpiar alias
        const labels=getLabels(); if(labels[key]){ delete labels[key]; localStorage.setItem('gw2_key_labels', JSON.stringify(labels)); }
        // si la key borrada era la seleccionada
        const selStore=localStorage.getItem('gw2_selected_key'); if(selStore===key) localStorage.removeItem('gw2_selected_key');
        const s=populateSelectPreservandoAdd();
        if(s){ const next = (readKeysFromStorage()[0]||''); if(next){ s.value=next; persistSelectedKey(next); document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{detail:{key:next}})); kickLoad(); } else { s.value=''; setStatus('Sin key — agregá una para continuar'); } }
      }catch(e){ setStatus('No se pudo eliminar la key'); }
      if (typeof window.onDeleteApiKey==='function') window.onDeleteApiKey(key);
    });

    if (btnRefresh) btnRefresh.addEventListener('click', (e)=>{ e.preventDefault(); kickLoad(); });
  }

  function init(){
    const sel=populateSelectPreservandoAdd();
    wireSelect(sel);
    ensureAddButton();
    wireActionButtons();
    if (getSelectedKey()) kickLoad();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  // === Parche fetch (normalización) ===
  const _fetch=window.fetch; window.fetch=function(input,init){ try{ let url=typeof input==='string'?input:(input&&input.url?input.url:''); if(!url) return _fetch.call(this,input,init); const targets=['/v2/account/wallet','/v2/tokeninfo']; if(targets.some(t=>url.includes(t))){ const key=getSelectedKey(); if(key){ const u=new URL(url, window.location.origin); ['kay','key','apikey','api_key'].forEach(p=>{ if(u.searchParams.has(p)) u.searchParams.delete(p); }); const cur=u.searchParams.get('access_token'); if(!cur||cur.trim()==='') u.searchParams.set('access_token', key); if(typeof input!=='string') input=new Request(u.toString(), input); else input=u.toString(); } } }catch(e){} return _fetch.call(this,input,init); }
})();
