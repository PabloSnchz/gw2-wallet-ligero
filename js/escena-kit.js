/*!
 * kit/escena-kit.js — «Escena» compartida de Shiruvana (1.0.0, 2026-11-17, BL-091 CD-3)
 *
 * Mi globo con el gato robot sentado encima y mis poses de cuerpo entero sin fondo,
 * para todo el ecosistema. La usa el Centro de mando (gw2-factory-dashboard).
 * La Guarida conserva su escena (js/escena.js: consejo, bienvenida, buscador, reacciones);
 * lo que comparten (recorte, vecinos, el gato y sus frases) tiene que ser idéntico: lo vigila
 * tests/sync.test.cjs en el CI (kit-ci.yml), que también verifica que existan las imágenes.
 * Un cambio al recorte se hace en los dos lugares, en el mismo micro-ciclo (BL-091 CD-3b).
 *
 * Versión fija: cada sitio la pide con ?v=<versión>. Un cambio que rompa sube el número mayor.
 * Las imágenes viven en la-guarida/assets/brand (mismo origen pablosnchz.github.io: el canvas
 * puede leer los píxeles para recortar). No pide nada más a la red.
 * El recorte es el mismo de La Guarida (js/escena.js 1.5.0, ESC-5).
 * Las funciones puras se exportan para los tests (tests/kit.test.cjs).
 *
 * Uso:
 *   var g = ShiruvanaKit.globo({ texto: 'Hola', cara: 'hola', storageKey: 'mi-sitio:globo:v1' });
 *   g.decir('Otra cosa', 'ojo');   g.gato('festeja', '¡Bip!');   g.plegar(true);
 *   ShiruvanaKit.posesSinFondo({ el: document.body });  // --svk-p-<pose> y clase svk-p-<pose>
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var BASE = 'https://pablosnchz.github.io/la-guarida/assets/brand/';
  var CARAS = ['hola', 'ojo', 'festeja', 'guino', 'explica', 'pensando', 'con-gato'];
  var POSES = ['sentada', 'saluda', 'pensando'];
  var GATOS = ['sentado', 'festeja', 'camina'];
  var FRASES = ['Prrr… bip.', 'Miau. Compilando.', 'Ojo ámbar: sistema estable.', 'Bip bip. Todo en orden.'];
  var QUEJA = 'Basta, que estoy trabajando.';
  var UMBRAL = 14;     // «negro»: el canal más alto por debajo de esto
  var HUECO = 0.004;   // huecos negros encerrados más grandes que esta fracción también son fondo
  var GATO_MS = 1800;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function caraURL(cara, base) {
    return (base || BASE) + 'shiruvana/shiruvana-' + (CARAS.indexOf(cara) >= 0 ? cara : 'hola') + '-cara-128.webp';
  }
  function gatoURL(pose, base) {
    return (base || BASE) + 'gato/gato-' + (GATOS.indexOf(pose) >= 0 ? pose : 'sentado') + '.webp';
  }
  function poseURL(pose, base) {
    return (base || BASE) + 'shiruvana/cuerpo-' + (POSES.indexOf(pose) >= 0 ? pose : 'sentada') + '.webp';
  }

  // El gato: cuatro frases que rotan; el quinto toque, la queja.
  function fraseGato(toques) {
    var n = toques | 0;
    if (n < 1) return '';
    if (n === 5) return QUEJA;
    return FRASES[(n > 5 ? n - 2 : n - 1) % FRASES.length];
  }

  // Plegado como lo dejaste (la primera vez, abierto).
  function plegadoInicial(guardado) { return !!(guardado && guardado.plegado === true); }

  function globoHTML(o) {
    o = o || {};
    return '<button type="button" class="svk-gato" aria-label="Tocar al gato robot">' +
        '<img src="' + esc(gatoURL('sentado', o.base)) + '" alt="" width="320" height="320"></button>' +
      '<span class="svk-gato-dice" aria-live="polite"></span>' +
      '<img class="svk-cara" src="' + esc(caraURL(o.cara, o.base)) + '" alt="" width="44" height="44">' +
      '<div class="svk-dice">' +
        '<p class="svk-nombre">Shiruvana</p>' +
        '<p class="svk-texto">' + esc(o.texto) + '</p>' +
      '</div>' +
      '<button type="button" class="svk-plegar" aria-expanded="true" aria-label="Plegar mi globo" title="Plegar">⇲</button>';
  }

  // ---- Recorte del fondo negro (puro: trabaja sobre los píxeles RGBA) ----
  // Lo negro conectado al borde es fondo; los huecos negros encerrados grandes (entre el
  // brazo y el cuerpo) también; los chicos (pupilas, contornos) no. Después el borde se
  // achica un píxel y se suaviza. Escribe el alfa en data y devuelve cuántos píxeles son fondo.
  function recorte(data, w, h, umbral, hueco) {
    var T = umbral == null ? UMBRAL : umbral, H = hueco == null ? HUECO : hueco;
    var n = w * h, est = new Uint8Array(n), pila = new Int32Array(n), top = 0, i, p;
    for (i = 0; i < n; i++) { p = i * 4; if (Math.max(data[p], data[p + 1], data[p + 2]) < T) est[i] = 1; }
    function meter(j, marca) { if (est[j] === 1) { est[j] = marca; pila[top++] = j; } }
    function expandir(marca, junta) {
      var c = 0;
      while (top > 0) {
        var j = pila[--top], x = j % w; c++;
        if (junta) junta.push(j);
        if (x > 0) meter(j - 1, marca);
        if (x < w - 1) meter(j + 1, marca);
        if (j >= w) meter(j - w, marca);
        if (j < n - w) meter(j + w, marca);
      }
      return c;
    }
    // 1) el fondo que toca el borde (2)
    for (i = 0; i < w; i++) { meter(i, 2); meter(n - w + i, 2); }
    for (i = 0; i < h; i++) { meter(i * w, 2); meter(i * w + w - 1, 2); }
    expandir(2);
    // 2) huecos encerrados: grandes → fondo (2); chicos → parte de la figura (3)
    var lim = H * n;
    for (i = 0; i < n; i++) {
      if (est[i] !== 1) continue;
      var junta = [];
      meter(i, 3);
      if (expandir(3, junta) > lim) for (var k = 0; k < junta.length; k++) est[junta[k]] = 2;
    }
    // 3) alfa: figura 255, fondo 0; achico un píxel y suavizo dos veces
    var a = new Uint8Array(n), fondo = 0;
    for (i = 0; i < n; i++) { if (est[i] === 2) fondo++; else a[i] = 255; }
    a = vecinos(a, w, h, true);
    a = vecinos(vecinos(a, w, h, false), w, h, false);
    for (i = 0; i < n; i++) { p = i * 4 + 3; if (a[i] < data[p]) data[p] = a[i]; }
    return fondo;
  }

  // 3×3 alrededor de cada píxel: el mínimo (achica) o el promedio (suaviza).
  function vecinos(a, w, h, minimo) {
    var out = new Uint8Array(a.length);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var m = 255, s = 0, c = 0;
        for (var dy = -1; dy <= 1; dy++) {
          var yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx; if (xx < 0 || xx >= w) continue;
            var v = a[yy * w + xx]; if (v < m) m = v; s += v; c++;
          }
        }
        out[y * w + x] = minimo ? m : Math.round(s / c);
      }
    }
    return out;
  }

  var api = {
    VERSION: VERSION, BASE: BASE, CARAS: CARAS, POSES: POSES, GATOS: GATOS, FRASES: FRASES, QUEJA: QUEJA,
    UMBRAL: UMBRAL, HUECO: HUECO, GATO_MS: GATO_MS,
    esc: esc, caraURL: caraURL, gatoURL: gatoURL, poseURL: poseURL,
    fraseGato: fraseGato, plegadoInicial: plegadoInicial, globoHTML: globoHTML, recorte: recorte
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (!root || !root.document) return;

  var doc = root.document;
  function leer(k) { if (!k) return null; try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function guardar(k, v) { if (!k) return; try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin lugar: no es grave */ } }

  // ---- Mis poses sin fondo (una vez por imagen; null si no se puede) ----
  var recortes = {};
  function sinFondo(url) {
    if (recortes[url]) return recortes[url];
    recortes[url] = new Promise(function (listo) {
      var Img = root.Image, URLs = root.URL, cv = doc.createElement('canvas');
      if (!Img || !URLs || !URLs.createObjectURL || !cv || !cv.getContext || !cv.toBlob) { listo(null); return; }
      var im = new Img();
      im.onload = function () {
        try {
          var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.drawImage(im, 0, 0);
          var d = cx.getImageData(0, 0, w, h);
          recorte(d.data, w, h);
          cx.putImageData(d, 0, 0);
          cv.toBlob(function (b) { listo(b ? URLs.createObjectURL(b) : null); }, 'image/png');
        } catch (e) { listo(null); }
      };
      im.onerror = function () { listo(null); };
      im.src = url;
    });
    return recortes[url];
  }

  // Deja cada pose lista en el elemento como --svk-p-<pose> (y la clase svk-p-<pose>).
  // Mientras no está lista no hay nada: nunca un rectángulo negro.
  function posesSinFondo(o) {
    o = o || {};
    var el = o.el || doc.body;
    if (!el || !el.style || !el.style.setProperty) return;
    (o.poses || POSES).forEach(function (p) {
      sinFondo(poseURL(p, o.base)).then(function (u) {
        if (!u) return;
        el.style.setProperty('--svk-p-' + p, 'url("' + u + '")');
        el.classList.add('svk-p-' + p);
      });
    });
  }

  // ---- Mi globo con el gato encima ----
  function globo(o) {
    o = o || {};
    var base = o.base || BASE, key = o.storageKey || null, toques = 0, tGato = null;
    var el = doc.createElement('aside');
    el.className = 'svk-globo';
    el.setAttribute('aria-label', 'Shiruvana');
    el.innerHTML = globoHTML({ base: base, cara: o.cara, texto: o.texto });
    var btnGato = el.querySelector('.svk-gato'), imgGato = btnGato.querySelector('img');
    var dice = el.querySelector('.svk-gato-dice'), cara = el.querySelector('.svk-cara');
    var texto = el.querySelector('.svk-texto'), btnPlegar = el.querySelector('.svk-plegar');
    // Sin la imagen del gato, el globo queda sin gato (no con un ícono roto).
    imgGato.onerror = function () { btnGato.hidden = true; };
    cara.onerror = function () { cara.hidden = true; };

    function plegar(si, recordar) {
      el.classList.toggle('is-plegado', !!si);
      btnPlegar.setAttribute('aria-expanded', si ? 'false' : 'true');
      btnPlegar.setAttribute('aria-label', si ? 'Abrir mi globo' : 'Plegar mi globo');
      btnPlegar.title = si ? 'Abrir' : 'Plegar';
      btnPlegar.textContent = si ? '⇱' : '⇲';
      if (recordar) guardar(key, { plegado: !!si });
    }

    function gato(pose, frase) {
      imgGato.src = gatoURL(pose, base);
      dice.textContent = frase || '';
      btnGato.classList.remove('is-salta');
      void btnGato.offsetWidth; // reinicia la animación
      btnGato.classList.add('is-salta');
      clearTimeout(tGato);
      tGato = setTimeout(function () { imgGato.src = gatoURL('sentado', base); dice.textContent = ''; btnGato.classList.remove('is-salta'); }, GATO_MS);
    }

    function decir(t, c) {
      if (texto.textContent !== String(t == null ? '' : t)) texto.textContent = t == null ? '' : t;
      var u = caraURL(c, base);
      if (cara.getAttribute('src') !== u) { cara.hidden = false; cara.src = u; }
    }

    btnPlegar.addEventListener('click', function () { plegar(!el.classList.contains('is-plegado'), true); });
    btnGato.addEventListener('click', function () { toques++; gato('festeja', fraseGato(toques)); if (o.onGato) o.onGato(toques); });
    (o.parent || doc.body).appendChild(el);
    plegar(plegadoInicial(leer(key)), false);

    return {
      el: el, decir: decir, gato: gato, plegar: function (si) { plegar(si, true); },
      plegado: function () { return el.classList.contains('is-plegado'); },
      destruir: function () { clearTimeout(tGato); if (el.parentNode) el.parentNode.removeChild(el); }
    };
  }

  api.sinFondo = sinFondo;
  api.posesSinFondo = posesSinFondo;
  api.globo = globo;
  root.ShiruvanaKit = api;
})(typeof window !== 'undefined' ? window : this);
