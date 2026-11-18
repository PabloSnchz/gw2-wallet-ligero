/*!
 * js/shv-bubble.js — Shiruvana que aparece: mi globo (BL-075 SHE-1, DEC-038)
 * Versión: 1.6.0
 *
 * 1.6.0 (BL-092 BV-4, D4): con el globo puesto también preparo mis poses de cuerpo entero sin fondo (saluda y
 *   pensando) con el recorte del kit (posesSinFondo, una vez por imagen, desde assets/brand/shiruvana/): quedan en
 *   body como --svk-p-<pose> y la clase svk-p-<pose>. css/universo.css 1.3.0 las pone en Inicio y en las pantallas
 *   vacías. Mientras no están listas no se ve nada: nunca un rectángulo negro.
 *
 * 1.5.0 (BL-092 BV-3, D2): con el theme Gato Negro (el oficial; también sin data-theme, como css/universo.css)
 *   hablo desde mi globo con el gato, abajo a la derecha, en vez del rincón de la Sidebar. Cargo el kit de escena
 *   copiado en la Bóveda con versión fija (js/escena-kit.js y css/escena-kit.css 1.0.0, iguales byte a byte al del
 *   repo shiruvana: lo vigila tests/shv-escena.test.cjs) recién cuando hace falta, así los otros 18 themes no bajan
 *   nada y quedan como en 1.4.0. El globo arranca plegado (mi cara y el gato) y se abre solo con algo nuevo: mismas
 *   reglas de siempre (una vez por novedad, 2 s, nunca con una ventana abierta, 12 s, Escape, «Después», silenciar).
 *   Plegarlo con un mensaje a la vista lo da por leído; abrirlo con algo sin leer te lo muestra; abrirlo sin nada
 *   te dice lo que decía mi rincón. Mi cara sale de js/shiruvana.js (FACES: no pide nada a la red) y el gato de
 *   assets/brand/gato/. No guarda nada nuevo. Si el kit no carga o cambiás de theme, vuelvo al rincón.
 *
 * 1.4.0 (BL-076 SHV-5a): lo que escribo dentro del módulo (avisos, lo que el módulo pide dejar escrito o si me
 *   silenciaste) también dice «Lo sé por», con la misma fuente que uso en el globo. meta.at (opcional): la hora
 *   del dato; sin ella digo «en este navegador», nunca una hora inventada.
 *
 * 1.3.0 (SHV-4b): seenCount() y forgetSeen() para «Lo que recuerdo de vos» (js/shv-recall.js): cuántos
 *   mensajes ya viste y borrarlos. Solo borra gn:shv:seen: «Silenciar» es una preferencia tuya, no un recuerdo.
 *
 * 1.2.1: aparezco en los módulos. Para saber si su pantalla se ve miraba la caja de mi voz, que los módulos
 *   ocultan cuando está vacía (y con el globo queda vacía): todo quedaba esperando. Ahora miro a su padre.
 *
 * 1.2.0 (SHE-3): speak(box, msg, meta): los módulos me pasan su mensaje de siempre y yo decido dónde va.
 *   Los avisos (advierte) y lo que el módulo pide dejar escrito quedan en el módulo; lo demás va a mi globo,
 *   uno por visita a cada pantalla. Si la pantalla se dibujó oculta, espero a que la abras.
 *
 * 1.1.0 (SHE-2): me conecto. El globo sale de mi rincón (js/shiruvana-places.js, pie de la Sidebar); en el celular,
 *   sobre la barra de abajo, y el punto va en «Más». Lo que no leíste: punto en mi rincón y el botón «Te dejé un
 *   mensaje», que lo vuelve a abrir. «Silenciar a Shiruvana» en Ajustes (y «Que Shiruvana vuelva a aparecer»).
 *   Cambiar de pantalla me guarda en el punto: uno por pantalla. seen(obs) le dice a cada módulo qué ya viste.
 *
 * Mis observaciones (formato común de js/shv-core.js) pueden aparecer como un globo que sale de mi
 * avatar del rincón (DEC-034), con las reglas que aprobó Pablo:
 *  - una vez por cosa nueva: lo que ya viste no vuelve (gn:shv:seen guarda solo una huella del texto);
 *  - uno por pantalla, 2 segundos después de llamarme, nunca con un diálogo abierto ni mientras escribís;
 *  - no tapo nada, no oscurezco el fondo y no te saco el foco;
 *  - me voy sola a los 12 segundos (me quedo mientras me mirás o tenés el foco adentro); lo que no
 *    llegaste a leer queda como un punto en mi avatar y reopen() lo vuelve a mostrar;
 *  - Escape o ✕ me cierran; «Después» me guarda en el punto; el botón de la observación avisa al
 *    módulo dueño con el evento gn:shv-act;
 *  - silenciarme (gn:shv:quiet) me deja hablando solo dentro de los módulos;
 *  - el lector de pantalla me anuncia sin interrumpir; con «Movimiento reducido» aparezco sin animación.
 * Se carga por js/modules.json, después de js/shv-core.js y antes de los módulos que me hablan.
 */
