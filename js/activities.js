/*!
 * js/activities.js — Panel de Actividades (Objetivos / Home Nodes)
 * v3.23.0 (2026-10-21) - PSNA renovado (BL-048): el dia y la cuenta regresiva en
 *   grande (se actualiza cada 30 s), lugares como botones grandes con "Copiar" y
 *   el icono del waypoint servido desde assets/ (el de la wiki dejo de cargar y
 *   se veia el texto "WP"). Estilos propios en <style id="psnaStyle">, con las
 *   variables del theme. Funcion pura nueva psnaFalta.
 * v3.22.0 (2026-10-21) - El PSNA dice de que dia son los lugares y cuando cambian,
 *   y se actualiza solo en el cambio de las 08:00 UTC aunque la pagina quede
 *   abierta (BL-044). Funciones puras psnaNextChange y psnaDayText.
 * v3.21.0 (2026-10-21) - Fix: el PSNA muestra el dia correcto (BL-013): funcion
 *   pura psnaPickDay, lee solo assets/data/psna-schedule.json, cache 'psna:data:v4'.
 * v3.20.4 (2026-09-30) - activate() ya no borra la cache de logros de otro modulo.
 * v3.20.2 - Estilos de fractales movidos a main.css / theme-polish.css.
 * v3.20.1 - La rotacion de fractales no esta en la API: aviso en vez de datos falsos.
 * v3.19.6 (2026-04-05) - Persistencia de Piedras Vetustas con hash sincrono.
 * Historial completo de cambios: git log de este archivo.
 */

