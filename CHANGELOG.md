```markdown
# 📜 Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato sigue las recomendaciones de  
**Keep a Changelog** (https://keepachangelog.com/)  
y el versionado **SemVer** (https://semver.org/).

---

## [5.9.0] - 2026-03-31

### Added
- **Google Analytics y Eventos Personalizados**:
  - Script de seguimiento GA4 agregado en `<head>` con ID `G-LB782QT9TR`
  - Nuevo archivo `js/analytics.js` v1.0.0 con API pública `window.Analytics`
  - Cola de eventos segura: si gtag no está cargado, los eventos se guardan y se envían cuando esté disponible
  - Eventos personalizados medidos:
    - `view_module` — Navegación a cada módulo (8 módulos: wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome)
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
- **router.js v2.12.0**: Agregados eventos `view_module` en todos los módulos (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome)
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
  - Secciones: funcionalidades (7 acciones), API Key, asistente de cuentas, acceso rápido, comunidad, apoyo
  - Iconos exclusivos para cada funcionalidad (cartera, meta, logros, WV, actividades, personajes, cuentas)
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
- **Conversor v2.0**: quick‑chips (gemas/oro), micro‑animaciones, halo dorado reforzado, estado “Actualizado.” en pill, sombras dinámicas de la barra y layout simétrico.

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
- Toolbar: botones **“Vista compacta”** y **“Actualizar base”**.
- Accesibilidad: `aria-pressed` en pins/toggles.

### UI/Index
- `#walletCards` ahora usa `wallet-card-grid`.
- “Favoritas” → “Fijadas”.
- Encabezado de Tabla (última col) ahora es **📌**.

### Nuevo módulo completo: Cámara del Brujo (Wizard’s Vault)
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
- Flechita (caret) que se superponía en **checkbox chips** (“Activos”, “Próximos”, etc.).

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
- MetaEventos: cache por API key (TTL 5 min) para “Hecho hoy”.
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
  - Sidebar “**Top 3** próximos”
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
- Ajuste del reloj y “Próximo reset”.

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

### 🚀 Rediseño total – “Bóveda del Gato Negro”
Esta versión reemplaza completamente la versión anterior de *gw2-wallet-ligero*, introduciendo una nueva identidad visual, estructura profesional y mejoras profundas en la UI/UX.

#### ✨ Nuevo
- Nueva identidad: **Bóveda del Gato Negro**
- Header estilo ArenaNet con:
  - Textura Hero
  - Overlay semitransparente
  - Logo + tipografía ornamental
  - Tabs principales flotantes
- Navegación renovada
- Dropdown **“Enlaces útiles”** (Efficiency, Timer, ArcDPS, API docs)
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
```