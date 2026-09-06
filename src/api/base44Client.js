import { API_BASE_URL } from '@/lib/api-base';

const TOKEN_KEY = 'mirat_access_token';

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Error de servidor'), { status: response.status, data: body });
  return body;
}

export const base44 = {
  auth: {
    me: () => request('/api/auth/me'),
    async login(email, password) {
      const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, result.token);
      return result.user;
    },
    forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, password) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    logout(redirect) {
      localStorage.removeItem(TOKEN_KEY);
      if (redirect) window.location.assign('/login');
    },
    redirectToLogin() { window.location.assign('/login'); },
  },
  functions: {
    async invoke(name, data = {}) {
      const result = await request(`/api/functions/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(data) });
      return { data: result };
    },
  },
  appLogs: { logUserInApp: async () => undefined },
};
