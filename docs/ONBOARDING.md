```markdown
# 🐈⬛ Bóveda del Gato Negro — Onboarding Técnico Consolidado (v6.5.0)

Fecha: 2026-05-04
Módulos clave: `api-gw2.js`, `router.js`, `achievements.js`, `wizards-vault.js`, `wv-season-storage.js`, `wv-purchase-detail.js`, `wv-tabs-skin.js`, `wv-shop-ui.js`, `wv-objectives-ui.js`, `wv-theme.js`, `wallet-dashboard.js`, `raid-tracker.js`, `app.js`, `meta.js`, `activities.js`, `activities-theme.js`, `characters.js`, `characters-theme.js`, `accounts-panel.js`, `welcome-panel.js`, `settings-manager.js`, `analytics.js`, `gist-sync.js`, `sidebar-nav.js`, `inventory-hub.js`, `converter-modal.js`, `*-theme.js`, `main.css`, `theme-polish.css`

## 📌 BAI — Bloque de Alineamiento Instantáneo

### Contexto del Proyecto

Bóveda del Gato Negro es una web app vanilla JS modular, sin framework, con foco en performance, simplicidad, desacoplamiento y tolerancia a errores.

- Arquitectura por archivos autocontenidos y sin dependencias externas.
- Las mejoras no deben romper los contratos públicos ni la orquestación `router-first`.
- Todo el código sigue el patrón de módulos IIFE con API pública expuesta en `window`.

### Objetivo de DeepSeek (tu agente de IA)

- Mantener compatibilidad absoluta con la arquitectura actual.
- No romper APIs públicas de GW2Api.
- Mantener `router.js` como orquestador único (escucha `gn:tokenchange`).
- Mantener `WVSeasonStore` como fuente de datos WV (pins/marks/prefs).
- Priorizar simplicidad + previsibilidad + fallbacks.
- Entender el contexto completo del proyecto antes de generar código.
- Proponer soluciones que respeten las invariantes técnicas y no introduzcan regresiones.
- Preguntar cuando algo no esté claro o cuando haya múltiples caminos posibles.

### Invariantes Técnicas (NO ROMPER)

- Un único canal de cambio de cuenta: `gn:tokenchange`.
- Abort + last win en pipelines largos (fetch de datos, carga de personajes).
- Prefetch con guardas e in-flight de duplicados (controlado por el router).
- `WVSeasonStore` es la persistencia oficial de WV (pins, marks, historial).
- Purchase Detail depende exclusivamente de SeasonStore (selector, timers, KPIs).
- Ningún módulo toca DOM ajeno (cada módulo gestiona su propio panel).
- Sin frameworks: JavaScript, HTML y CSS puros.

### Reglas de Estilo

- Módulos autocontenidos; API pública explícita.
- Código claro y declarativo (sin "magia").
- Performance pragmática: `requestIdleCallback`, throttle, render incremental.
- Nueva lógica detrás de guardas; fallbacks ante errores externos.
- Entregables copiables tal cual a archivos.

### Checklist pre-trabajo (cada sesión)

- ☐ ¿Afecta SeasonStore?
- ☐ ¿Rompe invariantes (events, router, AA, store, compact flow)?
- ☐ ¿Cambia APIs públicas de GW2Api?
- ☐ ¿Implica más LocalStorage? (shadow/no shadow)
- ☐ ¿Afecta timings/prefetch del router?
- ☐ ¿Requiere fallback offline?
- ☐ ¿Hace falta abort/guardas?
- ☐ ¿Refactor o feature?
- ☐ ¿Impacto en performance/UI?

Si hay riesgo → advertir antes de generar código.

---

## 🚀 Novedades v6.5.0 (MAYO 2026) — Modal del Conversor + Comercio + Mejoras

### 💱 Conversor Gem ↔ Gold — Migración a Modal (converter-modal.js v1.0.0)

**Objetivo:** Extraer el conversor de la sidebar a un modal independiente con tabs para Cambio, Transacciones, Populares y Historial.

**Arquitectura del modal:**

💎 Cambio │ 📋 Transacciones │ 📊 Populares │ 📈 Historial


**Tabs implementadas:**

| Tab | Funcionalidad | APIs |
|-----|---------------|------|
| **Cambio** | Conversor Gem ↔ Gold con índice de conveniencia | `/v2/commerce/exchange/coins`, `/v2/commerce/exchange/gems` |
| **Transacciones** | Órdenes activas de compra/venta del jugador | `/v2/commerce/transactions/current/buys`, `/v2/commerce/transactions/current/sells` |
| **Populares** | Ítems con mayor volumen en el Trading Post | `/v2/commerce/listings`, `/v2/commerce/prices`, `/v2/items` |
| **Historial** | Placeholder para Fase 3 | — |

**KPIs de Transacciones:**
- Total en compras (rojo), Total en ventas (verde), Balance (verde/rojo)
- Formato de monedas unificado: `3 g 17 s 88 c`

**Embellecimiento visual:**
- Título con glow dorado
- Labels de Gemas y Oro con glow de color + contenedor
- Outputs con fondo oscuro y borde
- Botones con íconos
- Estado con color semántico
- Referencia 400 con contenedor destacado
- KPIs de Transacciones con glow
- Tabs con hover y estado activo mejorado

### 🔧 Mejoras en `wallet-theme.js`

**Glow neutro en íconos:** Las divisas sin color asignado ahora reciben un glow blanco sutil (`rgba(255,255,255,0.12)`) para mantener consistencia visual.

### 🗜️ Cap de caché de items

**`api-gw2.js`:** Se agregó un límite de 500 entradas en `items_cache_v1:es`. Si se supera, se eliminan las 100 más viejas y se mantienen 400. Elimina el único riesgo real de cuota de localStorage.

### 📦 Nuevas funciones en `api-gw2.js` (v2.15.0)

| Función | Endpoint | TTL |
|---------|----------|-----|
| `getCommerceListings(opts)` | `/v2/commerce/listings` | 5 min |
| `getCommercePrices(ids, opts)` | `/v2/commerce/prices` | 2 min |
| `getCommerceTransactionsBuys(token, opts)` | `/v2/commerce/transactions/current/buys` | 1 min |
| `getCommerceTransactionsSells(token, opts)` | `/v2/commerce/transactions/current/sells` | 1 min |

### 🗑️ Cambios en `index.html`

- **Eliminado** `#asideConvSection` de la sidebar
- **Agregado** botón `[💎 Conversor]` en el toolbar de Wallet (antes de Dashboard)
- **Agregado** script `converter-modal.js` en orden de carga

### 🔧 Cambios en `app.js`

- **Extraídas** ~246 líneas del conversor a `converter-modal.js`
- **Agregado** wire del botón `walletConverterBtn`

### 🔧 Cambios en `router.js`

- **Eliminada** referencia a `asideConvSection` en `updateSidebarFor`

### 📋 Tabla de Versiones Actualizada

| Archivo | Versión Anterior | Versión Nueva |
|---------|:---:|:---:|
| `api-gw2.js` | v2.13.0-modular | **v2.15.0-modular** |
| `wallet-theme.js` | v1.3.0 | **v1.3.1** |
| `app.js` | v2.6.3 | **v2.7.0** |
| `router.js` | v2.15.0 | **v2.16.0** |

### Archivos nuevos (v6.5.0)
- `js/converter-modal.js` — Modal del Conversor con 3 tabs funcionales + placeholder

### Archivos eliminados
- `assets/data/gemstore-items.json` — Eliminado (reemplazado por tabs con datos reales de API)

---

## 🚀 Novedades v6.4.0 (MAYO 2026) — Módulo de Inventario y Personajes

### 🎒 Inventory Hub — Buscador de Objetos en toda la Cuenta (inventory-hub.js v1.3.1)

**Nuevo módulo que reemplaza a Personajes como pantalla principal de `#/account/characters`.**

**Arquitectura del módulo:**

#/account/characters
        │
        ▼
┌───────────────────┐
│  INVENTORY HUB    │  ← Pantalla principal (nueva)
│  Buscador + KPIs  │
└──────┬────────────┘
       │ [Ver Personajes]
       ▼
┌───────────────────┐
│  LISTA PERSONAJES │  ← Vista actual de characters.js
│  Filtros / POIs   │
└───────────────────┘
       │ [Volver al Inventario]
       ▼
┌───────────────────┐
│  INVENTORY HUB    │  ← Regreso al Hub
└───────────────────┘

**Características principales:**

| Característica | Descripción |
|----------------|-------------|
| **KPIs rápidos** | Materiales, Banco, Legendarios, Personajes, y acceso a "Ver Personajes" |
| **Buscador unificado** | Busca en Materiales, Banco y Armería simultáneamente |
| **Filtros** | Por rareza (dropdown + chips clickeables) y búsqueda por texto |
| **Resultados agrupados** | Mini-cards por rareza + cards de ítems compactas (5 por fila) |
| **Vistas de sección** | Materiales, Banco y Armería con navegación independiente |
| **Modal de ítem** | Stats reales de API con formato de monedas oro-plata-cobre, atributos, ranuras de infusión, bonificaciones |
| **Wiki en español** | Links a `wiki-es.guildwars2.com` |
| **Sin localStorage** | Solo caché en memoria con TTL de 2-5 minutos |

**Búsqueda inteligente:**

| Estado | Comportamiento |
|--------|----------------|
| **Barra vacía** | Muestra 5 ítems de mayor rareza por sección |
| **Con texto** | Filtra por coincidencia parcial en nombre y descripción, hasta 25 resultados |

**Vistas de sección:**

| Sección | Visualización | Características |
|---------|---------------|-----------------|
| **Materiales** | 10 categorías como en el juego | Básicos, intermedios, avanzados, ascendidos, gemas y joyas, cocina, ingredientes, recetas (escribas), festivos, otros |
| **Banco** | Grid de 10×3 slots con paginación cada 30 | Íconos al 80% de la celda, resaltado de búsqueda, slots vacíos visibles |
| **Armería** | Grid de 5 columnas por tipo | Armas, armaduras, espaldares, abalorios/baratijas, otros |

**APIs consumidas (nuevas en api-gw2.js v2.13.0):**

| Función | Endpoint | TTL |
|---------|----------|-----|
| `getAccountBank(token, opts)` | `/v2/account/bank` | 2 min |
| `getAccountMaterials(token, opts)` | `/v2/account/materials` | 2 min |
| `getAccountLegendaryArmory(token, opts)` | `/v2/account/legendaryarmory` | 5 min |

**Modal de ítem — Datos mostrados:**

- Nombre, ícono, descripción
- Rareza, tipo, nivel requerido
- Daño (armas): min_power - max_power (tipo de daño)
- Defensa + peso (armaduras)
- Atributos (Potencia, Precisión, Dureza, Vitalidad, Daño de condición, Curación, Ferocidad, Concentración, Pericia, Resistencia a la agonía)
- Stats disponibles, ranuras de infusión con flags
- Bonificaciones (runas) con niveles
- Sufijo
- Valor NPC en formato oro-plata-cobre
- Flags (Ligado a cuenta, Se liga al usar, Único, No reciclable, No vendible, etc.)
- Ubicación (Banco, Materiales, Armería)
- Botón para copiar código de chat
- Enlace a Wiki en español

**Cambios en `characters.js`:**

| Método | Descripción |
|--------|-------------|
| `getCharacterList()` | Nuevo método que expone la lista de personajes al InventoryHub |
| `renderBackToInventoryButton()` | Botón "← Volver al Inventario" en la vista de personajes |

**Cambios en `api-gw2.js` (v2.12.0 → v2.13.0):**

| Función | Descripción |
|---------|-------------|
| `getAccountBank(token, opts)` | Obtiene el contenido del banco. TTL: 2 min |
| `getAccountMaterials(token, opts)` | Obtiene almacenamiento de materiales. TTL: 2 min |
| `getAccountLegendaryArmory(token, opts)` | Obtiene armería legendaria. TTL: 5 min |

**Cambios en `router.js`:**
- Ruta `#/account/characters` ahora apunta a `InventoryHub.activate()`
- `Characters.activate()` se llama desde el Hub como subvista
- Panel `inventoryPanel` agregado a `showPanel()`
- Mapeo de navegación: `'#/account/characters':'inventory'`

**Cambios en `index.html`:**
- Nuevo panel `<section id="inventoryPanel">`
- Sidebar: ícono cambiado a `assets/icons/Welcome/358409.png`, texto "Inventario y Personajes"
- Script `js/inventory-hub.js` cargado antes de `characters.js`

**Íconos del módulo:**

| Uso | Asset |
|-----|-------|
| Sidebar y título | `assets/icons/Welcome/358409.png` |
| Materiales | `assets/icons/Cuentas/255373.png` |
| Banco | `assets/icons/Cuentas/156670.png` |
| Legendarios | `assets/icons/Cuentas/157085.png` |
| Personajes | `assets/icons/156678.png` |
| Búsqueda | `assets/icons/Welcome/3124974.png` |
| Refrescar | `assets/icons/Welcome/834002.png` |
| Volver | `assets/icons/Welcome/102420.png` |
| Wiki | `assets/icons/Welcome/222580.png` |
| Copiar | `assets/icons/Welcome/155911.png` |

**Categorías de materiales implementadas:**

| Categoría | Descripción |
|-----------|-------------|
| Materiales de artesanía básicos | Materiales crudos cosechados para una amplia variedad de componentes |
| Materiales de artesanía intermedios | Elementos para elaborar inscripciones e insignias |
| Materiales de artesanía avanzados | Elementos para crear runas, sellos y objetos legendarios |
| Materiales ascendidos | Elementos utilizados en la fabricación ascendida y legendaria |
| Gemas y joyas | Materiales utilizados principalmente por joyeros |
| Materiales de cocina | Materias primas para cocinar |
| Ingredientes para cocinar | Materiales de cocina parcialmente preparados |
| Materiales de recetas | Materiales utilizados principalmente por los escribas |
| Materiales festivos | Materiales asociados con eventos festivos |
| Otros materiales | Materiales sin categoría específica |

**Categorías de armería implementadas:**

| Categoría | Tipos incluidos |
|-----------|-----------------|
| Armas | Weapon |
| Armaduras | Armor |
| Espaldares | Back |
| Abalorios y baratijas | Trinket |
| Otros | Todo lo demás |

**Iteraciones de desarrollo (v1.0.0 → v1.3.1):**

| Versión | Cambios principales |
|---------|---------------------|
| v1.0.0 | Buscador básico con resultados planos |
| v1.1.0 | Resultados agrupados por rareza, KPIs con estilo, card "Ver Personajes" |
| v1.1.1 | Sin emojis, íconos de ubicación, orden Materiales→Banco→Armería |
| v1.2.0 | Secciones con 3 filas: encabezado + chips rareza + ítems. Búsqueda vacía = 5 ítems |
| v1.2.1 | Cards 5 por fila, modal con stats completos de API |
| v1.3.0 | Vistas de sección, Materiales con categorías del juego, Banco con grid 10×3, Armería por tipo |
| v1.3.1 | Fix KPIs en fila, 10 categorías de materiales, Armería en grid, Wiki en español, Banco con íconos al 80% |

---

## 🚀 Novedades v6.3.1 (MAYO 2026) — Refactor Arquitectura CSS + Unificación Visual Completa

### 🏗️ Refactor de Arquitectura CSS: Separación en 3 Capas

Tras detectar conflictos de especificidad y sobrescritura entre `main.css`, `theme-polish.css` y los `*-theme.js`, se implementó una separación estricta de responsabilidades en 3 capas:

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Layout** | `main.css` | Estructura, fondos, tipografía, espaciados. **Sin bordes ni box-shadows.** |
| **Piel unificada** | `theme-polish.css` | Bordes neutros `rgba(255,255,255,0.08)`, glow base `rgba(90,110,154,0.12)`, hover unificado `translateY(-3px)` con `--elev-hover`, badges, pills, tablas |
| **Color semántico** | `*-theme.js` | **Solo `border-left: 3px solid <color>`** vía `card.style.borderLeft`. El resto de bordes y sombras lo hereda de `.card` en `theme-polish.css` |

**Regla de oro:** Ningún `*-theme.js` puede sobrescribir `border`, `boxShadow`, `borderRadius` ni `transition`. Solo `borderLeft` + `classList.add('card')`.

### 🛠️ Corrección de Todos los Theme Files

Se corrigieron 5 archivos de tema que estaban aplicando bordes y sombras inline, pisando los estilos de `theme-polish.css`:

| Archivo | Versión | Cambio |
|---------|---------|--------|
| `meta-theme.js` | v1.4.1 → **v1.4.2** | Eliminado `card.style.border` y `card.style.boxShadow`. Solo `borderLeft`. |
| `achievements-theme.js` | v1.1.0 → **v1.1.1** | Eliminado `card.style.border` y `card.style.boxShadow`. Agregado `card.classList.add('card')`. Solo `borderLeft`. |
| `characters-theme.js` | v1.0.0 → **v1.0.1** | Eliminados `card.style.border`, `boxShadow`, `borderRadius`, `transition`. Eliminados event listeners manuales de hover. Solo `borderLeft`. |
| `wv-theme.js` | v1.0.0 → **v1.0.1** | Eliminado `card.style.borderTop/Right/Bottom` y `boxShadow`. Expone `window.WVTheme` para forzar aplicación post-render. Solo `borderLeft`. |
| `wallet-theme.js` | v1.3.0 | Agregado glow en ícono de divisa. Ya aplicaba solo `borderLeft`. |
| `activities-theme.js` | v2.6.0 | Sin cambios. Home Nodes usa bordes de color por tipo (minería/madera/cosecha), caso especial. |

### 🎨 Rediseño de Meta & Eventos (meta.js v3.3.0)

**Objetivo:** Unificar el diseño de las tarjetas de Meta con el estándar visual de Cartera y WV Tienda.

