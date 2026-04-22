```markdown
# 🐈‍⬛ Bóveda del Gato Negro — GW2 Wallet & MetaEventos

Aplicación liviana para Guild Wars 2 que permite consultar:

- 🪙 Wallet / Divisas de la cuenta
- 🎭 MetaEventos con horarios, estado y “Hecho hoy”
- 🪄 Cámara del Brujo Wizard’s Vault (Objetivos y Tienda)
- 🏆 Pantalla de Logros — Nueva vista completa
- 💱 Conversor Gem ↔ Gold
- 🏡 Home Nodes — Todos los desbloqueables de Heredad con estado ✅/❌
- 🕒 Barra de horarios unificada con iconos GW2 (Activities + Meta)
- 🔐 Gestión completa de API Keys
- ⭐ Favoritas, filtros avanzados, vista tarjetas/tabla
- 👥 Panel de Personajes — Lista de personajes, localización y POIs
- 📊 Detalle de compras Wizard’s Vault — KPIs de Aclamación Astral
- 🟢 **Estado online basado en actividad reciente** — Detecta cualquier actividad (PvP, PvE, WvW, economía)
- 📈 **Dashboard de Cartera Multi-Cuenta** — Tabla de todas las cuentas vs divisas seleccionadas, KPIs y ordenamiento dinámico
- 🎯 **Raid Tracker** — Seguimiento semanal de raids (8 alas, 33 encuentros, marcado automático vía API)
- 🔐 **Panel de Cuentas** — Gestión segura de múltiples cuentas con cifrado local
- 🧙 **Pantalla de Bienvenida** — Onboarding y accesos rápidos
- 💾 **Sistema de Backup/Restaurar** — Exporta/importa toda la configuración entre dispositivos
- 🔄 **Recarga forzada de temporada WV** — Ícono para restaurar información de temporada manualmente
- 📈 **Google Analytics integrado** — Seguimiento de visitas y eventos personalizados

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## ✨ Novedades principales — v6.2.0

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
- **Eventos medidos**:
  - `view_module` — Navegación a cada módulo (10 módulos incluyendo wallet_dashboard y raids)
  - `export_backup` / `import_backup` — Uso de backup/restaurar
  - `open_account_wizard`, `download_excel_template`, `enrich_with_api`, `encrypt_accounts_file` — Uso del asistente de cuentas
  - `force_reload_season` — Recarga forzada de temporada WV
  - `open_api_keys_modal`, `add_api_key`, `delete_api_key` — Gestión de API Keys
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

### 💰 Wallet — Rework de tarjetas
- Reemplazo de estrella por 📌 pin con persistencia por cuenta y migración automática
- Tarjetas unificadas con estética “WV”: nuevo grid, jerarquía visual, badges, pills de categorías
- Vista compacta (toggle) persistente por cuenta
- Delta de cantidades (↑/↓) contra snapshot local, con pill verde/roja
- Toolbar enriquecida: “Vista compacta” + “Actualizar base”

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
- Halo dorado reforzado; estado “Actualizado.” en pill
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

## 📦 Archivos clave (v6.2.0)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | **v2.12.0** | API Layer. **Nuevas funciones `getAccountInfo` e `isRecentlyActive`. Eliminadas funciones PvP. Nueva función `getAccountRaids`** |
| `js/wv-purchase-detail.js` | **v1.13.0** | Detalle de compras. **Estado online basado en last_modified (🕐 Actividad hace X min)** |
| `js/wallet-dashboard.js` | **v2.5.0** | **Dashboard de Cartera Multi-Cuenta: tabla cuentas vs divisas, KPIs, ordenamiento, persistencia** |
| `js/raid-tracker.js` | **v1.3.1** | **Raid Tracker: 8 alas, 33 encuentros, marcado automático vía API, modal con detalles** |
| `js/analytics.js` | **v1.0.0** | **Eventos personalizados para Google Analytics. API pública `window.Analytics`. Cola de eventos segura.** |
| `js/wizards-vault.js` | **v1.3.0** | Módulo Wizard's Vault. **Ícono de recarga forzada de temporada** (`834002.png`) junto al tooltip |
| `js/accounts-panel.js` | **v1.9.0** | Panel de Cuentas + asistente para crear archivos .enc desde Excel. **Rediseño completo: iconos locales, Twitch detallado (username, email, password), toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada** |
| `js/settings-manager.js` | **v1.0.1** | **Sistema de Backup/Restaurar**: exportación/importación completa de configuración (API Keys, WV pins, Wallet, Activities, Characters, Meta, global) |
| `js/welcome-panel.js` | v1.2.0 | Pantalla de Bienvenida con onboarding, accesos rápidos, comunidad y apoyo (actualizada con Raids) |
| `js/activities.js` | v3.19.3 | Actividades diarias/semanales. **Detección automática de llave semanal** |
| `js/activities-theme.js` | v2.5.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Panel de Personajes. **Íconos profesión locales** |
| `js/meta-theme.js` | v1.3.1 | Barra de horarios unificada + mejora de horarios en tarjetas |
| `js/router.js` | **v2.14.0** | Router con prefetch, guardas, navegación por hash. **Incluye rutas #/wallet/dashboard y #/account/raids. Barra de progreso e input manual integrados en todas las tarjetas de tienda.** |
| `js/wallet-theme.js` | v1.3.0 | Badges canónicos + glows preservados |
| `css/theme-polish.css` | v2.0.0 | Componentes canónicos unificados |

---

## 🖼️ Assets locales (estructura v6.2.0)

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
├── raids/                      # NUEVO: Raid Tracker
│   ├── raid-icon.png
│   ├── wing1.png ... wing8.png
│   └── bosses/                 # 33 archivos de íconos de encuentros
│       ├── vale_guardian.png
│       ├── gorseval.png
│       ├── sabetha.jpg
│       ├── ...
│       └── default.png
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
│   ├── raids-icon.png          # NUEVO: Icono de Raids en bienvenida
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
    ├── candado GW2.png         # Candado
    ├── gmail.png               # Gmail
    ├── passgoogle.png          # Google Pass
    ├── twitchlogo.png          # Twitch
    ├── gforce.png              # GeForce Now
    ├── HoT.png                 # Heart of Thorns
    ├── PoF.png                 # Path of Fire
    ├── EoD.png                 # End of Dragons
    ├── SoTO.png                # Secrets of the Obscure
    ├── JW.png                  # Janthir Wilds
    ├── VoE.png                 # Visions of Eternity
    ├── Heroic.png              # Heroic Edition
    ├── star.png                # Principal (badge)
    ├── alter.png               # Alternativa (badge)
    ├── farming.png             # Farming (badge)
    ├── key.png                 # Llaves (badge)
    ├── f2p.png                 # F2P (badge)
    ├── 733265.png              # Contraseña (campo)
    ├── 733266.png              # Credenciales (título)
    ├── 156409.png              # Chars (campo)
    ├── 358409.png              # GW2 Avanzado (título)
    └── ...
```

