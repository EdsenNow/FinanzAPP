import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Plus, PieChart, Settings } from 'lucide-react';

export default function MobileNav({ onOpenCreateModal }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar-bg/95 backdrop-blur-lg border-t border-white/5 z-40 px-3 flex items-center justify-around select-none">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-primary' : 'text-gray hover:text-light'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Dashboard</span>
      </NavLink>

      <NavLink
        to="/presupuestos"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-primary' : 'text-gray hover:text-light'
          }`
        }
      >
        <Wallet className="w-5 h-5" />
        <span>Presupuesto</span>
      </NavLink>

      {/* Floating Center Action */}
      <button
        type="button"
        onClick={onOpenCreateModal}
        className="flex flex-col items-center -mt-5"
        aria-label="Crear categoría o presupuesto"
      >
        <div className="w-12 h-12 rounded-full bg-primary text-dark flex items-center justify-center shadow-neon-primary hover:scale-105 transition-transform active:scale-95">
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </div>
        <span className="text-[10px] font-medium text-gray mt-1">Crear</span>
      </button>

      <NavLink
        to="/estadisticas"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-primary' : 'text-gray hover:text-light'
          }`
        }
      >
        <PieChart className="w-5 h-5" />
        <span>Estadística</span>
      </NavLink>

      <NavLink
        to="/configuracion"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-primary' : 'text-gray hover:text-light'
          }`
        }
      >
        <Settings className="w-5 h-5" />
        <span>Ajustes</span>
      </NavLink>
    </nav>
  );
}