**Cambios:**

| Elemento | Antes | Ahora |
|----------|-------|-------|
| **Ícono de expansión** | Chip/pill con texto y/o logo pequeño | Ícono de 44px con glow del color de expansión (`box-shadow: 0 0 0 2px <color>, 0 0 10px <color>`) |
| **Chips de timing** | Genéricos sin color | Chips con color semántico: verde (activo), ámbar (próximo), azul (más tarde), neutro (info) |
| **Estructura HTML** | `meta-card__subtitle` mezclado con expansión | `meta-card__top` con ícono + título + timing debajo, como `wallet-card__top` |
| **Tag de infusión** | Mismo estilo que "Drop destacado" (ámbar) | Tag con fondo frío celestial `#1a1e28`, texto `#c8dfff`, glow `rgba(150,190,255,0.4)` |
| **Preview de infusiones** | Funcionaba con `bindInfusionPreviews()` | **Fix:** Ahora lee `data-preview` del DOM en vez de buscar en `meta._extItems`. Eliminado `.inf-prev` duplicado de `theme-polish.css`. |

**Nuevas funciones en `meta.js`:**
- `expIconHTML(meta)` — Devuelve el ícono de expansión con glow
- `chipsForTiming(inst, minsRemaining)` — Chips con clases `meta-chip--active/soon/later/neutral`
- `footerDropHTML(meta, item)` — Tag de infusión con `data-preview` para el popup

**Estilos nuevos en `theme-polish.css`:**
```css
.meta-card__iconWrap { width:44px; height:44px; border-radius:10px; background:#0e0f12; display:flex; align-items:center; justify-content:center; border:1px solid #262a33; overflow:hidden; }
.meta-card__icon { width:36px; height:36px; object-fit:contain; }
.meta-card__timing { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
.meta-chip--active { background:rgba(160,255,200,0.12); border-color:rgba(160,255,200,0.3); color:#a0ffc8; }
.meta-chip--soon { background:rgba(255,211,107,0.12); border-color:rgba(255,211,107,0.3); color:#ffd36b; }
.meta-chip--later { background:rgba(123,194,255,0.08); border-color:rgba(123,194,255,0.2); color:#7bc2ff; }
```

**Estilos nuevos en `main.css`:**
```css
.m-tag--infusion { background:linear-gradient(135deg, #1a1e28 0%, #0f141c 100%) !important; border:1px solid #7b9fc8 !important; color:#c8dfff !important; text-shadow:0 0 6px rgba(150,190,255,0.5); box-shadow:0 0 8px rgba(150,190,255,0.3), 0 0 0 1px rgba(150,190,255,0.2) inset !important; font-weight:700; }
```

### 🛒 Rediseño de WV Tienda (wv-shop-ui.js v1.0.2)

**Objetivo:** Eliminar el glow de las tarjetas y dejarlo solo en los íconos de rareza, como en Cartera.

**Cambios:**
- Eliminado `cardDeco` (glow/borde inline en la card)
- El glow ahora solo se aplica al ícono: `iconDeco` con `box-shadow: 0 0 0 2px <color>, 0 0 10px <color>`
- Agregado `setTimeout` post-render para forzar `wv-theme.js` a aplicar `borderLeft` + `class="card"`
- Fix: el `borderLeft` ahora se aplica correctamente buscando el color en `wv-card__name`

**Fix de timing:** `wv-theme.js` no detectaba las cards recién renderizadas porque el observer estaba sobre `#wvPanel` pero las cards se insertan en `#wvShopList`. Se agregó un `setTimeout` en `renderShopArea()` que resetea `__wvThemed` y fuerza `WVTheme.themeAllNow(area)`.

### 💰 Cartera — Glow en Íconos de Divisa (wallet-theme.js v1.3.0)

Agregado glow al ícono de cada divisa en `applyCurrencyTheme()`:
```javascript
if (isColorful) {
  var iconWrap = card.querySelector('.wallet-card__iconWrap');
  if (iconWrap) {
    iconWrap.style.boxShadow = '0 0 0 2px ' + iconBorder + ', 0 0 10px ' + iconGlow;
    iconWrap.style.borderRadius = '10px';
  }
}
```

### 🧪 Actividades — Glow en Íconos de Ecto (activities.js v3.19.6)

Agregado contenedor de ícono con glow en `renderEcto()`:
- Contenedor de 44×44px con `box-shadow: 0 0 0 2px <color>, 0 0 10px <color>`
- Color verde si está hecho, ámbar si pendiente
- Ícono de 32×32px con `object-fit: contain`

### 🔐 Panel de Cuentas — Rediseño "Profile Card" v2.0.0 (accounts-panel.js)

**Objetivo:** Transformar las tarjetas de cuentas en un diseño premium con jerarquía visual clara, mostrando toda la información en un solo pantallazo.

**Cambios mayores:**

| Elemento | Antes (v1.9.0) | Ahora (v2.0.0) |
|----------|----------------|-----------------|
| **Ícono izquierdo** | Ícono del tipo de cuenta (main/alter/f2p) con glow | Ícono decorativo aleatorio (cat tag) con glow del color del tipo |
| **Tags** | Badges con texto (main, alter, farming...) | Solo iconitos 18px en fila con tooltip, debajo de nombre y email |
| **Expansiones** | Siempre visibles en scroll horizontal | **Colapsables** con toggle (chevron + barra de progreso) |
| **Twitch/GeForce** | Dentro de sección "Servicios y API" (colapsable) | **Siempre visibles** en grid de 2 columnas debajo de credenciales |
| **Estado Twitch/GeForce** | Emoji ✅ verde | Ícono `assets/icons/Welcome/156108.png` (✅ vinculado) o `156107.png` (❌ no vinculado) |
| **Credenciales** | Apiladas en sección colapsable | Grid 2 columnas con email, contraseña, Gmail, Twitch, GeForce |
| **GW2 Avanzado** | Sección colapsable con íconos | Fila compacta debajo de expansiones |
| **Formato email** | Color blanco | Color del tipo de cuenta (dorado/violeta/azul) |
| **AP destacado** | Color blanco | Color del tipo de cuenta si > 20.000 |
| **Separadores** | `border-top: 1px solid #2a2c35` | Gradiente horizontal `linear-gradient(90deg, transparent, <color>, transparent)` |
| **Contraseñas** | Texto plano | Campo monospace con ícono de ojo para toggle |
| **Footer** | Sin acciones rápidas | Botones "Copiar Email" y "Copiar API Key" |

**Vista compacta (toggle):** Reduce cada tarjeta a 4 líneas (ícono + nombre + email + datos clave).

**Vista tabla rediseñada:**
- Mismas columnas pero con estética unificada
- `border-left` de color por tipo de cuenta
- Íconos de tags más grandes (18px)
- Zebra striping (`nth-child(even)`)
- Hover en filas
- Encabezados con `text-transform: uppercase`, `letter-spacing`
- AP destacado con color del tipo si > 20k

**Fix de expansiones colapsables:** Se agregó el bloque de wire para `[data-toggle-section]` que faltaba en `renderCards()`. Se corrigieron las rutas de los íconos chevron (`528716.png` y `528717.png` en `assets/icons/Cuentas/`).

### 🩹 Fix de Estado Online en Purchase Detail (wv-purchase-detail.js)

**Bug:** El estado online mostraba información incorrecta porque `refreshAllOnlineStatus()` usaba el índice del array `state.accounts` para actualizar la fila, pero la tabla estaba ordenada por delta (Δ), no por el orden original.

**Fix:**
- Se agregó `data-token` a cada `<tr>` en `renderTable()`
- `updateSingleAccountRow` ahora busca por `tr[data-token="..."]` en vez de por índice
- `refreshAllOnlineStatus()` y `loadAll()` llaman con `acc.token` en vez de `i`
- Emoji 🕐 reemplazado por ícono local `assets/icons/523381.png`

### 💱 Conversor Gem ↔ Gold — Rediseño Visual

**Cambios en `index.html`:**
- Quick-chips (100, 400, 800, 1200 / 10g, 100g, 250g) ahora usan clase `conv2-chip` (estilo badge/pill)
- Las dos secciones (Gemas y Oro) envueltas en `conv2-card` con borde sutil y sombra
- Estado "Actualizado." ahora es un `<span class="conv2-state">` con estilo pill

**Estilos nuevos en `theme-polish.css`:**
```css
.conv2-card { background:#0f1116; border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px 10px; box-shadow:0 0 6px rgba(90,110,154,0.08); }
.conv2-chip { padding:3px 8px; border-radius:14px; font-size:0.7rem; font-weight:600; background:#1a1c24; border:1px solid #2a2c35; color:#b4bad0; cursor:pointer; transition:all 0.15s ease; }
.conv2-chip:hover { border-color:#5276ff; color:#e0e4ed; background:#1f2230; box-shadow:0 0 6px rgba(82,118,255,0.2); }
.conv2-state { display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.7rem; background:#1a1c24; color:#9aa2b8; }
```

### 📈 Dashboard de Cartera Multi-Cuenta — KPIs y Tabla

**Cambios en `wallet-dashboard.js`:**
- KPIs ahora tienen `border-left` semántico + glow suave:
  - Oro: `border-left: 3px solid rgba(244,197,66,0.5); box-shadow: 0 0 8px rgba(244,197,66,0.15)`
  - Karma: `border-left: 3px solid rgba(175,99,223,0.5); box-shadow: 0 0 8px rgba(175,99,223,0.15)`
  - Laurel: `border-left: 3px solid rgba(43,193,78,0.5); box-shadow: 0 0 8px rgba(43,193,78,0.15)`
  - AA: `border-left: 3px solid rgba(123,194,255,0.5); box-shadow: 0 0 8px rgba(123,194,255,0.15)`
- Tabla con estilos unificados: zebra, hover, sticky header, `border-bottom: 2px solid #2a2c35`

### 🔧 Fix de Botón Dashboard de Wallet (index.html)

El botón "Dashboard" en el panel de Cartera no funcionaba porque el event listener no se enganchaba a tiempo. Se agregó en `DOMContentLoaded`, **antes** de `wirePDButton()`:

```javascript
var dashboardBtn = document.getElementById('walletDashboardBtn');
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', function (e) {
    e.preventDefault();
    location.hash = '#/wallet/dashboard';
  });
}
```

### 🗑️ Limpieza de `wv-theme.js` duplicado en index.html

Se eliminó la carga duplicada de `wv-theme.js` en el bloque `defer` (ya se cargaba en el bloque `sync` al final).

### 📋 Tabla de Versiones Actualizada (index.html)

| Archivo | Versión Anterior | Versión Nueva |
|---------|:---:|:---:|
| `meta.js` | v3.2.1 | **v3.3.0** |
| `meta-theme.js` | v1.4.1 | **v1.4.2** |
| `achievements-theme.js` | v1.0.0 | **v1.1.1** |
| `characters-theme.js` | v1.0.0 | **v1.0.1** |
| `wv-shop-ui.js` | v1.0.0 | **v1.0.2** |
| `wv-theme.js` | v1.0.0 | **v1.0.1** |
| `accounts-panel.js` | v1.9.0 | **v2.0.0** |
| `activities.js` | v3.19.3 | **v3.19.6** |

---

## 🚀 Novedades v6.3 (MAYO 2026) — Unificación Visual + Desacople WV + Rediseño de Módulos

### 🎨 Receta Visual Unificada (Standard Visual Recipe)

Tras múltiples iteraciones, se estableció un estándar visual común para todas las cards de la aplicación. Esta receta reemplaza los estilos individuales que cada módulo aplicaba por separado:

| Propiedad | Valor | Notas |
|-----------|-------|-------|
| **Borde general** | `1px solid rgba(255,255,255,0.08)` | Neutro, unificado en todos los módulos |
| **Borde izquierdo** | `3px solid rgba(<color-tema>, 0.5)` | Color semántico: profesión, rareza, tipo de cuenta, facción |
| **Glow base** | `0 0 8px rgba(90,110,154,0.12)` | Suave, unificado. Reemplaza glows individuales de colores |
| **Hover transform** | `translateY(-3px)` | Elevación consistente en todas las cards |
| **Hover shadow** | `0 10px 28px rgba(0,0,0,0.45), 0 0 16px rgba(90,110,154,0.20), 0 0 0 1px rgba(82,118,255,0.12)` | Profundidad + glow intensificado |
| **Transición** | `0.22s cubic-bezier(0.2, 0.9, 0.4, 1.1)` | Suave, con rebote sutil |
| **Border-radius** | `10px` (cards), `12px` (paneles) | Consistente en toda la app |

**Archivos que implementan esta receta:**

