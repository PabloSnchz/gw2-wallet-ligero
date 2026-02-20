
# Parche para `PabloSnchz/gw2-wallet-ligero`

**Fecha:** 2026-02-20 17:24:51

Corregimos:
1) **Tarjeta** y **Compacta**: cuando seleccionás una API Key, la app no la enviaba (confusión `kay` vs `key`).
2) **Metaeventos**: el sidebar derecho empujaba las tarjetas hacia abajo.

## Qué hace este parche
- Añade `js/patch-fix-keys-and-layout.js` que **normaliza el uso de la API Key** y corrige llamadas a `/v2/account/wallet`/`/v2/tokeninfo` agregando `?access_token=<key>` si falta o si venía mal como `kay`/`key`. (No requiere backend.)
- Añade `css/patch-fix-metaeventos.css` con layout **flex + sticky** para el sidebar derecho sin romper mobile.
- No reemplaza archivos core: se cargan **después** de tus archivos para que sea no-invasivo y reversible.

> El API oficial permite pasar la key como `?access_token=...` y recomienda ese método en front para evitar preflight CORS. Fuente: Wiki: API:Main y API:2/account/wallet. 

## Cómo aplicar (rápido)
1. Copiá `css/patch-fix-metaeventos.css` a `css/` y `js/patch-fix-keys-and-layout.js` a `js/`.
2. Editá `index.html` y luego de tus includes existentes agregá:
   ```html
   <link rel="stylesheet" href="css/patch-fix-metaeventos.css">
   <script defer src="js/patch-fix-keys-and-layout.js"></script>
   ```
3. Refrescá el sitio (si usás GitHub Pages, hacé commit y esperá el deploy).

## Reversión
Quitá las dos líneas en `index.html` y borrá los dos archivos del parche.

## Verificación rápida
- Cambiá la API Key en el selector → verás las llamadas a `/v2/tokeninfo` y `/v2/account/wallet` con `?access_token=<key>`.
- En **Metaeventos**, en desktop el sidebar queda a la derecha y **no** empuja las tarjetas hacia abajo; en mobile se apila.

## Archivos incluidos
- `css/patch-fix-metaeventos.css`
- `js/patch-fix-keys-and-layout.js`
- `SMOKE-CHECKLIST.md`
- `CHANGELOG.md`
- `MANIFEST.txt`
