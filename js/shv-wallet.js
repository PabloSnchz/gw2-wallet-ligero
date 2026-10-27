/*!
 * js/shv-wallet.js — Mi voz en la Cartera (BL-059 SHV-1, nivel N2 de DEC-033)
 * Versión: 1.3.1 (2026-10-27) · los íconos de la Cartera ya no parpadean: «Ver la evolución de tu Cartera» se reescribía
 *          en cada pasada, wallet-theme.js redibujaba Destacadas por ese cambio y eso me volvía a llamar (un bucle de
 *          250 ms). Ahora solo escribo si algo cambió e ignoro lo que wallet-theme.js redibuja solo.
 *          1.3.0 (2026-10-27) · BL-075 SHE-2 (DEC-038): lo que noto y lo que te recomiendo sale en mi globo (js/shv-bubble.js),
 *          una vez por cosa nueva y uno por visita a la Cartera: el primero que no viste. Acá queda escrito solo lo
 *          crítico (el permiso «billetera») y la evolución, que es un dato: «Ver la evolución de tu Cartera» la abre.
 *          Si me silenciaste en Ajustes, hablo acá como en 1.2.0. «Ver la evolución» del globo abre el panel.
 *          1.2.0 (2026-10-27) · SHV-2b: mi voz dice lo que noto en la memoria (el oro de la semana, la divisa que no se
 *          mueve) y la evolución se abre desde mi voz con «Ver la evolución»: es parte de lo que digo, no otro bloque.
 *          1.1.0 (2026-10-27) · SHV-2: debajo de mi voz, la evolución de los últimos 30 días de la cuenta
 *          activa, con mi memoria (js/shv-memory.js). Con menos de 2 días no invento tendencias.
 *          1.0.0 (2026-10-26)
 *
 * Un solo mensaje, arriba de Mi cartera, con el formato común de js/shv-core.js:
 *   1. alta  · la Key activa no tiene el permiso «billetera» (no puedo leer tus divisas);
 *   2. media · no fijaste ninguna divisa: te sugiero fijar las que seguís;
 *   3. baja  · cuántas divisas tienen saldo y cuántas fijaste.
 * Cada mensaje dice de dónde lo sé y cuándo («Lo sé por: …»).
 * Lee lo que ya dibujó la Cartera (WalletTheme._state), la Key activa de Storage y mi memoria
 * (js/shv-memory.js, que es la que guarda). Se carga por js/modules.json, después de shv-memory.js.
 */
