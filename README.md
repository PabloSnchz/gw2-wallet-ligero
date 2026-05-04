# 🐈‍⬛ Bóveda del Gato Negro — GW2 Wallet & MetaEventos

Aplicación liviana para Guild Wars 2 que permite consultar:

- 🪙 Wallet / Divisas de la cuenta
- 🎭 MetaEventos con horarios, estado y "Hecho hoy"
- 🪄 Cámara del Brujo Wizard's Vault (Objetivos y Tienda)
- 🏆 Pantalla de Logros — Nueva vista completa
- 💱 Conversor Gem ↔ Gold
- 🏡 Home Nodes — Todos los desbloqueables de Heredad con estado ✅/❌
- 🕒 Barra de horarios unificada con iconos GW2 (Activities + Meta)
- 🔐 Gestión completa de API Keys
- ⭐ Favoritas, filtros avanzados, vista tarjetas/tabla
- 👥 Panel de Personajes — Lista de personajes, localización y POIs
- 📊 Detalle de compras Wizard's Vault — KPIs de Aclamación Astral
- 🟢 **Estado online basado en actividad reciente** — Detecta cualquier actividad (PvP, PvE, WvW, economía)
- 📈 **Dashboard de Cartera Multi-Cuenta** — Tabla de todas las cuentas vs divisas seleccionadas, KPIs y ordenamiento dinámico
- 🎯 **Raid Tracker** — Seguimiento semanal de raids (8 alas, 33 encuentros, marcado automático vía API)
- 🔐 **Panel de Cuentas** — Gestión segura de múltiples cuentas con cifrado local y diseño "Profile Card" premium
- 🧙 **Pantalla de Bienvenida** — Onboarding y accesos rápidos
- 💾 **Sistema de Backup/Restaurar** — Exporta/importa toda la configuración entre dispositivos
- 🔄 **Recarga forzada de temporada WV** — Ícono para restaurar información de temporada manualmente
- 📈 **Google Analytics integrado** — Seguimiento de visitas y eventos personalizados
- 🎨 **Interfaz visual unificada** — Diseño consistente en todos los módulos con bordes, glows y animaciones
- 🏗️ **Arquitectura CSS en 3 capas** — Separación estricta de responsabilidades: layout, piel unificada y color semántico
- 🎒 **Inventario y Personajes** — Buscador de objetos en toda la cuenta (banco, materiales, armería legendaria)

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## ✨ Novedades principales — v6.4.0

### 🎒 Inventory Hub — Buscador de Objetos en toda la Cuenta (inventory-hub.js v1.3.1)

**Nuevo módulo que reemplaza a Personajes como pantalla principal de `#/account/characters`. Permite buscar cualquier objeto en el banco, materiales y armería legendaria de la cuenta.**

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

**Navegación:**

- Cada sección (Materiales, Banco, Armería) es clickeable → vista detallada
- Botón "← Volver al inventario" en vistas de sección
- Card "Ver Personajes" en los KPIs → navega a `characters.js`
- Desde `characters.js`, botón "← Volver al Inventario" → regresa al Hub

**Cambios en `api-gw2.js` (v2.12.0 → v2.13.0):**

| Función | Descripción |
|---------|-------------|
| `getAccountBank(token, opts)` | Obtiene el contenido del banco. TTL: 2 min |
| `getAccountMaterials(token, opts)` | Obtiene almacenamiento de materiales. TTL: 2 min |
| `getAccountLegendaryArmory(token, opts)` | Obtiene armería legendaria. TTL: 5 min |

**Íconos del módulo:**

| Uso | Asset |
|-----|-------|
| Sidebar y título | `assets/icons/Welcome/358409.png` |
| Materiales | `assets/icons/Cuentas/255373.png` |
| Banco | `assets/icons/Cuentas/156670.png` |
| Legendarios | `assets/icons/Cuentas/157085.png` |
| Personajes | `assets/icons/156678.png` |
| Búsqueda | `assets/icons/Welcome/3124974.png` |

---

## ✨ Novedades principales — v6.3.1

### 🏗️ Refactor de Arquitectura CSS + Unificación Visual Completa + Rediseño de Módulos

**La actualización más refinada del proyecto. CSS reorganizado en 3 capas estrictas, 5 theme files corregidos para aplicar solo `borderLeft`, Panel de Cuentas rediseñado como "Profile Card" premium, Meta unificado visualmente con WV/Wallet, y múltiples fixes visuales y funcionales.**

### 🏗️ Arquitectura CSS en 3 Capas

Se implementó una separación estricta de responsabilidades para eliminar conflictos de especificidad y sobrescritura entre `main.css`, `theme-polish.css` y los `*-theme.js`:

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Layout** | `main.css` | Estructura, fondos, tipografía, espaciados. **Sin bordes ni box-shadows.** |
| **Piel unificada** | `theme-polish.css` | Bordes neutros `rgba(255,255,255,0.08)`, glow base `rgba(90,110,154,0.12)`, hover unificado `translateY(-3px)` con `--elev-hover`, badges, pills, tablas |
| **Color semántico** | `*-theme.js` | **Solo `border-left: 3px solid rgba(<color>, 0.5)`**. El resto de bordes y sombras lo hereda de `.card` en `theme-polish.css`. |

**Regla de oro:** Ningún `*-theme.js` puede sobrescribir `border`, `boxShadow`, `borderRadius` ni `transition`. Solo `borderLeft` + `classList.add('card')`.

### 🛠️ Theme Files Corregidos (solo border-left)

Se corrigieron 5 archivos de tema que estaban aplicando bordes y sombras inline, pisando los estilos de `theme-polish.css`:

| Archivo | Versión | Cambio |
|---------|---------|--------|
| `meta-theme.js` | v1.4.1 → **v1.4.2** | Eliminado `card.style.border` y `card.style.boxShadow`. Solo `borderLeft`. |
| `achievements-theme.js` | v1.1.0 → **v1.1.1** | Eliminado `card.style.border` y `card.style.boxShadow`. Agregado `card.classList.add('card')`. Solo `borderLeft`. |
| `characters-theme.js` | v1.0.0 → **v1.0.1** | Eliminados `card.style.border`, `boxShadow`, `borderRadius`, `transition`. Eliminados event listeners manuales de hover. Solo `borderLeft`. |
| `wv-theme.js` | v1.0.0 → **v1.0.1** | Eliminado `card.style.borderTop/Right/Bottom` y `boxShadow`. Expone `window.WVTheme` para forzar aplicación post-render. Solo `borderLeft`. |
| `wallet-theme.js` | v1.3.0 | Agregado glow en ícono de divisa. Ya aplicaba solo `borderLeft`. |

### 🎨 Rediseño de Meta & Eventos (meta.js v3.3.0)

Las tarjetas de Meta ahora siguen el mismo diseño que Cartera y WV Tienda:

- **Ícono de expansión con glow**: 44px, `box-shadow: 0 0 0 2px <color>, 0 0 10px <color>` del color de la expansión
- **Chips de timing con color semántico**: verde (activo), ámbar (próximo), azul (más tarde), neutro (info)
- **Tag de infusión celestial**: fondo frío `#1a1e28`, texto `#c8dfff`, glow `rgba(150,190,255,0.4)` — reemplaza al tag ámbar genérico
- **Fix de preview de infusiones**: ahora lee `data-preview` del DOM en vez de buscar en `meta._extItems`. Eliminado `.inf-prev` duplicado de `theme-polish.css`.
- **Estructura HTML unificada**: `meta-card__top` con ícono + título + timing debajo, igual que `wallet-card__top`

### 🛒 Rediseño de WV Tienda (wv-shop-ui.js v1.0.2)

- **Glow solo en el ícono de rareza**, no en la tarjeta. El `box-shadow` inline se eliminó de la card y se dejó solo en `iconDeco`.
- **Fix de border-left**: `wv-theme.js` no detectaba las cards recién renderizadas porque el observer estaba sobre `#wvPanel`. Se agregó un `setTimeout` en `renderShopArea()` que resetea `__wvThemed` y fuerza `WVTheme.themeAllNow(area)`.
- **Fix de timing**: `wv-theme.js` expone `window.WVTheme` para que `wv-shop-ui.js` pueda forzar la aplicación del tema después de renderizar.

### 💰 Cartera — Glow en Íconos de Divisa (wallet-theme.js v1.3.0)

Cada ícono de divisa ahora tiene un glow del color correspondiente:
- Gems: `#4BBDF0` (azul celeste)
- Coins: `#F4C542` (dorado)
- Karma: `#AF63DF` (púrpura)
- Laurels: `#2BC14E` (verde)
- Trade Contracts: `#28C3BB` (turquesa)
- Elegy Mosaic: `#E2AE43` (bronce)

### 🧪 Actividades v3.19.6 — Glow en Íconos de Ecto

Los íconos de refinamiento de Ecto ahora tienen un contenedor de 44×44px con glow del color de estado: verde si está hecho, ámbar si pendiente.

### 🔐 Panel de Cuentas v2.0.0 — "Profile Card" Premium

Rediseño completo de las tarjetas con jerarquía visual de 3 zonas (identidad → credenciales → progreso):

| Elemento | Antes (v1.9.0) | Ahora (v2.0.0) |
|----------|----------------|-----------------|
| **Ícono izquierdo** | Ícono del tipo de cuenta (main/alter/f2p) | Ícono decorativo aleatorio (cat tag) con glow del color del tipo |
| **Tags** | Badges con texto (main, alter, farming...) | Solo iconitos 18px en fila con tooltip, debajo de nombre y email |
| **Expansiones** | Siempre visibles en scroll horizontal | **Colapsables** con toggle chevron + barra de progreso |
| **Twitch/GeForce** | Dentro de sección "Servicios y API" colapsable | **Siempre visibles** con íconos de estado (✅ `156108.png` / ❌ `156107.png`) |
| **Credenciales** | Apiladas en sección colapsable | Grid 2 columnas con email, contraseña, Gmail, Twitch, GeForce |
| **Separadores** | `border-top: 1px solid #2a2c35` | Gradiente horizontal del color del tipo de cuenta |
| **Footer** | Sin acciones rápidas | Botones "Copiar Email" y "Copiar API Key" |
| **Vista tabla** | Sin zebra, encabezados simples | Zebra striping, hover en filas, encabezados con `text-transform: uppercase` |

### 🩹 Fix de Estado Online en Purchase Detail (wv-purchase-detail.js)

**Bug:** La tabla del Purchase Detail se ordena por delta (Δ), pero `refreshAllOnlineStatus()` usaba el índice `i` del array original `state.accounts` para actualizar la fila. Esto causaba que el estado online se mostrara en la cuenta equivocada.

**Fix:**
- Se agregó `data-token` a cada `<tr>` en `renderTable()`
- `updateSingleAccountRow` ahora busca por `tr[data-token="..."]` en vez de por índice
- `refreshAllOnlineStatus()` y `loadAll()` llaman con `acc.token` en vez de `i`
- Emoji 🕐 reemplazado por ícono local `assets/icons/523381.png`

### 💱 Conversor Gem ↔ Gold — Rediseño Visual

- Quick-chips (100, 400, 800, 1200 gemas / 10g, 100g, 250g) ahora son badges/pills con clase `conv2-chip`
- Las dos secciones (Gemas y Oro) tienen borde sutil y sombra con clase `conv2-card`
- Estado "Actualizado." ahora es un pill con clase `conv2-state`

### 📈 Dashboard de Cartera Multi-Cuenta — KPIs con Glow + Tabla Unificada

- KPIs ahora tienen `border-left` semántico + glow suave: Oro `rgba(244,197,66,0.5)`, Karma `rgba(175,99,223,0.5)`, Laurel `rgba(43,193,78,0.5)`, AA `rgba(123,194,255,0.5)`
- Tabla con zebra striping (`nth-child(even)`), hover en filas, sticky header con `border-bottom: 2px solid #2a2c35`

### 🔧 Fix de Botón Dashboard de Wallet

El botón "Dashboard" en el panel de Cartera no funcionaba porque el event listener no se enganchaba a tiempo. Se agregó en `DOMContentLoaded`, antes de `wirePDButton()`.

### 🗑️ Limpieza (v6.3.1)

- **`wv-theme.js` duplicado eliminado** de `index.html` (estaba cargado en el bloque `defer` y en el bloque `sync`)
- **`.inf-prev` duplicado eliminado** de `theme-polish.css` (la regla original está en `main.css`)

---

## ✨ Novedades principales — v6.3.0

### 🎨 Unificación Visual Completa + Desacople de WV + Rediseño de Módulos

**La actualización más grande en la historia del proyecto. 11 módulos rediseñados, arquitectura optimizada y experiencia visual consistente.**

### 🎨 Receta Visual Unificada

Se estableció un estándar visual común para todas las cards de la aplicación:

- **Borde general**: `1px solid rgba(255,255,255,0.08)` — neutro, unificado
- **Borde izquierdo**: `3px solid` con color semántico (profesión, rareza, tipo de cuenta)
- **Glow base**: `0 0 8px rgba(90,110,154,0.12)` — suave, unificado
- **Hover**: `translateY(-3px)` + sombra profunda con el color del tema
- **Transición**: `0.22s cubic-bezier(0.2, 0.9, 0.4, 1.1)` — suave, con rebote sutil

