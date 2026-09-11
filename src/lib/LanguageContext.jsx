import React, { createContext, useContext, useMemo, useState } from 'react';

const translations = {
  es: { addPoi: 'Añadir POI', goStart: 'Ir a Salida', goFinish: 'Ir a Meta', noRoute: 'Sin ruta activa', onRoute: 'En ruta', offRoute: 'Fuera', language: 'Idioma', spanish: 'Español', english: 'English', routes: 'Biblioteca de Rutas', upload: 'Subir Ruta', backNavigation: 'Volver a Navegación', available: 'rutas disponibles', noSaved: 'No tienes rutas guardadas', firstGpx: 'Subir Primera Ruta' },
  en: { addPoi: 'Add POI', goStart: 'Go to start', goFinish: 'Go to finish', noRoute: 'No active route', onRoute: 'On route', offRoute: 'Off route', language: 'Language', spanish: 'Español', english: 'English', routes: 'Route Library', upload: 'Upload Route', backNavigation: 'Back to Navigation', available: 'routes available', noSaved: 'No saved routes', firstGpx: 'Upload First Route' },
};

function detectLanguage() {
  const saved = localStorage.getItem('track4race_language');
  if (saved === 'es' || saved === 'en') return saved;
  const locale = `${navigator.language || ''} ${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`.toLowerCase();
  return locale.includes('es') || locale.includes('madrid') || locale.includes('canary') ? 'es' : null;
}

const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectLanguage);
  const [needsChoice, setNeedsChoice] = useState(() => !detectLanguage());
  const setLanguage = (next) => { setLanguageState(next); setNeedsChoice(false); localStorage.setItem('track4race_language', next); };
  const value = useMemo(() => ({ language, needsChoice, setLanguage, t: translations[language || 'es'] }), [language, needsChoice]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
