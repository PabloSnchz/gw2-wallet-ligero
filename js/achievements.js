/* ===========================================================================
 * js/achievements.js — Logros enfocado en "próximo a completar"
 * Versión: 3.6.0 (2026-10-24)
 *  - LOG-5 (BL-067): la grilla deja de ser región viva (el lector leía todas las
 *    tarjetas en cada filtro; ahora ach-cards.js avisa solo cuántas quedan). Se van
 *    el interruptor viejo del tracker de legendarias y las referencias sin uso
 *    (buscador viejo, cabecera vieja).
 *    Con esto se retira también js/achievements-theme.js (pintaba tarjetas que ya no existen).
 *  - 3.5.0:
 *  - LOG-3 (BL-067): se va el panel de Logros de la Sidebar («Más cercanos» y
 *    30 categorías de la barra lateral). «Por categoría» la arma js/ach-categories.js
 *    agrupada por expansión o modo. Se fueron también sus utilidades sin uso.
 *  - 3.4.0:
 *  - LOG-2 (BL-067): las tarjetas, los filtros y las recompensas los pinta
 *    js/ach-cards.js (por js/modules.json). Este archivo calcula la lista
 *    (state.rows) y avisa con gn:achievements; setFilter acepta además
 *    búsqueda (q) y recompensa (reward). Se fueron las tarjetas, los
 *    desplegables propios y los pedidos de recompensas de a uno.
 *  - 3.3.0:
 *  - LOG-1 (BL-067): la cabecera, las pestañas y mi línea las pinta
 *    js/ach-view.js (por js/modules.json). Este archivo publica su estado
 *    (getSnapshot, setFilter, _calc y el evento gn:achievements) y deja de
 *    pintar la fila de AP, el chip de AP potenciales y el botón Refrescar
 *    sin uso. Los botones de filtro dicen lo que filtra la grilla
 *    (syncButtons) y el umbral acepta «Todos» (pct 0).
 *  - 3.2.1:
 *  - Idea 55 Tramo 3a: fetchAccountAP() pide /v2/account por
 *    GW2Api.getAccountInfo en vez de fetch crudo con cache:no-store.
 *    El wrapper ya existia (api-gw2.js:393). Se conserva nocache:true,
 *    que es el equivalente del no-store de antes: el AP se relee siempre,
 *    no se mete un TTL de 30 s donde antes no habia ninguno.
 * =========================================================================== */

