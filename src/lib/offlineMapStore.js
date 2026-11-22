const STYLE_KEY = 'track4race:offline-map-style';
const CACHE_NAME = 'track4race-offline-map-v1';
const DEFAULT_MAP_URL = import.meta.env?.VITE_OFFLINE_MAP_URL || '/offline-maps/spain-mainland.pmtiles';

export function getOfflineMapStyleUrl() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(STYLE_KEY);
    return value && /^((https?:|capacitor:|file:|blob:|\/))/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function setOfflineMapStyleUrl(styleUrl) {
  if (typeof localStorage === 'undefined') return false;
  if (!styleUrl || typeof styleUrl !== 'string') return false;
  try {
    localStorage.setItem(STYLE_KEY, styleUrl);
    return true;
  } catch {
    return false;
  }
}

export function clearOfflineMapStyleUrl() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STYLE_KEY); } catch { /* ignore storage errors */ }
}

export async function cacheOfflineMap(url = DEFAULT_MAP_URL) {
  if (typeof caches === 'undefined' || typeof fetch === 'undefined') return false;
  if (await hasCachedOfflineMap(url)) return true;
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`No se pudo descargar el mapa offline (${response.status})`);
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, response.clone());
  setOfflineMapStyleUrl(url);
  return true;
}

export async function hasCachedOfflineMap(url = DEFAULT_MAP_URL) {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(CACHE_NAME);
  return Boolean(await cache.match(url));
}
