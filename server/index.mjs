import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Carga un .env sencillo sin introducir otra dependencia en el servidor.
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const dataDir = path.join(root, 'data');
const dbFile = path.join(dataDir, 'db.json');
const entities = ['AppConfig', 'GpsDevice', 'GpxTrack', 'LiveLocation', 'Poi', 'PoiType', 'Runner', 'RunnerLocation', 'Team', 'User'];
const port = Number(process.env.PORT || 3001);
const signingKey = process.env.SESSION_SECRET || 'replace-this-development-secret-before-production';
const passwordResetRequests = new Map();
// Orígenes autorizados a llamar a la API vía CORS: la propia web (same-origin,
// no estrictamente necesario pero no estorba) y la app iOS empaquetada con
// Capacitor, cuyo WebView sirve el contenido desde el esquema "capacitor://".
const ALLOWED_ORIGINS = new Set([
  'https://track4race.com',
  'capacitor://localhost',
  'http://localhost',
]);

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex')}`;
}
function verify(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash(password, salt).split(':')[1], 'hex'));
}
function sign(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', signingKey).update(payload).digest('base64url')}`;
}
function session(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', signingKey).update(payload).digest('base64url');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return user.exp > Date.now() ? user : null;
}
function initialDb() {
  const db = Object.fromEntries(entities.map((name) => [name, []]));
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) db.User.push({ id: crypto.randomUUID(), email: email.toLowerCase(), full_name: 'Administrador', role: 'admin', password_hash: hash(password), created_date: new Date().toISOString() });
  return db;
}
function readDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(initialDb(), null, 2));
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}
function writeDb(db) { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
function publicUser(user) { const { password_hash, ...safe } = user; return safe; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function requestAddress(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function canRequestPasswordReset(req, email) {
  const key = `${requestAddress(req)}:${String(email).toLowerCase()}`;
  const now = Date.now(); const recent = (passwordResetRequests.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 3) return false;
  recent.push(now); passwordResetRequests.set(key, recent); return true;
}
async function sendPasswordResetEmail(email, token) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
  if (!apiKey || !from || !appUrl) throw new Error('El correo de recuperación no está configurado');
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [email], subject: 'Restablece tu contraseña de Track&Race',
      html: `<p>Hemos recibido una solicitud para restablecer tu contraseña.</p><p><a href="${link}">Crear una nueva contraseña</a></p><p>El enlace caduca en una hora. Si no lo solicitaste, puedes ignorar este correo.</p>`,
    }),
  });
  if (!response.ok) throw new Error('No se pudo enviar el correo de recuperación');
}
function matches(item, criteria = {}) {
  return Object.entries(criteria).every(([key, rule]) => {
    const value = item[key];
    if (rule && typeof rule === 'object') {
      if ('eq' in rule) return value === rule.eq;
      if ('neq' in rule) return value !== rule.neq;
      if ('in' in rule) return rule.in.includes(value);
    }
    return value === rule;
  });
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function sendFile(res, file) {
  const extension = path.extname(file);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
  res.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', (c) => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON inválido')); } }); }); }
function assertAdmin(user) { if (user.role !== 'admin') throw Object.assign(new Error('Solo administradores'), { status: 403 }); }

