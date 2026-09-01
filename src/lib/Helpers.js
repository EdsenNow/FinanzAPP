/**
 * @fileoverview Utilidades globales de formato, validación y configuración de la app.
 *
 * Provee métodos estáticos reutilizables en todas las páginas para:
 * - Formateo de moneda y cantidades numéricas
 * - Validación de fechas y montos
 * - Lectura de configuración del usuario desde localStorage
 * - Escape de HTML para prevención de XSS
 *
 * Se inicializa automáticamente al cargar, exponiendo la configuración
 * del usuario en variables globales (`window.__appXxx`).
 *
 * @example
 * Helpers.formatCurrency(1234.5);           // "$1,234.50"
 * Helpers.esc('<script>');                  // "&lt;script&gt;"
 * Helpers.validateDate('2026-12-31');       // { isValid: false, error: '...', date: null }
 * const { symbol, locale } = Helpers.getCurrencyMeta();
 */
class Helpers {
  /**
   * Mapa de divisas soportadas con su configuración de locale, código ISO y símbolo.
   * @type {Object.<string, {locale: string, currency: string, symbol: string}>}
   */
  static #CURRENCY_META = {
    DOP: { locale: 'es-DO', currency: 'DOP', symbol: 'RD$' },
    USD: { locale: 'en-US', currency: 'USD', symbol: '$' },
    EUR: { locale: 'es-ES', currency: 'EUR', symbol: '€' }
  };

  /**
   * Configuración por defecto del sistema.
   */
  static DEFAULT_SETTINGS = Object.freeze({
    theme: 'dark',
    categoryViewMode: 'compact',
    currency: 'DOP',
    numberFormat: 'us',
    tooltips: 'on',
    shortcuts: 'on',
    dateFormat: 'dmy',
    confirmDelete: 'on',
    autoRenewBudgets: 'on',
    txPerPage: '10',
    showCents: 'off',
    censorAmounts: 'off'
  });

  /**
   * Lee la configuración de la app desde localStorage de forma segura combinada con los defaults.
   * @returns {Object} Objeto de configuración.
   */
  static #getAppSettings() {
    try {
      const raw = localStorage.getItem('finanzapp:settings:v1');
      if (!raw) return { ...Helpers.DEFAULT_SETTINGS };
      return { ...Helpers.DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...Helpers.DEFAULT_SETTINGS };
    }
  }

  /**
   * Obtiene los metadatos de la divisa activa según la configuración del usuario.
   * @returns {{ locale: string, currency: string, symbol: string, code: string }}
   */
  static getCurrencyMeta() {
    const raw  = Helpers.#getAppSettings();
    const code = Helpers.#CURRENCY_META[raw?.currency] ? raw.currency : 'DOP';
    const base = Helpers.#CURRENCY_META[code] || Helpers.#CURRENCY_META.DOP;
    const locale = raw?.numberFormat === 'eu' ? 'es-ES' : base.locale;
    return { ...base, code, locale };
  }

  /**
   * Crea un `Intl.NumberFormat` configurado con la divisa y decimales activos.
   * @param {'currency'|'number'} [style='currency']
   * @returns {Intl.NumberFormat}
   */
  static #getFormatter(style = 'currency') {
    const currencyMeta = Helpers.getCurrencyMeta();
    const showCents    = window.__appShowCents === true;
    const options = {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    };
    if (style === 'currency') {
      options.style    = 'currency';
      options.currency = currencyMeta.currency;
    }
    return new Intl.NumberFormat(currencyMeta.locale, options);
  }

  /**
   * Formatea un número como moneda con el símbolo de la divisa activa.
   * @param {number|string} amount - Cantidad a formatear.
   * @param {{ withSymbol?: boolean, symbol?: string }} [opts]
   * @returns {string} Cantidad formateada, ej. "$1,234.50" o "-€500.00".
   */
  static formatCurrency(amount, { withSymbol = true, symbol = '' } = {}) {
    if (window.__appCensorAmounts) {
      const meta = Helpers.getCurrencyMeta();
      const sym = withSymbol ? (symbol || meta.symbol) : '';
      return `${sym}••••••`;
    }
    const n        = Number(amount) || 0;
    const absValue = Math.abs(n);
    const sign     = n < 0 ? '-' : '';
    const meta     = Helpers.getCurrencyMeta();

    if (!withSymbol) return Helpers.#getFormatter('number').format(n);
    if (symbol)      return `${sign}${symbol}${Helpers.#getFormatter('number').format(absValue)}`;
    return `${sign}${meta.symbol}${Helpers.#getFormatter('number').format(absValue)}`;
  }

  /**
   * Formatea un número con separadores de miles, sin símbolo de moneda.
   * @param {number|string} amount
   * @returns {string}
   */
  static formatCurrencyStrict(amount) {
    if (window.__appCensorAmounts) {
      return '••••••';
    }
    return Helpers.#getFormatter('number').format(Number(amount) || 0);
  }

  /**
   * Formatea una cadena de cantidad parcial mientras el usuario escribe.
   * Soporta separador decimal con coma o punto; devuelve formato con punto de miles.
   * @param {string|null} raw - Cadena cruda del input.
   * @returns {string} Cadena formateada, ej. "1.234,56".
   */
  static formatInputAmount(raw) {
    if (raw == null) return '';
    const s = String(raw).replace(/[^\d.,]/g, '').replace(/,/g, '.');
    if (!s) return '';
    const parts = s.split('.');
    let int  = parts[0];
    let frac = parts[1] || '';
    int = int.replace(/^0+(?=\d)/, '');
    const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (parts.length === 1) return intFormatted;
    frac = frac.slice(0, 2);
    return frac.length ? `${intFormatted},${frac}` : `${intFormatted},`;
  }

  /**
   * Comprueba si una cadena contiene más de un separador decimal (coma o punto).
   * @param {string} raw
   * @returns {boolean}
   */
  static hasMultipleDecimalSeparators(raw) {
    return (String(raw).match(/[.,]/g) || []).length > 1;
  }

  /**
   * Comprueba si la parte decimal supera el máximo de dígitos permitido.
   * @param {string} raw
   * @param {number} [maxFrac=2]
   * @returns {boolean}
   */
  static hasTooManyFractionDigits(raw, maxFrac = 2) {
    const s = String(raw).replace(',', '.');
    const i = s.indexOf('.');
    if (i === -1) return false;
    const frac = (s.slice(i + 1).match(/\d/g) || []).join('');
    return frac.length > maxFrac;
  }

  /**
   * Limpia y restringe una cadena numérica a los límites de dígitos enteros y decimales.
   * @param {string} raw     - Cadena cruda del input.
   * @param {number} [maxInt=8]  - Máximo de dígitos en la parte entera.
   * @param {number} [maxFrac=2] - Máximo de dígitos en la parte decimal.
   * @returns {string} Cadena sanitizada.
   */
  static sanitizeAmount(raw, maxInt = 8, maxFrac = 2) {
    let s = String(raw).replace(',', '.').replace(/[^\d.]/g, '');
    if (!s) return '';
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    const hasDot = s.includes('.');
    let [int = '', frac = ''] = s.split('.');
    int  = int.slice(0, maxInt);
    frac = frac.slice(0, maxFrac);
    return hasDot ? (frac.length ? `${int}.${frac}` : `${int}.`) : int;
  }

  /**
   * Verifica si una cadena representa una cantidad válida, positiva y dentro de los límites.
   * @param {string} str
   * @param {number} [maxInt=8]
   * @param {number} [maxFrac=2]
   * @returns {boolean}
   */
  static isValidAmount(str, maxInt = 8, maxFrac = 2) {
    if (!str) return false;
    const re = new RegExp(`^\\d{1,${maxInt}}(?:\\.\\d{1,${maxFrac}})?$`);
    if (!re.test(str)) return false;
    const n = parseFloat(str);
    return Number.isFinite(n) && n > 0;
  }

  /**
   * Valida una fecha: verifica que sea válida y no sea futura.
   * @param {Date|string} dateInput
   * @returns {{ isValid: boolean, error: string|null, date: Date|null }}
   */
  static validateDate(dateInput) {
    if (!dateInput) return { isValid: false, error: 'Fecha requerida', date: null };

    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return { isValid: false, error: 'Fecha inválida', date: null };

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) return { isValid: false, error: 'No se pueden agregar transacciones futuras', date: null };

    return { isValid: true, error: null, date };
  }

  /**
   * Formatea una fecha según el formato configurado por el usuario (DMY o MDY).
   * @param {Date|string|number} date
   * @returns {string} Fecha formateada o cadena vacía si la entrada es inválida.
   */
  static formatDate(date) {
    if (!date) return '';
    let d = date;
    if (!(d instanceof Date)) {
      if (typeof d === 'string') {
        const trimmed = d.trim();
        if (trimmed.includes('/')) {
          const parts = trimmed.split('/');
          if (parts.length === 3) {
            let isMdy = false;
            try {
              const raw = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
              isMdy = raw?.dateFormat === 'mdy';
            } catch (_) {}
            const day = isMdy ? Number(parts[1]) : Number(parts[0]);
            const month = isMdy ? Number(parts[0]) : Number(parts[1]);
            const year = Number(parts[2]);
            d = new Date(year, month - 1, day);
          } else {
            d = new Date(trimmed);
          }
        } else {
          d = new Date(trimmed);
        }
      } else {
        d = new Date(date);
      }
    }
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';

    try {
      const raw = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      if (raw?.dateFormat === 'mdy') {
        return `${month}/${day}/${year}`;
      }
      return `${day}/${month}/${year}`;
    } catch {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }


  /**
   * Convierte una fecha a formato `YYYY-MM-DD` para usar en inputs `<input type="date">`.
   * @param {Date} date
   * @returns {string}
   */
  static formatDateForInput(date) {
    if (!date || !(date instanceof Date)) return '';
    return date.toISOString().split('T')[0];
  }

  /**
   * Escapa caracteres HTML especiales para prevenir XSS al insertar texto en el DOM.
   * @param {*} s - Valor a escapar (se convierte a string).
   * @returns {string} Cadena con entidades HTML escapadas.
   */
  static esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /**
   * Lee la configuración del usuario y expone variables globales `window.__appXxx`.
   * Se llama automáticamente al cargar el módulo; también puede llamarse tras
   * un cambio de configuración para refrescar los valores.
   */
  static applyAppSettings() {
    try {
      const raw         = Helpers.#getAppSettings();
      const tooltips    = raw?.tooltips    !== 'off';
      const shortcuts   = raw?.shortcuts   !== 'off';
      const currencyMeta = Helpers.getCurrencyMeta();

      if (!tooltips) {
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('[title]').forEach(el => {
            el.dataset.titleStored = el.getAttribute('title');
            el.removeAttribute('title');
          });
        });
      }

      window.__appShortcutsEnabled = shortcuts;
      window.__appTooltips         = tooltips;
      window.__appConfirmDelete    = raw?.confirmDelete !== 'off';
      window.__appCensorAmounts    = raw?.censorAmounts === 'on';
      window.__appTxPerPage        = raw?.txPerPage === 'all'
        ? Infinity
        : (['10', '25', '50'].includes(String(raw?.txPerPage)) ? Number(raw.txPerPage) : 10);
      window.__appShowCents        = raw?.showCents === 'on';
      window.__appCategoryViewMode = raw?.categoryViewMode === 'extended' ? 'extended' : 'compact';
      window.__appCurrency         = currencyMeta.code;
      window.__appCurrencySymbol   = currencyMeta.symbol;
      window.__appCurrencyLocale   = currencyMeta.locale;
    } catch {
      window.__appShortcutsEnabled = true;
      window.__appTooltips         = true;
      window.__appConfirmDelete    = true;
      window.__appCensorAmounts    = false;
      window.__appTxPerPage        = 10;
      window.__appShowCents        = false;
      window.__appCategoryViewMode = 'compact';
      window.__appCurrency         = 'DOP';
      window.__appCurrencySymbol   = 'RD$';
      window.__appCurrencyLocale   = 'es-DO';
    }
  }

  /**
   * Clave compartida para persistencia de filtros entre páginas.
   */
  static SHARED_FILTERS_KEY = 'finanzapp:shared_filters:v1';

  /**
   * Carga los filtros compartidos desde localStorage.
   * @returns {{ year: number|null, month: number|null, searchTerm: string, category: string|null }}
   */
  static loadSharedFilters() {
    try {
      const raw = localStorage.getItem(Helpers.SHARED_FILTERS_KEY);
      if (!raw) return { year: null, month: null, searchTerm: '', category: null };
      const parsed = JSON.parse(raw);
      const yr = (parsed.year !== null && parsed.year !== undefined && parsed.year !== '') ? parseInt(parsed.year, 10) : null;
      const mo = (parsed.month !== null && parsed.month !== undefined && parsed.month !== '') ? parseInt(parsed.month, 10) : null;
      return {
        year: (yr !== null && !isNaN(yr)) ? yr : null,
        month: (mo !== null && !isNaN(mo) && mo >= 0 && mo <= 11) ? mo : null,
        searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : '',
        category: (parsed.category !== null && parsed.category !== undefined && parsed.category !== '') ? String(parsed.category) : null
      };
    } catch {
      return { year: null, month: null, searchTerm: '', category: null };
    }
  }

  /**
   * Guarda los filtros compartidos en localStorage de manera atómica.
   * @param {Partial<{ year: number|null, month: number|null, searchTerm: string, category: string|null }>} filters
   */
  static saveSharedFilters(filters) {
    try {
      const current = Helpers.loadSharedFilters();
      const updated = {
        year: filters.year !== undefined ? filters.year : current.year,
        month: filters.month !== undefined ? filters.month : current.month,
        searchTerm: filters.searchTerm !== undefined ? filters.searchTerm : current.searchTerm,
        category: filters.category !== undefined ? filters.category : current.category
      };
      localStorage.setItem(Helpers.SHARED_FILTERS_KEY, JSON.stringify(updated));
    } catch {}
  }
}

