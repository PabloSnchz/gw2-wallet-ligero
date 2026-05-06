/*!
 * js/characters.js — Panel de Personajes y Localización
 * v2.3.0 (2026-03-24)
 *
 * CAMBIOS v2.3.0:
 * - Agregado ícono al título del panel (156678.png)
 *
 * CORRECCIÓN v2.2.2:
 * - Persistencia visual de POIs seleccionados (ya no se pierde al elegir)
 * - setAssignment() actualiza solo el select afectado, sin rerenderizar todo
 * - Se mantiene el valor seleccionado después de la actualización
 *
 * v2.2.1:
 * - Select de POIs muestra TODOS los POIs (sin filtrar por map_id)
 * - Asignación manual pura, como requiere la funcionalidad de taxi
 *
 * v2.2.0:
 * - Filtro de categoría de POIs (granja, puzzle, evento, meta)
 * - Selects de POI se actualizan dinámicamente al cambiar categoría
 *
 * v2.1.0:
 * - Optimización de carga: reintentos automáticos, timeout reducido a 8s
 * - Carga por lotes (batches) para no saturar la API
 * - Caché de personajes (TTL 5 minutos)
 */

(function (root) {
  'use strict';
  var LOG = '[Characters]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    POIS_URL: 'assets/data/pois.json',
    RACE_ICONS_URL: 'assets/data/race_icons.json',
    MAPS_CACHE_KEY: 'characters:maps',
    POIS_CACHE_KEY: 'characters:pois',
    PROF_ICONS_CACHE_KEY: 'characters:prof_icons',
    RACE_ICONS_CACHE_KEY: 'characters:race_icons',
    SPEC_CACHE_KEY: 'characters:specs',
    ASSIGNMENTS_KEY: 'characters:assignments',
    CHAR_DETAIL_TIMEOUT: 8000,
    CHAR_LIST_TIMEOUT: 8000,
    CONCURRENCY_LIMIT: 3,
    RETRY_LIMIT: 2,
    BATCH_SIZE: 3,
    DELAY_BETWEEN_BATCHES: 500,
    CACHE_TTL: 5 * 60 * 1000,
    CHARACTERS_CACHE_KEY: 'characters:cached',
    LOCATION_HISTORY_KEY: 'characters:location_history'
  };

  // =======================================================================
  // 1. ESTADO GLOBAL
  // =======================================================================
  var state = {
    inited: false,
    active: false,
    token: null,
    characters: [],
    charactersCache: null,
    cacheTimestamp: 0,
    maps: new Map(),
    pois: [],
    profIcons: {},
    raceIcons: {},
    specs: new Map(),
    assignments: new Map(),
    guilds: new Map(),
    pvpRanksList: [],
    wvwRanksList: [],
    accountAchievements: 0,
    accountPvpRank: null,
    accountPvpPoints: 0,
    accountWvwRank: null,
    accountWvwLevel: 0,
    view: 'cards',
    filters: {
      search: '',
      map: '',
      profession: '',
      poiCategory: ''
    },
    pagination: {
      page: 1,
      perPage: 20,
      total: 0
    },
    _fetchId: 0,
    loadingState: {
      inProgress: false,
      loaded: 0,
      total: 0,
      failed: [],
      startTime: null
    },
    locationHistory: new Map()
  };

  // =======================================================================
  // 2. UTILIDADES
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

  function pad2(n) { return String(n).padStart(2, '0'); }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function(_, rej) {
        setTimeout(function() { rej(new Error('Timeout ' + (label || 'task') + ' ' + ms + 'ms')); }, ms);
      })
    ]);
  }

  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function emitEvent(eventName, detail) {
    var event = new CustomEvent('characters:' + eventName, { detail: detail });
    document.dispatchEvent(event);
  }

  // =======================================================================
  // 3. OBTENER TOKEN GLOBAL
  // =======================================================================
  function getSelectedToken() {
    try {
      return root.__GN__ && typeof root.__GN__.getSelectedToken === 'function'
        ? root.__GN__.getSelectedToken()
        : null;
    } catch (e) {
      console.warn(LOG, 'Error getting token', e);
      return null;
    }
  }

  // =======================================================================
  // 4. PERSISTENCIA DE ASIGNACIONES
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

  function loadAssignments() {
    var token = getSelectedToken();
    var keyId = token ? hashToken16(token) : 'no-token';
    try {
      var stored = localStorage.getItem(CONFIG.ASSIGNMENTS_KEY + ':' + keyId);
      if (stored) {
        var obj = JSON.parse(stored);
        state.assignments = new Map(Object.entries(obj));
      } else {
        state.assignments = new Map();
      }
    } catch (e) {
      console.warn(LOG, 'Error loading assignments', e);
      state.assignments = new Map();
    }
  }

  function saveAssignments() {
    var token = getSelectedToken();
    var keyId = token ? hashToken16(token) : 'no-token';
    try {
      var obj = Object.fromEntries(state.assignments);
      localStorage.setItem(CONFIG.ASSIGNMENTS_KEY + ':' + keyId, JSON.stringify(obj));
    } catch (e) {
      console.warn(LOG, 'Error saving assignments', e);
    }
  }

  // =======================================================================
  // 5. FUNCIÓN CORREGIDA DE ASIGNACIÓN (v2.2.2)
  // =======================================================================
  function setAssignment(characterName, poiId) {
    // Guardar en el estado y localStorage
    if (poiId) {
      state.assignments.set(characterName, poiId);
    } else {
      state.assignments.delete(characterName);
    }
    saveAssignments();
    
    // Actualizar el personaje en el array
    var character = state.characters.find(function(c) { return c.name === characterName; });
    if (character) {
      character.assigned_poi = poiId ? state.pois.find(function(p) { return p.id === poiId; }) : null;
    }
    
    // Actualizar SOLO el select correspondiente (sin rerenderizar todo)
    var select = $('.poi-select[data-char="' + characterName + '"]');
    if (select && character) {
      // Guardar el valor actual antes de actualizar opciones
      var currentValue = poiId || '';
      
      // Actualizar opciones manteniendo el valor
      updatePoiSelectOptions(select, character);
      
      // Forzar la selección
      select.value = currentValue;
      
      // Disparar evento de cambio visual si es necesario
      var event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    }
    
    // Opcional: emitir evento para que la UI se entere
    emitEvent('assignment:changed', {
      character: characterName,
      poiId: poiId,
      poiName: character?.assigned_poi?.name || null
    });
  }

  // =======================================================================
  // 6. CARGA DE DATOS
  // =======================================================================
  async function loadMaps() {
    try {
      var cached = localStorage.getItem(CONFIG.MAPS_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.ts && (Date.now() - parsed.ts) < 86400000) {
          state.maps = new Map(parsed.data);
          console.log(LOG, 'Mapas cargados desde caché:', state.maps.size);
          return;
        }
      }
    } catch (e) {}

    try {
      var res = await fetch('https://api.guildwars2.com/v2/maps?ids=all');
      var maps = await res.json();
      var mapEntries = maps.map(function(m) { return [m.id, m.name]; });
      state.maps = new Map(mapEntries);
      localStorage.setItem(CONFIG.MAPS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: mapEntries }));
      console.log(LOG, 'Mapas cargados desde API:', state.maps.size);
    } catch (e) {
      console.warn(LOG, 'Error loading maps', e);
    }
  }

  async function loadPois() {
    try {
      var cached = localStorage.getItem(CONFIG.POIS_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.ts && (Date.now() - parsed.ts) < 86400000 * 7) {
          state.pois = parsed.data;
          console.log(LOG, 'POIs cargados desde caché:', state.pois.length);
          return;
        }
      }
    } catch (e) {}

    try {
      var res = await fetch(CONFIG.POIS_URL + '?t=' + Date.now());
      var pois = await res.json();
      state.pois = pois;
      localStorage.setItem(CONFIG.POIS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: pois }));
      console.log(LOG, 'POIs cargados desde archivo:', state.pois.length);
    } catch (e) {
      console.warn(LOG, 'Error loading pois', e);
      state.pois = [];
    }
  }

  async function loadProfIcons() {
  // Mapeo de nombres de profesión a archivos locales
  var profFiles = {
    'Guardian': 'assets/icons/professions/2163504.png',
    'Warrior': 'assets/icons/professions/2163510.png',
    'Revenant': 'assets/icons/professions/2163508.png',
    'Engineer': 'assets/icons/professions/2163503.png',
    'Ranger': 'assets/icons/professions/2163507.png',
    'Thief': 'assets/icons/professions/2163509.png',
    'Elementalist': 'assets/icons/professions/2163502.png',
    'Mesmer': 'assets/icons/professions/2163505.png',
    'Necromancer': 'assets/icons/professions/2163506.png'
  };

  // Íconos de respaldo (URLs de la API por si no hay local)
  var fallbackIcons = {
    'Guardian': 'https://render.guildwars2.com/file/0950C6B70807C7A0C26A8DADDE7A9921CAB8C0C8/32px.png',
    'Warrior': 'https://render.guildwars2.com/file/0A1F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1/32px.png',
    'Revenant': 'https://render.guildwars2.com/file/1F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E/32px.png',
    'Engineer': 'https://render.guildwars2.com/file/2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B6A5F4E/32px.png',
    'Ranger': 'https://render.guildwars2.com/file/3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C7B6A5F4/32px.png',
    'Thief': 'https://render.guildwars2.com/file/4C3B2A1F0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5/32px.png',
    'Elementalist': 'https://render.guildwars2.com/file/5D4C3B2A1F0E9D8C7B6A5F4E3D2C1B0A9F8E7D6/32px.png',
    'Mesmer': 'https://render.guildwars2.com/file/6E5D4C3B2A1F0E9D8C7B6A5F4E3D2C1B0A9F8E7/32px.png',
    'Necromancer': 'https://render.guildwars2.com/file/7F6E5D4C3B2A1F0E9D8C7B6A5F4E3D2C1B0A9F8/32px.png'
  };

  try {
    var icons = {};
    
    // Cargar íconos locales
    for (var profName in profFiles) {
      icons[profName] = profFiles[profName];
    }
    
    state.profIcons = icons;
    
    // Guardar en caché (opcional)
    localStorage.setItem(CONFIG.PROF_ICONS_CACHE_KEY, JSON.stringify({ 
      ts: Date.now(), 
      data: icons 
    }));
    
    console.log(LOG, 'Iconos de profesión cargados desde assets:', icons);
    
  } catch (e) {
    console.warn(LOG, 'Error loading prof icons from assets, usando fallbacks', e);
    // Fallback a URLs de la API si hay error
    state.profIcons = fallbackIcons;
  }
}

  async function loadRaceIcons() {
    try {
      var cached = localStorage.getItem(CONFIG.RACE_ICONS_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.ts && (Date.now() - parsed.ts) < 86400000 * 7) {
          state.raceIcons = parsed.data;
          console.log(LOG, 'Iconos de raza cargados desde caché');
          return;
        }
      }
    } catch (e) {}

    try {
      var res = await fetch(CONFIG.RACE_ICONS_URL + '?t=' + Date.now());
      var icons = await res.json();
      state.raceIcons = icons;
      localStorage.setItem(CONFIG.RACE_ICONS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: icons }));
      console.log(LOG, 'Iconos de raza cargados desde archivo');
    } catch (e) {
      console.warn(LOG, 'Error loading race icons', e);
      state.raceIcons = {
        'Asura': 'https://wiki.guildwars2.com/images/thumb/a/a5/Asura_race_icon.png/32px-Asura_race_icon.png',
        'Charr': 'https://wiki.guildwars2.com/images/thumb/5/5f/Charr_race_icon.png/32px-Charr_race_icon.png',
        'Human': 'https://wiki.guildwars2.com/images/thumb/5/5d/Human_race_icon.png/32px-Human_race_icon.png',
        'Norn': 'https://wiki.guildwars2.com/images/thumb/9/9f/Norn_race_icon.png/32px-Norn_race_icon.png',
        'Sylvari': 'https://wiki.guildwars2.com/images/thumb/3/38/Sylvari_race_icon.png/32px-Sylvari_race_icon.png'
      };
    }
  }

  async function loadSpecialization(id) {
    if (!id || state.specs.has(id)) return;
    try {
      var res = await fetch('https://api.guildwars2.com/v2/specializations/' + id);
      var spec = await res.json();
      state.specs.set(id, spec);
      console.log(LOG, 'Especialidad cargada:', id, spec.name, 'icon:', spec.icon);
    } catch (e) {
      console.warn(LOG, 'Error loading spec', id, e);
      state.specs.set(id, { name: 'Desconocida', icon: '' });
    }
  }

  async function loadSpecializationsForCharacters(characters) {
    var specIds = new Set();
    characters.forEach(function(c) {
      if (c.specializations) {
        c.specializations.forEach(function(s) { if (s.id) specIds.add(s.id); });
      }
    });
    var promises = [];
    specIds.forEach(function(id) { promises.push(loadSpecialization(id)); });
    await Promise.allSettled(promises);
    console.log(LOG, 'Todas las especialidades cargadas');
  }

  // =======================================================================
  // 7. CARGA DE DATOS DE CUENTA
  // =======================================================================
  async function loadAccountData(token) {
    try {
      var achRes = await fetch('https://api.guildwars2.com/v2/account/achievements?access_token=' + encodeURIComponent(token));
      if (achRes.ok) {
        var achData = await achRes.json();
        var total = 0;
        achData.forEach(function(a) { if (a.done) total += a.current; });
        state.accountAchievements = total;
        console.log(LOG, 'Puntos de logros:', total);
      }

      console.log(LOG, 'Solicitando PvP stats...');
      var pvpStatsRes = await fetch('https://api.guildwars2.com/v2/pvp/stats?access_token=' + encodeURIComponent(token));
      console.log(LOG, 'PvP stats - status:', pvpStatsRes.status);

      if (pvpStatsRes.ok) {
        var pvpStats = await pvpStatsRes.json();
        console.log(LOG, 'PvP stats respuesta:', pvpStats);

        if (state.pvpRanksList.length === 0) {
          var pvpRanksRes = await fetch('https://api.guildwars2.com/v2/pvp/ranks?ids=all');
          if (pvpRanksRes.ok) {
            state.pvpRanksList = await pvpRanksRes.json();
          }
        }

        if (pvpStats.pvp_rank && state.pvpRanksList.length) {
          var foundRank = state.pvpRanksList.find(function(r) { return r.id === pvpStats.pvp_rank; });
          if (foundRank) {
            state.accountPvpRank = foundRank;
            state.accountPvpPoints = pvpStats.pvp_rank_points;
            console.log(LOG, 'Rango PvP asignado:', foundRank.name, 'puntos:', pvpStats.pvp_rank_points);
          }
        }
      }

      console.log(LOG, 'Solicitando account info...');
      var accountRes = await fetch('https://api.guildwars2.com/v2/account?access_token=' + encodeURIComponent(token));
      console.log(LOG, 'Account info - status:', accountRes.status);

      if (accountRes.ok) {
        var accountInfo = await accountRes.json();
        console.log(LOG, 'Account info respuesta:', accountInfo);

        if (state.wvwRanksList.length === 0) {
          var wvwRanksRes = await fetch('https://api.guildwars2.com/v2/wvw/ranks?ids=all');
          if (wvwRanksRes.ok) {
            state.wvwRanksList = await wvwRanksRes.json();
          }
        }

        if (accountInfo.wvw_rank !== undefined && state.wvwRanksList.length) {
          var foundWvwRank = state.wvwRanksList.find(function(r) {
            return accountInfo.wvw_rank >= r.min_rank && accountInfo.wvw_rank <= r.max_rank;
          });
          if (foundWvwRank) {
            state.accountWvwRank = foundWvwRank;
            state.accountWvwLevel = accountInfo.wvw_rank;
            console.log(LOG, 'Rango WvW asignado:', foundWvwRank.name, 'nivel:', accountInfo.wvw_rank);
          }
        } else {
          console.log(LOG, 'La cuenta no tiene campo wvw_rank o vale undefined');
        }
      }
    } catch (e) {
      console.warn(LOG, 'Error loading account data', e);
    }
  }

  // =======================================================================
  // 8. GREMIOS
  // =======================================================================
  async function loadGuild(guildId) {
    if (!guildId || state.guilds.has(guildId)) return;
    try {
      var res = await fetch('https://api.guildwars2.com/v2/guild/' + encodeURIComponent(guildId));
      var guild = await res.json();
      state.guilds.set(guildId, guild);
      console.log(LOG, 'Gremio cargado:', guild.tag);
    } catch (e) {
      console.warn(LOG, 'Error loading guild', guildId, e);
      state.guilds.set(guildId, { name: 'Gremio desconocido', tag: '' });
    }
  }

  // =======================================================================
  // 9. GESTIÓN DE CACHÉ DE PERSONAJES
  // =======================================================================
  function loadCharactersFromCache() {
    try {
      var token = getSelectedToken();
      if (!token) return null;
      
      var cacheKey = CONFIG.CHARACTERS_CACHE_KEY + ':' + hashToken16(token);
      var cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      var parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CONFIG.CACHE_TTL) {
        console.log(LOG, 'Personajes cargados desde caché:', parsed.characters.length);
        return parsed.characters;
      }
    } catch (e) {
      console.warn(LOG, 'Error loading characters from cache', e);
    }
    return null;
  }

  function saveCharactersToCache(characters) {
    try {
      var token = getSelectedToken();
      if (!token) return;
      
      var cacheKey = CONFIG.CHARACTERS_CACHE_KEY + ':' + hashToken16(token);
      var cacheData = {
        timestamp: Date.now(),
        characters: characters
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(LOG, 'Personajes guardados en caché');
    } catch (e) {
      console.warn(LOG, 'Error saving characters to cache', e);
    }
  }

  // =======================================================================
  // 10. HISTORIAL DE UBICACIONES
  // =======================================================================
  function loadLocationHistory() {
    try {
      var token = getSelectedToken();
      if (!token) return;
      
      var historyKey = CONFIG.LOCATION_HISTORY_KEY + ':' + hashToken16(token);
      var saved = localStorage.getItem(historyKey);
      if (saved) {
        var parsed = JSON.parse(saved);
        state.locationHistory = new Map(Object.entries(parsed));
        console.log(LOG, 'Historial de ubicaciones cargado');
      }
    } catch (e) {
      console.warn(LOG, 'Error loading location history', e);
    }
  }

  function saveLocationHistory() {
    try {
      var token = getSelectedToken();
      if (!token) return;
      
      var historyKey = CONFIG.LOCATION_HISTORY_KEY + ':' + hashToken16(token);
      var obj = Object.fromEntries(state.locationHistory);
      localStorage.setItem(historyKey, JSON.stringify(obj));
    } catch (e) {
      console.warn(LOG, 'Error saving location history', e);
    }
  }

  // =======================================================================
  // 11. OBTENCIÓN DE UBICACIÓN CON FALLBACKS
  // =======================================================================
  async function getCharacterLocation(characterName) {
    try {
      var character = state.characters.find(function(c) { return c.name === characterName; });
      if (character && character.map_id) {
        var mapName = state.maps.get(character.map_id) || 'Mapa desconocido';
        return {
          map_id: character.map_id,
          map_name: mapName,
          source: 'character'
        };
      }

      if (state.locationHistory.has(characterName)) {
        var history = state.locationHistory.get(characterName);
        if (Date.now() - history.timestamp < 3600000) {
          return {
            map_id: history.map_id,
            map_name: state.maps.get(history.map_id) || 'Mapa desconocido',
            source: 'history'
          };
        }
      }

      return {
        map_id: null,
        map_name: 'No disponible (API no devuelve ubicación)',
        source: 'fallback'
      };
    } catch (e) {
      console.warn(LOG, 'Error getting location for', characterName, e);
      return {
        map_id: null,
        map_name: 'Error al obtener ubicación',
        source: 'error'
      };
    }
  }

  // =======================================================================
  // 12. CARGA OPTIMIZADA DE PERSONAJES
  // =======================================================================
  async function loadCharacterDetailsOptimized(names, fetchId) {
    state.loadingState = {
      inProgress: true,
      loaded: 0,
      total: names.length,
      failed: [],
      startTime: Date.now()
    };
    
    emitEvent('load:start', { total: names.length });
    
    var details = [];
    var errors = [];
    
    for (var i = 0; i < names.length; i += CONFIG.BATCH_SIZE) {
      if (fetchId !== state._fetchId) {
        console.log(LOG, 'Carga cancelada por nuevo fetchId');
        return [];
      }
      
      var batch = names.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(LOG, 'Procesando lote ' + (Math.floor(i/CONFIG.BATCH_SIZE) + 1) + ':', batch);
      
      var batchPromises = batch.map(function(name) {
        return fetchCharacterDetailWithRetry(name, fetchId)
          .then(function(detail) {
            if (detail) {
              var index = names.indexOf(name);
              details[index] = detail;
              state.loadingState.loaded++;
              emitEvent('load:progress', {
                loaded: state.loadingState.loaded,
                total: state.loadingState.total,
                name: name
              });
            }
            return detail;
          })
          .catch(function(err) {
            errors.push({ name: name, error: err.message });
            state.loadingState.failed.push({ name: name, error: err.message });
            console.warn(LOG, 'Error cargando ' + name + ':', err.message);
          });
      });
      
      await Promise.allSettled(batchPromises);
      
      if (i + CONFIG.BATCH_SIZE < names.length) {
        await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    }
    
    state.loadingState.inProgress = false;
    
    if (errors.length > 0) {
      console.warn(LOG, 'Errores al cargar personajes:', errors);
      emitEvent('load:failed', {
        failed: errors,
        total: names.length,
        success: names.length - errors.length
      });
    }
    
    emitEvent('load:complete', {
      total: names.length,
      loaded: names.length - errors.length,
      failed: errors.length,
      time: Date.now() - state.loadingState.startTime
    });
    
    return details.filter(function(d) { return d !== undefined; });
  }

  async function fetchCharacterDetailWithRetry(name, fetchId, retryCount) {
    if (retryCount === undefined) retryCount = 0;
    var token = getSelectedToken();
    try {
      var url = 'https://api.guildwars2.com/v2/characters/' + encodeURIComponent(name) + '?access_token=' + encodeURIComponent(token);
      
      var res = await withTimeout(fetch(url), CONFIG.CHAR_DETAIL_TIMEOUT, 'character detail');
      
      if (fetchId !== state._fetchId) {
        throw new Error('Carga cancelada');
      }
      
      if (!res.ok) {
        if (res.status === 429 && retryCount < CONFIG.RETRY_LIMIT) {
          console.log(LOG, 'Rate limit para ' + name + ', reintentando en 1s...');
          await sleep(1000);
          return fetchCharacterDetailWithRetry(name, fetchId, retryCount + 1);
        }
        console.warn(LOG, 'Error HTTP al cargar personaje', name, 'status:', res.status);
        return null;
      }
      
      var detail = await res.json();
      console.log(LOG, 'Detalle de personaje:', name, detail);

      if (detail.guild_id) {
        await loadGuild(detail.guild_id);
      }

      var specId = null;
      if (detail.specializations && detail.specializations.length > 0) {
        if (detail.specializations[2] && detail.specializations[2].id) {
          specId = detail.specializations[2].id;
          console.log(LOG, '[' + name + '] elite spec ID (slot3):', specId);
        } else {
          for (var i = 0; i < detail.specializations.length; i++) {
            if (detail.specializations[i].id) {
              specId = detail.specializations[i].id;
              console.log(LOG, '[' + name + '] using first spec ID (slot' + (i+1) + '):', specId);
              break;
            }
          }
        }
      }

      var mapId = detail.current_map_id !== undefined ? detail.current_map_id : detail.map_id;
      console.log(LOG, '[' + name + '] map_id detectado:', mapId);
      
      if (mapId) {
        state.locationHistory.set(name, {
          map_id: mapId,
          timestamp: Date.now()
        });
        saveLocationHistory();
      }

      return {
        name: detail.name,
        race: detail.race,
        gender: detail.gender,
        profession: detail.profession,
        level: detail.level,
        spec_id: specId,
        guild_id: detail.guild_id,
        guild_tag: detail.guild_id ? (state.guilds.get(detail.guild_id)?.tag || '') : '',
        guild_name: detail.guild_id ? (state.guilds.get(detail.guild_id)?.name || '') : '',
        map_id: mapId,
        map_name: mapId ? state.maps.get(mapId) : 'No disponible (API no devuelve ubicación)',
        assigned_poi: null
      };
    } catch (e) {
      if (retryCount < CONFIG.RETRY_LIMIT) {
        console.log(LOG, 'Reintentando ' + name + ' (intento ' + (retryCount + 1) + '/' + CONFIG.RETRY_LIMIT + ')...');
        await sleep(1000);
        return fetchCharacterDetailWithRetry(name, fetchId, retryCount + 1);
      }
      console.warn(LOG, 'Error loading character', name, e);
      throw e;
    }
  }

  // =======================================================================
  // 13. CARGA DE PERSONAJES
  // =======================================================================
  async function loadCharacters(useCache) {
    if (useCache === undefined) useCache = true;
    var fetchId = ++state._fetchId;
    var token = getSelectedToken();
    if (!token) {
      state.characters = [];
      render();
      return;
    }

    try {
      if (useCache) {
        var cached = loadCharactersFromCache();
        if (cached) {
          state.characters = cached;
          state.pagination.total = cached.length;
          
          loadSpecializationsForCharacters(cached).then(function() {
            render();
          });
          
          render();
          
          setTimeout(function() {
            if (state.active) {
              console.log(LOG, 'Refrescando caché en segundo plano...');
              loadCharacters(false);
            }
          }, 1000);
          
          return;
        }
      }

      var listRes = await withTimeout(fetch('https://api.guildwars2.com/v2/characters?access_token=' + encodeURIComponent(token)), CONFIG.CHAR_LIST_TIMEOUT, 'characters list');
      if (!listRes.ok) {
        console.warn(LOG, 'Error al obtener lista de personajes, status:', listRes.status);
        return;
      }
      var names = await listRes.json();
      if (fetchId !== state._fetchId) return;
      console.log(LOG, 'Personajes encontrados:', names);

      var detailsArray = await loadCharacterDetailsOptimized(names, fetchId);
      if (fetchId !== state._fetchId) return;

      var validDetails = detailsArray.filter(function(d) { return d !== null; });
      console.log(LOG, 'Detalles válidos:', validDetails.length);

      await loadSpecializationsForCharacters(validDetails);

      var details = validDetails.map(function(d) {
        var assignment = state.assignments.get(d.name);
        d.assigned_poi = assignment ? state.pois.find(function(p) { return p.id === assignment; }) : null;
        return d;
      });

      state.characters = details;
      state.pagination.total = details.length;
      
      saveCharactersToCache(details);
      
      console.log(LOG, 'Personajes cargados:', details.length);
      render();
      
    } catch (e) {
      console.warn(LOG, 'Error loading characters', e);
    }
  }

  // =======================================================================
  // 14. FUNCIONES PARA SELECTS DE POI
  // =======================================================================
  function refreshPoiSelects() {
    $$('.poi-select').forEach(function(select) {
      var characterName = select.getAttribute('data-char');
      var character = state.characters.find(function(c) { return c.name === characterName; });
      if (character) {
        updatePoiSelectOptions(select, character);
      }
    });
  }

  function updatePoiSelectOptions(select, character) {
    var currentValue = select.value;
    
    // Limpiar opciones existentes
    while (select.options.length > 0) {
      select.remove(0);
    }
    
    // Opción vacía (ningún POI asignado)
    select.appendChild(new Option('— Ninguno —', ''));
    
    // Obtener todos los POIs (sin filtrar por mapa)
    var poisToShow = state.pois;
    
    // Aplicar filtro de categoría si está seleccionado
    if (state.filters.poiCategory) {
      poisToShow = poisToShow.filter(function(p) { 
        return p.category === state.filters.poiCategory; 
      });
    }
    
    // Si no hay POIs para mostrar
    if (poisToShow.length === 0) {
      var noPoiOption = new Option('No hay puntos para esta categoría', '');
      noPoiOption.disabled = true;
      select.appendChild(noPoiOption);
      select.disabled = false;
      return;
    }
    
    // Agrupar por categoría para mejor organización visual
    var byCategory = {};
    poisToShow.forEach(function(p) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });
    
    // Crear optgroups por categoría
    Object.keys(byCategory).sort().forEach(function(cat) {
      var categoryLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
      var optgroup = document.createElement('optgroup');
      optgroup.label = categoryLabel;
      
      byCategory[cat].forEach(function(p) {
        // Mostrar nombre y mapa para contexto
        var option = new Option(p.name + ' (' + p.map_name + ')', p.id);
        if (character.assigned_poi && character.assigned_poi.id === p.id) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });
      
      select.appendChild(optgroup);
    });
    
    select.disabled = false;
    
    // Restaurar valor si aún existe en las nuevas opciones
    if (currentValue && Array.from(select.options).some(function(opt) { return opt.value === currentValue; })) {
      select.value = currentValue;
    }
  }

  // =======================================================================
  // 15. RENDERIZADO
  // =======================================================================
  function render() {
    if (!state.active) return;
    ensurePanel();
    
    renderAccountHeader();
    renderFilters();
    renderList();
    
    emitEvent('rendered', {
      count: state.characters.length,
      filtered: getFilteredCount()
    });
  }

  // Botón "Volver al Inventario" ahora en renderFilters()
  function renderBackToInventoryButton() {
    return;
  }

  function getFilteredCount() {
    return state.characters.filter(function(c) {
      if (state.filters.search && !c.name.toLowerCase().includes(state.filters.search.toLowerCase())) return false;
      if (state.filters.map && c.map_name !== state.filters.map) return false;
      if (state.filters.profession && c.profession !== state.filters.profession) return false;
      return true;
    }).length;
  }

  function renderAccountHeader() {
    var container = $('#charAccountHeader');
    if (!container) return;

    var ach = state.accountAchievements ? state.accountAchievements.toLocaleString() : '—';
    var pvpName = state.accountPvpRank ? state.accountPvpRank.name : '—';
    var pvpPoints = state.accountPvpPoints ? ' ' + state.accountPvpPoints : '';
    var pvp = pvpName + pvpPoints;
    var wvwName = state.accountWvwRank ? state.accountWvwRank.name : '—';
    var wvwLevel = state.accountWvwLevel ? ' ' + state.accountWvwLevel : '';
    var wvw = wvwName + wvwLevel;

    container.innerHTML = '\n      <div class="account-summary" style="display: flex; gap: 20px; padding: 10px; background: #1a1e2a; border-radius: 8px; margin-bottom: 16px;">\n        <div><strong>\uD83C\uDFC6 Logros:</strong> ' + ach + '</div>\n        <div><strong>\u2694\uFE0F PvP:</strong> ' + pvp + '</div>\n        <div><strong>\uD83D\uDEE1\uFE0F WvW:</strong> ' + wvw + '</div>\n      </div>\n    ';
  }

  function renderFilters() {
    var container = $('#charFilters');
    if (!container) return;

    var maps = new Set(state.characters.map(function(c) { return c.map_name; }).filter(Boolean));
    var professions = new Set(state.characters.map(function(c) { return c.profession; }).filter(Boolean));
    var categories = new Set(state.pois.map(function(p) { return p.category; }).filter(Boolean));
    var categoryIcons = { 'granja': '🌾', 'puzzle': '🧩', 'evento': '⏰', 'meta': '📦' };

    var html = '';
    html += '<div class="chips" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    html += '<button id="charBackToInventory" class="btn btn--ghost" title="Volver a la busqueda de inventario" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:0.78rem;">';
    html += '<img src="assets/icons/Welcome/358409.png" width="14" height="14" alt="" style="opacity:0.7;">Volver al Inventario';
    html += '</button>';
    html += '<div class="chip"><select id="charMapFilter"><option value="">Todos los mapas</option>';
    Array.from(maps).forEach(function(m) { html += '<option value="' + esc(m) + '" ' + (state.filters.map === m ? 'selected' : '') + '>' + esc(m) + '</option>'; });
    html += '</select></div>';
    html += '<div class="chip"><select id="charProfFilter"><option value="">Todas las profesiones</option>';
    Array.from(professions).forEach(function(p) { html += '<option value="' + esc(p) + '" ' + (state.filters.profession === p ? 'selected' : '') + '>' + esc(p) + '</option>'; });
    html += '</select></div>';
    html += '<div class="chip"><select id="poiCategoryFilter"><option value="">Todas las categorias</option>';
    Array.from(categories).forEach(function(c) { html += '<option value="' + c + '" ' + (state.filters.poiCategory === c ? 'selected' : '') + '>' + (categoryIcons[c] || '📍') + ' ' + (c.charAt(0).toUpperCase() + c.slice(1)) + '</option>'; });
    html += '</select></div>';
    html += '<div class="chip chip--check"><button id="charViewToggle" class="btn btn--ghost" data-tip="Cambiar vista">' + (state.view === 'table' ? 'Vista tarjetas' : 'Vista tabla') + '</button></div>';
    html += '<div style="position:relative;margin-left:auto;">';
    html += '<img src="assets/icons/Welcome/3124974.png" width="14" height="14" alt="" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.4;pointer-events:none;">';
    html += '<input type="text" id="charSearchInp" placeholder="Buscar personaje..." value="' + esc(state.filters.search) + '" style="padding:7px 10px 7px 30px;background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;font-size:0.8rem;width:200px;">';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    $('#charSearchInp').addEventListener('input', function(e) {
      state.filters.search = e.target.value;
      state.pagination.page = 1;
      renderList();
    });

    $('#charMapFilter').addEventListener('change', function(e) {
      state.filters.map = e.target.value;
      state.pagination.page = 1;
      renderList();
    });

    $('#charProfFilter').addEventListener('change', function(e) {
      state.filters.profession = e.target.value;
      state.pagination.page = 1;
      renderList();
    });

    $('#poiCategoryFilter').addEventListener('change', function(e) {
      state.filters.poiCategory = e.target.value;
      refreshPoiSelects();
    });

    $('#charViewToggle').addEventListener('click', function() {
      state.view = state.view === 'table' ? 'cards' : 'table';
      render();
    });

    var backBtn = document.getElementById('charBackToInventory');
    if (backBtn && !backBtn.__wiredBack) {
      backBtn.__wiredBack = true;
      backBtn.addEventListener('click', function() {
        root.Characters.deactivate();
        if (root.InventoryHub && typeof root.InventoryHub.activate === 'function') {
          // Mostrar panel de inventario y ocultar panel de personajes
          var invPanel = document.getElementById('inventoryPanel');
          var charPanel = document.getElementById('charactersPanel');
          if (invPanel) invPanel.removeAttribute('hidden');
          if (charPanel) charPanel.setAttribute('hidden', '');
          root.InventoryHub.activate();
        } else {
          location.hash = '#/account/characters';
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      });
    }
  }

  function renderList() {
    var container = $('#charList');
    if (!container) return;

    var filtered = state.characters.filter(function(c) {
      if (state.filters.search && !c.name.toLowerCase().includes(state.filters.search.toLowerCase())) return false;
      if (state.filters.map && c.map_name !== state.filters.map) return false;
      if (state.filters.profession && c.profession !== state.filters.profession) return false;
      return true;
    });

    state.pagination.total = filtered.length;
    var start = (state.pagination.page - 1) * state.pagination.perPage;
    var paginated = filtered.slice(start, start + state.pagination.perPage);

    while (container.firstChild) container.removeChild(container.firstChild);

    if (state.loadingState.inProgress) {
      var loadingEl = createEl('div', {
        className: 'characters-loading',
        style: {
          padding: '20px',
          textAlign: 'center',
          background: '#1a1e2a',
          borderRadius: '8px',
          marginBottom: '16px'
        }
      }, 'Cargando personajes... ' + state.loadingState.loaded + '/' + state.loadingState.total);
      container.appendChild(loadingEl);
    }

    if (state.view === 'table') {
      renderTable(container, paginated);
    } else {
      renderCards(container, paginated);
    }

    renderPagination();
  }

  function createEl(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        if (key === 'className') {
          el.className = attrs[key];
        } else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.assign(el.style, attrs[key]);
        } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        } else {
          el.setAttribute(key, attrs[key]);
        }
      });
    }
    if (children) {
      if (Array.isArray(children)) {
        children.forEach(function(child) { if (child) el.appendChild(child); });
      } else if (typeof children === 'string') {
        el.appendChild(document.createTextNode(children));
      } else if (children) {
        el.appendChild(children);
      }
    }
    return el;
  }

  var PROF_COLORS = {
    'Guardian': '#73b9ff',
    'Warrior': '#ffd966',
    'Revenant': '#b19cd9',
    'Engineer': '#ff9d5c',
    'Ranger': '#6b8e23',
    'Thief': '#b85e5e',
    'Elementalist': '#ff7b7b',
    'Mesmer': '#c45ec4',
    'Necromancer': '#6a5acd'
  };

  function createProfIcon(profession) {
    var url = state.profIcons[profession];
    var initial = profession ? profession.charAt(0) : '?';
    var color = PROF_COLORS[profession] || '#888';
    var container = createEl('div', { className: 'prof-icon-container', style: { position: 'relative', display: 'inline-block', width: '64px', height: '64px' } });

    if (url) {
      var img = createEl('img', {
        src: url,
        alt: profession,
        width: '64',
        height: '64',
        style: { borderRadius: '12px', background: '#1a1e2a', border: '2px solid #3a4050' },
        loading: 'lazy',
        onerror: function(e) {
          console.warn(LOG, 'Error cargando icono para ' + profession + ':', url);
          e.target.style.display = 'none';
          var fallback = createEl('div', {
            className: 'prof-fallback',
            style: {
              width: '64px',
              height: '64px',
              borderRadius: '12px',
              background: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#fff',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }
          }, initial);
          container.appendChild(fallback);
        }
      });
      container.appendChild(img);
    } else {
      container.appendChild(createEl('div', {
        style: {
          width: '64px',
          height: '64px',
          borderRadius: '12px',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
        }
      }, initial));
    }
    return container;
  }

  function renderCards(container, chars) {
    var grid = createEl('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }
    });

    chars.forEach(function(c) {
      var profIcon = createProfIcon(c.profession);
      var raceIcon = state.raceIcons[c.race];
      var spec = c.spec_id ? state.specs.get(c.spec_id) : null;
      var specIcon = spec && spec.icon ? spec.icon : null;

      console.log(LOG, '[' + c.name + '] spec_id:', c.spec_id, 'spec:', spec, 'icon:', specIcon);

      var guildHtml = c.guild_tag ? '[' + esc(c.guild_tag) + ']' : '';

      var header = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } }, [
        profIcon,
        createEl('div', { style: { flex: 1 } }, [
          createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' } }, [
            createEl('h4', { style: { margin: 0 } }, esc(c.name)),
            guildHtml ? createEl('span', { style: { color: '#ffd966' } }, guildHtml) : null
          ]),
          createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' } }, [
            raceIcon ? createEl('img', { src: raceIcon, alt: c.race, width: '24', height: '24', style: { borderRadius: '4px' }, title: c.race, onerror: function(e) { e.target.style.display = 'none'; } }) : null,
            specIcon ? createEl('img', { src: specIcon, alt: 'Especialidad', width: '24', height: '24', style: { borderRadius: '4px' }, title: spec ? spec.name : '', onerror: function(e) { e.target.style.display = 'none'; } }) : null,
            createEl('span', { className: 'muted' }, esc(c.race) + ' ' + esc(c.gender) + ' · ' + esc(c.profession) + ' · Nvl ' + c.level)
          ])
        ])
      ]);

      var mapLink = createEl('a', {
        href: c.map_id ? 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(c.map_name.replace(/ /g, '_')) : '#',
        target: c.map_id ? '_blank' : null,
        rel: c.map_id ? 'noopener' : null,
        style: c.map_id ? {} : { color: '#888', cursor: 'default' }
      }, c.map_name);

      var poiSelect = createEl('select', {
        className: 'poi-select',
        style: { width: '100%', marginTop: '4px' },
        'data-char': c.name,
        disabled: !c.map_id
      });

      setTimeout(function() {
        updatePoiSelectOptions(poiSelect, c);
      }, 0);

      poiSelect.addEventListener('change', function(e) {
        setAssignment(c.name, e.target.value || null);
      });

      var clearBtn = createEl('button', {
        className: 'btn btn--xs btn--ghost',
        'data-char': c.name,
        'data-action': 'clear'
      }, 'Limpiar');
      clearBtn.addEventListener('click', function() {
        setAssignment(c.name, null);
      });

      var card = createEl('article', { className: 'card', style: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' } }, [
        header,
        createEl('div', {}, [createEl('strong', {}, 'Mapa: '), mapLink]),
        createEl('div', {}, [
          createEl('strong', {}, 'Punto de interés:'),
          poiSelect
        ]),
        createEl('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [clearBtn])
      ]);

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function renderTable(container, chars) {
    var table = createEl('table', { className: 'table' });

    var thead = createEl('thead', {}, [
      createEl('tr', {}, [
        createEl('th', {}, 'Personaje'),
        createEl('th', {}, 'Profesión'),
        createEl('th', {}, 'Nivel'),
        createEl('th', {}, 'Mapa actual'),
        createEl('th', {}, 'Punto de interés'),
        createEl('th', {}, 'Acciones')
      ])
    ]);
    table.appendChild(thead);

    var tbody = createEl('tbody');
    chars.forEach(function(c) {
      var profIcon = createProfIcon(c.profession);
      var raceIcon = state.raceIcons[c.race];
      var spec = c.spec_id ? state.specs.get(c.spec_id) : null;
      var specIcon = spec && spec.icon ? spec.icon : null;

      var poiSelect = createEl('select', { className: 'poi-select', 'data-char': c.name, disabled: !c.map_id });
      
      setTimeout(function() {
        updatePoiSelectOptions(poiSelect, c);
      }, 0);
      
      poiSelect.addEventListener('change', function(e) {
        setAssignment(c.name, e.target.value || null);
      });

      var clearBtn = createEl('button', { className: 'btn btn--xs btn--ghost', 'data-char': c.name, 'data-action': 'clear' }, 'Limpiar');
      clearBtn.addEventListener('click', function() {
        setAssignment(c.name, null);
      });

      var mapLink = createEl('a', {
        href: c.map_id ? 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(c.map_name.replace(/ /g, '_')) : '#',
        target: c.map_id ? '_blank' : null,
        rel: c.map_id ? 'noopener' : null,
        style: c.map_id ? {} : { color: '#888', cursor: 'default' }
      }, c.map_name);

      var row = createEl('tr', {}, [
        createEl('td', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          profIcon,
          createEl('div', {}, [
            createEl('strong', {}, esc(c.name)),
            c.guild_tag ? createEl('span', { style: { color: '#ffd966', marginLeft: '4px' } }, '[' + esc(c.guild_tag) + ']') : null,
            createEl('div', { className: 'muted', style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' } }, [
              raceIcon ? createEl('img', { src: raceIcon, width: '16', height: '16', onerror: function(e) { e.target.style.display = 'none'; } }) : null,
              specIcon ? createEl('img', { src: specIcon, width: '16', height: '16', onerror: function(e) { e.target.style.display = 'none'; } }) : null,
              createEl('span', {}, esc(c.race) + ' ' + esc(c.gender))
            ])
          ])
        ]),
        createEl('td', {}, esc(c.profession)),
        createEl('td', {}, c.level),
        createEl('td', {}, [mapLink]),
        createEl('td', {}, [poiSelect]),
        createEl('td', {}, [clearBtn])
      ]);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderPagination() {
    var container = $('#charPagination');
    if (!container) return;
    var totalPages = Math.ceil(state.pagination.total / state.pagination.perPage);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    var wrapper = createEl('div', { className: 'pagination' });
    for (var i = 1; i <= totalPages; i++) {
      var btn = createEl('button', {
        className: 'btn btn--xs' + (i === state.pagination.page ? ' btn--accent' : ''),
        'data-page': i
      }, i);
      btn.addEventListener('click', function(e) {
        state.pagination.page = parseInt(e.target.getAttribute('data-page'));
        renderList();
      });
      wrapper.appendChild(btn);
    }
    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  // =======================================================================
  // 16. INICIALIZACIÓN DEL PANEL (CON ÍCONO EN EL TÍTULO)
  // =======================================================================
  function ensurePanel() {
    var host = $('#charactersPanel');
    if (host) return host;

    host = document.createElement('section');
    host.id = 'charactersPanel';
    host.className = 'panel col-main';
    host.setAttribute('hidden', '');

    host.innerHTML = '\n      <h2 class="panel__title"><img src="assets/icons/156678.png" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> Personajes y Localización</h2>\n      <div class="panel__body">\n        <div id="charAccountHeader"></div>\n        <div id="charFilters" class="chips"></div>\n        <div id="charList" class="table-wrap"></div>\n        <div id="charPagination" class="pagination-wrap"></div>\n      </div>\n    ';

    var anchor = $('#walletPanel');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor);
    } else {
      document.body.appendChild(host);
    }
    return host;
  }

  // =======================================================================
  // 17. CICLO DE VIDA
  // =======================================================================
  async function activate() {
    console.log(LOG, 'activate v2.3.0');
    state.active = true;
    ensurePanel().removeAttribute('hidden');

    state.token = getSelectedToken();
    console.log(LOG, 'token:', state.token ? 'disponible' : 'no disponible');

    await loadMaps();
    await loadPois();
    await loadProfIcons();
    await loadRaceIcons();
    loadAssignments();
    loadLocationHistory();

    if (state.token) {
      await loadAccountData(state.token);
      await loadCharacters(true);
    }

    render();
  }

  function deactivate() {
    state.active = false;
    var panel = $('#charactersPanel');
    if (panel) panel.setAttribute('hidden', '');
  }

  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    await loadMaps();
    await loadPois();
    await loadProfIcons();
    await loadRaceIcons();
  }

  // =======================================================================
  // 18. EVENTOS GLOBALES
  // =======================================================================
  function wireGlobal() {
    document.addEventListener('gn:tokenchange', async function(ev) {
      var tok = ev && ev.detail ? ev.detail.token : null;
      state.token = tok;
      if (!state.active) return;
      loadAssignments();
      loadLocationHistory();
      if (tok) {
        await loadAccountData(tok);
        await loadCharacters(true);
      }
      render();
    });
  }

  // =======================================================================
  // 19. API PÚBLICA
  // =======================================================================
  var Characters = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      wireGlobal();
      state.inited = true;
      console.info(LOG, 'ready v2.3.0 — Ícono en el título del panel');
    },
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    Route: {
      path: 'account/characters',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    },
    refresh: function(force) {
      if (force === undefined) force = false;
      if (state.active && state.token) {
        loadCharacters(!force);
      }
    },
    getLoadingState: function() {
      return { ...state.loadingState };
    },
    getCharacterLocation: function(name) {
      return getCharacterLocation(name);
    },
    on: function(eventName, callback) {
      document.addEventListener('characters:' + eventName, callback);
    },
    off: function(eventName, callback) {
      document.removeEventListener('characters:' + eventName, callback);
    },
    clearCache: function() {
      var token = getSelectedToken();
      if (token) {
        var cacheKey = CONFIG.CHARACTERS_CACHE_KEY + ':' + hashToken16(token);
        localStorage.removeItem(cacheKey);
        console.log(LOG, 'Caché de personajes eliminada');
      }
    },
    // NUEVO: Exponer lista de personajes para InventoryHub
    getCharacterList: function() {
      return state.characters.slice();
    },
    _debug: function() {
      return {
        characters: state.characters,
        maps: Array.from(state.maps.entries()),
        pois: state.pois,
        profIcons: state.profIcons,
        raceIcons: state.raceIcons,
        specs: Array.from(state.specs.entries()),
        assignments: Object.fromEntries(state.assignments),
        filters: state.filters,
        view: state.view,
        pagination: state.pagination,
        token: state.token,
        accountAchievements: state.accountAchievements,
        accountPvpRank: state.accountPvpRank,
        accountPvpPoints: state.accountPvpPoints,
        accountWvwRank: state.accountWvwRank,
        accountWvwLevel: state.accountWvwLevel,
        loadingState: state.loadingState,
        locationHistory: Object.fromEntries(state.locationHistory)
      };
    }
  };

  root.Characters = Characters;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Characters.initOnce);
  } else {
    Characters.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);