---

## 🧪 Cómo probar las novedades

### Raid Tracker (NUEVO en v6.2)
1. Navegar a **Raids** en la barra lateral (debajo de Actividades, antes de Personajes)
2. Verificar que se muestran las 8 alas con todos los encuentros
3. Verificar las tarjetas de KPIs (Completados esta semana y Progreso semanal)
4. Hacer clic en el botón **"Detalle"** de cualquier encuentro para abrir el modal
5. Verificar que el modal muestra descripción (5+ bullets), estrategia (5+ bullets) y enlace a video
6. Si la API key tiene permiso `progression`, los encuentros completados se marcan con ✅
7. Cambiar de API key y verificar que los datos se recargan automáticamente
8. Verificar el mensaje de error cuando la API key no tiene permiso `progression`

### Dashboard de Cartera Multi-Cuenta
1. Navegar a **Cartera** (`#/cards`)
2. Hacer clic en el botón **"Dashboard"** (junto a "Vista tabla")
3. Verificar que se muestran todas las cuentas y las divisas seleccionadas
4. Seleccionar/deseleccionar divisas en el dropdown para ver la tabla actualizarse
5. Hacer clic en los encabezados de la tabla para ordenar ascendente/descendente
6. Verificar las tarjetas de KPIs (Total Oro, Total Karma, Total Laurel, Reconocimiento Astral)
7. Hacer clic en **"Refrescar"** para recargar los datos
8. Hacer clic en **"Volver a Cartera"** para regresar al panel de cartera clásico
9. Recargar la página (F5) en `#/wallet/dashboard` para ver que persiste el estado

### Estado online basado en last_modified
1. Navegar a **Cámara del Brujo** → botón de detalle de compras (icono en toolbar)
2. Verificar que las cuentas con actividad reciente muestran 🕐 "Actividad hace X min"
3. Hacer clic en el botón **"Online"** (junto a Sincronizar) para actualizar solo el estado
4. Verificar que el umbral es de 20 minutos (actividad en la última hora se detecta)

