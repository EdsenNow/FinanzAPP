import React from 'react';
import { formatCurrency } from '../../services/dataCalculations';

export default function SummaryCards({ totalIncome = 0, totalExpenses = 0, netBalance = 0, currencySymbol = '$' }) {
  return (
    <div className="summary-cards">
      <div className="summary-card income">
        <div className="card-title">
          <i className="fas fa-arrow-up"></i> Ingresos Totales
        </div>
        <div className="card-value large-number">
          {formatCurrency(totalIncome, currencySymbol)}
        </div>
        <div className="card-change">Filtrado actual</div>
      </div>

      <div className="summary-card expenses">
        <div className="card-title">
          <i className="fas fa-arrow-down"></i> Gastos Totales
        </div>
        <div className="card-value large-number">
          {formatCurrency(totalExpenses, currencySymbol)}
        </div>
        <div className="card-change">Filtrado actual</div>
      </div>

      <div className="summary-card balance">
        <div className="card-title">
          <i className="fas fa-balance-scale"></i> Balance Mensual
        </div>
        <div className="card-value large-number">
          {formatCurrency(netBalance, currencySymbol)}
        </div>
        <div className="card-change">Ingresos - Gastos</div>
      </div>
    </div>
  );
}
