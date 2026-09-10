/**
 * @fileoverview Módulo de exportación para FinanzApp (JSON, PDF ejecutivo, CSV/Excel).
 *
 * Extrae y centraliza la generación y descarga de reportes financieros para aligerar
 * el controlador principal de Categorias.js.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasExport = factory();
    // Exposición global para retrocompatibilidad directa
    root.exportarAJSON = root.CategoriasExport.exportarAJSON;
    root.exportarAPDF = root.CategoriasExport.exportarAPDF;
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Extrae y sanitiza el nombre del usuario autenticado desde localStorage,
   * dejándolo listo para usarse en nombres de archivo exportados.
   * @returns {string}
   */
  function obtenerNombreArchivoUsuario() {
    const rawAuth = (typeof localStorage !== 'undefined' && localStorage.getItem('authUser')) || 'guest';
    let nombre;
    if (!rawAuth || rawAuth === 'guest') {
      nombre = 'Invitado';
    } else {
      try {
        const parsed = JSON.parse(rawAuth);
        nombre = String(parsed?.name || parsed?.displayName || parsed?.email || 'Usuario').trim();
      } catch {
        nombre = 'Usuario';
      }
    }
    return nombre.replace(/\s+/g, '').replace(/[^\wÁÉÍÓÚÑáéíóúñ-]/g, '') || 'Usuario';
  }

  /**
   * Descarga un Blob como archivo en el navegador del usuario.
   * @param {Blob} blob 
   * @param {string} fileName 
   */
  function descargarBlob(blob, fileName) {
    if (typeof document === 'undefined') return;
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = URL.createObjectURL(blob);
    enlaceDescarga.download = fileName;
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click();
    URL.revokeObjectURL(enlaceDescarga.href);
    enlaceDescarga.remove();
  }

  /**
   * Serializa todos los datos del usuario a JSON y los descarga como archivo de respaldo.
   * @param {Object} [datos] - Estructura datosUsuario
   * @param {Function} [notifySuccess]
   */
  function exportarAJSON(datos, notifySuccess) {
    const fnSuccess = notifySuccess || (typeof window !== 'undefined' && window.mostrarExito) || console.log;
    const datosBase = datos || (typeof window !== 'undefined' && window.datosUsuario) || { categories: [] };
    const nombreUsuario = obtenerNombreArchivoUsuario();
    const fecha = new Date().toISOString().split('T')[0];

    const instantanea = {
      version: 1,
      ...datosBase,
      categories: (datosBase.categories || []).map(c => ({
        ...c,
        transactions: (c.transactions || []).map(t => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : t.date
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(instantanea, null, 2)], { type: 'application/json' });
    descargarBlob(blob, `FinanzApp-${nombreUsuario}-${fecha}.json`);

    if (typeof fnSuccess === 'function') {
      fnSuccess('Archivo JSON exportado correctamente.');
    }
  }

  /**
   * Genera un PDF ejecutivo con el resumen financiero y el detalle de transacciones filtradas.
   * Requiere jsPDF disponible en `window`.
   * @param {Object} [options]
   */
  function exportarAPDF(options = {}) {
    const jsPDFClass = (typeof window !== 'undefined' && (window.jsPDF || window.jspdf?.jsPDF));
    const fnSuccess = options.mostrarExito || (typeof window !== 'undefined' && window.mostrarExito) || console.log;
    const fnError = options.mostrarError || (typeof window !== 'undefined' && window.mostrarError) || console.error;
    const fnFormatCurrency = options.formatCurrency || (typeof window !== 'undefined' && window.formatCurrency) || (n => `$${Number(n || 0).toFixed(2)}`);
    const fnFormatDate = options.formatDate || (typeof window !== 'undefined' && window.formatDate) || (d => new Date(d).toLocaleDateString());

    if (!jsPDFClass) {
      console.error('jsPDF no está disponible');
      if (typeof fnError === 'function') {
        fnError('La librería PDF no está disponible. Por favor, recarga la página.');
      }
      return;
    }

    try {
      let categoriasFiltradas = options.categorias;
      if (!categoriasFiltradas && typeof window !== 'undefined' && typeof window.aplicarFiltrosACategorias === 'function') {
        categoriasFiltradas = window.aplicarFiltrosACategorias();
      } else if (!categoriasFiltradas && typeof window !== 'undefined') {
        categoriasFiltradas = window.datosUsuario?.categories || [];
      } else if (!categoriasFiltradas) {
        categoriasFiltradas = [];
      }

      const doc = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const bottomLimit = pageHeight - 18;

      // Calcular totales
      let totalIngresos = 0;
      let totalGastos = 0;
      let totalTransacciones = 0;

      categoriasFiltradas.forEach(category => {
        (category.transactions || []).forEach(transaction => {
          totalTransacciones++;
          if (transaction.type === 'income') {
            totalIngresos += Number(transaction.amount || 0);
          } else {
            totalGastos += Number(transaction.amount || 0);
          }
        });
      });

      const balance = totalIngresos - totalGastos;

      // Filtros activos
      let filtroTexto = 'Todos los periodos';
      try {
        if (typeof document !== 'undefined') {
          const yf = document.getElementById('yearFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
          const mf = document.getElementById('monthFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          if (yf || mf !== '') {
            const anoStr = yf ? `Año ${yf}` : 'Todos los años';
            const mesStr = mf !== '' ? monthNames[Number(mf)] || `Mes ${Number(mf) + 1}` : 'Todos los meses';
            filtroTexto = `${anoStr} • ${mesStr}`;
          }
        }
      } catch {}

      // Nombre de usuario
      let nombreUsuario = 'Usuario';
      try {
        const rawAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('authUser') : null;
        if (rawAuth && rawAuth !== 'guest') {
          const parsed = JSON.parse(rawAuth);
          nombreUsuario = parsed.name || parsed.displayName || 'Usuario';
        }
      } catch {}

      // ── 1. Banner Superior (Página 1) ──────────────────────────────────
      doc.setFillColor(31, 29, 46); // #1F1D2E
      doc.roundedRect(margin, 12, contentWidth, 26, 3, 3, 'F');

      // Accent line en el banner
      doc.setFillColor(235, 111, 146); // #EB6F92
      doc.roundedRect(margin, 12, 4, 26, 2, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('FinanzApp', margin + 8, 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(224, 222, 244);
      doc.text('Reporte de Transacciones y Estado Financiero', margin + 8, 29);

      // Metadatos a la derecha
      doc.setFontSize(8);
      doc.setTextColor(224, 222, 244);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - margin - 6, 20, { align: 'right' });
      doc.text(`Usuario: ${nombreUsuario}`, pageWidth - margin - 6, 25, { align: 'right' });
      doc.text(`Filtro: ${filtroTexto}`, pageWidth - margin - 6, 30, { align: 'right' });

      // ── 2. Tarjetas de Resumen Financiero (KPIs) ──────────────────────
      let yPos = 44;
      const cardGap = 4;
      const cardWidth = (contentWidth - (cardGap * 2)) / 3;
      const cardHeight = 18;

      // Card 1: Ingresos
      doc.setFillColor(235, 248, 244);
      doc.setDrawColor(45, 149, 123);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

      doc.setTextColor(45, 149, 123);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('TOTAL INGRESOS', margin + 5, yPos + 6);
      doc.setFontSize(10.5);
      doc.text(`+${fnFormatCurrency(totalIngresos)}`, margin + 5, yPos + 13);

      // Card 2: Gastos
      const card2X = margin + cardWidth + cardGap;
      doc.setFillColor(253, 242, 244);
      doc.setDrawColor(235, 111, 146);
      doc.setLineWidth(0.4);
      doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

      doc.setTextColor(235, 111, 146);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('TOTAL GASTOS', card2X + 5, yPos + 6);
      doc.setFontSize(10.5);
      doc.text(`-${fnFormatCurrency(totalGastos)}`, card2X + 5, yPos + 13);

      // Card 3: Balance Neto
      const card3X = card2X + cardWidth + cardGap;
      const balanceColor = balance >= 0 ? [120, 80, 180] : [235, 111, 146];
      doc.setFillColor(244, 239, 251);
      doc.setDrawColor(196, 167, 231);
      doc.setLineWidth(0.4);
      doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('BALANCE NETO', card3X + 5, yPos + 6);
      doc.setFontSize(10.5);
      doc.text(`${fnFormatCurrency(balance)}`, card3X + 5, yPos + 13);

      yPos += cardHeight + 8;

      // Helper para encabezado de tabla
      function dibujarTableHeader(currentY) {
        doc.setFillColor(31, 29, 46);
        doc.roundedRect(margin, currentY, contentWidth, 6.5, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('TIPO', margin + 4, currentY + 4.5);
        doc.text('MONTO', margin + 30, currentY + 4.5);
        doc.text('DESCRIPCIÓN', margin + 70, currentY + 4.5);
        doc.text('FECHA', pageWidth - margin - 4, currentY + 4.5, { align: 'right' });
        return currentY + 7.5;
      }

      // ── 3. Categorías y Tablas de Transacciones ────────────────────────
      categoriasFiltradas.forEach(category => {
        const txs = category.transactions || [];
        if (txs.length === 0) return;

        let catTotal = 0;
        txs.forEach(t => catTotal += Number(t.amount || 0));
        const esIngresoCat = txs.some(t => t.type === 'income') && !txs.some(t => t.type === 'expense');

        if (yPos + 26 > bottomLimit) {
          doc.addPage();
          yPos = 20;
        }

        // Banner de la Categoría
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, yPos, contentWidth, 7.5, 2, 2, 'FD');

        doc.setFillColor(esIngresoCat ? 45 : 235, esIngresoCat ? 149 : 111, esIngresoCat ? 123 : 146);
        doc.circle(margin + 4.5, yPos + 3.75, 1.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(category.name || 'Sin Categoría', margin + 9, yPos + 5.2);

        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const subtotalTexto = `${txs.length} ${txs.length === 1 ? 'movimiento' : 'movimientos'}  •  Subtotal: ${fnFormatCurrency(catTotal)}`;
        doc.text(subtotalTexto, pageWidth - margin - 4, yPos + 5.2, { align: 'right' });

        yPos += 9;
        yPos = dibujarTableHeader(yPos);

        txs.forEach((transaction, idx) => {
          if (yPos + 7 > bottomLimit) {
            doc.addPage();
            yPos = 20;
            yPos = dibujarTableHeader(yPos);
          }

          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, yPos - 1, contentWidth, 6.2, 'F');
          }

          const isIncome = transaction.type === 'income';
          const tipoTexto = isIncome ? 'Ingreso' : 'Gasto';
          const montoTexto = fnFormatCurrency(transaction.amount);
          const descTexto = transaction.description || 'Sin descripción';
          const fechaTexto = fnFormatDate(transaction.date);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(isIncome ? 45 : 235, isIncome ? 149 : 111, isIncome ? 123 : 146);
          doc.text(tipoTexto, margin + 4, yPos + 3.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(montoTexto, margin + 30, yPos + 3.5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.8);
          doc.setTextColor(71, 85, 105);
          const descCorta = descTexto.length > 45 ? descTexto.substring(0, 42) + '...' : descTexto;
          doc.text(descCorta, margin + 70, yPos + 3.5);

          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(fechaTexto, pageWidth - margin - 4, yPos + 3.5, { align: 'right' });

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(margin, yPos + 5.2, pageWidth - margin, yPos + 5.2);

          yPos += 6.2;
        });

        yPos += 6;
      });

      // ── 4. Running Header & Footer en todas las páginas ────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        if (i > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('FinanzApp  •  Reporte Detallado de Transacciones', margin, 10);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(margin, 12, pageWidth - margin, 12);
        }

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('FinanzApp • Documento confidencial generado automáticamente', margin, pageHeight - 7);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      }

      const fileName = `FinanzApp-${obtenerNombreArchivoUsuario()}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      if (typeof fnSuccess === 'function') {
        fnSuccess('Archivo PDF exportado correctamente con formato ejecutivo.');
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      if (typeof fnError === 'function') {
        fnError(`Error al exportar PDF: ${error.message}`);
      }
    }
  }

  return {
    obtenerNombreArchivoUsuario,
    exportarAJSON,
    exportarAPDF
  };
});

