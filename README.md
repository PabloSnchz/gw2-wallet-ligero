
# GW2 Wallet — v1.4.0 (final)

Incluye:
- **Account Name** (ej.: `shiruvano.3084`) desde `/v2/account` (permiso `account`).
- **Exclusividad estricta** entre Tarjetas/Compacta con `style.display`.
- **Iconos de acciones** (copiar/renombrar/eliminar/actualizar) junto al combo.
- **Densidad ArenaNet** por defecto (sin selector).
- **Header con textura** abstracta en grises (archivo `assets/header-texture.png`).

Endpoints:
- `/v2/tokeninfo` (validar permisos)
- `/v2/account` (name, id)
- `/v2/currencies?ids=all` (catálogo)
- `/v2/account/wallet` (saldos)
