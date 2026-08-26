import React from 'react';
import { Edit2, Trash2, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, calculateBudgetStatus } from '../../services/dataCalculations';

export default function BudgetCard({
  budget,
  categories = [],
  currencySymbol = '$',
  onEdit,
  onDelete
}) {
  const { spent, remaining, percent, status } = calculateBudgetStatus(budget, categories);
  const cat = categories.find((c) => String(c.id) === String(budget.categoryId));

  const getStatusColor = () => {
    if (status === 'danger') return 'text-danger bg-danger/15 border-danger/30';
    if (status === 'warning') return 'text-warning bg-warning/15 border-warning/30';
    return 'text-success bg-success/15 border-success/30';
  };

  const getProgressBarColor = () => {
    if (status === 'danger') return 'bg-danger shadow-[0_0_12px_rgba(235,111,146,0.6)]';
    if (status === 'warning') return 'bg-warning shadow-[0_0_12px_rgba(246,193,119,0.6)]';
    return 'bg-success shadow-[0_0_12px_rgba(45,149,123,0.6)]';
  };

  const periodLabel = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    yearly: 'Anual',
    custom: 'Personalizado'
  }[budget.period] || 'Mensual';

  return (
    <div className="card-glass p-5 flex flex-col justify-between group hover:border-primary/40 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-light">{budget.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor()}`}>
              {percent.toFixed(0)}%
            </span>
          </div>
          <span className="text-xs text-gray">{cat ? cat.name : 'Todas las categorías'} • {periodLabel}</span>
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(budget)}
            className="p-1 text-gray hover:text-accent rounded"
            title="Editar presupuesto"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(budget.id)}
            className="p-1 text-gray hover:text-danger rounded"
            title="Eliminar presupuesto"
          >
            <Trash2 className="w-3.5 h-3.5 icon-trash" />
          </button>
        </div>
      </div>

      {/* Progress Meter */}
      <div className="my-5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray">Gastado: <b className="text-light">{formatCurrency(spent, currencySymbol)}</b></span>
          <span className="text-gray">Límite: <b className="text-light">{formatCurrency(budget.amount, currencySymbol)}</b></span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
        <div className="flex items-center gap-1.5">
          {status === 'danger' ? (
            <AlertCircle className="w-4 h-4 text-danger" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-success" />
          )}
          <span className={status === 'danger' ? 'text-danger font-medium' : 'text-gray'}>
            {remaining >= 0 ? 'Disponible' : 'Excedido'}
          </span>
        </div>
        <span className={`font-bold ${remaining >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatCurrency(Math.abs(remaining), currencySymbol)}
        </span>
      </div>
    </div>
  );
}
