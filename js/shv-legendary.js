/*!
 * js/shv-legendary.js — Lo que noto de tu legendaria (BL-059 SHV-3, nivel N4 de DEC-033)
 * Versión: 1.2.0 (2026-10-27) · SHV-3c: con mis fotos diarias de la Cartera (js/shv-memory.js) te digo si ese oro ya
 *          lo tenés y, con 7 días o más de fotos, en cuánto lo juntás a tu ritmo. Si tu oro no subió, no invento plazo.
 *          1.1.0 (2026-10-27) · SHV-3b: hablo en «Mi cola» de la Armería con mi globo (js/shv-bubble.js), una vez por
 *          visita y por novedad (cambia la legendaria o cuántos materiales te faltan). Si me silenciaste, lo escribo
 *          dentro de «Mi cola». «Ver qué me falta» abre su ficha. Pido precios al Bazar solo por lo que falta.
 *          1.0.0 (2026-10-27) · SHV-3a: solo la cuenta, sin pantalla.
 *
 * Propuesta aprobada por Pablo (2026-10-27 04:00Z): docs/propuestas/propuesta-shiruvana-shv3.html.
 *   D1 hablo de la primera legendaria de «Mi cola»; sin cola no digo nada.
 *   D2 árbol completo (LegendaryTree.build) si los precursores ya están cargados; si no, la receta directa
 *      (LegendaryTracker.computeMaterials) y lo digo. No obligo a bajar los 268 KB de precursores.
 *   D3 el precio es el de venta del Bazar: lo que pagás comprando al instante.
 *   D4 el ritmo («a tu ritmo, ~Y días») queda para SHV-3c, con 7 días de memoria o más.
 *   D5 lo que no se vende va aparte y no suma oro.
 *
 * estimate/observe son puros: reciben lo que ya calcularon la Armería y el Bazar y devuelven números u
 * observaciones con el formato común de js/shv-core.js. La parte de abajo (SHV-3b) lee el estado público de
 * LegendaryTracker y LegendaryTree, no guarda nada propio (lo visto lo recuerda shv-bubble) y se carga por
 * js/modules.json, después de shv-bubble.js.
 */
