# 🐈⬛ Bóveda del Gato Negro — Onboarding Técnico Consolidado (v5.6)

Fecha: 2026-03-28
Módulos clave: `api-gw2.js`, `router.js`, `achievements.js`, `wizards-vault.js`, `wv-season-storage.js`, `wv-purchase-detail.js`, `wv-tabs-skin.js`, `app.js`, `meta.js`, `activities.js`, `activities-theme.js`, `characters.js`, `accounts-panel.js`, `welcome-panel.js`, `*-theme.js`, `app.css`

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
- Código claro y declarativo (sin “magia”).
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

## 🚀 Novedades v5.6

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
- Icono `assets/icons/ui/home.png`
- Ubicado al inicio del utilbar (antes de "Wiki GW2")
- Lleva a `#/welcome`

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

### 🆕 Corrección de rutas assets para GitHub Pages

- Eliminada barra inicial `/` en todas las rutas de assets
- Rutas ahora relativas: `assets/icons/xxx.png` (no `/assets/icons/xxx.png`)
- Afecta: `index.html`, `activities.js`, `characters.js`, `wv-purchase-detail.js`, `accounts-panel.js`, `welcome-panel.js`

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

### 🆕 Wizards’ Vault v1.2.1

- API pública compatible v1.1.0
- Integrado con SeasonStore (migración background)
- Normalización segura para dashboard

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

## 🧩 Responsabilidades por archivo (Consolidado v5.6)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | v2.7.0-modular | API Layer con fetchWithRetry, cachés, WV, achievements, items |
| `js/wv-season-storage.js` | v1.1.1 | Almacenamiento por temporada (JSON por temporada en localStorage) |
| `js/wizards-vault.js` | v1.2.1 | WV: objetivos, tienda, integración con SeasonStore |
| `js/achievements.js` | v2.10.0 | Logros: aside, summary, nearly, categories, KPIs |
| `js/meta.js` | v3.2.1 | MetaEventos con horarios, estado "Hecho hoy" |
| `js/sidebar-nav.js` | v1.2 | Router‑friendly + tokenchange + a11y |
| `js/activities.js` | v3.19.3 | Actividades diarias/semanales: PSNA, fractales, world bosses, ecto, home nodes. **Detección automática de llave semanal con validación de semana actual** |
| `js/activities-theme.js` | v2.5.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Personajes: lista, ubicación, POIs, rangos PvP/WvW. **Íconos profesión locales** |
| `js/accounts-panel.js` | **v1.9.0** | **Panel de Cuentas**: gestión segura + asistente para creación de archivos .enc desde Excel. **Rediseño completo con iconos locales, Twitch detallado (username, email, password), toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada** |
| `js/welcome-panel.js` | v1.2.0 | **Pantalla de Bienvenida**: onboarding, accesos rápidos, enlaces comunitarios y apoyo |
| `js/router.js` | v2.10.6 | Router con prefetch, guardas, navegación por hash, mapeo de vistas. **Incluye rutas #/account/accounts y #/welcome, redirección inicial** |
| `js/wv-purchase-detail.js` | v1.8.6 | Detalle de compras, dashboard AA, top pendientes, **íconos countdowns locales** |
| `js/wv-tabs-skin.js` | v1.0.0 | Re-skin de tabs WV, consistente con rerenders |
| `js/app.js` | v2.6.3 | Keys, wallet, eventos globales, emisor `gn:tokenchange` |
| `js/*-theme.js` | varios | Glows, colores, estilos temáticos por módulo |
| `js/meta-theme.js` | v1.3.1 | Barra de horarios unificada + mejora de horarios en tarjetas |

## ✅ NUEVO js/welcome-panel.js — Pantalla de Bienvenida (v1.2.0)

### Resumen

Pantalla de inicio que se muestra en primera visita o cuando no hay API key seleccionada. Centraliza la información de la Bóveda y ofrece accesos rápidos a todos los módulos.

### ¿Qué hace?

**Secciones:**

| Sección | Contenido |
|---------|----------|
| **Funcionalidades** | Lista de 7 acciones con iconos exclusivos (cartera, meta, logros, WV, actividades, personajes, cuentas) |
| **API Key** | Botones "Agregar API Key" y "Gestionar Keys" + enlace a ANet |
| **Asistente de Cuentas** | Acceso rápido al asistente con mensaje de seguridad destacado |
| **Acceso Rápido** | 7 botones con iconos originales de los paneles |
| **Comunidad** | Enlaces a Discord, Instagram, YouTube, Twitch, GitHub, email |
| **Apoyo** | Enlaces a PayPal y Ko-fi |

