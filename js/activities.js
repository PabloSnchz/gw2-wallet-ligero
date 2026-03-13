/*!
 * js/activities.js — Panel de Actividades (Diarias / Semanales)
 * v1.4.2 (2026-03-13)
 *
 * Hotfix v1.4.2:
 * - Blindaje de activate() por etapas (try/catch independientes).
 * - Timeouts con Promise.race para PSNA y Fractales (hoy) → no quedan “Cargando…” indefinidamente.
 * - World Bosses: render inmediato antes de llamadas remotas.
 * - Mantiene todas las invariantes del BAI.
 */

(function (root) {
  'use strict';
  var LOG = '[Activities]';

  // ====== Estado ======
  var state = {
    inited: false,
    active: false,
    token: null,

    // KPI (diario/semanal)
    kpi: { ectoDone: 0, ectoTotal: 4, stones: 0, key: false },

    // PSNA
    psnaToday: null,  // [{region, npc, name, wpName, chat}]
    psnaErr: null,

    // Ecto (daily crafting)
    dailyIds: [
      'glob_of_elder_spirit_residue',
      'lump_of_mithrilium',
      'spool_of_silk_weaving_thread',
      'spool_of_thick_elonian_cord'
    ],
    ectoDoneToday: new Set(),
    ectoItems: new Map(),
    _ectoMapItem: {},

    // Fractales (hoy / mañana)
    fractals: {
      status: 'idle',             // idle|loading|ready|error  (sólo HOY)
      error: null,
      today:   { t4: [], rec: [] },
      tomorrow:{ t4: [], rec: [] } // “Mañana” no usa status global
    },

    // World Bosses (próximos)
    worldBosses: {
      status: 'idle',             // idle|ready
      next: []                    // [{atLocalStr, atUTCStr, name, chat}]
    },

    // Toggles locales (persistencias)
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
    },

    // Cache UI
    _lastHomeNodes: []
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
  function pad2(n){ return String(n).padStart(2,'0'); }
  function dayKeyLocal(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function dayKeyUTC(){ var d=new Date(); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
  function weekKeyUTC(){
    var now = new Date();
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2,'0');
  }

  // Idle seguro
  var requestIdle = (typeof window!=='undefined' && window.requestIdleCallback) ?
    window.requestIdleCallback :
    function(cb){ return setTimeout(function(){ cb({ didTimeout:false, timeRemaining:function(){return 0;} }); }, 250); };

  // Helpers de timeout
  function withTimeout(promise, ms, label){
    return Promise.race([
      promise,
      new Promise((_,rej)=> setTimeout(()=> rej(new Error('Timeout '+(label||'task')+' '+ms+'ms')), ms))
    ]);
  }

  // ===== Cache de thumbnails de Wiki (localStorage) =====
  const WIKI_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 días
  const WIKI_CACHE_KEY = 'gn:wiki:thumbs';
  function wikiCacheLoad(){ try { return JSON.parse(localStorage.getItem(WIKI_CACHE_KEY) || '{}'); } catch { return {}; } }
  function wikiCacheSave(map){ try { localStorage.setItem(WIKI_CACHE_KEY, JSON.stringify(map)); } catch {} }
  function wikiCacheGet(title){ const map=wikiCacheLoad(); const e=map[title]; return (e&&e.src&&e.expires>Date.now())?e.src:null; }
  function wikiCacheSet(title, src){
    if (!src) return;
    const map = wikiCacheLoad(); map[title]={src,expires:Date.now()+WIKI_TTL_MS};
    const keys = Object.keys(map);
    if (keys.length>200){
      keys.sort((a,b)=>map[a].expires-map[b].expires);
      while (keys.length && Object.keys(map).length>200){ delete map[keys.shift()]; }
    }
    wikiCacheSave(map);
  }
  async function fetchWikiThumb(title){
    if (!title) return null;
    const hit = wikiCacheGet(title); if (hit) return hit;
    try{
      const url = `https://wiki.guildwars2.com/api.php?action=query&prop=pageimages&format=json&pithumbsize=64&origin=*&titles=${encodeURIComponent(title)}`;
      const r = await fetch(url, { mode:'cors' }); if (!r.ok) return null;
      const j = await r.json();
      const pages = j?.query?.pages || {};
      const src = Object.values(pages)[0]?.thumbnail?.source || null;
      if (src) wikiCacheSet(title, src);
      return src;
    } catch(_) { return null; }
  }

  // ====== Fractales (hoy / mañana) ======
  let _fractRunId = 0;
  async function fetchFractalsDaily(which){
    const runId = ++_fractRunId;
    const isTomorrow = which === 'tomorrow';
    const catUrl = isTomorrow
      ? 'https://api.guildwars2.com/v2/achievements/categories/88?v=latest'
      : 'https://api.guildwars2.com/v2/achievements/categories/88';

    if (!isTomorrow){ state.fractals.status='loading'; state.fractals.error=null; }

    try{
      // Cat + detalles (chunk 100)
      const catRes = await fetch(catUrl, { headers: { 'Accept':'application/json' }});
      const cat = await catRes.json();
      const ids = Array.isArray(cat?.achievements) ? cat.achievements.slice() : [];
      if (!ids.length) throw new Error('Fractals category empty');

      const chunks=[]; for (let i=0;i<ids.length;i+=100) chunks.push(ids.slice(i,i+100));
      const details=[];
      for (const ch of chunks){
        const url = 'https://api.guildwars2.com/v2/achievements?ids='+ch.join(',')+'&lang=en';
        const r = await fetch(url, { headers: { 'Accept':'application/json' }});
        const arr = await r.json(); if (Array.isArray(arr)) details.push(...arr);
      }

      const t4=[], recScales=[];
      details.forEach(a=>{
        const name=a?.name||'';
        if (name.startsWith('Daily Tier 4 ')) t4.push(name.replace('Daily Tier 4 ','').trim());
        else if (name.startsWith('Daily Recommended Fractal')){
          const m = name.match(/\d+/g); if (m&&m.length) recScales.push(m.join(','));
        }
      });

      if (runId!==_fractRunId) return;
      const data={ t4, rec: recScales };
      if (isTomorrow) state.fractals.tomorrow=data; else { state.fractals.today=data; state.fractals.status='ready'; }
    } catch(e){
      if (runId!==_fractRunId) return;
      if (!isTomorrow){ state.fractals.status='error'; state.fractals.error=e; }
      console.warn(LOG,'fractals '+which, e);
    }
  }

  function renderFractalsDaily(){
    const host = $('#fractalsBody'); if (!host) return;

    // HOY
    if (state.fractals.status==='loading'){
      host.classList.add('muted'); host.textContent='Cargando fractales…';
    } else if (state.fractals.status==='error'){
      host.classList.add('muted');
      host.innerHTML = 'No se pudieron cargar los fractales. ';
      const btn = document.createElement('button');
      btn.className='btn btn--xs'; btn.textContent='Reintentar';
      btn.addEventListener('click', async ()=>{
        try { await withTimeout(fetchFractalsDaily('today'), 3500, 'fractals today'); } catch(_){}
        renderFractalsDaily();
      });
      host.appendChild(btn);
    } else {
      const t4 = state.fractals.today.t4 || [];
      const rec = state.fractals.today.rec || [];
      const t4Html = t4.length?('<ul class="list">'+t4.map(n=>'<li>• '+esc(n)+'</li>').join('')+'</ul>'):'<div class="muted">—</div>';
      const recHtml = rec.length?('<div class="muted">Recomendados (escalas): '+esc(rec.join(', '))+'</div>'):'<div class="muted">Recomendados (escalas): —</div>';

      host.classList.remove('muted');
      host.innerHTML =
        '<div><strong>T4</strong></div>'+ t4Html +
        '<div style="margin-top:6px">'+ recHtml +'</div>'+
        '<div id="fractalsTomorrowNote" style="margin-top:6px"></div>';
    }

    // MAÑANA (placeholder siempre presente)
    const tmHolder = $('#fractalsTomorrowNote');
    if (tmHolder){
      const tm = state.fractals.tomorrow || { t4:[], rec:[] };
      const hasData = (tm.t4&&tm.t4.length) || (tm.rec&&tm.rec.length);
      if (hasData){
        const tip = ['Mañana —', tm.t4?.length?('T4: '+tm.t4.join(', ')):'T4: —', '·', tm.rec?.length?('Rec: '+tm.rec.join(', ')):'Rec: —'].join(' ');
        tmHolder.innerHTML = '<div class="muted"><span class="pill s-info" data-tip="'+esc(tip)+'" title="'+esc(tip)+'">Mañana (detalles)</span></div>';
      } else {
        tmHolder.innerHTML = '<div class="muted">Mañana: —</div>';
      }
    }
  }

  // ====== World Bosses (schedule embebido) ======
  const WB_BASE_PATTERN_MIN = [
    { offsetMin:   0, id:'tequatl',   name:'Tequatl the Sunless',           chat:'[&BNABAAA=]' },
    { offsetMin:  30, id:'shatterer', name:'The Shatterer',                 chat:'[&BE4DAAA=]' },
    { offsetMin:  60, id:'claw',      name:'Claw of Jormag',                chat:'[&BHoCAAA=]' },
    { offsetMin:  90, id:'karka',     name:'Karka Queen',                   chat:'[&BNcGAAA=]' }
  ];
  function genWBScheduleDayUTC(){
    const out=[]; for (let base=0;base<1440;base+=120){ WB_BASE_PATTERN_MIN.forEach(p=>out.push({ tMin: base+p.offsetMin, name:p.name, chat:p.chat })); }
    out.sort((a,b)=>a.tMin-b.tMin); return out;
  }
  const WB_DAY = genWBScheduleDayUTC();
  function computeWorldBossesNextWindow(windowMin){
    const now=new Date(); const nowUTCmin = now.getUTCHours()*60 + now.getUTCMinutes(); const limUTC=nowUTCmin+windowMin;
    const list=[];
    function pushEntry(tMinUTC, name, chat){
      const dayShift=Math.floor(tMinUTC/1440); const m=tMinUTC%1440; const hUTC=Math.floor(m/60), miUTC=m%60;
      const atUTC=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+dayShift,hUTC,miUTC,0));
      const atLocal=new Date(atUTC.getTime());
      list.push({ atLocalStr: pad2(atLocal.getHours())+':'+pad2(atLocal.getMinutes()), atUTCStr: pad2(atUTC.getUTCHours())+':'+pad2(atUTC.getUTCMinutes())+' UTC', name, chat, at: atLocal.getTime() });
    }
    WB_DAY.forEach(e=>{ if (e.tMin>=nowUTCmin && e.tMin<=limUTC) pushEntry(e.tMin,e.name,e.chat); });
    if (limUTC>1439){ const over=limUTC-1440; WB_DAY.forEach(e=>{ if (e.tMin<=over) pushEntry(e.tMin+1440,e.name,e.chat); }); }
    list.sort((a,b)=>a.at-b.at); return list.slice(0,6);
  }
  function renderWorldBosses(){
    const host=$('#wbBody'); if (!host) return;
    const next=state.worldBosses.next||[];
    if (!next.length){ host.classList.add('muted'); host.textContent='Sin eventos en los próximos 90 min.'; return; }
    host.classList.remove('muted');
    host.innerHTML='<ul class="list">'+next.map(e=>{
      const tip='Hora del servidor: '+esc(e.atUTCStr);
      return '<li><strong>'+esc(e.atLocalStr)+'</strong> — '+esc(e.name)+' <button class="btn btn--xs btn--ghost" data-tip="'+tip+'" title="'+tip+'" data-wb-copy="'+esc(e.chat||'')+'">Copiar</button></li>';
    }).join('')+'</ul>';
    host.querySelectorAll('button[data-wb-copy]').forEach(btn=>{
      if (btn.__wired) return; btn.__wired=true; btn.addEventListener('click',function(){ const code=this.getAttribute('data-wb-copy')||''; if(code) copyToClipboard(code); });
    });
  }

  // ====== (el resto del archivo continúa en el BLOQUE 2/2) ======

  // ====== Home Nodes utilidades / icons ======
  function detectNodeType(nodeId){
    nodeId=String(nodeId||'').toLowerCase();
    if (/_ore_node$/.test(nodeId) || /_(crystal|obsidian|prismaticite|mursaat|brandstone|mistonium|difluorite)/.test(nodeId)) return 'mining';
    if (/_wood_node$/.test(nodeId) || /petrified_stump|lowland_pine/.test(nodeId)) return 'logging';
    return 'harvest';
  }
  async function fetchItemIcons(ids=[]){
    if (!ids.length) return {};
    const url=`https://api.guildwars2.com/v2/items?ids=${ids.join(',')}`;
    const res=await fetch(url,{mode:'cors'}); if(!res.ok) return {}; const arr=await res.json(); const out={};
    (arr||[]).forEach(it=>{ if(it&&it.id&&it.icon) out[it.id]={name:it.name,icon:it.icon}; }); return out;
  }
  const HOME_NODE_ITEM_MAP = {
    'iron_ore_node':19699,'platinum_ore_node':19702,'mithril_ore_node':19700,'orichalcum_ore_node':19701,
    'ancient_wood_node':19725,'elder_wood_node':19723,'hard_wood_node':19724,
    'omnomberry_node':12128,'flaxseed_node':74090,'quartz_node':43773
  };
  const HOME_NODE_WIKI_TITLES = {
    'advanced_cloth_rack':'Silk Scrap','advanced_leather_rack':'Thick Leather Section','airship_cargo':'Airship Cargo',
    'aurilium_node':'Lump of Aurillium','bandit_chest':'Bandit Chest','basic_cloth_rack':'Cotton Scrap',
    'basic_harvesting_nodes':'Harvesting Sickle','basic_leather_rack':'Rawhide Leather Section',
    'basic_lumber_nodes':'Logging Axe','basic_ore_nodes':'Mining Pick','bauble_gathering_system':'Bauble (Super Adventure Box)',
    'black_lion_expedition_board_s4':'Black Lion Expedition Board','bloodstone_crystals':'Bloodstone Crystal',
    'bound_hatched_chili_pepper_node':'Hatched Chili Pepper','brandstone_node':'Brandstone','candy_corn_node':'Candy Corn',
    'commemorative_dragon_pinata':'Commemorative Dragon Piñata','crystallized_supply_cache':'Crystallized Supply Cache',
    'difluorite_crystal_cluster_node':'Difluorite Crystal','dragon_crystal':'Dragon Crystal','eternal_ice_shard_node':'Eternal Ice Shard',
    'exalted_chest':'Exalted Chest','garden_plot_01':'Home instance garden plot','garden_plot_02':'Home instance garden plot',
    'garden_plot_03':'Home instance garden plot','ghost_pepper_node':'Ghost Pepper','jade_fragment':'Jade Fragment',
    'king_sized_candy_corn':'Candy Corn','kournan_supply_cache':'Kournan Supply Cache','krait_obelisk':'Krait Obelisk Shard',
    'lotus_node':'Lotus','mistborn_mote':'Mistborn Mote','mistonium_node':'Mistonium','orrian_oyster_node':'Orrian Oyster',
    'orrian_truffle_node':'Orrian Truffle','petrified_stump':'Petrified Wood','primordial_orchid':'Primordial Orchid',
    'prismaticite_node':'Prismaticite Crystal','salvage_pile':'Pile of Silky Sand','snow_truffle_node':'Snow Truffle',
    'sprocket_generator':'Watchwork Sprocket','winterberry_bush':'Winterberry','wintersday_tree':'Wintersday Tree',
  };
  async function decorateHomeNodesIcons(unlockedIds){
    const host=document.getElementById('homeNodesGrid'); if(!host) return;
    const wantIds=[]; unlockedIds.forEach(id=>{ if(HOME_NODE_ITEM_MAP[id]) wantIds.push(HOME_NODE_ITEM_MAP[id]); });
    let byItemId={}; try{ byItemId=await fetchItemIcons(wantIds); }catch(_){}
    const tasks=[];
    host.querySelectorAll('label.card').forEach(label=>{
      const cb=label.querySelector('input[type="checkbox"][data-hn]'); const nodeId=cb?cb.getAttribute('data-hn'):'';
      const ico=label.querySelector('.node-icon'); if(!ico||!nodeId) return;
      const t=detectNodeType(nodeId); label.classList.add('hn',`hn--${t}`);
      const itemId=HOME_NODE_ITEM_MAP[nodeId]; const meta=itemId?byItemId[itemId]:null;
      if (meta&&meta.icon){ ico.innerHTML=''; const img=document.createElement('img'); img.src=meta.icon; img.width=22; img.height=22; img.alt=''; img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; ico.appendChild(img); return; }
      const title=HOME_NODE_WIKI_TITLES[nodeId];
      if (title){
        tasks.push((async()=>{ const src=await fetchWikiThumb(title);
          if(src&&ico.isConnected){ ico.innerHTML=''; const img=document.createElement('img'); img.src=src; img.width=22; img.height=22; img.alt=''; img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; ico.appendChild(img); }
          else if(ico.isConnected){ ico.setAttribute('data-fallback','1'); ico.textContent=(t==='mining'?'⛏':(t==='logging'?'🪓':'✂')); }
        })()); return;
      }
      ico.setAttribute('data-fallback','1'); ico.textContent=(t==='mining'?'⛏':(t==='logging'?'🪓':'✂'));
    });
    try{ await Promise.allSettled(tasks); }catch(_){}
  }

  // ====== Heredad “anti‑sábana” ======
  function groupHomeNodes(unlocked){ const g={mining:[],logging:[],harvest:[]}; unlocked.forEach(id=>{ g[detectNodeType(id)].push(id); }); return g; }
  function wireHomeNodesCheckboxes(scope){
    (scope||document).querySelectorAll('input[type="checkbox"][data-hn]').forEach(function(cb){
      if (cb.__wired) return; cb.__wired=true;
      cb.addEventListener('change', function(){ var k=this.getAttribute('data-hn'); state.toggles.homeNodesCollected[k]=!!this.checked; saveToggles(); updateKPI(); });
    });
  }
  function renderHomeNodesGrouped(unlocked){
    const host=document.getElementById('homeNodesGrid'); const status=document.getElementById('homeNodesStatus'); if(!host) return;
    const groups=groupHomeNodes(unlocked);
    const order=[{key:'mining',label:'Minería',icon:'⛏'},{key:'logging',label:'Madera',icon:'🪓'},{key:'harvest',label:'Recolección',icon:'✂'}];
    const mode=Number(host.dataset.filterMode||0);
    function makeSection(key,label,emoji, ids){
      const filtered=ids.filter(id=>{ const checked=!!state.toggles.homeNodesCollected[id]; return mode===0?true:(mode===1?!checked:checked); });
      const total=filtered.length; const slice=Number(host.dataset.slice||8); const collapsed=(total>slice);
      const sec=document.createElement('section'); sec.className='acc';
      sec.innerHTML =
        '<div class="acc__head"><strong>'+emoji+' '+esc(label)+'</strong><span class="muted">('+total+')</span>'+
        (collapsed?' <button class="btn-ghost btn--xs" data-acc-toggle data-tip="Expandir la lista">Mostrar todo</button>':'')+
        '</div><div class="acc__body" '+(collapsed?'data-collapsed="1"':'')+'><div class="grid hn-grid"></div></div>';
      const grid=sec.querySelector('.hn-grid'); const list=collapsed?filtered.slice(0,slice):filtered;
      grid.innerHTML=list.map(function(id){
        const checked=!!state.toggles.homeNodesCollected[id];
        return '<label class="card" style="display:flex;gap:10px;align-items:center;padding:8px">'+
               '<span class="node-icon" aria-hidden="true" style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;background:linear-gradient(180deg,#2a3342,#18202c);box-shadow:inset 0 0 0 1px #2b3647"></span>'+
               '<input type="checkbox" data-hn="'+esc(id)+'" '+(checked?'checked':'')+' style="margin-left:4px;margin-right:6px" title="Marcar como recolectado hoy" data-tip="Marcar como recolectado hoy">'+
               '<span>'+esc(id.replace(/_/g,' '))+'</span></label>';
      }).join('');
      const btn=sec.querySelector('[data-acc-toggle]');
      if (btn){
        btn.addEventListener('click', ()=>{
          const body=sec.querySelector('.acc__body'); const isCollapsed=body.getAttribute('data-collapsed')==='1'; body.removeAttribute('data-collapsed');
          if (isCollapsed){
            const rest=filtered.slice(slice); const more=document.createElement('div'); more.className='grid hn-grid';
            more.innerHTML=rest.map(function(id){
              const checked=!!state.toggles.homeNodesCollected[id];
              return '<label class="card" style="display:flex;gap:10px;align-items:center;padding:8px">'+
                     '<span class="node-icon" aria-hidden="true" style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;background:linear-gradient(180deg,#2a3342,#18202c);box-shadow:inset 0 0 0 1px #2b3647"></span>'+
                     '<input type="checkbox" data-hn="'+esc(id)+'" '+(checked?'checked':'')+' style="margin-left:4px;margin-right:6px" title="Marcar como recolectado hoy" data-tip="Marcar como recolectado hoy">'+
                     '<span>'+esc(id.replace(/_/g,' '))+'</span></label>';
            }).join('');
            body.appendChild(more); btn.textContent='Ver menos'; btn.setAttribute('data-tip','Colapsar la lista');
          } else {
            const secClone=makeSection(key,label,emoji,ids); sec.replaceWith(secClone); wireHomeNodesCheckboxes(secClone);
          }
          wireHomeNodesCheckboxes(sec);
        });
      }
      return sec;
    }
    let filters=document.getElementById('homeNodesFilters');
    if (!filters){
      filters=document.createElement('div'); filters.id='homeNodesFilters'; filters.className='row'; filters.style.margin='6px 0 10px 0';
      filters.innerHTML =
        '<button class="btn-ghost btn--xs" data-hn-filter="0" data-tip="Mostrar todos los nodos">Todos</button>'+
        '<button class="btn-ghost btn--xs" data-hn-filter="1" data-tip="Mostrar nodos no marcados hoy">No marcados</button>'+
        '<button class="btn-ghost btn--xs" data-hn-filter="2" data-tip="Mostrar sólo marcados">Marcados</button>';
      host.parentNode.insertBefore(filters, host);
      filters.addEventListener('click', (e)=>{ const v=e.target?.getAttribute?.('data-hn-filter'); if(!v) return;
        host.dataset.filterMode=String(v); renderHomeNodesGrouped(unlocked); decorateHomeNodesIcons(unlocked).catch(()=>{}); });
    }
    host.innerHTML=''; order.forEach(({key,label,icon})=>{ if((groups[key]||[]).length){ host.appendChild(makeSection(key,label,icon,groups[key])); } });
    status.textContent='Listo.'; wireHomeNodesCheckboxes(host);
  }

  // ====== KPI ======
  function updateKPI(){
    var ectoDone=0; try { for (var i=0;i<state.dailyIds.length;i++){ if(state.ectoDoneToday.has(String(state.dailyIds[i]))) ectoDone++; } } catch{}
    state.kpi.ectoDone=ectoDone;
    var kpiDaily=$('#kpiDailyStrip'); if (kpiDaily){
      const hasQuartzNode=(state._lastHomeNodes||[]).includes('quartz_node'); const quartzDone=!!state.toggles.homeNodesCollected['quartz_node']; const psnaAvail=(state.psnaToday||[]).length>0;
      const total=1+(hasQuartzNode?1:0)+1; const completed=(ectoDone>0?1:0)+(hasQuartzNode&&quartzDone?1:0)+(psnaAvail?1:0);
      const next=psnaAvail?'PSNA':(ectoDone<1?'Refinar Ecto':(hasQuartzNode&&!quartzDone?'Cuarzo':''));
      kpiDaily.innerHTML='<div class="kpi-badge kpi-ok">✅ '+completed+' / '+total+' actividades clave</div><div class="kpi-hint">'+(next?('⏳ Próxima acción recomendada: '+esc(next)):'Todo al día ✅')+'</div>';
    }
    var kpiWeekly=$('#kpiWeeklyStrip'); if (kpiWeekly){
      const gotKey=!!state.toggles.weeklyKey; const lv=Number(state.toggles.antiqueStoneCount||0); const completed=(gotKey?1:0)+(lv>=5?1:0);
      kpiWeekly.innerHTML='<div class="kpi-badge kpi-ok">✅ '+completed+' / 2 objetivos semanales</div><div class="kpi-hint">⏳ Semana termina en 4 días</div>';
    }
  }

  // ====== DOM Panel ======
  function ensurePanel(){
    var host=document.getElementById('activitiesPanel');
    if (!host){
      host=document.createElement('section'); host.id='activitiesPanel'; host.className='panel col-main'; host.setAttribute('hidden','');
      host.innerHTML=[
        '<h2 class="panel__title">Panel de Actividades</h2>',
        '<div class="panel__body">',
          '<div class="act-head">',
            '<p class="muted" id="actSub">Actividades de hoy · resetea a las 00:00 (servidor)</p>',
            '<div class="tabs" role="tablist" aria-label="Actividades">',
              '<button id="actTabDaily" class="btn" role="tab" aria-selected="true">Diarias</button>',
              '<button id="actTabWeekly" class="btn btn--ghost" role="tab" aria-selected="false">Semanales</button>',
            '</div>',
          '</div>',
          '<div id="actDaily" class="tab-panel" role="tabpanel" aria-labelledby="actTabDaily">',
            '<section class="kpi-strip" id="kpiDailyStrip"></section>',
            '<section class="card" id="psnaCritical"><h2>🔴 Acciones importantes de hoy</h2><div id="psnaCriticalBody" class="action-card muted">Cargando PSNA…</div></section>',
            '<div class="panel-head"><h3 class="panel-head__title">Agentes de red de suministros del Pacto</h3></div>',
            '<p class="muted">Haz clic en el icono de <strong>Waypoint</strong> para copiar el chat‑code y pegarlo en el juego. <button id="psnaCopyAll" class="btn btn--ghost btn--xs" data-tip="Copia todos los waypoints (6/6) si están disponibles">Copiar todos</button></p>',
            '<div id="psnaStatus" class="muted">Cargando ubicaciones…</div>',
            '<div id="psnaGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px"></div>',
            '<section class="card" id="fractalsDaily"><h2>🌀 Fractales (hoy)</h2><div id="fractalsBody" class="muted">Cargando fractales…</div></section>',
            '<section class="card" id="wbSection"><h2>🌋 World Bosses (próximos 90 min)</h2><div id="wbBody" class="muted">Calculando agenda…</div></section>',
            '<hr class="hr-hairline">',
            '<div class="panel-head"><h3 class="panel-head__title">Refinamiento de ectoplasma (1/día)</h3></div>',
            '<div id="ectoStatus" class="muted">Cargando recetas…</div>',
            '<div id="ectoGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px"></div>',
            '<hr class="hr-hairline">',
            '<div class="panel-head"><h3 class="panel-head__title">Nodos de Heredad (estado diario)</h3></div>',
            '<div id="homeNodesFilters"></div>',
            '<div id="homeNodesStatus" class="muted">Cargando nodos desbloqueados…</div>',
            '<div id="homeNodesGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px"></div>',
            '<hr class="hr-hairline">',
            '<section class="card"><h2>ℹ️ Información útil</h2><ul class="list"><li>PSNA rota a las 08:00 (servidor).</li><li>Refinamientos resetean a diario (00:00 servidor).</li></ul></section>',
          '</div>',
          '<div id="actWeekly" class="tab-panel" role="tabpanel" aria-labelledby="actTabWeekly" hidden>',
            '<section class="kpi-strip" id="kpiWeeklyStrip"></section>',
            '<section class="card"><h2>🔴 Objetivos semanales</h2>',
              '<div class="row between" style="margin:6px 0">',
                '<div><span class="pill s-pending" id="pillKey" title="Llave del León Negro · semanal" data-tip="Llave del León Negro · semanal"><span class="pill-icon"></span><span class="pill-text">⏳ Llave del León Negro</span></span></div>',
                '<label class="toggle"><input type="checkbox" id="wkKeyDone"><span>Marcar</span></label>',
              '</div>',
              '<div class="bar" aria-hidden="true"><div class="bar-fill" id="barKey" style="width:0%"></div></div>',
              '<div class="row between" style="margin:6px 0">',
                '<div><span class="pill s-pending" id="pillLeivas" title="Piedra de invocación vetusta (Leivas) · 5/semana" data-tip="Piedra de invocación vetusta (Leivas) · 5/semana"><span class="pill-icon"></span><span class="pill-text">Leivas: 0/5</span></span></div>',
                '<div><button class="btn-ghost" id="assMinus" data-tip="Restar 1">−</button><button class="btn-ghost" id="assPlus" data-tip="Sumar 1">+</button></div>',
              '</div>',
              '<div class="bar" aria-hidden="true"><div class="bar-fill" id="barLeivas" style="width:0%"></div></div>',
            '</section>',
            '<div class="panel-head"><h3 class="panel-head__title">Piedra de invocación vetusta — Leivas (Arborstone)</h3></div>',
            '<p class="muted">Semanal: hasta <strong>5</strong> unidades (distintas divisas). <span style="margin-left:10px">Compradas: <span id="assCount">0</span></span></p>',
            '<div id="assCurrencies" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:6px 0 6px 0"></div>',
            '<p class="muted" style="margin-top:6px">Waypoint: <button id="assWp" class="btn btn--ghost btn--xs" data-tip="Copiar waypoint de Arborstone">Copiar Arborstone [&BCEJAAA=]</button></p>',
            '<hr class="hr-hairline">',
            '<section class="card"><h2>🟡 Opcionales de la semana</h2><ul class="list"><li><span class="pill s-pending" data-tip="Haz 3 jefes de mundo a elección; sugeridos abajo.">World bosses (3 distintos)</span><div class="muted" style="margin-top:6px">Sugeridos: Tequatl [&BNABAAA=], The Shatterer [&BE4DAAA=], Claw of Jormag [&BHoCAAA=], Karka Queen [&BNcGAAA=].</div></li><li><span class="pill s-info" data-tip="Los fractales rotan a diario. Te mostramos los de HOY en la pestaña Diarias.">Fractales (ver Diarias)</span></li><li><span class="pill s-info" data-tip="Realiza una meta de ‘mapa con bonus’ esta semana (loot extra en el mapa destacado).">Mapa con bonus activo (1)</span></li></ul></section>',
          '</div>',
        '</div>'
      ].join('');
      var anchor=document.getElementById('walletPanel'); (anchor&&anchor.parentNode)?anchor.parentNode.insertBefore(host,anchor):document.body.appendChild(host);
      $('#actTabDaily').addEventListener('click', function(){ $('#actDaily').hidden=false; $('#actWeekly').hidden=true; this.classList.remove('btn--ghost'); $('#actTabWeekly').classList.add('btn--ghost'); this.setAttribute('aria-selected','true'); $('#actTabWeekly').setAttribute('aria-selected','false'); $('#actSub').textContent='Actividades de hoy · resetea a las 00:00 (servidor)'; });
      $('#actTabWeekly').addEventListener('click', function(){ $('#actDaily').hidden=true; $('#actWeekly').hidden=false; this.classList.remove('btn--ghost'); $('#actTabDaily').classList.add('btn--ghost'); this.setAttribute('aria-selected','true'); $('#actTabDaily').setAttribute('aria-selected','false'); $('#actSub').textContent='Semana actual · resetea el lunes 00:00 (servidor)'; updateWeeklyBars(); });
      $('#psnaCopyAll').addEventListener('click', function(){ if (!state.psnaToday||!state.psnaToday.length) return; var anyMissing=(state.psnaToday||[]).some(x=>!x.chat); if(anyMissing) return; copyToClipboard(state.psnaToday.map(x=>x.chat).join(' ')); });
      $('#wkKeyDone').addEventListener('change', function(){ state.toggles.weeklyKey=!!this.checked; state.kpi.key=state.toggles.weeklyKey; saveToggles(); renderWeeklyPillsAndBars(); updateKPI(); });
      $('#assMinus').addEventListener('click', function(){ state.toggles.antiqueStoneCount=Math.max(0,(state.toggles.antiqueStoneCount||0)-1); state.kpi.stones=state.toggles.antiqueStoneCount; saveToggles(); renderASS(); renderWeeklyPillsAndBars(); updateKPI(); });
      $('#assPlus').addEventListener('click', function(){ state.toggles.antiqueStoneCount=Math.min(5,(state.toggles.antiqueStoneCount||0)+1); state.kpi.stones=state.toggles.antiqueStoneCount; saveToggles(); renderASS(); renderWeeklyPillsAndBars(); updateKPI(); });
      $('#assWp').addEventListener('click', function(){ copyToClipboard('[&BCEJAAA=]'); });
    }
    return host;
  }

  // ====== PSNA ======
  var WP_ICON='https://wiki.guildwars2.com/images/thumb/d/d2/Waypoint_%28map_icon%29.png/30px-Waypoint_%28map_icon%29.png';
  function psnaCardHTML(row){
    var disabled=row.chat?'':' disabled';
    return ['<article class="card">',
      '<div style="display:flex;gap:10px;align-items:center">',
      '<img src="'+WP_ICON+'" width="22" height="22" alt="WP" loading="lazy">',
      '<button class="btn btn--ghost btn--xs" data-psna-copy title="Copiar chat‑code" data-tip="Copiar chat‑code"'+disabled+'>'+esc(row.wpName||'—')+'</button>',
      '</div>','<div class="muted" style="margin-top:6px">','<div><strong>'+esc(row.npc)+'</strong> — '+esc(row.region)+'</div>','<div>'+esc(row.name||'')+'</div>','</div>','</article>'].join('');
  }
  var PSNA_WP_CHAT = { /* … (igual que tu copia anterior) … */ };
  var PSNA_ALIASES = { /* … (igual que tu copia anterior) … */ };
  function resolveChatByName(name){ if(!name) return ''; var k=name.replace(/\s+/g,' ').trim(); if(PSNA_ALIASES[k]) k=PSNA_ALIASES[k]; if(PSNA_WP_CHAT[k]) return PSNA_WP_CHAT[k]; if(k.endsWith(' Waypoint')){ var base=k.slice(0,-9).trim(); if(PSNA_WP_CHAT[base]) return PSNA_WP_CHAT[base]; } console.warn(LOG,'PSNA chat-code faltante para:',name); return ''; }
  async function fetchPSNAFromWiki(){
    var url='https://wiki.guildwars2.com/api.php?action=parse&page=Template:Pact_Supply_Network_Agent_table&prop=text&format=json&origin=*';
    var r=await fetch(url,{ headers:{'Accept':'application/json'} }); var j=await r.json(); var html=j?.parse?.text?.['*']||''; if(!html) throw new Error('No HTML');
    var container=document.createElement('div'); container.innerHTML=html;
    var today=new Date(); var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var key=today.getUTCFullYear()+' '+months[today.getUTCMonth()]+' '+String(today.getUTCDate()).padStart(2,'0');
    var hit=null; Array.from(container.querySelectorAll('table tr')).forEach(tr=>{ if(tr.textContent.includes(key)) hit=tr; }); if(!hit) throw new Error('Row not found for '+key);
    var tds=hit.querySelectorAll('td'); if(!tds||tds.length<7) throw new Error('Unexpected columns');
    var regions=['Maguuma Wastes','Maguuma Jungle','Ruins of Orr','Kryta','Shiverpeaks','Ascalon'];
    var npcs=['Mehem the Traveled','The Fox','Specialist Yana','Lady Derwena','Despina Katelyn','Verma Giftrender'];
    var out=[]; for (var i=1;i<=6;i++){ var name=(tds[i].textContent||'').trim().replace(/\s+/g,' '); out.push({ region:regions[i-1], npc:npcs[i-1], name, wpName:name, chat:resolveChatByName(name) }); }
    return out;
  }
  var PSNA_FALLBACK = (function(){ /* … (igual que tu copia anterior) … */ return []; })();

  let _psnaRunId=0;
  async function ensurePSNA(){
    $('#psnaStatus').textContent='Cargando ubicaciones…';
    var cacheKey='psna:'+dayKeyUTC();
    try{ var cached=sessionStorage.getItem(cacheKey); if(cached){ state.psnaToday=JSON.parse(cached); renderPSNA(); $('#psnaStatus').textContent='Listo (cache).'; updateKPI(); return; } }catch{}
    var runId=++_psnaRunId;
    try{
      // Watchdog de 3.5s: si la wiki no responde usamos fallback
      const rows = await withTimeout(fetchPSNAFromWiki(), 3500, 'psna');
      var fb = psnaFallbackToday();
      var out=[]; for (var i=0;i<6;i++){ var r=rows[i]||{}; var back=fb[i]||{}; out.push({ region:r.region||back.region||'', npc:r.npc||back.npc||'', name:r.name||back.name||'', wpName:r.wpName||back.wpName||'', chat:r.chat||back.chat||'' }); }
      if (runId!==_psnaRunId) return;
      state.psnaToday=out; try{ sessionStorage.setItem(cacheKey, JSON.stringify(out)); }catch{}
      renderPSNA(); $('#psnaStatus').textContent='Listo.'; updateKPI();
    } catch(e){
      if (runId!==_psnaRunId) return;
      console.warn(LOG,'PSNA',e);
      var out=psnaFallbackToday();
      state.psnaToday=out; renderPSNA();
      $('#psnaStatus').textContent = out.length ? 'Listo (fallback).' : 'No se pudo obtener la rotación. Reintentá más tarde.';
      updateKPI();
    }
  }
  function psnaFallbackToday(){ var dow=(new Date()).getDay(); var idx=(dow+6)%7; var row=PSNA_FALLBACK[idx]||[]; return row.filter(Boolean); }
  function renderPSNA(){
    var host=$('#psnaGrid'); if(!host) return;
    host.innerHTML=(state.psnaToday||[]).map(psnaCardHTML).join('');
    var top=(state.psnaToday||[])[0]; var crit=$('#psnaCriticalBody');
    if (crit){
      if (top){
        var btnDis=top.chat?'':''; crit.classList.remove('muted');
        crit.innerHTML='<div class="action-main"><div class="action-title">'+esc(top.region||'')+'</div><div class="action-sub">'+esc(top.name||'')+' — '+esc(top.npc||'')+'</div></div><div class="action-cta"><button class="btn" id="psnaCopyTop"'+(btnDis?'':' disabled')+' data-tip="Copiar waypoint principal">Copiar waypoint</button></div>';
        $('#psnaCopyTop')?.addEventListener('click',()=>{ if(top.chat) copyToClipboard(top.chat); });
      } else { crit.classList.add('muted'); crit.textContent='PSNA no disponible por ahora.'; }
    }
    host.querySelectorAll('[data-psna-copy]').forEach(function(b,idx){ if(b.__wired) return; b.__wired=true; b.__chat=(state.psnaToday[idx]?.chat)||''; b.addEventListener('click', function(){ if (b.__chat) copyToClipboard(b.__chat); }); });
    var any=0; (state.psnaToday||[]).forEach(r=>{ if(r.chat) any++; }); var copyAllBtn=document.getElementById('psnaCopyAll'); if(copyAllBtn) copyAllBtn.disabled=(any<6);
  }

  // ====== ECTO ======
  let _ectoRunId=0;
  async function fetchEctoStatus(token){
    var runId=++_ectoRunId; state.ectoDoneToday.clear();
    try{ if(token){ var r=await fetch('https://api.guildwars2.com/v2/account/dailycrafting?access_token='+encodeURIComponent(token)); var arr=await r.json(); if(runId!==_ectoRunId) return; if(Array.isArray(arr)) arr.forEach(id=>state.ectoDoneToday.add(String(id))); } }catch(e){ console.warn(LOG,'account/dailycrafting',e); }
    try{
      var mapIdToItem={ glob_of_elder_spirit_residue:46744, lump_of_mithrilium:46742, spool_of_silk_weaving_thread:46740, spool_of_thick_elonian_cord:46745 };
      var ids=Object.values(mapIdToItem).join(','); var rr=await fetch('https://api.guildwars2.com/v2/items?ids='+ids+'&lang=es'); var list=await rr.json(); if(runId!==_ectoRunId) return;
      (list||[]).forEach(it=>state.ectoItems.set(String(it.id),it)); state._ectoMapItem=mapIdToItem;
    }catch(e){ console.warn(LOG,'items meta',e); }
    updateKPI();
  }
  function ectoCardHTML(apiId,isDone,itMeta){
    var icon=itMeta?.icon?'<img src="'+esc(itMeta.icon)+'" width="32" height="32" alt="">':'';
    var name=itMeta?.name||apiId; var tip=name+(isDone?' · Hecho hoy':' · Pendiente');
    return ['<article class="card" title="'+esc(tip)+'" data-tip="'+esc(tip)+'">','<div style="display:flex;gap:10px;align-items:center">',icon,'<div><strong>'+esc(name)+'</strong><div class="muted">'+esc(apiId)+'</div></div>','</div>','<div style="margin-top:6px">', (isDone?'<span class="pill s-ok">✅ Hecho hoy</span>':'<span class="pill s-pending">⏳ Pendiente</span>'),'</div>','</article>'].join('');
  }
  function renderEcto(){ var host=$('#ectoGrid'); if(!host) return; var out=[]; var mapIdToItem=state._ectoMapItem||{}; state.dailyIds.forEach(function(apiId){ var itemId=mapIdToItem[apiId]; var it=itemId?state.ectoItems.get(String(itemId)):null; var done=state.ectoDoneToday.has(String(apiId)); out.push(ectoCardHTML(apiId,done,it)); }); host.innerHTML=out.join(''); $('#ectoStatus').textContent='Listo.'; updateKPI(); }

  // ====== Weekly assets ======
  async function fetchWeeklyAssets(){
    try{
      var itemIds=[36708,96978];
      var r=await fetch('https://api.guildwars2.com/v2/items?ids='+itemIds.join(',')+'&lang=es'); var arr=await r.json();
      (arr||[]).forEach(function(it){ if(it.id===36708) state.weeklyAssets.key=it; if(it.id===96978) state.weeklyAssets.stone=it; });
    }catch(e){ console.warn(LOG,'weekly items',e); }
  }
  function renderWeeklyAssets(){
    const pillKey=document.getElementById('pillKey');
    if (pillKey && state.weeklyAssets.key && !pillKey.__icon){
      const holder=pillKey.querySelector('.pill-icon')||pillKey; holder.innerHTML='';
      const img=document.createElement('img'); img.src=state.weeklyAssets.key.icon; img.width=16; img.height=16; img.alt=''; img.loading='lazy'; holder.appendChild(img); pillKey.__icon=true;
    }
    const pillLeivas=document.getElementById('pillLeivas');
    if (pillLeivas && state.weeklyAssets.stone && !pillLeivas.__icon){
      const holder2=pillLeivas.querySelector('.pill-icon')||pillLeivas; holder2.innerHTML='';
      const img2=document.createElement('img'); img2.src=state.weeklyAssets.stone.icon; img2.width=16; img2.height=16; img2.alt=''; img2.loading='lazy'; holder2.appendChild(img2); pillLeivas.__icon=true;
    }
    const cur=document.getElementById('assCurrencies'); if (cur && !cur.__filled){
      const currencies=[ {id:'ancient-coins',name:'Ancient Coins',cost:'10',tip:'Mapas de LS3 y cofres/actividades asociadas. 1 piedra/semana.'},
        {id:'blue-prophet',name:'Blue Prophet Shards',cost:'10',tip:'Strikes/Convergences (Wizard’s Tower). 1 piedra/semana.'},
        {id:'research-notes',name:'Research Notes',cost:'100',tip:'Desguaza comidas/consumibles/crafteos. 1 piedra/semana.'},
        {id:'imperial-favor',name:'Imperial Favor',cost:'100',tip:'Eventos en Cantha + vendor semanal de Favor. 1 piedra/semana.'},
        {id:'gold',name:'Oro',cost:'1',tip:'Compra directa de Leivas (semanal).'} ];
      cur.innerHTML=currencies.map(c=>('<div class="card" data-tip="'+esc(c.tip)+'"><div style="display:flex;align-items:center;gap:8px"><span class="cur-icon cur-'+esc(c.id)+'" aria-hidden="true" style="width:20px;height:20px;display:inline-block;border-radius:4px;background:#111;border:1px solid var(--bd)"></span><div style="font-weight:600">'+esc(c.name)+'</div></div><div class="muted" style="margin-top:6px">Costo: '+esc(c.cost)+'</div></div>')).join('');
      cur.__filled=true; cur.querySelectorAll('.cur-ancient-coins').forEach(n=>n.textContent='⛀'); cur.querySelectorAll('.cur-blue-prophet').forEach(n=>n.textContent='🔷'); cur.querySelectorAll('.cur-research-notes').forEach(n=>n.textContent='🧪'); cur.querySelectorAll('.cur-imperial-favor').forEach(n=>n.textContent='🏯'); cur.querySelectorAll('.cur-gold').forEach(n=>n.textContent='🟡');
    }
  }
  function renderASS(){ var n=Number(state.toggles.antiqueStoneCount||0); $('#assCount').textContent=String(n); }
  function renderWeeklyPillsAndBars(){
    const has=!!state.toggles.weeklyKey; const lv=Number(state.toggles.antiqueStoneCount||0);
    const pillKey=$('#pillKey'); if (pillKey){ pillKey.className='pill '+(has?'s-ok':'s-pending'); (pillKey.querySelector('.pill-text')||pillKey).textContent=(has?'✅':'⏳')+' Llave del León Negro'; pillKey.title='Llave del León Negro · '+(has?'obtenida':'pendiente'); pillKey.setAttribute('data-tip',pillKey.title); if(state.weeklyAssets.key && pillKey.__icon!==true) renderWeeklyAssets(); }
    const barKey=$('#barKey'); if (barKey) barKey.style.width=(has?100:0)+'%';
    const pillLeivas=$('#pillLeivas'); if (pillLeivas){ pillLeivas.className='pill '+(lv>=5?'s-ok':'s-pending'); (pillLeivas.querySelector('.pill-text')||pillLeivas).textContent='Leivas: '+lv+'/5'; pillLeivas.title='Leivas · '+lv+'/5 esta semana'; pillLeivas.setAttribute('data-tip',pillLeivas.title); if(state.weeklyAssets.stone && pillLeivas.__icon!==true) renderWeeklyAssets(); }
    const barLeivas=$('#barLeivas'); if (barLeivas) barLeivas.style.width=Math.min(100,Math.round(lv/5*100))+'%';
  }
  function updateWeeklyBars(){ renderWeeklyPillsAndBars(); }

  // ====== Ciclo de vida ======
  function loadToggles(){ try{ var raw=JSON.parse(localStorage.getItem('gn_activities_toggles')||'{}'); var todayLocal=dayKeyLocal(); var thisWeek=weekKeyUTC(); if(raw.date!==todayLocal){ raw.homeNodesCollected={}; raw.date=todayLocal; } if(raw.week!==thisWeek){ raw.week=thisWeek; raw.weeklyKey=false; raw.antiqueStoneCount=0; } state.toggles=Object.assign({ homeNodesCollected:{}, weeklyKey:false, antiqueStoneCount:0, date:todayLocal, week:thisWeek }, raw||{}); }catch{} state.kpi.stones=Number(state.toggles.antiqueStoneCount||0); state.kpi.key=!!state.toggles.weeklyKey; }
  function saveToggles(){ try{ var obj=Object.assign({},state.toggles,{ date:dayKeyLocal(), week:weekKeyUTC() }); localStorage.setItem('gn_activities_toggles', JSON.stringify(obj)); }catch{} }

  async function activate(){
    state.active = true;
    ensurePanel().removeAttribute('hidden');
    loadToggles();

    // Render inmediato de WB (evita ver "Calculando…" si algo externo falla)
    try {
      state.worldBosses.status='ready';
      state.worldBosses.next=computeWorldBossesNextWindow(90);
      renderWorldBosses();
    } catch(e){ console.warn(LOG,'wb init',e); }

    // Semanales (UI base)
    try {
      $('#wkKeyDone').checked=!!state.toggles.weeklyKey;
      renderASS(); renderWeeklyPillsAndBars();
      await fetchWeeklyAssets(); renderWeeklyAssets();
    } catch(e){ console.warn(LOG,'weekly assets/ui',e); }

    // Token
    try { state.token = root.__GN__?.getSelectedToken?.() || null; } catch(e){ state.token = null; }

    // PSNA con watchdog
    try { await ensurePSNA(); } catch(e){ console.warn(LOG,'psna ensure',e); }

    // Fractales (hoy) con timeout
    try {
      await withTimeout(fetchFractalsDaily('today'), 3500, 'fractals today');
    } catch(e){
      console.warn(LOG,'fract today watchdog',e);
      state.fractals.status='error'; state.fractals.error=e;
    }
    try { renderFractalsDaily(); } catch(e){ console.warn(LOG,'fract render',e); }

    // Fractales (mañana) en idle (no bloquea)
    requestIdle(async ()=>{
      try { await fetchFractalsDaily('tomorrow'); } catch(_) {}
      try { renderFractalsDaily(); } catch(_){}
    });

    // Ecto + Heredad (que dependen de token)
    try {
      $('#ectoStatus').textContent = 'Cargando…';
      await fetchEctoStatus(state.token); renderEcto();
      if (state.token) fetchHomeNodes(state.token);
    } catch(e){ console.warn(LOG,'ecto/hn',e); }

    // KPI final
    try { updateKPI(); } catch(_){}
  }
  function deactivate(){ state.active=false; ensurePanel().setAttribute('hidden',''); }

  // Prefetch (router)
  async function prefetch(ctx){
    try {
      if (ctx?.signal?.aborted) return;
      await Promise.all([
        fetchWeeklyAssets(),
        fetchEctoStatus(ctx?.token || root.__GN__?.getSelectedToken?.() || null),
        fetchFractalsDaily('today')
      ]);
    } catch(_) {}
  }

  // Eventos globales
  function wireGlobal(){
    document.addEventListener('gn:tokenchange', async function(ev){
      var tok=ev?.detail?.token || null; state.token=tok;
      if (!state.active) return;
      try { await fetchEctoStatus(state.token); renderEcto(); updateKPI(); if (state.token) fetchHomeNodes(state.token); } catch(e){ console.warn(LOG,'on tokenchange',e); }
    });
    document.addEventListener('gn:global-refresh', async function(){
      if (!state.active) return;
      try {
        ensurePSNA();
        await withTimeout(fetchFractalsDaily('today'), 3500, 'fractals today');
      } catch(e){ state.fractals.status='error'; state.fractals.error=e; }
      try {
        requestIdle(async ()=>{ try{ await fetchFractalsDaily('tomorrow'); }catch(_){} renderFractalsDaily(); });
        state.worldBosses.next=computeWorldBossesNextWindow(90); renderWorldBosses();
        if (state.token) fetchHomeNodes(state.token);
        renderWeeklyAssets(); updateKPI();
      } catch(e){ console.warn(LOG,'global-refresh',e); }
    });
  }

  // API pública
  var Activities = {
    initOnce: function(){
      if (state.inited) return;
      ensurePanel(); wireGlobal(); state.inited=true; console.info(LOG,'ready v1.4.2');
    },
    activate, deactivate, prefetch,
    Route: { path:'account/activities', mount: ()=>Activities.activate(), unmount: ()=>Activities.deactivate(), prefetch: (ctx)=>Activities.prefetch(ctx) }
  };
  root.Activities = Activities;

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', Activities.initOnce);
  else Activities.initOnce();

})(typeof window!=='undefined' ? window : this);