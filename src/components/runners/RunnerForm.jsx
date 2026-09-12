import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, X, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";

export default function RunnerForm({ runner, teams, onSave, onCancel }) {
  const { language } = useLanguage(); const en = language === 'en';
  const [formData, setFormData] = useState({
    name: "",
    device_id: "",
    team_id: "",
    phone_number: "",
    notes: "",
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (runner) {
      setFormData({
        name: runner.name || "",
        device_id: runner.device_id || "",
        team_id: runner.team_id || "",
        phone_number: runner.phone_number || "",
        notes: runner.notes || "",
        is_active: runner.is_active ?? true
      });
    }
  }, [runner]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = en ? "Name is required" : "El nombre es requerido";
    }
    
    if (!formData.device_id.trim()) {
      newErrors.device_id = en ? "Device ID is required" : "El ID del dispositivo es requerido";
    }
    
    if (!formData.team_id) {
      newErrors.team_id = en ? "Select a team" : "Debe seleccionar un equipo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving runner:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
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
              <UserCheck className="w-5 h-5 text-blue-500" />
              {runner ? (en ? "Edit Runner" : "Editar Corredor") : (en ? "New Runner" : "Nuevo Corredor")}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="name" className="text-slate-600">
                  {en ? 'Runner Name' : 'Nombre del Corredor'} *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`border-slate-300 ${errors.name ? 'border-red-500' : ''}`}
                  placeholder={en ? 'E.g. John Smith' : 'Ej: Juan Pérez'}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="device_id" className="text-slate-600">
                  {en ? 'GPS Device ID' : 'ID del Dispositivo GPS'} *
                </Label>
                <Input
                  id="device_id"
                  value={formData.device_id}
                  onChange={(e) => handleInputChange("device_id", e.target.value)}
                  className={`border-slate-300 font-mono ${errors.device_id ? 'border-red-500' : ''}`}
                  placeholder={en ? 'E.g. GPS001, IMEI123456789' : 'Ej: GPS001, IMEI123456789'}
                />
                {errors.device_id && <p className="text-red-500 text-xs mt-1">{errors.device_id}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {en ? 'Enter the unique identifier of the GPS device' : 'Introduce el identificador único del dispositivo GPS'}
                </p>
              </div>

              <div>
                <Label htmlFor="team_id" className="text-slate-600">
                  {en ? 'Team' : 'Equipo'} *
                </Label>
                <Select 
                  value={formData.team_id} 
                  onValueChange={(value) => handleInputChange("team_id", value)}
                >
                  <SelectTrigger className={`border-slate-300 ${errors.team_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder={en ? 'Select a team...' : 'Selecciona un equipo...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: team.color }}
                          ></div>
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team_id && <p className="text-red-500 text-xs mt-1">{errors.team_id}</p>}
              </div>

              <div>
                <Label htmlFor="phone_number" className="text-slate-600">
                  {en ? 'Phone Number' : 'Número de Teléfono'}
                </Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange("phone_number", e.target.value)}
                  className="border-slate-300"
                  placeholder={en ? 'E.g. +34 600 123 456' : 'Ej: +34 600 123 456'}
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-slate-600">
                  {en ? 'Additional Notes' : 'Notas Adicionales'}
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  className="border-slate-300 h-20"
                  placeholder={en ? 'Additional information about the runner...' : 'Información adicional sobre el corredor...'}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange("is_active", e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                />
                <Label htmlFor="is_active" className="text-slate-600 cursor-pointer">
                  {en ? 'Active runner' : 'Corredor activo'}
                </Label>
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
                {en ? 'Cancel' : 'Cancelar'}
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? (en ? "Saving..." : "Guardando...") : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {runner ? (en ? "Update" : "Actualizar") : (en ? "Create" : "Crear")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </motion.div>
  );
}
