import React from "react";
import { useLanguage } from "@/lib/LanguageContext";

export default function AppLogo({ className = "w-16 h-16", showText = true }) {
  const { language } = useLanguage();
  return (
    <div className="flex flex-col items-center">
      <img src="/track4race.png" alt="Track4Race" className={`${className} object-contain`} />
      {showText && (
        <div className="mt-2 text-center">
          <h2 className="font-semibold text-slate-800">Track4Race</h2>
          <p className="text-xs text-slate-500">{language === 'en' ? 'GPS navigation system' : 'Sistema de navegación GPS'}</p>
        </div>
      )}
    </div>
  );
}
