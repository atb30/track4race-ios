import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Poi, PoiType, GpxTrack, User } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, Tag, Trash2, Edit, Route as RouteIcon, ChevronRight } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useLanguage } from "../lib/LanguageContext";

import PoiTypeForm from "../components/pois/PoiTypeForm";
import PoiIcon from "../components/pois/PoiIcon";
import LoadingScreen from "../components/common/LoadingScreen";




export default function Management() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [pois, setPois] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Estados para formularios
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'pois';

  useEffect(() => {
    const checkUserAndLoadData = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        if (user.role !== 'admin') {
          window.location.href = createPageUrl("Routes");
          return;
        }
        loadData();
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkUserAndLoadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [poisData, typesData, routesData] = await Promise.all([
        Poi.list("-created_date"),
        PoiType.list(),
        GpxTrack.list("-created_date"),
      ]);
      
      setPois(poisData);
      setPoiTypes(typesData);
      setRoutes(routesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePoiType = async (typeData) => {
    try {
      if (editingType) {
        await PoiType.update(editingType.id, typeData);
      } else {
        await PoiType.create(typeData);
      }
      setShowTypeForm(false);
      setEditingType(null);
      loadData();
    } catch (error) {
      console.error("Error saving POI type:", error);
      throw error;
    }
  };

  const handleDeletePoiType = async (typeId) => {
    const poisUsingType = pois.filter((poi) => poi.poi_type_id === typeId);
    if (poisUsingType.length > 0) {
      alert(`No se puede eliminar este tipo porque está siendo usado por ${poisUsingType.length} POI(s)`);
      return;
    }

    if (confirm("¿Estás seguro de que quieres eliminar este tipo de POI?")) {
      try {
        await PoiType.delete(typeId);
        loadData();
      } catch (error) {
        console.error("Error deleting POI type:", error);
      }
    }
  };

  if (isLoading || userRole !== 'admin') {
    return <LoadingScreen message={userRole !== 'admin' ? "Verificando permisos..." : "Cargando panel de administración..."} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
            <MapPin className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
            {en ? 'Data Management' : 'Gestión de Datos'}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            {en ? 'Manage points of interest (POIs) and their categories.' : 'Administra los Puntos de Interés (POIs) y sus categorías.'}
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid grid-cols-2 w-full sm:w-72 mb-6 bg-slate-200">
          <TabsTrigger value="pois" className="flex items-center gap-2 text-xs sm:text-sm">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'Points of Interest' : 'Puntos de Interés'}</span>
            <span className="sm:hidden">POIs</span>
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2 text-xs sm:text-sm">
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'POI Types' : 'Tipos de POI'}</span>
            <span className="sm:hidden">Tipos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pois">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-700">
                {en ? 'Select a route to manage its POIs' : 'Selecciona una ruta para gestionar sus POIs'}
              </h2>
            </div>
            
            <div className="divide-y divide-slate-200">
              {routes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No se encontraron rutas. Sube una ruta primero.
                </div>
              ) : (
                routes.map((route) => {
                  const poiCount = pois.filter(p => p.gpx_track_id === route.id).length;
                  return (
                    <Link
                      to={createPageUrl(`RoutePoiManagement?routeId=${route.id}`)}
                      key={route.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <RouteIcon className="w-6 h-6 text-slate-400" />
                        <div>
                          <h3 className="font-medium text-slate-800 group-hover:text-blue-600">{route.name}</h3>
                          <p className="text-sm text-slate-500">{poiCount} POI{poiCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="types">
          <div className="bg-white rounded-lg border border-slate-200">
             <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-200">
                <h2 className="text-base sm:text-lg font-semibold text-slate-700">{poiTypes.length} Tipos de POI</h2>
                {userRole === 'admin' && (
                  <Button onClick={() => { setEditingType(null); setShowTypeForm(true); }} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" size="sm">
                      <Plus className="w-4 h-4 mr-2"/>
                      Nuevo Tipo
                  </Button>
                )}
            </div>
             <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {poiTypes.map(type => {
                    const poisCount = pois.filter(p => p.poi_type_id === type.id).length;
                    return (
                        <div key={type.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 group">
                             <div className="flex items-start justify-between mb-3">
                                 <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <PoiIcon type={type} className="w-8 h-8" />
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-slate-800 truncate">{type.name}</h3>
                                        <p className="text-sm text-slate-500">{poisCount} POI{poisCount !== 1 ? 's' : ''}</p>
                                        {type.show_in_profile !== undefined && (
                                          <div className="flex items-center gap-1 mt-1">
                                            <div className={`w-2 h-2 rounded-full ${type.show_in_profile ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                            <span className="text-xs text-slate-500">
                                              {type.show_in_profile ? 'En perfil' : 'Oculto en perfil'}
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                </div>
                                {userRole === 'admin' && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-500" onClick={() => { setEditingType(type); setShowTypeForm(true); }}>
                                          <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => handleDeletePoiType(type.id)} disabled={poisCount > 0}>
                                          <Trash2 className="w-4 h-4"/>
                                      </Button>
                                  </div>
                                )}
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{type.description || 'Sin descripción.'}</p>
                        </div>
                    )
                })}
            </div>
             {poiTypes.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    No se encontraron Tipos de POI.
                </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showTypeForm && (
          <PoiTypeForm
            poiType={editingType}
            onSave={handleSavePoiType}
            onCancel={() => {
              setShowTypeForm(false);
              setEditingType(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
