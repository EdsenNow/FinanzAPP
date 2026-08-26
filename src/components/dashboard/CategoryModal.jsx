import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Plus, Edit2, Scale, ArrowUp, ArrowDown } from 'lucide-react';

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), fixedType });
    onClose();
  };

  const isEditing = Boolean(category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          {isEditing ? <Edit2 className="w-5 h-5 text-accent" /> : <Plus className="w-5 h-5 text-primary" />}
          {isEditing ? 'Editar Categoría' : 'Agregar Nueva Categoría'}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Nombre de la Categoría
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Alimentación, Transporte, Salario..."
            className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light placeholder-gray/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray uppercase tracking-wider mb-2">
            Tipo de Categoría
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFixedType('free')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                fixedType === 'free'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-neon-primary'
                  : 'border-white/5 bg-white/5 text-gray hover:text-light'
              }`}
            >
              <Scale className="w-4 h-4 mb-1.5" />
              <span>Libre</span>
            </button>

            <button
              type="button"
              onClick={() => setFixedType('income')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                fixedType === 'income'
                  ? 'border-success bg-success/10 text-success font-bold'
                  : 'border-white/5 bg-white/5 text-gray hover:text-light'
              }`}
            >
              <ArrowUp className="w-4 h-4 mb-1.5 icon-arrow-up" />
              <span>Ingreso</span>
            </button>

            <button
              type="button"
              onClick={() => setFixedType('expense')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                fixedType === 'expense'
                  ? 'border-danger bg-danger/10 text-danger font-bold'
                  : 'border-white/5 bg-white/5 text-gray hover:text-light'
              }`}
            >
              <ArrowDown className="w-4 h-4 mb-1.5 icon-arrow-down" />
              <span>Gasto</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="btn-secondary-custom text-sm">
            Cancelar
          </button>
          <button type="submit" className="btn-neon-primary text-sm">
            {isEditing ? 'Guardar Cambios' : 'Crear Categoría'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
