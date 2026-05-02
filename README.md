```markdown
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
- 🔐 **Panel de Cuentas** — Gestión segura de múltiples cuentas con cifrado local
- 🧙 **Pantalla de Bienvenida** — Onboarding y accesos rápidos
- 💾 **Sistema de Backup/Restaurar** — Exporta/importa toda la configuración entre dispositivos
- 🔄 **Recarga forzada de temporada WV** — Ícono para restaurar información de temporada manualmente
- 📈 **Google Analytics integrado** — Seguimiento de visitas y eventos personalizados
- 🎨 **Interfaz visual unificada** — Diseño consistente en todos los módulos con bordes, glows y animaciones

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

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

## 📦 Archivos clave (v6.3.0)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | **v2.12.0** | API Layer. **Nuevas funciones `getAccountInfo`, `isRecentlyActive` y `getAccountRaids`** |
| `js/router.js` | **v2.15.0** | **Router desacoplado (~750 líneas). Solo orquesta navegación. Delega renderizado WV a módulos UI** |
| `js/wv-shop-ui.js` | **v1.0.0** | **NUEVO: UI de Tienda WV (extraído de router.js) — renderizado, filtros, toolbar, skeleton** |
| `js/wv-objectives-ui.js` | **v1.0.0** | **NUEVO: UI de Objetivos WV (extraído de router.js) — diarias, semanales, especiales** |
| `js/wv-theme.js` | **v1.0.0** | **NUEVO: Tema visual de WV — borde de rareza/modo + glow unificado** |
| `js/characters-theme.js` | **v1.0.0** | **NUEVO: Tema visual de Personajes — borde de profesión + dropdowns POI personalizados** |
| `js/wv-purchase-detail.js` | **v1.13.0** | Detalle de compras. **Estado online basado en last_modified** |
| `js/wallet-dashboard.js` | **v2.5.0** | **Dashboard de Cartera: KPIs con border-left, iconos por tipo de cuenta** |
| `js/raid-tracker.js` | **v1.7.0** | **Raid Tracker: 8 alas, 33 encuentros, marcado automático vía API, modal con detalles** |
| `js/analytics.js` | **v1.0.0** | **Eventos personalizados para Google Analytics** |
| `js/wizards-vault.js` | **v1.3.0** | Módulo Wizard's Vault. **Ícono de recarga forzada de temporada** |
| `js/accounts-panel.js` | **v1.9.0** | Panel de Cuentas + asistente. **Carga 2 columnas, fila expandible en tabla** |
| `js/settings-manager.js` | **v1.0.2** | **Sistema de Backup/Restaurar** |
| `js/welcome-panel.js` | v1.3.0 | Pantalla de Bienvenida con onboarding y accesos rápidos |
| `js/activities.js` | v3.19.3 | Actividades diarias/semanales. **Cards unificadas visualmente** |
| `js/activities-theme.js` | v2.6.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Panel de Personajes. **Íconos profesión locales** |
| `js/meta.js` | **v3.2.1** | MetaEventos. **Modo Deluxe eliminado** |
| `js/meta-theme.js` | v1.4.1 | Barra de horarios unificada + mejora de horarios en tarjetas |
| `js/wallet-theme.js` | **v1.4.0** | **Tema visual de Cartera: receta unificada (borde neutro + border-left de color)** |
| `js/achievements-theme.js` | v1.1.0 | Tema visual de Logros: borde de categoría |
| `js/app.js` | **v2.6.3** | Keys, wallet, eventos globales. **Modal de API Keys rediseñado** |
| `css/theme-polish.css` | **v2.1.0** | **Componentes canónicos + hover unificado + tabla unificada extendida** |
| `css/main.css` | **v2.6.0** | Estilos principales. **Eliminados estilos Deluxe, KPIs con border-left** |

### Archivos eliminados (v6.3.0)
- `js/wallet-cur-theme-patch.js` — redundante con `wallet-theme.js`, aplicaba `!important` y eliminaba glows

---

## 🖼️ Assets locales (estructura v6.3.0)

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
│   ├── 156108.png               # Check GeForce Now
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
    └── ...
```

---

## 🧪 Cómo probar las novedades

### Unificación Visual (NUEVO en v6.3)
1. Navegar por todos los módulos y verificar que las cards tienen **borde izquierdo de color**
2. Pasar el mouse sobre cualquier card → debe elevarse 3px con sombra profunda
3. Verificar que los bordes son neutros (`rgba(255,255,255,0.08)`) en todos los módulos
4. Verificar que el glow base es suave y unificado (`rgba(90,110,154,0.12)`)

