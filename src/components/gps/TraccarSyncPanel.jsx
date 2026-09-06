import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Satellite, CheckCircle, SkipForward, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { importTraccarDevices } from '@/functions/importTraccarDevices';

export default function TraccarSyncPanel({ onTokenError }) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [apiError, setApiError] = useState(null);

  const handleImportDevices = useCallback(async () => {
    setIsImporting(true);
    setImportResults(null);
    setApiError(null);
    try {
      const response = await importTraccarDevices();
      setImportResults(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setApiError(errorMessage);
      if (errorMessage.includes('credentials not configured')) {
        onTokenError();
      }
    } finally {
      setIsImporting(false);
    }
  }, [onTokenError]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'created':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'skipped':
        return <SkipForward className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-blue-500" />
            Sincronización con Traccar
          </div>
          <Button
            onClick={handleImportDevices}
            disabled={isImporting}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isImporting ? 'animate-spin' : ''}`} />
            {isImporting ? 'Importando...' : 'Importar Dispositivos'}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {apiError && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error de Conexión: {apiError}
                </AlertDescription>
            </Alert>
        )}

        <AnimatePresence>
          {importResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>{importResults.message}</AlertDescription>
              </Alert>

              {importResults.results?.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {importResults.results.map((result, index) => (
                    <div key={index} className="p-2 rounded-lg border bg-slate-50 flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <span className="font-mono text-sm">{result.device}</span>
                      <span className="text-xs text-slate-500 truncate">({result.name})</span>
                      <span className="text-xs text-slate-600 ml-auto">{result.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!importResults && !isImporting && !apiError && (
          <div className="text-center text-slate-500 py-6">
            <p className="text-sm">
              Haz clic en "Importar Dispositivos" para añadir automáticamente a la aplicación todos los dispositivos configurados en tu servidor de Traccar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}