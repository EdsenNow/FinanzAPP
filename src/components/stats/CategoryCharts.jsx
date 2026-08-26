import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCurrency } from '../../services/dataCalculations';

ChartJS.register(ArcElement, BarElement, Tooltip, Legend);

const PALETTE = [
  '#eb6f92', '#31748f', '#f6c177', '#c4a7e7', '#ebbcba',
  '#9ccfd8', '#2D957B', '#ea9d34', '#b4637a', '#907aa9'
];

export default function CategoryCharts({ breakdown, currencySymbol = '$' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const expenses = breakdown.expenses || [];
  const income = breakdown.income || [];

  const doughnutData = {
    labels: expenses.map((e) => e.name),
    datasets: [
      {
        data: expenses.map((e) => e.amount),
        backgroundColor: PALETTE.slice(0, expenses.length),
        borderColor: isDark ? '#1f1d2e' : '#fffaf3',
        borderWidth: 2
      }
    ]
  };

  const barData = {
    labels: income.map((i) => i.name),
    datasets: [
      {
        label: 'Ingresos',
        data: income.map((i) => i.amount),
        backgroundColor: '#2D957B',
        borderRadius: 8
      }
    ]
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#e0def4' : '#575279',
          font: { family: 'Inter', size: 11 },
          boxWidth: 10,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#1f1d2e' : '#fffaf3',
        titleColor: isDark ? '#e0def4' : '#575279',
        bodyColor: isDark ? '#e0def4' : '#575279',
        borderColor: '#eb6f92',
        borderWidth: 1,
        callbacks: {
          label: (context) => ` ${context.label}: ${formatCurrency(context.parsed || context.raw, currencySymbol)}`
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Gastos por Categoría */}
      <div className="card-glass p-5">
        <h3 className="font-bold text-sm text-light mb-4">Distribución de Gastos</h3>
        <div className="h-64 flex items-center justify-center">
          {expenses.length === 0 ? (
            <span className="text-xs text-gray">Sin gastos registrados</span>
          ) : (
            <Doughnut data={doughnutData} options={commonOptions} />
          )}
        </div>
      </div>

      {/* Ingresos por Categoría */}
      <div className="card-glass p-5">
        <h3 className="font-bold text-sm text-light mb-4">Fuentes de Ingreso</h3>
        <div className="h-64 flex items-center justify-center">
          {income.length === 0 ? (
            <span className="text-xs text-gray">Sin ingresos registrados</span>
          ) : (
            <Bar
              data={barData}
              options={{
                ...commonOptions,
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { color: isDark ? '#908caa' : '#9893a5', font: { size: 10 } }
                  },
                  y: {
                    grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: isDark ? '#908caa' : '#9893a5', font: { size: 10 } }
                  }
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
