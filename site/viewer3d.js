import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export async function createViewer(container, status) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'low-power'}); }
  catch { throw new Error('Tu navegador no pudo iniciar WebGL 2. Prueba con aceleración gráfica habilitada.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#404845');
  renderer.toneMapping = THREE.NoToneMapping;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.screenSpacePanning = true;
  let visible = true, frame = 0, observer, transition, dirty = true;
  controls.addEventListener('change', () => {dirty = true;});
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = () => {
    if (!visible) return;
    if (transition) {
      const t = Math.min(1, (performance.now() - transition.start) / 650);
      camera.position.lerpVectors(transition.from, transition.to, t * t * (3 - 2 * t));
      controls.target.lerpVectors(transition.targetFrom, transition.targetTo, t * t * (3 - 2 * t));
      if (t === 1) transition = null;
    }
    controls.update();
    if (dirty || transition) {renderer.render(scene, camera); dirty = false;}
    frame = requestAnimationFrame(render);
  };
  try {
    const gltf = await new GLTFLoader().loadAsync('models/casa.glb', event => {
      status.textContent = event.total ? `Cargando modelo 3D… ${Math.round(event.loaded / event.total * 100)}%` : `Cargando modelo 3D… ${(event.loaded / 1e6).toFixed(1)} MB`;
    });
    scene.add(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    camera.near = radius / 1000; camera.far = radius * 100;
    controls.minDistance = radius * .04; controls.maxDistance = radius * 8;
    function move(to, target, smooth = true) {
      transition = null;
      if (smooth && !reducedMotion) transition = {from: camera.position.clone(), to, targetFrom: controls.target.clone(), targetTo: target, start: performance.now()};
      else {camera.position.copy(to); controls.target.copy(target); controls.update();}
    }
    controls.addEventListener('start', () => {transition = null;});
    function distance() {return radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * .92;}
    function reset(smooth = true) {
      move(center.clone().add(new THREE.Vector3(.65, .95, 1).normalize().multiplyScalar(distance())), center.clone(), smooth);
    }
    function action(name) {
      const target = controls.target.clone(), offset = camera.position.clone().sub(target);
      if (['top','front','side'].includes(name)) {
        const direction = {top:[0,1,.001],front:[0,.35,1],side:[1,.35,0]}[name];
        move(center.clone().add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance())), center.clone());
      } else if (name === 'orbit') {
        move(target.clone().add(offset.applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI / 6)), target);
      } else if (name === 'in' || name === 'out') {
        const length = THREE.MathUtils.clamp(offset.length() * (name === 'in' ? .75 : 1.33), controls.minDistance, controls.maxDistance);
        move(target.clone().add(offset.setLength(length)), target);
      } else {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        const delta = (name === 'left' || name === 'right' ? right : up).multiplyScalar(offset.length() * .08 * (name === 'left' || name === 'down' ? -1 : 1));
        move(camera.position.clone().add(delta), target.add(delta));
      }
    }
    function resize() {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false); dirty = true;
    }
    resize(); reset(false);
    observer = new ResizeObserver(resize); observer.observe(container);
    status.hidden = true;
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); visible = false; cancelAnimationFrame(frame);
      status.textContent = 'Se perdió el contexto gráfico. Recarga la página para volver a abrir el modelo.';
      status.hidden = false;
    });
    render();
    function setVisible(next) {
      visible = next && !document.hidden;
      cancelAnimationFrame(frame);
      if (visible) { resize(); render(); }
    }
    document.addEventListener('visibilitychange', () => setVisible(!document.getElementById('vista3D').hidden));
    return {reset, setVisible, action};
  } catch (error) {
    visible = false; cancelAnimationFrame(frame); observer?.disconnect();
    controls.dispose(); renderer.dispose(); renderer.domElement.remove();
    throw error;
  }
}
