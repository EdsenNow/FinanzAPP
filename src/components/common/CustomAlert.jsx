import React from 'react';
import Modal from './Modal';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export default function CustomAlert({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Advertencia', 
  message = '', 
  type = 'warning',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = false 
}) {
  const getIcon = () => {
    switch (type) {
      case 'danger':
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      default:
        return <Info className="w-5 h-5 text-secondary" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={<>{getIcon()} {title}</>} maxWidth="max-w-sm">
      <p className="text-sm text-gray mb-6 leading-relaxed">
        {message}
      </p>

      <div className="flex items-center justify-end gap-3">
        {showCancel && (
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary-custom text-sm"
          >
            {cancelText}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (onConfirm) onConfirm();
            onClose();
          }}
          className={`${type === 'danger' ? 'bg-danger text-white hover:bg-danger/90' : 'btn-neon-primary'} text-sm`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
