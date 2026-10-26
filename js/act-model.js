/*!
 * js/act-model.js — Modelo de Actividades (BL-070, paso 3)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25) · ACT-1: datos verificados y modelo, sin pantalla todavía
 *
 * Funciones puras, sin DOM, sin pedidos y sin almacenamiento. Las usan las pestañas Hoy y Semana
 * (ACT-2 a ACT-4) con los datos de assets/data/activities/catalog.json.
 *  - Relojes: reset diario 00:00 UTC, cambio del PSNA 08:00 UTC y reset semanal lunes 07:30 UTC.
 *  - Fabricación diaria: las 5 de /v2/dailycrafting; sin lectura de la cuenta es «sin datos» (null), nunca «te falta».
 *  - Fractales del día: de la categoría de logros 88 (hoy y mañana), por fractal y rango, y las escalas recomendadas.
 *  - Llave semanal: «probable» si un personaje de nivel 10 o más se creó desde el último reset; la API no
 *    informa el capítulo terminado, así que nunca dice «reclamada» sin que la confirmes.
 *  - Piedras vetustas: una casilla por moneda, con lo que tenés de cada una en la cartera.
 *  - Marcas a mano: por cuenta con una huella (nunca la Key) y por semana; las de otra semana no cuentan.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var DAY = 86400000;

  // ------------------------------------------------------------------ relojes
  function t(now) { return now instanceof Date ? now.getTime() : Number(now); }
  function dayStart(now) { var d = new Date(t(now)); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  function nextDaily(now) { return dayStart(now) + DAY; }
  function nextPsna(now) { var n = dayStart(now) + 8 * 3600000; return t(now) < n ? n : n + DAY; }
  // Último reset semanal: lunes 07:30 UTC.
  function lastWeekly(now) {
    var ms = t(now), d = new Date(ms), wd = d.getUTCDay(), back = (wd + 6) % 7;
    var r = dayStart(ms) - back * DAY + 7.5 * 3600000;
    return ms < r ? r - 7 * DAY : r;
  }
  function nextWeekly(now) { return lastWeekly(now) + 7 * DAY; }
  function weekKey(now) { return new Date(lastWeekly(now)).toISOString().slice(0, 10); }
  function dayKey(now) { return new Date(dayStart(now)).toISOString().slice(0, 10); }
  // «18 h 42 min», «42 min», «menos de 1 min»
  function left(ms) {
    var m = Math.floor(Math.max(0, ms) / 60000), h = Math.floor(m / 60);
    if (m < 1) return 'menos de 1 min';
    return h ? h + ' h ' + (m % 60) + ' min' : m + ' min';
  }

  // ------------------------------------------------------------------ fabricación diaria
  // items: catalog.dailyCrafting.items; done: lista de claves de /v2/account/dailycrafting, o null si no se leyó.
  function dailyCrafting(items, done) {
    var read = Array.isArray(done);
    var rows = (items || []).map(function (it) {
      return { key: it.key, item: it.item, name: it.name, rarity: it.rarity, done: read ? done.indexOf(it.key) >= 0 : null };
    });
    var n = read ? rows.filter(function (r) { return r.done; }).length : null;
    return { rows: rows, done: n, total: rows.length, missing: read ? rows.length - n : null };
  }

  // ------------------------------------------------------------------ fractales del día
  // achs: [{id, name}] de /v2/achievements (los ids de achievements o tomorrow de la categoría 88).
  // pats: catalog.fractals.patterns. Devuelve los fractales en el orden en que aparecen y los recomendados por escala.
  function fractals(achs, pats, minScale) {
    var out = { fractals: [], recommended: [], unknown: [] }, byName = {};
    var P = [];
    Object.keys(pats || {}).forEach(function (lang) {
      var p = pats[lang];
      P.push({ tier: new RegExp(p.tier), rec: new RegExp(p.recommended), tierFirst: lang === 'en' });
    });
    (achs || []).forEach(function (a) {
      if (!a || !a.name) return;
      for (var i = 0; i < P.length; i++) {
        var m = P[i].tier.exec(a.name);
        if (m) {
          var name = P[i].tierFirst ? m[2] : m[1], tier = Number(P[i].tierFirst ? m[1] : m[2]);
          var f = byName[name];
          if (!f) { f = byName[name] = { name: name, tiers: {} }; out.fractals.push(f); }
          f.tiers[tier] = { id: a.id, minScale: minScale ? minScale[tier] : null };
          return;
        }
        var r = P[i].rec.exec(a.name);
        if (r) { out.recommended.push({ id: a.id, scale: Number(r[1]) }); return; }
      }
      out.unknown.push(a.id);
    });
    out.recommended.sort(function (x, y) { return x.scale - y.scale; });
    return out;
  }

  // Progreso con /v2/account/achievements (logros diarios: done del día). accountAch null = sin datos.
  function fractalProgress(parsed, accountAch) {
    if (!parsed) return null;
    var ids = [];
    parsed.fractals.forEach(function (f) { Object.keys(f.tiers).forEach(function (k) { ids.push(f.tiers[k].id); }); });
    parsed.recommended.forEach(function (r) { ids.push(r.id); });
    if (!Array.isArray(accountAch)) return { done: null, total: ids.length, ids: {} };
    var done = {};
    accountAch.forEach(function (a) { if (a && a.done && ids.indexOf(a.id) >= 0) done[a.id] = true; });
    return { done: Object.keys(done).length, total: ids.length, ids: done };
  }

  // ------------------------------------------------------------------ llave semanal
  // chars: [{name, level, created}] de /v2/characters?ids=all, o null si no se leyó.
  // mark: true / false / undefined (lo que confirmaste esta semana).
  function weeklyKey(chars, now, level, mark) {
    if (mark === true) return { state: 'claimed', by: 'mark', chars: [] };
    if (mark === false) return { state: 'pending', by: 'mark', chars: [] };
    if (!Array.isArray(chars)) return { state: 'unknown', by: null, chars: [] };
    var since = lastWeekly(now), min = level || 10;
    var c = chars.filter(function (x) {
      var cr = x && Date.parse(x.created);
      return x && Number(x.level) >= min && isFinite(cr) && cr >= since;
    }).map(function (x) { return { name: x.name, level: x.level, created: x.created }; });
    return { state: c.length ? 'probable' : 'none', by: 'chars', chars: c };
  }

  // ------------------------------------------------------------------ piedras vetustas (Leivas)
  // offers: catalog.leivas.offers; wallet: [{id, value}] o null; marks: {currencyId: true} de esta semana.
  function leivas(offers, wallet, marks) {
    var have = null;
    if (Array.isArray(wallet)) { have = {}; wallet.forEach(function (w) { if (w) have[w.id] = Number(w.value) || 0; }); }
    var rows = (offers || []).map(function (o) {
      var h = have ? (have[o.currency] || 0) : null;
      return { currency: o.currency, label: o.label, cost: o.cost, have: h, afford: h === null ? null : h >= o.cost, bought: !!(marks && marks[o.currency]) };
    });
    var bought = rows.filter(function (r) { return r.bought; }).length;
    return { rows: rows, bought: bought, total: rows.length, missing: rows.filter(function (r) { return !r.bought; }).map(function (r) { return r.label; }) };
  }

  // D3: lo que marcaste con el −/+ viejo (0 a 5) pasa a «compradas» en el orden de las ofertas.
  function stonesFromCount(offers, count) {
    var n = Math.max(0, Math.floor(Number(count) || 0)), m = {};
    (offers || []).slice(0, n).forEach(function (o) { m[o.currency] = true; });
    return m;
  }

  // ------------------------------------------------------------------ marcas a mano
  // Huella de la Key (FNV-1a de 32 bits): sirve para separar cuentas sin guardar la Key.
  function fingerprint(token) {
    var s = String(token || ''), h = 0x811c9dc5;
    if (!s) return '';
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  // store: {fp: {week, key, stones}}. Lo de otra semana no cuenta.
  function marksFor(store, fp, now) {
    var b = store && fp ? store[fp] : null, wk = weekKey(now);
    if (!b || b.week !== wk) return { week: wk, key: undefined, stones: {} };
    return { week: wk, key: b.key, stones: b.stones || {} };
  }
  function setMark(store, fp, now, what, value) {
    var s = {}, wk = weekKey(now);
    Object.keys(store || {}).forEach(function (k) { if (store[k] && store[k].week === wk) s[k] = store[k]; });
    if (!fp) return s;
    var b = s[fp] ? { week: wk, key: s[fp].key, stones: Object.assign({}, s[fp].stones) } : { week: wk, stones: {} };
    if (what === 'key') b.key = value === null ? undefined : !!value;
    else if (what === 'stone' && value) { if (value.on) b.stones[value.currency] = true; else delete b.stones[value.currency]; }
    s[fp] = b;
    return s;
  }

  var pure = {
    dayStart: dayStart, nextDaily: nextDaily, nextPsna: nextPsna, lastWeekly: lastWeekly, nextWeekly: nextWeekly,
    weekKey: weekKey, dayKey: dayKey, left: left, dailyCrafting: dailyCrafting, fractals: fractals,
    fractalProgress: fractalProgress, weeklyKey: weeklyKey, leivas: leivas, stonesFromCount: stonesFromCount,
    fingerprint: fingerprint, marksFor: marksFor, setMark: setMark
  };
  root.ActModel = { version: VERSION, _pure: pure };
  if (root.console && root.console.info) root.console.info('[ActModel] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
