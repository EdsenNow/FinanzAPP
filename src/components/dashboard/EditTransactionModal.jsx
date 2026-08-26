import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import DatePickerModal from '../common/DatePickerModal';
import { Edit2, ArrowUp, ArrowDown, Calendar } from 'lucide-react';

export default function EditTransactionModal({ 
  isOpen, 
  onClose, 
  onSave, 
  transaction = null, 
  categories = [], 
  currentCategoryId = null 
}) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount || ''));
      setDesc(transaction.desc || transaction.description || '');
      setDate(transaction.date || new Date().toISOString().slice(0, 10));
      setType(transaction.type || 'expense');
      setCategoryId(currentCategoryId || categories[0]?.id || '');
    }
  }, [transaction, currentCategoryId, categories, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    onSave({
      amount: Number(amount),
      desc: desc.trim(),
      date,
      type,
      newCategoryId: categoryId
    });
    onClose();
  };

  if (!transaction) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={<><Edit2 className="w-5 h-5 text-accent" /> Editar Transacción</>}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  type === 'expense'
                    ? 'border-danger bg-danger/15 text-danger'
                    : 'border-white/5 bg-white/5 text-gray hover:text-light'
                }`}
              >
                <ArrowDown className="w-4 h-4 icon-arrow-down" />
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  type === 'income'
                    ? 'border-success bg-success/15 text-success'
                    : 'border-white/5 bg-white/5 text-gray hover:text-light'
                }`}
              >
                <ArrowUp className="w-4 h-4 icon-arrow-up" />
                Ingreso
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descripción del movimiento..."
              className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
              Categoría
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Picker trigger */}
          <div>
            <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
              Fecha
            </label>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="w-full flex items-center justify-between bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light hover:border-primary transition-colors"
            >
              <span>{date}</span>
              <Calendar className="w-4 h-4 text-primary" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary-custom text-sm">
              Cancelar
            </button>
            <button type="submit" className="btn-neon-primary text-sm">
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>

      {/* Embedded Date Picker Modal */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={date}
        onSelectDate={(newDate) => setDate(newDate)}
      />
    </>
  );
}
