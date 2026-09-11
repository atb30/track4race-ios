import React, { useState, useEffect } from "react";
import { User, GpxTrack, Team } from "@/entities/all"; import { base44 } from "@/api/base44Client"; // Added Team
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Lock, Shield, UserMinus, Info, Save, Route as RouteIcon, Upload } from "lucide-react"; // Added Upload
import { createPageUrl } from "@/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs components
import { useLanguage } from "../lib/LanguageContext";

export default function UserManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [allUsers, setAllUsers] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [allTeams, setAllTeams] = useState([]); // New state for teams
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Estados para rutas
  const [selectedUserId, setSelectedUserId] = useState("");
  const [allowedRouteIds, setAllowedRouteIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAvailableRoutes, setSelectedAvailableRoutes] = useState([]);
  const [selectedAccessRoutes, setSelectedAccessRoutes] = useState([]);

  // Estados para equipos (nuevos)
  const [selectedUserIdTeams, setSelectedUserIdTeams] = useState("");
  const [allowedTeamIds, setAllowedTeamIds] = useState([]);
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  const [selectedAvailableTeams, setSelectedAvailableTeams] = useState([]);
  const [selectedAccessTeams, setSelectedAccessTeams] = useState([]);

  useEffect(() => {
    const checkUserAndLoadData = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        if (user.role !== 'admin') {
          window.location.href = createPageUrl("Routes");
          return;
        }
        await loadData();
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkUserAndLoadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      if (selectedUser) {
        // Incluir rutas asignadas por el admin Y rutas subidas por el usuario (propietario)
        const initiallyAllowed = allRoutes
          .filter(route =>
            route.allowed_user_emails?.includes(selectedUser.email) ||
            route.created_by === selectedUser.email
          )
          .map(route => route.id);
        setAllowedRouteIds(initiallyAllowed);
      }
    } else {
      setAllowedRouteIds([]);
    }
    // Reset selections when user changes
    setSelectedAvailableRoutes([]);
    setSelectedAccessRoutes([]);
  }, [selectedUserId, allRoutes, allUsers]);

  // New useEffect for teams
  useEffect(() => {
    if (selectedUserIdTeams) {
      const selectedUser = allUsers.find(u => u.id === selectedUserIdTeams);
      if (selectedUser) {
        const initiallyAllowed = allTeams
          .filter(team => team.allowed_user_emails?.includes(selectedUser.email))
          .map(team => team.id);
        setAllowedTeamIds(initiallyAllowed);
      }
    } else {
      setAllowedTeamIds([]);
    }
    // Reset selections when user changes
    setSelectedAvailableTeams([]);
    setSelectedAccessTeams([]);
  }, [selectedUserIdTeams, allTeams, allUsers]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, routesData, teamsData] = await Promise.all([ // Added teamsData
        User.list(),
        GpxTrack.list(),
        Team.list(), // Load teams
      ]);
      setAllUsers(usersData);
      setAllRoutes(routesData);
      setAllTeams(teamsData); // Set teams
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Routes functions (existing, renamed for clarity)
  const handleAddRoutes = () => {
    // Ensure no duplicates are added
    const newAllowed = [...new Set([...allowedRouteIds, ...selectedAvailableRoutes])];
    setAllowedRouteIds(newAllowed);
    setSelectedAvailableRoutes([]); // Clear selection after adding
  };

  const handleRemoveRoutes = () => {
    const newAllowed = allowedRouteIds.filter(id => !selectedAccessRoutes.includes(id));
    setAllowedRouteIds(newAllowed);
    setSelectedAccessRoutes([]); // Clear selection after removing
  };

  const handleSelectAvailableRoute = (routeId) => {
    setSelectedAvailableRoutes(prev =>
      prev.includes(routeId)
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId]
    );
  };

  const handleSelectAccessRoute = (routeId) => {
    setSelectedAccessRoutes(prev =>
      prev.includes(routeId)
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId]
    );
  };
  
  const handleSelectAllRoutes = () => setAllowedRouteIds(allRoutes.map(r => r.id)); // Renamed
  const handleDeselectAllRoutes = () => setAllowedRouteIds([]); // Renamed

  // Teams functions (new)
  const handleAddTeams = () => {
    const newAllowed = [...new Set([...allowedTeamIds, ...selectedAvailableTeams])];
    setAllowedTeamIds(newAllowed);
    setSelectedAvailableTeams([]);
  };

  const handleRemoveTeams = () => {
    const newAllowed = allowedTeamIds.filter(id => !selectedAccessTeams.includes(id));
    setAllowedTeamIds(newAllowed);
    setSelectedAccessTeams([]);
  };

  const handleSelectAvailableTeam = (teamId) => {
    setSelectedAvailableTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSelectAccessTeam = (teamId) => {
    setSelectedAccessTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSelectAllTeams = () => setAllowedTeamIds(allTeams.map(t => t.id));
  const handleDeselectAllTeams = () => setAllowedTeamIds([]);

  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    
    setIsSaving(true);
    const selectedUser = allUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      setIsSaving(false);
      return;
    }

    try {
      const updatePromises = allRoutes.map(route => {
        const isCurrentlyAllowed = route.allowed_user_emails?.includes(selectedUser.email);
        const shouldBeAllowed = allowedRouteIds.includes(route.id);

        if (isCurrentlyAllowed === shouldBeAllowed) return Promise.resolve();

        const newEmails = shouldBeAllowed
          ? [...(route.allowed_user_emails || []), selectedUser.email]
          : (route.allowed_user_emails || []).filter(email => email !== selectedUser.email);
        
        // Remove duplicates and sort to ensure consistent arrays
        const uniqueNewEmails = Array.from(new Set(newEmails)).sort();

        return GpxTrack.update(route.id, { allowed_user_emails: uniqueNewEmails });
      });
      
      await Promise.all(updatePromises);
      await loadData();
    } catch (error) {
      console.error("Error updating user access:", error);
      alert("Error al guardar los permisos de rutas.");
    } finally {
      setIsSaving(false);
    }
  };

  // New function to save team permissions
  const handleSaveTeamPermissions = async () => {
    if (!selectedUserIdTeams) return;
    
    setIsSavingTeams(true);
    const selectedUser = allUsers.find(u => u.id === selectedUserIdTeams);
    if (!selectedUser) {
      setIsSavingTeams(false);
      return;
    }

    try {
      const updatePromises = allTeams.map(team => {
        const isCurrentlyAllowed = team.allowed_user_emails?.includes(selectedUser.email);
        const shouldBeAllowed = allowedTeamIds.includes(team.id);

        if (isCurrentlyAllowed === shouldBeAllowed) return Promise.resolve();

        const newEmails = shouldBeAllowed
          ? [...(team.allowed_user_emails || []), selectedUser.email]
          : (team.allowed_user_emails || []).filter(email => email !== selectedUser.email);
        
        const uniqueNewEmails = Array.from(new Set(newEmails)).sort();

        return Team.update(team.id, { allowed_user_emails: uniqueNewEmails });
      });
      
      await Promise.all(updatePromises);
      await loadData();
    } catch (error) {
      console.error("Error updating team access:", error);
      alert("Error al guardar los permisos de equipos.");
    } finally {
      setIsSavingTeams(false);
    }
  };

  const handleToggleUserRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMessage = `¿Estás seguro de que quieres ${newRole === 'admin' ? 'dar permisos de administrador' : 'quitar permisos de administrador'} a este usuario?`;
    
    if (confirm(confirmMessage)) {
      try {
        await User.update(userId, { role: newRole });
        if(newRole === 'admin') {
            setSelectedUserId(""); // Deselect user if they become admin (routes tab)
            setSelectedUserIdTeams(""); // Deselect user if they become admin (teams tab)
        }
        await loadData();
      } catch (error) {
        console.error("Error updating user role:", error);
        alert("Error al cambiar el rol del usuario");
      }
    }
  };

  // NEW: Toggle upload routes permission
  const handleToggleUploadPermission = async (userId, currentValue) => {
    const newValue = !currentValue;
    const confirmMessage = newValue 
      ? "¿Permitir que este usuario suba sus propias rutas?" 
      : "¿Quitar permiso para subir rutas?";
    
    if (confirm(confirmMessage)) {
      try {
        await User.update(userId, { can_upload_routes: newValue });
        await loadData();
      } catch (error) {
        console.error("Error updating upload permission:", error);
        alert("Error al cambiar el permiso de subida de rutas");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500">Cargando usuarios...</p>
      </div>
    );
  }

  const adminUsers = allUsers.filter(u => u.role === 'admin');
  const regularUsers = allUsers.filter(u => u.role !== 'admin');

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            {en ? 'User Management' : 'Gestión de Usuarios'}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            {en ? 'Manage roles, route upload permissions, and route and team access for each user.' : 'Gestiona roles, permisos de subida de rutas y acceso a rutas y equipos para cada usuario.'}
          </p>
        </div>
      </div>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-700">
          <strong>{en ? 'Note:' : 'Nota:'}</strong> {en ? 'To add users, go to Dashboard → Users → Invite User in the Base44 console.' : 'Para añadir nuevos usuarios, ve al Dashboard → Users → Invite User en la consola de base44.'}
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Administradores ({adminUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adminUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <p className="font-medium text-slate-800">{user.full_name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleUserRole(user.id, user.role)} className="text-slate-500 hover:text-amber-600" title="Revocar permisos de administrador">
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* NEW: Usuarios Regulares con permisos de subida */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {en ? 'Regular Users' : 'Usuarios Regulares'} ({regularUsers.length})
            </CardTitle>
            <CardDescription>
              Gestiona permisos individuales de cada usuario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regularUsers.map((user) => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">{user.full_name}</p>
                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    {user.can_upload_routes && (
                      <Badge className="mt-1 bg-green-100 text-green-700 border-green-300">
                        Puede subir rutas
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleToggleUploadPermission(user.id, user.can_upload_routes)}
                      variant={user.can_upload_routes ? "default" : "outline"}
                      size="sm"
                      className={user.can_upload_routes ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {user.can_upload_routes ? "Subida Activa" : "Activar Subida"}
                    </Button>
                    <Button
                      onClick={() => handleToggleUserRole(user.id, user.role)}
                      variant="outline"
                      size="sm"
                    >
                      <Shield className="w-4 h-4 mr-2 text-green-600" />
                      Hacer Admin
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              Gestionar Permisos de Usuarios
            </CardTitle>
            <CardDescription>
                Selecciona un usuario regular para gestionar el acceso a rutas y equipos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="routes" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="routes" className="flex items-center gap-2">
                  <RouteIcon className="w-4 h-4" />
                  Acceso a Rutas
                </TabsTrigger>
                <TabsTrigger value="teams" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Acceso a Equipos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="routes" className="mt-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecciona un usuario..." />
                          </SelectTrigger>
                          <SelectContent>
                              {regularUsers.map(user => (
                                  <SelectItem key={user.id} value={user.id}>{user.full_name} ({user.email})</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      {selectedUserId && (
                          <Button onClick={() => handleToggleUserRole(selectedUserId, 'user')} variant="outline" size="sm" className="w-full sm:w-auto">
                              <Shield className="mr-2 h-4 w-4 text-green-600"/> Promover a Admin
                          </Button>
                      )}
                  </div>

                  <AnimatePresence>
                  {selectedUserId && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-4 border-t border-slate-200 space-y-4">
                          <div className="flex justify-between items-center">
                              <h4 className="font-medium text-slate-700">Gestionar Acceso a Rutas</h4>
                              <div className="flex gap-2">
                                  <Button type="button" size="xs" variant="outline" onClick={handleSelectAllRoutes}>Todas</Button>
                                  <Button type="button" size="xs" variant="outline" onClick={handleDeselectAllRoutes}>Ninguna</Button>
                              </div>
                          </div>
                          
                          {/* Dual List Box Interface */}
                          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                              {/* Available Routes (Left) */}
                              <div className="space-y-2">
                                  <h5 className="font-medium text-sm text-slate-600">Rutas Disponibles</h5>
                                  <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto bg-slate-50">
                                      {allRoutes.filter(route => !allowedRouteIds.includes(route.id)).length === 0 ? (
                                          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                              No hay rutas disponibles
                                          </div>
                                      ) : (
                                          <div className="p-2 space-y-1">
                                              {allRoutes.filter(route => !allowedRouteIds.includes(route.id)).map(route => (
                                                  <div
                                                      key={`available-${route.id}`}
                                                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                                                          selectedAvailableRoutes.includes(route.id)
                                                              ? 'bg-blue-100 border border-blue-300'
                                                              : 'hover:bg-slate-100'
                                                      }`}
                                                      onClick={() => handleSelectAvailableRoute(route.id)}
                                                  >
                                                      <div className="font-medium text-slate-800">{route.name}</div>
                                                      <div className="text-xs text-slate-500">{route.total_distance?.toFixed(1)} km</div>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              </div>

                              {/* Control Buttons (Middle) */}
                              <div className="flex lg:flex-col gap-2 justify-center">
                                  <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={selectedAvailableRoutes.length === 0}
                                      onClick={handleAddRoutes}
                                      className="flex items-center gap-2"
                                  >
                                      <span className="hidden lg:inline">→</span>
                                      <span className="lg:hidden">↓</span>
                                      <span className="hidden sm:inline">Añadir</span>
                                  </Button>
                                  <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={selectedAccessRoutes.length === 0}
                                      onClick={handleRemoveRoutes}
                                      className="flex items-center gap-2"
                                  >
                                      <span className="hidden lg:inline">←</span>
                                      <span className="lg:hidden">↑</span>
                                      <span className="hidden sm:inline">Quitar</span>
                                  </Button>
                              </div>

                              {/* User's Routes (Right) */}
                              <div className="space-y-2">
                                  <h5 className="font-medium text-sm text-slate-600">Rutas con Acceso</h5>
                                  <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto bg-green-50">
                                      {allRoutes.filter(route => allowedRouteIds.includes(route.id)).length === 0 ? (
                                          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                              Sin acceso a rutas
                                          </div>
                                      ) : (
                                          <div className="p-2 space-y-1">
                                              {allRoutes.filter(route => allowedRouteIds.includes(route.id)).map(route => (
                                                  <div
                                                      key={`access-${route.id}`}
                                                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                                                          selectedAccessRoutes.includes(route.id)
                                                              ? 'bg-red-100 border border-red-300'
                                                              : 'hover:bg-green-100'
                                                      }`}
                                                      onClick={() => handleSelectAccessRoute(route.id)}
                                                  >
                                                      <div className="font-medium text-slate-800">{route.name}</div>
                                                      <div className="text-xs text-slate-500">{route.total_distance?.toFixed(1)} km</div>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* Stats */}
                          <div className="flex justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded">
                              <span>Disponibles: {allRoutes.filter(route => !allowedRouteIds.includes(route.id)).length}</span>
                              <span>Con acceso: {allowedRouteIds.length}</span>
                          </div>

                          <div className="flex justify-end">
                              <Button onClick={handleSavePermissions} disabled={isSaving}>
                                  {isSaving ? (<div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Guardando...</div>) : (<><Save className="w-4 h-4 mr-2" />Guardar Cambios</>)}
                              </Button>
                          </div>
                      </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </TabsContent>

              <TabsContent value="teams" className="mt-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <Select value={selectedUserIdTeams} onValueChange={setSelectedUserIdTeams}>
                          <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecciona un usuario..." />
                          </SelectTrigger>
                          <SelectContent>
                              {regularUsers.map(user => (
                                  <SelectItem key={user.id} value={user.id}>{user.full_name} ({user.email})</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      {selectedUserIdTeams && (
                          <Button onClick={() => handleToggleUserRole(selectedUserIdTeams, 'user')} variant="outline" size="sm" className="w-full sm:w-auto">
                              <Shield className="mr-2 h-4 w-4 text-green-600"/> Promover a Admin
                          </Button>
                      )}
                  </div>

                  <AnimatePresence>
                    {selectedUserIdTeams && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-4 border-t border-slate-200 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-slate-700">Gestionar Acceso a Equipos</h4>
                          <div className="flex gap-2">
                            <Button type="button" size="xs" variant="outline" onClick={handleSelectAllTeams}>Todos</Button>
                            <Button type="button" size="xs" variant="outline" onClick={handleDeselectAllTeams}>Ninguno</Button>
                          </div>
                        </div>
                        
                        {/* Dual List Box Interface for Teams */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          {/* Available Teams (Left) */}
                          <div className="space-y-2">
                            <h5 className="font-medium text-sm text-slate-600">Equipos Disponibles</h5>
                            <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto bg-slate-50">
                              {allTeams.filter(team => !allowedTeamIds.includes(team.id)).length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                  No hay equipos disponibles
                                </div>
                              ) : (
                                <div className="p-2 space-y-1">
                                  {allTeams.filter(team => !allowedTeamIds.includes(team.id)).map(team => (
                                    <div
                                      key={`available-${team.id}`}
                                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                                        selectedAvailableTeams.includes(team.id)
                                          ? 'bg-blue-100 border border-blue-300'
                                          : 'hover:bg-slate-100'
                                      }`}
                                      onClick={() => handleSelectAvailableTeam(team.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: team.color }}
                                        ></div>
                                        <div className="font-medium text-slate-800">{team.name}</div>
                                      </div>
                                      <div className="text-xs text-slate-500">{team.description || 'Sin descripción'}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Control Buttons (Middle) */}
                          <div className="flex lg:flex-col gap-2 justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={selectedAvailableTeams.length === 0}
                              onClick={handleAddTeams}
                              className="flex items-center gap-2"
                            >
                              <span className="hidden lg:inline">→</span>
                              <span className="lg:hidden">↓</span>
                              <span className="hidden sm:inline">Añadir</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={selectedAccessTeams.length === 0}
                              onClick={handleRemoveTeams}
                              className="flex items-center gap-2"
                            >
                              <span className="hidden lg:inline">←</span>
                              <span className="lg:hidden">↑</span>
                              <span className="hidden sm:inline">Quitar</span>
                            </Button>
                          </div>

                          {/* User's Teams (Right) */}
                          <div className="space-y-2">
                            <h5 className="font-medium text-sm text-slate-600">Equipos con Acceso</h5>
                            <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto bg-green-50">
                              {allTeams.filter(team => allowedTeamIds.includes(team.id)).length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                  Sin acceso a equipos
                                </div>
                              ) : (
                                <div className="p-2 space-y-1">
                                  {allTeams.filter(team => allowedTeamIds.includes(team.id)).map(team => (
                                    <div
                                      key={`access-${team.id}`}
                                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                                        selectedAccessTeams.includes(team.id)
                                          ? 'bg-red-100 border border-red-300'
                                          : 'hover:bg-green-100'
                                      }`}
                                      onClick={() => handleSelectAccessTeam(team.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: team.color }}
                                        ></div>
                                        <div className="font-medium text-slate-800">{team.name}</div>
                                      </div>
                                      <div className="text-xs text-slate-500">{team.description || 'Sin descripción'}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded">
                          <span>Disponibles: {allTeams.filter(team => !allowedTeamIds.includes(team.id)).length}</span>
                          <span>Con acceso: {allowedTeamIds.length}</span>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={handleSaveTeamPermissions} disabled={isSavingTeams}>
                            {isSavingTeams ? (<div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Guardando...</div>) : (<><Save className="w-4 h-4 mr-2" />Guardar Cambios</>)}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
