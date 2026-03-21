# 🐈⬛ Bóveda del Gato Negro — Onboarding Técnico Consolidado (v5)

Fecha: 2026-03-21
Módulos clave: `api-gw2.js`, `router.js`, `achievements.js`, `wizards-vault.js`, `wv-season-storage.js`, `wv-purchase-detail.js`, `wv-tabs-skin.js`, `app.js`, `meta.js`, `activities.js`, `activities-theme.js`, `characters.js`, `*-theme.js`, `app.css`

## 📌 BAI — Bloque de Alineamiento Instantáneo

(incluir este bloque al comienzo del onboarding)

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

## 🚀 Novedades v5 (consolidado)

### 🆕 Purchase Detail v1.8.4 — Rediseño visual completo

Rediseño total del dashboard de compras con nuevo estándar visual:

**Sistema de colores unificado:**
- 🟢 Verde: Total disponible / DISP (recurso disponible)
- 🟡 Amarillo: Necesaria (fijados) / NECESARIO (objetivo pendiente)
- 🟢 Verde / 🔴 Rojo: Δ Global / Δ según signo (excedente/déficit)

**Nuevos componentes visuales:**
- Encabezados tipo pill con ícono AA integrado
- Badges con efecto hover (scale + brightness)
- KPIs con borde lateral color + glow según estado
- Skeleton loader animado durante carga de datos

**Mejoras de UX:**
- Animación de entrada (fade-in + scale)
- Timestamp de última actualización
- Tooltips nativos con `data-tip`
- Eliminado checkbox "Vista compacta" (no funcional)

**Limpieza visual:**
- Eliminado reglón extra con símbolo '^' sobre tabla
- Removido fingerprint de la columna cuenta
- Unificación de estilos con el resto del dashboard

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

### 🆕 Purchase Detail v1.5.0

- Dashboard con historial por temporada
- Selector de temporada (estable)
- KPIs completos y lazy-load de íconos
- Persistencia F5 y reskin toolbar

### 🆕 Re-skin global de Tabs WV

- Estilo “Refrescar”, unificado
- Persistencia visual con MutationObserver

### 🆕 Activities — Panel de Actividades (v3.9.0 → v3.9.1)

Refactor completo con mejoras visuales en Home Nodes:

- **PSNA**: fuente externa JSON (assets/data/psna-schedule.json) con rotación de 8 días, copia de waypoints con feedback visual.
- **Fractales diarios**: T4 y recomendados (datos de ejemplo, lista para API real).
- **World Bosses**: cálculo dinámico de próximos eventos en ventana de 90 minutos.
- **Refinamiento de Ecto**: estado diario con iconos oficiales desde API.
- **Semanales**: Llave del León Negro y Leivas, con persistencia por cuenta.
- **KPI strips**: progreso diario y semanal.

#### 🆕 Home Nodes — Rediseño completo (v2.3.0)

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

**IDs correctos**: Mapeo completo de 74 consumibles con IDs verificados desde la wiki y gw2treasures.

### 🆕 Characters — Panel de Personajes (v2.2.2)

Panel completo que gestiona:

- Lista de personajes con profesión, raza, nivel y gremio.
- Carga optimizada: batch processing (3 a la vez), timeout 8s, reintentos automáticos (2 intentos).
- Caché de personajes con TTL de 5 minutos (localStorage por cuenta).
- Historial de ubicaciones (locationHistory) para persistir última ubicación conocida.
- Asignación manual de POIs (puntos de interés) con persistencia por cuenta y categorías (granja, puzzle, evento, meta).
- Filtros: búsqueda por nombre, filtro por mapa, por profesión y por categoría de POI.
- Vista tarjetas / tabla con paginación.
- Eventos personalizados: `characters:load:start`, `load:progress`, `load:complete`, `load:failed`, `characters:assignment:changed`.
- Rangos PvP/WvW vía `/v2/pvp/stats` y `/v2/account`.

## 🗺️ Visión general del proyecto

Web app ligera en browser, JS vanilla + HTML/CSS, sin framework. Estado y navegación coordinados por router + eventos globales.

### Rutas principales

- `#/cards` — Cartera (Wallet)
- `#/meta` — Meta & Eventos
- `#/account/achievements` — Logros
- `#/account/wizards-vault` — Cámara del Brujo
- `#/activities` — Actividades
- `#/account/characters` — Personajes

