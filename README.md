# 🐈‍⬛ Bóveda del Gato Negro — GW2 Wallet & MetaEventos

Aplicación liviana para Guild Wars 2 que permite consultar:

- 🪙 Wallet / Divisas de la cuenta
- 🎭 MetaEventos con horarios, estado y “Hecho hoy”
- 🪄 Cámara del Brujo Wizard’s Vault (Objetivos y Tienda)
- 🏆 Pantalla de Logros — Nueva vista completa
- 💱 Conversor Gem ↔ Gold
- 🏡 Home Nodes — Todos los desbloqueables de Heredad con estado ✅/❌
- 🔐 Gestión completa de API Keys
- ⭐ Favoritas, filtros avanzados, vista tarjetas/tabla

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## 🔧 Conversor Gem ↔ Gold — v2.0

- Quick‑chips: Gemas (100/400/800/1200) y Oro (10/100/250)
- Micro‑animaciones (`.updated`) en badges, output y barra
- Halo dorado reforzado; estado “Actualizado.” en pill
- Barra de conveniencia (ref 400) con sombras por estado

---

## 🪄 Cámara del Brujo (WV) — Pastillas PvE/PvP/WvW

Definí en `index.html` (antes de router.js):

```html
<script>
  window.WV_MODE_ICONS = {
    pve: 'https://wiki-es.guildwars2.com/images/5/51/C%C3%A1mara_del_Brujo_PvE.png', 
    pvp: 'https://wiki-es.guildwars2.com/images/3/31/C%C3%A1mara_del_Brujo_PvP.png',
    wvw: 'https://wiki-es.guildwars2.com/images/a/a3/C%C3%A1mara_del_Brujo_WvW.png'
  };
</script>
```

---

## ✨ Novedades principales — v5.0.0

### 🏡 Home Nodes — Rediseño completo
- **Lista completa**: 74 elementos de Heredad (53 nodos API + 6 Janthir + 15 contratos/consumibles)
- **Estado en tiempo real**: ✅ Desbloqueado / ❌ No desbloqueado vía API `/v2/account/home/nodes`
- **Filtros avanzados**: por categoría (API/Janthir/Contratos), tipo (minería/madera/cosecha) y estado
- **Tarjetas rediseñadas**: icono de tipo con glow + imagen de ítem destacada (64px)
- **Persistencia diaria**: checkbox "Recolectado hoy" con localStorage

### 💎 Purchase Detail — Estándar visual
- **Sistema de colores unificado**: 🟢 verde (disponible), 🟡 amarillo (necesidad), 🟢/🔴 rojo (delta)
- **Badges con efecto hover** (scale + brightness)
- **KPIs con glow** y borde lateral según estado
- **Skeleton loader** animado durante carga
- **Animación de entrada** (fade-in + scale) y timestamp de última actualización

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

### 🎭 Meta & Eventos
- MetaEventos reescrito con HTML real, íconos funcionales, enlaces Wiki y Mapa corregidos
- Estado “Hecho hoy” con cache por token (TTL 5 min), fuente API y auto-refresh al reset diario UTC
- Top‑3 Próximos en sidebar, favoritos (máx 6), modos Deluxe y Compacto

### 🏆 Logros
- Pantalla completa con barras de progreso por categoría
- Filtros por PvE / PvP / WvW
- Colores de rareza y estado

### 🎨 UI/Accesibilidad
- Botones con aria-pressed, aria-current, roles y tooltips coherentes
- Control de foco y focus trap en el modal de API Keys
- Limpieza de entidades HTML escapadas donde no corresponden

---

## 📦 Archivos clave

| Archivo | Versión | Responsabilidad |
|---------|---------|-----------------|
| `js/activities-theme.js` | v2.3.0 | Home Nodes: lista completa (74), filtros, estado ✅/❌ |
| `js/wv-purchase-detail.js` | v1.8.4 | Estándar visual de referencia |
| `js/wallet-theme.js` | v1.3.0 | Badges canónicos + glows preservados |
| `js/meta-theme.js` | v1.1.0 | Badges canónicos + extensión visual |
| `css/theme-polish.css` | v2.0.0 | Componentes canónicos unificados |

---

## 🧪 Cómo probar las novedades

1. **Home Nodes**: Navegar a **Actividades** → sección "Home nodes"
2. **Purchase Detail**: Navegar a **Cámara del Brujo** → botón de detalle de compras
3. **Wallet**: Verificar que las categorías son badges y los glows especiales se mantienen
4. **Meta & Eventos**: Verificar badges de estado (activo/soon/later) unificados

---

## 📌 Notas técnicas

- **API Key**: Requiere permisos `account` y `wallet`
- **LocalStorage** utilizado para:
  - Favoritos / Pins
  - Flags "Hecho hoy"
  - Marcas WV
  - API Keys
  - Token seleccionado
  - `gn_home_nodes_marked` (persistencia diaria de recolección)

---

## 📦 Versionado

Este proyecto sigue **Semantic Versioning** (SemVer).

- `v5.0.0`: **Estándar Visual Unificado** — Home Nodes rediseño completo, Purchase Detail v1.8.4, unificación de badges/pills/KPIs, documentación actualizada
- `v4.0.0`: Cámara del Brujo (Wizard’s Vault) — Módulo completo, Pantalla de Logros — Nueva vista completa
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
