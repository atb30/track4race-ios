import React from "react";
import { Wind, CloudRain, ArrowBigUp } from "lucide-react";

const getWindColor = (speedKmh) => {
  if (speedKmh >= 40) return '#ef4444';
  if (speedKmh >= 25) return '#f59e0b';
  return '#3b82f6';
};

const getCardinalDirection = (direction) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(direction / 45) % 8;
  return directions[index];
};

export default function WeatherPanel({ isFetchingWeather, windData, weatherError, rainForecast }) {
  return (
    <div className="border-b border-slate-800">
      <div className="grid grid-cols-2">
        {/* Wind Cell */}
        <div className="bg-white p-1 sm:p-2 md:p-4 lg:p-3 border-r border-slate-800">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Wind className="w-3 h-3 sm:w-4 sm:h-4"/> Viento Actual
            </div>
          </div>
          {isFetchingWeather && !windData ? (
            <div className="text-center text-xs text-slate-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">Cargando...</div>
          ) : weatherError ? (
            <div className="text-center text-xs text-red-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">{weatherError}</div>
          ) : windData ? (
            <div className="flex items-center justify-center gap-2 sm:gap-4 py-1">
              <div className="text-center">
                <div className="text-lg sm:text-2xl md:text-4xl font-bold" style={{ color: getWindColor(windData.speedKmh) }}>
                  {windData.speedKmh.toFixed(0)}
                </div>
                <div className="text-xs text-slate-500 -mt-1">km/h</div>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center"
                  style={{
                    // La dirección meteorológica es de dónde procede el viento;
                    // la flecha representa hacia dónde se desplaza.
                    transform: `rotate(${(Number(windData.direction) + 180) % 360}deg)`,
                    transition: 'transform 0.5s ease-out'
                  }}
                >
                  <ArrowBigUp
                    className="w-full h-full drop-shadow-md"
                    fill={getWindColor(windData.speedKmh)}
                    stroke="white"
                    strokeWidth={0.5}
                  />
                </div>
                <span className="text-xs font-bold mt-1 text-slate-600">
                  {getCardinalDirection(windData.direction)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">Esperando GPS...</div>
          )}
        </div>
        {/* Rain Forecast Cell */}
        <div className="bg-white p-1 sm:p-2 md:p-4 lg:p-3">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <CloudRain className="w-3 h-3 sm:w-4 sm:h-4"/> Lluvia (3h)
            </div>
          </div>
          {isFetchingWeather && !rainForecast ? (
            <div className="text-center text-xs text-slate-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">Calculando...</div>
          ) : weatherError ? (
            <div className="text-center text-xs text-red-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">{weatherError}</div>
          ) : rainForecast ? (
            <div className="flex items-center justify-center gap-2 sm:gap-4 py-1">
              <div className="text-center">
                <div className="text-lg sm:text-2xl md:text-4xl font-bold text-blue-600">
                  {rainForecast.probability.toFixed(0)}%
                </div>
                {rainForecast.probability > 0 && (
                  <div className="text-xs text-slate-500 -mt-1 capitalize">
                    {rainForecast.intensity}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-2 h-[40px] sm:h-[60px] md:h-[80px] flex items-center justify-center">Esperando...</div>
          )}
        </div>
      </div>
      <div className="bg-white px-2 pb-1 text-right text-[10px] leading-none text-slate-400">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="hover:text-slate-600">
          Datos meteorológicos: Open-Meteo.com
        </a>
      </div>
    </div>
  );
}
