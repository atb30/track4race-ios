import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MapPin, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PoiIcon from '@/components/pois/PoiIcon';

export default function QuickPoiDialog({ open, onOpenChange, snapshotKm, maximumKm, poiTypes, saving, error, onSave }) {
  const [name, setName] = useState('');
  const [poiTypeId, setPoiTypeId] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPoiTypeId('');
    setDistanceKm(Number(snapshotKm || 0).toFixed(3));
    setValidationError('');
  }, [open, snapshotKm]);

  const submit = async (event) => {
    event.preventDefault();
    const parsedDistance = Number(distanceKm);
    if (!name.trim()) return setValidationError('Escribe un nombre para el POI.');
    if (!poiTypeId) return setValidationError('Selecciona una categoría.');
    if (!Number.isFinite(parsedDistance) || parsedDistance < 0 || parsedDistance > maximumKm) {
      return setValidationError(`El PK debe estar entre 0 y ${Number(maximumKm || 0).toFixed(3)} km.`);
    }
    setValidationError('');
    await onSave({ name: name.trim(), poiTypeId, distanceKm: parsedDistance });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[6000] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-[6001] left-1/2 top-1/2 w-[calc(100%_-_24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
          <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><MapPin className="h-5 w-5" /></span>
            Añadir POI
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-500">
            Se ha memorizado el punto exacto en el que pulsaste el botón. Puedes corregir el PK antes de guardarlo.
          </Dialog.Description>
          <Dialog.Close asChild>
            <button type="button" disabled={saving} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </Dialog.Close>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-poi-name">Nombre</Label>
              <Input id="quick-poi-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Fuente, peligro, avituallamiento…" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={poiTypeId} onValueChange={setPoiTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent className="z-[6100]">
                  {poiTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <span className="flex items-center gap-2"><PoiIcon type={type} className="h-4 w-4" />{type.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-poi-km">Punto kilométrico (PK)</Label>
              <div className="relative">
                <Input id="quick-poi-km" type="number" min="0" max={maximumKm} step="0.001" inputMode="decimal" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} className="pr-12 text-lg font-semibold" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">km</span>
              </div>
            </div>
            {(validationError || error) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{validationError || error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={saving || poiTypes.length === 0}>
                <Save className="mr-2 h-4 w-4" />{saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