(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var CONFIG = {
    PSNA_DATA_PATHS: [
      'assets/data/psna-schedule.json'
    ],
    PSNA_CACHE_KEY: 'psna:data:v4',
    PSNA_LAST_UPDATE_KEY: 'psna:lastUpdate',
    PSNA_DAILY_CACHE_PREFIX: 'psna:',
    ACTIVITIES_CACHE_KEYS: [
      'psna:data:v4',
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
      psnaData: null,
      psnaLastUpdate: null,
      fractals: {
        status: 'idle',
        error: null,
        // La API GW2 NO expone la rotación diaria de fractales: /v2/fractals
        // devuelve {"error":"not found"} y /v2/achievements/daily responde
        // {"text":"API not active"} (retirado tras la rework de Wizard's Vault).
        // Por eso `t4` y `rec` quedan vacíos y `rotationAvailable:false`:
        // preferimos mostrar "no disponible" antes que inventar nombres.
        // El tracker de CM (abajo) SÍ es real (viene de getAccountAchievements).
        rotationAvailable: false,
        today: { t4: [], rec: [] },
        tomorrow: { t4: [], rec: [] },
        cmAchievements: new Set()
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
  // Rotacion semanal verificada contra la wiki el 2026-10-21 (BL-013).
  // Respaldo si assets/data/psna-schedule.json no se puede leer.
  var FALLBACK_PSNA_DATA = {
    resetUtcHour: 8,
    rotation: {
      monday: [
        { name: 'Restoration Refuge', code: '[&BIcHAAA=]' },
        { name: 'Lionguard Waystation Waypoint', code: '[&BEwDAAA=]' },
        { name: 'Rally Waypoint', code: '[&BNIEAAA=]' },
        { name: 'Marshwatch Haven Waypoint', code: '[&BKYBAAA=]' },
        { name: 'Ridgerock Camp Waypoint', code: '[&BIMCAAA=]' },
        { name: 'Haymal Gore', code: '[&BA8CAAA=]' }
      ],
      tuesday: [
        { name: 'Camp Resolve Waypoint', code: '[&BH8HAAA=]' },
        { name: 'Desider Atum Waypoint', code: '[&BEgAAAA=]' },
        { name: 'Waste Hollows Waypoint', code: '[&BKgCAAA=]' },
        { name: 'Garenhoff', code: '[&BBkAAAA=]' },
        { name: 'Travelen\'s Waypoint', code: '[&BGQCAAA=]' },
        { name: 'Temperus Point Waypoint', code: '[&BIMBAAA=]' }
      ],
      wednesday: [
        { name: 'Town of Prosperity', code: '[&BH4HAAA=]' },
        { name: 'Swampwatch Post', code: '[&BMIBAAA=]' },
        { name: 'Caer Shadowfain', code: '[&BP0CAAA=]' },
        { name: 'Shieldbluff Waypoint', code: '[&BKYAAAA=]' },
        { name: 'Mennerheim', code: '[&BDgDAAA=]' },
        { name: 'Ferrusatos Village', code: '[&BPEBAAA=]' }
      ],
      thursday: [
        { name: 'Blue Oasis', code: '[&BKsHAAA=]' },
        { name: 'Seraph Protectors', code: '[&BF0AAAA=]' },
        { name: 'Armada Harbor', code: '[&BO4CAAA=]' },
        { name: 'Altar Brook Trading Post', code: '[&BIMAAAA=]' },
        { name: 'Rocklair', code: '[&BF0GAAA=]' },
        { name: 'Village of Scalecatch Waypoint', code: '[&BOcBAAA=]' }
      ],
      friday: [
        { name: 'Repair Station', code: '[&BJQHAAA=]' },
        { name: 'Breth Ayahusasca', code: '[&BMwCAAA=]' },
        { name: 'Shelter Docks', code: '[&BJsCAAA=]' },
        { name: 'Pearl Islet Waypoint', code: '[&BNUGAAA=]' },
        { name: 'Dolyak Pass Waypoint', code: '[&BHsBAAA=]' },
        { name: 'Hawkgates Waypoint', code: '[&BNMAAAA=]' }
      ],
      saturday: [
        { name: 'Camp Resolve Waypoint', code: '[&BH8HAAA=]' },
        { name: 'Gallant\'s Folly', code: '[&BLkCAAA=]' },
        { name: 'Augur\'s Torch', code: '[&BBEDAAA=]' },
        { name: 'Vigil Keep Waypoint', code: '[&BJIBAAA=]' },
        { name: 'Balddistead', code: '[&BEICAAA=]' },
        { name: 'Bovarin Estate', code: '[&BBABAAA=]' }
      ],
      sunday: [
        { name: 'Azarr\'s Arbor', code: '[&BIkHAAA=]' },
        { name: 'Mabon Waypoint', code: '[&BDoBAAA=]' },
        { name: 'Fort Trinity Waypoint', code: '[&BO4CAAA=]' },
        { name: 'Mudflat Camp', code: '[&BC0AAAA=]' },
        { name: 'Blue Ice Shining Waypoint', code: '[&BIUCAAA=]' },
        { name: 'Snow Ridge Camp Waypoint', code: '[&BCECAAA=]' }
      ]
    }
  };

  // PSNA-DAY:BEGIN — funcion pura, la prueba tests/psna-day.test.cjs (BL-013)
  // Devuelve { date, weekday, waypoints, source } con los 6 lugares vigentes en
  // `now`, o null si no hay datos. La ubicacion cambia a las 08:00 UTC (o
  // data.resetUtcHour): antes de esa hora vale el dia anterior.
  // Orden: rotacion semanal -> fecha exacta en schedule -> mismo dia de la
  // semana en schedule. Nunca devuelve el dia equivocado.
  var PSNA_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function psnaPickDay(data, now) {
    if (!data || !now || isNaN(now.getTime())) return null;
    var hour = typeof data.resetUtcHour === 'number' ? data.resetUtcHour : 8;
    var t = new Date(now.getTime() - hour * 3600000);
    var key = t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
    var wd = PSNA_WEEKDAYS[t.getUTCDay()];
    function six(w) { return Array.isArray(w) && w.length === 6 ? w : null; }
    function out(w, source) { return { date: key, weekday: wd, waypoints: w, source: source }; }
    if (data.rotation && six(data.rotation[wd])) return out(data.rotation[wd], 'rotation');
    var list = Array.isArray(data.schedule) ? data.schedule : [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].date === key && six(list[i].waypoints)) return out(list[i].waypoints, 'date');
    }
    for (i = 0; i < list.length; i++) {
      var d = list[i] && list[i].date ? new Date(list[i].date + 'T12:00:00Z') : null;
      if (d && !isNaN(d.getTime()) && PSNA_WEEKDAYS[d.getUTCDay()] === wd && six(list[i].waypoints)) return out(list[i].waypoints, 'weekday');
    }
    return null;
  }

  // Proximo cambio de ubicacion (Date) despues de `now`, o null.
  function psnaNextChange(data, now) {
    if (!now || isNaN(now.getTime())) return null;
    var hour = (data && typeof data.resetUtcHour === 'number') ? data.resetUtcHour : 8;
    var n = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    if (n.getTime() <= now.getTime()) n = new Date(n.getTime() + 86400000);
    return n;
  }

  // Texto para el jugador: de que dia son los lugares y cuanto falta para el cambio.
  // Ej.: "Lugares del miércoles 21/10 · cambian en 3 h 05 min (08:00 UTC)".
  var PSNA_DIAS_ES = { sunday: 'domingo', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
    thursday: 'jueves', friday: 'viernes', saturday: 'sábado' };
  // Cuanto falta para `next`: "9 h 05 min" o "45 min" ('' si no hay datos).
  function psnaFalta(next, now) {
    if (!next || !now) return '';
    var min = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60000));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min';
  }
  function psnaDayText(day, next, now) {
    if (!day || !day.date) return '';
    var p = day.date.split('-');
    var txt = 'Lugares del ' + (PSNA_DIAS_ES[day.weekday] || day.weekday) + ' ' + p[2] + '/' + p[1];
    if (next && now) {
      txt += ' · cambian en ' + psnaFalta(next, now) +
        ' (' + String(next.getUTCHours()).padStart(2, '0') + ':00 UTC)';
    }
    return txt;
  }
  // PSNA-DAY:END

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
  // 4. PERSISTENCIA (CORREGIDA)
  // =======================================================================

  // Versión síncrona del hash (evita Promesas como claves)
  function hashToken16Sync(token) {
    if (!token) return 'no-token';
    var h = 0;
    for (var i = 0; i < token.length; i++) {
      h = ((h << 5) - h) + token.charCodeAt(i);
      h |= 0;
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  // Versión asíncrona (se mantiene por si se necesita en el futuro, pero no se usa para claves)
  async function hashToken16(token) {
    if (!token) return 'no-token';
    try {
      if (window.crypto && window.crypto.subtle) {
        var enc = new TextEncoder().encode(token);
        var buf = await crypto.subtle.digest('SHA-256', enc);
        var hex = Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        return hex.slice(0, 16);
      }
    } catch (e) { console.warn(LOG, 'hashToken', e); }
    return hashToken16Sync(token);
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

  // =======================================================================
  // 5. DETECCIÓN AUTOMÁTICA DE LLAVE SEMANAL
  // =======================================================================

  function getLastWeeklyResetUTC() {
    var now = new Date();
    var day = now.getUTCDay();
    var daysSinceMonday = (day === 0 ? 6 : day - 1);
    var lastMonday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
      7, 30, 0, 0
    ));
    if (day === 1 && (now.getUTCHours() < 7 || (now.getUTCHours() === 7 && now.getUTCMinutes() < 30))) {
      lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    }
    return lastMonday;
  }

  async function detectWeeklyKeyFromCharacters(token) {
    if (!token) return false;
    try {
      const listRes = await fetch(`https://api.guildwars2.com/v2/characters?access_token=${encodeURIComponent(token)}`);
      if (!listRes.ok) throw new Error('Error al obtener lista de personajes');
      const characterNames = await listRes.json();
      const characters = await Promise.all(
        characterNames.map(async (name) => {
          const detailRes = await fetch(`https://api.guildwars2.com/v2/characters/${encodeURIComponent(name)}?access_token=${encodeURIComponent(token)}`);
          if (!detailRes.ok) return null;
          const data = await detailRes.json();
          return {
            name: data.name,
            profession: data.profession,
            level: data.level,
            created: data.created
          };
        })
      );
      const lastWeeklyReset = getLastWeeklyResetUTC();
      const now = Date.now();
      const keyFarmers = characters.filter(char => {
        if (!char) return false;
        if (char.profession !== 'Thief') return false;
        if (char.level < 10) return false;
        const createdDate = new Date(char.created);
        const daysOld = (now - createdDate) / (1000 * 60 * 60 * 24);
        if (daysOld >= 7) return false;
        if (createdDate <= lastWeeklyReset) return false;
        return true;
      });
      const isClaimed = keyFarmers.length > 0;
      console.log(LOG, '[Key Detection] Resultado:', isClaimed ? 'RECLAMADA ✓' : 'DISPONIBLE',
                  keyFarmers.length ? `(${keyFarmers.map(f => f.name).join(', ')})` : '');
      return isClaimed;
    } catch (error) {
      console.error(LOG, '[Key Detection] Error:', error);
      return false;
    }
  }

  // PERSISTENCIA INDEPENDIENTE PARA PIEDRAS VETUSTAS (usa hash síncrono)
  function getStoneStorageKey(token) {
    if (!token) return null;
    const tokenHash = hashToken16Sync(token);
    const week = weekKeyUTC();
    return `gn_activities_stones_${tokenHash}_${week}`;
  }

  function saveStonesToStorage(token, value) {
    if (!token) return;
    const key = getStoneStorageKey(token);
    if (key) {
      localStorage.setItem(key, String(value));
      console.log(LOG, `[Stones] Guardado ${value} en ${key}`);
    }
  }

  function loadStonesFromStorage(token) {
    if (!token) return 0;
    const key = getStoneStorageKey(token);
    if (key) {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0 && val <= 5) {
          console.log(LOG, `[Stones] Cargado ${val} desde ${key}`);
          return val;
        }
      }
    }
    return 0;
  }

  // CARGA DE DATOS SEMANALES (incluye piedras desde storage)
  async function loadWeeklyForToken(token) {
    var keyId = hashToken16Sync(token);  // Usamos versión síncrona para la clave del bucket
    var bucket = state.toggles.byKey[keyId] || { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };

    var thisWeek = weekKeyUTC();
    if (bucket.week !== thisWeek) {
      bucket = { week: thisWeek, weeklyKey: false, antiqueStoneCount: 0 };
      if (token) {
        const detected = await detectWeeklyKeyFromCharacters(token);
        bucket.weeklyKey = detected;
        console.log(LOG, `[Weekly] Nueva semana (${thisWeek}), detección automática:`, detected);
      }
    }

    state.toggles.byKey[keyId] = bucket;
    state.weekly.key = bucket.weeklyKey;

    // Cargar piedras desde storage independiente
    const stones = await loadStonesFromStorage(token);
    state.weekly.stones = stones;
    // Actualizar bucket por consistencia
    bucket.antiqueStoneCount = stones;
    state.toggles.byKey[keyId] = bucket;

    saveToggles();
  }

  function saveToggles() {
    try {
      // Storage.set escribe la gn: y su legacy (storage.js MIRROR_MAP). Antes
      // escribia solo 'gn_activities_toggles', y la gn: que sube el Gist
      // quedaba con la foto del primer arranque.
      Storage.set(Storage.STORAGE_KEYS.ACTIVITIES_TOGGLES, state.toggles);
    } catch (e) {
      console.warn(LOG, 'Error saving toggles', e);
    }
  }

  function setWeeklyKey(value) {
    var keyId = hashToken16Sync(state.token);
    if (!state.toggles.byKey[keyId]) {
      state.toggles.byKey[keyId] = { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };
    }
    state.toggles.byKey[keyId].weeklyKey = !!value;
    state.weekly.key = !!value;
    saveToggles();
    renderWeekly();
  }

  function setStones(value) {
    var newValue = Math.max(0, Math.min(5, Number(value || 0)));
    state.weekly.stones = newValue;

    // Guardar en storage independiente
    if (state.token) {
      saveStonesToStorage(state.token, newValue);
    }

    // Actualizar bucket por compatibilidad (usando hash síncrono)
    var keyId = hashToken16Sync(state.token);
    if (!state.toggles.byKey[keyId]) {
      state.toggles.byKey[keyId] = { week: weekKeyUTC(), weeklyKey: false, antiqueStoneCount: 0 };
    }
    state.toggles.byKey[keyId].antiqueStoneCount = newValue;
    saveToggles();

    renderWeekly();
  }

  // =======================================================================
  // 6. LIMPIEZA DE CACHÉS
  // =======================================================================
  function cleanActivitiesCache() {
    console.log(LOG, '🧹 Limpiando solo cachés de Activities...');
    var removed = 0;
    var activitiesKeys = [];
    CONFIG.ACTIVITIES_CACHE_KEYS.forEach(function(key) { activitiesKeys.push(key); });
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('psna:')) activitiesKeys.push(key);
    }
    activitiesKeys.forEach(function(key) {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed++;
          console.log(LOG, '  Eliminado:', key);
        }
      } catch (e) { console.warn(LOG, 'Error eliminando', key, e); }
    });
    console.log(LOG, '✅ Limpiados', removed, 'items de Activities');
  }

  function cleanAchievementsCache() {
    console.log(LOG, '🧹 Limpiando cachés de logros (ach_*)...');
    var removed = 0;
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key.startsWith('ach_') || key.startsWith('ach:'))) keysToRemove.push(key);
    }
    keysToRemove.forEach(function(key) {
      try {
        localStorage.removeItem(key);
        removed++;
        console.log(LOG, '  Eliminado:', key);
      } catch (e) { console.warn(LOG, 'Error eliminando', key, e); }
    });
    console.log(LOG, '✅ Limpiados', removed, 'cachés de logros');
  }

  // =======================================================================
  // 7. SERVICIO PSNA (v3.21.0: dia por rotacion semanal, ver PSNA-DAY)
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
            var cachedData = JSON.parse(cached);
            if (cachedData && (cachedData.rotation || Array.isArray(cachedData.schedule))) {
              state.daily.psnaData = cachedData;
              state.daily.psnaSchedule = cachedData.schedule || null;
              console.log(LOG, '📦 Usando datos PSNA cacheados');
              return true;
            }
          }
        } catch (e) { console.warn(LOG, 'Error reading cache', e); }
      }
      for (var i = 0; i < CONFIG.PSNA_DATA_PATHS.length; i++) {
        var url = CONFIG.PSNA_DATA_PATHS[i];
        try {
          console.log(LOG, '🌐 Cargando PSNA desde:', url);
          var response = await fetch(url + '?t=' + Date.now());
          if (!response.ok) continue;
          var data = await response.json();
          if (data && (data.rotation || Array.isArray(data.schedule))) {
            if (fetchId !== state._psnaFetchId) return false;
            state.daily.psnaData = data;
            state.daily.psnaSchedule = data.schedule || null;
            state.daily.psnaLastUpdate = data.lastUpdated || today;
            try {
              localStorage.setItem(CONFIG.PSNA_CACHE_KEY, JSON.stringify(data));
              localStorage.setItem(CONFIG.PSNA_LAST_UPDATE_KEY, today);
            } catch (e) { console.warn(LOG, 'No se pudo guardar en localStorage'); }
            console.log(LOG, '✅ Schedule actualizado desde:', url);
            return true;
          }
        } catch (e) { console.warn(LOG, '⚠️ Error cargando desde', url, e.message); }
      }
      if (fetchId !== state._psnaFetchId) return false;
      console.warn(LOG, '⚠️ Usando rotación de respaldo');
      state.daily.psnaData = FALLBACK_PSNA_DATA;
      state.daily.psnaSchedule = null;
      return false;
    },
    load: async function(forceRefresh) {
      console.log(LOG, '📅 PSNA.load llamado');
      await this.loadSchedule(forceRefresh);
      var now = new Date();
      var todayData = psnaPickDay(state.daily.psnaData, now);
      state.daily.psnaDay = todayData;
      // Se actualiza solo en el proximo cambio (BL-044): sin esto, una pestana
      // abierta desde la noche sigue mostrando los lugares del dia anterior.
      if (state._psnaTimer) clearTimeout(state._psnaTimer);
      var next = psnaNextChange(state.daily.psnaData, now);
      if (next) {
        state._psnaTimer = setTimeout(function () {
          state._psnaTimer = null;
          if (state.active) PSNA.load(false);
        }, Math.min(next.getTime() - now.getTime() + 2000, 2147483000));
      }
      var psnaManual = [];
      if (!todayData) {
        console.warn(LOG, '⚠️ No hay datos PSNA para hoy: no se muestra un día equivocado');
        state.daily.psna = psnaManual;
        renderPSNA();
        renderDailyKPI();
        return;
      }
      for (var j = 0; j < 6; j++) {
        var waypoint = todayData.waypoints[j];
        var name = waypoint && typeof waypoint === 'object' ? waypoint.name : String(waypoint || '');
        var code = waypoint && typeof waypoint === 'object' ? (waypoint.code || '') : '';
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
  // 8. RENDERIZADO PSNA (BL-048)
  // =======================================================================
  // Icono local: el thumbnail de la wiki dejo de cargar y se veia el alt "WP".
  var PSNA_WP_ICON = 'assets/icons/733330.png';
  var PSNA_CSS = [
    '.psna{margin:20px 0;padding:16px;border:1px solid var(--bd-1,rgba(255,255,255,.08));border-radius:var(--card-radius,12px)}',
    '.psna__head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}',
    '.psna__titles{flex:1;min-width:200px}',
    '.psna__title{margin:0;font-size:1.05rem}',
    '.psna__sub{margin:2px 0 0;font-size:.8rem;color:var(--muted,#8E96A3)}',
    '.psna-day{display:flex;align-items:center;gap:12px 28px;flex-wrap:wrap;padding:12px 16px;margin-bottom:12px;border-radius:10px;background:var(--bg-2,rgba(255,255,255,.04));border:1px solid var(--bd-1,rgba(255,255,255,.08));border-left:4px solid var(--gn-gold,#F2B94B)}',
    '.psna-day__when,.psna-day__next{display:flex;flex-direction:column;gap:2px}',
    '.psna-day__label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#8E96A3)}',
    '.psna-day__name{font-size:1.25rem;color:var(--tx-1,#F4F6FA)}',
    '.psna-day__count{font-size:1.25rem;color:var(--gn-gold,#F2B94B);font-variant-numeric:tabular-nums}',
    '.psna-day__hour{font-size:.75rem;color:var(--tx-2,#C9D0DA)}',
    '.psna-day .pill{margin-left:auto}',
    '.psna__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
    '.psna-wp{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;text-align:left;font:inherit;color:var(--tx-1,#F4F6FA);background:var(--bg-1,rgba(255,255,255,.03));border:1px solid var(--bd-1,rgba(255,255,255,.08));border-radius:10px;cursor:pointer;transition:border-color .15s,transform .15s}',
    '.psna-wp:hover:not(:disabled){border-color:var(--gn-gold,#F2B94B);transform:translateY(-1px)}',
    '.psna-wp:focus-visible{outline:2px solid var(--gn-gold,#F2B94B);outline-offset:2px}',
    '.psna-wp:disabled{opacity:.6;cursor:not-allowed}',
    '.psna-wp__icon{flex-shrink:0}',
    '.psna-wp__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.psna-wp__name{font-weight:700;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.psna-wp__npc{font-size:.75rem;color:var(--tx-2,#C9D0DA);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.psna-wp__act{flex-shrink:0;font-size:.72rem;padding:3px 8px;border-radius:999px;border:1px solid var(--bd-2,rgba(255,255,255,.14));color:var(--tx-2,#C9D0DA)}',
    '.psna-wp.is-copied{border-color:var(--color-green,#3fb950)}',
    '.psna-wp.is-copied .psna-wp__act{color:var(--color-green,#3fb950);border-color:currentColor}',
    '@media (prefers-reduced-motion:reduce){.psna-wp{transition:none}.psna-wp:hover:not(:disabled){transform:none}}'
  ].join('\n');
  function ensurePsnaStyle() {
    if (document.getElementById('psnaStyle')) return;
    var st = document.createElement('style');
    st.id = 'psnaStyle';
    st.textContent = PSNA_CSS;
    document.head.appendChild(st);
  }

  function renderPSNA() {
    var grid = $('#psnaGrid');
    var status = $('#psnaStatus');
    var copyAll = $('#psnaCopyAll');
    if (!grid) {
      console.error(LOG, '❌ psnaGrid no encontrado en el DOM');
      return;
    }
    ensurePsnaStyle();
    var list = state.daily.psna || [];
    if (list.length === 0) {
      grid.innerHTML = '<p class="muted">No hay datos PSNA disponibles</p>';
      if (status) status.innerHTML = '<span class="pill s-error">❌ Sin datos</span>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var hasChat = !!(item.chat && item.chat.length);
      var tip = hasChat ? 'Copiar waypoint ' + item.chat : 'Código no disponible';
      html += '<button type="button" class="psna-wp" data-psna-copy data-psna-index="' + i + '"' +
        ' data-psna-region="' + esc(item.region) + '" title="' + esc(tip) + '"' +
        ' aria-label="' + esc((hasChat ? 'Copiar waypoint de ' : 'Sin código: ') + item.wpName) + '"' +
        (hasChat ? '' : ' disabled') + '>' +
        '<img class="psna-wp__icon" src="' + PSNA_WP_ICON + '" width="32" height="32" alt="" loading="lazy">' +
        '<span class="psna-wp__body"><span class="psna-wp__name">' + esc(item.wpName) + '</span>' +
        '<span class="psna-wp__npc">' + esc(item.npc) + ' · ' + esc(item.region) + '</span></span>' +
        '<span class="psna-wp__act">' + (hasChat ? 'Copiar' : 'Sin código') + '</span></button>';
    }
    grid.innerHTML = html;
    var buttons = grid.querySelectorAll('[data-psna-copy]');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', function(e) {
        e.preventDefault();
        var it = state.daily.psna[parseInt(this.getAttribute('data-psna-index'), 10)];
        if (!it || !it.chat) return;
        copyToClipboard(it.chat);
        var btn = this, act = btn.querySelector('.psna-wp__act');
        btn.classList.add('is-copied');
        if (act) act.textContent = '✓ Copiado';
        setTimeout(function() {
          btn.classList.remove('is-copied');
          if (act) act.textContent = 'Copiar';
        }, 1500);
      });
    }
    var valid = 0;
    for (var v = 0; v < list.length; v++) { if (list[v].chat) valid++; }
    if (copyAll) {
      copyAll.disabled = valid === 0;
      copyAll.title = valid + '/' + list.length + ' waypoints disponibles';
    }
    if (!status) return;
    var pill = valid === list.length ? '<span class="pill s-ok">✅ ' + valid + '/' + list.length + ' waypoints</span>'
      : valid ? '<span class="pill s-warn">⚠️ ' + valid + '/' + list.length + ' waypoints</span>'
      : '<span class="pill s-error">❌ Ningún waypoint disponible</span>';
    // De que dia son y cuando cambian (BL-044), en grande (BL-048).
    var now = new Date();
    var next = psnaNextChange(state.daily.psnaData, now);
    var day = state.daily.psnaDay;
    var dayTxt = psnaDayText(day, next, now);
    if (!dayTxt) { status.innerHTML = pill; return; }
    var p = day.date.split('-');
    var dia = PSNA_DIAS_ES[day.weekday] || day.weekday;
    var hora = next ? next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    status.innerHTML = '<div class="psna-day" data-psna-day role="group" aria-label="' + esc(dayTxt) + '">' +
      '<div class="psna-day__when"><span class="psna-day__label">Lugares del día</span>' +
      '<strong class="psna-day__name">' + esc(dia.charAt(0).toUpperCase() + dia.slice(1)) + ' ' + p[2] + '/' + p[1] + '</strong></div>' +
      (next ? '<div class="psna-day__next"><span class="psna-day__label">Cambian en</span>' +
        '<strong class="psna-day__count" data-psna-falta>' + esc(psnaFalta(next, now)) + '</strong>' +
        '<span class="psna-day__hour">' + String(next.getUTCHours()).padStart(2, '0') + ':00 UTC · ' + esc(hora) + ' tu hora</span></div>' : '') +
      pill + '</div>';
    // La cuenta regresiva corre sola; el cambio de lugares lo hace state._psnaTimer.
    if (state._psnaTick) clearInterval(state._psnaTick);
    state._psnaTick = setInterval(function() {
      var el = $('[data-psna-falta]');
      if (!el || !state.active) return;
      var t = new Date();
      el.textContent = psnaFalta(psnaNextChange(state.daily.psnaData, t), t);
    }, 30000);
  }

  // =======================================================================
  // 9. SERVICIO ECTO (sin cambios)
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
        } catch (e) { console.warn(LOG, 'Ecto daily error', e); }
      }
      try {
        var ids = Object.values(this._itemIds).join(',');
        var rr = await fetch('https://api.guildwars2.com/v2/items?ids=' + ids + '&lang=es');
        var list = await rr.json();
        if (fetchId === state._ectoFetchId && Array.isArray(list)) {
          list.forEach(function(it) { state.daily.ecto.items.set(String(it.id), it); });
          state.daily.ecto.itemMap = this._itemIds;
        }
      } catch (e) { console.warn(LOG, 'Ecto items error', e); }
      renderEcto();
      renderDailyKPI();
    }
  };

  // =======================================================================
  // 10. RENDERIZADO ECTO
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
      var icon = item && item.icon ? item.icon : '';
      var bLeftColor = done ? 'rgba(160,255,200,0.5)' : 'rgba(255,211,107,0.5)';
      var glowColor = done ? 'rgba(160,255,200,0.25)' : 'rgba(255,211,107,0.25)';
      var glowBorder = done ? 'rgba(160,255,200,0.3)' : 'rgba(255,211,107,0.3)';
      html += `
        <article class="card ecto-card" style="padding: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; border: 1px solid rgba(255,255,255,0.08); border-left: 3px solid ${bLeftColor}; box-shadow: 0 0 8px rgba(90,110,154,0.12);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: var(--bg-1); display: flex; align-items: center; justify-content: center; border: 1px solid var(--bd-1); box-shadow: 0 0 0 2px ${glowBorder}, 0 0 10px ${glowColor};">
            ${icon ? '<img src="' + esc(icon) + '" width="32" height="32" alt="" style="border-radius: 8px; object-fit: contain;">' : ''}
          </div>
          <div style="width: 100%;">
            <div style="font-weight: 600; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${esc(name)}">
              ${esc(name)}
            </div>
            <div style="margin-top: 4px;">
              ${done ? '<span class="badge badge--success" style="font-size: 0.6rem; padding: 2px 4px;">✅ Hecho</span>' : '<span class="badge badge--warning" style="font-size: 0.6rem; padding: 2px 4px;">⏳ Pendiente</span>'}
            </div>
          </div>
        </article>
      `;
    }
    host.innerHTML = html;
    if (status) status.textContent = 'Listo.';
  }

  // =======================================================================
  // 11. SERVICIO ASSETS (sin cambios)
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
      } catch (e) { console.warn(LOG, 'Error loading assets', e); }
      renderWeekly();
    }
  };

  // =======================================================================
  // 12. RENDERIZADO SEMANAL (sin cambios)
  // =======================================================================
  function renderWeekly() {
    var weeklyKeyStatus = $('#weeklyKeyStatus');
    if (weeklyKeyStatus) {
      if (state.weekly.key) weeklyKeyStatus.innerHTML = '<span class="badge badge--success" style="font-size: 0.9rem; padding: 6px 12px;">✓ Reclamada esta semana</span>';
      else weeklyKeyStatus.innerHTML = '<span class="badge badge--warning" style="font-size: 0.9rem; padding: 6px 12px;">⏳ Disponible</span>';
    }
    var weeklyKeyDescription = $('#weeklyKeyDescription');
    if (weeklyKeyDescription) {
      if (state.weekly.key) weeklyKeyDescription.innerHTML = '✅ Detectado automáticamente por Thief reciente (nivel 10+, &lt;7 días, misma semana)';
      else weeklyKeyDescription.innerHTML = '🔍 Detección automática: ningún Thief reciente (nivel 10+, &lt;7 días, misma semana)';
    }
    var pillLeivas = $('#pillLeivas');
    if (pillLeivas) {
      pillLeivas.textContent = 'Leivas: ' + state.weekly.stones + '/5';
      pillLeivas.className = state.weekly.stones >= 5 ? 'pill s-ok' : 'pill s-pending';
    }
    var barLeivas = $('#barLeivas');
    if (barLeivas) {
      var percentage = Math.min(100, Math.round(state.weekly.stones / 5 * 100));
      barLeivas.style.width = percentage + '%';
      barLeivas.style.background = state.weekly.stones >= 5 ? 'linear-gradient(90deg, #4CAF50, #8BC34A)' : 'linear-gradient(90deg, var(--color-amber), #ffaa33)';
    }
  }

  // =======================================================================
  // 13. FRACTALES (sin cambios)
  // =======================================================================
  var FRACTAL_FALLBACK_ICON = 'assets/icons/Fractal/2591.png';
  function getFractalIconHtml(fractalName, size) {
    var s = size || 48;
    return '<img src="' + FRACTAL_FALLBACK_ICON + '" width="' + s + '" height="' + s + '" alt="' + esc(fractalName) + '" loading="lazy" style="border-radius: 8px; object-fit: cover;">';
  }
  function getScaleIconHtml(scaleNum, size) {
    var s = size || 48;
    return '<img src="' + FRACTAL_FALLBACK_ICON + '" width="' + s + '" height="' + s + '" alt="Escala ' + scaleNum + '" loading="lazy" style="border-radius: 8px;">';
  }
  var SOLITARY_THRONE_CM_ACHIEVEMENTS = {
    9423: { name: 'T1', min: 'Scale 1+',  icon: '1228223' },
    9412: { name: 'T2', min: 'Scale 26+', icon: '1228224' },
    9373: { name: 'T3', min: 'Scale 51+', icon: '1228225' },
    9388: { name: 'T4', min: 'Scale 76+', icon: '1424206' }
  };

  var Fractals = {
    _cachedIcons: new Map(),
    _cmFetchId: 0,
    // La rotación diaria de fractales NO viene de la API (ver state.daily.fractals).
    // Antes esta función hardcodeaba 3 T4 + 3 escalas y loadTomorrow() hardcodeaba
    // otros 3, de modo que el panel siempre mostraba los MISMOS nombres todos los
    // días. Eso es información falsa: el jugador creía que eran los dailies reales.
    // Ahora no se pinta nada hasta que haya una fuente real de datos.
    loadToday: async function() {
      state.daily.fractals.status = 'ready';
      state.daily.fractals.rotationAvailable = false;
      state.daily.fractals.today = { t4: [], rec: [] };
      state.daily.fractals.tomorrow = { t4: [], rec: [] };
      renderFractals();
    },

    loadCMStatus: async function(token) {
      if (!token) {
        state.daily.fractals.cmAchievements = new Set();
        renderFractals();
        return;
      }
      state.daily.fractals._cmFetchId += 1;
      var fid = state.daily.fractals._cmFetchId;
      try {
        var ach = await root.GW2Api.getAccountAchievements(token);
        if (fid !== state.daily.fractals._cmFetchId) return;
        var done = new Set();
        if (Array.isArray(ach)) {
          ach.forEach(function(a) {
            if (a.done && SOLITARY_THRONE_CM_ACHIEVEMENTS.hasOwnProperty(a.id)) {
              done.add(a.id);
            }
          });
        }
        state.daily.fractals.cmAchievements = done;
      } catch (err) {
        if (fid !== state.daily.fractals._cmFetchId) return;
        console.warn(LOG, '[Fractals] CM status error:', err.message);
        state.daily.fractals.cmAchievements = new Set();
      }
      renderFractals();
    },
    loadTomorrow: async function() {
      // Sin fuente de datos para la rotación de mañana: no se inventa.
      state.daily.fractals.tomorrow = { t4: [], rec: [] };
      renderFractals();
    }
  };
  function renderFractals() {
    var host = $('#fractalsBody');
    if (!host) return;
    if (state.daily.fractals.status === 'loading') { host.innerHTML = '<p class="muted">Cargando fractales…</p>'; return; }
    if (state.daily.fractals.status === 'error') { host.innerHTML = '<p class="muted error">Error cargando fractales</p>'; return; }
    var t4 = state.daily.fractals.today.t4 || [];
    var rec = state.daily.fractals.today.rec || [];
    var html = '<div class="fractals-stack">';
    // La API GW2 no expone la rotación de fractales. Antes se hardcodeaban
    // nombres fijos y el panel los presentaba como "dailies de hoy", lo cual
    // era falso. Ahora mostramos un aviso explícito en su lugar.
    //
    // Estilos: la estructura va en main.css (capa 1) y la piel en
    // theme-polish.css (capa 2). El `borderLeft` lo aplica
    // fractal-tracker-theme.js (capa 3, color semántico) leyendo `data-fl-color`.
    // Este archivo ya no escribe `style=` inline en este bloque.
    // Ver COMM 019 / task-4a1841efc329.
    if (!state.daily.fractals.rotationAvailable) {
      html += '<div class="muted fractal-notice" data-fl-color="info">' +
              'ℹ️ <strong>Rotación diaria no disponible.</strong> La API de GW2 no expone qué fractales son los diarios ni las escalas recomendadas del día ' +
              '(<code>/v2/fractals</code> no existe y <code>/v2/achievements/daily</code> fue retirado). ' +
              'El tracker de Solitary Throne CM de abajo <strong>sí</strong> es real: refleja tus logros de la cuenta.' +
              '</div>';
    }
    if (t4.length) {
    html += '<div class="fractals-section"><h4 class="fractals-section__title"><span class="badge badge--success" style="background: var(--color-green-bg); border: none;">🌀 T4</span><span class="fractals-section__hint">Fractales diarios</span></h4><div class="fractals-grid">';
    t4.forEach(function(fractal) {
      var name = typeof fractal === 'string' ? fractal : fractal.name;
      var hasCM = fractal.cm === true;
      html += '<article class="card fractal-card" data-fl-color="' + (hasCM ? 'cm' : 't4') + '">' +
              '<div class="fractal-card__icon">' + getFractalIconHtml(name, 48) + '</div>' +
              '<div class="fractal-card__body"><div class="fractal-card__name" title="' + esc(name) + '">' + esc(name) + '</div>' +
              (hasCM ? '<div class="fractal-card__tag"><span class="badge badge--warning fractal-card__cm-badge">⚠️ CM</span></div>' : '') +
              '</div></article>';
    });
    html += '</div></div>';
    html += '<div class="fractals-section"><h4 class="fractals-section__title"><span class="badge badge--info" style="background: var(--color-blue-bg); border: none;">🎯 Recomendados</span><span class="fractals-section__hint">Escalas del día</span></h4><div class="fractals-grid">';
    rec.forEach(function(r) {
      var scaleNum = r.scale || parseInt(String(r.name || r).match(/\d+/)?.[0] || '0', 10);
      var scaleName = typeof r === 'string' ? r : (r.name || 'Scale ' + scaleNum);
      html += '<article class="card fractal-card" data-fl-color="info">' +
              '<div class="fractal-card__icon">' + getScaleIconHtml(scaleNum, 48) + '</div>' +
              '<div class="fractal-card__body"><div class="fractal-card__name fractal-card__name--wrap">' + esc(scaleName) + '</div>' +
              '<div class="fractal-card__tag"><span class="badge badge--info fractal-card__scale-badge">📊 Escala ' + scaleNum + '</span></div></div></article>';
    });
    html += '</div></div>';
    } // fin if (t4.length)
    html += '</div>';

    // --- Solitary Throne CM daily tracker ---
    var cmDone = state.daily.fractals.cmAchievements || new Set();
    var cmToken = state.token;
    html += '<div class="fractals-cm">';
    html += '<h4 class="fractals-cm__title"><span class="badge badge--warning" style="background: var(--color-amber-bg); border: none;">👑 Solitary Throne CM</span><span class="fractals-section__hint">Logros diarios</span></h4>';
    html += '<div class="fractals-cm__badges">';
    Object.keys(SOLITARY_THRONE_CM_ACHIEVEMENTS).forEach(function(achId) {
      var tier = SOLITARY_THRONE_CM_ACHIEVEMENTS[achId];
      var isDone = cmDone.has(+achId);
      var badgeClass = isDone ? 'badge--success' : 'badge--warning';
      var label = isDone ? '✅ ' + tier.name + ' hecho' : '⏳ ' + tier.name + ' pendiente';
      html += '<span class="badge ' + badgeClass + ' fractals-cm__badge">' + label + '</span>';
    });
    html += '</div>';
    if (!cmToken) {
      html += '<div class="muted fractals-cm__needs-key">🔑 Necesit\'s una API key para ver el progreso</div>';
    }
    html += '</div>';

    if (state.daily.fractals.tomorrow && state.daily.fractals.tomorrow.t4 && state.daily.fractals.tomorrow.t4.length) {
      var tomorrowNames = state.daily.fractals.tomorrow.t4.map(function(f) { return typeof f === 'string' ? f : f.name; });
      if (tomorrowNames.length && tomorrowNames[0]) {
        html += '<div class="muted fractals-tomorrow">' +
                '<span>📅</span> <span>Mañana: ' + esc(tomorrowNames.join(', ')) + '</span></div>';
      }
    }
    host.innerHTML = html;
  }

  // =======================================================================
  // 14. KPI DIARIO (sin cambios)
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
  // 15. INICIALIZACIÓN DEL PANEL (sin cambios, excepto la versión de versión)
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
            '<div class="tabs" style="display: flex; gap: 8px; align-items: center;">' +
              '<button id="actTabDaily" class="btn" role="tab" style="display: inline-flex; align-items: center; gap: 6px;"><img src="assets/icons/Welcome/222580.png" width="16" height="16" alt="" style="filter: brightness(0.9);"> Objetivos</button>' +
              '<button id="actTabWeekly" class="btn btn--ghost" role="tab" style="display: inline-flex; align-items: center; gap: 6px;"><img src="assets/icons/Welcome/3380755.png" width="16" height="16" alt="" style="filter: brightness(0.9);"> Home Nodes</button>' +
              '<button id="refreshActivitiesBtn" class="btn btn--ghost" style="margin-left: 8px; display: inline-flex; align-items: center; gap: 6px;" title="Recargar página"><img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="" style="filter: brightness(0.9);"> Refrescar</button>' +
            '</div>' +
          '</div>' +
          '<div id="activitiesClockBarPlaceholder"></div>' +
        '</div>' +
        '<div id="actDaily" class="tab-panel">' +
          '<section class="weekly-key-strip" id="weeklyKeyStrip" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-2); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;">' +
            '<div style="display: flex; align-items: center; gap: 12px;">' +
              '<div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">' +
                '<img src="assets/icons/Activities/19980.png" width="32" height="32" alt="Llave" id="weeklyKeyIcon">' +
              '</div>' +
              '<div>' +
                '<div style="font-weight: 700; font-size: 1rem;">Llave semanal del León Negro</div>' +
                '<div class="muted" style="font-size: 0.75rem;" id="weeklyKeyDescription">Detección automática por personajes Thief</div>' +
              '</div>' +
            '</div>' +
            '<div id="weeklyKeyStatus" style="min-width: 140px; text-align: right;">' +
              '<span class="badge badge--warning">⏳ Verificando...</span>' +
            '</div>' +
          '</section>' +
          '<section class="card">' +
            '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">' +
              '<img src="assets/icons/156272.png" width="28" height="28" alt="Piedra Arbórea" id="stoneWaypointBtn" style="cursor: pointer;" title="Copiar waypoint de Piedra Arbórea">' +
              '<h2 style="margin: 0;">Piedras de invocación Vetustas</h2>' +
            '</div>' +
            '<div class="row between">' +
              '<div style="display: flex; align-items: center; gap: 8px;">' +
                '<img src="assets/icons/Activities/96978.png" width="24" height="24" alt="Leivas" style="vertical-align: middle;">' +
                '<span class="pill s-pending" id="pillLeivas">Leivas: 0/5</span>' +
              '</div>' +
              '<div><button class="btn-ghost" id="assMinus">−</button><button class="btn-ghost" id="assPlus">+</button></div>' +
            '</div>' +
            '<div class="bar"><div class="bar-fill" id="barLeivas" style="width:0%"></div></div>' +
          '</section>' +
          '<section class="card psna" id="psnaPanel">' +
            '<div class="psna__head">' +
              '<img src="assets/icons/733330.png" width="32" height="32" alt="">' +
              '<div class="psna__titles"><h3 class="psna__title">Agente de red de suministros del Pacto</h3>' +
              '<p class="psna__sub">Seis agentes, uno por región. Hacé clic en un lugar para copiar su waypoint.</p></div>' +
              '<button id="psnaCopyAll" class="btn btn--xs">Copiar todos</button>' +
            '</div>' +
            '<div id="psnaStatus"></div>' +
            '<div id="psnaGrid" class="psna__grid"></div>' +
          '</section>' +
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
        '</div>' +
        '<div id="actWeekly" class="tab-panel" hidden>' +
          '<div id="homeNodesContainer" class="home-nodes-container">' +
            '<div class="muted" style="text-align: center; padding: 40px;">🏠 Haz clic en la pestaña Home Nodes para cargar</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    var anchor = $('#walletPanel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
    else document.body.appendChild(host);
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
    var refreshBtn = $('#refreshActivitiesBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { window.location.reload(); });
    var stoneWaypointBtn = $('#stoneWaypointBtn');
    if (stoneWaypointBtn) stoneWaypointBtn.addEventListener('click', function() {
      copyToClipboard('Punto de Ruta de Piedra Arbórea — [&BGMNAAA=]');
      if (window.toast) window.toast('success', 'Waypoint de Piedra Arbórea copiado');
    });
    $('#psnaCopyAll').addEventListener('click', function() {
      var list = state.daily.psna || [];
      var chats = [];
      for (var i = 0; i < list.length; i++) if (list[i].chat) chats.push(list[i].chat);
      if (chats.length) {
        copyToClipboard(chats.join(' '));
        if (window.toast) window.toast('success', chats.length + ' waypoints copiados');
      } else if (window.toast) window.toast('error', 'No hay waypoints disponibles');
    });
    var minusBtn = document.querySelector('#assMinus');
    var plusBtn = document.querySelector('#assPlus');
    if (minusBtn) {
      var newMinus = minusBtn.cloneNode(true);
      minusBtn.parentNode.replaceChild(newMinus, minusBtn);
      newMinus.addEventListener('click', function() { setStones(state.weekly.stones - 1); });
    }
    if (plusBtn) {
      var newPlus = plusBtn.cloneNode(true);
      plusBtn.parentNode.replaceChild(newPlus, plusBtn);
      newPlus.addEventListener('click', function() { setStones(state.weekly.stones + 1); });
    }
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
    var event = new CustomEvent('gn:render-home-nodes', { detail: { container: container } });
    document.dispatchEvent(event);
    if (window.ActivitiesTheme && typeof window.ActivitiesTheme.renderHomeNodes === 'function') {
      window.ActivitiesTheme.renderHomeNodes(container).then(function() {
        state.homeNodesRendered = true;
        console.log(LOG, '🏠 Home Nodes cargado vía ActivitiesTheme');
      }).catch(function(err) {
        console.warn(LOG, 'Error cargando Home Nodes', err);
        if (container && container.innerHTML.includes('Cargando')) container.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">❌ Error al cargar nodos de hogar. Recarga la página.</div>';
      });
    } else {
      console.warn(LOG, 'ActivitiesTheme.renderHomeNodes no disponible');
      setTimeout(function() {
        if (container && container.innerHTML.includes('Cargando')) {
          container.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">🏡 Los Home Nodes se cargarán automáticamente.<br><small>Si no ves el contenido, actualiza la página.</small></div>';
        }
        state.homeNodesRendered = true;
      }, 500);
    }
  }

  // =======================================================================
  // 16. CICLO DE VIDA (ACTUALIZADO)
  // =======================================================================
  async function activate() {
    console.log(LOG, '🚀 activate() llamado');
    // cleanActivitiesCache() SI se queda: borra prefijos 'psna:' y
    // ACTIVITIES_CACHE_KEYS, que son datos de ESTE modulo. Entrar al panel
    //Activities puede querer datos frescos de hoy.
    cleanActivitiesCache();
    // cleanAchievementsCache() NO se llama aqui, y antes si. Era un bug:
    // borra toda clave que empiece con 'ach_', y esa es justo la familia que
    // api-gw2.js putCache() escribe para logros (ach_acc:<fp>, TTL 2 min, y
    // ach_meta_v2:es:<ids>, TTL 12 h). Router llama a activate() en cada
    // navegacion a #/activities, asi que abrir el panel dejaba sin cache de
    // logros a TODAS las cuentas y la pagina de Logros arrancaba en frio
    // cada vez. Medido: la metadata sola son ~3.6 MB por id-set de cuenta
    // (35 chunks de 200 ids x 536 B reales).
    // La regla que se aplica: un modulo no borra la cache de otro. Limpiar la
    // cache es trabajo de una accion explicita del usuario, no de entrar a un
    // panel. La funcion sigue existiendo para cuando haga falta llamarla a
    // proposito.
    // Ver tests/idea49.activities-cache-wipe.test.js
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    state.homeNodesRendered = false;
    try {
      state.token = root.__GN__ && root.__GN__.getSelectedToken ? root.__GN__.getSelectedToken() : null;
      console.log(LOG, '🔑 token:', state.token ? 'disponible' : 'no disponible');
    } catch (e) { state.token = null; }
    loadToggles();
    await loadWeeklyForToken(state.token);
    await Assets.load();
    if (state.token) {
      const freshDetection = await detectWeeklyKeyFromCharacters(state.token);
      if (freshDetection !== state.weekly.key) {
        console.log(LOG, '[Weekly] Actualizando estado de llave por detección en vivo:', freshDetection);
        setWeeklyKey(freshDetection);
      }
    }
    renderWeekly();
    console.log(LOG, '📥 Cargando PSNA...');
    await PSNA.load(false);
    console.log(LOG, '📥 PSNA cargado');
    await Fractals.loadToday();
    Fractals.loadCMStatus(state.token);
    requestIdle(function() { Fractals.loadTomorrow(); });
    await Ecto.loadStatus(state.token);
    renderDailyKPI();
    console.log(LOG, '✅ activate() completado');
  }

  function deactivate() {
    state.active = false;
    if (state._psnaTimer) { clearTimeout(state._psnaTimer); state._psnaTimer = null; }
    if (state._psnaTick) { clearInterval(state._psnaTick); state._psnaTick = null; }
    var panel = $('#activitiesPanel');
    if (panel) panel.setAttribute('hidden', '');
    state.homeNodesRendered = false;
  }

  // =======================================================================
  // 17. PREFETCH (sin cambios)
  // =======================================================================
  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    await Assets.load();
    await PSNA.loadSchedule(false);
  }

  // =======================================================================
  // 18. EVENTOS GLOBALES (ACTUALIZADO)
  // =======================================================================
  function wireGlobal() {
    document.addEventListener('gn:global-refresh', function() {
      if (!state.active) return;
      PSNA.load(true);
      Fractals.loadToday();
      if (state.token) {
        Ecto.loadStatus(state.token);
        Fractals.loadCMStatus(state.token);
        detectWeeklyKeyFromCharacters(state.token).then(function(detected) {
          if (detected !== state.weekly.key) setWeeklyKey(detected);
        });
      }
      state.homeNodesRendered = false;
    });
    document.addEventListener('gn:tokenchange', async function(ev) {
      console.log(LOG, '[TokenChange] Token actualizado');
      var newToken = ev && ev.detail ? ev.detail.token : null;
      state.token = newToken;
      if (!state.active) return;
      if (newToken) {
        var weeklyKeyStatus = $('#weeklyKeyStatus');
        if (weeklyKeyStatus) weeklyKeyStatus.innerHTML = '<span class="badge badge--info">🔄 Verificando con nueva key...</span>';
        const detected = await detectWeeklyKeyFromCharacters(newToken);
        console.log(LOG, '[TokenChange] Detección con nueva key:', detected);
        setWeeklyKey(detected);
        // Recargar piedras desde storage para el nuevo token
        const stones = await loadStonesFromStorage(newToken);
        state.weekly.stones = stones;
        renderWeekly();
        await Ecto.loadStatus(newToken);
        Fractals.loadCMStatus(newToken);
      } else {
        setWeeklyKey(false);
        setStones(0);
        state.daily.ecto.done.clear();
        renderEcto();
        renderWeekly();
        Fractals.loadCMStatus(null);
      }
      renderDailyKPI();
    });
  }

  // =======================================================================
  // 19. EXPOSICIÓN DE API GLOBAL (sin cambios)
  // =======================================================================
  root.ActivitiesAPI = {
    getToken: function() { return state.token; },
    isActive: function() { return state.active; },
    onHomeNodesTabSelected: function(callback) { if (typeof callback === 'function') window.__homeNodesCallback = callback; },
    renderHomeNodes: function(container) { loadHomeNodesOnDemand(); return Promise.resolve(true); }
  };

  // =======================================================================
  // 20. API PÚBLICA (sin cambios)
  // =======================================================================
  var Activities = {
    initOnce: function() {
      if (state.inited) return;
      ensurePanel();
      wireGlobal();
      state.inited = true;
      console.info(LOG, 'ready v3.19.7 — Solitary Throne CM daily tracker');
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
        psnaData: state.daily.psnaData,
        token: state.token,
        active: state.active,
        weeklyKey: state.weekly.key,
        weeklyStones: state.weekly.stones,
        fractals: {
          status: state.daily.fractals.status,
          today: state.daily.fractals.today,
          cmAchievements: Array.from(state.daily.fractals.cmAchievements || new Set())
        }
      };
    },
    _renderPSNA: renderPSNA,
    _psnaPickDay: psnaPickDay,
    _psnaNextChange: psnaNextChange,
    _psnaDayText: psnaDayText,
    _forceReload: function() { PSNA.load(true); }
  };

  root.Activities = Activities;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Activities.initOnce);
  } else {
    Activities.initOnce();
  }

})(typeof window !== 'undefined' ? window : this);
