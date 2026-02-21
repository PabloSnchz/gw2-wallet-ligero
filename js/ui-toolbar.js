(function () {
  // -------------------------
  // Estado
  // -------------------------
  const state = {
    keys: [],            // { label, value }[]
    selectedKey: null,   // string
    filters: { saldo: false, principales: false },
    sort: 'order',       // 'order' | 'name' | 'amount'
    view: 'cards',       // 'cards' | 'compact'
    data: { wallet: [], currencies: [] }
  };

  // -------------------------
  // Helpers DOM
  // -------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const el = {
    apiKeySelect: null,
    addKeyBtn: null,
    addKeyForm: null,
    newKeyLabel: null,
    newKeyValue: null,
    cancelAddKey: null,
    controls: null,
    messages: null,
    cards: null,
  };

  function setMessage(msg, kind = 'error') {
    if (!el.messages) return;
    el.messages.style.color = kind === 'error' ? '#b00020' : '#0b5700';
    el.messages.textContent = msg || '';
  }

  // -------------------------
  // Persistencia
  // -------------------------
  const LS_KEY = 'gw2_keys';
  function loadKeys() {
    try { state.keys = JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { state.keys = []; }
  }
  function saveKeys() { localStorage.setItem(LS_KEY, JSON.stringify(state.keys)); }

  function renderKeySelect() {
    if (!el.apiKeySelect) return;
    el.apiKeySelect.innerHTML = '';
    state.keys.forEach((k, i) => {
      const opt = document.createElement('option');
      opt.value = k.value;
      opt.textContent = k.label || `Key ${i + 1}`;
      el.apiKeySelect.appendChild(opt);
    });
    if (state.selectedKey) {
      el.apiKeySelect.value = state.selectedKey;
    } else if (state.keys.length) {
      state.selectedKey = state.keys[0].value;
      el.apiKeySelect.value = state.selectedKey;
    }
  }

  // -------------------------
  // API GW2 (fetch desde navegador con ?access_token=)
  // -------------------------
  async function fetchJson(url, { retries = 2, backoff = 500, signal } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
      if (res.ok) return res.json();
      if (res.status === 401 || res.status === 403) {
        const text = await res.text();
        throw new Error(text || 'API key inválida o sin permisos (requiere "account" y "wallet").');
      }
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(r => setTimeout(r, backoff * (attempt + 1)));
        continue;
      }
      const text = await res.text();
      throw new Error(text || `Error HTTP ${res.status}`);
    }
  }
  function withToken(urlBase, token) {
    const sep = urlBase.includes('?') ? '&' : '?';
    return `${urlBase}${sep}access_token=${encodeURIComponent(token)}`;
  }
  async function validateKey(token) {
    const url = withToken('https://api.guildwars2.com/v2/tokeninfo', token);
    const info = await fetchJson(url);
    const scopes = new Set(info.permissions || []);
    if (!scopes.has('account') || !scopes.has('wallet')) {
      throw new Error('La API key no tiene permisos suficientes: requiere "account" y "wallet".');
    }
    return info;
  }
  async function loadData(token) {
    const walletUrl = withToken('https://api.guildwars2.com/v2/account/wallet', token);
    const currenciesUrl = 'https://api.guildwars2.com/v2/currencies';
    const [wallet, currencies] = await Promise.all([
      fetchJson(walletUrl),
      fetchJson(currenciesUrl),
    ]);
    state.data.wallet = wallet;
    state.data.currencies = currencies;
  }

  // -------------------------
  // Transformación + Render
  // -------------------------
  function buildViewModel() {
    const mapCur = new Map(state.data.currencies.map(c => [c.id, c]));
    let rows = state.data.wallet.map(w => {
      const cur = mapCur.get(w.id) || { name: `#${w.id}`, order: 9999, icon: '' };
      return {
        id: w.id,
        amount: w.value,
        name: cur.name || `#${w.id}`,
        order: Number.isFinite(cur.order) ? cur.order : 9999,
        icon: cur.icon || '',
        category: cur.category || 'otro'
      };
    });
    if (state.filters.saldo) rows = rows.filter(r => r.amount > 0);
    if (state.filters.principales) {
      // Ajustalo si luego usás tu mapeo de "principales"
      const principales = new Set(['Coin', 'Karma', 'Laurel', 'Geode', 'Guild Commendation']);
      rows = rows.filter(r => principales.has(r.name));
    }
    if (state.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === 'amount') rows.sort((a, b) => b.amount - a.amount);
    else rows.sort((a, b) => a.order - b.order);
    return rows;
  }

  function render() {
    if (!el.cards) return;
    const rows = buildViewModel();
    el.cards.innerHTML = '';

    if (state.view === 'compact') {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead><tr><th>Divisa</th><th>Cantidad</th></tr></thead>
        <tbody></tbody>`;
      const tbody = table.querySelector('tbody');
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.icon ? `${r.icon}` : ''} ${r.name}</td>
          <td style="text-align:right;">${r.amount.toLocaleString()}</td>`;
        tbody.appendChild(tr);
      });
      el.cards.appendChild(table);
      return;
    }

    rows.forEach(r => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <header>
          <h3>${r.name}</h3>
          <small>${r.category}</small>
        </header>
        <footer class="row">
          ${r.icon ? `${r.icon}` : ''}
          <strong>${r.amount.toLocaleString()}</strong>
        </footer>
      `;
      el.cards.appendChild(card);
    });
  }

  async function loadAndRender() {
    if (!state.selectedKey) {
      setMessage('Seleccioná una API key o cargá una nueva con el botón "+"', 'error');
      return;
    }
    try {
      setMessage('Cargando…', 'ok');
      await loadData(state.selectedKey);
      setMessage('');
      render();
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'No se pudieron cargar los datos.');
    }
  }

  // -------------------------
  // Wire Events
  // -------------------------
  function wireEvents() {
    // select de keys
    el.apiKeySelect.addEventListener('change', () => {
      state.selectedKey = el.apiKeySelect.value || null;
      loadAndRender();
    });

    // botón +
    el.addKeyBtn.addEventListener('click', () => {
      const open = el.addKeyBtn.getAttribute('aria-expanded') === 'true';
      el.addKeyBtn.setAttribute('aria-expanded', String(!open));
      el.addKeyForm.classList.toggle('collapsed', open);
      if (!open) el.newKeyValue.focus();
    });

    // cancelar
    el.cancelAddKey.addEventListener('click', () => {
      el.addKeyBtn.setAttribute('aria-expanded', 'false');
      el.addKeyForm.classList.add('collapsed');
      el.newKeyLabel.value = '';
      el.newKeyValue.value = '';
    });

    // submit alta de key
    el.addKeyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = el.newKeyLabel.value.trim();
      const value = el.newKeyValue.value.trim();
      if (!value) return setMessage('Ingresá una API key.', 'error');
      try {
        setMessage('Validando API key…', 'ok');
        await validateKey(value); // requiere account + wallet
        state.keys.push({ label, value });
        saveKeys();
        state.selectedKey = value;
        renderKeySelect();
        el.addKeyBtn.setAttribute('aria-expanded', 'false');
        el.addKeyForm.classList.add('collapsed');
        el.newKeyLabel.value = '';
        el.newKeyValue.value = '';
        setMessage('API key guardada.', 'ok');
        loadAndRender();
      } catch (err) {
        console.error(err);
        setMessage(err.message || 'La API key no es válida o carece de permisos.');
      }
    });

    // delegación para los botones
    el.controls.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.filter) {
        const k = b.dataset.filter;
        state.filters[k] = !state.filters[k];
        b.setAttribute('aria-pressed', String(state.filters[k]));
        render();
      } else if (b.dataset.sort) {
        state.sort = b.dataset.sort;
        $$('#cardControls [data-sort]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        render();
      } else if (b.dataset.view) {
        state.view = b.dataset.view;
        $$('#cardControls [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        render();
      }
    });
  }

  // -------------------------
  // Iniciar (cuando el DOM tenga nuestros nodos)
  // -------------------------
  function init() {
    // tomar referencias
    el.apiKeySelect = document.getElementById('apiKeySelect');
    el.addKeyBtn = document.getElementById('addKeyBtn');
    el.addKeyForm = document.getElementById('addKeyForm');
    el.newKeyLabel = document.getElementById('newKeyLabel');
    el.newKeyValue = document.getElementById('newKeyValue');
    el.cancelAddKey = document.getElementById('cancelAddKey');
    el.controls = document.getElementById('cardControls');
    el.messages = document.getElementById('messages');
    el.cards = document.getElementById('cardsContainer');

    // si no está el contenedor, todavía no insertaste el HTML
    if (!el.cards) return;

    loadKeys();
    renderKeySelect();
    wireEvents();
    if (state.selectedKey) loadAndRender();
  }

  document.addEventListener('DOMContentLoaded', init);
})();