import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.track4race.viewer',
  appName: 'track4race',
  webDir: 'dist',
  ios: {
    // Evita el "rebote" del WebView al hacer scroll/pan del mapa: se siente más nativo.
    scrollEnabled: true,
    contentInset: 'always',
  },
  server: {
    // El bundle es local (webDir); solo permitimos navegación saliente hacia el
    // dominio de producción por si algún enlace externo lo necesita.
    allowNavigation: ['track4race.com', '*.track4race.com'],
  },
};

export default config;
