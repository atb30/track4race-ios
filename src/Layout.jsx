import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Map as MapIcon } from "lucide-react";
import LoadingScreen from "./components/common/LoadingScreen";
import AdminMenu from "./components/common/AdminMenu"; // Importar el componente centralizado
import { useLanguage } from "./lib/LanguageContext";

const AdminHeader = () => {
  const { language } = useLanguage();
  return (
  <header className="ocean-chrome fixed top-0 left-0 right-0 z-50 border-b h-16 flex items-center px-4 sm:px-6">
    <div className="flex items-center justify-between w-full">
      <Link to={createPageUrl("Navigation")}>
        <Button variant="ghost" className="flex items-center gap-2 text-slate-700 hover:text-slate-900">
          <MapIcon className="w-5 h-5" />
          <span className="font-semibold">{language === 'en' ? 'Back to Map' : 'Volver al Mapa'}</span>
        </Button>
      </Link>
      
      <AdminMenu /> {/* Usar el componente centralizado */}
    </div>
  </header>
  );
};

export default function Layout({ children }) {
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const user = await base44.auth.me();
        setUserRole(user.role);
      } catch (error) {
        setUserRole(null);
      } finally {
        setIsLoadingUser(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  if (location.pathname === createPageUrl("Navigation")) {
    return children;
  }

  if (isLoadingUser) {
    return <LoadingScreen message="Iniciando aplicación..." />;
  }

  return (
    <div className="min-h-screen">
      {userRole === 'admin' && <AdminHeader />}
      <main className={userRole === 'admin' ? "pt-16" : ""}>
        {children}
      </main>
    </div>
  );
}
