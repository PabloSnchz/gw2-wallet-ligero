/*!
 * js/bld-editor.js — Builds: pestaña Editor (BL-082 BLD-5: B1, B2, B3, B5, B6 y C2)
 * Versión: 1.3.0 (2026-10-29) · BUI-5: contraste AA en los 19 temas (lo elegido sobre --bg-0 al 14 %, la profesión sin
 *          elegir se atenúa solo en el ícono) y rótulos de la barra a .7rem · antes 1.2.0 BUI-3: como el panel del
 *          juego: profesiones con su ícono, cada línea con el fondo
 *          oficial de su especialización y los rasgos como íconos (menores incluidos), barra de 5 casilleros con
 *          ícono que abren un selector, y la barra del Retornado a la vista · antes 1.1.0 BLD-12/13 (equipo y AE2)
 *
 * Elegís profesión, las 3 líneas (la élite solo en la tercera), los 3 rasgos de cada una, la barra de tierra
 * (y la de agua), mascotas o leyendas y armas; a la derecha ves la ficha y el código del juego al instante
 * (todo local: < 200 ms). Los datos salen de js/bld-ref.js (API oficial en castellano) y el código de js/bld-code.js.
 * Abre un código (#/builds/editor/<código>) o una build tuya (#/builds/editor/m:<id>) para editarla.
 * Teclado: todo son botones y listas nativas; cada rasgo dice su nombre y si está elegido (aria-pressed); el selector
 * de habilidades se cierra con Escape y devuelve el foco a su casillero.
 */
