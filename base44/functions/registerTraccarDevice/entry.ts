import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const cleanBaseUrl = (value: string) => value.replace(/\/+$/, '').replace(/\/login\/?$/, '').replace(/\/api\/?$/, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { uniqueId, name, category = 'gps' } = await req.json();
    if (!uniqueId) return Response.json({ error: 'uniqueId is required' }, { status: 400 });

    const traccarUrl = Deno.env.get('TRACCAR_URL');
    const traccarUser = Deno.env.get('TRACCAR_USER');
    const traccarPassword = Deno.env.get('TRACCAR_PASSWORD');
    if (!traccarUrl || !traccarUser || !traccarPassword) {
      return Response.json({ error: 'Traccar credentials not configured' }, { status: 400 });
    }

    const baseUrl = cleanBaseUrl(traccarUrl);
    const auth = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ email: traccarUser, password: traccarPassword }),
      signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) return Response.json({ error: `Traccar authentication failed (${auth.status})` }, { status: 502 });
    const cookie = auth.headers.get('set-cookie');
    if (!cookie) return Response.json({ error: 'Traccar did not return a session cookie' }, { status: 502 });

    const headers = { Cookie: cookie, Accept: 'application/json', 'Content-Type': 'application/json' };
    const devicesResponse = await fetch(`${baseUrl}/api/devices`, { headers, signal: AbortSignal.timeout(15000) });
    if (!devicesResponse.ok) return Response.json({ error: `Unable to read Traccar devices (${devicesResponse.status})` }, { status: 502 });
    const devices = await devicesResponse.json();
    const existing = devices.find((device: any) => String(device.uniqueId).trim() === String(uniqueId).trim());
    if (existing) return Response.json({ created: false, device: existing });

    const createResponse = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: name || uniqueId, uniqueId, category }),
      signal: AbortSignal.timeout(15000),
    });
    if (!createResponse.ok) {
      const detail = await createResponse.text();
      return Response.json({ error: `Unable to create Traccar device (${createResponse.status})`, detail }, { status: 502 });
    }
    return Response.json({ created: true, device: await createResponse.json() });
  } catch (error) {
    console.error('Error registering Traccar device:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
});