(function (root) {
  'use strict';
  var VERSION = '1.2.0';
  var PACE_MIN = 7, PACE_MAX = 14; // D4: el ritmo sale de 7 a 14 días de fotos, nunca de menos

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Precio de venta en cobre. Acepta el número solo, {sell} o la forma de /v2/commerce/prices
  // ({sells:{unit_price}}). Sin vendedores (unit_price 0) es como si no se vendiera.
  function priceOf(prices, id) {
    if (!prices) return 0;
    var p = prices[id];
    if (p == null) return 0;
    if (typeof p === 'number') return num(p);
    if (typeof p === 'object') {
      if (p.sells && typeof p.sells === 'object') return num(p.sells.unit_price);
      return num(p.sell);
    }
    return 0;
  }

  // De qué cuento: del árbol (materiales base) si está, o de la receta directa.
  function rowsOf(input) {
    var t = input.tree;
    if (t && !t.needsPrecursors && t.status === 'recipe' && t.totals && Array.isArray(t.totals.rows) && t.totals.rows.length) {
      return { base: 'tree', rows: t.totals.rows, vendor: t.totals.vendor || [],
        unknown: (t.totals.sinId || []).length + (t.totals.unknown || []).length };
    }
    var r = input.recipe;
    if (r && r.status === 'recipe' && Array.isArray(r.rows) && r.rows.length) {
      return { base: 'recipe', rows: r.rows, vendor: [], unknown: 0 };
    }
    return null;
  }

  /**
   * Cuánto falta para una legendaria (puro).
   * input: { item:{id,name}, tree: LegendaryTree.build(id) | null, recipe: computeMaterials(id) | null,
   *          stock: {itemId: cantidad} (banco + materiales + personajes), prices: {itemId: precio} | null }
   * Devuelve null si no hay de qué contar.
   */
  function estimate(input) {
    if (!input || !input.item || !input.item.id) return null;
    var src = rowsOf(input);
    if (!src) return null;
    var stock = input.stock || {}, priced = !!input.prices;
    var acc = {}, order = [];
    src.rows.forEach(function (r) {
      var id = Number(r && r.itemId);
      if (!id) return;
      if (!acc[id]) { acc[id] = { itemId: id, name: r.name || ('#' + id), need: 0 }; order.push(id); }
      acc[id].need += num(r.need);
    });
    var out = {
      itemId: Number(input.item.id), name: String(input.item.name || ('#' + input.item.id)), base: src.base,
      total: 0, missingKinds: 0, missingUnits: 0, gold: 0, buyable: 0, untradeable: 0, untradeableNames: [],
      vendor: 0, unknown: src.unknown, priced: priced
    };
    order.forEach(function (id) {
      var row = acc[id];
      if (!(row.need > 0)) return;
      out.total++;
      var miss = Math.max(0, row.need - num(stock[id]));
      if (!miss) return;
      out.missingKinds++;
      out.missingUnits += miss;
      var p = priceOf(input.prices, id);
      if (p > 0) { out.buyable++; out.gold += miss * p; }
      else if (priced) { out.untradeable++; out.untradeableNames.push(row.name); }
    });
    var seen = {};
    src.vendor.forEach(function (v) { var id = Number(v && v.id); if (id && !seen[id]) { seen[id] = 1; out.vendor++; } });
    return out;
  }

  // 1234567 de cobre -> «123»; 1.234 con punto de miles. Menos de 1 oro se dice así.
  function goldText(copper) {
    var g = Math.round(num(copper) / 10000);
    if (g < 1) return 'menos de 1 oro';
    return '~' + String(g).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' oro';
  }

  /**
   * SHV-3c (puro). hist: mis fotos diarias de la Cartera de esta cuenta (js/shv-memory.js), de la más vieja a la
   * más nueva ({day, values:{1: cobre}}). copper: el oro que falta, en cobre. today: hoy, contado como en mi memoria.
   * Solo hablo con una foto de hoy o de ayer (si no, el oro que veo es viejo).
   *  - Si ya tenés ese oro: {have, gold}.
   *  - Si no, comparo con la foto más nueva de hace 7 a 14 días: si el oro subió, {perDay, span, days}.
   *  - Menos de 7 días de fotos, o el oro no subió: null (no invento plazo).
   */
  function pace(hist, copper, today) {
    if (!Array.isArray(hist) || !hist.length || !(copper > 0) || typeof today !== 'number') return null;
    var last = hist[hist.length - 1];
    if (!last || !last.values || last.day < today - 1) return null; // sin oro en la foto: now 0, no hay ritmo
    var now = Number(last.values[1]) || 0;
    if (now >= copper) return { have: true, gold: now };
    var base = null;
    for (var i = hist.length - 1; i >= 0; i--) {
      var h = hist[i];
      if (h && h.values && 1 in h.values && h.day <= last.day - PACE_MIN && h.day >= last.day - PACE_MAX) { base = h; break; }
    }
    if (!base) return null;
    var span = last.day - base.day, perDay = (now - Number(base.values[1])) / span;
    if (!(perDay > 0)) return null;
    return { perDay: perDay, span: span, days: Math.ceil((copper - now) / perDay) };
  }
  function paceText(p) {
    if (p.have) return 'Ese oro ya lo tenés en tu Cartera (' + goldText(p.gold).replace('~', '') + ').';
    var d = p.days > 365 ? 'más de un año' : '~' + plural(p.days, 'día', 'días');
    return 'A tu ritmo de los últimos ' + p.span + ' días (' + goldText(p.perDay) + ' por día), lo que te falta de ese oro lo juntás en ' + d + '.';
  }

  /** Observaciones con el formato de js/shv-core.js (a lo sumo una). opts: { at } = cuándo se leyó. */
  function observe(input, opts) {
    opts = opts || {};
    var e = estimate(input);
    if (!e || !e.total) return [];
    var tree = e.base === 'tree', text = [];
    if (!e.missingKinds) {
      text.push(tree ? 'Para ' + e.name + ' ya tenés todos los materiales base: lo que queda es fabricar.' :
        'Para ' + e.name + ' ya tenés todo lo de la receta directa.');
    } else {
      var falta = e.missingKinds === 1 ? 'te falta ' : 'te faltan ';
      text.push(tree ? 'Para ' + e.name + ' ' + falta + plural(e.missingKinds, 'material base', 'materiales base') + ' (de ' + e.total + ').' :
        'Para ' + e.name + ' ' + falta + e.missingKinds + ' de los ' + e.total + ' ingredientes de la receta directa' +
        ' (cuando abras su árbol, te cuento los materiales base).');
      if (e.buyable) text.push('Comprando lo que se vende: ' + goldText(e.gold) + ' al precio del Bazar.');
      var pc = e.buyable ? pace(input.hist, e.gold, input.today) : null;
      if (pc) text.push(paceText(pc));
      if (e.untradeable) text.push(plural(e.untradeable, 'no se vende', 'no se venden') + ': ' +
        (e.untradeable === 1 ? 'se fabrica o se consigue' : 'se fabrican o se consiguen') + ' jugando.');
    }
    var src = 'tu inventario (banco, materiales y personajes) y ' + (tree ? 'el árbol de fabricación' : 'la receta de la Armería') +
      (e.priced ? ', con los precios del Bazar' : '') + (pc ? ' y tus fotos diarias de la Cartera' : '');
    return [{
      module: 'legendary', id: 'falta:' + e.itemId, priority: 'media',
      kind: e.missingKinds ? 'explica' : 'saluda', text: text,
      action: { label: 'Ver qué me falta', act: 'legendary-open:' + e.itemId },
      basis: { source: src, at: typeof opts.at === 'number' ? opts.at : null }
    }];
  }

  // ------------------------------------------------------------------ SHV-3b: hablo en «Mi cola»
  // La Armería no tiene precios de materiales (su caché de precios nunca se llena): pido al Bazar UNA vez por
  // lo que falta, con la caché de GW2Api. Si el Bazar no responde nada, no hablo de oro (sin precios = null).
  var VOICE_ID = 'shvLegVoice', WAIT = 300;
  var doc = root.document;
  var st = { mo: null, timer: null, busy: false, spoke: false, sig: null, obs: null };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function shown(n) {
    for (var x = n; x && x !== doc; x = x.parentNode) if (x.hidden) return false;
    return !!n && (typeof n.getClientRects !== 'function' || n.getClientRects().length > 0);
  }
  // Banco + materiales + personajes, sumados (la misma cuenta que stockMap() de la Armería).
  function stockOf(s) {
    var m = {};
    [s.bank, s.materials, s.characterItems].forEach(function (arr) {
      (Array.isArray(arr) ? arr : []).forEach(function (it) {
        var id = it && (it.id || it.item_id), c = it ? Number(it.count) : 0;
        if (id && c > 0) m[id] = (m[id] || 0) + c;
      });
    });
    return m;
  }
  function nameOf(id) {
    var cat = (root.LegendaryCatalog && root.LegendaryCatalog.items) || [];
    for (var i = 0; i < cat.length; i++) if (cat[i] && cat[i].id === id) return cat[i].nameEs || cat[i].name;
    return null;
  }
  /** Lo que sé de la primera de tu cola que todavía no tenés (D1), sin precios. null si no hay de qué hablar. */
  function inputNow() {
    var T = root.LegendaryTracker, LT = root.LegendaryTree;
    if (!T || typeof T.getState !== 'function' || typeof T.getQueue !== 'function') return null;
    var s = T.getState() || {};
    if (s.loading || !s.token || s.error || (s.readErrors && s.readErrors.length)) return null;
    var owned = s.owned || {}, q = T.getQueue() || [], id = null;
    for (var i = 0; i < q.length; i++) if (!(owned[q[i]] > 0)) { id = Number(q[i]); break; }
    if (!id) return null;
    var tree = null;
    try { if (LT && typeof LT.hasPrecursors === 'function' && LT.hasPrecursors()) tree = LT.build(id); } catch (e) { tree = null; }
    var recipe = typeof T.computeMaterials === 'function' ? T.computeMaterials(id) : null;
    return { item: { id: id, name: nameOf(id) || ('#' + id) }, tree: tree, recipe: recipe, stock: stockOf(s), prices: null, token: s.token,
      hist: histOf(s.token), today: todayOf() };
  }
  // SHV-3c: mis fotos diarias de la Cartera de esta cuenta (por la huella de la Key; nunca la Key).
  function histOf(token) {
    var M = root.ShvMemory;
    try { return M && typeof M.history === 'function' && typeof M.fingerprint === 'function' ? M.history(M.fingerprint(token)) : null; } catch (e) { return null; }
  }
  function todayOf() {
    var M = root.ShvMemory, f = M && M._pure && M._pure.dayOf;
    return typeof f === 'function' ? f(Date.now()) : null;
  }
  function missingIds(input) {
    var src = rowsOf(input), out = [];
    if (!src) return out;
    src.rows.forEach(function (r) {
      var id = Number(r && r.itemId);
      if (id && out.indexOf(id) < 0 && num(r.need) > num(input.stock[id])) out.push(id);
    });
    return out;
  }
  function pricesFor(ids) {
    var A = root.GW2Api;
    if (!ids.length || !A || typeof A.getCommercePrices !== 'function') return Promise.resolve(null);
    return Promise.resolve(A.getCommercePrices(ids)).then(function (arr) {
      if (!Array.isArray(arr) || !arr.length) return null;
      var m = {};
      arr.forEach(function (p) { if (p && p.id) m[p.id] = p; });
      return m;
    }, function () { return null; });
  }
  function quietNow() { var B = root.ShvBubble; return !B || typeof B.offer !== 'function' || (typeof B.quiet === 'function' && !!B.quiet()); }

  // Silenciada (o sin globo): lo escribo dentro de «Mi cola», debajo del título. Solo si cambió (LES: varios
  // MutationObserver sobre el mismo panel → escribir solo si algo cambió).
  function paintInline(qv, obs) {
    var C = root.ShvCore, old = byId(VOICE_ID);
    var sig = obs ? obs.text.join(' ') : '';
    if (old && old.parentNode === qv && old.getAttribute('data-sig') === sig) return false;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!obs || !C || typeof C.render !== 'function') return !!old;
    var v = C.render(obs);
    if (!v) return !!old;
    var box = doc.createElement('div');
    box.id = VOICE_ID;
    box.setAttribute('data-sig', sig);
    box.appendChild(v);
    var head = qv.querySelector ? qv.querySelector('.arm-sec') : null;
    qv.insertBefore(box, head ? head.nextSibling : qv.firstChild);
    return true;
  }

  function check() {
    var body = byId('legendaryArmoryBody');
    var qv = body && body.querySelector ? body.querySelector('.arm-qview') : null;
    if (!qv || !shown(qv) || st.busy) return Promise.resolve('none');
    var input = inputNow();
    if (!input) { paintInline(qv, null); return Promise.resolve('none'); }
    var base = estimate(input);
    if (!base) return Promise.resolve('none');
    var sig = input.token + '|' + base.itemId + '|' + base.base + '|' + base.missingKinds + '|' + base.missingUnits;
    if (st.sig === sig && st.obs) return Promise.resolve(tell(qv, st.obs)); // mismo dato: no vuelvo a pedir precios
    st.busy = true; // una consulta a la vez: la Armería repinta varias veces mientras el Bazar responde
    return pricesFor(missingIds(input)).then(function (prices) {
      st.busy = false;
      input.prices = prices;
      var obs = observe(input, { at: Date.now() })[0] || null;
      if (!obs) return 'none';
      obs.key = base.itemId + '|' + base.base + '|' + base.missingKinds;
      st.sig = sig; st.obs = obs;
      var now = body.querySelector('.arm-qview');
      return now && shown(now) ? tell(now, obs) : 'none';
    }, function () { st.busy = false; return 'none'; });
  }
  // Silenciada: escrito en «Mi cola». Si no, mi globo, uno por visita a la Armería (shv-bubble no repite lo visto).
  function tell(qv, obs) {
    if (quietNow()) { paintInline(qv, obs); return 'inline'; }
    paintInline(qv, null);
    if (st.spoke) return 'none';
    st.spoke = true;
    return root.ShvBubble.offer(obs) ? 'bubble' : 'none';
  }
  function later() {
    if (st.timer) root.clearTimeout(st.timer);
    st.timer = root.setTimeout(function () { st.timer = null; check(); }, WAIT);
  }
  function onAct(e) {
    var d = e && e.detail, m = d && d.module === 'legendary' && /^legendary-open:(\d+)$/.exec(String(d.act || ''));
    var T = root.LegendaryTracker;
    if (m && T && typeof T.openItemModal === 'function') T.openItemModal(Number(m[1]));
  }
  // El botón de mi voz escrita (silenciada) hace lo mismo que el del globo.
  function onClick(e) {
    var t = e && e.target, b = t && t.closest ? t.closest('#' + VOICE_ID + ' [data-shv-act]') : null;
    if (b) onAct({ detail: { module: 'legendary', act: b.getAttribute('data-shv-act') } });
  }
  function wire() {
    var body = byId('legendaryArmoryBody');
    if (!body || st.mo || typeof root.MutationObserver !== 'function') return false;
    st.mo = new root.MutationObserver(later);
    st.mo.observe(body, { childList: true, subtree: true });
    doc.addEventListener('gn:shv-act', onAct);
    doc.addEventListener('gn:shv-quiet', later);
    body.addEventListener('click', onClick);
    if (root.addEventListener) root.addEventListener('hashchange', function () { st.spoke = false; later(); });
    later();
    return true;
  }

  root.ShvLegendary = { version: VERSION, estimate: estimate, observe: observe, priceOf: priceOf, goldText: goldText, pace: pace,
    check: check, wire: wire, _pure: { stockOf: stockOf, missingIds: missingIds, inputNow: inputNow } };
  if (doc && doc.addEventListener) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }
})(typeof window !== 'undefined' ? window : globalThis);