(function (root) {
  'use strict';

  var LOGP = '[Achievements]';
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };

  var _loadSeq = 0;

  // ---------------------------- Estado / DOM -------------------------------
  var el = { panel: null, body: null, mainGrid: null };

  var state = {
    token: null,
    acc: [],
    rows: [],
    metaById: new Map(),
    categories: [],
    catById: new Map(),
    achIdToCat: new Map(),
    qRaw: '', qNorm: '', pct: 0.8, cat: '',
    rewardFilter: '',
    legendaryCatId: '',
    apDailyHist: 0,
    apPermanent: 0,
    apLegacyDelta: 0,
    loaded: false, loading: false, catsLoaded: false,
    _wiredTokenListener: false, _wiredHashListener: false
  };

  // ------------------------------- Utils -----------------------------------
  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  }
  function getSelectedToken(){ try { return root.__GN__?.getSelectedToken?.() || null; } catch(_){ return null; } }
  function isActiveRoute(){ return (String(location.hash||'').toLowerCase().startsWith('#/account/achievements')); }

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
    if (isFinite(pNum) && pNum >= 0 && pNum <= 1) state.pct = pNum;
    state.cat = cat ? String(cat) : '';
    state.rewardFilter = reward ? String(reward) : '';
  }
  function writeFiltersToHashSilently(){
    var base = '#/account/achievements';
    var params = new URLSearchParams();
    var qRaw = state.qRaw;
    if (qRaw) params.set('q', qRaw);
    if (state.pct !== 0.8) params.set('pct', String(state.pct));
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

  // ------------------ Categoría de colecciones legendarias ------------------
  // Keywords para identificar la categoría "Armas legendarias" en v2/achievements/categories.
  // La API devuelve el nombre en el lang configurado (es por defecto).
  var LEGENDARY_CATEGORY_KEYWORDS = ['legendaria', 'legendary', 'arma legendaria', 'legend'];

  function discoverLegendaryCategory(){
    var cats = state.categories || [];
    for (var i = 0; i < cats.length; i++){
      var name = norm(String(cats[i]?.name || ''));
      if (LEGENDARY_CATEGORY_KEYWORDS.some(function(kw){ return name.indexOf(kw) >= 0; })) {
        state.legendaryCatId = String(cats[i].id);
        return;
      }
    }
    // Fallback: ID 148 es "Legendary Weapon Achievements" en GW2 por defecto
    state.legendaryCatId = '148';
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
    state.rows = rows;
    // ach-view.js (cabecera) y ach-cards.js (filtros y tarjetas) pintan con este estado.
    try { document.dispatchEvent(new CustomEvent('gn:achievements', { detail: { count: rows.length } })); } catch (_) {}
  }

  // ------------------------------- Carga -----------------------------------
  function ensureDomRefs(){
    if (el.panel) return;
    el.panel      = document.getElementById('achievementsPanel');
    el.body       = el.panel ? el.panel.querySelector('.panel__body') : null;
    el.mainGrid   = document.getElementById('achievementsMain');
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
    // Idea 55 Tramo 3a: /v2/account pasa por la capa GW2Api. Antes hacia `fetch`
    // crudo con `cache:'no-store'`, o sea sin TTL, sin retry, sin pool y
    // saltandose la dedupe de inflight: el mismo payload ya lo piden por la capa
    // characters.js (loadAccountData) y accounts-panel.js, en la misma carga.
    // `nocache:true` conserva el `no-store` de antes: el AP se relee siempre.
    var o = await root.GW2Api.getAccountInfo(token, { nocache: true });
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
    readFiltersFromHashIntoState();

    var token = getSelectedToken();
        if (!token) {
          state.token = null; state.acc = []; state.metaById = new Map();
          state.apDailyHist = 0; state.apPermanent = 0; state.apLegacyDelta = 0;
          await ensureCategories(); discoverLegendaryCategory();
          renderMainGrid();
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
      discoverLegendaryCategory();

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
      await loadAll({ nocache: false });
    },
    async render(opts){
      ensureDomRefs();
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
    },
    // LOG-1: estado de solo lectura para ach-view.js (la cabecera y las pestañas).
    getSnapshot: function(){
      return { loaded: state.loaded, loading: state.loading, hasToken: !!getSelectedToken(), acc: state.acc, rows: state.rows,
        metaById: state.metaById, catById: state.catById, achIdToCat: state.achIdToCat, pct: state.pct, cat: state.cat,
        reward: state.rewardFilter, q: state.qRaw, legendaryCatId: state.legendaryCatId,
        ap: { perm: state.apPermanent + state.apLegacyDelta, daily: state.apDailyHist } };
    },
    // Cambia filtros (cat, pct 0..1, q, reward) y repinta. Lo usan ach-view.js y ach-cards.js.
    setFilter: function(f){
      f = f || {};
      if ('cat' in f) state.cat = f.cat ? String(f.cat) : '';
      if (typeof f.pct === 'number' && f.pct >= 0 && f.pct <= 1) state.pct = f.pct;
      if ('q' in f) { state.qRaw = String(f.q || ''); state.qNorm = norm(state.qRaw); }
      if ('reward' in f) state.rewardFilter = ({ Item: 1, Title: 1, Mastery: 1 })[f.reward] ? f.reward : '';
      writeFiltersToHashSilently();
      renderMainGrid();
    },
    cardsByModule: true,
    _calc: { computeProgress: computeProgress, totalAP: totalAP, earnedAP: earnedAP }
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

  console.info(LOGP, 'OK v3.6.0 — cabecera en ach-view.js, tarjetas en ach-cards.js, categorías en ach-categories.js (LOG-5)');

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));