/*!
 * js/welcome-panel.js — Pantalla de Bienvenida
 * v1.2.0 (2026-03-27)
 * 
 * MEJORAS v1.2.0:
 * - Iconos exclusivos para cada funcionalidad (no repetidos de los paneles)
 * 
 * v1.1.0:
 * - Iconos en lista de funcionalidades
 * 
 * v1.0.0:
 * - Pantalla de inicio con información de la Bóveda, accesos rápidos,
 *   enlaces a redes sociales y opciones de apoyo.
 */

(function (root) {
  'use strict';
  var LOG = '[Welcome]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    // Enlaces sociales
    LINKS: {
      discord: 'https://discord.gg/ZGNsfsqyKe',
      instagram: 'https://www.instagram.com/pablin.schez/',
      youtube: 'https://www.youtube.com/@pablinschez',
      twitch: 'https://www.twitch.tv/pblsnchz',
      github: 'https://github.com/PabloSnchz',
      paypal: 'https://www.paypal.com/paypalme/pblsnchz',
      kofi: 'https://ko-fi.com/pablinschez',
      email: 'contacto@bovedagatonegro.com'
    },
    // Iconos exclusivos para las funcionalidades (diferentes a los de los paneles)
    FEATURE_ICONS: {
      wallet: 'assets/icons/Welcome/1013045.png',
      meta: 'assets/icons/Welcome/1770688.png',
      achievements: 'assets/icons/Welcome/605001.png',
      wv: 'assets/icons/Welcome/3126786.png',
      activities: 'assets/icons/Welcome/961368.png',
      characters: 'assets/icons/Welcome/784388.png',
      accounts: 'assets/icons/Welcome/733266.png'
    },
    // Iconos para accesos rápidos (mantenemos los mismos de los paneles)
    QUICK_ICONS: {
      wallet: 'assets/icons/733322.png',
      meta: 'assets/icons/102420.png',
      achievements: 'assets/icons/155059.png',
      wv: 'assets/icons/3172791.png',
      activities: 'assets/icons/1302773.png',
      characters: 'assets/icons/156678.png',
      accounts: 'assets/icons/3601748.png'
    },
    ICONS: {
      home: 'assets/icons/Welcome/3380755.png'
    }
  };

  // =======================================================================
  // 1. ESTADO
  // =======================================================================
  var state = {
    inited: false,
    active: false
  };

  // =======================================================================
  // 2. UTILIDADES
  // =======================================================================
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s || '').replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }); }

  // =======================================================================
  // 3. RENDERIZADO
  // =======================================================================
  function render() {
    var container = $('#welcomePanel .panel__body');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Sección: Funcionalidades con iconos exclusivos -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/1302775.png" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
            ¿Qué puedo hacer aquí?
          </h3>
          <ul style="margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;">
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.wallet}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Ver mi cartera de divisas (oro, gemas, karma, laureles)</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.meta}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Seguir meta eventos y world bosses en tiempo real</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.achievements}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Consultar logros y próximos a completar</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.wv}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Revisar objetivos de la Cámara del Brujo</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.activities}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Gestionar actividades semanales (llave del León Negro, Leivas)</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.characters}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Administrar tus personajes y sus POIs</span>
            </li>
            <li style="display: flex; align-items: center; gap: 12px;">
              <img src="${CONFIG.FEATURE_ICONS.accounts}" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <span>Guardar tus cuentas de forma segura (todo en tu PC)</span>
            </li>
          </ul>
        </div>

        <!-- Sección: API Key -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/2604909.png" width="24" height="24" alt="" style="filter: brightness(0.9); object-fit: contain;">
            ¿Ya tenés una API Key?
          </h3>
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            <button id="welcomeAddKeyBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/Welcome/155911.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
              Agregar API Key
            </button>
            <button id="welcomeManageKeysBtn" class="btn" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/Welcome/3443186.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
              Gestionar Keys
            </button>
          </div>
          <p class="muted">
            <img src="assets/icons/Welcome/547832.png" width="16" height="16" alt="" style="vertical-align: middle; margin-right: 4px;">
            Podés obtener tu API Key en <a href="https://account.arena.net/applications" target="_blank" rel="noopener">account.arena.net/applications</a>
          </p>
        </div>

        <!-- Sección: Asistente de Cuentas -->
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #1a1e2a 0%, #151a28 100%);">
          <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/2604909.png" width="24" height="24" alt="" style="filter: brightness(0.9); object-fit: contain;">
            ¿Querés guardar tus cuentas de forma segura?
          </h3>
          <button id="welcomeAccountsBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
            <img src="assets/icons/Welcome/2604904.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
            Ir al Asistente de Cuentas
          </button>
          <p class="muted">
            <img src="assets/icons/Welcome/733266.png" width="16" height="16" alt="" style="vertical-align: middle; margin-right: 4px;">
            Guardá emails, contraseñas y API Keys de todas tus cuentas en tu PC.<br>
            Todo el proceso ocurre en tu navegador — ningún dato sale de tu computadora.
          </p>
        </div>

        <!-- Sección: Acceso Rápido (con iconos de los paneles) -->
