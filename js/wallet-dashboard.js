/*!
 * js/wallet-dashboard.js — Dashboard de Cartera Multi-Cuenta
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 3.0.0 (2026-10-22) — Todas las cuentas renovada (BL-056, CAR-3)
 *
 * v3.0.0: la pantalla que se aprobó en la propuesta de la Cartera (CAR-0). Solo cambia
 *   cómo se dibuja; la lectura de cuentas, el progreso con ETA, los errores por columna y
 *   el orden quedan como estaban.
 *   - Columnas como chips con «×» y «＋ Agregar divisa…» con buscador (antes, un
 *     desplegable con todos los nombres separados por comas).
 *   - La columna de la cuenta, la cabecera y la fila de totales quedan fijas al desplazar.
 *   - El mejor valor de cada columna, en dorado. «Total (26 de 27)» si alguna cuenta no
 *     se pudo leer, y sus celdas dicen «— ⚠» en vez de un 0 falso.
 *   - En el celular, cada cuenta es una tarjeta.
 *   - Arreglos: el HTML del estado sin divisas estaba mal armado (y tenía un «2» suelto);
 *     el borde del KPI de suerte se escribía como CSS dentro de un string y el navegador
 *     lo ignoraba; cada dibujo del selector sumaba un oyente nuevo en document.
 *   - Estilos con las variables del theme (antes, colores fijos inline).
 *
 * v2.9.0: ETA medida en el contador de carga (Idea 48 Tramo B; sin «limitado por la API»).
 * v2.8.1: .catch no-op en apP/raidsP/luckP (evita unhandledrejection; Idea 47 c2).
 * v2.8.0: columna Suerte (MF base) y error por columna: «no se pudo leer» ≠ 0.
 * Historia completa: CHANGELOG.md y git.
 */

