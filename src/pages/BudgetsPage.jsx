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
  let withinLimitCount = 0;

  budgets.forEach((b) => {
    totalBudgeted += Number(b.amount) || 0;
    const { spent, status } = calculateBudgetStatus(b, categories);
    totalSpent += spent;
    if (status !== 'danger') withinLimitCount += 1;
  });

  const totalRemaining = totalBudgeted - totalSpent;
  const complianceRate = budgets.length > 0 ? ((withinLimitCount / budgets.length) * 100).toFixed(0) : '0';

  const handleSaveBudget = (budgetData) => {
    if (editingBudget) {
      updateBudget(editingBudget.id, budgetData, user?.uid, isGuest);
    } else {
      addBudget(budgetData, user?.uid, isGuest);
    }
    setEditingBudget(null);
  };

  return (
    <div className="budgets-page">
      <div className="app-container">
        <Sidebar />

        <div className="main-content">
          <Header
            title="Presupuestos"
            onOpenDrawer={() => setIsDrawerOpen(true)}
            actions={
              <button
                type="button"
                className="btn btn-primary"
                id="addBudgetBtn"
                onClick={() => {
                  setEditingBudget(null);
                  setIsModalOpen(true);
                }}
              >
                <i className="fas fa-plus"></i> Crear Presupuesto
              </button>
            }
          />

          {/* Budget KPI Cards */}
          <div className="summary-cards budget-summary">
            <div className="summary-card income">
              <div className="card-title">
                <i className="fas fa-dollar-sign"></i> Total Presupuestado
              </div>
              <div className="card-value large-number">
                {formatCurrency(totalBudgeted, currencySymbol)}
              </div>
              <div className="card-change">{budgets.length} presupuestos activos</div>
            </div>

            <div className="summary-card expenses">
              <div className="card-title">
                <i className="fas fa-shopping-cart"></i> Total Gastado
              </div>
              <div className="card-value large-number">
                {formatCurrency(totalSpent, currencySymbol)}
              </div>
              <div className="card-change">Suma de gastos realizados</div>
            </div>

            <div className="summary-card balance">
              <div className="card-title">
                <i className="fas fa-piggy-bank"></i> Disponible
              </div>
              <div className="card-value large-number">
                {formatCurrency(totalRemaining, currencySymbol)}
              </div>
              <div className="card-change">Presupuesto restante</div>
            </div>

            <div className="summary-card misc">
              <div className="card-title">
                <i className="fas fa-percentage"></i> Cumplimiento
              </div>
              <div className="card-value large-number">{complianceRate}%</div>
              <div className="card-change">Presupuestos dentro del límite</div>
            </div>
          </div>

          {/* Budgets Container Card */}
          <div className="budget-list-card card">
            <div className="card-header">
              <h2 className="card-title">Mis Presupuestos</h2>
            </div>
            <div className="card-body">
              <div className="categories-grid" id="budgetsContainer">
                {budgets.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-file-invoice-dollar" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
                    <p>No hay presupuestos creados</p>
                  </div>
                ) : (
                  budgets.map((budget) => (
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
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
