
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import {
  Settings,
  Upload,
  MapPin,
  Tag,
  Users,
  ChevronDown,
  Route,
  UserCheck,
  Satellite,
} from 'lucide-react';

export default function AdminMenu() {
  const { language } = useLanguage();
  const en = language === 'en';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-800"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      {/* Increased z-index to ensure the menu appears above the map and other components */}
      <DropdownMenuContent className="bg-white border-slate-200 text-slate-800 w-64 z-[9999]" align="end">
        <DropdownMenuLabel>{en ? 'Data Management' : 'Gestión de Datos'}</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('UploadGpxPage')} className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Upload New Route' : 'Subir Nueva Ruta'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Routes')} className="flex items-center gap-2">
            <Route className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Route Library' : 'Biblioteca de Rutas'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Management')} className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Manage POIs' : 'Gestionar POIs'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Management', { tab: 'types' })} className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Manage POI Types' : 'Gestionar Tipos POI'}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuLabel>{en ? 'Team Management' : 'Gestión de Equipos'}</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('UserManagement')} className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Manage Users' : 'Gestionar Usuarios'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('RunnerManagement')} className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Runners and Teams' : 'Corredores y Equipos'}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuLabel>{en ? 'Tracking' : 'Seguimiento'}</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('CompanionTracking')} className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-slate-500" />
            <span>{en ? 'Global Tracking' : 'Seguimiento Global'}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
            <Link to={createPageUrl("AppSettings")} className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <span>{en ? 'App Settings' : 'Configuración de la App'}</span>
            </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
