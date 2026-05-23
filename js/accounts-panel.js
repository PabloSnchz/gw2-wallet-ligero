/*!
 * js/accounts-panel.js — Panel de Cuentas (cifrado local)
 * v2.0.0 (2026-05-03) — Rediseño "Profile Card" premium
 *
 * MEJORAS v2.0.0:
 * - Diseño "Profile Card" con jerarquía visual 3 zonas
 * - Ícono del tipo de cuenta con glow del color (main=oro, alter=violeta, f2p=azul)
 * - Grid 2 columnas para credenciales (contraseña, gmail, twitch, geforce)
 * - Expansiones siempre visibles con barra de progreso
 * - Hover con sombra del color del tipo de cuenta
 * - Tags como badges con borde de color
 * - Vista compacta (toggle) con 4 líneas por cuenta
 * - Separadores con gradiente horizontal
 * - Footer con acciones rápidas (copiar email, copiar API key)
 * - Toda la funcionalidad previa intacta
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
    
    TYPE_ICONS: {
      main: 'assets/icons/Cuentas/547827.png',
      alter: 'assets/icons/Cuentas/157375.png',
      f2p: 'assets/icons/Cuentas/102538.png'
    },
    
    TYPE_COLORS: {
      main: '#ffd966',
      alter: '#b19cd9',
      f2p: '#7bc2ff'
    },
    
    TYPE_BG: {
      main: 'rgba(255,217,102,0.08)',
      alter: 'rgba(177,156,217,0.08)',
      f2p: 'rgba(123,194,255,0.08)'
    },

    TAG_ICONS: {
      farming: 'assets/icons/Cuentas/157332.png',
      keys: 'assets/icons/Cuentas/1716669.png',
      weekly: 'assets/icons/Cuentas/240679.png',
      taxi: 'assets/icons/Cuentas/102438.png',
      main: 'assets/icons/Cuentas/547827.png',
      alter: 'assets/icons/Cuentas/157375.png',
      f2p: 'assets/icons/Cuentas/102538.png'
    },
    
    CARD_ICONS: {
      email: 'assets/icons/Cuentas/gmail.png',
      lock: 'assets/icons/Cuentas/733265.png',
      gw2id: 'assets/icons/Cuentas/358353.png',
      calendar: 'assets/icons/Cuentas/156407.png',
      trophy: 'assets/icons/Cuentas/156403.png',
      character: 'assets/icons/Cuentas/156409.png',
      bag: 'assets/icons/Cuentas/157098.png',
      bank: 'assets/icons/Cuentas/156670.png',
      material: 'assets/icons/Cuentas/255373.png',
      medal: 'assets/icons/Cuentas/157085.png',
      sword: 'assets/icons/Cuentas/1424243.png',
      note: 'assets/icons/Cuentas/1228929.png',
      chevronRight: 'assets/icons/Cuentas/528716.png',
      chevronDown: 'assets/icons/Cuentas/528717.png',
      eye: 'assets/icons/Welcome/528726.png',
      copy: 'assets/icons/Welcome/155911.png',
      apiKey: 'assets/icons/Cuentas/155048.png',
      gmailPass: 'assets/icons/Cuentas/155048.png'
    },
    
    ICONS: {
      account: 'assets/icons/Cuentas/GW2free.png',
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
    inited: false, active: false,
    data: null, encryptedData: null, fileName: null, passwordHash: null,
    filters: { search: '', type: 'all', tag: 'all' },
    view: 'cards',
    compact: false,
    showPasswords: {}, showTwitchPasswords: {},
    expandedAccounts: {}
  };

  // =======================================================================
  // 2. UTILIDADES
  // =======================================================================
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; if (m === '"') return '&quot;'; return '&#39;'; }); }
  function fmtNumber(n) { return Number(n || 0).toLocaleString('es-AR'); }
  function formatDate(dateStr) { if (!dateStr) return '—'; try { var d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-AR'); } catch (e) { return dateStr; } }
  function formatAgeDays(createdStr) { if (!createdStr) return '—'; try { return Math.floor((Date.now() - new Date(createdStr)) / 86400000) + ' días'; } catch (e) { return '—'; } }
  function hexToRGBA(hex, alpha) { try { var h = String(hex).replace(/^#/,''); if (h.length === 3) h = h.split('').map(function(c){return c+c}).join(''); var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16); return 'rgba('+r+','+g+','+b+','+alpha+')'; } catch(_){ return 'rgba(255,255,255,'+alpha+')'; } }
  function getAccountTypeTags(acc) { return (acc.tags && Array.isArray(acc.tags)) ? acc.tags : []; }
  
  function getAccountType(acc) {
    var tags = getAccountTypeTags(acc);
    if (tags.indexOf('main') !== -1) return 'main';
    if (tags.indexOf('alter') !== -1) return 'alter';
    if (tags.indexOf('f2p') !== -1) return 'f2p';
    return null;
  }
  
  function getTypeColor(acc) {
    var t = getAccountType(acc);
    return CONFIG.TYPE_COLORS[t] || '#FFFFFF';
  }
  
  function getBorderColor(acc) { return hexToRGBA(getTypeColor(acc), 0.5); }
  function getHoverShadow(acc) { var c = hexToRGBA(getTypeColor(acc), 0.15); return '0 10px 28px rgba(0,0,0,0.45), 0 6px 18px ' + c + ', 0 0 16px ' + c; }
  function getIconGlow(acc) { return '0 0 0 3px ' + hexToRGBA(getTypeColor(acc), 0.32) + ', 0 0 18px ' + hexToRGBA(getTypeColor(acc), 0.22); }
  function getTagBadgeStyle(acc) { return 'border-color:' + hexToRGBA(getTypeColor(acc), 0.35) + ';background:' + hexToRGBA(getTypeColor(acc), 0.08) + ';color:' + getTypeColor(acc) + ';'; }

  function getExpansionIcon(expKey, isOwned) {
    var icon = CONFIG.ICONS.expansions[expKey];
    if (!icon) return '';
    var style = isOwned ? '' : 'style="filter: grayscale(1); opacity: 0.35;"';
    return '<img src="' + icon + '" width="32" height="32" title="' + expKey + '" ' + style + ' loading="lazy" style="flex-shrink:0;border-radius:6px;transition:all 0.2s ease;">';
  }

  function simpleHash(str) { var h = 0; for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h.toString(16); }

  function copyToClipboard(text, fieldName) {
    try { navigator.clipboard.writeText(text); window.toast('success', fieldName + ' copiado', { ttl: 1500 }); }
    catch (e) { window.prompt('Copiar ' + fieldName + ':', text); }
  }

  // =======================================================================
  // 3. PERSISTENCIA
  // =======================================================================
  function saveLastFileInfo(fn, ed) { try { localStorage.setItem(CONFIG.STORAGE_LAST_FILE_KEY, JSON.stringify({ name: fn, data: ed, timestamp: Date.now() })); } catch(_){} }
  function getLastFileInfo() { try { var s = localStorage.getItem(CONFIG.STORAGE_LAST_FILE_KEY); return s ? JSON.parse(s) : null; } catch(_) { return null; } }
  function clearLastFileInfo() { try { localStorage.removeItem(CONFIG.STORAGE_LAST_FILE_KEY); } catch(_){} }

  function syncAccountTagsToKeys(accounts) {
    if (!accounts || !Array.isArray(accounts)) return;
    try {
      var keys = JSON.parse(localStorage.getItem('gw2_keys') || '[]');
      if (!keys.length) return;
      var changed = false;
      accounts.forEach(function(acc) {
        var apiKey = acc.apiKey?.value || acc.apiKey; if (!apiKey) return;
        var tags = acc.tags || [];
        var tipo = tags.includes('main') ? 'main' : tags.includes('alter') ? 'alter' : tags.includes('f2p') ? 'f2p' : null;
        if (!tipo) return;
        var found = keys.find(function(k) { return k.value === apiKey; });
        if (found && found.tag !== tipo) { found.tag = tipo; changed = true; }
      });
      if (changed) localStorage.setItem('gw2_keys', JSON.stringify(keys));
    } catch(_) {}
  }

  // =======================================================================
  // 4. CARGA Y DESCRIPCIÓN
  // =======================================================================
  async function loadAndDecryptFile(file, password) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var decrypted = CryptoJS.AES.decrypt(e.target.result, password).toString(CryptoJS.enc.Utf8);
          if (!decrypted) { reject(new Error('Contraseña incorrecta o archivo corrupto')); return; }
          resolve({ data: JSON.parse(decrypted), encrypted: e.target.result });
        } catch(err) { reject(err); }
      };
      reader.onerror = function() { reject(new Error('Error al leer el archivo')); };
      reader.readAsText(file);
    });
  }

  async function loadFromFile(file, password, rememberFile) {
    try {
      var result = await loadAndDecryptFile(file, password);
      state.data = result.data; state.encryptedData = result.encrypted; state.fileName = file.name;
      state.passwordHash = simpleHash(password); state.showPasswords = {}; state.showTwitchPasswords = {}; state.expandedAccounts = {};
      if (rememberFile !== false) saveLastFileInfo(file.name, result.encrypted);
      render(); window.toast('success', 'Cuentas cargadas', { ttl: 2000 }); return true;
    } catch(err) { window.toast('error', err.message || 'Error al cargar', { ttl: 3000 }); return false; }
  }

  async function loadFromStoredFile(password) {
    var lastFile = getLastFileInfo(); if (!lastFile || !lastFile.data) return false;
    try {
      var decrypted = CryptoJS.AES.decrypt(lastFile.data, password).toString(CryptoJS.enc.Utf8);
      if (!decrypted) return false;
      var data = JSON.parse(decrypted);
      state.data = data; state.encryptedData = lastFile.data; state.fileName = lastFile.name;
      state.passwordHash = simpleHash(password); state.showPasswords = {}; state.showTwitchPasswords = {}; state.expandedAccounts = {};
      syncAccountTagsToKeys(data.accounts);
      render(); window.toast('success', 'Cuentas cargadas', { ttl: 1500 }); return true;
    } catch(err) { return false; }
  }

  // =======================================================================
  // 5. FILTRADO
  // =======================================================================
  function getFilteredAccounts() {
    if (!state.data || !state.data.accounts) return [];
    return (state.data.accounts).filter(function(acc) {
      if (state.filters.search) { var q = state.filters.search.toLowerCase(); if (!(acc.name||'').toLowerCase().includes(q) && !(acc.login?.email||'').toLowerCase().includes(q) && !(acc.gw2?.accountName||'').toLowerCase().includes(q)) return false; }
      if (state.filters.type !== 'all') { var t = getAccountTypeTags(acc); if (state.filters.type === 'main' && t.indexOf('main')===-1) return false; if (state.filters.type === 'alter' && t.indexOf('alter')===-1) return false; if (state.filters.type === 'f2p' && t.indexOf('f2p')===-1) return false; }
      if (state.filters.tag !== 'all' && getAccountTypeTags(acc).indexOf(state.filters.tag)===-1) return false;
      return true;
    });
  }

  // =======================================================================
  // 6. RENDER — PROFILE CARD v2.0.0
  // =======================================================================
  function renderAccountCard(acc) {
    var login = acc.login || {}, gw2 = acc.gw2 || {}, expansions = acc.expansions || {}, services = acc.services || {};
    var tags = getAccountTypeTags(acc);
    var showPass = state.showPasswords[acc.id] || false;
    var showTwitchPass = state.showTwitchPasswords[acc.id] || false;
    var typeIcon = CONFIG.TYPE_ICONS[getAccountType(acc)] || CONFIG.DEFAULT_ICON;
    var typeColor = getTypeColor(acc);
    var bLeft = getBorderColor(acc);
    var hShadow = getHoverShadow(acc);
    var iGlow = getIconGlow(acc);
    
    // Ícono decorativo aleatorio (cat tag) - Cambio 1
    var DECORATIVE_ICONS = [
      'assets/icons/Cuentas/1770678.png','assets/icons/Cuentas/1770679.png','assets/icons/Cuentas/1770680.png',
      'assets/icons/Cuentas/1770681.png','assets/icons/Cuentas/1770682.png','assets/icons/Cuentas/1770683.png',
      'assets/icons/Cuentas/1770684.png','assets/icons/Cuentas/1770685.png','assets/icons/Cuentas/1770686.png'
    ];
    
    var displayIcon = DECORATIVE_ICONS[Math.floor(Math.random() * DECORATIVE_ICONS.length)];
    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';
    var twitchDisplay = showTwitchPass ? esc(services.twitch?.password || '') : '••••••••';

    // Expansiones con progreso
    var expOrder = ['core','heroic','heartOfThorns','pathOfFire','endOfDragons','secretsOfTheObscure','janthirWilds','visionsOfEternity'];
    var expOwned = 0, expTotal = 0;
    var expIcons = expOrder.map(function(key) {
      if (expansions[key] === undefined) return '';
      expTotal++;
      if (expansions[key]) expOwned++;
      return getExpansionIcon(key, expansions[key]);
    }).filter(Boolean).join('');
    var expPercent = expTotal > 0 ? Math.round((expOwned / expTotal) * 100) : 0;

    // Tags - solo iconitos con tooltip (Cambio 2)
    var tagIconsHtml = '';
    var tagOrder = ['main','alter','f2p','farming','keys','weekly','taxi'];
    for (var i = 0; i < tagOrder.length; i++) {
      var tag = tagOrder[i];
      if (tags.indexOf(tag) !== -1) {
        var tIcon = CONFIG.TAG_ICONS[tag] || '';
        if (tIcon) {
          tagIconsHtml += '<img src="' + tIcon + '" width="18" height="18" alt="' + tag + '" title="' + tag + '" style="filter:brightness(0.9);cursor:help;">';
        }
      }
    }

    // Servicios - siempre visibles con íconos de estado (Cambio 4 v2)
    var twitchLinked = services.twitch && services.twitch.linked;
    var geforceLinked = services.geforceNow && services.geforceNow.linked;
    var twitchPassDisplay = showTwitchPass ? esc(services.twitch?.password || '') : '••••••••';

    var twitchHtml = '<div style="overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<img src="' + CONFIG.ICONS.twitch + '" width="16" height="16" style="flex-shrink:0;">' +
        '<span style="font-size:0.8rem;">Twitch</span>' +
        '<img src="assets/icons/Welcome/' + (twitchLinked ? '156108' : '156107') + '.png" width="14" height="14" style="flex-shrink:0;" title="' + (twitchLinked ? 'Vinculado' : 'No vinculado') + '">' +
      '</div>';
    if (twitchLinked) {
      var tu = services.twitch?.username || '';
      var te = services.twitch?.email || '';
      if (tu) twitchHtml += '<div style="font-size:0.7rem;color:#9aa2b8;cursor:pointer;margin-top:2px;" data-copy="' + esc(tu) + '" data-field="Usuario Twitch">@' + esc(tu) + '</div>';
      if (te) twitchHtml += '<div style="font-size:0.68rem;color:#6a7080;cursor:pointer;" data-copy="' + esc(te) + '" data-field="Email Twitch">' + esc(te) + '</div>';
      if (services.twitch?.password) {
        twitchHtml += '<div style="display:flex;align-items:center;gap:4px;margin-top:2px;"><span style="font-family:monospace;font-size:0.68rem;cursor:pointer;" data-copy="' + esc(services.twitch.password) + '" data-field="Pass Twitch">' + twitchPassDisplay + '</span><button class="btn-ghost toggle-twitch-password" data-id="' + acc.id + '" style="padding:0 2px;display:inline-flex;"><img src="' + CONFIG.CARD_ICONS.eye + '" width="10" height="10"></button></div>';
      }
    }
    twitchHtml += '</div>';

    var geforceHtml = '<div style="overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<img src="' + CONFIG.ICONS.geforce + '" width="16" height="16" style="flex-shrink:0;">' +
        '<span style="font-size:0.8rem;">GeForce</span>' +
        '<img src="assets/icons/Welcome/' + (geforceLinked ? '156108' : '156107') + '.png" width="14" height="14" style="flex-shrink:0;" title="' + (geforceLinked ? 'Vinculado' : 'No vinculado') + '">' +
      '</div></div>';

    // Notas
    var notesHtml = acc.notes ? '<div style="display:flex;align-items:flex-start;gap:6px;font-size:0.78rem;color:#9aa2b8;margin-top:4px;"><img src="' + CONFIG.CARD_ICONS.note + '" width="14" height="14" style="flex-shrink:0;margin-top:1px;"><span style="overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + esc(acc.notes) + '</span></div>' : '';

    // API Key
    var apiKeyValue = acc.apiKey?.value || acc.apiKey || '';

    if (state.compact) {
      // VISTA COMPACTA
      return '<article class="card account-card" style="border-left:3px solid ' + bLeft + ';cursor:pointer;" data-account-id="' + acc.id + '" data-toggle-expand-name>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:#0f1116;display:flex;align-items:center;justify-content:center;box-shadow:' + iGlow + ';flex-shrink:0;"><img src="' + displayIcon + '" width="24" height="24" style="filter:brightness(0.9);"></div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:0.9rem;color:#e0e4ed;">' + esc(acc.name || 'Cuenta') + '</div>' +
            '<div style="font-size:0.7rem;color:#9aa2b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(login.email || '—') + '</div>' +
            '<div style="font-size:0.65rem;color:#6a7080;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">' +
              '<span>🆔 ' + esc(gw2.accountName || '—') + '</span>' +
              '<span>🏆 ' + fmtNumber(gw2.achievementPoints) + ' AP</span>' +
              '<span>📦 ' + expOwned + '/' + expTotal + ' exp</span>' +
              (services.twitch?.linked ? '<span>🎮✅</span>' : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0;">' + tagIconsHtml + '</div>' +
        '</div></article>';
    }

    // VISTA COMPLETA (PROFILE CARD)
    return '<article class="card account-card" style="border-left:3px solid ' + bLeft + ';position:relative;overflow:hidden;">' +
      // Overlay decorativo
      '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle, ' + hexToRGBA(typeColor, 0.10) + ' 0%, transparent 70%);pointer-events:none;"></div>' +
      
      '<div style="padding:16px;">' +
        // HEADER: ícono + nombre + email
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">' +
          '<div style="width:52px;height:52px;border-radius:14px;background:#0f1116;display:flex;align-items:center;justify-content:center;box-shadow:' + iGlow + ';flex-shrink:0;"><img src="' + displayIcon + '" width="34" height="34" style="filter:brightness(0.9);"></div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;font-size:1.05rem;color:#e0e4ed;cursor:pointer;" data-account-id="' + acc.id + '" data-toggle-expand-name>' + esc(acc.name || 'Cuenta') + '</div>' +
            '<div style="font-size:0.82rem;color:' + typeColor + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</div>' +
            (tagIconsHtml ? '<div style="display:flex;align-items:center;gap:5px;margin-top:4px;">' + tagIconsHtml + '</div>' : '') +
          '</div>' +
        '</div>' +
        
        // GRID 2 COLUMNAS
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:0.8rem;">' +
          // Columna izquierda
          '<div style="display:flex;align-items:center;gap:6px;"><img src="' + CONFIG.CARD_ICONS.gw2id + '" width="16" height="16"><span>' + esc(gw2.accountName || '—') + '</span></div>' +
          '<div style="display:flex;align-items:center;gap:6px;"><img src="' + CONFIG.CARD_ICONS.trophy + '" width="16" height="16"><strong>' + fmtNumber(gw2.achievementPoints) + '</strong> AP</div>' +
          '<div style="display:flex;align-items:center;gap:6px;"><img src="' + CONFIG.CARD_ICONS.calendar + '" width="16" height="16"><span>' + formatDate(gw2.created) + '</span></div>' +
          '<div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;color:#9aa2b8;">(' + formatAgeDays(gw2.created) + ')</div>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;"><img src="' + CONFIG.CARD_ICONS.lock + '" width="16" height="16"><span style="font-family:monospace;cursor:pointer;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span><button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding:0 2px;display:inline-flex;"><img src="' + CONFIG.CARD_ICONS.eye + '" width="12" height="12"></button></div>' +
          (login.gmailPassword ? '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;"><img src="' + CONFIG.CARD_ICONS.gmailPass + '" width="16" height="16"><span style="font-family:monospace;cursor:pointer;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailDisplay + '</span></div>' : '<div></div>') +
        '</div>' +

        // SEPARADOR (arriba de Twitch/GeForce)
        '<div style="height:1px;background:linear-gradient(90deg, transparent, ' + hexToRGBA(typeColor, 0.25) + ', transparent);margin:8px 0;"></div>' +

        // TWITCH + GEFORCE (fuera del grid, en su propia sección)
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:0.8rem;">' +
          '<div style="min-height:52px;">' + twitchHtml + '</div>' +
          '<div style="min-height:52px;">' + geforceHtml + '</div>' +
        '</div>' +

        // SEPARADOR (arriba de Expansiones)
        '<div style="height:1px;background:linear-gradient(90deg, transparent, ' + hexToRGBA(typeColor, 0.25) + ', transparent);margin:8px 0;"></div>' +

        // EXPANSIONES COLAPSABLE (Cambio 3)
        (expIcons ? '<div style="margin-top:0;padding-top:4px;">' +
          '<div style="display:flex;align-items:center;gap:8px;cursor:pointer;" data-toggle-section="' + acc.id + '" data-section="expansions">' +
            '<img src="' + (state.expandedAccounts[acc.id]?.expansions ? CONFIG.CARD_ICONS.chevronDown : CONFIG.CARD_ICONS.chevronRight) + '" width="12" height="12" style="flex-shrink:0;">' +
            '<span style="font-weight:600;font-size:0.8rem;">Expansiones</span>' +
            '<span style="font-size:0.7rem;color:' + typeColor + ';">' + expOwned + '/' + expTotal + '</span>' +
          '</div>' +
          '<div id="section-' + acc.id + '-expansions" style="' + (state.expandedAccounts[acc.id]?.expansions ? '' : 'display:none;') + 'margin-top:6px;padding-left:20px;">' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + expIcons + '</div>' +
            '<div style="height:4px;background:#2a2c35;border-radius:2px;margin-top:6px;overflow:hidden;"><div style="width:' + expPercent + '%;height:100%;background:linear-gradient(90deg, ' + typeColor + ', ' + hexToRGBA(typeColor, 0.6) + ');border-radius:2px;transition:width 0.3s ease;"></div></div>' +
          '</div>' +
        '</div>' : '') +

        // GW2 AVANZADO
        '<div style="font-size:0.72rem;color:#9aa2b8;display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">' +
          '<span><img src="' + CONFIG.CARD_ICONS.character + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.characterSlots || '—') + ' chars</span>' +
          '<span><img src="' + CONFIG.CARD_ICONS.bag + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.bagSlots || '—') + ' bags</span>' +
          '<span><img src="' + CONFIG.CARD_ICONS.bank + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.bankSlots || '—') + ' bancos</span>' +
          '<span><img src="' + CONFIG.CARD_ICONS.material + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.materialStorage || '—') + ' mat</span>' +
          '<span><img src="' + CONFIG.CARD_ICONS.medal + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.legendaries || 0) + '</span>' +
        '</div>' +

        // NOTAS
        notesHtml +

        // SEPARADOR + FOOTER
        '<div style="height:1px;background:linear-gradient(90deg, transparent, ' + hexToRGBA(typeColor, 0.25) + ', transparent);margin-top:8px;"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">' +
          '<button class="btn btn--ghost btn--xs" data-copy-btn="' + esc(login.email || '') + '" data-field="Email" style="display:inline-flex;align-items:center;gap:4px;font-size:0.65rem;"><img src="' + CONFIG.CARD_ICONS.copy + '" width="12" height="12"> Email</button>' +
          (apiKeyValue ? '<button class="btn btn--ghost btn--xs" data-copy-btn="' + esc(apiKeyValue) + '" data-field="API Key" style="display:inline-flex;align-items:center;gap:4px;font-size:0.65rem;"><img src="' + CONFIG.CARD_ICONS.apiKey + '" width="12" height="12"> API Key</button>' : '') +
        '</div>' +
      '</div></article>';
  }

  function renderCards(accounts) {
    var container = document.getElementById('accountsList');
    if (!container) return;
    container.className = 'wallet-card-grid';
    container.style.display = 'grid';
    container.style.overflow = '';
    container.style.width = '';
    container.innerHTML = accounts.map(renderAccountCard).join('');

    // Wire: toggle password GW2
    document.querySelectorAll('.toggle-password').forEach(function(btn) { if (btn.__wired) return; btn.__wired = true;
      btn.addEventListener('click', function(e) { e.stopPropagation(); state.showPasswords[btn.getAttribute('data-id')] = !state.showPasswords[btn.getAttribute('data-id')]; renderList(); }); });
    // Wire: toggle password Twitch
    document.querySelectorAll('.toggle-twitch-password').forEach(function(btn) { if (btn.__wiredTwitch) return; btn.__wiredTwitch = true;
      btn.addEventListener('click', function(e) { e.stopPropagation(); state.showTwitchPasswords[btn.getAttribute('data-id')] = !state.showTwitchPasswords[btn.getAttribute('data-id')]; renderList(); }); });
    // Wire: toggle secciones colapsables (expansiones)
    document.querySelectorAll('[data-toggle-section]').forEach(function(el) { if (el.__wiredSection) return; el.__wiredSection = true;
      el.addEventListener('click', function(e) { e.stopPropagation(); var id = el.getAttribute('data-toggle-section'); var section = el.getAttribute('data-section'); var current = state.expandedAccounts[id] || {}; current[section] = !current[section]; state.expandedAccounts[id] = current; renderList(); }); });
    // Wire: expandir al click en nombre
    document.querySelectorAll('[data-toggle-expand-name]').forEach(function(el) { if (el.__wiredName) return; el.__wiredName = true;
      el.addEventListener('click', function(e) { e.stopPropagation(); var id = el.getAttribute('data-account-id'); state.view = state.view === 'cards' ? 'table' : 'cards'; renderList(); }); });
    // Wire: copiar al portapapeles
    document.querySelectorAll('[data-copy]').forEach(function(el) { if (el.__wiredCopy) return; el.__wiredCopy = true;
      el.addEventListener('click', function(e) { e.stopPropagation(); var t = el.getAttribute('data-copy'), f = el.getAttribute('data-field')||'Texto'; if (t && t!=='—') copyToClipboard(t, f); else window.toast('info', 'No hay ' + f + ' para copiar', {ttl:1500}); }); });
    // Wire: botones copy del footer
    document.querySelectorAll('[data-copy-btn]').forEach(function(el) { if (el.__wiredCopyBtn) return; el.__wiredCopyBtn = true;
      el.addEventListener('click', function(e) { e.stopPropagation(); var t = el.getAttribute('data-copy-btn'), f = el.getAttribute('data-field')||'Texto'; if (t && t!=='—') copyToClipboard(t, f); }); });
  }

  // =======================================================================
  // 7. VISTA TABLA (rediseñada)
  // =======================================================================
  function renderTableRow(acc) {
    var login = acc.login || {}, gw2 = acc.gw2 || {};
    var tags = getAccountTypeTags(acc);
    var bLeft = getBorderColor(acc);
    var showPass = state.showPasswords[acc.id] || false;
    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';

    var DECORATIVE_ICONS = [
      'assets/icons/Cuentas/1770678.png','assets/icons/Cuentas/1770679.png','assets/icons/Cuentas/1770680.png',
      'assets/icons/Cuentas/1770681.png','assets/icons/Cuentas/1770682.png','assets/icons/Cuentas/1770683.png',
      'assets/icons/Cuentas/1770684.png','assets/icons/Cuentas/1770685.png','assets/icons/Cuentas/1770686.png'
    ];
    var randIcon = DECORATIVE_ICONS[Math.floor(Math.random() * DECORATIVE_ICONS.length)];

    var tagIconsHtml = '';
    var tagOrder = ['main','alter','f2p','farming','keys','weekly','taxi'];
    for (var i = 0; i < tagOrder.length; i++) {
      var tag = tagOrder[i];
      if (tags.indexOf(tag) !== -1) {
        var tIcon = CONFIG.TAG_ICONS[tag] || '';
        if (tIcon) tagIconsHtml += '<img src="' + tIcon + '" width="18" height="18" alt="' + tag + '" title="' + tag + '" style="filter:brightness(0.9);margin-right:5px;cursor:help;vertical-align:middle;">';
      }
    }

    var apColor = gw2.achievementPoints > 20000 ? getTypeColor(acc) : '#cfd2d8';

    return '<tr data-id="' + acc.id + '" style="border-left:3px solid ' + bLeft + ';">' +
      '<td style="width:40px;text-align:center;"><img src="' + randIcon + '" width="28" height="28" alt="" style="border-radius:8px;filter:brightness(0.9);vertical-align:middle;"></td>' +
      '<td style="min-width:140px;"><strong style="font-size:0.9rem;">' + esc(acc.name || 'Cuenta') + '</strong></td>' +
      '<td style="min-width:220px;line-height:1.6;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><img src="' + CONFIG.CARD_ICONS.email + '" width="14" height="14"><span style="cursor:pointer;text-decoration:underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><img src="' + CONFIG.CARD_ICONS.lock + '" width="14" height="14"><span style="font-family:monospace;font-size:0.8rem;cursor:pointer;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span><button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding:0 3px;display:inline-flex;"><img src="' + CONFIG.CARD_ICONS.eye + '" width="12" height="12"></button></div>' +
        (login.gmailPassword ? '<div style="display:flex;align-items:center;gap:6px;"><img src="' + CONFIG.CARD_ICONS.gmailPass + '" width="14" height="14"><span style="font-family:monospace;font-size:0.8rem;cursor:pointer;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailDisplay + '</span></div>' : '') +
      '</td>' +
      '<td style="min-width:130px;"><img src="' + CONFIG.CARD_ICONS.gw2id + '" width="14" height="14" style="vertical-align:middle;"> ' + esc(gw2.accountName || '—') + '</td>' +
      '<td class="right"><img src="' + CONFIG.CARD_ICONS.trophy + '" width="14" height="14" style="vertical-align:middle;"> <strong style="color:' + apColor + ';">' + fmtNumber(gw2.achievementPoints) + '</strong></td>' +
      '<td class="right"><img src="' + CONFIG.CARD_ICONS.medal + '" width="14" height="14" style="vertical-align:middle;"> ' + (gw2.legendaries || 0) + '</td>' +
      '<td style="text-align:center;">' + tagIconsHtml + '</td>' +
    '</tr>';
  }

  function renderTable(accounts) {
    var container = document.getElementById('accountsList');
    if (!container) return;
    container.className = '';
    container.style.display = 'block';
    container.style.overflow = 'visible';
    container.style.width = '100%';
    container.innerHTML = '<div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.08);width:100%;">' +
      '<table style="width:100%;min-width:1000px;border-collapse:separate;border-spacing:0;table-layout:fixed;">' +
      '<thead>' +
      '<tr style="background:#0a0c10;">' +
        '<th style="width:48px;padding:11px 8px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;font-weight:700;"></th>' +
        '<th style="width:16%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:left;font-weight:700;">Cuenta</th>' +
        '<th style="width:30%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:left;font-weight:700;">Credenciales</th>' +
        '<th style="width:18%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:left;font-weight:700;">GW2 ID</th>' +
        '<th style="width:10%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:right;font-weight:700;">AP</th>' +
        '<th style="width:8%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:right;font-weight:700;">Leg.</th>' +
        '<th style="width:18%;padding:11px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.6px;color:#b4bad0;border-bottom:2px solid #2a2c35;text-align:center;font-weight:700;">Tags</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + accounts.map(renderTableRow).join('') + '</tbody>' +
      '</table></div>';

    document.querySelectorAll('.toggle-password').forEach(function(btn) { if(btn.__wired) return; btn.__wired=true; btn.addEventListener('click',function(e){ e.stopPropagation(); state.showPasswords[btn.getAttribute('data-id')]=!state.showPasswords[btn.getAttribute('data-id')]; renderList(); }); });
    document.querySelectorAll('[data-copy]').forEach(function(el) { if(el.__wiredCopy) return; el.__wiredCopy=true; el.addEventListener('click',function(e){ e.stopPropagation(); var t=el.getAttribute('data-copy'),f=el.getAttribute('data-field')||'Texto'; if(t&&t!=='—') copyToClipboard(t,f); }); });

    var styleEl = document.getElementById('accountsTableHover');
    if (styleEl) styleEl.remove();
    styleEl = document.createElement('style');
    styleEl.id = 'accountsTableHover';
    styleEl.textContent = '#accountsList table tbody tr:hover { background: #1a1d28; } #accountsList table tbody td { padding: 10px 12px; border-bottom: 1px solid #1f2026; vertical-align: middle; color:#cfd2d8; } #accountsList table tbody tr:nth-child(even) { background: #0c0e14; } #accountsList table tbody tr:nth-child(even):hover { background: #1a1d28; }';
    document.head.appendChild(styleEl);
  }

  function renderStats(accounts) {
    var c = document.getElementById('accountsStats'); if(!c) return; if(!accounts.length){ c.innerHTML=''; return; }
    var total = accounts.length;
    var mains = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('main')!==-1;}).length;
    var alters = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('alter')!==-1;}).length;
    var f2ps = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('f2p')!==-1;}).length;
    var ks = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('keys')!==-1;}).length;
    var farm = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('farming')!==-1;}).length;
    var wk = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('weekly')!==-1;}).length;
    var tx = accounts.filter(function(a){return getAccountTypeTags(a).indexOf('taxi')!==-1;}).length;
    c.innerHTML = '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;padding:12px 16px;background:#1a1e2a;border-radius:12px;">'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/1770683.png" width="20" height="20"><strong>Total:</strong> '+total+' cuentas</div><span style="color:#c5c5c5;margin:0 -6px;">|</span>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/547827.png" width="20" height="20"><strong>Principales:</strong> '+mains+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/157375.png" width="20" height="20"><strong>Alternativas:</strong> '+alters+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/102538.png" width="20" height="20"><strong>F2P:</strong> '+f2ps+'</div><span style="color:#c5c5c5;margin:0 -6px;">|</span>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/1716669.png" width="20" height="20"><strong>Llaves:</strong> '+ks+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/157332.png" width="20" height="20"><strong>Farming:</strong> '+farm+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/240679.png" width="20" height="20"><strong>Weekly:</strong> '+wk+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Cuentas/102438.png" width="20" height="20"><strong>Taxi:</strong> '+tx+'</div></div>';
  }

  function renderFilters(accounts) {
    var c = document.getElementById('accountsFilters'); if(!c) return; if(!accounts.length){ c.innerHTML=''; return; }
    var allTags = new Set(); accounts.forEach(function(a){ getAccountTypeTags(a).forEach(function(t){ allTags.add(t); }); });
    var tagOpts = Array.from(allTags).sort().map(function(t){ return '<option value="'+t+'"'+(state.filters.tag===t?' selected':'')+'>'+t.charAt(0).toUpperCase()+t.slice(1)+'</option>'; }).join('');
    c.innerHTML = '<div class="chips"><div class="chip"><input id="accountsSearch" type="text" placeholder="Buscar cuenta..." value="'+esc(state.filters.search)+'"/></div>'+
      '<div class="chip"><select id="accountsTypeFilter"><option value="all"'+(state.filters.type==='all'?' selected':'')+'>Todos los tipos</option><option value="main"'+(state.filters.type==='main'?' selected':'')+'>Principales</option><option value="alter"'+(state.filters.type==='alter'?' selected':'')+'>Alternativas</option><option value="f2p"'+(state.filters.type==='f2p'?' selected':'')+'>Free to Play</option></select></div>'+
      (tagOpts?'<div class="chip"><select id="accountsTagFilter"><option value="all">Todos los tags</option>'+tagOpts+'</select></div>':'')+
      '<div class="filters-actions"><button id="accountsClearFilters" class="btn">Limpiar</button>'+
      '<button id="accountsToggleCompact" class="btn btn--ghost" style="margin-right:6px;">'+(state.compact?'📋 Detalle':'📦 Compacto')+'</button>'+
      '<button id="accountsToggleView" class="btn btn--ghost">'+(state.view==='cards'?'📋 Vista tabla':'🃏 Vista tarjetas')+'</button></div></div>';
    document.getElementById('accountsSearch')?.addEventListener('input',function(e){ state.filters.search=e.target.value; renderList(); });
    document.getElementById('accountsTypeFilter')?.addEventListener('change',function(e){ state.filters.type=e.target.value; renderList(); });
    var tf = document.getElementById('accountsTagFilter'); if(tf) tf.addEventListener('change',function(e){ state.filters.tag=e.target.value; renderList(); });
    document.getElementById('accountsClearFilters')?.addEventListener('click',function(){ state.filters={search:'',type:'all',tag:'all'}; var s=document.getElementById('accountsSearch'); if(s) s.value=''; ['accountsTypeFilter','accountsTagFilter'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value='all'; }); renderList(); });
    var tv = document.getElementById('accountsToggleView'); if(tv&&!tv.__wired){ tv.__wired=true; tv.addEventListener('click',function(){ state.view=state.view==='cards'?'table':'cards'; renderList(); }); }
    var tc = document.getElementById('accountsToggleCompact'); if(tc&&!tc.__wired){ tc.__wired=true; tc.addEventListener('click',function(){ state.compact=!state.compact; renderList(); }); }
  }

  function renderList() {
    var activeElement = document.activeElement;
    var activeId = activeElement ? activeElement.id : null;
    var cursorPos = (activeElement && activeElement.selectionStart !== undefined) ? activeElement.selectionStart : null;
    
    var accounts = getFilteredAccounts();
    renderStats(accounts);
    renderFilters(accounts);
    if(state.view=='table') renderTable(accounts);
    else renderCards(accounts);
    
    if (activeId === 'accountsSearch') {
      var newInput = document.getElementById('accountsSearch');
      if (newInput && document.activeElement !== newInput) {
        newInput.focus();
        if (cursorPos !== null) {
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  }

  // =======================================================================
  // 8. FORMULARIO DE CARGA + ASISTENTE (mantenido)
  // =======================================================================
  function renderLoadForm() {
      var body = document.querySelector('#accountsPanel .panel__body');
      if (!body) return;

      var lastFile = getLastFileInfo();
      var hasStoredFile = !!lastFile;

      body.innerHTML = `
        <!-- DISEÑO A 2 COLUMNAS -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          
          <!-- COLUMNA IZQUIERDA: Asistente -->
          <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="assets/icons/Welcome/2604904.png" width="40" height="40" alt="" style="filter: brightness(0.9);">
              <div>
                <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: #e0e4ed;">Asistente de cuentas</h3>
                <div class="muted" style="font-size: 0.8rem;">Guía paso a paso para crear tu archivo seguro</div>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: #b4bad0; display: flex; flex-direction: column; gap: 10px; line-height: 1.5;">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <img src="assets/icons/Welcome/733266.png" width="18" height="18" alt="" style="margin-top: 3px; flex-shrink: 0;">
              <span>Creá tu archivo <code style="background:#1a1c24;padding:1px 6px;border-radius:4px;">.enc</code> desde una plantilla Excel. El asistente te guía en <strong>4 pasos simples</strong>.</span>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <img src="assets/icons/Welcome/544515.png" width="18" height="18" alt="" style="margin-top: 3px; flex-shrink: 0;">
              <span>El cifrado AES se aplica <strong>antes de guardar</strong> el archivo. Sin tu contraseña, nadie puede leerlo.</span>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <img src="assets/icons/Cuentas/GW2free.png" width="18" height="18" alt="" style="margin-top: 3px; flex-shrink: 0;">
              <span><strong>Todo ocurre en tu navegador.</strong> No hay servidores, ni bases de datos, ni terceros involucrados. Tus datos nunca salen de tu PC.</span>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px; margin-top: 4px; padding-top: 10px; border-top: 1px solid #1e2028;">
              <img src="assets/icons/Welcome/discord.png" width="18" height="18" alt="" style="margin-top: 3px; flex-shrink: 0;">
              <span>¿Dudas? Somos la <strong>Comunidad Gato Negro</strong>, desarrolladores reconocidos dentro de Guild Wars 2. Buscanos en Discord o YouTube como <strong>@pablinschez</strong>.</span>
            </div>
          </div>
            <button id="openWizardBtn" class="btn btn--accent" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; font-weight: 600; font-size: 0.9rem; margin-top: auto;">
              <img src="assets/icons/Welcome/155911.png" width="20" height="20" alt="" style="filter: brightness(0.9);">
              Crear nuevo archivo
            </button>
          </div>

          <!-- COLUMNA DERECHA: Acceso a cuentas -->
          <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="assets/icons/Welcome/733266.png" width="36" height="36" alt="" style="filter: brightness(0.9);">
              <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: #e0e4ed;">Acceso a cuentas</h3>
            </div>
            
            ${hasStoredFile ? `
            <div style="background: #0a0c10; border-radius: 10px; padding: 14px; border: 1px solid #1e2028;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <img src="assets/icons/Welcome/102353.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
                <span style="font-weight: 600; font-size: 0.85rem;">Último archivo:</span>
                <span style="color: #ffd966;">${esc(lastFile.name)}</span>
              </div>
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="password" id="accountsPasswordInput" placeholder="Contraseña de descifrado" style="flex: 1; min-width: 140px;">
                <button id="accountsUseStoredBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                  <img src="assets/icons/Welcome/834002.png" width="16" height="16" alt="" style="filter: brightness(0.9);">
                  Usar archivo guardado
                </button>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1; height: 1px; background: #2a2c35;"></div>
              <span class="muted" style="font-size: 0.75rem; white-space: nowrap;">o cargá un archivo nuevo</span>
              <div style="flex: 1; height: 1px; background: #2a2c35;"></div>
            </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" id="accountsFileButton" class="btn" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 0.85rem; width: 100%; justify-content: center;">
                <img src="assets/icons/Welcome/102619.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
                <span id="accountsFileName">Seleccionar archivo .enc</span>
              </button>
              <input type="file" id="accountsFileInput" accept=".enc" style="display: none;">
            </div>
              ${!hasStoredFile ? `
              <div style="display: flex; align-items: center; gap: 10px; background: #0a0c10; border-radius: 8px; padding: 8px 12px; border: 1px solid #1e2028;">
                <img src="assets/icons/Cuentas/733265.png" width="20" height="20" alt="" style="filter: brightness(0.9); flex-shrink: 0;">
                <input type="password" id="accountsPasswordInput" placeholder="Contraseña de descifrado" style="flex: 1; min-width: 0;">
              </div>
              ` : ''}
              <button id="accountsLoadBtn" class="btn btn--accent" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; font-weight: 600; font-size: 0.9rem;">
                <img src="assets/icons/Welcome/528726.png" width="18" height="18" alt="" style="filter: brightness(0.9);">
                Cargar y mostrar
              </button>
            </div>
            <div id="accountsLoadStatus" class="muted" style="font-size: 0.8rem; text-align: center; min-height: 20px;"></div>
          </div>

        </div>
      `;

      // Eventos (sin cambios)
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

    // NUEVO: Botón estilizado para selector de archivo
    var fileButton = document.getElementById('accountsFileButton');
    if (fileButton && fileInput) {
      fileButton.addEventListener('click', function() {
        fileInput.click();
      });
      fileInput.addEventListener('change', function() {
        var fileName = fileInput.files[0] ? fileInput.files[0].name : 'Seleccionar archivo .enc';
        var nameSpan = document.getElementById('accountsFileName');
        if (nameSpan) {
          nameSpan.textContent = fileName;
          nameSpan.style.color = '#a0ffc8';
        }
      });
    }
  }

  // =======================================================================
  // 9. MODAL ASISTENTE (mantenido)
  // =======================================================================
  function openWizardModal() {
    if(typeof Analytics!=='undefined') Analytics.openAccountWizard();
    var ex = document.getElementById('accountsWizardModal'); if(ex){ex.hidden=false;return;}
    var m = document.createElement('div'); m.id='accountsWizardModal'; m.className='modal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.hidden=false;
    m.innerHTML = '<div class="modal__backdrop" data-close="1"></div><div class="modal__dialog" style="max-width:800px;width:90%;"><div class="modal__header"><h3 id="wizardTitle"><img src="assets/icons/Welcome/2604904.png" width="28" height="28">Asistente de cuentas</h3><button type="button" class="modal__close" data-close="1">✕</button></div><div class="modal__body" style="max-height:70vh;overflow-y:auto;">'+
      '<div style="background:#0a0c10;border-radius:8px;padding:12px;margin-bottom:20px;"><div style="display:flex;gap:12px;"><img src="assets/icons/Welcome/733266.png" width="28" height="28"><div><strong style="color:#a7f3d0;">Tus datos están seguros</strong><p class="muted" style="margin:4px 0 0;">Todo el proceso ocurre en tu navegador. <strong>Ningún dato sale de tu computadora.</strong></p></div></div></div>'+
      '<div style="margin-bottom:24px;"><h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Welcome/102619.png" width="20" height="20">PASO 1: Descargar plantilla</h4><p class="muted">Completá solo lo que quieras.</p><button id="wizardDownloadTemplate" class="btn btn--accent"><img src="assets/icons/Welcome/563464.png" width="16" height="16">Descargar plantilla Excel</button></div>'+
      '<div style="margin-bottom:24px;"><h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Welcome/102620.png" width="20" height="20">PASO 2: Subir Excel → Generar JSON</h4><div style="display:flex;gap:12px;"><input type="file" id="wizardExcelFile" accept=".xlsx,.xls" style="flex:2;"><button id="wizardExcelToJson" class="btn"><img src="assets/icons/Welcome/102609.png" width="16" height="16">Generar JSON</button></div><div id="wizardStep2Status" class="muted" style="margin-top:8px;"></div></div>'+
      '<div style="margin-bottom:24px;"><h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Welcome/1770705.png" width="20" height="20">PASO 3: Enriquecer con API</h4><div style="display:flex;gap:12px;"><input type="file" id="wizardJsonFile" accept=".json" style="flex:2;"><button id="wizardEnrich" class="btn"><img src="assets/icons/Welcome/102449.png" width="16" height="16">Enriquecer con GW2 API</button></div><div id="wizardStep3Status" class="muted" style="margin-top:8px;"></div></div>'+
      '<div style="margin-bottom:24px;"><h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Welcome/544515.png" width="20" height="20">PASO 4: Cifrar</h4><div style="display:flex;gap:12px;align-items:flex-end;"><input type="file" id="wizardEncryptFile" accept=".json" style="flex:2;"><input type="password" id="wizardPassword" placeholder="Contraseña" style="flex:1;"><button id="wizardEncrypt" class="btn btn--accent"><img src="assets/icons/Welcome/733266.png" width="16" height="16">Crear archivo .enc</button></div><div id="wizardStep4Status" class="muted" style="margin-top:8px;"></div></div>'+
      '<hr style="border-color:#2a2c35;"><div><h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/icons/Welcome/102353.png" width="20" height="20">¿Ya tenés tu archivo .enc?</h4><div style="display:flex;gap:12px;"><button id="wizardCloseAndLoad" class="btn"><img src="assets/icons/Welcome/528726.png" width="16" height="16">Ir al panel para cargarlo</button><button id="wizardClose" class="btn btn--ghost"><img src="assets/icons/Welcome/156107.png" width="16" height="16">Cerrar</button></div></div>'+
    '</div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(e){ if(e.target.getAttribute('data-close')==='1') m.hidden=true; });
    document.getElementById('wizardClose')?.addEventListener('click',function(){m.hidden=true;});
    document.getElementById('wizardCloseAndLoad')?.addEventListener('click',function(){m.hidden=true;render();});
    document.getElementById('wizardDownloadTemplate')?.addEventListener('click',generateExcelTemplate);
    document.getElementById('wizardExcelToJson')?.addEventListener('click',async function(){var fi=document.getElementById('wizardExcelFile'),sd=document.getElementById('wizardStep2Status');if(!fi.files.length){sd.textContent='⚠️ Seleccioná un archivo Excel.';return;} sd.textContent='📖 Leyendo...';try{var jd=await parseExcelToJSON(fi.files[0]);downloadFile(JSON.stringify(jd,null,2),'cuentas.json','application/json');sd.textContent='✅ cuentas.json generado';sd.style.color='#a7f3d0';}catch(e){sd.textContent='❌ '+e.message;sd.style.color='#f28b82';}});
    document.getElementById('wizardEnrich')?.addEventListener('click',async function(){var fi=document.getElementById('wizardJsonFile'),sd=document.getElementById('wizardStep3Status');if(!fi.files.length){sd.textContent='⚠️ Seleccioná un archivo JSON.';return;} sd.textContent='🌐 Enriqueciendo...';try{var fc=await readFileAsText(fi.files[0]),data=JSON.parse(fc),enriched=await enrichWithGW2API(data);downloadFile(JSON.stringify(enriched,null,2),'cuentas-enriquecidas.json','application/json');sd.textContent='✅ cuentas-enriquecidas.json';sd.style.color='#a7f3d0';}catch(e){sd.textContent='❌ '+e.message;sd.style.color='#f28b82';}});
    document.getElementById('wizardEncrypt')?.addEventListener('click',function(){var fi=document.getElementById('wizardEncryptFile'),pw=document.getElementById('wizardPassword').value,sd=document.getElementById('wizardStep4Status');if(!fi.files.length){sd.textContent='⚠️ Seleccioná un archivo JSON.';return;}if(!pw){sd.textContent='⚠️ Ingresá una contraseña.';return;}sd.textContent='🔐 Cifrando...';var r=new FileReader();r.onload=function(e){try{var enc=CryptoJS.AES.encrypt(e.target.result,pw).toString();downloadFile(enc,'gw2-cuentas.enc','text/plain');if(typeof Analytics!=='undefined')Analytics.encryptAccountsFile();sd.textContent='✅ gw2-cuentas.enc';sd.style.color='#a7f3d0';document.getElementById('wizardPassword').value='';}catch(err){sd.textContent='❌ '+err.message;sd.style.color='#f28b82';}};r.readAsText(fi.files[0]);});
  }

  function downloadFile(content, filename, mimeType) { var blob = new Blob([content],{type:mimeType}), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
  function readFileAsText(file) { return new Promise(function(resolve, reject) { var reader = new FileReader(); reader.onload = function(e) { resolve(e.target.result); }; reader.onerror = function() { reject(new Error('Error al leer el archivo')); }; reader.readAsText(file); }); }

  function generateExcelTemplate() {
    if (typeof Analytics !== 'undefined') Analytics.downloadExcelTemplate();
    var columns = ['id','nombre','email','password','gmailPassword','apiKey','twitch_user','twitch_email','twitch_password','geforce_linked','notas','tags'];
    var data = [columns, ['mi_cuenta_1','Mi cuenta principal','usuario@ejemplo.com','','','ABCD-1234-EFGH-5678','miusuario','miusuario@twitch.com','','TRUE','Cuenta principal con todas las expansiones','main,full']];
    var ws = XLSX.utils.aoa_to_sheet(data), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuentas'); XLSX.writeFile(wb, 'plantilla_cuentas.xlsx');
    window.toast('success', 'Plantilla descargada', { ttl: 2000 });
  }

  function parseExcelToJSON(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = new Uint8Array(e.target.result), workbook = XLSX.read(data,{type:'array'}), rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          if (!rows.length) { reject(new Error('El archivo Excel está vacío')); return; }
          resolve({ version: 1, lastUpdated: new Date().toISOString().split('T')[0], accounts: rows.map(function(row, idx) { return { id: row.id || ('cuenta_' + (idx+1)), name: row.nombre || row.name || '', login: { email: row.email || '', password: row.password || '', gmailPassword: row.gmailPassword || '' }, services: { twitch: { linked: !!(row.twitch_user), username: row.twitch_user || null, email: row.twitch_email || null, password: row.twitch_password || null }, geforceNow: { linked: row.geforce_linked === 'TRUE' || row.geforce_linked === true } }, apiKey: row.apiKey ? { value: row.apiKey } : null, notes: row.notas || '', tags: row.tags ? row.tags.split(',').map(function(t) { return t.trim(); }) : [] }; })});
        } catch(err) { reject(err); }
      };
      reader.onerror = function() { reject(new Error('Error al leer el archivo')); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function enrichWithGW2API(data) {
    var accounts = data.accounts || [];
    for (var i = 0; i < accounts.length; i++) {
      var acc = accounts[i], apiKey = acc.apiKey?.value || acc.apiKey; if (!apiKey) continue;
      try {
        var info = await (await fetch('https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(apiKey))).json();
        acc.gw2 = acc.gw2 || {}; acc.gw2.accountName = info.name; acc.gw2.created = info.created; acc.gw2.achievementPoints = info.achievement_points; acc.gw2.characterSlots = info.slots; acc.gw2.bagSlots = info.bag_slots; acc.gw2.bankSlots = info.bank_slots; acc.gw2.materialStorage = info.material_storage;
        var nodes = await (await fetch('https://api.guildwars2.com/v2/account/home/nodes?access_token=' + encodeURIComponent(apiKey))).json();
        acc.expansions = acc.expansions || {};
        if (nodes.some(function(n) { return n.includes('hot') || n.includes('heart_of_thorns'); })) acc.expansions.heartOfThorns = true;
        if (nodes.some(function(n) { return n.includes('pof') || n.includes('path_of_fire'); })) acc.expansions.pathOfFire = true;
        if (nodes.some(function(n) { return n.includes('eod') || n.includes('end_of_dragons'); })) acc.expansions.endOfDragons = true;
        if (nodes.some(function(n) { return n.includes('soto') || n.includes('secrets_of_the_obscure'); })) acc.expansions.secretsOfTheObscure = true;
        if (nodes.some(function(n) { return n.includes('janthir') || n.includes('janthir_wilds'); })) acc.expansions.janthirWilds = true;
      } catch(e) {}
    }
    data.lastUpdated = new Date().toISOString().split('T')[0];
    if (typeof Analytics !== 'undefined') Analytics.enrichWithAPI();
    return data;
  }

  // =======================================================================
  // 10. RENDER + CICLO DE VIDA
  // =======================================================================
  function render() {
    if (!state.active) return;
    if (!state.data || !state.data.accounts || !state.data.accounts.length) { renderLoadForm(); return; }
    var body = document.querySelector('#accountsPanel .panel__body');
    if (body) {
      body.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;"><div class="muted" style="display:flex;align-items:center;gap:6px;"><img src="assets/icons/Welcome/102353.png" width="16" height="16"><strong>' + esc(state.fileName) + '</strong></div><button id="accountsChangeFileBtn" class="btn btn--ghost btn--xs" style="display:inline-flex;align-items:center;gap:4px;"><img src="assets/icons/Welcome/102353.png" width="12" height="12">Cambiar archivo</button></div><div id="accountsStats"></div><div id="accountsFilters"></div><div id="accountsList" class="wallet-card-grid"></div>';
      var cb = document.getElementById('accountsChangeFileBtn'); if (cb && !cb.__wired) { cb.__wired = true; cb.addEventListener('click', function() { state.data = null; state.encryptedData = null; state.fileName = null; state.passwordHash = null; clearLastFileInfo(); state.view = 'cards'; state.compact = false; render(); }); }
    }
    renderList();
  }

  function ensurePanel() {
    var host = document.getElementById('accountsPanel'); if (host) return host;
    host = document.createElement('section'); host.id = 'accountsPanel'; host.className = 'panel col-main'; host.setAttribute('hidden','');
    host.innerHTML = '<h2 class="panel__title"><img src="' + CONFIG.ICONS.account + '" alt="" width="32" height="32" style="vertical-align:middle;margin-right:8px;">Panel de Cuentas</h2><div class="panel__body"></div>';
    var anchor = document.getElementById('walletPanel'); if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor); else document.body.appendChild(host);
    return host;
  }

  async function activate() { state.active = true; ensurePanel().removeAttribute('hidden'); render(); }
  function deactivate() { state.active = false; var p = document.getElementById('accountsPanel'); if (p) p.setAttribute('hidden',''); }

  var Accounts = { initOnce: function() { if (state.inited) return; ensurePanel(); state.inited = true; console.info(LOG, 'ready v2.0.0 — Profile Card premium'); }, activate: activate, deactivate: deactivate, Route: { path: 'account/accounts', mount: activate, unmount: deactivate }, _debug: function() { return { active: state.active, hasData: !!(state.data && state.data.accounts), fileName: state.fileName, accountsCount: state.data ? (state.data.accounts || []).length : 0, view: state.view, compact: state.compact }; } };
  root.Accounts = Accounts;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Accounts.initOnce); else Accounts.initOnce();
})(typeof window !== 'undefined' ? window : this);