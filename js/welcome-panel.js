/*!
 * js/welcome-panel.js — Pantalla de Bienvenida
 * v1.4.0 (2026-05-04)
 * 
 * MEJORAS v1.4.0:
 * - Agregado Inventario y Personajes en funcionalidades y acceso rápido
 * 
 * MEJORAS v1.3.0:
 * - Rediseño completo de todas las secciones con tarjetas y glows
 * - Íconos agrandados (32-40px) para más presencia visual
 * - Hover con glow suave en todas las tarjetas interactivas
 * - Sección Acceso Rápido: grid de 4 columnas con tarjetas
 * - Agregado Raids entre Actividades y Personajes
 * - Comunidad y Apoyo migrados a formato tarjeta
 * 
 * v1.2.0:
 * - Iconos exclusivos para cada funcionalidad (no repetidos de los paneles)
 */

(function (root) {
  'use strict';
  var LOG = '[Welcome]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    LINKS: {
      discord: 'https://discord.gg/ZGNsfsqyKe',
      instagram: 'https://www.instagram.com/pablin.schez/',
      youtube: 'https://www.youtube.com/@pablinschez',
      twitch: 'https://www.twitch.tv/pblsnchz',
      github: 'https://github.com/PabloSnchz',
      paypal: 'https://www.paypal.com/paypalme/pblsnchz',
      kofi: 'https://ko-fi.com/pablinschez',
      email: 'pablinnn@gmail.com'
    },
    FEATURE_ICONS: {
      wallet: 'assets/icons/Welcome/1013045.png',
      meta: 'assets/icons/Welcome/1770688.png',
      achievements: 'assets/icons/Welcome/605001.png',
      wv: 'assets/icons/Welcome/3126786.png',
      activities: 'assets/icons/Welcome/961368.png',
      inventory: 'assets/icons/Welcome/358409.png',
      characters: 'assets/icons/Welcome/784388.png',
      accounts: 'assets/icons/Welcome/733266.png'
    },
    QUICK_ICONS: {
      wallet: 'assets/icons/733322.png',
      meta: 'assets/icons/102420.png',
      achievements: 'assets/icons/155059.png',
      wv: 'assets/icons/3172791.png',
      activities: 'assets/icons/1302773.png',
      raids: 'assets/icons/raids/raid-icon.png',
      inventory: 'assets/icons/Welcome/358409.png',
      characters: 'assets/icons/156678.png',
      accounts: 'assets/icons/3601748.png'
    },
    SOCIAL_ICONS: {
      discord: 'assets/icons/Welcome/discord.png',
      instagram: 'assets/icons/Welcome/instagram.png',
      youtube: 'assets/icons/Welcome/youtube.png',
      twitch: 'assets/icons/Welcome/twitchlogo.png',
      github: 'assets/icons/Welcome/github.png'
    },
    ICONS: {
      home: 'assets/icons/Welcome/3380755.png'
    }
  };

  // Estilo de hover reutilizable para tarjetas interactivas
  var HOVER_ATTRS = ' onmouseover="this.style.borderColor=\'#5a6e9a\';this.style.boxShadow=\'0 0 14px rgba(90,110,154,0.25)\';this.style.transform=\'scale(1.02)\';" onmouseout="this.style.borderColor=\'#26262b\';this.style.boxShadow=\'none\';this.style.transform=\'scale(1)\';"';
  var CARD_BASE = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 8px;background:#0f1116;border:1px solid #26262b;border-radius:10px;text-decoration:none;transition:all 0.2s ease;text-align:center;';

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
        
                <!-- Sección: ¿Qué puedo hacer aquí? -->
                <div class="card" style="padding: 24px;">
                  <h3 style="margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
                    <img src="assets/icons/Welcome/1302775.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
                    ¿Qué puedo hacer aquí?
                  </h3>
                  <ul style="margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;">
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.wallet}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Ver mi cartera de divisas (oro, gemas, karma, laureles)</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.meta}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Seguir meta eventos y world bosses en tiempo real</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.achievements}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Consultar logros y próximos a completar</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.wv}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Revisar objetivos de la Cámara del Brujo</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.activities}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Gestionar actividades semanales (llave del León Negro, Leivas)</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.characters}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Buscar objetos en tu inventario, banco y materiales. Administrar personajes y POIs</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="assets/icons/Welcome/102338.png" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Seguimiento semanal de raids: alas, encuentros, drops y mecánicas</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028;">
                      <img src="${CONFIG.FEATURE_ICONS.accounts}" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                      <span style="color: #c8cdd8; font-weight: 500; font-size: 0.85rem;">Guardar tus cuentas de forma segura (todo en tu PC)</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #1e2028; cursor: pointer;">
                      <a href="#" onclick="event.preventDefault(); var m = document.getElementById('guideModal'); if (m) m.hidden = false;" style="display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; width: 100%;">
                        <img src="assets/icons/Welcome/222580.png" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain; flex-shrink: 0;">
                        <span style="color: #7bc2ff; font-weight: 600; font-size: 0.85rem;">Guía de Usuario — Aprendé a sacarle el máximo provecho a la Bóveda</span>
                      </a>
                    </li>
                  </ul>
                </div>

        <!-- Fila unificada: API Key + Asistente de Cuentas -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          
          <!-- API Key -->
          <div class="card" style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
              <img src="assets/icons/Welcome/2604909.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
              ¿Ya tenés una API Key?
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
              <button id="welcomeAddKeyBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; font-size: 0.9rem;">
                <img src="assets/icons/Welcome/155911.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
                Agregar API Key
              </button>
              <button id="welcomeManageKeysBtn" class="btn" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; font-size: 0.9rem;">
                <img src="assets/icons/Welcome/3443186.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
                Gestionar Keys
              </button>
            </div>
            <p class="muted" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/Welcome/547832.png" width="18" height="18" alt="" style="vertical-align: middle;">
              Obtenela en <a href="https://account.arena.net/applications" target="_blank" rel="noopener" style="color: #7bc2ff; font-weight: 500;">account.arena.net</a>
            </p>
          </div>

          <!-- Asistente de Cuentas -->
          <div class="card" style="padding: 24px; background: linear-gradient(135deg, #1a1e2a 0%, #151a28 100%);">
            <h3 style="margin: 0 0 16px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
              <img src="assets/icons/Welcome/2604909.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
              Asistente de Cuentas
            </h3>
            <button id="welcomeAccountsBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; font-size: 0.9rem; margin-bottom: 14px;">
              <img src="assets/icons/Welcome/2604904.png" width="22" height="22" alt="" style="filter: brightness(0.9);">
              Ir al Asistente
            </button>
            <p class="muted" style="display: flex; align-items: flex-start; gap: 8px;">
              <img src="assets/icons/Welcome/733266.png" width="18" height="18" alt="" style="vertical-align: middle; margin-top: 1px;">
              <span>Guardá emails, contraseñas y API Keys de forma segura. Todo en tu PC.</span>
            </p>
          </div>

        </div>

        <!-- Sección: Acceso Rápido -->
        <div class="card" style="padding: 24px;">
          <h3 style="margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
            <img src="assets/icons/Welcome/102631.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Acceso rápido
          </h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <a href="#/cards" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.wallet}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Cartera</span>
            </a>
            <a href="#/meta" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.meta}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Meta y Eventos</span>
            </a>
            <a href="#/account/achievements" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.achievements}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Logros</span>
            </a>
            <a href="#/account/wizards-vault" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.wv}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.7rem;">Cámara del Brujo</span>
            </a>
            <a href="#/activities" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.activities}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Actividades</span>
            </a>
            <a href="#/account/raids" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.raids}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Raids</span>
            </a>
            <a href="#/account/characters" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.inventory}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.75rem;">Inventario y Personajes</span>
            </a>
            <a href="#/account/accounts" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.QUICK_ICONS.accounts}" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Cuentas</span>
            </a>
          </div>
        </div>

        <!-- Sección: Comunidad -->
        <div class="card" style="padding: 24px;">
          <h3 style="margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
            <img src="assets/icons/Welcome/156409.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Comunidad
          </h3>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px;">
            <a href="${CONFIG.LINKS.discord}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.SOCIAL_ICONS.discord}" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Discord</span>
            </a>
            <a href="${CONFIG.LINKS.instagram}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.SOCIAL_ICONS.instagram}" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Instagram</span>
            </a>
            <a href="${CONFIG.LINKS.youtube}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.SOCIAL_ICONS.youtube}" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">YouTube</span>
            </a>
            <a href="${CONFIG.LINKS.twitch}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.SOCIAL_ICONS.twitch}" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">Twitch</span>
            </a>
            <a href="${CONFIG.LINKS.github}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="${CONFIG.SOCIAL_ICONS.github}" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.8rem;">GitHub</span>
            </a>
          </div>
          <p class="muted" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/Welcome/11_Cartero aviador quaggan.png" width="18" height="18" alt="" style="vertical-align: middle;">
            ${CONFIG.LINKS.email}
          </p>
        </div>

        <!-- Sección: Apoyar el proyecto -->
        <div class="card" style="padding: 24px;">
          <h3 style="margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: 700; color: #e0e4ed;">
            <img src="assets/icons/Welcome/156143.png" width="34" height="34" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Apoyar el proyecto
          </h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 14px;">
            <a href="${CONFIG.LINKS.paypal}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="assets/icons/Welcome/payp.png" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.85rem;">PayPal</span>
            </a>
            <a href="${CONFIG.LINKS.kofi}" target="_blank" rel="noopener" style="${CARD_BASE}"${HOVER_ATTRS}>
              <img src="assets/icons/Welcome/kofi.png" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <span style="color: #e0e4ed; font-weight: 600; font-size: 0.85rem;">Ko-fi</span>
            </a>
          </div>
          <p class="muted" style="font-weight: 500;">Tu apoyo ayuda a mantener el servidor y desarrollar nuevas funciones.</p>
        </div>
      </div>
    `;

    // Wire eventos de modales (SIN CAMBIOS)
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

    // Función auxiliar para asegurar que el modal cierra correctamente (SIN CAMBIOS)
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
      console.info(LOG, 'ready v1.4.0 — Agregado Inventario y Personajes');
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
