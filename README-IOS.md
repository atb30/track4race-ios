# Track&Race — app iOS/iPad

Wrapper nativo con [Capacitor](https://capacitorjs.com/) de esta misma web
(Track&Race), pensado para un **iPad fijo que visualiza el mapa en vivo** de
corredores. Se compila exclusivamente con GitHub Actions (runner macOS)
porque no requiere tener Xcode ni un Mac en local — ni para compilar ni,
más adelante, para subir la app a TestFlight.

## Qué se añadió sobre el proyecto web existente

- `capacitor.config.ts`: configuración de Capacitor (`appId: com.track4race.viewer`,
  `webDir: dist`, es decir el mismo build que ya genera `npm run build`).
- `resources/icon.png`: icono fuente 1024×1024 (generado a partir de
  `public/iconoapp.png`, con fondo blanco y reescalado) usado para crear
  todos los tamaños de icono de iOS.
- `.github/workflows/ios-build.yml`: el workflow que compila la app.
- Dependencias de Capacitor añadidas a `package.json` (`@capacitor/core`,
  `@capacitor/ios`, `@capacitor/cli`, `@capacitor/assets`).
- `src/lib/api-base.js`, y cambios mínimos en `src/api/base44Client.js` y
  `src/entities/all.js`: las llamadas a la API usan ahora una URL base
  configurable (`VITE_API_BASE_URL`). Sin definir esa variable (build web
  normal) el comportamiento es idéntico a hoy; el workflow de iOS la define
  como `https://track4race.com` para que el bundle empaquetado en el iPad
  llame a la API real.
- `server/index.mjs`: cabeceras CORS, necesarias porque la app iOS carga el
  bundle desde el esquema `capacitor://localhost` (otro origen que el
  servidor no reconocía). **Este archivo hay que desplegarlo en el VPS** con
  vuestro flujo habitual (`docker compose up -d --build`) para que el login
  funcione desde la app — sin este cambio la app compila e instala bien,
  pero falla al iniciar sesión por CORS.

`ios/` no se versiona (está en `.gitignore`): el workflow lo genera de cero
en cada build con `npx cap add ios`, así siempre usa la versión de
Xcode/Capacitor del runner en vez de un proyecto Xcode generado a mano.

## Primer build (sin cuenta de Apple Developer)

Con solo hacer push a `main` (o lanzar el workflow manualmente desde la
pestaña **Actions** de GitHub), el job:

1. Compila la web con `VITE_API_BASE_URL=https://track4race.com`.
2. Genera el proyecto iOS y los iconos.
3. Compila para el **Simulador** (no requiere firma).
4. Arranca un simulador de iPad dentro del propio runner, instala la app,
   hace una captura de pantalla y la sube como artefacto del workflow
   (`ios-simulator-build`) — así puedes comprobar visualmente que arranca
   aunque no tengas un Mac para abrir el Simulador tú mismo.

## Pasar a TestFlight (cuando tengas cuenta de Apple Developer)

1. Date de alta en <https://developer.apple.com/programs/> (99$/año).
2. En [App Store Connect](https://appstoreconnect.apple.com/), crea la app
   con el bundle ID `com.track4race.viewer`.
3. Genera un **certificado de distribución** (Apple Distribution) desde
   Certificates, Identifiers & Profiles y expórtalo como `.p12` (con
   contraseña) — si no tienes Mac, puedes generar el CSR en Windows con
   OpenSSL, o pedir ayuda puntual a alguien con Mac solo para este trámite
   único.
4. Crea un **perfil de aprovisionamiento** tipo App Store para ese bundle ID
   y descárgalo (`.mobileprovision`).
5. Crea una **clave de API de App Store Connect** (Users and Access → Keys)
   con rol "App Manager" y descarga el `.p8`.
6. En el repo de GitHub, ve a **Settings → Secrets and variables → Actions**
   y añade:

   | Secreto | Contenido |
   |---|---|
   | `BUILD_CERTIFICATE_BASE64` | `base64` del `.p12` |
   | `P12_PASSWORD` | contraseña con la que exportaste el `.p12` |
   | `BUILD_PROVISION_PROFILE_BASE64` | `base64` del `.mobileprovision` |
   | `KEYCHAIN_PASSWORD` | cualquier contraseña nueva, solo se usa dentro del runner |
   | `TEAM_ID` | tu Team ID de Apple Developer (10 caracteres) |
   | `APPSTORE_API_KEY_ID` | Key ID de la clave de App Store Connect |
   | `APPSTORE_API_ISSUER_ID` | Issuer ID de esa clave |
   | `APPSTORE_API_PRIVATE_KEY` | contenido completo del `.p8` |

   Para convertir un archivo a base64 en Windows (PowerShell):
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("archivo")) | Set-Clipboard`

7. En cuanto exista `BUILD_CERTIFICATE_BASE64`, el mismo workflow cambia
   automáticamente de rama: en vez de compilar para el Simulador, firma,
   archiva y sube el `.ipa` a TestFlight. Un rato después llega el aviso en
   App Store Connect / TestFlight y puedes instalarla en el iPad desde la
   app **TestFlight**, sin necesitar un Mac en ningún momento.

## Notas

- El bundle ID es `com.track4race.viewer`; cámbialo en `capacitor.config.ts`
  antes del primer `cap add ios` si prefieres otro.
- El icono se generó a partir de `public/iconoapp.png` (512×512, con fondo
  blanco añadido y escalado a 1024×1024). Si tienes una versión de mayor
  resolución del logo, sustituye `resources/icon.png` por una mejor.
- El proyecto tiene tanto `package-lock.json` como `pnpm-lock.yaml`; el
  workflow usa `npm install` (no `npm ci`) porque el `package.json` cambió al
  añadir las dependencias de Capacitor y el lockfile de npm no está
  actualizado todavía.
