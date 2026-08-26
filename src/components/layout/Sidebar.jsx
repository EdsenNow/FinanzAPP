import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  PieChart, 
  Settings, 
  Sun, 
  Moon, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

export default function Sidebar() {
  const { user, isGuest, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/presupuestos', label: 'Presupuesto', icon: Wallet },
    { to: '/estadisticas', label: 'Estadística', icon: PieChart },
    { to: '/configuracion', label: 'Configuración', icon: Settings },
  ];

  const displayName = isGuest ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = isGuest ? 'Modo sin cuenta' : user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-sidebar-bg border-r border-white/5 z-30 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark shadow-neon-primary">
          <Sparkles className="w-5 h-5 text-dark" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-light">FinanzApp</h1>
          <span className="text-[11px] text-gray uppercase tracking-widest font-medium">Finanzas</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold border-l-4 border-primary'
                    : 'text-gray hover:text-light hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile & Theme/Logout Controls */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
          <div className="flex items-center gap-3 min-w-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-light truncate">{displayName}</p>
              <p className="text-[10px] text-gray truncate">{displayEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-gray hover:text-light hover:bg-white/5 transition-colors"
              title="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 icon-sun" /> : <Moon className="w-4 h-4 icon-moon" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray hover:text-danger hover:bg-danger/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 icon-logout" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
