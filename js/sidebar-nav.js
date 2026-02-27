(function(){
  'use strict';

  var $ = (s,r)=> (r||document).querySelector(s);
  var $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));

  function highlightActive(){
    var h = location.hash || '#/cards';
    $$('.side-nav a').forEach(a=> a.classList.remove('is-active'));
    var active = $('.side-nav a[href="'+h+'"]');
    if (active) active.classList.add('is-active');
  }

  function updateAccountId(){
    var out = $('#accountIdLabel');
    var tokenSel = $('#keySelectGlobal');
    if (!out || !tokenSel) return;

    var token = tokenSel.value || "";
    if (!token) { out.textContent = "—"; return; }

    fetch('https://api.guildwars2.com/v2/account?access_token='+token)
      .then(r=>r.json())
      .then(j=> out.textContent = j?.name || "—")
      .catch(()=> out.textContent = "—");
  }

  window.addEventListener('hashchange', highlightActive);

  var sel = $('#keySelectGlobal');
  if (sel) sel.addEventListener('change', updateAccountId);

  document.addEventListener('DOMContentLoaded', ()=>{
    highlightActive();
    updateAccountId();
  });

})();