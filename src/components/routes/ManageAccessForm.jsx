import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, X, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "../../lib/LanguageContext";

export default function ManageAccessForm({
  route,
  allUsers,
  onSave,
  onCancel,
}) {
  const { language } = useLanguage();
  const en = language === 'en';
  const [selectedUserEmails, setSelectedUserEmails] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerEmail = (() => {
    const cb = route?.created_by;
    if (cb && typeof cb === 'object') return cb.email;
    return cb;
  })();

  useEffect(() => {
    const allowed = route?.allowed_user_emails || [];
    // El propietario siempre tiene acceso
    const withOwner = ownerEmail && !allowed.includes(ownerEmail)
      ? [...allowed, ownerEmail]
      : [...allowed];
    setSelectedUserEmails(withOwner);
  }, [route]);

  const handleUserSelection = (email) => {
    setSelectedUserEmails((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Asegurar que el propietario siempre quede con acceso
    const finalEmails = ownerEmail && !selectedUserEmails.includes(ownerEmail)
      ? [...selectedUserEmails, ownerEmail]
      : selectedUserEmails;
    await onSave(route.id, finalEmails);
    setIsSubmitting(false);
  };
  
  const handleSelectAll = () => {
    const allNonAdminEmails = allUsers.map(u => u.email);
    setSelectedUserEmails(allNonAdminEmails);
  };

  const handleDeselectAll = () => {
    setSelectedUserEmails([]);
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
        className="w-full max-w-lg"
      >
        <Card className="max-h-[90vh] flex flex-col bg-white border-slate-200 text-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Users className="w-5 h-5 text-blue-500" />
                Gestionar Acceso
              </CardTitle>
              <p className="text-sm text-slate-500 truncate mt-1">{route.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-800 flex-shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <Label className="text-slate-600">
                    {en ? 'Select users with access:' : 'Selecciona los usuarios con acceso:'}
                  </Label>
                  <div className="flex gap-2">
                      <Button type="button" size="xs" variant="outline" onClick={handleSelectAll}>{en ? 'All' : 'Todos'}</Button>
                      <Button type="button" size="xs" variant="outline" onClick={handleDeselectAll}>{en ? 'None' : 'Ninguno'}</Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                  {allUsers.length > 0 ? (
                    allUsers.map((user) => {
                      const isOwner = ownerEmail && user.email === ownerEmail;
                      return (
                        <div key={user.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`user-access-${user.id}`}
                            checked={isOwner || selectedUserEmails.includes(user.email)}
                            onChange={() => !isOwner && handleUserSelection(user.email)}
                            disabled={isOwner}
                            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-60"
                          />
                          <Label
                            htmlFor={`user-access-${user.id}`}
                            className="font-normal flex-1 flex items-center gap-2"
                          >
                            {user.full_name}{" "}
                            <span className="text-slate-500 text-xs">
                              ({user.email})
                            </span>
                            {isOwner && (
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                {en ? 'Owner' : 'Propietario'}
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">{en ? 'No other registered users.' : 'No hay otros usuarios registrados.'}</p>
                  )}
                </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
                {en ? 'Cancel' : 'Cancelar'}
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? (en ? 'Saving...' : 'Guardando...') : <><Save className="w-4 h-4 mr-2" /> {en ? 'Save Changes' : 'Guardar Cambios'}</>}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </motion.div>
  );
}
