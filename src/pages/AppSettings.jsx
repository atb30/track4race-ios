import React, { useState, useEffect } from "react";
import { AppConfig, User } from "@/entities/all"; import { base44 } from "@/api/base44Client";
import { UploadFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Settings, ArrowLeft, Image, CheckCircle, Database, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LoadingScreen from "../components/common/LoadingScreen";
import AppLogo from "../components/common/AppLogo";
import { useLanguage } from "../lib/LanguageContext";

export default function AppSettings() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [logoKey, setLogoKey] = useState(0);
  const [debugInfo, setDebugInfo] = useState([]);

  useEffect(() => {
    const checkUserAndLoadSettings = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
        
        if (user.role !== 'admin') {
          window.location.href = createPageUrl("Navigation");
          return;
        }
        
        // Debug: Cargar TODA la configuración para ver qué hay
        const allConfigs = await AppConfig.list();
        console.log("Todas las configuraciones en AppConfig:", allConfigs);
        setDebugInfo(allConfigs);
        
        const logoConfig = allConfigs.find(config => config.key === 'app_logo_url');
        if (logoConfig && logoConfig.value) {
          setCurrentLogoUrl(logoConfig.value);
          console.log("Logo actual encontrado:", logoConfig.value);
        } else {
          console.log("No se encontró configuración de logo");
        }
        
      } catch (error) {
        base44.auth.redirectToLogin(window.location.href);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUserAndLoadSettings();
  }, []);

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG).');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);
    try {
      console.log("Subiendo archivo...");
      const { file_url } = await UploadFile({ file });
      console.log("Archivo subido, URL:", file_url);
      
      const logoUrl = `${file_url}?v=${Date.now()}`;
      console.log("URL final con cache busting:", logoUrl);
      
      const existingConfigs = await AppConfig.list();
      const logoConfig = existingConfigs.find(config => config.key === 'app_logo_url');
      
      if (logoConfig) {
        console.log("Actualizando configuración existente:", logoConfig.id);
        await AppConfig.update(logoConfig.id, { value: logoUrl });
      } else {
        console.log("Creando nueva configuración de logo");
        await AppConfig.create({ 
          key: 'app_logo_url',
          value: logoUrl,
          description: "URL del logo de la aplicación" 
        });
      }
      
      setCurrentLogoUrl(logoUrl);
      
      // Forzar actualización inmediata
      console.log("Disparando evento de actualización...");
      window.dispatchEvent(new CustomEvent('logoUpdated'));
      
      setLogoKey(prev => prev + 1);
      setUploadSuccess(true);
      
      // Recargar las configuraciones para debug
      const updatedConfigs = await AppConfig.list();
      setDebugInfo(updatedConfigs);
      
    } catch (error) {
      console.error("Error completo subiendo el logo:", error);
      alert('Error subiendo el logo: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading || userRole !== 'admin') {
    return <LoadingScreen message={en ? 'Loading settings...' : 'Cargando configuración...'} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link to={createPageUrl("Navigation")}>
          <Button variant="ghost" className="mb-4 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {en ? 'Back to Map' : 'Volver al Mapa'}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" />
          {en ? 'Application Settings' : 'Configuración de la Aplicación'}
        </h1>
        <p className="text-slate-500 mt-2">
          {en ? 'Customize the Track4Race logo and appearance' : 'Personaliza el logo y la apariencia de Track4Race'}
        </p>
      </div>

      {/* Debug Information */}
      <Card className="bg-slate-50 border-slate-200 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <Database className="w-5 h-5" />
            {en ? 'Debug Information' : 'Información de Debug'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              <strong>URL actual del logo:</strong> {currentLogoUrl || "No configurado"}
            </p>
            <p className="text-sm text-slate-600">
              <strong>Total de configuraciones:</strong> {debugInfo.length}
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                <Eye className="w-4 h-4 inline mr-1" />
                Ver todas las configuraciones
              </summary>
              <pre className="mt-2 bg-white p-2 rounded border text-xs overflow-x-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-600" />
            {en ? 'Application Logo' : 'Logo de la Aplicación'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">{en ? 'Current Logo' : 'Logo Actual'}</h3>
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <AppLogo key={logoKey} className="w-16 h-16" showText={false} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">
                  {currentLogoUrl ? (en ? 'Custom logo loaded' : 'Logo personalizado cargado') : 'Track4Race Logo'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {currentLogoUrl ? "Se mostrará en todas las pantallas de la aplicación" : "Sube tu logo para reemplazar las iniciales"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">{en ? 'Upload New Logo' : 'Subir Nuevo Logo'}</h3>
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-sm text-slate-600 mb-4">
                  Sube una imagen PNG, JPG o SVG para personalizar tu aplicación
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                  disabled={isUploading}
                />
                <label htmlFor="logo-upload">
                  <Button 
                    asChild
                    disabled={isUploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <span>
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Seleccionar Logo
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                {uploadSuccess && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
                    <CheckCircle className="w-5 h-5"/>
                    <p className="font-medium">¡Logo actualizado correctamente!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
