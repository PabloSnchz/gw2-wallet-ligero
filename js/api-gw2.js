/* =======================================================================
 * js/api-gw2.js  —  Capa API con fallbacks + caché persistente (mejorada)
 * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
 * Versión: 2.33.0 (2026-10-03) — `getSkinsBatch(ids, opts)`: resuelve los ids
 *   de skin de una cuenta a su FICHA (nombre, icono, rareza), que es lo que
 *   faltaba para que la fila "Coberturable account-scoped multicuenta"
 *   (BACKLOG.md L88) pueda tener un call site. El Tramo 1 entrego solo el
 *   `Array.isArray` de ids: sin esto, un call site tendria una lista de
 *   numeros, que es exactamente lo que el BACKLOG dice que "no le sirve a
 *   Pablo". Sigue siendo SOLO la capa de datos: todavia no hay call site ni
 *   pantalla, asi que NO cambia lo que Pablo ve.
 *   Las tres cifras de la v2.32.0 que este tramo usa, RE-MEDIDAS en vivo
 *   (HB#154) en vez de heredadas, y una estaba mal:
 *     - `/v2/skins?ids=all` -> 400 "unable to use 'all' keyword for this
 *       API". Confirma la trampa de BACKLOG L88.
 *     - Lote de 201 ids -> 400 "id list too long; this endpoint is limited to
 *       200 ids at once". O sea que el limite DURO es 200 y el error lo dice
 *       textual; el `chunk = 100` de `meta.js:294` que citaba la v2.32.0 es
 *       un molde, no el limite, asi que aca se parti en 200.
 *     - CORRECCION: la v2.32.0 anotaba "200 ids todos validos -> 200/200".
 *       FALSA para el rango que uno usaria de verdad: `?ids=1..200` da
 *       **206 con 188** (faltan 15,61,127,128,135,136,148,181,182,192,194,
 *       200). El 206 depende del CONTENIDO y no del tamano: `?ids=1,2,3` da
 *       200 y `?ids=1,2,3,99999997` da 206 con 3. O sea que el PRIMER lote
 *       real de una cuenta puede ser 206 y no es un error.
 *   Y UN HALLAZGO QUE CORRIGE UNA NOTA DEL TRAMO 1 (HB#152). La recomendacion
 *   era "copiar `getItemsMany`, no `meta.js:batchItems`", por el 206. MEDIDA,
 *   esa razon no se sostiene para `/v2/skins`: tanto `meta.js:batchItems` como
 *   `jfetch` tratan el 206 bien (`res.ok` es true y sale el array parcial), asi
 *   que los 188 de cada 200 llegan igual por los tres caminos. Peor: como los
 *   ids ausentes son ids que el catalogo NO TIENE, re-preguntarlos da 404
 *   SIEMPRE, o sea que `fetchBatchWithRepair` agrega en este endpoint un
 *   round-trip que falla por lote, a cambio de nada. Por eso este lote va por
 *   `fetchWithRetry` + un guard de forma propio, que ademas propaga en vez de
 *   degradar a `[]` como hace el helper (`Idea 57 T2`).
 *   El catalogo NO va a `localStorage` (a diferencia de `getItemsMany`): son
 *   ~10.632 fichas y la cuota medida da ~4.98 MB (Idea 49). Va a memoria con
 *   `TTL.ITEMS` (24 h), que es metadata estatica; `TTL.SKINS` (6 h) es para
 *   la lista de la cuenta, que cambia con una compra.
 *   Test: tests/hb154-skins-catalogo.test.js.
 * Versión: 2.32.0 (2026-10-02) — `getAccountSkins(token, opts)`: el primer
 *   endpoint de la lista "Coberturable account-scoped multicuenta" que pide la
 *   idea del PO de las 18:00 UTC (12 endpoints `/v2/account/*` sin tocar; el
 *   primero de la fila era `skins`, 10.632 items). Es SOLO la capa de datos:
 *   todavia no hay call site ni pantalla, asi que no cambia lo que Pablo ve.
 *   Lo que aporta el Tramo es el CONTRATO, y el contrato tiene una diferencia
 *   que NO se podia copiar de los 3 wrappers de arriba: `/v2/account/skins`
 *   devuelve un array de ESCALARES (ids), no de objetos, asi que el guard de
 *   FORMA tiene que mirar los elementos y no solo `Array.isArray`. Un array de
 *   objetos pasa el guard de los otros tres y recien revienta en el `.indexOf`
 *   del call site. Forma verificada, no supuesta: 401 con token falso contra 404
 *   de un endpoint inexistente, y la forma contra la documentacion publica de
 *   GW2Treasures/gw2api (`[ 1, 2, 3, 4, … ]`).
 *   Recordatorio medido para el proximo tramo: `/v2/skins?ids=all` -> **400**
 *   (verificado en vivo). El catalogo hay que paginarlo en lotes; el molde
 *   esta en `meta.js:294` (`chunk = 100`).
 *   Test: tests/hb150-cuenta-skins.test.js, con control negativo en las DOS
 *   direcciones (array de objetos tiene que RECHAZAR, no solo no-romperse).
 * Versión: 2.31.0 (2026-09-30) — `keptBytes`: lo que QUEDA, en la misma unidad
 *   que lo que se libera. `cacheClear` ya recorria todas las claves y solo
 *   contaba las de la rama "borrada"; sumar `(localStorage.getItem(k)||'').length`
 *   en la rama de "conservada" no agrega ningun recorrido. Lo usa el `confirm()`
 *   del botón (`settings-manager.js:clearApiCache`) para decir "se conservan N
 *   claves (X MB)" en vez de enumerar categorías: el conteo de bytes sigue siendo
 *   cierto cuando un módulo registre su clave mañana, y la enumeración no.
 *   Test: tests/idea50-boton-cache.test.js, sección 4c.
 *   Censo con unidad: node tools/idea50-censo-claves.mjs → 8 FAMILIAS de clave
 *   de cache en 3 módulos, fuera del registro, + 1 marcador de frescura.
 * Versión: 2.30.0 (2026-09-30) — Idea 50 P3: el registro de bases de los OTROS módulos
 *   v2.30.0: **NO cambiaba lo que Pablo ve** — MEDIDO EN LA v2.30.0, `cacheClear`
 *   tenía 0 callers y el botón no existía. Lo que cambiaba es que el borrado ya
 *   podía alcanzar la cache del Wizard's Vault, que antes era inalcanzable.
 *
 *   ACTUALIZADO (HB#125, 2026-10-02): ese paréntesis decía "sigue" y mentía en
 *   las dos mitades. Re-medido sobre `origin/main` @ `de42a69`:
 *     - `__cacheClear` tiene **3 llamadas reales**: `settings-manager.js:737`
 *       (guard de existencia), `:742` (`dryRun` para el confirm) y `:769`
 *       (borrado). El botón EXISTE y está cableado.
 *     - Se expone en el return de este mismo archivo (`:2056`).
 *   Una cabecera que describe mal el código pesa más que un comentario ausente:
 *   es lo que se lee para decidir si algo está hecho, y durante dos rondas dio
 *   "no hay nada que hacer" sobre algo que ya estaba.
 *   `wizards-vault.js` tiene su PROPIA `lsSet`/`kLS`, o sea que su cache nunca
 *   pasó por `putCache()`: el botón no la borraba y un grep sobre `putCache`
 *   tampoco la veía, así que el test de la 50F daba verde sin cubrirla.
 *   El registro se lee **AL PULSAR** (`collectCacheBases()`), no en la escritura
 *   ni al cargar el módulo. Registrar en la escritura sería un hecho de SESIÓN
 *   aplicado a un hecho de DISCO: en una sesión nueva sin haber abierto la
 *   pestaña de WV, el `dryRun` del `confirm()` contaría 0 bytes y prometería una
 *   liberación que no ocurre, que es el bug que la v2.29.0 vino a arreglar.
 *   Leerlo al cargar ataría el borrado al orden de `index.html`.
 *   Cada módulo declara lo suyo (`__cacheBases`) y se anota SOLO en el registro
 *   global `root.__cacheBaseProviders`, con una línea. Esta capa NO nombra
 *   ningún módulo: si los nombrara, la lista de módulos seguiría siendo central
 *   y cada módulo nuevo sería una edición más de este archivo.
 *   `CACHE_PRESERVE_PREFIX` protege `wv:season:` como PREFIXO (no 2 claves
 *   exactas): son las 4 familias de `wv-season-storage.js` —`wv:season:index`,
 *   `wv:season:current`, `wv:season:YY:SEQ` y `wv:season:*.__shadow`—, que son
 *   la PERSISTENCIA oficial de temporada y no cache. Un prefijo corto como `wv`
 *   se las comería. Se evalúan ANTES que los prefijos, para que sean una red.
 *   El registro se colecta UNA VEZ por clic y se pasa a `isCacheKey(k, bases)`:
 *   por clave serían 2 arrays nuevos + 23 `indexOf` en el loop que recorre todo
 *   el store.
 *   MEDIDO: 18 bases de esta capa + 5 del WV = 23 (no 22: el recuento del
 *   Reviewer decía 6 declaraciones de WV donde hay 5). `GW2Api.__cacheBases()`
 *   expone el registro en solo lectura, para que el alcance sea medible y no
 *   estimado. Test: `tests/idea50f.cacheclear-real.test.js` +19 aserciones
 *   (sección 7), con 12 FAIL contra el archivo sin el fix.
 *   v2.29.0 (2026-09-30) — Idea 50 Tramo F: `cacheClear()` ahora borra de verdad
 *   v2.29.0: **NO cambia lo que Pablo ve** (la funcion tiene 0 callers: el boton
 *   sigue sin existir y es el Tramo siguiente). Lo que cambia es que la funcion
 *   deja de mentir: antes `cacheClear()` limpiaba `__mem` y `__inflight`, o sea
 *   la cache de la SESION, y no la de DISCO. La cuota de localStorage (~4.98 MB
 *   medidos) seguia llena, asi que "limpiar cache" no liberaba nada.
 *   Ahora borra de verdad las 19 claves que escribe esta capa y devuelve
 *   `{removed, kept}`. `kept` es la garantia, no un extra: lo que NO se borra
 *   son `gn:account:keys` y `gw2_keys` (la lista de las 27 cuentas), los pines,
 *   el tema y las caches de otros modulos (`gw2_currencies_cache_v1` la escribe
 *   `app.js:46` y nunca pasa por aca). Un "limpiar cache" que se come la lista
 *   de cuentas es el modo de fallo mas caro que puede tener ese boton.
 *   **El borrado es por allowlist EXACTA y no por prefijos, y es decision de
 *   diseno:** medidas sobre el archivo, las 19 claves no comparten ningun
 *   prefijo — `wallet` y `luck` son nombres pelados. Un barrido por familias
 *   (`ach_*`, `commerce_*`) dejaria vivas justamente `wallet`, que es de las que
 *   mas cuota gasta. La propuesta del PO era por prefijos; se midio y se
 *   descarto. La unica defensa contra una lista que envejezca en silencio es la
 *   seccion 5 del test, que recorre las DOS vias de escritura.
 *   Test: tests/idea50f.cacheclear-real.test.js (24 aserciones; 8 FAIL contra el
 *   archivo sin el fix, verificado en rojo antes de tocar el codigo).
 *   P4 del Code-Reviewer, aplicado en el mismo commit porque el cambia la
 *   FIRMA y cambiar una firma despues del merge es mas caro que nacer con ella:
 *   `cacheClear(opts)` acepta `{dryRun: true}` y devuelve
 *   `{removed, kept, bytes, dryRun}` sin borrar nada. `bytes` es lo que le dice
 *   al usuario si vale la pena apretar el boton: `kept` dice que NO se toco, y
 *   no dice si vale la pena tocar. En `dryRun` tampoco se vacia `__mem`, porque
 *   la pregunta es "cuanto borraria" y vaciar la cache de sesion antes de
 *   responder ya seria borrar. Y `removed` ahora cuenta lo BORRADO (la
 *   diferencia de `localStorage.length` antes y despues) en vez de las llamadas
 *   a `lsDel`, que se traga la excepcion y hacia que el numero fuera una
 *   intencion y no un hecho. Sigue con 0 callers: el boton es el Tramo siguiente.
 *   Ojo con el inventario: `getItemsMany` cachea en `items_cache_v1:<lang>`
 *   (`api-gw2.js:1511` lee, `:1581` escribe) con `lsSet` DIRECTO, sin pasar por
 *   `putCache()`. Un inventario hecho solo sobre `var key = ...` no la ve.
 *   v2.28.0: NO cambia lo que Pablo ve. Cambia el TEXTO de un throw.
 *   El mensaje de un guard de FORMA es contrato, no decoracion, porque dos
 *   consumidores lo leen por texto: `raid-tracker.js:1749` y
 *   `strike-tracker.js:1121` hacen `/forma no soportada/.test(error.message)`
 *   para decidir si la pista de permiso tiene sentido. Los tres guards que
 *   existian usaban dos idiomas: los de la v2.24.0/v2.24.1 decian "forma no
 *   soportada (...)" y el de luck decia "La API no devolvio un array of...".
 *   Los wrappers que faltan migrar entran con el idioma del contrato, y si
 *   el de luck quedara fuera, el primer consumidor que filtre por esa cadena
 *   falla en silencio. No se unifico con un helper exportado: eso no evita el
 *   acoplamiento por texto, lo esconde.
 *   v2.29.0: la cifra que estaba aqui ("5 wrappers que faltan migrar") nunca
 *   coincidio con el codigo, y no es un numero que envejecio: nacio viejo. En
 *   `a3d0b5b`, el commit que lo escribio, la marca `Migracion = Tramo 2` ya
 *   estaba en mas sitios de los que la frase decia. El numero de hoy lo cuenta
 *   `tests/idea57t5-cuenta-medida.test.js`, que compara lo que dice esta
 *   cabecera con lo que encuentra en el archivo: si el Tramo 2 migra uno, el
 *   test baja en FAIL y esta cabecera hay que actualizarlo con el porque.
 *   Por eso la frase de arriba no lleva cifra: la que va aca la verifica el
 *   test, no un lector. Acertar el numero no era la tarea; que no se pueda
 *   mentir sin que algo lo note, si.
 *   Test: tests/idea57t4-idioma-contrato.test.js (14 aserciones; 2 FAIL contra
 *   el archivo sin el fix, verificado con `git stash push` + `pop`). Recorre
 *   todos los guards `Array.isArray` del archivo: un wrapper nuevo cae en el
 *   FAIL sin que nadie tenga que acordarse de actualizar una lista.
 *   v2.27.0: PRIMER cambio de comportamiento de la Idea 57, y el unico que
 *   altera lo que Pablo ve. getAccountLuck era el septimo de los once wrappers
 *   que degradaban la FORMA, y el peor de todos: en los otros diez el valor
 *   degradado es `[]` o `0` y `[]` es obviamente falso para cualquiera que haya
 *   estado ahi, pero aca el degradado es `0` y 0 ES VERDADERAMENTE POSIBLE (la
 *   API devuelve `[]` si la cuenta nunca consumio esencia, y ahi 0 es correcto).
 *   Un 200 con cuerpo vacio — que `jfetch` convierte en `null` — producia "0%
 *   de suerte" sin error, sin warn y sin rastro en consola. Ahora rechaza, y la
 *   columna pinta "— ⚠" con el motivo.
 *   Y NO se toco wallet-dashboard.js, porque no hacia falta: el criterio de UI
 *   ("distinguir sin-dato de 0") ya estaba cumplido en LAS DOS CAPAS antes de
 *   este commit — `unreadableCell()` y el guard `typeof s.luck !== 'number'`
 *   ya existian, y la columna se elige POR COLUMNA (`fieldErr ? ... : ...`),
 *   asi que un rechazo no borra la fila: con 27 cuentas, las otras 26 siguen
 *   renderizando. El indistinguible nunca fue la representacion: era que FORMA
 *   y RED llegaban por caminos distintos y solo RED cargaba la bandera.
 *   Test: tests/idea57t2-luck-sindato.test.js (19 aserciones; 2 FAIL contra
 *   el archivo sin el fix, verificado con `git stash push` + `pop`).
 *   v2.26.0: NO cambia el comportamiento de NINGUNA funcion. Es documentacion,
 *   y es el tramo mas barato de la Idea 57 (sin suite nueva, sin capa de datos,
 *   sin riesgo). El problema que arregla: seis wrappers declaraban por escrito
 *   "propaga, no degrada a []" y tres lineas mas abajo hacian
 *   `Array.isArray(data) ? data : []`. La explicacion de la contradiccion
 *   estaba a ~40 lineas del `@throws`, o sea que leer el contrato de la
 *   funcion — lo que hace cualquier consumidor, y lo que hizo el Code
 *   Reviewer al encontrar el bug de getCharacterCount — daba la respuesta
 *   OPUESTA a la real. Ese es el mecanismo por el que nace el wrapper
 *   siguiente: no es que nadie mire, es que el que mira lee un contrato falso.
 *   Los seis `@throws` corregidos describen ahora RED (propaga) y FORMA
 *   (degrada) por separado, con la deuda y el call site al lado. Arreglar el
 *   JSDoc es prevention: elimina la causa de que el proximo nazca mal.
 *   getAccountLuck queda SIN JSDoc a proposito: su problema no es textual sino
 *   de representacion (0% medido vs "sin dato"), y lo decide el Tramo 2 con
 *   veredicto del Reviewer. El test lo verifica para que nadie lo "complete"
 *   con una promesa nueva sin veredicto.
 *   Test: tests/idea57t3-jsdoc-honesto.test.js (11 aserciones; 8 FAIL contra
 *   el archivo sin los JSDoc corregidos).
 *
 *   v2.25.0: NO cambia el comportamiento de ninguna funcion. Instala una
 *   REGLA y pone los contratos en el sitio donde se Incumplen.
 *
 *   Que estaba mal, y por que no lo habia visto nadie: el conteo vivia en un
 *   comentario a mano. La cabecera de la v2.24.1 decia "son SIETE los wrappers
 *   que degradaban por forma" y el numero real era ONCE. Es el mismo tipo de
 *   error que el conteo de "8 tragadores" de la Idea 47: un total escrito a
 *   mano en un comentario, que nadie vuelve a contar y que un fix incremental
 *   desactualiza sin avisar. Acertar el numero no era la tarea; reemplazar el
 *   numero por una regla, si.
 *
 *   La regla (tests/idea57.forma-contracts.test.js): todo sitio que hace
 *   `Array.isArray(x) ? x : []` tiene que DECLARAR su contrato con una etiqueta
 *   `FORMA: degrada` o `FORMA: propaga`. El test recorre el archivo y no
 *   necesita una lista mantenida a mano, asi que un wrapper NUEVO cae en el
 *   FAIL sin que nadie tenga que acordarse de actualizar nada. Ese es el
 *   punto: hasta la v2.24.1 los dos guards se encontraron de rebote, como
 *   follow-up de un review. Los dos primeros no salieron de un test. El decimo
 *   wrapper existia porque nadie escribio la regla, no porque nadie lo
 *   encontrara.
 *
 *   Reparto de los 11, verificado a mano en este commit:
 *     - 2 ya PROPAGAN: getAccountRaids (v2.24.0) y getCharacterCount (v2.24.1).
 *       No se contaron; el test lo verifica explicitamente para que una
 *       reversa silenciosa a `? data : []` no pase.
 *     - 2 son `fetchBatchWithRepair` (un helper de lote con 3 call sites).
 *     - 7 degradan, y su JSDoc hasta la v2.25.0 DECIA "propaga, no degrada
 *       a []": buys, sells, delivery, bank, materials, armory, y el caso de
 *       getAccountLuck. El `catch` de RED cumplia la promesa en las seis
 *       primeras; el camino de FORMA no. En la septima (getAccountLuck) no
 *       hay ni catch ni warn.
 *       TRAMO 3 (v2.26.0): esos seis `@throws` mentian por escrito y ahora
 *       describen las DOS capas, con la deuda del camino de FORMA escrita
 *       al lado. No cambio comportamiento: el unico proposito es que el
 *       contrato que se lee sea el que el codigo cumple hoy, y que la deuda
 *       este en el mismo bloque que la promise, no en un comentario a 40
 *       lineas de distancia. Un JSDoc que promete lo contrario de lo que
 *       hace es la causa raiz de que el proximo wrapper nazca mal.
 *     - 1 degrada LEGITIMAMENTE: getCommerceListings, porque es el catalogo
 *       global del mercado y `[]` es un estado normal (Idea 47, decidido con
 *       el Reviewer). Se declara igual, para que "degrada a proposito" y
 *       "degrada por costumbre" queden escritas y no inferidas.
 *
 *   El mas caro de los once era `getAccountLuck`, y no por el codigo: por lo
 *   que muestra. Aca el valor degradado no es `[]`, es `0`, y `0` ES UN VALOR
 *   VERDADERAMENTE POSIBLE (la API devuelve `[]` si la cuenta nunca consumio
 *   esencia, y ahi 0 es la respuesta correcta). En el Strike Tracker `[]` es
 *   obviamente falso para cualquiera que haya estado ahi; un "0%" en la
 *   columna "Suerte (MF)" se cree en buena fe. El comentario del codigo
 *   declaraba legitimo el valor que es indistinguible del fallo. Es la razon
 *   por la que el Tramo 2 NO es un refactor cosmetico: es un dato que se
 *   cree y es falso.
 *
 *   TRAMO 2 (v2.27.0): `getAccountLuck` deja de ser el septimo caso y pasa a
 *   PROPAGAR. Unico cambio de comportamiento de la Idea 57, y el unico que
 *   altera lo que ve Pablo: la columna "Suerte (MF)" ya no puede mostrar "0%"
 *   cuando en realidad no se pudo leer. Antes un 200 con cuerpo vacio
 *   (`jfetch` devuelve `null`, api-gw2.js:396-408) producia 0% de suerte sin
 *   error, sin warn y sin rastro en consola; ahora la columna pinta "— ⚠" con
 *   el motivo, que es la puerta que `unreadableCell()` ya tenia.
 *
 *   Y NO se toco wallet-dashboard.js, porque no hacia falta: el criterio de UI
 *   ("distinguir sin-dato de 0") ya estaba cumplido en las dos capas antes de
 *   este commit. El indistinguible no era la representacion, era que FORMA y
 *   RED llegaban por caminos distintos y solo uno cargaba la bandera.
 *   Test: tests/idea57t2-luck-sindato.test.js
 *
 *   Lo que NO se hizo, a proposito:
 *     - NO se toco ninguna funcion. Esto es capa de datos: ALERT-48 exige
 *       veredicto del Reviewer antes de tocar comportamiento, y la migracion
 *       de los 7 al guard de la v2.24.0 es exactamente eso (Tramo 2).
 *     - NO se agrego un helper central (expectArray). Meteria una dependencia
 *       nueva en once funciones de una capa que hoy no tiene dependencia
 *       entre wrappers, a cambio del mismo resultado que da un `if` leido en
 *       el sitio donde falla.
 *     - NO se corrigio el conteo "a mano". Siete->once escrito a mano seria
 *       el mismo error otra vez, un commit mas tarde.
 *
 *   Test: tests/idea57.forma-contracts.test.js (18 aserciones; 11 FAIL contra
 *   el archivo sin los contratos declarados).
 *
 *   v2.24.1: F2 del Code-Reviewer sobre la v2.24.0 (`task-b20623f46caa`,
 *   veredicto APROBADO con 3 follow-ups). `getCharacterCount` degrada a `0`
 *   ante una forma no soportada, y su JSDoc de la línea :528 ya decía "no
 *   degrada a 0": el catch de RED cumplía el contrato y el camino de FORMA
 *   no. Es el mismo bug de la v2.24.0, una función arriba. NO es teórico:
 *   `jfetch` devuelve `null` ante un 200 con body vacío (`return raw ?
 *   JSON.parse(raw) : null`, :408), o sea que una API que responde 200 sin
 *   cuerpo producía "0 personajes" en la columna del Wallet Dashboard, sin
 *   error visible e indistinguible de "esta cuenta no tiene personajes".
 *   Test: tests/idea60b.forma-charcount.test.js (21 aserciones; 12 FAIL
 *   contra el archivo sin el fix).
 *   Con esto son SIETE los wrappers que degradaban por forma, no seis: el
 *   "cinco propagados" de la Idea 47 no incluía a este. El relato de la
 *   v2.24.0 queda corregido acá.
 *   ⚠️ ESTE CONTEO QUEDO DESACTUALIZADO en la v2.25.0 y no se corrige: son
 *   ONCE sitios, no siete. La v2.25.0 lo deja escrito a proposito, porque un
 *   numero corregido a mano en un comentario es el mismo error que la v2.25.0
 *   acaba de demostrar. El conteo que vale es el del test.
 *   v2.24.0: `getAccountRaids` degradaba a `[]` ante una forma de respuesta
 *   que no soportamos, y `[]` es indistinguible de "no completaste nada". En
 *   el Strike Tracker eso es `state.completedStrikes = []` -> "0 de 15
 *   completados", exactamente lo que se ve si la cuenta no hizo ninguno.
 *   El JSDoc de la misma función ya decía "no degrada a []" y el código no
 *   lo cumplía: el catch de red propagaba, el camino de FORMA no. Es el
 *   sexto wrapper que degrada (el sexto de la Idea 47). NO arregla el módulo:
 *   ALERT-41 sigue bloqueando, porque los 15 ids de strike no están en
 *   /v2/raids. Lo que hace es convertir el bloqueo en diagnóstico: si la API
 *   responde con la forma del wiki de 2019 (`progress:[{id,cm,li}]`), la
 *   consola lo dice en vez de fingir "0 de 15". Un [] vacío sigue siendo una
 *   respuesta válida y no entra por el guard: "no lo pude leer" y "no hay
 *   nada" tienen que quedar como dos estados distintos.
 *   Test: tests/idea56.forma-raids.test.js (20 aserciones; 12 FAIL contra el
 *   archivo sin el fix).
 *   v2.23.1: CORRIGE una regresión que la v2.23.0 introdujo. El reintento de
 *   los ids faltantes no tenía handler de rechazo. Los ids que faltaron son,
 *   por definición, ids que la API NO tiene: al repreguntarlos sola la API
 *   responde 404 ("all ids provided are invalid"), NO 206 — porque 206
 *   significa "queda al menos uno válido" (medido: ids=1,2,3 -> 404;
 *   ids=1,2,3,4,5 -> 206 con los 2 válidos). Ese 404 propagaba y `arr`, con
 *   los ids válidos que YA TENÍAMOS, se descartaba con él: el fix empeoraba
 *   el bug que quería matar (dejaba el lote entero sin icono y sin cachear,
 *   en vez de sólo el id inválido). En getAchievementsMeta, que no tiene
 *   catch, tumbaba la vista de logros completa. Regla: un reintento es una
 *   MEJORA, no un requisito; si falla, se devuelve el resultado original.
 *   Test: tests/idea49.partial-206.retry404.test.js (13 aserciones; 5 FAIL
 *   contra el archivo sin el fix).
 *   v2.23.0: la API responde 206 cuando SÓLO PARTE de los ids pedidos existen
 *   (medido sin token: ids=1,2,3 -> 404; ids=1,2,3,4,5 -> 206 con 2; ids=all
 *   -> 400). El 206 es un 2xx, así que `!res.ok` NO lo detectaba y el lote se
 *   aceptaba como completo. Ahora fetchBatchWithRepair() reintenta SÓLO los ids
 *   que faltaron, con un piso para no entrar en loop. Regla: un lote se valida
 *   contra los IDS PEDIDOS, nunca contra el largo de la respuesta, y nunca se
 *   rellena por posición (todos los consumidores buscan por `obj.id`).
 *   Además, getItemsMany() resolvía desde `out`, un array local que solo muta
 *   el llamador que ganó la carrera del inflightOnce → la segunda llamada
 *   concurrente recibía [] sin error visible. Ahora resuelve desde la cache,
 *   igual que getAchievementsMeta. Ese defecto ya estaba corregido en
 *   getAchievementsMeta (Idea 49, HB#48) y nunca llegó a getItemsMany.
 *   v2.22.0: corrige 2 defectos del sharding de v2.21.0, encontrados por el
 *   Code Reviewer y reproducidos con test. (1) Dos cargas concurrentes del
 *   mismo shard en frío compartían el inflightOnce, así que sólo la primera
 *   mutaba su bag local y la segunda resolvía contra {} → devolvía [] y
 *   achievements.js quedaba con logros sin nombre, icono ni tiers, y earnedAP
 *   en 0 sin ningún error. Ahora la resolución final relee el shard del caché.
 *   (2) nocache devolvía null de getCache → bag vacío → putCache pisaba el
 *   shard entero con el subconjunto de una sola cuenta. Ahora el bag se lee
 *   siempre y se mergea: un shard es compartido por todas las cuentas.
 *   Además poda los 5 campos que la API manda y NADIE lee (bits, requirement,
 *   locked_text, prerequisites, point_cap) ANTES de guardar.
 *   v2.21.0: getAchievementsMeta() cachea por SHARD (id//200) en vez de por
 *   id-set. La key vieja llevaba el id-set entero dentro del nombre, así que
 *   cada cuenta guardaba su propia copia de la misma tabla: con 27 cuentas,
 *   20.22 MB en 216 claves, contra una cuota real de 4.98 MB. Con sharding:
 *   1.71 MB en 18 claves (-91.5%). Se pide SÓLO lo que falta de cada shard, así
 *   que el ahorro de cuota no se paga con peticiones. Migra (borra) las keys
 *   viejas en el primer uso: sin eso no se libera nada, porque la cuota ya
 *   está llena. Ver ALERT-47 y BACKLOG.md Idea 49 Tramo C.
 *
 *   ⚠️ Cifras de la v2.21.0: las tres versiones que circulaban (18 claves /
 *   1.71 MB en el header, "35 shards, 3.58 MB" en el commit, 18.64 MB → 1.85 MB
 *   en 40 claves en la corrida del test) NO reproducen con datos reales.
 *   Medido contra la API en vivo (tools/idea49c-measure.mjs, 3458 logros,
 *   lang=es, 27 cuentas × ~1500 logros solapados, cuota 4.98 MB):
 *     patrón viejo (key por id-set): 20.22 MB
 *     sharding, sin podar:           1.75 MB en 20 claves (35.2% de la cuota)
 *     sharding, podando 5 campos:    0.81 MB en 20 claves (16.4% de la cuota)
 *   El sharding sigue siendo necesario (sin él la cuota se excede ~4×), pero
 *   por sí solo NO cierra el problema: `ach_acc` es la otra mitad.
 *   v2.20.0: lsSet() ya no se traga los errores con catch vacío. Devuelve
 *   booleano, cuenta los QuotaExceededError y avisa una sola vez. La cuota de
 *   localStorage (~4.98 MB) es compartida por TODOS los módulos, así que
 *   cuando se llena cada escritura posterior falla en silencio y la app
 *   reinicia en frío en cada recarga. Visible en GW2Api.__cacheStats().
 *   No relanza el error: la copia en __mem ya sirvió para la sesión.
 *   Esto solo hace que el fallo se pueda ver en vez de disfrazarse de lentitud.
 *   v2.19.0: POOL_MAX 3 → 6. Con 3 slots y ~900 ms de latencia mediana el pool
 *   rendía ~200 req/min = 33% del permiso (X-Rate-Limit-Limit: 600). Con 6
 *   rinde ~400/min y la primera pantalla del Dashboard Cartera con 27 cuentas
 *   baja de 32.7 s a 16.4 s. El 3 no lo eligió nadie: se heredó de los pools
 *   locales de cada dashboard y nunca se midió.
 *   NO arregla el 429 (ALERT-27): el límite de ArenaNet es de tasa, no de
 *   concurrencia. El pool amortigua picos, no excedentes sostenidos. Un
 *   recorrido de 27 cuentas entra; un agregado de varios simultáneos puede
 *   reventarlo igual. El token bucket sigue siendo previo a la Idea 42.
 *   Verificado con tests/idea48.poolmax.test.js, que carga este archivo real
 *   con un fetch falso de latencia conocida: el pico nunca excede POOL_MAX,
 *   3 → 6 reduce el tiempo de la tanda, y no se filtra ningún slot.
 *   Sin cambio de comportamiento observable: mismos resultados, mismos
 *   errores, misma cache. Solo cambia CUANTOS requests pueden estar en vuelo.
 *   v2.18.0: getCharacterCount, getAccountRaids, getCommerceTransactionsBuys,
 *   getCommerceTransactionsSells, getAccountBank, getAccountMaterials y
 *   getAccountLegendaryArmory dejan de tragar el error y devuelven [] / 0.
 *   Un 0 por "no pude leer" es indistinguible de un 0 real: el usuario Borra y
 *   re-agrega una API key que funcionaba. Ahora el error sube al call site,
 *   que es donde esta escrito como surfacearlo.
 *   NO entra getCommerceListings: ahi [] SI es estado normal (la cuenta no
 *   tiene nada publicado), no un error tragado. Decision de alcance del PO.
 *   Consumidores: wallet-dashboard (try/catch por campo, sus _errors
 *   characters/raids dejaron de ser inalcanzables), inventory-hub,
 *   inventory-dashboard, raid-tracker, strike-tracker y converter-modal
 *   (Promise.allSettled; estos dos ultimos ya toleraban el rechazo).
 *   v2.17.1: poolPump ya no pierde el slot si un task tira sincrónico.
 *
 * Cambios v2.17.0:
 *  - NUEVO pool global de concurrencia en el unico punto de estrangulacion
 *    de la capa (jfetch). El MAX=3 estaba duplicado dentro de cada dashboard,
 *    o sea que era local: inventory-dashboard hacia Promise.all de 3 DENTRO
 *    de su pool = 9 requests simultaneos reales. Con este pool el tope es
 *    global a la pagina entera, no por modulo.
 *  - __cfg.poolStats() y __cfg.setPoolMax(n) para observar y ajustar.
 *    Idea 46 t2 va a leer poolStats() para decir "limitado por la API (600/min)"
 *    en vez de "Cargando" cuando la cola se acumula.
 *  - Sin cambio de comportamiento observable: mismos resultados, mismos
 *    errores, misma cache. Solo cambia CUANTOS requests pueden estar en vuelo.
 *
 * Versión: 2.16.0 (2026-09-29) — Commerce: + Delivery (ítems sin recoger del TP)
 *
 * Cobertura de este archivo:
 *  - Token / permisos (tokeninfo)
 *  - Wallet + currencies (fallback AA)
 *  - Items batch (con caché por id, cap de 500 entradas)
 *  - Achievements (cuenta + metadatos)
 *  - Account info (con last_modified para detectar actividad)
 *  - Raids (getAccountRaids para seguimiento semanal)
 *  - Inventory: Bank, Materials, Legendary Armory
 *  - Commerce: Listings, Prices, Transactions (buys/sells), Delivery (sin recoger)
 *  - Delegados Wizard's Vault (retrocompatibles)
 *
 * Cambios v2.16.0:
 *  - NUEVA función getCommerceDelivery(token, opts) - Endpoint /v2/commerce/delivery
 *    Muestra lo que la cuenta tiene pendiente de recoger en la caja del Trading Post.
 *    Endpoint verificado en vivo 2026-09-29: 401 con token inválido (existe); un
 *    endpoint inexistente devuelve 404 "not found". Data-only, sin CSS.
 *
 * Cambios v2.15.0:
 *  - NUEVA función getCommerceListings(opts) — Endpoint /v2/commerce/listings
 *  - NUEVA función getCommercePrices(ids, opts) — Endpoint /v2/commerce/prices
 *  - NUEVA función getCommerceTransactionsBuys(token, opts)
 *  - NUEVA función getCommerceTransactionsSells(token, opts)
 *  - Cap de 500 entradas en items_cache_v1:es (elimina las 100 más viejas)
 *
 * Cambios v2.14.0:
 *  - NUEVA función getAccountBank(token, opts) para obtener el banco de la cuenta
 *  - NUEVA función getAccountMaterials(token, opts) para almacenamiento de materiales
 *  - NUEVA función getAccountLegendaryArmory(token, opts) para armería legendaria
 *
 * Cambios v2.13.0:
 *  - NUEVA función getAccountRaids(token, opts) para encuentros de raid completados
 *
 * Cambios v2.12.0:
 *  - NUEVA función getAccountInfo(token) que devuelve last_modified
 *  - ELIMINADA lógica de PvP (getPvPGames, isRecentlyActiveInPvP)
 * ======================================================================= */

