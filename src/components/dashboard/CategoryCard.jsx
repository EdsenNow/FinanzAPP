import React, { useState } from 'react';
import { 
  Pin, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Eraser, 
  Plus, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight,
  GripVertical
} from 'lucide-react';
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
    <div className="card-glass p-5 flex flex-col justify-between relative group transition-all">
      {/* Category Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 relative">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onTogglePin(category.id)}
            className={`p-1 rounded-lg transition-colors ${
              category.isPinned ? 'text-primary bg-primary/10' : 'text-gray hover:text-light'
            }`}
            title={category.isPinned ? 'Desanclar' : 'Anclar'}
          >
            <Pin className={`w-4 h-4 ${category.isPinned ? 'fill-primary' : ''}`} />
          </button>
          <h3 className="font-bold text-sm text-light truncate" title={category.name}>
            {category.name}
          </h3>
          {category.fixedType !== 'free' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              category.fixedType === 'income' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            }`}>
              {category.fixedType === 'income' ? 'Ingreso' : 'Gasto'}
            </span>
          )}
        </div>

        {/* Header Totals & Options Menu */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xs font-bold text-light">
              {category.fixedType === 'income' 
                ? formatCurrency(catIncome, currencySymbol)
                : formatCurrency(catExpenses || catIncome, currencySymbol)}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-gray hover:text-light hover:bg-white/5 transition-colors"
              aria-label="Opciones de categoría"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#1f1d2e] border border-white/10 rounded-xl shadow-2xl py-1.5 z-20 text-xs">
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onEditCategory(category); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-light hover:bg-white/5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-accent" />
                    <span>Editar categoría</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onClearTransactions(category.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-warning hover:bg-white/5 transition-colors"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Vaciar movimientos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onDeleteCategory(category.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar categoría</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleQuickAdd} className="my-4 space-y-2.5">
        <div className="flex gap-2">
          {category.fixedType === 'free' && (
            <button
              type="button"
              onClick={() => setType(type === 'expense' ? 'income' : 'expense')}
              className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                type === 'income' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}
              title="Cambiar tipo (Ingreso/Gasto)"
            >
              {type === 'income' ? <ArrowUp className="w-3.5 h-3.5 icon-arrow-up" /> : <ArrowDown className="w-3.5 h-3.5 icon-arrow-down" />}
              <span>{type === 'income' ? '+' : '-'}</span>
            </button>
          )}

          <input
            type="number"
            step="0.01"
            required
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Monto..."
            className="flex-1 min-w-[80px] bg-input-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-light placeholder-gray/50 focus:outline-none focus:border-primary"
          />

          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            className="p-2 rounded-xl bg-input-bg border border-white/10 text-gray hover:text-light shrink-0"
            title="Cambiar fecha"
          >
            <Calendar className="w-4 h-4 text-primary" />
          </button>

          <button
            type="submit"
            className="w-8 h-8 rounded-xl bg-primary text-dark flex items-center justify-center font-bold shadow-neon-primary hover:scale-105 active:scale-95 transition-transform shrink-0"
            aria-label="Agregar transacción"
          >
            <Plus className="w-4 h-4 icon-plus" />
          </button>
        </div>

        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descripción (opcional)..."
          className="w-full bg-input-bg border border-white/10 rounded-xl px-3 py-1.5 text-xs text-light placeholder-gray/50 focus:outline-none focus:border-primary"
        />
      </form>

      {/* Transactions List */}
      <div className="flex-1 min-h-[140px] flex flex-col justify-between">
        {paginatedTxs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-gray text-xs">
            <span>Sin movimientos registrados</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {paginatedTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group/item text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-light font-medium truncate">{tx.desc || tx.description || 'Sin descripción'}</p>
                  <span className="text-[10px] text-gray">{tx.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-bold ${tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currencySymbol)}
                  </span>

                  <div className="hidden group-hover/item:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditTransaction(category.id, tx)}
                      className="p-1 text-gray hover:text-accent"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(category.id, tx.id)}
                      className="p-1 text-gray hover:text-danger"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 icon-trash" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5 text-xs text-gray">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:text-light"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:text-light"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
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
