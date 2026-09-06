import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Mapeo del ID de OpenWeather a la intensidad de la lluvia
const getRainIntensity = (weatherId) => {
  if (!weatherId) return 'desconocida';
  
  const id = Number(weatherId);
  
  if (id >= 200 && id < 300) return 'tormenta'; // Thunderstorm
  if (id >= 300 && id < 400) return 'débil';    // Drizzle
  if (id === 500) return 'débil';             // Light rain
  if (id === 501) return 'moderada';          // Moderate rain
  if (id >= 502 && id <= 504) return 'fuerte'; // Heavy intensity rain
  if (id === 511) return 'helada';            // Freezing rain
  if (id >= 520 && id <= 531) return 'chubascos'; // Shower rain
  if (id >= 600 && id < 700) return 'nieve';     // Snow
  
  // Si no es ninguno de los anteriores, pero está en el rango de lluvia
  if (id >= 500 && id < 600) return 'ligera';
  
  return 'desconocida';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { latitude, longitude } = await req.json();
    
    if (!latitude || !longitude) {
      return new Response(JSON.stringify({ error: 'Latitude and longitude are required' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // Usar el endpoint de pronóstico de 5 días / 3 horas (gratuito). 
    // Pedimos solo `cnt=2` para tener datos actuales y del próximo periodo.
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=es&cnt=2`;
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      return new Response(JSON.stringify({ error: 'Error from OpenWeather API', details: `Status: ${weatherResponse.status}, Body: ${errorText}` }), { status: weatherResponse.status, headers: { "Content-Type": "application/json" } });
    }
    
    const weatherData = await weatherResponse.json();

    if (!weatherData.list || weatherData.list.length === 0) {
       return new Response(JSON.stringify({ error: 'No forecast data available from API' }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // Usamos el primer elemento para los datos de viento y el segundo para el pronóstico de lluvia
    const currentForecast = weatherData.list[0];
    const nextForecast = weatherData.list.length > 1 ? weatherData.list[1] : weatherData.list[0];

    // Procesar datos de viento (del periodo actual)
    const windInfo = {
      speedKmh: Math.round((currentForecast.wind?.speed || 0) * 3.6),
      direction: currentForecast.wind?.deg || 0,
    };

    // Procesar pronóstico de lluvia (del próximo periodo de 3h)
    const rainInfo = {
      probability: Math.round((nextForecast.pop || 0) * 100),
      intensity: getRainIntensity(nextForecast.weather?.[0]?.id),
    };

    const response = { 
      success: true, 
      data: {
        wind: windInfo,
        rain: rainInfo
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});