import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../lib/LanguageContext";
import { createPageUrl } from "@/utils";
import { Poi, PoiType, GpxTrack, User } from "@/entities/all"; import { base44 } from "@/api/base44Client"; // Added User
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Trash2, Edit, ArrowLeft } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import PoiForm from "../components/pois/PoiForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import LoadingScreen from "../components/common/LoadingScreen";
import AppLogo from "../components/common/AppLogo"; // Added AppLogo

export default function RoutePoiManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [route, setRoute] = useState(null);
  const [pois, setPois] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // NEW
  const [userRole, setUserRole] = useState(null); // NEW
  const [canManagePois, setCanManagePois] = useState(false); // NEW

  const [showPoiForm, setShowPoiForm] = useState(false);
  const [editingPoi, setEditingPoi] = useState(null);
  
  const location = useLocation();
  const routeId = new URLSearchParams(location.search).get('routeId');
  
  const invalidateStaticCache = useCallback(() => {
    const CACHE_KEY_STATIC = 'mirat_static_cache';
    localStorage.removeItem(CACHE_KEY_STATIC);
    console.log("Static cache invalidated after POI update");
  }, []);

  const loadData = useCallback(async () => {
    if (!routeId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // NEW: Load user and check permissions
      const user = await base44.auth.me();
      setCurrentUser(user);
      setUserRole(user.role);

      // Load route and check ownership
      const routeData = await GpxTrack.get(routeId);
      setRoute(routeData);

      // NEW: Check if user can manage POIs
      const isOwner = routeData.created_by === user.email;
      const isAdmin = user.role === 'admin';
      const hasPermission = isAdmin || (isOwner && user.can_upload_routes);
      
      setCanManagePois(hasPermission);

      if (!hasPermission) {
        setError("No tienes permiso para gestionar POIs de esta ruta.");
        setIsLoading(false);
        return;
      }

      // Load all POIs and types
      const [allPois, typesData] = await Promise.all([
        Poi.list("-created_date"),
        PoiType.list(),
      ]);
      
      // Filter POIs that belong to this route
      const routePois = allPois.filter(poi => poi.gpx_track_id === routeId);
      
      setPois(routePois);
      setPoiTypes(typesData);
      
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Error cargando los datos. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (!routeId) {
      console.warn("No route ID provided, redirecting to management");
      window.location.href = createPageUrl("Management"); // This might need to change based on user role
      return;
    }
    
    loadData();
  }, [routeId, loadData]);

  const handleSavePoi = async (poiData) => {
    try {
      const dataToSave = { ...poiData, gpx_track_id: routeId };
      
      if (editingPoi) {
        await Poi.update(editingPoi.id, dataToSave);
      } else {
        await Poi.create(dataToSave);
      }
      
      setShowPoiForm(false);
      setEditingPoi(null);
      
      invalidateStaticCache();
      loadData();
      
    } catch (error) {
      console.error("Error saving POI:", error);
      throw error;
    }
  };

  const handleDeletePoi = async (poiId) => {
    if (confirm("¿Estás seguro de que quieres eliminar este POI?")) {
      try {
        await Poi.delete(poiId);
        invalidateStaticCache();
        loadData();
      } catch (error) {
        console.error("Error deleting POI:", error);
        alert("Error eliminando el POI. Inténtalo de nuevo.");
      }
    }
  };

  const handleRetry = () => {
    setError(null);
    loadData();
  };

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link to={createPageUrl(userRole === 'admin' ? "Management" : "Routes")}>
          <Button variant="ghost" className="mb-4 text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {userRole === 'admin' ? 'Volver a Gestión de Datos' : 'Volver a Rutas'}
          </Button>
        </Link>
        <div className="text-center py-12">
          <div className="mb-6">
            <AppLogo className="w-16 h-16" showText={false} />
          </div>
          <div className="text-red-500 mb-4">{error}</div>
          {!error.includes("permiso") && ( // Only show retry if it's not a permission error
            <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link to={createPageUrl(userRole === 'admin' ? "Management" : "Routes")}>
          <Button variant="ghost" className="mb-4 text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {userRole === 'admin' ? 'Volver a Gestión de Datos' : 'Volver a Rutas'}
          </Button>
        </Link>
        <LoadingScreen message="Cargando POIs de la ruta..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 sm:mb-8">
          <Link to={createPageUrl(userRole === 'admin' ? "Management" : "Routes")}>
            <Button variant="ghost" className="mb-4 text-slate-600 hover:text-slate-800">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {userRole === 'admin' ? 'Volver a Gestión de Datos' : 'Volver a Rutas'}
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MapPin className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
            {en ? 'POIs for:' : 'POIs de:'} <span className="text-blue-700">{route?.name || (en ? 'Loading...' : 'Cargando...')}</span>
          </h1>
          {userRole !== 'admin' && (
            <p className="text-sm text-slate-500 mt-2">
              {en ? 'You are managing this route\'s POIs. You can only use existing POI types.' : 'Estás gestionando los POIs de tu ruta. Solo puedes usar tipos de POI existentes.'}
            </p>
          )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-semibold text-slate-700">
                {pois.length} {en ? 'Points of Interest on this route' : 'Puntos de Interés en esta ruta'}
            </h2>
            {canManagePois && ( // Conditionally render "Add POI" button
              <Button
                  onClick={() => {
                    setEditingPoi(null);
                    setShowPoiForm(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  size="sm"
              >
                  <Plus className="w-4 h-4 mr-2" />
                  {en ? 'Add POI to this Route' : 'Añadir POI a esta Ruta'}
              </Button>
            )}
        </div>
        
        <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableHead className="text-slate-600">{en ? 'Name' : 'Nombre'}</TableHead>
                  <TableHead className="text-slate-600">{en ? 'Type' : 'Tipo'}</TableHead>
                  <TableHead className="text-slate-600 text-right">{en ? 'Distance (km)' : 'Distancia (km)'}</TableHead>
                  <TableHead className="text-slate-600 text-right">{en ? 'Elevation (m)' : 'Elevación (m)'}</TableHead>
                  {canManagePois && ( // Conditionally render "Actions" header
                    <TableHead className="text-slate-600 text-center">{en ? 'Actions' : 'Acciones'}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pois.map((poi) => {
                  const type = poiTypes.find((t) => t.id === poi.poi_type_id);
                  return (
                    <TableRow key={poi.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-800">{poi.name || type?.name || 'POI sin nombre'}</TableCell>
                      <TableCell>
                        {type && (
                          <Badge
                            style={{
                              backgroundColor: `${type.color}20`,
                              color: type.color,
                              borderColor: `${type.color}50`,
                            }}
                          >
                            {type.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{(poi.distance_from_start / 1000).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{poi.elevation?.toFixed(0)}</TableCell>
                      {canManagePois && ( // Conditionally render "Actions" cells
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-blue-500"
                              onClick={() => {
                                setEditingPoi(poi);
                                setShowPoiForm(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-500"
                              onClick={() => handleDeletePoi(poi.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {pois.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No hay POIs en esta ruta. ¡Añade el primero!
              </div>
            )}
        </div>
      </div>

      <AnimatePresence>
        {showPoiForm && (
          <PoiForm
            poi={editingPoi}
            routes={route ? [route] : []}
            poiTypes={poiTypes}
            onSave={handleSavePoi}
            onCancel={() => {
              setShowPoiForm(false);
              setEditingPoi(null);
            }}
            initialRouteId={routeId}
            canCreateTypes={userRole === 'admin'} // NEW PROP
          />
        )}
      </AnimatePresence>
    </div>
  );
}
