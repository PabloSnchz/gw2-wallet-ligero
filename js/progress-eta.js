/*!
 * js/progress-eta.js — ETA de un progreso "N/total" (Idea 48 Tramo B, extraido)
 * v1.0.0 (2026-09-30)
 *
 * Nace de una duplicacion concreta, no de una idea general: `computeEta` +
 * `fmtEta` vivian dentro de `wallet-dashboard.js` (Idea 48 Tramo B) y el
 * PO lospidio volver a usar en `wv-purchase-detail.js` (Idea 55 Tramo 2), que
 * antes hacia 27 requests EN SERIE con un toast de 1,5 s de duracion y sin
 * ningun progreso. Copiar las 15 lineas habria creado la segunda copia de un
 * helper que ya tiene 29 aserciones de test; este archivo las deja en un solo
 * lugar y las expone.
 *
 * QUE NO ES: no es un scheduler ni un pool. Solo aritmetica pura sobre
 * (cuanto llevo, cuanto falta, cuanto tardo). El reloj se recibe por parametro
 * (`tNow`) justamente para que el test pueda ejercitarlo sin reloj real, que es
 * lo que hacia antes el test de la Idea 48 extrayendo el cuerpo de la funcion
 * con `new Function` sobre el texto del archivo.
 *
 * CONTRATO (el de la Idea 48 Tramo B, sin cambios):
 *   - Devuelve null mientras no hay muestra suficiente. Un "~0 s" al arranque
 *     es PEOR que no mostrar nada: promete y no cumple.
 *   - Devuelve null si ya termino o si total es 0.
 *   - `secs` se redondea hacia ARRIBA a segundos enteros: un "~11 s" que en
 *     realidad son 11,4 termina en 12 y promete menos de lo que cumple.
 *
 * Consumidores:
 *   - wallet-dashboard.js  (Idea 48 Tramo B; MIGRAR: hoy tiene copia propia)
 *   - wv-purchase-detail.js (Idea 55 Tramo 2)
 */
(function (root) {
  'use strict';

  // Muestras minimas antes de extrapolar. Con menos de 3 la media es ruido: una
  // sola cuenta rapida daria una ETA optimista de 2 s para 26 cuentas.
  var ETA_MIN_DONE = 3;
  // Y un piso de tiempo: 3 cuentas en 200 ms no dicen nada sobre 27.
  var ETA_MIN_MS = 1500;

  function nowMs() { return Date.now(); }

  // Funcion pura salvo por nowMs(): recibe el tiempo como parametro para que el
  // test pueda ejercitarla sin reloj.
  function computeEta(startedAt, done, total, tNow) {
    if (!total || done >= total) return null;
    if (done < ETA_MIN_DONE) return null;
    var elapsed = tNow - startedAt;
    if (!(elapsed >= ETA_MIN_MS)) return null;
    var remaining = total - done;
    var ms = (elapsed / done) * remaining;
    if (!isFinite(ms) || ms <= 0) return null;
    return { ms: ms, secs: Math.ceil(ms / 1000) };
  }

  // "~12 s" / "~2 min".
  function fmtEta(secs) {
    if (secs == null || !isFinite(secs)) return '';
    if (secs < 60) return '~' + secs + ' s';
    var m = Math.ceil(secs / 60);
    return '~' + m + ' min';
  }

  root.GN = root.GN || {};
  root.GN.progressEta = {
    computeEta: computeEta,
    fmtEta: fmtEta,
    nowMs: nowMs,
    thresholds: { minDone: ETA_MIN_DONE, minMs: ETA_MIN_MS }
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
