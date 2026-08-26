import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import BudgetCard from '../components/budgets/BudgetCard';
import BudgetModal from '../components/budgets/BudgetModal';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import MobileDrawer from '../components/layout/MobileDrawer';
import CustomAlert from '../components/common/CustomAlert';
import { Plus, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, calculateBudgetStatus } from '../services/dataCalculations';

export default function BudgetsPage() {
  const { user, isGuest } = useAuthStore();
  const {
    categories,
    budgets,
    settings,
    filters,
    loadUserData,
    addBudget,
    updateBudget,
    deleteBudget
  } = useFinanceStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadUserData(user.uid, isGuest);
    }
  }, [user, isGuest, loadUserData]);

  const currencySymbol = settings.currencySymbol || '$';

  // Calculate Overall Budget Totals
  let totalBudgeted = 0;
  let totalSpent = 0;

  budgets.forEach((b) => {
    totalBudgeted += Number(b.amount) || 0;
    const { spent } = calculateBudgetStatus(b, categories);
    totalSpent += spent;
  });

  const totalRemaining = totalBudgeted - totalSpent;
  const overallPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const handleSaveBudget = (budgetData) => {
    if (editingBudget) {
      updateBudget(editingBudget.id, budgetData, user?.uid, isGuest);
    } else {
      addBudget(budgetData, user?.uid, isGuest);
    }
    setEditingBudget(null);
  };

  return (
    <div className="min-h-screen bg-dark text-light flex">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <Header
          title="Presupuestos"
          onOpenDrawer={() => setIsDrawerOpen(true)}
          actions={
            <button
              type="button"
              onClick={() => {
                setEditingBudget(null);
                setIsModalOpen(true);
              }}
              className="btn-neon-primary text-xs px-3.5 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Presupuesto</span>
            </button>
          }
        />

        {/* Budget KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 select-none">
          <div className="card-glass p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-gray">Total Presupuestado</span>
            <p className="text-2xl font-extrabold text-light my-2">
              {formatCurrency(totalBudgeted, currencySymbol)}
            </p>
            <span className="text-[11px] text-gray">{budgets.length} presupuestos activos</span>
          </div>

          <div className="card-glass p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-gray">Total Gastado</span>
            <p className="text-2xl font-extrabold text-danger my-2">
              {formatCurrency(totalSpent, currencySymbol)}
            </p>
            <span className="text-[11px] text-gray">{overallPercent.toFixed(1)}% del límite total</span>
          </div>

          <div className="card-glass p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-gray">Monto Disponible</span>
            <p className={`text-2xl font-extrabold my-2 ${totalRemaining >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(totalRemaining, currencySymbol)}
            </p>
            <span className="text-[11px] text-gray">Margen restante general</span>
          </div>
        </div>

        {/* Budgets Grid */}
        {budgets.length === 0 ? (
          <div className="card-glass p-12 text-center text-gray space-y-3">
            <Wallet className="w-10 h-10 mx-auto opacity-30 text-primary" />
            <p className="text-sm font-medium">No has definido límites de presupuesto todavía.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-neon-primary text-xs px-4 py-2"
            >
              Crear Presupuesto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                categories={categories}
                currencySymbol={currencySymbol}
                onEdit={(b) => {
                  setEditingBudget(b);
                  setIsModalOpen(true);
                }}
                onDelete={(id) => setConfirmDeleteId(id)}
              />
            ))}
          </div>
        )}
      </main>

      <MobileNav onOpenCreateModal={() => setIsModalOpen(true)} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Create/Edit Budget Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBudget(null);
        }}
        onSave={handleSaveBudget}
        budget={editingBudget}
        categories={categories}
      />

      {/* Delete Confirmation */}
      <CustomAlert
        isOpen={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        type="danger"
        title="¿Eliminar presupuesto?"
        message="¿Estás seguro de que deseas eliminar este presupuesto? Tus transacciones registradas no se verán afectadas."
        confirmText="Eliminar"
        showCancel={true}
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteBudget(confirmDeleteId, user?.uid, isGuest);
            setConfirmDeleteId(null);
          }
        }}
      />
    </div>
  );
}
