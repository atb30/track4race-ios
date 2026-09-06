import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to get battery level from various possible attribute keys
const getBatteryLevel = (attributes) => {
    if (!attributes) return null;
    const keys = ['batteryLevel', 'battery', 'power.battery.level', 'battery.level'];
    for (const key of keys) {
        if (attributes[key] !== undefined && attributes[key] !== null) {
            return parseFloat(attributes[key]);
        }
    }
    return null;
};

// Main function
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("=== TRACCAR CONNECTION DEBUG ===");
        
        const traccarUrl = Deno.env.get("TRACCAR_URL");
        const traccarUser = Deno.env.get("TRACCAR_USER");
        const traccarPassword = Deno.env.get("TRACCAR_PASSWORD");

        if (!traccarUrl || !traccarUser || !traccarPassword) {
            console.log("Traccar credentials not configured, returning empty data");
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: "Credenciales de Traccar no configuradas"
                }
            });
        }

        // Clean up URL - remove trailing slashes and common path suffixes
        let cleanUrl = traccarUrl.replace(/\/+$/, ''); // Remove trailing slashes
        cleanUrl = cleanUrl.replace(/\/login\/?$/, ''); // Remove /login suffix if present
        cleanUrl = cleanUrl.replace(/\/api\/?$/, ''); // Remove /api suffix if present
        
        console.log("Original Traccar URL:", traccarUrl);
        console.log("Cleaned Traccar URL:", cleanUrl);
        console.log("Traccar User:", traccarUser);

        // Test basic connectivity first with shorter timeout
        try {
            console.log("Testing basic connectivity...");
            const testResponse = await fetch(`${cleanUrl}/api/server`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Base44-Traccar-Client/1.0'
                },
                signal: AbortSignal.timeout(10000) // Reduced to 10 seconds
            });
            
            if (!testResponse.ok) {
                throw new Error(`Server responded with ${testResponse.status}: ${testResponse.statusText}`);
            }
            
            const serverInfo = await testResponse.json();
            console.log("Server info:", serverInfo);
        } catch (testError) {
            console.error("Basic connectivity test failed:", testError);
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: `No se puede conectar al servidor Traccar: ${testError.message}`
                }
            });
        }

        // Try authentication with retry logic
        console.log("Attempting authentication...");
        const credentials = new URLSearchParams({ 
            email: traccarUser, 
            password: traccarPassword 
        });

        let authResponse;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                console.log(`Authentication attempt ${retryCount + 1}`);
                authResponse = await fetch(`${cleanUrl}/api/session`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                        'User-Agent': 'Base44-Traccar-Client/1.0'
                    },
                    body: credentials,
                    signal: AbortSignal.timeout(15000) // 15 seconds timeout
                });
                
                if (authResponse.ok) {
                    break; // Success, exit retry loop
                } else {
                    throw new Error(`Auth failed with status ${authResponse.status}`);
                }
            } catch (authError) {
                console.error(`Authentication attempt ${retryCount + 1} failed:`, authError.message);
                retryCount++;
                
                if (retryCount > maxRetries) {
                    return Response.json({ 
                        data: [], 
                        summary: {
                            total_traccar_devices: 0,
                            matched_app_devices: 0,
                            onlineDevices: 0,
                            devices_with_fresh_positions: 0,
                            error: `Error de autenticación con Traccar después de ${maxRetries + 1} intentos: ${authError.message}`
                        }
                    });
                }
                
                // Wait 2 seconds before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const sessionCookie = authResponse.headers.get('Set-Cookie');
        if (!sessionCookie) {
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: "No se pudo obtener cookie de sesión de Traccar"
                }
            });
        }
        console.log("Authentication successful, got session cookie");

        // Fetch data with proper error handling
        let devicesResponse, positionsResponse;
        
        try {
            console.log("Fetching devices and positions...");
            [devicesResponse, positionsResponse] = await Promise.all([
                fetch(`${cleanUrl}/api/devices`, { 
                    headers: { 
                        'Cookie': sessionCookie,
                        'Accept': 'application/json',
                        'User-Agent': 'Base44-Traccar-Client/1.0'
                    },
                    signal: AbortSignal.timeout(15000) // 15 seconds
                }),
                fetch(`${cleanUrl}/api/positions`, { 
                    headers: { 
                        'Cookie': sessionCookie,
                        'Accept': 'application/json',
                        'User-Agent': 'Base44-Traccar-Client/1.0'
                    },
                    signal: AbortSignal.timeout(15000) // 15 seconds
                }),
            ]);
        } catch (fetchError) {
            console.error("Data fetch failed:", fetchError);
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: `Error obteniendo datos de Traccar: ${fetchError.message}`
                }
            });
        }

        if (!devicesResponse.ok) {
            const errorText = await devicesResponse.text();
            console.error("Devices fetch failed:", devicesResponse.status, errorText);
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: `Error obteniendo dispositivos: ${devicesResponse.status} - ${errorText}`
                }
            });
        }

        if (!positionsResponse.ok) {
            const errorText = await positionsResponse.text();
            console.error("Positions fetch failed:", positionsResponse.status, errorText);
            return Response.json({ 
                data: [], 
                summary: {
                    total_traccar_devices: 0,
                    matched_app_devices: 0,
                    onlineDevices: 0,
                    devices_with_fresh_positions: 0,
                    error: `Error obteniendo posiciones: ${positionsResponse.status} - ${errorText}`
                }
            });
        }

        const traccarDevices = await devicesResponse.json();
        const traccarPositions = await positionsResponse.json();

        console.log(`Fetched ${traccarDevices.length} devices and ${traccarPositions.length} positions`);

        // Fetch app data from Base44
        const [appDevices, runners, teams] = await Promise.all([
            base44.entities.GpsDevice.list(),
            base44.entities.Runner.list(),
            base44.entities.Team.list()
        ]);

        // Create maps for efficient lookups
        const imeiToAppDevice = new Map(appDevices.map(d => [d.device_imei, d]));
        const traccarIdToDevice = new Map(traccarDevices.map(d => [d.id, d]));
        const runnerIdToRunner = new Map(runners.map(r => [r.id, r]));
        const teamIdToTeam = new Map(teams.map(t => [t.id, t]));

        console.log("Processing data...");
        console.log("App devices:", appDevices.length);
        console.log("Runners:", runners.length);
        console.log("Teams:", teams.length);

        // Process and combine data
        const runnersData = traccarPositions.map(pos => {
            const traccarDevice = traccarIdToDevice.get(pos.deviceId);
            if (!traccarDevice) return null;

            const appDevice = imeiToAppDevice.get(traccarDevice.uniqueId);
            if (!appDevice) return null;

            const runner = runnerIdToRunner.get(appDevice.runner_id);
            const team = teamIdToTeam.get(runner?.team_id);
            
            const speedInKmh = pos.speed * 1.852; // Convert knots to km/h
            const lastUpdate = pos.fixTime || pos.deviceTime || pos.serverTime;
            
            return {
                id: appDevice.id,
                user_name: runner?.name, // This is the runner's name from Base44
                device_name: traccarDevice.name, // This now comes directly from Traccar
                latitude: pos.latitude,
                longitude: pos.longitude,
                speed: speedInKmh,
                elevation: pos.altitude,
                last_update: lastUpdate,
                team_id: team?.id || 'unassigned',
                team_name: team?.name || 'Sin Equipo',
                color: appDevice?.color || team?.color || '#3b82f6', // Prioritize device color
                device_imei: traccarDevice.uniqueId,
                is_online: traccarDevice.status === 'online',
                battery_level: getBatteryLevel(pos.attributes),
                has_fresh_position: (new Date() - new Date(lastUpdate)) < (10 * 60 * 1000), // less than 10 mins old
            };
        }).filter(Boolean); // Remove null entries

        const summary = {
            total_traccar_devices: traccarDevices.length,
            matched_app_devices: runnersData.length,
            onlineDevices: runnersData.filter(r => r.is_online).length,
            devices_with_fresh_positions: runnersData.filter(r => r.has_fresh_position).length,
        };

        console.log("Summary:", summary);
        console.log("Final runners data:", runnersData.length);

        return Response.json({ data: runnersData, summary: summary });

    } catch (error) {
        console.error("Unexpected error in getTraccarData:", error);
        return Response.json({ 
            data: [], 
            summary: {
                total_traccar_devices: 0,
                matched_app_devices: 0,
                onlineDevices: 0,
                devices_with_fresh_positions: 0,
                error: `Error inesperado: ${error.message}`
            }
        });
    }
});