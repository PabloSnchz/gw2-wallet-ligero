/*!
 * js/activities.js — Panel de Actividades (Diarias / Semanales)
 * v3.1.0 (2026-03-18)
 *
 * CHANGELOG:
 * - v3.1.0: PSNA con fuente externa JSON (local first, luego GitHub)
 * - Mantiene compatibilidad con router-first y BAI
 * - Fallback robusto + caché inteligente
 * - Respeta invariantes del proyecto
 * 
 * Compatibilidad:
 * - Router: Activities.Route { path, mount, unmount, prefetch }
 * - Eventos: solo escucha gn:global-refresh (router maneja tokenchange)
 * - Persistencia: gn_activities_toggles, psna:*, gn:wiki:thumbs
 */

(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    // Rutas de datos PSNA (local first, luego GitHub)
    PSNA_DATA_PATHS: [
      'assets/data/psna-schedule.json',                    // Local durante desarrollo
      'https://raw.githubusercontent.com/https://pablosnchz.github.io/gw2-wallet-ligero/main/assets/data/psna-schedule.json' // GitHub Pages
    ],
    PSNA_CACHE_KEY: 'psna:schedule',
    PSNA_LAST_UPDATE_KEY: 'psna:lastUpdate',
    PSNA_DAILY_CACHE_PREFIX: 'psna:'
  };

  // =======================================================================
  // 1. ESTADO GLOBAL
  // =======================================================================
  var state = {
    inited: false,
    active: false,
    token: null,
    
    // Diarias
    daily: {
      psna: null,
      psnaSchedule: null,
      psnaLastUpdate: null,
      fractals: {
        status: 'idle',
        error: null,
        today: { t4: [], rec: [] },
        tomorrow: { t4: [], rec: [] }
      },
      worldBosses: {
        next: []
      },
      ecto: {
        done: new Set(),
        items: new Map(),
        itemMap: {}
      },
      homeNodes: {
        unlocked: [],
        collected: {}
      }
    },
    
    // Semanales
    weekly: {
      key: false,
      stones: 0
    },
    
    // Persistencia
    toggles: {
      v: 2,
      date: null,
      week: null,
      homeNodesCollected: {},
      byKey: {}
    },
    
    // Assets
    assets: {
      key: null,
      stone: null
    },
    
    // Control de fetch (last win)
    _psnaFetchId: 0,
    _fractalsFetchId: 0,
    _ectoFetchId: 0
  };

  // =======================================================================
  // 2. DATOS ESTÁTICOS DE RESPALDO (FALLBACK)
  // =======================================================================
  var FALLBACK_PSNA_SCHEDULE = [
    { date: '2026-03-17', waypoints: [
      'Camp Resolve Waypoint',
      'Desider Atum Waypoint',
      'Waste Hollows Waypoint',
      'Garenhoff',
      'Travelen\'s Waypoint',
      'Temperus Point Waypoint'
    ]},
    { date: '2026-03-18', waypoints: [
      'Town of Prosperity',
      'Swampwatch Post',
      'Caer Shadowlain',
      'Shieldbluff Waypoint',
      'Mennerheim',
      'Ferrusatos Village'
    ]}
  ];

  var PSNA_CODES = {
    'Camp Resolve Waypoint': '[&BH8HAAA=]',
    'Desider Atum Waypoint': '[&BEgAAAA=]',
    'Waste Hollows Waypoint': '[&BKgCAAA=]',
    'Garenhoff': '[&BBEAAAA=]',
    'Travelen\'s Waypoint': '[&BGQCAAA=]',
    'Temperus Point Waypoint': '[&BIMBAAA=]',
    'Town of Prosperity': '[&BH4HAAA=]',
    'Swampwatch Post': '[&BMIAAAA=]',
    'Caer Shadowlain': '[&BP0CAAA=]',
    'Shieldbluff Waypoint': '[&BKYAAAA=]',
    'Mennerheim': '[&BDgDAAA=]',
    'Ferrusatos Village': '[&BPEBAAA=]',
    'Blue Oasis': '[&BH8HAAA=]',
    'Seraph Protectors': '[&BF0AAAA=]',
    'Armada Harbor': '[&BO4CAAA=]',
    'Altar Brook Trading Post': '[&BEUDAAA=]',
    'Rocklair': '[&BJcBAAA=]',
    'Village of Scalecatch Waypoint': '[&BOcBAAA=]',
    'Repair Station': '[&BJcHAAA=]',
    'Breth Ayahusasca': '[&BMwCAAA=]',
    'Shelter Docks': '[&BKYCAAA=]',
    'Pearl Islet Waypoint': '[&BNUGAAA=]',
    'Dolyak Pass Waypoint': '[&BHsBAAA=]',
    'Hawkgates Waypoint': '[&BNMAAAA=]',
    'Gallant\'s Folly': '[&BNMCAAA=]',
    'Augur\'s Torch': '[&BB8DAAA=]',
    'Vigil Keep Waypoint': '[&BJIBAAA=]',
    'Baldstead': '[&BE8CAAA=]',
    'Bovarin Estate': '[&BF8BAAA=]',
    'Azarr\'s Arbor': '[&BIYHAAA=]',
    'Mabon Waypoint': '[&BDoBAAA=]',
    'Fort Trinity Waypoint': '[&BO4CAAA=]',
    'Mudflat Camp': '[&BKcBAAA=]',
    'Blue Ice Shining Waypoint': '[&BIUCAAA=]',
    'Snow Ridge Camp Waypoint': '[&BCECAAA=]',
    'Restoration Refuge': '[&BIgHAAA=]',
    'Lionguard Waystation Waypoint': '[&BEwDAAA=]',
    'Rally Waypoint': '[&BNIEAAA=]',
    'Marshwatch Haven Waypoint': '[&BKYBAAA=]',
    'Ridgerock Camp Waypoint': '[&BIMCAAA=]',
    'Haymal Gore': '[&BB4CAAA=]'
  };

  var PSNA_REGION_CHATS = {
    'Maguuma Wastes': '[&BNMAAAA=]',
    'Maguuma Jungle': '[&BPcAAAA=]',
    'Ruins of Orr': '[&BOMCAAA=]',
    'Kryta': '[&BE4CAAA=]',
    'Shiverpeaks': '[&BEgCAAA=]',
    'Ascalon': '[&BE0AAAA=]'
  };

  var PSNA_REGIONS = ['Maguuma Wastes', 'Maguuma Jungle', 'Ruins of Orr', 'Kryta', 'Shiverpeaks', 'Ascalon'];
  var PSNA_NPCS = ['Mehem the Traveled', 'The Fox', 'Specialist Yana', 'Lady Derwena', 'Despina Katelyn', 'Verma Giftrender'];

  // =======================================================================
  // 3. UTILIDADES BÁSICAS
  // =======================================================================
  function $(s, r) { return (r || document).querySelector(s); }
  
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return '&#39;';
    });
  }
  
  function copyToClipboard(txt) {
    try {
      navigator.clipboard.writeText(txt);
      if (window.toast) window.toast('success', 'Copiado al portapapeles', { ttl: 900 });
    } catch (e) {
      console.warn(LOG, 'clipboard', e);
      window.prompt('Copiar:', txt);
    }
  }
  
  function pad2(n) { return String(n).padStart(2, '0'); }
  
  function dayKeyUTC() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  
  function weekKeyUTC() {
    var now = new Date();
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
  }
  
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function(_, rej) {
        setTimeout(function() {
          rej(new Error('Timeout ' + (label || 'task') + ' ' + ms + 'ms'));
        }, ms);
      })
    ]);
  }
  
  var requestIdle = (typeof window !== 'undefined' && window.requestIdleCallback) ?
    window.requestIdleCallback :
    function(cb) { return setTimeout(function() { cb({ didTimeout: false, timeRemaining: function() { return 0; } }); }, 250); };

  // =======================================================================
  // 4. PERSISTENCIA (Toggles por cuenta)
  // =======================================================================
  async function hashToken16(token) {
    try {
      if (!token) return 'no-token';
      if (window.crypto && window.crypto.subtle) {
        var enc = new TextEncoder().encode(token);
        var buf = await crypto.subtle.digest('SHA-256', enc);
        var hex = Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        return hex.slice(0, 16);
      }
    } catch (e) { console.warn(LOG, 'hashToken', e); }
    var h = 0;
    for (var i = 0; i < (token || '').length; i++) {
      h = ((h << 5) - h) + token.charCodeAt(i);
      h |= 0;
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function loadToggles() {
    try {
      var raw = JSON.parse(localStorage.getItem('gn_activities_toggles') || '{}');
      var today = dayKeyUTC();
      var thisWeek = weekKeyUTC();
      
      var toggles = Object.assign({
        v: 2,
        date: today,
        week: thisWeek,
        homeNodesCollected: {},
        byKey: {}
      }, raw);
      
      if (toggles.date !== today) {
        toggles.date = today;
        toggles.homeNodesCollected = {};
      }
      
      state.toggles = toggles;
      state.daily.homeNodes.collected = toggles.homeNodesCollected;
      
    } catch (e) {
      console.warn(LOG, 'loadToggles error', e);
    }
  }

  async function loadWeeklyForToken(token) {
    var keyId = token ? await hashToken16(token) : 'no-token';
    var bucket = state.toggles.byKey[keyId] || { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };
    
    var thisWeek = weekKeyUTC();
    if (bucket.week !== thisWeek) {
      bucket = { week: thisWeek, weeklyKey: false, antiqueStoneCount: 0 };
    }
    
    state.toggles.byKey[keyId] = bucket;
    state.weekly.key = bucket.weeklyKey;
    state.weekly.stones = bucket.antiqueStoneCount;
    
    saveToggles();
  }

  function saveToggles() {
    try {
      localStorage.setItem('gn_activities_toggles', JSON.stringify(state.toggles));
    } catch (e) {}
  }

  function setWeeklyKey(value) {
    var keyId = state.token ? hashToken16(state.token) : 'no-token';
    if (!state.toggles.byKey[keyId]) {
      state.toggles.byKey[keyId] = { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };
    }
    state.toggles.byKey[keyId].weeklyKey = !!value;
    state.weekly.key = !!value;
    saveToggles();
    renderWeekly();
  }

  function setStones(value) {
    var keyId = state.token ? hashToken16(state.token) : 'no-token';
    if (!state.toggles.byKey[keyId]) {
      state.toggles.byKey[keyId] = { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };
    }
    var newValue = Math.max(0, Math.min(5, Number(value || 0)));
    state.toggles.byKey[keyId].antiqueStoneCount = newValue;
    state.weekly.stones = newValue;
    saveToggles();
    renderWeekly();
  }

  // =======================================================================
  // 5. SERVICIO PSNA CON FUENTE EXTERNA (Local First)
  // =======================================================================
  var PSNA = {
    // Cargar schedule desde fuente externa (intenta múltiples rutas)
    loadSchedule: async function(force) {
      var fetchId = ++state._psnaFetchId;
      var today = dayKeyUTC();
      var lastUpdate = localStorage.getItem(CONFIG.PSNA_LAST_UPDATE_KEY);
      
      // Si no force y ya actualizamos hoy, usar cache
      if (!force && lastUpdate === today) {
        var cached = localStorage.getItem(CONFIG.PSNA_CACHE_KEY);
        if (cached) {
          try {
            state.daily.psnaSchedule = JSON.parse(cached);
            console.log(LOG, '📦 Usando schedule cacheado');
            return true;
          } catch (e) {}
        }
      }
      
      // Intentar cada ruta en orden
      for (var i = 0; i < CONFIG.PSNA_DATA_PATHS.length; i++) {
        var url = CONFIG.PSNA_DATA_PATHS[i];
        
        // Si es ruta local y estamos en GitHub Pages, saltar
        if (url.startsWith('data/') && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
          continue;
        }
        
        try {
          console.log(LOG, '🌐 Cargando PSNA schedule desde:', url);
          var response = await fetch(url + '?t=' + Date.now()); // Evitar caché
          if (!response.ok) continue;
          
          var data = await response.json();
          
          if (data && data.schedule && Array.isArray(data.schedule)) {
            if (fetchId !== state._psnaFetchId) return false; // last win
            
            state.daily.psnaSchedule = data.schedule;
            state.daily.psnaLastUpdate = data.lastUpdated || today;
            
            // Guardar en localStorage
            localStorage.setItem(CONFIG.PSNA_CACHE_KEY, JSON.stringify(data.schedule));
            localStorage.setItem(CONFIG.PSNA_LAST_UPDATE_KEY, today);
            
            console.log(LOG, '✅ Schedule actualizado desde:', url);
            return true;
          }
        } catch (e) {
          console.warn(LOG, '⚠️ Error cargando desde', url, e);
        }
      }
      
      // Fallback a datos hardcodeados
      if (fetchId !== state._psnaFetchId) return false;
      console.warn(LOG, '⚠️ Usando schedule de respaldo');
      state.daily.psnaSchedule = FALLBACK_PSNA_SCHEDULE;
      return false;
    },
    
    // Obtener datos del día actual
    getForToday: function() {
      if (!state.daily.psnaSchedule || !state.daily.psnaSchedule.length) {
        state.daily.psnaSchedule = FALLBACK_PSNA_SCHEDULE;
      }
      
      var now = new Date();
      var year = now.getUTCFullYear();
      var month = String(now.getUTCMonth() + 1).padStart(2, '0');
      var day = String(now.getUTCDate()).padStart(2, '0');
      var todayStr = year + '-' + month + '-' + day;
      
      console.log(LOG, '🔍 Buscando fecha UTC:', todayStr);
      
      var todayData = null;
      for (var i = 0; i < state.daily.psnaSchedule.length; i++) {
        if (state.daily.psnaSchedule[i].date === todayStr) {
          todayData = state.daily.psnaSchedule[i];
          console.log(LOG, '✅ Datos encontrados para hoy');
          break;
        }
      }
      
      if (!todayData) {
        console.warn(LOG, '⚠️ No hay datos para hoy, usando primero disponible');
        todayData = state.daily.psnaSchedule[0];
      }
      
      var out = [];
      for (var j = 0; j < 6; j++) {
        var name = todayData.waypoints[j];
        var code = PSNA_CODES[name] || PSNA_REGION_CHATS[PSNA_REGIONS[j]];
        
        out.push({
          region: PSNA_REGIONS[j],
          npc: PSNA_NPCS[j],
          name: name,
          wpName: name,
          chat: code
        });
      }
      
      return out;
    },
    
    // Cargar PSNA para hoy (con caché diario)
    load: async function(forceRefresh) {
      var fetchId = ++state._psnaFetchId;
      var cacheKey = CONFIG.PSNA_DAILY_CACHE_PREFIX + dayKeyUTC();
      
      // Verificar si necesitamos actualizar el schedule
      await this.loadSchedule(forceRefresh);
      if (fetchId !== state._psnaFetchId) return;
      
      // Intentar caché diario
      if (!forceRefresh) {
        try {
          var cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            state.daily.psna = JSON.parse(cached);
            renderPSNA();
            renderDailyKPI();
            return;
          }
        } catch (e) {}
      }
      
      // Obtener datos frescos
      var todayData = this.getForToday();
      if (fetchId !== state._psnaFetchId) return;
      
      state.daily.psna = todayData;
      
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(todayData));
      } catch (e) {}
      
      renderPSNA();
      renderDailyKPI();
    }
  };

  // =======================================================================
  // 6. SERVICIO FRACTALES (con last win)
  // =======================================================================
  var Fractals = {
    loadToday: async function() {
      var fetchId = ++state._fractalsFetchId;
      state.daily.fractals.status = 'loading';
      renderFractals();
      
      try {
        var data = await this._fetch('today');
        if (fetchId !== state._fractalsFetchId) return;
        state.daily.fractals.today = data;
        state.daily.fractals.status = 'ready';
      } catch (e) {
        if (fetchId !== state._fractalsFetchId) return;
        state.daily.fractals.status = 'error';
        state.daily.fractals.error = e;
        console.warn(LOG, 'Fractals today error', e);
      }
      renderFractals();
    },
    
    loadTomorrow: async function() {
      var fetchId = ++state._fractalsFetchId;
      try {
        var data = await this._fetch('tomorrow');
        if (fetchId !== state._fractalsFetchId) return;
        state.daily.fractals.tomorrow = data;
      } catch (e) {
        console.warn(LOG, 'Fractals tomorrow error', e);
      }
      renderFractals();
    },
    
    _fetch: async function(which) {
      var isTomorrow = which === 'tomorrow';
      var catId = 88;
      var url = 'https://api.guildwars2.com/v2/achievements/categories/' + catId;
      if (isTomorrow) url += '?v=latest';
      
      var catRes = await fetch(url);
      if (!catRes.ok) throw new Error('Error fetching category');
      var cat = await catRes.json();
      
      var ids = cat.achievements || [];
      if (!ids.length) throw new Error('No achievements found');
      
      var details = [];
      for (var i = 0; i < ids.length; i += 200) {
        var chunk = ids.slice(i, i + 200);
        var detailUrl = 'https://api.guildwars2.com/v2/achievements?ids=' + chunk.join(',');
        var detailRes = await fetch(detailUrl);
        var chunkData = await detailRes.json();
        if (Array.isArray(chunkData)) details = details.concat(chunkData);
      }
      
      var t4 = [];
      var rec = [];
      
      for (var d = 0; d < details.length; d++) {
        var name = details[d].name || '';
        if (name.indexOf('Daily Tier 4') === 0) {
          var fractal = name.replace('Daily Tier 4', '').trim();
          if (fractal) t4.push(fractal);
        }
        if (name.indexOf('Daily Recommended') === 0) {
          var match = name.match(/\d+/g);
          if (match && match.length) rec = rec.concat(match);
        }
      }
      
      return { t4: t4, rec: rec };
    }
  };

  // =======================================================================
  // 7. SERVICIO WORLD BOSSES
  // =======================================================================
  var WorldBosses = {
    _schedule: [
      { offsetMin: 0, name: 'Tequatl the Sunless', chat: '[&BNABAAA=]' },
      { offsetMin: 30, name: 'The Shatterer', chat: '[&BE4DAAA=]' },
      { offsetMin: 60, name: 'Claw of Jormag', chat: '[&BHoCAAA=]' },
      { offsetMin: 90, name: 'Karka Queen', chat: '[&BNcGAAA=]' }
    ],
    
    _daySchedule: null,
    
    _buildDaySchedule: function() {
      if (this._daySchedule) return this._daySchedule;
      var out = [];
      for (var base = 0; base < 1440; base += 120) {
        for (var p = 0; p < this._schedule.length; p++) {
          out.push({
            tMin: base + this._schedule[p].offsetMin,
            name: this._schedule[p].name,
            chat: this._schedule[p].chat
          });
        }
      }
      out.sort(function(a, b) { return a.tMin - b.tMin; });
      this._daySchedule = out;
      return out;
    },
    
    getNext: function(windowMin) {
      var schedule = this._buildDaySchedule();
      var now = new Date();
      var nowUTCmin = now.getUTCHours() * 60 + now.getUTCMinutes();
      var limit = nowUTCmin + windowMin;
      var list = [];
      
      function pushEntry(tMinUTC, name, chat) {
        var dayShift = Math.floor(tMinUTC / 1440);
        var m = tMinUTC % 1440;
        var hUTC = Math.floor(m / 60);
        var miUTC = m % 60;
        var atUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayShift, hUTC, miUTC, 0));
        var atLocal = new Date(atUTC.getTime());
        list.push({
          atLocalStr: pad2(atLocal.getHours()) + ':' + pad2(atLocal.getMinutes()),
          atUTCStr: pad2(atUTC.getUTCHours()) + ':' + pad2(atUTC.getUTCMinutes()) + ' UTC',
          name: name,
          chat: chat,
          at: atLocal.getTime()
        });
      }
      
      for (var i = 0; i < schedule.length; i++) {
        if (schedule[i].tMin >= nowUTCmin && schedule[i].tMin <= limit) {
          pushEntry(schedule[i].tMin, schedule[i].name, schedule[i].chat);
        }
      }
      
      if (limit > 1439) {
        var over = limit - 1440;
        for (var j = 0; j < schedule.length; j++) {
          if (schedule[j].tMin <= over) {
            pushEntry(schedule[j].tMin + 1440, schedule[j].name, schedule[j].chat);
          }
        }
      }
      
      list.sort(function(a, b) { return a.at - b.at; });
      return list.slice(0, 6);
    },
    
    update: function() {
      state.daily.worldBosses.next = this.getNext(90);
      renderWorldBosses();
    }
  };

  // =======================================================================
  // 8. SERVICIO ECTO (con last win)
  // =======================================================================
  var Ecto = {
    _itemIds: {
      'glob_of_elder_spirit_residue': 46744,
      'lump_of_mithrilium': 46742,
      'spool_of_silk_weaving_thread': 46740,
      'spool_of_thick_elonian_cord': 46745
    },
    
    loadStatus: async function(token) {
      var fetchId = ++state._ectoFetchId;
      state.daily.ecto.done.clear();
      
      if (token) {
        try {
          var r = await fetch('https://api.guildwars2.com/v2/account/dailycrafting?access_token=' + encodeURIComponent(token));
          var arr = await r.json();
          if (fetchId === state._ectoFetchId && Array.isArray(arr)) {
            arr.forEach(function(id) { state.daily.ecto.done.add(String(id)); });
          }
        } catch (e) {
          console.warn(LOG, 'Ecto daily error', e);
        }
      }
      
      try {
        var ids = Object.values(this._itemIds).join(',');
        var rr = await fetch('https://api.guildwars2.com/v2/items?ids=' + ids + '&lang=es');
        var list = await rr.json();
        if (fetchId === state._ectoFetchId && Array.isArray(list)) {
          list.forEach(function(it) { state.daily.ecto.items.set(String(it.id), it); });
          state.daily.ecto.itemMap = this._itemIds;
        }
      } catch (e) {
        console.warn(LOG, 'Ecto items error', e);
      }
      
      renderEcto();
      renderDailyKPI();
    }
  };

  // =======================================================================
  // 9. SERVICIO ASSETS
  // =======================================================================
  var Assets = {
    load: async function() {
      try {
        var itemIds = [36708, 96978];
        var url = 'https://api.guildwars2.com/v2/items?ids=' + itemIds.join(',') + '&lang=es';
        var res = await fetch(url);
        var items = await res.json();
        
        if (Array.isArray(items)) {
          items.forEach(function(item) {
            if (item.id === 36708) state.assets.key = item;
            if (item.id === 96978) state.assets.stone = item;
          });
        }
      } catch (e) {
        console.warn(LOG, 'Error loading assets', e);
      }
      renderWeekly();
    }
  };

  // =======================================================================
  // 10. RENDERIZADO
  // =======================================================================
  
  function renderPSNA() {
    var grid = $('#psnaGrid');
    var status = $('#psnaStatus');
    var critical = $('#psnaCriticalBody');
    var copyAll = $('#psnaCopyAll');
    
    if (!grid) return;
    
    var list = state.daily.psna || [];
    
    if (list.length === 0) {
      grid.innerHTML = '<p class="muted">No hay datos PSNA disponibles</p>';
      if (status) status.innerHTML = '<span class="pill s-error">❌ Sin datos</span>';
      return;
    }
    
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var hasChat = item.chat && item.chat.length > 0;
      var disabled = hasChat ? '' : ' disabled';
      var tooltip = hasChat ? 'Copiar waypoint' : 'Código no disponible';
      
      html += '<article class="card" data-psna-region="' + esc(item.region) + '">' +
        '<div style="display:flex;gap:10px;align-items:center">' +
          '<img src="https://wiki.guildwars2.com/images/thumb/d/d2/Waypoint_%28map_icon%29.png/30px-Waypoint_%28map_icon%29.png" width="22" height="22" alt="WP" loading="lazy">' +
          '<button class="btn btn--ghost btn--xs" data-psna-copy data-psna-index="' + i + '" title="' + tooltip + '" data-tip="' + tooltip + '"' + disabled + '>' +
            esc(item.wpName) +
          '</button>' +
        '</div>' +
        '<div class="muted" style="margin-top:6px">' +
          '<div><strong>' + esc(item.npc) + '</strong> — ' + esc(item.region) + '</div>' +
          '<div>' + esc(item.name) + '</div>' +
        '</div>' +
        (!hasChat ? '<div class="pill s-error" style="margin-top:4px">❌ Sin código</div>' : '') +
      '</article>';
    }
    grid.innerHTML = html;
    
    var buttons = grid.querySelectorAll('[data-psna-copy]');
    for (var b = 0; b < buttons.length; b++) {
      var btn = buttons[b];
      if (btn.__wired) continue;
      btn.__wired = true;
      
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var idx = this.getAttribute('data-psna-index');
        if (idx === null) return;
        var item = state.daily.psna[parseInt(idx, 10)];
        if (item && item.chat) {
          copyToClipboard(item.chat);
          this.classList.add('btn--success');
          setTimeout((function(btn) { return function() { btn.classList.remove('btn--success'); }; })(this), 200);
        }
      });
    }
    
    if (critical) {
      var first = list[0];
      if (first) {
        critical.classList.remove('muted');
        critical.innerHTML =
          '<div class="action-main">' +
            '<div class="action-title">' + esc(first.region) + '</div>' +
            '<div class="action-sub">' + esc(first.name) + ' — ' + esc(first.npc) + '</div>' +
          '</div>' +
          '<div class="action-cta">' +
            '<button class="btn" id="psnaCopyTop" ' + (!first.chat ? 'disabled' : '') + '>' +
              'Copiar waypoint' +
            '</button>' +
          '</div>';
        
        var topBtn = $('#psnaCopyTop');
        if (topBtn) {
          topBtn.addEventListener('click', function() {
            if (first.chat) copyToClipboard(first.chat);
          });
        }
      } else {
        critical.classList.add('muted');
        critical.textContent = 'PSNA no disponible';
      }
    }
    
    if (copyAll) {
      var chats = [];
      for (var c = 0; c < list.length; c++) {
        if (list[c].chat) chats.push(list[c].chat);
      }
      copyAll.disabled = chats.length === 0;
      copyAll.title = chats.length + '/' + list.length + ' waypoints disponibles';
    }
    
    if (status) {
      var total = list.length;
      var valid = 0;
      for (var v = 0; v < list.length; v++) {
        if (list[v].chat) valid++;
      }
      
      if (valid === 0) {
        status.innerHTML = '<span class="pill s-error">❌ Ningún waypoint disponible</span>';
      } else if (valid < total) {
        status.innerHTML = '<span class="pill s-warn">⚠️ ' + valid + '/' + total + ' waypoints disponibles</span>';
      } else {
        status.innerHTML = '<span class="pill s-ok">✅ Todos los waypoints disponibles</span>';
      }
    }
  }

  function renderFractals() {
    var host = $('#fractalsBody');
    if (!host) return;
    
    if (state.daily.fractals.status === 'loading') {
      host.classList.add('muted');
      host.textContent = 'Cargando fractales…';
    } else if (state.daily.fractals.status === 'error') {
      host.classList.add('muted');
      host.innerHTML = 'Error cargando fractales';
    } else {
      var t4 = state.daily.fractals.today.t4 || [];
      var rec = state.daily.fractals.today.rec || [];
      var t4Html = t4.length
        ? '<ul class="list">' + t4.map(function(n) { return '<li>• ' + esc(n) + '</li>'; }).join('') + '</ul>'
        : '<div class="muted">—</div>';
      
      host.classList.remove('muted');
      host.innerHTML =
        '<div><strong>T4</strong></div>' + t4Html +
        '<div style="margin-top:6px"><div class="muted">Recomendados: ' + (rec.length ? esc(rec.join(', ')) : '—') + '</div></div>';
    }
    
    var tomorrowNote = $('#fractalsTomorrowNote');
    if (tomorrowNote) {
      var tm = state.daily.fractals.tomorrow;
      if (tm && (tm.t4.length || tm.rec.length)) {
        var tip = 'Mañana — T4: ' + (tm.t4.length ? tm.t4.join(', ') : '—') + ' · Rec: ' + (tm.rec.length ? tm.rec.join(', ') : '—');
        tomorrowNote.innerHTML = '<div class="muted"><span class="pill s-info" data-tip="' + esc(tip) + '">Mañana</span></div>';
      } else {
        tomorrowNote.innerHTML = '<div class="muted">Mañana: —</div>';
      }
    }
  }

  function renderWorldBosses() {
    var host = $('#wbBody');
    if (!host) return;
    
    var list = state.daily.worldBosses.next || [];
    
    if (!list.length) {
      host.classList.add('muted');
      host.textContent = 'Sin eventos en los próximos 90 min';
      return;
    }
    
    var html = '<ul class="list">';
    for (var i = 0; i < list.length; i++) {
      html += '<li><strong>' + esc(list[i].atLocalStr) + '</strong> — ' + esc(list[i].name) +
        ' <button class="btn btn--xs btn--ghost" data-wb-copy="' + esc(list[i].chat) + '">Copiar</button></li>';
    }
    html += '</ul>';
    host.innerHTML = html;
    host.classList.remove('muted');
    
    var buttons = host.querySelectorAll('[data-wb-copy]');
    for (var b = 0; b < buttons.length; b++) {
      if (buttons[b].__wired) continue;
      buttons[b].__wired = true;
      buttons[b].addEventListener('click', function() {
        var code = this.getAttribute('data-wb-copy');
        if (code) copyToClipboard(code);
      });
    }
  }

  function renderEcto() {
    var host = $('#ectoGrid');
    var status = $('#ectoStatus');
    if (!host) return;
    
    var html = '';
    var map = state.daily.ecto.itemMap || {};
    var items = state.daily.ecto.items || new Map();
    
    for (var key in map) {
      var itemId = map[key];
      var item = items.get(String(itemId));
      var done = state.daily.ecto.done.has(String(key));
      var name = item ? item.name : key;
      var icon = item && item.icon ? '<img src="' + esc(item.icon) + '" width="32" height="32" alt="">' : '';
      
      html += '<article class="card">' +
        '<div style="display:flex;gap:10px;align-items:center">' + icon +
          '<div><strong>' + esc(name) + '</strong></div>' +
        '</div>' +
        '<div style="margin-top:6px">' +
          (done ? '<span class="pill s-ok">✅ Hecho hoy</span>' : '<span class="pill s-pending">⏳ Pendiente</span>') +
        '</div>' +
      '</article>';
    }
    
    host.innerHTML = html;
    if (status) status.textContent = 'Listo.';
  }

  function renderWeekly() {
    var keyCheck = $('#wkKeyDone');
    if (keyCheck) keyCheck.checked = state.weekly.key;
    
    var count = $('#assCount');
    if (count) count.textContent = String(state.weekly.stones);
    
    var barKey = $('#barKey');
    if (barKey) barKey.style.width = (state.weekly.key ? 100 : 0) + '%';
    
    var barLeivas = $('#barLeivas');
    if (barLeivas) barLeivas.style.width = Math.min(100, Math.round(state.weekly.stones / 5 * 100)) + '%';
    
    var pillKey = $('#pillKey');
    if (pillKey) {
      pillKey.className = 'pill ' + (state.weekly.key ? 's-ok' : 's-pending');
      
      var iconSpan = pillKey.querySelector('.pill-icon') || document.createElement('span');
      iconSpan.className = 'pill-icon';
      
      if (state.assets.key && !pillKey.__iconed) {
        iconSpan.innerHTML = '';
        var img = document.createElement('img');
        img.src = state.assets.key.icon;
        img.width = 16;
        img.height = 16;
        img.alt = '';
        iconSpan.appendChild(img);
        pillKey.__iconed = true;
      }
      
      if (!pillKey.querySelector('.pill-icon')) {
        pillKey.insertBefore(iconSpan, pillKey.firstChild);
      }
      
      var textSpan = pillKey.querySelector('.pill-text') || pillKey;
      if (!textSpan.classList.contains('pill-text')) {
        textSpan = document.createElement('span');
        textSpan.className = 'pill-text';
        textSpan.textContent = (state.weekly.key ? '✅' : '⏳') + ' Llave del León Negro';
        pillKey.innerHTML = '';
        pillKey.appendChild(iconSpan);
        pillKey.appendChild(textSpan);
      } else {
        textSpan.textContent = (state.weekly.key ? '✅' : '⏳') + ' Llave del León Negro';
      }
    }
    
    var pillLeivas = $('#pillLeivas');
    if (pillLeivas) {
      pillLeivas.className = 'pill ' + (state.weekly.stones >= 5 ? 's-ok' : 's-pending');
      
      var iconSpan2 = pillLeivas.querySelector('.pill-icon') || document.createElement('span');
      iconSpan2.className = 'pill-icon';
      
      if (state.assets.stone && !pillLeivas.__iconed) {
        iconSpan2.innerHTML = '';
        var img2 = document.createElement('img');
        img2.src = state.assets.stone.icon;
        img2.width = 16;
        img2.height = 16;
        img2.alt = '';
        iconSpan2.appendChild(img2);
        pillLeivas.__iconed = true;
      }
      
      if (!pillLeivas.querySelector('.pill-icon')) {
        pillLeivas.insertBefore(iconSpan2, pillLeivas.firstChild);
      }
      
      var textSpan2 = pillLeivas.querySelector('.pill-text') || pillLeivas;
      if (!textSpan2.classList.contains('pill-text')) {
        textSpan2 = document.createElement('span');
        textSpan2.className = 'pill-text';
        textSpan2.textContent = 'Leivas: ' + state.weekly.stones + '/5';
        pillLeivas.innerHTML = '';
        pillLeivas.appendChild(iconSpan2);
        pillLeivas.appendChild(textSpan2);
      } else {
        textSpan2.textContent = 'Leivas: ' + state.weekly.stones + '/5';
      }
    }
  }

  function renderDailyKPI() {
    var host = $('#kpiDailyStrip');
    if (!host) return;
    
    var ectoDone = 0;
    state.daily.ecto.done.forEach(function() { ectoDone++; });
    
    var hasQuartz = false;
    for (var i = 0; i < (state.daily.homeNodes.unlocked || []).length; i++) {
      if (state.daily.homeNodes.unlocked[i] === 'quartz_node') {
        hasQuartz = true;
        break;
      }
    }
    var quartzDone = !!state.daily.homeNodes.collected['quartz_node'];
    var psnaAvail = (state.daily.psna || []).length > 0;
    
    var total = 1 + (hasQuartz ? 1 : 0) + 1;
    var completed = (ectoDone > 0 ? 1 : 0) + (hasQuartz && quartzDone ? 1 : 0) + (psnaAvail ? 1 : 0);
    var next = psnaAvail ? 'PSNA' : (ectoDone < 1 ? 'Ecto' : (hasQuartz && !quartzDone ? 'Cuarzo' : ''));
    
    host.innerHTML = '<div class="kpi-badge kpi-ok">✅ ' + completed + ' / ' + total + ' actividades</div>' +
      '<div class="kpi-hint">' + (next ? '⏳ Próximo: ' + next : 'Todo al día ✅') + '</div>';
  }

  // =======================================================================
  // 11. INICIALIZACIÓN DEL PANEL
  // =======================================================================
  
  function ensurePanel() {
    var host = $('#activitiesPanel');
    if (host) return host;
    
    host = document.createElement('section');
    host.id = 'activitiesPanel';
    host.className = 'panel col-main';
    host.setAttribute('hidden', '');
    
    host.innerHTML = '' +
      '<h2 class="panel__title">Panel de Actividades</h2>' +
      '<div class="panel__body">' +
        '<div class="act-head">' +
          '<p class="muted" id="actSub">Actividades de hoy</p>' +
          '<div class="tabs">' +
            '<button id="actTabDaily" class="btn" role="tab">Diarias</button>' +
            '<button id="actTabWeekly" class="btn btn--ghost" role="tab">Semanales</button>' +
          '</div>' +
        '</div>' +
        
        '<div id="actDaily" class="tab-panel">' +
          '<section class="kpi-strip" id="kpiDailyStrip"></section>' +
          
          '<section class="card" id="psnaCritical">' +
            '<h2>🔴 PSNA Crítico</h2>' +
            '<div id="psnaCriticalBody" class="action-card muted">Cargando…</div>' +
          '</section>' +
          
          '<div class="panel-head"><h3>Agentes PSNA</h3></div>' +
          '<p class="muted">' +
            '<button id="psnaCopyAll" class="btn btn--ghost btn--xs">Copiar todos</button>' +
          '</p>' +
          '<div id="psnaStatus" class="muted"></div>' +
          '<div id="psnaGrid" class="grid"></div>' +
          
          '<section class="card" id="fractalsDaily">' +
            '<h2>🌀 Fractales hoy</h2>' +
            '<div id="fractalsBody" class="muted">Cargando…</div>' +
            '<div id="fractalsTomorrowNote"></div>' +
          '</section>' +
          
          '<section class="card" id="wbSection">' +
            '<h2>🌋 World Bosses (90 min)</h2>' +
            '<div id="wbBody" class="muted">Calculando…</div>' +
          '</section>' +
          
          '<div class="panel-head"><h3>Refinamiento de Ecto</h3></div>' +
          '<div id="ectoStatus" class="muted">Cargando…</div>' +
          '<div id="ectoGrid" class="grid"></div>' +
        '</div>' +
        
        '<div id="actWeekly" class="tab-panel" hidden>' +
          '<section class="card">' +
            '<h2>🔴 Objetivos semanales</h2>' +
            '<div class="row between">' +
              '<span class="pill s-pending" id="pillKey">⏳ Llave del León Negro</span>' +
              '<label class="toggle"><input type="checkbox" id="wkKeyDone"><span>Marcar</span></label>' +
            '</div>' +
            '<div class="bar"><div class="bar-fill" id="barKey" style="width:0%"></div></div>' +
            
            '<div class="row between">' +
              '<span class="pill s-pending" id="pillLeivas">Leivas: 0/5</span>' +
              '<div><button class="btn-ghost" id="assMinus">−</button><button class="btn-ghost" id="assPlus">+</button></div>' +
            '</div>' +
            '<div class="bar"><div class="bar-fill" id="barLeivas" style="width:0%"></div></div>' +
          '</section>' +
          
          '<div class="panel-head"><h3>Leivas (Arborstone)</h3></div>' +
          '<p class="muted">Compradas: <span id="assCount">0</span>/5</p>' +
          '<p><button id="assWp" class="btn btn--ghost btn--xs">Copiar Arborstone [&BCEJAAA=]</button></p>' +
        '</div>' +
      '</div>';
    
    var anchor = $('#walletPanel');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor);
    } else {
      document.body.appendChild(host);
    }
    
    $('#actTabDaily').addEventListener('click', function() {
      $('#actDaily').hidden = false;
      $('#actWeekly').hidden = true;
      this.classList.remove('btn--ghost');
      $('#actTabWeekly').classList.add('btn--ghost');
    });
    
    $('#actTabWeekly').addEventListener('click', function() {
      $('#actDaily').hidden = true;
      $('#actWeekly').hidden = false;
      this.classList.remove('btn--ghost');
      $('#actTabDaily').classList.add('btn--ghost');
      renderWeekly();
    });
    
    $('#wkKeyDone').addEventListener('change', function() {
      setWeeklyKey(this.checked);
    });
    
    $('#assMinus').addEventListener('click', function() {
      setStones(state.weekly.stones - 1);
    });
    
    $('#assPlus').addEventListener('click', function() {
      setStones(state.weekly.stones + 1);
    });
    
    $('#assWp').addEventListener('click', function() {
      copyToClipboard('[&BCEJAAA=]');
    });
    
    $('#psnaCopyAll').addEventListener('click', function() {
      var list = state.daily.psna || [];
      var chats = [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].chat) chats.push(list[i].chat);
      }
      if (chats.length) {
        copyToClipboard(chats.join(' '));
        if (window.toast) window.toast('success', chats.length + ' waypoints copiados');
      } else {
        if (window.toast) window.toast('error', 'No hay waypoints disponibles');
      }
    });
    
    return host;
  }

  // =======================================================================
  // 12. CICLO DE VIDA
  // =======================================================================
  
  async function activate() {
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    
    try {
      state.token = root.__GN__ && root.__GN__.getSelectedToken ? root.__GN__.getSelectedToken() : null;
    } catch (e) {
      state.token = null;
    }
    
    loadToggles();
    await loadWeeklyForToken(state.token);
    await Assets.load();
    
    WorldBosses.update();
    renderWorldBosses();
    renderWeekly();
    
    // PSNA con last win interno
    await PSNA.load(false);
    
    // Fractales
    await Fractals.loadToday();
    requestIdle(function() { Fractals.loadTomorrow(); });
    
    // Ecto
    await Ecto.loadStatus(state.token);
    
    // Home Nodes (si existe)
    if (window.HomeNodes && typeof window.HomeNodes.load === 'function') {
      window.HomeNodes.load(state.token);
    }
    
    renderDailyKPI();
  }
  
  function deactivate() {
    state.active = false;
    var panel = $('#activitiesPanel');
    if (panel) panel.setAttribute('hidden', '');
  }

  // =======================================================================
  // 13. PREFETCH (para el router)
  // =======================================================================
  
  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    
    var token = ctx && ctx.token ? ctx.token : (root.__GN__ && root.__GN__.getSelectedToken ? root.__GN__.getSelectedToken() : null);
    
    // Pre-cargar assets y schedule PSNA
    await Assets.load();
    await PSNA.loadSchedule(false);
    
    // Fractales (hoy) en paralelo
    try {
      await Fractals._fetch('today');
    } catch (e) {
      console.warn(LOG, 'prefetch fractals error', e);
    }
  }

  // =======================================================================
  // 14. EVENTOS GLOBALES (solo gn:global-refresh)
  // =======================================================================
  
  function wireGlobal() {
    // NO escuchamos gn:tokenchange (lo hace el router)
    
    document.addEventListener('gn:global-refresh', function() {
      if (!state.active) return;
      
      // Refresh con last win
      PSNA.load(true);
      Fractals.loadToday();
      WorldBosses.update();
      
      if (state.token) {
        Ecto.loadStatus(state.token);
        if (window.HomeNodes && typeof window.HomeNodes.load === 'function') {
          window.HomeNodes.load(state.token);
        }
      }
    });
  }

  // =======================================================================
  // 15. API PÚBLICA
  // =======================================================================
  
  var Activities = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      wireGlobal();
      state.inited = true;
      console.info(LOG, 'ready v3.1.0');
    },
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    Route: {
      path: 'account/activities',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    }
  };
  
  root.Activities = Activities;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Activities.initOnce);
  } else {
    Activities.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);