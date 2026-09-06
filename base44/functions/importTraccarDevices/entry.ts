import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const traccarUrl = Deno.env.get("TRACCAR_URL");
        const traccarUser = Deno.env.get("TRACCAR_USER");
        const traccarPassword = Deno.env.get("TRACCAR_PASSWORD");

        if (!traccarUrl || !traccarUser || !traccarPassword) {
            return Response.json({ error: 'Traccar credentials not configured' }, { status: 400 });
        }

        // Clean up URL - remove trailing slashes and common path suffixes
        let cleanUrl = traccarUrl.replace(/\/+$/, ''); // Remove trailing slashes
        cleanUrl = cleanUrl.replace(/\/login\/?$/, ''); // Remove /login suffix if present
        cleanUrl = cleanUrl.replace(/\/api\/?$/, ''); // Remove /api suffix if present
        
        console.log('Original Traccar URL:', traccarUrl);
        console.log('Cleaned Traccar URL:', cleanUrl);
        
        // Authenticate with proper headers
        const credentials = new URLSearchParams({ email: traccarUser, password: traccarPassword });
        const authResponse = await fetch(`${cleanUrl}/api/session`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'Base44-Traccar-Client/1.0'
            },
            body: credentials,
            signal: AbortSignal.timeout(15000)
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('Traccar auth failed:', authResponse.status, errorText);
            return Response.json({ 
                error: `Failed to authenticate with Traccar: ${authResponse.status} - ${errorText}` 
            }, { status: 401 });
        }
        const sessionCookie = authResponse.headers.get('Set-Cookie');
        
        if (!sessionCookie) {
            return Response.json({ error: 'No session cookie received from Traccar' }, { status: 401 });
        }

        // Fetch devices from Traccar
        const devicesResponse = await fetch(`${cleanUrl}/api/devices`, { 
            headers: { 
                'Cookie': sessionCookie,
                'Accept': 'application/json',
                'User-Agent': 'Base44-Traccar-Client/1.0'
            },
            signal: AbortSignal.timeout(15000)
        });
        if (!devicesResponse.ok) {
            return Response.json({ error: 'Failed to fetch devices from Traccar' }, { status: 500 });
        }
        const traccarDevices = await devicesResponse.json();

        // Get existing app data
        const existingAppDevices = await base44.entities.GpsDevice.list();
        const existingTeams = await base44.entities.Team.list();
        const existingImeis = new Set(existingAppDevices.map(d => d.device_imei));

        // Ensure default team exists
        let defaultTeam = existingTeams.find(team => team.name === 'Equipo Importado Traccar');
        if (!defaultTeam) {
            defaultTeam = await base44.entities.Team.create({
                name: 'Equipo Importado Traccar',
                description: 'Equipo creado para dispositivos importados de Traccar',
                color: '#2563eb',
                is_active: true,
            });
        }

        const results = [];
        let createdCount = 0;

        for (const traccarDevice of traccarDevices) {
            const imei = traccarDevice.uniqueId;
            if (!imei) continue;

            if (existingImeis.has(imei)) {
                results.push({ device: imei, name: traccarDevice.name, status: 'skipped', message: 'Dispositivo ya existe.' });
            } else {
                const runnerName = `Corredor ${traccarDevice.name}`;
                const newRunner = await base44.entities.Runner.create({
                    name: runnerName,
                    device_id: imei,
                    team_id: defaultTeam.id,
                    is_active: true,
                });

                await base44.entities.GpsDevice.create({
                    device_imei: imei,
                    device_name: traccarDevice.name,
                    runner_id: newRunner.id,
                    team_id: defaultTeam.id,
                    report_interval: 30,
                    is_active: true,
                    configuration_status: 'configured',
                });
                createdCount++;
                results.push({ device: imei, name: traccarDevice.name, status: 'created', message: 'Dispositivo y corredor creados.' });
            }
        }
        
        return Response.json({
            message: `Sincronización completada: ${createdCount} nuevos dispositivos importados.`,
            results: results,
        });

    } catch (error) {
        console.error("Error importing Traccar devices:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});