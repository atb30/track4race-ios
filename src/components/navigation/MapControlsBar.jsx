import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, Layers, ChevronDown, Settings, Milestone, BarChart3, Users, Wind, ArrowRight, Check, CloudRain, Navigation as NavIcon } from "lucide-react";

export default function MapControlsBar({
  showPois, setShowPois,
  showRainRadar, setShowRainRadar,
  mapType, setMapType,
  showKmMarkers, setShowKmMarkers,
  showElevationProfile, setShowElevationProfile,
  showRunners, setShowRunners,
  showWindArrowsOnMap, setShowWindArrowsOnMap,
  showRouteArrows, setShowRouteArrows,
  showTurnByTurn, setShowTurnByTurn
}) {
  return (
    <div className="navigation-controls-bar absolute top-2 left-1/2 transform -translate-x-1/2 z-[1002] w-[95vw] max-w-5xl">
      {/* MOBILE VIEW - Ultra simplified */}
      <div className="lg:hidden flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPois(!showPois)}
          className={`h-8 px-3 rounded-full backdrop-blur-sm shadow-lg border text-xs ${
            showPois ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white/90 text-slate-700 border-slate-200'
          }`}
        >
          <MapPin className="w-3 h-3 mr-1" />
          POI
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRainRadar(!showRainRadar)}
          className={`h-8 px-3 rounded-full backdrop-blur-sm shadow-lg border text-xs ${
            showRainRadar ? 'bg-blue-100/90 text-blue-700 border-blue-200' : 'bg-white/90 text-slate-700 border-slate-200'
          }`}
        >
          <CloudRain className="w-3 h-3 mr-1" />
          Lluvia
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 shadow-lg border border-slate-200 text-xs"
            >
              <Layers className="w-3 h-3 mr-1" />
              Mapa
              <ChevronDown className="w-2 h-2 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 z-[2001]" align="center">
            <DropdownMenuItem onClick={() => setMapType('google')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Carreteras
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('satellite')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Satélite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('terrain')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Terreno
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 rounded-full backdrop-blur-sm shadow-lg border text-xs ${
                showTurnByTurn ? 'bg-blue-600 text-white border-blue-700' : 'bg-white/90 text-slate-700 border-slate-200'
              }`}
            >
              <NavIcon className="w-3 h-3 mr-1" />
              Navegación
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 z-[2001]" align="center">
            <DropdownMenuItem
              onClick={() => setShowKmMarkers(!showKmMarkers)}
              className="cursor-pointer focus:bg-slate-100 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Milestone className="w-3 h-3" />
                <span>Marcadores Km</span>
              </div>
              {showKmMarkers && <Check className="w-3 h-3 text-blue-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowElevationProfile(!showElevationProfile)}
              className="cursor-pointer focus:bg-slate-100 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3 h-3" />
                <span>Perfil Elevación</span>
              </div>
              {showElevationProfile && <Check className="w-3 h-3 text-blue-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowRunners(!showRunners)}
              className="cursor-pointer focus:bg-slate-100 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3" />
                <span>GPS Corredores</span>
              </div>
              {showRunners && <Check className="w-3 h-3 text-blue-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowWindArrowsOnMap(!showWindArrowsOnMap)}
              className="cursor-pointer focus:bg-slate-100 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Wind className="w-3 h-3" />
                <span>Viento en Mapa</span>
              </div>
              {showWindArrowsOnMap && <Check className="w-3 h-3 text-blue-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowRouteArrows(!showRouteArrows)}
              className="cursor-pointer focus:bg-slate-100 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3" />
                <span>Flechas Ruta</span>
              </div>
              {showRouteArrows && <Check className="w-3 h-3 text-blue-600" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* DESKTOP VIEW - All buttons visible */}
      <div className="controls-items hidden lg:flex items-center gap-2 justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-white shadow-lg border border-slate-200 flex items-center gap-1 text-sm"
            >
              <Layers className="w-4 h-4" />
              <span>Mapa</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 z-[2001]" align="center">
            <DropdownMenuItem onClick={() => setMapType('google')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Carreteras
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('satellite')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Satélite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('hybrid')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Híbrido
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('terrain')} className="cursor-pointer focus:bg-slate-100 text-xs">
              Terreno
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMapType('street')} className="cursor-pointer focus:bg-slate-100 text-xs">
              OpenStreetMap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKmMarkers(!showKmMarkers)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showKmMarkers ? 'bg-blue-100/90 text-blue-700 border-blue-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Marcadores de kilómetros"
        >
          <Milestone className="w-3 h-3" />
          <span>Km</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPois(!showPois)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showPois ? 'bg-green-100/90 text-green-700 border-green-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Puntos de interés"
        >
          <MapPin className="w-3 h-3" />
          <span>POI</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowElevationProfile(!showElevationProfile)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showElevationProfile ? 'bg-orange-100/90 text-orange-700 border-orange-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Perfil de elevación"
        >
          <BarChart3 className="w-3 h-3" />
          <span>Perfil</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRunners(!showRunners)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showRunners ? 'bg-purple-100/90 text-purple-700 border-purple-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Corredores en el mapa"
        >
          <Users className="w-3 h-3" />
          <span>GPS</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowWindArrowsOnMap(!showWindArrowsOnMap)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showWindArrowsOnMap ? 'bg-cyan-100/90 text-cyan-700 border-cyan-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Mostrar flechas de viento en el mapa"
        >
          <Wind className="w-3 h-3" />
          <span>Viento</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRainRadar(!showRainRadar)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showRainRadar ? 'bg-blue-100/90 text-blue-700 border-blue-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Mostrar radar de lluvia"
        >
          <CloudRain className="w-3 h-3" />
          <span>Lluvia</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRouteArrows(!showRouteArrows)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showRouteArrows ? 'bg-indigo-100/90 text-indigo-700 border-indigo-200' : 'bg-white/90 hover:bg-white'
          }`}
          title="Flechas de dirección"
        >
          <ArrowRight className="w-3 h-3" />
          <span>Ruta</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTurnByTurn(!showTurnByTurn)}
          className={`h-9 px-3 rounded-full backdrop-blur-sm text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 flex items-center gap-1 text-xs ${
            showTurnByTurn ? 'bg-blue-600 text-white border-blue-700' : 'bg-white/90 hover:bg-white'
          }`}
          title="Navegación turno a turno"
        >
          <NavIcon className="w-3 h-3" />
          <span>Navegación</span>
        </Button>
      </div>
    </div>
  );
}
