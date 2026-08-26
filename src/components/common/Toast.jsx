import React, { useEffect } from 'react';

export default function Toast({ message, onUndo, onClose, duration = 6000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="toast-notification show" id="toastNotification" style={{ display: 'flex' }}>
      <span className="toast-message">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onUndo();
            if (onClose) onClose();
          }}
          className="toast-undo-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginLeft: '12px'
          }}
        >
          <i className="fas fa-undo"></i> Deshacer
        </button>
      )}
    </div>
  );
}
