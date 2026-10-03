/*!
 * js/gist-sync.js — Sincronización con GitHub Gist
 * v1.1.0 (2026-09-26)
 * 
 * Permite sincronizar la configuración de la app con un Gist privado en GitHub.
 * Requiere token personal de GitHub con permisos 'gist'.
 * El token se almacena cifrado en localStorage con AES-GCM + PBKDF2.
 * 
 * 🔒 Seguridad: El token se cifra con una clave derivada del password del
 *    usuario + salt aleatorio (PBKDF2 200k iter). El token NO se descifra
 *    en init() — se requiere unlockToken(password) bajo demanda.
 *    Tokens con cifrado obsoleto (CryptoJS/fixedSalt) no son compatibles.
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
  // 1. CRIPTOGRAFÍA (para token) — Web Crypto API (built-in, no CDN)
  // =======================================================================
  
  var PBKDF2_ITERATIONS = 200000;
  
  /**
   * Genera un salt aleatorio de 16 bytes (hex string)
   */
  function generateSalt() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  
  /**
   * Convierte un ArrayBuffer a hex string
   */
  function buf2hex(buffer) {
    var bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  
  /**
   * Convierte un hex string a Uint8Array
   */
  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
  
  /**
   * Deriva una clave AES-GCM desde el password del usuario + salt aleatorio
   * usando PBKDF2 (200k iteraciones, SHA-256)
   */
  async function deriveKey(password, saltHex) {
    var enc = new TextEncoder();
    var saltBytes = hexToBytes(saltHex);
    var keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Cifra el token antes de guardarlo usando AES-GCM + PBKDF2
   * Formato almacenado: "salt:iv:data" (todo en hex)
   */
  async function encryptToken(token, password) {
    var salt = generateSalt();
    var key = await deriveKey(password, salt);
    var enc = new TextEncoder();
    var data = enc.encode(token);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, key, data
    );
    return salt + ':' + buf2hex(iv) + ':' + buf2hex(encrypted);
  }
  
  /**
   * Descifra el token guardado usando AES-GCM + PBKDF2
   * Formato esperado: "salt:iv:data" (todo en hex)
   * Tokens en formato antiguo (CryptoJS) lanzan error — deben re-ingresarse.
   */
  async function decryptToken(encryptedStr, password) {
    var parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      // Formato antiguo (CryptoJS con fixedSalt) — no se puede descifrar con seguridad
      throw new Error('Token con cifrado obsoleto. Por favor, reingresá el token.');
    }
    var salt = parts[0];
    var iv = hexToBytes(parts[1]);
    var encrypted = hexToBytes(parts[2]);
    var key = await deriveKey(password, salt);
    var decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv }, key, encrypted
    );
    return new TextDecoder().decode(decrypted);
  }
  
  // =======================================================================
  // 2. GESTIÓN DE TOKEN
  // =======================================================================
  
  /**
   * Guarda el token cifrado en localStorage (requiere password del usuario)
   */
  async function saveToken(token, password) {
    try {
      var encrypted = await encryptToken(token, password);
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
   * Recupera el token desde localStorage (requiere password del usuario)
   */
  async function loadToken(password) {
    try {
      var encrypted = localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
      if (encrypted) {
        state.token = await decryptToken(encrypted, password);
        return state.token;
      }
    } catch (e) {
      console.warn(LOG, 'Error cargando token:', e);
      throw e;
    }
    return null;
  }
  
  /**
   * Desbloquea el token almacenado usando el password del usuario
   * (token se descifra bajo demanda, NO en init())
   */
  async function unlockToken(password) {
    var encrypted = localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
    if (!encrypted) {
      throw new Error('No hay token guardado');
    }
    var token = await decryptToken(encrypted, password);
    state.token = token;
    return true;
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
   * Inicializa el módulo (carga gistId, NO decrypta token — se hace bajo demanda)
   */
  function init() {
    var savedGistId = localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY);
    var hasEncrypted = !!localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
    
    if (hasEncrypted) {
      state.gistId = savedGistId;
      console.log(LOG, 'Módulo inicializado (token en espera de desbloqueo)');
    } else if (savedGistId) {
      state.gistId = savedGistId;
      console.log(LOG, 'Módulo inicializado (sin token)');
    } else {
      console.log(LOG, 'Módulo inicializado (limpio)');
    }
    state.initialized = true;
  }
  
  /**
   * Configura el token y opcionalmente crea un Gist (requiere password)
   */
  async function setupToken(token, password, createGistIfNeeded = true) {
    // Verificar token
    state.token = token;
    var isValid = await verifyToken();
    
    if (!isValid) {
      state.token = null;
      throw new Error('Token inválido. Verificá que tenga permisos "gist".');
    }
    
    // Guardar token cifrado (con password del usuario)
    await saveToken(token, password);
    
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

    // HB#135 T20-b: queda acordada la INSTANTE de esta subida. Sin esto, el
    // confirm de la descarga tendria que comparar el remoto contra el remoto y
    // no podria decir nunca si el remoto tiene lo ultimo (el `exportedAt` del
    // JSON lo genera `exportData()` en este mismo comando, o sea el remoto es
    // SIEMPRE mas nuevo que el). Esto es lo que hace la comparacion real.
    try {
      var lastUploadKey = (root.Storage && root.Storage.STORAGE_KEYS && root.Storage.STORAGE_KEYS.GIST_LAST_UPLOAD) || 'gn:github:last_upload';
      var stamped = updated && updated.updated_at ? updated.updated_at : new Date().toISOString();
      if (root.Storage && typeof root.Storage.set === 'function') root.Storage.set(lastUploadKey, stamped);
      else root.localStorage.setItem(lastUploadKey, stamped);
    } catch (_) { /* sin referencia no hay direccion, y la descarga lo dice */ }

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
    
    // Descargar contenido (FORZANDO RECARGA PARA EVITAR CACHÉ)
    var contentResponse = await fetch(file.raw_url + '?t=' + Date.now());
    
    // CORRECCIÓN PARA EDGE/FIREFOX: Guardamos el texto crudo y lo parseamos ANTES de pasarlo
    var rawText = await contentResponse.text();
    var configData = JSON.parse(rawText);
    
    // Importar configuración usando SettingsManager
    // HB#119 T20-a: el confirm del Gist tiene que decir lo mismo que el del
    // archivo. Antes decia "Esto sobrescribira tu configuracion local" y nada
    // mas: 0 de las 7 familias, 0 cifras. Lo unico del backup que NO se
    // regenera con un click son las API keys -- una key de GW2 no se vuelve a
    // bajar de ArenaNet; si no la guardaste, hay que crear otra. El precedente
    // es literal y esta 60 lineas mas arriba, en settings-manager.js:594-603.
    // HB#120 T20-c: la foto sale ANTES del confirm, no despues. Sin esto,
    // confirmar es un acto irreversible y el unico backup es el remoto, que es
    // justamente lo que se esta a punto de sobrescribir. Si el remoto esta
    // viejo, no queda nada. El camino del archivo ya resolvio el otro problema
    // del mismo par ("aplicar antes de preguntar", HB#104); este es el hermano
    // que faltaba: "no hay de donde volver".
    //
    // CANCELAR NO DEJA RASTRO: se guarda el valor previo y se vuelve a poner si
    // Pablo dice que no. Escribir la foto y dejarla ahi seria cambiar el
    // almacenamiento por haber mirado un cartel.
    var snapshotKey = (window.Storage && window.Storage.STORAGE_KEYS &&
                       window.Storage.STORAGE_KEYS.GIST_SAFETY_SNAPSHOT) || 'gn:github:gist_snapshot';
    var prevSnapshot = null;
    try { prevSnapshot = localStorage.getItem(snapshotKey); } catch (_) { prevSnapshot = null; }

    var snap = { ok: false, reason: 'no se pudo guardar' };
    if (window.SettingsManager && typeof window.SettingsManager.createSafetySnapshot === 'function') {
      snap = await window.SettingsManager.createSafetySnapshot();
    }

    var keyCount = configData?.data?.apiKeys?.list?.length || 0;

    // HB#135 T20-b — LA DIRECCION. T20-a ya decia CUANTAS claves trae el
    // remoto, pero no si son LAS MIAS o las 15 que me faltan: "12 claves" es
    // la misma frase para un backup al dia y para uno de la semana pasada. El
    // propio PO lo escribio asi: "sin esto, T20-a le muestra 12 claves a Pablo
    // y aun asi no puede saber si son sus 12 o las 15 que le faltan".
    //
    // LA PREMISA QUE YO PRIMERO ESCRIBE ERA FALSA, y la midio el arnés de este
    // commit al EJECUTAR el fragmento, no al leerlo: la idea era comparar
    // `gist.updated_at` contra `configData.exportedAt`, los dos "del remoto".
    // Pero `uploadConfig` arma el JSON con `exportData()` — quepone
    // `exportedAt = new Date()` (:208) — y lo subeActo seguido. O sea
    // `updated_at` es SIEMPOSTras `exportedAt` por el tiempo de la red, y la
    // rama "viejo" no podria dispararse NUNCA. Un confirm con la direccion
    // siempre en "al dia" es peor que no tener direccion: le dice a Pablo que
    // no va a perder nada, siempre.
    //
    // LA REFERENCIA QUE SÍ SIRVE es local y hay que crearla: cuando subi yo por
    // ultima vez. Todo cambio local posterior a ese instante es lo que se
    // pierde al sincronizar, y eso es lo unico que la palabra "viejo" quiere
    // decir. `gn:github:last_upload` va en el namespace `github:` para que
    // `KNOWN_NAMESPACES` lo traiga de vuelta en un restore (mismo criterio que
    // `gn:github:gist_snapshot` en T20-c).
    //
    // Y SI NO HAY REFERENCIA no se inventa una direccion: se dice que no se pudo
    // leer. Un "no se" honesto le sirve; un "el remoto esta al dia" con la
    // comparacion rota lo hace confirmar un backup viejo creyendo que no.
    var remotoTs = Date.parse(gist.updated_at || '');
    var ultimaSubidaTs = Date.parse(
      (root.Storage && root.Storage.get(root.Storage.STORAGE_KEYS.GIST_LAST_UPLOAD))
      || 'gn:github:last_upload' || '');
    var direccion = null;   // 'viejo' | 'al-dia' | null (no se pudo leer)
    if (!isNaN(remotoTs) && !isNaN(ultimaSubidaTs)) {
      direccion = remotoTs > ultimaSubidaTs ? 'al-dia' : 'viejo';
    }
    var lineaDireccion =
      direccion === 'viejo'
        ? 'ATENCIÓN: el remoto es más viejo que tu última subida.\n' +
          'Si confirmás, vas a perder los cambios que hiciste desde entonces.\n\n'
        : direccion === 'al-dia'
          ? 'El remoto tiene lo último que subiste.\n\n'
          : '';

    var confirmMsg = '¿Sincronizar desde la nube?\n\n' +
      'Se descargará y aplicará la configuración remota.\n' +
      lineaDireccion +
      'Esto SOBRESCRIBE tu configuración local:\n\n' +
      '• API Keys (' + keyCount + ' claves)\n' +
      '• Wizard\'s Vault (pins y marcas)\n' +
      '• Wallet (pins, snapshots, vista compacta)\n' +
      '• Activities (toggles, home nodes)\n' +
      '• Characters (POIs, ubicaciones)\n' +
      '• Meta (favoritos, hecho hoy)\n' +
      '• Configuración global\n\n' +
      // El mensaje dice la verdad en los DOS sentidos: si la foto esta, se dice
      // que se puede volver; si NO esta (cuota llena, almacenamiento
      // bloqueado), se dice que no se puede. "Se guardo una copia" sin haberla
      // guardado seria peor que no decir nada.
      //
      // Y NO promete una pantalla que no existe: `GistSync` todavia no esta
      // montado en ningun HTML (medido, `git grep GistSync` = 3 matches, los 3
      // dentro del propio gist-sync.js). Decir "restaurar desde Ajustes" seria
      // mandarlo a una pantalla inexistente. El destino real es el
      // `SettingsManager.restoreSafetySnapshot()` que queda expuesto para
      // cuando ese boton se monte.
      (snap.ok
        ? 'Antes se guardó una copia de tu configuración actual.\n' +
          'Si algo sale mal, se puede restaurar con\n' +
          'SettingsManager.restoreSafetySnapshot().\n\n'
        : 'ATENCIÓN: no se pudo guardar una copia de tu configuración actual\n' +
          '(' + snap.reason + '). Si esto sale mal, no vas a poder volver atrás.\n\n') +
      '¿Continuar?';

    if (confirm(confirmMsg)) {
      await window.SettingsManager.importFromData(configData);
      if (window.toast) {
        window.toast('success', 'Configuración sincronizada correctamente', { ttl: 2000 });
      }
      setTimeout(function() {
        location.reload();
      }, 500);
    } else {
      // Cancelar no deja rastro: se devuelve el almacenamiento al estado previo.
      // Mirar un cartel no es una accion que deba cambiar nada en disco.
      try {
        if (prevSnapshot === null) localStorage.removeItem(snapshotKey);
        else localStorage.setItem(snapshotKey, prevSnapshot);
      } catch (_) { /* sin foto no hay nada que deshacer */ }
      return { success: false, cancelled: true, updatedAt: gist.updated_at };
    }
    
    return { success: true, updatedAt: gist.updated_at };
  }
  
  /**
   * Obtiene el estado actual de sincronización
   */
  async function getStatus() {
    var hasToken = !!state.token;
    var hasEncrypted = !!localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
    var hasGistId = !!(state.gistId || localStorage.getItem(CONFIG.STORAGE_GIST_ID_KEY));
    var needsUnlock = hasEncrypted && !hasToken;
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
      hasEncryptedToken: hasEncrypted,
      needsUnlock: needsUnlock,
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
    unlockToken: unlockToken,
    uploadConfig: uploadConfig,
    downloadAndSync: downloadAndSync,
    getStatus: getStatus,
    clearSync: clearSync,
    verifyToken: verifyToken,
    _debug: function() {
      return {
        hasToken: !!state.token,
        hasEncryptedToken: !!localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY),
        hasGistId: !!state.gistId,
        needsUnlock: !!localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY) && !state.token,
        initialized: state.initialized
      };
    }
  };
  
  root.GistSync = GistSync;
  
  // Auto-inicializar
  init();
  
})(typeof window !== 'undefined' ? window : this);