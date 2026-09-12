import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Mountain, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { buildClimbProfiles, routePositionAt } from './climbProfile.mjs';
import { getStreetViewMetadata } from '@/functions/getStreetViewMetadata';
import { useLanguage } from '@/lib/LanguageContext';

const format = (value, digits = 1) => value.toLocaleString('es-ES', { maximumFractionDigits: digits });

class ClimbErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Climb explorer failed:', error); }
  render() {
    if (this.state.failed) return <Button variant="outline" className="bg-white text-blue-700" onClick={() => this.setState({ failed: false })} title="Viewer could not open. Tap to retry. / No se pudo abrir el visor. Pulsa para reintentar.">Retry climbs / Reintentar subidas</Button>;
    return this.props.children;
  }
}

export default function ClimbExplorer(props) {
  return <ClimbErrorBoundary><ClimbExplorerContent {...props} /></ClimbErrorBoundary>;
}

function ClimbExplorerContent({ track, googleApiKey }) {
  const { language } = useLanguage(); const en = language === 'en';
  const [open, setOpen] = useState(false);
  // Never process GPX data while the map is starting and the window is closed.
  const climbs = useMemo(() => open ? buildClimbProfiles(track) : [], [track, open]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = climbs.find(c => c.id === selectedId) || climbs[0];
  const chartBox = useRef(null);
  const requestId = useRef(0);
  const [street, setStreet] = useState(null);
  const [chartWidth, setChartWidth] = useState(680);
  const selectedIndex = Math.max(0, climbs.findIndex(c => c.id === selected?.id));
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (chartBox.current) observer.observe(chartBox.current);
    });
    const observer = new ResizeObserver(entries => setChartWidth(entries[0].contentRect.width));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [open]);
  useEffect(() => { requestId.current += 1; setStreet(null); return () => { requestId.current += 1; }; }, [selectedId, open]);

  const openAtDistance = async km => {
    const id = ++requestId.current;
    const point = routePositionAt(track, selected.start + km);
    if (!point) { setStreet({ km, error: 'No hay coordenadas válidas para ese punto del perfil.' }); return; }
    if (!googleApiKey) { setStreet({ km, error: 'Street View no está disponible: falta la configuración de Google Maps.' }); return; }
    setStreet({ km, loading: true });
    try {
      const result = await getStreetViewMetadata({ latitude: point.lat, longitude: point.lng });
      if (id !== requestId.current) return;
      setStreet(result.available && result.panoId ? { km, panoId: result.panoId } : { km, error: 'Google no tiene una vista disponible en este punto. Prueba otro punto del perfil.' });
    } catch {
      if (id === requestId.current) setStreet({ km, error: 'No se pudo consultar Street View. Vuelve a pulsar el perfil para reintentar.' });
    }
  };
  const selectChartPoint = state => {
    const width = chartBox.current?.clientWidth;
    const x = state?.chartX;
    // Exact distance under the pointer, including between downsampled GPX points.
    if (!width || !Number.isFinite(x) || x < 70 || x > width - 14) return;
    openAtDistance((x - 70) / (width - 84) * selected.length);
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="h-11 w-11 rounded-full bg-white text-blue-700 border-blue-200 shadow-lg hover:bg-blue-50" aria-label="Ver subidas del track" title="Subidas del track">
          <Mountain className="w-5 h-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/40 z-[6000]" />
        <Dialog.Content style={{ scrollbarWidth: 'none' }} className="fixed z-[6001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_16px)] max-w-6xl max-h-[94dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl bg-white shadow-2xl border border-slate-200 [&::-webkit-scrollbar]:hidden">
          <header className="bg-slate-900 text-white px-5 py-4 pr-16 relative">
          <Dialog.Title className="text-lg font-semibold flex gap-2 items-center"><Mountain className="text-cyan-400 w-5 h-5" />{en ? 'Track climbs' : 'Subidas del track'}</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-200 mt-1">{en ? 'Select a climb to view its profile and gradients.' : 'Selecciona una subida para consultar su perfil y pendientes.'}</Dialog.Description>
            <Dialog.Close asChild><button className="absolute right-2 top-2 w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-700" aria-label="Cerrar subidas"><X className="w-5 h-5" /></button></Dialog.Close>
          </header>
          {!selected ? <p className="p-6 text-slate-600">{en ? 'This track has no climbs identified with valid elevation data.' : 'Este track no tiene subidas identificadas con datos de elevación válidos.'}</p> : (
            <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
              <div className="space-y-3 min-w-0 md:pr-3 md:border-r border-slate-200" role="group" aria-label="Elegir subida">
                <label className="block text-sm font-semibold text-slate-800">{en ? 'Climb' : 'Subida'} {selectedIndex + 1} {en ? 'of' : 'de'} {climbs.length}
                  <select value={selected.id} onChange={e => setSelectedId(e.target.value)} className="block w-full min-h-12 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-base mt-2 px-2">
                    {climbs.map(c => <option key={c.id} value={c.id}>{en ? 'Climb' : 'Subida'} {c.number} · {format(c.length, 2)} km · {format(c.grade)}% {en ? 'average' : 'de media'}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="min-h-12 px-2" disabled={selectedIndex === 0} onClick={() => setSelectedId(climbs[selectedIndex - 1].id)}>{en ? 'Previous' : 'Anterior'}</Button>
                  <Button variant="outline" className="min-h-12 px-2" disabled={selectedIndex === climbs.length - 1} onClick={() => setSelectedId(climbs[selectedIndex + 1].id)}>{en ? 'Next' : 'Siguiente'}</Button>
                </div>
                <p className="text-sm text-slate-600">{en ? 'From km' : 'Del km'} {format(selected.start, 2)} {en ? 'to' : 'al'} {format(selected.end, 2)}</p>
              </div>
              <section className="min-w-0" aria-live="polite" aria-label="Perfil de la subida seleccionada">
                <h3 className="font-semibold text-slate-900">{en ? 'Climb' : 'Subida'} {selected.number} · {format(selected.length, 2)} km · {format(selected.grade)}% {en ? 'average' : 'de media'}</h3>
                <p className="text-xs text-slate-600 mt-1">{en ? 'Average gradient in segments of' : 'Pendiente media por tramos de'} {selected.step < 1 ? `${format(selected.step * 1000, 0)} m` : `${format(selected.step)} km`}. {en ? 'The last segment may be shorter.' : 'El último tramo puede ser más corto.'}</p>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50" role="region" aria-label="Perfil táctil de la subida">
                  <div ref={chartBox} className="w-full min-w-0 h-[220px] sm:h-[250px] cursor-crosshair">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selected.profile} margin={{ top: 34, right: 14, left: 5, bottom: 20 }} onClick={selectChartPoint}>
                        <XAxis dataKey="km" type="number" domain={[0, selected.length]} ticks={[0, ...selected.segments.map(s => s.to)]} minTickGap={24} tickFormatter={v => format(v, 2)} label={{ value: en ? 'Climb distance (km)' : 'Distancia de subida (km)', position: 'bottom', offset: 0 }} tick={{ fontSize: 11, fill: '#345873' }} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={v => `${Math.round(v)} m`} width={65} tick={{ fontSize: 11, fill: '#345873' }} />
                        <Tooltip labelFormatter={v => `${en ? 'Km' : 'Km'} ${format(Number(v), 2)} ${en ? 'of climb' : 'de la subida'}`} formatter={v => [`${format(Number(v), 0)} m`, en ? 'Altitude' : 'Altitud']} />
                        <Area type="linear" dataKey="elevation" stroke="#006fba" fill="#b5e0fa" strokeWidth={2} isAnimationActive={false} />
                        {selected.segments.map((s, i) => <ReferenceArea key={`area-${i}`} x1={s.from} x2={s.to} fill={i % 2 ? '#006fba' : '#24bce8'} fillOpacity={0.07} />)}
                        {chartWidth >= 560 && selected.segments.map((s, i) => <ReferenceLine key={`label-${i}`} x={(s.from + s.to) / 2} stroke="transparent" label={{ value: `${format(s.grade)}%`, position: 'insideTop', fill: '#092844', fontSize: 12 }} />)}
                        {street && <ReferenceLine x={street.km} stroke="#f59e0b" strokeWidth={2} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {chartWidth < 560 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2" aria-label="Pendientes por tramo">{selected.segments.map((s, i) => <button type="button" key={i} className="min-h-12 rounded-lg bg-blue-50 text-blue-900 text-xs px-2 py-2" onClick={() => openAtDistance((s.from + s.to) / 2)}>{format(s.from, 2)}–{format(s.to, 2)} km · {format(s.grade)} %</button>)}</div>}
                {street && <div className="mt-3 rounded-lg overflow-hidden border border-slate-200">
                  <div className="bg-blue-50 p-3 text-sm text-blue-800 flex justify-between gap-2"><span>Street View · km {format(selected.start + street.km, 3)} {en ? 'of track' : 'del track'}</span><button type="button" aria-label={en ? 'Close Street View' : 'Cerrar Street View'} onClick={() => { requestId.current += 1; setStreet(null); }}><X className="w-5 h-5" /></button></div>
                  <div role="status" aria-live="polite">{street.loading && <p className="p-3 text-sm">{en ? 'Checking Google coverage…' : 'Comprobando cobertura de Google…'}</p>}{street.error && <p className="p-3 text-sm text-slate-600">{street.error}</p>}</div>
                  {street.panoId && <><iframe title={en ? 'Street View of selected point' : 'Street View del punto seleccionado'} className="w-full h-64" key={street.panoId} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(googleApiKey)}&pano=${encodeURIComponent(street.panoId)}`} /><p className="px-3 py-2 text-xs text-slate-500">{en ? 'Google shows the nearest available panorama; it may be offset from the exact GPX point.' : 'Google muestra la panorámica disponible más cercana; puede estar desplazada del punto exacto del GPX.'}</p></>}
                </div>}
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


