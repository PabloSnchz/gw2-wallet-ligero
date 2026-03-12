/*!
 * js/activities.js — Panel de Actividades (Diarias / Semanales)
 * v1.2.2-hotfix (2026-03-09)
 *
 * Cambios v1.2.2-hotfix:
 * - Política confirmada: mostrar el nombre de la ubicación (aunque sea POI), pero copiar SIEMPRE el chat-code de un Waypoint cercano.
 * - PSNA: mapping ampliado y normalizado (POI -> WP recomendado mediante resolveChatByName()).
 *
 * Cambios v1.2.1-hotfix:
 * - Fix: escapado HTML correcto (incluye apostrofes) y copia de chat-codes sin entidades (& -> correcto).
 * - PSNA: cache diario en sessionStorage (UTC) + last-win soft.
 * - “Copiar todos” deshabilitado si falta algún chat-code (evita copias incompletas).
 * - Reseteo semanal (weeklyKey + antiqueStoneCount) con weekKeyUTC().
 * - Tabs accesibles con aria-selected.
 * - Mini KPI: barra superior con Ecto (X/4), Piedra (n/5), Llave (✅/❌).
 * - Router-ready: expone Activities.Route y Activities.prefetch.
 *
 * Estado base (v1.2.0):
 * - PSNA: parser HTML de la wiki + fallback Lun..Dom + mapeo Waypoint->chatcode
 * - Ecto: estado ✔/❌ por /v2/account/dailycrafting + metadata items
 * - Heredad: check diario local
 * - Semanales: iconos Llave (36708) y Piedra (96978)
 *
 * Limitaciones de API:
 * - PSNA: no hay endpoint oficial -> wiki HTML + diccionario local para chat-codes.
 * - Llave semanal y Leivas: controles manuales (visual management).
 */

(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // ====== Estado ======
  var state = {
    inited: false,
    active: false,
    token: null,

    // KPI mini
    kpi: {
      ectoDone: 0, // 0..4
      ectoTotal: 4,
      stones: 0,   // 0..5
      key: false   // semanal
    },

    // PSNA
    psnaToday: null,  // [{region, npc, name, wpName, chat}]
    psnaErr: null,

    // Ecto Refinement
    dailyIds: [
      'glob_of_elder_spirit_residue',
      'lump_of_mithrilium',
      'spool_of_silk_weaving_thread',
      'spool_of_thick_elonian_cord'
    ],
    ectoDoneToday: new Set(),
    ectoItems: new Map(),
    _ectoMapItem: {},

    // Toggles locales (persistencia)
    toggles: {
      homeNodesCollected: {}, // reset diario
      weeklyKey: false,       // reset semanal
      antiqueStoneCount: 0,   // reset semanal
      date: null,             // YYYY-MM-DD (local)
      week: null              // YYYY-W## (UTC)
    },

    // Assets Semanales (iconos)
    weeklyAssets: {
      key: null,     // Black Lion Chest Key (36708)
      stone: null,   // Antique Summoning Stone (96978)
      currencies: {} // futuro
    }
  };

  // ====== Utils ======
  function $(s, r){ return (r||document).querySelector(s); }
  function esc(s){
    return String(s||'').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'
    }[m]));
  }
  function copyToClipboard(txt){
    try { navigator.clipboard.writeText(txt); window.toast?.('success','Copiado al portapapeles',{ttl:900}); }
    catch(e){ console.warn(LOG,'clipboard',e); window.prompt('Copiar:', txt); }
  }
  function dayKeyLocal(){
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function dayKeyUTC(){
    var d = new Date();
    var yyyy = d.getUTCFullYear();
    var mm = String(d.getUTCMonth()+1).padStart(2,'0');
    var dd = String(d.getUTCDate()).padStart(2,'0');
    return yyyy+'-'+mm+'-'+dd;
  }
  function weekKeyUTC(){
    // ISO week en UTC
    var now = new Date();
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    var day = d.getUTCDay() || 7; // 1..7 (Lun..Dom ISO)
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2,'0');
  }
  function loadToggles(){
    try {
      var raw = JSON.parse(localStorage.getItem('gn_activities_toggles')||'{}');
      var todayLocal = dayKeyLocal();
      var thisWeek = weekKeyUTC();

      // Reset diario -> home nodes
      if (raw.date !== todayLocal){
        raw.homeNodesCollected = {};
        raw.date = todayLocal;
      }
      // Reset semanal -> llave y piedras
      if (raw.week !== thisWeek){
        raw.week = thisWeek;
        raw.weeklyKey = false;
        raw.antiqueStoneCount = 0;
      }

      state.toggles = Object.assign({
        homeNodesCollected:{}, weeklyKey:false, antiqueStoneCount:0, date: todayLocal, week: thisWeek
      }, raw||{});
    } catch {}
    // KPI base desde toggles
    state.kpi.stones = Number(state.toggles.antiqueStoneCount||0);
    state.kpi.key = !!state.toggles.weeklyKey;
  }
  function saveToggles(){
    try {
      var obj = Object.assign({}, state.toggles, { date: dayKeyLocal(), week: weekKeyUTC() });
      localStorage.setItem('gn_activities_toggles', JSON.stringify(obj));
    } catch {}
  }

// ====== Home Nodes — utilidades & mapas de iconos ======
function detectNodeType(nodeId){
  nodeId = String(nodeId||'').toLowerCase();
  if (/_ore_node$/.test(nodeId) || /_(crystal|obsidian|prismaticite|mursaat|brandstone|mistonium|difluorite)/.test(nodeId)) return 'mining';
  if (/_wood_node$/.test(nodeId) || /petrified_stump|lowland_pine/.test(nodeId)) return 'logging';
  return 'harvest';
}