Helpers.applyAppSettings();

window.Core = window.Core || {};

/**
 * API pública de Helpers expuesta en `window.Core.helpers`.
 * Mantiene compatibilidad con el código existente que usa `window.Core.helpers.xxx()`.
 * @namespace
 */
window.Core.helpers = {
  esc:                          (...a) => Helpers.esc(...a),
  formatCurrency:               (...a) => Helpers.formatCurrency(...a),
  formatCurrencyStrict:         (...a) => Helpers.formatCurrencyStrict(...a),
  getCurrencyMeta:              ()     => Helpers.getCurrencyMeta(),
  formatInputAmount:            (...a) => Helpers.formatInputAmount(...a),
  hasMultipleDecimalSeparators: (...a) => Helpers.hasMultipleDecimalSeparators(...a),
  hasTooManyFractionDigits:     (...a) => Helpers.hasTooManyFractionDigits(...a),
  sanitizeAmount:               (...a) => Helpers.sanitizeAmount(...a),
  isValidAmount:                (...a) => Helpers.isValidAmount(...a),
  validateDate:                 (...a) => Helpers.validateDate(...a),
  formatDate:                   (...a) => Helpers.formatDate(...a),
  formatDateForInput:           (...a) => Helpers.formatDateForInput(...a),
  loadSharedFilters:            ()     => Helpers.loadSharedFilters(),
  saveSharedFilters:            (...a) => Helpers.saveSharedFilters(...a)
};