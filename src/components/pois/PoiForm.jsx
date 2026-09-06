
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, X, Save } from "lucide-react";
import { motion } from "framer-motion";
import PoiIcon from "./PoiIcon";

export default function PoiForm({ 
  poi = null, 
  routes = [], 
  poiTypes = [], 
  onSave, 
  onCancel,
  initialRouteId = null,
  canCreateTypes = true // NEW PROP - defaults to true for backwards compatibility
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    gpx_track_id: "",
    poi_type_id: "",
    distance_from_start: "",
    elevation: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    if (poi) {
      setFormData({
        name: poi.name || "",
        description: poi.description || "",
        gpx_track_id: poi.gpx_track_id || initialRouteId || "",
        poi_type_id: poi.poi_type_id || "",
        distance_from_start: (poi.distance_from_start / 1000)?.toString() || "",
        elevation: poi.elevation?.toString() || ""
      });
    } else if (initialRouteId) {
       setFormData(prev => ({ ...prev, gpx_track_id: initialRouteId }));
    }
  }, [poi, initialRouteId]);

  useEffect(() => {
    if (formData.gpx_track_id) {
      const route = routes.find(r => r.id === formData.gpx_track_id);
      setSelectedRoute(route);
    } else {
      setSelectedRoute(null);
    }
  }, [formData.gpx_track_id, routes]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.gpx_track_id) newErrors.gpx_track_id = "Selecciona una ruta";
    if (!formData.poi_type_id) newErrors.poi_type_id = "Selecciona un tipo de POI";
    if (!formData.distance_from_start || isNaN(parseFloat(formData.distance_from_start))) {
      newErrors.distance_from_start = "Punto kilométrico válido requerido";
    } else {
      const distanceKm = parseFloat(formData.distance_from_start);
      if (selectedRoute && distanceKm > selectedRoute.total_distance) {
        newErrors.distance_from_start = `El punto debe estar dentro de la ruta (máx: ${selectedRoute.total_distance.toFixed(1)}km)`;
      }
      if (distanceKm < 0) {
        newErrors.distance_from_start = "El punto kilométrico debe ser positivo";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getCoordinatesFromDistance = (route, distanceKm) => {
    if (!route || !route.waypoints || route.waypoints.length === 0) {
      return { latitude: 0, longitude: 0, elevation: 0 };
    }

    let closestPoint = route.waypoints[0];
    let minDiff = Math.abs(route.waypoints[0].distance - distanceKm);

    for (const waypoint of route.waypoints) {
      const diff = Math.abs(waypoint.distance - distanceKm);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = waypoint;
      }
    }

    return {
      latitude: closestPoint.lat,
      longitude: closestPoint.lng,
      elevation: closestPoint.elevation || 0
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const distanceKm = parseFloat(formData.distance_from_start);
      const coordinates = getCoordinatesFromDistance(selectedRoute, distanceKm);

      const submitData = {
        ...formData,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        distance_from_start: distanceKm * 1000, // Siempre guardar en metros
        elevation: formData.elevation ? parseFloat(formData.elevation) : coordinates.elevation
      };

      await onSave(submitData);
    } catch (error) {
      console.error("Error saving POI:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-xl"
      >
        <Card className="max-h-[90vh] flex flex-col bg-white border-slate-200 text-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <MapPin className="w-5 h-5 text-blue-500" />
              {poi ? "Editar POI" : "Nuevo POI"}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="p-6 overflow-y-auto">
            {!canCreateTypes && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  ℹ️ Solo puedes usar tipos de POI existentes. Si necesitas un nuevo tipo, contacta con el administrador.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-600">Nombre del POI (Opcional)</Label>
                    <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} placeholder="Ej: Refugio de montaña" className={`bg-slate-50 border-slate-300 ${errors.name ? "border-red-500" : ""}`}/>
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="poi_type_id" className="text-slate-600">Tipo de POI *</Label>
                    <Select value={formData.poi_type_id} onValueChange={(value) => handleInputChange("poi_type_id", value)}>
                      <SelectTrigger className={`bg-slate-50 border-slate-300 ${errors.poi_type_id ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-800">
                        {poiTypes.length > 0 ? (
                          poiTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id} className="focus:bg-slate-100">
                              <div className="flex items-center gap-2">
                                <PoiIcon type={type} className="w-4 h-4"/> 
                                {type.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-types" disabled>
                            No hay tipos de POI disponibles
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.poi_type_id && <p className="text-xs text-red-500">{errors.poi_type_id}</p>}
                    {!canCreateTypes && poiTypes.length === 0 && (
                      <p className="text-xs text-orange-600">
                        No hay tipos de POI. Contacta con el administrador.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-600">Descripción</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} placeholder="Descripción opcional del POI..." className="h-20 bg-slate-50 border-slate-300"/>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gpx_track_id" className="text-slate-600">Ruta asociada *</Label>
                   <Select value={formData.gpx_track_id} onValueChange={(value) => handleInputChange("gpx_track_id", value)} disabled={routes.length === 1}>
                     <SelectTrigger className={`bg-slate-50 border-slate-300 ${errors.gpx_track_id ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Selecciona ruta" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-800">
                        {routes.map((route) => (
                          <SelectItem key={route.id} value={route.id} className="focus:bg-slate-100">
                            {route.name} ({(route.total_distance)?.toFixed(1)}km)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  {errors.gpx_track_id && <p className="text-xs text-red-500">{errors.gpx_track_id}</p>}
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="distance_from_start" className="text-slate-600">Punto kilométrico *</Label>
                        <Input 
                          id="distance_from_start" 
                          type="number" 
                          step="0.1" 
                          value={formData.distance_from_start} 
                          onChange={(e) => handleInputChange("distance_from_start", e.target.value)} 
                          placeholder="Ej: 5.2" 
                          className={`bg-slate-50 border-slate-300 ${errors.distance_from_start ? "border-red-500" : ""}`}
                        />
                        {errors.distance_from_start && <p className="text-xs text-red-500">{errors.distance_from_start}</p>}
                        {selectedRoute && (
                          <p className="text-xs text-slate-500">
                            Ruta: 0 - {selectedRoute.total_distance.toFixed(1)}km
                          </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="elevation" className="text-slate-600">Elevación (m)</Label>
                        <Input id="elevation" type="number" step="1" value={formData.elevation} onChange={(e) => handleInputChange("elevation", e.target.value)} placeholder="Opcional - se calculará automáticamente" className="bg-slate-50 border-slate-300"/>
                        <p className="text-xs text-slate-500">
                          Si no se especifica, se usará la elevación de la ruta
                        </p>
                    </div>
                </div>

               <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700" 
                    disabled={isSubmitting || poiTypes.length === 0}
                  >
                    {isSubmitting ? (
                        <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Guardando...</div>
                    ) : (
                        <div className="flex items-center gap-2"><Save className="w-4 h-4" />Guardar POI</div>
                    )}
                  </Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
