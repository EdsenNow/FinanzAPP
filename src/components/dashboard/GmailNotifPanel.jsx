import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Bell, ArrowUp, ArrowDown, Trash2, Check, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../services/dataCalculations';

export default function GmailNotifPanel({
  isOpen,
  onClose,
  notifications = [],
  categories = [],
  currencySymbol = '$',
  onApprove,
  onDiscard,
  onClearAll,
  onRefresh,
  loading = false
}) {
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [targetCategory, setTargetCategory] = useState(categories[0]?.id || '');

  const handleApprove = (notif) => {
    onApprove(notif, targetCategory);
    setSelectedNotif(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-warning" />
              <span>Detección de Movimientos Bancarios</span>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-danger hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar todo
              </button>
            )}
          </div>
        }
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray">
              Transacciones detectadas en tus correos bancarios vinculados.
            </p>
            {onRefresh && (
              <button
                type="button"
                disabled={loading}
                onClick={onRefresh}
                className="btn-secondary-custom text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray text-xs space-y-2">
              <Bell className="w-8 h-8 mx-auto opacity-30" />
              <p>No hay movimientos bancarios pendientes de revisión.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {notifications.map((n) => (
                <div
                  key={n.id || n.messageId}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        n.type === 'income' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                      }`}>
                        {n.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                      <span className="text-[11px] text-gray">{n.date || 'Reciente'}</span>
                    </div>
                    <p className="text-xs font-semibold text-light truncate mt-1">
                      {n.merchant || n.desc || n.subject || 'Movimiento bancario'}
                    </p>
                    <p className="text-[11px] font-bold text-light mt-0.5">
                      {formatCurrency(n.amount, currencySymbol)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNotif(n);
                        setTargetCategory(categories[0]?.id || '');
                      }}
                      className="btn-neon-primary text-xs px-3 py-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Revisar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscard(n.id || n.messageId)}
                      className="p-1.5 text-gray hover:text-danger rounded-lg transition-colors"
                      title="Descartar"
                    >
                      <Trash2 className="w-4 h-4 icon-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Single Review Modal */}
      {selectedNotif && (
        <Modal
          isOpen={Boolean(selectedNotif)}
          onClose={() => setSelectedNotif(null)}
          title="Revisar y Asignar Categoría"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/5 space-y-1">
              <p className="text-xs text-gray">Monto detectado:</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(selectedNotif.amount, currencySymbol)}
              </p>
              <p className="text-xs text-light font-medium">
                {selectedNotif.merchant || selectedNotif.desc || selectedNotif.subject}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray uppercase mb-2">
                Asignar a Categoría
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="btn-secondary-custom text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedNotif)}
                className="btn-neon-primary text-sm"
              >
                Guardar en Categoría
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
