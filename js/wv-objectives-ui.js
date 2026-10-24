/*!
 * js/wv-objectives-ui.js — Cámara del Brujo: objetivos (BL-064, CAM-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 2.0.0 (2026-10-23)
 *
 * Pinta los objetivos diarios, semanales y especiales que le pasa router.js
 * (window.WV). Contrato de siempre: renderTab(host, data, kind) y renderZero(kind),
 * y guarda la lista normalizada con WV.__setObjState (la usan otros módulos).
 *
 * 2.0.0 (CAM-2):
 *  - Filas agrupadas: primero «Listos para reclamar» (con la AA que suman), después
 *    «En curso» (los más avanzados arriba) y al final «Reclamados», plegados.
 *  - Filtro por modo (Todos, PvE, PvP, WvW) cuando la pestaña mezcla modos.
 *  - «Meta de la temporada» pasa a llamarse por lo que es: la recompensa del día
 *    o de la semana.
 *  - Estados con texto, nunca solo color ni emoji; colores del GDS.
 *  - Clases nuevas (wvo-*): wv-theme.js ya no pinta bordes sobre estas filas.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';
  var LOG = '[WV-ObjectivesUI]';
  var MODES = ['pve', 'pvp', 'wvw'];
  var MODE_LABEL = { pve: 'PvE', pvp: 'PvP', wvw: 'WvW' };
  var META_LABEL = { daily: 'Recompensa del día', weekly: 'Recompensa de la semana', special: 'Recompensa especial' };
  var HOST_ID = { daily: 'wvTabDaily', weekly: 'wvTabWeekly', special: 'wvTabSpecial' };

  // Filtro y plegado: viven en memoria mientras la página está abierta.
  var st = { mode: 'all', claimedOpen: false, cache: {} };

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

  // Misma forma que antes (la leen router.js y el dashboard) más el modo.
  function normalizeObjectives(raw) {
    var arr = (raw && Array.isArray(raw.objectives)) ? raw.objectives : [];
    return arr.map(function (o) {
      var id = (o.id != null ? o.id : (o.objective_id != null ? o.objective_id : null));
      var title = o.title || o.name || ('Objetivo #' + id);
      var track = String(o.track || '').toLowerCase();
      var progress = Number(o.progress_current != null ? o.progress_current : (o.progress != null ? o.progress : 0)) || 0;
      var total = Number(o.progress_complete != null ? o.progress_complete : (o.total != null ? o.total : 0)) || 0;
      var acclaim = Number(o.acclaim != null ? o.acclaim : (o.rewardAA != null ? o.rewardAA : (o.reward_aa != null ? o.reward_aa : 0))) || 0;
      var claimed = !!o.claimed;
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : (progress ? 100 : 0);
      return { id: id, title: title, track: track, mode: modeOf(track), progress: progress, total: total, acclaim: acclaim, claimed: claimed, pct: pct };
    });
  }

  function statusOf(o) {
    if (o.claimed) return 'claimed';
    return o.pct >= 100 ? 'ready' : 'run';
  }

  // Cuántos hay de cada modo (sin filtrar).
  function modeCounts(list) {
    var c = { all: list.length, pve: 0, pvp: 0, wvw: 0 };
    list.forEach(function (o) { c[o.mode || modeOf(o.track)]++; });
    return c;
  }

  // El filtro solo aplica si la pestaña tiene objetivos de ese modo.
  function effectiveMode(list, mode) {
    if (mode === 'all' || MODES.indexOf(mode) < 0) return 'all';
    return modeCounts(list)[mode] ? mode : 'all';
  }

  // Grupos en el orden de lo que se puede hacer ya.
  function groupObjectives(list, mode) {
    var g = { ready: [], run: [], claimed: [], readyAA: 0 };
    list.forEach(function (o) {
      if (mode !== 'all' && (o.mode || modeOf(o.track)) !== mode) return;
      g[statusOf(o)].push(o);
    });
    g.run.sort(function (a, b) { return b.pct - a.pct; });
    g.ready.forEach(function (o) { g.readyAA += o.acclaim; });
    return g;
  }

  function metaInfo(data, kind) {
    if (!data || typeof data.meta_progress_current !== 'number' || typeof data.meta_progress_complete !== 'number') return null;
    var cur = data.meta_progress_current, tot = data.meta_progress_complete;
    return {
      label: META_LABEL[kind] || 'Recompensa de la pestaña',
      cur: cur, total: tot, reward: Number(data.meta_reward_astral) || 0,
      pct: tot > 0 ? Math.max(0, Math.min(100, Math.round(cur * 100 / tot))) : 0,
      done: tot > 0 && cur >= tot
    };
  }

  // ------------------------------------------------------------------ HTML
  function aa(n) { return '+' + fmtInt(n) + '<span class="wvo-aa">AA</span>'; }

  function bar(pct, gold) {
    return '<div class="wvo-bar' + (gold ? ' wvo-bar--gold' : '') + '" aria-hidden="true"><i style="width:' + pct + '%"></i></div>';
  }

  function metaHTML(m) {
    if (!m) return '';
    var note = m.done
      ? 'Completa' + (m.reward ? ' · ' + aa(m.reward) + ' extra' : '')
      : fmtInt(m.cur) + ' de ' + fmtInt(m.total) + (m.reward ? ' · al completarla, ' + aa(m.reward) + ' extra' : '');
    return '<div class="wvo-meta"><b>' + esc(m.label) + '</b>' + bar(m.pct, true) + '<small>' + note + '</small></div>';
  }

  var STATUS_TXT = { ready: 'Listo para reclamar', claimed: 'Reclamado' };

  function rowHTML(o) {
    var s = statusOf(o), mode = o.mode || modeOf(o.track);
    var prog = o.total ? fmtInt(o.progress) + ' / ' + fmtInt(o.total) : fmtInt(o.progress);
    var txt = s === 'run' ? 'En curso · ' + o.pct + ' %' : STATUS_TXT[s];
    return '<li class="wvo-row wvo-row--' + s + '" data-mode="' + mode + '">' +
      '<span class="wvo-mode wvo-mode--' + mode + '">' + MODE_LABEL[mode] + '</span>' +
      '<div class="wvo-t">' + esc(o.title) + '<small>' + prog + '</small></div>' +
      bar(o.pct, s === 'ready') +
      '<span class="wvo-rw">' + (o.acclaim ? aa(o.acclaim) : '') + '</span>' +
      '<span class="wvo-st wvo-st--' + s + '">' + txt + '</span></li>';
  }

  function listHTML(arr) {
    return '<ul class="wvo-list">' + arr.map(rowHTML).join('') + '</ul>';
  }

  function toolHTML(list, mode) {
    var c = modeCounts(list);
    var present = MODES.filter(function (k) { return c[k] > 0; });
    if (present.length < 2) return '';
    var h = ['<div class="wvo-tool" role="group" aria-label="Filtrar por modo">'];
    ['all'].concat(present).forEach(function (k) {
      var on = mode === k;
      h.push('<button type="button" class="wvo-chip' + (k !== 'all' ? ' wvo-chip--' + k : '') + '" data-wvo-mode="' + k + '" aria-pressed="' + on + '">' +
        (k === 'all' ? 'Todos' : MODE_LABEL[k]) + '<em>' + c[k] + '</em></button>');
    });
    h.push('</div>');
    return h.join('');
  }

  // Vista completa de una pestaña. opts: { mode, claimedOpen, zero }
  function viewHTML(list, data, kind, opts) {
    opts = opts || {};
    var mode = effectiveMode(list, opts.mode);
    var g = groupObjectives(list, mode);
    var h = ['<div class="wvo">'];
    if (opts.zero) h.push('<p class="wvo-note">Reseteado: esperando el progreso nuevo…</p>');
    h.push(toolHTML(list, mode));
    h.push(metaHTML(metaInfo(data, kind)));
    if (g.ready.length) {
      h.push('<h3 class="wvo-grp wvo-grp--ready">Listos para reclamar · ' + g.ready.length +
        '<span>' + (g.readyAA ? aa(g.readyAA) + ' · ' : '') + 'se cobran dentro del juego</span></h3>');
      h.push(listHTML(g.ready));
    }
    if (g.run.length) {
      h.push('<h3 class="wvo-grp">En curso · ' + g.run.length + '</h3>');
      h.push(listHTML(g.run));
    }
    if (!g.ready.length && !g.run.length && g.claimed.length) {
      h.push('<p class="wvo-empty">Todo reclamado en esta pestaña.</p>');
    }
    if (g.claimed.length) {
      h.push('<details class="wvo-done"' + (opts.claimedOpen ? ' open' : '') + '><summary class="wvo-grp wvo-grp--claimed">Reclamados · ' +
        g.claimed.length + '</summary>' + listHTML(g.claimed) + '</details>');
    }
    h.push('</div>');
    return h.join('');
  }

  var CSS = [
    '.wvo{margin-top:4px}',
    '.wvo-note{margin:0 0 10px;font-size:.84rem;color:var(--tx-2)}',
    '.wvo-empty{margin:12px 0;font-size:.9rem;color:var(--tx-2)}',
    '.wvo-tool{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
    '.wvo-chip{font:inherit;font-size:.8rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 12px;background:transparent;color:var(--tx-2);cursor:pointer;min-height:32px}',
    '.wvo-chip em{font-style:normal;margin-left:6px;opacity:.85}',
    '.wvo-chip[aria-pressed=true]{background:var(--bg-2);color:var(--tx-1);border-color:var(--bd-2);font-weight:600}',
    '.wvo-chip--pve::before,.wvo-chip--pvp::before,.wvo-chip--wvw::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:currentColor}',
    '.wvo-chip--pve::before{background:var(--color-green,#3CC48A)}.wvo-chip--pvp::before{background:var(--color-red,#F47C7C)}.wvo-chip--wvw::before{background:var(--color-amber,#F2B94B)}',
    '.wvo-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:10px 14px;margin:0 0 12px}',
    '.wvo-meta b{color:var(--tx-1);font-size:.9rem}.wvo-meta .wvo-bar{flex:1;min-width:120px}.wvo-meta small{color:var(--tx-2);font-size:.8rem}',
    '.wvo-grp{font-size:.74rem;font-weight:700;color:var(--tx-2);text-transform:uppercase;letter-spacing:.07em;margin:14px 0 6px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}',
    '.wvo-grp span{font-weight:500;text-transform:none;letter-spacing:0;font-size:.8rem}',
    '.wvo-grp--ready{color:var(--color-amber,#F2B94B)}.wvo-grp--claimed{color:var(--color-green,#3CC48A);cursor:pointer;min-height:32px;align-items:center}',
    '.wvo-done>summary{list-style:none}.wvo-done>summary::-webkit-details-marker{display:none}',
    '.wvo-done>summary::after{content:"▸";margin-left:2px}.wvo-done[open]>summary::after{content:"▾"}',
    '.wvo-list{list-style:none;margin:0;padding:0}',
    '.wvo-row{display:grid;grid-template-columns:42px minmax(0,1fr) 150px 74px 150px;grid-template-areas:"md t bar rw st";gap:10px;align-items:center;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-1);padding:8px 12px;margin:0 0 6px;font-size:.88rem}',
    '.wvo-row--ready{border-color:color-mix(in srgb,var(--color-amber,#F2B94B) 55%,var(--bd-1))}',
    '.wvo-row--claimed{opacity:.8}',
    '.wvo-mode{grid-area:md;font-size:.66rem;font-weight:800;border:1px solid currentColor;border-radius:6px;padding:2px 0;text-align:center}',
    '.wvo-mode--pve{color:var(--color-green,#3CC48A)}.wvo-mode--pvp{color:var(--color-red,#F47C7C)}.wvo-mode--wvw{color:var(--color-amber,#F2B94B)}',
    '.wvo-t{grid-area:t;color:var(--tx-1);min-width:0;overflow-wrap:anywhere}.wvo-t small{display:block;color:var(--tx-2);font-size:.76rem}',
    '.wvo-bar{grid-area:bar;height:6px;border-radius:6px;background:var(--bg-2);overflow:hidden}.wvo-bar i{display:block;height:100%;border-radius:6px;background:var(--acc-1)}',
    '.wvo-bar--gold i{background:var(--color-amber,#F2B94B)}.wvo-row--claimed .wvo-bar i{background:var(--color-green,#3CC48A)}',
    '.wvo-rw{grid-area:rw;color:var(--tx-1);font-weight:600;font-size:.84rem;white-space:nowrap}',
    '.wvo-aa{font-size:.62rem;font-weight:800;margin-left:3px;color:#4FC3D9}',
    '.wvo-st{grid-area:st;font-size:.74rem;font-weight:700;border:1px solid var(--bd-2);border-radius:999px;padding:2px 10px;text-align:center;color:var(--tx-2);white-space:nowrap}',
    '.wvo-st--ready{color:var(--color-amber,#F2B94B);border-color:var(--color-amber,#F2B94B);background:color-mix(in srgb,var(--color-amber,#F2B94B) 12%,transparent)}',
    '.wvo-st--claimed{color:var(--color-green,#3CC48A);border-color:var(--color-green,#3CC48A);background:color-mix(in srgb,var(--color-green,#3CC48A) 12%,transparent)}',
    '.wvo button:focus-visible,.wvo summary:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.wvo-row{grid-template-columns:36px minmax(0,1fr) auto;grid-template-areas:"md t st" ". bar rw";gap:6px 8px;padding:8px 10px}',
    '.wvo-chip{min-height:40px}.wvo-meta{padding:8px 10px}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;

  function ensureCss() {
    if (!doc || !doc.head || !doc.createElement || doc.getElementById('wv-objectives-ui-css')) return;
    var s = doc.createElement('style');
    s.id = 'wv-objectives-ui-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function setObjState(kind, list) {
    if (!kind) return;
    try { root.WV.__setObjState(kind, list); } catch (_) {}
  }

  function paint(kind) {
    var c = st.cache[kind];
    if (!c || !c.host) return;
    c.host.innerHTML = viewHTML(c.list, c.data, kind, { mode: st.mode, claimedOpen: st.claimedOpen, zero: c.zero });
  }

  function wire(host) {
    if (!host || host.__wvoWired || !host.addEventListener) return;
    host.__wvoWired = true;
    host.addEventListener('click', function (e) {
      for (var n = e.target, i = 0; n && i < 4; n = n.parentNode, i++) {
        var m = n.getAttribute && n.getAttribute('data-wvo-mode');
        if (!m) continue;
        st.mode = m;
        Object.keys(st.cache).forEach(paint);
        var b = host.querySelector && host.querySelector('[data-wvo-mode="' + m + '"]');
        if (b && b.focus) b.focus();
        return;
      }
    });
    // «toggle» no burbujea: se escucha en captura.
    host.addEventListener('toggle', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('wvo-done')) st.claimedOpen = !!t.open;
    }, true);
  }

  function renderTab(host, data, kind) {
    if (!host) return;
    ensureCss();
    if (!data || !Array.isArray(data.objectives)) {
      host.innerHTML = '<p class="wvo-empty">Sin objetivos para mostrar.</p>';
      setObjState(kind, []);
      if (kind) delete st.cache[kind];
      return;
    }
    var list = normalizeObjectives(data);
    setObjState(kind, list);
    wire(host);
    st.cache[kind || '_'] = { host: host, list: list, data: data, zero: false };
    paint(kind || '_');
  }

  // Justo después del reset: los mismos objetivos en cero hasta que llegue la API.
  function renderZero(kind) {
    var host = doc && HOST_ID[kind] ? doc.getElementById(HOST_ID[kind]) : null;
    if (!host) return;
    ensureCss();
    var prev = [];
    try { prev = root.WV.__getObjState()[kind] || []; } catch (_) {}
    if (!Array.isArray(prev) || !prev.length) {
      host.innerHTML = '<p class="wvo-empty">Reseteado: esperando el progreso nuevo…</p>';
      delete st.cache[kind];
      return;
    }
    var list = prev.map(function (o) {
      return { id: o.id, title: o.title, track: o.track, mode: modeOf(o.track), progress: 0, total: o.total, acclaim: o.acclaim, claimed: false, pct: 0 };
    });
    wire(host);
    st.cache[kind] = { host: host, list: list, data: null, zero: true };
    paint(kind);
  }

  root.WVObjectivesUI = {
    version: VERSION,
    renderTab: renderTab,
    renderZero: renderZero,
    _pure: { normalizeObjectives: normalizeObjectives, modeOf: modeOf, statusOf: statusOf, modeCounts: modeCounts,
      effectiveMode: effectiveMode, groupObjectives: groupObjectives, metaInfo: metaInfo, viewHTML: viewHTML, fmtInt: fmtInt, CSS: CSS }
  };
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
