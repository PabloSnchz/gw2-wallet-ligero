/*!
 * Activities Theme — migración a componentes canónicos (estilo Purchase Detail)
 * v2.5.0 (2026-03-22)
 *
 * MEJORAS v2.5.0:
 *  - Barra de horarios con iconos oficiales de GW2 desde wiki
 *  - Hora server UTC y hora local con actualización en tiempo real
 *  - Cuenta regresiva para reset diario (00:00 UTC) y semanal (lunes 07:30 UTC)
 *  - Tooltips informativos con detalles de resets
 *
 * v2.4.0: Barra de horarios inicial
 * v2.3.0: Filtros por categoría (API/Janthir/Contratos)
 * v2.2.0: Estructura corregida basada en API real
 * v2.1.0: Filtros por tipo + estado con iconos
 * v2.0.0: Lista completa de desbloqueables con estado ✅/❌
 */

(function() {
  'use strict';

  console.info('[ActivitiesTheme] Inicializando migración visual v2.5.0');

  var DEBUG = false;

  function log() {
    if (DEBUG) {
      console.log.apply(console, ['[ActivitiesTheme]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ==========================================================================
  // Utilidades
  // ==========================================================================

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim().replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) { return null; }
  }

  function getNodeTypeFromId(nodeId) {
    if (!nodeId) return 'harvest';
    var id = String(nodeId).toLowerCase();
    if (/_ore_node$/.test(id) || /_(crystal|obsidian|prismaticite|mursaat|brandstone|mistonium|difluorite|quartz)/.test(id)) return 'mining';
    if (/_wood_node$/.test(id) || /petrified_stump|lowland_pine/.test(id)) return 'logging';
    if (/chest|rack|cargo|cache|pinata|crystal|pile|tree|plot|board|system|contract/.test(id)) return 'harvest';
    return 'harvest';
  }

  function getNodeIcon(type) {
    switch(type) {
      case 'mining': return '⛏';
      case 'logging': return '🪓';
      default: return '✂';
    }
  }

  function getNodeGlowColor(type) {
    switch(type) {
      case 'mining': return '#4bbdf0';
      case 'logging': return '#6bcb6b';
      default: return '#b87cff';
    }
  }

  function getNodeTypeName(type) {
    switch(type) {
      case 'mining': return 'Minería';
      case 'logging': return 'Madera';
      default: return 'Cosecha';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  function capitalizeWords(str) {
    return str.split(' ').map(function(word) {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  function getDisplayName(nodeId, customName) {
    if (customName) return customName;
    var formatted = nodeId.replace(/_/g, ' ').replace(/ node$/i, '').trim();
    return capitalizeWords(formatted);
  }

  // ==========================================================================
  // Horarios y Resets (estilo Purchase Detail con iconos GW2)
  // ==========================================================================

  // Iconos oficiales de GW2 desde wiki
  var ICON_UTC = 'https://wiki.guildwars2.com/images/thumb/1/11/World_completion_bouncy_icon_active.png/24px-World_completion_bouncy_icon_active.png';
  var ICON_LOCAL = 'https://wiki.guildwars2.com/images/6/6e/Activation.png';
  var ICON_DAILY = 'https://wiki.guildwars2.com/images/thumb/9/99/Game_menu_log_out_icon.png/24px-Game_menu_log_out_icon.png';
  var ICON_WEEKLY = 'https://wiki.guildwars2.com/images/f/f4/Tango-recharge-darker.png';

  function formatCountdownWithSeconds(ms) {
    if (!isFinite(ms) || ms <= 0) return '—';
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    s %= 86400;
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    s %= 60;
    
    var parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0 || d > 0) parts.push(String(h).padStart(2, '0') + 'h');
    if (m > 0 || h > 0 || d > 0) parts.push(String(m).padStart(2, '0') + 'm');
    parts.push(String(s).padStart(2, '0') + 's');
    
    return parts.join(' ');
  }

  function nextDailyResetUTC() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = now.getUTCMonth();
    var d = now.getUTCDate();
    var next = new Date(Date.UTC(y, m, d, 24, 0, 0, 0));
    if (next.getTime() <= Date.now()) {
      next = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    }
    return next;
  }

  function nextWeeklyResetUTC() {
    var now = new Date();
    var day = now.getUTCDay();
    var daysUntilMonday = (1 - day + 7) % 7;
    var base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 30, 0, 0));
    var next = new Date(base.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    if (next.getTime() <= Date.now()) {
      next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    return next;
  }

  function updateActivitiesClock() {
    var now = new Date();
    
    // Hora server (UTC)
    var utcHours = now.getUTCHours().toString().padStart(2, '0');
    var utcMinutes = now.getUTCMinutes().toString().padStart(2, '0');
    var utcSeconds = now.getUTCSeconds().toString().padStart(2, '0');
    var utcTime = utcHours + ':' + utcMinutes + ':' + utcSeconds;
    
    // Hora local
    var localHours = now.getHours().toString().padStart(2, '0');
    var localMinutes = now.getMinutes().toString().padStart(2, '0');
    var localSeconds = now.getSeconds().toString().padStart(2, '0');
    var localTime = localHours + ':' + localMinutes + ':' + localSeconds;
    
    // Reset diario
    var dailyReset = nextDailyResetUTC();
    var dailyMs = dailyReset.getTime() - now.getTime();
    var dailyCountdown = formatCountdownWithSeconds(dailyMs);
    
    // Reset semanal
    var weeklyReset = nextWeeklyResetUTC();
    var weeklyMs = weeklyReset.getTime() - now.getTime();
    var weeklyCountdown = formatCountdownWithSeconds(weeklyMs);
    
    // Actualizar DOM
    var utcEl = document.getElementById('activitiesUtcTime');
    var localEl = document.getElementById('activitiesLocalTime');
    var dailyEl = document.getElementById('activitiesDailyReset');
    var weeklyEl = document.getElementById('activitiesWeeklyReset');
    
    if (utcEl) utcEl.textContent = utcTime;
    if (localEl) localEl.textContent = localTime;
    if (dailyEl) dailyEl.textContent = dailyCountdown;
    if (weeklyEl) weeklyEl.textContent = weeklyCountdown;
  }

  function renderActivitiesClockBar(activitiesPanel) {
    var existingBar = activitiesPanel.querySelector('#activitiesClockBar');
    if (existingBar) existingBar.remove();
    
    var clockBar = document.createElement('div');
    clockBar.id = 'activitiesClockBar';
    clockBar.className = 'chips';
    clockBar.style.marginBottom = '16px';
    clockBar.style.display = 'flex';
    clockBar.style.flexWrap = 'wrap';
    clockBar.style.gap = '16px';
    clockBar.style.alignItems = 'center';
    clockBar.style.background = '#0f1116';
    clockBar.style.padding = '8px 16px';
    clockBar.style.borderRadius = '40px';
    clockBar.style.border = '1px solid #2a2c35';
    clockBar.style.fontFamily = 'monospace';
    clockBar.style.fontSize = '0.85rem';
    
    clockBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;" data-tip="Hora del servidor (UTC+0)">
        <img src="${ICON_UTC}" width="20" height="20" alt="UTC" style="filter: brightness(0.9);">
        <span>UTC</span>
        <strong id="activitiesUtcTime">--:--:--</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;" data-tip="Tu hora local">
        <img src="${ICON_LOCAL}" width="20" height="20" alt="Local" style="filter: brightness(0.9);">
        <span>Local</span>
        <strong id="activitiesLocalTime">--:--:--</strong>
      </div>
      <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
      <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset diario a las 00:00 UTC">
        <img src="${ICON_DAILY}" width="20" height="20" alt="Reset diario" style="filter: brightness(0.9);">
        <span>Reset diario</span>
        <strong id="activitiesDailyReset">--</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset semanal los lunes a las 07:30 UTC">
        <img src="${ICON_WEEKLY}" width="20" height="20" alt="Reset semanal" style="filter: brightness(0.9);">
        <span>Reset semanal</span>
        <strong id="activitiesWeeklyReset">--</strong>
      </div>
    `;
    
    // Buscar el lugar correcto para insertar (junto a los tabs)
    var actHead = activitiesPanel.querySelector('.act-head');
    if (actHead) {
      actHead.style.display = 'flex';
      actHead.style.alignItems = 'center';
      actHead.style.justifyContent = 'space-between';
      actHead.style.flexWrap = 'wrap';
      actHead.style.gap = '12px';
      actHead.appendChild(clockBar);
    } else {
      // Fallback: insertar después del título
      var title = activitiesPanel.querySelector('.panel__title');
      if (title && title.nextSibling) {
        title.parentNode.insertBefore(clockBar, title.nextSibling);
      } else {
        var body = activitiesPanel.querySelector('.panel__body') || activitiesPanel;
        body.insertBefore(clockBar, body.firstChild);
      }
    }
    
    // Iniciar actualización en tiempo real
    updateActivitiesClock();
    if (window.__activitiesClockInterval) clearInterval(window.__activitiesClockInterval);
    window.__activitiesClockInterval = setInterval(updateActivitiesClock, 1000);
  }

  // ==========================================================================
  // Persistencia de marcados (localStorage por día)
  // ==========================================================================

  function getTodayKey() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + 
           String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getUTCDate()).padStart(2, '0');
  }

  function loadMarkedNodes() {
    try {
      var today = getTodayKey();
      var storage = JSON.parse(localStorage.getItem('gn_home_nodes_marked') || '{}');
      return storage[today] || {};
    } catch (e) {
      return {};
    }
  }

  function saveMarkedNodes(marked) {
    try {
      var today = getTodayKey();
      var storage = JSON.parse(localStorage.getItem('gn_home_nodes_marked') || '{}');
      storage[today] = marked;
      localStorage.setItem('gn_home_nodes_marked', JSON.stringify(storage));
    } catch (e) {}
  }

  function toggleNodeMarked(nodeId, checked) {
    var marked = loadMarkedNodes();
    if (checked) {
      marked[nodeId] = true;
    } else {
      delete marked[nodeId];
    }
    saveMarkedNodes(marked);
    return marked;
  }

  // ==========================================================================
  // LISTA COMPLETA DE NODOS FÍSICOS (basado en API real)
  // ==========================================================================

  // Nodos que la API devuelve (53 elementos) - NOMBRES EXACTOS de la API
  var API_NODES = [
    'advanced_cloth_rack', 'advanced_leather_rack', 'airship_cargo', 'ancient_wood_node', 'aurilium_node',
    'bandit_chest', 'basic_cloth_rack', 'basic_harvesting_nodes', 'basic_leather_rack', 'basic_lumber_nodes',
    'basic_ore_nodes', 'bauble_gathering_system', 'black_lion_expedition_board_s4', 'bloodstone_crystals',
    'bound_hatched_chili_pepper_node', 'brandstone_node', 'candy_corn_node', 'commemorative_dragon_pinata',
    'crystallized_supply_cache', 'difluorite_crystal_cluster_node', 'dragon_crystal', 'elder_wood_node',
    'eternal_ice_shard_node', 'exalted_chest', 'flaxseed_node', 'garden_plot_01', 'garden_plot_02',
    'garden_plot_03', 'ghost_pepper_node', 'hard_wood_node', 'iron_ore_node', 'jade_fragment',
    'king_sized_candy_corn', 'kournan_supply_cache', 'krait_obelisk', 'lotus_node', 'mistborn_mote',
    'mistonium_node', 'mithril_ore_node', 'omnomberry_node', 'orichalcum_ore_node', 'orrian_oyster_node',
    'orrian_truffle_node', 'petrified_stump', 'platinum_ore_node', 'primordial_orchid', 'prismaticite_node',
    'quartz_node', 'salvage_pile', 'snow_truffle_node', 'sprocket_generator', 'winterberry_bush', 'wintersday_tree'
  ];

  // Nodos de Janthir Wilds (que pueden no estar en API aún) - 6 elementos
  var JANTHIR_NODES = [
    { id: 'honey_flower_node', name: 'Honey Flower Node', type: 'harvest', itemId: 103233 },
    { id: 'rotted_titan_amber', name: 'Rotted Titan Amber Node', type: 'mining', itemId: 103321 },
    { id: 'mursaat_obsidian_node', name: 'Mursaat Obsidian Node', type: 'mining', itemId: 103322 },
    { id: 'charged_titan_ore_node', name: 'Charged Titan Ore Node', type: 'mining', itemId: 103323 },
    { id: 'titan_heatstone_node', name: 'Titan Heatstone Node', type: 'mining', itemId: 103324 },
    { id: 'lowland_pine_sapling_node', name: 'Lowland Pine Sapling Node', type: 'logging', itemId: 103325 }
  ];

  // Elementos que NO son consultables por API (contratos, consumibles, etc.)
  var NON_API_ITEMS = [
    { id: 'enchanted_treasure_chest', name: 'Enchanted Treasure Chest', type: 'harvest', itemId: 67234, note: 'Consumible' },
    { id: 'gift_of_candy_corn', name: 'Gift of Candy Corn', type: 'mining', itemId: 48804, note: 'Consumible' },
    { id: 'gift_of_magnanimity', name: 'Gift of Magnanimity', type: 'harvest', itemId: 68367, note: 'Consumible' },
    { id: 'gift_of_quartz', name: 'Gift of Quartz', type: 'mining', itemId: 43902, note: 'Consumible' },
    { id: 'gift_of_sprockets', name: 'Gift of Sprockets', type: 'mining', itemId: 49825, note: 'Consumible' },
    { id: 'greater_gift_of_candy_corn', name: 'Greater Gift of Candy Corn', type: 'mining', itemId: 79646, note: 'Consumible' },
    { id: 'garden_plot_04', name: 'Arborstone Garden Plot Deed (4)', type: 'harvest', itemId: 88215, note: 'Jardín adicional' },
    { id: 'expedition_board_s3', name: 'Season 3 Expedition Contract', type: 'harvest', itemId: 88979, note: 'Contrato (no API)' },
    { id: 'expedition_board_eod', name: 'End of Dragons Expedition Contract', type: 'harvest', itemId: 93749, note: 'Contrato (no API)' },
    { id: 'expedition_board_soto', name: 'Secrets of the Obscure Expedition Contract', type: 'harvest', itemId: 101233, note: 'Contrato (no API)' },
    { id: 'expedition_board_janthir', name: 'Janthir Wilds Expedition Contract', type: 'harvest', itemId: 103241, note: 'Contrato (no API)' },
    { id: 'expedition_board_visions', name: 'Visions of Eternity Expedition Contract', type: 'harvest', itemId: 103242, note: 'Contrato (no API)' },
    { id: 'black_lion_hunters_contract', name: 'Black Lion Hunters Contract', type: 'harvest', itemId: 81594, note: 'Contrato (no API)' },
    { id: 'black_lion_industry_contract', name: 'Black Lion Industry Contract', type: 'harvest', itemId: 92427, note: 'Contrato (no API)' },
    { id: 'reclaimed_metal_pile', name: 'Reclaimed Metal Pile', type: 'harvest', itemId: 88410, note: 'Recuperado' }
  ];

  // ==========================================================================
  // Mapa de IDs para acceso rápido (completo)
  // ==========================================================================

  var NODE_ITEM_IDS = {};

  // Añadir IDs de nodos API (los que tienen itemId conocido)
  var API_NODE_ITEMS = {
    'advanced_cloth_rack': 81853, 'advanced_leather_rack': 81852, 'airship_cargo': 78468,
    'ancient_wood_node': 68091, 'aurilium_node': 73798, 'bandit_chest': 68495,
    'basic_cloth_rack': 67842, 'basic_harvesting_nodes': 67290, 'basic_leather_rack': 78019,
    'basic_lumber_nodes': 66769, 'basic_ore_nodes': 44884, 'bauble_gathering_system': 87324,
    'black_lion_expedition_board_s4': 91060, 'bloodstone_crystals': 79217,
    'bound_hatched_chili_pepper_node': 92035, 'brandstone_node': 86297, 'candy_corn_node': 48804,
    'commemorative_dragon_pinata': 93686, 'crystallized_supply_cache': 78549,
    'difluorite_crystal_cluster_node': 87132, 'dragon_crystal': 89786, 'elder_wood_node': 68090,
    'eternal_ice_shard_node': 92361, 'exalted_chest': 78582, 'flaxseed_node': 79063,
    'garden_plot_01': 86786, 'garden_plot_02': 86786, 'garden_plot_03': 91777,
    'ghost_pepper_node': 68093, 'hard_wood_node': 79085, 'iron_ore_node': 79260,
    'jade_fragment': 80450, 'king_sized_candy_corn': 79646, 'kournan_supply_cache': 87889,
    'krait_obelisk': 48875, 'lotus_node': 68096, 'mistborn_mote': 90773, 'mistonium_node': 88828,
    'mithril_ore_node': 68098, 'omnomberry_node': 68089, 'orichalcum_ore_node': 68094,
    'orrian_oyster_node': 81696, 'orrian_truffle_node': 68095, 'petrified_stump': 79898,
    'platinum_ore_node': 68097, 'primordial_orchid': 81115, 'prismaticite_node': 94286,
    'quartz_node': 43902, 'salvage_pile': 93503, 'snow_truffle_node': 68092,
    'sprocket_generator': 49825, 'winterberry_bush': 79903, 'wintersday_tree': 68367
  };

  Object.keys(API_NODE_ITEMS).forEach(function(key) {
    NODE_ITEM_IDS[key] = API_NODE_ITEMS[key];
  });

  // Añadir IDs de nodos Janthir
  JANTHIR_NODES.forEach(function(node) {
    NODE_ITEM_IDS[node.id] = node.itemId;
  });

  // Añadir IDs de elementos no API (para mostrar imágenes)
  NON_API_ITEMS.forEach(function(item) {
    NODE_ITEM_IDS[item.id] = item.itemId;
  });

  // ==========================================================================
  // FALLBACK: URLs de imágenes hardcodeadas
  // ==========================================================================

  var FALLBACK_ICON_URLS = {
    // Se pueden añadir según necesidad
  };

  // ==========================================================================
  // Obtener token actual
  // ==========================================================================

  function getCurrentToken() {
    if (window.__GN__ && typeof window.__GN__.getSelectedToken === 'function') {
      return window.__GN__.getSelectedToken();
    }
    if (window.Activities && window.Activities._debug) {
      return window.Activities._debug().token;
    }
    return null;
  }

  // ==========================================================================
  // API para obtener nodos desbloqueados
  // ==========================================================================

  async function fetchUnlockedNodes(token) {
    if (!token) {
      log('No hay token para obtener nodos desbloqueados');
      return [];
    }
    
    try {
      var url = 'https://api.guildwars2.com/v2/account/home/nodes?access_token=' + encodeURIComponent(token);
      var response = await fetch(url);
      if (!response.ok) {
        log('Error fetching unlocked nodes:', response.status);
        return [];
      }
      var nodes = await response.json();
      log('Nodos desbloqueados obtenidos de API:', nodes.length);
      return nodes;
    } catch (e) {
      log('Error fetching unlocked nodes:', e);
      return [];
    }
  }

  async function fetchNodeItems(itemIds) {
    if (!itemIds.length) return {};
    try {
      var url = 'https://api.guildwars2.com/v2/items?ids=' + itemIds.join(',') + '&lang=es';
      var response = await fetch(url);
      if (!response.ok) {
        log('Error fetching items from API, usando fallback');
        return getFallbackItems(itemIds);
      }
      var items = await response.json();
      var map = {};
      items.forEach(function(item) {
        if (item && item.id) map[item.id] = item;
      });
      
      itemIds.forEach(function(id) {
        if (!map[id] && FALLBACK_ICON_URLS[id]) {
          map[id] = {
            id: id,
            name: null,
            icon: FALLBACK_ICON_URLS[id]
          };
        }
      });
      
      return map;
    } catch (e) {
      log('Error fetching node items, usando fallback completo:', e);
      return getFallbackItems(itemIds);
    }
  }
  
  function getFallbackItems(itemIds) {
    var map = {};
    itemIds.forEach(function(id) {
      if (FALLBACK_ICON_URLS[id]) {
        map[id] = {
          id: id,
          name: null,
          icon: FALLBACK_ICON_URLS[id]
        };
      }
    });
    return map;
  }

  // ==========================================================================
  // Construcción de lista completa para mostrar
  // ==========================================================================

  var ALL_DISPLAY_ITEMS = [];

  // Añadir nodos API (53)
  API_NODES.forEach(function(nodeId) {
    ALL_DISPLAY_ITEMS.push({
      id: nodeId,
      name: null,
      type: getNodeTypeFromId(nodeId),
      itemId: NODE_ITEM_IDS[nodeId],
      isApiNode: true,
      category: 'api',
      displayName: getDisplayName(nodeId)
    });
  });

  // Añadir nodos Janthir (6)
  JANTHIR_NODES.forEach(function(node) {
    ALL_DISPLAY_ITEMS.push({
      id: node.id,
      name: node.name,
      type: node.type,
      itemId: node.itemId,
      isApiNode: true,
      category: 'janthir',
      displayName: node.name
    });
  });

  // Añadir elementos no API (15)
  NON_API_ITEMS.forEach(function(item) {
    ALL_DISPLAY_ITEMS.push({
      id: item.id,
      name: item.name,
      type: item.type,
      itemId: item.itemId,
      isApiNode: false,
      category: 'non-api',
      note: item.note,
      displayName: item.name
    });
  });

  // ==========================================================================
  // Renderizado con filtros
  // ==========================================================================

  var currentFilterCategory = 'all';
  var currentFilterType = 'all';
  var currentFilterStatus = 'all';
  var currentSearchTerm = '';
  var unlockedNodes = new Set();
  var currentItemsMap = {};

  function applyFiltersAndRender() {
    var filtered = ALL_DISPLAY_ITEMS.filter(function(item) {
      // Filtro por categoría
      if (currentFilterCategory !== 'all' && item.category !== currentFilterCategory) return false;
      
      // Filtro por tipo
      var type = item.type;
      if (currentFilterType !== 'all' && type !== currentFilterType) return false;
      
      // Filtro por estado (solo para nodos API)
      if (item.isApiNode && item.category === 'api') {
        var isUnlocked = unlockedNodes.has(item.id);
        if (currentFilterStatus === 'unlocked' && !isUnlocked) return false;
        if (currentFilterStatus === 'locked' && isUnlocked) return false;
      } else if (item.category === 'janthir') {
        // Nodos Janthir: siempre considerados como bloqueados (no desbloqueados)
        if (currentFilterStatus === 'unlocked') return false;
      } else {
        // Elementos no API: solo mostrar si filtro es 'all' o 'locked'
        if (currentFilterStatus === 'unlocked') return false;
      }
      
      // Filtro por búsqueda
      if (currentSearchTerm) {
        var displayName = item.displayName || getDisplayName(item.id);
        if (!displayName.toLowerCase().includes(currentSearchTerm.toLowerCase())) return false;
      }
      
      return true;
    });
    
    renderNodeGrid(filtered);
    updateCounter();
  }

  function renderNodeGrid(filteredNodes) {
    var grid = document.getElementById('homeNodesGrid');
    if (!grid) return;
    
    var marked = loadMarkedNodes();
    
    if (filteredNodes.length === 0) {
      grid.innerHTML = '<div class="muted" style="padding: 40px; text-align: center;">No se encontraron elementos de Heredad</div>';
      return;
    }
    
    grid.innerHTML = '';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
    grid.style.gap = '14px';
    
    filteredNodes.forEach(function(item) {
      var nodeId = item.id;
      var type = item.type;
      var iconChar = getNodeIcon(type);
      var glowColor = getNodeGlowColor(type);
      var isUnlocked = (item.isApiNode && item.category === 'api') ? unlockedNodes.has(nodeId) : false;
      var isChecked = !!marked[nodeId];
      var displayName = item.displayName || getDisplayName(nodeId);
      var itemIcon = currentItemsMap[item.itemId]?.icon || null;
      
      var card = document.createElement('label');
      card.className = 'card gw-node gw-node--' + type;
      card.setAttribute('data-node-id', nodeId);
      card.setAttribute('data-node-type', type);
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.2s ease';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '12px';
      card.style.padding = '14px';
      
      // Icono de tipo (grande, con glow)
      var typeIconHtml = `
        <div class="gw-node-ico" style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #0f1116;
          font-size: 24px;
          flex-shrink: 0;
        ">${iconChar}</div>
      `;
      
      // Badge de estado
      var statusBadge = '';
      if (item.category === 'api') {
        statusBadge = isUnlocked
          ? '<span class="badge badge--success" style="font-size: 0.7rem; padding: 3px 10px;">✅ Desbloqueado</span>'
          : '<span class="badge badge--info" style="font-size: 0.7rem; padding: 3px 10px;">❌ No desbloqueado</span>';
      } else if (item.category === 'janthir') {
        statusBadge = '<span class="badge badge--info" style="font-size: 0.7rem; padding: 3px 10px;">🌿 Janthir Wilds</span>';
      } else {
        statusBadge = '<span class="badge badge--info" style="font-size: 0.7rem; padding: 3px 10px;">📜 Contrato / Consumible</span>';
      }
      
      // Imagen del consumible (ícono real)
      var itemIconHtml = '';
      if (itemIcon) {
        itemIconHtml = `
          <div style="
            display: flex;
            justify-content: center;
            margin: 4px 0;
          ">
            <div style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 80px;
              height: 80px;
              background: #0f1116;
              border-radius: 16px;
              border: 1px solid #2a2c35;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
              <img src="${escapeHtml(itemIcon)}" alt="${escapeHtml(displayName)}" style="
                width: 64px;
                height: 64px;
                object-fit: contain;
                border-radius: 12px;
              ">
            </div>
          </div>
        `;
      }
      
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          ${typeIconHtml}
          <div style="flex: 1; min-width: 0;">
            <h4 class="card__title" style="
              font-size: 0.95rem;
              margin: 0 0 4px 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            " title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</h4>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span class="badge badge--info" style="font-size: 0.7rem; padding: 3px 10px;">${getNodeTypeName(type)}</span>
              ${statusBadge}
            </div>
          </div>
        </div>
        ${itemIconHtml}
        ${(item.category === 'api' && isUnlocked) ? `
        <div style="margin-top: 4px; display: flex; justify-content: flex-end;">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 3px 10px; border-radius: 20px; background: #0f1116;">
            <input type="checkbox" class="node-checkbox" data-node-id="${escapeHtml(nodeId)}" ${isChecked ? 'checked' : ''} style="margin: 0;">
            <span style="font-size: 0.75rem;">Recolectado hoy</span>
          </label>
        </div>
        ` : ''}
      `;
      
      // Aplicar glow al icono de tipo
      var rgba = hexToRGBA(glowColor, 0.45);
      if (rgba) {
        var iconContainer = card.querySelector('.gw-node-ico');
        if (iconContainer) {
          iconContainer.style.boxShadow = '0 0 0 2px ' + rgba + ', 0 0 14px ' + rgba;
        }
        card.style.border = '1px solid ' + rgba;
        card.style.boxShadow = '0 0 0 1px ' + rgba + ' inset, 0 0 12px ' + rgba;
      }
      
      grid.appendChild(card);
    });
    
    document.querySelectorAll('.node-checkbox').forEach(function(cb) {
      cb.removeEventListener('change', handleCheckboxChange);
      cb.addEventListener('change', handleCheckboxChange);
    });
  }
  
  function handleCheckboxChange(e) {
    var nodeId = e.target.getAttribute('data-node-id');
    var checked = e.target.checked;
    toggleNodeMarked(nodeId, checked);
    updateCounter();
  }
  
  function updateCounter() {
    var marked = loadMarkedNodes();
    var unlockedList = ALL_DISPLAY_ITEMS.filter(function(item) {
      return item.category === 'api' && unlockedNodes.has(item.id);
    });
    var totalUnlocked = unlockedList.length;
    var completed = Object.keys(marked).filter(function(id) { 
      return unlockedNodes.has(id) && marked[id]; 
    }).length;
    var percentage = totalUnlocked > 0 ? Math.round(completed / totalUnlocked * 100) : 0;
    
    var counterEl = document.getElementById('homeNodesCounter');
    if (counterEl) {
      counterEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span>📦 ${completed} / ${totalUnlocked} desbloqueados recolectados hoy (${percentage}%)</span>
          <span class="badge ${completed === totalUnlocked ? 'badge--success' : (completed > 0 ? 'badge--warning' : 'badge--info')}">
            ${completed === totalUnlocked ? '✅ Completado' : (completed > 0 ? '⏳ En progreso' : '📋 Pendiente')}
          </span>
        </div>
        <div style="margin-top: 4px; font-size: 0.7rem; color: #a0a0a6;">
          🔓 Total desbloqueados: ${totalUnlocked} / ${ALL_DISPLAY_ITEMS.filter(i => i.category === 'api').length}
        </div>
      `;
      counterEl.style.fontSize = '0.8rem';
      counterEl.style.padding = '8px 12px';
      counterEl.style.background = '#0f1116';
      counterEl.style.borderRadius = '12px';
      counterEl.style.border = '1px solid #2a2c35';
      counterEl.style.marginBottom = '16px';
    }
  }

  async function renderHomeNodes(activitiesPanel) {
    var token = getCurrentToken();
    var unlockedNodeList = await fetchUnlockedNodes(token);
    
    unlockedNodes.clear();
    unlockedNodeList.forEach(function(nodeId) {
      unlockedNodes.add(nodeId);
    });
    log('Nodos desbloqueados en cuenta:', unlockedNodes.size);
    
    // Obtener IDs de ítems para todos los elementos
    var itemIds = [];
    ALL_DISPLAY_ITEMS.forEach(function(item) {
      if (item.itemId) itemIds.push(item.itemId);
    });
    
    currentItemsMap = await fetchNodeItems(itemIds);
    
    var existingContainer = activitiesPanel.querySelector('#homeNodesContainer');
    if (existingContainer) existingContainer.remove();
    
    var container = document.createElement('div');
    container.id = 'homeNodesContainer';
    
    // Barra de filtros completa con categorías, tipos y estado
    var filterBar = document.createElement('div');
    filterBar.className = 'chips';
    filterBar.style.marginBottom = '16px';
    filterBar.style.display = 'flex';
    filterBar.style.flexWrap = 'wrap';
    filterBar.style.gap = '8px';
    filterBar.style.alignItems = 'center';
    filterBar.style.background = '#0f1116';
    filterBar.style.padding = '8px 12px';
    filterBar.style.borderRadius = '40px';
    filterBar.innerHTML = `
      <div style="flex: 1; min-width: 180px;">
        <input type="text" id="homeNodesSearch" placeholder="🔍 Buscar..." style="width: 100%; background: #1a1c24; border: 1px solid #2a2c35; border-radius: 20px; padding: 6px 12px; color: #e0e4ed;">
      </div>
      <div class="chip" style="padding: 0;">
        <button data-category="all" class="btn btn--ghost filter-category-btn active" style="border-radius: 20px;">📦 Todos</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-category="api" class="btn btn--ghost filter-category-btn" style="border-radius: 20px;">🟢 Nodos API (53)</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-category="janthir" class="btn btn--ghost filter-category-btn" style="border-radius: 20px;">🌿 Janthir (6)</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-category="non-api" class="btn btn--ghost filter-category-btn" style="border-radius: 20px;">📜 Contratos (15)</button>
      </div>
      <div style="width: 1px; height: 28px; background: #2a2c35; margin: 0 4px;"></div>
      <div class="chip" style="padding: 0;">
        <button data-type="all" class="btn btn--ghost filter-type-btn active" style="border-radius: 20px;">📋 Todos</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-type="mining" class="btn btn--ghost filter-type-btn" style="border-radius: 20px;">⛏ Minería</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-type="logging" class="btn btn--ghost filter-type-btn" style="border-radius: 20px;">🪓 Madera</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-type="harvest" class="btn btn--ghost filter-type-btn" style="border-radius: 20px;">✂ Cosecha</button>
      </div>
      <div style="width: 1px; height: 28px; background: #2a2c35; margin: 0 4px;"></div>
      <div class="chip" style="padding: 0;">
        <button data-status="all" class="btn btn--ghost filter-status-btn active" style="border-radius: 20px;">🔓 Todos</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-status="unlocked" class="btn btn--ghost filter-status-btn" style="border-radius: 20px;">✅ Desbloqueado</button>
      </div>
      <div class="chip" style="padding: 0;">
        <button data-status="locked" class="btn btn--ghost filter-status-btn" style="border-radius: 20px;">❌ Bloqueado</button>
      </div>
    `;
    
    var counter = document.createElement('div');
    counter.id = 'homeNodesCounter';
    
    var grid = document.createElement('div');
    grid.id = 'homeNodesGrid';
    grid.className = 'grid';
    
    container.appendChild(filterBar);
    container.appendChild(counter);
    container.appendChild(grid);
    
    var body = activitiesPanel.querySelector('.panel__body') || activitiesPanel;
    var existingGrid = body.querySelector('#homeNodesGrid');
    var existingTitle = body.querySelector('.panel-head__title');
    
    if (existingTitle && existingTitle.textContent === 'Home nodes') existingTitle.remove();
    if (existingGrid) existingGrid.parentElement?.remove();
    
    var separator = body.querySelector('.hr-hairline');
    if (separator && separator.classList.contains('hr-hairline')) separator.remove();
    
    var newTitle = document.createElement('h3');
    newTitle.className = 'panel-head__title';
    newTitle.style.margin = '6px 0 10px';
    newTitle.textContent = 'Home nodes';
    
    var newHr = document.createElement('hr');
    newHr.className = 'hr-hairline';
    
    body.appendChild(newHr);
    body.appendChild(newTitle);
    body.appendChild(container);
    
    var searchInput = document.getElementById('homeNodesSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        currentSearchTerm = e.target.value;
        applyFiltersAndRender();
      });
    }
    
    // Bind eventos de filtros de categoría
    var categoryBtns = document.querySelectorAll('.filter-category-btn');
    categoryBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        categoryBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilterCategory = btn.getAttribute('data-category');
        applyFiltersAndRender();
      });
    });
    
    // Bind eventos de filtros de tipo
    var typeBtns = document.querySelectorAll('.filter-type-btn');
    typeBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        typeBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilterType = btn.getAttribute('data-type');
        applyFiltersAndRender();
      });
    });
    
    // Bind eventos de filtros de estado
    var statusBtns = document.querySelectorAll('.filter-status-btn');
    statusBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        statusBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilterStatus = btn.getAttribute('data-status');
        applyFiltersAndRender();
      });
    });
    
    applyFiltersAndRender();
    return true;
  }
  
  function showEmptyHomeNodes(activitiesPanel) {
    var existingContainer = activitiesPanel.querySelector('#homeNodesContainer');
    if (existingContainer) existingContainer.remove();
    
    var emptyMessage = document.createElement('div');
    emptyMessage.id = 'homeNodesContainer';
    emptyMessage.className = 'muted';
    emptyMessage.style.padding = '20px';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.innerHTML = 'No se encontraron elementos de Heredad.';
    
    var body = activitiesPanel.querySelector('.panel__body') || activitiesPanel;
    var existingGrid = body.querySelector('#homeNodesGrid');
    var existingTitle = body.querySelector('.panel-head__title');
    
    if (existingTitle && existingTitle.textContent === 'Home nodes') existingTitle.remove();
    if (existingGrid) existingGrid.parentElement?.remove();
    
    var separator = body.querySelector('.hr-hairline');
    if (separator && separator.classList.contains('hr-hairline')) separator.remove();
    
    var newTitle = document.createElement('h3');
    newTitle.className = 'panel-head__title';
    newTitle.style.margin = '6px 0 10px';
    newTitle.textContent = 'Home nodes';
    
    var newHr = document.createElement('hr');
    newHr.className = 'hr-hairline';
    
    body.appendChild(newHr);
    body.appendChild(newTitle);
    body.appendChild(emptyMessage);
  }

  async function enhanceHomeNodes(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) {
      log('ActivitiesPanel no visible, skip HomeNodes');
      return false;
    }
    return await renderHomeNodes(activitiesPanel);
  }

  // ==========================================================================
  // Resto de mejoras (KPIs, PSNA, etc.)
  // ==========================================================================

  function enhanceCards(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    activitiesPanel.querySelectorAll('.card').forEach(function(card) {
      if (!card.classList.contains('card-enhanced')) card.classList.add('card-enhanced');
    });
  }

  function enhanceKPIs(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var kpiStrip = activitiesPanel.querySelector('#kpiDailyStrip');
    if (kpiStrip && !kpiStrip.classList.contains('kpi-enhanced')) {
      kpiStrip.classList.add('kpi-enhanced');
      kpiStrip.querySelectorAll('.kpi-badge').forEach(function(badge) {
        if (!badge.classList.contains('pill')) badge.classList.add('pill');
        if (badge.textContent.includes('✅')) badge.classList.add('badge--success');
        else if (badge.textContent.includes('⏳')) badge.classList.add('badge--warning');
        else badge.classList.add('badge--info');
      });
    }
  }

  function enhancePSNA(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var psnaGrid = activitiesPanel.querySelector('#psnaGrid');
    if (psnaGrid && !psnaGrid.classList.contains('psna-enhanced')) {
      psnaGrid.classList.add('psna-enhanced');
      psnaGrid.querySelectorAll('[data-psna-copy]').forEach(function(btn) {
        if (!btn.classList.contains('btn-enhanced')) {
          btn.classList.add('btn-enhanced');
          btn.style.transition = 'all 0.1s ease';
        }
      });
    }
  }

  function enhanceEcto(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var ectoGrid = activitiesPanel.querySelector('#ectoGrid');
    if (ectoGrid && !ectoGrid.classList.contains('ecto-enhanced')) {
      ectoGrid.classList.add('ecto-enhanced');
      ectoGrid.querySelectorAll('.pill').forEach(function(pill) {
        if (pill.classList.contains('s-ok')) pill.classList.add('badge', 'badge--success');
        else if (pill.classList.contains('s-pending')) pill.classList.add('badge', 'badge--warning');
      });
    }
  }

  function enhanceWorldBosses(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var wbBody = activitiesPanel.querySelector('#wbBody');
    if (wbBody && !wbBody.classList.contains('wb-enhanced')) {
      wbBody.classList.add('wb-enhanced');
      wbBody.querySelectorAll('[data-wb-copy]').forEach(function(btn) {
        if (!btn.classList.contains('btn-enhanced')) {
          btn.classList.add('btn-enhanced');
          btn.style.transition = 'all 0.1s ease';
        }
      });
    }
  }

  function enhanceWeeklies(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var actWeekly = activitiesPanel.querySelector('#actWeekly');
    if (actWeekly && !actWeekly.classList.contains('weekly-enhanced')) {
      actWeekly.classList.add('weekly-enhanced');
      ['#pillKey', '#pillLeivas'].forEach(function(sel) {
        var pill = actWeekly.querySelector(sel);
        if (pill) {
          if (pill.classList.contains('s-ok')) pill.classList.add('badge', 'badge--success');
          else if (pill.classList.contains('s-pending')) pill.classList.add('badge', 'badge--warning');
        }
      });
    }
  }

  function enhanceFractales(activitiesPanel) {
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) return;
    var fractalsBody = activitiesPanel.querySelector('#fractalsBody');
    if (fractalsBody && !fractalsBody.classList.contains('fractals-enhanced')) {
      fractalsBody.classList.add('fractals-enhanced');
    }
  }

  // ==========================================================================
  // Aplicar todas las mejoras
  // ==========================================================================

  async function applyActivitiesTheme() {
    var activitiesPanel = document.getElementById('activitiesPanel');
    if (!activitiesPanel || activitiesPanel.hasAttribute('hidden')) {
      log('ActivitiesPanel no visible, esperando...');
      return false;
    }

    log('Aplicando mejoras visuales a Activities (panel visible)');

    // Primero renderizar la barra de horarios
    renderActivitiesClockBar(activitiesPanel);
    
    // Luego el resto de mejoras
    enhanceCards(activitiesPanel);
    enhanceKPIs(activitiesPanel);
    enhancePSNA(activitiesPanel);
    enhanceEcto(activitiesPanel);
    enhanceWorldBosses(activitiesPanel);
    enhanceWeeklies(activitiesPanel);
    enhanceFractales(activitiesPanel);
    await enhanceHomeNodes(activitiesPanel);
    
    return true;
  }

  // ==========================================================================
  // Observadores e inicialización
  // ==========================================================================

  function observeActivitiesPanel() {
    var panel = document.getElementById('activitiesPanel');
    if (!panel || panel.__activitiesObserver) return;

    var observer = new MutationObserver(function(mutations) {
      if (!panel.hasAttribute('hidden')) {
        log('ActivitiesPanel se ha hecho visible');
        setTimeout(function() { applyActivitiesTheme(); }, 100);
      }
    });
    
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    panel.__activitiesObserver = observer;
    log('Observer de visibilidad de Activities activado');
  }

  function initActivitiesTheme() {
    observeActivitiesPanel();
    setTimeout(function() { applyActivitiesTheme(); }, 200);
  }

  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'activities') {
      log('gn:tabchange -> activities');
      setTimeout(function() { applyActivitiesTheme(); }, 300);
    }
  });

  document.addEventListener('gn:tokenchange', function() {
    setTimeout(function() { applyActivitiesTheme(); }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initActivitiesTheme);
  } else {
    initActivitiesTheme();
  }

  console.info('[ActivitiesTheme] ready v2.5.0 — barra de horarios con iconos GW2 oficiales');
})();