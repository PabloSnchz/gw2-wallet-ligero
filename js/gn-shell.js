/*!
 * js/gn-shell.js — Un solo contenedor por módulo renovado (BL-070, pedido de Pablo del 2026-10-25)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.3.0 (2026-10-26) · BL-070 CTA-2: Cuentas renovado con el mismo ícono de cabecera (#cvRoot .cv-ico)
 *          1.2.0 (2026-10-25) · PUL-2: el ícono de la cabecera igual en los 9 módulos y cada módulo en el color de su botón de la barra lateral
 *          1.1.0 (2026-10-25) · PUL-1: la Armería Legendaria también tiene un solo contenedor
 *          1.0.0 (2026-10-25)
 *
 * Por qué existe: en Raids, Inventario y Personajes, Actividades, Logros y la Cámara del Brujo la
 * cabecera nueva es una caja con borde y degradado metida dentro del panel, que ya tiene su borde.
 * Se ve doble borde, el degradado del color del módulo queda encerrado en la cabecera y lo de abajo
 * toca el borde del panel. La Cartera y Metas y Eventos están bien: un solo contenedor, la cabecera
 * a todo el ancho y separada por una línea, y el contenido con aire a los costados.
 * Qué hace, solo con CSS y sin tocar las vistas:
 *  - el panel es el único contenedor: sin relleno propio y con el degradado del color del módulo de
 *    fondo, que se desvanece hacia la bandeja (--gn-tray de js/gn-surface.js);
 *  - la cabecera pierde su caja (borde, esquinas y fondo) y queda a todo el ancho, con una línea abajo;
 *  - el resto del módulo (pestañas, filtros, listas) va con 24 px a cada lado (12 px en el celular).
 * Cada regla depende de la clase o el id que pone la vista al montarse: si una vista no carga, su
 * panel queda como estaba. Vuelta atrás: sacar este archivo de js/modules.json.
 * Se carga por js/modules.json, después de gn-frame.js (DEC-035). Sin pedidos ni almacenamiento.
 */
