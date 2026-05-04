/*!
 * js/converter-modal.js — Conversor Gem ↔ Gold (Modal)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 1.0.0 (2026-05-04)
 *
 * Extraído de app.js para independizar el conversor en un modal
 * con estructura preparada para futuras tabs (Ofertas, Historial).
 *
 * Fase 1: Conversor funcional completo + tabs placeholder
 * Fase 2 (futura): Tab "Ofertas" con Compañía de Comercio
 * Fase 3 (futura): Tab "Historial" con tendencia de gemas
 */

(function (root) {
  'use strict';

  var LOG = '[ConverterModal]';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // =======================================================================
  // CONFIGURACIÓN
  // =======================================================================
  var LS_CONV = 'gw2_conv_cache_v3';
  var CONV_TTL = 1000 * 60 * 30; // 30 minutos

  // =======================================================================
  // ESTADO
  // =======================================================================
  var state = {
    inited: false,
    activeTab: 'cambio', // 'cambio' | 'ofertas' | 'historial'
    transacciones: {
      buys: [],
      sells: [],
      itemsById: {},
      loading: false,
      lastUpdate: 0,
      filters: {
        type: 'all' // 'all', 'buys', 'sells'
      }
    },
    ofertas: {
      listings: [],
      prices: [],
      itemsById: {},
      loading: false,
      lastUpdate: 0,
      filters: {
        rarity: '',
        minVolume: 0
      }
    }
  };

  // =======================================================================
  // UTILIDADES
  // =======================================================================
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  function splitCopper(v) {
    var g = Math.floor(v / 10000);
    var s = Math.floor((v % 10000) / 100);
    var c = v % 100;
    return { g: g, s: s, c: c };
  }

  function badgesHTMLFromCopper(copper) {
    var coins = splitCopper(copper || 0);
    var p = [];
    if (coins.g) p.push('<span class="coin coin--g">' + coins.g.toLocaleString() + '</span>');
    if (coins.s) p.push('<span class="coin coin--s">' + coins.s + '</span>');
    if (coins.c) p.push('<span class="coin coin--c">' + coins.c + '</span>');
    return p.length ? p.join('') : '0';
  }

  function markUpdated(node, ttl) {
    try {
      if (!node) return;
      node.classList.remove('updated');
      void node.offsetHeight;
      node.classList.add('updated');
      setTimeout(function () { node.classList.remove('updated'); }, ttl || 220);
    } catch (_) {}
  }

  // =======================================================================
  // CACHÉ DE CONVERSIÓN
  // =======================================================================
  function convGet() {
    try { return JSON.parse(localStorage.getItem(LS_CONV) || '{}'); } catch (_) { return {}; }
  }
  function convPut(k, v) {
    try {
      var m = convGet();
      m[k] = { v: v, ts: Date.now() };
      localStorage.setItem(LS_CONV, JSON.stringify(m));
    } catch (_) {}
  }
  function convVal(k) {
    var m = convGet();
    if (!m[k]) return null;
    if ((Date.now() - m[k].ts) > CONV_TTL) return null;
    return m[k].v;
  }

  // =======================================================================
  // API DE CONVERSIÓN
  // =======================================================================
  function apiCoinsRaw(copper) {
    var url = 'https://api.guildwars2.com/v2/commerce/exchange/coins?quantity=' + copper;
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
      return r.text().then(function (raw) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (raw || ''));
        var o;
        try { o = JSON.parse(raw); } catch (e) { throw new Error('JSON inválido (coins): ' + (raw || '').slice(0, 200)); }
        return o;
      });
    });
  }

  function apiGemsRaw(gems) {
    var url = 'https://api.guildwars2.com/v2/commerce/exchange/gems?quantity=' + gems;
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
      return r.text().then(function (raw) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (raw || ''));
        var o;
        try { o = JSON.parse(raw); } catch (e) { throw new Error('JSON inválido (gems): ' + (raw || '').slice(0, 200)); }
        return o;
      });
    });
  }

  async function gemsForCoins(copper) {
    var k = 'coins2gems_' + copper;
    var v = convVal(k);
    if (v != null) return v;
    var o = await apiCoinsRaw(copper);
    var gems = Number.isFinite(+o?.quantity) ? +o.quantity
      : Number.isFinite(+o?.gems) ? +o.gems
      : (Number.isFinite(+o?.coins_per_gem) ? Math.floor(+copper / +o.coins_per_gem) : NaN);
    if (!Number.isFinite(gems)) throw new Error('Respuesta inválida coins->gems');
    convPut(k, gems);
    return gems;
  }

  async function coinsForGems(gems) {
    var k = 'gems2coins_' + gems;
    var v = convVal(k);
    if (v != null) return v;
    var o = await apiGemsRaw(gems);
    var copper = Number.isFinite(+o?.quantity) ? +o.quantity
      : Number.isFinite(+o?.coins) ? +o.coins
      : (Number.isFinite(+o?.coins_per_gem) ? Math.floor(+gems * +o.coins_per_gem) : NaN);
    if (!Number.isFinite(copper)) throw new Error('Respuesta inválida gems->coins');
    convPut(k, copper);
    return copper;
  }

  async function costToBuyGems_coinsMarket(targetGems) {
    if (targetGems <= 0) return 0;
    var lo = 0;
    var hi = 10000 * 10000;
    while (await gemsForCoins(hi) < targetGems) {
      hi = Math.min(hi * 2, 5e11);
      if (hi >= 5e11) break;
    }
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      var g = await gemsForCoins(mid);
      if (g >= targetGems) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  async function gemsToBuyGold_gemsMarket(targetCopper) {
    if (targetCopper <= 0) return 0;
    var lo = 0, hi = 100;
    while (await coinsForGems(hi) < targetCopper) {
      hi = Math.min(hi * 2, 3e6);
      if (hi >= 3e6) break;
    }
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      var c = await coinsForGems(mid);
      if (c >= targetCopper) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  // =======================================================================
  // CONVENIENCIA (400 GEMAS)
  // =======================================================================
  function scoreFromPrice400(priceGold) {
    var p = Number(priceGold || 0);
    if (!Number.isFinite(p) || p <= 0) return { score: 0, tier: 'bad' };
    if (p <= 108)            return { score: 1.00, tier: 'exc' };
    if (p > 108 && p < 120)  return { score: 1.00 - ((p - 108) / (120 - 108)) * 0.15, tier: 'good' };
    if (p >= 120 && p <=130) return { score: 0.85, tier: 'good' };
    if (p > 130 && p < 160)  return { score: 0.85 - ((p - 130) / (160 - 130)) * 0.65, tier: 'mid' };
    return { score: 0.05, tier: 'bad' };
  }

  function labelForScore(score) {
    if (score >= 0.95) return 'Excelente';
    if (score >= 0.80) return 'Muy conveniente';
    if (score >= 0.65) return 'Bueno';
    if (score >= 0.45) return 'Normal';
    if (score >= 0.25) return 'Bajo';
    return 'Muy bajo';
  }

  function classForScore(score) {
    if (score >= 0.95) return 'is-exc';
    if (score >= 0.80) return 'is-good';
    if (score >= 0.65) return 'is-good';
    if (score >= 0.45) return 'is-mid';
    if (score >= 0.25) return 'is-low';
    return 'is-bad';
  }

  function renderConvenience(priceCopperFor400) {
    try {
      var elBar  = document.getElementById('cvScoreBar');
      var elLbl  = document.getElementById('cvScoreLabel');
      var elHint = document.getElementById('cvScoreHint');
      var meter  = document.querySelector('#convModal .conv2-meter');
      if (!elBar || !elLbl || !elHint || !meter) return;

      var gold = Number(priceCopperFor400 || 0) / 10000;
      if (!Number.isFinite(gold) || gold <= 0) {
        elBar.style.width = '0%';
        elBar.className = 'conv2-meter__fill';
        elLbl.textContent = '—';
        elHint.textContent = 'Sin datos de referencia aún.';
        meter.setAttribute('aria-valuenow', '0');
        return;
      }

      var result = scoreFromPrice400(gold);
      var pct = Math.round(result.score * 100);
      var cls = classForScore(result.score);
      var lbl = labelForScore(result.score);

      elBar.className = 'conv2-meter__fill ' + cls;
      elBar.style.width = pct + '%';
      elLbl.textContent = lbl + ' (' + gold.toFixed(2) + ' o / 400)';
      elHint.textContent = (result.score >= 0.65)
        ? 'Es un buen momento según la referencia definida (120–130 o/400).'
        : (result.score >= 0.45)
          ? 'En línea con valores normales.'
          : 'Poco conveniente frente a la referencia (120–130 o/400).';
      meter.setAttribute('aria-valuenow', String(pct));
      markUpdated(elBar);
    } catch (_) {}
  }

  // =======================================================================
  // EVENTOS DEL CONVERSOR
  // =======================================================================
  var _convTimer = null;

  function setGemsOut(val) {
    var el = document.getElementById('cvGoldOut');
    if (!el) return;
    if (!Number.isFinite(val) || val <= 0) { el.textContent = '—'; return; }
    el.textContent = String(Math.floor(val));
    markUpdated(el);
  }

  function setBadges(container, copper) {
    if (!container) return;
    if (!Number.isFinite(copper) || copper <= 0) { container.innerHTML = '—'; return; }
    container.innerHTML = badgesHTMLFromCopper(copper);
    markUpdated(container);
  }

  function setConvState(msg, kind) {
    var el = document.getElementById('cvState');
    if (!el) return;
    el.textContent = msg;
    el.style.color = (kind === 'error') ? '#f28b82' : '#a0a0a6';
  }

  async function onTopInput() {
    try {
      var gs = String(document.getElementById('cvGems')?.value || '').trim();
      if (gs === '' || Number(gs) <= 0) {
        document.getElementById('cvGems').value = '';
        setBadges(document.getElementById('cvGemsOut'), 0);
        setConvState('Ingresá gemas.');
        renderConvenience(0);
        return;
      }
      var gems = Math.max(0, Math.floor(Number(gs)));
      document.getElementById('cvGems').value = String(gems);
      setConvState('Calculando costo (coins→gems)…');
      var copper = await costToBuyGems_coinsMarket(gems);
      setBadges(document.getElementById('cvGemsOut'), copper);
      setConvState('Actualizado.');
      if (gems > 0) {
        var copperFor400 = Math.round((copper / gems) * 400);
        renderConvenience(copperFor400);
      }
    } catch (e) {
      console.error('[Conv] top', e);
      setBadges(document.getElementById('cvGemsOut'), 0);
      setConvState('No se pudo calcular costo.', 'error');
      renderConvenience(0);
    }
  }

  async function onBottomInput() {
    try {
      var g = String(document.getElementById('cvGold')?.value || '').trim();
      if (g === '' || Number(g) <= 0) {
        document.getElementById('cvGold').value = '';
        setGemsOut(0);
        setConvState('Ingresá oro.');
        return;
      }
      var gold = Math.max(0, Math.floor(Number(g)));
      document.getElementById('cvGold').value = String(gold);
      var copper = gold * 10000;
      setConvState('Calculando gemas (gems→coins)…');
      var gems = await gemsToBuyGold_gemsMarket(copper);
      setGemsOut(gems);
      setConvState('Actualizado.');
    } catch (e) {
      console.error('[Conv] bottom', e);
      setGemsOut(0);
      setConvState('No se pudo calcular gemas.', 'error');
    }
  }

  async function updateRef400() {
    try {
      var k = 'ref_400_v3';
      var copper = convVal(k);
      if (copper == null) {
        copper = await costToBuyGems_coinsMarket(400);
        convPut(k, copper);
      }
      var el = document.getElementById('cvRef400');
      if (el) {
        el.innerHTML = '<span style="display:inline-flex;gap:6px;align-items:center;margin-right:8px">' +
          '<img src="assets/icons/502065.png" width="24" height="24" style="vertical-align:-2px" alt="">' +
          '<strong>400</strong></span> ' + badgesHTMLFromCopper(copper);
        markUpdated(el);
      }
      renderConvenience(copper);
      root.toast?.('success', 'Referencia 400 actualizada', { ttl: 1500 });
    } catch (e) {
      console.warn('[Conv] ref400', e);
      var elRef = document.getElementById('cvRef400');
      if (elRef) elRef.textContent = '—';
      renderConvenience(0);
      root.toast?.('warn', 'No se pudo actualizar la referencia 400', { ttl: 2000 });
    }
  }

  // =======================================================================
  // OFERTAS — ITEMS POPULARES EN EL TRADING POST
  // =======================================================================
  //
  // Muestra los ítems con mayor volumen de transacciones en la Compañía
  // de Comercio. Ordenado por cantidad total de órdenes (compras + ventas).
  //
  // Útil para saber qué items se mueven rápido, qué legendarias tienen
  // más liquidez, y entender el pulso del mercado.

  var RARITY_COLORS = {
    'Junk': '#AAAAAA', 'Basic': '#FFFFFF', 'Fine': '#62A4DA',
    'Masterwork': '#1A9306', 'Rare': '#FCD00B', 'Exotic': '#FFA405',
    'Ascended': '#FB3E8D', 'Legendary': '#974EFF'
  };

  function getRarityLabel(r) {
    var map = {
      'Junk': 'Chatarra', 'Basic': 'Básico', 'Fine': 'Bueno',
      'Masterwork': 'Obra maestra', 'Rare': 'Raro', 'Exotic': 'Exótico',
      'Ascended': 'Ascendido', 'Legendary': 'Legendario'
    };
    return map[r] || r || '—';
  }

  function getRarityOrder(rarity) {
    var order = {
      'Junk': 0, 'Basic': 1, 'Fine': 2, 'Masterwork': 3,
      'Rare': 4, 'Exotic': 5, 'Ascended': 6, 'Legendary': 7
    };
    return order[rarity] != null ? order[rarity] : -1;
  }

  async function loadOfertas(forceNoCache) {
    var st = state.ofertas;
    if (st.loading) return;
    st.loading = true;

    try {
      // Paso 1: Obtener listado de IDs del TP
      var allIds = await root.GW2Api.getCommerceListings({ nocache: !!forceNoCache });
      if (!allIds || !allIds.length) {
        st.listings = [];
        st.prices = [];
        st.lastUpdate = Date.now();
        return;
      }

      // Tomar últimos 200 IDs (los más nuevos, suelen ser los más activos)
      var sampleIds = allIds.slice(-200);

      // Paso 2: Obtener precios
      var prices = await root.GW2Api.getCommercePrices(sampleIds, { nocache: !!forceNoCache });

      // Paso 3: Obtener metadatos de items
      var itemIds = prices.map(function (p) { return p.id; });
      var items = await root.GW2Api.getItemsMany(itemIds, { nocache: false });
      var itemsById = {};
      items.forEach(function (it) { if (it && it.id != null) itemsById[it.id] = it; });

      st.listings = sampleIds;
      st.prices = prices;
      st.itemsById = itemsById;
      st.lastUpdate = Date.now();
    } catch (e) {
      console.warn(LOG, 'Error loading ofertas:', e);
    } finally {
      st.loading = false;
      renderOfertas();
    }
  }

  function getFilteredOfertas() {
    var st = state.ofertas;
    var f = st.filters;

    return st.prices
      .filter(function (p) {
        // Necesitamos al menos compras o ventas
        var totalVol = (p.buys ? p.buys.quantity || 0 : 0) + (p.sells ? p.sells.quantity || 0 : 0);
        if (totalVol <= 0) return false;

        if (f.rarity) {
          var item = st.itemsById[p.id];
          if (!item || !item.rarity) return false;

          // Si el filtro es "Legendary", mostrar solo Legendary
          // Si es otro, excluir Legendary y Ascended (dominan el top)
          if (f.rarity === 'Legendary') {
            if (item.rarity !== 'Legendary') return false;
          } else if (f.rarity === 'Ascended') {
            if (item.rarity !== 'Ascended') return false;
          } else if (f.rarity === 'non_legendary') {
            if (item.rarity === 'Legendary' || item.rarity === 'Ascended') return false;
          } else {
            if (item.rarity !== f.rarity) return false;
          }
        }

        if (f.minVolume > 0 && totalVol < f.minVolume) return false;

        return true;
      })
      .map(function (p) {
        var item = st.itemsById[p.id] || {};
        var buyQty = p.buys ? p.buys.quantity || 0 : 0;
        var sellQty = p.sells ? p.sells.quantity || 0 : 0;
        var totalVol = buyQty + sellQty;
        var spread = p.sells && p.buys ? p.sells.unit_price - p.buys.unit_price : 0;
        var spreadPct = p.buys && p.buys.unit_price > 0 ? ((spread / p.buys.unit_price) * 100) : 0;

        return {
          id: p.id,
          buys: p.buys,
          sells: p.sells,
          item: item,
          buyQty: buyQty,
          sellQty: sellQty,
          totalVol: totalVol,
          spread: spread,
          spreadPct: spreadPct
        };
      })
      .sort(function (a, b) {
        // Legendarias: ordenar por volumen de venta (sellQty)
        if (state.ofertas.filters.rarity === 'Legendary') {
          return b.sellQty - a.sellQty;
        }
        // Resto: ordenar por volumen total
        return b.totalVol - a.totalVol;
      })
      .slice(0, 15);
  }

  function renderOfertas() {
    var container = document.querySelector('#convModal .conv-tab-content[data-tab="populares"]');
    if (!container) return;

    var st = state.ofertas;

    if (st.loading) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
        '<div class="skeleton-enhanced" style="height:200px;margin-bottom:16px;"></div>Analizando el mercado…</div>';
      return;
    }

    if (!st.prices.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
        '<img src="assets/icons/155033.png" width="48" height="48" alt="" style="opacity:0.3;margin-bottom:16px;"><br>' +
        'No se pudieron cargar los datos del mercado.<br>' +
        '<button id="cvOfertasRetry" class="btn btn--ghost" style="margin-top:16px;">Reintentar</button></div>';
      return;
    }

    var filtered = getFilteredOfertas();
    var lastUpdateStr = st.lastUpdate ? 'Actualizado hace ' + Math.floor((Date.now() - st.lastUpdate) / 1000) + 's' : '—';
    var isLegendaryFilter = state.ofertas.filters.rarity === 'Legendary';

    var html =
      '<div style="margin-bottom:8px;font-size:0.75rem;color:#9aa2b8;line-height:1.5;">' +
        (isLegendaryFilter
          ? '� <strong>Legendarias más activas:</strong> ordenadas por cantidad de gente vendiendo. A más vendedores, más liquidez y precios más competitivos.'
          : '📊 <strong>Ítems más populares:</strong> ordenados por volumen total de órdenes de compra y venta. Mostrando los que más se mueven. Usá el filtro de rareza para enfocarte.') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<select id="cvOfertasRarity" style="background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;padding:6px 12px;font-size:0.75rem;">' +
          '<option value="">Todas las rarezas</option>' +
          '<option value="Legendary">💜 Legendarias</option>' +
          '<option value="Ascended">Ascendido</option>' +
          '<option value="Exotic">Exótico</option>' +
          '<option value="Rare">Raro</option>' +
          '<option value="Masterwork">Obra maestra</option>' +
          '<option value="Fine">Bueno</option>' +
          '<option value="non_legendary">No legendario/ascendido</option>' +
        '</select>' +
        '<select id="cvOfertasVolume" style="background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;padding:6px 12px;font-size:0.75rem;">' +
          '<option value="0">Cualquier volumen</option>' +
          '<option value="100">> 100 unidades</option>' +
          '<option value="500">> 500 unidades</option>' +
          '<option value="1000">> 1,000 unidades</option>' +
        '</select>' +
        '<button id="cvOfertasRefresh" class="btn btn--ghost btn--xs" style="display:inline-flex;align-items:center;gap:4px;">' +
          '<img src="assets/icons/Welcome/834002.png" width="12" height="12" alt="">Refrescar</button>' +
        '<span class="muted" style="font-size:0.7rem;margin-left:auto;">' + esc(lastUpdateStr) + '</span>' +
      '</div>';

    if (!filtered.length) {
      html += '<div class="muted" style="text-align:center;padding:30px;">' +
        '� No se encontraron ítems con esos filtros.<br>' +
        '<span style="font-size:0.75rem;">Probá con una rareza diferente.</span></div>';
    } else {
      html +=
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">' +
            '<thead>' +
              '<tr style="border-bottom:2px solid #2a2c35;">' +
                '<th style="padding:8px 6px;text-align:left;color:#9aa2b8;font-weight:600;">Ítem</th>' +
                '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Compra</th>' +
                '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Venta</th>' +
                '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">' + (isLegendaryFilter ? 'Vendedores' : 'Vol. total') + '</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>';

      filtered.forEach(function (p, idx) {
        var item = p.item || {};
        var icon = item.icon || '';
        var name = item.name || ('Ítem #' + p.id);
        var rarity = item.rarity || '';
        var rarityLabel = getRarityLabel(rarity);
        var rarityColor = RARITY_COLORS[rarity] || '#FFFFFF';
        var spread = p.spread;
        var spreadPct = p.spreadPct.toFixed(1);
        var spreadColor = spread > 0 ? '#a0ffc8' : '#9aa2b8';

        html +=
          '<tr style="border-bottom:1px solid #1f2026;' + (idx % 2 === 0 ? 'background:#0a0c10;' : '') + '">' +
            '<td style="padding:8px 6px;display:flex;align-items:center;gap:6px;">' +
              (icon ? '<img src="' + esc(icon) + '" width="28" height="28" alt="" style="border-radius:4px;">' : '') +
              '<div>' +
                '<div style="font-weight:600;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(name) + '">' + esc(name) + '</div>' +
                '<span style="font-size:0.65rem;color:' + rarityColor + ';">' + esc(rarityLabel) + '</span>' +
              '</div>' +
            '</td>' +
            '<td style="padding:8px 6px;text-align:right;font-family:monospace;">' +
              (p.buys ? formatCoinsShort(p.buys.unit_price) : '—') +
              '<div style="font-size:0.6rem;color:#9aa2b8;">' + (p.buyQty ? p.buyQty.toLocaleString('es-AR') + ' comp' : '') + '</div>' +
            '</td>' +
            '<td style="padding:8px 6px;text-align:right;font-family:monospace;">' +
              (p.sells ? formatCoinsShort(p.sells.unit_price) : '—') +
              '<div style="font-size:0.6rem;color:#9aa2b8;">' + (p.sellQty ? p.sellQty.toLocaleString('es-AR') + ' vend' : '') + '</div>' +
            '</td>' +
            '<td style="padding:8px 6px;text-align:right;">' +
              (isLegendaryFilter
                ? '<span style="color:#ffd36b;font-weight:600;">' + p.sellQty.toLocaleString('es-AR') + '</span>'
                : '<span style="color:#7bc2ff;font-weight:600;">' + p.totalVol.toLocaleString('es-AR') + '</span>'
              ) +
            '</td>' +
          '</tr>';
      });

      html +=
            '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="muted" style="text-align:center;padding:8px;font-size:0.7rem;">Mostrando ' + filtered.length + ' de ' + st.prices.length + ' ítems analizados · ' + esc(lastUpdateStr) + '</div>';
    }

    container.innerHTML = html;
    wireOfertasEvents();
  }

  function formatCoinsShort(copper) {
    if (!copper || copper <= 0) return '—';
    var g = Math.floor(copper / 10000);
    var s = Math.floor((copper % 10000) / 100);
    var c = copper % 100;
    var parts = [];
    if (g > 0) parts.push('<span style="color:#f4c542;font-weight:600;">' + g + '</span> <span style="color:#9aa2b8;">g</span>');
    if (s > 0) parts.push('<span style="color:#e0e0e0;font-weight:500;">' + s + '</span> <span style="color:#9aa2b8;">s</span>');
    parts.push('<span style="color:#b87333;font-weight:500;">' + c + '</span> <span style="color:#9aa2b8;">c</span>');
    return parts.join(' ');
  }

  function wireOfertasEvents() {
    var raritySel = document.getElementById('cvOfertasRarity');
    var volumeSel = document.getElementById('cvOfertasVolume');
    var refreshBtn = document.getElementById('cvOfertasRefresh');
    var retryBtn = document.getElementById('cvOfertasRetry');

    if (raritySel && !raritySel.__wired) {
      raritySel.__wired = true;
      raritySel.addEventListener('change', function () {
        state.ofertas.filters.rarity = raritySel.value || '';
        renderOfertas();
      });
    }
    if (volumeSel && !volumeSel.__wired) {
      volumeSel.__wired = true;
      volumeSel.addEventListener('change', function () {
        state.ofertas.filters.minVolume = Number(volumeSel.value) || 0;
        renderOfertas();
      });
    }
    if (refreshBtn && !refreshBtn.__wired) {
      refreshBtn.__wired = true;
      refreshBtn.addEventListener('click', function () {
        loadOfertas(true);
      });
    }
    if (retryBtn && !retryBtn.__wired) {
      retryBtn.__wired = true;
      retryBtn.addEventListener('click', function () {
        loadOfertas(true);
      });
    }
  }

  // =======================================================================
  // MIS TRANSACCIONES — ÓRDENES ACTIVAS EN EL TP
  // =======================================================================
  //
  // Muestra las órdenes de compra y venta activas del jugador en la
  // Compañía de Comercio. Requiere token con permiso 'tradingpost'.

  async function loadTransacciones(forceNoCache) {
    var st = state.transacciones;
    if (st.loading) return;
    st.loading = true;

    try {
      var token = getSelectedTokenForCommerce();
      if (!token) {
        st.buys = []; st.sells = []; st.lastUpdate = Date.now();
        return;
      }

      var results = await Promise.allSettled([
        root.GW2Api.getCommerceTransactionsBuys(token, { nocache: !!forceNoCache }),
        root.GW2Api.getCommerceTransactionsSells(token, { nocache: !!forceNoCache })
      ]);

      var buys = results[0].status === 'fulfilled' ? results[0].value : [];
      var sells = results[1].status === 'fulfilled' ? results[1].value : [];

      // Obtener metadatos de items
      var itemIds = buys.concat(sells).map(function (tx) { return tx.item_id; }).filter(Boolean);
      var uniqueIds = Array.from(new Set(itemIds));
      var items = await root.GW2Api.getItemsMany(uniqueIds, { nocache: false });
      var itemsById = {};
      items.forEach(function (it) { if (it && it.id != null) itemsById[it.id] = it; });

      st.buys = buys;
      st.sells = sells;
      st.itemsById = itemsById;
      st.lastUpdate = Date.now();
    } catch (e) {
      console.warn(LOG, 'Error loading transacciones:', e);
    } finally {
      st.loading = false;
      renderTransacciones();
    }
  }

  function getFilteredTransacciones() {
    var st = state.transacciones;
    var f = st.filters;
    var all = [];

    if (f.type === 'all' || f.type === 'buys') {
      st.buys.forEach(function (tx) {
        all.push({
          id: tx.id,
          item_id: tx.item_id,
          type: 'buy',
          price: tx.price,
          quantity: tx.quantity,
          total: tx.price * tx.quantity,
          created: tx.created,
          item: st.itemsById[tx.item_id] || {}
        });
      });
    }

    if (f.type === 'all' || f.type === 'sells') {
      st.sells.forEach(function (tx) {
        all.push({
          id: tx.id,
          item_id: tx.item_id,
          type: 'sell',
          price: tx.price,
          quantity: tx.quantity,
          total: tx.price * tx.quantity,
          created: tx.created,
          item: st.itemsById[tx.item_id] || {}
        });
      });
    }

    all.sort(function (a, b) {
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    return all;
  }

  function renderTransacciones() {
    var container = document.querySelector('#convModal .conv-tab-content[data-tab="transacciones"]');
    if (!container) return;
    var st = state.transacciones;

    if (st.loading) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
        '<div class="skeleton-enhanced" style="height:200px;margin-bottom:16px;"></div>Cargando tus transacciones…</div>';
      return;
    }

    var token = getSelectedTokenForCommerce();
    if (!token) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
        '<img src="assets/icons/155048.png" width="48" height="48" alt="" style="opacity:0.3;margin-bottom:16px;"><br>' +
        '🔑 Necesitás una API Key con permiso <strong>tradingpost</strong>.<br>' +
        '<span style="font-size:0.75rem;">Agregala en <a href="https://account.arena.net/applications" target="_blank" rel="noopener" style="color:#7bc2ff;">account.arena.net</a></span></div>';
      return;
    }

    if (!st.buys.length && !st.sells.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
        '<img src="assets/icons/155033.png" width="48" height="48" alt="" style="opacity:0.3;margin-bottom:16px;"><br>' +
        '📭 No tenés órdenes activas en el TP.<br>' +
        '<button id="cvTransaccionesRefresh" class="btn btn--ghost" style="margin-top:16px;">Refrescar</button></div>';
      wireTransaccionesEvents();
      return;
    }

    var filtered = getFilteredTransacciones();
    var lastUpdateStr = st.lastUpdate ? 'Actualizado hace ' + Math.floor((Date.now() - st.lastUpdate) / 1000) + 's' : '—';

    // Calcular totales
    var totalCompras = st.buys.reduce(function(sum, tx) { return sum + (tx.price * tx.quantity); }, 0);
    var totalVentas = st.sells.reduce(function(sum, tx) { return sum + (tx.price * tx.quantity); }, 0);
    var balance = totalVentas - totalCompras;
    var balanceColor = balance >= 0 ? '#a0ffc8' : '#ff9d9d';
    var balanceSign = balance >= 0 ? '+' : '';

    var html =
      '<div style="margin-bottom:8px;font-size:0.75rem;color:#9aa2b8;line-height:1.5;">' +
        '📋 <strong>Tus órdenes activas</strong> en la Compañía de Comercio. ' +
        'Compras: <span style="color:#a0ffc8;">' + st.buys.length + '</span> · ' +
        'Ventas: <span style="color:#ff9d9d;">' + st.sells.length + '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">' +
        '<div style="background:#0f1116;border-radius:8px;padding:8px 10px;border-left:3px solid #ff9d9d;box-shadow:0 0 6px rgba(255,157,157,0.12);">' +
          '<div style="font-size:0.6rem;color:#b4bad0;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">💰 Total en compras</div>' +
          '<div style="font-weight:700;color:#ff9d9d;font-size:0.85rem;">' + formatCoinsShort(totalCompras) + '</div>' +
        '</div>' +
        '<div style="background:#0f1116;border-radius:8px;padding:8px 10px;border-left:3px solid #a0ffc8;box-shadow:0 0 6px rgba(160,255,200,0.12);">' +
          '<div style="font-size:0.6rem;color:#b4bad0;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">📈 Total en ventas</div>' +
          '<div style="font-weight:700;color:#a0ffc8;font-size:0.85rem;">' + formatCoinsShort(totalVentas) + '</div>' +
        '</div>' +
        '<div style="background:#0f1116;border-radius:8px;padding:8px 10px;border-left:3px solid ' + (balance >= 0 ? '#a0ffc8' : '#ff9d9d') + ';box-shadow:0 0 6px ' + (balance >= 0 ? 'rgba(160,255,200,0.15)' : 'rgba(255,157,157,0.15)') + ';">' +
          '<div style="font-size:0.6rem;color:#b4bad0;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">⚖️ Balance</div>' +
          '<div style="font-weight:700;color:' + balanceColor + ';font-size:0.85rem;">' + balanceSign + formatCoinsShort(Math.abs(balance)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<select id="cvTransaccionesType" style="background:#1a1c24;border:1px solid #2a2c35;border-radius:20px;color:#e0e4ed;padding:6px 12px;font-size:0.75rem;">' +
          '<option value="all">Todas las órdenes</option>' +
          '<option value="buys">🟢 Solo compras</option>' +
          '<option value="sells">🔴 Solo ventas</option>' +
        '</select>' +
        '<button id="cvTransaccionesRefresh" class="btn btn--ghost btn--xs" style="display:inline-flex;align-items:center;gap:4px;">' +
          '<img src="assets/icons/Welcome/834002.png" width="12" height="12" alt="">Refrescar</button>' +
        '<span class="muted" style="font-size:0.7rem;margin-left:auto;">' + esc(lastUpdateStr) + '</span>' +
      '</div>';

    if (!filtered.length) {
      html += '<div class="muted" style="text-align:center;padding:30px;">📭 No se encontraron órdenes con ese filtro.</div>';
    } else {
      html +=
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.78rem;">' +
          '<thead><tr style="border-bottom:2px solid #2a2c35;">' +
            '<th style="padding:8px 6px;text-align:left;color:#9aa2b8;font-weight:600;">Ítem</th>' +
            '<th style="padding:8px 6px;text-align:center;color:#9aa2b8;font-weight:600;">Tipo</th>' +
            '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Cantidad</th>' +
            '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Precio</th>' +
            '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Total</th>' +
            '<th style="padding:8px 6px;text-align:right;color:#9aa2b8;font-weight:600;">Creada</th>' +
          '</tr></thead><tbody>';

      filtered.forEach(function (tx, idx) {
        var item = tx.item || {};
        var icon = item.icon || '';
        var name = item.name || ('Ítem #' + tx.item_id);
        var rarityLabel = getRarityLabel(item.rarity || '');
        var rarityColor = RARITY_COLORS[item.rarity] || '#FFFFFF';
        var isBuy = tx.type === 'buy';
        var typeLabel = isBuy ? '🟢 Compra' : '🔴 Venta';
        var dateStr = tx.created ? new Date(tx.created).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

        html +=
          '<tr style="border-bottom:1px solid #1f2026;' + (idx % 2 === 0 ? 'background:#0a0c10;' : '') + '">' +
            '<td style="padding:8px 6px;display:flex;align-items:center;gap:6px;">' +
              (icon ? '<img src="' + esc(icon) + '" width="28" height="28" alt="" style="border-radius:4px;">' : '') +
              '<div>' +
                '<div style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(name) + '">' + esc(name) + '</div>' +
                '<span style="font-size:0.65rem;color:' + rarityColor + ';">' + esc(rarityLabel) + '</span>' +
              '</div>' +
            '</td>' +
            '<td style="padding:8px 6px;text-align:center;font-size:0.7rem;">' + typeLabel + '</td>' +
            '<td style="padding:8px 6px;text-align:right;">' + tx.quantity.toLocaleString('es-AR') + '</td>' +
            '<td style="padding:8px 6px;text-align:right;font-family:monospace;">' + formatCoinsShort(tx.price) + '</td>' +
            '<td style="padding:8px 6px;text-align:right;font-family:monospace;font-weight:600;color:' + (isBuy ? '#ff9d9d' : '#a0ffc8') + ';">' + formatCoinsShort(tx.total) + '</td>' +
            '<td style="padding:8px 6px;text-align:right;font-size:0.65rem;color:#9aa2b8;">' + dateStr + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div>' +
        '<div class="muted" style="text-align:center;padding:8px;font-size:0.7rem;">' + filtered.length + ' órdenes activas · ' + esc(lastUpdateStr) + '</div>';
    }

    container.innerHTML = html;
    wireTransaccionesEvents();
  }

  function wireTransaccionesEvents() {
    var typeSel = document.getElementById('cvTransaccionesType');
    var refreshBtn = document.getElementById('cvTransaccionesRefresh');
    var retryBtn = document.getElementById('cvTransaccionesRetry');
    if (typeSel && !typeSel.__wired) { typeSel.__wired = true; typeSel.addEventListener('change', function () { state.transacciones.filters.type = typeSel.value || 'all'; renderTransacciones(); }); }
    if (refreshBtn && !refreshBtn.__wired) { refreshBtn.__wired = true; refreshBtn.addEventListener('click', function () { loadTransacciones(true); }); }
    if (retryBtn && !retryBtn.__wired) { retryBtn.__wired = true; retryBtn.addEventListener('click', function () { loadTransacciones(true); }); }
  }

  function getSelectedTokenForCommerce() {
    try {
      var sel = document.getElementById('keySelectGlobal');
      return sel ? (sel.value || '').trim() : null;
    } catch (e) { return null; }
  }

  // =======================================================================
  // RENDERIZADO DEL MODAL
  // =======================================================================
  function ensureModal() {
    var modal = document.getElementById('convModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'convModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('hidden', '');
    modal.innerHTML =
      '<div class="modal__backdrop" data-close="1"></div>' +
      '<div class="modal__dialog" style="max-width: 580px;">' +
        '<header class="modal__header">' +
          '<h3 id="convModalTitle" style="display:flex;align-items:center;gap:10px;color:#fbe6b2;text-shadow:0 0 8px rgba(255,230,180,0.35);">' +
            '<img src="assets/icons/502065.png" width="22" height="22" alt="" style="filter:drop-shadow(0 0 4px rgba(75,189,240,0.5));">' +
            'Cambio de Divisas' +
            '<img src="assets/icons/784280.png" width="14" height="14" alt="↔" style="opacity:0.4;">' +
            '<img src="assets/icons/619316.png" width="22" height="22" alt="" style="filter:drop-shadow(0 0 4px rgba(244,197,66,0.5));">' +
          '</h3>' +
          '<button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button>' +
        '</header>' +
        // Tabs (Fase 2 y 3 como placeholder)
        '<div class="conv-modal-tabs" style="display:flex;gap:4px;padding:0 16px;border-bottom:1px solid #2a2c35;background:#0f1116;">' +
          '<button class="conv-modal-tab active" data-tab="cambio" style="background:transparent;border:none;padding:10px 16px;font-size:0.82rem;color:#7bc2ff;cursor:pointer;border-bottom:2px solid #7bc2ff;margin-bottom:-1px;transition:all 0.15s ease;font-weight:600;">' +
            '<img src="assets/icons/502065.png" width="16" height="16" alt="" style="vertical-align:middle;margin-right:5px;filter:drop-shadow(0 0 3px rgba(75,189,240,0.5));">Cambio' +
          '</button>' +
          '<button class="conv-modal-tab" data-tab="transacciones" style="background:transparent;border:none;padding:10px 16px;font-size:0.82rem;color:#9aa2b8;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all 0.15s ease;" onmouseover="this.style.color=\'#e0e4ed\';this.style.background=\'rgba(123,194,255,0.05)\'" onmouseout="this.style.color=\'#9aa2b8\';this.style.background=\'transparent\'">' +
            '<img src="assets/icons/155033.png" width="16" height="16" alt="" style="vertical-align:middle;margin-right:5px;opacity:0.6;">Transacciones' +
          '</button>' +
          '<button class="conv-modal-tab" data-tab="populares" style="background:transparent;border:none;padding:10px 16px;font-size:0.82rem;color:#9aa2b8;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all 0.15s ease;" onmouseover="this.style.color=\'#e0e4ed\';this.style.background=\'rgba(123,194,255,0.05)\'" onmouseout="this.style.color=\'#9aa2b8\';this.style.background=\'transparent\'">' +
            '<img src="assets/icons/155033.png" width="16" height="16" alt="" style="vertical-align:middle;margin-right:5px;opacity:0.6;">Populares' +
          '</button>' +
          '<button class="conv-modal-tab" data-tab="historial" style="background:transparent;border:none;padding:10px 16px;font-size:0.82rem;color:#9aa2b8;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all 0.15s ease;" onmouseover="this.style.color=\'#e0e4ed\';this.style.background=\'rgba(123,194,255,0.05)\'" onmouseout="this.style.color=\'#9aa2b8\';this.style.background=\'transparent\'">' +
            '<img src="assets/icons/3124974.png" width="16" height="16" alt="" style="vertical-align:middle;margin-right:5px;opacity:0.6;">Historial' +
          '</button>' +
        '</div>' +
        '<div class="modal__body" style="max-height:65vh;overflow-y:auto;">' +
          // Tab: Cambio
          '<div class="conv-tab-content" data-tab="cambio">' +
            '<div id="convWrap" class="conv2 conv2--clean" aria-live="polite" style="display:flex;flex-direction:column;gap:12px;">' +
              '<h4 class="conv2-label" style="display:inline-flex;align-items:center;gap:8px;margin:6px 0 4px;font-size:14px;">' +
                '<span style="width:32px;height:32px;border-radius:8px;background:rgba(75,189,240,0.1);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(75,189,240,0.25);">' +
                  '<img src="assets/icons/502065.png" width="20" height="20" alt="Gemas" style="display:block;">' +
                '</span>' +
                '<span style="color:#7dd3fc;font-weight:600;">Conseguir Gemas</span>' +
              '</h4>' +
              '<div class="conv2-card" style="background:#0f1116;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px;box-shadow:0 0 6px rgba(90,110,154,0.08);">' +
                '<div class="conv2-row" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;">' +
                  '<input id="cvGems" class="conv2-entry" type="number" min="0" max="9999" step="1" inputmode="numeric" autocomplete="off" placeholder="Gemas" style="background:transparent;border:0;outline:none;width:100%;color:#e9e9ee;font-size:18px;">' +
                  '<div id="cvGemsOut" class="coin-badges coin-badges--lg" style="display:inline-flex;gap:6px;align-items:center;background:#0a0c10;padding:6px 10px;border-radius:8px;border:1px solid #1f2026;min-width:80px;justify-content:flex-end;">—</div>' +
                '</div>' +
                '<div class="conv2-quick" id="cvGemsQuick" aria-label="Atajos de gemas" style="display:flex;gap:6px;margin-top:8px;">' +
                  '<button type="button" data-gems="100" class="conv2-chip" style="display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;border-radius:14px;font-size:0.7rem;font-weight:600;background:#1a1c24;border:1px solid #2a2c35;color:#b4bad0;cursor:pointer;transition:all 0.15s ease;">100</button>' +
                  '<button type="button" data-gems="400" class="conv2-chip">400</button>' +
                  '<button type="button" data-gems="800" class="conv2-chip">800</button>' +
                  '<button type="button" data-gems="1200" class="conv2-chip">1200</button>' +
                '</div>' +
              '</div>' +
              '<h4 class="conv2-label" style="display:inline-flex;align-items:center;gap:8px;margin:6px 0 4px;font-size:14px;">' +
                '<span style="width:32px;height:32px;border-radius:8px;background:rgba(244,197,66,0.1);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(244,197,66,0.25);">' +
                  '<img src="assets/icons/619316.png" width="20" height="20" alt="Oro" style="display:block;">' +
                '</span>' +
                '<span style="color:#f1cc7a;font-weight:600;">Conseguir Oro</span>' +
              '</h4>' +
              '<div class="conv2-card" style="background:#0f1116;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px;box-shadow:0 0 6px rgba(90,110,154,0.08);">' +
                '<div class="conv2-row" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;">' +
                  '<input id="cvGold" class="conv2-entry conv2-gold" type="number" min="0" max="9999" step="1" inputmode="numeric" autocomplete="off" placeholder="Oro (g)" style="background:transparent;border:0;outline:none;width:100%;color:#d7b062;font-size:18px;">' +
                  '<output id="cvGoldOut" class="conv2-gems" style="color:#e9e9ee;background:#0a0c10;padding:6px 10px;border-radius:8px;border:1px solid #1f2026;min-width:80px;text-align:right;font-weight:600;">—</output>' +
                '</div>' +
                '<div class="conv2-quick" id="cvGoldQuick" aria-label="Atajos de oro" style="display:flex;gap:6px;margin-top:8px;">' +
                  '<button type="button" data-gold="10" class="conv2-chip">10 g</button>' +
                  '<button type="button" data-gold="100" class="conv2-chip">100 g</button>' +
                  '<button type="button" data-gold="250" class="conv2-chip">250 g</button>' +
                '</div>' +
              '</div>' +
              '<div class="conv2-actions" style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">' +
                '<button id="cvRefresh" class="btn" title="Actualizar cotización" style="display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:6px 14px;">' +
                  '<img src="assets/icons/Welcome/834002.png" width="14" height="14" alt="">Actualizar' +
                '</button>' +
                '<span id="cvState" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:10px;font-size:0.7rem;background:#1a3a2a;color:#a0ffc8;border:1px solid #2a6a4a;margin:0;">✅ Listo.</span>' +
              '</div>' +
              '<hr class="hr-hairline">' +
              '<div class="conv2-refline" style="display:flex;justify-content:center;padding:4px 0;">' +
                '<span id="cvRef400" style="display:inline-flex;align-items:center;gap:8px;background:#0f1116;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 0 8px rgba(90,110,154,0.08);">—</span>' +
              '</div>' +
              '<hr class="hr-hairline">' +
              '<div id="convScore" class="conv2-score" aria-live="polite" style="display:grid;gap:8px;">' +
                '<div class="conv2-score__head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                  '<strong>Índice de conveniencia (400 gemas)</strong>' +
                  '<span id="cvScoreLabel" class="conv2-score__label">—</span>' +
                '</div>' +
                '<div class="conv2-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Conveniencia para comprar gemas">' +
                  '<div id="cvScoreBar" class="conv2-meter__fill" style="width:0%"></div>' +
                '</div>' +
                '<p id="cvScoreHint" class="muted" style="margin:6px 0 0">Calculando…</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          // Tab: Mis Transacciones
          '<div class="conv-tab-content" data-tab="transacciones" style="display:none;"></div>' +
          // Tab: Populares
          '<div class="conv-tab-content" data-tab="populares" style="display:none;"></div>' +
          // Tab: Historial (placeholder Fase 3)
          '<div class="conv-tab-content" data-tab="historial" style="display:none;">' +
            '<div style="text-align:center;padding:40px;color:#9aa2b8;">' +
              '<img src="assets/icons/3124974.png" width="48" height="48" alt="" style="opacity:0.3;margin-bottom:16px;"><br>' +
              'Historial de tendencia de gemas<br>' +
              '<span style="font-size:0.8rem;">Próximamente</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Wire: cerrar modal
    modal.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close') === '1') closeModal();
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
        closeModal();
        document.removeEventListener('keydown', onEsc);
      }
    });

    return modal;
  }

  function wireConversorEvents() {
    // Inputs con debounce
    var t = null;
    var deb = function (fn, ms) {
      return function () {
        var args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(null, args); }, ms || 300);
      };
    };

    var cvGems = document.getElementById('cvGems');
    var cvGold = document.getElementById('cvGold');
    var cvRefresh = document.getElementById('cvRefresh');

    if (cvGems && !cvGems.__wired) {
      cvGems.__wired = true;
      cvGems.addEventListener('input', deb(onTopInput));
    }
    if (cvGold && !cvGold.__wired) {
      cvGold.__wired = true;
      cvGold.addEventListener('input', deb(onBottomInput));
    }
    if (cvRefresh && !cvRefresh.__wired) {
      cvRefresh.__wired = true;
      cvRefresh.addEventListener('click', function () {
        updateRef400().catch(function () {});
        onTopInput();
        onBottomInput();
      });
    }

    // Quick chips — Gemas
    var gemsQuick = document.getElementById('cvGemsQuick');
    if (gemsQuick) {
      var gemBtns = gemsQuick.querySelectorAll('[data-gems]');
      for (var i = 0; i < gemBtns.length; i++) {
        var btn = gemBtns[i];
        if (btn.__wired) continue;
        btn.__wired = true;
        btn.addEventListener('click', function () {
          var n = Number(this.getAttribute('data-gems')) || 0;
          var input = document.getElementById('cvGems');
          if (input) input.value = String(n);
          onTopInput();
        });
      }
    }

    // Quick chips — Oro
    var goldQuick = document.getElementById('cvGoldQuick');
    if (goldQuick) {
      var goldBtns = goldQuick.querySelectorAll('[data-gold]');
      for (var j = 0; j < goldBtns.length; j++) {
        var btnGold = goldBtns[j];
        if (btnGold.__wired) continue;
        btnGold.__wired = true;
        btnGold.addEventListener('click', function () {
          var n = Number(this.getAttribute('data-gold')) || 0;
          var input = document.getElementById('cvGold');
          if (input) input.value = String(n);
          onBottomInput();
        });
      }
    }

    // Tabs
    var tabBtns = document.querySelectorAll('#convModal .conv-modal-tab');
    for (var k = 0; k < tabBtns.length; k++) {
      var tabBtn = tabBtns[k];
      if (tabBtn.__wired) continue;
      tabBtn.__wired = true;
      tabBtn.addEventListener('click', function () {
        var tabId = this.getAttribute('data-tab');
        switchTab(tabId);
      });
    }
  }

  function switchTab(tabId) {
    state.activeTab = tabId;

    // Actualizar botones
    var tabBtns = document.querySelectorAll('#convModal .conv-modal-tab');
    for (var i = 0; i < tabBtns.length; i++) {
      var btn = tabBtns[i];
      var isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.style.color = isActive ? '#7bc2ff' : '#9aa2b8';
      btn.style.borderBottomColor = isActive ? '#7bc2ff' : 'transparent';
    }

    // Actualizar contenidos
    var contents = document.querySelectorAll('#convModal .conv-tab-content');
    for (var j = 0; j < contents.length; j++) {
      var content = contents[j];
      content.style.display = content.getAttribute('data-tab') === tabId ? 'block' : 'none';
    }

    // Cargar datos al cambiar de tab
    if (tabId === 'transacciones' && !state.transacciones.buys.length && !state.transacciones.sells.length) {
      loadTransacciones(false);
    }
    if (tabId === 'populares' && !state.ofertas.prices.length) {
      loadOfertas(false);
    }
  }

  function closeModal() {
    var modal = document.getElementById('convModal');
    if (modal) modal.setAttribute('hidden', '');
  }

  // =======================================================================
  // API PÚBLICA
  // =======================================================================
  function openModal() {
    var modal = ensureModal();
    modal.removeAttribute('hidden');
    wireConversorEvents();
    updateRef400().catch(function () {});
    onTopInput();
    onBottomInput();
  }

  function initOnce() {
    if (state.inited) return;
    ensureModal();
    state.inited = true;
    console.info(LOG, 'ready v1.0.0');
  }

  var ConverterModal = {
    initOnce: initOnce,
    open: openModal,
    close: closeModal,
    _debug: function () {
      return { inited: state.inited, activeTab: state.activeTab };
    }
  };

  root.ConverterModal = ConverterModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    initOnce();
  }

})(typeof window !== 'undefined' ? window : this);