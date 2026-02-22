# 📜 Changelog
Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato sigue las recomendaciones de  
**Keep a Changelog** (https://keepachangelog.com/)  
y el versionado **SemVer** (https://semver.org/).

---

## [2.0.0] - 2026-02-21
### 🚀 Rediseño total – “Bóveda del Gato Negro”
Esta versión reemplaza completamente la versión anterior de *gw2-wallet-ligero*, introduciendo una nueva identidad visual, estructura profesional y mejoras profundas en la UI/UX.

#### ✨ Nuevo
- Nueva identidad: **Bóveda del Gato Negro**
- Header estilo ArenaNet con:
  - Textura Hero
  - Overlay semitransparente
  - Logo + tipografía ornamental
  - Tabs principales flotantes
- Navegación renovada
- Dropdown **“Enlaces útiles”** (Efficiency, Timer, ArcDPS, API docs)
- Redes integradas: Discord, Instagram, YouTube
- Favicon nuevo (SVG + PNG)
- Marquita GN para footer
- Estructura HTML optimizada
- Estilo CSS reescrito desde cero
- Paleta de color basada en identidad del logo
- 🧩 Preparación modular para próximos módulos:
  - Conversor Gem ↔ Oro
  - MetaEventos
  - Dashboard extendido

#### 🛠 Mejorado
- Mejor rendimiento de carga inicial
- Overlay con efecto **glass UI**
- Header + hero responsivos
- Espaciados y jerarquía visual revisada
- Compatibilidad con GitHub Pages

#### 🧹 Eliminado
- Proyecto antiguo y archivos previos (HTML/CSS/JS obsoletos)
- Legacy tokens de estilos y scripts viejos
- Documentación antigua

---

## [1.6.1] - 2026-02-20
### 🎨 Ajustes de overlay
- Correcciones en overlay debajo/encima del header
- Ajustes responsive
- Afinado de glow y colores

---

## [1.5.0] - 2026-02-19
### 🎨 Incorporación logo + branding inicial

---

## [1.4.0] - 2026-02-18
### 🧭 Nuevo header con textura + barra superior

---

## [1.3.4] - 2026-02-17
### 🐞 Fix crítico
- Corrección de iconos en tarjetas
- Corrección de overflow en descripciones largas

---

## [1.0.0] - 2026-02-15
### 🎉 Versión inicial
- Lectura de API Keys
- Integración con `/v2/account/wallet`
- Grilla de tarjetas
- Vista compacta (tabla)
