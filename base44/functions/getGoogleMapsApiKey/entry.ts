import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    console.log("🔑 getGoogleMapsApiKey function called");
    
    // Autenticación para asegurar que solo usuarios logueados pueden pedir la clave
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      console.log("❌ User not authenticated");
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("✅ User authenticated:", user.email);

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      console.error("❌ GOOGLE_MAPS_API_KEY no está configurada en los secretos.");
      return new Response(JSON.stringify({ 
        error: 'API key not configured',
        success: false 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("✅ API key found, sending response");

    return new Response(JSON.stringify({ 
      apiKey: apiKey,
      success: true 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Error en getGoogleMapsApiKey:", error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});