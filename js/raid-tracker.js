/*!
 * js/raid-tracker.js — Seguimiento de Raids Semanales
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.7.0 (2026-04-23) — Modal con tabs funcionando + LI disponibles (ID 70)
 */

(function (root) {
  'use strict';

  var LOG = '[RaidTracker]';

  // ========================================================================
  // 1. DATOS ESTÁTICOS - LISTA COMPLETA DE ENCUENTROS
  // ========================================================================

  var WINGS = [
    {
      id: 1,
      name: "Valle Espiritual",
      nameEn: "Spirit Vale",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing1.png",
      encounters: [
        { id: "vale_guardian", name: "Guardián del valle", nameEn: "Vale Guardian", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/vale_guardian.png" },
        { id: "spirit_woods", name: "Bosques Espirituales", nameEn: "Spirit Woods", type: "evento", li: 0, icon: "assets/icons/raids/bosses/spirit_woods.png" },
        { id: "gorseval", name: "Gorseval el Múltiple", nameEn: "Gorseval the Multifarious", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/gorseval.png" },
        { id: "sabetha", name: "Sabetha la Saboteadora", nameEn: "Sabetha the Saboteur", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/sabetha.png" }
      ]
    },
    {
      id: 2,
      name: "Paso de la Salvación",
      nameEn: "Salvation Pass",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing2.png",
      encounters: [
        { id: "slothasor", name: "Perezón", nameEn: "Slothasor", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/slothasor.png" },
        { id: "bandit_trio", name: "Campamento de Prisioneros", nameEn: "Bandit Trio", type: "evento", li: 0, icon: "assets/icons/raids/bosses/bandit_trio.png" },
        { id: "matthias", name: "Matías Gabrel", nameEn: "Matthias Gabrel", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/matthias.png" }
      ]
    },
    {
      id: 3,
      name: "Fortaleza de los Fieles",
      nameEn: "Stronghold of the Faithful",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing3.png",
      encounters: [
        { id: "siege_the_stronghold", name: "Escolta de Glenna", nameEn: "Siege the Stronghold", type: "evento", li: 0, icon: "assets/icons/raids/bosses/siege_the_stronghold.png" },
        { id: "keep_construct", name: "Ensamblaje de la Fortaleza", nameEn: "Keep Construct", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/keep_construct.png" },
        { id: "twisted_castle", name: "Castillo Retorcido", nameEn: "Twisted Castle", type: "evento", li: 0, icon: "assets/icons/raids/bosses/twisted_castle.png" },
        { id: "xera", name: "Xera", nameEn: "Xera", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/xera.png" }
      ]
    },
    {
      id: 4,
      name: "Bastión del Penitente",
      nameEn: "Bastion of the Penitent",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing4.png",
      encounters: [
        { id: "cairn", name: "Cairn el Indomable", nameEn: "Cairn the Indomitable", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/cairn.png" },
        { id: "mursaat_overseer", name: "Dirigente mursaat", nameEn: "Mursaat Overseer", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/mursaat_overseer.png" },
        { id: "samarog", name: "Samarog", nameEn: "Samarog", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/samarog.png" },
        { id: "deimos", name: "Deimos", nameEn: "Deimos", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/deimos.png" }
      ]
    },
    {
      id: 5,
      name: "Salón de los Cadenas",
      nameEn: "Hall of Chains",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing5.png",
      encounters: [
        { id: "desmina", name: "Horror sin alma", nameEn: "Soulless Horror", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/desmina.png" },
        { id: "river_of_souls", name: "Río de Almas", nameEn: "River of Souls", type: "evento", li: 0, icon: "assets/icons/raids/bosses/river_of_souls.png" },
        { id: "statues_of_grenth", name: "Estatuas de Grenth", nameEn: "Statues of Grenth", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/statues_of_grenth.png" },
        { id: "dhuum", name: "Dhuum", nameEn: "Dhuum", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/dhuum.png" }
      ]
    },
    {
      id: 6,
      name: "Mito de Mythwright",
      nameEn: "Mythwright Gambit",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing6.png",
      encounters: [
        { id: "conjured_amalgamate", name: "Amalgamado conjurado", nameEn: "Conjured Amalgamate", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/conjured_amalgamate.png" },
        { id: "twin_largos", name: "Largos gemelos", nameEn: "Twin Largos", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/twin_largos.png" },
        { id: "qadim", name: "Qadim", nameEn: "Qadim", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/qadim.png" }
      ]
    },
    {
      id: 7,
      name: "La Llave de Ahdashim",
      nameEn: "The Key of Ahdashim",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing7.png",
      encounters: [
        { id: "gates_of_ahdashim", name: "Puertas de Ahdashim", nameEn: "Gates of Ahdashim", type: "evento", li: 0, icon: "assets/icons/raids/bosses/gates_of_ahdashim.png" },
        { id: "adina", name: "Adina", nameEn: "Adina", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/adina.png" },
        { id: "sabir", name: "Sabir", nameEn: "Sabir", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/sabir.png" },
        { id: "qadim_the_peerless", name: "Qadim el Simpar", nameEn: "Qadim the Peerless", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/qadim_the_peerless.png" }
      ]
    },
    {
      id: 8,
      name: "Monte Balrior",
      nameEn: "Mount Balrior",
      expansion: "Janthir Wilds",
      icon: "assets/icons/raids/wing8.png",
      encounters: [
        { id: "ura_guardian", name: "Guardián Ura", nameEn: "Ura Guardian", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/ura_guardian.png" },
        { id: "the_threshold", name: "Mecánica del Límite", nameEn: "The Threshold", type: "evento", li: 0, icon: "assets/icons/raids/bosses/the_threshold.png" },
        { id: "decimus", name: "Rey Decimus", nameEn: "Decimus the Revenant", type: "jefe", li: 1, icon: "assets/icons/raids/bosses/decimus.png" }
      ]
    }
  ];

  // Datos de recompensas por encuentro
  var REWARDS_DATA = {
    "vale_guardian": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "gorseval": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "sabetha": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91517, name: "Mochila de esquirlas de golem", icon: "assets/icons/raids/rewards/golem_backpack.png" }
      ]
    },
    "slothasor": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "matthias": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91518, name: "Mochila de sangre de Matthias", icon: "assets/icons/raids/rewards/matthias_backpack.png" }
      ]
    },
    "keep_construct": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "xera": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91519, name: "Mochila de Xera", icon: "assets/icons/raids/rewards/xera_backpack.png" }
      ]
    },
    "cairn": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "mursaat_overseer": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "samarog": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "deimos": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91520, name: "Mochila de Deimos", icon: "assets/icons/raids/rewards/deimos_backpack.png" }
      ]
    },
    "desmina": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "dhuum": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91521, name: "Mochila de Dhuum", icon: "assets/icons/raids/rewards/dhuum_backpack.png" },
        { id: 91522, name: "Mini Dhuum", icon: "assets/icons/raids/rewards/mini_dhuum.png" }
      ]
    },
    "conjured_amalgamate": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "twin_largos": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91523, name: "Mochila de Largos", icon: "assets/icons/raids/rewards/largos_backpack.png" }
      ]
    },
    "qadim": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91524, name: "Mochila de Qadim", icon: "assets/icons/raids/rewards/qadim_backpack.png" }
      ]
    },
    "adina": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "sabir": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "qadim_the_peerless": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" },
        { id: 91525, name: "Mochila de Qadim el sin par", icon: "assets/icons/raids/rewards/qadim_peerless_backpack.png" }
      ]
    },
    "ura_guardian": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    },
    "decimus": {
      drops: [
        { id: 79722, name: "Insight legendaria", icon: "assets/icons/raids/rewards/legendary_insight.png" },
        { id: 79921, name: "Fragmento de fe ascendido", icon: "assets/icons/raids/rewards/ascended_fragment.png" }
      ]
    }
  };

  // ========================================================================
  // 2. DATOS DE MECÁNICAS Y ESTRATEGIAS (VERSIÓN COMPLETA)
  // ========================================================================

  var BOSS_DETAILS = {
    "spirit_woods": {
      description: [
        "• Espesura de Espíritus es un evento de escolta que abre el acceso al ala.",
        "• Hay que escoltar a un espíritu mientras se lucha contra oleadas de enemigos.",
        "• Los jugadores deben recolectar orbes para alimentar al espíritu.",
        "• Si el espíritu muere, el evento falla y hay que reiniciar.",
        "• Es un encuentro de coordinación y control de masas."
      ],
      strategy: [
        "• TANQUE: Proteger al espíritu de los enemigos grandes.",
        "• DPS: Priorizar a los enemigos que atacan al espíritu.",
        "• APOYO: Curar al espíritu si es posible.",
        "• TODOS: Recolectar orbes rápidamente.",
        "• CRÍTICO: No dejar que el espíritu muera."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Spirit_Woods",
      image: "assets/icons/raids/bosses/spirit_woods_detail.png"
    },
    "vale_guardian": {
      description: [
        "• El Guardián del Valle tiene 4 fases: 100%-75%, 75%-50%, 50%-25%, 25%-0%.",
        "• En cada fase, invoca 4 orbes de colores (rojo, azul, verde, naranja) que deben ser recolectados.",
        "• Los orbes rojos dañan al grupo si no se recogen rápidamente.",
        "• Los orbes azules curan al grupo pero dejan al que lo recoge muy vulnerable.",
        "• El jefe aplica una habilidad de teletransporte que debe ser evitada con movimiento constante."
      ],
      strategy: [
        "• TANQUE: Mantener al jefe centrado en el medio del área.",
        "• DPS: Priorizar la destrucción de los orbes rojos tan pronto aparezcan.",
        "• APOYO: Curar intensamente a los jugadores que recogen orbes azules.",
        "• TODOS: Mantenerse en movimiento para evitar el teletransporte.",
        "• CRÍTICO: Romper la barra de ruptura cuando el jefe esté al 66% y 33% de vida."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Vale_Guardian",
      image: "assets/icons/raids/bosses/vale_guardian_detail.jpg"
    },
    "gorseval": {
      description: [
        "• Gorseval tiene una mecánica de \"alma atrapada\" que debe ser liberada.",
        "• Cada 25% de vida, invoca una pared de huecos que debe ser derribada rápidamente.",
        "• Los huecos lanzan proyectiles que causan daño masivo en área.",
        "• Si no se derriban las paredes a tiempo, el jefe se enfurece y causa wipe.",
        "• También invoca espíritus que deambulan y deben ser controlados."
      ],
      strategy: [
        "• TANQUE: Posicionar a Gorseval de espaldas al grupo.",
        "• DPS: Guardar habilidades de daño masivo para derribar las paredes.",
        "• APOYO: Curar a los jugadores que rompen las paredes.",
        "• TODOS: Romper la barra de ruptura inmediatamente después de cada pared.",
        "• CRÍTICO: Si el dps es bajo, usar orbes verdes para curar al grupo."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Gorseval",
      image: "assets/icons/raids/bosses/gorseval_detail.jpg"
    },
    "sabetha": {
      description: [
        "• Sabetha tiene torretas (cannons) que disparan al área aleatoriamente.",
        "• Cada cierto tiempo, lanza cohetes que deben ser redirigidos a la torreta.",
        "• Invoca enemigos adicionales que deben ser eliminados prioritariamente.",
        "• Si no se destruyen las torretas, el daño se vuelve imparable.",
        "• En la fase final, aparecen múltiples torretas simultáneamente."
      ],
      strategy: [
        "• TANQUE: Mantener a Sabetha alejada de las torretas.",
        "• DPS: Asignar 1-2 jugadores exclusivos para manejar cohetes y torretas.",
        "• APOYO: Curar a los jugadores que corren hacia las torretas.",
        "• TODOS: Priorizar las torretas sobre el jefe cuando aparezcan.",
        "• CRÍTICO: Coordinar el lanzamiento de cohetes para que impacten en la torreta correcta."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Sabetha",
      image: "assets/icons/raids/bosses/sabetha_detail.jpg"
    },
    "slothasor": {
      description: [
        "• Slothasor vomita veneno que se expande con el tiempo.",
        "• Invoca mohos que explotan al morir, causando daño en área.",
        "• El jefe tiene una habilidad de carga que derriba a los jugadores.",
        "• Cada cierto tiempo, se vuelve invulnerable y hay que romper su barra.",
        "• El veneno puede limpiarse con habilidades de condición."
      ],
      strategy: [
        "• TANQUE: Rotar alrededor del área para evitar acumular veneno.",
        "• DPS: Matar los mohos lejos del grupo para evitar daño.",
        "• APOYO: Llevar habilidades de limpieza de condiciones.",
        "• TODOS: Mantener la barra de ruptura lista para cuando se vuelva invulnerable.",
        "• CRÍTICO: No dejar que el veneno ocupe demasiado espacio."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Slothasor",
      image: "assets/icons/raids/bosses/slothasor_detail.jpg"
    },
    "bandit_trio": {
      description: [
        "• La Banda del Lobo es un evento de tres mini-jefes simultáneos.",
        "• Cada mini-jefe tiene mecánicas únicas y deben ser manejados por separado.",
        "• Si un mini-jefe muere, los otros se fortalecen.",
        "• Hay que coordinar la muerte de los tres al mismo tiempo.",
        "• Es un encuentro de coordinación y control de múltiples objetivos."
      ],
      strategy: [
        "• TANQUE: Cada mini-jefe necesita un tanque dedicado.",
        "• DPS: Mantener el daño equilibrado entre los tres.",
        "• APOYO: Curar a cada grupo por separado.",
        "• TODOS: Coordinar el daño para que mueran juntos.",
        "• CRÍTICO: No dejar que un mini-jefe muera mucho antes que los otros."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Bandit_Trio",
      image: "assets/icons/raids/bosses/bandit_trio_detail.jpg"
    },
    "matthias": {
      description: [
        "• Matthias alterna entre tormentas de sangre y tormentas de nieve.",
        "• Invoca cristales que deben ser destruidos para evitar daño masivo.",
        "• Durante la tormenta de sangre, el daño se duplica pero la curación se reduce.",
        "• Durante la tormenta de nieve, la velocidad se reduce drásticamente.",
        "• También aplica una maldición que debe ser pasada entre jugadores."
      ],
      strategy: [
        "• TANQUE: Mover a Matthias lejos de los cristales.",
        "• DPS: Priorizar la destrucción de cristales inmediatamente.",
        "• APOYO: Curar intensamente durante la tormenta de sangre.",
        "• TODOS: Pasar la maldición antes de que explote.",
        "• CRÍTICO: Coordinar el movimiento durante la tormenta de nieve."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Matthias_Gabrel",
      image: "assets/icons/raids/bosses/matthias_detail.jpg"
    },
    "siege_the_stronghold": {
      description: [
        "• Escolta de Glenna es un evento donde hay que proteger a un NPC mientras destruye puertas.",
        "• Aparecen oleadas de enemigos que atacan a Glenna.",
        "• Si Glenna muere, el evento falla.",
        "• También hay que derribar puertas con catapultas.",
        "• Es un encuentro de protección y destrucción de objetivos."
      ],
      strategy: [
        "• TANQUE: Proteger a Glenna de los enemigos grandes.",
        "• DPS: Priorizar a los enemigos que atacan a Glenna.",
        "• APOYO: Curar a Glenna constantemente.",
        "• TODOS: Usar catapultas para derribar puertas.",
        "• CRÍTICO: No dejar que Glenna muera."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Siege_the_Stronghold",
      image: "assets/icons/raids/bosses/siege_the_stronghold_detail.jpg"
    },
    "keep_construct": {
      description: [
        "• El KC tiene una barra de ruptura extremadamente resistente.",
        "• Si no se rompe a tiempo, el jefe se enfurece y causa wipe.",
        "• Invoca orbes de curación que deben ser recogidos.",
        "• Después de romper la barra, entra en un estado vulnerable.",
        "• En la fase final, las barras de ruptura son más frecuentes."
      ],
      strategy: [
        "• TANQUE: Mantener al jefe centrado para facilitar el dps.",
        "• DPS: Guardar todas las habilidades de ruptura para la barra.",
        "• APOYO: Curar a los jugadores que recogen los orbes.",
        "• TODOS: Atacar con todo después de romper la barra.",
        "• CRÍTICO: No gastar habilidades de ruptura fuera de la barra."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Keep_Construct",
      image: "assets/icons/raids/bosses/keep_construct_detail.jpg"
    },
    "twisted_castle": {
      description: [
        "• El Castillo Retorcido es un evento de rompecabezas y plataformas.",
        "• Hay que activar interruptores en el orden correcto.",
        "• Los jugadores deben dividirse para activar múltiples interruptores simultáneamente.",
        "• Hay enemigos que protegen los interruptores.",
        "• Es un encuentro de coordinación y resolución de acertijos."
      ],
      strategy: [
        "• TANQUE: Proteger a los jugadores que activan interruptores.",
        "• DPS: Matar enemigos rápidamente.",
        "• APOYO: Curar a los jugadores en las plataformas.",
        "• TODOS: Comunicar el orden de activación.",
        "• CRÍTICO: No activar interruptores en el orden incorrecto."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Twisted_Castle",
      image: "assets/icons/raids/bosses/twisted_castle_detail.jpg"
    },
    "xera": {
      description: [
        "• Xera tiene plataformas flotantes que se destruyen con el tiempo.",
        "• Invoca fragmentos (shards) rojos que deben ser recogidos.",
        "• Si no se recogen, causan daño masivo al grupo.",
        "• También teletransporta jugadores a plataformas distantes.",
        "• En la fase final, las plataformas se destruyen más rápido."
      ],
      strategy: [
        "• TANQUE: Mantener a Xera en el centro de la plataforma.",
        "• DPS: Asignar jugadores para recoger los fragmentos rojos.",
        "• APOYO: Curar a los jugadores teletransportados.",
        "• TODOS: Moverse siempre hacia la plataforma más grande.",
        "• CRÍTICO: No caerse de las plataformas."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Xera",
      image: "assets/icons/raids/bosses/xera_detail.jpg"
    },
    "cairn": {
      description: [
        "• Cairn lanza espadas que siguen a los jugadores.",
        "• Cada espada deja un área de daño persistente.",
        "• Si los jugadores se stackean, el daño se multiplica.",
        "• También tiene un ataque de salto que derriba.",
        "• En la fase final, aparecen múltiples espadas simultáneamente."
      ],
      strategy: [
        "• TANQUE: Mantener a Cairn alejado del grupo.",
        "• DPS: Esparcirse para evitar daño múltiple.",
        "• APOYO: Curar a los jugadores perseguidos por espadas.",
        "• TODOS: No stackearse para evitar daño en cadena.",
        "• CRÍTICO: Moverse constantemente para evitar espadas."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Cairn",
      image: "assets/icons/raids/bosses/cairn_detail.jpg"
    },
    "mursaat_overseer": {
      description: [
        "• El Mursaat tiene torres de lava que deben ser desactivadas.",
        "• Si no se desactivan, lanzan bolas de fuego al grupo.",
        "• El jefe también lanza lava al suelo que permanece.",
        "• Invoca enemigos adicionales durante la pelea.",
        "• En la fase final, las torres se activan más rápido."
      ],
      strategy: [
        "• TANQUE: Mantener al jefe lejos de las torres activas.",
        "• DPS: Asignar jugadores para subir a las torres.",
        "• APOYO: Curar a los jugadores que suben a las torres.",
        "• TODOS: Evitar la lava en el suelo.",
        "• CRÍTICO: Desactivar torres antes de que disparen."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Mursaat_Overseer",
      image: "assets/icons/raids/bosses/mursaat_overseer_detail.jpg"
    },
    "samarog": {
      description: [
        "• Samarog lanza cadenas rojas que inmovilizan.",
        "• Si no se rompen, el jugador muere instantáneamente.",
        "• También tiene una habilidad de flexión que empuja.",
        "• Invoca sangre que debe ser recogida.",
        "• En la fase final, aparecen más cadenas simultáneamente."
      ],
      strategy: [
        "• TANQUE: Mantener a Samarog centrado.",
        "• DPS: Romper cadenas inmediatamente.",
        "• APOYO: Curar a los jugadores encadenados.",
        "• TODOS: Recoger la sangre para curar al grupo.",
        "• CRÍTICO: No dejar que nadie muera por cadena."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Samarog",
      image: "assets/icons/raids/bosses/samarog_detail.jpg"
    },
    "deimos": {
      description: [
        "• Deimos tiene una mano gigante que aplasta.",
        "• También un acecho que persigue a un jugador.",
        "• El acecho explota si toca al jugador.",
        "• Invoca enemigos adicionales durante la pelea.",
        "• En la fase final, aparecen múltiples acechos."
      ],
      strategy: [
        "• TANQUE: Mantener a Deimos alejado del grupo.",
        "• DPS: Matar al acecho rápidamente.",
        "• APOYO: Curar al jugador perseguido.",
        "• TODOS: Un jugador se aísla para manejar el acecho.",
        "• CRÍTICO: No dejar que el acecho explote en el grupo."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Deimos",
      image: "assets/icons/raids/bosses/deimos_detail.jpg"
    },
    "desmina": {
      description: [
        "• Desmina invoca esclavos que deben ser eliminados.",
        "• Los esclavos lanzan niebla que daña al grupo.",
        "• El jefe también lanza áreas oscuras que matan instantáneamente.",
        "• Si no se matan los esclavos, el daño se vuelve imparable.",
        "• En la fase final, aparecen más esclavos y más rápido."
      ],
      strategy: [
        "• TANQUE: Mantener a Desmina lejos de los esclavos.",
        "• DPS: Priorizar la eliminación de esclavos.",
        "• APOYO: Curar a los jugadores en la niebla.",
        "• TODOS: Evitar las áreas oscuras.",
        "• CRÍTICO: No dejar esclavos vivos."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Soulless_Horror",
      image: "assets/icons/raids/bosses/desmina_detail.png"
    },
    "river_of_souls": {
      description: [
        "• Río de Almas requiere escoltar a un alma.",
        "• El alma se mueve lentamente hacia el final.",
        "• Enemigos aparecen constantemente para atacarla.",
        "• Si el alma muere, el encuentro falla.",
        "• En la fase final, aparecen enemigos más poderosos."
      ],
      strategy: [
        "• TANQUE: Proteger el alma de los enemigos.",
        "• DPS: Matar enemigos rápidamente.",
        "• APOYO: Curar el alma si es posible.",
        "• TODOS: Mantenerse cerca del alma.",
        "• CRÍTICO: No dejar que el alma muera."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/River_of_Souls",
      image: "assets/icons/raids/bosses/river_of_souls_detail.jpg"
    },
    "statues_of_grenth": {
      description: [
        "• Las Estatuas de Dhuum son tres mini-jefes que deben ser derrotados.",
        "• Cada estatua tiene mecánicas únicas.",
        "• Si una estatua muere, las otras se fortalecen.",
        "• Hay que coordinar la muerte de las tres al mismo tiempo.",
        "• Es un encuentro de coordinación y dps equilibrado."
      ],
      strategy: [
        "• TANQUE: Cada estatua necesita un tanque dedicado.",
        "• DPS: Mantener el daño equilibrado entre las tres.",
        "• APOYO: Curar a cada grupo por separado.",
        "• TODOS: Coordinar el daño para que mueran juntas.",
        "• CRÍTICO: No dejar que una estatua muera mucho antes que las otras."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Statues_of_Grenth",
      image: "assets/icons/raids/bosses/statues_of_grenth_detail.png"
    },
    "dhuum": {
      description: [
        "• Dhuum es el jefe final del ala 5, requiere mecánicas complejas.",
        "• Tiene múltiples fases con mecánicas complejas.",
        "• Invoca orbes que deben ser recogidos.",
        "• También tiene una habilidad de muerte instantánea.",
        "• En la fase final, aparecen múltiples orbes simultáneamente."
      ],
      strategy: [
        "• TANQUE: Mantener a Dhuum lejos del grupo.",
        "• DPS: Recoger orbes rápidamente.",
        "• APOYO: Curar a los jugadores que recogen orbes.",
        "• TODOS: Sobrevivir a la habilidad de muerte.",
        "• CRÍTICO: Coordinar la recolección de orbes."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Dhuum",
      image: "assets/icons/raids/bosses/dhuum_detail.png"
    },
    "conjured_amalgamate": {
      description: [
        "• El CA tiene elementos que cambian de color.",
        "• Cada color requiere un daño específico.",
        "• Si se usa el color incorrecto, el daño se reduce.",
        "• También tiene un ataque de área que debe ser evitado.",
        "• En la fase final, los cambios son más rápidos."
      ],
      strategy: [
        "• TANQUE: Mantener al jefe centrado.",
        "• DPS: Usar el color correcto para cada fase.",
        "• APOYO: Curar a los jugadores en área.",
        "• TODOS: Evitar el ataque de área.",
        "• CRÍTICO: Coordinar los cambios de color."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Conjured_Amalgamate",
      image: "assets/icons/raids/bosses/conjured_amalgamate_detail.jpg"
    },
    "twin_largos": {
      description: [
        "• Los Twin Largos son dos jefes separados.",
        "• Cada grupo debe enfrentar a uno.",
        "• Los jefes tienen mecánicas similares pero opuestas.",
        "• Si un grupo mata a su jefe primero, ayuda al otro.",
        "• En la fase final, los jefes se vuelven más agresivos."
      ],
      strategy: [
        "• TANQUE: Cada grupo tiene su propio tanque.",
        "• DPS: Mantener el daño equilibrado entre ambos.",
        "• APOYO: Curar a cada grupo por separado.",
        "• TODOS: Coordinar el daño para que mueran juntos.",
        "• CRÍTICO: No dejar que un jefe muera muy antes que el otro."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Twin_Largos",
      image: "assets/icons/raids/bosses/twin_largos_detail.gif"
    },
    "qadim": {
      description: [
        "• Qadim tiene lámparas que deben ser recogidas.",
        "• Las lámparas protegen del fuego.",
        "• Si no se recogen, el fuego mata al grupo.",
        "• También tiene un ataque de área que debe ser evitado.",
        "• En la fase final, las lámparas son más difíciles de conseguir."
      ],
      strategy: [
        "• TANQUE: Mantener a Qadim lejos de las lámparas.",
        "• DPS: Recoger lámparas rápidamente.",
        "• APOYO: Curar a los jugadores con lámparas.",
        "• TODOS: Usar lámparas para protegerse del fuego.",
        "• CRÍTICO: No dejar lámparas sin recoger."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Qadim",
      image: "assets/icons/raids/bosses/qadim_detail.jpg"
    },
    "gates_of_ahdashim": {
      description: [
        "• Puertas de Ahdashim es el evento de apertura del ala 7.",
        "• Hay que destruir las puertas mientras se protege a los NPC aliados.",
        "• Aparecen oleadas de enemigos que atacan desde múltiples direcciones.",
        "• También hay que desactivar trampas en el camino.",
        "• Si los NPC mueren, el evento falla y hay que reiniciar."
      ],
      strategy: [
        "• TANQUE: Proteger a los NPC aliados de los enemigos grandes.",
        "• DPS: Priorizar la destrucción de las puertas.",
        "• APOYO: Curar a los NPC constantemente.",
        "• TODOS: Desactivar trampas antes de que dañen al grupo.",
        "• CRÍTICO: No dejar que los NPC mueran."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Gates_of_Ahdashim",
      image: "assets/icons/raids/bosses/gates_of_ahdashim_detail.png"
    },
    "adina": {
      description: [
        "• Adina tiene pilares que deben ser derribados.",
        "• Los pilares lanzan arena que ciega.",
        "• Si no se derriban, el daño se acumula.",
        "• También tiene un ataque de área que debe ser evitado.",
        "• En la fase final, los pilares son más resistentes."
      ],
      strategy: [
        "• TANQUE: Mantener a Adina centrada.",
        "• DPS: Priorizar la destrucción de pilares.",
        "• APOYO: Curar a los jugadores ciegos.",
        "• TODOS: Evitar la arena.",
        "• CRÍTICO: No dejar pilares en pie."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Adina",
      image: "assets/icons/raids/bosses/adina_detail.png"
    },
    "sabir": {
      description: [
        "• Sabir tiene tormentas que se mueven por el área.",
        "• Las tormentas causan daño continuo.",
        "• Si no se evitan, el daño es letal.",
        "• También tiene un ataque de choque que derriba.",
        "• En la fase final, las tormentas son más rápidas."
      ],
      strategy: [
        "• TANQUE: Mantener a Sabir alejado de las tormentas.",
        "• DPS: Atacar durante las ventanas seguras.",
        "• APOYO: Curar a los jugadores en tormentas.",
        "• TODOS: Evitar las tormentas en todo momento.",
        "• CRÍTICO: No quedarse dentro de las tormentas."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Sabir",
      image: "assets/icons/raids/bosses/sabir_detail.png"
    },
    "qadim_the_peerless": {
      description: [
        "• Qadim the Peerless es el jefe final del ala 7.",
        "• Tiene whisps que deben ser recogidas.",
        "• También portales que deben ser usados.",
        "• Si no se usan los portales, el daño se multiplica.",
        "• En la fase final, aparecen múltiples whisps y portales."
      ],
      strategy: [
        "• TANQUE: Mantener a Qadim centrado.",
        "• DPS: Recoger whisps rápidamente.",
        "• APOYO: Curar a los jugadores en portales.",
        "• TODOS: Usar portales para moverse rápido.",
        "• CRÍTICO: Coordinar la recolección de whisps y uso de portales."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Qadim_the_Peerless",
      image: "assets/icons/raids/bosses/qadim_the_peerless_detail.png"
    },
    "ura_guardian": {
      description: [
        "• Guardián Ura es el primer encuentro del ala 8.",
        "• Tiene mecánicas de luz y oscuridad.",
        "• Invoca orbes que deben ser recolectados según el color.",
        "• También tiene un ataque de área que debe ser evitado.",
        "• En la fase final, los orbes son más difíciles de conseguir."
      ],
      strategy: [
        "• TANQUE: Mantener al jefe centrado.",
        "• DPS: Recoger orbes del color correcto.",
        "• APOYO: Curar a los jugadores con orbes.",
        "• TODOS: Evitar el ataque de área.",
        "• CRÍTICO: Coordinar la recolección de orbes."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Ura_Guardian",
      image: "assets/icons/raids/bosses/ura_guardian_detail.png"
    },
    "the_threshold": {
      description: [
        "• El Límite es un evento de transición.",
        "• Hay que cruzar una zona peligrosa mientras se lucha contra enemigos.",
        "• También hay que activar mecanismos para avanzar.",
        "• Si el grupo se separa, el daño aumenta.",
        "• Es un encuentro de coordinación y movimiento."
      ],
      strategy: [
        "• TANQUE: Proteger al grupo de los enemigos grandes.",
        "• DPS: Matar enemigos rápidamente.",
        "• APOYO: Curar a los jugadores en la zona peligrosa.",
        "• TODOS: Mantenerse juntos.",
        "• CRÍTICO: No separarse del grupo."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/The_Threshold",
      image: "assets/icons/raids/bosses/the_threshold_detail.png"
    },
    "decimus": {
      description: [
        "• Rey Decimus es el jefe final del ala 8.",
        "• Tiene mecánicas de invocación de esqueletos.",
        "• También lanza maldiciones que deben ser limpiadas.",
        "• Invoca áreas de daño que permanecen en el suelo.",
        "• En la fase final, las invocaciones son más frecuentes."
      ],
      strategy: [
        "• TANQUE: Mantener a Decimus lejos del grupo.",
        "• DPS: Priorizar la eliminación de esqueletos.",
        "• APOYO: Limpiar maldiciones rápidamente.",
        "• TODOS: Evitar las áreas de daño.",
        "• CRÍTICO: No dejar esqueletos vivos."
      ],
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      wiki: "https://wiki.guildwars2.com/wiki/Decimus",
      image: "assets/icons/raids/bosses/decimus_detail.png"
    }
  };

  // ========================================================================
  // 3. ESTADO GLOBAL
  // ========================================================================

  var state = {
    inited: false,
    active: false,
    token: null,
    completedEncounters: [],
    liAvailable: 0,
    loading: false,
    error: null,
    refreshTimer: null,
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
      return '<span style="font-size: ' + (width || 24) + 'px;">' + (fallbackEmoji || '🏰') + '</span>';
    }
    var imgHtml = '<img src="' + esc(src) + '" alt="' + esc(alt) + '" width="' + (width || 28) + '" height="' + (height || 28) + '" loading="lazy" style="border-radius: 8px;" onerror="this.style.display=\'none\'; this.insertAdjacentHTML(\'afterend\', \'<span style=\\\'font-size:' + (width || 24) + 'px;\\\'>' + (fallbackEmoji || '🏰') + '</span>\');">';
    return imgHtml;
  }

  async function loadLiAvailable(token) {
    if (!token) return 0;
    try {
      var wallet = await root.GW2Api.getAccountWallet(token, { nocache: false });
      if (!Array.isArray(wallet)) return 0;
      var liItem = wallet.find(function(item) { return item.id === 70; });
      return liItem ? liItem.value : 0;
    } catch (error) {
      console.warn(LOG, 'Error loading LI available:', error);
      return 0;
    }
  }

  function updateUtcTime() {
    var utcEl = document.getElementById('raidUtcTime');
    if (utcEl) {
      var now = new Date();
      utcEl.textContent = now.toUTCString().split(' ')[4];
    }
  }

  function updateLocalTime() {
    var localEl = document.getElementById('raidLocalTime');
    if (localEl) {
      var now = new Date();
      localEl.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  function updateResetCounters() {
    var dailyEl = document.getElementById('raidDailyReset');
    var weeklyEl = document.getElementById('raidWeeklyReset');
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

  function updateLiDisplay() {
    var liAvailableEl = document.getElementById('raidLiAvailable');
    if (liAvailableEl) liAvailableEl.textContent = state.liAvailable.toLocaleString();
  }

  // ========================================================================
  // SKELETON LOADER
  // ========================================================================

  function showSkeleton() {
    var gridContainer = document.getElementById('raidWingsGrid');
    var kpiContainer = document.getElementById('raidKPIs');
    
    // Guardar contenido original si no está guardado
    if (gridContainer && !gridContainer.__originalContent && gridContainer.innerHTML.trim() !== '') {
      gridContainer.__originalContent = gridContainer.innerHTML;
    }
    if (kpiContainer && !kpiContainer.__originalContent && kpiContainer.innerHTML.trim() !== '') {
      kpiContainer.__originalContent = kpiContainer.innerHTML;
    }
    
    // Mostrar skeleton en grid
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div class="raid-skeleton-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
          ${Array(8).fill(`
            <div class="raid-skeleton-card" style="background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%); background-size: 200% 100%; animation: raidShimmer 1.5s infinite; border-radius: 16px; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0c0e14;">
                <div style="width: 32px; height: 32px; background: #2a2c35; border-radius: 8px;"></div>
                <div style="flex: 1;">
                  <div style="height: 16px; background: #2a2c35; border-radius: 4px; width: 60%; margin-bottom: 8px;"></div>
                  <div style="height: 8px; background: #2a2c35; border-radius: 4px; width: 40%;"></div>
                </div>
              </div>
              <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                ${Array(4).fill(`
                  <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px;">
                    <div style="width: 40px; height: 40px; background: #2a2c35; border-radius: 8px;"></div>
                    <div style="flex: 1;">
                      <div style="height: 14px; background: #2a2c35; border-radius: 4px; width: 70%; margin-bottom: 6px;"></div>
                      <div style="height: 10px; background: #2a2c35; border-radius: 4px; width: 30%;"></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Mostrar skeleton en KPIs
    if (kpiContainer) {
      kpiContainer.innerHTML = `
        <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
          <div class="skeleton-bar" style="width: 200px; height: 80px; background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%); background-size: 200% 100%; animation: raidShimmer 1.5s infinite; border-radius: 12px;"></div>
          <div class="skeleton-bar" style="width: 200px; height: 80px; background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%); background-size: 200% 100%; animation: raidShimmer 1.5s infinite; border-radius: 12px;"></div>
          <div class="skeleton-bar" style="width: 150px; height: 80px; background: linear-gradient(90deg, #1a1c24 25%, #252830 50%, #1a1c24 75%); background-size: 200% 100%; animation: raidShimmer 1.5s infinite; border-radius: 12px;"></div>
        </div>
      `;
    }
  }

  function hideSkeleton() {
    var gridContainer = document.getElementById('raidWingsGrid');
    var kpiContainer = document.getElementById('raidKPIs');
    
    // Restaurar contenido original del grid
    if (gridContainer && gridContainer.__originalContent) {
      gridContainer.innerHTML = gridContainer.__originalContent;
      delete gridContainer.__originalContent;
    }
    
    // Restaurar contenido original de KPIs
    if (kpiContainer && kpiContainer.__originalContent) {
      kpiContainer.innerHTML = kpiContainer.__originalContent;
      delete kpiContainer.__originalContent;
    }
  }

  function startTimers() {
    if (state.utcTimeInterval) clearInterval(state.utcTimeInterval);
    if (state.localTimeInterval) clearInterval(state.localTimeInterval);
    if (state.resetInterval) clearInterval(state.resetInterval);
    updateUtcTime();
    updateLocalTime();
    updateResetCounters();
    updateLiDisplay();
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
    var panel = document.getElementById('raidTrackerPanel');
    if (!panel) return false;
    var body = panel.querySelector('.panel__body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'panel__body';
      panel.appendChild(body);
    }
    if (!body.querySelector('#raidUtcTime')) {
      body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
          <div id="raidLiBadge" style="display: flex; align-items: center; gap: 6px; background: #1a1c24; padding: 6px 14px; border-radius: 32px; font-size: 0.85rem;">
            <img src="https://render.guildwars2.com/file/6D33B7387BAF2E2CC9B5D37D1D1B01246AB6FA22/1302744.png" width="18" height="18" alt="LI" style="filter: brightness(0.9);">
            <span>LI disponibles:</span>
            <strong id="raidLiAvailable" style="font-weight: 700; color: #ffd36b;">0</strong>
          </div>
          <div class="meta-clock-bar chips" style="display: inline-flex; gap: 16px; align-items: center; background: #0f1116; padding: 4px 12px; border-radius: 40px; border: 1px solid #2a2c35; font-family: monospace; font-size: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Hora del servidor (UTC+0)">
              <img src="assets/icons/460028.png" width="20" height="20" alt="UTC" style="filter: brightness(0.9);">
              <span>UTC</span>
              <strong id="raidUtcTime">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Tu hora local">
              <img src="assets/icons/841720.png" width="20" height="20" alt="Local" style="filter: brightness(0.9);">
              <span>Local</span>
              <strong id="raidLocalTime">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset diario a las 00:00 UTC">
              <img src="assets/icons/534745.png" width="20" height="20" alt="Reset diario" style="filter: brightness(0.9);">
              <span>Reset diario</span>
              <strong id="raidDailyReset">—</strong>
            </div>
            <div style="width: 1px; height: 24px; background: #2a2c35;"></div>
            <div style="display: flex; align-items: center; gap: 6px;" data-tip="Reset semanal los lunes a las 07:30 UTC">
              <img src="assets/icons/155064.png" width="20" height="20" alt="Reset semanal" style="filter: brightness(0.9);">
              <span>Reset semanal</span>
              <strong id="raidWeeklyReset">—</strong>
            </div>
          </div>
        </div>
        <div id="raidKPIs" class="raid-kpis"></div>
        <div id="raidWingsGrid" class="raid-wings-grid"></div>
      `;
      console.log(LOG, 'Estructura del panel creada');
    }
    return true;
  }

  function renderKPIs(completedCount, totalCount) {
    var kpiContainer = document.getElementById('raidKPIs');
    if (!kpiContainer) return;
    var percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    kpiContainer.innerHTML = `
      <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #a0ffc8; flex: 1;">
          <div style="color: #a0a6b3; font-size: 12px;">Completados esta semana</div>
          <div style="font-size: 28px; font-weight: 800; color: #a0ffc8;">${completedCount} / ${totalCount}</div>
        </div>
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #7bc2ff; flex: 1;">
          <div style="color: #a0a6b3; font-size: 12px;">Progreso semanal</div>
          <div style="font-size: 28px; font-weight: 800; color: #7bc2ff;">${percentage}%</div>
          <div style="margin-top: 8px; height: 4px; background: #2a2c35; border-radius: 2px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #7bc2ff, #a0ffc8);"></div>
          </div>
        </div>
      </div>
    `;
  }

  function getTypeIcon(type) {
    if (type === 'jefe') return '👑';
    if (type === 'evento') return '⚡';
    return '❓';
  }

      function renderRewardsList(encounterId, bossName) {
        // Calcular cantidad de LI para este encuentro
        var liCount = 0;
        for (var w = 0; w < WINGS.length; w++) {
          for (var e = 0; e < WINGS[w].encounters.length; e++) {
            if (WINGS[w].encounters[e].id === encounterId && WINGS[w].encounters[e].li) {
              liCount = WINGS[w].encounters[e].li;
              break;
            }
          }
        }
        
        // ====== RECOMPENSAS BASE (todos los jefes) ======
        var html = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">
              <img src="https://render.guildwars2.com/file/6D33B7387BAF2E2CC9B5D37D1D1B01246AB6FA22/1302744.png" width="32" height="32" alt="LI" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E🔮%3C/text%3E%3C/svg%3E'">
              <div>
                <div style="font-size: 0.7rem; color: #9aa2b8;">Conocimiento legendario</div>
                <div style="font-weight: 700; color: #ffd36b;">+${liCount}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">
              <img src="https://render.guildwars2.com/file/98457F504BA2FAC8457F532C4B30EDC23929ACF9/619316.png" width="32" height="32" alt="Oro" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E💰%3C/text%3E%3C/svg%3E'">
              <div>
                <div style="font-size: 0.7rem; color: #9aa2b8;">Oro</div>
                <div style="font-weight: 700; color: #ffd36b;">+2~4</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">
              <img src="assets/icons/raids/experience.png" width="32" height="32" alt="Experiencia" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E⭐%3C/text%3E%3C/svg%3E'">
              <div>
                <div style="font-size: 0.7rem; color: #9aa2b8;">Experiencia</div>
                <div style="font-weight: 700; color: #a0ffc8;">+200,025</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1a1c24; border-radius: 10px;">
              <img src="https://render.guildwars2.com/file/94953FA23D3E0D23559624015DFEA4CFAA07F0E5/155026.png" width="32" height="32" alt="Karma" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%270%27 y=%2720%27 font-size=%2720%27%3E☯%3C/text%3E%3C/svg%3E'">
              <div>
                <div style="font-size: 0.7rem; color: #9aa2b8;">Karma</div>
                <div style="font-weight: 700; color: #7bc2ff;">+10,000</div>
              </div>
            </div>
          </div>
        `;
        
        // ====== RECOMPENSAS EXCLUSIVAS (drops especiales por jefe) ======
        var specialDrops = getSpecialDrops(encounterId);
        if (specialDrops && specialDrops.length > 0) {
          html += `
            <div style="margin-top: 8px;">
              <div style="font-size: 0.8rem; font-weight: 600; margin-bottom: 12px; color: #ffd36b;">✨ Drops excepcionales</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
          `;
          
          for (var i = 0; i < specialDrops.length; i++) {
            var drop = specialDrops[i];
            html += `
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #0a0c10; border-radius: 10px; border: 1px solid #2a2c35;">
                <img src="${drop.icon}" width="32" height="32" alt="${drop.name}" onerror="this.src='assets/icons/raids/bosses/default.png'">
                <div>
                  <div style="font-size: 0.75rem; font-weight: 500;">${esc(drop.name)}</div>
                  <div class="muted" style="font-size: 0.6rem;">${drop.type}</div>
                </div>
              </div>
            `;
          }
          
          html += `
              </div>
            </div>
          `;
        }
        
        return html;
      }

      function getSpecialDrops(encounterId) {
        var drops = {
          // Ala 1
          "gorseval": [
            { name: "Infusión Fantasmal", type: "Infusión cosmética", icon: "assets/icons/raids/bosses/Ghostly_Infusion.png" }
          ],
          "sabetha": [
            { name: "Mochila de Sabetha", type: "Mochila", icon: "assets/icons/raids/bosses/sabetha_backpack.png" }
          ],
          // Ala 2
          "matthias": [
            { name: "Mochila de Matthias", type: "Mochila", icon: "assets/icons/raids/bosses/matthias_backpack.png" }
          ],
          // Ala 3
          "xera": [
            { name: "Mochila de Xera", type: "Mochila", icon: "assets/icons/raids/bosses/xera_backpack.png" }
          ],
          // Ala 4
          "mursaat_overseer": [
            { name: "Infusión Ojo Blanco", type: "Infusión cosmética", icon: "assets/icons/raids/bosses/white_eye_infusion.png" }
          ],
          "deimos": [
            { name: "Mochila de Deimos", type: "Mochila", icon: "assets/icons/raids/bosses/deimos_backpack.png" }
          ],
          // Ala 5
          "dhuum": [
            { name: "Silla del Último Juez amortajada", type: "Silla", icon: "assets/icons/raids/bosses/Silla_del_Último_Juez_amortajada.png" },
            { name: "Cofre de Armadura de Dhuum", type: "Infusión cosmética", icon: "assets/icons/raids/bosses/Cofre_de_armadura_de_Dhuum.png" }
          ],
          // Ala 6
          "twin_largos": [
            { name: "Contenedor de tónico de combate de largos", type: "Mochila", icon: "assets/icons/raids/bosses/Contenedor de tónico de combate de largos.png" }
          ],
          "qadim": [
            { name: "Sillín Néctar Fundido", type: "Sillín de montura (Raptor)", icon: "assets/icons/raids/bosses/molten_nectar_skin.png" }
          ],
          // Ala 7
          "qadim_the_peerless": [
            { name: "Sillín Perfección Fundida", type: "Sillín de montura (Raptor)", icon: "assets/icons/raids/bosses/molten_nectar_skin.png" },
            { name: "Infusión Corazón Fundido", type: "Infusión cosmética", icon: "assets/icons/raids/bosses/Peerless_Infusion.png" }
          ]
        };
        
        return drops[encounterId] || [];
      }

    function renderWingsGrid(completedEncounters) {
    var gridContainer = document.getElementById('raidWingsGrid');
    if (!gridContainer) return;

    var completedSet = new Set(completedEncounters);
    var totalEncounters = 0;
    var completedCount = 0;

    var html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">';

    for (var w = 0; w < WINGS.length; w++) {
      var wing = WINGS[w];
      
      // Calcular progreso del ala
      var wingTotal = wing.encounters.length;
      var wingCompleted = 0;
      for (var e = 0; e < wing.encounters.length; e++) {
        if (completedSet.has(wing.encounters[e].id)) wingCompleted++;
      }
      var wingProgressPercent = (wingCompleted / wingTotal) * 100;
      
      // Determinar clase de expansión
      var expClass = '';
      if (wing.expansion === 'Heart of Thorns') expClass = 'raid-expansion--hot';
      else if (wing.expansion === 'Path of Fire') expClass = 'raid-expansion--pof';
      else if (wing.expansion === 'Janthir Wilds') expClass = 'raid-expansion--janthir';
      else expClass = 'raid-expansion--core';
      
      html += `
        <div class="raid-wing-card" style="background: linear-gradient(180deg, #0f1116 0%, #0d0f14 100%); border: 1px solid #26262b; border-radius: 16px; overflow: hidden; animation: raidFadeInUp 0.3s ease forwards; opacity: 0; transform: translateY(10px); animation-delay: ${w * 0.02}s;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0c0e14; border-bottom: 1px solid #26262b;">
            <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(wing.icon, wing.name, 28, 28, '🏰')}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="font-weight: 700; font-size: 1rem;">${esc(wing.name)}</div>
                <span class="raid-expansion-badge ${expClass}">${esc(wing.expansion)}</span>
              </div>
              <div class="raid-wing-progress" style="margin-top: 8px; height: 3px; background: #2a2c35; border-radius: 2px; overflow: hidden;">
                <div class="raid-wing-progress__fill" style="width: ${wingProgressPercent}%; height: 100%; background: linear-gradient(90deg, #7bc2ff, #a0ffc8); border-radius: 2px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>
          <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
      `;

      for (var e = 0; e < wing.encounters.length; e++) {
        var enc = wing.encounters[e];
        var isCompleted = completedSet.has(enc.id);
        if (isCompleted) completedCount++;
        totalEncounters++;

        var typeIcon = enc.type === 'jefe' ? '👑' : '⚡';
        var typeColor = enc.type === 'jefe' ? '#ffd36b' : '#7bc2ff';
        var completedClass = isCompleted ? 'raid-encounter-card--completed' : '';
        var typeClass = enc.type === 'jefe' ? 'raid-encounter-card--jefe' : 'raid-encounter-card--evento';

        html += `
          <div class="raid-encounter-card ${completedClass} ${typeClass}" data-encounter-id="${esc(enc.id)}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #0a0c10; border-radius: 12px; border: 1px solid ${isCompleted ? '#2a6a4a' : '#26262b'}; transition: all 0.2s ease;">
            <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(enc.icon, enc.name, 36, 36, typeIcon)}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.65rem; color: ${typeColor}; background: #1a1c24; padding: 2px 6px; border-radius: 12px;">${enc.type === 'jefe' ? 'JEFE' : 'EVENTO'}</span>
                <div class="raid-encounter-name" style="font-weight: 600; font-size: 0.85rem; ${isCompleted ? 'text-decoration: line-through; text-decoration-color: #a0ffc8;' : ''}">${esc(enc.name)}</div>
              </div>
              <div style="font-size: 0.65rem; color: ${isCompleted ? '#a0ffc8' : '#ff9d9d'}; display: flex; align-items: center; gap: 4px;">
                <img src="assets/icons/Welcome/${isCompleted ? '156108' : '156107'}.png" width="12" height="12" alt="" style="vertical-align: middle;">
                ${isCompleted ? 'Completado' : 'Pendiente'}
              </div>
            </div>
            <button class="raid-encounter-detail-btn btn btn--ghost" data-encounter-id="${esc(enc.id)}" data-encounter-name="${esc(enc.name)}" style="padding: 4px 12px; font-size: 0.7rem; transition: transform 0.05s ease;">Detalle</button>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    html += '</div>';
    gridContainer.innerHTML = html;

    renderKPIs(completedCount, totalEncounters);
    updateLiDisplay();

    var detailBtns = gridContainer.querySelectorAll('.raid-encounter-detail-btn');
    for (var i = 0; i < detailBtns.length; i++) {
      var btn = detailBtns[i];
      if (btn.__wired) continue;
      btn.__wired = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var encId = this.getAttribute('data-encounter-id');
        var encName = this.getAttribute('data-encounter-name');
        openBossModal(encId, encName);
      });
    }
  }

  var modal = null;

        function ensureModal() {
          if (modal) return modal;

          modal = document.createElement('div');
          modal.id = 'raidBossModal';
          modal.className = 'modal';
          modal.setAttribute('role', 'dialog');
          modal.setAttribute('aria-modal', 'true');
          modal.setAttribute('hidden', '');
          modal.innerHTML = `
            <div class="modal__backdrop" data-close="1"></div>
            <div class="modal__dialog" style="max-width: 650px;">
              <header class="modal__header">
                <h3 id="raidBossModalTitle">Detalle del Encuentro</h3>
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
              <div class="modal__body" id="raidBossModalBody" style="max-height: 60vh; overflow-y: auto; scroll-behavior: smooth;">
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

          
            function openBossModal(encounterId, encounterName) {
              var modalEl = ensureModal();
              var titleEl = document.getElementById('raidBossModalTitle');
              var bodyEl = document.getElementById('raidBossModalBody');

              if (!titleEl || !bodyEl) return;

              titleEl.textContent = encounterName;

              var details = BOSS_DETAILS[encounterId] || {
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
              
              var rewardsHtml = renderRewardsList(encounterId, encounterName);

              bodyEl.innerHTML = `
                <div class="raid-tab-content" data-tab="desc" style="display: none; padding: 16px;">
                  <div class="raid-modal-boss-image" style="display: flex; justify-content: center; margin-bottom: 16px;">
                    ${createSafeIcon(details.image, encounterName, 120, 120, '👾')}
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

              // ========== LIMPIAR Y RECONFIGURAR TABS ==========
              var tabBtns = modalEl.querySelectorAll('.raid-modal-tab');
              var contents = modalEl.querySelectorAll('.raid-tab-content');
              
              // 1. QUITAR TODAS las clases active de TODOS los tabs
              tabBtns.forEach(function(btn) {
                btn.classList.remove('active');
              });
              
              // 2. OCULTAR TODOS los contenidos
              contents.forEach(function(content) {
                content.style.display = 'none';
              });
              
              // 3. ACTIVAR SOLO el primer tab y su contenido
              var firstTab = modalEl.querySelector('.raid-modal-tab[data-tab="desc"]');
              var firstContent = modalEl.querySelector('.raid-tab-content[data-tab="desc"]');
              
              if (firstTab) firstTab.classList.add('active');
              if (firstContent) firstContent.style.display = 'block';
              
              // 4. RECONFIGURAR event listeners (eliminando los anteriores)
              var newTabBtns = modalEl.querySelectorAll('.raid-modal-tab');
              newTabBtns.forEach(function(btn) {
                // Clonar para eliminar listeners anteriores
                var freshBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(freshBtn, btn);
                
                freshBtn.addEventListener('click', function() {
                  var tabId = this.getAttribute('data-tab');
                  
                  // Quitar active de TODOS los tabs
                  var allBtns = modalEl.querySelectorAll('.raid-modal-tab');
                  allBtns.forEach(function(b) {
                    b.classList.remove('active');
                  });
                  
                  // Poner active SOLO en el clickeado
                  this.classList.add('active');
                  
                  // Ocultar TODOS los contenidos
                  var allContents = modalEl.querySelectorAll('.raid-tab-content');
                  allContents.forEach(function(c) {
                    c.style.display = 'none';
                  });
                  
                  // Mostrar SOLO el contenido correspondiente
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

    async function loadRaidData(forceNoCache) {
      console.log(LOG, 'loadRaidData iniciado');
      
      var token = getSelectedToken();
      state.token = token;

      if (!ensurePanelContent()) {
        console.error(LOG, 'No se pudo asegurar el contenido del panel');
        return;
      }

      // Mostrar skeleton ANTES de cargar
      showSkeleton();

      if (!token) {
        hideSkeleton();
        var gridContainer = document.getElementById('raidWingsGrid');
        if (gridContainer) {
          gridContainer.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">🔑 Seleccioná una API Key para ver el progreso de raids.<br><small>Requiere permiso "progression"</small></div>';
        }
        renderKPIs(0, 0);
        updateLiDisplay();
        startTimers();
        return;
      }

      state.loading = true;
      state.error = null;
      startTimers();

      try {
        var [completed, liAvailable] = await Promise.all([
          root.GW2Api.getAccountRaids(token, { nocache: !!forceNoCache }),
          loadLiAvailable(token)
        ]);
        
        state.completedEncounters = Array.isArray(completed) ? completed : [];
        state.liAvailable = liAvailable;
        
        console.log(LOG, 'Encuentros completados:', state.completedEncounters.length);
        console.log(LOG, 'LI disponibles:', state.liAvailable);
        
        // Ocultar skeleton y mostrar datos reales
        hideSkeleton();
        renderWingsGrid(state.completedEncounters);
      } catch (error) {
        console.error(LOG, 'Error loading raid data:', error);
        state.error = error.message;
        hideSkeleton();
        var gridContainer = document.getElementById('raidWingsGrid');
        if (gridContainer) {
          gridContainer.innerHTML = `<div class="error" style="text-align: center; padding: 40px; color: #ff9d9d;">❌ Error al cargar datos de raids: ${esc(error.message)}<br><small>Verificá que la API key tenga permiso "progression"</small></div>`;
        }
      } finally {
        state.loading = false;
      }
    }

  async function refresh(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    try {
      _refreshInFlight = loadRaidData(!!forceNoCache);
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

    function activate() {
      if (state.active) return;
      state.active = true;

      console.log(LOG, 'activate()');

      var panel = document.getElementById('raidTrackerPanel');
      if (panel) {
        panel.removeAttribute('hidden');
      }

      ensurePanelContent();
      startTimers();
      
      // Mostrar skeleton en lugar del texto simple
      showSkeleton();
      
      refresh(false);
    }

  function deactivate() {
    if (!state.active) return;
    state.active = false;

    console.log(LOG, 'deactivate()');

    stopTimers();

    var panel = document.getElementById('raidTrackerPanel');
    if (panel) {
      panel.setAttribute('hidden', '');
    }

    closeModal();
  }

  async function prefetch(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) return;
    var token = getSelectedToken();
    if (!token) return;

    try {
      await Promise.all([
        root.GW2Api.getAccountRaids(token, { nocache: false }),
        loadLiAvailable(token)
      ]);
    } catch (e) {
      console.debug(LOG, 'prefetch error (ignored)', e);
    }
  }

  function wireGlobalEvents() {
    document.addEventListener('gn:tokenchange', function() {
      if (!state.active) return;
      console.log(LOG, 'tokenchange detected, reloading...');
      refresh(true);
    });
  }

  function initOnce() {
    if (state.inited) return;
    ensureModal();
    wireGlobalEvents();
    state.inited = true;
    console.log(LOG, 'ready v1.7.0');
  }

  var RaidTracker = {
    initOnce: initOnce,
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    refresh: refresh,
    _debug: function () {
      var panel = document.getElementById('raidTrackerPanel');
      var grid = document.getElementById('raidWingsGrid');
      var kpis = document.getElementById('raidKPIs');
      var modalEl = document.getElementById('raidBossModal');
      var totalEncounters = WINGS.reduce(function (s, w) { return s + w.encounters.length; }, 0);

      return {
        version: '1.7.0',
        inited: state.inited,
        active: state.active,
        token: state.token ? (state.token.slice(0, 8) + '...') : null,
        completedEncounters: state.completedEncounters.length,
        completedIds: state.completedEncounters,
        liAvailable: state.liAvailable,
        loading: state.loading,
        error: state.error,
        dom: {
          panel: !!panel,
          panelVisible: panel ? !panel.hasAttribute('hidden') : false,
          grid: !!grid,
          gridHasContent: grid ? grid.innerHTML.length > 100 : false,
          kpis: !!kpis,
          modal: !!modalEl,
          modalVisible: modalEl ? !modalEl.hasAttribute('hidden') : false
        },
        timers: {
          utc: !!state.utcTimeInterval,
          local: !!state.localTimeInterval,
          reset: !!state.resetInterval
        },
        encounters: {
          total: totalEncounters,
          wings: WINGS.length,
          completedCount: state.completedEncounters.length,
          pendingCount: totalEncounters - state.completedEncounters.length
        },
        refresh: {
          inFlight: !!_refreshInFlight,
          seq: _refreshSeq
        }
      };
    },
    Route: {
      path: 'account/raids',
      mount: activate,
      unmount: deactivate,
      prefetch: prefetch
    }
  };

  root.RaidTracker = RaidTracker;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    initOnce();
  }

  console.info(LOG, 'Módulo cargado v1.7.0');

})(typeof window !== 'undefined' ? window : this);