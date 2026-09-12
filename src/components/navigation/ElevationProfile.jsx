
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip, ReferenceDot, ReferenceArea } from "recharts";
import { X, Plus, Minus, ChevronsLeft, ChevronsRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/lib/LanguageContext";


// NEW: Popup for clicked points on the chart
const ChartClickPopup = ({ pointInfo, totalDistance, onClose }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  if (!pointInfo) return null;

  const remainingDistance = totalDistance - pointInfo.distance;

  return (
    <div
      className="absolute bg-white/90 backdrop-blur-sm border border-slate-300 p-3 rounded-lg shadow-xl z-20 text-sm pointer-events-auto"
      style={{
        left: pointInfo.x,
        bottom: pointInfo.y,
        transform: 'translateX(-50%)',
        minWidth: '180px'
      }}
    >
      <button onClick={onClose} className="absolute top-1 right-1 text-slate-400 hover:text-slate-700">
        <X className="w-4 h-4" />
      </button>
      <h4 className="font-bold text-slate-800 mb-2 text-base">
        {pointInfo.runnerName || `Km ${pointInfo.distance.toFixed(1)}`}
      </h4>
      <div className="space-y-1 text-slate-600">
        <p><strong>{en ? 'Altitude:' : 'Altitud:'}</strong> {pointInfo.elevation.toFixed(0)} m</p>
        <p><strong>{en ? 'Distance to finish:' : 'Distancia a meta:'}</strong> {remainingDistance.toFixed(1)} km</p>
        {pointInfo.grade && <p><strong>{en ? 'Gradient:' : 'Pendiente:'}</strong> {pointInfo.grade.toFixed(1)} %</p>}
      </div>
    </div>
  );
};


// Tooltip/Popup que aparece al hacer clic en un POI
const PoiPopup = ({ poi, poiType, onClose }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  if (!poi) return null;

  return (
    <div
      className="absolute bg-white/90 backdrop-blur-sm border border-slate-300 p-3 rounded-lg shadow-xl z-20 text-sm"
      style={{
        left: poi.x,
        top: poi.y,
        transform: 'translate(-50%, -110%)', // Posiciona el popup encima y centrado del cursor
        minWidth: '180px'
      }}>

      <button onClick={onClose} className="absolute top-1 right-1 text-slate-400 hover:text-slate-700">
        <X className="w-4 h-4" />
      </button>
      <h4 className="font-bold text-slate-800 mb-2 text-base">{poi.name || poiType?.name || 'POI'}</h4>
      <div className="space-y-1 text-slate-600">
        <p><strong>Km:</strong> {poi.distance.toFixed(1)}</p>
        <p><strong>{en ? 'Elevation:' : 'Elevación:'}</strong> {poi.elevation.toFixed(0)} m</p>
        <p><strong>{en ? 'Gradient:' : 'Pendiente:'}</strong> {poi.grade.toFixed(1)} %</p>
      </div>
    </div>);

};


// Componente para renderizar la etiqueta del icono sobre la ReferenceLine
// RESTAURADO al estilo original, sin recuadro.
const PoiReferenceLabel = ({ viewBox, poi, poiType, onMarkerClick, yDomainMin, yDomainMax, chartHeight }) => {
  const { x } = viewBox;
  const iconSize = 24;
  const markerOffset = iconSize / 2;

  // Calculate the profile line's Y position within the chart's plotting area
  const elevationRange = yDomainMax - yDomainMin;
  const elevationRatio = (poi.elevation - yDomainMin) / elevationRange;
  const profileY = chartHeight - (elevationRatio * chartHeight);

  // Position the marker's top edge just above the profile line
  let markerY = profileY - iconSize;

  // Adjust if marker goes above the chart boundary
  if (markerY < 0) {
      markerY = 0;
  }

  const poiDistanceKm = poi.distance;

  const handleClick = () => {
    if (onMarkerClick) {
      // Pass the full poi object to the external handler
      onMarkerClick(poi);
    }
  };

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }} className="group">
      <g transform={`translate(${x - markerOffset}, ${markerY})`}>
        {/* Restaurado: El icono directamente, sin recuadro */}
        {poiType?.icon_url ? (
          <image
            href={poiType.icon_url}
            x="0"
            y="0"
            width={iconSize}
            height={iconSize}
            style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
          />
        ) : (
          <circle
            cx={iconSize / 2}
            cy={iconSize / 2}
            r={iconSize / 2 - 2}
            fill={poiType?.color || '#3b82f6'}
            stroke="white"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
          />
        )}
        
        {/* Tooltip on hover - hidden by default, shown on parent hover */}
        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <rect
            x={iconSize / 2 - 60}
            y={-50}
            width="120"
            height="35"
            fill="rgba(0,0,0,0.8)"
            rx="4"
          />
          <text
            x={iconSize / 2}
            y={-37}
            textAnchor="middle"
            fill="white"
            fontSize="11"
            fontWeight="bold"
          >
            {poi.name || poiType?.name || 'POI'}
          </text>
          <text
            x={iconSize / 2}
            y={-23}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
          >
            Km {poiDistanceKm.toFixed(1)} • Click para ir
          </text>
        </g>
      </g>
    </g>
  );
};


