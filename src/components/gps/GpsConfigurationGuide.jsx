import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { X, Info, Smartphone, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GpsConfigurationGuide({ onCancel }) {
  const commands = [
    {
      step: 1,
      title: "Configurar el APN",
      description: "Esto configura el dispositivo para usar la red de datos de tu tarjeta SIM.",
      command: "APN,nombre_del_apn,usuario,contraseña#",
      example: "Ejemplo para Movistar (España): APN,movistar.es,movistar,movistar#",
      note: "Consulta el APN correcto con tu proveedor de telefonía móvil."
    },
    {
      step: 2,
      title: "Configurar el Servidor y Puerto",
      description: "Aquí es donde apuntas el dispositivo al servidor que recibirá los datos.",
      command: "IP,[IP_DEL_SERVIDOR],[PUERTO]#",
      example: "Ejemplo: IP,123.45.67.89,8080#",
      note: "Este es el paso más técnico. La IP y el Puerto deben ser proporcionados por el administrador del sistema que ha configurado el servicio de escucha."
    },
    {
      step: 3,
      title: "Establecer Intervalo de Reporte",
      description: "Define cada cuántos segundos el dispositivo enviará su ubicación.",
      command: "UPLOAD,[SEGUNDOS]#",
      example: "Para 30 segundos (recomendado): UPLOAD,30#",
      note: "Un intervalo más corto consume más batería y datos."
    },
    {
      step: 4,
      title: "Reiniciar el Dispositivo",
      description: "Aplica todos los cambios reiniciando el dispositivo.",
      command: "RESET#",
      example: "",
      note: "Espera a que el dispositivo se reconecte a la red."
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="max-h-[90vh] flex flex-col bg-white border-slate-200 text-slate-800">
          <CardHeader className="flex flex-row items-start justify-between border-b border-slate-200">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 mb-1">
                <Smartphone className="w-5 h-5 text-blue-500" />
                Guía de Configuración: Sinotrack ST-903
              </CardTitle>
              <CardDescription>
                Sigue estos pasos para configurar tu dispositivo GPS vía SMS.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800 flex-shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 overflow-y-auto space-y-6">
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <Info className="h-4 w-4 !text-blue-800" />
              <AlertTitle>Requisitos Previos</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm mt-1">
                  <li>Una tarjeta SIM con un plan de datos activo y saldo.</li>
                  <li>El dispositivo GPS ST-903 cargado y encendido.</li>
                  <li>Un teléfono móvil para enviar los comandos por SMS.</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              {commands.map(cmd => (
                <div key={cmd.step}>
                  <h3 className="font-semibold text-slate-700">{cmd.step}. {cmd.title}</h3>
                  <p className="text-sm text-slate-500 mb-2">{cmd.description}</p>
                  <pre className="bg-slate-100 p-3 rounded-md text-sm text-slate-900 font-mono break-words">
                    <code>{cmd.command}</code>
                  </pre>
                  {cmd.example && <p className="text-xs text-slate-400 mt-1">{cmd.example}</p>}
                  {cmd.note && <p className="text-xs text-slate-400 mt-1">Nota: {cmd.note}</p>}
                </div>
              ))}
            </div>

            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
              <AlertTriangle className="h-4 w-4 !text-red-800" />
              <AlertTitle>¡Importante! Configuración del Servidor</AlertTitle>
              <AlertDescription>
                La aplicación actual <strong>no incluye</strong> el servicio de backend necesario para recibir datos directamente de un dispositivo GPS. El paso 2 (Configurar Servidor y Puerto) requiere un desarrollo adicional por parte de un programador para crear un "listener" en un servidor público. Contacta con el administrador del sistema para obtener la IP y el Puerto correctos una vez que este servicio esté creado.
              </AlertDescription>
            </Alert>
          </CardContent>
          <div className="p-6 pt-0 mt-auto">
            <Button onClick={onCancel} className="w-full bg-blue-600 hover:bg-blue-700">
                Entendido
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}