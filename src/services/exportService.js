import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency } from './dataCalculations';

export function exportToJSON(categories, budgets, settings) {
  const data = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    categories,
    budgets,
    settings
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(categories, settings = {}) {
  const doc = new jsPDF();
  const symbol = settings.currencySymbol || '$';

  // Title
  doc.setFontSize(20);
  doc.setTextColor(235, 111, 146); // Rosé Pine Primary
  doc.text('FinanzApp - Reporte Financiero', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(144, 140, 170); // Subtle text
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

  const tableRows = [];
  categories.forEach((cat) => {
    (cat.transactions || []).forEach((tx) => {
      tableRows.push([
        tx.date || '-',
        cat.name,
        tx.desc || tx.description || 'Sin descripción',
        tx.type === 'income' ? 'Ingreso' : 'Gasto',
        formatCurrency(tx.amount, symbol)
      ]);
    });
  });

  doc.autoTable({
    head: [['Fecha', 'Categoría', 'Descripción', 'Tipo', 'Monto']],
    body: tableRows,
    startY: 35,
    theme: 'grid',
    headStyles: {
      fillColor: [235, 111, 146],
      textColor: [25, 23, 36],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    }
  });

  doc.save(`finanzapp-reporte-${new Date().toISOString().slice(0, 10)}.pdf`);
}