### Google Analytics
1. **Verificar script**: Abrir consola (F12) → pestaña Network → buscar peticiones a `google-analytics.com`
2. **Ver eventos en tiempo real**: En GA4 → Informes → Tiempo real → navegar por la app y ver eventos aparecer
3. **Debug en consola**: Cada evento personalizado se loguea con `[Analytics]` prefix

### Recarga forzada de temporada WV
1. Navegar a Cámara del Brujo → hacer clic en el ícono 🔄 junto al tooltip → verificar que se actualiza la información de temporada

### Sistema de Backup/Restaurar
1. Hacer clic en "Backup" → descargar JSON → cambiar algo → "Restaurar" → confirmar → recarga → verificar que se restauró

### Pantalla de Bienvenida
1. Recargar sin API key o limpiar localStorage (`gn_welcome_seen`) → ver bienvenida (incluye Raids en la lista de funcionalidades)

### Botón home
1. Clic en icono home en utilbar → ir a `#/welcome`

### Header compacto
1. Verificar que el header ocupa menos espacio, logo + nombre en una línea, botones visibles

### Redes sociales
1. Verificar que los iconos de Discord, Instagram, YouTube, Twitch y GitHub cargan como imágenes locales

### Tooltip WV
1. En Cámara del Brujo, pasar mouse sobre el ícono `ⓘ` junto al título → ver mensaje informativo

### Panel de Cuentas
1. Navegar a `#/account/accounts` → usar asistente para crear archivo .enc

### Asistente de Cuentas
1. Abrir modal → seguir 4 pasos con iconos (plantilla Excel incluye columnas twitch_user, twitch_email, twitch_password)

### Twitch en Cuentas
1. Cargar archivo .enc con datos Twitch → expandir "Servicios y API" → expandir "Servicios" → ver username (copiable), email (copiable si existe), password (toggle independiente + copiable si existe)

### GeForce Now en Cuentas
1. Verificar que el texto "Vinculado" usa imagen local en lugar de emoji ✅

### Iconos de secciones en Cuentas
1. Verificar que Credenciales y GW2 Avanzado tienen nuevos iconos, mientras que Contraseña y Chars mantienen los originales

### Barra de estadísticas en Cuentas
1. Verificar que los separadores están optimizados y no rompen en zoom 100%

### Detección de llave semanal
1. Ver panel de actividades → UI de llave con leyenda "misma semana"

### Barra de horarios
1. Navegar a **Actividades** o **Meta & Eventos** → ver barra con iconos GW2 y resets con segundos

### Home Nodes
1. Navegar a **Actividades** → sección "Home nodes"

### Personajes
1. Navegar a **Personajes** → ver lista, filtros, asignación de POIs

### Íconos de profesión
1. Verificar que se cargan desde `assets/icons/professions/`

### Íconos de fractales
1. Verificar que todas las tarjetas de fractales usan `2591.png`

### Títulos de paneles
1. Verificar que cada panel tiene su ícono correspondiente (incluyendo Raids)

### Horarios en Meta
1. Abrir horarios de una tarjeta → verificar hora local, color del botón y próximo horario resaltado

### Purchase Detail (v1.13.0)
1. Navegar a **Cámara del Brujo** → botón de detalle de compras → verificar barra de progreso, input manual, botón MAX
2. Verificar el estado online: 🕐 "Actividad hace X min" en cuentas con actividad reciente
3. Hacer clic en botón **"Online"** (junto a Sincronizar) para actualizar solo el estado

### Wallet
1. Verificar que las categorías son badges y los glows especiales se mantienen
2. Verificar que el botón **"Dashboard"** está presente y funciona

### Conversor
1. Verificar que los íconos de gemas y oro son locales

---

## 📌 Notas técnicas

