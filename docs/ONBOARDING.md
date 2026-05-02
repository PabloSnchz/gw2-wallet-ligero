```markdown
# 🐈⬛ Bóveda del Gato Negro — Onboarding Técnico Consolidado (v6.3)

Fecha: 2026-05-01
Módulos clave: `api-gw2.js`, `router.js`, `achievements.js`, `wizards-vault.js`, `wv-season-storage.js`, `wv-purchase-detail.js`, `wv-tabs-skin.js`, `wv-shop-ui.js`, `wv-objectives-ui.js`, `wv-theme.js`, `wallet-dashboard.js`, `raid-tracker.js`, `app.js`, `meta.js`, `activities.js`, `activities-theme.js`, `characters.js`, `characters-theme.js`, `accounts-panel.js`, `welcome-panel.js`, `settings-manager.js`, `analytics.js`, `gist-sync.js`, `sidebar-nav.js`, `*-theme.js`, `main.css`, `theme-polish.css`

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
| `view_module` | Navegación a cada módulo (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, **wallet_dashboard**, **raids**) | `router.js` |
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

### 🆕 Corrección de rutas assets para GitHub Pages

- Eliminada barra inicial `/` en todas las rutas de assets
- Rutas ahora relativas: `assets/icons/xxx.png` (no `/assets/icons/xxx.png`)
- Afecta: `index.html`, `activities.js`, `characters.js`, `wv-purchase-detail.js`, `accounts-panel.js`, `welcome-panel.js`, `wallet-dashboard.js`, **`raid-tracker.js`**

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
- `#/account/characters` — Personajes
- `#/account/accounts` — Cuentas
- `#/welcome` — Pantalla de Bienvenida
- `#/wallet/dashboard` — Dashboard de Cartera Multi-Cuenta
- `#/account/raids` — **Seguimiento de Raids (NUEVO)**

## 🧩 Responsabilidades por archivo (Consolidado v6.3)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | **v2.12.0** | API Layer con fetchWithRetry, cachés, WV, achievements, items, account info con last_modified, **getAccountRaids** |
| `js/wv-season-storage.js` | v1.1.1 | Almacenamiento por temporada (JSON por temporada en localStorage) |
| `js/wizards-vault.js` | v1.3.0 | WV: objetivos, tienda, integración con SeasonStore. Recarga forzada de temporada |
| `js/wv-shop-ui.js` | **v1.0.0** | **NUEVO** UI de Tienda WV (extraído de router.js) — renderizado, filtros, toolbar, skeleton, marcas, pins |
| `js/wv-objectives-ui.js` | **v1.0.0** | **NUEVO** UI de Objetivos WV (extraído de router.js) — renderizado de diarias/semanales/especiales |
| `js/wv-purchase-detail.js` | v1.13.0 | Detalle de compras, dashboard AA, top pendientes. Estado online basado en last_modified |
| `js/wv-tabs-skin.js` | v1.0.0 | Re-skin de tabs WV, consistente con rerenders |
| `js/achievements.js` | v3.2.0 | Logros: grid único, recompensas visibles, dropdowns personalizados, AP potencial |
| `js/meta.js` | **v3.2.1** | MetaEventos con horarios, estado "Hecho hoy". **Modo Deluxe eliminado** |
| `js/sidebar-nav.js` | v1.2 | Router‑friendly + tokenchange + a11y |
| `js/activities.js` | **v3.19.3** | Actividades diarias/semanales: PSNA, fractales, ecto, home nodes. **Cards unificadas visualmente** |
| `js/activities-theme.js` | v2.6.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Personajes: lista, ubicación, POIs, rangos PvP/WvW. Íconos profesión locales |
| `js/characters-theme.js` | **v1.0.0** | **NUEVO** Tema visual de Personajes (borde de profesión, dropdowns POI personalizados) |
| `js/accounts-panel.js` | **v1.9.0** | Panel de Cuentas: gestión segura + asistente .enc. **Pantalla de carga 2 columnas, fila expandible en tabla, border-left por tipo** |
| `js/settings-manager.js` | v1.0.2 | Sistema de Backup/Restaurar: exportación/importación completa de configuración |
| `js/gist-sync.js` | v1.0.0 | Sincronización con GitHub Gist |
| `js/welcome-panel.js` | v1.3.0 | Pantalla de Bienvenida: onboarding, accesos rápidos, enlaces comunitarios y apoyo |
| `js/raid-tracker.js` | v1.7.0 | Seguimiento de Raids Semanales: 8 alas, 33 encuentros, marcado automático vía API |
| `js/wallet-dashboard.js` | **v2.5.0** | Dashboard de Cartera Multi-Cuenta: **iconos por tipo de cuenta, KPIs con border-left, formato moneda unificado** |
| `js/router.js` | **v2.15.0** | **Router desacoplado (~750 líneas). Solo orquesta navegación y ciclo de vida. Delega renderizado WV a módulos UI** |
| `js/app.js` | **v2.6.3** | Keys, wallet, eventos globales. **Modal de API Keys rediseñado, KeyManager.setKeyTag()** |
| `js/analytics.js` | v1.0.0 | Eventos personalizados para Google Analytics. API pública `window.Analytics`. Cola de eventos segura. |
| `js/wallet-theme.js` | **v1.4.0** | Tema visual de Cartera: **receta unificada (borde neutro + border-left de color + glow suave)** |
| `js/meta-theme.js` | v1.4.1 | Tema visual de Meta: borde de expansión + barra de horarios |
| `js/achievements-theme.js` | v1.1.0 | Tema visual de Logros: borde de categoría |
| `js/wv-theme.js` | **v1.0.0** | **NUEVO** Tema visual de WV: borde de rareza/modo + glow unificado |
| `css/theme-polish.css` | **v2.1.0** | **Componentes canónicos + hover unificado + tabla unificada extendida + variable --elev-hover** |
| `css/main.css` | **v2.6.0** | Estilos principales. **Eliminados estilos Deluxe, KPIs con border-left, estilos Accounts** |

