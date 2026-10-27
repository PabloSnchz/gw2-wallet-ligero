/*!
 * js/shv-recall.js — «Lo que recuerdo de vos» (BL-059 SHV-4b, nivel N5 de DEC-033)
 * Versión: 1.1.0 (2026-10-27)
 *
 * 1.1.0 (SHV-4c, D6 de la propuesta SHV-4): si este navegador pasa el 85 % de su espacio, lo aviso en Inicio con
 *   mi voz escrita (ShvCore.render, no en globo), debajo de «Shiruvana te guía», con «Ver lo que ocupa», que abre
 *   esta ventana. Lo mido al entrar a Inicio, cuando la Bienvenida se redibuja y al cerrar la ventana; debajo del
 *   85 % no digo nada. Solo toco el DOM si cambió lo que digo.
 *
 * Ajustes → «Lo que recuerdo de vos» abre la ventana común de la Bóveda (GNUI.dialog) y muestra:
 *  - qué guardo de tu Cartera (cuentas, desde y hasta, cuánto ocupa de mis 64 KB);
 *  - cuántos mensajes ya viste (solo huellas de 8 caracteres, nunca el texto);
 *  - si aparezco en globo y si sigo recordando cosas nuevas;
 *  - el medidor del almacenamiento de este navegador (D7 de SHV-0): cuánto ocupa todo y cuánto lo mío.
 *    Solo cuenta caracteres: no muestra valores de nadie y nunca una Key. Si el navegador lo permite,
 *    suma lo de IndexedDB (navigator.storage.estimate).
 * Botones: «Descargar mi memoria» (JSON, cada cuenta por su huella), «Dejar de recordar» / «Volver a
 * recordar» (la pausa de ShvMemory) y «Borrar todo» (pregunta antes, con el foco en «Cancelar», y ofrece
 * descargar primero). Borrar todo = fotos de la Cartera y mensajes vistos; no toca «Silenciar» ni la pausa
 * (decisiones D1 a D4 de la propuesta SHV-4).
 * Solo usa la API pública de ShvMemory y ShvBubble: no escribe ninguna clave por su cuenta.
 * Sin llamadas a la API de GW2. Se carga por js/modules.json, después de js/shv-memory.js.
 */
