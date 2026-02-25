/* eslint-disable no-console */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  console.info('%cGW2 Wallet app.js v2.5.0 → KeyManager + modal + selector global (limpio)', 'color:#0bf; font-weight:700');

  /* ========================= Estado ========================= */
  const state = {
    // Fuente de verdad de keys es KeyManager; esto queda para compat en algunas partes del render.
    keys: [],
    selected: null,
    accountName: '—',

    currencies: new Map(),
    currenciesLoaded: false,
    wallet: [],

    filters: { q: '', cat: '', sort: 'order', onlyPos: false, onlyMain: false },
    favs: new Set(),

    // Vista de Wallet (tarjetas/tabla)
    view: 'cards'
  };

  /* ==================== Constantes LS/API ==================== */
  const LS_KEYS = 'gw2_keys';
  const LS_FAVS = 'gw2_favs';
  const LS_CURR = 'gw2_currencies_cache_v1';
  const CURR_TTL = 1000 * 60 * 60 * 24 * 7;

  const LS_CONV = 'gw2_conv_cache_v3';
  const CONV_TTL = 1000 * 60 * 30;

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
    // Router
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

    // Wallet panel (sólo owner label)
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
    cvState: $('#cvState'), cvRef400: $('#cvRef400')
  };

  /* ========================= Utils ========================= */
  function setStatus(m, k = 'info') {
    if (!el.status) return;
    el.status.style.color = k === 'error' ? '#f28b82' : (k === 'ok' ? '#a7f3d0' : '#a0a0a6');
    el.status.textContent = m;
  }
  function obfuscate(t) { return !t || t.length < 8 ? 'Key' : `Key ${t.slice(0, 4)}…${t.slice(-4)}`; }
  function esc(s) { return String(s || '').replace(/[&<>\"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

  function splitCopper(v) { const g = Math.floor(v / 10000), s = Math.floor((v % 10000) / 100), c = v % 100; return { g, s, c }; }
  function badgesHTMLFromCopper(copper) {
    const { g, s, c } = splitCopper(copper || 0);
    const p = [];
    if (g) p.push(`<span class="coin coin--g">${g.toLocaleString()}</span>`);
    if (s) p.push(`<span class="coin coin--s">${s}</span>`);
    if (c) p.push(`<span class="coin coin--c">${c}</span>`);
    return p.length ? p.join('') : '0';
  }

  function toast(msg, kind = 'info', ms = 2500) {
    try {
      const host = document.getElementById('toasts');
      if (!host) return console.info('[toast]', msg);
      const n = document.createElement('div');
      const kindClass = kind === 'ok' ? 'toast--ok' : kind === 'warn' ? 'toast--warn' : kind === 'error' ? 'toast--error' : '';
      n.className = `toast ${kindClass}`;
      n.textContent = msg;
      host.appendChild(n);
      setTimeout(() => { n.style.opacity = '0'; n.style.transform = 'translateY(6px)'; }, Math.max(100, ms - 160));
      setTimeout(() => n.remove(), Math.max(400, ms));
    } catch (e) {
      console.warn('[toast]', e, msg);
    }
  }
  function fadeIn(node) {
    if (!node) return;
    node.classList.remove('fade-in'); void node.offsetWidth; node.classList.add('fade-in');
  }

  /* =============== Íconos: renderer + check ================= */
  function iconTag(url, size = 22) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    const safe = u.replace(/"/g, '&quot;');
    // Devolvemos <img> completo como espera el render
    return `<img src="${safe}" width="${size}" height="${size}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  function runIconChecks() {
    let fixes = 0, pend = 0;
    // tarjetas
    $$('.meta-left').forEach(n => {
      if (/\b<img\b/i.test(n.innerHTML)) return;
      const txt = n.textContent?.trim() || '';
      if (/^https?:\/\//i.test(txt)) { n.innerHTML = iconTag(txt, 22); fixes++; }
      else pend++;
    });
    // tabla
    $$('#walletTable tbody tr td:first-child').forEach(n => {
      if (/\b<img\b/i.test(n.innerHTML)) return;
      const txt = n.textContent?.trim() || '';
      if (/^https?:\/\//i.test(txt)) { n.innerHTML = iconTag(txt, 22); fixes++; }
      else pend++;
    });
    if (pend === 0) console.info(`[render:icons] OK — fixes:${fixes}`);
    else console.warn(`[render:icons] pendientes:${pend} — fixes:${fixes}`);
  }

  /* =================== Render tarjetas ===================== */
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

  function buildRows() {
    if (!state.currenciesLoaded || state.currencies.size === 0) return [];
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
        isFav: state.favs.has(String(w.id)),
        _cur: c
      };
    });

    let list = rows, f = state.filters;
    if (f.onlyPos)  list = list.filter(r => r.amount > 0);
    if (f.onlyMain) list = list.filter(r => r.isMain);
    if (f.cat)      list = list.filter(r => r.cats.includes(f.cat));
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(r => r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)); }
    if (f.sort === 'name')   list.sort((a, b) => a.name.localeCompare(b.name));
    else if (f.sort === 'amount') list.sort((a, b) => b.amount - a.amount);
    else list.sort((a, b) => a.order - b.order);
    return list;
  }

  function cardHTML(r) {
    const iconHTML = iconTag(r._cur?.icon, 22);
    const right = isCoins(r._cur) ? '' : `<span class="card__amount">${r.amount.toLocaleString()}</span>`;
    const coins = isCoins(r._cur) ? `<div class="coin-badges">${badgesHTMLFromCopper(r.amount)}</div>` : '';
    const cats = (r.cats && r.cats.length) ? r.cats.join(', ') : '—';
    return `
    <article class="card" data-id="${r.id}">
      <button class="star ${r.isFav ? 'star--on' : ''}" data-star="${r.id}" title="Favorita">★</button>
      <div class="card__head">
        <h3 class="card__title">${esc(r.name)}</h3>
        <div class="card__amount-wrap">${right}</div>
      </div>
      <div class="card__desc">${r.desc ? esc(r.desc) : ''}${coins}</div>
      <div class="card__meta">
        <span class="meta-left">${iconHTML}</span>
        <span class="cats">${esc(cats)}</span>
      </div>
    </article>`;
  }
  function renderCards(rows) {
    if (!el.walletCards) return;
    const favs = rows.filter(r => r.isFav), rest = rows.filter(r => !r.isFav);
    if (el.favBlock) {
      if (favs.length) { el.favBlock.removeAttribute('hidden'); el.favCards && (el.favCards.innerHTML = favs.map(cardHTML).join('')); }
      else { el.favBlock.setAttribute('hidden', ''); el.favCards && (el.favCards.innerHTML = ''); }
    }
    el.walletCards.innerHTML = rest.map(cardHTML).join('');
  }
  function rowHTML(r) {
    const icon  = iconTag(r._cur?.icon, 22);
    const cats  = (r.cats && r.cats.length) ? r.cats.join(', ') : '—';
    const amount = isCoins(r._cur)
      ? (() => { const { g, s, c } = splitCopper(r.amount); return `${g.toLocaleString()} g ${s} s ${c} c`; })()
      : r.amount.toLocaleString();
    const star = `<span class="star ${r.isFav ? 'star--on' : ''}" data-star="${r.id}" title="Favorita">★</span>`;
    return `<tr data-id="${r.id}"><td>${icon}</td><td>${esc(r.name)}</td><td class="right">${amount}</td><td>${esc(cats)}</td><td class="right">${star}</td></tr>`;
  }
  function renderTable(rows) {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = rows.map(rowHTML).join('');
  }
  function render() {
    const rows = buildRows();
    if (!rows.length) { el.tableWrap && (el.tableWrap.hidden = (state.view !== 'table')); return; }
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
    runIconChecks();
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
    setStatus('Listo.', 'ok'); render();
  }

  /* ==================== KeyManager (NUEVO) ================== */
  const KeyManager = {
    list: [],          // [{label, value}]
    selected: null,    // string|null

    load() {
      try { this.list = JSON.parse(localStorage.getItem(LS_KEYS)) || []; }
      catch { this.list = []; }
      state.keys = this.list.slice();
      return this.list;
    },
    save() {
      try { localStorage.setItem(LS_KEYS, JSON.stringify(this.list)); } catch { }
      state.keys = this.list.slice();
    },
    setSelected(token) {
      this.selected = token || null;
      state.selected = this.selected;

      // Sincroniza sólo el selector GLOBAL (ya no existe el local)
      const gs = el.keySelectGlobal;
      if (gs && gs.value !== (this.selected || '')) gs.value = this.selected || '';

      // Avisar a toda la app (MetaEventos lo escucha)
      document.dispatchEvent(new CustomEvent('gn:tokenchange', { detail: { token: this.selected } }));
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
      this.setSelected(value);
      await loadAllForToken(value);

      setStatus('Key guardada.', 'ok');
      toast?.('Key guardada', 'ok', 1400);
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
        this.setSelected(next);
        if (next) loadAllForToken(next);
        else { state.wallet = []; render(); }
      }
    },
    copy(value) { return navigator.clipboard.writeText(value); }
  };

  /* ================= Modal Gestión de Keys ================== */
  function openKeysModal() {
    if (!el.keysModal) return;
    renderKeysList();
    el.keysModal.hidden = false;
    el.keysModal.querySelector('.modal__dialog')?.focus();

    el.keysModal.addEventListener('click', onModalClickClose);
    document.addEventListener('keydown', onEscCloseModal);
  }
  function closeKeysModal() {
    if (!el.keysModal) return;
    el.keysModal.hidden = true;
    el.keysModal.removeEventListener('click', onModalClickClose);
    document.removeEventListener('keydown', onEscCloseModal);
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

    // Acciones de la lista
    el.keysList.querySelectorAll('.k-use').forEach(b => b.addEventListener('click', async ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      KeyManager.setSelected(val);
      await loadAllForToken(val);
      setStatus('API Key seleccionada.', 'ok');
      closeKeysModal();
    }));
    el.keysList.querySelectorAll('.k-copy').forEach(b => b.addEventListener('click', async ev => {
      const row = ev.target.closest('.keys-row'); const val = row?.dataset?.val; if (!val) return;
      await KeyManager.copy(val);
      setStatus('API Key copiada.', 'ok'); toast?.('API Key copiada', 'ok', 1500);
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
        toast?.('No se pudo validar la key', 'error', 2000);
      }
    });
    el.kfClear?.addEventListener('click', () => {
      if (el.kfLabel) el.kfLabel.value = '';
      if (el.kfValue) el.kfValue.value = '';
    });
  }

  /* ======================== Eventos ========================= */
  function wireEvents() {
    // Router tabs
    el.overlayTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view'); // 'cards' | 'meta'
        $$('.overlay-tab').forEach(b => b.classList.toggle('overlay-tab--active', b === btn));

        const conv = document.getElementById('asideConvSection');
        const next = document.getElementById('asideNextFeatures');
        const metaAside = document.getElementById('metaAsideNext');

        if (view === 'meta') {
          el.walletPanel?.setAttribute('hidden', '');
          el.metaPanel?.removeAttribute('hidden');
          conv?.setAttribute('hidden', '');
          next?.setAttribute('hidden', '');
          metaAside?.removeAttribute('hidden');
          fadeIn(el.metaPanel);
        } else {
          el.metaPanel?.setAttribute('hidden', '');
          el.walletPanel?.removeAttribute('hidden');
          conv?.removeAttribute('hidden');
          next?.removeAttribute('hidden');
          metaAside?.setAttribute('hidden', '');
          fadeIn(el.walletPanel);
        }
        document.dispatchEvent(new CustomEvent('gn:tabchange', { detail: { view } }));
      });
    });

    // Header - Modal y selector global
    el.keysMenuBtn?.addEventListener('click', openKeysModal);
    el.keySelectGlobal?.addEventListener('change', async () => {
      const token = el.keySelectGlobal.value || null;
      KeyManager.setSelected(token);
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

    el.toggleViewBtn?.addEventListener('click', () => {
      state.view = (state.view === 'cards') ? 'table' : 'cards';
      el.toggleViewBtn.textContent = (state.view === 'cards') ? 'Vista tabla' : 'Vista tarjetas';
      render();
    });

    // Conversor (debounce)
    if ($('#convWrap')) {
      let t = null; const deb = (fn, ms = 300) => (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
      el.cvGems?.addEventListener('input', deb(onTopInput));
      el.cvGold?.addEventListener('input', deb(onBottomInput));
      el.cvRefresh?.addEventListener('click', () => { updateRef400().catch(() => { }); onTopInput(); onBottomInput(); });
    }
  }

  /* ========================= Boot ========================== */
  async function boot() {
    try { state.favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS)) || []); }
    catch { state.favs = new Set(); }

    // Cargar keys
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
      KeyManager.setSelected(KeyManager.list[0].value);
      await loadAllForToken(KeyManager.selected);
    } else if (KeyManager.selected) {
      await loadAllForToken(KeyManager.selected);
    } else {
      render();
    }

    wireEvents();
    updateRef400().catch(() => {});
    runIconChecks();

    // Avisar token inicial a MetaEventos
    document.dispatchEvent(new CustomEvent('gn:tokenchange', { detail: { token: KeyManager.selected } }));
  }
  boot();

  /* ===================== Conversor (estable) ================ */
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
  }
  function setBadges(container, copper) {
    if (!container) return;
    if (!Number.isFinite(copper) || copper <= 0) { container.innerHTML = '—'; return; }
    container.innerHTML = badgesHTMLFromCopper(copper);
  }

  async function onTopInput() {
    try {
      let gs = String(el.cvGems?.value || '').trim();
      if (gs === '' || Number(gs) <= 0) {
        el.cvGems.value = '';
        setBadges(el.cvGemsOut, 0);
        setConvState('Ingresá gemas.');
        return;
      }
      const gems = Math.max(0, Math.floor(Number(gs)));
      el.cvGems.value = String(gems);
      setConvState('Calculando costo (coins→gems)…');
      const copper = await costToBuyGems_coinsMarket(gems);
      setBadges(el.cvGemsOut, copper);
      setConvState('Actualizado.');
    } catch (e) {
      console.error('[conv] top', e);
      setBadges(el.cvGemsOut, 0);
      setConvState('No se pudo calcular costo.', 'error');
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
      }
      toast?.('Referencia 400 actualizada', 'ok', 1500);
    } catch (e) {
      console.warn('[conv] ref400', e);
      if (el.cvRef400) el.cvRef400.textContent = '—';
      toast?.('No se pudo actualizar la referencia 400', 'warn', 2000);
    }
  }

  // Hooks públicos (MetaEventos los usa)
  window.__GN__ = {
    render, runIconChecks,
    getSelectedToken: () => KeyManager.selected || null
  };
})();