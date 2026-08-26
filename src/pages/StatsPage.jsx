import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import MobileDrawer from '../components/layout/MobileDrawer';
import InsightCards from '../components/stats/InsightCards';
import CashflowChart from '../components/stats/CashflowChart';
import CategoryCharts from '../components/stats/CategoryCharts';
import HeatmapChart from '../components/stats/HeatmapChart';
import { 
  calculateCashflow, 
  calculateCategoryBreakdown, 
  calculateHeatmap, 
  calculateDailyStats 
} from '../services/dataCalculations';

export default function StatsPage() {
  const { user, isGuest } = useAuthStore();
  const { categories, settings, filters, loadUserData } = useFinanceStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadUserData(user.uid, isGuest);
    }
  }, [user, isGuest, loadUserData]);

  const currencySymbol = settings.currencySymbol || '$';

  // Calculate stats
  const cashflowData = calculateCashflow(categories);
  const breakdown = calculateCategoryBreakdown(categories, filters);
  const heatmapData = calculateHeatmap(categories, filters);
  const dailyStats = calculateDailyStats(categories);

  const topExpense = breakdown.expenses[0] || null;

  return (
    <div className="min-h-screen bg-dark text-light flex">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <Header
          title="Estadísticas y Análisis"
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />

        {/* Insight KPI Cards */}
        <InsightCards
          incomeToday={dailyStats.incomeToday}
          expensesToday={dailyStats.expensesToday}
          dailyAverage={dailyStats.dailyAverage}
          topExpenseCategory={topExpense}
          currencySymbol={currencySymbol}
        />

        {/* Cashflow Line Chart */}
        <CashflowChart data={cashflowData} currencySymbol={currencySymbol} />

        {/* Category Breakdown Charts */}
        <CategoryCharts breakdown={breakdown} currencySymbol={currencySymbol} />

        {/* Daily Heatmap Activity */}
        <HeatmapChart heatmapData={heatmapData} currencySymbol={currencySymbol} />
      </main>

      <MobileNav />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
