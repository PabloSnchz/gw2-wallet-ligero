# 📜 Changelog
Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato sigue las recomendaciones de  
**Keep a Changelog** (https://keepachangelog.com/)  
y el versionado **SemVer** (https://semver.org/).

## [4.0.0] – 2026-02-27
Nuevo módulo completo: Cámara del Brujo (Wizard’s Vault)

Objetivos Diarios / Semanales / Especiales.
Progreso de Meta global de temporada.
Aclamación Astral: disponible, gastado API, reservado (marcas locales).
Tienda WV con vista tarjetas/tabla, filtros, buscador, stock y contadores ± persistentes.
Toolbar PvE / PvP / WvW.
Manejo de permisos y fallback en caso de tokens sin wizardsvault.
Integración con endpoints oficiales:

/v2/wizardsvault/seasons
/v2/account/wizardsvault/categories
/v2/account/wizardsvault/listings

Nuevo módulo completo: Pantalla de Logros (Achievements)

Vista dedicada en #/account/achievements.
Barra de progreso por objetivo.
Filtros PvE / PvP / WvW.
Rareza, progreso numérico y porcentaje.
Integración con /v2/account/achievements y /v2/achievements.
Estilo oscuro, limpio y consistente con el resto del panel.



Selects (Meta & Eventos / Wallet): tema oscuro real, sin caret, menú desplegable dark, una sola pastilla (chip).


Chips sólidos: hover/focus/pressed/checked consistentes y accesibles.


Toggles inyectados (sin tocar index.html):

data-meta-deluxe="on|off"
data-meta-compact="on|off"


Integración total con:

Hecho hoy (API): /v2/account/worldbosses, /v2/account/mapchests.
Hecho hoy (Manual): por id/token/día UTC (localStorage), reset automático 00:00 UTC.
Cache de flags (TTL 5′), refresh manual.


Nuevo sistema de iconografía en el sidebar:

Reemplazo de emojis → íconos reales (Wiki e íconos GW2).
Preparado para repositorio propio de imágenes.

Cambiado

Refinamiento visual de tarjetas y filtros, sin romper la estructura previa.
Ordenación por favoritos, estado (activo → próximo → más tarde) y proximidad.
Router actualizado: navegación por hash y emisión correcta de gn:tabchange para inicialización del módulo MetaEventos.
Correcta separación de asides según vista (Wallet / MetaEventos / Logros / WV).

Corregido

Selects que se veían con fondo blanco / texto claro (ilegible) en algunos navegadores.
Flechita (caret) que se superponía en los chips de filtros.
Error crítico: MetaEventos no iniciaba debido a cambio en la navegación → solucionado.
Tooltips de infusiones: fix de pop is not defined, escopo correcto y createElement('img') sin CORS.
Render de íconos: iconTag() / wpIcon() ahora devuelven <img> reales.
Corrección de enlaces Wiki/Mapa (se mostraban como texto).



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

## [2.5.0] – 2026-01-xx
### Agregado
- Base del panel MetaEventos (v2.x) y Cartera (Wallet).
- Gestión de API Keys en UI.
- Filtros iniciales (tipo/expansión/activos/próximos/infusiones).

---

## Sin publicar (HEAD)
- _Nada por ahora._

---

### Notas
- Si necesitás invalidar cache, podés incrementar el query `?v=` en `index.html` para `js/meta.js` y/o `assets`.
- Para eventos nuevos, preferí `worldBossId` oficiales (`/v2/worldbosses`) y `mapchestId` documentados (`/v2/mapchests`); usa `manualecho hoy”.


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

## v2.6.0 — 2026-02-24
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
## [v2.3.3] — 2026‑02‑21
### Added
- Glow rojo en tabs del hero (match visual con API Keys).
- Iconos de redes con color de marca (Discord, Instagram, YouTube) + icono de Twitch.
- Mejora visual general (brillo sutil en tarjetas y botones).

### Changed
- Conversor final estable (lógica con búsqueda binaria, sin auto‑update).
- Íconos de divisas a 22px.
- Limpieza visual: fix-pack integrado en `main.css`.

### Fixed
- Render robusto de íconos en tarjetas y tabla (siempre `<img>`).
- Eliminar error `ReferenceError: renderCards is not defined`.
- Alineado de orden/alcance de funciones de render.

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
