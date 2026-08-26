import React, { useState } from 'react';
import Modal from './Modal';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function DatePickerModal({ isOpen, onClose, selectedDate, onSelectDate }) {
  const initial = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [tempDate, setTempDate] = useState(selectedDate || new Date().toISOString().slice(0, 10));

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Generate days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const days = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(i)}`;
    days.push({ day: i, isCurrentMonth: true, dateStr });
  }

  const handleSelectDay = (dateStr) => {
    if (!dateStr) return;
    setTempDate(dateStr);
  };

  const handleConfirm = () => {
    if (onSelectDate) onSelectDate(tempDate);
    onClose();
  };

  const handleToday = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setTempDate(todayStr);
    setCurrentMonth(new Date().getMonth());
    setCurrentYear(new Date().getFullYear());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={<><Calendar className="w-5 h-5 text-primary" /> Seleccionar Fecha</>} maxWidth="max-w-sm">
      <div className="space-y-4">
        {/* Header navigation */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray hover:text-light hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-light">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray hover:text-light hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray">
          {WEEK_DAYS.map((wd) => (
            <div key={wd} className="py-1">{wd}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {days.map((item, idx) => {
            const isSelected = item.dateStr === tempDate;
            return (
              <button
                key={idx}
                type="button"
                disabled={!item.isCurrentMonth}
                onClick={() => item.dateStr && handleSelectDay(item.dateStr)}
                className={`h-9 w-9 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                  !item.isCurrentMonth
                    ? 'text-gray/30 opacity-40 cursor-default'
                    : isSelected
                    ? 'bg-primary text-dark font-bold shadow-neon-primary'
                    : 'text-light hover:bg-white/5 hover:text-primary'
                }`}
              >
                {item.day}
              </button>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="btn-secondary-custom text-xs px-3 py-1.5"
          >
            Hoy
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary-custom text-xs px-3 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-neon-primary text-xs px-3 py-1.5"
            >
              Seleccionar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
