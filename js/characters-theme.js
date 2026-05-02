/*!
 * Characters Theme — diseño sobrio con borde izquierdo de color por profesión
 * v1.0.1 (2026-05-02)
 *
 * Cambios v1.0.1:
 *  - CORRECCIÓN: solo aplica border-left de color, el resto lo hereda de .card (theme-polish.css)
 *  - Eliminada la sobrescritura de border, box-shadow, border-radius y transition
 *  - Eliminados los event listeners manuales de hover (ya los maneja theme-polish.css)
 *  - El ícono de profesión mantiene su glow propio (detalle interno)
 *  - Agregado card.classList.add('card') para heredar el tema base
 *  - Mismo patrón que wallet-theme.js v1.3.0, meta-theme.js v1.4.2 y achievements-theme.js v1.1.1
 *
 * v1.0.0:
 *  - Receta visual unificada
 *  - Borde de profesión + dropdowns personalizados para POIs
 */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  console.info('[CharTheme] characters-theme.js v1.0.1 — solo border-left, hereda .card de theme-polish.css');

  var DEBUG = false;

  // ==========================================================================
  // PALETA DE COLORES POR PROFESIÓN
  // ==========================================================================

  var PROF_COLORS = {
    'Guardian':     '#73b9ff',
    'Warrior':      '#ffd966',
    'Revenant':     '#b19cd9',
    'Engineer':     '#ff9d5c',
    'Ranger':       '#6b8e23',
    'Thief':        '#b85e5e',
    'Elementalist': '#ff7b7b',
    'Mesmer':       '#c45ec4',
    'Necromancer':  '#6a5acd'
  };

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  // ==========================================================================
  // DETECCIÓN DE PROFESIÓN DESDE LA CARD
  // ==========================================================================

  function detectProfession(card) {
    var text = (card.textContent || '').toLowerCase();

    var profElements = card.querySelectorAll('[class*="prof"], [class*="Prof"], [data-profession]');
    for (var i = 0; i < profElements.length; i++) {
      var val = (profElements[i].getAttribute('data-profession') || profElements[i].textContent || '').trim();
      if (val && PROF_COLORS[val]) return val;
    }

    for (var prof in PROF_COLORS) {
      if (text.indexOf(prof.toLowerCase()) !== -1) return prof;
    }

    return null;
  }

  // ==========================================================================
  // APLICAR TEMA A UNA CARD
  // ==========================================================================

  function applyCharTheme(card) {
    if (!card || card.__charThemed) return;
    card.__charThemed = true;

    var profession = detectProfession(card);
    var tint = profession ? PROF_COLORS[profession] : null;

    if (DEBUG && profession) console.log('[CharTheme] card:', profession, '→', tint);

    var bLeft = tint ? hexToRGBA(tint, 0.5) : 'rgba(255, 255, 255, 0.12)';

    // 1) Título tintado
    try {
      var title = card.querySelector('.card__title, h4, [class*="name"], [class*="title"]');
      if (title && tint) title.style.color = tint;
    } catch (_) {}

    // 2) Solo borde izquierdo de color — el resto lo hereda de .card (theme-polish.css)
    try { card.style.borderLeft = '3px solid ' + bLeft; } catch (_) {}

    // 3) Ícono de profesión: marco sutil del color (detalle interno, no interfiere con .card)
    try {
      var iconContainer = card.querySelector('.prof-icon-container, [class*="iconWrap"], [class*="icon-wrap"]');
      if (iconContainer && tint) {
        var iconBorder = hexToRGBA(tint, 0.3);
        iconContainer.style.borderRadius = '10px';
        iconContainer.style.boxShadow = '0 0 0 2px ' + iconBorder;
      }
    } catch (_) {}

    // Heredar tema base de theme-polish.css (borde neutro, glow, hover unificado)
    card.classList.add('card');
  }

  // ==========================================================================
  // DROPDOWNS PERSONALIZADOS PARA POIs (mismo sistema que Logros)
  // ==========================================================================

  function enhancePOISelects(root) {
    var host = root || document;
    var nativeSelects = host.querySelectorAll('.poi-select:not(.char-custom-select)');

    nativeSelects.forEach(function (select) {
      if (select.__charCustomized) return;
      select.__charCustomized = true;

      var wrapper = document.createElement('div');
      wrapper.className = 'char-custom-select';
      wrapper.style.cssText = 'position:relative;display:inline-block;width:100%;';

      var btn = document.createElement('button');
      btn.className = 'char-select-btn';
      btn.type = 'button';
      btn.style.cssText = [
        'display:flex;align-items:center;gap:8px;',
        'padding:8px 12px;',
        'width:100%;',
        'background:#1a1c24;',
        'border:1px solid #2a2c35;',
        'border-radius:8px;',
        'color:#e0e4ed;',
        'font-size:0.8rem;',
        'cursor:pointer;',
        'text-align:left;',
        'justify-content:space-between;',
        'transition:border-color 0.15s ease;'
      ].join('');

      var btnText = document.createElement('span');
      btnText.className = 'char-select-btn-text';
      btnText.textContent = select.options[select.selectedIndex]
        ? select.options[select.selectedIndex].text
        : '— Ninguno —';
      btnText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';

      var arrow = document.createElement('span');
      arrow.textContent = '▼';
      arrow.style.cssText = 'font-size:0.6rem;color:#9aa2b8;flex-shrink:0;';

      btn.appendChild(btnText);
      btn.appendChild(arrow);

      var list = document.createElement('div');
      list.className = 'char-select-list';
      list.style.cssText = [
        'display:none;',
        'position:absolute;',
        'top:100%;',
        'left:0;',
        'right:0;',
        'z-index:50;',
        'background:#1a1c24;',
        'border:1px solid #2a2c35;',
        'border-radius:8px;',
        'padding:4px;',
        'margin-top:4px;',
        'max-height:220px;',
        'overflow-y:auto;'
      ].join('');

      Array.prototype.slice.call(select.options).forEach(function (opt) {
        if (opt.parentElement && opt.parentElement.tagName === 'OPTGROUP') {
          var groupLabel = opt.parentElement.label;
          var group = list.querySelector('[data-group="' + groupLabel + '"]');
          if (!group) {
            var groupHeader = document.createElement('div');
            groupHeader.style.cssText = 'padding:4px 10px;font-size:0.7rem;font-weight:600;color:#ffd966;text-transform:uppercase;';
            groupHeader.textContent = groupLabel;
            list.appendChild(groupHeader);
          }
        }

        var optionDiv = document.createElement('div');
        optionDiv.className = 'char-select-option';
        optionDiv.setAttribute('data-value', opt.value);
        optionDiv.textContent = opt.text;
        optionDiv.style.cssText = [
          'padding:6px 10px;',
          'cursor:pointer;',
          'border-radius:6px;',
          'color:#b4bad0;',
          'font-size:0.8rem;',
          'transition:background 0.1s ease;'
        ].join('');

        if (opt.selected) {
          optionDiv.classList.add('active');
          optionDiv.style.background = '#1a2a3a';
          optionDiv.style.color = '#7bc2ff';
        }

        optionDiv.addEventListener('click', function (e) {
          e.stopPropagation();
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          btnText.textContent = opt.text;
          list.querySelectorAll('.char-select-option').forEach(function (o) {
            o.classList.remove('active');
            o.style.background = '';
            o.style.color = '#b4bad0';
          });
          optionDiv.classList.add('active');
          optionDiv.style.background = '#1a2a3a';
          optionDiv.style.color = '#7bc2ff';
          list.style.display = 'none';
        });

        list.appendChild(optionDiv);
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = list.style.display === 'block';
        closeAllDropdowns();
        list.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', function () {
        list.style.display = 'none';
      });

      list.addEventListener('mouseover', function (e) {
        var opt = e.target.closest('.char-select-option');
        if (opt && !opt.classList.contains('active')) {
          opt.style.background = '#252830';
          opt.style.color = '#e0e4ed';
        }
      });
      list.addEventListener('mouseout', function (e) {
        var opt = e.target.closest('.char-select-option');
        if (opt && !opt.classList.contains('active')) {
          opt.style.background = '';
          opt.style.color = '#b4bad0';
        }
      });

      select.style.display = 'none';
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(btn);
      wrapper.appendChild(list);
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.char-select-list').forEach(function (list) {
      list.style.display = 'none';
    });
  }

  // ==========================================================================
  // APLICACIÓN A TODAS LAS CARDS
  // ==========================================================================

  function themeNow(root) {
    var host = (root || document).querySelector('#charactersPanel') || root || document;
    var cards = $$('.card', host);
    cards.forEach(applyCharTheme);
    enhancePOISelects(host);
  }

  // ==========================================================================
  // OBSERVER PARA NUEVAS CARDS
  // ==========================================================================

  var mo = null;
  function ensureObserver() {
    if (mo) return;
    var panel = document.getElementById('charactersPanel') || document;
    mo = new MutationObserver(function (muts) {
      var needsTheme = false;
      muts.forEach(function (m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function (n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches('.card')) {
            applyCharTheme(n);
            needsTheme = true;
          } else if (n.querySelectorAll) {
            var cards = n.querySelectorAll('.card');
            if (cards.length) {
              cards.forEach(applyCharTheme);
              needsTheme = true;
            }
          }
        });
      });
      if (needsTheme) {
        setTimeout(function () {
          enhancePOISelects(document.getElementById('charactersPanel'));
        }, 50);
      }
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================

  function onRoute() {
    requestAnimationFrame(function () {
      themeNow(document);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      onRoute();
      ensureObserver();
    });
  } else {
    onRoute();
    ensureObserver();
  }

  window.addEventListener('hashchange', function () {
    var p = document.getElementById('charactersPanel');
    if (p && !p.hasAttribute('hidden')) onRoute();
  });

  document.addEventListener('gn:tabchange', function (ev) {
    if (ev.detail && ev.detail.view === 'characters') {
      setTimeout(function () {
        themeNow(document);
      }, 100);
    }
  });

  document.addEventListener('gn:tokenchange', function () {
    setTimeout(function () {
      var p = document.getElementById('charactersPanel');
      if (p && !p.hasAttribute('hidden')) onRoute();
    }, 300);
  });

  console.info('[CharTheme] ready v1.0.1 — solo border-left, hereda .card de theme-polish.css');
})();