/*!
 * js/inventory-hub.js — Inventario y Personajes (Hub principal)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.3.1 (2026-05-03)
 *
 * v1.3.1:
 *  - Fix: KPIs en fila al volver de una sección
 *  - Materiales organizados con las categorías del juego (10 categorías)
 *  - Armería organizada por tipo de ítem (armas, armaduras, espaldares, etc.)
 *  - Fix: Links de Wiki en español (wiki-es.guildwars2.com)
 *
 * v1.3.0:
 *  - Modal de ítem con stats reales de la API y formato de monedas
 *  - Vistas de detalle por sección (Materiales, Banco, Armería)
 */

(function (root) {
  'use strict';
  var LOG = '[InventoryHub]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    RARITY_ORDER: ['Chatarra', 'Básico', 'Bueno', 'Obra maestra', 'Raro', 'Exótico', 'Ascendido', 'Legendario'],
    RARITY_COLORS: {
      'Chatarra': '#AAAAAA', 'Básico': '#FFFFFF', 'Bueno': '#62A4DA',
      'Obra maestra': '#1A9306', 'Raro': '#FCD00B', 'Exótico': '#FFA405',
      'Ascendido': '#FB3E8D', 'Legendario': '#974EFF'
    },
    ITEMS_PER_ROW: 5,
    MAX_VISIBLE_ITEMS: 25,
    BANK_SLOTS_PER_PAGE: 30,
    WIKI_BASE: 'https://wiki-es.guildwars2.com/wiki/',
    ICONS: {
      module: 'assets/icons/Welcome/358409.png',
      characters: 'assets/icons/156678.png',
      search: 'assets/icons/Welcome/3124974.png',
      refresh: 'assets/icons/Welcome/834002.png',
      bank: 'assets/icons/Cuentas/156670.png',
      materials: 'assets/icons/Cuentas/255373.png',
      legendary: 'assets/icons/Cuentas/157085.png',
      character: 'assets/icons/Cuentas/156409.png',
      close: 'assets/icons/Welcome/156107.png',
      copy: 'assets/icons/Welcome/155911.png',
      wiki: 'assets/icons/Welcome/222580.png',
      back: 'assets/icons/Welcome/358409.png'
    },
    TYPE_LABELS: {
      'Armor': 'Armadura', 'Weapon': 'Arma', 'Trinket': 'Baratija',
      'Consumable': 'Consumible', 'Container': 'Contenedor',
      'Gathering': 'Herramienta', 'CraftingMaterial': 'Material de fabricación',
      'Trophy': 'Trofeo', 'UpgradeComponent': 'Componente de mejora',
      'Bag': 'Bolsa', 'Back': 'Mochila', 'Gizmo': 'Artilugio',
      'MiniPet': 'Miniatura', 'Tool': 'Herramienta'
    },
    WEIGHT_LABELS: {
      'Heavy': 'Pesada', 'Medium': 'Media', 'Light': 'Ligera', 'Clothing': 'Ropa'
    },
    DAMAGE_LABELS: {
      'Fire': 'Fuego', 'Ice': 'Hielo', 'Lightning': 'Rayo',
      'Physical': 'Físico', 'Choking': 'Asfixia'
    },
    ATTRIBUTE_LABELS: {
      'Power': 'Potencia', 'Precision': 'Precisión', 'Toughness': 'Dureza',
      'Vitality': 'Vitalidad', 'ConditionDamage': 'Daño de condición',
      'Healing': 'Curación', 'Ferocity': 'Ferocidad',
      'Concentration': 'Concentración', 'Expertise': 'Pericia',
      'AgonyResistance': 'Resistencia a la agonía'
    },
    FLAG_LABELS: {
      'AccountBound': 'Ligado a cuenta', 'SoulbindOnUse': 'Se liga al usar',
      'SoulBindOnUse': 'Se liga al usar', 'Unique': 'Único',
      'NoSalvage': 'No reciclable', 'NoSell': 'No vendible',
      'NotUpgradeable': 'No mejorable', 'HideSuffix': 'Sin sufijo',
      'NoMysticForge': 'No Forja Mística', 'MonsterOnly': 'Solo monstruos'
    },
    // Categorías de materiales como en el juego (IDs de referencia)
    MATERIAL_CATEGORIES: [
      { key: 'basic', label: 'Materiales de artesanía básicos', desc: 'Materiales crudos cosechados para una amplia variedad de componentes', ids: [
        19694, 19695, 19696, 19697, 19698, 19699, 19700, 19701, 19702, 19703,
        19704, 19705, 19706, 19707, 19708, 19709, 19710, 19711, 19712, 19713,
        19714, 19715, 19716, 19717, 19718, 19719, 24295, 24296, 24297, 24298,
        24299, 24300, 24301, 24302, 24303, 24304, 24305, 24306, 24307, 24308
      ]},
      { key: 'intermediate', label: 'Materiales de artesanía intermedios', desc: 'Elementos para elaborar inscripciones e insignias', ids: [
        19720, 19721, 19722, 19723, 19724, 19725, 19726, 19727, 19728, 19729,
        19730, 19731, 19732, 19733, 19734, 19735, 19736, 19737, 19738, 19739
      ]},
      { key: 'advanced', label: 'Materiales de artesanía avanzados', desc: 'Elementos para crear runas, sellos y objetos legendarios', ids: [
        19740, 19741, 19742, 19743, 19744, 19745, 19746, 19747, 19748, 19749,
        19750, 19751, 19752, 19753, 19754, 19755, 19756, 19757, 19758, 19759
      ]},
      { key: 'ascended', label: 'Materiales ascendidos', desc: 'Elementos utilizados en la fabricación ascendida y legendaria', ids: [
        46747, 46748, 46749, 46750, 46751, 46752, 46753, 46754,
        46755, 46756, 46757, 46758, 46759, 46760, 46761, 46762,
        74090, 74091, 74092, 74093, 74094, 74095, 74096, 74097
      ]},
      { key: 'gems', label: 'Gemas y joyas', desc: 'Materiales utilizados principalmente por joyeros', ids: [
        19679, 19680, 19681, 19682, 19683, 19684, 19685, 19686, 19687, 19688,
        19689, 19690, 19691, 19692, 19693
      ]},
      { key: 'cooking_raw', label: 'Materiales de cocina', desc: 'Materias primas para cocinar', ids: [
        12134, 12135, 12136, 12137, 12138, 12139, 12140, 12141, 12142, 12143,
        12144, 12145, 12146, 12147, 12148, 12149, 12150, 12151, 12152, 12153
      ]},
      { key: 'cooking_prep', label: 'Ingredientes para cocinar', desc: 'Materiales de cocina parcialmente preparados', ids: [
        12154, 12155, 12156, 12157, 12158, 12159, 12160, 12161, 12162, 12163,
        12164, 12165, 12166, 12167, 12168, 12169, 12170, 12171, 12172, 12173
      ]},
      { key: 'scribe', label: 'Materiales de recetas', desc: 'Materiales utilizados principalmente por los escribas', ids: [
        19760, 19761, 19762, 19763, 19764, 19765, 19766, 19767, 19768, 19769,
        19770, 19771, 19772, 19773, 19774, 19775, 19776, 19777, 19778, 19779
      ]},
      { key: 'festive', label: 'Materiales festivos', desc: 'Materiales asociados con eventos festivos', ids: [
        19780, 19781, 19782, 19783, 19784, 19785, 19786, 19787, 19788, 19789,
        19790, 19791, 19792, 19793, 19794, 19795, 19796, 19797, 19798, 19799
      ]},
      { key: 'other', label: 'Otros materiales', desc: 'Materiales sin categoría específica', ids: [] }
    ],
    // Categorías de armería por tipo
    ARMORY_CATEGORIES: [
      { key: 'weapons', label: 'Armas', types: ['Weapon'] },
      { key: 'armors', label: 'Armaduras', types: ['Armor'] },
      { key: 'backs', label: 'Espaldares', types: ['Back'] },
      { key: 'trinkets', label: 'Abalorios y baratijas', types: ['Trinket'] },
      { key: 'other', label: 'Otros', types: [] }
    ]
  };

  // =======================================================================
  // ESTADO
  // =======================================================================
  var state = {
    inited: false, active: false, token: null,
    bank: [], materials: [], armory: [], characters: [],
    itemsById: new Map(),
    filters: { q: '', rarity: '', location: 'all' },
    kpis: { bankUsed: 0, bankTotal: 0, materialsCount: 0, armoryCount: 0, characterCount: 0 },
    loading: false,
    view: 'hub',
    activeSection: null,
    bankPage: 0
  };

  var _refreshInFlight = null;
  var _refreshSeq = 0;

  // =======================================================================
  // UTILIDADES
  // =======================================================================
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function(m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]); }); }
  function fmtInt(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function getSelectedToken() {
    try {
      var sel = document.getElementById('keySelectGlobal');
      if (sel && sel.value) return sel.value.trim();
      return localStorage.getItem('gw2_selected_key_v1') || null;
    } catch (e) { return null; }
  }
  function getItemName(item) { return item ? (item.name || ('Ítem #' + item.id)) : '—'; }
  function getRarityColor(r) { return CONFIG.RARITY_COLORS[r] || '#FFFFFF'; }
  function getRarityLabel(r) {
    var map = {
      'Junk': 'Chatarra', 'Basic': 'Básico', 'Fine': 'Bueno',
      'Masterwork': 'Obra maestra', 'Rare': 'Raro', 'Exotic': 'Exótico',
      'Ascended': 'Ascendido', 'Legendary': 'Legendario'
    };
    return map[r] || r || '—';
  }
  function getTypeLabel(t) { return CONFIG.TYPE_LABELS[t] || t || '—'; }
  function getWeightLabel(w) { return CONFIG.WEIGHT_LABELS[w] || w || '—'; }
  function getDamageLabel(d) { return CONFIG.DAMAGE_LABELS[d] || d || '—'; }
  function getAttributeLabel(a) { return CONFIG.ATTRIBUTE_LABELS[a] || a || '—'; }
  function getFlagLabel(f) { return CONFIG.FLAG_LABELS[f] || f || '—'; }
  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex).replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
      var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    } catch(_) { return 'rgba(255,255,255,' + alpha + ')'; }
  }
  function formatCoins(copper) {
    if (!copper || copper <= 0) return '<span style="color:#9aa2b8;">—</span>';
    var g = Math.floor(copper / 10000);
    var s = Math.floor((copper % 10000) / 100);
    var c = copper % 100;
    var parts = [];
    if (g > 0) parts.push('<span style="color:#f4c542;font-weight:600;">' + g + '</span> <span style="color:#9aa2b8;">o</span>');
    if (s > 0) parts.push('<span style="color:#e0e0e0;font-weight:500;">' + s + '</span> <span style="color:#9aa2b8;">p</span>');
    if (c > 0 || parts.length === 0) parts.push('<span style="color:#b87333;font-weight:500;">' + c + '</span> <span style="color:#9aa2b8;">c</span>');
    return parts.join(' ');
  }

  // =======================================================================
  // CARGA DE DATOS
  // =======================================================================
  async function loadAllData(forceNoCache) {
    var token = getSelectedToken();
    state.token = token;
    if (!token) { state.bank = []; state.materials = []; state.armory = []; state.characters = []; return; }
    state.loading = true;

    try {
      var res = await Promise.all([
        root.GW2Api.getAccountBank(token, { nocache: !!forceNoCache }),
        root.GW2Api.getAccountMaterials(token, { nocache: !!forceNoCache }),
        root.GW2Api.getAccountLegendaryArmory(token, { nocache: !!forceNoCache })
      ]);
      state.bank = Array.isArray(res[0]) ? res[0] : [];
      state.materials = Array.isArray(res[1]) ? res[1] : [];
      state.armory = Array.isArray(res[2]) ? res[2] : [];
      if (root.Characters && typeof root.Characters.getCharacterList === 'function') {
        state.characters = root.Characters.getCharacterList() || [];
      } else { state.characters = []; }

      state.kpis.bankUsed = state.bank.filter(function(item) { return item !== null; }).length;
      state.kpis.bankTotal = state.bank.length;
      state.kpis.materialsCount = state.materials.filter(function(m) { return m.count > 0; }).length;
      state.kpis.armoryCount = state.armory.length;
      state.kpis.characterCount = state.characters.length;

      await loadItemsMetadata();
    } catch (e) { console.warn(LOG, 'Error loading data:', e); }
    finally { state.loading = false; }
  }

  async function loadItemsMetadata() {
    var itemIds = new Set();
    state.bank.forEach(function(item) { if (item && item.id) itemIds.add(item.id); });
    state.materials.forEach(function(m) { if (m && m.id) itemIds.add(m.id); });
    state.armory.forEach(function(item) { if (item && item.id) itemIds.add(item.id); });
    var ids = Array.from(itemIds).filter(function(id) { return !state.itemsById.has(id); });
    if (ids.length > 0) {
      try {
        var items = await root.GW2Api.getItemsMany(ids, { nocache: false });
        items.forEach(function(item) { if (item && item.id) state.itemsById.set(item.id, item); });
      } catch (e) { console.warn(LOG, 'Error loading items metadata:', e); }
    }
  }

  // =======================================================================
  // CONSTRUIR DATOS POR SECCIÓN
  // =======================================================================
  function buildSectionData() {
    var f = state.filters;
    var hasSearch = !!f.q;

    var sections = {
      materials: { label: 'Materiales', icon: CONFIG.ICONS.materials, groups: {}, allItems: [] },
      bank:       { label: 'Banco',      icon: CONFIG.ICONS.bank,      groups: {}, allItems: [] },
      armory:     { label: 'Armería',    icon: CONFIG.ICONS.legendary,  groups: {}, allItems: [] }
    };

    // Materiales
    state.materials.forEach(function(m) {
      if (!m || m.count <= 0) return;
      var meta = state.itemsById.get(m.id);
      var matches = matchesFiltersHub(meta, { id: m.id, count: m.count }, f, rarity);
      var rarityRaw = meta ? (meta.rarity || 'Basic') : 'Basic';
      var rarity = getRarityLabel(rarityRaw);
      var entry = { item: { id: m.id, count: m.count }, meta: meta, count: m.count, rarity: rarity, location: 'materials', locationLabel: 'Materiales' };
      if (matches) sections.materials.allItems.push(entry);
      if (!sections.materials.groups[rarity]) sections.materials.groups[rarity] = { rarity: rarity, count: 0, types: 0 };
      sections.materials.groups[rarity].count += m.count;
      sections.materials.groups[rarity].types += 1;
    });

    // Banco
    state.bank.forEach(function(item, index) {
      if (!item) return;
      var meta = state.itemsById.get(item.id);
      var matches = matchesFiltersHub(meta, item, f, rarity);
      var rarityRaw = meta ? (meta.rarity || 'Basic') : 'Basic';
      var rarity = getRarityLabel(rarityRaw);
      var entry = { item: item, meta: meta, count: item.count || 1, rarity: rarity, location: 'bank', locationLabel: 'Banco', slot: index };
      if (matches) sections.bank.allItems.push(entry);
      if (!sections.bank.groups[rarity]) sections.bank.groups[rarity] = { rarity: rarity, count: 0, types: 0 };
      sections.bank.groups[rarity].count += (item.count || 1);
      sections.bank.groups[rarity].types += 1;
    });

    // Armería
    state.armory.forEach(function(item) {
      if (!item) return;
      var meta = state.itemsById.get(item.id);
      var matches = matchesFiltersHub(meta, item, f, rarity);
      var rarity = 'Legendario';
      var entry = { item: item, meta: meta, count: item.count || 1, rarity: rarity, location: 'armory', locationLabel: 'Armería' };
      if (matches) sections.armory.allItems.push(entry);
      if (!sections.armory.groups[rarity]) sections.armory.groups[rarity] = { rarity: rarity, count: 0, types: 0 };
      sections.armory.groups[rarity].count += (item.count || 1);
      sections.armory.groups[rarity].types += 1;
    });

    ['materials', 'bank', 'armory'].forEach(function(loc) {
      var all = sections[loc].allItems;
      all.sort(function(a, b) {
        var ra = CONFIG.RARITY_ORDER.indexOf(a.rarity);
        var rb = CONFIG.RARITY_ORDER.indexOf(b.rarity);
        if (rb !== ra) return rb - ra;
        return getItemName(a.meta).localeCompare(getItemName(b.meta), 'es');
      });
      var limit = hasSearch ? CONFIG.MAX_VISIBLE_ITEMS : CONFIG.ITEMS_PER_ROW;
      sections[loc].allItems = all.slice(0, limit);
    });

    return sections;
  }

  function matchesFiltersHub(meta, item, filters, entryRarity) {
    if (!meta) {
      if (filters.q) { if (!String(item.id).includes(filters.q.toLowerCase())) return false; }
      if (filters.rarity) return false;
      return true;
    }
    if (filters.q) {
      var name = getItemName(meta).toLowerCase();
      var desc = (meta.description || '').toLowerCase();
      var q = filters.q.toLowerCase();
      if (!name.includes(q) && !desc.includes(q)) return false;
    }
    if (filters.rarity) {
      var rarityToCheck = entryRarity || getRarityLabel(meta.rarity || '');
      if (rarityToCheck !== filters.rarity) return false;
    }
    return true;
  }

  // =======================================================================
  // RENDER: HUB PRINCIPAL
  // =======================================================================
  function renderHubKPIs() {
    var container = $('#invKPIs');
    if (!container) return;

    // Asegurar que el contenedor tenga display grid
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
    container.style.gap = '10px';
    container.style.marginBottom = '16px';

    var kpis = [
      { icon: CONFIG.ICONS.materials, label: 'Materiales', value: fmtInt(state.kpis.materialsCount), color: '#a0ffc8', section: 'materials' },
      { icon: CONFIG.ICONS.bank, label: 'Banco', value: state.kpis.bankUsed + ' / ' + state.kpis.bankTotal, color: '#7bc2ff', section: 'bank' },
      { icon: CONFIG.ICONS.legendary, label: 'Legendarios', value: fmtInt(state.kpis.armoryCount), color: '#974EFF', section: 'armory' },
      { icon: CONFIG.ICONS.character, label: 'Personajes', value: fmtInt(state.kpis.characterCount), color: '#ffd36b', section: null },
      { icon: CONFIG.ICONS.characters, label: 'Ver Personajes', value: '→', color: '#ffd966', isLink: true }
    ];

    container.innerHTML = kpis.map(function(kpi) {
      var cardStyle = 'background:#0f1116;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;border-left:3px solid ' + kpi.color + ';';
      if (kpi.section) cardStyle += 'cursor:pointer;';
      return '<div class="inv-kpi-card"' +
        (kpi.section ? ' data-section="' + kpi.section + '"' : '') +
        (kpi.isLink ? ' id="invGoToChars"' : '') +
        ' style="' + cardStyle + '">' +
        '<div style="width:40px;height:40px;border-radius:10px;background:#0a0c10;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<img src="' + kpi.icon + '" width="24" height="24" alt="">' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.7rem;color:#9aa2b8;text-transform:uppercase;letter-spacing:0.5px;">' + esc(kpi.label) + '</div>' +
          '<div style="font-size:1.1rem;font-weight:700;color:#e0e4ed;">' + kpi.value + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderHubFilters() {
    var container = $('#invFilters');
    if (!container) return;

    container.style.display = '';

    var rarityOptions = CONFIG.RARITY_ORDER.map(function(r) {
      return '<option value="' + r + '" ' + (state.filters.rarity === r ? 'selected' : '') + '>' + r + '</option>';
    }).join('');

    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div style="position:relative;flex:1;min-width:200px;">' +
          '<img src="' + CONFIG.ICONS.search + '" width="14" height="14" alt="" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:0.4;pointer-events:none;">' +
          '<input type="text" id="invSearchInput" placeholder="Buscar en inventario..." value="' + esc(state.filters.q) + '" style="width:100%;padding:9px 12px 9px 34px;background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;font-size:0.82rem;transition:border-color 0.15s ease,box-shadow 0.15s ease;" onfocus="this.style.borderColor=\'#5276ff\';this.style.boxShadow=\'0 0 0 2px rgba(82,118,255,0.15)\'" onblur="this.style.borderColor=\'#2a2c35\';this.style.boxShadow=\'none\'">' +
        '</div>' +
        '<select id="invRarityFilter" style="background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;padding:8px 32px 8px 12px;font-size:0.78rem;cursor:pointer;transition:border-color 0.15s ease;appearance:none;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="%239aa2b8"/></svg>\');background-repeat:no-repeat;background-position:right 10px center;"><option value="">Todas las rarezas</option>' + rarityOptions + '</select>' +
        '<button id="invRefreshBtn" class="btn btn--ghost" title="Refrescar datos" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;font-size:0.78rem;transition:all 0.15s ease;">' +
          '<img src="' + CONFIG.ICONS.refresh + '" width="14" height="14" alt="" style="opacity:0.7;"> Refrescar' +
        '</button>' +
      '</div>';
  }

  function renderHubResults() {
    var container = $('#invResults');
    if (!container) return;

    if (state.loading) {
      container.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px;">' +
        // Skeleton KPIs
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:8px;">' +
          Array(5).fill('<div style="height:64px;background:linear-gradient(90deg,#1a1c24 25%,#252830 50%,#1a1c24 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:10px;border-left:3px solid #2a2c35;"></div>').join('') +
        '</div>' +
        // Skeleton secciones
        Array(3).fill(
          '<div>' +
            '<div style="height:20px;width:120px;background:linear-gradient(90deg,#1a1c24 25%,#252830 50%,#1a1c24 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:6px;margin-bottom:8px;"></div>' +
            '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
              Array(4).fill('<div style="height:22px;width:70px;background:linear-gradient(90deg,#1a1c24 25%,#252830 50%,#1a1c24 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:12px;"></div>').join('') +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">' +
              Array(5).fill('<div style="height:40px;background:linear-gradient(90deg,#1a1c24 25%,#252830 50%,#1a1c24 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:8px;border-left:3px solid #2a2c35;"></div>').join('') +
            '</div>' +
          '</div>'
        ).join('<div style="height:1px;background:#1f2026;margin:4px 0;"></div>') +
      '</div>';
      return;
    }

    if (!state.token) {
      container.innerHTML = '<div class="muted" style="text-align:center;padding:40px;">🔑 Seleccioná una API Key para ver tu inventario</div>';
      return;
    }

    var sections = buildSectionData();

    var hasAny = false;
    ['materials', 'bank', 'armory'].forEach(function(loc) {
      if (sections[loc].allItems.length > 0) hasAny = true;
    });

    if (!hasAny) {
      container.innerHTML = '<div class="muted" style="text-align:center;padding:40px;">🔍 No se encontraron objetos con los filtros actuales</div>';
      return;
    }

    var locIcons = {
      materials: CONFIG.ICONS.materials,
      bank: CONFIG.ICONS.bank,
      armory: CONFIG.ICONS.legendary
    };
    var locOrder = ['materials', 'bank', 'armory'];

    var html = '<div style="display:flex;flex-direction:column;gap:16px;">';

    locOrder.forEach(function(loc) {
      var sec = sections[loc];
      if (!sec) return;
      if (loc === 'armory' && sec.allItems.length === 0 && Object.keys(sec.groups).length === 0) return;

      html += '<div class="inv-section-header" data-section="' + loc + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;border-radius:10px;transition:all 0.15s ease;background:#0a0c10;border:1px solid #1a1c24;margin-top:4px;">' +
        '<div style="width:32px;height:32px;border-radius:8px;background:#0f1116;display:flex;align-items:center;justify-content:center;border:1px solid #1f2026;">' +
          '<img src="' + (locIcons[loc] || '') + '" width="18" height="18" alt="">' +
        '</div>' +
        '<div style="flex:1;">' +
          '<strong style="font-size:0.85rem;color:#e0e4ed;">' + esc(sec.label) + '</strong>' +
          '<div style="font-size:0.65rem;color:#9aa2b8;">' + esc(Object.keys(sec.groups).length + ' rarezas') + '</div>' +
        '</div>' +
        '<span style="color:#5276ff;font-size:0.7rem;font-weight:600;">Explorar →</span>' +
      '</div>';

      var groupKeys = Object.keys(sec.groups);
      if (groupKeys.length > 0) {
        var sortedGroups = groupKeys.sort(function(a, b) {
          return CONFIG.RARITY_ORDER.indexOf(b) - CONFIG.RARITY_ORDER.indexOf(a);
        });

        html += '<div class="inv-rarity-row">';
        sortedGroups.forEach(function(rarity) {
          var g = sec.groups[rarity];
          var rarityColor = getRarityColor(rarity);
          var isActive = state.filters.rarity === rarity;
          html += '<div class="inv-rarity-chip" data-rarity="' + esc(rarity) + '" style="' +
            'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;' +
            'background:' + (isActive ? hexToRGBA(rarityColor, 0.12) : '#1a1c24') + ';' +
            'border:1px solid ' + (isActive ? rarityColor : '#2a2c35') + ';' +
            'color:' + (isActive ? rarityColor : '#b4bad0') + ';font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s ease;' +
            '">' +
            '<span style="color:' + rarityColor + ';">' + esc(rarity) + '</span>' +
            '<span style="opacity:0.6;">' + fmtInt(g.types) + 't</span>' +
          '</div>';
        });
        html += '</div>';
      }

      // Aplicar filtro de rareza a los items visibles
      var filteredItems = sec.allItems;
      if (state.filters.rarity) {
        filteredItems = sec.allItems.filter(function(entry) {
          return entry.rarity === state.filters.rarity;
        });
      }

      if (filteredItems.length > 0) {
        html += '<div class="inv-items-grid">';
        filteredItems.forEach(function(entry) {
          var meta = entry.meta;
          var name = getItemName(meta);
          var icon = meta && meta.icon ? meta.icon : '';
          var rarityColor = getRarityColor(entry.rarity);
          var count = entry.count;

          html += '<div class="inv-item-card" data-entry="' + esc(JSON.stringify({ location: entry.location, itemId: entry.item.id, slot: entry.slot })) + '" style="' +
            'display:flex;align-items:center;gap:6px;padding:4px 8px;min-width:0;' +
            'background:#0f1116;border:1px solid rgba(255,255,255,0.08);border-radius:8px;' +
            'border-left:3px solid ' + rarityColor + ';cursor:pointer;' +
            '">' +
            '<div style="width:28px;height:28px;border-radius:6px;background:#0a0c10;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' +
              (icon ? '<img src="' + esc(icon) + '" width="22" height="22" alt="" loading="lazy" style="border-radius:3px;">' : '<span style="font-size:0.7rem;">📦</span>') +
            '</div>' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-weight:600;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(name) + '">' + esc(name) + '</div>' +
            '</div>' +
            (count > 1 ? '<span style="font-weight:700;color:#ffd36b;font-size:0.7rem;flex-shrink:0;">×' + fmtInt(count) + '</span>' : '') +
          '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="muted" style="font-size:0.75rem;padding:6px 0;">Sin ítems para mostrar.</div>';
      }
    });

    html += '</div>';
    container.innerHTML = html;

    wireHubChips(container);
    wireHubItemCards(container);
    wireHubSectionHeaders(container);
  }

  function wireHubChips(container) {
    $$('.inv-rarity-chip', container).forEach(function(chip) {
      if (chip.__wiredHubChip) return;
      chip.__wiredHubChip = true;
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        var rarity = chip.getAttribute('data-rarity');
        state.filters.rarity = (state.filters.rarity === rarity) ? '' : rarity;
        var rarityFilter = document.getElementById('invRarityFilter');
        if (rarityFilter) rarityFilter.value = state.filters.rarity;
        renderHubResults();
      });
    });
  }

  function wireHubItemCards(container) {
    // Wire armor weight filter chips
    var armorFilters = container.querySelectorAll('.inv-armor-chip');
    armorFilters.forEach(function(chip) {
      if (chip.__wiredArmor) return;
      chip.__wiredArmor = true;
      chip.addEventListener('click', function() {
        var weight = chip.getAttribute('data-weight');

        // Actualizar estilo de chips
        armorFilters.forEach(function(c) {
          var isActive = c.getAttribute('data-weight') === weight;
          c.style.background = isActive ? 'rgba(123,194,255,0.12)' : '#1a1c24';
          c.style.borderColor = isActive ? 'rgba(123,194,255,0.3)' : '#2a2c35';
          c.style.color = isActive ? '#7bc2ff' : '#b4bad0';
        });

        // Filtrar items en la misma categoría
        var catDiv = chip.closest('.inv-armory-cat');
        if (!catDiv) return;
        var itemCards = catDiv.querySelectorAll('.inv-item-card');
        itemCards.forEach(function(card) {
          var itemWeight = card.getAttribute('data-weight') || '';
          if (weight === 'all' || itemWeight === weight) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    $$('.inv-item-card', container).forEach(function(card) {
      if (card.__wiredHubItem) return;
      card.__wiredHubItem = true;
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          var entryData = JSON.parse(card.getAttribute('data-entry'));
          openItemModal(entryData);
        } catch(err) {
          console.warn(LOG, 'Error parsing entry data', err);
        }
      });
    });
  }

  function wireHubSectionHeaders(container) {
    $$('.inv-section-header', container).forEach(function(header) {
      if (header.__wiredHubHeader) return;
      header.__wiredHubHeader = true;
      header.addEventListener('click', function() {
        var section = header.getAttribute('data-section');
        openSectionView(section);
      });
    });
  }

  function renderHub() {
    var kpis = $('#invKPIs');
    var filters = $('#invFilters');
    if (kpis) kpis.style.display = 'grid';
    if (filters) filters.style.display = '';
    renderHubKPIs();
    renderHubFilters();
    renderHubResults();
    wireHubEvents();
  }

  // =======================================================================
  // VISTA DE SECCIÓN
  // =======================================================================
  function openSectionView(section) {
    state.view = 'section';
    state.activeSection = section;
    state.filters.q = '';
    state.filters.rarity = '';
    state.bankPage = 0;
    renderSectionView();
  }

  function renderSectionView() {
    var container = $('#invResults');
    if (!container) return;

    var kpis = $('#invKPIs');
    var filters = $('#invFilters');
    if (kpis) kpis.style.display = 'none';
    if (filters) filters.style.display = 'none';

    var secLabels = { materials: 'Materiales', bank: 'Banco', armory: 'Armería' };
    var secIcons = { materials: CONFIG.ICONS.materials, bank: CONFIG.ICONS.bank, armory: CONFIG.ICONS.legendary };
    var label = secLabels[state.activeSection] || '';
    var icon = secIcons[state.activeSection] || '';

    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
        '<button id="invBackToHub" class="btn btn--ghost" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;">' +
          '<img src="' + CONFIG.ICONS.back + '" width="14" height="14" alt="">← Volver al inventario' +
        '</button>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<img src="' + icon + '" width="20" height="20" alt="">' +
          '<strong style="font-size:0.95rem;">' + esc(label) + '</strong>' +
        '</div>' +
        '<div style="flex:1;"></div>' +
        '<div style="position:relative;">' +
          '<img src="' + CONFIG.ICONS.search + '" width="14" height="14" alt="" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);opacity:0.5;">' +
          '<input type="text" id="invSectionSearch" placeholder="Buscar en ' + esc(label.toLowerCase()) + '..." style="padding:6px 10px 6px 28px;background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;font-size:0.8rem;width:200px;">' +
        '</div>' +
      '</div>' +
      '<div id="invSectionContent"></div>';

    if (state.activeSection === 'materials') renderMaterialsDetail();
    else if (state.activeSection === 'bank') renderBankDetail();
    else if (state.activeSection === 'armory') renderArmoryDetail();

    wireSectionEvents();
  }

  // ============ DETALLE: MATERIALES (CON CATEGORÍAS DEL JUEGO) ============
  function renderMaterialsDetail() {
    var container = $('#invResults');
    if (!container) return;

    var materials = state.materials.filter(function(m) { return m && m.count > 0; });
    var searchQ = (document.getElementById('invSectionSearch')?.value || '').toLowerCase();

    // Construir set de IDs por categoría para búsqueda rápida
    var catIdSets = {};
    CONFIG.MATERIAL_CATEGORIES.forEach(function(cat) {
      if (cat.key !== 'other') {
        catIdSets[cat.key] = new Set(cat.ids);
      }
    });

    var categorized = {};
    var otherMaterials = [];

    materials.forEach(function(m) {
      var meta = state.itemsById.get(m.id);
      var name = getItemName(meta).toLowerCase();
      if (searchQ && !name.includes(searchQ)) return;

      var matched = false;
      for (var i = 0; i < CONFIG.MATERIAL_CATEGORIES.length; i++) {
        var cat = CONFIG.MATERIAL_CATEGORIES[i];
        if (cat.key === 'other') continue;
        if (catIdSets[cat.key] && catIdSets[cat.key].has(m.id)) {
          if (!categorized[cat.key]) categorized[cat.key] = [];
          categorized[cat.key].push({ material: m, meta: meta, count: m.count });
          matched = true;
          break;
        }
      }
      if (!matched) {
        otherMaterials.push({ material: m, meta: meta, count: m.count });
      }
    });

    if (otherMaterials.length > 0) {
      categorized['other'] = otherMaterials;
    }

    var html = '';

    // Recorrer en el orden definido
    CONFIG.MATERIAL_CATEGORIES.forEach(function(cat) {
      var items = categorized[cat.key];
      if (!items || items.length === 0) return;

      html += '<div style="margin-bottom:16px;">' +
        '<div style="margin-bottom:6px;">' +
          '<div style="font-size:0.8rem;font-weight:600;color:#b4bad0;">' + esc(cat.label) + ' (' + items.length + ')</div>' +
          '<div class="muted" style="font-size:0.65rem;">' + esc(cat.desc) + '</div>' +
        '</div>' +
        '<div style="border-bottom:1px solid #1f2026;margin-bottom:8px;"></div>' +
        '<div class="inv-items-grid">';

      items.sort(function(a, b) {
        return getItemName(a.meta).localeCompare(getItemName(b.meta), 'es');
      });

      items.forEach(function(entry) {
        var meta = entry.meta;
        var name = getItemName(meta);
        var icon = meta && meta.icon ? meta.icon : '';
        var rarityLabel = getRarityLabel(meta ? meta.rarity : 'Basic');
        var rarityColor = getRarityColor(rarityLabel);
        var count = entry.count;

        html += '<div class="inv-item-card" data-entry="' + esc(JSON.stringify({ location: 'materials', itemId: entry.material.id })) + '" style="' +
          'display:flex;align-items:center;gap:8px;padding:6px 10px;min-width:0;' +
          'background:#0f1116;border:1px solid rgba(255,255,255,0.08);border-radius:8px;' +
          'border-left:3px solid ' + rarityColor + ';cursor:pointer;' +
          '">' +
          '<div style="width:32px;height:32px;border-radius:6px;background:#0a0c10;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' +
            (icon ? '<img src="' + esc(icon) + '" width="24" height="24" alt="" loading="lazy" style="border-radius:4px;">' : '<span style="font-size:0.8rem;">📦</span>') +
          '</div>' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-weight:600;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(name) + '">' + esc(name) + '</div>' +
          '</div>' +
          '<span style="font-weight:700;color:#ffd36b;font-size:0.8rem;flex-shrink:0;">×' + fmtInt(count) + '</span>' +
        '</div>';
      });

      html += '</div></div>';
    });

    if (!html) {
      html = '<div class="muted" style="text-align:center;padding:40px;">🔍 No se encontraron materiales.</div>';
    }

    var content = document.getElementById('invSectionContent');
    if (content) content.innerHTML = '<div style="margin-top:12px;">' + html + '</div>';

    // Wire armor weight filter chips
    var armorFilters = container.querySelectorAll('.inv-armor-chip');
    armorFilters.forEach(function(chip) {
      if (chip.__wiredArmor) return;
      chip.__wiredArmor = true;
      chip.addEventListener('click', function() {
        var weight = chip.getAttribute('data-weight');

        // Actualizar estilo de chips
        armorFilters.forEach(function(c) {
          var isActive = c.getAttribute('data-weight') === weight;
          c.style.background = isActive ? 'rgba(123,194,255,0.12)' : '#1a1c24';
          c.style.borderColor = isActive ? 'rgba(123,194,255,0.3)' : '#2a2c35';
          c.style.color = isActive ? '#7bc2ff' : '#b4bad0';
        });

        // Filtrar items en la misma categoría
        var catDiv = chip.closest('.inv-armory-cat');
        if (!catDiv) return;
        var itemCards = catDiv.querySelectorAll('.inv-item-card');
        itemCards.forEach(function(card) {
          var itemWeight = card.getAttribute('data-weight') || '';
          if (weight === 'all' || itemWeight === weight) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    $$('.inv-item-card', container).forEach(function(card) {
      if (card.__wiredSectionItem) return;
      card.__wiredSectionItem = true;
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          var entryData = JSON.parse(card.getAttribute('data-entry'));
          openItemModal(entryData);
        } catch(err) {}
      });
    });
  }

  // ============ DETALLE: BANCO ============
  function renderBankDetail() {
    var container = $('#invResults');
    if (!container) return;

    var searchQ = (document.getElementById('invSectionSearch')?.value || '').toLowerCase();

    // Si hay búsqueda, filtrar sobre todo el banco sin nulls
    var allBankItems = state.bank;
    var bankIndices = [];
    for (var i = 0; i < state.bank.length; i++) { bankIndices.push(i); }

    if (searchQ) {
      var filtered = [];
      var filteredIndices = [];
      for (var j = 0; j < state.bank.length; j++) {
        var item = state.bank[j];
        if (!item || !item.id) continue;
        var meta = state.itemsById.get(item.id);
        var name = getItemName(meta).toLowerCase();
        if (name.includes(searchQ)) {
          filtered.push(item);
          filteredIndices.push(j);
        }
      }
      allBankItems = filtered;
      bankIndices = filteredIndices;
    }

    var totalPages = Math.ceil(allBankItems.length / CONFIG.BANK_SLOTS_PER_PAGE);
    if (state.bankPage >= totalPages) state.bankPage = 0;
    if (state.bankPage < 0) state.bankPage = 0;

    var start = state.bankPage * CONFIG.BANK_SLOTS_PER_PAGE;
    var end = Math.min(start + CONFIG.BANK_SLOTS_PER_PAGE, allBankItems.length);
    var pageItems = allBankItems.slice(start, end);

    var html = '';

    if (totalPages > 1) {
      html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">' +
        '<button id="invBankPrev" class="btn btn--ghost btn--xs" ' + (state.bankPage === 0 ? 'disabled' : '') + '>← Anterior</button>' +
        '<span class="muted" style="font-size:0.75rem;">Slots ' + (start + 1) + '-' + end + ' de ' + allBankItems.length + (searchQ ? ' (filtrados)' : '') + '</span>' +
        '<button id="invBankNext" class="btn btn--ghost btn--xs" ' + (state.bankPage >= totalPages - 1 ? 'disabled' : '') + '>Siguiente →</button>' +
      '</div>';
    } else {
      var displayTotal = searchQ ? allBankItems.length : state.bank.length;
      html += '<div class="muted" style="text-align:center;font-size:0.75rem;margin-bottom:8px;">' + displayTotal + ' slots' + (searchQ ? ' (' + state.bank.length + ' totales)' : '') + ' · ' + state.kpis.bankUsed + ' ocupados</div>';
    }

    html += '<div style="display:grid;grid-template-columns:repeat(10, 1fr);gap:4px;">';

    pageItems.forEach(function(item, idx) {
      var slotNum = (bankIndices[idx] != null ? bankIndices[idx] : start + idx) + 1;
      var slotStyle = 'aspect-ratio:1;background:#0a0c10;border:1px solid #1f2026;border-radius:8px;display:flex;align-items:center;justify-content:center;';

      if (item && item.id) {
        var meta = state.itemsById.get(item.id);
        var icon = meta && meta.icon ? meta.icon : '';
        var name = getItemName(meta);
        var rarityLabel = getRarityLabel(meta ? meta.rarity : 'Basic');
        var rarityColor = getRarityColor(rarityLabel);
        var count = item.count || 1;

        // Resaltar si matchea la búsqueda
        var highlightStyle = '';
        if (searchQ && name.toLowerCase().includes(searchQ)) {
          highlightStyle = 'box-shadow:0 0 0 2px #ffd36b;z-index:1;';
        }

        html += '<div class="inv-bank-slot" data-entry="' + esc(JSON.stringify({ location: 'bank', itemId: item.id, slot: slotNum - 1 })) + '" ' +
          'style="' + slotStyle + 'cursor:pointer;border-color:' + hexToRGBA(rarityColor, 0.4) + ';position:relative;overflow:hidden;' + highlightStyle + '"' +
          'title="' + esc(name) + (count > 1 ? ' ×' + count : '') + ' (Slot ' + slotNum + ')">' +
          (icon ? '<img src="' + esc(icon) + '" alt="" loading="lazy" style="width:80%;height:80%;object-fit:contain;border-radius:4px;">' : '<span style="font-size:0.7rem;">📦</span>') +
          (count > 1 ? '<span style="position:absolute;bottom:1px;right:2px;font-size:0.6rem;color:#ffd36b;font-weight:700;background:rgba(0,0,0,0.85);padding:1px 3px;border-radius:3px;">' + count + '</span>' : '') +
        '</div>';
      } else {
        var isEmpty = item === null;
        html += '<div style="' + slotStyle + 'opacity:' + (isEmpty ? '0.2' : '0.08') + ';font-size:0.5rem;color:#9aa2b8;">' + (isEmpty ? slotNum : '') + '</div>';
      }
    });

    html += '</div>';

    var content = document.getElementById('invSectionContent');
    if (content) content.innerHTML = '<div style="margin-top:12px;">' + html + '</div>';

    $$('.inv-bank-slot', container).forEach(function(slot) {
      if (slot.__wiredBankSlot) return;
      slot.__wiredBankSlot = true;
      slot.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          var entryData = JSON.parse(slot.getAttribute('data-entry'));
          openItemModal(entryData);
        } catch(err) {}
      });
    });

    // Wirear botones de paginación cada vez que se renderiza
    var prevBtn = document.getElementById('invBankPrev');
    var nextBtn = document.getElementById('invBankNext');
    if (prevBtn) {
      prevBtn.__wiredPrev = false;
      prevBtn.addEventListener('click', function handler() {
        if (state.bankPage > 0) {
          state.bankPage--;
          renderBankDetail();
        }
      });
    }
    if (nextBtn) {
      nextBtn.__wiredNext = false;
      nextBtn.addEventListener('click', function handler() {
        var searchQ = (document.getElementById('invSectionSearch')?.value || '').toLowerCase();
        var count = searchQ ? 
          state.bank.filter(function(item) { 
            if (!item || !item.id) return false;
            var meta = state.itemsById.get(item.id);
            return getItemName(meta).toLowerCase().includes(searchQ);
          }).length : 
          state.bank.length;
        var totalPages = Math.ceil(count / CONFIG.BANK_SLOTS_PER_PAGE);
        if (state.bankPage < totalPages - 1) {
          state.bankPage++;
          renderBankDetail();
        }
      });
    }
  }

  // ============ DETALLE: ARMERÍA (POR TIPO) ============
  function renderArmoryDetail() {
    var container = $('#invResults');
    if (!container) return;

    var searchQ = (document.getElementById('invSectionSearch')?.value || '').toLowerCase();

    var items = state.armory.filter(function(item) {
      if (!item) return false;
      if (searchQ) {
        var meta = state.itemsById.get(item.id);
        var name = getItemName(meta).toLowerCase();
        if (!name.includes(searchQ)) return false;
      }
      return true;
    });

    var html = '';

    if (items.length === 0) {
      html = '<div class="muted" style="text-align:center;padding:40px;">🔍 No se encontraron objetos en la armería.</div>';
    } else {
      // Agrupar por tipo
      var byType = {};
      items.forEach(function(item) {
        var meta = state.itemsById.get(item.id);
        var type = meta ? meta.type : 'Other';
        if (!byType[type]) byType[type] = [];
        byType[type].push({ item: item, meta: meta });
      });

      // Recorrer categorías en orden
      CONFIG.ARMORY_CATEGORIES.forEach(function(cat) {
        var catItems = [];

        if (cat.key === 'other') {
          // Todos los tipos que no están en otras categorías
          Object.keys(byType).forEach(function(type) {
            var found = false;
            for (var i = 0; i < CONFIG.ARMORY_CATEGORIES.length - 1; i++) {
              if (CONFIG.ARMORY_CATEGORIES[i].types.indexOf(type) !== -1) {
                found = true;
                break;
              }
            }
            if (!found && byType[type]) {
              catItems = catItems.concat(byType[type]);
            }
          });
        } else {
          cat.types.forEach(function(type) {
            if (byType[type]) {
              catItems = catItems.concat(byType[type]);
            }
          });
        }

        if (catItems.length === 0) return;

        html += '<div class="inv-armory-cat" data-cat-key="' + cat.key + '" style="margin-bottom:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:4px 0;border-bottom:1px solid #1f2026;flex-wrap:wrap;gap:8px;">' +
            '<span style="font-size:0.8rem;font-weight:600;color:#b4bad0;">' + esc(cat.label) + ' (' + catItems.length + ')</span>' +
            (cat.key === 'armors' ?
              '<div class="inv-armor-filters" style="display:flex;gap:6px;">' +
                '<button class="inv-armor-chip active" data-weight="all" style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;background:rgba(123,194,255,0.12);border:1px solid rgba(123,194,255,0.3);color:#7bc2ff;cursor:pointer;transition:all 0.15s ease;">Todas</button>' +
                '<button class="inv-armor-chip" data-weight="Heavy" style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#1a1c24;border:1px solid #2a2c35;color:#b4bad0;cursor:pointer;transition:all 0.15s ease;">Pesada</button>' +
                '<button class="inv-armor-chip" data-weight="Medium" style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#1a1c24;border:1px solid #2a2c35;color:#b4bad0;cursor:pointer;transition:all 0.15s ease;">Media</button>' +
                '<button class="inv-armor-chip" data-weight="Light" style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;background:#1a1c24;border:1px solid #2a2c35;color:#b4bad0;cursor:pointer;transition:all 0.15s ease;">Ligera</button>' +
              '</div>' : '') +
          '</div>' +
          '<div class="inv-items-grid">';

        catItems.forEach(function(entry) {
          var meta = entry.meta;
          var name = getItemName(meta);
          var icon = meta && meta.icon ? meta.icon : '';
          var rarityColor = getRarityColor('Legendario');
          var type = getTypeLabel(meta ? meta.type : '');

          var weightClass = (meta && meta.details && meta.details.weight_class) ? meta.details.weight_class : '';
          html += '<div class="inv-item-card" data-entry="' + esc(JSON.stringify({ location: 'armory', itemId: entry.item.id })) + '" data-weight="' + weightClass + '" style="' +
            'display:flex;align-items:center;gap:6px;padding:6px 10px;min-width:0;' +
            'background:#0f1116;border:1px solid rgba(255,255,255,0.08);border-radius:8px;' +
            'border-left:3px solid ' + rarityColor + ';cursor:pointer;' +
            '">' +
            '<div style="width:32px;height:32px;border-radius:6px;background:#0a0c10;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' +
              (icon ? '<img src="' + esc(icon) + '" width="24" height="24" alt="" loading="lazy" style="border-radius:4px;">' : '<span style="font-size:0.8rem;">📦</span>') +
            '</div>' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-weight:600;font-size:0.8rem;color:' + rarityColor + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(name) + '">' + esc(name) + '</div>' +
              '<div style="font-size:0.65rem;color:#9aa2b8;">' + esc(type) + '</div>' +
            '</div>' +
          '</div>';
        });

        // Wire armor filter chips after render
        if (cat.key === 'armors') {
          html += '<script>document.addEventListener("DOMContentLoaded",function(){})</scr' + 'ipt>';
        }
        html += '</div></div>';
      });
    }

    var content = document.getElementById('invSectionContent');
    if (content) content.innerHTML = '<div style="margin-top:12px;">' + html + '</div>';

    // Wire armor weight filter chips
    var armorFilters = container.querySelectorAll('.inv-armor-chip');
    armorFilters.forEach(function(chip) {
      if (chip.__wiredArmor) return;
      chip.__wiredArmor = true;
      chip.addEventListener('click', function() {
        var weight = chip.getAttribute('data-weight');

        // Actualizar estilo de chips
        armorFilters.forEach(function(c) {
          var isActive = c.getAttribute('data-weight') === weight;
          c.style.background = isActive ? 'rgba(123,194,255,0.12)' : '#1a1c24';
          c.style.borderColor = isActive ? 'rgba(123,194,255,0.3)' : '#2a2c35';
          c.style.color = isActive ? '#7bc2ff' : '#b4bad0';
        });

        // Filtrar items en la misma categoría
        var catDiv = chip.closest('.inv-armory-cat');
        if (!catDiv) return;
        var itemCards = catDiv.querySelectorAll('.inv-item-card');
        itemCards.forEach(function(card) {
          var itemWeight = card.getAttribute('data-weight') || '';
          if (weight === 'all' || itemWeight === weight) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    $$('.inv-item-card', container).forEach(function(card) {
      if (card.__wiredSectionItem) return;
      card.__wiredSectionItem = true;
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          var entryData = JSON.parse(card.getAttribute('data-entry'));
          openItemModal(entryData);
        } catch(err) {}
      });
    });
  }

  function wireSectionEvents() {
    var backBtn = document.getElementById('invBackToHub');
    var searchInput = document.getElementById('invSectionSearch');
    var prevBtn = document.getElementById('invBankPrev');
    var nextBtn = document.getElementById('invBankNext');

    if (backBtn && !backBtn.__wiredBack) {
      backBtn.__wiredBack = true;
      backBtn.addEventListener('click', function() {
        state.view = 'hub';
        state.activeSection = null;
        state.filters.q = '';
        state.filters.rarity = '';
        var kpis = $('#invKPIs');
        var filters = $('#invFilters');
        if (kpis) kpis.style.display = 'grid';
        if (filters) filters.style.display = '';
        renderHub();
      });
    }

    if (searchInput && !searchInput.__wiredSearch) {
      searchInput.__wiredSearch = true;
      var t = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(t);
        t = setTimeout(function() {
          state.bankPage = 0;
          var currentView = state.activeSection;
          if (currentView === 'materials') {
            renderMaterialsDetail();
          } else if (currentView === 'bank') {
            renderBankDetail();
          } else if (currentView === 'armory') {
            renderArmoryDetail();
          }
        }, 200);
      });
    }

    // Botones de paginación del banco se wirean en renderBankDetail()
  }
  

  // =======================================================================
  // MODAL DE ÍTEM (MEJORADO — WIKI EN ESPAÑOL)
  // =======================================================================
  function openItemModal(entryData) {
    var meta = state.itemsById.get(entryData.itemId);
    if (!meta) {
      console.warn(LOG, 'No metadata for item', entryData.itemId);
      return;
    }

    var locIcons = {
      materials: CONFIG.ICONS.materials,
      bank: CONFIG.ICONS.bank,
      armory: CONFIG.ICONS.legendary
    };
    var locLabels = { materials: 'Materiales', bank: 'Banco', armory: 'Armería' };

    var rarityLabel = getRarityLabel(meta.rarity || 'Basic');
    var rarityColor = getRarityColor(rarityLabel);
    var typeLabel = getTypeLabel(meta.type);
    var name = getItemName(meta);
    var icon = meta.icon || '';
    var description = meta.description || '';
    var level = meta.level || '—';
    var vendorValue = meta.vendor_value || 0;
    var chatLink = meta.chat_link || '';
    var details = meta.details || {};
    var flags = meta.flags || [];

    var detailRows = '';

    detailRows += detailRow('Rareza', '<span style="color:' + rarityColor + ';font-weight:600;">' + esc(rarityLabel) + '</span>');
    detailRows += detailRow('Tipo', esc(typeLabel));
    detailRows += detailRow('Nivel', esc(String(level)));

    if (meta.type === 'Weapon') {
      detailRows += detailRow('Daño', (details.min_power || '—') + ' - ' + (details.max_power || '—') + ' (' + esc(getDamageLabel(details.damage_type)) + ')');
    }

    if (meta.type === 'Armor') {
      detailRows += detailRow('Defensa', esc(String(details.defense || '—')) + ' · ' + esc(getWeightLabel(details.weight_class)));
    }

    if (details.infix_upgrade) {
      var attrs = details.infix_upgrade.attributes || [];
      if (attrs.length > 0) {
        var statStr = attrs.map(function(a) {
          return esc(getAttributeLabel(a.attribute)) + ': ' + (a.modifier || 0);
        }).join(' · ');
        detailRows += detailRow('Atributos', statStr);
      }
    }

    if (details.stat_choices && details.stat_choices.length > 0) {
      detailRows += detailRow('Stats disponibles', details.stat_choices.length + ' opciones');
    }

    if (details.infusion_slots && details.infusion_slots.length > 0) {
      var slotFlags = details.infusion_slots.map(function(s) {
        return (s.flags || []).join(', ') || 'Ranura';
      }).join(', ');
      detailRows += detailRow('Ranuras de infusión', details.infusion_slots.length + ' (' + esc(slotFlags) + ')');
    }

    if (details.bonuses && details.bonuses.length > 0) {
      detailRows += detailRow('Bonificaciones', details.bonuses.length + ' niveles');
      details.bonuses.forEach(function(bonus, i) {
        detailRows += detailRow('  Nivel ' + (i + 1), esc(bonus || '—'), true);
      });
    }

    if (details.suffix) {
      detailRows += detailRow('Sufijo', esc(details.suffix));
    }

    detailRows += detailRow('Valor NPC', formatCoins(vendorValue));

    if (flags.length > 0) {
      detailRows += detailRow('Flags', esc(flags.map(function(f) { return getFlagLabel(f); }).join(', ')));
    }

    detailRows += detailRow('Ubicación',
      '<img src="' + (locIcons[entryData.location] || '') + '" width="14" height="14" alt="" style="vertical-align:middle;"> ' +
      esc(locLabels[entryData.location] || '—') +
      (entryData.slot !== undefined ? ' (slot ' + (entryData.slot + 1) + ')' : '')
    );

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'invItemModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="modal__backdrop" data-close="1"></div>' +
      '<div class="modal__dialog" style="max-width:500px;">' +
        '<header class="modal__header">' +
          '<h3 style="display:flex;align-items:center;gap:10px;margin:0;font-size:1rem;">' +
            (icon ? '<img src="' + esc(icon) + '" width="32" height="32" alt="" style="border-radius:6px;">' : '') +
            '<span style="color:' + rarityColor + ';">' + esc(name) + '</span>' +
          '</h3>' +
          '<button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>' +
        '</header>' +
        '<div class="modal__body" style="max-height:65vh;overflow-y:auto;">' +
          (description ? '<div class="muted" style="font-size:0.8rem;margin-bottom:12px;line-height:1.5;">"' + esc(description) + '"</div>' : '') +
          '<div style="background:#0f1116;border-radius:10px;padding:10px 14px;">' +
            detailRows +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
            (chatLink ? '<button class="btn btn--ghost btn--xs" id="invCopyChat" data-chat="' + esc(chatLink) + '" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;">' +
              '<img src="' + CONFIG.ICONS.copy + '" width="12" height="12" alt=""> Copiar código' +
            '</button>' : '') +
            '<a class="btn btn--ghost btn--xs" href="' + CONFIG.WIKI_BASE + encodeURIComponent(name) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;text-decoration:none;">' +
              '<img src="' + CONFIG.ICONS.wiki + '" width="12" height="12" alt=""> Wiki' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
      if (e.target.getAttribute('data-close') === '1') closeItemModal();
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        closeItemModal();
        document.removeEventListener('keydown', onEsc);
      }
    });

    var copyBtn = modal.querySelector('#invCopyChat');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var chat = copyBtn.getAttribute('data-chat');
        if (chat) {
          try {
            navigator.clipboard.writeText(chat);
            if (root.toast) root.toast('success', 'Código copiado al portapapeles', { ttl: 1500 });
          } catch(_) {}
        }
      });
    }
  }

  function detailRow(label, value, isSub) {
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1f2026;' + (isSub ? 'padding-left:16px;' : '') + '">' +
      '<span class="muted" style="font-size:0.7rem;' + (isSub ? 'opacity:0.6;' : '') + '">' + esc(label) + '</span>' +
      '<span style="font-size:0.75rem;text-align:right;max-width:60%;">' + value + '</span>' +
    '</div>';
  }

  function closeItemModal() {
    var modal = document.getElementById('invItemModal');
    if (modal) modal.remove();
  }

  // =======================================================================
  // RENDER PRINCIPAL
  // =======================================================================
  function render() {
    var panel = document.getElementById('inventoryPanel');
    if (!panel || panel.hasAttribute('hidden')) return;

    ensurePanelContent();

    if (state.view === 'section') {
      renderSectionView();
    } else {
      renderHub();
    }
  }

  function ensurePanelContent() {
    var panel = document.getElementById('inventoryPanel');
    if (!panel) return;
    var body = panel.querySelector('.panel__body');
    if (!body) return;
    if (body.querySelector('#invKPIs')) return;

    if (!document.getElementById('inv-styles')) {
      var style = document.createElement('style');
      style.id = 'inv-styles';
      style.textContent =
        '.inv-rarity-row{display:flex;gap:8px;overflow-x:auto;padding:4px 0;scrollbar-width:thin;}' +
        '.inv-rarity-chip:hover{background:#252830!important;border-color:#3a3e4a!important;}' +
        '.inv-items-grid{display:grid;grid-template-columns:repeat(' + CONFIG.ITEMS_PER_ROW + ', 1fr);gap:6px;}' +
        '.inv-item-card:hover{background:#1a1d28!important;}' +
        '.inv-section-header:hover{background:#1a1d28!important;}' +
        '.inv-bank-slot:hover{background:#1a1d28!important;border-color:#3a4c7a!important;transform:scale(1.05);}' +
        '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
        '.inv-rarity-row::-webkit-scrollbar{height:4px;}' +
        '.inv-rarity-row::-webkit-scrollbar-track{background:#0a0c10;border-radius:2px;}' +
        '.inv-rarity-row::-webkit-scrollbar-thumb{background:#2a2c35;border-radius:2px;}';
      document.head.appendChild(style);
    }

    body.innerHTML =
      '<div id="invKPIs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;"></div>' +
      '<div id="invFilters" style="margin-bottom:16px;"></div>' +
      '<div id="invResults"></div>';
  }

  function wireHubEvents() {
    var searchInput = document.getElementById('invSearchInput');
    var rarityFilter = document.getElementById('invRarityFilter');
    var refreshBtn = document.getElementById('invRefreshBtn');

    if (searchInput && !searchInput.__wired) {
      searchInput.__wired = true;
      var t = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(t);
        t = setTimeout(function() {
          state.filters.q = searchInput.value || '';
          renderHubResults();
        }, 200);
      });
    }
    if (rarityFilter && !rarityFilter.__wired) {
      rarityFilter.__wired = true;
      rarityFilter.addEventListener('change', function() {
        state.filters.rarity = rarityFilter.value || '';
        renderHubResults();
      });
    }
    if (refreshBtn && !refreshBtn.__wired) {
      refreshBtn.__wired = true;
      refreshBtn.addEventListener('click', function() { refresh(true); });
    }

    $$('.inv-kpi-card[data-section]').forEach(function(card) {
      if (card.__wired) return;
      card.__wired = true;
      card.addEventListener('click', function() {
        var section = card.getAttribute('data-section');
        openSectionView(section);
      });
    });

    var goToChars = document.getElementById('invGoToChars');
    if (goToChars && !goToChars.__wired) {
      goToChars.__wired = true;
      goToChars.addEventListener('click', function() {
        if (root.Characters && typeof root.Characters.activate === 'function') {
          var invPanel = document.getElementById('inventoryPanel');
          if (invPanel) invPanel.setAttribute('hidden', '');
          root.Characters.activate();
        }
      });
    }
  }

  // =======================================================================
  // CICLO DE VIDA
  // =======================================================================
  async function refresh(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    var mySeq = ++_refreshSeq;
    state.view = 'hub';
    state.activeSection = null;

    // Mostrar skeleton inmediatamente
    state.loading = true;
    render();

    _refreshInFlight = loadAllData(!!forceNoCache);
    try { await _refreshInFlight; if (mySeq === _refreshSeq) render(); }
    finally { if (mySeq === _refreshSeq) _refreshInFlight = null; }
  }

  async function activate() {
    if (state.active) return;
    state.active = true;
    console.log(LOG, 'activate()');
    var panel = document.getElementById('inventoryPanel');
    if (panel) panel.removeAttribute('hidden');
    var charPanel = document.getElementById('charactersPanel');
    if (charPanel) charPanel.setAttribute('hidden', '');
    ensurePanelContent();
    refresh(false);
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;
    state.view = 'hub';
    state.activeSection = null;
    var panel = document.getElementById('inventoryPanel');
    if (panel) panel.setAttribute('hidden', '');
    closeItemModal();
  }

  function initOnce() {
    if (state.inited) return;
    state.inited = true;
    console.log(LOG, 'ready v1.3.1');
  }

  // =======================================================================
  // API PÚBLICA
  // =======================================================================
  var InventoryHub = {
    initOnce: initOnce,
    activate: activate,
    deactivate: deactivate,
    refresh: refresh,
    _debug: function() {
      return { active: state.active, view: state.view, section: state.activeSection, bankItems: state.kpis.bankUsed, materialsCount: state.kpis.materialsCount, armoryCount: state.kpis.armoryCount, token: state.token };
    }
  };

  root.InventoryHub = InventoryHub;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOnce);
  else initOnce();
  console.info(LOG, 'ready v1.3.1');

})(typeof window !== 'undefined' ? window : this);