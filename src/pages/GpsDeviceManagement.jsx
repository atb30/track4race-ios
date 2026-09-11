import React, { useState, useEffect } from "react";
import { GpsDevice, Runner, Team, User } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Plus, Edit, Trash2, ArrowLeft, Settings, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useLanguage } from "../lib/LanguageContext";

import GpsDeviceForm from "../components/gps/GpsDeviceForm";
import GpsConfigurationGuide from "../components/gps/GpsConfigurationGuide";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function GpsDeviceManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [devices, setDevices] = useState([]);
  const [runners, setRunners] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Estados para formularios
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'devices';

  useEffect(() => {
    const checkUserAndLoadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        loadData(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkUserAndLoadData();
  }, []);

  const loadData = async (currentUser) => {
    setIsLoading(true);
    try {
      const [devicesData, runnersData, teamsData] = await Promise.all([
        GpsDevice.list("-created_date"),
        Runner.list("-created_date"),
        Team.list("-created_date"),
      ]);
      
      // Filtrar datos según permisos del usuario
      let filteredDevices = devicesData;
      let filteredRunners = runnersData;
      
      if (currentUser.role !== 'admin') {
        // Obtener equipos a los que el usuario tiene acceso
        const accessibleTeams = teamsData.filter(team => 
          team.allowed_user_emails && 
          team.allowed_user_emails.includes(currentUser.email)
        );
        
        const accessibleTeamIds = accessibleTeams.map(t => t.id);
        
        // Filtrar dispositivos y corredores por equipos accesibles
        filteredDevices = devicesData.filter(device => 
          accessibleTeamIds.includes(device.team_id)
        );
        filteredRunners = runnersData.filter(runner => 
          accessibleTeamIds.includes(runner.team_id)
        );
      }
      
      setDevices(filteredDevices);
      setRunners(filteredRunners);
      setTeams(teamsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDevice = async (deviceData) => {
    try {
      // Añadir team_id del primer runner seleccionado
      const selectedRunner = runners.find(r => r.id === deviceData.runner_id);
      if (selectedRunner) {
        deviceData.team_id = selectedRunner.team_id;
      }
      
      if (editingDevice) {
        await GpsDevice.update(editingDevice.id, deviceData);
      } else {
        await GpsDevice.create(deviceData);
      }
      setShowDeviceForm(false);
      setEditingDevice(null);
      loadData(user);
    } catch (error) {
      console.error("Error saving GPS device:", error);
      throw error;
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (confirm("¿Estás seguro de que quieres eliminar este dispositivo GPS?")) {
      try {
        await GpsDevice.delete(deviceId);
        loadData(user);
      } catch (error) {
        console.error("Error deleting GPS device:", error);
      }
    }
  };

  const getRunnerName = (runnerId) => {
    const runner = runners.find(r => r.id === runnerId);
    return runner ? runner.name : "Corredor no encontrado";
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : "Equipo no encontrado";
  };

  const getStatusColor = (device) => {
    if (!device.last_seen) return "bg-gray-500";
    
    const lastSeen = new Date(device.last_seen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    
    if (diffMinutes < 2) return "bg-green-500";
    if (diffMinutes < 10) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusText = (device) => {
    if (!device.last_seen) return "Sin datos";
    
    const lastSeen = new Date(device.last_seen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    
    if (diffMinutes < 2) return "En línea";
    if (diffMinutes < 10) return "Reciente";
    return "Desconectado";
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-slate-300 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500">{en ? 'Loading GPS devices...' : 'Cargando dispositivos GPS...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3 mb-2">
            <Smartphone className="w-6 sm:w-8 h-6 sm:h-8 text-green-600" />
            {en ? 'ST-903 GPS Devices' : 'Dispositivos GPS ST-903'}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Gestiona y configura los dispositivos GPS Sinotrack ST-903 de tu equipo.
          </p>
        </div>
        <Link to={createPageUrl("RunnerManagement")}>
          <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800 w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {en ? 'Back to Runners' : 'Volver a Corredores'}
          </Button>
        </Link>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid grid-cols-2 w-full sm:w-80 mb-6 bg-slate-200">
          <TabsTrigger value="devices" className="flex items-center gap-2 text-xs sm:text-sm">
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'Devices' : 'Dispositivos'}</span>
            <span className="sm:hidden">{en ? 'Devices' : 'Dispositivos'}</span>
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2 text-xs sm:text-sm">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{en ? 'Configuration' : 'Configuración'}</span>
            <span className="sm:hidden">{en ? 'Config' : 'Config'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-semibold text-slate-700">
                {devices.length} {en ? 'Registered GPS Devices' : 'Dispositivos GPS Registrados'}
              </h2>
              <Button
                onClick={() => {
                  setEditingDevice(null);
                  setShowDeviceForm(true);
                }}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {en ? 'Register Device' : 'Registrar Dispositivo'}
              </Button>
            </div>
            
            {/* Mobile view */}
            <div className="block sm:hidden">
              {devices.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {en ? 'No GPS devices found.' : 'No se encontraron dispositivos GPS.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {devices.map((device) => (
                    <div key={device.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-800 truncate">{device.device_name}</h3>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-500 font-mono">{device.device_imei}</span>
                            </div>
                            <div className="text-xs text-slate-500">{getRunnerName(device.runner_id)}</div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(device)}`}></div>
                              <span className="text-xs text-slate-500">{getStatusText(device)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Zap className="w-3 h-3 text-slate-400" />
                              <span className="text-xs text-slate-500">{device.report_interval}s</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-500"
                            onClick={() => {
                              setSelectedDevice({ ...device, runner_name: getRunnerName(device.runner_id) });
                              setShowConfigGuide(true);
                            }}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-500"
                            onClick={() => {
                              setEditingDevice(device);
                              setShowDeviceForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-500"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-slate-50">
                    <TableHead className="text-slate-600">{en ? 'Device' : 'Dispositivo'}</TableHead>
                    <TableHead className="text-slate-600">IMEI</TableHead>
                    <TableHead className="text-slate-600">{en ? 'Runner' : 'Corredor'}</TableHead>
                    <TableHead className="text-slate-600">{en ? 'Team' : 'Equipo'}</TableHead>
                    <TableHead className="text-slate-600">{en ? 'Status' : 'Estado'}</TableHead>
                    <TableHead className="text-slate-600">{en ? 'Interval' : 'Intervalo'}</TableHead>
                    <TableHead className="text-slate-600 text-center">{en ? 'Actions' : 'Acciones'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-800">{device.device_name}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">{device.device_imei}</TableCell>
                      <TableCell className="text-slate-600">{getRunnerName(device.runner_id)}</TableCell>
                      <TableCell className="text-slate-600">{getTeamName(device.team_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(device)}`}></div>
                          <span className="text-sm">{getStatusText(device)}</span>
                          {device.last_seen && (
                            <span className="text-xs text-slate-400">
                              {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true, locale: es })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {device.report_interval}s
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-green-500"
                            onClick={() => {
                              setSelectedDevice({ ...device, runner_name: getRunnerName(device.runner_id) });
                              setShowConfigGuide(true);
                            }}
                            title="Ver guía de configuración"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-500"
                            onClick={() => {
                              setEditingDevice(device);
                              setShowDeviceForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-500"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {devices.length === 0 && (
                <div className="text-center py-12 text-slate-500">{en ? 'No GPS devices found.' : 'No se encontraron dispositivos GPS.'}</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guide">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-green-500" />
                {en ? 'ST-903 General Configuration Guide' : 'Guía de Configuración General ST-903'}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">{en ? 'General Steps:' : 'Pasos Generales:'}</h3>
                  <ol className="list-decimal list-inside space-y-2 text-green-700">
                    <li>{en ? 'Register the GPS device in the “Devices” tab' : 'Registra el dispositivo GPS en la pestaña "Dispositivos"'}</li>
                    <li>{en ? 'Click the configuration button (⚙️) for the device' : 'Haz clic en el botón de configuración (⚙️) del dispositivo específico'}</li>
                    <li>{en ? 'Follow the personalized SMS instructions' : 'Sigue las instrucciones SMS personalizadas para ese dispositivo'}</li>
                    <li>{en ? 'Verify that the device appears “Online” within 1–2 minutes' : 'Verifica que el dispositivo aparezca "En línea" en 1-2 minutos'}</li>
                  </ol>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">{en ? 'Device Requirements:' : 'Requisitos del Dispositivo:'}</h3>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>{en ? 'Active SIM card with mobile data' : 'Tarjeta SIM activa con datos móviles'}</li>
                    <li>{en ? 'Enough credit to receive configuration SMS' : 'Saldo suficiente para recibir SMS de configuración'}</li>
                    <li>{en ? 'GPS antenna with a clear signal (outdoors recommended)' : 'Antena GPS con señal clara (exterior recomendado)'}</li>
                    <li>{en ? 'Battery charged to 100%' : 'Batería cargada al 100%'}</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">{en ? 'Troubleshooting:' : 'Solución de Problemas:'}</h3>
                  <ul className="list-disc list-inside space-y-1 text-amber-700">
                    <li><strong>{en ? 'Device does not respond:' : 'El dispositivo no responde:'}</strong> {en ? 'Check its battery and mobile coverage' : 'Verifica que tenga batería y cobertura móvil'}</li>
                    <li><strong>{en ? 'Not shown on the map:' : 'No aparece en el mapa:'}</strong> {en ? 'Resend the “STATUS#” command and check the configuration' : 'Reenvía el comando "STATUS#" y verifica la configuración'}</li>
                    <li><strong>{en ? 'Inaccurate location:' : 'Ubicación imprecisa:'}</strong> {en ? 'Make sure it is outdoors with a good GPS signal' : 'Asegúrate de que esté en exterior con buena señal GPS'}</li>
                    <li><strong>{en ? 'Disconnects frequently:' : 'Se desconecta frecuentemente:'}</strong> {en ? 'Check the battery and mobile signal quality' : 'Revisa la batería y la calidad de señal móvil'}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showDeviceForm && (
          <GpsDeviceForm
            device={editingDevice}
            runners={runners}
            onSave={handleSaveDevice}
            onCancel={() => {
              setShowDeviceForm(false);
              setEditingDevice(null);
            }}
          />
        )}
        {showConfigGuide && selectedDevice && (
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
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-white rounded-lg">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {en ? 'Configuration' : 'Configuración'}: {selectedDevice.device_name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowConfigGuide(false);
                      setSelectedDevice(null);
                    }}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <GpsConfigurationGuide device={selectedDevice} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