/** Fetch por Item IDs (rápido y con CORS OK) */
async function fetchItemIcons(ids=[]){
  if (!ids.length) return {};
  const url = `https://api.guildwars2.com/v2/items?ids=${ids.join(',')}`;
  const res = await fetch(url, { mode:'cors' });
  if (!res.ok) return {};
  const arr = await res.json();
  const out = {};
  (arr||[]).forEach(it => { if (it && it.id && it.icon) out[it.id] = { name: it.name, icon: it.icon }; });
  return out;
}

/** Fetch de miniatura desde la wiki por título */
async function fetchWikiThumb(title){
  try{
    const url = `https://wiki.guildwars2.com/api.php?action=query&prop=pageimages&format=json&pithumbsize=64&origin=*&titles=${encodeURIComponent(title)}`;
    const r = await fetch(url, { mode:'cors' });
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const first = Object.values(pages)[0];
    const src = first?.thumbnail?.source || null;
    return src;
  } catch(_) { return null; }
}

/**
 * MAPA 1: nodos -> ItemID (cuando el nodo rinde un item “normal”).
 *      (Preferido por performance y fidelidad del icono oficial)
 * MAPA 2: nodos -> título de wiki (cuando rinde moneda/contenedor u otro).
 *      (Se consulta una miniatura desde la wiki)
 *
 * Clave: el ID de nodo **tal cual** lo devuelve /v2/account/home/nodes (snake).
 */
const HOME_NODE_ITEM_MAP = {
  // MENA (confiables)
  'iron_ore_node':        19699,   // Iron Ore
  'platinum_ore_node':    19702,   // Platinum Ore
  'mithril_ore_node':     19700,   // Mithril Ore
  'orichalcum_ore_node':  19701,   // Orichalcum Ore

  // MADERA (confiables)
  'ancient_wood_node':    19725,   // Ancient Wood Log
  'elder_wood_node':      19723,   // Elder Wood Log
  'hard_wood_node':       19724,   // Hard Wood Log

  // PLANTAS / ALIMENTOS (confiables)
  'omnomberry_node':      12128,   // Omnomberry
  'flaxseed_node':        74090,   // Pile of Flax Seeds
  'quartz_node':          43773,   // Quartz Crystal
  // Sugeridos (si querés que vaya por ItemID en vez de wiki, descomentalos cuando confirmes):
  // 'winterberry_bush':   79899,   // Winterberry
  // 'petrified_stump':    66913,   // Petrified Wood
  // 'difluorite_crystal_cluster_node': 86069, // Difluorite Crystal
  // 'eternal_ice_shard_node': 91917,         // Eternal Ice Shard
  // 'sprocket_generator': 44941,   // Watchwork Sprocket
};

const HOME_NODE_WIKI_TITLES = {
  // === Tu lista completa (cuando no usamos ItemID) ===
  'advanced_cloth_rack':                'Silk Scrap',
  'advanced_leather_rack':              'Thick Leather Section',
  'airship_cargo':                      'Airship Cargo',
  'aurilium_node':                      'Lump of Aurillium',
  'bandit_chest':                       'Bandit Chest',
  'basic_cloth_rack':                   'Cotton Scrap',
  'basic_harvesting_nodes':             'Harvesting Sickle',
  'basic_leather_rack':                 'Rawhide Leather Section',
  'basic_lumber_nodes':                 'Logging Axe',
  'basic_ore_nodes':                    'Mining Pick',
  'bauble_gathering_system':            'Bauble (Super Adventure Box)',
  'black_lion_expedition_board_s4':     'Black Lion Expedition Board',
  'bloodstone_crystals':                'Bloodstone Crystal',
  'bound_hatched_chili_pepper_node':    'Hatched Chili Pepper',
  'brandstone_node':                    'Brandstone',
  'candy_corn_node':                    'Candy Corn',
  'commemorative_dragon_pinata':        'Commemorative Dragon Piñata',
  'crystallized_supply_cache':          'Crystallized Supply Cache',
  'difluorite_crystal_cluster_node':    'Difluorite Crystal',
  'dragon_crystal':                     'Dragon Crystal',
  'eternal_ice_shard_node':             'Eternal Ice Shard',
  'exalted_chest':                      'Exalted Chest',
  'garden_plot_01':                     'Home instance garden plot',
  'garden_plot_02':                     'Home instance garden plot',
  'garden_plot_03':                     'Home instance garden plot',
  'ghost_pepper_node':                  'Ghost Pepper',
  'jade_fragment':                      'Jade Fragment',
  'king_sized_candy_corn':              'Candy Corn',
  'kournan_supply_cache':               'Kournan Supply Cache',
  'krait_obelisk':                      'Krait Obelisk Shard',
  'lotus_node':                         'Lotus',
  'mistborn_mote':                      'Mistborn Mote',
  'mistonium_node':                     'Mistonium',
  'orrian_oyster_node':                 'Orrian Oyster',
  'orrian_truffle_node':                'Orrian Truffle',
  'petrified_stump':                    'Petrified Wood',
  'primordial_orchid':                  'Primordial Orchid',
  'prismaticite_node':                  'Prismaticite Crystal',
  'salvage_pile':                       'Pile of Silky Sand',
  'snow_truffle_node':                  'Snow Truffle',
  'sprocket_generator':                 'Watchwork Sprocket',
  'winterberry_bush':                   'Winterberry',
  'wintersday_tree':                    'Wintersday Tree',

  // También incluyo las que ya están por ItemID (por si preferís forzar wiki):
  // 'iron_ore_node': 'Iron Ore',
  // 'platinum_ore_node': 'Platinum Ore',
  // 'mithril_ore_node': 'Mithril Ore',
  // 'orichalcum_ore_node': 'Orichalcum Ore',
  // 'ancient_wood_node': 'Ancient Wood Log',
  // 'elder_wood_node': 'Elder Wood Log',
  // 'hard_wood_node': 'Hard Wood Log',
  // 'omnomberry_node': 'Omnomberry',
  // 'flaxseed_node': 'Pile of Flax Seeds',
  // 'quartz_node': 'Quartz Crystal',
};