(function (root) {
  'use strict';

  var VERSION = '1.3.0';
  var LOG = '[GNShell]';
  var SIDE = 24, SIDE_M = 12, TINT = 12, FADE = 300;
  // panel: selector del panel con la vista montada · head: lo que la vista inserta arriba ·
  // hero: su caja de cabecera · mod: color del módulo (el de la Bienvenida).
  var SHELLS = [
    { id: 'raids', panel: '#raidTrackerPanel.rv-on', head: '#rvRoot', hero: '.rv-hero', mod: 'var(--gn-mod,#F47C7C)', hex: '#F47C7C' },
    { id: 'inventory', panel: '#inventoryPanel.iv-on', head: '#ivRoot', hero: '.iv-hero', mod: 'var(--gn-mod,#7EC3FF)', hex: '#7EC3FF' },
    { id: 'activities', panel: '#activitiesPanel.av-on', head: '#avRoot', hero: '.av-hero', mod: 'var(--gn-mod,#3CC48A)', hex: '#3CC48A' },
    { id: 'achievements', panel: '#achievementsPanel.achx-on', head: '#achxHead', hero: '.achx-hero', mod: '#6EA3FF', hex: '#6EA3FF' },
    { id: 'wv', panel: '#wvPanel', head: '#wvxHead', hero: '.wvx-hero', mod: '#15C3B7', hex: '#15C3B7' },
    // La Armería (PUL-1): js/render-catologo.js dibuja su cabecera dentro de #legendaryArmoryBody >
    // #legendaryModeContent (body) y el panel no lleva clase al montarse: la marca es :has(.arm-hero).
    { id: 'armory', panel: '#legendaryArmoryPanel:has(.arm-hero)', head: '#legendaryArmoryBody', body: '#legendaryModeContent', hero: '.arm-hero', mod: '#E545CA', hex: '#E545CA' }
  ];

  // ------------------------------------------------------------------ CSS (puro)
  function shellCSS(s) {
    var P = s.panel, H = P + ' ' + s.head, B = s.body ? H + ' ' + s.body : H;
    return [
      // un solo contenedor: el panel, con el degradado del módulo de fondo
      P + '{padding:0 0 22px;background:linear-gradient(180deg,color-mix(in srgb,' + s.mod + ' ' + TINT + '%,transparent),transparent ' + FADE + 'px),var(--gn-tray,var(--bg-1))}',
      // la cabecera, sin caja: a todo el ancho y con una línea abajo
      P + ' ' + s.hero + '{border:0;border-bottom:1px solid var(--bd-1);border-radius:0;background:none;box-shadow:none;padding:20px ' + SIDE + 'px 18px}',
      // con body (la Armería) la cabecera vive adentro: sin relleno, para que vaya a todo el ancho
      s.body ? H + '{padding:0;margin:0}' : H + '{margin:0 0 12px}',
      // el resto, con aire a los costados
      P + '>:not(' + s.head + '),' + B + '>:not(' + s.hero + '){margin-left:' + SIDE + 'px;margin-right:' + SIDE + 'px}'
    ];
  }

  function mobileCSS(s) {
    var P = s.panel, H = P + ' ' + s.head, B = s.body ? H + ' ' + s.body : H;
    return P + ' ' + s.hero + '{padding:14px ' + SIDE_M + 'px 12px}' +
      P + '>:not(' + s.head + '),' + B + '>:not(' + s.hero + '){margin-left:' + SIDE_M + 'px;margin-right:' + SIDE_M + 'px}';
  }

  // PUL-2 (pedido de Pablo, 2026-10-25): el ícono de la cabecera igual en los 9 módulos, como el de la Cartera:
  // placa de 56 px con el ícono a 44 px, el fondo del theme (--bg-0), un borde fino y el brillo del color del
  // módulo en la barra lateral (el de la Bienvenida). En el celular, placa de 40 px con el ícono a 32 px.
  // wrap: la vista dibuja una placa con el <img> adentro; si no, el <img> es la placa (con su relleno).
  var ICONS = [
    { id: 'cards', sel: '#walletPanel .wn-hico,#walletDashboardPanel .wn-hico', wrap: true, color: '#F2B94B' },
    { id: 'meta', sel: '#metaPanel .mh-hico', wrap: true, color: '#A896FF' },
    { id: 'wv', sel: '#wvxHead .wvx-row>img', color: '#15C3B7' },
    { id: 'achievements', sel: '#achxHead .achx-row>img', color: '#6EA3FF' },
    { id: 'raids', sel: '#rvRoot .rv-ico', color: '#F47C7C' },
    { id: 'activities', sel: '#avRoot .av-ico', color: '#3CC48A' },
    { id: 'characters', sel: '#ivRoot .iv-ico', color: '#7EC3FF' },
    { id: 'armory', sel: '#legendaryArmoryPanel .arm-hrow>img', color: '#E545CA' },
    { id: 'homestead', sel: '#hsRoot .hs-ico', color: '#D9A55B' },
    { id: 'accounts', sel: '#cvRoot .cv-ico', color: '#8E96A3' }
  ];
  var PLATE = 56, ICO = 44, PLATE_M = 40, ICO_M = 32;
  // D1: las pestañas de Logros y la Cámara también en el color de su botón de la barra lateral.
  var TAB_FIX = '#achievementsPanel .achx-tabs [role=tab][aria-selected=true]{border-bottom-color:#6EA3FF}' +
    '#wvPanel .wvx-tabs [role=tab][aria-selected=true]{border-bottom-color:#15C3B7}';

  function each(sel, suffix) { return sel.split(',').map(function (x) { return x + suffix; }).join(','); }

  function iconCSS(list) {
    var out = [], mob = [];
    (list || ICONS).forEach(function (i) {
      var pad = i.wrap ? 0 : (PLATE - ICO) / 2, padM = i.wrap ? 0 : (PLATE_M - ICO_M) / 2;
      out.push(i.sel + '{width:' + PLATE + 'px;height:' + PLATE + 'px;padding:' + pad + 'px;box-sizing:border-box;border-radius:12px;' +
        'background:var(--bg-0);box-shadow:0 0 0 1px var(--bd-2),0 0 18px color-mix(in srgb,' + i.color + ' 18%,transparent);' +
        'flex-shrink:0;object-fit:contain' + (i.wrap ? ';display:grid;place-items:center' : '') + '}');
      if (i.wrap) out.push(each(i.sel, '>img') + '{width:' + ICO + 'px;height:' + ICO + 'px;object-fit:contain}');
      mob.push(i.sel + '{width:' + PLATE_M + 'px;height:' + PLATE_M + 'px;padding:' + padM + 'px}');
      if (i.wrap) mob.push(each(i.sel, '>img') + '{width:' + ICO_M + 'px;height:' + ICO_M + 'px}');
    });
    out.push(TAB_FIX);
    out.push('@media (max-width:900px){' + mob.join('') + '}');
    return out.join('\n');
  }

  function buildCSS(list) {
    var out = [];
    (list || SHELLS).forEach(function (s) { out = out.concat(shellCSS(s)); });
    out.push('@media (max-width:900px){' + (list || SHELLS).map(mobileCSS).join('') + '}');
    return out.join('\n');
  }

  var CSS = buildCSS(SHELLS) + '\n' + iconCSS(ICONS);

  // ------------------------------------------------------------------ DOM
  var doc = root.document;

  function inject() {
    if (!doc || !doc.createElement || !doc.head || (doc.getElementById && doc.getElementById('gn-shell-css'))) return false;
    var s = doc.createElement('style');
    s.id = 'gn-shell-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
    return true;
  }

  root.GNShell = {
    version: VERSION,
    _pure: { SHELLS: SHELLS, ICONS: ICONS, iconCSS: iconCSS, TAB_FIX: TAB_FIX, SIDE: SIDE, SIDE_M: SIDE_M, TINT: TINT, FADE: FADE, shellCSS: shellCSS, buildCSS: buildCSS, CSS: CSS }
  };

  if (doc && doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', inject);
  else inject();
  if (root.console && root.console.info) root.console.info(LOG, 'ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
