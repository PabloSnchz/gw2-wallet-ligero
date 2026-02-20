# GW2 Wallet – estilo ArenaNet (v1.2.0)

**Cinco mejoras aplicadas para lograr el look & feel ArenaNet:**
1) Tema oscuro ArenaNet (colores + bordes)  
2) Header superior con tabs  
3) Tarjetas re-diseñadas (header+footer) estilo bloques de API Keys  
4) Hover states y botones rojos  
5) Tipografía ajustada y layout compacto

## Cómo usar
1. Abrí `index.html` o visitá el sitio publicado (GitHub Pages).
2. Agregá una o más API Keys (se guardan en tu navegador).
3. Seleccioná la key y presioná **Actualizar**.
4. Usá filtros y cambiá entre **Tarjetas** / **Compacta**.

## Notas
- Las API Keys se validan con `/v2/tokeninfo` y requieren `account` + `wallet`.
- Las llamadas autenticadas usan `?access_token=` desde el navegador.
