/*!
 * js/acc-model.js — Modelo de «Mis cuentas» (BL-070, paso 4, CTA-1)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25)
 *
 * Funciones puras: no pide, no guarda y no toca el DOM. La vista (CTA-2) lee la API con las Keys
 * de la Bóveda y le pasa las respuestas. Datos verificados en assets/data/accounts/catalog.json
 * (RUN-073 y RUN-074).
 *
 * Reglas:
 *  - Expansiones: solo las que la cuenta tiene. Salen de `access` de /v2/account. Path of Fire
 *    también da Heart of Thorns. Visions of Eternity todavía no aparece en `access` (gw2-api #118):
 *    cuenta como «la tenés» si ganaste puntos de maestría de su región (Magic) o si la marcaste
 *    vos en el Llavero; la fuente queda dicha.
 *  - Puntos de logro: los de cada logro según sus tiers (los completos suman todos; los demás,
 *    los tiers alcanzados), los repetibles por cada vez hasta su tope (point_cap), más los
 *    diarios y mensuales viejos de /v2/account. `Number(x) || 0` en todo número de la API
 *    (la API omite `current` en un logro completado sin tiers: idea78).
 *  - Estados honestos: un dato es «ok», «noperm» (a la Key le falta el permiso) o «nodata»
 *    (la lectura falló). Nunca un 0 falso.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var RENDER = 'https://render.guildwars2.com/file/';

  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function has(arr, x) { return Array.isArray(arr) && arr.indexOf(x) >= 0; }

  // Íconos del catálogo: locales («assets/…») o del servicio oficial de imágenes.
  function icon(src) {
    var s = String(src || '');
    if (!s) return '';
    return /^(assets\/|https:\/\/)/.test(s) ? s : RENDER + s;
  }

  // ------------------------------------------------------------------ cuenta
  function isFree(access) {
    if (!Array.isArray(access)) return null;
    return access.every(function (a) { return a === 'PlayForFree' || a === 'None'; });
  }

  // regiones de maestría con puntos ganados (/v2/account/mastery/points → totals)
  function masteryRegions(points) {
    var out = {};
    var totals = points && Array.isArray(points.totals) ? points.totals : [];
    totals.forEach(function (t) { if (t && t.region && num(t.earned) > 0) out[t.region] = num(t.earned); });
    return out;
  }

  // expansiones que la cuenta tiene, en el orden del catálogo; nada de las que no tiene
  function expansions(cat, access, masteryPoints, manual) {
    var regions = masteryRegions(masteryPoints);
    var mine = manual || {};
    return (cat || []).reduce(function (out, e) {
      var source = null;
      if (has(access, e.access) || (e.impliedBy || []).some(function (a) { return has(access, a); })) source = 'api';
      else if (e.apiMissing && e.mastery && regions[e.mastery]) source = 'mastery';
      else if (e.apiMissing && mine[e.id] === true) source = 'manual';
      if (source) out.push({ id: e.id, name: e.name, icon: icon(e.icon), source: source });
      return out;
    }, []);
  }

  // ------------------------------------------------------------------ logros
  function tierSum(tiers, upTo) {
    return (tiers || []).reduce(function (s, t) {
      return (upTo === undefined || num(t.count) <= upTo) ? s + num(t.points) : s;
    }, 0);
  }

  // puntos de un logro de la cuenta con su definición (y su tope si es repetible)
  function pointsOf(entry, meta, cap) {
    if (!entry || !meta) return 0;
    var tiers = meta.tiers || [];
    var full = tierSum(tiers);
    var cur = num(entry.current);
    if (has(meta.flags, 'Repeatable')) {
      var p = num(entry.repeated) * full + tierSum(tiers, cur);
      return (typeof cap === 'number' && cap >= 0) ? Math.min(p, cap) : p;
    }
    return entry.done ? full : tierSum(tiers, cur);
  }

  // los logros repetibles de la cuenta: para pedir su tope (la caché común no lo guarda)
  function repeatableIds(progress, metaById) {
    return (Array.isArray(progress) ? progress : []).filter(function (e) {
      var m = e && metaById && metaById[e.id];
      return m && has(m.flags, 'Repeatable');
    }).map(function (e) { return e.id; });
  }

  // total de la cuenta; null si no hay lectura. `missing` = logros sin definición (no se inventan)
  function achievementPoints(progress, metaById, capsById, account) {
    if (!Array.isArray(progress)) return null;
    var total = 0, missing = 0, caps = capsById || {};
    progress.forEach(function (e) {
      var m = e && metaById ? metaById[e.id] : null;
      if (!m) { missing++; return; }
      total += pointsOf(e, m, caps[e.id]);
    });
    var a = account || {};
    total += num(a.daily_ap) + num(a.monthly_ap);
    return { total: total, missing: missing };
  }

  // ------------------------------------------------------------------ rangos
  function pvpRank(stats, ranks) {
    if (!stats || stats.pvp_rank == null) return null;
    var r = num(stats.pvp_rank);
    var row = (ranks || []).filter(function (x) { return r >= x.min && r <= x.max; })[0];
    return { rank: r, rollovers: num(stats.pvp_rank_rollovers), icon: row ? icon(row.icon) : '' };
  }

  function wvwRank(account) {
    if (!account) return null;
    if (account.wvw && account.wvw.rank != null) return num(account.wvw.rank);
    if (account.wvw_rank != null) return num(account.wvw_rank);
    return null;
  }

  // legendarias distintas en la armería (/v2/account/legendaryarmory)
  function legendaryCount(armory) {
    if (!Array.isArray(armory)) return null;
    var ids = {};
    armory.forEach(function (x) { if (x && x.id != null && num(x.count) > 0) ids[x.id] = true; });
    return Object.keys(ids).length;
  }

  // ------------------------------------------------------------------ permisos y estados
  function perms(tokeninfo) {
    return tokeninfo && Array.isArray(tokeninfo.permissions) ? tokeninfo.permissions.slice() : null;
  }

  function missingPerms(need, have) {
    if (!Array.isArray(have)) return null;
    return (need || []).filter(function (p) { return !has(have, p); });
  }

  // estado de un dato: sin permiso le gana a sin datos (la causa es la Key, no la API)
  function stat(value, need, have) {
    var miss = missingPerms(need, have);
    if (miss && miss.length) return { state: 'noperm', missing: miss };
    if (value === null || value === undefined) return { state: 'nodata' };
    return { state: 'ok', value: value };
  }

  // la Key tiene todo lo que usa la tarjeta
  function keyComplete(stats, have) {
    if (!Array.isArray(have)) return null;
    var all = {};
    Object.keys(stats || {}).forEach(function (k) { (stats[k].perm || []).forEach(function (p) { all[p] = true; }); });
    return Object.keys(all).every(function (p) { return has(have, p); });
  }

  // ------------------------------------------------------------------ etiquetas
  function tags(list, cat, otherColor) {
    var known = {}, order = {};
    (cat || []).forEach(function (t, i) { known[t.id] = t; order[t.id] = i; });
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      var id = String(raw || '').trim().toLowerCase();
      if (!id || seen[id]) return;
      seen[id] = true;
      var t = known[id];
      out.push(t ? { id: id, name: t.name, color: t.color, icon: icon(t.icon), type: !!t.type }
                 : { id: id, name: String(raw).trim(), color: otherColor || '#8E96A3', icon: '', type: false });
    });
    return out.sort(function (a, b) {
      var oa = id2o(a.id), ob = id2o(b.id);
      return oa !== ob ? oa - ob : a.name.localeCompare(b.name, 'es');
    });
    function id2o(id) { return order[id] === undefined ? 999 : order[id]; }
  }

  function accountType(tagList) {
    var t = (tagList || []).filter(function (x) { return x.type; })[0];
    return t ? t.id : null;
  }

  // ------------------------------------------------------------------ varios
  function guilds(ids, infoById) {
    return (Array.isArray(ids) ? ids : []).map(function (id) {
      var g = infoById && infoById[id];
      return g && g.tag ? { id: id, tag: g.tag, name: g.name || '' } : { id: id, tag: null, name: '' };
    });
  }

  function age(created, now) {
    var t = Date.parse(created);
    if (!isFinite(t)) return null;
    var days = Math.max(0, Math.floor((now - t) / 86400000));
    var d = new Date(t), n = new Date(now);
    var years = n.getUTCFullYear() - d.getUTCFullYear();
    if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) years--;
    return { days: days, years: Math.max(0, years) };
  }

  // cabecera: suma solo lo que se pudo leer y dice cuántas cuentas quedaron afuera
  function summary(cards) {
    var list = Array.isArray(cards) ? cards : [];
    var s = { accounts: list.length, ap: 0, apFrom: 0, legendaries: 0, legFrom: 0, keysComplete: 0, keysKnown: 0, types: {} };
    list.forEach(function (c) {
      if (c.ap && c.ap.state === 'ok') { s.ap += c.ap.value; s.apFrom++; }
      if (c.legendaries && c.legendaries.state === 'ok') { s.legendaries += c.legendaries.value; s.legFrom++; }
      if (c.keyComplete !== null && c.keyComplete !== undefined) { s.keysKnown++; if (c.keyComplete) s.keysComplete++; }
      if (c.type) s.types[c.type] = (s.types[c.type] || 0) + 1;
    });
    return s;
  }

  root.AccModel = {
    version: VERSION,
    _pure: {
      icon: icon, isFree: isFree, masteryRegions: masteryRegions, expansions: expansions,
      pointsOf: pointsOf, repeatableIds: repeatableIds, achievementPoints: achievementPoints,
      pvpRank: pvpRank, wvwRank: wvwRank, legendaryCount: legendaryCount,
      perms: perms, missingPerms: missingPerms, stat: stat, keyComplete: keyComplete,
      tags: tags, accountType: accountType, guilds: guilds, age: age, summary: summary
    }
  };
  if (root.console && root.console.info) root.console.info('[AccModel] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
