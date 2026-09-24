# 📋 Backlog — Bóveda del Gato Negro

> Última actualización: 2026-09-24
> Estado actual: v6.6.2 + Unreleased (commits `c293567`, `b2b9038`, `096e82f`)

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

## 📝 Notas

- Este backlog es vivo. Agregar items cuando surjan problemas o mejoras identificadas.
- Prioridad: **Alta** = rompe funcionalidad o seguridad. **Media** = mejora mantenibilidad. **Baja** = limpieza técnica.
- Los items descartados pueden revivir si cambian las circunstancias (ej: si se añade un backend que permita estilos dinámicos vía CSS variables).