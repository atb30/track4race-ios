
import React, { useState, useCallback } from 'react';
import { GpxTrack } from '@/entities/GpxTrack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Upload, File, BarChart, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

// Helper functions for GPX parsing
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateClimbSegments = (waypoints) => {
  const segments = [];
  let climbStart = null;
  const MIN_GRADE = 4; // Minimum grade in percent to consider a climb segment

  for (let i = 1; i < waypoints.length; i++) {
    const current = waypoints[i];
    const previous = waypoints[i - 1];
    const elevationDiff = current.elevation - previous.elevation;
    const distanceDiff = (current.distance - previous.distance) * 1000; // in meters

    const grade = distanceDiff > 0 ? (elevationDiff / distanceDiff) * 100 : 0;

    if (grade >= MIN_GRADE && !climbStart) {
      climbStart = previous;
    } else if (grade < MIN_GRADE && climbStart) {
      if ((current.distance - climbStart.distance) > 0.1 || (current.elevation - climbStart.elevation) > 10) {
        segments.push({
          start_km: climbStart.distance,
          end_km: current.distance,
          grade_percent: ((current.elevation - climbStart.elevation) / ((current.distance - climbStart.distance) * 1000)) * 100,
          elevation_gain: current.elevation - climbStart.elevation
        });
      }
      climbStart = null;
    }
  }
  
  if (climbStart && (waypoints[waypoints.length-1].distance - climbStart.distance) > 0.1) {
    segments.push({
      start_km: climbStart.distance,
      end_km: waypoints[waypoints.length-1].distance,
      grade_percent: ((waypoints[waypoints.length-1].elevation - climbStart.elevation) / ((waypoints[waypoints.length-1].distance - climbStart.distance) * 1000)) * 100,
      elevation_gain: waypoints[waypoints.length-1].elevation - climbStart.elevation
    });
  }

  return segments;
};

// Parser to extract data from GPX file
const parseGpx = (gpxContent) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxContent, "application/xml");

  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length) {
    const errorText = parseError[0]?.textContent || "Unknown parsing error";
    throw new Error(`Error al analizar el archivo GPX: ${errorText}. Asegúrate de que el formato es correcto.`);
  }

  const trackpoints = xmlDoc.getElementsByTagName("trkpt");
  if (trackpoints.length === 0) {
    throw new Error("No se encontraron puntos de track (trkpt) en el archivo GPX.");
  }

  const extractedWaypoints = Array.from(trackpoints).map(point => ({
    lat: parseFloat(point.getAttribute("lat")),
    lng: parseFloat(point.getAttribute("lon")),
    elevation: point.getElementsByTagName("ele")[0] ? parseFloat(point.getElementsByTagName("ele")[0].textContent) || 0 : 0
  }));

  const waypointsWithDistance = [];
  let totalDistance = 0;
  let totalElevationGain = 0;
  let maxElevation = -Infinity;
  let minElevation = Infinity;

  extractedWaypoints.forEach((point, index) => {
    const ele = point.elevation || 0;
    if (index > 0) {
      const prevPoint = waypointsWithDistance[index-1];
      const dist = calculateDistance(prevPoint.lat, prevPoint.lng, point.lat, point.lng);
      totalDistance += dist;
      if (ele > prevPoint.elevation) {
        totalElevationGain += Math.max(0, ele - prevPoint.elevation);
      }
    }
    maxElevation = Math.max(maxElevation, ele);
    minElevation = Math.min(minElevation, ele);
    waypointsWithDistance.push({ ...point, elevation: ele, distance: totalDistance });
  });

  const climb_segments = calculateClimbSegments(waypointsWithDistance);

  return {
    waypoints: waypointsWithDistance,
    total_distance: totalDistance,
    total_elevation_gain: totalElevationGain,
    max_elevation: maxElevation,
    min_elevation: minElevation,
    climb_segments: climb_segments,
  };
};

export default function UploadGpxPage() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Handle file selection
  const handleFileChange = useCallback((event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.gpx')) {
      setFile(selectedFile);
      setName(selectedFile.name.replace(/\.gpx$/i, ''));
      setSuccess(false);
      setError(null);
    } else {
      setError('Solo se permiten archivos .gpx');
      setFile(null);
    }
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.gpx')) {
      setFile(droppedFile);
      setName(droppedFile.name.replace(/\.gpx$/i, ''));
      setSuccess(false);
      setError(null);
    } else {
      setError('Solo se permiten archivos .gpx');
      setFile(null);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, selecciona un archivo GPX.');
      return;
    }
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const gpxData = await file.text();
      const trackData = parseGpx(gpxData);
      
      const newTrack = {
        name: name || 'Ruta sin nombre',
        description,
        gpx_data: gpxData,
        ...trackData,
        is_active: false,
        allowed_user_emails: [],
      };

      await GpxTrack.create(newTrack);
      
      // NUEVO: Limpiar cache de rutas para que se actualice la lista
      localStorage.removeItem('mirat_routes_cache');
      localStorage.removeItem('mirat_static_cache');
      console.log("Cache de rutas limpiado después de subir nueva ruta");
      
      setSuccess(true);
      setFile(null);
      setName('');
      setDescription('');
      
      // Opcional: Redirigir a la página de rutas después de un delay
      setTimeout(() => {
        window.location.href = '/Routes';
      }, 2000);
      
    } catch (parseError) {
      setError(`Error procesando el archivo GPX: ${parseError.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <Card className="bg-white border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Upload className="w-7 h-7 text-blue-600" />
            Subir Nueva Ruta GPX
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="font-bold">¡Ruta subida con éxito!</p>
                  <p className="text-sm">Ya está disponible en la biblioteca de rutas.</p>
                </div>
              </motion.div>
            )}

            {/* File upload area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
              }`}
            >
              <input
                type="file"
                accept=".gpx"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-4" />
              {file ? (
                <div className="text-slate-700">
                  <p className="font-semibold">Archivo seleccionado:</p>
                  <p className="flex items-center justify-center gap-2 mt-2">
                    <File className="w-4 h-4" /> {file.name}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500">
                  {isDragActive
                    ? 'Suelta el archivo aquí...'
                    : 'Arrastra y suelta un archivo .gpx aquí, o haz clic para seleccionarlo'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">
                Nombre de la ruta
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Vuelta a la Sierra"
                required
                className="border-slate-300"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">
                Descripción (opcional)
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade detalles sobre la ruta..."
                className="border-slate-300"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </motion.div>
            )}
          </CardContent>
          
          <CardFooter>
            <Button type="submit" disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-700">
              {isUploading ? (
                <>
                  <BarChart className="w-4 h-4 mr-2 animate-spin" />
                  Procesando y Subiendo...
                </>
              ) : (
                'Guardar Ruta'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
