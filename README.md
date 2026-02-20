
# GW2 Wallet — v1.4.0-preview

Cambios incluidos en este preview:
- **Account ID** (GUID de /v2/account) a la izquierda de “Seleccionar KEY”.
- **Exclusividad de vistas**: Tarjetas **o** Compacta (no ambas).
- **API Keys** del header abre la gestión oficial (nueva pestaña).
- **Sin tarjetas de keys en el sidebar**; combo + acciones reubicadas junto al combo.

> /v2/account requiere permiso `account` y devuelve `id` (GUID persistente). Autenticamos con `?access_token=`.
> Wallet: /v2/account/wallet (requiere `account` + `wallet`). Catálogo: /v2/currencies?ids=all.
