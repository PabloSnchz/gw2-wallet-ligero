/*!
 * js/boot.js — Cargador de módulos nuevos de la Bóveda (DEC-035, BL-065 FP-4)
 * Versión: 1.1.0
 *
 * Para qué: sumar un archivo JS nuevo sin tocar index.html. index.html carga este archivo
 * una sola vez; los módulos nuevos se declaran en js/modules.json con su versión:
 *
 *   { "version": 1, "modules": [ { "src": "js/mi-modulo.js", "v": "1.0.0" } ] }
 *
 * Cómo carga:
 *  - Pide js/modules.json con cache «no-cache»: el navegador revalida siempre, así una
 *    versión nueva se ve sin Ctrl+F5 (RSK-020). Cada módulo va con ?v=<versión>.
 *  - Inserta los scripts en el orden del manifiesto (async=false: se ejecutan en orden).
 *  - Un módulo ya presente en la página no se vuelve a cargar.
 *  - Si el manifiesto falta o está mal, la Bóveda sigue igual: solo avisa en la consola.
 *
 * Regla para los módulos nuevos: se ejecutan DESPUÉS de DOMContentLoaded. No esperen ese
 * evento: arranquen con `if (document.readyState === 'loading') … else init()`.
 * Al terminar, este archivo dispara `gn:boot-ready` con { loaded, errors }.
 * Los módulos que ya están en index.html siguen como están (DEC-035).
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var MANIFEST = 'js/modules.json';
  var MAX = 40; // 1.1.0: de 30 a 40 (BL-070 paso 5, TOP-1, D5). Juntar módulos para entrar en 30 iría contra DEC-035.
  var SRC_RE = /^js\/[a-z0-9][a-z0-9-]*\.js$/;
  var VER_RE = /^\d+\.\d+\.\d+$/;
  var state = { status: 'idle', loaded: [], errors: [] };

  // Valida el manifiesto. Las entradas malas se saltean con su motivo; las buenas cargan igual.
  function plan(manifest) {
    var out = { list: [], errors: [] };
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.modules)) {
      out.errors.push('el manifiesto no tiene "modules"');
      return out;
    }
    var seen = {};
    manifest.modules.forEach(function (m, i) {
      var where = 'modules[' + i + ']';
      if (!m || typeof m !== 'object') { out.errors.push(where + ': no es un objeto'); return; }
      var src = String(m.src || '');
      if (!SRC_RE.test(src)) { out.errors.push(where + ': src no permitido (' + src + ')'); return; }
      if (src === 'js/boot.js') { out.errors.push(where + ': el cargador no se carga a sí mismo'); return; }
      if (!VER_RE.test(String(m.v || ''))) { out.errors.push(where + ': versión inválida en ' + src); return; }
      if (seen[src]) { out.errors.push(where + ': ' + src + ' repetido'); return; }
      if (out.list.length >= MAX) { out.errors.push(where + ': más de ' + MAX + ' módulos'); return; }
      seen[src] = true;
      out.list.push({ src: src, v: String(m.v) });
    });
    return out;
  }

  function urlOf(m) { return m.src + '?v=' + encodeURIComponent(m.v); }

  // ¿Ya está en la página (por index.html o por una carga anterior)?
  function present(doc, src) {
    var all = doc.getElementsByTagName ? doc.getElementsByTagName('script') : [];
    for (var i = 0; i < all.length; i++) {
      var s = all[i].getAttribute ? (all[i].getAttribute('data-gn-module') || all[i].getAttribute('src') || '') : '';
      if (s.split('?')[0] === src) return true;
    }
    return false;
  }

  function inject(doc, list) {
    var added = [];
    var parent = doc.head || doc.body || doc.documentElement;
    list.forEach(function (m) {
      if (present(doc, m.src)) return;
      var s = doc.createElement('script');
      s.async = false;
      s.src = urlOf(m);
      s.setAttribute('data-gn-module', m.src);
      s.onerror = function () {
        state.errors.push('no cargó ' + m.src);
        if (root.console) root.console.warn('[GNBoot] no cargó', m.src);
      };
      parent.appendChild(s);
      added.push(m.src);
    });
    return added;
  }

  function done(doc) {
    state.status = 'done';
    if (state.errors.length && root.console) root.console.warn('[GNBoot]', state.errors.join(' | '));
    try {
      var Ev = root.CustomEvent;
      if (typeof Ev === 'function' && doc.dispatchEvent) {
        doc.dispatchEvent(new Ev('gn:boot-ready', { detail: { loaded: state.loaded.slice(), errors: state.errors.slice() } }));
      }
    } catch (_) {}
    return state;
  }

  // Nunca rechaza: si algo sale mal, la Bóveda sigue con lo que ya tiene.
  function load(opts) {
    var doc = (opts && opts.document) || root.document;
    var f = (opts && opts.fetch) || root.fetch;
    state.status = 'loading';
    if (typeof f !== 'function' || !doc) { state.errors.push('sin fetch o sin documento'); return Promise.resolve(done(doc || {})); }
    return Promise.resolve()
      .then(function () { return f(MANIFEST, { cache: 'no-cache' }); })
      .then(function (r) {
        if (!r || !r.ok) throw new Error('el manifiesto respondió ' + (r ? r.status : 'nada'));
        return r.json();
      })
      .then(function (m) {
        var p = plan(m);
        state.errors = state.errors.concat(p.errors);
        state.loaded = state.loaded.concat(inject(doc, p.list));
        return done(doc);
      })
      .catch(function (e) {
        state.errors.push(String(e && e.message || e));
        return done(doc);
      });
  }

  root.GNBoot = { version: VERSION, manifest: MANIFEST, plan: plan, urlOf: urlOf, inject: inject, load: load, state: state };

  if (root.document && typeof root.fetch === 'function' && !root.GN_BOOT_MANUAL) load();
})(typeof window !== 'undefined' ? window : this);
