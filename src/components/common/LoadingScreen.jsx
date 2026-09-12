import React from "react";
import { useLanguage } from "@/lib/LanguageContext";

export default function LoadingScreen({ message = "Cargando..." }) {
  const { language } = useLanguage();
  const displayMessage = message === 'Cargando...' && language === 'en' ? 'Loading...' : message;
  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <img src="/track4race.png" alt="Track4Race" className="mx-auto h-40 w-auto max-w-full object-contain" />
        </div>
        
        {/* Spinner de carga */}
        <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">{displayMessage}</p>
      </div>
    </div>
  );
}