### Archivos eliminados (v6.3)
- `js/wallet-cur-theme-patch.js` — redundante con `wallet-theme.js`, aplicaba `!important` y eliminaba glows

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
| **Funcionalidades** | Lista de 8 acciones con iconos exclusivos (cartera, meta, logros, WV, actividades, personajes, cuentas, **raids**) |
| **API Key** | Botones "Agregar API Key" y "Gestionar Keys" + enlace a ANet |
| **Asistente de Cuentas** | Acceso rápido al asistente con mensaje de seguridad destacado |
| **Acceso Rápido** | 8 botones con iconos originales de los paneles (incluye **Raids**) |
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

## ✅ js/accounts-panel.js — Panel de Cuentas (v1.9.0)

### Resumen

Panel que permite gestionar de forma segura múltiples cuentas de Guild Wars 2 con cifrado local, persistencia inteligente y un asistente para crear archivos `.enc` desde Excel.

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
- Vista tarjetas (default) con información completa
- Vista tabla con resumen compacto
- Botón toggle para cambiar entre vistas (persiste en sesión)

**Gestión de información sensible**
- Contraseñas ocultas con `••••••••`, se muestran con botón 👁️ (reemplazado por imagen local `assets/icons/welcome/528726.png`)
- Click en email, contraseña, Gmail Pass, Twitch username, Twitch email, Twitch password o API Key copia al portapapeles con feedback visual (toast)
- Click en nombre de cuenta expande información adicional (mochilas, bancos, material, legendarias)

**Secciones colapsables**
- **Credenciales**: Contraseña, Gmail Pass (icono título: `733266.png`, campo contraseña: `733265.png`)
- **GW2 Avanzado**: Chars, Mochilas, Bancos, Material, Legendarias, Nivel 80 (icono título: `358409.png`, campo Chars: `156409.png`)
- **Expansiones**: Iconos de expansiones
- **Servicios y API**:
  - Subsección **Servicios** (colapsable) que contiene:
    - Twitch: username (copiable), email (copiable si existe), password (toggle independiente + copiable si existe)
    - GeForce Now: texto "Vinculado" con imagen `assets/icons/Welcome/156108.png` (reemplazo de emoji ✅)
  - API Key (copiable)

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

## ✅ js/activities.js — Panel de Actividades (v3.19.3)

### Resumen

Panel que agrupa actividades diarias y semanales relevantes para el jugador: PSNA, fractales, world bosses, refinamiento de ecto, home nodes y objetivos semanales.

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

**Refinamiento de Ecto**
- Estado de `/v2/account/dailycrafting` + metadatos de items (iconos oficiales)
- Tooltips "Hecho hoy / Pendiente"

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

Panel completo que muestra la lista de personajes de la cuenta con su profesión, raza, nivel y gremio. Permite asignar manualmente puntos de interés (POIs) a cada personaje, con filtros por categoría. Incluye rangos PvP y WvW de la cuenta.

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

## ✅ js/wv-purchase-detail.js — Detalle de Compras (v1.13.0)

### Resumen

Dashboard de seguimiento de compras de Wizard's Vault con KPIs de Aclamación Astral, listado de ítems fijados por cuenta, top pendientes y **estado online basado en last_modified**.

