import React, { useState } from 'react';
import { formatCurrency, calculateBudgetStatus } from '../../services/dataCalculations';

export default function BudgetCard({
  budget,
  categories = [],
  currencySymbol = '$',
  onEdit,
  onDelete
}) {
  const [showMenu, setShowMenu] = useState(false);
  const { spent, remaining, percent, status } = calculateBudgetStatus(budget, categories);
  const cat = categories.find((c) => String(c.id) === String(budget.categoryId));

  const periodLabel = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    yearly: 'Anual',
    custom: 'Personalizado'
  }[budget.period] || 'Mensual';

  return (
    <div className="category-card fade-in">
      {/* Header */}
      <div className="category-header">
        <div className="category-name" title={budget.name}>
          {budget.name}
        </div>

        <div className="category-menu-wrapper">
          <button
            className="category-menu-btn btn-icon"
            type="button"
            title="Opciones"
            onClick={() => setShowMenu(!showMenu)}
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>

          {showMenu && (
            <div className="category-menu active" style={{ display: 'block' }}>
              <button
                className="category-menu-item"
                type="button"
                onClick={() => { setShowMenu(false); onEdit(budget); }}
              >
                <i className="fas fa-edit"></i> Editar
              </button>
              <button
                className="category-menu-item danger"
                type="button"
                onClick={() => { setShowMenu(false); onDelete(budget.id); }}
              >
                <i className="fas fa-trash"></i> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px', fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
        {cat ? cat.name : 'Todas las categorías'} • {periodLabel}
      </div>

      {/* Stats Summary */}
      <div className="category-stats alt">
        <div className="ie-summary">
          <div className="amount-chip expense" title="Gastado">
            <i className="fas fa-arrow-down"></i>
            <span>{formatCurrency(spent, currencySymbol)}</span>
          </div>
          <div className="amount-chip income" title="Límite">
            <i className="fas fa-bullseye"></i>
            <span>{formatCurrency(budget.amount, currencySymbol)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar and Details */}
      <div className="category-details" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
          <span>Progreso: <b>{percent.toFixed(0)}%</b></span>
          <span style={{ color: remaining >= 0 ? 'var(--success, #2D957B)' : 'var(--danger, #eb6f92)', fontWeight: 'bold' }}>
            {remaining >= 0 ? `Restante: ${formatCurrency(remaining, currencySymbol)}` : `Excedido: ${formatCurrency(Math.abs(remaining), currencySymbol)}`}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, percent)}%`,
              backgroundColor: status === 'danger' ? 'var(--danger, #eb6f92)' : status === 'warning' ? 'var(--warning, #f6c177)' : 'var(--success, #2D957B)',
              borderRadius: '4px',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>
    </div>
  );
}
