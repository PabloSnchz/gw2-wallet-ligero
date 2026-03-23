# 🤝 Cómo contribuir

Gracias por tu interés en contribuir a **Bóveda del Gato Negro** 🐈‍⬛

---

## 📦 Flujo de trabajo

1. Hacé un **fork** del repositorio.
2. Creá una rama descriptiva:  
   `git checkout -b feature/nombre-de-tu-feature`
3. Hacé tus cambios.
4. Asegurate de que todo funcione (ver checklist abajo).
5. Abrí un **Pull Request** contra `main`.

---

## 🧹 Estilo de código

- Código limpio, indentado y comentado.
- No dejar `console.log` innecesarios.
- Evitar duplicación de lógica.
- Mantener funciones pequeñas y con una sola responsabilidad.
- Seguir el patrón de módulos IIFE con API pública expuesta en `window`.
- No romper invariantes técnicas documentadas en [`ONBOARDING.md`](docs/ONBOARDING.md).

---

## ✔ Reglas para PRs

- Explicar claramente qué cambia.
- Relacionar el PR con un Issue (si existe).
- Adjuntar capturas si cambia la UI.
- No incluir archivos generados (cache, configs locales, etc.).
- Actualizar `ONBOARDING.md` si los cambios afectan la arquitectura o invariantes.

---

## 🧪 Testing manual sugerido

### General
- [ ] Cargar API Key con permisos `account` y `wallet`
- [ ] Cambiar entre múltiples keys
- [ ] Verificar que no haya errores en consola

### Wallet
- [ ] Ver grid de tarjetas y vista tabla
- [ ] Fijar/desfijar divisas (📌)
- [ ] Filtrar por búsqueda, categoría, solo positivos
- [ ] Verificar glows especiales (gemas, karma, laureles, etc.)

### Meta & Eventos
- [ ] Ver tarjetas con horarios y estado
- [ ] Probar filtros (tipo, expansión, activos, próximos, infusiones)
- [ ] Click en "Horarios" → verificar hora local
- [ ] Verificar color del botón "Horarios" (verde/ámbar/azul)
- [ ] Verificar barra de horarios unificada (iconos GW2, UTC, resets)

### Actividades
- [ ] Ver PSNA, Ecto, World Bosses
- [ ] Ver Home Nodes: lista completa, estado ✅/❌, filtros, checkboxes
- [ ] Verificar barra de horarios unificada (iconos GW2, UTC, resets)

### Cámara del Brujo
- [ ] Ver objetivos diarios/semanales/especiales
- [ ] Ver tienda con filtros y contadores
- [ ] Ver Purchase Detail (dashboard AA)

### Logros
- [ ] Ver barras de progreso por categoría
- [ ] Filtrar por PvE/PvP/WvW

### Conversor Gem ↔ Gold
- [ ] Probar quick‑chips
- [ ] Verificar micro‑animaciones (`.updated`)
- [ ] Ver barra de conveniencia (ref 400)

### Responsive
- [ ] Probar en móvil (ancho <900px)

---

## 📬 ¿Necesitás ayuda?

Abrí un [Issue](https://github.com/PabloSnchz/gw2-wallet-ligero/issues) y te responderemos lo antes posible.

---

## 📚 Documentación de referencia

- [`ONBOARDING.md`](docs/ONBOARDING.md) — Arquitectura, invariantes, checklists
- [`CHANGELOG.md`](CHANGELOG.md) — Historial de versiones
- [`README.md`](README.md) — Guía de uso para usuarios