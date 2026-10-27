/*!
 * js/shiruvana-places.js — Dónde le hablo al jugador (DEC-025)
 * Versión: 1.4.0
 *
 * Pongo mi voz (js/shiruvana.js) en estos lugares, sin tocar el código de cada módulo:
 *  - la Bienvenida: sin API Key me presento y te llevo a los tres pasos; con API Key soy
 *    «Shiruvana te guía»: un mensaje por vez, lo más importante primero (BL-058, WEL-3);
 *  - el modal de API Keys: qué necesito y dónde quedan tus datos;
 *  - el modal de guías: por cuál empezar;
 *  - mi rincón (DEC-034): al pie de la Sidebar en desktop y de la hoja «Más» en el celular.
 *
 * «Shiruvana te guía» lee Welcome.orientation() (js/welcome-panel.js 2.1.0: Keys, permisos, copia,
 * configuración y por dónde seguir) y la Key activa. Prioridades:
 *   1. lo que impide que la Bóveda funcione (la Key activa sin el permiso «cuenta»);
 *   2. permisos faltantes; 3. copia de seguridad pendiente; 4. configuración incompleta
 *   (Keys sin verificar); 5. por dónde seguir; 6. orientación general (un truco por día).
 * Solo hablo de la Bóveda (DEC-032): nunca de horarios, eventos, metas activas ni del contenido
 * de otro módulo. Los botones con data-act los atiende la Bienvenida; yo solo los pongo.
 *
 * 1.1.0 (WEL-3): «Shiruvana te guía», con «Siguiente» y «Preguntame»; el texto del modal de Keys
 *   deja de prometer la sincronización deprecada (DEC-030) y el saludo deja de nombrar la barra lateral.
 * 1.2.0 (WEL-4): con «Siguiente» o «Preguntame» el mensaje nuevo se anuncia en una región «polite»
 *   (#shvGuideLive, fuera de .panel__body) para quien usa lector de pantalla; el foco no se mueve.
 * 1.3.0 (SBR-4, BL-061): mi rincón global (DEC-034). Avatar de 48 px, «Shiruvana», una sola línea con el
 *   estado de la Bóveda y como mucho un enlace a Inicio: «Empezá por tu API Key», «Todo en orden en tu
 *   Bóveda» o cuántas cosas hay para revisar y cuál va primero, con las prioridades de «Shiruvana te guía».
 *   Uno solo a la vista: el de la Sidebar en desktop y el de la hoja «Más» en el celular. No interrumpo:
 *   no se abre nada solo y no hablo de horarios, eventos, metas ni del contenido de ningún módulo.
 * 1.3.1 (BL-071 GUI-5): las guías se llaman «Primeros pasos» y «Guía por módulo»; la copia se guarda desde Ajustes
 *   (el botón «Backup» ya no existe) y el selector de cuenta está al lado de «Keys».
 * 1.4.0 (BL-059 SHV-1): cada mensaje de «Shiruvana te guía» dice de dónde lo sé (línea «Lo sé por: …» de
 *   js/shiruvana.js 1.1.0). Todo sale de lo que guardaste en este navegador; la forma de los mensajes no cambia.
 */
