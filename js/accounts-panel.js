/*!
 * js/accounts-panel.js — Panel de Cuentas (cifrado local)
 * v1.2.1 (2026-03-26)
 *
 * CORRECCIONES v1.2.1:
 * - Click en nombre de cuenta expande/colapsa info sensible
 * - Todos los iconos de cuenta usan GW2free.png (estándar)
 * - Iconos de Twitch y GeForce Now con rutas correctas
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
    // Icono único para todas las cuentas (el que pidió)
    ACCOUNT_ICON: 'assets/icons/Cuentas/GW2free.png',
    // Tipos de cuenta con sus imágenes (para badges, no para el icono principal)
    ACCOUNT_TYPE_ICONS: {
      main: 'assets/icons/Cuentas/star.png',
      alter: 'assets/icons/Cuentas/alter.png',
      farming: 'assets/icons/Cuentas/farming.png',
      keys: 'assets/icons/Cuentas/key.png',
      f2p: 'assets/icons/Cuentas/f2p.png',
      default: 'assets/icons/Cuentas/GW2free.png'
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
    view: 'cards', // 'cards' o 'table'
    showPasswords: {},
    expandedAccounts: {} // Para mostrar/ocultar datos sensibles al hacer click en nombre
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
    if (account.login && account.login.email) {
      var email = account.login.email.toLowerCase();
      if (email.includes('alter') || email.includes('farm') || /^gw2play\d+/.test(email)) {
        if (tags.indexOf('alter') === -1) tags.push('alter');
        if (tags.indexOf('farming') === -1) tags.push('farming');
      }
    }
    if (account.name && account.name.toLowerCase().includes('principal')) {
      if (tags.indexOf('main') === -1) tags.push('main');
    }
    if (account.tags && account.tags.includes('f2p')) tags.push('f2p');
    if (account.tags && account.tags.includes('keys')) tags.push('keys');
    return tags;
  }

  function getMainAccountType(account) {
    var tags = getAccountTypeTags(account);
    if (tags.includes('main')) return 'main';
    if (tags.includes('alter')) return 'alter';
    if (tags.includes('farming')) return 'farming';
    if (tags.includes('keys')) return 'keys';
    if (tags.includes('f2p')) return 'f2p';
    return 'default';
  }

  function getAccountTypeIcon(account) {
    var type = getMainAccountType(account);
    return CONFIG.ACCOUNT_TYPE_ICONS[type] || CONFIG.ACCOUNT_TYPE_ICONS.default;
  }

  function isMainAccount(account) {
    var tags = getAccountTypeTags(account);
    return tags.includes('main') || (account.name && account.name.toLowerCase().includes('principal'));
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
        if (filters.type === 'main' && !tags.includes('main') && !isMainAccount(acc)) return false;
        if (filters.type === 'alter' && !tags.includes('alter')) return false;
        if (filters.type === 'farming' && !tags.includes('farming')) return false;
        if (filters.type === 'keys' && !tags.includes('keys')) return false;
      }
      if (filters.tag !== 'all') {
        var accTags = getAccountTypeTags(acc);
        if (!accTags.includes(filters.tag)) return false;
      }
      return true;
    });
  }

  // =======================================================================
  // 6. RENDERIZADO DE TARJETA (con todas las mejoras)
  // =======================================================================
  function renderAccountCard(acc) {
    var login = acc.login || {};
    var gw2 = acc.gw2 || {};
    var expansions = acc.expansions || {};
    var services = acc.services || {};
    var tags = getAccountTypeTags(acc);
    var isMain = isMainAccount(acc);
    var showPass = state.showPasswords[acc.id] || false;
    var isExpanded = state.expandedAccounts[acc.id] || false;

    // Icono único para todas las cuentas (el que pidió)
    var accountIcon = CONFIG.ACCOUNT_ICON;

    // Badges de tags
    var tagBadges = tags.map(function(t) {
      var icon = t === 'main' ? '⭐' : (t === 'alter' ? '🧪' : (t === 'farming' ? '🌾' : (t === 'keys' ? '🔑' : (t === 'f2p' ? '🆓' : '🏷️'))));
      return '<span class="badge badge--info" style="font-size: 0.7rem; padding: 2px 6px;">' + icon + ' ' + t + '</span>';
    }).join('');

    // Expansiones
    var expOrder = ['core', 'heroic', 'heartOfThorns', 'pathOfFire', 'endOfDragons', 'secretsOfTheObscure', 'janthirWilds', 'visionsOfEternity'];
    var expIcons = [];
    expOrder.forEach(function(key) {
      if (expansions[key] !== undefined) {
        expIcons.push(getExpansionIcon(key, expansions[key]));
      }
    });

    // Servicios con iconos corregidos
    var serviceIcons = [];
    if (services.twitch && services.twitch.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.twitch + '" width="20" height="20" title="Twitch: @' + esc(services.twitch.username || '') + '">');
    }
    if (services.geforceNow && services.geforceNow.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.geforce + '" width="20" height="20" title="GeForce Now vinculado">');
    }

    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailPassDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';

    // Campos colapsables (más info)
    var moreInfoHtml = '';
    if (isExpanded) {
      moreInfoHtml = `
        <div class="wallet-card__more-info" style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #2a2c35;">
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <span><strong>📦 Mochilas:</strong> ${gw2.bagSlots || '—'}</span>
            <span><strong>🏦 Bancos:</strong> ${gw2.bankSlots || '—'}</span>
            <span><strong>🧪 Material:</strong> ${gw2.materialStorage || '—'}</span>
            <span><strong>🎖️ Legendarias:</strong> ${gw2.legendaries || 0}</span>
            ${gw2.level80 !== undefined ? `<span><strong>⚔️ Nivel 80:</strong> ${gw2.level80 ? '✅ Sí' : '❌ No'}</span>` : ''}
          </div>
        </div>
      `;
    }

    return '' +
      '<article class="wallet-card" style="' + (isMain ? 'border-left: 3px solid #ffd966;' : '') + '">' +
        '<div class="wallet-card__top">' +
          '<div class="wallet-card__iconWrap">' +
            '<img src="' + accountIcon + '" width="30" height="30" alt="Cuenta" loading="lazy">' +
          '</div>' +
          '<div class="wallet-card__name" style="font-weight: 700; cursor: pointer;" data-account-id="' + acc.id + '" data-toggle-expand>' + esc(acc.name || 'Cuenta') + '</div>' +
          '<div class="wallet-card__meta" style="justify-content: flex-end;">' + tagBadges + '</div>' +
        '</div>' +

        '<div class="wallet-sep"></div>' +

        '<div class="wallet-card__body">' +
          // Email y contraseñas (clickeables para copiar)
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
            '<div><img src="' + CONFIG.ICONS.gmail + '" width="16" height="16" style="vertical-align: middle;"> <strong>Email:</strong> ' +
              '<span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span>' +
            '</div>' +
            '<div><img src="' + CONFIG.ICONS.lock + '" width="16" height="16" style="vertical-align: middle;"> <strong>Contraseña:</strong> ' +
              '<span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span> ' +
              '<button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding: 2px 4px; font-size: 12px;">👁️</button>' +
            '</div>' +
          '</div>' +

          // Gmail Pass (si existe)
          (login.gmailPassword ? '<div style="margin-top: 6px;"><img src="' + CONFIG.ICONS.googlePass + '" width="16" height="16" style="vertical-align: middle;"> <strong>Gmail Pass:</strong> ' +
            '<span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailPassDisplay + '</span>' +
          '</div>' : '') +

          // GW2 ID, creación, AP
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px;">' +
            '<div><strong>🎮 GW2 ID:</strong> ' + esc(gw2.accountName || '—') + '</div>' +
            '<div><strong>📅 Creación:</strong> ' + formatDate(gw2.created) + ' (' + formatAgeDays(gw2.created) + ')</div>' +
            '<div><strong>🏆 AP:</strong> ' + fmtNumber(gw2.achievementPoints) + '</div>' +
          '</div>' +

          // Expansiones
          '<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center;">' +
            '<strong>📀 Expansiones:</strong> ' + (expIcons.length ? expIcons.join(' ') : '<span class="muted">—</span>') +
          '</div>' +

          // Servicios
          (serviceIcons.length ? '<div style="display: flex; gap: 8px; margin-top: 8px;"><strong>🔌 Servicios:</strong> ' + serviceIcons.join(' ') + '</div>' : '') +

          // API Key
          (acc.apiKey ? '<div style="margin-top: 8px;"><strong>🔑 API Key:</strong> <code>' + esc(acc.apiKey.value || acc.apiKey) + '</code></div>' : '') +

          // Notas
          (acc.notes ? '<div style="margin-top: 8px; color: #a0a0a6;"><strong>📝 Notas:</strong> ' + esc(acc.notes) + '</div>' : '') +

          // Más info (colapsable)
          '<div style="margin-top: 8px;">' +
            '<button class="btn-ghost btn--xs toggle-more-info" data-id="' + acc.id + '" style="font-size: 11px; padding: 2px 6px;">' + (isExpanded ? '📂 Menos info' : '📁 Más info') + '</button>' +
            moreInfoHtml +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderCards(accounts) {
    var container = document.getElementById('accountsList');
    if (!container) return;

    container.className = 'wallet-card-grid';
    container.style.display = 'grid';
    container.innerHTML = accounts.map(renderAccountCard).join('');

    // Toggle password
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

    // Toggle more info
    document.querySelectorAll('.toggle-more-info').forEach(function(btn) {
      if (btn.__wiredMore) return;
      btn.__wiredMore = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        state.expandedAccounts[id] = !state.expandedAccounts[id];
        renderList();
      });
    });

    // Click en nombre para expandir/colapsar info sensible
    document.querySelectorAll('[data-toggle-expand]').forEach(function(el) {
      if (el.__wiredExpand) return;
      el.__wiredExpand = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-account-id');
        state.expandedAccounts[id] = !state.expandedAccounts[id];
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

  // =======================================================================
  // 7. RENDERIZADO DE TABLA
  // =======================================================================
  function renderTableRow(acc) {
    var login = acc.login || {};
    var gw2 = acc.gw2 || {};
    var tags = getAccountTypeTags(acc);
    var accountIcon = CONFIG.ACCOUNT_ICON;
    var isExpanded = state.expandedAccounts[acc.id] || false;

    var showPass = state.showPasswords[acc.id] || false;
    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailPassDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';

    return '' +
      '<tr data-id="' + acc.id + '" style="' + (isMainAccount(acc) ? 'background: rgba(255,217,102,0.08);' : '') + '">' +
        '<td><img src="' + accountIcon + '" width="24" height="24" alt=""><\/td>' +
        '<td>' +
          '<strong style="cursor: pointer;" data-toggle-expand-table data-id="' + acc.id + '">' + esc(acc.name || 'Cuenta') + '</strong>' +
          (isExpanded ? '<div class="muted" style="font-size: 11px; margin-top: 4px;">' + (acc.notes || '') + '</div>' : '') +
        '<\/td>' +
        '<td>' +
          '<div><span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span></div>' +
          '<div class="muted" style="font-size: 11px;">Pass: <span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span> <button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding: 0 4px;">👁️</button></div>' +
          (login.gmailPassword ? '<div class="muted" style="font-size: 11px;">Gmail: <span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailPassDisplay + '</span></div>' : '') +
        '<\/td>' +
        '<td>' + esc(gw2.accountName || '—') + '<\/td>' +
        '<td class="right">' + fmtNumber(gw2.achievementPoints) + '<\/td>' +
        '<td class="right">' + (gw2.legendaries || 0) + '<\/td>' +
        '<td>' + tags.map(function(t) { return '<span class="badge badge--info" style="font-size: 0.6rem;">' + t + '</span>'; }).join(' ') + '<\/td>' +
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

    // Toggle password
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

    // Toggle expand table row
    document.querySelectorAll('[data-toggle-expand-table]').forEach(function(el) {
      if (el.__wiredExpand) return;
      el.__wiredExpand = true;
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = el.getAttribute('data-id');
        state.expandedAccounts[id] = !state.expandedAccounts[id];
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
    var total = accounts.length;
    var mains = accounts.filter(function(a) { return isMainAccount(a); }).length;
    var alters = accounts.filter(function(a) { return getAccountTypeTags(a).includes('alter'); }).length;
    var totalAP = accounts.reduce(function(sum, a) { return sum + (a.gw2 && a.gw2.achievementPoints || 0); }, 0);
    var totalLegendaries = accounts.reduce(function(sum, a) { return sum + (a.gw2 && a.gw2.legendaries || 0); }, 0);
    
    container.innerHTML = '' +
      '<div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px; background: #1a1e2a; border-radius: 12px;">' +
        '<div><strong>📊 Total:</strong> ' + total + ' cuentas</div>' +
        '<div><strong>⭐ Principales:</strong> ' + mains + '</div>' +
        '<div><strong>🧪 Alternativas:</strong> ' + alters + '</div>' +
        '<div><strong>🏆 AP total:</strong> ' + fmtNumber(totalAP) + '</div>' +
        '<div><strong>🎖️ Legendarias:</strong> ' + totalLegendaries + '</div>' +
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
      return '<option value="' + tag + '" ' + (state.filters.tag === tag ? 'selected' : '') + '>' + tag.charAt(0).toUpperCase() + tag.slice(1) + '</option>';
    }).join('');

    container.innerHTML = '' +
      '<div class="chips" aria-label="Filtros de cuentas">' +
        '<div class="chip">' +
          '<input id="accountsSearch" type="text" placeholder="Buscar cuenta..." value="' + esc(state.filters.search) + '"/>' +
        '</div>' +
        '<div class="chip">' +
          '<select id="accountsTypeFilter">' +
            '<option value="all"' + (state.filters.type === 'all' ? ' selected' : '') + '>Todos los tipos</option>' +
            '<option value="main"' + (state.filters.type === 'main' ? ' selected' : '') + '>⭐ Principales</option>' +
            '<option value="alter"' + (state.filters.type === 'alter' ? ' selected' : '') + '>🧪 Alternativas</option>' +
            '<option value="farming"' + (state.filters.type === 'farming' ? ' selected' : '') + '>🌾 Farming</option>' +
            '<option value="keys"' + (state.filters.type === 'keys' ? ' selected' : '') + '>🔑 Llaves</option>' +
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
  // 8. FORMULARIO DE CARGA
  // =======================================================================
  function renderLoadForm() {
    var body = document.querySelector('#accountsPanel .panel__body');
    if (!body) return;

    var lastFile = getLastFileInfo();
    var hasStoredFile = !!lastFile;

    body.innerHTML = `
      <div id="accountsLoadForm" style="background: #1a1e2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2a2c35;">
        <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${CONFIG.ICONS.account}" width="28" height="28" alt="">
          🔐 Acceso a cuentas
        </h3>
        ${hasStoredFile ? `
          <div style="background: #0f1116; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div>
                <strong>📁 Último archivo:</strong> ${esc(lastFile.name)}<br>
                <span class="muted">Ingresá tu contraseña para acceder automáticamente</span>
              </div>
              <button id="accountsUseStoredBtn" class="btn btn--accent">🔓 Usar archivo guardado</button>
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
            <button id="accountsLoadBtn" class="btn btn--accent">🔓 Cargar y mostrar</button>
          </div>
        </div>
        <div id="accountsLoadStatus" class="muted" style="margin-top: 12px;"></div>
      </div>
      <div id="accountsStats"></div>
      <div id="accountsFilters"></div>
      <div id="accountsList" class="wallet-card-grid"></div>
    `;

    var fileInput = document.getElementById('accountsFileInput');
    var passwordInput = document.getElementById('accountsPasswordInput');
    var loadBtn = document.getElementById('accountsLoadBtn');
    var statusEl = document.getElementById('accountsLoadStatus');
    var useStoredBtn = document.getElementById('accountsUseStoredBtn');

    if (useStoredBtn) {
      useStoredBtn.onclick = async function() {
        var password = passwordInput.value;
        if (!password) {
          statusEl.textContent = '⚠️ Ingresá la contraseña';
          statusEl.style.color = '#ffd966';
          return;
        }
        statusEl.textContent = '🔓 Descifrando archivo guardado...';
        statusEl.style.color = '#ffd966';
        
        var success = await loadFromStoredFile(password);
        if (!success) {
          statusEl.textContent = '❌ Contraseña incorrecta. Probá con otro archivo.';
          statusEl.style.color = '#f28b82';
        }
      };
    }

    if (loadBtn) {
      loadBtn.onclick = async function() {
        var file = fileInput.files[0];
        var password = passwordInput.value;

        if (!file) {
          statusEl.textContent = '⚠️ Seleccioná un archivo';
          return;
        }
        if (!password) {
          statusEl.textContent = '⚠️ Ingresá la contraseña';
          return;
        }

        statusEl.textContent = '🔓 Descifrando archivo...';
        statusEl.style.color = '#ffd966';

        var success = await loadFromFile(file, password, true);
        if (success) {
          statusEl.textContent = '✅ Archivo cargado correctamente';
          statusEl.style.color = '#a7f3d0';
          fileInput.value = '';
          passwordInput.value = '';
        } else {
          statusEl.textContent = '❌ Error al descifrar. Verificá la contraseña o el archivo.';
          statusEl.style.color = '#f28b82';
        }
      };
    }
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
            <button id="accountsChangeFileBtn" class="btn btn--ghost btn--xs">Cambiar archivo</button>
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
      console.info(LOG, 'ready v1.2.1');
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