### Personajes + Theme (NUEVO en v6.3)
1. Navegar a **Personajes** → verificar que cada card tiene borde del color de su profesión
2. Verificar que los dropdowns de POI son personalizados (no nativos)
3. Pasar el mouse sobre una card → debe mostrar sombra del color de la profesión

### WV Desacoplado (NUEVO en v6.3)
1. Navegar a **Cámara del Brujo** → verificar que Tienda y Objetivos cargan normalmente
2. Verificar que las cards tienen `border-left` del color de rareza (tienda) o modo (objetivos)
3. Abrir consola (F12) → no debe haber errores de `WVShopUI` o `WVObjectivesUI`

### Cartera — Tabla Unificada (NUEVO en v6.3)
1. Navegar a **Cartera** → hacer clic en "Vista tabla"
2. Verificar que el oro se muestra con colores (`g` amarillo, `s` gris, `c` cobre)
3. Verificar que las categorías son badges visuales
4. Pasar el mouse sobre las filas → debe haber hover con cambio de fondo

### Dashboard Cartera (NUEVO en v6.3)
1. Navegar a **Dashboard de Cartera** (`#/wallet/dashboard`)
2. Verificar que los KPIs tienen borde izquierdo de color (Oro dorado, Karma púrpura, etc.)
3. Verificar que cada cuenta tiene un icono de tipo (⭐ main, 👤 alter, 🆓 f2p)
4. Verificar que el emoji 📊 fue reemplazado por el ícono `578844.png`

### Panel de Cuentas (NUEVO en v6.3)
1. Navegar a **Cuentas** → verificar que la pantalla de carga tiene 2 columnas
2. Verificar que el texto de seguridad incluye detalles de cifrado y comunidad
3. Cambiar a vista tabla → hacer clic en un nombre → debe expandirse con GW2 Avanzado, Expansiones, Servicios
4. Verificar que cada fila tiene `border-left` del color de su tipo

### Modal de API Keys (NUEVO en v6.3)
1. Abrir el modal de API Keys → verificar iconos de tipo, badge "En uso", botones con iconos
2. Verificar que el botón Eliminar está en rojo

### Actividades (NUEVO en v6.3)
1. Navegar a **Actividades** → verificar que Ecto, Fractales y PSNA tienen `border-left` de color

### Raid Tracker (v6.2)
1. Navegar a **Raids** → verificar 8 alas, KPIs, modal con detalles

### Dashboard de Cartera Multi-Cuenta (v6.1)
1. Navegar a **Cartera** → "Dashboard" → verificar tabla, KPIs, ordenamiento

### Estado online (v6.0)
1. Navegar a **Cámara del Brujo** → botón de detalle de compras → verificar 🕐 "Actividad hace X min"

### Google Analytics (v5.9)
1. Abrir consola (F12) → pestaña Network → buscar peticiones a `google-analytics.com`

### Recarga forzada de temporada WV (v5.8)
1. Cámara del Brujo → clic en ícono 🔄 junto al tooltip → verificar actualización

### Sistema de Backup/Restaurar (v5.7)
1. Clic en "Backup" → descargar JSON → cambiar algo → "Restaurar" → verificar

### Pantalla de Bienvenida (v5.5)
1. Recargar sin API key → ver bienvenida con todas las secciones

### Panel de Cuentas (v5.4)
1. Navegar a `#/account/accounts` → usar asistente para crear archivo .enc

### Detección de llave semanal (v5.5)
1. Ver panel de actividades → UI de llave con leyenda "misma semana"

### Barra de horarios (v5.0)
1. Navegar a **Actividades** o **Meta & Eventos** → ver barra con iconos GW2

### Home Nodes (v5.0)
1. Navegar a **Actividades** → sección "Home nodes"

---

## 📌 Notas técnicas

- **API Key**: Requiere permisos `account` y `wallet`. Para Raids requiere `progression`
- **Estado online**: Usa `last_modified` de `/v2/account?v=latest` con umbral de 20 minutos
- **Raid Tracker**: Usa `/v2/account/raids` para obtener encuentros completados. TTL de 5 minutos
- **Dashboard Cartera**: Usa `getCurrenciesAll()` y `getAccountWallet()`. Persistencia en `localStorage`
- **WV Desacoplado**: `router.js` delega renderizado a `wv-shop-ui.js` y `wv-objectives-ui.js` con fallback
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
```