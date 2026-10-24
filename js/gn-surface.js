/*!
 * js/gn-surface.js — Superficies de la Bóveda: bandeja, tarjeta, borde, pista y placa (CAM-POLISH-001)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-24)
 *
 * Por qué existe: las maquetas aprobadas apoyaban las tarjetas sobre el fondo más oscuro y
 * usaban tres superficies (lienzo, tarjeta y pista). En la Bóveda las tarjetas viven dentro de
 * un .panel del mismo color que ellas (1.00:1) y en 17 de los 19 themes --bg-2 vale lo mismo
 * que --bg-1, así que las barras perdieron la pista. Medido en RUN-015.
 *
 * Qué hace: para cada panel registrado calcula, desde el theme activo, cinco superficies y las
 * declara SOLO dentro de ese panel:
 *  - el panel pasa a ser la bandeja (el fondo, o un gris apenas más oscuro en themes claros);
 *  - --bg-1 (tarjetas) se eleva sobre la bandeja; --bg-2 (pistas, placas, hover, botón
 *    apretado) y --bd-1 / --bd-2 (bordes) se separan de la tarjeta.
 * Como los módulos ya pintan con esas variables, no hay que tocarlos: si este archivo no carga,
 * todo queda como antes. Los textos siguen con su color; el test mide AA sobre cada superficie.
 * Además suma profundidad (sombra suave), íconos oficiales más grandes y lo deseado en dorado
 * en la Cámara del Brujo y en Logros (pedido de Pablo, CAM-POLISH-001).
 * Paneles: GNSurface.register(id) agrega uno; los pasos 4 a 8 del restyle lo usan.
 * Se carga por js/modules.json (DEC-035). Sin pedidos ni almacenamiento.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var LOG = '[GNSurface]';
  var SCOPES = ['wvPanel', 'achievementsPanel'];
  var KEYS = ['--gn-tray', '--bg-1', '--bg-2', '--bd-1', '--bd-2', '--gn-plate', '--gn-link', '--gn-elev'];
  var T = { card: 1.2, cardLight: 1.15, track: 1.4, border: 1.55, strong: 1.9, plate: 1.15 };

  // ------------------------------------------------------------------ color (puro)
  function parse(v) {
    v = String(v == null ? '' : v).trim().toLowerCase();
    var m = v.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (c) { return c + c; }).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(function (x) { return /%$/.test(x) ? parseFloat(x) / 100 : Number(x); });
      if (p.length < 3 || p.slice(0, 3).some(isNaN)) return null;
      return [p[0], p[1], p[2], p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
    }
    return null;
  }
  function over(c, b) { return [0, 1, 2].map(function (i) { return c[i] * c[3] + b[i] * (1 - c[3]); }).concat(1); }
  function mix(a, b, p) { return [0, 1, 2].map(function (i) { return a[i] * p + b[i] * (1 - p); }).concat(1); }
  function lum(c) {
    var f = function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function hex(c) { return '#' + c.slice(0, 3).map(function (v) { var h = Math.round(Math.max(0, Math.min(255, v))).toString(16); return h.length < 2 ? '0' + h : h; }).join(''); }

  // Acerca `base` al color `to` de a poco hasta llegar a `min` de contraste contra `ref`.
  // `keep` (opcional): textos que tienen que seguir en AA sobre el resultado; si el próximo paso
  // los rompe, me quedo con el anterior. El texto manda sobre la superficie.
  function lift(base, to, ref, min, from, keep) {
    var last = mix(to, base, from || 0);
    for (var p = from || 0; p <= 0.6; p += 0.005) {
      var c = mix(to, base, p);
      if (keep && keep.some(function (t) { return contrast(t, c) < AA; })) return last;
      last = c;
      if (contrast(c, ref) >= min) return c;
    }
    return last;
  }
  var AA = 4.5;

  // Un color de texto que tiene que leerse sobre varias superficies: lo acerco al texto principal.
  function readable(col, to, bgs) {
    for (var p = 0; p <= 1.0001; p += 0.05) {
      var c = mix(to, col, p);
      if (bgs.every(function (b) { return contrast(c, b) >= AA; })) return c;
    }
    return to;
  }

  // tokens del theme → superficies. Devuelve null si el theme no trae lo mínimo.
  function surfaces(tokens) {
    tokens = tokens || {};
    var b0 = parse(tokens['--bg-0']), b1 = parse(tokens['--bg-1']), t1 = parse(tokens['--tx-1']);
    if (!b0 || !t1) return null;
    var bg0 = over(b0, [255, 255, 255, 1]);
    var bg1 = b1 ? over(b1, bg0) : bg0;
    var tx = over(t1, bg1);
    var light = lum(bg0) > 0.4, tray, card;
    if (!light) {
      tray = bg0;
      card = lift(bg1, tx, tray, T.card, 0.03);
    } else {
      // En claro la tarjeta es la superficie más clara y la bandeja se oscurece apenas.
      card = lum(bg1) >= lum(bg0) ? bg1 : bg0;
      tray = lift(lum(bg1) >= lum(bg0) ? bg0 : bg1, tx, card, T.cardLight, 0);
    }
    var t2 = parse(tokens['--tx-2']), texts = [tx].concat(t2 ? [over(t2, card)] : []);
    // La pista también es el fondo de la fila con hover y del botón apretado: ahí hay texto.
    var track = lift(card, tx, card, T.track, 0, texts);
    var border = lift(card, tx, card, T.border, 0);
    var strong = lift(card, tx, card, T.strong, 0);
    var plate = lift(card, tx, card, T.plate, 0, texts);
    var a1 = parse(tokens['--acc-1']);
    var link = readable(a1 ? over(a1, card) : tx, tx, [card, tray, plate]);
    return {
      light: light,
      '--gn-tray': hex(tray), '--bg-1': hex(card), '--bg-2': hex(track), '--bd-1': hex(border), '--bd-2': hex(strong), '--gn-plate': hex(plate), '--gn-link': hex(link),
      '--gn-elev': light ? '0 1px 2px rgba(0,0,0,.06),0 6px 16px rgba(0,0,0,.08)' : 'inset 0 1px 0 rgba(255,255,255,.05),0 6px 18px rgba(0,0,0,.28)'
    };
  }

  // Para las guardas de contraste de cada módulo (ach-view, wv-view…): los mismos tokens del
  // theme, pero con la bandeja y la tarjeta reales como --bg-0 y --bg-1. Así sus correcciones
  // de texto se calculan sobre las superficies que de verdad se ven. Puro.
  function surfaceTokens(tokens) {
    var sf = surfaces(tokens), o = {};
    Object.keys(tokens || {}).forEach(function (k) { o[k] = tokens[k]; });
    if (!sf) return o;
    o['--bg-0'] = sf['--gn-tray'];
    o['--bg-1'] = sf['--bg-1'];
    return o;
  }

  // ------------------------------------------------------------------ CSS
  var S = '[data-gn-surface]';
  var CSS = [
    S + '.panel{background:var(--gn-tray)}',
    // profundidad: tarjetas, indicadores, tablas y cabeceras
    S + ' :is(.wvs-it,.wvs-aal,.wvp-st,.wvp-wrap,.wvd-st,.wvd-wrap,.wvo-row,.wvo-meta,.achc-card,.achg-grp,.achx-st,.wvx-st,.achx-hero,.wvx-hero){box-shadow:var(--gn-elev)}',
    // Tienda: ícono 52 px con su anillo de rareza, fijado en dorado
    S + ' .wvs-it{grid-template-columns:52px minmax(0,1fr) auto;padding:12px 12px 10px}',
    S + ' .wvs-ic{width:52px;height:52px;border-radius:10px}',
    S + ' .wvs-n{font-size:.95rem;font-weight:700}',
    S + ' .wvs-units i{height:8px}',
    S + ' .wvs-it--pinned{border-color:var(--color-amber,#F2B94B);background:linear-gradient(180deg,color-mix(in srgb,var(--color-amber,#F2B94B) 10%,transparent),transparent 45%),var(--bg-1)}',
    S + ' .wvs-pin--on{background:var(--color-amber,#F2B94B);color:var(--gn-tray);font-weight:700}',
    // Compras fijadas: indicadores con filete por significado, íconos 34 px, encabezado en placa
    S + ' .wvp-st{border-top:3px solid var(--k,var(--bd-2))}',
    S + ' .wvp-st:nth-child(1){--k:var(--wvx-aa,#4FC3D9)}' + S + ' .wvp-st:nth-child(2){--k:var(--acc-1)}' + S + ' .wvp-st:nth-child(3){--k:var(--color-amber,#F2B94B)}' + S + ' .wvp-st:nth-child(4){--k:var(--color-green,#3CC48A)}',
    S + ' .wvp-it img{width:34px;height:34px;box-shadow:0 0 0 1px var(--bd-2)}',
    S + ' :is(.wvp-t,.wvd-t) thead th{background:var(--gn-plate)}',
    S + ' .wvp-u{height:6px}',
    // Logros: ícono oficial 52 px en placa de 60 px; a un paso, anillo dorado y la etiqueta
    S + ' .achc-card{padding:14px}',
    S + ' .achc-ico{width:60px;height:60px;padding:4px;border-radius:12px;background:radial-gradient(circle at 50% 40%,var(--gn-plate),var(--bg-1));box-shadow:0 0 0 1px var(--bd-2)}',
    S + ' .achc-card--step{background:linear-gradient(180deg,color-mix(in srgb,var(--color-amber,#F2B94B) 10%,transparent),transparent 40%),var(--bg-1)}',
    S + ' .achc-card--step .achc-ico{box-shadow:0 0 0 2px var(--color-amber,#F2B94B),0 0 16px color-mix(in srgb,var(--color-amber,#F2B94B) 35%,transparent)}',
    S + ' .achc-title{font-size:1rem;font-weight:700}',
    S + ' .achc-card--step .achc-name::before{content:"A UN PASO";content:"A UN PASO" / "";display:inline-block;margin:0 0 4px;font-size:.64rem;font-weight:800;letter-spacing:.04em;color:var(--gn-tray);background:var(--color-amber,#F2B94B);border-radius:999px;padding:1px 7px}',
    S + ' .achc-miss b{font-size:1.4rem}',
    S + ' .achc-prog{height:10px;position:relative;overflow:visible;margin-right:46px}',
    S + ' .achc-prog::after{content:attr(aria-valuenow) " %";content:attr(aria-valuenow) " %" / "";position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:8px;font-size:.78rem;font-weight:700;color:var(--tx-1);white-space:nowrap}',
    S + ' .achc-rw li{background:var(--gn-plate);border-color:var(--bd-1);color:var(--tx-1)}',
    S + ' .achc-foot{padding-top:8px;border-top:1px solid var(--bd-1)}',
    S + ' .achg-row img,' + S + ' .achg-noicon{box-shadow:0 0 0 1px var(--bd-2)}',
    // enlaces de texto: el acento, ajustado para leerse sobre la tarjeta elevada (AA)
    S + ' :is(.achc-wiki,.achc-link,.achg-link,.wvx-link,.wvp-sel-acc){color:var(--gn-link,var(--acc-1))}',
    '@media (max-width:900px){' + S + ' .achc-ico{width:52px;height:52px}' + S + ' .wvs-it{grid-template-columns:48px minmax(0,1fr) auto}' + S + ' .wvs-ic{width:48px;height:48px}}'
  ].join('\n');

  // ------------------------------------------------------------------ DOM
  var doc = root.document;
  var st = { scopes: SCOPES.slice(), applied: {}, watching: false };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }

  function readTokens() {
    var t = {}, cs = typeof root.getComputedStyle === 'function' && doc && doc.documentElement ? root.getComputedStyle(doc.documentElement) : null;
    ['--bg-0', '--bg-1', '--tx-1', '--tx-2', '--acc-1'].forEach(function (k) { t[k] = cs && cs.getPropertyValue ? cs.getPropertyValue(k) : ''; });
    return t;
  }

  function ensureCss() {
    if (!doc || byId('gn-surface-css') || !doc.createElement || !doc.head) return;
    var s = doc.createElement('style');
    s.id = 'gn-surface-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  // Pone (o saca) las superficies en cada panel registrado. Devuelve lo que aplicó.
  function apply(tokens) {
    ensureCss();
    var sf = surfaces(tokens || readTokens());
    st.scopes.forEach(function (id) {
      var p = byId(id);
      if (!p || !p.style || typeof p.style.setProperty !== 'function') return;
      if (!sf) {
        KEYS.forEach(function (k) { p.style.removeProperty(k); });
        if (p.removeAttribute) p.removeAttribute('data-gn-surface');
        delete st.applied[id];
        return;
      }
      KEYS.forEach(function (k) { p.style.setProperty(k, sf[k]); });
      if (p.setAttribute) p.setAttribute('data-gn-surface', sf.light ? 'light' : 'dark');
      st.applied[id] = true;
    });
    return sf;
  }

  function register(id) {
    if (!id || st.scopes.indexOf(id) >= 0) return false;
    st.scopes.push(id);
    apply();
    return true;
  }

  function watch() {
    if (st.watching || !doc || !doc.documentElement) return;
    st.watching = true;
    if (typeof root.MutationObserver === 'function') {
      new root.MutationObserver(function () { apply(); setTimeout(function () { apply(); }, 400); })
        .observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    if (doc.addEventListener) doc.addEventListener('gn:boot-ready', function () { apply(); });
    if (root.addEventListener) root.addEventListener('load', function () { apply(); });
  }

  function init() { apply(); watch(); }

  root.GNSurface = {
    version: VERSION, apply: apply, register: register, surfaceTokens: surfaceTokens,
    scopes: function () { return st.scopes.slice(); },
    _pure: { parse: parse, over: over, mix: mix, contrast: contrast, hex: hex, readable: readable, surfaces: surfaces, CSS: CSS, SCOPES: SCOPES, TARGETS: T }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
