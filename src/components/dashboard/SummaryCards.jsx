import React from 'react';
import { ArrowUp, ArrowDown, Scale } from 'lucide-react';
import { formatCurrency } from '../../services/dataCalculations';

export default function SummaryCards({ totalIncome = 0, totalExpenses = 0, netBalance = 0, currencySymbol = '$' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 select-none">
      {/* Ingresos */}
      <div className="card-glass p-5 flex flex-col justify-between group hover:border-success/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray group-hover:text-success transition-colors">
            Ingresos Totales
          </span>
          <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
            <ArrowUp className="w-4 h-4 icon-arrow-up" />
          </div>
        </div>
        <div className="my-3">
          <p className="text-2xl font-extrabold text-light tracking-tight">
            {formatCurrency(totalIncome, currencySymbol)}
          </p>
        </div>
        <span className="text-[11px] text-gray">Filtrado actual</span>
      </div>

      {/* Gastos */}
      <div className="card-glass p-5 flex flex-col justify-between group hover:border-danger/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray group-hover:text-danger transition-colors">
            Gastos Totales
          </span>
          <div className="w-8 h-8 rounded-lg bg-danger/15 text-danger flex items-center justify-center">
            <ArrowDown className="w-4 h-4 icon-arrow-down" />
          </div>
        </div>
        <div className="my-3">
          <p className="text-2xl font-extrabold text-light tracking-tight">
            {formatCurrency(totalExpenses, currencySymbol)}
          </p>
        </div>
        <span className="text-[11px] text-gray">Filtrado actual</span>
      </div>

      {/* Balance */}
      <div className="card-glass p-5 flex flex-col justify-between group hover:border-secondary/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray group-hover:text-secondary transition-colors">
            Balance Neto
          </span>
          <div className="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
        </div>
        <div className="my-3">
          <p className={`text-2xl font-extrabold tracking-tight ${netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(netBalance, currencySymbol)}
          </p>
        </div>
        <span className="text-[11px] text-gray">Ingresos - Gastos</span>
      </div>
    </div>
  );
}
