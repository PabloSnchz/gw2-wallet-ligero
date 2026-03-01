# 🐈‍⬛ Bóveda del Gato Negro — GW2 Wallet & MetaEventos

Aplicación liviana para **Guild Wars 2** que permite consultar:

- 🪙 **Wallet / Divisas** de la cuenta  
- 🎭 **MetaEventos** con horarios, estado y “Hecho hoy”  
- 🪄 **Cámara del Brujo** Wizard’s Vault  (Obejtivos y Tienda)
- 🏆 **Pantalla de Logros** — Nueva vista completa  
- 💱 **Conversor Gem ↔ Gold**  
- 🔐 **Gestión completa de API Keys**  
- ⭐ **Favoritas, filtros avanzados, vista tarjetas/tabla**  

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## ✨ Novedades principales — v5.0.0

Refactor — Cámara del Brujo (WV)

Router robusto con marcado de nav confiable y sidebar contextual correcto al entrar en WV, incluso viniendo desde otros paneles.
Manejo defensivo con try/finally: aunque falle WV internamente, la pastilla y el sidebar se actualizan igual.
Refuerzo de navegación con hashchange + reaplicación tardía (setTimeout(…, 0)/rAF) para ganarle a carreras de pintado.
Estructura de WV (objetivos + shop) consolidada, con auto-refresh de tienda, toolbar y persistencias por cuenta.

Wallet — Rework de tarjetas

Reemplazo de estrella por 📌 pin con persistencia por cuenta (LS_WALLET_PINS) y migración automática desde favoritos legacy (LS_FAVS → pins).
Tarjetas unificadas con estética “WV”: nuevo grid wallet-card-grid, jerarquía visual, badges, pills de categorías y fijadas primero.
Vista compacta (toggle) persistente por cuenta: más densidad, 1 línea en título, oculta descripción.
Delta de cantidades (↑/↓) contra un snapshot local por cuenta (LS_WALLET_SNAPSHOT), con pill verde/roja; en tabla se muestra también ±0 (opcional ocultarlo por CSS).
Toolbar enriquecida: “Vista compacta” + “Actualizar base”.

UI/Accesibilidad

Botones con aria-pressed, aria-current, roles y tooltips coherentes.
Control de foco y focus trap en el modal de API Keys.
Limpieza de entidades HTML escapadas donde no corresponden en JS (evita errores de sintaxis y parseo).


Correcciones críticas

Bug de Sidebar (persistencia visual): ahora, al navegar a WV, se actualiza pastilla y contenido de sidebar (se ocultan los bloques de Meta/otros).
Rutas normalizadas con location.hash y fallback: #/cards, #/meta, #/account/achievements, #/account/wizards-vault.

## ✨ Novedades principales — v4.0.0


🆕 Módulos nuevos
🪄 Cámara del Brujo (Wizard’s Vault) — Módulo completo
Incluye:

Objetivos Diarios / Semanales / Especiales
Barra de progreso global (meta de temporada)
Indicación de Aclamación Astral disponible y gastada
Tienda de WV con:

Vista tarjetas/tabla
Filtros por categoría, tipo, stock, moneda
Contadores incrementales (±) con persistencia


Manejo avanzado de límites API:

purchased, purchase_limit, restante, “marcas” locales


Toolbar inteligente (PvE / PvP / WvW)
Manejo robusto de permisos (token sin permisos → mensaje claro)


Es un módulo “full”, equivalente al panel oficial de WV pero liviano y sin backend.


🏆 Pantalla de Logros — Nueva vista completa
Incluye:

Sección Objetivos con barras de progreso por categoría
Filtros por PvE / PvP / WvW
Cálculo visual del avance (current / complete)
Colores de rareza y estado
Sincronización con progression cuando la API lo permite
Vista limpia, en panel propio (#/account/achievements)


Se integra con la sidebar y respeta el nuevo estilo oscuro y compacto.


🔧 Mejoras estructurales y técnicas (MetaEventos + Core)
✔ MetaEventos reescrito con HTML real

Plantillas limpias: sin caracteres escapados (&lt;, &gt;).
Íconos funcionales (waypoint, infusiones, drops, top‑3).
Enlaces Wiki y Mapa corregidos (marcados como <a> reales).
Tooltips visuales de infusiones con <img>.

✔ Router corregido

#/meta ahora dispara correctamente gn:tabchange, garantizando inicialización del módulo sin depender de tabs antiguos.

✔ Estado “Hecho hoy” (robusto + rápido)

Cache por token (TTL 5 min)
Fuente API: worldbosses + mapchests
Manual check cuando corresponde
Auto-refresh al reset diario UTC

✔ UX general

Top‑3 Próximos en sidebar
Favoritos (máx 6)
Modos: Deluxe y Compacto
Animaciones rápidas en tooltips y horarios
Sidebar modernizado con íconos GW2 reales

✔ Mejoras globales

runIconChecks() ya no interfiere con MetaEventos
Toasts unificados ($toast): éxito, info, error
Previews de infusiones sin CORS
Elementos DOM creados correctamente vía JavaScript (no HTML mezclado)


📌 Pequeñas notas de compatibilidad

Algunos IDs de items pueden devolver 404 desde la API oficial (item retirado).
El módulo lo maneja correctamente sin romper la vista.
LocalStorage usado para:

favoritos
flags hechos-hoy
marcas WV
API Keys
token seleccionado

---

## Versionado
Este proyecto sigue **Semantic Versioning** (SemVer).

- `v5.0.0`: Refactor — Cámara del Brujo (WV) — Wallet — Rework de tarjetas — UI/Accesibilidad — Correcciones críticas
- `v4.0.0`: Cámara del Brujo (Wizard’s Vault) — Módulo completo, Pantalla de Logros — Nueva vista completa
- `v3.0.0`: MetaEventos Deluxe (este release).
- `v2.6.2`: Base estable previa a Deluxe (fixes varios + compatibilidad con manual check).

Ver CHANGELOG.md para detalles.

---

## Contribuir
1. Rama feature: `feature/<nombre>`
2. Commit convencional:  
   - `feat(meta): …`  
   - `fix(ui): …`  
   - `chore(css): …`
3. PR con descripción, capturas (si UI), checklist QA.
4. Review y **squash merge** o **merge commit** según política.

---

## Licencia
© Comunidad Gato Negro. Uso interno / comunitario. Contacto por Discord para acuerdos de distribución o forks.
