# GW2 Wallet (ligero)

Pequeña web al estilo **gw2efficiency** para ver las **divisas (wallet)** de una cuenta de Guild Wars 2, con soporte para **múltiples API Keys**, **validación de permisos**, **filtros** y **vista compacta**.

## Novedades
**v1.1.0** – Re‑maquetado de tarjetas: texto (nombre + descripción + categorías) arriba y una fila con **icono + cantidad** abajo. Mejor legibilidad y coherencia visual.

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
  CHANGELOG.md
```
