/*!
 * Meta Theme (expansión/temporada) — diseño sobrio con borde izquierdo de color
 * v1.4.2 (2026-05-02)
 *
 * Cambios v1.4.2:
 *  - CORRECCIÓN: solo aplica border-left de color, el resto lo hereda de .card (theme-polish.css)
 *  - Eliminada la sobrescritura de border y box-shadow que pisaba los estilos base y el hover
 *  - Mismo patrón que wallet-theme.js v1.3.0
 *
 * Cambios v1.4.1:
 *  - Badges de estado con mejor espaciado (padding consistente)
 *  - Chips de horarios activo/próximo con fondo más suave (0.06 en vez de 0.1)
 *  - Botón "Horarios" con ícono local (523379.png) en vez de emoji 🕒
 *
 * v1.4.0:
 *  - Rediseño suave: borde neutro, glow unificado, solo border-left de color
 *  - Título conserva el color de la expansión
 */

(function () {
  'use strict';

  console.info('[MetaTheme] meta-theme.js v1.4.2 — solo border-left, hereda .card de theme-polish.css');

  var DEBUG = false;

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  function hexToRGBA(hex, alpha) {
    try {
      var h = String(hex || '').trim();
      if (!h) return null;
      if (/^rgba?\(/i.test(h)) return h.replace(/\s+/g, '');
      h = h.replace(/^#/, '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6) return null;
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (_) { return null; }
  }

  function getMetaTint(card) {
    try {
      var inline = card.getAttribute('style') || '';
      var m = inline.match(/--meta-title-color\s*:\s*([^;]+)/i);
      if (m && m[1]) return String(m[1]).trim();
      var cs = getComputedStyle(card);
      var v = cs.getPropertyValue('--meta-title-color');
      if (v) return String(v).trim();
    } catch (_) {}
    return '';
  }

  // ==========================================================================
  // ICONOS LOCALES
  // ==========================================================================

  var ICON_UTC      = 'assets/icons/460028.png';
  var ICON_LOCAL    = 'assets/icons/841720.png';
  var ICON_DAILY    = 'assets/icons/534745.png';
  var ICON_WEEKLY   = 'assets/icons/155064.png';
  var ICON_SCHEDULE = 'assets/icons/523381.png'; // Para el botón "Horarios"

  // ==========================================================================
  // BARRA DE HORARIOS (estilo Activities con iconos GW2)
  // ==========================================================================

  function formatCountdownWithSeconds(ms) {
    if (!isFinite(ms) || ms <= 0) return '—';
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    s %= 86400;
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    s %= 60;

    var parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0 || d > 0) parts.push(String(h).padStart(2, '0') + 'h');
    if (m > 0 || h > 0 || d > 0) parts.push(String(m).padStart(2, '0') + 'm');
    parts.push(String(s).padStart(2, '0') + 's');

    return parts.join(' ');
  }

  function nextDailyResetUTC() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = now.getUTCMonth();
    var d = now.getUTCDate();
    var next = new Date(Date.UTC(y, m, d, 24, 0, 0, 0));
    if (next.getTime() <= Date.now()) {
      next = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    }
    return next;
  }

  function nextWeeklyResetUTC() {
    var now = new Date();
    var day = now.getUTCDay();
    var daysUntilMonday = (1 - day + 7) % 7;
    var base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 30, 0, 0));
    var next = new Date(base.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    if (next.getTime() <= Date.now()) {
      next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    return next;
  }

  function updateMetaClock() {
    var now = new Date();

    var utcTime   = String(now.getUTCHours()).padStart(2,'0') + ':' +
                    String(now.getUTCMinutes()).padStart(2,'0') + ':' +
                    String(now.getUTCSeconds()).padStart(2,'0');

    var localTime = String(now.getHours()).padStart(2,'0') + ':' +
                    String(now.getMinutes()).padStart(2,'0') + ':' +
                    String(now.getSeconds()).padStart(2,'0');

    var dailyMs  = nextDailyResetUTC().getTime() - now.getTime();
    var weeklyMs = nextWeeklyResetUTC().getTime() - now.getTime();

    var utcEl    = document.getElementById('metaUtcTime');
    var localEl  = document.getElementById('metaLocalTime');
    var dailyEl  = document.getElementById('metaDailyReset');
    var weeklyEl = document.getElementById('metaWeeklyReset');

    if (utcEl)    utcEl.textContent    = utcTime;
    if (localEl)  localEl.textContent  = localTime;
    if (dailyEl)  dailyEl.textContent  = formatCountdownWithSeconds(dailyMs);
    if (weeklyEl) weeklyEl.textContent = formatCountdownWithSeconds(weeklyMs);
  }

  function renderMetaClockBar(metaPanel) {
    var panelHead = metaPanel.querySelector('.panel-head');
    if (!panelHead) return;

    var title = panelHead.querySelector('.panel-head__title');

    var clockBar = document.createElement('div');
    clockBar.className = 'meta-clock-bar chips';
    clockBar.style.cssText = [
      'display:flex', 'gap:16px', 'align-items:center',
      'background:#0f1116', 'padding:4px 12px', 'border-radius:40px',
      'border:1px solid #2a2c35', 'font-family:monospace',
      'font-size:0.85rem', 'flex-wrap:wrap'
    ].join(';');

    clockBar.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;" data-tip="Hora del servidor (UTC+0)">' +
        '<img src="' + ICON_UTC + '" width="24" height="24" alt="UTC" style="filter:brightness(0.9);">' +
        '<span>UTC</span><strong id="metaUtcTime">--:--:--</strong>' +
      '</div>' +
      '<div style="width:1px;height:24px;background:#2a2c35;"></div>' +
      '<div style="display:flex;align-items:center;gap:6px;" data-tip="Tu hora local">' +
        '<img src="' + ICON_LOCAL + '" width="24" height="24" alt="Local" style="filter:brightness(0.9);">' +
        '<span>Local</span><strong id="metaLocalTime">--:--:--</strong>' +
      '</div>' +
      '<div style="width:1px;height:24px;background:#2a2c35;"></div>' +
      '<div style="display:flex;align-items:center;gap:6px;" data-tip="Reset diario a las 00:00 UTC">' +
        '<img src="' + ICON_DAILY + '" width="24" height="24" alt="Reset diario" style="filter:brightness(0.9);">' +
        '<span>Reset diario</span><strong id="metaDailyReset">--</strong>' +
      '</div>' +
      '<div style="width:1px;height:24px;background:#2a2c35;"></div>' +
      '<div style="display:flex;align-items:center;gap:6px;" data-tip="Reset semanal los lunes a las 07:30 UTC">' +
        '<img src="' + ICON_WEEKLY + '" width="24" height="24" alt="Reset semanal" style="filter:brightness(0.9);">' +
        '<span>Reset semanal</span><strong id="metaWeeklyReset">--</strong>' +
      '</div>';

    panelHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;';
    panelHead.innerHTML = '';
    if (title) panelHead.appendChild(title);
    panelHead.appendChild(clockBar);

    updateMetaClock();
    if (window.__metaClockInterval) clearInterval(window.__metaClockInterval);
    window.__metaClockInterval = setInterval(updateMetaClock, 1000);
  }

  // ==========================================================================
  // MEJORA DE HORARIOS EN TARJETAS (v1.3.3)
  // ==========================================================================

  function getUTCTimeFromChip(chip) {
    var title = chip.getAttribute('title') || '';
    var match = title.match(/Ventana (\d{2}):(\d{2})\s*UTC/);
    if (match) {
      return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
    }
    return null;
  }

  function convertToLocalTime(utcHours, utcMinutes) {
    var date = new Date();
    date.setUTCHours(utcHours, utcMinutes, 0, 0);
    return String(date.getHours()).padStart(2, '0') + ':' +
           String(date.getMinutes()).padStart(2, '0');
  }

  function convertScheduleToLocalTime(card) {
    var schedulePanel = card.querySelector('.m-win');
    if (!schedulePanel) return;

    var chips = schedulePanel.querySelectorAll('.chip.chip--ghost');
    var hasChanges = false;

    chips.forEach(function(chip) {
      var utcTime = getUTCTimeFromChip(chip);
      if (utcTime) {
        var utcStr = String(utcTime.hours).padStart(2,'0') + ':' +
                     String(utcTime.minutes).padStart(2,'0');
        chip.setAttribute('data-utc', utcStr);

        var localTime = convertToLocalTime(utcTime.hours, utcTime.minutes);
        if (chip.textContent !== localTime) {
          chip.textContent = localTime;
          chip.setAttribute('data-tip', 'Hora local: ' + localTime);
          chip.removeAttribute('title');
          chip.classList.add('has-local-time');
          hasChanges = true;
        }
      }
    });

    if (hasChanges && !schedulePanel.querySelector('.local-indicator')) {
      var header = document.createElement('div');
      header.className = 'schedule-panel__header';
      header.style.cssText = 'margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #2a2c35;font-size:0.7rem;color:#b4bad0;';
      header.innerHTML = '📅 Horarios de hoy <span class="local-indicator" style="opacity:0.7">(hora local)</span>';
      schedulePanel.insertBefore(header, schedulePanel.firstChild);
    }
  }

  function getNextScheduleTime(card) {
    var schedulePanel = card.querySelector('.m-win');
    if (!schedulePanel) return null;

    var chips = schedulePanel.querySelectorAll('.chip.chip--ghost');
    if (!chips.length) return null;

    var now = Date.now();
    var closest = null;

    chips.forEach(function(chip) {
      var utcStr = chip.getAttribute('data-utc');
      if (!utcStr) return;

      var parts = utcStr.split(':');
      if (parts.length < 2) return;

      var utcH = parseInt(parts[0], 10);
      var utcM = parseInt(parts[1], 10);
      if (isNaN(utcH) || isNaN(utcM)) return;

      var d = new Date();
      var ts = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcH, utcM, 0, 0);

      if (ts <= now) ts += 24 * 60 * 60 * 1000;

      if (closest === null || ts < closest) closest = ts;
    });

    return closest;
  }

  function updateScheduleButtonColor(card) {
    var btn = card.querySelector('.m-win__toggle');
    if (!btn) return;

    var nextTime = getNextScheduleTime(card);
    btn.classList.remove('badge--success', 'badge--warning', 'badge--info');

    if (nextTime === null) return;

    var timeLeft = nextTime - Date.now();

    if (timeLeft <= 0) {
      btn.classList.add('badge--success');
      btn.setAttribute('data-tip', '🟢 Evento activo ahora');
    } else if (timeLeft <= 20 * 60 * 1000) {
      btn.classList.add('badge--warning');
      var minutesLeft = Math.ceil(timeLeft / 60000);
      btn.setAttribute('data-tip', '🟡 Próximo evento en ' + minutesLeft + ' min');
    } else {
      btn.classList.add('badge--info');
      btn.setAttribute('data-tip', '🔵 Ver todos los horarios (hora local)');
    }
  }

  function highlightNextSchedule(card) {
    var schedulePanel = card.querySelector('.m-win');
    if (!schedulePanel) return;

    var chips = schedulePanel.querySelectorAll('.chip.chip--ghost');
    if (!chips.length) return;

    var now = Date.now();
    var activeIndex = -1;
    var nextIndex   = -1;
    var closestDiff = Infinity;

    chips.forEach(function(chip, idx) {
      var utcStr = chip.getAttribute('data-utc');
      if (!utcStr) return;

      var parts = utcStr.split(':');
      var utcH = parseInt(parts[0], 10);
      var utcM = parseInt(parts[1], 10);
      if (isNaN(utcH) || isNaN(utcM)) return;

      var d = new Date();
      var tsStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcH, utcM, 0, 0);
      var durationMs = 15 * 60 * 1000;
      var tsEnd = tsStart + durationMs;

      if (now >= tsStart && now < tsEnd) {
        activeIndex = idx;
      }

      var diff = tsStart - now;
      if (diff < 0) diff += 24 * 60 * 60 * 1000;
      if (diff < closestDiff) {
        closestDiff = diff;
        nextIndex = idx;
      }
    });

    chips.forEach(function(chip, idx) {
      chip.classList.remove('chip--active', 'chip--next');
      chip.style.fontWeight      = 'normal';
      chip.style.borderColor     = '';
      chip.style.color           = '';
      chip.style.backgroundColor = '';
      chip.style.boxShadow       = '';

      if (idx === activeIndex) {
        chip.classList.add('chip--active');
        chip.style.fontWeight      = 'bold';
        chip.style.borderColor     = '#a0ffc8';
        chip.style.color           = '#a0ffc8';
        chip.style.backgroundColor = 'rgba(160,255,200,0.06)';
        chip.style.boxShadow       = '0 0 0 1px rgba(160,255,200,0.2) inset';
      } else if (idx === nextIndex && activeIndex === -1) {
        chip.classList.add('chip--next');
        chip.style.fontWeight      = 'bold';
        chip.style.borderColor     = '#ffd966';
        chip.style.color           = '#ffd966';
        chip.style.backgroundColor = 'rgba(255,217,102,0.06)';
        chip.style.boxShadow       = '0 0 0 1px rgba(255,217,102,0.2) inset';
      }
    });
  }

  /**
   * Mejora el botón con ícono local (en vez de emoji 🕒).
   */
  function enhanceScheduleButton(card) {
    var btn = card.querySelector('.m-win__toggle');
    if (btn && !btn.hasAttribute('data-schedule-icon')) {
      btn.setAttribute('data-schedule-icon', '1');
      btn.innerHTML = '<img src="' + ICON_SCHEDULE + '" width="14" height="14" alt="" style="filter:brightness(0.9);vertical-align:middle;margin-right:5px;"> ' + btn.textContent;
      btn.style.transition = 'all 0.1s ease';
    }
  }

  function enhanceSchedule(card) {
    if (!card) return;
    convertScheduleToLocalTime(card);
    enhanceScheduleButton(card);
    updateScheduleButtonColor(card);
    highlightNextSchedule(card);
  }

  // ==========================================================================
  // TEMA BASE (v1.4.2 — solo border-left, hereda .card de theme-polish.css)
  // ==========================================================================

  function applyMetaTheme(card) {
    if (!card) return;

    var tint = getMetaTint(card) || '#FFFFFF';
    if (DEBUG) console.log('[MetaTheme] tint:', tint, 'for card', card.getAttribute('data-id') || '');

    // Solo borde izquierdo del color de la expansión
    var bLeft = hexToRGBA(tint, 0.5);

    // TÍTULO: color de la expansión (mismo tono que el borde izquierdo)
    try {
      var title = card.querySelector('.meta-card__title') || card.querySelector('.m-title');
      if (title) title.style.color = tint;
    } catch (_) {}

    // Solo borde izquierdo — el borde general, glow y hover los hereda de .card (theme-polish.css)
    try {
      card.style.borderLeft = '3px solid ' + bLeft;
    } catch (_) {}

    // BADGES DE ESTADO: mejor espaciado (padding consistente)
    try {
      var statusBadges = card.querySelectorAll('.meta-status, .m-done');
      statusBadges.forEach(function(badge) {
        badge.style.padding = '3px 10px';
        badge.style.borderRadius = '20px';
        badge.style.fontSize = '0.7rem';
        badge.style.fontWeight = '500';
      });
    } catch (_) {}

    enhanceSchedule(card);
    card.classList.add('card');
  }

  // ==========================================================================
  // APLICACIÓN A TODAS LAS TARJETAS
  // ==========================================================================

  function themeMetaNow(root) {
    var host  = (root || document).querySelector('#metaPanel') || root || document;
    var cards = Array.from(host.querySelectorAll('.meta-card, .m-card'));
    cards.forEach(applyMetaTheme);
  }

  // ==========================================================================
  // MIGRACIONES EXISTENTES
  // ==========================================================================

  function migrateCardsToCardClass(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    var cards     = metaPanel.querySelectorAll('.meta-card:not(.card), .m-card:not(.card)');
    cards.forEach(function(card) { card.classList.add('card'); });
  }

  function migrateStatusBadges(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;

    metaPanel.querySelectorAll('.m-badge--active').forEach(function(badge) {
      if (!badge.classList.contains('migrated-status')) {
        badge.classList.remove('m-badge--active');
        badge.classList.add('badge', 'badge--success', 'migrated-status');
        if (!badge.innerHTML.includes('✅')) badge.innerHTML = '✅ ' + badge.textContent.trim();
      }
    });

    metaPanel.querySelectorAll('.m-badge--soon').forEach(function(badge) {
      if (!badge.classList.contains('migrated-status')) {
        badge.classList.remove('m-badge--soon');
        badge.classList.add('badge', 'badge--warning', 'migrated-status');
        if (!badge.innerHTML.includes('⏰')) badge.innerHTML = '⏰ ' + badge.textContent.trim();
      }
    });

    metaPanel.querySelectorAll('.m-badge:not(.m-badge--active):not(.m-badge--soon):not(.migrated-status)').forEach(function(badge) {
      badge.classList.remove('m-badge');
      badge.classList.add('badge', 'badge--info', 'migrated-status');
    });

    metaPanel.querySelectorAll('.m-done.m-done--on').forEach(function(btn) {
      if (!btn.classList.contains('badge')) {
        btn.classList.add('badge', 'badge--success');
        if (!btn.innerHTML.includes('✅')) btn.innerHTML = '✅ ' + btn.textContent.trim();
      }
    });
  }

  function migrateExpansionBadges(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    metaPanel.querySelectorAll('.badge-exp').forEach(function(badge) {
      if (!badge.classList.contains('pill')) {
        badge.classList.add('pill');
        var icon = badge.querySelector('img');
        if (icon) { icon.style.height = '24px'; icon.style.width = 'auto'; }
        badge.style.padding  = '2px 10px';
        badge.style.fontSize = '0.75rem';
      }
    });
  }

  function migrateItemTags(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;

    metaPanel.querySelectorAll('.m-tag.tag--inf').forEach(function(tag) {
      if (!tag.classList.contains('badge')) {
        tag.classList.add('badge', 'badge--info');
        tag.classList.remove('m-tag', 'tag--inf');
        if (!tag.innerHTML.includes('💎')) tag.innerHTML = '💎 ' + tag.textContent.trim();
      }
    });

    metaPanel.querySelectorAll('.m-tag.tag--drop').forEach(function(tag) {
      if (!tag.classList.contains('badge')) {
        tag.classList.add('badge', 'badge--warning');
        tag.classList.remove('m-tag', 'tag--drop');
        if (!tag.innerHTML.includes('📦')) tag.innerHTML = '📦 ' + tag.textContent.trim();
      }
    });
  }

  function migrateNextTime(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel') || host;
    metaPanel.querySelectorAll('.m-next').forEach(function(span) {
      if (!span.classList.contains('pill') && span.textContent.trim()) {
        span.classList.add('pill');
        span.style.fontSize = '0.7rem';
        span.style.padding  = '2px 8px';
      }
    });
  }

  function applyMetaPolish(root) {
    var host      = root || document;
    var metaPanel = host.querySelector('#metaPanel');
    if (!metaPanel || metaPanel.hasAttribute('hidden')) return;
    migrateCardsToCardClass(metaPanel);
    migrateStatusBadges(metaPanel);
    migrateExpansionBadges(metaPanel);
    migrateItemTags(metaPanel);
    migrateNextTime(metaPanel);
  }

  // ==========================================================================
  // INICIALIZACIÓN DE BARRA DE HORARIOS
  // ==========================================================================

  function initMetaClockBar() {
    var metaPanel = document.getElementById('metaPanel');
    if (!metaPanel || metaPanel.hasAttribute('hidden')) return;
    renderMetaClockBar(metaPanel);
  }

  // ==========================================================================
  // OBSERVADORES
  // ==========================================================================

  var mo = null;
  function ensureObserver() {
    if (mo) return;
    var panel = document.getElementById('metaPanel') || document;
    mo = new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        if (!m.addedNodes) return;
        m.addedNodes.forEach(function(n) {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && (n.matches('.meta-card, .m-card'))) {
            applyMetaTheme(n);
          } else {
            Array.from(n.querySelectorAll('.meta-card, .m-card')).forEach(applyMetaTheme);
          }
        });
      });
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  function ensurePolishObserver() {
    var panel = document.getElementById('metaPanel');
    if (!panel || panel.__metaPolishObserver) return;
    var observer = new MutationObserver(function(mutations) {
      var needsPolish = false;
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList &&
                  (node.classList.contains('meta-card') || node.classList.contains('m-card'))) {
                needsPolish = true;
              }
              if (node.querySelectorAll &&
                  node.querySelectorAll('.meta-card, .m-card').length) {
                needsPolish = true;
              }
            }
          });
        }
      });
      if (needsPolish) setTimeout(function() { applyMetaPolish(panel); }, 20);
    });
    observer.observe(panel, { childList: true, subtree: true });
    panel.__metaPolishObserver = observer;
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================

  function initMetaPolish() {
    var metaPanel = document.getElementById('metaPanel');
    if (metaPanel && !metaPanel.hasAttribute('hidden')) {
      setTimeout(function() { applyMetaPolish(document); }, 50);
    }
    ensurePolishObserver();
  }

  function onRoute() {
    requestAnimationFrame(function() {
      themeMetaNow(document);
      applyMetaPolish(document);
      initMetaClockBar();
    });
  }

  // ==========================================================================
  // EVENTOS
  // ==========================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      onRoute();
      ensureObserver();
      initMetaPolish();
    });
  } else {
    onRoute();
    ensureObserver();
    initMetaPolish();
  }

  window.addEventListener('hashchange', function() {
    var p = document.getElementById('metaPanel');
    if (p && !p.hasAttribute('hidden')) {
      setTimeout(function() { initMetaClockBar(); }, 50);
      onRoute();
    }
  });

  document.addEventListener('gn:tabchange', function(ev) {
    if (ev.detail && ev.detail.view === 'meta') {
      setTimeout(function() {
        themeMetaNow(document);
        applyMetaPolish(document);
        initMetaClockBar();
      }, 100);
    }
  });

  document.addEventListener('gn:tokenchange', function() {
    setTimeout(function() {
      themeMetaNow(document);
      applyMetaPolish(document);
      initMetaClockBar();
    }, 150);
  });

  console.info('[MetaTheme] ready v1.4.2 — solo border-left, hereda .card de theme-polish.css');
})();