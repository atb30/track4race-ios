import React from "react";

export default function AppLogo({ className = "w-16 h-16", showText = true }) {
  return (
    <div className="flex flex-col items-center">
      <img src="/track4race.png" alt="Track4Race" className={`${className} object-contain`} />
      {showText && (
        <div className="mt-2 text-center">
          <h2 className="font-semibold text-slate-800">Track4Race</h2>
          <p className="text-xs text-slate-500">Sistema de navegación GPS</p>
        </div>
      )}
    </div>
  );
}
