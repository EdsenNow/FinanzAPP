import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import SummaryCards from '../components/dashboard/SummaryCards';
import CategoryCard from '../components/dashboard/CategoryCard';
import CategoryModal from '../components/dashboard/CategoryModal';
import EditTransactionModal from '../components/dashboard/EditTransactionModal';
import GmailNotifPanel from '../components/dashboard/GmailNotifPanel';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import MobileDrawer from '../components/layout/MobileDrawer';
import Toast from '../components/common/Toast';
import CustomAlert from '../components/common/CustomAlert';
import { Plus, Download, Bell } from 'lucide-react';
import { calculateSummary } from '../services/dataCalculations';
import { exportToJSON, exportToPDF } from '../services/exportService';

export default function DashboardPage() {
  const { user, isGuest } = useAuthStore();
  const {
    categories,
    budgets,
    settings,
    filters,
    loadUserData,
    addCategory,
    updateCategory,
    deleteCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    undoDeleteTransaction,
    clearCategoryTransactions,
    importData
  } = useFinanceStore();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [isGmailPanelOpen, setIsGmailPanelOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState(null);
  const [gmailNotifs, setGmailNotifs] = useState([]);

  useEffect(() => {
    if (user?.uid) {
      loadUserData(user.uid, isGuest);
    }
  }, [user, isGuest, loadUserData]);

  const summary = calculateSummary(categories, filters);
  const currencySymbol = settings.currencySymbol || '$';

  // Handle Add / Edit Category
  const handleSaveCategory = (catData) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, catData, user?.uid, isGuest);
    } else {
      addCategory(catData, user?.uid, isGuest);
    }
    setEditingCategory(null);
  };

  // Handle Add Transaction
  const handleAddTransaction = (catId, txData) => {
    addTransaction(catId, txData, user?.uid, isGuest);
  };

  // Handle Edit Transaction
  const handleSaveEditedTransaction = (data) => {
    if (!editingTx) return;
    const { categoryId, transaction } = editingTx;
    if (data.newCategoryId && data.newCategoryId !== categoryId) {
      deleteTransaction(categoryId, transaction.id, user?.uid, isGuest);
      addTransaction(data.newCategoryId, data, user?.uid, isGuest);
    } else {
      updateTransaction(categoryId, transaction.id, data, user?.uid, isGuest);
    }
    setEditingTx(null);
  };

  // Handle Delete Transaction with Undo
  const handleDeleteTransaction = (catId, txId) => {
    deleteTransaction(catId, txId, user?.uid, isGuest);
    setToastMessage('Transacción eliminada');
  };

  // Toggle Pin
  const handleTogglePin = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      updateCategory(catId, { isPinned: !cat.isPinned }, user?.uid, isGuest);
    }
  };

  // Sort categories: pinned first
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <div className="min-h-screen bg-dark text-light flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        {/* Header & Filter Bar */}
        <Header
          title="Dashboard"
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenNotifs={() => setIsGmailPanelOpen(true)}
          pendingNotifsCount={gmailNotifs.length}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportToPDF(categories, settings)}
                className="btn-secondary-custom text-xs px-3 py-2"
                title="Descargar Reporte PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                className="btn-neon-primary text-xs px-3.5 py-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Categoría</span>
              </button>
            </div>
          }
        />

        {/* Financial KPI Summary Cards */}
        <SummaryCards
          totalIncome={summary.totalIncome}
          totalExpenses={summary.totalExpenses}
          netBalance={summary.netBalance}
          currencySymbol={currencySymbol}
        />

        {/* Categories Grid */}
        {sortedCategories.length === 0 ? (
          <div className="card-glass p-12 text-center text-gray space-y-3">
            <p className="text-sm font-medium">Aún no tienes categorías creadas.</p>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="btn-neon-primary text-xs px-4 py-2"
            >
              Crear mi primera categoría
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                currencySymbol={currencySymbol}
                filterYear={filters.year}
                filterMonth={filters.month}
                filterSearch={filters.search}
                onAddTransaction={handleAddTransaction}
                onEditTransaction={(catId, tx) => setEditingTx({ categoryId: catId, transaction: tx })}
                onDeleteTransaction={handleDeleteTransaction}
                onEditCategory={(cat) => {
                  setEditingCategory(cat);
                  setIsCategoryModalOpen(true);
                }}
                onDeleteCategory={(catId) => setConfirmDeleteCatId(catId)}
                onClearTransactions={(catId) => clearCategoryTransactions(catId, user?.uid, isGuest)}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <MobileNav onOpenCreateModal={() => setIsCategoryModalOpen(true)} />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenNotifications={() => setIsGmailPanelOpen(true)}
        onExport={() => exportToJSON(categories, budgets, settings)}
        onImport={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const data = JSON.parse(event.target.result);
                  importData(data, user?.uid, isGuest);
                } catch (_) {}
              };
              reader.readAsText(file);
            }
          };
          input.click();
        }}
      />

      {/* Category Create/Edit Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSaveCategory}
        category={editingCategory}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        transaction={editingTx?.transaction}
        currentCategoryId={editingTx?.categoryId}
        categories={categories}
        onSave={handleSaveEditedTransaction}
      />

      {/* Gmail Notifications Panel */}
      <GmailNotifPanel
        isOpen={isGmailPanelOpen}
        onClose={() => setIsGmailPanelOpen(false)}
        notifications={gmailNotifs}
        categories={categories}
        currencySymbol={currencySymbol}
        onApprove={(notif, catId) => {
          handleAddTransaction(catId, {
            amount: notif.amount,
            desc: notif.merchant || notif.desc || notif.subject,
            date: notif.date || new Date().toISOString().slice(0, 10),
            type: notif.type || 'expense'
          });
          setGmailNotifs((prev) => prev.filter((n) => (n.id || n.messageId) !== (notif.id || notif.messageId)));
        }}
        onDiscard={(id) => setGmailNotifs((prev) => prev.filter((n) => (n.id || n.messageId) !== id))}
        onClearAll={() => setGmailNotifs([])}
      />

      {/* Delete Category Confirmation Dialog */}
      <CustomAlert
        isOpen={Boolean(confirmDeleteCatId)}
        onClose={() => setConfirmDeleteCatId(null)}
        type="danger"
        title="¿Eliminar categoría?"
        message="Esta acción eliminará permanentemente la categoría y todos los movimientos asociados a ella."
        confirmText="Eliminar"
        showCancel={true}
        onConfirm={() => {
          if (confirmDeleteCatId) {
            deleteCategory(confirmDeleteCatId, user?.uid, isGuest);
            setConfirmDeleteCatId(null);
          }
        }}
      />

      {/* Undo Delete Toast */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
        onUndo={() => undoDeleteTransaction(user?.uid, isGuest)}
      />
    </div>
  );
}
