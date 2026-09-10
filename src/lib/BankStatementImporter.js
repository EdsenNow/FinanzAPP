/**
 * @fileoverview Importador inteligente de extractos bancarios para FinanzApp.
 *
 * Analiza archivos CSV/TXT de extractos bancarios, autodetecta columnas y delimitadores,
 * extrae fechas, montos y descripciones, y auto-sugiere categorías mediante MerchantCategorizer.
 */

const categorizer = (typeof window !== 'undefined' && window.MerchantCategorizer) || (typeof globalThis !== 'undefined' && globalThis.MerchantCategorizer);

  /**
   * Detecta el delimitador más probable de un archivo CSV basado en las primeras líneas.
   * @param {string} content
   * @returns {string}
   */
  function detectDelimiter(content) {
    const sample = (content || '').split('\n').slice(0, 5).join('\n');
    const delimiters = [',', ';', '\t', '|'];
    let bestDelim = ',';
    let maxCount = -1;

    for (const d of delimiters) {
      const count = (sample.match(new RegExp(`\\${d}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelim = d;
      }
    }
    return bestDelim;
  }

  /**
   * Divide una línea CSV respetando comillas y caracteres de escape.
   * @param {string} line
   * @param {string} delimiter
   * @returns {Array<string>}
   */
  function splitCsvLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Normaliza un número parseándolo de formatos dominicanos o internacionales.
   * @param {string|number} value
   * @returns {number|null}
   */
  function parseAmount(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let raw = String(value || '').trim();
    // Eliminar símbolos de moneda
    raw = raw.replace(/[RD$US€£\s]/gi, '');
    if (!raw) return null;

    const isNegative = raw.includes('-') || (raw.startsWith('(') && raw.endsWith(')'));
    raw = raw.replace(/[()\-+]/g, '').trim();

    if (/,\d{1,2}$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }

    const n = parseFloat(raw);
    if (isNaN(n)) return null;
    return isNegative ? -Math.abs(n) : Math.abs(n);
  }

  /**
   * Parsea cadenas de fecha comunes en portales bancarios.
   * @param {string} rawDate
   * @returns {Date|null}
   */
  function parseDate(rawDate) {
    if (!rawDate) return null;
    const clean = String(rawDate).trim();

    // Formato DD/MM/YYYY o DD-MM-YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      if (!isNaN(d.getTime())) return d;
    }

    // Formato YYYY-MM-DD
    const ymd = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      if (!isNaN(d.getTime())) return d;
    }

    const standard = new Date(clean);
    return !isNaN(standard.getTime()) ? standard : null;
  }

  /**
   * Identifica los índices de columnas relevantes en la fila de cabeceras.
   * @param {Array<string>} headers
   * @returns {Object}
   */
  function detectColumns(headers) {
    const mapping = {
      dateIndex: -1,
      descIndex: -1,
      amountIndex: -1,
      debitIndex: -1,
      creditIndex: -1,
      categoryIndex: -1
    };

    const normHeaders = headers.map(h => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());

    normHeaders.forEach((h, idx) => {
      if (mapping.dateIndex === -1 && /(fecha|date|dia|transaccion)/i.test(h) && !/(vencimiento|corte)/i.test(h)) {
        mapping.dateIndex = idx;
      } else if (mapping.descIndex === -1 && /(descripcion|concepto|comercio|establecimiento|detalle|beneficiario|memo)/i.test(h)) {
        mapping.descIndex = idx;
      } else if (mapping.debitIndex === -1 && /(debito|cargo|retiro|gasto|salida)/i.test(h)) {
        mapping.debitIndex = idx;
      } else if (mapping.creditIndex === -1 && /(credito|abono|deposito|ingreso|entrada)/i.test(h)) {
        mapping.creditIndex = idx;
      } else if (mapping.amountIndex === -1 && /(monto|importe|amount|valor|total)/i.test(h)) {
        mapping.amountIndex = idx;
      } else if (mapping.categoryIndex === -1 && /(categoria|rubro|clasificacion)/i.test(h)) {
        mapping.categoryIndex = idx;
      }
    });

    return mapping;
  }

  /**
   * Parsea un extracto bancario CSV completo y genera filas enriquecidas listas para importar.
   *
   * @param {string} csvContent - Contenido crudo del archivo
   * @param {Array} availableCategories - Categorías actuales para auto-categorización
   * @param {Object} [options]
   * @returns {Object}
   */
  function parseStatement(csvContent, availableCategories = [], options = {}) {
    if (!csvContent || typeof csvContent !== 'string') {
      return { success: false, error: 'El archivo está vacío o no es una cadena válida.', rows: [] };
    }

    const cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
    const delimiter = options.delimiter || detectDelimiter(cleanContent);
    const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return { success: false, error: 'El archivo debe contener al menos un encabezado y una fila de datos.', rows: [] };
    }

    const headerLine = lines[0];
    const headers = splitCsvLine(headerLine, delimiter);
    const colMap = detectColumns(headers);

    if (colMap.dateIndex === -1 && colMap.descIndex === -1 && colMap.amountIndex === -1 && colMap.debitIndex === -1) {
      return { success: false, error: 'No se pudieron identificar las columnas requeridas (Fecha, Descripción o Monto).', rows: [] };
    }

    const parsedRows = [];
    const errors = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex];
      const cols = splitCsvLine(rawLine, delimiter);
      if (cols.length < 2) continue;

      const rawDateStr = colMap.dateIndex >= 0 ? cols[colMap.dateIndex] : null;
      const dateObj = parseDate(rawDateStr) || new Date();
      const desc = (colMap.descIndex >= 0 ? cols[colMap.descIndex] : 'Transacción importada') || 'Transacción';

      let amount = null;
      let type = 'expense';

      if (colMap.debitIndex >= 0 && cols[colMap.debitIndex]) {
        const dVal = parseAmount(cols[colMap.debitIndex]);
        if (dVal && dVal > 0) {
          amount = dVal;
          type = 'expense';
        }
      }

      if (!amount && colMap.creditIndex >= 0 && cols[colMap.creditIndex]) {
        const cVal = parseAmount(cols[colMap.creditIndex]);
        if (cVal && cVal > 0) {
          amount = cVal;
          type = 'income';
        }
      }

      if (amount === null && colMap.amountIndex >= 0) {
        const rawAmount = cols[colMap.amountIndex];
        const parsed = parseAmount(rawAmount);
        if (parsed !== null) {
          if (String(rawAmount).includes('-')) {
            amount = Math.abs(parsed);
            type = 'expense';
          } else {
            amount = Math.abs(parsed);
            type = 'expense'; // Default expense salvo que reglas lo detecten como ingreso
          }
        }
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        errors.push({ line: lineIndex + 1, reason: 'Monto inválido o no encontrado' });
        continue;
      }

      // Auto-categorización inteligente con MerchantCategorizer
      let suggestedCat = null;
      if (categorizer && typeof categorizer.suggestCategory === 'function') {
        suggestedCat = categorizer.suggestCategory(desc, availableCategories, {
          historyMemory: availableCategories,
          txType: type
        });
      }

      const defaultCat = availableCategories.find(c => {
        if (type === 'income') return c.fixedType === 'income';
        return c.fixedType !== 'income';
      }) || availableCategories[0] || null;

      parsedRows.push({
        id: `imp_${Date.now()}_${lineIndex}_${Math.floor(Math.random() * 10000)}`,
        date: dateObj,
        dateIso: dateObj.toISOString(),
        dateRaw: rawDateStr,
        description: desc.substring(0, 100),
        amount,
        type,
        categoryId: suggestedCat ? suggestedCat.categoryId : (defaultCat ? defaultCat.id : null),
        categoryName: suggestedCat ? suggestedCat.categoryName : (defaultCat ? defaultCat.name : 'General'),
        confidence: suggestedCat ? suggestedCat.confidence : 'none',
        reason: suggestedCat ? suggestedCat.reason : 'Asignada categoría predeterminada'
      });
    }

    return {
      success: true,
      delimiter,
      totalLines: lines.length - 1,
      importedCount: parsedRows.length,
      errorsCount: errors.length,
      rows: parsedRows,
      errors
    };
  }

  const BankStatementImporter = {
    detectDelimiter,
    splitCsvLine,
    parseAmount,
    parseDate,
    detectColumns,
    parseStatement
  };

  if (typeof window !== 'undefined') {
    window.BankStatementImporter = BankStatementImporter;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BankStatementImporter = BankStatementImporter;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankStatementImporter;
  }

