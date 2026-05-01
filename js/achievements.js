/* ===========================================================================
 * js/achievements.js — Logros enfocado en "próximo a completar"
 * Versión: 3.2.0 (2026-04-28)
 *  - Grid único de pendientes (sin completados, sin resumen duplicado)
 *  - Recompensas visibles: items, títulos, maestrías con íconos y nombres oficiales
 *  - Toolbar unificada con 3 dropdowns personalizados (Umbral, Categoría, Recompensa)
 *  - Cards compactas con pills y barras alineados al fondo
 *  - KPIs AP conservados
 * =========================================================================== */

(function (root) {
  'use strict';

  var LOGP = '[Achievements]';
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };

  var _loadSeq = 0;

  // ======================= ICONOS =========================
  var ICON_AP_PERM  = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_DAILY = 'https://wiki.guildwars2.com/images/1/14/Daily_Achievement.png';
  var ICON_AP_TOTAL = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_18    = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_PAGE  = 'https://wiki.guildwars2.com/wiki/Achievement_Chest';

  var REWARD_FALLBACK = {
    'Item':    'assets/icons/Welcome/1228903.png',
    'Title':   'assets/icons/Welcome/605001.png',
    'Mastery': 'assets/icons/Welcome/1078543.png',
    'Coins':   'assets/icons/733322.png'
  };

  // ---------------------------- Estado / DOM -------------------------------
  var el = {
    panel: null, head: null, body: null,
    chipsOld: null, search: null,
    mainGrid: null, toolbar: null,
    aside: null, asideTopList: null, asideCats: null,
    kpiWrap: null
  };

  var state = {
    token: null,
    acc: [],
    metaById: new Map(),
    categories: [],
    catById: new Map(),
    achIdToCat: new Map(),
    qRaw: '', qNorm: '', pct: 0.8, cat: '',
    rewardFilter: '',
    apDailyHist: 0,
    apPermanent: 0,
    apLegacyDelta: 0,
    loaded: false, loading: false, catsLoaded: false,
    _wiredTokenListener: false, _wiredHashListener: false
  };

  // ------------------------------- Utils -----------------------------------
  function pct100(x){ return Math.round(x*1000)/10; }
  function fmtPct(x){ return pct100(x).toFixed(1) + '%'; }
  function fmtInt(n){ n = Number(n||0); return n.toLocaleString('es-AR'); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
  }
  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  }
  function getSelectedToken(){ try { return root.__GN__?.getSelectedToken?.() || null; } catch(_){ return null; } }
  function isActiveRoute(){ return (String(location.hash||'').toLowerCase().startsWith('#/account/achievements')); }

  function iconImg(url, size, alt, extraStyle){
    if(!url) return '';
    var s = Number(size||18), style = extraStyle ? ' style="'+extraStyle+'"' : '';
    return '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" width="'+s+'" height="'+s+'" loading="lazy" decoding="async" referrerpolicy="no-referrer"'+style+' />';
  }

  // ======================= CACHÉ DE RECOMPENSAS =========================
  var _rewardCache   = {};
  var _titleCache    = {};
  var _masteryCache  = {};

  function loadRewardItemDetail(itemId) {
    if (_rewardCache[itemId] || _rewardCache['_loading_' + itemId]) return;
    _rewardCache['_loading_' + itemId] = true;
    root.GW2Api.getItemsMany([itemId], { nocache: false })
      .then(function(items) {
        if (items && items.length) {
          _rewardCache[itemId] = {
            icon: items[0].icon || REWARD_FALLBACK['Item'],
            name: items[0].name || ('Ítem #' + itemId)
          };
        } else {
          _rewardCache[itemId] = { icon: REWARD_FALLBACK['Item'], name: 'Ítem #' + itemId };
        }
        if (el.mainGrid && el.mainGrid.children.length) renderMainGrid();
      })
      .catch(function() {
        _rewardCache[itemId] = { icon: REWARD_FALLBACK['Item'], name: 'Ítem #' + itemId };
      });
  }

  function loadRewardTitleDetail(titleId) {
    if (_titleCache[titleId] || _titleCache['_loading_' + titleId]) return;
    _titleCache['_loading_' + titleId] = true;
    fetch('https://api.guildwars2.com/v2/titles?id=' + encodeURIComponent(titleId))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.name) {
          _titleCache[titleId] = { name: data.name, icon: data.icon || REWARD_FALLBACK['Title'] };
        } else {
          _titleCache[titleId] = { name: 'Título', icon: REWARD_FALLBACK['Title'] };
        }
        if (el.mainGrid && el.mainGrid.children.length) renderMainGrid();
      })
      .catch(function() {
        _titleCache[titleId] = { name: 'Título', icon: REWARD_FALLBACK['Title'] };
      });
  }

  function loadRewardMasteryDetail(masteryId) {
    if (_masteryCache[masteryId] || _masteryCache['_loading_' + masteryId]) return;
    _masteryCache['_loading_' + masteryId] = true;
    fetch('https://api.guildwars2.com/v2/masteries?id=' + encodeURIComponent(masteryId))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.name) {
          _masteryCache[masteryId] = { name: data.name, icon: data.icon || REWARD_FALLBACK['Mastery'] };
        } else {
          _masteryCache[masteryId] = { name: 'Maestría', icon: REWARD_FALLBACK['Mastery'] };
        }
        if (el.mainGrid && el.mainGrid.children.length) renderMainGrid();
      })
      .catch(function() {
        _masteryCache[masteryId] = { name: 'Maestría', icon: REWARD_FALLBACK['Mastery'] };
      });
  }

  // --------------------------- Deep‑links (hash) ----------------------------
  function parseHashParams(){
    var h = String(location.hash || '');
    var idx = h.indexOf('?');
    if (idx < 0) return { route: h, params: new URLSearchParams() };
    return { route: h.slice(0, idx), params: new URLSearchParams(h.slice(idx+1)) };
  }
  function readFiltersFromHashIntoState(){
    var parsed = parseHashParams();
    if (parsed.route !== '#/account/achievements') return;
    var q = parsed.params.get('q') || '';
    var pct = parsed.params.get('pct');
    var cat = parsed.params.get('cat') || '';
    var reward = parsed.params.get('reward') || '';
    var pNum = pct != null ? parseFloat(pct) : NaN;

    state.qRaw  = String(q||'');
    state.qNorm = norm(state.qRaw);
    if (isFinite(pNum) && pNum > 0 && pNum <= 1) state.pct = pNum;
    state.cat = cat ? String(cat) : '';
    state.rewardFilter = reward ? String(reward) : '';

    if (el.search) el.search.value = state.qRaw;
  }
  function writeFiltersToHashSilently(){
    var base = '#/account/achievements';
    var params = new URLSearchParams();
    var qRaw = el.search ? (el.search.value || '') : state.qRaw;
    if (qRaw) params.set('q', qRaw);
    if (state.pct && state.pct !== 0.8) params.set('pct', String(state.pct));
    if (state.cat) params.set('cat', String(state.cat));
    if (state.rewardFilter) params.set('reward', state.rewardFilter);
    var newHash = params.toString() ? (base + '?' + params.toString()) : base;
    var url = new URL(location.href);
    url.hash = newHash;
    history.replaceState(null, '', url.toString());
    state.qRaw = qRaw; state.qNorm = norm(qRaw);
  }

  // ------------------------ Modelo de progreso + AP -------------------------
  function computeProgress(accountRec, meta){
    var cur = Number(accountRec?.current || 0);
    var max = Number(accountRec?.max || 0);
    var done = !!accountRec?.done;
    var tiers = Array.isArray(meta?.tiers) ? meta.tiers.slice() : [];
    var target = 0;
    if (tiers.length) {
      var last = tiers[tiers.length - 1];
      target = Math.max(target, Number(last?.count || 0));
    }
    if (!target && max) target = max;
    if (done) {
      var t = target || cur || 1;
      return { cur: t, max: t, pct: 1, label: 'Completado' };
    }
    if (!target || target <= 0) {
      var denom = (cur > 0) ? cur : 1;
      return { cur: cur, max: denom, pct: Math.min(1, cur/denom), label: 'Progreso' };
    }
    var ratio = Math.max(0, Math.min(1, cur / target));
    return { cur: cur, max: target, pct: ratio, label: ratio >= 1 ? 'Completado' : 'Progreso' };
  }

  function totalAP(meta){
    var tiers = Array.isArray(meta?.tiers) ? meta.tiers : [];
    var sum = 0;
    for (var i=0;i<tiers.length;i++){
      var p = Number(tiers[i]?.points || 0);
      if (isFinite(p) && p > 0) sum += p;
    }
    return sum;
  }
  function earnedAP(accountRec, meta){
    var cur = Number(accountRec?.current || 0);
    var done = !!accountRec?.done;
    var tiers = Array.isArray(meta?.tiers) ? meta.tiers.slice() : [];
    tiers.sort(function(a,b){ return Number(a?.count||0) - Number(b?.count||0); });
    var sum = 0;
    for (var i=0;i<tiers.length;i++){
      var need = Number(tiers[i]?.count || 0);
      var p    = Number(tiers[i]?.points || 0);
      if (!isFinite(p) || p <= 0) continue;
      if (done || cur >= need) sum += p;
    }
    return sum;
  }
  function hasFlag(meta, flag){
    var f = Array.isArray(meta?.flags) ? meta.flags : [];
    return f.indexOf(flag) >= 0;
  }
  function computePermanentAP(accArr, metaById){
    var sum = 0;
    (accArr || []).forEach(function(r){
      var meta = metaById.get(r.id); if (!meta) return;
      if (hasFlag(meta,'Daily') || hasFlag(meta,'Monthly')) return;
      sum += earnedAP(r, meta);
    });
    return sum;
  }
  function computeApiTotal(accArr, metaById){
    var total = 0;
    (accArr || []).forEach(function(r){
      var m = metaById.get(r.id); if (!m) return;
      total += earnedAP(r, m);
    });
    return total;
  }

  // ---------------------------- Carga categorías ----------------------------
  async function ensureCategories(){
    if (state.catsLoaded) return;
    try {
      var url = 'https://api.guildwars2.com/v2/achievements/categories?ids=all&lang=es';
      var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      var arr = await res.json().catch(function(){ return []; });
      if (!Array.isArray(arr)) arr = [];
      state.categories = arr.slice();
      state.catById = new Map(arr.map(function(c){ return [String(c.id), c]; }));
      var map = new Map();
      arr.forEach(function(cat){
        var list = Array.isArray(cat.achievements) ? cat.achievements : [];
        list.forEach(function(entry){
          var achId = (typeof entry === 'number') ? entry : (entry && entry.id);
          if (achId == null) return;
          var key = String(achId);
          if (!map.has(key)) map.set(key, String(cat.id));
        });
      });
      state.achIdToCat = map;
      state.catsLoaded = true;
    } catch(e){
      console.warn(LOGP, 'categories', e);
      state.categories = [];
      state.catById = new Map();
      state.achIdToCat = new Map();
      state.catsLoaded = true;
    }
  }

  // -------------------------- KPI visual de AP ------------------------------
  function injectKpiStyles(){
      if (document.getElementById('ach-kpi-styles')) return;
      var css = `
        .ach-kpi{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:8px 0 6px}
        .ach-kpi__tile{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#0f1013;border:1px solid #26262b}
        .ach-kpi__tile--pot{
          border-left:3px solid #a0ffc8;
          background:linear-gradient(135deg, #0d1a14 0%, #0f1116 100%);
          box-shadow:0 0 10px rgba(160,255,200,0.08);
          margin-left:auto;
          cursor:default;
        }
        .ach-kpi__num{font-size:16px;font-weight:700;color:#ffd27a}
        .ach-kpi__lbl{font-size:12px;color:#cfd2d8}
        .ach-kpi__sep{opacity:.5}
        .ach-kpi__icon img{vertical-align:middle;border-radius:4px;box-shadow:0 0 0 1px #2a2a2f inset}
        .ach-kpi__delta{font-size:12px;color:#a0ffc8;background:#12261b;border:1px solid #265a3c;border-radius:999px;padding:2px 6px}
        @media (prefers-color-scheme: light){ .ach-kpi__num{color:#a26a00} }
      `;
      var s = document.createElement('style'); s.id='ach-kpi-styles'; s.textContent=css;
      document.head.appendChild(s);
  }
  function ensureKpiHeader(){
    injectKpiStyles();
    if (!el.panel) return;
    if (!el.head) el.head = el.panel.querySelector('.panel-head');
    if (el.head && !el.kpiWrap){
      var box = document.createElement('div');
      box.className = 'ach-kpi';
      box.id = 'achKpi';
      el.head.appendChild(box);
      el.kpiWrap = box;
    }
  }

  function potentialAPForThreshold(accArr, metaById, threshold){
      var sum = 0;
      (accArr || []).forEach(function(r){
        var meta = metaById.get(r.id); if (!meta) return;
        var pr = computeProgress(r, meta);
        if (pr.pct >= 1) return;
        if (pr.pct < (threshold||0)) return;
        var left = totalAP(meta) - earnedAP(r, meta);
        if (left > 0) sum += left;
      });
      return sum;
  }
  function renderPotentialAP(){
      // Eliminar chips anteriores
      var allOld = document.querySelectorAll('.ach-potential');
      allOld.forEach(function(el) { el.remove(); });
      
      var head = el.panel ? el.panel.querySelector('.panel-head') : null;
      var h3 = head ? head.querySelector('.panel-head__title') : null;
      if (!h3) return;
      
      var apPot = 0;
      try {
        apPot = potentialAPForThreshold(state.acc, state.metaById, state.pct);
        if (!isFinite(apPot)) apPot = 0;
      } catch(e) { apPot = 0; }
      
      var chip = document.createElement('span');
      chip.className = 'ach-potential';
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:5px 14px;background:#0f1116;border:1px solid #1e2028;border-radius:20px;font-size:0.75rem;white-space:nowrap;';
      chip.innerHTML = '<img src="assets/icons/155059.png" width="16" height="16" alt="" style="border-radius:3px;filter:brightness(0.9);"><span style="color:#9aa2b8;">AP potenciales (≥ ' + Math.round(state.pct*100) + '%)</span><span style="color:#a0ffc8;font-weight:700;">+' + fmtInt(apPot) + '</span>';
      
      // Insertarlo justo después del <h3>, dentro del panel-head
      h3.insertAdjacentElement('afterend', chip);
  }
  function renderKpi(apPerm, apDaily, apLegacyDelta){
      ensureKpiHeader();
      if (!el.kpiWrap) return;
      var permFinal = Number(apPerm||0) + Number(apLegacyDelta||0);
      var total = permFinal + Number(apDaily||0);
      var tipPerm = 'Permanente API'+(apLegacyDelta>0?(' + Legado '+fmtInt(apLegacyDelta)):'');

      el.kpiWrap.innerHTML = [
        '<div class="ach-kpi__tile" title="'+esc(tipPerm)+'">',
          '<a class="ach-kpi__icon" href="'+esc(ICON_AP_PAGE)+'" target="_blank" rel="noopener">'+iconImg(ICON_AP_PERM, 20, 'AP')+'</a>',
          '<span class="ach-kpi__lbl">Permanente</span>',
          (apLegacyDelta>0?('<span class="ach-kpi__delta">+'+fmtInt(apLegacyDelta)+' legado</span>'):''),
          '<span class="ach-kpi__num">'+fmtInt(permFinal)+'</span>',
        '</div>',
        '<div class="ach-kpi__tile" title="Logro diario acumulado (incluye histórico mensual)">',
          '<a class="ach-kpi__icon" href="'+esc(ICON_AP_PAGE)+'" target="_blank" rel="noopener">'+iconImg(ICON_AP_DAILY, 20, 'AP')+'</a>',
          '<span class="ach-kpi__lbl">Logro diario</span>',
          '<span class="ach-kpi__num">'+fmtInt(apDaily)+'</span>',
        '</div>',
        '<span class="ach-kpi__sep">+</span>',
        '<div class="ach-kpi__tile" title="Total de puntos de logro acumulados">',
          '<a class="ach-kpi__icon" href="'+esc(ICON_AP_PAGE)+'" target="_blank" rel="noopener">'+iconImg(ICON_AP_TOTAL, 20, 'AP')+'</a>',
          '<span class="ach-kpi__lbl">Total</span>',
          '<span class="ach-kpi__num">'+fmtInt(total)+'</span>',
        '</div>'
      ].join('');
  }

  // ------------------------------- Render ----------------------------------
  function categoryBadgeHTML(achId){
    var cid = state.achIdToCat.get(String(achId)) || '';
    if (!cid) return '';
    var cat = state.catById.get(String(cid));
    if (!cat) return '';
    var icon = iconImg(cat.icon, 22, cat.name || 'Categoría', 'margin-right:6px;border-radius:3px');
    var name = esc(cat.name || '');
    return '<span class="ach-badge">'+ icon + name + '</span>';
  }

  function wikiLinkHTML(meta){
    var name = meta?.name ? String(meta.name) : '';
    if (!name) return '';
    var href = 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(name);
    return '<a class="btn btn--ghost" href="'+href+'" target="_blank" rel="noopener" title="Abrir en la Wiki">Wiki</a>';
  }

  function rewardsHTML(meta) {
    if (!meta || !Array.isArray(meta.rewards) || !meta.rewards.length) return '';
    var parts = meta.rewards.map(function(r) {
      var icon = '';
      var label = '';
      switch(r.type) {
        case 'Item':
          icon = _rewardCache[r.id] ? _rewardCache[r.id].icon : REWARD_FALLBACK['Item'];
          label = _rewardCache[r.id] ? _rewardCache[r.id].name : ('Ítem #' + r.id);
          if (!_rewardCache[r.id]) loadRewardItemDetail(r.id);
          break;
        case 'Title':
          icon = _titleCache[r.id] ? _titleCache[r.id].icon : REWARD_FALLBACK['Title'];
          label = _titleCache[r.id] ? _titleCache[r.id].name : 'Título';
          if (!_titleCache[r.id]) loadRewardTitleDetail(r.id);
          break;
        case 'Mastery':
          icon = _masteryCache[r.id] ? _masteryCache[r.id].icon : REWARD_FALLBACK['Mastery'];
          label = _masteryCache[r.id] ? _masteryCache[r.id].name : 'Maestría';
          if (!_masteryCache[r.id]) loadRewardMasteryDetail(r.id);
          break;
        case 'Coins':
          icon = REWARD_FALLBACK['Coins'];
          label = fmtInt(r.count || 0) + ' cobre';
          break;
        default:
          return '';
      }
      return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;color:#d0d4e0;margin-right:10px;" title="'+esc(label)+'">' +
        '<img src="'+esc(icon)+'" width="22" height="22" alt="" style="border-radius:4px;filter:brightness(0.95);flex-shrink:0;">' +
        '<span style="font-weight:500;">'+esc(label)+'</span>'+
        '</span>';
    }).filter(Boolean).join('');
    return parts ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;" class="a-rewards">' + parts + '</div>' : '';
  }

  function progressSeverity(pr){
    var pct = Math.round((pr?.pct || 0) * 100);
    if (pct >= 100) return 'done';
    if (pct > 90)   return '90';
    if (pct > 80)   return '80';
    return '';
  }
  function progressBarHTML(pr){
    var pct = Math.round((pr?.pct || 0) * 100);
    var sev = progressSeverity(pr);
    var cls = 'ach-prog__bar' + (sev ? (' ach-prog--' + sev) : '');
    return (
      '<div class="ach-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Progreso '+pct+'%">'+
        '<div class="'+cls+'" style="width:'+pct+'%;"></div>'+
      '</div>'
    );
  }

  function cardMainHTML(meta, r, pr){
    var iconUrl = meta?.icon || 'assets/icons/155059.png';
    var icon = iconImg(iconUrl, 28, meta?.name || 'Logro', 'margin-right:8px;border-radius:4px;flex-shrink:0;');
    var name = esc(meta?.name || ('#' + r.id));
    var catBadge = categoryBadgeHTML(r.id);
    var pctTxt = fmtPct(pr.pct);
    var ratioTxt = pr.cur + '/' + pr.max;
    var wiki = wikiLinkHTML(meta);
    var apTot = totalAP(meta);
    var apGot = earnedAP(r, meta);
    var rewards = rewardsHTML(meta);

    var apHtml = (apTot > 0)
      ? '<span class="pill" title="Puntos de logro (ganados / posibles)">'+
          '<span style="display:inline-flex;align-items:center;gap:6px;">'+
            iconImg(ICON_AP_18, 18, 'AP', 'border-radius:3px')+
            'AP: '+fmtInt(apGot)+' / '+fmtInt(apTot)+
          '</span>'+
        '</span>'
      : '';

    return (
      '<article class="card a-card" data-id="' + r.id + '" data-pct="' + Math.round(pr.pct * 100) + '">' +
        '<div class="card__head a-head">' +
          '<h3 class="card__title a-title">' + icon + name + '</h3>' +
        '</div>' +
        (catBadge ? ('<div class="card__desc a-desc">' + catBadge + '</div>') : '') +
        (rewards ? ('<div class="card__desc a-rewards">' + rewards + '</div>') : '') +
        '<div style="margin-top:auto;">' +
          '<div class="card__meta a-meta">' +
            '<span class="cats" style="font-size:0.72rem;">' + ratioTxt + '</span>' +
            '<span class="a-actions">'+ (apHtml ? apHtml : '') + (wiki ? (' ' + wiki) : '') +'</span>' +
          '</div>' +
          '<div class="ach-progline"><span>Progreso</span><span>'+ pctTxt +'</span></div>' +
          progressBarHTML(pr) +
        '</div>' +
      '</article>'
    );
  }

  function passesFilters(meta, pr, achId){
    if (pr.pct >= 1) return false;
    if (state.cat) {
      var cid = state.achIdToCat.get(String(achId)) || '';
      if (String(cid) !== String(state.cat)) return false;
    }
    if (state.qNorm) {
      var q = state.qNorm;
      var name = norm(meta?.name);
      var desc = norm(meta?.description || '');
      var cat  = norm(String(meta?.category || ''));
      if (!(name.includes(q) || desc.includes(q) || cat.includes(q))) return false;
    }
    if (pr.pct < state.pct) return false;
    if (state.rewardFilter) {
      var rewards = meta.rewards || [];
      if (!rewards.some(function(r) { return r.type === state.rewardFilter; })) return false;
    }
    return true;
  }

  function renderMainGrid(){
    if (!el.mainGrid) return;
    var rows = [];
    (state.acc || []).forEach(function (r) {
      var meta = state.metaById.get(r.id); if (!meta) return;
      var pr = computeProgress(r, meta);
      if (passesFilters(meta, pr, r.id)) rows.push({ r: r, meta: meta, pr: pr });
    });
    rows.sort(function(a,b){ return b.pr.pct - a.pr.pct; });
    rows = rows.slice(0, 60);
    if (!rows.length) {
      el.mainGrid.innerHTML = '<p class="muted">No hay logros que coincidan con los filtros.</p>';
    } else {
      el.mainGrid.innerHTML = rows.map(function(x){ return cardMainHTML(x.meta, x.r, x.pr); }).join('');
    }
    renderKpi(state.apPermanent, state.apDailyHist, state.apLegacyDelta);
    renderPotentialAP();
  }

  // --------------------------- Aside de Logros ------------------------------
  function ensureAsideStyles(){
    if (document.getElementById('ach-aside-styles')) return;
    var css = `
      #achAsidePanel[hidden]{display:none!important;}
      #achAsidePanel .panel__title{margin:0 0 6px}
      .ach-mini-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
      .ach-mini-item{display:grid;gap:2px}
      .ach-mini-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .ach-mini-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .ach-mini-next{font-size:12px;color:#a0a0a6}
      .ach-cats-chips{display:flex;flex-wrap:wrap;gap:6px}
      .ach-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px; background:#10131a;border:1px solid #253045;color:#bcd0ff;font-size:12px;cursor:pointer}
      .ach-chip:hover{border-color:#355180}
    `;
    var s = document.createElement('style'); s.id='ach-aside-styles'; s.textContent=css;
    document.head.appendChild(s);
  }

  function ensureAside(){
    ensureAsideStyles();
    const host = document.querySelector('aside.col-side');
    if (!host) return;
    let p = document.getElementById('achAsidePanel');
    if (!p) {
      p = document.createElement('section');
      p.className = 'panel';
      p.id = 'achAsidePanel';
      host.appendChild(p);
    } else if (p.parentElement !== host) {
      host.appendChild(p);
    }
    const hasTop = !!p.querySelector('#achAsideTop');
    const hasCats = !!p.querySelector('#achAsideCats');
    if (!hasTop || !hasCats) {
      p.innerHTML = '';
      const head1 = document.createElement('div');
      head1.className = 'panel-head';
      const h3_1 = document.createElement('h3');
      h3_1.className = 'panel-head__title';
      h3_1.textContent = 'Más cercanos';
      head1.appendChild(h3_1);
      const hr1 = document.createElement('hr'); hr1.className = 'hr-hairline';
      const body1 = document.createElement('div'); body1.className = 'panel__body';
      const ul = document.createElement('ul'); ul.id = 'achAsideTop'; ul.className = 'ach-mini-list';
      body1.appendChild(ul);
      const head2 = document.createElement('div'); head2.className = 'panel-head';
      const h3_2 = document.createElement('h3'); h3_2.className = 'panel-head__title'; h3_2.textContent = 'Categorías'; head2.appendChild(h3_2);
      const hr2 = document.createElement('hr'); hr2.className = 'hr-hairline';
      const body2 = document.createElement('div'); body2.className = 'panel__body';
      const cats = document.createElement('div'); cats.id = 'achAsideCats'; cats.className = 'ach-cats-chips';
      body2.appendChild(cats);
      p.append(head1, hr1, body1, head2, hr2, body2);
    }
    el.aside = p;
    el.asideTopList = p.querySelector('#achAsideTop');
    el.asideCats = p.querySelector('#achAsideCats');
    p.removeAttribute('hidden');
  }

  function renderAside(rows){
    ensureAside();
    var top = (rows || []).slice(0,5);
    if (el.asideTopList) {
      if (!top.length) {
        el.asideTopList.innerHTML = '<li class="muted">Sin candidatos cercanos con los filtros actuales.</li>';
      } else {
        el.asideTopList.innerHTML = top.map(function(x){
          var icon = iconImg(x.meta?.icon, 16, x.meta?.name, 'margin-right:6px;border-radius:3px');
          var name = esc(x.meta?.name || ('#'+x.r.id));
          var pct = fmtPct(x.pr.pct);
          return (
            '<li class="ach-mini-item">' +
              '<div class="ach-mini-top"><span class="ach-mini-name">'+icon+name+'</span><span class="ach-mini-next">'+pct+'</span></div>' +
            '</li>'
          );
        }).join('');
      }
    }
    if (el.asideCats) {
      var list = state.categories.slice().sort(function(a,b){ return String(a?.name||'').localeCompare(String(b?.name||'')); });
      var activeIdx = list.findIndex(function(c){ return String(c?.id) === String(state.cat||''); });
      var sliced = list.slice(0,30);
      if (activeIdx >= 30 && activeIdx >= 0) sliced.unshift(list[activeIdx]);
      el.asideCats.innerHTML = sliced.map(function(c){
        var icon = iconImg(c.icon, 16, c.name, 'margin-right:6px;border-radius:3px');
        var active = (String(state.cat) === String(c.id));
        return '<button class="ach-chip" data-cid="'+esc(String(c.id))+'" title="'+esc(c.name||'')+'"'+(active?' style="outline:1px solid #355180"':'')+'>'+icon+esc(c.name||('#'+c.id))+'</button>';
      }).join('');
      el.asideCats.querySelectorAll('.ach-chip').forEach(function(btn){
        btn.addEventListener('click', function(){
          var cid = btn.getAttribute('data-cid') || '';
          state.cat = (String(state.cat) === String(cid)) ? '' : String(cid);
          if (el.cat) el.cat.value = state.cat || '';
          writeFiltersToHashSilently();
          renderMainGrid();
        });
      });
    }
  }

  // ------------------------ Toolbar (CSS) ------------------------------
  function injectToolbarStyles(){
    if (document.getElementById('ach-toolbar-styles')) return;
    var css = `
      .ach-toolbar{
        display:flex; flex-wrap:wrap; gap:10px; align-items:center;
        margin:10px 0 0; padding:10px 12px;
        background:#0f1116; border:1px solid #26262b; border-radius:40px;
      }
      .ach-toolbar .group{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
      .ach-toolbar input[type="text"]{min-width:200px}
      .a-card{ display:flex; flex-direction:column; gap:2px; overflow:visible; }
      .a-card *{ min-width:0; }
      .a-head{ display:flex; align-items:flex-start; gap:8px; flex-wrap:wrap; }
      .a-head .a-title{ flex:1 1 auto; min-width:0; }
      .a-title{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
      .a-desc{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
      .a-rewards{ display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
      .a-meta{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; width:100%; }
      .a-meta .cats{ flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; overflow-wrap:anywhere; }
      .a-actions{ display:flex; gap:8px; flex-wrap:wrap; }
      .a-actions .btn{ white-space:nowrap; flex:0 0 auto; }
      .ach-progline{ display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; color:#cfd2d8; font-size:12px; margin-top:2px; }
      .ach-prog{ position:relative; height:8px; background:#16161a; border:1px solid #2d2a2f; border-radius:999px; overflow:hidden; width:100%; box-sizing:border-box; }
      .ach-prog__bar{ position:absolute; left:0; top:0; bottom:0; width:0; transition:width .18s ease; background:linear-gradient(90deg, #f81313 0%, #ff4000 100%); }
      .ach-prog__bar.ach-prog--80{  background: linear-gradient(90deg, #ff4000 0%, #ffa733 100%); }
      .ach-prog__bar.ach-prog--90{  background: linear-gradient(90deg, #ffa733 0%, #f6e100 100%); }
      .ach-prog__bar.ach-prog--done{background: linear-gradient(90deg, #7ff600 0%, #04ff4b 100%); }
      .ach-custom-select { position:relative; display:inline-block; }
      .ach-select-btn { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#1a1c24; border:1px solid #2a2c35; border-radius:20px; color:#e0e4ed; font-size:0.75rem; cursor:pointer; min-width:130px; }
      .ach-select-btn:hover { border-color:#3a3e4a; background:#20222c; }
      .ach-select-list { display:none; position:absolute; top:100%; left:0; z-index:50; background:#1a1c24; border:1px solid #2a2c35; border-radius:8px; padding:4px; min-width:160px; margin-top:4px; max-height:250px; overflow-y:auto; }
      .ach-select-option { display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer; border-radius:6px; color:#b4bad0; font-size:0.75rem; }
      .ach-select-option:hover { background:#252830; color:#e0e4ed; }
      .ach-select-option.active { background:#1a2a3a; color:#7bc2ff; }
    `;
    var s = document.createElement('style'); s.id='ach-toolbar-styles'; s.textContent=css;
    document.head.appendChild(s);
  }

  function ensureRefreshButton(){
    if (!el.panel) return;
    if (!el.head) el.head = el.panel.querySelector('.panel-head');
    if (el.head.querySelector('#achRefreshBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'achRefreshBtn';
    btn.className = 'btn btn--ghost';
    btn.textContent = 'Refrescar';
    btn.title = 'Volver a consultar (sin caché)';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', function () { loadAll({ nocache: true }).catch(function(){}); });
    var titleHost = el.head.querySelector('.panel-head__title');
    if (titleHost && titleHost.parentNode) titleHost.parentNode.appendChild(btn);
    else el.head.appendChild(btn);
  }

  function ensureToolbar(){
    injectToolbarStyles();
    if (!el.panel) return;
    if (!el.head) el.head = el.panel.querySelector('.panel-head');
    if (!el.body) el.body = el.panel.querySelector('.panel__body');
    var hostAfter = el.head || el.panel;

    if (!el.chipsOld) el.chipsOld = $('#achievementsPanel .chips');
    if (el.chipsOld) el.chipsOld.style.display = 'none';
    if (el.toolbar) return;

    var tb = document.createElement('div');
    tb.className = 'ach-toolbar';
    tb.innerHTML = [
      '<div class="group">',
        '<strong style="margin-right:6px;color:#b4bad0;">Logros:</strong>',
        '<input type="text" id="achSearch_alt" placeholder="Buscar logro…">',
      '</div>',
      '<div class="group">',
        // Dropdown Umbral
        '<label style="color:#b4bad0;font-size:0.8rem;">Umbral:</label>',
        '<div class="ach-custom-select">',
          '<button class="ach-select-btn" data-dropdown="achDropdownPct">',
            '<span class="ach-select-btn-text">≥ 80%</span>',
            '<span style="margin-left:auto;font-size:0.6rem;">▼</span>',
          '</button>',
          '<div class="ach-select-list" id="achDropdownPct">',
            '<div class="ach-select-option" data-value="0.8">≥ 80%</div>',
            '<div class="ach-select-option" data-value="0.9">≥ 90%</div>',
            '<div class="ach-select-option" data-value="0.95">≥ 95%</div>',
          '</div>',
        '</div>',
        // Dropdown Categoría
        '<label style="color:#b4bad0;font-size:0.8rem;">Categoría:</label>',
        '<div class="ach-custom-select" id="achCatDropdown">',
          '<button class="ach-select-btn" data-dropdown="achDropdownCat">',
            '<span class="ach-select-btn-text">Todas</span>',
            '<span style="margin-left:auto;font-size:0.6rem;">▼</span>',
          '</button>',
          '<div class="ach-select-list" id="achDropdownCat">',
            '<div class="ach-select-option" data-value="">Todas</div>',
          '</div>',
        '</div>',
        // Dropdown Recompensa
        '<label style="color:#b4bad0;font-size:0.8rem;">Recompensa:</label>',
        '<div id="achRewardDropdown" class="ach-custom-select">',
          '<button id="achRewardBtn" class="ach-select-btn">',
            '<span id="achRewardBtnText">Todas</span>',
            '<span style="margin-left:auto;font-size:0.6rem;">▼</span>',
          '</button>',
          '<div id="achRewardList" class="ach-select-list">',
            '<div class="ach-select-option" data-value="">Todas</div>',
            '<div class="ach-select-option" data-value="Item"><img src="assets/icons/Welcome/1228903.png" width="18" height="18" alt="" style="border-radius:3px;filter:brightness(0.9);">Con ítem</div>',
            '<div class="ach-select-option" data-value="Title"><img src="assets/icons/Welcome/605001.png" width="18" height="18" alt="" style="border-radius:3px;filter:brightness(0.9);">Con título</div>',
            '<div class="ach-select-option" data-value="Mastery"><img src="assets/icons/Welcome/1078543.png" width="18" height="18" alt="" style="border-radius:3px;filter:brightness(0.9);">Con maestría</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    if (hostAfter && hostAfter.parentNode) hostAfter.parentNode.insertBefore(tb, hostAfter.nextSibling);
    else el.panel.insertBefore(tb, el.panel.firstChild);

    el.toolbar = tb;

    var oldSearch = document.getElementById('achSearch');
    el.search = oldSearch || document.getElementById('achSearch_alt');
    if (oldSearch) {
      var slot = document.getElementById('achSearch_alt');
      if (slot) slot.replaceWith(oldSearch);
    }
  }

  function fillCategoryDropdown(){
    var list = document.getElementById('achDropdownCat');
    if (!list || list.__filled) return;
    list.__filled = true;

    var categories = state.categories.slice().sort(function(a,b){
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });

    var html = '<div class="ach-select-option" data-value="">Todas</div>';
    categories.forEach(function(c) {
      var icon = iconImg(c.icon, 16, c.name, 'margin-right:6px;border-radius:3px');
      html += '<div class="ach-select-option" data-value="' + esc(String(c.id)) + '" style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-radius:6px;color:#b4bad0;font-size:0.75rem;">' + icon + esc(c.name || ('#' + c.id)) + '</div>';
    });
    list.innerHTML = html;
  }

  // ------------------------ Toolbar (wiring) ------------------------------
  function wireToolbar(){
    if (el.search && !el.search.__wired) {
      el.search.__wired = true;
      var t = null;
      el.search.addEventListener('input', function(){
        clearTimeout(t);
        t = setTimeout(function(){
          state.qRaw  = el.search.value || '';
          state.qNorm = norm(state.qRaw);
          writeFiltersToHashSilently();
          renderMainGrid();
        }, 120);
      });
    }
    wireCustomDropdowns();
  }

  function wireCustomDropdowns(){
    var dropdowns = document.querySelectorAll('.ach-custom-select');
    dropdowns.forEach(function(dropdown) {
      var btn = dropdown.querySelector('.ach-select-btn');
      var list = dropdown.querySelector('.ach-select-list');
      var btnText = dropdown.querySelector('.ach-select-btn-text');
      if (!btn || !list || btn.__wired) return;
      btn.__wired = true;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = list.style.display === 'block';
        closeAllDropdowns();
        list.style.display = isOpen ? 'none' : 'block';
      });

      var options = list.querySelectorAll('.ach-select-option');
      options.forEach(function(opt) {
        opt.addEventListener('click', function(e) {
          e.stopPropagation();
          var value = this.dataset.value;
          if (btnText) {
            btnText.textContent = this.textContent.trim() || (value || 'Todas');
          }
          options.forEach(function(o) { o.classList.remove('active'); });
          this.classList.add('active');

          var listId = list.id;
          if (listId === 'achDropdownPct') {
            state.pct = parseFloat(value) || 0.8;
          } else if (listId === 'achDropdownCat') {
            state.cat = value || '';
          } else if (listId === 'achRewardList') {
            state.rewardFilter = value || '';
          }

          list.style.display = 'none';
          writeFiltersToHashSilently();
          renderMainGrid();
        });
      });
    });

    if (!document.__achDropdownGlobalWired) {
      document.__achDropdownGlobalWired = true;
      document.addEventListener('click', function() {
        closeAllDropdowns();
      });
    }
  }

  function closeAllDropdowns(){
    document.querySelectorAll('.ach-select-list').forEach(function(list) {
      list.style.display = 'none';
    });
  }

  // ------------------------------- Carga -----------------------------------
  function ensureDomRefs(){
    if (el.panel) return;
    el.panel      = document.getElementById('achievementsPanel');
    el.head       = el.panel ? el.panel.querySelector('.panel-head') : null;
    el.body       = el.panel ? el.panel.querySelector('.panel__body') : null;
    el.mainGrid   = document.getElementById('achievementsMain');
    if (el.mainGrid) el.mainGrid.setAttribute('aria-live','polite');
  }

  function setLoading(on){
    state.loading = !!on;
    if (el.panel) {
      var p = el.body; if (!p) return;
      if (on) p.setAttribute('aria-busy', 'true');
      else p.removeAttribute('aria-busy');
    }
  }

  async function fetchAccountAP(token){
    var url = 'https://api.guildwars2.com/v2/account?access_token='+encodeURIComponent(token);
    var r = await fetch(url, { headers: { 'Accept':'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('account HTTP '+r.status);
    var o = await r.json();
    var daily = Number(o?.daily_ap || 0);
    var monthly = Number(o?.monthly_ap || 0);
    return { dailyHist: daily + monthly, raw: o };
  }

  async function loadAll(opts){
    opts = opts || {};
    const mySeq = ++_loadSeq;
    const tokenAtStart = getSelectedToken();

    if (el.mainGrid) el.mainGrid.innerHTML = '<p class="muted">Cargando logros…</p>';

    ensureDomRefs();
    // ensureRefreshButton(); // Reemplazado por AP potencial en el KPI
    ensureToolbar();
    readFiltersFromHashIntoState();

    var token = getSelectedToken();
        if (!token) {
          state.token = null; state.acc = []; state.metaById = new Map();
          state.apDailyHist = 0; state.apPermanent = 0; state.apLegacyDelta = 0;
          await ensureCategories(); fillCategoryDropdown(); ensureAside(); renderAside([]);
          renderMainGrid();
          var pot = document.querySelector('.ach-potential');
          if (pot) pot.remove();
          return;
        }
        state.token = token;

    setLoading(true);
    try {
      var [acc, apObj] = await Promise.all([
        root.GW2Api.getAccountAchievements(token, { nocache: !!opts.nocache }),
        fetchAccountAP(token)
      ]);
      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;

      state.acc = Array.isArray(acc) ? acc : [];
      state.apDailyHist = Number(apObj?.dailyHist || 0);

      var ids = Array.from(new Set((state.acc || []).map(a => a.id))).filter(id => id != null);
      var metas = ids.length ? await root.GW2Api.getAchievementsMeta(ids, { nocache: !!opts.nocache }) : [];
      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;
      state.metaById = (function buildMetaMap(arr){ var m = new Map(); (arr || []).forEach(x => { if (x && x.id != null) m.set(x.id, x); }); return m; })(metas);

      await ensureCategories();
      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;
      fillCategoryDropdown();
      ensureAside();

      state.apPermanent = computePermanentAP(state.acc, state.metaById);
      var apiTotal = computeApiTotal(state.acc, state.metaById);
      var seenTotal = state.apDailyHist + state.apPermanent;
      state.apLegacyDelta = Math.max(0, apiTotal - seenTotal);

      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;
      state.loaded = true;
      renderMainGrid();

    } catch (e) {
      console.warn(LOGP, e);
      if (el.mainGrid) el.mainGrid.innerHTML = '<p class="muted">No se pudieron cargar logros.</p>';
    } finally {
      wireToolbar();
      setLoading(false);
      if (!state._wiredTokenListener && document && document.addEventListener){
        document.addEventListener('gn:tokenchange', function(){
          if (isActiveRoute()){
            state.loaded = false;
            loadAll({ nocache: true }).catch(err => console.warn(LOGP,'tokenchange reload',err));
          } else {
            state.loaded = false;
          }
        });
        state._wiredTokenListener = true;
      }
      if (!state._wiredHashListener && window && window.addEventListener){
        window.addEventListener('hashchange', function(){
          if (isActiveRoute()){
            loadAll({ nocache: false }).catch(err => console.warn(LOGP,'hashchange render',err));
          }
        });
        state._wiredHashListener = true;
      }
    }
  }

  // ----------------------------- API pública -------------------------------
  var Achievements = {
    async initOnce(){
      ensureDomRefs();
      // ensureRefreshButton(); // Reemplazado por AP potencial en el KPI
      ensureToolbar();
      await loadAll({ nocache: false });
    },
    async render(opts){
      ensureDomRefs();
      // ensureRefreshButton(); // Reemplazado por AP potencial en el KPI
      ensureToolbar();
      if (!state.loaded) {
        await Achievements.initOnce();
        return;
      }
      await loadAll({ nocache: !!(opts && opts.nocache) });
    },
    async onTokenChange(){
      ensureDomRefs();
      state.loaded = false;
      await loadAll({ nocache: true });
    }
  };
  root.Achievements = Achievements;

  (function wireOnce(){
    if (!state._wiredTokenListener && document && document.addEventListener){
      document.addEventListener('gn:tokenchange', function(){
        if (isActiveRoute()){
          state.loaded = false;
          loadAll({ nocache: true }).catch(err => console.warn(LOGP,'tokenchange reload',err));
        } else {
          state.loaded = false;
        }
      });
      state._wiredTokenListener = true;
    }
    if (!state._wiredHashListener && window && window.addEventListener){
      window.addEventListener('hashchange', function(){
        if (isActiveRoute()){
          loadAll({ nocache: false }).catch(err => console.warn(LOGP,'hashchange render',err));
        }
      });
      state._wiredHashListener = true;
    }
  })();

  console.info(LOGP, 'OK v3.2.0 — Toolbar unificada con 3 dropdowns personalizados');

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));