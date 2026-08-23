# 📚 Documento Técnico Consolidado — Módulos JS (v6.6.2)

## Archivos ya documentados (NO incluidos en este análisis)
- `index.html` — Estructura DOM principal
- `js/router.js` — Orquestador de navegación
- `js/api-gw2.js` — Capa API
- `js/app.js` — Bootstrap de keys y wallet

---

## 📄 `js/wizards-vault.js` (v1.3.0)

**Responsabilidad principal:** Módulo central para la Cámara del Brujo (Wizard's Vault). Gestiona la obtención de datos de temporada, objetivos (diarios, semanales, especiales), cuenta (AA) y listados de la tienda. Es la capa de datos que alimenta a `wv-shop-ui.js`, `wv-objectives-ui.js` y `wv-purchase-detail.js`.

**API pública expuesta:** `window.WizardsVault`, `window.forceReloadWVSeason`

**Métodos principales:**
- `getWVSeason(opts)` — Obtiene información de la temporada actual
- `getWVDaily(token, opts)` — Objetivos diarios
- `getWVWeekly(token, opts)` — Objetivos semanales
- `getWVSpecial(token, opts)` — Objetivos especiales
- `getWVAccount(token, opts)` — Saldo de AA
- `getWVListings(opts)` — Catálogo global de la tienda
- `getAccountWVListings(token, opts)` — Listados de la cuenta (compras realizadas)
- `getWVObjectivesAll(opts)` — Catálogo completo de objetivos
- `getWVObjectivesMeta(ids, opts)` — Metadatos de objetivos específicos
- `getWVShopMerged(token, opts)` — Combina listados globales + cuenta + items + AA
- `forceReloadSeason()` — Recarga forzada de temporada (expuesta globalmente)
- `wvInvalidateTargets(token)` — Invalida caché de objetivos
- `wvPreloadTargets(token, opts)` — Precarga todos los objetivos y cuenta

**Dependencias:**
- `window.GW2Api` — Para métodos auxiliares (getItemsMany, getAstralAcclaimBalance)
- `window.WVSeasonStore` — Para persistencia de pins y marcas (opcional, hook)
- `window.Analytics` — Para eventos de recarga de temporada (opcional)

**Datos que consume:**
- `https://api.guildwars2.com/v2/wizardsvault` — Info de temporada
- `https://api.guildwars2.com/v2/wizardsvault/season` — Fallback
- `https://api.guildwars2.com/v2/wizards-vault/season` — Fallback alternativo
- `https://api.guildwars2.com/v2/account/wizardsvault/daily` — Objetivos diarios
- `https://api.guildwars2.com/v2/account/wizardsvault/weekly` — Objetivos semanales
- `https://api.guildwars2.com/v2/account/wizardsvault/special` — Objetivos especiales
- `https://api.guildwars2.com/v2/wizardsvault/objectives` — Catálogo de objetivos
- `https://api.guildwars2.com/v2/wizardsvault/listings?ids=all` — Listados de tienda
- `https://api.guildwars2.com/v2/account/wizardsvault/listings` — Listados de cuenta

**Datos que persiste:**
- `wv_season` — Cache de temporada (memoria + localStorage)
- `wv_obj_daily:{LANG}` — Cache de objetivos diarios (por token)
- `wv_obj_weekly:{LANG}` — Cache de objetivos semanales (por token)
- `wv_obj_special:{LANG}` — Cache de objetivos especiales (por token)
- `wv_account_v2` — Cache de AA (por token)
- `wv_listings_all` — Cache de listados globales
- `wv_acc_listings` — Cache de listados de cuenta (por token)
- `wv_obj_catalog:{LANG}` — Cache de catálogo de objetivos

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `getWVSeason()` | Obtiene info de temporada con fallbacks | `{ nocache }` |
| `_getWVObjectives()` | Obtiene objetivos de un tipo específico | `kind`, `token`, `{ nocache }` |
| `getWVShopMerged()` | Combina todos los datos de tienda | `token`, `{ nocache }` |
| `forceReloadSeason()` | Recarga forzada y actualiza UI | — |
| `normalizeSeason()` | Normaliza respuesta de season | `any` |

**Eventos que escucha:**
- `gn:nav-active` — Para inyectar botón de recarga cuando se navega a WV
- `DOMContentLoaded` — Inyección del botón de recarga

**Eventos que emite:**
- `wv:season:reloaded` — Cuando se recarga la temporada (detail: `{ season }`)

**Estructura del DOM que manipula:**
- `#wvSeasonTitle` — Actualiza el título de temporada
- `#wvSeasonDates` — Actualiza fechas de temporada
- `#wvReloadSeasonBtn` — Botón/ícono de recarga (injectado junto a `#wvSyncNote`)

**Bugs o problemas detectados:**
- ✅ **v1.3.0**: El botón de recarga se inyecta con `setInterval` y timeout de 10s; si el DOM no aparece en ese tiempo, no se inyecta.
- ⚠️ `getWVSeason` hace 3 peticiones en cascada (u1 → u2 → u3) que podrían optimizarse con `Promise.any()`.
- ⚠️ La función `forceReloadSeason` usa `window.toast` sin verificar existencia.
- ⚠️ `injectReloadSeasonButton` usa `setInterval` que no se limpia correctamente.

**Versión real:** v1.3.0 (2026-03-30)

**Discrepancias con la documentación:**
- El comentario dice v1.3.0, pero menciona cambios de v1.2.1; el código parece estable.
- `normalizeSeason` es una función interna no documentada en el comentario del header.

---

## 📄 `js/wv-season-storage.js` (v1.1.1)

**Responsabilidad principal:** Servicio de persistencia para Wizard's Vault por temporada. Almacena pins, marcas manuales y preferencias de usuario en localStorage, con particionamiento por temporada y soporte para modo "single-season" (solo temporada actual). Es el almacén de estado que usan WVShopUI y WVPurchaseDetail.

**API pública expuesta:** `window.WVSeasonStore`

**Métodos principales:**
- `getCurrentSeasonInfo()` — Obtiene info de temporada actual
- `listSeasons()` — Lista todas las temporadas guardadas
- `readSeason(year, seq)` — Lee un archivo de temporada
- `writeSeason(year, seq, producer)` — Escribe en un archivo de temporada
- `getPinned(year, seq, fp)` — Obtiene items fijados de una cuenta
- `setPinned(year, seq, fp, patch)` — Fija/desfija items
- `delPinned(year, seq, fp, ids)` — Elimina fijados
- `getMarks(year, seq, fp)` — Obtiene marcas manuales
- `setMarks(year, seq, fp, patch)` — Guarda marcas manuales
- `getPrefs(year, seq)` / `setPrefs(year, seq, patch)` — Preferencias globales
- `getKeyPrefs(year, seq, fp)` / `setKeyPrefs(...)` — Preferencias por cuenta
- `compact(policy)` — Compacta temporadas viejas
- `migrateFromLegacy()` — Migra datos desde `gw2_wv_pinned_v1` y `gw2_wv_marks_v1`

**Dependencias:**
- `window.GW2Api.getWVSeason` — Para resolver temporada actual (opcional)

**Datos que consume:**
- `localStorage` — `wv:season:index`, `wv:season:current`, `wv:season:YY:SEQ`
- Legacy: `gw2_wv_pinned_v1`, `gw2_wv_marks_v1`

**Datos que persiste:**
- `wv:season:index` — Índice de temporadas `[{year, seq, season_id, title, start, end}]`
- `wv:season:current` — Archivo único en modo single-season
- `wv:season:YY:SEQ` — Archivos por temporada (multi-season)
- `wv:season:YY:SEQ.__shadow` — Shadow para escritura atómica (multi-season)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `keySeasonFile(year, seq)` | Genera clave de localStorage | `year`, `seq` |
| `writeSeasonAtomic()` | Escritura atómica con shadow | `year`, `seq`, `data` |
| `compact()` | Purga temporadas viejas | `{ keepPerYear }` |
| `migrateFromLegacy()` | Migra desde formato antiguo | — |

**Eventos que emite:**
- `wv:season-store:mutate` — Cuando se escribe en una temporada

**Estructura de datos:**
```json
{
  "version": 1,
  "season_info": { "year": 26, "seq": 1, "season_id": "..." },
  "keys": {
    "abc…123": {
      "pinned": { "123": 1, "456": 1 },
      "marks": { "123": 5, "456": 2 },
      "prefs": { "view": "cards" }
    }
  },
  "prefs": { "compact": false }
}
```

**Bugs o problemas detectados:**
- ✅ **Single-season mode activado por defecto** (`SINGLE_SEASON_MODE = true`) — Esto significa que al cambiar de temporada, todos los pins/marcas se pierden.
- ⚠️ `compact()` en single-season elimina TODOS los archivos `wv:season:YY:SEQ` residuales; esto podría ser destructivo si alguien quiere conservar datos históricos.
- ⚠️ `migrateFromLegacy()` solo migra a la temporada actual; las temporadas pasadas no se migran.
- ⚠️ No hay validación de `purchase_limit` al guardar marks; el valor puede exceder el límite.

**Versión real:** v1.1.1 (2026-03-09)

**Discrepancias con la documentación:**
- El header menciona "Single-Season hotfix: no-shadow por defecto + GC shadows + prune", lo cual coincide con la implementación.
- No se menciona en el header que `SINGLE_SEASON_MODE` está forzado a `true`.

---

## 📄 `js/wv-shop-ui.js` (v1.0.2)

**Responsabilidad principal:** UI de la tienda de Wizard's Vault. Renderiza la grilla de items (vista cards o tabla), maneja filtros (búsqueda, legacy, ordenamiento), fijado de items (`pinned`), marcas manuales (`marks`), y sincronización con el backend. Es el componente visual que el usuario ve cuando navega a la pestaña "Tienda".

**API pública expuesta:** `window.WVShopUI`

**Métodos principales:**
- `render()` — Renderiza la tienda (cards o tabla)
- `refresh(forceNoCache)` — Recarga datos de la tienda desde API
- `setShopLoading(on, msg)` — Muestra/oculta skeleton loader
- `ensureShopToolbar()` — Asegura que la toolbar de filtros exista
- `syncShopToggleLabel()` — Actualiza etiqueta del botón de vista

**Dependencias:**
- `window.WV` — Estado compartido de la Cámara del Brujo (state.shop)
- `window.GW2Api.getWVShopMerged()` — Datos de tienda
- `window.WVSeasonStore` — Persistencia de pins y marcas
- `window.WVTheme` — Para aplicar el tema visual a las cards (opcional)

**Datos que consume:**
- `window.WV.__getShopState()` — Estado interno de tienda
- `getWVShopMerged()` vía `window.GW2Api`
- `localStorage` — Preferencias de vista y filtro

**Datos que persiste:**
- `gw2_wv_view_v1` — Preferencia de vista (`cards`/`table`)
- `gw2_wv_legacy_filter_v1` — Preferencia de filtro legado (`show`/`hide`)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `renderShopArea()` | Renderiza toda el área de tienda | — |
| `renderShopCards()` | Renderiza vista de tarjetas | `area`, `rows`, `itemsById`, `st` |
| `renderShopTable()` | Renderiza vista de tabla | `area`, `rows`, `itemsById`, `st` |
| `wirePinButtons()` | Conecta botones de fijado | `area`, `st` |
| `wireManualInputs()` | Conecta inputs de marcas manuales | `area`, `st` |
| `updateCardProgress()` | Actualiza barra de progreso de una card | `listingId`, `newMarked`, `st` |

**Estructura del DOM que manipula:**
- `#wvTabShop` — Contenedor principal
- `#wvShopToolbarHost` — Contenedor de la toolbar
- `#wvShopList` — Contenedor de la lista/grilla
- `#wvShopHeader` — Cabecera con AA disponible
- `#wvShopSearch` — Input de búsqueda
- `#wvShopToggleView` — Botón de cambio de vista
- `#wvShopRefresh` — Botón de refresco
- `#wvLegacyFilter` — Selector de filtro legado
- `#wvClearSynced` — Botón de limpieza de marcas sincronizadas
- `#wvClearPinsAll` — Botón de limpieza de fijados (todas las cuentas)
- `#wvReplicatePins` — Botón de replicación de fijados

**Eventos que escucha:**
- `input` en `#wvShopSearch` — Filtra la lista
- `click` en `#wvShopToggleView` — Cambia vista
- `click` en `#wvShopRefresh` — Refresca datos
- `change` en `#wvLegacyFilter` — Filtra items legado
- `click` en `#wvClearSynced` — Limpia marcas sincronizadas
- `click` en `#wvClearPinsAll` — Limpia fijados de todas las cuentas
- `click` en `#wvReplicatePins` — Replica fijados a todas las cuentas
- `click` en `[data-pin]` — Fija/desfija un item
- `change` en `.wvpd-manual-input-field` — Guarda marca manual

**Bugs o problemas detectados:**
- ✅ **v1.0.2**: `setTimeout(render, 200)` en `renderShopArea()` si el estado no está disponible — esto puede causar renders duplicados.
- ⚠️ `wireManualInputs` actualiza `st.marks` directamente sin verificar si `st` existe.
- ⚠️ `updateCardProgress` no actualiza el input manual al cambiar el valor (solo la barra y pills).
- ⚠️ Los botones `#wvClearPinsAll` y `#wvReplicatePins` dependen de `window.WVSeasonStore` sin verificar disponibilidad.

**Versión real:** v1.0.2 (2026-05-02)

**Discrepancias con la documentación:**
- El header dice "Fix visual — glow solo en ícono, no en tarjeta", pero el código aún aplica `borderLeft` y `classList.add('card')` en `renderShopArea()`.
- El header menciona `wv-theme.js` como responsable del borde izquierdo, pero `wv-shop-ui.js` también lo aplica directamente.

---

## 📄 `js/wv-objectives-ui.js` (v1.0.0)

**Responsabilidad principal:** UI de los objetivos de Wizard's Vault. Renderiza los objetivos diarios, semanales y especiales en las pestañas correspondientes. Muestra progreso, recompensas y estados (reclamado/pendiente/cero).

**API pública expuesta:** `window.WVObjectivesUI`

**Métodos principales:**
- `renderTab(host, data, kind)` — Renderiza una pestaña de objetivos
- `renderZero(kind)` — Renderiza estado "cero" (reseteado)

**Dependencias:**
- `window.WV` — Estado compartido de la Cámara del Brujo
- `window.GW2Api` — Para datos de objetivos (indirectamente, via WV)
- `window.WV_MODE_ICONS` — Íconos para modos PvE/PvP/WvW

**Datos que consume:**
- `window.WV.__getObjState()` — Estado de objetivos
- `data.objectives` — Lista de objetivos
- `data.meta_progress_current` / `data.meta_progress_complete` — Progreso de meta de temporada

**Datos que persiste:**
- No persiste directamente; usa el estado de `window.WV`

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `renderObjectivesTab()` | Renderiza objetivos de un tipo | `host`, `data`, `kind` |
| `normalizeObjectives()` | Normaliza respuesta de API | `raw` |
| `hydrateWVModePills()` | Reemplaza texto de modo por ícono | `scope` |
| `renderObjectivesZero()` | Renderiza estado reseteado | `kind` |

**Estructura del DOM que manipula:**
- `#wvTabDaily` — Pestaña diaria
- `#wvTabWeekly` — Pestaña semanal
- `#wvTabSpecial` — Pestaña especial
- `.wv-obj-grid` — Contenedor de grid de objetivos
- `.wv-obj-card` — Card de objetivo individual
- `.wv-obj-mode` — Pill del modo (PvE/PvP/WvW)

**Bugs o problemas detectados:**
- ⚠️ `renderObjectivesZero()` no guarda el estado de "cero" en el estado compartido; solo actualiza el DOM.
- ⚠️ `hydrateWVModePills()` busca `data-wv-mode` y `data-mode`, pero no hay consistencia en cuál se usa.
- ⚠️ No hay manejo de errores si `window.WV` no está disponible.

**Versión real:** v1.0.0 (2026-05-01)

**Discrepancias con la documentación:**
- El header dice "Depende de: window.WV (estado: state.obj, state.loaded)" pero el código usa `root.WV.__getObjState()` y `root.WV.__setObjState()` que son métodos privados no documentados.
- La versión en el header coincide con la fecha (2026-05-01).

---

## 📄 `js/wv-objectives-dashboard.js` (v1.0.0)

**Responsabilidad principal:** Dashboard de objetivos semanales multi-cuenta. Muestra una tabla comparativa donde las filas son cuentas y las columnas son objetivos semanales. Cada celda muestra el estado del objetivo (pendiente/completado/reclamado) para esa cuenta.

**API pública expuesta:** `window.WVObjectivesDashboard`

**Métodos principales:**
- `activate()` — Activa el dashboard y carga datos
- `deactivate()` — Desactiva el dashboard
- `refresh(forceNoCache)` — Recarga datos desde API
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.GW2Api.getWVWeekly()` — Para obtener objetivos semanales
- `window.WV_MODE_ICONS` — Íconos para modos (global)
- `localStorage` — Para leer `gw2_keys`

**Datos que consume:**
- `localStorage:gw2_keys` — Lista de API keys
- `GW2Api.getWVWeekly(token)` — Objetivos semanales por token

**Datos que persiste:**
- No persiste datos propios; solo lee `gw2_keys` del localStorage.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadData(forceNoCache)` | Carga datos de todas las cuentas | `forceNoCache` |
| `normalizeObjectives(raw)` | Normaliza objetivos de API | `raw` |
| `render()` | Renderiza el dashboard completo | — |
| `renderCell(account, objective)` | Renderiza una celda de la tabla | `account`, `objective` |
| `renderSkeleton()` | Renderiza skeleton loader | — |

**Estructura del DOM que manipula:**
- `#wvObjectivesDashboardPanel` — Contenedor principal
- `#wvodCountdown` — Cuenta regresiva hasta reset semanal
- `.wvod-kpi` — KPIs del dashboard
- `.wvod-table` — Tabla de objetivos

**Eventos que escucha:**
- `gn:tokenchange` — Recarga datos al cambiar token (en `wireGlobalEvents()`)

**Bugs o problemas detectados:**
- ⚠️ `loadData` usa un patrón de "batches" con `MAX=3` que está bien, pero no cancela peticiones en vuelo al cambiar de cuenta.
- ⚠️ `getAccountIcon` usa un índice aleatorio por `fp` que no es consistente entre sesiones; el ícono de una cuenta puede cambiar.
- ⚠️ `renderSkeleton` no tiene la misma estructura visual que `render`; puede causar un "flash" al cargar.
- ⚠️ `updateCountdown` se ejecuta cada 60s (`setInterval(updateCountdown, 60000)`) — debería ser cada 1s para contar segundos.

**Versión real:** v1.0.0 (2026-05-15)

**Discrepancias con la documentación:**
- El header dice "Depende de: window.GW2Api (getWVWeekly), localStorage gw2_keys, window.Analytics (opcional)" — Todo coincide.
- La función `renderSkeleton` no está documentada en el header.

---

## 📄 `js/wv-purchase-detail.js` (v1.13.1)

**Responsabilidad principal:** Vista de detalle de compras (Purchase Detail) para Wizard's Vault. Muestra un dashboard estratégico con KPIs, top cuentas deficitarias, top items pendientes, y una tabla detallada por cuenta/ítem fijado. Incluye manejo de marcas manuales (compras manuales) con auto-guardado y botón MAX.

**API pública expuesta:** `window.WVPurchaseDetail`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `show()` — Muestra el panel de detalle de compras
- `hide()` — Oculta el panel
- `refresh(forceNoCache)` — Recarga datos
- `setIcon(url)` — Cambia el ícono del banner
- `refreshOnlineStatus()` — Actualiza estado online de todas las cuentas

**Dependencias:**
- `window.WVSeasonStore` — Persistencia de pins y marcas
- `window.GW2Api.getWVShopMerged()` — Datos de tienda
- `window.GW2Api.getWVWeekly()` — Progreso semanal
- `window.GW2Api.getAccountInfo()` — Estado online
- `window.WV` — Estado compartido de la Cámara del Brujo (indirecto)
- `localStorage` — Para leer `gw2_keys`

**Datos que consume:**
- `localStorage:gw2_keys` — Lista de API keys
- `GW2Api.getWVShopMerged(token)` — Datos de tienda
- `GW2Api.getWVWeekly(token)` — Objetivos semanales
- `GW2Api.getAccountInfo(token)` — Última actividad (last_modified)

**Datos que persiste:**
- `wvpd_open` — Estado de apertura del panel (`'1'`/`'0'`)
- `wvpd_icon_url` — URL del ícono del banner
- `wv:season:YY:SEQ` — Pins y marcas (vía WVSeasonStore)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadAll(forceNoCache)` | Carga todos los datos | `forceNoCache` |
| `renderTable()` | Renderiza la tabla principal | — |
| `updateDashboard()` | Actualiza KPIs y resúmenes | — |
| `refreshAllOnlineStatus()` | Actualiza estado online de todas las cuentas | — |
| `updateManualMark(listingId, newValue, fp, token)` | Guarda marca manual | `listingId`, `newValue`, `fp`, `token` |
| `enhanceShopCards()` | Mejora las cards de la tienda con inputs manuales | — |
| `getTotalPurchased(acc, listingId)` | Calcula compras totales (API + manual) | `acc`, `listingId` |

**Estructura del DOM que manipula:**
- `#wvPDPanel` — Panel principal
- `#wvpdBannerIcon` — Ícono del banner
- `#wvpdDash` — Dashboard de KPIs
- `#wvpdTableWrap` — Contenedor de la tabla
- `#wvpdTable` — Tabla de detalle
- `#wvpdFilters` — Filtros (búsqueda, solo pendientes, orden)
- `#wvpdStatusBar` — Barra de estado
- `#wvpdOnlineBtn` — Botón de estado online (injectado)

**Eventos que escucha:**
- `gn:nav-active` — Para mostrar/ocultar automáticamente
- `storage` — Para detectar cambios en `wvpd_icon_url` y `wv:season:*`
- `wv:season-store:mutate` — Para refrescar al mutar temporada
- `click` en tabs de WV — Para ocultar el panel
- `click` en `#wvpdSyncBtn` — Refrescar datos
- `click` en `#wvpdOnlineBtn` — Refrescar estado online

**Eventos que emite:**
- No emite eventos propios.

**Bugs o problemas detectados:**
- ✅ **v1.13.1**: Estado online basado en `last_modified` de `/v2/account` — más preciso que el endpoint de PvP.
- ⚠️ `loadAll` no cancela peticiones en vuelo al cambiar de cuenta.
- ⚠️ `enhanceShopCards` busca `.wv-counter-placeholder` que no existe en `wv-shop-ui.js` v1.0.2.
- ⚠️ `updateManualMark` actualiza `state.accounts[i].marks` pero no `st.marks` en WVShopUI; puede haber desincronización.
- ⚠️ `refreshAllOnlineStatus` no está expuesta como método público del módulo principal; solo se expone al final del archivo.

**Versión real:** v1.13.1 (2026-04-05)

**Discrepancias con la documentación:**
- El header dice "REEMPLAZADA lógica de PvP por last_modified de /v2/account" — coincide con el código.
- El header menciona v1.12.0 y v1.11.0 en el changelog; el código implementa todas esas características.
- `enhanceShopCards` y `updateManualMark` están expuestas globalmente (`window.enhanceShopCards`, etc.) pero no forman parte de la API pública documentada.

---

## 📄 `js/wv-tabs-skin.js` (v1.0.0)

**Responsabilidad principal:** Re-skin de los botones de tabs del header de Wizard's Vault ("Diarias", "Semanales", "Especiales", "Tienda"). Aplica el mismo diseño visual que el botón "Refrescar" a las tabs, y mantiene el estado activo visualmente.

**API pública expuesta:** Ninguna (autoejecutable)

**Métodos principales:**
- `applySkin()` — Aplica clases de estilo a los botones
- `refreshActiveVisual()` — Actualiza el estado activo visual
- `observeWV()` — Observa cambios en el DOM para re-aplicar el skin

**Dependencias:**
- `window.WV` — Estado de la Cámara del Brujo (indirecto, para detectar cambios)
- `document` — DOM para manipular botones

**Datos que consume:**
- `#wvTabBtnDaily`, `#wvTabBtnWeekly`, `#wvTabBtnSpecial`, `#wvTabBtnShop` — IDs de los botones

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `applySkin()` | Aplica clases a los botones | — |
| `refreshActiveVisual()` | Actualiza estado activo | — |
| `observeWV()` | Observa el DOM para cambios | — |

**Estructura del DOM que manipula:**
- `#wvTabBtnDaily`, `#wvTabBtnWeekly`, `#wvTabBtnSpecial`, `#wvTabBtnShop` — Agrega clases `btn`, `btn--wv-skin`, `btn--wv-active`

**Bugs o problemas detectados:**
- ⚠️ `observeWV()` usa `MutationObserver` pero no se limpia cuando el módulo se descarga.
- ⚠️ `refreshActiveVisual()` usa `aria-selected="true"` o `aria-current="page"` pero WV puede usar otros atributos.

**Versión real:** v1.0.0 (2026-03-04)

**Discrepancias con la documentación:**
- El header dice "No modifica la lógica de navegación; sólo aplica clases y estilos" — coincide con el código.

---

## 📄 `js/wv-theme.js` (v1.0.1)

**Responsabilidad principal:** Tema visual unificado para las cards de Wizard's Vault. Aplica un borde izquierdo de color (según rareza para tienda, o modo PvE/PvP/WvW para objetivos), y agrega la clase `.card` para heredar el tema base de `theme-polish.css`.

**API pública expuesta:** `window.WVTheme`

**Métodos principales:**
- `themeAllNow(root)` — Aplica el tema a todas las cards existentes
- (interno) `applyCardTheme(card)` — Aplica tema a una card individual

**Dependencias:**
- `theme-polish.css` — Para estilos base de `.card`
- `document` — DOM para manipular cards

**Datos que consume:**
- `#wvPanel` — Contenedor principal de WV
- `.wv-card` — Cards de la tienda
- `.wv-obj-card` — Cards de objetivos

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `applyCardTheme()` | Aplica tema a una card | `card` |
| `detectColor()` | Detecta color para borde izquierdo | `card` |
| `themeAllNow()` | Aplica tema a todas las cards | `root` |

**Eventos que escucha:**
- `hashchange` — Re-aplica tema al cambiar hash
- `gn:tabchange` — Re-aplica tema al cambiar a WV
- `gn:tokenchange` — Re-aplica tema al cambiar token
- `load` — Re-aplica tema al cargar la página

**Estructura del DOM que manipula:**
- `.wv-card`, `.wv-obj-card` — Agrega `border-left: 3px solid [color]` y clase `.card`

**Bugs o problemas detectados:**
- ✅ **v1.0.1**: Solo aplica border-left; el resto lo hereda de `.card`.
- ⚠️ `detectColor` usa `nameEl.style.color` que puede ser `rgb(233, 233, 241)` (neutro) y no detectar la rareza correctamente.
- ⚠️ `detectColor` busca `.wv-obj-mode, [data-wv-mode], [data-mode]` pero WVObjectivesUI usa `data-wv-mode` con el valor del modo.

**Versión real:** v1.0.1 (2026-05-02)

**Discrepancias con la documentación:**
- El header dice "Solo border-left de color, el resto lo hereda de .card (theme-polish.css)" — coincide con el código.

---

## 📄 `js/wallet-dashboard.js` (v2.5.0)

**Responsabilidad principal:** Dashboard de cartera multi-cuenta. Muestra una tabla de cuentas vs divisas seleccionadas, con KPIs de totales, ordenamiento dinámico por columna, selector de divisas dropdown, y persistencia de selección y ordenamiento.

**API pública expuesta:** `window.WalletDashboard`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `show()` — Alias de activate
- `refresh(forceNoCache)` — Recarga datos

**Dependencias:**
- `window.GW2Api.getCurrenciesAll()` — Lista de divisas
- `window.GW2Api.getAccountWallet()` — Cartera de cada cuenta
- `localStorage` — Para leer `gw2_keys`
- `assets/icons/Welcome/156107.png` — Ícono de error

**Datos que consume:**
- `localStorage:gw2_keys` — Lista de API keys
- `GW2Api.getCurrenciesAll()` — Catálogo de divisas
- `GW2Api.getAccountWallet(token)` — Cartera por token

**Datos que persiste:**
- `wallet_dashboard_selected_currencies` — IDs de divisas seleccionadas
- `wallet_dashboard_sort` — Preferencia de ordenamiento `{ column, direction }`

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadCurrencies()` | Carga catálogo de divisas | — |
| `loadAllWallets(forceNoCache)` | Carga carteras de todas las cuentas | `forceNoCache` |
| `renderTable()` | Renderiza la tabla principal | — |
| `renderKPIs(totals)` | Renderiza KPIs de totales | `totals` |
| `setSortColumn(currencyId)` | Establece columna de ordenamiento | `currencyId` |
| `sortAccounts(accounts, currencyId, direction)` | Ordena cuentas | `accounts`, `currencyId`, `direction` |

**Estructura del DOM que manipula:**
- `#walletDashboardPanel` — Panel principal
- `#wdKPIs` — Contenedor de KPIs
- `#wdCurrencySelector` — Selector de divisas
- `#wdTable` — Tabla principal
- `#wdStatusMsg` — Mensaje de estado
- `#wdTimestamp` — Timestamp de última actualización
- `#wdRefreshBtn` — Botón de refresco
- `#wdBackBtn` — Botón de volver

**Eventos que escucha:**
- `click` en `#wdRefreshBtn` — Refresca datos
- `click` en `#wdBackBtn` — Vuelve a Cartera
- `click` en `th.sortable` — Ordena por columna
- `change` en checkboxes del selector — Filtra divisas

**Bugs o problemas detectados:**
- ✅ **v2.5.0**: Reintento de renderizado si la tabla no existe (fix).
- ⚠️ `loadAllWallets` usa `MAX=3` concurrentes, pero si una cuenta falla, las demás siguen cargando.
- ⚠️ `renderTable` guarda el contenido original en `__originalContent` pero no siempre lo restaura.
- ⚠️ `formatCoinValue` usa `<span>` para colores, lo que puede interferir con el tema oscuro.

**Versión real:** v2.5.0 (2026-04-08)

**Discrepancias con la documentación:**
- El header dice "Fix: reintento de renderizado si la tabla no existe" — implementado correctamente.
- No hay documentación para `goBackToWallet()` que usa `location.hash`.

---

## 📄 `js/wallet-theme.js` (v1.3.0)

**Responsabilidad principal:** Tema visual para las cards de cartera. Aplica colores por divisa (gemas, monedas, karma, laureles, etc.), con borde izquierdo de color, título tintado, y glow en el ícono. También migra categorías a badges y convierte cards a clase `.card` canónica.

**API pública expuesta:** `window.WalletTheme`

**Métodos principales:**
- `applyCurrencyTheme(card)` — Aplica tema a una card
- `migrateCategoriesToBadges(root)` — Convierte `.cats` a badges
- `migrateWalletToCardClass(root)` — Agrega clase `.card`
- `themeWalletNow(root)` — Aplica tema a todas las cards

**Dependencias:**
- `theme-polish.css` — Para estilos base de `.card`
- `document` — DOM para manipular cards

**Datos que consume:**
- `data-cur`, `data-key` — Atributos en cards para detectar divisa
- `.cats` — Elementos de categoría a migrar

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `resolveCurrencyKey(card)` | Detecta divisa de una card | `card` |
| `colorForKey(key)` | Obtiene color para una divisa | `key` |
| `applyCurrencyTheme(card)` | Aplica tema a una card | `card` |
| `migrateCategoriesToBadges()` | Migra categorías a badges | `root` |

**Estructura del DOM que manipula:**
- `.wallet-card`, `.wv-card`, `.cur-card`, `.w-card` — Borde izquierdo, título tintado, glow en ícono
- `.cats` — Migrado a `<span class="badge badge--info">`

**Bugs o problemas detectados:**
- ✅ **v1.3.0**: Migración a clase `.card` canónica.
- ⚠️ `resolveCurrencyKey` usa `EXACT`, `STARTS`, `TOKENS` para detectar divisa; es robusto pero puede tener falsos positivos.
- ⚠️ `applyCurrencyTheme` aplica `style.borderLeft` directamente; esto podría sobrescribir estilos de `theme-polish.css`.

**Versión real:** v1.3.0 (2026-03-21)

**Discrepancias con la documentación:**
- El header dice "migración de tarjetas a clase .card canónica (hereda hover con glow, gradiente)" — coincide con el código.
- El header menciona "badges de categorías" — implementado en `migrateCategoriesToBadges`.

---

## 📄 `js/inventory-hub.js` (v1.3.1)

**Responsabilidad principal:** Hub de inventario y personajes. Es el módulo principal que muestra el inventario (banco, materiales, armería) y personajes. Organiza materiales por categorías del juego (10 categorías), armería por tipo, y ofrece modal de ítem con stats reales de la API.

**API pública expuesta:** `window.InventoryHub`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `refresh(forceNoCache)` — Recarga datos

**Dependencias:**
- `window.GW2Api` — Para datos de banco, materiales, armería
- `window.Characters.getCharacterList()` — Para lista de personajes
- `localStorage` — Para leer token seleccionado
- `theme-polish.css` — Para estilos base

**Datos que consume:**
- `GW2Api.getAccountBank(token)` — Banco
- `GW2Api.getAccountMaterials(token)` — Materiales
- `GW2Api.getAccountLegendaryArmory(token)` — Armería
- `GW2Api.getItemsMany(ids)` — Metadatos de items
- `localStorage:gw2_selected_key_v1` — Token seleccionado

**Datos que persiste:**
- No persiste datos propios; solo lee del localStorage.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadAllData(forceNoCache)` | Carga todos los datos de inventario | `forceNoCache` |
| `buildSectionData()` | Construye datos por sección | — |
| `renderHub()` | Renderiza el hub principal | — |
| `openSectionView(section)` | Abre vista detallada de una sección | `section` |
| `openItemModal(entryData)` | Abre modal de ítem | `entryData` |
| `renderMaterialsDetail()` | Renderiza detalles de materiales | — |
| `renderBankDetail()` | Renderiza detalles del banco | — |
| `renderArmoryDetail()` | Renderiza detalles de la armería | — |

**Estructura del DOM que manipula:**
- `#inventoryPanel` — Panel principal
- `#invKPIs` — KPIs del hub
- `#invFilters` — Filtros
- `#invResults` — Contenedor de resultados
- `#invSectionContent` — Contenido de vista de sección
- `#invItemModal` — Modal de ítem

**Eventos que escucha:**
- `click` en `.inv-kpi-card[data-section]` — Abre sección
- `click` en `.inv-item-card` — Abre modal de ítem
- `click` en `#invRefreshBtn` — Refresca datos
- `click` en `#invDashboardBtn` — Navega al Dashboard
- `click` en `#invGoToChars` — Navega a Personajes
- `input` en `#invSearchInput` — Filtra resultados
- `change` en `#invRarityFilter` — Filtra por rareza
- `click` en `.inv-rarity-chip` — Filtra por rareza (chip)

**Bugs o problemas detectados:**
- ✅ **v1.3.1**: Fix: KPIs en fila al volver de una sección.
- ✅ **v1.3.1**: Materiales organizados con 10 categorías del juego.
- ✅ **v1.3.1**: Armería organizada por tipo.
- ✅ **v1.3.1**: Links de Wiki en español.
- ⚠️ `openItemModal` usa `CONFIG.WIKI_BASE = 'https://wiki-es.guildwars2.com/wiki/'` — correcto.
- ⚠️ `loadAllData` no cancela peticiones en vuelo.

**Versión real:** v1.3.1 (2026-05-03)

**Discrepancias con la documentación:**
- El header menciona todas las mejoras implementadas.
- La versión declarada (v1.3.1) coincide con el changelog.

---

## 📄 `js/inventory-dashboard.js` (v1.0.0)

**Responsabilidad principal:** Dashboard de inventario multi-cuenta. Muestra una tabla de cuentas vs ítems seleccionados (banco + materiales combinados), con 3 sets predefinidos intercambiables, selector de ítems con dropdown + checkboxes + íconos de API, ocultar filas/columnas en cero, y KPIs resumen.

**API pública expuesta:** `window.InventoryDashboard`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `refresh(forceNoCache)` — Recarga datos

**Dependencias:**
- `window.GW2Api.getAccountBank()` — Banco
- `window.GW2Api.getAccountMaterials()` — Materiales
- `window.GW2Api.getAccountInfo()` — Información de cuenta
- `window.GW2Api.getItemsMany()` — Metadatos de items
- `window.GW2Api.getCommercePrices()` — Precios de TP
- `localStorage` — Para leer `gw2_keys`

**Datos que consume:**
- `assets/data/inventory-sets.json` — Sets predefinidos (íconos locales)
- `localStorage:gw2_keys` — Lista de API keys
- `GW2Api.getAccountBank(token)` — Banco
- `GW2Api.getAccountMaterials(token)` — Materiales
- `GW2Api.getAccountInfo(token)` — Información de cuenta
- `GW2Api.getItemsMany(ids)` — Metadatos de items
- `GW2Api.getCommercePrices(ids)` — Precios de TP

**Datos que persiste:**
- `inv_dashboard_selected_items` — IDs de ítems seleccionados
- `inv_dashboard_active_set` — ID del set activo
- `inv_dashboard_active_tiers` — Tiers activos
- `inv_dashboard_sort` — Preferencia de ordenamiento `{ column, direction }`
- `inv_dashboard_hide_zero` — Preferencias de ocultar cero `{ hideZeroRows, hideZeroColumns, hideMainAccounts }`

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadSets()` | Carga sets desde JSON o fallback | — |
| `loadAllInventories(forceNoCache)` | Carga inventarios de todas las cuentas | `forceNoCache` |
| `loadCharactersInBackground(accounts)` | Carga personajes activos en background | `accounts` |
| `renderTable()` | Renderiza la tabla principal | — |
| `renderKPIs(activeItems, filteredAccounts)` | Renderiza KPIs | `activeItems`, `filteredAccounts` |
| `getActiveItems()` | Obtiene ítems activos según set/tiers | — |
| `getItemTotalForAccount(account, itemId)` | Cuenta ítems en banco+materiales+personaje | `account`, `itemId` |

**Estructura del DOM que manipula:**
- `#inventoryDashboardPanel` — Panel principal
- `#idKPIs` — KPIs
- `#idSetSwitch` — Switch de sets
- `#idItemSelector` — Selector de ítems
- `#idHideToggles` — Toggles de ocultar
- `#idTable` — Tabla principal
- `#idStatusMsg` — Mensaje de estado
- `#idTimestamp` — Timestamp de última actualización

**Eventos que escucha:**
- `click` en `.id-set-btn` — Cambia set
- `click` en `.id-set-btn` — Cambia set
- `change` en `.id-tier-cb` — Cambia tiers activos
- `change` en `#idHideZeroRows`, `#idHideZeroCols`, `#idHideMain` — Cambia ocultar
- `click` en `th.sortable` — Ordena por columna
- `click` en `#idRefreshBtn` — Refresca datos
- `click` en `#idBackBtn` — Vuelve a Inventario

**Bugs o problemas detectados:**
- ⚠️ `loadAllInventories` tiene dos fases: Fase 1 (banco+materiales) y Fase 2 (personaje activo). La Fase 2 actualiza el DOM con `updateCharCell`, pero si hay muchas cuentas, puede haber parpadeos.
- ⚠️ `_refreshInFlight` no maneja cancelación de peticiones en vuelo.
- ⚠️ `getActiveItems` para sets con tiers usa `state.activeTiers` que se guarda en localStorage, pero no hay validación de que los tiers existan.
- ⚠️ `renderTable` usa `setTimeout(renderTable, 100)` si la tabla no existe — esto puede causar bucles infinitos.

**Versión real:** v1.0.0 (2026-05-07)

**Discrepancias con la documentación:**
- El header dice "Mismo patrón de carga que Wallet Dashboard (MAX=3 concurrentes)" — coincide con el código.
- La función `goBackToInventory()` usa `location.hash = '#/account/characters'` que redirige a Personajes, no a Inventario.

---

## 📄 `js/characters.js` (v2.3.0)

**Responsabilidad principal:** Panel de Personajes y Localización. Muestra lista de personajes con su ubicación actual, profesión, raza, nivel, gremio, y permite asignar POIs (puntos de interés) a cada personaje. Incluye carga optimizada con caché, batched requests, y reintentos automáticos.

**API pública expuesta:** `window.Characters`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `refresh(force)` — Recarga datos
- `getCharacterList()` — Devuelve lista de personajes
- `getCharacterLocation(name)` — Obtiene ubicación de un personaje
- `clearCache()` — Limpia caché de personajes
- `on(eventName, callback)` / `off(eventName, callback)` — Suscripción a eventos
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.GW2Api` — Para datos de mapas, profesiones, especializaciones
- `localStorage` — Para leer `gw2_selected_key_v1`
- `theme-polish.css` — Para estilos base

**Datos que consume:**
- `https://api.guildwars2.com/v2/maps?ids=all` — Mapas
- `assets/data/pois.json` — Puntos de interés
- `assets/data/race_icons.json` — Íconos de raza
- `https://api.guildwars2.com/v2/characters?access_token=...` — Lista de personajes
- `https://api.guildwars2.com/v2/characters/[name]?access_token=...` — Detalle de personaje
- `https://api.guildwars2.com/v2/specializations/[id]` — Especializaciones
- `https://api.guildwars2.com/v2/guild/[id]` — Gremios
- `https://api.guildwars2.com/v2/pvp/stats?access_token=...` — Estadísticas PvP
- `https://api.guildwars2.com/v2/pvp/ranks?ids=all` — Rangos PvP
- `https://api.guildwars2.com/v2/wvw/ranks?ids=all` — Rangos WvW

**Datos que persiste:**
- `characters:maps` — Caché de mapas (TTL 24h)
- `characters:pois` — Caché de POIs (TTL 7 días)
- `characters:prof_icons` — Caché de íconos de profesión (TTL 7 días)
- `characters:race_icons` — Caché de íconos de raza (TTL 7 días)
- `characters:specs` — Caché de especializaciones
- `characters:assignments:{tokenHash}` — Asignaciones de POIs por cuenta
- `characters:location_history:{tokenHash}` — Historial de ubicaciones
- `characters:cached:{tokenHash}` — Caché de personajes (TTL 5 min)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadCharacters(useCache)` | Carga personajes con caché | `useCache` |
| `loadCharacterDetailsOptimized(names, fetchId)` | Carga detalles en batches | `names`, `fetchId` |
| `fetchCharacterDetailWithRetry(name, fetchId, retryCount)` | Obtiene detalle con reintentos | `name`, `fetchId`, `retryCount` |
| `setAssignment(characterName, poiId)` | Asigna POI a un personaje | `characterName`, `poiId` |
| `getCharacterLocation(characterName)` | Obtiene ubicación actual | `characterName` |

**Estructura del DOM que manipula:**
- `#charactersPanel` — Panel principal
- `#charAccountHeader` — Cabecera de cuenta (logros, PvP, WvW)
- `#charFilters` — Filtros
- `#charList` — Lista de personajes
- `#charPagination` — Paginación
- `.poi-select` — Select de POIs

**Eventos que emite:**
- `characters:load:start` — Inicio de carga
- `characters:load:progress` — Progreso de carga
- `characters:load:complete` — Carga completada
- `characters:load:failed` — Error en carga
- `characters:rendered` — Renderizado completado
- `characters:assignment:changed` — Cambio de asignación

**Bugs o problemas detectados:**
- ✅ **v2.3.0**: Agregado ícono al título del panel.
- ✅ **v2.2.2**: Persistencia visual de POIs seleccionados.
- ⚠️ `loadCharacterDetailsOptimized` usa `details[/*index*/]` pero el orden de los resultados no está garantizado.
- ⚠️ `fetchCharacterDetailWithRetry` no cancela peticiones en vuelo al cambiar de cuenta.
- ⚠️ `CONFIG.CHAR_DETAIL_TIMEOUT = 8000` puede ser demasiado bajo para personajes con muchos datos.

**Versión real:** v2.3.0 (2026-03-24)

**Discrepancias con la documentación:**
- El header menciona "Optimización de carga: reintentos automáticos, timeout reducido a 8s" — coincide con `CONFIG.CHAR_DETAIL_TIMEOUT = 8000`.
- El header menciona "Carga por lotes (batches) para no saturar la API" — implementado con `CONFIG.BATCH_SIZE = 3`.

---

## 📄 `js/characters-theme.js` (v1.0.1)

**Responsabilidad principal:** Tema visual para el panel de personajes. Aplica borde izquierdo de color según la profesión (Guardian, Warrior, etc.), título tintado, y marco sutil en el ícono de profesión. También mejora los selects de POIs a dropdowns personalizados con el mismo estilo que los de Achievements.

**API pública expuesta:** Ninguna (autoejecutable)

**Métodos principales:**
- `applyCharTheme(card)` — Aplica tema a una card de personaje
- `enhancePOISelects(root)` — Mejora selects de POIs
- `themeNow(root)` — Aplica tema a todas las cards

**Dependencias:**
- `theme-polish.css` — Para estilos base de `.card`
- `document` — DOM para manipular cards

**Datos que consume:**
- `.card` — Cards de personajes
- `.poi-select` — Selects de POIs

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `detectProfession(card)` | Detecta profesión de una card | `card` |
| `applyCharTheme(card)` | Aplica tema a una card | `card` |
| `enhancePOISelects(root)` | Mejora selects de POIs | `root` |

**Estructura del DOM que manipula:**
- `.card` — Borde izquierdo de color por profesión, título tintado
- `.poi-select` — Reemplazado por dropdown personalizado

**Bugs o problemas detectados:**
- ✅ **v1.0.1**: Solo border-left, hereda `.card` de theme-polish.css.
- ⚠️ `detectProfession` busca texto en la card para detectar profesión; si la card tiene texto de otra cosa, puede fallar.
- ⚠️ `enhancePOISelects` clona el select nativo en un wrapper; los eventos del select nativo pueden no propagarse correctamente.

**Versión real:** v1.0.1 (2026-05-02)

**Discrepancias con la documentación:**
- El header dice "CORRECCIÓN: solo aplica border-left de color, el resto lo hereda de .card" — coincide con el código.

---

## 📄 `js/achievements.js` (v3.2.0)

**Responsabilidad principal:** Panel de logros enfocado en "próximo a completar". Muestra un grid de logros pendientes con filtros por umbral, categoría, y recompensa. Incluye KPIs de AP, recompensas visibles (items, títulos, maestrías), y toolbar unificada con 3 dropdowns personalizados.

**API pública expuesta:** `window.Achievements`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `render(opts)` — Renderiza el panel
- `onTokenChange()` — Maneja cambio de token

**Dependencias:**
- `window.GW2Api.getItemsMany()` — Metadatos de items de recompensa
- `window.GW2Api.getAccountAchievements()` — Logros de la cuenta
- `window.GW2Api.getAchievementsMeta()` — Metadatos de logros
- `window.__GN__.getSelectedToken()` — Obtener token seleccionado
- `localStorage` — Para caché de recompensas

**Datos que consume:**
- `GW2Api.getAccountAchievements(token)` — Logros de la cuenta
- `GW2Api.getAchievementsMeta(ids)` — Metadatos de logros
- `https://api.guildwars2.com/v2/achievements/categories?ids=all&lang=es` — Categorías de logros
- `https://api.guildwars2.com/v2/titles?id=[id]` — Títulos de recompensa
- `https://api.guildwars2.com/v2/masteries?id=[id]` — Maestrías de recompensa

**Datos que persiste:**
- `ach_kpi_styles` — Estilos de KPIs (injectados)
- `ach-toolbar-styles` — Estilos de toolbar (injectados)
- `ach-aside-styles` — Estilos de aside (injectados)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadAll(opts)` | Carga todos los datos de logros | `{ nocache }` |
| `renderMainGrid()` | Renderiza el grid principal | — |
| `renderKpi(apPerm, apDaily, apLegacyDelta)` | Renderiza KPIs de AP | `apPerm`, `apDaily`, `apLegacyDelta` |
| `computeProgress(accountRec, meta)` | Calcula progreso de un logro | `accountRec`, `meta` |
| `totalAP(meta)` | Calcula AP total de un logro | `meta` |
| `earnedAP(accountRec, meta)` | Calcula AP ganado de un logro | `accountRec`, `meta` |
| `passesFilters(meta, pr, achId)` | Verifica si un logro pasa los filtros | `meta`, `pr`, `achId` |

**Estructura del DOM que manipula:**
- `#achievementsPanel` — Panel principal
- `#achievementsMain` — Grid principal
- `#achKpi` — KPIs de AP
- `#achAsidePanel` — Panel lateral (más cercanos, categorías)
- `.ach-toolbar` — Toolbar con dropdowns
- `.ach-potential` — Chip de AP potenciales

**Eventos que escucha:**
- `gn:tokenchange` — Recarga al cambiar token
- `hashchange` — Recarga al cambiar hash (si está en achievements)
- `change` en filtros — Actualiza grid

**Bugs o problemas detectados:**
- ✅ **v3.2.0**: Grid único de pendientes (sin completados, sin resumen duplicado).
- ⚠️ `loadAll` usa `_loadSeq` para evitar condiciones de carrera, pero no cancela peticiones en vuelo.
- ⚠️ `renderPotentialAP` elimina `.ach-potential` previos pero no verifica si el elemento existe.
- ⚠️ `potentialAPForThreshold` recorre todos los logros cada vez que se renderiza; podría ser costoso con muchas cuentas.

**Versión real:** v3.2.0 (2026-04-28)

**Discrepancias con la documentación:**
- El header dice "Toolbar unificada con 3 dropdowns personalizados (Umbral, Categoría, Recompensa)" — implementado correctamente.
- El header menciona "Recompensas visibles: items, títulos, maestrías con íconos y nombres oficiales" — implementado con `_rewardCache`, `_titleCache`, `_masteryCache`.

---

## 📄 `js/achievements-theme.js` (v1.1.1)

**Responsabilidad principal:** Tema visual para el panel de logros. Aplica un borde izquierdo de color según la categoría del logro (expansiones, modos, etc.), y tintúa el título con ese mismo color.

**API pública expuesta:** Ninguna (autoejecutable)

**Métodos principales:**
- `applyAchTheme(card)` — Aplica tema a una card
- `themeAchNow(root)` — Aplica tema a todas las cards
- `ensureObserver()` — Observa cambios en el DOM

**Dependencias:**
- `theme-polish.css` — Para estilos base de `.card`
- `document` — DOM para manipular cards

**Datos que consume:**
- `.a-card` — Cards de logros
- `.a-desc .ach-badge` — Badge de categoría

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `tintForCategoryName(nameRaw)` | Obtiene color para una categoría | `nameRaw` |
| `readCategoryName(card)` | Lee nombre de categoría de una card | `card` |
| `applyAchTheme(card)` | Aplica tema a una card | `card` |

**Estructura del DOM que manipula:**
- `.a-card, .card.a-card` — Borde izquierdo de color por categoría, título tintado

**Bugs o problemas detectados:**
- ✅ **v1.1.1**: Solo border-left, hereda `.card` de theme-polish.css.
- ⚠️ `tintForCategoryName` usa expresiones regulares para detectar categorías; puede tener falsos positivos.
- ⚠️ `applyAchTheme` usa `card.classList.add('card')` que puede sobrescribir otras clases.

**Versión real:** v1.1.1 (2026-05-02)

**Discrepancias con la documentación:**
- El header dice "solo aplica border-left de color, el resto lo hereda de .card" — coincide con el código.

---

## 📄 `js/meta.js` (v3.3.1)

**Responsabilidad principal:** Panel de MetaEventos. Muestra eventos de mundo (world bosses, meta-events) con horarios UTC, estado (activo/próximo/más tarde), y la posibilidad de marcar "hecho hoy" usando la API de GW2 (worldbosses y mapchests). También incluye favoritos, filtros por tipo/expansión, y compartición de waypoints.

**API pública expuesta:** `window.Meta`

**Métodos principales:**
- `refresh(opts)` — Refresca los datos de eventos
- (interno) `initOnce()` — Inicializa el panel

**Dependencias:**
- `window.__GN__.getSelectedToken()` — Obtener token seleccionado
- `document` — DOM para manipular el panel
- `localStorage` — Para persistencia de favoritos

**Datos que consume:**
- `assets/meta-events.json` — Datos de meta-eventos (seed)
- `assets/meta-drops.json` — Drops destacados por evento
- `https://api.guildwars2.com/v2/account/worldbosses?access_token=...` — Bosses completados hoy
- `https://api.guildwars2.com/v2/account/mapchests?access_token=...` — Cofres completados hoy
- `https://api.guildwars2.com/v2/events?ids=...` — Estado de eventos (Ley Line Anomaly)
- `https://api.guildwars2.com/v2/items?ids=...&lang=es` — Metadatos de items drop

**Datos que persiste:**
- `gw2_meta_favs` — Favoritos (IDs de eventos)
- `gw2_meta_compact` — Preferencia de vista compacta
- `gn_meta_hecho_hoy:{tokenHash}` — Estado "hecho hoy" (deprecado, ahora usa API)
- `gn_meta_favs:{tokenHash}` — Favoritos por token (fallback)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadSeed()` | Carga datos de eventos desde JSON | — |
| `loadExternalDrops()` | Carga drops destacados | — |
| `fetchWorldBosses(token, opts)` | Obtiene bosses completados hoy | `token`, `opts` |
| `fetchMapChests(token, opts)` | Obtiene cofres completados hoy | `token`, `opts` |
| `buildInstance(meta)` | Calcula instancia de un evento | `meta` |
| `cardHTML(meta, inst, item, isFav)` | Genera HTML de una card | `meta`, `inst`, `item`, `isFav` |
| `render()` | Renderiza el panel completo | — |
| `refreshAccountFlags(opts)` | Refresca estado "hecho hoy" | `opts` |

**Estructura del DOM que manipula:**
- `#metaPanel` — Panel principal
- `#metaStatus` — Mensaje de estado
- `#metaLocalTime` — Hora local
- `#metaReset` — Cuenta regresiva a reset
- `#metaList` — Lista de eventos
- `#metaFavBlock` — Bloque de favoritos
- `#metaFavGrid` — Grid de favoritos
- `#metaMiniNext` — Sidebar de próximos eventos
- `#metaFlagsTs` — Timestamp de flags de cuenta

**Eventos que escucha:**
- `gn:tabchange` — Inicializa al cambiar a Meta
- `change`/`input` en filtros — Actualiza lista
- `gn:tokenchange` — Recarga al cambiar token
- `gn:meta-refresh` — Refresca datos

**Eventos que emite:**
- No emite eventos propios.

**Bugs o problemas detectados:**
- ✅ **v3.3.1**: Sin marcado manual (solo API) — eliminado el marcado manual de "hecho hoy".
- ⚠️ `fetchLeyLineActiveMap` cachea la respuesta por 2 minutos; puede mostrar información desactualizada.
- ⚠️ `renderSkeletonMeta` crea skeletons pero no los limpia correctamente al renderizar.
- ⚠️ `computeAllInstances` recalcula todas las instancias en cada render; podría ser costoso.

**Versión real:** v3.3.1 (header no tiene fecha explícita, pero el código dice "v3.3.1 — Sin marcado manual (solo API)")

**Discrepancias con la documentación:**
- El header dice "Sin marcado manual (solo API)" — implementado correctamente.
- El código tiene `// v3.3.1: Marcado manual eliminado. Solo API.` en `isManualEligible()` y `isManualDone()`.

---

## 📄 `js/meta-theme.js` (v1.4.2)

**Responsabilidad principal:** Tema visual para el panel de MetaEventos. Aplica borde izquierdo de color según la expansión/temporada del evento, título tintado, y mejora los horarios con conversión a hora local y resaltado del próximo evento.

**API pública expuesta:** Ninguna (autoejecutable)

**Métodos principales:**
- `applyMetaTheme(card)` — Aplica tema a una card
- `themeMetaNow(root)` — Aplica tema a todas las cards
- `renderMetaClockBar()` — Renderiza barra de horarios
- `applyMetaPolish(root)` — Aplica migraciones visuales

**Dependencias:**
- `theme-polish.css` — Para estilos base de `.card`
- `document` — DOM para manipular cards

**Datos que consume:**
- `.meta-card`, `.m-card` — Cards de meta-eventos
- `.m-win` — Panel de horarios
- `.chip.chip--ghost` — Chips de horarios

**Datos que persiste:**
- No persiste datos.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `getMetaTint(card)` | Obtiene color de expansión de una card | `card` |
| `applyMetaTheme(card)` | Aplica tema a una card | `card` |
| `convertScheduleToLocalTime(card)` | Convierte horarios a hora local | `card` |
| `highlightNextSchedule(card)` | Resalta el próximo horario | `card` |
| `renderMetaClockBar(metaPanel)` | Renderiza barra de horarios | `metaPanel` |

**Estructura del DOM que manipula:**
- `.meta-card`, `.m-card` — Borde izquierdo de color por expansión, título tintado
- `.m-win .chip.chip--ghost` — Horarios convertidos a hora local
- `.m-win__toggle` — Botón de horarios con ícono local

**Bugs o problemas detectados:**
- ✅ **v1.4.2**: Solo border-left, hereda `.card` de theme-polish.css.
- ⚠️ `getMetaTint` usa `getComputedStyle` que puede ser costoso.
- ⚠️ `convertScheduleToLocalTime` modifica el texto de los chips; si el DOM se re-renderiza, los cambios se pierden.

**Versión real:** v1.4.2 (2026-05-02)

**Discrepancias con la documentación:**
- El header dice "solo border-left, hereda .card de theme-polish.css" — coincide con el código.

---

## 📄 `js/activities.js` (v3.19.6)

**Responsabilidad principal:** Panel de Actividades (Objetivos / Home Nodes). Gestiona actividades diarias (PSNA, Ecto, Fractales) y semanales (Llave del León Negro, Piedras Vetustas), con persistencia de estado y detección automática de llave semanal vía personajes Thief.

**API pública expuesta:** `window.Activities`, `window.ActivitiesAPI`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `prefetch(ctx)` — Precarga datos
- `_debug()` — Devuelve estado interno
- `_renderPSNA()` — Renderiza PSNA (debug)
- `_forceReload()` — Recarga PSNA forzadamente

**API expuesta en `ActivitiesAPI`:**
- `getToken()` — Obtiene token actual
- `isActive()` — Verifica si el panel está activo
- `onHomeNodesTabSelected(callback)` — Registra callback para Home Nodes
- `renderHomeNodes(container)` — Renderiza Home Nodes bajo demanda

**Dependencias:**
- `window.__GN__.getSelectedToken()` — Obtener token seleccionado
- `document` — DOM para manipular el panel
- `localStorage` — Para persistencia de estado

**Datos que consume:**
- `assets/data/psna-schedule.json` — Horario de PSNA
- `https://api.guildwars2.com/v2/characters?access_token=...` — Lista de personajes
- `https://api.guildwars2.com/v2/characters/[name]?access_token=...` — Detalle de personaje
- `https://api.guildwars2.com/v2/account/dailycrafting?access_token=...` — Ecto diario
- `https://api.guildwars2.com/v2/items?ids=...&lang=es` — Metadatos de items
- `https://api.guildwars2.com/v2/account?access_token=...` — Información de cuenta

**Datos que persiste:**
- `psna:schedule` — Caché de horario PSNA (TTL diario)
- `psna:lastUpdate` — Última actualización del horario
- `psna:{date}` — Caché diario de PSNA
- `gn_activities_toggles` — Toggles de actividades (diarios/semanales)
- `gn_activities_stones_{tokenHash}_{week}` — Piedras Vetustas por token/semana
- `gn_home_nodes_marked` — Nodos de hogar marcados (por día)
- `gn_activities_toggles` — Toggles de actividades

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadToggles()` | Carga toggles de actividades | — |
| `detectWeeklyKeyFromCharacters(token)` | Detecta llave semanal | `token` |
| `setStones(value)` | Guarda cantidad de piedras vetustas | `value` |
| `setWeeklyKey(value)` | Guarda estado de llave semanal | `value` |
| `loadWeeklyForToken(token)` | Carga datos semanales para un token | `token` |
| `renderPSNA()` | Renderiza PSNA | — |
| `renderEcto()` | Renderiza Ecto | — |
| `renderWeekly()` | Renderiza sección semanal | — |

**Estructura del DOM que manipula:**
- `#activitiesPanel` — Panel principal
- `#psnaGrid` — Grid de PSNA
- `#ectoGrid` — Grid de Ecto
- `#weeklyKeyStatus` — Estado de llave semanal
- `#pillLeivas` — Pill de Leivas
- `#barLeivas` — Barra de progreso de Leivas
- `#fractalsBody` — Contenedor de Fractales
- `#actDaily` / `#actWeekly` — Tabs diario/semanal

**Eventos que escucha:**
- `gn:global-refresh` — Refresca todas las actividades
- `gn:tokenchange` — Recarga al cambiar token
- `click` en `#actTabDaily` / `#actTabWeekly` — Cambia de tab
- `click` en `#assMinus` / `#assPlus` — Ajusta Leivas
- `click` en `#psnaCopyAll` — Copia todos los waypoints

**Eventos que emite:**
- `gn:render-home-nodes` — Solicita renderizado de Home Nodes

**Bugs o problemas detectados:**
- ✅ **v3.19.6**: Creada función síncrona `hashToken16Sync()` para evitar Promesas como claves.
- ✅ **v3.19.6**: Persistencia independiente de piedras en localStorage con clave `gn_activities_stones_{hash}_{week}`.
- ⚠️ `loadHomeNodesOnDemand` espera que `window.ActivitiesTheme.renderHomeNodes` esté disponible; si no lo está, muestra un mensaje de error.
- ⚠️ `detectWeeklyKeyFromCharacters` carga todos los personajes cada vez; podría ser costoso con muchas cuentas.

**Versión real:** v3.19.6 (2026-04-05)

**Discrepancias con la documentación:**
- El header dice "Persistencia robusta de Piedras Vetustas (sin Promesas como claves)" — implementado correctamente.
- La función `cleanActivitiesCache` limpia solo cachés de Activities, pero `cleanAchievementsCache` limpia cachés de logros.

---

## 📄 `js/activities-theme.js` (v2.6.0)

**Responsabilidad principal:** Migración visual de Activities a componentes canónicos (estilo Purchase Detail). Renderiza Home Nodes bajo demanda (solo cuando se activa la pestaña), con filtros por categoría (API/Janthir/Contratos) y estado (desbloqueado/bloqueado/todos).

**API pública expuesta:** `window.ActivitiesTheme`

**Métodos principales:**
- `renderHomeNodes(container)` — Renderiza Home Nodes en un contenedor
- (interno) `applyActivitiesTheme()` — Aplica mejoras visuales al panel

**Dependencias:**
- `window.ActivitiesAPI.getToken()` — Obtener token actual
- `document` — DOM para manipular el panel
- `localStorage` — Para persistencia de nodos marcados

**Datos que consume:**
- `https://api.guildwars2.com/v2/account/home/nodes?access_token=...` — Nodos desbloqueados
- `https://api.guildwars2.com/v2/items?ids=...&lang=es` — Metadatos de nodos

**Datos que persiste:**
- `gn_home_nodes_marked` — Nodos marcados por día `{ "2026-05-04": { "node_id": true } }`

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `renderHomeNodesInContainer(container)` | Renderiza Home Nodes | `container` |
| `fetchUnlockedNodes(token)` | Obtiene nodos desbloqueados | `token` |
| `fetchNodeItems(itemIds)` | Obtiene metadatos de nodos | `itemIds` |
| `applyFiltersAndRender()` | Aplica filtros y renderiza | — |
| `renderNodeGrid(filteredNodes)` | Renderiza grid de nodos | `filteredNodes` |

**Estructura del DOM que manipula:**
- `#actWeekly` — Contenedor de la pestaña semanal
- `#homeNodesContainer` — Contenedor de Home Nodes
- `#homeNodesGrid` — Grid de nodos
- `#homeNodesCounter` — Contador de nodos recolectados
- `.gw-node` — Card de nodo individual

**Eventos que escucha:**
- `gn:render-home-nodes` — Renderiza Home Nodes bajo demanda
- `gn:tabchange` — Aplica mejoras visuales
- `gn:tokenchange` — Marca para recarga
- `input` en `#homeNodesSearch` — Filtra nodos
- `click` en `.filter-category-btn` — Filtra por categoría
- `click` en `.filter-type-btn` — Filtra por tipo
- `click` en `.filter-status-btn` — Filtra por estado
- `change` en `.node-checkbox` — Marca nodo como recolectado

**Bugs o problemas detectados:**
- ✅ **v2.6.0**: Home Nodes aislado en su propia pestaña.
- ✅ **v2.6.0**: Renderizado bajo demanda (solo cuando se activa la pestaña).
- ⚠️ `renderHomeNodesInContainer` no maneja errores de red correctamente.
- ⚠️ `loadMarkedNodes` guarda marcados por día; los marcados de días anteriores se pierden.

**Versión real:** v2.6.0 (2026-03-23)

**Discrepancias con la documentación:**
- El header dice "Home Nodes aislado en su propia pestaña" — implementado correctamente.
- El header dice "Renderizado bajo demanda (solo cuando se activa la pestaña Home Nodes)" — implementado correctamente.

---

## 📄 `js/converter-modal.js` (v1.0.0)

**Responsabilidad principal:** Conversor Gem ↔ Gold en modal con cache de 30 minutos. Muestra el precio de 400 gemas como referencia, con un índice de conveniencia que evalúa si es buen momento para comprar gemas. Incluye tabs placeholder para Ofertas (ítems populares) y Transacciones (órdenes activas).

**API pública expuesta:** `window.ConverterModal`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `open()` — Abre el modal
- `close()` — Cierra el modal
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.GW2Api.getCommerceListings()` — Listado de IDs del TP
- `window.GW2Api.getCommercePrices()` — Precios del TP
- `window.GW2Api.getItemsMany()` — Metadatos de items
- `window.GW2Api.getTokenInfo()` — Información de token
- `localStorage` — Para caché de conversión y preferencias

**Datos que consume:**
- `https://api.guildwars2.com/v2/commerce/exchange/coins?quantity=...` — Conversión coins→gems
- `https://api.guildwars2.com/v2/commerce/exchange/gems?quantity=...` — Conversión gems→coins
- `GW2Api.getCommerceListings()` — IDs de items del TP
- `GW2Api.getCommercePrices(ids)` — Precios de items
- `GW2Api.getItemsMany(ids)` — Metadatos de items

**Datos que persiste:**
- `gw2_conv_cache_v3` — Caché de conversiones coins↔gems (TTL 30 min)
- `gw2_selected_key_v1` — Token seleccionado (para transacciones)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `gemsForCoins(copper)` | Obtiene gemas por monedas | `copper` |
| `coinsForGems(gems)` | Obtiene monedas por gemas | `gems` |
| `costToBuyGems_coinsMarket(targetGems)` | Costo en monedas para comprar gemas | `targetGems` |
| `gemsToBuyGold_gemsMarket(targetCopper)` | Gemas para comprar oro | `targetCopper` |
| `scoreFromPrice400(priceGold)` | Índice de conveniencia para 400 gemas | `priceGold` |
| `loadOfertas(forceNoCache)` | Carga ítems populares del TP | `forceNoCache` |
| `loadTransacciones(forceNoCache)` | Carga órdenes activas del usuario | `forceNoCache` |

**Estructura del DOM que manipula:**
- `#convModal` — Modal principal
- `#cvGems` / `#cvGold` — Inputs de conversión
- `#cvGemsOut` / `#cvGoldOut` — Outputs de conversión
- `#cvRef400` — Precio de referencia de 400 gemas
- `#cvScoreBar` / `#cvScoreLabel` / `#cvScoreHint` — Índice de conveniencia
- `#cvState` — Mensaje de estado

**Eventos que escucha:**
- `input` en `#cvGems` / `#cvGold` — Convierte divisas
- `click` en `#cvRefresh` — Actualiza cotización
- `click` en `[data-gems]` / `[data-gold]` — Atajos rápidos
- `click` en `.conv-modal-tab` — Cambia de tab
- `click` en `#cvOfertasRetry` / `#cvTransaccionesRetry` — Reintenta carga
- `change` en `#cvOfertasRarity` / `#cvOfertasVolume` — Filtra ofertas
- `change` en `#cvTransaccionesType` — Filtra transacciones

**Bugs o problemas detectados:**
- ✅ **v1.0.0**: Extraído de app.js, conversor funcional con tabs placeholder.
- ⚠️ `hasTradingPostPermission` cachea permisos por 5 minutos; si el token se modifica, no se actualiza.
- ⚠️ `loadOfertas` toma solo los últimos 200 IDs del TP; puede perderse items populares.
- ⚠️ `loadTransacciones` usa `GW2Api.getCommerceTransactionsBuys` y `Sells` pero no verifica si el token tiene el permiso `tradingpost`.

**Versión real:** v1.0.0 (2026-05-04)

**Discrepancias con la documentación:**
- El header dice "Fase 1: Conversor funcional completo + tabs placeholder" — implementado correctamente.
- El header dice "Fase 2 (futura): Tab 'Ofertas' con Compañía de Comercio" — parcialmente implementado (muestra ítems populares).
- El header dice "Fase 3 (futura): Tab 'Historial' con tendencia de gemas" — solo placeholder.

---

## 📄 `js/accounts-panel.js` (v2.0.0)

**Responsabilidad principal:** Panel de Cuentas con cifrado local AES. Permite cargar archivos `.enc` cifrados con contraseña, y visualizar las cuentas en formato "Profile Card" premium con 3 zonas (header, credenciales grid, footer). Incluye asistente para crear archivos cifrados desde Excel y enriquecer con API de GW2.

**API pública expuesta:** `window.Accounts`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `CryptoJS` — Para cifrado/descifrado AES (requiere `crypto-js` global)
- `XLSX` — Para lectura/escritura de Excel (requiere `xlsx` global)
- `window.__GN__.getSelectedToken()` — Obtener token seleccionado
- `localStorage` — Para persistencia de último archivo

**Datos que consume:**
- Archivo `.enc` — Datos cifrados de cuentas
- `https://api.guildwars2.com/v2/account?access_token=...` — Información de cuenta
- `https://api.guildwars2.com/v2/account/home/nodes?access_token=...` — Nodos de hogar
- `assets/data/psna-schedule.json` — Horario de PSNA (para enriquecer)

**Datos que persiste:**
- `accounts:lastFile` — Último archivo cargado `{ name, data, timestamp }`
- `gw2_keys` — Lista de API keys (se actualiza al sincronizar tags)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadAndDecryptFile(file, password)` | Descifra archivo .enc | `file`, `password` |
| `loadFromFile(file, password, rememberFile)` | Carga y descifra archivo | `file`, `password`, `rememberFile` |
| `loadFromStoredFile(password)` | Carga último archivo guardado | `password` |
| `renderAccountCard(acc)` | Renderiza card de cuenta | `acc` |
| `syncAccountTagsToKeys(accounts)` | Sincroniza tags con localStorage | `accounts` |
| `getFilteredAccounts()` | Filtra cuentas según filtros | — |

**Estructura del DOM que manipula:**
- `#accountsPanel` — Panel principal
- `#accountsList` — Grid de cuentas
- `#accountsStats` — Estadísticas de cuentas
- `#accountsFilters` — Filtros (búsqueda, tipo, tag)
- `#accountsWizardModal` — Modal del asistente

**Eventos que escucha:**
- `click` en `#accountsFileButton` — Selecciona archivo .enc
- `click` en `#accountsLoadBtn` — Carga archivo
- `click` en `#openWizardBtn` — Abre asistente
- `click` en `.toggle-password` — Muestra/oculta contraseña
- `click` en `[data-toggle-section]` — Colapsa/expande sección
- `click` en `[data-copy]` / `[data-copy-btn]` — Copia al portapapeles

**Bugs o problemas detectados:**
- ⚠️ `loadFromStoredFile` usa `syncAccountTagsToKeys` que puede sobrescribir tags locales.
- ⚠️ `parseExcelToJSON` espera un formato específico de Excel; si el archivo no tiene las columnas correctas, falla.
- ⚠️ `enrichWithGW2API` solo enriquece con algunas expansiones; no maneja todas las expansiones.
- ⚠️ `renderAccountCard` usa `DECORATIVE_ICONS` aleatorios; el ícono de una cuenta puede cambiar entre renders.

**Versión real:** v2.0.0 (2026-05-03)

**Discrepancias con la documentación:**
- El header dice "Rediseño 'Profile Card' premium" — implementado correctamente.
- El header dice "Expansiones siempre visibles con barra de progreso" — implementado correctamente.

---

## 📄 `js/settings-manager.js` (v1.0.2)

**Responsabilidad principal:** Gestión de exportación/importación de configuración. Permite exportar e importar toda la configuración de la app (API Keys, WV, Wallet, Activities, Characters, Meta, global) en un archivo JSON. También se usa para sincronización con GitHub Gist.

**API pública expuesta:** `window.SettingsManager`

**Métodos principales:**
- `init()` — Inicializa el módulo
- `exportAll()` — Exporta toda la configuración (descarga)
- `exportData()` — Exporta datos a objeto (para Gist)
- `importAll()` — Importa configuración desde archivo
- `importFromFile(file)` — Importa desde archivo
- `importFromData(data)` — Importa desde objeto (para Gist)
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.Analytics` — Para eventos de exportación/importación (opcional)
- `localStorage` — Para leer/escribir configuración

**Datos que consume:**
- `localStorage:gw2_keys` — API Keys
- `localStorage:gw2_selected_key_v1` — Key seleccionada
- `localStorage:wv:season:index` — Índice de temporadas WV
- `localStorage:wv:season:*` — Datos de temporadas WV
- `localStorage:walletCompact` — Preferencia de vista compacta
- `localStorage:walletPins:*` — Pins de Wallet
- `localStorage:walletSnapshot:*` — Snapshots de Wallet
- `localStorage:gn_activities_toggles` — Toggles de Activities
- `localStorage:gn_home_nodes_marked` — Nodos de hogar marcados
- `localStorage:characters:assignments:*` — Asignaciones de POIs
- `localStorage:characters:location_history:*` — Historial de ubicaciones
- `localStorage:gn_meta_favs:*` — Favoritos de Meta
- `localStorage:gn_welcome_seen` — Estado de bienvenida

**Datos que persiste:**
- Todos los datos que consume (se sobrescriben al importar)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `exportApiKeys()` | Exporta API Keys | — |
| `exportWVData()` | Exporta datos de WV | — |
| `exportWalletData()` | Exporta datos de Wallet | — |
| `exportActivitiesData()` | Exporta datos de Activities | — |
| `exportCharactersData()` | Exporta datos de Characters | — |
| `exportMetaData()` | Exporta datos de Meta | — |
| `exportGlobalData()` | Exporta datos globales | — |
| `validateImportData(data)` | Valida estructura del import | `data` |
| `importFromData(importData)` | Importa desde objeto | `importData` |

**Bugs o problemas detectados:**
- ✅ **v1.0.2**: Agregados métodos `exportData()` e `importFromData()` para Gist sync.
- ⚠️ `exportAll` usa `Analytics.exportBackup()` pero no verifica que Analytics esté definido.
- ⚠️ `importAll` usa `confirm()` que puede ser bloqueante en algunos navegadores.
- ⚠️ `validateImportData` solo verifica `version`, `app`; no valida la estructura de los datos.

**Versión real:** v1.0.2 (2026-03-28)

**Discrepancias con la documentación:**
- El header dice "v1.0.2: Agregados métodos exportData() e importFromData() para sincronización con GitHub Gist" — implementado correctamente.

---

## 📄 `js/gist-sync.js` (v1.0.0)

**Responsabilidad principal:** Sincronización con GitHub Gist. Permite subir y descargar la configuración de la app desde/ hacia un Gist privado en GitHub, usando un token personal con permisos 'gist'. El token se almacena cifrado en localStorage.

**API pública expuesta:** `window.GistSync`

**Métodos principales:**
- `init()` — Inicializa el módulo
- `setupToken(token, createGistIfNeeded)` — Configura token de GitHub
- `uploadConfig()` — Sube la configuración al Gist
- `downloadAndSync()` — Descarga y aplica la configuración
- `getStatus()` — Obtiene estado de sincronización
- `clearSync()` — Elimina configuración de sincronización
- `verifyToken()` — Verifica validez del token

**Dependencias:**
- `window.SettingsManager.exportData()` — Exporta configuración
- `window.SettingsManager.importFromData()` — Importa configuración
- `CryptoJS` — Para cifrado/descifrado del token (requiere `crypto-js` global)
- `localStorage` — Para persistencia de token y Gist ID

**Datos que consume:**
- `localStorage:gh_token_encrypted` — Token de GitHub cifrado
- `localStorage:gh_gist_id` — ID del Gist
- `https://api.github.com/user` — Verifica token
- `https://api.github.com/gists` — Crea/obtiene/actualiza Gist

**Datos que persiste:**
- `gh_token_encrypted` — Token de GitHub cifrado
- `gh_gist_id` — ID del Gist

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `encryptToken(token, password)` | Cifra token de GitHub | `token`, `password` |
| `decryptToken(encrypted)` | Descifra token de GitHub | `encrypted` |
| `setupToken(token, createGistIfNeeded)` | Configura token y Gist | `token`, `createGistIfNeeded` |
| `uploadConfig()` | Sube configuración al Gist | — |
| `downloadAndSync()` | Descarga y sincroniza | — |

**Bugs o problemas detectados:**
- ⚠️ `encryptToken` usa una contraseña fija (`gw2-vault-sync-2026`); la seguridad es limitada.
- ⚠️ `downloadAndSync` usa `confirm()` para confirmar la sobrescritura; podría ser bloqueante.
- ⚠️ `setupToken` verifica el token antes de guardarlo; si el token es válido pero no tiene permiso 'gist', falla.

**Versión real:** v1.0.0 (2026-03-28)

**Discrepancias con la documentación:**
- El header dice "El token se almacena cifrado en localStorage." — implementado correctamente.
- El header dice "Requiere token personal de GitHub con permisos 'gist'." — verificado en `setupToken`.

---

## 📄 `js/welcome-panel.js` (v1.4.0)

**Responsabilidad principal:** Pantalla de bienvenida de la app. Muestra una introducción a las funcionalidades, acceso rápido a los módulos principales, gestión de API Keys, y acceso al asistente de cuentas. También incluye enlaces a redes sociales y opciones de apoyo al proyecto.

**API pública expuesta:** `window.Welcome`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `document` — DOM para manipular el panel
- `window` — Para navegación vía `location.hash`

**Datos que consume:**
- `localStorage` — No persiste datos propios
- `#keysModal` — Modal de API Keys (de app.js)

**Datos que persiste:**
- No persiste datos propios.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `render()` | Renderiza el panel de bienvenida | — |
| `ensurePanel()` | Asegura que el panel exista en el DOM | — |
| `activate()` / `deactivate()` | Ciclo de vida | — |

**Estructura del DOM que manipula:**
- `#welcomePanel` — Panel principal
- `#welcomeAddKeyBtn` — Botón de agregar API Key
- `#welcomeManageKeysBtn` — Botón de gestionar Keys
- `#welcomeAccountsBtn` — Botón de ir al Asistente de Cuentas

**Eventos que escucha:**
- `click` en `#welcomeAddKeyBtn` / `#welcomeManageKeysBtn` — Abre modal de Keys
- `click` en `#welcomeAccountsBtn` — Navega a Cuentas
- `click` en `#welcomeGuideBtn` (si existe) — Abre guía de usuario

**Bugs o problemas detectados:**
- ✅ **v1.4.0**: Agregado Inventario y Personajes en funcionalidades y acceso rápido.
- ⚠️ `ensureModalCloses` se llama cada vez que se abre el modal de Keys; puede crear múltiples listeners.
- ⚠️ `render()` usa `onclick` en lugar de `addEventListener` para algunos botones.

**Versión real:** v1.4.0 (2026-05-04)

**Discrepancias con la documentación:**
- El header dice "Agregado Inventario y Personajes en funcionalidades y acceso rápido" — implementado correctamente.
- El header dice "Rediseño completo de todas las secciones con tarjetas y glows" — implementado correctamente.

---

## 📄 `js/raid-tracker.js` (v1.7.0)

**Responsabilidad principal:** Seguimiento de Raids Semanales. Muestra las 8 alas de raids con sus encuentros, el progreso semanal (completado/pendiente), y un modal de detalle con descripción, estrategia, recompensas y enlaces a Wiki. Incluye KPIs de encuentros completados y LI farmeados.

**API pública expuesta:** `window.RaidTracker`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `prefetch(ctx)` — Precarga datos
- `refresh(forceNoCache)` — Recarga datos
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.GW2Api.getAccountRaids()` — Encuentros completados
- `window.GW2Api.getAccountWallet()` — Para LI disponibles
- `document` — DOM para manipular el panel

**Datos que consume:**
- `GW2Api.getAccountRaids(token)` — Encuentros completados
- `GW2Api.getAccountWallet(token)` — LI disponibles (ID 70)

**Datos que persiste:**
- No persiste datos propios.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadRaidData(forceNoCache)` | Carga datos de raids | `forceNoCache` |
| `renderWingsGrid(completedEncounters)` | Renderiza grid de alas | `completedEncounters` |
| `renderKPIs(completedCount, totalCount, liEarned, liTotal)` | Renderiza KPIs | — |
| `openBossModal(encounterId, encounterName)` | Abre modal de detalle de jefe | `encounterId`, `encounterName` |
| `renderRewardsList(encounterId, bossName)` | Renderiza recompensas de un jefe | `encounterId`, `bossName` |

**Estructura del DOM que manipula:**
- `#raidTrackerPanel` — Panel principal
- `#raidKPIs` — KPIs
- `#raidWingsGrid` — Grid de alas
- `#raidBossModal` — Modal de detalle de jefe
- `#raidUtcTime` / `#raidLocalTime` — Relojes UTC/local
- `#raidDailyReset` / `#raidWeeklyReset` — Cuentas regresivas

**Eventos que escucha:**
- `gn:tokenchange` — Recarga al cambiar token
- `click` en `.raid-encounter-detail-btn` — Abre modal de detalle
- `click` en `#viewRaidsBtn` / `#viewStrikesBtn` — Cambia entre Raids y Strikes

**Bugs o problemas detectados:**
- ✅ **v1.7.0**: Modal con tabs funcionando + LI disponibles (ID 70).
- ⚠️ `WINGS` contiene datos estáticos de todas las alas; no se actualiza automáticamente si se agregan nuevas alas.
- ⚠️ `renderWingsGrid` usa `createSafeIcon` con fallback a emoji si la imagen no carga.
- ⚠️ `loadRaidData` usa `root.GW2Api.getAccountRaids` pero no verifica si `root.GW2Api` existe.

**Versión real:** v1.7.0 (2026-04-23)

**Discrepancias con la documentación:**
- El header dice "Modal con tabs funcionando + LI disponibles (ID 70)" — implementado correctamente.
- El header dice "drops especiales por jefe (Mochilas, Infusiones, Miniaturas)" — implementado en `getSpecialDrops`.

---

## 📄 `js/strike-tracker.js` (v1.0.0)

**Responsabilidad principal:** Seguimiento de Strike Missions. Muestra las strikes organizadas por expansión (Core, Icebrood Saga, End of Dragons, Secrets of the Obscure, Visions of Eternity), con progreso semanal y modal de detalle similar a RaidTracker.

**API pública expuesta:** `window.StrikeTracker`

**Métodos principales:**
- `initOnce()` — Inicializa el módulo
- `activate()` / `deactivate()` — Ciclo de vida
- `prefetch(ctx)` — Precarga datos
- `refresh(forceNoCache)` — Recarga datos
- `_debug()` — Devuelve estado interno

**Dependencias:**
- `window.GW2Api.getAccountRaids()` — Encuentros completados (mismo endpoint que raids)
- `document` — DOM para manipular el panel

**Datos que consume:**
- `GW2Api.getAccountRaids(token)` — Encuentros completados

**Datos que persiste:**
- No persiste datos propios.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `loadStrikeData(forceNoCache)` | Carga datos de strikes | `forceNoCache` |
| `renderStrikesGrid(completedEncounters)` | Renderiza grid de strikes | `completedEncounters` |
| `renderKPIs(completedCount, totalCount, liEarned, liTotal)` | Renderiza KPIs | — |
| `openStrikeModal(strikeId, strikeName)` | Abre modal de detalle | `strikeId`, `strikeName` |
| `renderRewardsList(encounterId)` | Renderiza recompensas de una strike | `encounterId` |

**Estructura del DOM que manipula:**
- `#strikeTrackerPanel` — Panel principal
- `#strikeKPIs` — KPIs
- `#strikesGrid` — Grid de strikes
- `#strikeModal` — Modal de detalle

**Eventos que escucha:**
- `gn:tokenchange` — Recarga al cambiar token
- `click` en `.strike-detail-btn` — Abre modal de detalle

**Bugs o problemas detectados:**
- ⚠️ `STRIKES_BY_EXPANSION` contiene `mount_balrior` con `li: 0` y nota "Ya está en Raids como ala completa" — se excluye del grid.
- ⚠️ `loadStrikeData` filtra `completed` para incluir solo IDs de strikes; si la API devuelve IDs que no están en la lista, se ignoran.
- ⚠️ `renderStrikesGrid` usa un grid de 3 columnas fijas que puede no adaptarse bien a pantallas pequeñas.

**Versión real:** v1.0.0 (2026-06-03)

**Discrepancias con la documentación:**
- El header dice "Dependencias: GW2Api.getAccountRaids() (mismo endpoint que raids)" — implementado correctamente.
- La versión declarada (v1.0.0) coincide con la fecha (2026-06-03).

---

## 📄 `js/sidebar-nav.js` (v1.2)

**Responsabilidad principal:** Navegación lateral (sidebar). Resalta el enlace activo según el hash de la URL, muestra el ID de cuenta en el header (vía API de GW2), y escucha cambios de token para actualizar el ID. Es el componente que maneja la navegación principal de la app.

**API pública expuesta:** Ninguna (autoejecutable)

**Métodos principales:**
- `syncActiveFromHash()` — Resalta enlace según hash
- `updateAccountId()` — Actualiza ID de cuenta en el header
- (interno) `applyActiveLocally(hash)` — Fallback para resaltado

**Dependencias:**
- `window` — Para `location.hash` y `fetch`
- `document` — DOM para manipular navegación
- `#keySelectGlobal` — Selector de API Key

**Datos que consume:**
- `https://api.guildwars2.com/v2/account?access_token=...` — Información de cuenta (nombre)
- `#keySelectGlobal` — Token seleccionado

**Datos que persiste:**
- No persiste datos propios.

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `applyActiveLocally(hash)` | Resalta enlace según hash | `hash` |
| `syncActiveFromHash()` | Sincroniza resaltado con hash actual | — |
| `updateAccountId()` | Actualiza ID de cuenta en header | — |

**Estructura del DOM que manipula:**
- `.side-nav a` — Agrega/elimina clase `is-active` y `aria-current`
- `#accountIdLabel` — Muestra el nombre de la cuenta

**Eventos que escucha:**
- `hashchange` — Actualiza resaltado
- `change` en `#keySelectGlobal` — Actualiza ID de cuenta
- `gn:tokenchange` — Actualiza ID de cuenta
- `DOMContentLoaded` — Inicializa resaltado y ID

**Eventos que emite:**
- No emite eventos propios.

**Bugs o problemas detectados:**
- ⚠️ `syncActiveFromHash` verifica si hay un link activo del router antes de aplicar fallback; esto puede causar conflictos si el router y sidebar-nav aplican clases diferentes.
- ⚠️ `updateAccountId` cancela peticiones previas con `acctCtrl.abort()`, pero no maneja el caso de que la petición sea abortada por el navegador.
- ⚠️ `updateAccountId` no maneja errores de red correctamente; muestra `—` si falla.

**Versión real:** v1.2 (sin fecha en header)

**Discrepancias con la documentación:**
- El header dice "router‑friendly + tokenchange + a11y" — implementado correctamente.
- El header dice "ID de cuenta (header chip)" — implementado correctamente.

---

## 📄 `js/analytics.js` (v1.0.0)

**Responsabilidad principal:** Eventos personalizados para Google Analytics (gtag). Proporciona una API para enviar eventos de usuario (vistas de módulos, acciones de backup, asistente, WV, API Keys) sin romper si gtag no está cargado.

**API pública expuesta:** `window.Analytics`

**Métodos principales:**
- `viewModule(moduleName)` — Registra vista de módulo
- `exportBackup()` — Exportación de backup
- `importBackup()` — Importación de backup
- `openAccountWizard()` — Apertura de asistente de cuentas
- `downloadExcelTemplate()` — Descarga de plantilla Excel
- `enrichWithAPI()` — Enriquecimiento con API
- `encryptAccountsFile()` — Cifrado de archivo de cuentas
- `forceReloadSeason()` — Recarga forzada de temporada WV
- `openApiKeysModal()` — Apertura de modal de API Keys
- `addApiKey()` — Adición de API Key
- `deleteApiKey()` — Eliminación de API Key

**Dependencias:**
- `window.gtag` — Google Analytics (opcional)
- `window` — Para cola de eventos pendientes

**Datos que consume:**
- No consume datos de API.

**Datos que persiste:**
- `__gaQueue` — Cola de eventos pendientes (en memoria)

**Funciones clave:**

| Función | Propósito | Parámetros importantes |
|---------|-----------|----------------------|
| `sendEvent(eventName, eventParams)` | Envía evento a gtag | `eventName`, `eventParams` |
| `processQueue()` | Procesa cola de eventos pendientes | — |

**Bugs o problemas detectados:**
- ⚠️ `sendEvent` usa `console.debug` que puede no estar disponible en todos los navegadores.
- ⚠️ `processQueue` se ejecuta en `DOMContentLoaded`, pero si gtag se carga después, no se vuelve a ejecutar.
- ⚠️ No hay verificación de que `gtag` esté definido antes de enviar eventos.

**Versión real:** v1.0.0 (sin fecha en header)

**Discrepancias con la documentación:**
- El header dice "Versión: 1.0.0" — coincide con el código.
- El header dice "Extraído de app.js para independizar el conversor" — el archivo es independiente.

---

## 🔍 Hallazgos transversales

### 1. Inconsistencias en la gestión de errores
- Muchos módulos usan `console.warn` para errores, pero no siempre muestran feedback visual al usuario.
- Algunos módulos usan `window.toast` (cuando está disponible), otros usan `alert` o `confirm`.
- No hay un sistema unificado de manejo de errores (ej: un servicio de notificaciones centralizado).

### 2. Caché y persistencia dispersa
- Cada módulo maneja su propia caché con diferentes TTLs y formatos.
- `localStorage` se usa extensivamente pero sin un prefijo consistente (`gw2_`, `gn_`, `wv:`, `characters:`).
- No hay un mecanismo centralizado para invalidar caché al cambiar de token.

### 3. Dependencias circulares
- `wv-purchase-detail.js` depende de `window.WV` y `window.WVSeasonStore`; `wv-shop-ui.js` también depende de `window.WV`.
- `inventory-hub.js` depende de `window.Characters.getCharacterList()`; `characters.js` es independiente.
- `achievements.js` depende de `window.GW2Api` pero también usa `window.__GN__.getSelectedToken()`.

### 4. Código duplicado
- **Iconos de cuenta**: `wallet-dashboard.js`, `inventory-dashboard.js`, `wv-objectives-dashboard.js` tienen funciones `getAccountIcon` similares.
- **Formato de monedas**: `wallet-dashboard.js`, `inventory-dashboard.js`, `converter-modal.js`, `wv-purchase-detail.js` tienen funciones `formatCoinValue`/`formatCoins` similares.
- **Escapado de HTML**: Todos los módulos tienen su propia función `esc()`.
- **Selectores DOM**: Todos los módulos tienen su propia función `$`/`$$`.

### 5. Problemas de rendimiento
- `meta.js` recalcula todas las instancias en cada render (`computeAllInstances`).
- `achievements.js` recorre todos los logros para calcular AP potenciales (`potentialAPForThreshold`).
- `characters.js` carga personajes en batches de 3, pero no hay límite de tiempo global.
- `wv-purchase-detail.js` carga todas las cuentas en paralelo con `MAX=2`, lo cual es lento con muchas cuentas.

### 6. Inconsistencias en la API de temas
- `wallet-theme.js`, `meta-theme.js`, `achievements-theme.js`, `characters-theme.js`, `wv-theme.js` aplican estilos similares pero con lógica diferente.
- No hay un tema base consistente; cada módulo tiene su propia lógica de detección de color.
- `theme-polish.css` define `.card` pero no todos los módulos la usan correctamente.

### 7. Problemas de seguridad
- `gist-sync.js` usa una contraseña fija para cifrar el token de GitHub.
- `accounts-panel.js` usa `CryptoJS.AES` con la contraseña del usuario, lo cual es seguro, pero no hay validación de fuerza de contraseña.
- El token de API de GW2 se almacena en localStorage en texto plano (en `gw2_keys`).

### 8. Dependencias externas no verificadas
- `accounts-panel.js` depende de `CryptoJS` y `XLSX` pero no verifica que estén cargados.
- `converter-modal.js` depende de `root.GW2Api` pero no verifica que exista.
- `analytics.js` depende de `window.gtag` pero no verifica que esté cargado.

### 9. Eventos CustomEvent sin documentación
- `gn:tokenchange` — Cambio de token
- `gn:tabchange` — Cambio de tab
- `gn:global-refresh` — Refresco global
- `gn:meta-refresh` — Refresco de Meta
- `gn:render-home-nodes` — Renderizado de Home Nodes
- `wv:season-store:mutate` — Mutación del store de WV
- `wv:season:reloaded` — Recarga de temporada WV
- `characters:*` — Eventos de Characters (load, progress, complete, etc.)

### 10. Código muerto / deprecado
- `activities.js` tiene `cleanAchievementsCache` que limpia cachés de logros pero no se usa.
- `meta.js` tiene funciones `isManualEligible`, `isManualDone`, `toggleManual` que están vacías (marcado manual eliminado en v3.3.1).
- `sidebar-nav.js` tiene un listener `gn:nav-active` que es no-op.

---

## 📊 Índice de versiones reales

| Archivo | Versión declarada en header | Fecha |
|---------|----------------------------|-------|
| `js/wizards-vault.js` | v1.3.0 | 2026-03-30 |
| `js/wv-season-storage.js` | v1.1.1 | 2026-03-09 |
| `js/wv-shop-ui.js` | v1.0.2 | 2026-05-02 |
| `js/wv-objectives-ui.js` | v1.0.0 | 2026-05-01 |
| `js/wv-objectives-dashboard.js` | v1.0.0 | 2026-05-15 |
| `js/wv-purchase-detail.js` | v1.13.1 | 2026-04-05 |
| `js/wv-tabs-skin.js` | v1.0.0 | 2026-03-04 |
| `js/wv-theme.js` | v1.0.1 | 2026-05-02 |
| `js/wallet-dashboard.js` | v2.5.0 | 2026-04-08 |
| `js/wallet-theme.js` | v1.3.0 | 2026-03-21 |
| `js/inventory-hub.js` | v1.3.1 | 2026-05-03 |
| `js/inventory-dashboard.js` | v1.0.0 | 2026-05-07 |
| `js/characters.js` | v2.3.0 | 2026-03-24 |
| `js/characters-theme.js` | v1.0.1 | 2026-05-02 |
| `js/achievements.js` | v3.2.0 | 2026-04-28 |
| `js/achievements-theme.js` | v1.1.1 | 2026-05-02 |
| `js/meta.js` | v3.3.1 | — |
| `js/meta-theme.js` | v1.4.2 | 2026-05-02 |
| `js/activities.js` | v3.19.6 | 2026-04-05 |
| `js/activities-theme.js` | v2.6.0 | 2026-03-23 |
| `js/converter-modal.js` | v1.0.0 | 2026-05-04 |
| `js/accounts-panel.js` | v2.0.0 | 2026-05-03 |
| `js/settings-manager.js` | v1.0.2 | 2026-03-28 |
| `js/gist-sync.js` | v1.0.0 | 2026-03-28 |
| `js/welcome-panel.js` | v1.4.0 | 2026-05-04 |
| `js/raid-tracker.js` | v1.7.0 | 2026-04-23 |
| `js/strike-tracker.js` | v1.0.0 | 2026-06-03 |
| `js/sidebar-nav.js` | v1.2 | — |
| `js/analytics.js` | v1.0.0 | — |

---

## 📋 Tabla de localStorage keys consolidada

| Clave | Tipo | Usada por | Propósito |
|-------|------|-----------|-----------|
| `gw2_keys` | JSON Array | Todos | Lista de API Keys `[{ label, value, tag }]` |
| `gw2_selected_key_v1` | String | Todos | Token seleccionado actualmente |
| `accounts:lastFile` | JSON | Accounts | Último archivo .enc cargado |
| `gw2_wv_pinned_v1` | JSON | WV (legacy) | Pins de WV (legacy, migrado a WVSeasonStore) |
| `gw2_wv_marks_v1` | JSON | WV (legacy) | Marcas manuales de WV (legacy, migrado) |
| `wv:season:index` | JSON | WVSeasonStore | Índice de temporadas WV |
| `wv:season:current` | JSON | WVSeasonStore | Archivo único en single-season |
| `wv:season:YY:SEQ` | JSON | WVSeasonStore | Archivos por temporada |
| `gw2_wv_view_v1` | String | WVShopUI | Preferencia de vista (`cards`/`table`) |
| `gw2_wv_legacy_filter_v1` | String | WVShopUI | Preferencia de filtro legado (`show`/`hide`) |
| `wvpd_open` | String | WVPurchaseDetail | Estado de apertura del panel (`'1'`/`'0'`) |
| `wvpd_icon_url` | String | WVPurchaseDetail | URL del ícono del banner |
| `wallet_dashboard_selected_currencies` | JSON | WalletDashboard | IDs de divisas seleccionadas |
| `wallet_dashboard_sort` | JSON | WalletDashboard | Preferencia de ordenamiento |
| `inv_dashboard_selected_items` | JSON | InventoryDashboard | IDs de ítems seleccionados |
| `inv_dashboard_active_set` | String | InventoryDashboard | ID del set activo |
| `inv_dashboard_active_tiers` | JSON | InventoryDashboard | Tiers activos |
| `inv_dashboard_sort` | JSON | InventoryDashboard | Preferencia de ordenamiento |
| `inv_dashboard_hide_zero` | JSON | InventoryDashboard | Preferencias de ocultar cero |
| `characters:maps` | JSON | Characters | Caché de mapas (TTL 24h) |
| `characters:pois` | JSON | Characters | Caché de POIs (TTL 7 días) |
| `characters:prof_icons` | JSON | Characters | Caché de íconos de profesión |
| `characters:race_icons` | JSON | Characters | Caché de íconos de raza |
| `characters:specs` | JSON | Characters | Caché de especializaciones |
| `characters:assignments:{tokenHash}` | JSON | Characters | Asignaciones de POIs por cuenta |
| `characters:location_history:{tokenHash}` | JSON | Characters | Historial de ubicaciones |
| `characters:cached:{tokenHash}` | JSON | Characters | Caché de personajes (TTL 5 min) |
| `gw2_meta_favs` | JSON | Meta | Favoritos (IDs de eventos) |
| `gw2_meta_compact` | String | Meta | Preferencia de vista compacta (`on`/`off`) |
| `gn_meta_hecho_hoy:{tokenHash}` | JSON | Meta | Estado "hecho hoy" (deprecado) |
| `gn_meta_favs:{tokenHash}` | JSON | Meta | Favoritos por token (fallback) |
| `psna:schedule` | JSON | Activities | Caché de horario PSNA (TTL diario) |
| `psna:lastUpdate` | String | Activities | Última actualización del horario |
| `gn_activities_toggles` | JSON | Activities | Toggles de actividades (diarios/semanales) |
| `gn_activities_stones_{tokenHash}_{week}` | String | Activities | Piedras Vetustas por token/semana |
| `gn_home_nodes_marked` | JSON | Activities | Nodos de hogar marcados (por día) |
| `gw2_conv_cache_v3` | JSON | ConverterModal | Caché de conversiones coins↔gems (TTL 30 min) |
| `gh_token_encrypted` | String | GistSync | Token de GitHub cifrado |
| `gh_gist_id` | String | GistSync | ID del Gist |
| `gn_welcome_seen` | String | Welcome | Estado de bienvenida (`true`/`false`) |
| `wv_season` | JSON | WizardsVault | Cache de temporada |
| `wv_obj_daily:{LANG}` | JSON | WizardsVault | Cache de objetivos diarios (por token) |
| `wv_obj_weekly:{LANG}` | JSON | WizardsVault | Cache de objetivos semanales (por token) |
| `wv_obj_special:{LANG}` | JSON | WizardsVault | Cache de objetivos especiales (por token) |
| `wv_account_v2` | JSON | WizardsVault | Cache de AA (por token) |
| `wv_listings_all` | JSON | WizardsVault | Cache de listados globales |
| `wv_acc_listings` | JSON | WizardsVault | Cache de listados de cuenta (por token) |
| `wv_obj_catalog:{LANG}` | JSON | WizardsVault | Cache de catálogo de objetivos |