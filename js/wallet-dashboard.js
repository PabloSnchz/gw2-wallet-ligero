/*!
 * js/wallet-dashboard.js — Dashboard de Cartera Multi-Cuenta
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.9.0 (2026-09-30) — ETA medida en el contador de carga (Idea 48, Tramo B)
 *
 * v2.9.0: el contador "Cargando cuentas... 4/27" ahora dice cuánto falta.
 *   Con el pool global el recorrido se serializa (api-gw2 v2.19.0, POOL_MAX 6)
 *   y entre cuenta y cuenta pasaban segundos: el usuario ve 4/27 -> 5/27 con
 *   pausas y no tiene forma de distinguir "va lento" de "se colgó".
 *   La ETA se MIDE sobre cuentas completadas por segundo, no se estima con una
 *   latencia promedio: sale de lo que esta corrida ya hizo. Y no se muestra
 *   hasta tener 3 cuentas y 1,5 s de elapsed, porque con 1 cuenta el promedio
 *   es ruido y una ETA que sale de una sola muestra es exactamente el modo de
 *   falla del proyecto (rotacion de fractales, /v2/events).
 *   Cierra la Idea 46 t2 con datos de la maquina del usuario.
 *   Lo que NO se hizo, y por que: el texto "limitado por la API (600/min)" que
 *   la 46 t2 imaginaba. Con POOL_MAX=6 y hasta 3 cuentas en vuelo la cola esta
 *   no vacia practicamente todo el recorrido, asi que el texto estaria en
 *   pantalla el 100% del tiempo y no informaria nada. La ETA ya contesta la
 *   pregunta ("¿esto va normal?"). Si el PO quiere la senal explicita, el
 *   umbral honesto es "ETA > 45 s", no "hay cola".
 * v2.8.1: charP, apP, raidsP y luckP se lanzan los cuatro en un bloque
 *   sincrono y cada uno recibe su handler recien en su propio await. Con los
 *   4 propagando (api-gw2 v2.18.0), un rechazo de apP/raidsP/luckP durante
 *   el await de charP dispara "unhandledrejection" en consola. El .catch
 *   no-op marca que ya hay handler sin tocar el valor de la promesa: el await
 *   sigue viendo el rechazo y el catch de su columna corre igual.
 *   Efecto buscado: los catch de _errors.characters y _errors.raids, que
 *   estaban escritos y bien pero NUNCA corrian (el PO lo reporto en el
 *   HB#38), ahora son alcanzables. La UI de error por columna no cambia.
 * v2.8.0: + columna Suerte (MF base account-wide, /v2/account/luck)
 *                              + error por columna: "no se pudo leer" ≠ 0
 *
 * Características:
 *  - Tabla de cuentas vs divisas seleccionadas
 *  - Ordenamiento dinámico por columna
 *  - KPIs resumen con íconos oficiales
 *  - Selector de divisas dropdown
 *  - Persistencia de selección y ordenamiento
 *  - Fix: reintento de renderizado si la tabla no existe
 *  - Columna opcional "Suerte (MF)": MF% base account-wide + barra de progreso
 *    al siguiente +1% (fuente: GW2 Wiki, curva de 300 niveles)
 *  - Una columna que falló al leerse muestra "— ⚠" con el endpoint en el tooltip,
 *    y los totales marcados como parciales. Antes un error se escribía como 0 y
 *    se mostraba como un cero real.
 */