/** Decora las tarjetas del grid con icono y clase por tipo */
async function decorateHomeNodesIcons(unlockedIds){
  const host = document.getElementById('homeNodesGrid');
  if (!host) return;

  // 1) Traer iconos por ItemID (los que tengamos)
  const wantIds = [];
  unlockedIds.forEach(id => { if (HOME_NODE_ITEM_MAP[id]) wantIds.push(HOME_NODE_ITEM_MAP[id]); });
  let byItemId = {};
  try { byItemId = await fetchItemIcons(wantIds); } catch(_){}

  // 2) Por cada tarjeta: setear tipo + icono (ItemID o Wiki), o fallback
  const tasks = [];
  host.querySelectorAll('label.card').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"][data-hn]');
    const nodeId = cb ? cb.getAttribute('data-hn') : '';
    const ico = label.querySelector('.node-icon');
    if (!ico || !nodeId) return;

    // Tipo visual
    const t = detectNodeType(nodeId);
    label.classList.add('hn', `hn--${t}`);

    // A) Intento por ItemID
    const itemId = HOME_NODE_ITEM_MAP[nodeId];
    const meta = itemId ? byItemId[itemId] : null;
    if (meta && meta.icon){
      ico.innerHTML = '';
      const img = document.createElement('img');
      img.src = meta.icon; img.width=22; img.height=22; img.alt='';
      img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer';
      ico.appendChild(img);
      return; // listo
    }

    // B) Intento por título de Wiki
    const title = HOME_NODE_WIKI_TITLES[nodeId];
    if (title){
      tasks.push(
        (async () => {
          const src = await fetchWikiThumb(title);
          if (src && ico.isConnected){
            ico.innerHTML = '';
            const img = document.createElement('img');
            img.src = src; img.width=22; img.height=22; img.alt='';
            img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer';
            ico.appendChild(img);
          } else if (ico.isConnected){
            ico.setAttribute('data-fallback','1');
            ico.textContent = (t==='mining' ? '⛏' : (t==='logging' ? '🪓' : '✂'));
          }
        })()
      );
      return;
    }

    // C) Fallback por tipo
    ico.setAttribute('data-fallback','1');
    ico.textContent = (t==='mining' ? '⛏' : (t==='logging' ? '🪓' : '✂'));
  });

  // Esperar thumbnails wiki (sin bloquear la UI principal)
  try { await Promise.allSettled(tasks); } catch(_){}
}
  
  // ====== Mini KPI ======
  function ensureKPIBar(){
    var el = document.getElementById('activitiesKPI');
    if (!el){
      el = document.createElement('div');
      el.id = 'activitiesKPI';
      el.className = 'kpi-bar';
      el.innerHTML = [
        '<div class="kpi-cards" style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 10px 0">',
          // Ecto
          '<div class="card" style="padding:8px 10px;min-width:180px">',
            '<div class="muted" style="font-size:12px">Refinamiento de Ecto</div>',
            '<div id="kpiEcto" style="font-weight:700;font-size:16px">0/4</div>',
          '</div>',
          // Piedra
          '<div class="card" style="padding:8px 10px;min-width:160px">',
            '<div class="muted" style="font-size:12px">Piedras (Leivas)</div>',
            '<div id="kpiStone" style="font-weight:700;font-size:16px">0/5</div>',
          '</div>',
          // Llave
          '<div class="card" style="padding:8px 10px;min-width:160px">',
            '<div class="muted" style="font-size:12px">Llave semanal</div>',
            '<div id="kpiKey" style="font-weight:700;font-size:16px">❌</div>',
          '</div>',
        '</div>'
      ].join('');
      var panelBody = document.querySelector('#activitiesPanel .panel__body');
      if (panelBody) panelBody.prepend(el);
    }
    return el;
  }
  function updateKPI(){
    ensureKPIBar();
    var ectoDone = 0;
    try {
      for (var i=0;i<state.dailyIds.length;i++){
        if (state.ectoDoneToday.has(String(state.dailyIds[i]))) ectoDone++;
      }
    } catch {}
    state.kpi.ectoDone = ectoDone;

    $('#kpiEcto').textContent = String(state.kpi.ectoDone||0) + '/' + String(state.kpi.ectoTotal||4);
    $('#kpiStone').textContent = String(Number(state.toggles.antiqueStoneCount||0)) + '/5';
    $('#kpiKey').textContent = state.toggles.weeklyKey ? '✅' : '❌';
  }

  // ====== DOM Panel ======
  function ensurePanel(){
    var host = document.getElementById('activitiesPanel');
    if (!host){
      host = document.createElement('section');
      host.id = 'activitiesPanel';
      host.className = 'panel col-main';
      host.setAttribute('hidden','');
      host.innerHTML = [
        '<h2 class="panel__title">Panel de Actividades</h2>',
        '<div class="panel__body">',

          // MINI KPI se inyecta dinámicamente arriba

          '<div class="tabs" role="tablist" aria-label="Actividades">',
            '<button id="actTabDaily" class="btn" role="tab" aria-selected="true">Diarias</button>',
            '<button id="actTabWeekly" class="btn btn--ghost" role="tab" aria-selected="false">Semanales</button>',
          '</div>',

          // ===== DIARIAS =====
          '<div id="actDaily" class="tab-panel" role="tabpanel" aria-labelledby="actTabDaily">',

            '<div class="panel-head"><h3 class="panel-head__title">Agentes de red de suministros del Pacto</h3></div>',
            '<p class="muted">Haz clic en el icono de <strong>Waypoint</strong> para copiar el chat‑code y pegarlo en el juego. ',
              '<button id="psnaCopyAll" class="btn btn--ghost btn--xs">Copiar todos</button></p>',
            '<div id="psnaStatus" class="muted">Cargando ubicaciones…</div>',
            '<div id="psnaGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px"></div>',

            '<hr class="hr-hairline">',

            '<div class="panel-head"><h3 class="panel-head__title">Refinamiento de ectoplasma (1/día)</h3></div>',
            '<div id="ectoStatus" class="muted">Cargando recetas…</div>',
            '<div id="ectoGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px"></div>',

            '<hr class="hr-hairline">',

            '<div class="panel-head"><h3 class="panel-head__title">Nodos de Heredad (estado diario)</h3></div>',
            '<p class="muted">Marcá qué nodos ya recolectaste hoy (persistencia local diaria).</p>',
            '<div id="homeNodesStatus" class="muted">Cargando nodos desbloqueados…</div>',
            '<div id="homeNodesGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px"></div>',

            '<hr class="hr-hairline">',
          '</div>',

          // ===== SEMANALES =====
          '<div id="actWeekly" class="tab-panel" role="tabpanel" aria-labelledby="actTabWeekly" hidden>',

            '<div class="panel-head"><h3 class="panel-head__title">Llave semanal (Partiendo filos)</h3></div>',
            '<p class="muted">Completa <em>“Partiendo filos”</em> (historia personal humana nivel 10, biografía “Rata callejera”) para 1 <strong>Llave del León Negro</strong> por semana. ',
            '<label style="margin-left:10px"><input type="checkbox" id="wkKeyDone"> Hecha esta semana</label></p>',

            '<hr class="hr-hairline">',

            '<div class="panel-head"><h3 class="panel-head__title">Piedra de invocación vetusta — Leivas (Arborstone)</h3></div>',
            '<p class="muted">Semanal: hasta <strong>5</strong> unidades (distintas divisas). ',
              '<label style="margin-left:10px">Compradas: ',
              '<button class="btn btn--xs" id="assMinus">−</button> <span id="assCount">0</span> <button class="btn btn--xs" id="assPlus">+</button></label></p>',
            '<div id="assCurrencies" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:6px 0 6px 0"></div>',
            '<p class="muted" style="margin-top:6px">Waypoint: <button id="assWp" class="btn btn--ghost btn--xs">Copiar Arborstone [&BCEJAAA=]</button></p>',

            '<hr class="hr-hairline">',

            '<div class="panel-head"><h3 class="panel-head__title">Vales de Suministrador</h3></div>',
            '<p class="muted">Próximo: lista de NPCs y cálculo de eficiencia por TP.</p>',
          '</div>',

        '</div>'
      ].join('');

      var anchor = document.getElementById('walletPanel');
      (anchor && anchor.parentNode) ? anchor.parentNode.insertBefore(host, anchor) : document.body.appendChild(host);

      // Tabs accesibles
      $('#actTabDaily').addEventListener('click', function(){
        $('#actDaily').hidden = false; $('#actWeekly').hidden = true;
        this.classList.remove('btn--ghost'); $('#actTabWeekly').classList.add('btn--ghost');
        this.setAttribute('aria-selected','true'); $('#actTabWeekly').setAttribute('aria-selected','false');
      });
      $('#actTabWeekly').addEventListener('click', function(){
        $('#actDaily').hidden = true; $('#actWeekly').hidden = false;
        this.classList.remove('btn--ghost'); $('#actTabDaily').classList.add('btn--ghost');
        this.setAttribute('aria-selected','true'); $('#actTabDaily').setAttribute('aria-selected','false');
      });

      // PSNA: Copiar todos
      $('#psnaCopyAll').addEventListener('click', function(){
        if (!state.psnaToday || !state.psnaToday.length) return;
        var anyMissing = (state.psnaToday||[]).some(x => !x.chat);
        if (anyMissing) return; // deshabilitado si falta alguno
        var txt = state.psnaToday.map(x => x.chat).join(' ');
        copyToClipboard(txt);
      });

      // Semanales toggles/contadores
      $('#wkKeyDone').addEventListener('change', function(){
        state.toggles.weeklyKey = !!this.checked;
        state.kpi.key = state.toggles.weeklyKey;
        saveToggles(); updateKPI();
      });
      $('#assMinus').addEventListener('click', function(){
        state.toggles.antiqueStoneCount = Math.max(0, (state.toggles.antiqueStoneCount||0) - 1);
        state.kpi.stones = state.toggles.antiqueStoneCount;
        saveToggles(); renderASS(); updateKPI();
      });
      $('#assPlus').addEventListener('click', function(){
        state.toggles.antiqueStoneCount = Math.min(5, (state.toggles.antiqueStoneCount||0) + 1);
        state.kpi.stones = state.toggles.antiqueStoneCount;
        saveToggles(); renderASS(); updateKPI();
      });
      $('#assWp').addEventListener('click', function(){
        copyToClipboard('[&BCEJAAA=]'); // Arborstone
      });
    }
    return host;
  }

  // ====== PSNA ======
  var WP_ICON = 'https://wiki.guildwars2.com/images/thumb/d/d2/Waypoint_%28map_icon%29.png/30px-Waypoint_%28map_icon%29.png';

  function psnaCardHTML(row){
    var disabled = row.chat ? '' : ' disabled';
    return [
      '<article class="card">',
        '<div style="display:flex;gap:10px;align-items:center">',
          '<img src="'+WP_ICON+'" width="22" height="22" alt="WP" loading="lazy">',
          '<button class="btn btn--ghost btn--xs" data-psna-copy title="Copiar chat‑code"'+disabled+'>'+esc(row.wpName||'—')+'</button>',
        '</div>',
        '<div class="muted" style="margin-top:6px">',
          '<div><strong>'+esc(row.npc)+'</strong> — '+esc(row.region)+'</div>',
          '<div>'+esc(row.name||'')+'</div>',
        '</div>',
      '</article>'
    ].join('');
  }

  /**
   * Política: mostrar nombre tal cual (POI o WP), pero copiar SIEMPRE un chat-code de Waypoint cercano.
   * PSNA_WP_CHAT contiene claves comunes (WP/POI) => valor = chat-code de Waypoint recomendado.
   * PSNA_ALIASES maneja variantes de nombres que pueda traer el template.
   */
  var PSNA_WP_CHAT = {
    // ===== Maguuma Wastes (Mehem the Traveled) =====
    'Restoration Refuge':'[&BIgHAAA=]',           // Refugio de Restauración (WP DT)
    'Town of Prosperity':'[&BHoHAAA=]',           // Ciudad de Prosperidad (WP DT)
    'Camp Resolve Waypoint':'[&BH8HAAA=]',        // Campamento Determinación (WP Silverwastes)
    'Blue Oasis':'[&BKsHAAA=]',                   // POI -> queda nombre, se copia WP más cercano cuando aplique
    'Ivy Bridge Waypoint':'[&BIYHAAA=]',          // DT (referencia cercana)
    'Repair Station Waypoint':'[&BJcHAAA=]',      // DT (referencia cercana)
    'Azarr’s Arbor':'[&BHQHAAA=]',

    // ===== Maguuma Jungle (The Fox) =====
    'Lionguard Waystation Waypoint':'[&BEwDAAA=]',
    'Desider Atum Waypoint':'[&BEgAAAA=]',
    'Wendon Waypoint':'[&BF0AAAA=]',
    'Swampwatch Post':'[&BLQDAAA=]',              // POI -> usar Mire Waypoint
    'Mire Waypoint':'[&BLQDAAA=]',
    'Bard Waypoint':'[&BMwCAAA=]',                // Monte Vorágine
    'Gauntlet Waypoint':'[&BNMCAAA=]',
    'Mabon Waypoint':'[&BDoBAAA=]',

    // ===== Ruins of Orr (Specialist Yana) =====
    'Fort Trinity Waypoint':'[&BO4CAAA=]',
    'Rally Waypoint':'[&BNIEAAA=]',
    'Waste Hollows Waypoint':'[&BKgCAAA=]',
    'Pagga Waypoint':'[&BKYCAAA=]',
    'Caer Shadowfain':'[&BO4CAAA=]',              // POI -> Fort Trinity WP (proximidad)

    // ===== Kryta (Lady Derwena) =====
    'Altar Brook Trading Post':'[&BEUDAAA=]',     // POI -> Scaver Waypoint
    'Shieldbluff Waypoint':'[&BKYAAAA=]',
    'Marshwatch Haven Waypoint':'[&BKYBAAA=]',
    'Garenhoff':'[&BBEAAAA=]',                    // POI -> Llaganegra WP (ruta útil)
    'Fort Salma Waypoint':'[&BJIBAAA=]',
    'Remanda Waypoint':'[&BKcBAAA=]',
    'Pearl Islet Waypoint':'[&BNUGAAA=]',

    // ===== Shiverpeaks (Despina Katelyn) =====
    'Dolyak Pass Waypoint':'[&BHsBAAA=]',
    'Lornar’s Pass Waypoint':'[&BLQAAAA=]',       // para Mennerheim
    'Mennerheim':'[&BLQAAAA=]',                   // POI -> Lornar WP
    'Stonewright’s Waypoint':'[&BJcBAAA=]',       // Esparcepiedra WP
    'Rocklair':'[&BJcBAAA=]',                     // POI -> Esparcepiedra WP
    'Blue Ice Shining Waypoint':'[&BIUCAAA=]',
    'Ridgerock Camp Waypoint':'[&BIMCAAA=]',
    'Snow Ridge Camp Waypoint':'[&BCECAAA=]',

    // ===== Ascalon (Verma Giftrender) =====
    'Temperus Point Waypoint':'[&BIMBAAA=]',
    'Butcher’s Block Waypoint':'[&BF8BAAA=]',
    'The Hawk’s Gates Waypoint':'[&BNMAAAA=]',
    'Nolan Crest Cliff Waypoint':'[&BFEDAAA=]',   // Fuerte de Crestastilla
    'Ruins of Old Ascalon Waypoint':'[&BOQBAAA=]',
    'Rustbowl Waypoint':'[&BB4CAAA=]',           // Hondonada de Óxido
    'Snowlord’s Gate Waypoint':'[&BCECAAA=]',
    'Ferrusatos Village':'[&BFEDAAA=]',           // POI -> Crestastilla WP
    'Haymal Gore':'[&BB4CAAA=]',                  // POI -> Hondonada de Óxido WP
    'Mudflat Camp':'[&BKcBAAA=]'                  // POI -> Remanda WP
  };

  // Aliases/sinónimos por si el template trae variantes
  var PSNA_ALIASES = {
    'Swampwatch Outpost':'Swampwatch Post',
    'Rock Lair':'Rocklair',
    'Ferrusatos':'Ferrusatos Village',
    'Haymal':'Haymal Gore',
    'Scaver Waypoint':'Altar Brook Trading Post',
    'Remanda':'Mudflat Camp',
    'Lornar Waypoint':"Lornar’s Pass Waypoint"
  };

  function resolveChatByName(name){
    if (!name) return '';
    var k = name.replace(/\s+/g,' ').trim();
    if (PSNA_ALIASES[k]) k = PSNA_ALIASES[k];

    // Hit directo
    if (PSNA_WP_CHAT[k]) return PSNA_WP_CHAT[k];

    // Heurística: si llega "X Waypoint" y no está, probar base
    if (k.endsWith(' Waypoint')) {
      var base = k.slice(0, -9).trim();
      if (PSNA_WP_CHAT[base]) return PSNA_WP_CHAT[base];
    }

    // Si llega un POI poco común, no rompemos: devolvemos vacío (deshabilita botón)
    console.warn(LOG, 'PSNA chat-code faltante para:', name);
    return '';
  }

  // Plan A: parseo HTML del template (MediaWiki API)
  async function fetchPSNAFromWiki(){
    try {
      var url = 'https://wiki.guildwars2.com/api.php?action=parse&page=Template:Pact_Supply_Network_Agent_table&prop=text&format=json&origin=*';
      var r = await fetch(url, { headers: { 'Accept':'application/json' } });
      var j = await r.json();
      var html = j?.parse?.text?.['*'] || '';
      if (!html) throw new Error('No HTML');

      var container = document.createElement('div'); container.innerHTML = html;

      var today = new Date();
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var key = today.getUTCFullYear() + ' ' + months[today.getUTCMonth()] + ' ' + String(today.getUTCDate()).padStart(2,'0');

      var hit = null;
      Array.from(container.querySelectorAll('table tr')).forEach(tr=>{
        if (tr.textContent.includes(key)) hit = tr;
      });
      if (!hit) throw new Error('Row not found for '+key);

      var tds = hit.querySelectorAll('td');
      if (!tds || tds.length < 7) throw new Error('Unexpected columns');

      var regions = ['Maguuma Wastes','Maguuma Jungle','Ruins of Orr','Kryta','Shiverpeaks','Ascalon'];
      var npcs    = ['Mehem the Traveled','The Fox','Specialist Yana','Lady Derwena','Despina Katelyn','Verma Giftrender'];
      var out = [];
      for (var i=1;i<=6;i++){
        var name = (tds[i].textContent||'').trim().replace(/\s+/g,' ');
        // name puede ser POI o WP; resolvemos a WP-code preferido
        out.push({ region: regions[i-1], npc: npcs[i-1], name, wpName: name, chat: resolveChatByName(name) });
      }
      return out;
    } catch(e){
      console.warn(LOG,'PSNA wiki parse (HTML) falló', e);
      throw e;
    }
  }

  // Plan B – Fallback semanal (Lun..Dom) con nombres + chatcodes preferidos (WP)
  var PSNA_FALLBACK = (function(){
    return [
      // Lunes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat: resolveChatByName('Restoration Refuge')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Lionguard Waystation Waypoint',chat: resolveChatByName('Lionguard Waystation Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Rally Waypoint',chat: resolveChatByName('Rally Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Marshwatch Haven Waypoint',chat: resolveChatByName('Marshwatch Haven Waypoint')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Ridgerock Camp Waypoint',chat: resolveChatByName('Ridgerock Camp Waypoint')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Haymal Gore',chat: resolveChatByName('Haymal Gore')}
      ],
      // Martes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Camp Resolve Waypoint',chat: resolveChatByName('Camp Resolve Waypoint')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Desider Atum Waypoint',chat: resolveChatByName('Desider Atum Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Waste Hollows Waypoint',chat: resolveChatByName('Waste Hollows Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Garenhoff',chat: resolveChatByName('Garenhoff')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Mabon Waypoint',chat: resolveChatByName('Mabon Waypoint')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Temperus Point Waypoint',chat: resolveChatByName('Temperus Point Waypoint')}
      ],
      // Miércoles
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Town of Prosperity',chat: resolveChatByName('Town of Prosperity')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Swampwatch Post',chat: resolveChatByName('Swampwatch Post')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Caer Shadowfain',chat: resolveChatByName('Caer Shadowfain')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Shieldbluff Waypoint',chat: resolveChatByName('Shieldbluff Waypoint')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Mennerheim',chat: resolveChatByName('Mennerheim')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Ferrusatos Village',chat: resolveChatByName('Ferrusatos Village')}
      ],
      // Jueves
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Blue Oasis',chat: resolveChatByName('Blue Oasis')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Wendon Waypoint',chat: resolveChatByName('Wendon Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Fort Trinity Waypoint',chat: resolveChatByName('Fort Trinity Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Altar Brook Trading Post',chat: resolveChatByName('Altar Brook Trading Post')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Rocklair',chat: resolveChatByName('Rocklair')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Village of Scalecatch Waypoint',chat: resolveChatByName('Village of Scalecatch Waypoint')}
      ],
      // Viernes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Azarr’s Arbor',chat: resolveChatByName('Azarr’s Arbor')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Mabon Waypoint',chat: resolveChatByName('Mabon Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Fort Trinity Waypoint',chat: resolveChatByName('Fort Trinity Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Mudflat Camp',chat: resolveChatByName('Mudflat Camp')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Blue Ice Shining Waypoint',chat: resolveChatByName('Blue Ice Shining Waypoint')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Snow Ridge Camp Waypoint',chat: resolveChatByName('Snow Ridge Camp Waypoint')}
      ],
      // Sábado
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat: resolveChatByName('Restoration Refuge')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Lionguard Waystation Waypoint',chat: resolveChatByName('Lionguard Waystation Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Rally Waypoint',chat: resolveChatByName('Rally Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Marshwatch Haven Waypoint',chat: resolveChatByName('Marshwatch Haven Waypoint')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Ridgerock Camp Waypoint',chat: resolveChatByName('Ridgerock Camp Waypoint')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Haymal Gore',chat: resolveChatByName('Haymal Gore')}
      ],
      // Domingo
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat: resolveChatByName('Restoration Refuge')},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Desider Atum Waypoint',chat: resolveChatByName('Desider Atum Waypoint')},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Waste Hollows Waypoint',chat: resolveChatByName('Waste Hollows Waypoint')},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Garenhoff',chat: resolveChatByName('Garenhoff')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Mabon Waypoint',chat: resolveChatByName('Mabon Waypoint')},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Temperus Point Waypoint',chat: resolveChatByName('Temperus Point Waypoint')}
      ]
    ];
  })();

  let _psnaRunId = 0;
  async function ensurePSNA(){
    $('#psnaStatus').textContent = 'Cargando ubicaciones…';
    // Cache diario (UTC)
    var cacheKey = 'psna:'+dayKeyUTC();
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        state.psnaToday = JSON.parse(cached);
        renderPSNA();
        $('#psnaStatus').textContent = 'Listo (cache).';
        return;
      }
    } catch {}

    var runId = ++_psnaRunId;
    try {
      var rows = await fetchPSNAFromWiki();
      var fb = psnaFallbackToday();
      var out = [];
      for (var i=0;i<6;i++){
        var r = rows[i] || {};
        var back = fb[i] || {};
        out.push({
          region: r.region || back.region || '',
          npc:    r.npc    || back.npc    || '',
          name:   r.name   || back.name   || '',
          wpName: r.wpName || back.wpName || '',
          chat:   r.chat   || back.chat   || ''
        });
      }
      if (runId !== _psnaRunId) return; // respuesta vieja
      state.psnaToday = out;
      try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch {}
      renderPSNA();
      $('#psnaStatus').textContent = 'Listo.';
    } catch(e){
      if (runId !== _psnaRunId) return;
      var out = psnaFallbackToday();
      if (!out.length){
        $('#psnaStatus').textContent = 'No se pudo obtener la rotación. Reintentá más tarde.';
        state.psnaErr = e;
        return;
      }
      state.psnaToday = out;
      renderPSNA();
      $('#psnaStatus').textContent = 'Listo (fallback).';
    }
  }
  function psnaFallbackToday(){
    var dow = (new Date()).getDay();      // 0=Dom
    var idx = (dow + 6) % 7;              // 0=Lun … 6=Dom
    var row = PSNA_FALLBACK[idx] || [];
    return row.filter(Boolean);
  }
  function renderPSNA(){
    var host = $('#psnaGrid'); if (!host) return;
    host.innerHTML = (state.psnaToday||[]).map(psnaCardHTML).join('');
    var buttons = host.querySelectorAll('[data-psna-copy]');
    buttons.forEach(function(b, idx){
      if (b.__wired) return; b.__wired = true;
      b.__chat = (state.psnaToday[idx]?.chat) || ''; // valor real (evita escaping)
      b.addEventListener('click', function(){
        if (b.__chat) copyToClipboard(b.__chat);
      });
    });
    var any = 0;
    (state.psnaToday||[]).forEach(r => { if (r.chat) any++; });
    var copyAllBtn = document.getElementById('psnaCopyAll');
    if (copyAllBtn) copyAllBtn.disabled = (any < 6);
  }

  // ====== ECTO REFINEMENT ======
  let _ectoRunId = 0;
  async function fetchEctoStatus(token){
    var runId = ++_ectoRunId;
    state.ectoDoneToday.clear();
    try {
      if (token){
        var r = await fetch('https://api.guildwars2.com/v2/account/dailycrafting?access_token='+encodeURIComponent(token));
        var arr = await r.json();
        if (runId !== _ectoRunId) return;
        if (Array.isArray(arr)) arr.forEach(id => state.ectoDoneToday.add(String(id)));
      }
    } catch(e){ console.warn(LOG,'account/dailycrafting', e); }

    try {
      // IDs oficiales (wiki + GW2 Treasures)
      var mapIdToItem = {
        glob_of_elder_spirit_residue: 46744,
        lump_of_mithrilium:           46742,
        spool_of_silk_weaving_thread: 46740,
        spool_of_thick_elonian_cord:  46745
      };
      var ids = Object.values(mapIdToItem).join(',');
      var rr = await fetch('https://api.guildwars2.com/v2/items?ids='+ids+'&lang=es');
      var list = await rr.json();
      if (runId !== _ectoRunId) return;
      (list||[]).forEach(it => state.ectoItems.set(String(it.id), it));
      state._ectoMapItem = mapIdToItem;
    } catch(e){ console.warn(LOG,'items meta', e); }

    updateKPI();
  }
  function ectoCardHTML(apiId, isDone, itMeta){
    var icon = itMeta?.icon ? '<img src="'+esc(itMeta.icon)+'" width="32" height="32" alt="">' : '';
    var name = itMeta?.name || apiId;
    return [
      '<article class="card">',
        '<div style="display:flex;gap:10px;align-items:center">', icon,
        '<div><strong>'+esc(name)+'</strong><div class="muted">'+esc(apiId)+'</div></div>',
        '</div>',
        '<div style="margin-top:6px">',
          isDone ? '<span style="color:#a0ffc8;font-weight:700">✔ Hecho hoy</span>' :
                   '<span style="color:#ff9d9d;font-weight:700">❌ Pendiente</span>',
        '</div>',
      '</article>'
    ].join('');
  }
  function renderEcto(){
    var host = $('#ectoGrid'); if (!host) return;
    var out = [];
    var mapIdToItem = state._ectoMapItem || {};
    state.dailyIds.forEach(function(apiId){
      var itemId = mapIdToItem[apiId];
      var it = itemId ? state.ectoItems.get(String(itemId)) : null;
      var done = state.ectoDoneToday.has(String(apiId));
      out.push(ectoCardHTML(apiId, done, it));
    });
    host.innerHTML = out.join('');
    $('#ectoStatus').textContent = 'Listo.';
  }

  // ====== Home Nodes ======
  let _hnRunId = 0;
  async function fetchHomeNodes(token){
    var host = $('#homeNodesGrid'); if (host) host.innerHTML = '';
    $('#homeNodesStatus').textContent = 'Cargando nodos…';

    var runId = ++_hnRunId;
    var unlocked = [];
    try {
      var r = await fetch('https://api.guildwars2.com/v2/account/home/nodes?access_token='+encodeURIComponent(token));
      unlocked = await r.json();
      if (runId !== _hnRunId) return;
    } catch(e){ console.warn('[Activities] home/nodes', e); }

    if (!Array.isArray(unlocked) || !unlocked.length){
      $('#homeNodesStatus').textContent = 'Sin datos o no hay nodos desbloqueados.';
      return;
    }

    // Render base (checkbox + placeholder)
    var html = unlocked.map(function(id){
      var checked = !!state.toggles.homeNodesCollected[id];
      return '<label class="card" style="display:flex;gap:10px;align-items:center;padding:8px">'+
              '<span class="node-icon" aria-hidden="true" style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;background:linear-gradient(180deg,#2a3342,#18202c);box-shadow:inset 0 0 0 1px #2b3647"></span>'+
              '<input type="checkbox" data-hn="'+esc(id)+'" '+(checked?'checked':'')+' style="margin-left:4px;margin-right:6px" title="Marcar como recolectado hoy">'+
              '<span>'+esc(id.replace(/_/g,' '))+'</span>'+
            '</label>';
    }).join('');
    var g = $('#homeNodesGrid'); if (g) g.innerHTML = html;
    $('#homeNodesStatus').textContent = 'Listo.';

    // Wire checkboxes
    g?.querySelectorAll('input[type="checkbox"][data-hn]').forEach(function(cb){
      if (cb.__wired) return; cb.__wired = true;
      cb.addEventListener('change', function(){
        var k = this.getAttribute('data-hn');
        state.toggles.homeNodesCollected[k] = !!this.checked;
        saveToggles();
      });
    });

    // Decorar iconos + clases por tipo (ItemID -> wiki -> fallback)
    try { await decorateHomeNodesIcons(unlocked); } catch(_){}
  }
  ``

  // ====== Semanales: assets (llave/piedra/divisas) ======
  async function fetchWeeklyAssets(){
    try {
      var itemIds = [36708, 96978]; // Key, Antique Summoning Stone
      var r = await fetch('https://api.guildwars2.com/v2/items?ids='+itemIds.join(',')+'&lang=es');
      var arr = await r.json();
      (arr||[]).forEach(function(it){
        if (it.id===36708) state.weeklyAssets.key   = it;
        if (it.id===96978) state.weeklyAssets.stone = it;
      });
    } catch(e){ console.warn(LOG,'weekly items', e); }
  }
  function renderWeeklyAssets(){
    var wk = $('#actWeekly');
    if (wk && state.weeklyAssets.key){
      var head = wk.querySelector('.panel-head:nth-of-type(1) .panel-head__title');
      if (head && !head.__icon){
        var img = document.createElement('img');
        img.src = state.weeklyAssets.key.icon;
        img.width = 20; img.height = 20; img.alt = '';
        img.loading = 'lazy'; img.style.verticalAlign = '-4px';
        head.prepend(img);
        head.__icon = true;
      }
    }
    if (wk && state.weeklyAssets.stone){
      var head2 = wk.querySelector('.panel-head:nth-of-type(2) .panel-head__title');
      if (head2 && !head2.__icon){
        var img2 = document.createElement('img');
        img2.src = state.weeklyAssets.stone.icon;
        img2.width = 20; img2.height = 20; img2.alt = '';
        img2.loading = 'lazy'; img2.style.verticalAlign = '-4px';
        head2.prepend(img2);
        head2.__icon = true;
      }
    }
    var cur = $('#assCurrencies');
    if (cur && !cur.__filled){
      cur.innerHTML =
        '<div class="card muted">Divisa #1</div><div class="card muted">Divisa #2</div>'+
        '<div class="card muted">Divisa #3</div><div class="card muted">Divisa #4</div>'+
        '<div class="card muted">Divisa #5</div>';
      cur.__filled = true;
    }
  }

  function renderASS(){
    var n = Number(state.toggles.antiqueStoneCount||0);
    $('#assCount').textContent = String(n);
  }

  // ====== Ciclo de vida ======
  async function activate(){
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    ensureKPIBar();
    loadToggles();
    $('#wkKeyDone').checked = !!state.toggles.weeklyKey;
    renderASS();
    updateKPI();

    await fetchWeeklyAssets();
    renderWeeklyAssets();

    state.token = root.__GN__?.getSelectedToken?.() || null;

    ensurePSNA();
    $('#ectoStatus').textContent = 'Cargando…';
    await fetchEctoStatus(state.token);
    renderEcto();

    if (state.token) fetchHomeNodes(state.token);
  }
  function deactivate(){
    state.active = false;
    ensurePanel().setAttribute('hidden','');
  }

  // ====== Prefetch (opt-in desde router) ======
  async function prefetch(ctx){
    try {
      if (ctx?.signal?.aborted) return;
      await Promise.all([
        fetchWeeklyAssets(),
        fetchEctoStatus(ctx?.token || root.__GN__?.getSelectedToken?.() || null)
      ]);
    } catch(_) {}
  }

  // ====== Eventos globales ======
  function wireGlobal(){
    document.addEventListener('gn:tokenchange', async function(ev){
      var tok = ev?.detail?.token || null;
      state.token = tok;
      if (!state.active) return;
      await fetchEctoStatus(state.token);
      renderEcto();
      updateKPI();
      if (state.token) fetchHomeNodes(state.token);
    });
    document.addEventListener('gn:global-refresh', function(){
      if (!state.active) return;
      ensurePSNA();
      if (state.token) fetchHomeNodes(state.token);
      renderWeeklyAssets();
      updateKPI();
    });
  }

  // ====== API pública ======
  var Activities = {
    initOnce: function(){
      if (state.inited) return;
      ensurePanel();
      ensureKPIBar();
      wireGlobal();
      state.inited = true;
      console.info(LOG,'ready v1.2.2-hotfix');
    },
    activate, deactivate,
    prefetch, // opcional para router
    // Para facilitar integración con router.js:
    Route: {
      path: 'account/activities',
      mount: () => Activities.activate(),
      unmount: () => Activities.deactivate(),
      prefetch: (ctx) => Activities.prefetch(ctx)
    }
  };
  root.Activities = Activities;

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', Activities.initOnce);
  else Activities.initOnce();

})(typeof window!=='undefined' ? window : this);