| Archivo | Alcance | Color del border-left |
|---------|---------|----------------------|
| `theme-polish.css` | Clase `.card` base + `.table-unified` extendido | Heredado por todos |
| `wallet-theme.js` | Cards de Cartera | Color de la divisa (gems #4BBDF0, coins #F4C542, karma #AF63DF, etc.) |
| `meta-theme.js` | Cards de Meta & Eventos | Color de la expansión/temporada |
| `achievements-theme.js` | Cards de Logros | Color de la categoría |
| `characters-theme.js` | Cards de Personajes | Color de la profesión (Guardian #73b9ff, Warrior #ffd966, etc.) |
| `wv-theme.js` | Cards de Tienda y Objetivos WV | Color de rareza del ítem o modo (PvE/PvP/WvW) |
| `activities.js` | Cards de Ecto, Fractales, PSNA | Color semántico (verde=hecho, ámbar=pendiente, azul=info) |
| `accounts-panel.js` | Cards y filas de Cuentas | Color del tipo (main #ffd966, alter #b19cd9, f2p #7bc2ff) |
| `wallet-dashboard.js` | KPIs del Dashboard | Color semántico por KPI (oro, karma, laurel, AA) |
| `inventory-hub.js` | Cards de ítems, KPIs, vistas de sección | Color de rareza del ítem (Legendary #974EFF, Ascended #FB3E8D, etc.) |

### 🆕 Módulos de UI desacoplados de router.js

**Problema:** `router.js` (v2.14.0) tenía ~1200 líneas mezclando navegación, estado de tienda, estado de objetivos, renderizado HTML completo de tienda (~300 líneas), renderizado HTML de objetivos (~150 líneas), estilos inline y lógica de negocio. Era frágil, difícil de mantener y cualquier cambio cosmético implicaba riesgo funcional.

**Solución en 3 fases:**

#### Fase 1: `wv-theme.js` (v1.0.0) — Riesgo CERO
Aplica la receta visual unificada a las cards de Tienda y Objetivos de WV **sin tocar router.js**. Usa MutationObserver para cards inyectadas dinámicamente. Lee el color de rareza del título de cada card y aplica `border-left` + borde neutro + glow suave. Si falla, la tienda se ve como antes.

#### Fase 2: `wv-shop-ui.js` (v1.0.0) — Riesgo BAJO
Extrae todo el renderizado de la tienda (~400 líneas) de `router.js` a su propio módulo. Responsabilidades:
- Renderizar cards y tabla de tienda
- Toolbar (filtros, ordenamiento, vista, búsqueda, legacy filter)
- Skeleton loader
- Marcas manuales, pins, auto-refresh
- Wire de eventos (inputs, botones, dropdowns)

El router solo delega con fallback:
```javascript
if (window.WVShopUI) {
  WVShopUI.ensureShopToolbar();
  return WVShopUI.refresh(false).finally(function(){ state.loaded.shop=true; });
}
// Fallback: código original
```

#### Fase 3: `wv-objectives-ui.js` (v1.0.0) — Riesgo BAJO
Extrae el renderizado de objetivos diarios/semanales/especiales (~130 líneas) de `router.js` a su propio módulo. Responsabilidades:
- `renderObjectivesTab(host, data, kind)` — renderiza objetivos con progreso, recompensas, estados
- `renderObjectivesZero(kind)` — modo "reset" cuando no hay datos
- Hydrate de mode pills (PvE/PvP/WvW)

**Resultado:** `router.js` pasó de ~1200 a ~750 líneas. Ahora solo orquesta navegación y ciclo de vida. Para exponer el estado a los nuevos módulos, se agregaron al objeto `api` de WV:
```javascript
__getShopState: function() { return state.shop; },
__getObjState: function() { return state.obj; },
__setObjState: function(kind, data) { state.obj[kind] = data; },
```

### 🆕 `characters-theme.js` (v1.0.0) — Tema de Personajes

Nuevo archivo que aplica la receta visual unificada a las cards de Personajes y reemplaza los `<select>` nativos de POI por dropdowns personalizados (mismo sistema que Logros).

**Colores de profesión:**
| Profesión | Color |
|-----------|-------|
| Guardian | `#73b9ff` |
| Warrior | `#ffd966` |
| Revenant | `#b19cd9` |
| Engineer | `#ff9d5c` |
| Ranger | `#6b8e23` |
| Thief | `#b85e5e` |
| Elementalist | `#ff7b7b` |
| Mesmer | `#c45ec4` |
| Necromancer | `#6a5acd` |

**Funciones clave:**
- `detectProfession(card)` — detecta la profesión desde el texto de la card
- `applyCharTheme(card)` — aplica borde neutro + border-left de color + hover con sombra de profesión
- `enhancePOISelects(root)` — reemplaza `<select>` nativos por dropdowns personalizados con optgroups
- Observer para nuevas cards inyectadas por `characters.js`

### 🆕 Rediseño de Módulos Existentes

#### Cartera (Wallet) — Vista Tabla Unificada
- Íconos de divisa en cada fila (a la izquierda del nombre)
- Categorías migradas de texto plano a badges visuales
- Formato de moneda con colores: oro `#f4c542`, plata `#e0e0e0`, cobre `#b87333`
- Header sticky con `text-transform: uppercase`, `letter-spacing`
- Hover en filas con `background: #1a1d28`
- Estilos unificados con `.table-unified` en `theme-polish.css`
- Nueva función `formatCoinValue()` en `app.js` (misma que Dashboard)

#### Dashboard de Cartera Multi-Cuenta
- KPIs con `border-left` semántico por tipo (Oro `#F4C542`, Karma `#AF63DF`, Laurel `#2BC14E`, AA `#7BC2FF`)
- Iconos decorativos por tipo de cuenta (`main`/`alter`/`f2p`) heredados del Panel de Cuentas
- Sincronización de tags entre `accounts-panel.js` → `gw2_keys` → `wallet-dashboard.js`
- Emoji 📊 de TOTAL reemplazado por ícono local `assets/icons/578844.png`
- Nueva función `getAccountIcon(tag)` con fallback aleatorio

#### Panel de Cuentas
- **Pantalla de carga rediseñada**: layout de 2 columnas (Asistente + Acceso) con cards del mismo alto
- **Texto de seguridad ampliado**: 4 bullets con iconos (cifrado AES, sin servidores, Comunidad Gato Negro)
- **Selector de archivo**: ahora es un botón estilizado que muestra el nombre del archivo seleccionado en verde
- **Vista tabla**: `border-left` por tipo de cuenta (`main`/`alter`/`f2p`), fila expandible al hacer clic
- **Corrección de bugs**: `<tr>` corrupto (`械`), `renderTableRow()` con `colspan` correcto
- Nueva función `getBorderColor(account)` para colores por tipo

#### Modal de API Keys
- Lista de keys con iconos de tipo de cuenta (hereda de `accounts-panel.js`)
- Badge "✓ En uso" en la key seleccionada (verde)
- Key ofuscada con icono de candado
- Botones con iconos: Usar, Copiar, Renombrar, Eliminar
- Botón Eliminar destacado en rojo con fondo semitransparente
- Estado vacío con icono y mensaje descriptivo
- Nuevas constantes `ACCOUNT_TYPE_ICONS` y `CONFIG_ICONS` en `app.js`
- Nuevo método `KeyManager.setKeyTag(token, tag)` para persistir tipo de cuenta

#### Actividades
- Cards de Ecto: `border-left` verde (#a0ffc8) si está hecho, ámbar (#ffd36b) si pendiente
- Cards de Fractales T4: `border-left` verde, ámbar si tiene CM
- Cards de Fractales Recomendados: `border-left` azul (#7bc2ff)
- Cards de PSNA: `border-left` azul unificado

### 🗑️ Eliminaciones (v6.3)

#### Modo Deluxe de Meta & Eventos
No tenía efecto visual real porque `meta-theme.js` ya pisa el `border-left` con el color de la expansión. Se eliminó:
- Variable `LS_META_DELUXE` y `DELUXE_DEFAULT` de `meta.js`
- Función `setDeluxe()` de `meta.js`
- Botón Deluxe de `injectUIToggles()` en `meta.js`
- Estilos CSS `body[data-meta-deluxe="on"]` de `main.css`
- El Modo Compacto se mantiene intacto

#### `wallet-cur-theme-patch.js`
Archivo redundante (v2.3.1) que competía con `wallet-theme.js`:
- Aplicaba bordes con `!important` y `removeProperty('box-shadow')`
- Eliminaba el glow unificado que aplica `wallet-theme.js`
- Usaba heurísticas frágiles para detectar el panel de Cartera
- Tenía su propio sistema de observers y polling
- **Eliminado del proyecto** — `wallet-theme.js` (v1.4.0) cubre toda la funcionalidad

---

## 🚀 Novedades v5.9 (mantenido)

### 🆕 Google Analytics y Eventos Personalizados

**Integración con Google Analytics (GA4):**
- Script de seguimiento agregado en `<head>` de `index.html` con ID `G-LB782QT9TR`
- Mide visitas, usuarios activos, ubicación geográfica, dispositivo, navegador, fuente de tráfico y duración de sesión

**Eventos personalizados (analytics.js v1.0.0):**
- Archivo centralizado `js/analytics.js` con API pública `window.Analytics`
- Cola de eventos segura: si gtag no está cargado, los eventos se guardan y se envían cuando esté disponible
- Función `sendEvent(eventName, eventParams)` con fallback y debug en consola

**Eventos medidos en la app:**

| Evento | Disparo | Archivo |
|--------|---------|---------|
| `view_module` | Navegación a cada módulo (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, **wallet_dashboard**, **raids**, **inventory**) | `router.js` |
| `export_backup` | Exportación de backup | `settings-manager.js` |
| `import_backup` | Importación de backup | `settings-manager.js` |
| `open_account_wizard` | Apertura del asistente de cuentas | `accounts-panel.js` |
| `download_excel_template` | Descarga de plantilla Excel | `accounts-panel.js` |
| `enrich_with_api` | Enriquecimiento con GW2 API | `accounts-panel.js` |
| `encrypt_accounts_file` | Creación de archivo .enc cifrado | `accounts-panel.js` |
| `force_reload_season` | Recarga forzada de temporada WV | `wizards-vault.js` |
| `open_api_keys_modal` | Apertura del modal de API Keys | `app.js` |
| `add_api_key` | Agregar nueva API Key | `app.js` |
| `delete_api_key` | Eliminar API Key | `app.js` |

**Código agregado en `<head>`:**
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-LB782QT9TR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-LB782QT9TR');
</script>

<!-- Eventos personalizados -->
<script src="js/analytics.js"></script>
```

### 🆕 Automatización de compras en Wizard's Vault (v1.11.0 / v2.12.0)

**Dashboard de compras (wv-purchase-detail.js v1.11.0):**

- **Barra de progreso compacta** en cada celda de ítem fijado, mostrando estado visual (✅ Completado / ⚠️ Pendiente)
- **Input numérico + botón MAX** para marcas manuales, con auto-guardado (debounce 500ms)
- **Regla dual:** `Math.max(apiPurchased, manualMarks)` — muestra el valor más alto entre la API y las marcas manuales
- La API reporta correctamente las compras de temporadas anteriores (verificado con `/v2/account/wizardsvault/listings`)

**Tienda unificada (router.js v2.12.0):**

- **Barra de progreso e input manual integrados como parte nativa del HTML** de cada tarjeta (no dependen de `enhanceShopCards`)
- **Eliminado event listener conflictivo** de `wv:season-store:mutate` que recreaba la tienda innecesariamente
- **Persistencia de marcas directamente en WVSeasonStore** sin recargar toda la tienda
- **Las barras no desaparecen** al modificar valores ni al cambiar de pestaña
- Funciones internas: `saveManualMark()`, `updateCardUI()`, `setupManualInputEvents()`

### 🆕 Sistema de Backup/Restaurar (settings-manager.js v1.0.1)

Nuevo módulo que permite exportar e importar toda la configuración de la app entre navegadores/dispositivos.

**Características:**
- **Exportación completa**: API Keys, WV pins, Wallet (pins, snapshots, compact), Activities (toggles, home nodes), Characters (POIs, ubicaciones), Meta (favoritos, hecho hoy), configuración global
- **Importación**: validación de versión, confirmación de sobrescritura, recarga automática
- **Botones en utilbar**: Backup (`assets/icons/155034.png`) y Restaurar (`assets/icons/155033.png`)
- **Formato JSON**: versión 3.0, incluye timestamp de exportación

**Claves de localStorage correctas:**
- API Keys: `gw2_keys` (lista) y `gw2_selected_key_v1` (seleccionada)
- WV: `wv:season:*` y `wv:season:index`
- Wallet: `walletPins:*`, `walletSnapshot:*`, `walletCompact`
- Activities: `gn_activities_toggles`, `gn_home_nodes_marked`
- Characters: `characters:assignments:*`, `characters:location_history:*`
- Meta: `gn_meta_hecho_hoy:*`, `gn_meta_favs:*`
- Global: `gn_welcome_seen`

### 🆕 Header Compacto (index.html)

Rediseño del header para optimizar el espacio vertical:

- **Altura reducida**: ~60px (vs ~140px anterior)
- **Logo + nombre**: en una sola línea con tipografía Cinzel Decorative
- **Eliminación de hero**: las tabs del hero ya no son necesarias (la navegación está en sidebar)
- **Responsive**: en móvil se apila verticalmente

**Estructura:**
```html
<header class="an-header an-header--compact">
  <div class="an-utilbar">
    <div class="an-util-left">
      <div class="brand-compact">
        <img class="brand-logo-compact" src="assets/logo-gato-negro.png">
        <span class="brand-name">Bóveda del Gato Negro</span>
      </div>
      <!-- enlaces y selector de API Key -->
    </div>
    <div class="an-util-right">
      <!-- botones Backup/Restaurar + redes sociales -->
    </div>
  </div>
</header>
```

### 🆕 Mejoras en Cámara del Brujo (WV)

- **Tooltip informativo**: Reemplazo del texto largo por ícono `assets/icons/155018.png` con tooltip, ubicado junto al título "Cámara del Brujo"
- **CSS de contención**: Estilos para evitar desbordes del panel
- **🆕 Ícono de recarga forzada de temporada**: Ícono `assets/icons/Welcome/834002.png` ubicado junto al tooltip, que permite al usuario forzar manualmente la recarga de la información de temporada cuando no se visualice correctamente. Al hacer clic, ejecuta `forceReloadSeason()` que actualiza título, fechas y persistencia en `WVSeasonStore`.

```html
<span id="wvSyncNote" class="wv-sync-tip" title="Los endpoints de objetivos de Wizard's Vault solo se actualizan después de que el jugador ha iniciado sesión en el juego.">
  <img src="assets/icons/155018.png" width="20" height="20" alt="Info">
</span>
```

### 🆕 Iconos de redes sociales en utilbar

Reemplazo de SVGs por imágenes locales para consistencia visual:

| Red | Imagen |
|-----|--------|
| Discord | `assets/icons/Welcome/discord.png` |
| Instagram | `assets/icons/Welcome/instagram.png` |
| YouTube | `assets/icons/Welcome/youtube.png` |
| Twitch | `assets/icons/Welcome/twitchlogo.png` |
| GitHub | `assets/icons/Welcome/github.png` (nuevo) |

### 🆕 Pantalla de Bienvenida (welcome-panel.js v1.2.0)

Nueva pantalla de inicio que se muestra en primera visita o cuando no hay API key seleccionada.

**Ruta:** `#/welcome`

**Características:**

- **Sección de funcionalidades**: Lista completa de 7 acciones con iconos exclusivos (no repetidos de los paneles)
- **Sección API Key**: Botones para agregar o gestionar keys, enlace a ANet
- **Sección Asistente de Cuentas**: Acceso rápido al asistente con mensajes de seguridad
- **Sección Acceso Rápido**: 7 botones a todos los módulos con sus iconos originales
- **Sección Comunidad**: Enlaces a Discord, Instagram, YouTube, Twitch, GitHub y email
- **Sección Apoyo**: Enlaces a PayPal y Ko-fi

**Lógica de redirección:**
- Primera visita (`gn_welcome_seen` no existe) → redirige a `#/welcome`
- No hay API key seleccionada → redirige a `#/welcome`
- Usuario puede navegar manualmente a `#/welcome` desde el botón home

**Botón home en utilbar:**
- Icono `assets/icons/Welcome/3380755.png`
- Ubicado al inicio del utilbar
- Lleva a `#/welcome`

**Iconos exclusivos de funcionalidades:**
| Funcionalidad | Ruta |
|---------------|------|
| Cartera | `assets/icons/welcome/wallet-icon.png` |
| Meta & Eventos | `assets/icons/welcome/meta-icon.png` |
| Logros | `assets/icons/welcome/achievements-icon.png` |
| Cámara del Brujo | `assets/icons/welcome/wv-icon.png` |
| Actividades | `assets/icons/welcome/activities-icon.png` |
| Personajes | `assets/icons/welcome/characters-icon.png` |
| Cuentas | `assets/icons/welcome/accounts-icon.png` |

### Iconos utilizados

| Elemento | Ruta |
|----------|------|
| Home (utilbar) | `assets/icons/Welcome/3380755.png` |
| Título bienvenida | `assets/icons/Welcome/3380755.png` |
| Seguridad | `assets/icons/welcome/shield-icon.png` |
| Paso 1 (descarga) | `assets/icons/welcome/download-icon.png` |
| Paso 2 (subida) | `assets/icons/welcome/upload-icon.png` |
| Paso 3 (API) | `assets/icons/welcome/globe-icon.png` |
| Paso 4 (cifrado) | `assets/icons/welcome/lock-icon.png` |
| Mago (asistente) | `assets/icons/welcome/wizard-icon.png` |
| Pin (acceso rápido) | `assets/icons/welcome/pin-icon.png` |
| Comunidad | `assets/icons/welcome/community-icon.png` |
| Discord | `assets/icons/welcome/discord-icon.png` |
| Instagram | `assets/icons/welcome/instagram-icon.png` |
| YouTube | `assets/icons/welcome/youtube-icon.png` |
| Twitch | `assets/icons/welcome/twitch-icon.png` |
| GitHub | `assets/icons/welcome/github-icon.png` |
| Email | `assets/icons/welcome/email-icon.png` |
| Café (apoyo) | `assets/icons/welcome/coffee-icon.png` |
| PayPal | `assets/icons/welcome/paypal-icon.png` |
| Ko-fi | `assets/icons/welcome/kofi-icon.png` |

### 🆕 Asistente de Cuentas (accounts-panel.js v1.3.1)

Nuevo asistente integrado en el panel de cuentas que permite a los usuarios crear archivos `.enc` de forma guiada, sin necesidad de conocimientos técnicos. Todo el proceso ocurre localmente en el navegador.

**Interfaz del panel:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧙 Asistente de cuentas              [➕ Crear nuevo archivo] │
│ Guía paso a paso para crear tu archivo seguro          │
├─────────────────────────────────────────────────────────┤
│ 🔐 Acceso a cuentas                                    │
│ 📁 Último archivo: gw2-cuentas.enc                     │
│ [🔓 Usar archivo guardado]                             │
│ O seleccioná un archivo diferente:                     │
│ [📁 Archivo] [🔑 Contraseña] [🔓 Cargar y mostrar]     │
└─────────────────────────────────────────────────────────┘
```

**Asistente modal (4 pasos con iconos):**

| Paso | Acción | Icono | Descripción |
|------|--------|-------|-------------|
| **1** | Descargar plantilla Excel | 📥 | Archivo con columnas predefinidas (id, nombre, email, password, apiKey, twitch_user, twitch_email, twitch_password, geforce_linked, notas, tags) |
| **2** | Subir Excel → Generar JSON | 📤 | Convierte el Excel completado a formato JSON y descarga `cuentas.json` |
| **3** | Enriquecer con GW2 API | 🌐 | Usa las API Keys de la Bóveda para obtener: account name, AP, fecha creación, expansiones detectadas |
| **4** | Cifrar con contraseña | 🔐 | Genera el archivo `.enc` listo para cargar en el panel (`gw2-cuentas.enc`) |

**Funciones clave del asistente:**

| Función | Propósito |
|---------|-----------|
| `generateExcelTemplate()` | Genera y descarga plantilla Excel con columnas predefinidas |
| `parseExcelToJSON(file)` | Convierte archivo Excel a JSON |
| `enrichWithGW2API(data)` | Enriquece datos con información de GW2 API |
| `openWizardModal()` | Abre modal con los 4 pasos del asistente (con iconos) |

**Seguridad destacada:**
- Todo el procesamiento ocurre en el navegador
- No hay servidores, no hay bases de datos externas
- Los datos nunca salen de la computadora del usuario
- Mensajes de seguridad visibles en el modal

**Dependencias externas:**
- `crypto-js` v4.2.0 (CDN) para cifrado AES
- `xlsx.full.min.js` v0.20.2 (CDN) para manejo de archivos Excel

### 🆕 Panel de Cuentas — Rediseño completo (accounts-panel.js v1.9.0)

Panel para gestión segura de múltiples cuentas de Guild Wars 2 con cifrado local, persistencia inteligente y un asistente para crear archivos `.enc` desde Excel.

**Características principales:**
- **Cifrado local**: Archivo JSON cifrado con AES (CryptoJS) y contraseña personal
- **Persistencia inteligente**: Guarda último archivo en `localStorage` para acceso rápido (al recargar, solo pide contraseña)
- **Vista dual**: Tarjetas / Tabla con botón toggle (persiste en sesión)
- **Información sensible**: Contraseñas ocultas con `••••••••`, se muestran con botón 👁️ (reemplazado por imagen local `assets/icons/welcome/528726.png`)
- **Copia al portapapeles**: Click en email, contraseña, Gmail Pass, Twitch username, Twitch email, Twitch password o API Key copia el valor con feedback visual (toast)
- **Expandir/colapsar**: Click en nombre de cuenta muestra información adicional (mochilas, bancos, material, legendarias)
- **Secciones colapsables**: Credenciales, GW2 Avanzado, Expansiones, Servicios y API
- **Subsección "Servicios"**: Dentro de Servicios y API, muestra detalle de Twitch y GeForce Now
- **Twitch detallado**: Username (copiable), Email (copiable si existe), Password (toggle independiente + copiable si existe)
- **GeForce Now**: Texto "Vinculado" con imagen local `assets/icons/Welcome/156108.png` en lugar de emoji ✅
- **Iconos separados para títulos de secciones vs campos internos**:
  - Credenciales (título): `assets/icons/Welcome/733266.png`
  - Contraseña (campo): `assets/icons/Cuentas/733265.png` (se mantiene)
  - GW2 Avanzado (título): `assets/icons/Cuentas/358409.png`
  - Chars (campo): `assets/icons/Cuentas/156409.png` (se mantiene)
- **Barra de estadísticas**: Separadores optimizados con `margin: 0 -6px` para mejor ajuste en zoom 100%
- **Iconos personalizables**:
  - Icono de cuenta (todas): `assets/icons/Cuentas/GW2free.png`
  - Icono de Twitch: `assets/icons/Cuentas/twitchlogo.png`
  - Icono de GeForce Now: `assets/icons/Cuentas/gforce.png`
  - Expansiones: iconos individuales en `assets/icons/Cuentas/`

**Datos gestionados por cuenta:**
- Credenciales: Email, contraseña, Gmail Pass
- GW2: Account name, fecha creación, AP, slots de personaje, mochilas, bancos, material storage, legendarias, nivel 80
- Expansiones: Core, Heroic, HoT, PoF, EoD, SoTO, JW, VoE (con iconos)
- Servicios: Twitch (username, email, password), GeForce Now
- API Key
- Notas y tags (main, alter, f2p, farming, keys, weekly, taxi)

**Persistencia:**
- `accounts:lastFile` → Último archivo cifrado cargado (localStorage)
- Estado de contraseñas (GW2 y Twitch) en memoria (sesión, no persiste entre recargas)
- Estado de expansión de secciones en memoria (sesión)

**Ruta:** `#/account/accounts`

### 🆕 Mejora en detección automática de llave semanal (Activities v3.19.3)

Nueva lógica para detectar si la llave del León Negro fue reclamada, con validación de semana actual.

**Lógica implementada:**
```javascript
// Busca Thiefs que cumplan TODAS estas condiciones:
// 1. Profesión === 'Thief'
// 2. Nivel >= 10
// 3. Antigüedad < 7 días
// 4. Fecha de creación > último reset semanal (lunes 07:30 UTC)
```

**Función auxiliar `getLastWeeklyResetUTC()`:**
- Calcula la fecha del último reset semanal (lunes 07:30 UTC)
- Maneja el caso especial de lunes antes de las 07:30 (reset fue el lunes pasado)

**Casos de prueba validados:**
| Escenario | Antigüedad | ¿Creado después del reset? | Resultado |
|-----------|------------|---------------------------|-----------|
| Thief creado domingo (antes del reset) | 6.4 días | ❌ | **NO cuenta** → llave DISPONIBLE |
| Thief creado lunes (después del reset) | <7 días | ✅ | **SÍ cuenta** → llave RECLAMADA |
| Thief creado miércoles (misma semana) | <7 días | ✅ | **SÍ cuenta** → llave RECLAMADA |

**Mejoras visuales:**
- UI dedicada en la parte superior del panel de actividades
- Eliminado marcado manual (checkbox deshabilitado)
- Leyenda informativa: "nivel 10+, <7 días, **misma semana**"
- Botones de Leivas (+/-) mantienen su funcionalidad intacta

### 🆕 Barra de horarios unificada — Activities + Meta & Eventos (v2.5.0 / v1.3.1)

Nueva barra de horarios implementada en ambos módulos con estándar visual común:

- **Iconos oficiales de GW2 desde wiki**:
  - 🌍 UTC: World completion bouncy icon
  - 🏠 Local: Activation icon
  - ⏰ Reset diario: Game menu log out icon
  - 📅 Reset semanal: Tango-recharge-darker icon

- **Información en tiempo real**:
  - Hora servidor UTC y hora local con actualización cada segundo
  - Cuenta regresiva para reset diario (00:00 UTC) y semanal (lunes 07:30 UTC)
  - Formato unificado: `Xd Xh Xm Xs` con segundos

- **Tooltips informativos**: Cada elemento muestra información adicional al hacer hover

### 🆕 Migración completa a íconos locales (v5.3)

**Profesiones (Characters.js v2.3.0)**
- `loadProfIcons()` ahora usa íconos locales en lugar de API
- Íconos en `assets/icons/professions/2163502.png` a `2163510.png`
- Eliminada dependencia de `/v2/files` para íconos de profesión

**Fractales (Activities.js v3.19.0)**
- Reemplazado sistema de íconos de wiki por ícono genérico local
- Nuevo ícono: `assets/icons/Fractal/2591.png`
- Simplificadas funciones `getFractalIconHtml()` y `getScaleIconHtml()`

**Conversor (index.html)**
- SVG de gemas y oro reemplazados por imágenes locales
- Íconos en `assets/icons/502065.png`, `assets/icons/619316.png`, `assets/icons/784280.png`

**Purchase Detail (wv-purchase-detail.js)**
- Íconos de countdowns (diario, semanal, temporada) migrados a locales
- Banner y botón de acceso usan ícono local `3594051.png`

### 🆕 Títulos de paneles con íconos

- Cartera: `assets/icons/733322.png`
- Meta & Eventos: `assets/icons/102420.png`
- Logros: `assets/icons/155059.png`
- Cámara del Brujo: `assets/icons/3172791.png`
- Actividades: `assets/icons/1302773.png`
- Personajes: `assets/icons/156678.png`
- **Cuentas: `assets/icons/Cuentas/GW2free.png`**
- **Bienvenida: `assets/icons/ui/home.png`**
- **Raids: `assets/icons/raids/raid-icon.png` (NUEVO)**
- **Inventario y Personajes: `assets/icons/Welcome/358409.png` (NUEVO)**

### 🆕 Corrección de rutas assets para GitHub Pages

- Eliminada barra inicial `/` en todas las rutas de assets
- Rutas ahora relativas: `assets/icons/xxx.png` (no `/assets/icons/xxx.png`)
- Afecta: `index.html`, `activities.js`, `characters.js`, `wv-purchase-detail.js`, `accounts-panel.js`, `welcome-panel.js`, `wallet-dashboard.js`, `raid-tracker.js`, **`inventory-hub.js`**

### 🆕 Home Nodes — Rediseño completo (v2.3.0)

Rediseño total del panel de nodos de Heredad con nuevo estándar visual:

- **Lista completa**: 74 elementos (53 nodos API + 6 Janthir + 15 contratos/consumibles)
- **Estado en tiempo real**: ✅ Desbloqueado / ❌ No desbloqueado (vía API `/v2/account/home/nodes`)
- **Sistema de filtros avanzado**:
  - Por categoría: Nodos API (53) / Janthir (6) / Contratos (15)
  - Por tipo: Minería (⛏) / Madera (🪓) / Cosecha (✂)
  - Por estado: Desbloqueado (✅) / Bloqueado (❌)
- **Tarjetas rediseñadas**:
  - Icono de tipo grande (44px) con glow según categoría
  - Imagen del ítem destacada (64px) con contenedor con borde y sombra
  - Checkbox de "Recolectado hoy" con persistencia por día en localStorage
  - Badge de estado visual con colores semánticos
- **Contador de progreso**: Muestra recolección diaria y total desbloqueados
- **Sistema de fallback**: URLs de imágenes hardcodeadas desde gw2treasures

### 🆕 Characters — Panel de Personajes (v2.3.0)

Panel completo que gestiona:

- Lista de personajes con profesión, raza, nivel y gremio.
- Carga optimizada: batch processing (3 a la vez), timeout 8s, reintentos automáticos (2 intentos).
- Caché de personajes con TTL de 5 minutos (localStorage por cuenta).
- Historial de ubicaciones (locationHistory) para persistir última ubicación conocida.
- Asignación manual de POIs (puntos de interés) con persistencia por cuenta y categorías (granja, puzzle, evento, meta).
- Filtros: búsqueda por nombre, filtro por mapa, por profesión y por categoría de POI.
- Vista tarjetas / tabla con paginación.
- **Íconos de profesión locales**: migrados a `assets/icons/professions/`
- Eventos personalizados: `characters:load:start`, `load:progress`, `load:complete`, `load:failed`, `characters:assignment:changed`.
- Rangos PvP/WvW vía `/v2/pvp/stats` y `/v2/account`.
- **Nuevo método `getCharacterList()`**: Expone la lista de personajes al InventoryHub.
- **Nuevo botón "← Volver al Inventario"**: Navegación de regreso al Hub desde la vista de personajes.

### 🆕 Almacenamiento por temporada (WVSeasonStore v1.1.1)

- Un archivo JSON por temporada en LocalStorage: `wv:season:<YY>:<SEQ>`
- Índice global: `wv:season:index`
- Migra desde legacy: `gw2_wv_pinned_v1`, `gw2_wv_marks_v1`
- QuotaExceeded: atomic shadow write, fallback no-shadow, compactación agresiva
- Preparado para historial de temporadas

### 🆕 Interpretación robusta `/v2/wizardsvault`

- Parser consolidado: payloads planos o con `{ season:{...}, title }`

### 🆕 Wizards' Vault v1.2.1

- API pública compatible v1.1.0
- Integrado con SeasonStore (migración background)
- Normalización segura para dashboard

## 🚀 Novedades v6.0 (ABRIL 2026)

### 🆕 Estado online basado en last_modified

**Reemplazo completo de la lógica de PvP por `last_modified` de `/v2/account`:**

| Aspecto | Antes (PvP) | Ahora (last_modified) |
|---------|-------------|------------------------|
| **Detección** | Solo partidas PvP terminadas | CUALQUIER actividad (PvP, PvE, WvW, economía) |
| **Permiso necesario** | `pvp` | `account` (todas las keys lo tienen) |
| **Latencia** | Media (solo al terminar partida) | Baja (cambios inmediatos) |
| **Endpoint** | `/v2/pvp/games?ids=all` | `/v2/account?v=latest` |
| **Icono** | ⚔️ (PvP) | 🕐 (actividad general) |

**Cambios en `api-gw2.js` (v2.11.0):**
- Nueva función `getAccountInfo(token, opts)` con `?v=latest` para obtener `last_modified`
- Nueva función `isRecentlyActive(accountInfo, minutesThreshold)`
- Eliminadas funciones `getPvPGames` e `isRecentlyActiveInPvP`
- TTL de 30 segundos para datos de actividad

**Código de `getAccountInfo`:**
```javascript
function getAccountInfo(token, opts) {
  opts = opts || {};
  if (!token) return Promise.reject(new Error('Falta access_token'));
  
  var key = 'account_info';
  var ttl = 30 * 1000; // 30 segundos de caché para tiempo real
  
  var cached = getCache(key, ttl, token, opts.nocache);
  if (cached) return Promise.resolve(cached);
  
  // IMPORTANTE: ?v=latest para obtener last_modified
  var url = withToken(CFG.API_BASE + '/v2/account?v=latest', token);
  var ikey = 'if:account_info:' + fpToken(token);
  
  return inflightOnce(ikey, function() {
    return fetchWithRetry(url, opts).then(function(data) {
      putCache(key, data, token, ttl);
      return data;
    });
  });
}
```

**Código de `isRecentlyActive`:**
```javascript
function isRecentlyActive(accountInfo, minutesThreshold) {
  if (!accountInfo || !accountInfo.last_modified) return false;
  
  var threshold = (minutesThreshold || 20) * 60 * 1000;
  var now = Date.now();
  var lastModified = new Date(accountInfo.last_modified).getTime();
  
  if (isNaN(lastModified)) return false;
  
  return (now - lastModified) <= threshold;
}
```

**Cambios en `wv-purchase-detail.js` (v1.13.0):**
- `loadAll()` ahora usa `getAccountInfo()` + `isRecentlyActive(accountInfo, 20)`
- `refreshAllOnlineStatus()` ahora usa la misma lógica
- Ícono cambiado de ⚔️ (PvP) a 🕐 (actividad general)
- Tooltip actualizado: "Activo (actividad reciente)"
- Umbral: 20 minutos (configurable)

**Lógica de estado online en `loadAll()`:**
```javascript
// Obtener account info (incluye last_modified)
const accountInfo = await root.GW2Api.getAccountInfo(token, { nocache: !!forceNoCache });
const isOnline = root.GW2Api.isRecentlyActive(accountInfo, 20); // 20 minutos de umbral

let lastPlayedChar = null;
if (isOnline && accountInfo && accountInfo.last_modified) {
  const lastModified = new Date(accountInfo.last_modified);
  const now = new Date();
  const minutesSince = Math.floor((now - lastModified) / (1000 * 60));
  lastPlayedChar = `Actividad hace ${minutesSince} min`;
}
```

**Lógica de estado online en `refreshAllOnlineStatus()`:**
```javascript
const accountInfo = await root.GW2Api.getAccountInfo(acc.token, { nocache: true });
const isOnline = root.GW2Api.isRecentlyActive(accountInfo, 20);

if (isOnline && accountInfo && accountInfo.last_modified) {
  const lastModified = new Date(accountInfo.last_modified);
  const minutesSince = Math.floor((now - lastModified) / (1000 * 60));
  lastPlayedChar = `Actividad hace ${minutesSince} min`;
}
```

## 🚀 Novedades v6.1 (ABRIL 2026)

### 🆕 Dashboard de Cartera Multi-Cuenta (wallet-dashboard.js v2.5.0)

**Nuevo módulo que permite visualizar todas las cuentas y sus divisas en una sola tabla.**

**Características principales:**

| Característica | Descripción |
|----------------|-------------|
| **Tabla cuentas vs divisas** | Filas = cuentas (API keys), Columnas = divisas seleccionadas |
| **Selector de divisas** | Dropdown con íconos, persistencia en localStorage |
| **Ordenamiento dinámico** | Clic en encabezado ordena ascendente/descendente |
| **KPIs resumen** | Tarjetas con Total Oro, Total Karma, Total Laurel, Reconocimiento Astral |
| **Formato de moneda** | Oro mostrado como `X g Y s Z c` con colores |
| **Persistencia** | Selección de divisas y ordenamiento guardados en localStorage |
| **Skeleton loader** | Animación de carga mientras se obtienen datos |
| **Scroll horizontal** | Tabla con overflow auto para muchas columnas |

**Acceso:**
- Botón "Dashboard" en el panel de Cartera (`#walletPanel`)
- Cambia el hash a `#/wallet/dashboard`

**Ruta:** `#/wallet/dashboard`

**Divisas por defecto:**
- Gemas (ID 4)
- Oro/Moneda (ID 1)
- Laurel (ID 3)
- Reconocimiento Astral (ID 63)
- Karma (ID 2)
- Esquirla espiritual (ID 23)

**Persistencia en localStorage:**
- `wallet_dashboard_selected_currencies` → IDs de divisas seleccionadas
- `wallet_dashboard_sort` → columna y dirección de ordenamiento

**Código de ejemplo para obtener wallet:**
```javascript
const wallet = await GW2Api.getAccountWallet(token);
// Devuelve array de { id: number, value: number }
```

**Formato de moneda (Oro):**
```javascript
function formatCoinValue(value) {
  var copper = Math.abs(Math.floor(value));
  var gold = Math.floor(copper / 10000);
  var silver = Math.floor((copper % 10000) / 100);
  var copperLeft = copper % 100;
  // Devuelve "X g Y s Z c" con colores
}
```

## 🚀 Novedades v6.2 (ABRIL 2026)

### 🆕 Raid Tracker — Seguimiento Semanal de Raids (raid-tracker.js v1.3.1)

**Nuevo módulo que permite gestionar el progreso semanal de raids de Guild Wars 2, incluyendo todos los encuentros (jefes y eventos).**

**Características principales:**

| Característica | Descripción |
|----------------|-------------|
| **8 alas completas** | Desde Valle Espiritual (Ala 1) hasta Monte Balrior (Ala 8, Janthir Wilds) |
| **33 encuentros totales** | 21 jefes + 12 eventos distribuidos en las 8 alas |
| **Marcado automático** | Vía API `/v2/account/raids` con permiso `progression` |
| **KPIs semanales** | Completados / total y porcentaje de progreso |
| **Modal informativo** | Descripción, estrategia (5+ bullets) y enlace a video tutorial por encuentro |
| **Tipos de encuentro** | Diferenciación visual entre JEFE (👑) y EVENTO (⚡) |
| **Reset semanal** | Automático según lunes 07:30 UTC (misma lógica que Activities) |
| **Manejo seguro de imágenes** | Sin reintentos infinitos, fallback a emojis (🏰 para alas, 👾 para jefes) |
| **Persistencia por token** | Escucha `gn:tokenchange` para recargar datos automáticamente |

**Estructura de alas y encuentros:**

| Ala | Nombre | Encuentros | Jefes | Eventos |
|-----|--------|------------|-------|---------|
| 1 | Valle Espiritual | 4 | 3 | 1 |
| 2 | Paso de la Salvación | 3 | 2 | 1 |
| 3 | Fortaleza de los Fieles | 4 | 2 | 2 |
| 4 | Bastión del Penitente | 4 | 4 | 0 |
| 5 | Salón de los Cadenas | 4 | 3 | 1 |
| 6 | Mito de Mythwright | 3 | 3 | 0 |
| 7 | La Llave de Ahdashim | 4 | 3 | 1 |
| 8 | Monte Balrior (Janthir Wilds) | 3 | 2 | 1 |

**APIs consumidas:**
- `GW2Api.getAccountRaids(token)` → obtiene IDs de encuentros completados esta semana
- `GW2Api.getTokenInfo(token)` → verifica permiso `progression`

**Persistencia:**
- No requiere localStorage (la API es la fuente de verdad)
- Los datos se recargan automáticamente al cambiar de API key

**Evento Analytics:**
- `view_module` con `module_name: 'raids'` al navegar al panel

**Ruta:** `#/account/raids`

**Assets requeridos:**
```
assets/icons/raids/
├── raid-icon.png                 # Ícono del módulo (sidebar y título)
├── wing1.png a wing8.png         # Íconos de cada ala
└── bosses/
    ├── vale_guardian.png
    ├── gorseval.png
    ├── sabetha.jpg
    ├── slothasor.png
    ├── bandit_trio.png
    ├── matthias.png
    ├── siege_the_stronghold.png
    ├── keep_construct.png
    ├── twisted_castle.png
    ├── xera.png
    ├── cairn.png
    ├── mursaat_overseer.png
    ├── samarog.png
    ├── deimos.png
    ├── desmina.png
    ├── river_of_souls.png
    ├── statues_of_grenth.png
    ├── dhuum.png
    ├── conjured_amalgamate.png
    ├── twin_largos.gif
    ├── qadim.png
    ├── gates_of_ahdashim.png
    ├── adina.png
    ├── sabir.png
    ├── qadim_the_peerless.png
    ├── ura_guardian.png
    ├── the_threshold.png
    ├── decimus.png
    └── default.png (fallback)
```

**Funciones clave del módulo:**

| Función | Propósito |
|---------|-----------|
| `createSafeIcon(src, alt, width, height, fallbackEmoji)` | Manejo seguro de imágenes sin reintentos infinitos |
| `renderWingsGrid(completedEncounters)` | Renderiza grid de alas con todos los encuentros |
| `renderKPIs(completedCount, totalCount)` | Muestra resumen semanal |
| `openBossModal(encounterId, encounterName)` | Abre modal con detalles del encuentro |
| `loadRaidData(forceNoCache)` | Carga datos desde la API |
| `refresh(forceNoCache)` | Refresca los datos con control de concurrencia |

**Detalles de encuentros (BOSS_DETAILS):**
- Cada encuentro tiene **5+ bullets de descripción** y **5+ bullets de estrategia**
- Incluye enlace a video tutorial (YouTube)
- Imagen de detalle específica (con fallback a emoji 👾)

**Cambios en `api-gw2.js` (v2.12.0):**
- Nueva función `getAccountRaids(token, opts)` para endpoint `/v2/account/raids`
- TTL de 5 minutos (el reset es semanal)

**Cambios en `router.js` (v2.14.0):**
- Nueva ruta `#/account/raids`
- Agregado `raidTrackerPanel` a `showPanel()`
- Agregado mapeo `'#/account/raids':'raids'` en `setActiveNav()`
- Agregado caso en `onKeySelectChange()` para recargar al cambiar de key

**Cambios en `index.html`:**
- Nuevo panel `#raidTrackerPanel`
- Nuevo enlace en sidebar (debajo de Actividades, antes de Personajes)
- Script `js/raid-tracker.js` agregado

## 🗺️ Visión general del proyecto

Web app ligera en browser, JS vanilla + HTML/CSS, sin framework. Estado y navegación coordinados por router + eventos globales.

### Rutas principales

- `#/cards` — Cartera (Wallet)
- `#/meta` — Meta & Eventos
- `#/account/achievements` — Logros
- `#/account/wizards-vault` — Cámara del Brujo
- `#/activities` — Actividades
- `#/account/characters` — **Inventario y Personajes (NUEVO)**
- `#/account/accounts` — Cuentas
- `#/welcome` — Pantalla de Bienvenida
- `#/wallet/dashboard` — Dashboard de Cartera Multi-Cuenta
- `#/account/raids` — Seguimiento de Raids

## 🧩 Responsabilidades por archivo (Consolidado v6.4.0)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | **v2.15.0** | API Layer con fetchWithRetry, cachés, WV, achievements, items, account info con last_modified, **getAccountRaids**, **getAccountBank**, **getAccountMaterials**, **getAccountLegendaryArmory**, **getCommerceListings**, **getCommercePrices**, **getCommerceTransactionsBuys**, **getCommerceTransactionsSells** |
| `js/wv-season-storage.js` | v1.1.1 | Almacenamiento por temporada (JSON por temporada en localStorage) |
| `js/wizards-vault.js` | v1.3.0 | WV: objetivos, tienda, integración con SeasonStore. Recarga forzada de temporada |
| `js/wv-shop-ui.js` | **v1.0.2** | UI de Tienda WV — **Glow solo en ícono de rareza, fix de timing con wv-theme.js** |
| `js/wv-objectives-ui.js` | v1.0.0 | UI de Objetivos WV — renderizado de diarias/semanales/especiales |
| `js/wv-purchase-detail.js` | **v1.13.1** | Detalle de compras — **Fix estado online (data-token), ícono reloj local** |
| `js/wv-tabs-skin.js` | v1.0.0 | Re-skin de tabs WV, consistente con rerenders |
| `js/achievements.js` | v3.2.0 | Logros: grid único, recompensas visibles, dropdowns personalizados, AP potencial |
| `js/meta.js` | **v3.3.0** | MetaEventos — **Rediseño unificado: ícono expansión con glow, chips timing, tag infusión celestial, fix preview infusiones** |
| `js/sidebar-nav.js` | v1.2 | Router‑friendly + tokenchange + a11y |
| `js/activities.js` | **v3.19.6** | Actividades — **Glow en íconos de Ecto** |
| `js/activities-theme.js` | v2.6.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/inventory-hub.js` | **v1.3.1** | **Inventario y Personajes — Buscador de objetos, KPIs, vistas de sección (Materiales/Banco/Armería), modal de ítem con stats** |
| `js/characters.js` | v2.3.0 | Personajes: lista, ubicación, POIs, rangos PvP/WvW. Íconos profesión locales. **Subvista del InventoryHub** |
| `js/characters-theme.js` | **v1.0.1** | Tema visual de Personajes — **Solo border-left, elimina hover manual** |
| `js/accounts-panel.js` | **v2.0.0** | Panel de Cuentas — **Rediseño "Profile Card" premium + tabla zebra** |
| `js/settings-manager.js` | v1.0.2 | Sistema de Backup/Restaurar |
| `js/gist-sync.js` | v1.0.0 | Sincronización con GitHub Gist |
| `js/welcome-panel.js` | v1.3.0 | Pantalla de Bienvenida |
| `js/raid-tracker.js` | v1.7.0 | Seguimiento de Raids Semanales |
| `js/wallet-dashboard.js` | **v2.5.0** | Dashboard de Cartera — **KPIs con border-left semántico + glow, tabla unificada** |
| `js/router.js` | **v2.16.0** | Router desacoplado (~740 líneas). **Soporta InventoryHub como pantalla principal. Sidebar sin conversor.** |
| `js/app.js` | **v2.7.0** | Keys, wallet, eventos globales. **Conversor extraído a converter-modal.js** |
| `js/analytics.js` | v1.0.0 | Eventos personalizados para Google Analytics |
| `js/wallet-theme.js` | **v1.3.1** | Tema visual de Cartera — **Glow en ícono de divisa + glow neutro para divisas sin color** |
| `js/meta-theme.js` | **v1.4.2** | Tema visual de Meta — **Solo border-left** |
| `js/achievements-theme.js` | **v1.1.1** | Tema visual de Logros — **Solo border-left** |
| `js/wv-theme.js` | **v1.0.1** | Tema visual de WV — **Solo border-left, expone window.WVTheme** |
| `css/theme-polish.css` | **v2.1.0** | Componentes canónicos + hover unificado + conversor |
| `css/main.css` | **v2.6.0** | Layout, backgrounds, tipografía + tag infusión celestial |

### Archivos eliminados (v6.3)
- `js/wallet-cur-theme-patch.js` — redundante con `wallet-theme.js`, aplicaba `!important` y eliminaba glows

### Archivos nuevos (v6.4.0)
- `js/inventory-hub.js` — Módulo de Inventario y Personajes (buscador de objetos, KPIs, vistas de sección, modal de ítem)

### Archivos nuevos (v6.5.0)
- `js/converter-modal.js` — Modal del Conversor Gem ↔ Gold con 3 tabs (Cambio, Transacciones, Populares)

### Archivos eliminados (v6.5.0)
- `assets/data/gemstore-items.json` — Datos estáticos de Gem Store (reemplazado por datos reales de API)

---

## ✅ js/analytics.js — Eventos personalizados para Google Analytics (v1.0.0)

### Resumen

Módulo centralizado que maneja el envío de eventos personalizados a Google Analytics (GA4). Incluye cola de eventos segura para cuando gtag aún no ha cargado.

### ¿Qué hace?

- **API pública `window.Analytics`**: métodos para cada evento medido
- **Cola de eventos**: si gtag no está disponible, guarda eventos en `__gaQueue` y los envía cuando gtag carga
- **Debug**: cada evento se loguea en consola con `[Analytics]` prefix

### Métodos disponibles

| Método | Evento GA4 | Uso |
|--------|------------|-----|
| `Analytics.viewModule(moduleName)` | `view_module` | Navegación entre módulos |
| `Analytics.exportBackup()` | `export_backup` | Exportación de backup |
| `Analytics.importBackup()` | `import_backup` | Importación de backup |
| `Analytics.openAccountWizard()` | `open_account_wizard` | Apertura del asistente de cuentas |
| `Analytics.downloadExcelTemplate()` | `download_excel_template` | Descarga de plantilla Excel |
| `Analytics.enrichWithAPI()` | `enrich_with_api` | Enriquecimiento con GW2 API |
| `Analytics.encryptAccountsFile()` | `encrypt_accounts_file` | Creación de archivo .enc |
| `Analytics.forceReloadSeason()` | `force_reload_season` | Recarga forzada de temporada WV |
| `Analytics.openApiKeysModal()` | `open_api_keys_modal` | Apertura del modal de API Keys |
| `Analytics.addApiKey()` | `add_api_key` | Agregar API Key |
| `Analytics.deleteApiKey()` | `delete_api_key` | Eliminar API Key |

### Código

```javascript
/*!
 * js/analytics.js — Eventos personalizados para Google Analytics
 * Versión: 1.0.0
 */

(function() {
  'use strict';

  function sendEvent(eventName, eventParams) {
    if (typeof gtag === 'function') {
      gtag('event', eventName, eventParams || {});
      console.debug('[Analytics]', eventName, eventParams);
    } else {
      if (!window.__gaQueue) window.__gaQueue = [];
      window.__gaQueue.push({ event: eventName, params: eventParams });
    }
  }

  function processQueue() {
    if (typeof gtag === 'function' && window.__gaQueue && window.__gaQueue.length) {
      window.__gaQueue.forEach(function(item) {
        gtag('event', item.event, item.params || {});
      });
      window.__gaQueue = [];
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processQueue);
  } else {
    processQueue();
  }

  window.Analytics = {
    viewModule: function(moduleName) {
      sendEvent('view_module', { module_name: moduleName });
    },
    exportBackup: function() {
      sendEvent('export_backup');
    },
    importBackup: function() {
      sendEvent('import_backup');
    },
    openAccountWizard: function() {
      sendEvent('open_account_wizard');
    },
    downloadExcelTemplate: function() {
      sendEvent('download_excel_template');
    },
    enrichWithAPI: function() {
      sendEvent('enrich_with_api');
    },
    encryptAccountsFile: function() {
      sendEvent('encrypt_accounts_file');
    },
    forceReloadSeason: function() {
      sendEvent('force_reload_season');
    },
    openApiKeysModal: function() {
      sendEvent('open_api_keys_modal');
    },
    addApiKey: function() {
      sendEvent('add_api_key');
    },
    deleteApiKey: function() {
      sendEvent('delete_api_key');
    }
  };

  console.log('[Analytics] Módulo cargado');
})();
```

## ✅ js/settings-manager.js — Sistema de Backup/Restaurar (v1.0.1)

### Resumen

Módulo que permite exportar e importar toda la configuración de la app entre navegadores/dispositivos.

### ¿Qué hace?

**Exportación (`exportAll`)**:
- Recopila todos los datos de localStorage organizados por módulo
- Genera archivo JSON con versión, timestamp y estructura validada
- Descarga automática con nombre `gw2-backup-YYYY-MM-DD.json`

**Importación (`importAll`)**:
- Solicita archivo JSON al usuario
- Valida versión y estructura
- Muestra resumen de datos a restaurar
- Confirma sobrescritura
- Aplica importación y recarga la página

**Datos exportados/importados:**

| Módulo | Claves localStorage |
|--------|---------------------|
| API Keys | `gw2_keys`, `gw2_selected_key_v1` |
| Wizard's Vault | `wv:season:*`, `wv:season:index` |
| Wallet | `walletPins:*`, `walletSnapshot:*`, `walletCompact` |
| Activities | `gn_activities_toggles`, `gn_home_nodes_marked` |
| Characters | `characters:assignments:*`, `characters:location_history:*` |
| Meta | `gn_meta_hecho_hoy:*`, `gn_meta_favs:*` |
| Global | `gn_welcome_seen` |

**Botones en utilbar:**
- Backup: `assets/icons/155034.png`
- Restaurar: `assets/icons/155033.png`

### Formato JSON exportado

```json
{
  "version": "3.0",
  "exportedAt": "2026-03-28T20:40:53.217Z",
  "app": "gw2-wallet-ligero",
  "data": {
    "apiKeys": { "list": [...], "selected": "..." },
    "wv": { "seasonIndex": [...], "seasons": {...} },
    "wallet": { "compact": false, "pins": {...}, "snapshots": {...} },
    "activities": { "toggles": "...", "homeNodesMarked": {...} },
    "characters": { "assignments": {...}, "locationHistory": {...} },
    "meta": { "hechoHoy": {...}, "favoritos": {...} },
    "global": { "welcomeSeen": true }
  }
}
```

## ✅ js/welcome-panel.js — Pantalla de Bienvenida (v1.2.0)

### Resumen

Pantalla de inicio que se muestra en primera visita o cuando no hay API key seleccionada. Centraliza la información de la Bóveda y ofrece accesos rápidos a todos los módulos.

### ¿Qué hace?

**Secciones:**

| Sección | Contenido |
|---------|----------|
| **Funcionalidades** | Lista de 9 acciones con iconos exclusivos (cartera, meta, logros, WV, actividades, **inventario y personajes**, personajes, cuentas, raids) |
| **API Key** | Botones "Agregar API Key" y "Gestionar Keys" + enlace a ANet |
| **Asistente de Cuentas** | Acceso rápido al asistente con mensaje de seguridad destacado |
| **Acceso Rápido** | 9 botones con iconos originales de los paneles (incluye **Inventario y Personajes** y **Raids**) |
| **Comunidad** | Enlaces a Discord, Instagram, YouTube, Twitch, GitHub, email |
| **Apoyo** | Enlaces a PayPal y Ko-fi |

**Lógica de redirección:**
- Primera visita (`gn_welcome_seen` no existe) → `#/welcome`
- No hay API key seleccionada → `#/welcome`
- Botón home en utilbar → `#/welcome`

**Botón home:**
- Ubicado en el utilbar al inicio
- Icono `assets/icons/Welcome/3380755.png`
- Lleva a `#/welcome`

**Iconos exclusivos de funcionalidades:**
| Funcionalidad | Ruta |
|---------------|------|
| Cartera | `assets/icons/welcome/wallet-icon.png` |
| Meta & Eventos | `assets/icons/welcome/meta-icon.png` |
| Logros | `assets/icons/welcome/achievements-icon.png` |
| Cámara del Brujo | `assets/icons/welcome/wv-icon.png` |
| Actividades | `assets/icons/welcome/activities-icon.png` |
| Inventario y Personajes | `assets/icons/Welcome/358409.png` |
| Personajes | `assets/icons/welcome/characters-icon.png` |
| Cuentas | `assets/icons/welcome/accounts-icon.png` |
| **Raids** | `assets/icons/welcome/raids-icon.png` (NUEVO) |

### Iconos utilizados

| Elemento | Ruta |
|----------|------|
| Home (utilbar) | `assets/icons/Welcome/3380755.png` |
| Título bienvenida | `assets/icons/Welcome/3380755.png` |
| Seguridad | `assets/icons/welcome/shield-icon.png` |
| Paso 1 (descarga) | `assets/icons/welcome/download-icon.png` |
| Paso 2 (subida) | `assets/icons/welcome/upload-icon.png` |
| Paso 3 (API) | `assets/icons/welcome/globe-icon.png` |
| Paso 4 (cifrado) | `assets/icons/welcome/lock-icon.png` |
| Mago (asistente) | `assets/icons/welcome/wizard-icon.png` |
| Pin (acceso rápido) | `assets/icons/welcome/pin-icon.png` |
| Comunidad | `assets/icons/welcome/community-icon.png` |
| Discord | `assets/icons/welcome/discord-icon.png` |
| Instagram | `assets/icons/welcome/instagram-icon.png` |
| YouTube | `assets/icons/welcome/youtube-icon.png` |
| Twitch | `assets/icons/welcome/twitch-icon.png` |
| GitHub | `assets/icons/welcome/github-icon.png` |
| Email | `assets/icons/welcome/email-icon.png` |
| Café (apoyo) | `assets/icons/welcome/coffee-icon.png` |
| PayPal | `assets/icons/welcome/paypal-icon.png` |
| Ko-fi | `assets/icons/welcome/kofi-icon.png` |

## ✅ js/accounts-panel.js — Panel de Cuentas (v2.0.0)

### Resumen

Panel que permite gestionar de forma segura múltiples cuentas de Guild Wars 2 con cifrado local, persistencia inteligente y un asistente para crear archivos `.enc` desde Excel. **v2.0.0 introduce el diseño "Profile Card" premium con jerarquía visual de 3 zonas, tags como iconos, Twitch/GeForce siempre visibles, expansiones colapsables y vista tabla con zebra striping.**

### ¿Qué hace?

**Asistente de cuentas (modal con 4 pasos y iconos)**

| Paso | Acción | Función |
|------|--------|---------|
| 1 | Descargar plantilla Excel | `generateExcelTemplate()` |
| 2 | Subir Excel → Generar JSON | `parseExcelToJSON()` |
| 3 | Enriquecer con GW2 API | `enrichWithGW2API()` |
| 4 | Cifrar con contraseña | CryptoJS AES |

**Carga de datos**
- Archivo JSON cifrado con AES (CryptoJS) cargado desde disco local
- Almacena último archivo en localStorage para acceso rápido
- Opción de usar archivo guardado con solo ingresar contraseña

**Vista dual**
- Vista tarjetas (default) con diseño "Profile Card" premium
- Vista tabla con zebra striping, hover y encabezados estilizados
- Botón toggle para cambiar entre vistas (persiste en sesión)

**Diseño "Profile Card" (v2.0.0)**
- Ícono decorativo aleatorio (cat tag) con glow del color del tipo de cuenta
- Tags mostrados como iconitos 18px en fila con tooltip (sin texto)
- Expansiones colapsables con toggle chevron + barra de progreso
- Twitch y GeForce siempre visibles con íconos de estado (✅ `156108.png` / ❌ `156107.png`)
- Grid 2 columnas para credenciales (email, contraseña, Gmail, Twitch, GeForce)
- Separadores con gradiente horizontal del color del tipo
- Footer con botones "Copiar Email" y "Copiar API Key"

**Gestión de información sensible**
- Contraseñas ocultas con `••••••••`, se muestran con botón 👁️ (reemplazado por imagen local `assets/icons/welcome/528726.png`)
- Click en email, contraseña, Gmail Pass, Twitch username, Twitch email, Twitch password o API Key copia al portapapeles con feedback visual (toast)

**Filtros**
- Búsqueda por nombre, email o GW2 ID
- Tipo: Principales, Alternativas, Free to Play
- Tags personalizados (farming, keys, weekly, taxi)

**Barra de estadísticas**
- Muestra total de cuentas, principales, alternativas, F2P, y tags adicionales
- Separadores optimizados con `margin: 0 -6px` para mejor ajuste en zoom 100%

**Persistencia**
- `accounts:lastFile` → Último archivo cifrado (localStorage)
- Estado de contraseñas (GW2 y Twitch) en memoria (sesión)
- Estado de expansión de secciones en memoria (sesión)

### Estructura de datos JSON

```json
{
  "version": 1,
  "lastUpdated": "2026-03-28",
  "accounts": [
    {
      "id": "unique_id",
      "name": "Nombre visible",
      "login": {
        "email": "correo@ejemplo.com",
        "password": "contraseña",
        "gmailPassword": "pass_gmail"
      },
      "gw2": {
        "accountName": "nombre.1234",
        "created": "2012-09-15",
        "achievementPoints": 28500,
        "characterSlots": 12,
        "bagSlots": 8,
        "bankSlots": 12,
        "materialStorage": 500,
        "legendaries": 8,
        "level80": true
      },
      "expansions": {
        "core": true,
        "heroic": true,
        "heartOfThorns": true,
        "pathOfFire": true,
        "endOfDragons": true,
        "secretsOfTheObscure": true,
        "janthirWilds": true,
        "visionsOfEternity": false
      },
      "services": {
        "twitch": {
          "linked": true,
          "username": "usuario_twitch",
          "email": "twitch@email.com",
          "password": "contraseña_twitch"
        },
        "geforceNow": { "linked": true }
      },
      "apiKey": { "value": "API-KEY-AQUI" },
      "notes": "Notas adicionales",
      "tags": ["main", "full"]
    }
  ]
}
```

### Dependencias externas

- `crypto-js` v4.2.0 (CDN) para cifrado AES
- `xlsx.full.min.js` v0.20.2 (CDN) para manejo de archivos Excel

## ✅ js/activities.js — Panel de Actividades (v3.19.6)

### Resumen

Panel que agrupa actividades diarias y semanales relevantes para el jugador: PSNA, fractales, world bosses, refinamiento de ecto, home nodes y objetivos semanales. **v3.19.6 agrega glow en los íconos de refinamiento de Ecto.**

### ¿Qué hace?

**Detección automática de llave semanal (v3.19.3)**
- Busca personajes **Thief** con nivel ≥10 y menos de **7 días de antigüedad**
- **NUEVA VALIDACIÓN**: Verifica que el personaje fue creado **después** del último reset semanal (lunes 07:30 UTC)
- Si existe al menos uno en la semana actual → llave reclamada
- Eliminado marcado manual (checkbox deshabilitado)
- UI dedicada en la parte superior del panel
- Leyenda actualizada: "nivel 10+, <7 días, **misma semana**"

**Función auxiliar `getLastWeeklyResetUTC()`:**
```javascript
function getLastWeeklyResetUTC() {
  var now = new Date();
  var day = now.getUTCDay();
  var daysSinceMonday = (day === 0 ? 6 : day - 1);
  var lastMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    7, 30, 0, 0
  ));
  if (day === 1 && (now.getUTCHours() < 7 || (now.getUTCHours() === 7 && now.getUTCMinutes() < 30))) {
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  }
  return lastMonday;
}
```

**KPI strips (Diarias / Semanales)**
- Diarias: progreso clave (PSNA disponible, Ecto, Cuarzo de Heredad)
- Semanales: 2/2 (Llave del León Negro + Leivas n/5)

**PSNA (Pact Supply Network Agent)**
- Fuente externa JSON (assets/data/psna-schedule.json) con rotación de 8 días
- Copia de waypoints con feedback visual (toast, resaltado)
- "Acción crítica" con botón copiar del primer agente

**Fractales (hoy)**
- Datos de ejemplo (lista para conectar a API real)
- **Ícono genérico local**: `assets/icons/Fractal/2591.png`
- T4 (lista de nombres) + Recomendados (escalas)
- Todas las tarjetas usan el mismo ícono genérico

**World Bosses**
- Cálculo dinámico de próximos eventos en ventana de 90 minutos
- Copia de chat code con toast

**Refinamiento de Ecto (v3.19.6)**
- Estado de `/v2/account/dailycrafting` + metadatos de items (iconos oficiales)
- Tooltips "Hecho hoy / Pendiente"
- **Íconos con glow**: contenedor 44×44px con `box-shadow: 0 0 0 2px <color>, 0 0 10px <color>` (verde si está hecho, ámbar si pendiente)

**Nodos de Heredad (Home Nodes)**
- Agrupado por tipo (Minería / Madera / Recolección)
- Acordeones con "Mostrar todo / Ver menos"
- Filtros: Todos / No marcados / Marcados
- Decoración de iconos: items por ItemID → miniatura de wiki → fallback por tipo (⛏/🪓/✂)

**Semanales**
- Leivas: contador 0..5 con persistencia semanal (botones + y -)
- Grid de 5 divisas con iconos, costes y tooltips

**Barra de horarios unificada (v2.5.0)**
- Iconos oficiales de GW2: UTC, Local, Reset diario, Reset semanal
- Cuenta regresiva con segundos: `Xd Xh Xm Xs`
- Tooltips informativos en cada elemento

### Persistencia

- localStorage: `gn_activities_toggles` (diario/semanal)
- sessionStorage: `psna:<YYYY-MM-DD>` (rotación del día)
- localStorage: `gn:wiki:thumbs` (TTL 3 días, cap ≈ 200 entradas)
- localStorage: `gn_home_nodes_marked` (persistencia diaria de recolección de Home Nodes)

### APIs consumidas

- `/v2/account/dailycrafting`
- `/v2/account/home/nodes`
- `/v2/items?ids=...&lang=es`
- `https://wiki.guildwars2.com/api.php?action=parse&page=Template:Pact_Supply_Network_Agent_table...` (PSNA)
- `/v2/achievements/categories/88 + /v2/achievements?ids=...&lang=en` (Fractales)
- Wiki API para thumbnails (con TTL)

### Eventos / Router

- `Activities.Route` expone `{ path, mount, unmount, prefetch }`
- Router es el único que escucha `gn:tokenchange`
- `prefetch` trae WeeklyAssets, Ecto, Fractales (hoy) antes de montar
- Señales adicionales: `gn:global-refresh` re-hidrata PSNA/Heredad/Fractales

## ✅ js/characters.js — Panel de Personajes (v2.3.0)

### Resumen

Panel completo que muestra la lista de personajes de la cuenta con su profesión, raza, nivel y gremio. Permite asignar manualmente puntos de interés (POIs) a cada personaje, con filtros por categoría. Incluye rangos PvP y WvW de la cuenta. **Ahora funciona como subvista del InventoryHub.**

### ¿Qué hace?

**Carga optimizada de personajes**
- Obtiene lista de nombres vía `/v2/characters`
- Carga detalles en lotes de 3 personajes concurrentemente
- Timeout de 8 segundos por personaje, reintentos automáticos (2 intentos)
- Caché en localStorage con TTL de 5 minutos

**Localización**
- La API ya no devuelve `map_id`; se implementó historial de ubicaciones (locationHistory) que guarda la última ubicación conocida
- Si no hay datos, muestra "No disponible (API no devuelve ubicación)"

**Puntos de interés (POIs)**
- Cargados desde `assets/data/pois.json` (estructura con id, name, category, map_id)
- Filtro por categoría (granja, puzzle, evento, meta)
- Asignación manual a cada personaje con persistencia por cuenta en localStorage
- Actualización selectiva del DOM (sin rerenderizar toda la lista)

**Íconos de profesión**
- **Migrados a locales**: `assets/icons/professions/2163502.png` a `2163510.png`
- Eliminada dependencia de API para estos íconos

**Datos de cuenta**
- Logros totales vía `/v2/account/achievements`
- Rango PvP vía `/v2/pvp/stats` + `/v2/pvp/ranks`
- Rango WvW vía `/v2/account` (campo `wvw_rank`)

**Eventos personalizados**
- `characters:load:start` — inicio de carga
- `characters:load:progress` — progreso de carga
- `characters:load:complete` — carga completada
- `characters:load:failed` — fallos en la carga
- `characters:assignment:changed` — cambio de POI asignado
- `characters:rendered` — después de renderizar

**Integración con InventoryHub (v6.4.0):**
- `getCharacterList()` — Expone la lista de personajes al InventoryHub
- `renderBackToInventoryButton()` — Botón "← Volver al Inventario" en el título del panel

**Persistencia**
- Asignaciones: `characters:assignments:<keyId>`
- Caché de personajes: `characters:cached:<keyId>`
- Historial de ubicaciones: `characters:location_history:<keyId>`

### APIs consumidas

| Endpoint | Uso |
|----------|-----|
| `/v2/characters` | Lista de nombres |
| `/v2/characters/:name` | Detalles del personaje |
| `/v2/account` | Datos de cuenta (logros, wvw_rank) |
| `/v2/account/achievements` | Puntos de logros |
| `/v2/pvp/stats` | Rango PvP actual |
| `/v2/pvp/ranks` | Lista global de rangos PvP |
| `/v2/wvw/ranks` | Lista global de rangos WvW |
| `/v2/maps?ids=all` | Nombres de mapas |
| `/v2/specializations/:id` | Iconos de especialidad |

## ✅ js/wv-purchase-detail.js — Detalle de Compras (v1.13.1)

### Resumen

Dashboard de seguimiento de compras de Wizard's Vault con KPIs de Aclamación Astral, listado de ítems fijados por cuenta, top pendientes y **estado online basado en last_modified**. **v1.13.1 corrige bug de estado online que mostraba información incorrecta debido a diferencia entre orden de `state.accounts` y orden de la tabla.**

### Novedades visuales (v1.13.1)

- **Fix de estado online**: `updateSingleAccountRow` ahora busca por `data-token` en vez de índice
- **Ícono de reloj local**: `assets/icons/523381.png` reemplaza al emoji 🕐

### Novedades visuales (v1.13.0 - base)

- **Estado online basado en last_modified**: detecta CUALQUIER actividad (PvP, PvE, WvW, economía) en los últimos 20 minutos
- **Barra de progreso compacta** en cada celda de ítem fijado, mostrando estado visual (✅ Completado / ⚠️ Pendiente)
- **Input numérico + botón MAX** para marcas manuales, con auto-guardado (debounce 500ms)
- **Regla dual:** `Math.max(apiPurchased, manualMarks)` — muestra el valor más alto entre la API y las marcas manuales
- La API reporta correctamente las compras de temporadas anteriores (verificado con `/v2/account/wizardsvault/listings`)

### APIs consumidas

- `GW2Api.getAccountInfo()` (para last_modified)
- `GW2Api.isRecentlyActive()` (para determinar actividad)
- `GW2Api.getWVShopMerged()` (vía api-gw2.js)
- `GW2Api.getWVWeekly()` (para meta steps)
- `WVSeasonStore.getCurrentSeasonInfo()` (temporada)

## ✅ js/wallet-dashboard.js — Dashboard de Cartera Multi-Cuenta (v2.5.0)

### Resumen

Módulo que muestra todas las cuentas (API keys) en una tabla, con columnas para las divisas seleccionadas por el usuario, fila de totales y KPIs resumen. **v2.5.0 agrega KPIs con border-left semántico + glow suave y estilos de tabla unificados con zebra striping.**

### ¿Qué hace?

- **Carga paralela de wallets**: similar a `wv-purchase-detail.js`, usa `MAX=3` peticiones concurrentes.
- **Selector de divisas**: dropdown con checkboxes e íconos, persistencia en localStorage.
- **Ordenamiento dinámico**: clic en encabezado ordena ascendente/descendente.
- **KPIs resumen**: tarjetas con Total Oro, Total Karma, Total Laurel, Reconocimiento Astral, ahora con `border-left` de color y glow suave.
- **Formato de moneda**: oro en `X g Y s Z c` con colores (amarillo para oro, gris para plata, cobre para cobre).
- **Fila de totales**: suma de todas las cuentas por divisa.
- **Tabla unificada**: zebra striping (`nth-child(even)`), hover en filas, sticky header con `border-bottom: 2px solid`.
- **Skeleton loader**: animación durante carga de datos.

### APIs consumidas

- `GW2Api.getCurrenciesAll()` → lista de todas las divisas
- `GW2Api.getAccountWallet(token)` → wallet de cada cuenta

### Persistencia en localStorage

| Clave | Contenido |
|-------|-----------|
| `wallet_dashboard_selected_currencies` | Array de IDs de divisas seleccionadas |
| `wallet_dashboard_sort` | `{ column, direction }` para ordenamiento |

### Código de ejemplo

```javascript
// Renderizar tabla con ordenamiento
function renderTable() {
  var selectedCurrencies = state.currencies.filter(c => state.selectedCurrencies.includes(c.id));
  var rowsAcc = state.accounts.slice();
  if (state.sortColumn !== null) {
    rowsAcc = sortAccounts(rowsAcc, state.sortColumn, state.sortDirection);
  }
  // Renderizar KPIs, cabecera, filas y totales
}

// Formato de moneda
function formatCoinValue(value) {
  var copper = Math.abs(Math.floor(value));
  var gold = Math.floor(copper / 10000);
  var silver = Math.floor((copper % 10000) / 100);
  var copperLeft = copper % 100;
  return '<span style="color:#f4c542;">' + gold + '</span> g <span style="color:#e0e0e0;">' + silver + '</span> s <span style="color:#b87333;">' + copperLeft + '</span> c';
}
```

## ✅ js/raid-tracker.js — Seguimiento de Raids Semanales (v1.3.1)

### Resumen

Módulo que permite gestionar el progreso semanal de raids de Guild Wars 2, mostrando todas las alas con sus encuentros (jefes y eventos), marcando automáticamente los completados vía API.

### ¿Qué hace?

**Estructura de datos:**
- 8 alas completas (Ala 1 a Ala 8)
- 33 encuentros totales (21 jefes + 12 eventos)
- Cada encuentro tiene: id, nombre, tipo (jefe/evento), icono

**Carga de datos:**
- Obtiene token seleccionado
- Llama a `GW2Api.getAccountRaids(token)` para obtener IDs completados
- Renderiza grid con estado ✅/❌

**Renderizado:**
- KPIs: Completados / Total + porcentaje de progreso
- Grid de alas responsive (minmax 350px)
- Badge visual: JEFE (👑 amarillo) / EVENTO (⚡ azul)
- Botón "Detalle" por encuentro

**Modal de detalle:**
- Descripción (5+ bullets)
- Estrategia (5+ bullets)
- Enlace a video tutorial
- Imagen (con fallback a emoji 👾)

**Manejo seguro de imágenes:**
- Función `createSafeIcon()` que evita reintentos infinitos
- Fallback a emojis (🏰 para alas, 👾 para jefes/eventos)

**Ciclo de vida:**
- `activate()`: muestra panel y carga datos
- `deactivate()`: oculta panel y cierra modal
- `prefetch()`: precarga datos para navegación rápida
- Escucha `gn:tokenchange` para recargar automáticamente

### APIs consumidas

| Endpoint | Uso |
|----------|-----|
| `/v2/account/raids` | Obtener encuentros completados esta semana |
| `/v2/tokeninfo` | Verificar permiso 'progression' |

### Eventos / Router

- `RaidTracker.Route` expone `{ path: 'account/raids', mount, unmount, prefetch }`
- Router escucha `gn:tokenchange` y recarga datos automáticamente

### Persistencia

- No requiere localStorage (la API es la fuente de verdad)
- Los datos se recargan automáticamente al cambiar de API key

## ✅ js/inventory-hub.js — Inventario y Personajes (v1.3.1)

### Resumen

**Nuevo módulo (v6.4.0) que funciona como pantalla principal de `#/account/characters`.** Permite buscar objetos en el banco, materiales y armería legendaria. Incluye KPIs, vistas de sección y un modal detallado de ítems.

### ¿Qué hace?

**Hub principal:**
- 5 KPIs clickeables: Materiales, Banco, Legendarios, Personajes, Ver Personajes
- Buscador con filtro por rareza (dropdown + chips)
- Resultados agrupados por sección (Materiales → Banco → Armería)
- Mini-cards de rareza en una fila horizontal
- Ítems en grid de 5 columnas

**Vistas de sección:**
- **Materiales:** 10 categorías como en el juego
- **Banco:** Grid de 10×3 slots con paginación cada 30
- **Armería:** Grid de 5 columnas por tipo de ítem

**Modal de ítem:**
- Stats completos de `/v2/items`
- Formato de monedas oro-plata-cobre
- Botón para copiar código de chat
- Enlace a Wiki en español (`wiki-es.guildwars2.com`)

**Navegación:**
- Click en KPI o encabezado de sección → vista detallada
- Botón "← Volver al inventario"
- Card "Ver Personajes" → navega a `characters.js`
- Desde Characters, botón "← Volver al Inventario"

### APIs consumidas

| Función | Endpoint | TTL |
|---------|----------|-----|
| `GW2Api.getAccountBank(token)` | `/v2/account/bank` | 2 min |
| `GW2Api.getAccountMaterials(token)` | `/v2/account/materials` | 2 min |
| `GW2Api.getAccountLegendaryArmory(token)` | `/v2/account/legendaryarmory` | 5 min |
| `GW2Api.getItemsMany(ids)` | `/v2/items` | Cache persistente |

### Persistencia

- **Sin localStorage adicional** — solo caché en memoria con TTL de 2-5 minutos

### Integración con otros módulos

- `characters.js` — Consumido como subvista mediante `getCharacterList()`
- `api-gw2.js` — Usa 3 nuevos endpoints (v2.13.0)
- `router.js` — Ruta `#/account/characters` apunta a `InventoryHub.activate()`

## ✅ js/router.js — Router y Vistas (v2.15.0 — Desacoplado)

### Resumen

Orquestador principal de navegación. Desde v2.15.0, **delega el renderizado de la tienda y objetivos de WV** a módulos especializados (`wv-shop-ui.js`, `wv-objectives-ui.js`), manteniendo fallback completo. **En v6.4.0, la ruta `#/account/characters` apunta al InventoryHub como pantalla principal.**

### Novedades v6.4.0

- **InventoryHub como pantalla principal**: `#/account/characters` activa `InventoryHub.activate()`
- **Panel `inventoryPanel`** agregado a `showPanel()`
- **Mapeo de navegación**: `'#/account/characters':'inventory'`
- **Sidebar**: `updateSidebarFor('inventory')` sin panel específico
- **Evento Analytics**: `view_module` con `module_name: 'inventory'`

### Novedades v2.15.0 (Fases 2-3)

- **Delegación de tienda a `wv-shop-ui.js`**: `ensureLoadTab('shop')` y `onTokenChanged` ahora llaman a `WVShopUI` si está disponible
- **Delegación de objetivos a `wv-objectives-ui.js`**: `renderObjectivesTab` y `renderObjectivesZero` ahora llaman a `WVObjectivesUI` si está disponible
- **API pública extendida**: `__getShopState()`, `__getObjState()`, `__setObjState()` expuestos en `window.WV`
- **Reducción de ~450 líneas**: el router pasó de ~1200 a ~750 líneas

### Novedades v2.14.0

- **Nueva ruta `#/account/raids`** para el seguimiento semanal de raids
- **Agregado `raidTrackerPanel` a `showPanel()`**
- **Agregado mapeo `'#/account/raids':'raids'` en `setActiveNav()`**
- **Agregado caso en `onKeySelectChange()`** para recargar al cambiar de key

### Novedades v2.13.0

- **Nueva ruta `#/wallet/dashboard`** para el dashboard multi-cuenta de wallet
- **Agregado `walletDashboardPanel` a `showPanel()`** para que oculte correctamente `walletPanel`
- **Redirección de bienvenida**: no redirige si ya estamos en `#/welcome` o `#/wallet/dashboard`

### Características base (v2.12.0)

- **Barra de progreso e input manual integrados como parte nativa del HTML** de cada tarjeta (no dependen de `enhanceShopCards`)
- **Eliminado event listener conflictivo** de `wv:season-store:mutate` que recreaba la tienda innecesariamente
- **Persistencia de marcas directamente en WVSeasonStore** sin recargar toda la tienda
- **Las barras no desaparecen** al modificar valores ni al cambiar de pestaña
- Router con prefetch, guardas, navegación por hash, mapeo de vistas
- Incluye rutas `#/account/accounts`, `#/welcome`, `#/wallet/dashboard` y `#/account/raids`

## 🖼️ Assets locales (estructura final)

```
assets/icons/
├── 3594051.png                 # Cámara del Brujo (banner/button)
├── 733322.png                  # Cartera (también usado en Dashboard)
├── 102420.png                  # Meta & Eventos
├── 155059.png                  # Logros
├── 3172791.png                 # Cámara del Brujo (título)
├── 1302773.png                 # Actividades
├── 156678.png                  # Personajes
├── 3601748.png                 # Cuentas (sidebar)
├── 523379.png                  # Reset diario
├── 523380.png                  # Reset semanal
├── 523381.png                  # Reset temporada
├── 502065.png                  # Gemas (conversor)
├── 619316.png                  # Oro (conversor)
├── 784280.png                  # Flecha (conversor)
├── 155033.png                  # Importar (Restaurar)
├── 155034.png                  # Exportar (Backup)
├── 155018.png                  # Info (tooltip WV)
├── 578844.png                  # TOTAL (Dashboard Cartera)
├── raids/                      # NUEVO: Raid Tracker
│   ├── raid-icon.png
│   ├── wing1.png ... wing8.png
│   └── bosses/                 # 33 archivos de íconos de encuentros
├── ui/
│   ├── home.png
│   ├── utc-icon.png
│   ├── local-icon.png
│   ├── daily-reset.png
│   ├── weekly-reset.png
│   └── waypoint.png
├── Welcome/
│   ├── 358409.png              # Inventario y Personajes (NUEVO)
│   ├── 3124974.png             # Búsqueda (NUEVO)
│   ├── ...
├── welcome/
│   ├── shield-icon.png
│   ├── download-icon.png
│   ├── upload-icon.png
│   ├── globe-icon.png
│   ├── lock-icon.png
│   ├── wizard-icon.png
│   ├── pin-icon.png
│   ├── community-icon.png
│   ├── discord-icon.png
│   ├── instagram-icon.png
│   ├── youtube-icon.png
│   ├── twitch-icon.png
│   ├── github-icon.png
│   ├── email-icon.png
│   ├── coffee-icon.png
│   ├── paypal-icon.png
│   ├── kofi-icon.png
│   ├── wallet-icon.png
│   ├── meta-icon.png
│   ├── achievements-icon.png
│   ├── wv-icon.png
│   ├── activities-icon.png
│   ├── characters-icon.png
│   ├── accounts-icon.png
│   ├── raids-icon.png
│   ├── 528726.png               # Ícono ojo (toggle contraseñas)
│   ├── 156108.png               # Check vinculado
│   ├── 156107.png               # Check no vinculado
│   └── 3380755.png              # Home (nuevo)
├── Fractal/
│   └── 2591.png
├── professions/
│   ├── 2163502.png a 2163510.png
├── Cuentas/
│   ├── GW2free.png
│   ├── twitchlogo.png
│   ├── gforce.png
│   ├── 528716.png               # Chevron right (expansiones)
│   ├── 528717.png               # Chevron down (expansiones)
│   ├── HoT.png, PoF.png, EoD.png, SoTO.png, JW.png, VoE.png, Heroic.png
│   ├── 547827.png, 157375.png, 102538.png
│   ├── 157332.png, 1716669.png, 240679.png, 102438.png
│   ├── 733265.png, 733266.png, 156409.png, 358409.png
│   ├── 1770678.png a 1770686.png
│   ├── 156670.png               # Banco
│   ├── 255373.png               # Materiales
│   ├── 157085.png               # Legendarios
│   └── ...
└── ...
```

## 🔄 Flujo de eventos recomendado

- UX cambia key → `KeyManager.setSelected()` → `gn:tokenchange`
- Router escucha → `prefetch` WV/Ach/Activities/Characters/Accounts/Welcome/RaidTracker/**InventoryHub** → render
- **Redirección inicial**: si primera visita o sin key → `#/welcome` (excepto si ya está en `#/welcome` o `#/wallet/dashboard`)
- Activities: solo `render()` (no escucha key-change)
- **InventoryHub**: escucha `gn:tokenchange` → recarga datos con `refresh(true)`
- Characters: escucha `gn:tokenchange` → recarga datos con caché. **Funciona como subvista del InventoryHub**
- Accounts: escucha `gn:tokenchange` → limpia estado (opcional)
- **RaidTracker**: escucha `gn:tokenchange` → recarga datos automáticamente
- **WV (nuevo)**: `router.js` delega renderizado a `wv-shop-ui.js` y `wv-objectives-ui.js` con fallback
- WVSeasonStore: migración legacy en background
- SettingsManager: botones en utilbar, export/import independiente
- **WalletDashboard**: accesible desde botón en `#walletPanel` o ruta `#/wallet/dashboard`
- **RaidTracker**: accesible desde enlace en sidebar o ruta `#/account/raids`

## 🧪 Checklists de Salud (v6.4.0)

### Orden de scripts (obligatorio)

```
SIN defer (dependencias base):
  - crypto-js (CDN)
  - xlsx (CDN)
  - api-gw2.js (v2.13.0)
  - wizards-vault.js
  - wv-season-storage.js

DEFER (módulos, en orden):
  - achievements.js
  - meta.js
  - sidebar-nav.js
  - activities.js
  - activities-theme.js
  - inventory-hub.js (NUEVO)
  - characters.js
  - characters-theme.js
  - accounts-panel.js
  - settings-manager.js
  - gist-sync.js
  - welcome-panel.js
  - raid-tracker.js
  - wv-shop-ui.js
  - wv-objectives-ui.js
  - wv-purchase-detail.js
  - wv-tabs-skin.js
  - wallet-dashboard.js
  - router.js (último entre los módulos)
  - app.js

SIN defer (temas, al final):
  - wallet-theme.js
  - meta-theme.js
  - achievements-theme.js
  - characters-theme.js
  - wv-theme.js
```

### Arquitectura CSS en 3 capas (v6.3.1)

- ✅ `main.css` → layout, backgrounds, tipografía. **Sin bordes ni box-shadows.**
- ✅ `theme-polish.css` → `.card` base con hover unificado + `--elev-hover`
- ✅ `*-theme.js` → **solo `borderLeft` de color semántico**. No sobrescriben `border`, `boxShadow`, `borderRadius` ni `transition`.
- ✅ `wallet-theme.js` → `borderLeft` de color de divisa + glow en ícono
- ✅ `meta-theme.js` v1.4.2 → `borderLeft` de color de expansión
- ✅ `achievements-theme.js` v1.1.1 → `borderLeft` de color de categoría
- ✅ `characters-theme.js` v1.0.1 → `borderLeft` de color de profesión
- ✅ `wv-theme.js` v1.0.1 → `borderLeft` de color de rareza/modo

### Arquitectura WV desacoplada

- ✅ `router.js` delega renderizado de tienda a `wv-shop-ui.js`
- ✅ `router.js` delega renderizado de objetivos a `wv-objectives-ui.js`
- ✅ Ambos módulos tienen fallback completo si no están disponibles
- ✅ `__getShopState()` y `__getObjState()` expuestos en API pública de WV
- ✅ `wv-theme.js` aplica bordes unificados sin tocar lógica de renderizado
- ✅ `router.js` reducido de ~1200 a ~750 líneas

### Inventory Hub (v6.4.0)

- ✅ `inventory-hub.js` v1.3.1 productivo
- ✅ 3 nuevos endpoints en `api-gw2.js` v2.13.0
- ✅ Sin localStorage adicional
- ✅ `characters.js` integrado como subvista
- ✅ `router.js` actualizado para InventoryHub como pantalla principal

### Receta visual unificada

- ✅ `theme-polish.css` → `.card` base con hover unificado + `--elev-hover`
- ✅ `wallet-theme.js` → `border-left` de color de divisa + glow neutro
- ✅ `meta-theme.js` → `border-left` de color de expansión + glow neutro
- ✅ `achievements-theme.js` → `border-left` de color de categoría + glow neutro
- ✅ `characters-theme.js` → `border-left` de color de profesión + dropdowns personalizados
- ✅ `wv-theme.js` → `border-left` de color de rareza/modo + glow neutro
- ✅ `activities.js` → cards de Ecto, Fractales, PSNA con `border-left` semántico
- ✅ `inventory-hub.js` → cards de ítems con `border-left` por rareza

### Módulos rediseñados (v6.3 + v6.3.1 + v6.4.0)

- ✅ **Cartera**: tabla unificada con iconos, formato moneda con colores, categorías como badges, glow en íconos
- ✅ **Dashboard Cartera**: KPIs con border-left semántico + glow, tabla con zebra + hover + sticky header
- ✅ **Panel de Cuentas v2.0.0**: Profile Card premium + tabla rediseñada con zebra
- ✅ **Meta v3.3.0**: ícono expansión con glow, chips timing con color, tag infusión celestial, fix preview infusiones
- ✅ **WV Tienda v1.0.2**: glow solo en ícono de rareza, fix de timing con wv-theme.js
- ✅ **Actividades v3.19.6**: glow en íconos de Ecto
- ✅ **Purchase Detail v1.13.1**: fix estado online (data-token), ícono reloj local
- ✅ **Conversor**: quick-chips como badges, tarjetas con borde, estado pill
- ✅ **Personajes**: border-left de profesión, dropdowns personalizados para POIs, subvista del InventoryHub
- ✅ **Inventario y Personajes**: buscador unificado, KPIs, vistas de sección, modal con stats
- ✅ **Cámara del Brujo**: desacople completo + tema visual unificado
- ✅ **Meta & Eventos**: Modo Deluxe eliminado

### Google Analytics

- ✅ Script de GA4 agregado en `<head>` con ID `G-LB782QT9TR`
- ✅ `analytics.js` creado y referenciado
- ✅ Eventos en `router.js` para todos los módulos (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, **wallet_dashboard**, **raids**, **inventory**)

### LocalStorage

- `wv:season:index` → ✔
- `wv:season:<YY>:<SEQ>` → ✔
- `characters:assignments:<keyId>` → ✔
- `characters:cached:<keyId>` → ✔
- `characters:location_history:<keyId>` → ✔
- `gn_activities_toggles` → ✔
- `psna:schedule`, `psna:lastUpdate` → ✔
- `gn:wiki:thumbs` → ✔
- `gn_home_nodes_marked` → ✔
- `wvpd_icon_url` → ✔ (ahora local)
- `accounts:lastFile` → ✔
- `gn_welcome_seen` → ✔
- `gw2_keys` → ✔ (con soporte de `tag` para tipo de cuenta)
- `gw2_selected_key_v1` → ✔
- `walletPins:*` → ✔
- `walletSnapshot:*` → ✔
- `walletCompact` → ✔
- `gn_meta_hecho_hoy:*` → ✔
- `gn_meta_favs:*` → ✔
- `wallet_dashboard_selected_currencies` → ✔
- `wallet_dashboard_sort` → ✔
- **Inventory Hub: sin localStorage nuevo** → ✔

## 📌 Buenas prácticas actualizadas (v6.4.0)

### Arquitectura CSS — Regla de Oro

- **main.css**: solo layout, backgrounds, tipografía. Sin bordes ni box-shadows.
- **theme-polish.css**: bordes neutros, glow base, hover unificado.
- **\*-theme.js**: solo `borderLeft`. No sobrescribir `border`, `boxShadow`, `borderRadius` ni `transition`.

### Receta Visual

- **Un solo estándar**: borde neutro `rgba(255,255,255,0.08)`, border-left de color, glow `rgba(90,110,154,0.12)`
- **Hover unificado**: `translateY(-3px)` + sombra profunda en `theme-polish.css`
- **Colores semánticos**: cada módulo define su paleta de colores para el `border-left`
- **Nuevos módulos**: deben seguir esta receta desde el día 1
- **No usar `!important`** en estilos de tema
- **No eliminar `box-shadow`** de otras capas

### Inventory Hub (específico)

- **Sin localStorage**: solo caché en memoria con TTL de 2-5 minutos
- **Batch loading**: 3 endpoints en paralelo (banco, materiales, armería)
- **Metadata lazy**: `getItemsMany()` bajo demanda con caché persistente
- **Cards con `border-left`**: color de rareza del ítem
- **Modal**: stats completos de API, formato de monedas, wiki en español
- **Navegación**: Hub → Sección → Modal; Hub → Personajes → Hub
- **Búsqueda**: vacía = top 5 rareza; con texto = coincidencia parcial hasta 25

### WV Desacoplado

- **router.js no renderiza**: solo orquesta navegación y ciclo de vida
- **Módulos UI independientes**: `wv-shop-ui.js`, `wv-objectives-ui.js`
- **Estado compartido vía API**: `__getShopState()`, `__getObjState()`, `__setObjState()`
- **Fallback obligatorio**: todo nuevo módulo UI debe tener fallback al código original
- **wv-theme.js es solo visual**: no toca lógica de negocio

### Analytics

- **Centralización**: todos los eventos definidos en `analytics.js`
- **Cola segura**: si gtag no está disponible, los eventos se encolan
- **Debug**: cada evento se loguea en consola para facilitar testing
- **No bloqueante**: el script de GA4 es `async`, no afecta rendimiento
- **Fallback silencioso**: si gtag falla, no rompe la app

### Estado online

- **Endpoint correcto**: `/v2/account?v=latest` para obtener `last_modified`
- **Umbral configurable**: 20 minutos por defecto
- **Detección general**: cualquier actividad (no solo PvP)
- **Sin permisos especiales**: `account` está en todas las keys
- **Caché corta**: 30 segundos para datos de actividad
- **Ícono local** `assets/icons/523381.png` en lugar de 🕐

### Dashboard de Cartera

- **Carga paralela**: `MAX=3` peticiones concurrentes (mismo patrón que purchase-detail)
- **Persistencia en localStorage**: selección de divisas y ordenamiento
- **Formato de moneda**: oro con colores (`#f4c542` para oro, `#e0e0e0` para plata, `#b87333` para cobre)
- **Íconos oficiales**: usar URLs de `render.guildwars2.com` para KPIs
- **Reintento de renderizado**: si la tabla no existe en el DOM, reintenta después de 100ms
- **Navegación por hash**: el botón "Dashboard" cambia `location.hash` en lugar de llamar directamente al módulo
- **Iconos por tipo de cuenta**: heredar del Panel de Cuentas vía `gw2_keys[].tag`

### Raid Tracker

- **Manejo seguro de imágenes**: `createSafeIcon()` evita reintentos infinitos
- **Fallback a emojis**: si no hay assets, muestra emojis descriptivos
- **Carga eficiente**: solo una petición por cuenta a `/v2/account/raids`
- **Reset semanal**: la API maneja el reset, no requiere lógica adicional
- **Permiso necesario**: `progression` (se muestra mensaje si no está presente)
- **Modal informativo**: 5+ bullets de descripción y estrategia por encuentro
- **Tipos de encuentro**: diferenciación visual entre JEFE (👑) y EVENTO (⚡)

### Globales

- Un único `gn:tokenchange`
- Prefetch + guardas + de-dupe
- No bloquear primer paint
- Lazy backfill
- **Rutas assets relativas**: usar `assets/...` no `/assets/...`

### Activities (específico)

- No usar innerHTML/textContent sobre el nodo `.pill` raíz
- Abort + last win en fetchers largos (PSNA, Fractales)
- Tooltips: siempre `data-tip` + title como fallback
- **Íconos fractales**: usar ícono genérico local (no hay íconos específicos por fractal)
- **Detección de llave semanal**: validar siempre la semana actual con `getLastWeeklyResetUTC()`
- **Cards unificadas**: seguir receta visual para nuevas cards
- **Íconos de Ecto**: contenedor 44×44px con glow del color de estado

### Characters (específico)

- Carga optimizada: batch processing, timeouts, retries
- Eventos personalizados para comunicación con UI
- Actualización selectiva de selects de POI (sin rerenderizar toda la lista)
- Historial de ubicaciones como fallback ante API que ya no devuelve `map_id`
- Caché de personajes con TTL para reducir llamadas a API
- **Íconos de profesión locales**: prioridad local sobre API
- **Dropdowns personalizados**: seguir patrón de `characters-theme.js`
- **Integración con InventoryHub**: exponer `getCharacterList()` y botón "Volver al Inventario"

### Accounts (específico)

- Archivo cifrado guardado en localStorage (no sessionStorage) para persistencia
- Contraseña nunca almacenada, solo hash para comparación
- Expansión de información sensible en memoria (no persiste)
- Copia al portapapeles con feedback visual (toast)
- Botón "Cambiar archivo" permite resetear estado completo
- Click en nombre de cuenta expande info (no botón adicional)
- **Asistente**: todo el procesamiento es local, sin backend
- **Plantilla Excel**: columnas predefinidas con ejemplos
- **Enriquecimiento**: usa las API Keys ya almacenadas en la Bóveda
- **Iconos**: reemplazo completo de emojis por imágenes locales
- **Toggles**: ícono de ojo unificado (`528726.png`) para todas las contraseñas
- **Twitch/GeForce**: siempre visibles con íconos de estado (`156108.png` / `156107.png`)
- **Tags**: iconitos con tooltip, sin texto
- **Expansiones**: colapsables con chevron `528716.png` / `528717.png`
- **`syncAccountTagsToKeys()`**: sincroniza tags con `gw2_keys` para el Dashboard

### Settings Manager (específico)

- Exportación completa de todos los datos de usuario
- Validación de versión para compatibilidad futura
- Confirmación antes de sobrescribir
- Recarga automática para aplicar cambios
- Uso de claves correctas de localStorage (`gw2_keys`, `gw2_selected_key_v1`)

### Welcome (específico)

- Redirección solo en primera visita o sin key
- Guardar `gn_welcome_seen` para no repetir
- Botón home siempre accesible
- Iconos exclusivos para funcionalidades (no repetir de paneles)
- Modal de API Keys debe cerrarse correctamente desde cualquier lugar

### Purchase Detail (específico)

- **Estado online**: usar `getAccountInfo()` + `isRecentlyActive()` en lugar de PvP
- **Íconos countdowns locales** (no wiki, no render.guildwars2.com)
- Banner y botón con ícono local
- Timers con formato unificado
- **Regla dual**: `Math.max(apiPurchased, manualMarks)` para mostrar siempre el valor más alto
- **Auto-guardado** con debounce 500ms para evitar escrituras excesivas
- **Buscar por data-token**: `updateSingleAccountRow` usa `tr[data-token]` en vez de índice

### Router / Tienda (específico)

- **No recargar toda la tienda** en `wv:season-store:mutate`
- Barra de progreso e input manual como **parte nativa del HTML**, no como mejora posterior
- Persistencia de marcas directamente en WVSeasonStore
- Actualización selectiva de UI con `updateCardUI()` sin recargar todo
- **Delegar a módulos UI**: no renderizar HTML en el router

### Wallet Dashboard (específico)

- **Carga paralela**: usar `MAX=3` peticiones concurrentes
- **Reintento de renderizado**: si `#wdTable` no existe, reintentar después de 100ms
- **Persistencia**: guardar selección de divisas y ordenamiento en localStorage
- **Formato de moneda**: función `formatCoinValue()` para oro
- **Íconos oficiales**: usar URLs directas de `render.guildwars2.com` para KPIs
- **Navegación**: el botón de acceso debe cambiar `location.hash` a `#/wallet/dashboard`
- **Iconos por tipo**: leer `gw2_keys[].tag` sincronizado desde `accounts-panel.js`
- **KPIs con border-left semántico**: Oro `rgba(244,197,66,0.5)`, Karma `rgba(175,99,223,0.5)`, Laurel `rgba(43,193,78,0.5)`, AA `rgba(123,194,255,0.5)`

## 🧾 Historial de decisiones (v6.4.0)

- **Q4 2025:** eliminación listener Ach → router controla todo
- **Q1 2026:** watchdog Achievements (5s) + pipeline conservador
- **Q1 2026:** creación módulo Detalle de Compras
- **Q1 2026:** reskin tabs WV
- **Q1 2026:** catálogo lazy imágenes WV
- **Q1 2026:** Activities mayor refactor (v1.3.x → v3.9.0)
- **Q1 2026:** Characters módulo completo (v2.2.2)
- **Q1 2026:** rediseño visual completo Purchase Detail (v1.8.4)
- **Q1 2026:** Home Nodes rediseño completo (activities-theme.js v2.3.0)
- **Q1 2026:** Barra de horarios unificada — Activities v2.5.0, Meta & Eventos v1.3.1
- **Mar 2026:** Migración íconos profesión a locales (Characters v2.3.0)
- **Mar 2026:** Migración íconos fractales a locales (Activities v3.19.0)
- **Mar 2026:** Corrección rutas assets para GitHub Pages
- **Mar 2026:** Íconos countdowns WV locales (wv-purchase-detail.js v1.8.6)
- **Mar 2026:** Detección automática de llave semanal con validación de semana actual (Activities v3.19.3)
- **Mar 2026:** Creación Panel de Cuentas (accounts-panel.js v1.2.1)
- **Mar 2026:** Integración completa del Panel de Cuentas en router y sidebar
- **Mar 2026:** Asistente de Cuentas con generación de .enc desde Excel (accounts-panel.js v1.3.1)
- **Mar 2026:** Creación Pantalla de Bienvenida (welcome-panel.js v1.2.0)
- **Mar 2026:** Botón home en utilbar con icono
- **Mar 2026:** Redirección inicial a bienvenida en primera visita o sin API key
- **Mar 2026:** Rediseño completo Panel de Cuentas v1.9.0 — iconos locales, Twitch detallado, toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada
- **Mar 2026:** Sistema de Backup/Restaurar (settings-manager.js v1.0.1) — exportación/importación completa de configuración
- **Mar 2026:** Header compacto — reducción de altura, eliminación de hero, logo + nombre en una línea
- **Mar 2026:** Iconos de redes sociales — reemplazo de SVGs por imágenes locales
- **Mar 2026:** Mejora WV — tooltip informativo con ícono `155018.png`
- **Mar 2026:** Automatización de compras Wizard's Vault:
  - Dashboard: barra de progreso + input numérico + botón MAX + auto-guardado + regla dual (wv-purchase-detail.js v1.11.0)
  - Tienda: barra de progreso e input integrados en HTML nativo, persistencia sin recargar UI, eliminado event listener conflictivo (router.js v2.12.0)
- **Mar 2026:** **Google Analytics y eventos personalizados**:
  - Script GA4 en `<head>` con ID `G-LB782QT9TR`
  - Archivo `analytics.js` v1.0.0 con API pública y cola de eventos
  - Eventos en todos los módulos: navegación, backup, asistente, recarga temporada, gestión de keys
- **Abr 2026:** **Reemplazo de lógica PvP por last_modified** (v6.0):
  - `api-gw2.js` v2.11.0: nuevas funciones `getAccountInfo` e `isRecentlyActive`
  - `wv-purchase-detail.js` v1.13.0: estado online basado en actividad general
  - Ícono cambiado de ⚔️ a 🕐
  - Umbral de 20 minutos
- **Abr 2026:** **Dashboard de Cartera Multi-Cuenta** (v6.1):
  - Nuevo módulo `wallet-dashboard.js` v2.5.0
  - Nueva ruta `#/wallet/dashboard`
  - Botón "Dashboard" en panel de Cartera
  - Tabla cuentas vs divisas, KPIs, ordenamiento, persistencia
- **Abr 2026:** **Raid Tracker** (v6.2):
  - Nuevo módulo `raid-tracker.js` v1.3.1
  - Nueva ruta `#/account/raids`
  - API `getAccountRaids` en `api-gw2.js` v2.12.0
  - 8 alas, 33 encuentros (21 jefes + 12 eventos)
  - Modal con 5+ bullets de descripción y estrategia
- **May 2026:** **Unificación Visual + Desacople WV + Rediseño de Módulos (v6.3)**:
  - **Receta visual unificada**: borde neutro + border-left de color + glow suave + hover elevado en todas las cards
  - **`characters-theme.js`** v1.0.0: borde de profesión + dropdowns POI personalizados
  - **`wv-theme.js`** v1.0.0: borde de rareza/modo en WV
  - **Desacople de WV en 3 fases**: `wv-shop-ui.js` + `wv-objectives-ui.js` extraen renderizado de `router.js`
  - **`router.js`** reducido de ~1200 a ~750 líneas, solo orquesta
  - **Rediseño de Cartera**: tabla unificada con iconos, formato moneda con colores
  - **Rediseño de Dashboard Cartera**: KPIs con border-left, iconos por tipo de cuenta
  - **Rediseño de Panel de Cuentas**: carga 2 columnas, fila expandible, border-left por tipo
  - **Rediseño de Modal API Keys**: iconos, badges, botones con iconos
  - **Unificación de Actividades**: Ecto, Fractales, PSNA con border-left semántico
  - **Eliminación de Modo Deluxe** en Meta & Eventos (sin efecto visual)
  - **Eliminación de `wallet-cur-theme-patch.js`** (redundante, conflictivo)
- **May 2026:** **Refactor Arquitectura CSS + Unificación Visual Completa (v6.3.1)**:
  - **Separación en 3 capas**: `main.css` (layout), `theme-polish.css` (piel unificada), `*-theme.js` (solo borderLeft)
  - **Corrección de 5 theme files**: `meta-theme.js` v1.4.2, `achievements-theme.js` v1.1.1, `characters-theme.js` v1.0.1, `wv-theme.js` v1.0.1, `wallet-theme.js` v1.3.0
  - **Rediseño de Meta v3.3.0**: ícono expansión con glow, chips timing, tag infusión celestial, fix preview infusiones
  - **Rediseño de WV Tienda v1.0.2**: glow solo en ícono de rareza, fix de timing con wv-theme.js
  - **Glow en íconos**: Wallet (divisas), Actividades (Ecto)
  - **Rediseño de Cuentas v2.0.0**: Profile Card premium + tabla rediseñada con zebra
  - **Fix Purchase Detail v1.13.1**: estado online busca por data-token, ícono reloj local
  - **Rediseño Conversor**: quick-chips como badges, tarjetas con borde
  - **Dashboard Cartera**: KPIs con border-left semántico + glow, tabla unificada
  - **Fix botón Dashboard Wallet** en index.html
  - **Limpieza**: eliminado `wv-theme.js` duplicado, `.inf-prev` duplicado de `theme-polish.css`
- **May 2026:** **Modal del Conversor + Comercio + Mejoras (v6.5.0)**:
  - Conversor extraído de `app.js` a `converter-modal.js` como modal con 4 tabs
  - Tab Cambio: conversor Gem ↔ Gold con glow e índice de conveniencia
  - Tab Transacciones: órdenes activas de compra/venta del jugador con KPIs de totales
  - Tab Populares: ítems con mayor volumen en el Trading Post, filtro por rareza y legendarias
  - Tab Historial: placeholder para Fase 3
  - Nuevas funciones en `api-gw2.js` v2.15.0: `getCommerceListings`, `getCommercePrices`, `getCommerceTransactionsBuys`, `getCommerceTransactionsSells`
  - Cap de 500 entradas en `items_cache_v1:es` para prevenir cuota de localStorage
  - Glow neutro en íconos de divisas sin color asignado (`wallet-theme.js` v1.3.1)
  - Formato de monedas unificado `3 g 17 s 88 c` en todo el modal
  - Embellecimiento visual completo: glows, contenedores, KPIs con iconos
  - Sidebar liberada del conversor (~80 líneas menos en `index.html`)
- **May 2026:** **Módulo de Inventario y Personajes (v6.4.0)**:
  - Nuevo módulo `inventory-hub.js` v1.3.1 como pantalla principal de `#/account/characters`
  - Buscador unificado en banco, materiales y armería legendaria
  - KPIs: Materiales, Banco, Legendarios, Personajes, acceso a Characters
  - Vistas de sección: Materiales (10 categorías), Banco (grid 10×3), Armería (por tipo)
  - Modal de ítem con stats reales de API y formato de monedas
  - Wiki en español (wiki-es.guildwars2.com)
  - 3 nuevos endpoints en api-gw2.js v2.13.0: getAccountBank, getAccountMaterials, getAccountLegendaryArmory
  - Sin localStorage adicional — solo caché en memoria con TTL
  - `characters.js` como subvista con botón "Volver al Inventario"

## 🎉 Estado actual del proyecto (v6.5.0)

- ✅ Navegación estable y desacoplada
- ✅ **Router reducido a ~750 líneas** (solo orquestación, sin renderizado HTML)
- ✅ **WV completamente desacoplada** (tienda en `wv-shop-ui.js`, objetivos en `wv-objectives-ui.js`)
- ✅ **CSS en 3 capas**: `main.css` (layout) → `theme-polish.css` (piel unificada) → `*-theme.js` (solo borderLeft)
- ✅ **Receta visual unificada** aplicada en todos los módulos (12 módulos)
- ✅ **5 theme files corregidos**: solo aplican `borderLeft`, no pisan bordes ni sombras
- ✅ Achievements sin doble pipeline (watchdog ok)
- ✅ Purchase Detail v1.13.1 productivo: estado online basado en last_modified, fix data-token
- ✅ Tienda WV v1.0.2 productiva: glow solo en ícono, fix de timing
- ✅ Meta v3.3.0 productivo: ícono expansión con glow, chips timing, tag infusión celestial, preview infusiones
- ✅ Accounts v2.0.0 productivo: Profile Card premium, tags iconos, Twitch/GeForce visibles, expansiones colapsables, tabla zebra
- ✅ SeasonStore funcionando bien incluso con cuota mínima
- ✅ Activities v3.19.6 productivo: glow en íconos de Ecto
- ✅ Home Nodes v2.3.0 productivo: lista completa (74), filtros, persistencia
- ✅ Barra de horarios unificada productiva
- ✅ **InventoryHub v1.3.1 productivo**: buscador unificado, KPIs, vistas de sección (Materiales 10 categorías, Banco grid 10×3, Armería por tipo), modal con stats
- ✅ Characters v2.3.0 productivo como subvista con `characters-theme.js` (dropdowns personalizados)
- ✅ `api-gw2.js` v2.13.0 con 3 nuevos endpoints: getAccountBank, getAccountMaterials, getAccountLegendaryArmory
- ✅ API Keys Modal rediseñado con iconos y badges
- ✅ Todos los assets migrados a rutas relativas (compatibles con GitHub Pages)
- ✅ Google Analytics integrado con eventos en 11 módulos
- ✅ Estado online basado en last_modified: umbral 20 minutos, ícono local
- ✅ Dashboard de Cartera Multi-Cuenta: KPIs con border-left + glow, tabla unificada
- ✅ **Conversor Modal v1.0.0**: 3 tabs funcionales (Cambio, Transacciones, Populares), KPIs con glow, formato unificado
- ✅ **api-gw2.js v2.15.0**: 4 nuevas funciones de commerce + cap de caché de items
- ✅ Raid Tracker: 8 alas, 33 encuentros, modal con detalles
- ✅ **Cámara del Brujo 100% desacoplada de router.js**
- ✅ **Cero código redundante** (Modo Deluxe y wallet-cur-theme-patch eliminados)
- ✅ **Sistema de iconos por tipo de cuenta** sincronizado entre Accounts y Dashboard
- ✅ **Inventory Hub sin localStorage adicional** — solo caché en memoria
- ✅ **Caché de items con cap de 500 entradas** — sin riesgo de cuota
- ✅ **Sidebar liberada** — conversor movido a modal, ~80 líneas menos en index.html
```