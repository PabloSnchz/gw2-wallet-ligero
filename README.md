
# GW2 Wallet — v1.4.0-preview4

Este build integra la alternancia **estricta** Tarjetas/Compacta en el proyecto completo:

- **Account Name** (ej.: `shiruvano.3084`) desde `/v2/account` (permiso `account`).
- **Exclusividad estricta** entre Tarjetas y Compacta usando `style.display`.
- **Iconos de acciones** (copiar/renombrar/eliminar/actualizar) junto al combo.
- **Densidad ArenaNet** por defecto (sin selector).

Endpoints usados:
- `/v2/tokeninfo` para validar permisos de la key (`account`/`wallet`).
- `/v2/account` para `name` (y GUID interno `id`).
- `/v2/currencies?ids=all` para metadatos de divisas.
- `/v2/account/wallet` para saldos.