| Módulo | Color del borde | Archivo de tema |
|--------|----------------|-----------------|
| Personajes | Color de profesión (9 colores) | `characters-theme.js` **NUEVO** |
| Cartera | Color de divisa (gems, coins, karma...) | `wallet-theme.js` v1.4.0 |
| Meta & Eventos | Color de expansión | `meta-theme.js` v1.4.1 |
| Logros | Color de categoría | `achievements-theme.js` v1.1.0 |
| Cámara del Brujo | Color de rareza/modo | `wv-theme.js` **NUEVO** |
| Cuentas | Color de tipo (main/alter/f2p) | `accounts-panel.js` v1.9.0 |
| Dashboard Cartera | Color por KPI (Oro/Karma/Laurel/AA) | `wallet-dashboard.js` v2.5.0 |

### 🧩 Cámara del Brujo 100% Desacoplada de Router

**Problema:** `router.js` tenía ~1200 líneas mezclando navegación, estado, renderizado HTML y estilos.  
**Solución:** Extracción en 3 fases del renderizado a módulos independientes:

| Fase | Archivo | Responsabilidad |
|:----:|---------|-----------------|
| 1 | `wv-theme.js` **NUEVO** | Tema visual (bordes, glows) — riesgo cero |
| 2 | `wv-shop-ui.js` **NUEVO** | Renderizado de Tienda (~400 líneas extraídas) |
| 3 | `wv-objectives-ui.js` **NUEVO** | Renderizado de Objetivos (~130 líneas extraídas) |

**Resultado:** `router.js` pasó de ~1200 a ~750 líneas. Todos los módulos nuevos tienen fallback al código original.

### 👥 Panel de Personajes — v2.3.0 + characters-theme.js v1.0.0

- **Borde de color por profesión**: Guardian #73b9ff, Warrior #ffd966, Revenant #b19cd9, etc.
- **Dropdowns personalizados** para POIs: reemplazan los `<select>` nativos (mismo sistema que Logros)
- **Hover con sombra del color de la profesión**: elevación + glow
- **Observer** para nuevas cards inyectadas dinámicamente

### 💰 Cartera (Wallet) — Tabla Unificada

- **Vista tabla rediseñada**: mismo estilo que Dashboard de Cartera
- **Formato de moneda con colores**: oro `#f4c542`, plata `#e0e0e0`, cobre `#b87333`
- **Categorías como badges** visuales con iconos
- **Header sticky** con `text-transform: uppercase`
- **Hover en filas** con transición suave

### 📈 Dashboard de Cartera — Mejoras

- **KPIs con borde izquierdo de color**: Oro, Karma, Laurel, AA
- **Iconos por tipo de cuenta**: hereda del Panel de Cuentas (⭐ main, 👤 alter, 🆓 f2p)
- **Sincronización automática**: los tags del Panel de Cuentas se sincronizan con las API Keys
- **Emoji 📊 reemplazado** por ícono local `578844.png`

### 🔐 Panel de Cuentas — Rediseño de carga

- **Pantalla de carga en 2 columnas**: Asistente + Acceso a cuentas
- **Texto de seguridad ampliado**: detalles de cifrado AES, sin servidores, Comunidad Gato Negro
- **Selector de archivo estilizado**: botón que muestra el nombre del archivo en verde
- **Vista tabla con fila expandible**: click en nombre → muestra GW2 Avanzado, Expansiones, Servicios
- **Borde izquierdo por tipo**: main (dorado), alter (violeta), f2p (azul)

### 🔑 Modal de API Keys — Rediseño

- **Iconos de tipo de cuenta** en cada key
- **Badge "✓ En uso"** en la key seleccionada
- **Botones con iconos**: Usar, Copiar, Renombrar, Eliminar
- **Botón Eliminar** destacado en rojo
- **Estado vacío** con icono y mensaje descriptivo

### 🎯 Actividades — Cards Unificadas

- **Ecto**: `border-left` verde (hecho) / ámbar (pendiente)
- **Fractales T4**: `border-left` verde (normal) / ámbar (CM)
- **Fractales Recomendados**: `border-left` azul
- **PSNA**: `border-left` azul unificado

### 🗑️ Limpieza de Código

- **Modo Deluxe eliminado** de Meta & Eventos (no tenía efecto visual real)
- **`wallet-cur-theme-patch.js` eliminado** (redundante, conflictivo con `wallet-theme.js`)

### 📦 Nuevos Archivos (v6.3.0)

| Archivo | Descripción |
|---------|-------------|
| `js/characters-theme.js` | Tema visual de Personajes (borde de profesión, dropdowns POI) |
| `js/wv-theme.js` | Tema visual de WV (borde de rareza/modo) |
| `js/wv-shop-ui.js` | UI de Tienda WV (extraído de router.js) |
| `js/wv-objectives-ui.js` | UI de Objetivos WV (extraído de router.js) |

---

## ✨ Novedades anteriores — v6.2.0

### 🎯 Raid Tracker — Seguimiento Semanal de Raids (NUEVO)

**Nuevo módulo que permite gestionar el progreso semanal de raids de Guild Wars 2.**

| Característica | Descripción |
|----------------|-------------|
| **8 alas completas** | Desde Valle Espiritual (Ala 1) hasta Monte Balrior (Ala 8, Janthir Wilds) |
| **33 encuentros totales** | 21 jefes + 12 eventos distribuidos en las 8 alas |
| **Marcado automático** | Vía API `/v2/account/raids` con permiso `progression` |
| **KPIs semanales** | Completados / total y porcentaje de progreso |
| **Modal informativo** | Descripción y estrategia (5+ bullets por encuentro) + enlace a video tutorial |
| **Tipos de encuentro** | Diferenciación visual entre JEFE (👑) y EVENTO (⚡) |
| **Reset semanal** | Automático según lunes 07:30 UTC (misma lógica que Activities) |
| **Manejo seguro de imágenes** | Sin reintentos infinitos, fallback a emojis (🏰 para alas, 👾 para encuentros) |

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

**Acceso:**
- Enlace en la barra lateral (debajo de Actividades, antes de Personajes)
- Cambia el hash a `#/account/raids`

**Ruta:** `#/account/raids`

**APIs consumidas:**
- `GW2Api.getAccountRaids(token)` → obtiene IDs de encuentros completados esta semana
- `GW2Api.getTokenInfo(token)` → verifica permiso `progression`

**Persistencia:**
- No requiere localStorage (la API es la fuente de verdad)
- Los datos se recargan automáticamente al cambiar de API key

**Assets requeridos:**
```
assets/icons/raids/
├── raid-icon.png                 # Ícono del módulo (sidebar y título)
├── wing1.png a wing8.png         # Íconos de cada ala
└── bosses/                       # Íconos de cada encuentro (33 archivos)
```

**Evento Analytics:**
- `view_module` con `module_name: 'raids'` al navegar al panel

