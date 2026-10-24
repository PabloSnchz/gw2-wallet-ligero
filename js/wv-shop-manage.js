/*!
 * js/wv-shop-manage.js — Cámara del Brujo: menú «Gestionar» de la Tienda (BL-064, CAM-3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Las tres acciones masivas que antes eran botones sueltos en la barra de la Tienda:
 *  - Ajustar marcas a la API: quita lo que el juego ya registró. Se puede deshacer.
 *  - Copiar mis fijados a las otras cuentas: agrega, no borra. Pide confirmación
 *    y se puede deshacer.
 *  - Quitar fijados de todas las cuentas: pide confirmación y se puede deshacer
 *    durante 10 segundos.
 * Se carga por js/modules.json (DEC-035). wv-shop-ui.js le pasa el contexto
 * (estado, cuentas, almacén de la temporada) con WVShopManage.run(acción, ctx).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var UNDO_SECONDS = 10;
  var ACTIONS = [
    { id: 'sync', label: 'Ajustar marcas a la API', desc: 'Quita lo que el juego ya registró' },
    { id: 'copy', label: 'Copiar mis fijados a las otras cuentas', desc: 'Agrega, no borra · pide confirmación' },
    { id: 'clear', label: 'Quitar fijados de todas las cuentas…', desc: 'Pide confirmación · se puede deshacer durante ' + UNDO_SECONDS + ' s', danger: true }
  ];

  // ------------------------------------------------------------------ puro
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  // Marcas que la API ya cubrió: si el juego registró todo, la marca va a 0;
  // si registró parte, la marca se recorta a lo que falta.
  function planSync(rows, marks) {
    var patch = {}, before = {}, n = 0;
    (rows || []).forEach(function (r) {
      var id = String(r.id), m = Number((marks || {})[id]) || 0;
      if (typeof r.purchase_limit !== 'number' || m <= 0) return;
      var api = Number(r.purchased) || 0, room = Math.max(0, r.purchase_limit - api);
      if (m > room) { patch[id] = room; before[id] = m; n++; }
    });
    return { patch: patch, before: before, count: n };
  }

  // Qué fijados nuevos recibe cada una de las otras cuentas.
  function planCopy(source, sourceFp, pinsByFp) {
    var ids = Object.keys(source || {}).filter(function (k) { return source[k]; });
    var byFp = {}, total = 0, accounts = 0;
    Object.keys(pinsByFp || {}).forEach(function (fp) {
      if (fp === sourceFp) return;
      var have = pinsByFp[fp] || {};
      var add = ids.filter(function (id) { return !have[id]; });
      if (add.length) { byFp[fp] = add; total += add.length; accounts++; }
    });
    return { ids: ids, byFp: byFp, total: total, accounts: accounts };
  }

  // Foto de los fijados de todas las cuentas, para quitarlos y poder devolverlos.
  function planClear(pinsByFp) {
    var byFp = {}, total = 0, accounts = 0;
    Object.keys(pinsByFp || {}).forEach(function (fp) {
      var ids = Object.keys(pinsByFp[fp] || {}).filter(function (k) { return pinsByFp[fp][k]; });
      if (ids.length) { byFp[fp] = ids; total += ids.length; accounts++; }
    });
    return { byFp: byFp, total: total, accounts: accounts };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function menuHTML() {
    return ACTIONS.map(function (a) {
      return (a.danger ? '<hr>' : '') + '<button type="button" role="menuitem" data-wvs-act="' + a.id + '"' + (a.danger ? ' class="wvs-danger"' : '') + '>' +
        esc(a.label) + '<small>' + esc(a.desc) + '</small></button>';
    }).join('');
  }

  // ------------------------------------------------------------------ deshacer
  var undo = { timer: null, host: null };

  function clearUndo() {
    if (undo.timer) { clearInterval(undo.timer); undo.timer = null; }
    if (undo.host) undo.host.innerHTML = '';
    undo.host = null;
  }

  function showUndo(ctx, msg, fn) {
    clearUndo();
    var host = ctx.undoHost;
    if (!host) return;
    undo.host = host;
    var left = UNDO_SECONDS;
    host.innerHTML = '<div class="wvs-undo" role="status"><span>' + esc(msg) + '</span>' +
      '<button type="button" class="wvs-btn" data-wvs-undo>Deshacer</button><small data-wvs-left>' + left + ' s</small></div>';
    var btn = host.querySelector('[data-wvs-undo]');
    if (btn) btn.addEventListener('click', function () {
      clearUndo();
      Promise.resolve().then(fn).then(function () {
        if (ctx.reload) ctx.reload();
        if (ctx.toast) ctx.toast('success', 'Listo: lo deshice', { ttl: 1800 });
      }, function () {
        if (ctx.toast) ctx.toast('error', 'No pude deshacerlo', { ttl: 2200 });
      });
    });
    undo.timer = setInterval(function () {
      left--;
      var s = host.querySelector('[data-wvs-left]');
      if (s) s.textContent = left + ' s';
      if (left <= 0) clearUndo();
    }, 1000);
  }

  // ------------------------------------------------------------------ acciones
  function pinsByFp(ctx) {
    var out = {}, S = ctx.store, y = ctx.season.year, q = ctx.season.seq;
    (ctx.accounts || []).forEach(function (a) { out[a.fp] = S.getPinned(y, q, a.fp) || {}; });
    if (!out[ctx.fp]) out[ctx.fp] = S.getPinned(y, q, ctx.fp) || {};
    return out;
  }

  function say(ctx, kind, msg, ttl) { if (ctx.toast) ctx.toast(kind, msg, { ttl: ttl || 2200 }); }

  function ask(ctx, msg) { return ctx.confirm ? !!ctx.confirm(msg) : false; }

  function runSync(ctx) {
    var st = ctx.state, plan = planSync(st.merged, st.marks);
    if (!plan.count) { say(ctx, 'info', 'No hay marcas para ajustar: la API no registró nada nuevo'); return Promise.resolve(false); }
    var S = ctx.store, y = ctx.season.year, q = ctx.season.seq;
    return Promise.resolve(S.setMarks(y, q, ctx.fp, plan.patch)).then(function () {
      st.marks = Object.assign({}, st.marks, plan.patch);
      ctx.render();
      showUndo(ctx, 'Ajusté ' + plural(plan.count, 'marca', 'marcas') + ' a lo que ya registró la API.', function () {
        return S.setMarks(y, q, ctx.fp, plan.before);
      });
      return true;
    });
  }

  function runCopy(ctx) {
    var all = pinsByFp(ctx);
    var plan = planCopy(all[ctx.fp], ctx.fp, all);
    if (!plan.ids.length) { say(ctx, 'info', 'Esta cuenta no tiene fijados para copiar'); return Promise.resolve(false); }
    if (!plan.total) { say(ctx, 'info', 'Las otras cuentas ya tienen todos tus fijados'); return Promise.resolve(false); }
    if (!ask(ctx, '¿Copiar tus ' + plural(plan.ids.length, 'fijado', 'fijados') + ' a ' + plural(plan.accounts, 'cuenta más', 'cuentas más') +
      '?\n\nSolo se agregan: no se borra nada. Vas a poder deshacerlo durante ' + UNDO_SECONDS + ' segundos.')) return Promise.resolve(false);
    var S = ctx.store, y = ctx.season.year, q = ctx.season.seq;
    var fps = Object.keys(plan.byFp);
    return Promise.all(fps.map(function (fp) {
      var patch = {};
      plan.byFp[fp].forEach(function (id) { patch[id] = true; });
      return S.setPinned(y, q, fp, patch);
    })).then(function () {
      say(ctx, 'success', 'Copié ' + plural(plan.total, 'fijado', 'fijados') + ' a ' + plural(plan.accounts, 'cuenta', 'cuentas'));
      showUndo(ctx, 'Copié tus fijados a ' + plural(plan.accounts, 'cuenta', 'cuentas') + '.', function () {
        return Promise.all(fps.map(function (fp) { return S.delPinned(y, q, fp, plan.byFp[fp]); }));
      });
      return true;
    });
  }

  function runClear(ctx) {
    var plan = planClear(pinsByFp(ctx));
    if (!plan.total) { say(ctx, 'info', 'No hay fijados para quitar'); return Promise.resolve(false); }
    if (!ask(ctx, '¿Quitar ' + plural(plan.total, 'fijado', 'fijados') + ' de ' + plural(plan.accounts, 'cuenta', 'cuentas') +
      ' en esta temporada?\n\nVas a poder deshacerlo durante ' + UNDO_SECONDS + ' segundos.')) return Promise.resolve(false);
    var S = ctx.store, y = ctx.season.year, q = ctx.season.seq;
    var fps = Object.keys(plan.byFp);
    return Promise.all(fps.map(function (fp) { return S.delPinned(y, q, fp, plan.byFp[fp]); })).then(function () {
      if (plan.byFp[ctx.fp]) { ctx.state.pinned = {}; ctx.render(); }
      showUndo(ctx, 'Quité ' + plural(plan.total, 'fijado', 'fijados') + ' de ' + plural(plan.accounts, 'cuenta', 'cuentas') + '.', function () {
        return Promise.all(fps.map(function (fp) {
          var patch = {};
          plan.byFp[fp].forEach(function (id) { patch[id] = true; });
          return S.setPinned(y, q, fp, patch);
        }));
      });
      return true;
    });
  }

  var RUN = { sync: runSync, copy: runCopy, clear: runClear };

  function run(id, ctx) {
    if (!RUN[id] || !ctx || !ctx.state) return Promise.resolve(false);
    if (!ctx.store || !ctx.season) { say(ctx, 'error', 'No pude abrir las marcas de esta temporada'); return Promise.resolve(false); }
    return RUN[id](ctx).catch(function (e) {
      say(ctx, 'error', 'No se pudo completar: ' + ((e && e.message) || 'error desconocido'), 2600);
      if (ctx.reload) ctx.reload();
      return false;
    });
  }

  root.WVShopManage = {
    version: VERSION,
    ACTIONS: ACTIONS,
    menuHTML: menuHTML,
    run: run,
    _pure: { planSync: planSync, planCopy: planCopy, planClear: planClear, UNDO_SECONDS: UNDO_SECONDS }
  };
  if (root.console && root.console.info) root.console.info('[WV-ShopManage] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
