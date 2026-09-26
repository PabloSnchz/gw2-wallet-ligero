# 📋 Backlog — Bóveda del Gato Negro

> Última actualización: 2026-09-24
> Estado actual: v6.6.2 + Unreleased (commits `c293567`, `b2b9038`, `096e82f`, `dba2f9e`)

---

## ✅ Completado

| Item | Commit | Fecha |
|------|--------|-------|
| Migración `wallet-dashboard.js` inline→CSS | `c293567` | 2026-09-24 |
| Migración `inventory-dashboard.js` (7 cambios clave) | `c293567` | 2026-09-24 |
| Nuevas clases `.wd-*` / `.id-*` en `theme-polish.css` v2.2.0 | `c293567` | 2026-09-24 |
| Corrección visual KPI cards (glow, overflow, layout 3 filas) | `c293567` | 2026-09-24 |
| Eliminación de backups `.backup_kpi_css/` y `.backup_id_kpi_css/` | `c293567` | 2026-09-24 |
| Skill `migrar-estilos-inline` creada y documentada | — | 2026-09-24 |
| Corrección de violaciones arquitectura CSS en 4 archivos `*-theme.js` | `096e82f` | 2026-09-24 |
| Actualización de documentación (CHANGELOG, README, BRIEFING, ONBOARDING) | `b2b9038` | 2026-09-24 |
| Creación de `BACKLOG.md` | `dba2f9e` | 2026-09-24 |

---

## ❌ Descartado (alto riesgo / bajo valor)

| Item | Razón | Decisión |
|------|-------|----------|
| **Fase 2 de migración `inventory-dashboard.js`** (~28 estilos inline restantes) | ~8 son dinámicos (display:none toggle, colores, animation) → migrarlos a CSS estático rompería funcionalidad. ~15 son layout (display:flex, gap, padding) → granularidad absurda si se pasan a CSS genérico. Los 7 severos ya se migraron. | ❌ No valen la pena. El inline es el lugar correcto para estilos dinámicos. |
| **Migración de estilos inline en módulos no-theme** (accounts-panel, activities, converter-modal, inventory-hub, meta, raid-tracker, strike-tracker, router) | Los colores son dinámicos (rareza, tipo de cuenta, balance, tema) → no pueden ir a CSS estático. Los estilos son legítimos en inline. | ❌ No valen la pena. |

---

## 🔮 Mejoras futuras (bajo impacto, sin prisa)

| Item | Prioridad | Comentario |
|------|-----------|------------|
| **Consolidar `gist-sync.js`** (contraseña fija de seguridad) | Baja | Hallazgo transversal #7 del AGENTS.md. No crítico, requiere refactor de autenticación. |
| **Verificar dependencias externas** (`CryptoJS`, `XLSX`, `gtag`) | Baja | Hallazgo transversal #8. Revisar que estén actualizadas y no haya vulnerabilidades. |
| **Centralizar eventos CustomEvent** | Baja | Hallazgo transversal #9. Documentar en una tabla en `ONBOARDING.md`. |
| **Refactor de código duplicado** (`getAccountIcon`, `formatCoinValue`, `esc`, `$`, `$$`) | Baja | Hallazgo transversal #4. Requiere análisis de impacto en cada módulo. |

---

## 🟢 En progreso (sin bloqueo)

| Item | Estado |
|------|--------|
| *(Ninguno)* | — |

---

## 📊 Estado de la arquitectura CSS de 3 capas

| Capa | Archivo | Cumplimiento |
|------|---------|--------------|
| Layout | `main.css` | ✅ Sin bordes ni box-shadows |
| Piel unificada | `theme-polish.css` | ✅ Bordes neutros, glow base, hover unificado, clases `.wd-*` / `.id-*` |
| Color semántico | `*-theme.js` (8 archivos) | ✅ Solo `borderLeft`. Cero violaciones de `border`, `boxShadow`, `borderRadius`, `transition`. |

---

## 🔍 Hallazgos del análisis profundo (2026-09-24)

### 🟠 ALTA prioridad — Seguridad

| # | Hallazgo | Archivo(s) | Detalle | Acción sugerida |
|---|----------|------------|---------|-----------------|
| S1 | **Contraseña fija en `gist-sync.js`** | `js/gist-sync.js:40,49` | `fixedSalt` hardcodeado para cifrar/descifrar tokens de GitHub Gist. Cualquiera que tenga el código fuente puede descifrar. | Reemplazar por sal aleatoria por key, o usar Web Crypto API con derive key desde contraseña del usuario. |
| S2 | **`!important` en estilos inline** | `js/inventory-hub.js:1319-1323`, `js/wv-purchase-detail.js:74,335-343`, `js/wv-shop-ui.js:187`, `js/wv-tabs-skin.js:50-59` | Se inyectan estilos CSS con `!important` via `<style>` blocks. Rompen la capa de `theme-polish.css` y la receta visual unificada. | Mover estos estilos a `theme-polish.css` sin `!important` y usar especificidad para ganar. |

### 🟡 MEDIA prioridad — Arquitectura / Mantenibilidad

