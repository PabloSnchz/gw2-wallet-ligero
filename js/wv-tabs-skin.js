/*!
 * js/wv-tabs-skin.js — Re-skin de los botones de tabs del header de Wizard's Vault
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-03-04)
 *
 * Objetivo:
 *  - Hacer que los botones "Diarias / Semanales / Especiales / Tienda" tengan el mismo
 *    diseño y estilo visual que el botón "Refrescar".
 *  - Mantenerse activo en todas las pantallas de WV, aún con re-render del header.
 *
 * Notas:
 *  - No modifica la lógica de navegación; sólo aplica clases y estilos.
 *  - Si tu tema ya define .btn (como usa "Refrescar"), nos colgamos de esa clase.
 *  - Si no, este archivo inyecta un estilo base (.btn--wv-skin) con look equivalente.
 */

(function () {
  'use strict';

  var IDS = ['wvTabBtnDaily', 'wvTabBtnWeekly', 'wvTabBtnSpecial', 'wvTabBtnShop'];

  function $(id){ return document.getElementById(id); }
  function byIds(list){ return list.map(function(id){ return $(id); }).filter(Boolean); }

  // ---------- Estilos ----------
  function injectStyles(){
    if (document.getElementById('wv-tabs-skin-css')) return;
    var css = `
      /* Contenedor posible de tabs: garantizamos layout neutro */
      #wvPanel .wv-header-tabs, #wvPanel .wv-tabs, #wvPanel .tabs, #wvPanel .header-tabs {
        gap: 8px;
      }

      /* Si tu app ya tiene .btn como "Refrescar", sólo agregamos separación */
      .btn.btn--wv-skin { margin-right: 6px; }

      /* Estilo fallback si .btn no existe o es distinto al de "Refrescar" en tu tema. 
         Lo activamos en .btn--wv-skin cuando el tema no provee .btn consistente. */
      .btn--wv-skin:not(.btn) {
        display:inline-flex; align-items:center; justify-content:center; gap:8px;
        padding:6px 12px; border-radius:8px; user-select:none; cursor:pointer;
        font-weight:600; line-height:1; text-decoration:none;
        color:#e6e9ef; background:#111319; border:1px solid #2c2f36;
      }
      .btn--wv-skin:not(.btn):hover  { border-color:#3b4352; }
      .btn--wv-skin:not(.btn):active { transform:translateY(0.5px); }

      /* Estado activo/seleccionado de la tab (imitando pressed/primary sutil) */
      .btn--wv-active {
        background:#1b2130 !important;
        border-color:#3b4352 !important;
        box-shadow:0 0 0 1px #3b4352 inset;
      }

      /* Suavizar pill viejo si aún queda */
      .wv-tab-pill, .tab-pill, .pill-tab {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
    `;
    var s = document.createElement('style');
    s.id = 'wv-tabs-skin-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- Aplicar clases a los botones ----------
  function applySkin(){
    injectStyles();
    var btns = byIds(IDS);
    if (!btns.length) return;

    btns.forEach(function(btn){
      // Evitar doble wiring
      if (!btn.__wvSkinApplied) {
        // 1) Forzamos apariencia "tipo Refrescar":
        //    - Si tu tema ya usa .btn para "Refrescar", la agregamos.
        //    - También agregamos .btn--wv-skin (fallback/control fino).
        btn.classList.add('btn', 'btn--wv-skin');

        // 2) Rol accesible
        btn.setAttribute('type','button');

        // 3) Quitamos clases de estilo de "pill" si existieran
        ['wv-tab-pill','tab-pill','pill-tab'].forEach(function(old){ btn.classList.remove(old); });

        // 4) Reaccionar al click para retocar activo luego de que WV cambie la tab
        btn.addEventListener('click', function(){ setTimeout(refreshActiveVisual, 0); });

        btn.__wvSkinApplied = true;
      }
    });

    // Primer sync de activo
    refreshActiveVisual();
  }

  // ---------- Determinar tab activa y reflejar visual ----------
  function isActive(btn){
    // Varias implementaciones posibles según tu WV:
    // - aria-selected="true" o aria-current="page"
    // - clase is-active / overlay-tab--active
    return btn.getAttribute('aria-selected') === 'true'
        || btn.getAttribute('aria-current') === 'page'
        || btn.classList.contains('is-active')
        || btn.classList.contains('overlay-tab--active');
  }

  function refreshActiveVisual(){
    var btns = byIds(IDS);
    btns.forEach(function(btn){
      btn.classList.toggle('btn--wv-active', isActive(btn));
    });
  }

  // ---------- Observer para re-render del header ----------
  function observeWV(){
    var host = document.getElementById('wvPanel');
    if (!host || host.__wvTabsSkinMO) return;

    var mo = new MutationObserver(function(muts){
      var need = false;
      for (var i=0; i<muts.length; i++){
        var m = muts[i];
        // Si se agregan nodos o cambian atributos en cualquiera de los botones/controles, re-aplicamos
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) { need = true; break; }
        if (m.type === 'attributes' && IDS.indexOf(m.target.id) >= 0) { need = true; break; }
      }
      if (need) { applySkin(); }
    });
    try {
      mo.observe(host, { subtree:true, childList:true, attributes:true, attributeFilter:['class','aria-selected','aria-current'] });
      host.__wvTabsSkinMO = mo;
    } catch(_){}
  }

  // ---------- Entradas de ciclo de vida ----------
  function onReady(){
    applySkin();
    observeWV();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();

  // Cuando navegás a WV, nos aseguramos otra vez
  document.addEventListener('gn:nav-active', function(ev){
    try {
      var h = String(ev && ev.detail && ev.detail.hash || '').toLowerCase();
      if (h === '#/account/wizards-vault') { setTimeout(applySkin, 0); }
    } catch(_){}
  });

})();