### Novedades visuales (v1.13.0)

- **Estado online basado en last_modified**: detecta CUALQUIER actividad (PvP, PvE, WvW, economía) en los últimos 20 minutos
- **Ícono 🕐** en lugar de ⚔️ para indicar actividad general
- **Tooltip actualizado**: "Activo (actividad reciente)"
- **Barra de progreso compacta** en cada celda de ítem fijado, mostrando estado visual (✅ Completado / ⚠️ Pendiente)
- **Input numérico + botón MAX** para marcas manuales
- **Auto-guardado con debounce (500ms)**
- **Regla dual:** `Math.max(apiPurchased, manualMarks)` — muestra el valor más alto entre la API y las marcas manuales
- La API reporta correctamente las compras de temporadas anteriores (verificado con `/v2/account/wizardsvault/listings`)

### Novedades visuales (v1.8.6 - base)

- **Sistema de colores unificado**:
  - 🟢 Verde: Total disponible / DISP (recurso disponible)
  - 🟡 Amarillo: Necesaria (fijados) / NECESARIO (objetivo pendiente)
  - 🟢 Verde / 🔴 Rojo: Δ Global / Δ según signo (excedente/déficit)

- **Íconos oficiales en countdowns**:
  - Reset diario: `assets/icons/523379.png`
  - Reset semanal: `assets/icons/523380.png`
  - Fin de temporada: `assets/icons/523381.png`

- **Banner y botón de acceso**: ícono local `assets/icons/3594051.png`

- **Nuevos componentes visuales**:
  - Encabezados tipo pill con ícono AA integrado
  - Badges con efecto hover (scale + brightness)
  - KPIs con borde lateral color + glow según estado
  - Skeleton loader animado durante carga de datos

- **Mejoras de UX**:
  - Animación de entrada (fade-in + scale)
  - Timestamp de última actualización
  - Tooltips nativos con `data-tip`

### APIs consumidas

- `GW2Api.getAccountInfo()` (para last_modified)
- `GW2Api.isRecentlyActive()` (para determinar actividad)
- `GW2Api.getWVShopMerged()` (vía api-gw2.js)
- `GW2Api.getWVWeekly()` (para meta steps)
- `WVSeasonStore.getCurrentSeasonInfo()` (temporada)

## ✅ js/wallet-dashboard.js — Dashboard de Cartera Multi-Cuenta (v2.5.0)

### Resumen

Módulo que muestra todas las cuentas (API keys) en una tabla, con columnas para las divisas seleccionadas por el usuario, fila de totales y KPIs resumen.

### ¿Qué hace?

- **Carga paralela de wallets**: similar a `wv-purchase-detail.js`, usa `MAX=3` peticiones concurrentes.
- **Selector de divisas**: dropdown con checkboxes e íconos, persistencia en localStorage.
- **Ordenamiento dinámico**: clic en encabezado ordena ascendente/descendente.
- **KPIs resumen**: tarjetas con Total Oro, Total Karma, Total Laurel, Reconocimiento Astral (íconos oficiales).
- **Formato de moneda**: oro en `X g Y s Z c` con colores (amarillo para oro, gris para plata, cobre para cobre).
- **Fila de totales**: suma de todas las cuentas por divisa.
- **Skeleton loader**: animación durante carga de datos.
- **Reintento de renderizado**: si la tabla no existe en el DOM, reintenta después de 100ms.

### APIs consumidas

- `GW2Api.getCurrenciesAll()` → lista de todas las divisas
- `GW2Api.getAccountWallet(token)` → wallet de cada cuenta

### Persistencia en localStorage

| Clave | Contenido |
|-------|-----------|
| `wallet_dashboard_selected_currencies` | Array de IDs de divisas seleccionadas |
| `wallet_dashboard_sort` | `{ column, direction }` para ordenamiento |

### Estructura del panel

```html
<section id="walletDashboardPanel" class="panel col-main" hidden>
  <div class="wd-content">
    <div class="panel__head">
      <h2 class="panel__title">Dashboard de Cartera Multi-Cuenta</h2>
    </div>
    <div class="panel__body">
      <div id="wdKPIs"><!-- KPIs --></div>
      <div class="wd-filters">
        <div id="wdCurrencySelector"><!-- Dropdown divisas --></div>
        <button id="wdRefreshBtn">Refrescar</button>
        <button id="wdBackBtn">Volver a Cartera</button>
      </div>
      <div class="wd-tablewrap">
        <table id="wdTable" class="wvpd">...<table>
      </div>
    </div>
  </div>
</section>
```

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

### Estructura del panel

