/*!
 * js/accounts-panel.js — Panel de Cuentas (cifrado local)
 * v1.3.0 (2026-03-27)
 *
 * NUEVO v1.3.0:
 * - Asistente de cuentas (modal) para crear archivos .enc desde Excel
 * - Guía paso a paso con explicaciones de seguridad
 * - Generación de plantilla Excel
 * - Conversión Excel → JSON
 * - Enriquecimiento con API de GW2 (usando keys de la Bóveda)
 * - Cifrado final a .enc
 *
 * MEJORAS v1.2.1:
 * - Vista tabla/tarjetas con botón toggle
 * - Información sensible oculta inicialmente, se despliega al hacer click en el nombre
 * - Copia al portapapeles al hacer click en email, contraseña o Gmail pass
 * - Imagen de tipo de cuenta según path configurable
 * - Sección "Más info" colapsable
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
    ACCOUNT_ICON: 'assets/icons/Cuentas/GW2free.png',
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
    view: 'cards',
    showPasswords: {},
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
  // 6. RENDERIZADO DE TARJETA
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

    var accountIcon = CONFIG.ACCOUNT_ICON;

    var tagBadges = tags.map(function(t) {
      var icon = t === 'main' ? '⭐' : (t === 'alter' ? '🧪' : (t === 'farming' ? '🌾' : (t === 'keys' ? '🔑' : (t === 'f2p' ? '🆓' : '🏷️'))));
      return '<span class="badge badge--info" style="font-size: 0.7rem; padding: 2px 6px;">' + icon + ' ' + t + '</span>';
    }).join('');

    var expOrder = ['core', 'heroic', 'heartOfThorns', 'pathOfFire', 'endOfDragons', 'secretsOfTheObscure', 'janthirWilds', 'visionsOfEternity'];
    var expIcons = [];
    expOrder.forEach(function(key) {
      if (expansions[key] !== undefined) {
        expIcons.push(getExpansionIcon(key, expansions[key]));
      }
    });

    var serviceIcons = [];
    if (services.twitch && services.twitch.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.twitch + '" width="20" height="20" title="Twitch: @' + esc(services.twitch.username || '') + '">');
    }
    if (services.geforceNow && services.geforceNow.linked) {
      serviceIcons.push('<img src="' + CONFIG.ICONS.geforce + '" width="20" height="20" title="GeForce Now vinculado">');
    }

    var passwordDisplay = showPass ? esc(login.password || '—') : '••••••••';
    var gmailPassDisplay = showPass ? esc(login.gmailPassword || '—') : '••••••••';

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
          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
            '<div><img src="' + CONFIG.ICONS.gmail + '" width="16" height="16" style="vertical-align: middle;"> <strong>Email:</strong> ' +
              '<span style="cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.email || '') + '" data-field="Email">' + esc(login.email || '—') + '</span>' +
            '</div>' +
            '<div><img src="' + CONFIG.ICONS.lock + '" width="16" height="16" style="vertical-align: middle;"> <strong>Contraseña:</strong> ' +
              '<span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.password || '') + '" data-field="Contraseña">' + passwordDisplay + '</span> ' +
              '<button class="btn-ghost toggle-password" data-id="' + acc.id + '" style="padding: 2px 4px; font-size: 12px;">👁️</button>' +
            '</div>' +
          '</div>' +

          (login.gmailPassword ? '<div style="margin-top: 6px;"><img src="' + CONFIG.ICONS.googlePass + '" width="16" height="16" style="vertical-align: middle;"> <strong>Gmail Pass:</strong> ' +
            '<span style="font-family: monospace; cursor: pointer; text-decoration: underline dotted;" data-copy="' + esc(login.gmailPassword) + '" data-field="Gmail Pass">' + gmailPassDisplay + '</span>' +
          '</div>' : '') +

          '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px;">' +
            '<div><strong>🎮 GW2 ID:</strong> ' + esc(gw2.accountName || '—') + '</div>' +
            '<div><strong>📅 Creación:</strong> ' + formatDate(gw2.created) + ' (' + formatAgeDays(gw2.created) + ')</div>' +
            '<div><strong>🏆 AP:</strong> ' + fmtNumber(gw2.achievementPoints) + '</div>' +
          '</div>' +

          '<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center;">' +
            '<strong>📀 Expansiones:</strong> ' + (expIcons.length ? expIcons.join(' ') : '<span class="muted">—</span>') +
          '</div>' +

          (serviceIcons.length ? '<div style="display: flex; gap: 8px; margin-top: 8px;"><strong>🔌 Servicios:</strong> ' + serviceIcons.join(' ') + '</div>' : '') +

          (acc.apiKey ? '<div style="margin-top: 8px;"><strong>🔑 API Key:</strong> <code>' + esc(acc.apiKey.value || acc.apiKey) + '</code></div>' : '') +

          (acc.notes ? '<div style="margin-top: 8px; color: #a0a0a6;"><strong>📝 Notas:</strong> ' + esc(acc.notes) + '</div>' : '') +

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
        state.expandedAccounts[id] = !state.expandedAccounts[id];
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
  // 7. FORMULARIO DE CARGA (existente)
  // =======================================================================
  function renderLoadForm() {
    var body = document.querySelector('#accountsPanel .panel__body');
    if (!body) return;

    var lastFile = getLastFileInfo();
    var hasStoredFile = !!lastFile;

    body.innerHTML = `
      <div id="accountsLoadForm" style="background: #1a1e2a; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2a2c35;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.2rem;">🧙</span>
            <div>
              <h3 style="margin: 0;">Asistente de cuentas</h3>
              <div class="muted" style="font-size: 0.75rem;">Guía paso a paso para crear tu archivo seguro</div>
            </div>
          </div>
          <button id="openWizardBtn" class="btn btn--accent" style="display: flex; align-items: center; gap: 6px;">➕ Crear nuevo archivo</button>
        </div>
      </div>
      <div id="accountsStats"></div>
      <div id="accountsFilters"></div>
      <div id="accountsList" class="wallet-card-grid"></div>
    `;

    var openWizardBtn = document.getElementById('openWizardBtn');
    if (openWizardBtn && !openWizardBtn.__wired) {
      openWizardBtn.__wired = true;
      openWizardBtn.addEventListener('click', function() {
        openWizardModal();
      });
    }

    var hasData = state.data && state.data.accounts && state.data.accounts.length;
    if (!hasData) {
      var container = document.getElementById('accountsLoadForm');
      if (container) {
        var existingForm = container.querySelector('#manualLoadContainer');
        if (!existingForm) {
          var manualFormHtml = `
            <div id="manualLoadContainer" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a2c35;">
              <p class="muted" style="margin-bottom: 12px;">O cargá un archivo existente:</p>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
                <div style="flex: 2;">
                  <input type="file" id="accountsFileInput" accept=".enc">
                </div>
                <div style="flex: 1;">
                  <input type="password" id="accountsPasswordInput" placeholder="Contraseña">
                </div>
                <div>
                  <button id="accountsLoadBtn" class="btn btn--accent">🔓 Cargar archivo</button>
                </div>
              </div>
              <div id="accountsLoadStatus" class="muted" style="margin-top: 12px;"></div>
            </div>
          `;
          container.insertAdjacentHTML('beforeend', manualFormHtml);
          
          var fileInput = document.getElementById('accountsFileInput');
          var passwordInput = document.getElementById('accountsPasswordInput');
          var loadBtn = document.getElementById('accountsLoadBtn');
          var statusEl = document.getElementById('accountsLoadStatus');
          
          if (loadBtn) {
            loadBtn.onclick = async function() {
              var file = fileInput.files[0];
              var password = passwordInput.value;
              if (!file) { if (statusEl) statusEl.textContent = '⚠️ Seleccioná un archivo'; return; }
              if (!password) { if (statusEl) statusEl.textContent = '⚠️ Ingresá la contraseña'; return; }
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
      }
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
          <h3 id="wizardTitle" style="display: flex; align-items: center; gap: 8px;">🧙 Asistente de cuentas</h3>
          <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>
        </div>
        <div class="modal__body" style="max-height: 70vh; overflow-y: auto;">
          
          <div style="background: #0a0c10; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <span style="font-size: 1.5rem;">🔒</span>
              <div>
                <strong style="color: #a7f3d0;">Tus datos están seguros</strong>
                <p class="muted" style="margin: 4px 0 0;">Todo el proceso ocurre en tu navegador y tu PC. No hay servidores, no hay bases de datos externas. <strong>Ningún dato sale de tu computadora.</strong></p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0;">📥 PASO 1: Descargar plantilla</h4>
            <p class="muted" style="margin-bottom: 12px;">Completá solo lo que quieras. Todos los campos son opcionales excepto el ID. Si no te sentís seguro, no cargues contraseñas.</p>
            <button id="wizardDownloadTemplate" class="btn btn--accent">📎 Descargar plantilla Excel</button>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0;">📤 PASO 2: Subir Excel → Generar JSON</h4>
            <p class="muted" style="margin-bottom: 12px;">Convertí tu Excel a JSON. Se guardará en tu PC.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
              <input type="file" id="wizardExcelFile" accept=".xlsx,.xls" style="flex: 2;">
              <button id="wizardExcelToJson" class="btn">🔄 Generar JSON</button>
            </div>
            <div id="wizardStep2Status" class="muted" style="margin-top: 8px;"></div>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0;">🌐 PASO 3: Enriquecer con API (opcional)</h4>
            <p class="muted" style="margin-bottom: 12px;">Usa las API Keys que ya tenés guardadas en la Bóveda. Consulta automáticamente: nombre de cuenta, AP, fecha creación, expansiones.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
              <input type="file" id="wizardJsonFile" accept=".json" style="flex: 2;">
              <button id="wizardEnrich" class="btn">✨ Enriquecer con GW2 API</button>
            </div>
            <div id="wizardStep3Status" class="muted" style="margin-top: 8px;"></div>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0;">🔐 PASO 4: Cifrar para usar en el panel</h4>
            <p class="muted" style="margin-bottom: 12px;">Creá el archivo .enc que podés cargar en el panel. <strong>Recordá la contraseña, la vas a necesitar.</strong></p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
              <input type="file" id="wizardEncryptFile" accept=".json" style="flex: 2;">
              <input type="password" id="wizardPassword" placeholder="Contraseña" style="flex: 1;">
              <button id="wizardEncrypt" class="btn btn--accent">🔒 Crear archivo .enc</button>
            </div>
            <div id="wizardStep4Status" class="muted" style="margin-top: 8px;"></div>
          </div>

          <hr style="border-color: #2a2c35; margin: 16px 0;">

          <div>
            <h4 style="margin: 0 0 8px 0;">📁 ¿Ya tenés tu archivo .enc?</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              <button id="wizardCloseAndLoad" class="btn">👁️ Ir al panel para cargarlo</button>
              <button id="wizardClose" class="btn btn--ghost">Cerrar</button>
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
      'twitch_user', 'geforce_linked', 'notas', 'tags'
    ];
    var data = [columns];
    var example = [
      'mi_cuenta_1', 'Mi cuenta principal', 'usuario@ejemplo.com', '', '',
      'ABCD-1234-EFGH-5678', 'miusuario', 'TRUE', 'Cuenta principal con todas las expansiones', 'main,full'
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
                twitch: { linked: !!(row.twitch_user), username: row.twitch_user || null },
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
      console.info(LOG, 'ready v1.3.0 — Asistente de cuentas integrado');
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