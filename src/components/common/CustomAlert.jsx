import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div
      className="modal show"
      id="customAlertModal"
      role="dialog"
      aria-modal="true"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target.classList.contains('modal')) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <i className={`fas ${type === 'danger' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
            {' '}{title}
          </h2>
        </div>

        <div className="modal-body">
          <p style={{ margin: '8px 0 16px 0', lineHeight: 1.5, opacity: 0.9 }}>
            {message}
          </p>
        </div>

        <div className="modal-footer">
          {showCancel && (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button
            type="button"
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