## 🧩 Responsabilidades por archivo (Consolidado v5)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/api-gw2.js` | v2.7.0-modular | API Layer con fetchWithRetry, cachés, WV, achievements, items |
| `js/wv-season-storage.js` | v1.1.1 | Almacenamiento por temporada (JSON por temporada en localStorage) |
| `js/wizards-vault.js` | v1.2.1 | WV: objetivos, tienda, integración con SeasonStore |
| `js/achievements.js` | v2.10.0 | Logros: aside, summary, nearly, categories, KPIs |
| `js/meta.js` | v3.2.1 | MetaEventos con horarios, estado "Hecho hoy" |
| `js/sidebar-nav.js` | v1.2 | Router‑friendly + tokenchange + a11y |
| `js/activities.js` | v3.9.0 | Actividades diarias/semanales: PSNA, fractales, world bosses, ecto, home nodes |
| `js/activities-theme.js` | v2.3.0 | Home Nodes: lista completa (74), filtros, estado ✅/❌, persistencia, fallback imágenes |
| `js/characters.js` | v2.2.2 | Personajes: lista, ubicación, POIs, rangos PvP/WvW |
| `js/router.js` | v2.10.0 | Router con prefetch, guardas, navegación por hash, mapeo de vistas |
| `js/wv-purchase-detail.js` | v1.8.4 | Detalle de compras, dashboard AA, top pendientes, nuevo estándar visual |
| `js/wv-tabs-skin.js` | v1.0.0 | Re-skin de tabs WV, consistente con rerenders |
| `js/app.js` | v2.6.3 | Keys, wallet, eventos globales, emisor `gn:tokenchange` |
| `js/*-theme.js` | varios | Glows, colores, estilos temáticos por módulo |

## ✅ NUEVO js/activities.js — Panel de Actividades (v3.9.0)

### Resumen

Panel que agrupa actividades diarias y semanales relevantes para el jugador: PSNA, fractales, world bosses, refinamiento de ecto, home nodes y objetivos semanales.

### ¿Qué hace?

**KPI strips (Diarias / Semanales)**
- Diarias: progreso clave (PSNA disponible, Ecto, Cuarzo de Heredad)
- Semanales: 2/2 (Llave del León Negro + Leivas n/5)

**PSNA (Pact Supply Network Agent)**
- Fuente externa JSON (assets/data/psna-schedule.json) con rotación de 8 días
- Copia de waypoints con feedback visual (toast, resaltado)
- "Acción crítica" con botón copiar del primer agente

**Fractales (hoy)**
- Datos de ejemplo (lista para conectar a API real)
- T4 (lista de nombres) + Recomendados (escalas)

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
- Llave del León Negro (toggle semanal con persistencia)
- Leivas: contador 0..5 con persistencia semanal
- Grid de 5 divisas con iconos, costes y tooltips

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

### Buenas prácticas específicas Activities

- No sobrescribir el nodo `.pill` completo con textContent; solo actualizar `.pill-text`
- Abort + last win en fetchers largos (PSNA, Fractales)
- Tooltips: siempre `data-tip` + title como fallback
- Fallbacks: PSNA con tabla rotativa local; thumbnails con emoji por tipo

### Home Nodes (específico)

- **Lista completa**: 74 elementos predefinidos (53 API + 6 Janthir + 15 contratos)
- **Estado vía API**: Solo los 53 nodos API consultan `/v2/account/home/nodes`
- **Filtros combinados**: Categoría + Tipo + Estado, con persistencia visual
- **Persistencia de recolección**: `gn_home_nodes_marked` con clave por día UTC
- **Fallback de imágenes**: URLs hardcodeadas desde gw2treasures para cuando la API falla
- **Checkbox "Recolectado hoy"**: Solo visible para nodos desbloqueados

## ✅ NUEVO js/characters.js — Panel de Personajes (v2.2.2)

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
| `/v2/files?ids=icon_*` | Iconos de profesión |
| `/v2/specializations/:id` | Iconos de especialidad |

## 🔄 Flujo de eventos recomendado

- UX cambia key → `KeyManager.setSelected()` → `gn:tokenchange`
- Router escucha → `prefetch` WV/Ach/Activities/Characters → render
- Activities: solo `render()` (no escucha key-change)
- Characters: escucha `gn:tokenchange` → recarga datos con caché
- WVSeasonStore: migración legacy en background

## 🧪 Checklists de Salud (v5)

### Orden de scripts (obligatorio)

- `api-gw2.js` (sin defer)
- `wv-season-storage.js` (sin defer)
- `wizards-vault.js` (sin defer)
- `achievements.js` (defer)
- `meta.js` (defer)
- `sidebar-nav.js` (defer)
- `activities.js` (defer)
- `characters.js` (defer)
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

### Purchase Detail

- Temporada actual correcta (selector)
- Timers cargando
- Íconos visibles
- AA necesaria ≠ 0 (si hay pins vivos)
- ✅ Nuevo: Sistema de colores unificado (verde/amarillo/rojo)
- ✅ Nuevo: Badges con efecto hover
- ✅ Nuevo: Skeleton loader animado
- ✅ Nuevo: Timestamp de última actualización
- ✅ Nuevo: Animación de entrada al abrir

### Activities

