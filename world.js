/**
 * Loads country outlines (Natural Earth 1:110m via the world-atlas package)
 * and converts TopoJSON → GeoJSON features without extra dependencies.
 *
 * The file (~100 KB) is fetched from a public CDN at runtime, with a fallback.
 */
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  'https://unpkg.com/world-atlas@2/countries-110m.json',
];

let cache = null;

export async function loadWorld() {
  if (cache) return cache;
  let lastError = null;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      const topo = await res.json();
      if (!topo || !topo.objects || !topo.objects.countries) throw new Error('Unexpected map data');
      cache = topoToFeatures(topo, 'countries');
      return cache;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Map outlines unavailable');
}

/** Minimal TopoJSON decoder for Polygon / MultiPolygon objects. */
export function topoToFeatures(topo, objectName) {
  const t = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    if (!t) return arc.map((p) => [p[0], p[1]]);
    let x = 0, y = 0;
    return arc.map((p) => {
      x += p[0]; y += p[1];
      return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]];
    });
  });

  const ring = (indices) => {
    const out = [];
    indices.forEach((i, k) => {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      a.forEach((p, j) => { if (k === 0 || j > 0) out.push(p); });
    });
    return out;
  };

  return topo.objects[objectName].geometries
    .filter((g) => g.type === 'Polygon' || g.type === 'MultiPolygon')
    .map((g) => ({
      type: 'Feature',
      id: g.id != null ? String(g.id).padStart(3, '0') : null,
      properties: { name: (g.properties && g.properties.name) || '' },
      geometry: g.type === 'Polygon'
        ? { type: 'Polygon', coordinates: g.arcs.map(ring) }
        : { type: 'MultiPolygon', coordinates: g.arcs.map((poly) => poly.map(ring)) },
    }));
}
