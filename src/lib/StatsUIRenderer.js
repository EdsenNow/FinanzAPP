/**
 * StatsUIRenderer / RenderizadorUI — Actualizaciones del DOM compartidas entre
 * Dashboard y Estadísticas: tarjetas de resumen, KPIs diarios, insights y utilidades
 * de formato.
 */
class StatsUIRenderer {
  constructor() {
    /** Formateadores de número reutilizables, indexados por caso de uso. */
    this.formatters = {
      currency: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currencyChart: new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      currencyDetailed: new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      percent: new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      compact: new Intl.NumberFormat('es-ES', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 })
    };
  }

  /**
   * Asigna `textContent` al elemento con el ID indicado.
   * No hace nada si el elemento no existe.
   * @param {string} id    - ID del elemento destino.
   * @param {string} texto - Texto a mostrar.
   */
  _setTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  }

  /**
   * Formatea un importe con separadores europeos (`.` miles, `,` decimales).
   * Soporta valores negativos.
   * @param {number} amount
   * @returns {string}
   */
  formatearMonedaTarjeta(amount) {
    let n = Number(amount) || 0;
    const negative = n < 0;
    if (negative) n = Math.abs(n);
    const hasFraction = !Number.isInteger(n);
    const fixed = n.toFixed(hasFraction ? 2 : 0);
    let [intPart, fracPart = ''] = fixed.split('.');
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const result = hasFraction ? `${intPart},${fracPart}` : intPart;
    return negative ? '-' + result : result;
  }

  /**
   * Desvanece el elemento, actualiza su texto y lo vuelve a mostrar.
   * @param {HTMLElement|null} element - Elemento DOM destino.
   * @param {string} value - Texto a mostrar.
   */
  animarValor(element, value) {
    if (!element) return;
    element.style.opacity = '0';
    setTimeout(() => { element.textContent = value; element.style.opacity = '1'; }, 150);
  }

  /**
   * Conserva la etiqueta del elemento (de `data-label` o su texto actual) y renderiza
   * la etiqueta junto con el importe formateado, con animación de fundido.
   * @param {string} elementId    - ID del elemento destino.
   * @param {string} defaultLabel - Etiqueta de respaldo si no hay ninguna guardada.
   * @param {number} amount       - Importe a formatear y mostrar.
   */
  establecerValorConEtiqueta(elementId, defaultLabel, amount) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const label = (element.getAttribute('data-label') || (element.textContent.split(':')[0] || defaultLabel)).trim();
    element.setAttribute('data-label', label);
    element.style.opacity = '0';
    setTimeout(() => {
      element.textContent = `${label}: $${this.formatearMonedaTarjeta(amount)}`;
      element.style.opacity = '1';
    }, 150);
  }

  /**
   * Renderiza las tarjetas de resumen (ingresos, gastos, balance, conteo y promedios mensuales)
   * para el conjunto de transacciones dado.
   * @param {Array} transacciones - Arreglo plano de transacciones.
   */
  renderizarResumen(transacciones) {
    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
    let ingresos = 0;
    let gastos = 0;
    transacciones.forEach(tx => { if (tx.type === 'income') ingresos += tx.amount; else gastos += tx.amount; });
    const balance = ingresos - gastos;
    const meses = (() => {
      const set = new Set(transacciones.map(tx => (tx.date instanceof Date ? tx.date : new Date(tx.date)).getMonth()));
      return Math.max(1, set.size);
    })();

    this.animarValor(document.getElementById('sumIncome'), '$' + this.formatearMonedaTarjeta(ingresos));
    this.animarValor(document.getElementById('sumExpenses'), '$' + this.formatearMonedaTarjeta(gastos));
    this.animarValor(document.getElementById('sumBalance'), '$' + this.formatearMonedaTarjeta(balance));
    this.animarValor(document.getElementById('txCount'), String(transacciones.length));

    this.establecerValorConEtiqueta('avgIncome', 'Promedio mensual', ingresos / meses);
    this.establecerValorConEtiqueta('avgExpenses', 'Promedio mensual', gastos / meses);
    this.establecerValorConEtiqueta('avgBalance', 'Promedio mensual', balance / meses);
    const ticket = transacciones.length ? (ingresos + gastos) / transacciones.length : 0;
    this.establecerValorConEtiqueta('avgTicket', 'Ticket promedio', ticket);
  }

  /**
   * Actualiza los KPIs diarios (ingresos de hoy, gastos de hoy, promedio diario).
   * @param {{ incomeToday: number, expensesToday: number, avgDaily: number }} stats
   */
  renderizarKPIsDiarios(stats) {
    const { incomeToday, expensesToday, avgDaily } = stats;
    this._setTexto('dailyIncome',   '$' + this.formatearMonedaTarjeta(incomeToday));
    this._setTexto('dailyExpenses', '$' + this.formatearMonedaTarjeta(expensesToday));
    this._setTexto('dailyAverage',  '$' + this.formatearMonedaTarjeta(avgDaily));
  }

  /**
   * Rellena las tarjetas de insights con la categoría top, el mejor mes y la tasa de ahorro.
   * @param {object} info - Objeto de datos de insights proveniente del controlador.
   */
  actualizarInsights(info) {
    const { topCategory, topCategoryPercent, bestMonthLabel, bestMonthNet, savingsRate, savings, totalIncome } = info;
    if (topCategory) {
      this._setTexto('insightTopCategoryValue',  '$' + this.formatearMonedaTarjeta(topCategory.amount));
      this._setTexto('insightTopCategoryDetail', `${topCategory.name} · ${topCategoryPercent.toFixed(1)}% del gasto`);
    } else {
      this._setTexto('insightTopCategoryValue',  '—');
      this._setTexto('insightTopCategoryDetail', 'Aun no hay gastos registrados en este periodo.');
    }
    if (bestMonthLabel) {
      const balanceLabel = `${bestMonthNet >= 0 ? '+' : '−'}$${this.formatearMonedaTarjeta(Math.abs(bestMonthNet))}`;
      this._setTexto('insightBestMonthValue',  bestMonthLabel);
      this._setTexto('insightBestMonthDetail', `Balance neto: ${balanceLabel}`);
    } else {
      this._setTexto('insightBestMonthValue',  'Sin datos');
      this._setTexto('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    }
    if (totalIncome > 0) {
      const savingsPercent = this.formatters.percent.format(savingsRate);
      const savingsLabel = savings >= 0
        ? `Reservaste $${this.formatearMonedaTarjeta(savings)} de tus ingresos.`
        : `Deficit de $${this.formatearMonedaTarjeta(Math.abs(savings))}.`;
      this._setTexto('insightSavingsValue',  savingsPercent);
      this._setTexto('insightSavingsDetail', savingsLabel);
    } else {
      this._setTexto('insightSavingsValue',  '—');
      this._setTexto('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');
    }
  }

  /** Añade clases de carga esqueleto a las secciones de resumen, insights, gráficos y tablas. */
  mostrarEsqueletos() {
    document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid, .table-wrapper').forEach(el => {
      el.classList.remove('loaded');
    });
    ['sumIncome', 'sumExpenses', 'sumBalance', 'txCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('skeleton', 'skeleton-value'); el.textContent = ''; }
    });
    ['avgIncome', 'avgExpenses', 'avgBalance', 'avgTicket'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('skeleton', 'skeleton-full'); el.textContent = ''; }
    });
    document.querySelectorAll('.chart-container').forEach(el => el.classList.add('chart-loading'));
    document.querySelectorAll('.stats-insights .card-value').forEach(el => { el.classList.add('skeleton', 'skeleton-value'); el.textContent = ''; });
    document.querySelectorAll('.stats-insights .card-change').forEach(el => { el.classList.add('skeleton', 'skeleton-full'); el.textContent = ''; });
  }

  /** Elimina todas las clases esqueleto y marca las secciones como completamente cargadas. */
  ocultarEsqueletos() {
    document.querySelectorAll('.skeleton').forEach(el => {
      el.classList.remove('skeleton', 'skeleton-value', 'skeleton-text', 'skeleton-insight', 'skeleton-full');
    });
    document.querySelectorAll('.chart-container').forEach(el => el.classList.remove('chart-loading'));
    setTimeout(() => {
      document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid, .table-wrapper').forEach(el => {
        el.classList.add('loaded');
      });
    }, 50);
  }
}

window.RenderizadorUI = StatsUIRenderer;
window.UIRenderer = StatsUIRenderer;
