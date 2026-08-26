import React from 'react';
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
    <div className="page-header">
      <div className="filter-controls">
        <div className="filter-group">
          <label htmlFor="searchInput">Buscar:</label>
          <input
            type="text"
            id="searchInput"
            className="form-control search-input"
            placeholder="Buscar transacciones..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          {filters.search && (
            <button
              type="button"
              className="btn-icon"
              id="clearSearchBtn"
              title="Limpiar búsqueda"
              onClick={() => setFilters({ search: '' })}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="yearFilter">Año:</label>
          <select
            id="yearFilter"
            className="form-control"
            value={filters.year ?? ''}
            onChange={(e) => setFilters({ year: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Todos los años</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="monthFilter">Mes:</label>
          <select
            id="monthFilter"
            className="form-control"
            value={filters.month ?? ''}
            onChange={(e) => setFilters({ month: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Todos los meses</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-secondary"
            id="clearFiltersBtn"
            onClick={clearFilters}
          >
            <i className="fas fa-times"></i> Limpiar Filtros
          </button>
        )}
      </div>

      {actions && (
        <div className="header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
