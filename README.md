
# GW2 Wallet — v1.5.0-pre1

Este build agrega:
- **Favoritos / Pinned** (⭐) en tarjetas y tabla, con persistencia local.
- **Tooltips** estilo ArenaNet (nombre, descripción, categorías).
- **Conversor Gem ↔ Gold** en el sidebar (usa los endpoints del Exchange).

Endpoints de referencia:
- `/v2/currencies?ids=all` (catálogo de divisas). 
- `/v2/commerce/exchange/gems` y `/v2/commerce/exchange/coins` para tasas del exchange.
