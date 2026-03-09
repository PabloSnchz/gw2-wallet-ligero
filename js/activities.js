/*!
 * js/activities.js — Panel de Actividades (Diarias / Semanales)
 * v1.2.0 (2026-03-06)
 * - PSNA: parser HTML de la tabla del wiki + fallback (Lun..Dom) + mapeo Waypoint->chatcode
 * - Ecto: IDs correctos para los 4 time-gated + estado ✔/❌ por /v2/account/dailycrafting
 * - Heredad: movida a Diarias, check diario con persistencia local
 * - Semanales: iconos para Llave (36708) y Piedra (96978) + slots de divisas
 *
 * Limitaciones de API (diseño “gestión visual”):
 *   - PSNA: no hay endpoint oficial para ubicaciones diarias → usamos wiki; chat-links 0x04 documentados.
 *   - Llave semanal: no existe endpoint “hecha esta semana” → toggle semanal manual (wiki documenta la regla).
 *   - Heredad: API no reporta “recolectado hoy” → toggle diario manual; API solo lista desbloqueos.
 *   - Leivas (5/semana): API no indica compras al vendor → contador manual; (wallet-check en próxima iteración).
 */
(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // ====== Estado ======
  var state = {
    inited: false,
    active: false,
    token: null,

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
      homeNodesCollected: {}, // por id de nodo
      weeklyKey: false,       // “Partiendo filos” hecho esta semana
      antiqueStoneCount: 0    // 0..5 compradas a Leivas
      
    },

    // Assets Semanales (iconos)
    weeklyAssets: {
      key: null,     // Black Lion Chest Key (36708)
      stone: null,   // Antique Summoning Stone (96978)
      currencies: {} // futuro: id-> {icon,name}
    }
  };

  // ====== Utils ======
  function $(s, r){ return (r||document).querySelector(s); }
  function esc(s){ return String(s||'').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }
  function copyToClipboard(txt){
    try { navigator.clipboard.writeText(txt); window.toast?.('success','Copiado al portapapeles',{ttl:900}); }
    catch(e){ console.warn(LOG,'clipboard',e); window.prompt('Copiar:', txt); }
  }
  function dayKeyLocal(){
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function loadToggles(){
    try {
      var raw = JSON.parse(localStorage.getItem('gn_activities_toggles')||'{}');
      if (raw.date !== dayKeyLocal()){
        raw.homeNodesCollected = {};
        raw.date = dayKeyLocal();
      }
      state.toggles = Object.assign({homeNodesCollected:{},weeklyKey:false,antiqueStoneCount:0,date:dayKeyLocal()}, raw||{});
    } catch {}
  }
  function saveToggles(){
    try { localStorage.setItem('gn_activities_toggles', JSON.stringify(Object.assign({}, state.toggles, { date: dayKeyLocal() }))); } catch {}
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

      // Tabs
      $('#actTabDaily').addEventListener('click', function(){
        $('#actDaily').hidden = false; $('#actWeekly').hidden = true;
        this.classList.remove('btn--ghost'); $('#actTabWeekly').classList.add('btn--ghost');
      });
      $('#actTabWeekly').addEventListener('click', function(){
        $('#actDaily').hidden = true; $('#actWeekly').hidden = false;
        this.classList.remove('btn--ghost'); $('#actTabDaily').classList.add('btn--ghost');
      });

      // PSNA: Copiar todos
      $('#psnaCopyAll').addEventListener('click', function(){
        if (!state.psnaToday || !state.psnaToday.length) return;
        var txt = state.psnaToday.map(x => x.chat).join(' ');
        copyToClipboard(txt);
      });

      // Semanales toggles/contadores
      $('#wkKeyDone').addEventListener('change', function(){
        state.toggles.weeklyKey = !!this.checked; saveToggles();
      });
      $('#assMinus').addEventListener('click', function(){
        state.toggles.antiqueStoneCount = Math.max(0, (state.toggles.antiqueStoneCount||0) - 1);
        saveToggles(); renderASS();
      });
      $('#assPlus').addEventListener('click', function(){
        state.toggles.antiqueStoneCount = Math.min(5, (state.toggles.antiqueStoneCount||0) + 1);
        saveToggles(); renderASS();
      });
      $('#assWp').addEventListener('click', function(){
        copyToClipboard('[&BCEJAAA=]'); // Arborstone
      });
    }
    return host;
  }

  // ====== PSNA ======
  var WP_ICON = 'https://wiki.guildwars2.com/images/2/2f/Waypoint_%28map_icon%29.png';

  function psnaCardHTML(row){
    var disabled = row.chat ? '' : ' disabled';
    return [
      '<article class="card">',
        '<div style="display:flex;gap:10px;align-items:center">',
          '<img src="'+WP_ICON+'" width="22" height="22" alt="WP" loading="lazy">',
          '<button class="btn btn--ghost btn--xs" data-psna-copy="'+esc(row.chat)+'" title="Copiar chat‑code"'+disabled+'>'+esc(row.wpName||'—')+'</button>',
        '</div>',
        '<div class="muted" style="margin-top:6px">',
          '<div><strong>'+esc(row.npc)+'</strong> — '+esc(row.region)+'</div>',
          '<div>'+esc(row.name||'')+'</div>',
        '</div>',
      '</article>'
    ].join('');
  }

  // Mapeo conocido de Waypoint->chatcode (lista viva)
  var PSNA_WP_CHAT = {
    'Restoration Refuge':'[&BIcHAAA=]',
    'Blue Oasis':'[&BKsHAAA=]',
    'Town of Prosperity':'[&BH4HAAA=]',
    'Azarr’s Arbor':'[&BHQHAAA=]',
    'Desider Atum Waypoint':'[&BEgAAAA=]',
    'Wendon Waypoint':'[&BF0AAAA=]',
    'Swampwatch Post':'[&BMIBAAA=]',
    'Lionguard Waystation Waypoint':'[&BEwDAAA=]',
    'Waste Hollows Waypoint':'[&BKgCAAA=]',
    'Fort Trinity Waypoint':'[&BO4CAAA=]',
    'Rally Waypoint':'[&BNIEAAA=]',
    'Caer Shadowfain':'[&BP0CAAA=]',
    'Garenhoff':'[&BBkAAAA=]',
    'Shieldbluff Waypoint':'[&BKYAAAA=]',
    'Marshwatch Haven Waypoint':'[&BKYBAAA=]',
    'Travelen’s Waypoint':'[&BGQCAAA=]',
    'Rocklair':'[&BF0GAAA=]',
    'Temperus Point Waypoint':'[&BIMBAAA=]',
    'Village of Scalecatch Waypoint':'[&BOcBAAA=]',
    'Mennerheim':'[&BDgDAAA=]',
    'Ridgerock Camp Waypoint':'[&BIMCAAA=]',
    'Haymal Gore':'[&BA8CAAA=]',
    'Ferrusatos Village':'[&BPEBAAA=]',
    'Mabon Waypoint':'[&BOQBAAA=]',
    'Camp Resolve Waypoint':'[&BH8HAAA=]',
    'Blue Ice Shining Waypoint':'[&BKoCAAA=]',
    'Snow Ridge Camp Waypoint':'[&BFMCAAA=]'
  };
  function resolveChatByName(name){
    if (!name) return '';
    var k = name.replace(/\s+/g,' ').trim();
    return PSNA_WP_CHAT[k] || '';
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
        out.push({ region: regions[i-1], npc: npcs[i-1], name, wpName: name, chat: resolveChatByName(name) });
      }
      return out;
    } catch(e){
      console.warn(LOG,'PSNA wiki parse (HTML) falló', e);
      throw e;
    }
  }

  // Plan B – Fallback semanal (Lun..Dom) con chatcodes
  var PSNA_FALLBACK = (function(){
    return [
      // Lunes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat:'[&BIcHAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Lionguard Waystation Waypoint',chat:'[&BEwDAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Rally Waypoint',chat:'[&BNIEAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Marshwatch Haven Waypoint',chat:'[&BKYBAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Ridgerock Camp Waypoint',chat:'[&BIMCAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Haymal Gore',chat:'[&BA8CAAA=]'}
      ],
      // Martes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Camp Resolve Waypoint',chat:'[&BH8HAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Desider Atum Waypoint',chat:'[&BEgAAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Waste Hollows Waypoint',chat:'[&BKgCAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Garenhoff',chat:'[&BBkAAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Travelen’s Waypoint',chat:'[&BGQCAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Temperus Point Waypoint',chat:'[&BIMBAAA=]'}
      ],
      // Miércoles
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Town of Prosperity',chat:'[&BH4HAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Swampwatch Post',chat:'[&BMIBAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Caer Shadowfain',chat:'[&BP0CAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Shieldbluff Waypoint',chat:'[&BKYAAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Mennerheim',chat:'[&BDgDAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Ferrusatos Village',chat:'[&BPEBAAA=]'}
      ],
      // Jueves
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Blue Oasis',chat:'[&BKsHAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Wendon Waypoint',chat:'[&BF0AAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Fort Trinity Waypoint',chat:'[&BO4CAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Altar Brook Trading Post',chat:'[&BIMAAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Rocklair',chat:'[&BF0GAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Village of Scalecatch Waypoint',chat:'[&BOcBAAA=]'}
      ],
      // Viernes
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Azarr’s Arbor',chat: resolveChatByName('Azarr’s Arbor') },
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Mabon Waypoint',chat:'[&BOQBAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Fort Trinity Waypoint',chat:'[&BO4CAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Mudflat Camp',chat: resolveChatByName('Mudflat Camp')},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Blue Ice Shining Waypoint',chat:'[&BKoCAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Snow Ridge Camp Waypoint',chat:'[&BFMCAAA=]'}
      ],
      // Sábado
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat:'[&BIcHAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Lionguard Waystation Waypoint',chat:'[&BEwDAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Rally Waypoint',chat:'[&BNIEAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Marshwatch Haven Waypoint',chat:'[&BKYBAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Ridgerock Camp Waypoint',chat:'[&BIMCAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Haymal Gore',chat:'[&BA8CAAA=]'}
      ],
      // Domingo
      [
        {region:'Maguuma Wastes',npc:'Mehem the Traveled',wpName:'Restoration Refuge',chat:'[&BIcHAAA=]'},
        {region:'Maguuma Jungle',npc:'The Fox',wpName:'Desider Atum Waypoint',chat:'[&BEgAAAA=]'},
        {region:'Ruins of Orr',npc:'Specialist Yana',wpName:'Waste Hollows Waypoint',chat:'[&BKgCAAA=]'},
        {region:'Kryta',npc:'Lady Derwena',wpName:'Garenhoff',chat:'[&BBkAAAA=]'},
        {region:'Shiverpeaks',npc:'Despina Katelyn',wpName:'Travelen’s Waypoint',chat:'[&BGQCAAA=]'},
        {region:'Ascalon',npc:'Verma Giftrender',wpName:'Temperus Point Waypoint',chat:'[&BIMBAAA=]'}
      ]
    ];
  })();

  async function ensurePSNA(){
    $('#psnaStatus').textContent = 'Cargando ubicaciones…';
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
      state.psnaToday = out;
      renderPSNA();
      $('#psnaStatus').textContent = 'Listo.';
    } catch(e){
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
    host.querySelectorAll('[data-psna-copy]').forEach(b=>{
      if (b.__wired) return; b.__wired = true;
      b.addEventListener('click', ()=> copyToClipboard(b.getAttribute('data-psna-copy')));
    });
    var any = 0;
    (state.psnaToday||[]).forEach(r => { if (r.chat) any++; });
    var copyAllBtn = document.getElementById('psnaCopyAll');
    if (copyAllBtn) copyAllBtn.disabled = (any < 6);
  }

  // ====== ECTO REFINEMENT ======
  async function fetchEctoStatus(token){
    state.ectoDoneToday.clear();
    try {
      if (token){
        var r = await fetch('https://api.guildwars2.com/v2/account/dailycrafting?access_token='+encodeURIComponent(token));
        var arr = await r.json();
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
      (list||[]).forEach(it => state.ectoItems.set(String(it.id), it));
      state._ectoMapItem = mapIdToItem;
    } catch(e){ console.warn(LOG,'items meta', e); }
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

  // ====== Home Nodes (desbloqueados) ======
  async function fetchHomeNodes(token){
    var host = $('#homeNodesGrid'); if (host) host.innerHTML = '';
    $('#homeNodesStatus').textContent = 'Cargando nodos…';

    var unlocked = [];
    try {
      var r = await fetch('https://api.guildwars2.com/v2/account/home/nodes?access_token='+encodeURIComponent(token));
      unlocked = await r.json();
    } catch(e){ console.warn(LOG,'home/nodes', e); }

    if (!Array.isArray(unlocked) || !unlocked.length){
      $('#homeNodesStatus').textContent = 'Sin datos o no hay nodos desbloqueados.';
      return;
    }

    var html = unlocked.map(id=>{
      var checked = !!state.toggles.homeNodesCollected[id];
      return '<label class="card" style="display:flex;gap:10px;align-items:center;padding:8px">'+
               '<span class="node-icon" aria-hidden="true" style="width:22px;height:22px;display:inline-block;border-radius:4px;background:linear-gradient(180deg,#2a3342,#18202c);box-shadow:inset 0 0 0 1px #2b3647"></span>'+
               '<input type="checkbox" data-hn="'+esc(id)+'" '+(checked?'checked':'')+' style="margin-left:4px;margin-right:6px" title="Marcar como recolectado hoy">'+
               '<span>'+esc(id.replace(/_/g,' '))+'</span>'+
             '</label>';
    }).join('');
    var g = $('#homeNodesGrid'); if (g) g.innerHTML = html;
    $('#homeNodesStatus').textContent = 'Listo.';

    g?.querySelectorAll('input[type="checkbox"][data-hn]').forEach(cb=>{
      if (cb.__wired) return; cb.__wired = true;
      cb.addEventListener('change', function(){
        var k = this.getAttribute('data-hn');
        state.toggles.homeNodesCollected[k] = !!this.checked;
        saveToggles();
      });
    });
  }

  // ====== Semanales: assets (llave/piedra/divisas) ======
  async function fetchWeeklyAssets(){
    try {
      var itemIds = [36708, 96978]; // Key, Antique Summoning Stone
      var r = await fetch('https://api.guildwars2.com/v2/items?ids='+itemIds.join(',')+'&lang=es');
      var arr = await r.json();
      (arr||[]).forEach(it=>{
        if (it.id===36708) state.weeklyAssets.key   = it;
        if (it.id===96978) state.weeklyAssets.stone = it;
      });
    } catch(e){ console.warn(LOG,'weekly items', e); }

    // Divisas: preparado para futura lectura (/v2/currencies) y wallet-check
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
    loadToggles();
    $('#wkKeyDone').checked = !!state.toggles.weeklyKey;
    renderASS();
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

  // ====== Eventos globales ======
  function wireGlobal(){
    document.addEventListener('gn:tokenchange', async function(ev){
      var tok = ev?.detail?.token || null;
      state.token = tok;
      if (!state.active) return;
      await fetchEctoStatus(state.token);
      renderEcto();
      if (state.token) fetchHomeNodes(state.token);
    });
    document.addEventListener('gn:global-refresh', function(){
      if (!state.active) return;
      ensurePSNA();
      if (state.token) fetchHomeNodes(state.token);
      renderWeeklyAssets();
    });
  }

  // ====== API pública ======
  var Activities = {
    initOnce: function(){
      if (state.inited) return;
      ensurePanel();
      wireGlobal();
      state.inited = true;
      console.info(LOG,'ready v1.2.0');
    },
    activate, deactivate
  };
  root.Activities = Activities;

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', Activities.initOnce);
  else Activities.initOnce();

})(typeof window!=='undefined' ? window : this);