async function entityApi(req, res, user, entity, action) {
  if (!entities.includes(entity)) return json(res, 404, { error: 'Entidad desconocida' });
  const input = await body(req); const db = readDb(); const collection = db[entity];
  if (action === 'list') {
    let results = collection.filter((item) => matches(item, input.criteria));
    const sort = input.options?.sort || input.options;
    if (typeof sort === 'string') { const descending = sort.startsWith('-'); const field = sort.replace(/^-/, ''); results.sort((a, b) => (a[field] > b[field] ? 1 : -1) * (descending ? -1 : 1)); }
    // A route can contain hundreds of thousands of GPX coordinates. List screens
    // only need its metadata; the full geometry is fetched with `get` when needed.
    if (entity === 'GpxTrack') {
      results = results.map(({ waypoints, gpx_data, ...summary }) => summary);
    }
    return json(res, 200, entity === 'User' ? results.map(publicUser) : results);
  }
  if (action === 'get') { const item = collection.find((x) => x.id === input.id); return item ? json(res, 200, entity === 'User' ? publicUser(item) : item) : json(res, 404, { error: 'No encontrado' }); }
  if (action === 'create') {
    if (entity === 'User') assertAdmin(user);
    const now = new Date().toISOString(); const record = { ...input.data, id: crypto.randomUUID(), created_date: now, updated_date: now, created_by: user.email };
    if (entity === 'User') { if (!record.email || !record.password) return json(res, 400, { error: 'Email y contraseña obligatorios' }); record.email = record.email.toLowerCase(); record.password_hash = hash(record.password); delete record.password; record.role ||= 'user'; }
    collection.push(record); writeDb(db); return json(res, 201, entity === 'User' ? publicUser(record) : record);
  }
  if (action === 'update' || action === 'delete') {
    const index = collection.findIndex((x) => x.id === input.id); if (index < 0) return json(res, 404, { error: 'No encontrado' });
    if (entity === 'User') assertAdmin(user);
    if (action === 'delete') { collection.splice(index, 1); writeDb(db); return json(res, 200, { success: true }); }
    const next = { ...collection[index], ...input.data, id: collection[index].id, updated_date: new Date().toISOString() };
    if (entity === 'User' && input.data.password) { next.password_hash = hash(input.data.password); delete next.password; }
    collection[index] = next; writeDb(db); return json(res, 200, entity === 'User' ? publicUser(next) : next);
  }
  return json(res, 404, { error: 'Acción desconocida' });
}

