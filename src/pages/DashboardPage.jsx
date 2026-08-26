import React, { useState, useEffect, useRef } from 'react';
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
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [gmailNotifs, setGmailNotifs] = useState([]);
  const fileInputRef = useRef(null);

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

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          importData(data, user?.uid, isGuest);
          setToastMessage('Datos importados correctamente');
        } catch (_) {
          setToastMessage('Error al leer archivo JSON');
        }
      };
      reader.readAsText(file);
    }
  };

  // Sort categories: pinned first
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <div className="dashboard-page">
      <div className="app-container">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="main-content">
          {/* Header & Filter Controls */}
          <Header
            title="Dashboard"
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenNotifs={() => setIsGmailPanelOpen(true)}
            pendingNotifsCount={gmailNotifs.length}
          />

          {/* Summary Cards */}
          <SummaryCards
            totalIncome={summary.totalIncome}
            totalExpenses={summary.totalExpenses}
            netBalance={summary.netBalance}
            currencySymbol={currencySymbol}
          />

          <div id="filter-period-label" className="filter-period-label" aria-live="polite"></div>

          {/* Main Card Container */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Mis Categorías</h2>
              <div className="header-actions">
                <div className="export-dropdown" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    id="exportDropdownBtn"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <i className="fas fa-file-export"></i> Exportar <i className="fas fa-chevron-down"></i>
                  </button>
                  {showExportMenu && (
                    <div className="dropdown-menu show" style={{ display: 'block', position: 'absolute', top: '100%', right: 0, zIndex: 100 }}>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => { setShowExportMenu(false); exportToJSON(categories, budgets, settings); }}
                      >
                        <i className="fas fa-file-code"></i> JSON
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => { setShowExportMenu(false); exportToPDF(categories, settings); }}
                      >
                        <i className="fas fa-file-pdf"></i> PDF
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  id="importStateBtn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="fas fa-file-import"></i> Importar
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFile}
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  className="btn btn-secondary"
                  id="clearAllCategoriesBtn"
                  onClick={() => setConfirmDeleteAll(true)}
                >
                  <i className="fas fa-trash"></i> Eliminar categorías
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  id="addCategoryBtn"
                  onClick={() => {
                    setEditingCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus"></i> Nueva Categoría
                </button>
              </div>
            </div>

            {/* Categories Grid */}
            <div className="categories-grid" id="categoriesContainer">
              {sortedCategories.length === 0 ? (
                <div className="empty-state">
                  <p>No hay categorías creadas. Agrega tu primera categoría.</p>
                </div>
              ) : (
                sortedCategories.map((category) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav onOpenCreateModal={() => setIsCategoryModalOpen(true)} />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenNotifications={() => setIsGmailPanelOpen(true)}
        onExport={() => exportToJSON(categories, budgets, settings)}
        onImport={() => fileInputRef.current?.click()}
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

      {/* Delete All Categories Confirmation Dialog */}
      <CustomAlert
        isOpen={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        type="danger"
        title="¿Eliminar todas las categorías?"
        message="Esta acción eliminará todas tus categorías y movimientos de forma irreversible."
        confirmText="Eliminar Todo"
        showCancel={true}
        onConfirm={() => {
          categories.forEach((c) => deleteCategory(c.id, user?.uid, isGuest));
          setConfirmDeleteAll(false);
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
