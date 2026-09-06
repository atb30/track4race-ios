import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
        
        if (!apiKey) {
            return Response.json({ 
                error: 'OpenWeather API key not configured' 
            }, { status: 500 });
        }

        return Response.json({ apiKey });
        
    } catch (error) {
        return Response.json({ 
            error: error.message || 'Unknown error' 
        }, { status: 500 });
    }
});