```html
<section id="raidTrackerPanel" class="panel col-main" hidden>
  <h2 class="panel__title">
    <img src="assets/icons/raids/raid-icon.png" alt="" width="32" height="32">
    Seguimiento de Raids
  </h2>
  <div class="panel__body">
    <div id="raidKPIs" class="raid-kpis"></div>
    <div id="raidWingsGrid" class="raid-wings-grid"></div>
  </div>
</section>
```

## ✅ js/router.js — Router y Vistas (v2.15.0 — Desacoplado)

### Resumen

Orquestador principal de navegación. Desde v2.15.0, **delega el renderizado de la tienda y objetivos de WV** a módulos especializados (`wv-shop-ui.js`, `wv-objectives-ui.js`), manteniendo fallback completo.

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
│   └── bosses/
│       ├── vale_guardian.png
│       ├── gorseval.png
│       ├── sabetha.jpg
│       ├── slothasor.png
│       ├── bandit_trio.png
│       ├── matthias.png
│       ├── siege_the_stronghold.png
│       ├── keep_construct.png
│       ├── twisted_castle.png
│       ├── xera.png
│       ├── cairn.png
│       ├── mursaat_overseer.png
│       ├── samarog.png
│       ├── deimos.png
│       ├── desmina.png
│       ├── river_of_souls.png
│       ├── statues_of_grenth.png
│       ├── dhuum.png
│       ├── conjured_amalgamate.png
│       ├── twin_largos.gif
│       ├── qadim.png
│       ├── gates_of_ahdashim.png
│       ├── adina.png
│       ├── sabir.png
│       ├── qadim_the_peerless.png
│       ├── ura_guardian.png
│       ├── the_threshold.png
│       ├── decimus.png
│       └── default.png
├── ui/
│   ├── home.png                # Home (utilbar y bienvenida)
│   ├── utc-icon.png
│   ├── local-icon.png
│   ├── daily-reset.png
│   ├── weekly-reset.png
│   └── waypoint.png
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
├── Cuentas/
│   ├── GW2free.png             # Icono cuenta (todas)
│   ├── candado GW2.png         # Candado
│   ├── gmail.png               # Gmail
│   ├── passgoogle.png          # Google Pass
│   ├── twitchlogo.png          # Twitch
│   ├── gforce.png              # GeForce Now
│   ├── HoT.png                 # Heart of Thorns
│   ├── PoF.png                 # Path of Fire
│   ├── EoD.png                 # End of Dragons
│   ├── SoTO.png                # Secrets of the Obscure
│   ├── JW.png                  # Janthir Wilds
│   ├── VoE.png                 # Visions of Eternity
│   ├── Heroic.png              # Heroic Edition
│   ├── 547827.png              # Principal (badge)
│   ├── 157375.png              # Alternativa (badge)
│   ├── 102538.png              # F2P (badge)
│   ├── 157332.png              # Farming (badge)
│   ├── 1716669.png             # Llaves (badge)
│   ├── 240679.png              # Weekly (badge)
│   ├── 102438.png              # Taxi (badge)
│   ├── 733265.png              # Contraseña (campo)
│   ├── 733266.png              # Credenciales (título)
│   ├── 156409.png              # Chars (campo)
│   ├── 358409.png              # GW2 Avanzado (título)
│   └── ...
└── ...
```

## 🔄 Flujo de eventos recomendado

- UX cambia key → `KeyManager.setSelected()` → `gn:tokenchange`
- Router escucha → `prefetch` WV/Ach/Activities/Characters/Accounts/Welcome/RaidTracker → render
- **Redirección inicial**: si primera visita o sin key → `#/welcome` (excepto si ya está en `#/welcome` o `#/wallet/dashboard`)
- Activities: solo `render()` (no escucha key-change)
- Characters: escucha `gn:tokenchange` → recarga datos con caché
- Accounts: escucha `gn:tokenchange` → limpia estado (opcional)
- **RaidTracker**: escucha `gn:tokenchange` → recarga datos automáticamente
- **WV (nuevo)**: `router.js` delega renderizado a `wv-shop-ui.js` y `wv-objectives-ui.js` con fallback
- WVSeasonStore: migración legacy en background
- SettingsManager: botones en utilbar, export/import independiente
- **WalletDashboard**: accesible desde botón en `#walletPanel` o ruta `#/wallet/dashboard`
- **RaidTracker**: accesible desde enlace en sidebar o ruta `#/account/raids`

## 🧪 Checklists de Salud (v6.3)

### Orden de scripts (obligatorio)

