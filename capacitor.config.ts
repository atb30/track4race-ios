import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.track4race.viewer',
  appName: 'track4race',
  webDir: 'dist',
  ios: {
    // La pantalla de navegación se desplaza internamente cuando hace falta,
    // pero el WebView no rebota ni desplaza toda la app en el iPad.
    scrollEnabled: false,
    contentInset: 'always',
  },
  server: {
    // El bundle es local (webDir); solo permitimos navegación saliente hacia el
    // dominio de producción por si algún enlace externo lo necesita.
    allowNavigation: ['track4race.com', '*.track4race.com'],
  },
};

export default config;