**Cambios en `api-gw2.js` (v2.12.0):**
- Nueva función `getAccountRaids(token, opts)` para endpoint `/v2/account/raids`
- TTL de 5 minutos (el reset es semanal)

**Cambios en `router.js` (v2.14.0):**
- Nueva ruta `#/account/raids`
- Agregado `raidTrackerPanel` a `showPanel()`
- Agregado caso en `onKeySelectChange()` para recargar al cambiar de key

---

## ✨ Novedades anteriores — v6.1.0

### 📈 Dashboard de Cartera Multi-Cuenta

**Nuevo módulo que permite visualizar todas las cuentas y sus divisas en una sola tabla.**

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
- También disponible en la navegación lateral

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

### 🟢 Estado online basado en last_modified

**Reemplazo completo de la lógica de PvP por `last_modified` de `/v2/account`:**

| Aspecto | Antes (PvP) | Ahora (last_modified) |
|---------|-------------|------------------------|
| **Detección** | Solo partidas PvP terminadas | CUALQUIER actividad (PvP, PvE, WvW, economía) |
| **Permiso necesario** | `pvp` | `account` (todas las keys lo tienen) |
| **Latencia** | Media (solo al terminar partida) | Baja (cambios inmediatos) |
| **Endpoint** | `/v2/pvp/games?ids=all` | `/v2/account?v=latest` |
| **Icono** | ⚔️ (PvP) | 🕐 (actividad general) |
| **Umbral** | 10-30 minutos (variable) | **20 minutos fijos** |

**Cambios en `api-gw2.js` (v2.11.0):**
- Nueva función `getAccountInfo(token, opts)` con `?v=latest` para obtener `last_modified`
- Nueva función `isRecentlyActive(accountInfo, minutesThreshold)`
- Eliminadas funciones `getPvPGames` e `isRecentlyActiveInPvP`
- TTL de 30 segundos para datos de actividad

**Cambios en `wv-purchase-detail.js` (v1.13.0):**
- `loadAll()` ahora usa `getAccountInfo()` + `isRecentlyActive(accountInfo, 20)`
- `refreshAllOnlineStatus()` ahora usa la misma lógica
- Ícono cambiado de ⚔️ (PvP) a 🕐 (actividad general)
- Tooltip actualizado: "Activo (actividad reciente)"
- Botón "Online" en el dashboard (junto a Sincronizar)

**Ventajas de la nueva implementación:**
- ✅ Detecta cualquier actividad (no solo PvP)
- ✅ No requiere permiso especial `pvp`
- ✅ Latencia mucho menor
- ✅ Más cuentas detectadas como online

### 📈 Google Analytics y Eventos Personalizados
- **Script de seguimiento GA4** agregado en `<head>` con ID `G-LB782QT9TR`
- **Mide**: visitas, usuarios activos, ubicación, dispositivo, navegador, fuente de tráfico y duración de sesión
- **Eventos personalizados** centralizados en `js/analytics.js` v1.0.0 con API pública `window.Analytics`
- **Cola de eventos segura**: si gtag no está cargado, los eventos se guardan y se envían cuando esté disponible
- **Eventos medidos**: `view_module` (10 módulos), `export_backup`, `import_backup`, `open_account_wizard`, `download_excel_template`, `enrich_with_api`, `encrypt_accounts_file`, `force_reload_season`, `open_api_keys_modal`, `add_api_key`, `delete_api_key`
- **Debug en consola**: cada evento se loguea con `[Analytics]` prefix

### 🔄 Recarga forzada de temporada en Wizard's Vault
- **Ícono clickeable** (sin apariencia de botón) ubicado junto al tooltip de información, a la derecha del título "Cámara del Brujo"
- **Ícono:** `assets/icons/Welcome/834002.png`
- Al hacer clic, fuerza la recarga de la temporada actual desde la API (`/v2/wizardsvault` con `nocache: true`)
- Actualiza automáticamente la UI (`wvSeasonTitle`, `wvSeasonDates`)
- Guarda los datos en `WVSeasonStore` para persistencia
- Feedback visual con toast (info → éxito/error)
- Función global `window.forceReloadWVSeason` disponible para debug en consola
- **Archivo modificado:** `js/wizards-vault.js` → versión v1.3.0

### 💾 Sistema de Backup/Restaurar
- **Exportación completa**: API Keys, Wizard's Vault (pins y marcas), Wallet (pins, snapshots, vista compacta), Activities (toggles, home nodes), Characters (POIs, ubicaciones), Meta (favoritos, hecho hoy), configuración global
- **Importación**: validación de versión, confirmación de sobrescritura, recarga automática
- **Botones en utilbar**: Backup (`assets/icons/155034.png`) y Restaurar (`assets/icons/155033.png`)
- **Formato JSON**: versión 3.0 con timestamp de exportación
- **Claves correctas**: usa `gw2_keys` y `gw2_selected_key_v1` para API Keys
- **Ruta:** botones siempre visibles en la barra superior

### 🧙 Pantalla de Bienvenida
- Pantalla de inicio que se muestra en primera visita o cuando no hay API key seleccionada
- **Ruta:** `#/welcome`
- **Secciones completas**: funcionalidades (8 acciones, incluyendo Raids), API Key, asistente de cuentas, acceso rápido (8 botones), comunidad, apoyo
- **Botón home** en el utilbar con ícono local (`assets/icons/Welcome/3380755.png`)
- **Redirección inteligente**: primera visita o sin key → bienvenida (excepto si ya está en welcome o dashboard)
- **Flag `gn_welcome_seen`** en localStorage para no mostrar repetidamente
- **Iconos exclusivos** para cada funcionalidad en la lista (cartera, meta, logros, WV, actividades, personajes, cuentas, **raids**)

### 🔐 Panel de Cuentas — v1.9.0 (Rediseño completo)
- **Cifrado local**: Archivo JSON cifrado con AES (CryptoJS) y contraseña personal
- **Asistente integrado** con 4 pasos para crear archivos `.enc` desde Excel:
  1. Descargar plantilla Excel con columnas predefinidas (id, nombre, email, password, gmailPassword, apiKey, twitch_user, twitch_email, twitch_password, geforce_linked, notas, tags)
  2. Subir Excel → Generar JSON
  3. Enriquecer con GW2 API (account name, AP, fecha creación, expansiones)
  4. Cifrar con contraseña → archivo `.enc`
- **Persistencia inteligente**: Guarda último archivo en `localStorage` para acceso rápido
- **Vista dual**: Tarjetas / Tabla con botón toggle
- **Información sensible**: Contraseñas ocultas con `••••••••`, se muestran con botón 👁️ (reemplazado por imagen local `assets/icons/welcome/528726.png`)
- **Copia al portapapeles**: Click en email, contraseña, Gmail Pass, Twitch username, Twitch email, Twitch password o API Key copia el valor
- **Click en nombre de cuenta** expande información adicional (mochilas, bancos, material, legendarias)
- **Secciones colapsables**: Credenciales, GW2 Avanzado, Expansiones, Servicios y API
- **Subsección "Servicios"** colapsable dentro de Servicios y API con detalle de Twitch:
  - Twitch: username (copiable), email (copiable si existe), password (toggle independiente + copiable si existe)
  - GeForce Now: texto "Vinculado" con imagen local `assets/icons/Welcome/156108.png` (reemplazo de emoji ✅)