(function (root) {
  'use strict';

  var LOGP = '[GW2Api]';
  var API_BASE = 'https://api.guildwars2.com';

  // TTLs (ms)
  var TTL = {
    TOKENINFO:    10 * 60 * 1000,            // 10 min
    ACCOUNT:      30 * 1000,                 // 30 segundos (actividad reciente)
    RAIDS:         5 * 60 * 1000,            // 5 minutos
    BANK:          2 * 60 * 1000,            // 2 min (inventario cambia poco)
    MATERIALS:     2 * 60 * 1000,            // 2 min
    ARMORY:        5 * 60 * 1000,            // 5 min (legendarios no cambian seguido)
    COMM_LISTINGS: 5 * 60 * 1000,            // 5 min (listado de items en TP)
    COMM_PRICES:   2 * 60 * 1000,            // 2 min (precios fluctúan rápido)
    WV_SEASON:     6 * 60 * 60 * 1000,       // 6 h
    WV_LISTINGS:  30 * 60 * 1000,            // 30 min
    WV_ACCOUNT:    5 * 60 * 1000,            // 5 min
    WV_OBJ:        5 * 60 * 1000,            // 5 min
    ITEMS:        24 * 60 * 60 * 1000,       // 24 h (por id)
    CURR:          7 * 24 * 60 * 60 * 1000,  // 7 días
    WALLET:        2 * 60 * 1000,            // 2 min
    SKINS:         6 * 60 * 60 * 1000,       // 6 h (el desbloqueo de una skin es una compra)
    LUCK:          10 * 60 * 1000,           // 10 min (la suerte solo sube al consumir esencia)
    ACH_ACC:       2 * 60 * 1000,            // 2 min
    ACH_META:     12 * 60 * 60 * 1000        // 12 h
  };

  var CFG = {
    API_BASE: API_BASE,
    TTL: TTL,
    LANG: 'es',
    RETRIES: 2,
    RETRY_BASE_MS: 600,
    // POOL_MAX 3 -> 6 (Idea 48, Tramo A). Medido, no elegido: con 3 slots y
    // ~900 ms de latencia mediana el pool rendia ~200 req/min = 33% del
    // permiso (X-Rate-Limit-Limit: 600). Con 6 rinde ~400/min y la primera
    // pantalla del Dashboard Cartera con 27 cuentas baja de 32.7 s a 16.4 s.
    //
    // SUBIR ESTE NUMERO NO ARREGLA EL 429 (ALERT-27): el limite de ArenaNet es
    // de TASA, no de concurrencia. El pool amortigua picos, no excedentes
    // sostenidos. Con 6 slots y 900 ms el techo teorico es ~400/min, por debajo
    // de 600, asi que un recorrido con 27 cuentas entra. Un agregado de varios
    // recorridos simultaneos lo puede reventar igual: para eso falta el token
    // bucket, que es lo que tiene que preceder a la Idea 42.
    POOL_MAX: 6
  };

  var __mem = new Map();
  var __inflight = new Map();

  // Catalogo de skins resuelto id -> ficha. EN MEMORIA, a proposito y no por
  // descuido: `getItemsMany` persiste porque los items ya hacen falta en
  // varias superficies, y este catalogo son ~10.632 fichas que hoy nadie
  // pide. Persistirlo seria una familia de clave mas cerca del techo de
  // cuota medido (Idea 49: ~4.98 MB, con 27 cuentas de logros ya en
  // 14.22 MB) y el unico escape pasaria a ser `cacheClear`.
  var __skinsMeta = Object.create(null);

  // ---- Pool global de requests (Idea 46, t1) ------------------------------
  // El limite MAX vivia duplicado dentro de cada dashboard, o sea que era
  // LOCAL: dos dashboards cargando a la vez = 6, y inventory-dashboard hacia
  // Promise.all de 3 DENTRO del pool = 9 requests simultaneos reales, contra
  // un MAX=3 que el codigo creia tener.
  // aca hay UN solo punto de estrangulacion para toda la capa API: jfetch().
  // El header real de ArenaNet es X-Rate-Limit-Limit: 600/min.
  // t2 (UI) lee poolStats() para poder decir "limitado por la API" en vez de
  // "Cargando" cuando la cola se esta acumulando.
  var __poolActive = 0;
  var __poolQueue = [];
  var __poolWaited = 0;   // requests que tuvieron que esperar turno
  var __poolWaitMs = 0;   // espera acumulada de la cola, en ms

  function poolStats() {
    return {
      max: CFG.POOL_MAX,
      active: __poolActive,
      queued: __poolQueue.length,
      waited: __poolWaited,
      waitMs: __poolWaitMs
    };
  }

  function poolRun(task) {
    return new Promise(function (resolve, reject) {
      __poolQueue.push({ task: task, resolve: resolve, reject: reject, enqueued: now() });
      poolPump();
    });
  }

  function poolPump() {
    while (__poolActive < CFG.POOL_MAX && __poolQueue.length) {
      var slot = __poolQueue.shift();
      var waited = now() - slot.enqueued;
      if (waited > 0) { __poolWaited++; __poolWaitMs += waited; }
      __poolActive++;
      (function (s) {
        function done() { __poolActive--; poolPump(); }
        // Promise.resolve().then(s.task) y no s.task() directo: si el task tira
        // SINCRONO (no devuelve promesa, lanza antes de retornar), el throw sube
        // por poolPump -> executor de poolRun, done() nunca corre y __poolActive
        // queda incrementado para siempre. Con POOL_MAX=6, seis de esos cuelgan la
        // app entera de forma permanente. Envolviendo, el throw se convierte en
        // rechazo y cae siempre en el reject de abajo -> done().
        Promise.resolve().then(s.task).then(function (v) { done(); s.resolve(v); },
                                            function (e) { done(); s.reject(e); });
      })(slot);
    }
  }

  function lsGet(key) {
    try { var j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch (_) { return null; }
  }
  // Idea 49 Tramo A: antes esto era `catch (_) {}`, o sea tragaba CUALQUIER
  // error sin dejar rastro. El que importa es el de cuota: la cuota de
  // localStorage (~4.98 MB medidos en navegador real) es COMPARTIDA por todas
  // las claves cacheadas de la pagina, no por modulo. Cuando se llena, cada
  // escritura posterior falla y la app vuelve a arrancar en frio en cada
  // recarga, sin que nada lo diga: se presenta como "la Boveda anda lenta".
  //
  // Esto estaba enmascarado porque activities.js borraba la familia 'ach_*' en
  // cada navegacion a #/activities (wipe accidental = alivio de cuota). Al
  // quitar ese wipe (mismo heartbeat), la cuota se llena de verdad, asi que el
  // fallo deja de seripotetico y hay que poder nombrarlo.
  //
  // NO se relanza el error: la copia en __mem ya sirvio para esta sesion, y
  // un throw aca seria peor que el bug que se esta corrigiendo. Se cuenta y se
  // avisa UNA vez (no una por clave: son cientos de escrituras por carga).
  var __lsQuotaFails = 0;
  var __lsQuotaWarned = false;
  // Idea 50 Tramo E: purgas REALES de entradas vencidas (ver `getCache`).
  var __expiredDrops = 0;
  function isQuotaError(e) {
    if (!e) return false;
    return e.name === 'QuotaExceededError' ||
           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           e.code === 22 || e.code === 1014;   // legacy IE/Edge
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      if (isQuotaError(e)) {
        __lsQuotaFails++;
        if (!__lsQuotaWarned) {
          __lsQuotaWarned = true;
          console.warn('[api-gw2] localStorage LLENO: la cache ya NO se guarda entre recargas.' +
            ' El error era silencioso (catch vacio) y la cuota es compartida por todos los' +
            ' modulos, asi que esto afecta a TODA la cache, no solo a la de logros.' +
            ' Ver BACKLOG.md Idea 49 (Tramo C: comprimir los logros es lo que lo arregla).');
        }
      }
      return false;
    }
  }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (_) {} }
  // Idea 50 Tramo E: "esta la clave?" separado de "borrala". Hace falta
  // porque `removeItem` no devuelve nada: sin esto, contar una purga seria
  // contar una INTENCION (P4 del Tramo F, con `removed`). Ademas distingue
  // "no estaba" de "estaba y se borro", que el codigo que llama necesita para
  // no afirmar que limpio algo que no existia.
  function lsHas(key) { try { return localStorage.getItem(key) !== null; } catch (_) { return false; } }
  function now() { return Date.now(); }
  function isFresh(entry, ttl) { return !!entry && typeof entry.ts === 'number' && (now() - entry.ts) <= ttl; }

  function fpToken(token) { var t = String(token || ''); return t ? (t.slice(0,4) + '…' + t.slice(-4)) : 'anon'; }

  function kMem(base, token) { return token ? (base + '::' + fpToken(token)) : base; }
  function kLS(base, token)  { return token ? (base + ':'  + fpToken(token)) : base; }

  function inflightOnce(ikey, producer) {
    if (__inflight.has(ikey)) return __inflight.get(ikey);
    var p = Promise.resolve().then(producer).finally(function () { __inflight.delete(ikey); });
    __inflight.set(ikey, p);
    return p;
  }

  function toNum(v, d) { var n = (v == null || v === '') ? NaN : +v; return isFinite(n) ? n : (d == null ? 0 : d); }

  function withToken(url, token) { var u = new URL(url); if (token) u.searchParams.set('access_token', token); return u.toString(); }
  function withParams(url, params) {
    var u = new URL(url);
    if (params) Object.keys(params).forEach(function (k) {
      var val = params[k];
      if (val != null) u.searchParams.set(k, String(val));
    });
    return u.toString();
  }

  // ------------------------------------------------------------------
  // Lotes parciales: la API responde 206 cuando SOLO PARTE de los ids
  // pedidos existen (medido 2026-09-30 sin token):
  //   /v2/items?ids=1,2,3      -> 404 "all ids provided are invalid"
  //   /v2/items?ids=1,2,3,4,5  -> 206 con SOLO los 2 validos
  //   /v2/items?ids=all        -> 400
  // El 206 es un 2xx, asi que `!res.ok` NO lo detecta y el lote se acepta
  // como completo. La regla es: un lote se valida contra los IDS PEDIDOS,
  // nunca contra el largo de la respuesta.
  //
  // NO se rellena por posicion NUNCA. Todos los consumidores buscan por
  // `obj.id`, asi que la posicion no importa; el dano real de no validar
  // es el dato faltante que se cachea como si estuviera completo.
  // ------------------------------------------------------------------
  function missingFromBatch(requested, received) {
    var got = Object.create(null);
    (received || []).forEach(function (o) {
      if (o && o.id != null) got[String(o.id)] = 1;
    });
    return requested.filter(function (id) { return !got[String(id)]; });
  }

  // Reintenta SOLO los ids que faltaban del 206. Con un piso de intentos
  // para que un id genuinamente invalido no dispare un loop: si no existe
  // en el catalogo, la API lo va a seguir tirando, y hay que devolver algo.
  function fetchBatchWithRepair(url, requested, opts) {
    return fetchWithRetry(url, opts).then(function (data) {
      // FORMA: degrada (interino, Idea 57 T2). Una respuesta con una forma
      // que no soportamos entra como `[]` y sale como "0 de N". Quien llama
      // (getItemsMany, getAchievementsMeta, getCommercePrices) la trata como
      // exito: sin este aviso no hay forma de distinguir "el lote vino vacio"
      // de "no supe leer el lote". El `catch` de RED si propaga, asi que el
      // unico camino que traga el error es este.
      var arr = Array.isArray(data) ? data : [];
      var left = missingFromBatch(requested, arr);
      if (!left.length) return arr;
      if (left.length === requested.length) {
        // No se filtro nada: o el endpoint no devuelve `id`, o el lote
        // entero fallo. No tiene sentido reintentar el mismo lote.
        return arr;
      }
      var u2 = url.replace(/([?&])ids=[^&]*/, '$1ids=' + left.join(','));
      // El reintento es una MEJORA, no un requisito. Los ids que faltaron
      // son, por definicion, ids que la API no tiene: si se los repregunta
      // sola, la API responde 404 ("all ids provided are invalid"), NO 206
      // -- porque 206 significa "queda al menos uno valido". Medido:
      //   /v2/items?ids=1,2,3      -> 404
      //   /v2/items?ids=1,2,3,4,5  -> 206 con los 2 validos
      // Sin este segundo handler de rechazo, ese 404 propagaba y
      // `arr` -- los ids validos que YA TENIAMOS -- se descartaba con el:
      // el fix empeoraba el bug que pretendia matar (dejaba sin icono todo
      // el lote, y sin cachear, en vez de solo el id invalido). Y en
      // getAchievementsMeta, que no tiene catch, tumbaba la vista entera.
      return fetchWithRetry(u2, opts).then(function (data2) {
        return arr.concat(Array.isArray(data2) ? data2 : []);
      }, function () {
        return arr;
      });
    });
  }

  function jfetch(url, opts) {
    opts = opts || {};
    var nocache = !!opts.nocache;
    var headers = Object.assign({ 'Accept': 'application/json' }, (opts.headers || {}));
    var init = {
      headers: headers,
      cache: nocache ? 'no-store' : 'default',
      mode: 'cors'
    };
    if (opts.signal) init.signal = opts.signal;

    // Todo request de la capa API pasa por el pool global (Idea 46 t1).
    // El slot se toma antes del fetch y se devuelve DESPUES de leer el body,
    // para que el limite cuente requests en vuelo y no solo fetch iniciados.
    return poolRun(function () {
      return fetch(url, init).then(function (res) {
        return res.text().then(function (raw) {
          if (!res.ok) {
            var msg = raw || ('HTTP ' + res.status);
            try {
              var o = raw ? JSON.parse(raw) : null;
              if (o && (o.text || o.error)) msg = o.text || o.error;
            } catch (_){}
            var err = new Error(msg); err.status = res.status; err.url = url; throw err;
          }
          try { return raw ? JSON.parse(raw) : null; }
          catch (e) { var er = new Error('JSON inválido en ' + url + ': ' + String(raw).slice(0,200)); er.url = url; throw er; }
        });
      });
    });
  }

  function fetchWithRetry(url, opts) {
    opts = opts || {};
    var max = (opts.retries != null) ? opts.retries : CFG.RETRIES;
    var attempt = 0;
    var lastErr;

    function jitter() { return Math.floor(Math.random() * 200); }

    function loop() {
      return jfetch(url, opts).catch(function (e) {
        lastErr = e;
        var retriable = e && (e.status === 429 || e.status === 503 || e.status === 504);
        if (!retriable || attempt >= max) throw lastErr;
        var backoff = Math.min(5000, CFG.RETRY_BASE_MS * Math.pow(2, attempt)) + jitter();
        attempt++;
        return new Promise(function (r) { setTimeout(r, backoff); }).then(loop);
      });
    }
    return loop();
  }

  // Idea 50 Tramo E: al vencer, la entrada SE BORRA. Antes devolvia null y la
  // dejaba viva en las dos capas: el TTL dejaba de leer y no liberaba, y con
  // 27 cuentas x 17 baseKey la cache crecia sin limite.
  //
  // POR QUE ES SEGURO, y por que no es "solo un delete". isFresh dice
  // `age <= ttl`, y el borrado es DIRECCIONAL:
  //   - TTL corto dice vencida => el TTL largo tambien (mas viejo no se
  //     arregla con mas tolerancia). Borrar aca no le quita nada a nadie.
  //   - TTL corto dice vencida => el TTL largo dice FRESCA. Ahi el wrapper
  //     corto se llevaria la entrada del largo.
  //
  // MEDIDO (tests/idea50e.cache-expiry-purge.test.js seccion 3): 18 sitios de
  // lectura, 17 baseKey, y UNA sola con dos sitios -- `ach_meta_v3:` -- que
  // usa `TTL.ACH_META` en los dos. Osea que hoy no hay colision. Ese test
  // congela el numero: si alguien agrega un segundo TTL para una baseKey que
  // ya tiene uno, el test falla.
  //
  // EL ORDEN importa y no es cosmetico: __mem se borra DESPUES de intentar
  // promover desde localStorage. Ese es el caso "la memoria vencio pero el
  // disco esta fresco" (una recarga con la cuota llena) y borrando antes se
  // pierde la promocion que hoy existe.
  function getCache(baseKey, ttl, token, nocache) {
    if (nocache) return null;
    var mkey = kMem(baseKey, token);
    var mval = __mem.get(mkey);
    if (isFresh(mval, ttl)) return mval.data;
    var lkey = kLS(baseKey, token);
    var lval = lsGet(lkey);
    if (isFresh(lval, ttl)) {
      __mem.set(mkey, { ts: lval.ts, data: lval.data });
      return lval.data;
    }
    // Las dos capas quedaron vencidas. Se purgan y se CUENTAN.
    // - __mem: `Map.delete` devuelve booleano, o sea que el numero es un hecho.
    // - localStorage: `removeItem` no devuelve nada, asi que se pregunta antes
    //   con `lsHas`; si la clave no estaba, no se cuenta ninguna purga. Un
    //   contador que sube sin que nada pase es peor que no medir (P4, Tramo F).
    // NO se purga el `catch` de RED que deja una entrada sin `ts`: esa no es
    // una entrada vencida, es una malformada, y tratarlas igual seria mezclar
    // dos cosas en un numero que alguien va a leer para diagnosticar.
    if (__mem.delete(mkey)) __expiredDrops++;
    if (lsHas(lkey)) { lsDel(lkey); __expiredDrops++; }
    return null;
  }
  function putCache(baseKey, data, token, ttl) {
    var entry = { ts: now(), data: data };
    __mem.set(kMem(baseKey, token), entry);
    lsSet(kLS(baseKey, token), entry);
  }

  // ========================================================================
  // Token info + permisos
  // ========================================================================
  function getTokenInfo(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'tokeninfo';
    var cached = getCache(key, TTL.TOKENINFO, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/tokeninfo', token);
    var ikey = 'if:tokeninfo:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.TOKENINFO);
        return data;
      });
    });
  }
  function tokenHasWVPermissions(tokenInfo) {
    try {
      var p = new Set((tokenInfo && tokenInfo.permissions) || []);
      return p.has('wizardsvault') || p.has('progression');
    } catch (_){ return false; }
  }

  // ========================================================================
  // Account info (con last_modified para detectar actividad)
  // ========================================================================
  function getAccountInfo(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_info';
    var cached = getCache(key, TTL.ACCOUNT, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account?v=latest', token);
    var ikey = 'if:account_info:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.ACCOUNT);
        return data;
      });
    });
  }

  function isRecentlyActive(accountInfo, minutesThreshold) {
    if (!accountInfo || !accountInfo.last_modified) return false;
    
    var threshold = (minutesThreshold || 10) * 60 * 1000;
    var now = Date.now();
    var lastModified = new Date(accountInfo.last_modified).getTime();
    
    if (isNaN(lastModified)) return false;
    
    return (now - lastModified) <= threshold;
  }

  // ========================================================================
  // Character count
  // ========================================================================
  /**
   * Obtiene la cantidad de personajes de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<number>} - Cantidad de personajes
   * @throws {Error} si la API no se pudo leer (propaga, no degrada a 0)
   */
  function getCharacterCount(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'char_count';
    var cached = getCache(key, TTL.ACCOUNT, token, opts.nocache);
    if (cached !== null && typeof cached === 'number') return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/characters', token);
    var ikey = 'if:char_count:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA (Idea 60B). Mismo contrato que getAccountRaids
        // (v2.24.0) y mismo motivo: el JSDoc de arriba promete "no degrada
        // a 0" y solo lo cumplia el catch de RED. Una respuesta con una
        // forma que no soportamos llegaba como `0`, que en la columna
        // "Personajes" del Wallet Dashboard es indistinguible de "esta
        // cuenta no tiene personajes".
        //
        // ALCANZABLE, no teórico: `jfetch` devuelve `null` ante un 200 con
        // body vacío (`return raw ? JSON.parse(raw) : null`, api-gw2.js:408).
        // O sea que la API contestando 200 sin cuerpo landing acá produce
        // "0 personajes" sin ningún error visible.
        if (!Array.isArray(data)) {
          throw new Error(
            'characters: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de personajes.'
          );
        }
        var count = data.length;
        putCache(key, count, token, TTL.ACCOUNT);
        return count;
      }).catch(function (error) {
        // Se registra y se propaga. Ver la nota de contrato en el JSDoc:
        // degradar a 0 acá sería indistinguible de "la cuenta no tiene personajes".
        console.warn(LOGP, 'Error getting character count:', error);
        throw error;
      });
    });
  }

  // ========================================================================
  // Raids
  // ========================================================================
  /**
   * Obtiene los IDs de encuentros completados por la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de IDs de encuentros
   * @throws {Error} si la API no se pudo leer (propaga, no degrada a [])
   */
  function getAccountRaids(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_raids';
    var ttl = TTL.RAIDS;
    
    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/raids', token);
    var ikey = 'if:account_raids:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA (Idea 56). El guard de red ya estaba abajo y
        // propagaba, pero una respuesta con una forma que no soportamos
        // degradaba a [] en silencio. En el Strike Tracker eso es
        // `state.completedStrikes = []` -> "0 de 15 completados", que es
        // EXACTAMENTE lo que se veria si la cuenta no hizo ninguno. No se
        // puede distinguir "no leí" de "no hay". Se propaga: los 5 call
        // sites ya manejan rechazo (allSettled / try-catch que relanza /
        // prefetch que lo ignora), verificado en el HB#54.
        //
        // OJO: un [] VACIO sigue siendo una respuesta valida y no entra por
        // aca. "No completaste nada" y "no lo pude leer" tienen que quedar
        // como dos estados distintos; este guard existe para eso.
        if (!Array.isArray(data)) {
          throw new Error(
            'account/raids: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de ids de encuentro.'
          );
        }
        putCache(key, data, token, ttl);
        return data;
      }).catch(function (error) {
        // Se registra y se propaga. Ver la nota de contrato en el JSDoc:
        // degradar a [] acá sería indistinguible de "no completaste ningún encuentro".
        console.warn(LOGP, 'Error getting account raids:', error);
        throw error;
      });
    });
  }

  // ========================================================================
  // COMMERCE: Listings, Prices y Transactions del Trading Post (v2.15.0)
  // ========================================================================

  /**
   * Obtiene las órdenes de compra activas del jugador
   * @param {string} token - API Key con permiso tradingpost
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>}
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *
   * CONTRATO REAL (Idea 57 Tramo 3, v2.26.0) — este `@throws` mentia hasta
   * aca. Prometia que el error se propagaba sin excepciones y el codigo de
   * abajo si degrada. Hay DOS caminos de error y no se comportan igual:
   *   - capa de RED (fetch falla, 401, 403): el `.catch` de abajo PROPAGA.
   *   - capa de FORMA (respuesta 200 con una forma que no soportamos, o
   *     cuerpo vacio, que `jfetch` devuelve como `null`): degrada a `[]` en
   *     silencio, sin aviso y sin warning.
   * `[]` aqui significa indistinguible entre "no tenes ordenes" (verdad) y
   * "no supe leerte las ordenes" (mentira). El call site
   * (converter-modal.js:734) ya tiene `buysStatus = 'error'` y usa
   * allSettled, asi que puede distinguir: migrar al guard de la v2.24.0 es
   * seguro. Eso es el Tramo 2 de la Idea 57, pendiente de veredicto del
   * Reviewer (ALERT-48: es capa de datos, no se mergea "por merito").
   */
  function getCommerceTransactionsBuys(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'commerce_transactions_buys';
    var ttl = 60 * 1000; // 1 minuto

    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/commerce/transactions/current/buys', token);
    var ikey = 'if:commerce_transactions_buys:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // FORMA: degrada. El JSDoc de arriba dice "propaga, no degrada a []"
        // y ACA NO SE CUMPLE: el `catch` de RED propaga, el camino de FORMA
        // no. Es el mismo bug que la v2.24.0 corrigio en getAccountRaids, una
        // funcion mas arriba, y que la v2.24.1 corrigio en getCharacterCount.
        // El call site (converter-modal.js:734) usa allSettled y ya tiene
        // `buysStatus = 'error'`: migrar al guard es seguro y no rompe nada.
        // Migracion = Tramo 2 de la Idea 57 (capa de datos, va al Reviewer).
        var tx = Array.isArray(data) ? data : [];
        putCache(key, tx, token, ttl);
        return tx;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce transactions (buys):', error);
        throw error;
      });
    });
  }

  /**
   * Obtiene las órdenes de venta activas del jugador
   * @param {string} token - API Key con permiso tradingpost
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>}
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *
   * CONTRATO REAL (Idea 57 Tramo 3, v2.26.0) — este `@throws` mentia hasta
   * aca. Mismo caso que getCommerceTransactionsBuys, una funcion mas arriba:
   * RED propaga, FORMA degrada a `[]` en silencio. El call site ya usa
   * allSettled y arma `sellsStatus`, asi que puede distinguir.
   * Migracion al guard = Tramo 2 de la Idea 57 (va al Reviewer).
   */
  function getCommerceTransactionsSells(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'commerce_transactions_sells';
    var ttl = 60 * 1000; // 1 minuto

    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/commerce/transactions/current/sells', token);
    var ikey = 'if:commerce_transactions_sells:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // FORMA: degrada. El JSDoc de arriba dice "propaga, no degrada a []"
        // y ACA NO SE CUMPLE: el `catch` de RED propaga, el camino de FORMA
        // no. Ver el bloque equivalente en getCommerceTransactionsBuys. El
        // call site (converter-modal.js:735) usa allSettled y ya tiene
        // `sellsStatus = 'error'`: migrar al guard es seguro.
        // Migracion = Tramo 2 de la Idea 57.
        var tx = Array.isArray(data) ? data : [];
        putCache(key, tx, token, ttl);
        return tx;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce transactions (sells):', error);
        throw error;
      });
    });
  }

  /**
   * Obtiene los items del Trading Post que la cuenta aún NO ha recogido
   * (botín de ventas y compras pendientes de cobro).
   *
   * Endpoint: /v2/commerce/delivery — verificado 2026-09-29 (401 con token
   * inválido = existe; un endpoint inexistente devuelve 404 "not found").
   * Requiere API key con permiso `tradingpost`.
   *
   * A diferencia de buys/sells, acá el problema de negocio es del usuario:
   * lo que figura en la caja del TP y nunca se cobró. Sin esto, la Bóveda
   * muestra la venta como histórica y el ítem queda invisible.
   *
   * ⚠️ DESVIACIÓN DELIBERADA de sus sisters (revisado por el Code Reviewer):
   * buys/sells degradan a `[]` en error porque `[]` es su estado NORMAL. Acá
   * no: `[]` significaría "no tenés nada pendiente" cuando en realidad puede
   * ser "no se pudo leer". El caso que más probable lo dispara no es una caída
   * transitoria sino un **403 permanente por falta de scope `tradingpost`**,
   * que nunca se resuelve solo. Como el valor de esta feature ES el alerta,
   * un vacío silencioso la deja mintiendo sobre su único propósito.
   * Por eso acá el error se PROPAGA. La UI debe distinguir tres estados:
   * pendiente / vacío real / no se pudo leer.
   *
   * ⚠️ POR QUE ESTE ES EL CASO EXTREMO (Idea 57 Tramo 3, v2.26.0)
   * El parrafo de arriba no es una aspiracion: es el unico `@throws` del
   * archivo que describe por que el error NO puede degradarse. Y aun asi
   * el codigo no lo cumple entero. El `catch` de RED propaga, pero el camino
   * de FORMA (200 con cuerpo vacio -> `jfetch` devuelve `null`, o una forma
   * no soportada) entra como `[]` en silencio, exactamente el estado que el
   * parrafo de arriba dice que mentiria.
   *
   * O sea: el 403 por falta de scope SI se ve (propaga), y ese es el caso
   * que el parrafo menciona. El otro caso — la API responde 200 y no se
   * entiende — no se ve, y es el que todavia no esta arreglado. Por eso este
   * bloque se deja explicito y no se "normaliza": si alguien migra esta
   * funcion al guard, tiene que hacerlo leiendolo, no por routine.
   * Migracion = Tramo 2 de la Idea 57 (va al Reviewer).
   *
   * @param {string} token - API Key con permiso tradingpost
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de entradas pendientes de recoger
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *   La capa de FORMA degrada a `[]`. Ver la nota de arriba.
   */
  function getCommerceDelivery(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'commerce_delivery';
    var ttl = 60 * 1000; // 1 minuto

    var cached = getCache(key, ttl, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/commerce/delivery', token);
    var ikey = 'if:commerce_delivery:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // FORMA: degrada. El JSDoc de esta funcion es el mas explicito del
        // archivo: "Por eso aca el error se PROPAGA", con un parrafo entero
        // sobre por que `[]` mentiria en un panel cuyo unico proposito es
        // avisar. El `catch` de RED cumple esa promesa; el camino de FORMA
        // no. Es la brecha mas grande entre lo documentado y lo hecho que
        // queda en la capa API. El call site (converter-modal.js:763) ya
        // tiene try/catch con `deliveryStatus = 'error'`.
        // Migracion = Tramo 2 de la Idea 57.
        var delivery = Array.isArray(data) ? data : [];
        putCache(key, delivery, token, ttl);
        return delivery;
      }).catch(function (error) {
        // Se registra y se propaga. Ver la nota de contrato en el JSDoc:
        // degradar a [] acá sería indistinguible de "caja vacía".
        console.warn(LOGP, 'Error getting commerce delivery:', error);
        throw error;
      });
    });
  }

  /**
   * Obtiene la lista de IDs de items disponibles en la Compañía de Comercio
   *
   * NOTA DE CONTRATO — por qué esta NO propaga el error (Idea 47, 2026-09-30).
   * Es tentador "arreglar" esta función junto a los otros wrappers de commerce,
   * y estaria mal. A diferencia de /v2/commerce/transactions[buys|sells] y
   * /v2/commerce/delivery, este endpoint devuelve un catálogo GLOBAL del
   * mercado, no algo de la cuenta: `[]` es un estado NORMAL y frecuente (no
   * hay items publicados, o la API responde vacio), no un "no pude leer".
   *
   * Si pasara a rechazar, todos los call sites que hoy hacen
   * `.catch(function(){ return []; })` lo verian como fallo y el convertidor
   * pararia de mostrar precios en un momento en que la API funciona bien.
   *
   * Si alguna vez hay que distinguir, el camino es un estado mas en el call
   * site (como `deliveryStatus` / `buysStatus` en converter-modal.js), NO
   * propagar desde acá. Mismo criterio y mismo precedente que
   * getCommerceDelivery() en api-gw2.js:442-451.
   *
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de IDs (vacio si el mercado no ofrece nada)
   */
  function getCommerceListings(opts) {
    opts = opts || {};
    var key = 'commerce_listings';
    var cached = getCache(key, TTL.COMM_LISTINGS, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = CFG.API_BASE + '/v2/commerce/listings';
    var ikey = 'if:commerce_listings';

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // FORMA: degrada. ESTA SI es una decision, y esta justificada en el
        // JSDoc de arriba (Idea 47): este endpoint devuelve el catalogo GLOBAL
        // del mercado, no algo de la cuenta, asi que `[]` es un estado NORMAL
        // y frecuente. Propagar apagaria el convertidor en un momento en que
        // la API funciona bien, porque los call sites hacen
        // `.catch(function(){ return []; })`. Si alguna vez hay que distinguir,
        // el camino es un estado mas en el call site, NO propagar desde aca.
        var ids = Array.isArray(data) ? data : [];
        putCache(key, ids, null, TTL.COMM_LISTINGS);
        return ids;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting commerce listings:', error);
        return [];
      });
    });
  }

  /**
   * Obtiene precios de compra/venta para items específicos
   * @param {Array} ids - Array de IDs de items
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de { id, buys: { quantity, unit_price }, sells: { quantity, unit_price } }
   */
  function getCommercePrices(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function (x) { return x != null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    var out = [];
    var chunk = 200;
    var chain = Promise.resolve();

    for (var i = 0; i < ids.length; i += chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var key = 'commerce_prices:' + slice.join(',');
          var cached = getCache(key, TTL.COMM_PRICES, null, opts.nocache);
          if (cached) { out = out.concat(cached || []); return; }

          var url = CFG.API_BASE + '/v2/commerce/prices?ids=' + slice.join(',');
          var ikey = 'if:' + key;

          return inflightOnce(ikey, function () {
            // Idea 49 (206 parcial): ver getItemsMany. `out` se arma con
            // concat, asi que un id faltante no corren a nadie: el dato
            // incorrecto no puede aparecer, solo el ausente.
            return fetchBatchWithRepair(url, slice, opts).then(function (data) {
              // FORMA: degrada. A diferencia de las sisters de commerce, el
              // `catch` NO propaga (solo avisa y sigue): por diseno, porque
              // `out` se arma por `concat` y un lote caido no puede correr a
              // los demas. El costo es que un fallo de forma de UN lote se ve
              // como un item sin precio, sin distinguirlo de "no hay precio".
              // v2.29.0: el "nueve" de la version anterior nunca fue un conteo
              // de sitios sino de MENCIONES: la marca vivia en comentarios
              // inline y en JSDoc, y varios JSDoc eran el mismo sitio que ya
              // contaba su inline. Los sitios reales de hoy los cuenta
              // `tests/idea57t5-cuenta-medida.test.js`.
              //
              // NOTA DE ORDEN, porque romperlo rompe el test: la linea de
              // abajo, la que dice "Migracion = Tramo 2", tiene que quedar
              // pegada a este `Array.isArray` (la ventana del detector son 6
              // lineas). Una nota de por vida entre las dos hace que el sitio
              // deje de contarse y el conteo baje solo.
              // Migracion = Tramo 2 de la Idea 57, y es la unica de las cuatro
              // cuya decision requiere tocar el `catch` tambien, no solo la
              // guarda: por eso necesita el veredicto del Reviewer.
              var prices = Array.isArray(data) ? data : [];
              putCache(key, prices, null, TTL.COMM_PRICES);
              out = out.concat(prices);
            }).catch(function (error) {
              console.warn(LOGP, 'Error getting commerce prices:', error);
            });
          });
        });
      })(ids.slice(i, i + chunk));
    }
    return chain.then(function () { return out; });
  }

  // ========================================================================
  // INVENTORY: Bank, Materials, Legendary Armory (NUEVO v2.13.0)
  // ========================================================================

  /**
   * Obtiene el contenido del banco de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de items en el banco (null = slot vacío)
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *
   * CONTRATO REAL (Idea 57 Tramo 2, HB#113) — CUMPLE DESDE ACA. Este `@throws`
   * mentia hasta aca: el codigo de abajo degradaba a `[]` en el camino de FORMA,
   * sin aviso, y `[]` era indistinguible entre "banco vacio" y "no supe leer tu
   * banco". Ahora hay un guard de FORMA explicito. Los call sites
   * (inventory-hub.js:216, inventory-dashboard.js:331) usan allSettled y arman
   * `state.readErrors`, asi que la superficie de error se enciende de verdad.
   * Un [] VACIO legitimo sigue resolviendo como [], a proposito.
   */
  function getAccountBank(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_bank';
    var cached = getCache(key, TTL.BANK, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/bank', token);
    var ikey = 'if:account_bank:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA (Idea 57 Tramo 2, HB#113). El guard de red de abajo ya
        // propagaba, pero una respuesta con una forma que no soportamos degradaba
        // a [] en silencio. En Inventario eso es 0 slots con la MISMA tipografia
        // que una cuenta vacia: indistinguible de "no tenes nada". Los 2 call
        // sites (inventory-hub.js:216, inventory-dashboard.js:331) ya usan
        // allSettled y arman `state.readErrors` / `unread`, verificado uno por uno
        // antes de tocar esta linea.
        //
        // OJO: un [] VACIO sigue siendo una respuesta valida y NO entra por aca.
        // "Banco vacio" y "no supe leer tu banco" tienen que quedar como dos
        // estados distintos; este guard existe para eso.
        if (!Array.isArray(data)) {
          throw new Error(
            'account/bank: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de items del banco.'
          );
        }
        putCache(key, data, token, TTL.BANK);
        return data;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account bank:', error);
        throw error;
      });
    });
  }

  /**
   * Obtiene el almacenamiento de materiales de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de { id: number, category: number, binding: string, count: number }
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *
   * CONTRATO REAL (Idea 57 Tramo 2, HB#113) — CUMPLE DESDE ACA. Mismo caso que
   * getAccountBank, una funcion mas arriba: RED propaga, y ahora FORMA tambien
   * (habia un guard que degradaba a `[]` en silencio). Call site con allSettled
   * y `readErrors` ya armados. Un [] VACIO legitimo sigue resolviendo como [].
   */
  function getAccountMaterials(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_materials';
    var cached = getCache(key, TTL.MATERIALS, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/materials', token);
    var ikey = 'if:account_materials:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA (Idea 57 Tramo 2, HB#113). Mismo caso que el banco, una
        // funcion mas arriba: la red propaga, la forma degradaba a `[]`.
        // `[]` aqui es indistinguible entre "materiales vacios" y "no supe leer
        // tus materiales". Call site con allSettled y `readErrors` ya armados
        // (inventory-hub.js:217, inventory-dashboard.js:332).
        //
        // OJO: un [] VACIO sigue siendo una respuesta valida y NO entra por aca.
        if (!Array.isArray(data)) {
          throw new Error(
            'account/materials: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de materiales.'
          );
        }
        putCache(key, data, token, TTL.MATERIALS);
        return data;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account materials:', error);
        throw error;
      });
    });
  }

  /**
   * Obtiene la armería legendaria de la cuenta
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array>} - Array de items en la armería legendaria
   * @throws {Error} si la API no se pudo LEER (capa de RED; propaga)
   *
   * CONTRATO REAL (Idea 57 Tramo 2, HB#113) — CUMPLE DESDE ACA. Mismo caso que
   * getAccountBank y getAccountMaterials: RED propaga, y ahora FORMA tambien
   * (habia un guard que degradaba a `[]` en silencio). Call site con allSettled
   * y `readErrors` ya armados (inventory-hub.js:218). Un [] VACIO legitimo
   * sigue resolviendo como [].
   */
  function getAccountLegendaryArmory(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    
    var key = 'account_armory';
    var cached = getCache(key, TTL.ARMORY, token, opts.nocache);
    if (cached) return Promise.resolve(cached);
    
    var url = withToken(CFG.API_BASE + '/v2/account/legendaryarmory', token);
    var ikey = 'if:account_armory:' + fpToken(token);
    
    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA (Idea 57 Tramo 2, HB#113). Mismo caso que el banco y los
        // materiales: la red propaga, la forma degradaba a `[]`. Un `[]` en la
        // armeria legendaria es "no tenes legendarias" y "no supe leerlas" al
        // mismo tiempo. Call site con allSettled y `readErrors` ya armados
        // (inventory-hub.js:218).
        //
        // OJO: un [] VACIO sigue siendo una respuesta valida y NO entra por aca.
        if (!Array.isArray(data)) {
          throw new Error(
            'account/legendaryarmory: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de items de la armeria legendaria.'
          );
        }
        putCache(key, data, token, TTL.ARMORY);
        return data;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting legendary armory:', error);
        throw error;
      });
    });
  }

  // ========================================================================
  // Coleccion / Coberturable — /v2/account/skins  (Idea del PO 18:00 UTC, HB#150)
  // ========================================================================

  /**
   * Devuelve los ids de skin desbloqueados de la cuenta: `/v2/account/skins`.
   * @param {string} token - API Key
   * @param {Object} opts - Opciones (nocache, etc.)
   * @returns {Promise<Array<number>>} Array de ids de skin. `[]` es un valor
   *   REAL y legitimo: una cuenta sin skins desbloqueadas.
   * @throws {Error} Capa de RED: 401, 429 o corte de red. Capa de FORMA: si la
   *   respuesta no es un array de numeros.
   *
   * CONTRATO REAL — PROPAGA, no degrada. Mismo contrato que getAccountBank /
   * getAccountMaterials / getAccountLegendaryArmory (Idea 57 Tramo 2): un `[]`
   * aqui es indistinguible entre "no tenes skins" y "no supe leer tus skins", y
   * en una vista de coleccion esa confusion no se autocorrige nunca, porque el
   * numero chico se lee como un dato y no como un fallo.
   *
   * POR QUE ESTE GUARD NO ES EL DE LOS OTROS TRES (esta es la parte que no se
   * puede copiar): `/v2/account/skins` NO devuelve un array de objetos sino un
   * array de ESCALARES. Medido, no supuesto:
   *   - `GET /v2/account/skins` con token falso -> **401** (existe); control
   *     `/v2/account/bogusendpoint123` -> **404** (no existe). La API no deja
   *     ver la forma sin un token real, asi que la forma se confirmo contra la
   *     documentacion publica de una implementacion de referencia
   *     (GW2Treasures/gw2api, `account()->skins()`): `get():array` con ejemplo
   *     literal `[ 1, 2, 3, 4, … ]`.
   * Un `Array.isArray(data)` a secas, el guard de los otros tres, ACIERTA con
   * un array de objetos: pasaria sin quejarse y recien mas abajo, cuando el
   * call site haga `skins.indexOf(123)`, fallaria. El guard tiene que mirar la
   * FORMA DE LOS ELEMENTOS, que es lo que distingue a este endpoint.
   *
   * TTL: 6 h. Una skin se desbloquea con una compra o un logro, no por abrir la
   * aplicacion: 2 min (el TTL de wallet) seria cachear para no ganar nada.
   */
  function getAccountSkins(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));

    var key = 'account_skins';
    var cached = getCache(key, TTL.SKINS, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/skins', token);
    var ikey = 'if:account_skins:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // Guard de FORMA, en DOS pasos. El primero es el de los otros tres; el
        // segundo es el que hace falta aca y no alla.
        //
        // OJO: un [] VACIO sigue siendo una respuesta valida y NO entra por
        // aca. "Sin skins" y "no supe leer tus skins" tienen que quedar como
        // dos estados distintos.
        if (!Array.isArray(data)) {
          throw new Error(
            'account/skins: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de ids de skin.'
          );
        }
        // Un array de OBJETOS es un array: el guard anterior lo deja pasar. Esta
        // skin no devuelve objetos, asi que si aparece uno, la forma cambio y
        // hay que enterarse aca y no en el `.indexOf` de un call site.
        for (var i = 0; i < data.length; i++) {
          if (typeof data[i] !== 'number' || !isFinite(data[i])) {
            throw new Error(
              'account/skins: elemento ' + i + ' no es un id de skin (' +
              (data[i] === null ? 'null' : typeof data[i]) +
              '). Se esperaba un array de numeros.'
            );
          }
        }
        putCache(key, data, token, TTL.SKINS);
        return data;
      }).catch(function (error) {
        console.warn(LOGP, 'Error getting account skins:', error);
        throw error;
      });
    });
  }

  // ========================================================================
  // Catalogo de skins en lotes: id -> ficha (v2.33.0, Tramo 2 de Coberturable)
  // ========================================================================
  //
  // MEDIDO EN VIVO (HB#154), y no heredado de la v2.32.0, que habia anotado
  // "200 ids todos validos -> 200/200":
  //   ?ids=all            -> 400 "unable to use 'all' keyword for this API"
  //   ?ids=<201 ids>      -> 400 "id list too long; this endpoint is limited
  //                                to 200 ids at once"
  //   ?ids=1..200         -> 206 con 188  (faltan 15,61,127,128,135,136,
  //                                    148,181,182,192,194,200)
  //   ?ids=1,2,3          -> 200 con 3
  //   ?ids=1,2,3,99999997 -> 206 con 3    (3 validos + 1 invalido)
  //   re-preguntar SOLO los que faltaron -> 404 "all ids provided are invalid"
  //
  // LAS DOS QUE DECIDEN EL DISENO:
  //
  // (1) EL 206 DEPENDE DEL CONTENIDO, NO DEL TAMANO. Un lote de 3 ids puede
  //     ser 206, asi que tratar "distinto de 200" como error rompe en el
  //     PRIMER lote real de una cuenta.
  //
  // (2) ESTO VA POR `fetchWithRetry` A SECAS, SIN `fetchBatchWithRepair`, y es
  //     lo contrario de lo que anotaba el carnet del Tramo 1. MEDIDO: `jfetch`
  //     trata el 206 bien (`res.ok` es true y sale el array parcial), asi que los 188 de
  //     cada 200 llegan igual por los tres caminos posibles. Y como los ids
  //     ausentes son ids que el catalogo NO TIENE, re-preguntarlos da 404
  //     SIEMPRE: el helper agregaria un round-trip que falla por lote a cambio
  //     de nada. Se toma el helper de `getItemsMany` solo como molde de LECTURA
  //     (no rellenar por posicion, buscar por `obj.id`), que esa parte si vale.
  var SKINS_BATCH_MAX = 200;

  function getSkinsBatch(ids, opts) {
    opts = opts || {};
    var pedido = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    var asked = pedido
      .filter(function (x) { return x != null && x !== '' && isFinite(Number(x)); })
      .map(Number);
    if (!asked.length) return Promise.resolve([]);

    // TTL: `TTL.ITEMS` y NO `TTL.SKINS`. Esta es metadata de catalogo, que
    // cambia el dia de parche; los 6 h de `TTL.SKINS` son para la lista de la
    // cuenta, que cambia con una compra. Mezclarlos haria re-preguntar el
    // catalogo cuatro veces mas sin ningun motivo.
    var out = [];
    var missing = [];
    asked.forEach(function (id) {
      var c = opts.nocache ? null : __skinsMeta[id];
      if (c && isFresh(c, TTL.ITEMS)) out.push(c.val);
      else missing.push(id);
    });

    var chain = Promise.resolve();
    for (var i = 0; i < missing.length; i += SKINS_BATCH_MAX) {
      (function (slice) {
        chain = chain.then(function () {
          var url = withParams(CFG.API_BASE + '/v2/skins', {
            ids: slice.join(','),
            lang: CFG.LANG
          });
          var ikey = 'if:skins:' + CFG.LANG + ':' + slice.join(',');
          return inflightOnce(ikey, function () {
            return fetchWithRetry(url, opts).then(function (data) {
              // FORMA, y PROPAGA (no degrada). El helper de items baja una forma
              // no soportada a `[]` con un `console.warn`, y para esta pantalla
              // eso seria justo el fallo que la fila quiere evitar: una
              // coleccion vacia que se lee como "no tenes skins". Aca el error
              // sale con el tipo real y lo recoge el `catch` del lote.
              if (!Array.isArray(data)) {
                throw new Error('skins: forma no soportada (devolvio ' +
                  (data === null ? 'null' : typeof data) + ' donde se esperaba un array)');
              }

              // Y el guard del ELEMENTO: este endpoint devuelve OBJETOS con
              // `id`, al reves que `/v2/account/skins`, que devuelve escalares.
              // Se busca por `obj.id` y NUNCA por posicion (el motivo esta
              // escrito en `missingFromBatch`): el 206 puede venir fuera de
              // orden, y rellenar por posicion mete el nombre de una skin en la
              // de otra, que es el peor fallo posible en una coleccion.
              data.forEach(function (sk, idx) {
                if (!sk || typeof sk !== 'object' || typeof sk.id !== 'number' || !isFinite(sk.id)) {
                  throw new Error(
                    'skins: lote con elemento ' + idx + ' sin id numerico (' +
                    (sk === null ? 'null' : typeof sk) + ')'
                  );
                }
                __skinsMeta[sk.id] = { ts: now(), val: sk };
              });

              // Un lote pedido que vuelve VACIO no es lo mismo que un lote que
              // no existe. Con el guard de forma ya propagado, el `[]` que
              // llega aca solo puede ser el segundo caso, pero se avisa igual:
              // la cuenta tiene que poder decir "estas N no las conozco" en vez
              // de pintar una coleccion incompleta sin decirlo.
              if (data.length === 0 && slice.length) {
                console.warn(LOGP, 'skins: lote de', slice.length, 'ids sin ninguna ficha (' +
                  slice.slice(0, 5).join(',') + (slice.length > 5 ? ',...' : '') + ')');
              }
            }).catch(function (e) {
              // Un lote caido NO se lleva al resto: la cadena sigue y los
              // lotes siguientes resuelven. Los ids de este quedan sin
              // resolver y el aviso queda a la vista. Mismo criterio que
              // `getItemsMany`, que tambien avisa y sigue. Lo que NO se hace
              // aca es inventar un nombre: una skin sin ficha no se rellena
              // con un placeholder silencioso, porque en una coleccion eso se
              // lee como un dato. Que el call site muestre el hueco es
              // decision del Tramo 3, que todavia no existe.
              console.warn(LOGP, 'skins batch error', e);
            });
          });
        });
      })(missing.slice(i, i + SKINS_BATCH_MAX));
    }

    return chain.then(function () {
      // Se resuelve DESDE `__skinsMeta` y no desde `out`: el store es
      // compartido entre lotes y entre llamadas concurrentes de la misma
      // id-set (los producers se comparten por `inflightOnce`). Armar el
      // resultado con el `out` local perderia lo que otro lote escribio.
      var seen = Object.create(null);
      var res = [];
      asked.forEach(function (id) {
        if (seen[id]) return;
        seen[id] = 1;
        var c = __skinsMeta[id];
        if (c && isFresh(c, TTL.ITEMS)) res.push(c.val);
      });
      return res;
    });
  }

  // ========================================================================
  // Wallet / Currencies (fallback para Astral Acclaim)
  // ========================================================================
  function getAccountWallet(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'wallet';
    var cached = getCache(key, TTL.WALLET, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/wallet', token);
    var ikey = 'if:wallet:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.WALLET);
        return data;
      });
    });
  }

  // ------------------------------------------------------------------------
  // Suerte (Luck) account-wide — /v2/account/luck
  // NO es una moneda de /v2/currencies: no aparece en ese endpoint.
  /**
   * Devuelve el luck total consumido (el "cuánto tengo" crudo). El umbral de
   * MF% se calcula aparte con window.LuckCurve.
   *
   * CONTRATO REAL (v2.27.0, Tramo 2 de la Idea 57) — PROPAGA, no degrada:
   * @throws {Error} Capa de FORMA: si la API no devuelve un array (200 con
   *   cuerpo vacío, que `jfetch` convierte en `null`). Antes esto degradaba a
   *   0 y la columna "Suerte (MF)" pintaba "0%": un dato que se cree en buena
   *   fe y es falso. La capa de RED (error de red / 401 / 429) ya propagaba
   *   desde antes.
   * @returns {Promise<number>} El luck total. 0 es un valor REAL y legitimo:
   *   la API devuelve `[]` cuando la cuenta nunca consumió esencia, y ese 0 NO
   *   es un fallo, así que se resuelve con 0. "0 real" y "no se pudo leer" los
   *   distingue la UI, que ya tenía las dos puertas cableadas
   *   (`unreadableCell` y el guard `typeof s.luck !== 'number'`).
   */
    function getAccountLuck(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'luck';
    var cached = getCache(key, TTL.LUCK, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/luck', token);
    var ikey = 'if:luck:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        // FORMA (v2.27.0, Tramo 2 de la Idea 57): aca YA NO degrada. Distingue
        // los tres casos que antes colapsaban todos a 0:
        //   - la API no devolvio la FORA que el endpoint promete (jfetch devuelve
        //     null ante un 200 con body vacio): es "no se pudo leer", y propaga.
        //     Antes salia 0% de suerte sin error, sin warn y sin rastro.
        //   - la API devolvio []: la cuenta nunca consumio esencia. 0 es el valor
        //     VERDADERAMENTE CORRECTO y se resuelve con 0. No es un fallo.
        //   - la API devolvio el array con la entrada 'luck': valor real.
        //
        // POR QUE PROPAGA Y NO MARCA: la UI ya sabe distinguir, y hace tiempo.
        // wallet-dashboard.js:79 `unreadableCell()` pinta "— ⚠" y la columna se
        // elige por `fieldErr ? unreadableCell(fieldErr) : renderLuckCell(s)`
        // (wallet-dashboard.js:1024). El catch de la columna (wallet-dashboard.js:
        // 497-509) convierte un rechazo en `_errors.luck`. Y `renderLuckCell`
        // (wallet-dashboard.js:308-309) ya tiene su propia puerta para el valor no
        // numerico.
        //
        // O sea: el criterio de UI que pidio no mandar esto al Reviewer sin
        // resolver ("la UI tiene que poder distinguir sin-dato de 0") YA ESTA
        // CUMPLIDO, en las dos capas, antes de este commit. El indistinguible no
        // era la representacion: era que FORMA y RED llegaban por caminos
        // distintos y solo uno de los dos cargaba la bandera.
        //
        // Y propagar NO borra la fila: `fieldErr` se evalua POR COLUMNA, asi que
        // un rechazo cambia esa celda a "— ⚠" y las otras 26 cuentas de Pablo
        // siguen renderizando igual. Era el riesgo que se pedio verificar antes de
        // escribir esto, y no se cumple.
        // El TEXTO del throw es parte del contrato, no texto decorativo.
        // raid-tracker.js:1749 y strike-tracker.js:1121 hacen
        // `/forma no soportada/.test(error.message)` para decidir si la pista de
        // permiso tiene sentido. Un wrapper que degrade con otro idioma hace que
        // esa pista aparezca donde no corresponde. Los otros dos guards de FORMA
        // (getCharacterCount :698, getAccountRaids :754) ya usan este idioma.
        if (!Array.isArray(data)) {
          throw new Error('account/luck: forma no soportada (' +
            (data === null ? 'null' : typeof data) +
            '). Se esperaba un array de luck.');
        }
        // La API devuelve [] si la cuenta nunca consumió esencia: eso es 0 real.
        var entry = data.find(function (x) { return x && x.id === 'luck'; });
        var value = entry ? Number(entry.value) : 0;
        if (!isFinite(value) || value < 0) value = 0;
        putCache(key, value, token, TTL.LUCK);
        return value;
      });
    });
  }

  function getCurrenciesAll(opts) {
    opts = opts || {};
    var key = 'currencies_all:' + CFG.LANG;
    var cached = getCache(key, TTL.CURR, null, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withParams(CFG.API_BASE + '/v2/currencies', { ids: 'all', lang: CFG.LANG });
    var ikey = 'if:currencies_all:' + CFG.LANG;

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, null, TTL.CURR);
        return data;
      });
    });
  }

  function getAstralAcclaimBalance(token, opts) {
    opts = opts || {};
    return Promise.all([
      getAccountWallet(token, { nocache: !!opts.nocache }),
      getCurrenciesAll({ nocache: !!opts.nocache })
    ]).then(function (arr) {
      var wallet = arr[0] || [];
      var currs  = arr[1] || [];
      var aaMeta = currs.find(function (c) {
        var n = String(c && c.name || '').toLowerCase();
        return n.includes('astral') || n.includes('reconocimiento');
      });
      if (!aaMeta) return { value: 0, meta: { icon: null, id: null } };
      var w = wallet.find(function (x) { return x.id === aaMeta.id; });
      var value = Number(w && w.value || 0);
      return { value: value, meta: { icon: aaMeta.icon || null, id: aaMeta.id } };
    });
  }

  // ========================================================================
  // Achievements (cuenta + metadatos)
  // ========================================================================
  function getAccountAchievements(token, opts) {
    opts = opts || {};
    if (!token) return Promise.reject(new Error('Falta access_token'));
    var key = 'ach_acc';
    var cached = getCache(key, TTL.ACH_ACC, token, opts.nocache);
    if (cached) return Promise.resolve(cached);

    var url = withToken(CFG.API_BASE + '/v2/account/achievements', token);
    var ikey = 'if:ach_acc:' + fpToken(token);

    return inflightOnce(ikey, function () {
      return fetchWithRetry(url, opts).then(function (data) {
        putCache(key, data, token, TTL.ACH_ACC);
        return data;
      });
    });
  }

  // Idea 49 Tramo C: sharding de la metadata de logros.
  //
  // Antes la key era 'ach_meta_v2:<lang>:<ids>', con el id-set ENTERO dentro
  // del nombre. Eso hace que la cache NO se dedupe: cada cuenta tiene un
  // subconjunto distinto de logros, asi que cada una genera su propia key, y
  // como la metadata no depende del token (se cachea con null), 27 cuentas
  // guardan 27 veces la misma tabla, parcialmente solapada.
  //
  // Medido contra la API en vivo con ids reales (27 cuentas x ~1500 logros,
  // cuota de navegador 4.98 MB): 20.22 MB en 216 claves. NO ENTRA NI DE LEJOS.
  // Con sharding por id//200: 1.71 MB en 18 claves (-91.5%).
  //
  // El shard de un id es su posicion global, independiente de que cuenta lo
  // pidio: dos cuentas que comparten un id comparten el shard. Ese es el
  // criterio - una key que incluye el conjunto de lo que se busca deduplica
  // sola; una que incluye solo el valor, no.
  //
  // Y no se pide el shard entero: se pide SOLO lo que falta de el. Un shard ya
  // guardado no se vuelve a pedir nunca, y las cuentas siguientes solo aportan
  // los ids que todavia no estan. Asi el ahorro de red es real y no un
  // intercambio de cuota por peticiones.
  var ACH_META_SHARD = 200;
  var __achMetaPurged = false;

  // Campos que la API manda y la aplicacion NO lee. Se podan ANTES de
  // guardar, no al leer: dropearlos en el consumidor no ahorra un byte en
  // disco, que es justo lo que se esta intentando liberar.
  //
  // Verificado con grep sobre TODO js/: cero apariciones de .bits,
  // .requirement, .locked_text, .prerequisites y .point_cap. El unico
  // consumidor es achievements.js:1067 -> metaById, y de cada registro solo
  // usa id, name, icon, description, flags, tiers, rewards y type.
  // 'type' NO se poda: achievements.js:527 lo lee.
  //
  // Medido contra la API en vivo (3458 logros reales, lang=es, 27 cuentas x
  // ~1500 logros solapados, cuota 4.98 MB): la metadata cacheada baja de
  // 1.75 MB (35.2% de la cuota) a 0.81 MB (16.4%). Los 3458 logros tienen al
  // menos uno de estos campos.
  var ACH_META_DROP = ['bits', 'requirement', 'locked_text', 'prerequisites', 'point_cap'];

  function projectAchMeta(rec) {
    if (!rec || rec.id == null) return rec;
    var out = {};
    var keys = Object.keys(rec);
    for (var i = 0; i < keys.length; i++) {
      if (ACH_META_DROP.indexOf(keys[i]) === -1) out[keys[i]] = rec[keys[i]];
    }
    return out;
  }

  // Las keys viejas ('ach_meta_v2:<lang>:<id,id,...>') siguen ocupando cuota
  // hasta que se borran, y sin liberarlas el sharding NO ABRE NADA: la cuota
  // ya esta llena, asi que las keys nuevas no entran. Por eso la migracion va
  // aca y no es opcional. Solo toca el prefijo 'ach_meta_v2:' - 'ach_acc:' es
  // de otra cosa (TTL 2 min) y no se toca.
  function purgeLegacyAchMeta() {
    if (__achMetaPurged) return;
    __achMetaPurged = true;
    var prefix = 'ach_meta_v2:';
    try {
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (typeof k === 'string' && k.indexOf(prefix) === 0) doomed.push(k);
      }
      doomed.forEach(function (k) { lsDel(k); __mem.delete(k); });
    } catch (_) { /* sin localStorage no hay nada que purgar */ }
  }

  function getAchievementsMeta(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    if (!ids.length) return Promise.resolve([]);

    purgeLegacyAchMeta();

    // Agrupar por shard. El shard depende del id, no de quien lo pide.
    var byShard = new Map();
    ids.forEach(function (id) {
      var s = Math.floor(Number(id) / ACH_META_SHARD);
      var arr = byShard.get(s);
      if (!arr) { arr = []; byShard.set(s, arr); }
      arr.push(id);
    });

    var chain = Promise.resolve();

    byShard.forEach(function (shardIds, shard) {
      chain = chain.then(function () {
        var key = 'ach_meta_v3:' + CFG.LANG + ':' + shard;

        // El bag se lee SIEMPRE, incluso con nocache, y siempre se mergea
        // sobre lo que habia. Un shard es compartido por todas las cuentas
        // (el shard depende del id, no de quien lo pide): pisarlo con el
        // subconjunto de una sola cuenta dejaria al resto sin metadata, y el
        // siguiente lector tendria que volver a pedirla. nocache significa
        // "refresca lo que te pido", NO "olvida lo que ya sabes".
        var cached = getCache(key, TTL.ACH_META, null, false);
        var bag = (cached && typeof cached === 'object' && !Array.isArray(cached)) ? cached : {};

        // Solo lo que NO esta guardado todavia. Con nocache se vuelve a pedir
        // lo pedido, pero igual encima del bag existente.
        var missing = opts.nocache
          ? shardIds.slice()
          : shardIds.filter(function (id) { return bag[id] == null; });
        if (!missing.length) return;

        var url = withParams(CFG.API_BASE + '/v2/achievements?v=latest',
                             { ids: missing.join(','), lang: CFG.LANG });
        var ikey = 'if:' + key + ':' + missing.join(',');

        return inflightOnce(ikey, function () {
          // Idea 49 (206 parcial): se reintenta SOLO lo que falto. Sin esto
          // un 206 cacheaba el shard incompleto con putCache y los ids
          // ausentes quedaban fuera del bag hasta que venciera TTL.ACH_META:
          // achievements.js:1069 armaba metaById incompleto, con logros sin
          // nombre, sin icono, sin tiers y earnedAP = 0 en silencio.
          return fetchBatchWithRepair(url, missing, opts).then(function (data) {
            (data || []).forEach(function (rec) {
              if (rec && rec.id != null) bag[rec.id] = projectAchMeta(rec);
            });
            putCache(key, bag, null, TTL.ACH_META);
          });
        });
      });
    });

    // Se resuelve en el orden en que pidieron los ids, no en el orden en que
    // llegaron los shards, y deduplicado por id.
    //
    // El bag se RELEE del cache y no se usa el objeto local. Dos cargas
    // concurrentes del mismo shard en frio comparten el inflightOnce, asi que
    // solo la primera muta su bag local; la segunda resolveria contra un {}
    // y devolveria [] —y achievements.js:1069 armaria metaById incompleto,
    // con earnedAP en 0 y sin ningun error visible. Releer garantiza que quien
    // llego segundo vea lo que escribio quien llego primero.
    return chain.then(function () {
      var out = [], seen = Object.create(null);
      ids.forEach(function (id) {
        var shard = Math.floor(Number(id) / ACH_META_SHARD);
        var key = 'ach_meta_v3:' + CFG.LANG + ':' + shard;
        var bag = getCache(key, TTL.ACH_META, null, false);
        if (!bag || typeof bag !== 'object') return;
        var rec = bag[id];
        if (rec && !seen[rec.id]) { seen[rec.id] = 1; out.push(rec); }
      });
      return out;
    });
  }

  // ========================================================================
  // Items batch (con caché por id persistente)
  // ========================================================================
  function getItemsMany(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? Array.from(new Set(ids)).filter(function (x) { return x != null; }) : [];
    if (!ids.length) return Promise.resolve([]);

    // El presupuesto del cache de items es parametrizable, y por DEFECTO
    // reproduce byte a byte lo que hacia antes de existir esta linea: la clave
    // `items_cache_v1:<lang>` con el 500/400 del recorte de mas abajo. Los 9
    // call sites que ya usaban `getItemsMany` no pasan ninguna de estas tres
    // opciones, asi que no tienen ni forma de cambiarse por accidente.
    //
    // OJO con el `':' + CFG.LANG`: no es decorativo y va SIEMPRE, con o sin
    // `cacheKey`. La clave completa lo arma el sufijo de idioma, y las dos
    // familias (`v1` y `armory`) lo llevan igual. Sacarlo fusionaria el es de
    // las dos y las volveria el mismo cache.
    var lkey = (opts.cacheKey || 'items_cache_v1') + ':' + CFG.LANG;

    // LAS TRES SON UN BLOQUE, y ESTA es la parte que las hace un bloque:
    // `trim` y `cap` SOLO se mueven si vino `cacheKey`. Sin `cacheKey` se
    // ignoran, aunque vengan solos.
    //
    // Por que tiene que ser asi. Si `cacheTrim`/`cacheCap` tocaran el
    // presupuesto compartido, bastaria con que un call site futuro escribiera
    // `getItemsMany(906, {cacheTrim:1000, cacheCap:906})` sin `cacheKey` para
    // EXPULSAR a los 9 que hoy comparten `items_cache_v1`. Y no habria forma
    // de que nadie lo notara: los 906 volverian con icono igual, asi que el
    // conteo de iconos seguiria en verde mientras el cache compartido cambia
    // de presupuesto por debajo. El presupuesto propio SOLO existe si cambia
    // la clave; la clave es lo unico que separa las dos familias.
    //
    // El `||` de los defaults va a proposito hacia el lado seguro: un
    // `cacheTrim:0` o un `cacheCap:0` caen en 500/400 en vez de abrir el
    // presupuesto. Cero no es un umbral con sentido para ninguno de los dos.
    var trim = opts.cacheKey ? (opts.cacheTrim || 500) : 500;
    var cap  = opts.cacheKey ? (opts.cacheCap  || 400) : 400;
    var bag = lsGet(lkey) || { ts: 0, data: {} };
    var per = bag.data || {};

    var out = [];
    var missing = [];
    ids.forEach(function (id) {
      var k = String(id);
      var c = per[k];
      if (!opts.nocache && c && isFresh(c, TTL.ITEMS)) {
        out.push(c.val);
      } else {
        missing.push(id);
      }
    });

    var chain = Promise.resolve();
    var chunk = 200;
    for (var i=0; i<missing.length; i+=chunk) {
      (function (slice) {
        chain = chain.then(function () {
          var url = withParams(CFG.API_BASE + '/v2/items', { ids: slice.join(','), lang: CFG.LANG });
          var ikey = 'if:items:' + CFG.LANG + ':' + slice.join(',');
          return inflightOnce(ikey, function () {
            // Idea 49 (206 parcial): el 206 es un 2xx, asi que `!res.ok` NO lo
            // ve. Sin reintentar lo que falto, un id invalido intercalado en
            // el lote dejaba ese item sin icono en el render, y como no se
            // cachea, el siguiente render lo volvia a pedir y recien ahi
            // aparecia. El consumidor busca por `it.id`, asi que no hay
            // corrimiento de posiciones: el dano es de dato faltante.
            return fetchBatchWithRepair(url, slice, opts).then(function (arr) {
              (arr || []).forEach(function (it) {
                out.push(it);
                per[String(it.id)] = { ts: now(), val: it };
              });
            }).catch(function (e) {
              console.warn(LOGP, 'items batch error', e);
            });
          });
        });
      })(missing.slice(i, i+chunk));
    }

    return chain.then(function () {
      // La resolucion final se arma desde la cache, NO desde `out` ni desde
      // `per`. Los dos son locales de esta llamada, y el producer de cada
      // lote se COMPARTE por inflightOnce entre llamadas concurrentes del
      // mismo id-set: solo la primera muta sus arrays, y la segunda resuelve
      // contra los suyos, que quedaron vacios -> [] sin ningun error visible.
      // Es el mismo defecto que se corrigio en getAchievementsMeta (el
      // BUG 1 de idea49.shard-concurrency.test.js), que nunca llego aqui.
      // Ademas escribir `per` desde el final pisaba el del otro con un
      // objeto vacio. Releyendo, quien llego segundo ve lo que escribio el
      // primero, y el cap de 500 se aplica sobre el estado combinado.
      var cur = lsGet(lkey);
      var fresh = (cur && cur.data && typeof cur.data === 'object') ? cur.data : {};
      // Se siembra con `per` (los aciertos de cache de la entrada) y se
      // superpone `fresh` (lo que escribieron los producers). `per` solo esta
      // completo si esta llamada gano la carrera del inflight; `fresh` solo
      // tiene lo que se escribio durante ESTA invocacion. La union de los dos
      // es lo que la resolucion necesita.
      var perNow = Object.assign({}, per, fresh);

      var keys = Object.keys(perNow);
      // `trim` y `cap` se arman junto con `lkey`, mas arriba, y llegan aqui ya
      // resueltos: 500/400 salvo que vino `cacheKey`, y en ese caso los que
      // paso el llamador. El recorte se calcula sobre `perNow` (la union de lo
      // leido + lo que trajo esta llamada) y NO mira `lkey`: por eso cambiar
      // solo la clave no alcanzaba, y por eso las tres opciones son un bloque.
      //
      // El `Math.max(0, ...)` existe porque `slice` con final NEGATIVO corta
      // del otro extremo. Si `cap` fuera mayor que las entradas,
      // `keys.length - cap` se vuelve negativo y `slice(0, -n)` no deja `cap`
      // entradas sino `cap - keys.length`. Medido: con `cacheCap:1000` sobre
      // 906 entradas dejaba 94 en vez de 906, comiendose 812. Antes de que el
      // cap fuera un parametro no podia pasar (400 era siempre menor que el
      // umbral), y con el 0 es no-op para toda combinacion posible: cuando el
      // recorte dispara, `keys.length > trim >= cap` y la resta ya es positiva.
      if (keys.length > trim) {
        var sorted = keys.sort(function (a, b) {
          return (perNow[a]?.ts || 0) - (perNow[b]?.ts || 0);
        });
        sorted.slice(0, Math.max(0, keys.length - cap)).forEach(function (k) { delete perNow[k]; });
      }
      lsSet(lkey, { ts: now(), data: perNow });

      // Se resuelve en el orden en que pidieron los ids, deduplicado por id,
      // e incluyendo lo que ya estaba cacheado al entrar.
      var seen = Object.create(null);
      var res = [];
      ids.forEach(function (id) {
        var c = perNow[String(id)];
        if (!c || !opts.nocache && !isFresh(c, TTL.ITEMS)) return;
        var v = c.val;
        if (v && v.id != null && !seen[v.id]) { seen[v.id] = 1; res.push(v); }
      });
      return res;
    });
  }

  // ========================================================================
  // WV — Delegados (retrocompatibilidad)
  // ========================================================================
  function _WV(){
    var WV = (typeof root !== 'undefined' && root.WizardsVault) ? root.WizardsVault : null;
    if (!WV) throw new Error('WizardsVault no cargado. Incluí js/wizards-vault.js después de api-gw2.js.');
    return WV;
  }
  function getWVSeason(opts){                return _WV().getWVSeason(opts); }
  function getWVDaily(token, opts){          return _WV().getWVDaily(token, opts); }
  function getWVWeekly(token, opts){         return _WV().getWVWeekly(token, opts); }
  function getWVSpecial(token, opts){        return _WV().getWVSpecial(token, opts); }
  function getWVAccount(token, opts){        return _WV().getWVAccount(token, opts); }
  function getWVListings(opts){              return _WV().getWVListings(opts); }
  function getAccountWVListings(token, opts){return _WV().getAccountWVListings(token, opts); }
  function wvComputeRemaining(limit, purchased, marked){ return _WV().wvComputeRemaining(limit, purchased, marked); }
  function wvMergeShopListings(acc, glb){    return _WV().wvMergeShopListings(acc, glb); }
  function getWVShopMerged(token, opts){     return _WV().getWVShopMerged(token, opts); }
  function wvInvalidateTargets(token){       return _WV().wvInvalidateTargets(token); }
  function wvPreloadTargets(token, opts){    return _WV().wvPreloadTargets(token, opts); }

  // ========================================================================
  // Utilidades públicas de debug
  // ========================================================================
  function indexArrayByKey(arr, key) {
    var map = new Map();
    (arr || []).forEach(function (o) { if (o && o[key] != null) map.set(o[key], o); });
    return map;
  }
  // Idea 49 Tramo A: expone el fallo de cuota para que sea inspeccionable y no
  // solo una linea de consola. quotaFails > 0 significa que la cache dejo de
  // persistir entre recargas; mientras siga en 0 el problema no existe.
  function cacheStats() {
    return { quotaFails: __lsQuotaFails, quotaWarned: __lsQuotaWarned, expiredDrops: __expiredDrops };
  }
  // Idea 50 Tramo F: las claves que ESTA CAPA escribe en localStorage.
  //
  // No es una lista de prefijos y esa es la decision, no un detalle de estilo.
  // Medidas sobre el archivo (las dos vias de escritura: `putCache()` y el
  // `lsSet(lkey, ...)` directo de `getItemsMany`), son 19 y NO comparten
  // ningun prefijo: `wallet` y `luck` son nombres pelados. Un borrado por
  // familias del tipo `ach_*`/`commerce_*` dejaria vivas justamente `wallet`,
  // que es de las que mas cuota gasta, y la cuota seguiria sin liberarse.
  //
  // Se matchea la clave EXACTA o el exacto prefijo con su `:`included. El `:` va
  // en el prefijo a proposito: sin el, `commerce_prices` se comeria cualquier
  // clave que empiece con esas letras.
  var CACHE_KEYS_EXACT = [
    'tokeninfo', 'account_info', 'char_count', 'account_raids',
    'commerce_transactions_buys', 'commerce_transactions_sells',
    'commerce_delivery', 'commerce_listings', 'account_bank',
    'account_materials', 'account_armory', 'wallet', 'luck', 'ach_acc',
    // v2.32.0: `account_skins` (Idea del PO 18:00 UTC, Coberturable Tramo 1).
    // Va ACA y no por prefijo a proposito, con el mismo criterio que el resto:
    // `account_skins` no comparte prefijo con `account_...` porque esta lista
    // matchea la clave EXACTA. Sin esta linea el boton de cache NO lo borraria
    // y su cuota quedaria viva, que es exactamente el fallo que la allowlist
    // exacta veio a evitar (y que `idea50f.cacheclear-real.test.js` mide).
    'account_skins'
  ];
  // Idea 50 Tramo F: HAY UN SEGUNDO PRESUPUESTO DE ITEMS, y por eso esta en la
  // lista y no se deduce de ningun lado.
  //
  // `items_cache_v1:` (arriba, en CACHE_KEYS_PREFIX) es el que usan los 9 call
  // sites de `getItemsMany` y no se toco. `items_cache_armory_v1:` es el mismo
  // cliente con otro presupuesto: `cacheKey` distinto + `cacheTrim:1300` /
  // `cacheCap:1200`, desde item-icons.js. Existe porque el cap por defecto (500
  // que dispara, 400 que deja) esta dimensado para una tanda corta de ids.
  // MEDIDO en HB#157: la Armeria pide **1113** ids distintos (907 de precursores
  // + las 206 legendarias del catalogo, que son las raices del arbol y no estan
  // en ese contrato). El presupuesto quedo en 1200/1300 por eso. Con los valores
  // viejos (906/1000) el recorte se comia 207 ids y el arbol se repintaba sin
  // icono al recargar.
  //
  // OJO con lo que significa "misma clave que otro": si un call site futuro pasa
  // `cacheKey` y OLVIDA `cacheTrim`/`cacheCap`, lee los defaults 500/400 bajo
  // una clave nueva. Funciona, pero con el cap viejo y sin avisar. Las tres
  // opciones son un paquete; por eso viven juntas en la misma firma.
  var CACHE_KEYS_PREFIX = [
    'commerce_prices:', 'currencies_all:', 'ach_meta_v3:', 'items_cache_v1:',
    'items_cache_armory_v1:'
  ];
  // Idea 50 P3 (Code-Reviewer): lo que escriben los OTROS modulos.
  //
  // El registro es ESTATICO y se LEE AL PULSAR. Las otras dos formas fallan, y
  // cada una por un motivo distinto:
  //   - registrar en la ESCRITURA (`putCache`) es un hecho de SESION aplicado a
  //     un hecho de DISCO. En una sesion nueva donde Pablo no abrio la pestana
  //     de WV, el registro esta vacio: el boton no toca las claves `wv_*` que
  //     hay en disco desde la semana pasada, y el `dryRun` del `confirm()`
  //     cuenta 0 bytes y promete una liberacion que no ocurre. Eso es el bug
  //     que la 50F Tramo vino a arreglar, reintroducido por la puerta de atras.
  //   - leer el registro al CARGAR el modulo ata el borrado al orden de los
  //     `<script>` de `index.html`.
  // Leyendolo al pulsar, las dos cosas quedan bien sin depender de ninguna.
  //
  // Cada modulo declara sus bases junto a la cache que define y se ANOTA SOLO en
  // `root.__cacheBaseProviders` (una linea, al final de su propio IIFE). Esta
  // capa NO nombra ningun modulo: leer un modulo por su nombre aca seria una
  // lista central de modulos disfrazada de registro, y cada modulo nuevo seria
  // una edicion mas de este archivo. Agregar un modulo = 1 linea en el modulo,
  // 0 en la capa. `wizards-vault.js` es el primero: tiene su propio `lsSet`
  // FUERA de esta capa, que era el punto ciego que el grep no veía.
  //
  // MEDIDO: 18 bases de esta capa (14 exactas + 4 prefijos) + 5 del WV
  // (4 exactas + 1 prefijo) = 23. No son 22: el conteo del Reviewer decia 6
  // declaraciones de WV donde hay 5.
  function collectCacheBases() {
    var bases = { exact: CACHE_KEYS_EXACT.slice(), prefix: CACHE_KEYS_PREFIX.slice() };
    // Se leen en el momento de la llamada, no al cargar: asi el orden de
    // `index.html` es irrelevante. `|| []` porque ningun modulo puede haber
    // hecho push todavia.
    var mods = root.__cacheBaseProviders || [];
    for (var i = 0; i < mods.length; i++) {
      var d = mods[i] && mods[i].__cacheBases;
      if (!d) continue;
      var ex = d.exact || [], pf = d.prefix || [];
      for (var j = 0; j < ex.length; j++) if (bases.exact.indexOf(ex[j]) === -1) bases.exact.push(ex[j]);
      for (var m = 0; m < pf.length; m++) if (bases.prefix.indexOf(pf[m]) === -1) bases.prefix.push(pf[m]);
    }
    return bases;
  }
  // Prefijos que NO son cache y que ningun prefijo de cache puede comerse.
  //
  // `wv:season:` es la PERSISTENCIA oficial de temporada (`wv-season-storage.js`:
  // season_info, pins, marks, prefs), no una cache: borrarla es perder lo que el
  // usuario marco a mano. Va como PREFIXO y no como 2 claves exactas porque el
  // modulo tiene 4 familias, no 2, y 3 de ellas no existian todavia:
  //   - `wv:season:index`   (KEY_INDEX)
  //   - `wv:season:current`  (CURRENT_KEY, single-season)
  //   - `wv:season:YY:SEQ`   (FILE_PREFIX, multi-season, `SINGLE_SEASON_MODE=false`)
  //   - `wv:season:*.__shadow` (SHADOW_SUFFIX, escritura atomica)
  // Hoy el riesgo es cero: ningun prefijo de cache empieza por `wv`. Por eso
  // esto es la RED y no una nota: el dia que alguien declare el prefijo corto
  // `wv`, las 4 familias se comen de una y esto las salva. Una red con agujeros
  // en el modo al que el codigo esta EXPERIMENTADO a migrar no es la red que
  // dice ser.
  var CACHE_PRESERVE_PREFIX = ['wv:season:'];
  function isPreserved(k) {
    for (var i = 0; i < CACHE_PRESERVE_PREFIX.length; i++) {
      if (k.lastIndexOf(CACHE_PRESERVE_PREFIX[i], 0) === 0) return true;
    }
    return false;
  }
  // Las que tienen tokenfname la key con `:<fpToken>` (ver `kLS`), asi que la
  // forma real en localStorage es `wallet:abcd…wxyz`. Por eso el match de las
  // exactas tiene que tolerar el sufijo, pero NO cualquier cosa: tiene que
  // ser la key exacta sola, o la key exacta seguida de `:`.
  // `bases` se COLECTA UNA VEZ y se pasa por parametro, en vez de.collectarlo
  // adentro. Con ~4.98 MB esto son 2 arrays nuevos (`slice()`) + 23 `indexOf`
  // POR CADA clave de localStorage, y es el unico loop que recorre el store
  // entero. No rompe la invariante "se lee al pulsar": el que decide el momento
  // es `cacheClear`, que la colecta una vez al empezar el clic.
  function isCacheKey(k, bases) {
    if (typeof k !== 'string' || !k) return false;
    // Lo preservado se descarta PRIMERO: si un prefijo lo alcanzara, la
    // excepcion gana. Es el orden que hace que `CACHE_PRESERVE_PREFIX` sea una
    // red y no una nota.
    if (isPreserved(k)) return false;
    for (var i = 0; i < bases.prefix.length; i++) {
      if (k.lastIndexOf(bases.prefix[i], 0) === 0) return true;
    }
    for (var j = 0; j < bases.exact.length; j++) {
      var base = bases.exact[j];
      if (k === base || k.lastIndexOf(base + ':', 0) === 0) return true;
    }
    return false;
  }
  // Solo lectura: el registro que `cacheClear` va a usar en el proximo clic.
  // Existe para que el alcance sea MEDIBLE (el Reviewer: "cuanto de los
  // 4.98 MB es de las 22 no lo se y no lo voy a inventar") y para que el test
  // pueda assertar el registro sin reaching dentro del IIFE.
  function cacheBases() { return collectCacheBases(); }
  // Idea 50 Tramo F: antes esto era `try { __mem.clear(); __inflight.clear(); }`,
  // o sea que limpiaba la cache de la SESION y no la de DISCO: la cuota de
  // localStorage (~4.98 MB medidos) seguia llena, y `cacheClear` tiene ademas
  // 0 callers, asi que no habia ni boton. Con la cuota llena, cada escritura
  // posterior falla y la app reinicia en frio en cada recarga.
  //
  // Devuelve `{removed, kept}` a proposito: `kept` es la garantia. Lo que NO
  // se borro son las claves de cuentas (`gn:account:keys` y su legacy
  // `gw2_keys`, la lista de las 27 cuentas), los pines, el tema y las caches
  // de otros modulos (`gw2_currencies_cache_v1` la escribe app.js:46 y no
  // pasa por aqui). Que un "limpiar cache" se coma la lista de cuentas es el
  // modo de fallo mas caro que puede tener este boton, asi que la garantia se
  // mide y no se promete.
  // P4 del Code-Reviewer: la funcion NACIO con `dryRun` y no lo gana despues.
  // Sigue con 0 callers (el boton es el Tramo siguiente), pero cambiar la firma
  // despues del merge es mas caro que nacer con ella: el boton va a necesitar
  // preguntar cuanto se libera ANTES de un confirm(), y `kept` no sirve para
  // eso — `kept` dice que NO se toco, y no dice si vale la pena tocar.
  function cacheClear(opts) {
    var dryRun = !!(opts && opts.dryRun);
    var removed = 0, kept = 0, bytes = 0, keptBytes = 0;
    // En `dryRun` NO se toca ni la cache de sesion: la pregunta es "cuanto
    // borraria", y vaciar `__mem` antes de responder ya seria borrar.
    try { if (!dryRun) { __mem.clear(); __inflight.clear(); } } catch (_) {}
    try {
      // Se recopila primero y se borra despues: `removeItem` durante el
      // recorrido muta `localStorage.length` y `key(i)`, y borrando en vivo
      // se saltean claves.
      var doomed = [];
      var before = localStorage.length;
      // El registro se lee UNA vez al empezar el clic (ver `isCacheKey`), no
      // por clave: leerlo adentro seria 2 arrays nuevos + 23 `indexOf` por cada
      // clave del store.
      var bases = collectCacheBases();
      // Los MISMOS proveedores de bases, para la cache de SESION. Sin esto el
      // boton borraba el disco y cada modulo con `__mem` propia seguia sirviendo
      // desde memoria: los bytes anunciados como liberados volvian a servirse, y
      // el toast decia una verdad y la cuota no se movia. El Reviewer lo anoto
      // como "NO exigido" (fila 073, nota al pie); entra porque sin el hook el
      // NUMERO que ve Pablo no es el numero que se libero.
      //
      // En `dryRun` NO se toca: la pregunta es "cuanto se borraria", y vaciar
      // memoria antes de responder ya seria borrar.
      var memCleared = 0;
      if (!dryRun) {
        var mods = root.__cacheBaseProviders || [];
        for (var mi = 0; mi < mods.length; mi++) {
          var f = mods[mi] && mods[mi].__cacheClearMem;
          if (typeof f !== 'function') continue;
          try { memCleared += (f.call(mods[mi]) || 0); } catch (_) { /* un modulo que falla no impide liberar los demas */ }
        }
      }
      for (var i = 0; i < before; i++) {
        var k = localStorage.key(i);
        if (!isCacheKey(k, bases)) {
          kept++;
          // `keptBytes`: lo que QUEDA en disco, en la misma unidad que `bytes`.
          // Es lo que hace que el boton pueda decir "quedan 3.1 MB" al lado de
          // "se liberan 4.9 MB": los dos numeros son comparables con la cuota,
          // que es lo unico accionable para Pablo. `kept` solo dice que NO se
          // toco, y no si vale la pena tocar.
          //
          // Por que NO hay una tercera categoria ("DESCONOCIDO"): porque un
          // numero al que se le resta una bolsa de "lo que no sabemos" deja de
          // ser accionable, y ademas el dato NO es desconocido — MEDIDO sobre
          // las escrituras a localStorage que no pasan por esta capa: 8 CLAVES
          // en 4 modulos (characters.js `characters:cached:<hash>`, que es la
          // unica que CRECE con el numero de cuentas; activities.js
          // `psna:schedule` y `psna:lastUpdate`; app.js
          // `gw2_currencies_cache_v1` —dos call sites, una clave—; y los
          // catalogos singleton de characters.js). Esas 8 caen en la rama de
          // "conservada" porque ninguna esta en el registro, asi que `kept` ya
          // las incluye: el numero de la pantalla arrastra cache que la frase
          // al lado niega. Los BYTES no tienen ese problema: sobreviven a que
          // manana `characters.js` registre su clave.
          try { keptBytes += (localStorage.getItem(k) || '').length; } catch (_) {}
          continue;
        }
        doomed.push(k);
        try { bytes += (localStorage.getItem(k) || '').length; } catch (_) {}
      }
      if (dryRun) {
        removed = doomed.length;   // nada se borra: esto es lo que se borraria
      } else {
        doomed.forEach(function (k) { lsDel(k); });
        // `removed` cuenta lo BORRADO y no las llamadas a `lsDel`: `lsDel` se
        // traga la excepcion, asi que contar llamadas da un numero que miente.
        removed = before - localStorage.length;
      }
    } catch (_) { /* localStorage puede no existir (modo privado): no es un error */ }
    return { removed: removed, kept: kept, bytes: bytes, keptBytes: keptBytes,
             memCleared: memCleared, dryRun: dryRun };
  }

  // IDEA 50-D (a''): el BARRIDO EN EL BORRADO, no en el arranque.
  //
  // EL DEFECTO que cierra: `KeyManager.remove(value)` saca la Key de la lista
  // y no toca la cache. Las claves de esa cuenta quedan huerfanas PARA SIEMPRE:
  // nunca se leen (el token ya no esta en ninguna parte) y nunca se borran. Con
  // 27 cuentas y ~4.98 MB medidos, la cuota se llena con datos de cuentas que
  // Pablo ya elimino, y a partir de ahi cada `setItem` falla por cuota.
  //
  // POR QUE ESTA ACA Y NO EN UN ARRANQUE: la variante (b) —barrer al arrancar
  // todas las claves cuyo token no este en la lista de cuentas— tiene un modo
  // de fallo que esta no tiene: si la lectura de la lista falla, o corre antes
  // de la migracion `gn:`/legacy, el conjunto de tokens validos sale VACIO y el
  // barrido se come TODA la cache. Aqui no hay ninguna lectura que pueda fallar:
  // el token que se esta borrando esta en la mano, en el call site.
  //
  // POR QUE NO HAY UN CONTADOR DE CUENTAS: un numero guardado mete un prefijo
  // `gn:` nuevo y una desync posible —si alguien edita localStorage a mano, "el
  // numero cambio" dispara un barrido que no corresponde—. El hecho del que se
  // dispone es el TOKEN, y no necesita persistir para ser correcto.
  //
  // COMO SE RECONOCE LA CLAVE DE ESA CUENTA, sin parsear el token:
  //   `fpToken` = `t.slice(0,4) + '…' + t.slice(-4)`  (:535)  ->  9 caracteres
  //   `kLS`     = `base + ':' + fpToken(token)`      (:538)
  // O sea que el sufijo basta, y las claves SIN token (`currencies_all`,
  // `ach_meta_v3:*`, `items_cache_v1`, `commerce_prices`, `commerce_listings`)
  // no tienen esa forma: no se tocan. El filtro `isCacheKey` es el MISMO que usa
  // `cacheClear`, asi que el alcance se respeta: lo que no es cache no se come,
  // ni la lista de cuentas, ni `CACHE_PRESERVE_PREFIX` (`wv:season:*`), ni el
  // tema.
  //
  // RIESGO REAL, ESCRITO A PROPOSITO: dos tokens que coincidan en los primeros
  // 4 y los ultimos 4 caracteres COMPARTEN clave de cache, porque `fpToken` no
  // mira nada mas. Con tokens de ArenaNet (GUID aleatorios) es despreciable; si
  // pasara, borrar una cuenta borra la cache de la otra: se refleta, no se
  // corrompe. NO se rediseña `fpToken` en este tramo — cambiarlo es invalidar
  // TODAS las claves de cache de todos los usuarios.
  //
  // El boton de `cacheClear` (settings-manager.js v1.0.3) queda como RED: si
  // este barrido no corrio (una cuenta borrada antes de esta version), el boton
  // sigue liberando.
  function cacheDropToken(token) {
    var removed = 0, kept = 0;
    if (!token) return { removed: 0, kept: 0 };
    var sufijo = ':' + fpToken(token);
    try {
      // Las bases se colectan UNA vez (mismo criterio y misma excepcion de
      // preservado que `cacheClear`).
      //
      // Se RECOGE primero y se BORRA despues, y no es una copia inutil de
      // `cacheClear`: es su misma trampa. `removeItem` durante el recorrido muta
      // `localStorage.length` y `key(i)`, de modo que la clave siguiente se
      // corre a la posicion que ya se leyo y `i++` la SALTA. Con las 13 bases
      // de una cuenta eso son 7 borradas de 13, en silencio y sin error: el
      // numero que devuelve el codigo es el numero que borro, asi que el fallo
      // no se ve ni en la pantalla ni en la consola. (Medido: asi daba 7.)
      var bases = collectCacheBases();
      var doomed = [];
      var before = localStorage.length;
      for (var i = 0; i < before; i++) {
        var k = localStorage.key(i);
        if (!isCacheKey(k, bases)) { kept++; continue; }
        // El sufijo se compara por COLA, no con `indexOf`: la clave de una
        // cuenta es `<base>:<fpToken>`, y lo que define la pertenencia es que
        // termine ASI. Un `indexOf` en cualquier parte aceptaria una clave que
        // lo tuviera en el medio, que no es la forma que escribe `kLS`.
        if (String(k).slice(-sufijo.length) !== sufijo) { kept++; continue; }
        doomed.push(k);
      }
      for (var d = 0; d < doomed.length; d++) { lsDel(doomed[d]); removed++; }
    } catch (_) { /* localStorage puede no existir (modo privado): no es un error */ }
    return { removed: removed, kept: kept };
  }

  // ========================================================================
  // API pública
  // ========================================================================
  var API = {
    // Token / Permisos
    getTokenInfo: getTokenInfo,
    tokenHasWVPermissions: tokenHasWVPermissions,

    // Account info (con last_modified para detectar actividad)
    getAccountInfo: getAccountInfo,
    isRecentlyActive: isRecentlyActive,
    getCharacterCount: getCharacterCount,

    // Raids
    getAccountRaids: getAccountRaids,

    // Commerce (v2.15.0)
    getCommerceListings: getCommerceListings,
    getCommercePrices: getCommercePrices,
    getCommerceTransactionsBuys: getCommerceTransactionsBuys,
    getCommerceTransactionsSells: getCommerceTransactionsSells,
    getCommerceDelivery: getCommerceDelivery,

    // Inventory (NUEVO v2.13.0)
    getAccountBank: getAccountBank,
    getAccountMaterials: getAccountMaterials,
    getAccountLegendaryArmory: getAccountLegendaryArmory,

    // Coleccion / Coberturable (NUEVO v2.32.0)
    getAccountSkins: getAccountSkins,
    getSkinsBatch: getSkinsBatch,   // v2.33.0 (Tramo 2): id -> ficha

    // Wallet / Currencies (fallback AA)
    getAccountWallet: getAccountWallet,
    getAccountLuck: getAccountLuck,
    getCurrenciesAll: getCurrenciesAll,
    getAstralAcclaimBalance: getAstralAcclaimBalance,

    // Achievements
    getAccountAchievements: getAccountAchievements,
    getAchievementsMeta: getAchievementsMeta,

    // Wizard's Vault (delegados)
    getWVSeason: getWVSeason,
    getWVDaily: getWVDaily,
    getWVWeekly: getWVWeekly,
    getWVSpecial: getWVSpecial,
    getWVAccount: getWVAccount,
    getWVListings: getWVListings,
    getAccountWVListings: getAccountWVListings,

    // Shop helpers (delegados)
    wvComputeRemaining: wvComputeRemaining,
    wvMergeShopListings: wvMergeShopListings,
    getWVShopMerged: getWVShopMerged,

    // Items
    getItemsMany: getItemsMany,

    // WV targets helpers (delegados)
    wvInvalidateTargets: wvInvalidateTargets,
    wvPreloadTargets: wvPreloadTargets,

    // Debug / util
    __cfg: {
      API_BASE: CFG.API_BASE,
      TTL: CFG.TTL,
      LANG: CFG.LANG,
      setLang: function (lang) { if (lang) CFG.LANG = String(lang); },
      setRetries: function (n) { var x = +n; if (isFinite(x) && x >= 0 && x <= 5) CFG.RETRIES = x|0; },
      // Idea 46: estado del pool global. t2 lo usa para distinguir
      // "Cargando" de "limitado por la API (600/min)".
      poolStats: poolStats,
      setPoolMax: function (n) { var x = +n; if (isFinite(x) && x >= 1 && x <= 20) { CFG.POOL_MAX = x|0; poolPump(); } }
    },
    __cacheClear: cacheClear,
    __cacheDropToken: cacheDropToken,
    __cacheStats: cacheStats,
    __cacheBases: cacheBases,
    __indexArrayByKey: indexArrayByKey
  };

  root.GW2Api = API;
  console.info(LOGP, 'listo — métodos:', Object.keys(API).join(', '), 'lang=' + CFG.LANG, 'retries=' + CFG.RETRIES);

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));