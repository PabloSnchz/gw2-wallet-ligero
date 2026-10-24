/*!
 * js/wv-objectives-dashboard.js — Cámara del Brujo: Todas las cuentas → Objetivos semanales (BL-064, CAM-4)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 2.0.0 (2026-10-24)
 *
 * Matriz de objetivos semanales de todas las cuentas: filas = cuentas, columnas =
 * objetivos, celdas = estado. API de siempre para router.js y wv-view.js:
 * activate, deactivate, refresh y _debug.
 *
 * 2.0.0 (CAM-4):
 *  - Sin título ni cuenta regresiva propios: los pone la cabecera de la Cámara (CAM-1).
 *  - 4 números: Reclamados, Listos sin reclamar (con la AA que suman), Cuenta más
 *    atrasada y Cuentas al día.
 *  - Celdas con estado en texto para lectores de pantalla y leyenda visible:
 *    Reclamado (verde), Listo para reclamar (dorado), En curso (barra), Sin empezar.
 *  - «Solo con pendientes» y orden: más atrasada, nombre o como en Cuentas.
 *  - Columna Total por cuenta y fila de listos por objetivo.
 *  - Íconos de cuenta como en Cartera, sin azar (el mismo ícono en cada visita).
 *  - Estilos con clases wvd-* y tokens del GDS; nada de estilos en línea ni emoji.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var LOG = '[WV-ObjDashboard]';
  var MAX_PARALLEL = 3;
  var MODE_LABEL = { pve: 'PvE', pvp: 'PvP', wvw: 'WvW' };
  var MODE_ORDER = { pve: 0, pvp: 1, wvw: 2 };
  var TAG_LABEL = { main: 'main', alter: 'alter', f2p: 'f2p' };
  var ACCOUNT_TYPE_ICONS = {
    main: 'assets/icons/Cuentas/547827.png',
    alter: 'assets/icons/Cuentas/157375.png',
    f2p: 'assets/icons/Cuentas/102538.png'
  };
  var DECORATIVE_ICONS = ['1770678', '1770679', '1770680', '1770681', '1770682', '1770683', '1770684', '1770685', '1770686'];
  var SORTS = [['late', 'más atrasada'], ['name', 'nombre'], ['keys', 'como en Cuentas']];
  var STATUS_TXT = { claimed: 'Reclamado', ready: 'Listo para reclamar', run: 'En curso', none: 'Sin empezar', nodata: 'Sin datos' };

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function fmtInt(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s;
  }

  function modeOf(track) {
    var t = String(track || '').toLowerCase();
    if (t.indexOf('pvp') >= 0) return 'pvp';
    if (t.indexOf('wvw') >= 0) return 'wvw';
    return 'pve';
  }

  // Misma forma que wv-objectives-ui.js.
  function normalizeObjectives(raw) {
    var arr = (raw && Array.isArray(raw.objectives)) ? raw.objectives : [];
    return arr.map(function (o) {
      var id = (o.id != null ? o.id : (o.objective_id != null ? o.objective_id : null));
      var track = String(o.track || '').toLowerCase();
      var progress = Number(o.progress_current != null ? o.progress_current : (o.progress != null ? o.progress : 0)) || 0;
      var total = Number(o.progress_complete != null ? o.progress_complete : (o.total != null ? o.total : 0)) || 0;
      var acclaim = Number(o.acclaim != null ? o.acclaim : (o.rewardAA != null ? o.rewardAA : (o.reward_aa != null ? o.reward_aa : 0))) || 0;
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : (progress ? 100 : 0);
      return { id: id, title: o.title || o.name || ('Objetivo #' + id), track: track, mode: modeOf(track),
        progress: progress, total: total, acclaim: acclaim, claimed: !!o.claimed, pct: pct };
    });
  }

  function statusOf(o) {
    if (!o) return 'nodata';
    if (o.claimed) return 'claimed';
    if (o.pct >= 100) return 'ready';
    return o.progress > 0 ? 'run' : 'none';
  }

  // Objetivos únicos de todas las cuentas, por modo y título.
  function mergeObjectives(accounts) {
    var seen = {}, out = [];
    (accounts || []).forEach(function (a) {
      (a.objectives || []).forEach(function (o) {
        var k = String(o.id);
        if (seen[k]) return;
        seen[k] = true;
        out.push(o);
      });
    });
    out.sort(function (a, b) {
      var d = (MODE_ORDER[a.mode] || 0) - (MODE_ORDER[b.mode] || 0);
      return d || String(a.title).localeCompare(String(b.title), 'es');
    });
    return out;
  }

  function cellOf(acc, obj) {
    var list = acc.objectives || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(obj.id)) return list[i];
    return null;
  }

  // Números de una cuenta: done = reclamado o listo; ready = listo sin reclamar.
  function accountSummary(acc, objectives) {
    var s = { total: 0, claimed: 0, ready: 0, readyAA: 0, done: 0 };
    (objectives || []).forEach(function (obj) {
      var c = cellOf(acc, obj), st = statusOf(c);
      if (st === 'nodata') return;
      s.total++;
      if (st === 'claimed') { s.claimed++; s.done++; }
      else if (st === 'ready') { s.ready++; s.done++; s.readyAA += c.acclaim; }
    });
    return s;
  }

  function summarize(accounts, objectives) {
    var k = { cells: 0, claimed: 0, ready: 0, readyAA: 0, readyAccounts: 0, upToDate: 0, readable: 0, latest: null };
    (accounts || []).forEach(function (a) {
      if (a.error) return;
      var s = accountSummary(a, objectives);
      k.readable++;
      k.cells += s.total;
      k.claimed += s.claimed;
      k.ready += s.ready;
      k.readyAA += s.readyAA;
      if (s.ready) k.readyAccounts++;
      if (s.total && s.claimed === s.total) k.upToDate++;
      var ratio = s.total ? s.done / s.total : 1;
      if (s.total && (!k.latest || ratio < k.latest.ratio)) k.latest = { name: a.name, done: s.done, total: s.total, ratio: ratio };
    });
    if (k.latest && k.latest.ratio >= 1) k.latest = null;
    return k;
  }

  // Filtro «Solo con pendientes» y orden de las filas.
  function arrangeRows(accounts, objectives, o) {
    o = o || {};
    var rows = (accounts || []).map(function (a, i) { return { a: a, i: i, s: accountSummary(a, objectives) }; });
    if (o.pendingOnly) rows = rows.filter(function (r) { return r.a.error || r.s.claimed < r.s.total; });
    rows.sort(function (x, y) {
      if (o.sort === 'name') return String(x.a.name).localeCompare(String(y.a.name), 'es');
      if (o.sort === 'late') {
        var rx = x.s.total ? x.s.done / x.s.total : 2, ry = y.s.total ? y.s.done / y.s.total : 2;
        return (rx - ry) || (x.i - y.i);
      }
      return x.i - y.i;
    });
    return rows.map(function (r) { return r.a; });
  }

  // Ícono de la cuenta: por tipo, o uno decorativo fijo según la key (antes era al azar).
  function accountIcon(tag, token) {
    if (ACCOUNT_TYPE_ICONS[tag]) return ACCOUNT_TYPE_ICONS[tag];
    var t = String(token || 'anon'), h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return 'assets/icons/Cuentas/' + DECORATIVE_ICONS[h % DECORATIVE_ICONS.length] + '.png';
  }

  // ------------------------------------------------------------------ HTML
  function aa(n) { return '+' + fmtInt(n) + '<span class="wvd-aa">AA</span>'; }

  function statsHTML(k, accountsCount) {
    var pct = k.cells ? Math.round(k.claimed * 100 / k.cells) : 0;
    return '<div class="wvd-stats">' +
      '<div class="wvd-st"><small>Reclamados</small><b>' + k.claimed + ' <span>de ' + k.cells + '</span></b>' +
        '<div class="wvd-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="wvd-st"><small>Listos sin reclamar</small><b class="wvd-gold">' + k.ready + '</b><em>' +
        (k.ready ? aa(k.readyAA) + ' en ' + k.readyAccounts + (k.readyAccounts === 1 ? ' cuenta' : ' cuentas') : 'nada para cobrar') + '</em></div>' +
      '<div class="wvd-st"><small>Cuenta más atrasada</small>' +
        (k.latest ? '<b class="wvd-sm">' + esc(k.latest.name) + '</b><em>' + k.latest.done + ' de ' + k.latest.total + '</em>' : '<b class="wvd-sm">—</b><em>todas al día</em>') + '</div>' +
      '<div class="wvd-st"><small>Cuentas al día</small><b>' + k.upToDate + ' <span>de ' + accountsCount + '</span></b><em>todo reclamado esta semana</em></div>' +
      '</div>';
  }

  var LEGEND = '<div class="wvd-lgd" aria-hidden="true"><span><i class="wvd-dot wvd-dot--claimed"></i>Reclamado</span>' +
    '<span><i class="wvd-dot wvd-dot--ready"></i>Listo para reclamar</span>' +
    '<span><i class="wvd-mini"><i style="width:60%"></i></i>En curso</span>' +
    '<span><i class="wvd-dot wvd-dot--none"></i>Sin empezar</span></div>';

  function toolHTML(o) {
    return '<div class="wvd-tool">' +
      '<button type="button" class="wvd-chip" data-wvd-pending aria-pressed="' + !!o.pendingOnly + '">Solo con pendientes</button>' +
      '<label class="wvd-sel">Orden: <select data-wvd-sort aria-label="Ordenar cuentas">' + SORTS.map(function (s) {
        return '<option value="' + s[0] + '"' + (o.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
      }).join('') + '</select></label>' +
      (o.syncedAt ? '<small class="wvd-sync">Datos de la API de las ' + esc(o.syncedAt) + '</small>' : '') +
      '</div>';
  }

  function cellHTML(c) {
    var st = statusOf(c);
    if (st === 'nodata') return '<td class="wvd-c wvd-c--nodata"><span class="wvd-sr">' + STATUS_TXT.nodata + '</span><span aria-hidden="true">—</span></td>';
    var prog = c.total ? c.progress + ' / ' + c.total : String(c.progress);
    var lbl = STATUS_TXT[st] + ' · ' + prog;
    var mark = st === 'run'
      ? '<i class="wvd-mini" aria-hidden="true"><i style="width:' + c.pct + '%"></i></i>'
      : '<i class="wvd-dot wvd-dot--' + st + '" aria-hidden="true"></i>';
    return '<td class="wvd-c wvd-c--' + st + '" title="' + esc(lbl) + '">' + mark + '<span class="wvd-sr">' + esc(lbl) + '</span></td>';
  }

  function matrixHTML(rows, objectives) {
    if (!objectives.length) return '<p class="wvd-empty">Ninguna cuenta tiene objetivos semanales todavía.</p>';
    if (!rows.length) return '<p class="wvd-empty">Todas las cuentas tienen todo reclamado esta semana.</p>';
    var h = ['<div class="wvd-wrap"><table class="wvd-t"><caption class="wvd-sr">Objetivos semanales de todas las cuentas</caption><thead><tr><th scope="col" class="wvd-acc">Cuenta</th>'];
    objectives.forEach(function (o) {
      h.push('<th scope="col" title="' + esc(o.title) + '"><span class="wvd-md wvd-md--' + o.mode + '">' + MODE_LABEL[o.mode] + '</span>' +
        '<span class="wvd-ot">' + esc(o.title) + '</span>' + (o.acclaim ? '<span class="wvd-oa">' + aa(o.acclaim) + '</span>' : '') + '</th>');
    });
    h.push('<th scope="col" class="wvd-tot">Total</th></tr></thead><tbody>');
    rows.forEach(function (a) {
      var s = accountSummary(a, objectives);
      h.push('<tr' + (a.error ? ' class="wvd-err"' : '') + '><th scope="row" class="wvd-acc"><span class="wvd-an">' +
        '<img src="' + esc(accountIcon(a.tag, a.token)) + '" alt="" width="24" height="24" loading="lazy">' +
        '<span>' + esc(a.name) + (TAG_LABEL[a.tag] ? '<small>' + TAG_LABEL[a.tag] + '</small>' : '') + '</span></span>' +
        (a.error ? '<em class="wvd-warn">No se pudo leer</em>' : '') + '</th>');
      objectives.forEach(function (o) { h.push(cellHTML(a.error ? null : cellOf(a, o))); });
      h.push('<td class="wvd-tot">' + (a.error ? '—' : s.claimed + ' / ' + s.total + (s.ready ? '<small class="wvd-gold">' + s.ready + (s.ready === 1 ? ' listo' : ' listos') + '</small>' : '')) + '</td></tr>');
    });
    h.push('</tbody><tfoot><tr><th scope="row" class="wvd-acc">Listos por cobrar</th>');
    objectives.forEach(function (o) {
      var n = 0;
      rows.forEach(function (a) { if (!a.error && statusOf(cellOf(a, o)) === 'ready') n++; });
      h.push('<td class="wvd-c">' + (n ? '<b class="wvd-gold">' + n + '</b>' : '<span aria-hidden="true">·</span><span class="wvd-sr">ninguno</span>') + '</td>');
    });
    h.push('<td class="wvd-tot"></td></tr></tfoot></table></div>');
    return h.join('');
  }

  function viewHTML(st) {
    if (st.loading && !st.accounts.length) {
      return '<div class="wvd"><p class="wvd-empty" role="status">Leyendo los objetivos semanales de tus cuentas…</p>' +
        '<div class="skeleton skeleton--block wvd-sk"></div></div>';
    }
    if (st.error && !st.accounts.length) {
      return '<div class="wvd"><p class="wvd-empty" role="alert">' + esc(st.error) + '</p>' +
        '<button type="button" class="wvd-chip" data-wvd-retry>Reintentar</button></div>';
    }
    var k = summarize(st.accounts, st.objectives);
    var rows = arrangeRows(st.accounts, st.objectives, st.view);
    var failed = st.accounts.length - k.readable;
    return '<div class="wvd">' + statsHTML(k, st.accounts.length) +
      toolHTML({ pendingOnly: st.view.pendingOnly, sort: st.view.sort, syncedAt: st.syncedAt }) +
      (failed ? '<p class="wvd-note" role="status">' + failed + (failed === 1 ? ' cuenta no se pudo leer' : ' cuentas no se pudieron leer') +
        ': tocá «↻ Actualizar» arriba para reintentar.</p>' : '') +
      LEGEND + matrixHTML(rows, st.objectives) + '</div>';
  }

  var CSS = [
    '.wvd{padding:0 0 12px}',
    '.wvd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.wvd-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}',
    '.wvd-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 12px;min-width:0}',
    '.wvd-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.wvd-st b{font-size:1.25rem;color:var(--tx-1)}.wvd-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.wvd-st b.wvd-sm{display:block;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.wvd-st em{display:block;font-style:normal;font-size:.76rem;color:var(--tx-2);margin-top:2px}',
    '.wvd-gold{color:var(--color-amber,#F2B94B)!important}',
    '.wvd-bar{height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin-top:7px}.wvd-bar i{display:block;height:100%;background:var(--color-green,#3CC48A)}',
    '.wvd-aa{font-size:.62rem;font-weight:800;margin-left:2px;color:#4FC3D9}',
    '.wvd-tool{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}',
    '.wvd-chip{font:inherit;font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:6px 12px;background:transparent;color:var(--tx-2);cursor:pointer;min-height:34px}',
    '.wvd-chip[aria-pressed=true]{border-color:var(--acc-1);color:var(--tx-1);background:var(--bg-2);font-weight:600}',
    '.wvd-sel{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:var(--tx-2);border:1px solid var(--bd-1);border-radius:999px;padding:2px 4px 2px 12px}',
    '.wvd-sel select{font:inherit;background:transparent;color:var(--tx-1);border:0;padding:5px}',
    '.wvd-sync{margin-left:auto;color:var(--tx-2);font-size:.76rem}',
    '.wvd-note{margin:0 0 8px;font-size:.84rem;color:var(--color-amber,#F2B94B)}',
    '.wvd-empty{color:var(--tx-2);font-size:.9rem;margin:14px 0}.wvd-sk{height:220px;border-radius:12px}',
    '.wvd-lgd{display:flex;flex-wrap:wrap;gap:14px;font-size:.76rem;color:var(--tx-2);margin:0 0 8px}.wvd-lgd>span{display:inline-flex;align-items:center;gap:6px}',
    '.wvd-dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--bd-2);box-sizing:border-box}',
    '.wvd-dot--claimed{background:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A)}',
    '.wvd-dot--ready{background:var(--color-amber,#F2B94B);border-color:var(--color-amber,#F2B94B);box-shadow:0 0 0 3px color-mix(in srgb,var(--color-amber,#F2B94B) 25%,transparent)}',
    '.wvd-dot--none{background:transparent}',
    '.wvd-mini{display:inline-block;width:34px;height:6px;border-radius:4px;background:var(--bg-2);overflow:hidden;vertical-align:middle}.wvd-mini>i{display:block;height:100%;background:var(--acc-1)}',
    '.wvd-wrap{overflow-x:auto;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1)}',
    '.wvd-t{border-collapse:separate;border-spacing:0;width:100%;font-size:.84rem}',
    '.wvd-t th,.wvd-t td{border-bottom:1px solid var(--bd-1);padding:8px 10px;color:var(--tx-1)}',
    '.wvd-t thead th{vertical-align:bottom;text-align:center;font-weight:500;min-width:96px;max-width:140px}',
    '.wvd-md{display:inline-block;font-size:.62rem;font-weight:800;border:1px solid currentColor;border-radius:6px;padding:1px 6px}',
    '.wvd-md--pve{color:var(--color-green,#3CC48A)}.wvd-md--pvp{color:var(--color-red,#F47C7C)}.wvd-md--wvw{color:var(--color-amber,#F2B94B)}',
    '.wvd-ot{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.76rem;line-height:1.25;margin-top:4px;color:var(--tx-1)}',
    '.wvd-oa{display:block;font-size:.72rem;color:var(--tx-2);margin-top:2px}',
    '.wvd-acc{position:sticky;left:0;z-index:1;background:var(--bg-1);text-align:left!important;min-width:170px;font-weight:500}',
    '.wvd-t thead .wvd-acc{z-index:2;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.wvd-an{display:flex;align-items:center;gap:10px}.wvd-an img{border-radius:6px;flex-shrink:0}.wvd-an span{min-width:0}',
    '.wvd-an small{display:block;font-size:.7rem;color:var(--tx-2)}',
    '.wvd-warn{display:block;font-style:normal;font-size:.72rem;color:var(--color-amber,#F2B94B);margin-top:2px}',
    '.wvd-c{text-align:center}.wvd-c--nodata{color:var(--tx-2)}',
    '.wvd-tot{text-align:right;white-space:nowrap;font-weight:600}.wvd-tot small{display:block;font-size:.72rem;font-weight:600}',
    '.wvd-t tbody tr:hover>*{background:var(--bg-2)}',
    '.wvd-t tfoot th,.wvd-t tfoot td{border-bottom:0;font-size:.8rem;color:var(--tx-2)}',
    '.wvd button:focus-visible,.wvd select:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.wvd-stats{grid-template-columns:1fr 1fr;gap:6px}.wvd-st{padding:8px 10px}.wvd-st b{font-size:1.05rem}',
    '.wvd-chip{min-height:40px}.wvd-sync{margin-left:0;flex-basis:100%}.wvd-acc{min-width:128px}.wvd-t thead th{min-width:84px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado y DOM
  var doc = root.document;
  var state = { accounts: [], objectives: [], loading: false, error: null, syncedAt: '', view: { pendingOnly: false, sort: 'late' } };
  var _inflight = null;

  function host() { return doc ? doc.getElementById('wvObjectivesDashboardPanel') : null; }

  function ensureCss() {
    if (!doc || !doc.head || doc.getElementById('wv-objectives-dashboard-css')) return;
    var s = doc.createElement('style');
    s.id = 'wv-objectives-dashboard-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function render() {
    var h = host();
    if (!h) return;
    ensureCss();
    wire(h);
    h.innerHTML = viewHTML(state);
  }

  function wire(h) {
    if (h.__wvdWired || !h.addEventListener) return;
    h.__wvdWired = true;
    h.addEventListener('click', function (e) {
      for (var n = e.target, i = 0; n && i < 4; n = n.parentNode, i++) {
        if (!n.hasAttribute) continue;
        if (n.hasAttribute('data-wvd-pending')) {
          state.view.pendingOnly = !state.view.pendingOnly;
          render();
          var b = h.querySelector && h.querySelector('[data-wvd-pending]');
          if (b && b.focus) b.focus();
          return;
        }
        if (n.hasAttribute('data-wvd-retry')) { loadData(true); return; }
      }
    });
    h.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.hasAttribute || !t.hasAttribute('data-wvd-sort')) return;
      state.view.sort = t.value;
      render();
    });
  }

  function hhmm(d) {
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  // Lista de cuentas: lectura cruda TOLERADA de la legacy gw2_keys
  // (idea61 la vigila por par: 'wv-objectives-dashboard.js[gw2_keys]').
  function readKeys() {
    try { return JSON.parse(localStorage.getItem('gw2_keys') || '[]') || []; } catch (_) { return []; }
  }

  function loadData(forceNoCache) {
    if (_inflight) return _inflight;
    var keys = readKeys().filter(function (k) { return k && k.value; });
    if (!keys.length) {
      state.accounts = []; state.objectives = []; state.loading = false;
      state.error = 'Todavía no agregaste cuentas: sumalas en Cuentas para ver sus objetivos semanales.';
      render();
      return Promise.resolve();
    }
    state.loading = true;
    state.error = null;
    render();

    function one(k) {
      var token = k.value;
      var base = { token: token, tag: String(k.tag || '').toLowerCase(), name: k.name || k.label || (token.slice(0, 4) + '…' + token.slice(-4)) };
      return Promise.resolve().then(function () {
        return root.GW2Api.getWVWeekly(token, { nocache: !!forceNoCache });
      }).then(function (data) {
        base.objectives = normalizeObjectives(data);
        return base;
      }, function (e) {
        if (root.console) root.console.warn(LOG, 'no se pudo leer', base.name, e);
        base.objectives = [];
        base.error = (e && e.message) || 'Error';
        return base;
      });
    }

    var accounts = [];
    var chain = Promise.resolve();
    for (var i = 0; i < keys.length; i += MAX_PARALLEL) {
      (function (batch) {
        chain = chain.then(function () {
          return Promise.all(batch.map(one)).then(function (r) { accounts = accounts.concat(r); });
        });
      })(keys.slice(i, i + MAX_PARALLEL));
    }
    _inflight = chain.then(function () {
      state.accounts = accounts;
      state.objectives = mergeObjectives(accounts);
      state.syncedAt = hhmm(new Date());
      state.loading = false;
      render();
    }, function (e) {
      state.loading = false;
      state.error = 'No se pudieron leer los objetivos: ' + ((e && e.message) || 'error desconocido');
      render();
    }).then(function () { _inflight = null; });
    return _inflight;
  }

  function activate() {
    var h = host();
    if (h) h.removeAttribute('hidden');
    if (root.Analytics && root.Analytics.viewModule) { try { root.Analytics.viewModule('wv_objectives_dashboard'); } catch (_) {} }
    if (!state.accounts.length && !state.loading) loadData(false);
    else render();
  }

  function deactivate() {
    var h = host();
    if (h) h.setAttribute('hidden', 'hidden');
    if (root.WV && typeof root.WV.hideObjectivesDashboard === 'function') root.WV.hideObjectivesDashboard();
  }

  function refresh(forceNoCache) { return loadData(!!forceNoCache); }

  root.WVObjectivesDashboard = {
    version: VERSION,
    activate: activate,
    deactivate: deactivate,
    refresh: refresh,
    _debug: function () { return state; },
    _pure: { normalizeObjectives: normalizeObjectives, statusOf: statusOf, mergeObjectives: mergeObjectives, accountSummary: accountSummary,
      summarize: summarize, arrangeRows: arrangeRows, accountIcon: accountIcon, statsHTML: statsHTML, matrixHTML: matrixHTML,
      cellHTML: cellHTML, viewHTML: viewHTML, CSS: CSS }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
