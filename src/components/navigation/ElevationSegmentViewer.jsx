import React from "react";
import { BarChart3 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function ElevationSegmentViewer({
  elevationSegmentView,
  selectedSegmentRange,
  selectedRangeSegments,
  elevationSegments,
  activeTrack,
  onSegmentClick
}) {
  const { language } = useLanguage(); const en = language === 'en';
  const displaySegments = elevationSegmentView === 'selection'
    ? selectedRangeSegments
    : elevationSegments;

  if (!displaySegments) {
    return (
      <div className="border-b border-slate-800 bg-white">
        <div className="p-2">
          <p className="text-xs text-red-600">{en ? 'Calculating profile...' : 'Calculando perfil...'}</p>
        </div>
      </div>
    );
  }

  if (displaySegments.length === 0) {
    return (
      <div className="border-b border-slate-800 bg-white">
        <div className="bg-slate-100 p-1 sm:p-2 border-b border-slate-800">
          <h3 className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-2">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4"/>
            {elevationSegmentView === 'selection' && selectedSegmentRange
              ? `${en ? 'Selection' : 'Selección'}: Km ${selectedSegmentRange.startKm.toFixed(1)} - ${selectedSegmentRange.endKm.toFixed(1)}`
              : `${en ? 'Profile: Last' : 'Perfil: Últimos'} ${elevationSegmentView}`
            }
          </h3>
        </div>
        <p className="text-xs text-yellow-600 p-2">
          {elevationSegmentView === 'selection' ? (en ? 'Not enough data for the selection.' : 'No hay datos suficientes para la selección.') : (en ? `Not enough data for ${elevationSegmentView}.` : `No hay datos suficientes para ${elevationSegmentView}.`)}
        </p>
      </div>
    );
  }

  const stats = {
    desnivelPositivo: displaySegments.reduce((sum, s) => sum + Math.max(0, s.elevationGain), 0),
    desnivelNegativo: displaySegments.reduce((sum, s) => sum + Math.min(0, s.elevationGain), 0),
    distancia: displaySegments.reduce((sum, s) => sum + s.distance, 0) / 1000
  };

  return (
    <div className="border-b border-slate-800 bg-white">
      <div className="bg-slate-100 p-1 sm:p-2 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-2">
          <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4"/>
          {elevationSegmentView === 'selection' && selectedSegmentRange
            ? `${en ? 'Selection' : 'Selección'}: Km ${selectedSegmentRange.startKm.toFixed(1)} - ${selectedSegmentRange.endKm.toFixed(1)}`
            : `${en ? 'Profile: Last' : 'Perfil: Últimos'} ${elevationSegmentView}`
          }
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600 font-semibold">
            +{stats.desnivelPositivo.toFixed(0)}m
          </span>
          <span className="text-blue-600 font-semibold">
            {stats.desnivelNegativo.toFixed(0)}m
          </span>
          <span className="text-slate-700 font-semibold">
            {stats.distancia.toFixed(2)}km
          </span>
        </div>
      </div>
      <div className="p-0">
        <div className="bg-gradient-to-b from-slate-50 to-white">
          <svg width="100%" height="140" className="overflow-visible" viewBox="0 0 320 140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.05 }} />
              </linearGradient>
            </defs>
            {(() => {
              const width = 320;
              const height = 140;
              const padding = { top: 10, bottom: 25, left: 2, right: 2 };
              const chartWidth = width - padding.left - padding.right;
              const chartHeight = height - padding.top - padding.bottom;

              const elevations = displaySegments.flatMap(s => [s.startElevation, s.endElevation]);
              const minElevation = elevations.length > 0 ? Math.min(...elevations) : 0;
              const maxElevation = elevations.length > 0 ? Math.max(...elevations) : 1;
              const elevationRange = maxElevation - minElevation || 1;

              if (displaySegments.length === 0) return null;

              const segmentWidth = chartWidth / displaySegments.length;

              let pathData = '';

              displaySegments.forEach((segment, index) => {
                const x = padding.left + (index * segmentWidth);
                const y = padding.top + chartHeight -
                  ((segment.startElevation - minElevation) / elevationRange) * chartHeight;

                if (index === 0) {
                  pathData += `M ${x} ${y} `;
                } else {
                  pathData += `L ${x} ${y} `;
                }
              });

              const lastSegment = displaySegments[displaySegments.length - 1];
              const lastX = padding.left + chartWidth;
              const lastY = padding.top + chartHeight -
                ((lastSegment.endElevation - minElevation) / elevationRange) * chartHeight;
              pathData += `L ${lastX} ${lastY} `;

              const filledPath = pathData +
                `L ${lastX} ${padding.top + chartHeight} ` +
                `L ${padding.left} ${padding.top + chartHeight} Z`;

              const segmentRects = displaySegments.map((segment, index) => {
                const x = padding.left + (index * segmentWidth);

                const handleSegmentClick = () => {
                  if (!activeTrack?.waypoints || activeTrack.waypoints.length === 0) return;

                  const middleDistanceKm = (segment.startKm + segment.endKm) / 2;

                  const closestWaypoint = activeTrack.waypoints.reduce((closest, wp) => {
                    const diff = Math.abs(wp.distance - middleDistanceKm);
                    const closestDiff = Math.abs(closest.distance - middleDistanceKm);
                    return diff < closestDiff ? wp : closest;
                  }, activeTrack.waypoints[0]);

                  console.log(`🗺️ Opening Street View at segment ${index + 1}: Km ${middleDistanceKm.toFixed(2)}`);
                  onSegmentClick({ lat: closestWaypoint.lat, lng: closestWaypoint.lng });
                };

                return (
                  <g key={`segment-${index}`}>
                    <rect
                      x={x}
                      y={padding.top}
                      width={segmentWidth}
                      height={chartHeight}
                      fill={segment.color}
                      opacity="0.2"
                      className="cursor-pointer hover:opacity-40 transition-opacity"
                      onClick={handleSegmentClick}
                      style={{ pointerEvents: 'all' }}
                    />
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + chartHeight}
                      stroke={segment.color}
                      strokeWidth="1"
                      opacity="0.4"
                      style={{ pointerEvents: 'none' }}
                    />
                    {segmentWidth > 15 && (
                      <text
                        x={x + segmentWidth / 2}
                        y={padding.top + chartHeight + 18}
                        textAnchor="middle"
                        className="text-[7px] font-bold pointer-events-none"
                        fill={segment.color}
                      >
                        {segment.grade >= 0 ? '+' : ''}{segment.grade.toFixed(1)}%
                      </text>
                    )}
                  </g>
                );
              });

              return (
                <>
                  {segmentRects}

                  <path
                    d={filledPath}
                    fill="url(#elevationGradient)"
                    style={{ pointerEvents: 'none' }}
                  />

                  <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    style={{ pointerEvents: 'none' }}
                  />

                  <text
                    x={padding.left + 2}
                    y={padding.top + 8}
                    className="text-[9px] font-medium fill-slate-600 pointer-events-none"
                  >
                    {maxElevation.toFixed(0)}m
                  </text>
                  <text
                    x={padding.left + 2}
                    y={padding.top + chartHeight - 2}
                    className="text-[9px] font-medium fill-slate-600 pointer-events-none"
                  >
                    {minElevation.toFixed(0)}m
                  </text>
                </>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}
