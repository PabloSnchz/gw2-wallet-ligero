/* eslint-disable no-console */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  console.info('%cGW2 Wallet app.js v2.6.3 — Bootstrap keys + toasts + router sync + selected-key persistence + WV Targets refresh', 'color:#0bf; font-weight:700');

  /* ========================= Estado ========================= */
  const state = {
    keys: [],
    selected: null,
    accountName: '—',

    currencies: new Map(),
    currenciesLoaded: false,
    wallet: [],

    filters: { q: '', cat: '', sort: 'order', onlyPos: false, onlyMain: false },

    // Back-compat: se carga LS_FAVS pero ya no se usa para UI (sólo migración a pins)
    favs: new Set(),

    view: 'cards'
  };

  /* ==================== Constantes LS/API ==================== */
  const LS_KEYS = 'gw2_keys';
  const LS_FAVS = 'gw2_favs'; // legado → migraremos a pins por cuenta

  const LS_CURR = 'gw2_currencies_cache_v1';
  const CURR_TTL = 1000 * 60 * 60 * 24 * 7;

  const LS_CONV = 'gw2_conv_cache_v3';
  const CONV_TTL = 1000 * 60 * 30;

  // NUEVO: persistencia de la key seleccionada (para restaurar tras F5)
  const LS_SELECTED_KEY = 'gw2_selected_key_v1';

  // NUEVO: Pins por cuenta (como WV/Meta)
  const LS_WALLET_PINS = 'gw2_wallet_pins_v1';

  /* ========================== API =========================== */
  const API = {
    withToken: (u, t) => `${u}${u.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(t)}`,
    async json(url) {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        const txt = await r.text().catch(() => `${r.status}`);
        throw new Error(`HTTP ${r.status} ${txt}`);
      }
      return r.json();
    },
    tokenInfo: (t) => API.json(API.withToken('https://api.guildwars2.com/v2/tokeninfo', t)),
    account:   (t) => API.json(API.withToken('https://api.guildwars2.com/v2/account', t)),
    wallet:    (t) => API.json(API.withToken('https://api.guildwars2.com/v2/account/wallet', t)),
    currencies: () => API.json('https://api.guildwars2.com/v2/currencies?ids=all&lang=es'),

    async coinsRaw(copper) {
      const url = `https://api.guildwars2.com/v2/commerce/exchange/coins?quantity=${copper}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const raw = await r.text(); console.debug('[conv][coins]', r.status, url, raw);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${raw || ''}`);
      let o; try { o = JSON.parse(raw); } catch { throw new Error(`JSON inválido (coins): ${raw?.slice(0, 200)}`); }
      return o;
    },
    async gemsRaw(gems) {
      const url = `https://api.guildwars2.com/v2/commerce/exchange/gems?quantity=${gems}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const raw = await r.text(); console.debug('[conv][gems]', r.status, url, raw);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${raw || ''}`);
      let o; try { o = JSON.parse(raw); } catch { throw new Error(`JSON inválido (gems): ${raw?.slice(0, 200)}`); }
      return o;
    }
  };

  /* ======================= Elementos ======================== */
  const el = {
    // Router hero tabs (legacy dentro del header)
    overlayTabs: $$('.overlay-tab'),
    walletPanel: $('#walletPanel'),
    metaPanel:   $('#metaPanel'),

    // Header (global key)
    keysMenuBtn:    $('#keysMenuBtn'),
    keySelectGlobal: $('#keySelectGlobal'),

    // Modal keys
    keysModal: $('#keysModal'),
    keysList:  $('#keysList'),
    keysForm:  $('#keysForm'),
    kfLabel:   $('#kfLabel'),
    kfValue:   $('#kfValue'),
    kfClear:   $('#kfClear'),

    // Wallet panel
    ownerLabel: $('#ownerLabel'),

    // Filtros Wallet
    searchBox: $('#searchBox'), category: $('#categorySelect'),
    sort: $('#sortSelect'), onlyPos: $('#onlyPositive'), onlyMain: $('#onlyMain'),
    clearBtn: $('#clearFiltersBtn'), toggleViewBtn: $('#toggleViewBtn'),

    // Render Wallet
    status: $('#status'),
    walletCards: $('#walletCards'), favBlock: $('#favBlock'), favCards: $('#favCards'),
    tableWrap: $('#walletTableWrap'), tableBody: $('#walletTable tbody'),

    // Conversor
    cvGems: $('#cvGems'), cvGemsOut: $('#cvGemsOut'),
    cvGold: $('#cvGold'), cvGoldOut: $('#cvGoldOut'),
    cvRefresh: $('#cvRefresh'),
    cvState: $('#cvState'), cvRef400: $('#cvRef400'),

    // NUEVO: quick‑chips
    cvGemsQuick: $('#cvGemsQuick'),
    cvGoldQuick: $('#cvGoldQuick')
  };

  /* ========================= Utils ========================= */
  function setStatus(m, k = 'info') {
    if (!el.status) return;
    el.status.style.color = k === 'error' ? '#f28b82' : (k === 'ok' ? '#a7f3d0' : '#a0a0a6');
    el.status.textContent = m;
  }

  // NUEVO: Emisor de eventos para WV Objetivos (y globales) con debounce
  let _wvTargetsEmitT = null;
  function emitRefreshEvents(token, source = 'key-change') {
    try {
      const detail = { token: token ?? null, source };
      clearTimeout(_wvTargetsEmitT);
      // Debounce leve por si la UI dispara varios cambios seguidos
      _wvTargetsEmitT = setTimeout(() => {
        // Evento específico para la pantalla de Objetivos
        document.dispatchEvent(new CustomEvent('gn:wv-targets-refresh', { detail }));
        // (Opcional) Evento global por si otros paneles se suman
        document.dispatchEvent(new CustomEvent('gn:global-refresh', { detail }));
        // (Opcional) MetaEventos (muchos módulos ya lo escuchan)
        document.dispatchEvent(new CustomEvent('gn:meta-refresh', { detail }));
        console.info('[app] emitRefreshEvents', detail);
      }, 80);
    } catch (e) {
      console.warn('[app] emitRefreshEvents error', e);
    }
  }

  function obfuscate(t) { return !t || t.length < 8 ? 'Key' : `Key ${t.slice(0, 4)}…${t.slice(-4)}`; }
  function esc(s) { return String(s || '').replace(/[&<>\"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m])); }

  function splitCopper(v) { const g = Math.floor(v / 10000), s = Math.floor((v % 10000) / 100), c = v % 100; return { g, s, c }; }
  function badgesHTMLFromCopper(copper) {
    const { g, s, c } = splitCopper(copper || 0);
    const p = [];
    if (g) p.push(`<span class="coin coin--g">${g.toLocaleString()}</span>`);
    if (s) p.push(`<span class="coin coin--s">${s}</span>`);
    if (c) p.push(`<span class="coin coin--c">${c}</span>`);
    return p.length ? p.join('') : '0';
  }

  // Micro-anim: marca un nodo como actualizado
  function markUpdated(node, ttl = 220) {
    try {
      if (!node) return;
      node.classList.remove('updated'); // reinicio rápido
      // fuerza reflow para reiniciar anim si se aplica de seguido
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight;
      node.classList.add('updated');
      setTimeout(() => node.classList.remove('updated'), ttl);
    } catch {}
  }

  // Toasts global
  (function (root) {
    if (root.toast && typeof root.toast === 'function') return;
    function ensureHost() {
      let host = document.getElementById('toasts');
      if (host) return host;
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toasts';
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-atomic', 'true');
      document.body.appendChild(host);
      return host;
    }
    const normalizeType = (t) => (t==='ok'?'success': (t==='warn'?'warn': (t==='error'?'error': (t==='success'?'success':'info'))));
    const iconFor = (t) => (t==='success'?'✅': (t==='error'?'⚠️': (t==='warn'?'⚠️':'ℹ️')));
    function makeToastEl(type, msg) {
      const wrap = document.createElement('div');
      wrap.className = 'toast toast--' + type;
      const ic = document.createElement('span'); ic.className='toast__icon'; ic.setAttribute('aria-hidden','true'); ic.textContent=iconFor(type);
      const tx = document.createElement('div');  tx.className='toast__msg';  tx.textContent=String(msg||'');
      const btn= document.createElement('button'); btn.className='toast__close'; btn.title='Cerrar'; btn.setAttribute('aria-label','Cerrar'); btn.textContent='×';
      wrap.append(ic,tx,btn);
      return wrap;
    }
    function toast(type, msg, opts) {
      opts = opts || {};
      const host = ensureHost();
      const kind = normalizeType(type);
      const el = makeToastEl(kind, msg);
      host.appendChild(el);
      const ttl = Number(opts.ttl || 3500);
      const timer = ttl>0 ? setTimeout(close, ttl) : null;
      function close(){ if(timer) clearTimeout(timer); el.classList.add('toast--out'); setTimeout(()=>el.remove(),180); }
      el.querySelector('.toast__close')?.addEventListener('click', close);
      return { close, el };
    }
    toast.legacy = (msg, kind, ms) => toast(kind==='ok'?'success':(kind||'info'), msg, { ttl: ms||2500 });
    root.toast = toast;
  })(typeof window!=='undefined' ? window : this);

  /* =============== Íconos: renderer ================= */
  function iconTag(url, size = 22) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    const safe = u.replace(/"/g, '&quot;');
    return `<img src="${safe}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  // (No-op ahora; lo dejo por back-compat si hay html crudo)
  function runIconChecks() {
    try {
      let fixes = 0, pend = 0;
      $$('.meta-left').forEach(n => {
        if (n.querySelector('img')) return;
        const txt = (n.textContent || '').trim();
        if (/^https?:\/\//i.test(txt)) { n.innerHTML = iconTag(txt, 22); fixes++; }
        else pend++;
      });
      $('#walletTable tbody')?.querySelectorAll('tr td:first-child').forEach(n => {
        if (n.querySelector('img')) return;
        const txt = (n.textContent || '').trim();
        if (/^https?:\/\//i.test(txt)) { n.innerHTML = iconTag(txt, 22); fixes++; }
        else pend++;
      });
      if (pend) console.warn(`[render:icons] pendientes:${pend} — fixes:${fixes}`); else console.info(`[render:icons] OK — fixes:${fixes}`);
    } catch (e) { console.debug('[render:icons] skip (non-blocking)', e); }
  }

  /* =================== Wallet Pins por cuenta ===================== */
  function fpToken() {
    try {
      const t = state.selected || el.keySelectGlobal?.value || '';
      return t ? `${t.slice(0,4)}…${t.slice(-4)}` : 'anon';
    } catch { return 'anon'; }
  }
  function pinsLoad() {
    try { const all = JSON.parse(localStorage.getItem(LS_WALLET_PINS) || '{}'); return all[fpToken()] || {}; }
    catch { return {}; }
  }
  function pinsSave(pins) {
    try { const all = JSON.parse(localStorage.getItem(LS_WALLET_PINS) || '{}'); all[fpToken()] = pins || {}; localStorage.setItem(LS_WALLET_PINS, JSON.stringify(all)); }
    catch{}
  }
  // Migración: si hay favs legacy y no hay pins para esta cuenta, migra
  function migrateFavsToPinsIfNeeded() {
    const pins = pinsLoad();
    if (Object.keys(pins).length) return;            // ya hay pins
    if (!(state.favs && state.favs.size)) return;    // no hay favoritos legacy
    const out = {};
    state.favs.forEach(id => { out[String(id)] = true; });
    pinsSave(out);
    console.info('[wallet] Migración favs→pins aplicada:', out);
  }

  /* =================== Categorización / helpers ===================== */
  const CATEGORY_OVERRIDES = { 18: ['general', 'blacklion'], 4: ['general', 'blacklion'], 63: ['general'] };
  function categorize(cur) {
    if (CATEGORY_OVERRIDES[cur.id]) return CATEGORY_OVERRIDES[cur.id];
    const t = `${(cur.name || '').toLowerCase()} ${(cur.description || '').toLowerCase()}`, has = s => t.includes(s), cats = new Set();
    if (has('león negro') || has('black lion')) cats.add('blacklion');
    if (has('pvp') || has('wvw') || has('fractal') || has('mazmorra')) cats.add('competitiva');
    if (has('geoda') || has('geode') || has('mapa') || has('map ')) cats.add('mapa');
    if (has('histórico') || has('gloria')) cats.add('histórica');
    if (!cats.size) cats.add('general');
    return [...cats];
  }
  function isMainCurrency(cur) {
    const n = (cur.name || '').toLowerCase(), any = (...w) => w.some(x => n.includes(x));
    return cur.id === 1 || any('karma', 'laurel', 'gem', 'gema') || any('fragmento de espíritu', 'spirit shard') || any('reconocimiento astral', 'astral acclaim') || any('mención de clan', 'guild commendation');
  }
  function isCoins(cur) { const n = (cur?.name || '').toLowerCase(); return cur?.id === 1 || n.includes('moneda') || n.includes('coin'); }

  /* =================== Rows (filtrado/orden) ===================== */
  function buildRows() {
    if (!state.currenciesLoaded || state.currencies.size === 0) return [];
    const pins = pinsLoad();

    const rows = state.wallet.map(w => {
      const c = state.currencies.get(w.id) || { id: w.id, name: `#${w.id}`, order: 9999, icon: '', description: '' };
      return {
        id: w.id,
        amount: w.value,
        name: c.name || `#${w.id}`,
        desc: c.description || '',
        order: Number.isFinite(c.order) ? c.order : 9999,
        cats: categorize(c),
        isMain: isMainCurrency(c),
        isPinned: !!pins[String(w.id)],
        _cur: c
      };
    });

    let list = rows, f = state.filters;
    if (f.onlyPos)  list = list.filter(r => r.amount > 0);
    if (f.onlyMain) list = list.filter(r => r.isMain);
    if (f.cat)      list = list.filter(r => r.cats.includes(f.cat));
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(r => r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)); }

    // Orden elegido (SIN mezclar pins aún; eso lo manejamos al pintar)
    if (f.sort === 'name')        list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (f.sort === 'amount') list.sort((a, b) => b.amount - a.amount);
    else                          list.sort((a, b) => a.order - b.order);

    return list;
  }

  /* =================== Tarjetas modernas ===================== */

  // === NUEVO: clave determinista para las 6 divisas con color oficial ===
  function resolveWalletKeyByName(name) {
    // normalización básica (lower, sin tildes, trim)
    const n = String(name || '')
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu,'')
      .replace(/[^\w\s]/g,'')
      .replace(/\s+/g,' ')
      .trim();

    // EXACT (ES/EN; singular / plural)
    const exact = new Map([
      // Gems / Gemas
      ['gema', 'gems'], ['gemas', 'gems'], ['gem', 'gems'], ['gems', 'gems'],
      // Coins / Monedas (oro/plata/cobre)
      ['moneda', 'coins'], ['monedas', 'coins'], ['coin', 'coins'], ['coins', 'coins'],
      // Karma
      ['karma', 'karma'],
      // Laurels / Laureles
      ['laurel', 'laurels'], ['laureles', 'laurels'], ['laurels', 'laurels'],
      // Trade Contracts / Contratos comerciales
      ['contrato comercial', 'trade_contracts'], ['contratos comerciales', 'trade_contracts'],
      ['trade contract', 'trade_contracts'], ['trade contracts', 'trade_contracts'],
      // Elegy Mosaic / Mosaicos de elegía
      ['mosaico de elegia', 'elegy_mosaic'], ['mosaicos de elegia', 'elegy_mosaic'],
      ['elegy mosaic', 'elegy_mosaic'], ['elegy mosaics', 'elegy_mosaic']
    ]);
    if (exact.has(n)) return exact.get(n);

    // STARTS WITH (p.ej., "Moneda (oro/plata/cobre)")
    const starts = [
      ['gema', 'gems'], ['gem', 'gems'],
      ['moneda', 'coins'], ['coin', 'coins'],
      ['contrato comercial', 'trade_contracts'], ['trade contract', 'trade_contracts'],
      ['mosaico de elegia', 'elegy_mosaic'], ['elegy mosaic', 'elegy_mosaic']
    ];
    for (const [p, key] of starts) {
      if (n.startsWith(p)) return key;
    }

    // TOKENS (oro/plata/cobre → coins, etc.)
    const tokens = new Map([
      ['oro', 'coins'], ['gold', 'coins'], ['plata', 'coins'], ['silver', 'coins'], ['cobre', 'coins'], ['copper', 'coins'],
      ['karma', 'karma'],
      ['laurel', 'laurels'], ['laurels', 'laurels'],
      ['contrato', 'trade_contracts'], ['contracts', 'trade_contracts'],
      ['elegia', 'elegy_mosaic'], ['elegy', 'elegy_mosaic']
    ]);
    for (const t of n.split(' ')) {
      if (tokens.has(t)) return tokens.get(t);
    }

    return ''; // no definida → fallback blanco en el theme
  }

  function walletCardHTML(r) {
    const iconHTML = iconTag(r._cur?.icon, 30);
    const pills = r.cats?.length ? r.cats.slice(0,4).map(t => `<span class="wallet-pill">${esc(t)}</span>`).join('') : '';
    const kind = ''; // si querés, podés mapear r.cats/kind a wallet-kind--*
    function fmt(n){ return Number(n||0).toLocaleString('es-AR'); }
    const pinCls = 'wv-pin' + (r.isPinned ? ' wv-pin--active' : '');

    // Para Moneda (oro), mostramos badges además del número
    const coinsBadges = isCoins(r._cur) ? (`<div class="coin-badges" style="margin-top:6px">${badgesHTMLFromCopper(r.amount)}</div>`) : '';

    // === NUEVO: clave determinista (para wallet-theme.js) ===
    const curKey = resolveWalletKeyByName(r.name); // '' si no aplica (glow blanco)

    return `
      <article class="wallet-card" data-id="${r.id}"${curKey ? ` data-cur="${curKey}"` : ''}>
        <div class="wallet-card__top">
          <div class="wallet-card__iconWrap">${iconHTML}</div>
          <div class="wallet-card__name${kind}">${esc(r.name)}</div>
          <button class="${pinCls}" data-wallet-pin="${r.id}" title="${r.isPinned?'Desfijar':'Fijar'}" aria-pressed="${r.isPinned?'true':'false'}">📌</button>
        </div>

        <div class="wallet-card__meta">
          <span class="wallet-amount" title="Cantidad disponible">${fmt(r.amount)}</span>
          ${r.isMain ? '<span class="wallet-sub">principal</span>' : ''}
        </div>

        <div class="wallet-sep"></div>

        <div class="wallet-card__body">
          ${r.desc ? `<div>${esc(r.desc)}</div>` : ''}
          ${coinsBadges}
          ${pills ? `<div class="wallet-pills">${pills}</div>` : ''}
        </div>
      </article>`;
  }

  function renderCards(rows) {
    if (!el.walletCards) return;

    // Separar fijadas / resto (respetando el orden del sort actual dentro de cada grupo)
    const pinned = rows.filter(r => r.isPinned);
    const rest   = rows.filter(r => !r.isPinned);

    // Bloque “Fijadas” (arriba)
    if (el.favBlock && el.favCards) {
      if (pinned.length) {
        el.favBlock.removeAttribute('hidden');
        el.favCards.innerHTML = pinned.map(walletCardHTML).join('');
      } else {
        el.favBlock.setAttribute('hidden','');
        el.favCards.innerHTML = '';
      }
    }

    // Grid principal
    el.walletCards.classList.add('wallet-card-grid');
    el.walletCards.innerHTML = rest.map(walletCardHTML).join('');

    // Wire de pins (ambos contenedores)
    function wirePins(host) {
      host?.querySelectorAll('[data-wallet-pin]')?.forEach(btn => {
        if (btn.__wired) return; btn.__wired = true;
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-wallet-pin');
          const pins = pinsLoad();
          if (pins[id]) delete pins[id]; else pins[id] = true;
          pinsSave(pins);
          render(); // reordena y refresca
        });
      });
    }
    wirePins(el.favCards);
    wirePins(el.walletCards);
  }

  /* =================== Tabla (columna 📌) ===================== */
  function rowHTML(r) {
    const icon  = iconTag(r._cur?.icon, 22);
    const cats  = (r.cats && r.cats.length) ? r.cats.join(', ') : '—';
    const amount = isCoins(r._cur)
      ? (() => { const { g, s, c } = splitCopper(r.amount); return `${g.toLocaleString()} g ${s} s ${c} c`; })()
      : r.amount.toLocaleString('es-AR');

    const pinCls = 'wv-pin' + (r.isPinned ? ' wv-pin--active' : '');
    const pinBtn = `<button class="${pinCls}" data-wallet-pin="${r.id}" title="${r.isPinned?'Desfijar':'Fijar'}" aria-pressed="${r.isPinned?'true':'false'}">📌</button>`;

    return `<tr data-id="${r.id}">
      <td>${icon}</td>
      <td>${esc(r.name)}</td>
      <td class="right">${amount}</td>
      <td>${esc(cats)}</td>
      <td class="right">${pinBtn}</td>
    </tr>`;
  }

  function renderTable(rows) {
    if (!el.tableBody) return;

    // Orden: pins primero (manteniendo el orden de sort actual dentro de cada grupo)
    const pinned = rows.filter(r => r.isPinned);
    const rest   = rows.filter(r => !r.isPinned);
    const final  = pinned.concat(rest);

    el.tableBody.innerHTML = final.map(rowHTML).join('');

    // Wire pins en tabla
    el.tableBody.querySelectorAll('[data-wallet-pin]')?.forEach(btn => {
      if (btn.__wired) return; btn.__wired = true;
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-wallet-pin');
        const pins = pinsLoad();
        if (pins[id]) delete pins[id]; else pins[id] = true;
        pinsSave(pins);
        render();
      });
    });
  }

  function render() {
    const rows = buildRows();
    if (!rows.length) {
      if (el.tableWrap) el.tableWrap.hidden = (state.view !== 'table');
      if (el.walletCards) el.walletCards.innerHTML = '';
      if (el.favCards) el.favCards.innerHTML = '';
      return;
    }

    if (state.view === 'table') {
      el.walletCards && (el.walletCards.style.display = 'none');
      el.tableWrap && (el.tableWrap.hidden = false);
      el.favBlock && (el.favBlock.setAttribute('hidden', ''));
      el.favCards && (el.favCards.innerHTML = '');
      renderTable(rows);
    } else {
      el.tableWrap && (el.tableWrap.hidden = true);
      el.walletCards && (el.walletCards.style.display = 'grid');
      renderCards(rows);
    }
    runIconChecks(); // no bloqueante
  }

  /* ============ A11y helpers: hero tabs & view toggle ============ */
  function setHeroTabsSelected(view /* 'cards' | 'meta' */) {
    const wantCards = view === 'cards';
    el.overlayTabs.forEach(b => {
      const v = b.getAttribute('data-view');
      const isActive = (wantCards && v === 'cards') || (!wantCards && v === 'meta');
      b.classList.toggle('overlay-tab--active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }
  function setViewTogglePressed() {
    if (!el.toggleViewBtn) return;
    const pressed = (state.view === 'table');
    el.toggleViewBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    el.toggleViewBtn.textContent = (state.view === 'cards') ? 'Vista tabla' : 'Vista tarjetas';
  }

  /* =================== Catálogo (cache) ===================== */
  function loadCurrCache() {
    try {
      const raw = localStorage.getItem(LS_CURR); if (!raw) return null;
      const { ts, items } = JSON.parse(raw);
      if (!Array.isArray(items) || !ts) return null;
      if ((Date.now() - ts) > CURR_TTL) return null;
      return items;
    } catch { return null; }
  }
  async function ensureCurrencies() {
    const cached = loadCurrCache();
    if (cached && cached.length) { state.currencies = new Map(cached.map(c => [c.id, c])); state.currenciesLoaded = true; return; }
    const list = await API.currencies();
    state.currencies = new Map(list.map(c => [c.id, c])); state.currenciesLoaded = true;
    try { localStorage.setItem(LS_CURR, JSON.stringify({ ts: Date.now(), items: list })); } catch { }
  }

  /* ======================= Data flow ======================== */
  async function loadAllForToken(token) {
    setStatus('Cargando datos…');
    await ensureCurrencies();
    const [acct, w] = await Promise.all([API.account(token).catch(() => null), API.wallet(token)]);
    state.accountName = acct?.name || '—'; state.wallet = w || [];
    el.ownerLabel && (el.ownerLabel.textContent = state.accountName);

    // Migración favs→pins (si aplica)
    migrateFavsToPinsIfNeeded();

    setStatus('Listo.', 'ok'); render();
  }

  /* ==================== KeyManager ================== */
  const KeyManager = {
    list: [],
    selected: null,
    _programmaticChange: false, // << NUEVO: evita bucles en change

    load() {
      // Carga listado de keys
      try { this.list = JSON.parse(localStorage.getItem(LS_KEYS)) || []; }
      catch { this.list = []; }
      state.keys = this.list.slice();

      // NUEVO: restaurar selección previa desde localStorage
      try { this.selected = localStorage.getItem(LS_SELECTED_KEY) || null; }
      catch { this.selected = null; }

      // Si la key guardada no existe más en la lista, anular selección
      if (this.selected && !this.list.some(k => k.value === this.selected)) {
        this.selected = null;
        try { localStorage.removeItem(LS_SELECTED_KEY); } catch {}
      }

      state.selected = this.selected;
      return this.list;
    },
    save() {
      try { localStorage.setItem(LS_KEYS, JSON.stringify(this.list)); } catch { }
      state.keys = this.list.slice();
    },
    setSelected(token, opts) {
      opts = opts || {};
      this.selected = token || null;
      state.selected = this.selected;

      // NUEVO: persistir selección (o limpiar si es null)
      try {
        if (this.selected) localStorage.setItem(LS_SELECTED_KEY, this.selected);
        else localStorage.removeItem(LS_SELECTED_KEY);
      } catch {}

      const gs = el.keySelectGlobal;
      const before = gs ? gs.value : null;
      if (gs && gs.value !== (this.selected || '')) gs.value = this.selected || '';

      // Avisar a otros módulos
      document.dispatchEvent(new CustomEvent('gn:tokenchange', { detail: { token: this.selected } }));
      // NUEVO: forzar refresh en WV Objetivos (y canales opcionales)
      emitRefreshEvents(this.selected, 'key:setSelected');

      // NUEVO: disparamos un 'change' programático para que el router refresque WV,
      // y evitamos bucles en nuestro propio handler con _programmaticChange.
      const changedByCode = gs && before !== (this.selected || '');
      if (!opts.silent && gs && changedByCode) {
        this._programmaticChange = true;
        setTimeout(() => { gs.dispatchEvent(new Event('change', { bubbles: true })); }, 0);
      }
    },
    refreshSelects() {
      const sel = el.keySelectGlobal;
      if (!sel) return;
      sel.innerHTML = '';
      this.list.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.value;
        opt.textContent = k.label || obfuscate(k.value);
        sel.appendChild(opt);
      });
      if (this.selected) sel.value = this.selected;
    },
    async addOrUpdate({ label, value }) {
      setStatus('Validando API key…');
      const info = await API.tokenInfo(value);
      const perms = new Set(info.permissions || []);
      if (!perms.has('account') || !perms.has('wallet')) throw new Error('La API key necesita permisos: account + wallet');

      const idx = this.list.findIndex(k => k.value === value);
      if (idx >= 0) this.list[idx].label = label || this.list[idx].label || '';
      else this.list.push({ label, value });

      this.save();
      this.refreshSelects();

      // Selecciona y notifica (router capturará el 'change' programático)
      this.setSelected(value);

      // Cargar datos de Wallet en paralelo
      await loadAllForToken(value);

      setStatus('Key guardada.', 'ok');
      window.toast?.('success','Key guardada', { ttl: 1400 });
    },
    rename(value, newLabel) {
      const item = this.list.find(k => k.value === value);
      if (!item) return;
      item.label = newLabel || '';
      this.save(); this.refreshSelects();
    },
    remove(value) {
      this.list = this.list.filter(k => k.value !== value);
      this.save(); this.refreshSelects();

      if (this.selected === value) {
        const next = this.list[0]?.value || null;
        // Importante: setSelected con notify para que el router se entere (y persiste LS_SELECTED_KEY)
        this.setSelected(next);
        if (next) loadAllForToken(next);
        else { state.wallet = []; render(); }
      }
    },
    copy(value) { return navigator.clipboard.writeText(value); }
  };

  /* ================= Modal Gestión de Keys ================== */
  let _previousFocus = null;
  let _focusTrapHandler = null;

  function focusableSelectors() {
    return [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
  }
  function enableFocusTrap(modal) {
    const nodes = [...modal.querySelectorAll(focusableSelectors())];
    if (!nodes.length) return;
    const first = nodes[0];
    const last  = nodes[nodes.length - 1];

    _focusTrapHandler = (ev) => {
      if (ev.key !== 'Tab') return;
      const active = document.activeElement;
      if (ev.shiftKey) {
        if (active === first || !modal.contains(active)) { ev.preventDefault(); last.focus(); }
      } else {
        if (active === last || !modal.contains(active)) { ev.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', _focusTrapHandler);
  }
  function disableFocusTrap() {
    if (_focusTrapHandler) document.removeEventListener('keydown', _focusTrapHandler);
    _focusTrapHandler = null;
  }

  function openKeysModal() {
    if (!el.keysModal) return;
    renderKeysList();

    _previousFocus = document.activeElement || el.keysMenuBtn || null;

    el.keysModal.hidden = false;
    el.keysModal.querySelector('.modal__dialog')?.focus();

    enableFocusTrap(el.keysModal);

    el.keysModal.addEventListener('click', onModalClickClose);
    document.addEventListener('keydown', onEscCloseModal);
  }
  function closeKeysModal() {
    if (!el.keysModal) return;
    el.keysModal.hidden = true;
    el.keysModal.removeEventListener('click', onModalClickClose);
    document.removeEventListener('keydown', onEscCloseModal);
    disableFocusTrap();

    if (_previousFocus && typeof _previousFocus.focus === 'function') {
      _previousFocus.focus();
    }
    _previousFocus = null;
  }
  function onModalClickClose(e) { if (e.target?.dataset?.close === '1') closeKeysModal(); }
  function onEscCloseModal(e) { if (e.key === 'Escape') closeKeysModal(); }

  function renderKeysList() {
    if (!el.keysList) return;
    if (!KeyManager.list.length) {
      el.keysList.innerHTML = `<p class="muted">No tenés API Keys guardadas. Agregá una debajo.</p>`;
      return;
    }
    el.keysList.innerHTML = KeyManager.list.map(k => `
      <div class="keys-row" data-val="${k.value}">
        <div class="keys-col">
          <div class="keys-name">${esc(k.label || obfuscate(k.value))}</div>
          <div class="keys-value muted">${obfuscate(k.value)}</div>
        </div>
        <div class="keys-actions">
          <button class="btn btn--ghost k-use"    title="Usar esta Key">Usar</button>
          <button class="btn btn--ghost k-copy"   title="Copiar API Key">Copiar</button>
          <button class="btn btn--ghost k-rename" title="Renombrar">Renombrar</button>
          <button class="btn k-del"               title="Eliminar">Eliminar</button>
        </div>
      </div>
    `).join('');

    el.keysList.querySelectorAll('.k-use').forEach(b => b.addEventListener('click', async ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      // Al seleccionar por código queremos notificar al router
      KeyManager.setSelected(val);
      await loadAllForToken(val);
      setStatus('API Key seleccionada.', 'ok');
      closeKeysModal();
    }));
    el.keysList.querySelectorAll('.k-copy').forEach(b => b.addEventListener('click', async ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      await KeyManager.copy(val);
      setStatus('API Key copiada.', 'ok'); window.toast?.('success','API Key copiada', { ttl: 1500 });
    }));
    el.keysList.querySelectorAll('.k-rename').forEach(b => b.addEventListener('click', ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      const curr = KeyManager.list.find(x => x.value === val)?.label || '';
      const name = prompt('Nuevo nombre para la key:', curr);
      if (name === null) return;
      KeyManager.rename(val, name);
      renderKeysList();
      setStatus('Nombre actualizado.', 'ok');
    }));
    el.keysList.querySelectorAll('.k-del').forEach(b => b.addEventListener('click', ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      if (!confirm('¿Eliminar esta API Key de tu navegador?')) return;
      KeyManager.remove(val);
      renderKeysList();
      setStatus('Key eliminada.', 'ok');
    }));
  }

  function wireKeysForm() {
    if (!el.keysForm) return;
    el.keysForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = el.kfLabel?.value.trim() || '';
      const value = el.kfValue?.value.trim() || '';
      if (!value) return setStatus('Ingresá una API key.', 'error');
      try {
        await KeyManager.addOrUpdate({ label, value });
        if (el.kfLabel) el.kfLabel.value = '';
        if (el.kfValue) el.kfValue.value = '';
        renderKeysList();
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'La API key no es válida.', 'error');
        window.toast?.('error','No se pudo validar la key', { ttl: 2000 });
      }
    });
    el.kfClear?.addEventListener('click', () => {
      if (el.kfLabel) el.kfLabel.value = '';
      if (el.kfValue) el.kfValue.value = '';
    });
  }

  /* ======================== Eventos ========================= */
  function wireEvents() {
    // Router tabs (legacy) + A11y
    el.overlayTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view'); // 'cards' | 'meta'
        $$('.overlay-tab').forEach(b => {
          const isActive = (b === btn);
          b.classList.toggle('overlay-tab--active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const conv = document.getElementById('asideConvSection');
        const next = document.getElementById('asideNextFeatures');
        const metaAside = document.getElementById('metaAsideNext');

        if (view === 'meta') {
          el.walletPanel?.setAttribute('hidden', '');
          el.metaPanel?.removeAttribute('hidden');
          conv?.setAttribute('hidden', '');
          next?.setAttribute('hidden', '');
          metaAside?.removeAttribute('hidden');
          el.metaPanel?.classList.add('fade-in');
        } else {
          el.metaPanel?.setAttribute('hidden', '');
          el.walletPanel?.removeAttribute('hidden');
          conv?.removeAttribute('hidden');
          next?.removeAttribute('hidden');
          metaAside?.setAttribute('hidden', '');
          el.walletPanel?.classList.add('fade-in');
        }
        document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view } }));
      });
    });

    // Header - Modal y selector global
    el.keysMenuBtn?.addEventListener('click', openKeysModal);

    // Handler del select global con protección anti-bucle
    el.keySelectGlobal?.addEventListener('change', async () => {
      if (KeyManager._programmaticChange) { KeyManager._programmaticChange = false; return; }
      const token = el.keySelectGlobal.value || null;
      KeyManager.setSelected(token, { silent: true });
      if (token) await loadAllForToken(token);
    });

    wireKeysForm();

    // Filtros Wallet
    el.searchBox?.addEventListener('input', () => { state.filters.q = el.searchBox.value.trim(); render(); });
    el.category?.addEventListener('change', () => { state.filters.cat = el.category.value || ''; render(); });
    el.sort?.addEventListener('change', () => { state.filters.sort = el.sort.value; render(); });
    el.onlyPos?.addEventListener('change', () => { state.filters.onlyPos = el.onlyPos.checked; render(); });
    el.onlyMain?.addEventListener('change', () => { state.filters.onlyMain = el.onlyMain.checked; render(); });
    el.clearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters = { q: '', cat: '', sort: 'order', onlyPos: false, onlyMain: false };
      if (el.searchBox) el.searchBox.value = '';
      if (el.category) el.category.value = '';
      if (el.sort) el.sort.value = 'order';
      if (el.onlyPos) el.onlyPos.checked = false;
      if (el.onlyMain) el.onlyMain.checked = false;
      render();
    });

    // Alternar vista (tarjetas/tabla)
    el.toggleViewBtn?.addEventListener('click', () => {
      state.view = (state.view === 'cards') ? 'table' : 'cards';
      setViewTogglePressed();
      render();
    });

    // Conversor (debounce para tipeo)
    if ($('#convWrap')) {
      let t = null; const deb = (fn, ms = 300) => (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
      el.cvGems?.addEventListener('input', deb(onTopInput));
      el.cvGold?.addEventListener('input', deb(onBottomInput));
      el.cvRefresh?.addEventListener('click', () => { updateRef400().catch(() => { }); onTopInput(); onBottomInput(); });

      // NUEVO: quick‑chips
      el.cvGemsQuick?.querySelectorAll('[data-gems]')?.forEach(btn => {
        if (btn.__wired) return; btn.__wired = true;
        btn.addEventListener('click', () => {
          const n = Number(btn.getAttribute('data-gems')) || 0;
          if (el.cvGems) el.cvGems.value = String(n);
          // cálculo inmediato sin debounce
          onTopInput();
        });
      });
      el.cvGoldQuick?.querySelectorAll('[data-gold]')?.forEach(btn => {
        if (btn.__wired) return; btn.__wired = true;
        btn.addEventListener('click', () => {
          const n = Number(btn.getAttribute('data-gold')) || 0;
          if (el.cvGold) el.cvGold.value = String(n);
          // cálculo inmediato sin debounce
          onBottomInput();
        });
      });
    }
  }

  /* ========================= Boot ========================== */
  async function boot() {
    // Cargar favs legacy (sólo para migración)
    try { state.favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS)) || []); }
    catch { state.favs = new Set(); }

    // Cargar keys + selección previa (si existe y sigue siendo válida)
    KeyManager.load();
    KeyManager.refreshSelects();

    // Catálogo (cache o red)
    const raw = localStorage.getItem(LS_CURR);
    if (raw) {
      try {
        const { ts, items } = JSON.parse(raw);
        if (Array.isArray(items) && ts && (Date.now() - ts) <= CURR_TTL) {
          state.currencies = new Map(items.map(c => [c.id, c]));
          state.currenciesLoaded = true;
        }
      } catch {}
    }
    if (!state.currenciesLoaded) {
      const list = await API.currencies();
      state.currencies = new Map(list.map(c => [c.id, c]));
      state.currenciesLoaded = true;
      try { localStorage.setItem(LS_CURR, JSON.stringify({ ts: Date.now(), items: list })); } catch {}
    }

    // Selección inicial
    if (!KeyManager.selected && KeyManager.list.length) {
      // No hay selección guardada o es inválida → usar primera key
      KeyManager.setSelected(KeyManager.list[0].value);
      await loadAllForToken(KeyManager.selected);
    } else if (KeyManager.selected) {
      // Hay selección válida guardada → restaurar y cargar
      KeyManager.setSelected(KeyManager.selected);
      await loadAllForToken(KeyManager.selected);
    } else {
      render();
    }

    // Sincronizar A11y inicial
    setHeroTabsSelected('cards');     // por defecto
    setViewTogglePressed();           // según state.view

    wireEvents();
    updateRef400().catch(() => {});
    runIconChecks();

    // Avisar token inicial a otros módulos (compat)
    document.dispatchEvent(new CustomEvent('gn:tokenchange', { detail: { token: KeyManager.selected } }));
    // NUEVO: asegurar que Objetivos (y demás) también se actualicen al iniciar
    emitRefreshEvents(KeyManager.selected, 'boot');
  }
  boot();

  /* ===================== Conversor ========================= */
  function convGet() { try { return JSON.parse(localStorage.getItem(LS_CONV) || '{}'); } catch { return {}; } }
  function convPut(k, v) { try { const m = convGet(); m[k] = { v, ts: Date.now() }; localStorage.setItem(LS_CONV, JSON.stringify(m)); } catch {} }
  function convVal(k) { const m = convGet(); if (!m[k]) return null; if ((Date.now() - m[k].ts) > CONV_TTL) return null; return m[k].v; }

  async function gemsForCoins(copper) {
    const k = `coins2gems_${copper}`; let v = convVal(k);
    if (v != null) return v;
    const o = await API.coinsRaw(copper);
    let gems = Number.isFinite(+o?.quantity) ? +o.quantity
      : Number.isFinite(+o?.gems) ? +o.gems
      : (Number.isFinite(+o?.coins_per_gem) ? Math.floor(+copper / +o.coins_per_gem) : NaN);
    if (!Number.isFinite(gems)) throw new Error('Respuesta inválida coins->gems');
    convPut(k, gems); return gems;
  }
  async function coinsForGems(gems) {
    const k = `gems2coins_${gems}`; let v = convVal(k);
    if (v != null) return v;
    const o = await API.gemsRaw(gems);
    let copper = Number.isFinite(+o?.quantity) ? +o.quantity
      : Number.isFinite(+o?.coins) ? +o.coins
      : (Number.isFinite(+o?.coins_per_gem) ? Math.floor(+gems * +o.coins_per_gem) : NaN);
    if (!Number.isFinite(copper)) throw new Error('Respuesta inválida gems->coins');
    convPut(k, copper); return copper;
  }
  async function costToBuyGems_coinsMarket(targetGems) {
    if (targetGems <= 0) return 0;
    let lo = 0, hi = 10000;
    while (await gemsForCoins(hi) < targetGems) { hi = Math.min(hi * 2, 5e11); if (hi >= 5e11) break; }
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const g = await gemsForCoins(mid);
      if (g >= targetGems) hi = mid; else lo = mid + 1;
    }
    return lo;
  }
  async function gemsToBuyGold_gemsMarket(targetCopper) {
    if (targetCopper <= 0) return 0;
    let lo = 0, hi = 100;
    while (await coinsForGems(hi) < targetCopper) { hi = Math.min(hi * 2, 3e6); if (hi >= 3e6) break; }
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const c = await coinsForGems(mid);
      if (c >= targetCopper) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  function setConvState(msg, kind = 'info') {
    if (!el.cvState) return;
    el.cvState.textContent = msg;
    el.cvState.style.color = (kind === 'error') ? '#f28b82' : '#a0a0a6';
    console.info('[conv:state]', msg);
  }
  function setGemsOut(val) {
    if (!Number.isFinite(val) || val <= 0) { el.cvGoldOut && (el.cvGoldOut.textContent = '—'); return; }
    el.cvGoldOut.textContent = String(Math.floor(val));
    markUpdated(el.cvGoldOut);
  }
  function setBadges(container, copper) {
    if (!container) return;
    if (!Number.isFinite(copper) || copper <= 0) { container.innerHTML = '—'; return; }
    container.innerHTML = badgesHTMLFromCopper(copper);
    markUpdated(container);
  }

  /* ===== NUEVO: Conveniencia (400 gemas) ======================
     Mapea el precio (en ORO) de 400 gemas a un score 0..1 según referencias:
       - Excelente: <=108 oro
       - Bueno: 120–130 oro (meseta alta fija)
       - Actual poco conveniente: ~160 oro (score bajo)
  */
  function scoreFromPrice400(priceGold) {
    const p = Number(priceGold || 0);
    if (!Number.isFinite(p) || p <= 0) return { score: 0, tier: 'bad' };

    if (p <= 108)            return { score: 1.00, tier: 'exc' };
    if (p > 108 && p < 120)  return { score: 1.00 - ((p - 108) / (120 - 108)) * 0.15, tier: 'good' }; // 1.00→0.85
    if (p >= 120 && p <=130) return { score: 0.85, tier: 'good' };                                     // meseta alta
    if (p > 130 && p < 160)  return { score: 0.85 - ((p - 130) / (160 - 130)) * 0.65, tier: 'mid' };   // 0.85→0.20
    return { score: 0.05, tier: 'bad' }; // 160+
  }
  function labelForScore(score){
    if (score >= 0.95) return 'Excelente';
    if (score >= 0.80) return 'Muy conveniente';
    if (score >= 0.65) return 'Bueno';
    if (score >= 0.45) return 'Normal';
    if (score >= 0.25) return 'Bajo';
    return 'Muy bajo';
  }
  function classForScore(score){
    if (score >= 0.95) return 'is-exc';
    if (score >= 0.80) return 'is-good';
    if (score >= 0.65) return 'is-good';
    if (score >= 0.45) return 'is-mid';
    if (score >= 0.25) return 'is-low';
    return 'is-bad';
  }
  function renderConvenience(priceCopperFor400){
    try{
      const elBar  = document.getElementById('convScoreBar');
      const elLbl  = document.getElementById('convScoreLabel');
      const elHint = document.getElementById('convScoreHint');
      const meter  = document.querySelector('.conv2-meter');
      if (!elBar || !elLbl || !elHint || !meter) return;

      const gold = Number(priceCopperFor400 || 0) / 10000; // cobre -> oro
      if (!Number.isFinite(gold) || gold <= 0){
        elBar.style.width = '0%';
        elBar.className = 'conv2-meter__fill';
        elLbl.textContent = '—';
        elHint.textContent = 'Sin datos de referencia aún.';
        meter.setAttribute('aria-valuenow', '0');
        return;
      }

      const { score } = scoreFromPrice400(gold);
      const pct = Math.round(score * 100);
      const cls = classForScore(score);
      const lbl = labelForScore(score);

      elBar.className = 'conv2-meter__fill ' + cls;
      elBar.style.width = pct + '%';
      elLbl.textContent = `${lbl} (${gold.toFixed(2)} o / 400)`;
      elHint.textContent = (score >= 0.65)
        ? 'Es un buen momento según la referencia definida (120–130 o/400).'
        : (score >= 0.45)
          ? 'En línea con valores normales.'
          : 'Poco conveniente frente a la referencia (120–130 o/400).';

      meter.setAttribute('aria-valuenow', String(pct));

      // micro-anim en la barra
      markUpdated(elBar);
    }catch(_){}
  }

  async function onTopInput() {
    try {
      let gs = String(el.cvGems?.value || '').trim();
      if (gs === '' || Number(gs) <= 0) {
        el.cvGems.value = '';
        setBadges(el.cvGemsOut, 0);
        setConvState('Ingresá gemas.');
        // Reinicia barra si el input queda vacío
        renderConvenience(0);
        return;
      }
      const gems = Math.max(0, Math.floor(Number(gs)));
      el.cvGems.value = String(gems);
      setConvState('Calculando costo (coins→gems)…');
      const copper = await costToBuyGems_coinsMarket(gems);
      setBadges(el.cvGemsOut, copper);
      setConvState('Actualizado.');

      // normalizar a referencia /400 para evaluar conveniencia
      if (gems > 0) {
        const copperFor400 = Math.round((copper / gems) * 400);
        renderConvenience(copperFor400);
      }
    } catch (e) {
      console.error('[conv] top', e);
      setBadges(el.cvGemsOut, 0);
      setConvState('No se pudo calcular costo.', 'error');
      renderConvenience(0);
    }
  }

  async function onBottomInput() {
    try {
      let g = String(el.cvGold?.value || '').trim();
      if (g === '' || Number(g) <= 0) {
        el.cvGold.value = '';
        setGemsOut(0);
        setConvState('Ingresá oro.');
        return;
      }
      const gold = Math.max(0, Math.floor(Number(g)));
      el.cvGold.value = String(gold);
      const copper = gold * 10000;
      setConvState('Calculando gemas (gems→coins)…');
      const gems = await gemsToBuyGold_gemsMarket(copper);
      setGemsOut(gems);
      setConvState('Actualizado.');
      // Nota: la barra refleja conveniencia de COMPRAR gemas con oro (coins->gems),
      // por eso no la actualizamos aquí (dirección inversa). La referencia /400 se cubre en updateRef400 y onTopInput.
    } catch (e) {
      console.error('[conv] bottom', e);
      setGemsOut(0);
      setConvState('No se pudo calcular gemas.', 'error');
    }
  }

  async function updateRef400() {
    try {
      const k = 'ref_400_v3';
      let copper = convVal(k);
      if (copper == null) {
        copper = await costToBuyGems_coinsMarket(400);
        convPut(k, copper);
      }
      const iconGem =
        `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-2px">
           <path fill="#7dd3fc" d="M5 9 9 3h6l4 6-7 12zM9 3 5 9h14L15 3z"/>
         </svg>`;
      if (el.cvRef400) {
        el.cvRef400.innerHTML =
          `<span style="display:inline-flex;gap:6px;align-items:center;margin-right:8px">
             ${iconGem}<strong>400</strong>
           </span> ${badgesHTMLFromCopper(copper)}`;
        markUpdated(el.cvRef400);
      }

      // pintar barra de conveniencia con la referencia real /400
      renderConvenience(copper);

      window.toast?.('success','Referencia 400 actualizada', { ttl: 1500 });
    } catch (e) {
      console.warn('[conv] ref400', e);
      if (el.cvRef400) el.cvRef400.textContent = '—';
      renderConvenience(0);
      window.toast?.('warn','No se pudo actualizar la referencia 400', { ttl: 2000 });
    }
  }

  // Hooks públicos (MetaEventos los usa)
  window.__GN__ = {
    render, runIconChecks,
    getSelectedToken: () => KeyManager.selected || null
  };
})();