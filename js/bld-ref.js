/*!
 * js/bld-ref.js — Builds: datos del juego para leer y armar builds (BL-082 BLD-3)
 * Versión: 1.2.0 (2026-10-28) · BUI-1: identity() = las 9 profesiones y sus élites con nombre, ícono e ícono grande
 *          oficiales (un pedido, guardado por versión del juego); la ficha guarda el emblema de cada élite · antes 1.1.0:
 *          si llega una página web en vez de datos, reintento sin caché del navegador y el error
 *          dice qué pedido falló (Pablo lo vio en la Biblioteca y el Editor) · antes 1.0.0
 *
 * Trae de la API oficial (sin Key, en castellano) lo que hace falta para una profesión:
 *   /v2/professions/<P>?v=latest (paletas de habilidades, armas, habilidades de la barra),
 *   /v2/specializations, /v2/traits, /v2/skills, y además /v2/pets (Guardabosques) o /v2/legends (Retornado).
 * Lo guarda por profesión y por versión del juego (/v2/build) en GNIdb (IndexedDB) o, si no está, en memoria:
 * la segunda vez no pide nada hasta que salga un parche.
 * resolve(build, ref) pasa de números a nombres e íconos; check(build, ref) valida contra la API (D3):
 * especializaciones de la profesión, élite solo en la tercera línea, rasgos elegidos, habilidades de la paleta
 * en su casillero, armas de la profesión, mascotas y leyendas que existen.
 */
