/*!
 * js/inventory-dashboard.js — Dashboard de Inventario Multi-Cuenta
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.0 (2026-05-07)
 *
 * Características:
 *  - Tabla de cuentas vs ítems seleccionados (banco + materiales combinados)
 *  - 3 sets predefinidos intercambiables
 *  - Selector de ítems con dropdown + checkboxes + íconos de API
 *  - Ocultar filas/columnas en cero
 *  - KPIs resumen con totales por item
 *  - Persistencia de selección y ordenamiento
 *  - Mismo patrón de carga que Wallet Dashboard (MAX=3 concurrentes)
 */

(function (root) {
  'use strict';
  var LOG = '[InventoryDashboard]';

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

  // ------------------------------ Estado -------------------------------
  var state = {
    inited: false,
    active: false,
    keys: [],
    accounts: [],
    sets: [],
    activeSetId: 'high_value',
    selectedItems: [],
    customItems: [],
    itemsMeta: {},
    loading: false,
    lastRefreshTime: null,
    sortColumn: null,
    sortDirection: 'desc',
    hideZeroRows: false,
    hideZeroColumns: false,
    hideMainAccounts: false,
    activeTiers: ['t6']
  };

  var _refreshInFlight = null;

  var STORAGE_SELECTED_ITEMS = 'inv_dashboard_selected_items';
  var STORAGE_ACTIVE_SET = 'inv_dashboard_active_set';
  var STORAGE_ACTIVE_TIERS = 'inv_dashboard_active_tiers';
  var STORAGE_SORT = 'inv_dashboard_sort';
  var STORAGE_HIDE_ZERO = 'inv_dashboard_hide_zero';
  var SETS_URL = 'assets/data/inventory-sets.json';

  // ------------------------------ Persistencia ------------------------------
  function loadSelectedItems() {
    try {
      var stored = localStorage.getItem(STORAGE_SELECTED_ITEMS);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          state.selectedItems = parsed;
          return;
        }
      }
    } catch(e) { console.warn(LOG, 'Error loading selected items', e); }
    state.selectedItems = [];
  }

  function saveSelectedItems() {
    try {
      localStorage.setItem(STORAGE_SELECTED_ITEMS, JSON.stringify(state.selectedItems));
    } catch(e) { console.warn(LOG, 'Error saving selected items', e); }
  }

  function loadActiveSet() {
    try {
      var stored = localStorage.getItem(STORAGE_ACTIVE_SET);
      if (stored) state.activeSetId = stored;
    } catch(e) {}
  }

  function saveActiveSet() {
    try { localStorage.setItem(STORAGE_ACTIVE_SET, state.activeSetId); } catch(e) {}
  }

  function loadSortPreference() {
    try {
      var stored = localStorage.getItem(STORAGE_SORT);
      if (stored) {
        var parsed = JSON.parse(stored);
        state.sortColumn = parsed.column;
        state.sortDirection = parsed.direction;
      }
    } catch(e) {}
  }

  function saveSortPreference() {
    try {
      localStorage.setItem(STORAGE_SORT, JSON.stringify({
        column: state.sortColumn,
        direction: state.sortDirection
      }));
    } catch(e) {}
  }

  function loadActiveTiers() {
    try {
      var stored = localStorage.getItem(STORAGE_ACTIVE_TIERS);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          state.activeTiers = parsed;
          return;
        }
      }
    } catch(e) {}
    state.activeTiers = ['t6'];
  }

  function saveActiveTiers() {
    try {
      localStorage.setItem(STORAGE_ACTIVE_TIERS, JSON.stringify(state.activeTiers));
    } catch(e) {}
  }

  function loadHideZeroPrefs() {
    try {
      var stored = localStorage.getItem(STORAGE_HIDE_ZERO);
      if (stored) {
        var parsed = JSON.parse(stored);
        state.hideZeroRows = !!parsed.hideZeroRows;
        state.hideZeroColumns = !!parsed.hideZeroColumns;
        state.hideMainAccounts = !!parsed.hideMainAccounts;
      }
    } catch(e) {}
  }

  function saveHideZeroPrefs() {
    try {
      localStorage.setItem(STORAGE_HIDE_ZERO, JSON.stringify({
        hideZeroRows: state.hideZeroRows,
        hideZeroColumns: state.hideZeroColumns,
        hideMainAccounts: state.hideMainAccounts
      }));
    } catch(e) {}
  }

  // ------------------------------ Carga de sets ------------------------------
  async function loadSets() {
    if (state.sets.length) return state.sets;
    try {
      var res = await fetch(SETS_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data && Array.isArray(data.sets)) {
        state.sets = data.sets;
        return data.sets;
      }
    } catch(e) {
      console.warn(LOG, 'Error loading sets, usando fallback', e);
    }
    // Fallback mínimo
    state.sets = [
      {
        id: 'high_value',
        name: 'Alto Valor',
        icon: 'assets/icons/Cuentas/157085.png',
        items: [
          { id: 19976, name: 'Moneda mística' },
          { id: 19721, name: 'Pegote de ectoplasma' },
          { id: 43766, name: 'Tomo de conocimiento' },
          { id: 86694, name: 'Estatuilla del León Negro' },
          { id: 36708, name: 'Llave de cofre del León Negro' },
          { id: 19675, name: 'Trébol místico' },
          { id: 71581, name: 'Memoria de batalla' },
          { id: 70820, name: 'Esquirla de gloria' }
        ]
      },
      {
        id: 'crafting_materials',
        name: 'Materiales de artesanía',
        icon: 'assets/icons/Cuentas/255373.png',
        defaultTiers: ['t6'],
        tiers: {
          t6: { name: 'Tier 6', items: [
            { id: 24357, name: 'Colmillo feroz' }, { id: 24289, name: 'Escama blindada' },
            { id: 24351, name: 'Garra despiadada' }, { id: 24358, name: 'Hueso antiguo' },
            { id: 24295, name: 'Vial de sangre poderosa' }, { id: 24283, name: 'Vesícula de veneno poderoso' },
            { id: 24300, name: 'Tótem elaborado' }, { id: 24277, name: 'Montón de polvo cristalino' }
          ]},
          t5: { name: 'Tier 5', items: [
            { id: 24356, name: 'Colmillo grande' }, { id: 24288, name: 'Escama grande' },
            { id: 24350, name: 'Garra grande' }, { id: 24341, name: 'Hueso grande' },
            { id: 24294, name: 'Vial de sangre espesa' }, { id: 24282, name: 'Vesícula de veneno potente' },
            { id: 24299, name: 'Tótem intrincado' }, { id: 24276, name: 'Montón de polvo incandescente' }
          ]},
          t4: { name: 'Tier 4', items: [
            { id: 24355, name: 'Colmillo afilado' }, { id: 24287, name: 'Escama suave' },
            { id: 24349, name: 'Garra afilada' }, { id: 24345, name: 'Hueso pesado' },
            { id: 24293, name: 'Vial de sangre potente' }, { id: 24281, name: 'Vesícula de veneno llena' },
            { id: 24298, name: 'Tótem grabado' }, { id: 24275, name: 'Montón de polvo luminoso' }
          ]},
          t3: { name: 'Tier 3', items: [
            { id: 24354, name: 'Colmillo' }, { id: 24286, name: 'Escama' },
            { id: 24348, name: 'Garra' }, { id: 24344, name: 'Hueso' },
            { id: 24292, name: 'Vial de sangre' }, { id: 24280, name: 'Vesícula de veneno' },
            { id: 24297, name: 'Tótem' }, { id: 24274, name: 'Montón de polvo radiante' }
          ]}
        }
      }
    ];
    return state.sets;
  }

  // ------------------------------ Carga de keys ------------------------------
  function loadKeys() {
    try {
      var list = JSON.parse(localStorage.getItem('gw2_keys') || '[]');
      return Array.isArray(list) ? list : [];
    } catch(_) { return []; }
  }

  function countItemInBank(bank, itemId) {
    var total = 0;
    for (var i = 0; i < bank.length; i++) {
      var item = bank[i];
      if (item && item.id === itemId) {
        total += (item.count || 1);
      }
    }
    return total;
  }

  function countItemInMaterials(materials, itemId) {
    for (var i = 0; i < materials.length; i++) {
      var m = materials[i];
      if (m && m.id === itemId) {
        return m.count || 0;
      }
    }
    return 0;
  }

  function countItemInBags(bags, itemId) {
    var total = 0;
    if (!bags || !bags.length) return 0;
    for (var b = 0; b < bags.length; b++) {
      if (!bags[b]) continue;
      var inv = bags[b].inventory || [];
      for (var i = 0; i < inv.length; i++) {
        if (inv[i] && inv[i].id === itemId) {
          total += (inv[i].count || 1);
        }
      }
    }
    return total;
  }

  async function loadActiveCharacterInventory(token) {
    try {
      var c1 = new AbortController();
      var t1 = setTimeout(function() { c1.abort(); }, 4000);
      var charsResp = await fetch('https://api.guildwars2.com/v2/characters?access_token=' + token, { signal: c1.signal });
      clearTimeout(t1);
      if (!charsResp.ok) return { name: null, bags: [] };
      var chars = await charsResp.json();
      if (!chars || !chars.length) return { name: null, bags: [] };
      var activeChar = chars[0];
      try {
        var c2 = new AbortController();
        var t2 = setTimeout(function() { c2.abort(); }, 15000);
        var invResp = await fetch('https://api.guildwars2.com/v2/characters/' + encodeURIComponent(activeChar) + '/inventory?access_token=' + token, { signal: c2.signal });
        clearTimeout(t2);
        if (!invResp.ok) return { name: activeChar, bags: [] };
        var invData = await invResp.json();
        return { name: activeChar, bags: invData.bags || [] };
      } catch(e) {
        return { name: activeChar, bags: [] };
      }
    } catch(e) {
      return { name: null, bags: [] };
    }
  }

  async function loadAllInventories(forceNoCache) {
    state.keys = loadKeys();
    if (!state.keys.length) {
      state.accounts = [];
      return;
    }

    var out = [];
    var idx = 0, ACTIVE = 0, MAX = 3;

    // FASE 1: Solo banco + materiales (rápido, sin personaje)
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
            Promise.all([
              root.GW2Api.getAccountBank(token, { nocache: !!forceNoCache }),
              root.GW2Api.getAccountMaterials(token, { nocache: !!forceNoCache })
            ])
              .then(function(results) {
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  tag: k.tag || null,
                  bank: Array.isArray(results[0]) ? results[0] : [],
                  materials: Array.isArray(results[1]) ? results[1] : [],
                  activeCharName: null,
                  activeCharBags: [],
                  _charLoading: true
                });
              })
              .catch(function(e) {
                console.warn(LOG, 'Error loading inventory for', label, e);
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  tag: k.tag || null,
                  bank: [],
                  materials: [],
                  activeCharName: null,
                  activeCharBags: [],
                  _charLoading: true
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
    console.log(LOG, 'Fase 1 completada:', out.length, 'cuentas (banco + materiales)');

    // FASE 2: Personaje activo (background)
    loadCharactersInBackground(out);
  }

  async function loadCharactersInBackground(accounts) {
    // Guardar snapshot de valores antes de actualizar bags
    var activeItems = getActiveItems();
    accounts.forEach(function(acc) {
      acc._preCharValues = {};
      activeItems.forEach(function(itemId) {
        acc._preCharValues[itemId] = getItemTotalForAccount(acc, itemId);
      });
    });

    var promises = accounts.map(function(acc) {
      return loadActiveCharacterInventory(acc.token)
        .then(function(charData) {
          acc.activeCharName = charData.name;
          acc.activeCharBags = charData.bags || [];
          acc._charLoading = false;
          updateCharCell(acc);
        })
        .catch(function() {
          acc.activeCharName = null;
          acc.activeCharBags = [];
          acc._charLoading = false;
          updateCharCell(acc);
        });
    });
    await Promise.allSettled(promises);
    console.log(LOG, 'Fase 2 completada: personajes activos cargados');
    updateTotalGoldBadge();
    var currentItems = getActiveItems();
    renderKPIs(currentItems, getFilteredAccounts());
  }

  function updateCharCell(acc) {
    var table = $('#idTable');
    if (!table) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (row.classList.contains('total-row')) continue;
      var firstCell = row.querySelector('td');
      if (!firstCell) continue;
      if (firstCell.textContent.indexOf(acc.label) !== -1) {
        var charInfoDiv = firstCell.querySelector('.id-char-info');
        if (charInfoDiv) {
          if (acc._charLoading) {
            charInfoDiv.innerHTML = '<img src="assets/icons/Cuentas/358353.png" width="14" height="14" alt="" style="vertical-align:middle;animation:charPulse 2s ease-in-out infinite;"> <span style="color:#5a6072;">cargando...</span>';
          } else if (acc.activeCharName) {
            charInfoDiv.innerHTML = '<img src="assets/icons/Cuentas/358353.png" width="14" height="14" alt="" style="vertical-align:middle;opacity:0.7;"> <span style="color:#5a6072;">' + esc(acc.activeCharName) + '</span>';
          } else {
            charInfoDiv.innerHTML = '';
          }
        }
        var activeItems = getActiveItems();
        var cells = row.querySelectorAll('td');
        var totalDelta = 0;
        for (var c = 1; c < cells.length; c++) {
          var itemId = activeItems[c - 1];
          if (itemId != null) {
            var oldValue = (acc._preCharValues && acc._preCharValues[itemId] != null) ? acc._preCharValues[itemId] : 0;
            var newValue = getItemTotalForAccount(acc, itemId);
            var delta = newValue - oldValue;
            if (delta > 0) {
              totalDelta += delta;
              cells[c].textContent = fmtInt(newValue);
              cells[c].setAttribute('title', getItemName(itemId) + ': ' + fmtInt(newValue) + ' (+' + delta + ' del personaje)');
              startDeltaBlink(cells[c]);
            } else {
              cells[c].textContent = fmtInt(newValue);
              cells[c].setAttribute('title', getItemName(itemId) + ': ' + fmtInt(newValue));
            }
          }
        }
        if (totalDelta > 0 && acc.activeCharName) {
          var charName = acc.activeCharName.split(' ')[0];
          setStatus(charName + ': +' + totalDelta + ' ítems del inventario', '');
        }
        updateTotalRow();
        break;
      }
    }
  }

  function startDeltaBlink(cell) {
    if (!cell || cell.__blinking) return;
    cell.__blinking = true;
    cell.classList.add('id-cell-updated');
    cell.style.transition = 'none';
    cell.style.color = '#ffd36b';
    cell.style.fontWeight = '700';
    var blinks = 0;
    var blinkInterval = setInterval(function() {
      blinks++;
      if (blinks > 6) {
        clearInterval(blinkInterval);
        if (cell && cell.isConnected) {
          cell.style.color = '#ffd36b';
          cell.style.fontWeight = '700';
          cell.__blinking = false;
        }
      } else {
        if (cell && cell.isConnected) {
          cell.style.color = (blinks % 2 === 1) ? '#ffd36b' : '';
          cell.style.fontWeight = (blinks % 2 === 1) ? '700' : '';
        }
      }
    }, 300);
    cell.addEventListener('mouseenter', function resetGlow() {
      clearInterval(blinkInterval);
      cell.style.color = '';
      cell.style.fontWeight = '';
      cell.classList.remove('id-cell-updated');
      cell.__blinking = false;
    }, { once: true });
  }

  function updateTotalRow() {
    var table = $('#idTable');
    if (!table) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    var totalRow = tbody.querySelector('.total-row');
    if (!totalRow) return;
    var filteredAccounts = getFilteredAccounts();
    var visibleItems = getActiveItems();
    if (state.hideZeroColumns) {
      visibleItems = visibleItems.filter(function(itemId) { return getItemTotalAcrossAll(itemId) > 0; });
    }
    var cells = totalRow.querySelectorAll('td');
    for (var c = 1; c < cells.length; c++) {
      var itemId = visibleItems[c - 1];
      if (itemId != null) {
        var totalValue = getItemTotalAcrossAll(itemId, filteredAccounts);
        cells[c].innerHTML = '<strong>' + fmtInt(totalValue) + '</strong>';
      }
    }
  }

  // ------------------------------ Metadatos de items -------------------------
  async function loadItemsMeta(itemIds) {
    if (!itemIds.length) return;
    var missing = itemIds.filter(function(id) { return !state.itemsMeta[id]; });
    if (!missing.length) return;
    try {
      var items = await root.GW2Api.getItemsMany(missing, { nocache: false });
      items.forEach(function(item) {
        if (item && item.id) {
          state.itemsMeta[item.id] = item;
        }
      });
    } catch(e) {
      console.warn(LOG, 'Error loading items meta', e);
    }
  }

  // ------------------------------ Precios del TP ----------------------------
  var _pricesCache = {};
  var _pricesTimestamp = 0;
  var PRICES_TTL = 2 * 60 * 1000; // 2 minutos

  async function loadPrices(itemIds) {
    if (!itemIds.length) return;
    var now = Date.now();
    if ((now - _pricesTimestamp) < PRICES_TTL) {
      var allCached = itemIds.every(function(id) { return _pricesCache[id] !== undefined; });
      if (allCached) return;
    }
    try {
      var prices = await root.GW2Api.getCommercePrices(itemIds, { nocache: false });
      prices.forEach(function(p) {
        if (p && p.id) {
          _pricesCache[p.id] = p;
        }
      });
      _pricesTimestamp = now;
    } catch(e) {
      console.warn(LOG, 'Error loading prices', e);
    }
  }

  function getItemSellPrice(itemId) {
    var p = _pricesCache[itemId];
    if (p && p.sells && p.sells.unit_price) {
      return p.sells.unit_price;
    }
    return 0;
  }

  function getTotalGoldValue(accountsOverride) {
    var accounts = accountsOverride || state.accounts;
    var activeItems = getActiveItems();
    var total = 0;
    for (var i = 0; i < activeItems.length; i++) {
      var itemId = activeItems[i];
      var qty = getItemTotalAcrossAll(itemId, accounts);
      var price = getItemSellPrice(itemId);
      total += qty * price;
    }
    return total;
  }

  function updateTotalGoldBadge(accountsOverride) {
    var badge = document.getElementById('idTotalGoldBadge');
    if (badge) {
      badge.innerHTML = '<img src="assets/icons/619316.png" width="16" height="16" alt="" style="vertical-align:middle;">' + formatCoinValue(getTotalGoldValue(accountsOverride));
    }
  }

  // ------------------------------ Formato de moneda --------------------------
  function formatCoinValue(value) {
    var copper = Math.abs(Math.floor(value));
    var gold = Math.floor(copper / 10000);
    var silver = Math.floor((copper % 10000) / 100);
    var copperLeft = copper % 100;
    var parts = [];
    if (gold > 0) parts.push('<span style="color:#f4c542;font-weight:600;">' + gold.toLocaleString('es-AR') + '</span> <span style="color:#9aa2b8;">g</span>');
    if (silver > 0) parts.push('<span style="color:#e0e0e0;font-weight:500;">' + silver + '</span> <span style="color:#9aa2b8;">s</span>');
    parts.push('<span style="color:#b87333;font-weight:500;">' + copperLeft + '</span> <span style="color:#9aa2b8;">c</span>');
    return parts.join(' ');
  }

  // ------------------------------ Cómputos ----------------------------------
  function getItemTotalForAccount(account, itemId) {
    var bankCount = countItemInBank(account.bank, itemId);
    var matCount = countItemInMaterials(account.materials, itemId);
    var charCount = countItemInBags(account.activeCharBags || [], itemId);
    return bankCount + matCount + charCount;
  }

  function getItemTotalAcrossAll(itemId, accountsOverride) {
    var accounts = accountsOverride || state.accounts;
    var total = 0;
    for (var i = 0; i < accounts.length; i++) {
      total += getItemTotalForAccount(accounts[i], itemId);
    }
    return total;
  }

  function getFilteredAccounts() {
    var visibleItems = getActiveItems();
    if (state.hideZeroColumns) {
      visibleItems = visibleItems.filter(function(itemId) {
        return getItemTotalAcrossAll(itemId) > 0;
      });
    }

    var rowsAcc = state.accounts.slice();
    if (state.sortColumn !== null) {
      rowsAcc = sortAccounts(rowsAcc, state.sortColumn, state.sortDirection);
    }

    if (state.hideZeroRows) {
      rowsAcc = rowsAcc.filter(function(acc) {
        for (var i = 0; i < visibleItems.length; i++) {
          if (getItemTotalForAccount(acc, visibleItems[i]) > 0) return true;
        }
        return false;
      });
    }

    if (state.hideMainAccounts) {
      rowsAcc = rowsAcc.filter(function(acc) {
        return acc.tag !== 'main';
      });
    }

    return rowsAcc;
  }

  function getActiveItems() {
    if (state.selectedItems.length) {
      return state.selectedItems;
    }
    var set = getActiveSet();
    if (!set) return [];

    // Si el set tiene tiers, combinar los items de los tiers activos
    if (set.tiers) {
      var activeTiers = state.activeTiers.length ? state.activeTiers : (set.defaultTiers || ['t6']);
      var items = [];
      var seen = {};
      for (var t = 0; t < activeTiers.length; t++) {
        var tier = set.tiers[activeTiers[t]];
        if (tier && tier.items) {
          for (var i = 0; i < tier.items.length; i++) {
            var item = tier.items[i];
            if (!seen[item.id]) {
              seen[item.id] = true;
              items.push(item.id);
            }
          }
        }
      }
      return items;
    }

    return set.items ? set.items.map(function(item) { return item.id; }) : [];
  }

  function getActiveSet() {
    for (var i = 0; i < state.sets.length; i++) {
      if (state.sets[i].id === state.activeSetId) return state.sets[i];
    }
    return state.sets.length ? state.sets[0] : null;
  }

  // ------------------------------ Ordenamiento ------------------------------
  function sortAccounts(accounts, itemId, direction) {
    return accounts.slice().sort(function(a, b) {
      var valA = getItemTotalForAccount(a, itemId);
      var valB = getItemTotalForAccount(b, itemId);
      if (direction === 'asc') return valA - valB;
      return valB - valA;
    });
  }

  function setSortColumn(itemId) {
    if (state.sortColumn === itemId) {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortColumn = itemId;
      state.sortDirection = 'desc';
    }
    saveSortPreference();
    renderTable();
  }

  // ------------------------------ Renderizado --------------------------------
  function getItemIconHtml(itemId, size) {
    var meta = state.itemsMeta[itemId];
    var s = size || 20;
    if (meta && meta.icon) {
      return '<img src="' + esc(meta.icon) + '" width="' + s + '" height="' + s + '" alt="" loading="lazy" style="vertical-align:middle;margin-right:6px;border-radius:3px;">';
    }
    return '';
  }

  function getItemName(itemId) {
    var meta = state.itemsMeta[itemId];
    if (meta && meta.name) return meta.name;
    // Buscar en sets
    for (var i = 0; i < state.sets.length; i++) {
      var set = state.sets[i];
      // Buscar en items planos
      if (set.items) {
        for (var j = 0; j < set.items.length; j++) {
          if (set.items[j].id === itemId) return set.items[j].name;
        }
      }
      // Buscar en tiers
      if (set.tiers) {
        var tierKeys = Object.keys(set.tiers);
        for (var t = 0; t < tierKeys.length; t++) {
          var tierItems = set.tiers[tierKeys[t]].items || [];
          for (var k = 0; k < tierItems.length; k++) {
            if (tierItems[k].id === itemId) return tierItems[k].name;
          }
        }
      }
    }
    return 'Ítem #' + itemId;
  }

  function renderSetSwitch() {
    var container = $('#idSetSwitch');
    if (!container) return;

    var html = '';
    for (var i = 0; i < state.sets.length; i++) {
      var set = state.sets[i];
      var isActive = set.id === state.activeSetId;
      html += '<button class="id-set-btn btn ' + (isActive ? 'btn--accent' : 'btn--ghost') + '" data-set="' + esc(set.id) + '" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:0.78rem;">' +
        '<img src="' + esc(set.icon) + '" width="16" height="16" alt="" style="filter:brightness(0.9);">' +
        esc(set.name) +
      '</button>';
    }

    container.innerHTML = html;

    // Badge de valor total en oro (margen derecho)
    var totalGold = getTotalGoldValue();
    var totalBadge = document.createElement('span');
    totalBadge.id = 'idTotalGoldBadge';
    totalBadge.style.cssText = 'margin-left:auto;margin-right:0;display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#0f1116;border:1px solid rgba(244,197,66,0.3);border-radius:24px;font-size:0.78rem;font-weight:600;';
    totalBadge.innerHTML = '<img src="assets/icons/619316.png" width="16" height="16" alt="" style="vertical-align:middle;">' + formatCoinValue(totalGold);
    container.appendChild(totalBadge);

    $$('.id-set-btn', container).forEach(function(btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', function() {
        var setId = btn.getAttribute('data-set');
        state.activeSetId = setId;
        state.selectedItems = [];
        saveActiveSet();
        saveSelectedItems();
        renderTierToggles();
        refreshData(false);
      });
    });
  }

  function renderItemSelector() {
    var container = $('#idItemSelector');
    if (!container) return;

    var activeSet = getActiveSet();
    var allItems = [];
    if (activeSet) {
      if (activeSet.tiers) {
        // Combinar items de todos los tiers para el dropdown
        var tierKeys = Object.keys(activeSet.tiers);
        var seen = {};
        for (var t = 0; t < tierKeys.length; t++) {
          var tierItems = activeSet.tiers[tierKeys[t]].items || [];
          for (var j = 0; j < tierItems.length; j++) {
            var item = tierItems[j];
            if (!seen[item.id]) {
              seen[item.id] = true;
              allItems.push(item);
            }
          }
        }
      } else if (activeSet.items) {
        allItems = activeSet.items.slice();
      }
    }
    // Agregar custom items
    state.customItems.forEach(function(customId) {
      if (!allItems.find(function(item) { return item.id === customId; })) {
        allItems.push({ id: customId, name: getItemName(customId) });
      }
    });

    var selectedSet = new Set(state.selectedItems.length ? state.selectedItems : allItems.map(function(item) { return item.id; }));
    var selectedNames = allItems
      .filter(function(item) { return selectedSet.has(item.id); })
      .map(function(item) { return getItemName(item.id); })
      .join(', ');

    var html = '<div style="position:relative;display:inline-block;">' +
      '<button id="idDropdownBtn" class="btn btn--ghost" style="display:inline-flex;align-items:center;gap:6px;min-width:200px;justify-content:space-between;">' +
      '<span>' + (selectedNames || 'Seleccionar ítems') + '</span>' +
      '<span>▼</span>' +
      '</button>' +
      '<div id="idDropdown" style="position:absolute;top:100%;left:0;background:#1a1c24;border:1px solid #2a2c35;border-radius:8px;padding:8px;z-index:100;min-width:280px;max-height:350px;overflow-y:auto;display:none;">' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' +
      '<button id="idSelectAllBtn" class="btn btn--xs" style="margin-bottom:4px;">✓ Seleccionar todas</button>' +
      '<button id="idSelectNoneBtn" class="btn btn--xs" style="margin-bottom:8px;">✗ Deseleccionar todas</button>';

    allItems.forEach(function(item) {
      var isSelected = selectedSet.has(item.id);
      var iconHtml = getItemIconHtml(item.id, 18);
      html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:6px;">' +
        '<input type="checkbox" value="' + item.id + '" ' + (isSelected ? 'checked' : '') + ' style="cursor:pointer;">' +
        iconHtml +
        '<span style="font-size:0.78rem;">' + esc(getItemName(item.id)) + '</span>' +
        '</label>';
    });

    html += '</div></div></div>';
    container.innerHTML = html;

    // Wire dropdown
    var dropdownBtn = document.getElementById('idDropdownBtn');
    var dropdown = document.getElementById('idDropdown');
    var selectAllBtn = document.getElementById('idSelectAllBtn');
    var selectNoneBtn = document.getElementById('idSelectNoneBtn');

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
          state.selectedItems = allItems.map(function(item) { return item.id; });
          saveSelectedItems();
          renderItemSelector();
          renderTable();
        });
      }

      if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', function() {
          state.selectedItems = [];
          saveSelectedItems();
          renderItemSelector();
          renderTable();
        });
      }

      var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
          var id = parseInt(this.value, 10);
          if (this.checked) {
            if (state.selectedItems.indexOf(id) === -1) {
              state.selectedItems.push(id);
            }
          } else {
            state.selectedItems = state.selectedItems.filter(function(cid) { return cid !== id; });
          }
          saveSelectedItems();
          renderItemSelector();
          renderTable();
        });
      });
    }
  }

  function renderTierToggles() {
    var container = $('#idTierToggles');
    if (!container) return;

    var set = getActiveSet();
    if (!set || !set.tiers) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'inline-flex';
    var tierKeys = Object.keys(set.tiers);
    var html = '';
    for (var i = 0; i < tierKeys.length; i++) {
      var tierKey = tierKeys[i];
      var tier = set.tiers[tierKey];
      var isActive = state.activeTiers.indexOf(tierKey) !== -1;
      html += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.75rem;color:#b4bad0;margin-left:12px;">' +
        '<input type="checkbox" class="id-tier-cb" data-tier="' + esc(tierKey) + '" ' + (isActive ? 'checked' : '') + '> ' + esc(tier.name) +
      '</label>';
    }
    container.innerHTML = html;

    var TIER_ORDER = ['t6', 't5', 't4', 't3'];

    var cbs = container.querySelectorAll('.id-tier-cb');
    cbs.forEach(function(cb) {
      if (cb.__wired) return;
      cb.__wired = true;
      cb.addEventListener('change', function() {
        var tierKey = this.getAttribute('data-tier');
        if (this.checked) {
          if (state.activeTiers.indexOf(tierKey) === -1) {
            state.activeTiers.push(tierKey);
          }
        } else {
          state.activeTiers = state.activeTiers.filter(function(t) { return t !== tierKey; });
        }
        // Asegurar al menos un tier activo
        if (!state.activeTiers.length) {
          state.activeTiers = ['t6'];
          this.checked = true;
        }
        // Ordenar siempre T6 → T5 → T4 → T3
        state.activeTiers.sort(function(a, b) {
          return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
        });
        saveActiveTiers();
        renderTable();
      });
    });
  }

  function renderHideToggles() {
    var container = $('#idHideToggles');
    if (!container) return;

    container.innerHTML =
      '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.75rem;color:#b4bad0;">' +
        '<input type="checkbox" id="idHideZeroRows" ' + (state.hideZeroRows ? 'checked' : '') + '> Ocultar cuentas vacías' +
      '</label>' +
      '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.75rem;color:#b4bad0;margin-left:12px;">' +
        '<input type="checkbox" id="idHideZeroCols" ' + (state.hideZeroColumns ? 'checked' : '') + '> Ocultar columnas vacías' +
      '</label>' +
      '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.75rem;color:#b4bad0;margin-left:12px;">' +
        '<input type="checkbox" id="idHideMain" ' + (state.hideMainAccounts ? 'checked' : '') + '> Ocultar cuentas main' +
      '</label>' +
      '<span id="idTierToggles" style="display:inline-flex;align-items:center;gap:4px;"></span>';

    renderTierToggles();

    var hideRowsCb = document.getElementById('idHideZeroRows');
    var hideColsCb = document.getElementById('idHideZeroCols');
    var hideMainCb = document.getElementById('idHideMain');

    if (hideRowsCb && !hideRowsCb.__wired) {
      hideRowsCb.__wired = true;
      hideRowsCb.addEventListener('change', function() {
        state.hideZeroRows = this.checked;
        saveHideZeroPrefs();
        renderTable();
      });
    }
    if (hideColsCb && !hideColsCb.__wired) {
      hideColsCb.__wired = true;
      hideColsCb.addEventListener('change', function() {
        state.hideZeroColumns = this.checked;
        saveHideZeroPrefs();
        renderTable();
      });
    }
    if (hideMainCb && !hideMainCb.__wired) {
      hideMainCb.__wired = true;
      hideMainCb.addEventListener('change', function() {
        state.hideMainAccounts = this.checked;
        saveHideZeroPrefs();
        renderTable();
      });
    }
  }

  function renderKPIs(activeItems, filteredAccounts) {
    var container = $('#idKPIs');
    if (!container) return;

    var accounts = filteredAccounts || state.accounts;
    var totalAll = 0;
    var kpis = activeItems.map(function(itemId) {
      var total = getItemTotalAcrossAll(itemId, accounts);
      totalAll += total;
      var iconHtml = getItemIconHtml(itemId, 20);
      var price = getItemSellPrice(itemId);
      var totalValue = price > 0 ? total * price : 0;
      var priceHtml = totalValue > 0
        ? '<div class="id-kpi-price">' + formatCoinValue(totalValue) + '</div>'
        : '';

      return '<div class="id-kpi-card" style="border-left:3px solid rgba(123,194,255,0.5);">' +
        '<div class="id-kpi-label">' + iconHtml + esc(getItemName(itemId)) + '</div>' +
        '<div class="id-kpi-value">' + fmtInt(total) + '</div>' +
        priceHtml +
        '</div>';
    }).join('');

    container.innerHTML = kpis;
  }

  async function renderTable() {
    var table = $('#idTable');
    if (!table) {
      var tableWrap = document.querySelector('#inventoryDashboardPanel .id-tablewrap');
      if (tableWrap) {
        tableWrap.innerHTML = '<table id="idTable" style="width:100%;border-collapse:collapse;"><thead></thead><tbody></tbody></table>';
        table = $('#idTable');
      }
      if (!table) {
        console.warn(LOG, 'Tabla #idTable no encontrada, reintentando...');
        setTimeout(function() { renderTable(); }, 100);
        return;
      }
    }

    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    var activeItems = getActiveItems();

    // Cargar metadatos faltantes (íconos) para items nuevos
    var missingMeta = activeItems.filter(function(id) { return !state.itemsMeta[id]; });
    if (missingMeta.length) {
      await loadItemsMeta(missingMeta);
      await loadPrices(missingMeta);
    }
    if (!activeItems.length) {
      thead.innerHTML = '<tr><th>Cuenta</th><th colspan="1">No hay ítems seleccionados</th></tr>';
      tbody.innerHTML = '<tr><td colspan="2">Seleccioná al menos un ítem.</td></tr>';
      return;
    }

    // Filtrar columnas en cero
    var visibleItems = activeItems;
    if (state.hideZeroColumns) {
      visibleItems = activeItems.filter(function(itemId) {
        return getItemTotalAcrossAll(itemId) > 0;
      });
    }

    if (!visibleItems.length) {
      thead.innerHTML = '<tr><th>Cuenta</th><th>Todos los ítems están en cero</th></tr>';
      tbody.innerHTML = '<tr><td colspan="2">No hay datos para mostrar.</td></tr>';
      return;
    }

    // KPIs
    var filteredAccounts = getFilteredAccounts();
    renderKPIs(visibleItems, filteredAccounts);

    // Cabecera
    var hcells = ['<th class="id-account-header">Cuenta</th>'];
    visibleItems.forEach(function(itemId) {
      var iconHtml = getItemIconHtml(itemId, 16);
      var sortIndicator = '';
      if (state.sortColumn === itemId) {
        sortIndicator = state.sortDirection === 'desc' ? ' ↓' : ' ↑';
      }
      hcells.push('<th class="right sortable" data-item-id="' + itemId + '" title="' + esc(getItemName(itemId)) + (sortIndicator ? ' ' + sortIndicator.trim() : '') + '" style="cursor:pointer;text-align:center;">' +
        iconHtml + '</th>');
    });
    thead.innerHTML = '<tr>' + hcells.join('') + '</tr>';

    // Filas
    var rowsAcc = filteredAccounts;

    var bodyRows = rowsAcc.map(function(acc) {
      var cells = [];
      var keyItem = state.keys.find(function(k) { return k.value === acc.token; });
      var tag = keyItem ? keyItem.tag : null;
      var tagIcon = tag ? getAccountTypeIcon(tag) : '';

      var charInfo = '';
      if (acc._charLoading) {
        charInfo = '<div class="id-char-info" style="font-size:0.6rem;color:#5a6072;margin-top:1px;"><img src="assets/icons/Cuentas/358353.png" width="14" height="14" alt="" style="vertical-align:middle;animation:charPulse 2s ease-in-out infinite;"> <span style="color:#5a6072;">cargando...</span></div>';
      } else if (acc.activeCharName) {
        charInfo = '<div class="id-char-info" style="font-size:0.6rem;color:#5a6072;margin-top:1px;"><img src="assets/icons/Cuentas/358353.png" width="14" height="14" alt="" style="vertical-align:middle;opacity:0.7;"> ' + esc(acc.activeCharName) + '</div>';
      }

      cells.push(
        '<td style="min-width:140px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            (tagIcon ? '<img src="' + tagIcon + '" width="20" height="20" alt="" style="border-radius:6px;flex-shrink:0;" loading="lazy">' : '') +
            '<div><strong>' + esc(acc.label) + '</strong>' + charInfo + '</div>' +
          '</div>' +
        '</td>'
      );

      visibleItems.forEach(function(itemId) {
        var value = getItemTotalForAccount(acc, itemId);
        cells.push('<td class="right" style="text-align:center;" title="' + esc(getItemName(itemId)) + ': ' + fmtInt(value) + '">' + fmtInt(value) + '</td>');
      });

      return '<tr>' + cells.join('') + '</tr>';
    }).join('');

    // Fila de totales
    var totalCells = ['<td class="total-label"><strong>TOTAL</strong></td>'];
    visibleItems.forEach(function(itemId) {
      var totalValue = getItemTotalAcrossAll(itemId, filteredAccounts);
      totalCells.push('<td class="right total-cell" style="text-align:center;"><strong>' + fmtInt(totalValue) + '</strong></td>');
    });
    var totalRow = '<tr class="total-row">' + totalCells.join('') + '</tr>';

    tbody.innerHTML = bodyRows + totalRow;

    // Eventos de ordenamiento
    updateTotalGoldBadge(filteredAccounts);

    var sortableHeaders = thead.querySelectorAll('th.sortable');
    sortableHeaders.forEach(function(th) {
      th.removeEventListener('click', th.__clickHandler);
      var itemId = parseInt(th.getAttribute('data-item-id'), 10);
      var handler = function() { setSortColumn(itemId); };
      th.__clickHandler = handler;
      th.addEventListener('click', handler);
    });
  }

  function getAccountTypeIcon(tag) {
    var icons = {
      'main': 'assets/icons/Cuentas/547827.png',
      'alter': 'assets/icons/Cuentas/157375.png',
      'f2p': 'assets/icons/Cuentas/102538.png'
    };
    return icons[tag] || '';
  }

  function updateTimestamp() {
    var tsEl = $('#idTimestamp');
    if (tsEl && state.lastRefreshTime) {
      tsEl.textContent = 'Última actualización: ' + formatTimestamp(state.lastRefreshTime);
    } else if (tsEl) {
      tsEl.textContent = '';
    }
  }

  function setStatus(msg, kind) {
    var msgEl = $('#idStatusMsg');
    if (!msgEl) return;
    msgEl.textContent = String(msg || '');
    msgEl.classList.remove('error');
    if (kind === 'error') msgEl.classList.add('error');
  }

  function showSkeleton() {
    var kpisContainer = $('#idKPIs');
    var tableWrap = document.querySelector('#inventoryDashboardPanel .id-tablewrap');

    if (kpisContainer) {
      kpisContainer.innerHTML = '<div class="id-skeleton" style="height:80px;width:100%;border-radius:12px;"></div>';
    }
    if (tableWrap) {
      tableWrap.innerHTML = '<div class="id-skeleton-table id-skeleton"></div>';
    }
  }

  async function refreshData(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    try {
      _refreshInFlight = (async () => {
        ensurePanelContent();
        showSkeleton();
        setStatus('Cargando inventarios...');

        await loadSets();
        await loadAllInventories(!!forceNoCache);

        var activeItems = getActiveItems();
        await loadItemsMeta(activeItems);
        await loadPrices(activeItems);

        setStatus('Renderizando...');
        renderSetSwitch();
        renderItemSelector();
        renderHideToggles();
        renderTable();
        updateTimestamp();
        setStatus('Listo.');
      })();
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  // ------------------------------ UI del Panel ------------------------------
  function ensurePanelContent() {
    var panel = document.getElementById('inventoryDashboardPanel');
    if (!panel) {
      console.error(LOG, 'Panel inventoryDashboardPanel no encontrado');
      return;
    }

    if (panel.querySelector('.id-content')) return;

    panel.innerHTML = '';
    var contentDiv = document.createElement('div');
    contentDiv.className = 'id-content';
    contentDiv.innerHTML =
      '<div class="panel__head">' +
        '<h2 class="panel__title" style="display:flex;align-items:center;gap:8px;">' +
          '<img src="assets/icons/Welcome/358409.png" alt="" width="28" height="28">' +
          'Dashboard de Inventario Multi-Cuenta' +
        '</h2>' +
      '</div>' +
      '<div class="panel__body">' +
        '<div id="idKPIs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;"></div>' +
        '<div class="id-filters" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px;">' +
          '<div id="idSetSwitch" style="display:flex;gap:6px;"></div>' +
          '<div id="idItemSelector"></div>' +
          '<div style="display:flex;gap:8px;margin-left:auto;">' +
            '<button id="idRefreshBtn" class="btn btn--ghost" style="display:inline-flex;align-items:center;gap:6px;">' +
              '<img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="">Refrescar' +
            '</button>' +
            '<button id="idBackBtn" class="btn btn--ghost" style="display:inline-flex;align-items:center;gap:6px;">' +
              '<img src="assets/icons/Welcome/358409.png" width="14" height="14" alt="">Volver al Inventario' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div id="idHideToggles" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"></div>' +
        '<div class="id-status-bar" style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
          '<span id="idStatusMsg" class="id-status-msg">—</span>' +
          '<span id="idTimestamp" class="id-timestamp"></span>' +
        '</div>' +
        '<style>@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.8}}@keyframes charPulse{0%,100%{opacity:0.4;filter:drop-shadow(0 0 3px rgba(123,194,255,0.3))}50%{opacity:0.85;filter:drop-shadow(0 0 6px rgba(123,194,255,0.55))}}</style>' +
        '<div class="id-tablewrap" style="overflow:auto;border:1px solid #26262b;border-radius:12px;">' +
          '<table id="idTable" style="width:100%;border-collapse:collapse;">' +
            '<thead></thead>' +
            '<tbody></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    panel.appendChild(contentDiv);
  }

  function goBackToInventory() {
    console.log(LOG, 'Volviendo a Inventario...');
    location.hash = '#/account/characters';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  // ------------------------------ API pública ------------------------------
  var InventoryDashboard = {
    _debug: function () {
      var set = getActiveSet();
      var activeItems = getActiveItems();
      return {
        version: '1.0.0',
        inited: state.inited,
        active: state.active,
        accounts: state.accounts.length,
        sets: state.sets.length,
        activeSetId: state.activeSetId,
        activeSet: set ? set.id : null,
        activeSetHasTiers: set ? !!set.tiers : false,
        activeSetHasItems: set ? !!set.items : false,
        selectedItems: state.selectedItems.length,
        activeTiers: state.activeTiers,
        activeItems: activeItems.length,
        activeItemsSample: activeItems.slice(0, 5),
        itemsMeta: Object.keys(state.itemsMeta).length,
        loading: state.loading,
        lastRefreshTime: state.lastRefreshTime,
        sortColumn: state.sortColumn,
        hideZeroRows: state.hideZeroRows,
        hideZeroColumns: state.hideZeroColumns,
        hideMainAccounts: state.hideMainAccounts,
        dom: {
          kpis: !!$('#idKPIs'),
          table: !!$('#idTable'),
          setSwitch: !!$('#idSetSwitch'),
          tierToggles: !!$('#idTierToggles'),
          tierTogglesVisible: $('#idTierToggles') ? $('#idTierToggles').style.display !== 'none' : false
        }
      };
    },

    async initOnce() {
      if (state.inited) return;
      console.log(LOG, 'initOnce()');

      loadActiveSet();
      loadSelectedItems();
      loadActiveTiers();
      loadSortPreference();
      loadHideZeroPrefs();

      state.inited = true;
    },

    async activate() {
      console.log(LOG, 'activate()');
      await this.initOnce();

      var invPanel = document.getElementById('inventoryPanel');
      if (invPanel) invPanel.setAttribute('hidden', 'hidden');

      state.active = true;
      var panel = document.getElementById('inventoryDashboardPanel');
      if (panel) panel.removeAttribute('hidden');

      ensurePanelContent();

      // Wire botones
      var refreshBtn = document.getElementById('idRefreshBtn');
      var backBtn = document.getElementById('idBackBtn');

      if (refreshBtn && !refreshBtn.__wired) {
        refreshBtn.__wired = true;
        refreshBtn.addEventListener('click', function() { refreshData(true); });
      }
      if (backBtn && !backBtn.__wired) {
        backBtn.__wired = true;
        backBtn.addEventListener('click', function() { goBackToInventory(); });
      }

      await refreshData(false);
    },

    deactivate() {
      console.log(LOG, 'deactivate()');
      state.active = false;

      var invPanel = document.getElementById('inventoryPanel');
      if (invPanel) invPanel.removeAttribute('hidden');

      var panel = document.getElementById('inventoryDashboardPanel');
      if (panel) panel.setAttribute('hidden', '');
    },

    async refresh(forceNoCache) {
      await refreshData(forceNoCache);
    }
  };

  root.InventoryDashboard = InventoryDashboard;

  console.info(LOG, 'ready v1.0.0');

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));