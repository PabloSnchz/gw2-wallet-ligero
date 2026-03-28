/*!
 * js/settings-manager.js — Gestión de Exportación/Importación de configuración
 * v1.0.2 (2026-03-28)
 * 
 * Permite exportar e importar toda la configuración de la app:
 * - API Keys (nombres + keys, key seleccionada)
 * - Wizard's Vault (pins, marks por temporada)
 * - Wallet (pins, compact, snapshots)
 * - Activities (toggles, home nodes marcados)
 * - Characters (POIs asignados, historial de ubicaciones)
 * - Meta (hecho hoy, favoritos)
 * - Global (welcomeSeen)
 * 
 * v1.0.2: Agregados métodos exportData() e importFromData() para sincronización con GitHub Gist
 */

(function(root) {
  'use strict';
  var LOG = '[SettingsManager]';
  
  // Versión actual del formato de exportación
  var EXPORT_VERSION = '3.0';
  
  // =======================================================================
  // 1. RECOPILACIÓN DE DATOS (EXPORT)
  // =======================================================================
  
  /**
   * Exporta todas las API Keys
   * Nota: Las claves se almacenan en localStorage como 'gw2_keys' y 'gw2_selected_key_v1'
   */
  function exportApiKeys() {
    try {
      var keys = JSON.parse(localStorage.getItem('gw2_keys') || '[]');
      var selected = localStorage.getItem('gw2_selected_key_v1');
      console.log(LOG, 'API Keys exportadas:', keys.length);
      return { list: keys, selected: selected };
    } catch (e) {
      console.warn(LOG, 'Error exportando API Keys:', e);
      return { list: [], selected: null };
    }
  }
  
  /**
   * Exporta datos de Wizard's Vault (desde WVSeasonStore)
   */
  function exportWVData() {
    try {
      // Obtener índice de temporadas
      var seasonIndex = null;
      try {
        seasonIndex = JSON.parse(localStorage.getItem('wv:season:index'));
      } catch(e) {}
      
      // Recopilar todas las temporadas existentes
      var seasons = {};
      var prefix = 'wv:season:';
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0 && key !== 'wv:season:index') {
          try {
            seasons[key.replace(prefix, '')] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
      }
      
      return { seasonIndex: seasonIndex, seasons: seasons };
    } catch (e) {
      console.warn(LOG, 'Error exportando WV data:', e);
      return { seasonIndex: null, seasons: {} };
    }
  }
  
  /**
   * Exporta datos de Wallet
   */
  function exportWalletData() {
    try {
      var compact = localStorage.getItem('walletCompact') === 'true';
      
      // Recopilar pins por API key
      var pins = {};
      var snapshots = {};
      
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('walletPins:') === 0) {
          var keyId = key.replace('walletPins:', '');
          try {
            pins[keyId] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
        if (key && key.indexOf('walletSnapshot:') === 0) {
          var snapshotKey = key.replace('walletSnapshot:', '');
          try {
            snapshots[snapshotKey] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
      }
      
      return { compact: compact, pins: pins, snapshots: snapshots };
    } catch (e) {
      console.warn(LOG, 'Error exportando Wallet data:', e);
      return { compact: false, pins: {}, snapshots: {} };
    }
  }
  
  /**
   * Exporta datos de Activities
   */
  function exportActivitiesData() {
    try {
      var toggles = localStorage.getItem('gn_activities_toggles');
      var homeNodesMarked = {};
      try {
        homeNodesMarked = JSON.parse(localStorage.getItem('gn_home_nodes_marked') || '{}');
      } catch(e) {}
      
      return { toggles: toggles, homeNodesMarked: homeNodesMarked };
    } catch (e) {
      console.warn(LOG, 'Error exportando Activities data:', e);
      return { toggles: null, homeNodesMarked: {} };
    }
  }
  
  /**
   * Exporta datos de Characters
   */
  function exportCharactersData() {
    try {
      var assignments = {};
      var locationHistory = {};
      
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('characters:assignments:') === 0) {
          var keyId = key.replace('characters:assignments:', '');
          try {
            assignments[keyId] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
        if (key && key.indexOf('characters:location_history:') === 0) {
          var histKey = key.replace('characters:location_history:', '');
          try {
            locationHistory[histKey] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
      }
      
      return { assignments: assignments, locationHistory: locationHistory };
    } catch (e) {
      console.warn(LOG, 'Error exportando Characters data:', e);
      return { assignments: {}, locationHistory: {} };
    }
  }
  
  /**
   * Exporta datos de Meta & Eventos
   */
  function exportMetaData() {
    try {
      var hechoHoy = {};
      var favoritos = {};
      
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('gn_meta_hecho_hoy:') === 0) {
          var keyId = key.replace('gn_meta_hecho_hoy:', '');
          try {
            hechoHoy[keyId] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
        if (key && key.indexOf('gn_meta_favs:') === 0) {
          var favKey = key.replace('gn_meta_favs:', '');
          try {
            favoritos[favKey] = JSON.parse(localStorage.getItem(key));
          } catch(e) {}
        }
      }
      
      return { hechoHoy: hechoHoy, favoritos: favoritos };
    } catch (e) {
      console.warn(LOG, 'Error exportando Meta data:', e);
      return { hechoHoy: {}, favoritos: {} };
    }
  }
  
  /**
   * Exporta datos globales
   */
  function exportGlobalData() {
    try {
      var welcomeSeen = localStorage.getItem('gn_welcome_seen') === 'true';
      return { welcomeSeen: welcomeSeen };
    } catch (e) {
      console.warn(LOG, 'Error exportando Global data:', e);
      return { welcomeSeen: false };
    }
  }
  
  /**
   * Exporta TODA la configuración (para descarga manual)
   */
  function exportAll() {
    var exportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'gw2-wallet-ligero',
      data: {
        apiKeys: exportApiKeys(),
        wv: exportWVData(),
        wallet: exportWalletData(),
        activities: exportActivitiesData(),
        characters: exportCharactersData(),
        meta: exportMetaData(),
        global: exportGlobalData()
      }
    };
    
    var jsonString = JSON.stringify(exportData, null, 2);
    var blob = new Blob([jsonString], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gw2-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (window.toast) {
      window.toast('success', 'Configuración exportada correctamente', { ttl: 2000 });
    } else {
      console.log(LOG, 'Configuración exportada');
    }
  }
  
  /**
   * Exporta datos a formato JSON (para sincronización con GitHub Gist)
   */
  function exportData() {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'gw2-wallet-ligero',
      data: {
        apiKeys: exportApiKeys(),
        wv: exportWVData(),
        wallet: exportWalletData(),
        activities: exportActivitiesData(),
        characters: exportCharactersData(),
        meta: exportMetaData(),
        global: exportGlobalData()
      }
    };
  }
  
  // =======================================================================
  // 2. RESTAURACIÓN DE DATOS (IMPORT)
  // =======================================================================
  
  /**
   * Valida la estructura del archivo importado
   */
  function validateImportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Archivo inválido');
    }
    if (data.version !== EXPORT_VERSION) {
      throw new Error('Versión no compatible. Se esperaba ' + EXPORT_VERSION);
    }
    if (data.app !== 'gw2-wallet-ligero') {
      throw new Error('Este archivo no pertenece a Bóveda del Gato Negro');
    }
    return true;
  }
  
  /**
   * Importa API Keys
   * Nota: Las claves se almacenan en localStorage como 'gw2_keys' y 'gw2_selected_key_v1'
   */
  function importApiKeys(apiKeysData) {
    if (!apiKeysData) return;
    
    // Guardar lista de keys
    if (apiKeysData.list !== undefined && Array.isArray(apiKeysData.list)) {
      localStorage.setItem('gw2_keys', JSON.stringify(apiKeysData.list));
      console.log(LOG, 'API Keys importadas:', apiKeysData.list.length);
    }
    
    // Guardar clave seleccionada
    if (apiKeysData.selected !== undefined && apiKeysData.selected !== null) {
      localStorage.setItem('gw2_selected_key_v1', apiKeysData.selected);
      console.log(LOG, 'Key seleccionada importada:', apiKeysData.selected);
    }
  }
  
  /**
   * Importa datos de Wizard's Vault
   */
  function importWVData(wvData) {
    if (!wvData) return;
    
    if (wvData.seasonIndex !== undefined && wvData.seasonIndex !== null) {
      localStorage.setItem('wv:season:index', JSON.stringify(wvData.seasonIndex));
    }
    
    if (wvData.seasons && typeof wvData.seasons === 'object') {
      for (var seasonId in wvData.seasons) {
        if (wvData.seasons.hasOwnProperty(seasonId)) {
          localStorage.setItem('wv:season:' + seasonId, JSON.stringify(wvData.seasons[seasonId]));
        }
      }
    }
  }
  
  /**
   * Importa datos de Wallet
   */
  function importWalletData(walletData) {
    if (!walletData) return;
    
    if (walletData.compact !== undefined) {
      localStorage.setItem('walletCompact', walletData.compact ? 'true' : 'false');
    }
    
    if (walletData.pins && typeof walletData.pins === 'object') {
      for (var keyId in walletData.pins) {
        if (walletData.pins.hasOwnProperty(keyId)) {
          localStorage.setItem('walletPins:' + keyId, JSON.stringify(walletData.pins[keyId]));
        }
      }
    }
    
    if (walletData.snapshots && typeof walletData.snapshots === 'object') {
      for (var snapshotKey in walletData.snapshots) {
        if (walletData.snapshots.hasOwnProperty(snapshotKey)) {
          localStorage.setItem('walletSnapshot:' + snapshotKey, JSON.stringify(walletData.snapshots[snapshotKey]));
        }
      }
    }
  }
  
  /**
   * Importa datos de Activities
   */
  function importActivitiesData(activitiesData) {
    if (!activitiesData) return;
    
    if (activitiesData.toggles !== undefined && activitiesData.toggles !== null) {
      localStorage.setItem('gn_activities_toggles', activitiesData.toggles);
    }
    
    if (activitiesData.homeNodesMarked !== undefined) {
      localStorage.setItem('gn_home_nodes_marked', JSON.stringify(activitiesData.homeNodesMarked));
    }
  }
  
  /**
   * Importa datos de Characters
   */
  function importCharactersData(charactersData) {
    if (!charactersData) return;
    
    if (charactersData.assignments && typeof charactersData.assignments === 'object') {
      for (var keyId in charactersData.assignments) {
        if (charactersData.assignments.hasOwnProperty(keyId)) {
          localStorage.setItem('characters:assignments:' + keyId, JSON.stringify(charactersData.assignments[keyId]));
        }
      }
    }
    
    if (charactersData.locationHistory && typeof charactersData.locationHistory === 'object') {
      for (var histKey in charactersData.locationHistory) {
        if (charactersData.locationHistory.hasOwnProperty(histKey)) {
          localStorage.setItem('characters:location_history:' + histKey, JSON.stringify(charactersData.locationHistory[histKey]));
        }
      }
    }
  }
  
  /**
   * Importa datos de Meta
   */
  function importMetaData(metaData) {
    if (!metaData) return;
    
    if (metaData.hechoHoy && typeof metaData.hechoHoy === 'object') {
      for (var keyId in metaData.hechoHoy) {
        if (metaData.hechoHoy.hasOwnProperty(keyId)) {
          localStorage.setItem('gn_meta_hecho_hoy:' + keyId, JSON.stringify(metaData.hechoHoy[keyId]));
        }
      }
    }
    
    if (metaData.favoritos && typeof metaData.favoritos === 'object') {
      for (var favKey in metaData.favoritos) {
        if (metaData.favoritos.hasOwnProperty(favKey)) {
          localStorage.setItem('gn_meta_favs:' + favKey, JSON.stringify(metaData.favoritos[favKey]));
        }
      }
    }
  }
  
  /**
   * Importa datos globales
   */
  function importGlobalData(globalData) {
    if (!globalData) return;
    
    if (globalData.welcomeSeen !== undefined) {
      localStorage.setItem('gn_welcome_seen', globalData.welcomeSeen ? 'true' : 'false');
    }
  }
  
  /**
   * Importa configuración desde un archivo JSON
   */
  function importFromFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var importData = JSON.parse(e.target.result);
          validateImportData(importData);
          
          // Aplicar importación
          importApiKeys(importData.data.apiKeys);
          importWVData(importData.data.wv);
          importWalletData(importData.data.wallet);
          importActivitiesData(importData.data.activities);
          importCharactersData(importData.data.characters);
          importMetaData(importData.data.meta);
          importGlobalData(importData.data.global);
          
          resolve(importData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function() {
        reject(new Error('Error al leer el archivo'));
      };
      reader.readAsText(file);
    });
  }
  
  /**
   * Importa desde un objeto JSON (para sincronización con GitHub Gist)
   */
  async function importFromData(importData) {
    try {
      validateImportData(importData);
      
      importApiKeys(importData.data.apiKeys);
      importWVData(importData.data.wv);
      importWalletData(importData.data.wallet);
      importActivitiesData(importData.data.activities);
      importCharactersData(importData.data.characters);
      importMetaData(importData.data.meta);
      importGlobalData(importData.data.global);
      
      console.log(LOG, 'Configuración importada desde datos');
      return { success: true };
    } catch (err) {
      console.error(LOG, 'Error importando desde datos:', err);
      throw err;
    }
  }
  
  /**
   * Importa con confirmación visual (desde archivo)
   */
  async function importAll() {
    return new Promise(function(resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) {
          reject(new Error('No se seleccionó ningún archivo'));
          return;
        }
        
        try {
          var importData = await importFromFile(file);
          
          var keyCount = importData.data.apiKeys?.list?.length || 0;
          var confirmMsg = '¿Restaurar configuración?\n\n' +
            'Se sobrescribirán:\n' +
            '• API Keys (' + keyCount + ' claves)\n' +
            '• Wizard\'s Vault (pins y marcas)\n' +
            '• Wallet (pins, snapshots, vista compacta)\n' +
            '• Activities (toggles, home nodes)\n' +
            '• Characters (POIs, ubicaciones)\n' +
            '• Meta (favoritos, hecho hoy)\n' +
            '• Configuración global\n\n' +
            'La página se recargará automáticamente.';
          
          if (confirm(confirmMsg)) {
            if (window.toast) {
              window.toast('success', 'Configuración importada. Recargando...', { ttl: 1500 });
            }
            setTimeout(function() {
              location.reload();
            }, 500);
            resolve(importData);
          } else {
            reject(new Error('Importación cancelada'));
          }
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }
  
  // =======================================================================
  // 3. INICIALIZACIÓN
  // =======================================================================
  
  function init() {
    console.info(LOG, 'Settings Manager v1.0.2 inicializado');
    
    // Buscar botones en el DOM (se ejecuta después de que index.html cargue)
    function bindButtons() {
      var exportBtn = document.getElementById('exportSettingsBtn');
      var importBtn = document.getElementById('importSettingsBtn');
      
      if (exportBtn && !exportBtn.__settingsWired) {
        exportBtn.__settingsWired = true;
        exportBtn.addEventListener('click', function(e) {
          e.preventDefault();
          exportAll();
        });
      }
      
      if (importBtn && !importBtn.__settingsWired) {
        importBtn.__settingsWired = true;
        importBtn.addEventListener('click', function(e) {
          e.preventDefault();
          importAll().catch(function(err) {
            console.error(LOG, err);
            if (window.toast) {
              window.toast('error', err.message || 'Error al importar', { ttl: 3000 });
            } else {
              alert('Error: ' + err.message);
            }
          });
        });
      }
    }
    
    // Intentar enganchar botones inmediatamente y después de cada render del DOM
    bindButtons();
    
    // Si hay MutationObserver disponible, observar cambios en el DOM
    if (window.MutationObserver) {
      var observer = new MutationObserver(function() {
        bindButtons();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
  // =======================================================================
  // 4. API PÚBLICA
  // =======================================================================
  
  var SettingsManager = {
    init: init,
    exportAll: exportAll,
    exportData: exportData,
    importAll: importAll,
    importFromFile: importFromFile,
    importFromData: importFromData,
    _debug: function() {
      return {
        version: EXPORT_VERSION,
        ready: true
      };
    }
  };
  
  root.SettingsManager = SettingsManager;
  
  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})(typeof window !== 'undefined' ? window : this);