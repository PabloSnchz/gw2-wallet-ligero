/*!
 * js/strike-tracker.js — Seguimiento de Strike Missions
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.0 (2026-06-03)
 * 
 * Módulo que muestra el progreso semanal de Strike Missions (encuentros de incursión)
 * Organizados por expansión, con KPIs y modal de detalle.
 * 
 * Dependencias:
 *  - GW2Api.getAccountRaids() (mismo endpoint que raids)
 *  - Estilos heredados de raid-tracker.js
 */

(function (root) {
  'use strict';

  var LOG = '[StrikeTracker]';

  // ========================================================================
  // 1. DATOS ESTÁTICOS - LISTA COMPLETA DE STRIKES POR EXPANSIÓN
  // ========================================================================

  var STRIKES_BY_EXPANSION = [
    {
      id: "core",
      name: "Juego base",
      nameEn: "Core Game",
      expansion: "Core",
      icon: "assets/icons/expansions/core.png",
      strikes: [
        { id: "old_lions_court", name: "Vieja Corte del León", nameEn: "Old Lion's Court", li: 1, cm: true, icon: "assets/icons/raids/bosses/old_lions_court.png" }
      ]
    },
    {
      id: "icebrood",
      name: "Sangre y Hielo",
      nameEn: "Icebrood Saga",
      expansion: "Icebrood Saga",
      icon: "assets/icons/expansions/is ls5.png",
      strikes: [
        { id: "shiverpeaks_pass", name: "Paso de las Picosescalofriantes", nameEn: "Shiverpeaks Pass", li: 1, cm: false, icon: "assets/icons/raids/bosses/shiverpeaks_pass.png" },
        { id: "voice_claw", name: "Voz de los Caídos y Garra de los Caídos", nameEn: "Voice of the Fallen and Claw of the Fallen", li: 1, cm: false, icon: "assets/icons/raids/bosses/voice_claw.png" },
        { id: "fraenir", name: "Fraenir de Jormag", nameEn: "Fraenir of Jormag", li: 1, cm: false, icon: "assets/icons/raids/bosses/fraenir.png" },
        { id: "boneskinner", name: "Pelahuesos", nameEn: "Boneskinner", li: 1, cm: false, icon: "assets/icons/raids/bosses/boneskinner.png" },
        { id: "whisper_of_jormag", name: "Susurro de Jormag", nameEn: "Whisper of Jormag", li: 1, cm: false, icon: "assets/icons/raids/bosses/whisper_of_jormag.png" },
        { id: "forging_steel", name: "Forja de Acero", nameEn: "Forging Steel", li: 1, cm: false, icon: "assets/icons/raids/bosses/forging_steel.png" },
        { id: "cold_war", name: "Guerra fría", nameEn: "Cold War", li: 1, cm: false, icon: "assets/icons/raids/bosses/cold_war.png" }
      ]
    },
    {
      id: "eod",
      name: "End of Dragons",
      nameEn: "End of Dragons",
      expansion: "End of Dragons",
      icon: "assets/icons/expansions/EoD.webp",
      strikes: [
        { id: "aetherblade_hideout", name: "Escondite Filoetéreo", nameEn: "Aetherblade Hideout", li: 1, cm: true, icon: "assets/icons/raids/bosses/aetherblade_hideout.png" },
        { id: "xunlai_jade_junkyard", name: "Chatarrería de Xunlai Jade", nameEn: "Xunlai Jade Junkyard", li: 1, cm: true, icon: "assets/icons/raids/bosses/xunlai_jade_junkyard.png" },
        { id: "kaineng_overlook", name: "Mirador de Kaineng", nameEn: "Kaineng Overlook", li: 1, cm: true, icon: "assets/icons/raids/bosses/kaineng_overlook.png" },
        { id: "harvest_temple", name: "Templo de la Cosecha", nameEn: "Harvest Temple", li: 1, cm: true, icon: "assets/icons/raids/bosses/harvest_temple.png" }
      ]
    },
    {
      id: "soto",
      name: "Secrets of the Obscure",
      nameEn: "Secrets of the Obscure",
      expansion: "Secrets of the Obscure",
      icon: "assets/icons/expansions/SoTO.webp",
      strikes: [
        { id: "cosmic_observatory", name: "Observatorio Cósmico", nameEn: "Cosmic Observatory", li: 1, cm: true, icon: "assets/icons/raids/bosses/cosmic_observatory.png" },
        { id: "temple_of_febe", name: "Templo de Febe", nameEn: "Temple of Febe", li: 1, cm: true, lm: true, icon: "assets/icons/raids/bosses/temple_of_febe.png" }
      ]
    },
    {
      id: "janthir",
      name: "Janthir Wilds",
      nameEn: "Janthir Wilds",
      expansion: "Janthir Wilds",
      icon: "assets/icons/expansions/JW.webp",
      strikes: [
        { id: "mount_balrior", name: "Monte Balrior", nameEn: "Mount Balrior", li: 0, cm: true, note: "Ya está en Raids como ala completa", icon: "assets/icons/raids/bosses/mount_balrior.png" }
      ]
    },
    {
      id: "voe",
      name: "Visions of Eternity",
      nameEn: "Visions of Eternity",
      expansion: "Visions of Eternity",
      icon: "assets/icons/expansions/VoE.webp",
      strikes: [
        { id: "guardians_glade", name: "Claro del Guardián", nameEn: "Guardian's Glade", li: 1, cm: true, icon: "assets/icons/raids/bosses/guardians_glade.png" }
      ]
    }
  ];

  // ========================================================================
  // 2. DATOS DE MECÁNICAS Y ESTRATEGIAS (VERSIÓN COMPLETA)
  // ========================================================================

  var STRIKE_DETAILS = {
    "old_lions_court": {
      description: [
        "• La Vieja Corte del León es un encuentro contra el Triunvirato de Caballeras mecánicas.",
        "• Tres prototipos: Bermellón (fuego), Arsenito (veneno), Índigo (electricidad).",
        "• Cada prototipo tiene mecánicas únicas y deben ser manejados por separado.",
        "• Hay que coordinar la muerte de los tres al mismo tiempo."
      ],
      strategy: [
        "• Dividir el escuadrón en 3 grupos, uno por cada prototipo.",
        "• Mantener el daño equilibrado entre los tres.",
        "• Los prototipos se fortalecen cuando uno muere.",
        "• CRÍTICO: Coordinar para que mueran juntos."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Old_Lion%27s_Court",
      image: "assets/icons/raids/bosses/old_lions_court_detail.png"
    },
    "shiverpeaks_pass": {
      description: [
        "• El Paso de las Picosescalofriantes es un encuentro contra un gigante de hielo.",
        "• El jefe tiene ataques de área que congelan.",
        "• Invoca añs que deben ser eliminados."
      ],
      strategy: [
        "• Mantenerse en movimiento para evitar ser congelado.",
        "• Eliminar los añs rápidamente.",
        "• Romper la barra de ruptura cuando aparezca."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Shiverpeaks_Pass",
      image: "assets/icons/raids/bosses/shiverpeaks_pass_detail.png"
    },
    "voice_claw": {
      description: [
        "• Encuentro contra dos jefes: La Voz y la Garra.",
        "• La Voz ataca a distancia, la Garra en cuerpo a cuerpo.",
        "• Si uno muere, el otro se enfurece."
      ],
      strategy: [
        "• Mantener a los dos jefes separados.",
        "• Reducir la vida de ambos de manera equilibrada.",
        "• Matarlos al mismo tiempo."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Voice_and_Claw",
      image: "assets/icons/raids/bosses/voice_claw_detail.png"
    },
    "fraenir": {
      description: [
        "• Fraenir de Jormag invoca un constructo de hielo.",
        "• El jefe tiene ataques de área que dañan mucho.",
        "• Hay que romper su barra de ruptura para evitar un wipe."
      ],
      strategy: [
        "• Mantener al jefe centrado.",
        "• Guardar habilidades de ruptura para la barra.",
        "• Curar a los jugadores dañados por el área."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Fraenir_of_Jormag",
      image: "assets/icons/raids/bosses/fraenir_detail.png"
    },
    "boneskinner": {
      description: [
        "• Pelahuesos es un jefe que aplica condiciones masivas.",
        "• Invoca tentáculos que deben ser destruidos.",
        "• Tiene un ataque de área que causa daño masivo."
      ],
      strategy: [
        "• Llevar limpieza de condiciones.",
        "• Destruir tentáculos rápidamente.",
        "• Moverse fuera del área de daño."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Boneskinner",
      image: "assets/icons/raids/bosses/boneskinner_detail.png"
    },
    "whisper_of_jormag": {
      description: [
        "• Susurro de Jormag es un encuentro con fases de ataque y defensa.",
        "• En la fase de ataque, hay que hacer daño al jefe.",
        "• En la fase de defensa, hay que proteger un orbe."
      ],
      strategy: [
        "• Alternar entre ataque y defensa según la fase.",
        "• Proteger el orbe en la fase defensiva.",
        "• Usar todas las habilidades en la fase ofensiva."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Whisper_of_Jormag",
      image: "assets/icons/raids/bosses/whisper_of_jormag_detail.png"
    },
    "forging_steel": {
      description: [
        "• Forja de Acero es un encuentro de escolta y jefe final.",
        "• Hay que proteger un vehículo mientras avanza.",
        "• El jefe final tiene mecánicas de área."
      ],
      strategy: [
        "• Proteger el vehículo de los enemigos.",
        "• Curar el vehículo si es posible.",
        "• En el jefe final, evitar las áreas de daño."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Forging_Steel",
      image: "assets/icons/raids/bosses/forging_steel_detail.png"
    },
    "cold_war": {
      description: [
        "• Guerra Fría es un encuentro contra la Ministra de Moral.",
        "• La ministra tiene ataques a distancia y área.",
        "• Invoca enemigos adicionales durante la pelea."
      ],
      strategy: [
        "• Mantener a la ministra alejada del grupo.",
        "• Eliminar a los enemigos adicionales rápidamente.",
        "• Evitar los ataques de área."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Cold_War",
      image: "assets/icons/raids/bosses/cold_war_detail.png"
    },
    "aetherblade_hideout": {
      description: [
        "• Escondite Filoetéreo es un encuentro contra Mai Trin y el Eco de Scarlet Briar.",
        "• Mai Trin tiene ataques de pistola y área de electricidad.",
        "• El Eco de Scarlet aparece en la segunda fase."
      ],
      strategy: [
        "• En la primera fase, evitar las áreas de electricidad.",
        "• Romper la barra de ruptura de Mai Trin.",
        "• En la segunda fase, priorizar al Eco de Scarlet."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Aetherblade_Hideout",
      image: "assets/icons/raids/bosses/aetherblade_hideout_detail.png"
    },
    "xunlai_jade_junkyard": {
      description: [
        "• Chatarrería de Xunlai Jade es un encuentro contra Ankka.",
        "• Ankka tiene mecánicas de clones y teletransportación.",
        "• También invoca áreas de corrupción."
      ],
      strategy: [
        "• Identificar al clon real de Ankka.",
        "• Evitar las áreas de corrupción.",
        "• Romper la barra de ruptura cuando aparezca."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Xunlai_Jade_Junkyard",
      image: "assets/icons/raids/bosses/xunlai_jade_junkyard_detail.png"
    },
    "kaineng_overlook": {
      description: [
        "• Mirador de Kaineng es un encuentro contra el Ministro Li.",
        "• El Ministro Li tiene múltiples fases con diferentes mecánicas.",
        "• Invoca ayudantes que deben ser eliminados."
      ],
      strategy: [
        "• En cada fase, priorizar a los ayudantes.",
        "• Romper la barra de ruptura del Ministro Li.",
        "• Evitar los ataques de área del jefe."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Kaineng_Overlook",
      image: "assets/icons/raids/bosses/kaineng_overlook_detail.png"
    },
    "harvest_temple": {
      description: [
        "• Templo de la Cosecha es el encuentro final de End of Dragons.",
        "• El Vacío Dracónico es el jefe, con múltiples fases.",
        "• Hay que sobrevivir a ataques masivos en área."
      ],
      strategy: [
        "• Superar las fases de la historia antes del jefe.",
        "• En el jefe final, coordinación y movimiento constante.",
        "• Romper la barra de ruptura en cada fase."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Harvest_Temple",
      image: "assets/icons/raids/bosses/harvest_temple_detail.png"
    },
    "cosmic_observatory": {
      description: [
        "• Observatorio Cósmico es un encuentro contra Dagda.",
        "• Dagda tiene mecánicas de invocación de estrellas.",
        "• También tiene ataques de área que deben ser evitados."
      ],
      strategy: [
        "• Recoger las estrellas para evitar daño masivo.",
        "• Evitar los ataques de área.",
        "• Romper la barra de ruptura cuando aparezca."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Cosmic_Observatory",
      image: "assets/icons/raids/bosses/cosmic_observatory_detail.png"
    },
    "temple_of_febe": {
      description: [
        "• Templo de Febe es un encuentro contra Cerus.",
        "• Cerus tiene un modo legendario además del modo desafío.",
        "• Es uno de los encuentros más difíciles del juego."
      ],
      strategy: [
        "• Aprender las mecánicas en modo normal primero.",
        "• Coordinación perfecta del escuadrón.",
        "• Las habilidades de apoyo son cruciales."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Temple_of_Febe",
      image: "assets/icons/raids/bosses/temple_of_febe_detail.png"
    },
    "guardians_glade": {
      description: [
        "• Claro del Guardián es un encuentro contra Kela, Senescal de las Olas.",
        "• Kela tiene mecánicas de agua y ondas.",
        "• Hay que gestionar las mareas durante el encuentro."
      ],
      strategy: [
        "• Evitar las ondas de agua.",
        "• Romper la barra de ruptura para detener la marea.",
        "• Moverse constantemente para evitar daño."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Guardian%27s_Glade",
      image: "assets/icons/raids/bosses/guardians_glade_detail.png"
    }
  };
  
  // ========================================================================
  // 2.5. RECOMPENSAS ESPECIALES POR STRIKE
  // ========================================================================

  var STRIKE_REWARDS = {
    "old_lions_court": {
      specialDrops: [
        { name: "Mini Triunvirato de Caballeras mecánicas", type: "Miniatura", icon: "assets/icons/raids/rewards/assault_knight_mini.png" }
      ]
    },
    "aetherblade_hideout": {
      specialDrops: [
        { name: "Mini Mai Trin", type: "Miniatura", icon: "assets/icons/raids/rewards/mai_trin_mini.png" },
        { name: "Mini Scarlet Briar", type: "Miniatura", icon: "assets/icons/raids/rewards/scarlet_mini.png" }
      ]
    },
    "xunlai_jade_junkyard": {
      specialDrops: [
        { name: "Mini Ankka", type: "Miniatura", icon: "assets/icons/raids/rewards/ankka_mini.png" }
      ]
    },
    "kaineng_overlook": {
      specialDrops: [
        { name: "Mini Ministro Li", type: "Miniatura", icon: "assets/icons/raids/rewards/li_mini.png" }
      ]
    },
    "harvest_temple": {
      specialDrops: [
        { name: "Mini Vacío Dracónico", type: "Miniatura", icon: "assets/icons/raids/rewards/dragonvoid_mini.png" }
      ]
    },
    "cosmic_observatory": {
      specialDrops: [
        { name: "Mini Dagda", type: "Miniatura", icon: "assets/icons/raids/rewards/dagda_mini.png" }
      ]
    },
    "temple_of_febe": {
      specialDrops: [
        { name: "Mini Cerus", type: "Miniatura", icon: "assets/icons/raids/rewards/cerus_mini.png" },
        { name: "Infusión de Cerus", type: "Infusión cosmética", icon: "assets/icons/raids/rewards/cerus_infusion.png" }
      ]
    },
    "guardians_glade": {
      specialDrops: [
        { name: "Mini Kela", type: "Miniatura", icon: "assets/icons/raids/rewards/kela_mini.png" }
      ]
    }
  };

  // ========================================================================
  // 3. ESTADO GLOBAL
  // ========================================================================

  var state = {
    inited: false,
    active: false,
    token: null,
    completedStrikes: [],
    loading: false,
    error: null,
    utcTimeInterval: null,
    localTimeInterval: null,
    resetInterval: null
  };

  var _refreshInFlight = null;
  var _refreshSeq = 0;

  // ========================================================================
  // 4. UTILIDADES
  // ========================================================================

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function(m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  function getSelectedToken() {
    try {
      var sel = document.getElementById('keySelectGlobal');
      if (sel && sel.value) return sel.value.trim();
      var stored = localStorage.getItem('gw2_selected_key_v1');
      if (stored) return stored;
    } catch (e) {}
    return null;
  }

  function formatTimeUnit(value) {
    return String(Math.floor(value)).padStart(2, '0');
  }

  function formatCountdown(ms) {
    if (!isFinite(ms) || ms <= 0) return '—';
    var seconds = Math.floor(ms / 1000);
    var days = Math.floor(seconds / 86400);
    seconds %= 86400;
    var hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    var minutes = Math.floor(seconds / 60);
    seconds %= 60;
    
    var parts = [];
    if (days > 0) parts.push(days + 'd');
    parts.push(formatTimeUnit(hours) + 'h');
    parts.push(formatTimeUnit(minutes) + 'm');
    parts.push(formatTimeUnit(seconds) + 's');
    return parts.join(' ');
  }

  function getNextWeeklyResetUTC() {
    var now = new Date();
    var day = now.getUTCDay();
    var daysUntilMonday = (1 - day + 7) % 7;
    if (daysUntilMonday === 0 && (now.getUTCHours() < 7 || (now.getUTCHours() === 7 && now.getUTCMinutes() < 30))) {
      daysUntilMonday = 7;
    }
    var nextReset = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilMonday,
      7, 30, 0, 0
    ));
    return nextReset;
  }

  function nextDailyResetUTC() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = now.getUTCMonth();
    var d = now.getUTCDate();
    var next = new Date(Date.UTC(y, m, d, 24, 0, 0, 0));
    if (next.getTime() <= now.getTime()) {
      next = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    }
    return next;
  }

  function createSafeIcon(src, alt, width, height, fallbackEmoji) {
    if (!src || src === '') {
      return '<span style="font-size: ' + (width || 24) + 'px;">' + (fallbackEmoji || '⚔️') + '</span>';
    }
    var imgHtml = '<img src="' + esc(src) + '" alt="' + esc(alt) + '" width="' + (width || 28) + '" height="' + (height || 28) + '" loading="lazy" style="border-radius: 8px;" onerror="this.style.display=\'none\'; this.insertAdjacentHTML(\'afterend\', \'<span style=\\\'font-size:' + (width || 24) + 'px;\\\'>' + (fallbackEmoji || '⚔️') + '</span>\');">';
    return imgHtml;
  }

  function updateUtcTime() {
    var utcEl = document.getElementById('strikeUtcTime');
    if (utcEl) {
      var now = new Date();
      utcEl.textContent = now.toUTCString().split(' ')[4];
    }
  }

  function updateLocalTime() {
    var localEl = document.getElementById('strikeLocalTime');
    if (localEl) {
      var now = new Date();
      localEl.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  function updateResetCounters() {
    var dailyEl = document.getElementById('strikeDailyReset');
    var weeklyEl = document.getElementById('strikeWeeklyReset');
    if (dailyEl) {
      var nextDaily = nextDailyResetUTC();
      var msDaily = Math.max(0, nextDaily.getTime() - Date.now());
      dailyEl.textContent = formatCountdown(msDaily);
    }
    if (weeklyEl) {
      var nextWeekly = getNextWeeklyResetUTC();
      var msWeekly = Math.max(0, nextWeekly.getTime() - Date.now());
      weeklyEl.textContent = formatCountdown(msWeekly);
    }
  }

  function updateStrikeLiDisplay(liValue) {
    var liAvailableEl = document.getElementById('strikeLiAvailable');
    if (liAvailableEl) {
      liAvailableEl.textContent = (liValue !== undefined ? liValue : state.liAvailable).toLocaleString();
    }
  }

  // Sincronizar LI desde RaidTracker (usar el mismo valor)
  function syncLiFromRaidTracker() {
    if (window.RaidTracker && window.RaidTracker._debug) {
      var debug = window.RaidTracker._debug();
      if (debug && debug.liAvailable !== undefined) {
        state.liAvailable = debug.liAvailable;
        updateStrikeLiDisplay(state.liAvailable);
      }
    }
  }

  function startTimers() {
    if (state.utcTimeInterval) clearInterval(state.utcTimeInterval);
    if (state.localTimeInterval) clearInterval(state.localTimeInterval);
    if (state.resetInterval) clearInterval(state.resetInterval);
    updateUtcTime();
    updateLocalTime();
    updateResetCounters();
    syncLiFromRaidTracker();
    state.utcTimeInterval = setInterval(updateUtcTime, 1000);
    state.localTimeInterval = setInterval(updateLocalTime, 1000);
    state.resetInterval = setInterval(updateResetCounters, 1000);
  }

  function stopTimers() {
    if (state.utcTimeInterval) { clearInterval(state.utcTimeInterval); state.utcTimeInterval = null; }
    if (state.localTimeInterval) { clearInterval(state.localTimeInterval); state.localTimeInterval = null; }
    if (state.resetInterval) { clearInterval(state.resetInterval); state.resetInterval = null; }
  }

  function ensurePanelContent() {
    var panel = document.getElementById('strikeTrackerPanel');
    if (!panel) return false;
    var body = panel.querySelector('.panel__body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'panel__body';
      panel.appendChild(body);
    }
    if (!body.querySelector('#strikeUtcTime')) {
      body.innerHTML = `
        <!-- Badge LI eliminado (ahora está en el título del panel en index.html) -->
        
        <!-- FILA 2: Botones Raids/Strikes a la izquierda, Timer a la derecha -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="display: flex; gap: 8px;">
            <button id="strikeViewRaidsBtn" class="btn btn--ghost" style="padding: 6px 20px; font-size: 0.85rem;">Raids</button>
            <button id="strikeViewStrikesBtn" class="btn btn--accent" style="padding: 6px 20px; font-size: 0.85rem;">Strikes</button>
          </div>
          <div class="meta-clock-bar chips" style="display: inline-flex; gap: 16px; align-items: center; background: #0f1116; padding: 4px 12px; border-radius: 40px; border: 1px solid #2a2c35;">
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Hora del servidor (UTC+0)">
              <img src="assets/icons/460028.png" width="20" height="20" alt="UTC" style="filter: brightness(0.9);">
              <span>UTC</span>
              <strong id="strikeUtcTime">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Tu hora local">
              <img src="assets/icons/841720.png" width="20" height="20" alt="Local" style="filter: brightness(0.9);">
              <span>Local</span>
              <strong id="strikeLocalTime">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset diario a las 00:00 UTC">
              <img src="assets/icons/534745.png" width="20" height="20" alt="Reset diario" style="filter: brightness(0.9);">
              <span>Reset diario</span>
              <strong id="strikeDailyReset">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset semanal los lunes a las 07:30 UTC">
              <img src="assets/icons/155064.png" width="20" height="20" alt="Reset semanal" style="filter: brightness(0.9);">
              <span>Reset semanal</span>
              <strong id="strikeWeeklyReset">—</strong>
            </div>
          </div>
        </div>
        
        <div id="strikeKPIs" class="raid-kpis"></div>
        <div id="strikesGrid" class="raid-wings-grid"></div>
      `;
      console.log(LOG, 'Estructura del panel creada');
    }
    return true;
  }

  function renderKPIs(completedCount, totalCount, liEarned, liTotal) {
    var kpiContainer = document.getElementById('strikeKPIs');
    if (!kpiContainer) return;
    var percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    var liPercentage = liTotal > 0 ? Math.round((liEarned / liTotal) * 100) : 0;
    
    kpiContainer.innerHTML = `
      <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
        <!-- KPI 1: Strikes completadas -->
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #a0ffc8; flex: 1;">
          <div style="color: #a0a6b3; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span>⚔️ Strikes completadas</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: #a0ffc8;">${completedCount} / ${totalCount}</div>
          <div style="font-size: 10px; color: #6a7080; margin-top: 4px;">Encuentros de incursión</div>
        </div>
        
        <!-- KPI 2: LI farmeables (strikes que dan LI) -->
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #ffd36b; flex: 1;">
          <div style="color: #a0a6b3; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <img src="https://render.guildwars2.com/file/6D33B7387BAF2E2CC9B5D37D1D1B01246AB6FA22/1302744.png" width="14" height="14" alt="LI" style="filter: brightness(0.9);">
            <span>Conocimiento legendario</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: #ffd36b;">${liEarned} / ${liTotal}</div>
          <div style="font-size: 10px; color: #6a7080; margin-top: 4px;">Farmeados esta semana</div>
        </div>
        
        <!-- KPI 3: Progreso semanal (barra) -->
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #7bc2ff; flex: 1;">
          <div style="color: #a0a6b3; font-size: 12px;">📊 Progreso semanal</div>
          <div style="font-size: 28px; font-weight: 800; color: #7bc2ff;">${percentage}%</div>
          <div style="margin-top: 8px; height: 4px; background: #2a2c35; border-radius: 2px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #7bc2ff, #a0ffc8);"></div>
          </div>
          <div style="font-size: 10px; color: #6a7080; margin-top: 4px;">${liPercentage}% de LI completados</div>
        </div>
      </div>
    `;
  }

  function getTypeIcon(hasCM, hasLM) {
    if (hasLM) return '🏆';
    if (hasCM) return '⚔️';
    return '📋';
  }

  function getTypeLabel(hasCM, hasLM) {
    if (hasLM) return 'LEGENDARIO';
    if (hasCM) return 'DESAFÍO';
    return 'NORMAL';
  }

  function getTypeColor(hasCM, hasLM) {
    if (hasLM) return '#974EFF';
    if (hasCM) return '#ffd36b';
    return '#7bc2ff';
  }

  function renderStrikesGrid(completedEncounters) {
    var gridContainer = document.getElementById('strikesGrid');
    if (!gridContainer) return;

    var completedSet = new Set(completedEncounters);
    var totalStrikes = 0;
    var completedCount = 0;

    // Contar total de strikes (excluyendo Mount Balrior que es raid)
    for (var exp = 0; exp < STRIKES_BY_EXPANSION.length; exp++) {
      for (var s = 0; s < STRIKES_BY_EXPANSION[exp].strikes.length; s++) {
        var strike = STRIKES_BY_EXPANSION[exp].strikes[s];
        if (strike.id !== 'mount_balrior') {
          totalStrikes++;
        }
      }
    }

    // Grid de 3 columnas fijas
    var html = '<div style="display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 20px; align-items: start;">';
    
    // Inicializar contenido de columnas
    var col1 = '';
    var col2 = '';
    var col3 = '';

    // Función auxiliar para generar HTML de una expansión
    function generateExpansionHtml(expansion, strikes, completedSet, expCompleted, expTotal) {
      var expProgressPercent = (expCompleted / expTotal) * 100;
      
      var expClass = '';
      if (expansion.expansion === 'Core') expClass = 'raid-expansion--core';
      else if (expansion.expansion === 'Icebrood Saga') expClass = 'raid-expansion--core';
      else if (expansion.expansion === 'End of Dragons') expClass = 'raid-expansion--pof';
      else if (expansion.expansion === 'Secrets of the Obscure') expClass = 'raid-expansion--soto';
      else if (expansion.expansion === 'Janthir Wilds') expClass = 'raid-expansion--janthir';
      else if (expansion.expansion === 'Visions of Eternity') expClass = 'raid-expansion--pof';
      else expClass = 'raid-expansion--core';
      
      var expHtml = `
        <div class="raid-wing-card" style="background: linear-gradient(180deg, #0f1116 0%, #0d0f14 100%); border: 1px solid #26262b; border-radius: 16px; overflow: hidden; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0c0e14; border-bottom: 1px solid #26262b;">
            <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(expansion.icon, expansion.name, 28, 28, '📦')}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="font-weight: 700; font-size: 1rem;">${esc(expansion.name)}</div>
                <span class="raid-expansion-badge ${expClass}">${esc(expansion.expansion)}</span>
              </div>
              <div class="raid-wing-progress" style="margin-top: 8px; height: 3px; background: #2a2c35; border-radius: 2px; overflow: hidden;">
                <div class="raid-wing-progress__fill" style="width: ${expProgressPercent}%; height: 100%; background: linear-gradient(90deg, #7bc2ff, #a0ffc8); border-radius: 2px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>
          <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
      `;
      
      for (var s = 0; s < strikes.length; s++) {
        var strike = strikes[s];
        var isCompleted = completedSet.has(strike.id);
        if (isCompleted) completedCount++;
        
        var typeIcon = getTypeIcon(strike.cm, strike.lm);
        var typeLabel = getTypeLabel(strike.cm, strike.lm);
        var typeColor = getTypeColor(strike.cm, strike.lm);
        var completedClass = isCompleted ? 'raid-encounter-card--completed' : '';
        var typeClass = strike.cm ? 'raid-encounter-card--jefe' : 'raid-encounter-card--evento';

        expHtml += `
          <div class="raid-encounter-card ${completedClass} ${typeClass}" data-strike-id="${esc(strike.id)}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #0a0c10; border-radius: 12px; border: 1px solid ${isCompleted ? '#2a6a4a' : '#26262b'}; transition: all 0.2s ease;">
            <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(strike.icon, strike.name, 36, 36, typeIcon)}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 0.65rem; color: ${typeColor}; background: #1a1c24; padding: 2px 6px; border-radius: 12px;">${typeLabel}</span>
                <div class="raid-encounter-name" style="font-weight: 600; font-size: 0.85rem; ${isCompleted ? 'text-decoration: line-through; text-decoration-color: #a0ffc8;' : ''}">${esc(strike.name)}</div>
              </div>
              <div style="font-size: 0.65rem; color: ${isCompleted ? '#a0ffc8' : '#ff9d9d'}; display: flex; align-items: center; gap: 4px;">
                <img src="assets/icons/Welcome/${isCompleted ? '156108' : '156107'}.png" width="12" height="12" alt="" style="vertical-align: middle;">
                ${isCompleted ? 'Completada' : 'Pendiente'}
              </div>
            </div>
            <button class="strike-detail-btn btn btn--ghost" data-strike-id="${esc(strike.id)}" data-strike-name="${esc(strike.name)}" style="padding: 4px 12px; font-size: 0.7rem;">Detalle</button>
          </div>
        `;
      }
      
      expHtml += `
          </div>
        </div>
      `;
      
      return expHtml;
    }

    // Procesar cada expansión y distribuir en columnas
    for (var exp = 0; exp < STRIKES_BY_EXPANSION.length; exp++) {
      var expansion = STRIKES_BY_EXPANSION[exp];
      
      // Filtrar strikes (excluir Mount Balrior que ya está en raids)
      var strikes = expansion.strikes.filter(function(s) { return s.id !== 'mount_balrior'; });
      if (strikes.length === 0) continue;
      
      // Calcular progreso de la expansión
      var expTotal = strikes.length;
      var expCompleted = 0;
      for (var s = 0; s < strikes.length; s++) {
        if (completedSet.has(strikes[s].id)) expCompleted++;
      }
      
      var expansionHtml = generateExpansionHtml(expansion, strikes, completedSet, expCompleted, expTotal);
      
      // Distribuir por columnas según la expansión
      if (expansion.id === 'core') {
        col1 = expansionHtml + col1; // Juego base arriba en col1
      } else if (expansion.id === 'eod') {
        col1 += expansionHtml; // End of Dragons debajo de Juego base
      } else if (expansion.id === 'icebrood') {
        col2 = expansionHtml; // Sangre y Hielo ocupa toda la columna 2
      } else if (expansion.id === 'soto') {
        col3 = expansionHtml + col3; // Secrets of the Obscure arriba en col3
      } else if (expansion.id === 'voe') {
        col3 += expansionHtml; // Visions of Eternity debajo de Secrets
      } else if (expansion.id === 'janthir') {
        // Janthir no se muestra (es raid completa)
      }
    }
    
    // Ensamblar las 3 columnas
    html += '<div style="display: flex; flex-direction: column; gap: 20px;">' + col1 + '</div>';
    html += '<div style="display: flex; flex-direction: column; gap: 20px;">' + col2 + '</div>';
    html += '<div style="display: flex; flex-direction: column; gap: 20px;">' + col3 + '</div>';
    html += '</div>';
    
    gridContainer.innerHTML = html;

    // Calcular LI farmeables (strikes que dan LI, total 15)
    var liTotal = 0;
    var liEarned = 0;
    for (var exp2 = 0; exp2 < STRIKES_BY_EXPANSION.length; exp2++) {
      for (var s2 = 0; s2 < STRIKES_BY_EXPANSION[exp2].strikes.length; s2++) {
        var strike = STRIKES_BY_EXPANSION[exp2].strikes[s2];
        if (strike.id !== 'mount_balrior' && strike.li === 1) {
          liTotal++;
          if (completedSet.has(strike.id)) liEarned++;
        }
      }
    }
    renderKPIs(completedCount, totalStrikes, liEarned, liTotal);

    var detailBtns = gridContainer.querySelectorAll('.strike-detail-btn');
    for (var i = 0; i < detailBtns.length; i++) {
      var btn = detailBtns[i];
      if (btn.__wired) continue;
      btn.__wired = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var strikeId = this.getAttribute('data-strike-id');
        var strikeName = this.getAttribute('data-strike-name');
        openStrikeModal(strikeId, strikeName);
      });
    }
  }

  var modal = null;

  function ensureModal() {
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'strikeModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('hidden', '');
    modal.innerHTML = `
      <div class="modal__backdrop" data-close="1"></div>
      <div class="modal__dialog" style="max-width: 650px;">
        <header class="modal__header">
          <h3 id="strikeModalTitle">Detalle del encuentro</h3>
          <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>
        </header>
        <div class="raid-modal-tabs">
          <button class="raid-modal-tab" data-tab="desc">
            <img src="assets/icons/Welcome/222580.png" width="18" height="18" alt="Descripción" style="vertical-align: middle; margin-right: 6px;">
            Descripción
          </button>
          <button class="raid-modal-tab" data-tab="strat">
            <img src="assets/icons/Cuentas/240679.png" width="18" height="18" alt="Estrategia" style="vertical-align: middle; margin-right: 6px;">
            Estrategia
          </button>
          <button class="raid-modal-tab" data-tab="rewards">
            <img src="assets/icons/Cuentas/102438.png" width="18" height="18" alt="Recompensas" style="vertical-align: middle; margin-right: 6px;">
            Recompensas
          </button>
          <button class="raid-modal-tab" data-tab="links">
            <img src="assets/icons/raids/bosses/2604930.png" width="18" height="18" alt="Enlaces" style="vertical-align: middle; margin-right: 6px;">
            Enlaces
          </button>
        </div>
        <div class="modal__body" id="strikeModalBody" style="max-height: 60vh; overflow-y: auto; scroll-behavior: smooth;">
          <div class="raid-modal-loading">Cargando...</div>
        </div>
      </div>
    `;

    modal.addEventListener('click', function(e) {
      if (e.target.getAttribute('data-close') === '1') {
        closeModal();
      }
    });

    document.addEventListener('keydown', function onEscape(e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
        closeModal();
        document.removeEventListener('keydown', onEscape);
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function renderRewardsList(encounterId) {
    var liCount = 1; // Cada strike da 1 LI (excepto Mount Balrior que no se muestra)
    
    // Buscar si esta strike da LI
    for (var exp = 0; exp < STRIKES_BY_EXPANSION.length; exp++) {
      for (var s = 0; s < STRIKES_BY_EXPANSION[exp].strikes.length; s++) {
        var strike = STRIKES_BY_EXPANSION[exp].strikes[s];
        if (strike.id === encounterId) {
          liCount = strike.li || 0;
          break;
        }
      }
      if (liCount > 0) break;
    }

    var html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">';

    // LI
    html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">';
    html += '<img src="https://render.guildwars2.com/file/6D33B7387BAF2E2CC9B5D37D1D1B01246AB6FA22/1302744.png" width="32" height="32" alt="LI" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E🔮%3C/text%3E%3C/svg%3E\'">';
    html += '<div><div style="font-size: 0.7rem; color: #9aa2b8;">Conocimiento legendario</div>';
    html += '<div style="font-weight: 700; color: #ffd36b;">+' + liCount + '</div></div></div>';

    // Oro
    html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">';
    html += '<img src="https://render.guildwars2.com/file/98457F504BA2FAC8457F532C4B30EDC23929ACF9/619316.png" width="32" height="32" alt="Oro" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E💰%3C/text%3E%3C/svg%3E\'">';
    html += '<div><div style="font-size: 0.7rem; color: #9aa2b8;">Oro</div>';
    html += '<div style="font-weight: 700; color: #ffd36b;">+2~4</div></div></div>';

    // Experiencia
    html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">';
    html += '<img src="assets/icons/raids/experience.png" width="32" height="32" alt="Experiencia" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E⭐%3C/text%3E%3C/svg%3E\'">';
    html += '<div><div style="font-size: 0.7rem; color: #9aa2b8;">Experiencia</div>';
    html += '<div style="font-weight: 700; color: #a0ffc8;">+200,025</div></div></div>';

    // Karma
    html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">';
    html += '<img src="https://render.guildwars2.com/file/94953FA23D3E0D23559624015DFEA4CFAA07F0E5/155026.png" width="32" height="32" alt="Karma" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E☯%3C/text%3E%3C/svg%3E\'">';
    html += '<div><div style="font-size: 0.7rem; color: #9aa2b8;">Karma</div>';
    html += '<div style="font-weight: 700; color: #7bc2ff;">+10,000</div></div></div>';

    html += '</div>';

    // Drops especiales
    var specialDrops = STRIKE_REWARDS[encounterId];
    if (specialDrops && specialDrops.specialDrops && specialDrops.specialDrops.length > 0) {
      html += '<div style="margin-top: 8px;">';
      html += '<div style="font-size: 0.8rem; font-weight: 600; margin-bottom: 12px; color: #ffd36b;">✨ Drops excepcionales</div>';
      html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">';
      
      for (var i = 0; i < specialDrops.specialDrops.length; i++) {
        var drop = specialDrops.specialDrops[i];
        html += '<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #2a2c35;">';
        html += '<img src="' + esc(drop.icon) + '" width="32" height="32" alt="' + esc(drop.name) + '" onerror="this.src=\'assets/icons/raids/bosses/default.png\'">';
        html += '<div><div style="font-size: 0.75rem; font-weight: 500;">' + esc(drop.name) + '</div>';
        html += '<div class="muted" style="font-size: 0.6rem;">' + esc(drop.type) + '</div></div></div>';
      }
      
      html += '</div></div>';
    }

    return html;
  }

  function openStrikeModal(strikeId, strikeName) {
    var modalEl = ensureModal();
    var titleEl = document.getElementById('strikeModalTitle');
    var bodyEl = document.getElementById('strikeModalBody');

    if (!titleEl || !bodyEl) return;

    titleEl.textContent = strikeName;

    var details = STRIKE_DETAILS[strikeId] || {
      description: ["• Información no disponible para este encuentro."],
      strategy: ["• Consulta la wiki de Guild Wars 2 para más detalles."],
      video: "https://wiki.guildwars2.com/wiki/Main_Page",
      wiki: "https://wiki.guildwars2.com/wiki/Main_Page",
      image: "assets/icons/raids/bosses/default.png"
    };

    var descriptionHtml = Array.isArray(details.description) 
      ? details.description.map(function(line) { return '<div style="margin-bottom: 8px;">' + esc(line) + '</div>'; }).join('')
      : '<div>' + esc(details.description) + '</div>';
      
    var strategyHtml = Array.isArray(details.strategy)
      ? details.strategy.map(function(line) { return '<div style="margin-bottom: 8px;">' + esc(line) + '</div>'; }).join('')
      : '<div>' + esc(details.strategy) + '</div>';

    var rewardsHtml = renderRewardsList(strikeId);

    bodyEl.innerHTML = `
      <div class="raid-tab-content" data-tab="desc" style="display: none; padding: 16px;">
        <div class="raid-modal-boss-image" style="display: flex; justify-content: center; margin-bottom: 16px;">
          ${createSafeIcon(details.image, strikeName, 120, 120, '⚔️')}
        </div>
        <div>
          <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: #a0ffc8; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/222580.png" width="20" height="20" alt="Descripción" style="vertical-align: middle;">
            Descripción
          </h4>
          <div style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${descriptionHtml}</div>
        </div>
      </div>
      <div class="raid-tab-content" data-tab="strat" style="display: none; padding: 16px;">
        <div>
          <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: #ffd36b; display: flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Cuentas/240679.png" width="20" height="20" alt="Estrategia" style="vertical-align: middle;">
            Estrategia
          </h4>
          <div style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${strategyHtml}</div>
        </div>
      </div>
      <div class="raid-tab-content" data-tab="rewards" style="display: none; padding: 16px;">
        ${rewardsHtml}
      </div>
      <div class="raid-tab-content" data-tab="links" style="display: none; padding: 16px;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <a href="${esc(details.wiki)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; border-bottom: none; color: #7bc2ff; display: inline-flex; align-items: center; gap: 8px;">
            <img src="assets/icons/Welcome/222580.png" width="18" height="18" alt="Wiki" style="vertical-align: middle;">
            Ver en Wiki oficial de Guild Wars 2
          </a>
          <a href="${esc(details.video)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; border-bottom: none; color: #7bc2ff; display: inline-flex; align-items: center; gap: 8px;">
            <img src="assets/icons/raids/bosses/Cinematic.png" width="18" height="18" alt="Video" style="vertical-align: middle;">
            Ver video tutorial en YouTube
          </a>
        </div>
      </div>
    `;

    // Configurar tabs
    var tabBtns = modalEl.querySelectorAll('.raid-modal-tab');
    var contents = modalEl.querySelectorAll('.raid-tab-content');
    
    tabBtns.forEach(function(btn) {
      btn.classList.remove('active');
    });
    contents.forEach(function(content) {
      content.style.display = 'none';
    });
    
    var firstTab = modalEl.querySelector('.raid-modal-tab[data-tab="desc"]');
    var firstContent = modalEl.querySelector('.raid-tab-content[data-tab="desc"]');
    
    if (firstTab) firstTab.classList.add('active');
    if (firstContent) firstContent.style.display = 'block';
    
    var newTabBtns = modalEl.querySelectorAll('.raid-modal-tab');
    newTabBtns.forEach(function(btn) {
      var freshBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(freshBtn, btn);
      
      freshBtn.addEventListener('click', function() {
        var tabId = this.getAttribute('data-tab');
        
        var allBtns = modalEl.querySelectorAll('.raid-modal-tab');
        allBtns.forEach(function(b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
        
        var allContents = modalEl.querySelectorAll('.raid-tab-content');
        allContents.forEach(function(c) {
          c.style.display = 'none';
        });
        
        var targetContent = modalEl.querySelector('.raid-tab-content[data-tab="' + tabId + '"]');
        if (targetContent) {
          targetContent.style.display = 'block';
        }
      });
    });

    modalEl.removeAttribute('hidden');
  }

  function closeModal() {
    if (modal) {
      modal.setAttribute('hidden', '');
    }
  }

  async function loadStrikeData(forceNoCache) {
    console.log(LOG, 'loadStrikeData iniciado');
    
    var token = getSelectedToken();
    state.token = token;

    if (!ensurePanelContent()) {
      console.error(LOG, 'No se pudo asegurar el contenido del panel');
      return;
    }

    if (!token) {
      var gridContainer = document.getElementById('strikesGrid');
      if (gridContainer) {
        gridContainer.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">🔑 Seleccioná una API Key para ver el progreso de strikes.<br><small>Requiere permiso "progression"</small></div>';
      }
      renderKPIs(0, 0);
      startTimers();
      return;
    }

    state.loading = true;
    state.error = null;
    startTimers();

    try {
      var completed = await root.GW2Api.getAccountRaids(token, { nocache: !!forceNoCache });
      
      // Filtrar solo IDs de strikes (excluyendo raids tradicionales)
      var strikeIds = [];
      for (var exp = 0; exp < STRIKES_BY_EXPANSION.length; exp++) {
        for (var s = 0; s < STRIKES_BY_EXPANSION[exp].strikes.length; s++) {
          var strike = STRIKES_BY_EXPANSION[exp].strikes[s];
          if (strike.id !== 'mount_balrior') {
            strikeIds.push(strike.id);
          }
        }
      }
      
      state.completedStrikes = Array.isArray(completed) ? completed.filter(function(id) {
        return strikeIds.indexOf(id) !== -1;
      }) : [];
      
      console.log(LOG, 'Strikes completadas:', state.completedStrikes.length);
      
      renderStrikesGrid(state.completedStrikes);
    } catch (error) {
      console.error(LOG, 'Error loading strike data:', error);
      state.error = error.message;
      var gridContainer = document.getElementById('strikesGrid');
      if (gridContainer) {
        gridContainer.innerHTML = `<div class="error" style="text-align: center; padding: 40px; color: #ff9d9d;">❌ Error al cargar datos de strikes: ${esc(error.message)}<br><small>Verificá que la API key tenga permiso "progression"</small></div>`;
      }
    } finally {
      state.loading = false;
    }
  }

  async function refresh(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    try {
      _refreshInFlight = loadStrikeData(!!forceNoCache);
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  function activate() {
    if (state.active) return;
    state.active = true;

    console.log(LOG, 'activate()');

    ensurePanelContent();
    startTimers();
    refresh(false);
    
    // Configurar navegación entre Raids/Strikes
    wireStrikeViewToggle();
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;

    console.log(LOG, 'deactivate()');

    stopTimers();

    closeModal();
  }

  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    var token = getSelectedToken();
    if (!token) return;

    try {
      await root.GW2Api.getAccountRaids(token, { nocache: false });
    } catch (e) {
      console.debug(LOG, 'prefetch error (ignored)', e);
    }
  }

  function wireGlobalEvents() {
    document.addEventListener('gn:tokenchange', function() {
      if (!state.active) return;
      console.log(LOG, 'tokenchange detected, reloading...');
      refresh(true);
      syncLiFromRaidTracker();
    });
  }

  function wireStrikeViewToggle() {
    var raidsBtn = document.getElementById('strikeViewRaidsBtn');
    var strikesBtn = document.getElementById('strikeViewStrikesBtn');
    var raidsPanel = document.getElementById('raidTrackerPanel');
    var strikesPanel = document.getElementById('strikeTrackerPanel');
    
    if (!raidsBtn || !strikesBtn || !raidsPanel || !strikesPanel) return;
    
    raidsBtn.addEventListener('click', function() {
      strikesPanel.setAttribute('hidden', '');
      raidsPanel.removeAttribute('hidden');
      if (window.RaidTracker && typeof window.RaidTracker.refresh === 'function') {
        window.RaidTracker.refresh(false);
      }
    });
    
    strikesBtn.addEventListener('click', function() {
      raidsPanel.setAttribute('hidden', '');
      strikesPanel.removeAttribute('hidden');
      if (window.StrikeTracker && typeof window.StrikeTracker.refresh === 'function') {
        window.StrikeTracker.refresh(false);
      }
    });
  }

  function initOnce() {
    if (state.inited) return;
    ensureModal();
    wireGlobalEvents();
    state.inited = true;
    console.log(LOG, 'ready v1.0.0');
  }

  var StrikeTracker = {
    initOnce: initOnce,
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    refresh: refresh,
    _debug: function () {
      return {
        version: '1.0.0',
        inited: state.inited,
        active: state.active,
        token: state.token ? (state.token.slice(0, 8) + '...') : null,
        completedStrikes: state.completedStrikes.length,
        completedIds: state.completedStrikes,
        loading: state.loading,
        error: state.error
      };
    },
    Route: {
      path: 'account/strikes',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    }
  };

  root.StrikeTracker = StrikeTracker;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    initOnce();
  }

  console.info(LOG, 'Módulo cargado v1.0.0');

})(typeof window !== 'undefined' ? window : this);