- **Iconos separados para títulos de secciones vs campos internos**:
  - Credenciales (título): `assets/icons/Welcome/733266.png`
  - Contraseña (campo): `assets/icons/Cuentas/733265.png` (se mantiene)
  - GW2 Avanzado (título): `assets/icons/Cuentas/358409.png`
  - Chars (campo): `assets/icons/Cuentas/156409.png` (se mantiene)
- **Barra de estadísticas**: separadores optimizados con `margin: 0 -6px` para mejor ajuste en zoom 100%
- **Filtros**: por tipo (principales, alternativas, F2P) y tags (farming, keys, weekly, taxi)
- **Botón "Cambiar archivo"** para resetear estado
- **Ruta:** `#/account/accounts`

### 🖼️ Migración completa a íconos locales
- **Profesiones**: Todos los íconos de profesión ahora son locales (`assets/icons/professions/2163502.png` a `2163510.png`)
- **Fractales**: Ícono genérico local (`assets/icons/Fractal/2591.png`) para todas las tarjetas
- **Conversor**: SVG reemplazados por imágenes locales (gemas y oro)
- **Countdowns WV**: Íconos de reset diario, semanal y temporada locales (`523379.png`, `523380.png`, `523381.png`)
- **Raids**: Íconos de alas y jefes en `assets/icons/raids/`
- **Títulos de paneles**: Todos los módulos tienen su ícono correspondiente en el título
- **Rutas assets**: Eliminada barra inicial `/` para compatibilidad con GitHub Pages
- **Ícono ojo**: Reemplazo de emoji 👁️ por imagen local `assets/icons/welcome/528726.png` en todos los toggles de contraseña
- **Check GeForce Now**: Reemplazo de emoji ✅ por imagen local `assets/icons/Welcome/156108.png`
- **Ícono información**: Reemplazo de texto largo en WV por ícono `assets/icons/155018.png` avec tooltip
- **Redes sociales**: Reemplazo de SVGs por imágenes locales en utilbar (`discord.png`, `instagram.png`, `youtube.png`, `twitchlogo.png`, `github.png`)

### 🎨 Títulos de paneles con íconos
| Módulo | Ícono |
|--------|-------|
| Cartera | `assets/icons/733322.png` |
| Meta & Eventos | `assets/icons/102420.png` |
| Logros | `assets/icons/155059.png` |
| Cámara del Brujo | `assets/icons/3172791.png` |
| Actividades | `assets/icons/1302773.png` |
| Personajes | `assets/icons/156678.png` |
| Cuentas | `assets/icons/Cuentas/GW2free.png` |
| Bienvenida | `assets/icons/Welcome/3380755.png` |
| Dashboard Cartera | `assets/icons/733322.png` (reutiliza ícono de cartera) |
| **Raids** | `assets/icons/raids/raid-icon.png` |
| **Inventario y Personajes** | `assets/icons/Welcome/358409.png` |

### 🧭 Header Compacto
- **Altura reducida**: ~60px (vs ~140px anterior)
- **Logo + nombre**: en una sola línea con tipografía Cinzel Decorative
- **Eliminación de hero**: las tabs del hero ya no son necesarias (la navegación está en sidebar)
- **Responsive**: en móvil se apila verticalmente
- **Botones Backup/Restaurar**: siempre visibles junto a las redes sociales

### 🔑 Detección automática de llave semanal — v3.19.3
- **Nueva lógica**: busca Thiefs con nivel ≥10, <7 días de antigüedad, **y creados después del último reset semanal** (lunes 07:30 UTC)
- Previene que personajes creados el domingo (día antes del reset) bloqueen la llave de la semana siguiente
- UI dedicada en la parte superior del panel de actividades
- Eliminado marcado manual (checkbox deshabilitado)
- Leyenda informativa: "nivel 10+, <7 días, **misma semana**"

### 👥 Panel de Personajes — v2.3.0
- Lista completa de personajes con profesión, raza, nivel y gremio
- **Íconos de profesión locales** (migrados desde API)
- Rangos PvP y WvW de la cuenta
- Asignación manual de POIs con persistencia por cuenta
- Filtros por nombre, mapa, profesión y categoría de POI
- Vista tarjetas / tabla con paginación
- Carga optimizada: batch processing, timeouts, reintentos automáticos

### 🕒 Barra de horarios unificada
- **Iconos oficiales de Guild Wars 2**: UTC, Local, Reset diario, Reset semanal
- **Actualización en tiempo real**: hora UTC y local con segundos
- **Cuenta regresiva con segundos**: `1d 02h 30m 15s` para resets diario (00:00 UTC) y semanal (lunes 07:30 UTC)
- **Implementada en**:
  - **Actividades**: junto a los tabs "Diarias/Semanales"
  - **Meta & Eventos**: misma línea que el título "Pendientes / Hecho hoy"

### 🏡 Home Nodes — Rediseño completo
- **Lista completa**: 74 elementos de Heredad (53 nodos API + 6 Janthir + 15 contratos/consumibles)
- **Estado en tiempo real**: ✅ Desbloqueado / ❌ No desbloqueado vía API `/v2/account/home/nodes`
- **Filtros avanzados**: por categoría (API/Janthir/Contratos), tipo (minería/madera/cosecha) y estado
- **Tarjetas rediseñadas**: icono de tipo con glow + imagen de ítem destacada (64px)
- **Persistencia diaria**: checkbox "Recolectado hoy" con localStorage

### 💎 Purchase Detail — v1.13.0 (Automatización de compras + Estado online)
- **Estado online basado en last_modified**: detecta CUALQUIER actividad (PvP, PvE, WvW, economía) en los últimos 20 minutos
- **Ícono 🕐** en lugar de ⚔️ para indicar actividad general
- **Tooltip actualizado**: "Activo (actividad reciente)"
- **Barra de progreso compacta** en cada celda de ítem fijado
- **Input numérico + botón MAX** para marcas manuales
- **Auto-guardado con debounce (500ms)**
- **Regla dual:** `Math.max(apiPurchased, manualMarks)` — muestra el valor más alto entre la API y las marcas manuales
- La API reporta correctamente las compras de temporadas anteriores (verificado con `/v2/account/wizardsvault/listings`)
- **Sistema de colores unificado**: 🟢 verde (disponible), 🟡 amarillo (necesidad), 🟢/🔴 rojo (delta)
- **Íconos countdowns locales**: reset diario (523379), semanal (523380), temporada (523381)
- **Badges con efecto hover** (scale + brightness)
- **KPIs con glow** y borde lateral según estado
- **Skeleton loader** animado durante carga
- **Animación de entrada** (fade-in + scale) y timestamp de última actualización
- **Botón "Online" en el dashboard** (junto a Sincronizar) para actualizar solo el estado