(function (root) {
  'use strict';
  var VERSION = '1.6.0';
  var SEEN_KEY = 'gn:shv:seen', QUIET_KEY = 'gn:shv:quiet';
  var DELAY = 2000, TTL = 12000, RETRY = 3000, RETRY_ROUTE = 400, MIN_LEFT = 3000, SEEN_MAX = 200, SEEN_DAYS = 60;
  var ID = 'shvBubble', LIVE_ID = 'shvBubbleLive', STYLE_ID = 'shv-bubble-css';
  var CSS = [
    '#' + ID + '{position:fixed;z-index:900;left:16px;bottom:16px;width:min(380px,calc(100vw - 32px));',
    'background:var(--bg-1,var(--panel));color:var(--text);border:1px solid var(--bd-2,var(--bd-1));border-radius:14px;',
    'box-shadow:var(--gn-elev,0 12px 30px rgba(0,0,0,.45));animation:shv-bub-in .18s ease-out}',
    '#' + ID + ' .shv-voice{margin:0;border-top:0;border-right:0;border-bottom:0;border-radius:14px;padding:12px 40px 12px 14px}',
    '.shv-bub__x{position:absolute;top:6px;right:6px;width:32px;height:32px;border:0;border-radius:8px;',
    'background:transparent;color:var(--tx-2,var(--text));font:inherit;font-size:1rem;cursor:pointer}',
    '.shv-bub__x:hover{color:var(--text)}',
    '#' + ID + ' :is(button,a):focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '.shv-bub__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '[data-shv-unread]{position:relative}',
    '[data-shv-unread]::after{content:"";position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;',
    'background:var(--acc-warn,var(--acc-1));box-shadow:0 0 0 2px var(--bg-1,var(--panel))}',
    '.shv-corner[data-shv-unread]::after{left:50px;right:auto;top:8px}',
    '.shv-bub-open{display:inline-flex;align-items:center;min-height:32px;margin-top:4px;padding:2px 10px;border:1px solid var(--acc-1);',
    'border-radius:999px;background:transparent;color:var(--text);font:inherit;font-size:.78rem;font-weight:600;cursor:pointer}',
    '.shv-bub-open:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '#shvQuietBtn img{border-radius:50%}',
    '@media (max-width:900px){.shv-bub-open{min-height:44px}}',
    '@keyframes shv-bub-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@media (max-width:900px){#' + ID + '{left:12px;right:12px;bottom:72px;width:auto}}',
    '@media (prefers-reduced-motion:reduce){#' + ID + '{animation:none}}'
  ].join('');

  var doc = root.document;
  var st = { queue: [], cur: null, timer: null, deadline: 0, left: TTL, unread: [], anchor: null, inited: false, ls: null, spoke: {}, pending: {} };

  // ------------------------------------------------------------------ puro
  /**
   * Huella del mensaje (FNV-1a): no guarda el texto. Si el módulo dice qué es «la misma cosa» (key), uso eso:
   * «está igual hace 20 días» y «hace 21 días» son la misma novedad.
   */
  function sig(o) {
    var s = String(o.module) + '|' + String(o.id) + '|' + (o.key ? '=' + o.key : o.text.join(' ')), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** Saca lo de más de 60 días y deja como mucho las 200 más nuevas. */
  function prune(map, now) {
    var min = now - SEEN_DAYS * 864e5;
    var keys = Object.keys(map).filter(function (k) { return map[k] >= min; }).sort(function (a, b) { return map[b] - map[a]; }).slice(0, SEEN_MAX);
    var out = {};
    keys.forEach(function (k) { out[k] = map[k]; });
    return out;
  }

  // ------------------------------------------------------------------ almacenamiento
  function ls() { return st.ls || root.localStorage || null; }
  function readSeen() {
    try { var v = JSON.parse(ls().getItem(SEEN_KEY) || 'null'); return v && v.v === 1 && v.s ? v.s : {}; } catch (_) { return {}; }
  }
  function markSeen(o) {
    var map = readSeen();
    map[sig(o)] = Date.now();
    try { ls().setItem(SEEN_KEY, JSON.stringify({ v: 1, s: prune(map, Date.now()) })); } catch (_) {}
  }
  function seen(o) { return Object.prototype.hasOwnProperty.call(readSeen(), sig(o)); }
  /** SHV-4b: cuántos mensajes ya viste. */
  function seenCount() { return Object.keys(readSeen()).length; }
  /** SHV-4b: olvido qué viste (te vuelvo a contar lo que ya te conté). No toca el silencio. */
  function forgetSeen() {
    var n = seenCount();
    try { ls().removeItem(SEEN_KEY); } catch (_) { return { ok: false, seen: n }; }
    return { ok: true, seen: n };
  }
  function quiet(v) {
    if (typeof v === 'boolean') {
      try { if (v) ls().setItem(QUIET_KEY, 'true'); else ls().removeItem(QUIET_KEY); } catch (_) {}
      if (v) { st.queue = []; st.unread = []; close('read'); setUnread(); } // silenciada: tampoco queda el punto
      paintQuiet();
      if (doc && doc.dispatchEvent && typeof root.CustomEvent === 'function') doc.dispatchEvent(new root.CustomEvent('gn:shv-quiet', { detail: { quiet: v } }));
    }
    return isQuiet();
  }
  function isQuiet() { try { return ls().getItem(QUIET_KEY) === 'true'; } catch (_) { return false; } }

  // ------------------------------------------------------------------ DOM
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function ensure() {
    if (!byId(STYLE_ID)) {
      var s = el('style');
      s.id = STYLE_ID;
      s.textContent = CSS + (root.ShvCore && root.ShvCore.CSS ? root.ShvCore.CSS : '');
      (doc.head || doc.documentElement).appendChild(s);
    }
    var live = byId(LIVE_ID);
    if (!live) {
      live = el('div', 'shv-bub__sr');
      live.id = LIVE_ID;
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      doc.body.appendChild(live);
    }
    return live;
  }
  function shown(n) { return n && !n.hidden && !(n.closest && n.closest('[hidden]')); }
  /** No aparezco con un diálogo abierto ni mientras escribís. */
  function busy() {
    var a = doc.activeElement, tag = a && a.tagName ? String(a.tagName).toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return true;
    var list = doc.querySelectorAll ? doc.querySelectorAll('[aria-modal="true"], dialog[open]') : [];
    for (var i = 0; i < list.length; i++) if (shown(list[i])) return true;
    return false;
  }
  function mobile() { return (root.innerWidth || 0) <= 900; }
  /** Mi rincón a la vista: el de la Sidebar en desktop; en el celular, «Más» de la barra de abajo. */
  function corner() { return st.anchor || (doc && doc.querySelector ? doc.querySelector('#appSidebar [data-shv-place="corner"]') : null); }
  function marks() { return st.anchor ? [st.anchor] : [corner(), byId('sbrMore')].filter(Boolean); }
  function focusBack() {
    var a = st.anchor || (mobile() ? byId('sbrMore') : corner());
    if (!a || !a.focus) return;
    if (!st.anchor && a.getAttribute && a.getAttribute('data-shv-place') === 'corner' && a.setAttribute) a.setAttribute('tabindex', '-1');
    a.focus();
  }
  function setUnread() {
    var n = st.unread.length;
    marks().forEach(function (a) {
      if (!a.setAttribute) return;
      if (n) a.setAttribute('data-shv-unread', String(n));
      else if (a.removeAttribute) a.removeAttribute('data-shv-unread');
    });
    // «Te dejé un mensaje» en cada rincón (Sidebar y hoja «Más»): lo vuelve a abrir.
    var corners = doc && doc.querySelectorAll ? doc.querySelectorAll('[data-shv-place="corner"]') : [];
    for (var i = 0; i < corners.length; i++) {
      var c = corners[i], old = c.querySelector('.shv-bub-open');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      if (!n) continue;
      ensure();
      var b = el('button', 'shv-bub-open', n === 1 ? 'Te dejé un mensaje' : 'Te dejé ' + n + ' mensajes');
      b.type = 'button';
      b.addEventListener('click', onOpen);
      (c.querySelector('.shv-voice__main') || c).appendChild(b);
    }
  }
  function onOpen() {
    var S = root.SidebarNav;
    if (S && typeof S.closeSheet === 'function') S.closeSheet();
    reopen();
  }
  function place(box) {
    var a = corner();
    if (!a || !a.getBoundingClientRect || mobile()) return;
    var r = a.getBoundingClientRect();
    box.style.left = Math.round(r.right + 12) + 'px';
    box.style.bottom = Math.max(16, Math.round((root.innerHeight || 0) - r.bottom)) + 'px';
  }

  function arm(ms) {
    if (st.timer) root.clearTimeout(st.timer);
    st.deadline = Date.now() + ms;
    st.timer = root.setTimeout(function () { st.timer = null; close('later'); }, ms);
  }
  function pause() {
    if (!st.timer) return;
    root.clearTimeout(st.timer);
    st.timer = null;
    st.left = Math.max(MIN_LEFT, st.deadline - Date.now());
  }
  function resume() { if (st.cur && !st.timer) arm(st.left); }

  /**
   * Cierra el globo. how: 'read' (✕, Escape o su botón: lo diste por visto) o 'later' («Después» o se fue
   * solo: queda en el punto). En los dos casos ya no vuelve a aparecer solo.
   */
  function close(how) {
    var c = st.cur, box = byId(ID);
    if (st.timer) { root.clearTimeout(st.timer); st.timer = null; }
    st.cur = null;
    if (box && box.parentNode) {
      var hadFocus = box.contains && box.contains(doc.activeElement);
      box.parentNode.removeChild(box);
      if (hadFocus) focusBack();
    }
    escenaRest();
    if (!c) return false;
    markSeen(c);
    if (how === 'later') st.unread.push(c);
    setUnread();
    next(DELAY);
    return true;
  }

  function render(o, focus) {
    var C = root.ShvCore;
    var voice = C && C.render ? C.render(o, { doc: doc, avatar: !esc.on }) : null; // en el globo, mi cara ya está
    if (!voice) return false;
    var live = ensure();
    var box = el('section', 'shv-bub');
    box.id = ID;
    box.setAttribute('aria-label', 'Mensaje de Shiruvana');
    var x = el('button', 'shv-bub__x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar el mensaje de Shiruvana');
    x.setAttribute('data-shv-bub', 'close');
    box.appendChild(x);
    box.appendChild(voice);
    var row = voice.querySelector ? voice.querySelector('.shv-obs__acts') : null;
    var main = voice.querySelector ? voice.querySelector('.shv-voice__main') : null;
    if (!row && main) { row = el('div', 'shv-obs__acts'); main.appendChild(row); }
    if (row) {
      var later = el('button', 'shv-obs__btn', 'Después');
      later.type = 'button';
      later.setAttribute('data-shv-bub', 'later');
      row.appendChild(later);
    }
    box.addEventListener('click', onClick);
    box.addEventListener('mouseenter', pause);
    box.addEventListener('mouseleave', resume);
    box.addEventListener('focusin', pause);
    box.addEventListener('focusout', function (e) { if (!e || !e.relatedTarget || !box.contains(e.relatedTarget)) resume(); });
    if (!escenaPut(box, o)) { place(box); doc.body.appendChild(box); }
    st.cur = o;
    live.textContent = '';
    live.textContent = (root.Shiruvana && root.Shiruvana.KINDS && root.Shiruvana.KINDS[o.kind] ? root.Shiruvana.KINDS[o.kind].label : 'Shiruvana') + ': ' + o.text.join(' ');
    st.left = TTL;
    arm(TTL);
    if (focus && x.focus && !esc.on) x.focus(); // solo si me abriste vos (reopen); en el globo el foco queda en su botón
    return true;
  }

  function next(ms) {
    if (st.cur || st.timer || !st.queue.length) return;
    st.timer = root.setTimeout(function () {
      st.timer = null;
      if (st.cur || !st.queue.length) return;
      if (quiet()) { st.queue = []; return; }
      if (busy()) { next(RETRY); return; }
      render(st.queue.shift(), false);
    }, ms);
  }

  function onClick(e) {
    var t = e && e.target, b = t && t.closest ? t.closest('[data-shv-bub],[data-shv-act]') : null;
    if (!b || !st.cur) return;
    var bub = b.getAttribute('data-shv-bub'), act = b.getAttribute('data-shv-act'), o = st.cur;
    if (bub === 'close') { close('read'); return; }
    if (bub === 'later') { close('later'); return; }
    if (act !== null) {
      close('read');
      if (typeof root.CustomEvent === 'function') doc.dispatchEvent(new root.CustomEvent('gn:shv-act', { detail: { module: o.module, id: o.id, act: act } }));
    }
  }

  function onKey(e) {
    if (!st.cur || !e || e.key !== 'Escape') return;
    var list = doc.querySelectorAll ? doc.querySelectorAll('[aria-modal="true"], dialog[open]') : [];
    for (var i = 0; i < list.length; i++) if (shown(list[i])) return; // Escape es del diálogo
    close('read');
  }

  // ------------------------------------------------------------------ API
  function norm(obs) {
    var C = root.ShvCore, o = C && C.observation ? C.observation(obs) : null;
    if (o && obs.key) o.key = String(obs.key);
    return o;
  }
  /**
   * Me ofrecen una observación (formato de ShvCore; opcional key: qué la hace la misma novedad).
   * true si la voy a mostrar; false si estoy silenciada, ya la viste o no tiene formato.
   */
  function offer(obs) {
    var o = norm(obs);
    if (!o || !doc || quiet() || seen(o)) return false;
    var s = sig(o);
    if ((st.cur && sig(st.cur) === s) || st.queue.some(function (q) { return sig(q) === s; })) return false;
    init();
    st.queue.push(o);
    next(DELAY);
    return true;
  }
  /** Tocaste mi avatar: muestro lo último que no leíste (con el foco en el globo, porque lo pediste vos). */
  function reopen() {
    if (!st.unread.length || !doc) return false;
    init();
    if (st.cur) close('read');
    if (st.timer) { root.clearTimeout(st.timer); st.timer = null; }
    var o = st.unread.pop();
    setUnread();
    return render(o, true);
  }
  function setAnchor(a) { st.anchor = a || null; setUnread(); }
  /** ¿Ya viste esta observación? Así cada módulo me ofrece la primera que no viste. */
  function seenObs(obs) {
    var o = norm(obs);
    return !!o && seen(o);
  }

  // Cambiar de pantalla: lo que esperaba era de la otra; lo que estaba a la vista queda en el punto.
  function onRoute() {
    st.queue = [];
    st.spoke = {};
    if (st.cur) close('later');
    if (Object.keys(st.pending).length) root.setTimeout(retry, RETRY_ROUTE);
  }

  // ------------------------------------------------------------------ SHE-3: los módulos me hablan por acá
  var INLINE = { advierte: true }; // DEC-038 D3: los avisos quedan escritos en el módulo
  // ¿Se ve la pantalla del módulo? Miro al padre de la caja: los módulos ocultan la caja vacía (:empty) y,
  // con mi globo, la caja queda vacía siempre (1.2.1: así no aparecía en ningún módulo fuera de la Cartera).
  function visible(n) {
    if (!n || !doc || (doc.body && doc.body.contains && !doc.body.contains(n))) return false;
    var p = n.parentNode && n.parentNode.nodeType !== 9 ? n.parentNode : n;
    return !!shown(n) && (typeof p.getClientRects !== 'function' || p.getClientRects().length > 0);
  }
  function say(obs) {
    if (st.spoke[obs.module] || !offer(obs)) return false; // offer() ya descarta lo que viste
    st.spoke[obs.module] = true; // uno por visita a cada pantalla
    return true;
  }
  // Lo que un módulo dibujó mientras estaba oculto sale cuando lo abrís.
  function retry() {
    Object.keys(st.pending).forEach(function (m) {
      var p = st.pending[m];
      if (!visible(p.box)) return;
      delete st.pending[m];
      say(p.obs);
    });
  }
  /**
   * Un módulo me pasa su mensaje de siempre ({kind, text, key}) y el lugar donde lo escribía (box, ya vacío).
   * meta: {module, source (de dónde lo sé), key (qué lo hace la misma novedad), keep(msg) (lo dejo escrito)}.
   * Avisos, lo que el módulo pide dejar escrito o si me silenciaste: lo escribo en box como siempre ('inline').
   * Lo demás va a mi globo, una vez por novedad y uno por visita a esa pantalla ('bubble'); si ya lo viste,
   * no lo repito ('none'); si la pantalla todavía no se ve, espero a que la abras ('later').
   */
  // BL-076 SHV-5a: de dónde lo sé, igual en mi globo y escrito en el módulo.
  function src(meta) { return String(meta.source || 'lo que ves en esta pantalla'); }
  function atOf(meta) { return typeof meta.at === 'number' && isFinite(meta.at) && meta.at > 0 ? meta.at : null; }
  function basisOf(meta) {
    var C = root.ShvCore, b = { source: src(meta), at: atOf(meta) };
    return C && typeof C.basisText === 'function' ? C.basisText(b) : b.source + ' · en este navegador';
  }
  function speak(box, msg, meta) {
    meta = meta || {};
    if (!box || !msg || !msg.text) return 'none';
    var S = root.Shiruvana, text = [].concat(msg.text).map(String);
    if (isQuiet() || INLINE[msg.kind] || (typeof meta.keep === 'function' && meta.keep(msg))) {
      if (S && typeof S.voice === 'function') box.appendChild(S.voice({ kind: msg.kind, text: msg.text, basis: basisOf(meta) }));
      return 'inline';
    }
    var mod = String(meta.module || 'boveda');
    var obs = { module: mod, id: String(msg.key || 'voz'), priority: 'media', kind: msg.kind, text: text,
      basis: { source: src(meta), at: atOf(meta) },
      key: String(meta.key != null ? meta.key : (msg.key ? msg.key + '|' : '') + text.join(' ')) };
    delete st.pending[mod];
    if (!visible(box)) { st.pending[mod] = { box: box, obs: obs }; return 'later'; }
    return say(obs) ? 'bubble' : 'none';
  }

  // ------------------------------------------------------------------ Ajustes: silenciarme
  var QUIET_ON = 'Silenciar a Shiruvana', QUIET_OFF = 'Que Shiruvana vuelva a aparecer';
  function paintQuiet() {
    var menu = byId('gnTbSet');
    if (!menu || !doc.createElement) return null;
    var b = byId('shvQuietBtn');
    if (!b) {
      var li = el('li');
      li.setAttribute('role', 'none');
      b = el('button');
      b.id = 'shvQuietBtn';
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      var S = root.Shiruvana;
      if (S && S.AVATAR) {
        var img = el('img');
        img.setAttribute('src', S.AVATAR);
        img.setAttribute('width', '20');
        img.setAttribute('height', '20');
        img.setAttribute('alt', '');
        b.appendChild(img);
      }
      b.appendChild(el('span', 'shv-quiet__t'));
      b.addEventListener('click', function () {
        var q = !isQuiet();
        quiet(q);
        var live = ensure();
        live.textContent = '';
        live.textContent = q ? 'Listo: ya no aparezco sola. Te sigo hablando dentro de cada módulo.' : 'Listo: vuelvo a aparecer cuando tenga algo nuevo para decirte.';
      });
      li.appendChild(b);
      menu.appendChild(li);
    }
    var q = isQuiet();
    b.querySelector('.shv-quiet__t').textContent = q ? QUIET_OFF : QUIET_ON;
    b.setAttribute('title', q ? 'Vuelvo a aparecer en un globo cuando tenga algo nuevo' : 'No aparezco sola: te hablo solo dentro de cada módulo');
    return b;
  }

  function init() {
    if (st.inited || !doc || !doc.addEventListener) return;
    st.inited = true;
    doc.addEventListener('keydown', onKey);
    if (root.addEventListener) root.addEventListener('hashchange', onRoute);
  }
  /** Me conecto a la Bóveda: Ajustes, mi rincón y su punto (se rearman solos). */
  function wire() {
    init();
    if (!doc || !doc.getElementById || !doc.body) return false;
    ensure();
    paintQuiet();
    setUnread();
    escenaWire();
    if (typeof root.MutationObserver === 'function' && !st.mo) {
      // Mi rincón se rearma cuando cambia lo que dice: vuelvo a poner el punto y «Te dejé un mensaje».
      st.mo = new root.MutationObserver(function () { setUnread(); });
      ['appSidebar', 'sbrSheet'].forEach(function (id) { var h = byId(id); if (h) st.mo.observe(h, { childList: true }); });
    }
    return true;
  }

  // ------------------------------------------------------------------ BV-3: mi globo con el gato (theme Gato Negro)
  var KIT_V = '1.0.0', KIT_JS = 'js/escena-kit.js', KIT_CSS = 'css/escena-kit.css', BRAND = 'assets/brand/';
  var ESC_HOLA = 'Hola. Cuando tenga algo nuevo para vos, te aviso acá.';
  var esc = { on: false, g: null, loading: false, failed: false, mo: null, poses: false };
  var POSES = ['saluda', 'pensando']; // BV-4: Inicio saluda; las pantallas vacías, pensando

  /** El theme oficial: data-theme="gato" o todavía sin data-theme (el primer pintado, igual que css/universo.css). */
  function gatoTheme() {
    var r = doc && doc.documentElement, t = r && r.getAttribute ? r.getAttribute('data-theme') : null;
    return t == null || t === 'gato';
  }
  function kitReady() { var K = root.ShiruvanaKit; return !!(K && typeof K.globo === 'function'); }
  function face(kind) {
    var S = root.Shiruvana;
    return (S && S.FACES && S.FACES[kind]) || (S && S.AVATAR) || '';
  }
  /** Bajo el kit una sola vez (estilos y código, con su versión fija). done(true) si quedó listo. */
  function loadKit(done) {
    if (kitReady()) { done(true); return; }
    if (esc.failed || esc.loading || !doc.createElement || !doc.head) return;
    esc.loading = true;
    var left = 2;
    function one(ok) {
      if (!ok) esc.failed = true;
      if (--left) return;
      esc.loading = false;
      done(!esc.failed && kitReady());
    }
    var l = doc.createElement('link');
    l.id = 'shvKitCss';
    l.rel = 'stylesheet';
    l.href = KIT_CSS + '?v=' + KIT_V;
    l.onload = function () { one(true); };
    l.onerror = function () { one(false); };
    var s = doc.createElement('script');
    s.id = 'shvKitJs';
    s.async = false;
    s.src = KIT_JS + '?v=' + KIT_V;
    s.onload = function () { one(true); };
    s.onerror = function () { one(false); };
    doc.head.appendChild(l);
    doc.head.appendChild(s);
  }
  function escenaOn() {
    if (esc.on || !kitReady() || !gatoTheme() || !doc.body) return false;
    var g = root.ShiruvanaKit.globo({ texto: ESC_HOLA, cara: 'hola', base: BRAND, storageKey: null });
    var cara = g.el.querySelector('.svk-cara'), f = face('saluda');
    if (cara && f) cara.src = f; // mi cara oficial de la Bóveda, sin pedirla a la red
    g.plegar(true);
    esc.g = g;
    esc.on = true;
    if (doc.body.classList) doc.body.classList.add('shv-escena');
    var pl = g.el.querySelector('.svk-plegar');
    if (pl) pl.addEventListener('click', onFold); // corre después del del kit: ya cambió de estado
    st.anchor = pl || null; // el punto de «sin leer» y el foco al cerrar van al botón de mi globo
    setUnread();
    var K = root.ShiruvanaKit;
    if (!esc.poses && typeof K.posesSinFondo === 'function') { esc.poses = true; K.posesSinFondo({ el: doc.body, base: BRAND, poses: POSES }); }
    return true;
  }
  function escenaOff() {
    if (!esc.on) return;
    if (st.cur) close('later');
    esc.g.destruir();
    esc.g = null;
    esc.on = false;
    st.anchor = null;
    if (doc.body && doc.body.classList) doc.body.classList.remove('shv-escena');
    setUnread();
  }
  function escenaSync() {
    if (!gatoTheme()) { escenaOff(); return; }
    if (!esc.on) loadKit(function (ok) { if (ok) escenaOn(); });
  }
  function escenaWire() {
    escenaSync();
    var r = doc.documentElement;
    if (typeof root.MutationObserver === 'function' && !esc.mo && r) {
      esc.mo = new root.MutationObserver(escenaSync);
      esc.mo.observe(r, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }
  /** Lo que decía mi rincón de la Sidebar (lo arma js/shiruvana-places.js), para cuando abrís el globo sin novedades. */
  function cornerText() {
    var b = doc.querySelector ? doc.querySelector('#appSidebar [data-shv-place="corner"] .shv-voice__body') : null;
    var ps = b && b.querySelectorAll ? b.querySelectorAll('p') : [], out = [];
    for (var i = 0; i < ps.length; i++) if (ps[i].textContent) out.push(ps[i].textContent);
    return out.join(' ');
  }
  // Tocaste el botón de mi globo (el kit ya lo plegó o lo abrió).
  function onFold() {
    if (!esc.g) return;
    if (esc.g.plegado()) { if (st.cur) close('read'); return; } // plegarme con un mensaje a la vista = leído
    if (st.cur) return;
    if (st.unread.length) { reopen(); return; } // abrirme con algo sin leer = te lo muestro
    var t = esc.g.el.querySelector('.svk-texto');
    if (t) t.textContent = cornerText() || ESC_HOLA;
  }
  /** Pone el mensaje dentro de mi globo. false si no hay globo (otro theme o sin kit): sale como en 1.4.0. */
  function escenaPut(box, o) {
    var g = esc.on && esc.g, dice = g && g.el.querySelector('.svk-dice');
    if (!dice) return false;
    box.className += ' shv-bub--escena';
    dice.appendChild(box);
    if (g.el.classList) g.el.classList.add('shv-hablando');
    var cara = g.el.querySelector('.svk-cara'), f = face(o.kind);
    if (cara && f) { cara.hidden = false; cara.src = f; }
    g.plegar(false);
    g.gato(o.kind === 'explica' ? 'camina' : 'festeja', '');
    return true;
  }
  /** Se fue el mensaje: vuelvo a mi cara de siempre y me pliego. */
  function escenaRest() {
    var g = esc.on && esc.g;
    if (!g) return;
    if (g.el.classList) g.el.classList.remove('shv-hablando');
    var cara = g.el.querySelector('.svk-cara'), f = face('saluda');
    if (cara && f) cara.src = f;
    if (!g.plegado()) g.plegar(true);
  }

  root.ShvBubble = {
    version: VERSION, SEEN_KEY: SEEN_KEY, QUIET_KEY: QUIET_KEY, DELAY: DELAY, TTL: TTL, ID: ID, CSS: CSS,
    offer: offer, reopen: reopen, close: function () { return close('read'); }, quiet: quiet, setAnchor: setAnchor,
    seen: seenObs, wire: wire, speak: speak, seenCount: seenCount, forgetSeen: forgetSeen,
    unread: function () { return st.unread.length; }, current: function () { return st.cur; },
    _pure: { sig: sig, prune: prune }, _setStorage: function (L) { st.ls = L; },
    escena: function () { return esc.on ? esc.g : null; }, KIT: { v: KIT_V, js: KIT_JS, css: KIT_CSS, base: BRAND }
  };
  // La Sidebar y mi rincón se arman en DOMContentLoaded; boot.js me puede cargar antes o después.
  if (doc && doc.addEventListener) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }
  if (root.console && root.console.info) root.console.info('[ShvBubble] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
