# ATERUM — Visor inmobiliario

Visor estático: mapa satelital, ortofotografía, predio referencial, modelo 3D e Información con galería, videos y rutas precalculadas.

## Sitio

https://saitamacalvocr.github.io/aterum-visor-inmobiliario/

GitHub Actions publica exclusivamente `site/`. Esta entrega contiene solo derivados web seleccionados; no incluye originales, datos privados, scripts de procesamiento, credenciales ni recursos de trabajo.

## Desarrollo

Ejecutar `python -m http.server 8031 --bind 127.0.0.1 --directory site` y abrir http://127.0.0.1:8031.

Los límites y el área son referenciales. Los tiempos de ruta proceden de openrouteservice y son estimaciones sin tráfico en vivo; los accesos no están verificados en campo. El modelo no tiene georreferenciación global verificada. El fondo satelital usa Esri y conserva sus atribuciones.

Los SVG y recursos del inmueble son materiales del proyecto ATERUM: no se concede una licencia general para reutilizarlos. Las licencias de Leaflet y Three.js acompañan sus bibliotecas en `site/vendor/`.
