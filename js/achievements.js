/* ===========================================================================
 * js/achievements.js — Achievements con toolbar, aside, wiki links,
 * ocultar completados, categorías e iconos + deep‑links + KPIs AP.
 * Versión: 2.11.0-perf (hotfix watchdog) — 2026‑03‑04
 *
 * Hotfix:
 *  - ⬅️ Removido listener interno de 'gn:tokenchange' (router es la única fuente).
 *  - 🛡️ Watchdog: si no hay progreso en 5s -> abort + reintento conservador.
 *  - ⚙️ Modo conservador: metas en lotes de 50, secuenciales (nocache=false).
 * =========================================================================== */

(function (root) {
  'use strict';

  var LOGP = '[Achievements]';
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };

  var _loadSeq = 0;         // “última llamada gana”
  var _abortCtrl = null;    // AbortController para cortar cargas previas

  // Watchdog (anti-atasco)
  var _wdTimer = null;
  var _lastProgressTs = 0;
  var _conservative = false; // activado por watchdog en reintento
  function _tickProgress(){ _lastProgressTs = Date.now(); }
  function _startWatchdog() {
    _stopWatchdog();
    _tickProgress();
    _wdTimer = setInterval(function(){
      if (Date.now() - _lastProgressTs > 5000) { // 5s sin progreso visible
        try { _abortCtrl && _abortCtrl.abort(); } catch (_){}
        _stopWatchdog();
        _conservative = true; // Próximo intento: secuencial + chunk 50
        _showInfo('La carga de logros tardó más de lo normal. Reintentando en modo conservador…', 'warn');
        // relanzar sin nocache para aprovechar LS/mem
        loadAll({ nocache:false }).catch(function(){});
      }
    }, 1000);
  }
  function _stopWatchdog(){ if (_wdTimer){ clearInterval(_wdTimer); _wdTimer=null; } }

  // ======================= ICONOS OFICIALES (WIKI) =========================
  var ICON_AP_PERM  = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_DAILY = 'https://wiki.guildwars2.com/images/1/14/Daily_Achievement.png';
  var ICON_AP_TOTAL = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_18    = 'https://wiki.guildwars2.com/images/thumb/c/cd/AP.png/30px-AP.png';
  var ICON_AP_PAGE  = 'https://wiki.guildwars2.com/wiki/Achievement_Chest';

  // ------------------------------- Helpers LS ------------------------------
  function lsGet(key){ try{ var j=localStorage.getItem(key); return j?JSON.parse(j):null; }catch(_){ return null; } }
  function lsSet(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){ } }
  function now(){ return Date.now(); }
  function isFresh(entry, ttl){ return !!entry && typeof entry.ts==='number' && (now()-entry.ts)<=ttl; }

  var CATS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  // ---------------------------- Estado / DOM -------------------------------
  var el = {
    panel: null,
    head: null,
    body: null,
    summaryGrid: null,
    summaryStat: null,
    chipsOld: null,
    search: null,
    pct: null,
    nearlyGrid: null,
    toolbar: null,
    cat: null,
    hideDoneChk: null,
    // aside
    aside: null,
    asideTopList: null,
    asideCats: null,
    // KPIs AP
    kpiWrap: null,
    // Banner
    infoBanner: null
  };

  var state = {
    token: null,
    acc: [],
    metaById: new Map(),
    categories: [],
    catById: new Map(),
    achIdToCat: new Map(),
    qRaw: '',
    qNorm: '',
    pct: 0.8,
    cat: '',
    hideDone: false,
    apDailyHist: 0,
    apPermanent: 0,
    apLegacyDelta: 0,
    loaded: false,
    loading: false,
    catsLoaded: false,
    _wiredTokenListener: false,   // (hotfix) queda false; no se cablea
    _wiredHashListener: false,
    _normCache: new Map()
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
  function normStr(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
  function getSelectedToken(){ try { return root.__GN__?.getSelectedToken?.() || null; } catch(_){ return null; } }
  function isActiveRoute(){ return (String(location.hash||'').toLowerCase().startsWith('#/account/achievements')); }
  function getLang(){ try{ return String(root.GW2Api?.__cfg?.LANG || 'es'); }catch(_){ return 'es'; } }
  function getApiBase(){ try{ return String(root.GW2Api?.__cfg?.API_BASE || 'https://api.guildwars2.com'); }catch(_){ return 'https://api.guildwars2.com'; } }

  function iconImg(url, size, alt, extraStyle){
    if(!url) return '';
    var s = Number(size||18), style = extraStyle ? ' style="'+extraStyle+'"' : '';
    return '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" width="'+s+'" height="'+s+'" loading="lazy" decoding="async" referrerpolicy="no-referrer"'+style+' />';
  }

  // --------------------------- Banner / toast -------------------------------
  function _ensureInfoBanner(){
    if (el.infoBanner) return;
    if (!el.panel) return;
    var host = el.panel.querySelector('.panel-head') || el.panel;
    var div = document.createElement('div');
    div.id = 'achInfoBanner';
    div.className = 'alert';
    div.style.margin = '6px 0 0';
    div.style.display = 'none';
    host.appendChild(div);
    el.infoBanner = div;
  }
  function _showInfo(msg, kind){
    _ensureInfoBanner();
    try { window.toast?.(kind==='warn'?'warn':'info', msg, { ttl: 2000 }); } catch(_){}
    if (el.infoBanner){
      el.infoBanner.textContent = String(msg||'');
      el.infoBanner.style.display = 'block';
      el.infoBanner.setAttribute('role', 'status');
    }
  }
  function _hideInfo(){
    if (el.infoBanner){
      el.infoBanner.style.display = 'none';
      el.infoBanner.textContent = '';
    }
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
    var done = parsed.params.get('done') || ''; // 'hide' | ''
    var pNum = pct != null ? parseFloat(pct) : NaN;

    state.qRaw  = String(q||'');
    state.qNorm = normStr(state.qRaw);

    if (isFinite(pNum) && pNum > 0 && pNum <= 1) state.pct = pNum;
    state.cat = cat ? String(cat) : '';
    state.hideDone = (done === 'hide');

    if (el.search) el.search.value = state.qRaw;
    if (el.pct) {
      var allowed = ['0.8','0.9','0.95'];
      el.pct.value = allowed.includes(String(state.pct)) ? String(state.pct) : '0.8';
      state.pct = parseFloat(el.pct.value);
    }
    if (el.cat) el.cat.value = state.cat || '';
    if (el.hideDoneChk) el.hideDoneChk.checked = !!state.hideDone;
  }
  function writeFiltersToHashSilently(){
    var base = '#/account/achievements';
    var params = new URLSearchParams();
    var qRaw = el.search ? (el.search.value || '') : state.qRaw;
    if (qRaw) params.set('q', qRaw);
    if (state.pct && state.pct !== 0.8) params.set('pct', String(state.pct));
    if (state.cat) params.set('cat', String(state.cat));
    if (state.hideDone) params.set('done', 'hide');
    var newHash = params.toString() ? (base + '?' + params.toString()) : base;
    var url = new URL(location.href);
    url.hash = newHash;
    history.replaceState(null, '', url.toString());
    state.qRaw = qRaw; state.qNorm = normStr(qRaw);
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

  // ---------------------------- Carga categorías ----------------------------
  async function ensureCategories(){
    if (state.catsLoaded && state.categories && state.categories.length) return;
    var lang = getLang();
    var lkey = 'ach_cats_v1:' + lang;
    var bag = lsGet(lkey);
    if (isFresh(bag, CATS_TTL_MS) && Array.isArray(bag.data)) {
      hydrateCategories(bag.data);
      state.catsLoaded = true;
      return;
    }
    try {
      var url = getApiBase() + '/v2/achievements/categories?ids=all&lang=' + encodeURIComponent(lang);
      var arr = null;
      if (root.GW2Api && typeof root.GW2Api.jtry === 'function') {
        arr = await root.GW2Api.jtry(url, { /* signal opcional */ });
      } else {
        var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        arr = await res.json().catch(function(){ return []; });
      }
      if (!Array.isArray(arr)) arr = [];
      hydrateCategories(arr);
      lsSet(lkey, { ts: now(), data: arr });
    } catch(e){
      console.warn(LOGP, 'categories', e);
      if (!state.categories || !state.categories.length) {
        state.categories = [];
        state.catById = new Map();
        state.achIdToCat = new Map();
      }
    } finally {
      state.catsLoaded = true;
    }
  }
  function hydrateCategories(arr){
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
  }

  // -------------------------- KPI visual de AP ------------------------------
  function injectKpiStyles(){
    if (document.getElementById('ach-kpi-styles')) return;
    var css = `
      .ach-kpi{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:8px 0 6px}
      .ach-kpi__tile{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#0f1013;border:1px solid #26262b}
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
    var icon = iconImg(cat.icon, 16, cat.name || 'Categoría', 'margin-right:6px;border-radius:3px');
    var name = esc(cat.name || '');
    return '<span class="ach-badge">'+ icon + name + '</span>';
  }
  function wikiLinkHTML(meta){
    var name = meta?.name ? String(meta.name) : '';
    if (!name) return '';
    var href = 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(name);
    return '<a class="btn btn--ghost" href="'+href+'" target="_blank" rel="noopener" title="Abrir en la Wiki">Wiki</a>';
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

  function cardSummaryHTML(meta, r, pr){
    var icon = iconImg(meta?.icon, 18, meta?.name, 'margin-right:6px;border-radius:3px');
    var name = esc(meta?.name || ('#' + r.id));
    var catBadge = categoryBadgeHTML(r.id);

    var pctTxt = fmtPct(pr.pct);
    var ratioTxt = pr.cur + '/' + pr.max;
    var badge = (pr.pct >= 1) ? '<span class="pill pill--ok">Completado</span>' : '';
    var wiki = wikiLinkHTML(meta);

    var apTot = totalAP(meta);
    var apGot = meta ? earnedAP(r, meta) : 0;

    var apHtml = (apTot > 0)
      ? '<span class="pill" title="Puntos de logro (ganados / posibles)">'+
          '<span style="display:inline-flex;align-items:center;gap:6px;">'+
            iconImg(ICON_AP_18, 18, 'AP', 'border-radius:3px')+
            'AP: '+fmtInt(apGot)+' / '+fmtInt(apTot)+
          '</span>'+
        '</span>'
      : '';

    return (
      '<article class="card a-card" data-id="' + r.id + '">' +
        '<div class="card__head a-head">' +
          '<h3 class="card__title a-title">' + icon + name + '</h3>' +
          '<div class="card__amount-wrap a-amount">' + badge + '</div>' +
        '</div>' +
        (catBadge ? ('<div class="card__desc a-desc">' + catBadge + '</div>') : '<div class="card__desc a-desc"></div>') +
        '<div class="card__meta a-meta">' +
          '<span class="cats">' + esc(pr.label) + ' • ' + ratioTxt + '</span>' +
          '<span class="a-actions">'+ (apHtml ? apHtml : '') + (wiki ? (' ' + wiki) : '') +'</span>' +
        '</div>' +
        '<div class="ach-progline"><span>Progreso</span><span>'+ pctTxt +'</span></div>' +
        progressBarHTML(pr) +
      '</article>'
    );
  }

  function rowNearlyHTML(meta, r, pr){
    var icon = iconImg(meta?.icon, 18, meta?.name, 'margin-right:6px;border-radius:3px');
    var name = esc(meta?.name || ('#' + r.id));
    var catBadge = categoryBadgeHTML(r.id);

    var pctTxt = fmtPct(pr.pct);
    var ratioTxt = pr.cur + '/' + pr.max;
    var wiki = wikiLinkHTML(meta);

    var apTot = totalAP(meta);
    var apGot = meta ? earnedAP(r, meta) : 0;

    var apHtml = (apTot > 0)
      ? '<span class="pill" title="Puntos de logro (ganados / posibles)">'+
          '<span style="display:inline-flex;align-items:center;gap:6px;">'+
            iconImg(ICON_AP_18, 18, 'AP', 'border-radius:3px')+
            'AP: '+fmtInt(apGot)+' / '+fmtInt(apTot)+
          '</span>'+
        '</span>'
      : '';

    return (
      '<article class="card a-card" data-id="' + r.id + '">' +
        '<div class="card__head a-head">' +
          '<h3 class="card__title a-title">' + icon + name + '</h3>' +
          '<div class="card__amount-wrap a-amount"></div>' +
        '</div>' +
        (catBadge ? ('<div class="card__desc a-desc">' + catBadge + '</div>') : '<div class="card__desc a-desc"></div>') +
        '<div class="card__meta a-meta">' +
          '<span class="cats">' + ratioTxt + '</span>' +
          '<span class="a-actions">'+ (apHtml ? apHtml : '') + (wiki ? (' ' + wiki) : '') +'</span>' +
        '</div>' +
        '<div class="ach-progline"><span>Progreso</span><span>'+ fmtPct(pr.pct) +'</span></div>' +
        progressBarHTML(pr) +
      '</article>'
    );
  }

  function renderSummary(){
    if (!el.summaryGrid) return;

    var rows = [];
    (state.acc || []).forEach(function (r) {
      var meta = state.metaById.get(r.id) || null;
      var pr = computeProgress(r, meta);
      if (state.hideDone && pr.pct >= 1) return;
      rows.push({ r: r, meta: meta, pr: pr });
    });
    rows.sort(function(a,b){ return b.pr.pct - a.pr.pct; });
    var top = rows.slice(0, 12);
    el.summaryGrid.innerHTML = top.map(function(x){ return cardSummaryHTML(x.meta, x.r, x.pr); }).join('');

    var apPot = potentialAPForThreshold(state.acc, state.metaById, state.pct);
    if (el.summaryStat) {
      var permFinal = state.apPermanent + state.apLegacyDelta;
      el.summaryStat.textContent =
        'AP cuenta — Permanente: ' + fmtInt(permFinal) +
        ' • Diario: ' + fmtInt(state.apDailyHist) +
        ' • Total: ' + fmtInt(permFinal + state.apDailyHist) +
        ' • AP potencial (≥ ' + Math.round(state.pct*100) + '%): ' + fmtInt(apPot);
    }
    renderKpi(state.apPermanent, state.apDailyHist, state.apLegacyDelta);
    _tickProgress();
  }

  // Normalización con memo por id (para filtros)
  function getNormForId(id){
    var key = String(id);
    var cached = state._normCache.get(key);
    if (cached) return cached;
    var m = state.metaById.get(id) || {};
    var v = {
      name: normStr(m.name || ''),
      desc: normStr(m.description || '')
    };
    state._normCache.set(key, v);
    return v;
  }

  function passesFilters(meta, pr, achId){
    if (state.cat) {
      var cid = state.achIdToCat.get(String(achId)) || '';
      if (String(cid) !== String(state.cat)) return false;
    }
    if (state.qNorm) {
      var q = state.qNorm;
      var nrm = getNormForId(achId);
      if (!(nrm.name.includes(q) || nrm.desc.includes(q))) return false;
    }
    if (state.hideDone && pr.pct >= 1) return false;
    if (pr.pct < state.pct) return false;
    return pr.pct < 1;
  }

  // Render "Nearly" por tandas (fluido)
  function renderNearly(){
    if (!el.nearlyGrid) return;
    var rows = [];
    (state.acc || []).forEach(function (r) {
      var meta = state.metaById.get(r.id) || null;
      var pr = computeProgress(r, meta);
      if (passesFilters(meta, pr, r.id)) rows.push({ r: r, meta: meta, pr: pr });
    });
    rows.sort(function(a,b){ return b.pr.pct - a.pr.pct; });
    rows = rows.slice(0, 60);

    if (!rows.length) {
      el.nearlyGrid.innerHTML = '<p class="muted">No hay logros que coincidan con los filtros.</p>';
      renderKpi(state.apPermanent, state.apDailyHist, state.apLegacyDelta);
      renderAside(rows);
      _tickProgress();
      return;
    }

    // Pintamos por tandas para evitar jank
    el.nearlyGrid.innerHTML = ''; // limpia
    var i = 0;
    function pump(deadline){
      var start = i;
      var budgetOk = function(){ return (deadline && typeof deadline.timeRemaining==='function') ? (deadline.timeRemaining() > 8) : true; };
      var count = 0;
      while (i < rows.length && (budgetOk() || count < 5)) {
        i++; count++;
      }
      var html = rows.slice(start, i).map(function(x){ return rowNearlyHTML(x.meta, x.r, x.pr); }).join('');
      if (html) el.nearlyGrid.insertAdjacentHTML('beforeend', html);
      if (i < rows.length) {
        if ('requestIdleCallback' in window) window.requestIdleCallback(pump, { timeout: 250 });
        else setTimeout(function(){ pump(); }, 16);
      } else {
        renderKpi(state.apPermanent, state.apDailyHist, state.apLegacyDelta);
        _tickProgress();
      }
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(pump, { timeout: 250 });
    else setTimeout(function(){ pump(); }, 0);

    renderAside(rows);
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
      h3_1.textContent = 'Casi listos (Top 5)';
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
  function renderAside(rowsNearly){
    ensureAside();
    var top = (rowsNearly || []).slice(0,5);
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
      if (activeIdx >= 30 && activeIdx >= 0) sliced.unshift(list[activeIdx]); // asegurar visible

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
          renderNearly();
          renderSummary();
        });
      });
    }
  }

  // ------------------------ Toolbar + acciones ------------------------------
  function injectToolbarStyles(){
    if (document.getElementById('ach-toolbar-styles')) return;
    var css = `
      .ach-toolbar{
        display:flex; flex-wrap:wrap; gap:10px; align-items:center;
        margin:10px 0 0; padding:10px 12px;
        background:#0f1013; border:1px solid #26262b; border-radius:12px;
      }
      .ach-toolbar .group{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
      .ach-toolbar input[type="text"]{min-width:220px}
      .ach-toolbar select{min-width:160px}
      .ach-toolbar .pill--ok{background:#172318;border-color:#284c36;color:#b9f3c8}
      .pill--ok {background:#172318 !important;border-color:#284c36 !important;color:#b9f3c8 !important;}
      .card.a-card{ padding-right:12px !important; }
      .a-card{ display:flex; flex-direction:column; gap:6px; overflow:visible; }
      .a-card *{ min-width:0; }
      .a-head{ display:flex; align-items:flex-start; gap:8px; flex-wrap:wrap; }
      .a-head .a-title{ flex:1 1 auto; min-width:0; }
      .a-head .a-amount{ flex:0 0 auto; }
      .a-title{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
      .a-desc{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
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
    btn.addEventListener('click', function () { _conservative=false; _hideInfo(); loadAll({ nocache: true }).catch(function(){}); });
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
        '<strong style="margin-right:6px">Logros:</strong>',
        '<input type="text" id="achSearch_alt" placeholder="Buscar logro…">',
      '</div>',
      '<div class="group">',
        '<label>Umbral %: ',
          '<select id="achPct_alt">',
            '<option value="0.8">≥ 80%</option>',
            '<option value="0.9">≥ 90%</option>',
            '<option value="0.95">≥ 95%</option>',
          '</select>',
        '</label>',
        '<label>Categoría: ',
          '<select id="achCat"><option value="">(Todas)</option></select>',
        '</label>',
        '<label class="ach-hide-done"><input type="checkbox" id="achHideDone"> Ocultar completados</label>',
      '</div>'
    ].join('');

    if (hostAfter && hostAfter.parentNode) hostAfter.parentNode.insertBefore(tb, hostAfter.nextSibling);
    else el.panel.insertBefore(tb, el.panel.firstChild);

    el.toolbar = tb;

    var oldSearch = document.getElementById('achSearch');
    var oldPct = document.getElementById('achPct');

    el.search = oldSearch || document.getElementById('achSearch_alt');
    el.pct    = oldPct    || document.getElementById('achPct_alt');
    el.cat    = document.getElementById('achCat');
    el.hideDoneChk = document.getElementById('achHideDone');

    if (oldSearch) { var slot = document.getElementById('achSearch_alt'); slot.replaceWith(oldSearch); }
    if (oldPct)    { var slot2 = document.getElementById('achPct_alt'); slot2.replaceWith(oldPct); }
  }
  function fillCategorySelect(){
    if (!el.cat) return;
    if (el.cat.__filled) return;
    var frag = document.createDocumentFragment();
    var list = state.categories.slice().sort(function(a,b){
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
    list.forEach(function (c) {
      var o = document.createElement('option');
      o.value = String(c.id);
      o.textContent = c.name || ('#' + c.id);
      frag.appendChild(o);
    });
    el.cat.appendChild(frag);
    el.cat.__filled = true;
    el.cat.value = state.cat || '';
  }
  function wireToolbar(){
    if (el.search && !el.search.__wired) {
      el.search.__wired = true;
      var t = null;
      el.search.addEventListener('input', function(){
        clearTimeout(t);
        t = setTimeout(function(){
          state.qRaw  = el.search.value || '';
          state.qNorm = normStr(state.qRaw);
          writeFiltersToHashSilently();
          renderNearly();
          renderSummary();
        }, 120);
      });
    }
    if (el.pct && !el.pct.__wired) {
      el.pct.__wired = true;
      el.pct.addEventListener('change', function(){
        var v = parseFloat(el.pct.value || '0.8');
        state.pct = (isFinite(v) ? v : 0.8);
        writeFiltersToHashSilently();
        renderNearly();
        renderSummary();
      });
    }
    if (el.cat && !el.cat.__wired) {
      el.cat.__wired = true;
      el.cat.addEventListener('change', function(){
        state.cat = el.cat.value || '';
        writeFiltersToHashSilently();
        renderNearly();
        renderSummary();
      });
    }
    if (el.hideDoneChk && !el.hideDoneChk.__wired) {
      el.hideDoneChk.__wired = true;
      el.hideDoneChk.addEventListener('change', function(){
        state.hideDone = !!el.hideDoneChk.checked;
        writeFiltersToHashSilently();
        renderSummary();
        renderNearly();
      });
    }
  }

  // ------------------------------- Carga -----------------------------------
  function ensureDomRefs(){
    if (el.panel) return;
    el.panel       = document.getElementById('achievementsPanel');
    el.head        = el.panel ? el.panel.querySelector('.panel-head') : null;
    el.body        = el.panel ? el.panel.querySelector('.panel__body') : null;
    el.summaryGrid = document.getElementById('achievementsSummary');
    el.summaryStat = document.getElementById('achSummaryStat');
    el.nearlyGrid  = document.getElementById('achievementsNearly');
    if (el.summaryGrid) el.summaryGrid.setAttribute('aria-live','polite');
    if (el.nearlyGrid)  el.nearlyGrid.setAttribute('aria-live','polite');
  }
  function setLoading(on){
    state.loading = !!on;
    if (el.panel) {
      var p = el.body; if (!p) return;
      if (on) p.setAttribute('aria-busy', 'true');
      else p.removeAttribute('aria-busy');
    }
  }

  async function fetchAccountAP(token, opts){
    opts = opts || {};
    try {
      var url = getApiBase() + '/v2/account?access_token='+encodeURIComponent(token);
      var o = await root.GW2Api.jtry(url, { signal: opts.signal });
      if (!o) return { dailyHist: 0, raw: null };
      var daily = Number(o?.daily_ap || 0);
      var monthly = Number(o?.monthly_ap || 0);
      _tickProgress();
      return { dailyHist: daily + monthly, raw: o };
    } catch(e){
      console.warn(LOGP, 'account AP', e);
      return { dailyHist: 0, raw: null };
    }
  }

  // Wrapper para metas: normal vs conservador
  async function fetchMetas(ids, opts){
    if (!_conservative) {
      var arr = await root.GW2Api.getAchievementsMeta(ids, { nocache: !!opts.nocache, signal: opts.signal });
      _tickProgress();
      return arr || [];
    }
    // Modo conservador: secuencial en chunks de 50
    var out = [];
    var size = 50;
    for (var i=0;i<ids.length;i+=size){
      var slice = ids.slice(i, i+size);
      try{
        var part = await root.GW2Api.getAchievementsMeta(slice, { nocache:false, signal: opts.signal });
        if (Array.isArray(part)) out.push.apply(out, part);
        _tickProgress();
      }catch(e){
        if (e && e.name==='AbortError') throw e;
        console.warn(LOGP, 'meta slice error (conservador)', e && (e.status||e.message), slice.slice(0,5), '('+slice.length+' ids)');
      }
    }
    return out;
  }

  async function loadAll(opts){
    opts = opts || {};

    try { if (_abortCtrl) _abortCtrl.abort(); } catch(_){}
    _abortCtrl = new AbortController();

    const mySeq = ++_loadSeq;
    const tokenAtStart = getSelectedToken();

    _startWatchdog();
    _hideInfo();

    if (el.summaryGrid) el.summaryGrid.innerHTML = '<p class="muted">Cargando logros…</p>';
    if (el.nearlyGrid)  el.nearlyGrid.innerHTML  = '<p class="muted">Cargando…</p>';

    ensureDomRefs();
    ensureRefreshButton();
    ensureToolbar();
    readFiltersFromHashIntoState();

    var token = getSelectedToken();
    if (!token) {
      state.token = null; state.acc = []; state.metaById = new Map();
      state.apDailyHist = 0; state.apPermanent = 0; state.apLegacyDelta = 0;
      await ensureCategories(); fillCategorySelect(); ensureAside(); renderAside([]);
      renderSummary(); renderNearly();
      _stopWatchdog();
      return;
    }
    state.token = token;

    setLoading(true);
    try {
      var [acc, apObj] = await Promise.all([
        root.GW2Api.getAccountAchievements(token, { nocache: !!opts.nocache, signal: _abortCtrl.signal }),
        fetchAccountAP(token, { signal: _abortCtrl.signal }),
        ensureCategories().catch(function(e){ console.warn(LOGP,'cats',e); })
      ]);
      _tickProgress();
      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;

      state.acc = Array.isArray(acc) ? acc : [];
      state.apDailyHist = Number(apObj?.dailyHist || 0);

      var ids = Array.from(new Set((state.acc || []).map(function(a){return a.id;}))).filter(function(id){ return id != null; });
      var metas = ids.length ? await fetchMetas(ids, { nocache: !!opts.nocache, signal: _abortCtrl.signal }) : [];
      if (mySeq !== _loadSeq || tokenAtStart !== getSelectedToken()) return;
      state.metaById = (function buildMetaMap(arr){ var m = new Map(); (arr || []).forEach(function(x){ if (x && x.id != null) m.set(x.id, x); }); return m; })(metas);

      fillCategorySelect();
      ensureAside();
      state._normCache.clear();

      state.apPermanent = computePermanentAP(state.acc, state.metaById);
      var apiTotal = computeApiTotal(state.acc, state.metaById);
      var seenTotal = state.apDailyHist + state.apPermanent;
      state.apLegacyDelta = Math.max(0, apiTotal - seenTotal);

      state.loaded = true;
      renderSummary();
      renderNearly();
      _tickProgress();

    } catch (e) {
      if (e && e.name === 'AbortError') { console.debug(LOGP, 'carga abortada'); return; }
      console.warn(LOGP, e);
      if (el.nearlyGrid) el.nearlyGrid.innerHTML = '<p class="muted">No se pudieron cargar logros.</p>';
      if (el.summaryGrid) el.summaryGrid.innerHTML = '';
      if (el.summaryStat) el.summaryStat.textContent = '—';
    } finally {
      wireToolbar();
      setLoading(false);
      // (hotfix) NO cableamos 'gn:tokenchange' aquí.
      if (!state._wiredHashListener && window && window.addEventListener){
        window.addEventListener('hashchange', function(){
          if (isActiveRoute()){
            loadAll({ nocache: false }).catch(function(err){ console.warn(LOGP,'hashchange render',err); });
          }
        });
        state._wiredHashListener = true;
      }
      _stopWatchdog();
    }
  }

  // ----------------------------- API pública -------------------------------
  var Achievements = {
    async initOnce(){
      ensureDomRefs();
      ensureRefreshButton();
      ensureToolbar();
      await loadAll({ nocache: false });
    },
    async render(opts){
      ensureDomRefs();
      ensureRefreshButton();
      ensureToolbar();
      if (!state.loaded) {
        await Achievements.initOnce();
        return;
      }
      await loadAll({ nocache: !!(opts && opts.nocache) });
    },
    async onTokenChange(){ // el router puede preferir llamar a render(), dejamos compat
      ensureDomRefs();
      state.loaded = false;
      await loadAll({ nocache: true });
    },
    // Prefetch “ligero” (no conservador)
    async prefetch(token){
      try {
        var api = root.GW2Api;
        if (!api) return;
        var tok = token || getSelectedToken();
        await ensureCategories();
        if (!tok) return;
        var acc = await api.getAccountAchievements(tok, { nocache: false });
        var ids = Array.from(new Set((acc||[]).map(function(a){return a.id;}))).filter(function(id){return id!=null;});
        if (ids.length) { await api.getAchievementsMeta(ids, { nocache: false }); }
      } catch (e) {
        console.warn(LOGP, 'prefetch warn', e);
      }
    }
  };
  root.Achievements = Achievements;

  // (hotfix) NO agregamos listener 'gn:tokenchange' en este archivo.
  // El router (v2.9.6-guards) es el único que reacciona a ese evento.

  console.info(LOGP, 'OK v2.11.0-perf (hotfix watchdog) — router orquesta; watchdog anti-atascos');

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));