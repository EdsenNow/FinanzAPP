import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-backdrop animate-fade-in" onClick={onClose}>
      <div 
        className={`w-full ${maxWidth} card-glass p-6 relative animate-scale-in max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
          <h2 className="text-lg font-bold flex items-center gap-2 text-light">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray hover:text-light hover:bg-white/5 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 icon-x" />
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
