import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useThemeStore } from '../../stores/useThemeStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function CashflowChart({ data, currencySymbol = '$' }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Ingresos',
        data: data.income,
        borderColor: '#2D957B',
        backgroundColor: 'rgba(45, 149, 123, 0.15)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#2D957B',
        pointRadius: 3
      },
      {
        label: 'Gastos',
        data: data.expenses,
        borderColor: '#eb6f92',
        backgroundColor: 'rgba(235, 111, 146, 0.15)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#eb6f92',
        pointRadius: 3
      },
      {
        label: 'Balance Neto',
        data: data.balance,
        borderColor: '#31748f',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
        pointBackgroundColor: '#31748f',
        pointRadius: 2
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
          font: { family: 'Inter', size: 12, weight: '500' },
          boxWidth: 12,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#1f1d2e' : '#fffaf3',
        titleColor: isDark ? '#e0def4' : '#575279',
        bodyColor: isDark ? '#e0def4' : '#575279',
        borderColor: '#eb6f92',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${currencySymbol} ${context.parsed.y.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#908caa' : '#9893a5',
          font: { family: 'Inter', size: 11 }
        }
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: isDark ? '#908caa' : '#9893a5',
          font: { family: 'Inter', size: 11 },
          callback: (value) => `${currencySymbol}${value}`
        }
      }
    }
  };

  return (
    <div className="card-glass p-5 mb-8">
      <h3 className="font-bold text-sm text-light mb-4">Flujo de Dinero Anual</h3>
      <div className="h-72 w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