- **API Key**: Requiere permisos `account` y `wallet`. Para Raids requiere `progression`
- **Estado online**: Usa `last_modified` de `/v2/account?v=latest` con umbral de 20 minutos
- **Raid Tracker**: Usa `/v2/account/raids` para obtener encuentros completados. TTL de 5 minutos
- **Dashboard Cartera**: Usa `getCurrenciesAll()` y `getAccountWallet()`. Persistencia en `localStorage` con claves `wallet_dashboard_selected_currencies` y `wallet_dashboard_sort`
- **Rutas assets**: Todas son relativas (`assets/...`) sin barra inicial para compatibilidad con GitHub Pages
- **Google Analytics**: ID de medición `G-LB782QT9TR`. Los eventos se pueden ver en GA4 → Informes → Eventos
- **LocalStorage** utilizado para:
  - Favoritos / Pins
  - Flags "Hecho hoy"
  - Marcas WV
  - API Keys (`gw2_keys`, `gw2_selected_key_v1`)
  - Token seleccionado
  - `gn_home_nodes_marked` (persistencia diaria de recolección)
  - `characters:assignments` (POIs por personaje)
  - `wvpd_icon_url` (ícono de Purchase Detail)
  - `accounts:lastFile` (último archivo cifrado)
  - `gn_welcome_seen` (flag de primera visita)
  - `walletPins:*`, `walletSnapshot:*`, `walletCompact`
  - `gn_meta_hecho_hoy:*`, `gn_meta_favs:*`
  - `wallet_dashboard_selected_currencies` (divisas seleccionadas en dashboard)
  - `wallet_dashboard_sort` (ordenamiento del dashboard)

---

## 📦 Versionado

Este proyecto sigue **Semantic Versioning** (SemVer).

- `v6.2.0`: **Raid Tracker** — Nuevo módulo `raid-tracker.js` v1.3.1. 8 alas, 33 encuentros (jefes + eventos), marcado automático vía API `/v2/account/raids`, modal con 5+ bullets de descripción y estrategia, enlace a video. Ruta `#/account/raids`. Enlace en sidebar. API `getAccountRaids` en `api-gw2.js` v2.12.0. Router v2.14.0.
- `v6.1.0`: **Dashboard de Cartera Multi-Cuenta** — Nuevo módulo `wallet-dashboard.js` v2.5.0. Tabla cuentas vs divisas, selector de divisas dropdown, KPIs resumen (Oro, Karma, Laurel, AA), ordenamiento dinámico, persistencia en localStorage. Ruta `#/wallet/dashboard`. Botón "Dashboard" en panel de Cartera.
- `v6.0.0`: **Estado online basado en last_modified** — Reemplazo completo de lógica PvP por `last_modified` de `/v2/account`. `api-gw2.js` v2.11.0, `wv-purchase-detail.js` v1.13.0. Detecta cualquier actividad (PvP, PvE, WvW, economía). Ícono 🕐, umbral 20 minutos.
- `v5.9.0`: **Google Analytics y Eventos Personalizados** — Script GA4 en `<head>`, archivo `analytics.js` v1.0.0 con 11 eventos personalizados en 6 archivos
- `v5.8.0`: **Recarga forzada de temporada WV + Automatización de compras** — Ícono junto al tooltip para restaurar información de temporada manualmente (`wizards-vault.js` v1.3.0); barra de progreso e input manual en dashboard y tienda
- `v5.7.0`: **Sistema de Backup/Restaurar + Header compacto + Mejoras WV** — Exportación/importación completa de configuración, header compacto (~60px), iconos de redes sociales locales, tooltip informativo en WV, mejoras visuales generales
- `v5.6.0`: **Rediseño completo Panel de Cuentas v1.9.0** — Iconos locales (ojo y check GeForce Now como imágenes), Twitch detallado (username, email, password), toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada, separadores compactos, iconos separados para títulos de secciones vs campos internos
- `v5.5.0`: **Pantalla de Bienvenida + Panel de Cuentas v1.3.1** — Onboarding, gestión segura de cuentas, asistente Excel → .enc, detección automática de llave semanal con validación de semana actual
- `v5.4.0`: **Asistente de Cuentas** — Creación de archivos .enc desde Excel, enriquecimiento con API
- `v5.3.0`: **Migración completa a íconos locales** — Profesiones, fractales, countdowns WV, títulos de paneles, rutas assets
- `v5.2.0`: **Íconos en títulos de paneles** — Cartera, Meta, Logros, WV, Actividades, Personajes
- `v5.1.0`: **Migración a íconos locales + fix bucle WV** — Sidebar, barra de tiempos, countdowns WV
- `v5.0.0`: **Estándar Visual Unificado** — Barra de horarios unificada, Home Nodes rediseño, Purchase Detail v1.8.4
- `v4.0.0`: Cámara del Brujo (Wizard’s Vault) — Módulo completo, Pantalla de Logros
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