### 🎭 Meta & Eventos — Mejoras de horarios
- **Horarios en tarjetas convertidos a hora local** (desde UTC)
- **Botón "Horarios" con color dinámico**: 🟢 verde (activo), 🟡 ámbar (próximo ≤20 min), 🔵 azul (más tarde)
- **Próximo horario resaltado** en la lista de horarios
- **Barra de horarios unificada** con iconos GW2
- **Modo Deluxe eliminado**: no tenía efecto visual real

### 🎨 Unificación visual global
- **Badges canónicos**: `.badge--success/warning/info/infinite` con efecto hover en toda la app
- **Pills unificados**: `.pill` con efecto hover consistente
- **KPIs con glow**: `.kpi--ok/warn/bad` con borde lateral y sombra
- **Tabla unificada**: Sticky headers mejorados con fondo sólido

### 🪄 Cámara del Brujo (WV)
- Router robusto con marcado de nav confiable y sidebar contextual correcto
- Manejo defensivo con try/finally: aunque falle WV internamente, la pastilla y el sidebar se actualizan igual
- Estructura de WV (objetivos + shop) consolidada, con auto-refresh de tienda, toolbar y persistencias por cuenta
- **Mejora visual**: reemplazo de texto largo por ícono `155018.png` con tooltip junto al título
- **Recarga forzada de temporada**: ícono `assets/icons/Welcome/834002.png` junto al tooltip para restaurar información de temporada manualmente
- **Desacople completo**: tienda y objetivos en módulos independientes (`wv-shop-ui.js`, `wv-objectives-ui.js`)

### 💰 Wallet — Rework de tarjetas
- Reemplazo de estrella por 📌 pin con persistencia por cuenta y migración automática
- Tarjetas unificadas con estética "WV": nuevo grid, jerarquía visual, badges, pills de categorías
- Vista compacta (toggle) persistente por cuenta
- Delta de cantidades (↑/↓) contra snapshot local, con pill verde/roja
- Toolbar enriquecida: "Vista compacta" + "Actualizar base"
- **Vista tabla unificada** con formato de moneda con colores y categorías como badges

### 🏆 Logros
- Pantalla completa con barras de progreso por categoría
- Filtros por PvE / PvP / WvW
- Colores de rareza y estado

### 🎨 UI/Accesibilidad
- Botones con aria-pressed, aria-current, roles y tooltips coherentes
- Control de foco y focus trap en el modal de API Keys
- Limpieza de entidades HTML escapadas donde no corresponden

---

## 🔧 Conversor Gem ↔ Gold — v2.0

- Quick‑chips: Gemas (100/400/800/1200) y Oro (10/100/250)
- Micro‑animaciones (`.updated`) en badges, output y barra
- Halo dorado reforzado; estado "Actualizado." en pill
- Barra de conveniencia (ref 400) con sombras por estado
- **Íconos locales**: gemas y oro desde `assets/icons/`
- **v6.3.1**: Quick‑chips rediseñados como badges/pills con clase `conv2-chip`. Secciones con borde sutil (`conv2-card`). Estado con pill (`conv2-state`).

---

## 🪄 Cámara del Brujo (WV) — Pastillas PvE/PvP/WvW

Definí en `index.html` (antes de router.js):

```html
<script>
  window.WV_MODE_ICONS = {
    pve: 'assets/icons/3240357.png',
    pvp: 'assets/icons/3240358.png',
    wvw: 'assets/icons/3240359.png'
  };
</script>
```

---

## 📦 Archivos clave (v6.4.0)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | **v2.13.0** | API Layer. **Nuevas funciones `getAccountBank`, `getAccountMaterials` y `getAccountLegendaryArmory`** |
| `js/router.js` | **v2.15.0** | **Router desacoplado (~750 líneas). Soporta InventoryHub como pantalla principal** |
| `js/inventory-hub.js` | **v1.3.1** | **Inventario y Personajes — Buscador de objetos, KPIs, vistas de sección, modal de ítem** |
| `js/wv-shop-ui.js` | **v1.0.2** | UI de Tienda WV. **Glow solo en ícono de rareza, fix de timing con wv-theme.js** |
| `js/wv-objectives-ui.js` | v1.0.0 | UI de Objetivos WV |
| `js/wv-theme.js` | **v1.0.1** | Tema visual de WV. **Solo border-left, expone window.WVTheme** |
| `js/characters-theme.js` | **v1.0.1** | Tema visual de Personajes. **Solo border-left, elimina hover manual** |
| `js/wv-purchase-detail.js` | **v1.13.1** | Detalle de compras. **Fix estado online (data-token), ícono reloj local** |
| `js/wallet-dashboard.js` | **v2.5.0** | Dashboard de Cartera. **KPIs con border-left + glow, tabla unificada con zebra** |
| `js/raid-tracker.js` | **v1.7.0** | **Raid Tracker: 8 alas, 33 encuentros, marcado automático vía API, modal con detalles** |
| `js/analytics.js` | **v1.0.0** | **Eventos personalizados para Google Analytics** |
| `js/wizards-vault.js` | **v1.3.0** | Módulo Wizard's Vault. **Ícono de recarga forzada de temporada** |
| `js/accounts-panel.js` | **v2.0.0** | Panel de Cuentas. **Profile Card premium + tabla zebra** |
| `js/settings-manager.js` | **v1.0.2** | **Sistema de Backup/Restaurar** |
| `js/welcome-panel.js` | v1.3.0 | Pantalla de Bienvenida con onboarding y accesos rápidos |
| `js/activities.js` | **v3.19.6** | Actividades. **Glow en íconos de Ecto** |
| `js/activities-theme.js` | v2.6.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Panel de Personajes. **Íconos profesión locales. Subvista del InventoryHub** |
| `js/meta.js` | **v3.3.1** | MetaEventos. **Sin marcado manual (solo API). Ícono expansión con glow, chips timing, tag infusión celestial** |
| `js/meta-theme.js` | **v1.4.2** | Tema visual de Meta. **Solo border-left** |
| `js/wallet-theme.js` | **v1.3.0** | Tema visual de Cartera. **Glow en ícono de divisa** |
| `js/achievements-theme.js` | **v1.1.1** | Tema visual de Logros. **Solo border-left** |
| `js/app.js` | **v2.6.3** | Keys, wallet, eventos globales. **Modal de API Keys rediseñado** |
| `css/theme-polish.css` | **v2.1.0** | **Componentes canónicos + hover unificado + conversor** |
| `css/main.css` | **v2.6.0** | Estilos principales. **Solo layout, sin bordes ni box-shadows. Tag infusión celestial.** |

