import React from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/LanguageContext";

export default function NavigationPanel({ 
  gpxTrack, 
  currentPosition, 
  nearbyPois = [],
  poiTypes = []
}) {
  const { language } = useLanguage(); const en = language === 'en';
  if (!gpxTrack) {
    return (
      <div className="h-full bg-white rounded-lg border border-slate-200 p-6 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Navigation className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{en ? 'No active navigation' : 'Sin navegación activa'}</p>
          <p className="text-sm">{en ? 'Select a route to begin' : 'Selecciona una ruta para comenzar'}</p>
        </div>
      </div>
    );
  }

  const currentKm = currentPosition?.distance || 0;
  const remainingKm = (gpxTrack.total_distance || 0) - currentKm;

  const getPoiIcon = (poiTypeId) => {
    const type = poiTypes.find(t => t.id === poiTypeId);
    return type?.icon_url || null;
  };

  const getPoiColor = (poiTypeId) => {
    const type = poiTypes.find(t => t.id === poiTypeId);
    return type?.color || "#3b82f6";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full bg-white rounded-lg border border-slate-200 overflow-hidden"
    >
      {/* Panel fijo superior - Distancias */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold">{currentKm.toFixed(1)}</div>
              <div className="text-xs opacity-90">{en ? 'km traveled' : 'km recorridos'}</div>
            </div>
            <div className="w-px h-8 bg-white/30"></div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold">{remainingKm.toFixed(1)}</div>
              <div className="text-xs opacity-90">{en ? 'km remaining' : 'km restantes'}</div>
            </div>
          </div>
          
          {gpxTrack.total_distance && (
            <div className="bg-white/20 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${(currentKm / gpxTrack.total_distance) * 100}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Panel dinámico - POIs cercanos */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">{en ? 'Nearby POIs' : 'POIs Próximos'}</h3>
          </div>

          {nearbyPois.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{en ? 'No nearby POIs' : 'No hay POIs cercanos'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyPois.map((poi) => {
                const distanceToPoi = Math.abs(poi.distance_from_start - currentKm);
                const isAhead = poi.distance_from_start > currentKm;
                
                return (
                  <motion.div
                    key={poi.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getPoiIcon(poi.poi_type_id) ? (
                          <img 
                            src={getPoiIcon(poi.poi_type_id)} 
                            alt=""
                            className="w-6 h-6 rounded"
                          />
                        ) : (
                          <div 
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: getPoiColor(poi.poi_type_id) }}
                          ></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {poi.name}
                          </p>
                          {poi.description && (
                            <p className="text-xs text-slate-600 truncate">
                              {poi.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {en ? 'Km ' : 'Km '}{poi.distance_from_start.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={isAhead ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {isAhead ? "+" : "-"}{distanceToPoi.toFixed(1)}km
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
