/*!
 * js/shv-memory.js — Mi memoria de la Cartera (BL-059 SHV-2, nivel N3 de DEC-033)
 * Versión: 1.1.0 (2026-10-27) · SHV-4a: «Lo que recuerdo de vos». Podés pausarme (gn:shv:paused: no saco fotos ni
 *          pido nada; lo que ya sé lo sigo usando), borrar mis fotos (forget) y llevártelas (exportData: la huella
 *          de cada cuenta, nunca la Key). La ventana que lo muestra llega en SHV-4b (js/shv-recall.js).
 *          1.0.0 (2026-10-27) · SHV-2.
 *
 * Una foto por día y por cuenta de tus divisas principales (oro, karma, gemas, Monedas de Laurel,
 * Aclamación astral) y de las que fijaste en la Cartera. Así puedo decir si algo subió o bajó.
 *  - Saco la foto cada vez que la Bóveda lee /v2/account/wallet (la Cartera, Todas las cuentas,
 *    Actividades, Raids, el conversor): miro la respuesta que ya llegó, sin pedir nada nuevo.
 *    Si la Cartera ya se había leído antes de que yo cargara y hoy todavía no tengo foto de esa
 *    cuenta, la pido una vez por día y por cuenta a GW2Api (que usa su caché).
 *  - Cada cuenta se reconoce por una huella de la Key (FNV-1a, la misma de Actividades y Cuentas):
 *    no guarda ningún carácter de la Key.
 *  - Guardo 90 días (D2) en gn:shv:wallet, con un tope de 64 KB: si no entra, se van primero los
 *    días más viejos. Nunca toco otra clave.
 * Se carga por js/modules.json antes de js/shv-wallet.js, que dibuja la evolución en la Cartera.
 */
