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
 * v1.0.4: El `confirm()` del botón deja de ENUMERAR qué conserva y pasa a
 *   decir los BYTES que quedan (`keptBytes` de `__cacheClear`). Motivo medido:
 *   el `kept` incluye 8 familias de clave de cache de otros módulos que no
 *   están en el registro, así que el número arrastraba cache mientras la frase
 *   al lado la negaba; y una enumeración de categorías deja de ser cierta en
 *   el mismo commit en que un módulo registra su clave. El conteo de bytes
 *   sobrevive a eso. Test: tests/idea50-boton-cache.test.js, sección 4c (11
 *   aserciones; 7 FAIL contra el archivo sin el fix).
 * v1.0.3: Botón "Limpiar caché" de la barra de utilities (Idea 50, Tramo siguiente a F y P3).
 *          Llama a `GW2Api.__cacheClear` con dryRun -> confirm -> borrado real.
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
   * Nota: Las claves se almacenan via Storage API (STORAGE_KEYS.ACCOUNT_KEYS / ACCOUNT_SELECTED)
   */
  function exportApiKeys() {
    try {
      var keys = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_KEYS) || [];
      var selected = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_SELECTED);
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
        seasonIndex = Storage.get(Storage.STORAGE_KEYS.WV_SEASON_INDEX);
      } catch(e) {}
      
      // Recopilar todas las temporadas existentes
      var seasons = {};
      var seasonKeys = Storage.list('gn:wv:season:');
      seasonKeys.forEach(function (sKey) { var sid = sKey.replace('gn:wv:season:', ''); var sData = Storage.get(sKey); if (sData !== null) seasons[sid] = sData; });
      
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
      var compact = Storage.get(Storage.STORAGE_KEYS.WALLET_COMPACT) === true;
      
      // Recopilar pins por API key
      var pins = {};
      var snapshots = {};
      
      Storage.list('gn:wallet:pins:').forEach(function (pKey) { var keyId = pKey.replace('gn:wallet:pins:', ''); pins[keyId] = Storage.get(pKey); });
      Storage.list('gn:wallet:snapshots:').forEach(function (sKey) { var snapshotKey = sKey.replace('gn:wallet:snapshots:', ''); snapshots[snapshotKey] = Storage.get(sKey); });
      
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
      var toggles = Storage.get(Storage.STORAGE_KEYS.ACTIVITIES_TOGGLES);
      var homeNodesMarked = {};
      try {
        homeNodesMarked = Storage.get(Storage.STORAGE_KEYS.ACTIVITIES_HOME_NODES) || {};
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
      
      Storage.list('gn:characters:assignments:').forEach(function (aKey) { var keyId = aKey.replace('gn:characters:assignments:', ''); assignments[keyId] = Storage.get(aKey); });
      Storage.list('gn:characters:location_history:').forEach(function (hKey) { var histKey = hKey.replace('gn:characters:location_history:', ''); locationHistory[histKey] = Storage.get(hKey); });
      
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
      
      Storage.list('gn:meta:hecho_hoy:').forEach(function (hKey) { var keyId = hKey.replace('gn:meta:hecho_hoy:', ''); hechoHoy[keyId] = Storage.get(hKey); });
      Storage.list('gn:meta:favs:').forEach(function (fKey) { var favKey = fKey.replace('gn:meta:favs:', ''); favoritos[favKey] = Storage.get(fKey); });
      
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
      var welcomeSeen = Storage.get(Storage.STORAGE_KEYS.GLOBAL_WELCOME_SEEN) === true;
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
    if (typeof Analytics !== 'undefined') Analytics.exportBackup();
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
   * HB#120 T20-c. Saca una foto de la configuración ACTUAL antes de que algo la
   * sobrescriba. Devuelve un veredicto, no un bool, porque el llamador tiene que
   * poder decirle a Pablo la verdad: si la foto no se pudo guardar (cuota de
   * localStorage llena, modo privado que no persiste), el confirm tiene que
   * decir que NO hay red. Decir "se guardó una copia" sin haberla guardado es
   * peor que no decir nada: Pablo confirmaría pensando que puede volver atrás.
   */
  async function createSafetySnapshot() {
    try {
      var data = exportData();
      var key = (root.Storage && root.Storage.STORAGE_KEYS && root.Storage.STORAGE_KEYS.GIST_SAFETY_SNAPSHOT)
        || 'gn:github:gist_snapshot';
      var prev = root.Storage ? root.Storage.get(key) : null;
      root.localStorage.setItem(key, JSON.stringify({ takenAt: new Date().toISOString(), data: data }));
      return { ok: true, takenAt: data.exportedAt, hadPrevious: !!prev };
    } catch (err) {
      // Cuota llena o almacenamiento bloqueado. NO es un caso que "no debería
      // pasar": pasa con 27 cuentas y muchos snapshots de wallet.
      return { ok: false, reason: (err && err.name === 'QuotaExceededError')
        ? 'almacenamiento lleno' : 'no se pudo guardar' };
    }
  }

  /**
   * Devuelve la foto sin aplicarla. `null` si no hay.
   */
  function getSafetySnapshot() {
    try {
      var key = (root.Storage && root.Storage.STORAGE_KEYS && root.Storage.STORAGE_KEYS.GIST_SAFETY_SNAPSHOT)
        || 'gn:github:gist_snapshot';
      var raw = root.Storage ? root.Storage.get(key) : null;
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      return null;
    }
  }

  /**
   * Restaura la foto. Pide confirmación y usa `applyImportData`, o sea el
   * MISMO camino que un restore de archivo. Sin confirmación sería el peor bug
   * posible: el clic que devuelve las cosas a como estaban sería el que las
   * rompe.
   */
  async function restoreSafetySnapshot() {
    var snap = getSafetySnapshot();
    if (!snap || !snap.data) {
      return { ok: false, reason: 'no hay copia guardada' };
    }
    var n = ((snap.data.data && snap.data.data.apiKeys &&
              snap.data.data.apiKeys.list) || []).length;
    var when = snap.takenAt ? new Date(snap.takenAt).toLocaleString('es-AR') : 'una fecha desconocida';
    var msg = '¿Restaurar la copia de seguridad?\n\n' +
      'Se tomó el ' + when + '.\n' +
      '• API Keys (' + n + ' claves)\n' +
      '• El resto de la configuración\n\n' +
      'Esto también sobrescribe tu configuración actual.\n\n' +
      '¿Continuar?';
    if (!confirm(msg)) return { ok: false, cancelled: true };
    applyImportData(snap.data);
    return { ok: true, takenAt: snap.takenAt };
  }

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
   * Nota: Las claves se almacenan via Storage API (STORAGE_KEYS.ACCOUNT_KEYS / ACCOUNT_SELECTED)
   */
  function importApiKeys(apiKeysData) {
    if (!apiKeysData) return;
    
    // Guardar lista de keys
    if (apiKeysData.list !== undefined && Array.isArray(apiKeysData.list)) {
      // -- Commit 2 de 2 de la puerta de permisos (HB#91, HB#105) ------------
      // Esta funcion era la PUERTA DE ATRAS: escribia ACCOUNT_KEYS con
      // Storage.set a pelo, sin pasar por KeyManager, y por lo tanto SIN la
      // validacion de permisos que vive en addOrUpdate (app.js:872). Un backup
      // con una key de 2 permisos entraba sin error y sin mensaje, y quedaba
      // guardada con 5 de menos: ese es el bug original.
      //
      // Decision de DISENO del Reviewer (veredicto fila 111, HB#102) que
      // DESMONTO la premisa de "mover la puerta al punto de persistencia": la
      // comprobacion NO es un predicado sobre los datos. addOrUpdate hace
      // `await API.tokenInfo(...)` y consume `info.permissions`, que solo
      // existe tras una llamada de RED. En el punto de escritura no hay
      // `perms` que mirar. Por eso aca no se revalida contra la API.
      //
      // Lo que se valida es la copia PERSISTIDA (`key.perms`, que el commit 1
      // de 2 escribio desde /v2/tokeninfo). Es offline y determinista: el mismo
      // backup da el mismo veredicto sin red. Y `API.json` usa `fetch` CRUDO
      // (app.js:64, no `jfetch`), sin pool ni dedup: revalidar 27 keys por
      // import serian 27 requests sin pool, que es el riesgo que la puerta evita.
      //
      // Regla de compatibilidad, escrita porque es la que decide el caso comun:
      // `perms` AUSENTE = DESCONOCIDO, no malo. Las keys ya guardadas y los
      // backups anteriores al commit 1 no lo tienen; rechazarlas seria decirle a
      // Pablo que sus cuentas desaparecieron.
      //
      // Y NO es la misma lista que hay en disco: el import es REPLACE (trae
      // `list`, no un delta), asi que `save(() => lista)` descarta `fresh`
      // A PROPOSITO. Que no merge no es una omision: si una cuenta que no esta
      // en el backup sobreviviera, el restore no seria un restore. Es la misma
      // semantica que tenia el `Storage.set` de antes, que tambien sobreescribia
      // entera.
      var entrada = apiKeysData.list;
      // Se resuelve UNA vez y con guarda. Leer `KeyManager.REQUIRED_PERMISSIONS`
      // sin comprobar que existe tira TypeError y deja la rama de degradacion
      // como codigo muerto: el camino para el que estaba escrita no se podia
      // recorrer. Sin esta linea, "KeyManager ausente" no degrada, revienta.
      var KM = (typeof window !== 'undefined' && window.KeyManager) ? window.KeyManager
             : (typeof KeyManager !== 'undefined' ? KeyManager : null);
      var REQ = (KM && Array.isArray(KM.REQUIRED_PERMISSIONS)) ? KM.REQUIRED_PERMISSIONS : null;
      var sinPerms = 0;
      var incompletas = [];
      if (REQ) {
        for (var i = 0; i < entrada.length; i++) {
          var k = entrada[i];
          if (!k || !Array.isArray(k.perms)) { sinPerms++; continue; }
          var tiene = {};
          for (var j = 0; j < k.perms.length; j++) tiene[k.perms[j]] = true;
          var faltan = [];
          for (var s2 = 0; s2 < REQ.length; s2++) {
            var req = REQ[s2].scope;
            if (!tiene[req]) faltan.push(req);
          }
          if (faltan.length) incompletas.push((k.label || k.value || 'key') + ' -> ' + faltan.join(', '));
        }
      } else {
        for (var i2 = 0; i2 < entrada.length; i2++) {
          if (!entrada[i2] || !Array.isArray(entrada[i2].perms)) sinPerms++;
        }
      }
      if (incompletas.length) {
        // NO se lanza y NO se aborta el import: Pablo ya confirmo, y perder
        // todo el restore por una key es peor que perder una key. Se importa y
        // se dice, que es justo lo que faltaba (el dano era silencioso).
        console.warn(LOG, 'API Keys importadas con permisos INCOMPLETOS (' +
          incompletas.length + ' de ' + entrada.length + '). La app usa ' +
          REQ.length +
          ' permisos; estas keys van a degradar a datos vacios (HTTP 403): ' +
          incompletas.join(' | '));
      }
      if (sinPerms) {
        console.warn(LOG, sinPerms + ' key(s) importadas sin `perms`: se tratan como' +
          ' DESCONOCIDAS y NO se rechazan. Suelen ser backups anteriores a v6.6.4.');
      }
      if (KM && typeof KM.save === 'function') {
        KM.save(function() { return entrada; });
      } else {
        // KeyManager ausente: se degrada al comportamiento anterior en vez de
        // perder el restore entero. Es el unico camino que pierde la puerta, y
        // por eso el censo de escritura lo cuenta (tests/hb111-*.test.js).
        Storage.set(Storage.STORAGE_KEYS.ACCOUNT_KEYS, entrada);
        console.warn(LOG, 'KeyManager ausente: import SIN pasar por save() (puerta NO aplicada).');
      }
      console.log(LOG, 'API Keys importadas:', entrada.length);
    }
    
    // Guardar clave seleccionada
    if (apiKeysData.selected !== undefined && apiKeysData.selected !== null) {
      Storage.set(Storage.STORAGE_KEYS.ACCOUNT_SELECTED, apiKeysData.selected);
      console.log(LOG, 'Key seleccionada importada:', apiKeysData.selected);
    }
  }
  
  /**
   * Importa datos de Wizard's Vault
   */
  function importWVData(wvData) {
    if (!wvData) return;
    
    if (wvData.seasonIndex !== undefined && wvData.seasonIndex !== null) {
      Storage.set(Storage.STORAGE_KEYS.WV_SEASON_INDEX, wvData.seasonIndex);
    }
    
    if (wvData.seasons && typeof wvData.seasons === 'object') {
      for (var seasonId in wvData.seasons) {
        if (wvData.seasons.hasOwnProperty(seasonId)) {
          Storage.set('gn:wv:season:' + seasonId, wvData.seasons[seasonId]);
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
      Storage.set(Storage.STORAGE_KEYS.WALLET_COMPACT, walletData.compact);
    }
    
    if (walletData.pins && typeof walletData.pins === 'object') {
      for (var keyId in walletData.pins) {
        if (walletData.pins.hasOwnProperty(keyId)) {
          Storage.set('gn:wallet:pins:' + keyId, walletData.pins[keyId]);
        }
      }
    }
    
    if (walletData.snapshots && typeof walletData.snapshots === 'object') {
      for (var snapshotKey in walletData.snapshots) {
        if (walletData.snapshots.hasOwnProperty(snapshotKey)) {
          Storage.set('gn:wallet:snapshots:' + snapshotKey, walletData.snapshots[snapshotKey]);
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
      Storage.set(Storage.STORAGE_KEYS.ACTIVITIES_TOGGLES, activitiesData.toggles);
    }
    
    if (activitiesData.homeNodesMarked !== undefined) {
      Storage.set(Storage.STORAGE_KEYS.ACTIVITIES_HOME_NODES, activitiesData.homeNodesMarked);
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
          Storage.set('gn:characters:assignments:' + keyId, charactersData.assignments[keyId]);
        }
      }
    }
    
    if (charactersData.locationHistory && typeof charactersData.locationHistory === 'object') {
      for (var histKey in charactersData.locationHistory) {
        if (charactersData.locationHistory.hasOwnProperty(histKey)) {
          Storage.set('gn:characters:location_history:' + histKey, charactersData.locationHistory[histKey]);
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
          Storage.set('gn:meta:hecho_hoy:' + keyId, metaData.hechoHoy[keyId]);
        }
      }
    }
    
    if (metaData.favoritos && typeof metaData.favoritos === 'object') {
      for (var favKey in metaData.favoritos) {
        if (metaData.favoritos.hasOwnProperty(favKey)) {
          Storage.set('gn:meta:favs:' + favKey, metaData.favoritos[favKey]);
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
      Storage.set(Storage.STORAGE_KEYS.GLOBAL_WELCOME_SEEN, globalData.welcomeSeen);
    }
  }
  
  /**
   * Aplica un import YA validado: las 7 escrituras.
   *
   * HB#104. Es un arreglo de INTEGRIDAD DE DATOS, no un refactor: antes esta
   * lista vivia dentro de importFromFile, que hace DOS cosas a la vez (leer el
   * archivo y escribir). importAll la llamaba en :463 y el confirm estaba en
   * :477, o sea DESPUES de las 7 escrituras. Consecuencia medida: si Pablo
   * cancela el confirm, importAll hace reject('Importacion cancelada') y la
   * pagina dice que no se importo nada, pero ACCOUNT_KEYS, ACCOUNT_SELECTED,
   * WV, wallet, activities, characters, meta y global YA estan sobreescritos en
   * localStorage. Cancelar era indistinguible de aceptar, y el backup anterior
   * ya no existia.
   *
   * Por que el camino del Gist no lo tenia: gist-sync.js:451 confirma y :452
   * importa, o sea el ahi siempre fue correcto. Solo el de archivo estaba
   * invertido, y por eso es un descuido y no una decision.
   *
   * La solucion NO es "mover el confirm": importFromFile es API publica
   * (SettingsManager.importFromFile, :644) y hay call sites que la usan como
   * "leer y aplicar de una". Mover el confirm adentro le cambiaria el contrato.
   * La solucion es partir la RESPONSABILIDAD: readImportFile lee y valida SIN
   * escribir, y esta aplica. Quien quiera preguntar, pregunta en el medio.
   */
  function applyImportData(importData) {
    importApiKeys(importData.data.apiKeys);
    importWVData(importData.data.wv);
    importWalletData(importData.data.wallet);
    importActivitiesData(importData.data.activities);
    importCharactersData(importData.data.characters);
    importMetaData(importData.data.meta);
    importGlobalData(importData.data.global);
  }

  /**
   * Importa configuracion desde un archivo JSON (lee, valida y APLICA).
   *
   * Se mantiene igual que antes, a proposito: es API publica y hay call sites que
   * la usan como "leer y aplicar de una" (ver la nota de applyImportData). La
   * separacion la agrega readImportFile para el caso que necesita preguntar.
   */
  function importFromFile(file) {
    return readImportFile(file).then(function(importData) {
      applyImportData(importData);
      return importData;
    });
  }

  /**
   * Lee y valida un archivo de backup SIN escribir nada.
   *
   * Es la mitad de importFromFile que no tiene efectos: parsea, valida con
   * validateImportData y devuelve el objeto. Quien la llama decide si despues
   * aplica, y esa decision es la que se puede preguntar antes de tocar disco.
   */
  function readImportFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var importData = JSON.parse(e.target.result);
          validateImportData(importData);
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
      // FIX PARA FIREFOX: Si el dato llegó como string, lo convertimos a objeto real antes de validar
      if (typeof importData === 'string') {
        try {
          importData = JSON.parse(importData);
        } catch (e) {
          console.warn('[SettingsManager] No se pudo parsear el string recibido:', e);
        }
      }

      validateImportData(importData);

      // ALERT-179: las 7 escrituras vivian DUPLICADAS acá y en
      // `applyImportData`, identicas linea por linea y en el mismo orden
      // (medido: `tools/hb123-alert179.test.js`, 14/0, con control negativo).
      // Delegar NO cambia el contrato de esta funcion publica porque lo que
      // la hace distinta de `applyImportData` -- parsear un string, validar,
      // y devolver `{ success: true }` -- queda TODO adelante y despues.
      // El orden importa y es lo unico fragile: parsear y validar van PRIMERO
      // a proposito. Delegar antes de validar escribiria datos sin preguntar.
      applyImportData(importData);

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
      if (typeof Analytics !== 'undefined') Analytics.importBackup();
      
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
          // HB#104: LEER, no aplicar. Antes esta linea llamaba a
          // importFromFile, que ademas de leer escribia las 7 familias, y el
          // confirm estaba DOS LINEAS ABAJO: cancelar dejaba los datos
          // sobreescritos y la pagina decia que no se habia importado nada.
          // Ahora el archivo se lee y se valida aqui, se pregunta, y las
          // escrituras pasanrecien si la respuesta es si (ver applyImportData).
          var importData = await readImportFile(file);
          
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
            // Las escrituras van aca y no antes: es el unico punto del flujo
            // donde ya se sabe que Pablo quiere el restore. Sin esta linea el
            // confirm seria decorativo.
            applyImportData(importData);
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
  // 2b. LIBERAR LA CACHÉ DE LA API  (Idea 50, Tramo siguiente a F y P3)
  // =======================================================================
  //
  // Por que vive acá y no en `api-gw2.js`: el borrado YA existe y ya esta
  // probado (`GW2Api.__cacheClear`, ver `tests/idea50f.cacheclear-real.test.js`).
  // Lo que faltaba era el BOTON, y el boton es UI. Este modulo ya es el dueño de
  // los botones de la barra de utilities (Backup / Restaurar), ya tiene el
  // `confirm()` de accion destructiva y el `toast` de resultado, y ya tiene el
  // guard `__settingsWired` que evita el doble binding. Agregar un modulo
  // propio seria un `<script>` mas y un segundo lugar con el mismo patron.
  //
  // El flujo es dryRun -> confirm -> borrado real, y el orden NO es estetico:
  //   1. `__cacheClear({dryRun:true})` NO borra nada y dice cuantas claves y
  //      cuantos bytes se liberarian. Es lo unico que permite que el `confirm()`
  //      sea una PREGUNTA y no una DCHECK.
  //   2. Si `removed` es 0 no se pregunta: un confirm que anuncia "0 claves" es
  //      una mentira, y el peor caso de un boton destructivo es el que pide
  //      permiso para no hacer nada.
  //   3. Recien ahi se borra de verdad.
  //
  // Lo que NO hace, a proposito: `location.reload()`. `__cacheClear` tambien
  // vacia la cache de sesion de ESTA capa (`__mem`), asi que la siguiente
  // lectura sale de la red sola. Recargar es un cambio de comportamiento mas
  // grande (tira el estado de la vista) y no hace falta para que el boton
  // cumpla: queda planteada para el Reviewer, no resuelta por mi.
  //
  // Y lo que el copy NO promete, que es lo mismo pero del lado de los otros
  // modulos: `wizards-vault.js:40-41` tiene SU PROPIA `__mem`/`__inflight`, y
  // `cacheClear` no la alcanza. O sea que tras este boton el WV sigue
  // sirviendo desde memoria hasta que se recargue la pagina. Es una limitacion
  // CONOCIDA y Dicha, no una sorpresa: el Reviewer la senalo (nota al pie de
  // la fila 073) y el hook que la arregla (`onClear` o `__cacheClearMem()`) es
  // el tramo siguiente, no este. Un copy que dijera "todo se vuelve a
  // descargar" seria falso para el modulo mas pesado con MB en disco.
  function fmtBytes(n) {
    if (!n || n < 0) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function clearApiCache() {
    var api = window.GW2Api;
    if (!api || typeof api.__cacheClear !== 'function') {
      if (window.toast) window.toast('error', 'La capa de API no está disponible', { ttl: 3000 });
      return;
    }
    // 1. La pregunta primero. En `dryRun` no se toca ni disco ni sesion.
    var dry = api.__cacheClear({ dryRun: true });
    if (!dry || !dry.removed) {
      if (window.toast) window.toast('warning', 'No hay caché de la API para liberar', { ttl: 2500 });
      return;
    }
    // La PREGUNTA nombra el mismo alcance que el `title` del boton
    // (`index.html:289`): API **y WV**. El registro de la P3 son las 18 bases de
    // la capa API MAS las 5 de `wizards-vault.js:615-618`, asi que decir "de la
    // API" y borrar el WV es el mismo delta sin declarar que H1, en el unico
    // texto que Pablo lee antes de confirmar. La ultima linea ya nombraba el WV
    // (por su `__mem`), y esa mencion podia leerse como "el WV no se toca": lo
    // que no se toca es su CACHE DE SESION. Las dos cosas quedan separadas.
    var msg = '¿Liberar la caché de la API y del WV?\n\n' +
      '• Se borrarán ' + dry.removed + ' claves (' + fmtBytes(dry.bytes) + ')\n' +
      // La segunda linea NO enumera QUE se conserva. La version anterior decia
      // "cuentas, pines, tema y ajustes", y eso era una afirmacion sobre las
      // CATEGORIAS que hoy es FALSA por lo mismo que el numero: el `kept` del
      // dryRun incluye las 8 claves de cache de otros modulos que no estan en
      // el registro (characters.js, activities.js, app.js), asi que el numero
      // arrastraba cache mientras la frase la negaba. Y la enumeracion no
      // sobrevive: los BYTES siguen siendo ciertos cuando manana un modulo
      // registre su clave; una lista de categorias deja de serlo en el mismo
      // commit. El tamano es el dato que Pablo puede comparar con la cuota.
      '• Se conservan ' + dry.kept + ' claves (' + fmtBytes(dry.keptBytes) + ')\n\n' +
      'La API volverá a descargar los datos, y el WV también. Se libera también lo que esos dos tienen en memoria; lo que otros módulos ya tienen cargado se conserva hasta que recargues la página.';
    if (!confirm(msg)) return;   // 2. Cancelar NO borra nada: el dryRun no habia borrado nada
    // 3. Ahora si.
    var res = api.__cacheClear();
    if (window.toast) {
      window.toast('success', 'Caché liberada: ' + (res ? res.removed : 0) + ' claves (' +
        fmtBytes(res ? res.bytes : 0) + ')', { ttl: 3500 });
    }
  }

  // =======================================================================
  // 3. INICIALIZACIÓN
  // =======================================================================
  
  function init() {
    console.info(LOG, 'Settings Manager v1.0.4 inicializado');
    
    // Buscar botones en el DOM (se ejecuta después de que index.html cargue)
    function bindButtons() {
      var exportBtn = document.getElementById('exportSettingsBtn');
      var importBtn = document.getElementById('importSettingsBtn');
      var clearCacheBtn = document.getElementById('clearCacheBtn');
      
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
      
      if (clearCacheBtn && !clearCacheBtn.__settingsWired) {
        clearCacheBtn.__settingsWired = true;
        clearCacheBtn.addEventListener('click', function(e) {
          e.preventDefault();
          clearApiCache();
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
    // HB#120 T20-c
    createSafetySnapshot: createSafetySnapshot,
    getSafetySnapshot: getSafetySnapshot,
    restoreSafetySnapshot: restoreSafetySnapshot,
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