/*!
 * js/wv-purchase-detail.js — Cámara del Brujo: Todas las cuentas → Compras fijadas (BL-064, CAM-5)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 2.0.0 (2026-10-24)
 *
 * Matriz de compras fijadas de todas las cuentas: filas = cuentas, columnas = ítems
 * fijados en alguna cuenta. API de siempre para router.js y wv-view.js: show, hide,
 * refresh, initOnce y refreshOnlineStatus.
 *
 * 2.0.0 (CAM-5):
 *  - Mismo idioma visual que Objetivos semanales (CAM-4): 4 números arriba, barra de
 *    filtros, leyenda y matriz con la columna de cuentas fija. Sin título, banner ni
 *    cuentas regresivas propios: los pone la cabecera de la Cámara (CAM-1).
 *  - Selector −/+ en cada celda: marca compras de cualquier cuenta sin cambiar de
 *    cuenta. Mismas reglas que la Tienda (CAM-3): la marca suma a lo que vio la API,
 *    con tope, y la AA disponible descuenta lo marcado.
 *  - «Gestionar» para todas las cuentas: ajustar marcas a la API, copiar los fijados
 *    de la cuenta seleccionada y quitar fijados (con confirmación). Todo con «Deshacer».
 *  - Fuera ~20 KB de CSS (duplicado en css/theme-polish.css o de vistas que ya no
 *    existen) y el código que escribía sobre las tarjetas viejas de la Tienda
 *    (enhanceShopCards): la Tienda 2.0.0 ya no las tiene, y su observador recargaba
 *    todas las cuentas cada vez que se abría la Tienda.
 *  - Ya no pide los objetivos semanales de cada cuenta (eso vive en Objetivos semanales).
 *  - Clases wvp-* y tokens del GDS; nada de estilos en línea fijos ni emoji.
 *  - Lo visual (números, HTML y estilos) vive en js/wv-purchases-view.js 1.0.0, por
 *    js/modules.json (DEC-035). Este archivo queda con datos, almacén y acciones:
 *    de 91 KB a menos de 40 KB.
 *
 * Cambios v1.14.0 (Idea 55 Tramo 2): refreshAllOnlineStatus() en paralelo (la capa
 * estrangula con poolRun) y progreso con la ETA de js/progress-eta.js. Se conserva igual.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var LOG = '[WV-PurchaseDetail]';
  var UNDO_SECONDS = 10;

  // Lo visual (números, HTML y estilos) vive en js/wv-purchases-view.js (por manifiesto).
  function V() { return root.WVPurchasesView || null; }
  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0, 4) + '…' + t.slice(-4)) : 'anon'; }
  function findRow(rows, id) {
    for (var i = 0; i < (rows || []).length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  // ------------------------------------------------------------------ estado y DOM
  var doc = root.document;
  var state = {
    inited: false, currentSeason: null, accounts: [], globalItemsById: new Map(),
    loading: false, error: null, syncedAt: '', status: '', statusKind: '', selFp: '', menuOpen: false, undo: null,
    view: { q: '', pendingOnly: false, sort: 'need' }, prevTab: 'shop'
  };
  state.metaOf = getItemMeta;

  var _refreshInFlight = null;
  var _refreshSeq = 0;
  var _itemsBackfillScheduled = false;
  var _undoTimer = null;

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }

  function getItemMeta(itemId) {
    var meta = state.globalItemsById.get(Number(itemId));
    if (meta) return meta;
    for (var i = 0; i < state.accounts.length; i++) {
      var map = state.accounts[i].itemsById;
      try {
        var it = map && (typeof map.get === 'function' ? map.get(Number(itemId)) : map[Number(itemId)]);
        if (it) return it;
      } catch (_) {}
    }
    return null;
  }

  function ensureCss() {
    if (!doc || !doc.head || !V() || byId('wv-purchase-detail-css')) return;
    var s = doc.createElement('style');
    s.id = 'wv-purchase-detail-css';
    s.textContent = V().CSS;
    doc.head.appendChild(s);
  }

  function setTabsVisible(visible) {
    ['wvTabDaily', 'wvTabWeekly', 'wvTabSpecial', 'wvTabShop'].forEach(function (id) {
      var n = byId(id);
      if (!n) return;
      if (visible) n.removeAttribute('hidden'); else n.setAttribute('hidden', '');
    });
  }

  function ensurePanel() {
    var wvPanel = byId('wvPanel');
    if (!wvPanel) return null;
    var panel = byId('wvPDPanel');
    if (!panel) {
      panel = doc.createElement('section');
      panel.id = 'wvPDPanel';
      panel.className = 'wvp-panel';
      panel.setAttribute('hidden', '');
      var anchor = byId('wvTabDaily') || byId('wvTabWeekly') || byId('wvTabSpecial') || byId('wvTabShop');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      else wvPanel.appendChild(panel);
    }
    wire(panel);
    return panel;
  }

  function isOpen() {
    var p = byId('wvPDPanel');
    return !!p && !p.hasAttribute('hidden');
  }

  function render() {
    var p = ensurePanel();
    if (!p) return;
    if (!V()) { p.innerHTML = '<p class="wvp-empty" role="status">Preparando Compras fijadas…</p>'; return; }
    ensureCss();
    state.selFp = fpToken(getSelectedToken());
    p.innerHTML = V().viewHTML(state, Date.now());
  }

  // Devuelve el foco al primer selector que siga habilitado (si no, al filtro).
  function refocus(sel, alt) {
    var p = byId('wvPDPanel');
    if (!p || !p.querySelector) return;
    var b = p.querySelector(sel + ':not([disabled])') || (alt && p.querySelector(alt + ':not([disabled])')) || p.querySelector('[data-wvp-pending]');
    if (b && b.focus) b.focus();
  }

  function setStatus(msg, kind) {
    state.status = String(msg || '');
    state.statusKind = kind || '';
    var el = byId('wvpdStatusMsg');
    if (!el) return;
    el.textContent = state.status;
    if (el.classList) el.classList[kind === 'error' ? 'add' : 'remove']('wvp-status--err');
  }

  function hhmm(d) { return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

  // ------------------------------------------------------------------ interacción
  function accByFp(fp) {
    for (var i = 0; i < state.accounts.length; i++) if (state.accounts[i].fp === fp) return state.accounts[i];
    return null;
  }

  function setMark(fp, id, delta) {
    var acc = accByFp(fp), row = acc ? findRow(acc.rows, id) : null, S = root.WVSeasonStore, cur = state.currentSeason;
    if (!row || !V()) return;
    var n = V().units(row, acc.marks), before = n.marked;
    var v = Math.max(0, Math.min(n.max, before + delta));
    if (v === before) return;
    acc.marks = Object.assign({}, acc.marks);
    acc.marks[id] = v;
    render();
    var cell = '[data-fp="' + fp + '"][data-id="' + id + '"]';
    refocus('[data-wvp-step="' + delta + '"]' + cell, '[data-wvp-step="' + (-delta) + '"]' + cell);
    if (!S || !cur) return;
    var patch = {};
    patch[id] = v;
    Promise.resolve().then(function () { return S.setMarks(cur.year, cur.seq, fp, patch); }).catch(function () {
      acc.marks[id] = before;
      render();
      if (root.toast) root.toast('error', 'No se pudo guardar la marca', { ttl: 2000 });
    });
  }

  function say(kind, msg, ttl) { if (root.toast) root.toast(kind, msg, { ttl: ttl || 2200 }); }

  function showUndo(msg, fn) {
    state.undo = { msg: msg, fn: fn, until: Date.now() + UNDO_SECONDS * 1000 };
    if (_undoTimer) clearInterval(_undoTimer);
    _undoTimer = setInterval(function () {
      var left = state.undo ? Math.ceil((state.undo.until - Date.now()) / 1000) : 0;
      var el = doc && doc.querySelector ? doc.querySelector('#wvPDPanel [data-wvp-left]') : null;
      if (left > 0) { if (el) el.textContent = left + ' s'; return; }
      clearInterval(_undoTimer); _undoTimer = null; state.undo = null;
      var host = doc && doc.querySelector ? doc.querySelector('#wvPDPanel [data-wvp-undo-host]') : null;
      if (host) host.innerHTML = '';
    }, 1000);
    render();
  }

  function runUndo() {
    var u = state.undo;
    if (!u) return;
    state.undo = null;
    if (_undoTimer) { clearInterval(_undoTimer); _undoTimer = null; }
    Promise.resolve().then(u.fn).then(function () { rereadStore(true); say('success', 'Listo: lo deshice', 1800); },
      function () { rereadStore(true); say('error', 'No pude deshacerlo'); });
  }

  // Las tres acciones usan los planes puros de js/wv-shop-manage.js (una sola regla para la Tienda y acá).
  function runAction(id) {
    state.menuOpen = false;
    var M = root.WVShopManage && root.WVShopManage._pure, S = root.WVSeasonStore, cur = state.currentSeason;
    if (!M || !S || !cur) { say('error', 'No pude abrir las marcas de esta temporada'); render(); return Promise.resolve(false); }
    var y = cur.year, q = cur.seq, accs = state.accounts.filter(function (a) { return !a.error; });
    var pins = {};
    accs.forEach(function (a) { pins[a.fp] = S.getPinned(y, q, a.fp) || {}; });
    var job;
    if (id === 'sync') {
      var before = {}, total = 0;
      job = Promise.all(accs.map(function (a) {
        var plan = M.planSync(a.rows, S.getMarks(y, q, a.fp) || {});
        if (!plan.count) return null;
        before[a.fp] = plan.before; total += plan.count;
        return S.setMarks(y, q, a.fp, plan.patch);
      })).then(function () {
        if (!total) { say('info', 'No hay marcas para ajustar: la API no registró nada nuevo'); return false; }
        showUndo('Ajusté ' + plural(total, 'marca', 'marcas') + ' a lo que ya registró la API.', function () {
          return Promise.all(Object.keys(before).map(function (fp) { return S.setMarks(y, q, fp, before[fp]); }));
        });
        return true;
      });
    } else if (id === 'copy') {
      var src = fpToken(getSelectedToken());
      var pc = M.planCopy(pins[src] || S.getPinned(y, q, src) || {}, src, pins);
      if (!pc.ids.length) { say('info', 'La cuenta seleccionada no tiene fijados para copiar'); render(); return Promise.resolve(false); }
      if (!pc.total) { say('info', 'Las otras cuentas ya tienen esos fijados'); render(); return Promise.resolve(false); }
      if (!(root.confirm && root.confirm('¿Copiar ' + plural(pc.ids.length, 'fijado', 'fijados') + ' de la cuenta seleccionada a ' + plural(pc.accounts, 'cuenta más', 'cuentas más') +
        '?\n\nSolo se agregan: no se borra nada. Vas a poder deshacerlo durante ' + UNDO_SECONDS + ' segundos.'))) { render(); return Promise.resolve(false); }
      var fpsC = Object.keys(pc.byFp);
      job = Promise.all(fpsC.map(function (fp) {
        var p = {};
        pc.byFp[fp].forEach(function (x) { p[x] = true; });
        return S.setPinned(y, q, fp, p);
      })).then(function () {
        showUndo('Copié ' + plural(pc.total, 'fijado', 'fijados') + ' a ' + plural(pc.accounts, 'cuenta', 'cuentas') + '.', function () {
          return Promise.all(fpsC.map(function (fp) { return S.delPinned(y, q, fp, pc.byFp[fp]); }));
        });
        return true;
      });
    } else if (id === 'clear') {
      var pl = M.planClear(pins);
      if (!pl.total) { say('info', 'No hay fijados para quitar'); render(); return Promise.resolve(false); }
      if (!(root.confirm && root.confirm('¿Quitar ' + plural(pl.total, 'fijado', 'fijados') + ' de ' + plural(pl.accounts, 'cuenta', 'cuentas') +
        ' en esta temporada?\n\nVas a poder deshacerlo durante ' + UNDO_SECONDS + ' segundos.'))) { render(); return Promise.resolve(false); }
      var fpsX = Object.keys(pl.byFp);
      job = Promise.all(fpsX.map(function (fp) { return S.delPinned(y, q, fp, pl.byFp[fp]); })).then(function () {
        showUndo('Quité ' + plural(pl.total, 'fijado', 'fijados') + ' de ' + plural(pl.accounts, 'cuenta', 'cuentas') + '.', function () {
          return Promise.all(fpsX.map(function (fp) {
            var p = {};
            pl.byFp[fp].forEach(function (x) { p[x] = true; });
            return S.setPinned(y, q, fp, p);
          }));
        });
        return true;
      });
    } else { render(); return Promise.resolve(false); }
    return job.then(function (r) { rereadStore(true); return r; }, function (e) {
      say('error', 'No se pudo completar: ' + ((e && e.message) || 'error desconocido'), 2600);
      rereadStore(true);
      return false;
    });
  }

  function wire(p) {
    if (p.__wvpWired || !p.addEventListener) return;
    p.__wvpWired = true;
    p.addEventListener('click', function (e) {
      for (var n = e.target, i = 0; n && i < 5; n = n.parentNode, i++) {
        if (!n.getAttribute) continue;
        var step = n.getAttribute('data-wvp-step');
        if (step) { if (!n.disabled) setMark(n.getAttribute('data-fp'), n.getAttribute('data-id'), Number(step)); return; }
        var act = n.getAttribute('data-wvp-act');
        if (act) { runAction(act); return; }
        if (n.hasAttribute('data-wvp-pending')) { state.view.pendingOnly = !state.view.pendingOnly; render(); refocus('[data-wvp-pending]'); return; }
        if (n.hasAttribute('data-wvp-menu')) { state.menuOpen = !state.menuOpen; render(); refocus(state.menuOpen ? '[data-wvp-act]' : '[data-wvp-menu]'); return; }
        if (n.hasAttribute('data-wvp-online-all')) { refreshAllOnlineStatus(); return; }
        if (n.hasAttribute('data-wvp-undo')) { runUndo(); return; }
        if (n.hasAttribute('data-wvp-retry')) { safeRefresh(true); return; }
        if (n.hasAttribute('data-wvp-shop')) { WVPurchaseDetail.hide(); return; }
      }
      if (state.menuOpen) { state.menuOpen = false; render(); }
    });
    p.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-wvp-sort')) { state.view.sort = t.value; render(); refocus('[data-wvp-sort]'); }
    });
    var qt = null;
    p.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.hasAttribute || !t.hasAttribute('data-wvp-q')) return;
      clearTimeout(qt);
      qt = setTimeout(function () {
        state.view.q = t.value;
        render();
        var q = byId('wvPDPanel').querySelector('[data-wvp-q]');
        if (q && q.focus) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (_) {} }
      }, 200);
    });
    p.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.menuOpen) { state.menuOpen = false; render(); refocus('[data-wvp-menu]'); }
    });
  }

  // Igualdad de marcas o fijados sin importar el orden ni true/1 ni los ceros.
  function same(a, b) {
    var n = function (o) {
      var out = {};
      Object.keys(o || {}).forEach(function (k) { var v = Number(o[k]) || 0; if (v) out[k] = v; });
      return JSON.stringify(Object.keys(out).sort().map(function (k) { return [k, out[k]]; }));
    };
    return n(a) === n(b);
  }

  // Marcas y fijados cambian en el almacén (Tienda, Gestionar, otra pestaña): se releen
  // sin volver a pedir nada a la API.
  function rereadStore(force) {
    var S = root.WVSeasonStore, cur = state.currentSeason;
    if (!S || !cur || !state.accounts.length) return;
    var changed = !!force;
    state.accounts.forEach(function (a) {
      var p = S.getPinned(cur.year, cur.seq, a.fp) || {}, m = S.getMarks(cur.year, cur.seq, a.fp) || {};
      if (!same(p, a.pinned) || !same(m, a.marks)) changed = true;
      a.pinned = p; a.marks = m;
    });
    if (changed && isOpen()) { render(); lazyItemIcons(); }
  }

  // ------------------------------------------------------------------ datos
  // Lista de cuentas: lectura cruda TOLERADA de la legacy gw2_keys
  // (idea61 la vigila por par: 'wv-purchase-detail.js[gw2_keys]').
  function loadKeys() {
    try { var list = JSON.parse(localStorage.getItem('gw2_keys') || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }

  /**
   * Token de la cuenta seleccionada (marca la fila «seleccionada» y es la fuente de
   * «Copiar los fijados»).
   *
   * Lee por la capa: `Storage.get(ACCOUNT_SELECTED)` (T19-c), nunca la legacy a pelo.
   * FALLBACK DEL DOM — INTENCIONAL: el `<select id="keySelectGlobal">` gana cuando
   * tiene valor, que es lo que pasa hoy. Cambiar esta precedencia es otro ciclo.
   */
  function getSelectedToken() {
    try {
      var sel = document.getElementById('keySelectGlobal');
      if (sel && sel.value) return sel.value.trim();
      var stored = Storage.get(Storage.STORAGE_KEYS.ACCOUNT_SELECTED);
      if (stored) return stored;
    } catch (e) {}
    return null;
  }

  function initCurrentSeason() {
    var S = root.WVSeasonStore;
    if (S && typeof S.getCurrentSeasonInfo === 'function') {
      return Promise.resolve().then(function () { return S.getCurrentSeasonInfo(); })
        .then(function (s) { state.currentSeason = s; }, function (e) { if (root.console) root.console.warn(LOG, 'temporada', e); });
    }
    state.currentSeason = { year: (new Date()).getUTCFullYear() % 100, seq: 1 };
    return Promise.resolve();
  }

  // Busca los íconos que falten de las columnas (una vez por ítem).
  function lazyItemIcons() {
    if (_itemsBackfillScheduled || !V() || !root.GW2Api || typeof root.GW2Api.getItemsMany !== 'function') return;
    var ids = V().itemColumns(state.accounts, getItemMeta).filter(function (c) { return !c.icon && c.itemId != null; })
      .map(function (c) { return Number(c.itemId); }).filter(function (id) { return !state.globalItemsById.has(id); });
    if (!ids.length) return;
    _itemsBackfillScheduled = true;
    Promise.resolve().then(function () { return root.GW2Api.getItemsMany(ids.slice(0, 200), { nocache: false }); }).then(function (items) {
      (items || []).forEach(function (it) { if (it && it.id != null) state.globalItemsById.set(Number(it.id), it); });
      ids.forEach(function (id) { if (!state.globalItemsById.has(id)) state.globalItemsById.set(id, { id: id }); });
      if (isOpen()) render();
    }, function (e) { if (root.console) root.console.warn(LOG, 'íconos', e); }).then(function () { _itemsBackfillScheduled = false; });
  }

  function updateSingleAccountRow(token, acc) {
    var fp = fpToken(token), p = byId('wvPDPanel');
    var cell = p && p.querySelector ? p.querySelector('[data-wvp-online="' + fp + '"]') : null;
    if (cell && V()) cell.innerHTML = V().onlineHTML(acc);
  }

  // ====== ESTADO ONLINE DE TODAS LAS CUENTAS (VÍA LAST_MODIFIED) ======
  //
  // Idea 55 Tramo 2: los N requests salen juntos y el estrangulamiento lo pone la
  // capa (api-gw2.js jfetch -> poolRun, POOL_MAX = 6). No hay pool local a
  // propósito: dos estranguladores anidados fue el defecto de la Idea 46.
  // El progreso va por setStatus() con la ETA de GN.progressEta.
  async function refreshAllOnlineStatus() {
    console.log(LOG, 'Actualizando estado online de todas las cuentas (vía last_modified)...');
    if (!state.accounts || state.accounts.length === 0) {
      console.warn(LOG, 'No hay cuentas cargadas');
      return;
    }

    if (window.toast) {
      window.toast('info', 'Actualizando estado online...', { ttl: 1500 });
    }

    var total = state.accounts.length;
    var startedAt = Date.now();
    var updatedCount = 0;
    var onlineCount = 0;
    var failedCount = 0;
    var done = 0;

    function reportProgress() {
      var msg = 'Estado online: ' + done + '/' + total;
      var e = GN.progressEta.computeEta(startedAt, done, total, Date.now());
      if (e) msg += ' — ' + GN.progressEta.fmtEta(e.secs) + ' restantes';
      if (failedCount) msg += ' · ' + failedCount + ' con error';
      setStatus(msg, failedCount ? 'error' : undefined);
    }

    // Un settle por cuenta: el fallo de una (token revocado, 500) no se lleva
    // por delante el resultado de las otras.
    var results = await Promise.allSettled(state.accounts.map(function (acc) {
      return root.GW2Api.getAccountInfo(acc.token, { nocache: true })
        .then(function (accountInfo) {
          var isOnline = root.GW2Api.isRecentlyActive(accountInfo, 10); // 10 minutos de umbral
          var lastPlayedChar = null;

          if (isOnline && accountInfo && accountInfo.last_modified) {
            var lastModified = new Date(accountInfo.last_modified);
            var now = new Date();
            var minutesSince = Math.floor((now - lastModified) / (1000 * 60));
            lastPlayedChar = 'Actividad hace ' + minutesSince + ' min';
          }

          if (acc.isOnline !== isOnline || acc.lastPlayedChar !== lastPlayedChar) {
            acc.isOnline = isOnline;
            acc.lastPlayedChar = lastPlayedChar;
            // Buscar por token en vez de por índice
            updateSingleAccountRow(acc.token, acc);
            updatedCount++;
          }
          if (isOnline) onlineCount++;
          return true;
        })
        .then(function (v) { done++; reportProgress(); return v; },
              function (e) { done++; failedCount++; reportProgress(); throw e; });
    }));

    results.forEach(function (r, i) {
      if (r.status === 'rejected') {
        console.warn(LOG, 'Error refreshing online status for', state.accounts[i].label, r.reason);
      }
    });

    if (window.toast) {
      if (failedCount) {
        window.toast('info', failedCount + ' cuenta(s) no se pudieron leer', { ttl: 2500 });
      }
      if (onlineCount > 0) {
        window.toast('success', onlineCount + ' cuenta(s) activa(s) en los últimos 10 min', { ttl: 2000 });
      } else {
        window.toast('info', 'No se encontraron cuentas con actividad reciente', { ttl: 1500 });
      }
    }
    console.log(LOG, 'Actualización completada: ' + updatedCount + ' cambios, ' + onlineCount + ' activas, ' + failedCount + ' errores');
  }

  // ====== CARGA DE TODAS LAS CUENTAS ======
  // Tienda de cada cuenta (con su AA) y, sin bloquear, su estado online. De a 2
  // cuentas; la capa estrangula el resto.
  function loadAccount(k, forceNoCache) {
    var token = k.value, fp = fpToken(token), cur = state.currentSeason || {}, S = root.WVSeasonStore;
    var acc = { token: token, fp: fp, label: k.label || k.name || ('Key ' + fp), name: k.name || k.label || ('Key ' + fp),
      tag: String(k.tag || '').toLowerCase(), aa: 0, rows: [], itemsById: new Map(), pinned: {}, marks: {}, isOnline: undefined, lastPlayedChar: null };
    try { if (S) { acc.pinned = S.getPinned(cur.year, cur.seq, fp) || {}; acc.marks = S.getMarks(cur.year, cur.seq, fp) || {}; } } catch (_) {}
    return Promise.resolve().then(function () { return root.GW2Api.getWVShopMerged(token, { nocache: !!forceNoCache }); }).then(function (pkg) {
      acc.aa = Number(pkg && pkg.aa || 0);
      acc.itemsById = (pkg && pkg.itemsById) || new Map();
      acc.rows = Array.isArray(pkg && pkg.rows) ? pkg.rows : [];
      return Promise.resolve().then(function () { return root.GW2Api.getAccountInfo(token, { nocache: !!forceNoCache }); }).then(function (info) {
        acc.isOnline = !!root.GW2Api.isRecentlyActive(info, 10);
        if (acc.isOnline && info && info.last_modified) acc.lastPlayedChar = 'Actividad hace ' + Math.floor((Date.now() - new Date(info.last_modified)) / 60000) + ' min';
      }, function (e) { if (root.console) root.console.warn(LOG, 'online', acc.name, e); });
    }, function (e) {
      if (root.console) root.console.warn(LOG, 'tienda', acc.name, e);
      acc.error = (e && e.message) || 'Error';
    }).then(function () { return acc; });
  }

  function loadAll(forceNoCache) {
    var keys = loadKeys().filter(function (k) { return k && k.value; });
    if (!keys.length) {
      state.accounts = []; state.loading = false;
      state.error = 'Todavía no agregaste cuentas: sumalas en Cuentas para ver sus compras fijadas.';
      render();
      return Promise.resolve();
    }
    state.loading = true;
    state.error = null;
    render();
    return initCurrentSeason().then(function () {
      var out = [], chain = Promise.resolve();
      for (var i = 0; i < keys.length; i += 2) {
        (function (batch) {
          chain = chain.then(function () { return Promise.all(batch.map(function (k) { return loadAccount(k, forceNoCache); })).then(function (r) { out = out.concat(r); }); });
        })(keys.slice(i, i + 2));
      }
      return chain.then(function () { return out; });
    }).then(function (out) {
      state.accounts = out;
      state.syncedAt = hhmm(new Date());
      state.loading = false;
      state.status = '';
      render();
      lazyItemIcons();
    }, function (e) {
      state.loading = false;
      state.error = 'No se pudieron leer las compras: ' + ((e && e.message) || 'error desconocido');
      render();
    });
  }

  function safeRefresh(forceNoCache) {
    var mySeq = ++_refreshSeq;
    var wait = _refreshInFlight ? _refreshInFlight.catch(function () {}) : Promise.resolve();
    return wait.then(function () {
      if (mySeq !== _refreshSeq) return null;
      _refreshInFlight = loadAll(!!forceNoCache);
      return _refreshInFlight.then(function () { if (mySeq === _refreshSeq) _refreshInFlight = null; });
    });
  }

  // ------------------------------------------------------------------ API pública
  var WVPurchaseDetail = {
    version: VERSION,

    initOnce: function () {
      if (state.inited) return Promise.resolve();
      state.inited = true;
      ensurePanel();
      if (doc && doc.addEventListener) {
        doc.addEventListener('gn:nav-active', function (ev) {
          try {
            var h = String(ev && ev.detail && ev.detail.hash || '').toLowerCase();
            if (h !== '#/account/wizards-vault') return;
            var myToken = ++_refreshSeq;
            if (localStorage.getItem('wvpd_open') === '1') {
              requestAnimationFrame(function () { if (myToken === _refreshSeq) WVPurchaseDetail.show(); });
            }
          } catch (_) {}
        });
      }
      if (root.addEventListener) {
        root.addEventListener('storage', function (e) {
          if (e && e.key && e.key.indexOf('wv:season:') === 0) rereadStore(false);
        });
        root.addEventListener('wv:season-store:mutate', function () { rereadStore(false); });
        // La vista llega por el manifiesto: si la Cámara ya estaba abierta, se pinta al llegar.
        if (doc && doc.addEventListener) doc.addEventListener('gn:boot-ready', function () { if (isOpen()) render(); });
      }
      ['wvTabBtnDaily', 'wvTabBtnWeekly', 'wvTabBtnSpecial', 'wvTabBtnShop'].forEach(function (id) {
        var b = byId(id);
        if (b && !b.__wvpdWired) {
          b.__wvpdWired = true;
          b.addEventListener('click', function () { try { WVPurchaseDetail.hide(); } catch (_) {} });
        }
      });
      return Promise.resolve();
    },

    show: function () {
      return this.initOnce().then(function () {
        try { localStorage.setItem('wvpd_open', '1'); } catch (_) {}
        setTabsVisible(false);
        var p = ensurePanel();
        if (p) { p.hidden = false; p.removeAttribute('hidden'); p.style.display = 'block'; }
        if (root.Analytics && root.Analytics.viewModule) { try { root.Analytics.viewModule('wv_purchases'); } catch (_) {} }
        if (!state.accounts.length && !state.loading) return safeRefresh(false);
        render();
        return null;
      });
    },

    hide: function () {
      try { localStorage.setItem('wvpd_open', '0'); } catch (_) {}
      setTabsVisible(true);
      try { if (root.WV && typeof root.WV.setActiveTab === 'function') root.WV.setActiveTab(state.prevTab || 'shop'); } catch (_) {}
      state.menuOpen = false;
      var p = ensurePanel();
      if (p) { p.setAttribute('hidden', ''); p.style.display = 'none'; }
    },

    refresh: function (forceNoCache) { return safeRefresh(!!forceNoCache); },

    // Exponer función pública para actualizar estado online
    refreshOnlineStatus: refreshAllOnlineStatus,

    _debug: function () { return state; },
    _act: { setMark: setMark, runAction: runAction, runUndo: runUndo, rereadStore: rereadStore, render: render, fpToken: fpToken }
  };

  root.WVPurchaseDetail = WVPurchaseDetail;

  if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { WVPurchaseDetail.initOnce(); });
  else if (doc) WVPurchaseDetail.initOnce();

  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
