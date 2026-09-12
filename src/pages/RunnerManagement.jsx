import React, { useState, useEffect } from "react";
import { Runner, Team, User, GpsDevice } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { getTraccarData } from "@/functions/getTraccarData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Edit, Trash2, UserCheck, Smartphone, FileText, Satellite, AlertTriangle, RefreshCw } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import RunnerForm from "../components/runners/RunnerForm";
import TeamForm from "../components/runners/TeamForm";
import GpsDeviceForm from "../components/gps/GpsDeviceForm";
import GpsConfigurationGuide from "../components/gps/GpsConfigurationGuide";
import TraccarSyncPanel from "../components/gps/TraccarSyncPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoadingScreen from "../components/common/LoadingScreen";
import { useLanguage } from "../lib/LanguageContext";

export default function RunnerManagement() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [runners, setRunners] = useState([]);
  const [teams, setTeams] = useState([]);
  const [gpsDevices, setGpsDevices] = useState([]);
  const [liveGpsData, setLiveGpsData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [showRunnerForm, setShowRunnerForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingRunner, setEditingRunner] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [traccarCredsMissing, setTraccarCredsMissing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'runners';

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [runnersData, teamsData, devicesData, usersData, traccarResponse] = await Promise.all([
        Runner.list("-created_date"),
        Team.list("-created_date"),
        GpsDevice.list("-created_date"),
        User.list(),
        getTraccarData(),
      ]);
      setRunners(runnersData);
      setTeams(teamsData);
      setGpsDevices(devicesData);
      setAllUsers(usersData);
      setLiveGpsData(traccarResponse.data.data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkUserAndLoad = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        if (user.role !== 'admin') {
          window.location.href = createPageUrl("Navigation");
          return;
        }
        await loadAllData();
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkUserAndLoad();
  }, []);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        setIsRefreshing(true);
        try {
          const traccarResponse = await getTraccarData();
          setLiveGpsData(traccarResponse.data.data || []);
          setLastUpdate(new Date());
        } catch (error) { console.error("Auto-refresh failed:", error); }
        finally { setIsRefreshing(false); }
      }
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleSaveRunner = async (data) => { await (editingRunner ? Runner.update(editingRunner.id, data) : Runner.create(data)); setShowRunnerForm(false); loadAllData(); };
  const handleSaveTeam = async (data) => { await (editingTeam ? Team.update(editingTeam.id, data) : Team.create(data)); setShowTeamForm(false); loadAllData(); };
  const handleSaveDevice = async (data) => { await (editingDevice ? GpsDevice.update(editingDevice.id, data) : GpsDevice.create(data)); setShowDeviceForm(false); loadAllData(); };
  const handleDelete = async (entity, id, confirmMsg) => { if (confirm(confirmMsg)) { await entity.delete(id); loadAllData(); } };

  const getLiveDataForDevice = (imei) => liveGpsData.find(d => d.device_imei === imei);

  if (isLoading || !userRole) {
    return <LoadingScreen message={en ? 'Loading runner management...' : 'Cargando gestión de corredores...'} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Users className="w-8 h-8 text-blue-600" />{en ? 'Runners and Teams' : 'Gestión de Corredores y Equipos'}</h1>
        {/* El botón de volver al mapa ya no es necesario aquí */}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid grid-cols-4 w-full sm:w-auto mb-6 bg-slate-200">
          <TabsTrigger value="runners"><UserCheck className="w-4 h-4 mr-2"/>{en ? 'Runners' : 'Corredores'}</TabsTrigger>
          <TabsTrigger value="devices"><Smartphone className="w-4 h-4 mr-2"/>{en ? 'Devices' : 'Dispositivos'}</TabsTrigger>
          <TabsTrigger value="teams"><Users className="w-4 h-4 mr-2"/>{en ? 'Teams' : 'Equipos'}</TabsTrigger>
          <TabsTrigger value="traccar"><Satellite className="w-4 h-4 mr-2"/>{en ? 'Traccar' : 'Traccar'}</TabsTrigger>
        </TabsList>

        <TabsContent value="runners">
          <Card>
             <div className="p-4 flex justify-between items-center"><h2 className="text-lg font-semibold">{runners.length} {en ? 'Runners' : 'Corredores'}</h2><Button onClick={() => { setEditingRunner(null); setShowRunnerForm(true); }}><Plus className="w-4 h-4 mr-2"/>{en ? 'Add' : 'Añadir'}</Button></div>
             <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>{en ? 'Name' : 'Nombre'}</TableHead><TableHead>{en ? 'Device' : 'Dispositivo'}</TableHead><TableHead>{en ? 'Team' : 'Equipo'}</TableHead><TableHead>{en ? 'Status' : 'Estado'}</TableHead><TableHead>{en ? 'Actions' : 'Acciones'}</TableHead></TableRow></TableHeader>
                <TableBody>{runners.map(r => { const team = teams.find(t=>t.id===r.team_id); return (<TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono">{r.device_id}</TableCell>
                    <TableCell>{team && <Badge style={{backgroundColor:`${team.color}20`,color:team.color}}>{team.name}</Badge>}</TableCell>
                      <TableCell><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? (en ? 'Active' : 'Activo') : (en ? 'Inactive' : 'Inactivo')}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => { setEditingRunner(r); setShowRunnerForm(true); }}><Edit className="w-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(Runner, r.id, en ? 'Delete runner?' : 'Eliminar corredor?')}><Trash2 className="w-4"/></Button></TableCell>
                </TableRow>);})}</TableBody>
             </Table></div>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <div className="p-4 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold">{gpsDevices.length} {en ? 'GPS Devices' : 'Dispositivos GPS'}</h2>
                    {lastUpdate && <p className="text-xs text-slate-500">{en ? 'Locations updated' : 'Ubicaciones actualizadas'} {en ? `${Math.round((new Date() - lastUpdate) / 1000)}s ago` : `hace ${Math.round((new Date() - lastUpdate) / 1000)}s`} <RefreshCw className={`inline w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}/></p>}
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowConfigGuide(true)} variant="outline"><FileText className="w-4 h-4 mr-2" />{en ? 'Guide' : 'Guía'}</Button>
                    <Button onClick={() => { setEditingDevice(null); setShowDeviceForm(true); }}><Plus className="w-4 h-4 mr-2"/>{en ? 'Add Device' : 'Añadir Dispositivo'}</Button>
                </div>
            </div>
            <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>{en ? 'Name' : 'Nombre'}</TableHead><TableHead>IMEI</TableHead><TableHead>{en ? 'Runner' : 'Corredor'}</TableHead><TableHead>{en ? 'Status' : 'Estado'}</TableHead><TableHead>{en ? 'Battery' : 'Batería'}</TableHead><TableHead>{en ? 'Actions' : 'Acciones'}</TableHead></TableRow></TableHeader>
                <TableBody>{gpsDevices.map(d => {
                    const runner = runners.find(r => r.id === d.runner_id);
                    const liveData = getLiveDataForDevice(d.device_imei);
                    return (<TableRow key={d.id}>
                        <TableCell className="font-medium">{d.device_name}</TableCell>
                        <TableCell className="font-mono">{d.device_imei}</TableCell>
                        <TableCell>{runner?.name || 'N/A'}</TableCell>
                        <TableCell>{liveData ? <Badge variant={liveData.is_online ? 'default' : 'destructive'}>{liveData.is_online ? (en ? 'Online' : 'En línea') : 'Offline'}</Badge> : <Badge variant="secondary">N/A</Badge>}</TableCell>
                        <TableCell>{liveData?.battery_level !== null ? `${liveData?.battery_level}%` : 'N/A'}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => { setEditingDevice(d); setShowDeviceForm(true); }}><Edit className="w-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(GpsDevice, d.id, en ? 'Delete device?' : 'Eliminar dispositivo?')}><Trash2 className="w-4"/></Button></TableCell>
                    </TableRow>);
                })}</TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
            <Card>
                <div className="p-4 flex justify-between items-center"><h2 className="text-lg font-semibold">{teams.length} {en ? 'Teams' : 'Equipos'}</h2><Button onClick={() => { setEditingTeam(null); setShowTeamForm(true); }}><Plus className="w-4 h-4 mr-2"/>{en ? 'New Team' : 'Nuevo Equipo'}</Button></div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(t => <div key={t.id} className="bg-slate-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start"><h3 className="font-semibold" style={{color:t.color}}>{t.name}</h3><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingTeam(t); setShowTeamForm(true); }}><Edit className="w-4"/></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(Team, t.id, en ? 'Delete team?' : 'Eliminar equipo?')}><Trash2 className="w-4"/></Button></div></div>
                        <p className="text-sm text-slate-600">{t.description || (en ? 'No description' : 'Sin descripción')}</p>
                        <p className="text-xs text-slate-500 mt-2">{runners.filter(r=>r.team_id===t.id).length} corredores</p>
                    </div>)}
                </div>
            </Card>
        </TabsContent>
        
        <TabsContent value="traccar">
            <div className="space-y-6">
                <TraccarSyncPanel onTokenError={() => setTraccarCredsMissing(true)} />
                {traccarCredsMissing && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{en ? 'Traccar credentials missing' : 'Faltan Credenciales de Traccar'}</AlertTitle><AlertDescription>{en ? 'An administrator must configure the `TRACCAR_URL`, `TRACCAR_USER`, and `TRACCAR_PASSWORD` secrets to use the import.' : 'Para usar la importación, un administrador debe configurar los secretos `TRACCAR_URL`, `TRACCAR_USER`, y `TRACCAR_PASSWORD`.'}</AlertDescription></Alert>}
            </div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showRunnerForm && <RunnerForm runner={editingRunner} teams={teams} onSave={handleSaveRunner} onCancel={() => setShowRunnerForm(false)} />}
        {showTeamForm && <TeamForm team={editingTeam} onSave={handleSaveTeam} onCancel={() => setShowTeamForm(false)} allUsers={allUsers} />}
        {showDeviceForm && <GpsDeviceForm device={editingDevice} runners={runners} teams={teams} onSave={handleSaveDevice} onCancel={() => setShowDeviceForm(false)} />}
        {showConfigGuide && <GpsConfigurationGuide onCancel={() => setShowConfigGuide(false)} language={language} />}
      </AnimatePresence>
    </div>
  );
}

