
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
        <DropdownMenuLabel>Gestión de Datos</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('UploadGpxPage')} className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Subir Nueva Ruta</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Routes')} className="flex items-center gap-2">
            <Route className="w-4 h-4 text-slate-500" />
            <span>Biblioteca de Rutas</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Management')} className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>Gestionar POIs</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('Management', { tab: 'types' })} className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-500" />
            <span>Gestionar Tipos POI</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuLabel>Gestión de Equipos</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('UserManagement')} className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span>Gestionar Usuarios</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('RunnerManagement')} className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Corredores y Equipos</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuLabel>Seguimiento</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
          <Link to={createPageUrl('CompanionTracking')} className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-slate-500" />
            <span>Seguimiento Global</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100">
            <Link to={createPageUrl("AppSettings")} className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Configuración de la App</span>
            </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
