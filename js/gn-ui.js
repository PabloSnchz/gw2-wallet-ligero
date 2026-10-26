/*!
 * js/gn-ui.js — Ventana común y avisos de la Bóveda (BL-070 paso 5, TOP-1)
 * Versión: 1.1.0
 *
 * Avisos: reemplaza a window.toast con la MISMA forma de llamarlo, así ninguna de las llamadas
 * de hoy cambia: toast(tipo, texto, { ttl }) devuelve { close, el }, y toast.legacy(texto, tipo, ms).
 *  - Tipos: info, success (también «ok»), warn y error. Cada uno con su color y su ícono dibujado,
 *    sin emojis, y con una palabra («Aviso», «Listo», «Ojo», «No se pudo»): el tipo no depende
 *    solo del color.
 *  - Duración: la que pide quien llama (3,5 s si no dice nada). ttl 0 o negativo = queda hasta
 *    cerrarlo, igual que antes. Un error dura al menos 6 s. El reloj se frena con el mouse o el
 *    foco encima (WCAG 2.2.1).
 *  - Los errores van a una región role="alert" (se anuncian enseguida); el resto, a una región
 *    aria-live="polite". Como mucho 3 a la vez: el más viejo se cierra.
 * Ventana: GNUI.dialog / confirm / prompt / alert, una sola conducta para toda la Bóveda.
 *  - El foco entra al abrir; Tab no se escapa; Escape y el fondo cancelan; el foco vuelve al
 *    botón que la abrió. En una pregunta peligrosa el foco arranca en «Cancelar».
 *  - Botones de 44 px, textos solo con los colores de texto del theme, «movimiento reducido».
 * No guarda nada. No toca index.html: toma el #toasts que ya existe (o lo crea).
 * 1.0.1 (TOP-2): el Tab no sale de la ventana: la trampa de foco de la ventana de Keys escucha en document.
 * 1.1.0 (TOP-3): las ventanas de siempre (.modal: Keys, Guías, conversor, selector de themes) toman la
 *   misma piel y la misma conducta: Escape cierra con su propio botón «Cerrar», Tab no se escapa, el foco
 *   entra al abrir y vuelve al que la abrió, cierre de 44 px y hoja desde abajo en el celular.
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var DEFAULT_TTL = 3500, MIN_ERROR_TTL = 6000, MAX_TOASTS = 3, OUT_MS = 180;
  var LABEL = { info: 'Aviso', success: 'Listo', warn: 'Ojo', error: 'No se pudo' };
  var SVG = {
    info: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8v5M9 5v.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    success: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 9.3l2.4 2.4 4.6-4.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M9 2.2l7.2 13H1.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 7.2v3.8M9 13.2v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    error: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.2 6.2l5.6 5.6M11.8 6.2l-5.6 5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  var CSS = [
    '#toasts.gn-ui{position:fixed;right:16px;bottom:16px;left:auto;top:auto;z-index:10003;display:flex;flex-direction:column;gap:8px;width:min(380px,calc(100vw - 32px));pointer-events:none}',
    '#toasts.gn-ui .gn-tq{display:flex;flex-direction:column;gap:8px}',
    '.gn-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;background:var(--bg-1);color:var(--tx-1);border:1px solid var(--bd-1);border-left:4px solid var(--gn-tc);border-radius:10px;padding:10px 6px 10px 12px;box-shadow:0 8px 20px rgba(0,0,0,.35);animation:gnToastIn .16s ease-out}',
    '.gn-toast--info{--gn-tc:var(--color-blue,#6EA3FF)}.gn-toast--success{--gn-tc:var(--color-green,#3CC48A)}.gn-toast--warn{--gn-tc:var(--color-amber,#F2B94B)}.gn-toast--error{--gn-tc:var(--color-red,#F47C7C)}',
    '.gn-toast__ico{flex:0 0 18px;width:18px;height:18px;margin-top:2px;color:var(--gn-tc)}.gn-toast__ico svg{display:block;width:18px;height:18px}',
    '.gn-toast__tx{flex:1;min-width:0;font-size:.88rem;line-height:1.35;color:var(--tx-2);overflow-wrap:anywhere}',
    '.gn-toast__tx b{display:block;font-size:.78rem;font-weight:700;letter-spacing:.02em;color:var(--tx-1)}',
    '.gn-toast__x{flex:0 0 32px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--tx-2);cursor:pointer;font-size:18px;line-height:1}',
    '.gn-toast__x:hover{background:var(--bg-2);color:var(--tx-1)}',
    '.gn-toast--out{opacity:0;transform:translateY(6px);transition:opacity .18s ease,transform .18s ease}',
    '@keyframes gnToastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    'html.gn-dlg-open{overflow:hidden}',
    '.gn-dlg{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px}',
    '.gn-dlg__bg{position:absolute;inset:0;background:rgba(5,7,12,.62)}',
    '.gn-dlg__box{position:relative;width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--bg-1);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.55);animation:gnDlgIn .16s ease-out}',
    '.gn-dlg__box:focus{outline:none}',
    '.gn-dlg__h{display:flex;align-items:center;gap:12px;padding:12px 10px 12px 16px;border-bottom:1px solid var(--bd-1)}',
    '.gn-dlg--info{--gn-dc:var(--acc-1,#A896FF)}.gn-dlg--danger{--gn-dc:var(--color-red,#F47C7C)}',
    '.gn-dlg__plate{flex:0 0 40px;width:40px;height:40px;border-radius:10px;background:var(--bg-0);border:1px solid var(--bd-1);display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px var(--gn-dc)}',
    '.gn-dlg__plate img{width:30px;height:30px;object-fit:contain}',
    '.gn-dlg__t{flex:1;margin:0;font-size:1.02rem;font-weight:700;line-height:1.3;color:var(--tx-1)}',
    '.gn-dlg__x{flex:0 0 44px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--tx-2);cursor:pointer;font-size:20px;line-height:1}',
    '.gn-dlg__x:hover{background:var(--bg-2);color:var(--tx-1)}',
    '.gn-dlg__b{padding:14px 16px 4px;color:var(--tx-2);font-size:.92rem;line-height:1.5}',
    '.gn-dlg__b p{margin:0 0 10px}',
    '.gn-dlg__lbl{display:block;font-size:.84rem;font-weight:600;color:var(--tx-1);margin:2px 0 6px}',
    '.gn-dlg__in{display:block;width:100%;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--bd-1);background:var(--bg-0);color:var(--tx-1);font:inherit}',
    '.gn-dlg__in[aria-invalid="true"]{border-color:var(--color-red,#F47C7C)}',
    '.gn-dlg__err{margin:6px 0 10px;font-size:.84rem;font-weight:600;color:var(--tx-1)}',
    '.gn-dlg__a{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:12px 16px 14px}',
    '.gn-dlg__btn{min-height:44px;min-width:96px;padding:0 16px;border-radius:10px;border:1px solid var(--bd-1);background:var(--bg-2);color:var(--tx-1);font:inherit;font-weight:600;cursor:pointer}',
    '.gn-dlg__btn--primary{border-color:var(--acc-1,#A896FF);box-shadow:inset 0 0 0 1px var(--acc-1,#A896FF)}',
    '.gn-dlg__btn--danger{border-color:var(--color-red,#F47C7C);box-shadow:inset 0 0 0 1px var(--color-red,#F47C7C)}',
    '.gn-dlg__btn:hover{filter:brightness(1.12)}',
    '.gn-toast__x:focus-visible,.gn-dlg :is(button,input):focus-visible{outline:2px solid var(--acc-1,#A896FF);outline-offset:2px}',
    '@keyframes gnDlgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@media (max-width:640px){#toasts.gn-ui{left:12px;right:12px;width:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px))}',
    '.gn-toast__x{flex-basis:44px;width:44px;height:44px}',
    '.gn-dlg{align-items:flex-end;padding:0}.gn-dlg__box{width:100%;max-height:92vh;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.gn-dlg__a{flex-direction:column-reverse}.gn-dlg__btn{width:100%}}',
    '@media (prefers-reduced-motion:reduce){.gn-toast,.gn-dlg__box{animation:none}.gn-toast--out{transition:none}}'
  ].join('\n');

  // ------------------------------------------------------------------ puro
  function kindOf(t) {
    t = String(t == null ? '' : t).toLowerCase();
    if (t === 'ok' || t === 'success') return 'success';
    if (t === 'warn' || t === 'warning') return 'warn';
    if (t === 'error' || t === 'err') return 'error';
    return 'info';
  }
  // Igual que app.js 2.8.0: sin ttl, 3500; 0, negativo o no numérico = persistente.
  // Un error informado con tiempo dura al menos 6 s.
  function ttlOf(kind, opts) {
    var raw = opts && opts.ttl != null ? opts.ttl : DEFAULT_TTL;
    var t = Number(raw);
    if (!(t > 0)) return 0;
    return kind === 'error' ? Math.max(t, MIN_ERROR_TTL) : t;
  }
  function paragraphs(text) {
    if (text == null) return [];
    var list = Array.isArray(text) ? text : String(text).split(/\n{2,}/);
    return list.map(function (x) { return String(x).trim(); }).filter(Boolean);
  }

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var seq = 0;
  function h(tag, attrs, text) {
    var n = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function ensureCss() {
    if (!doc || doc.getElementById('gnUiCss')) return;
    var s = h('style', { id: 'gnUiCss' });
    s.textContent = CSS;
    (doc.head || doc.body).appendChild(s);
  }

  var host = null, polite = null, assertive = null, live = [];
  function ensureHost() {
    if (host && host.parentNode) return host;
    ensureCss();
    host = doc.getElementById('toasts');
    if (!host) { host = h('div', { id: 'toasts' }); doc.body.appendChild(host); }
    host.classList.add('toasts');
    host.classList.add('gn-ui');
    // Las regiones vivas pasan a los dos hijos: el anfitrión ya no lee todo de nuevo (aria-atomic).
    host.removeAttribute('aria-live');
    host.removeAttribute('aria-atomic');
    assertive = h('div', { class: 'gn-tq gn-tq--alert', role: 'alert', 'aria-live': 'assertive' });
    polite = h('div', { class: 'gn-tq gn-tq--polite', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    host.appendChild(assertive);
    host.appendChild(polite);
    return host;
  }

  function toast(type, msg, opts) {
    opts = opts || {};
    if (!doc) return { close: function () {}, el: null };
    ensureHost();
    var kind = kindOf(type), ttl = ttlOf(kind, opts);
    var el = h('div', { class: 'gn-toast gn-toast--' + kind });
    var ico = h('span', { class: 'gn-toast__ico' });
    ico.innerHTML = SVG[kind];
    var tx = h('div', { class: 'gn-toast__tx' });
    tx.appendChild(h('b', null, opts.title || LABEL[kind]));
    tx.appendChild(h('span', null, String(msg == null ? '' : msg)));
    var x = h('button', { type: 'button', class: 'gn-toast__x', 'aria-label': 'Cerrar aviso', title: 'Cerrar' }, '×');
    el.appendChild(ico); el.appendChild(tx); el.appendChild(x);

    var rec = { closed: false, timer: null, left: ttl, started: 0 };
    function stop() { if (rec.timer) { root.clearTimeout(rec.timer); rec.timer = null; rec.left = Math.max(0, rec.left - (Date.now() - rec.started)); } }
    function start() { if (rec.closed || !(rec.left > 0) || rec.timer) return; rec.started = Date.now(); rec.timer = root.setTimeout(close, rec.left); }
    function close() {
      if (rec.closed) return;
      rec.closed = true;
      if (rec.timer) root.clearTimeout(rec.timer);
      rec.timer = null;
      var i = live.indexOf(rec); if (i >= 0) live.splice(i, 1);
      el.classList.add('gn-toast--out');
      root.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, OUT_MS);
    }
    rec.close = close;
    x.addEventListener('click', close);
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    el.addEventListener('focusin', stop);
    el.addEventListener('focusout', start);

    while (live.length >= MAX_TOASTS) live[0].close();
    live.push(rec);
    (kind === 'error' ? assertive : polite).appendChild(el);
    start();
    return { close: close, el: el };
  }
  toast.legacy = function (msg, kind, ms) { return toast(kind === 'ok' ? 'success' : (kind || 'info'), msg, { ttl: ms || 2500 }); };
  toast.gn = VERSION;

  // ------------------------------------------------------------------ ventana
  var open = [];
  function dialog(o) {
    o = o || {};
    return new Promise(function (resolve) {
      if (!doc || !doc.body) { resolve({ action: o.cancel || 'cancel', value: null }); return; }
      ensureCss();
      var id = 'gnDlg' + (++seq), tone = o.tone === 'danger' ? 'danger' : 'info';
      var actions = (o.actions && o.actions.length) ? o.actions : [{ id: 'ok', label: 'Aceptar', kind: 'primary' }];
      var cancelId = o.cancel || 'cancel';
      var prev = doc.activeElement || null;

      var wrap = h('div', { class: 'gn-dlg gn-dlg--' + tone });
      var bg = h('div', { class: 'gn-dlg__bg' });
      var box = h('div', { class: 'gn-dlg__box', role: o.role === 'alertdialog' ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + 't', tabindex: '-1' });
      var head = h('div', { class: 'gn-dlg__h' });
      if (o.icon) { var plate = h('span', { class: 'gn-dlg__plate' }); plate.appendChild(h('img', { src: o.icon, alt: '', width: '30', height: '30' })); head.appendChild(plate); }
      head.appendChild(h('h2', { class: 'gn-dlg__t', id: id + 't' }, o.title || ''));
      var x = h('button', { type: 'button', class: 'gn-dlg__x', 'aria-label': 'Cerrar', title: 'Cerrar' }, '×');
      head.appendChild(x);
      box.appendChild(head);

      var body = h('div', { class: 'gn-dlg__b', id: id + 'd' });
      paragraphs(o.text).forEach(function (p) { body.appendChild(h('p', null, p)); });
      var input = null, err = null;
      if (o.input) {
        var iid = id + 'i';
        body.appendChild(h('label', { class: 'gn-dlg__lbl', for: iid }, o.input.label || 'Valor'));
        input = h('input', { id: iid, class: 'gn-dlg__in', type: o.input.type || 'text', autocomplete: 'off', maxlength: o.input.maxLength ? String(o.input.maxLength) : null, placeholder: o.input.placeholder || null, 'aria-describedby': id + 'e' });
        input.value = o.input.value == null ? '' : String(o.input.value);
        body.appendChild(input);
        err = h('p', { class: 'gn-dlg__err', id: id + 'e', role: 'status' });
        err.hidden = true;
        body.appendChild(err);
      }
      if (body.children && body.children.length) { box.appendChild(body); box.setAttribute('aria-describedby', id + 'd'); }

      var bar = h('div', { class: 'gn-dlg__a' });
      var btns = actions.map(function (a) {
        var b = h('button', { type: 'button', class: 'gn-dlg__btn' + (a.kind ? ' gn-dlg__btn--' + a.kind : ''), 'data-action': a.id }, a.label);
        b.addEventListener('click', function () { finish(a.id); });
        bar.appendChild(b);
        return b;
      });
      box.appendChild(bar);
      wrap.appendChild(bg);
      wrap.appendChild(box);

      var focusables = [x].concat(input ? [input] : [], btns);
      var done = false;
      function finish(action) {
        if (done) return;
        var value = input ? String(input.value == null ? '' : input.value).trim() : null;
        var primary = actions.filter(function (a) { return a.id !== cancelId; })[0];
        if (input && o.input.required && primary && action === primary.id && !value) {
          input.setAttribute('aria-invalid', 'true');
          err.textContent = o.input.requiredText || 'Escribí algo para seguir.';
          err.hidden = false;
          if (input.focus) input.focus();
          return;
        }
        done = true;
        var i = open.indexOf(wrap); if (i >= 0) open.splice(i, 1);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (!open.length && doc.documentElement) doc.documentElement.classList.remove('gn-dlg-open');
        if (prev && prev.focus) { try { prev.focus(); } catch (_) {} }
        resolve({ action: action, value: action === cancelId ? null : value });
      }
      x.addEventListener('click', function () { finish(cancelId); });
      bg.addEventListener('click', function () { finish(cancelId); });
      box.addEventListener('keydown', function (e) {
        if (open[open.length - 1] !== wrap) return;
        if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); finish(cancelId); return; }
        if (e.key === 'Enter' && input && e.target === input) {
          e.preventDefault();
          var p = actions.filter(function (a) { return a.id !== cancelId; })[0];
          finish(p ? p.id : cancelId);
          return;
        }
        if (e.key !== 'Tab') return;
        e.stopPropagation();
        var list = focusables, at = list.indexOf(doc.activeElement);
        if (e.shiftKey && at <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && (at === list.length - 1 || at < 0)) { e.preventDefault(); list[0].focus(); }
      });

      open.push(wrap);
      doc.body.appendChild(wrap);
      if (doc.documentElement) doc.documentElement.classList.add('gn-dlg-open');
      var first = input || btns[actions.map(function (a) { return a.id; }).indexOf(o.focus)] || btns[btns.length - 1] || box;
      if (first && first.focus) first.focus();
    });
  }

  function confirm(o) {
    o = o || {};
    var danger = !!o.danger;
    return dialog({
      title: o.title || '¿Seguimos?', text: o.text, icon: o.icon, tone: danger ? 'danger' : 'info', role: 'alertdialog',
      actions: [{ id: 'cancel', label: o.cancelLabel || 'Cancelar' }, { id: 'ok', label: o.okLabel || 'Aceptar', kind: danger ? 'danger' : 'primary' }],
      focus: danger ? 'cancel' : 'ok'
    }).then(function (r) { return r.action === 'ok'; });
  }
  function prompt(o) {
    o = o || {};
    return dialog({
      title: o.title || '', text: o.text, icon: o.icon,
      input: { label: o.label, value: o.value, maxLength: o.maxLength, placeholder: o.placeholder, required: o.required !== false, requiredText: o.requiredText },
      actions: [{ id: 'cancel', label: o.cancelLabel || 'Cancelar' }, { id: 'ok', label: o.okLabel || 'Guardar', kind: 'primary' }]
    }).then(function (r) { return r.action === 'ok' ? r.value : null; });
  }
  function alert(o) {
    o = o || {};
    return dialog({
      title: o.title || 'Aviso', text: o.text, icon: o.icon, tone: o.danger ? 'danger' : 'info', role: 'alertdialog',
      actions: [{ id: 'ok', label: o.okLabel || 'Entendido', kind: 'primary' }], cancel: 'ok', focus: 'ok'
    }).then(function () {});
  }

  // ------------------------------------------------------------------ ventanas de siempre (.modal)
  // TOP-3: Keys (index.html + app.js), Guías (index.html), conversor (converter-modal.js) y selector de
  // themes (theme-selector.js) ya comparten el marcado .modal > .modal__backdrop + .modal__dialog >
  // .modal__header (h3 + .modal__close) + .modal__body. No se reescriben: se les pone la misma piel y la
  // misma conducta desde acá. Cerrar siempre pasa por su propio botón, así cada una cierra como sabe.
  var MODAL_CSS = [
    'html.gn-mod-open{overflow:hidden}',
    '.modal .modal__backdrop{background:rgba(5,7,12,.62);backdrop-filter:blur(2px)}',
    '.modal .modal__dialog{background:var(--bg-1);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.55)}',
    '.modal .modal__dialog:focus{outline:none}',
    '.modal .modal__header{gap:12px;padding:12px 10px 12px 16px;border-bottom:1px solid var(--bd-1)}',
    '.modal .modal__header h3{display:flex;align-items:center;gap:8px;margin:0;font-size:1.02rem;font-weight:700;line-height:1.3;color:var(--tx-1)}',
    '.modal .modal__close{flex:0 0 44px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--tx-2);font-size:20px;line-height:1;box-shadow:none;transform:none}',
    '.modal .modal__close:hover{background:var(--bg-2);color:var(--tx-1);box-shadow:none;transform:none}',
    '.modal .modal__close:focus-visible,.modal .gn-guide:focus-visible{outline:2px solid var(--acc-1,#A896FF);outline-offset:2px}',
    '.modal .modal__body{padding:14px 16px 16px}',
    '.gn-guide{display:flex;align-items:center;gap:14px;min-height:44px;padding:14px 16px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:12px;text-decoration:none;color:var(--tx-1);transition:border-color .15s ease,box-shadow .15s ease}',
    '.gn-guide:hover{border-color:var(--acc-1,#A896FF);box-shadow:0 0 12px rgba(168,150,255,.2)}',
    '.gn-guide img{flex:0 0 32px}.gn-guide b{display:block;font-size:.95rem;font-weight:600;color:var(--tx-1)}.gn-guide span{display:block;font-size:.78rem;color:var(--tx-2)}',
    '.gn-keys-note{margin:10px 0 0;font-size:.84rem;line-height:1.5;color:var(--tx-2)}',
    '.gn-perms{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:8px 0 0;padding:0}',
    '.gn-perms li{font:600 .76rem/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--tx-1);background:var(--bg-0);border:1px solid var(--bd-1);border-radius:999px;padding:0 10px}',
    '.gn-perms code{background:none;border:0;padding:0;font:inherit;color:var(--tx-1)}',
    '@media (max-width:640px){.modal .modal__dialog{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;max-width:none!important;max-height:92vh;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.modal .modal__body :is(button,.btn,select,input:not([type=checkbox]):not([type=radio])){min-height:44px}}',
    '@media (prefers-reduced-motion:reduce){.modal:not([hidden]){animation:none}.gn-guide{transition:none}}'
  ].join('\n');
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function focusables(m) {
    var list = m && m.querySelectorAll ? m.querySelectorAll(FOCUSABLE) : [];
    return Array.prototype.filter.call(list, function (n) { return !(n.getClientRects && !n.getClientRects().length); });
  }
  function closer(m) { return m.querySelector('.modal__close') || m.querySelector('[data-close="1"]'); }
  function inside(m, n) { return !!(n && m.contains && m.contains(n)); }
  // Escape y Tab se resuelven acá y no siguen: así las ventanas que ya escuchaban en document no lo hacen dos veces.
  function modalKey(e) {
    var m = e.currentTarget || this;
    if (e.key === 'Escape' || e.key === 'Esc') {
      var x = closer(m);
      if (!x) return;
      e.preventDefault(); e.stopPropagation();
      x.click();
      return;
    }
    if (e.key !== 'Tab') return;
    var list = focusables(m);
    if (!list.length) return;
    e.stopPropagation();
    var at = list.indexOf(doc.activeElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && (at === list.length - 1 || at < 0)) { e.preventDefault(); list[0].focus(); }
  }
  function modalShown(m) {
    if (m.__gnOpen) return;
    m.__gnOpen = true;
    var a = doc.activeElement;
    m.__gnOpener = a && a !== doc.body && !inside(m, a) ? a : null;
    if (!m.__gnKeys) { m.__gnKeys = true; m.addEventListener('keydown', modalKey); }
    if (doc.documentElement) doc.documentElement.classList.add('gn-mod-open');
    // Después de que la ventana haga lo suyo: si ya puso el foco adentro, se respeta.
    root.setTimeout(function () {
      if (m.hidden || inside(m, doc.activeElement)) return;
      var dlg = m.querySelector('.modal__dialog');
      if (!dlg) return;
      if (!dlg.hasAttribute('tabindex')) dlg.setAttribute('tabindex', '-1');
      dlg.focus();
    }, 0);
  }
  function modalHidden(m) {
    if (!m.__gnOpen) return;
    m.__gnOpen = false;
    var op = m.__gnOpener, cur = doc.activeElement;
    m.__gnOpener = null;
    if (op && op.focus && (!cur || cur === doc.body || inside(m, cur))) { try { op.focus(); } catch (_) {} }
  }
  function scanModals() {
    if (!doc || !doc.querySelectorAll) return;
    var any = false;
    Array.prototype.forEach.call(doc.querySelectorAll('.modal'), function (m) {
      if (m.hidden) modalHidden(m); else { modalShown(m); any = true; }
    });
    if (!any && doc.documentElement) doc.documentElement.classList.remove('gn-mod-open');
  }
  function watchModals() {
    if (!doc || !doc.body) return;
    if (!doc.getElementById('gnUiModalCss')) {
      var s = h('style', { id: 'gnUiModalCss' });
      s.textContent = MODAL_CSS;
      (doc.head || doc.body).appendChild(s);
    }
    if (root.MutationObserver && !watchModals.on) {
      watchModals.on = true;
      new root.MutationObserver(scanModals).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    }
    scanModals();
  }

  root.GNUI = {
    version: VERSION, toast: toast, dialog: dialog, confirm: confirm, prompt: prompt, alert: alert,
    _pure: { kindOf: kindOf, ttlOf: ttlOf, paragraphs: paragraphs, CSS: CSS, MODAL_CSS: MODAL_CSS, FOCUSABLE: FOCUSABLE, modalKey: modalKey, modalShown: modalShown, modalHidden: modalHidden, scanModals: scanModals, LABEL: LABEL, SVG: SVG, DEFAULT_TTL: DEFAULT_TTL, MIN_ERROR_TTL: MIN_ERROR_TTL, MAX_TOASTS: MAX_TOASTS }
  };
  // Mismo nombre, misma forma: las llamadas de hoy (window.toast?.(…)) usan los avisos nuevos.
  root.toast = toast;
  if (doc) {
    if (doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', function () { ensureCss(); watchModals(); });
    else { ensureCss(); watchModals(); }
  }
})(typeof window !== 'undefined' ? window : this);