(function (root) {
  'use strict';
  var VERSION = '1.1.0';
  var KEY = 'gn:shv:wallet', PAUSE_KEY = 'gn:shv:paused';
  var DAYS = 90, CAP = 64 * 1024;
  var TRACK = [1, 2, 4, 3, 63]; // oro (en cobre), karma, gemas, Monedas de Laurel, Aclamación astral
  var NAMES = { 1: 'Oro', 2: 'Karma', 4: 'Gemas', 3: 'Monedas de Laurel', 63: 'Aclamación astral' };
  var WALLET_RE = /\/v2\/account\/wallet(?:[?#]|$)/;
  var st = { asked: {}, ls: null };

  // ------------------------------------------------------------------ puro
  function fingerprint(token) {
    var s = String(token || ''), h = 0x811c9dc5;
    if (!s) return '';
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** Día local como número (días desde 1970 en tu huso horario). */
  function dayOf(ts) {
    var d = new Date(ts);
    return Math.floor((ts - d.getTimezoneOffset() * 60000) / 864e5);
  }
  function minuteOf(ts) { var d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); }
  function tsOf(day, min) {
    var noonUtc = day * 864e5 + 12 * 3600000, off = new Date(noonUtc).getTimezoneOffset() * 60000;
    return day * 864e5 + off + (min || 0) * 60000;
  }
  function tokenOf(url) {
    var m = /[?&]access_token=([^&#]+)/.exec(String(url || ''));
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
  }
  function blank() { return { v: 1, a: {} }; }
  function valid(s) { return s && s.v === 1 && s.a && typeof s.a === 'object' ? s : null; }

  /**
   * Suma la foto de hoy de una cuenta. list: respuesta de /v2/account/wallet ([{id, value}]).
   * La última foto del día pisa a la anterior. Devuelve true si cambió algo.
   */
  function addSnapshot(store, fp, list, at, extraIds) {
    if (!fp || !Array.isArray(list) || typeof at !== 'number') return false;
    var byId = {};
    list.forEach(function (x) { if (x && typeof x.id === 'number' && typeof x.value === 'number') byId[x.id] = x.value; });
    var acc = store.a[fp] || (store.a[fp] = { i: [], d: {} });
    TRACK.concat(Array.isArray(extraIds) ? extraIds : []).forEach(function (id) {
      id = Number(id);
      if (id > 0 && acc.i.indexOf(id) < 0) acc.i.push(id);
    });
    var row = [minuteOf(at)];
    acc.i.forEach(function (id) { row.push(id in byId ? byId[id] : 0); }); // la API omite las divisas en 0
    var day = String(dayOf(at)), prev = acc.d[day];
    acc.d[day] = row;
    return !prev || JSON.stringify(prev) !== JSON.stringify(row);
  }

  /** Saca lo de más de 90 días y, si no entra en el tope, los días más viejos de todas las cuentas. */
  function prune(store, now, cap) {
    var minDay = dayOf(now) - DAYS + 1, removed = 0;
    Object.keys(store.a).forEach(function (fp) {
      var d = store.a[fp].d;
      Object.keys(d).forEach(function (k) { if (Number(k) < minDay) { delete d[k]; removed++; } });
    });
    var limit = typeof cap === 'number' ? cap : CAP;
    while (JSON.stringify(store).length > limit) {
      var oldest = null;
      Object.keys(store.a).forEach(function (fp) {
        Object.keys(store.a[fp].d).forEach(function (k) { if (oldest === null || Number(k) < oldest) oldest = Number(k); });
      });
      if (oldest === null || oldest >= dayOf(now)) break; // hoy no se borra
      Object.keys(store.a).forEach(function (fp) { if (store.a[fp].d[oldest]) { delete store.a[fp].d[oldest]; removed++; } });
    }
    Object.keys(store.a).forEach(function (fp) { if (!Object.keys(store.a[fp].d).length) delete store.a[fp]; });
    return removed;
  }

  /** Historia de una cuenta, de la más vieja a la más nueva: [{day, at, values: {id: valor}}]. */
  function history(store, fp) {
    var acc = store && store.a && store.a[fp];
    if (!acc) return [];
    return Object.keys(acc.d).map(Number).sort(function (a, b) { return a - b; }).map(function (day) {
      var row = acc.d[day], values = {};
      acc.i.forEach(function (id, j) { if (j + 1 < row.length) values[id] = row[j + 1]; });
      return { day: day, at: tsOf(day, row[0]), values: values };
    });
  }

  /**
   * Resumen de los últimos n días para dibujar: la serie del oro (null en los días sin foto) y,
   * por divisa, el valor de la última foto y la diferencia con la primera de la ventana.
   */
  function summary(store, fp, n, now, names) {
    n = n || 30;
    var h = history(store, fp), today = dayOf(now), from = today - n + 1;
    var win = h.filter(function (x) { return x.day >= from && x.day <= today; });
    var out = { days: h.length, inWindow: win.length, lastAt: h.length ? h[h.length - 1].at : null, gold: [], rows: [] };
    var byDay = {};
    win.forEach(function (x) { byDay[x.day] = x; });
    for (var d = from; d <= today; d++) out.gold.push(byDay[d] && 1 in byDay[d].values ? byDay[d].values[1] / 10000 : null);
    if (!win.length) return out;
    var first = win[0], last = win[win.length - 1], acc = store.a[fp];
    acc.i.forEach(function (id) {
      if (!(id in last.values)) return;
      var a = id in first.values ? first.values[id] : null, b = last.values[id];
      if (id === 1) { a = a === null ? null : a / 10000; b = b / 10000; }
      out.rows.push({ id: id, name: (names && names[id]) || NAMES[id] || ('Divisa ' + id), value: b, delta: a === null ? null : b - a, gold: id === 1 });
    });
    return out;
  }

  // ------------------------------------------------------------------ almacenamiento
  function ls() { return st.ls || root.localStorage || null; }
  function read() {
    try { var s = ls() && ls().getItem(KEY); return valid(s ? JSON.parse(s) : null) || blank(); } catch (_) { return blank(); }
  }
  function write(store, now) {
    prune(store, now);
    var L = ls();
    if (!L) return false;
    for (var tries = 0; tries < 3; tries++) {
      try { L.setItem(KEY, JSON.stringify(store)); return true; } catch (e) {
        // Sin lugar en el navegador: achico mi memoria (nunca la de otros) y pruebo de nuevo.
        prune(store, now, Math.floor(JSON.stringify(store).length * 0.75));
      }
    }
    return false;
  }

  function pinnedIds() {
    var W = root.WalletTheme, S = W && W._state, out = [];
    [S && S.models, S && S.tmodels].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (m) { if (m && m.pinned && Number(m.id) > 0 && out.indexOf(Number(m.id)) < 0) out.push(Number(m.id)); });
    });
    return out;
  }

  function emit(detail) {
    var doc = root.document;
    if (!doc || typeof root.CustomEvent !== 'function') return;
    try { doc.dispatchEvent(new root.CustomEvent('gn:shv-memory', { detail: typeof detail === 'object' ? detail : { fp: detail } })); } catch (_) {}
  }

  // ------------------------------------------------------------------ SHV-4a: pausa, borrar y llevártelo
  function isPaused() { try { return !!ls() && ls().getItem(PAUSE_KEY) === 'true'; } catch (_) { return false; } }
  /** Sin argumento: ¿estoy en pausa? Con true/false: me pausás o me volvés a dejar recordar. */
  function paused(v) {
    if (typeof v === 'boolean' && v !== isPaused()) {
      try { if (v) ls().setItem(PAUSE_KEY, 'true'); else ls().removeItem(PAUSE_KEY); } catch (_) { return isPaused(); }
      emit({ paused: v });
    }
    return isPaused();
  }
  /** Borra todas mis fotos de la Cartera (no toca la pausa ni ninguna otra clave). Dice cuántas borró. */
  function forget() {
    var s = read(), n = 0;
    Object.keys(s.a).forEach(function (fp) { n += Object.keys(s.a[fp].d).length; });
    var L = ls();
    try { if (L) L.removeItem(KEY); } catch (_) { return { ok: false, snapshots: n }; }
    st.asked = {};
    emit({ forgot: true });
    return { ok: true, snapshots: n };
  }
  function iso(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  /** Lo que te llevás: cada cuenta por su huella (nunca la Key) con sus fotos, de la más vieja a la más nueva. */
  function exportData(at) {
    var s = read(), now = typeof at === 'number' ? at : Date.now(), accounts = {};
    Object.keys(s.a).sort().forEach(function (fp) {
      accounts[fp] = history(s, fp).map(function (x) { return { date: iso(x.at), at: x.at, values: x.values }; });
    });
    return { app: 'boveda-del-gato-negro', kind: 'shv-memory', v: 1, exportedAt: new Date(now).toISOString(),
      note: 'Fotos diarias de tu Cartera que guarda Shiruvana. Cada cuenta va por una huella de 8 caracteres de su Key, nunca la Key. El oro (1) va en cobre.',
      names: NAMES, accounts: accounts };
  }

  /** Guarda la foto de hoy de la cuenta de esa Key (en pausa, no). */
  function record(token, list, at) {
    var fp = fingerprint(token);
    if (!fp || !Array.isArray(list) || isPaused()) return false;
    var now = typeof at === 'number' ? at : Date.now(), store = read();
    if (!addSnapshot(store, fp, list, now, pinnedIds())) return true;
    var ok = write(store, now);
    if (ok) emit(fp);
    return ok;
  }

  function hasToday(fp, now) {
    var acc = read().a[fp];
    return !!(acc && acc.d[String(dayOf(typeof now === 'number' ? now : Date.now()))]);
  }

  /** Si hoy no tengo foto de esta cuenta, la pido una vez (GW2Api usa su caché). */
  function ensureToday(token) {
    var fp = fingerprint(token), A = root.GW2Api, k = fp + ':' + dayOf(Date.now());
    if (!fp || isPaused() || st.asked[k] || hasToday(fp) || !A || typeof A.getAccountWallet !== 'function') return Promise.resolve(false);
    st.asked[k] = true;
    return Promise.resolve().then(function () { return A.getAccountWallet(token, { nocache: false }); })
      .then(function (list) { return record(token, list); }, function () { return false; });
  }

  /** Miro las respuestas de /v2/account/wallet que pide la Bóveda, sin cambiarlas. */
  function hookFetch() {
    var f = root.fetch;
    if (typeof f !== 'function' || f.__shvMemory) return false;
    var wrapped = function (input) {
      var p = f.apply(root, arguments);
      try {
        var url = typeof input === 'string' ? input : input && input.url;
        if (url && WALLET_RE.test(url) && p && typeof p.then === 'function') {
          p.then(function (r) {
            if (!r || !r.ok || typeof r.clone !== 'function') return;
            r.clone().json().then(function (list) { record(tokenOf(url), list); }, function () {});
          }, function () {});
        }
      } catch (_) {}
      return p;
    };
    wrapped.__shvMemory = true;
    root.fetch = wrapped;
    return true;
  }

  function stats() {
    var s = read(), days = 0;
    Object.keys(s.a).forEach(function (fp) { days += Object.keys(s.a[fp].d).length; });
    var chars = 0;
    try { chars = (ls() && (ls().getItem(KEY) || '').length) || 0; } catch (_) {}
    var first = null, last = null;
    Object.keys(s.a).forEach(function (fp) {
      Object.keys(s.a[fp].d).forEach(function (k) { k = Number(k); if (first === null || k < first) first = k; if (last === null || k > last) last = k; });
    });
    return { accounts: Object.keys(s.a).length, snapshots: days, chars: chars, cap: CAP, paused: isPaused(),
      first: first === null ? null : tsOf(first, 0), last: last === null ? null : tsOf(last, 0),
      days: first === null ? 0 : last - first + 1 };
  }

  root.ShvMemory = {
    version: VERSION, KEY: KEY, PAUSE_KEY: PAUSE_KEY, paused: paused, forget: forget, exportData: exportData, DAYS: DAYS, CAP: CAP, TRACK: TRACK.slice(), NAMES: NAMES,
    fingerprint: fingerprint, record: record, ensureToday: ensureToday, hookFetch: hookFetch, stats: stats,
    history: function (fp) { return history(read(), fp); },
    summary: function (fp, n, now, names) { return summary(read(), fp, n, typeof now === 'number' ? now : Date.now(), names); },
    _pure: { fingerprint: fingerprint, dayOf: dayOf, tsOf: tsOf, tokenOf: tokenOf, addSnapshot: addSnapshot, prune: prune, history: history, summary: summary, blank: blank },
    _setStorage: function (L) { st.ls = L; st.asked = {}; }
  };
  hookFetch();
  if (root.console && root.console.info) root.console.info('[ShvMemory] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
