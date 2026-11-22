import { base44 } from '@/api/base44Client';

const OFFLINE_ROUTE_PREFIX = 'track4race:offline-route:';

function routeCacheKey(waypoints) {
  const signature = (waypoints || []).map((point) => {
    const lat = Number(point.lat);
    const lng = Number(point.lng ?? point.lon);
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }).join('|');
  // A lightweight deterministic hash keeps localStorage keys short while
  // distinguishing routes that share the same start and finish.
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${OFFLINE_ROUTE_PREFIX}${waypoints?.length || 0}:${(hash >>> 0).toString(36)}`;
}

function offlineBounds(waypoints, radiusKm = 50) {
  const points = (waypoints || []).filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng ?? point.lon)));
  if (!points.length) return null;
  const latitudes = points.map((point) => Number(point.lat));
  const longitudes = points.map((point) => Number(point.lng ?? point.lon));
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
  const centerLat = (minLat + maxLat) / 2;
  const latRadius = radiusKm / 111.32;
  const lngRadius = radiusKm / (111.32 * Math.max(0.2, Math.cos(centerLat * Math.PI / 180)));
  return { south: minLat - latRadius, west: minLng - lngRadius, north: maxLat + latRadius, east: maxLng + lngRadius, radiusKm };
}

function readRouteCache(key) {
  if (typeof localStorage === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function writeRouteCache(key, value) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be full/private */ }
}

// Valhalla is preferred when the VPS has the regional graph available. The
// caller can keep rendering the existing GPX route when it returns fallback.
export async function requestReliableInstructions(waypoints, costing = 'auto') {
  const locations = (waypoints || [])
    .filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng ?? point.lon)))
    .map((point) => ({ lat: Number(point.lat), lon: Number(point.lng ?? point.lon) }));
  if (locations.length < 2) return { fallback: true, reason: 'invalid-route' };
  const cacheKey = routeCacheKey(waypoints);
  try {
    const response = await base44.functions.invoke('getValhallaRoute', { locations, costing });
    const route = response.data?.fallback ? response.data : { ...response.data, fallback: false };
    if (!route.fallback) {
      writeRouteCache(cacheKey, { savedAt: Date.now(), radiusKm: 50, bounds: offlineBounds(waypoints), route });
    }
    return route;
  } catch {
    try {
      const cached = readRouteCache(cacheKey);
      if (cached?.route && cached.radiusKm === 50) return { ...cached.route, offline: true, cachedAt: cached.savedAt };
    } catch {}
    return { fallback: true, reason: 'unavailable' };
  }
}
