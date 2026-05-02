/*!
 * Achievements Theme — diseño sobrio con borde izquierdo de color
 * v1.1.1 (2026-05-02)
 *
 * Cambios v1.1.1:
 *  - CORRECCIÓN: solo aplica border-left de color, el resto lo hereda de .card (theme-polish.css)
 *  - Eliminada la sobrescritura de border y box-shadow que pisaba los estilos base y el hover
 *  - Agregado card.classList.add('card') para heredar el tema base
 *  - Mismo patrón que wallet-theme.js v1.3.0 y meta-theme.js v1.4.2
 *
 * Cambios v1.1.0:
 *  - Títulos en blanco (#e0e4ed) en vez del color de la categoría
 *  - Borde general neutro + glow unificado suave
 *  - El color de la categoría se conserva solo en el borde izquierdo (3px)
 *  - Misma receta visual que Meta Theme v1.4.1
 *
 * v1.0.0:
 *  - achievements.js ya pinta un badge de categoría (.ach-badge) dentro de .a-desc.
 *  - Este script lee ese nombre, lo mapea a un tinte de paleta y aplica borde+halo a .a-card.
 *  - Si no matchea, usa un fallback celeste neutro.
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[AchTheme] achievements-theme.js v1.1.1 — solo border-left, hereda .card de theme-polish.css');

  var DEBUG = false;

  // ---- Utils -------------------------------------------------------------------
  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c){ return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba('+r+','+g+','+b+','+a+')';
    } catch(_) { return null; }
  }

  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  }

  // ---- Paleta por categoría / temática (keywords en nombre de categoría) ----
  function tintForCategoryName(nameRaw){
    var n = norm(nameRaw);

    // Expansiones / Historias
    if (/\bheart of thorns\b|\bhot\b|maguuma|verdant brink|auric basin|tangled depths|dragon's stand|dragons stand/.test(n))
      return '#b9f3c8';

    if (/\bpath of fire\b|\bpof\b|elona|desert|desierto|crystal desert|vabbi|elon|domain of/i.test(n))
      return '#fbc49e';

    if (/\bend of dragons\b|\beod\b|kaineng|echovald|jade|new kaineng|seitung|seitung province/i.test(n))
      return '#9cd6e4';

    if (/\bsecrets of the obscure\b|\bsoto\b|skywatch|amnytas|convergence|convergences/i.test(n))
      return '#d7caff';

    if (/living world(?:\s*season)?\s*4|lw4|ls4|joko|kourna|thunderhead|grothmar/i.test(n))
      return '#d7caff';

    // Modos / Actividades
    if (/\bwvw\b|world vs|mundo contra mundo|borderlands|eternal battleground/i.test(n))
      return '#cfe3ff';

    if (/\bpvp\b|player vs player|ranked|unranked|conquest/i.test(n))
      return '#ffd3b3';

    if (/fractal|fractales|undaunting|mistlock|fracto/i.test(n))
      return '#bcd0ff';

    // Core / General / Historia / Mapas Tyria
    if (/core|tyria|historia|story|explor|aventura|colecci|world completion|map completion/i.test(n))
      return '#bcd0ff';

    // Fallback general
    return '#bcd0ff';
  }

  function readCategoryName(card){
    var badge = card.querySelector('.a-desc .ach-badge');
    if (!badge) return '';
    return (badge.textContent || '').trim();
  }

  function applyAchTheme(card){
    if (!card) return;

    var catName = readCategoryName(card);
    var tint = tintForCategoryName(catName);

    if (DEBUG) console.log('[AchTheme] cat:', catName, '→', tint);

    var bLeft = hexToRGBA(tint, 0.5);

    // Solo borde izquierdo de color — el resto lo hereda de .card (theme-polish.css)
    try { card.style.borderLeft = '3px solid ' + bLeft; } catch(_) {}

    // Título tintado
    try {
      var title = card.querySelector('.a-title') || card.querySelector('.card__title');
      if (title) title.style.color = tint;
    } catch(_){}

    // Heredar tema base de theme-polish.css
    card.classList.add('card');
  }

  function themeAchNow(root){
    var host = (root || document).querySelector('#achievementsPanel') || root || document;
    var cards = $$('.a-card, .card.a-card', host);
    cards.forEach(applyAchTheme);
  }

  // ---- Observer: re-render por filtros / umbral / deep-links -------------------
  var mo = null;
  function ensureObserver(){
    if (mo) return;
    var panel = $('#achievementsPanel') || document;
    mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function(n){
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches('.a-card, .card.a-card')) {
            applyAchTheme(n);
          } else {
            $$('.a-card, .card.a-card', n).forEach(applyAchTheme);
          }
        });
      });
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  function onRoute(){ requestAnimationFrame(function(){ themeAchNow(document); }); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ onRoute(); ensureObserver(); });
  } else {
    onRoute(); ensureObserver();
  }

  window.addEventListener('hashchange', function(){
    var p = $('#achievementsPanel');
    if (p && !p.hasAttribute('hidden')) onRoute();
  });

  document.addEventListener('gn:tabchange', function(ev){
    if (location.hash === '#/account/achievements') onRoute();
  });

  console.info('[AchTheme] ready v1.1.1 — solo border-left, hereda .card de theme-polish.css');
})();