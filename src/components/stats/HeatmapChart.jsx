import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useThemeStore } from '../../stores/useThemeStore';
import { formatCurrency } from '../../services/dataCalculations';

export default function HeatmapChart({ heatmapData, currencySymbol = '$' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const days = Array.from({ length: 31 }, (_, i) => `Día ${i + 1}`);

  const chartData = {
    labels: days,
    datasets: [
      {
        label: 'Gastos',
        data: heatmapData.expensesByDay,
        backgroundColor: 'rgba(235, 111, 146, 0.75)',
        borderRadius: 4
      },
      {
        label: 'Ingresos',
        data: heatmapData.incomeByDay,
        backgroundColor: 'rgba(45, 149, 123, 0.75)',
        borderRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
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
          label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw, currencySymbol)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#908caa' : '#9893a5', font: { size: 9 }, maxRotation: 45 }
      },
      y: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDark ? '#908caa' : '#9893a5', font: { size: 10 } }
      }
    }
  };

  return (
    <div className="card-glass p-5 mb-8">
      <h3 className="font-bold text-sm text-light mb-4">Actividad Financiera por Día del Mes</h3>
      <div className="h-64 w-full">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
