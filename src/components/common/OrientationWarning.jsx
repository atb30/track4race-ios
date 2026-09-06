import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

export default function OrientationWarning({ onDismiss }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm mx-auto text-center shadow-2xl">
        <div className="mb-4">
          <RotateCw className="w-16 h-16 mx-auto text-blue-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-3">
          Mejor Experiencia
        </h2>
        <p className="text-slate-600 mb-6 text-sm">
          Para una navegación óptima, gira tu dispositivo a modo horizontal (landscape).
        </p>
        <Button
          onClick={onDismiss}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}