```
SIN defer (dependencias base):
  - crypto-js (CDN)
  - xlsx (CDN)
  - api-gw2.js
  - wizards-vault.js
  - wv-season-storage.js

DEFER (módulos, en orden):
  - achievements.js
  - meta.js
  - sidebar-nav.js
  - activities.js
  - activities-theme.js
  - characters.js
  - characters-theme.js
  - accounts-panel.js
  - settings-manager.js
  - gist-sync.js
  - welcome-panel.js
  - raid-tracker.js
  - wv-shop-ui.js
  - wv-objectives-ui.js
  - wv-theme.js
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

### Arquitectura WV desacoplada

- ✅ `router.js` delega renderizado de tienda a `wv-shop-ui.js`
- ✅ `router.js` delega renderizado de objetivos a `wv-objectives-ui.js`
- ✅ Ambos módulos tienen fallback completo si no están disponibles
- ✅ `__getShopState()` y `__getObjState()` expuestos en API pública de WV
- ✅ `wv-theme.js` aplica bordes unificados sin tocar lógica de renderizado
- ✅ `router.js` reducido de ~1200 a ~750 líneas

### Receta visual unificada

- ✅ `theme-polish.css` → `.card` base con hover unificado + `--elev-hover`
- ✅ `wallet-theme.js` → `border-left` de color de divisa + glow neutro
- ✅ `meta-theme.js` → `border-left` de color de expansión + glow neutro
- ✅ `achievements-theme.js` → `border-left` de color de categoría + glow neutro
- ✅ `characters-theme.js` → `border-left` de color de profesión + dropdowns personalizados
- ✅ `wv-theme.js` → `border-left` de color de rareza/modo + glow neutro
- ✅ `activities.js` → cards de Ecto, Fractales, PSNA con `border-left` semántico

### Módulos rediseñados (v6.3)

- ✅ **Cartera**: tabla unificada con iconos, formato moneda con colores, categorías como badges
- ✅ **Dashboard Cartera**: KPIs con border-left semántico, iconos por tipo de cuenta, emoji reemplazado
- ✅ **Panel de Cuentas**: carga 2 columnas, texto seguridad ampliado, botón archivo estilizado, tabla con fila expandible, border-left por tipo
- ✅ **API Keys Modal**: iconos de tipo, badge "En uso", botones con iconos, botón eliminar en rojo
- ✅ **Actividades**: Ecto, Fractales y PSNA unificados visualmente
- ✅ **Personajes**: border-left de profesión, dropdowns personalizados para POIs
- ✅ **Cámara del Brujo**: desacople completo + tema visual unificado
- ✅ **Meta & Eventos**: Modo Deluxe eliminado

### Google Analytics

- ✅ Script de GA4 agregado en `<head>` con ID `G-LB782QT9TR`
- ✅ `analytics.js` creado y referenciado
- ✅ Eventos en `router.js` para todos los módulos (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, **wallet_dashboard**, **raids**)

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

### Purchase Detail (v1.13.0)

- ✅ **Estado online basado en last_modified** (actividad general, no solo PvP)
- ✅ **Ícono 🕐** en lugar de ⚔️
- ✅ **Umbral de 20 minutos** configurado
- ✅ Barra de progreso compacta en cada celda de ítem fijado
- ✅ Input numérico + botón MAX con auto-guardado
- ✅ Regla dual: `Math.max(apiPurchased, manualMarks)`
- ✅ API reporta compras de temporadas anteriores
- ✅ Temporada actual correcta (selector)
- ✅ Timers cargando
- ✅ Íconos visibles (todos locales)
- ✅ Sistema de colores unificado (verde/amarillo/rojo)
- ✅ Badges con efecto hover
- ✅ Skeleton loader animado
- ✅ Timestamp de última actualización
- ✅ Íconos countdowns locales (523379-523381)

### Wallet Dashboard (v2.5.0)

- ✅ Tabla de cuentas vs divisas seleccionadas
- ✅ Selector de divisas dropdown con íconos
- ✅ Persistencia de selección en localStorage
- ✅ Ordenamiento dinámico por columna (clic en encabezado)
- ✅ KPIs resumen con íconos oficiales (Oro, Karma, Laurel, AA)
- ✅ Formato de moneda para Oro (`X g Y s Z c` con colores)
- ✅ Fila de totales destacada
- ✅ Skeleton loader durante carga
- ✅ Scroll horizontal para tablas grandes
- ✅ Botón "Refrescar" y "Volver a Cartera"
- ✅ Ruta `#/wallet/dashboard` integrada en router
- ✅ Botón de acceso en panel de Cartera

### Raid Tracker (v1.3.1) — NUEVO

