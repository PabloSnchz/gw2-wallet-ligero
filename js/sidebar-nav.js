(function(){
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

  console.info('%cGW2 sidebar-nav.js v1.2 — router‑friendly + tokenchange + a11y', 'color:#7dd3fc; font-weight:700');

  // ----------------------------------------------------------------------------
  // 1) Resaltado de navegación (fallback)
  //    El router ya marca .is-active en .side-nav__link. Este módulo SOLO actúa
  //    si no encuentra un link activo acorde al hash (compatibilidad segura).
  // ----------------------------------------------------------------------------
  function applyActiveLocally(hash) {
    const h = hash || location.hash || '#/cards';
    const links = $$('.side-nav a');
    links.forEach(a => {
      a.classList.remove('is-active');
      a.removeAttribute('aria-current');
    });
    const active = $(`.side-nav a[href="${h}"]`);
    if (active) {
      active.classList.add('is-active');
      active.setAttribute('aria-current', 'page');
    }
  }

  function syncActiveFromHash() {
    const h = location.hash || '#/cards';
    // Si el router ya resolvió el activo, respetamos su decisión
    const routerActive = $('.side-nav__link.is-active') || $('.side-nav a.is-active');
    if (routerActive) {
      // Igualamos aria-current por accesibilidad
      $$('.side-nav a').forEach(a => a.removeAttribute('aria-current'));
      routerActive.setAttribute('aria-current', 'page');
      return;
    }
    // Fallback local
    applyActiveLocally(h);
  }

  // ----------------------------------------------------------------------------
  // 2) ID de cuenta (header chip)
  //    - Escucha change del <select> y evento global gn:tokenchange
  //    - Evita requests redundantes y cancela en vuelo si cambia el token
  // ----------------------------------------------------------------------------
  let lastToken = null;
  let acctCtrl  = null;

  async function updateAccountId(){
    const out = $('#accountIdLabel');
    const tokenSel = $('#keySelectGlobal');
    if (!out || !tokenSel) return;

    const token = (tokenSel.value || '').trim();
    if (!token) {
      lastToken = null;
      out.textContent = '—';
      return;
    }
    if (token === lastToken && out.textContent && out.textContent !== '—') {
      // Mismo token y ya hay un valor válido mostrado: no hacemos fetch de nuevo
      return;
    }

    // Cancelar petición anterior si aún sigue en vuelo
    if (acctCtrl) { try { acctCtrl.abort(); } catch(_){} }
    acctCtrl = new AbortController();

    try {
      const url = 'https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(token);
      const r = await fetch(url, { headers: { 'Accept':'application/json' }, signal: acctCtrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json().catch(() => ({}));
      out.textContent = j?.name || '—';
      lastToken = token;
    } catch (_) {
      out.textContent = '—';
      // No actualizamos lastToken para forzar reintento en el siguiente cambio real
    }
  }

  // ----------------------------------------------------------------------------
  // 3) Eventos
  // ----------------------------------------------------------------------------
  // Hash → posible cambio de sección (router lo maneja; nosotros hacemos fallback)
  window.addEventListener('hashchange', syncActiveFromHash);

  // <select> de token
  const sel = $('#keySelectGlobal');
  if (sel) sel.addEventListener('change', updateAccountId);

  // Evento global emitido por el shell (app.js) al cambiar token
  document.addEventListener('gn:tokenchange', () => updateAccountId());

  // Ready
  document.addEventListener('DOMContentLoaded', () => {
    syncActiveFromHash();
    updateAccountId();
  });

  // Al final de js/sidebar-nav.js
document.addEventListener('gn:nav-active', function (ev) {
  // Si ya viene marcado por router, este script no toca nada.
  // (Dejar vacío a propósito: no-op)

  // Si el router ya definió el activo, este script no vuelve a pintarlo.
document.addEventListener('gn:nav-active', function(){ /* no-op */ });

});

})();