### Archivos eliminados
- `js/wallet-cur-theme-patch.js` — redundante con `wallet-theme.js`, aplicaba `!important` y eliminaba glows (v6.3.0)
- `wv-theme.js` duplicado en `index.html` — estaba cargado en defer y en sync (v6.3.1)

### Archivos nuevos (v6.4.0)
- `js/inventory-hub.js` — Módulo de Inventario y Personajes (buscador de objetos, KPIs, vistas de sección, modal de ítem)

---

## 🖼️ Assets locales (estructura v6.4.0)

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
├── 3240357.png                 # WV PvE
├── 3240358.png                 # WV PvP
├── 3240359.png                 # WV WvW
├── 155033.png                  # Importar (Restaurar)
├── 155034.png                  # Exportar (Backup)
├── 155018.png                  # Info (tooltip WV)
├── 578844.png                  # TOTAL (Dashboard Cartera)
├── raids/                      # Raid Tracker
│   ├── raid-icon.png
│   ├── wing1.png ... wing8.png
│   └── bosses/                 # 33 archivos de íconos de encuentros
├── Welcome/
│   ├── 834002.png              # Recarga forzada de temporada WV
│   ├── 358409.png              # Inventario y Personajes (NUEVO)
│   ├── 3124974.png             # Búsqueda (NUEVO)
│   └── ...                     # resto de iconos de bienvenida
├── ui/
│   ├── home.png                # Home (utilbar y bienvenida)
│   ├── utc-icon.png
│   ├── local-icon.png
│   ├── daily-reset.png
│   ├── weekly-reset.png
│   └── waypoint.png
├── welcome/                    # Iconos exclusivos de bienvenida
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
│   └── 2591.png                # Ícono genérico fractales
├── professions/
│   ├── 2163502.png             # Elementalist
│   ├── 2163503.png             # Engineer
│   ├── 2163504.png             # Guardian
│   ├── 2163505.png             # Mesmer
│   ├── 2163506.png             # Necromancer
│   ├── 2163507.png             # Ranger
│   ├── 2163508.png             # Revenant
│   ├── 2163509.png             # Thief
│   └── 2163510.png             # Warrior
└── Cuentas/
    ├── GW2free.png             # Icono cuenta (todas)
    ├── 547827.png              # Principal (badge)
    ├── 157375.png              # Alternativa (badge)
    ├── 102538.png              # F2P (badge)
    ├── 157332.png              # Farming (badge)
    ├── 1716669.png             # Llaves (badge)
    ├── 240679.png              # Weekly (badge)
    ├── 102438.png              # Taxi (badge)
    ├── 733265.png              # Contraseña (campo)
    ├── 733266.png              # Credenciales (título)
    ├── 156409.png              # Chars (campo)
    ├── 358409.png              # GW2 Avanzado (título)
    ├── 528716.png              # Chevron right (expansiones)
    ├── 528717.png              # Chevron down (expansiones)
    ├── 156670.png              # Banco (NUEVO)
    ├── 255373.png              # Materiales (NUEVO)
    ├── 157085.png              # Legendarios (NUEVO)
    └── ...
```

---

## 🧪 Cómo probar las novedades

### Inventory Hub (NUEVO en v6.4.0)
1. Navegar a **Inventario y Personajes** desde el sidebar
2. Verificar que los KPIs muestran Materiales, Banco, Legendarios, Personajes y acceso a "Ver Personajes"
3. Usar el buscador para encontrar objetos por nombre en banco, materiales y armería
4. Hacer clic en un KPI o encabezado de sección → debe abrir la vista detallada
5. En la vista de Banco, verificar que los slots se muestran en grid de 10 columnas con paginación
6. Hacer clic en cualquier ítem → debe abrir un modal con stats completos, valor NPC en oro-plata-cobre y enlace a Wiki en español
7. Hacer clic en "Ver Personajes" → debe navegar a la lista de personajes con botón "Volver al Inventario"

### Arquitectura CSS en 3 capas (NUEVO en v6.3.1)
1. Inspeccionar cualquier card con F12 → verificar que el `border` y `box-shadow` vienen de `.card` en `theme-polish.css`
2. Verificar que el `border-left` es inline (puesto por `*-theme.js`) y es el único estilo inline de borde
3. Verificar que `main.css` no contiene reglas de `border` ni `box-shadow` para cards

### Cuentas — Profile Card (NUEVO en v6.3.1)
1. Navegar a **Cuentas** → verificar que las tarjetas tienen ícono aleatorio con glow, Twitch/GeForce visibles, expansiones colapsables
2. Cambiar a vista tabla → verificar zebra striping y hover en filas
3. Hacer clic en "Expansiones" → debe desplegarse con barra de progreso

### Meta — Infusiones (NUEVO en v6.3.1)
1. Navegar a **Meta & Eventos** → buscar una card con "Infusión destacada"
2. Pasar el mouse sobre el nombre de la infusión → debe aparecer el preview (GIF/imagen)

### Estado online (FIX en v6.3.1)
1. Navegar a **Cámara del Brujo** → botón de detalle de compras
2. Verificar que el estado online coincide con la cuenta correcta (antes estaba bugueado)
3. Verificar que el ícono de reloj es local (`523381.png`), no un emoji

### Unificación Visual (v6.3)
1. Navegar por todos los módulos y verificar que las cards tienen **borde izquierdo de color**
2. Pasar el mouse sobre cualquier card → debe elevarse 3px con sombra profunda
3. Verificar que los bordes son neutros (`rgba(255,255,255,0.08)`) en todos los módulos
4. Verificar que el glow base es suave y unificado (`rgba(90,110,154,0.12)`)

### Personajes + Theme (v6.3)
1. Navegar a **Personajes** → verificar que cada card tiene borde del color de su profesión
2. Verificar que los dropdowns de POI son personalizados (no nativos)
3. Pasar el mouse sobre una card → debe mostrar sombra del color de la profesión

### WV Desacoplado (v6.3)
1. Navegar a **Cámara del Brujo** → verificar que Tienda y Objetivos cargan normalmente
2. Verificar que las cards tienen `border-left` del color de rareza (tienda) o modo (objetivos)
3. Abrir consola (F12) → no debe haber errores de `WVShopUI` o `WVObjectivesUI`

### Cartera — Tabla Unificada (v6.3)
1. Navegar a **Cartera** → hacer clic en "Vista tabla"
2. Verificar que el oro se muestra con colores (`g` amarillo, `s` gris, `c` cobre)
3. Verificar que las categorías son badges visuales
4. Pasar el mouse sobre las filas → debe haber hover con cambio de fondo

### Dashboard Cartera (v6.3)
1. Navegar a **Dashboard de Cartera** (`#/wallet/dashboard`)
2. Verificar que los KPIs tienen borde izquierdo de color con glow suave
3. Verificar que cada cuenta tiene un icono de tipo (⭐ main, 👤 alter, 🆓 f2p)
4. Verificar que la tabla tiene zebra striping y hover

