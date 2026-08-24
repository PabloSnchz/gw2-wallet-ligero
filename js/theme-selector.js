/*!
 * js/theme-selector.js — Selector de Temas
 * Versión: 1.0.0
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 *
 * Responsabilidad:
 *  - Modal de selección de temas con grilla visual
 *  - Cambio dinámico del <link id="themeStylesheet">
 *  - Persistencia en localStorage (gn_theme)
 *  - Soporte para modo aleatorio
 */

(function (root) {
  'use strict';

  var LOGT = '[ThemeSelector]';
  var LS_THEME = 'gn_theme';
  var DEFAULT_THEME = 'boveda';

  var THEMES = [
    { id: 'boveda',          name: 'Bóveda',          colors: ['#0e0e10', '#15151a', 'var(--color-amber)', 'var(--color-blue)'] },
    { id: 'catppuccin',      name: 'Catppuccin',      colors: ['#1e1e2e', '#28283a', '#f5c2e7', '#89b4fa'] },
    { id: 'cyberpunk',       name: 'Cyberpunk',       colors: ['#0a0a0f', '#12121a', '#ff00ff', '#00ffff'] },
    { id: 'discord',         name: 'Discord',         colors: ['#1e1f22', '#2b2d31', '#5865f2', '#7b83f5'] },
    { id: 'dracula',         name: 'Dracula',         colors: ['#282a36', '#343746', '#bd93f9', '#50fa7b'] },
    { id: 'everforest',      name: 'Everforest',      colors: ['#2d353b', '#343f44', '#a7c080', '#83c092'] },
    { id: 'fluent',          name: 'Fluent',          colors: ['#202020', '#2a2a2a', '#0078d4', '#4cc2ff'] },
    { id: 'glassmorphism',   name: 'Glassmorphism',   colors: ['#1a1a2e', '#252540', '#64ffda', '#a78bfa'] },
    { id: 'gruvbox',         name: 'Gruvbox',         colors: ['#282828', '#3c3836', '#d79921', '#fabd2f'] },
    { id: 'macos',           name: 'macOS',           colors: ['#f5f5f7', 'var(--tx-1)fff', '#007aff', '#5ac8fa'] },
    { id: 'material-dark',   name: 'Material Dark',   colors: ['#121212', '#1e1e1e', '#bb86fc', '#03dac6'] },
    { id: 'nord',            name: 'Nord',            colors: ['#2e3440', '#3b4252', '#88c0d0', '#81a1c1'] },
    { id: 'notion',          name: 'Notion',          colors: ['var(--tx-1)fff', '#f7f7f5', '#e16259', '#5a67d8'] },
    { id: 'one-dark',        name: 'One Dark',        colors: ['#282c34', '#333842', '#61afef', '#98c379'] },
    { id: 'ps5',             name: 'PS5',             colors: ['#0c0c14', '#161626', '#d4af37', '#00d4ff'] },
    { id: 'solarized-dark',  name: 'Solarized Dark',  colors: ['#002b36', '#073642', '#2aa198', '#b58900'] },
    { id: 'steam',           name: 'Steam',           colors: ['#1b2838', '#2a3f5f', '#66c0f4', '#1a9fff'] },
    { id: 'tokyo-night',     name: 'Tokyo Night',     colors: ['#1a1b26', '#24283b', '#7aa2f7', '#bb9af7'] }
  ];

  var state = {
    currentTheme: null,
    modalOpen: false
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (m) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]; }); }

  function getSavedTheme() {
    try { return localStorage.getItem(LS_THEME) || DEFAULT_THEME; } catch (_) { return DEFAULT_THEME; }
  }

  function setSavedTheme(theme) {
    try { localStorage.setItem(LS_THEME, theme); } catch (_) {}
  }

  function applyTheme(theme) {
    if (theme === 'random') {
      var available = THEMES.filter(function(t) { return t.id !== 'random'; });
      var random = available[Math.floor(Math.random() * available.length)];
      theme = random.id;
    }

    var link = document.getElementById('themeStylesheet');
    if (!link) {
      link = document.createElement('link');
      link.id = 'themeStylesheet';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    link.href = 'css/themes/' + theme + '.css?v=1.0.0';
    document.documentElement.setAttribute('data-theme', theme);
    state.currentTheme = theme;
    setSavedTheme(theme);

    // Actualizar visual del modal
    updateActiveThemeInModal();
    console.info(LOGT, 'Tema aplicado:', theme);
  }

  function createModal() {
    var existing = document.getElementById('themeModal');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.id = 'themeModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'themeModalTitle');
    modal.hidden = true;

    modal.innerHTML = [
      '<div class="modal__backdrop" data-close="1"></div>',
      '<div class="modal__dialog" role="document" style="max-width: 620px;">',
      '  <header class="modal__header">',
      '    <h3 id="themeModalTitle" style="display:flex;align-items:center;gap:8px;">',
      '      <img src="assets/icons/101663.png" width="24" height="24" alt="" style="filter:brightness(0.9);">',
      '      Selector de temas',
      '    </h3>',
      '    <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>',
      '  </header>',
      '  <div class="modal__body">',
      '    <p class="muted" style="margin:0 0 12px 0;">Elegí un tema para personalizar la apariencia de la Bóveda.</p>',
      '    <div id="themeGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:10px;"></div>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    // Wire de cierre
    modal.addEventListener('click', function(e) {
      if (e.target.getAttribute('data-close') === '1') {
        closeModal();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    return modal;
  }

  function renderThemeGrid() {
    var grid = document.getElementById('themeGrid');
    if (!grid) return;

    var currentTheme = state.currentTheme || getSavedTheme();

    var cards = THEMES.map(function(theme) {
      var isActive = (theme.id === currentTheme);
      var swatches = theme.colors.map(function(c) {
        return '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:' + c + ';border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></span>';
      }).join('');

      return [
        '<button class="theme-card" data-theme="' + esc(theme.id) + '" style="',
          'display:flex;flex-direction:column;gap:8px;padding:12px;',
          'background:var(--bg-1);border:2px solid ' + (isActive ? 'var(--acc-1)' : 'var(--bd-1)') + ';',
          'border-radius:12px;cursor:pointer;transition:all 0.15s ease;text-align:left;',
        '">',
          '<div style="display:flex;gap:4px;justify-content:flex-start;">' + swatches + '</div>',
          '<span style="font-size:0.8rem;font-weight:600;color:var(--tx-1);">' + esc(theme.name) + '</span>',
          (isActive ? '<span style="font-size:0.65rem;color:var(--color-green);">✓ Activo</span>' : ''),
        '</button>'
      ].join('');
    });

    // Agregar tarjeta de Aleatorio
    var randomCard = [
      '<button class="theme-card" data-theme="random" style="',
        'display:flex;flex-direction:column;gap:8px;padding:12px;',
        'background:var(--bg-1);border:2px solid var(--bd-1);',
        'border-radius:12px;cursor:pointer;transition:all 0.15s ease;text-align:left;',
      '">',
        '<div style="display:flex;gap:4px;justify-content:flex-start;">',
          '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:conic-gradient(#ff0000, #ff8800, var(--tx-1)f00, #00ff00, #0088ff, #8800ff, #ff0000);border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></span>',
          '<span style="font-size:1rem;">🎲</span>',
        '</div>',
        '<span style="font-size:0.8rem;font-weight:600;color:var(--tx-1);">Aleatorio</span>',
        '<span style="font-size:0.65rem;color:var(--muted);">Sorprendeme</span>',
      '</button>'
    ].join('');

    grid.innerHTML = cards + randomCard;

    // Wire de clicks
    $$('.theme-card', grid).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var theme = btn.getAttribute('data-theme');
        applyTheme(theme);
      });
      btn.addEventListener('mouseenter', function() {
        btn.style.borderColor = 'var(--acc-1)';
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.borderColor = (btn.getAttribute('data-theme') === state.currentTheme) ? 'var(--acc-1)' : 'var(--bd-1)';
        btn.style.transform = 'translateY(0)';
      });
    });
  }

  function updateActiveThemeInModal() {
    var grid = document.getElementById('themeGrid');
    if (!grid) return;
    renderThemeGrid();
  }

  function openModal() {
    var modal = createModal();
    renderThemeGrid();
    modal.hidden = false;
    modal.querySelector('.modal__dialog')?.focus();
    state.modalOpen = true;
  }

  function closeModal() {
    var modal = document.getElementById('themeModal');
    if (modal) modal.hidden = true;
    state.modalOpen = false;
  }

  function injectThemeButton() {
    var left = document.querySelector('.an-util-left');
    if (!left || document.getElementById('themeToggleBtn')) return;

    var sep = document.createElement('span');
    sep.className = 'an-sep';
    sep.textContent = '|';

    var btn = document.createElement('a');
    btn.className = 'an-util-link';
    btn.id = 'themeToggleBtn';
    btn.href = '#';
    btn.title = 'Cambiar tema';
    btn.setAttribute('aria-label', 'Cambiar tema');
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.innerHTML = '<img src="assets/icons/101663.png" width="16" height="16" alt="Tema" style="vertical-align:middle;">';

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openModal();
    });

    // Insertar después del botón Home (el que lleva a #/welcome)
    var homeLink = left.querySelector('.an-home-link');
    if (homeLink) {
      homeLink.insertAdjacentElement('afterend', sep);
      sep.insertAdjacentElement('afterend', btn);
    } else {
      left.appendChild(sep);
      left.appendChild(btn);
    }

    console.info(LOGT, 'Botón de temas injectado en el header');
  }

  function init() {
    // Aplicar tema guardado
    var saved = getSavedTheme();
    applyTheme(saved);

    // Inyectar botón cuando el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectThemeButton);
    } else {
      injectThemeButton();
    }

    console.info(LOGT, 'OK v1.0.0 — Temas disponibles:', THEMES.length);
  }

  // API pública
  root.ThemeSelector = {
    init: init,
    applyTheme: applyTheme,
    openModal: openModal,
    closeModal: closeModal,
    getThemes: function() { return THEMES.slice(); },
    getCurrentTheme: function() { return state.currentTheme; },
    _debug: function() { return state; }
  };

  // Auto-init
  init();

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));