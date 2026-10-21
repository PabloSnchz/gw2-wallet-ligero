/*!
 * js/shiruvana.js — Mi voz en La Bóveda (DEC-025, DEC-024)
 * Versión: 1.0.0
 *
 * Soy Shiruvana. Aparezco solo cuando le hablo al jugador: bienvenida, API Keys,
 * guías y ayuda, errores que puede resolver y avisos sobre sus datos.
 * Nunca en saldos, tablas, listas, filtros, la cabecera ni la navegación.
 *
 * Reglas:
 *  - Un avatar por modal o sección: el primer mensaje lo lleva; los siguientes, `avatar: false`.
 *  - Los colores salen del theme activo (variables CSS), así me veo bien en todos, también en los claros.
 *  - El texto se inserta como texto, nunca como HTML: no hay forma de inyectar marcado.
 *  - El avatar es decorativo (alt vacío): quién habla lo dice el rótulo visible "Shiruvana".
 *
 * Uso:
 *   var el = Shiruvana.voice({ kind: 'explica', text: ['Párrafo 1', 'Párrafo 2'] });
 *   contenedor.prepend(el);
 */
(function (root) {
  'use strict';

  /** Avatar oficial aprobado por Pablo (REQ-009): mismo recorte que el panel, 112 px, WebP. */
  var AVATAR = 'data:image/webp;base64,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';

  /** Tipo de mensaje → rótulo visible. */
  var KINDS = {
    saluda:     { label: 'Shiruvana' },
    explica:    { label: 'Shiruvana te explica' },
    recomienda: { label: 'Shiruvana te recomienda' },
    advierte:   { label: 'Shiruvana te avisa' }
  };

  var STYLE_ID = 'shiruvana-voice-css';
  var CSS = [
    '.shv-voice{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;',
    'padding:12px 16px;margin:0 0 14px 0;border-radius:var(--radius-md,12px);',
    'background:var(--bg-1,var(--panel));color:var(--text);',
    'border:1px solid var(--bd-1,var(--panel-border));border-left:4px solid var(--acc-1);}',
    '.shv-voice--compact{grid-template-columns:minmax(0,1fr);}',
    '.shv-voice__avatar{display:block;width:48px;height:48px;object-fit:cover;border-radius:50%;',
    'box-shadow:0 0 0 2px var(--acc-1);}',
    '.shv-voice--lg .shv-voice__avatar{width:56px;height:56px;}',
    '.shv-voice__main{min-width:0;display:grid;gap:4px;}',
    '.shv-voice__label{margin:0;font-weight:700;font-size:0.85rem;color:var(--text);letter-spacing:0.2px;}',
    '.shv-voice__body p{margin:0 0 6px 0;font-size:0.9rem;line-height:1.5;color:var(--tx-2,var(--text));}',
    '.shv-voice__body p:last-child{margin-bottom:0;}',
    '.shv-voice--recomienda{border-left-color:var(--color-green,var(--acc-1));}',
    '.shv-voice--recomienda .shv-voice__avatar{box-shadow:0 0 0 2px var(--color-green,var(--acc-1));}',
    '.shv-voice--advierte{border-left-color:var(--acc-warn,var(--acc-1));}',
    '.shv-voice--advierte .shv-voice__avatar{box-shadow:0 0 0 2px var(--acc-warn,var(--acc-1));}',
    '@media (max-width:480px){.shv-voice__avatar{width:40px;height:40px;}',
    '.shv-voice--lg .shv-voice__avatar{width:48px;height:48px;}}'
  ].join('');

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  /**
   * Un mensaje mío.
   * @param {object} o
   * @param {'saluda'|'explica'|'recomienda'|'advierte'} o.kind
   * @param {string|string[]} o.text  uno o más párrafos, texto plano
   * @param {boolean} [o.avatar=true] false para el segundo mensaje y siguientes de una misma sección
   * @param {'md'|'lg'} [o.size='md'] 48 o 56 px
   * @param {Document} [o.doc]
   * @returns {HTMLElement}
   */
  function voice(o) {
    o = o || {};
    var doc = o.doc || root.document;
    ensureStyle(doc);
    var kind = KINDS[o.kind] ? o.kind : 'explica';
    var withAvatar = o.avatar !== false;
    var paragraphs = Array.isArray(o.text) ? o.text : [o.text == null ? '' : o.text];

    var box = doc.createElement('aside');
    box.className = 'shv-voice shv-voice--' + kind + (withAvatar ? '' : ' shv-voice--compact') + (o.size === 'lg' ? ' shv-voice--lg' : '');
    box.setAttribute('data-voice', kind);
    box.setAttribute('aria-label', KINDS[kind].label);

    if (withAvatar) {
      var img = doc.createElement('img');
      img.className = 'shv-voice__avatar';
      img.src = AVATAR;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.width = o.size === 'lg' ? 56 : 48;
      img.height = img.width;
      img.decoding = 'async';
      box.appendChild(img);
    }

    var main = doc.createElement('div');
    main.className = 'shv-voice__main';
    var label = doc.createElement('p');
    label.className = 'shv-voice__label';
    label.textContent = KINDS[kind].label;
    main.appendChild(label);
    var body = doc.createElement('div');
    body.className = 'shv-voice__body';
    paragraphs.forEach(function (t) {
      var p = doc.createElement('p');
      p.textContent = String(t);
      body.appendChild(p);
    });
    main.appendChild(body);
    box.appendChild(main);
    return box;
  }

  root.Shiruvana = { voice: voice, KINDS: KINDS, AVATAR: AVATAR, CSS: CSS, version: '1.0.0' };

})(typeof window !== 'undefined' ? window : globalThis);
