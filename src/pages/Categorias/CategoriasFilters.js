/**
 * @fileoverview Módulo de gestión y aplicación de filtros para Categorías.
 *
 * Centraliza la lógica de filtrado por año, mes, término de búsqueda y
 * ordenamiento para aligerar Categorias.js y facilitar pruebas automatizadas.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasFilters = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const STORAGE_FILTROS_KEY = 'finanzapp:filters:categorias:v1';

  /**
   * Carga los filtros persistidos desde localStorage.
   * @returns {{ year: number|null, month: number|null, searchTerm: string }}
   */
  function cargarFiltrosPersistidos() {
    try {
      if (typeof localStorage === 'undefined') return { year: null, month: null, searchTerm: '' };
      const raw = localStorage.getItem(STORAGE_FILTROS_KEY);
      if (!raw) return { year: null, month: null, searchTerm: '' };
      const parsed = JSON.parse(raw);
      const yr = (parsed.year !== null && parsed.year !== undefined && parsed.year !== '') ? parseInt(parsed.year, 10) : null;
      const mo = (parsed.month !== null && parsed.month !== undefined && parsed.month !== '') ? parseInt(parsed.month, 10) : null;
      return {
        year: (yr !== null && !isNaN(yr)) ? yr : null,
        month: (mo !== null && !isNaN(mo) && mo >= 0 && mo <= 11) ? mo : null,
        searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : ''
      };
    } catch {
      return { year: null, month: null, searchTerm: '' };
    }
  }

  /**
   * Guarda los filtros actuales en localStorage.
   * @param {{ year: number|null, month: number|null, searchTerm: string }} filtros
   */
  function guardarFiltrosPersistidos(filtros) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_FILTROS_KEY, JSON.stringify({
        year: filtros.year !== undefined ? filtros.year : null,
        month: filtros.month !== undefined ? filtros.month : null,
        searchTerm: filtros.searchTerm || ''
      }));
    } catch {}
  }

  /**
   * Carga el estado de ordenamiento persistido para fecha y monto.
   * @returns {{ sortFecha: Object, sortMonto: Object }}
   */
  function cargarSortPersistido() {
    try {
      if (typeof localStorage === 'undefined') return { sortFecha: {}, sortMonto: {} };
      const sf = JSON.parse(localStorage.getItem('sort_fecha') || '{}');
      const sm = JSON.parse(localStorage.getItem('sort_monto') || '{}');
      return { sortFecha: sf, sortMonto: sm };
    } catch {
      return { sortFecha: {}, sortMonto: {} };
    }
  }

  /**
   * Guarda el ordenamiento de categorías en localStorage.
   * @param {Map|Object} sortFecha
   * @param {Map|Object} sortMonto
   */
  function guardarSortPersistido(sortFecha, sortMonto) {
    try {
      if (typeof localStorage === 'undefined') return;
      const sfObj = sortFecha instanceof Map ? Object.fromEntries(sortFecha) : (sortFecha || {});
      const smObj = sortMonto instanceof Map ? Object.fromEntries(sortMonto) : (sortMonto || {});
      localStorage.setItem('sort_fecha', JSON.stringify(sfObj));
      localStorage.setItem('sort_monto', JSON.stringify(smObj));
    } catch {}
  }

  /**
   * Actualiza los estilos visuales de los filtros en la interfaz de usuario.
   * @param {{ year: number|null, month: number|null, searchTerm: string }} filtros
   */
  function actualizarIndicadorFiltros(filtros) {
    if (typeof document === 'undefined') return;
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const hayAnio = filtros.year !== null;
    const hayMes = filtros.month !== null;
    const hayBusqueda = !!(filtros.searchTerm && filtros.searchTerm.trim());

    if (yearFilter) yearFilter.classList.toggle('filter-active', hayAnio);
    if (monthFilter) monthFilter.classList.toggle('filter-active', hayMes);
    if (clearBtn) clearBtn.classList.toggle('filter-active', hayAnio || hayMes || hayBusqueda);
  }

  /**
   * Genera las opciones del dropdown de año.
   * @param {{ year: number|null }} filtros
   */
  function generarOpcionesAnio(filtros) {
    if (typeof document === 'undefined') return;
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');

    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const endYear = Math.max(startYear, currentYear);

    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement('div');
      const isSelected = filtros.year === year;
      option.className = `custom-dropdown-option ${isSelected ? 'selected' : ''}`;
      option.setAttribute('data-value', String(year));
      option.textContent = String(year);
      optionsContainer.appendChild(option);
    }

    const selectedElement = yearFilter.querySelector('.custom-dropdown-selected');
    if (selectedElement) {
      if (filtros.year !== null) {
        selectedElement.querySelector('span').textContent = String(filtros.year);
        selectedElement.setAttribute('data-value', String(filtros.year));
      } else {
        selectedElement.querySelector('span').textContent = 'Todos los años';
        selectedElement.setAttribute('data-value', '');
      }
    }
    actualizarIndicadorFiltros(filtros);
  }

  /**
   * Genera una clave única de caché para un estado de filtros.
   * @param {{ year: number|null, month: number|null, searchTerm: string }} f
   * @returns {string}
   */
  function claveFiltros(f) {
    return `${f?.year ?? ''}|${f?.month ?? ''}|${(f?.searchTerm || '').trim().toLowerCase()}`;
  }

  /**
   * Filtra un arreglo de transacciones según año, mes y término de búsqueda.
   * @param {Array} transactions
   * @param {{ year: number|null, month: number|null, searchTerm: string }} filtros
   * @param {Function} [formatCurrencyFn]
   * @returns {Array}
   */
  function filtrarTransaccionesPorFecha(transactions, filtros, formatCurrencyFn) {
    if (!transactions || !Array.isArray(transactions)) return [];
    if (!filtros) return transactions;

    const formatFn = formatCurrencyFn || (typeof window !== 'undefined' && window.Core?.helpers?.formatCurrency) || ((n) => `$${Number(n).toFixed(2)}`);

    return transactions.filter(transaction => {
      const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);

      if (filtros.year !== null && transactionDate.getFullYear() !== filtros.year) {
        return false;
      }

      if (filtros.month !== null && transactionDate.getMonth() !== filtros.month) {
        return false;
      }

      if (filtros.searchTerm && filtros.searchTerm.trim() !== '') {
        const searchTerm = filtros.searchTerm.toLowerCase().trim();
        const description = (transaction.description || '').toLowerCase();

        const amount = formatFn(Math.abs(transaction.amount));
        const amountWithComma = amount.replace('.', ',');

        const searchTermClean = searchTerm.replace(/[$,]/g, '');
        const isNumericSearch = !isNaN(parseFloat(searchTermClean)) && isFinite(parseFloat(searchTermClean));

        let matchesAmount = false;
        if (isNumericSearch) {
          const searchAmount = parseFloat(searchTermClean);
          matchesAmount = Math.abs(Math.abs(transaction.amount) - searchAmount) < 0.01;
        }

        const textMatchesAmount = amount.includes(searchTermClean) ||
          amountWithComma.includes(searchTermClean) ||
          amount.toLowerCase().includes(searchTerm) ||
          amount.replace(/[$,]/g, '').toLowerCase().includes(searchTermClean);

        matchesAmount = matchesAmount || textMatchesAmount;

        const typeText = transaction.type === 'income' ? 'ingreso' : 'gasto';
        const matchesType = typeText.includes(searchTerm);

        if (!description.includes(searchTerm) && !matchesAmount && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Aplica los filtros actuales a todas las categorías dadas.
   * @param {Array} categories
   * @param {{ year: number|null, month: number|null, searchTerm: string }} filtros
   * @param {Function} [formatCurrencyFn]
   * @returns {Array}
   */
  function aplicarFiltrosACategorias(categories, filtros, formatCurrencyFn) {
    if (!Array.isArray(categories)) return [];
    return categories.map(category => ({
      ...category,
      transactions: filtrarTransaccionesPorFecha(category.transactions, filtros, formatCurrencyFn)
    }));
  }

  const CategoriasFilters = {
    STORAGE_FILTROS_KEY,
    cargarFiltrosPersistidos,
    guardarFiltrosPersistidos,
    cargarSortPersistido,
    guardarSortPersistido,
    actualizarIndicadorFiltros,
    generarOpcionesAnio,
    claveFiltros,
    filtrarTransaccionesPorFecha,
    aplicarFiltrosACategorias
  };

  if (typeof window !== 'undefined') window.CategoriasFilters = CategoriasFilters;
  if (typeof globalThis !== 'undefined') globalThis.CategoriasFilters = CategoriasFilters;

  return CategoriasFilters;
});

