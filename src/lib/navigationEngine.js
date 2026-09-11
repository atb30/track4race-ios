import { base44 } from '@/api/base44Client';

// Valhalla is preferred when the VPS has the regional graph available. The
// caller can keep rendering the existing GPX route when it returns fallback.
export async function requestReliableInstructions(waypoints, costing = 'auto') {
  const locations = (waypoints || [])
    .filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng ?? point.lon)))
    .map((point) => ({ lat: Number(point.lat), lon: Number(point.lng ?? point.lon) }));
  if (locations.length < 2) return { fallback: true, reason: 'invalid-route' };
  try {
    const response = await base44.functions.invoke('getValhallaRoute', { locations, costing });
    return response.data?.fallback ? response.data : { ...response.data, fallback: false };
  } catch {
    return { fallback: true, reason: 'unavailable' };
  }
}
