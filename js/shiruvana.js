/*!
 * js/shiruvana.js — Mi voz en La Bóveda (DEC-025, DEC-024)
 * Versión: 1.2.0
 *
 * 1.1.0 (BL-059 SHV-1): opción `basis` → línea «Lo sé por: …», el fundamento de lo que digo (DEC-033).
 * 2026-10-31 (BL-085, DEC-048): mi cara nueva, la figura ilustrada oficial. Solo cambia la imagen; la API es la misma.
 * 1.2.0 (BL-087): una cara por tipo de mensaje (FACES): saluda y recomienda = hola, explica = explica, advierte = ojo.
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

  /** Avatar oficial (DEC-048): cara de shiruvana-hola, 112 px, WebP, el mismo que el panel (gds/voice.js). */
  var AVATAR = 'data:image/webp;base64,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';

  /** Una cara por tipo de mensaje (BL-087): misma figura, otra pose; 112 px, WebP. */
  var FACE_EXPLICA = 'data:image/webp;base64,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';
  var FACE_OJO = 'data:image/webp;base64,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';
  var FACES = { saluda: AVATAR, recomienda: AVATAR, explica: FACE_EXPLICA, advierte: FACE_OJO };

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
    '.shv-voice__basis{margin:6px 0 0 0;font-size:0.78rem;line-height:1.4;color:var(--tx-2,var(--text));}',
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
   * @param {string} [o.basis] de dónde lo sé y cuándo; se muestra como «Lo sé por: …», texto plano
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
      img.src = FACES[kind] || AVATAR;
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
    if (o.basis) {
      var basis = doc.createElement('p');
      basis.className = 'shv-voice__basis';
      basis.textContent = 'Lo sé por: ' + String(o.basis);
      main.appendChild(basis);
    }
    box.appendChild(main);
    return box;
  }

  root.Shiruvana = { voice: voice, KINDS: KINDS, AVATAR: AVATAR, FACES: FACES, CSS: CSS, version: '1.2.0' };

})(typeof window !== 'undefined' ? window : globalThis);
