/*!
 * js/gist-sync.js — Sincronización con GitHub Gist
 * v1.0.0 (2026-03-28)
 * 
 * Permite sincronizar la configuración de la app con un Gist privado en GitHub.
 * Requiere token personal de GitHub con permisos 'gist'.
 * El token se almacena cifrado en localStorage.
 */

(function(root) {
  'use strict';
  var LOG = '[GistSync]';
  
  // Configuración
  var CONFIG = {
    STORAGE_TOKEN_KEY: 'gh_token_encrypted',
    STORAGE_GIST_ID_KEY: 'gh_gist_id',
    GIST_FILENAME: 'gw2-config.json',
    GIST_DESCRIPTION: 'Bóveda del Gato Negro - Configuración sincronizada'
  };
  
  // Estado interno
  var state = {
    token: null,
    gistId: null,
    initialized: false
  };
  
  // =======================================================================
  // 1. CRIPTOGRAFÍA (para token)
  // =======================================================================
  
  /**
   * Cifra el token antes de guardarlo
   */
  function encryptToken(token, password) {
    // Usamos una contraseña fija + hash del token para cifrado simple
    // En producción se podría pedir una contraseña al usuario
    var fixedSalt = 'gw2-vault-sync-2026';
    var encrypted = CryptoJS.AES.encrypt(token, fixedSalt).toString();
    return encrypted;
  }
  
  /**
   * Descifra el token guardado
   */
  function decryptToken(encrypted) {
    var fixedSalt = 'gw2-vault-sync-2026';
    var decrypted = CryptoJS.AES.decrypt(encrypted, fixedSalt).toString(CryptoJS.enc.Utf8);
    return decrypted;
  }
  
  // =======================================================================
  // 2. GESTIÓN DE TOKEN
  // =======================================================================
  
  /**
   * Guarda el token cifrado en localStorage
   */
  function saveToken(token) {
    try {
      var encrypted = encryptToken(token);
      localStorage.setItem(CONFIG.STORAGE_TOKEN_KEY, encrypted);
      state.token = token;
      console.log(LOG, 'Token guardado correctamente');
      return true;
    } catch (e) {
      console.error(LOG, 'Error guardando token:', e);
      return false;
    }
  }
  
  /**
   * Recupera el token desde localStorage
   */
  function loadToken() {
    try {
      var encrypted = localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
      if (encrypted) {
        state.token = decryptToken(encrypted);
        return state.token;
      }
    } catch (e) {
      console.warn(LOG, 'Error cargando token:', e);
    }
    return null;
  }
  
  /**
   * Elimina el token guardado
   */
  function clearToken() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_TOKEN_KEY);
      localStorage.removeItem(CONFIG.STORAGE_GIST_ID_KEY);
      state.token = null;
      state.gistId = null;
      console.log(LOG, 'Token eliminado');
      return true;
    } catch (e) {
      console.error(LOG, 'Error eliminando token:', e);
      return false;
    }
  }
  
  // =======================================================================
  // 3. API DE GITHUB
  // =======================================================================
  
  /**
   * Headers para las peticiones a GitHub API
   */
  function getHeaders() {
    return {
      'Authorization': 'token ' + state.token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Verifica si el token es válido (haciendo una petición de prueba)
   */
  async function verifyToken() {
    if (!state.token) return false;
    
    try {
      var response = await fetch('https://api.github.com/user', {
        headers: getHeaders()
      });
      
      if (response.ok) {
        var user = await response.json();
        console.log(LOG, 'Token válido para usuario:', user.login);
        return true;
      }
    } catch (e) {
      console.warn(LOG, 'Error verificando token:', e);
    }
    return false;
  }
  
  /**
   * Crea un nuevo Gist para la configuración
   */
  async function createGist() {
    if (!state.token) {
      throw new Error('No hay token configurado');
    }
    
    var configData = await window.SettingsManager.exportData();
    var content = JSON.stringify(configData, null, 2);
    
    var body = {
      description: CONFIG.GIST_DESCRIPTION,
      public: false,
      files: {}
    };
    body.files[CONFIG.GIST_FILENAME] = { content: content };
    
    var response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      var error = await response.json();
      throw new Error(error.message || 'Error al crear Gist');
    }
    
    var gist = await response.json();
    state.gistId = gist.id;
    localStorage.setItem(CONFIG.STORAGE_GIST_ID_KEY, gist.id);
    
    console.log(LOG, 'Gist creado:', gist.id);
    return gist;
  }
  
  /**
   * Obtiene el Gist existente (por ID)
   */
  async function getGist(gistId) {
    if (!state.token) {
      throw new Error('No hay token configurado');
    }
    
    var response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // Gist no existe, limpiar ID guardado
        localStorage.removeItem(CONFIG.STORAGE_GIST_ID_KEY);
        state.gistId = null;
        throw new Error('El Gist ya no existe. Será creado nuevamente.');
      }
      var error = await response.json();
      throw new Error(error.message || 'Error al obtener Gist');
    }
    
    return await response.json();
  }
  
  /**
   * Actualiza el Gist existente
   */
  async function updateGist(gistId, content) {
    if (!state.token) {
      throw new Error('No hay token configurado');
    }
    
    var body = {
      files: {}
    };
    body.files[CONFIG.GIST_FILENAME] = { content: content };
    
    var response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      var error = await response.json();
      throw new Error(error.message || 'Error al actualizar Gist');
    }
    
    return await response.json();
  }
  
  // =======================================================================
  // 4. OPERACIONES PRINCIPALES
  // =======================================================================
  
  /**
   * Inicializa el módulo (carga token guardado)
   */
  function init() {
    var savedToken = loadToken();
    var savedGistId = localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
    
    if (savedToken) {
      state.token = savedToken;
      state.gistId = savedGistId;
      console.log(LOG, 'Módulo inicializado con token existente');
    } else {
      console.log(LOG, 'Módulo inicializado (sin token)');
    }
    state.initialized = true;
  }
  
  /**
   * Configura el token y opcionalmente crea un Gist
   */
  async function setupToken(token, createGistIfNeeded = true) {
    // Verificar token
    state.token = token;
    var isValid = await verifyToken();
    
    if (!isValid) {
      state.token = null;
      throw new Error('Token inválido. Verificá que tenga permisos "gist".');
    }
    
    // Guardar token
    saveToken(token);
    
    // Buscar o crear Gist
    if (createGistIfNeeded) {
      var existingGistId = localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
      
      if (existingGistId) {
        try {
          await getGist(existingGistId);
          state.gistId = existingGistId;
          console.log(LOG, 'Gist existente encontrado:', existingGistId);
        } catch (e) {
          console.warn(LOG, 'Gist existente no válido, creando nuevo');
          await createGist();
        }
      } else {
        await createGist();
      }
    }
    
    return { success: true, gistId: state.gistId };
  }
  
  /**
   * Sube la configuración actual al Gist
   */
  async function uploadConfig() {
    if (!state.token) {
      throw new Error('No hay token configurado. Configurá tu token primero.');
    }
    
    // Verificar que el Gist existe
    var gistId = state.gistId || localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
    if (!gistId) {
      // Crear nuevo Gist
      await createGist();
      gistId = state.gistId;
    } else {
      // Verificar que el Gist existe
      try {
        await getGist(gistId);
      } catch (e) {
        // Gist no existe, crear nuevo
        console.warn(LOG, 'Gist no encontrado, creando nuevo');
        await createGist();
        gistId = state.gistId;
      }
    }
    
    // Exportar configuración actual
    var configData = await window.SettingsManager.exportData();
    var content = JSON.stringify(configData, null, 2);
    
    // Actualizar Gist
    var updated = await updateGist(gistId, content);
    
    console.log(LOG, 'Configuración subida correctamente');
    return { success: true, gistId: gistId, updatedAt: updated.updated_at };
  }
  
  /**
   * Descarga la configuración desde el Gist y la aplica
   */
  async function downloadAndSync() {
    if (!state.token) {
      throw new Error('No hay token configurado. Configurá tu token primero.');
    }
    
    var gistId = state.gistId || localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
    if (!gistId) {
      throw new Error('No hay Gist configurado. Subí tu configuración primero.');
    }
    
    // Obtener Gist
    var gist = await getGist(gistId);
    var file = gist.files[CONFIG.GIST_FILENAME];
    
    if (!file) {
      throw new Error('El Gist no contiene el archivo de configuración');
    }
    
    // Descargar contenido
    var contentResponse = await fetch(file.raw_url);
    var configData = await contentResponse.json();
    
    // Importar configuración usando SettingsManager
    var confirmMsg = '¿Sincronizar desde la nube?\n\n' +
      'Se descargará y aplicará la configuración remota.\n' +
      'Esto sobrescribirá tu configuración local.\n\n' +
      '¿Continuar?';
    
    if (confirm(confirmMsg)) {
      await window.SettingsManager.importFromData(configData);
      if (window.toast) {
        window.toast('success', 'Configuración sincronizada correctamente', { ttl: 2000 });
      }
      setTimeout(function() {
        location.reload();
      }, 500);
    }
    
    return { success: true, updatedAt: gist.updated_at };
  }
  
  /**
   * Obtiene el estado actual de sincronización
   */
  async function getStatus() {
    var hasToken = !!state.token;
    var hasGistId = !!(state.gistId || localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY));
    var gistInfo = null;
    
    if (hasToken && hasGistId) {
      try {
        var gistId = state.gistId || localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
        var gist = await getGist(gistId);
        gistInfo = {
          id: gist.id,
          updatedAt: gist.updated_at,
          createdAt: gist.created_at
        };
      } catch (e) {
        gistInfo = { error: e.message };
      }
    }
    
    return {
      hasToken: hasToken,
      hasGist: hasGistId,
      gistInfo: gistInfo,
      tokenConfigured: hasToken
    };
  }
  
  /**
   * Elimina la configuración de sincronización (token y Gist)
   */
  function clearSync() {
    clearToken();
    return { success: true };
  }
  
  // =======================================================================
  // 5. API PÚBLICA
  // =======================================================================
  
  var GistSync = {
    init: init,
    setupToken: setupToken,
    uploadConfig: uploadConfig,
    downloadAndSync: downloadAndSync,
    getStatus: getStatus,
    clearSync: clearSync,
    verifyToken: verifyToken,
    _debug: function() {
      return {
        hasToken: !!state.token,
        hasGistId: !!state.gistId,
        initialized: state.initialized
      };
    }
  };
  
  root.GistSync = GistSync;
  
  // Auto-inicializar
  init();
  
})(typeof window !== 'undefined' ? window : this);