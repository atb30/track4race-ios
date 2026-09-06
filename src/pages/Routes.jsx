import React, { useState, useEffect, useCallback, useRef } from "react";
import { GpxTrack, User } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route, Play, Trash2, Mountain, MapPin, Clock, TrendingUp, ArrowLeft, Users, Plus, Lock, Upload, Loader2, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ManageAccessForm from "../components/routes/ManageAccessForm";
import AppLogo from "../components/common/AppLogo";
import LoadingScreen from "../components/common/LoadingScreen";

// Cache constants
const ROUTES_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CACHE_KEY_ROUTES = 'mirat_routes_cache';

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [canUploadRoutes, setCanUploadRoutes] = useState(false); // NEW

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedRouteForAccess, setSelectedRouteForAccess] = useState(null);
  const [activatingRouteId, setActivatingRouteId] = useState(null);

  // Cache management
  const routesCache = useRef({
    data: null,
    timestamp: 0,
    loaded: false
  });

  const loadCachedRoutesData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_ROUTES);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        
        if (parsedCache.data && parsedCache.timestamp) {
          const now = Date.now();
          if ((now - parsedCache.timestamp) < ROUTES_CACHE_DURATION) {
            console.log("Loading routes cached data from localStorage");
            routesCache.current = parsedCache;
            
            const cachedData = parsedCache.data;
            // setRoutes and setAllUsers are called here only if user info is available during initial load
            // Otherwise, they will be set when loadRoutes is called with user info
            return true;
          }
        }
      }
    } catch (error) {
      console.warn("Error loading routes cached data:", error);
    }
    return false;
  }, []);

  const saveCachedRoutesData = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        loaded: true
      };
      localStorage.setItem(CACHE_KEY_ROUTES, JSON.stringify(cacheData));
      routesCache.current = cacheData;
      console.log("Routes data cached for 1 hour");
    } catch (error) {
      console.warn("Error saving routes data to localStorage:", error);
    }
  }, []);

  const loadRoutes = useCallback(async () => {
    // Si aún no tenemos la info del usuario, no cargar rutas
    if (!currentUser || !userRole) {
      return;
    }

    setIsLoading(true);
    
    // Check cache first - pero con validación más estricta
    const now = Date.now();
    if (routesCache.current.loaded && 
        (now - routesCache.current.timestamp) < ROUTES_CACHE_DURATION && 
        routesCache.current.data &&
        routesCache.current.data.routes && 
        routesCache.current.data.routes.length > 0) { // NUEVO: Verificar que hay datos reales
      
      console.log("Using cached routes data");
      const cached = routesCache.current.data;
      
      if (userRole === 'admin') {
        setRoutes(cached.routes || []);
        setAllUsers(cached.allUsers || []); // Set allUsers from cache for admin
      } else {
        const userAccessibleRoutes = (cached.routes || []).filter(route => {
          if (route.created_by === currentUser.email) return true;
          if (route.allowed_user_emails && Array.isArray(route.allowed_user_emails) && route.allowed_user_emails.includes(currentUser.email)) return true;
          return false;
        });
        setRoutes(userAccessibleRoutes);
      }
      setIsLoading(false);
      return;
    }

    try {
      console.log("Loading fresh routes data from API");
      
      // NUEVO: Forzar recarga completa si el cache está vacío (pero existe la referencia)
      if (routesCache.current.data && (!routesCache.current.data.routes || routesCache.current.data.routes.length === 0)) {
        console.log("Cache seems empty, forcing fresh data load");
        routesCache.current = { data: null, timestamp: 0, loaded: false };
        localStorage.removeItem(CACHE_KEY_ROUTES); // Clear from local storage as well
      }

      // Cargar TODAS las rutas primero con manejo de rate limit
      const allRoutesData = await GpxTrack.list("-created_date");
      let usersData = [];
      
      console.log(`Loaded ${allRoutesData.length} routes from API`);
      
      if (userRole === 'admin') {
        usersData = await User.list();
        setAllUsers(usersData);
        setRoutes(allRoutesData);
      } else {
        // MODIFIED: Filter routes for regular users (own routes + allowed routes)
        const userAccessibleRoutes = allRoutesData.filter(route => {
          if (route.created_by === currentUser.email) return true;
          if (route.allowed_user_emails && Array.isArray(route.allowed_user_emails) && route.allowed_user_emails.includes(currentUser.email)) return true;
          return false;
        });
        console.log(`User has access to ${userAccessibleRoutes.length} of ${allRoutesData.length} routes`);
        setRoutes(userAccessibleRoutes);
      }
      
      // Cache the data solo si hay rutas reales
      if (allRoutesData.length > 0) {
        saveCachedRoutesData({
          routes: allRoutesData,
          allUsers: usersData // Cache allUsers only if fetched (i.e., for admin)
        });
      }
      
    } catch (error) {
      // Manejo específico para rate limits
      if (error.response?.status === 429 || error.message?.includes('429')) {
        console.warn("Rate limit reached when loading routes, using any available cached data");
        
        // Use any cached data, even if stale
        if (routesCache.current.loaded && routesCache.current.data) {
          console.log("Using stale cached routes data due to rate limit");
          const cached = routesCache.current.data;
          
          if (userRole === 'admin') {
            setRoutes(cached.routes || []);
            setAllUsers(cached.allUsers || []);
          } else {
            const userAccessibleRoutes = (cached.routes || []).filter(route => {
              if (route.created_by === currentUser.email) return true;
              if (route.allowed_user_emails && Array.isArray(route.allowed_user_emails) && route.allowed_user_emails.includes(currentUser.email)) return true;
              return false;
            });
            setRoutes(userAccessibleRoutes);
          }
        } else if (loadCachedRoutesData()) { // Attempt to load from localStorage again, even if stale (only if not already loaded into ref)
          console.log("Loaded fallback routes data from localStorage due to rate limit");
          // Re-evaluate routes/users based on newly loaded stale cache
          if (routesCache.current.loaded && routesCache.current.data) {
              const cached = routesCache.current.data;
              if (userRole === 'admin') {
                setRoutes(cached.routes || []);
                setAllUsers(cached.allUsers || []);
              } else {
                const userAccessibleRoutes = (cached.routes || []).filter(route => {
                  if (route.created_by === currentUser.email) return true;
                  if (route.allowed_user_emails && Array.isArray(route.allowed_user_emails) && route.allowed_user_emails.includes(currentUser.email)) return true;
                  return false;
                });
                setRoutes(userAccessibleRoutes);
              }
          } else {
              console.warn("No routes cache available and rate limit exceeded after retry");
              setRoutes([]);
              setAllUsers([]);
          }
        } else {
          console.warn("No routes cache available and rate limit exceeded");
          setRoutes([]);
          setAllUsers([]);
        }
        
        setIsLoading(false);
        return;
      }
      
      console.error("Error loading routes:", error);
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  }, [userRole, currentUser, loadCachedRoutesData, saveCachedRoutesData]);

  // Load cached data immediately on component mount
  useEffect(() => {
    loadCachedRoutesData();
  }, [loadCachedRoutesData]);

  useEffect(() => {
    const checkUserAndLoad = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        setCurrentUser(user);
        setCanUploadRoutes(user.can_upload_routes || user.role === 'admin'); // NEW
        
        // Removed original User.list() call here, it's now handled by loadRoutes
        // based on user role and caching logic
      } catch (e) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkUserAndLoad();
  }, []);

  // Cargar rutas cuando tengamos la info del usuario
  useEffect(() => {
    if (currentUser && userRole) {
      loadRoutes();
    }
  }, [currentUser, userRole, loadRoutes]);

  const activateRoute = async (routeId) => {
    setActivatingRouteId(routeId); // Set loading state immediately
    
    try {
      console.log("Iniciando activación de ruta:", routes.find(r => r.id === routeId)?.name);
      
      // PASO 1: Desactivar TODAS las rutas activas del sistema (no solo las visibles)
      console.log("Desactivando todas las rutas activas...");
      const allTracks = await GpxTrack.list().catch(() => []);
      const allActiveRoutes = allTracks.filter(r => r.is_active && r.id !== routeId);
      
      for (const activeRoute of allActiveRoutes) {
        console.log("Desactivando ruta:", activeRoute.name);
        await GpxTrack.update(activeRoute.id, { is_active: false });
      }
      
      if (allActiveRoutes.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // PASO 2: Activar SOLO la nueva ruta
      console.log("Activando nueva ruta:", routes.find(r => r.id === routeId)?.name);
      await GpxTrack.update(routeId, { is_active: true });
      
      // PASO 3: Actualizar el estado local para reflejar que SOLO esta ruta está activa
      setRoutes(prevRoutes => 
        prevRoutes.map(route => ({
          ...route,
          is_active: route.id === routeId // Solo esta ruta estará activa
        }))
      );
      
      // PASO 4: Limpiar cachés
      routesCache.current = { data: null, timestamp: 0, loaded: false };
      localStorage.removeItem(CACHE_KEY_ROUTES);
      localStorage.removeItem('mirat_static_cache');

      console.log("Ruta activada correctamente, cachés invalidados");
      
      // PASO 5: Recargar datos después de un delay
      setTimeout(() => {
        loadRoutes();
        setActivatingRouteId(null);
      }, 2000);
      
    } catch (error) {
      if (error.response?.status === 429 || error.message?.includes('429')) {
        console.warn("Rate limit alcanzado al activar ruta, reintentando...");
        
        setTimeout(async () => {
          try {
            // En el reintento, también desactivar todas primero
            const allTracksRetry = await GpxTrack.list().catch(() => []);
            const allActiveRoutes = allTracksRetry.filter(r => r.is_active && r.id !== routeId);
            for (const activeRoute of allActiveRoutes) {
              await GpxTrack.update(activeRoute.id, { is_active: false });
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            await GpxTrack.update(routeId, { is_active: true });
            
            setRoutes(prevRoutes => 
              prevRoutes.map(route => ({
                ...route,
                is_active: route.id === routeId
              }))
            );
            
            routesCache.current = { data: null, timestamp: 0, loaded: false };
            localStorage.removeItem(CACHE_KEY_ROUTES);
            localStorage.removeItem('mirat_static_cache');

            setTimeout(() => {
              loadRoutes();
              setActivatingRouteId(null);
            }, 2000);
            
          } catch (retryError) {
            console.error("Error en reintento de activación:", retryError);
            alert("No se pudo activar la ruta después de reintentar. Por favor, recarga la página e inténtalo de nuevo.");
            setActivatingRouteId(null);
          }
        }, 10000); // Increased retry delay for rate limit
        
      } else {
        console.error("Error activating route:", error);
        alert("Error al activar la ruta. Por favor, inténtalo de nuevo.");
        setActivatingRouteId(null);
      }
    }
  };

  const deleteRoute = async (routeId) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta ruta?")) {
      try {
        await GpxTrack.delete(routeId);
        
        // Clear cache and reload
        routesCache.current = { data: null, timestamp: 0, loaded: false };
        localStorage.removeItem(CACHE_KEY_ROUTES);
        
        // Pequeño delay antes de recargar para evitar rate limit
        setTimeout(() => {
          loadRoutes();
        }, 2000); // Increased delay
      } catch (error) {
        if (error.response?.status === 429 || error.message?.includes('429')) {
          alert("Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.");
          return;
        }
        console.error("Error deleting route:", error);
      }
    }
  };

  const handleSaveAccess = async (routeId, allowed_user_emails) => {
    try {
      await GpxTrack.update(routeId, { allowed_user_emails });
      setIsAccessModalOpen(false);
      
      // Clear cache and reload
      routesCache.current = { data: null, timestamp: 0, loaded: false };
      localStorage.removeItem(CACHE_KEY_ROUTES);
      
      // Pequeño delay antes de recargar para reflejar cambios
      setTimeout(() => {
        loadRoutes(); // Recargar para reflejar cambios
      }, 2000); // Increased delay
    } catch (error) {
      if (error.response?.status === 429 || error.message?.includes('429')) {
        alert("Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.");
        return;
      }
      console.error("Error updating route access:", error);
    }
  };

  const handleOpenAccessModal = (route) => {
    setSelectedRouteForAccess(route);
    setIsAccessModalOpen(true);
  };

  if (isLoading || !currentUser) {
    return <LoadingScreen message="Cargando biblioteca de rutas..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
            <Route className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
            Biblioteca de Rutas
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            {userRole === 'admin' 
              ? "Gestiona tus rutas GPX y activa la que quieres usar para navegación"
              : canUploadRoutes
                ? "Tus rutas y rutas compartidas contigo - Puedes subir nuevas rutas"
                : "Rutas disponibles para navegación"
            }
          </p>
          {/* Contador de rutas */}
          <p className="text-xs text-slate-400 mt-1">
            {routes.length} rutas disponibles
          </p>
        </div>
        
        <div className="flex gap-4">
          {/* MODIFIED: Show upload button for admin OR users with upload permission */}
          {canUploadRoutes && (
            <Link to={createPageUrl("UploadGpxPage")}>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Subir Ruta
              </Button>
            </Link>
          )}
          <Link to={createPageUrl("Navigation")}>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800 w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Navegación
            </Button>
          </Link>
        </div>
      </div>

      {routes.length === 0 ? (
        <Card className="bg-white border-slate-200 text-center py-8 sm:py-12">
          <CardContent>
            <div className="mb-6">
              <AppLogo className="w-16 h-16" showText={false} />
            </div>
            {canUploadRoutes ? (
              <>
                <Mountain className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">
                  No tienes rutas guardadas
                </h3>
                <p className="text-slate-500 mb-6 text-sm sm:text-base">
                  Sube tu primer archivo GPX para comenzar la navegación
                </p>
                <Link to={createPageUrl("UploadGpxPage")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Primera Ruta
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Lock className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">
                  No tienes acceso a ninguna ruta
                </h3>
                <p className="text-slate-500 text-sm sm:text-base">
                  Contacta con el administrador para que te asigne acceso a las rutas
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence>
            {routes.map((route) => {
              // Determinar si el usuario tiene acceso a esta ruta
              const hasAccess = userRole === 'admin' || 
                              route.created_by === currentUser?.email || 
                              (route.allowed_user_emails && route.allowed_user_emails.includes(currentUser?.email));

              const isOwner = route.created_by === currentUser?.email;
              const isActivating = activatingRouteId === route.id;

              return (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="group"
                >
                  <Card className={`bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 transition-all duration-200 h-full flex flex-col ${
                    route.is_active ? 'border-blue-500 bg-blue-50' : ''
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2 flex-wrap">
                            <span className="truncate">{route.name}</span>
                            {route.is_active && (
                              <Badge className="bg-blue-600 text-white text-xs flex-shrink-0">
                                ACTIVA
                              </Badge>
                            )}
                            {isOwner && (
                              <Badge className="bg-green-600 text-white text-xs flex-shrink-0">
                                TU RUTA
                              </Badge>
                            )}
                            {isActivating && (
                              <Badge className="bg-orange-500 text-white text-xs flex-shrink-0 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ACTIVANDO
                              </Badge>
                            )}
                          </CardTitle>
                          {route.description && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                              {route.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 flex-1 flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                        <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <MapPin className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="text-xs">Distancia</span>
                          </div>
                          <div className="font-bold text-slate-800 text-base sm:text-lg">
                            {route.total_distance?.toFixed(1) || 0}
                          </div>
                          <div className="text-xs text-slate-400">km</div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="text-xs">Desnivel</span>
                          </div>
                          <div className="font-bold text-slate-800 text-base sm:text-lg">
                            {route.total_elevation_gain?.toFixed(0) || 0}
                          </div>
                          <div className="text-xs text-slate-400">m</div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <Mountain className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="text-xs">Max Alt</span>
                          </div>
                          <div className="font-bold text-slate-800 text-sm sm:text-base">
                            {route.max_elevation?.toFixed(0) || 0}m
                          </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-200">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <Clock className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="text-xs">Subidas</span>
                          </div>
                          <div className="font-bold text-slate-800 text-sm sm:text-base">
                            {route.climb_segments?.length || 0}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 mb-4 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <UserCircle className="w-3.5 h-3.5" />
                          {(() => {
                            const cb = route.created_by;
                            if (cb && typeof cb === 'object') return cb.full_name || cb.email || 'Desconocido';
                            return cb || 'Desconocido';
                          })()}
                        </span>
                        <span>·</span>
                        <span>{format(new Date(route.created_date), "d MMM yyyy")}</span>
                      </div>
                    </CardContent>

                    <CardContent className="pt-0 flex flex-col justify-end"> {/* Use justify-end to push buttons to the bottom */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Activate Button - Always visible */}
                        <Button
                          onClick={() => activateRoute(route.id)}
                          disabled={route.is_active || isActivating}
                          size="sm"
                          className={`flex-1 min-w-[120px] text-xs sm:text-sm ${
                            route.is_active || isActivating
                              ? 'bg-blue-600 text-white cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isActivating ? (
                            <>
                              <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                              Activando...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
                              {route.is_active ? "Activa" : "Activar"}
                            </>
                          )}
                        </Button>

                        {/* NEW: Manage POIs Button - for owners with upload permission */}
                        {isOwner && canUploadRoutes && (
                          <Link to={createPageUrl(`RoutePoiManagement?routeId=${route.id}`)}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-purple-600 hover:text-purple-700 border-slate-300 hover:border-purple-400"
                              disabled={isActivating}
                            >
                              <MapPin className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                              POIs
                            </Button>
                          </Link>
                        )}

                        {/* Admin Controls */}
                        {userRole === 'admin' && (
                          <>
                            <Link to={createPageUrl(`RoutePoiManagement?routeId=${route.id}`)}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-purple-600 hover:text-purple-700 border-slate-300 hover:border-purple-400"
                                disabled={isActivating}
                              >
                                <MapPin className="w-3 sm:w-4 h-3 sm:h-4" />
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleOpenAccessModal(route)}
                              size="sm"
                              variant="outline"
                              className="text-slate-600 hover:text-slate-700 border-slate-300 hover:border-slate-400"
                              disabled={isActivating}
                            >
                              <Users className="w-3 sm:w-4 h-3 sm:h-4" />
                            </Button>
                          </>
                        )}

                        {/* Delete Button - for admin or owner */}
                        {(userRole === 'admin' || isOwner) && (
                          <Button
                            onClick={() => deleteRoute(route.id)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 border-slate-300 hover:border-red-400"
                            disabled={isActivating}
                          >
                            <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {isAccessModalOpen && userRole === 'admin' && (
          <ManageAccessForm
            route={selectedRouteForAccess}
            allUsers={allUsers.filter(u => u.role !== 'admin')}
            onSave={handleSaveAccess}
            onCancel={() => setIsAccessModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}