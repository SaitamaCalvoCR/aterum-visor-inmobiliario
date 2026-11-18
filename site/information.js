import {satelliteLayer} from './satellite.js';
import {areaLabel, areaNote, referenceArea} from './presentation.js';
const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const number = (n, digits = 1) => new Intl.NumberFormat('es-CR', {maximumFractionDigits:digits}).format(n);
export const distanceText = metres => `${number(metres / 1000, 2)} km`;
export function durationText(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
const summary = item => [distanceText(item.distance_m), durationText(item.duration_s)].filter(Boolean).join(' · ');
async function json(url) {const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json();}
const el = (tag, className, text) => {const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
function button(text, action, style = 'secondary') {const b=el('button',style,text);b.type='button';b.onclick=action;return b;}
function external(text, href) {const a=el('a','secondary',text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
// Enlace oficial de navegación; no descarga rutas ni imágenes de Google.
export function directions(item) {
  const url=new URL('https://www.google.com/maps/dir/');
  url.search=new URLSearchParams({api:'1',origin:[item.origin[1],item.origin[0]].join(','),destination:[item.destination[1],item.destination[0]].join(','),travelmode:'driving'});
  return url.href;
}
export async function createInformation({onDestinationChange=()=>{}} = {}) {
  const [media,property,predio] = await Promise.all([json('data/recursos.json'),json('data/propiedad.json'),json('data/predio.geojson')]);
  let currentPhoto=0, photoList=media.photos;
  function setPhoto() {
    const photo=photoList[currentPhoto];
    $('expandedPhoto').src=photo.src;$('expandedPhoto').alt=photo.alt;
    $('expandedCaption').textContent=`${currentPhoto+1} / ${photoList.length} · ${photo.alt}`;
  }
  function openPhoto(list,index) {photoList=list;currentPhoto=index;setPhoto();$('photoDialog').showModal();}
  $('closePhoto').onclick=()=>$('photoDialog').close();
  const advance = delta => {currentPhoto=(currentPhoto+delta+photoList.length)%photoList.length;setPhoto();};
  $('nextPhoto').onclick=()=>advance(1);$('previousPhoto').onclick=()=>advance(-1);
  $('photoDialog').addEventListener('keydown',event=>{if(event.key==='ArrowRight')advance(1);if(event.key==='ArrowLeft')advance(-1);});
  let touchX;
  $('expandedPhoto').addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX;},{passive:true});
  $('expandedPhoto').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchX;if(Math.abs(dx)>50)advance(dx<0?1:-1);},{passive:true});
  let mainIndex=0;
  function setMain(index) {
    mainIndex=index;const photo=media.photos[index];$('mainPhoto').src=photo.src;$('mainPhoto').alt=photo.alt;
    document.querySelectorAll('[data-photo-index]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.photoIndex)===index)));
  }
  $('heroPhoto').onclick=()=>openPhoto(media.photos,mainIndex);
  media.photos.forEach((photo,index)=>{
    const b=button('',()=>setMain(index),'photo-thumbnail');b.dataset.photoIndex=index;b.setAttribute('aria-label',photo.alt);
    const img=el('img');img.src=photo.thumb;img.alt='';img.loading='lazy';b.append(img,el('span','',photo.category==='inmueble'?'El inmueble':'El entorno'));$('photoThumbs').append(b);
  });
  $('photoCount').textContent=`${media.photos.length} fotografías · Abrí la galería para ampliar`;
  setMain(0);
  $('infoTitle').textContent=property.nombre.split('|')[0].trim();
  $('infoArea').textContent=referenceArea(predio.features[0]);
  if(property.ubicacion){$('propertyLocation').textContent=property.ubicacion;$('propertyLocation').hidden=false;}
  const facts=[[areaLabel,referenceArea(predio.features[0])],['Ubicación general',property.ubicacion],['Referencia local',property.referencia_local],['País',property.pais]];
  for(const [label,value] of facts) if(value != null && value!=='') {
    const fact=el('div','property-fact');fact.append(el('span','',label),el('strong','',String(value)));$('propertyFacts').append(fact);
  }
  $('propertyFacts').append(el('p','area-reference-note',areaNote));
  document.querySelectorAll('.experience-nav a').forEach(a=>a.onclick=event=>{event.preventDefault();$(a.hash.slice(1))?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});});
  media.videos.forEach(video=>{
    const card=el('article','video-card'), player=el('video');player.controls=true;player.preload='none';player.playsInline=true;player.poster=video.poster;player.setAttribute('aria-label',video.title);
    const play=button(`Reproducir · ${video.title}`,()=>{
      player.src=video.src;player.load();play.hidden=true;
      player.play().catch(()=>{message.textContent='Usá los controles del video para iniciar la reproducción.';});
    },'video-play');
    const message=el('p','video-message');player.addEventListener('error',()=>{message.textContent='No se pudo cargar el video. Comprobá la conexión e intentá de nuevo.';play.hidden=false;});
    card.append(player,play,el('h4','',video.title),el('p','',`${Math.round(video.duration_s)} segundos · Recurso demostrativo de dron`),message);$('droneVideos').append(card);
  });
  const tourism=media.guacalillo;
  if(tourism.length>=2) {
    // Panorámica primero; la segunda es vertical. Identidad aportada por el usuario y nombres de archivo.
    for(const [imageId,buttonId,index] of [['guacalilloPhoto','guacalilloMain',1],['guacalilloPhoto2','guacalilloSecond',0]]) {
      $(imageId).src=tourism[index].src;$(imageId).alt=tourism[index].alt;$(buttonId).onclick=()=>openPhoto(tourism,index);
    }
  } else $('guacalillo').hidden=true;
  $('infoStatus').hidden=true;$('experience').hidden=false;
  let routeMap, overlay, markers, destinations, routes, originMarker, selected, links={};
  let ensureServiceVisible=()=>{};
  const slugFor=id=>Object.keys(links).find(slug=>links[slug]===id) || null;
  const categories={supermercados:'Supermercados',educacion:'Educación',salud:'Salud'};
  const colors={supermercados:'#087b61',educacion:'#4f65ae',salud:'#b44b63',regional:'#246d99',turismo:'#af6a2d'};
  const latlng=coordinates=>[coordinates[1],coordinates[0]];
  const scrollMap=()=> $('surroundingsMap').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
  const overview=(notify=true)=>{
    if(!routeMap || !markers)return;
    if(overlay){routeMap.removeLayer(overlay);overlay=null;}
    for(const marker of markers.values()){marker.closeTooltip();marker.addTo(routeMap);}
    selected=null; document.querySelectorAll('[data-route-id]').forEach(b=>b.setAttribute('aria-pressed','false'));
    $('selectedDestination').textContent='Todos los destinos';$('routeSummary').textContent='Elegí un destino para ver su recorrido';
    routeMap.fitBounds(L.latLngBounds(destinations.map(d=>latlng(d.destination))).extend(originMarker.getLatLng()),{padding:[28,28],animate:!reduced});
    if(notify)onDestinationChange(null);
  };
  function select(item, scroll=true, notify=true) {
    if(overlay)routeMap.removeLayer(overlay);
    const feature=routes.features.find(f=>f.properties.route_id===item.id);if(!feature)return;
    overlay=L.geoJSON(feature,{style:{color:colors[item.category],weight:5,opacity:.95,className:'selected-route'}}).addTo(routeMap);
    selected=item.id;
    ensureServiceVisible(item);
    for(const [id,marker] of markers){marker.closeTooltip();if(id===selected)marker.addTo(routeMap);else routeMap.removeLayer(marker);}
    document.querySelectorAll('[data-route-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.routeId===selected)));
    $('selectedDestination').textContent=item.name;$('routeSummary').textContent=`${summary(item)} · Estimación sin tráfico en vivo`;
    markers.get(item.id).openTooltip();
    routeMap.fitBounds(overlay.getBounds().extend(latlng(item.origin)).extend(latlng(item.destination)),{padding:[32,32],animate:!reduced});
    if(scroll)scrollMap();
    if(notify)onDestinationChange(slugFor(item.id));
  }
  function card(item, regional=false) {
    const c=el('article',regional?'regional-card':'destination-card');
    c.addEventListener('click', event=>{if(!event.target.closest('button,a'))select(item);});
    c.append(el('span','eyebrow',regional?'Conectividad por carretera':categories[item.category]),el('h4','',item.name),el('p','route-metrics',summary(item)));
    c.append(el('span','estimate-label','Tiempo estimado · Sin tráfico en vivo'));
    const b=button(regional?'Explorar recorrido ↗':'Mostrar ruta ↗',()=>select(item));b.dataset.routeId=item.id;b.setAttribute('aria-pressed','false');c.append(b);
    if(regional)c.append(external('Cómo llegar ↗',directions(item)));
    return c;
  }
  let loaded=false;
  async function loadRoutes() {
    if(loaded)return;loaded=true;
    try {
      [destinations,routes,links]=await Promise.all([json('data/entorno/servicios.json'),json('data/entorno/rutas.geojson'),json('data/entorno/enlaces.json')]);
      routeMap=L.map('surroundingsMap',{scrollWheelZoom:false,dragging:!matchMedia('(pointer: coarse)').matches,touchZoom:false,maxZoom:20});
      satelliteLayer(L,()=>{$('routeMapError').textContent='El fondo satelital no está disponible. Las rutas siguen visibles.';$('routeMapError').hidden=false;}).addTo(routeMap);
      L.control.scale({imperial:false}).addTo(routeMap);
      const icon=(color,home=false)=>L.divIcon({className:'destination-pin',html:`<span style="background:${color}">${home?'⌂':'•'}</span>`,iconSize:[28,28],iconAnchor:[14,14]});
      originMarker=L.marker(latlng(destinations[0].origin),{icon:icon('#182523',true)}).addTo(routeMap).bindTooltip('Origen de los recorridos · Propiedad');
      markers=new Map();destinations.forEach(item=>{
        const text=document.createElement('span');text.textContent=item.name;
        markers.set(item.id,L.marker(latlng(item.destination),{icon:icon(colors[item.category])}).addTo(routeMap).bindTooltip(text).on('click',()=>select(item,false)));
      });
      const propertyURL=new URL('https://www.google.com/maps/search/');propertyURL.search=new URLSearchParams({api:'1',query:latlng(destinations[0].origin).join(',')});$('propertyDirections').href=propertyURL.href;$('propertyDirections').hidden=false;
      const services=destinations.filter(d=>categories[d.category]).sort((a,b)=>a.distance_m-b.distance_m);
      const priority=new Set([
        ...services.filter(d=>d.category==='supermercados').slice(0,2),
        ...services.filter(d=>d.category==='educacion'),
        ...services.filter(d=>d.category==='salud').slice(0,1)
      ].map(d=>d.id));
      let serviceCategory='all', expanded=false;
      function renderServices(category=serviceCategory) {
        serviceCategory=category;
        const matches=services.filter(d=>category==='all'||d.category===category);
        const visible=matches.filter(d=>expanded || priority.has(d.id));
        $('serviceCards').replaceChildren(...visible.map(d=>card(d)));
        document.querySelectorAll('[data-service-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.serviceFilter===category)));
        if(selected)document.querySelectorAll('[data-route-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.routeId===selected)));
        $('moreServices').hidden=matches.length===matches.filter(d=>priority.has(d.id)).length;
        $('moreServices').setAttribute('aria-expanded',String(expanded));
        $('moreServices').textContent=expanded?'Ver servicios destacados':`Explorar más servicios (${matches.length-visible.length})`;
      }
      ensureServiceVisible=item=>{
        if(!categories[item.category])return;
        if(serviceCategory!=='all' && serviceCategory!==item.category)serviceCategory='all';
        if(!priority.has(item.id))expanded=true;
        renderServices();
      };
      $('moreServices').onclick=()=>{expanded=!expanded;renderServices();};
      for(const [key,label] of Object.entries({all:'Todos',...categories})) {
        if(key!=='all'&&!services.some(d=>d.category===key))continue;
        const b=button(label,()=>{expanded=false;renderServices(key);},'filter-chip');b.dataset.serviceFilter=key;$('serviceFilters').append(b);
      }
      renderServices('all');destinations.filter(d=>d.category==='regional'||d.category==='turismo').sort((a,b)=>['orotina','jaco','guacalillo'].indexOf(slugFor(a.id))-['orotina','jaco','guacalillo'].indexOf(slugFor(b.id))).forEach(d=>$('regionalCards').append(card(d,true)));
      const guac=destinations.find(d=>d.category==='turismo');
      if(guac) {
        $('guacalilloRoute').append(el('h4','',guac.name),el('p','route-metrics',summary(guac)),el('p','estimate-label','Tiempo estimado · Sin tráfico en vivo'));
        const b=button('Ver ruta al mirador ↗',()=>select(guac),'primary');b.dataset.routeId=guac.id;b.setAttribute('aria-pressed','false');$('guacalilloRoute').append(b,external('Cómo llegar ↗',directions(guac)));
      }
      $('routeOverview').onclick=()=>overview();
      $('routeOrigin').onclick=()=>routeMap.setView(originMarker.getLatLng(),18,{animate:!reduced});
      $('mapInteraction').onclick=()=>{
        const active=$('mapInteraction').getAttribute('aria-pressed')!=='true';
        $('mapInteraction').setAttribute('aria-pressed',String(active));$('mapInteraction').textContent=active?'Desactivar mapa':'Activar mapa';
        $('surroundingsMap').classList.toggle('touch-enabled',active);
        for(const handler of ['dragging','touchZoom','scrollWheelZoom'])active?routeMap[handler].enable():routeMap[handler].disable();
      };
      const resize=new ResizeObserver(()=>routeMap.invalidateSize());resize.observe($('surroundingsMap'));
      overview(false);
    } catch(error) {$('routeMapError').textContent=`No se pudieron abrir los recorridos: ${error.message}`;$('routeMapError').hidden=false;loaded=false;}
  }
  // Se difiere todo el módulo hasta abrir Información. Un solo mapa atiende todas las tarjetas.
  await loadRoutes();
  return {getDestination:()=>slugFor(selected),setDestination(slug) {
    const item=destinations?.find(d=>d.id===links[slug]);
    if(!item){overview(false);return null;}
    if(selected!==item.id)select(item,true,false);
    return slugFor(item.id);
  },setVisible(visible) {
    if(visible)requestAnimationFrame(()=>routeMap?.invalidateSize());
    else {document.querySelectorAll('#droneVideos video').forEach(v=>v.pause());if($('photoDialog').open)$('photoDialog').close();}
  }};
}
