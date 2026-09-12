import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../lib/LanguageContext";
import { User, Team } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { getTraccarData } from "@/functions/getTraccarData";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, RefreshCw, Satellite, Filter } from "lucide-react";
import MapView from "../components/navigation/MapView";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function RunnerList({ runners, onSelectRunner, selectedRunnerId, en }) {
  if (!runners || runners.length === 0) {
    return (
      <div className="flex-1 p-4 text-center text-slate-500">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{en ? 'No active devices' : 'No hay dispositivos activos'}</p>
      </div>
    );
  }

  const getBatteryIcon = (batteryLevel) => {
    if (batteryLevel === null || batteryLevel === undefined) return "🔋";
    if (batteryLevel > 75) return "🔋";
    if (batteryLevel > 50) return "🔋";
    if (batteryLevel > 25) return "🪫";
    return "🪫";
  };

  const getBatteryColor = (batteryLevel) => {
    if (batteryLevel === null || batteryLevel === undefined) return "text-slate-500";
    if (batteryLevel > 50) return "text-green-600";
    if (batteryLevel > 25) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-slate-200">
        {runners.map((runner) => {
          const timeSinceUpdate = runner.last_update ? (Date.now() - new Date(runner.last_update).getTime()) / 60000 : null;
          const statusColor = runner.is_online ? 'text-green-600' : 'text-amber-600';
          const statusBg = runner.is_online ? 'bg-green-500' : 'bg-amber-500';
          const statusText = runner.is_online ? 'En línea' : timeSinceUpdate ? `${Math.round(timeSinceUpdate)}m sin actualizar` : 'Sin datos';

          return (
            <div
              key={runner.id}
              className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedRunnerId === runner.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
              onClick={() => onSelectRunner(runner)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: runner.color }}></div>
                    <h3 className="font-medium text-slate-800 truncate">{runner.device_name || runner.user_name}</h3>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">🏷️ {runner.team_name} • 👤 {runner.user_name}</p>
                    <p className="text-xs text-slate-500">📱 {runner.device_imei}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600">🏎️ {Math.round(runner.speed)} km/h</span>
                      <span className="text-slate-600">⛰️ {Math.round(runner.elevation)}m</span>
                      {runner.battery_level !== null && <span className={`font-medium ${getBatteryColor(runner.battery_level)}`}>{getBatteryIcon(runner.battery_level)} {runner.battery_level}%</span>}
                    </div>
                    <div className={`text-xs font-medium ${statusColor}`}>{statusText}</div>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full mt-2 ${statusBg}`}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CompanionTracking() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [allRunners, setAllRunners] = useState([]);
  const [filteredRunners, setFilteredRunners] = useState([]);
  const [teams, setTeams] = useState([]);
  const [accessibleTeams, setAccessibleTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [summaryInfo, setSummaryInfo] = useState(null);
  
  const loadData = useCallback(async () => { // Removed 'force' parameter from here
    setIsFetching(true);
    setApiError(null);
    try {
      const response = await getTraccarData(); // Changed to call without the 'force' object
      
      // Check if there's an error in the response
      if (response.data?.summary?.error) {
        throw new Error(response.data.summary.error);
      }

      const { data: runnersData, summary } = response.data;

      // This check is needed since the user object is not available here
      const user = await base44.auth.me();
      let userAccessibleTeams = await Team.list();
      let finalRunners = runnersData || []; // Handle empty data

      if (user.role !== 'admin') {
          userAccessibleTeams = userAccessibleTeams.filter(team => team.allowed_user_emails && team.allowed_user_emails.includes(user.email));
          const accessibleTeamIds = new Set(userAccessibleTeams.map(t => t.id));
          finalRunners = finalRunners.filter(runner => accessibleTeamIds.has(runner.team_id));
      }
      
      setAllRunners(finalRunners);
      setTeams(await Team.list()); // Fetch all teams for admin filter
      setAccessibleTeams(userAccessibleTeams);
      setSummaryInfo(summary);
      setLastUpdateTime(new Date());

    } catch (err) {
      console.error("Error loading Traccar data:", err);
      setApiError(en ? 'Unable to load tracking data. The server may be temporarily unavailable.' : 'Error al cargar datos de Traccar. El servidor puede estar temporalmente inaccesible.');
      // Set empty data but don't crash
      setAllRunners([]);
      setSummaryInfo({
        total_traccar_devices: 0,
        matched_app_devices: 0,
        onlineDevices: 0,
        devices_with_fresh_positions: 0
      });
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        await loadData();
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    init();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => loadData(), 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    let filtered = allRunners;
    if (selectedTeamId !== 'all') {
      filtered = allRunners.filter(runner => runner.team_id === selectedTeamId);
    }
    setFilteredRunners(filtered.sort((a, b) => (a.device_name || a.user_name).localeCompare(b.device_name || b.user_name)));
  }, [allRunners, selectedTeamId]);

  const handleSelectRunner = (runner) => {
    setSelectedPoint({ 
      lat: runner.latitude, 
      lng: runner.longitude, 
      name: runner.device_name || runner.user_name, 
      id: runner.id,
      runner: runner // Pasamos toda la info del runner
    });
  };

  const handleManualRefresh = () => loadData(); // Changed to call without argument

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">{en ? 'Connecting to Traccar...' : 'Conectando con Traccar...'}</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'admin' && accessibleTeams.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-center max-w-md mx-auto px-6">
        <div>
            <Users className="w-16 h-16 mx-auto mb-6 text-slate-400" />
            <h2 className="text-xl font-semibold text-slate-800 mb-3">{en ? 'No team access' : 'Sin acceso a equipos'}</h2>
            <p className="text-slate-500 mb-6 text-sm">{en ? 'You do not have permission to track any team.' : 'No tienes permisos para ver el seguimiento de ningún equipo.'}</p>
            <Link to={createPageUrl("Navigation")}><Button className="bg-blue-600 hover:bg-blue-700 text-white"><ArrowLeft className="w-4 h-4 mr-2" />{en ? 'Back' : 'Volver'}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3"><Satellite className="w-6 h-6 text-blue-600" />{en ? 'GPS Tracking' : 'Seguimiento GPS'}</h1>
            <Badge variant="secondary">{filteredRunners.length} dispositivos</Badge>
            {summaryInfo && userRole === 'admin' && (
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">🟢 {summaryInfo.onlineDevices} en línea</Badge>
                <Badge variant="outline" className="text-xs">📡 {summaryInfo.matched_app_devices}/{summaryInfo.total_traccar_devices} sincronizados</Badge>
                <Badge variant="outline" className="text-xs">🔄 {summaryInfo.devices_with_fresh_positions} con posición fresca</Badge>
                {lastUpdateTime && <Badge variant="outline" className="text-xs">🕐 {lastUpdateTime.toLocaleTimeString()}</Badge>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleManualRefresh} variant="ghost" size="sm" disabled={isFetching} title="Forzar actualización">
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Actualizando...' : 'Actualizar'}
            </Button>
            <Link to={createPageUrl("Navigation")}>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800">
                <ArrowLeft className="w-4 h-4 mr-2" />Volver
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/3 max-w-sm border-r border-slate-200 bg-white flex flex-col">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5"/>{en ? 'GPS Devices' : 'Dispositivos GPS'}</h2>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600 flex-shrink-0 flex items-center gap-1"><Filter className="w-3 h-3"/>{en ? 'Filter by team:' : 'Filtrar por equipo:'}</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-full h-8 text-sm"><SelectValue placeholder="Seleccionar equipo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{en ? 'All teams' : 'Todos los equipos'}</SelectItem>
                  {(userRole === 'admin' ? teams : accessibleTeams).map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }}></div>
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {apiError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">{apiError}</div>}
          </div>
          <RunnerList runners={filteredRunners} onSelectRunner={handleSelectRunner} selectedRunnerId={selectedPoint?.id} en={en} />
        </div>
        <div className="flex-1 relative">
          <MapView runners={filteredRunners} selectedPoint={selectedPoint} />
        </div>
      </main>
    </div>
  );
}
