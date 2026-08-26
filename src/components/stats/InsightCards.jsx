import React from 'react';
import { TrendingUp, TrendingDown, Award, Calendar } from 'lucide-react';
import { formatCurrency } from '../../services/dataCalculations';

export default function InsightCards({ 
  incomeToday = 0, 
  expensesToday = 0, 
  dailyAverage = 0, 
  topExpenseCategory = null,
  currencySymbol = '$' 
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 select-none">
      {/* Ingreso Hoy */}
      <div className="card-glass p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray">Ingreso de Hoy</span>
          <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <p className="text-xl font-extrabold text-light my-2">
          {formatCurrency(incomeToday, currencySymbol)}
        </p>
        <span className="text-[11px] text-gray">Registrado en la fecha</span>
      </div>

      {/* Gasto Hoy */}
      <div className="card-glass p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray">Gasto de Hoy</span>
          <div className="w-8 h-8 rounded-lg bg-danger/15 text-danger flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <p className="text-xl font-extrabold text-light my-2">
          {formatCurrency(expensesToday, currencySymbol)}
        </p>
        <span className="text-[11px] text-gray">Registrado en la fecha</span>
      </div>

      {/* Promedio Diario */}
      <div className="card-glass p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray">Neto Diario</span>
          <div className="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <p className={`text-xl font-extrabold my-2 ${dailyAverage >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatCurrency(dailyAverage, currencySymbol)}
        </p>
        <span className="text-[11px] text-gray">Balance neto del día</span>
      </div>

      {/* Mayor Categoría de Gasto */}
      <div className="card-glass p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray">Gasto Dominante</span>
          <div className="w-8 h-8 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <p className="text-lg font-extrabold text-light my-2 truncate" title={topExpenseCategory?.name || 'N/A'}>
          {topExpenseCategory ? topExpenseCategory.name : 'Sin datos'}
        </p>
        <span className="text-[11px] text-gray">
          {topExpenseCategory ? formatCurrency(topExpenseCategory.amount, currencySymbol) : '0 movimientos'}
        </span>
      </div>
    </div>
  );
}
