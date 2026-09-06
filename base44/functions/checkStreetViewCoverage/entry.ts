import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { latitude, longitude } = await req.json();
    
    if (!latitude || !longitude) {
      return new Response(JSON.stringify({ error: 'Latitude and longitude are required' }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // Use Street View Static API metadata endpoint to check coverage
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latitude},${longitude}&key=${apiKey}&radius=50`;
    
    const response = await fetch(streetViewUrl);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: 'Google API error', 
        details: `Status: ${response.status}` 
      }), { 
        status: response.status, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    const data = await response.json();

    const hasStreetView = data.status === 'OK';
    const actualLocation = hasStreetView ? data.location : null;

    return new Response(JSON.stringify({ 
      success: true,
      hasStreetView,
      actualLocation, // The actual location where Street View is available (may be slightly different)
      status: data.status
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});