/*!
 * js/acc-view.js — Cuentas renovado: «Mis cuentas» en vivo y la puerta al Llavero (BL-070, paso 4, CTA-2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.3.0 (2026-10-27) · BL-076 SHV-5c: mi línea dice «Lo sé por», con la hora de la lectura
 *          1.2.0 (2026-10-26) · BL-074 BLS-3: las definiciones de logros (gn:accounts:achmeta) van a IndexedDB
 *          por js/gn-idb.js si está, y espero a que abra antes de leerlas.
 *          1.1.0 (2026-10-26) · CTA-3: la pestaña Llavero la dibuja js/acc-vault-view.js; con el Llavero abierto, las
 *          tarjetas suman sus etiquetas y aparecen en gris las cuentas sin Key (D7)
 *          1.0.0 (2026-10-26)
 *
 * Toma #accountsPanel en su ruta (#/account/accounts, la de js/router.js) con dos pestañas:
 *  - Mis cuentas: cada cuenta con Key en la Bóveda (gn:account:keys), en vivo, sin archivo ni contraseña.
 *    Por Key: /v2/tokeninfo (permisos), /v2/account (expansiones, antigüedad, comandante, fractales, McM,
 *    clanes), y según los permisos /v2/account/achievements, /v2/account/mastery/points,
 *    /v2/account/legendaryarmory y /v2/pvp/stats. La etiqueta de cada clan sale de /v2/guild/:id.
 *    Las cuentas que ya leí se guardan 6 horas (D6, gn:accounts:cards, por huella, nunca la Key) y
 *    «Actualizar» las vuelve a leer. Las definiciones de logros que hacen falta para sumar los puntos se
 *    guardan compactas 7 días (gn:accounts:achmeta).
 *  - Llavero: lo dibuja js/acc-vault-view.js (abrir, editar, importar y guardar con el cifrado nuevo).
 *    El panel viejo (js/accounts-panel.js) se retiró en CTA-5.
 * Tarjetas con íconos (pedido de Pablo): solo las expansiones que la cuenta tiene, en color; el ícono de cada
 * dato; la etiqueta de tipo con su color. Estados honestos: «Sin permiso» o «Sin datos», nunca un 0 falso.
 * Los cálculos son de js/acc-model.js. Se carga por js/modules.json (DEC-035), después de acc-model.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.3.0';
  var LOG = '[AccView]';
  var PANEL = 'accountsPanel';
  var ROUTE = '#/account/accounts'; // la misma que usa js/router.js
  var ICON = 'assets/icons/3601748.png';
  var DATA_URL = 'assets/data/accounts/catalog.json';
  var API = 'https://api.guildwars2.com';
  var CARDS_KEY = 'gn:accounts:cards', META_KEY = 'gn:accounts:achmeta';
  var CARD_TTL = 6 * 3600000, META_TTL = 7 * 86400000, TIMEOUT = 20000, CHUNK = 200;
  var TYPES = [['all', 'Todas'], ['main', 'Principal'], ['alter', 'Alternativa'], ['f2p', 'Gratuita'], ['none', 'Sin tipo']];
  var TYPE_ORDER = { main: 0, alter: 1, f2p: 2 };

  // ------------------------------------------------------------------ puro
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function fmt(n) { return Number(n).toLocaleString('es-AR'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function date(s) { var t = Date.parse(s); if (!isFinite(t)) return ''; var d = new Date(t); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }
  // Huella de la Key (FNV-1a de 32 bits): separa cuentas sin guardar la Key.
  function fingerprint(token) {
    var s = String(token || ''), h = 0x811c9dc5;
    if (!s) return '';
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function ago(t, now) {
    var m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 1) return 'recién';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60);
    return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
  }

  // Definiciones de logros, compactas: id → [repetible, tope, cantidad, puntos, cantidad, puntos…]
  function compactMeta(list) {
    var out = {};
    (Array.isArray(list) ? list : []).forEach(function (a) {
      if (!a || a.id == null) return;
      var r = [Array.isArray(a.flags) && a.flags.indexOf('Repeatable') >= 0 ? 1 : 0, typeof a.point_cap === 'number' ? a.point_cap : -1];
      (a.tiers || []).forEach(function (t) { r.push(Number(t.count) || 0, Number(t.points) || 0); });
      out[a.id] = r;
    });
    return out;
  }
  function expandMeta(m) {
    var byId = {}, caps = {};
    Object.keys(m || {}).forEach(function (id) {
      var r = m[id], tiers = [];
      for (var i = 2; i + 1 < r.length; i += 2) tiers.push({ count: r[i], points: r[i + 1] });
      byId[id] = { flags: r[0] ? ['Repeatable'] : [], tiers: tiers };
      if (r[1] >= 0) caps[id] = r[1];
    });
    return { byId: byId, caps: caps };
  }

  function allPerms(stats) {
    var out = [];
    Object.keys(stats || {}).forEach(function (k) { (stats[k].perm || []).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); }); });
    return out;
  }

  // raw: { fp, label, tag, state, tokeninfo, account, ach, mastery, armory, pvp, guilds, metaById, caps }
  function deriveCard(raw, cat, M, now) {
    var S = cat.stats, acc = raw.account || null, perms = M.perms(raw.tokeninfo);
    var tags = M.tags(raw.tag ? [raw.tag] : [], cat.tags, cat.otherTagColor);
    var apr = acc && Array.isArray(raw.ach) && raw.metaById ? M.achievementPoints(raw.ach, raw.metaById, raw.caps, acc) : null;
    return {
      fp: raw.fp, label: raw.label || '', state: raw.state || 'ok', t: now,
      name: acc ? acc.name || '' : '', created: acc ? acc.created || null : null, age: acc ? M.age(acc.created, now) : null,
      type: M.accountType(tags), tags: tags, exps: acc ? M.expansions(cat.expansions, acc.access, raw.mastery, null) : [],
      free: acc ? M.isFree(acc.access) : null, commander: acc ? !!acc.commander : null,
      guilds: acc ? M.guilds(acc.guilds, raw.guilds) : [],
      keyComplete: M.keyComplete(S, perms), missing: perms ? M.missingPerms(allPerms(S), perms) : null,
      ap: M.stat(apr ? apr.total : null, S.achievements.perm, perms),
      legendaries: M.stat(M.legendaryCount(raw.armory), S.legendaries.perm, perms),
      fractals: M.stat(acc && acc.fractal_level != null ? Number(acc.fractal_level) : null, S.fractals.perm, perms),
      wvw: M.stat(M.wvwRank(acc), S.wvw.perm, perms),
      pvp: M.stat(M.pvpRank(raw.pvp, cat.pvpRanks), S.pvp.perm, perms)
    };
  }

  function placeholder(key, cat, M) {
    var tags = M.tags(key.tag ? [key.tag] : [], cat.tags, cat.otherTagColor);
    return { fp: fingerprint(key.value), label: key.label || '', state: 'loading', name: '', tags: tags, type: M.accountType(tags), exps: [], guilds: [] };
  }

  function sortCards(cards) {
    return cards.slice().sort(function (a, b) {
      var oa = a.type in TYPE_ORDER ? TYPE_ORDER[a.type] : 3, ob = b.type in TYPE_ORDER ? TYPE_ORDER[b.type] : 3;
      if (oa !== ob) return oa - ob;
      return String(a.name || a.label).localeCompare(String(b.name || b.label), 'es');
    });
  }

  function filterCards(cards, ui) {
    var q = fold(ui.q || ''), ty = ui.type || 'all';
    return cards.filter(function (c) {
      if (ty === 'none' ? !!c.type : ty !== 'all' && c.type !== ty) return false;
      return !q || fold(c.name + ' ' + c.label).indexOf(q) >= 0;
    });
  }

  var PERM_TXT = { progression: 'progreso', pvp: 'JcJ', inventories: 'inventarios', unlocks: 'desbloqueos', account: 'cuenta' };
  function permList(list) { return list.map(function (p) { return '«' + (PERM_TXT[p] || p) + '»'; }).join(', ').replace(/, ([^,]*)$/, ' y $1'); }
  function who(c) { return c.name || c.label || 'una cuenta'; }

  // Mi línea: primero una Key que no responde; después las que no alcanzan; después Visions of Eternity.
  function pickVoice(cards, loading) {
    if (loading) return null;
    var bad = cards.filter(function (c) { return c.state === 'bad'; });
    if (bad.length) return { kind: 'advierte', key: 'bad:' + bad.length, text: 'La Key de «' + who(bad[0]) + '»' + (bad.length > 1 ? ' y ' + (bad.length - 1) + ' más no responden' : ' no responde') + ': puede estar borrada o vencida. Revisala en «Administrar Keys».' };
    var inc = cards.filter(function (c) { return c.missing && c.missing.length; });
    if (inc.length) {
      var miss = []; inc.forEach(function (c) { c.missing.forEach(function (p) { if (miss.indexOf(p) < 0) miss.push(p); }); });
      return { kind: 'recomienda', key: 'perm:' + inc.length + ':' + miss.join(','), text: (inc.length === 1 ? 'A la Key de «' + who(inc[0]) + '» le faltan' : 'A ' + inc.length + ' Keys les faltan') + ' permisos (' + permList(miss) + '): no puedo leer todo. Si querés verlo, generá la Key de nuevo con esos permisos.' };
    }
    if (cards.some(function (c) { return c.exps.some(function (e) { return e.source === 'mastery'; }); }))
      return { kind: 'explica', key: 'voe', text: 'Visions of Eternity la marco por tu maestría: la API todavía no informa esa expansión, pero si ganaste puntos de maestría ahí, la tenés.' };
    return null;
  }

  // ------------------------------------------------------------------ HTML
  function stat(label, value, note) { return '<div class="cv-st"><small>' + label + '</small><b>' + value + '</b>' + (note ? '<em>' + note + '</em>' : '') + '</div>'; }

  function statsHTML(sum, total, loading) {
    var types = ['main', 'alter', 'f2p'].filter(function (t) { return sum.types[t]; }).map(function (t) { return sum.types[t] + ' ' + { main: 'main', alter: 'alter', f2p: 'f2p' }[t]; }).join(' · ');
    var wait = loading ? 'leyendo…' : 'sin datos';
    return stat('Cuentas', String(total), types) +
      (sum.apFrom ? stat('Puntos de logro', fmt(sum.ap), sum.apFrom === total ? 'sumando ' + (total === 1 ? 'tu cuenta' : 'las ' + total) : 'de ' + sum.apFrom + ' de ' + total + ' cuentas') : stat('Puntos de logro', '—', wait)) +
      (sum.legFrom ? stat('Legendarias', fmt(sum.legendaries), 'en la armería, entre ' + (sum.legFrom === 1 ? '1 cuenta' : sum.legFrom + ' cuentas')) : stat('Legendarias', '—', wait)) +
      (sum.keysKnown ? stat('Keys completas', sum.keysComplete + ' <span>/ ' + sum.keysKnown + '</span>', sum.keysComplete < sum.keysKnown ? (sum.keysKnown - sum.keysComplete) + ' con permisos de menos' : 'con todos los permisos') : stat('Keys completas', '—', wait));
  }

  function factHTML(icon, label, s, show) {
    var v;
    if (!s) v = '<b class="cv-nd">…</b>';
    else if (s.state === 'ok') v = '<b>' + show(s.value) + '</b>';
    else v = '<b class="cv-nd">' + (s.state === 'noperm' ? 'Sin permiso' : 'Sin datos') + '</b>';
    return '<div class="cv-f"><img src="' + esc(icon) + '" alt="" width="24" height="24" loading="lazy" referrerpolicy="no-referrer"><span><small>' + label + '</small>' + v + '</span></div>';
  }

  function cardHTML(c, cat, M, active) {
    var S = cat.stats, I = function (k) { return M.icon(S[k].icon); }, isAct = c.fp === active;
    var t = c.tags.filter(function (x) { return x.type; })[0];
    var color = t ? t.color : cat.otherTagColor;
    var h = '<article class="cv-card' + (isAct ? ' cv-card--act' : '') + '" style="--tc:' + esc(color) + '" aria-labelledby="cvN-' + esc(c.fp) + '">';
    h += '<div class="cv-ch"><span class="cv-av"><img src="' + esc(t ? t.icon : ICON) + '" alt="" width="34" height="34"></span>' +
      '<div class="cv-nm"><b id="cvN-' + esc(c.fp) + '">' + esc(c.name || c.label || 'Cuenta') + '</b>' +
      (c.created ? '<small>Creada el ' + date(c.created) + (c.age ? ' · ' + (c.age.years === 1 ? '1 año' : c.age.years + ' años') : '') + '</small>' : '') +
      (c.label && c.name && c.label !== c.name ? '<small>Key: ' + esc(c.label) + '</small>' : '') + '</div>' +
      (isAct ? '<span class="cv-act">Activa</span>' : c.state === 'ok' || c.state === 'loading' ? '<button type="button" class="cv-btn" data-cv-use="' + esc(c.fp) + '">Usar esta<span class="cv-sr"> cuenta, ' + esc(c.name || c.label) + '</span></button>' : '') + '</div>';
    if (c.state === 'bad') return h + '<p class="cv-warn">Esta Key no responde: puede estar borrada o vencida.</p></article>';
    if (c.state === 'loading') return h + '<p class="cv-wait">Leyendo la cuenta…</p></article>';
    if (c.state === 'nokey') return h + (c.tags.length ? '<div class="cv-chips">' + c.tags.map(function (x) { return '<span class="cv-chip cv-tag" style="--cc:' + esc(x.color) + '">' + (x.icon ? '<img src="' + esc(x.icon) + '" alt="" width="16" height="16">' : '<i aria-hidden="true"></i>') + esc(x.name) + '</span>'; }).join('') + '</div>' : '') + '<p class="cv-wait">Está en tu Llavero, pero no tiene API Key en la Bóveda: cargala para ver sus datos.</p></article>';
    h += '<div class="cv-exps">' + (c.exps.length ? c.exps.map(function (e) {
      var tip = e.name + (e.source === 'mastery' ? ' (por tu maestría: la API todavía no la informa)' : e.source === 'manual' ? ' (la marcaste vos)' : '');
      return '<img src="' + esc(e.icon) + '" alt="' + esc(tip) + '" title="' + esc(tip) + '" width="30" height="30">';
    }).join('') : '<small>' + (c.free ? 'Cuenta gratuita' : c.free === false ? 'Juego base, sin expansiones' : '') + '</small>') + '</div>';
    h += '<div class="cv-facts">' +
      factHTML(I('achievements'), 'Logros', c.ap, fmt) +
      factHTML(I('legendaries'), 'Legendarias', c.legendaries, fmt) +
      factHTML(I('fractals'), 'Fractales', c.fractals, function (v) { return 'nivel ' + fmt(v); }) +
      factHTML(I('wvw'), 'McM', c.wvw, function (v) { return 'rango ' + fmt(v); }) +
      factHTML(c.pvp && c.pvp.state === 'ok' && c.pvp.value.icon ? c.pvp.value.icon : I('pvp'), 'JcJ', c.pvp, function (v) { return 'rango ' + fmt(v.rank) + (v.rollovers ? ' <span>(+' + fmt(v.rollovers) + ')</span>' : ''); }) +
      '</div>';
    var chips = c.tags.map(function (x) {
      return '<span class="cv-chip cv-tag" style="--cc:' + esc(x.color) + '">' + (x.icon ? '<img src="' + esc(x.icon) + '" alt="" width="16" height="16">' : '<i aria-hidden="true"></i>') + esc(x.name) + '</span>';
    });
    if (c.commander) chips.push('<span class="cv-chip"><img src="' + esc(I('commander')) + '" alt="" width="16" height="16">Comandante</span>');
    c.guilds.forEach(function (g) { if (g.tag) chips.push('<span class="cv-chip"><img src="' + esc(I('guild')) + '" alt="" width="16" height="16">[' + esc(g.tag) + '] ' + esc(g.name) + '</span>'); });
    if (chips.length) h += '<div class="cv-chips">' + chips.join('') + '</div>';
    if (c.missing && c.missing.length) h += '<p class="cv-warn">A esta Key le faltan ' + permList(c.missing) + '.</p>';
    return h + '</article>';
  }

  function tabsHTML(cur) {
    return '<div class="cv-tabs" role="tablist" aria-label="Secciones de Cuentas">' + [['mine', 'Mis cuentas'], ['vault', 'Llavero']].map(function (t) {
      var on = t[0] === cur;
      return '<button type="button" role="tab" id="cvTab-' + t[0] + '" data-cv-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="cvPanel-' + t[0] + '" tabindex="' + (on ? 0 : -1) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }

  // m: { cat, M, cards, keys, active, activeName, ui, loading, readAt, now }
  function viewHTML(m) {
    var real = m.cards.filter(function (c) { return c.state !== 'nokey'; }), total = real.length, sum = m.M.summary(real);
    var sub = !total ? 'Todavía no cargaste ninguna API Key' : total + (total === 1 ? ' cuenta con Key' : ' cuentas con Key') + (m.loading ? ' · leyendo…' : m.readAt ? ' · leído ' + ago(m.readAt, m.now) : '');
    var h = '<div class="cv-hero"><div class="cv-row"><img class="cv-ico" src="' + ICON + '" alt="" width="56" height="56">' +
      '<div class="cv-title"><h2 id="cvTitle">Cuentas</h2><p>' + esc(sub) + '</p></div><div class="cv-top">' +
      (m.activeName ? '<span class="cv-pill">Activa <b>' + esc(m.activeName) + '</b></span>' : '') +
      '<button type="button" class="cv-btn" data-cv="keys">Administrar Keys</button>' +
      (total ? '<button type="button" class="cv-btn" data-cv="refresh">Actualizar</button>' : '') + '</div></div>';
    if (total) h += '<div class="cv-stats">' + statsHTML(sum, total, m.loading) + '</div>';
    h += '<div id="cvVoice" class="cv-voice" aria-live="polite"></div></div>';
    h += tabsHTML(m.ui.tab);
    if (m.ui.tab === 'vault' && m.vault) return h + '<div id="cvPanel-vault" role="tabpanel" aria-labelledby="cvTab-vault">' + m.vault + '</div>';
    if (m.ui.tab === 'vault') return h + '<div id="cvPanel-vault" role="tabpanel" aria-labelledby="cvTab-vault"><p class="cv-note">Tus contraseñas, Twitch, GeForce NOW, notas y etiquetas, cifradas en tu archivo. Este es el Llavero de siempre: el renovado llega en el próximo paso, sin perder ningún dato.</p></div>';
    h += '<div id="cvPanel-mine" role="tabpanel" aria-labelledby="cvTab-mine">';
    if (!m.cards.length) return h + '<section class="cv-empty"><p>Cargá la API Key de cada cuenta y te muestro todas juntas: expansiones, logros, legendarias, fractales, McM, JcJ y clanes. Sin archivo ni contraseña.</p><button type="button" class="cv-btn" data-cv="keys">Agregar API Key</button></section></div>';
    var shown = filterCards(sortCards(m.cards), m.ui);
    h += '<div class="cv-filters"><div class="cv-pills" role="group" aria-label="Por tipo">' + TYPES.map(function (t) {
      return '<button type="button" class="cv-btn" data-cv-type="' + t[0] + '" aria-pressed="' + (m.ui.type === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div><label class="cv-q"><span class="cv-sr">Buscar una cuenta</span><input type="search" id="cvQ" placeholder="Buscar una cuenta" value="' + esc(m.ui.q) + '" autocomplete="off"></label></div>';
    h += shown.length ? '<div class="cv-grid">' + shown.map(function (c) { return cardHTML(c, m.cat, m.M, m.active); }).join('') + '</div>' : '<p class="cv-note">No hay cuentas con estos filtros.</p>';
    return h + '<p class="cv-src">Datos en vivo de la API oficial con tus Keys; lo leído se guarda 6 horas en tu navegador, nunca la Key. Las etiquetas farming, llaves, semanal y taxi viven en tu Llavero: se suman acá mientras lo tenés abierto.</p></div>';
  }

  var P = '#' + PANEL, R = '#cvRoot', MOD = '#8E96A3';
  var CSS = [
    P + '.cv-on{padding:0 0 22px;background:linear-gradient(180deg,color-mix(in srgb,' + MOD + ' 12%,transparent),transparent 300px),var(--gn-tray,var(--bg-1))}',
    P + '.cv-on>.panel__title,' + P + '.cv-mine>.panel__body{display:none}',
    P + '.cv-on>:not(#cvRoot),' + R + '>:not(.cv-hero){margin-left:24px;margin-right:24px}',
    R + '{--cv-mod:' + MOD + ';margin:0 0 12px}',
    '.cv-hero{border-bottom:1px solid var(--bd-1);padding:20px 24px 18px}',
    '.cv-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.cv-title h2{margin:0;font-size:1.3rem;color:var(--tx-1)}.cv-title p{margin:2px 0 0;color:var(--tx-2);font-size:.86rem}',
    '.cv-top{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.cv-pill{font-size:.78rem;border:1px solid var(--bd-1);border-radius:999px;padding:4px 10px;color:var(--tx-2);background:var(--bg-0);white-space:nowrap}.cv-pill b{color:var(--tx-1)}',
    '.cv-btn{font:inherit;font-size:.78rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;color:var(--tx-1);background:transparent;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
    '.cv-btn:hover{border-color:var(--acc-1)}.cv-btn[aria-pressed=true]{background:var(--bg-2);border-color:var(--cv-mod);font-weight:700}',
    '.cv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}',
    '.cv-st{border:1px solid var(--bd-1);border-radius:12px;background:var(--bg-0);padding:10px 12px;min-width:0}',
    '.cv-st small{display:block;font-size:.7rem;color:var(--tx-2);text-transform:uppercase;letter-spacing:.06em}',
    '.cv-st b{font-size:1.25rem;color:var(--tx-1)}.cv-st b span{font-size:.8rem;color:var(--tx-2);font-weight:500}',
    '.cv-st em{display:block;font-style:normal;font-size:.74rem;color:var(--tx-2);margin-top:2px}',
    '.cv-voice{margin-top:12px}.cv-voice:empty{display:none}.cv-voice .shv-voice{margin:0;padding:8px 12px;background:var(--bg-0)}',
    '.cv-voice .shv-voice__avatar{width:36px;height:36px}.cv-voice .shv-voice__label{font-size:.78rem}.cv-voice .shv-voice__body p{font-size:.86rem}',
    '.cv-tabs{display:flex;gap:4px;margin:16px 0 10px;border-bottom:1px solid var(--bd-1);overflow-x:auto}',
    '.cv-tabs [role=tab]{font:inherit;font-size:.92rem;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px;color:var(--tx-2);min-height:40px;cursor:pointer;white-space:nowrap}',
    '.cv-tabs [role=tab]:hover{color:var(--tx-1)}.cv-tabs [aria-selected=true]{border-bottom-color:var(--cv-mod);color:var(--tx-1);font-weight:700}',
    '.cv-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.cv-pills{display:flex;gap:6px;flex-wrap:wrap}',
    '.cv-q{margin-left:auto}.cv-q input{font:inherit;font-size:.85rem;border:1px solid var(--bd-2);border-radius:999px;padding:5px 12px;background:var(--bg-0);color:var(--tx-1);min-height:32px;box-sizing:border-box;min-width:200px}',
    '.cv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}',
    '.cv-card{border:1px solid var(--bd-1);border-left:3px solid var(--tc);border-radius:14px;background:var(--bg-1);box-shadow:var(--gn-elev,0 6px 18px rgba(0,0,0,.28));padding:12px 14px;min-width:0}',
    '.cv-card--act{border-color:color-mix(in srgb,var(--tc) 60%,var(--bd-1))}',
    '.cv-ch{display:flex;align-items:center;gap:12px}',
    '.cv-av{width:52px;height:52px;border-radius:12px;background:var(--bg-0);display:grid;place-items:center;flex-shrink:0;box-shadow:0 0 0 1px var(--bd-2),0 0 14px color-mix(in srgb,var(--tc) 30%,transparent)}',
    '.cv-nm{flex:1;min-width:0}.cv-nm b{display:block;font-size:1.02rem;color:var(--tx-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cv-nm small{display:block;font-size:.76rem;color:var(--tx-2)}',
    '.cv-act{font-size:.72rem;font-weight:700;border:1px solid var(--color-green,#3CC48A);border-radius:999px;padding:1px 8px;color:var(--tx-1);white-space:nowrap}',
    '.cv-exps{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px;min-height:30px}.cv-exps img{width:30px;height:30px;border-radius:6px}.cv-exps small{font-size:.78rem;color:var(--tx-2)}',
    '.cv-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-top:10px}',
    '.cv-f{display:flex;gap:8px;align-items:center;border:1px solid var(--bd-1);border-radius:10px;padding:6px 8px;background:var(--bg-0);min-width:0}',
    '.cv-f img{width:24px;height:24px;flex-shrink:0}.cv-f small{display:block;font-size:.7rem;color:var(--tx-2)}.cv-f b{font-size:.9rem;color:var(--tx-1)}.cv-f b span{font-weight:500;color:var(--tx-2)}.cv-f .cv-nd{font-weight:500;color:var(--tx-2);font-size:.8rem}',
    '.cv-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
    '.cv-chip{display:inline-flex;align-items:center;gap:5px;font-size:.74rem;border:1px solid var(--bd-1);border-radius:999px;padding:2px 9px 2px 4px;color:var(--tx-1);background:var(--bg-0)}',
    '.cv-chip img{width:16px;height:16px}.cv-tag{border-color:var(--cc)}.cv-tag i{width:10px;height:10px;border-radius:50%;background:var(--cc);margin-left:3px}',
    '.cv-warn{margin:8px 0 0;padding-left:8px;border-left:3px solid var(--color-amber,#F2B94B);font-size:.8rem;color:var(--tx-1)}',
    '.cv-wait,.cv-note,.cv-src{margin:8px 0 0;color:var(--tx-2);font-size:.82rem}.cv-src{font-size:.74rem;margin-top:12px}',
    '.cv-empty{border:1px dashed var(--bd-2);border-radius:14px;padding:16px;display:grid;gap:10px;justify-items:start}.cv-empty p{margin:0;color:var(--tx-1)}',
    '.cv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    R + ' :is(button,input):focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + R + ' *{transition:none!important;animation:none!important}}',
    '@media (max-width:900px){.cv-hero{padding:14px 12px 12px}' + P + '.cv-on>:not(#cvRoot),' + R + '>:not(.cv-hero){margin-left:12px;margin-right:12px}',
    '.cv-title h2{font-size:1.05rem}.cv-top,.cv-q{margin-left:0;width:100%}.cv-q input{width:100%}',
    '.cv-stats{grid-template-columns:1fr 1fr;gap:6px}.cv-grid{grid-template-columns:1fr}.cv-av{width:40px;height:40px}.cv-btn,.cv-q input,.cv-tabs [role=tab]{min-height:44px}}'
  ].join('\n');

  // ------------------------------------------------------------------ estado y DOM
  var doc = root.document;
  var st = { cat: null, catP: null, cards: {}, keys: [], tokens: {}, meta: null, guilds: {}, ui: { tab: 'mine', type: 'all', q: '' }, shown: false, loading: false, seq: 0, voiceKey: null, readAt: 0 };

  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function isHidden(n) { return !n || n.hidden || (n.getAttribute && n.getAttribute('hidden') != null); }
  function hash() { return String((root.location && root.location.hash) || '').split('?')[0]; }
  function storage() { var S = root.Storage; return S && typeof S.get === 'function' && typeof S.set === 'function' ? S : null; }
  function model() { var M = root.AccModel; return M && M._pure ? M._pure : null; }
  function vault() { var X = root.AccVaultView; return X && typeof X.html === 'function' ? X : null; }
  function keys() {
    var S = storage(), list = S && S.STORAGE_KEYS ? S.get(S.STORAGE_KEYS.ACCOUNT_KEYS) : null;
    return (Array.isArray(list) ? list : []).filter(function (k) { return k && k.value; });
  }
  function active() {
    try {
      var sel = byId('keySelectGlobal');
      if (sel && sel.value) return String(sel.value).trim();
      var S = storage();
      if (S && S.STORAGE_KEYS) return S.get(S.STORAGE_KEYS.ACCOUNT_SELECTED) || null;
    } catch (e) {}
    return null;
  }

  function loadCat() {
    if (st.cat) return Promise.resolve(st.cat);
    if (st.catP) return st.catP;
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    st.catP = root.fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('datos ' + r.status); return r.json(); })
      .then(function (c) { st.cat = c || {}; return st.cat; })
      .catch(function (e) { st.catP = null; if (root.console) root.console.warn(LOG, 'datos', e); return null; });
    return st.catP;
  }

  function getJSON(path, tk) {
    var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var url = API + path + (tk ? (path.indexOf('?') < 0 ? '?' : '&') + 'access_token=' + encodeURIComponent(tk) : '');
    return root.fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (to) clearTimeout(to);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }
  function settle(fn) { return Promise.resolve().then(fn).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }
  function val(x) { return x && x.ok ? x.v : null; }

  function metaIdb() { var G = root.GNIdb; return G && G.handles && G.handles(META_KEY) ? G : null; }
  function metaStore() {
    if (st.meta) return st.meta;
    var G = metaIdb(), S = storage(), m = G ? G.get(META_KEY) : S ? S.get(META_KEY) : null;
    st.meta = m && m.m && Date.now() - (m.t || 0) < META_TTL ? m : { t: Date.now(), m: {} };
    return st.meta;
  }
  function ensureMeta(ids) {
    var G = root.GNIdb;
    return Promise.resolve(G && G.ready ? G.ready() : null).then(function () { return fillMeta(ids); });
  }
  function fillMeta(ids) {
    var store = metaStore(), miss = ids.filter(function (id) { return !(id in store.m); });
    var chunks = [];
    for (var i = 0; i < miss.length; i += CHUNK) chunks.push(miss.slice(i, i + CHUNK));
    return chunks.reduce(function (p, ch) {
      return p.then(function () {
        return settle(function () { return getJSON('/v2/achievements?ids=' + ch.join(','), null); }).then(function (r) {
          if (r.ok) Object.assign(store.m, compactMeta(r.v));
        });
      });
    }, Promise.resolve()).then(function () {
      var G = metaIdb(), S = storage();
      if (chunks.length) { if (G) G.set(META_KEY, store); else if (S) S.set(META_KEY, store); }
      return expandMeta(store.m);
    });
  }
  function ensureGuilds(ids) {
    var miss = (ids || []).filter(function (id) { return !(id in st.guilds); });
    return Promise.all(miss.map(function (id) {
      return settle(function () { return getJSON('/v2/guild/' + encodeURIComponent(id), null); }).then(function (r) { st.guilds[id] = r.ok ? { tag: r.v.tag, name: r.v.name } : null; });
    })).then(function () { var out = {}; (ids || []).forEach(function (id) { if (st.guilds[id]) out[id] = st.guilds[id]; }); return out; });
  }

  function readAccount(key) {
    var tk = key.value, raw = { fp: fingerprint(tk), label: key.label || '', tag: key.tag || '' };
    return settle(function () { return getJSON('/v2/tokeninfo', tk); }).then(function (ti) {
      if (!ti.ok) { raw.state = 'bad'; return raw; }
      raw.state = 'ok'; raw.tokeninfo = ti.v;
      var p = ti.v.permissions || [], has = function (x) { return p.indexOf(x) >= 0; };
      var get = function (path, ok) { return ok ? settle(function () { return getJSON(path, tk); }) : Promise.resolve(null); };
      return Promise.all([
        get('/v2/account?v=latest', true), get('/v2/account/achievements', has('progression')), get('/v2/account/mastery/points', has('progression')),
        get('/v2/account/legendaryarmory', has('inventories') && has('unlocks')), get('/v2/pvp/stats', has('pvp'))
      ]).then(function (r) {
        raw.account = val(r[0]); raw.ach = val(r[1]); raw.mastery = val(r[2]); raw.armory = val(r[3]); raw.pvp = val(r[4]);
        var ids = Array.isArray(raw.ach) ? raw.ach.map(function (a) { return a.id; }) : [];
        return Promise.all([ensureMeta(ids), ensureGuilds(raw.account && raw.account.guilds)]);
      }).then(function (x) { raw.metaById = x[0].byId; raw.caps = x[0].caps; raw.guilds = x[1]; return raw; });
    });
  }

  function savedCards() { var S = storage(), c = S ? S.get(CARDS_KEY) : null; return c && typeof c === 'object' ? c : {}; }
  function saveCards() {
    var S = storage(), out = {};
    if (!S) return;
    st.keys.forEach(function (k) { var c = st.cards[fingerprint(k.value)]; if (c && c.state === 'ok') out[c.fp] = c; });
    S.set(CARDS_KEY, out);
  }

  // Lee de a una cuenta (cuida el límite de la API) y dibuja a medida que llegan.
  function load(nocache) {
    var M = model(), cat = st.cat, seq = ++st.seq;
    if (!M || !cat) return Promise.resolve(null);
    st.keys = keys(); st.tokens = {};
    var saved = nocache ? {} : savedCards(), now = Date.now(), todo = [];
    st.keys.forEach(function (k) {
      var fp = fingerprint(k.value), c = saved[fp];
      st.tokens[fp] = k.value;
      if (c && c.state === 'ok' && now - (c.t || 0) < CARD_TTL) {
        c.label = k.label || ''; c.tags = M.tags(k.tag ? [k.tag] : [], cat.tags, cat.otherTagColor); c.type = M.accountType(c.tags);
        st.cards[fp] = c; st.readAt = Math.max(st.readAt, c.t);
      } else { st.cards[fp] = placeholder(k, cat, M); todo.push(k); }
    });
    st.loading = todo.length > 0;
    render();
    return todo.reduce(function (p, k) {
      return p.then(function () {
        if (seq !== st.seq) return null;
        return readAccount(k).then(function (raw) {
          if (seq !== st.seq) return;
          st.cards[raw.fp] = deriveCard(raw, cat, M, Date.now());
          render();
        });
      });
    }, Promise.resolve()).then(function () {
      if (seq !== st.seq) return null;
      st.loading = false;
      if (todo.length) { st.readAt = Date.now(); saveCards(); }
      render();
      return list();
    });
  }
  function list() { return st.keys.map(function (k) { return st.cards[fingerprint(k.value)]; }).filter(Boolean); }

  function ensureHost(panel) {
    if (!byId('acc-view-css') && doc.createElement && doc.head) {
      var s = doc.createElement('style'); s.id = 'acc-view-css'; s.textContent = CSS; doc.head.appendChild(s);
    }
    var host = byId('cvRoot');
    if (!host) {
      host = doc.createElement('div'); host.id = 'cvRoot';
      panel.insertBefore(host, panel.firstChild);
      wire(host);
      if (root.GNSurface && typeof root.GNSurface.register === 'function') root.GNSurface.register(PANEL);
    }
    if (panel.classList) panel.classList.add('cv-on');
    if (panel.setAttribute) panel.setAttribute('aria-labelledby', 'cvTitle');
    return host;
  }

  function render() {
    var panel = byId(PANEL), M = model();
    if (!panel || !st.cat || !M || !st.shown) return null;
    var X = vault(), host = ensureHost(panel), cards = X && X.decorate ? X.decorate(list(), st.cat, M) : list(), act = fingerprint(active()), now = Date.now();
    var legacy = st.ui.tab === 'vault' && (!X || X.showLegacy());
    if (panel.classList) { if (!legacy) panel.classList.add('cv-mine'); else if (panel.classList.remove) panel.classList.remove('cv-mine'); }
    var ac = st.cards[act], m = { cat: st.cat, M: M, cards: cards, active: act, activeName: ac ? ac.name || ac.label : '', ui: st.ui, loading: st.loading, readAt: st.readAt, now: now, vault: X && st.ui.tab === 'vault' ? X.html(st.cat, M) : '' };
    var a = doc.activeElement, fk = a && host.contains && host.contains(a) && a.getAttribute ? (a.id ? '#' + a.id : focusSel(a)) : null;
    var caret = a && (a.id === 'cvQ' || a.id === 'vkQ') ? a.selectionStart : null;
    host.innerHTML = viewHTML(m);
    st.voiceKey = null;
    renderVoice(st.ui.tab === 'mine' ? pickVoice(cards, st.loading) : null);
    if (fk && host.querySelector) {
      var b = host.querySelector(fk);
      if (b && b.focus) b.focus();
      if (b && caret != null && b.setSelectionRange) b.setSelectionRange(caret, caret);
    }
    return m;
  }
  function focusSel(a) {
    var ks = ['data-cv', 'data-cv-tab', 'data-cv-type', 'data-cv-use', 'data-vk', 'data-vk-show', 'data-vk-copy'];
    for (var i = 0; i < ks.length; i++) { var v = a.getAttribute(ks[i]); if (v) return '[' + ks[i] + '="' + v + '"]'; }
    return null;
  }

  function renderVoice(msg) {
    var box = byId('cvVoice');
    if (!box) return;
    var key = msg ? msg.key : '';
    if (key === st.voiceKey) return;
    st.voiceKey = key;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (msg && root.Shiruvana && typeof root.Shiruvana.voice === 'function') box.appendChild(root.Shiruvana.voice({ kind: msg.kind, text: msg.text, basis: basisOf(msg) }));
  }
  // SHV-5c: de dónde lo sé, con la hora real de la última lectura (st.readAt), nunca una inventada.
  var SRC = { bad: 'tus Keys, consultadas en la API oficial', perm: 'los permisos de tus Keys (API oficial)', voe: 'tus puntos de maestría (API oficial)' };
  function basisOf(msg) {
    var b = { source: SRC[String(msg.key).split(':')[0]] || 'tus cuentas (API oficial)', at: st.readAt || null }, C = root.ShvCore;
    return C && typeof C.basisText === 'function' ? C.basisText(b) : b.source + ' · en este navegador';
  }

  // «Usar esta»: el mismo camino que el selector de arriba (app.js escucha su «change»).
  function useAccount(fp) {
    var tk = st.tokens[fp], sel = byId('keySelectGlobal');
    if (!tk || !sel) return false;
    sel.value = tk;
    if (typeof root.Event === 'function' && sel.dispatchEvent) sel.dispatchEvent(new root.Event('change', { bubbles: true }));
    if (root.toast) root.toast('success', 'Cuenta activa: ' + ((st.cards[fp] && (st.cards[fp].name || st.cards[fp].label)) || 'cambiada'), { ttl: 1800 });
    return true;
  }

  function goTab(id, focus) {
    st.ui.tab = id === 'vault' ? 'vault' : 'mine';
    render();
    var b = focus && byId('cvTab-' + st.ui.tab);
    if (b && b.focus) b.focus();
  }

  function attrOf(t) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) {
      if (!n.getAttribute) continue;
      var a = { act: n.getAttribute('data-cv'), tab: n.getAttribute('data-cv-tab'), type: n.getAttribute('data-cv-type'), use: n.getAttribute('data-cv-use') };
      if (a.act || a.tab || a.type || a.use) return a;
    }
    return null;
  }

  function wire(host) {
    host.addEventListener('click', function (e) {
      var X = vault();
      if (X && st.ui.tab === 'vault' && X.onClick(e)) return;
      var a = attrOf(e.target);
      if (!a) return;
      if (a.tab) { goTab(a.tab, false); return; }
      if (a.use) { useAccount(a.use); return; }
      if (a.act === 'keys') { var b = byId('keysMenuBtn'); if (b && b.click) b.click(); return; }
      if (a.act === 'refresh') { if (root.toast) root.toast('info', 'Actualizando tus cuentas…', { ttl: 1500 }); load(true); return; }
      if (a.type) { st.ui.type = a.type; render(); }
    });
    host.addEventListener('keydown', function (e) {
      var X = vault();
      if (X && st.ui.tab === 'vault' && X.onKeydown(e)) return;
      var t = e && e.target, id = t && t.getAttribute && t.getAttribute('data-cv-tab');
      if (!id) return;
      var k = e.key, next = null;
      if (k === 'ArrowRight' || k === 'ArrowLeft') next = id === 'mine' ? 'vault' : 'mine';
      else if (k === 'Home') next = 'mine'; else if (k === 'End') next = 'vault';
      if (!next) return;
      if (e.preventDefault) e.preventDefault();
      goTab(next, true);
    });
    host.addEventListener('change', function (e) { var X = vault(); if (X && st.ui.tab === 'vault') X.onChange(e); });
    host.addEventListener('input', function (e) {
      var t = e && e.target, X = vault();
      if (X && st.ui.tab === 'vault' && X.onInput(e)) return;
      if (!t || t.id !== 'cvQ') return;
      st.ui.q = String(t.value || '');
      render();
    });
  }

  function visible() { return hash() === ROUTE && !isHidden(byId(PANEL)); }

  function onShow() {
    if (!visible()) { st.shown = false; return; }
    var first = !st.shown;
    st.shown = true;
    loadCat().then(function () { if (first) { st.ui.tab = 'mine'; load(false); } else render(); });
  }

  function init() {
    if (doc.addEventListener) {
      doc.addEventListener('gn:boot-ready', function () { setTimeout(onShow, 0); });
      doc.addEventListener('gn:nav-active', function () { setTimeout(onShow, 50); });
      doc.addEventListener('gn:tokenchange', function () { setTimeout(function () { if (visible()) render(); }, 80); });
    }
    if (root.addEventListener) {
      root.addEventListener('hashchange', function () { setTimeout(onShow, 50); });
      // otra pestaña cambió la lista de Keys: vuelvo a leer lo que falte
      root.addEventListener('storage', function (e) { if (e && e.key === 'gn:account:keys' && visible()) load(false); });
    }
    onShow();
  }

  root.AccView = {
    version: VERSION, render: render, refresh: function () { return load(true); },
    getSnapshot: function () { return { cards: list(), ui: Object.assign({}, st.ui), loading: st.loading }; },
    _pure: { esc: esc, fold: fold, fmt: fmt, date: date, ago: ago, fingerprint: fingerprint, compactMeta: compactMeta, expandMeta: expandMeta, allPerms: allPerms,
      deriveCard: deriveCard, placeholder: placeholder, sortCards: sortCards, filterCards: filterCards, permList: permList, pickVoice: pickVoice,
      statsHTML: statsHTML, cardHTML: cardHTML, tabsHTML: tabsHTML, viewHTML: viewHTML, CSS: CSS, ROUTE: ROUTE, PANEL: PANEL, CARDS_KEY: CARDS_KEY, META_KEY: META_KEY, CARD_TTL: CARD_TTL }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', init);
  else if (doc) init();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