(function (root) {
  'use strict';
  // Idea 45: progreso multicuenta y error por cuenta, para que un fallo no se vea como una cuenta vacía.
  var LOG = '[WalletDashboard]';

  // ------------------------------ Utils DOM ------------------------------
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtInt(n){ if (n==null || !isFinite(n)) return '—'; n=Number(n||0); return n.toLocaleString('es-AR'); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  function fpToken(token){ var t=String(token||''); return t ? (t.slice(0,4)+'…'+t.slice(-4)) : 'anon'; }
  // Nombres legibles de los endpoints que alimentan las columnas resumen.
  var SUMMARY_ENDPOINTS = {
    characters: 'getCharacterCount (/v2/characters)',
    achievements: 'getAccountInfo (/v2/account/info)',
    raids: 'getAccountRaids (/v2/account/raids)',
    luck: 'getAccountLuck (/v2/account/luck)'
  };
  function unreadableReason(e, field){
    var ep = SUMMARY_ENDPOINTS[field] || field;
    return 'No se pudo leer ' + ep + ' — ' + ((e && e.message) ? e.message : 'error desconocido');
  }
  // Celda de un valor que NO se pudo leer. Distingue "0 real" de "no se pudo consultar",
  // que es la diferencia entre un dato y su ausencia. Ver docs/ONBOARDING.md
  // ("Criterio de manejo de error en la capa API").
  function unreadableCell(reason){
    return '<td class="right" title="' + esc(reason) + '">— ⚠</td>';
  }
  function formatTimestamp(date){
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ------------------------------ Formato de moneda ------------------------------
  function formatCoinValue(value) {
    if (value == null || isNaN(value)) return '—';
    var copper = Math.abs(Math.floor(value));
    var gold = Math.floor(copper / 10000);
    var silver = Math.floor((copper % 10000) / 100);
    var copperLeft = copper % 100;
    // Como en la Cartera: oro y plata; el cobre solo cuando no hay oro.
    var out = '';
    if (gold > 0) out += '<b class="wd3-g">' + gold.toLocaleString('es-AR') + '</b><small>g</small>';
    if (silver > 0 || gold > 0) out += '<b class="wd3-s">' + (gold > 0 ? String(silver).padStart(2, '0') : silver) + '</b><small>s</small>';
    if (gold === 0) out += '<b class="wd3-c">' + copperLeft + '</b><small>c</small>';
    return '<span class="wd3-coin">' + out + '</span>';
  }

  // ------------------------------ Estado -------------------------------
  var state = {
    inited: false,
    active: false,
    keys: [],
    accounts: [],
    currencies: [],
    selectedCurrencies: [],
    summaries: {},
    loading: false,
    lastRefreshTime: null,
    sortColumn: null,
    sortDirection: 'desc'
  };

  var _refreshInFlight = null;

  // ------------------------------ Progreso multicuenta (Idea 45) ----------
  // Distingue «cargando», «colgado» y «la 14 de 27 falló» (un fallo silencioso parecía un resultado vacío).
  var _progress = { done: 0, total: 0, current: [], errors: [] };

  // La URL de error de la API trae ?access_token=... — NUNCA se muestra.
  // Se reduce al path para poder decir QUÉ endpoint falló sin filtrar el token.
  function safeEndpoint(e, fallback) {
    var u = (e && e.url) ? String(e.url) : '';
    if (!u) return fallback || null;
    try {
      var url = new URL(u);
      url.searchParams.delete('access_token');
      return url.pathname;
    } catch (_) {
      return u.split('?')[0] || fallback || null;
    }
  }

  // Normaliza un error de fetch a algo mostrable: mensaje + status + endpoint.
  function describeError(e, endpointFallback) {
    var ep = safeEndpoint(e, endpointFallback);
    var status = (e && e.status) ? e.status : null;
    var msg = (e && e.message) ? String(e.message) : 'Error desconocido';
    // "No scope" / "Requires scope progression" vienen como texto de la API:
    // no son un fallo de red, son una cuenta sin permisos. Se distinguen.
    var kind = 'error';
    if (/scope/i.test(msg)) kind = 'scope';
    return { message: msg, status: status, endpoint: ep, kind: kind };
  }

  // ---- ETA del contador (Idea 48, Tramo B) ---------------------------------
  // Se mide sobre cuentas completadas en ESTA corrida (no sobre el pool). No se muestra antes de
  // ETA_MIN_DONE cuentas y ETA_MIN_MS de elapsed: con menos muestra sería un número inventado.
  var ETA_MIN_DONE = 3;
  var ETA_MIN_MS = 1500;

  function nowMs() { return Date.now(); }

  // Devuelve {ms, secs} o null si todavia no hay muestra suficiente.
  // Funcion pura salvo por nowMs(): recibe el tiempo como parametro para que el
  // test pueda ejercitarla sin reloj.
  function computeEta(startedAt, done, total, tNow) {
    if (!total || done >= total) return null;
    if (done < ETA_MIN_DONE) return null;
    var elapsed = tNow - startedAt;
    if (!(elapsed >= ETA_MIN_MS)) return null;
    var remaining = total - done;
    var ms = (elapsed / done) * remaining;
    if (!isFinite(ms) || ms <= 0) return null;
    return { ms: ms, secs: Math.ceil(ms / 1000) };
  }

  // "~12 s" / "~2 min". Redondea hacia arriba a segundos: un "~11 s" que en
  // realidad son 11.4 y termina en 12 Promete menos de lo que cumple.
  function fmtEta(secs) {
    if (secs < 60) return '~' + secs + ' s';
    var m = Math.ceil(secs / 60);
    return '~' + m + ' min';
  }

  function progressReset(total) {
    _progress = { done: 0, total: total || 0, current: [], errors: [], startedAt: nowMs() };
    updateProgressStatus();
  }

  function progressStart(label) {
    _progress.current.push(label);
    updateProgressStatus();
  }

  function progressEnd(label, errInfo) {
    var i = _progress.current.indexOf(label);
    if (i >= 0) _progress.current.splice(i, 1);
    if (errInfo) _progress.errors.push(errInfo);
    _progress.done++;
    updateProgressStatus();
  }

  function updateProgressStatus() {
    if (!_progress.total) return;
    var msg = 'Cargando cuentas... ' + _progress.done + '/' + _progress.total;
    var eta = computeEta(_progress.startedAt, _progress.done, _progress.total, nowMs());
    if (eta) msg += ' — ' + fmtEta(eta.secs) + ' restantes';
    if (_progress.errors.length) {
      msg += ' · ' + _progress.errors.length + ' con error';
    }
    setStatus(msg, _progress.errors.length ? 'error' : undefined);
  }

  // Resumen de fallos: cada cuenta nombrada CON su endpoint. Sin esto, un
  // fallo es indistinguible de una cuenta vacía.
  function renderProgressErrors() {
    var box = document.getElementById('wdLoadErrors');
    if (!box) return;
    if (!_progress.errors.length) { box.innerHTML = ''; return; }

    var html = '<div class="wd3-errs" role="status"><b>' +
      _progress.errors.length + ' de ' + _progress.total + ' cuentas no se pudieron leer</b>' +
      '<p>El total suma solo las que se leyeron. Las que faltan se ven con «— ⚠» en la tabla.</p><ul>';
    for (var i = 0; i < _progress.errors.length && i < 10; i++) {
      var e = _progress.errors[i];
      var ep = e.endpoint ? ' (' + esc(e.endpoint) + ')' : '';
      var st = e.status ? ' · HTTP ' + e.status : '';
      html += '<li>' + esc(e.label) + ' no se pudo leer' + ep + st + '</li>';
    }
    if (_progress.errors.length > 10) {
      html += '<li>… y ' + (_progress.errors.length - 10) + ' más</li>';
    }
    html += '</ul></div>';
    box.innerHTML = html;
  }

  var STORAGE_KEY = (typeof Storage !== 'undefined' && Storage.STORAGE_KEYS) ? Storage.STORAGE_KEYS.WALLET_DASHBOARD_CURR : 'gn:wallet:dashboard:selected_currencies';
  var SORT_STORAGE_KEY = (typeof Storage !== 'undefined' && Storage.STORAGE_KEYS) ? Storage.STORAGE_KEYS.WALLET_DASHBOARD_SORT : 'gn:wallet:dashboard:sort';

  var DEFAULT_CURRENCY_NAMES = ['Gema', 'Moneda', 'Laurel', 'Reconocimiento Astral', 'Karma', 'Esquirla espiritual'];
  // Iconos por tipo de cuenta (mismos que accounts-panel.js); sin tipo, las iniciales.
  var ACCOUNT_TYPE_ICONS = {
    'main':  'assets/icons/Cuentas/547827.png',
    'alter': 'assets/icons/Cuentas/157375.png',
    'f2p':   'assets/icons/Cuentas/102538.png'
  };

  // La tabla ya no tiene columnas de resumen (no hay selector de campos), pero
  // el KPI "Mejor MF base" se dibuja siempre y usa este simbolo.
  var SUMMARY_FIELD_SYMBOLS = {
    'luck': '\u{1F340}'
  };

  // ------------------------------------------------------------------------
  // Suerte (Luck / magic find account-wide)
  // El modulo window.LuckCurve trae la tabla oficial de umbrales. Si por lo
  // que sea no estuviera cargado, caemos a un objeto neutro en vez de romper.
  // ------------------------------------------------------------------------
  function luckToProgress(value) {
    var LC = root.LuckCurve;
    if (LC && typeof LC.fromLuck === 'function') return LC.fromLuck(value);
    var v = Number(value) || 0;
    return {
      value: v, mf: 0, missing: 0, nextLuck: 0,
      capped: false, pct: 0, maxed: false, overflow: 0
    };
  }

  function fmtLuck(n) {
    try { return fmtInt(Math.round(Number(n) || 0)); }
    catch(_) { return String(Math.round(Number(n) || 0)); }
  }

  function renderLuckCell(s) {
    if (!s || typeof s.luck !== 'number') return '<td class="right">—</td>';
    var lc = luckToProgress(s.luckTotal);
    var pct = Math.max(0, Math.min(100, Number(s.luckPct) || 0));
    var barColor = lc.capped ? 'rgba(76,175,80,0.85)' : 'rgba(255,193,7,0.85)';

    var tip;
    if (lc.capped) {
      tip = 'Suerte al tope (300 pct de MF base).\nLuck total: ' + fmtLuck(lc.value);
      if (lc.overflow > 0) {
        tip += '\nExceso sobre el tope: ' + fmtLuck(lc.overflow) + ' (ya no otorga MF)';
      }
    } else {
      tip = 'Suerte: ' + fmtLuck(lc.value) + '\n' +
            'Faltan ' + fmtLuck(lc.missing) + ' para el siguiente +1 pct\n' +
            'Progreso al umbral: ' + pct + ' pct';
    }
    tip = tip.replace(/\n/g, ' &#10; ');

    var bar = '<span style="display:block;width:56px;height:4px;margin:3px 0 0 auto;border-radius:2px;background:rgba(255,255,255,0.10);overflow:hidden;">' +
      '<span style="display:block;width:' + pct + '%;height:100%;background:' + barColor + ';"></span></span>';

    return '<td class="right" title="' + esc(tip) + '">' +
      '<span style="color:' + barColor + ';font-weight:600;">' + lc.mf + '%</span>' +
      bar +
      '</td>';
  }

  // ------------------------------ Persistencia ------------------------------
  function loadSelectedCurrencies() {
    try {
      var stored = Storage.get(STORAGE_KEY);
      if (stored) {
        if (Array.isArray(stored) && stored.length) {
          state.selectedCurrencies = stored;
          return;
        }
      }
    } catch(e) { console.warn(LOG, 'Error loading selected currencies', e); }
    state.selectedCurrencies = [];
  }

  function saveSelectedCurrencies() {
    try {
      Storage.set(STORAGE_KEY, state.selectedCurrencies);
    } catch(e) { console.warn(LOG, 'Error saving selected currencies', e); }
  }

  function loadSortPreference() {
    try {
      var stored = Storage.get(SORT_STORAGE_KEY);
      if (stored) {
        state.sortColumn = stored.column;
        state.sortDirection = stored.direction;
      }
    } catch(e) { console.warn(LOG, 'Error loading sort preference', e); }
  }

  function saveSortPreference() {
    try {
      Storage.set(SORT_STORAGE_KEY, {
        column: state.sortColumn,
        direction: state.sortDirection
      });
    } catch(e) { console.warn(LOG, 'Error saving sort preference', e); }
  }

  // ------------------------------ Funciones auxiliares ------------------------------
  async function loadCurrencies() {
    if (state.currencies.length) return state.currencies;
    try {
      var currencies = await root.GW2Api.getCurrenciesAll({ nocache: false });
      if (Array.isArray(currencies)) {
        state.currencies = currencies;
        if (!state.selectedCurrencies.length) {
          var ids = [];
          DEFAULT_CURRENCY_NAMES.forEach(function(name) {
            var found = currencies.find(function(c) {
              return c.name && c.name.toLowerCase().includes(name.toLowerCase());
            });
            if (found) ids.push(found.id);
          });
          state.selectedCurrencies = ids;
          saveSelectedCurrencies();
        }
        return currencies;
      }
    } catch(e) {
      console.warn(LOG, 'Error loading currencies', e);
    }
    return [];
  }

  function loadKeys() {
    try {
      var AK = (typeof Storage !== 'undefined' && Storage.STORAGE_KEYS) ? Storage.STORAGE_KEYS.ACCOUNT_KEYS : 'gn:account:keys';
      var list = Storage.get(AK) || [];
      return Array.isArray(list) ? list : [];
    } catch(_) { return []; }
  }

  async function loadAccountSummary(token, forceNoCache) {
    var nocache = !!forceNoCache;

    // Las 4 promesas se crean siempre. La tabla ya no tiene columnas de
    // resumen, pero 'luck' alimenta el KPI "Mejor MF base", que se dibuja
    // siempre y no depende de ningun selector (ya no existe uno).
    var charP = root.GW2Api.getCharacterCount(token, { nocache: nocache });
    var apP = root.GW2Api.getAccountInfo(token, { nocache: nocache });
    var raidsP = root.GW2Api.getAccountRaids(token, { nocache: nocache });
    var luckP = root.GW2Api.getAccountLuck(token, { nocache: nocache });

    // Las 4 se lanzan juntas y cada handler llega recién en su await: sin el .catch no-op, un
    // rechazo durante el await de charP dispara «unhandledrejection». El no-op no cambia el valor:
    // el await sigue viendo el rechazo y el catch de su columna escribe _errors.
    if (apP) apP.catch(function () {});
    if (raidsP) raidsP.catch(function () {});
    if (luckP) luckP.catch(function () {});

    var summary = { _errors: {} };
    if (charP) {
      try { summary.characters = await charP; }
      catch(e) { summary.characters = 0; summary._errors.characters = unreadableReason(e, 'characters'); }
    }
    if (apP) {
      try {
        var info = await apP;
        summary.ap = (info && typeof info.achievements === 'number') ? info.achievements : 0;
      } catch(e) { summary.ap = 0; summary._errors.achievements = unreadableReason(e, 'achievements'); }
    }
    if (raidsP) {
      try {
        var raidsArr = await raidsP;
        summary.raids = Array.isArray(raidsArr) ? raidsArr.length : 0;
      } catch(e) { summary.raids = 0; summary._errors.raids = unreadableReason(e, 'raids'); }
    }
    if (luckP) {
      // 'luck' se guarda como numero (MF%) para que sortAccounts ordene bien.
      try {
        var luckRaw = await luckP;
        var lk = luckToProgress(luckRaw);
        summary.luck = lk.mf;
        summary.luckTotal = lk.value;
        summary.luckMissing = lk.missing;
        summary.luckPct = lk.pct;
        summary.luckCapped = lk.capped;
        summary.luckOverflow = lk.overflow;
      } catch(e) {
        summary.luck = 0;
        summary.luckTotal = 0;
        summary.luckMissing = 0;
        summary.luckPct = 0;
        summary.luckCapped = false;
        summary.luckOverflow = 0;
        summary._errors.luck = unreadableReason(e, 'luck');
      }
    }
    if (!Object.keys(summary._errors).length) delete summary._errors;
    return summary;
  }

  async function loadWalletForAccount(token, forceNoCache, label) {
    try {
      var wallet = await root.GW2Api.getAccountWallet(token, { nocache: !!forceNoCache });
      var map = {};
      if (Array.isArray(wallet)) {
        wallet.forEach(function(entry) {
          map[entry.id] = entry.value;
        });
      }
      var summary = await loadAccountSummary(token, forceNoCache);
      return { wallet: map, error: null, summary: summary, errorInfo: null };
    } catch(e) {
      console.warn(LOG, 'Error loading wallet for token', e);
      // El fallback sigue siendo {} (no romper el render), pero el error deja de
      // ser invisible: se nombra la cuenta y el endpoint que falló.
      var info = describeError(e, '/v2/account/wallet');
      info.label = label || ('Key ' + fpToken(token));
      return { wallet: {}, error: e.message || 'Error al cargar wallet', summary: null, errorInfo: info };
    }
  }

  async function loadAllWallets(forceNoCache) {
    state.keys = loadKeys();
    if (!state.keys.length) {
      state.accounts = [];
      return;
    }

    var out = [];
    var idx = 0, ACTIVE = 0, MAX = 3;

    progressReset(state.keys.length);

    await new Promise(function(resolve) {
      function next() {
        if (idx >= state.keys.length && ACTIVE === 0) return resolve();
        while (ACTIVE < MAX && idx < state.keys.length) {
          var it = state.keys[idx++];
          ACTIVE++;
          (function(k) {
            var token = k.value;
            var label = k.label || ('Key ' + fpToken(token));
            var fp = fpToken(token);
            progressStart(label);
            loadWalletForAccount(token, forceNoCache, label)
              .then(function(result) {
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  wallet: result.wallet || {},
                  error: result.error || null,
                  summary: result.summary || null
                });
                progressEnd(label, result.errorInfo);
              })
              .catch(function(e) {
                console.warn(LOG, 'Error loading wallet for', label, e);
                out.push({
                  token: token,
                  fp: fp,
                  label: label,
                  wallet: {},
                  error: e.message || 'Error al cargar wallet',
                  summary: null
                });
                var info = describeError(e, '/v2/account/wallet');
                info.label = label;
                progressEnd(label, info);
              })
              .finally(function() { ACTIVE--; next(); });
          })(it);
        }
      }
      next();
    });

    state.accounts = out;
    state.lastRefreshTime = new Date();
    console.log(LOG, 'Cargadas', out.length, 'cuentas',
      '(' + _progress.errors.length + ' con error)');
  }

  // ------------------------------ Ordenamiento ------------------------------
  function sortAccounts(accounts, column, direction) {
    return accounts.slice().sort(function(a, b) {
      var valA, valB;
      if (column && typeof column === 'string' && column.indexOf('summary:') === 0) {
        var field = column.replace('summary:', '');
        var prop = field === 'achievements' ? 'ap' : field;
        var sumA = a.summary || {}, sumB = b.summary || {};
        valA = sumA[prop] || 0;
        valB = sumB[prop] || 0;
      } else {
        valA = a.wallet[column] || 0;
        valB = b.wallet[column] || 0;
      }
      if (direction === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });
  }

  function setSortColumn(currencyId) {
    if (state.sortColumn === currencyId) {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortColumn = currencyId;
      state.sortDirection = 'desc';
    }
    saveSortPreference();
    renderTable();
  }

  // ------------------------------ Renderizado ------------------------------
  function getCurrencyIconHtml(currency) {
    if (currency && currency.icon) {
      return '<img class="wd3-cic" src="' + esc(currency.icon) + '" width="18" height="18" alt="" loading="lazy">';
    }
    return '';
  }

  // ------------------------------ Reglas puras (v3.0.0) ------------------------------
  // Mejor valor de cada columna entre las cuentas que SÍ se leyeron. Un 0 no es «el mejor»:
  // si nadie tiene nada, la columna no marca a ninguna.
  function bestByCurrency(accounts, ids) {
    var best = {};
    ids.forEach(function (id) {
      var max = 0;
      accounts.forEach(function (acc) {
        if (acc.error) return;
        var v = Number(acc.wallet && acc.wallet[id]) || 0;
        if (v > max) max = v;
      });
      if (max > 0) best[id] = max;
    });
    return best;
  }
  // Divisas que se pueden agregar como columna: las no elegidas, filtradas por nombre
  // (sin distinguir mayúsculas ni tildes), en orden alfabético.
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function pickerOptions(currencies, selected, query) {
    var sel = new Set(selected), q = fold(query).trim();
    return currencies
      .filter(function (c) { return c && !sel.has(c.id) && (!q || fold(c.name).indexOf(q) >= 0); })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'es'); });
  }
  // «Total» o «Total (26 de 27)» si alguna cuenta no se pudo leer.
  function totalLabel(accounts) {
    var bad = accounts.filter(function (a) { return a.error; }).length;
    return bad ? 'Total (' + (accounts.length - bad) + ' de ' + accounts.length + ')' : 'Total';
  }
  function initialsOf(label) {
    var w = String(label || '?').replace(/\.\d+$/, '').split(/[\s._-]+/).filter(Boolean);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  }

  var _picker = { open: false, query: '' };

  function renderCurrencySelector() {
    var container = $('#wdCurrencySelector');
    if (!container) {
      console.warn(LOG, 'Selector container no encontrado');
      return;
    }

    if (!state.currencies.length) {
      container.innerHTML = '<span class="wd3-muted">Cargando divisas…</span>';
      return;
    }

    var byId = {};
    state.currencies.forEach(function (c) { byId[c.id] = c; });
    var chips = state.selectedCurrencies.filter(function (id) { return byId[id]; }).map(function (id) {
      var c = byId[id], name = esc(c.name || 'Divisa #' + id);
      return '<span class="wd3-pk">' + getCurrencyIconHtml(c) + name +
        '<button type="button" data-wd-remove="' + id + '" aria-label="Quitar ' + name + '" title="Quitar ' + name + '">×</button></span>';
    }).join('');

    var html = '<div class="wd3-picker" role="group" aria-label="Columnas de la tabla"><span class="wd3-lbl">Columnas:</span>' + chips +
      '<button type="button" class="wd3-pk wd3-add" data-wd-add="1" aria-expanded="' + _picker.open + '" aria-controls="wdPickerPop">＋ Agregar divisa…</button></div>';
    if (_picker.open) {
      var opts = pickerOptions(state.currencies, state.selectedCurrencies, _picker.query);
      html += '<div class="wd3-pop" id="wdPickerPop">' +
        '<input type="search" id="wdPickerSearch" placeholder="Buscar divisa…" aria-label="Buscar divisa" autocomplete="off" value="' + esc(_picker.query) + '">' +
        '<div class="wd3-opts" role="listbox" aria-label="Divisas para agregar">' +
        (opts.length ? opts.map(function (c) {
          return '<button type="button" role="option" data-wd-pick="' + c.id + '">' + getCurrencyIconHtml(c) + esc(c.name || 'Divisa #' + c.id) + '</button>';
        }).join('') : '<p class="wd3-muted">No hay divisas con ese nombre.</p>') +
        '</div></div>';
    }
    container.innerHTML = html;

    if (!container.__wd3) {
      container.__wd3 = true;
      container.addEventListener('click', function (e) {
        var t = e.target, b;
        if (!t || !t.closest) return;
        if ((b = t.closest('[data-wd-remove]'))) {
          var rid = parseInt(b.getAttribute('data-wd-remove'), 10);
          state.selectedCurrencies = state.selectedCurrencies.filter(function (cid) { return cid !== rid; });
          saveSelectedCurrencies(); renderCurrencySelector(); renderTable();
          return;
        }
        if ((b = t.closest('[data-wd-pick]'))) {
          var pid = parseInt(b.getAttribute('data-wd-pick'), 10);
          if (state.selectedCurrencies.indexOf(pid) < 0) state.selectedCurrencies.push(pid);
          _picker.open = false; _picker.query = '';
          saveSelectedCurrencies(); renderCurrencySelector(); renderTable();
          return;
        }
        if (t.closest('[data-wd-add]')) {
          _picker.open = !_picker.open; _picker.query = '';
          renderCurrencySelector();
          var s = document.getElementById('wdPickerSearch'); if (s && s.focus) s.focus();
        }
      });
      container.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'wdPickerSearch') return;
        _picker.query = e.target.value || '';
        var list = container.querySelector('.wd3-opts');
        var opts = pickerOptions(state.currencies, state.selectedCurrencies, _picker.query);
        if (list) list.innerHTML = opts.length ? opts.map(function (c) {
          return '<button type="button" role="option" data-wd-pick="' + c.id + '">' + getCurrencyIconHtml(c) + esc(c.name || 'Divisa #' + c.id) + '</button>';
        }).join('') : '<p class="wd3-muted">No hay divisas con ese nombre.</p>';
      });
      container.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && _picker.open) {
          _picker.open = false; _picker.query = ''; renderCurrencySelector();
          var a = container.querySelector('[data-wd-add]'); if (a && a.focus) a.focus();
        }
      });
      // Un solo oyente para cerrar al tocar afuera (antes se sumaba uno por cada dibujo).
      document.addEventListener('click', function (e) {
        if (_picker.open && e.target && !container.contains(e.target)) { _picker.open = false; _picker.query = ''; renderCurrencySelector(); }
      });
    }
  }

  function renderKPIs(totals, accounts) {
    var container = $('#wdKPIs');
    if (!container) return;

    var kpis = [];
    var karmaIcon = 'https://render.guildwars2.com/file/94953FA23D3E0D23559624015DFEA4CFAA07F0E5/155026.png';
    var aaIcon = 'https://render.guildwars2.com/file/1856A01E331452E4C14E4C9CF4F818E3FAEF9B79/3124964.png';
    var goldId = (state.currencies.find(function(c) { return c.name === 'Moneda' || c.id === 1; }) || {}).id;
    var karmaId = (state.currencies.find(function(c) { return c.name === 'Karma' || c.id === 2; }) || {}).id;
    var laurelId = (state.currencies.find(function(c) { return c.name === 'Laurel' || c.id === 3; }) || {}).id;
    var aaId = (state.currencies.find(function(c) { return (c.name && c.name.toLowerCase().indexOf('reconocimiento astral') >= 0) || c.id === 63; }) || {}).id;
    var read = (accounts || []).filter(function (a) { return !a.error; });
    var n = (accounts || []).length;

    function kpi(cls, icon, label, value, sub) {
      return '<div class="wd3-kpi ' + cls + '"><div class="wd3-kl">' + (icon ? '<img src="' + icon + '" width="20" height="20" alt="">' : '') + label + '</div>' +
        '<div class="wd3-kv">' + value + '</div>' + (sub ? '<div class="wd3-ks">' + sub + '</div>' : '') + '</div>';
    }
    if (goldId && totals[goldId] !== undefined) {
      var richest = read.reduce(function (m, a) { return (a.wallet[goldId] || 0) > (m ? (m.wallet[goldId] || 0) : 0) ? a : m; }, null);
      kpis.push(kpi('wd3-kpi--gold', 'assets/icons/619316.png', 'Oro de ' + (n === 1 ? 'la cuenta' : 'las ' + n + ' cuentas'),
        formatCoinValue(totals[goldId]), richest ? 'La que más tiene: ' + esc(richest.label) : ''));
    }
    if (karmaId && totals[karmaId] !== undefined) kpis.push(kpi('', karmaIcon, 'Karma', fmtInt(totals[karmaId])));
    if (laurelId && totals[laurelId] !== undefined) kpis.push(kpi('', 'assets/icons/619317.png', 'Laureles', fmtInt(totals[laurelId])));
    if (aaId && totals[aaId] !== undefined) kpis.push(kpi('', aaIcon, 'Reconocimiento astral', fmtInt(totals[aaId])));

    // KPI de MF base: se dibuja SIEMPRE. El MF% es por cuenta (curva independiente), asi que
    // no se suma: la mejor cuenta y cuantas llegaron al tope. (v3: sin el borderLeft escrito
    // dentro de un string de CSS, que el navegador ignoraba.)
    if (accounts && accounts.length) {
      var luckBest = 0, luckCapped = 0;
      accounts.forEach(function(acc) {
        var s = acc.summary || {};
        if (typeof s.luck === 'number') {
          if (s.luck > luckBest) luckBest = s.luck;
          if (s.luckCapped) luckCapped++;
        }
      });
      kpis.push(kpi('wd3-kpi--luck', '', '<span aria-hidden="true">' + SUMMARY_FIELD_SYMBOLS.luck + '</span> Suerte (MF base)', luckBest + ' %',
        'La mejor cuenta · ' + luckCapped + ' de ' + accounts.length + ' al tope'));
    }

    container.innerHTML = kpis.join('');
  }

  function formatValueForDisplay(currencyId, value) {
    if (value < 0) {
      return '<span class="wd3-neg">' + (currencyId === 1 ? formatCoinValue(Math.abs(value)) : fmtInt(Math.abs(value))) + '</span>';
    }
    if (currencyId === 1) {
      return formatCoinValue(value);
    }
    return '<span class="wd3-num">' + fmtInt(value) + '</span>';
  }

  function renderTable() {
    // Intentar encontrar la tabla, si no existe, esperar un poco y reintentar
    var table = $('#wdTable');
    if (!table) {
      console.warn(LOG, 'Tabla #wdTable no encontrada, reintentando en 100ms...');
      setTimeout(function() {
        renderTable();
      }, 100);
      return;
    }

    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    var cardsBox = document.getElementById('wdCards');
    if (!thead || !tbody) {
      console.error(LOG, 'thead o tbody no encontrados');
      return;
    }

    // Verificar que tenemos datos
    if (!state.currencies.length) {
      console.log(LOG, 'Esperando divisas...');
      return;
    }

    var selectedCurrencies = state.selectedCurrencies.map(function (id) {
      return state.currencies.find(function (c) { return c.id === id; });
    }).filter(Boolean);

    if (!selectedCurrencies.length) {
      // v3: antes este HTML estaba mal armado (<td> abriendo la fila y un «2» suelto).
      thead.innerHTML = '<tr><th class="wd3-acc">Cuenta</th></tr>';
      tbody.innerHTML = '<tr><td class="wd3-empty">No elegiste ninguna divisa. Usá «＋ Agregar divisa…» para sumar columnas.</td></tr>';
      if (cardsBox) cardsBox.innerHTML = '';
      return;
    }

    console.log(LOG, 'Renderizando tabla con', selectedCurrencies.length, 'divisas y', state.accounts.length, 'cuentas');

    // Cabecera con ordenamiento
    var hcells = ['<th class="wd-account-header wd3-acc" scope="col">Cuenta</th>'];
    hcells.push('<th class="right" scope="col">Suerte (MF)</th>');
    selectedCurrencies.forEach(function(cur) {
      var iconHtml = getCurrencyIconHtml(cur);
      var on = state.sortColumn === cur.id;
      var sortIndicator = on ? (state.sortDirection === 'desc' ? ' ▾' : ' ▴') : '';
      hcells.push('<th class="right sortable" scope="col" tabindex="0" data-currency-id="' + cur.id + '" title="Ordenar por ' + esc(cur.name) + '"' +
        (on ? ' aria-sort="' + (state.sortDirection === 'desc' ? 'descending' : 'ascending') + '"' : '') + '>' +
        iconHtml + '<span>' + esc(cur.name || 'Divisa #' + cur.id) + sortIndicator + '</span></th>');
    });
    thead.innerHTML = '<tr>' + hcells.join('') + '</tr>';

    // Aplicar ordenamiento
    var rowsAcc = state.accounts.slice();
    if (state.sortColumn !== null) {
      rowsAcc = sortAccounts(rowsAcc, state.sortColumn, state.sortDirection);
    }

    // Calcular totales (las cuentas que no se pudieron leer no suman: su cartera es {})
    var totals = {};
    selectedCurrencies.forEach(function(cur) { totals[cur.id] = 0; });
    rowsAcc.forEach(function(acc) {
      selectedCurrencies.forEach(function(cur) {
        totals[cur.id] += acc.wallet[cur.id] || 0;
      });
    });
    var ids = selectedCurrencies.map(function (c) { return c.id; });
    var best = bestByCurrency(rowsAcc, ids);

    // Renderizar KPIs
    renderKPIs(totals, state.accounts);

    function accountCell(acc) {
      var keyItem = state.keys.find(function(k) { return k.value === acc.token; });
      var tag = keyItem ? keyItem.tag : null;
      var icon = tag && ACCOUNT_TYPE_ICONS[tag] ? ACCOUNT_TYPE_ICONS[tag] : '';
      var av = icon ? '<img class="wd3-av" src="' + icon + '" width="28" height="28" alt="" loading="lazy">'
        : '<span class="wd3-av" aria-hidden="true">' + esc(initialsOf(acc.label)) + '</span>';
      var errorIndicator = acc.error ? ' <span class="wd3-warn" title="' + esc(acc.error) + '">⚠<span class="wd3-sr"> No se pudo leer</span></span>' : '';
      return '<div class="wd3-acct">' + av + '<span>' + esc(acc.label) + '</span>' + errorIndicator + '</div>';
    }
    function walletReason(acc) { return 'No se pudo leer /v2/account/wallet — ' + (acc.error || 'error desconocido'); }

    var bodyRows = rowsAcc.map(function(acc) {
      var cells = ['<th scope="row" class="wd3-acc">' + accountCell(acc) + '</th>'];
      var s = acc.summary || {};
      var fieldErr = (s._errors && s._errors.luck) || null;
      cells.push(fieldErr ? unreadableCell(fieldErr) : renderLuckCell(s));
      selectedCurrencies.forEach(function(cur) {
        // v3: una cuenta que no se pudo leer no muestra 0 (sería un dato falso): «— ⚠».
        if (acc.error) { cells.push(unreadableCell(walletReason(acc))); return; }
        var value = acc.wallet[cur.id] || 0;
        var isBest = best[cur.id] !== undefined && value === best[cur.id];
        cells.push('<td class="right' + (isBest ? ' wd3-best' : '') + '" title="' + esc(cur.name) + ': ' + (cur.id === 1 ? value + ' cobre' : fmtInt(value)) +
          (isBest ? ' · la que más tiene' : '') + '">' + formatValueForDisplay(cur.id, value) + '</td>');
      });
      return '<tr' + (acc.error ? ' class="wd3-row-err"' : '') + '>' + cells.join('') + '</tr>';
    }).join('');

    // Fila de totales (fija abajo al desplazar)
    var walletUnreadable = rowsAcc.filter(function (acc) { return acc.error; }).length;
    var curTitle = walletUnreadable > 0
      ? 'Parcial: ' + walletUnreadable + ' de ' + rowsAcc.length + ' cuentas no se pudieron leer.'
      : '';
    var totalCells = ['<th scope="row" class="total-label wd3-acc"' + (curTitle ? ' title="' + esc(curTitle) + '"' : '') + '>' + totalLabel(rowsAcc) + '</th>'];
    totalCells.push('<td class="right total-cell"></td>');
    selectedCurrencies.forEach(function(cur) {
      totalCells.push('<td class="right total-cell"' + (curTitle ? ' title="' + esc(curTitle) + '"' : '') + '>' + formatValueForDisplay(cur.id, totals[cur.id]) + '</td>');
    });
    var totalRow = '<tr class="total-row wd3-tot">' + totalCells.join('') + '</tr>';

    tbody.innerHTML = bodyRows + totalRow;

    // En el celular, cada cuenta es una tarjeta (mismos datos, mismo orden).
    if (cardsBox) {
      cardsBox.innerHTML = rowsAcc.map(function (acc) {
        var rows = selectedCurrencies.map(function (cur) {
          var v = acc.error ? '— ⚠' : formatValueForDisplay(cur.id, acc.wallet[cur.id] || 0);
          var isBest = !acc.error && best[cur.id] !== undefined && (acc.wallet[cur.id] || 0) === best[cur.id];
          return '<div class="wd3-crow"><span>' + esc(cur.name) + '</span><b' + (isBest ? ' class="wd3-best"' : '') + '>' + v + '</b></div>';
        }).join('');
        return '<div class="wd3-card' + (acc.error ? ' wd3-row-err' : '') + '">' + accountCell(acc) + rows + '</div>';
      }).join('') +
      '<div class="wd3-card wd3-tot"><div class="wd3-acct"><span>' + totalLabel(rowsAcc) + '</span></div>' +
        selectedCurrencies.map(function (cur) { return '<div class="wd3-crow"><span>' + esc(cur.name) + '</span><b>' + formatValueForDisplay(cur.id, totals[cur.id]) + '</b></div>'; }).join('') +
      '</div>';
    }
    console.log(LOG, 'Tabla renderizada con', rowsAcc.length, 'filas');

    // Agregar eventos de ordenamiento (divisas): clic o Enter.
    var sortableHeaders = thead.querySelectorAll('th.sortable');
    sortableHeaders.forEach(function(th) {
      var currencyId = parseInt(th.getAttribute('data-currency-id'), 10);
      th.addEventListener('click', function() { setSortColumn(currencyId); });
      th.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSortColumn(currencyId); } });
    });

  }

  function updateTimestamp() {
    var tsEl = $('#wdTimestamp');
    if (tsEl && state.lastRefreshTime) {
      tsEl.textContent = 'Última actualización: ' + formatTimestamp(state.lastRefreshTime);
    } else if (tsEl) {
      tsEl.textContent = '';
    }
  }

  function setStatus(msg, kind) {
    var msgEl = $('#wdStatusMsg');
    if (!msgEl) return;
    msgEl.textContent = String(msg || '');
    msgEl.classList.remove('error');
    if (kind === 'error') msgEl.classList.add('error');
  }

  function showSkeleton() {
    var kpisContainer = $('#wdKPIs');
    if (kpisContainer && !kpisContainer.__originalContent) {
      kpisContainer.__originalContent = kpisContainer.innerHTML;
    }

    if (kpisContainer) {
      kpisContainer.innerHTML = '<div class="wd-skeleton" style="height:80px; width:100%; border-radius:12px;"></div>';
    }

    var tableWrap = document.querySelector('#walletDashboardPanel .wd-tablewrap');
    if (!tableWrap) return;

    var originalTable = tableWrap.querySelector('#wdTable');
    if (originalTable && !tableWrap.__originalTable) {
      tableWrap.__originalTable = originalTable.cloneNode(true);
    }

    tableWrap.innerHTML = '<div class="wd-skeleton-table wd-skeleton"></div>';
  }

  function hideSkeletonAndRestoreTable() {
    var kpisContainer = $('#wdKPIs');
    if (kpisContainer && kpisContainer.__originalContent) {
      kpisContainer.innerHTML = kpisContainer.__originalContent;
      delete kpisContainer.__originalContent;
    }

    var tableWrap = document.querySelector('#walletDashboardPanel .wd-tablewrap');
    if (!tableWrap) return;

    if (tableWrap.__originalTable) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(tableWrap.__originalTable);
      delete tableWrap.__originalTable;
    }
  }

  async function refreshData(forceNoCache) {
    if (_refreshInFlight) return _refreshInFlight;
    try {
      _refreshInFlight = (async () => {
        showSkeleton();
        renderProgressErrors();
        setStatus('Cargando divisas...');
        await loadCurrencies();

        setStatus('Cargando carteras...');
        await loadAllWallets(!!forceNoCache);

        setStatus('Renderizando...');
        renderCurrencySelector();
        renderTable();
        renderProgressErrors();
        updateTimestamp();
        if (_progress.errors.length) {
          setStatus('Listo con ' + _progress.errors.length + ' de ' + _progress.total + ' cuentas con error.', 'error');
        } else {
          setStatus('Listo.');
        }

        hideSkeletonAndRestoreTable();
      })();
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  function goBackToWallet() {
    console.log(LOG, 'Volviendo a Cartera...');
    location.hash = '#/cards';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  var CSS3 = [
    '#walletDashboardPanel .wd3-body{padding:18px 20px 22px}',
    '.wd3-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:16px}',
    '.wd3-kpi{background:var(--bg-0);border:1px solid var(--bd-1);border-radius:14px;padding:12px 14px;min-width:0}',
    '.wd3-kpi--gold{box-shadow:inset 0 0 0 1px rgba(242,185,75,.35)}',
    '.wd3-kl{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--tx-3)}',
    '.wd3-kv{font-size:1.35rem;font-weight:800;color:var(--tx-1);margin-top:4px;white-space:nowrap}.wd3-ks{font-size:.75rem;color:var(--tx-3);margin-top:2px}',
    '.wd3-coin{font-variant-numeric:tabular-nums;white-space:nowrap}.wd3-coin small{color:var(--tx-3);font-weight:500;margin:0 3px 0 1px;font-size:.78em}',
    '.wd3-g{color:var(--gn-gold,#F2B94B)}.wd3-s{color:var(--tx-1)}.wd3-c{color:#c98a5a}.wd3-num{font-variant-numeric:tabular-nums}.wd3-neg{color:var(--color-red)}',
    '.wd3-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;margin-bottom:10px}',
    '.wd3-picker{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.wd3-lbl{color:var(--tx-3);font-size:.8rem;margin-right:2px}',
    '.wd3-pk{display:inline-flex;align-items:center;gap:6px;background:var(--bg-0);border:1px solid var(--bd-2);border-radius:999px;padding:4px 6px 4px 9px;font:inherit;font-size:.8rem;color:var(--tx-1)}',
    '.wd3-pk button{background:none;border:0;color:var(--tx-3);cursor:pointer;font-size:1rem;line-height:1;padding:0 4px;border-radius:999px}.wd3-pk button:hover{color:var(--tx-1);background:var(--bg-2)}',
    '.wd3-add{border-style:dashed;color:var(--tx-3);padding:4px 11px;cursor:pointer}.wd3-add:hover{color:var(--tx-1);border-color:var(--acc-1)}',
    '.wd3-cic{width:18px;height:18px;object-fit:contain;flex-shrink:0;vertical-align:middle}',
    '#wdCurrencySelector{position:relative;flex:1 1 320px}',
    '.wd3-pop{position:absolute;z-index:20;top:calc(100% + 6px);left:0;width:min(340px,92vw);background:var(--bg-1);border:1px solid var(--bd-2);border-radius:12px;padding:8px;box-shadow:0 12px 30px rgba(0,0,0,.35)}',
    '.wd3-pop input{width:100%;box-sizing:border-box;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:8px;color:var(--tx-1);font:inherit;padding:7px 10px;margin-bottom:6px}',
    '.wd3-opts{max-height:260px;overflow:auto;display:grid;gap:2px}.wd3-opts button{display:flex;align-items:center;gap:8px;background:none;border:0;border-radius:8px;color:var(--tx-1);font:inherit;font-size:.85rem;text-align:left;padding:6px 8px;cursor:pointer}.wd3-opts button:hover{background:var(--bg-2)}',
    '.wd3-tools{display:flex;gap:8px;margin-left:auto}',
    '.wd3-btn{display:inline-flex;align-items:center;gap:6px;background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:10px;padding:6px 12px;font:inherit;font-size:.82rem;cursor:pointer}.wd3-btn:hover{border-color:var(--acc-1);color:var(--tx-1)}',
    '.wd3-status{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:.8rem;color:var(--tx-3);margin-bottom:8px}.wd3-status .error{color:var(--color-red)}',
    '.wd3-errs{border:1px solid var(--bd-2);border-left:3px solid var(--gn-gold,#F2B94B);background:var(--bg-0);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.82rem}',
    '.wd3-errs p{margin:4px 0;color:var(--tx-3)}.wd3-errs ul{margin:4px 0 0;padding-left:18px;color:var(--tx-3)}',
    '#walletDashboardPanel .wd-tablewrap{overflow:auto;max-height:70vh;border:1px solid var(--bd-1);border-radius:12px;margin-top:0}',
    '#wdTable{width:100%;border-collapse:separate;border-spacing:0;font-size:.88rem}',
    '#wdTable th,#wdTable td{padding:9px 12px;border-bottom:1px solid var(--bd-1);white-space:nowrap;text-align:left;background:var(--bg-1)}',
    '#wdTable .right{text-align:right}',
    '#wdTable thead th{position:sticky;top:0;z-index:2;background:var(--bg-2,var(--bg-1));color:var(--tx-3);font-size:.74rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}',
    '#wdTable thead th.sortable{cursor:pointer}#wdTable thead th.sortable:hover,#wdTable thead th[aria-sort]{color:var(--tx-1)}',
    '#wdTable .wd3-acc{position:sticky;left:0;z-index:1;font-weight:600;color:var(--tx-1)}#wdTable thead .wd3-acc{z-index:3}',
    '#wdTable tr.wd3-tot>*{position:sticky;bottom:0;z-index:1;background:var(--bg-2,var(--bg-1));font-weight:800;border-top:1px solid var(--bd-2)}#wdTable tr.wd3-tot>.wd3-acc{z-index:3}',
    '#wdTable tbody tr:hover>*{background:var(--bg-0)}',
    '.wd3-best{color:var(--gn-gold,#F2B94B)}.wd3-best .wd3-s,.wd3-best .wd3-num{color:inherit}.wd3-best::after{content:" ▲";font-size:.65rem}',
    '.wd3-acct{display:flex;align-items:center;gap:10px}',
    '.wd3-av{width:28px;height:28px;border-radius:8px;flex-shrink:0;display:inline-grid;place-items:center;background:var(--bg-2,var(--bg-0));color:var(--tx-2);font-size:.72rem;font-weight:700;object-fit:cover}',
    '.wd3-warn{color:var(--color-red);cursor:help}.wd3-row-err td{color:var(--color-red)}',
    '#wdTable td.wd3-empty{text-align:center;color:var(--tx-3);padding:24px;white-space:normal}.wd3-muted{color:var(--tx-3);font-size:.82rem}',
    '.wd3-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.wd3-cards{display:none}',
    '.wd3-card{background:var(--bg-0);border:1px solid var(--bd-1);border-radius:12px;padding:10px 12px}.wd3-card .wd3-acct{font-weight:700;margin-bottom:6px}',
    '.wd3-crow{display:flex;justify-content:space-between;gap:10px;font-size:.85rem;padding:2px 0}.wd3-crow span{color:var(--tx-3)}',
    '.wd3-card.wd3-tot{background:var(--bg-2,var(--bg-1));border-color:var(--bd-2)}',
    '#walletDashboardPanel button:focus-visible,#walletDashboardPanel input:focus-visible,#wdTable th[tabindex]:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:720px){#walletDashboardPanel .wd3-body{padding:14px 12px}#walletDashboardPanel .wd-tablewrap{display:none}.wd3-cards{display:grid;gap:8px}.wd3-tools{margin-left:0}}'
  ].join('\n');

  function injectCSS3() {
    if (document.getElementById('wd3-style')) return;
    var s = document.createElement('style'); s.id = 'wd3-style'; s.textContent = CSS3;
    (document.head || document.documentElement).appendChild(s);
  }

  // ------------------------------ UI del Panel (creación síncrona) ------------------------------
  function ensurePanelContent() {
    var panel = document.getElementById('walletDashboardPanel');
    if (!panel) {
      console.error(LOG, 'Panel walletDashboardPanel no encontrado en el DOM');
      return null;
    }
    injectCSS3();

    // Si ya tiene contenido, no lo recreamos
    if (panel.querySelector('.wd-content')) {
      return panel;
    }

    panel.innerHTML = '';
    var contentDiv = document.createElement('div');
    contentDiv.className = 'wd-content';
    contentDiv.innerHTML =
      '<div class="panel__head"><h2 class="panel__title">Todas las cuentas</h2></div>' +
      '<div class="panel__body wd3-body">' +
        '<div id="wdLoadErrors"></div>' +
        '<div id="wdKPIs" class="wd3-kpis"></div>' +
        '<div class="wd-filters wd3-bar">' +
          '<div id="wdCurrencySelector"></div>' +
          '<div class="wd3-tools">' +
            '<button type="button" id="wdRefreshBtn" class="wd3-btn"><img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="">Actualizar</button>' +
            '<button type="button" id="wdBackBtn" class="wd3-btn"><img src="assets/icons/733322.png" width="14" height="14" alt="">Volver a Cartera</button>' +
          '</div>' +
        '</div>' +
        '<div class="wd-status-bar wd3-status">' +
          '<span id="wdStatusMsg" class="wd-status-msg" aria-live="polite">—</span>' +
          '<span id="wdTimestamp" class="wd-timestamp"></span>' +
        '</div>' +
        '<div class="wd-tablewrap">' +
          '<table id="wdTable" class="wd-table">' +
            '<caption class="wd3-sr">Divisas por cuenta</caption>' +
            '<thead></thead>' +
            '<tbody></tbody>' +
          '</table>' +
        '</div>' +
        '<div id="wdCards" class="wd3-cards" aria-label="Divisas por cuenta"></div>' +
      '</div>';

    panel.appendChild(contentDiv);
    return panel;
  }

  // ------------------------------ API pública ------------------------------
  var WalletDashboard = {
    async initOnce() {
      if (state.inited) return;

      console.log(LOG, 'initOnce() llamado');

      // Crear contenido del panel de forma síncrona
      ensurePanelContent();

      // Cargar preferencias
      loadSortPreference();
      loadSelectedCurrencies();

      // Conectar eventos de botones (los botones ya existen después de ensurePanelContent)
      var refreshBtn = document.getElementById('wdRefreshBtn');
      if (refreshBtn && !refreshBtn.__wired) {
        refreshBtn.__wired = true;
        refreshBtn.addEventListener('click', function() { refreshData(true); });
        console.log(LOG, 'Evento de refresh conectado');
      }

      var backBtn = document.getElementById('wdBackBtn');
      if (backBtn && !backBtn.__wired) {
        backBtn.__wired = true;
        backBtn.addEventListener('click', function() { goBackToWallet(); });
        console.log(LOG, 'Evento de back conectado');
      }

      state.inited = true;
      console.log(LOG, 'initOnce() completado');
    },

    async activate() {
      console.log(LOG, 'activate() llamado');

      var walletPanel = document.getElementById('walletPanel');
      if (walletPanel) {
        walletPanel.setAttribute('hidden', 'hidden');
      }

      await this.initOnce();
      state.active = true;

      var panel = document.getElementById('walletDashboardPanel');
      if (panel) panel.removeAttribute('hidden');

      await refreshData(false);
    },

    deactivate() {
      console.log(LOG, 'deactivate() llamado');
      state.active = false;

      var walletPanel = document.getElementById('walletPanel');
      if (walletPanel) {
        walletPanel.removeAttribute('hidden');
      }

      var panel = document.getElementById('walletDashboardPanel');
      if (panel) panel.setAttribute('hidden', '');
    },

    async show() {
      await this.activate();
    },

    async refresh(forceNoCache) {
      await refreshData(forceNoCache);
    },

    _debug() {
      return {
        progress: {
          done: _progress.done,
          total: _progress.total,
          inFlight: _progress.current.slice(),
          errors: _progress.errors.slice(),
          startedAt: _progress.startedAt
        },
        // Superficie de la ETA (Idea 48 Tramo B) para poder testearla y para
        // que un _debug() en consola responda "¿cuanto falta?" sin cronometrar.
        eta: (function () {
          var e = computeEta(_progress.startedAt, _progress.done, _progress.total, nowMs());
          return e ? { ms: Math.round(e.ms), secs: e.secs, text: fmtEta(e.secs) } : null;
        })(),
        etaMath: computeEta,
        etaFmt: fmtEta,
        etaThresholds: { minDone: ETA_MIN_DONE, minMs: ETA_MIN_MS },
        accounts: state.accounts.map(function(a) {
          return { label: a.label, error: a.error || null };
        }),
        statusText: (document.getElementById('wdStatusMsg') || {}).textContent || null
      };
    },

    version: '3.0.0',
    _pure: { bestByCurrency: bestByCurrency, pickerOptions: pickerOptions, totalLabel: totalLabel, initialsOf: initialsOf, formatCoinValue: formatCoinValue }
  };

  root.WalletDashboard = WalletDashboard;

  console.info(LOG, 'ready v3.0.0 — Todas las cuentas renovada (BL-056)');
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
