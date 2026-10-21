/*!
 * js/shiruvana-places.js — Dónde le hablo al jugador (DEC-025)
 * Versión: 1.0.0
 *
 * Pongo mi voz (js/shiruvana.js) en tres lugares, sin tocar el código de cada módulo:
 *  - la bienvenida: me presento, y si todavía no hay API Key, te digo cómo empezar;
 *  - el modal de API Keys: qué necesito y dónde quedan tus datos;
 *  - el modal de guías: por cuál empezar.
 * Un mensaje por lugar, con avatar. Si el lugar se vuelve a dibujar, vuelvo a aparecer una sola vez.
 */
(function (root) {
  'use strict';

  var TEXTS = {
    welcomeNew: [
      'Hola, soy Shiruvana. Te acompaño en La Bóveda.',
      'Para empezar necesito una API Key de tu cuenta: tocá «Agregar API Key» y te explico qué permisos pedir. Tus datos se quedan en este navegador.'
    ],
    welcomeBack: [
      'Hola de nuevo, soy Shiruvana.',
      'Tenés todos los módulos en la barra lateral. Si querés repasar cómo funciona algo, la guía está a un clic.'
    ],
    keys: [
      'Para mostrarte tus datos necesito una API Key de tu cuenta de Guild Wars 2. La creás en account.arena.net/applications marcando los 7 permisos que te detallo abajo.',
      'Tu clave queda guardada en este navegador. Solo viaja a la API oficial de ArenaNet y, si activás la sincronización, a tu Gist privado.'
    ],
    guide: [
      'Si recién llegás, empezá por la guía básica: en pocos minutos tenés todo andando.',
      'La avanzada te cuenta cada módulo en detalle, para cuando quieras sacarle todo el jugo.'
    ]
  };

  function doc() { return root.document; }

  function hasKeys() {
    try {
      var k = root.Storage && root.Storage.get('gn:account:keys');
      return Array.isArray(k) && k.length > 0;
    } catch (_) { return false; }
  }

  // Inserta mi mensaje al principio del contenedor, una sola vez por lugar.
  function place(container, opts, marker) {
    if (!container || !root.Shiruvana) return null;
    var prev = container.querySelector('[data-shv-place="' + marker + '"]');
    if (prev) return prev;
    var el = root.Shiruvana.voice(opts);
    el.setAttribute('data-shv-place', marker);
    container.insertBefore(el, container.firstChild);
    return el;
  }

  function welcome() {
    var body = doc().querySelector('#welcomePanel .panel__body');
    if (!body || !body.firstChild) return null; // todavía no se dibujó
    return place(body, { kind: 'saluda', size: 'lg', text: hasKeys() ? TEXTS.welcomeBack : TEXTS.welcomeNew }, 'welcome');
  }

  function keys() {
    return place(doc().querySelector('#keysModal .modal__body'), { kind: 'explica', text: TEXTS.keys }, 'keys');
  }

  function guide() {
    var body = doc().querySelector('#guideModal .modal__body');
    if (!body) return null;
    // Mi recomendación reemplaza la frase genérica de arriba.
    var intro = body.querySelector('p.muted');
    if (intro && /^Elegí la guía/.test(String(intro.textContent).trim()) && intro.parentNode) intro.parentNode.removeChild(intro);
    return place(body, { kind: 'recomienda', text: TEXTS.guide }, 'guide');
  }

  function init() {
    keys();
    guide();
    welcome();
    var panel = doc().getElementById('welcomePanel');
    if (panel && typeof root.MutationObserver === 'function') {
      // La bienvenida se vuelve a dibujar cada vez que se abre: reaparezco (una vez).
      new root.MutationObserver(function () { welcome(); }).observe(panel, { childList: true, subtree: true });
    }
  }

  root.ShiruvanaPlaces = { init: init, TEXTS: TEXTS, welcome: welcome, keys: keys, guide: guide, version: '1.0.0' };

  if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', init);
  else init();

})(typeof window !== 'undefined' ? window : globalThis);
