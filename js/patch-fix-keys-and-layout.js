
// patch v2.2 — Restaura botón “+” Agregar API Key junto al selector, sin alterar el resto
// Mantiene: poblar <select>, eventos gw2:apiKeyChanged / gw2:addApiKeyRequested, y parche de fetch
(function(){
  // ===== Utils almacenamiento =====
  function mask(k){ if (!k) return '—'; return k.length>8 ? k.slice(0,4)+'…'+k.slice(-4) : k; }
  function persistSelectedKey(v){ try{ if (v) localStorage.setItem('gw2_selected_key', v); }catch(e){} }

  function readKeysFromStorage(){
    const out = [];
    try{
      const candidates = ['gw2_keys','api_keys','keys'];
      for (const k of candidates){
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const val = JSON.parse(raw);
        if (Array.isArray(val)){
          for (const it of val){
            if (typeof it === 'string'){ out.push({ id: it, label: mask(it) }); }
            else if (it && typeof it === 'object'){
              const id = it.id || it.value || it.key || '';
              const label = it.label || it.name || mask(id);
              if (id) out.push({ id, label });
            }
          }
          break;
        }
      }
      const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
      for (const s of singles){ const v = localStorage.getItem(s); if (v && !out.some(x=>x.id===v)) out.push({ id:v, label: mask(v) }); }
    }catch(e){}
    return out;
  }

  // ===== Poblar <select> preservando opción “agregar” si existía =====
  function populateSelectPreservandoAdd(){
    const sel = document.getElementById('keySelect');
    if (!sel) return null;

    // Detectar y preservar opciones especiales de “agregar”
    const specialOpts = [];
    Array.from(sel.options).forEach(o => {
      if (o.dataset && (o.dataset.addKey!==undefined)) specialOpts.push(o.cloneNode(true));
      else if ((o.value||'').toLowerCase()==='__add__') specialOpts.push(o.cloneNode(true));
      else if ((o.className||'').split(/\s+/).includes('add-key')) specialOpts.push(o.cloneNode(true));
    });

    // Placeholder existente (si lo hay)
    let placeholder = Array.from(sel.options).find(o => o.disabled && !o.value) || null;

    sel.innerHTML = '';

    if (!placeholder){
      placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Seleccioná una API Key…';
      placeholder.disabled = true;
    }
    sel.appendChild(placeholder);

    const keys = readKeysFromStorage();
    keys.forEach(k=>{
      const o=document.createElement('option'); o.value=k.id; o.textContent=k.label; sel.appendChild(o);
    });

    if (specialOpts.length){
      const sep = document.createElement('option'); sep.disabled = true; sep.textContent = '────────'; sep.value=''; sel.appendChild(sep);
      specialOpts.forEach(o=> sel.appendChild(o));
    }

    const current = localStorage.getItem('gw2_selected_key') || (keys[0] && keys[0].id) || '';
    if (current){ sel.value = current; }

    return sel;
  }

  function getSelectedKey(){
    const sel = document.getElementById('keySelect');
    if (sel && sel.value && sel.value !== '__add__') return sel.value;
    const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
    for (const s of singles){ const v = localStorage.getItem(s); if (v) return v; }
    return null;
  }

  // ===== Botón “+” (re)insertado junto al <select> =====
  function ensureAddButton(){
    const sel = document.getElementById('keySelect');
    if (!sel) return;
    if (document.getElementById('addKeyBtn')) return; // evitar duplicados

    const btn = document.createElement('button');
    btn.id = 'addKeyBtn';
    btn.type = 'button';
    btn.className = 'icon-btn'; // reutiliza estilos existentes
    btn.title = 'Agregar API Key';
    btn.setAttribute('aria-label','Agregar API Key');
    btn.innerHTML = "<svg class='icon' viewBox='0 0 24 24' aria-hidden='true'><path d='M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z'/></svg>";

    // Insertar inmediatamente después del select
    sel.insertAdjacentElement('afterend', btn);

    btn.addEventListener('click', onAddKeyClick);
  }

  async function onAddKeyClick(){
    const raw = (window.prompt && window.prompt('Pegá tu API Key de GW2')) || '';
    const key = (raw||'').trim();
    if (!key) return;

    // Validar contra /v2/tokeninfo
    const url = `https://api.guildwars2.com/v2/tokeninfo?access_token=${encodeURIComponent(key)}`;
    let ok=false, info=null;
    try{
      const r = await fetch(url);
      ok = r.ok; info = ok ? await r.json() : null;
    }catch(e){ ok=false; }
    if (!ok || !info || !info.id){
      alert('La API Key no es válida o no tiene permisos suficientes.');
      return;
    }

    // Evitar duplicadas
    let list = [];
    try{ list = JSON.parse(localStorage.getItem('gw2_keys')||'[]'); if (!Array.isArray(list)) list=[]; }catch(e){ list=[]; }
    if (!list.includes(key)) list.push(key);
    try{ localStorage.setItem('gw2_keys', JSON.stringify(list)); }catch(e){}

    // Persistir selección actual
    persistSelectedKey(key);

    // Refrescar UI del selector (sin perder “+”)
    const sel = populateSelectPreservandoAdd();
    if (sel) sel.value = key;

    // Avisar a la app y refrescar datos
    document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{ detail:{ key } }));
    // Compatibilidad con apps existentes
    try{
      if (typeof window.refreshSelected === 'function') window.refreshSelected();
      else if (document.getElementById('refreshBtn')) document.getElementById('refreshBtn').click();
      else document.dispatchEvent(new CustomEvent('gw2:refreshRequested'));
    }catch(e){}
  }

  function wireSelect(sel){
    if (!sel) return;
    sel.addEventListener('change', ()=>{
      if (sel.value === '__add__' || (sel.selectedOptions[0] && (sel.selectedOptions[0].dataset.addKey!==undefined))){
        // Si tu select también tiene una opción especial de agregar
        document.dispatchEvent(new CustomEvent('gw2:addApiKeyRequested'));
        const prev = localStorage.getItem('gw2_selected_key') || '';
        sel.value = prev || '';
        return;
      }
      persistSelectedKey(sel.value);
      document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{ detail:{ key: sel.value }}));
    });
  }

  function init(){
    const sel = populateSelectPreservandoAdd();
    wireSelect(sel);
    ensureAddButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // ===== Parche fetch (igual que v2.1) =====
  const _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (!url) return _fetch.call(this, input, init);
      const targets = ['/v2/account/wallet', '/v2/tokeninfo'];
      if (targets.some(t=>url.includes(t))){
        const key = getSelectedKey();
        if (key){
          const u = new URL(url, window.location.origin);
          ['kay','key','apikey','api_key'].forEach(p=>{ if (u.searchParams.has(p)) u.searchParams.delete(p); });
          const current = u.searchParams.get('access_token');
          if (!current || current.trim()==='') u.searchParams.set('access_token', key);
          if (typeof input !== 'string') input = new Request(u.toString(), input); else input = u.toString();
        }
      }
    }catch(e){}
    return _fetch.call(this, input, init);
  }
})();