(function (root) {
  'use strict';
  // v2.8.0 (2026-09-29) — Idea 45: progreso multicuenta + error por cuenta.
  // Antes: "Cargando carteras..." sin más. Un fallo de red en la cuenta 14 de
  // 27 se veía EXACTAMENTE igual que una cuenta vacía: la UI mentía sin
  // delatarlo. Ahora el loop reporta "N/27 · M con error" en vivo, y al
  // terminar cada cuenta fallida se nombra CON su endpoint.
  // Importante para las features multicuenta que vienen (coleccionables,
  // fractals, dungeons): sin esto, cada una hereda el mismo "no sé si falló".
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
    
    var parts = [];
    if (gold > 0) parts.push('<span style="color:#f4c542;">' + gold.toLocaleString('es-AR') + '</span> <span style="color:var(--muted);">g</span>');
    if (silver > 0 || gold > 0) parts.push('<span style="color:#e0e0e0;">' + silver + '</span> <span style="color:var(--muted);">s</span>');
    parts.push('<span style="color:#b87333;">' + copperLeft + '</span> <span style="color:var(--muted);">c</span>');
    return parts.join(' ');
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
  // Antes: "Cargando carteras..." sin más. Con muchas cuentas, "Cargando carteras..." no distingue entre:
  //   (a) todavía está cargando, (b) se colgó, (c) la 14 de 27 falló y la UI
  //       muestra 13 filas como si ese fuera el total.
  // El último caso es el peor: un fallo de red silencioso se ve EXACTAMENTE
  // igual que un resultado vacío. Este tracker hace los tres distinguibles.
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
  // El contador mide cuentas completadas, no requests. Por eso la ETA se
  // calcula sobre cuentas/segundo observadas en ESTA corrida, y no sobre
  // poolStats(): el pool no sabe cuantas cuentas le faltan, y multiplicar su
  // throughput por un total de requests obligaria a hardcodear cuantos requests
  // hace una cuenta — que es justamente el dato que cambia con la cache.
  //
  // Umbrales de muestra. La ETA NO se muestra hasta tener:
  //   - ETA_MIN_DONE cuentas completadas: con 1 sola cuenta el promedio sale de
  //     una muestra y cualquier ETA es ruido.
  //   - ETA_MIN_MS de elapsed: los primeros requests de una sesion nueva son
  //     los mas lentos (conexion, TLS, cache fria), asi que un promedio
  //     temprano exagera el tiempo restante.
  // Mostrar una ETA antes de eso seria el mismo modo de falla que la rotacion
  // de fractales y /v2/events: un numero inventado con formato de dato real.
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

    var html = '<div style="margin:0 0 12px 0;padding:10px 12px;border-left:3px solid rgba(255,193,7,0.5);background:rgba(255,193,7,0.06);border-radius:6px;">' +
      '<div style="font-size:0.85rem;color:var(--tx-1);margin-bottom:6px;">' +
      _progress.errors.length + ' de ' + _progress.total + ' cuentas no se pudieron leer</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:0.78rem;color:var(--muted);line-height:1.5;">';
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
    // Iconos por tipo de cuenta (mismos que accounts-panel.js)
  var ACCOUNT_TYPE_ICONS = {
    'main':  'assets/icons/Cuentas/547827.png',
    'alter': 'assets/icons/Cuentas/157375.png',
    'f2p':   'assets/icons/Cuentas/102538.png'
  };
  var DECORATIVE_ICONS = [
    'assets/icons/Cuentas/1770678.png',
    'assets/icons/Cuentas/1770679.png',
    'assets/icons/Cuentas/1770680.png',
    'assets/icons/Cuentas/1770681.png',
    'assets/icons/Cuentas/1770682.png',
    'assets/icons/Cuentas/1770683.png',
    'assets/icons/Cuentas/1770684.png',
    'assets/icons/Cuentas/1770685.png',
    'assets/icons/Cuentas/1770686.png'
  ];

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

  function getAccountIcon(tag) {
    if (tag && ACCOUNT_TYPE_ICONS[tag]) return ACCOUNT_TYPE_ICONS[tag];
    // Fallback aleatorio si no tiene tag definido
    return DECORATIVE_ICONS[Math.floor(Math.random() * DECORATIVE_ICONS.length)];
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

    // Las 4 promesas se lanzan aqui, en un bloque sincrono, y cada una recibe
    // su handler recien en su propio await, mas abajo. Entre el lanzamiento y
    // ese await hay al menos una suspension (esperar charP), asi que si apP,
    // raidsP o luckP rechazan durante ese tiempo el navegador dispara
    // "unhandledrejection" en consola aunque su catch de columna corra
    // despues y la UI quede correcta.
    //
    // Antes esto no se notaba porque solo apP y luckP propagaban; los otros dos
    // resolvian 0 / [] y no podia pasar. Ahora los 4 propagan (Idea 47 c2), asi
    // que el .catch no-op de abajo es obligatorio, no cosmetico.
    //
    // El no-op NO cambia el valor de la promesa: solo marca que ya hay un
    // handler. El await posterior sigue viendo el rechazo original y el catch
    // de su columna corre igual, que es el que escribe _errors.
    // charP queda fuera a proposito: es el primero que se espera, asi que su
    // handler se adjunta en la primera suspension, sin ventana muerta.
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
      return '<img src="' + esc(currency.icon) + '" width="20" height="20" alt="' + esc(currency.name || '') + '" loading="lazy" style="vertical-align: middle; margin-right: 6px;">';
    }
    return '';
  }

  function renderCurrencySelector() {
    var container = $('#wdCurrencySelector');
    if (!container) {
      console.warn(LOG, 'Selector container no encontrado');
      return;
    }

    if (!state.currencies.length) {
      container.innerHTML = '<span class="muted">Cargando divisas...</span>';
      return;
    }

    var selectedSet = new Set(state.selectedCurrencies);
    var selectedNames = state.currencies
      .filter(function(c) { return selectedSet.has(c.id); })
      .map(function(c) { return c.name; })
      .join(', ');
    
    var html = '<div style="position:relative; display:inline-block;">' +
      '<button id="wdCurrencyDropdownBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px; min-width:200px; justify-content:space-between;">' +
      '<span>' + (selectedNames || 'Seleccionar divisas') + '</span>' +
      '<span>▼</span>' +
      '</button>' +
      '<div id="wdCurrencyDropdown" class="wd-dropdown" style="top:100%; left:0; z-index:100; min-width:220px; max-height:300px; overflow-y:auto; display:none;">' +
      '<div style="display:flex; flex-direction:column; gap:6px;">' +
      '<button id="wdSelectAllBtn" class="btn btn--xs" style="margin-bottom:4px;">✓ Seleccionar todas</button>' +
      '<button id="wdSelectNoneBtn" class="btn btn--xs" style="margin-bottom:8px;">✗ Deseleccionar todas</button>';
    
    state.currencies.forEach(function(cur) {
      var isSelected = selectedSet.has(cur.id);
      var iconHtml = getCurrencyIconHtml(cur);
      html += '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:6px;">' +
        '<input type="checkbox" value="' + cur.id + '" ' + (isSelected ? 'checked' : '') + ' style="cursor:pointer;">' +
        iconHtml +
        '<span>' + esc(cur.name || 'Divisa #' + cur.id) + '</span>' +
        '</label>';
    });
    
    html += '</div></div></div>';
    container.innerHTML = html;

    var dropdownBtn = document.getElementById('wdCurrencyDropdownBtn');
    var dropdown = document.getElementById('wdCurrencyDropdown');
    var selectAllBtn = document.getElementById('wdSelectAllBtn');
    var selectNoneBtn = document.getElementById('wdSelectNoneBtn');
    
    if (dropdownBtn && dropdown) {
      dropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      
      document.addEventListener('click', function(e) {
        if (dropdownBtn && dropdown && !dropdownBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
      
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
          state.selectedCurrencies = state.currencies.map(function(c) { return c.id; });
          saveSelectedCurrencies();
          var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(function(cb) { cb.checked = true; });
          dropdownBtn.querySelector('span:first-child').textContent = state.currencies.map(function(c) { return c.name; }).join(', ');
          renderTable();
        });
      }
      
      if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', function() {
          state.selectedCurrencies = [];
          saveSelectedCurrencies();
          var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(function(cb) { cb.checked = false; });
          dropdownBtn.querySelector('span:first-child').textContent = 'Seleccionar divisas';
          renderTable();
        });
      }
      
      var checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
          var id = parseInt(this.value, 10);
          if (this.checked) {
            if (!state.selectedCurrencies.includes(id)) {
              state.selectedCurrencies.push(id);
            }
          } else {
            state.selectedCurrencies = state.selectedCurrencies.filter(function(cid) { return cid !== id; });
          }
          saveSelectedCurrencies();
          var newSelectedNames = state.currencies
            .filter(function(c) { return state.selectedCurrencies.includes(c.id); })
            .map(function(c) { return c.name; })
            .join(', ');
          if (dropdownBtn.querySelector('span:first-child')) {
            dropdownBtn.querySelector('span:first-child').textContent = newSelectedNames || 'Seleccionar divisas';
          }
          renderTable();
        });
      });
    }
  }

  function renderKPIs(totals, accounts) {
    var container = $('#wdKPIs');
    if (!container) return;

    var kpis = [];
    
    var goldIcon = 'https://render.guildwars2.com/file/98457F504BA2FAC8457F532C4B30EDC23929ACF9/619316.png';
    var karmaIcon = 'https://render.guildwars2.com/file/94953FA23D3E0D23559624015DFEA4CFAA07F0E5/155026.png';
    var laurelIcon = 'https://render.guildwars2.com/file/A1BD345AD9192C3A585BE2F6CB0617C5A797A1E2/619317.png';
    var aaIcon = 'https://render.guildwars2.com/file/1856A01E331452E4C14E4C9CF4F818E3FAEF9B79/3124964.png';
    
    var goldId = state.currencies.find(function(c) { return c.name === 'Moneda' || c.id === 1; })?.id;
    var karmaId = state.currencies.find(function(c) { return c.name === 'Karma' || c.id === 2; })?.id;
    var laurelId = state.currencies.find(function(c) { return c.name === 'Laurel' || c.id === 3; })?.id;
    var aaId = state.currencies.find(function(c) { return c.name?.includes('Reconocimiento astral') || c.id === 63; })?.id;

    if (goldId && totals[goldId] !== undefined) {
      kpis.push('<div class="wd-kpi-card wd-kpi-gold">' +
        '<div class="wd-kpi-label"><img src="' + goldIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Oro</div>' +
        '<div class="wd-kpi-value gold-glow">' + formatCoinValue(totals[goldId]) + '</div></div>');
    }
    if (karmaId && totals[karmaId] !== undefined) {
      kpis.push('<div class="wd-kpi-card wd-kpi-karma">' +
        '<div class="wd-kpi-label"><img src="' + karmaIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Karma</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[karmaId]) + '</div></div>');
    }
    if (laurelId && totals[laurelId] !== undefined) {
      kpis.push('<div class="wd-kpi-card wd-kpi-laurel">' +
        '<div class="wd-kpi-label"><img src="' + laurelIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Total Laurel</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[laurelId]) + '</div></div>');
    }
    if (aaId && totals[aaId] !== undefined) {
      kpis.push('<div class="wd-kpi-card wd-kpi-aa">' +
        '<div class="wd-kpi-label"><img src="' + aaIcon + '" width="20" height="20" style="vertical-align:middle;margin-right:6px;"> Reconocimiento Astral</div>' +
        '<div class="wd-kpi-value">' + fmtInt(totals[aaId]) + '</div></div>');
    }

    // KPI de MF base: se dibuja SIEMPRE, sin mirar ningun selector.
    // El MF% es por cuenta (curva independiente), asi que no se suma:
    // mostramos la mejor cuenta y cuantas llegaron al tope.
    if (accounts && accounts.length) {
      var luckBest = 0, luckCapped = 0;
      accounts.forEach(function(acc) {
        var s = acc.summary || {};
        if (typeof s.luck === 'number') {
          if (s.luck > luckBest) luckBest = s.luck;
          if (s.luckCapped) luckCapped++;
        }
      });
      kpis.push('<div class="wd-kpi-card wd-kpi-summary" style="borderLeft:3px solid rgba(255,193,7,0.5);">' +
        '<div class="wd-kpi-label" style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:20px;line-height:1;">' + SUMMARY_FIELD_SYMBOLS.luck + '</span> Mejor MF base (' + luckCapped + '/' + accounts.length + ' al tope)</div>' +
        '<div class="wd-kpi-value">' + luckBest + '%</div></div>');
    }

    container.innerHTML = kpis.join('');
  }

  function formatValueForDisplay(currencyId, value) {
    if (value < 0) {
      return '<span style="color:var(--color-red);">' + (currencyId === 1 ? formatCoinValue(Math.abs(value)) : fmtInt(Math.abs(value))) + '</span>';
    }
    if (currencyId === 1) {
      return '<span class="gold-value">' + formatCoinValue(value) + '</span>';
    }
    return fmtInt(value);
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
    if (!thead || !tbody) {
      console.error(LOG, 'thead o tbody no encontrados');
      return;
    }

    // Verificar que tenemos datos
    if (!state.currencies.length) {
      console.log(LOG, 'Esperando divisas...');
      return;
    }

    if (!state.selectedCurrencies.length) {
      console.log(LOG, 'No hay divisas seleccionadas');
      thead.innerHTML = '<td><th>Cuenta</th><th colspan="1">No hay divisas seleccionadas</th></tr>';
      tbody.innerHTML = '<td><td colspan="2">Selecciona al menos una divisa en el panel de filtros.2</td></tr>';
      return;
    }

    var selectedCurrencies = state.currencies.filter(function(c) { 
      return state.selectedCurrencies.includes(c.id); 
    });
    
    if (!selectedCurrencies.length) {
      thead.innerHTML = '<td><th>Cuenta</th><th colspan="1">No hay divisas seleccionadas</th></tr>';
      tbody.innerHTML = '<td><td colspan="2">Selecciona al menos una divisa.2</td></tr>';
      return;
    }

    console.log(LOG, 'Renderizando tabla con', selectedCurrencies.length, 'divisas y', state.accounts.length, 'cuentas');

    // Cabecera con ordenamiento
    var hcells = ['<th class="wd-account-header">Cuenta</th>'];
    hcells.push('<th class="right">Suerte (MF)</th>');
    selectedCurrencies.forEach(function(cur) {
      var iconHtml = getCurrencyIconHtml(cur);
      var sortIndicator = '';
      if (state.sortColumn === cur.id) {
        sortIndicator = state.sortDirection === 'desc' ? ' ↓' : ' ↑';
      }
      hcells.push('<th class="right sortable" data-currency-id="' + cur.id + '" title="Ordenar por ' + esc(cur.name) + '" style="cursor:pointer;">' + 
        iconHtml + '<span style="display:inline-block; margin-left:4px;">' + esc(cur.name || 'Divisa #' + cur.id) + sortIndicator + '</span></th>');
    });
    thead.innerHTML = '                <tr>' + hcells.join('') + ' <\/tr>';

    // Aplicar ordenamiento
    var rowsAcc = state.accounts.slice();
    if (state.sortColumn !== null) {
      rowsAcc = sortAccounts(rowsAcc, state.sortColumn, state.sortDirection);
    }

    // Calcular totales
    var totals = {};
    selectedCurrencies.forEach(function(cur) { totals[cur.id] = 0; });
    rowsAcc.forEach(function(acc) {
      selectedCurrencies.forEach(function(cur) {
        totals[cur.id] += acc.wallet[cur.id] || 0;
      });
    });

    // Renderizar KPIs
    renderKPIs(totals, state.accounts);

        var bodyRows = rowsAcc.map(function(acc) {
          var cells = [];
          // Buscar el tag de esta cuenta en las keys guardadas
          var keyItem = state.keys.find(function(k) { return k.value === acc.token; });
          var tag = keyItem ? keyItem.tag : null;
          var icon = getAccountIcon(tag);

          // Indicador de error si la cuenta tiene un problema (ej: sin acceso al juego)
          var errorIndicator = '';
          if (acc.error) {
            errorIndicator = '<span title="' + esc(acc.error) + '" style="display:inline-flex;align-items:center;cursor:help;margin-left:6px;">' +
              '<img src="assets/icons/Welcome/156107.png" width="16" height="16" alt="⚠" style="filter:brightness(0.8);">' +
              '</span>';
          }

          cells.push(
            '<td style="display:flex;align-items:center;gap:10px;min-width:160px;">' +
              '<img src="' + icon + '" width="28" height="28" alt="" style="border-radius:8px;filter:brightness(0.9);flex-shrink:0;" loading="lazy">' +
              '<strong>' + esc(acc.label) + '</strong>' +
              errorIndicator +
            '</td>'
          );
      var s = acc.summary || {};
      var fieldErr = (s._errors && s._errors.luck) || null;
      cells.push(fieldErr ? unreadableCell(fieldErr) : renderLuckCell(s));
      selectedCurrencies.forEach(function(cur) {
        var value = acc.wallet[cur.id] || 0;
        var displayValue = formatValueForDisplay(cur.id, value);
        cells.push('<td class="right" title="' + esc(cur.name) + ': ' + (cur.id === 1 ? value + ' cobre' : fmtInt(value)) + '">' + displayValue + '</td>');
      });
      return '                <tr>' + cells.join('') + '<\/tr>';
    }).join('');

    // Fila de totales
    var totalCells = ['<td class="total-label"><strong><img src="assets/icons/578844.png" width="14" height="14" alt="" style="vertical-align: middle; margin-right: 6px;">TOTAL</strong></td>'];
    totalCells.push('<td class="right total-cell"></td>');
    selectedCurrencies.forEach(function(cur) {
      var totalValue = totals[cur.id];
      var displayTotal = formatValueForDisplay(cur.id, totalValue);
      var walletUnreadable = rowsAcc.filter(function(acc) { return acc.error; }).length;
      var curTitle = walletUnreadable > 0
        ? 'Parcial: ' + walletUnreadable + ' de ' + rowsAcc.length + ' cuentas no se pudieron leer.'
        : '';
      totalCells.push('<td class="right total-cell"' + (curTitle ? ' title="' + esc(curTitle) + '"' : '') + '>' +
        '<strong>' + displayTotal + (walletUnreadable > 0 ? ' ⚠' : '') + '</strong></td>');
    });
    var totalRow = '<tr class="total-row">' + totalCells.join('') + '<\/tr>';

    tbody.innerHTML = bodyRows + totalRow;
    console.log(LOG, 'Tabla renderizada con', rowsAcc.length, 'filas');

    // Agregar eventos de ordenamiento (divisas)
    var sortableHeaders = thead.querySelectorAll('th.sortable');
    sortableHeaders.forEach(function(th) {
      th.removeEventListener('click', th.__clickHandler);
      var currencyId = parseInt(th.getAttribute('data-currency-id'), 10);
      var handler = function() { setSortColumn(currencyId); };
      th.__clickHandler = handler;
      th.addEventListener('click', handler);
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

  // ------------------------------ UI del Panel (creación síncrona) ------------------------------
  function ensurePanelContent() {
    var panel = document.getElementById('walletDashboardPanel');
    if (!panel) {
      console.error(LOG, 'Panel walletDashboardPanel no encontrado en el DOM');
      return null;
    }

    // Si ya tiene contenido, no lo recreamos
    if (panel.querySelector('.wd-content')) {
      console.log(LOG, 'Panel ya tiene contenido');
      return panel;
    }

    console.log(LOG, 'Creando contenido del panel...');
    
    // Limpiar el panel
    panel.innerHTML = '';
    
    // Crear el contenido
    var contentDiv = document.createElement('div');
    contentDiv.className = 'wd-content';
    contentDiv.innerHTML = `
      <div class="panel__head">
        <h2 class="panel__title">
          <img src="assets/icons/733322.png" alt="" width="32" height="32" style="vertical-align: middle; margin-right: 8px;">
          Dashboard de Cartera Multi-Cuenta
        </h2>
      </div>
      <div class="panel__body">
        <div id="wdLoadErrors"></div>
        <div id="wdKPIs" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; margin-bottom:20px;"></div>
        
        <div class="wd-filters" style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong>Divisas:</strong>
            <div id="wdCurrencySelector"></div>
          </div>
          <div style="display:flex; gap:8px; margin-left:auto;">
            <button id="wdRefreshBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px;">
              <img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="Refrescar"> Refrescar
            </button>
            <button id="wdBackBtn" class="btn btn--ghost" style="display:inline-flex; align-items:center; gap:6px;">
              <img src="assets/icons/733322.png" width="14" height="14" alt="Volver"> Volver a Cartera
            </button>
          </div>
        </div>
        
        <div class="wd-status-bar" style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span id="wdStatusMsg" class="wd-status-msg">—</span>
          <span id="wdTimestamp" class="wd-timestamp"></span>
        </div>
        
        <div class="wd-tablewrap">
          <table id="wdTable" class="wd-table wvpd" style="width:100%; border-collapse:collapse;">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;
    
    panel.appendChild(contentDiv);
    
    console.log(LOG, 'Contenido del panel creado');
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
    }
  };

  root.WalletDashboard = WalletDashboard;

  console.info(LOG, 'ready v2.9.0 — el contador de carga mide y muestra la ETA (Idea 48 Tramo B)');
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));