(function (root) {
  'use strict';
  var VERSION = '1.4.0';

  var TEXTS = {
    welcomeNew: [
      'Hola, soy Shiruvana y te acompaño en La Bóveda.',
      'Con una API Key de tu cuenta te muestro tu cartera, tu armería legendaria y lo que vas logrando. Sin Key ya podés usar Metas y Eventos. Te llevo paso a paso: son tres, acá abajo.'
    ],
    welcomeBack: [
      'Hola de nuevo, soy Shiruvana.',
      'Tus módulos están acá abajo, en «¿Qué puedo hacer aquí?». Si querés repasar cómo funciona algo, la guía está a un clic.'
    ],
    keys: [
      'Para mostrarte tus datos necesito una API Key de tu cuenta de Guild Wars 2. La creás en account.arena.net/applications marcando los 7 permisos que te detallo abajo.',
      'Tu clave queda guardada solo en este navegador y viaja únicamente a la API oficial de ArenaNet. Para no perderla, guardá una copia desde Ajustes.'
    ],
    guide: [
      'Si recién llegás, empezá por «Primeros pasos»: en pocos minutos tenés todo andando.',
      'La «Guía por módulo» te cuenta cada uno en detalle, para cuando quieras sacarle todo el jugo.'
    ]
  };

  var ANET = 'https://account.arena.net/applications';

  // Trucos de la Bóveda: cómo se usa la Bóveda, nunca qué hacer en el juego.
  var TIPS = [
    'Arriba tenés el selector de cuenta: cuando la cambiás, todos los módulos se actualizan solos con esa cuenta.',
    'Con «Cambiar», en «Tu Bóveda», elegís entre 19 themes. El oficial es Gato Negro.',
    'La copia de seguridad guarda tus Keys, cuentas y ajustes en un archivo: con «Restaurar» los recuperás en otro navegador.',
    'Metas y Eventos funciona aunque no tengas ninguna API Key cargada.',
    'La «Guía por módulo» cuenta qué hace cada módulo y qué guarda en tu navegador.',
    'Cada vez que la Bóveda suma algo nuevo, lo anoto en «Novedades», acá abajo.'
  ];

  // Preguntame: respuestas fijas sobre la Bóveda, sin red.
  var ASK = [
    { id: 'review', q: '¿Qué hay que revisar?' },
    { id: 'safe', q: '¿Mis Keys están seguras?', kind: 'explica', text: [
      'Tus Keys y cuentas se guardan solo en este navegador. La Bóveda no tiene servidor: nadie más las ve.',
      'La Key viaja únicamente a la API oficial de ArenaNet. Por eso es importante la copia: si borrás los datos del navegador, la copia es lo único que las trae de vuelta.'
    ], actions: [{ label: 'Guardar copia', act: 'backup' }] },
    { id: 'perm', q: '¿Qué es un permiso?', kind: 'explica', text: [
      'Un permiso es lo que tu API Key deja leer de tu cuenta. La Bóveda usa 7: cuenta, cartera, progreso, desbloqueos, inventarios, bazar y personajes.',
      'Si falta uno, el módulo que lo necesita muestra menos de lo que tenés. Se arregla creando una Key nueva con todos tildados.'
    ], actions: [{ label: 'Revisar Keys', act: 'manage-keys' }, { label: 'account.arena.net ↗', href: ANET, ext: true }] },
    { id: 'switch', q: '¿Cómo cambio de cuenta?', kind: 'explica', text: [
      'Arriba, al lado de «Keys», está el selector de cuenta. Elegís otra y todos los módulos se actualizan con esa cuenta.',
      'Para sumar una cuenta nueva, agregá su API Key.'
    ], actions: [{ label: 'Gestionar Keys', act: 'manage-keys' }] },
    { id: 'tip', q: 'Un truco de la Bóveda', kind: 'explica' }
  ];

  var PRIORITY = { blocked: 1, keys: 2, backup: 3, verify: 4, 'continue': 5, general: 6 };

  var guide = { idx: 0, sig: '', ask: null, say: '' };

  function doc() { return root.document; }
  function dayIndex(now) { return Math.floor((typeof now === 'number' ? now : Date.now()) / 864e5); }

  function storeGet(k) {
    try { return root.Storage && root.Storage.get(k); } catch (_) { return null; }
  }
  function hasKeys() {
    var k = storeGet('gn:account:keys');
    return Array.isArray(k) && k.length > 0;
  }
  function activeKey() {
    var keys = storeGet('gn:account:keys');
    if (!Array.isArray(keys)) return null;
    var sel = storeGet('gn:account:selected'), first = null;
    for (var i = 0; i < keys.length; i++) {
      if (!keys[i] || !keys[i].value) continue;
      if (keys[i].value === sel) return keys[i];
      if (!first) first = keys[i];
    }
    return first;
  }
  function keyName(k) { return String((k && k.label) || '').trim() || 'sin nombre'; }

  // ---------------------------------------------------------------- la guía (pura)
  /**
   * Arma los mensajes de «Shiruvana te guía», ordenados por prioridad.
   * @param {Array|null} orient  Welcome.orientation()
   * @param {object|null} active la Key activa ({label, value, perms})
   * @param {number} [now]
   */
  function guideItems(orient, active, now) {
    if (!Array.isArray(orient)) return null;
    if (orient.length && orient[0].id === 'start') return [{ id: 'start', kind: 'saluda', text: TEXTS.welcomeNew, actions: [] }];
    var items = [];
    var blocked = active && Array.isArray(active.perms) && active.perms.indexOf('account') < 0;
    if (blocked) {
      items.push({ id: 'blocked', kind: 'advierte', text: [
        'La Key activa, ' + keyName(active) + ', no tiene el permiso «cuenta»: sin él no puedo mostrarte nada de tu cuenta en ningún módulo.',
        'Creá una Key nueva con los 7 permisos en account.arena.net y reemplazala.'
      ], actions: [{ label: 'Revisar Keys', act: 'manage-keys' }, { label: 'account.arena.net ↗', href: ANET, ext: true }] });
    }
    orient.forEach(function (o) {
      var title = String(o.title || '');
      if (o.id === 'keys') {
        // Si la única Key con problemas es la activa bloqueada, ya lo dije arriba.
        if (blocked && title === 'A la Key de ' + keyName(active) + ' le faltan permisos') return;
        items.push({ id: 'keys', kind: 'advierte', text: [
          title + '.',
          'Los módulos que necesitan esos permisos van a mostrar menos de lo que tenés. En «Tu Bóveda» te dejé el detalle y cómo arreglarlo.'
        ], actions: [{ label: 'Revisar Keys', act: 'manage-keys' }] });
      } else if (o.id === 'backup') {
        items.push({ id: 'backup', kind: 'advierte', text: [
          title + '.',
          'Tus Keys, cuentas y ajustes viven solo en este navegador: guardá una copia, se descarga en un segundo.'
        ], actions: [{ label: 'Guardar copia', act: 'backup' }] });
      } else if (o.id === 'verify') {
        items.push({ id: 'verify', kind: 'explica', text: [
          title + '.',
          'No es un problema: es una Key que guardaste antes de que la Bóveda anotara sus permisos. Si la volvés a guardar, la reviso.'
        ], actions: [{ label: 'Gestionar Keys', act: 'manage-keys' }] });
      } else if (o.id === 'continue' && o.href) {
        var where = title.replace(/^Seguir en /, '');
        items.push({ id: 'continue', kind: 'recomienda', text: [
          (items.length ? 'Lo demás está en orden. ' : 'Todo en orden en tu Bóveda. ') + 'La última vez estuviste en ' + where + '. ¿Seguimos?'
        ], actions: [{ label: 'Continuar en ' + where + ' →', href: o.href }] });
      }
    });
    items.sort(function (a, b) { return PRIORITY[a.id] - PRIORITY[b.id]; });
    items.push({ id: 'general', kind: 'explica', text: [
      items.length ? 'Eso es todo lo que tenía para revisar.' : 'Todo en orden en tu Bóveda.',
      'Un truco: ' + TIPS[dayIndex(now) % TIPS.length]
    ], actions: [{ label: 'Ver la guía', href: 'docs/user-guide.html', ext: true }] });
    return items;
  }

  function askMessage(id, now) {
    for (var i = 0; i < ASK.length; i++) {
      var a = ASK[i];
      if (a.id !== id) continue;
      if (id === 'tip') return { id: 'ask-tip', kind: 'explica', text: [TIPS[(dayIndex(now) + 1) % TIPS.length]], actions: [] };
      if (!a.text) return null;
      return { id: 'ask-' + id, kind: a.kind, text: a.text, actions: a.actions || [] };
    }
    return null;
  }

  // ---------------------------------------------------------------- la guía (DOM)
  var GUIDE_CSS = [
    '.shv-guide__count{margin-left:8px;font-weight:500;font-size:.8rem;color:var(--tx-3,var(--muted))}',
    '.shv-guide__acts,.shv-guide__ask{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}',
    '.shv-guide__ask{gap:6px;margin-top:10px;padding-top:8px;border-top:1px dashed var(--bd-1,var(--panel-border))}',
    '.shv-guide__ask>span{font-size:.78rem;color:var(--tx-3,var(--muted));margin-right:2px}',
    '.shv-guide__btn{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;border:1px solid var(--bd-1,var(--panel-border));' +
      'background:var(--bg-0,transparent);color:var(--tx-2,var(--text));font:inherit;font-size:.8rem;cursor:pointer;text-decoration:none}',
    '.shv-guide__btn--pri{border-color:var(--acc-1);color:var(--tx-1,var(--text));font-weight:600}',
    '.shv-guide__btn:hover,.shv-guide__btn[aria-pressed="true"]{border-color:var(--acc-1);color:var(--tx-1,var(--text))}',
    '.shv-guide__btn:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:720px){.shv-guide__btn{min-height:44px}}',
    '.shv-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}'
  ].join('\n');

  function ensureGuideCSS(d) {
    if (d.getElementById('shv-guide-css')) return;
    var st = d.createElement('style');
    st.id = 'shv-guide-css';
    st.textContent = GUIDE_CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  function button(d, label, attrs, extraClass) {
    var isLink = !!attrs.href;
    var b = d.createElement(isLink ? 'a' : 'button');
    b.className = 'shv-guide__btn' + (extraClass ? ' ' + extraClass : '');
    if (!isLink) b.setAttribute('type', 'button');
    Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) b.setAttribute(k, attrs[k]); });
    b.textContent = label;
    return b;
  }

  // De dónde lo sé (BL-059 SHV-1, DEC-033): todo sale de lo que guardaste en este navegador.
  var BASIS = {
    blocked: 'los permisos guardados de la Key activa · en este navegador',
    keys: 'los permisos guardados de tus Keys · en este navegador',
    backup: 'la fecha de tu última copia · en este navegador',
    verify: 'tus Keys guardadas · en este navegador',
    'continue': 'tus últimas visitas a la Bóveda · en este navegador',
    general: 'tus Keys, sus permisos y tu copia · en este navegador'
  };

  function guideVoice(items, now) {
    var d = doc();
    var ask = guide.ask ? askMessage(guide.ask, now) : null;
    var idx = Math.min(guide.idx, items.length - 1);
    var msg = ask || items[idx];
    var el = root.Shiruvana.voice({ kind: msg.kind, size: 'lg', text: msg.text, basis: BASIS[msg.id] || null });
    el.setAttribute('data-shv-guide', msg.id);
    if (msg.id === 'start') return el;

    ensureGuideCSS(d);
    el.setAttribute('aria-label', 'Shiruvana te guía');
    var label = el.querySelector('.shv-voice__label');
    var main = el.querySelector('.shv-voice__main');
    if (label) {
      label.textContent = 'Shiruvana te guía';
      var count = d.createElement('span');
      count.className = 'shv-guide__count';
      count.textContent = ask ? 'Preguntame' : (items.length > 1 ? (idx + 1) + ' de ' + items.length + (idx === 0 ? ' · lo más importante primero' : '') : '');
      if (count.textContent) label.appendChild(count);
    }
    guide.say = (ask ? 'Preguntame. ' : (items.length > 1 ? (idx + 1) + ' de ' + items.length + '. ' : '')) +
      [].concat(msg.text).join(' ');
    if (!main) return el;

    var acts = d.createElement('div');
    acts.className = 'shv-guide__acts';
    msg.actions.forEach(function (a, i) {
      acts.appendChild(button(d, a.label, a.href
        ? { href: a.href, target: a.ext ? '_blank' : null, rel: a.ext ? 'noopener' : null }
        : { 'data-act': a.act }, i === 0 ? 'shv-guide__btn--pri' : ''));
    });
    if (ask) acts.appendChild(button(d, '← Volver a lo importante', { 'data-guide': 'back' }));
    else if (idx < items.length - 1) acts.appendChild(button(d, 'Siguiente →', { 'data-guide': 'next' }));
    if (acts.firstChild) main.appendChild(acts);

    var row = d.createElement('div');
    row.className = 'shv-guide__ask';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Preguntame');
    var lead = d.createElement('span');
    lead.textContent = 'Preguntame:';
    row.appendChild(lead);
    ASK.forEach(function (a) {
      var on = a.id === 'review' ? !guide.ask : guide.ask === a.id;
      row.appendChild(button(d, a.q, { 'data-ask': a.id, 'aria-pressed': on ? 'true' : 'false' }));
    });
    main.appendChild(row);
    el.addEventListener('click', onGuideClick);
    return el;
  }

  function onGuideClick(e) {
    var t = e && e.target && e.target.closest ? e.target.closest('[data-guide],[data-ask]') : null;
    if (!t) return;
    if (e.preventDefault) e.preventDefault();
    var g = t.getAttribute('data-guide'), a = t.getAttribute('data-ask');
    var focusSel;
    if (g === 'next') { guide.idx++; guide.ask = null; focusSel = 'next'; }
    else if (g === 'back' || a === 'review') { guide.idx = 0; guide.ask = null; focusSel = 'review'; }
    else if (a) { guide.ask = guide.ask === a ? null : a; focusSel = a; }
    refreshGuide(focusSel);
  }

  // Redibuja mi mensaje en el mismo lugar y devuelve el foco al botón equivalente.
  function refreshGuide(focus) {
    var body = doc().querySelector('#welcomePanel .panel__body');
    var prev = body && body.querySelector('[data-shv-place="welcome"]');
    if (!prev) return null;
    var el = buildWelcome();
    if (!el) return null;
    el.setAttribute('data-shv-place', 'welcome');
    body.replaceChild(el, prev);
    announce(guide.say);
    var target = focus === 'next'
      ? (el.querySelector('[data-guide="next"]') || el.querySelector('[data-ask="review"]'))
      : el.querySelector('[data-ask="' + focus + '"]');
    if (target && target.focus) target.focus();
    return el;
  }

  // Región «polite» fija en #welcomePanel (fuera de .panel__body, que la Bienvenida redibuja).
  function announce(text) {
    var d = doc(), host = d.getElementById('welcomePanel');
    if (!host || !text) return;
    ensureGuideCSS(d);
    var live = d.getElementById('shvGuideLive');
    if (!live) {
      live = d.createElement('div');
      live.id = 'shvGuideLive';
      live.className = 'shv-sr';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      host.appendChild(live);
    }
    live.textContent = text;
  }

  function buildWelcome() {
    if (!root.Shiruvana) return null;
    var W = root.Welcome;
    var orient = null;
    if (hasKeys() && W && typeof W.orientation === 'function') {
      try { orient = W.orientation(); } catch (_) { orient = null; }
    }
    var items = hasKeys()
      ? guideItems(orient, activeKey())
      : [{ id: 'start', kind: 'saluda', text: TEXTS.welcomeNew, actions: [] }];
    if (!items) return root.Shiruvana.voice({ kind: 'saluda', size: 'lg', text: TEXTS.welcomeBack });
    var sig = items.map(function (x) { return x.id; }).join('|');
    if (sig !== guide.sig) { guide.sig = sig; guide.idx = 0; guide.ask = null; }
    return guideVoice(items);
  }

  // ---------------------------------------------------------------- mi rincón (SBR-4, DEC-034)
  // Lo que va primero, en pocas palabras. Solo estado de la Bóveda (N1–N2 de DEC-033).
  var CORNER_SHORT = {
    blocked: 'tu Key activa no tiene el permiso «cuenta»',
    keys: 'faltan permisos en tus Keys',
    backup: 'tu copia de seguridad',
    verify: 'Keys sin sus permisos anotados'
  };
  var CORNER_HOSTS = ['appSidebar', 'sbrSheet']; // pie de la Sidebar (desktop) y de la hoja «Más» (celular)
  var CORNER_CSS = [
    '.shv-corner.shv-voice{display:flex;align-items:center;gap:10px;margin:12px 0 0;padding:10px 12px;' +
      'border:1px solid var(--bd-1,var(--panel-border));border-radius:12px;background:var(--bg-1,transparent)}',
    '.shv-corner .shv-voice__avatar{width:48px;height:48px;flex-shrink:0;border-radius:50%}',
    '.shv-corner .shv-voice__main{min-width:0}',
    '.shv-corner .shv-voice__label{margin:0;font-size:.75rem;font-weight:700;color:var(--tx-1,var(--text))}',
    '.shv-corner .shv-voice__body p{margin:2px 0 0;font-size:.82rem;line-height:1.35;color:var(--tx-2,var(--text))}',
    '.shv-corner[data-level="warn"]{border-color:var(--gn-gold,var(--color-amber))}',
    '.shv-corner__link{display:inline-flex;align-items:center;min-height:32px;font-size:.8rem;font-weight:600;color:var(--acc-1);text-decoration:underline}',
    '.shv-corner__link:focus-visible{outline:2px solid var(--acc-1);outline-offset:2px}',
    '@media (max-width:900px){#appSidebar>.shv-corner{display:none}#sbrSheet .shv-corner__link{min-height:44px}}',
    '@media (min-width:901px){#sbrSheet>.shv-corner{display:none}}'
  ].join('\n');

  /**
   * Qué digo en el rincón: una línea y como mucho un enlace.
   * @param {boolean} keysLoaded  si hay alguna API Key cargada
   * @param {Array|null} orient   Welcome.orientation()
   * @param {object|null} active  la Key activa
   */
  function cornerMessage(keysLoaded, orient, active) {
    if (!keysLoaded) return { level: 'warn', text: 'Empezá por tu API Key: te llevo paso a paso en Inicio.', link: { label: 'Ir a Inicio', href: '#/welcome' } };
    var todo = (guideItems(Array.isArray(orient) ? orient : [], active) || []).filter(function (x) { return CORNER_SHORT[x.id]; });
    if (!todo.length) return { level: 'ok', text: 'Todo en orden en tu Bóveda.', link: null };
    var first = CORNER_SHORT[todo[0].id];
    return { level: 'warn', text: todo.length === 1 ? 'Tengo 1 cosa para revisar: ' + first + '.'
      : 'Tengo ' + todo.length + ' cosas para revisar; la primera: ' + first + '.', link: { label: 'Ver en Inicio', href: '#/welcome' } };
  }

  function ensureCornerCSS(d) {
    if (d.getElementById('shv-corner-css')) return;
    var st = d.createElement('style');
    st.id = 'shv-corner-css';
    st.textContent = CORNER_CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  function cornerEl(msg, sig) {
    var d = doc();
    var el = root.Shiruvana.voice({ kind: msg.level === 'warn' ? 'advierte' : 'saluda', text: msg.text });
    el.className += ' shv-corner';
    el.setAttribute('data-shv-place', 'corner');
    el.setAttribute('data-level', msg.level);
    el.setAttribute('data-sig', sig);
    el.setAttribute('aria-label', 'Shiruvana');
    var label = el.querySelector('.shv-voice__label');
    if (label) label.textContent = 'Shiruvana';
    if (msg.link) {
      var a = d.createElement('a');
      a.className = 'shv-corner__link';
      a.setAttribute('href', msg.link.href);
      a.textContent = msg.link.label;
      // En la hoja «Más», ir a Inicio la cierra (la abre y la cierra js/sidebar-nav.js).
      a.addEventListener('click', function () {
        var S = root.SidebarNav;
        if (S && typeof S.closeSheet === 'function') S.closeSheet();
      });
      (el.querySelector('.shv-voice__main') || el).appendChild(a);
    }
    return el;
  }

  // Pone o actualiza mi rincón en cada lugar que exista. Solo lo rearma si cambió lo que digo.
  function corner() {
    var d = doc();
    if (!root.Shiruvana || typeof d.getElementById !== 'function') return [];
    var keysLoaded = hasKeys(), orient = null;
    if (keysLoaded) {
      var W = root.Welcome;
      if (!W || typeof W.orientation !== 'function') return []; // sin la Bienvenida no sé qué falta: no invento
      try { orient = W.orientation(); } catch (_) { return []; }
    }
    var msg = cornerMessage(keysLoaded, orient, activeKey());
    var sig = msg.level + '|' + msg.text;
    var out = [];
    CORNER_HOSTS.forEach(function (id) {
      var host = d.getElementById(id);
      if (!host) return;
      ensureCornerCSS(d);
      var prev = host.querySelectorAll('[data-shv-place="corner"]');
      if (prev.length === 1 && prev[0].getAttribute('data-sig') === sig) { out.push(prev[0]); return; }
      prev.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      var el = cornerEl(msg, sig);
      host.appendChild(el);
      out.push(el);
    });
    return out;
  }

  // ---------------------------------------------------------------- lugares
  function placeEl(container, el, marker) {
    if (!container || !el) return null;
    var prev = container.querySelector('[data-shv-place="' + marker + '"]');
    if (prev) return prev;
    el.setAttribute('data-shv-place', marker);
    container.insertBefore(el, container.firstChild);
    return el;
  }

  // Inserta mi mensaje al principio del contenedor, una sola vez por lugar.
  function place(container, opts, marker) {
    if (!container || !root.Shiruvana) return null;
    var prev = container.querySelector('[data-shv-place="' + marker + '"]');
    if (prev) return prev;
    return placeEl(container, root.Shiruvana.voice(opts), marker);
  }

  function welcome() {
    var body = doc().querySelector('#welcomePanel .panel__body');
    if (!body || !body.firstChild || !root.Shiruvana) return null; // todavía no se dibujó
    var prev = body.querySelector('[data-shv-place="welcome"]');
    if (prev) return prev;
    return placeEl(body, buildWelcome(), 'welcome');
  }

  function keys() {
    return place(doc().querySelector('#keysModal .modal__body'), { kind: 'explica', text: TEXTS.keys }, 'keys');
  }

  function guideModal() {
    var body = doc().querySelector('#guideModal .modal__body');
    if (!body) return null;
    // Mi recomendación reemplaza la frase genérica de arriba.
    var intro = body.querySelector('p.muted');
    if (intro && /^Elegí la guía/.test(String(intro.textContent).trim()) && intro.parentNode) intro.parentNode.removeChild(intro);
    return place(body, { kind: 'recomienda', text: TEXTS.guide }, 'guide');
  }

  function init() {
    keys();
    guideModal();
    welcome();
    var panel = doc().getElementById('welcomePanel');
    if (panel && typeof root.MutationObserver === 'function') {
      // La Bienvenida se vuelve a dibujar cada vez que cambia algo: reaparezco (una vez) con lo de ahora.
      new root.MutationObserver(function () { welcome(); corner(); }).observe(panel, { childList: true, subtree: true });
    }
    // Mi rincón: la Sidebar y la hoja «Más» se arman en DOMContentLoaded (js/sidebar-nav.js, que se carga antes).
    corner();
    var d = doc();
    if (d.readyState !== 'complete') d.addEventListener('DOMContentLoaded', function () { corner(); });
    d.addEventListener('gn:tokenchange', function () { corner(); });
    // Guardar una copia o cambiar una Key se hace con un clic: después del clic miro si cambió algo.
    d.addEventListener('click', function () { if (typeof setTimeout === 'function') setTimeout(corner, 0); }, true);
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('storage', function () { corner(); });
      root.addEventListener('hashchange', function () { corner(); });
    }
  }

  root.ShiruvanaPlaces = {
    init: init, TEXTS: TEXTS, TIPS: TIPS, ASK: ASK, welcome: welcome, keys: keys, guide: guideModal,
    guideItems: guideItems, askMessage: askMessage, refresh: refreshGuide, version: VERSION,
    corner: corner, cornerMessage: cornerMessage, CORNER_SHORT: CORNER_SHORT, CORNER_CSS: CORNER_CSS
  };

  if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', init);
  else init();

})(typeof window !== 'undefined' ? window : globalThis);
