# GW2 Wallet (ligero)

Pequeña web al estilo **gw2efficiency** para ver las **divisas (wallet)** de una cuenta de Guild Wars 2, con soporte para **múltiples API Keys**, **validación de permisos**, **filtros** y **vista compacta**.

## Características
- Guardar **múltiples API Keys** localmente (solo en tu navegador).
- Validación con **/v2/tokeninfo** y chequeo de permisos **account** + **wallet**.
- Lectura de **/v2/account/wallet** y enriquecimiento con **/v2/currencies** (nombre, icono, orden).
- **Filtros**: búsqueda por nombre, categoría (mapeo comunitario), solo principales, solo con saldo, y orden configurable.
- **Vista**: tarjetas o **compacta (tabla)**.

> Referencias oficiales: [/v2/account/wallet](https://wiki.guildwars2.com/wiki/API:2/account/wallet), [/v2/currencies](https://wiki.guildwars2.com/wiki/API:2/currencies), [/v2/tokeninfo](https://wiki.guildwars2.com/wiki/API:2/tokeninfo). Para evitar preflight **CORS** desde el navegador, se usa `?access_token=` en vez del header `Authorization`. Consulta [API:API key](https://wiki.guildwars2.com/wiki/API:API_key) y [API:Main](https://wiki.guildwars2.com/wiki/API:Main).

## Estructura
```
/ (raíz)
  index.html
  css/styles.css
  js/app.js
  .nojekyll
  .github/workflows/pages.yml
  LICENSE
```

## Uso local
1. Abre `index.html` en tu navegador.
2. Pega tu **API Key** (con permisos `account` y `wallet`).
3. Selecciona la key en el combo y pulsa **Actualizar**.

## Publicar en GitHub Pages (sin herramientas externas)
1. Crea un repositorio en GitHub (por ejemplo `gw2-wallet-ligero`).
2. Sube **todos** los archivos de este ZIP a la rama `main` (raíz del repo).
3. Ve a **Settings → Pages** y en *Build and deployment* selecciona:
   - **Source**: *Deploy from a branch*
   - **Branch**: `main` / (root)
4. Guarda; espera unos segundos y entra al link que te muestra GitHub Pages.

## Publicar en GitHub Pages (con Actions automáticas)
Este proyecto incluye `.github/workflows/pages.yml`. Si prefieres Actions:
1. Subí el contenido a `main`.
2. Abrí la pestaña **Actions** y habilitá workflows si te lo pide.
3. El job **Deploy static content to Pages** publicará automáticamente.

## Seguridad
- Las **API Keys** se guardan **solo** en `localStorage` del navegador del usuario.
- Para peticiones autenticadas desde el front se usa `?access_token=`, recomendado cuando el backend de la API no soporta preflight CORS.

## Licencia
MIT.
