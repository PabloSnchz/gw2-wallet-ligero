# 🐈‍⬛ Bóveda del Gato Negro — GW2 Wallet & MetaEventos

Aplicación liviana para **Guild Wars 2** que permite consultar:

- 🪙 **Wallet / Divisas** de la cuenta  
- 🎭 **MetaEventos** con horarios, estado y “Hecho hoy”  
- 💱 **Conversor Gem ↔ Gold**  
- 🔐 Gestión completa de **API Keys**  
- ⭐ Favoritas, filtros avanzados, vista tarjetas/tabla  

👉 **Página oficial (Deploy GitHub Pages):**  
https://pablosnchz.github.io/gw2-wallet-ligero/

---

## ✨ Novedades principales — v3.0.0


## Tabla de contenidos
- [Demo / Capturas](#demo--capturas)
- [Requisitos](#requisitos)
- [Primeros pasos](#primeros-pasos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [MetaEventos (cómo funciona)](#metaventos-cómo-funciona)
  - [Estado “Hecho hoy” (API + Manual)](#estado-hecho-hoy-api--manual)
  - [Horarios por tarjeta](#horarios-por-tarjeta)
  - [Vista Compacta y Modo Deluxe](#vista-compacta-y-modo-deluxe)
  - [Drops e Infusiones](#drops-e-infusiones)
- [Cómo agregar/editar eventos](#cómo-agregareditar-eventos)
- [Filtros y selects (tema oscuro)](#filtros-y-selects-tema-oscuro)
- [Desarrollo](#desarrollo)
- [QA / Checklist rápido](#qa--checklist-rápido)
- [Accesibilidad](#accesibilidad)
- [Versionado](#versionado)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---


## 🧩 Estructura del Proyecto
index.html — layout y paneles
css/main.css — estilos
js/app.js — shell
js/meta.js — lógica MetaEventos
assets/ — imágenes y JSON de seed/extras

## 🔐 API Keys — Cómo funcionan
El sistema requiere una API Key de ArenaNet con permisos:

- Navegador moderno (Chrome/Edge/Firefox/Safari actual).
- **API Key** de Guild Wars 2 con permisos `account` y `wallet` (y opcionalmente `progression` para endpoints de cuenta).
- Acceso a Internet para consultar endpoints oficiales de GW2 y la wiki.

Podés generarlas acá:  
https://account.arena.net/applications

Las claves **no se envían a servidores externos**.  
Se guardan **localmente en tu navegador** mediante `localStorage`.

### Gestión de keys
- Botón **“Gestión de API Keys ▾”** en el header  
- Desde el modal podés:
  - ➕ Agregar  
  - ✏️ Renombrar  
  - 🗑 Eliminar  
  - 📋 Copiar  
  - 🔄 Usar  

El **selector global** a su derecha permite cambiar de cuenta instantáneamente.

---

## 📊 Funcionalidad

### 🪙 Wallet
- Filtros: búsqueda, categoría, orden, “Solo > 0”, “Solo principales”  
- Vista **tarjetas** y **tabla**  
- Favoritas con ★  
- Badges de monedas (oro/plata/cobre)

### 🎭 MetaEventos
- Estado en vivo: **Activo / Próximo / Más tarde**  
- Cálculo por ventanas **UTC**  
- “**Hecho hoy**” basado en:
  - `GET /v2/account/worldbosses`
  - `GET /v2/account/mapchests`
- Sidebar: **Top 3 próximos**
- Tooltip visual de infusiones

### 💱 Conversor Gem ↔ Gold
- Cálculo por búsqueda binaria  
- Cache TTL 30 min  
- Indicador especial **Ref 400**  

---
## MetaEventos (cómo funciona)

### Estado “Hecho hoy” (API + Manual)
- **Worldbosses**: `GET /v2/account/worldbosses`  
- **Mapchests** (HoT/PoF): `GET /v2/account/mapchests`  
- **Manual** para eventos sin API (global/instance/temple/event):  
  - Se habilita el ✔ **clickeable** cuando `api:{}` y `manualCheck:true` en `meta-events.json`.  
  - Persiste en `localStorage` **por token** y **por día UTC**.  
  - Se limpia solo al reset (00:00 UTC).

> Cache de flags por token: TTL **5 minutos**.  
> Visualización del “Último actualizado” arriba a la derecha.

### Horarios por tarjeta
- Si un evento incluye `windowsUTC`, la tarjeta muestra el botón **Horarios** (toggle).
- Los chips resaltan:
  - **NOW (verde)** si está activo.
  - **SOON (ámbar)** si empieza en ≤ 20 minutos.
- Se calcula con `durationMin` por tarjeta.

### Vista Compacta y Modo Deluxe
- **Modo Deluxe**: bordes de color por `type` (worldboss/meta/global/instance/temple/event).  
- **Vista Compacta**: reduce densidad (oculta acciones/pie/horarios), ideal para “escaneo masivo”.
- Ambos toggles se inyectan automáticamente en la barra de filtros:
  - Cambian atributos en `<body>`:
    - `data-meta-deluxe="on|off"`
    - `data-meta-compact="on|off"`

### Drops e Infusiones
- El pie de tarjeta usa `highlightItemId` (API de items) o `items` del `meta-drops.json`.
- Si detecta infusión (por nombre o tipo `UpgradeComponent` con `Infusion`), etiqueta como **Infusión destacada** y habilita **preview** (hover).

---

## Cómo agregar/editar eventos
- **Archivo**: `assets/meta-events.json`  
- **Tipos admitidos**: `"worldboss" | "meta" | "global" | "instance" | "temple" | "event"`
- **Campos relevantes**:
  - `id`, `name`, `type`, `expansion`, `map`, `wiki`, `chat`, `windowsUTC`, `durationMin`
  - `api`:  
    - `{"worldBossId": "<id API>"}`
    - `{"mapChestId": "<id API>"}`  
    - `{}` (vacío) para eventos sin API
  - `manualCheck: true` para permitir ✔ manual en eventos sin API.
- **Waypoints** (`chat`): usá el _chat code_ del mapa/encuentro (p.ej., `[&BPwAAAA=]` para Behemoth).
- **Drops**: `assets/meta-drops.json` (vincula por `metaId`).  
  - `highlightItemId` (numérico de item) para obtener ícono/nombre de la API.
  - `items[]` para listar drops manuales (con `preview` si querés hover).

> **Sugerencia**: para worldbosses, usá los `worldBossId` oficiales de `/v2/worldbosses`; para metas HoT/PoF, usá `mapchests`.

---

## Filtros y selects (tema oscuro)
- En **Meta & Eventos** (Tipo/Expansión) y **Wallet** (Categoría/Orden) los **selects**:
  - No tienen caret (se quita la flecha del navegador).
  - Se ven **oscuros**, con texto claro.
  - **Una sola pastilla**: el contenedor `.chip` es la pastilla; el `<select>` es plano.
- Los **chips** tienen hover/focus/pressed/checked sólidos y accesibles.

---


## 🛠 Desarrollo local

- Sitio **estático** (no requiere _build system_).
- **Actualización de versión** (_cache bust_):  
  - Si necesitás invalidar cache duro, actualizá el query param `?v=` en `index.html` para `js/meta.js` y/o `assets/…`.
- **Console logs**:  
  - `MetaEventos meta.js v3.0 …` en carga.
  - `selfcheck` no intrusivo (revisa seed, contenedores y hook de token).

---

### 1) Clonar repo
```bash
git clone https://github.com/PabloSnchz/gw2-wallet-ligero.git
cd gw2-wallet-ligero

## QA / Checklist rápido
**Funcional**
- Copiar **WP** y **Compartir** (toasts OK).
- **Wiki** abre en nueva pestaña.
- **Mapa** abre [maps.gw2.io](https://maps.gw2.io/).
- **Favoritos**: máximo 6 en “Tus 6 preferidos”.
- **✔ Manual**: clic/Enter/Barra; persiste hasta 00:00 UTC.
- **Flags**: refresh manual y cache TTL 5′.
- **Horarios**: toggle; chips correctamente marcados (NOW/SOON).

**UI/UX**
- **Selects** oscuros sin caret, legibles (Meta & Wallet).
- **Chips** sin doble pastilla; hover/focus sólidos.
- **Vista Compacta** / **Modo Deluxe** toggles OK.
- **Responsive**: sin desbordes a <900px.

---

## Accesibilidad
- **Focus visible** en chips y ✔ manual.
- Acciones clave accesibles por teclado:
  - ✔ manual (Enter/Espacio)
  - Favoritos (Enter/Espacio)
  - Copiar WP / Compartir / Horarios (Enter/Espacio)

---

## Versionado
Este proyecto sigue **Semantic Versioning** (SemVer).

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