(function (root) {
  'use strict';

  var VERSION = '1.3.0';
  var TIER = ['Adepto', 'Maestro', 'Gran maestro'];
  var SLOT = ['Curación', 'Utilidad 1', 'Utilidad 2', 'Utilidad 3', 'Élite'];
  var SLOT_TYPE = ['Heal', 'Utility', 'Utility', 'Utility', 'Elite'];
  var BAR = { land: 'Barra', water: 'Bajo el agua' };
  var st = { build: null, ref: null, loading: false, error: '', title: '', mineId: '', lastArg: null, req: 0, gear: null, pick: null };

  function C() { return root.GNBldCode; }
  function esc(s) { return root.GNBldShow ? root.GNBldShow.esc(s) : String(s == null ? '' : s); }
  function img(src, size) { return root.GNBldShow ? root.GNBldShow.img(src, '', size, 'bld-ic') : ''; }
  function plain(s) { return root.GNBldShow ? root.GNBldShow.plain(s) : String(s || ''); }
  function ident() { var R = root.GNBldRef; return R && typeof R.identitySync === 'function' ? R.identitySync() : null; }
  // Solo fondos oficiales (render.guildwars2.com) entran en un style.
  function bgStyle(url) { return /^https:\/\/render\.guildwars2\.com\/[\w\/.-]+$/.test(url || '') ? ' style="background-image:url(\'' + url + '\')"' : ''; }

  // ---------------------------------------------------------------- modelo (puro)
  function eliteId(b, ref) { var s = b.specs[2] && ref && root.GNBldRef.specById(ref, b.specs[2].id); return s && s.elite ? s.id : 0; }
  // Habilidades que puede ir en ese casillero con esa élite: [{ pid, id, name, icon }]
  function options(ref, slot, elite) {
    var type = SLOT_TYPE[slot];
    return (ref.bar[type] || []).filter(function (x) { return !x.spec || x.spec === elite; }).map(function (x) {
      var s = ref.skills[x.id] || {};
      return { pid: ref.bySkill[x.id] || 0, id: x.id, name: s.name || '#' + x.id, icon: s.icon || '' };
    }).filter(function (o) { return o.pid; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
  }
  // Al cambiar la élite, lo que ya no corresponde se vacía (habilidades y armas de la élite anterior).
  function prune(b, ref) {
    var el = eliteId(b, ref);
    ['land', 'water'].forEach(function (bar) {
      b.skills[bar] = b.skills[bar].map(function (pid, i) {
        if (!pid || b.profession === 9) return pid;
        return options(ref, i, el).some(function (o) { return o.pid === pid; }) ? pid : 0;
      });
    });
    var Cc = C();
    b.weapons = b.weapons.filter(function (w) { var k = Cc.WEAPONS[w], x = k && ref.weapons[k]; return x && (!x.spec || x.spec === el); });
    return b;
  }
  // Retornado: la barra la ponen las leyendas (curación, 3 utilidades y élite de la leyenda activa).
  function legendBar(b, ref) {
    if (b.profession !== 9 || !b.legends) return b;
    var leg = function (code) { return ref.legends.filter(function (l) { return l.code === code; })[0]; };
    var pid = function (id) { return ref.bySkill[id] || 0; };
    ['land', 'water'].forEach(function (bar) {
      var a = leg(b.legends[bar][0]), z = leg(b.legends[bar][1]);
      b.skills[bar] = a ? [pid(a.heal)].concat(a.utilities.map(pid), [pid(a.elite)]) : [0, 0, 0, 0, 0];
      b.legends[bar === 'land' ? 'inactiveLand' : 'inactiveWater'] = z ? z.utilities.map(pid) : [0, 0, 0];
    });
    return b;
  }
  function setSpec(b, ref, line, id) {
    b.specs[line] = { id: Number(id) || 0, traits: [0, 0, 0] };
    return prune(b, ref);
  }
  function setTrait(b, line, tier, choice) { b.specs[line].traits[tier] = b.specs[line].traits[tier] === choice ? 0 : choice; return b; }
  function toggleWeapon(b, id) {
    var i = b.weapons.indexOf(id);
    if (i >= 0) b.weapons.splice(i, 1); else if (b.weapons.length < 8) b.weapons.push(id);
    return b;
  }
  function fresh(prof) { var b = C().empty(prof); if (prof === 9) b.legends = { land: [0, 0], water: [0, 0], inactiveLand: [0, 0, 0], inactiveWater: [0, 0, 0] }; return b; }

  // ---------------------------------------------------------------- vista
  function profHTML(b) {
    var Cc = C(), id = ident(), S = root.GNBldShow;
    return '<fieldset class="bld-ed-prof"><legend>Profesión</legend>' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (p) {
      var name = (id && id.profs[p] && id.profs[p].name) || Cc.PROF_ES[p];
      return '<button type="button" class="bld-ed-pf" data-ed="prof" data-v="' + p + '" aria-pressed="' + (b.profession === p) + '" title="' + esc(name) + '">' +
        (id && S && S.emblem ? S.emblem(p, 0, 30) : '') + '<span>' + esc(name) + '</span></button>';
    }).join('') + '</fieldset>';
  }
  // Un rasgo como ícono: el nombre lo dice el lector (aria-label) y el título; la descripción va en el título.
  function traitBtn(ref, line, tier, k, tid, on) {
    var t = ref.traits[tid] || {}, name = t.name || '#' + tid, d = plain(t.description);
    return '<button type="button" class="bld-ed-tr" id="bldEdTr' + line + tier + k + '" data-ed="trait" data-line="' + line + '" data-tier="' + tier + '" data-v="' + (k + 1) +
      '" aria-pressed="' + on + '" aria-label="' + esc(name) + '" title="' + esc(name + (d ? ': ' + d : '')) + '">' + img(t.icon, 36) + '<span class="bld-sr">' + esc(name) + '</span></button>';
  }
  function minorHTML(ref, tid) {
    var t = ref.traits[tid];
    return t ? '<span class="bld-ed-mn" title="' + esc(t.name + (t.description ? ': ' + plain(t.description) : '')) + '">' + img(t.icon, 26) + '</span>' : '';
  }
  function specLineHTML(b, ref, line) {
    var cur = b.specs[line], sp = cur.id ? root.GNBldRef.specById(ref, cur.id) : null;
    var used = b.specs.map(function (s) { return s.id; });
    var opts = ref.specs.filter(function (s) { return (line === 2 || !s.elite) && (s.id === cur.id || used.indexOf(s.id) < 0); })
      .sort(function (a, z) { return (a.elite - z.elite) || a.name.localeCompare(z.name, 'es'); });
    var h = '<div class="bld-ed-line' + (sp ? ' has-spec' : '') + (sp && sp.elite ? ' is-elite' : '') + '"' + (sp ? bgStyle(sp.background) : '') + '>' +
      '<div class="bld-ed-lh">' + (sp ? img(sp.icon, 40) : '<span class="bld-ed-lnum" aria-hidden="true">' + (line + 1) + '</span>') +
      '<label for="bldEdSpec' + line + '"><small>Línea ' + (line + 1) + (line === 2 ? ' · acá va la élite' : '') + '</small>' +
      '<select id="bldEdSpec' + line + '" data-ed="spec" data-line="' + line + '"><option value="0">— elegí —</option>' + opts.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === cur.id ? ' selected' : '') + '>' + esc(s.name) + (s.elite ? ' (élite)' : '') + '</option>';
      }).join('') + '</select></label></div>';
    if (sp) {
      h += '<div class="bld-ed-tiers">' + [0, 1, 2].map(function (tier) {
        return minorHTML(ref, sp.minor[tier]) + '<div class="bld-ed-tier" role="group" aria-label="' + esc(sp.name) + ', ' + TIER[tier] + '">' +
          (sp.major[tier] || []).map(function (tid, k) { return traitBtn(ref, line, tier, k, tid, cur.traits[tier] === k + 1); }).join('') + '</div>';
      }).join('') + '</div>';
      var picked = [0, 1, 2].map(function (tier) {
        var tid = root.GNBldRef.traitChoice(sp, tier, cur.traits[tier]), t = ref.traits[tid];
        return t ? esc(t.name) : '<span class="bld-muted">' + TIER[tier] + ': sin elegir</span>';
      });
      h += '<p class="bld-ed-picked">' + picked.join(' · ') + '</p>';
    }
    return h + '</div>';
  }
  // Barra: 5 casilleros con el ícono de la habilidad; tocar uno abre el selector debajo (st.pick).
  function skillOf(ref, pid) { return pid ? root.GNBldRef.skillOf(ref, pid) : null; }
  function barHTML(b, ref, bar) {
    if (b.profession === 9) return legendBarHTML(b, ref, bar);
    var el = eliteId(b, ref), pick = st.pick && st.pick.bar === bar ? st.pick.slot : -1;
    var h = '<div class="bld-ed-bar" role="group" aria-label="' + BAR[bar] + '">' + [0, 1, 2, 3, 4].map(function (i) {
      var s = skillOf(ref, b.skills[bar][i]), open = pick === i;
      return '<button type="button" class="bld-ed-sk' + (i === 0 ? ' is-heal' : i === 4 ? ' is-elite' : '') + (s ? '' : ' is-empty') + '" id="bldEdSk' + bar + i + '" data-ed="slot" data-bar="' + bar + '" data-slot="' + i + '"' +
        ' aria-haspopup="true" aria-expanded="' + open + '" aria-label="' + SLOT[i] + ': ' + esc(s ? s.name : 'vacío') + '" title="' + esc(s ? s.name + (s.description ? ': ' + plain(s.description) : '') : SLOT[i] + ': vacío') + '">' +
        (s ? img(s.icon, 44) : '<span class="bld-ed-plus" aria-hidden="true">+</span>') + '<small>' + SLOT[i] + '</small></button>';
    }).join('') + '</div>';
    if (pick >= 0) h += pickHTML(b, ref, bar, pick, el);
    return h;
  }
  function pickHTML(b, ref, bar, slot, el) {
    var cur = b.skills[bar][slot], opts = options(ref, slot, el);
    return '<div class="bld-ed-pick" role="group" aria-label="Elegí ' + SLOT[slot].toLowerCase() + '" data-ed-pick>' +
      '<div class="bld-ed-pick-h"><b>' + SLOT[slot] + '</b> <small class="bld-muted">' + opts.length + ' opciones · Escape para cerrar</small></div><div class="bld-ed-pick-l">' +
      opts.map(function (o, k) {
        var s = ref.skills[o.id] || {};
        return '<button type="button" class="bld-ed-opt" id="bldEdOpt' + k + '" data-ed="pick" data-v="' + o.pid + '" aria-pressed="' + (o.pid === cur) + '" title="' + esc(plain(s.description)) + '">' +
          img(o.icon, 32) + '<span>' + esc(o.name) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="bld-ed-pick-a"><button type="button" class="bld-btn" data-ed="pick" data-v="0">Dejar vacío</button><button type="button" class="bld-btn" data-ed="pick-close">Cerrar</button></div></div>';
  }
  // Retornado: la barra la ponen las leyendas; se muestra para ver qué quedó, sin elegir.
  function legendBarHTML(b, ref, bar) {
    if (!b.skills[bar].some(Boolean)) return '';
    return '<div class="bld-ed-bar is-ro" role="group" aria-label="' + BAR[bar] + ' (la ponen las leyendas)">' + [0, 1, 2, 3, 4].map(function (i) {
      var s = skillOf(ref, b.skills[bar][i]);
      return '<span class="bld-ed-sk' + (i === 0 ? ' is-heal' : i === 4 ? ' is-elite' : '') + '" title="' + esc(s ? s.name : '') + '">' + (s ? img(s.icon, 44) : '') + '<small>' + SLOT[i] + '</small></span>';
    }).join('') + '</div>';
  }
  function petsHTML(b, ref) {
    if (b.profession !== 4 || !b.pets) return '';
    var sel = function (bar, i, label) {
      var id = 'bldEdPet' + bar + i, cur = b.pets[bar][i];
      return '<label for="' + id + '"><small>' + label + '</small><select id="' + id + '" data-ed="pet" data-bar="' + bar + '" data-i="' + i + '"><option value="0">—</option>' +
        ref.pets.slice().sort(function (a, z) { return a.name.localeCompare(z.name, 'es'); }).map(function (p) { return '<option value="' + p.id + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label>';
    };
    return '<fieldset class="bld-ed-bar"><legend>Mascotas</legend>' + sel('land', 0, 'Tierra 1') + sel('land', 1, 'Tierra 2') + sel('water', 0, 'Agua 1') + sel('water', 1, 'Agua 2') + '</fieldset>';
  }
  function legendsHTML(b, ref) {
    if (b.profession !== 9 || !b.legends) return '';
    var el = eliteId(b, ref);
    var ok = ref.legends.filter(function (l) { return [5, 7, 8].indexOf(l.code) < 0 || (l.code === 5 && el === 63) || (l.code === 7 && el === 69) || (l.code === 8 && el === 79); });
    var sel = function (bar, i, label) {
      var id = 'bldEdLeg' + bar + i, cur = b.legends[bar][i];
      return '<label for="' + id + '"><small>' + label + '</small><select id="' + id + '" data-ed="legend" data-bar="' + bar + '" data-i="' + i + '"><option value="0">—</option>' +
        ok.map(function (l) { return '<option value="' + l.code + '"' + (l.code === cur ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label>';
    };
    return '<fieldset class="bld-ed-bar"><legend>Leyendas (ponen la barra)</legend>' + sel('land', 0, 'Activa') + sel('land', 1, 'Otra') + sel('water', 0, 'Agua activa') + sel('water', 1, 'Agua otra') + '</fieldset>';
  }
  function weaponsHTML(b, ref) {
    var Cc = C(), el = eliteId(b, ref);
    var ids = Object.keys(Cc.WEAPONS).map(Number).filter(function (w) { var x = ref.weapons[Cc.WEAPONS[w]]; return x && (!x.spec || x.spec === el); });
    return '<fieldset class="bld-ed-weap"><legend>Armas <small class="bld-muted">(hasta 8; van en el código desde 2023)</small></legend>' + ids.map(function (w) {
      var on = b.weapons.indexOf(w) >= 0, k = Cc.WEAPONS[w];
      return '<button type="button" class="bld-btn" data-ed="weapon" data-v="' + w + '" aria-pressed="' + on + '">' + esc(Cc.WEAPONS_ES[k] || k) + '</button>';
    }).join('') + '</fieldset>';
  }
  function previewHTML(b, ref) {
    var code = '', err = '';
    try { code = C().encode(b); } catch (e) { err = e.message; }
    var v = root.GNBldRef.resolve(b, ref), checks = root.GNBldRef.check(b, ref).concat(C().problems(b).map(function (p) {
      return { level: 'err', msg: p.code === 'DUP_SKILL' ? 'La misma habilidad está dos veces en la barra: el juego no lo acepta.' : 'Especialización repetida.' };
    }));
    return '<div class="bld-ed-prev"><label for="bldEdTitle"><small>Nombre</small></label><input id="bldEdTitle" data-ed="title" maxlength="80" value="' + esc(st.title) + '" placeholder="Mi build">' +
      (err ? '<p class="bld-err">' + esc(err) + '</p>' : root.GNBldShow.detailHTML(v, { code: code, checks: checks, title: st.title || null,
        actions: ['copy', 'share', 'gw2skills', 'save'] })) +
      (st.mineId ? '<p class="bld-muted">Editando una build de Mis builds: «Guardar» actualiza esa misma.</p>' : '') + (err ? '' : gearHTML(b, code)) + '</div>';
  }
  // BLD-12/13: equipo, sugerencia y AE2 (si js/bld-gear.js está cargado).
  function gearHTML(b, code) {
    var G = root.GNBldGear;
    if (!G || !code) return '';
    if (!st.gear) st.gear = G.fresh();
    return G.panelHTML(st.gear, (b.weapons || []).map(function (w) { return C().WEAPONS[w]; }).filter(Boolean), code);
  }
  function onGear(ctx, e) {
    var G = root.GNBldGear;
    if (!G || !st.gear || !e.target || !e.target.closest || !e.target.closest('[data-gear],[data-gear-box]')) return false;
    var code = '';
    try { code = C().encode(st.build); } catch (_) {}
    if (G.onEvent(e, st.gear, code, function () { paint(ctx); })) paint(ctx, e.target.id || '');
    return true;
  }

  function viewHTML() {
    var b = st.build;
    var left = profHTML(b);
    if (st.loading) left += '<div class="bld-card" role="status">Trayendo especializaciones, rasgos y habilidades del juego…</div>';
    else if (st.error) left += '<div class="bld-card bld-err" role="alert">' + esc(st.error) + ' <button type="button" class="bld-btn" data-ed="retry">Reintentar</button></div>';
    else if (st.ref) {
      left += '<h3 class="bld-ed-h">Especializaciones</h3>' + [0, 1, 2].map(function (l) { return specLineHTML(b, st.ref, l); }).join('') +
        legendsHTML(b, st.ref) + petsHTML(b, st.ref) +
        '<h3 class="bld-ed-h">Barra</h3>' + barHTML(b, st.ref, 'land') +
        (b.profession === 9 && !b.skills.water.some(Boolean) ? '' : '<details class="bld-ed-water"' + (st.pick && st.pick.bar === 'water' ? ' open' : '') + '><summary>Bajo el agua</summary>' + barHTML(b, st.ref, 'water') + '</details>') +
        weaponsHTML(b, st.ref) +
        '<p><button type="button" class="bld-btn" data-ed="reset">Empezar de cero</button></p>';
    }
    return '<div class="bld-ed"><div class="bld-ed-form">' + left + '</div>' + (st.ref && !st.loading ? previewHTML(b, st.ref) : '<div></div>') + '</div>';
  }

  var CSS = [
    '#buildsPanel .bld-ed{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,420px);gap:14px;align-items:start}',
    '@media (max-width:980px){#buildsPanel .bld-ed{grid-template-columns:1fr}}',
    '#buildsPanel .bld-ed fieldset{border:1px solid var(--bd-1);border-radius:10px;padding:8px;margin:0 0 10px;display:flex;flex-wrap:wrap;gap:6px}',
    '#buildsPanel .bld-ed fieldset.bld-ed-bar{display:grid}',
    '#buildsPanel .bld-ed legend,#buildsPanel .bld-ed-h{font-weight:700;color:var(--tx-1);font-size:.9rem;margin:6px 0}',
    '#buildsPanel .bld-ed [aria-pressed=true].bld-btn{border-color:var(--gn-mod);background:color-mix(in srgb,var(--gn-mod) 14%,var(--bg-0))}',
    '#buildsPanel .bld-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '#buildsPanel .bld-ed-pf{display:grid;justify-items:center;gap:2px;min-width:64px;padding:6px 4px;border:1px solid var(--bd-1);border-radius:10px;background:var(--bg-0);color:var(--tx-2);font:inherit;font-size:.7rem;cursor:pointer}',
    '#buildsPanel .bld-ed-pf .bld-emb{background:none;box-shadow:none;padding:0}',
    '#buildsPanel .bld-ed-pf img{opacity:.75}#buildsPanel .bld-ed-pf:hover img,#buildsPanel .bld-ed-pf:focus-visible img,#buildsPanel .bld-ed-pf[aria-pressed=true] img{opacity:1}',
    '#buildsPanel .bld-ed-pf[aria-pressed=true]{opacity:1;color:var(--tx-1);border-color:var(--gn-mod);box-shadow:0 0 0 1px var(--gn-mod);background:color-mix(in srgb,var(--gn-mod) 14%,var(--bg-0))}',
    '#buildsPanel .bld-ed-line{position:relative;border:1px solid var(--bd-1);border-radius:12px;padding:10px;margin-bottom:10px;background:var(--bg-1) center/cover no-repeat;overflow:hidden;isolation:isolate}',
    '#buildsPanel .bld-ed-line.has-spec::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--bg-0) 92%,transparent) 0,color-mix(in srgb,var(--bg-0) 70%,transparent) 45%,color-mix(in srgb,var(--bg-0) 35%,transparent))}',
    '#buildsPanel .bld-ed-line.is-elite{border-color:var(--gn-mod)}',
    '#buildsPanel .bld-ed-lh{display:flex;align-items:center;gap:10px}#buildsPanel .bld-ed-lh label{display:grid;gap:2px}',
    '#buildsPanel .bld-ed-lnum{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;background:var(--bg-2);color:var(--tx-2);font-weight:700}',
    '#buildsPanel .bld-ed select,#buildsPanel .bld-ed input{background:var(--bg-0);color:var(--tx-1);border:1px solid var(--bd-1);border-radius:8px;padding:5px 8px;font:inherit;max-width:100%}',
    '#buildsPanel .bld-ed-tiers{display:flex;align-items:center;gap:10px;margin:10px 0 4px;padding-left:4px;flex-wrap:wrap}',
    '#buildsPanel .bld-ed-tier{display:grid;gap:4px}#buildsPanel .bld-ed label small{color:var(--tx-2);font-size:.7rem;text-transform:uppercase;display:block}',
    '#buildsPanel .bld-ed-mn{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:color-mix(in srgb,var(--bg-0) 70%,transparent);box-shadow:inset 0 0 0 1px var(--bd-1);opacity:.85}',
    '#buildsPanel .bld-ed-mn img{border-radius:50%}',
    '#buildsPanel .bld-ed-tr{display:grid;place-items:center;width:44px;height:44px;padding:0;background:color-mix(in srgb,var(--bg-0) 75%,transparent);border:1px solid var(--bd-1);border-radius:10px;cursor:pointer;filter:grayscale(.85) brightness(.75);transition:filter .12s,box-shadow .12s}',
    '#buildsPanel .bld-ed-tr:hover,#buildsPanel .bld-ed-tr:focus-visible{filter:none}',
    '#buildsPanel .bld-ed-tr[aria-pressed=true]{filter:none;border-color:var(--gn-mod);box-shadow:0 0 0 2px var(--gn-mod),0 0 12px color-mix(in srgb,var(--gn-mod) 60%,transparent)}',
    '#buildsPanel .bld-ed-picked{margin:6px 0 0;font-size:.78rem;color:var(--tx-1)}',
    '#buildsPanel .bld-ed-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
    '#buildsPanel .bld-ed-sk{display:grid;justify-items:center;gap:3px;width:64px;padding:4px 0;background:none;border:0;color:var(--tx-2);font:inherit;cursor:pointer}',
    '#buildsPanel .bld-ed-sk img,#buildsPanel .bld-ed-plus{width:48px;height:48px;border-radius:8px;box-shadow:0 0 0 1px var(--bd-1)}',
    '#buildsPanel .bld-ed-plus{display:grid;place-items:center;background:var(--bg-2);color:var(--tx-2);font-size:1.4rem}',
    '#buildsPanel .bld-ed-sk.is-heal img,#buildsPanel .bld-ed-sk.is-heal .bld-ed-plus{box-shadow:0 0 0 2px var(--color-green,#3fb950)}',
    '#buildsPanel .bld-ed-sk.is-elite img,#buildsPanel .bld-ed-sk.is-elite .bld-ed-plus{box-shadow:0 0 0 2px var(--color-amber,#F2B94B)}',
    '#buildsPanel button.bld-ed-sk[aria-expanded=true] img,#buildsPanel button.bld-ed-sk[aria-expanded=true] .bld-ed-plus{box-shadow:0 0 0 2px var(--gn-mod),0 0 12px color-mix(in srgb,var(--gn-mod) 60%,transparent)}',
    '#buildsPanel .bld-ed-sk small{font-size:.7rem;text-transform:uppercase}#buildsPanel .bld-ed-bar.is-ro .bld-ed-sk{cursor:default}',
    '#buildsPanel .bld-ed-pick{border:1px solid var(--gn-mod);border-radius:12px;padding:8px;margin:-2px 0 12px;background:var(--bg-1);display:grid;gap:8px}',
    '#buildsPanel .bld-ed-pick-l{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:4px;max-height:300px;overflow:auto}',
    '#buildsPanel .bld-ed-opt{display:flex;align-items:center;gap:8px;text-align:left;background:var(--bg-2);border:1px solid var(--bd-1);border-radius:8px;padding:4px 6px;color:var(--tx-1);font:inherit;font-size:.8rem;cursor:pointer}',
    '#buildsPanel .bld-ed-opt[aria-pressed=true]{border-color:var(--gn-mod);box-shadow:0 0 0 1px var(--gn-mod)}',
    '#buildsPanel .bld-ed-pick-a{display:flex;gap:6px;justify-content:flex-end}',
    '#buildsPanel .bld-ed-water summary{cursor:pointer;color:var(--tx-2);margin-bottom:8px}',
    '#buildsPanel .bld-ed-prev{position:sticky;top:12px;display:grid;gap:8px}'
  ].join('\n');
  function ensureCss() {
    var d = root.document;
    if (!d || !d.head) return;
    var s = d.getElementById('bld-editor-css');
    if (!s) { s = d.createElement('style'); s.id = 'bld-editor-css'; d.head.appendChild(s); }
    if (s.textContent !== CSS) s.textContent = CSS;
  }

  // ---------------------------------------------------------------- comportamiento
  function loadRef(ctx, prof) {
    st.loading = true; st.error = ''; st.ref = null;
    var my = ++st.req;
    paint(ctx);
    return ctx.ref.load(prof).then(function (ref) {
      if (my !== st.req) return;
      st.ref = ref; st.loading = false;
      legendBar(st.build, ref);
      paint(ctx);
    }, function (e) {
      if (my !== st.req) return;
      st.loading = false; st.error = 'No pude traer los datos del juego (' + (e && e.message || 'sin conexión') + ').';
      paint(ctx);
    });
  }

  function paint(ctx, focusId) {
    if (!ctx.host) return;
    var a = root.document && root.document.activeElement;
    var keep = focusId || (a && a.id && ctx.host.contains && ctx.host.contains(a) ? a.id : '');
    ctx.host.innerHTML = viewHTML();
    if (keep && root.document) { var el = root.document.getElementById(keep); if (el && el.focus) el.focus(); }
  }

  function onInput(ctx, e) {
    var t = e.target, kind = t && t.getAttribute && t.getAttribute('data-ed');
    if (!kind) return;
    var b = st.build;
    if (kind === 'title') { st.title = t.value; return; }
    if (kind === 'spec') setSpec(b, st.ref, +t.getAttribute('data-line'), t.value);
    else if (kind === 'skill') { b.skills[t.getAttribute('data-bar')][+t.getAttribute('data-slot')] = Number(t.value) || 0; }
    else if (kind === 'pet') { b.pets[t.getAttribute('data-bar')][+t.getAttribute('data-i')] = Number(t.value) || 0; }
    else if (kind === 'legend') { b.legends[t.getAttribute('data-bar')][+t.getAttribute('data-i')] = Number(t.value) || 0; legendBar(b, st.ref); }
    else return;
    paint(ctx, t.id);
  }

  function onClick(ctx, e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-ed]') : null;
    if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
    var kind = t.getAttribute('data-ed'), b = st.build;
    if (kind === 'prof') {
      var p = +t.getAttribute('data-v');
      if (p === b.profession && st.ref) return;
      st.build = fresh(p); st.mineId = ''; st.title = ''; st.pick = null;
      return loadRef(ctx, p);
    }
    if (kind === 'retry') return loadRef(ctx, b.profession);
    if (kind === 'reset') { st.build = fresh(b.profession); st.mineId = ''; st.title = ''; st.pick = null; legendBar(st.build, st.ref); return paint(ctx); }
    if (kind === 'trait') setTrait(b, +t.getAttribute('data-line'), +t.getAttribute('data-tier'), +t.getAttribute('data-v'));
    else if (kind === 'weapon') toggleWeapon(b, +t.getAttribute('data-v'));
    else if (kind === 'slot') {
      var bar = t.getAttribute('data-bar'), slot = +t.getAttribute('data-slot');
      var same = st.pick && st.pick.bar === bar && st.pick.slot === slot;
      st.pick = same ? null : { bar: bar, slot: slot };
      return paint(ctx, same ? t.id : focusInPick(b, bar, slot));
    }
    else if (kind === 'pick') return choose(ctx, Number(t.getAttribute('data-v')) || 0);
    else if (kind === 'pick-close') return closePick(ctx);
    else return;
    paint(ctx, t.id);
  }
  // El foco entra al selector en la habilidad elegida (o en la primera opción).
  function focusInPick(b, bar, slot) {
    var opts = options(st.ref, slot, eliteId(b, st.ref)), cur = b.skills[bar][slot];
    for (var i = 0; i < opts.length; i++) if (opts[i].pid === cur) return 'bldEdOpt' + i;
    return opts.length ? 'bldEdOpt0' : '';
  }
  function choose(ctx, pid) {
    if (!st.pick) return;
    st.build.skills[st.pick.bar][st.pick.slot] = pid;
    closePick(ctx);
  }
  function closePick(ctx) {
    if (!st.pick) return;
    var id = 'bldEdSk' + st.pick.bar + st.pick.slot;
    st.pick = null;
    paint(ctx, id);
  }
  function loadIcons(ctx) {
    var R = root.GNBldRef;
    if (!R || typeof R.identity !== 'function' || ident()) return;
    R.identity().then(function () { if (ctx.host && ctx.host.querySelector && ctx.host.querySelector('.bld-ed')) paint(ctx); }, function () {});
  }

  // Guardar desde el editor: si vino de Mis builds, actualiza esa misma.
  function saveFromEditor(ctx) {
    if (!ctx.store) return ctx.toast('Mis builds todavía no cargó.', 'err');
    var code;
    try { code = C().encode(st.build); } catch (e) { return ctx.toast(e.message, 'err'); }
    var r = st.mineId ? ctx.store.update(st.mineId, { code: code, title: st.title }) : ctx.store.save({ code: code, title: st.title });
    if (r.ok && !st.mineId) st.mineId = r.id;
    ctx.toast(r.ok ? (r.dup ? 'Esa build ya estaba en Mis builds.' : 'Guardada en Mis builds.') : r.error, r.ok ? 'ok' : 'err');
  }

  function open(ctx, arg) {
    st.lastArg = arg;
    var a = String(arg || '');
    if (/^m:/.test(a) && ctx.store) {
      var m = ctx.store.get(a.slice(2));
      if (m) { var r = C().parse(m.code); if (r.ok) { st.build = r.build; st.title = m.title; st.mineId = m.id; return loadRef(ctx, r.build.profession); } }
    }
    if (a && !/^m:/.test(a)) {
      var p = C().parse('[&' + a + ']');
      if (p.ok) { st.build = p.build; st.title = ''; st.mineId = ''; return loadRef(ctx, p.build.profession); }
      ctx.toast(p.error, 'err');
    }
    if (!st.build) { st.build = fresh(1); return loadRef(ctx, 1); }
    if (!st.ref) return loadRef(ctx, st.build.profession);
    paint(ctx);
  }

  function render(host, ctx) {
    if (root.GNBldShow) root.GNBldShow.ensureCss();
    ensureCss();
    ctx.host = host;
    if (!host._bldEd) {
      host._bldEd = true;
      host.addEventListener('change', function (e) { if (!host.querySelector('.bld-ed')) return; if (onGear(st.ctx, e)) return; onInput(st.ctx, e); });
      host.addEventListener('toggle', function (e) { if (host.querySelector('.bld-ed')) onGear(st.ctx, e); }, true);
      host.addEventListener('input', function (e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-ed') === 'title') st.title = e.target.value; });
      host.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && st.pick && host.querySelector('.bld-ed')) { e.preventDefault(); closePick(st.ctx); }
      });
      host.addEventListener('click', function (e) {
        if (!host.querySelector('.bld-ed')) return;
        var s = e.target && e.target.closest ? e.target.closest('[data-bld-act="save"]') : null;
        if (s) { e.preventDefault(); e.stopPropagation(); return saveFromEditor(st.ctx); }
        if (e.target && e.target.closest && e.target.closest('[data-gear]')) return onGear(st.ctx, e);
        onClick(st.ctx, e);
      }, true);
      if (root.GNBldShow) root.GNBldShow.wire(host, function () {
        if (!host.querySelector('.bld-ed')) return null; // otra pestaña dibujó en este mismo lugar
        try { return { code: C().encode(st.build), title: st.title }; } catch (_) { return null; }
      }, st.ctx || ctx);
    }
    st.ctx = ctx;
    loadIcons(ctx);
    if (ctx.arg !== st.lastArg || !st.build) return open(ctx, ctx.arg);
    paint(ctx);
  }

  var api = { version: VERSION, render: render, refresh: function () { if (st.ctx && st.ctx.host && st.ctx.host.querySelector('.bld-ed')) paint(st.ctx); },
    _pure: { options: options, prune: prune, legendBar: legendBar, setSpec: setSpec, setTrait: setTrait, toggleWeapon: toggleWeapon, fresh: fresh, eliteId: eliteId,
      viewHTML: viewHTML, onClick: onClick, bgStyle: bgStyle, CSS: CSS }, _state: st };
  root.GNBldEditor = api;
  if (root.GNBld && typeof root.GNBld.register === 'function') root.GNBld.register('editor', api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
