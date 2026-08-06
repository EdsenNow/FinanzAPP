class RenderizadorUI {
  constructor() {
    this.formatters = {
      currency: new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      currencyChart: new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      currencyDetailed: new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      percent: new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
      compact: new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
      })
    };
  }

  formatearMonedaTarjeta(amount) {
    let n = Number(amount) || 0;
    const negative = n < 0;
    if (negative) n = Math.abs(n);
    const hasFraction = !Number.isInteger(n);
    const fixed = n.toFixed(hasFraction ? 2 : 0);
    let [intPart, fracPart = ''] = fixed.split('.');
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let result = hasFraction ? `${intPart}.${fracPart}` : intPart;
    if (negative) result = '-' + result;
    return result;
  }

  animarValor(element, value) {
    if (element) {
      element.style.opacity = '0';
      setTimeout(() => {
        element.textContent = value;
        element.style.opacity = '1';
      }, 150);
    }
  }

  establecerValorConEtiqueta(elementId, defaultLabel, amount) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const label = (element.getAttribute('data-label') || 
                   (element.textContent.split(':')[0] || defaultLabel)).trim();
    element.setAttribute('data-label', label);
    element.style.opacity = '0';
    setTimeout(() => {
      element.textContent = `${label}: $${this.formatearMonedaTarjeta(amount)}`;
      element.style.opacity = '1';
    }, 150);
  }

  renderizarResumen(transactions) {
    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
    
    let income = 0;
    let expenses = 0;
    transactions.forEach(tx => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else {
        expenses += tx.amount;
      }
    });
    
    const balance = income - expenses;
    const monthsCovered = (function() {
      const set = new Set(transactions.map(tx => 
        (tx.date instanceof Date ? tx.date : new Date(tx.date)).getMonth()
      ));
      return Math.max(1, set.size);
    })();

    this.animarValor(document.getElementById('sumIncome'), '$' + this.formatearMonedaTarjeta(income));
    this.animarValor(document.getElementById('sumExpenses'), '$' + this.formatearMonedaTarjeta(expenses));
    this.animarValor(document.getElementById('sumBalance'), '$' + this.formatearMonedaTarjeta(balance));
    this.animarValor(document.getElementById('txCount'), String(transactions.length));

    this.establecerValorConEtiqueta('avgIncome', 'Promedio mensual', income / monthsCovered);
    this.establecerValorConEtiqueta('avgExpenses', 'Promedio mensual', expenses / monthsCovered);
    this.establecerValorConEtiqueta('avgBalance', 'Promedio mensual', balance / monthsCovered);

    const ticket = transactions.length ? (income + expenses) / transactions.length : 0;
    this.establecerValorConEtiqueta('avgTicket', 'Ticket promedio', ticket);
  }

  renderizarKPIsDiarios(stats) {
    const { incomeToday, expensesToday, avgDaily } = stats;
    const setElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    
    setElement('dailyIncome', '$' + this.formatearMonedaTarjeta(incomeToday));
    setElement('dailyExpenses', '$' + this.formatearMonedaTarjeta(expensesToday));
    setElement('dailyAverage', '$' + this.formatearMonedaTarjeta(avgDaily));
  }

  actualizarInsights(info) {
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };

    const {
      topCategory,
      topCategoryPercent,
      bestMonthLabel,
      bestMonthNet,
      savingsRate,
      savings,
      totalIncome
    } = info;

    if (topCategory) {
      setText('insightTopCategoryValue', '$' + this.formatearMonedaTarjeta(topCategory.amount));
      setText('insightTopCategoryDetail', `${topCategory.name} · ${topCategoryPercent.toFixed(1)}% del gasto`);
    } else {
      setText('insightTopCategoryValue', '—');
      setText('insightTopCategoryDetail', 'Aún no hay gastos registrados en este periodo.');
    }

    if (bestMonthLabel) {
      const balanceLabel = `${bestMonthNet >= 0 ? '+' : '−'}$${this.formatearMonedaTarjeta(Math.abs(bestMonthNet))}`;
      setText('insightBestMonthValue', bestMonthLabel);
      setText('insightBestMonthDetail', `Balance neto: ${balanceLabel}`);
    } else {
      setText('insightBestMonthValue', 'Sin datos');
      setText('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    }

    if (totalIncome > 0) {
      const savingsPercent = this.formatters.percent.format(savingsRate);
      const savingsLabel = savings >= 0
        ? `Reservaste $${this.formatearMonedaTarjeta(savings)} de tus ingresos.`
        : `Déficit de $${this.formatearMonedaTarjeta(Math.abs(savings))}.`;
      setText('insightSavingsValue', savingsPercent);
      setText('insightSavingsDetail', savingsLabel);
    } else {
      setText('insightSavingsValue', '—');
      setText('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');
    }
  }

  mostrarEsqueletos() {
    document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid, .table-wrapper').forEach(el => {
      el.classList.remove('loaded');
    });
    
    ['sumIncome', 'sumExpenses', 'sumBalance', 'txCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton', 'skeleton-value');
        el.textContent = '';
      }
    });
    
    ['avgIncome', 'avgExpenses', 'avgBalance', 'avgTicket'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton', 'skeleton-full');
        el.textContent = '';
      }
    });
    
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
      container.classList.add('chart-loading');
    });
    
    document.querySelectorAll('.stats-insights .card-value').forEach(el => {
      el.classList.add('skeleton', 'skeleton-value');
      el.textContent = '';
    });
    document.querySelectorAll('.stats-insights .card-change').forEach(el => {
      el.classList.add('skeleton', 'skeleton-full');
      el.textContent = '';
    });
  }

  ocultarEsqueletos() {
    document.querySelectorAll('.skeleton').forEach(el => {
      el.classList.remove('skeleton', 'skeleton-value', 'skeleton-text', 'skeleton-insight', 'skeleton-full');
    });
    
    document.querySelectorAll('.chart-container').forEach(container => {
      container.classList.remove('chart-loading');
    });
    
    setTimeout(() => {
      document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid, .table-wrapper').forEach(el => {
        el.classList.add('loaded');
      });
    }, 50);
  }
}

window.RenderizadorUI = RenderizadorUI;
window.UIRenderer = RenderizadorUI;
