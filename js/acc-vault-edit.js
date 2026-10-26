/*!
 * js/acc-vault-edit.js — Editar el Llavero, importarlo desde Excel y guardarlo con el cifrado nuevo (BL-070, paso 4)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.1.0 (2026-10-26) · CTA-4b: «Importar desde Excel» y «Descargar plantilla» (window.AccVaultImport), en este
 *          mismo archivo porque el manifiesto llegó a su tope de 30 módulos (js/boot.js)
 *          1.0.0 (2026-10-26) · CTA-4a: editar, agregar, borrar y guardar
 *
 * Con el Llavero abierto (js/acc-vault-view.js):
 *  - «Agregar cuenta», «Editar» y «Borrar» (con confirmación). Editar cambia solo los campos que se ven;
 *    todo lo demás de la cuenta (también lo que no conozco) queda igual.
 *  - «Guardar con el cifrado nuevo» (D2): pide la contraseña dos veces (mínimo 8), cifra en el navegador
 *    con PBKDF2-SHA256 600.000 + AES-256-GCM, comprueba que el archivo nuevo se abre y da lo mismo, y
 *    recién ahí lo descarga como «…-v2.enc». Tu archivo de antes no se toca.
 *  - Deja una copia cifrada en este navegador para no elegir el archivo cada vez (D3), en accounts:vault2,
 *    fuera de gn: para que el respaldo del Gist no la suba. La copia del formato viejo queda hasta promover:
 *    DEV y producción comparten el almacenamiento del navegador y producción todavía la usa.
 *  - «Importar desde Excel» lee la plantilla de siempre (id, nombre, email, password, gmailPassword, apiKey,
 *    twitch_user, twitch_email, twitch_password, geforce_linked, notas, tags) y abre el Llavero sin guardar.
 * Nunca escribe nada en claro: ni archivo, ni almacenamiento. Lo dibuja y le pasa los eventos acc-vault-view.
 * Se carga por js/modules.json (DEC-035), antes de acc-view.js.
 */
