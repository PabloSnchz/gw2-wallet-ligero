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

## ✨ Novedades principales — v2.6.0

### 🔐 Modal “Gestión de API Keys”
- Alta, edición, eliminación, copia y selección de API Keys  
- Validación de permisos **`account` + `wallet`**  
- UI moderna, accesible (ESC / backdrop), consistente  
- Se almacena en **LocalStorage**, sin servidores externos

### 🌐 Selector Global en el Header
- Permite cambiar de key **desde cualquier pantalla**  
- Sin necesidad de volver a Wallet  
- Sincroniza automáticamente con el modal

### 🧹 Limpieza de UI
- Eliminado el selector viejo del panel Wallet  
- Código legacy removido  
- Wallet queda mucho más claro y ordenado

### 🧠 Mejoras internas
- Nuevo **KeyManager** unificado (JS)  
- Fix en `onBottomInput()` del conversor  
- Revisión y estabilidad en `updateRef400()`  
- Limpieza de eventos duplicados

---

## 🧩 Estructura del Proyecto
## 🔐 API Keys — Cómo funcionan

El sistema requiere una API Key de ArenaNet con permisos:

- `account`
- `wallet`

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

## 🛠 Desarrollo local

No requiere backend.  
Podés servirlo de manera estática.

### 1) Clonar repo
```bash
git clone https://github.com/PabloSnchz/gw2-wallet-ligero.git
cd gw2-wallet-ligero
