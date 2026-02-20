
# SMOKE – gw2-wallet-ligero

## API Key (Tarjetas / Compacta)
- [ ] Cambio la API Key en el selector → la red muestra `/v2/tokeninfo?access_token=...` OK.
- [ ] Luego carga `/v2/account/wallet?access_token=...` OK.
- [ ] Si había `kay=` o `key=`, no rompe (se normaliza a `access_token`).

## Metaeventos
- [ ] En desktop (>=1024px) el sidebar queda a la derecha y no empuja el contenido.
- [ ] En mobile (<960px) el sidebar se apila sin solapar.

## Regresión
- [ ] Sin dependencias nuevas.
- [ ] Reversión simple quitando 2 includes del `index.html`.
