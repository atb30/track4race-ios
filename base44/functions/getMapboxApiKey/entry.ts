import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get("MAPBOX_API_KEY");
    
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        error: 'Mapbox API key not configured' 
      }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      apiKey: apiKey 
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
});