/*!
 * js/converter-modal.js — Cambio de divisas (oro ↔ gemas y tu Trading Post)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.2.0 (2026-10-27)
 *
 * v2.2.0 (BL-076, SHV-5d): mi consejo dice «Lo sé por».
 * v2.1.0 (BL-074, BLS-3): el caché de precios (gw2_conv_cache_v3) va a IndexedDB por js/gn-idb.js
 *         si está (si no, sigue en localStorage) y al guardar tira lo vencido: antes crecía sin tope.
 * v2.0.0 (BL-056, CAR-2A): de modal a vista (calculadora en espejo, tu Trading Post, Populares
 *         plegado); mount(host) y open(). Sin la pestaña que decía «Próximamente»; arreglos del
 *         Escape, de un ícono inexistente y de una función sin definir. Estilos con el theme.
 * v1.2.0: compras y ventas distinguen "no leído" de "no tenés" (Idea 47 c4).
 * v1.1.x: caja del Trading Post "sin recoger" (getCommerceDelivery).
 * v1.0.0: extraído de app.js.
 */

(function (root) {
  'use strict';

  var VERSION = '2.2.0';
  var LOG = '[ConverterModal]';
  var ICON = 'assets/icons/';
  var I_GEM = ICON + '502065.png', I_GOLD = ICON + '619316.png', I_TP = ICON + '155033.png';

  var LS_CONV = 'gw2_conv_cache_v3';
  var CONV_TTL = 1000 * 60 * 30; // 30 minutos

  var state = {
    inited: false,
    transacciones: {
      buys: [],
      sells: [],
      itemsById: {},
      loading: false,
      lastUpdate: 0,
      delivery: [],
      // Caja del Trading Post: 'unknown' | 'pending' | 'empty' | 'error'.
      // 'empty' NO es 'error': getCommerceDelivery() propaga el error a
      // propósito para que un fallo no se presente como "caja vacía".
      deliveryStatus: 'unknown',
      // Compras y ventas por separado, mismo contrato: 'unknown' | 'ok' | 'error'.
      buysStatus: 'unknown',
      sellsStatus: 'unknown',
      noPermission: false,
      filters: { type: 'all' } // 'all' | 'buys' | 'sells'
    },
    ofertas: {
      listings: [],
      prices: [],
      itemsById: {},
      loading: false,
      lastUpdate: 0,
      filters: { rarity: '', minVolume: 0 }
    }
  };

  // =======================================================================
  // UTILIDADES PURAS
  // =======================================================================
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  function splitCopper(v) {
    v = Math.max(0, Math.floor(Number(v) || 0));
    return { g: Math.floor(v / 10000), s: Math.floor((v % 10000) / 100), c: v % 100 };
  }

  /** Monedas con el estilo de la Cartera: 142 g 07 s (el cobre solo debajo de 1 g). */
  function coinHTML(copper) {
    var n = Number(copper);
    if (!Number.isFinite(n) || n <= 0) return '—';
    var p = splitCopper(n), out = [];
    if (p.g) out.push('<b class="cx-g">' + p.g.toLocaleString('es-AR') + '</b><small>g</small>');
    if (p.s || p.g) out.push('<b class="cx-s">' + (p.g ? String(p.s).padStart(2, '0') : p.s) + '</b><small>s</small>');
    if (!p.g) out.push('<b class="cx-c">' + p.c + '</b><small>c</small>');
    return '<span class="cx-coin">' + out.join('') + '</span>';
  }

  function relTime(iso, now) {
    var t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    var m = Math.max(0, Math.round(((now || Date.now()) - t) / 60000));
    if (m < 1) return 'recién';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }

  // =======================================================================
  // CONVENIENCIA (400 GEMAS) — referencia 120–130 g
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
    if (score >= 0.65) return 'is-good';
    if (score >= 0.45) return 'is-mid';
    if (score >= 0.25) return 'is-low';
    return 'is-bad';
  }

  /** Mi recomendación según el precio de 400 gemas (en oro, con decimales). */
  function adviceFor(gold400) {
    var g = Number(gold400);
    if (!Number.isFinite(g) || g <= 0) return null;
    var n = Math.round(g) + ' g';
    if (g < 120) return { kind: 'recomienda', text: 'Hoy 400 gemas cuestan ' + n + ', por debajo de la referencia de 120–130 g. Si tenés pensado comprar gemas con oro, es un buen momento.' };
    if (g <= 130) return { kind: 'recomienda', text: 'Hoy 400 gemas cuestan ' + n + ', dentro de la referencia de 120–130 g. Es un precio normal: comprá si las necesitás.' };
    if (g < 145) return { kind: 'recomienda', text: 'Hoy 400 gemas cuestan ' + n + ', por encima de la referencia de 120–130 g. Si no te urge, esperá; si las necesitás ya, no es un mal precio.' };
    if (g < 160) return { kind: 'recomienda', text: 'Hoy 400 gemas cuestan ' + n + ', bastante por encima de la referencia de 120–130 g. Si podés, esperá unos días.' };
    return { kind: 'advierte', text: 'Hoy 400 gemas cuestan ' + n + ', muy por encima de la referencia de 120–130 g. No es momento de cambiar oro por gemas; al revés, si necesitás oro, tus gemas rinden más que de costumbre.' };
  }

  function countOrders(st) {
    return { all: st.buys.length + st.sells.length, buys: st.buys.length, sells: st.sells.length };
  }

  // =======================================================================
  // CACHÉ Y API DE CONVERSIÓN
  // =======================================================================
  // BL-074: si GNIdb (js/gn-idb.js) toma la clave, el caché vive en IndexedDB; si no, en localStorage.
  function convIdb() { var G = root.GNIdb; return G && G.handles && G.handles(LS_CONV) ? G : null; }
  function convGet() {
    var G = convIdb(); if (G) return G.get(LS_CONV) || {};
    try { return JSON.parse(localStorage.getItem(LS_CONV) || '{}'); } catch (_) { return {}; }
  }
  function convPut(k, v) {
    try {
      var m = convGet(), now = Date.now(), G = convIdb();
      Object.keys(m).forEach(function (x) { if (!m[x] || !(now - m[x].ts <= CONV_TTL)) delete m[x]; });
      m[k] = { v: v, ts: now };
      if (G) G.set(LS_CONV, m); else localStorage.setItem(LS_CONV, JSON.stringify(m));
    } catch (_) {}
  }
  function convVal(k) {
    var m = convGet();
    if (!m[k]) return null;
    if ((Date.now() - m[k].ts) > CONV_TTL) return null;
    return m[k].v;
  }

  function apiExchange(kind, quantity) {
    var url = 'https://api.guildwars2.com/v2/commerce/exchange/' + kind + '?quantity=' + quantity;
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (r) {
      return r.text().then(function (raw) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (raw || ''));
        try { return JSON.parse(raw); } catch (e) { throw new Error('JSON inválido (' + kind + '): ' + (raw || '').slice(0, 200)); }
      });
    });
  }

  async function gemsForCoins(copper) {
    var k = 'coins2gems_' + copper;
    var v = convVal(k);
    if (v != null) return v;
    var o = await apiExchange('coins', copper);
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
    var o = await apiExchange('gems', gems);
    var copper = Number.isFinite(+o?.quantity) ? +o.quantity
      : Number.isFinite(+o?.coins) ? +o.coins
      : (Number.isFinite(+o?.coins_per_gem) ? Math.floor(+gems * +o.coins_per_gem) : NaN);
    if (!Number.isFinite(copper)) throw new Error('Respuesta inválida gems->coins');
    convPut(k, copper);
    return copper;
  }

  /** Cobre mínimo para conseguir `targetGems` gemas (búsqueda binaria sobre la API). */
  async function costToBuyGems_coinsMarket(targetGems) {
    if (targetGems <= 0) return 0;
    var lo = 0, hi = 10000 * 10000;
    while (await gemsForCoins(hi) < targetGems) {
      hi = Math.min(hi * 2, 5e11);
      if (hi >= 5e11) break;
    }
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (await gemsForCoins(mid) >= targetGems) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  /** Gemas mínimas para conseguir `targetCopper` de oro. */
  async function gemsToBuyGold_gemsMarket(targetCopper) {
    if (targetCopper <= 0) return 0;
    var lo = 0, hi = 100;
    while (await coinsForGems(hi) < targetCopper) {
      hi = Math.min(hi * 2, 3e6);
      if (hi >= 3e6) break;
    }
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (await coinsForGems(mid) >= targetCopper) hi = mid; else lo = mid + 1;
    }
    return lo;
  }

  // =======================================================================
  // CALCULADORA
  // =======================================================================
  function byId(id) { return document.getElementById(id); }

  function setConvState(msg, kind) {
    var el = byId('cvState');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', kind === 'error');
  }

  function renderConvenience(priceCopperFor400) {
    var bar = byId('cvScoreBar'), lbl = byId('cvScoreLabel'), num = byId('cvScoreNum');
    var meter = byId('cvMeter'), ref = byId('cvRef400'), voiceHost = byId('cvVoice');
    if (!bar || !lbl || !meter) return;
    var gold = Number(priceCopperFor400 || 0) / 10000;
    if (!Number.isFinite(gold) || gold <= 0) {
      bar.style.width = '0%';
      bar.className = 'cx-fill';
      lbl.textContent = 'Conveniencia: sin datos';
      if (num) num.textContent = '';
      if (ref) ref.innerHTML = '—';
      meter.setAttribute('aria-valuenow', '0');
      if (voiceHost) voiceHost.innerHTML = '';
      return;
    }
    var r = scoreFromPrice400(gold);
    var pct = Math.round(r.score * 100);
    bar.className = 'cx-fill ' + classForScore(r.score);
    bar.style.width = pct + '%';
    lbl.textContent = 'Conveniencia: ' + labelForScore(r.score);
    if (num) num.textContent = pct + ' / 100';
    if (ref) ref.innerHTML = coinHTML(priceCopperFor400);
    meter.setAttribute('aria-valuenow', String(pct));
    if (voiceHost) {
      voiceHost.innerHTML = '';
      var a = adviceFor(gold);
      if (a && root.Shiruvana && typeof root.Shiruvana.voice === 'function') {
        voiceHost.appendChild(root.Shiruvana.voice({ kind: a.kind, text: a.text, basis: 'el cambio de gemas (API oficial) · en este navegador' }));
      }
    }
  }

  async function onGemsInput() {
    var input = byId('cvGems'), out = byId('cvGemsOut');
    if (!input || !out) return;
    var gems = Math.max(0, Math.floor(Number(String(input.value || '').trim()) || 0));
    if (!gems) { input.value = ''; out.innerHTML = '—'; return; }
    input.value = String(gems);
    setConvState('Calculando…');
    try {
      var copper = await costToBuyGems_coinsMarket(gems);
      out.innerHTML = coinHTML(copper);
      setConvState('Cotización al día.');
    } catch (e) {
      console.error(LOG, 'gemas → oro', e);
      out.innerHTML = '—';
      setConvState('No se pudo calcular. Probá «Actualizar cotización».', 'error');
    }
  }

  async function onGoldInput() {
    var input = byId('cvGold'), out = byId('cvGoldOut');
    if (!input || !out) return;
    var gold = Math.max(0, Math.floor(Number(String(input.value || '').trim()) || 0));
    if (!gold) { input.value = ''; out.textContent = '—'; return; }
    input.value = String(gold);
    setConvState('Calculando…');
    try {
      var gems = await gemsToBuyGold_gemsMarket(gold * 10000);
      out.textContent = Math.floor(gems).toLocaleString('es-AR');
      setConvState('Cotización al día.');
    } catch (e) {
      console.error(LOG, 'oro → gemas', e);
      out.textContent = '—';
      setConvState('No se pudo calcular. Probá «Actualizar cotización».', 'error');
    }
  }

  async function updateRef400(force) {
    try {
      var k = 'ref_400_v3';
      var copper = force ? null : convVal(k);
      if (copper == null) {
        copper = await costToBuyGems_coinsMarket(400);
        convPut(k, copper);
      }
      renderConvenience(copper);
    } catch (e) {
      console.warn(LOG, 'ref400', e);
      renderConvenience(0);
      setConvState('No se pudo leer el precio de las gemas.', 'error');
    }
  }

  /** «Todo mi oro»: el oro de la cuenta elegida. */
  async function fillAllGold() {
    var input = byId('cvGold');
    var token = getSelectedTokenForCommerce();
    if (!input || !token || !root.GW2Api || typeof root.GW2Api.getAccountWallet !== 'function') {
      setConvState('Elegí una cuenta para usar tu oro.', 'error');
      return;
    }
    try {
      var wallet = await root.GW2Api.getAccountWallet(token, { nocache: false });
      var coin = (wallet || []).filter(function (w) { return w && w.id === 1; })[0];
      input.value = String(Math.floor(((coin && coin.value) || 0) / 10000));
      onGoldInput();
    } catch (e) {
      console.warn(LOG, 'oro de la cuenta', e);
      setConvState('No se pudo leer el oro de la cuenta.', 'error');
    }
  }

  // =======================================================================
  // POPULARES — lo más comerciado (plegado)
  // =======================================================================
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

  async function loadOfertas(forceNoCache) {
    var st = state.ofertas;
    if (st.loading) return;
    if (!forceNoCache && st.lastUpdate && (Date.now() - st.lastUpdate) < 120000 && st.prices.length) {
      renderOfertas();
      return;
    }
    st.loading = true;
    renderOfertas();
    try {
      var allIds = await root.GW2Api.getCommerceListings({ nocache: !!forceNoCache });
      if (!allIds || !allIds.length) {
        st.listings = []; st.prices = []; st.lastUpdate = Date.now();
        return;
      }
      var sampleIds = allIds.slice(-200);
      var prices = await root.GW2Api.getCommercePrices(sampleIds, { nocache: !!forceNoCache });
      var items = await root.GW2Api.getItemsMany(prices.map(function (p) { return p.id; }), { nocache: false });
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

  function getFilteredOfertas(st) {
    st = st || state.ofertas;
    var f = st.filters;
    return st.prices
      .map(function (p) {
        var buyQty = p.buys ? p.buys.quantity || 0 : 0;
        var sellQty = p.sells ? p.sells.quantity || 0 : 0;
        return { id: p.id, buys: p.buys, sells: p.sells, item: st.itemsById[p.id] || {},
          buyQty: buyQty, sellQty: sellQty, totalVol: buyQty + sellQty };
      })
      .filter(function (p) {
        if (p.totalVol <= 0) return false;
        if (f.rarity) {
          var r = p.item.rarity;
          if (!r) return false;
          if (f.rarity === 'non_legendary') { if (r === 'Legendary' || r === 'Ascended') return false; }
          else if (r !== f.rarity) return false;
        }
        return !(f.minVolume > 0 && p.totalVol < f.minVolume);
      })
      .sort(function (a, b) {
        return f.rarity === 'Legendary' ? b.sellQty - a.sellQty : b.totalVol - a.totalVol;
      })
      .slice(0, 15);
  }

  function renderOfertas() {
    var box = byId('cvPop');
    if (!box) return;
    var st = state.ofertas;
    if (st.loading) { box.innerHTML = '<p class="cx-empty">Cargando el mercado…</p>'; return; }
    if (!st.prices.length) {
      box.innerHTML = '<p class="cx-empty">No se pudieron cargar los datos del mercado.</p>' +
        '<p class="cx-center"><button type="button" class="cx-btn" data-cx="pop-refresh">Reintentar</button></p>';
      return;
    }
    var f = st.filters, legend = f.rarity === 'Legendary';
    var rows = getFilteredOfertas(st);
    var opt = function (v, l, cur) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + l + '</option>'; };
    var html = '<div class="cx-tools">' +
      '<select class="cx-select" data-cx="pop-rarity" aria-label="Rareza">' +
        opt('', 'Todas las rarezas', f.rarity) + opt('Legendary', 'Legendarias', f.rarity) + opt('Ascended', 'Ascendido', f.rarity) +
        opt('Exotic', 'Exótico', f.rarity) + opt('Rare', 'Raro', f.rarity) + opt('Masterwork', 'Obra maestra', f.rarity) +
        opt('Fine', 'Bueno', f.rarity) + opt('non_legendary', 'Sin legendarias ni ascendidas', f.rarity) +
      '</select>' +
      '<select class="cx-select" data-cx="pop-volume" aria-label="Volumen">' +
        opt(0, 'Cualquier volumen', f.minVolume) + opt(100, 'Más de 100', f.minVolume) + opt(500, 'Más de 500', f.minVolume) + opt(1000, 'Más de 1.000', f.minVolume) +
      '</select>' +
      '<button type="button" class="cx-btn" data-cx="pop-refresh">Refrescar</button></div>' +
      '<p class="cx-note">' + (legend
        ? 'Legendarias ordenadas por cantidad de vendedores: a más vendedores, más fácil comprar a buen precio.'
        : 'Ordenados por órdenes de compra y venta: lo que más se mueve hoy.') + '</p>';
    if (!rows.length) {
      html += '<p class="cx-empty">Nada con esos filtros. Probá otra rareza.</p>';
    } else {
      html += '<div class="cx-list">' + rows.map(function (p) {
        var it = p.item, name = it.name || ('Ítem #' + p.id);
        return '<div class="cx-ord cx-ord--pop">' +
          (it.icon ? '<img class="cx-ico" src="' + esc(it.icon) + '" alt="" loading="lazy">' : '<span class="cx-ico"></span>') +
          '<div class="cx-min"><b class="cx-name" title="' + esc(name) + '">' + esc(name) + '</b>' +
          '<div class="cx-q" style="color:' + (RARITY_COLORS[it.rarity] || 'inherit') + '">' + esc(getRarityLabel(it.rarity)) + '</div></div>' +
          '<div class="cx-r cx-hm"><div>' + (p.buys ? coinHTML(p.buys.unit_price) : '—') + '</div><div class="cx-q">compra</div></div>' +
          '<div class="cx-r cx-hm"><div>' + (p.sells ? coinHTML(p.sells.unit_price) : '—') + '</div><div class="cx-q">venta</div></div>' +
          '<div class="cx-r"><b>' + (legend ? p.sellQty : p.totalVol).toLocaleString('es-AR') + '</b><div class="cx-q">' + (legend ? 'vendedores' : 'órdenes') + '</div></div>' +
          '</div>';
      }).join('') + '</div>';
    }
    box.innerHTML = html;
  }

  // =======================================================================
  // TU TRADING POST — caja y órdenes activas (requiere permiso tradingpost)
  // =======================================================================
  async function loadTransacciones(forceNoCache) {
    var st = state.transacciones;
    if (st.loading) return;
    st.loading = true;
    renderTransacciones();

    try {
      var token = getSelectedTokenForCommerce();
      if (!token) {
        st.buys = []; st.sells = []; st.lastUpdate = Date.now();
        st.buysStatus = 'unknown'; st.sellsStatus = 'unknown';
        return;
      }

      // allSettled + estado por lado (v1.2.0): un fallo de red no puede
      // verse como "no tenés órdenes".
      st.buysStatus = 'unknown';
      st.sellsStatus = 'unknown';
      var results = await Promise.allSettled([
        root.GW2Api.getCommerceTransactionsBuys(token, { nocache: !!forceNoCache }),
        root.GW2Api.getCommerceTransactionsSells(token, { nocache: !!forceNoCache })
      ]);

      var buys = [];
      if (results[0].status === 'fulfilled') {
        buys = Array.isArray(results[0].value) ? results[0].value : [];
        st.buysStatus = 'ok';
      } else {
        st.buysStatus = 'error';
        console.warn(LOG, 'No se pudieron leer las compras del TP:', results[0].reason);
      }

      var sells = [];
      if (results[1].status === 'fulfilled') {
        sells = Array.isArray(results[1].value) ? results[1].value : [];
        st.sellsStatus = 'ok';
      } else {
        st.sellsStatus = 'error';
        console.warn(LOG, 'No se pudieron leer las ventas del TP:', results[1].reason);
      }

      st.delivery = [];
      st.deliveryStatus = 'empty';
      try {
        var delivery = await root.GW2Api.getCommerceDelivery(token, { nocache: !!forceNoCache });
        st.delivery = Array.isArray(delivery) ? delivery : [];
        st.deliveryStatus = st.delivery.length ? 'pending' : 'empty';
      } catch (deliveryErr) {
        st.delivery = [];
        st.deliveryStatus = 'error';
        console.warn(LOG, 'No se pudo leer la caja del Trading Post:', deliveryErr);
      }

      var itemIds = buys.concat(sells).map(function (tx) { return tx.item_id; }).filter(Boolean);
      var deliveryIds = st.delivery.map(function (d) { return d && d.item_id; }).filter(Boolean);
      var uniqueIds = Array.from(new Set(itemIds.concat(deliveryIds)));
      var items = uniqueIds.length ? await root.GW2Api.getItemsMany(uniqueIds, { nocache: false }) : [];
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

  /**
   * Caja del Trading Post. Tres estados visibles: 'pending' (la alerta),
   * 'error' (también se muestra: un fallo silencioso haría creer que no hay
   * nada) y 'empty' (silencio = OK). El color lo pone commerce-delivery-theme.js
   * a partir de data-cv-color; acá no va ningún estilo inline.
   */
  function renderDeliveryBanner() {
    var st = state.transacciones;
    if (st.deliveryStatus !== 'pending' && st.deliveryStatus !== 'error') return '';

    if (st.deliveryStatus === 'error') {
      return '<div class="cv-delivery" data-cv-color="error" role="status">' +
        '<div class="cv-delivery__head">' +
          '<span class="cv-delivery__icon" aria-hidden="true">⚠️</span>' +
          '<span class="cv-delivery__title">No se pudo leer tu caja del Trading Post</span>' +
        '</div>' +
        '<p class="cv-delivery__body">Lo usual es que la API Key no tenga el permiso <code>tradingpost</code>, ' +
        'o que la API haya caído en ese momento. Las órdenes de abajo sí son datos ya leídos y no se ven afectados.</p>' +
        '<button id="cvDeliveryRetry" class="btn btn--ghost btn--xs">Reintentar</button>' +
        '</div>';
    }

    var count = st.delivery.length;
    var totalUnits = st.delivery.reduce(function (sum, d) { return sum + (Number(d && d.quantity) || 0); }, 0);
    var MAX_CHIPS = 12;

    var chips = st.delivery.slice(0, MAX_CHIPS).map(function (d) {
      var item = st.itemsById[d.item_id] || {};
      var name = item.name || ('Ítem #' + d.item_id);
      var qty = Number(d.quantity) || 0;
      return '<span class="cv-delivery__chip" title="' + esc(name) + '">' +
        (item.icon ? '<img src="' + esc(item.icon) + '" width="16" height="16" alt="">' : '') +
        '<span class="cv-delivery__chip-name">' + esc(name) + '</span>' +
        (qty > 1 ? '<em class="cv-delivery__chip-qty">×' + qty + '</em>' : '') +
        '</span>';
    }).join('');

    var more = count > MAX_CHIPS
      ? '<span class="cv-delivery__more">+' + (count - MAX_CHIPS) + '</span>'
      : '';

    return '<div class="cv-delivery" data-cv-color="pending" role="status">' +
      '<div class="cv-delivery__head">' +
        '<span class="cv-delivery__icon" aria-hidden="true">📦</span>' +
      '<span class="cv-delivery__title">' + count + ' ítem' + (count === 1 ? '' : 's') + ' sin recoger</span>' +
      '</div>' +
      '<p class="cv-delivery__body">Están en tu caja del Trading Post: hasta que los retires no los tenés, ' +
      'y si son ventas el dinero tampoco está acreditado. La caja no dice cuáles son compras y cuáles ventas.' +
      (totalUnits > 1 ? ' (<strong>' + totalUnits + '</strong> unidades en total)' : '') +
      ' Retiralos con un mercader del León Negro (hay en todas las ciudades) o con un Trading Post Express.</p>' +
      '<div class="cv-delivery__chips">' + chips + more + '</div>' +
      '</div>';
  }

  function getFilteredTransacciones(st) {
    st = st || state.transacciones;
    var type = st.filters.type, all = [];
    function add(list, kind) {
      list.forEach(function (tx) {
        all.push({ id: tx.id, item_id: tx.item_id, type: kind, price: tx.price, quantity: tx.quantity,
          total: tx.price * tx.quantity, created: tx.created, item: st.itemsById[tx.item_id] || {} });
      });
    }
    if (type === 'all' || type === 'buys') add(st.buys, 'buy');
    if (type === 'all' || type === 'sells') add(st.sells, 'sell');
    all.sort(function (a, b) { return new Date(b.created).getTime() - new Date(a.created).getTime(); });
    return all;
  }

  /** Aviso de "no se pudo leer" para compras y ventas (v1.2.0). */
  function renderTransErrorBanner() {
    var st = state.transacciones;
    var failBuys = st.buysStatus === 'error';
    var failSells = st.sellsStatus === 'error';
    if (!failBuys && !failSells) return '';

    var failed, ok;
    if (failBuys && failSells) {
      failed = 'las compras ni las ventas';
      ok = 'La caja del Trading Post';
    } else if (failBuys) {
      failed = 'las compras';
      ok = 'las ventas y la caja del Trading Post';
    } else {
      failed = 'las ventas';
      ok = 'las compras y la caja del Trading Post';
    }

    return '<div class="cv-delivery" data-cv-color="error" role="status">' +
      '<div class="cv-delivery__head">' +
        '<span class="cv-delivery__icon" aria-hidden="true">⚠️</span>' +
        '<span class="cv-delivery__title">No se pudo leer ' + esc(failed) + ' del Trading Post</span>' +
      '</div>' +
      '<p class="cv-delivery__body">Lo usual es que la API Key no tenga el permiso <code>tradingpost</code>, ' +
      'o que la API haya caído en ese momento. Lo que sí se pudo leer — ' + esc(ok) + ' — no se ve afectado. ' +
      'Si recargás y sigue igual, revisá el permiso de la Key.</p>' +
      '<button id="cvTransaccionesRetry" class="btn btn--ghost btn--xs">Reintentar</button>' +
      '</div>';
  }

  function tpMessage(title, body, link) {
    return '<div class="cx-msg"><img src="' + I_TP + '" width="40" height="40" alt="">' +
      '<b>' + title + '</b><p>' + body + '</p>' +
      (link ? '<a class="cx-btn" href="https://account.arena.net/applications" target="_blank" rel="noopener">Crear una API Key con tradingpost</a>' : '') +
      '</div>';
  }

  function renderTransacciones() {
    var container = byId('cvTrans');
    if (!container) return;
    var st = state.transacciones;

    if (st.loading) {
      container.innerHTML = '<p class="cx-empty">Leyendo tu Trading Post…</p>';
      return;
    }

    var token = getSelectedTokenForCommerce();
    if (!token) {
      container.innerHTML = tpMessage('Elegí una cuenta', 'Con una API Key con permiso <code>tradingpost</code> te muestro lo que tenés para recoger y tus órdenes.', true);
      return;
    }
    if (st.noPermission) {
      container.innerHTML = tpMessage('Falta el permiso tradingpost', 'Esta API Key no puede leer tu Trading Post. Creá una con ese permiso para ver tus órdenes y tu caja.', true);
      return;
    }

    if (!st.buys.length && !st.sells.length) {
      // Los banners van primero y se dibujan igual: sin órdenes, la caja puede
      // seguir llena, y un fallo de lectura no puede verse como "no tenés".
      container.innerHTML = renderTransErrorBanner() + renderDeliveryBanner() +
        '<p class="cx-empty">No tenés órdenes activas en el Trading Post.</p>' +
        '<p class="cx-center"><button type="button" id="cvTransaccionesRefresh" class="cx-btn">Refrescar</button></p>';
      return;
    }

    var n = countOrders(st), type = st.filters.type;
    var rows = getFilteredTransacciones(st);
    var totalBuys = st.buys.reduce(function (s, tx) { return s + tx.price * tx.quantity; }, 0);
    var totalSells = st.sells.reduce(function (s, tx) { return s + tx.price * tx.quantity; }, 0);
    var seg = function (k, label, c) {
      return '<button type="button" data-cx-type="' + k + '" aria-pressed="' + (type === k) + '"' + (type === k ? ' class="is-on"' : '') + '>' + label + ' (' + c + ')</button>';
    };

    var html =
      renderTransErrorBanner() +
      renderDeliveryBanner() +
      '<div class="cx-tools"><div class="cx-seg" role="group" aria-label="Órdenes">' +
        seg('all', 'Todas', n.all) + seg('buys', 'Compras', n.buys) + seg('sells', 'Ventas', n.sells) + '</div>' +
        '<button type="button" id="cvTransaccionesRefresh" class="cx-btn">Refrescar</button></div>' +
      '<div class="cx-sum"><span>Comprometido en compras ' + coinHTML(totalBuys) + '</span><span>Publicado en ventas ' + coinHTML(totalSells) + '</span></div>' +
      '<div class="cx-list">' + rows.map(function (tx) {
        var it = tx.item, name = it.name || ('Ítem #' + tx.item_id), buy = tx.type === 'buy';
        return '<div class="cx-ord">' +
          (it.icon ? '<img class="cx-ico" src="' + esc(it.icon) + '" alt="" loading="lazy">' : '<span class="cx-ico"></span>') +
          '<div class="cx-min"><b class="cx-name" title="' + esc(name) + '">' + esc(name) + '</b>' +
          '<div class="cx-q">×' + Number(tx.quantity || 0).toLocaleString('es-AR') + ' · ' + esc(relTime(tx.created)) + '</div></div>' +
          '<span class="cx-tag ' + (buy ? 'cx-buy' : 'cx-sell') + '">' + (buy ? 'Compra' : 'Venta') + '</span>' +
          '<div class="cx-r">' + coinHTML(tx.price) + '<div class="cx-q">c/u</div></div>' +
          '</div>';
      }).join('') + '</div>';

    container.innerHTML = html;
  }

  function getSelectedTokenForCommerce() {
    try {
      var sel = byId('keySelectGlobal');
      return sel ? (sel.value || '').trim() : null;
    } catch (e) { return null; }
  }

  var _permissionsCache = {};
  var _permissionsCacheTs = 0;
  var PERMISSIONS_CACHE_TTL = 5 * 60 * 1000;

  function hasTradingPostPermission(token) {
    return new Promise(function (resolve) {
      if (!token) { resolve(false); return; }
      var now = Date.now();
      if (_permissionsCache[token] !== undefined && (now - _permissionsCacheTs) < PERMISSIONS_CACHE_TTL) {
        resolve(_permissionsCache[token]);
        return;
      }
      root.GW2Api.getTokenInfo(token, { nocache: false })
        .then(function (info) {
          var perms = info && info.permissions ? info.permissions : [];
          var hasTP = perms.indexOf('tradingpost') >= 0;
          _permissionsCache[token] = hasTP;
          _permissionsCacheTs = now;
          resolve(hasTP);
        })
        .catch(function () { resolve(false); });
    });
  }

  /** Lee el Trading Post de la cuenta elegida (permiso primero). */
  function refreshTradingPost(force) {
    var st = state.transacciones;
    var token = getSelectedTokenForCommerce();
    st.noPermission = false;
    if (!token || !root.GW2Api) { renderTransacciones(); return; }
    hasTradingPostPermission(token).then(function (ok) {
      if (!ok) { st.noPermission = true; renderTransacciones(); return; }
      if (force || !st.lastUpdate) loadTransacciones(!!force); else renderTransacciones();
    });
  }

  // =======================================================================
  // VISTA
  // =======================================================================
  function viewHTML() {
    var q = function (attr, list) {
      return list.map(function (v) { return '<button type="button" ' + attr + '="' + v[0] + '">' + v[1] + '</button>'; }).join('');
    };
    return '<div class="cx-grid">' +
      '<section class="cx-panel" aria-labelledby="cxCalcTitle">' +
        '<h3 id="cxCalcTitle"><img src="' + I_GEM + '" width="22" height="22" alt=""> Calculadora oro ↔ gemas</h3>' +
        '<div class="cx-conv">' +
          '<label class="cx-box" for="cvGold"><span class="cx-lbl"><img src="' + I_GOLD + '" width="16" height="16" alt="">Tengo oro</span>' +
            '<span class="cx-in"><input id="cvGold" type="number" min="0" max="99999" step="1" inputmode="numeric" autocomplete="off" placeholder="0"><small>g</small></span></label>' +
          '<span class="cx-arrow" aria-hidden="true">→</span>' +
          '<div class="cx-box"><span class="cx-lbl"><img src="' + I_GEM + '" width="16" height="16" alt="">Me dan</span>' +
            '<span class="cx-in cx-gem"><output id="cvGoldOut" for="cvGold">—</output><small>gemas</small></span></div>' +
          '<div class="cx-quick" aria-label="Atajos de oro">' + q('data-gold', [['10', '10 g'], ['100', '100 g'], ['250', '250 g'], ['all', 'Todo mi oro']]) + '</div>' +
        '</div>' +
        '<div class="cx-conv">' +
          '<label class="cx-box" for="cvGems"><span class="cx-lbl"><img src="' + I_GEM + '" width="16" height="16" alt="">Quiero gemas</span>' +
            '<span class="cx-in"><input id="cvGems" type="number" min="0" max="99999" step="1" inputmode="numeric" autocomplete="off" placeholder="0"></span></label>' +
          '<span class="cx-arrow" aria-hidden="true">→</span>' +
          '<div class="cx-box"><span class="cx-lbl"><img src="' + I_GOLD + '" width="16" height="16" alt="">Me cuestan</span>' +
            '<span class="cx-in"><output id="cvGemsOut" for="cvGems">—</output></span></div>' +
          '<div class="cx-quick" aria-label="Atajos de gemas">' + q('data-gems', [['400', '400'], ['800', '800'], ['1200', '1.200'], ['2000', '2.000']]) + '</div>' +
        '</div>' +
        '<div class="cx-ref">' +
          '<div><div class="cx-q">400 gemas hoy</div><div class="cx-big" id="cvRef400">—</div></div>' +
          '<div class="cx-meterbox"><div class="cx-mhead"><b id="cvScoreLabel">Conveniencia: …</b><span id="cvScoreNum" class="cx-q"></span></div>' +
            '<div class="cx-meter" id="cvMeter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Conveniencia para comprar gemas"><i id="cvScoreBar" class="cx-fill"></i></div>' +
            '<div class="cx-scale"><span>Muy bajo</span><span>Referencia: 120–130 g</span><span>Excelente</span></div></div>' +
        '</div>' +
        '<div class="cx-foot"><span id="cvState" class="cx-state" aria-live="polite"></span>' +
          '<button type="button" id="cvRefresh" class="cx-btn">Actualizar cotización</button></div>' +
        '<div id="cvVoice" class="cx-voice"></div>' +
      '</section>' +
      '<section class="cx-panel" aria-labelledby="cxTpTitle">' +
        '<h3 id="cxTpTitle"><img src="' + I_TP + '" width="22" height="22" alt=""> León Negro: tu Trading Post</h3>' +
        '<div id="cvTrans" aria-live="polite"></div>' +
        '<details class="cx-pop" id="cvPopDetails"><summary>Lo más comerciado hoy</summary><div id="cvPop"></div></details>' +
      '</section>' +
    '</div>';
  }

  // Un temporizador por campo: escribir en uno no cancela el cálculo del otro.
  var _deb = {};
  function debounce(key, fn) { clearTimeout(_deb[key]); _deb[key] = setTimeout(fn, 300); }

  function onViewClick(e) {
    var t = e.target, b;
    if (!t || !t.closest) return;
    if ((b = t.closest('[data-gold]'))) {
      var g = b.getAttribute('data-gold');
      if (g === 'all') { fillAllGold(); return; }
      byId('cvGold').value = g; onGoldInput(); return;
    }
    if ((b = t.closest('[data-gems]'))) { byId('cvGems').value = b.getAttribute('data-gems'); onGemsInput(); return; }
    if (t.closest('#cvRefresh')) { updateRef400(true); onGemsInput(); onGoldInput(); return; }
    if ((b = t.closest('[data-cx-type]'))) { state.transacciones.filters.type = b.getAttribute('data-cx-type'); renderTransacciones(); return; }
    if (t.closest('#cvTransaccionesRefresh') || t.closest('#cvTransaccionesRetry') || t.closest('#cvDeliveryRetry')) { loadTransacciones(true); return; }
    if (t.closest('[data-cx="pop-refresh"]')) loadOfertas(true);
  }

  function onViewChange(e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute('data-cx');
    if (k === 'pop-rarity') { state.ofertas.filters.rarity = t.value || ''; renderOfertas(); }
    else if (k === 'pop-volume') { state.ofertas.filters.minVolume = Number(t.value) || 0; renderOfertas(); }
  }

  function wireView(view) {
    view.addEventListener('click', onViewClick);
    view.addEventListener('change', onViewChange);
    byId('cvGold').addEventListener('input', function () { debounce('gold', onGoldInput); });
    byId('cvGems').addEventListener('input', function () { debounce('gems', onGemsInput); });
    var det = byId('cvPopDetails');
    if (det) det.addEventListener('toggle', function () { if (det.open) loadOfertas(false); });
  }

  /** Dibuja (o mueve) la vista dentro de `host` y la pone al día. */
  function mount(host) {
    if (!host) return null;
    injectCSS();
    var view = byId('cxRoot');
    if (!view) {
      view = document.createElement('div');
      view.id = 'cxRoot';
      view.className = 'cx';
      view.innerHTML = viewHTML();
      host.appendChild(view);
      wireView(view);
    } else if (view.parentNode !== host) {
      host.appendChild(view);
    }
    updateRef400(false);
    refreshTradingPost(false);
    return view;
  }

  // =======================================================================
  // MODAL (solo si la Cartera no ofrece la pestaña)
  // =======================================================================
  function ensureModal() {
    var modal = byId('convModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'convModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'convModalTitle');
    modal.setAttribute('hidden', '');
    modal.innerHTML =
      '<div class="modal__backdrop" data-close="1"></div>' +
      '<div class="modal__dialog cx-modal">' +
        '<header class="modal__header"><h3 id="convModalTitle">Cambio de divisas</h3>' +
        '<button type="button" class="modal__close" aria-label="Cerrar" data-close="1">✕</button></header>' +
        '<div class="modal__body" id="convModalBody"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-close') === '1') closeModal();
    });
    return modal;
  }

  function closeModal() {
    var modal = byId('convModal');
    if (modal) modal.setAttribute('hidden', '');
  }

  function openModal() {
    var wt = root.WalletTheme;
    if (wt && typeof wt.showTab === 'function' && wt.showTab('cambio')) return;
    var modal = ensureModal();
    mount(byId('convModalBody'));
    modal.removeAttribute('hidden');
    var close = modal.querySelector('.modal__close');
    if (close && close.focus) close.focus();
  }

  // =======================================================================
  // ESTILOS
  // =======================================================================
  var CSS = [
    '.cx{color:var(--tx-1)}',
    '.cx-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}',
    '.cx-panel{background:var(--bg-1);border:1px solid var(--bd-1);border-radius:16px;padding:18px;min-width:0}',
    '.cx-panel h3{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:1.05rem}',
    '.cx-conv{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:stretch;margin-bottom:12px}',
    '.cx-box{display:grid;gap:6px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:12px;padding:10px 12px;min-width:0}',
    'label.cx-box:focus-within{border-color:var(--acc-1)}',
    '.cx-lbl{display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--tx-3)}',
    '.cx-in{display:flex;align-items:baseline;gap:6px;font-size:1.45rem;font-weight:700;min-width:0}',
    '.cx-in input{background:none;border:0;outline:none;color:inherit;font:inherit;width:100%;min-width:0;padding:0}',
    '.cx-in small{font-size:.85rem;font-weight:500;color:var(--tx-3)}',
    '.cx-gem{color:var(--color-blue,#7dd3fc)}',
    '.cx-arrow{align-self:center;color:var(--tx-3);font-size:1.2rem}',
    '.cx-quick{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}',
    '.cx-quick button,.cx-btn{background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-2);border-radius:999px;padding:5px 12px;font:inherit;font-size:.8rem;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}',
    '.cx-quick button:hover,.cx-btn:hover{border-color:var(--acc-1);color:var(--tx-1)}',
    '.cx-ref{display:flex;gap:16px;align-items:center;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:12px;padding:12px 14px;margin-top:4px}',
    '.cx-big{font-size:1.6rem;font-weight:800;white-space:nowrap}',
    '.cx-meterbox{flex:1;min-width:0}.cx-mhead{display:flex;justify-content:space-between;gap:8px;font-size:.82rem}',
    '.cx-meter{height:10px;border-radius:999px;background:var(--bg-2,var(--bd-1));overflow:hidden;margin-top:6px}',
    '.cx-fill{display:block;height:100%;width:0;background:var(--acc-1);transition:width .3s}',
    '.cx-fill.is-exc,.cx-fill.is-good{background:var(--color-green,#34d399)}.cx-fill.is-mid{background:var(--gn-gold,#F2B94B)}.cx-fill.is-low,.cx-fill.is-bad{background:var(--color-red,#ef4444)}',
    '.cx-scale{display:flex;justify-content:space-between;gap:6px;font-size:.7rem;color:var(--tx-3);margin-top:4px}',
    '.cx-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px}',
    '.cx-state{font-size:.78rem;color:var(--tx-3)}.cx-state.is-error{color:var(--color-red,#ef4444)}',
    '.cx-voice{margin-top:14px}.cx-voice .shv-voice{margin:0}',
    '.cx-coin{font-variant-numeric:tabular-nums;white-space:nowrap}.cx-coin small{color:var(--tx-3);font-weight:500;margin:0 3px 0 1px;font-size:.75em}',
    '.cx-g{color:var(--gn-gold,#F2B94B)}.cx-s{color:var(--tx-1)}.cx-c{color:#c98a5a}',
    '.cx .cv-delivery{margin:0 0 12px;border-radius:12px}',
    '.cx-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.cx-tools .cx-btn{margin-left:auto}',
    '.cx-seg{display:inline-flex;border:1px solid var(--bd-1);border-radius:10px;overflow:hidden}',
    '.cx-seg button{background:var(--bg-0);border:0;color:var(--tx-3);padding:6px 11px;font:inherit;font-size:.8rem;cursor:pointer}',
    '.cx-seg button.is-on{background:var(--bg-2,var(--bg-1));color:var(--tx-1);box-shadow:inset 0 -2px 0 var(--acc-1)}',
    '.cx-sum{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.78rem;color:var(--tx-3);margin-bottom:10px}',
    '.cx-list{display:flex;flex-direction:column;gap:6px}',
    '.cx-ord{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;gap:10px;align-items:center;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:10px;padding:8px 10px}',
    '.cx-ord--pop{grid-template-columns:32px minmax(0,1fr) auto auto auto}',
    '.cx-ico{width:32px;height:32px;border-radius:6px;background:var(--bg-2,var(--bg-1));display:block}',
    '.cx-min{min-width:0}.cx-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.88rem}',
    '.cx-q{font-size:.74rem;color:var(--tx-3)}.cx-r{text-align:right;font-size:.85rem}',
    '.cx-tag{font-size:.72rem;font-weight:700;border-radius:999px;padding:2px 9px;border:1px solid currentColor}',
    '.cx-buy{color:var(--color-green,#34d399)}.cx-sell{color:var(--gn-gold,#F2B94B)}',
    '.cx-select{background:var(--bg-0);border:1px solid var(--bd-1);color:var(--tx-1);border-radius:10px;padding:6px 10px;font:inherit;font-size:.8rem}',
    '.cx-pop{margin-top:14px;border-top:1px solid var(--bd-1);padding-top:10px}',
    '.cx-pop summary{cursor:pointer;color:var(--tx-2);font-weight:600;font-size:.88rem;padding:4px 0}',
    '.cx-pop[open] summary{margin-bottom:10px}.cx-note{font-size:.76rem;color:var(--tx-3);margin:0 0 10px}',
    '.cx-empty{text-align:center;color:var(--tx-3);padding:18px 8px;margin:0}.cx-center{text-align:center;margin:0 0 8px}',
    '.cx-msg{display:grid;justify-items:center;gap:8px;text-align:center;padding:22px 10px;color:var(--tx-2)}.cx-msg p{margin:0;font-size:.85rem;color:var(--tx-3)}.cx-msg img{opacity:.8}',
    '.cx-modal{max-width:min(1100px,96vw);width:96vw}',
    '.cx button:focus-visible,.cx a:focus-visible,.cx select:focus-visible,.cx summary:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){.cx-grid{grid-template-columns:1fr}}',
    '@media (max-width:520px){.cx-conv{grid-template-columns:1fr}.cx-arrow{transform:rotate(90deg);justify-self:center}.cx-ref{flex-direction:column;align-items:stretch}.cx-ord--pop{grid-template-columns:32px minmax(0,1fr) auto}.cx-hm{display:none}}',
    '@media (prefers-reduced-motion:reduce){.cx-fill{transition:none}}'
  ].join('\n');

  function injectCSS() {
    if (byId('cx-style')) return;
    var s = document.createElement('style');
    s.id = 'cx-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // =======================================================================
  // API PÚBLICA
  // =======================================================================
  function initOnce() {
    if (state.inited) return;
    state.inited = true;
    // Un solo oyente, para siempre (antes se borraba tras el primer cierre).
    document.addEventListener('keydown', function (e) {
      var modal = byId('convModal');
      if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeModal();
    });
    document.addEventListener('gn:tokenchange', function () {
      var st = state.transacciones;
      st.buys = []; st.sells = []; st.delivery = []; st.lastUpdate = 0;
      st.buysStatus = 'unknown'; st.sellsStatus = 'unknown'; st.deliveryStatus = 'unknown';
      if (byId('cxRoot')) refreshTradingPost(false);
    });
    console.info(LOG, 'ready v' + VERSION);
  }

  root.ConverterModal = {
    version: VERSION,
    initOnce: initOnce,
    mount: mount,
    open: openModal,
    close: closeModal,
    _debug: function () { return { inited: state.inited, mounted: !!byId('cxRoot') }; },
    _state: state,
    _pure: {
      splitCopper: splitCopper, coinHTML: coinHTML, relTime: relTime, scoreFromPrice400: scoreFromPrice400,
      labelForScore: labelForScore, classForScore: classForScore, adviceFor: adviceFor,
      getFilteredOfertas: getFilteredOfertas, getFilteredTransacciones: getFilteredTransacciones, countOrders: countOrders
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOnce);
  else initOnce();

})(typeof window !== 'undefined' ? window : this);
