import { base44 } from '@/api/base44Client';
import { API_BASE_URL } from '@/lib/api-base';

async function api(entity, action, payload) {
  const token = localStorage.getItem('mirat_access_token');
  const response = await fetch(`${API_BASE_URL}/api/entities/${entity}${action ? `/${action}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Error de servidor'), { status: response.status });
  return body;
}

function entity(name) {
  return {
    list: (options = {}) => api(name, 'list', { options }),
    filter: (criteria = {}, options = {}) => api(name, 'list', { criteria, options }),
    get: (id) => api(name, 'get', { id }),
    create: (data) => api(name, 'create', { data }),
    update: (id, data) => api(name, 'update', { id, data }),
    delete: (id) => api(name, 'delete', { id }),
  };
}

export const AppConfig = entity('AppConfig');
export const GpsDevice = entity('GpsDevice');
export const GpxTrack = entity('GpxTrack');
export const LiveLocation = entity('LiveLocation');
export const Poi = entity('Poi');
export const PoiType = entity('PoiType');
export const Runner = entity('Runner');
export const RunnerLocation = entity('RunnerLocation');
export const Team = entity('Team');
export const User = entity('User');
export { base44 };
