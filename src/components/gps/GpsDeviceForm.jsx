import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, X, Save, Zap, Palette } from "lucide-react";
import { motion } from "framer-motion";

const DEVICE_COLORS = [ "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#6b7280", "#f97316" ];

export default function GpsDeviceForm({ device, runners, teams, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    device_imei: "",
    device_name: "",
    runner_id: "",
    team_id: "",
    report_interval: 30,
    is_active: true,
    color: "#3b82f6" // Added color field with default
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (device) {
      setFormData({
        device_imei: device.device_imei || "",
        device_name: device.device_name || "",
        runner_id: device.runner_id || "",
        team_id: device.team_id || "",
        report_interval: device.report_interval || 30,
        is_active: device.is_active ?? true,
        color: device.color || "#3b82f6"
      });
    }
  }, [device]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.device_imei) newErrors.device_imei = "Debe seleccionar un dispositivo";
    if (!formData.device_name.trim()) newErrors.device_name = "El nombre es requerido";
    if (!formData.runner_id) newErrors.runner_id = "Debe seleccionar un corredor";
    if (!formData.team_id) newErrors.team_id = "Debe seleccionar un equipo";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving GPS device:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };
  


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
        <Card className="bg-white border-slate-200 text-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Smartphone className="w-5 h-5 text-blue-500" />
              {device ? "Editar Dispositivo GPS" : "Nuevo Dispositivo GPS"}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-4">
              
              <div>
                <Label htmlFor="device_imei" className="text-slate-600">IMEI / Número de serie *</Label>
                <Input
                  id="device_imei"
                  value={formData.device_imei}
                  onChange={(e) => handleInputChange("device_imei", e.target.value)}
                  className={`border-slate-300 font-mono ${errors.device_imei ? 'border-red-500' : ''} ${device ? 'bg-slate-100' : ''}`}
                  placeholder="Ej: 123456789012345"
                  disabled={!!device}
                />
                {errors.device_imei && <p className="text-red-500 text-xs mt-1">{errors.device_imei}</p>}
              </div>

              <div>
                <Label htmlFor="device_name" className="text-slate-600">Nombre del Dispositivo *</Label>
                <Input
                  id="device_name"
                  value={formData.device_name}
                  onChange={(e) => handleInputChange("device_name", e.target.value)}
                  className={`border-slate-300 ${errors.device_name ? 'border-red-500' : ''}`}
                  placeholder="Ej: GPS-001, Tracker Juan"
                  disabled={!device}
                />
                {errors.device_name && <p className="text-red-500 text-xs mt-1">{errors.device_name}</p>}
              </div>
              
              <div>
                <Label htmlFor="team_id" className="text-slate-600">Equipo *</Label>
                <Select value={formData.team_id} onValueChange={(value) => handleInputChange("team_id", value)}>
                  <SelectTrigger className={`border-slate-300 ${errors.team_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Selecciona un equipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }}></div>
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team_id && <p className="text-red-500 text-xs mt-1">{errors.team_id}</p>}
              </div>

              <div>
                <Label htmlFor="runner_id" className="text-slate-600">Corredor Asociado *</Label>
                <Select value={formData.runner_id} onValueChange={(value) => handleInputChange("runner_id", value)}>
                  <SelectTrigger className={`border-slate-300 ${errors.runner_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Selecciona un corredor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {runners
                      .filter(runner => !formData.team_id || runner.team_id === formData.team_id)
                      .map((runner) => ( <SelectItem key={runner.id} value={runner.id}>{runner.name}</SelectItem> ))
                    }
                  </SelectContent>
                </Select>
                {errors.runner_id && <p className="text-red-500 text-xs mt-1">{errors.runner_id}</p>}
              </div>

              <div>
                <Label className="text-slate-600 flex items-center gap-2 mb-3"><Palette className="w-4 h-4" />Color del Dispositivo</Label>
                <div className="grid grid-cols-5 gap-2">
                  {DEVICE_COLORS.map((color) => (
                    <button 
                      key={color} 
                      type="button" 
                      onClick={() => handleInputChange("color", color)} 
                      className={`w-10 h-10 rounded-full border-2 transition-all ${ formData.color === color ? 'border-slate-800 scale-110' : 'border-slate-300 hover:border-slate-500' }`} 
                      style={{ backgroundColor: color }} 
                      title={`Seleccionar ${color}`} 
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="report_interval" className="text-slate-600 flex items-center gap-2"><Zap className="w-4 h-4" />Intervalo de Reporte</Label>
                <Select value={formData.report_interval.toString()} onValueChange={(value) => handleInputChange("report_interval", parseInt(value))}>
                  <SelectTrigger className="border-slate-300"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Cada 10 segundos (Máxima precisión)</SelectItem>
                    <SelectItem value="20">Cada 20 segundos (Balance)</SelectItem>
                    <SelectItem value="30">Cada 30 segundos (Ahorro de batería)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange("is_active", e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                />
                <Label htmlFor="is_active" className="text-slate-600 cursor-pointer">Dispositivo activo</Label>
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : (<><Save className="w-4 h-4 mr-2" />{device ? "Actualizar" : "Crear"}</>)}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </motion.div>
  );
}