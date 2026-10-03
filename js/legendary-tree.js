// legendary-tree.js -- el arbol de fabricacion y el total de materiales.
//
// QUE RESUELVE ESTE ARCHIVO
// computeMaterials() (legendary-tracker.js:398) hoy mira SOLO el contrato del
// catalogo y arma una fila por ingrediente DIRECTO. Para Frostfang eso son 4
// filas: 1 Tooth, 1 Gift of Frostfang, 1 Gift of Fortune, 1 Gift of Mastery.
// Con eso no hay columna de "falta" que sirva, porque el Tooth no es una
// bolsa de materiales: es una subreceta. Este archivo baja el arbol entero y
// multiplica, que es lo que hace falta para que las columnas se puedan chequear.
//
// LOS DOS CONTRATOS
//   LegendaryRecipes    206 del catalogo. Siempre cargado. La raiz.
//   LegendaryPrecursors 907 del arbol. Bajo demanda.
//
// SIN EL SEGUNDO NO HAY ARBOL, Y ESO SE DICE
// La precarga es asincrona. Mientras no llegue, build() devuelve
// needsPrecursors:true y la vista dice "receta no disponible para este item".
// NO se dibuja un arbol parcial sin avisar: se verian 4 hijos y el usuario
// concluiria que la legendaria se hace con eso.
//
// CONVENCION DE NIVELES (la que fijo Pablo, 2026-10-02)
//   level = raiz es 1. depth = el nivel de la hoja mas profunda de ese item.
//   Los dos son INFORMATIVOS: el recorrido no los usa. Si `depth` no significara
//   eso, no significaria nada y habria que borrarlo.
//
// LO QUE NO SE CUENTA, Y POR QUE (esto NO es un detalle, es la decision)
//   vendor   -> se compra a un NPC. No es crafteable, asi que va aparte y NO
//               entra en la columna de "necesito". Meterlo ahi seria telling
//               al usuario que tiene que fabricar algo que se compra.
//   itemId 0 -> la fuente no tiene el id (Relic any, Testimony of Castoran
//               Heroics). No se puede consultar el inventario, o sea que no
//               puede tener "tengo" ni "falta". Va aparte, con su nombre.
//   unknown  -> id que no esta en ninguno de los dos contratos. Sale en la
//               lista para que se vea, no se esconde. Un dato que no aparece
//               es un dato que el usuario no puede reportar.
//
// La columna "falta" es por material BASE. Se llega hasta ahi y no mas abajo:
// un material base no tiene receta, por definicion. Los no_recipe del catalogo
// son otra cosa -- son legendarias sin receta publicada, y salen nombradas y
// marcadas, sin hijos.
(function (root) {
  'use strict';

  var LOG = '[LegendaryTree]';

  function recipes() { return root.LegendaryRecipes || null; }
  function precursors() { return root.LegendaryPrecursors || null; }

  // Un id puede estar en cualquiera de los dos contratos. La raiz siempre esta
  // en el del catalogo; los precursores, en el segundo.
  function entry(id) {
    var R = recipes();
    if (R && typeof R.get === 'function') {
      var e = R.get(id);
      if (e) return e;
    }
    var P = precursors();
    if (P && typeof P.get === 'function') return P.get(id);
    return null;
  }

  // ---------------------------------------------------------------------------
  // ARBOL
  // ---------------------------------------------------------------------------
  // Construye el arbol completo desde la raiz. NO lleva estado de apertura:
  // eso es de la vista. Aqui se arma la forma y nada mas, asi que el mismo
  // arbol sirve para el modal y para un test sin DOM.
  //
  // Cada nodo:
  //   { id, name, level, count, status, kind, isLeaf, note, children }
  //   status  'recipe' | 'material' | 'vendor' | 'no_recipe' | 'placeholder' | 'unknown'
  //   kind    'root' | 'recipe' | 'material' | 'vendor' | 'no_recipe' | 'placeholder' | 'unknown'
  //   count   cuantas unidades de ESTE item hacen falta para la raiz
  //
  // `count` YA viene multiplicado: la multiplicacion se aplica de abajo hacia
  // arriba al propagar, asi que el nodo sabe cuanto necesita la raiz, no cuanto
  // cuesta hacerlo una vez.
  function build(itemId) {
    var id = Number(itemId);
    var e = entry(id);

    if (!e) {
      return {
        needsPrecursors: false,
        status: 'unknown',
        node: { id: id, name: '#' + id, level: 1, count: 1, kind: 'unknown',
                status: 'unknown', isLeaf: true, note: 'No esta en el catalogo.', children: [] },
        totals: emptyTotals()
      };
    }

    // El nodo raiz puede ser un no_recipe del catalogo: 64 de los 206. En ese
    // caso no hay nada que expandir y el estado se ve sin adivinar.
    if (e.dataStatus === 'placeholder') {
      return single(id, e, 'placeholder', 1, 1, 'Marcador de cuenta, no una legendaria.');
    }
    if (e.dataStatus === 'no_recipe' && !(e.ingredients && e.ingredients.length)) {
      return single(id, e, 'no_recipe', 1, 1,
        (recipes() && recipes().noRecipeNote) ||
        'La fuente no publica receta para esta pieza.');
    }
    // `vendor` como raiz no deberia pasar (una vendor no es una legendaria), pero
    // se maneja para que el modulo no tire.
    if (e.dataStatus === 'vendor' && !(e.ingredients && e.ingredients.length)) {
      return single(id, e, 'vendor', 1, 1, 'Se compra a un NPC.');
    }

    var ings = e.ingredients || [];
    if (!ings.length) {
      return single(id, e, 'material', 1, 1, null);
    }

    // Si la raiz tiene receta pero TODOS sus ingredientes estan en el contrato
    // de precursores y ese no esta cargado, avisarlo es obligatorio.
    var P = precursors();
    if (!P) {
      var falta = ings.filter(function (i) { return !recipes().get(i.itemId); });
      if (falta.length) {
        return {
          needsPrecursors: true,
          status: 'pending',
          node: null,
          totals: emptyTotals()
        };
      }
    }

    var tots = { rows: [], vendor: [], sinId: [], unknown: [], nodes: 0, leaves: 0, maxDepth: 0 };
    var node = makeNode(id, e, 'recipe', 1, 1, 1, tots, 0);

    return {
      needsPrecursors: false,
      status: 'recipe',
      node: node,
      totals: finish(tots)
    };
  }

  function single(id, e, kind, level, count, note) {
    return {
      needsPrecursors: false,
      status: kind,
      node: {
        id: id, name: nombre(e, id), level: level, count: count,
        kind: kind, status: kind, isLeaf: true, note: note || null, children: []
      },
      totals: finish({ rows: [], vendor: [], sinId: [], unknown: [], nodes: 1, leaves: [], maxDepth: level })
    };
  }

  function nombre(e, id) {
    return (e && e.name) || ('#' + id);
  }

  // `levelAcum` es el nivel del padre, para no tener que guardarlo aparte.
  function makeNode(id, e, kind, level, count, nivelPadre, tots, guard) {
    tots.nodes++;
    if (level > tots.maxDepth) tots.maxDepth = level;

    var node = {
      id: id, name: nombre(e, id), level: level, count: count,
      kind: kind, status: kind, isLeaf: true, note: null, children: []
    };

    // Corte de seguridad. El dato real llega a 9 niveles (Frostfang), pero si
    // un dia la fuente trae un ciclo, un corte aca evita un overflow de pila
    // que tumba la vista entera. El limite es holgado a proposito: 40 es
    // cuatro veces el maximo medido, asi que no puede estar cortando nada real.
    if (guard > 40) {
      node.note = 'Corte de seguridad: la receta es mas profunda de lo esperado.';
      return node;
    }

    var ings = (e && e.ingredients) || [];
    if (!ings.length) {
      // Hoja. Si es material base, es donde termina la cuenta del total.
      if (kind === 'material' && id !== 0) {
        if (!tots.leaves) tots.leaves = [];
        tots.leaves.push({ id: id, name: node.name, count: count });
        tots.leavesCount = (tots.leavesCount || 0) + 1;
      }
      return node;   // material base: no tiene mas abajo
    }

    node.isLeaf = false;
    ings.forEach(function (ing) {
      var cid = Number(ing.itemId);
      var ccount = Math.max(0, Number(ing.count || 0)) * count;

      // itemId 0: la fuente no tiene el id. Se conserva el nodo para que el
      // nombre se vea, y va a la lista aparte porque no se puede consultar
      // el inventario.
      if (cid === 0) {
        tots.sinId.push({ name: ing.name || ('#' + cid), count: ccount, parent: nombre(e, id) });
        node.children.push({
          id: 0, name: ing.name || 'Ingrediente sin id en la fuente',
          level: level + 1, count: ccount, kind: 'sinId', status: 'sinId',
          isLeaf: true,
          note: 'La fuente no trae el id de este ingrediente, asi que no se puede contar contra tu inventario.',
          children: []
        });
        return;
      }

      var ce = entry(cid);
      if (!ce) {
        tots.unknown.push({ id: cid, count: ccount, parent: nombre(e, id) });
        node.children.push({
          id: cid, name: '#' + cid, level: level + 1, count: ccount,
          kind: 'unknown', status: 'unknown', isLeaf: true,
          note: 'No esta en el catalogo de recetas.', children: []
        });
        return;
      }

      var ckind = kindOf(ce);
      if (ckind === 'vendor') {
        tots.vendor.push({ id: cid, name: nombre(ce, cid), count: ccount });
      }
      node.children.push(makeNode(cid, ce, ckind, level + 1, ccount, level, tots, guard + 1));
    });

    return node;
  }

  function kindOf(e) {
    if (e.dataStatus === 'vendor') return 'vendor';
    if (e.dataStatus === 'placeholder') return 'placeholder';
    if (e.dataStatus === 'no_recipe') return 'no_recipe';
    if (!e.ingredients || !e.ingredients.length) return 'material';
    return 'recipe';
  }

  // ---------------------------------------------------------------------------
  // TOTALES
  // ---------------------------------------------------------------------------
  // Acumula SOLO las hojas de tipo material. Una hoja es un material base: no
  // tiene receta, por definicion, asi que ahi se corta la cuenta.
  function finish(tots) {
    // Acumular por id para que "10 de A + 15 de A"den 25 de A y no dos filas.
    var acc = {};
    var order = [];
    (tots.leaves || []).forEach(function (l) {
      if (!acc[l.id]) { acc[l.id] = { itemId: l.id, name: l.name, need: 0, stock: 0 }; order.push(l.id); }
      acc[l.id].need += l.count;
    });
    return {
      rows: order.map(function (k) { return acc[k]; }),
      vendor: tots.vendor || [],
      sinId: tots.sinId || [],
      unknown: tots.unknown || [],
      nodes: tots.nodes || 0,
      maxDepth: tots.maxDepth || 0
    };
  }

  function emptyTotals() {
    return { rows: [], vendor: [], sinId: [], unknown: [], nodes: 0, maxDepth: 0 };
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  root.LegendaryTree = {
    build: build,
    entry: entry,
    isReady: function () { return !!recipes() && !!precursors(); },
    hasPrecursors: function () { return !!precursors(); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.LegendaryTree;
  if (root.console && console.info) console.info(LOG, 'ready');

})(typeof window !== 'undefined' ? window : globalThis);