(function (root) {
  'use strict';

  var VERSION = '1.1.0';
  var V2_KEY = 'accounts:vault2';      // copia cifrada nueva (D3)
  var OLD_KEY = 'accounts:lastFile';   // copia del formato viejo: queda hasta promover (la usa producción)
  var MIN_PASS = 8;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  var doc = root.document;
  var st = { mode: null, idx: -1, del: -1, err: '', busy: false };

  function VV() { return root.AccVaultView || null; }
  function V() { return root.AccVault || null; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function val(id) { var n = byId(id); return n ? String(n.value == null ? '' : n.value) : ''; }
  function checked(id) { var n = byId(id); return !!(n && n.checked); }
  // Después de dibujar, el foco va a donde sigue la tarea (el botón que se tocó puede haber desaparecido).
  function rerender(focusId) {
    if (root.AccView && typeof root.AccView.render === 'function') root.AccView.render();
    var n = focusId ? byId(focusId) : null;
    if (n && n.focus) n.focus();
  }
  function toast(kind, text) { if (typeof root.toast === 'function') root.toast(kind, text, { ttl: 2600 }); }
  function today() { return new Date(Date.now()).toISOString().slice(0, 10); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function accounts() { var d = VV() && VV().data(); return d && Array.isArray(d.accounts) ? d.accounts : []; }

  // ------------------------------------------------------------------ modelo (puro)
  function tagList(text, chosen) {
    var out = [], seen = {};
    (chosen || []).concat(String(text || '').split(',')).forEach(function (t) {
      var x = String(t || '').trim();
      if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = true; out.push(x); }
    });
    return out;
  }
  function put(o, path, v) {
    var n = o;
    for (var i = 0; i < path.length - 1; i++) { if (!n[path[i]] || typeof n[path[i]] !== 'object') n[path[i]] = {}; n = n[path[i]]; }
    n[path[path.length - 1]] = v;
  }
  function get(o, path) {
    for (var i = 0; i < path.length; i++) { if (o == null || typeof o !== 'object') return undefined; o = o[path[i]]; }
    return o;
  }
  function str(x) { return x == null ? '' : String(x); }
  var PATHS = { accountName: ['gw2', 'accountName'], email: ['login', 'email'], password: ['login', 'password'], gmailPassword: ['login', 'gmailPassword'],
    twitchUser: ['services', 'twitch', 'username'], twitchEmail: ['services', 'twitch', 'email'], twitchPassword: ['services', 'twitch', 'password'] };
  // Aplica lo editado sobre una copia y SOLO toca lo que cambió: lo demás (también lo que no conozco) queda igual.
  function apply(acc, v, now) {
    var a = clone(acc) || { id: 'cuenta_' + (now || Date.now()), name: '', login: {}, services: {}, apiKey: null, notes: '', tags: [] };
    a.name = v.name; // obligatorio: siempre viene
    var tw = false;
    Object.keys(PATHS).forEach(function (k) {
      if (v[k] === str(get(a, PATHS[k]))) return;
      put(a, PATHS[k], v[k]);
      if (/^twitch/.test(k)) tw = true;
    });
    if (tw) a.services.twitch.linked = !!(v.twitchUser || v.twitchEmail || v.twitchPassword);
    var gf = get(a, ['services', 'geforceNow', 'linked']), gfOn = gf === true || gf === 'TRUE' || gf === 'true';
    if (!!v.geforce !== gfOn) put(a, ['services', 'geforceNow', 'linked'], !!v.geforce);
    var k0 = a.apiKey && typeof a.apiKey === 'object' ? str(a.apiKey.value) : str(a.apiKey);
    if (v.apiKey !== k0) a.apiKey = typeof a.apiKey === 'string' ? v.apiKey : Object.assign({}, a.apiKey || {}, { value: v.apiKey });
    if (v.notes !== str(a.notes)) a.notes = v.notes;
    var t0 = Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [];
    if (t0.join('\u0001') !== v.tags.join('\u0001')) a.tags = v.tags;
    return a;
  }
  function outName(name) {
    var base = String(name || '').replace(/\.(enc|txt|json)$/i, '').replace(/-v2$/i, '');
    return (base || 'llavero') + '-v2.enc';
  }

  // ------------------------------------------------------------------ HTML
  var TEXT = [['name', 'Nombre de la cuenta', 'text'], ['accountName', 'Cuenta de GW2 (Nombre.1234)', 'text'], ['email', 'Email', 'email'],
    ['password', 'Contraseña', 'password'], ['gmailPassword', 'Contraseña de Gmail', 'password'], ['twitchUser', 'Twitch: usuario', 'text'],
    ['twitchEmail', 'Twitch: email', 'email'], ['twitchPassword', 'Twitch: contraseña', 'password'], ['apiKey', 'API Key', 'text']];

  function icon(key) { var f = V() ? V().FIELDS.filter(function (x) { return x.key === key; })[0] : null; return f ? f.icon : ''; }

  function formHTML(cat) {
    st.cat = cat;
    var a = st.idx >= 0 ? accounts()[st.idx] : null, X = V(), cur = {};
    TEXT.forEach(function (t) { cur[t[0]] = a ? (t[0] === 'name' ? String(a.name || '') : t[0] === 'accountName' ? String((a.gw2 && a.gw2.accountName) || '') : X.value(a, t[0])) : ''; });
    var tags = a ? X._pure.tagsOf(a) : [], known = (cat && cat.tags) || [], kn = {};
    known.forEach(function (t) { kn[t.id] = true; });
    var h = '<section class="vke-form" aria-labelledby="vkeT"><h3 id="vkeT">' + (a ? 'Editar «' + esc(a.name || 'Cuenta') + '»' : 'Agregar una cuenta') + '</h3><div class="vke-grid">';
    TEXT.forEach(function (t) {
      var ic = t[0] === 'name' || t[0] === 'accountName' ? 'assets/icons/Cuentas/547827.png' : icon(t[0]);
      h += '<label class="vke-f"><span><img src="' + esc(ic) + '" alt="" width="18" height="18">' + t[1] + '</span><input type="' + t[2] + '" id="vkeF-' + t[0] + '" value="' + esc(cur[t[0]]) + '" autocomplete="' + (t[2] === 'password' ? 'new-password' : 'off') + '" spellcheck="false"' + (t[0] === 'name' ? ' required' : '') + '></label>';
    });
    h += '<label class="vke-f vke-chk"><input type="checkbox" id="vkeF-geforce"' + (a && X.value(a, 'geforce') ? ' checked' : '') + '><img src="' + esc(icon('geforce')) + '" alt="" width="18" height="18">GeForce NOW vinculada</label>';
    h += '<label class="vke-f vke-wide"><span><img src="' + esc(icon('notes')) + '" alt="" width="18" height="18">Notas</span><textarea id="vkeF-notes" rows="3">' + esc(a ? X.value(a, 'notes') : '') + '</textarea></label>';
    h += '<fieldset class="vke-f vke-wide vke-tags"><legend>Etiquetas</legend>' + known.map(function (t) {
      var on = tags.some(function (x) { return x.toLowerCase() === t.id; });
      return '<label class="cv-chip cv-tag" style="--cc:' + esc(t.color) + '"><input type="checkbox" id="vkeT-' + esc(t.id) + '"' + (on ? ' checked' : '') + '>' + esc(t.name) + '</label>';
    }).join('') + '<label class="vke-other"><span>Otras (separadas por coma)</span><input type="text" id="vkeF-tags" value="' + esc(tags.filter(function (x) { return !kn[x.toLowerCase()]; }).join(', ')) + '" autocomplete="off"></label></fieldset>';
    h += '</div>' + (st.err ? '<p class="cv-warn" role="alert">' + esc(st.err) + '</p>' : '') +
      '<div class="vke-acts"><button type="button" class="cv-btn vke-go" data-vke="apply">' + (a ? 'Listo' : 'Agregar') + '</button><button type="button" class="cv-btn" data-vke="cancel">Cancelar</button>' +
      '<span class="vke-hint">Queda en esta pestaña hasta que tocás «Guardar con el cifrado nuevo».</span></div></section>';
    return h;
  }

  function saveHTML() {
    return '<section class="vke-save" aria-labelledby="vkeS"><h3 id="vkeS">Guardar con el cifrado nuevo</h3><p>Descargo <b>' + esc(outName(VV().name())) + '</b> cifrado en este navegador y dejo acá una copia cifrada. Tu archivo de antes no se toca.</p>' +
      '<div class="vk-form"><label class="vk-pass"><span>Contraseña (mínimo ' + MIN_PASS + ')</span><input type="password" id="vkeP1" autocomplete="new-password"></label>' +
      '<label class="vk-pass"><span>Repetila</span><input type="password" id="vkeP2" autocomplete="new-password"></label>' +
      '<button type="button" class="cv-btn vke-go" data-vke="save-go"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Cifrando…' : 'Guardar') + '</button><button type="button" class="cv-btn" data-vke="cancel">Cancelar</button></div>' +
      (st.err ? '<p class="cv-warn" role="alert">' + esc(st.err) + '</p>' : '') + '<p class="cv-note">Si te olvidás esta contraseña, nadie puede abrir el archivo: ni yo.</p></section>';
  }

  // Barra de arriba del Llavero abierto: agregar, guardar y lo que esté pendiente.
  function barHTML() {
    var dirty = VV().isDirty(), list = accounts(), h = '<div class="vke-bar">';
    h += '<button type="button" class="cv-btn" id="vkeAdd" data-vke="add">Agregar cuenta</button><button type="button" class="cv-btn' + (dirty ? ' vke-go' : '') + '" id="vkeSave" data-vke="save">Guardar con el cifrado nuevo</button>';
    if (dirty) h += '<span class="vke-dirty" role="status">Tenés cambios sin guardar</span>';
    h += '</div>';
    if (st.del >= 0 && list[st.del]) h += '<p class="cv-warn vke-del" role="alert">¿Borro «' + esc(list[st.del].name || 'Cuenta') + '» del Llavero? <button type="button" class="cv-btn" id="vkeDelOk" data-vke="del-ok">Sí, borrarla</button><button type="button" class="cv-btn" data-vke="cancel">No</button></p>';
    return h;
  }

  function panelHTML(cat) {
    if (!VV() || !V() || !VV().isOpen()) return '';
    if (st.mode === 'edit') return formHTML(cat);
    if (st.mode === 'save') return saveHTML();
    return barHTML();
  }
  function busyForm() { return st.mode === 'edit' || st.mode === 'save'; }
  function cardActions(i, name) {
    return '<span class="vke-card"><button type="button" class="cv-btn" data-vke-edit="' + i + '">Editar<span class="cv-sr"> ' + esc(name) + '</span></button><button type="button" class="cv-btn" data-vke-del="' + i + '">Borrar<span class="cv-sr"> ' + esc(name) + '</span></button></span>';
  }

  // ------------------------------------------------------------------ acciones
  function readForm() {
    var chosen = [];
    ((st.cat && st.cat.tags) || []).forEach(function (t) { if (checked('vkeT-' + t.id)) chosen.push(t.id); });
    var v = { geforce: checked('vkeF-geforce'), notes: val('vkeF-notes'), tags: tagList(val('vkeF-tags'), chosen) };
    // Las contraseñas van tal cual (un espacio puede ser parte de una); el resto, sin espacios en los bordes.
    TEXT.forEach(function (t) { v[t[0]] = t[2] === 'password' ? val('vkeF-' + t[0]) : val('vkeF-' + t[0]).trim(); });
    return v;
  }

  function applyForm() {
    var v = readForm();
    if (!v.name) { st.err = 'Poné un nombre para la cuenta.'; rerender('vkeF-name'); return; }
    var d = clone(VV().data()), list = d.accounts = Array.isArray(d.accounts) ? d.accounts : [];
    if (st.idx >= 0) list[st.idx] = apply(list[st.idx], v);
    else list.push(apply(null, v, Date.now()));
    toast('success', st.idx >= 0 ? 'Cambié «' + v.name + '». Falta guardar.' : 'Agregué «' + v.name + '». Falta guardar.');
    reset();
    VV().commit(d);
    rerender('vkeSave');
  }

  function removeOne() {
    var d = clone(VV().data()), gone = d.accounts.splice(st.del, 1)[0];
    toast('info', 'Saqué «' + ((gone && gone.name) || 'Cuenta') + '». Falta guardar.');
    reset();
    VV().commit(d);
    rerender('vkeSave');
  }

  function saveGo() {
    var p1 = val('vkeP1'), p2 = val('vkeP2');
    if (p1.length < MIN_PASS) { st.err = 'La contraseña tiene que tener al menos ' + MIN_PASS + ' caracteres.'; rerender('vkeP1'); return null; }
    if (p1 !== p2) { st.err = 'Las dos contraseñas no son iguales.'; rerender('vkeP2'); return null; }
    var d = clone(VV().data()), name = outName(VV().name());
    d.lastUpdated = today();
    st.busy = true; st.err = ''; rerender();
    var text;
    return V().encryptV2(d, p1).then(function (t) {
      text = t;
      return V().open(t, p1); // antes de bajarlo, compruebo que se abre y da exactamente lo mismo
    }).then(function (r) {
      if (JSON.stringify(r.data) !== JSON.stringify(d)) throw new Error('el archivo cifrado no dio lo mismo al abrirlo');
      download(text, name);
      var S = root.Storage;
      // La copia vieja (OLD_KEY) NO se borra todavía: DEV y producción comparten el almacenamiento del navegador
      // (mismo origen, DEC-026) y producción la sigue usando. Se borra al promover (CTA-5).
      if (S && typeof S.set === 'function') S.set(V2_KEY, { name: name, data: text, t: Date.now() });
      st.busy = false; reset();
      VV().saved(d, name);
      toast('success', 'Guardé ' + name + ' con el cifrado nuevo.');
      rerender('vkeAdd');
    }).catch(function (e) {
      st.busy = false; st.err = 'No pude guardar: ' + ((e && e.message) || 'error') + '. No se bajó nada.';
      rerender('vkeP1');
    });
  }

  function download(text, name) {
    var B = root.Blob, U = root.URL;
    if (!B || !U || !doc || !doc.createElement) return;
    var url = U.createObjectURL(new B([text], { type: 'application/octet-stream' })), a = doc.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    if (doc.body && doc.body.appendChild) doc.body.appendChild(a);
    a.click();
    if (a.parentNode && a.parentNode.removeChild) a.parentNode.removeChild(a);
    root.setTimeout(function () { U.revokeObjectURL(url); }, 1000);
  }

  function reset() { st.mode = null; st.idx = -1; st.del = -1; st.err = ''; }

  function attr(t, name) {
    for (var n = t, i = 0; n && i < 6; n = n.parentNode, i++) { var v = n.getAttribute ? n.getAttribute(name) : null; if (v != null && v !== '') return v; }
    return null;
  }
  function onClick(e) {
    var t = e && e.target, act = attr(t, 'data-vke'), ed = attr(t, 'data-vke-edit'), dl = attr(t, 'data-vke-del');
    if (act == null && ed == null && dl == null) return false;
    if (st.busy) return true;
    var f = 'vkeAdd';
    if (ed != null) { reset(); st.mode = 'edit'; st.idx = Number(ed); f = 'vkeF-name'; }
    else if (dl != null) { reset(); st.del = Number(dl); f = 'vkeDelOk'; }
    else if (act === 'add') { reset(); st.mode = 'edit'; st.idx = -1; f = 'vkeF-name'; }
    else if (act === 'save') { reset(); st.mode = 'save'; f = 'vkeP1'; }
    else if (act === 'cancel') reset();
    else if (act === 'apply') { applyForm(); return true; }
    else if (act === 'del-ok') { removeOne(); return true; }
    else if (act === 'save-go') { saveGo(); return true; }
    rerender(f);
    return true;
  }
  function onKeydown(e) {
    var t = e && e.target;
    if (!t || !/^vke/.test(String(t.id || ''))) return false;
    if (e.key === 'Escape' && st.mode) { reset(); rerender('vkeAdd'); return true; }
    if (e.key === 'Enter' && (t.id === 'vkeP1' || t.id === 'vkeP2')) { if (e.preventDefault) e.preventDefault(); saveGo(); }
    return true;
  }

  // ================================================================== Importar desde Excel (CTA-4b)
  // Reemplaza el asistente de 4 pasos del panel anterior (Excel → JSON en claro → JSON enriquecido en claro → .enc):
  // el Excel se lee en el navegador con SheetJS (window.XLSX, lo carga index.html), las cuentas quedan en el Llavero
  // abierto sin guardar y se guardan con «Guardar con el cifrado nuevo». Nunca se descarga ni se guarda nada en claro.
  var COLUMNS = ['id', 'nombre', 'email', 'password', 'gmailPassword', 'apiKey', 'twitch_user', 'twitch_email', 'twitch_password', 'geforce_linked', 'notas', 'tags'];
  var EXAMPLE = ['mi_cuenta_1', 'Mi cuenta principal', 'usuario@ejemplo.com', '', '', '', 'miusuario', 'miusuario@ejemplo.com', '', 'TRUE', 'Cuenta principal', 'main,farming'];
  var MAX_BYTES = 5 * 1024 * 1024;

  var ist = { busy: false };
  function X() { return root.XLSX || null; }

  // Encabezados sin importar mayúsculas, espacios ni guiones: «Twitch User», «twitch-user» y «twitch_user» son lo mismo.
  function norm(k) { return String(k == null ? '' : k).trim().toLowerCase().replace(/[\s-]+/g, '_'); }
  var ALIAS = { name: 'nombre', notes: 'notas', geforce: 'geforce_linked', geforce_now: 'geforce_linked' };
  function cell(row, key) {
    var want = norm(key);
    for (var k in row) {
      if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
      var n = norm(k);
      if (n === want || ALIAS[n] === want) return row[k] == null ? '' : String(row[k]);
    }
    return '';
  }
  function yes(v) { var s = String(v || '').trim().toLowerCase(); return s === 'true' || s === 'verdadero' || s === 'si' || s === 'sí' || s === '1' || s === 'x'; }
  // Las contraseñas tal cual (un espacio puede ser parte de una); el resto, sin espacios en los bordes.
  function rowToAccount(row, i) {
    var t = function (k) { return cell(row, k).trim(); }, raw = function (k) { return cell(row, k); };
    var name = t('nombre'), email = t('email');
    if (!name && !email && !t('apiKey') && !raw('password')) return null; // fila vacía
    var tu = t('twitch_user'), te = t('twitch_email'), tp = raw('twitch_password'), key = t('apiKey');
    var tags = t('tags').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    return {
      id: t('id') || 'cuenta_' + (i + 1), name: name || email || 'Cuenta ' + (i + 1),
      login: { email: email, password: raw('password'), gmailPassword: raw('gmailPassword') },
      services: { twitch: { linked: !!(tu || te || tp), username: tu || null, email: te || null, password: tp || null }, geforceNow: { linked: yes(t('geforce_linked')) } },
      apiKey: key ? { value: key } : null, notes: raw('notas'), tags: tags
    };
  }
  function rowsToData(rows, today) {
    var list = [];
    (rows || []).forEach(function (r, i) { var a = rowToAccount(r || {}, i); if (a) list.push(a); });
    return { version: 2, lastUpdated: today, accounts: list };
  }

  // HTML del Llavero cerrado
  function xlLockedHTML() {
    var ok = !!X();
    return '<div class="vki"><label class="cv-btn vk-pick' + (ok ? '' : ' vki-off') + '"><input type="file" id="vkXlsx" accept=".xlsx,.xls,.csv" class="vk-file-in"' + (ok && !ist.busy ? '' : ' disabled') + '>' + (ist.busy ? 'Leyendo el Excel…' : 'Importar desde Excel') + '</label>' +
      '<button type="button" class="cv-btn" data-vk="tpl"' + (ok ? '' : ' disabled') + '>Descargar plantilla</button>' +
      '<span class="vki-note">' + (ok ? 'El Excel se lee acá y las cuentas quedan en el Llavero sin guardar: después tocás «Guardar con el cifrado nuevo». No se baja nada en claro.' : 'No pude cargar el lector de Excel. Recargá la página (Ctrl+F5).') + '</span></div>';
  }

  function readFile(file) {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise(function (ok, ko) { var r = new root.FileReader(); r.onload = function () { ok(r.result); }; r.onerror = ko; r.readAsArrayBuffer(file); });
  }
  function importFile(file) {
    var XL = X(), V = VV();
    if (!XL || !V || !file) return null;
    if (file.size > MAX_BYTES) { toast('error', 'Ese archivo es muy grande para ser tu planilla de cuentas.'); return null; }
    ist.busy = true;
    return readFile(file).then(function (buf) {
      var wb = XL.read(new Uint8Array(buf), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      var rows = ws ? XL.utils.sheet_to_json(ws, { raw: false, defval: '' }) : [];
      var d = rowsToData(rows, new Date(Date.now()).toISOString().slice(0, 10));
      ist.busy = false;
      if (!d.accounts.length) { toast('error', 'No encontré cuentas en ese Excel. ¿Usaste la plantilla?'); V.rerender(); return; }
      V.openData(d, String(file.name || 'llavero').replace(/\.(xlsx|xls|csv)$/i, ''), true);
      toast('success', 'Importé ' + d.accounts.length + (d.accounts.length === 1 ? ' cuenta' : ' cuentas') + '. Falta guardar con el cifrado nuevo; después borrá el Excel: tiene tus contraseñas en claro.');
    }, function () { ist.busy = false; toast('error', 'No pude leer ese archivo.'); V.rerender(); }).catch(function (e) {
      ist.busy = false; toast('error', 'No pude leer ese Excel: ' + ((e && e.message) || 'error')); V.rerender();
    });
  }
  function template() {
    var XL = X();
    if (!XL) return false;
    var ws = XL.utils.aoa_to_sheet([COLUMNS, EXAMPLE]), wb = XL.utils.book_new();
    XL.utils.book_append_sheet(wb, ws, 'Cuentas');
    XL.writeFile(wb, 'plantilla_cuentas.xlsx');
    return true;
  }
  function xlChange(e) {
    var t = e && e.target;
    if (!t || t.id !== 'vkXlsx') return false;
    var f = t.files && t.files[0];
    if (f) importFile(f);
    try { t.value = ''; } catch (_) {}
    return true;
  }

  // ================================================================== fin de Importar desde Excel

  var CSS = [
    '.vke-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.vke-dirty{font-size:.85rem;font-weight:700;color:var(--tx-1)}',
    '.vke-go{font-weight:700;border-color:var(--cv-mod)}.vke-del{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.vke-form,.vke-save{border:1px solid var(--bd-1);border-radius:14px;background:var(--bg-1);padding:16px;display:grid;gap:12px;margin-bottom:12px}',
    '.vke-form h3,.vke-save h3{margin:0;font-size:1.02rem;color:var(--tx-1)}.vke-save p{margin:0;font-size:.85rem;color:var(--tx-2)}.vke-save b{color:var(--tx-1)}',
    '.vke-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px 14px}',
    '.vke-f{display:grid;gap:4px;font-size:.8rem;color:var(--tx-2)}.vke-f span{display:flex;gap:6px;align-items:center}.vke-wide{grid-column:1/-1}',
    '.vke-f input[type=text],.vke-f input[type=email],.vke-f input[type=password],.vke-f textarea,.vke-other input{font:inherit;font-size:.9rem;border:1px solid var(--bd-2);border-radius:10px;padding:6px 10px;background:var(--bg-0);color:var(--tx-1);min-height:32px}',
    '.vke-chk{display:flex;gap:8px;align-items:center;align-self:end}.vke-tags{border:1px solid var(--bd-1);border-radius:12px;padding:8px 10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.vke-tags legend{padding:0 4px}.vke-tags .cv-chip input{margin:0 4px 0 0}.vke-other{display:flex;gap:6px;align-items:center;flex:1 1 220px}.vke-other input{flex:1}',
    '.vke-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.vke-hint{font-size:.8rem;color:var(--tx-2)}.vke-card{display:flex;gap:6px;margin-left:auto}',
    '@media (max-width:900px){.vke-grid{grid-template-columns:1fr}.vke-f input,.vke-f textarea{min-height:44px}.vke-acts .cv-btn,.vke-bar .cv-btn{min-height:44px}}'
  ].join('\n');
  function ensureCss() {
    if (!doc || !doc.createElement || !doc.head || byId('acc-vault-edit-css')) return;
    var s = doc.createElement('style'); s.id = 'acc-vault-edit-css'; s.textContent = CSS; doc.head.appendChild(s);
  }
  if (doc) ensureCss();

  root.AccVaultEdit = {
    version: VERSION, panelHTML: panelHTML, cardActions: cardActions, busyForm: busyForm, onClick: onClick, onKeydown: onKeydown, reset: reset,
    _pure: { apply: apply, tagList: tagList, outName: outName, esc: esc, CSS: CSS, V2_KEY: V2_KEY, OLD_KEY: OLD_KEY, MIN_PASS: MIN_PASS, state: function () { return st; } }
  };
  root.AccVaultImport = {
    version: VERSION, lockedHTML: xlLockedHTML, onChange: xlChange, template: template, importFile: importFile,
    _pure: { rowsToData: rowsToData, rowToAccount: rowToAccount, norm: norm, yes: yes, COLUMNS: COLUMNS, EXAMPLE: EXAMPLE, MAX_BYTES: MAX_BYTES, state: function () { return ist; } }
  };
  if (root.console && root.console.info) root.console.info('[AccVaultEdit] ready v' + VERSION + ' (con AccVaultImport)');
})(typeof window !== 'undefined' ? window : this);
