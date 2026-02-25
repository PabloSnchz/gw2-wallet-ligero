# 📜 Changelog
Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato sigue las recomendaciones de  
**Keep a Changelog** (https://keepachangelog.com/)  
y el versionado **SemVer** (https://semver.org/).

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
