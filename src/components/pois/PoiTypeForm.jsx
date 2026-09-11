import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadFile } from "@/integrations/Core";
import { Tag, X, Save, Upload } from "lucide-react";
import { motion } from "framer-motion";
import PoiIcon from "./PoiIcon";
import { useLanguage } from "@/lib/LanguageContext";

export default function PoiTypeForm({ 
  poiType = null, 
  onSave, 
  onCancel 
}) {
  const { language } = useLanguage(); const en = language === 'en';
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    icon_url: "",
    show_in_profile: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (poiType) {
      setFormData({
        name: poiType.name || "",
        description: poiType.description || "",
        color: poiType.color || "#3b82f6",
        icon_url: poiType.icon_url || "",
        show_in_profile: poiType.show_in_profile !== undefined ? poiType.show_in_profile : true
      });
    }
  }, [poiType]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Función para optimizar imágenes (resize y compresión)
  const optimizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = "anonymous"; // Handle potential CORS issues if source is a URL
      
      img.onload = () => {
        // Tamaño objetivo para iconos: máximo 64x64px
        const maxSize = 64;
        let { width, height } = img;
        
        // Calcular nuevo tamaño manteniendo aspecto
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Configurar canvas
        canvas.width = width;
        canvas.height = height;
        
        // Limpiar canvas con transparencia
        ctx.clearRect(0, 0, width, height);
        
        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a blob PNG con transparencia
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Crear nuevo archivo optimizado
              const optimizedFile = new File([blob], `optimized_${file.name}`, {
                type: 'image/png',
                lastModified: Date.now()
              });
              resolve(optimizedFile);
            } else {
              reject(new Error("Canvas to Blob conversion failed"));
            }
          },
          'image/png',
          0.9 // Calidad del 90%
        );
      };
      
      img.onerror = () => {
        // Si hay error, rechazar la promesa
        reject(new Error("Image failed to load"));
      };
      
      // Cargar imagen
      img.src = URL.createObjectURL(file);
    });
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Aceptar solo imágenes (PNG, JPG, SVG)
    const allowedTypes = ['image/', 'image/svg+xml'];
    const isValidFile = allowedTypes.some(type => file.type.startsWith(type));
    
    if (!isValidFile) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG, etc.).');
      return;
    }

    setIsUploadingIcon(true);
    try {
      if (file.type.startsWith('image/')) {
        // Para imágenes, hacer resize y optimización si es necesario
        const optimizedFile = await optimizeImage(file);
        const { file_url } = await UploadFile({ file: optimizedFile });
        setFormData(prev => ({ ...prev, icon_url: file_url }));
      } else { // Handle SVG and other direct uploads
        // Para otros tipos (como SVG), subir directamente
        const { file_url } = await UploadFile({ file });
        setFormData(prev => ({ ...prev, icon_url: file_url }));
      }
    } catch (error) {
      console.error("Error uploading icon:", error);
      alert('Error procesando el archivo de imagen. Por favor, inténtalo de nuevo.');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving POI type:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const presetColors = [
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b", 
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1", "#14b8a6", "#eab308"
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
        className="w-full max-w-md"
      >
        <Card className="max-h-[90vh] flex flex-col bg-white border-slate-200 text-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Tag className="w-5 h-5 text-blue-500" />
              {poiType ? (en ? "Edit POI Type" : "Editar Tipo de POI") : (en ? "New POI Type" : "Nuevo Tipo de POI")}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-600">{en ? 'Type name' : 'Nombre del tipo'} *</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} placeholder="Ej: Refugio, Mirador, Fuente..." className={`bg-slate-50 border-slate-300 ${errors.name ? 'border-red-500' : ''}`}/>
                {errors.name && (<p className="text-xs text-red-600">{errors.name}</p>)}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-600">{en ? 'Description' : 'Descripción'}</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} placeholder="Descripción del tipo de POI..." className="h-20 bg-slate-50 border-slate-300"/>
              </div>

              <div className="space-y-3">
                <Label className="text-slate-600">{en ? 'Type color' : 'Color del tipo'}</Label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        formData.color === color 
                          ? 'border-slate-400 ring-2 ring-slate-300' 
                          : 'border-transparent hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleInputChange("color", color)}
                    />
                  ))}
                  <Input type="color" value={formData.color} onChange={(e) => handleInputChange("color", e.target.value)} className="w-12 h-8 p-1 bg-slate-50 border-slate-300"/>
                </div>
              </div>

              {/* Subir icono */}
              <div className="space-y-3">
                <Label className="text-slate-600">{en ? 'Custom icon (optional)' : 'Icono personalizado (opcional)'}</Label>
                <div className="flex items-center gap-4">
                  <PoiIcon type={{ icon_url: formData.icon_url, color: formData.color, name: formData.name || 'Preview' }} className="w-12 h-12" />
                  <div className="flex-1">
                    <label htmlFor="icon-upload" className="block">
                      <Button type="button" variant="outline" size="sm" disabled={isUploadingIcon} asChild>
                        <span className="cursor-pointer border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800 w-full">
                          {isUploadingIcon ? (
                              <div className="flex items-center gap-2 text-slate-600 justify-center">
                                <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin"></div>
                                {en ? 'Processing...' : 'Procesando...'}
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 text-slate-700 justify-center">
                                <Upload className="w-4 h-4"/>
                                {en ? 'Upload icon' : 'Subir icono'}
                              </div>
                          )}
                        </span>
                      </Button>
                    </label>
                    <input 
                      type="file" 
                      accept="image/*,image/svg+xml"
                      onChange={handleIconUpload} 
                      className="hidden" 
                      id="icon-upload"
                    />
                    {formData.icon_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, icon_url: "" }))}
                        className="mt-2 text-slate-500 hover:text-red-500 w-full"
                      >
                        {en ? 'Remove icon' : 'Eliminar icono'}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {en ? 'Accepted: PNG, JPG, SVG. Automatically optimized to 64x64px with a transparent background.' : 'Acepta: PNG, JPG, SVG. Se optimizará automáticamente a 64x64px con fondo transparente.'}
                </p>
              </div>

              {/* Mostrar en perfil de elevación */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show_in_profile"
                    checked={formData.show_in_profile}
                    onChange={(e) => handleInputChange("show_in_profile", e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <Label htmlFor="show_in_profile" className="text-slate-600 cursor-pointer">
                    {en ? 'Show in elevation profile' : 'Mostrar en perfil de elevación'}
                  </Label>
                </div>
                <p className="text-xs text-slate-500">
                  {en ? 'When enabled, POIs of this type appear on the elevation chart.' : 'Si está marcado, los POIs de este tipo aparecerán en el gráfico de elevación.'}
                </p>
              </div>
              
              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
                  {en ? 'Cancel' : 'Cancelar'}
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 text-white"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Guardando...</div>
                  ) : (
                    <div className="flex items-center gap-2 text-white"><Save className="w-4 h-4" />{en ? 'Save Type' : 'Guardar Tipo'}</div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
