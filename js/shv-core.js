/*!
 * js/shv-core.js — El formato común de lo que observo (BL-059 SHV-1, DEC-033, DEC-024)
 * Versión: 1.0.0
 *
 * Toda observación mía tiene la misma forma, venga del módulo que venga:
 *   { module, id, priority: 'alta'|'media'|'baja', kind, text: [..], action: {label, act|href}|null,
 *     basis: { source, at } }
 * - Sin fundamento no hablo: una observación sin basis.source se descarta.
 * - Más inteligencia no es más mensajes: pick() devuelve una sola, la de mayor prioridad
 *   (a igual prioridad, la primera que llegó).
 * - render() usa mi voz de siempre (js/shiruvana.js 1.1.0) y le suma la línea «Lo sé por: …».
 * No guarda nada ni pide nada a la API. Se carga por js/modules.json (DEC-035).
 */
(function (root) {
  'use strict';
  var VERSION = '1.0.0';
  var KINDS = ['saluda', 'explica', 'recomienda', 'advierte'];
  var PRIORITY = { alta: 3, media: 2, baja: 1 };
  var STYLE_ID = 'shv-core-css';
  var CSS = [
    '.shv-obs__acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
    '.shv-obs__btn{font:inherit;font-size:.82rem;font-weight:700;line-height:1.3;border:1px solid var(--bd-2,var(--bd-1));',
    'border-radius:8px;padding:5px 11px;background:var(--bg-0,transparent);color:var(--text);cursor:pointer;text-decoration:none}',
    '.shv-obs__btn:hover{border-color:var(--acc-1)}',
    '.shv-obs__btn:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}'
  ].join('');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  /** Cuándo se tomó el dato, en palabras: «hoy 14:10», «ayer 09:05», «24/10 18:30» o «en este navegador». */
  function when(at, now) {
    if (typeof at !== 'number' || !isFinite(at) || at <= 0) return 'en este navegador';
    var d = new Date(at), n = new Date(typeof now === 'number' ? now : Date.now());
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var diff = Math.round((dayStart(n) - dayStart(d)) / 864e5);
    if (diff === 0) return 'hoy ' + hm;
    if (diff === 1) return 'ayer ' + hm;
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + hm;
  }

  /** «fuente · cuándo»; mi voz le antepone «Lo sé por:». */
  function basisText(basis, now) {
    if (!basis || !basis.source) return '';
    return String(basis.source) + ' · ' + when(basis.at, now);
  }

  /** Normaliza una observación. Devuelve null si no tiene módulo, texto o fundamento. */
  function observation(o) {
    if (!o || typeof o !== 'object') return null;
    var text = [].concat(o.text == null ? [] : o.text).map(function (t) { return String(t); }).filter(Boolean);
    if (!o.module || !text.length || !o.basis || !o.basis.source) return null;
    var a = o.action && o.action.label ? o.action : null;
    return {
      module: String(o.module),
      id: String(o.id || o.module),
      priority: PRIORITY[o.priority] ? o.priority : 'baja',
      kind: KINDS.indexOf(o.kind) >= 0 ? o.kind : 'explica',
      text: text,
      action: a ? { label: String(a.label), act: a.act ? String(a.act) : null, href: a.href ? String(a.href) : null } : null,
      basis: { source: String(o.basis.source), at: typeof o.basis.at === 'number' && isFinite(o.basis.at) ? o.basis.at : null }
    };
  }

  /** La más importante de una lista (una sola por lugar). */
  function pick(list) {
    var best = null;
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      var o = observation(raw);
      if (o && (!best || PRIORITY[o.priority] > PRIORITY[best.priority])) best = o;
    });
    return best;
  }

  function ensureStyle(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /**
   * Dibuja una observación con mi voz. El botón lleva data-shv-act (lo atiende el módulo dueño)
   * o es un enlace si la acción tiene href.
   */
  function render(obs, opts) {
    opts = opts || {};
    var S = root.Shiruvana, o = observation(obs);
    if (!o || !S || typeof S.voice !== 'function') return null;
    var doc = opts.doc || root.document;
    var el = S.voice({ kind: o.kind, text: o.text, basis: basisText(o.basis, opts.now), avatar: opts.avatar !== false, doc: doc });
    el.setAttribute('data-shv-obs', o.module + ':' + o.id);
    if (o.action) {
      ensureStyle(doc);
      var main = el.querySelector ? el.querySelector('.shv-voice__main') : null;
      if (main) {
        var row = doc.createElement('div');
        row.className = 'shv-obs__acts';
        var b = doc.createElement(o.action.href ? 'a' : 'button');
        b.className = 'shv-obs__btn';
        b.textContent = o.action.label;
        if (o.action.href) b.setAttribute('href', o.action.href);
        else { b.setAttribute('type', 'button'); b.setAttribute('data-shv-act', o.action.act || ''); }
        row.appendChild(b);
        main.appendChild(row);
      }
    }
    return el;
  }

  root.ShvCore = { version: VERSION, observation: observation, pick: pick, render: render, basisText: basisText, when: when, PRIORITY: PRIORITY, CSS: CSS };
  if (root.console && root.console.info) root.console.info('[ShvCore] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
