# 📜 Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato sigue las recomendaciones de  
**Keep a Changelog** (https://keepachangelog.com/)  
y el versionado **SemVer** (https://semver.org/).

---

## [6.6.0] - 2026-05-30

### Added
- **Dashboard de Inventario Multi-Cuenta (inventory-dashboard.js v1.0.0)**:
  - Tabla comparativa de ítems (banco + materiales + personaje activo) para todas las cuentas
  - 3 sets predefinidos: Alto Valor, Materiales de artesanía, Símbolos y demás
  - Sistema de Tiers para "Materiales de artesanía": T6/T5/T4/T3 (32 ítems) con checkboxes para activar/desactivar
  - Orden canónico: Colmillos → Escamas → Garras → Huesos → Sangre → Veneno → Tótem → Polvo
  - Carga en 2 fases: Fase 1 rápida (banco + materiales), Fase 2 background (personaje activo con `Promise.allSettled`)
  - Indicador visual de carga con glow pulsante `charPulse` (#7bc2ff)
  - Flash ámbar en celdas con delta positivo del personaje: 3 parpadeos + fijo hasta hover
  - Badge de valor total en oro con precios del Trading Post
  - Filtros: ocultar cuentas vacías, ocultar columnas vacías, ocultar cuentas main
  - Método `_debug()` con diagnóstico completo del módulo
- **Nuevo archivo**: `js/inventory-dashboard.js` v1.0.0
- **Nuevo archivo actualizado**: `assets/data/inventory-sets.json` v2 (3 sets + sistema de tiers)
- **Método `_debug()` en Raid Tracker (raid-tracker.js v1.7.0)**:
  - Expone: version, inited, active, token, completedEncounters, liAvailable, loading, error, dom, timers, encounters, refresh

### Changed
- **Skeleton loader ampliado en WV Shop**:
  - Cards: 8 → 24 (en `router.js` y `wv-shop-ui.js`)
  - Tabla: 8 → 30 filas
- **router.js v2.16.0 → v2.17.0**:
  - Fix: F5 en Tienda WV redirigía a Diarias (causa: `hideObjectivesDashboard()` en `route()`)
  - Reemplazada llamada a `hideObjectivesDashboard()` por código inline que solo oculta el panel sin tocar `setActiveTab`
- **Documentación**: ONBOARDING.md, CHANGELOG.md actualizados a v6.6.0

### Fixed
- **F5 en Tienda WV**: al recargar estando en Tienda, ahora mantiene la tab de Tienda (antes saltaba a Diarias)
- **IDs corregidas en inventory-sets.json**: Hueso grande (24341), Hueso pesado (24345), Hueso (24344)

---

## [6.5.1] - 2026-05-21

### Added
- **WV Objectives Dashboard — Dashboard de Objetivos Multi-Cuenta (wv-objectives-dashboard.js v1.0.0)**:
  - Tabla comparativa de objetivos semanales: filas = cuentas, columnas = objetivos, celdas = estado
  - KPIs con íconos GW2, descripciones y totales (X / Y): Cuentas, Reclamados, Completados, Progreso
  - Mini barra de progreso en el KPI de Progreso con gradiente azul
  - Countdown semanal al reset (lunes 07:30 UTC), mismo formato que Actividades/Meta
  - Carga paralela MAX=3 desde `GW2Api.getWVWeekly()` por cuenta
  - Skeleton loader durante la carga de datos
  - Fila de resumen TOTAL con contadores de reclamados/completados por columna
  - Scroll horizontal para muchas columnas de objetivos
  - Zebra striping + hover en tabla con estilos unificados
  - Iconos de cuenta idénticos a `wallet-dashboard.js` (`ACCOUNT_TYPE_ICONS` + `DECORATIVE_ICONS`)
  - Ruta: `#/account/wizards-vault/objectives-dashboard`
  - Panel integrado dentro de `wvPanel` (mismo patrón que Purchase Detail)
- **Botones de navegación en el `<nav class="tabs">` de WV**:
  - Dashboard (visible solo en Diarias/Semanales/Especiales)
  - Compras / Purchase Detail (visible solo en Tienda)
  - Refrescar y Volver (visibles solo cuando el dashboard está abierto)
  - Visibilidad alternada automáticamente según la tab activa
- **Nuevo evento Analytics**: `view_module` con `module_name: 'wv_objectives_dashboard'`

### Changed
- **router.js v2.16.0 → v2.17.0**:
  - Nuevas funciones: `showObjectivesDashboard()`, `hideObjectivesDashboard()` expuestas en API pública de WV
  - Ruta `#/account/wizards-vault/objectives-dashboard`
  - `setActiveTab` alterna visibilidad de botones Dashboard/Compras
  - `showObjectivesDashboard` inicializa WV si es necesario (soporta F5 en el dashboard)
  - `onTabClick` cierra el dashboard al clickear cualquier tab de objetivos
  - `hideBothNavButtons()` oculta Dashboard y Compras al abrir Purchase Detail
- **wv-shop-ui.js v1.0.2**:
  - Eliminado botón `#wvPDOpenBtn` del toolbar de tienda (movido al nav de tabs)
  - Eliminado event listener asociado
- **index.html**:
  - Panel `wvObjectivesDashboardPanel` dentro de `wvPanel` (en `tabs-content`)
  - Botones en `<nav class="tabs">`: Dashboard, Compras, Refrescar, Volver
  - CSS para display/hidden de botones (`#wvTabBtnObjDashboard`, `#wvTabBtnPurchaseDetail`, etc.)
- **theme-polish.css**:
  - Estilos `#wvTabBtnObjDashboard[hidden]`, `#wvTabBtnPurchaseDetail[hidden]`, `#wvTabBtnRefreshDashboard[hidden]`, `#wvTabBtnBackToWV[hidden]` con `display: none !important`
- **Documentación**: ONBOARDING.md, README.md, CHANGELOG.md actualizados a v6.5.1

### Removed
- **Botón `#wvPDOpenBtn` del toolbar de tienda**: eliminado del HTML generado por `wv-shop-ui.js` y `router.js`
- **Funciones deprecadas en `router.js`**: `_pdDeprecated_ensureToolbarButton()`, `observeToolbar()`, `accessIconHTML()` — código muerto eliminado

### Fixed
- **F5 en el dashboard**: los botones de navegación ahora funcionan correctamente tras recargar la página en el dashboard
- **Botón Dashboard siempre visible**: corregido con CSS `display: inline-flex !important` + `[hidden] { display: none !important }`
- **Countdown semanal**: se inicia correctamente después de renderizar el DOM del dashboard

---

## [6.5.0] - 2026-05-04

### Added
- **Conversor Gem ↔ Gold — Migración a Modal (converter-modal.js v1.0.0)**:
  - Extraído de `app.js` como módulo independiente con 4 tabs
  - **Tab Cambio**: Conversor completo con índice de conveniencia (igual que antes, ahora en modal)
  - **Tab Transacciones**: Órdenes activas de compra/venta del jugador en el TP con KPIs de totales (compras, ventas, balance)
  - **Tab Populares**: Ítems con mayor volumen de transacciones en el TP, filtro por rareza y ordenamiento especial para legendarias
  - **Tab Historial**: Placeholder para tendencia de gemas (Fase 3)
  - KPIs con glow semántico: Total en compras (rojo), Total en ventas (verde), Balance (verde/rojo)
  - Formato de monedas unificado `3 g 17 s 88 c` en todas las tabs
  - Embellecimiento visual: título con glow dorado, labels con glow de color, outputs con fondo, botones con íconos, estado verde
- **Nuevas funciones en api-gw2.js v2.15.0**:
  - `getCommerceListings(opts)` — Endpoint: `/v2/commerce/listings`. TTL: 5 min
  - `getCommercePrices(ids, opts)` — Endpoint: `/v2/commerce/prices`. TTL: 2 min
  - `getCommerceTransactionsBuys(token, opts)` — Endpoint: `/v2/commerce/transactions/current/buys`. TTL: 1 min
  - `getCommerceTransactionsSells(token, opts)` — Endpoint: `/v2/commerce/transactions/current/sells`. TTL: 1 min
- **Nuevo archivo**: `js/converter-modal.js` v1.0.0
- **Glow neutro en íconos de divisas sin color (wallet-theme.js v1.3.1)**:
  - Las divisas que no matchean con ningún color reciben glow blanco sutil (`rgba(255,255,255,0.12)`)

### Changed
- **api-gw2.js v2.13.0 → v2.15.0**:
  - Agregadas funciones `getCommerceListings`, `getCommercePrices`, `getCommerceTransactionsBuys`, `getCommerceTransactionsSells`
  - Agregado cap de 500 entradas en `items_cache_v1:es` (elimina las 100 más viejas al superar el límite)
- **app.js v2.6.3 → v2.7.0**:
  - Extraídas ~246 líneas del conversor a `converter-modal.js`
  - Agregado wire del botón `walletConverterBtn` para abrir el modal
  - Eliminadas referencias a `#asideConvSection` y variables del conversor
- **router.js v2.15.0 → v2.16.0**:
  - Eliminada referencia a `asideConvSection` en `updateSidebarFor`
  - Sidebar liberada (~80 líneas menos en index.html)
- **index.html**:
  - Eliminado `#asideConvSection` de la sidebar
  - Agregado botón `[💎 Conversor]` en toolbar de Wallet (antes de Dashboard)
  - Agregado script `converter-modal.js` en el bloque defer
- **wallet-theme.js v1.3.0 → v1.3.1**:
  - Glow en ícono aplicado también a divisas sin color (glow neutro)
- **Documentación**: ONBOARDING.md, README.md, CHANGELOG.md actualizados a v6.5.0

### Removed
- `assets/data/gemstore-items.json` — Datos estáticos de Gem Store (reemplazado por datos reales de API en tabs Populares y Transacciones)

---

## [6.4.0] - 2026-05-04

### Added
- **Inventory Hub — Buscador de Objetos en toda la Cuenta (inventory-hub.js v1.3.1)**:
  - Nuevo módulo que reemplaza a Personajes como pantalla principal de `#/account/characters`
  - KPIs rápidos: Materiales, Banco, Legendarios, Personajes, y acceso a "Ver Personajes"
  - Buscador unificado que busca en Materiales, Banco y Armería simultáneamente
  - Filtros por rareza (dropdown + chips clickeables) y búsqueda por texto
  - Resultados agrupados por ubicación + rareza con mini-cards en una fila horizontal
  - Ítems en grid de 5 columnas con `border-left` del color de rareza
  - Vistas de sección independientes con navegación Hub ↔ Sección:
    - **Materiales:** 10 categorías como en el juego (básicos, intermedios, avanzados, ascendidos, gemas y joyas, cocina, ingredientes, recetas, festivos, otros)
    - **Banco:** Grid de 10×3 slots con paginación cada 30, íconos al 80% de la celda, resaltado de búsqueda
    - **Armería:** Grid de 5 columnas por tipo (armas, armaduras, espaldares, abalorios/baratijas, otros)
  - Modal de ítem con stats reales de API:
    - Nombre, ícono, descripción, rareza, tipo, nivel requerido
    - Daño (armas): min_power - max_power (tipo de daño)
    - Defensa + peso (armaduras)
    - Atributos (Potencia, Precisión, Dureza, Vitalidad, Daño de condición, Curación, Ferocidad, Concentración, Pericia, Resistencia a la agonía)
    - Stats disponibles, ranuras de infusión con flags
    - Bonificaciones (runas) con niveles, sufijo
    - Valor NPC en formato oro-plata-cobre
    - Flags (Ligado a cuenta, Se liga al usar, Único, etc.)
    - Botón para copiar código de chat
    - Enlace a Wiki en español (`wiki-es.guildwars2.com`)
  - Búsqueda inteligente: barra vacía = 5 ítems de mayor rareza; con texto = coincidencia parcial hasta 25 resultados
  - Sin localStorage adicional — solo caché en memoria con TTL de 2-5 minutos
- **Nuevas funciones en api-gw2.js v2.13.0**:
  - `getAccountBank(token, opts)` — Endpoint: `/v2/account/bank`. TTL: 2 min
  - `getAccountMaterials(token, opts)` — Endpoint: `/v2/account/materials`. TTL: 2 min
  - `getAccountLegendaryArmory(token, opts)` — Endpoint: `/v2/account/legendaryarmory`. TTL: 5 min
- **Nuevo archivo**: `js/inventory-hub.js` v1.3.1
- **Nuevos assets**:
  - `assets/icons/Welcome/358409.png` — Ícono del módulo (sidebar y título)
  - `assets/icons/Welcome/3124974.png` — Ícono de búsqueda
  - `assets/icons/Cuentas/156670.png` — Ícono de banco
  - `assets/icons/Cuentas/255373.png` — Ícono de materiales
  - `assets/icons/Cuentas/157085.png` — Ícono de legendarios

### Changed
- **router.js v2.15.0**:
  - Ruta `#/account/characters` ahora apunta a `InventoryHub.activate()` como pantalla principal
  - `Characters.activate()` se llama desde el Hub como subvista
  - Panel `inventoryPanel` agregado a `showPanel()`
  - Mapeo de navegación: `'#/account/characters':'inventory'`
  - `updateSidebarFor('inventory')` sin panel específico
  - Evento Analytics: `view_module` con `module_name: 'inventory'`
- **characters.js v2.3.0**:
  - Nuevo método `getCharacterList()` que expone la lista de personajes al InventoryHub
  - Nueva función `renderBackToInventoryButton()` con botón "← Volver al Inventario" en el título del panel
  - Funciona como subvista del InventoryHub
- **api-gw2.js v2.12.0 → v2.13.0**:
  - Agregadas funciones `getAccountBank`, `getAccountMaterials`, `getAccountLegendaryArmory`
  - Agregados TTL.BANK, TTL.MATERIALS, TTL.ARMORY
- **index.html**:
  - Nuevo panel `<section id="inventoryPanel">`
  - Sidebar: ícono cambiado a `assets/icons/Welcome/358409.png`, texto "Inventario y Personajes"
  - Script `js/inventory-hub.js` cargado antes de `characters.js`
- **Documentación**: ONBOARDING.md actualizado a v6.4.0, README.md actualizado a v6.4.0, CHANGELOG.md actualizado
- **Receta visual unificada**: `inventory-hub.js` implementa cards de ítems con `border-left` por rareza (Legendary #974EFF, Ascended #FB3E8D, etc.)

### Fixed
- **KPIs en columna al volver de una sección**: `renderHubKPIs()` ahora fuerza `display:grid` con `grid-template-columns` en el contenedor
- **Banco**: Íconos con `width:80%; height:80%; object-fit:contain` para ocupar el 80% de la celda manteniendo la plantilla 10×3

---

## [6.3.1] - 2026-05-02

### Refactor
- **Arquitectura CSS en 3 capas estrictas**:
  - `main.css` → Layout, fondos, tipografía, espaciados. **Sin bordes ni box-shadows.**
  - `theme-polish.css` → Piel unificada: bordes neutros `rgba(255,255,255,0.08)`, glow base `rgba(90,110,154,0.12)`, hover unificado `translateY(-3px)` con `--elev-hover`, badges, pills, tablas.
  - `*-theme.js` → **Solo `border-left: 3px solid rgba(<color>, 0.5)`** vía `card.style.borderLeft`. El resto de bordes y sombras lo hereda de `.card` en `theme-polish.css`.
- **Regla de oro:** Ningún `*-theme.js` puede sobrescribir `border`, `boxShadow`, `borderRadius` ni `transition`. Solo `borderLeft` + `classList.add('card')`.

### Changed
- **Meta & Eventos — Rediseño completo (meta.js v3.3.0)**:
  - Ícono de expansión con glow del color (`box-shadow: 0 0 0 2px <color>, 0 0 10px <color>`)
  - Chips de timing con color semántico: verde (activo), ámbar (próximo), azul (más tarde), neutro (info)
  - Tag de infusión celestial: fondo frío `#1a1e28`, texto `#c8dfff`, glow `rgba(150,190,255,0.4)` — reemplaza al tag ámbar genérico
  - Estructura HTML unificada: `meta-card__top` con ícono + título + timing debajo, igual que `wallet-card__top`
  - Nuevas funciones: `expIconHTML(meta)`, `chipsForTiming(inst, minsRemaining)`, `footerDropHTML(meta, item)`
  - Nuevos estilos en `theme-polish.css`: `.meta-card__iconWrap`, `.meta-card__icon`, `.meta-card__timing`, `.meta-chip--active/soon/later/neutral`
  - Nuevo estilo en `main.css`: `.m-tag--infusion` con gradiente y glow celestial
- **WV Tienda — Rediseño (wv-shop-ui.js v1.0.2)**:
  - Glow solo en el ícono de rareza (`iconDeco`), eliminado de la card
  - `cardDeco` eliminado (glow/borde inline en la card)
  - `setTimeout` post-render para forzar `wv-theme.js` a aplicar `borderLeft` + `class="card"`
  - Fix: `borderLeft` ahora se aplica correctamente buscando el color en `wv-card__name`
- **Cartera — Glow en íconos de divisa (wallet-theme.js v1.3.0)**:
  - `applyCurrencyTheme()` agrega glow al ícono: `box-shadow: 0 0 0 2px <color>, 0 0 10px <color>`
  - Colores por divisa: Gems `#4BBDF0`, Coins `#F4C542`, Karma `#AF63DF`, Laurels `#2BC14E`, Trade Contracts `#28C3BB`, Elegy Mosaic `#E2AE43`
- **Actividades — Glow en íconos de Ecto (activities.js v3.19.6)**:
  - Contenedor de ícono 44×44px con glow del color de estado: verde si está hecho, ámbar si pendiente
  - Ícono de 32×32px con `object-fit: contain`
- **Panel de Cuentas — Rediseño "Profile Card" Premium (accounts-panel.js v2.0.0)**:
  - Ícono decorativo aleatorio (cat tag) con glow del color del tipo de cuenta — reemplaza al ícono de tipo anterior
  - Tags mostrados como iconitos 18px en fila con tooltip (sin texto) debajo de nombre y email
  - Expansiones colapsables con toggle chevron (`528716.png` / `528717.png`) + barra de progreso
  - Twitch/GeForce siempre visibles con íconos de estado (`156108.png` ✅ / `156107.png` ❌)
  - Credenciales en grid 2 columnas (email, contraseña, Gmail, Twitch, GeForce)
  - Separadores con gradiente horizontal del color del tipo de cuenta
  - Footer con botones "Copiar Email" y "Copiar API Key"
  - Vista compacta (toggle): reduce cada tarjeta a 4 líneas
  - Vista tabla rediseñada: zebra striping, hover, `border-left` por tipo, encabezados con `text-transform: uppercase`
  - Fix: wire de `[data-toggle-section]` para expansiones colapsables
  - Fix: rutas de íconos chevron corregidas a `assets/icons/Cuentas/528716.png` y `528717.png`
- **Dashboard de Cartera Multi-Cuenta — KPIs con Glow + Tabla Unificada**:
  - KPIs con `border-left` semántico + glow: Oro `rgba(244,197,66,0.5)`, Karma `rgba(175,99,223,0.5)`, Laurel `rgba(43,193,78,0.5)`, AA `rgba(123,194,255,0.5)`
  - Tabla con zebra striping, hover, sticky header con `border-bottom: 2px solid #2a2c35`
- **Conversor Gem ↔ Gold — Rediseño Visual**:
  - Quick-chips (100, 400, 800, 1200 / 10g, 100g, 250g) ahora usan clase `conv2-chip` (estilo badge/pill)
  - Las dos secciones (Gemas y Oro) envueltas en `conv2-card` con borde sutil y sombra
  - Estado "Actualizado." ahora es un `<span class="conv2-state">` con estilo pill
- **Purchase Detail — Fix de ícono (wv-purchase-detail.js v1.13.1)**:
  - Emoji 🕐 reemplazado por ícono local `assets/icons/523381.png`

### Fixed
- **5 archivos de tema corregidos** (solo `borderLeft`, sin pisar bordes ni sombras):
  - `meta-theme.js` v1.4.1 → **v1.4.2**: Eliminado `card.style.border` y `card.style.boxShadow`. Solo `borderLeft`.
  - `achievements-theme.js` v1.1.0 → **v1.1.1**: Eliminado `card.style.border` y `card.style.boxShadow`. Agregado `card.classList.add('card')`. Solo `borderLeft`.
  - `characters-theme.js` v1.0.0 → **v1.0.1**: Eliminados `card.style.border`, `boxShadow`, `borderRadius`, `transition`. Eliminados event listeners manuales de hover. Solo `borderLeft`.
  - `wv-theme.js` v1.0.0 → **v1.0.1**: Eliminado `card.style.borderTop/Right/Bottom` y `boxShadow`. Expone `window.WVTheme` para forzar aplicación post-render. Solo `borderLeft`.
  - `wallet-theme.js` v1.2.0 → **v1.3.0**: Ya aplicaba solo `borderLeft`. Agregado glow en ícono de divisa.
- **Fix de timing en WV Tienda**: `wv-theme.js` no detectaba las cards recién renderizadas porque el observer estaba sobre `#wvPanel` pero las cards se insertan en `#wvShopList`. Se agregó `setTimeout` en `renderShopArea()` que resetea `__wvThemed` y fuerza `WVTheme.themeAllNow(area)`.
- **Fix de estado online en Purchase Detail**: `refreshAllOnlineStatus()` usaba el índice del array `state.accounts` para actualizar la fila, pero la tabla estaba ordenada por delta (Δ). Ahora busca por `tr[data-token="..."]`.
- **Fix de preview de infusiones en Meta**: Ahora lee `data-preview` del DOM en vez de buscar en `meta._extItems`. Eliminado `.inf-prev` duplicado de `theme-polish.css`.
- **Fix de botón Dashboard de Wallet**: El event listener no se enganchaba a tiempo. Se agregó en `DOMContentLoaded`, antes de `wirePDButton()`.

### Removed
- **`wv-theme.js` duplicado en index.html**: Estaba cargado en el bloque `defer` y en el bloque `sync`. Eliminada la carga duplicada del bloque `defer`.
- **`.inf-prev` duplicado en `theme-polish.css`**: La regla original está en `main.css`.

---

## [6.3.0] - 2026-05-01

### Added
- **Receta Visual Unificada (Standard Visual Recipe)**:
  - Estándar visual común para todas las cards: borde neutro `rgba(255,255,255,0.08)`, border-left de 3px con color semántico, glow suave `rgba(90,110,154,0.12)`
  - Hover unificado: `translateY(-3px)` + sombra profunda `0 10px 28px rgba(0,0,0,0.45)` + glow intensificado
  - Transición: `0.22s cubic-bezier(0.2, 0.9, 0.4, 1.1)`
  - Aplicado en 11 módulos mediante `theme-polish.css`, `wallet-theme.js`, `meta-theme.js`, `achievements-theme.js`, `characters-theme.js`, `wv-theme.js`, `activities.js`, `accounts-panel.js`, `wallet-dashboard.js`
- **Desacople de Cámara del Brujo (WV) de router.js (Fases 1-3)**:
  - **Fase 1: `wv-theme.js` v1.0.0**: Tema visual para cards de Tienda y Objetivos WV (borde de rareza/modo, glow unificado). MutationObserver para cards dinámicas. Riesgo cero.
  - **Fase 2: `wv-shop-ui.js` v1.0.0**: UI de Tienda WV extraída de router.js (~400 líneas). Renderizado de cards/tabla, toolbar, filtros, skeleton loader, marcas, pins, auto-refresh. Con fallback completo.
  - **Fase 3: `wv-objectives-ui.js` v1.0.0**: UI de Objetivos WV extraída de router.js (~130 líneas). Renderizado de diarias/semanales/especiales, modo zero, hydrate mode pills. Con fallback completo.
  - `router.js` reducido de ~1200 a ~750 líneas. Solo orquesta navegación y ciclo de vida.
  - API pública extendida: `__getShopState()`, `__getObjState()`, `__setObjState()` en `window.WV`
- **`characters-theme.js` v1.0.0**: Tema visual de Personajes con borde de color por profesión (9 colores), hover con sombra de profesión, dropdowns personalizados para POIs (reemplazan `<select>` nativos), MutationObserver para cards dinámicas
- **Rediseño de Vista Tabla de Cartera (Wallet)**:
  - Íconos de divisa en cada fila
  - Formato de moneda con colores: oro `#f4c542`, plata `#e0e0e0`, cobre `#b87333`
  - Categorías migradas a badges visuales
  - Header sticky con `text-transform: uppercase` y `letter-spacing`
  - Hover en filas con `background: #1a1d28`
  - Estilos unificados con `.table-unified` en `theme-polish.css`
  - Nueva función `formatCoinValue()` en `app.js`
- **Rediseño de Dashboard de Cartera Multi-Cuenta**:
  - KPIs con `border-left` semántico por tipo (Oro `#F4C542`, Karma `#AF63DF`, Laurel `#2BC14E`, AA `#7BC2FF`)
  - Iconos decorativos por tipo de cuenta (`main`/`alter`/`f2p`) heredados del Panel de Cuentas
  - Sincronización de tags entre `accounts-panel.js` → `gw2_keys` → `wallet-dashboard.js`
  - Emoji 📊 de TOTAL reemplazado por ícono local `assets/icons/578844.png`
  - Nuevas funciones `getAccountIcon(tag)` y `ACCOUNT_TYPE_ICONS` en `wallet-dashboard.js`
- **Rediseño del Panel de Cuentas**:
  - Pantalla de carga rediseñada a 2 columnas (Asistente + Acceso a cuentas) con cards del mismo alto
  - Texto de seguridad ampliado: 4 bullets con iconos (cifrado AES, sin servidores, Comunidad Gato Negro)
  - Selector de archivo estilizado: botón que muestra nombre del archivo seleccionado en verde
  - Vista tabla con `border-left` por tipo de cuenta (`main`/`alter`/`f2p`)
  - Fila expandible al hacer clic (GW2 Avanzado, Expansiones, Servicios y API, Notas)
  - Corrección de bugs: `<tr>` corrupto (carácter `械`), `renderTableRow()` con `colspan` correcto
  - Nueva función `getBorderColor(account)` y `syncAccountTagsToKeys(accounts)`
- **Rediseño del Modal de API Keys**:
  - Iconos de tipo de cuenta en cada key (hereda de `accounts-panel.js`)
  - Badge "✓ En uso" en la key seleccionada (verde)
  - Key ofuscada con icono de candado
  - Botones con iconos: Usar (⚡), Copiar (📋), Renombrar (✏️), Eliminar (🗑️)
  - Botón Eliminar destacado en rojo con fondo semitransparente
  - Estado vacío con icono y mensaje descriptivo
  - Nuevas constantes `ACCOUNT_TYPE_ICONS` y `CONFIG_ICONS` en `app.js`
  - Nuevo método `KeyManager.setKeyTag(token, tag)` para persistir tipo de cuenta
- **Unificación visual de Actividades**:
  - Cards de Ecto: `border-left` verde `#a0ffc8` (hecho) / ámbar `#ffd36b` (pendiente)
  - Cards de Fractales T4: `border-left` verde (normal) / ámbar (CM)
  - Cards de Fractales Recomendados: `border-left` azul `#7bc2ff`
  - Cards de PSNA: `border-left` azul unificado
- **Nuevo asset**: `assets/icons/578844.png` para TOTAL del Dashboard

### Changed
- **router.js v2.14.0 → v2.15.0**:
  - `ensureLoadTab('shop')` y `onTokenChanged` delegan a `WVShopUI` con fallback
  - `renderObjectivesTab` y `renderObjectivesZero` delegan a `WVObjectivesUI` con fallback
  - Reducción de ~450 líneas (de ~1200 a ~750)
  - API pública extendida con `__getShopState`, `__getObjState`, `__setObjState`
- **wallet-theme.js v1.3.0 → v1.4.0**:
  - `applyCurrencyTheme()` actualizada con receta visual unificada
  - Borde neutro `rgba(255,255,255,0.08)` + `border-left` de color de divisa
  - Glow unificado `rgba(90,110,154,0.12)` en vez de glow por color
  - Marco de ícono simplificado (sin glow)
- **theme-polish.css v2.0.0 → v2.1.0**:
  - Nueva variable `--elev-hover` para hover unificado
  - `.card:hover` actualizado: `translateY(-3px)` + sombra profunda + glow intensificado
  - `.table-unified` extendido con soporte para `#walletTable`, `#accountsList table`
  - Hover unificado en filas de tabla
- **main.css v2.5.0 → v2.6.0**:
  - Agregados estilos para `.wd-kpi-card` con `border-left` semántico por `:nth-child()`
  - Agregados estilos para tabla de Cuentas (`#accountsList table`)
  - Eliminados estilos de Modo Deluxe (`body[data-meta-deluxe="on"]`)
- **meta.js v3.2.1**:
  - Eliminación de Modo Deluxe: `setDeluxe()`, `LS_META_DELUXE`, `DELUXE_DEFAULT`, botón Deluxe de `injectUIToggles()`
  - El Modo Compacto se mantiene intacto
- **accounts-panel.js v1.9.0**:
  - `renderLoadForm()` rediseñado a 2 columnas
  - `renderTableRow()` con fila expandible y `getBorderColor()`
  - Nueva función `syncAccountTagsToKeys()` llamada desde `loadFromFile()` y `loadFromStoredFile()`
  - Corrección de `<tr>` corrupto en `renderTable()`
- **app.js v2.6.3**:
  - `renderKeysList()` rediseñado con iconos, badges, botones con iconos
  - Nuevo método `KeyManager.setKeyTag(token, tag)`
  - Nuevas constantes `ACCOUNT_TYPE_ICONS` y `CONFIG_ICONS`
  - Nueva función `formatCoinValue()` para tabla de Wallet
- **wallet-dashboard.js v2.5.0**:
  - `renderTable()` con iconos por tipo de cuenta en cada fila
  - Nuevas funciones `getAccountIcon(tag)` y constantes `ACCOUNT_TYPE_ICONS`, `DECORATIVE_ICONS`
- **activities.js v3.19.3**:
  - `renderEcto()`, `renderFractals()`, `renderPSNA()` con `border-left` semántico y receta visual unificada
- **index.html**:
  - Scripts reorganizados por capas con comentarios documentados
  - Agregados `wv-shop-ui.js`, `wv-objectives-ui.js`, `wv-theme.js`, `characters-theme.js`
  - Nuevo orden de carga documentado
- **Documentación**: ONBOARDING.md actualizado a v6.3.0 (~2350 líneas), README.md actualizado a v6.3.0, CHANGELOG.md actualizado

### Removed
- **Modo Deluxe de Meta & Eventos**: no tenía efecto visual real (`meta-theme.js` ya pisa el `border-left`). Eliminados `setDeluxe()`, `LS_META_DELUXE`, `DELUXE_DEFAULT`, botón Deluxe y estilos CSS asociados
- **`wallet-cur-theme-patch.js`**: archivo redundante (v2.3.1) que competía con `wallet-theme.js`. Aplicaba `!important`, eliminaba glows, usaba heurísticas frágiles. `wallet-theme.js` v1.4.0 cubre toda la funcionalidad

### Fixed
- **Vista tabla del Panel de Cuentas**: corregido `<tr>` corrupto (carácter `械`) y `renderTableRow()` con estructura HTML inválida
- **Vista tabla del Panel de Cuentas**: fila expandible ahora muestra GW2 Avanzado, Expansiones, Servicios y API (antes solo nombre de Twitch)
- **Dashboard de Cartera**: emoji 📊 reemplazado por ícono local para consistencia visual
- **Selector de archivo en Panel de Cuentas**: ahora es un botón estilizado en vez del input nativo

---

## [6.2.0] - 2026-04-21

### Added
- **Raid Tracker — Seguimiento Semanal de Raids (raid-tracker.js v1.3.1)**:
  - Nuevo módulo que muestra las 8 alas de raid con todos sus encuentros
  - 33 encuentros totales (21 jefes + 12 eventos)
  - Marcado automático vía API `/v2/account/raids` (requiere permiso `progression`)
  - KPIs semanales: Completados / Total y porcentaje de progreso
  - Modal informativo por encuentro con:
    - Descripción (5+ bullets)
    - Estrategia (5+ bullets)
    - Enlace a video tutorial
  - Diferenciación visual entre JEFE (👑) y EVENTO (⚡)
  - Reset semanal automático (misma lógica que Activities, lunes 07:30 UTC)
  - Manejo seguro de imágenes: sin reintentos infinitos, fallback a emojis (🏰 para alas, 👾 para encuentros)
  - Escucha `gn:tokenchange` para recargar datos automáticamente
- **Nueva función `getAccountRaids(token, opts)` en api-gw2.js v2.12.0**:
  - Endpoint: `/v2/account/raids`
  - TTL de 5 minutos (el reset es semanal)
  - Requiere permiso `progression` (devuelve array vacío si no está presente)
- **Nueva ruta `#/account/raids`** en router.js v2.14.0
- **Nuevo enlace en sidebar** para Raids (debajo de Actividades, antes de Personajes)
- **Nuevo panel `#raidTrackerPanel`** en index.html
- **Nuevo evento Analytics `view_module`** con `module_name: 'raids'`
- **Nuevos assets en `assets/icons/raids/`**:
  - `raid-icon.png` — Ícono del módulo (sidebar y título)
  - `wing1.png` a `wing8.png` — Íconos de cada ala
  - `bosses/` — 33 archivos de íconos de encuentros

### Changed
- **api-gw2.js v2.11.0 → v2.12.0**:
  - Agregada función `getAccountRaids`
  - Agregado TTL.RAIDS = 5 * 60 * 1000
  - Actualizada documentación del archivo
- **router.js v2.13.0 → v2.14.0**:
  - Agregada ruta `#/account/raids`
  - Agregado `raidTrackerPanel` a `showPanel()`
  - Agregado mapeo `'#/account/raids':'raids'` en `setActiveNav()`
  - Agregado caso en `updateSidebarFor()` para `raids`
  - Agregado bloque en `route()` para RaidTracker
  - Agregado caso en `onKeySelectChange()` para recargar al cambiar de key
- **index.html**:
  - Agregado panel `#raidTrackerPanel` con clase `panel col-main`
  - Agregado enlace en sidebar para Raids (después de Actividades, antes de Personajes)
  - Agregado script `js/raid-tracker.js` a la lista de scripts
  - Actualizada versión de `api-gw2.js` a v2.12.0-modular
  - Actualizada versión de `router.js` a v2.14.0
- **welcome-panel.js v1.2.0**:
  - Agregada sección de Raids en lista de funcionalidades (8 acciones)
  - Agregado botón de acceso rápido a Raids
  - Nuevo ícono exclusivo `assets/icons/welcome/raids-icon.png`
- **Documentación**: README.md, ONBOARDING.md actualizados a v6.2.0

### Fixed
- **Ninguno** (nuevo módulo)

---

## [6.1.0] - 2026-04-08

### Added
- **Dashboard de Cartera Multi-Cuenta (wallet-dashboard.js v2.5.0)**:
  - Nuevo módulo que muestra todas las cuentas (API keys) en una tabla
  - Columnas: divisas seleccionadas por el usuario (Gemas, Oro, Laurel, AA, Karma, Esquirla espiritual por defecto)
  - Fila de totales (suma de cada divisa entre todas las cuentas)
  - Selector de divisas dropdown con íconos y persistencia en localStorage
  - Ordenamiento dinámico por columna (clic en encabezado alterna ascendente/descendente)
  - KPIs resumen con íconos oficiales: Total Oro, Total Karma, Total Laurel, Reconocimiento Astral
  - Formato de moneda para Oro: `X g Y s Z c` con colores (amarillo para oro, gris para plata, cobre para cobre)
  - Skeleton loader animado durante carga de datos
  - Scroll horizontal para tablas grandes
  - Botón "Refrescar" para recargar todas las wallets con `nocache: true`
  - Botón "Volver a Cartera" que cambia el hash a `#/cards`
- **Nueva ruta `#/wallet/dashboard`** en router.js v2.13.0
- **Botón "Dashboard" en el panel de Cartera** (`#walletPanel`) que navega a `#/wallet/dashboard`
- **Persistencia en localStorage**:
  - `wallet_dashboard_selected_currencies` — IDs de divisas seleccionadas
  - `wallet_dashboard_sort` — columna y dirección de ordenamiento

### Changed
- **router.js v2.12.0 → v2.13.0**:
  - Agregada ruta `#/wallet/dashboard`
  - Agregado `walletDashboardPanel` a `showPanel()` para que oculte correctamente `walletPanel`
  - Modificada redirección de bienvenida: no redirige si ya está en `#/welcome` o `#/wallet/dashboard`
  - Agregado evento `view_module` para `wallet_dashboard`
- **index.html**:
  - Agregado panel `#walletDashboardPanel` con clase `panel col-main`
  - Agregado botón "Dashboard" en los filtros del panel de Cartera
  - Agregado script `wallet-dashboard.js` a la lista de scripts
- **Documentación**: README.md, ONBOARDING.md actualizados a v6.1.0

### Fixed
- **Redirección de bienvenida**: al recargar la página en `#/wallet/dashboard`, ya no redirige a `#/welcome`
- **Carga inicial del dashboard**: reintento de renderizado si la tabla no existe en el DOM (100ms)

---

## [6.0.0] - 2026-04-05

### Added
- **Estado online basado en last_modified**:
  - Nueva función `getAccountInfo(token, opts)` en `api-gw2.js` v2.11.0
  - Nueva función `isRecentlyActive(accountInfo, minutesThreshold)` en `api-gw2.js` v2.11.0
  - Endpoint: `/v2/account?v=latest` para obtener `last_modified`
  - Umbral configurable: 20 minutos por defecto
  - Detecta CUALQUIER actividad (PvP, PvE, WvW, economía)
  - No requiere permiso especial `pvp` (usa `account` que todas las keys tienen)
  - TTL de 30 segundos para datos de actividad
- **Botón "Online" en el dashboard de compras**:
  - Ubicado junto al botón "Sincronizar" en `#wvpdFilters`
  - Actualiza solo el estado online sin recargar todos los datos
  - Usa el método público `WVPurchaseDetail.refreshOnlineStatus()`

### Changed
- **api-gw2.js v2.7.0-modular → v2.11.0**:
  - Eliminadas funciones `getPvPGames` e `isRecentlyActiveInPvP` (reemplazadas por `getAccountInfo` e `isRecentlyActive`)
  - Nueva función `getAccountInfo` con `?v=latest` para obtener `last_modified`
  - Nueva función `isRecentlyActive` para determinar actividad reciente
  - TTL.ACCOUNT agregado (30 segundos)
- **wv-purchase-detail.js v1.11.0 → v1.13.0**:
  - `loadAll()` ahora usa `getAccountInfo()` + `isRecentlyActive(accountInfo, 20)`
  - `refreshAllOnlineStatus()` ahora usa la misma lógica
  - Ícono cambiado de ⚔️ (PvP) a 🕐 (actividad general)
  - Tooltip actualizado: "Activo (actividad reciente)"
  - Botón "Online" movido del toolbar de tienda al dashboard
  - Eliminada dependencia de `getPvPGames` e `isRecentlyActiveInPvP`
- **Documentación**: README.md, ONBOARDING.md actualizados a v6.0.0

### Removed
- **Eliminada lógica de PvP**:
  - `getPvPGames` (reemplazada por `getAccountInfo`)
  - `isRecentlyActiveInPvP` (reemplazada por `isRecentlyActive`)
  - Dependencia del permiso `pvp` en API keys
  - Ícono ⚔️ (reemplazado por 🕐)

### Fixed
- **Estado online inconsistente**: ahora detecta actividad de cualquier tipo, no solo partidas PvP terminadas
- **Permisos de API key**: ya no requiere permiso `pvp`, todas las keys con permiso `account` funcionan
- **Latencia de detección**: `last_modified` se actualiza inmediatamente con cualquier cambio en la cuenta

---

## [5.9.0] - 2026-03-31

### Added
- **Google Analytics y Eventos Personalizados**:
  - Script de seguimiento GA4 agregado en `<head>` con ID `G-LB782QT9TR`
  - Nuevo archivo `js/analytics.js` v1.0.0 con API pública `window.Analytics`
  - Cola de eventos segura: si gtag no está cargado, los eventos se guardan y se envían cuando esté disponible
  - Eventos personalizados medidos:
    - `view_module` — Navegación a cada módulo (9 módulos: wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, wallet_dashboard)
    - `export_backup` / `import_backup` — Uso de backup/restaurar
    - `open_account_wizard` — Apertura del asistente de cuentas
    - `download_excel_template` — Descarga de plantilla Excel
    - `enrich_with_api` — Enriquecimiento con GW2 API
    - `encrypt_accounts_file` — Creación de archivo .enc cifrado
    - `force_reload_season` — Recarga forzada de temporada WV
    - `open_api_keys_modal` — Apertura del modal de API Keys
    - `add_api_key` — Agregar nueva API Key
    - `delete_api_key` — Eliminar API Key
  - Debug en consola: cada evento se loguea con `[Analytics]` prefix

### Changed
- **router.js v2.12.0**: Agregados eventos `view_module` en todos los módulos (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, wallet_dashboard)
- **settings-manager.js v1.0.1**: Agregados eventos `export_backup` e `import_backup`
- **accounts-panel.js v1.9.0**: Agregados eventos `open_account_wizard`, `download_excel_template`, `enrich_with_api`, `encrypt_accounts_file`
- **wizards-vault.js v1.3.0**: Agregado evento `force_reload_season`
- **app.js v2.6.3**: Agregados eventos `open_api_keys_modal`, `add_api_key`, `delete_api_key`
- **index.html**: Agregado script `js/analytics.js` después del script de GA4
- **Documentación**: README.md, ONBOARDING.md actualizados a v5.9.0

---

## [5.8.0] - 2026-03-30

### Added
- **Automatización de compras en Wizard's Vault**:
  - **Dashboard de compras (wv-purchase-detail.js v1.11.0)**:
    - Barra de progreso compacta en cada celda de ítem fijado
    - Input numérico + botón MAX para marcas manuales
    - Auto-guardado con debounce (500ms)
    - Regla dual: `Math.max(apiPurchased, manualMarks)` — muestra el valor más alto entre API y marcas manuales
  - **Tienda unificada (router.js v2.12.0)**:
    - Barra de progreso e input manual integrados como parte nativa del HTML de cada tarjeta
    - Eliminado event listener conflictivo de `wv:season-store:mutate` que recreaba la tienda innecesariamente
    - Persistencia de marcas directamente en WVSeasonStore sin recargar toda la tienda
    - Las barras no desaparecen al modificar valores ni al cambiar de pestaña
    - Funciones internas: `saveManualMark()`, `updateCardUI()`, `setupManualInputEvents()`
- **Recarga forzada de temporada en Wizard's Vault (wizards-vault.js v1.3.0)**:
  - Ícono clickeable (sin apariencia de botón) ubicado junto al tooltip de información (`wvSyncNote`), a la derecha del título "Cámara del Brujo"
  - Ícono: `assets/icons/Welcome/834002.png`
  - Función `forceReloadSeason()`: obtiene temporada fresca de la API (`/v2/wizardsvault` con `nocache: true`)
  - Actualiza automáticamente la UI (`wvSeasonTitle`, `wvSeasonDates`)
  - Guarda los datos en `WVSeasonStore` para persistencia
  - Feedback visual con toast (info → éxito/error)
  - Función global `window.forceReloadWVSeason` expuesta para debug en consola
  - Inyección automática del ícono al cargar el DOM y al navegar a `#/account/wizards-vault`

### Changed
- **wizards-vault.js v1.3.0**:
  - Nueva función `forceReloadSeason()` con lógica completa de recarga
  - Nueva función `injectReloadSeasonButton()` para inyectar el ícono en la UI
  - El ícono se inserta después del tooltip existente (`wvSyncNote`)
  - Estilos del ícono: opacidad 0.7 → 1 al hover, cursor pointer, transición suave
- **wv-purchase-detail.js v1.8.6 → v1.11.0**:
  - Nueva regla dual para mostrar valor más alto entre API y marcas manuales
  - Auto-guardado con debounce 500ms
- **router.js v2.10.6 → v2.12.0**:
  - Barra de progreso e input manual integrados en HTML nativo
  - Eliminado event listener conflictivo

### Fixed
- **Información de temporada no visible**: ahora el usuario puede restaurarla manualmente con un clic, sin necesidad de recargar toda la página ni usar la consola
- **Barras de progreso en tienda**: ya no desaparecen al modificar valores ni al cambiar de pestaña

---

## [5.7.0] - 2026-03-28

### Added
- **Sistema de Backup/Restaurar (settings-manager.js v1.0.1)**:
  - Exportación completa de configuración a archivo JSON
  - Importación con validación de versión y confirmación de sobrescritura
  - Botones "Backup" (`assets/icons/155034.png`) y "Restaurar" (`assets/icons/155033.png`) en utilbar
  - Datos exportados: API Keys, Wizard's Vault (pins y marcas), Wallet (pins, snapshots, vista compacta), Activities (toggles, home nodes), Characters (POIs, ubicaciones), Meta (favoritos, hecho hoy), configuración global (`gn_welcome_seen`)
  - Formato JSON versión 3.0 con timestamp de exportación
- **Header compacto**:
  - Altura reducida de ~140px a ~60px
  - Logo + nombre en una sola línea con tipografía Cinzel Decorative
  - Eliminación del hero y tabs (navegación ahora solo en sidebar)
  - Responsive: en móvil se apila verticalmente
- **Mejoras en Cámara del Brujo (WV)**:
  - Reemplazo de texto largo por ícono `assets/icons/155018.png` con tooltip
  - Ícono ubicado junto al título "Cámara del Brujo"
- **Iconos de redes sociales en utilbar**:
  - Discord: `assets/icons/Welcome/discord.png`
  - Instagram: `assets/icons/Welcome/instagram.png`
  - YouTube: `assets/icons/Welcome/youtube.png`
  - Twitch: `assets/icons/Welcome/twitchlogo.png`
  - GitHub: `assets/icons/Welcome/github.png` (nuevo)

### Changed
- **settings-manager.js v1.0.1**:
  - Corrección de claves de localStorage para API Keys: ahora usa `gw2_keys` y `gw2_selected_key_v1`
  - Mejora en logs de depuración
- **index.html**:
  - Header compacto con nueva estructura
  - Botones Backup/Restaurar en utilbar
  - Reemplazo de SVGs de redes sociales por imágenes locales
  - Tooltip WV con ícono `155018.png`
- **Archivos de documentación**: README.md, ONBOARDING.md actualizados a v5.7.0

### Fixed
- **Desborde de sidebar en WV**: corregido con estilos de contención y reubicación del ícono de información
- **Header pisando contenido**: resuelto con header compacto

---

## [5.6.0] - 2026-03-28

### Added
- **Panel de Cuentas — Rediseño completo (accounts-panel.js v1.9.0)**:
  - **Información detallada de Twitch** dentro de subsección "Servicios" colapsable:
    - Username con @ (copiable al portapapeles)
    - Email (copiable, si existe)
    - Password (toggle independiente + copiable, si existe)
  - **Iconos separados para títulos de secciones vs campos internos**:
    - Credenciales (título): nuevo icono `assets/icons/Welcome/733266.png`
    - Contraseña (campo): mantiene `assets/icons/Cuentas/733265.png`
    - GW2 Avanzado (título): nuevo icono `assets/icons/Cuentas/358409.png`
    - Chars (campo): mantiene `assets/icons/Cuentas/156409.png`
  - **Reemplazo de emoji 👁️ por imagen local** en todos los toggles de contraseña (`assets/icons/welcome/528726.png`)
  - **Reemplazo de emoji ✅ por imagen local** en GeForce Now (`assets/icons/Welcome/156108.png`)
  - **Barra de estadísticas optimizada**: separadores con `margin: 0 -6px` para mejor ajuste en zoom 100%
  - **Plantilla Excel actualizada**: nuevas columnas `twitch_user`, `twitch_email`, `twitch_password`

### Changed
- **accounts-panel.js v1.9.0**:
  - Subsección "Servicios" colapsable dentro de Servicios y API
  - Toggle independiente para contraseña Twitch (`state.showTwitchPasswords`)
  - Estado de expansión de secciones persistente en memoria (no localStorage)
  - Copia al portapapeles extendida a Twitch username, email y password
- **Plantilla Excel**: incluye ahora columnas `twitch_user`, `twitch_email`, `twitch_password` para capturar datos completos de Twitch

### Fixed
- **Contraseña Twitch**: ahora se muestra correctamente (oculta por defecto) con toggle funcional
- **Barra de estadísticas**: separadores optimizados para que no rompa en dos líneas en zoom 100%

---

## [5.5.0] - 2026-03-27

### Added
- **Pantalla de Bienvenida (welcome-panel.js v1.2.0)**:
  - Nueva ruta `#/welcome` con onboarding completo
  - Secciones: funcionalidades (8 acciones, incluyendo Raids), API Key, asistente de cuentas, acceso rápido, comunidad, apoyo
  - Iconos exclusivos para cada funcionalidad (cartera, meta, logros, WV, actividades, personajes, cuentas, raids)
  - Botón home en utilbar con ícono local (`assets/icons/ui/home.png`)
  - Redirección inteligente: primera visita o sin API key → bienvenida
  - Flag `gn_welcome_seen` en localStorage para no mostrar repetidamente
- **Panel de Cuentas — Asistente integrado (accounts-panel.js v1.3.1)**:
  - Modal con 4 pasos para crear archivos `.enc` desde Excel:
    1. Descargar plantilla Excel con columnas predefinidas
    2. Subir Excel → Generar JSON
    3. Enriquecer con GW2 API (account name, AP, fecha creación, expansiones)
    4. Cifrar con contraseña → archivo `.enc`
  - Separación visual: bloque "Asistente" arriba, bloque "Acceso a cuentas" abajo
  - Botón "➕ Crear nuevo archivo" abre el modal
  - Persistencia de último archivo en localStorage
  - Iconos exclusivos para cada paso del asistente
- **Detección automática de llave semanal — Validación de semana actual (Activities v3.19.3)**:
  - Nueva condición: personaje Thief debe haber sido creado **después** del último reset semanal (lunes 07:30 UTC)
  - Función auxiliar `getLastWeeklyResetUTC()`
  - Previene que Thiefs creados el domingo bloqueen la llave de la semana siguiente
  - Leyenda actualizada: "nivel 10+, <7 días, **misma semana**"

### Changed
- **welcome-panel.js v1.2.0**:
  - Todos los emojis reemplazados por imágenes locales en todas las secciones
  - Iconos de comunidad: Discord, Instagram, YouTube, Twitch, GitHub, email
  - Iconos de apoyo: PayPal, Ko-fi, café
  - Botones "Agregar API Key" y "Gestionar Keys" abren modal correctamente
  - Modal de API Keys cierra correctamente (backdrop, X, ESC)
- **router.js v2.10.6**:
  - Nueva ruta `#/welcome` agregada
  - Lógica de redirección inicial en `onDomReady()`
  - Actualización de `showPanel`, `setActiveNav`, `onKeySelectChange` para soportar bienvenida
- **accounts-panel.js v1.3.1**:
  - Mantenimiento de funcionalidad existente (carga de archivo guardado, contraseña, botón "Cambiar archivo")
  - Corrección de bug: modal de API Keys cierra correctamente desde bienvenida

### Fixed
- **Modal de API Keys**: ahora cierra correctamente (backdrop, X, ESC) cuando se abre desde cualquier lugar
- **Panel de cuentas**: separación visual correcta entre asistente y acceso a cuentas
- **Modal de asistente**: corrección de margen izquierdo (div extra eliminado)

---

## [5.4.0] - 2026-03-26

### Added
- **Panel de Cuentas (accounts-panel.js v1.2.1)**:
  - Cifrado local de archivos JSON con AES (CryptoJS)
  - Persistencia de último archivo en localStorage para acceso rápido
  - Vista dual: tarjetas / tabla con botón toggle
  - Información sensible oculta con botón 👁️
  - Copia al portapapeles (email, contraseña, Gmail Pass)
  - Click en nombre de cuenta expande información adicional (mochilas, bancos, material, legendarias)
  - Sección colapsable "Más info" con estadísticas
  - Filtros por tipo (principales, alternativas, farming, llaves) y tags
  - Botón "Cambiar archivo" para resetear estado
  - Ruta `#/account/accounts`
- **Detección automática de llave semanal (Activities v3.19.2)**:
  - Busca personajes Thief con nivel ≥10 y menos de 7 días de antigüedad
  - UI dedicada en la parte superior del panel de actividades
  - Eliminado marcado manual (checkbox deshabilitado)
- **Barra de horarios unificada** (Activities v2.5.0 / Meta v1.3.1):
  - Iconos oficiales de GW2: UTC, Local, Reset diario, Reset semanal
  - Actualización en tiempo real con segundos
  - Cuenta regresiva con formato `Xd Xh Xm Xs`

### Changed
- **index.html**: Nuevo enlace en sidebar para Cuentas, agregado script de crypto-js y SheetJS
- **router.js v2.10.5**: Nueva ruta `#/account/accounts`
- **activities.js v3.19.3**: Mejora en detección de llave con validación de semana actual

---

## [5.3.0] - 2026-03-25

### Added
- **Migración completa a íconos locales**:
  - Profesiones: íconos locales en `assets/icons/professions/2163502.png` a `2163510.png`
  - Fractales: ícono genérico local `assets/icons/Fractal/2591.png` para todas las tarjetas
  - Conversor: SVG reemplazados por imágenes locales (`502065.png`, `619316.png`, `784280.png`)
  - Countdowns WV: íconos de reset diario, semanal y temporada locales (`523379.png`, `523380.png`, `523381.png`)
- **Títulos de paneles con íconos**:
  - Cartera: `733322.png`
  - Meta & Eventos: `102420.png`
  - Logros: `155059.png`
  - Cámara del Brujo: `3172791.png`
  - Actividades: `1302773.png`
  - Personajes: `156678.png`
- **Corrección de rutas assets**: eliminada barra inicial `/` en todas las rutas para compatibilidad con GitHub Pages

### Changed
- **Characters.js v2.3.0**: `loadProfIcons()` ahora usa íconos locales en lugar de API
- **Activities.js v3.19.0**: Fractales usan ícono genérico local, simplificadas funciones `getFractalIconHtml()` y `getScaleIconHtml()`
- **wv-purchase-detail.js v1.8.6**: Countdowns con íconos locales
- **index.html**: Conversor y títulos de paneles con íconos locales

### Removed
- Dependencia de `/v2/files` para íconos de profesión
- Dependencia de wiki.guildwars2.com para íconos de fractales
- SVG inline del conversor (gemas y oro)

---

## [5.2.0] - 2026-03-24

### Added
- **Íconos en títulos de paneles**:
  - Cartera: `733322.png`
  - Meta & Eventos: `102420.png`
  - Logros: `155059.png`
  - Cámara del Brujo: `3172791.png`
  - Actividades: `1302773.png`
  - Personajes: `156678.png`

### Changed
- **index.html**: Todos los títulos de paneles ahora incluyen ícono correspondiente
- **activities.js v3.18.0**: Título del panel con ícono
- **characters.js v2.3.0**: Título del panel con ícono

---

## [5.1.0] - 2026-03-24

### Added
- **Migración a íconos locales**:
  - Sidebar: todos los íconos de navegación migrados a `assets/icons/` (28x28)
  - Barra de tiempos (Activities): UTC, Local, Daily, Weekly
  - Countdowns WV: diario, semanal, temporada (523379-523381)
  - Banner y botón Purchase Detail: ícono Cámara del Brujo (3594051)

### Fixed
- **Bucle infinito en Wizard's Vault**:
  - Restaurado endpoint correcto en `getWVSeason` (`/v2/wizardsvault`)
  - `scheduleSeasonReset` evita reprogramación múltiple
  - `msUntil` corregida para objetos Date
- **Información de temporada**:
  - `nextSeasonResetUTC` retorna null si fecha ya pasó
  - `setWVSeasonHeader` se ejecuta correctamente al cargar

---

## [5.0.0] - 2026-03-23

### Added
- **Barra de horarios unificada** con iconos oficiales de Guild Wars 2:
  - Hora servidor UTC y hora local con actualización en tiempo real (segundos)
  - Cuenta regresiva para reset diario (00:00 UTC) y reset semanal (lunes 07:30 UTC)
  - Formato unificado: `Xd Xh Xm Xs` con segundos
  - Implementada en Activities (v2.5.0) y Meta & Eventos (v1.3.1)
- **Meta & Eventos — Mejora de horarios en tarjetas**:
  - Conversión UTC → hora local en horarios desplegables
  - Color dinámico del botón "Horarios": 🟢 verde (activo), 🟡 ámbar (próximo ≤20 min), 🔵 azul (más tarde)
  - Resaltado del próximo horario en la lista de horarios
  - Ícono 🕒 añadido al botón
- **Home Nodes — Rediseño completo** (activities-theme.js v2.3.0):
  - Lista completa de 74 elementos (53 nodos API + 6 Janthir + 15 contratos/consumibles)
  - Estado en tiempo real ✅/❌ vía API `/v2/account/home/nodes`
  - Filtros avanzados por categoría, tipo y estado
  - Tarjetas rediseñadas con icono de tipo (44px) e imagen de ítem destacada (64px)
  - Checkbox "Recolectado hoy" con persistencia diaria en localStorage
  - Contador de progreso con porcentaje
  - Sistema de fallback de imágenes desde gw2treasures

### Changed
- **Purchase Detail** (v1.8.4): Sistema de colores unificado (verde/amarillo/rojo), badges con hover, KPIs con glow, skeleton loader, animación de entrada
- **Wallet Theme** (v1.3.0): Migración a badges canónicos, glows preservados, migración a clase `.card`
- **Meta Theme** (v1.1.0): Badges canónicos, extensión visual con pills
- **Theme Polish** (v2.0.0): Componentes canónicos unificados (badges, pills, KPIs, tabla)
- **ONBOARDING.md**: Actualizado con documentación completa de Home Nodes y barra de horarios

### Removed
- Eliminado reglón extra con símbolo '^' sobre tabla en Purchase Detail
- Removido fingerprint de la columna cuenta
- Eliminado campo redundante "Última actualización" en Meta & Eventos

---

## [4.1.0] - 2026-03-01

### Added
- **UI Overhaul**: rediseño de tarjetas y layouts de Wallet, Meta & Logros; unificación de barras de progreso.
- **Conversor v2.0**: quick‑chips (gemas/oro), micro‑animaciones, halo dorado reforzado, estado "Actualizado." en pill, sombras dinámicas de la barra y layout simétrico.

### Fixed
- **WV**: pastillas de modo (PvE/PvP/WvW) muestran iconos correctamente. Se incorpora `hydrateWVModePills(scope)` y se llama tras render, cambios de tab y de token. Se añade `MutationObserver` en `#wvPanel`.

### Changed
- Pulidos de estilo en `theme-polish.css`, halos por rareza y coherencia de tonos/pills.

---

## [4.0.0] – 2026-02-28

### Wallet
- Rework de tarjetas con estética WV (`wallet-card-grid`, `wallet-card*`).
- Reemplazo de estrella por **📌** con persistencia por cuenta (`LS_WALLET_PINS`) y **migración** desde `LS_FAVS`.
- **Vista compacta** con persistencia (`LS_WALLET_COMPACT`), toggle inyectado en toolbar.
- **Delta de cantidades** (↑/↓) contra snapshot por cuenta (`LS_WALLET_SNAPSHOT`), pill verde/roja; en tabla también ±0.
- Toolbar: botones **"Vista compacta"** y **"Actualizar base"**.
- Accesibilidad: `aria-pressed` en pins/toggles.

### UI/Index
- `#walletCards` ahora usa `wallet-card-grid`.
- "Favoritas" → "Fijadas".
- Encabezado de Tabla (última col) ahora es **📌**.

### Nuevo módulo completo: Cámara del Brujo (Wizard's Vault)
- Objetivos Diarios / Semanales / Especiales.
- Progreso de Meta global de temporada.
- Aclamación Astral: disponible, gastado API, reservado (marcas locales).
- Tienda WV con vista tarjetas/tabla, filtros, buscador, stock y contadores ± persistentes.
- Toolbar PvE / PvP / WvW.
- Manejo de permisos y fallback en caso de tokens sin wizardsvault.
- Integración con endpoints oficiales:
  - `/v2/wizardsvault/seasons`
  - `/v2/account/wizardsvault/categories`
  - `/v2/account/wizardsvault/listings`

### Nuevo módulo completo: Pantalla de Logros (Achievements)
- Vista dedicada en `#/account/achievements`.
- Barra de progreso por objetivo.
- Filtros PvE / PvP / WvW.
- Rareza, progreso numérico y porcentaje.
- Integración con `/v2/account/achievements` y `/v2/achievements`.
- Estilo oscuro, limpio y consistente con el resto del panel.

### Selects (Meta & Eventos / Wallet)
- Tema oscuro real, sin caret, menú desplegable dark, una sola pastilla (chip).

### Chips sólidos
- Hover/focus/pressed/checked consistentes y accesibles.

### Toggles inyectados (sin tocar index.html)
- `data-meta-deluxe="on|off"`
- `data-meta-compact="on|off"`

### Integración total con:
- **Hecho hoy (API)**: `/v2/account/worldbosses`, `/v2/account/mapchests`.
- **Hecho hoy (Manual)**: por id/token/día UTC (localStorage), reset automático 00:00 UTC.
- **Cache de flags** (TTL 5′), **refresh** manual.

### Nuevo sistema de iconografía en el sidebar
- Reemplazo de emojis → íconos reales (Wiki e íconos GW2).
- Preparado para repositorio propio de imágenes.

### Cambiado
- Refinamiento visual de tarjetas y filtros, sin romper la estructura previa.
- Ordenación por favoritos, estado (activo → próximo → más tarde) y proximidad.
- Router actualizado: navegación por hash y emisión correcta de `gn:tabchange` para inicialización del módulo MetaEventos.
- Correcta separación de asides según vista (Wallet / MetaEventos / Logros / WV).

### Corregido
- Selects que se veían con fondo blanco / texto claro (ilegible) en algunos navegadores.
- Flechita (caret) que se superponía en los chips de filtros.
- Error crítico: MetaEventos no iniciaba debido a cambio en la navegación → solucionado.
- Tooltips de infusiones: fix de `pop is not defined`, escopo correcto y `createElement('img')` sin CORS.
- Render de íconos: `iconTag()` / `wpIcon()` ahora devuelven `<img>` reales.
- Corrección de enlaces Wiki/Mapa (se mostraban como texto).

---

## [2.6.3] - 2026-02-28

### Router / Sidebar
- `setActiveNav` robusto (sin entidades, normalización de hash, rAF).
- **`updateSidebarFor(view)`**: sidebar contextual coherente por vista.
- **`try/finally`** en cada rama de `route()` para garantizar **actualización de nav + sidebar** aun ante excepciones.
- Refuerzo `hashchange`: rutear + re‑aplicar active al final del ciclo.
- WV: `WV.activate()` antes del marcado de nav; se corrige el **bug de pastilla** y el **sidebar fantasma**.

---

## [2.6.1–2.6.2] - 2026-02-28

- Limpieza de entidades HTML fuera de strings en JS (evita errores de sintaxis).
- Ajustes menores de compatibilidad y logs de diagnóstico.

---

## [3.0.0] – 2026-02-24

### Agregado
- **MetaEventos Deluxe v3.0**:
  - Tarjetas con jerarquía clara: header → subinfo → ✔ → contexto → acciones → pie.
  - **Acciones**: Copiar WP, abrir Wiki, **Mapa** (gw2.io), **Compartir** texto, Favorito.
  - **Horarios por tarjeta** (toggle), chips con estados **NOW** y **SOON (≤20m)**.
  - **Vista Compacta** global.
  - **Colores por categoría** (worldboss/meta/global/instance/temple/event).
  - **Contexto** automático por tipo.
- **Selects** (Meta & Eventos / Wallet): tema **oscuro** real, **sin caret**, menú desplegable dark, **una sola pastilla** (chip).
- **Chips sólidos**: hover/focus/pressed/checked consistentes y accesibles.
- **Toggles** inyectados (sin tocar index.html):  
  - `data-meta-deluxe="on|off"`  
  - `data-meta-compact="on|off"`
- Integración total con:
  - **Hecho hoy (API)**: `/v2/account/worldbosses`, `/v2/account/mapchests`.
  - **Hecho hoy (Manual)**: por `id`/token/día UTC (localStorage), reset automático 00:00 UTC.
  - **Cache** de flags (TTL 5′), **refresh** manual.

### Cambiado
- Refinamiento visual de tarjetas y filtros, sin romper la estructura previa.
- Ordenación por favoritos, estado (activo > próximo > más tarde) y proximidad.

### Corregido
- **Selects** que se veían con **fondo blanco / texto claro** (ilegible) en algunos navegadores.
- Flechita (caret) que se superponía en **checkbox chips** ("Activos", "Próximos", etc.).

---

## [2.6.2] – 2026-02-23

### Agregado
- **Manual check** para metas sin API (`manualCheck:true`), persistente por token/día UTC.
- Tooltips y preview en infusiones (cuando hay `highlightItemId` o `preview`).
- Top‑3 próximos en sidebar.

### Cambiado
- Skeleton y render más robustos; mensajes de estado claros.

### Corregido
- Ajustes menores de iconos y tooltips.
- Evitar error silencioso cuando `meta-drops.json` no está disponible.

---

## [2.6.1] - 2026-02-24

### Added
- MetaEventos: cache por API key (TTL 5 min) para "Hecho hoy".
- Botón **Refrescar estado** con bloqueo y toast.
- **Auto‑refresh** en 00:00 UTC (reset diario).
- Timestamp visible `Actualizado hh:mm:ss` y tooltip del ✔ con fuente e ID (cuando aplica).
- UI: encabezados + filtros en chips; meta‑topbar con badges.
- Conversor: títulos color/ícono; un único input por lado.

### Changed
- Alineación de componentes (Wallet/Meta/Conversor) y responsive <900px.

### Fixed
- Duplicado de `renderSkeletonMeta` y pequeños hardenings en `updateClock`.

---

## [2.6.0] — 2026-02-24

### 🎯 Nuevo
- Modal completo de API Keys (alta, edición, eliminado, uso, copia).
- Selector global visible en todas las vistas.
- Validación automática de permisos `account + wallet`.
- UX mejorada en gestión de cuentas múltiples.

### 🛠 Cambios técnicos
- KeyManager centralizado.
- Limpieza de código legacy en Wallet.
- Eliminación total del selector viejo.
- Fix en `onBottomInput()` y mejoras en `updateRef400()`.

### 🔁 Migración
- El panel Wallet ya no administra API Keys.
- La gestión se concentra en el header y modal.

---

## [v2.5.0] — 2026-02-22

### Added
- Activación del módulo **MetaEventos** con:
  - Estado: Activo / Próximo / Más tarde
  - Filtros (tipo, expansión, activos, próximos ≤20m, infusiones)
  - Favoritos (máx. 6)
  - Sidebar "**Top 3** próximos"
  - Tooltips visuales para infusiones (preview + wiki)
  - Botón **copiar waypoint** con icono personalizado

### Changed
- Hero actualizado con **glow dorado**.
- Tabs del hero robustecidas para evitar deformaciones.
- CSS general reorganizado y limpiado.
- Normalización de badges por expansión.

### Fixed
- Tooltips de infusiones ahora se enganchan después del render.
- Correcciones del layout del hero para evitar el desplazamiento de tabs.
- Ajuste del reloj y "Próximo reset".

---

## [v2.3.3] — 2026-02-21

### Added
- Glow rojo en tabs del hero.
- Iconos de redes (Discord, Instagram, YouTube, Twitch).
- Mejoras visuales en tarjetas y botones.

### Changed
- Conversor final estable sin loops.
- Íconos de divisas a 22px.
- Limpieza visual en `main.css`.

### Fixed
- Render robusto de íconos API.
- Eliminado error `ReferenceError: renderCards is not defined`.

---

## [2.0.0] - 2026-02-21

### 🚀 Rediseño total – "Bóveda del Gato Negro"
Esta versión reemplaza completamente la versión anterior de *gw2-wallet-ligero*, introduciendo una nueva identidad visual, estructura profesional y mejoras profundas en la UI/UX.

#### ✨ Nuevo
- Nueva identidad: **Bóveda del Gato Negro**
- Header estilo ArenaNet con:
  - Textura Hero
  - Overlay semitransparente
  - Logo + tipografía ornamental
  - Tabs principales flotantes
- Navegación renovada
- Dropdown **"Enlaces útiles"** (Efficiency, Timer, ArcDPS, API docs)
- Redes integradas: Discord, Instagram, YouTube
- Favicon nuevo (SVG + PNG)
- Marquita GN para footer
- Estructura HTML optimizada
- Estilo CSS reescrito desde cero
- Paleta de color basada en identidad del logo
- 🧩 Preparación modular para próximos módulos:
  - Conversor Gem ↔ Oro
  - MetaEventos
  - Dashboard extendido

#### 🛠 Mejorado
- Mejor rendimiento de carga inicial
- Overlay con efecto **glass UI**
- Header + hero responsivos
- Espaciados y jerarquía visual revisada
- Compatibilidad con GitHub Pages

#### 🧹 Eliminado
- Proyecto antiguo y archivos previos (HTML/CSS/JS obsoletos)
- Legacy tokens de estilos y scripts viejos
- Documentación antigua

---

## [1.6.1] - 2026-02-20

### 🎨 Ajustes de overlay
- Correcciones en overlay debajo/encima del header
- Ajustes responsive
- Afinado de glow y colores

---

## [1.5.0] - 2026-02-19

### 🎨 Incorporación logo + branding inicial

---

## [1.4.0] - 2026-02-18

### 🧭 Nuevo header con textura + barra superior

---

## [1.3.4] - 2026-02-17

### 🐞 Fix crítico
- Corrección de iconos en tarjetas
- Corrección de overflow en descripciones largas

---

## [1.0.0] - 2026-02-15

### 🎉 Versión inicial
- Lectura de API Keys
- Integración con `/v2/account/wallet`
- Grilla de tarjetas
- Vista compacta (tabla)