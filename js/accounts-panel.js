/*!
 * js/accounts-panel.js — Panel de Cuentas (cifrado local)
 * v1.9.0 (2026-03-28)
 *
 * MEJORAS v1.9.0:
 * - Iconos separados para títulos de secciones:
 *   • Credenciales: assets/icons/Welcome/733266.png
 *   • GW2 Avanzado: assets/icons/Cuentas/358409.png
 * - Los campos internos mantienen sus iconos originales:
 *   • Contraseña: assets/icons/Cuentas/733265.png
 *   • Chars: assets/icons/Cuentas/156409.png
 * - Reemplazo de emoji ✅ por imagen en GeForce Now
 *
 * MEJORAS v1.8.0:
 * - Twitch dentro de subsección colapsable "Servicios" dentro de Servicios y API
 * - Corrección completa de contraseña Twitch (visible y toggle funcional)
 * - Plantilla Excel actualizada con columna twitch_user
 *
 * MEJORAS v1.7.0:
 * - Reemplazo de emoji 👁️ por imagen local (assets/icons/welcome/528726.png)
 * - Información detallada de Twitch en Servicios y API
 *
 * MEJORAS v1.6.0:
 * - Reemplazo completo de emojis por imágenes en las tarjetas
 * - Nuevos iconos para: GW2 ID, Creación, AP, Chars, Mochilas, Bancos, Material, Legendarias, Nivel 80, Notas
 * - Chevron expandible con iconos (▶️/▼) convertidos a imágenes
 *
 * MEJORAS v1.5.0:
 * - Icono decorativo aleatorio a la izquierda (9 iconos)
 * - Tipo de cuenta excluyente: main, alter, f2p
 * - Tags adicionales combinables: farming, keys, weekly, taxi
 *
 * MEJORAS v1.4.0:
 * - Rediseño de tarjetas con secciones colapsables
 */

