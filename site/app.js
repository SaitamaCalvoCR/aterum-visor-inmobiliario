import {satelliteLayer} from './satellite.js';
const $ = id => document.getElementById(id);
async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo leer ${path} (${response.status})`);
  return response.json();
}
const formatArea = value => `≈ ${new Intl.NumberFormat('es-CR', {maximumFractionDigits: 2}).format(value)} m²`;
const views = {btnMapa: 'vistaMapa', btn3D: 'vista3D', btnInfo: 'vistaInfo'};
let map, parcel, ortho, model;
let modelStarting = false;
for (const [button, view] of Object.entries(views)) {
  $(button).addEventListener('click', () => {
    for (const [other, section] of Object.entries(views)) {
      $(section).hidden = section !== view;
      $(other).setAttribute('aria-pressed', String(other === button));
    }
    $('mapControls').hidden = view !== 'vistaMapa';
    if (view === 'vistaMapa') requestAnimationFrame(() => map?.invalidateSize());
    if (view === 'vista3D') startModel();
    if (view === 'vistaInfo') initInfo();
    information?.setVisible(view === 'vistaInfo');
    model?.setVisible(view === 'vista3D');
  });
}
function mapMessage(text, error = false) {
  $('mapStatus').textContent = text;
  $('mapStatus').classList.toggle('error', error);
  $('mapStatus').hidden = !text;
}
async function initMap() {
  try {
    if (!window.L) throw new Error('Leaflet no está disponible.');
    map = L.map('map', {preferCanvas: true, minZoom: 3, maxZoom: 23, zoomSnap: .5});
    const satellite = satelliteLayer(L, () => mapMessage('Servicio satelital inaccesible. Comprueba tu conexión y recarga.', true)).addTo(map);
    L.control.scale({imperial: false, position: 'bottomright'}).addTo(map);
    const data = await readJSON('data/predio.geojson');
    parcel = L.geoJSON(data, {style: {color: '#ffc94d', weight: 3, fillOpacity: 0.04}}).addTo(map);
    if (!parcel.getBounds().isValid()) throw new Error('El predio no contiene una extensión válida.');
    const area = data.features[0]?.properties.area_calculada_m2;
    if (Number.isFinite(area)) {
      $('area').textContent = $('infoArea').textContent = formatArea(area);
      const popup = document.createElement('p');
      popup.textContent = `Superficie aproximada (geometría ajustada): ${formatArea(area)}. Límites referenciales.`;
      parcel.bindPopup(popup);
    }
    const fit = () => map.fitBounds(parcel.getBounds(), {padding: [40, 40], maxZoom: 21});
    fit();
    $('fit').disabled = $('showParcel').disabled = false;
    $('fit').addEventListener('click', fit);
    $('showParcel').addEventListener('change', event => {
      if (event.target.checked) parcel.addTo(map); else map.removeLayer(parcel);
    });
    mapMessage('');
    try {
      const meta = await readJSON('data/ortofoto.json');
      ortho = L.imageOverlay(meta.image, meta.bounds, {opacity: 1, attribution: 'Ortofotografía de dron · WebODM'});
      ortho.on('load', () => {
        $('showOrtho').disabled = $('opacity').disabled = false;
      });
      ortho.on('error', () => {
        $('showOrtho').disabled = $('opacity').disabled = true;
        mapMessage('No se pudo cargar la ortofotografía. Recarga la página para reintentar.', true);
      });
      ortho.addTo(map);
      const clip = () => {
        const img = ortho.getElement(); if (!img) return;
        const active = $('compare').checked && $('showOrtho').checked;
        const x = map.getSize().x * Number($('swipe').value) / 100;
        const left = map.latLngToContainerPoint(ortho.getBounds().getNorthWest()).x;
        img.style.clipPath = active ? `inset(0 0 0 ${Math.max(0, x - left)}px)` : '';
        $('swipeControl').hidden = !active;
        $('divider').hidden = !active;
        $('divider').style.left = `${$('swipe').value}%`;
      };
      $('compare').onchange = clip; $('swipe').oninput = clip;
      map.on('move zoom resize', clip); ortho.on('load', clip);
      $('showOrtho').addEventListener('change', clip);
      $('showOrtho').addEventListener('change', event => {
        if (event.target.checked) ortho.addTo(map); else map.removeLayer(ortho);
        $('opacity').disabled = !event.target.checked;
      });
      $('opacity').addEventListener('input', event => {
        const value = Number(event.target.value);
        ortho.setOpacity(value / 100);
        $('opacityValue').value = `${value}%`;
      });
    } catch (error) { mapMessage(`Ortofotografía no disponible: ${error.message}`, true); }
  } catch (error) { mapMessage(`No se pudo cargar el mapa: ${error.message}`, true); }
}
async function startModel() {
  if (model || modelStarting) return;
  modelStarting = true;
  $('modelStatus').hidden = false;
  $('modelStatus').textContent = 'Cargando modelo 3D…';
  try {
    const {createViewer} = await import('./viewer3d.js');
    model = await createViewer($('viewer3d'), $('modelStatus'));
    $('resetCamera').disabled = false;
    $('resetCamera').onclick = () => model.reset();
    document.querySelectorAll('[data-camera]').forEach(button => {button.disabled = false; button.onclick = () => model.action(button.dataset.camera);});
    model.setVisible(!$('vista3D').hidden);
  } catch (error) {
    $('modelStatus').replaceChildren(document.createTextNode(`No se pudo abrir el modelo: ${error.message}`));
    const retry = document.createElement('button');
    retry.className = 'outline'; retry.textContent = 'Reintentar'; retry.onclick = startModel;
    $('modelStatus').append(retry);
  } finally { modelStarting = false; }
}
let information, informationLoading = false;
async function initInfo() {
  if (informationLoading || information) return;
  informationLoading = true;
  try {
    const {createInformation} = await import('./information.js');
    information = await createInformation();
    information.setVisible(!$('vistaInfo').hidden);
  } catch (error) {
    $('infoStatus').hidden = false;
    $('infoStatus').textContent = `No se pudo abrir la información: ${error.message}`;
    const retry = document.createElement('button'); retry.textContent = 'Reintentar'; retry.onclick = initInfo;
    $('infoStatus').append(retry);
  } finally {informationLoading = false;}
}
initMap();

$('togglePanel').onclick = () => {const collapsed = document.body.classList.toggle('panel-collapsed'); $('togglePanel').setAttribute('aria-expanded', String(!collapsed)); $('togglePanel').textContent = collapsed ? 'Mostrar panel' : 'Ocultar panel'; setTimeout(() => map?.invalidateSize(), 220);};
