/*!
 * js/theme-selector.js — Selector de Temas
 * Versión: 1.1.0
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
    { id: 'boveda',          name: 'Bóveda',          mood: 'serio',      colors: ['#0e0e10', '#15151a', '#ffd966', '#7bc2ff'] },
    { id: 'catppuccin',      name: 'Catppuccin',      mood: 'pastel',     colors: ['#1e1e2e', '#28283a', '#f5c2e7', '#89b4fa'] },
    { id: 'cyberpunk',       name: 'Cyberpunk',       mood: 'agresivo',   colors: ['#0a0a0f', '#12121a', '#ff00ff', '#00ffff'] },
    { id: 'discord',         name: 'Discord',         mood: 'funcional',  colors: ['#1e1f22', '#2b2d31', '#5865f2', '#7b83f5'] },
    { id: 'dracula',         name: 'Dracula',         mood: 'vampírico',  colors: ['#282a36', '#343746', '#bd93f9', '#50fa7b'] },
    { id: 'everforest',      name: 'Everforest',      mood: 'boscoso',    colors: ['#2d353b', '#343f44', '#a7c080', '#83c092'] },
    { id: 'fluent',          name: 'Fluent',          mood: 'limpio',     colors: ['#202020', '#2a2a2a', '#0078d4', '#4cc2ff'] },
    { id: 'glassmorphism',   name: 'Glassmorphism',   mood: 'vidrio',     colors: ['#1a1a2e', '#252540', '#64ffda', '#a78bfa'] },
    { id: 'gruvbox',         name: 'Gruvbox',         mood: 'vintage',    colors: ['#282828', '#3c3836', '#d79921', '#fabd2f'] },
    { id: 'macos',           name: 'macOS',           mood: 'elegante',   colors: ['#f5f5f7', '#ffffff', '#007aff', '#5ac8fa'] },
    { id: 'material-dark',   name: 'Material Dark',   mood: 'material',   colors: ['#121212', '#1e1e1e', '#bb86fc', '#03dac6'] },
    { id: 'nord',            name: 'Nord',            mood: 'nórdico',    colors: ['#2e3440', '#3b4252', '#88c0d0', '#81a1c1'] },
    { id: 'notion',          name: 'Notion',          mood: 'calma',      colors: ['#ffffff', '#f7f7f5', '#e16259', '#5a67d8'] },
    { id: 'one-dark',        name: 'One Dark',        mood: 'atómico',    colors: ['#282c34', '#333842', '#61afef', '#98c379'] },
    { id: 'ps5',             name: 'PS5',             mood: 'premium',    colors: ['#0c0c14', '#161626', '#d4af37', '#00d4ff'] },
    { id: 'solarized-dark',  name: 'Solarized Dark',  mood: 'terroso',    colors: ['#002b36', '#073642', '#2aa198', '#b58900'] },
    { id: 'steam',           name: 'Steam',           mood: 'retro',      colors: ['#1b2838', '#2a3f5f', '#66c0f4', '#1a9fff'] },
    { id: 'tokyo-night',     name: 'Tokyo Night',     mood: 'nocturno',   colors: ['#1a1b26', '#24283b', '#7aa2f7', '#bb9af7'] }
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
      '<div class="modal__dialog" role="document" style="max-width: 680px;">',
      '  <header class="modal__header">',
      '    <h3 id="themeModalTitle" style="display:flex;align-items:center;gap:8px;font-weight:600;">',
      '      <img src="assets/icons/101663.png" width="20" height="20" alt="" style="filter:brightness(0.9);">',
      '      Selector de temas',
      '    </h3>',
      '    <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>',
      '  </header>',
      '  <div class="modal__body">',
      '    <p class="muted" style="margin:0 0 14px 0;">Elegí un tema para personalizar la apariencia de la Bóveda.</p>',
      '    <div id="themeGrid" style="display:grid;grid-template-columns:1fr;gap:8px;"></div>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

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

    var rows = THEMES.map(function(theme) {
      var isActive = (theme.id === currentTheme);
      var bgColor = theme.colors[0];
      var panelColor = theme.colors[1];
      var accentColor = theme.colors[2];
      var accent2Color = theme.colors[3];

      var swatches = theme.colors.map(function(c) {
        return '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + c + ';border:1px solid rgba(255,255,255,0.3);flex-shrink:0;"></span>';
      }).join('');

      return [
        '<button class="theme-card' + (isActive ? ' theme-card--active' : '') + '" data-theme="' + esc(theme.id) + '" style="',
          'display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;',
          'background:' + bgColor + ';',
          'border:1px solid ' + panelColor + ';',
          'border-left:3px solid ' + accentColor + ';',
          'border-radius:8px;cursor:pointer;text-align:left;',
          'transition:all 0.2s cubic-bezier(0.2,0.9,0.4,1.1);',
        '">',
          '<div style="display:flex;gap:3px;justify-content:flex-start;flex-shrink:0;">' + swatches + '</div>',
          '<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;">',
            '<span style="font-size:0.85rem;font-weight:700;color:' + accentColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(theme.name) + '</span>',
            '<span style="font-size:0.7rem;color:' + accent2Color + ';text-transform:lowercase;">' + esc(theme.mood || '') + '</span>',
          '</div>',
          (isActive ? '<span style="font-size:0.65rem;color:#ffffff;background:' + accentColor + ';padding:2px 8px;border-radius:20px;flex-shrink:0;font-weight:700;">✓ Activo</span>' : ''),
        '</button>'
      ].join('');
    });

    var randomRow = [
      '<button class="theme-card" data-theme="random" style="',
        'display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;',
        'background:var(--bg-1);',
        'border:1px solid var(--bd-1);',
        'border-left:3px solid transparent;',
        'border-radius:8px;cursor:pointer;text-align:left;',
        'transition:all 0.2s cubic-bezier(0.2,0.9,0.4,1.1);',
      '">',
        '<div style="display:flex;gap:3px;justify-content:flex-start;flex-shrink:0;">',
          '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:conic-gradient(#ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000);border:1px solid rgba(255,255,255,0.3);"></span>',
          '<span style="font-size:1rem;">🎲</span>',
        '</div>',
        '<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;">',
          '<span style="font-size:0.85rem;font-weight:700;color:var(--tx-2);">Aleatorio</span>',
          '<span style="font-size:0.7rem;color:var(--muted);">Sorprendeme</span>',
        '</div>',
      '</button>'
    ].join('');

    grid.innerHTML = rows.join('') + randomRow;

    $$('.theme-card', grid).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var theme = btn.getAttribute('data-theme');
        applyTheme(theme);
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
    var saved = getSavedTheme();
    applyTheme(saved);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectThemeButton);
    } else {
      injectThemeButton();
    }

    console.info(LOGT, 'OK v1.1.0 — Temas disponibles:', THEMES.length);
  }

  root.ThemeSelector = {
    init: init,
    applyTheme: applyTheme,
    openModal: openModal,
    closeModal: closeModal,
    getThemes: function() { return THEMES.slice(); },
    getCurrentTheme: function() { return state.currentTheme; },
    _debug: function() { return state; }
  };

  init();

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));