| # | Hallazgo | Archivo(s) | Detalle | Acción sugerida |
|---|----------|------------|---------|-----------------|
| M1 | **`localStorage` disperso sin estándar de prefijos** | `js/accounts-panel.js`, `js/activities.js`, `js/app.js`, `js/characters.js`, `js/api-gw2.js`, `js/wv-season-storage.js` | Se usan claves como `gw2_keys`, `gn_activities_toggles`, `gn_home_nodes_marked`, `LS_WALLET_PINS`, `LS_CURR`, `LS_KEYS`, `LS_SELECTED_KEY`, `LS_FAVS`, `psna:`, `ach_`, `ach:`. Sin convención centralizada. | Crear un módulo `storage-keys.js` (IIFE) que exponga `STORAGE_KEYS` con todos los prefijos estandarizados. Reemplazar las strings hardcodeadas. |
| M2 | **Dependencias externas sin verificación de versión** | `js/accounts-panel.js` (CryptoJS, XLSX), `js/analytics.js` (gtag) | Se usan sin checks de versión ni integrity. `CryptoJS` es legacy (recomendado Web Crypto API nativa). `XLSX` solo se usa en `accounts-panel.js` para exportar/importar templates. | Verificar que estén actualizadas. Para `CryptoJS`, migrar a `crypto.subtle` (disponible en todos los browsers modernos). Para `XLSX`, evaluar si se puede reemplazar por CSV simple. |
| M3 | **`gist-sync.js` mezcla concerns** | `js/gist-sync.js` | 363 líneas. Mezcla cifrado, fetch a GitHub API, import/export de settings, y lógica de UI. DRY violation con `settings-manager.js`. | Extraer lógica de cifrado a un módulo separado. Dejar `gist-sync.js` como orquestador solo. |
| M4 | **Código duplicado: `formatCoinValue`** | `js/wallet-dashboard.js`, `js/converter-modal.js` (probablemente) | La función de formateo de monedas (copper/silver/gold) aparece en múltiples lugares. | Consolidar en `api-gw2.js` o un módulo `utils.js` y exportar por `window`. |
| M5 | **Código duplicado: `esc` y `$` / `$$`** | Varios módulos | Funciones de escape de HTML y querySelector wrapper se reimplementan en cada archivo. | Crear `utils.js` con `esc()`, `$(sel)`, `$$(sel)` y exportar por `window`. Reemplazar en cada módulo. |
| M6 | **Eventos CustomEvent sin documentación centralizada** | Varios módulos | `gn:tokenchange`, `gn:settings:updated`, etc. No hay tabla de referencia. | Agregar sección en `docs/ONBOARDING.md` con todos los CustomEvents, su payload y quién los escucha. |

### 🟢 BAJA prioridad — Limpieza técnica

| # | Hallazgo | Archivo(s) | Detalle | Acción sugerida |
|---|----------|------------|---------|-----------------|
| B1 | **Código muerto / dead code** | Varios | Funciones definidas pero no usadas, o referencias a módulos que ya no existen. | Ejecutar `npm audit` o usar coverage tools para identificar. No crítico. |
| B2 | **`analytics.js` con cola de eventos** | `js/analytics.js` | Si `gtag` no está cargado, guarda eventos en cola. Pero no hay timeout ni límite. Podría crecer indefinidamente. | Agregar límite de cola (ej: 100 eventos) y timeout de descarte. |
| B3 | **`activities.js` limpieza de localStorage con `startsWith`** | `js/activities.js:489-516` | Itera todo `localStorage` buscando keys con `startsWith('ach_')` o `startsWith('ach:')`. Podría borrar datos de otras apps si comparte dominio. | Reemplazar por lista explícita de keys a limpiar, no por patrón. |
| B4 | **Sin tests automatizados** | — | Proyecto es 100% vanilla JS sin framework de testing. | No es crítico para un frontend, pero se recomienda añadir Jest + jsdom cuando sea posible. |

### 📊 Resumen de prioridades

| Prioridad | Cantidad | ¿Acción inmediata? |
|-----------|----------|---------------------|
| 🔴 Alta (Seguridad) | 2 | ✅ Sí — `gist-sync.js` y `!important` en CSS |
| 🟡 Media (Arquitectura) | 6 | ⚠️ Planificable — requiere refactor |
| 🟢 Baja (Limpieza) | 4 | ❌ Sin prisa |

---

## 📝 Notas

- Este backlog es vivo. Agregar items cuando surjan problemas o mejoras identificadas.
- Prioridad: **Alta** = rompe funcionalidad o seguridad. **Media** = mejora mantenibilidad. **Baja** = limpieza técnica.
- Los items descartados pueden revivir si cambian las circunstancias (ej: si se añade un backend que permita estilos dinámicos vía CSS variables).

---

## 🎯 Detectadas por PO (Pablo) — Análisis UX del flujo de agregar API Key

> **Fecha:** 2026-09-25
> **Análisis completo:** Ver MEMORY.md del PO
> **Fricciones detectadas:** F1-F8 | **Propuestas:** 1-9

### 🔴 Fricciones Críticas

