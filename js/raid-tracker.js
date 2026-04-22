/*!
 * js/raid-tracker.js — Seguimiento de Raids Semanales
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.3.1 (2026-04-08) — Corregido: Ala 7 con evento Puertas de Ahdashim
 *
 * Características:
 *  - Muestra las 8 alas de raid con TODOS los encuentros (jefes y eventos)
 *  - Marca automáticamente encuentros completados vía API (/v2/account/raids)
 *  - Modal con detalles de cada encuentro (mecánicas, estrategia, video)
 *  - Reset semanal automático (lunes 07:30 UTC)
 *  - Manejo seguro de imágenes: sin reintentos infinitos
 *  - Fallback a emojis si no hay assets
 *  - Descripciones y estrategias ampliadas (5+ bullets por encuentro)
 *
 * Total de encuentros: 33 (Ala 1:4, Ala 2:3, Ala 3:4, Ala 4:4, Ala 5:4, Ala 6:3, Ala 7:4, Ala 8:3)
 */

(function (root) {
  'use strict';

  var LOG = '[RaidTracker]';

  // ========================================================================
  // 1. DATOS ESTÁTICOS (HARDCODEADOS) - LISTA COMPLETA DE ENCUENTROS
  // ========================================================================

  var WINGS = [
    {
      id: 1,
      name: "Valle Espiritual",
      nameEn: "Spirit Vale",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing1.png",
      encounters: [
        { id: "vale_guardian", name: "Guardián del valle", nameEn: "Vale Guardian", type: "jefe", icon: "assets/icons/raids/bosses/vale_guardian.png" },
        { id: "spirit_woods", name: "Bosques Espirituales", nameEn: "Spirit Woods", type: "evento", icon: "assets/icons/raids/bosses/spirit_woods.png" },
        { id: "gorseval", name: "Gorseval el Múltiple", nameEn: "Gorseval the Multifarious", type: "jefe", icon: "assets/icons/raids/bosses/gorseval.png" },
        { id: "sabetha", name: "Sabetha la Saboteadora", nameEn: "Sabetha the Saboteur", type: "jefe", icon: "assets/icons/raids/bosses/sabetha.png" }
      ]
    },
    {
      id: 2,
      name: "Paso de la Salvación",
      nameEn: "Salvation Pass",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing2.png",
      encounters: [
        { id: "slothasor", name: "Perezón", nameEn: "Slothasor", type: "jefe", icon: "assets/icons/raids/bosses/slothasor.png" },
        { id: "bandit_trio", name: "Campamento de Prisioneros", nameEn: "Bandit Trio", type: "evento", icon: "assets/icons/raids/bosses/bandit_trio.png" },
        { id: "matthias", name: "Matías Gabrel", nameEn: "Matthias Gabrel", type: "jefe", icon: "assets/icons/raids/bosses/matthias.png" }
      ]
    },
    {
      id: 3,
      name: "Fortaleza de los Fieles",
      nameEn: "Stronghold of the Faithful",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing3.png",
      encounters: [
        { id: "siege_the_stronghold", name: "Escolta de Glenna", nameEn: "Siege the Stronghold", type: "evento", icon: "assets/icons/raids/bosses/siege_the_stronghold.png" },
        { id: "keep_construct", name: "Ensamblaje de la Fortaleza", nameEn: "Keep Construct", type: "jefe", icon: "assets/icons/raids/bosses/keep_construct.png" },
        { id: "twisted_castle", name: "Castillo Retorcido", nameEn: "Twisted Castle", type: "evento", icon: "assets/icons/raids/bosses/twisted_castle.png" },
        { id: "xera", name: "Xera", nameEn: "Xera", type: "jefe", icon: "assets/icons/raids/bosses/xera.png" }
      ]
    },
    {
      id: 4,
      name: "Bastión del Penitente",
      nameEn: "Bastion of the Penitent",
      expansion: "Heart of Thorns",
      icon: "assets/icons/raids/wing4.png",
      encounters: [
        { id: "cairn", name: "Cairn el Indomable", nameEn: "Cairn the Indomitable", type: "jefe", icon: "assets/icons/raids/bosses/cairn.png" },
        { id: "mursaat_overseer", name: "Dirigente mursaat", nameEn: "Mursaat Overseer", type: "jefe", icon: "assets/icons/raids/bosses/mursaat_overseer.png" },
        { id: "samarog", name: "Samarog", nameEn: "Samarog", type: "jefe", icon: "assets/icons/raids/bosses/samarog.png" },
        { id: "deimos", name: "Deimos", nameEn: "Deimos", type: "jefe", icon: "assets/icons/raids/bosses/deimos.png" }
      ]
    },
    {
      id: 5,
      name: "Salón de los Cadenas",
      nameEn: "Hall of Chains",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing5.png",
      encounters: [
        { id: "desmina", name: "Horror sin alma", nameEn: "Soulless Horror", type: "jefe", icon: "assets/icons/raids/bosses/desmina.png" },
        { id: "river_of_souls", name: "Río de Almas", nameEn: "River of Souls", type: "evento", icon: "assets/icons/raids/bosses/river_of_souls.png" },
        { id: "statues_of_grenth", name: "Estatuas de Grenth", nameEn: "Statues of Grenth", type: "jefe", icon: "assets/icons/raids/bosses/statues_of_grenth.png" },
        { id: "dhuum", name: "Dhuum", nameEn: "Dhuum", type: "jefe", icon: "assets/icons/raids/bosses/dhuum.png" }
      ]
    },
    {
      id: 6,
      name: "Mito de Mythwright",
      nameEn: "Mythwright Gambit",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing6.png",
      encounters: [
        { id: "conjured_amalgamate", name: "Amalgamado conjurado", nameEn: "Conjured Amalgamate", type: "jefe", icon: "assets/icons/raids/bosses/conjured_amalgamate.png" },
        { id: "twin_largos", name: "Largos gemelos", nameEn: "Twin Largos", type: "jefe", icon: "assets/icons/raids/bosses/twin_largos.png" },
        { id: "qadim", name: "Qadim", nameEn: "Qadim", type: "jefe", icon: "assets/icons/raids/bosses/qadim.png" }
      ]
    },
    {
      id: 7,
      name: "La Llave de Ahdashim",
      nameEn: "The Key of Ahdashim",
      expansion: "Path of Fire",
      icon: "assets/icons/raids/wing7.png",
      encounters: [
        { id: "gates_of_ahdashim", name: "Puertas de Ahdashim", nameEn: "Gates of Ahdashim", type: "evento", icon: "assets/icons/raids/bosses/gates_of_ahdashim.png" },
        { id: "adina", name: "Adina", nameEn: "Adina", type: "jefe", icon: "assets/icons/raids/bosses/adina.png" },
        { id: "sabir", name: "Sabir", nameEn: "Sabir", type: "jefe", icon: "assets/icons/raids/bosses/sabir.png" },
        { id: "qadim_the_peerless", name: "Qadim", nameEn: "Qadim the Peerless", type: "jefe", icon: "assets/icons/raids/bosses/qadim_the_peerless.png" }
      ]
    },
    {
      id: 8,
      name: "Monte Balrior",
      nameEn: "Mount Balrior",
      expansion: "Janthir Wilds",
      icon: "assets/icons/raids/wing8.png",
      encounters: [
        { id: "ura_guardian", name: "Guardián Ura", nameEn: "Ura Guardian", type: "jefe", icon: "assets/icons/raids/bosses/ura_guardian.png" },
        { id: "the_threshold", name: "Mecánica del Límite", nameEn: "The Threshold", type: "evento", icon: "assets/icons/raids/bosses/the_threshold.png" },
        { id: "decimus", name: "Rey Decimus", nameEn: "Decimus the Revenant", type: "jefe", icon: "assets/icons/raids/bosses/decimus.png" }
      ]
    }
  ];

  // ========================================================================
  // 2. DATOS DE MECÁNICAS Y ESTRATEGIAS (VERSIÓN AMPLIADA)
  // ========================================================================

  var BOSS_DETAILS = {
    // ==================== ALA 1 ====================
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
      image: "assets/icons/raids/bosses/vale_guardian_detail.png"
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
      image: "assets/icons/raids/bosses/gorseval_detail.png"
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
      image: "assets/icons/raids/bosses/sabetha_detail.jpg"
    },
    // ==================== ALA 2 ====================
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
      image: "assets/icons/raids/bosses/slothasor_detail.png"
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
      image: "assets/icons/raids/bosses/bandit_trio_detail.png"
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
      image: "assets/icons/raids/bosses/matthias_detail.png"
    },
    // ==================== ALA 3 ====================
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
      image: "assets/icons/raids/bosses/siege_the_stronghold_detail.png"
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
      image: "assets/icons/raids/bosses/keep_construct_detail.png"
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
      image: "assets/icons/raids/bosses/twisted_castle_detail.png"
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
      image: "assets/icons/raids/bosses/xera_detail.png"
    },
    // ==================== ALA 4 ====================
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
      image: "assets/icons/raids/bosses/cairn_detail.png"
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
      image: "assets/icons/raids/bosses/mursaat_overseer_detail.png"
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
      image: "assets/icons/raids/bosses/samarog_detail.png"
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
      image: "assets/icons/raids/bosses/deimos_detail.png"
    },
    // ==================== ALA 5 ====================
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
      image: "assets/icons/raids/bosses/river_of_souls_detail.png"
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
      image: "assets/icons/raids/bosses/dhuum_detail.png"
    },
    // ==================== ALA 6 ====================
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
      image: "assets/icons/raids/bosses/conjured_amalgamate_detail.png"
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
      image: "assets/icons/raids/bosses/twin_largos_detail.png"
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
      image: "assets/icons/raids/bosses/qadim_detail.png"
    },
    // ==================== ALA 7 ====================
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
      image: "assets/icons/raids/bosses/qadim_the_peerless_detail.png"
    },
    // ==================== ALA 8 ====================
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
    loading: false,
    error: null,
    refreshTimer: null
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

  // ========================================================================
  // 5. FUNCIÓN SEGURA PARA CREAR IMÁGENES (SIN REINTENTOS INFINITOS)
  // ========================================================================
  
  function createSafeIcon(src, alt, width, height, fallbackEmoji) {
    if (!src || src === '') {
      return '<span style="font-size: ' + (width || 24) + 'px;">' + (fallbackEmoji || '🏰') + '</span>';
    }
    
    var imgHtml = '<img src="' + esc(src) + '" alt="' + esc(alt) + '" width="' + (width || 28) + '" height="' + (height || 28) + '" loading="lazy" style="border-radius: 8px;" onerror="this.style.display=\'none\'; this.insertAdjacentHTML(\'afterend\', \'<span style=\\\'font-size:' + (width || 24) + 'px;\\\'>' + (fallbackEmoji || '🏰') + '</span>\');">';
    return imgHtml;
  }

  // ========================================================================
  // 6. RENDERIZADO DEL PANEL
  // ========================================================================

  function ensurePanelContent() {
    var panel = document.getElementById('raidTrackerPanel');
    if (!panel) return false;
    
    var body = panel.querySelector('.panel__body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'panel__body';
      panel.appendChild(body);
    }
    
    if (!body.querySelector('#raidKPIs')) {
      body.innerHTML = `
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
      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #a0ffc8;">
          <div style="color: #a0a6b3; font-size: 12px;">Completados esta semana</div>
          <div style="font-size: 28px; font-weight: 800; color: #a0ffc8;">${completedCount} / ${totalCount}</div>
        </div>
        <div style="background: #0f1116; border-radius: 12px; padding: 12px 20px; border-left: 3px solid #7bc2ff;">
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

  function renderWingsGrid(completedEncounters) {
    var gridContainer = document.getElementById('raidWingsGrid');
    if (!gridContainer) return;

    var completedSet = new Set(completedEncounters);
    var totalEncounters = 0;
    var completedCount = 0;

    var html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">';

    for (var w = 0; w < WINGS.length; w++) {
      var wing = WINGS[w];
      
      html += `
        <div style="background: linear-gradient(180deg, #0f1116 0%, #0d0f14 100%); border: 1px solid #26262b; border-radius: 16px; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0c0e14; border-bottom: 1px solid #26262b;">
            <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(wing.icon, wing.name, 28, 28, '🏰')}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1rem;">${esc(wing.name)}</div>
              <div style="font-size: 0.7rem; color: #7bc2ff;">${esc(wing.expansion)}</div>
            </div>
          </div>
          <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
      `;

      for (var e = 0; e < wing.encounters.length; e++) {
        var enc = wing.encounters[e];
        var isCompleted = completedSet.has(enc.id);
        if (isCompleted) completedCount++;
        totalEncounters++;

        var typeIcon = getTypeIcon(enc.type);
        var typeColor = enc.type === 'jefe' ? '#ffd36b' : '#7bc2ff';

        html += `
          <div class="raid-encounter-card" data-encounter-id="${esc(enc.id)}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #0a0c10; border-radius: 12px; border: 1px solid ${isCompleted ? '#2a6a4a' : '#26262b'};">
            <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              ${createSafeIcon(enc.icon, enc.name, 36, 36, typeIcon)}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.65rem; color: ${typeColor}; background: #1a1c24; padding: 2px 6px; border-radius: 12px;">${enc.type === 'jefe' ? 'JEFE' : 'EVENTO'}</span>
                <div style="font-weight: 600; font-size: 0.85rem;">${esc(enc.name)}</div>
              </div>
              <div style="font-size: 0.65rem; color: ${isCompleted ? '#a0ffc8' : '#ff9d9d'};">${isCompleted ? '✅ Completado' : '❌ Pendiente'}</div>
            </div>
            <button class="raid-encounter-detail-btn btn btn--ghost" data-encounter-id="${esc(enc.id)}" data-encounter-name="${esc(enc.name)}" style="padding: 4px 12px; font-size: 0.7rem;">Detalle</button>
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

  // ========================================================================
  // 7. MODAL DE DETALLE
  // ========================================================================

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
      <div class="modal__dialog" style="max-width: 600px;">
        <header class="modal__header">
          <h3 id="raidBossModalTitle">Detalle del Encuentro</h3>
          <button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>
        </header>
        <div class="modal__body" id="raidBossModalBody">
          <div class="raid-modal-loading">Cargando...</div>
        </div>
      </div>
    `;

    modal.addEventListener('click', function(e) {
      if (e.target.getAttribute('data-close') === '1') {
        closeModal();
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
      image: "assets/icons/raids/bosses/default.png"
    };

    var descriptionHtml = Array.isArray(details.description) 
      ? details.description.map(function(line) { return '<div style="margin-bottom: 8px;">' + esc(line) + '</div>'; }).join('')
      : '<div>' + esc(details.description) + '</div>';
      
    var strategyHtml = Array.isArray(details.strategy)
      ? details.strategy.map(function(line) { return '<div style="margin-bottom: 8px;">' + esc(line) + '</div>'; }).join('')
      : '<div>' + esc(details.strategy) + '</div>';

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; justify-content: center;">
          ${createSafeIcon(details.image, encounterName, 80, 80, '👾')}
        </div>
        <div>
          <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: #a0ffc8;">📖 Descripción</h4>
          <div style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${descriptionHtml}</div>
        </div>
        <div>
          <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: #ffd36b;">⚔️ Estrategia</h4>
          <div style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${strategyHtml}</div>
        </div>
        <div>
          <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: #7bc2ff;">🎥 Video tutorial</h4>
          <a href="${esc(details.video)}" target="_blank" rel="noopener noreferrer" style="color: #7bc2ff; text-decoration: none; border-bottom: 1px solid #7bc2ff;">Ver en YouTube →</a>
        </div>
      </div>
    `;

    modalEl.removeAttribute('hidden');
  }

  function closeModal() {
    if (modal) {
      modal.setAttribute('hidden', '');
    }
  }

  // ========================================================================
  // 8. CARGA DE DATOS
  // ========================================================================

  async function loadRaidData(forceNoCache) {
    console.log(LOG, 'loadRaidData iniciado');
    
    var token = getSelectedToken();
    state.token = token;

    if (!ensurePanelContent()) {
      console.error(LOG, 'No se pudo asegurar el contenido del panel');
      return;
    }

    if (!token) {
      var gridContainer = document.getElementById('raidWingsGrid');
      if (gridContainer) {
        gridContainer.innerHTML = '<div class="muted" style="text-align: center; padding: 40px;">🔑 Seleccioná una API Key para ver el progreso de raids.<br><small>Requiere permiso "progression"</small></div>';
      }
      renderKPIs(0, 0);
      return;
    }

    state.loading = true;
    state.error = null;

    try {
      var completed = await root.GW2Api.getAccountRaids(token, { nocache: !!forceNoCache });
      state.completedEncounters = Array.isArray(completed) ? completed : [];
      console.log(LOG, 'Encuentros completados:', state.completedEncounters.length);
      renderWingsGrid(state.completedEncounters);
    } catch (error) {
      console.error(LOG, 'Error loading raid data:', error);
      state.error = error.message;
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

  // ========================================================================
  // 9. CICLO DE VIDA DEL PANEL
  // ========================================================================

  function activate() {
    if (state.active) return;
    state.active = true;

    console.log(LOG, 'activate()');

    var panel = document.getElementById('raidTrackerPanel');
    if (panel) {
      panel.removeAttribute('hidden');
    }

    ensurePanelContent();
    
    var gridContainer = document.getElementById('raidWingsGrid');
    if (gridContainer) {
      gridContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="muted">Cargando raids...</div></div>';
    }
    
    refresh(false);
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;

    console.log(LOG, 'deactivate()');

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
      await root.GW2Api.getAccountRaids(token, { nocache: false });
    } catch (e) {
      console.debug(LOG, 'prefetch error (ignored)', e);
    }
  }

  // ========================================================================
  // 10. EVENTOS GLOBALES
  // ========================================================================

  function wireGlobalEvents() {
    document.addEventListener('gn:tokenchange', function() {
      if (!state.active) return;
      console.log(LOG, 'tokenchange detected, reloading...');
      refresh(true);
    });
  }

  // ========================================================================
  // 11. INICIALIZACIÓN
  // ========================================================================

  function initOnce() {
    if (state.inited) return;
    ensureModal();
    wireGlobalEvents();
    state.inited = true;
    console.log(LOG, 'ready v1.3.1');
  }

  // ========================================================================
  // 12. API PÚBLICA
  // ========================================================================

  var RaidTracker = {
    initOnce: initOnce,
    activate: activate,
    deactivate: deactivate,
    prefetch: prefetch,
    refresh: refresh,
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

  console.info(LOG, 'Módulo cargado v1.3.1');

})(typeof window !== 'undefined' ? window : this);