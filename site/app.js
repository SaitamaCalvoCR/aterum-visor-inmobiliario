import {satelliteLayer} from './satellite.js';
import {areaLabel, areaNote, referenceArea} from './presentation.js';
import {readNavigation, writeNavigation} from './navigation.js';
const $ = id => document.getElementById(id);
async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo leer ${path} (${response.status})`);
  return response.json();
}
const views = {mapa:['btnMapa','vistaMapa'], '3d':['btn3D','vista3D'], informacion:['btnInfo','vistaInfo']};
let map, parcel, ortho, model, fitParcel, mapWasVisible=false;
let modelStarting = false;
let information, informationPromise, current = readNavigation();
function syncDestination() {
  if (!information || current.view !== 'informacion') return;
  const resolved = information.setDestination(current.destination);
  if (resolved !== current.destination) {
    current.destination = resolved;
    writeNavigation(current.view, resolved, 'replace');
  }
}
function activateView(view, {destination=null, historyMode='push', fit=false} = {}) {
  current = {view, destination:view === 'informacion' ? destination : null};
  if (historyMode !== 'none') writeNavigation(current.view, current.destination, historyMode);
  for (const [name,[button,section]] of Object.entries(views)) {
    $(section).hidden = name !== view; $(button).setAttribute('aria-pressed', String(name === view));
  }
  $('mapControls').hidden = view !== 'mapa';
  if (view === 'mapa') requestAnimationFrame(() => {map?.invalidateSize();if(fit || !mapWasVisible){fitParcel?.();if(fitParcel)mapWasVisible=true;}});
  if (view === '3d') startModel();
  if (view === 'informacion') {
    if (information) {information.setVisible(true);syncDestination();}
    else initInfo();
  } else information?.setVisible(false);
  model?.setVisible(view === '3d');
}
for (const [view,[button]] of Object.entries(views)) $(button).onclick=()=>activateView(view,{destination:view==='informacion'?information?.getDestination():null});
document.addEventListener('click', event => {
  const trigger=event.target.closest('[data-view]');
  if (!trigger) return;
  const view=Object.keys(views).find(name=>views[name][0]===trigger.dataset.view);
  if(view) activateView(view,{fit:view==='mapa'});
});
window.addEventListener('popstate',()=>{const state=readNavigation();activateView(state.view,{destination:state.destination,historyMode:'none'});});
$('shareView').onclick=async()=>{
  try {await navigator.clipboard.writeText(location.href);$('shareStatus').textContent='Enlace de esta vista copiado';}
  catch {$('shareStatus').textContent='Copiá el enlace desde la barra de direcciones';}
  setTimeout(()=>{$('shareStatus').textContent='';},3500);
};
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
    $('area').textContent = $('infoArea').textContent = referenceArea(data.features[0]);
    const popup = document.createElement('p');
    popup.textContent = `${areaLabel}: ${referenceArea(data.features[0])}. ${areaNote}`;
    parcel.bindPopup(popup);
    const fit = () => map.fitBounds(parcel.getBounds(), {padding: [40, 40], maxZoom: 21});
    fitParcel = fit;
    fit();
    if(!$('vistaMapa').hidden)mapWasVisible=true;
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
async function initInfo() {
  if (informationPromise || information) return;
  informationPromise = (async()=>{
  try {
    const {createInformation} = await import('./information.js');
    information = await createInformation({onDestinationChange:destination=>{
      if(current.view !== 'informacion') return;
      current.destination=destination;writeNavigation('informacion',destination);
    }});
    information.setVisible(current.view==='informacion');
    syncDestination();
  } catch (error) {
    $('infoStatus').hidden = false;
    $('infoStatus').textContent = `No se pudo abrir la información: ${error.message}`;
    const retry = document.createElement('button'); retry.textContent = 'Reintentar'; retry.onclick = initInfo;
    $('infoStatus').append(retry);
  } finally {informationPromise = null;}
  })();
}
initMap();
activateView(current.view,{destination:current.destination,historyMode:'none'});

$('togglePanel').onclick = () => {const collapsed = document.body.classList.toggle('panel-collapsed'); $('togglePanel').setAttribute('aria-expanded', String(!collapsed)); $('togglePanel').textContent = collapsed ? 'Mostrar panel' : 'Ocultar panel'; setTimeout(() => map?.invalidateSize(), 220);};