### Raid Tracker (v6.2)
1. Navegar a **Raids** → verificar 8 alas, KPIs, modal con detalles

### Google Analytics (v5.9)
1. Abrir consola (F12) → pestaña Network → buscar peticiones a `google-analytics.com`

---

## 📌 Notas técnicas

- **API Key**: Requiere permisos `account` y `wallet`. Para Raids requiere `progression`. Para Inventario requiere `account`
- **Estado online**: Usa `last_modified` de `/v2/account?v=latest` con umbral de 20 minutos. Fix v6.3.1: busca por `data-token`.
- **Raid Tracker**: Usa `/v2/account/raids` para obtener encuentros completados. TTL de 5 minutos
- **Dashboard Cartera**: Usa `getCurrenciesAll()` y `getAccountWallet()`. Persistencia en `localStorage`. Zebra + hover unificados.
- **Inventory Hub**: Usa `getAccountBank()`, `getAccountMaterials()` y `getAccountLegendaryArmory()`. Sin localStorage adicional. Caché en memoria con TTL de 2-5 minutos.
- **WV Desacoplado**: `router.js` delega renderizado a `wv-shop-ui.js` y `wv-objectives-ui.js` con fallback
- **Arquitectura CSS**: 3 capas estrictas — `main.css` (layout), `theme-polish.css` (piel unificada), `*-theme.js` (solo `borderLeft`)
- **Receta visual**: Borde neutro `rgba(255,255,255,0.08)`, border-left de color, glow `rgba(90,110,154,0.12)`, hover `translateY(-3px)`
- **Rutas assets**: Todas son relativas (`assets/...`) sin barra inicial para compatibilidad con GitHub Pages
- **Google Analytics**: ID de medición `G-LB782QT9TR`
- **LocalStorage** utilizado para:
  - API Keys (`gw2_keys` con soporte de `tag` para tipo de cuenta, `gw2_selected_key_v1`)
  - WV: `wv:season:*`, `wv:season:index`
  - Wallet: `walletPins:*`, `walletSnapshot:*`, `walletCompact`
  - Activities: `gn_activities_toggles`, `gn_home_nodes_marked`, `psna:*`
  - Characters: `characters:assignments:*`, `characters:cached:*`, `characters:location_history:*`
  - Meta: `gn_meta_hecho_hoy:*`, `gn_meta_favs:*`
  - Dashboard: `wallet_dashboard_selected_currencies`, `wallet_dashboard_sort`
  - Global: `gn_welcome_seen`, `wvpd_icon_url`, `accounts:lastFile`

---

## 📦 Versionado

Este proyecto sigue **Semantic Versioning** (SemVer).

- `v6.4.0`: **Inventory Hub — Buscador de Objetos** — Nuevo módulo `inventory-hub.js` v1.3.1, 3 nuevos endpoints en api-gw2.js v2.13.0, vistas de sección (Materiales 10 categorías, Banco grid 10×3, Armería por tipo), modal con stats, wiki en español, characters.js como subvista
- `v6.3.1`: **Refactor Arquitectura CSS + Unificación Visual Completa** — CSS en 3 capas estrictas, 5 theme files corregidos (solo `borderLeft`), Panel de Cuentas v2.0.0 "Profile Card" premium + tabla zebra, Meta v3.3.0 (ícono expansión con glow, tag infusión celestial, fix preview), WV Tienda v1.0.2 (glow solo en ícono, fix timing), Purchase Detail fix estado online (data-token, ícono reloj local), Activities glow en Ecto, Wallet glow en íconos, Dashboard KPIs con border-left + glow + tabla unificada, Conversor rediseño visual, fix botón Dashboard
- `v6.3.0`: **Unificación Visual + Desacople WV + Rediseño de Módulos** — Receta visual unificada en 11 módulos, desacople de WV en 3 fases (`wv-theme.js`, `wv-shop-ui.js`, `wv-objectives-ui.js`), `characters-theme.js`, rediseño de Cartera (tabla), Dashboard (KPIs, iconos), Panel de Cuentas (carga 2 cols, fila expandible), Modal API Keys, cards de Actividades unificadas, eliminación de Modo Deluxe y `wallet-cur-theme-patch.js`
- `v6.2.0`: **Raid Tracker** — Nuevo módulo `raid-tracker.js` v1.3.1. 8 alas, 33 encuentros, marcado automático vía API, modal con detalles
- `v6.1.0`: **Dashboard de Cartera Multi-Cuenta** — Nuevo módulo `wallet-dashboard.js` v2.5.0. Tabla cuentas vs divisas, KPIs, ordenamiento
- `v6.0.0`: **Estado online basado en last_modified** — Reemplazo de lógica PvP por `last_modified` de `/v2/account`
- `v5.9.0`: **Google Analytics y Eventos Personalizados** — Script GA4, archivo `analytics.js` v1.0.0
- `v5.8.0`: **Recarga forzada de temporada WV + Automatización de compras**
- `v5.7.0`: **Sistema de Backup/Restaurar + Header compacto + Mejoras WV**
- `v5.6.0`: **Rediseño completo Panel de Cuentas v1.9.0**
- `v5.5.0`: **Pantalla de Bienvenida + Panel de Cuentas v1.3.1**
- `v5.4.0`: **Asistente de Cuentas** — Creación de archivos .enc desde Excel
- `v5.3.0`: **Migración completa a íconos locales**
- `v5.2.0`: **Íconos en títulos de paneles**
- `v5.1.0`: **Migración a íconos locales + fix bucle WV**
- `v5.0.0`: **Estándar Visual Unificado** — Barra de horarios, Home Nodes, Purchase Detail
- `v4.0.0`: Cámara del Brujo (Wizard's Vault) — Módulo completo, Pantalla de Logros
- `v3.0.0`: MetaEventos Deluxe
- `v2.6.2`: Base estable previa a Deluxe

Ver [`CHANGELOG.md`](CHANGELOG.md) para detalles completos.

---

## 🤝 Contribuir

1. Rama feature: `feature/<nombre>`
2. Commit convencional:  
   - `feat(meta): …`  
   - `fix(ui): …`  
   - `chore(css): …`
3. PR con descripción, capturas (si UI), checklist QA
4. Review y **squash merge** o **merge commit** según política

---

## 📄 Licencia

© Comunidad Gato Negro. Uso interno / comunitario. Contacto por Discord para acuerdos de distribución o forks.