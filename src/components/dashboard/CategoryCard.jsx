import React, { useState } from 'react';
import DatePickerModal from '../common/DatePickerModal';
import { formatCurrency, parseTransactionDate } from '../../services/dataCalculations';

const PAGE_SIZE = 5;

export default function CategoryCard({
  category,
  currencySymbol = '$',
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onEditCategory,
  onDeleteCategory,
  onClearTransactions,
  onTogglePin,
  filterYear,
  filterMonth,
  filterSearch
}) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState(
    category.fixedType === 'income' ? 'income' : category.fixedType === 'expense' ? 'expense' : 'expense'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Filter transactions for this card
  const filteredTransactions = (category.transactions || []).filter((tx) => {
    const d = parseTransactionDate(tx.date);
    if (Number.isNaN(d.getTime())) return false;
    if (filterYear !== null && filterYear !== undefined && filterYear !== '' && d.getFullYear() !== Number(filterYear)) return false;
    if (filterMonth !== null && filterMonth !== undefined && filterMonth !== '' && d.getMonth() !== Number(filterMonth)) return false;
    if (filterSearch) {
      const searchLower = filterSearch.toLowerCase().trim();
      const txDesc = (tx.desc || tx.description || '').toLowerCase();
      const amtStr = String(tx.amount);
      if (!txDesc.includes(searchLower) && !amtStr.includes(searchLower)) return false;
    }
    return true;
  }).sort((a, b) => parseTransactionDate(b.date).getTime() - parseTransactionDate(a.date).getTime());

  // Category totals
  let catIncome = 0;
  let catExpenses = 0;
  filteredTransactions.forEach((tx) => {
    if (tx.type === 'income') catIncome += tx.amount;
    else catExpenses += tx.amount;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const paginatedTxs = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const actualType = category.fixedType === 'income' ? 'income' : category.fixedType === 'expense' ? 'expense' : type;
    onAddTransaction(category.id, {
      amount: Number(amount),
      desc: desc.trim() || 'Sin descripción',
      date,
      type: actualType
    });

    setAmount('');
    setDesc('');
  };

  return (
    <div className={`category-card fade-in ${category.isPinned ? 'pinned' : ''}`}>
      {/* Category Header */}
      <div className="category-header">
        <button
          className="category-drag-handle btn-icon"
          type="button"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar para reordenar"
          disabled={category.isPinned}
        >
          <i className="fas fa-grip-lines" aria-hidden="true"></i>
        </button>

        <div className="category-name" title={category.name}>
          {category.name}
        </div>

        <div className="category-menu-wrapper">
          <button
            className="category-menu-btn btn-icon"
            type="button"
            title="Opciones"
            aria-label="Opciones de categoría"
            onClick={() => setShowMenu(!showMenu)}
          >
            <i className="fas fa-ellipsis-v" aria-hidden="true"></i>
          </button>

          {showMenu && (
            <div className="category-menu active" id={`category-menu-${category.id}`}>
              <button
                className={`category-menu-item ${category.isPinned ? 'pin-on' : ''}`}
                type="button"
                onClick={() => { setShowMenu(false); onTogglePin(category.id); }}
              >
                <i className="fas fa-thumbtack"></i>
                {category.isPinned ? 'Desfijar' : 'Fijar categoría'}
              </button>
              <button
                className="category-menu-item"
                type="button"
                onClick={() => { setShowMenu(false); onEditCategory(category); }}
              >
                <i className="fas fa-edit"></i>
                Renombrar
              </button>
              <button
                className="category-menu-item"
                type="button"
                onClick={() => { setShowMenu(false); onClearTransactions(category.id); }}
              >
                <i className="fas fa-eraser"></i>
                Limpiar transacciones
              </button>
              <button
                className="category-menu-item danger"
                type="button"
                onClick={() => { setShowMenu(false); onDeleteCategory(category.id); }}
              >
                <i className="fas fa-trash"></i>
                Eliminar categoría
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Stats */}
      <div className="category-stats alt">
        <div className="ie-summary">
          {category.fixedType === 'income' ? (
            <div className="amount-chip income" title={`Ingresos: ${formatCurrency(catIncome, currencySymbol)}`}>
              <i className="fas fa-arrow-up" aria-hidden="true"></i>
              <span>{formatCurrency(catIncome, currencySymbol)}</span>
            </div>
          ) : category.fixedType === 'expense' ? (
            <div className="amount-chip expense" title={`Gastos: ${formatCurrency(catExpenses, currencySymbol)}`}>
              <i className="fas fa-arrow-down" aria-hidden="true"></i>
              <span>{formatCurrency(catExpenses, currencySymbol)}</span>
            </div>
          ) : (
            <>
              <div className="amount-chip income" title={`Ingresos: ${formatCurrency(catIncome, currencySymbol)}`}>
                <i className="fas fa-arrow-up" aria-hidden="true"></i>
                <span>{formatCurrency(catIncome, currencySymbol)}</span>
              </div>
              <div className="amount-chip expense" title={`Gastos: ${formatCurrency(catExpenses, currencySymbol)}`}>
                <i className="fas fa-arrow-down" aria-hidden="true"></i>
                <span>{formatCurrency(catExpenses, currencySymbol)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Details */}
      <div className="category-details">
        <form className="transaction-form" onSubmit={handleQuickAdd}>
          {category.fixedType === 'free' && (
            <div className="category-type-selector" style={{ marginBottom: '8px' }}>
              <button
                type="button"
                className={`type-btn ${type === 'income' ? 'active income' : ''}`}
                onClick={() => setType('income')}
              >
                <i className="fas fa-arrow-up"></i> Ingreso
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
                onClick={() => setType('expense')}
              >
                <i className="fas fa-arrow-down"></i> Gasto
              </button>
            </div>
          )}

          <div className="form-group">
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              className="form-control"
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-control"
              placeholder="Descripción (opcional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <div className="form-group">
            <div className="date-picker-wrapper">
              <input
                type="text"
                className="form-control date-picker-input"
                value={date}
                readOnly
                placeholder="Seleccionar fecha"
                onClick={() => setIsDatePickerOpen(true)}
              />
              <button
                type="button"
                className="date-picker-btn"
                onClick={() => setIsDatePickerOpen(true)}
              >
                <i className="fas fa-calendar-alt"></i>
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: '100%' }}
          >
            Agregar Transacción
          </button>
        </form>

        {/* Transaction List */}
        <div className={`transaction-list ${paginatedTxs.length === 0 ? 'is-empty' : ''}`}>
          {filteredTransactions.length > 0 ? (
            <>
              <div className="transaction-list-header">
                <span className="transaction-count">
                  {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transacción' : 'transacciones'}
                  {totalPages > 1 ? ` · Pág. ${currentPage}/${totalPages}` : ''}
                </span>
              </div>

              {paginatedTxs.map((t) => (
                <div className="transaction-item" key={t.id}>
                  <div className="transaction-item-header">
                    <div
                      className={`transaction-amount ${t.type}`}
                      title={`${t.type === 'income' ? 'Ingreso: ' : 'Gasto: '}${formatCurrency(t.amount, currencySymbol)}`}
                    >
                      {formatCurrency(t.amount, currencySymbol)}
                    </div>
                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onEditTransaction(category.id, t)}
                        title="Editar"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onDeleteTransaction(category.id, t.id)}
                        title="Eliminar"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div className="transaction-desc" title={t.desc || t.description || 'Sin descripción'}>
                    {t.desc || t.description || 'Sin descripción'}
                  </div>
                  <div className="transaction-date">{t.date}</div>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="tx-pagination">
                  <button
                    type="button"
                    className="btn-icon tx-page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="tx-page-info">{currentPage} / {totalPages}</span>
                  <button
                    type="button"
                    className="btn-icon tx-page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>Sin transacciones registradas</p>
            </div>
          )}
        </div>
      </div>

      {/* DatePicker Modal */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={date}
        onSelectDate={(newDate) => setDate(newDate)}
      />
    </div>
  );
}
