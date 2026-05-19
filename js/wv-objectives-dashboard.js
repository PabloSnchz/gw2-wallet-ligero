/*!
 * js/wv-objectives-dashboard.js — Dashboard de Objetivos Multi-Cuenta
 * v1.0.0 (2026-05-15)
 *
 * Muestra los objetivos semanales de TODAS las cuentas en una tabla comparativa.
 * Filas = cuentas, columnas = objetivos, celdas = estado.
 *
 * Depende de:
 *  - window.GW2Api (getWVWeekly)
 *  - localStorage gw2_keys
 *  - window.Analytics (opcional)
 */

(function (root) {
  'use strict';

  var LOG = '[WV-ObjDashboard]';
  var el = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s || '').replace(/[&<>]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  // ==========================================================================
  // NORMALIZAR OBJETIVOS (misma lógica que wv-objectives-ui.js)
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
  // ESTADO
  // ==========================================================================

  var state = {
    accounts: [],      // [{ token, tag, name, objectives: [...] }]
    objectives: [],    // objetivos únicos (consolidados de todas las cuentas)
    loading: false,
    error: null,
    lastRefreshTime: null
  };

  var _inflight = null;
  var _countdownTimer = null;

  function nextWeeklyResetUTC() {
    var now = new Date();
    var day = now.getUTCDay();
    var daysUntilMonday = (1 - day + 7) % 7;
    var base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 30, 0, 0));
    var next = new Date(base.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
    return next;
  }

  function formatCountdown(ms) {
    if (ms <= 0) return '0s';
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0 || d > 0) parts.push(h + 'h');
    parts.push(m + 'm');
    return parts.join(' ');
  }

  function updateCountdown() {
    var el = document.getElementById('wvodCountdown');
    if (!el) return;
    var ms = nextWeeklyResetUTC().getTime() - Date.now();
    el.textContent = '⏳ ' + formatCountdown(ms);
  }

  function startCountdown() {
    if (_countdownTimer) clearInterval(_countdownTimer);
    updateCountdown();
    _countdownTimer = setInterval(updateCountdown, 60000);
  }

  function stopCountdown() {
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
  }

  // ==========================================================================
  // ICONOS DE TRACK
  // ==========================================================================

  var TRACK_ICONS = (root.WV_MODE_ICONS || {});
  function trackIconHTML(track) {
    var url = TRACK_ICONS[track];
    if (url) {
      return '<img src="' + esc(url) + '" alt="' + esc(track.toUpperCase()) + '" width="14" height="14" style="vertical-align:middle;margin-right:3px;" loading="lazy" referrerpolicy="no-referrer">';
    }
    return '';
  }

  // ==========================================================================
  // COLOR DE TIPO DE CUENTA
  // ==========================================================================

  function getAccountColor(tag) {
    switch (tag) {
      case 'main': return '#ffd966';
      case 'alter': return '#b19cd9';
      case 'f2p': return '#7bc2ff';
      default: return '#9aa2b8';
    }
  }

  // Iconos de cuenta — idéntico a wallet-dashboard.js
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

  var _decorativeIdx = {};

  function getAccountIcon(tag, token) {
    var color = getAccountColor(tag);
    var src;
    if (tag && ACCOUNT_TYPE_ICONS[tag]) {
      src = ACCOUNT_TYPE_ICONS[tag];
    } else {
      var fp = token ? token.slice(0, 8) : 'anon';
      if (_decorativeIdx[fp] === undefined) {
        _decorativeIdx[fp] = Math.floor(Math.random() * DECORATIVE_ICONS.length);
      }
      src = DECORATIVE_ICONS[_decorativeIdx[fp]];
    }
    return '<img src="' + src + '" alt="" width="28" height="28" style="width:28px;height:28px;vertical-align:middle;margin-right:10px;border-radius:8px;filter:brightness(0.9);flex-shrink:0;" loading="lazy" referrerpolicy="no-referrer">';
  }

  // ==========================================================================
  // CARGA DE DATOS
  // ==========================================================================

  function loadData(forceNoCache) {
    if (_inflight) return _inflight;

    var keys = [];
    try {
      keys = JSON.parse(localStorage.getItem('gw2_keys') || '[]');
    } catch (e) {
      keys = [];
    }

    if (!keys.length) {
      state.error = 'No hay API Keys configuradas.';
      state.loading = false;
      render();
      return Promise.resolve();
    }

    state.loading = true;
    state.error = null;
    render();

    // Carga paralela con MAX=3 (mismo patrón que wallet-dashboard)
    var MAX = 3;
    var accounts = [];
    var allObjectives = [];
    var seenObjIds = {};

    function processOne(keyObj) {
      var token = keyObj.value;
      if (!token) return Promise.resolve(null);

      return root.GW2Api.getWVWeekly(token, { nocache: !!forceNoCache })
        .then(function (data) {
          var normalized = normalizeObjectives(data);
          return {
            token: token,
            tag: keyObj.tag || '',
            name: keyObj.name || keyObj.label || (token.slice(0, 4) + '…' + token.slice(-4)),
            objectives: normalized
          };
        })
        .catch(function (e) {
          console.warn(LOG, 'Error cargando cuenta:', keyObj.name || token.slice(0, 8), e);
          return {
            token: token,
            tag: keyObj.tag || '',
            name: keyObj.name || keyObj.label || (token.slice(0, 4) + '…' + token.slice(-4)),
            objectives: [],
            error: e.message || 'Error'
          };
        });
    }

    var batches = [];
    for (var i = 0; i < keys.length; i += MAX) {
      batches.push(keys.slice(i, i + MAX));
    }

    _inflight = Promise.resolve().then(function () {
      return batches.reduce(function (promise, batch) {
        return promise.then(function () {
          return Promise.all(batch.map(processOne)).then(function (results) {
            results.forEach(function (acc) {
              if (acc) {
                accounts.push(acc);
                acc.objectives.forEach(function (obj) {
                  if (!seenObjIds[obj.id]) {
                    seenObjIds[obj.id] = true;
                    allObjectives.push(obj);
                  }
                });
              }
            });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      // Ordenar objetivos por track y luego por título
      allObjectives.sort(function (a, b) {
        if (a.track !== b.track) {
          var order = { 'pve': 0, 'pvp': 1, 'wvw': 2 };
          return (order[a.track] || 3) - (order[b.track] || 3);
        }
        return String(a.title).localeCompare(String(b.title), 'es');
      });

      state.accounts = accounts;
      state.objectives = allObjectives;
      state.loading = false;
      state.error = null;
      state.lastRefreshTime = new Date();
      render();
    }).catch(function (e) {
      console.error(LOG, 'Error en carga:', e);
      state.loading = false;
      state.error = e.message || 'Error desconocido';
      render();
    }).finally(function () {
      _inflight = null;
    });

    return _inflight;
  }

  // ==========================================================================
  // RENDERIZADO
  // ==========================================================================

  function renderCell(account, objective) {
    var obj = (account.objectives || []).find(function (o) { return o.id === objective.id; });
    if (!obj) {
      return '<td style="text-align:center;padding:6px 8px;color:#555;font-size:0.8rem;" title="Sin datos">—</td>';
    }

    if (obj.claimed) {
      return '<td style="text-align:center;padding:6px 8px;background:rgba(160,255,200,0.06);" title="✅ Reclamado • ' + obj.progress + '/' + obj.total + '">' +
        '<span style="font-size:1rem;">✅</span>' +
        '</td>';
    }
    if (obj.pct >= 100) {
      return '<td style="text-align:center;padding:6px 8px;background:rgba(255,211,107,0.06);" title="✔️ Completado • ' + obj.progress + '/' + obj.total + '">' +
        '<span style="color:#ffd36b;font-weight:600;font-size:0.8rem;">✔️ ' + obj.progress + '/' + obj.total + '</span>' +
        '</td>';
    }
    return '<td style="text-align:center;padding:6px 8px;" title="En progreso • ' + obj.progress + '/' + obj.total + '">' +
      '<span style="font-size:0.8rem;">' + obj.progress + '/' + obj.total + '</span>' +
      '<div style="font-size:0.6rem;opacity:0.5;">' + obj.pct + '%</div>' +
      '</td>';
  }

  function formatTimestamp(date) {
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderSkeleton() {
    return '<div class="panel__body" style="padding:0 12px;">' +
      '<h2 style="display:flex;align-items:center;gap:8px;font-size:1.1rem;color:#e0e4ed;margin:0 0 16px 0;">' +
        '<img src="assets/icons/3172791.png" alt="" width="28" height="28">' +
        'Dashboard de Objetivos Semanales' +
      '</h2>' +
      '<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">' +
        Array(4).fill('<div class="skeleton" style="width:150px;height:70px;border-radius:12px;"></div>').join('') +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;">' +
        '<div class="skeleton" style="width:90px;height:28px;border-radius:6px;"></div>' +
        '<div class="skeleton" style="width:100px;height:28px;border-radius:6px;"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:10px;">' +
        '<div class="skeleton" style="width:60px;height:12px;border-radius:4px;"></div>' +
        '<div class="skeleton" style="width:120px;height:12px;border-radius:4px;"></div>' +
      '</div>' +
      '<div class="skeleton" style="width:100%;height:200px;border-radius:10px;"></div>' +
      '</div>';
  }

  function render() {
    var host = el('wvObjectivesDashboardPanel');
    if (!host) return;

    if (state.loading) {
      host.innerHTML = renderSkeleton();
      return;
    }

    if (state.error && !state.accounts.length) {
      host.innerHTML = '<div class="panel__body" style="text-align:center;padding:40px 16px;">' +
        '<p class="error">❌ ' + esc(state.error) + '</p>' +
        '<button onclick="window.WVObjectivesDashboard.refresh(true)" class="btn" style="margin-top:12px;">Reintentar</button>' +
        '</div>';
      return;
    }

    var accounts = state.accounts;
    var objectives = state.objectives;

    // KPIs
    var totalAccounts = accounts.length;
    var totalCells = totalAccounts * objectives.length;
    var completedCells = 0;
    var claimedCells = 0;

    accounts.forEach(function (acc) {
      objectives.forEach(function (obj) {
        var found = (acc.objectives || []).find(function (o) { return o.id === obj.id; });
        if (found) {
          if (found.claimed) claimedCells++;
          else if (found.pct >= 100) completedCells++;
        }
      });
    });

    var pctCompletado = totalCells > 0 ? Math.round(((completedCells + claimedCells) / totalCells) * 100) : 0;

    var kpiIconAccounts = 'assets/icons/3601748.png';
    var kpiIconClaimed = 'https://render.guildwars2.com/file/1856A01E331452E4C14E4C9CF4F818E3FAEF9B79/3124964.png';
    var kpiIconCompleted = 'assets/icons/Welcome/156108.png';

        var kpiStyle = 'background:#0f1116;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;flex:1;min-width:170px;display:flex;align-items:center;gap:14px;transition:all 0.22s cubic-bezier(0.2,0.9,0.4,1.1);cursor:default;';
    var kpiHover = 'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 10px 28px rgba(0,0,0,0.45), 0 0 16px rgba(90,110,154,0.20), 0 0 0 1px rgba(82,118,255,0.12)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 0 8px rgba(90,110,154,0.08)\'"';

    var tsStr = formatTimestamp(state.lastRefreshTime);

    var html = '<div class="panel__body" style="padding:0 12px;">';
    
    // Título
    html += '<h2 style="display:flex;align-items:center;justify-content:space-between;font-size:1.1rem;color:#e0e4ed;margin:0 0 16px 0;">' +
      '<span style="display:flex;align-items:center;gap:8px;">' +
        '<img src="assets/icons/3172791.png" alt="" width="28" height="28">' +
        'Dashboard de Objetivos Semanales' +
      '</span>' +
      '<span id="wvodCountdown" style="font-size:0.7rem;color:#9aa2b8;background:#0f1116;border:1px solid #1f2026;border-radius:8px;padding:3px 10px;white-space:nowrap;">⏳ —</span>' +
      '</h2>';

    // KPIs con íconos
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">';
    
        html += '<div class="wvod-kpi" style="' + kpiStyle + 'border-left:3px solid rgba(123,194,255,0.5);box-shadow:0 0 8px rgba(123,194,255,0.10);" ' + kpiHover + '>';
    html += '<img src="' + kpiIconAccounts + '" alt="" width="40" height="40" style="flex-shrink:0;border-radius:8px;" loading="lazy" referrerpolicy="no-referrer">';
    html += '<div style="flex:1;"><div style="font-size:1.6rem;font-weight:700;color:#e0e4ed;line-height:1.1;">' + totalAccounts + '</div><div style="font-size:0.72rem;color:#9aa2b8;margin-top:2px;">Cuentas</div><div style="font-size:0.62rem;color:#5a6072;margin-top:3px;">Con acceso a la Cámara del Brujo</div></div>';
    html += '</div>';
    
    html += '<div class="wvod-kpi" style="' + kpiStyle + 'border-left:3px solid rgba(160,255,200,0.5);box-shadow:0 0 8px rgba(160,255,200,0.10);" ' + kpiHover + '>';
    html += '<img src="' + kpiIconClaimed + '" alt="" width="40" height="40" style="flex-shrink:0;border-radius:8px;" loading="lazy" referrerpolicy="no-referrer">';
    html += '<div style="flex:1;"><div style="font-size:1.6rem;font-weight:700;color:#e0e4ed;line-height:1.1;">' + claimedCells + ' <span style="font-size:0.7rem;color:#5a6072;font-weight:400;">/ ' + totalCells + '</span></div><div style="font-size:0.72rem;color:#9aa2b8;margin-top:2px;">Reclamados</div><div style="font-size:0.62rem;color:#5a6072;margin-top:3px;">Objetivos ya cobrados</div></div>';
    html += '</div>';
    
    html += '<div class="wvod-kpi" style="' + kpiStyle + 'border-left:3px solid rgba(255,211,107,0.5);box-shadow:0 0 8px rgba(255,211,107,0.10);" ' + kpiHover + '>';
    html += '<img src="' + kpiIconCompleted + '" alt="" width="40" height="40" style="flex-shrink:0;border-radius:8px;" loading="lazy" referrerpolicy="no-referrer">';
    html += '<div style="flex:1;"><div style="font-size:1.6rem;font-weight:700;color:#e0e4ed;line-height:1.1;">' + completedCells + ' <span style="font-size:0.7rem;color:#5a6072;font-weight:400;">/ ' + totalCells + '</span></div><div style="font-size:0.72rem;color:#9aa2b8;margin-top:2px;">Completados</div><div style="font-size:0.62rem;color:#5a6072;margin-top:3px;">Pendientes de cobro</div></div>';
    html += '</div>';
    
    // Progreso con mini barra en lugar de ícono
    html += '<div class="wvod-kpi" style="' + kpiStyle + 'border-left:3px solid rgba(180,186,208,0.5);box-shadow:0 0 8px rgba(180,186,208,0.10);" ' + kpiHover + '>';
    html += '<div style="flex:1;">' +
      '<div style="display:flex;align-items:baseline;gap:8px;">' +
        '<div style="font-size:1.6rem;font-weight:700;color:#e0e4ed;line-height:1.1;">' + pctCompletado + '%</div>' +
        '<div style="font-size:0.7rem;color:#9aa2b8;">Progreso</div>' +
      '</div>' +
      '<div style="font-size:0.62rem;color:#5a6072;margin-top:3px;">Del total de objetivos</div>' +
      '<div style="margin-top:6px;height:4px;background:#1a1d28;border-radius:2px;overflow:hidden;">' +
        '<div style="height:100%;width:' + pctCompletado + '%;background:linear-gradient(90deg,#5276ff,#7bc2ff);border-radius:2px;transition:width 0.5s ease;"></div>' +
      '</div>' +
      '</div>';
    html += '</div>';

    // Barra de estado — debajo de KPIs, antes de la tabla
    html += '<div style="width:100%;display:flex;justify-content:space-between;margin:0 0 12px 0;font-size:0.7rem;color:#9aa2b8;">';
    html += '<span>Listo.</span>';
    html += '<span>Última actualización: ' + tsStr + '</span>';
    html += '</div>';

    // Botones de acción ahora en el nav de tabs (index.html)

    // Tabla
    if (!objectives.length) {
      html += '<p class="muted">No se encontraron objetivos semanales en ninguna cuenta.</p>';
    } else {
      html += '<div class="table-wrap" style="overflow-x:auto;border-radius:10px;border:1px solid #1f2026;">';
      html += '<table class="simple wvod-table" style="border-collapse:collapse;width:100%;">';
      html += '<thead><tr style="background:#0e0f12;">';
      html += '<th style="position:sticky;left:0;top:0;background:#0e0f12;z-index:2;min-width:150px;text-align:left;padding:10px 12px;border-bottom:2px solid #2a2c35;text-transform:uppercase;letter-spacing:0.5px;font-size:0.7rem;color:#9aa2b8;">Cuenta</th>';
      objectives.forEach(function (obj) {
        var trackLabel = obj.track.toUpperCase();
        var shortTitle = obj.title.length > 22 ? esc(obj.title).substring(0, 20) + '…' : esc(obj.title);
        html += '<th style="text-align:center;min-width:90px;max-width:130px;" title="' + esc(obj.title) + ' • +' + obj.acclaim + ' AA">' +
          '<span style="display:inline-block;font-size:0.65rem;padding:1px 6px;border-radius:8px;background:#1a1d28;border:1px solid #2a2c35;margin-bottom:3px;">' + trackIconHTML(obj.track) + trackLabel + '</span>' +
          '<div style="font-size:0.7rem;line-height:1.2;max-height:2.5em;overflow:hidden;">' + shortTitle + '</div>' +
          '<div style="font-size:0.6rem;opacity:0.5;">+' + obj.acclaim + ' AA</div>' +
          '</th>';
      });
      html += '</tr></thead><tbody>';

      accounts.forEach(function (acc) {
        var color = getAccountColor(acc.tag);
        var tagLabel = acc.tag || '';
        html += '<tr>';
        html += '<td style="position:sticky;left:0;background:#0e0f12;z-index:1;padding:8px 10px;white-space:nowrap;display:flex;align-items:center;gap:10px;min-width:160px;">' +
          getAccountIcon(acc.tag, acc.token) +
          '<strong style="color:#cfd2d8;">' + esc(acc.name) + '</strong>' +
          // Tag se identifica por el ícono de cuenta, no hace falta texto
          (acc.error ? ' <span class="muted" style="font-size:0.7rem;" title="' + esc(acc.error) + '">⚠️</span>' : '') +
          '</td>';
        objectives.forEach(function (obj) {
          html += renderCell(acc, obj);
        });
        html += '</tr>';
      });

      // Fila de resumen
      html += '<tr class="total-row" style="background:#0f1118;border-top:2px solid #3a4c7a;font-weight:700;">';
      html += '<td style="position:sticky;left:0;background:#0f1118;z-index:1;padding:10px 12px;color:#e0e4ed;">' +
        '<img src="assets/icons/578844.png" width="14" height="14" alt="" style="vertical-align:middle;margin-right:6px;">TOTAL</td>';
      objectives.forEach(function(obj) {
        var totalRecl = 0;
        var totalCompl = 0;
        accounts.forEach(function(acc) {
          var found = (acc.objectives || []).find(function(o) { return o.id === obj.id; });
          if (found) {
            if (found.claimed) totalRecl++;
            else if (found.pct >= 100) totalCompl++;
          }
        });
        html += '<td style="text-align:center;padding:10px 6px;font-size:0.75rem;">' +
          (totalRecl > 0 ? '<span style="color:#a0ffc8;">' + totalRecl + ' recl.</span> ' : '') +
          (totalCompl > 0 ? '<span style="color:#ffd36b;">' + totalCompl + ' compl.</span>' : (totalRecl === 0 ? '<span style="color:#555;">—</span>' : '')) +
          '</td>';
      });
      html += '</tr>';

      html += '</tbody></table></div>';
    }

    html += '</div>';
    
    // Inyectar estilos de tabla
    html += '<style>' +
      '.wvod-table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.015); }' +
      '.wvod-table tbody tr:hover td { background: rgba(255,255,255,0.04); }' +
      '.wvod-table td { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s ease; }' +
      '.wvod-table th { border-bottom: 2px solid #2a2c35; }' +
      '.wvod-table .total-row td { background:#0f1118; }' +
      '</style>';

    host.innerHTML = html;
    
    // Iniciar countdown después de que el DOM está listo
    startCountdown();
  }

  // ==========================================================================
  // CICLO DE VIDA
  // ==========================================================================

  function activate() {
    var panel = el('wvObjectivesDashboardPanel');
    if (panel) panel.removeAttribute('hidden');

    if (typeof root.Analytics !== 'undefined') {
      root.Analytics.viewModule('wv_objectives_dashboard');
    }

    // El countdown se inicia en render() después de crear el DOM

    if (!state.accounts.length && !state.loading) {
      loadData(false);
    } else {
      render();
    }
  }

  function deactivate() {
    var panel = el('wvObjectivesDashboardPanel');
    if (panel) panel.setAttribute('hidden', 'hidden');
    stopCountdown();
    // Restaurar tabs de WV
    if (window.WV && typeof window.WV.hideObjectivesDashboard === 'function') {
      window.WV.hideObjectivesDashboard();
    }
  }

  function refresh(forceNoCache) {
    return loadData(!!forceNoCache);
  }

  // ==========================================================================
  // API PÚBLICA
  // ==========================================================================

  var WVObjectivesDashboard = {
    activate: activate,
    deactivate: deactivate,
    refresh: refresh,
    _debug: function () {
      console.log(LOG, 'state:', JSON.parse(JSON.stringify(state)));
      return state;
    }
  };

  root.WVObjectivesDashboard = WVObjectivesDashboard;
  console.info(LOG, 'ready v1.0.0');

})(typeof window !== 'undefined' ? window : this);