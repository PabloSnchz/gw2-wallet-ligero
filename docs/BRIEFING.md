# 🐈‍⬛ Briefing para nuevo agente — Bóveda del Gato Negro

## Tu rol

Sos un desarrollador senior que trabaja dentro de las reglas del proyecto. No estás empezando de cero: el proyecto tiene **v6.5.0**, 40+ archivos, arquitectura modular IIFE vanilla JS, y reglas estrictas de CSS en 3 capas.

**Tu objetivo:** mantener compatibilidad, no romper nada, seguir la arquitectura existente, y proponer soluciones quirúrgicas (no reescribir archivos completos).

---

## Claves de metodología que funcionaron

### 1. Antes de tocar código, diagnosticar
- Si algo no funciona, **ejecutar tests en consola** antes de proponer cambios. Ej: `InventoryHub._debug()`, `ConverterModal._debug()`, `document.querySelector(...)`.
- Si hay un bug visual, **comparar con la versión que sí funciona** (ver diferencias en el DOM, CSS computado, clases).
- No proponer cambios sin entender la causa raíz.

### 2. Cambios quirúrgicos, no archivos completos
- Usar **bloques de buscar/reemplazar** precisos. Si un bloque no matchea, pedir el código real.
- No reescribir funciones enteras si con 3 líneas se arregla.
- Si el archivo es nuevo (ej: `converter-modal.js`), ahí sí se puede dar el código completo.

### 3. Respetar la arquitectura existente
- **CSS en 3 capas**: `main.css` (layout, sin bordes) → `theme-polish.css` (piel unificada) → `*-theme.js` (solo `borderLeft`). **Nunca usar `!important`** en temas.
- **Router-first**: `router.js` es el orquestador. Los módulos se activan/desactivan por ruta. No tocar DOM ajeno.
- **Un solo canal de cambio de cuenta**: `gn:tokenchange`.
- **Sin localStorage innecesario**. Ya hay cuota limitada. Preferir caché en memoria con TTL.

### 4. Documentar al final de cada sesión
- Actualizar `ONBOARDING.md`, `README.md`, `CHANGELOG.md` con lo nuevo.
- Siempre en bloques de buscar/reemplazar, sin reescribir el documento entero.

### 5. Commits frecuentes
- Al final de cada feature o fix, commit con mensaje descriptivo.
- Ramas con nombres claros: `feature/...`, `fix/...`.

---

## Prácticas que NO funcionaron (EVITAR)

### 1. Proponer cambios sin ver el código real
- Pasó varias veces: el agente sugería buscar/reemplazar bloques que no existían en el archivo porque estaba trabajando con una versión desactualizada o del onboarding.
- **Regla:** si el primer bloque no matchea, **pedir el código real**. No intentar 3 variantes del mismo bloque.

### 2. Bucles de "prueba y error"
- En el fix de paginación del Banco en Inventory Hub, se hicieron 5-6 iteraciones de cambios sin diagnosticar. El problema era una llave extra de un cambio anterior.
- **Regla:** si un cambio no funciona a la primera, **diagnosticar en consola** antes de proponer otro cambio. No entrar en modo "prueba y error".

### 3. Confiar en que el código del onboarding es exactamente igual al real
- El onboarding tiene snippets de código que pueden estar desactualizados. Usarlo como referencia, pero siempre verificar contra el archivo real antes de proponer cambios.

### 4. Cambiar clases CSS sin entender el impacto
- Se agregó `class="card"` a las KPI cards del Purchase Detail pensando que heredarían el estilo unificado. Pero `.card` tiene `min-height: 126px` y eso rompió la altura compacta.
- **Regla:** antes de agregar una clase del sistema de diseño, revisar qué estilos trae (padding, min-height, border, box-shadow).

### 5. Intentar features imposibles con los datos disponibles
- La tab "Novedades de Gem Store" no se puede hacer sin un backend que scrapee ThatShaman o los archivos del juego. Se intentó 4 enfoques distintos antes de aceptarlo.
- **Regla:** si una API no devuelve los datos necesarios, no insistir. Buscar alternativas realistas o descartar la feature.

---

## Estado actual del proyecto (v6.5.0)

| Módulo | Estado |
|--------|--------|
| Cartera (Wallet) | ✅ Estable |
| Meta & Eventos | ✅ Estable |
| Logros | ✅ Estable |
| Cámara del Brujo (WV) | ✅ Estable |
| Actividades | ✅ Estable |
| Inventario y Personajes | ✅ Buscador unificado, skeleton loader, filtros de peso en Armería |
| Personajes | ✅ Subvista con botón "Volver al Inventario" |
| Conversor (Modal) | ✅ 3 tabs: Cambio, Transacciones, Populares |
| Dashboard Cartera | ✅ Estable |
| Raid Tracker | ✅ Estable |
| Panel de Cuentas | ✅ Estable |
| Bienvenida | ✅ Estable |
| Purchase Detail | ✅ KPI cards compactas, tabla sin scroll |
| Gist Sync | ✅ Estable |
| Settings Manager | ✅ Estable |

---

## Archivos clave

| Archivo | Versión | Notas |
|---------|---------|-------|
| `api-gw2.js` | v2.15.0 | Cache con cap de 500 items, commerce endpoints |
| `router.js` | v2.16.0 | Sidebar sin conversor, soporta InventoryHub |
| `converter-modal.js` | v1.0.0 | Modal con 3 tabs + placeholder Historial |
| `inventory-hub.js` | v1.3.2 | Skeleton loader, búsqueda en banco, filtros peso |
| `wallet-theme.js` | v1.3.1 | Glow neutro para divisas sin color |
| `app.js` | v2.7.0 | Conversor extraído |
| `index.html` | — | Sidebar sin conversor, botón PD simplificado |

---

## Si algo no se entiende

Preguntar. Es mejor frenar 2 minutos a aclarar que pasar 20 minutos probando cambios que no funcionan. El dueño del proyecto prefiere explicar el contexto antes que recibir código roto.