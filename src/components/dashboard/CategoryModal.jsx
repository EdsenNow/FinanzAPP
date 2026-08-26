import React, { useState, useEffect } from 'react';

export default function CategoryModal({ isOpen, onClose, onSave, category = null }) {
  const [name, setName] = useState('');
  const [fixedType, setFixedType] = useState('free'); // 'free' | 'income' | 'expense'

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setFixedType(category.fixedType || 'free');
    } else {
      setName('');
      setFixedType('free');
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), fixedType });
    onClose();
  };

  const isEditing = Boolean(category);

  return (
    <div
      className="modal show"
      id="categoryModal"
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
            <i className={`fas ${isEditing ? 'fa-edit' : 'fa-plus'}`}></i>
            {' '}{isEditing ? 'Editar Categoría' : 'Agregar Nueva Categoría'}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="categoryName">Nombre de la categoría</label>
              <input
                type="text"
                className="form-control"
                id="categoryName"
                placeholder="Ej: Comida, Transporte, etc."
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tipo de categoría</label>
              <div className="category-type-selector" id="categoryFixedType">
                <button
                  type="button"
                  className={`type-btn ${fixedType === 'free' ? 'active' : ''}`}
                  onClick={() => setFixedType('free')}
                >
                  <i className="fas fa-arrows-alt-h"></i> Libre
                </button>
                <button
                  type="button"
                  className={`type-btn ${fixedType === 'income' ? 'active income' : ''}`}
                  onClick={() => setFixedType('income')}
                >
                  <i className="fas fa-arrow-up"></i> Solo Ingresos
                </button>
                <button
                  type="button"
                  className={`type-btn ${fixedType === 'expense' ? 'active expense' : ''}`}
                  onClick={() => setFixedType('expense')}
                >
                  <i className="fas fa-arrow-down"></i> Solo Gastos
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Guardar Cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
