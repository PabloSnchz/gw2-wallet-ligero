/* ===========================================================================
 * js/achievements.js — Achievements con toolbar, aside, wiki links,
 * ocultar completados, categorías e iconos (logro+categoría) + deep‑links.
 * Versión: 2.6.0 (2026‑02‑27)
 * =========================================================================== */

(function (root) {
  'use strict';

  var LOGP = '[Achievements]';
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };

  // ---------------------------- Estado / DOM -------------------------------
  var el = {
    panel: null,
    head: null,
    body: null,
    summaryGrid: null,
    summaryStat: null,
    chipsOld: null,     // contenedor antiguo de filtros (se oculta)
    search: null,
    pct: null,
    nearlyGrid: null,
    toolbar: null,
    cat: null,
    hideDoneChk: null,
    // aside
    aside: null,
    asideTopList: null,
    asideCats: null
  };

  var state = {
    token: null,
    acc: [],                 // /v2/account/achievements
    metaById: new Map(),     // id -> meta /v2/achievements
    // categorías
    categories: [],
    catById: new Map(),      // id -> category
    achIdToCat: new Map(),   // achievementId -> categoryId
    // filtros
    q: '',
    pct: 0.8,
    cat: '',                 // '' = todas | string(categoryId)
    hideDone: false,         // Ocultar completados (afecta “Casi listos”)
    // flags
    loaded: false,
    loading: false,
    catsLoaded: false
  };

  // ------------------------------- Utils -----------------------------------
  function pct100(x){ return Math.round(x*1000)/10; }
  function fmtPct(x){ return pct100(x).toFixed(1) + '%'; }
  function esc(s) {
    return String(s || '').replace(/[&<>\"']/g, function (m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
  }
  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  }
  function getSelectedToken(){ try { return root.__GN__?.getSelectedToken?.() || null; } catch(_){ return null; } }

  // Icons helper (directo del API). Si querés usar GW2 Treasures 16/32/64, reescribí acá.
  function iconImg(url, size, alt){
    if(!url) return '';
    var s = Number(size||18);
    return '<img src="'+esc(url)+'" alt="'+esc(alt||'')+'" width="'+s+'" height="'+s+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="vertical-align:middle;border-radius:3px;margin-right:6px" />';
  }

  // --------------------------- Deep‑links (hash) ----------------------------
  // hash: #/account/achievements?q=...&pct=0.9&cat=123&done=hide
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

    // 🔧 Mejora: normalizamos para filtrar, mostramos crudo en el input
    var rawQ = String(q || '');
    state.q = norm(rawQ);

    if (isFinite(pNum) && pNum > 0 && pNum <= 1) state.pct = pNum;
    state.cat = cat ? String(cat) : '';
    state.hideDone = (done === 'hide');

    // Sincronizar UI
    if (el.search) el.search.value = rawQ;
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
    // Guardamos el query SIN normalizar (lo que ve el usuario)
    var qRaw = el.search ? (el.search.value || '') : state.q;
    if (qRaw) params.set('q', qRaw);
    if (state.pct && state.pct !== 0.8) params.set('pct', String(state.pct));
    if (state.cat) params.set('cat', String(state.cat));
    if (state.hideDone) params.set('done', 'hide');
    var newHash = params.toString() ? (base + '?' + params.toString()) : base;
    var url = new URL(location.href);
    url.hash = newHash;
    history.replaceState(null, '', url.toString());
  }

  // ------------------------ Modelo de progreso ------------------------------
  function computeProgress(accountRec, meta){
    var cur = Number(accountRec?.current || 0);
    var max = Number(accountRec?.max || 0);
    var done = !!accountRec?.done;
    if (done) return { cur: max || cur, max: max || cur || 1, pct: 1, label: 'Completado' };

    var tiers = Array.isArray(meta?.tiers) ? meta.tiers : [];
    var target = 0;
    if (tiers.length) {
      var last = tiers[tiers.length - 1];
      target = Math.max(target, Number(last?.count || 0));
    }
    if (!target && max) target = max;
    if (!target || target <= 0) {
      var denom = (cur > 0) ? cur : 1;
      return { cur: cur, max: denom, pct: Math.min(1, cur/denom), label: 'Progreso' };
    }
    var ratio = Math.max(0, Math.min(1, cur / target));
    return { cur: cur, max: target, pct: ratio, label: ratio >= 1 ? 'Completado' : 'Progreso' };
  }

  function statSummary(accArr, metaById){
    var total = 0, completed = 0;
    (accArr || []).forEach(function (r){
      var meta = metaById.get(r.id);
      if (!meta) return;
      total++;
      if (r.done) completed++;
      else {
        var pr = computeProgress(r, meta);
        if (pr.pct >= 1) completed++;
      }
    });
    var ratio = total ? (completed/total) : 0;
    return { total: total, completed: completed, pct: ratio };
  }

  // ---------------------------- Carga categorías ----------------------------
  async function ensureCategories(){
    if (state.catsLoaded) return;
    try {
      // /v2/achievements/categories: name + icon + achievements (por categoría)
      var url = 'https://api.guildwars2.com/v2/achievements/categories?ids=all&lang=es';
      var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      var arr = await res.json().catch(function(){ return []; });
      if (!Array.isArray(arr)) arr = [];
      state.categories = arr.slice();
      state.catById = new Map(arr.map(function(c){ return [String(c.id), c]; }));

      // achievementId -> categoryId (primera coincidencia)
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

  // ------------------------------- Render ----------------------------------
  function categoryBadgeHTML(achId){
    var cid = state.achIdToCat.get(String(achId)) || '';
    if (!cid) return '';
    var cat = state.catById.get(String(cid));
    if (!cat) return '';
    var icon = iconImg(cat.icon, 16, cat.name || 'Categoría');
    var name = esc(cat.name || '');
    return '<span class="ach-badge">'+ icon + name + '</span>';
  }

  function wikiLinkHTML(meta){
    var name = meta?.name ? String(meta.name) : '';
    if (!name) return '';
    var href = 'https://wiki.guildwars2.com/wiki/' + encodeURIComponent(name);
    return '<a class="btn btn--ghost" href="'+href+'" target="_blank" rel="noopener" title="Abrir en la Wiki">Wiki</a>';
  }

  function cardSummaryHTML(meta, r, pr){
    var icon = iconImg(meta?.icon, 18, meta?.name);
    var name = esc(meta?.name || ('#' + r.id));
    var catBadge = categoryBadgeHTML(r.id);
    var ptxt = pr.cur + '/' + pr.max + ' (' + fmtPct(pr.pct) + ')';
    var badge = (pr.pct >= 1)
      ? '<span class="pill pill--ok">Completado</span>'
      : '<span class="pill">' + fmtPct(pr.pct) + '</span>';

    var wiki = wikiLinkHTML(meta);

    return (
      '<article class="card a-card" data-id="' + r.id + '">' +
        '<button class="star" data-star="'+r.id+'" title="Favorito" style="display:none">★</button>' + // reservado
        '<div class="card__head a-head">' +
          '<h3 class="card__title a-title">' + icon + name + '</h3>' +
          '<div class="card__amount-wrap a-amount">' + badge + '</div>' +
        '</div>' +
        (catBadge ? ('<div class="card__desc a-desc">' + catBadge + '</div>') : '<div class="card__desc a-desc"></div>') +
        '<div class="card__meta a-meta">' +
          '<span class="cats">' + esc(pr.label) + ' • ' + ptxt + '</span>' +
          (wiki ? ('<span class="a-actions">' + wiki + '</span>') : '') +
        '</div>' +
      '</article>'
    );
  }

  function renderSummary(){
    if (!el.summaryGrid) return;

    var rows = [];
    (state.acc || []).forEach(function (r) {
      var meta = state.metaById.get(r.id);
      if (!meta) return;

      var pr = computeProgress(r, meta);

      // 🔥 NUEVO: si “Ocultar completados” está activo → excluimos pct = 1
      if (state.hideDone && pr.pct >= 1) return;

      rows.push({ r: r, meta: meta, pr: pr });
    });

    // Orden descendente por % completado
    rows.sort(function(a,b){ return b.pr.pct - a.pr.pct; });

    // TOP 12 incompletos
    var top = rows.slice(0, 12);

    el.summaryGrid.innerHTML = top.map(function(x){
      return cardSummaryHTML(x.meta, x.r, x.pr);
    }).join('');

    // Recalcular estadísticas solo con el subset filtrado
    var total = rows.length;
    var completed = rows.filter(x => x.pr.pct >= 1).length;
    var pct = total ? completed / total : 0;

    if (el.summaryStat)
      el.summaryStat.textContent =
        'Completados: ' + completed + '/' + total + ' (' + fmtPct(pct) + ')';
  }

  function rowNearlyHTML(meta, r, pr){
    var icon = iconImg(meta?.icon, 18, meta?.name);
    var name = esc(meta?.name || ('#' + r.id));
    var catBadge = categoryBadgeHTML(r.id);
    var ptxt = pr.cur + '/' + pr.max + ' • ' + fmtPct(pr.pct);
    var wiki = wikiLinkHTML(meta);

    return (
      '<article class="card a-card" data-id="' + r.id + '">' +
        '<div class="card__head a-head">' +
          '<h3 class="card__title a-title">' + icon + name + '</h3>' +
          '<div class="card__amount-wrap a-amount"><span class="pill">' + fmtPct(pr.pct) + '</span></div>' +
        '</div>' +
        (catBadge ? ('<div class="card__desc a-desc">' + catBadge + '</div>') : '<div class="card__desc a-desc"></div>') +
        '<div class="card__meta a-meta">' +
          '<span class="cats">' + ptxt + '</span>' +
          (wiki ? ('<span class="a-actions">' + wiki + '</span>') : '') +
        '</div>' +
      '</article>'
    );
  }

  function passesFilters(meta, pr, achId){
    // Filtro por categoría
    if (state.cat) {
      var cid = state.achIdToCat.get(String(achId)) || '';
      if (String(cid) !== String(state.cat)) return false;
    }

    // Filtro por búsqueda
    if (state.q) {
      var q = state.q;
      var name = norm(meta?.name);
      var desc = norm(meta?.description || '');
      var cat  = norm(String(meta?.category || ''));
      if (!(name.includes(q) || desc.includes(q) || cat.includes(q))) return false;
    }

    // Ocultar completados (sin afectar el panel resumen)
    if (state.hideDone && pr.pct >= 1) return false;

    // “Casi listos”: >= umbral y < 100%
    if (pr.pct < state.pct) return false;
    return pr.pct < 1;
  }

  function renderNearly(){
    if (!el.nearlyGrid) return;
    var rows = [];
    (state.acc || []).forEach(function (r) {
      var meta = state.metaById.get(r.id); if (!meta) return;
      var pr = computeProgress(r, meta);
      if (passesFilters(meta, pr, r.id)) rows.push({ r: r, meta: meta, pr: pr });
    });
    rows.sort(function(a,b){ return b.pr.pct - a.pr.pct; });
    rows = rows.slice(0, 60);

    if (!rows.length) {
      el.nearlyGrid.innerHTML = '<p class="muted">No hay logros que coincidan con los filtros.</p>';
    } else {
      el.nearlyGrid.innerHTML = rows.map(function(x){ return rowNearlyHTML(x.meta, x.r, x.pr); }).join('');
    }

    // Actualiza aside también
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

    // 1) Asegurar el contenedor #achAsidePanel
    let p = document.getElementById('achAsidePanel');
    if (!p) {
      p = document.createElement('section');
      p.className = 'panel';
      p.id = 'achAsidePanel';
      host.appendChild(p);
    } else if (p.parentElement !== host) {
      host.appendChild(p); // mover al contenedor correcto si hiciera falta
    }

    // 2) (Re)construir el esqueleto si está vacío o incompleto
    const hasTop = !!p.querySelector('#achAsideTop');
    const hasCats = !!p.querySelector('#achAsideCats');
    if (!hasTop || !hasCats) {
      // Limpiar placeholders/estructuras parciales
      p.innerHTML = '';

      // ====== Bloque "Casi listos (Top 5)" ======
      const head1 = document.createElement('div');
      head1.className = 'panel-head';
      const h3_1 = document.createElement('h3');
      h3_1.className = 'panel-head__title';
      h3_1.textContent = 'Casi listos (Top 5)';
      head1.appendChild(h3_1);

      const hr1 = document.createElement('hr');
      hr1.className = 'hr-hairline';

      const body1 = document.createElement('div');
      body1.className = 'panel__body';
      const ul = document.createElement('ul');
      ul.id = 'achAsideTop';
      ul.className = 'ach-mini-list';
      body1.appendChild(ul);

      // ====== Bloque "Categorías" ======
      const head2 = document.createElement('div');
      head2.className = 'panel-head';
      const h3_2 = document.createElement('h3');
      h3_2.className = 'panel-head__title';
      h3_2.textContent = 'Categorías';
      head2.appendChild(h3_2);

      const hr2 = document.createElement('hr');
      hr2.className = 'hr-hairline';

      const body2 = document.createElement('div');
      body2.className = 'panel__body';
      const cats = document.createElement('div');
      cats.id = 'achAsideCats';
      cats.className = 'ach-cats-chips';
      body2.appendChild(cats);

      // Ensamblar
      p.append(head1, hr1, body1, head2, hr2, body2);
    }

    // 3) Guardar refs y asegurar visibilidad
    el.aside = p;
    el.asideTopList = p.querySelector('#achAsideTop');
    el.asideCats = p.querySelector('#achAsideCats');
    p.removeAttribute('hidden');
  }

  function renderAside(rowsNearly){
    ensureAside();
    // Top 5 “casi listos”
    var top = (rowsNearly || []).slice(0,5);
    if (el.asideTopList) {
      if (!top.length) {
        el.asideTopList.innerHTML = '<li class="muted">Sin candidatos cercanos con los filtros actuales.</li>';
      } else {
        el.asideTopList.innerHTML = top.map(function(x){
          var icon = iconImg(x.meta?.icon, 16, x.meta?.name);
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
    // Chips de categorías
    if (el.asideCats) {
      var list = state.categories.slice().sort(function(a,b){ return String(a?.name||'').localeCompare(String(b?.name||'')); }).slice(0,30);
      el.asideCats.innerHTML = list.map(function(c){
        var icon = iconImg(c.icon, 16, c.name);
        var active = (String(state.cat) === String(c.id));
        return '<button class="ach-chip" data-cid="'+esc(String(c.id))+'" title="'+esc(c.name||'')+'"'+(active?' style="outline:1px solid #355180"':'')+'>'+icon+esc(c.name||('#'+c.id))+'</button>';
      }).join('');

      // Wire
      el.asideCats.querySelectorAll('.ach-chip').forEach(function(btn){
        btn.addEventListener('click', function(){
          var cid = btn.getAttribute('data-cid') || '';
          state.cat = (String(state.cat) === String(cid)) ? '' : String(cid);
          if (el.cat) el.cat.value = state.cat || '';
          writeFiltersToHashSilently();
          renderNearly();
        });
      });
    }
  }

  // ------------------------ Botón Refrescar + Toolbar ----------------------
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
      /* FIX: restablecer verde para “Completado” */
      .pill--ok {background:#172318 !important;border-color:#284c36 !important;color:#b9f3c8 !important;}
      /* Anti‑overflow en tarjetas */
      .a-card{overflow:hidden}
      .a-head{align-items:flex-start}
      .a-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .a-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .a-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .a-actions{display:inline-flex;gap:8px}
    `;
    var s = document.createElement('style'); s.id='ach-toolbar-styles'; s.textContent=css;
    document.head.appendChild(s);
  }

  function ensureRefreshButton(){
    if (!el.panel) return;
    if (!el.head) {
      el.head = el.panel.querySelector('.panel-head');
      if (!el.head) return;
    }
    if (el.head.querySelector('#achRefreshBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'achRefreshBtn';
    btn.className = 'btn btn--ghost';
    btn.textContent = 'Refrescar';
    btn.title = 'Volver a consultar (sin caché)';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', function () {
      loadAll({ nocache: true }).catch(function(){});
    });

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

    // Ocultar chips originales si existen
    if (!el.chipsOld) el.chipsOld = $('#achievementsPanel .chips');
    if (el.chipsOld) el.chipsOld.style.display = 'none';

    if (el.toolbar) return;

    var tb = document.createElement('div');
    tb.className = 'ach-toolbar';
    tb.innerHTML = [
      '<div class="group">',
        '<strong style="margin-right:6px">Logros:</strong>',
        // Search (si existían los nodos originales, los adoptamos)
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

    // Insertar inmediatamente debajo del header
    if (hostAfter && hostAfter.parentNode) hostAfter.parentNode.insertBefore(tb, hostAfter.nextSibling);
    else el.panel.insertBefore(tb, el.panel.firstChild);

    el.toolbar = tb;

    // Reusar nodos originales si existen
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

    // Sincronizar valor desde state/hash
    el.cat.value = state.cat || '';
  }

  function wireToolbar(){
    if (el.search && !el.search.__wired) {
      el.search.__wired = true;
      var t = null;
      el.search.addEventListener('input', function(){
        clearTimeout(t);
        t = setTimeout(function(){
          state.q = norm(el.search.value || '');
          writeFiltersToHashSilently();
          renderNearly();
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
      });
    }
    if (el.cat && !el.cat.__wired) {
      el.cat.__wired = true;
      el.cat.addEventListener('change', function(){
        state.cat = el.cat.value || '';
        writeFiltersToHashSilently();
        renderNearly();
      });
    }
    if (el.hideDoneChk && !el.hideDoneChk.__wired) {
      el.hideDoneChk.__wired = true;
      el.hideDoneChk.addEventListener('change', function(){
        state.hideDone = !!el.hideDoneChk.checked;
        writeFiltersToHashSilently();
        // 🔥 IMPORTANTE: volver a renderizar AMBAS vistas
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

    // ♿ A11y: notificar cambios a lectores de pantalla
    if (el.summaryGrid) el.summaryGrid.setAttribute('aria-live','polite');
    if (el.nearlyGrid)  el.nearlyGrid.setAttribute('aria-live','polite');
  }

  function setLoading(on){
    state.loading = !!on;
    if (el.panel) {
      var p = el.body;
      if (!p) return;
      if (on) p.setAttribute('aria-busy', 'true');
      else p.removeAttribute('aria-busy');
    }
  }

  function pickIdsFromAccount(accArr){
    return Array.from(new Set((accArr || []).map(function(a){ return a.id; }))).filter(function(id){ return id != null; });
  }

  function buildMetaMap(arr){
    var m = new Map();
    (arr || []).forEach(function (x) { if (x && x.id != null) m.set(x.id, x); });
    return m;
  }

  async function loadAll(opts){
    opts = opts || {};
    ensureDomRefs();
    ensureRefreshButton();
    ensureToolbar();

    // Leer deep‑links antes de cargar
    readFiltersFromHashIntoState();

    var token = getSelectedToken();
    if (!token) {
      state.token = null; state.acc = []; state.metaById = new Map();
      await ensureCategories(); fillCategorySelect(); ensureAside(); renderAside([]);
      renderSummary(); renderNearly();
      return;
    }
    state.token = token;

    setLoading(true);
    try {
      // Datos de cuenta
      var acc = await root.GW2Api.getAccountAchievements(token, { nocache: !!opts.nocache });
      state.acc = Array.isArray(acc) ? acc : [];

      // Metadatos de logros
      var ids = pickIdsFromAccount(state.acc);
      var metas = ids.length ? await root.GW2Api.getAchievementsMeta(ids, { nocache: !!opts.nocache }) : [];
      state.metaById = buildMetaMap(metas);

      // Categorías
      await ensureCategories();
      fillCategorySelect();

      // Aside visible
      ensureAside();

      state.loaded = true;
      renderSummary();
      renderNearly();
    } catch (e) {
      console.warn(LOGP, e);
      if (el.nearlyGrid) el.nearlyGrid.innerHTML = '<p class="muted">No se pudieron cargar logros.</p>';
      if (el.summaryGrid) el.summaryGrid.innerHTML = '';
      if (el.summaryStat) el.summaryStat.textContent = '—';
    } finally {
      wireToolbar();
      setLoading(false);
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
    async onTokenChange(){
      ensureDomRefs();
      state.loaded = false;
      await loadAll({ nocache: true });
    }
  };

  root.Achievements = Achievements;
  console.info(LOGP, 'OK: toolbar + aside + wiki + hideDone + categorias + anti-overflow');

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));