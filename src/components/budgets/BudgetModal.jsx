import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Wallet, Edit2, Calendar } from 'lucide-react';

export default function BudgetModal({ isOpen, onClose, onSave, budget = null, categories = [] }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (budget) {
      setName(budget.name || '');
      setAmount(String(budget.amount || ''));
      setCategoryId(budget.categoryId || '');
      setPeriod(budget.period || 'monthly');
      setStartDate(budget.startDate || '');
      setEndDate(budget.endDate || '');
    } else {
      setName('');
      setAmount('');
      setCategoryId(categories[0]?.id || '');
      setPeriod('monthly');
      setStartDate('');
      setEndDate('');
    }
  }, [budget, categories, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount || Number(amount) <= 0) return;
    onSave({
      name: name.trim(),
      amount: Number(amount),
      categoryId,
      period,
      startDate: period === 'custom' ? startDate : null,
      endDate: period === 'custom' ? endDate : null
    });
    onClose();
  };

  const isEditing = Boolean(budget);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          {isEditing ? <Edit2 className="w-5 h-5 text-accent" /> : <Wallet className="w-5 h-5 text-primary" />}
          {isEditing ? 'Editar Presupuesto' : 'Crear Presupuesto'}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Nombre del Presupuesto
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Límite Alimentación Mensual"
            className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Monto Límite
          </label>
          <input
            type="number"
            step="0.01"
            required
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Categoría Asociada
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Frecuencia
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="yearly">Anual</option>
            <option value="custom">Rango Personalizado</option>
          </select>
        </div>

        {/* Custom Date Range if applicable */}
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray mb-1">Fecha Inicio</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-input-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-light"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray mb-1">Fecha Fin</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-input-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-light"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="btn-secondary-custom text-sm">
            Cancelar
          </button>
          <button type="submit" className="btn-neon-primary text-sm">
            {isEditing ? 'Guardar Cambios' : 'Crear Presupuesto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
