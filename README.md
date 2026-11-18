# ATERUM Demo 2.0

**Demostración tecnológica · Inmueble no disponible para venta.**

https://saitamacalvocr.github.io/aterum-visor-inmobiliario/

Ejemplo en Lagunillas, Coyolar, Orotina, Alajuela. Cartografía, ortofotografía, modelo 3D y accesibilidad mediante rutas precalculadas. Superficie referencial del ejemplo: 1.181,18 m²; geometría ajustada solo para demostración visual, sin constituir un deslinde.

GitHub Actions publica únicamente `site/`. Los originales y recursos de trabajo no forman parte del repositorio. Se conservan licencias de Leaflet y Three.js en `site/vendor/`. No se concede una licencia general de reutilización de los materiales ATERUM.

Vistas compartibles: `?vista=mapa`, `?vista=3d`, `?vista=informacion` y `?vista=informacion&destino=jaco` (también `orotina` o `guacalillo`). Tiempos estimados sin tráfico en vivo; accesos no verificados en campo.

Desarrollo local: `python -m http.server 8031 --bind 127.0.0.1 --directory site`.