(function (root) {
  'use strict';
  var LOG = '[Accounts]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    STORAGE_LAST_FILE_KEY: 'accounts:lastFile',
    DEFAULT_ICON: 'assets/icons/Cuentas/GW2free.png',
    
    // Iconos decorativos (aleatorios para la izquierda)
    DECORATIVE_ICONS: [
      'assets/icons/Cuentas/1770678.png',
      'assets/icons/Cuentas/1770679.png',
      'assets/icons/Cuentas/1770680.png',
      'assets/icons/Cuentas/1770681.png',
      'assets/icons/Cuentas/1770682.png',
      'assets/icons/Cuentas/1770683.png',
      'assets/icons/Cuentas/1770684.png',
      'assets/icons/Cuentas/1770685.png',
      'assets/icons/Cuentas/1770686.png'
    ],
    
    // Iconos de tipo de cuenta (excluyentes)
    TYPE_ICONS: {
      main: 'assets/icons/Cuentas/547827.png',
      alter: 'assets/icons/Cuentas/157375.png',
      f2p: 'assets/icons/Cuentas/102538.png'
    },
    
    // Iconos de tags adicionales (combinables)
    TAG_ICONS: {
      farming: 'assets/icons/Cuentas/157332.png',
      keys: 'assets/icons/Cuentas/1716669.png',
      weekly: 'assets/icons/Cuentas/240679.png',
      taxi: 'assets/icons/Cuentas/102438.png'
    },
    
    // Iconos de UI para tarjetas
    CARD_ICONS: {
      email: 'assets/icons/Cuentas/gmail.png',
      lock: 'assets/icons/Cuentas/733265.png',           // Campo Contraseña (se mantiene)
      credentialsTitle: 'assets/icons/Welcome/733266.png', // Título Credenciales (nuevo)
      gmailPass: 'assets/icons/Cuentas/155048.png',
      gw2id: 'assets/icons/Cuentas/358353.png',
      calendar: 'assets/icons/Cuentas/156407.png',
      trophy: 'assets/icons/Cuentas/156403.png',
      character: 'assets/icons/Cuentas/156409.png',      // Campo Chars (se mantiene)
      advancedTitle: 'assets/icons/Cuentas/358409.png',  // Título GW2 Avanzado (nuevo)
      bag: 'assets/icons/Cuentas/157098.png',
      bank: 'assets/icons/Cuentas/156670.png',
      material: 'assets/icons/Cuentas/255373.png',
      medal: 'assets/icons/Cuentas/157085.png',
      sword: 'assets/icons/Cuentas/1424243.png',
      services: 'assets/icons/welcome/102609.png',
      apiKey: 'assets/icons/Cuentas/155048.png',
      note: 'assets/icons/Cuentas/1228929.png',
      chevronRight: 'assets/icons/Cuentas/528716.png',
      chevronDown: 'assets/icons/Cuentas/528717.png',
      eye: 'assets/icons/welcome/528726.png'
    },
    
    ICONS: {
      account: 'assets/icons/Cuentas/GW2free.png',
      lock: 'assets/icons/Cuentas/candado GW2.png',
      gmail: 'assets/icons/Cuentas/gmail.png',
      googlePass: 'assets/icons/Cuentas/passgoogle.png',
      twitch: 'assets/icons/Cuentas/twitchlogo.png',
      geforce: 'assets/icons/Cuentas/gforce.png',
      expansions: {
        core: 'assets/icons/Cuentas/GW2free.png',
        heroic: 'assets/icons/Cuentas/Heroic.png',
        heartOfThorns: 'assets/icons/Cuentas/HoT.png',
        pathOfFire: 'assets/icons/Cuentas/PoF.png',
        endOfDragons: 'assets/icons/Cuentas/EoD.png',
        secretsOfTheObscure: 'assets/icons/Cuentas/SoTO.png',
        janthirWilds: 'assets/icons/Cuentas/JW.png',
        visionsOfEternity: 'assets/icons/Cuentas/VoE.png'
      }
    }
  };

  // =======================================================================
  // 1. ESTADO GLOBAL
  // =======================================================================
  var state = {
    inited: false,
    active: false,
    data: null,
    encryptedData: null,
    fileName: null,
    passwordHash: null,
    filters: {
      search: '',
      type: 'all',
      tag: 'all'
    },
    view: 'cards',
    showPasswords: {},        // Para contraseñas de GW2 y Gmail Pass
    showTwitchPasswords: {},  // Para contraseñas de Twitch
    expandedAccounts: {}
  };

  // =======================================================================
  // 2. UTILIDADES BÁSICAS
  // =======================================================================
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return '&#39;';
    });
  }

  function fmtNumber(n) {
    return Number(n || 0).toLocaleString('es-AR');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-AR');
    } catch (e) {
      return dateStr;
    }
  }

  function formatAgeDays(createdStr) {
    if (!createdStr) return '—';
    try {
      var created = new Date(createdStr);
      var days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
      return days + ' días';
    } catch (e) {
      return '—';
    }
  }

  function getAccountTypeTags(account) {
    var tags = [];
    if (account.tags && Array.isArray(account.tags)) {
      tags.push.apply(tags, account.tags);
    }
    return tags;
  }

  function isMainAccount(account) {
    var tags = getAccountTypeTags(account);
    return tags.indexOf('main') !== -1;
  }

  function getExpansionIcon(expKey, isOwned) {
    var icon = CONFIG.ICONS.expansions[expKey];
    if (!icon) return '';
    var style = isOwned ? '' : 'style="filter: grayscale(1); opacity: 0.5;"';
    return '<img src="' + icon + '" width="24" height="24" title="' + expKey + '" ' + style + ' loading="lazy">';
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  function copyToClipboard(text, fieldName) {
    try {
      navigator.clipboard.writeText(text);
      window.toast('success', fieldName + ' copiado al portapapeles', { ttl: 1500 });
    } catch (e) {
      console.warn(LOG, 'clipboard error', e);
      window.prompt('Copiar ' + fieldName + ':', text);
    }
  }

  function getRandomDecorativeIcon() {
    var randomIndex = Math.floor(Math.random() * CONFIG.DECORATIVE_ICONS.length);
    return CONFIG.DECORATIVE_ICONS[randomIndex];
  }

  // =======================================================================
  // 3. PERSISTENCIA
  // =======================================================================
  function saveLastFileInfo(fileName, encryptedData) {
    try {
      localStorage.setItem(CONFIG.STORAGE_LAST_FILE_KEY, JSON.stringify({
        name: fileName,
        data: encryptedData,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  function getLastFileInfo() {
    try {
      var saved = localStorage.getItem(CONFIG.STORAGE_LAST_FILE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.data && parsed.name) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  }

  function clearLastFileInfo() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_LAST_FILE_KEY);
    } catch (e) {}
  }

  // =======================================================================
  // 4. CARGA Y DESCRIPCIÓN
  // =======================================================================
  async function loadAndDecryptFile(file, password) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var encrypted = e.target.result;
          var decrypted = CryptoJS.AES.decrypt(encrypted, password).toString(CryptoJS.enc.Utf8);
          if (!decrypted) {
            reject(new Error('Contraseña incorrecta o archivo corrupto'));
            return;
          }
          var data = JSON.parse(decrypted);
          resolve({ data: data, encrypted: encrypted });
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

  async function loadFromFile(file, password, rememberFile) {
    try {
      var result = await loadAndDecryptFile(file, password);
      state.data = result.data;
      state.encryptedData = result.encrypted;
      state.fileName = file.name;
      state.passwordHash = simpleHash(password);
      state.showPasswords = {};
      state.showTwitchPasswords = {};
      state.expandedAccounts = {};
      
      if (rememberFile !== false) {
        saveLastFileInfo(file.name, result.encrypted);
      }
      
      render();
      window.toast('success', 'Cuentas cargadas correctamente', { ttl: 2000 });
      return true;
    } catch (err) {
      console.error(LOG, 'Load error', err);
      window.toast('error', err.message || 'Error al cargar el archivo', { ttl: 3000 });
      return false;
    }
  }

  async function loadFromStoredFile(password) {
    var lastFile = getLastFileInfo();
    if (!lastFile || !lastFile.data) return false;
    
    try {
      var decrypted = CryptoJS.AES.decrypt(lastFile.data, password).toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        return false;
      }
      var data = JSON.parse(decrypted);
      state.data = data;
      state.encryptedData = lastFile.data;
      state.fileName = lastFile.name;
      state.passwordHash = simpleHash(password);
      state.showPasswords = {};
      state.showTwitchPasswords = {};
      state.expandedAccounts = {};
      render();
      window.toast('success', 'Cuentas cargadas automáticamente', { ttl: 1500 });
      return true;
    } catch (err) {
      return false;
    }
  }

  // =======================================================================
  // 5. FILTRADO
  // =======================================================================
  function getFilteredAccounts() {
    if (!state.data || !state.data.accounts) return [];
    var accounts = state.data.accounts;
    var filters = state.filters;

    return accounts.filter(function(acc) {
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        var nameMatch = (acc.name || '').toLowerCase().includes(searchLower);
        var emailMatch = (acc.login && acc.login.email || '').toLowerCase().includes(searchLower);
        var idMatch = (acc.gw2 && acc.gw2.accountName || '').toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch && !idMatch) return false;
      }
      if (filters.type !== 'all') {
        var tags = getAccountTypeTags(acc);
        if (filters.type === 'main' && tags.indexOf('main') === -1) return false;
        if (filters.type === 'alter' && tags.indexOf('alter') === -1) return false;
        if (filters.type === 'f2p' && tags.indexOf('f2p') === -1) return false;
      }
      if (filters.tag !== 'all') {
        var accTags = getAccountTypeTags(acc);
        if (accTags.indexOf(filters.tag) === -1) return false;
      }
      return true;
    });
  }

  // =======================================================================
  // 6. RENDERIZADO DE TARJETA CON ICONOS DE UI
  // =======================================================================
  function renderAccountCard(acc) {
    var login = acc.login || {};
    var gw2 = acc.gw2 || {};
    var expansions = acc.expansions || {};
    var services = acc.services || {};
    var tags = getAccountTypeTags(acc);
    var isMain = isMainAccount(acc);
    var showPass = state.showPasswords[acc.id] || false;
    var showTwitchPass = state.showTwitchPasswords[acc.id] || false;

    // Estados de secciones colapsables
    var expandedSections = state.expandedAccounts[acc.id] || {};
    var showCredentials = expandedSections.credentials || false;
    var showAdvanced = expandedSections.advanced || false;
    var showExpansions = expandedSections.expansions || false;
    var showServicesApi = expandedSections.servicesApi || false;
    var showServicesDetail = expandedSections.servicesDetail || false; // Subsección de Servicios

    // 1. ICONO DECORATIVO (izquierda) - SIEMPRE ALEATORIO
    var decorativeIcon = getRandomDecorativeIcon();
    
    // 2. TIPO DE CUENTA (excluyente) - main, alter, f2p
    var accountType = null;
    if (tags.indexOf('main') !== -1) {
      accountType = 'main';
    } else if (tags.indexOf('alter') !== -1) {
      accountType = 'alter';
    } else if (tags.indexOf('f2p') !== -1) {
      accountType = 'f2p';
    }
    
    var typeIconHtml = '';
    if (accountType && CONFIG.TYPE_ICONS[accountType]) {
      typeIconHtml = '<img src="' + CONFIG.TYPE_ICONS[accountType] + '" width="20" height="20" alt="' + accountType + '" title="' + accountType + '" style="filter: brightness(0.9); margin-left: 4px; cursor: help;">';
    }
    
    // 3. TAGS ADICIONALES (combinables) - farming, keys, weekly, taxi
    var tagIconsHtml = '';
    var tagOrder = ['farming', 'keys', 'weekly', 'taxi'];
    for (var i = 0; i < tagOrder.length; i++) {
      var tag = tagOrder[i];
      if (tags.indexOf(tag) !== -1 && CONFIG.TAG_ICONS[tag]) {
        tagIconsHtml += '<img src="' + CONFIG.TAG_ICONS[tag] + '" width="20" height="20" alt="' + tag + '" title="' + tag + '" style="filter: brightness(0.9); margin-left: 4px; cursor: help;">';
      }
    }
    
    // Unir todos los iconos de la derecha
    var rightIcons = typeIconHtml + tagIconsHtml;

    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailPassDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';

    // Expansiones
    var expOrder = ['core', 'heroic', 'heartOfThorns', 'pathOfFire', 'endOfDragons', 'secretsOfTheObscure', 'janthirWilds', 'visionsOfEternity'];
    var expIcons = [];
    expOrder.forEach(function(key) {
      if (expansions[key] !== undefined) {
        expIcons.push(getExpansionIcon(key, expansions[key]));
      }
    });

    // Servicios - íconos simples para el header
    var serviceIcons = [];
    if (services.twitch && services.twitch.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.twitch + '" width="20" height="20" title="Twitch vinculado">');
    }
    if (services.geforceNow && services.geforceNow.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.geforce + '" width="20" height="20" title="GeForce Now vinculado">');
    }

    // Información detallada de Twitch (para mostrar dentro de Servicios)
    var twitchDetailHtml = '';
    if (services.twitch && services.twitch.linked) {
      var twitchUsername = services.twitch.username || '';
      var twitchEmail = services.twitch.email || '';
      var twitchPassword = services.twitch.password || '';
      var twitchPassDisplay = showTwitchPass ? esc(twitchPassword) : '••••••••';
      
      twitchDetailHtml = '<div style="margin-left: 20px; margin-top: 8px; padding-left: 12px; border-left: 2px solid #2a2c35;">';
      twitchDetailHtml += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
      twitchDetailHtml += '<img src="' + CONFIG.ICONS.twitch + '" width="16" height="16" style="vertical-align: middle;">';
      twitchDetailHtml += '<strong>Twitch:</strong> ';
      twitchDetailHtml += '<span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(twitchUsername) + '" data-field="Usuario Twitch">@' + esc(twitchUsername || '—') + '</span>';
      twitchDetailHtml += '</div>';
      
      if (twitchEmail) {
        twitchDetailHtml += '<div style="margin-left: 24px; margin-top: 6px; display: flex; align-items: center; gap: 8px;">';
        twitchDetailHtml += '<img src="' + CONFIG.CARD_ICONS.email + '" width="14" height="14" style="vertical-align: middle;">';
        twitchDetailHtml += '<span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(twitchEmail) + '" data-field="Email Twitch">' + esc(twitchEmail) + '</span>';
        twitchDetailHtml += '</div>';
      }
      
      twitchDetailHtml += '<div style="margin-left: 24px; margin-top: 6px; display: flex; align-items: center; gap: 8px;">';
      twitchDetailHtml += '<img src="' + CONFIG.CARD_ICONS.lock + '" width="14" height="14" style="vertical-align: middle;">';
      twitchDetailHtml += '<span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(twitchPassword) + '" data-field="Contraseña Twitch">' + twitchPassDisplay + '</span>';
      twitchDetailHtml += '<button class="btn-ghost toggle-twitch-password" data-id="' + acc.id + '" style="padding: 2px 4px; display: inline-flex; align-items: center;">';
      twitchDetailHtml += '<img src="' + CONFIG.CARD_ICONS.eye + '" width="14" height="14" alt="Mostrar contraseña" style="vertical-align: middle;">';
      twitchDetailHtml += '</button>';
      twitchDetailHtml += '</div>';
      
      twitchDetailHtml += '</div>';
    }

    // GeForce Now texto adicional (con imagen en lugar de emoji)
    var geforceTextHtml = '';
    if (services.geforceNow && services.geforceNow.linked) {
      geforceTextHtml = '<div style="margin-left: 20px; margin-top: 6px;"><img src="' + CONFIG.ICONS.geforce + '" width="14" height="14" style="vertical-align: middle;"> <span style="color: #a0a0a6;">GeForce Now: <img src="assets/icons/Welcome/156108.png" width="14" height="14" alt="Vinculado" style="vertical-align: middle;"> Vinculado</span></div>';
    }

    // Subsección "Servicios" colapsable
    var servicesSubsectionHtml = '';
    if (serviceIcons.length > 0) {
      var chevronIcon = showServicesDetail ? CONFIG.CARD_ICONS.chevronDown : CONFIG.CARD_ICONS.chevronRight;
      servicesSubsectionHtml = `
        <div style="margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" data-toggle-services="${acc.id}">
            <img src="${chevronIcon}" width="12" height="12" alt="" style="filter: brightness(0.9);">
            <img src="${CONFIG.CARD_ICONS.services}" width="16" height="16" alt="" style="filter: brightness(0.9);">
            <span style="font-weight: 600; font-size: 0.85rem;">Servicios</span>
            <span style="margin-left: 4px;">${serviceIcons.join(' ')}</span>
          </div>
          <div id="services-detail-${acc.id}" style="${showServicesDetail ? '' : 'display: none;'} margin-top: 8px; padding-left: 24px;">
            ${twitchDetailHtml}
            ${geforceTextHtml}
          </div>
        </div>
      `;
    }

    // API Key
    var apiKeyHtml = '';
    if (acc.apiKey) {
      var apiKeyValue = acc.apiKey.value || acc.apiKey;
      apiKeyHtml = '<div style="margin-top: 8px;"><img src="' + CONFIG.CARD_ICONS.apiKey + '" width="16" height="16" style="vertical-align: middle;"> <strong>API Key:</strong> <code style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(apiKeyValue) + '" data-field="API Key">' + esc(apiKeyValue) + '</code></div>';
    }

    // Servicios y API (contenedor principal)
    var servicesApiHtml = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    servicesApiHtml += servicesSubsectionHtml;
    servicesApiHtml += apiKeyHtml;
    servicesApiHtml += '</div>';

    // Función para sección colapsable con iconos de chevron
    function renderCollapsibleSection(title, iconSrc, sectionKey, isOpen, contentHtml) {
      var chevronIcon = isOpen ? CONFIG.CARD_ICONS.chevronDown : CONFIG.CARD_ICONS.chevronRight;
      return `
        <div style="margin-top: 12px; border-top: 1px solid #2a2c35; padding-top: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" data-toggle-section="${acc.id}" data-section="${sectionKey}">
            <img src="${chevronIcon}" width="12" height="12" alt="" style="filter: brightness(0.9);">
            <img src="${iconSrc}" width="16" height="16" alt="" style="filter: brightness(0.9);">
            <span style="font-weight: 600; font-size: 0.85rem;">${title}</span>
          </div>
          <div id="section-${acc.id}-${sectionKey}" style="${isOpen ? '' : 'display: none;'} margin-top: 8px; padding-left: 24px;">
            ${contentHtml}
          </div>
        </div>
      `;
    }

    // Contenido de secciones con iconos
    var credentialsHtml = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div><img src="${CONFIG.CARD_ICONS.lock}" width="16" height="16" style="vertical-align: middle;"> <strong>Contraseña:</strong> 
          <span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="${esc(login.password || '')}" data-field="Contraseña">${passwordDisplay}</span>
          <button class="btn-ghost toggle-password" data-id="${acc.id}" style="padding: 2px 4px; display: inline-flex; align-items: center;">
            <img src="${CONFIG.CARD_ICONS.eye}" width="14" height="14" alt="Mostrar contraseña" style="vertical-align: middle;">
          </button>
        </div>
        ${login.gmailPassword ? `<div><img src="${CONFIG.CARD_ICONS.gmailPass}" width="16" height="16" style="vertical-align: middle;"> <strong>Gmail Pass:</strong> 
          <span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="${esc(login.gmailPassword)}" data-field="Gmail Pass">${gmailPassDisplay}</span>
        </div>` : ''}
      </div>
    `;

    var advancedHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        <span><img src="${CONFIG.CARD_ICONS.character}" width="16" height="16" style="vertical-align: middle;"> <strong>Chars:</strong> ${gw2.characterSlots || gw2.characterCount || '—'}</span>
        <span><img src="${CONFIG.CARD_ICONS.bag}" width="16" height="16" style="vertical-align: middle;"> <strong>Mochilas:</strong> ${gw2.bagSlots || '—'}</span>
        <span><img src="${CONFIG.CARD_ICONS.bank}" width="16" height="16" style="vertical-align: middle;"> <strong>Bancos:</strong> ${gw2.bankSlots || '—'}</span>
        <span><img src="${CONFIG.CARD_ICONS.material}" width="16" height="16" style="vertical-align: middle;"> <strong>Material:</strong> ${gw2.materialStorage || '—'}</span>
        <span><img src="${CONFIG.CARD_ICONS.medal}" width="16" height="16" style="vertical-align: middle;"> <strong>Legendarias:</strong> ${gw2.legendaries || 0}</span>
        ${gw2.level80 !== undefined ? `<span><img src="${CONFIG.CARD_ICONS.sword}" width="16" height="16" style="vertical-align: middle;"> <strong>Nivel 80:</strong> ${gw2.level80 ? '✅ Sí' : '❌ No'}</span>` : ''}
      </div>
    `;

    var expansionsHtml = `
      <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
        ${expIcons.length ? expIcons.join(' ') : '<span class="muted">—</span>'}
      </div>
    `;

    return '' +
      '<article class="wallet-card" style="' + (isMain ? 'border-left: 3px solid #ffd966;' : '') + '">' +
        '<div class="wallet-card__top">' +
          '<div class="wallet-card__iconWrap">' +
            '<img src="' + decorativeIcon + '" width="30" height="30" alt="Cuenta" loading="lazy" style="filter: brightness(0.9);">' +
          '</div>' +
          '<div class="wallet-card__name" style="font-weight: 700; cursor: pointer;" data-account-id="' + acc.id + '" data-toggle-expand-name>' + esc(acc.name || 'Cuenta') + '</div>' +
          '<div class="wallet-card__meta" style="justify-content: flex-end; display: flex; align-items: center; gap: 2px;">' +
            rightIcons +
          '</div>' +
        '</div>' +

        '<div class="wallet-sep"></div>' +

        '<div class="wallet-card__body">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
            '<div><img src="' + CONFIG.CARD_ICONS.email + '" width="16" height="16" style="vertical-align: middle;"> <strong>Email:</strong> ' +
              '<span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span>' +
            '</div>' +
          '</div>' +

          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 8px;">' +
            '<div><img src="' + CONFIG.CARD_ICONS.gw2id + '" width="16" height="16" style="vertical-align: middle;"> <strong>GW2 ID:</strong> ' + esc(gw2.accountName || '—') + '</div>' +
            '<div><img src="' + CONFIG.CARD_ICONS.calendar + '" width="16" height="16" style="vertical-align: middle;"> <strong>Creación:</strong> ' + formatDate(gw2.created) + ' (' + formatAgeDays(gw2.created) + ')</div>' +
            '<div><img src="' + CONFIG.CARD_ICONS.trophy + '" width="16" height="16" style="vertical-align: middle;"> <strong>AP:</strong> ' + fmtNumber(gw2.achievementPoints) + '</div>' +
          '</div>' +

          renderCollapsibleSection('Credenciales', CONFIG.CARD_ICONS.credentialsTitle, 'credentials', showCredentials, credentialsHtml) +
          renderCollapsibleSection('GW2 Avanzado', CONFIG.CARD_ICONS.advancedTitle, 'advanced', showAdvanced, advancedHtml) +
          (expIcons.length ? renderCollapsibleSection('Expansiones', CONFIG.ICONS.expansions.core, 'expansions', showExpansions, expansionsHtml) : '') +
          renderCollapsibleSection('Servicios y API', CONFIG.CARD_ICONS.services, 'servicesApi', showServicesApi, servicesApiHtml) +

          (acc.notes ? '<div style="margin-top: 12px; color: #a0a0a6; display: flex; align-items: center; gap: 6px;"><img src="' + CONFIG.CARD_ICONS.note + '" width="16" height="16" alt=""><strong>Notas:</strong> ' + esc(acc.notes) + '</div>' : '') +
        '</div>' +
      '</article>';
  }

  function renderCards(accounts) {
    var container = document.getElementById('accountsList');
    if (!container) return;

    container.className = 'wallet-card-grid';
    container.style.display = 'grid';
    container.innerHTML = accounts.map(renderAccountCard).join('');

    // Toggle password GW2
    document.querySelectorAll('.toggle-password').forEach(function(btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        state.showPasswords[id] = !state.showPasswords[id];
        renderList();
      });
    });

    // Toggle password Twitch
    document.querySelectorAll('.toggle-twitch-password').forEach(function(btn) {
      if (btn.__wiredTwitch) return;
      btn.__wiredTwitch = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        state.showTwitchPasswords[id] = !state.showTwitchPasswords[id];
        renderList();
      });
    });

    // Toggle secciones colapsables principales
    document.querySelectorAll('[data-toggle-section]').forEach(function(el) {
      if (el.__wiredSection) return;
      el.__wiredSection = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-toggle-section');
        var section = el.getAttribute('data-section');
        var current = state.expandedAccounts[id] || {};
        current[section] = !current[section];
        state.expandedAccounts[id] = current;
        renderList();
      });
    });

    // Toggle subsección Servicios
    document.querySelectorAll('[data-toggle-services]').forEach(function(el) {
      if (el.__wiredServices) return;
      el.__wiredServices = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-toggle-services');
        var current = state.expandedAccounts[id] || {};
        current.servicesDetail = !current.servicesDetail;
        state.expandedAccounts[id] = current;
        renderList();
      });
    });

    // Click en nombre para expandir/colapsar todo
    document.querySelectorAll('[data-toggle-expand-name]').forEach(function(el) {
      if (el.__wiredName) return;
      el.__wiredName = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-account-id');
        var current = state.expandedAccounts[id] || {};
        var allClosed = !current.credentials && !current.advanced && !current.expansions && !current.servicesApi;
        if (allClosed) {
          current.credentials = true;
          current.advanced = true;
          current.expansions = true;
          current.servicesApi = true;
        } else {
          current.credentials = false;
          current.advanced = false;
          current.expansions = false;
          current.servicesApi = false;
        }
        state.expandedAccounts[id] = current;
        renderList();
      });
    });

    // Copiar al portapapeles
    document.querySelectorAll('[data-copy]').forEach(function(el) {
      if (el.__wiredCopy) return;
      el.__wiredCopy = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var text = el.getAttribute('data-copy');
        var field = el.getAttribute('data-field') || 'Texto';
        if (text && text !== '—') {
          copyToClipboard(text, field);
        } else {
          window.toast('info', 'No hay ' + field + ' para copiar', { ttl: 1500 });
        }
      });
    });
  }

  function renderTableRow(acc) {
    var login = acc.login || {};
    var gw2 = acc.gw2 || {};
    var services = acc.services || {};
    var tags = getAccountTypeTags(acc);
    var decorativeIcon = getRandomDecorativeIcon();
    var isExpanded = state.expandedAccounts[acc.id] ? Object.keys(state.expandedAccounts[acc.id]).length > 0 : false;

    var showPass = state.showPasswords[acc.id] || false;
    var showTwitchPass = state.showTwitchPasswords[acc.id] || false;
    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailPassDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';
    
    // Twitch info para tabla
    var twitchInfo = '';
    if (services.twitch && services.twitch.linked) {
      var twitchUsername = services.twitch.username || '';
      twitchInfo = '<div class="muted" style="font-size: 11px;"><img src="' + CONFIG.ICONS.twitch + '" width="12" height="12" style="vertical-align: middle;"> Twitch: @' + esc(twitchUsername) + '</div>';
    }

    // Tipo de cuenta para tabla
    var accountType = null;
    if (tags.indexOf('main') !== -1) {
      accountType = 'main';
    } else if (tags.indexOf('alter') !== -1) {
      accountType = 'alter';
    } else if (tags.indexOf('f2p') !== -1) {
      accountType = 'f2p';
    }
    
    var typeIconHtml = '';
    if (accountType && CONFIG.TYPE_ICONS[accountType]) {
      typeIconHtml = '<img src="' + CONFIG.TYPE_ICONS[accountType] + '" width="16" height="16" alt="' + accountType + '" title="' + accountType + '" style="filter: brightness(0.9); margin-left: 4px; cursor: help;">';
    }
    
    // Tags adicionales para tabla
    var tagIconsHtml = '';
    var tagOrder = ['farming', 'keys', 'weekly', 'taxi'];
    for (var i = 0; i < tagOrder.length; i++) {
      var tag = tagOrder[i];
      if (tags.indexOf(tag) !== -1 && CONFIG.TAG_ICONS[tag]) {
        tagIconsHtml += '<img src="' + CONFIG.TAG_ICONS[tag] + '" width="16" height="16" alt="' + tag + '" title="' + tag + '" style="filter: brightness(0.9); margin-left: 4px; cursor: help;">';
      }
    }
    
    var rightIcons = typeIconHtml + tagIconsHtml;

    return '' +
      '<tr data-id="' + acc.id + '" style="' + (isMainAccount(acc) ? 'background: rgba(255,217,102,0.08);' : '') + '">' +
        '}<img src="' + decorativeIcon + '" width="24" height="24" alt=""><\/td>' +
        '}<strong style="cursor: pointer;" data-toggle-expand-table data-id="' + acc.id + '">' + esc(acc.name || 'Cuenta') + '</strong>' +
          (isExpanded ? '<div class="muted" style="font-size: 11px; margin-top: 4px;">' + (acc.notes || '') + '</div>' : '') +
          twitchInfo +
        '<\/td>' +
        '}<div><img src="' + CONFIG.CARD_ICONS.email + '" width="14" height="14" style="vertical-align: middle;"> <span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span></div>' +
          '<div class="muted" style="font-size: 11px;"><img src="' + CONFIG.CARD_ICONS.lock + '" width="12" height="12" style="vertical-align: middle;"> Pass: <span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span> <button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding: 0 4px; display: inline-flex; align-items: center;"><img src="' + CONFIG.CARD_ICONS.eye + '" width="12" height="12" alt=""></button></div>' +
          (login.gmailPassword ? '<div class="muted" style="font-size: 11px;"><img src="' + CONFIG.CARD_ICONS.gmailPass + '" width="12" height="12" style="vertical-align: middle;"> Gmail: <span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailPassDisplay + '</span></div>' : '') +
        '<\/td>' +
        '}<img src="' + CONFIG.CARD_ICONS.gw2id + '" width="14" height="14" style="vertical-align: middle;"> ' + esc(gw2.accountName || '—') + '<\/td>' +
        '<td class="right"><img src="' + CONFIG.CARD_ICONS.trophy + '" width="14" height="14" style="vertical-align: middle;"> ' + fmtNumber(gw2.achievementPoints) + '<\/td>' +
        '<td class="right"><img src="' + CONFIG.CARD_ICONS.medal + '" width="14" height="14" style="vertical-align: middle;"> ' + (gw2.legendaries || 0) + '<\/td>' +
        '}<div style="display: flex; align-items: center; gap: 2px;">' + rightIcons + '<\/div><\/td>' +
      '<\/tr>';
  }

  function renderTable(accounts) {
    var container = document.getElementById('accountsList');
    if (!container) return;

    container.innerHTML = '' +
      '<div class="table-wrap">' +
        '<table class="simple" style="width:100%; border-collapse: separate; border-spacing: 0;">' +
          '<thead>' +
            '械' +
              '<th style="width:32px;"></th>' +
              '<th>Cuenta</th>' +
              '<th>Credenciales</th>' +
              '<th>GW2 ID</th>' +
              '<th class="right">AP</th>' +
              '<th class="right">Leg.</th>' +
              '<th>Tags</th>' +
            '<\/tr>' +
          '</thead>' +
          '<tbody>' +
            accounts.map(renderTableRow).join('') +
          '</tbody>' +
        '<\/table>' +
      '</div>';

    document.querySelectorAll('.toggle-password').forEach(function(btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        state.showPasswords[id] = !state.showPasswords[id];
        renderList();
      });
    });

    document.querySelectorAll('[data-toggle-expand-table]').forEach(function(el) {
      if (el.__wiredExpand) return;
      el.__wiredExpand = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-id');
        var current = state.expandedAccounts[id] || {};
        var isExpanded = Object.keys(current).length > 0;
        if (isExpanded) {
          state.expandedAccounts[id] = {};
        } else {
          state.expandedAccounts[id] = { credentials: true, advanced: true, expansions: true, servicesApi: true };
        }
        renderList();
      });
    });

    document.querySelectorAll('[data-copy]').forEach(function(el) {
      if (el.__wiredCopy) return;
      el.__wiredCopy = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var text = el.getAttribute('data-copy');
        var field = el.getAttribute('data-field') || 'Texto';
        if (text && text !== '—') {
          copyToClipboard(text, field);
        }
      });
    });
  }

  function renderStats(accounts) {
    var container = document.getElementById('accountsStats');
    if (!container) return;
    if (!accounts.length) {
      container.innerHTML = '';
      return;
    }
    
    // Contar por tipo
    var total = accounts.length;
    var mains = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('main') !== -1; }).length;
    var alters = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('alter') !== -1; }).length;
    var f2ps = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('f2p') !== -1; }).length;
    
    // Contar por tags adicionales
    var keys = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('keys') !== -1; }).length;
    var farming = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('farming') !== -1; }).length;
    var weekly = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('weekly') !== -1; }).length;
    var taxi = accounts.filter(function(a) { return getAccountTypeTags(a).indexOf('taxi') !== -1; }).length;
    
    container.innerHTML = '' +
      '<div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: #1a1e2a; border-radius: 12px;">' +
        
        // Total
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/1770683.png" width="20" height="20" alt="Total" style="filter: brightness(0.9);">' +
          '<strong>Total:</strong> ' + total + ' cuentas' +
        '</div>' +
        
        // Separador (ahora con margin negativo para reducir espacio)
        '<span style="color: #c5c5c5; margin: 0 -6px;">|</span>' +
        
        // Principales
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/547827.png" width="20" height="20" alt="Principales" style="filter: brightness(0.9);">' +
          '<strong>Principales:</strong> ' + mains +
        '</div>' +
        
        // Alternativas
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/157375.png" width="20" height="20" alt="Alternativas" style="filter: brightness(0.9);">' +
          '<strong>Alternativas:</strong> ' + alters +
        '</div>' +
        
        // F2P
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/102538.png" width="20" height="20" alt="F2P" style="filter: brightness(0.9);">' +
          '<strong>F2P:</strong> ' + f2ps +
        '</div>' +
        
        // Separador (ahora con margin negativo para reducir espacio)
        '<span style="color: #c5c5c5; margin: 0 -6px;">|</span>' +
        
        // Llaves (Keys)
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/1716669.png" width="20" height="20" alt="Llaves" style="filter: brightness(0.9);">' +
          '<strong>Llaves:</strong> ' + keys +
        '</div>' +
        
        // Farming
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/157332.png" width="20" height="20" alt="Farming" style="filter: brightness(0.9);">' +
          '<strong>Farming:</strong> ' + farming +
        '</div>' +
        
        // Weekly
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/240679.png" width="20" height="20" alt="Weekly" style="filter: brightness(0.9);">' +
          '<strong>Weekly:</strong> ' + weekly +
        '</div>' +
        
        // Taxi
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<img src="assets/icons/Cuentas/102438.png" width="20" height="20" alt="Taxi" style="filter: brightness(0.9);">' +
          '<strong>Taxi:</strong> ' + taxi +
        '</div>' +
        
      '</div>';
  }

  function renderFilters(accounts) {
    var container = document.getElementById('accountsFilters');
    if (!container) return;
    if (!accounts.length) {
      container.innerHTML = '';
      return;
    }

    var allTags = new Set();
    accounts.forEach(function(acc) {
      getAccountTypeTags(acc).forEach(function(t) { allTags.add(t); });
    });

    var tagOptions = Array.from(allTags).sort().map(function(tag) {
      var iconMap = {
        main: CONFIG.TYPE_ICONS.main,
        alter: CONFIG.TYPE_ICONS.alter,
        f2p: CONFIG.TYPE_ICONS.f2p,
        farming: CONFIG.TAG_ICONS.farming,
        keys: CONFIG.TAG_ICONS.keys,
        weekly: CONFIG.TAG_ICONS.weekly,
        taxi: CONFIG.TAG_ICONS.taxi
      };
      var iconSrc = iconMap[tag] || CONFIG.DECORATIVE_ICONS[0];
      var displayName = tag.charAt(0).toUpperCase() + tag.slice(1);
      return '<option value="' + tag + '" ' + (state.filters.tag === tag ? 'selected' : '') + '>' + displayName + '</option>';
    }).join('');

    container.innerHTML = '' +
      '<div class="chips" aria-label="Filtros de cuentas">' +
        '<div class="chip">' +
          '<input id="accountsSearch" type="text" placeholder="Buscar cuenta..." value="' + esc(state.filters.search) + '"/>' +
        '</div>' +
        '<div class="chip">' +
          '<select id="accountsTypeFilter">' +
            '<option value="all"' + (state.filters.type === 'all' ? ' selected' : '') + '>Todos los tipos</option>' +
            '<option value="main"' + (state.filters.type === 'main' ? ' selected' : '') + '>Principales</option>' +
            '<option value="alter"' + (state.filters.type === 'alter' ? ' selected' : '') + '>Alternativas</option>' +
            '<option value="f2p"' + (state.filters.type === 'f2p' ? ' selected' : '') + '>Free to Play</option>' +
          '</select>' +
        '</div>' +
        (tagOptions ? '<div class="chip"><select id="accountsTagFilter"><option value="all">Todos los tags</option>' + tagOptions + '</select></div>' : '') +
        '<div class="filters-actions">' +
          '<button id="accountsClearFilters" class="btn">Limpiar filtros</button>' +
          '<button id="accountsToggleView" class="btn btn--ghost" title="Vista tarjeta/tabla">' + (state.view === 'cards' ? '📋 Vista tabla' : '🃏 Vista tarjetas') + '</button>' +
        '</div>' +
      '</div>';

    document.getElementById('accountsSearch')?.addEventListener('input', function(e) {
      state.filters.search = e.target.value;
      renderList();
    });
    document.getElementById('accountsTypeFilter')?.addEventListener('change', function(e) {
      state.filters.type = e.target.value;
      renderList();
    });
    var tagFilter = document.getElementById('accountsTagFilter');
    if (tagFilter) {
      tagFilter.addEventListener('change', function(e) {
        state.filters.tag = e.target.value;
        renderList();
      });
    }
    document.getElementById('accountsClearFilters')?.addEventListener('click', function() {
      state.filters = { search: '', type: 'all', tag: 'all' };
      var search = document.getElementById('accountsSearch');
      var type = document.getElementById('accountsTypeFilter');
      var tag = document.getElementById('accountsTagFilter');
      if (search) search.value = '';
      if (type) type.value = 'all';
      if (tag) tag.value = 'all';
      renderList();
    });

    var toggleViewBtn = document.getElementById('accountsToggleView');
    if (toggleViewBtn && !toggleViewBtn.__wired) {
      toggleViewBtn.__wired = true;
      toggleViewBtn.addEventListener('click', function() {
        state.view = state.view === 'cards' ? 'table' : 'cards';
        renderList();
      });
    }
  }

  function renderList() {
    var accounts = getFilteredAccounts();
    renderStats(accounts);
    renderFilters(accounts);
    if (state.view === 'table') {
      renderTable(accounts);
    } else {
      renderCards(accounts);
    }
  }

  // =======================================================================
  // 7. FORMULARIO DE CARGA (completo con asistente arriba y acceso a cuentas abajo)
  // =======================================================================
  function renderLoadForm() {
    var body = document.querySelector('#accountsPanel .panel__body');
    if (!body) return;

    var lastFile = getLastFileInfo();
    var hasStoredFile = !!lastFile;

    body.innerHTML = `
      <!-- BLOQUE ASISTENTE -->
      <div id="assistantBlock" style="background: #1a1e2a; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #2a2c35;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="assets/icons/Welcome/2604904.png" width="32" height="32" alt="" style="filter: brightness(0.9); object-fit: contain;">
            <div>
              <h3 style="margin: 0; font-size: 1rem;">Asistente de cuentas</h3>
              <div class="muted" style="font-size: 0.75rem;">Guía paso a paso para crear tu archivo seguro</div>
            </div>
          </div>
          <button id="openWizardBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
            <img src="assets/icons/Welcome/155911.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
            Crear nuevo archivo
          </button>
        </div>
      </div>

      <!-- BLOQUE ACCESO A CUENTAS -->
      <div id="accessBlock" style="background: #1a1e2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2a2c35;">
        <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
          <img src="assets/icons/Welcome/733266.png" width="24" height="24" alt="">
          Acceso a cuentas
        </h3>
        
        ${hasStoredFile ? `
          <div style="background: #0f1116; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <img src="assets/icons/Welcome/102353.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
                  <strong>Último archivo:</strong> ${esc(lastFile.name)}
                </div>
                <span class="muted">Ingresá tu contraseña para acceder automáticamente</span>
              </div>
              <button id="accountsUseStoredBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/Welcome/834002.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Usar archivo guardado
              </button>
            </div>
          </div>
          <hr style="border-color: #2a2c35; margin: 16px 0;">
          <p class="muted">O seleccioná un archivo diferente:</p>
        ` : ''}

        <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
          <div style="flex: 2;">
            <label>Archivo cifrado (.enc)</label>
            <input type="file" id="accountsFileInput" accept=".enc">
          </div>
          <div style="flex: 1;">
            <label>Contraseña</label>
            <input type="password" id="accountsPasswordInput" placeholder="Contraseña de descifrado">
          </div>
          <div>
            <button id="accountsLoadBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/Welcome/528726.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
              Cargar y mostrar
            </button>
          </div>
        </div>
        <div id="accountsLoadStatus" class="muted" style="margin-top: 12px;"></div>

      <div id="accountsStats"></div>
      <div id="accountsFilters"></div>
      <div id="accountsList" class="wallet-card-grid"></div>
    `;

    // Evento para usar archivo guardado
    var useStoredBtn = document.getElementById('accountsUseStoredBtn');
    var statusEl = document.getElementById('accountsLoadStatus');
    var fileInput = document.getElementById('accountsFileInput');
    var passwordInput = document.getElementById('accountsPasswordInput');
    var loadBtn = document.getElementById('accountsLoadBtn');

    if (useStoredBtn) {
      useStoredBtn.onclick = async function() {
        var password = passwordInput.value;
        if (!password) {
          if (statusEl) { statusEl.textContent = '⚠️ Ingresá la contraseña'; statusEl.style.color = '#ffd966'; }
          return;
        }
        if (statusEl) { statusEl.textContent = '🔓 Descifrando archivo guardado...'; statusEl.style.color = '#ffd966'; }
        var success = await loadFromStoredFile(password);
        if (!success && statusEl) {
          statusEl.textContent = '❌ Contraseña incorrecta. Probá con otro archivo.';
          statusEl.style.color = '#f28b82';
        }
      };
    }

    if (loadBtn) {
      loadBtn.onclick = async function() {
        var file = fileInput.files[0];
        var password = passwordInput.value;
        if (!file) { if (statusEl) statusEl.textContent = '⚠️ Seleccioná un archivo'; return; }
        if (!password) { if (statusEl) statusEl.textContent = '⚠️ Ingresá la contraseña'; return; }
        if (statusEl) { statusEl.textContent = '🔓 Descifrando archivo...'; statusEl.style.color = '#ffd966'; }
        var success = await loadFromFile(file, password, true);
        if (success && statusEl) {
          statusEl.textContent = '✅ Archivo cargado correctamente';
          statusEl.style.color = '#a7f3d0';
          fileInput.value = '';
          passwordInput.value = '';
        } else if (statusEl) {
          statusEl.textContent = '❌ Error al descifrar. Verificá la contraseña o el archivo.';
          statusEl.style.color = '#f28b82';
        }
      };
    }

    var openWizardBtn = document.getElementById('openWizardBtn');
    if (openWizardBtn && !openWizardBtn.__wired) {
      openWizardBtn.__wired = true;
      openWizardBtn.addEventListener('click', function() {
        openWizardModal();
      });
    }
  }

  // =======================================================================
  // 8. MODAL DEL ASISTENTE
  // =======================================================================
  function openWizardModal() {
    var existingModal = document.getElementById('accountsWizardModal');
    if (existingModal) {
      existingModal.hidden = false;
      return;
    }

    var modal = document.createElement('div');
    modal.id = 'accountsWizardModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'wizardTitle');
    modal.hidden = false;

    modal.innerHTML = `
      <div class="modal__backdrop" data-close="1"></div>
      <div class="modal__dialog" style="max-width: 800px; width: 90%;">
        <div class="modal__header">
          <h3 id="wizardTitle" style="display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/2604904.png" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
            Asistente de cuentas
          </h3>
          <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>
        </div>
        <div class="modal__body" style="max-height: 70vh; overflow-y: auto;">
          
          <div style="background: #0a0c10; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <img src="assets/icons/welcome/733266.png" width="28" height="28" alt="" style="filter: brightness(0.9); object-fit: contain;">
              <div>
                <strong style="color: #a7f3d0;">Tus datos están seguros</strong>
                <p class="muted" style="margin: 4px 0 0;">Todo el proceso ocurre en tu navegador y tu PC. No hay servidores, no hay bases de datos externas. <strong>Ningún dato sale de tu computadora.</strong></p>
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/welcome/102619.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              PASO 1: Descargar plantilla
            </h4>
            <p class="muted" style="margin-bottom: 12px;">Completá solo lo que quieras. Todos los campos son opcionales excepto el ID. Si no te sentís seguro, no cargues contraseñas.</p>
            <button id="wizardDownloadTemplate" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
              <img src="assets/icons/welcome/563464.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
              Descargar plantilla Excel
            </button>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/welcome/102620.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              PASO 2: Subir Excel → Generar JSON
            </h4>
            <p class="muted" style="margin-bottom: 12px;">Convertí tu Excel a JSON. Se guardará en tu PC.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
              <input type="file" id="wizardExcelFile" accept=".xlsx,.xls" style="flex: 2;">
              <button id="wizardExcelToJson" class="btn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/welcome/102609.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Generar JSON
              </button>
            </div>
            <div id="wizardStep2Status" class="muted" style="margin-top: 8px;"></div>
          </div>        

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/welcome/1770705.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              PASO 3: Enriquecer con API (opcional)
            </h4>
            <p class="muted" style="margin-bottom: 12px;">Usa las API Keys que ya tenés guardadas en la Bóveda. Consulta automáticamente: nombre de cuenta, AP, fecha creación, expansiones.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
              <input type="file" id="wizardJsonFile" accept=".json" style="flex: 2;">
              <button id="wizardEnrich" class="btn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/welcome/102449.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Enriquecer con GW2 API
              </button>
            </div>
            <div id="wizardStep3Status" class="muted" style="margin-top: 8px;"></div>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/welcome/544515.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              PASO 4: Cifrar para usar en el panel
            </h4>
            <p class="muted" style="margin-bottom: 12px;">Creá el archivo .enc que podés cargar en el panel. <strong>Recordá la contraseña, la vas a necesitar.</strong></p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
              <input type="file" id="wizardEncryptFile" accept=".json" style="flex: 2;">
              <input type="password" id="wizardPassword" placeholder="Contraseña" style="flex: 1;">
              <button id="wizardEncrypt" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/welcome/733266.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Crear archivo .enc
              </button>
            </div>
            <div id="wizardStep4Status" class="muted" style="margin-top: 8px;"></div>
          </div>

          <hr style="border-color: #2a2c35; margin: 16px 0;">

          <div>
            <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
              <img src="assets/icons/welcome/102353.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              ¿Ya tenés tu archivo .enc?
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              <button id="wizardCloseAndLoad" class="btn" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/welcome/528726.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Ir al panel para cargarlo
              </button>
              <button id="wizardClose" class="btn btn--ghost" style="display: flex; align-items: center; gap: 6px;">
                <img src="assets/icons/welcome/156107.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
      if (e.target.getAttribute('data-close') === '1') {
        modal.hidden = true;
      }
    });

    document.getElementById('wizardClose')?.addEventListener('click', function() {
      modal.hidden = true;
    });

    document.getElementById('wizardCloseAndLoad')?.addEventListener('click', function() {
      modal.hidden = true;
      render();
    });

    document.getElementById('wizardDownloadTemplate')?.addEventListener('click', function() {
      generateExcelTemplate();
    });

    document.getElementById('wizardExcelToJson')?.addEventListener('click', async function() {
      var fileInput = document.getElementById('wizardExcelFile');
      var statusDiv = document.getElementById('wizardStep2Status');
      if (!fileInput.files.length) {
        statusDiv.textContent = '⚠️ Seleccioná un archivo Excel primero.';
        statusDiv.style.color = '#ffd966';
        return;
      }
      statusDiv.textContent = '📖 Leyendo archivo...';
      statusDiv.style.color = '#ffd966';
      try {
        var jsonData = await parseExcelToJSON(fileInput.files[0]);
        var jsonString = JSON.stringify(jsonData, null, 2);
        downloadFile(jsonString, 'cuentas.json', 'application/json');
        statusDiv.textContent = '✅ Archivo JSON generado: cuentas.json';
        statusDiv.style.color = '#a7f3d0';
      } catch (err) {
        console.error(err);
        statusDiv.textContent = '❌ Error: ' + err.message;
        statusDiv.style.color = '#f28b82';
      }
    });

    document.getElementById('wizardEnrich')?.addEventListener('click', async function() {
      var fileInput = document.getElementById('wizardJsonFile');
      var statusDiv = document.getElementById('wizardStep3Status');
      if (!fileInput.files.length) {
        statusDiv.textContent = '⚠️ Seleccioná un archivo JSON primero.';
        statusDiv.style.color = '#ffd966';
        return;
      }
      statusDiv.textContent = '🌐 Enriqueciendo datos con GW2 API...';
      statusDiv.style.color = '#ffd966';
      try {
        var fileContent = await readFileAsText(fileInput.files[0]);
        var data = JSON.parse(fileContent);
        var enriched = await enrichWithGW2API(data);
        var enrichedString = JSON.stringify(enriched, null, 2);
        downloadFile(enrichedString, 'cuentas-enriquecidas.json', 'application/json');
        statusDiv.textContent = '✨ Archivo enriquecido: cuentas-enriquecidas.json';
        statusDiv.style.color = '#a7f3d0';
      } catch (err) {
        console.error(err);
        statusDiv.textContent = '❌ Error: ' + err.message;
        statusDiv.style.color = '#f28b82';
      }
    });

    document.getElementById('wizardEncrypt')?.addEventListener('click', function() {
      var fileInput = document.getElementById('wizardEncryptFile');
      var password = document.getElementById('wizardPassword').value;
      var statusDiv = document.getElementById('wizardStep4Status');
      if (!fileInput.files.length) {
        statusDiv.textContent = '⚠️ Seleccioná un archivo JSON primero.';
        statusDiv.style.color = '#ffd966';
        return;
      }
      if (!password) {
        statusDiv.textContent = '⚠️ Ingresá una contraseña.';
        statusDiv.style.color = '#ffd966';
        return;
      }
      statusDiv.textContent = '🔐 Cifrando archivo...';
      statusDiv.style.color = '#ffd966';
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var jsonString = e.target.result;
          var encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
          downloadFile(encrypted, 'gw2-cuentas.enc', 'text/plain');
          statusDiv.textContent = '✅ Archivo cifrado: gw2-cuentas.enc';
          statusDiv.style.color = '#a7f3d0';
          document.getElementById('wizardPassword').value = '';
        } catch (err) {
          statusDiv.textContent = '❌ Error al cifrar: ' + err.message;
          statusDiv.style.color = '#f28b82';
        }
      };
      reader.readAsText(fileInput.files[0]);
    });
  }

  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function readFileAsText(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.onerror = function(e) { reject(new Error('Error al leer el archivo')); };
      reader.readAsText(file);
    });
  }

  function generateExcelTemplate() {
    var columns = [
      'id', 'nombre', 'email', 'password', 'gmailPassword', 'apiKey',
      'twitch_user', 'twitch_email', 'twitch_password', 'geforce_linked', 'notas', 'tags'
    ];
    var data = [columns];
    var example = [
      'mi_cuenta_1', 'Mi cuenta principal', 'usuario@ejemplo.com', '', '',
      'ABCD-1234-EFGH-5678', 'miusuario', 'miusuario@twitch.com', '', 'TRUE', 'Cuenta principal con todas las expansiones', 'main,full'
    ];
    data.push(example);
    
    var wsData = [data];
    var ws = XLSX.utils.aoa_to_sheet(wsData[0]);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuentas');
    XLSX.writeFile(wb, 'plantilla_cuentas.xlsx');
    window.toast('success', 'Plantilla descargada: plantilla_cuentas.xlsx', { ttl: 2000 });
  }

  function parseExcelToJSON(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = new Uint8Array(e.target.result);
          var workbook = XLSX.read(data, { type: 'array' });
          var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(firstSheet);
          
          if (!rows.length) {
            reject(new Error('El archivo Excel está vacío'));
            return;
          }
          
          var accounts = rows.map(function(row, idx) {
            var account = {
              id: row.id || ('cuenta_' + (idx + 1)),
              name: row.nombre || row.name || '',
              login: {
                email: row.email || '',
                password: row.password || '',
                gmailPassword: row.gmailPassword || ''
              },
              services: {
                twitch: { 
                  linked: !!(row.twitch_user), 
                  username: row.twitch_user || null,
                  email: row.twitch_email || null,
                  password: row.twitch_password || null
                },
                geforceNow: { linked: row.geforce_linked === 'TRUE' || row.geforce_linked === true }
              },
              apiKey: row.apiKey ? { value: row.apiKey } : null,
              notes: row.notas || '',
              tags: row.tags ? row.tags.split(',').map(function(t) { return t.trim(); }) : []
            };
            return account;
          });
          
          resolve({ version: 1, lastUpdated: new Date().toISOString().split('T')[0], accounts: accounts });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function() { reject(new Error('Error al leer el archivo')); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function enrichWithGW2API(data) {
    var accounts = data.accounts || [];
    var token = window.__GN__?.getSelectedToken?.() || null;
    
    for (var i = 0; i < accounts.length; i++) {
      var acc = accounts[i];
      var apiKey = acc.apiKey?.value || acc.apiKey;
      if (!apiKey) continue;
      
      try {
        var accountInfo = await fetch('https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(apiKey));
        if (accountInfo.ok) {
          var info = await accountInfo.json();
          acc.gw2 = acc.gw2 || {};
          acc.gw2.accountName = info.name;
          acc.gw2.created = info.created;
          acc.gw2.achievementPoints = info.achievement_points;
          acc.gw2.characterSlots = info.slots;
          acc.gw2.bagSlots = info.bag_slots;
          acc.gw2.bankSlots = info.bank_slots;
          acc.gw2.materialStorage = info.material_storage;
        }
        
        var homeNodes = await fetch('https://api.guildwars2.com/v2/account/home/nodes?access_token=' + encodeURIComponent(apiKey));
        if (homeNodes.ok) {
          var nodes = await homeNodes.json();
          acc.expansions = acc.expansions || {};
          if (nodes.some(function(n) { return n.includes('hot') || n.includes('heart_of_thorns'); })) acc.expansions.heartOfThorns = true;
          if (nodes.some(function(n) { return n.includes('pof') || n.includes('path_of_fire'); })) acc.expansions.pathOfFire = true;
          if (nodes.some(function(n) { return n.includes('eod') || n.includes('end_of_dragons'); })) acc.expansions.endOfDragons = true;
          if (nodes.some(function(n) { return n.includes('soto') || n.includes('secrets_of_the_obscure'); })) acc.expansions.secretsOfTheObscure = true;
          if (nodes.some(function(n) { return n.includes('janthir') || n.includes('janthir_wilds'); })) acc.expansions.janthirWilds = true;
        }
        
        console.log(LOG, 'Enriquecida cuenta:', acc.name || acc.id);
      } catch (e) {
        console.warn(LOG, 'Error enriqueciendo cuenta', acc.name || acc.id, e);
      }
    }
    
    data.lastUpdated = new Date().toISOString().split('T')[0];
    return data;
  }

  // =======================================================================
  // 9. RENDERIZADO PRINCIPAL
  // =======================================================================
  function render() {
    if (!state.active) return;

    var hasData = state.data && state.data.accounts && state.data.accounts.length;

    if (!hasData) {
      renderLoadForm();
    } else {
      var body = document.querySelector('#accountsPanel .panel__body');
      if (body) {
        body.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <div class="muted">📁 Archivo: <strong>${esc(state.fileName)}</strong></div>
            <button id="accountsChangeFileBtn" class="btn btn--ghost btn--xs" style="display: inline-flex; align-items: center; gap: 4px;">
              <img src="assets/icons/Welcome/102353.png" width="14" height="14" alt="" style="filter: brightness(0.9);">
              Cambiar archivo
            </button>
          </div>
          <div id="accountsStats"></div>
          <div id="accountsFilters"></div>
          <div id="accountsList" class="wallet-card-grid"></div>
        `;
        
        var changeBtn = document.getElementById('accountsChangeFileBtn');
        if (changeBtn && !changeBtn.__wired) {
          changeBtn.__wired = true;
          changeBtn.addEventListener('click', function() {
            state.data = null;
            state.encryptedData = null;
            state.fileName = null;
            state.passwordHash = null;
            clearLastFileInfo();
            render();
          });
        }
      }
      renderList();
    }
  }

  // =======================================================================
  // 10. INICIALIZACIÓN DEL PANEL
  // =======================================================================
  function ensurePanel() {
    var host = document.getElementById('accountsPanel');
    if (host) return host;

    host = document.createElement('section');
    host.id = 'accountsPanel';
    host.className = 'panel col-main';
    host.setAttribute('hidden', '');

    host.innerHTML = '' +
      '<h2 class="panel__title"><img src="' + CONFIG.ICONS.account + '" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> Panel de Cuentas</h2>' +
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
  // 11. CICLO DE VIDA
  // =======================================================================
  async function activate() {
    console.log(LOG, '🚀 activate() llamado');
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    render();
  }

  function deactivate() {
    state.active = false;
    var panel = document.getElementById('accountsPanel');
    if (panel) panel.setAttribute('hidden', '');
  }

  // =======================================================================
  // 12. API PÚBLICA
  // =======================================================================
  var Accounts = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      state.inited = true;
      console.info(LOG, 'ready v1.9.0 — Iconos separados para títulos de secciones, GeForce Now con imagen');
    },
    activate: activate,
    deactivate: deactivate,
    Route: {
      path: 'account/accounts',
      mount: activate,
      unmount: deactivate
    },
    _debug: function() {
      return {
        active: state.active,
        hasData: !!(state.data && state.data.accounts),
        fileName: state.fileName,
        accountsCount: state.data ? (state.data.accounts || []).length : 0,
        view: state.view
      };
    }
  };

  root.Accounts = Accounts;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Accounts.initOnce);
  } else {
    Accounts.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);