(function (root) {
  'use strict';
  var VERSION = '1.1.0';
  var WARN = 85, HOME_ID = 'shvRecallHome'; // SHV-4c: desde cuánto aviso en Inicio
  var QUOTA = 5 * 1024 * 1024; // lo que suelen dar los navegadores a localStorage, en caracteres
  var MINE = /^gn:shv:/;
  var BTN_ID = 'shvRecallBtn', BAR_CLASS = 'shv-rc-bar', STYLE_ID = 'shv-recall-css';
  var CSS = [
    '.' + BAR_CLASS + '{height:10px;border-radius:6px;background:var(--bg-2);overflow:hidden;margin:-4px 0 10px}',
    '.' + BAR_CLASS + ' i{display:block;height:100%;background:var(--acc-1)}',
    '.' + BAR_CLASS + '[data-level="alto"] i{background:var(--color-red,var(--acc-1))}',
    '#' + BTN_ID + ' img{border-radius:50%}'
  ].join('');
  var doc = root.document;
  var st = { ls: null, busy: false, sig: null, timer: null };

  // ------------------------------------------------------------------ puro
  function nf(n, dec) {
    var s = (Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec)).toFixed(dec);
    return s.replace('.', ',');
  }
  /** Caracteres a texto corto: «820», «18 KB», «3,1 M». */
  function size(chars) {
    if (chars < 1024) return String(chars) + ' caracteres';
    if (chars < 1024 * 1024) return nf(chars / 1024, chars < 10240 ? 1 : 0) + ' KB';
    return nf(chars / (1024 * 1024), 1) + ' M';
  }
  function pct(part, whole) { return whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0; }
  /**
   * Lo que ocupa el almacenamiento del navegador, en caracteres (clave + valor, como lo cuentan los
   * navegadores). Solo mide: no devuelve ningún valor.
   */
  function usage(L) {
    var out = { total: 0, mine: 0, keys: 0, quota: QUOTA, pct: 0, minePct: 0 };
    if (!L || typeof L.length !== 'number' || typeof L.key !== 'function') return out;
    for (var i = 0; i < L.length; i++) {
      var k = L.key(i);
      if (k == null) continue;
      var v = '';
      try { v = L.getItem(k) || ''; } catch (_) {}
      var n = String(k).length + String(v).length;
      out.total += n;
      out.keys++;
      if (MINE.test(k)) out.mine += n;
    }
    out.pct = pct(out.total, QUOTA);
    out.minePct = pct(out.mine, QUOTA);
    return out;
  }
  function dm(ts) { var d = new Date(ts); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  /**
   * Los párrafos de la ventana. s: ShvMemory.stats(); seen: cuántos mensajes vistos; quiet/paused: estado;
   * u: usage(); idb: bytes de IndexedDB o null.
   */
  function lines(s, seen, quiet, u, idb) {
    var out = [];
    if (!s) out.push('Tu Cartera: mi memoria no cargó en esta página, así que no puedo mostrarte nada.');
    else if (!s.snapshots) out.push('Tu Cartera: todavía no guardé ninguna foto.');
    else {
      out.push('Tu Cartera: una foto por día de ' + plural(s.accounts, 'cuenta', 'cuentas') + ', del ' + dm(s.first) + ' al ' + dm(s.last) +
        ' (' + plural(s.days, 'día', 'días') + '). Ocupa ' + size(s.chars) + ' de mis ' + size(s.cap) + '.');
    }
    out.push(seen === null ? 'Mensajes que ya viste: no los puedo contar ahora.'
      : 'Mensajes que ya viste: ' + seen + ', guardados como huellas de 8 caracteres (nunca el texto).');
    var paused = !!(s && s.paused);
    out.push('Aparezco en globo: ' + (quiet ? 'no, me silenciaste (te hablo dentro de cada módulo).' : 'sí.') +
      ' Recuerdo cosas nuevas: ' + (paused ? 'no, me pediste que deje de recordar; lo que ya sé lo sigo usando hasta que lo borres.' : 'sí.'));
    out.push('Este navegador (lo comparten producción y DEV): ' + size(u.total) + ' de ~' + size(u.quota) + ' (' + nf(u.pct, 0) + ' %). Lo mío: ' +
      size(u.mine) + ' (' + nf(u.minePct, 1) + ' %).' +
      (typeof idb === 'number' && idb > 0 ? ' Aparte, las cachés grandes de la API (IndexedDB) ocupan ' + nf(idb / (1024 * 1024), 1) + ' MB.' : ''));
    return out;
  }
  /** Detalle de la pregunta antes de borrar. */
  function forgetText(s, seen) {
    var what = s && s.snapshots ? plural(s.snapshots, 'foto', 'fotos') + ' de la Cartera (' + plural(s.accounts, 'cuenta', 'cuentas') + ', del ' + dm(s.first) + ' al ' + dm(s.last) + ')'
      : 'ninguna foto de la Cartera';
    return [
      'Borro ' + what + ' y ' + plural(seen || 0, 'mensaje que ya viste', 'mensajes que ya viste') + ': te voy a volver a contar lo que ya te conté.',
      'No toco «Silenciar» ni «Dejar de recordar»: son preferencias tuyas, no recuerdos.',
      'Se borra para este navegador entero (lo comparten producción y DEV) y no se puede deshacer.'
    ];
  }
  function fileName(now) {
    var d = new Date(now);
    return 'shiruvana-memoria-' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.json';
  }

  /** SHV-4c: el aviso de Inicio (puro). null debajo del 85 %. */
  function homeObs(u, now) {
    if (!u || !(u.pct >= WARN)) return null;
    return {
      module: 'inicio', id: 'storage', priority: 'alta', kind: 'advierte',
      text: ['Este navegador ya usa el ' + nf(u.pct, 0) + ' % del espacio que le da a la Bóveda (' + size(u.total) + ' de ~' + size(u.quota) +
        '). Si se llena, no puedo guardar nada nuevo: ni Keys, ni marcas, ni ajustes.',
        'Lo mío ocupa ' + size(u.mine) + '. Antes de borrar algo, guardá una copia desde Ajustes. En «Lo que recuerdo de vos» ves cuánto ocupa todo.'],
      action: { label: 'Ver lo que ocupa', act: 'recall' },
      basis: { source: 'lo que ocupa este navegador, medido ahora', at: now }
    };
  }

  // ------------------------------------------------------------------ Bóveda
  function ls() { return st.ls || root.localStorage || null; }
  function M() { return root.ShvMemory || null; }
  function B() { return root.ShvBubble || null; }
  function ui() { return root.GNUI || null; }
  function toast(kind, text) { var T = ui(); if (T && typeof T.toast === 'function') T.toast(kind, text); }
  function seenCount() { var b = B(); return b && typeof b.seenCount === 'function' ? b.seenCount() : null; }
  function stats() { var m = M(); return m && typeof m.stats === 'function' ? m.stats() : null; }
  function idbBytes() {
    var n = root.navigator, S = n && n.storage;
    if (!S || typeof S.estimate !== 'function') return Promise.resolve(null);
    var timeout = new Promise(function (r) { root.setTimeout(function () { r(null); }, 800); });
    return Promise.race([Promise.resolve().then(function () { return S.estimate(); }).then(function (e) {
      var d = e && e.usageDetails;
      return d && typeof d.indexedDB === 'number' ? d.indexedDB : null;
    }, function () { return null; }), timeout]);
  }

  /** Descarga mi memoria (exportData de ShvMemory). true si había algo para bajar. */
  function download() {
    var m = M();
    if (!m || typeof m.exportData !== 'function') { toast('error', 'Mi memoria no cargó: no hay nada para descargar.'); return false; }
    var data = m.exportData(), n = 0;
    Object.keys(data.accounts || {}).forEach(function (k) { n += data.accounts[k].length; });
    if (!n) { toast('info', 'Todavía no guardé ninguna foto de tu Cartera: no hay nada para descargar.'); return false; }
    var U = root.URL, BlobC = root.Blob;
    if (!doc || !U || typeof U.createObjectURL !== 'function' || typeof BlobC !== 'function') { toast('error', 'Este navegador no me deja descargar archivos.'); return false; }
    var url = U.createObjectURL(new BlobC([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    var a = doc.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', fileName(Date.now()));
    a.hidden = true;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    root.setTimeout(function () { U.revokeObjectURL(url); }, 1000);
    toast('success', 'Listo: te bajé ' + plural(n, 'foto', 'fotos') + ' de tu Cartera (sin ninguna Key).');
    return true;
  }

  function togglePause() {
    var m = M();
    if (!m || typeof m.paused !== 'function') return null;
    var now = m.paused(!m.paused());
    toast('success', now ? 'Listo: dejo de recordar. Lo que ya sé lo sigo usando hasta que lo borres.' : 'Listo: vuelvo a recordar tu Cartera, una foto por día.');
    return now;
  }

  /** Borra fotos y vistos, después de preguntar. Devuelve una promesa con true si borró. */
  function forgetAll() {
    var T = ui(), m = M(), s = stats(), seen = seenCount();
    if (!T || !m) return Promise.resolve(false);
    return T.dialog({
      title: '¿Borro lo que recuerdo de vos?', text: forgetText(s, seen), tone: 'danger', role: 'alertdialog',
      icon: root.Shiruvana && root.Shiruvana.AVATAR,
      actions: [{ id: 'cancel', label: 'Cancelar' }, { id: 'dl', label: 'Descargar y borrar' }, { id: 'ok', label: 'Borrar todo', kind: 'danger' }],
      focus: 'cancel'
    }).then(function (r) {
      if (!r || (r.action !== 'ok' && r.action !== 'dl')) return false;
      if (r.action === 'dl') download();
      var a = m.forget(), b = B(), v = b && typeof b.forgetSeen === 'function' ? b.forgetSeen() : { ok: true, seen: 0 };
      if (!a || !a.ok || !v || !v.ok) { toast('error', 'No pude borrar todo. Probá de nuevo.'); return false; }
      toast('success', 'Listo: borré ' + plural(a.snapshots, 'foto', 'fotos') + ' y ' + plural(v.seen, 'mensaje visto', 'mensajes vistos') + '.');
      return true;
    });
  }

  function paintBar(u) {
    if (!doc || !doc.querySelectorAll) return;
    var all = doc.querySelectorAll('.gn-dlg'), w = all[all.length - 1], body = w && w.querySelector('.gn-dlg__b');
    if (!body) return;
    var bar = doc.createElement('div');
    bar.className = BAR_CLASS;
    bar.setAttribute('aria-hidden', 'true'); // el párrafo de arriba dice lo mismo en palabras
    if (u.pct >= WARN) bar.setAttribute('data-level', 'alto');
    var fill = doc.createElement('i');
    fill.style.width = Math.max(1, Math.round(u.pct)) + '%';
    bar.appendChild(fill);
    body.appendChild(bar);
  }

  /** Abre la ventana. Después de cada botón (salvo Cerrar) la vuelve a abrir con lo nuevo. */
  function open(focus) {
    var T = ui();
    if (!T || typeof T.dialog !== 'function' || st.busy) return Promise.resolve(null);
    st.busy = true;
    return idbBytes().then(function (idb) {
      var s = stats(), b = B(), u = usage(ls());
      var quiet = !!(b && typeof b.quiet === 'function' && b.quiet());
      var paused = !!(s && s.paused);
      var p = T.dialog({
        title: 'Lo que recuerdo de vos', text: lines(s, seenCount(), quiet, u, idb),
        icon: root.Shiruvana && root.Shiruvana.AVATAR,
        actions: [
          { id: 'dl', label: 'Descargar mi memoria' },
          { id: 'pause', label: paused ? 'Volver a recordar' : 'Dejar de recordar' },
          { id: 'forget', label: 'Borrar todo', kind: 'danger' },
          { id: 'cancel', label: 'Cerrar', kind: 'primary' }
        ],
        focus: focus || 'cancel'
      });
      ensureCss();
      paintBar(u);
      return p;
    }).then(function (r) {
      st.busy = false;
      schedule(); // pudiste haber liberado espacio
      var a = r && r.action;
      if (a === 'dl') { download(); return open('dl'); }
      if (a === 'pause') { togglePause(); return open('pause'); }
      if (a === 'forget') return forgetAll().then(function () { return open('cancel'); });
      return a || 'cancel';
    }, function () { st.busy = false; return null; });
  }

  // ------------------------------------------------------------------ Ajustes
  function ensureCss() {
    if (!doc || !doc.getElementById || doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (doc.head || doc.body).appendChild(s);
  }
  /** El ítem en el menú Ajustes, al lado de «Silenciar a Shiruvana». */
  function wire() {
    if (!doc || !doc.getElementById) return false;
    var menu = doc.getElementById('gnTbSet');
    if (!menu) return false;
    if (doc.getElementById(BTN_ID)) return true;
    ensureCss();
    var li = doc.createElement('li');
    li.setAttribute('role', 'none');
    var b = doc.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.setAttribute('title', 'Qué guardo de vos, cuánto ocupa, y descargarlo o borrarlo');
    var S = root.Shiruvana;
    if (S && S.AVATAR) {
      var img = doc.createElement('img');
      img.setAttribute('src', S.AVATAR);
      img.setAttribute('width', '20');
      img.setAttribute('height', '20');
      img.setAttribute('alt', '');
      b.appendChild(img);
    }
    var t = doc.createElement('span');
    t.textContent = 'Lo que recuerdo de vos';
    b.appendChild(t);
    b.addEventListener('click', function () { open(); });
    li.appendChild(b);
    var q = doc.getElementById('shvQuietBtn'), qli = q && q.parentNode;
    if (qli && qli.parentNode === menu && qli.nextSibling) menu.insertBefore(li, qli.nextSibling);
    else menu.appendChild(li);
    return true;
  }

  // ------------------------------------------------------------------ Inicio (SHV-4c)
  function homeBody() {
    var p = doc && doc.getElementById ? doc.getElementById('welcomePanel') : null;
    return p && p.querySelector ? p.querySelector('.panel__body') : null;
  }
  /** Pongo, actualizo o saco el aviso de Inicio. Solo toco el DOM si cambió lo que digo. */
  function paintHome() {
    st.timer = null;
    var body = homeBody(), C = root.ShvCore, cur = doc && doc.getElementById ? doc.getElementById(HOME_ID) : null;
    var o = body && C && typeof C.render === 'function' ? homeObs(usage(ls()), Date.now()) : null;
    var sig = o ? o.text.join(' ') : '';
    if (o && cur && cur.parentNode === body && sig === st.sig) return cur;
    if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    st.sig = null;
    if (!o) return null;
    var el = C.render(o, { doc: doc });
    if (!el) return null;
    el.id = HOME_ID;
    var btn = el.querySelector ? el.querySelector('.shv-obs__btn') : null;
    if (btn) btn.addEventListener('click', function () { open(); });
    var kids = body.children || [], guide = null;
    for (var i = 0; i < kids.length; i++) if (kids[i].getAttribute && kids[i].getAttribute('data-shv-place') === 'welcome') { guide = kids[i]; break; }
    body.insertBefore(el, guide ? guide.nextSibling : body.firstChild); // debajo de «Shiruvana te guía»
    st.sig = sig;
    return el;
  }
  function schedule() { if (!st.timer && root.setTimeout) st.timer = root.setTimeout(paintHome, 250); }
  function onlyMine(recs) {
    return (recs || []).every(function (r) {
      var n = [].slice.call(r.addedNodes || []).concat([].slice.call(r.removedNodes || []));
      return n.length > 0 && n.every(function (x) { return x && x.id === HOME_ID; });
    });
  }
  function initHome() {
    var p = doc && doc.getElementById ? doc.getElementById('welcomePanel') : null;
    // La Bienvenida se redibuja entera: vuelvo a mirar. Lo que agrego o saco yo no cuenta (sin bucles).
    if (p && typeof root.MutationObserver === 'function') new root.MutationObserver(function (recs) { if (!onlyMine(recs)) schedule(); }).observe(p, { childList: true, subtree: true });
    if (root.addEventListener) { root.addEventListener('hashchange', schedule); root.addEventListener('storage', schedule); }
    schedule();
  }

  root.ShvRecall = {
    version: VERSION, QUOTA: QUOTA, BTN_ID: BTN_ID, CSS: CSS,
    open: open, download: download, forgetAll: forgetAll, togglePause: togglePause, wire: wire,
    paintHome: paintHome, HOME_ID: HOME_ID, WARN: WARN,
    usage: function () { return usage(ls()); },
    _pure: { size: size, pct: pct, usage: usage, lines: lines, forgetText: forgetText, fileName: fileName, dm: dm, homeObs: homeObs },
    _setStorage: function (L) { st.ls = L; }
  };
  if (doc && doc.addEventListener) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { wire(); initHome(); });
    else { wire(); initHome(); }
  }
  if (root.console && root.console.info) root.console.info('[ShvRecall] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