| # | Fricción | Archivo(s) | Detalle | Propuesta asociada |
|---|----------|------------|---------|-------------------|
| F1 | **Sin feedback de carga en botón "Guardar"** | `js/app.js` ~870 | El botón no cambia mientras `API.tokenInfo()` y `loadAllForToken()` tardan 2-5s. Solo hay `setStatus('Validando API key…')` en texto pequeño. | 🟢 Propuesta 1 |
| F2 | **Sin focus automático tras éxito** | `js/app.js` ~878 | Los campos se limpian pero el focus queda en el botón. Para 27 keys, suma 27 clicks extra. | 🟢 Propuesta 2 |

### 🟡 Fricciones Medias

| # | Fricción | Archivo(s) | Detalle | Propuesta asociada |
|---|----------|------------|---------|-------------------|
| F3 | **Modal no se cierra automáticamente** | `js/app.js` ~878 | Correcto para múltiples keys, pero el usuario debe recordar cerrarlo al terminar. | — (comportamiento correcto) |
| F4 | **Sin validación local de formato** | `js/app.js` ~872 | Se envía la key a la API sin validación previa. Fetchs innecesarios para keys inválidas. | 🟢 Propuesta 3 |

### 🟢 Fricciones Bajas

| # | Fricción | Archivo(s) | Detalle | Propuesta asociada |
|---|----------|------------|---------|-------------------|
| F5 | **Toast de éxito muy corto** | `js/app.js` ~705 | 1400ms. Puede desaparecer antes de que el usuario lo lea. | — |
| F6 | **Sin feedback de "Actualizando" vs "Agregando"** | `js/app.js` ~705 | El toast dice "Key guardada" en ambos casos. | 🟡 Propuesta 5 |
| F7 | ** Mensaje de error genérico** | `js/app.js` ~883 | "La API key no es válida" no dice por qué. | 🟢 Propuesta 8 |
| F8 | **`loadAllForToken()` sin feedback visible** | `js/app.js` ~700 | Carga wallet + currencies (1-2s) sin indicador claro. | 🟢 Propuesta 9 |

### 🟢 Propuestas Fáciles (implementar ya)

| # | Propuesta | Dificultad | Beneficio |
|---|-----------|------------|-----------|
| 1 | **Loading state en botón "Guardar"** | 🟢 Fácil | Feedback inmediato. Evita duplicate requests. |
| 2 | **Focus automático al campo de key tras éxito** | 🟢 Fácil | Flujo continuo para usuarios multicuenta. Ahorra 27 clicks. |
| 3 | **Validación local de formato de key** | 🟢 Fácil | Evita fetchs innecarios. Feedback más rápido. |
| 7 | **Botón "Limpiar" más visible** | 🟢 Fácil | Limpieza rápida si hubo error en la pegada. |
| 8 | **Mejorar mensajes de error** | 🟢 Fácil | El usuario puede corregir el error más rápido. |
| 9 | **Feedback de carga en `loadAllForToken()`** | 🟢 Fácil | Evita sensación de bloqueo. |

### 🟡 Propuestas Medias (validadas por Code Reviewer)

| # | Propuesta | Dificultad | Estado del Reviewer |
|---|-----------|------------|---------------------|
| 4 | **Feedback visual en campo (éxito/error)** | 🟡 Medio | ✅ Aprobar con cambios: solo `theme-polish.css`, `classList-toggle`, mensaje hermano con escape. Patrón `.field--ok`/`.field--error` similar a `.kpi--ok`/`.kpi--bad`. |
| 5 | **Diferenciar "Agregando" vs "Actualizando"** | 🟡 Medio | ✅ Aprobar con cambios: usar variable `idx` existente en `addOrUpdate`, no cambiar return, no mover toast al caller. |
| 6 | **Timeout de validación (10s)** | 🟡 Medio | ✅ Aprobar con cambios: modify `API.json`/`API.tokenInfo` para aceptar `signal`, usar `clearTimeout` en `finally`, detectar `AbortError`. Patrón existente en `inventory-dashboard.js`. |

### 📊 Priorización del PO

1. 🟢 Propuesta 1 (Loading state)
2. 🟢 Propuesta 2 (Focus automático)
3. 🟢 Propuesta 3 (Validación local)
4. 🟢 Propuesta 8 (Mejorar errores)
5. 🟢 Propuesta 7 (Botón Limpiar)
6. 🟢 Propuesta 9 (Feedback de carga)
7. 🟡 Propuesta 4 (Feedback visual)
8. 🟡 Propuesta 5 (Diferenciar agregar/actualizar)
9. 🟡 Propuesta 6 (Timeout)

---

### 🔴 Pendiente: inventory-dashboard.js — Migración de estilos inline bloqueada

**Estado:** Fase 1 CSS aplicada, pero problemas visuales de glow y overflow sin resolver. Bloqueada.

**Contexto adicional:**
- El archivo tiene estilos inline que violan la arquitectura de 3 capas.
- Tiene un bug en el patrón de `clearTimeout` (lo pone después del `await`, dejando timers colgantes en caso de error). Mismo bug que detectamos en la Propuesta 6.
- Requiere diagnóstico con DevTools para ver qué regla CSS está ganando.

**Prioridad:** A definir por el PO en la próxima sessión.