- KPI strips visibles (ambas pestañas)
- PSNA “Acción crítica” funcional
- Fractales (hoy) lista T4 + escalas Recommended
- World Bosses próximos
- Ecto con iconos oficiales
- Home Nodes:
  - ✅ Lista completa de 74 elementos (API + Janthir + Contratos)
  - ✅ Estado de desbloqueo vía API (✅/❌)
  - ✅ Filtros por categoría, tipo y estado
  - ✅ Tarjetas con doble icono (tipo + ítem destacado)
  - ✅ Checkbox "Recolectado hoy" con persistencia diaria
  - ✅ Contador de progreso de recolección
  - ✅ Fallback de imágenes desde gw2treasures

### Characters

- Lista de personajes visible
- Iconos de profesión oficiales (desde `/v2/files`)
- Iconos de especialidad (desde `/v2/specializations`)
- Rangos PvP/WvW en header
- Selector de POI con categorías
- Asignación persistente entre recargas
- Filtros funcionales
- Vista tarjetas/tabla
- Paginación

## 📌 Buenas prácticas actualizadas

### Globales

- Un único `gn:tokenchange`
- Prefetch + guardas + de-dupe
- No bloquear primer paint
- Lazy backfill

### Activities (específico)

- No usar innerHTML/textContent sobre el nodo `.pill` raíz
- Abort + last win en fetchers largos (PSNA, Fractales)
- Tooltips: siempre `data-tip` + title como fallback

### Characters (específico)

- Carga optimizada: batch processing, timeouts, retries
- Eventos personalizados para comunicación con UI
- Actualización selectiva de selects de POI (sin rerenderizar toda la lista)
- Historial de ubicaciones como fallback ante API que ya no devuelve `map_id`
- Caché de personajes con TTL para reducir llamadas a API

## 🧾 Historial de decisiones (v5)

- Q4 2025: eliminación listener Ach → router controla todo
- Q1 2026: watchdog Achievements (5s) + pipeline conservador
- Q1 2026: creación módulo Detalle de Compras
- Q1 2026: reskin tabs WV
- Q1 2026: catálogo lazy imágenes WV
- Q1 2026: Activities mayor refactor (v1.3.x → v3.9.0)
- Q1 2026: Characters módulo completo (v2.2.2)
- Q1 2026: rediseño visual completo Purchase Detail (v1.8.4) — nuevo estándar de UI
- **Q1 2026: Home Nodes rediseño completo (activities-theme.js v2.3.0) — lista completa de 74 elementos, filtros avanzados, estado en tiempo real**

## 🎉 Estado actual del proyecto (v5)

- ✅ Navegación estable y desacoplada
- ✅ Achievements sin doble pipeline (watchdog ok)
- ✅ WV robusta con datos unificados
- ✅ Purchase Detail v1.8.4 productivo: nuevo estándar visual (colores, badges, skeleton, animaciones)
- ✅ SeasonStore funcionando bien incluso con cuota mínima
- ✅ Activities v3.9.0 productivo: PSNA, fractales, world bosses, ecto, home nodes
- ✅ **Home Nodes v2.3.0 productivo: lista completa (74), filtros, estado ✅/❌, persistencia**
- ✅ Characters v2.2.2 productivo: personajes, POIs, rangos, ubicación

## 📦 Anexo de integración UI (CSS)

### Estilos para Characters
```css
/* Barra de carga de personajes */
.characters-loading {
  margin: 15px 0;
  padding: 10px;
  background: #1a1e2a;
  border-radius: 8px;
  text-align: center;
  color: #a0a0a6;
}

/* Contenedor de icono de profesión */
.prof-icon-container {
  position: relative;
  display: inline-block;
  width: 64px;
  height: 64px;
}

/* Fallback de icono */
.prof-fallback {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

/* Selector de POI con categorías */
.poi-select optgroup {
  font-weight: bold;
  color: #ffd966;
}

.poi-select optgroup option {
  font-weight: normal;
  color: #dfe3ea;
  padding-left: 12px;
}

/* Resumen de cuenta */
.account-summary {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: #1a1e2a;
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.account-summary > div {
  background: #111218;
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid #2a2c35;
}


---

## ✅ Resumen de cambios integrados

| Sección | Cambio |
|---------|--------|
| **Novedades v5** | Nueva entrada "Home Nodes — Rediseño completo (v2.3.0)" con todos los detalles |
| **Tabla responsabilidades** | `activities-theme.js` actualizado a v2.3.0 |
| **Persistencia** | Añadido `gn_home_nodes_marked` |
| **Checklist Activities** | Ampliado con 7 ítems de Home Nodes |
| **Buenas prácticas** | Nueva subsección "Home Nodes (específico)" |
| **Historial de decisiones** | Nueva entrada para Home Nodes rediseño |
| **Estado actual** | Actualizado con Home Nodes v2.3.0 |