(function (root) {
  'use strict';

  var VERSION = '1.2.0';
  var API = 'https://api.guildwars2.com';
  var LANG = 'es';
  var KEY = 'gn:bld:ref:';
  var TIMEOUT = 30000; // la API a veces tarda: 30 s y un reintento antes de rendirse
  var CHUNK = 150;
  var PROFS = ['', 'Guardian', 'Warrior', 'Engineer', 'Ranger', 'Thief', 'Elementalist', 'Mesmer', 'Necromancer', 'Revenant'];
  var SLOT_TYPE = ['Heal', 'Utility', 'Utility', 'Utility', 'Elite'];
  var REF_V = 2; // 1.2.0: el ref guarda también el emblema de cada élite (lo de v1 se vuelve a pedir una vez)
  var IDKEY = 'gn:bld:id:';
  var mem = {}, inflight = {}, buildInfo = { id: null, at: 0 }, ident = null, identInflight = null;

  function profName(p) { return typeof p === 'number' ? PROFS[p] : String(p || ''); }
  function profCode(name) { var i = PROFS.indexOf(name); return i > 0 ? i : 0; }

  // ---------------------------------------------------------------- red
  function getJSON(url, f) {
    return getOnce(url, f).catch(function (e) {
      if (/respondió (4\d\d)/.test(String(e && e.message))) throw e; // un 404 no mejora al reintentar
      return getOnce(bust(url), f, true); // 1.1.0: el segundo intento va sin caché del navegador
    });
  }
  // 1.1.0: el reintento lleva una marca para que el navegador no devuelva lo que tenga guardado.
  function bust(url) { return url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(); }
  // Qué pedido falló, sin la lista de ids: «/v2/skills», «/v2/professions/Engineer».
  function where(url) { var m = /\/v2\/[a-z/]+/i.exec(String(url)); return m ? m[0] : 'la API'; }
  function getOnce(url, f, fresh) {
    f = f || root.fetch;
    if (typeof f !== 'function') return Promise.reject(new Error('Sin conexión con la API del juego.'));
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var o = {};
    if (ctl) o.signal = ctl.signal;
    if (fresh) o.cache = 'no-store';
    return Promise.resolve(f(url, o)).then(function (r) {
      if (t) clearTimeout(t);
      if (!r || (!r.ok && r.status !== 206)) throw new Error('La API del juego respondió ' + (r ? r.status : 'nada') + ' en ' + where(url) + '.');
      if (typeof r.text !== 'function') return r.json();
      return r.text().then(function (s) {
        // A veces llega una página web (HTML) en lugar de datos: lo digo claro y el segundo intento va sin caché.
        if (/^\s*</.test(s)) throw new Error('en lugar de datos llegó una página web desde ' + where(url) + (fresh ? ', también sin caché' : ''));
        return JSON.parse(s);
      });
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function many(path, ids, f) {
    ids = uniq(ids).filter(function (x) { return x != null && x !== 0 && x !== ''; });
    var parts = [];
    for (var i = 0; i < ids.length; i += CHUNK) parts.push(ids.slice(i, i + CHUNK));
    return Promise.all(parts.map(function (p) {
      return getJSON(API + path + (path.indexOf('?') < 0 ? '?' : '&') + 'ids=' + p.join(',') + '&lang=' + LANG, f);
    })).then(function (rs) { return [].concat.apply([], rs.map(function (r) { return Array.isArray(r) ? r : []; })); });
  }
  function uniq(a) { var s = {}, o = []; (a || []).forEach(function (x) { var k = String(x); if (!s[k]) { s[k] = 1; o.push(x); } }); return o; }

  function gameBuild(f) {
    if (buildInfo.id && Date.now() - buildInfo.at < 3600e3) return Promise.resolve(buildInfo.id);
    return getJSON(API + '/v2/build', f).then(function (b) { buildInfo = { id: b && b.id, at: Date.now() }; return buildInfo.id; },
      function () { return buildInfo.id || 0; });
  }

  // ---------------------------------------------------------------- normalizar (puro)
  // raw = { prof, specs, traits, skills, pets?, legends? } tal como los devuelve la API → ref compacto.
  function normalize(raw) {
    var p = raw.prof || {};
    var palette = {}, bySkill = {};
    (p.skills_by_palette || []).forEach(function (pr) {
      if (!Array.isArray(pr) || pr.length < 2) return;
      if (palette[pr[0]] == null) palette[pr[0]] = pr[1];
      if (bySkill[pr[1]] == null) bySkill[pr[1]] = pr[0];
    });
    var traits = {};
    (raw.traits || []).forEach(function (t) {
      traits[t.id] = { id: t.id, name: t.name, icon: t.icon, description: t.description || '', tier: t.tier, order: t.order, slot: t.slot, spec: t.specialization };
    });
    var skills = {};
    (raw.skills || []).forEach(function (s) {
      skills[s.id] = { id: s.id, name: s.name, icon: s.icon, description: s.description || '', slot: s.slot || '', type: s.type || '',
        spec: s.specialization || 0, categories: s.categories || [] };
    });
    var specs = (raw.specs || []).map(function (s) {
      var maj = (s.major_traits || []).slice(), tiers = [[], [], []];
      maj.forEach(function (id) { var t = traits[id]; var tier = t ? t.tier : 0; if (tier >= 1 && tier <= 3) tiers[tier - 1].push(id); });
      tiers.forEach(function (l) { l.sort(function (a, b) { return ((traits[a] || {}).order || 0) - ((traits[b] || {}).order || 0); }); });
      return { id: s.id, name: s.name, elite: !!s.elite, icon: s.icon, background: s.background, minor: s.minor_traits || [], major: tiers,
        profIcon: s.profession_icon || '', profIconBig: s.profession_icon_big || '',
        weaponTrait: s.weapon_trait || 0 };
    });
    var bar = { Heal: [], Utility: [], Elite: [] };
    (p.skills || []).forEach(function (s) { if (bar[s.type]) bar[s.type].push({ id: s.id, spec: s.specialization || 0 }); });
    var weapons = {};
    Object.keys(p.weapons || {}).forEach(function (w) { var x = p.weapons[w] || {}; weapons[w] = { spec: x.specialization || 0, flags: x.flags || [] }; });
    var pets = (raw.pets || []).map(function (x) { return { id: x.id, name: x.name, icon: x.icon }; });
    var legends = (raw.legends || []).map(function (l) {
      return { id: l.id, code: l.code, swap: l.swap, heal: l.heal, elite: l.elite, utilities: l.utilities || [], name: (skills[l.swap] || {}).name || l.id, icon: (skills[l.swap] || {}).icon || '' };
    });
    return { v: REF_V, profession: profCode(p.id), name: p.name, icon: p.icon, iconBig: p.icon_big, palette: palette, bySkill: bySkill,
      specs: specs, traits: traits, skills: skills, bar: bar, weapons: weapons, pets: pets, legends: legends };
  }

  // ---------------------------------------------------------------- carga por profesión
  function store() { return root.GNIdb && typeof root.GNIdb.get === 'function' ? root.GNIdb : null; }

  function fetchRaw(name, f) {
    var raw = {};
    return getJSON(API + '/v2/professions/' + encodeURIComponent(name) + '?v=latest&lang=' + LANG, f).then(function (p) {
      raw.prof = p;
      return many('/v2/specializations', p.specializations || [], f);
    }).then(function (specs) {
      raw.specs = specs;
      var tids = [];
      specs.forEach(function (s) { tids = tids.concat(s.minor_traits || [], s.major_traits || []); });
      var sids = (raw.prof.skills || []).map(function (s) { return s.id; })
        .concat((raw.prof.skills_by_palette || []).map(function (x) { return x[1]; }));
      var extra = name === 'Ranger' ? getJSON(API + '/v2/pets?ids=all&lang=' + LANG, f)
        : name === 'Revenant' ? getJSON(API + '/v2/legends?ids=all&v=latest', f) : Promise.resolve(null);
      return Promise.all([many('/v2/traits', tids, f), extra]).then(function (r) {
        raw.traits = r[0];
        if (name === 'Ranger') raw.pets = r[1] || [];
        if (name === 'Revenant') {
          raw.legends = r[1] || [];
          raw.legends.forEach(function (l) { sids = sids.concat([l.swap, l.heal, l.elite], l.utilities || []); });
        }
        return many('/v2/skills', sids, f);
      });
    }).then(function (skills) { raw.skills = skills; return raw; });
  }

  // load(1..9 o 'Guardian') → Promise<ref>. opts: { fetch, force }
  function load(prof, opts) {
    opts = opts || {};
    var name = profName(prof);
    if (!profCode(name)) return Promise.reject(new Error('Profesión desconocida: ' + prof));
    var f = opts.fetch;
    return gameBuild(f).then(function (bid) {
      var key = KEY + LANG + ':' + name + ':' + (bid || 0);
      if (!opts.force && mem[key]) return mem[key];
      var S = store();
      var ready = S && typeof S.ready === 'function' ? S.ready() : Promise.resolve();
      return Promise.resolve(ready).then(function () {
        if (!opts.force && S) { var c = S.get(key); if (c && c.v === REF_V && c.profession) { mem[key] = c; return c; } }
        if (inflight[key]) return inflight[key];
        inflight[key] = fetchRaw(name, f).then(function (raw) {
          var ref = normalize(raw);
          ref.gameBuild = bid || 0;
          mem[key] = ref;
          if (S) { try { S.set(key, ref); prune(S, name, key); } catch (_) {} }
          delete inflight[key];
          return ref;
        }, function (e) { delete inflight[key]; throw e; });
        return inflight[key];
      });
    });
  }
  // Deja una sola versión por profesión: lo del parche anterior no se vuelve a leer.
  function prune(S, name, keep) {
    if (typeof S.keys !== 'function') return;
    S.keys().forEach(function (k) { if (k.indexOf(KEY + LANG + ':' + name + ':') === 0 && k !== keep) S.del(k); });
  }

  // ---------------------------------------------------------------- identidad: profesiones y élites (BUI-1)
  // profs = /v2/professions?ids=all, specs = sus /v2/specializations → { v, profs: { 1..9 }, elites: { id } } con los íconos
  // oficiales: el de la profesión (icon, icon_big) y, por élite, su emblema (profession_icon, profession_icon_big).
  function normalizeIdentity(profs, specs) {
    var byId = {}, out = { v: 1, profs: {}, elites: {} };
    (specs || []).forEach(function (s) { if (s && s.id) byId[s.id] = s; });
    (profs || []).forEach(function (p) {
      var code = profCode(p && p.id);
      if (!code) return;
      var elites = (p.specializations || []).map(function (id) { return byId[id]; }).filter(function (s) { return s && s.elite; });
      elites.forEach(function (s) {
        out.elites[s.id] = { id: s.id, name: s.name, prof: code, icon: s.profession_icon || s.icon || '',
          iconBig: s.profession_icon_big || s.profession_icon || s.icon || '', specIcon: s.icon || '', background: s.background || '' };
      });
      out.profs[code] = { code: code, id: p.id, name: p.name, icon: p.icon || '', iconBig: p.icon_big || p.icon || '',
        elites: elites.map(function (s) { return s.id; }) };
    });
    return out;
  }
  // identity(opts) → Promise<identidad>. Un pedido de profesiones y uno de especializaciones; se guarda por versión del juego.
  function identity(opts) {
    opts = opts || {};
    var f = opts.fetch;
    return gameBuild(f).then(function (bid) {
      var key = IDKEY + LANG + ':' + (bid || 0);
      if (!opts.force && ident && ident.key === key) return ident;
      var S = store();
      var ready = S && typeof S.ready === 'function' ? S.ready() : Promise.resolve();
      return Promise.resolve(ready).then(function () {
        if (!opts.force && S) { var c = S.get(key); if (c && c.v === 1 && c.profs && c.profs[1]) { ident = c; return c; } }
        if (identInflight) return identInflight;
        identInflight = getJSON(API + '/v2/professions?ids=all&v=latest&lang=' + LANG, f).then(function (profs) {
          var ids = [];
          (profs || []).forEach(function (p) { ids = ids.concat(p.specializations || []); });
          return many('/v2/specializations', ids, f).then(function (specs) {
            var x = normalizeIdentity(profs, specs);
            x.key = key; x.gameBuild = bid || 0;
            ident = x; identInflight = null;
            if (S) { try { S.set(key, x); pruneIdent(S, key); } catch (_) {} }
            return x;
          });
        }).then(null, function (e) { identInflight = null; throw e; });
        return identInflight;
      });
    });
  }
  function identitySync() { return ident; }
  function pruneIdent(S, keep) {
    if (typeof S.keys !== 'function') return;
    S.keys().forEach(function (k) { if (k.indexOf(IDKEY + LANG + ':') === 0 && k !== keep) S.del(k); });
  }

  // ---------------------------------------------------------------- de números a nombres (puro)
  function specById(ref, id) { for (var i = 0; i < ref.specs.length; i++) if (ref.specs[i].id === id) return ref.specs[i]; return null; }
  function traitChoice(spec, tier, choice) { return spec && choice >= 1 && choice <= 3 ? (spec.major[tier] || [])[choice - 1] || 0 : 0; }
  function choiceOf(spec, tier, traitId) { var i = spec ? (spec.major[tier] || []).indexOf(traitId) : -1; return i < 0 ? 0 : i + 1; }
  // Para el Retornado, la paleta depende de la leyenda: si la API lo resuelve distinto, gana la leyenda.
  function skillOf(ref, pid) { var id = ref.palette[pid]; return id ? (ref.skills[id] || { id: id, name: '#' + id, icon: '' }) : null; }

  function resolve(b, ref) {
    var out = { profession: b.profession, profName: ref.name, profIcon: ref.icon, profIconBig: ref.iconBig || ref.icon, specs: [], land: [], water: [], pets: null, legends: null, weapons: [], overrides: [] };
    (b.specs || []).forEach(function (s) {
      var sp = specById(ref, s.id);
      out.specs.push({ id: s.id, name: sp ? sp.name : (s.id ? '#' + s.id : ''), icon: sp ? sp.icon : '', background: sp ? sp.background : '', elite: !!(sp && sp.elite),
        profIcon: sp ? sp.profIcon || '' : '', profIconBig: sp ? sp.profIconBig || '' : '',
        traits: [0, 1, 2].map(function (tier) { var tid = traitChoice(sp, tier, s.traits[tier]); var t = ref.traits[tid]; return t ? { id: tid, name: t.name, icon: t.icon, description: t.description } : null; }),
        minor: sp ? sp.minor.map(function (id) { var t = ref.traits[id]; return t ? { id: id, name: t.name, icon: t.icon } : null; }).filter(Boolean) : [] });
    });
    ['land', 'water'].forEach(function (bar) {
      ((b.skills && b.skills[bar]) || []).forEach(function (pid) { out[bar].push(pid ? skillOf(ref, pid) : null); });
    });
    if (b.pets) {
      var pet = function (id) { for (var i = 0; i < ref.pets.length; i++) if (ref.pets[i].id === id) return ref.pets[i]; return id ? { id: id, name: '#' + id } : null; };
      out.pets = { land: b.pets.land.map(pet), water: b.pets.water.map(pet) };
    }
    if (b.legends) {
      var leg = function (code) { for (var i = 0; i < ref.legends.length; i++) if (ref.legends[i].code === code) return ref.legends[i]; return code ? { code: code, name: '#' + code } : null; };
      out.legends = { land: b.legends.land.map(leg), water: b.legends.water.map(leg) };
    }
    out.weapons = (b.weapons || []).map(function (w) { var C = root.GNBldCode; var en = C && C.WEAPONS[w]; return { id: w, name: en ? (C.WEAPONS_ES[en] || en) : '#' + w, key: en || '' }; });
    out.overrides = (b.overrides || []).map(function (id) { return ref.skills[id] || { id: id, name: '#' + id }; });
    return out;
  }

  // ---------------------------------------------------------------- validación contra la API (D3, puro)
  function check(b, ref) {
    var out = [];
    if (b.profession !== ref.profession) out.push({ level: 'err', msg: 'El código es de otra profesión.' });
    (b.specs || []).forEach(function (s, i) {
      if (!s.id) { out.push({ level: 'warn', msg: 'La línea ' + (i + 1) + ' está vacía.' }); return; }
      var sp = specById(ref, s.id);
      if (!sp) { out.push({ level: 'err', msg: 'La especialización #' + s.id + ' no es de ' + ref.name + '.' }); return; }
      if (sp.elite && i !== 2) out.push({ level: 'err', msg: sp.name + ' es élite: va en la tercera línea.' });
      s.traits.forEach(function (c, tier) { if (!c) out.push({ level: 'warn', msg: sp.name + ': falta elegir el rasgo ' + ['adepto', 'maestro', 'gran maestro'][tier] + '.' }); });
    });
    var elite = (b.specs && b.specs[2] && specById(ref, b.specs[2].id)) || null;
    var eliteId = elite && elite.elite ? elite.id : 0;
    if (b.profession !== 9) {
      ['land', 'water'].forEach(function (bar) {
        ((b.skills && b.skills[bar]) || []).forEach(function (pid, slot) {
          if (!pid) { if (bar === 'land') out.push({ level: 'warn', msg: 'Falta la habilidad de ' + ['curación', 'utilidad 1', 'utilidad 2', 'utilidad 3', 'élite'][slot] + '.' }); return; }
          var sid = ref.palette[pid];
          if (!sid) { out.push({ level: 'err', msg: 'La habilidad ' + pid + ' no está en la paleta de ' + ref.name + '.' }); return; }
          var sk = ref.skills[sid];
          var want = SLOT_TYPE[slot];
          var listed = (ref.bar[want] || []).filter(function (x) { return x.id === sid; })[0];
          if (!listed) out.push({ level: 'err', msg: (sk ? sk.name : '#' + sid) + ' no va en ese casillero.' });
          else if (listed.spec && listed.spec !== eliteId) out.push({ level: 'err', msg: (sk ? sk.name : '#' + sid) + ' necesita la especialización ' + ((specById(ref, listed.spec) || {}).name || '#' + listed.spec) + '.' });
        });
      });
    }
    (b.weapons || []).forEach(function (w) {
      var C = root.GNBldCode, key = C && C.WEAPONS[w];
      var x = key && ref.weapons[key];
      if (!x) out.push({ level: 'err', msg: 'El arma ' + (key ? (C.WEAPONS_ES[key] || key) : '#' + w) + ' no es de ' + ref.name + '.' });
      else if (x.spec && x.spec !== eliteId) out.push({ level: 'warn', msg: (C.WEAPONS_ES[key] || key) + ' necesita ' + ((specById(ref, x.spec) || {}).name || 'otra especialización') + '.' });
    });
    if (b.pets && ref.pets.length) {
      b.pets.land.concat(b.pets.water).forEach(function (id) { if (id && !ref.pets.some(function (p) { return p.id === id; })) out.push({ level: 'err', msg: 'La mascota #' + id + ' no existe.' }); });
    }
    if (b.legends && ref.legends.length) {
      b.legends.land.concat(b.legends.water).forEach(function (c) { if (c && !ref.legends.some(function (l) { return l.code === c; })) out.push({ level: 'err', msg: 'La leyenda #' + c + ' no existe.' }); });
    }
    return out;
  }

  var api = {
    version: VERSION, PROFS: PROFS, load: load, normalize: normalize, resolve: resolve, check: check,
    identity: identity, identitySync: identitySync, normalizeIdentity: normalizeIdentity,
    specById: specById, traitChoice: traitChoice, choiceOf: choiceOf, skillOf: skillOf, profCode: profCode, profName: profName,
    _test: { reset: function () { mem = {}; inflight = {}; buildInfo = { id: null, at: 0 }; ident = null; identInflight = null; } }
  };
  root.GNBldRef = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
