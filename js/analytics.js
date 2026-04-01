/*!
 * js/analytics.js — Eventos personalizados para Google Analytics
 * Versión: 1.0.0
 */

(function() {
  'use strict';

  // Función segura para enviar eventos (no rompe si gtag no está cargado)
  function sendEvent(eventName, eventParams) {
    if (typeof gtag === 'function') {
      gtag('event', eventName, eventParams || {});
      console.debug('[Analytics]', eventName, eventParams);
    } else {
      // Si gtag no está disponible, guardar en cola para cuando cargue
      if (!window.__gaQueue) window.__gaQueue = [];
      window.__gaQueue.push({ event: eventName, params: eventParams });
    }
  }

  // Procesar cola de eventos pendientes cuando gtag esté disponible
  function processQueue() {
    if (typeof gtag === 'function' && window.__gaQueue && window.__gaQueue.length) {
      window.__gaQueue.forEach(function(item) {
        gtag('event', item.event, item.params || {});
      });
      window.__gaQueue = [];
    }
  }

  // Esperar a que gtag se cargue
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processQueue);
  } else {
    processQueue();
  }

  // Exponer API pública
  window.Analytics = {
    // Módulos
    viewModule: function(moduleName) {
      sendEvent('view_module', { module_name: moduleName });
    },
    
    // Backup/Restaurar
    exportBackup: function() {
      sendEvent('export_backup');
    },
    importBackup: function() {
      sendEvent('import_backup');
    },
    
    // Asistente de Cuentas
    openAccountWizard: function() {
      sendEvent('open_account_wizard');
    },
    downloadExcelTemplate: function() {
      sendEvent('download_excel_template');
    },
    enrichWithAPI: function() {
      sendEvent('enrich_with_api');
    },
    encryptAccountsFile: function() {
      sendEvent('encrypt_accounts_file');
    },
    
    // Wizard's Vault
    forceReloadSeason: function() {
      sendEvent('force_reload_season');
    },
    
    // API Keys
    openApiKeysModal: function() {
      sendEvent('open_api_keys_modal');
    },
    addApiKey: function() {
      sendEvent('add_api_key');
    },
    deleteApiKey: function() {
      sendEvent('delete_api_key');
    }
  };

  console.log('[Analytics] Módulo cargado, eventos disponibles en window.Analytics');
})();