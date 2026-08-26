import React, { useState, useEffect } from 'react';
import DatePickerModal from '../common/DatePickerModal';

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

  if (!isOpen || !transaction) return null;

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

  return (
    <>
      <div
        className="modal show"
        id="editModal"
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
              <i className="fas fa-edit"></i> Editar Transacción
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Tipo de Movimiento</label>
                <div className="category-type-selector">
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
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Monto</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  className="form-control"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <input
                  type="text"
                  className="form-control"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Descripción del movimiento..."
                />
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <div className="date-picker-wrapper">
                  <input
                    type="text"
                    className="form-control date-picker-input"
                    value={date}
                    readOnly
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
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={date}
        onSelectDate={(newDate) => setDate(newDate)}
      />
    </>
  );
}
