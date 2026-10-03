/* eslint-disable no-console */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  console.info('%cGW2 Wallet app.js v2.8.0 — Bootstrap keys + toasts + router sync + selected-key persistence + WV Targets refresh (conversor extraído)', 'color:#0bf; font-weight:700');
 
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

    view: 'cards',

    // Idea 63 T1: guarda que el listener de gn:tokenchange ya se registro
    // (wireEvents corre una vez, pero el flag lo hace explicito).
    _wiredTokenListener: false
  };

  /* ==================== Constantes LS/API ==================== */
  // La lista de cuentas y la key seleccionada ya NO se leen ni se escriben con
  // estas constantes: van por Storage (STORAGE_KEYS.ACCOUNT_KEYS /
  // ACCOUNT_SELECTED). Sus legacies ('gw2_keys' / 'gw2_selected_key_v1') siguen
  // siendo la fuente de verdad y las mantiene storage.js por MIRROR_MAP, asi
  // que los 6 modulos que las leen a pelo siguen viendo lo mismo.
  const LS_FAVS = 'gw2_favs'; // legado → migraremos a pins por cuenta

  // Iconos de tipo de cuenta (mismos que accounts-panel.js)
  const ACCOUNT_TYPE_ICONS = {
    main:  'assets/icons/Cuentas/547827.png',
    alter: 'assets/icons/Cuentas/157375.png',
    f2p:   'assets/icons/Cuentas/102538.png'
  };
  const CONFIG_ICONS = {
    account: 'assets/icons/Cuentas/GW2free.png'
  };

  const LS_CURR = 'gw2_currencies_cache_v1';
  const CURR_TTL = 1000 * 60 * 60 * 24 * 7;

  // (Conversor movido a converter-modal.js)

  // NUEVO: persistencia de la key seleccionada (para restaurar tras F5)
  // Va por Storage.STORAGE_KEYS.ACCOUNT_SELECTED — ver la nota de LS_FAVS.

  // NUEVO: Pins por cuenta (como WV/Meta)
  const LS_WALLET_PINS = 'gw2_wallet_pins_v1';

  /* ========================== API =========================== */
  const API = {
    withToken: (u, t) => `${u}${u.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(t)}`,
    async json(url, signal) {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal });
      if (!r.ok) {
        const txt = await r.text().catch(() => `${r.status}`);
        throw new Error(`HTTP ${r.status} ${txt}`);
      }
      return r.json();
    },
    tokenInfo: (t, signal) => API.json(API.withToken('https://api.guildwars2.com/v2/tokeninfo', t), signal),
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

  // (Conversor movido a converter-modal.js)
  };

  /* ========================= Utils ========================= */
  function setStatus(m, k = 'info') {
    if (!el.status) return;
    el.status.style.color = k === 'error' ? 'var(--color-red)' : (k === 'ok' ? 'var(--color-green)' : 'var(--muted)');
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
      // `opts.ttl || 3500` se tragaba el 0: 0 es falsy, asi que `ttl: 0` -- la
      // UNICA forma documentada de pedir persistente -- subia a 3500 y el toast
      // se autodestruia a los 3,5 s. `??` separa "no informado" de "informado 0".
      // Un NEGATIVO tambien queda persistente (no hay timer): es lo que hacia
      // antes, ahora escrito en vez de oculto. Prohibirlo en el contrato seria
      // inventar una regla que el codigo no tiene; la prohibion verificable
      // vive en el test, que afirma que ningun call-site pasa un negativo.
      const ttl = Number(opts.ttl ?? 3500);
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

  // NUEVO: Formato de moneda con colores (mismo que Dashboard)
  function formatCoinValue(value) {
    var copper = Math.abs(Math.floor(value));
    var gold = Math.floor(copper / 10000);
    var silver = Math.floor((copper % 10000) / 100);
    var copperLeft = copper % 100;
    var parts = [];
    if (gold > 0) parts.push('<span style="color:#f4c542;font-weight:600;">' + gold.toLocaleString('es-AR') + '</span> <span style="color:var(--muted);">g</span>');
    if (silver > 0) parts.push('<span style="color:#e0e0e0;font-weight:500;">' + silver + '</span> <span style="color:var(--muted);">s</span>');
    parts.push('<span style="color:#b87333;font-weight:500;">' + copperLeft + '</span> <span style="color:var(--muted);">c</span>');
    return parts.join(' ');
  }

  
  function rowHTML(r) {
    const icon  = iconTag(r._cur?.icon, 22);

    // Categorías como badges (mismo estilo que Dashboard)
    const catBadges = (r.cats && r.cats.length)
      ? r.cats.map(function(c) {
          return '<span class="badge badge--info" style="font-size:0.65rem;padding:2px 6px;">' + esc(c) + '</span>';
        }).join(' ')
      : '<span class="badge badge--muted">—</span>';

    // Moneda con colores
    const amount = isCoins(r._cur)
      ? formatCoinValue(r.amount)
      : '<span style="font-weight:600;">' + r.amount.toLocaleString('es-AR') + '</span>';

    const pinCls = 'wv-pin' + (r.isPinned ? ' wv-pin--active' : '');
    const pinBtn = '<button class="' + pinCls + '" data-wallet-pin="' + r.id + '" title="' + (r.isPinned ? 'Desfijar' : 'Fijar') + '" aria-pressed="' + (r.isPinned ? 'true' : 'false') + '">📌</button>';

    return '<tr data-id="' + r.id + '">' +
      '<td>' + icon + '</td>' +
      '<td><strong>' + esc(r.name) + '</strong></td>' +
      '<td class="right">' + amount + '</td>' +
      '<td>' + catBadges + '</td>' +
      '<td class="right">' + pinBtn + '</td>' +
      '</tr>';
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

  // Idea 63 T1: los filtros son de la cuenta que se estaba mirando. Al cambiar
  // de cuenta describen a la anterior y, si dejan 0 filas, render() vacia los
  // contenedores y vuelve sin decir una palabra. Esta funcion es el UNICO reset:
  // la usan el boton de limpiar y el cambio de cuenta, para que no puedan divergir.
  function resetFilters() {
    state.filters = { q: '', cat: '', sort: 'order', onlyPos: false, onlyMain: false };
    if (el.searchBox) el.searchBox.value = '';
    if (el.category) el.category.value = '';
    if (el.sort) el.sort.value = 'order';
    if (el.onlyPos) el.onlyPos.checked = false;
    if (el.onlyMain) el.onlyMain.checked = false;
  }

  function render() {
    const rows = buildRows();
    if (!rows.length) {
      if (el.tableWrap) el.tableWrap.hidden = (state.view !== 'table');
      if (el.walletCards) el.walletCards.innerHTML = '';
      if (el.favCards) el.favCards.innerHTML = '';
      // Idea 63 T2: antes de este return el panel quedaba VACIO y sin una
      // palabra, indistinguible de "la cuenta no tiene wallet" o de "fallo la
      // carga". Se dice cual de los dos es y, si es el filtro, se ofrece la
      // salida con el mismo clearBtn que ya existe (app.js:1050).
      const hayFiltro = !!(state.filters.q || state.filters.cat ||
                           state.filters.onlyPos || state.filters.onlyMain);
      if (el.walletCards) {
        const msg = document.createElement('p');
        msg.className = 'muted';
        msg.style.textAlign = 'center';
        msg.style.padding = '20px';
        if (hayFiltro && state.wallet.length) {
          msg.appendChild(document.createTextNode(
            'Ningun tipo de moneda coincide con los filtros. Hay ' +
            state.wallet.length + ' en esta cuenta.'));
          const br = document.createElement('br');
          msg.appendChild(br);
          if (el.clearBtn) {
            const b = document.createElement('button');
            b.className = 'btn btn--xs';
            b.style.marginTop = '10px';
            b.textContent = 'Limpiar filtros';
            b.addEventListener('click', () => { resetFilters(); render(); });
            msg.appendChild(b);
          }
        } else {
          msg.textContent = 'No hay monedas para mostrar en esta cuenta.';
        }
        el.walletCards.appendChild(msg);
      }
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
  // Secuencia de carga (HB#87). `loadAllForToken` escribe `state.accountName`,
  // `state.wallet` y el `ownerLabel` SIN guarda, y sus 6 call-sites pueden
  // dispararse dos veces seguidas: el desplegable global (`app.js:1260`) no
  // tiene debounce ni abort, asi que dos cambios rapidos = dos cargas
  // concurrentes. Gana la que TERMINA ULTIMA, no la que se pidio ultima.
  //
  // Y no es solo un dato viejo: en el handler del desplegable, `setSelected`
  // corre ANTES del `await` (`:1263`), o sea que el desplegable ya dice B
  // cuando la carga arranca. Si la carga vieja de A responde despues, el
  // desplegable dice B y el nombre, el wallet y el `ownerLabel` son de A.
  // Sin error, sin aviso, y el unico dato que Pablo tendria que contrastar
  // para sospechar es el desplegable.
  //
  // La guarda no cancela la request (se gasta el ancho de banda) e impide
  // que se MUESTRE. El abort real ya tiene patron en el repo (`router.js:1466`,
  // `_actAbort.abort()`); `loadAllForToken` es la que quedo afuera, y cambiarlo
  // seria una refactorizacion de los 6 call-sites, no un fix.
  let loadSeq = 0;
  async function loadAllForToken(token) {
    const mine = ++loadSeq;
    setStatus('Cargando datos…');
    // Propuesta 9: toast persistente (ttl:0) con feedback de carga. El texto
    // nombra la cuenta: con 2 cargas concurrentes hay 2 toasts y, si los dos
    // dicen lo mismo, Pablo no puede saber cual es de cual. El label sale de
    // KeyManager (que ya sabe la cuenta que se esta pidiendo); si no esta, el
    // texto degrada al original en vez de mentir con un nombre vacio.
    const _label = KeyManager.list.find(k => k.value === token)?.label;
    const loadToast = window.toast?.('info',
      _label ? `Cargando wallet de ${_label}…` : 'Cargando wallet…', { ttl: 0 });
    // El toast es persistente, asi que cerrarlo es RESPONSABILIDAD de esta
    // funcion. El close estaba solo en el camino feliz: API.wallet no tiene
    // .catch, un fallo de red saltaba esa linea y el toast quedaba pegado. Con
    // el `||` el bug no se ve (a los 3,5 s se va solo), o sea que estaba
    // enmascarado; con el ttl ya arreglado aparece. Por eso el `finally` va en
    // el MISMO commit y no en uno aparte.
    try {
      await ensureCurrencies();
      const [acct, w] = await Promise.all([API.account(token).catch(() => null), API.wallet(token)]);
      // La carga perdedora NO escribe. Va DENTRO del try para que el `finally`
      // de arriba siga cerrando su toast: si la guarda se tragara el close, el
      // fix de HB#85 quedaria deshecho por este.
      if (mine !== loadSeq) return;
      state.accountName = acct?.name || '—'; state.wallet = w || [];
      el.ownerLabel && (el.ownerLabel.textContent = state.accountName);

      // Migración favs→pins (si aplica)
      migrateFavsToPinsIfNeeded();

      setStatus('Listo.', 'ok'); render();
    } finally {
      loadToast?.close();
    }
  }

  /* ==================== KeyManager ================== */
  // Permisos que la app USA, derivados de los endpoints que llama y del scope
  // que la wiki DECLARA para cada uno (tools/hb75-scopes.js re-deriva del
  // wikitext crudo, no de memoria). La puerta de addOrUpdate exige estos 7.
  // 'para' dice que modulo los usa, para que el mensaje de error sea util.
  //
  // endpoint con scope          ->  scope exigido
  // /v2/account/wallet            ->  account, wallet
  // /v2/account/achievements      ->  account, progression
  // /v2/account/luck              ->  account, progression, unlocks
  // /v2/account/raids             ->  account, progression
  // /v2/account/legendaryarmory   ->  account, unlocks, inventories
  // /v2/account/home/nodes        ->  account, progression, unlocks
  // /v2/account/bank              ->  account, inventories
  // /v2/account/materials         ->  account, inventories
  // /v2/commerce/delivery         ->  account, tradingpost
  // /v2/characters                ->  account, characters
  // /v2/characters/:id/inventory  ->  account, characters, inventories
  // La lista va DENTRO del literal, y no como const suelta arriba, por una razon
  // que costo un test: tests/idea64-dos-pestanas.test.js monta el KeyManager
  // en un sandbox vm extrayendo SOLO este literal del objeto, por equilibrio de
  // llaves. Una const declarada fuera del rango no existe en el sandbox y el
  // test moria con ReferenceError sin llegar a contar. El slice tiene que ser
  // autocontenido: no puede referenciar bindings de module scope.
  // OJO con este comentario, por el mismo extractor: no puede contain the needle
  // que el extractor busca (la declaracion de este literal), ni comillas
  // invertidas, ni llaves desbalanceadas. Todo lo que escriba aca se corta y se
  // pega dentro del sandbox, asi que se parsea como codigo.
  const KeyManager = {
    list: [],
    selected: null,
    _programmaticChange: false, // << NUEVO: evita bucles en change
    REQUIRED_PERMISSIONS: [
      { scope: 'account',    para: 'obligatorio para toda key' },
      { scope: 'wallet',     para: 'Cartera' },
      { scope: 'progression', para: 'Logros, Suerte, Raids, Actividad diaria' },
      { scope: 'unlocks',    para: 'Legendaria Imbuida, nodo de home' },
      { scope: 'inventories', para: 'Banco, materiales, Inventario' },
      { scope: 'tradingpost', para: 'delivery / Conversor' },
      { scope: 'characters', para: 'Personajes e Inventario' },
    ],

    load() {
      // Carga listado de keys
      // Storage.get de una clave espejo lee la legacy primero (storage.js
      // MIRROR_MAP), asi que el valor es el mismo que leia getItem, y la gn:
      // que sube el Gist deja de quedar con la foto del primer arranque.
      try { this.list = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_KEYS) || []; }
      catch { this.list = []; }
      state.keys = this.list.slice();

      // NUEVO: restaurar selección previa desde localStorage
      try { this.selected = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_SELECTED) || null; }
      catch { this.selected = null; }

      // Si la key guardada no existe más en la lista, anular selección
      if (this.selected && !this.list.some(k => k.value === this.selected)) {
        this.selected = null;
        // Storage.remove borra la gn: y su legacy: si se borrara solo la legacy,
        // la gn:account:selected seguiria con el valor viejo.
        try { Storage.remove(Storage.STORAGE_KEYS.ACCOUNT_SELECTED); } catch {}
      }

      state.selected = this.selected;
      // T2: desde el arranque, esta pestaña escucha los cambios de lista que
      // hacen las otras (solo se registra UNA vez).
      this._watchOtherTabs();
      return this.list;
    },
    _watching: false,

    // ── T1 (Idea 64): la lista de cuentas tiene VARIOS escritores ─────────────
    // `this.list` es una COPIA EN MEMORIA y esta pestaña es UNA de las que
    // escriben `gn:account:keys`. Antes, `save()` escribia esa copia a pelo y
    // la pestaña que escribía ULTIMO borraba las cuentas que solo conocia la
    // otra (lost update: dos datos buenos que se pisan, sin aviso ni error).
    //
    // Por que read-modify-write POR OPERACION y no una union de listas en
    // `save()`: el borrado de esta pestaña tiene que poder eliminar una cuenta.
    // Una union lo hace imposible — el usuario no podria borrar nunca nada.
    //
    // Por que `mutate` es OBLIGATORIO: no existe forma de volcar `this.list`
    // a pelo. La clase de bug queda imposible POR CONSTRUCCION, no mitigada.
    //
    // Si la cuenta no esta en la lista fresca: NO-OP + `console.warn`. La otra
    // pestaña la borro, y lo que se borro en otra pestaña no reaparece —
    // recrearla seria inventar estado que el otro no quiere. Esa es la decision
    // que el PO escalo y queda escrita aca con su por que.
    _fresh() {
      try {
        const d = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_KEYS);
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    },
    save(mutate) {
      const fresh = this._fresh();
      const next = typeof mutate === 'function' ? mutate(fresh) : fresh;
      this.list = Array.isArray(next) ? next : fresh;
      // Storage.set escribe la gn: y su legacy, que es la que leen 6 modulos
      // a pelo. Escribir solo la legacy dejaba la gn: congelada.
      try { Storage.set(Storage.STORAGE_KEYS.ACCOUNT_KEYS, this.list); } catch { }
      state.keys = this.list.slice();
    },

    // ── T2 (Idea 64): el `storage` hace el cambio VISIBLE ─────────────────────
    // Sin esto, el <select> ofrece cuentas que ya no son las de disco y el
    // overwrite sigue ocurriendo pero nadie lo ve. El evento `storage` NO se
    // dispara en la pestaña que escribe, solo en las otras: por eso esto no
    // puede entrar en bucle con `save()`.
    _watchOtherTabs() {
      if (this._watching) return;
      this._watching = true;
      window.addEventListener('storage', (e) => {
        if (!e || e.key !== Storage.STORAGE_KEYS.ACCOUNT_KEYS) return;
        const fresh = this._fresh();
        if (JSON.stringify(fresh) === JSON.stringify(this.list)) return;
        this.list = fresh;
        state.keys = this.list.slice();
        // Si la seleccion era una cuenta que la otra pestaña borro, se anula
        // en vez de dejar un token muerto selected.
        if (this.selected && !this.list.some(k => k.value === this.selected)) {
          this.selected = null;
          state.selected = null;
          try { Storage.remove(Storage.STORAGE_KEYS.ACCOUNT_SELECTED); } catch {}
        }
        this.refreshSelects();
      });
    },
    setSelected(token, opts) {
      opts = opts || {};
      this.selected = token || null;
      state.selected = this.selected;

      // NUEVO: persistir selección (o limpiar si es null)
      try {
        if (this.selected) Storage.set(Storage.STORAGE_KEYS.ACCOUNT_SELECTED, this.selected);
        else Storage.remove(Storage.STORAGE_KEYS.ACCOUNT_SELECTED);
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
    async addOrUpdate({ label, value, signal }) {
      setStatus('Validando API key…');
      const info = await API.tokenInfo(value, signal);
      const perms = new Set(info.permissions || []);
      // La puerta exige los permisos que la app USA, no los que se Declaraban
      // que eran los que se verificaban. Medido contra el scope que la wiki
      // declara para cada endpoint que la app llama (tools/hb75-scopes.js):
      // account+wallet alcanza para 1 de 9 endpoints con scope; los otros 8
      // piden progression, unlocks, inventories, tradingpost o characters.
      // Con solo estos 2, la API responde 403 y la capa degrada a []/0, o sea
      // indistinguible de una cuenta vacia (Idea 47/57). La lista se deriva
      // de ahi, no de memoria, y nombra el modulo que pide cada permiso.
      const FALTAN = KeyManager.REQUIRED_PERMISSIONS.filter(p => !perms.has(p.scope));
      if (FALTAN.length) {
        throw new Error('La API key necesita permisos: ' +
          FALTAN.map(p => p.scope + ' (' + p.para + ')').join(', ') +
          '. La app usa ' + KeyManager.REQUIRED_PERMISSIONS.length +
          ' permisos en total; hay que declararlos TODOS al crear la key en account.arena.net/applications.');
      }

      const idx = this.list.findIndex(k => k.value === value);

      // T1: agregar/actualizar se resuelve sobre la lista FRESCA de disco, para
      // no pisar las cuentas que otra pestaña agregado. `idx` es de la copia en
      // memoria y solo se usa para el mensaje de abajo, no para el merge.

      // La puerta vive en UN punto, que es esta: aca es donde ya se sabe que
      // `perms` cumple la lista completa. Se persisten los permisos REALES que
      // devolvio /v2/tokeninfo (no el recorte contra REQUIRED_PERMISSIONS),
      // porque la idea es que el set persistido sea el que la key TIENE, y
      // asi la comprobacion de un backup restaurado no depende de la red.
      // Es aditivo: una key sin `perms` (las ya guardadas, los backups viejos)
      // sigue siendo valida y se trata como "desconocido", no como "malo".
      const permsReales = Array.isArray(info.permissions) ? info.permissions.slice() : [];
      this.save(fresh => {
        const i = fresh.findIndex(k => k.value === value);
        if (i >= 0) { fresh[i].label = label || fresh[i].label || ''; fresh[i].perms = permsReales; }
        else fresh.push({ label, value, perms: permsReales });
      });
      this.refreshSelects();
      // Selecciona y notifica (router capturará el 'change' programático)
      this.setSelected(value);

      // Cargar datos de Wallet en paralelo
      await loadAllForToken(value);

      const isNew = idx < 0;
      setStatus(isNew ? 'Key guardada.' : 'Key actualizada.', 'ok');
      window.toast?.('success', isNew ? 'Key guardada' : 'Key actualizada', { ttl: 1400 });
    },
    rename(value, newLabel) {
      let existe = false;
      // T1: el renombrado se aplica sobre la lista FRESCA. Si la cuenta no esta
      // en ella, la otra pestaña la borro entre medio: NO-OP + warn, porque lo
      // que se borro en otra pestaña no tiene que reaparecer. Es la decision que
      // el PO escalo; el por que esta en el bloque de T1 de arriba.
      this.save(fresh => {
        const item = fresh.find(k => k.value === value);
        if (!item) return;
        existe = true;
        item.label = newLabel || '';
      });
      if (!existe) {
        console.warn('[KeyManager] rename(): la cuenta no esta en la lista de otra pestaña; no se renombra.', value);
        return;
      }
      this.refreshSelects();
    },
        remove(value) {
      // T1: el borrado se aplica sobre la lista FRESCA. Filtrar la copia en
      // memoria era lo que borraba en silencio las cuentas que otra pestaña
      // habia agregado.
      this.save(fresh => fresh.filter(k => k.value !== value));
      this.refreshSelects();

      // IDEA 50-D (a''): la cache de la cuenta que se borra se va CON ella.
      // Antes se quedaba para siempre: el token ya no esta en ninguna parte, asi
      // que sus claves nunca se leian y nunca se borraban — con 27 cuentas y
      // ~4.98 MB medidos, la cuota se llenaba de cuentas que Pablo ya elimino y
      // a partir de ahi cada escritura fallaba por cuota.
      //
      // Va DESPUES de `save()`, no antes, por una razon que es de orden y no de
      // estilo: `save()` es el unico que puede no-op (la cuenta ya no estaba) y
      // en ese caso el token tampoco es de una cuenta que quede viva, asi que
      // borrar su cache es lo mismo. Lo que NO se puede es borrar la cache de
      // una cuenta que sobrevive, y por eso se pasa `value` —el token exacto que
      // se acaba de quitar de la lista— y no "la cuenta seleccionada".
      //
      // `try/catch` porque es una mejora de cuota, no una operacion de la que
      // dependa el estado de la app: si localStorage no esta (modo privado), la
      // cuenta se borro igual.
      try { window.GW2Api?.__cacheDropToken?.(value); } catch (_) {}

      if (this.selected === value) {
        const next = this.list[0]?.value || null;
        this.setSelected(next);
        if (next) loadAllForToken(next);
        else { state.wallet = []; render(); }
      }
    },

    // NUEVO: Guarda el tipo de cuenta (main/alter/f2p) asociado a una API key
    setKeyTag: function(token, tag) {
      let existe = false, etiqueta = '';
      // T1: mismo criterio que rename() — sobre la lista fresca, y no-op + warn
      // si la otra pestaña borro la cuenta. El tag main/alter/f2p es lo que
      // permite ordenar 27 cuentas: perderlo en silencio es el caso que el PO
      // describio como el que mas duele.
      this.save(fresh => {
        const item = fresh.find(k => k.value === token);
        if (!item) return;
        existe = true;
        etiqueta = item.label || '';
        item.tag = tag;
      });
      if (!existe) {
        console.warn('[KeyManager] setKeyTag(): la cuenta no esta en la lista de otra pestaña; no se etiqueta.', token);
        return;
      }
      this.refreshSelects();
      console.info('[KeyManager] Tag actualizado:', etiqueta || 'Key', '→', tag);
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
    if (typeof Analytics !== 'undefined') Analytics.openApiKeysModal();

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
      el.keysList.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:12px;">
          <img src="assets/icons/Cuentas/155048.png" width="48" height="48" alt="" style="filter:brightness(0.7);opacity:0.7;">
          <p class="muted" style="margin:0;">No tenés API Keys guardadas.</p>
          <p class="muted" style="margin:0;font-size:0.75rem;">Agregá una debajo para empezar.</p>
        </div>`;
      return;
    }

    var selectedToken = KeyManager.selected;
    el.keysList.innerHTML = KeyManager.list.map(function(k) {
      var isSelected = (k.value === selectedToken);
      var tagIcon = '';
      if (k.tag && ACCOUNT_TYPE_ICONS[k.tag]) {
        tagIcon = '<img src="' + ACCOUNT_TYPE_ICONS[k.tag] + '" width="20" height="20" alt="' + k.tag + '" title="' + k.tag + '" style="filter:brightness(0.9);flex-shrink:0;">';
      }
      var bLeft = isSelected ? 'rgba(160,255,200,0.6)' : 'rgba(255,255,255,0.08)';
      var bg    = isSelected ? 'rgba(160,255,200,0.04)' : 'transparent';

      return `
      <div class="keys-row" data-val="${esc(k.value)}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${bg};border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${bLeft};border-radius:10px;transition:border-color 0.15s ease;">
        <div style="flex-shrink:0;">
          ${tagIcon || '<img src="' + CONFIG_ICONS.account + '" width="28" height="28" alt="" style="filter:brightness(0.7);opacity:0.5;border-radius:6px;">'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--tx-1);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${esc(k.label || obfuscate(k.value))}
            ${isSelected ? '<span style="font-size:0.65rem;background:var(--color-green-bg);color:var(--color-green);padding:2px 8px;border-radius:20px;">✓ En uso</span>' : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:4px;">
            <img src="assets/icons/Cuentas/155048.png" width="12" height="12" alt="" style="filter:brightness(0.7);">
            ${esc(obfuscate(k.value))}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn k-use"    title="Usar esta Key" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:4px 8px;"><img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="" style="filter:brightness(0.9);"> Usar</button>
          <button class="btn k-copy"   title="Copiar API Key" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:4px 8px;"><img src="assets/icons/Welcome/155911.png" width="14" height="14" alt="" style="filter:brightness(0.9);"> Copiar</button>
          <button class="btn k-rename" title="Renombrar" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:4px 8px;"><img src="assets/icons/Welcome/102353.png" width="14" height="14" alt="" style="filter:brightness(0.9);"> Renombrar</button>
          <button class="btn k-del"    title="Eliminar" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:4px 8px;background:rgba(255,157,157,0.1);border-color:rgba(255,157,157,0.3);color:var(--color-red);"><img src="assets/icons/Welcome/156107.png" width="14" height="14" alt="" style="filter:brightness(0.9);"> Eliminar</button>
        </div>
      </div>`;
    }).join('');

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

      // Evento Analytics
      if (typeof Analytics !== 'undefined') Analytics.deleteApiKey();

      KeyManager.remove(val);
      renderKeysList();
      setStatus('Key eliminada.', 'ok');
    }));
  }

  // === Propuesta 8: parsear errores de la API en mensajes diferenciados ===
  function parseKeyError(err) {
    const m = (err?.message || '');
    // El mensaje de la puerta de permisos (app.js, REQUIRED_PERMISSIONS) ya
    // nombra los 7 que exige y el motivo de cada uno. Antes esta linea
    // devolvia "Faltan permisos: account + wallet" — los 2 permisos de antes de
    // que la puerta exigiera 7 — y ese texto pisaba el detalle, que se
    // construia bien y no se mostraba nunca. Un error de la API con la palabra
    // "permisos" conserva ahora su propio texto en vez de perderlo.
    if (/permisos/i.test(m)) return { msg: m };
    if (/HTTP 401/i.test(m)) return { msg: 'Key inválida (HTTP 401)' };
    if (/HTTP 403/i.test(m)) return { msg: 'Key prohibida (HTTP 403)' };
    if (/HTTP 429/i.test(m)) return { msg: 'Demasiadas peticiones (HTTP 429)' };
    if (/fetch|conexi|network|red/i.test(m)) return { msg: 'Error de red: no se pudo conectar a la API de GW2' };
    return { msg: m || 'Error desconocido' };
  }

  // === Propuesta 3: Validación local de formato (antes de enviar a la API) ===
  // El formato de una API key de GW2 son uno o dos bloques GUID en hex separadas
  // por guiones (8-4-4-4-12). Derivado de la documentación, NO de memoria: la
  // wiki de /v2/tokeninfo dice que su campo `id` es "the first HALF of the API
  // key" y su ejemplo oficial son 36 chars, o sea 36 + 1 + 36 = 73. Por eso el
  // bloque 2 es opcional y el 1 obligatorio: /v2/tokeninfo devuelve la mitad.
  // El regex laxo anterior (20+ alfanumericos) aceptaba desde basura alfanumerica
  // hasta una key sin guiones; la API responde 401 a todo por igual, o sea que
  // la guarda local es la unica que puede avisar antes de gastar la llamada.
  function isValidKeyFormat(v) {
    return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?:-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})*$/.test(v);
  }

  // === Propuesta 4: mensaje hermano (creado una vez, reutilizado) ===
  let _fieldMsg = null;
  function ensureFieldMsg() {
    if (_fieldMsg) return _fieldMsg;
    if (!el.kfValue) return null;
    _fieldMsg = document.createElement('span');
    _fieldMsg.className = 'field-msg';
    _fieldMsg.setAttribute('aria-live', 'polite');
    el.kfValue.parentElement?.appendChild(_fieldMsg);
    return _fieldMsg;
  }

  function wireKeysForm() {
    if (!el.keysForm) return;
    ensureFieldMsg();
    el.keysForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = el.kfLabel?.value.trim() || '';
      const value = el.kfValue?.value.trim() || '';
      if (!value) return setStatus('Ingresá una API key.', 'error');

      // Propuesta 3: validación local de formato
      if (!isValidKeyFormat(value)) {
        el.kfValue?.classList.remove('field--ok', 'field--bad');
        el.kfValue?.classList.add('field--bad');
        if (_fieldMsg) _fieldMsg.textContent = 'El formato no es válido. Se espera un GUID 8-4-4-4-12 en hexadecimal, guion por guion.';
        setStatus('El formato de la API key no es válido. Debe ser un GUID de 8-4-4-4-12 (opcionalmente seguido de otro igual).', 'error');
        window.toast?.('error','Formato de API key inválido', { ttl: 2500 });
        return;
      }

      const submitBtn = el.keysForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent || '';

      // Propuesta 6: AbortController + timeout de 10s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Propuesta 4: limpiar marcas previas (NO marcar error aquí)
      el.kfValue?.classList.remove('field--ok', 'field--bad');
      if (_fieldMsg) _fieldMsg.textContent = '';

      // Propuesta 1: loading state
      if (submitBtn) {
        submitBtn.textContent = 'Validando…';
        submitBtn.classList.add('btn--loading');
        submitBtn.disabled = true;
      }

      try {
        // Evento Analytics
        if (typeof Analytics !== 'undefined') Analytics.addApiKey();

        await KeyManager.addOrUpdate({ label, value, signal: controller.signal });
        if (el.kfLabel) el.kfLabel.value = '';
        if (el.kfValue) el.kfValue.value = '';
        renderKeysList();

        // Propuesta 2: focus automático en el campo de key para la próxima entrada
        if (el.kfValue) {
          el.kfValue.focus();
          el.kfValue.select();
        }

        // Propuesta 4: marcar éxito
        el.kfValue?.classList.remove('field--bad');
        el.kfValue?.classList.add('field--ok');
        if (_fieldMsg) _fieldMsg.textContent = '';
      } catch (err) {
        console.error(err);

        // Propuesta 8: parsear error específico
        const isTimeout = err.name === 'AbortError';
        const { msg } = isTimeout
          ? { msg: 'Timeout: la API de GW2 no respondió en 10s.' }
          : parseKeyError(err);

        // Propuesta 4: marcar error
        el.kfValue?.classList.remove('field--ok');
        el.kfValue?.classList.add('field--bad');
        if (_fieldMsg) _fieldMsg.textContent = msg;

        setStatus(msg, 'error');
        // El mensaje de la puerta son 411 chars. El toast mantiene su reloj
        // corto a proposito: con el host por encima del modal (main.css,
        // z-index 10001) se lee, y las dos superficies que ya eran
        // PERSISTENTES -- `_fieldMsg` y `setStatus` -- son las que cubren la
        // lectura detenida.
        //
        // NO usar `ttl: 0` para "no se borra solo": `toast()` resuelve con
        // `Number(opts.ttl || 3500)` (app.js:215) y 0 es falsy, asi que
        // `ttl: 0` NO es persistente: sube el ttl de 2500 a 3500. Para pedir
        // persistente hay que pasar un NEGATIVO, que es un contrato roto y se
        // arregla aparte (ver COMMS_LOG), no en esta linea.
        window.toast?.('error', msg, { ttl: 2500 });
      } finally {
        // Propuesta 6: limpiar timeout (siempre, incluso en caso de error)
        clearTimeout(timeoutId);

        // Propuesta 1: restaurar estado original
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('btn--loading');
          submitBtn.disabled = false;
        }
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
      resetFilters();
      render();
    });

    // Idea 63 T1: limpiar los filtros al cambiar de cuenta. Se registra UNA vez
    // (wireEvents corre una sola vez desde boot) y antes de que llegue el primer
    // gn:tokenchange, que app.js mismo emite en boot.
    if (!state._wiredTokenListener) {
      state._wiredTokenListener = true;
      document.addEventListener('gn:tokenchange', () => {
        resetFilters();
        render();
      });
    }

    // Alternar vista (tarjetas/tabla)
    el.toggleViewBtn?.addEventListener('click', () => {
      state.view = (state.view === 'cards') ? 'table' : 'cards';
      setViewTogglePressed();
      render();
    });

    // Botón para abrir el modal del Conversor (movido a converter-modal.js)
    var convBtn = document.getElementById('walletConverterBtn');
    if (convBtn) {
      convBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.ConverterModal && typeof window.ConverterModal.open === 'function') {
          window.ConverterModal.open();
        }
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
      try {
        await loadAllForToken(KeyManager.selected);
      } catch (e) {
        console.warn('[app] Error cargando datos para la key seleccionada:', e.message);
        setStatus('⚠️ La API key guardada no tiene acceso al juego. Seleccioná otra.', 'error');
        // No bloquear la app — wireEvents se ejecuta igual
      }
    } else {
      render();
    }

    // Sincronizar A11y inicial
    setHeroTabsSelected('cards');     // por defecto
    setViewTogglePressed();           // según state.view

    wireEvents();
  // (Conversor movido a converter-modal.js)
    runIconChecks();

    // Avisar token inicial a otros módulos (compat)
    document.dispatchEvent(new CustomEvent('gn:tokenchange', { detail: { token: KeyManager.selected } }));
    // NUEVO: asegurar que Objetivos (y demás) también se actualicen al iniciar
    emitRefreshEvents(KeyManager.selected, 'boot');
  }
  boot();

  // (Conversor movido a converter-modal.js)

  // Hooks públicos (MetaEventos los usa)
  //
  // ALERT-197: esto era `window.__GN__ = { ... }`, o sea una REASIGNACION del
  // objeto entero, sin guard y sin merge. Tenia 2 escritores de `__GN__` y uno
  // se comia al otro: raid-tracker.js publica `wireViewTogglePair` en carga
  // (:2035) y app.js se declara despues en el documento (index.html:1034,
  // `defer`, que preserva el orden), asi que para cuando
  // strike-tracker.js:622 iba a leerlo en runtime ya era `undefined`. Caia al
  // `else`, logueaba `'escritor comun no disponible; toggle sin cablear'` — un
  // `console.debug`, no un error — y el par de Strikes quedaba con 0 listeners.
  // O sea T12-b (6e5a60c) quedaba muerto en el arranque, y en silencio.
  //
  // `Object.assign` conserva lo ya publicado y agrega estos tres, que es lo
  // unico que esta linea queria hacer. No rompe a ningun lector: `render`,
  // `runIconChecks` y `getSelectedToken` se siguen publicando igual, y son los
  // unicos tres que este modulo declara.
  window.__GN__ = Object.assign(window.__GN__ || {}, {
    render, runIconChecks,
    getSelectedToken: () => KeyManager.selected || null
  });
})();