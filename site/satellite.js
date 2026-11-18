/** Cada tesela busca su imagen disponible y amplía el recorte de un ancestro XYZ. */
export function satelliteLayer(L, onUnavailable = () => {}) {
  const service = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
  const cache = new Map();
  async function image(z, x, y) {
    const key = `${z}/${y}/${x}`;
    if (!cache.has(key)) {
      const promise = (async () => {
        const r = await fetch(`${service}/tile/${key}?blankTile=false`, {signal: AbortSignal.timeout(6000)});
        if (!r.ok || r.headers.get('blank-tile') === 'true' || !r.headers.get('content-type')?.startsWith('image/')) throw new Error('Sin tesela');
        return createImageBitmap(await r.blob());
      })();
      cache.set(key, promise);
      if (cache.size > 192) {
        const oldest = cache.keys().next().value;
        cache.get(oldest).then(bitmap => bitmap.close()).catch(() => {});
        cache.delete(oldest);
      }
    }
    return cache.get(key);
  }
  const Adaptive = L.GridLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('canvas'); tile.width = tile.height = 256;
      (async () => {
        for (let z = Math.min(coords.z, 19); z >= 0; z--) {
          const factor = 2 ** (coords.z - z);
          try {
            const bitmap = await image(z, Math.floor(coords.x / factor), Math.floor(coords.y / factor));
            const width = bitmap.width / factor;
            const height = bitmap.height / factor;
            tile.getContext('2d').drawImage(bitmap, (coords.x % factor) * width, (coords.y % factor) * height, width, height, 0, 0, 256, 256);
            tile.dataset.nativeZoom = z;
            done(null, tile); return;
          } catch { /* Sin cobertura o error HTTP: probar el nivel inferior. */ }
        }
        onUnavailable(); done(new Error('Servicio satelital inaccesible'), tile);
      })();
      return tile;
    }
  });
  return new Adaptive({minZoom: 3, maxZoom: 23, maxNativeZoom: 19, keepBuffer: 1,
    attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics'});
}
