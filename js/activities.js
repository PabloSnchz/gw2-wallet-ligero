/*!
 * js/activities.js — Panel de Actividades (Objetivos / Home Nodes)
 * v3.18.0 (2026-03-24)
 *
 * CAMBIOS v3.18.0:
 * - Agregado ícono al título del panel (1302773.png)
 *
 * CAMBIOS v3.17.0:
 * - Fractales: URLs de íconos corregidas usando wiki.guildwars2.com (estables)
 *
 * CAMBIOS v3.16.0:
 * - PSNA: grid 3x2 (3 columnas, 2 filas) con texto truncado
 * - Ecto: grid 1x4 (una línea con 4 tarjetas horizontales compactas)
 * - Fractales: 2 filas (3 T4 + 3 REC) con tarjetas centradas
 */

(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    PSNA_DATA_PATHS: [
      'assets/data/psna-schedule.json',
      'https://raw.githubusercontent.com/PabloSnchz/gw2-wallet-ligero/main/assets/data/psna-schedule.json'
    ],
    PSNA_CACHE_KEY: 'psna:schedule',
    PSNA_LAST_UPDATE_KEY: 'psna:lastUpdate',
    PSNA_DAILY_CACHE_PREFIX: 'psna:',
    ACTIVITIES_CACHE_KEYS: [
      'psna:schedule',
      'psna:lastUpdate',
      'gn:wiki:thumbs'
    ]
  };

  // =======================================================================
  // 1. ESTADO GLOBAL
  // =======================================================================
  var state = {
    inited: false,
    active: false,
    token: null,
    
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
    
    weekly: {
      key: false,
      stones: 0
    },
    
    toggles: {
      v: 2,
      date: null,
      week: null,
      homeNodesCollected: {},
      byKey: {}
    },
    
    assets: {
      key: null,
      stone: null
    },
    
    _psnaFetchId: 0,
    _fractalsFetchId: 0,
    _ectoFetchId: 0,
    
    homeNodesLoaded: false,
    homeNodesRendered: false
  };

  // =======================================================================
  // 2. DATOS ESTÁTICOS DE RESPALDO
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
    ]},
    { date: '2026-03-19', waypoints: [
      'Blue Oasis',
      'Seraph Protectors',
      'Armada Harbor',
      'Altar Brook Trading Post',
      'Rocklair',
      'Village of Scalecatch Waypoint'
    ]},
    { date: '2026-03-20', waypoints: [
      'Repair Station',
      'Breth Ayahusasca',
      'Shelter Docks',
      'Pearl Islet Waypoint',
      'Dolyak Pass Waypoint',
      'Hawkgates Waypoint'
    ]},
    { date: '2026-03-21', waypoints: [
      'Camp Resolve Waypoint',
      'Gallant\'s Folly',
      'Augur\'s Torch',
      'Vigil Keep Waypoint',
      'Baldstead',
      'Bovarin Estate'
    ]},
    { date: '2026-03-22', waypoints: [
      'Azarr\'s Arbor',
      'Mabon Waypoint',
      'Fort Trinity Waypoint',
      'Mudflat Camp',
      'Blue Ice Shining Waypoint',
      'Snow Ridge Camp Waypoint'
    ]},
    { date: '2026-03-23', waypoints: [
      'Restoration Refuge',
      'Lionguard Waystation Waypoint',
      'Rally Waypoint',
      'Marshwatch Haven Waypoint',
      'Ridgerock Camp Waypoint',
      'Haymal Gore'
    ]},
    { date: '2026-03-24', waypoints: [
      'Camp Resolve Waypoint',
      'Desider Atum Waypoint',
      'Waste Hollows Waypoint',
      'Garenhoff',
      'Travelen\'s Waypoint',
      'Temperus Point Waypoint'
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
  // 4. PERSISTENCIA
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
    } catch (e) {
      console.warn(LOG, 'Error saving toggles', e);
    }
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
  // 5. LIMPIEZA DE CACHÉS
  // =======================================================================
  function cleanActivitiesCache() {
    console.log(LOG, '🧹 Limpiando solo cachés de Activities...');
    
    var removed = 0;
    var activitiesKeys = [];
    
    CONFIG.ACTIVITIES_CACHE_KEYS.forEach(function(key) {
      activitiesKeys.push(key);
    });
    
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('psna:')) {
        activitiesKeys.push(key);
      }
    }
    
    activitiesKeys.forEach(function(key) {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed++;
          console.log(LOG, '  Eliminado:', key);
        }
      } catch (e) {
        console.warn(LOG, 'Error eliminando', key, e);
      }
    });
    
    console.log(LOG, '✅ Limpiados', removed, 'items de Activities');
  }

  function cleanAchievementsCache() {
    console.log(LOG, '🧹 Limpiando cachés de logros (ach_*)...');
    
    var removed = 0;
    var keysToRemove = [];
    
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key.startsWith('ach_') || key.startsWith('ach:'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(function(key) {
      try {
        localStorage.removeItem(key);
        removed++;
        console.log(LOG, '  Eliminado:', key);
      } catch (e) {
        console.warn(LOG, 'Error eliminando', key, e);
      }
    });
    
    console.log(LOG, '✅ Limpiados', removed, 'cachés de logros');
  }

  // =======================================================================
  // 6. SERVICIO PSNA
  // =======================================================================
  var PSNA = {
    loadSchedule: async function(force) {
      console.log(LOG, '📅 loadSchedule llamado, force=', force);
      var fetchId = ++state._psnaFetchId;
      var today = dayKeyUTC();
      var lastUpdate = localStorage.getItem(CONFIG.PSNA_LAST_UPDATE_KEY);
      
      if (!force && lastUpdate === today) {
        try {
          var cached = localStorage.getItem(CONFIG.PSNA_CACHE_KEY);
          if (cached) {
            state.daily.psnaSchedule = JSON.parse(cached);
            console.log(LOG, '📦 Usando schedule cacheado');
            return true;
          }
        } catch (e) {
          console.warn(LOG, 'Error reading cache', e);
        }
      }
      
      for (var i = 0; i < CONFIG.PSNA_DATA_PATHS.length; i++) {
        var url = CONFIG.PSNA_DATA_PATHS[i];
        
        if (url.startsWith('assets/') && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
          continue;
        }
        
        try {
          console.log(LOG, '🌐 Cargando PSNA desde:', url);
          var response = await fetch(url + '?t=' + Date.now());
          if (!response.ok) continue;
          
          var data = await response.json();
          
          if (data && data.schedule && Array.isArray(data.schedule)) {
            if (fetchId !== state._psnaFetchId) return false;
            
            state.daily.psnaSchedule = data.schedule;
            state.daily.psnaLastUpdate = data.lastUpdated || today;
            
            try {
              localStorage.setItem(CONFIG.PSNA_CACHE_KEY, JSON.stringify(data.schedule));
              localStorage.setItem(CONFIG.PSNA_LAST_UPDATE_KEY, today);
            } catch (e) {
              console.warn(LOG, 'No se pudo guardar en localStorage');
            }
            
            console.log(LOG, '✅ Schedule actualizado desde:', url);
            return true;
          }
        } catch (e) {
          console.warn(LOG, '⚠️ Error cargando desde', url, e.message);
        }
      }
      
      if (fetchId !== state._psnaFetchId) return false;
      console.warn(LOG, '⚠️ Usando schedule de respaldo');
      state.daily.psnaSchedule = FALLBACK_PSNA_SCHEDULE;
      return false;
    },
    
    load: async function(forceRefresh) {
      console.log(LOG, '📅 PSNA.load llamado');
      
      await this.loadSchedule(forceRefresh);
      
      var today = new Date();
      var todayStr = today.getUTCFullYear() + '-' + 
                     String(today.getUTCMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getUTCDate()).padStart(2, '0');
      
      var todayData = null;
      for (var i = 0; i < state.daily.psnaSchedule.length; i++) {
        if (state.daily.psnaSchedule[i].date === todayStr) {
          todayData = state.daily.psnaSchedule[i];
          break;
        }
      }
      
      if (!todayData) {
        console.warn(LOG, '⚠️ No hay datos para hoy, usando primero');
        todayData = state.daily.psnaSchedule[0];
      }
      
      var psnaManual = [];
      for (var j = 0; j < 6; j++) {
        var waypoint = todayData.waypoints[j];
        var name = typeof waypoint === 'object' ? waypoint.name : waypoint;
        var code = typeof waypoint === 'object' ? waypoint.code : PSNA_CODES[name];
        
        psnaManual.push({
          region: PSNA_REGIONS[j],
          npc: PSNA_NPCS[j],
          name: name,
          wpName: name,
          chat: code
        });
      }
      
      state.daily.psna = psnaManual;
      
      renderPSNA();
      renderDailyKPI();
      
      console.log(LOG, '✅ PSNA cargado y renderizado');
    }
  };

  // =======================================================================
  // 7. RENDERIZADO PSNA (Grid 3x2 compacto - 3 columnas, 2 filas)
  // =======================================================================
  
  function renderPSNA() {
    console.log(LOG, '🎨 renderPSNA() llamado');
    
    var grid = $('#psnaGrid');
    var status = $('#psnaStatus');
    var copyAll = $('#psnaCopyAll');
    
    if (!grid) {
      console.error(LOG, '❌ psnaGrid no encontrado en el DOM');
      return;
    }
    
    var list = state.daily.psna || [];
    
    if (list.length === 0) {
      grid.innerHTML = '<p class="muted">No hay datos PSNA disponibles</p>';
      if (status) status.innerHTML = '<span class="pill s-error">❌ Sin datos</span>';
      return;
    }
    
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    grid.style.gap = '10px';
    
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      
      var hasChat = item.chat && item.chat.length > 0;
      var disabled = hasChat ? '' : ' disabled';
      var tooltip = hasChat ? 'Copiar waypoint' : 'Código no disponible';
      
      html += `
        <article class="card psna-card" data-psna-region="${esc(item.region)}" style="padding: 8px 10px; display: flex; flex-direction: column; width: 100%;">
          <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
            <img src="https://wiki.guildwars2.com/images/thumb/d/d2/Waypoint_%28map_icon%29.png/32px-Waypoint_%28map_icon%29.png" 
                 width="24" height="24" alt="WP" loading="lazy" style="flex-shrink: 0;">
            <button class="btn btn--ghost btn--xs psna-copy-btn" 
                    data-psna-copy data-psna-index="${i}" 
                    title="${tooltip}" data-tip="${tooltip}"${disabled}
                    style="flex: 1; text-align: left; justify-content: flex-start; padding: 4px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${esc(item.wpName)}
            </button>
          </div>
          <div class="muted" style="margin-top: 6px; font-size: 0.7rem; line-height: 1.3;">
            <div><strong>${esc(item.npc)}</strong> — ${esc(item.region)}</div>
            <div style="color: #a0a0a6; font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(item.name)}</div>
          </div>
          ${!hasChat ? '<div class="pill s-error" style="margin-top: 6px; font-size: 0.6rem; text-align: center;">❌ Sin código</div>' : ''}
        </article>
      `;
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

  // =======================================================================
  // 8. SERVICIO ECTO
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
  // 9. RENDERIZADO ECTO (Grid 1x4 - una línea con 4 tarjetas horizontales)
  // =======================================================================
  function renderEcto() {
    var host = $('#ectoGrid');
    var status = $('#ectoStatus');
    if (!host) return;
    
    var html = '';
    var map = state.daily.ecto.itemMap || {};
    var items = state.daily.ecto.items || new Map();
    
    if (Object.keys(map).length === 0) {
      host.innerHTML = '<p class="muted">No hay datos de Ecto</p>';
      if (status) status.textContent = 'Cargando...';
      return;
    }
    
    host.style.display = 'grid';
    host.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
    host.style.gap = '10px';
    
    for (var key in map) {
      var itemId = map[key];
      var item = items.get(String(itemId));
      var done = state.daily.ecto.done.has(String(key));
      var name = item ? item.name : key;
      var icon = item && item.icon ? '<img src="' + esc(item.icon) + '" width="36" height="36" alt="" style="border-radius: 6px;">' : '';
      
      html += `
        <article class="card ecto-card" style="padding: 6px 8px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;">
          <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            ${icon}
          </div>
          <div style="width: 100%;">
            <div style="font-weight: 600; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${esc(name)}">
              ${esc(name)}
            </div>
            <div style="margin-top: 4px;">
              ${done 
                ? '<span class="badge badge--success" style="font-size: 0.6rem; padding: 2px 4px;">✅ Hecho</span>' 
                : '<span class="badge badge--warning" style="font-size: 0.6rem; padding: 2px 4px;">⏳ Pendiente</span>'}
            </div>
          </div>
        </article>
      `;
    }
    
    host.innerHTML = html;
    if (status) status.textContent = 'Listo.';
  }

  // =======================================================================
  // 10. SERVICIO ASSETS (PARA ÍCONOS SEMANALES)
  // =======================================================================
  var Assets = {
    load: async function() {
      try {
        var items = await fetch('https://api.guildwars2.com/v2/items?ids=36708,96978&lang=es').then(r => r.json());
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
  // 11. RENDERIZADO SEMANAL (CON ÍCONOS)
  // =======================================================================
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

  // =======================================================================
  // 12. FRACTALES (cards con ícono fallback local)
  // =======================================================================

  // Ícono de fallback unificado (local)
  var FRACTAL_FALLBACK_ICON = 'assets/icons/Fractal/2591.png';

  function getFractalIconHtml(fractalName, size) {
    var s = size || 48;
    return '<img src="' + FRACTAL_FALLBACK_ICON + '" width="' + s + '" height="' + s + '" alt="' + esc(fractalName) + '" loading="lazy" style="border-radius: 8px; object-fit: cover;">';
  }

  function getScaleIconHtml(scaleNum, size) {
    var s = size || 48;
    return '<img src="' + FRACTAL_FALLBACK_ICON + '" width="' + s + '" height="' + s + '" alt="Escala ' + scaleNum + '" loading="lazy" style="border-radius: 8px;">';
  }

  var Fractals = {
    _cachedIcons: new Map(),
    
    loadToday: async function() {
      state.daily.fractals.status = 'ready';
      state.daily.fractals.today = {
        t4: [
          { name: 'Twilight Oasis', cm: false },
          { name: 'Cliffside', cm: false },
          { name: 'Chaos', cm: false }
        ],
        rec: [
          { scale: 10, name: 'Scale 10' },
          { scale: 32, name: 'Scale 32' },
          { scale: 65, name: 'Scale 65' }
        ]
      };
      renderFractals();
    },
    
    loadTomorrow: async function() {
      state.daily.fractals.tomorrow = {
        t4: [
          { name: 'Solid Ocean', cm: false },
          { name: 'Uncategorized', cm: false },
          { name: 'Urban Battleground', cm: false }
        ],
        rec: [
          { scale: 20, name: 'Scale 20' },
          { scale: 45, name: 'Scale 45' },
          { scale: 78, name: 'Scale 78' }
        ]
      };
      renderFractals();
    }
  };

  function renderFractals() {
    var host = $('#fractalsBody');
    if (!host) return;
    
    if (state.daily.fractals.status === 'loading') {
      host.innerHTML = '<p class="muted">Cargando fractales…</p>';
      return;
    }
    
    if (state.daily.fractals.status === 'error') {
      host.innerHTML = '<p class="muted error">Error cargando fractales</p>';
      return;
    }
    
    var t4 = state.daily.fractals.today.t4 || [];
    var rec = state.daily.fractals.today.rec || [];
    
    var html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
    
    // Primera fila: Fractales T4
    html += '<div>';
    html += '<h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">' +
            '<span class="badge badge--success" style="background: #1a3a2a; border: none;">🌀 T4</span>' +
            '<span style="font-size: 0.85rem;">Fractales diarios</span></h4>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">';
    
    t4.forEach(function(fractal) {
      var name = typeof fractal === 'string' ? fractal : fractal.name;
      var hasCM = fractal.cm === true;
      html += '<article class="card fractal-card" style="padding: 10px 12px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; background: #0c0e13; border: 1px solid #2a2c35; border-radius: 10px;">' +
              '<div style="width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;">' + getFractalIconHtml(name, 48) + '</div>' +
              '<div style="width: 100%;">' +
                '<div style="font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + esc(name) + '">' + esc(name) + '</div>' +
                (hasCM ? '<div style="margin-top: 6px;"><span class="badge badge--warning" style="font-size: 0.6rem; padding: 2px 6px;">⚠️ CM</span></div>' : '') +
              '</div>' +
            '</article>';
    });
    
    html += '</div></div>';
    
    // Segunda fila: Recomendados
    html += '<div>';
    html += '<h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">' +
            '<span class="badge badge--info" style="background: #1a2a3a; border: none;">🎯 Recomendados</span>' +
            '<span style="font-size: 0.85rem;">Escalas del día</span></h4>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">';
    
    rec.forEach(function(r) {
      var scaleNum = r.scale || parseInt(String(r.name || r).match(/\d+/)?.[0] || '0', 10);
      var scaleName = typeof r === 'string' ? r : (r.name || 'Scale ' + scaleNum);
      html += '<article class="card fractal-card" style="padding: 10px 12px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; background: #0c0e13; border: 1px solid #2a2c35; border-radius: 10px;">' +
              '<div style="width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;">' + getScaleIconHtml(scaleNum, 48) + '</div>' +
              '<div style="width: 100%;">' +
                '<div style="font-weight: 600; font-size: 0.85rem;">' + esc(scaleName) + '</div>' +
                '<div style="margin-top: 6px;"><span class="badge badge--info" style="font-size: 0.6rem; padding: 2px 6px;">📊 Escala ' + scaleNum + '</span></div>' +
              '</div>' +
            '</article>';
    });
    
    html += '</div></div>';
    html += '</div>';
    
    // Nota de mañana
    if (state.daily.fractals.tomorrow && state.daily.fractals.tomorrow.t4 && state.daily.fractals.tomorrow.t4.length) {
      var tomorrowNames = state.daily.fractals.tomorrow.t4.map(function(f) {
        return typeof f === 'string' ? f : f.name;
      });
      if (tomorrowNames.length && tomorrowNames[0]) {
        html += '<div class="muted" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #26262b; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; gap: 8px;">' +
                '<span>📅</span> <span>Mañana: ' + esc(tomorrowNames.join(', ')) + '</span>' +
                '</div>';
      }
    }
    
    host.innerHTML = html;
  }

  // =======================================================================
  // 13. KPI DIARIO
  // =======================================================================
  function renderDailyKPI() {
    var host = $('#kpiDailyStrip');
    if (!host) return;
    
    var ectoDone = 0;
    state.daily.ecto.done.forEach(function() { ectoDone++; });
    
    var psnaAvail = (state.daily.psna || []).length > 0;
    var completed = (ectoDone > 0 ? 1 : 0) + (psnaAvail ? 1 : 0);
    
    host.innerHTML = '<div class="kpi-badge kpi-ok">✅ ' + completed + ' / 2 actividades</div>' +
      '<div class="kpi-hint">' + (psnaAvail ? '⏳ Próximo: PSNA' : '⏳ Próximo: Ecto') + '</div>';
  }

  // =======================================================================
  // 14. INICIALIZACIÓN DEL PANEL (CON ÍCONO EN EL TÍTULO)
  // =======================================================================
  
  function ensurePanel() {
    var host = $('#activitiesPanel');
    if (host) return host;
    
    host = document.createElement('section');
    host.id = 'activitiesPanel';
    host.className = 'panel col-main';
    host.setAttribute('hidden', '');
    
    host.innerHTML = '' +
      '<h2 class="panel__title"><img src="assets/icons/1302773.png" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> Panel de Actividades</h2>' +
      '<div class="panel__body">' +
        '<div class="act-head" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">' +
          '<div>' +
            '<p class="muted" id="actSub" style="margin: 0 0 4px 0;">Objetivos diarios y de la semana</p>' +
            '<div class="tabs">' +
              '<button id="actTabDaily" class="btn" role="tab">📋 Objetivos</button>' +
              '<button id="actTabWeekly" class="btn btn--ghost" role="tab">🏡 Home Nodes</button>' +
            '</div>' +
          '</div>' +
          '<div id="activitiesClockBarPlaceholder"></div>' +
        '</div>' +
        
        '<div id="actDaily" class="tab-panel">' +
          '<section class="kpi-strip" id="kpiDailyStrip"></section>' +
          
          '<div class="panel-head"><h3>Agente de red de suministros del Pacto</h3></div>' +
          '<p class="muted">' +
            '<button id="psnaCopyAll" class="btn btn--ghost btn--xs">Copiar todos</button>' +
          '</p>' +
          '<div id="psnaStatus" class="muted"></div>' +
          '<div id="psnaGrid" class="grid"></div>' +
          
          '<div class="panel-head"><h3>Refinamiento de Ecto</h3></div>' +
          '<div id="ectoStatus" class="muted">Cargando…</div>' +
          '<div id="ectoGrid" class="grid"></div>' +
          
          '<section class="card" id="fractalesDaily" style="margin-top: 20px;">' +
            '<h2 style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">' +
              '<span>🌀 Fractales</span>' +
              '<span class="pill s-ok" style="font-size: 0.7rem;">Actualizado diariamente</span>' +
            '</h2>' +
            '<div id="fractalsBody" class="fractals-container"></div>' +
          '</section>' +
          
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
        '</div>' +
        
        '<div id="actWeekly" class="tab-panel" hidden>' +
          '<div id="homeNodesContainer" class="home-nodes-container">' +
            '<div class="muted" style="text-align: center; padding: 40px;">🏠 Haz clic en la pestaña Home Nodes para cargar</div>' +
          '</div>' +
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
      loadHomeNodesOnDemand();
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
  
  function loadHomeNodesOnDemand() {
    if (state.homeNodesRendered) {
      console.log(LOG, '🏠 Home Nodes ya renderizado');
      return;
    }
    
    var container = $('#homeNodesContainer');
    if (!container) return;
    
    console.log(LOG, '🏠 Cargando Home Nodes por primera vez');
    
    container.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">⏳ Cargando nodos de hogar...</div>';
    
    var event = new CustomEvent('gn:render-home-nodes', {
      detail: { container: container }
    });
    document.dispatchEvent(event);
    
    if (window.ActivitiesTheme && typeof window.ActivitiesTheme.renderHomeNodes === 'function') {
      window.ActivitiesTheme.renderHomeNodes(container).then(function() {
        state.homeNodesRendered = true;
        console.log(LOG, '🏠 Home Nodes cargado vía ActivitiesTheme');
      }).catch(function(err) {
        console.warn(LOG, 'Error cargando Home Nodes', err);
        if (container && container.innerHTML.includes('Cargando')) {
          container.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">❌ Error al cargar nodos de hogar. Recarga la página.</div>';
        }
      });
    } else {
      console.warn(LOG, 'ActivitiesTheme.renderHomeNodes no disponible');
      setTimeout(function() {
        if (container && container.innerHTML.includes('Cargando')) {
          container.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">' +
            '🏡 Los Home Nodes se cargarán automáticamente.<br>' +
            '<small>Si no ves el contenido, actualiza la página.</small>' +
            '</div>';
        }
        state.homeNodesRendered = true;
      }, 500);
    }
  }

  // =======================================================================
  // 15. CICLO DE VIDA
  // =======================================================================
  
  async function activate() {
    console.log(LOG, '🚀 activate() llamado');
    
    cleanActivitiesCache();
    cleanAchievementsCache();
    
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    
    state.homeNodesRendered = false;
    
    try {
      state.token = root.__GN__ && root.__GN__.getSelectedToken ? root.__GN__.getSelectedToken() : null;
      console.log(LOG, '🔑 token:', state.token ? 'disponible' : 'no disponible');
    } catch (e) {
      state.token = null;
    }
    
    loadToggles();
    await loadWeeklyForToken(state.token);
    await Assets.load();
    
    renderWeekly();
    
    console.log(LOG, '📥 Cargando PSNA...');
    await PSNA.load(false);
    console.log(LOG, '📥 PSNA cargado');
    
    await Fractals.loadToday();
    requestIdle(function() { Fractals.loadTomorrow(); });
    await Ecto.loadStatus(state.token);
    
    renderDailyKPI();
    console.log(LOG, '✅ activate() completado');
  }
  
  function deactivate() {
    state.active = false;
    var panel = $('#activitiesPanel');
    if (panel) panel.setAttribute('hidden', '');
    state.homeNodesRendered = false;
  }

  // =======================================================================
  // 16. PREFETCH
  // =======================================================================
  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    await Assets.load();
    await PSNA.loadSchedule(false);
  }

  // =======================================================================
  // 17. EVENTOS GLOBALES
  // =======================================================================
  function wireGlobal() {
    document.addEventListener('gn:global-refresh', function() {
      if (!state.active) return;
      PSNA.load(true);
      Fractals.loadToday();
      if (state.token) {
        Ecto.loadStatus(state.token);
      }
      state.homeNodesRendered = false;
    });
  }

  // =======================================================================
  // 18. EXPOSICIÓN DE API GLOBAL
  // =======================================================================
  
  root.ActivitiesAPI = {
    getToken: function() { return state.token; },
    isActive: function() { return state.active; },
    onHomeNodesTabSelected: function(callback) {
      if (typeof callback === 'function') {
        window.__homeNodesCallback = callback;
      }
    },
    renderHomeNodes: function(container) {
      loadHomeNodesOnDemand();
      return Promise.resolve(true);
    }
  };

  // =======================================================================
  // 19. API PÚBLICA
  // =======================================================================
  
  var Activities = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      wireGlobal();
      state.inited = true;
      console.info(LOG, 'ready v3.18.0 — Ícono en el título del panel');
    },
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    Route: {
      path: 'account/activities',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    },
    _debug: function() {
      return {
        psna: state.daily.psna,
        psnaSchedule: state.daily.psnaSchedule,
        token: state.token,
        active: state.active
      };
    },
    _renderPSNA: renderPSNA,
    _forceReload: function() {
      PSNA.load(true);
    }
  };
  
  root.Activities = Activities;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Activities.initOnce);
  } else {
    Activities.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);