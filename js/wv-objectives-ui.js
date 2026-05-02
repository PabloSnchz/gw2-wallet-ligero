/*!
 * js/wv-objectives-ui.js — UI de Objetivos de Wizard's Vault
 * v1.0.0 (2026-05-01)
 *
 * Extraído de router.js para separar renderizado de navegación.
 * Responsabilidades:
 *  - Renderizar los objetivos diarios, semanales y especiales
 *  - Mostrar progreso, recompensas y estados (reclamado/pendiente)
 *  - Modo "zero" (cuando se resetean los objetivos)
 *
 * Depende de:
 *  - window.WV (estado: state.obj, state.loaded)
 *  - window.GW2Api (para obtener datos de objetivos)
 */

(function (root) {
  'use strict';

  var LOG = '[WV-ObjectivesUI]';
  var el = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s || '').replace(/[&<>]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }
  function fmtNumber(n) { n = Number(n || 0); return n.toLocaleString('es-AR'); }
  function getSelectedToken() {
    var sel = document.getElementById('keySelectGlobal');
    return sel ? (sel.value || '').trim() : null;
  }

  // ==========================================================================
  // HYDRATE MODE PILLS
  // ==========================================================================

  function hydrateWVModePills(scope) {
    try {
      var ICONS = (window.WV_MODE_ICONS || {});
      if (!ICONS || typeof ICONS !== 'object') return;
      var root = scope || document;
      var nodes = root.querySelectorAll('.wv-obj-mode, .wv-mode-pill, [data-wv-mode], [data-mode]');
      if (!nodes || !nodes.length) return;
      Array.prototype.forEach.call(nodes, function (node) {
        try {
          if (!node || node.__wvIconHydrated) return;
          var raw = (node.getAttribute('data-wv-mode') || node.getAttribute('data-mode') || (node.textContent || '')).trim().toLowerCase();
          var mode = (raw === 'pvp' || raw === 'pve' || raw === 'wvw') ? raw : (raw.indexOf('pvp')>=0?'pvp':(raw.indexOf('wvw')>=0?'wvw':'pve'));
          var url = ICONS[mode]; if (!url) return;
          if (node.querySelector('img')) { node.__wvIconHydrated = true; return; }
          node.textContent = '';
          var img = document.createElement('img');
          img.src = url; img.alt = mode.toUpperCase(); img.width = 16; img.height = 16;
          img.decoding = 'async'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.className = 'wv-mode-pill__img';
          node.appendChild(img);
          node.setAttribute('data-mode', mode);
          node.classList.add('wv-mode-pill--hydrated');
          node.__wvIconHydrated = true;
        } catch (_) {}
      });
    } catch (_) {}
  }

  // ==========================================================================
  // NORMALIZAR OBJETIVOS
  // ==========================================================================

  function normalizeObjectives(raw) {
    var arr = (raw && raw.objectives) || [];
    return arr.map(function (o) {
      var id = (o.id != null ? o.id : (o.objective_id != null ? o.objective_id : null));
      var title = o.title || o.name || ('Objetivo #' + id);
      var track = String(o.track || '').toLowerCase();
      var progress = (o.progress_current != null ? o.progress_current : (o.progress != null ? o.progress : 0));
      var total = (o.progress_complete != null ? o.progress_complete : (o.total != null ? o.total : 0));
      var acclaim = (o.acclaim != null ? o.acclaim : (o.rewardAA != null ? o.rewardAA : (o.reward_aa != null ? o.reward_aa : 0)));
      var claimed = !!o.claimed;
      var pct = (total > 0 ? Math.max(0, Math.min(100, Math.round((progress / total) * 100))) : (progress ? 100 : 0));
      return { id: id, title: title, track: track, progress: progress, total: total, acclaim: acclaim, claimed: claimed, pct: pct };
    });
  }

  // ==========================================================================
  // RENDERIZADO DE OBJETIVOS
  // ==========================================================================

  function renderObjectivesTab(host, data, kind) {
    if (!host) return;

    if (!data || !Array.isArray(data.objectives)) {
      host.innerHTML = '<p class="muted">Sin objetivos para mostrar.</p>';
      if (kind) {
        try { root.WV.__setObjState(kind, []); } catch (_) {}
      }
      return;
    }

    var list = normalizeObjectives(data);
    if (kind) {
      try { root.WV.__setObjState(kind, list); } catch (_) {}
    }

    var html = ['<div class="wv-obj-grid">'];

    if (typeof data.meta_progress_current === 'number' && typeof data.meta_progress_complete === 'number') {
      var metaPct = (data.meta_progress_complete > 0) ? Math.max(0, Math.min(100, Math.round((data.meta_progress_current / data.meta_progress_complete) * 100))) : 0;
      html.push(
        '<div class="wv-obj-card">',
          '<div class="wv-obj-head">',
            '<div class="wv-obj-title">Meta de la temporada</div>',
            (data.meta_reward_astral ? ('<span class="aa-badge">+' + fmtNumber(data.meta_reward_astral) + ' AA</span>') : ''),
          '</div>',
          '<div class="wv-obj-prog">',
            '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:' + metaPct + '%;"></div></div>',
            '<div class="wv-obj-stats"><span>' + fmtNumber(data.meta_progress_current) + ' / ' + fmtNumber(data.meta_progress_complete) + '</span><span>' + metaPct + '%</span></div>',
          '</div>',
        '</div>'
      );
    }

    list.forEach(function (o) {
      var statusClass = o.claimed ? '' : (o.pct >= 100 ? '' : ' wv-obj-status--pending');
      var statusText = o.claimed ? '✅ Reclamado' : (o.pct >= 100 ? '✔️ Completado' : '… En progreso');
      var pillText = (o.track || 'pve').toUpperCase();
      html.push(
        '<div class="wv-obj-card">',
          '<div class="wv-obj-head">',
            '<div class="wv-obj-title">' + esc(o.title) + '</div>',
            '<span class="wv-obj-mode" data-wv-mode="' + esc(o.track || 'pve') + '">' + pillText + '</span>',
          '</div>',
          '<div class="wv-obj-meta">',
            '<span class="wv-obj-reward">' + (o.acclaim ? ('+' + fmtNumber(o.acclaim) + ' AA') : '') + '</span>',
            '<span class="wv-obj-status' + statusClass + '">' + statusText + '</span>',
          '</div>',
          '<div class="wv-obj-prog">',
            '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:' + o.pct + '%;"></div></div>',
            '<div class="wv-obj-stats"><span>' + (o.total ? (fmtNumber(o.progress) + ' / ' + fmtNumber(o.total)) : fmtNumber(o.progress)) + '</span><span>' + o.pct + '%</span></div>',
          '</div>',
        '</div>'
      );
    });

    html.push('</div>');
    host.innerHTML = html.join('');
    hydrateWVModePills(host);
  }

  function renderObjectivesZero(kind) {
    var stateObj = {};
    try { stateObj = root.WV.__getObjState(); } catch (_) {}

    var host = (kind === 'daily')   ? el('wvTabDaily')
             : (kind === 'weekly')  ? el('wvTabWeekly')
             : (kind === 'special') ? el('wvTabSpecial') : null;
    if (!host) return;

    var list = Array.isArray(stateObj[kind]) ? stateObj[kind] : [];
    if (!list.length) {
      host.innerHTML = '<p class="muted">Reseteado — esperando nuevo progreso…</p>';
      return;
    }

    var html = ['<div class="wv-obj-grid">'];
    list.forEach(function (o) {
      var pillText = (o.track || 'pve').toUpperCase();
      html.push(
        '<div class="wv-obj-card">',
          '<div class="wv-obj-head">',
            '<div class="wv-obj-title">' + esc(o.title) + '</div>',
            '<span class="wv-obj-mode" data-wv-mode="' + esc(o.track || 'pve') + '">' + pillText + '</span>',
          '</div>',
          '<div class="wv-obj-meta">',
            '<span class="wv-obj-reward">' + (o.acclaim ? ('+' + fmtNumber(o.acclaim) + ' AA') : '') + '</span>',
            '<span class="wv-obj-status wv-obj-status--pending">… En progreso</span>',
          '</div>',
          '<div class="wv-obj-prog">',
            '<div class="wv-obj-bar"><div class="wv-obj-bar__fill" style="width:0%;"></div></div>',
            '<div class="wv-obj-stats"><span>0' + (o.total ? (' / ' + fmtNumber(o.total)) : '') + '</span><span>0%</span></div>',
          '</div>',
        '</div>'
      );
    });
    html.push('</div>');
    host.innerHTML = html.join('');
    hydrateWVModePills(host);
  }

  // ==========================================================================
  // API PÚBLICA
  // ==========================================================================

  var WVObjectivesUI = {
    renderTab: renderObjectivesTab,
    renderZero: renderObjectivesZero
  };

  root.WVObjectivesUI = WVObjectivesUI;
  console.info(LOG, 'ready v1.0.0');

})(typeof window !== 'undefined' ? window : this);