<div class="card" style="padding: 20px;">
  <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
    <img src="assets/icons/Welcome/102631.png" width="24" height="24" alt="" style="filter: brightness(0.9); object-fit: contain;">
    Acceso rápido
  </h3>
  <div style="display: flex; flex-wrap: wrap; gap: 12px;">
    <a href="#/cards" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.wallet}" width="20" height="20" alt=""> Cartera
    </a>
    <a href="#/meta" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.meta}" width="20" height="20" alt=""> Meta & Eventos
    </a>
    <a href="#/account/achievements" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.achievements}" width="20" height="20" alt=""> Logros
    </a>
    <a href="#/account/wizards-vault" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.wv}" width="20" height="20" alt=""> Cámara del Brujo
    </a>
    <a href="#/activities" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.activities}" width="20" height="20" alt=""> Actividades
    </a>
    <a href="#/account/characters" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.characters}" width="20" height="20" alt=""> Personajes
    </a>
    <a href="#/account/accounts" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
      <img src="${CONFIG.QUICK_ICONS.accounts}" width="20" height="20" alt=""> Cuentas
    </a>
  </div>
</div>

        <!-- Sección: Comunidad -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/156409.png" width="24" height="24" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Comunidad
          </h3>
          <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
            <a href="${CONFIG.LINKS.discord}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/discord.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              Discord
            </a>
            <a href="${CONFIG.LINKS.instagram}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/instagram.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              Instagram
            </a>
            <a href="${CONFIG.LINKS.youtube}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/youtube.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              YouTube
            </a>
            <a href="${CONFIG.LINKS.twitch}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/twitchlogo.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              Twitch
            </a>
            <a href="${CONFIG.LINKS.github}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/github.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              GitHub
            </a>
          </div>
          <p class="muted">
            <img src="assets/icons/Welcome/11_Cartero aviador quaggan.png" width="16" height="16" alt="" style="vertical-align: middle; margin-right: 4px;">
            ${CONFIG.LINKS.email}
          </p>
        </div>

        <!-- Sección: Apoyar el proyecto -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/156143.png" width="24" height="24" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Apoyar el proyecto
          </h3>
          <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px;">
            <a href="${CONFIG.LINKS.paypal}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/payp.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              PayPal
            </a>
            <a href="${CONFIG.LINKS.kofi}" target="_blank" rel="noopener" class="btn btn--ghost" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <img src="assets/icons/Welcome/kofi.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              Ko-fi
            </a>
          </div>
          <p class="muted">Tu apoyo ayuda a mantener el servidor y desarrollar nuevas funciones.</p>
        </div>
      </div>
    `;

    // Wire eventos
    var addKeyBtn = document.getElementById('welcomeAddKeyBtn');
    if (addKeyBtn) {
      addKeyBtn.onclick = function() {
        var modal = document.getElementById('keysModal');
        if (modal) {
          modal.hidden = false;
          ensureModalCloses(modal);
        }
      };
    }

    var manageKeysBtn = document.getElementById('welcomeManageKeysBtn');
    if (manageKeysBtn) {
      manageKeysBtn.onclick = function() {
        var modal = document.getElementById('keysModal');
        if (modal) {
          modal.hidden = false;
          ensureModalCloses(modal);
        }
      };
    }

    var accountsBtn = document.getElementById('welcomeAccountsBtn');
    if (accountsBtn) {
      accountsBtn.onclick = function() {
        location.hash = '#/account/accounts';
      };
    }

    // Función auxiliar para asegurar que el modal cierra correctamente
    function ensureModalCloses(modal) {
      if (modal.__closeHandlerSetup) return;
      modal.__closeHandlerSetup = true;
      
      var backdrop = modal.querySelector('.modal__backdrop');
      var closeBtn = modal.querySelector('.modal__close');
      
      var closeModal = function() {
        modal.hidden = true;
      };
      
      if (backdrop) backdrop.onclick = closeModal;
      if (closeBtn) closeBtn.onclick = closeModal;
      
      // Escuchar ESC
      var escHandler = function(e) {
        if (e.key === 'Escape' && !modal.hidden) {
          modal.hidden = true;
        }
      };
      document.addEventListener('keydown', escHandler);
    }
  }

  // =======================================================================
  // 4. INICIALIZACIÓN DEL PANEL
  // =======================================================================
  function ensurePanel() {
    var host = document.getElementById('welcomePanel');
    if (host) return host;

    host = document.createElement('section');
    host.id = 'welcomePanel';
    host.className = 'panel col-main';
    host.setAttribute('hidden', '');

    host.innerHTML = '' +
      '<h2 class="panel__title"><img src="' + CONFIG.ICONS.home + '" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> Bienvenido a la Bóveda</h2>' +
      '<div class="panel__body"></div>';

    var anchor = document.getElementById('walletPanel');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor);
    } else {
      document.body.appendChild(host);
    }
    return host;
  }

  // =======================================================================
  // 5. CICLO DE VIDA
  // =======================================================================
  function activate() {
    console.log(LOG, '🚀 activate() llamado');
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    render();
  }

  function deactivate() {
    state.active = false;
    var panel = document.getElementById('welcomePanel');
    if (panel) panel.setAttribute('hidden', '');
  }

  // =======================================================================
  // 6. API PÚBLICA
  // =======================================================================
  var Welcome = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      state.inited = true;
      console.info(LOG, 'ready v1.2.0 — Iconos exclusivos para cada funcionalidad');
    },
    activate: activate,
    deactivate: deactivate,
    Route: {
      path: 'welcome',
      mount: activate,
      unmount: deactivate
    },
    _debug: function() {
      return { active: state.active };
    }
  };

  root.Welcome = Welcome;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Welcome.initOnce);
  } else {
    Welcome.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);