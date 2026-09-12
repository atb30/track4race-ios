
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, X, Save, Palette, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";

const TEAM_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#84cc16", // Lime
  "#ec4899", // Pink
  "#6b7280"  // Gray
];

export default function TeamForm({ team, onSave, onCancel, allUsers = [] }) {
  const { language } = useLanguage(); const en = language === 'en';
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    is_active: true,
    allowed_user_emails: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        description: team.description || "",
        color: team.color || "#3b82f6",
        is_active: team.is_active ?? true,
        allowed_user_emails: team.allowed_user_emails || []
      });
    }
  }, [team]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "El nombre del equipo es requerido";
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
      console.error("Error saving team:", error);
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

  const handleUserSelection = (email) => {
    const currentEmails = formData.allowed_user_emails;
    const newEmails = currentEmails.includes(email)
      ? currentEmails.filter(e => e !== email)
      : [...currentEmails, email];
    handleInputChange("allowed_user_emails", newEmails);
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
              <Users className="w-5 h-5 text-blue-500" />
              {team ? (en ? "Edit Team" : "Editar Equipo") : (en ? "New Team" : "Nuevo Equipo")}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6"> {/* Changed space-y-4 to space-y-6 */}
              <div>
                <Label htmlFor="name" className="text-slate-600">
                  {en ? 'Team Name' : 'Nombre del Equipo'} *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`border-slate-300 ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="Ej: Equipo Montaña, Team Alpha"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="description" className="text-slate-600">
                  {en ? 'Description' : 'Descripción'}
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="border-slate-300 h-20"
                  placeholder={en ? 'Team description and objectives...' : 'Descripción del equipo y objetivos...'}
                />
              </div>

              <div>
                <Label className="text-slate-600 flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4" />
                  {en ? 'Team Color' : 'Color del Equipo'}
                </Label>
                <div className="grid grid-cols-5 gap-2">
                  {TEAM_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange("color", color)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        formData.color === color 
                          ? 'border-slate-800 scale-110' 
                          : 'border-slate-300 hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Seleccionar color ${color}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border border-slate-300" 
                    style={{ backgroundColor: formData.color }}
                  ></div>
                  <span className="text-sm text-slate-500">Color seleccionado: {formData.color}</span>
                </div>
              </div>

              <div>
                <Label className="text-slate-600 flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  {en ? 'Viewing access' : 'Acceso de visualización'}
                </Label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                  <p className="text-xs text-slate-500 mb-2">{en ? 'Select which non-administrator users can view this team’s runners.' : 'Selecciona qué usuarios (no administradores) pueden ver los corredores de este equipo.'}</p>
                  {allUsers.filter(u => u.role !== 'admin').map(user => (
                    <div key={user.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`user-access-${user.id}`}
                        checked={formData.allowed_user_emails.includes(user.email)}
                        onChange={() => handleUserSelection(user.email)}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <Label htmlFor={`user-access-${user.id}`} className="font-normal cursor-pointer flex-1">
                        {user.full_name} <span className="text-slate-500 text-xs">({user.email})</span>
                      </Label>
                    </div>
                  ))}
                  {allUsers.filter(u => u.role !== 'admin').length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">{en ? 'No non-administrator users in the system.' : 'No hay usuarios (no-admin) en el sistema.'}</p>
                  )}
                </div>
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
                  {en ? 'Active team' : 'Equipo activo'}
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
                    {team ? (en ? "Update" : "Actualizar") : (en ? "Create" : "Crear")}
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
