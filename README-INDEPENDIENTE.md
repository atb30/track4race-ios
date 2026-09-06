# Track&Race independiente

Esta versión no usa el SDK, el plugin ni las funciones de Base44. Incluye un servidor Node propio, autenticación por sesión firmada y almacenamiento local en `data/db.json`.

## Arranque local

1. Copia `.env.example` a `.env` y completa el administrador inicial y `SESSION_SECRET`.
2. Ejecuta `npm install` (o `pnpm install`).
3. En dos terminales: `npm run dev` y `npm start`.
4. Abre la dirección indicada por Vite e inicia sesión.

Para producción, ejecuta `npm run build` y después `npm start`.

## Instalación en VPS con Docker

1. Instala Docker y el complemento Docker Compose en el VPS; copia allí esta carpeta.
2. Crea `.env` desde `.env.example`, usando una contraseña de administrador y un `SESSION_SECRET` largos y únicos.
3. Desde la carpeta del proyecto ejecuta `docker compose up -d --build`.
4. Comprueba su estado con `docker compose ps` y `curl http://127.0.0.1:3001/health`. El puerto queda limitado al propio VPS por seguridad.

Los datos se guardan en el volumen Docker `mirat_data`, por lo que permanecen al actualizar o recrear el contenedor. Antes de actualizar, crea una copia: `docker compose exec mirat cat /app/data/db.json > backup-mirat.json`.

Para exponerla públicamente con HTTPS, coloca Caddy, Nginx Proxy Manager o un proxy equivalente delante del puerto 3001; no publiques el puerto sin TLS si vas a usarla fuera de tu red.

## Datos existentes

El ZIP de Base44 contiene el esquema, no los registros. Exporta User, GpxTrack, Team, Runner, GpsDevice, Poi, PoiType, AppConfig, LiveLocation y RunnerLocation. Copia los registros a `data/db.json`, conservando sus `id` para mantener relaciones. Haz una copia de seguridad antes.

## Integraciones

Las claves de Traccar, Google, Mapbox y OpenWeather no se transfieren desde Base44. Configúralas como secretos de entorno antes de publicar. Las funciones de OpenWeather ya usan secretos; las demás requieren migrar sus credenciales y endpoints. La carpeta `base44/` se conserva únicamente como referencia del esquema y de las funciones originales; no se carga ni se despliega. Los logotipos e iconos pequeños se guardan como datos locales; para fotos o GPX grandes conviene conectar almacenamiento S3/R2.