- ✅ 8 alas completas (Ala 1 a Ala 8)
- ✅ 33 encuentros totales (21 jefes + 12 eventos)
- ✅ Marcado automático vía `/v2/account/raids`
- ✅ KPIs semanales (completados/total + porcentaje)
- ✅ Modal con descripción y estrategia (5+ bullets cada uno)
- ✅ Enlace a video tutorial
- ✅ Diferenciación visual JEFE/EVENTO (👑/⚡)
- ✅ Manejo seguro de imágenes sin reintentos infinitos
- ✅ Fallback a emojis (🏰 para alas, 👾 para encuentros)
- ✅ Reset semanal automático
- ✅ Escucha `gn:tokenchange` para recargar automáticamente
- ✅ Ruta `#/account/raids` integrada en router
- ✅ Enlace en sidebar (debajo de Actividades, antes de Personajes)
- ✅ Evento Analytics `view_module` con `module_name: 'raids'`
- ✅ API `getAccountRaids` agregada en `api-gw2.js` v2.12.0

### Router / Tienda (v2.15.0)

- ✅ Router desacoplado: delega renderizado a `wv-shop-ui.js` y `wv-objectives-ui.js`
- ✅ Fallback completo si los módulos UI no están disponibles
- ✅ Barra de progreso e input manual integrados en todas las tarjetas
- ✅ Las barras NO desaparecen al modificar valores ni al cambiar de pestaña
- ✅ Persistencia de marcas en WVSeasonStore
- ✅ Eliminado event listener conflictivo de `wv:season-store:mutate`
- ✅ Vista tarjetas / tabla funcional
- ✅ Filtros y ordenamiento funcionan
- ✅ **Nueva ruta `#/wallet/dashboard`** funcionando
- ✅ **Nueva ruta `#/account/raids`** funcionando
- ✅ **Redirección de bienvenida** no interfiere con dashboard

### Activities

- KPI strips visibles (ambas pestañas)
- PSNA "Acción crítica" funcional
- Fractales con ícono genérico local
- World Bosses próximos
- Ecto con iconos oficiales
- **Barra de horarios unificada**: ✅ Iconos GW2, UTC, Local, resets con segundos
- **Detección automática de llave semanal**: ✅ (Thief nivel ≥10, <7 días, **misma semana**)
- **Botones de Leivas (+/-)**: ✅ funcionando correctamente
- **Cards unificadas visualmente**: ✅ Ecto, Fractales, PSNA con border-left semántico
- Home Nodes:
  - ✅ Lista completa de 74 elementos (API + Janthir + Contratos)
  - ✅ Estado de desbloqueo vía API (✅/❌)
  - ✅ Filtros por categoría, tipo y estado
  - ✅ Tarjetas con doble icono (tipo + ítem destacado)
  - ✅ Checkbox "Recolectado hoy" con persistencia diaria
  - ✅ Contador de progreso de recolección

### Meta & Eventos

- Horarios de eventos en tarjetas
- Estado "Hecho hoy" con cache
- Favoritos (máx 6)
- **Barra de horarios unificada**: ✅ Iconos GW2, UTC, Local, resets con segundos
- **Botón "Horarios" con color dinámico**: ✅ Verde (activo), Ámbar (próximo), Azul (más tarde)
- **Horarios convertidos a hora local**: ✅
- **Próximo horario resaltado**: ✅
- **Modo Deluxe eliminado**: ✅ (no tenía efecto visual)

### Characters

- Lista de personajes visible
- Iconos de profesión locales (desde `assets/icons/professions/`)
- Iconos de especialidad (desde `/v2/specializations`)
- Rangos PvP/WvW en header
- Selector de POI con categorías
- Asignación persistente entre recargas
- Filtros funcionales
- Vista tarjetas/tabla
- Paginación
- **Tema visual unificado**: ✅ `characters-theme.js` con border-left de profesión y dropdowns personalizados

### Accounts (v1.9.0)

