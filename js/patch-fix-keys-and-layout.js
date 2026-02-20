
// Parche defensivo para normalizar API Key y evitar que 'kay' rompa la carga
(function(){
  function getSelectedKeyFromUI(){
    const selectors = ['#apiKeySelect', '#key-select', '.key-select', '#apiKey', '#api_key', '[name="key"]', '[name="apiKey"]'];
    for (const s of selectors){
      const el = document.querySelector(s);
      if (el && (el.value || el.getAttribute('value'))) return el.value || el.getAttribute('value');
    }
    return null;
  }
  function getKeyFromStorage(){
    try{
      const candidates = ['gw2_selected_key','selected_key','api_key','gw2_api_key'];
      for (const k of candidates){
        const v = localStorage.getItem(k);
        if (v) return v;
      }
      // Array de keys
      const arr = JSON.parse(localStorage.getItem('gw2_keys')||'[]');
      if (Array.isArray(arr) && arr.length>0) return arr[0];
    }catch(e){}
    return null;
  }
  function persistSelectedKey(v){
    try{ if (v) localStorage.setItem('gw2_selected_key', v); }catch(e){}
  }
  function effectiveKey(){
    const ui = getSelectedKeyFromUI();
    if (ui) { persistSelectedKey(ui); return ui; }
    const st = getKeyFromStorage();
    return st;
  }

  // Observa cambios en posibles selects de key para persistir
  function watchKeySelect(){
    const sel = document.querySelector('#apiKeySelect, #key-select, .key-select, #apiKey, #api_key, [name="key"], [name="apiKey"]');
    if (sel){
      sel.addEventListener('change', ()=>{ persistSelectedKey(sel.value); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchKeySelect); else watchKeySelect();

  // Monkey‑patch de fetch para asegurar ?access_token
  const _fetch = window.fetch;
  window.fetch = function(input, init){
    try{
      let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (!url) return _fetch.call(this, input, init);
      const targets = ['/v2/account/wallet', '/v2/tokeninfo'];
      if (targets.some(t=>url.includes(t))){
        const key = effectiveKey();
        if (key){
          const u = new URL(url, window.location.origin);
          // Si venía 'kay' o 'key' incorrecto, limpiamos
          if (u.searchParams.has('kay')) u.searchParams.delete('kay');
          // Sólo seteamos access_token si falta (o está vacío)
          const current = u.searchParams.get('access_token');
          if (!current || current.trim()==='') u.searchParams.set('access_token', key);
          // reconstruimos input si era Request
          if (typeof input !== 'string'){
            input = new Request(u.toString(), input);
          } else {
            input = u.toString();
          }
        }
      }
    }catch(e){ /* no rompemos la app */ }
    return _fetch.call(this, input, init);
  }
})();
