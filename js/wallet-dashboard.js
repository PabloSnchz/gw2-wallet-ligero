/*!
 * js/wallet-dashboard.js — Dashboard de Cartera Multi-Cuenta
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.4.0 (2026-04-08)
 *
 * Características:
 *  - Tabla de cuentas vs divisas seleccionadas
 *  - Ordenamiento dinámico por columna
 *  - KPIs resumen con íconos oficiales
 *  - Selector de divisas dropdown
 *  - Persistencia de selección y ordenamiento
 *  - Fix: reintento de renderizado si la tabla no existe
 */

(function (root) {
  'use strict';
  var LOG = '[WalletDashboard]';

  // ------------------------------ Utils DOM ------------------------------
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtInt(n){ if (n==null || !isFinite(n)) return '—'; n=Number(n||0); return n.toLocaleString('es-AR'); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }
  function formatTimestamp(date){
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ------------------------------ Formato de moneda ------------------------------
  function formatCoinValue(value) {
    if (value == null || isNaN(value)) return '—';
    var copper = Math.abs(Math.floor(value));
    var gold = Math.floor(copper / 10000);
    var silver = Math.floor((copper % 10000) / 100);
    var copperLeft = copper % 100;
    
    var parts = [];
    if (gold > 0) parts.push('<span style="color:#f4c542;">' + gold.toLocaleString('es-AR') + '</span> <span style="color:#a0a0a6;">g</span>');
    if (silver > 0 || gold > 0) parts.push('<span style="color:#e0e0e0;">' + silver + '</span> <span style="color:#a0a0a6;">s</span>');
    parts.push('<span style="color:#b87333;">' + copperLeft + '</span> <span style="color:#a0a0a6;">c</span>');
    return parts.join(' ');
  }

  // ------------------------------ Estado -------------------------------
  var state = {
    inited: false,
    active: false,
    keys: [],
    accounts: [],
    currencies: [],
    selectedCurrencies: [],
    loading: false,
    lastRefreshTime: null,
    sortColumn: null,
    sortDirection: 'desc'
  };

  var _refreshInFlight = null;

  var STORAGE_KEY = 'wallet_dashboard_selected_currencies';
  var SORT_STORAGE_KEY = 'wallet_dashboard_sort';
  
  var DEFAULT_CURRENCY_NAMES = ['Gema', 'Moneda', 'Laurel', 'Reconocimiento Astral', 'Karma', 'Esquirla espiritual'];
    // Iconos por tipo de cuenta (mismos que accounts-panel.js)
  var ACCOUNT_TYPE_ICONS = {
    'main':  'assets/icons/Cuentas/547827.png',
    'alter': 'assets/icons/Cuentas/157375.png',
    'f2p':   'assets/icons/Cuentas/102538.png'
  };
  var DECORATIVE_ICONS = [
    'assets/icons/Cuentas/1770678.png',
    'assets/icons/Cuentas/1770679.png',
    'assets/icons/Cuentas/1770680.png',
    'assets/icons/Cuentas/1770681.png',
    'assets/icons/Cuentas/1770682.png',
    'assets/icons/Cuentas/1770683.png',
    'assets/icons/Cuentas/1770684.png',
    'assets/icons/Cuentas/1770685.png',
    'assets/icons/Cuentas/1770686.png'
  ];

  function getAccountIcon(tag) {
    if (tag && ACCOUNT_TYPE_ICONS[tag]) return ACCOUNT_TYPE_ICONS[tag];
    // Fallback aleatorio si no tiene tag definido
    return DECORATIVE_ICONS[Math.floor(Math.random() * DECORATIVE_ICONS.length)];
  }

  // ------------------------------ Persistencia ------------------------------
  function loadSelectedCurrencies() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          state.selectedCurrencies = parsed;
          return;
        }
      }
    } catch(e) { console.warn(LOG, 'Error loading selected currencies', e); }
    state.selectedCurrencies = [];
  }

  function saveSelectedCurrencies() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selectedCurrencies));
    } catch(e) { console.warn(LOG, 'Error saving selected currencies', e); }
  }

  function loadSortPreference() {
    try {
      var stored = localStorage.getItem(SORT_STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        state.sortColumn = parsed.column;
        state.sortDirection = parsed.direction;
      }
    } catch(e) { console.warn(LOG, 'Error loading sort preference', e); }
  }

  function saveSortPreference() {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({
        column: state.sortColumn,
        direction: state.sortDirection
      }));
    } catch(e) { console.warn(LOG, 'Error saving sort preference', e); }
  }

  // ------------------------------ Funciones auxiliares ------------------------------
  async function loadCurrencies() {
    if (state.currencies.length) return state.currencies;
    try {
      var currencies = await root.GW2Api.getCurrenciesAll({ nocache: false });
      if (Array.isArray(currencies)) {
        state.currencies = currencies;
        if (!state.selectedCurrencies.length) {
          var ids = [];
          DEFAULT_CURRENCY_NAMES.forEach(function(name) {
            var found = currencies.find(function(c) { 
              return c.name && c.name.toLowerCase().includes(name.toLowerCase()); 
            });
            if (found) ids.push(found.id);
          });
          state.selectedCurrencies = ids;
          saveSelectedCurrencies();
        }
        return currencies;
      }
    } catch(e) {
      console.warn(LOG, 'Error loading currencies', e);
    }
    return [];
  }

  function loadKeys() {
    try {
      var list = JSON.parse(localStorage.getItem('gw2_keys') || '[]');
      return Array.isArray(list) ? list : [];
    } catch(_) { return []; }
  }

  async function loadWalletForAccount(token, forceNoCache) {
    try {
      var wallet = await root.GW2Api.getAccountWallet(token, { nocache: !!forceNoCache });
      var map = {};
      if (Array.isArray(wallet)) {
        wallet.forEach(function(entry) {
          map[entry.id] = entry.value;
        });
      }
      return map;
    } catch(e) {
      console.warn(LOG, 'Error loading wallet for token', e);
      return {};
    }
  }

  async function loadAllWallets(forceNoCache) {
    state.keys = loadKeys();
    if (!state.keys.length) {
      state.accounts = [];
      return;
    }

    var out = [];
    var idx = 0, ACTIVE = 0, MAX = 3;

    await new Promise(function(resolve) {
      function next() {
        if (idx >= state.keys.length && ACTIVE === 0) return resolve();
        while (ACTIVE < MAX && idx < state.keys.length) {
          var it = state.keys[idx++];
          ACTIVE++;
          (function(k) {
            var token = k.value;
            var label = k.label || ('Key ' + fpToken(token));
            var fp = fpToken(token);
            loadWalletForAccount(token, forceNoCache)
              .then(function(walletMap) {
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  wallet: walletMap
                });
              })
              .catch(function(e) {
                console.warn(LOG, 'Error loading wallet for', label, e);
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  wallet: {}
                });
              })
              .finally(function() { ACTIVE--; next(); });
          })(it);
        }
      }
      next();
    });

    state.accounts = out;
    state.lastRefreshTime = new Date();
    console.log(LOG, 'Cargadas', out.length, 'cuentas');
  }

  // ------------------------------ Ordenamiento ------------------------------
  function sortAccounts(accounts, currencyId, direction) {
    return accounts.slice().sort(function(a, b) {
      var valA = a.wallet[currencyId] || 0;
      var valB = b.wallet[currencyId] || 0;
      if (direction === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });
  }

  function setSortColumn(currencyId) {
    if (state.sortColumn === currencyId) {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortColumn = currencyId;
      state.sortDirection = 'desc';
    }
    saveSortPreference();
    renderTable();
  }

  // ------------------------------ Renderizado ------------------------------
  function getCurrencyIconHtml(currency) {
    if (currency && currency.icon) {
      return '<img src="' + esc(currency.icon) + '" width="20" height="20" alt="' + esc(currency.name || '') + '" loading="lazy" style="vertical-align: middle; margin-right: 6px;">';
    }
    return '';
  }

  function renderCurrencySelector() {
    var container = $('#wdCurrencySelector');
    if (!container) {
      console.warn(LOG, 'Selector container no encontrado');
      return;
    }

    if (!state.currencies.length) {
      container.innerHTML = '<span class="muted">Cargando divisas...</span>';
      return;
    }

    var selectedSet = new Set(state.selectedCurrencies);
    var selectedNames = state.currencies
      .filter(function(c) { return selectedSet.has(c.id); })
      .map(function(c) { return c.name; })
      .join(', ');
    
    var html = '<div style="position:relative; display:inline-block;">' +
      '<button id="wdCurrencyDropdownBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px; min-width:200px; justify-content:space-between;">' +
      '<span>' + (selectedNames || 'Seleccionar divisas') + '</span>' +
      '<span>▼</span>' +
      '</button>' +
      '<div id="wdCurrencyDropdown" style="position:absolute; top:100%; left:0; background:#1a1c24; border:1px solid #2a2c35; border-radius:8px; padding:8px; z-index:100; min-width:220px; max-height:300px; overflow-y:auto; display:none;">' +
      '<div style="display:flex; flex-direction:column; gap:6px;">' +
      '<button id="wdSelectAllBtn" class="btn btn--xs" style="margin-bottom:4px;">✓ Seleccionar todas</button>' +
      '<button id="wdSelectNoneBtn" class="btn btn--xs" style="margin-bottom:8px;">✗ Deseleccionar todas</button>';
    
    state.currencies.forEach(function(cur) {
      var isSelected = selectedSet.has(cur.id);
      var iconHtml = getCurrencyIconHtml(cur);
      html += '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:6px;">' +
        '<input type="checkbox" value="' + cur.id + '" ' + (isSelected ? 'checked' : '') + ' style="cursor:pointer;">' +
        iconHtml +
        '<span>' + esc(cur.name || 'Divisa #' + cur.id) + '</span>' +
        '</label>';
    });
    
    html += '</div></div></div>';
    container.innerHTML = html;

    var dropdownBtn = document.getElementById('wdCurrencyDropdownBtn');
    var dropdown = document.getElementById('wdCurrencyDropdown');
    var selectAllBtn = document.getElementById('wdSelectAllBtn');
    var selectNoneBtn = document.getElementById('wdSelectNoneBtn');
    
    if (dropdownBtn && dropdown) {
      dropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      
      document.addEventListener('click', function(e) {
        if (dropdownBtn && dropdown && !dropdownBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
      
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
          state.selectedCurrencies = state.currencies.map(function(c) { return c.id; });
          saveSelectedCurrencies();
          var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(function(cb) { cb.checked = true; });
          dropdownBtn.querySelector('span:first-child').textContent = state.currencies.map(function(c) { return c.name; }).join(', ');
          renderTable();
        });
      }
      
      if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', function() {
          state.selectedCurrencies = [];
          saveSelectedCurrencies();
          var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(function(cb) { cb.checked = false; });
          dropdownBtn.querySelector('span:first-child').textContent = 'Seleccionar divisas';
          renderTable();
        });
      }
      
      var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
          var id = parseInt(this.value, 10);
          if (this.checked) {
            if (!state.selectedCurrencies.includes(id)) {
              state.selectedCurrencies.push(id);
            }
          } else {
            state.selectedCurrencies = state.selectedCurrencies.filter(function(cid) { return cid !== id; });
          }
          saveSelectedCurrencies();
          var newSelectedNames = state.currencies
            .filter(function(c) { return state.selectedCurrencies.includes(c.id); })
            .map(function(c) { return c.name; })
            .join(', ');
          if (dropdownBtn.querySelector('span:first-child')) {
            dropdownBtn.querySelector('span:first-child').textContent = newSelectedNames || 'Seleccionar divisas';
          }
          renderTable();
        });
      });
    }
  }

  function renderKPIs(totals) {
    var container = $('#wdKPIs');
    if (!container) return;

    var kpis = [];
    
    var goldIcon = 'https://render.guildwars2.com/file/98457F504BA2FAC8457F532C4B30EDC23929ACF9/619316.png';
    var karmaIcon = 'https://render.guildwars2.com/file/94953FA23D3E0D23559624015DFEA4CFAA07F0E5/155026.png';
    var laurelIcon = 'https://render.guildwars2.com/file/A1BD345AD9192C3A585BE2F6CB0617C5A797A1E2/619317.png';
    var aaIcon = 'https://render.guildwars2.com/file/1856A01E331452E4C14E4C9CF4F818E3FAEF9B79/3124964.png';
    
    var goldId = state.currencies.find(function(c) { return c.name === 'Moneda' || c.id === 1; })?.id;
    var karmaId = state.currencies.find(function(c) { return c.name === 'Karma' || c.id === 2; })?.id;
    var laurelId = state.currencies.find(function(c) { return c.name === 'Laurel' || c.id === 3; })?.id;
    var aaId = state.currencies.find(function(c) { return c.name?.includes('Reconocimiento astral') || c.id === 63; })?.id;

    if (goldId && totals[goldId] !== undefined) {
      kpis.push('<div class="wd-kpi-card" style="border-left:3px solid rgba(244,197,66,0.5);box-shadow:0 0 8px rgba(244,197,66,0.15);">' +
        '<div class="wd-kpi-label"><img src="' + goldIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Oro</div>' +
        '<div class="wd-kpi-value gold-glow">' + formatCoinValue(totals[goldId]) + '</div></div>');
    }
    if (karmaId && totals[karmaId] !== undefined) {
      kpis.push('<div class="wd-kpi-card" style="border-left:3px solid rgba(175,99,223,0.5);box-shadow:0 0 8px rgba(175,99,223,0.15);">' +
        '<div class="wd-kpi-label"><img src="' + karmaIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Karma</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[karmaId]) + '</div></div>');
    }
    if (laurelId && totals[laurelId] !== undefined) {
      kpis.push('<div class="wd-kpi-card" style="border-left:3px solid rgba(43,193,78,0.5);box-shadow:0 0 8px rgba(43,193,78,0.15);">' +
        '<div class="wd-kpi-label"><img src="' + laurelIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Laurel</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[laurelId]) + '</div></div>');
    }
    if (aaId && totals[aaId] !== undefined) {
      kpis.push('<div class="wd-kpi-card" style="border-left:3px solid rgba(123,194,255,0.5);box-shadow:0 0 8px rgba(123,194,255,0.15);">' +
        '<div class="wd-kpi-label"><img src="' + aaIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Reconocimiento Astral</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[aaId]) + '</div></div>');
    }

    container.innerHTML = kpis.join('');
  }

  function formatValueForDisplay(currencyId, value) {
    if (value < 0) {
      return '<span style="color:#ff9d9d;">' + (currencyId === 1 ? formatCoinValue(Math.abs(value)) : fmtInt(Math.abs(value))) + '</span>';
    }
    if (currencyId === 1) {
      return '<span class="gold-value">' + formatCoinValue(value) + '</span>';
    }
    return fmtInt(value);
  }

  function renderTable() {
    // Intentar encontrar la tabla, si no existe, esperar un poco y reintentar
    var table = $('#wdTable');
    if (!table) {
      console.warn(LOG, 'Tabla #wdTable no encontrada, reintentando en 100ms...');
      setTimeout(function() {
        renderTable();
      }, 100);
      return;
    }

    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) {
      console.error(LOG, 'thead o tbody no encontrados');
      return;
    }

    // Verificar que tenemos datos
    if (!state.currencies.length) {
      console.log(LOG, 'Esperando divisas...');
      return;
    }

    if (!state.selectedCurrencies.length) {
      console.log(LOG, 'No hay divisas seleccionadas');
      thead.innerHTML = '<td><th>Cuenta</th><th colspan="1">No hay divisas seleccionadas</th></tr>';
      tbody.innerHTML = '<td><td colspan="2">Selecciona al menos una divisa en el panel de filtros.2</td></tr>';
      return;
    }

    var selectedCurrencies = state.currencies.filter(function(c) { 
      return state.selectedCurrencies.includes(c.id); 
    });
    
    if (!selectedCurrencies.length) {
      thead.innerHTML = '<td><th>Cuenta</th><th colspan="1">No hay divisas seleccionadas</th></tr>';
      tbody.innerHTML = '<td><td colspan="2">Selecciona al menos una divisa.2</td></tr>';
      return;
    }

    console.log(LOG, 'Renderizando tabla con', selectedCurrencies.length, 'divisas y', state.accounts.length, 'cuentas');

    // Cabecera con ordenamiento
    var hcells = ['<th class="wd-account-header">Cuenta</th>'];
    selectedCurrencies.forEach(function(cur) {
      var iconHtml = getCurrencyIconHtml(cur);
      var sortIndicator = '';
      if (state.sortColumn === cur.id) {
        sortIndicator = state.sortDirection === 'desc' ? ' ↓' : ' ↑';
      }
      hcells.push('<th class="right sortable" data-currency-id="' + cur.id + '" title="Ordenar por ' + esc(cur.name) + '" style="cursor:pointer;">' + 
        iconHtml + '<span style="display:inline-block; margin-left:4px;">' + esc(cur.name || 'Divisa #' + cur.id) + sortIndicator + '</span></th>');
    });
    thead.innerHTML = '                <tr>' + hcells.join('') + ' <\/tr>';

    // Aplicar ordenamiento
    var rowsAcc = state.accounts.slice();
    if (state.sortColumn !== null) {
      rowsAcc = sortAccounts(rowsAcc, state.sortColumn, state.sortDirection);
    }

    // Calcular totales
    var totals = {};
    selectedCurrencies.forEach(function(cur) { totals[cur.id] = 0; });
    rowsAcc.forEach(function(acc) {
      selectedCurrencies.forEach(function(cur) {
        totals[cur.id] += acc.wallet[cur.id] || 0;
      });
    });

    // Renderizar KPIs
    renderKPIs(totals);

        var bodyRows = rowsAcc.map(function(acc) {
          var cells = [];
          // Buscar el tag de esta cuenta en las keys guardadas
          var keyItem = state.keys.find(function(k) { return k.value === acc.token; });
          var tag = keyItem ? keyItem.tag : null;
          var icon = getAccountIcon(tag);

          cells.push(
            '<td style="display:flex;align-items:center;gap:10px;min-width:160px;">' +
              '<img src="' + icon + '" width="28" height="28" alt="" style="border-radius:8px;filter:brightness(0.9);flex-shrink:0;" loading="lazy">' +
              '<strong>' + esc(acc.label) + '</strong>' +
            '</td>'
          );
      selectedCurrencies.forEach(function(cur) {
        var value = acc.wallet[cur.id] || 0;
        var displayValue = formatValueForDisplay(cur.id, value);
        cells.push('<td class="right" title="' + esc(cur.name) + ': ' + (cur.id === 1 ? value + ' cobre' : fmtInt(value)) + '">' + displayValue + '</td>');
      });
      return '                <tr>' + cells.join('') + '<\/tr>';
    }).join('');

    // Fila de totales
    var totalCells = ['<td class="total-label"><strong><img src="assets/icons/578844.png" width="14" height="14" alt="" style="vertical-align: middle; margin-right: 6px;">TOTAL</strong></td>'];
    selectedCurrencies.forEach(function(cur) {
      var totalValue = totals[cur.id];
      var displayTotal = formatValueForDisplay(cur.id, totalValue);
      totalCells.push('<td class="right total-cell"><strong>' + displayTotal + '</strong></td>');
    });
    var totalRow = '<tr class="total-row">' + totalCells.join('') + '<\/tr>';

    tbody.innerHTML = bodyRows + totalRow;
    console.log(LOG, 'Tabla renderizada con', rowsAcc.length, 'filas');

    // Agregar eventos de ordenamiento
    var sortableHeaders = thead.querySelectorAll('th.sortable');
    sortableHeaders.forEach(function(th) {
      th.removeEventListener('click', th.__clickHandler);
      var currencyId = parseInt(th.getAttribute('data-currency-id'), 10);
      var handler = function() { setSortColumn(currencyId); };
      th.__clickHandler = handler;
      th.addEventListener('click', handler);
    });

    // Inyectar estilos de tabla unificada
    var styleEl = document.getElementById('wdTableStyles');
    if (styleEl) styleEl.remove();
    styleEl = document.createElement('style');
    styleEl.id = 'wdTableStyles';
    styleEl.textContent = [
      '#wdTable { border-collapse:separate; border-spacing:0; width:100%; }',
      '#wdTable th { position:sticky; top:0; background:#0f1118; z-index:2; font-weight:600; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:#9aa2b8; border-bottom:2px solid #2a2c35; padding:10px 12px; }',
      '#wdTable td { padding:10px 12px; border-bottom:1px solid #1f2026; vertical-align:middle; color:#cfd2d8; }',
      '#wdTable tbody tr:hover { background:#1a1d28; }',
      '#wdTable tbody tr:nth-child(even) { background:#0c0e14; }',
      '#wdTable tbody tr:nth-child(even):hover { background:#1a1d28; }',
      '#wdTable .total-row { background:#0f1118!important; border-top:2px solid #3a4c7a; font-weight:700; }',
      '#wdTable .total-row td { padding-top:12px; padding-bottom:12px; }',
      '#wdTable th:first-child, #wdTable td:first-child { position:sticky; left:0; background:#0e1116; z-index:1; }',
      '#wdTable tr:hover td:first-child { background:#1a1d28; }',
      '#wdTable tr:nth-child(even) td:first-child { background:#0c0e14; }',
      '#wdTable tr:nth-child(even):hover td:first-child { background:#1a1d28; }',
      '#wdTable .total-row td:first-child { background:#0f1118!important; }'
    ].join(' ');
    document.head.appendChild(styleEl);
  }

  function updateTimestamp() {
    var tsEl = $('#wdTimestamp');
    if (tsEl && state.lastRefreshTime) {
      tsEl.textContent = 'Última actualización: ' + formatTimestamp(state.lastRefreshTime);
    } else if (tsEl) {
      tsEl.textContent = '';
    }
  }

  function setStatus(msg, kind) {
    var msgEl = $('#wdStatusMsg');
    if (!msgEl) return;
    msgEl.textContent = String(msg || '');
    msgEl.classList.remove('error');
    if (kind === 'error') msgEl.classList.add('error');
  }

  function showSkeleton() {
    var kpisContainer = $('#wdKPIs');
    if (kpisContainer && !kpisContainer.__originalContent) {
      kpisContainer.__originalContent = kpisContainer.innerHTML;
    }
    
    if (kpisContainer) {
      kpisContainer.innerHTML = '<div class="wd-skeleton" style="height:80px; width:100%; border-radius:12px;"></div>';
    }
    
    var tableWrap = document.querySelector('#walletDashboardPanel .wd-tablewrap');
    if (!tableWrap) return;
    
    var originalTable = tableWrap.querySelector('#wdTable');
    if (originalTable && !tableWrap.__originalTable) {
      tableWrap.__originalTable = originalTable.cloneNode(true);
    }
    
    tableWrap.innerHTML = '<div class="wd-skeleton-table wd-skeleton"></div>';
  }

  function hideSkeletonAndRestoreTable() {
    var kpisContainer = $('#wdKPIs');
    if (kpisContainer && kpisContainer.__originalContent) {
      kpisContainer.innerHTML = kpisContainer.__originalContent;
      delete kpisContainer.__originalContent;
    }
    
    var tableWrap = document.querySelector('#walletDashboardPanel .wd-tablewrap');
    if (!tableWrap) return;
    
    if (tableWrap.__originalTable) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(tableWrap.__originalTable);
      delete tableWrap.__originalTable;
    }
  }

  async function refreshData(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    try {
      _refreshInFlight = (async () => {
        showSkeleton();
        setStatus('Cargando divisas...');
        await loadCurrencies();
        
        setStatus('Cargando carteras...');
        await loadAllWallets(!!forceNoCache);
        
        setStatus('Renderizando...');
        renderCurrencySelector();
        renderTable();
        updateTimestamp();
        setStatus('Listo.');
        
        hideSkeletonAndRestoreTable();
      })();
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  function goBackToWallet() {
    console.log(LOG, 'Volviendo a Cartera...');
    location.hash = '#/cards';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  // ------------------------------ UI del Panel (creación síncrona) ------------------------------
  function ensurePanelContent() {
    var panel = document.getElementById('walletDashboardPanel');
    if (!panel) {
      console.error(LOG, 'Panel walletDashboardPanel no encontrado en el DOM');
      return null;
    }

    // Si ya tiene contenido, no lo recreamos
    if (panel.querySelector('.wd-content')) {
      console.log(LOG, 'Panel ya tiene contenido');
      return panel;
    }

    console.log(LOG, 'Creando contenido del panel...');
    
    // Limpiar el panel
    panel.innerHTML = '';
    
    // Crear el contenido
    var contentDiv = document.createElement('div');
    contentDiv.className = 'wd-content';
    contentDiv.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title">
          <img src="assets/icons/733322.png" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;">
          Dashboard de Cartera Multi-Cuenta
        </h2>
      </div>
      <div class="panel__body">
        <div id="wdKPIs" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; margin-bottom:20px;"></div>
        
        <div class="wd-filters" style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong>Divisas:</strong>
            <div id="wdCurrencySelector"></div>
          </div>
          <div style="display:flex; gap:8px; margin-left:auto;">
            <button id="wdRefreshBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px;">
              <img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="Refrescar"> Refrescar
            </button>
            <button id="wdBackBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px;">
              <img src="assets/icons/733322.png" width="14" height="14" alt="Volver"> Volver a Cartera
            </button>
          </div>
        </div>
        
        <div class="wd-status-bar" style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span id="wdStatusMsg" class="wd-status-msg">—</span>
          <span id="wdTimestamp" class="wd-timestamp"></span>
        </div>
        
        <div class="wd-tablewrap" style="overflow:auto; border:1px solid #26262b; border-radius:12px;">
          <table id="wdTable" class="wvpd" style="width:100%; border-collapse:collapse;">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;
    
    panel.appendChild(contentDiv);
    
    console.log(LOG, 'Contenido del panel creado');
    return panel;
  }

  // ------------------------------ API pública ------------------------------
  var WalletDashboard = {
    async initOnce() {
      if (state.inited) return;
      
      console.log(LOG, 'initOnce() llamado');
      
      // Crear contenido del panel de forma síncrona
      ensurePanelContent();
      
      // Cargar preferencias
      loadSortPreference();
      loadSelectedCurrencies();
      
      // Conectar eventos de botones (los botones ya existen después de ensurePanelContent)
      var refreshBtn = document.getElementById('wdRefreshBtn');
      if (refreshBtn && !refreshBtn.__wired) {
        refreshBtn.__wired = true;
        refreshBtn.addEventListener('click', function() { refreshData(true); });
        console.log(LOG, 'Evento de refresh conectado');
      }
      
      var backBtn = document.getElementById('wdBackBtn');
      if (backBtn && !backBtn.__wired) {
        backBtn.__wired = true;
        backBtn.addEventListener('click', function() { goBackToWallet(); });
        console.log(LOG, 'Evento de back conectado');
      }
      
      state.inited = true;
      console.log(LOG, 'initOnce() completado');
    },

    async activate() {
      console.log(LOG, 'activate() llamado');
      
      var walletPanel = document.getElementById('walletPanel');
      if (walletPanel) {
        walletPanel.setAttribute('hidden', 'hidden');
      }
      
      await this.initOnce();
      state.active = true;
      
      var panel = document.getElementById('walletDashboardPanel');
      if (panel) panel.removeAttribute('hidden');
      
      await refreshData(false);
    },

    deactivate() {
      console.log(LOG, 'deactivate() llamado');
      state.active = false;
      
      var walletPanel = document.getElementById('walletPanel');
      if (walletPanel) {
        walletPanel.removeAttribute('hidden');
      }
      
      var panel = document.getElementById('walletDashboardPanel');
      if (panel) panel.setAttribute('hidden', '');
    },

    async show() {
      await this.activate();
    },

    async refresh(forceNoCache) {
      await refreshData(forceNoCache);
    }
  };

  root.WalletDashboard = WalletDashboard;

  console.info(LOG, 'ready v2.4.0 — Reintento de renderizado si la tabla no existe');
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));