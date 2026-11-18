// Una sola convención pública. Los valores de área permanecen en el GeoJSON original.
export const areaLabel = 'Superficie referencial del ejemplo';
export const areaNote = 'Superficie tomada de la información de referencia. Geometría ajustada únicamente para demostración visual.';
export function referenceArea(feature) {
  const value = feature?.properties?.area_fuente_m2;
  return Number.isFinite(value) ? `${new Intl.NumberFormat('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2}).format(value).replace(/[\u00a0\u202f ]/g, '.')} m²` : 'Sin superficie de referencia';
}