**Lógica de redirección:**
- Primera visita (`gn_welcome_seen` no existe) → `#/welcome`
- No hay API key seleccionada → `#/welcome`
- Botón home en utilbar → `#/welcome`

**Botón home:**
- Ubicado en el utilbar al inicio
- Icono `assets/icons/ui/home.png`
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
| Home (utilbar) | `assets/icons/ui/home.png` |
| Título bienvenida | `assets/icons/ui/home.png` |
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
- Tooltips “Hecho hoy / Pendiente”

**Nodos de Heredad (Home Nodes)**
- Agrupado por tipo (Minería / Madera / Recolección)
- Acordeones con “Mostrar todo / Ver menos”
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

## ✅ js/wv-purchase-detail.js — Detalle de Compras (v1.8.6)

### Resumen

Dashboard de seguimiento de compras de Wizard's Vault con KPIs de Aclamación Astral, listado de ítems fijados por cuenta, y top pendientes.

### Novedades visuales

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

- `GW2Api.getWVShopMerged()` (vía api-gw2.js)
- `GW2Api.getWVWeekly()` (para meta steps)
- `WVSeasonStore.getCurrentSeasonInfo()` (temporada)

## 🖼️ Assets locales (estructura final)

```
assets/icons/
├── 3594051.png                 # Cámara del Brujo (banner/button)
├── 733322.png                  # Cartera
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
│   ├── 528726.png               # Ícono ojo (toggle contraseñas)
│   └── 156108.png               # Check GeForce Now
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
│   ├── star.png                # Principal (badge)
│   ├── alter.png               # Alternativa (badge)
│   ├── farming.png             # Farming (badge)
│   ├── key.png                 # Llaves (badge)
│   ├── f2p.png                 # F2P (badge)
│   ├── 733265.png              # Contraseña (campo)
│   ├── 733266.png              # Credenciales (título)
│   ├── 156409.png              # Chars (campo)
│   ├── 358409.png              # GW2 Avanzado (título)
│   └── ...
└── ...
```

## 🔄 Flujo de eventos recomendado

- UX cambia key → `KeyManager.setSelected()` → `gn:tokenchange`
- Router escucha → `prefetch` WV/Ach/Activities/Characters/Accounts/Welcome → render
- **Redirección inicial**: si primera visita o sin key → `#/welcome`
- Activities: solo `render()` (no escucha key-change)
- Characters: escucha `gn:tokenchange` → recarga datos con caché
- Accounts: escucha `gn:tokenchange` → limpia estado (opcional)
- WVSeasonStore: migración legacy en background

## 🧪 Checklists de Salud (v5.6)

### Orden de scripts (obligatorio)

- `api-gw2.js` (sin defer)
- `wv-season-storage.js` (sin defer)
- `wizards-vault.js` (sin defer)
- `achievements.js` (defer)
- `meta.js` (defer)
- `sidebar-nav.js` (defer)
- `activities.js` (defer)
- `characters.js` (defer)
- `accounts-panel.js` (defer)
- `welcome-panel.js` (defer)
- `router.js` (defer)
- `wv-purchase-detail.js` (defer)
- `wv-tabs-skin.js` (defer)
- `app.js` (defer)

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

### Purchase Detail

- Temporada actual correcta (selector)
- Timers cargando
- Íconos visibles (todos locales)
- AA necesaria ≠ 0 (si hay pins vivos)
- ✅ Sistema de colores unificado (verde/amarillo/rojo)
- ✅ Badges con efecto hover
- ✅ Skeleton loader animado
- ✅ Timestamp de última actualización
- ✅ Íconos countdowns locales (523379-523381)

### Activities