- ✅ Panel accesible vía `#/account/accounts`
- ✅ Enlace en sidebar
- ✅ Carga de archivo `.enc` con contraseña
- ✅ Persistencia de último archivo en localStorage
- ✅ Vista tarjetas / tabla con botón toggle
- ✅ Contraseñas ocultas con botón 👁️ (imagen local `528726.png`)
- ✅ Copia al portapapeles (email, contraseña GW2, Gmail Pass, Twitch username, Twitch email, Twitch password, API Key)
- ✅ Click en nombre expande información adicional
- ✅ Secciones colapsables: Credenciales, GW2 Avanzado, Expansiones, Servicios y API
- ✅ Subsección "Servicios" colapsable dentro de Servicios y API
- ✅ Twitch: username (copiable), email (copiable si existe), password (toggle independiente + copiable si existe)
- ✅ GeForce Now: imagen local `156108.png` en lugar de emoji ✅
- ✅ Iconos separados para títulos de secciones vs campos internos
- ✅ Barra de estadísticas con separadores optimizados (`margin: 0 -6px`)
- ✅ Filtros funcionales (búsqueda, tipo, tags)
- ✅ Botón "Cambiar archivo" para resetear estado
- ✅ **Asistente integrado** con 4 pasos para crear archivos .enc desde Excel
- ✅ **Plantilla Excel descargable** con columnas: id, nombre, email, password, gmailPassword, apiKey, twitch_user, twitch_email, twitch_password, geforce_linked, notas, tags
- ✅ **Enriquecimiento automático** con GW2 API usando keys de la Bóveda
- ✅ **Pantalla de carga rediseñada**: 2 columnas con cards del mismo alto
- ✅ **Texto de seguridad ampliado**: 4 bullets con iconos
- ✅ **Selector de archivo estilizado**: botón que muestra nombre en verde
- ✅ **Vista tabla con border-left por tipo y fila expandible**

### Settings Manager (v1.0.1)

- ✅ Botón Backup en utilbar (`155034.png`)
- ✅ Botón Restaurar en utilbar (`155033.png`)
- ✅ Exportación completa: API Keys, WV, Wallet, Activities, Characters, Meta, global
- ✅ Importación con validación de versión
- ✅ Confirmación de sobrescritura
- ✅ Recarga automática después de importar
- ✅ Claves correctas de localStorage (`gw2_keys`, `gw2_selected_key_v1`)

### Analytics (v1.0.0)

- ✅ Evento `view_module` en los 10 módulos principales (wallet, meta_events, achievements, wizards_vault, activities, characters, accounts, welcome, **wallet_dashboard**, **raids**)
- ✅ Evento `export_backup` en exportAll()
- ✅ Evento `import_backup` en importAll()
- ✅ Evento `open_account_wizard` en openWizardModal()
- ✅ Evento `download_excel_template` en generateExcelTemplate()
- ✅ Evento `enrich_with_api` en enrichWithGW2API()
- ✅ Evento `encrypt_accounts_file` en evento click de wizardEncrypt
- ✅ Evento `force_reload_season` en forceReloadSeason()
- ✅ Evento `open_api_keys_modal` en openKeysModal()
- ✅ Evento `add_api_key` en submit del formulario de keys
- ✅ Evento `delete_api_key` en click del botón eliminar

### Header Compacto

- ✅ Altura reducida (~60px)
- ✅ Logo + nombre en una sola línea
- ✅ Eliminación del hero y tabs
- ✅ Responsive (apilado en móvil)
- ✅ Botones Backup/Restaurar visibles
- ✅ Redes sociales con imágenes locales (discord.png, instagram.png, youtube.png, twitchlogo.png, github.png)

### Cámara del Brujo (WV)

- ✅ Tooltip informativo con ícono `155018.png`
- ✅ Ícono junto al título "Cámara del Brujo"
- ✅ Estilos de contención para evitar desbordes
- ✅ Panel correctamente envuelto en `<section id="wvPanel">`
- ✅ Ícono de recarga forzada de temporada con `834002.png`
- ✅ **Desacople completo de router**: tienda en `wv-shop-ui.js`, objetivos en `wv-objectives-ui.js`
- ✅ **Tema visual unificado**: `wv-theme.js` con border-left de rareza/modo
- ✅ **Fallback completo** si los módulos UI no están disponibles

### Welcome

- ✅ Panel accesible vía `#/welcome`
- ✅ Botón home en utilbar
- ✅ Redirección en primera visita o sin API key (excepto si ya está en welcome o dashboard)
- ✅ Flag `gn_welcome_seen` en localStorage
- ✅ 8 secciones completas (funcionalidades, API Key, asistente, acceso rápido, comunidad, apoyo) — **incluye Raids**
- ✅ Iconos exclusivos en lista de funcionalidades (incluye **raids-icon.png**)
- ✅ Iconos en todas las secciones
- ✅ Botones "Agregar API Key" y "Gestionar Keys" abren modal correctamente
- ✅ Modal de API Keys cierra correctamente (backdrop, X, ESC)

### Raid Tracker — NUEVO

