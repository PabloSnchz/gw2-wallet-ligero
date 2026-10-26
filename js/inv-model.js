/*!
 * js/inv-model.js — Modelo de Inventario y Personajes (BL-070, paso 2)
 * Proyecto: Bóveda del Gato Negro
 * Versión: 1.0.0 (2026-10-25) · INV-1: datos verificados y modelo, sin pantalla todavía
 *
 * Funciones puras, sin DOM, sin pedidos y sin almacenamiento. Las usan las pestañas nuevas del módulo
 * (Buscar, Multicuenta, Materiales, Banco, Armería legendaria y Personajes), que llegan en INV-2 a INV-6.
 *  - Materiales: agrupados por la categoría que trae la API para cada material (/v2/account/materials),
 *    en el orden del juego (assets/data/inventory/material-categories.json), no por listas fijas.
 *  - «¿Dónde está?»: un índice por ítem con cada lugar donde está (depósito, banco y su pestaña,
 *    ranuras compartidas, bolsas de cada personaje) y el total.
 *  - Multicuenta: los ítems de cada set (con sus tiers), el total por cuenta, el total de todas y el
 *    valor con el precio de venta del Bazar. Un número que no se pudo leer es «sin datos» (null), nunca 0.
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var BANK_TAB = 30; // ranuras por pestaña del banco
  var OTHER = { id: 0, name: 'Otros materiales', order: 999 };

  function num(n) { n = Number(n); return isFinite(n) && n > 0 ? n : 0; }

  // ------------------------------------------------------------------ materiales
  // accountMaterials: [{id, category, count}] de /v2/account/materials (trae también los que están en 0).
  // cats: [{id, name, order}] de material-categories.json.
  function groupMaterials(accountMaterials, cats) {
    var byId = {}, out = [];
    (cats || []).forEach(function (c) {
      var g = { id: c.id, name: c.name, order: c.order, items: [], held: 0, slots: 0 };
      byId[c.id] = g; out.push(g);
    });
    var other = null;
    (accountMaterials || []).forEach(function (m) {
      if (!m || !m.id) return;
      var g = byId[m.category];
      if (!g) {
        if (!other) { other = { id: OTHER.id, name: OTHER.name, order: OTHER.order, items: [], held: 0, slots: 0 }; out.push(other); }
        g = other;
      }
      var count = num(m.count);
      g.slots++;
      if (count > 0) { g.items.push({ id: m.id, count: count }); g.held++; }
    });
    out.forEach(function (g) { g.items.sort(function (a, b) { return b.count - a.count || a.id - b.id; }); });
    return out.sort(function (a, b) { return a.order - b.order; });
  }

  // ------------------------------------------------------------------ banco
  function bankSummary(bank) {
    if (!Array.isArray(bank)) return { used: null, total: null, free: null, tabs: null };
    var used = bank.filter(function (s) { return s && s.id; }).length;
    return { used: used, total: bank.length, free: bank.length - used, tabs: Math.ceil(bank.length / BANK_TAB) };
  }
  function bankTab(slot) { return Math.floor(slot / BANK_TAB) + 1; }

  // ------------------------------------------------------------------ ¿dónde está?
  // src: { materials, bank, shared, characters: [{name, bags:[{inventory:[...]}]}] }
  // Cada fuente que no se pudo leer viene como null y no suma (y queda en `unread`).
  function indexPlaces(src) {
    src = src || {};
    var idx = {}, unread = [];
    function add(id, place, count) {
      if (!id || count <= 0) return;
      var e = idx[id] || (idx[id] = { id: id, total: 0, places: [] });
      e.total += count;
      var key = place.kind + '|' + (place.name || '') + '|' + (place.tab || '');
      for (var i = 0; i < e.places.length; i++) {
        if (e.places[i].key === key) { e.places[i].count += count; return; }
      }
      e.places.push({ key: key, kind: place.kind, name: place.name || null, tab: place.tab || null, count: count });
    }
    if (Array.isArray(src.materials)) src.materials.forEach(function (m) { if (m) add(m.id, { kind: 'materials' }, num(m.count)); });
    else unread.push('materials');
    if (Array.isArray(src.bank)) src.bank.forEach(function (s, i) { if (s) add(s.id, { kind: 'bank', tab: bankTab(i) }, num(s.count) || 1); });
    else unread.push('bank');
    if (Array.isArray(src.shared)) src.shared.forEach(function (s) { if (s) add(s.id, { kind: 'shared' }, num(s.count) || 1); });
    else unread.push('shared');
    if (Array.isArray(src.characters)) {
      src.characters.forEach(function (c) {
        if (!c) return;
        (c.bags || []).forEach(function (b) {
          if (!b) return;
          (b.inventory || []).forEach(function (s) { if (s) add(s.id, { kind: 'char', name: c.name }, num(s.count) || 1); });
        });
      });
    } else unread.push('characters');
    return { items: idx, unread: unread };
  }

  var KIND_ORDER = { materials: 0, bank: 1, shared: 2, char: 3 };
  function placesOf(index, id) {
    var e = index && index.items && index.items[id];
    if (!e) return { id: id, total: 0, places: [] };
    var places = e.places.slice().sort(function (a, b) {
      return (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (b.count - a.count) || String(a.name || '').localeCompare(String(b.name || ''), 'es') || (a.tab - b.tab);
    });
    return { id: id, total: e.total, places: places };
  }

  // Busca por nombre (sin distinguir mayúsculas ni tildes) entre los ítems que tenés.
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function search(index, itemsById, q, limit) {
    var needle = fold(q).trim();
    if (!needle || !index || !index.items) return [];
    var out = [];
    Object.keys(index.items).forEach(function (k) {
      var meta = itemsById && itemsById[k];
      if (!meta || fold(meta.name).indexOf(needle) < 0) return;
      out.push(placesOf(index, Number(k)));
    });
    out.sort(function (a, b) {
      var na = fold(itemsById[a.id].name), nb = fold(itemsById[b.id].name);
      var pa = na.indexOf(needle) === 0 ? 0 : 1, pb = nb.indexOf(needle) === 0 ? 0 : 1;
      return pa - pb || b.total - a.total || na.localeCompare(nb, 'es');
    });
    return out.slice(0, limit || 50);
  }

  // ------------------------------------------------------------------ Multicuenta
  // Ítems de un set; en los de tiers, solo los tiers elegidos (o los de defaultTiers), del más alto al más bajo.
  function setItems(set, tiers) {
    if (!set) return [];
    if (Array.isArray(set.items)) return set.items.slice();
    var t = set.tiers || {}, pick = (tiers && tiers.length ? tiers : set.defaultTiers || Object.keys(t));
    return Object.keys(t).filter(function (k) { return pick.indexOf(k) >= 0; })
      .sort(function (a, b) { return b.localeCompare(a); })
      .reduce(function (acc, k) { return acc.concat((t[k].items || []).map(function (it) { return { id: it.id, name: it.name, tier: k }; })); }, []);
  }

  // accounts: [{label, index (de indexPlaces) | null}] → filas con el total por ítem (null = sin datos).
  function multiTable(accounts, ids, prices) {
    var rows = (accounts || []).map(function (a) {
      var ok = a && a.index && a.index.items;
      var cells = ids.map(function (id) { return ok ? placesOf(a.index, id).total : null; });
      return { label: a.label, cells: cells, value: ok ? valueOf(ids, cells, prices) : null, partial: ok ? a.index.unread.slice() : null };
    });
    var totals = ids.map(function (id, i) {
      return rows.reduce(function (s, r) { return r.cells[i] == null ? s : s + r.cells[i]; }, 0);
    });
    return { rows: rows, totals: totals, value: valueOf(ids, totals, prices) };
  }
  // Valor en cobre con el precio de venta (sells.unit_price) del Bazar; un ítem sin precio no suma.
  function valueOf(ids, counts, prices) {
    var v = 0;
    ids.forEach(function (id, i) {
      var p = prices && prices[id], unit = p && p.sells ? num(p.sells.unit_price) : 0;
      v += unit * num(counts[i]);
    });
    return v;
  }

  root.InvModel = {
    version: VERSION,
    _pure: {
      BANK_TAB: BANK_TAB, OTHER: OTHER,
      groupMaterials: groupMaterials, bankSummary: bankSummary, bankTab: bankTab,
      indexPlaces: indexPlaces, placesOf: placesOf, search: search, fold: fold,
      setItems: setItems, multiTable: multiTable, valueOf: valueOf
    }
  };
  if (root.console && root.console.info) root.console.info('[InvModel] ready v' + VERSION);
})(typeof window !== 'undefined' ? window : this);
