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

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## ✨ Novedades principales — v5.3.0

### 🖼️ Migración completa a íconos locales
- **Profesiones**: Todos los íconos de profesión ahora son locales (`assets/icons/professions/2163502.png` a `2163510.png`)
- **Fractales**: Ícono genérico local (`assets/icons/Fractal/2591.png`) para todas las tarjetas
- **Conversor**: SVG reemplazados por imágenes locales (gemas y oro)
- **Countdowns WV**: Íconos de reset diario, semanal y temporada locales (`523379.png`, `523380.png`, `523381.png`)
- **Títulos de paneles**: Todos los módulos tienen su ícono correspondiente en el título
- **Rutas assets**: Eliminada barra inicial `/` para compatibilidad con GitHub Pages

### 🎨 Títulos de paneles con íconos
| Módulo | Ícono |
|--------|-------|
| Cartera | `assets/icons/733322.png` |
| Meta & Eventos | `assets/icons/102420.png` |
| Logros | `assets/icons/155059.png` |
| Cámara del Brujo | `assets/icons/3172791.png` |
| Actividades | `assets/icons/1302773.png` |
| Personajes | `assets/icons/156678.png` |

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

### 💎 Purchase Detail — Estándar visual (v1.8.6)
- **Sistema de colores unificado**: 🟢 verde (disponible), 🟡 amarillo (necesidad), 🟢/🔴 rojo (delta)
- **Íconos countdowns locales**: reset diario (523379), semanal (523380), temporada (523381)
- **Badges con efecto hover** (scale + brightness)
- **KPIs con glow** y borde lateral según estado
- **Skeleton loader** animado durante carga
- **Animación de entrada** (fade-in + scale) y timestamp de última actualización

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
    pve: '/assets/icons/3240357.png',
    pvp: '/assets/icons/3240358.png',
    wvw: '/assets/icons/3240359.png'
  };
</script>
```

---

## 📦 Archivos clave (v5.3.0)

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/activities.js` | v3.19.0 | Actividades diarias/semanales. **Íconos fractales locales** |
| `js/activities-theme.js` | v2.5.0 | Home Nodes + barra de horarios unificada con iconos GW2 |
| `js/characters.js` | v2.3.0 | Panel de Personajes. **Íconos profesión locales** |
| `js/meta-theme.js` | v1.3.1 | Barra de horarios unificada + mejora de horarios en tarjetas |
| `js/wv-purchase-detail.js` | v1.8.6 | Detalle de compras, **íconos countdowns locales** |
| `js/wallet-theme.js` | v1.3.0 | Badges canónicos + glows preservados |
| `js/router.js` | v2.10.4 | Router con prefetch, guardas, navegación por hash |
| `css/theme-polish.css` | v2.0.0 | Componentes canónicos unificados |

---

## 🖼️ Assets locales (estructura v5.3.0)

```
assets/icons/
├── 3594051.png          # Cámara del Brujo (banner/button)
├── 733322.png           # Cartera
├── 102420.png           # Meta & Eventos
├── 155059.png           # Logros
├── 3172791.png          # Cámara del Brujo (título)
├── 1302773.png          # Actividades
├── 156678.png           # Personajes
├── 523379.png           # Reset diario
├── 523380.png           # Reset semanal
├── 523381.png           # Reset temporada
├── 3240357.png          # WV PvE
├── 3240358.png          # WV PvP
├── 3240359.png          # WV WvW
├── gems-icon.png        # Conversor (gemas)
├── gold-icon.png        # Conversor (oro)
├── Fractal/
│   └── 2591.png         # Ícono genérico fractales
├── professions/
│   ├── 2163502.png      # Elementalist
│   ├── 2163503.png      # Engineer
│   ├── 2163504.png      # Guardian
│   ├── 2163505.png      # Mesmer
│   ├── 2163506.png      # Necromancer
│   ├── 2163507.png      # Ranger
│   ├── 2163508.png      # Revenant
│   ├── 2163509.png      # Thief
│   └── 2163510.png      # Warrior
└── ui/
    ├── utc-icon.png
    ├── local-icon.png
    ├── daily-reset.png
    ├── weekly-reset.png
    └── waypoint.png
```

---

## 🧪 Cómo probar las novedades

1. **Barra de horarios**: Navegar a **Actividades** o **Meta & Eventos** → ver barra con iconos GW2 y resets con segundos
2. **Home Nodes**: Navegar a **Actividades** → sección "Home nodes"
3. **Personajes**: Navegar a **Personajes** → ver lista, filtros, asignación de POIs
4. **Íconos de profesión**: Verificar que se cargan desde `assets/icons/professions/`
5. **Íconos de fractales**: Verificar que todas las tarjetas de fractales usan `2591.png`
6. **Títulos de paneles**: Verificar que cada panel tiene su ícono correspondiente
7. **Horarios en Meta**: Abrir horarios de una tarjeta → verificar hora local, color del botón y próximo horario resaltado
8. **Purchase Detail**: Navegar a **Cámara del Brujo** → botón de detalle de compras → verificar íconos de countdowns locales
9. **Wallet**: Verificar que las categorías son badges y los glows especiales se mantienen
10. **Conversor**: Verificar que los íconos de gemas y oro son locales

---

## 📌 Notas técnicas

- **API Key**: Requiere permisos `account` y `wallet`
- **Rutas assets**: Todas son relativas (`assets/...`) sin barra inicial para compatibilidad con GitHub Pages
- **LocalStorage** utilizado para:
  - Favoritos / Pins
  - Flags "Hecho hoy"
  - Marcas WV
  - API Keys
  - Token seleccionado
  - `gn_home_nodes_marked` (persistencia diaria de recolección)
  - `characters:assignments` (POIs por personaje)
  - `wvpd_icon_url` (ícono de Purchase Detail)

---

## 📦 Versionado

Este proyecto sigue **Semantic Versioning** (SemVer).

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