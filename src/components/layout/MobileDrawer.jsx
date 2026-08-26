import React from 'react';
import { 
  X, 
  Search, 
  Calendar, 
  RotateCcw, 
  Sun, 
  Moon, 
  LogOut, 
  Download, 
  Upload, 
  Trash2,
  Bell
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

export default function MobileDrawer({ 
  isOpen, 
  onClose, 
  onOpenNotifications, 
  onExport, 
  onImport, 
  onDeleteAllCategories 
}) {
  const { user, isGuest, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  if (!isOpen) return null;

  const displayName = isGuest ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = isGuest ? 'Modo sin cuenta' : user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-4/5 max-w-xs bg-sidebar-bg h-full p-6 flex flex-col z-10 border-r border-white/5 shadow-2xl animate-slide-left overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray hover:text-light"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5 icon-x" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pb-6 border-b border-white/5 mt-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-lg font-bold">
            {initial}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-light truncate">{displayName}</h3>
            <p className="text-xs text-gray truncate">{displayEmail}</p>
          </div>
        </div>

        {/* Action list */}
        <div className="flex-1 py-6 space-y-2">
          {onOpenNotifications && (
            <button
              type="button"
              onClick={() => { onClose(); onOpenNotifications(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-light hover:bg-white/5 transition-colors"
            >
              <Bell className="w-4 h-4 text-warning icon-bell" />
              <span>Notificaciones Bancarias</span>
            </button>
          )}

          {onExport && (
            <button
              type="button"
              onClick={() => { onClose(); onExport(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-light hover:bg-white/5 transition-colors"
            >
              <Download className="w-4 h-4 text-secondary icon-download" />
              <span>Exportar Respaldo</span>
            </button>
          )}

          {onImport && (
            <button
              type="button"
              onClick={() => { onClose(); onImport(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-light hover:bg-white/5 transition-colors"
            >
              <Upload className="w-4 h-4 text-accent icon-upload" />
              <span>Importar Respaldo</span>
            </button>
          )}

          {onDeleteAllCategories && (
            <button
              type="button"
              onClick={() => { onClose(); onDeleteAllCategories(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 icon-trash" />
              <span>Eliminar Categorías</span>
            </button>
          )}
        </div>

        {/* Footer controls */}
        <div className="pt-6 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-light hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-warning icon-sun" /> : <Moon className="w-4 h-4 text-accent icon-moon" />}
              <span>Tema {theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </div>
            <span className="text-xs text-gray">Cambiar</span>
          </button>

          <button
            type="button"
            onClick={() => { onClose(); logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4 icon-logout" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
