/*!
 * js/bld-items.js — Builds: el equipo de cada build en castellano (BL-084 EQ-2)
 * Versión: 1.0.1 (2026-10-30) · el resumen junta estadísticas con el mismo nombre (RUN-236: «Dragón ×1, Dragón ×1»)
 *          · antes 1.0.0
 *
 * assets/data/builds/gear.json guarda el equipo de cada build como ids oficiales (EQ-1, lo actualiza la curación
 * semanal). Este módulo lo carga solo cuando se abre una ficha y trae de la API oficial, en castellano y por tandas:
 *   /v2/items (piezas, runas, sigilos, reliquia, infusiones, comida, utilidad, núcleo, enriquecimiento),
 *   /v2/itemstats (estadísticas) y /v2/pvp/amulets (amuleto de PvP).
 * Guarda lo traído (compacto) en GNIdb (IndexedDB) o en memoria, una semana: la segunda ficha no pide lo que ya tiene.
 * sheet(entry, refs) arma lo que pinta la ficha: armadura, abalorios, reliquia o amuleto, juegos de armas con sus
 * sigilos, extras y un resumen de estadísticas. Los textos son los del juego (DEC-046); nada se copia de guías.
 * Si una estadística no existe en la API (Snow Crows marcó 1967 en dos builds), uso la que trae la pieza.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.1';
  var API = 'https://api.guildwars2.com';
  var LANG = 'es';
  var GEAR = 'assets/data/builds/gear.json';
  var KEY = 'gn:bld:items:' + LANG;
  var TTL = 7 * 864e5;      // una semana: los nombres casi no cambian y la curación es semanal
  var MAX = 2000;           // tope de objetos guardados (los 96 builds usan ~400)
  var CHUNK = 150;
  var TIMEOUT = 30000;

  var ATTR = { Power: 'Potencia', Precision: 'Precisión', CritDamage: 'Ferocidad', ConditionDamage: 'Daño de condición',
    ConditionDuration: 'Pericia', BoonDuration: 'Concentración', Toughness: 'Dureza', Vitality: 'Vitalidad', Healing: 'Poder de curación',
    AgonyResistance: 'Resistencia a la agonía' };
  var ATTR_ORDER = ['Power', 'Precision', 'Toughness', 'Vitality', 'CritDamage', 'ConditionDamage', 'ConditionDuration', 'BoonDuration', 'Healing', 'AgonyResistance'];
  var SLOT = { Helm: 'Casco', Shoulders: 'Hombreras', Coat: 'Pecho', Gloves: 'Guantes', Leggings: 'Perneras', Boots: 'Botas',
    Back: 'Espalda', Accessory: 'Accesorio', Amulet: 'Amuleto', Ring: 'Anillo' };
  var ARMOR_ORDER = ['Casco', 'Hombreras', 'Pecho', 'Guantes', 'Perneras', 'Botas'];
  var TRINKET_ORDER = ['Espalda', 'Accesorio', 'Accesorio', 'Amuleto', 'Anillo', 'Anillo'];
  var WEAPON = { Axe: 'Hacha', LongBow: 'Arco largo', Longbow: 'Arco largo', Dagger: 'Daga', Focus: 'Foco', Greatsword: 'Mandoble',
    Hammer: 'Martillo', Mace: 'Maza', Pistol: 'Pistola', Rifle: 'Rifle', Scepter: 'Cetro', Shield: 'Escudo', Staff: 'Báculo',
    Sword: 'Espada', Torch: 'Antorcha', Warhorn: 'Cuerno de guerra', ShortBow: 'Arco corto', Shortbow: 'Arco corto', Spear: 'Lanza',
    Harpoon: 'Lanza', Speargun: 'Arpón', Trident: 'Tridente' };
  var TWO = { Greatsword: 1, Hammer: 1, LongBow: 1, Longbow: 1, ShortBow: 1, Shortbow: 1, Rifle: 1, Staff: 1, Spear: 1, Harpoon: 1, Speargun: 1, Trident: 1 };
  var EXTRAS = [['infusion', 'Infusiones'], ['food', 'Comida'], ['utility', 'Mejora'], ['jade', 'Núcleo del robot de jade'], ['enrich', 'Enriquecimiento']];

  var st = { gear: null, gearP: null, cache: null, inflight: {} };

  // ---------------------------------------------------------------- red
  function getJSON(url, f, plain) {
    f = f || root.fetch;
    if (typeof f !== 'function') return Promise.reject(new Error('Sin conexión.'));
    var once = function (fresh) {
      var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      var t = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
      var o = plain ? { cache: 'no-cache' } : {};
      if (ctl) o.signal = ctl.signal;
      if (fresh) o.cache = 'no-store';
      return Promise.resolve(f(url, o)).then(function (r) {
        if (t) clearTimeout(t);
        if (!r || (!r.ok && r.status !== 206)) { var e = new Error('respondió ' + (r ? r.status : 'nada')); e.status = r && r.status; throw e; }
        return r.json();
      }, function (e) { if (t) clearTimeout(t); throw e; });
    };
    return once(false).catch(function (e) { if (e && e.status >= 400 && e.status < 500) throw e; return once(true); });
  }
  function many(path, ids, f) {
    var parts = [];
    for (var i = 0; i < ids.length; i += CHUNK) parts.push(ids.slice(i, i + CHUNK));
    return Promise.all(parts.map(function (p) {
      // Una tanda con un id que no existe responde 206 con los demás; si responde 404 es que no hay ninguno.
      return getJSON(API + path + '?lang=' + LANG + '&ids=' + p.join(','), f).catch(function (e) { if (e && e.status === 404) return []; throw e; });
    })).then(function (rs) { return [].concat.apply([], rs.map(function (r) { return Array.isArray(r) ? r : []; })); });
  }

  // ---------------------------------------------------------------- equipo de la build
  // loadGear() → Promise<{ id: entry }>. Una sola vez; si falla se puede volver a pedir.
  function loadGear(opts) {
    opts = opts || {};
    if (st.gear) return Promise.resolve(st.gear);
    if (!st.gearP) {
      st.gearP = getJSON(GEAR, opts.fetch, true).then(function (j) { st.gear = (j && j.gear) || {}; st.meta = { fetched: j && j.fetched, source: j && j.source }; return st.gear; },
        function (e) { st.gearP = null; throw new Error('No pude leer el equipo de las builds (' + (e && e.message || 'error') + ').'); });
    }
    return st.gearP;
  }
  function gearOf(id, opts) { return loadGear(opts).then(function (g) { return g[id] || null; }); }

  // ids(entry) → { items, stats, amulets } sin repetir
  function ids(e) {
    var it = {}, sv = {}, am = {};
    var add = function (m, x) { if (x) m[x] = 1; };
    if (!e) return { items: [], stats: [], amulets: [] };
    (e.armor || []).forEach(function (a) { add(it, a[0]); add(sv, a[1]); add(it, a[2]); });
    (e.trinkets || []).forEach(function (a) { add(it, a[0]); add(sv, a[1]); });
    (e.weapons || []).forEach(function (w) { add(it, w[2]); add(sv, w[3]); (w[4] || []).forEach(function (s) { add(it, s); }); });
    ['rune', 'relic', 'food', 'utility', 'jade', 'enrich'].forEach(function (k) { add(it, e[k]); });
    if (e.infusion) add(it, e.infusion[0]);
    add(am, e.amulet);
    var num = function (m) { return Object.keys(m).map(Number); };
    return { items: num(it), stats: num(sv), amulets: num(am) };
  }

  // ---------------------------------------------------------------- normalizar (puro)
  // Texto del juego → texto plano: saca <c=@…>, convierte <br> en salto y descarta las líneas de «doble clic».
  function clean(s) {
    s = String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/?c(=[^>]*)?>/gi, '').replace(/<[^>]*>/g, '');
    return s.split('\n').map(function (l) { return l.trim(); }).filter(function (l) {
      return l && !/^Haz doble clic/i.test(l) && !/^Elemento:/i.test(l);
    }).join('\n');
  }
  function isFlavor(s) { return /^\s*<c=@flavor>/i.test(String(s || '')); }
  function normItem(x) {
    var d = x.details || {}, inf = d.infix_upgrade || {};
    var o = { id: x.id, name: x.name || ('#' + x.id), icon: x.icon || '', rarity: x.rarity || '', type: x.type || '', sub: d.type || '' };
    if (d.weight_class) o.weight = d.weight_class;
    var desc = isFlavor(x.description) ? '' : clean(x.description);
    if (desc) o.desc = desc;
    if (d.bonuses && d.bonuses.length) o.bonuses = d.bonuses.map(clean);
    if (inf.buff && inf.buff.description) o.buff = clean(inf.buff.description);
    if (inf.id) o.infix = inf.id;
    if (inf.attributes && inf.attributes.length) o.attrs = inf.attributes.map(function (a) { return [a.attribute, a.modifier]; });
    if (d.description) o.effect = clean(d.description);
    if (d.duration_ms) o.dur = d.duration_ms;
    return o;
  }
  // «de berserker» → «Berserker»; «celestial» → «Celestial»
  function statLabel(n) {
    var s = String(n || '').replace(/^(de la|del|de)\s+/i, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function normStat(s) {
    return { id: s.id, name: statLabel(s.name) || ('#' + s.id), attrs: (s.attributes || []).map(function (a) { return a.attribute; })
      .sort(function (a, b) { return ATTR_ORDER.indexOf(a) - ATTR_ORDER.indexOf(b); }) };
  }
  function normAmulet(a) {
    var at = a.attributes || {};
    return { id: a.id, name: a.name || ('#' + a.id), icon: a.icon || '',
      attrs: Object.keys(at).sort(function (x, y) { return ATTR_ORDER.indexOf(x) - ATTR_ORDER.indexOf(y); }).map(function (k) { return [k, at[k]]; }) };
  }
  function attrName(k) { return ATTR[k] || k; }

  // ---------------------------------------------------------------- caché
  function store() { return root.GNIdb && typeof root.GNIdb.get === 'function' ? root.GNIdb : null; }
  function blank() { return { v: 1, at: Date.now(), items: {}, stats: {}, amulets: {} }; }
  function cache() {
    if (st.cache) return Promise.resolve(st.cache);
    var S = store();
    var ready = S && typeof S.ready === 'function' ? S.ready() : Promise.resolve();
    return Promise.resolve(ready).then(function () {
      var c = null;
      try { c = S ? S.get(KEY) : null; } catch (_) { c = null; }
      if (!c || c.v !== 1 || !c.items || Date.now() - (c.at || 0) > TTL || Object.keys(c.items).length > MAX) c = blank();
      st.cache = c;
      return c;
    }, function () { st.cache = blank(); return st.cache; });
  }
  // Solo se guarda si se trajo algo nuevo.
  function save() { var S = store(); st.dirty = false; if (S && st.cache) { try { S.set(KEY, st.cache); } catch (_) {} } }

  // refs(entry, opts) → Promise<{ items, stats, amulets }> con todo lo que la ficha necesita, pidiendo solo lo que falta.
  function refs(e, opts) {
    opts = opts || {};
    var f = opts.fetch, need = ids(e);
    return cache().then(function (c) {
      var miss = function (m, l) { return l.filter(function (id) { return !m[id]; }); };
      var mi = miss(c.items, need.items), ma = miss(c.amulets, need.amulets);
      var key = mi.join(',') + '|' + ma.join(',');
      if (!mi.length && !ma.length) return c;
      if (!st.inflight[key]) {
        st.inflight[key] = Promise.all([many('/v2/items', mi, f), many('/v2/pvp/amulets', ma, f)]).then(function (r) {
          r[0].forEach(function (x) { c.items[x.id] = normItem(x); });
          r[1].forEach(function (x) { c.amulets[x.id] = normAmulet(x); });
          st.dirty = true;
          delete st.inflight[key];
          return c;
        }, function (err) { delete st.inflight[key]; throw err; });
      }
      return st.inflight[key];
    }).then(function (c) {
      // Estadísticas: las pedidas y, de respaldo, la propia de cada pieza (por si la pedida no existe en la API).
      var sv = need.stats.slice();
      need.items.forEach(function (id) { var it = c.items[id]; if (it && it.infix && sv.indexOf(it.infix) < 0 && /Armor|Weapon|Trinket|Back/.test(it.type)) sv.push(it.infix); });
      var ms = sv.filter(function (id) { return !c.stats[id] && !(c.noStat && c.noStat[id]); });
      if (!ms.length) { if (st.dirty) save(); return c; }
      return many('/v2/itemstats', ms, f).then(function (r) {
        r.forEach(function (s) { c.stats[s.id] = normStat(s); });
        c.noStat = c.noStat || {};
        ms.forEach(function (id) { if (!c.stats[id]) c.noStat[id] = 1; });
        save();
        return c;
      });
    });
  }

  // ---------------------------------------------------------------- ficha (puro)
  function itemOf(R, id) { return id ? (R.items[id] || { id: id, name: '#' + id, icon: '', missing: true }) : null; }
  // La estadística pedida o, si la API no la conoce, la que trae la pieza.
  function statOf(R, sid, item) {
    if (sid && R.stats[sid]) return R.stats[sid];
    var own = item && item.infix && R.stats[item.infix];
    if (own) return own;
    return sid ? { id: sid, name: '#' + sid, attrs: [], missing: true } : null;
  }
  function slotOf(it, fallback) {
    if (!it) return fallback;
    if (it.type === 'Back') return 'Espalda';
    return SLOT[it.sub] || fallback;
  }
  function weaponName(it) { return it ? (WEAPON[it.sub] || it.sub || '') : ''; }

  function sheet(e, R) {
    if (!e) return null;
    R = R || { items: {}, stats: {}, amulets: {} };
    var out = { pvp: !e.armor && !e.trinkets, armor: [], rune: null, runeMixed: false, trinkets: [], relic: itemOf(R, e.relic), amulet: null,
      sets: [], extras: [], stats: [] };
    var count = {};
    // 1.0.1: por nombre: la API tiene ids distintos para la misma estadística (p. ej. 1697 y 1681 son «Dragón»).
    var tally = function (s) { if (s && !s.missing) { count[s.name] = count[s.name] || { stat: s, pieces: 0 }; count[s.name].pieces++; } };
    (e.armor || []).forEach(function (a, i) {
      var it = itemOf(R, a[0]), s = statOf(R, a[1], it);
      out.armor.push({ slot: slotOf(it, ARMOR_ORDER[i]), item: it, stat: s, rune: a[2] ? itemOf(R, a[2]) : null });
      tally(s);
    });
    if (e.rune) out.rune = itemOf(R, e.rune);
    else if (out.armor.some(function (r) { return r.rune; })) out.runeMixed = true;
    (e.trinkets || []).forEach(function (a, i) {
      var it = itemOf(R, a[0]), s = statOf(R, a[1], it);
      out.trinkets.push({ slot: slotOf(it, TRINKET_ORDER[i]), item: it, stat: s });
      tally(s);
    });
    if (e.amulet) {
      out.amulet = R.amulets[e.amulet] || { id: e.amulet, name: 'Amuleto #' + e.amulet, icon: '', attrs: [], missing: true };
    }
    var sets = {};
    (e.weapons || []).forEach(function (w) {
      var n = w[0], it = itemOf(R, w[2]), s = w[3] ? statOf(R, w[3], it) : null;
      if (!sets[n]) { sets[n] = { n: n, label: 'Juego de armas ' + n, hands: [] }; out.sets.push(sets[n]); }
      sets[n].hands.push({ hand: w[1], item: it, type: weaponName(it), stat: s, sigils: (w[4] || []).map(function (x) { return itemOf(R, x); }) });
      tally(s);
    });
    out.sets.forEach(function (set) {
      var only = set.hands.length === 1 && set.hands[0].hand === 'm';
      set.hands.forEach(function (h) {
        h.two = only && !!TWO[(h.item && h.item.sub) || ''];
        h.handLabel = h.two ? 'Dos manos' : h.hand === 'o' ? 'Mano secundaria' : 'Mano principal';
      });
    });
    EXTRAS.forEach(function (x) {
      var k = x[0], id = k === 'infusion' ? (e.infusion && e.infusion[0]) : e[k];
      if (!id) return;
      var r = { key: k, label: x[1], item: itemOf(R, id) };
      if (k === 'infusion') r.count = e.infusion[1] || 1;
      out.extras.push(r);
    });
    out.stats = Object.keys(count).map(function (k) { return count[k]; }).sort(function (a, b) { return b.pieces - a.pieces; });
    return out;
  }

  // load(id) → Promise<{ entry, view }> : todo junto para la ficha. view = null si la build no tiene equipo cargado.
  function load(id, opts) {
    return gearOf(id, opts).then(function (e) {
      if (!e) return { entry: null, view: null };
      return refs(e, opts).then(function (R) { return { entry: e, view: sheet(e, R) }; });
    });
  }

  var api = { version: VERSION, GEAR: GEAR, ATTR: ATTR, load: load, loadGear: loadGear, gearOf: gearOf, refs: refs, sheet: sheet, ids: ids,
    clean: clean, normItem: normItem, normStat: normStat, normAmulet: normAmulet, statLabel: statLabel, attrName: attrName, weaponName: weaponName,
    meta: function () { return st.meta || null; },
    _test: { reset: function () { st = { gear: null, gearP: null, cache: null, inflight: {} }; } } };
  root.GNBldItems = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
