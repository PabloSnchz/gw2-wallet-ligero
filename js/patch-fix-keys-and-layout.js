
// patch v2: además de normalizar ?access_token, pobla el <select id="keySelect"> con keys guardadas
(function(){
  // ---- almacenamiento y lectura de keys ----
  function readKeysFromStorage(){
    const out = [];
    try{
      // formatos posibles: arreglo simple de strings, arreglo de objetos {id|value|key,label|name}
      const candidates = [
        'gw2_keys',          // preferido: ["key1","key2",...]
        'api_keys',
        'keys',
      ];
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
      // clave única suelta
      const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
      for (const s of singles){
        const v = localStorage.getItem(s);
        if (v && !out.some(x=>x.id===v)) out.push({ id: v, label: mask(v) });
      }
    }catch(e){}
    return out;
  }

  function mask(k){ if (!k) return '—'; return k.length>8 ? k.slice(0,4)+'…'+k.slice(-4) : k; }
  function persistSelectedKey(v){ try{ if (v) localStorage.setItem('gw2_selected_key', v); }catch(e){} }

  function populateSelect(){
    const sel = document.getElementById('keySelect');
    if (!sel) return null;
    const keys = readKeysFromStorage();
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value=''; opt0.textContent='Seleccioná una API Key…'; opt0.disabled = true; opt0.selected = true;
    sel.appendChild(opt0);
    keys.forEach(k=>{
      const o=document.createElement('option'); o.value=k.id; o.textContent=k.label; sel.appendChild(o);
    });
    // set valor desde storage si existe
    const current = localStorage.getItem('gw2_selected_key') || (keys[0] && keys[0].id) || '';
    if (current){ sel.value = current; }
    return sel;
  }

  function getSelectedKey(){
    const sel = document.getElementById('keySelect');
    if (sel && sel.value) return sel.value;
    const singles = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
    for (const s of singles){ const v = localStorage.getItem(s); if (v) return v; }
    return null;
  }

  function wireSelect(sel){
    if (!sel) return;
    sel.addEventListener('change', ()=>{
      persistSelectedKey(sel.value);
      // avisa a la app que cambió la key (por si escucha eventos)
      document.dispatchEvent(new CustomEvent('gw2:apiKeyChanged',{ detail:{ key: sel.value }}));
    });
  }

  function initSelector(){
    const sel = populateSelect();
    wireSelect(sel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSelector); else initSelector();

  // ---- parche fetch ----
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
          // limpiar alias incorrectos
          ['kay','key','apikey','api_key'].forEach(p=>{ if (u.searchParams.has(p)) u.searchParams.delete(p); });
          // setear access_token si falta
          const current = u.searchParams.get('access_token');
          if (!current || current.trim()==='') u.searchParams.set('access_token', key);
          if (typeof input !== 'string') input = new Request(u.toString(), input); else input = u.toString();
        }
      }
    }catch(e){}
    return _fetch.call(this, input, init);
  }
})();
