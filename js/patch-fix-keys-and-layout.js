
// patch v2.1: conserva botón/acción de “+ agregar API Key” y opciones especiales del <select>
(function(){
  // --- utilidades de almacenamiento ---
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

  function populateSelectPreservandoAdd(){
    const sel = document.getElementById('keySelect');
    if (!sel) return null;

    // 1) Detectar opción especial existente para “agregar” y preservarla
    //    Soportamos varias variantes: value="__add__", data-add-key, class="add-key"
    const specialOpts = [];
    Array.from(sel.options).forEach(o => {
      if (o.dataset && (o.dataset.addKey!==undefined)) specialOpts.push(o.cloneNode(true));
      else if ((o.value||'').toLowerCase()==='__add__') specialOpts.push(o.cloneNode(true));
      else if ((o.className||'').split(/\s+/).includes('add-key')) specialOpts.push(o.cloneNode(true));
    });

    // 2) Placeholder existente
    let placeholder = Array.from(sel.options).find(o => o.disabled && !o.value) || null;

    // 3) Limpiar solo opciones regulares (no botón agregar si existía)
    sel.innerHTML = '';

    // 4) Volver a poner placeholder (o crear uno si no existía)
    if (!placeholder){
      placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Seleccioná una API Key…';
      placeholder.disabled = true;
    }
    sel.appendChild(placeholder);

    // 5) Insertar keys desde storage
    const keys = readKeysFromStorage();
    keys.forEach(k=>{
      const o=document.createElement('option'); o.value=k.id; o.textContent=k.label; sel.appendChild(o);
    });

    // 6) Reponer opción especial de “agregar” si existía
    if (specialOpts.length){
      // Separador opcional
      const sep = document.createElement('option'); sep.disabled = true; sep.textContent = '────────'; sep.value='';
      sel.appendChild(sep);
      specialOpts.forEach(o=> sel.appendChild(o));
    }

    // 7) Seleccionar valor actual si existe
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

  function wireSelect(sel){
    if (!sel) return;
    sel.addEventListener('change', ()=>{
      // Si el usuario eligió la opción especial de agregar, disparamos un evento y NO persistimos
      if (sel.value === '__add__' || (sel.selectedOptions[0] && (sel.selectedOptions[0].dataset.addKey!==undefined))){
        document.dispatchEvent(new CustomEvent('gw2:addApiKeyRequested'));
        // Volver al valor anterior/placeholder para no dejar seleccionado "__add__"
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // --- parche fetch (igual que v2) ---
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
