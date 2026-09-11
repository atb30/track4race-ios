import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function OrientationWarning({ onDismiss }) {
  const { language } = useLanguage(); const en = language === 'en';
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm mx-auto text-center shadow-2xl">
        <div className="mb-4">
          <RotateCw className="w-16 h-16 mx-auto text-blue-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-3">
          {en ? 'Better Experience' : 'Mejor Experiencia'}
        </h2>
        <p className="text-slate-600 mb-6 text-sm">
          {en ? 'For the best navigation experience, rotate your device to landscape mode.' : 'Para una navegación óptima, gira tu dispositivo a modo horizontal (landscape).'}
        </p>
        <Button
          onClick={onDismiss}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {en ? 'Continue' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
