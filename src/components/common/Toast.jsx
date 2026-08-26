import React, { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

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
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-4 bg-[#26233a] border border-primary/30 text-light px-4 py-3 rounded-xl shadow-2xl animate-slide-up">
      <span className="text-sm font-medium">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onUndo();
            if (onClose) onClose();
          }}
          className="text-xs font-semibold text-primary hover:text-primary-light flex items-center gap-1.5 transition-colors uppercase tracking-wider"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Deshacer
        </button>
      )}
    </div>
  );
}