async function functionsApi(req, res, user, name) {
  if (name === 'getGoogleMapsApiKey') {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    return apiKey ? json(res, 200, { apiKey }) : json(res, 503, { error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }
  if (name === 'getStreetViewMetadata') {
    const { latitude, longitude } = await body(req);
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return json(res, 503, { error: 'GOOGLE_MAPS_API_KEY no configurada' });
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return json(res, 400, { error: 'Coordenadas no válidas' });
    }
    const location = `${Number(latitude)},${Number(longitude)}`;
    const remote = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`);
    const metadata = await remote.json();
    if (!remote.ok) return json(res, remote.status, { error: metadata.error_message || 'No se pudo comprobar Street View' });
    return json(res, 200, {
      available: metadata.status === 'OK' && Boolean(metadata.pano_id),
      status: metadata.status,
      panoId: metadata.pano_id || null,
      location: metadata.location || null,
      date: metadata.date || null,
    });
  }
  if (name === 'getOpenWeatherApiKey') {
    const apiKey = process.env.OPENWEATHER_TILE_API_KEY;
    return apiKey ? json(res, 200, { apiKey }) : json(res, 503, { error: 'OPENWEATHER_TILE_API_KEY no configurada' });
  }
  if (name === 'getWeatherData') {
    const { latitude, longitude } = await body(req);
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return json(res, 400, { error: 'Coordenadas no válidas' });
    }
    const parameters = new URLSearchParams({
      latitude: String(Number(latitude)), longitude: String(Number(longitude)), timezone: 'auto', forecast_days: '1', wind_speed_unit: 'kmh',
      current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,rain,weather_code',
      hourly: 'precipitation_probability,precipitation,rain',
    });
    const remote = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`);
    const forecast = await remote.json();
    if (!remote.ok) return json(res, remote.status, { error: forecast.reason || 'No se pudo consultar Open-Meteo' });
    const current = forecast.current || {};
    const hourly = forecast.hourly || {}; const times = hourly.time || [];
    const firstFutureIndex = Math.max(0, times.findIndex((time) => Date.parse(time) >= Date.now()));
    const nextHours = [0, 1, 2].map((offset) => firstFutureIndex + offset).filter((index) => index < times.length);
    const probability = Math.max(0, ...nextHours.map((index) => Number(hourly.precipitation_probability?.[index]) || 0));
    const rainMm = Math.max(0, ...nextHours.map((index) => Number(hourly.rain?.[index] ?? hourly.precipitation?.[index]) || 0));
    const intensity = rainMm >= 2.5 ? 'lluvia intensa' : rainMm >= 0.5 ? 'lluvia moderada' : rainMm > 0 ? 'lluvia ligera' : 'sin lluvia';
    return json(res, 200, {
      success: true,
      data: {
        wind: { speedKmh: Number(current.wind_speed_10m) || 0, direction: Number(current.wind_direction_10m) || 0, gustKmh: Number(current.wind_gusts_10m) || 0 },
        rain: { probability, intensity },
        source: 'Open-Meteo',
      },
    });
  }
  return json(res, 404, { error: `Función ${name} aún no migrada` });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS: necesario porque la app iOS (Capacitor) carga el bundle desde el
    // esquema "capacitor://localhost" y llama a esta API en otro origen. La
    // autenticación va por header Authorization (no cookies), así que no hace
    // falta Access-Control-Allow-Credentials.
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const { email, password } = await body(req); const user = readDb().User.find((u) => u.email === String(email).toLowerCase());
      return user && verify(password, user.password_hash) ? json(res, 200, { token: sign(user), user: publicUser(user) }) : json(res, 401, { error: 'Email o contraseña incorrectos' });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
      const { email } = await body(req); const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !canRequestPasswordReset(req, normalizedEmail)) return json(res, 200, { success: true });
      const db = readDb(); const account = db.User.find((user) => user.email === normalizedEmail);
      if (account) {
        const token = crypto.randomBytes(32).toString('base64url');
        account.password_reset_token_hash = sha256(token);
        account.password_reset_expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        writeDb(db);
        try { await sendPasswordResetEmail(account.email, token); } catch (error) { console.error('Password reset email failed:', error.message); }
      }
      return json(res, 200, { success: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      const { token, password } = await body(req);
      if (typeof password !== 'string' || password.length < 10) return json(res, 400, { error: 'La contraseña debe tener al menos 10 caracteres' });
      const db = readDb(); const tokenHash = sha256(String(token || ''));
      const account = db.User.find((user) => user.password_reset_token_hash === tokenHash && Date.parse(user.password_reset_expires_at || '') > Date.now());
      if (!account) return json(res, 400, { error: 'El enlace no es válido o ha caducado' });
      account.password_hash = hash(password);
      delete account.password_reset_token_hash; delete account.password_reset_expires_at;
      account.updated_date = new Date().toISOString(); writeDb(db);
      return json(res, 200, { success: true });
    }
    const user = session(req);
    if (url.pathname.startsWith('/api/') && !user) return json(res, 401, { error: 'Autenticación requerida' });
    if (req.method === 'GET' && url.pathname === '/api/auth/me') { const account = readDb().User.find((u) => u.id === user.id); return account ? json(res, 200, publicUser(account)) : json(res, 401, { error: 'Sesión no válida' }); }
    const entity = url.pathname.match(/^\/api\/entities\/([^/]+)\/([^/]+)$/);
    if (req.method === 'POST' && entity) return entityApi(req, res, user, ...entity.slice(1));
    const fn = url.pathname.match(/^\/api\/functions\/([^/]+)$/);
    if (req.method === 'POST' && fn) return functionsApi(req, res, user, fn[1]);
    const file = path.join(root, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file);
    if (fs.existsSync(path.join(root, 'dist', 'index.html'))) return sendFile(res, path.join(root, 'dist', 'index.html'));
    return json(res, 404, { error: 'Compila la app con npm run build antes de iniciar el servidor.' });
  } catch (error) { json(res, error.status || 500, { error: error.message || 'Error interno' }); }
});
server.listen(port, () => console.log(`MIRAT independiente en http://localhost:${port}`));
