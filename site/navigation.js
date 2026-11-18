const allowedViews = new Set(['mapa', '3d', 'informacion']);
export function readNavigation() {
  const params = new URL(location.href).searchParams;
  const view = allowedViews.has(params.get('vista')) ? params.get('vista') : 'mapa';
  const candidate = params.get('destino');
  return {view, destination:view === 'informacion' && /^[a-z0-9-]{1,80}$/.test(candidate || '') ? candidate : null};
}
export function writeNavigation(view, destination, mode = 'push') {
  const url = new URL(location.href);
  url.searchParams.set('vista', allowedViews.has(view) ? view : 'mapa');
  if (view === 'informacion' && destination) url.searchParams.set('destino', destination);
  else url.searchParams.delete('destino');
  url.hash = '';
  if (url.href !== location.href) history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', url);
}
