import React, { useState } from 'react';

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

  if (!isOpen) return null;

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
    <div
      className="modal show"
      id="datePickerModal"
      role="dialog"
      aria-modal="true"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target.classList.contains('modal')) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <i className="fas fa-calendar-alt"></i> Seleccionar Fecha
          </h2>
        </div>

        <div className="modal-body">
          {/* Header navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button type="button" onClick={prevMonth} className="btn-icon">
              <i className="fas fa-chevron-left"></i>
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button type="button" onClick={nextMonth} className="btn-icon">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>

          {/* Weekdays */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, opacity: 0.7, marginBottom: '6px' }}>
            {WEEK_DAYS.map((wd) => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {days.map((item, idx) => {
              const isSelected = item.dateStr === tempDate;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!item.isCurrentMonth}
                  onClick={() => item.dateStr && handleSelectDay(item.dateStr)}
                  style={{
                    height: '34px',
                    width: '34px',
                    margin: 'auto',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.8rem',
                    cursor: item.isCurrentMonth ? 'pointer' : 'default',
                    opacity: item.isCurrentMonth ? 1 : 0.25,
                    backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    color: isSelected ? '#191724' : 'inherit',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" onClick={handleToday} className="btn btn-secondary">
            Hoy
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} className="btn btn-primary">
              Seleccionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
