import React from 'react';
import { 
  Menu, 
  Search, 
  X, 
  ChevronDown, 
  RotateCcw,
  Bell
} from 'lucide-react';
import { useFinanceStore } from '../../stores/useFinanceStore';

const MONTHS = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' },
];

export default function Header({ onOpenDrawer, actions, title, pendingNotifsCount = 0, onOpenNotifs }) {
  const { filters, setFilters, clearFilters } = useFinanceStore();

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const hasActiveFilters = filters.year !== null || filters.month !== null || filters.search.trim() !== '';

  return (
    <header className="flex flex-col gap-4 pb-6 mb-6 border-b border-white/5">
      {/* Top Mobile Bar */}
      <div className="flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="p-2 rounded-xl bg-white/5 text-gray hover:text-light"
            aria-label="Abrir menú móvil"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-base text-light">{title || 'FinanzApp'}</h2>
        </div>

        {onOpenNotifs && (
          <button
            type="button"
            onClick={onOpenNotifs}
            className="relative p-2 rounded-xl bg-white/5 text-gray hover:text-light"
            aria-label="Notificaciones bancarias"
          >
            <Bell className="w-5 h-5 icon-bell" />
            {pendingNotifsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Main Filter and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Buscar transacciones..."
              className="w-full bg-input-bg border border-white/10 rounded-xl pl-9 pr-8 py-2 text-sm text-light placeholder-gray/60 focus:outline-none focus:border-primary transition-colors"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters({ search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray hover:text-light"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <select
              value={filters.year ?? ''}
              onChange={(e) => setFilters({ year: e.target.value === '' ? null : Number(e.target.value) })}
              className="bg-input-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-light appearance-none pr-8 focus:outline-none focus:border-primary cursor-pointer transition-colors"
            >
              <option value="">Todos los años</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
          </div>

          {/* Month Dropdown */}
          <div className="relative">
            <select
              value={filters.month ?? ''}
              onChange={(e) => setFilters({ month: e.target.value === '' ? null : Number(e.target.value) })}
              className="bg-input-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-light appearance-none pr-8 focus:outline-none focus:border-primary cursor-pointer transition-colors"
            >
              <option value="">Todos los meses</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray pointer-events-none" />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary-custom text-xs py-2 px-3 text-gray hover:text-light"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>

        {/* Custom Actions (e.g. Add Category / Add Budget) */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
