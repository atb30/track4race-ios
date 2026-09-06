// Base URL para las llamadas a la API. En la web normal (VITE_API_BASE_URL sin
// definir) queda vacío y las rutas siguen siendo relativas, igual que hoy.
// En el build de la app iOS, el workflow de GitHub Actions define
// VITE_API_BASE_URL=https://track4race.com para que el bundle empaquetado
// (que ya no se sirve desde ese origen) llame a la API real de producción.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