(function (root) {
  'use strict';
  var VERSION = '1.3.1';
  var HOST_ID = 'shvWalletVoice', MEM_ID = 'shvWalletMemory', BAR_ID = 'shvWalletMemBar';
  var doc = root.document;
  var st = { sig: null, memSig: null, timer: null, mo: null, memOpen: false, hasMem: false, focusMem: false, offered: false };

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ------------------------------------------------------------------ SHV-2b: lo que noto en mi memoria
  var CUR = { 2: 'Karma', 4: 'Gemas', 3: 'Monedas de Laurel', 63: 'Aclamación astral' };
  function namesOf(S) {
    var out = {};
    [S && S.models, S && S.tmodels].forEach(function (l) {
      (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.id && x.id !== 1 && x.name) out[x.id] = x.name; });
    });
    return out;
  }
  function memBasis(hist) {
    return { source: 'tus fotos diarias de la Cartera (' + plural(hist.length, 'día guardado', 'días guardados') + ' en este navegador)', at: hist[hist.length - 1].at };
  }
  /**
   * Tendencias de la cuenta activa (pura). hist: ShvMemory.history(huella), de la foto más vieja a la más nueva.
   * week: el oro de los últimos 7 días (contra la primera foto de esa ventana) y, si hay fotos, la semana anterior.
   * stale: la divisa con saldo que más días lleva igual (14 o más).
   */
  function trends(hist, names) {
    var out = { week: null, stale: null };
    if (!Array.isArray(hist) || hist.length < 2) return out;
    var last = hist[hist.length - 1], base = null, prev = null, i;
    for (i = 0; i < hist.length - 1; i++) if (hist[i].day >= last.day - 7) { base = hist[i]; break; }
    if (base && 1 in base.values && 1 in last.values) {
      for (i = 0; i < hist.length; i++) if (hist[i].day >= base.day - 7 && hist[i].day <= base.day - 5) { prev = hist[i]; break; }
      out.week = { days: last.day - base.day, from: base.values[1] / 10000, to: last.values[1] / 10000,
        prevDelta: prev && 1 in prev.values ? (base.values[1] - prev.values[1]) / 10000 : null };
    }
    Object.keys(last.values).forEach(function (k) {
      var id = Number(k), v = last.values[k];
      if (id === 1 || !(v > 0)) return;
      var j = hist.length - 1;
      while (j > 0 && hist[j - 1].values[k] === v) j--;
      var days = last.day - hist[j].day;
      if (days >= 14 && (!out.stale || days > out.stale.days)) {
        out.stale = { id: id, name: (names && names[id]) || CUR[id] || 'Divisa ' + id, days: days, value: v, sinceStart: j === 0 };
      }
    });
    return out;
  }
  function trendObs(hist, names) {
    var t = trends(hist, names), out = [];
    if (!t.week && !t.stale) return out;
    var basis = memBasis(hist), act = { label: 'Ver la evolución', act: 'mem' }, w = t.week, s = t.stale;
    if (w) {
      var d = w.to - w.from, txt = 'En ' + (w.days === 1 ? 'el último día' : 'los últimos ' + w.days + ' días') + ' tu oro ';
      txt += Math.abs(d) < 1 ? 'no cambió en esta cuenta: ' + num(w.to) + ' de oro.' : (d > 0 ? 'subió ' : 'bajó ') + num(Math.abs(d)) + ' en esta cuenta: de ' + num(w.from) + ' a ' + num(w.to) + '.';
      var lines = [txt];
      if (w.prevDelta !== null) lines.push(Math.abs(w.prevDelta) < 1 ? 'La semana anterior no se había movido.' : 'La semana anterior había ' + (w.prevDelta > 0 ? 'subido ' : 'bajado ') + num(Math.abs(w.prevDelta)) + '.');
      out.push({ module: 'cartera', id: 'trend', priority: 'media', kind: 'explica', text: lines, action: act, basis: basis,
        key: 'dia:' + hist[hist.length - 1].day + ':' + Math.round(w.to) }); // en mi globo, una vez por día (y por cuenta)
    }
    if (s) {
      out.push({ module: 'cartera', id: 'stale', priority: 'media', kind: 'explica',
        text: ['«' + s.name + '» está igual hace ' + (s.sinceStart ? 'al menos ' : '') + s.days + ' días en esta cuenta (' + num(s.value) + ').'], action: act, basis: basis,
        key: s.id + ':' + s.value }); // la misma divisa quieta en el mismo saldo es la misma novedad, pasen los días que pasen
    }
    return out;
  }

  /**
   * Observaciones de la Cartera (pura).
   * @param {{models:Array, lastAt:number|null, perms:Array|null, label:string}} input
   */
  function observe(input) {
    input = input || {};
    var out = [];
    var perms = input.perms, label = String(input.label || '').trim();
    if (Array.isArray(perms) && perms.indexOf('wallet') < 0) {
      out.push({
        module: 'cartera', id: 'perm', priority: 'alta', kind: 'advierte',
        text: ['La Key activa' + (label ? ', ' + label + ',' : '') + ' no tiene el permiso «billetera»: sin él no puedo leer tus divisas.',
          'Creá una Key con los 7 permisos en account.arena.net y reemplazala.'],
        action: { label: 'Revisar Keys', act: 'keys' },
        basis: { source: 'los permisos guardados de la Key activa', at: null }
      });
    }
    var hist = Array.isArray(input.history) ? input.history : [], tr = trendObs(hist, input.names);
    if (tr[0] && tr[0].id === 'trend') out.push(tr.shift()); // lo que noto va antes que la sugerencia de fijar
    var models = Array.isArray(input.models) ? input.models : [];
    if (models.length) {
      var withBal = models.filter(function (m) { return Number(m && m.amount) > 0; }).length;
      var pinned = models.filter(function (m) { return m && m.pinned; }).length;
      var basis = { source: 'tu Cartera, leída de la API oficial', at: typeof input.lastAt === 'number' ? input.lastAt : null };
      if (!pinned) {
        out.push({
          module: 'cartera', id: 'pin', priority: 'media', kind: 'recomienda',
          text: ['Tenés ' + plural(withBal, 'divisa', 'divisas') + ' con saldo en esta cuenta. Fijá con ★ las que seguís: suben a Destacadas y son las primeras que voy a mirar.'],
          basis: basis, key: 'fijar' // te lo sugiero una vez, aunque cambie cuántas divisas tenés
        });
      } else {
        out.push({
          module: 'cartera', id: 'summary', priority: 'baja', kind: 'explica',
          text: ['Tenés ' + plural(withBal, 'divisa', 'divisas') + ' con saldo en esta cuenta y ' + plural(pinned, 'fijada', 'fijadas') + ' en Destacadas.'],
          basis: basis
        });
      }
      if (hist.length === 1) out[out.length - 1].text.push('Desde hoy recuerdo tu Cartera: en unos días te digo cómo evoluciona.');
    }
    out.push.apply(out, tr);
    return out;
  }

  /**
   * Qué digo dónde (pura, DEC-038). Sin globo (o silenciada): una sola voz en la Cartera, la de mayor prioridad.
   * Con globo: en la Cartera solo lo crítico (prioridad alta); al globo, en orden, lo que noto y lo que te recomiendo
   * (media) y, el primer día, el resumen que dice «Desde hoy recuerdo tu Cartera».
   */
  function split(list, histLen, bubble) {
    var C = root.ShvCore;
    list = Array.isArray(list) ? list : [];
    if (!bubble) return { voice: C.pick(list), offers: [] };
    var P = C.PRIORITY, offers = list.filter(function (o) { return o.priority === 'media' || (o.priority === 'baja' && histLen === 1); });
    offers = offers.map(function (o, i) { return [o, i]; }).sort(function (a, b) { return (P[b[0].priority] - P[a[0].priority]) || a[1] - b[1]; })
      .map(function (x) { return x[0]; });
    return { voice: C.pick(list.filter(function (o) { return o.priority === 'alta'; })), offers: offers };
  }
  function bubbleOn() { var B = root.ShvBubble; return !!(B && typeof B.offer === 'function' && !B.quiet()); }
  function hiddenUp(n) { for (; n && n.getAttribute; n = n.parentNode) if (n.hidden || n.getAttribute('hidden') !== null) return true; return false; }
  /** Estoy en la Cartera (#/cards, o sin hash, que el router muestra como la Cartera) y se ve. */
  function onCartera() {
    var h = String((root.location && root.location.hash) || '').split('?')[0].replace(/\/+$/, '');
    var p = doc && doc.getElementById('walletPanel');
    return (h === '' || h === '#' || h === '#/cards') && !!p && !hiddenUp(p);
  }
  // Uno por visita: la primera observación que no viste.
  function offer(offers) {
    var B = root.ShvBubble;
    if (st.offered || !offers.length || !onCartera()) return;
    for (var i = 0; i < offers.length; i++) {
      if (B.seen(offers[i])) continue;
      if (B.offer(offers[i])) st.offered = true;
      return;
    }
  }

  function activeKey() {
    try {
      var S = root.Storage;
      var keys = S && S.get('gn:account:keys');
      if (!Array.isArray(keys)) return null;
      var sel = S.get('gn:account:selected'), first = null;
      for (var i = 0; i < keys.length; i++) {
        if (!keys[i] || !keys[i].value) continue;
        if (keys[i].value === sel) return keys[i];
        if (!first) first = keys[i];
      }
      return first;
    } catch (_) { return null; }
  }

  function input() {
    var W = root.WalletTheme, S = W && W._state, k = activeKey(), M = root.ShvMemory;
    return {
      models: S && Array.isArray(S.models) ? S.models : [],
      lastAt: S && S.lastAt ? S.lastAt : null,
      perms: k && Array.isArray(k.perms) ? k.perms : null,
      label: k ? String(k.label || '') : '',
      history: M && k && k.value ? M.history(M.fingerprint(k.value)) : null,
      names: namesOf(S)
    };
  }

  function host() {
    var p = doc && doc.getElementById('walletPanel');
    return p ? p.querySelector('.panel__body') : null;
  }
  // Lo mío y lo que wallet-theme.js redibuja solo (cabecera, Destacadas, chips) no es un dibujo nuevo de la Cartera.
  var CHROME = /(^|\s)(wn-head|wn-stars|wn-cats|wn-toolbar)(\s|$)/;
  function inside(n) {
    while (n) { if (n.id === HOST_ID || n.id === MEM_ID || n.id === BAR_ID || CHROME.test(n.className || '')) return true; n = n.parentNode; }
    return false;
  }

  // ------------------------------------------------------------------ SHV-2: mi memoria de la Cartera
  var NF = typeof Intl !== 'undefined' ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }) : null;
  function num(v) { v = Math.round(v); return NF ? NF.format(v) : String(v); }
  function short(v) {
    if (Math.abs(v) >= 1e6) return String(Math.round(v / 1e5) / 10).replace('.', ',') + ' M';
    return num(v);
  }
  var MEM_CSS = [
    '#' + MEM_ID + '{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-1);padding:12px 14px;margin:0 0 12px;color:var(--tx-1)}',
    '.shv-mem__t{margin:0 0 6px;font-weight:700;font-size:.9rem;color:var(--tx-1)}',
    '#' + MEM_ID + ' svg{display:block;color:var(--acc-1);margin:2px 0 6px}',
    '.shv-mem__r{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid var(--bd-1);font-size:.88rem;color:var(--tx-1)}',
    '.shv-mem__v{font-weight:700;white-space:nowrap}.shv-mem__d{font-weight:600;color:var(--tx-2);margin-left:4px}',
    '.shv-mem__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.shv-mem__f,.shv-mem__x{margin:6px 0 0;font-size:.78rem;color:var(--tx-2)}'
  ].join('');

  /**
   * Lo que muestra el panel de evolución (pura). sum: ShvMemory.summary(...).
   * Con menos de 2 fotos en la ventana no hay tendencia: lo digo así, sin inventar.
   */
  function memoryModel(sum, now) {
    if (!sum || !sum.days) return null;
    var C = root.ShvCore, src = 'tus fotos diarias de la Cartera (' + plural(sum.days, 'día guardado', 'días guardados') + ' en este navegador)';
    var basis = C ? C.basisText({ source: src, at: sum.lastAt }, now) : src;
    if (sum.inWindow < 2) return { empty: true, text: 'Empecé a recordar tu Cartera. Con unos días más de fotos te muestro cómo evoluciona.', basis: basis };
    var n = sum.gold.length, vals = sum.gold.filter(function (v) { return v !== null; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1, pts = [];
    sum.gold.forEach(function (v, i) {
      if (v !== null) pts.push(Math.round(i * 300 / Math.max(1, n - 1)) + ',' + Math.round(62 - (v - lo) * 54 / span));
    });
    return {
      empty: false, points: pts.join(' '), basis: basis,
      label: 'Oro, últimos ' + n + ' días: de ' + num(vals[0]) + ' a ' + num(vals[vals.length - 1]),
      rows: sum.rows.filter(function (r) { return r.value || r.delta; }).map(function (r) { // lo que está y sigue en 0, no
        var d = r.delta;
        return {
          name: r.name, value: short(r.value) + (r.gold ? ' de oro' : ''),
          delta: d === null ? '' : d > 0 ? '▲ ' + short(d) : d < 0 ? '▼ ' + short(-d) : '=',
          sr: d === null ? '' : d > 0 ? 'subió ' + short(d) : d < 0 ? 'bajó ' + short(-d) : 'sin cambios'
        };
      })
    };
  }

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function memoryNode(m) {
    var box = el('section', 'shv-mem');
    box.id = MEM_ID;
    box.setAttribute('aria-label', 'Evolución de tu Cartera');
    box.appendChild(el('p', 'shv-mem__t', m.empty ? 'Mi memoria de tu Cartera' : 'Evolución · últimos 30 días'));
    if (m.empty) box.appendChild(el('p', 'shv-mem__x', m.text));
    else {
      var NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), pl = doc.createElementNS(NS, 'polyline');
      [['viewBox', '0 0 300 70'], ['width', '100%'], ['height', '70'], ['role', 'img'], ['aria-label', m.label]].forEach(function (a) { svg.setAttribute(a[0], a[1]); });
      [['points', m.points], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2.5']].forEach(function (a) { pl.setAttribute(a[0], a[1]); });
      svg.appendChild(pl);
      box.appendChild(svg);
      m.rows.forEach(function (r) {
        var row = el('div', 'shv-mem__r'), v = el('span', 'shv-mem__v', r.value);
        row.appendChild(el('span', null, r.name));
        if (r.delta) {
          var d = el('span', 'shv-mem__d', r.delta);
          d.setAttribute('aria-hidden', 'true');
          v.appendChild(d);
          v.appendChild(el('span', 'shv-mem__sr', ' (' + r.sr + ')'));
        }
        row.appendChild(v);
        box.appendChild(row);
      });
    }
    box.appendChild(el('p', 'shv-mem__f', 'Lo sé por: ' + m.basis));
    return box;
  }

  function paintMemory() {
    var M = root.ShvMemory, body = host(), k = activeKey(), cur = doc.getElementById(MEM_ID);
    if (!M || !body || !k || !k.value) {
      if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
      if (doc) removeBar();
      st.memSig = null;
      return;
    }
    var W = root.WalletTheme, S = W && W._state, names = {};
    if (S && S.lastAt) M.ensureToday(k.value);
    [S && S.models, S && S.tmodels].forEach(function (l) {
      (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.id && x.id !== 1 && x.name) names[x.id] = x.name; });
    });
    var now = Date.now(), m = memoryModel(M.summary(M.fingerprint(k.value), 30, now, names), now);
    if (st.bubble) paintBar(body, !!(m && !m.empty)); // con globo, la evolución se abre desde su propio botón
    else removeBar();
    if (!st.memOpen || !st.hasMem || (m && m.empty)) m = null; // se abre desde mi voz (o desde su botón)
    var sig = m ? JSON.stringify(m) : '';
    if (sig === st.memSig && (m ? !!cur : !cur)) return;
    st.memSig = sig;
    if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    if (!m) return;
    if (!doc.getElementById('shv-mem-css')) {
      var s = doc.createElement('style');
      s.id = 'shv-mem-css';
      s.textContent = MEM_CSS;
      (doc.head || doc.documentElement).appendChild(s);
    }
    var voice = doc.getElementById(BAR_ID) || doc.getElementById(HOST_ID);
    body.insertBefore(memoryNode(m), voice && voice.parentNode === body ? voice.nextSibling : body.firstChild);
  }

  function removeBar() { var b = doc.getElementById(BAR_ID); if (b && b.parentNode) b.parentNode.removeChild(b); }
  // «Ver la evolución de tu Cartera»: un dato, sin mi avatar (DEC-024). Debajo de mi voz si hay algo crítico.
  function paintBar(body, avail) {
    var bar = doc.getElementById(BAR_ID);
    st.hasMem = avail;
    if (!avail) { removeBar(); return; }
    if (!bar) {
      bar = el('div', 'shv-obs__acts');
      bar.id = BAR_ID;
      var b = el('button', 'shv-obs__btn');
      b.type = 'button';
      b.setAttribute('data-shv-act', 'mem');
      b.setAttribute('aria-controls', MEM_ID);
      bar.appendChild(b);
      var voice = doc.getElementById(HOST_ID);
      body.insertBefore(bar, voice && voice.parentNode === body ? voice.nextSibling : body.firstChild);
    }
    // Solo escribo si cambia: cada cambio en la Cartera hace que wallet-theme.js redibuje Destacadas (sus íconos
    // parpadeaban) y eso me volvía a llamar, cada 250 ms (1.3.1).
    var btn = bar.firstChild, label = st.memOpen ? 'Ocultar la evolución de tu Cartera' : 'Ver la evolución de tu Cartera';
    if (btn.textContent !== label) btn.textContent = label;
    if (btn.getAttribute('aria-expanded') !== String(st.memOpen)) btn.setAttribute('aria-expanded', String(st.memOpen));
    if (st.focusMem && btn.focus) btn.focus();
    st.focusMem = false;
  }

  function paint() {
    st.timer = null;
    paintVoice();
    paintMemory();
  }
  function paintVoice() {
    var C = root.ShvCore, body = host();
    if (!C || !root.Shiruvana || !body) return;
    var inp = input(), bubble = bubbleOn(), parts = split(observe(inp), inp.history ? inp.history.length : 0, bubble);
    var obs = parts.voice;
    if (bubble !== st.bubble) { st.bubble = bubble; st.sig = null; }
    if (bubble) offer(parts.offers);
    var cur = doc.getElementById(HOST_ID);
    var sig = obs ? obs.id + '|' + obs.text.join(' ') + '|' + C.basisText(obs.basis) + '|' + st.memOpen : '';
    if (sig === st.sig && (obs ? !!cur : !cur)) return;
    st.sig = sig;
    if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    if (!bubble) st.hasMem = false;
    if (!obs) return;
    var el = C.render(obs, { doc: doc });
    if (!el) return;
    el.id = HOST_ID;
    var mb = el.querySelector ? el.querySelector('[data-shv-act="mem"]') : null;
    if (!bubble) st.hasMem = !!mb;
    if (mb) {
      mb.textContent = st.memOpen ? 'Ocultar la evolución' : 'Ver la evolución';
      mb.setAttribute('aria-expanded', String(st.memOpen));
      mb.setAttribute('aria-controls', MEM_ID);
    }
    body.insertBefore(el, body.firstChild);
    if (bubble) return; // con globo, el foco lo toma «Ver la evolución de tu Cartera» (paintBar)
    if (mb && st.focusMem && mb.focus) mb.focus();
    st.focusMem = false;
  }
  function schedule() { if (!st.timer) st.timer = root.setTimeout(paint, 250); }

  function onClick(e) {
    var b = e && e.target && e.target.closest ? e.target.closest('#' + HOST_ID + ' [data-shv-act],#' + BAR_ID + ' [data-shv-act]') : null;
    if (!b) return;
    if (b.getAttribute('data-shv-act') === 'keys') { var k = doc.getElementById('keysMenuBtn'); if (k) k.click(); }
    if (b.getAttribute('data-shv-act') === 'mem') { st.memOpen = !st.memOpen; st.focusMem = true; paint(); }
  }
  // «Ver la evolución» desde mi globo: abro el panel (y si estás en otra pantalla, te llevo a la Cartera).
  function onAct(e) {
    var d = e && e.detail;
    if (!d || d.module !== 'cartera') return;
    if (d.act === 'keys') { var k = doc.getElementById('keysMenuBtn'); if (k) k.click(); return; }
    if (d.act !== 'mem') return;
    st.memOpen = true;
    st.focusMem = true;
    if (!onCartera() && root.location) root.location.hash = '#/cards';
    paint();
  }
  function onRoute() { st.offered = false; schedule(); }

  function init() {
    if (!doc) return;
    var p = doc.getElementById('walletPanel');
    if (p && typeof root.MutationObserver === 'function') {
      st.mo = new root.MutationObserver(function (recs) {
        if (recs && recs.length && recs.every(function (r) { return inside(r.target); })) return;
        schedule();
      });
      st.mo.observe(p, { childList: true, subtree: true });
    }
    doc.addEventListener('gn:tokenchange', schedule);
    doc.addEventListener('gn:shv-memory', schedule);
    doc.addEventListener('click', onClick);
    doc.addEventListener('gn:shv-act', onAct);
    doc.addEventListener('gn:shv-quiet', schedule);
    if (root.addEventListener) root.addEventListener('hashchange', onRoute);
    schedule();
  }

  root.ShvWallet = { version: VERSION, observe: observe, split: split, memoryModel: memoryModel, trends: trends, refresh: paint, HOST_ID: HOST_ID, MEM_ID: MEM_ID, BAR_ID: BAR_ID };
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (root.console && root.console.info) root.console.info('[ShvWallet] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