// Componente personalizado para las etiquetas del eje X (kilómetros)
const CustomXAxisTick = ({ x, y, payload }) => {
  if (payload.value === undefined) return null;
  // Formatear con un decimal si no es un número entero
  const formattedValue = Number.isInteger(payload.value)
    ? `${payload.value}km`
    : `${payload.value.toFixed(1)}km`;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Fondo translúcido */}
      <rect x={-22} y={3} width={44} height={16} fill="rgba(255, 255, 255, 0.8)" rx={4} />
      {/* Texto de la etiqueta */}
      <text x={0} y={14} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight="bold">
        {formattedValue}
      </text>
    </g>);

};


export default function ElevationProfile({
  gpxTrack,
  currentPosition,
  pois = [],
  poiTypes = [],
  runners = [],
  onPoiClick,
  elevationSegments = null,
  selectionMode = false,
  onSegmentSelect
}) {
  const { language } = useLanguage(); const en = language === 'en';
  const [clickedPoi, setClickedPoi] = useState(null);
  const [clickedPoiType, setClickedPoiType] = useState(null);
  const [clickedPointInfo, setClickedPointInfo] = useState(null);
  const [viewDomain, setViewDomain] = useState(null); // [minKm, maxKm]
  const [isMobile, setIsMobile] = useState(false);

  const chartRef = useRef(null); // This will be the main container div
  const pinchStartDistance = useRef(null);
  const panStart = useRef(null);

  // State for selection mode
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null); // in km
  const [selectionEnd, setSelectionEnd] = useState(null);     // in km

  useEffect(() => {
    const checkIsMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkIsMobile());
  }, []);

  // Handle POI marker click (for external navigation/action)
  const handlePoiMarkerClick = useCallback((poi) => {
    // Close internal chart popups if user is likely navigating away
    setClickedPoi(null); // Close the POI specific popup
    setClickedPointInfo(null); // Close the general chart click popup

    if (onPoiClick && typeof onPoiClick === 'function') {
      onPoiClick(poi); // Call the external handler with the full POI object
    }
  }, [onPoiClick]);

  if (!gpxTrack?.waypoints?.length) {
    return null;
  }
  
  const totalDistance = gpxTrack.total_distance;
  const domain = viewDomain || [0, totalDistance];
  const [minDomain, maxDomain] = domain;

  const data = gpxTrack.waypoints.map((point, index) => {
    let grade = 0;
    if (index > 0 && index < gpxTrack.waypoints.length - 1) {
      const current = point;
      const previous = gpxTrack.waypoints[index - 1];
      const elevationDiff = current.elevation - previous.elevation;
      const distanceDiff = (current.distance - previous.distance) * 1000;
      grade = distanceDiff > 0 ? elevationDiff / distanceDiff * 100 : 0;
    }

    return {
      distance: point.distance,
      elevation: point.elevation,
      grade: grade,
      index,
      ...point
    };
  });

  const interpolateValue = (distanceKm, waypoints, key) => {
    if (!waypoints || waypoints.length === 0) return 0;
    if (distanceKm <= waypoints[0].distance) return waypoints[0][key];
    if (distanceKm >= waypoints[waypoints.length - 1].distance) return waypoints[waypoints.length - 1][key];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      if (distanceKm >= p1.distance && distanceKm <= p2.distance) {
        const ratio = (distanceKm - p1.distance) / (p2.distance - p1.distance);
        return p1[key] + (p2[key] - p1[key]) * ratio;
      }
    }
    return waypoints[0][key];
  };

  const poisWithData = pois.
  filter((poi) => {
    const poiType = poiTypes.find((pt) => pt.id === poi.poi_type_id);
    // Solo mostrar POIs cuyos tipos están marcados para mostrar en perfil
    return poiType && poiType.show_in_profile === true;
  }).
  map((poi) => {
    const distanceKm = poi.distance_from_start / 1000;
    return {
      ...poi,
      distance: distanceKm,
      elevation: interpolateValue(distanceKm, data, 'elevation'),
      grade: interpolateValue(distanceKm, data, 'grade')
    };
  });

  const maxElevation = gpxTrack.max_elevation;
  const minElevation = gpxTrack.min_elevation;
  const elevationRange = maxElevation - minElevation;

  // SISTEMA ADAPTATIVO DE PADDING SEGÚN EL DESNIVEL
  const calculateAdaptivePadding = (desnivel) => {
    if (desnivel < 50) {
      // Rutas muy planas (< 50m): Mucho padding para suavizar pequeñas ondulaciones
      return Math.max(100, desnivel * 2.5);
    } else if (desnivel < 200) {
      // Rutas onduladas (50-200m): Padding moderado-alto
      return Math.max(80, desnivel * 1.2);
    } else if (desnivel < 500) {
      // Rutas con colinas (200-500m): Padding moderado
      return Math.max(50, desnivel * 0.6);
    } else if (desnivel < 1000) {
      // Rutas montañosas (500-1000m): Padding bajo para mostrar las subidas
      return Math.max(30, desnivel * 0.3);
    } else {
      // Rutas de alta montaña (> 1000m): Padding mínimo para mostrar dramatismo
      return Math.max(20, desnivel * 0.15);
    }
  };

  const verticalPadding = calculateAdaptivePadding(elevationRange);
  const iconMargin = 30; // Espacio extra para los iconos de POIs

  const yDomainMin = minElevation - verticalPadding;
  const yDomainMax = maxElevation + verticalPadding + iconMargin;

  // Altura del área de dibujo del gráfico (altura total - márgenes superior/inferior)
  // h-48 = 192px es la altura total del ResponsiveContainer
  // Los márgenes del AreaChart son { top: 35, right: 20, left: 0, bottom: 20 }
  // Por lo tanto, la altura real del área de trazado es 192 - (35 + 20) = 137px
  const chartHeight = 192 - 35 - 20;

  // Handlers for zoom and pan (existing)
  const handleZoom = (factor, center) => {
    if (selectionMode) return; // Disable zoom/pan in selection mode

    const currentCenter = center ?? (minDomain + maxDomain) / 2;
    const currentWidth = maxDomain - minDomain;
    const newWidth = Math.max(0.5, Math.min(currentWidth * factor, totalDistance));

    const ratio = (currentCenter - minDomain) / currentWidth;
    let newMin = currentCenter - newWidth * ratio;
    let newMax = newMin + newWidth;

    if (newMin < 0) {
      newMin = 0;
      newMax = newWidth;
    }
    if (newMax > totalDistance) {
      newMax = totalDistance;
      newMin = totalDistance - newWidth;
    }
    setViewDomain([newMin, newMax]);
  };

  const handlePan = (percentage) => {
    if (selectionMode) return; // Disable zoom/pan in selection mode

    const width = maxDomain - minDomain;
    const shift = width * percentage;
    
    let newMin = minDomain + shift;
    let newMax = maxDomain + shift;

    if (newMin < 0) {
      newMin = 0;
      newMax = width;
    } else if (newMax > totalDistance) { // Use else if to avoid conflicting conditions
      newMax = totalDistance;
      newMin = totalDistance - width;
    }
    setViewDomain([newMin, newMax]);
  };

  const handleReset = () => {
    if (selectionMode) return; // Disable reset in selection mode
    setViewDomain(null);
  };
  
  // Existing wheel handler (for zoom/pan)
  const handleWheel = (e) => {
    if (selectionMode) return; // Disable wheel zoom in selection mode
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15; // Zoom in/out
    handleZoom(zoomFactor);
  };

  // Existing touch handlers (for zoom/pan)
  const handleTouchStartPanZoom = (e) => {
    if (selectionMode) return; // Disable touch gestures in selection mode

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDistance.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0].clientX, domain: viewDomain || [0, totalDistance] };
    }
  };

  const handleTouchMovePanZoom = (e) => {
    if (selectionMode) return; // Disable touch gestures in selection mode
    e.preventDefault();
    if (!chartRef.current) return; // Ensure chartRef is available

    if (e.touches.length === 2 && pinchStartDistance.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const zoomFactor = pinchStartDistance.current / currentDistance; // Invert factor for intuitive pinch-zoom
      
      const chartBounds = chartRef.current.getBoundingClientRect();
      const touchCenterPx = (t1.clientX + t2.clientX) / 2 - chartBounds.left;
      const centerRatio = touchCenterPx / chartBounds.width;
      const domainWidth = maxDomain - minDomain;
      const zoomCenterKm = minDomain + domainWidth * centerRatio;
      
      handleZoom(zoomFactor, zoomCenterKm);
      pinchStartDistance.current = currentDistance; // Update for next move event
    } else if (e.touches.length === 1 && panStart.current) {
      const chartWidth = chartRef.current.offsetWidth;
      const deltaX = e.touches[0].clientX - panStart.current.x;
      const domainWidth = panStart.current.domain[1] - panStart.current.domain[0];
      
      // Calculate panKm as a proportion of the visible domain
      const panKm = (deltaX / chartWidth) * domainWidth;

      let newMin = panStart.current.domain[0] - panKm;
      let newMax = panStart.current.domain[1] - panKm;

      if (newMin < 0) {
        newMin = 0;
        newMax = domainWidth;
      }
      if (newMax > totalDistance) {
        newMax = totalDistance;
        newMin = totalDistance - domainWidth;
      }
      setViewDomain([newMin, newMax]);
      panStart.current.x = e.touches[0].clientX; // Update starting position for continuous pan
      panStart.current.domain = [newMin, newMax]; // Update domain for continuous pan
    }
  };

  const handleTouchEndPanZoom = () => {
    if (selectionMode) return; // Disable touch gestures in selection mode
    pinchStartDistance.current = null;
    panStart.current = null;
  };

  const getTicks = () => {
      const [start, end] = domain;
      const range = end - start;
      const ticks = [];
      let interval;

      if (range <= 1) interval = 0.2;       // 200m
      else if (range <= 2.5) interval = 0.5;  // 500m
      else if (range <= 5) interval = 1;   // 1km
      else if (range <= 10) interval = 2;   // 2km
      else if (range <= 25) interval = 5;   // 5km
      else if (range <= 50) interval = 10;   // 10km
      else interval = Math.floor(range / 5);

      let currentTick = Math.ceil(start / interval) * interval;
      while (currentTick <= end) {
          ticks.push(parseFloat(currentTick.toFixed(2))); // Use toFixed to prevent float issues
          currentTick += interval;
      }
      return ticks.filter(tick => tick >= start && tick <= end);
  };


  const handleChartClick = (chartData) => {
    if (selectionMode) { // If in selection mode, disable regular chart point clicks
      setClickedPoi(null);
      setClickedPointInfo(null);
      return;
    }

    // If a popup is open, the first click should close it.
    if (clickedPoi || clickedPointInfo) {
      setClickedPoi(null);
      setClickedPointInfo(null);
      return;
    }

    if (chartData && chartData.activePayload && chartData.activePayload[0]) {
      const point = chartData.activePayload[0].payload;
      
      // chartData.chartX and chartData.chartY are coordinates relative to the SVG container.
      // The total height of the ResponsiveContainer is 192px (from h-48).
      // We want to pass the 'bottom' position for the popup.
      const popupX = chartData.chartX;
      const popupYFromBottom = 192 - chartData.chartY; // 192 is the total height of the chart container

      setClickedPointInfo({
        ...point,
        x: popupX,
        y: popupYFromBottom,
      });
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (selectionMode) return null; // Hide tooltip in selection mode
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const grade = data.grade;
      const climbSegment = gpxTrack.climb_segments?.find((s) => label >= s.start_km && label <= s.end_km);
      return (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 p-3 rounded-lg shadow-xl">
          <p className="font-semibold text-slate-800">Km {label?.toFixed(1)}</p>
          <p className="text-green-600">Elevación: {payload[0].value?.toFixed(0)}m</p>
          {grade ? <p className="text-orange-600">{en ? 'Gradient' : 'Pendiente'}: {grade.toFixed(1)}%</p> : null}
          {climbSegment && <p className="text-red-600 font-medium">Subida: {climbSegment.grade_percent?.toFixed(1)}% ({climbSegment.elevation_gain?.toFixed(0)}m)</p>}
        </div>);

    }
    return null;
  };

  const getGradeColor = (grade) => {
    if (grade <= -12) return "#1e40af";
    if (grade <= -8) return "#1d4ed8";
    if (grade <= -5) return "#2563eb";
    if (grade <= -3) return "#3b82f6";
    if (grade < 0) return "#60a5fa";
    if (grade >= 12) return "#dc2626";
    if (grade >= 8) return "#ea580c";
    if (grade >= 5) return "#f59e0b";
    if (grade >= 3) return "#eab308";
    if (grade >= 1) return "#84cc16";
    return "#10b981";
  };

  const createDynamicGradient = () => {
    return data.map((point, index) =>
    <stop key={`stop-${index}`} offset={`${point.distance / totalDistance * 100}%`} stopColor={getGradeColor(point.grade)} stopOpacity={0.8} />
    );
  };

  // Función para interpolar la elevación en la posición actual
  const getCurrentPositionElevation = () => {
    if (!currentPosition || !data || data.length === 0) return null;
    
    const currentDistanceKm = currentPosition.distance / 1000;
    return interpolateValue(currentDistanceKm, data, 'elevation');
  };

  // Componente para renderizar el indicador de posición actual (círculo negro prominente)
  const CurrentPositionIndicator = ({ cx, cy }) => {
    // No renderizar si las coordenadas no son válidas
    if (isNaN(cx) || isNaN(cy)) {
        return null;
    }
    return (
      <g>
        {/* Círculo exterior (sombra) */}
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="rgba(0, 0, 0, 0.2)"
          style={{ filter: 'blur(2px)' }}
        />
        {/* Círculo principal negro */}
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="#1e293b"
          stroke="#ffffff"
          strokeWidth={3}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
        />
        {/* Punto central para mayor visibilidad */}
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill="#ffffff"
        />
      </g>
    );
  };
  
  // Custom dot for runners
  const RunnerDot = (props) => {
    const { cx, cy, payload, runner } = props;
    if (isNaN(cx) || isNaN(cy)) {
      return null;
    }

    const handleRunnerClick = (e) => {
      e.stopPropagation();
      setClickedPoi(null); // Close POI popup if open
      
      // cx, cy are relative to the plotting area of the chart.
      // The AreaChart has a top margin of 35px.
      // The ResponsiveContainer has a total height of 192px.
      // So the actual y position from the top of the SVG is cy + 35.
      // The popup needs 'bottom' position relative to the chartRef div.
      const popupX = cx;
      const popupYFromBottom = 192 - (cy + 35); // 192 total height, 35 top margin

      setClickedPointInfo({
        distance: runner.distanceOnTrack / 1000,
        elevation: runner.elevationOnTrack,
        runnerName: runner.device_name || runner.user_name,
        x: popupX,
        y: popupYFromBottom,
      });
    };
  
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <g onClick={handleRunnerClick} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={6} fill={runner.color} stroke="white" strokeWidth={2} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
            </g>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-800 text-white border-slate-700">
            <p className="font-bold" style={{ color: runner.color }}>{runner.device_name}</p>
            <p className="text-xs">{runner.user_name}</p>
            <p className="text-xs">{en ? 'Click for more info' : 'Clic para más info'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Pre-calcular el punto de la posición actual para el gráfico
  const currentPositionDataPoint =
    currentPosition && currentPosition.distance !== undefined && currentPosition.distance > 0
      ? {
          distance: currentPosition.distance / 1000,
          elevation: getCurrentPositionElevation(),
        }
      : null;

  // Selection mode handlers (Mouse)
  const handleMouseDownSelection = (e) => {
    if (!selectionMode || !gpxTrack?.waypoints || !chartRef.current) return;
    
    const chartRect = chartRef.current.getBoundingClientRect();
    if (e.clientX < chartRect.left || e.clientX > chartRect.right ||
        e.clientY < chartRect.top || e.clientY > chartRect.bottom) {
      return;
    }

    const xInChart = e.clientX - chartRect.left;
    const chartWidth = chartRect.width;

    if (chartWidth === 0) return;

    const clickPercent = xInChart / chartWidth;
    
    const currentDomainWidth = maxDomain - minDomain;
    const clickKm = minDomain + (clickPercent * currentDomainWidth);
    
    setIsSelecting(true);
    setSelectionStart(clickKm);
    setSelectionEnd(clickKm);
  };

  const handleMouseMoveSelection = (e) => {
    if (!selectionMode || !isSelecting || !gpxTrack?.waypoints || !chartRef.current) return;
    
    const chartRect = chartRef.current.getBoundingClientRect();
    const xInChart = e.clientX - chartRect.left;
    const chartWidth = chartRect.width;

    if (chartWidth === 0) return;

    const clampedXInChart = Math.max(0, Math.min(xInChart, chartWidth));
    const movePercent = clampedXInChart / chartWidth;
    
    const currentDomainWidth = maxDomain - minDomain;
    const moveKm = minDomain + (movePercent * currentDomainWidth);
    
    setSelectionEnd(moveKm);
  };

  const handleMouseUpSelection = () => {
    if (!selectionMode || !isSelecting) return;
    
    setIsSelecting(false);
    
    if (selectionStart !== null && selectionEnd !== null) {
      const startKm = Math.min(selectionStart, selectionEnd);
      const endKm = Math.max(selectionStart, selectionEnd);
      
      if ((endKm - startKm) > 0.1) { // 0.1 km = 100m
        onSegmentSelect?.(startKm, endKm);
      }
    }
    
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Selection mode handlers (Touch)
  const handleTouchStartSelection = (e) => {
    if (!selectionMode || !gpxTrack?.waypoints || !chartRef.current) return;
    
    e.preventDefault(); // Prevent default browser actions
    
    const chartRect = chartRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch || touch.clientX < chartRect.left || touch.clientX > chartRect.right ||
        touch.clientY < chartRect.top || touch.clientY > chartRect.bottom) {
      return;
    }

    const xInChart = touch.clientX - chartRect.left;
    const chartWidth = chartRect.width;

    if (chartWidth === 0) return;

    const clickPercent = xInChart / chartWidth;
    
    const currentDomainWidth = maxDomain - minDomain;
    const clickKm = minDomain + (clickPercent * currentDomainWidth);
    
    setIsSelecting(true);
    setSelectionStart(clickKm);
    setSelectionEnd(clickKm);
  };

  const handleTouchMoveSelection = (e) => {
    if (!selectionMode || !isSelecting || !gpxTrack?.waypoints || !chartRef.current) return;
    
    e.preventDefault(); // Prevent scrolling during selection
    
    const chartRect = chartRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;

    const xInChart = touch.clientX - chartRect.left;
    const chartWidth = chartRect.width;

    if (chartWidth === 0) return;

    const clampedXInChart = Math.max(0, Math.min(xInChart, chartWidth));
    const movePercent = clampedXInChart / chartWidth;
    
    const currentDomainWidth = maxDomain - minDomain;
    const moveKm = minDomain + (movePercent * currentDomainWidth);
    
    setSelectionEnd(moveKm);
  };

  const handleTouchEndSelection = () => {
    if (!selectionMode || !isSelecting) return;
    
    setIsSelecting(false);
    
    if (selectionStart !== null && selectionEnd !== null) {
      const startKm = Math.min(selectionStart, selectionEnd);
      const endKm = Math.max(selectionStart, selectionEnd);
      
      if ((endKm - startKm) > 0.1) {
        onSegmentSelect?.(startKm, endKm);
      }
    }
    
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Shared leave handler for selection (mouse and touch cancel)
  const handleLeaveSelection = () => {
    if (selectionMode && isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };


  return (
    <div 
      ref={chartRef}
      className="mt-3 relative w-full h-full touch-none" 
      // Wheel event for zoom/pan (desktop only)
      onWheel={!isMobile ? handleWheel : undefined}

      // Mouse events for selection mode
      onMouseDown={selectionMode ? handleMouseDownSelection : undefined}
      onMouseMove={selectionMode ? handleMouseMoveSelection : undefined}
      onMouseUp={selectionMode ? handleMouseUpSelection : undefined}
      onMouseLeave={selectionMode ? handleLeaveSelection : undefined}

      // Touch events, dispatch based on selectionMode
      onTouchStart={e => selectionMode ? handleTouchStartSelection(e) : handleTouchStartPanZoom(e)}
      onTouchMove={e => selectionMode ? handleTouchMoveSelection(e) : handleTouchMovePanZoom(e)}
      onTouchEnd={e => selectionMode ? handleTouchEndSelection(e) : handleTouchEndPanZoom(e)}
      onTouchCancel={e => selectionMode ? handleLeaveSelection() : handleTouchEndPanZoom()} // handleTouchEndPanZoom also resets state

      style={{ cursor: selectionMode ? 'crosshair' : 'default' }}
    >
      {/* Zoom/Pan Controls - Hide in selection mode */}
      {!isMobile && !selectionMode && (
        <div className="absolute top-1 right-2 z-10 flex items-center gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-md shadow-lg">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePan(-0.25)} disabled={minDomain <= 0}>
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{en ? 'Pan left' : 'Desplazar Izquierda'}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleZoom(1.5)} disabled={(maxDomain - minDomain) >= totalDistance}>
                  <Minus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{en ? 'Zoom out' : 'Alejar'}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleZoom(0.75)} disabled={(maxDomain - minDomain) <= 0.5}>
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{en ? 'Zoom in' : 'Acercar'}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePan(0.25)} disabled={maxDomain >= totalDistance}>
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{en ? 'Pan right' : 'Desplazar Derecha'}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} disabled={!viewDomain}>
                  <Expand className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{en ? 'Full view' : 'Vista Completa'}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} onClick={handleChartClick} margin={{ top: 35, right: 20, left: 0, bottom: 20 }}>
          <defs><linearGradient id="gradeGradient" x1="0" y1="0" x2="1" y2="0">{createDynamicGradient()}</linearGradient></defs>
          <XAxis
            dataKey="distance"
            type="number"
            scale="linear"
            domain={domain}
            ticks={getTicks()}
            tick={<CustomXAxisTick />}
            tickLine={false}
            axisLine={false}
            allowDataOverflow={true}
          />

          <YAxis domain={[yDomainMin, yDomainMax]} tickFormatter={(v) => `${v.toFixed(0)}m`} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={40} />
          {/* RechartsTooltip only active when not in selection mode */}
          {!selectionMode && <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#f59e0b', strokeWidth: 1 }} />}
          
          <Area 
            type="monotone" 
            dataKey="elevation" 
            stroke="#3b82f6" 
            fill="url(#gradeGradient)" 
            fillOpacity={1.0} 
            dot={false}
          />
          
          {/* Selection overlay (ReferenceArea) */}
          {selectionMode && isSelecting && selectionStart !== null && selectionEnd !== null && (
            <ReferenceArea
              x1={Math.min(selectionStart, selectionEnd)}
              x2={Math.max(selectionStart, selectionEnd)}
              y1={yDomainMin} // Cover the whole Y-axis range
              y2={yDomainMax}
              stroke="rgb(59, 130, 246)"
              strokeWidth={2}
              fill="rgba(59, 130, 246, 0.3)"
              ifOverflow="discard"
            />
          )}

          {/* Render POIs, Runners, Current Position only when NOT in selection mode */}
          {!selectionMode && (
            <>
              {/* POIs Reference Lines */}
              {poisWithData.filter(p => p.distance >= minDomain && p.distance <= maxDomain).map((poi) => {
                const poiType = poiTypes.find((t) => t.id === poi.poi_type_id);
                if (!poiType || !poiType.show_in_profile) return null;

                return (
                  <ReferenceLine
                    key={`poi-line-${poi.id}`}
                    x={poi.distance}
                    stroke="transparent"
                    label={
                      <PoiReferenceLabel 
                        poi={poi} 
                        poiType={poiType} 
                        onMarkerClick={handlePoiMarkerClick}
                        yDomainMin={yDomainMin}
                        yDomainMax={yDomainMax}
                        chartHeight={chartHeight}
                      />
                    } />
                );
              })}
              
              {/* Runners Dots */}
              {runners.filter(r => (r.distanceOnTrack / 1000) >= minDomain && (r.distanceOnTrack / 1000) <= maxDomain).map(runner => (
                <ReferenceDot
                  key={`runner-dot-${runner.id}`}
                  x={runner.distanceOnTrack / 1000}
                  y={runner.elevationOnTrack}
                  ifOverflow="discard"
                  shape={<RunnerDot runner={runner} />}
                />
              ))}

              {/* Current Position Dot - Rendered on a separate Area */}
              {currentPositionDataPoint && 
              currentPositionDataPoint.distance >= minDomain &&
              currentPositionDataPoint.distance <= maxDomain && (
                <Area
                    type="monotone"
                    dataKey="elevation"
                    data={[currentPositionDataPoint]}
                    fill="transparent"
                    stroke="transparent"
                    dot={<CurrentPositionIndicator />}
                    isAnimationActive={false}
                />
              )}
            </>
          )}

        </AreaChart>
      </ResponsiveContainer>
      
      {/* Popups should also be conditional to selectionMode */}
      {!selectionMode && <PoiPopup poi={clickedPoi} poiType={clickedPoiType} onClose={() => setClickedPoi(null)} />}
      {!selectionMode && <ChartClickPopup pointInfo={clickedPointInfo} totalDistance={totalDistance} onClose={() => setClickedPointInfo(null)} />}

      {/* Selection mode indicator */}
      {selectionMode && (
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg z-20">
          Modo Selección Activo - {isSelecting ? 'Arrastrando...' : 'Toca y arrastra'}
        </div>
      )}
    </div>
  );
}
