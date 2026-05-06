# 🐈‍⬛ Bóveda del Gato Negro — Guía de Usuario Avanzada

**Versión: v6.5.0** | **Actualizado: Mayo 2026**

Esta guía cubre cada módulo en detalle con tres preguntas clave:

| Sección | Pregunta |
|---------|----------|
| **¿Qué es?** | Descripción simple del módulo |
| **¿Cómo se usa?** | Paso a paso de uso cotidiano |
| **¿Para qué sirve?** | Casos de uso reales, cuándo conviene usarlo |

---

## 📋 Índice

1. [Cartera (Wallet)](#1-cartera-wallet)
2. [Meta & Eventos](#2-meta--eventos)
3. [Logros](#3-logros)
4. [Cámara del Brujo](#4-cámara-del-brujo)
5. [Actividades](#5-actividades)
6. [Inventario y Personajes](#6-inventario-y-personajes)
7. [Conversor de Divisas](#7-conversor-de-divisas)
8. [Raid Tracker](#8-raid-tracker)
9. [Dashboard de Cartera Multi-Cuenta](#9-dashboard-de-cartera-multi-cuenta)
10. [Panel de Cuentas](#10-panel-de-cuenta)
11. [Purchase Detail](#11-purchase-detail)
12. [Backup y Restaurar](#12-backup-y-restaurar)
13. [Sincronización con GitHub Gist](#13-sincronización-con-github-gist)
14. [API Keys](#14-api-keys)

---

## 1. Cartera (Wallet)

### ¿Qué es?
El panel principal que muestra **todas tus divisas**: oro, gemas, karma, laureles, contratos comerciales, mosaicos de elegía, y cualquier otra moneda del juego.

### ¿Cómo se usa?
1. Seleccioná tu **API Key** en el selector superior
2. Las divisas se muestran como **tarjetas** con ícono, nombre y cantidad
3. Usá los **filtros** para buscar por nombre, categoría, o ver solo las principales
4. Alterná entre **vista tarjetas** y **vista tabla** con el botón correspondiente
5. Hacé clic en el **📌** para fijar una divisa arriba de todo

### ¿Para qué sirve?
- Ver de un vistazo cuánto oro, gemas y karma tenés
- Comparar divisas entre cuentas (con el Dashboard multi-cuenta)
- Fijar las divisas que más te interesan para acceso rápido

---

## 2. Meta & Eventos

### ¿Qué es?
Un panel que muestra **todos los meta eventos y world bosses** con sus horarios en tu zona horaria local, estado (activo/próximo/más tarde), y si ya los completaste hoy.

### ¿Cómo se usa?
1. Las tarjetas muestran nombre, mapa, tipo, y horarios
2. **🟢 Activo** = está ocurriendo ahora. **🟡 Próximo** = empieza en ≤20 min. **🔵 Más tarde** = después.
3. Clic en **📌** para fijar hasta 6 favoritos
4. Clic en **Horarios** para ver todas las ventanas del día
5. El botón **Refrescar estado** consulta si ya lo hiciste hoy

### ¿Para qué sirve?
- Saber qué world boss o meta evento está por empezar
- Planificar tu sesión de juego alrededor de los eventos que te interesan
- Ver de un vistazo qué eventos ya completaste hoy (fuente: API de world bosses y map chests)

---

## 3. Logros

### ¿Qué es?
Un panel que muestra tus **logros más cercanos a completar**, ordenados por porcentaje de progreso, con filtros por categoría, rareza y tipo de recompensa.

### ¿Cómo se usa?
1. Usá los **dropdowns de filtro** para elegir umbral (≥80%, ≥90%, ≥95%), categoría (PvE, PvP, WvW, etc.), y tipo de recompensa (ítem, título, maestría)
2. Cada tarjeta muestra el nombre del logro, categoría, progreso, y recompensa
3. Clic en **Wiki** para abrir la página oficial del logro

### ¿Para qué sirve?
- Identificar logros que están a punto de completarse para obtener sus recompensas
- Filtrar por tipo de recompensa (items, títulos, maestrías)
- Ver el AP total y el AP potencial que podés ganar

---

## 4. Cámara del Brujo

### ¿Qué es?
El módulo del **Wizard's Vault** con cuatro secciones: objetivos diarios, semanales, especiales, y la tienda de Aclamación Astral.

### ¿Cómo se usa?

#### Objetivos (Diarias/Semanales/Especiales)
1. Seleccioná la pestaña correspondiente
2. Cada tarjeta muestra el objetivo, progreso, recompensa en AA, y estado (reclamado/pendiente)
3. Los objetivos tienen un modo (PvE, PvP, WvW) indicado con un ícono

#### Tienda
1. Seleccioná la pestaña **Tienda**
2. Usá los filtros para buscar items por nombre, ordenar por costo, o filtrar por tipo
3. Cada tarjeta muestra el item, costo en AA, y cuántas veces lo compraste
4. Clic en **📌** para fijar items que querés comprar
5. Usá los inputs manuales para marcar compras hechas fuera de la API

### ¿Para qué sirve?
- Hacer el seguimiento diario/semanal de objetivos del Wizard's Vault
- Planificar tus compras de AA (Aclamación Astral)
- Ver de un vistazo qué items están fijados y cuánto falta para comprarlos

---

## 5. Actividades

### ¿Qué es?
Un panel que agrupa **actividades diarias y semanales**: PSNA, refinamiento de Ecto, fractales, llave del León Negro, Piedras de Invocación Vetustas (Leivas), y Home Nodes.

### ¿Cómo se usa?

#### PSNA (Pact Supply Network Agent)
- Muestra los 6 agentes del día con sus waypoints
- Clic en un waypoint para **copiarlo al portapapeles**
- Usá **Copiar todos** para llevarte los 6 de una vez

#### Ecto
- Muestra los 4 refinamientos diarios de Ecto
- ✅ = ya lo hiciste hoy. ⏳ = pendiente

#### Fractales
- Muestra los fractales T4 y recomendados del día
- Datos de ejemplo (no se conectan a API)

#### Llave del León Negro
- Detecta automáticamente si ya reclamaste la llave esta semana
- Busca personajes Thief nivel 10+ creados después del último reset semanal

#### Leivas (Piedras de Invocación Vetustas)
- Contador manual de 0 a 5
- Usá **+** y **−** para llevar la cuenta

#### Home Nodes
- Lista completa de 74 nodos de heredad
- Filtros por categoría (API/Janthir/Contratos), tipo (minería/madera/cosecha), y estado (desbloqueado/bloqueado)
- Checkbox "Recolectado hoy" con persistencia diaria

### ¿Para qué sirve?
- Centralizar todas las tareas diarias/semanales en un solo panel
- No olvidarte de la llave semanal ni de las Leivas
- Hacer la ruta de PSNA sin tener que buscar los waypoints a mano

---

## 6. Inventario y Personajes

### ¿Qué es?
Un buscador unificado que indexa tu **banco, almacenamiento de materiales y armería legendaria**. Permite encontrar cualquier objeto en tu cuenta.

### ¿Cómo se usa?

#### Hub principal
1. Navegá a **Inventario y Personajes** desde la sidebar
2. Los **KPIs** muestran cuántos items tenés en Materiales, Banco, Legendarios y Personajes
3. Usá el **buscador** para encontrar objetos por nombre
4. Filtra por **rareza** con el dropdown o los chips clickeables

#### Vistas de sección
- Clic en un KPI o encabezado → **vista detallada** de esa sección
- **Materiales**: organizado por las 10 categorías del juego
- **Banco**: grilla de 10×3 slots con paginación cada 30
- **Armería**: agrupada por tipo (armas, armaduras, espaldares, etc.)

#### Personajes
- Clic en **Ver Personajes** para ir a la lista de personajes
- Cada personaje muestra profesión, nivel, mapa, y punto de interés asignado

### ¿Para qué sirve?
- Encontrar cualquier objeto sin tener que abrir el juego
- Saber cuánto espacio ocupás en el banco
- Ver tus legendarios en la armería

---

## 7. Conversor de Divisas

### ¿Qué es?
Una herramienta para **calcular el costo de gemas en oro y viceversa**, usando los precios en tiempo real de la Compañía de Comercio. Incluye tabs adicionales para ver tus transacciones activas y los items más populares del TP.

### ¿Cómo se usa?

#### Tab Cambio
1. Abrí el conversor desde Cartera → botón **💎 Conversor**
2. Ingresá la cantidad de **gemas** u **oro**
3. Usá los **atajos rápidos** (100, 400, 800, 1200 gemas / 10g, 100g, 250g)
4. El **índice de conveniencia** te dice si es buen momento para comprar

#### Tab Transacciones
1. Requiere API Key con permiso **tradingpost**
2. Muestra tus **órdenes activas de compra y venta** en el TP
3. Los KPIs muestran el total en compras, total en ventas, y balance

#### Tab Populares
1. Muestra los **ítems con mayor volumen** de transacciones en el TP
2. Filtra por rareza para ver las legendarias más activas

### ¿Para qué sirve?
- Saber cuánto oro necesitás para comprar X gemas
- Evaluar si conviene comprar gemas ahora o esperar
- Monitorear tus órdenes activas en el TP sin abrir el juego
- Ver qué items se venden más rápido (especialmente legendarias)

---

## 8. Raid Tracker

### ¿Qué es?
Un panel que muestra las **8 alas de raid** con sus 33 encuentros (jefes y eventos), marcando automáticamente los que ya completaste esta semana vía API.

### ¿Cómo se usa?
1. Navegá a **Raids** desde la sidebar
2. Cada ala muestra sus encuentros con estado **✅ Completado** o **❌ Pendiente**
3. Clic en **Detalle** para ver descripción, estrategia, recompensas y enlaces a wiki/video
4. Los KPIs muestran el progreso semanal y los Insights Legendarios disponibles

### ¿Para qué sirve?
- Llevar el control semanal de raids sin usar planillas externas
- Ver qué encuentros te faltan para completar el ala
- Acceder rápido a guías y videos de cada encuentro

---

## 9. Dashboard de Cartera Multi-Cuenta

### ¿Qué es?
Una tabla que compara **todas tus cuentas** (API Keys) mostrando los saldos de las divisas seleccionadas.

### ¿Cómo se usa?
1. Andá a **Cartera** → botón **📊 Dashboard**
2. Seleccioná qué divisas querés ver (dropdown de divisas)
3. Ordená las cuentas por la divisa que te interese (clic en el encabezado)
4. Los KPIs superiores muestran totales acumulados

### ¿Para qué sirve?
- Comparar saldos entre cuentas
- Ver qué cuenta tiene más oro, karma, o Aclamación Astral
- Identificar cuentas con saldo bajo para farmear

---

## 10. Panel de Cuentas

### ¿Qué es?
Un gestor seguro de **múltiples cuentas de GW2** con cifrado local. Guarda emails, contraseñas, API Keys, datos de Twitch, y expansiones.

### ¿Cómo se usa?

#### Carga inicial
1. Usá el **Asistente** (4 pasos) para crear tu archivo `.enc` desde una plantilla Excel
2. O cargá directamente un archivo `.enc` con tu contraseña

#### Vista de cuentas
- **Vista tarjetas**: diseño "Profile Card" con ícono, email, contraseña, Twitch, GeForce, expansiones, y más
- **Vista tabla**: zebra striping, ordenable, con bordes de color por tipo de cuenta

#### Copia rápida
- Clic en cualquier campo (email, contraseña, API Key) para **copiarlo al portapapeles**

### ¿Para qué sirve?
- Gestionar múltiples cuentas sin tener que recordar contraseñas
- Tener a mano los datos de Twitch y GeForce Now de cada cuenta
- Ver qué expansiones tiene cada cuenta

---

## 11. Purchase Detail

### ¿Qué es?
Un panel de **seguimiento de compras del Wizard's Vault** que muestra tus cuentas, los items fijados, y el progreso de compra.

### ¿Cómo se usa?
1. Accedé desde la Tienda de la Cámara del Brujo → botón **Detalle de compras**
2. La tabla muestra cada cuenta como fila y cada item fijado como columna
3. Los KPIs superiores muestran Aclamación Astral disponible, necesaria, y delta
4. Usá los inputs manuales para marcar compras hechas

### ¿Para qué sirve?
- Ver de un vistazo qué items faltan comprar en cada cuenta
- Planificar cuánto AA necesitás farmear
- Identificar cuentas con déficit de AA

---

## 12. Backup y Restaurar

### ¿Qué es?
Un sistema para **exportar toda tu configuración** (API Keys, WV pins, Wallet pins, actividades, personajes, meta) a un archivo JSON y restaurarla en otro navegador o dispositivo.

### ¿Cómo se usa?
1. Clic en **Backup** en la barra superior → descarga un archivo `gw2-backup-YYYY-MM-DD.json`
2. En otro navegador, clic en **Restaurar** → seleccioná el archivo → confirmá

### ¿Para qué sirve?
- Migrar tu configuración entre navegadores o dispositivos
- Hacer backup antes de limpiar el navegador
- Compartir configuración con amigos (sin incluir API Keys sensibles)

---

## 13. Sincronización con GitHub Gist

### ¿Qué es?
Un sistema opcional para **sincronizar tu configuración en la nube** usando un Gist privado de GitHub.

### ¿Cómo se usa?
1. Generá un **token de GitHub** con permiso `gist` en https://github.com/settings/tokens
2. En la Bóveda, clic en **Sincronizar** → pegá el token → **Guardar token**
3. Usá **Subir configuración** para guardar tus datos en la nube
4. En otro dispositivo, configurá el mismo token y usá **Sincronizar desde la nube**

### ¿Para qué sirve?
- Mantener tus configuraciones sincronizadas entre dispositivos
- No perder tus pins, favoritos, ni preferencias al cambiar de PC

---

## 14. API Keys

### ¿Qué son?
Las **claves de acceso** que le dan permiso a la Bóveda para consultar tus datos de Guild Wars 2.

### ¿Cómo se usa?
1. Obtené una API Key en https://account.arena.net/applications
2. En la Bóveda, clic en **Gestión de API Keys** → pegá la key → **Guardar**
3. Seleccioná la key activa en el selector superior

### Permisos necesarios por módulo

| Módulo | Permisos requeridos |
|--------|-------------------|
| Cartera, Dashboard | `account`, `wallet` |
| Meta & Eventos | `account` |
| Logros | `account`, `progression` |
| Cámara del Brujo | `account`, `wizardsvault` |
| Actividades | `account`, `progression` |
| Inventario | `account`, `inventories` |
| Conversor (Transacciones) | `account`, `tradingpost` |
| Raid Tracker | `account`, `progression` |
| Purchase Detail | `account`, `wizardsvault` |

---

## 🐈‍⬛ Comunidad

¿Preguntas, sugerencias o querés reportar un bug? Encontranos en:

- **Discord**: https://discord.gg/ZGNsfsqyKe
- **YouTube**: https://www.youtube.com/@pablinschez
- **GitHub**: https://github.com/PabloSnchz/gw2-wallet-ligero

---

© Comunidad Gato Negro — Herramientas para GW2