import React, { useState, useEffect } from 'react';

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

  if (!isOpen) return null;

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
    <div
      className="modal show"
      id="budgetModal"
      role="dialog"
      aria-modal="true"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target.classList.contains('modal')) onClose();
      }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <i className={`fas ${isEditing ? 'fa-edit' : 'fa-wallet'}`}></i>
            {' '}{isEditing ? 'Editar Presupuesto' : 'Crear Presupuesto'}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Name */}
            <div className="form-group">
              <label htmlFor="budgetName">Nombre del Presupuesto</label>
              <input
                type="text"
                id="budgetName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Límite Alimentación Mensual"
                className="form-control"
              />
            </div>

            {/* Amount */}
            <div className="form-group">
              <label htmlFor="budgetAmount">Monto Límite</label>
              <input
                type="number"
                id="budgetAmount"
                step="0.01"
                required
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="form-control"
              />
            </div>

            {/* Category */}
            <div className="form-group">
              <label htmlFor="budgetCategory">Categoría Asociada</label>
              <select
                id="budgetCategory"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="form-control"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="form-group">
              <label htmlFor="budgetPeriod">Frecuencia</label>
              <select
                id="budgetPeriod"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="form-control"
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label>Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Fin</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Guardar Cambios' : 'Crear Presupuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