- ✅ Panel accesible vía `#/account/raids`
- ✅ Enlace en sidebar (debajo de Actividades, antes de Personajes)
- ✅ Carga de datos vía `GW2Api.getAccountRaids()`
- ✅ Visualización de 8 alas con todos los encuentros
- ✅ KPIs de progreso semanal
- ✅ Modal con detalles (descripción, estrategia, video)
- ✅ Manejo de error cuando no hay permiso `progression`
- ✅ Recarga automática al cambiar de API key

## 📌 Buenas prácticas actualizadas (v6.3)

### Receta Visual

- **Un solo estándar**: borde neutro `rgba(255,255,255,0.08)`, border-left de color, glow `rgba(90,110,154,0.12)`
- **Hover unificado**: `translateY(-3px)` + sombra profunda en `theme-polish.css`
- **Colores semánticos**: cada módulo define su paleta de colores para el `border-left`
- **Nuevos módulos**: deben seguir esta receta desde el día 1
- **No usar `!important`** en estilos de tema
- **No eliminar `box-shadow`** de otras capas

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
- **Ícono 🕐** en lugar de ⚔️ para reflejar actividad general

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

### Characters (específico)

- Carga optimizada: batch processing, timeouts, retries
- Eventos personalizados para comunicación con UI
- Actualización selectiva de selects de POI (sin rerenderizar toda la lista)
- Historial de ubicaciones como fallback ante API que ya no devuelve `map_id`
- Caché de personajes con TTL para reducir llamadas a API
- **Íconos de profesión locales**: prioridad local sobre API
- **Dropdowns personalizados**: seguir patrón de `characters-theme.js`

### Accounts (específico)

- Archivo cifrado guardado en localStorage (no sessionStorage) para persistencia
- Contraseña nunca almacenada, solo hash para comparación
- Expansión de información sensible en memoria (no persiste)
- Copia al portapapeles con feedback visual (toast)
- Botón "Cambiar archivo" permite resetear estado completo
- Click en nombre de cuenta expande info (no botón adicional)
- **Asistente**: todo el procesamiento es local, sin backend
- **Plantilla Excel**: columnas predefinidas con ejemplos (incluye twitch_user, twitch_email, twitch_password)
- **Enriquecimiento**: usa las API Keys ya almacenadas en la Bóveda
- **Iconos**: reemplazo completo de emojis por imágenes locales
- **Toggles**: ícono de ojo unificado (`528726.png`) para todas las contraseñas
- **Twitch**: información detallada en subsección colapsable con toggles independientes
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

### Arquitectura CSS (3 capas)
- **main.css** → layout, backgrounds, tipografía (sin bordes ni box-shadows)
- **theme-polish.css** → borde neutro, glow base suave, hover unificado (`--elev-hover`)
- **-theme.js** → solo border-left de color semántico

## 🧾 Historial de decisiones (v6.3)

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

## 🎉 Estado actual del proyecto (v6.3)

- ✅ Navegación estable y desacoplada
- ✅ **Router reducido a ~750 líneas** (solo orquestación, sin renderizado HTML)
- ✅ **WV completamente desacoplada** (tienda en `wv-shop-ui.js`, objetivos en `wv-objectives-ui.js`)
- ✅ **Receta visual unificada** aplicada en todos los módulos (11 módulos)
- ✅ Achievements sin doble pipeline (watchdog ok)
- ✅ Purchase Detail v1.13.0 productivo: estado online basado en last_modified
- ✅ Tienda WV productiva: barra de progreso + input manual + persistencia
- ✅ SeasonStore funcionando bien incluso con cuota mínima
- ✅ Activities v3.19.3 productivo: cards unificadas visualmente
- ✅ Home Nodes v2.3.0 productivo: lista completa (74), filtros, persistencia
- ✅ Barra de horarios unificada productiva
- ✅ Characters v2.3.0 productivo con `characters-theme.js` (dropdowns personalizados)
- ✅ Panel de Cuentas v1.9.0 productivo: carga 2 columnas, fila expandible, border-left por tipo
- ✅ API Keys Modal rediseñado con iconos y badges
- ✅ Todos los assets migrados a rutas relativas (compatibles con GitHub Pages)
- ✅ Google Analytics integrado con eventos en 10 módulos
- ✅ Estado online basado en last_modified: umbral 20 minutos, ícono 🕐
- ✅ Dashboard de Cartera Multi-Cuenta: KPIs, iconos por tipo, ordenamiento
- ✅ Raid Tracker: 8 alas, 33 encuentros, modal con detalles
- ✅ **Cámara del Brujo 100% desacoplada de router.js**
- ✅ **Cero código redundante** (Modo Deluxe y wallet-cur-theme-patch eliminados)
- ✅ **Sistema de iconos por tipo de cuenta** sincronizado entre Accounts y Dashboard
```