- KPI strips visibles (ambas pestañas)
- PSNA “Acción crítica” funcional
- Fractales con ícono genérico local
- World Bosses próximos
- Ecto con iconos oficiales
- **Barra de horarios unificada**: ✅ Iconos GW2, UTC, Local, resets con segundos
- **Detección automática de llave semanal**: ✅ (Thief nivel ≥10, <7 días, **misma semana**)
- **Botones de Leivas (+/-)**: ✅ funcionando correctamente
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
- ✅ Iconos separados para títulos de secciones vs campos internos:
  - Credenciales (título): `733266.png`
  - Contraseña (campo): `733265.png`
  - GW2 Avanzado (título): `358409.png`
  - Chars (campo): `156409.png`
- ✅ Barra de estadísticas con separadores optimizados (`margin: 0 -6px`)
- ✅ Filtros funcionales (búsqueda, tipo, tags)
- ✅ Botón "Cambiar archivo" para resetear estado
- ✅ **Asistente integrado** con 4 pasos para crear archivos .enc desde Excel
- ✅ **Plantilla Excel descargable** con columnas: id, nombre, email, password, gmailPassword, apiKey, twitch_user, twitch_email, twitch_password, geforce_linked, notas, tags
- ✅ **Enriquecimiento automático** con GW2 API usando keys de la Bóveda

### Welcome

- ✅ Panel accesible vía `#/welcome`
- ✅ Botón home en utilbar
- ✅ Redirección en primera visita o sin API key
- ✅ Flag `gn_welcome_seen` en localStorage
- ✅ 7 secciones completas (funcionalidades, API Key, asistente, acceso rápido, comunidad, apoyo)
- ✅ Iconos exclusivos en lista de funcionalidades
- ✅ Iconos en todas las secciones
- ✅ Botones "Agregar API Key" y "Gestionar Keys" abren modal correctamente
- ✅ Modal de API Keys cierra correctamente (backdrop, X, ESC)

## 📌 Buenas prácticas actualizadas

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

### Characters (específico)

- Carga optimizada: batch processing, timeouts, retries
- Eventos personalizados para comunicación con UI
- Actualización selectiva de selects de POI (sin rerenderizar toda la lista)
- Historial de ubicaciones como fallback ante API que ya no devuelve `map_id`
- Caché de personajes con TTL para reducir llamadas a API
- **Íconos de profesión locales**: prioridad local sobre API

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

### Welcome (específico)

- Redirección solo en primera visita o sin key
- Guardar `gn_welcome_seen` para no repetir
- Botón home siempre accesible
- Iconos exclusivos para funcionalidades (no repetir de paneles)
- Modal de API Keys debe cerrarse correctamente desde cualquier lugar

### Purchase Detail (específico)

- Íconos countdowns locales (no wiki, no render.guildwars2.com)
- Banner y botón con ícono local
- Timers con formato unificado

## 🧾 Historial de decisiones (v5.6)

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
- **Mar 2026:** **Rediseño completo Panel de Cuentas v1.9.0** — iconos locales, Twitch detallado (username, email, password), toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada, separadores compactos

## 🎉 Estado actual del proyecto (v5.6)

- ✅ Navegación estable y desacoplada
- ✅ Achievements sin doble pipeline (watchdog ok)
- ✅ WV robusta con datos unificados
- ✅ Purchase Detail v1.8.6 productivo: countdowns con íconos locales
- ✅ SeasonStore funcionando bien incluso con cuota mínima
- ✅ Activities v3.19.3 productivo: fractales con ícono local, detección automática de llave semanal con validación de semana actual
- ✅ Home Nodes v2.3.0 productivo: lista completa (74), filtros, estado ✅/❌, persistencia
- ✅ Barra de horarios unificada productiva
- ✅ Characters v2.3.0 productivo: íconos profesión locales
- ✅ Todos los assets migrados a rutas relativas (compatibles con GitHub Pages)
- ✅ Íconos countdowns WV locales
- ✅ **Panel de Cuentas v1.9.0 productivo**: gestión segura de múltiples cuentas, cifrado local, persistencia inteligente, asistente integrado, rediseño completo con iconos locales, Twitch detallado (username, email, password), toggles independientes, subsección Servicios colapsable, barra de estadísticas optimizada
- ✅ **Pantalla de Bienvenida v1.2.0 productiva**: onboarding, accesos rápidos, enlaces comunitarios y apoyo
- ✅ **Botón home en utilbar**: accesible desde cualquier lugar
- ✅ **Redirección inteligente**: primera visita o sin key → bienvenida
- ✅ **Botones de Leivas funcionando correctamente** (sin regresiones)

---
