import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Route, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/lib/LanguageContext';

export default function NavigationLoadingScreen({ stage = 'checking', error, onRetry, overlay = false }) {
  const empty = stage === 'empty';
  const { language } = useLanguage(); const en = language === 'en';
  const failed = Boolean(error);
  const loading = !empty && !failed;
  return (
    <div className={`${overlay ? 'fixed inset-0 z-[10000]' : 'min-h-screen'} bg-slate-100 flex items-center justify-center p-5`} aria-busy={loading}>
      <section className="w-full max-w-md rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-xl text-center" aria-label="Preparación de la navegación">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <span className="text-lg font-semibold tracking-widest">TRACK<span className="text-cyan-400">4</span>RACE</span>
        </div>
        <div className="px-6 py-8 sm:px-8">
          <img src="/track4race.png" alt="Track4Race" className="h-28 w-full object-contain mb-7" />
          <div role={failed ? 'alert' : 'status'} aria-live="polite">
            {loading ? <Loader2 className="h-9 w-9 text-blue-600 mx-auto mb-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : empty ? <Route className="h-9 w-9 text-blue-600 mx-auto mb-5" aria-hidden="true" /> : <AlertCircle className="h-9 w-9 text-amber-600 mx-auto mb-5" aria-hidden="true" />}
            <h1 className="text-xl font-semibold text-slate-900 mb-3">{failed ? (en ? 'Navigation could not be prepared' : 'No se ha podido preparar la navegación') : empty ? (en ? 'No active routes' : 'No hay rutas activas') : stage === 'checking' ? (en ? 'Checking your routes' : 'Comprobando tus rutas') : (en ? 'Preparing the map' : 'Preparando el mapa')}</h1>
            <p className="text-sm text-slate-600">{error || (empty ? (en ? 'Open the library and activate a route to start navigation.' : 'Abre la biblioteca y activa una ruta para comenzar la navegación.') : stage === 'checking' ? (en ? 'Checking whether an active route is available.' : 'Estamos comprobando si hay una ruta activa para navegar.') : (en ? 'Loading the map and your route. You will enter automatically when it is ready.' : 'Cargando el mapa y el trazado de tu ruta. Entrarás automáticamente cuando esté listo.'))}</p>
          </div>
          {loading && <div className="mt-6 text-left space-y-3 text-sm text-slate-600"><div className="flex items-center gap-2">{stage === 'map' ? <Check className="w-4 h-4 text-blue-600" /> : <span className="w-4 h-4 rounded-full border-2 border-blue-600" />}{en ? 'Check active route' : 'Comprobar ruta activa'}</div><div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-slate-300" />{en ? 'Show map and track' : 'Mostrar mapa y trazado'}</div></div>}
          {!loading && <div className="mt-6 flex flex-col gap-3">{failed && <Button onClick={onRetry}>{en ? 'Try again' : 'Volver a intentar'}</Button>}<Button asChild variant={failed ? 'outline' : 'default'}><Link to={createPageUrl('Routes')}><Route className="mr-2 h-4 w-4" />{en ? 'Go to route library' : 'Ir a la biblioteca de rutas'}</Link></Button></div>}
        </div>
      </section>
    </div>
  );
}
