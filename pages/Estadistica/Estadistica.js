/**
 * @fileoverview Página de Estadísticas de FinanzApp.
 *
 * Muestra análisis visual de ingresos y gastos mediante gráficos y métricas
 * resumen. Incluye filtros por periodo, soporte de exportación y
 * actualización reactiva ante cambios de datos en tiempo real.
 *
 * @module Estadistica
 */
(function(){
if (typeof window !== 'undefined' && window.sidebarRenderer) {
  window.sidebarRenderer.render('estadistica');
}

// Actualizar perfil del invitado si tiene el formato antiguo
(function actualizarPerfilInvitado() {
  try {
    const authUser = localStorage.getItem('authUser');
    if (authUser && authUser !== 'guest') {
      const profile = JSON.parse(authUser);
      if (profile.provider === 'guest' && 
          (profile.email === 'invitado@finanzapp.com' || profile.name === 'Usuario Invitado')) {
        profile.name = 'Invitado';
        profile.email = '';
        localStorage.setItem('authUser', JSON.stringify(profile));
        window.location.reload();
      }
    }
  } catch (e) {
    console.error('Error al actualizar perfil del invitado:', e);
  }
})();

function getCurrencyMeta() {
  if (window.Core?.helpers?.getCurrencyMeta) {
    return window.Core.helpers.getCurrencyMeta();
  }

  return { locale: 'en-US', symbol: '$', currency: 'USD' };
}

const APP_CURRENCY = getCurrencyMeta();

function formatCurrencyCard(amount) {
  if (window.Core?.helpers?.formatCurrency) {
    return window.Core.helpers.formatCurrency(amount);
  }

  const n = Number(amount) || 0;
  return new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
    style: 'currency',
    currency: APP_CURRENCY.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}



const CHART_CURRENCY_FORMATTER = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const CHART_CURRENCY_DETAILED = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const CHART_PERCENT_FORMATTER = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function getThemeColor(variableName, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
    return value?.trim() || fallback;
  } catch (error) {
    return fallback;
  }
}

function colorWithAlpha(color, alpha = 1) {
  if (!color) return `rgba(255, 255, 255, ${alpha})`;
  const value = color.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map(part => Number(part.trim()));
    const [r = 255, g = 255, b = 255] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return value;
}
  const { esc } = window.Core.helpers;
  const { createFirestoreStore } = window.Core.storeFactories;
  const store = createFirestoreStore();

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let state = { categories: [], monthlyData: { labels: MONTHS, income: Array(12).fill(0), expenses: Array(12).fill(0) }, user: { name: 'Usuario', email: '' } };
  let chartCashflowArea,
      chartIncomeByCategory,
      chartExpenseByCategory,
      chartIncomeByDay,
      chartSavingsGauge,
      chartRadar,
      chartHeatmap;

  function obtenerRangoAnios() {
    const now = new Date().getFullYear();
    const start = 2025;
    return { start, end: Math.max(now, start) };
  }

  function crearDatosPrueba() {
    return {
      categories: [
        {
          id: "test_salary",
          name: "Salario",
          fixedType: "income",
          transactions: [
            {
              id: "tx_001",
              type: "income",
              amount: 45000,
              description: "Salario enero",
              date: "2025-01-15T00:00:00.000Z"
            },
            {
              id: "tx_002",
              type: "income",
              amount: 45000,
              description: "Salario febrero",
              date: "2025-02-15T00:00:00.000Z"
            }
          ]
        },
        {
          id: "test_food",
          name: "Comida",
          fixedType: "expense",
          transactions: [
            {
              id: "tx_003",
              type: "expense",
              amount: 15000,
              description: "Supermercado",
              date: "2025-01-10T00:00:00.000Z"
            },
            {
              id: "tx_004",
              type: "expense",
              amount: 12000,
              description: "Restaurante",
              date: "2025-01-15T00:00:00.000Z"
            }
          ]
        },
        {
          id: "test_transport",
          name: "Transporte",
          fixedType: "expense",
          transactions: [
            {
              id: "tx_005",
              type: "expense",
              amount: 8000,
              description: "Gasolina",
              date: "2025-01-12T00:00:00.000Z"
            }
          ]
        }
      ]
    };
  }

  

  async function cargarDatos() {
    const saved = await store.load();

    if (saved && saved.categories && saved.categories.length > 0) {
      state = {
        categories: saved.categories || [],
        monthlyData: saved.monthlyData || { 
          labels: MONTHS, 
          income: Array(12).fill(0), 
          expenses: Array(12).fill(0) 
        },
        user: saved.user || { name: 'Usuario', email: '' }
      };
      
      state.categories = (state.categories||[]).map(c => ({
        ...c,
        transactions: (c.transactions||[]).map(t => ({
          ...t, 
          date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
        }))
      }));
      
      let totalTx = 0;
      state.categories.forEach(cat => {
        if (cat.transactions) {
          totalTx += cat.transactions.length;
        }
      });
      if (totalTx === 0) {
      }
      
    } else {
      state = { 
        categories: [], 
        monthlyData: { 
          labels: MONTHS, 
          income: Array(12).fill(0), 
          expenses: Array(12).fill(0) 
        }, 
        user: { name: 'Usuario', email: '' } 
      };
    }
  }

  function aplicarConfiguracionTema() {
    if (!window.Chart) return;

    const defaults = window.Chart.defaults || Chart.defaults;
    const esTemaOscuro = window.themeManager?.currentTheme === 'dark' ||
                         localStorage.getItem('theme') === 'dark';

    defaults.color = esTemaOscuro ? '#E0E0E0' : '#333333';
    defaults.borderColor = esTemaOscuro ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    if (defaults.plugins?.legend?.labels) {
      defaults.plugins.legend.labels.color = esTemaOscuro ? '#E0E0E0' : '#333333';
    }

    defaults.font = defaults.font || {};
    defaults.font.family = "'Inter', sans-serif";
    defaults.font.size = 11;

    const escalas = defaults.scales || (defaults.scales = {});
    const grilla = escalas.grid || (escalas.grid = {});
    grilla.color = 'rgba(110, 106, 134, 0.2)';
    grilla.borderColor = 'rgba(110, 106, 134, 0.2)';
    grilla.drawBorder = true;
    grilla.drawOnChartArea = true;
    grilla.drawTicks = false;
    grilla.lineWidth = 1;
  }

  function mostrarEsqueletos() {
    document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid').forEach(el => {
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

    document.querySelectorAll('.chart-container').forEach(container => {
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

  function ocultarEsqueletos() {
    document.querySelectorAll('.skeleton').forEach(el => {
      el.classList.remove('skeleton', 'skeleton-value', 'skeleton-text', 'skeleton-insight');
    });

    document.querySelectorAll('.chart-container').forEach(container => {
      container.classList.remove('chart-loading');
    });

    setTimeout(() => {
      document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid').forEach(el => {
        el.classList.add('loaded');
      });
    }, 50);
  }

  function poblarPerfilSidebar() {
    try {
      const raw = localStorage.getItem('authUser');
      const profile = raw && raw !== 'guest' ? JSON.parse(raw) : { name: 'Invitado', email: '', picture: '' };
      const nameEl = document.querySelector('.user-name');
      const emailEl = document.querySelector('.user-email');
      const avatarEl = document.querySelector('.user-avatar');
      if (nameEl) {
        const displayName = profile.name || 'Usuario';
        nameEl.textContent = displayName;
        nameEl.setAttribute('aria-label', displayName);
      }
      if (emailEl) {
        const displayEmail = profile.email || '';
        emailEl.textContent = displayEmail;
        if (displayEmail) {
          emailEl.setAttribute('aria-label', displayEmail);
          emailEl.style.display = 'block';
        } else {
          emailEl.removeAttribute('aria-label');
          emailEl.style.display = 'none';
        }
      }
      if (avatarEl) {
        avatarEl.innerHTML = '';
        if (profile.picture) {
          const img = document.createElement('img');
          img.src = profile.picture; img.alt = profile.name || 'Usuario';
          avatarEl.appendChild(img);
        } else {
          avatarEl.textContent = (profile.name||'U').trim().charAt(0).toUpperCase();
        }
      }
    } catch {}
  }

  function inicializarTooltipPerfil() {
    const userInfo = document.getElementById('userInfoHover');
    const tooltip = document.getElementById('profileTooltip');
    const tooltipName = tooltip?.querySelector('.tooltip-name');
    const tooltipEmail = tooltip?.querySelector('.tooltip-email');
    
    if (!userInfo || !tooltip) return;
    
    let hideTimeout;
    
    function showTooltip() {
      clearTimeout(hideTimeout);
      
      const raw = localStorage.getItem('authUser');
      const profile = raw && raw !== 'guest' ? JSON.parse(raw) : { name: 'Invitado', email: '' };
      
      if (tooltipName) tooltipName.textContent = profile.name || 'Usuario';
      if (tooltipEmail) {
        tooltipEmail.textContent = profile.email || '';
        tooltipEmail.style.display = (profile.email && profile.email !== '') ? 'block' : 'none';
      }
      
      tooltip.classList.add('show');
    }
    
    function hideTooltip() {
      hideTimeout = setTimeout(() => {
        tooltip.classList.remove('show');
      }, 200);
    }
    
    userInfo.addEventListener('mouseenter', showTooltip);
    userInfo.addEventListener('mouseleave', hideTooltip);
    tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    tooltip.addEventListener('mouseleave', hideTooltip);
  }

  function configurarEventosComunes() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', async () => {
      const confirmed = await (typeof window.showAlert === 'function'
        ? window.showAlert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', { variant: 'confirm', emphasis: 'danger' })
        : Promise.resolve(window.confirm('¿Estás seguro de que deseas cerrar sesión?') ? 'confirm' : 'cancel'));
      if (confirmed !== 'confirm') return;
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('authUser');
      window.location.href = '/pages/Login/Login.html';
    });

    const btn = document.getElementById('themeToggle');
    const root = document.documentElement;
    const body = document.body;
    
    const apply = (t) => {
      if (t === 'light') {
        root.setAttribute('data-theme', 'light');
        body.setAttribute('data-theme', 'light');
      } else {
        root.setAttribute('data-theme', 'dark');
        body.setAttribute('data-theme', 'dark');
      }
      localStorage.setItem('theme', t);
      
      const icon = btn?.querySelector('i');
      if (icon) icon.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
      
      renderizarTodo();
    };
    
    const stored = localStorage.getItem('theme');
    apply(stored === 'light' ? 'light' : 'dark');
    
    if (btn) {
      btn.addEventListener('click', () => {
        const current = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
        apply(current === 'light' ? 'dark' : 'light');
      });
    }
  }


  function generarOpcionesAnio(){
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';
    const all = document.createElement('div');
    all.className = 'custom-dropdown-option';
    all.setAttribute('data-value','');
    all.textContent = 'Todos los años';
    optionsContainer.appendChild(all);
    const { start, end } = obtenerRangoAnios();
    for (let y = start; y <= end; y++){
      const opt = document.createElement('div');
      opt.className = 'custom-dropdown-option';
      opt.setAttribute('data-value', String(y));
      opt.textContent = String(y);
      optionsContainer.appendChild(opt);
    }
    const selected = yearFilter.querySelector('.custom-dropdown-selected');
    if (selected){ selected.querySelector('span').textContent = 'Todos los años'; selected.setAttribute('data-value',''); }
  }

  function obtenerFiltros() {
    const ySel = document.getElementById('yearFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
    const mSel = document.getElementById('monthFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
    return { year: ySel===''?null:parseInt(ySel,10), month: mSel===''?null:parseInt(mSel,10) };
  }

  function filtrarTransacciones() {
    const { year, month } = obtenerFiltros();
    const tx = [];
    state.categories.forEach(c => {
      const catTx = c.transactions || [];
      catTx.forEach(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        if (Number.isNaN(d.getTime())) {
          return;
        }
        if (year != null && d.getFullYear() !== year) return;
        if (month != null && d.getMonth() !== month) return;
        tx.push({ ...t, category: c.name });
      });
    });
    return tx;
  }

  function calcularMensual(tx) {
    const inc = Array(12).fill(0), exp = Array(12).fill(0);
    tx.forEach(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const m = d.getMonth();
      if (t.type === 'income') inc[m] += t.amount; else exp[m] += t.amount;
    });
    return { inc, exp };
  }

  function calcularAcumulado(inc, exp) {
    const cum = [];
    let s = 0;
    for (let i=0;i<12;i++) { s += (inc[i] - exp[i]); cum.push(s); }
    return cum;
  }

  function calcularDivisionCategorias(tx) {
    const mapExp = new Map();
    const mapInc = new Map();
    tx.forEach(t => {
      const map = t.type === 'income' ? mapInc : mapExp;
      map.set(t.category, (map.get(t.category)||0) + t.amount);
    });
    const toArr = (m) => Array.from(m.entries()).map(([name, amount]) => ({name, amount}))
      .sort((a,b)=>b.amount-a.amount);
    return { expenses: toArr(mapExp), income: toArr(mapInc) };
  }

  

  function renderizarResumen(tx){
    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
    
    let inc=0, exp=0; tx.forEach(t => t.type==='income' ? inc+=t.amount : exp+=t.amount);
    const bal = inc - exp;
    const monthsCovered = (function(){
      const set = new Set(tx.map(t => (t.date instanceof Date ? t.date : new Date(t.date)).getMonth()));
      return Math.max(1, set.size);
    })();
    const el = (id) => document.getElementById(id);
    
    const animateValue = (element, value) => {
      if (element) {
        element.style.opacity = '0';
        setTimeout(() => {
          element.textContent = value;
          element.style.opacity = '1';
        }, 150);
      }
    };
    
    animateValue(el('sumIncome'), formatCurrencyCard(inc));
    animateValue(el('sumExpenses'), formatCurrencyCard(exp));
    animateValue(el('sumBalance'), formatCurrencyCard(bal));

    const setLabeledValue = (id, defaultLabel, amount) => {
      const node = el(id);
      if (!node) return;
      const label = (node.getAttribute('data-label') || (node.textContent.split(':')[0] || defaultLabel)).trim();
      node.setAttribute('data-label', label);
      node.style.opacity = '0';
      setTimeout(() => {
        node.textContent = `${label}: ${formatCurrencyCard(amount)}`;
        node.style.opacity = '1';
      }, 150);
    };

    setLabeledValue('avgIncome', 'Promedio mensual', inc / monthsCovered);
    setLabeledValue('avgExpenses', 'Promedio mensual', exp / monthsCovered);
    setLabeledValue('avgBalance', 'Promedio mensual', bal / monthsCovered);

    animateValue(el('txCount'), String(tx.length));
    const ticket = tx.length ? (inc + exp) / tx.length : 0;
    setLabeledValue('avgTicket', 'Ticket promedio', ticket);
  }

  function calcularEstadisticasDiarias(allTx){
    const today = new Date();
    const start30 = new Date();
    start30.setDate(today.getDate() - 29);

    let incomeToday = 0, expensesToday = 0;
    const netByDate = new Map();
    for (let i=0;i<30;i++){ const d = new Date(start30); d.setDate(start30.getDate()+i); netByDate.set(d.toISOString().slice(0,10), 0); }

    allTx.forEach(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0,10);

      if (d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate()){
        if (t.type==='income') incomeToday += t.amount; else if (t.type==='expense') expensesToday += t.amount;
      }

      if (d >= start30 && d <= today){
        const delta = t.type==='income' ? t.amount : -t.amount;
        netByDate.set(key, (netByDate.get(key)||0) + delta);
      }
    });

    let sum = 0, count = 0; netByDate.forEach(v => { sum += v; count++; });
    const avgDaily = count ? (sum / count) : 0;
    return { incomeToday, expensesToday, avgDaily };
  }

  function renderizarKPIsDiarios(allTx){
    const { incomeToday, expensesToday, avgDaily } = calcularEstadisticasDiarias(allTx);
    const el = id => document.getElementById(id);
    if (el('dailyIncome')) el('dailyIncome').textContent = formatCurrencyCard(incomeToday);
    if (el('dailyExpenses')) el('dailyExpenses').textContent = formatCurrencyCard(expensesToday);
    if (el('dailyAverage')) el('dailyAverage').textContent = formatCurrencyCard(avgDaily);
  }

  function actualizarInsights(info){
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
      setText('insightTopCategoryValue', formatCurrencyCard(topCategory.amount));
      setText('insightTopCategoryDetail', `${topCategory.name} · ${topCategoryPercent.toFixed(1)}% del gasto`);
    } else {
      setText('insightTopCategoryValue', 'Sin datos');
      setText('insightTopCategoryDetail', 'Aún no hay gastos registrados en este periodo.');
    }

    if (bestMonthLabel) {
      const balanceLabel = `${bestMonthNet >= 0 ? '+' : '− '}${formatCurrencyCard(Math.abs(bestMonthNet))}`;
      setText('insightBestMonthValue', bestMonthLabel);
      setText('insightBestMonthDetail', `Balance neto: ${balanceLabel}`);
    } else {
      setText('insightBestMonthValue', 'Sin datos');
      setText('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    }

    if (totalIncome > 0) {
      const savingsPercent = CHART_PERCENT_FORMATTER.format(savingsRate);
      const savingsLabel = savings >= 0
        ? `Reservaste ${formatCurrencyCard(savings)} de tus ingresos.`
        : `Deficit de ${formatCurrencyCard(Math.abs(savings))}.`;
      setText('insightSavingsValue', savingsPercent);
      setText('insightSavingsDetail', savingsLabel);
    } else {
      setText('insightSavingsValue', 'Sin datos');
      setText('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');
    }
  }

  function destruirGraficos(){
    [
      chartCashflowArea,
      chartIncomeByCategory,
      chartExpenseByCategory,
      chartIncomeByDay,
      chartSavingsGauge,
      chartRadar,
      chartHeatmap
    ].forEach((instance, index) => {
      if (!instance) return;
      try {
        instance.destroy();
      } catch (error) {
      }
    });

    chartCashflowArea = chartIncomeByCategory = chartExpenseByCategory = chartIncomeByDay = chartSavingsGauge = chartRadar = chartHeatmap = null;

    const canvasIds = [
      'chartCashflowArea',
      'chartIncomeByCategory',
      'chartExpenseByCategory',
      'chartIncomeByDay',
      'chartSavingsGauge',
      'chartRadar',
      'chartHeatmap'
    ];

    canvasIds.forEach(id => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      const chartInstance = Chart.getChart(canvas);
      if (!chartInstance) return;
      try {
        chartInstance.destroy();
      } catch (error) {
      }
    });
  }

  

  function renderizarGraficos(tx) {
    if (!window.Chart) {
      return;
    }

    aplicarConfiguracionTema();
    destruirGraficos();

    const isDarkTheme = window.themeManager?.currentTheme === 'dark' ||
                        localStorage.getItem('theme') === 'dark';
    const gridColor = isDarkTheme ? '#26233a' : '#e5e5e5';
    const tickColor = isDarkTheme ? '#908caa' : '#9893a5';

    const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const MONTH_LABELS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const { inc, exp } = calcularMensual(tx);
    const netMonthly = inc.map((income, index) => income - exp[index]);
    const cumulativeBalance = calcularAcumulado(inc, exp);
    const totalIncome = inc.reduce((sum, value) => sum + value, 0);
    const totalExpenses = exp.reduce((sum, value) => sum + value, 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? savings / totalIncome : 0;

    const splits = calcularDivisionCategorias(tx);
    const expenseItems = splits.expenses.filter(item => item.amount > 0);
    const topExpenseCategories = expenseItems.slice(0, 8);
    const totalExpensesForPercent = expenseItems.reduce((sum, item) => sum + item.amount, 0) || 1;
    const topCategory = topExpenseCategories.length ? topExpenseCategories[0] : null;
    const topCategoryPercent = topCategory ? (topCategory.amount / totalExpensesForPercent) * 100 : 0;

    const hasNetMovement = netMonthly.some(value => Math.abs(value) > 0.01);
    const bestMonthIndex = hasNetMovement ? netMonthly.reduce((best, value, index) => (value > netMonthly[best] ? index : best), 0) : null;
    const bestMonthLabel = bestMonthIndex !== null ? MONTH_LABELS_FULL[bestMonthIndex] : null;
    const bestMonthNet = bestMonthIndex !== null ? netMonthly[bestMonthIndex] : 0;

    const expenseByDay = Array(31).fill(0);
    const incomeByDay = Array(31).fill(0);
    tx.forEach(transaction => {
      const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
      if (Number.isNaN(date)) return;
      const dayIndex = Math.max(0, Math.min(30, date.getDate() - 1));
      if (transaction.type === 'income') {
        incomeByDay[dayIndex] += transaction.amount;
      }
      if (transaction.type === 'expense') {
        expenseByDay[dayIndex] += transaction.amount;
      }
    });

    actualizarInsights({
      topCategory,
      topCategoryPercent,
      bestMonthLabel,
      bestMonthNet,
      savingsRate,
      savings,
      totalIncome
    });

    const cashflowSummary = document.getElementById('cashflowSummary');
    if (cashflowSummary) {
      cashflowSummary.textContent = '';
      cashflowSummary.style.display = 'none';
    }

    const gaugeLabel = document.getElementById('savingsGaugeLabel');
    if (gaugeLabel) {
      if (totalIncome > 0) {
        gaugeLabel.textContent = CHART_PERCENT_FORMATTER.format(savingsRate);
        gaugeLabel.classList.toggle('negative', savings < 0);
      } else {
        gaugeLabel.textContent = 'Sin datos';
        gaugeLabel.classList.remove('negative');
      }
    }

    const getCtx = id => document.getElementById(id)?.getContext('2d');
    const successBase = getThemeColor('--success', '#2D957B');
    const dangerBase = isDarkTheme ? getThemeColor('--danger', '#eb6f92') : '#b4637a';
    const fillOpacity = isDarkTheme ? 0.25 : 0.20;
    const successFill = colorWithAlpha(successBase, fillOpacity);
    const successSolid = colorWithAlpha(successBase, 0.95);
    const successLine = colorWithAlpha(successBase, 1);
    const dangerFill = colorWithAlpha(dangerBase, fillOpacity);
    const dangerSolid = colorWithAlpha(dangerBase, 0.95);
    const dangerLine = colorWithAlpha(dangerBase, 1);

    const baseLegend = {
      labels: {
        font: {
          family: 'Inter, sans-serif',
          size: 12,
          weight: '600'
        },
        color: tickColor,
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 12
      }
    };

    const baseTooltip = {
      backgroundColor: isDarkTheme ? '#232136' : '#FFFAF3',
      titleColor: isDarkTheme ? '#FFFAF3' : '#575279',
      bodyColor: isDarkTheme ? '#FFFAF3' : '#575279',
      borderColor: isDarkTheme ? '#EB6F92' : '#B4637A',
      borderWidth: 2,
      padding: 12,
      cornerRadius: 12,
      titleFont: {
        family: 'Inter, sans-serif',
        size: 13,
        weight: '700'
      },
      bodyFont: {
        family: 'Inter, sans-serif',
        size: 12
      },
      displayColors: true,
      usePointStyle: true,
      pointStyle: 'circle'
    };

    const legendMarginPlugin = {
      id: 'legendMargin',
      beforeInit(chart) {
        const originalFit = chart.legend.fit;
        chart.legend.fit = function () {
          originalFit.call(this);
          this.height += 18;
        };
      }
    };

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeInOutQuart'
      },
      plugins: {
        legend: baseLegend,
        tooltip: { ...baseTooltip }
      }
    };

    const cashflowCtx = getCtx('chartCashflowArea');
    if (cashflowCtx) {
      try {
        chartCashflowArea = new Chart(cashflowCtx, {
          type: 'line',
          plugins: [legendMarginPlugin],
          data: {
            labels: MONTH_LABELS,
            datasets: [
              {
                label: 'Ingresos',
                data: inc,
                backgroundColor: successFill,
                borderColor: successLine,
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: successLine,
                pointBorderColor: successLine,
                pointBorderWidth: 2
              },
              {
                label: 'Gastos',
                data: exp,
                backgroundColor: dangerFill,
                borderColor: dangerLine,
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: dangerLine,
                pointBorderColor: dangerLine,
                pointBorderWidth: 2
              },
              {
                label: 'Balance neto',
                data: netMonthly,
                borderColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                borderWidth: 3,
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                pointBorderColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                borderDash: [8, 4]
              }
            ]
          },
          options: {
            ...baseOptions,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              ...baseOptions.plugins,
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => {
                    // Mostrar el nombre completo del mes
                    const MONTH_LABELS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    const idx = context[0]?.dataIndex ?? 0;
                    return MONTH_LABELS_FULL[idx] || '';
                  },
                  label: context => {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y || 0;
                    return `${label}: ${formatCurrencyCard(value)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: tickColor,
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' }
                }
              },
              y: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: tickColor,
                  font: { size: 11 },
                  callback: value => `${APP_CURRENCY.symbol}${CHART_CURRENCY_FORMATTER.format(value)}`
                }
              }
            }
          }
        });
      } catch (error) {
      }
    }

    const incomeCtx = getCtx('chartIncomeByCategory');
    if (incomeCtx) {
      try {
        const incomeByCat = new Map();
        tx.forEach(t => {
          if (t.type === 'income') {
            const current = incomeByCat.get(t.category) || 0;
            incomeByCat.set(t.category, current + t.amount);
          }
        });

        const incomeCategories = Array.from(incomeByCat.entries())
          .map(([name, amount]) => ({ name, amount }))
          .filter(cat => cat.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        const incomeLabels = incomeCategories.length ? incomeCategories.map(cat => cat.name) : ['Sin datos'];
        const incomeData = incomeCategories.length ? incomeCategories.map(cat => cat.amount) : [0];
        const totalIncomeChart = incomeData.reduce((sum, val) => sum + val, 0);
        const incomePercentages = incomeCategories.length
          ? incomeCategories.map(cat => totalIncomeChart > 0 ? (cat.amount / totalIncomeChart) * 100 : 0)
          : [0];

        chartIncomeByCategory = new Chart(incomeCtx, {
          type: 'bar',
          data: {
            labels: incomeLabels,
            datasets: [{
              label: 'Ingreso total',
              data: incomeData,
              backgroundColor: successSolid,
              borderColor: successLine,
              hoverBackgroundColor: successLine,
              borderRadius: 6,
              borderSkipped: 'start',
              minBarLength: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.75,
              barThickness: 16,
              maxBarThickness: 16
            }]
          },
          options: {
            ...baseOptions,
            indexAxis: 'y',
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  label: context => {
                    const amount = context.parsed.x || 0;
                    const percent = incomePercentages[context.dataIndex] || 0;
                    return [
                      `Monto: ${formatCurrencyCard(amount)}`,
                      `Participación: ${percent.toFixed(1)}%`
                    ];
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: '#9893a5',
                  font: { size: 11 },
                  callback: value => `${APP_CURRENCY.symbol}${CHART_CURRENCY_FORMATTER.format(value)}`
                }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: '#9893a5',
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
                  align: 'center',
                  crossAlign: 'far',
                  padding: 18
                }
              }
            }
          }
        });
      } catch (error) {
      }
    }

    const expenseCtx = getCtx('chartExpenseByCategory');
    if (expenseCtx) {
      try {
        const expenseByCat = new Map();
        tx.forEach(t => {
          if (t.type === 'expense') {
            const current = expenseByCat.get(t.category) || 0;
            expenseByCat.set(t.category, current + t.amount);
          }
        });

        const expenseCategories = Array.from(expenseByCat.entries())
          .map(([name, amount]) => ({ name, amount }))
          .filter(cat => cat.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        const expenseLabels = expenseCategories.length ? expenseCategories.map(cat => cat.name) : ['Sin datos'];
        const expenseData = expenseCategories.length ? expenseCategories.map(cat => cat.amount) : [0];
        const totalExpenses = expenseData.reduce((sum, val) => sum + val, 0);
        const expensePercentages = expenseCategories.length
          ? expenseCategories.map(cat => totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0)
          : [0];

        chartExpenseByCategory = new Chart(expenseCtx, {
          type: 'bar',
          data: {
            labels: expenseLabels,
            datasets: [{
              label: 'Gasto total',
              data: expenseData,
              backgroundColor: dangerSolid,
              borderColor: dangerLine,
              hoverBackgroundColor: dangerLine,
              borderRadius: 6,
              borderSkipped: 'start',
              minBarLength: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.75,
              barThickness: 16,
              maxBarThickness: 16
            }]
          },
          options: {
            ...baseOptions,
            indexAxis: 'y',
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  label: context => {
                    const amount = context.parsed.x || 0;
                    const percent = expensePercentages[context.dataIndex] || 0;
                    return [
                      `Monto: ${formatCurrencyCard(amount)}`,
                      `Participación: ${percent.toFixed(1)}%`
                    ];
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: '#9893a5',
                  font: { size: 11 },
                  callback: value => `${APP_CURRENCY.symbol}${CHART_CURRENCY_FORMATTER.format(value)}`
                }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: '#9893a5',
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
                  align: 'center',
                  crossAlign: 'far',
                  padding: 18
                }
              }
            }
          }
        });
      } catch (error) {
      }
    }

    const incomeByDayCtx = getCtx('chartIncomeByDay');
    if (incomeByDayCtx) {
      try {
        const dayLabels = Array.from({ length: 31 }, (_, index) => String(index + 1));
        const maxIncome = Math.max(...incomeByDay, 0);
        const greenBase = isDarkTheme ? '#46a987' : '#2D957B';
        const colors = incomeByDay.map(value => {
          if (!maxIncome) return 'rgba(148, 163, 184, 0.25)';
          const intensity = value / maxIncome;
          return colorWithAlpha(greenBase, 0.25 + intensity * 0.70);
        });

        chartIncomeByDay = new Chart(incomeByDayCtx, {
          type: 'bar',
          data: {
            labels: dayLabels,
            datasets: [{
              label: 'Ingreso por dÃ­a del mes',
              data: incomeByDay,
              backgroundColor: colors,
              borderRadius: 3,
              borderWidth: 0,
              barPercentage: 0.9,
              categoryPercentage: 0.95
            }]
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => `Día ${context[0].label}`,
                  label: context => `${APP_CURRENCY.symbol}${CHART_CURRENCY_DETAILED.format(context.parsed.y || 0)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: 'rgba(100, 116, 139, 0.75)',
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { display: false }
              }
            }
          }
        });
      } catch (error) {
      }
    }

    const heatmapCtx = getCtx('chartHeatmap');
    if (heatmapCtx) {
      try {
        const heatmapLabels = Array.from({ length: 31 }, (_, index) => String(index + 1));
        const maxExpense = Math.max(...expenseByDay, 0);
        const pinkBase = isDarkTheme ? '#EB6F92' : '#B4637A';
        const colors = expenseByDay.map(value => {
          if (!maxExpense) return 'rgba(148, 163, 184, 0.25)';
          const intensity = value / maxExpense;
          return colorWithAlpha(pinkBase, 0.25 + intensity * 0.70);
        });

        chartHeatmap = new Chart(heatmapCtx, {
          type: 'bar',
          data: {
            labels: heatmapLabels,
            datasets: [{
              label: 'Gasto por dÃ­a del mes',
              data: expenseByDay,
              backgroundColor: colors,
              borderRadius: 3,
              borderWidth: 0,
              barPercentage: 0.9,
              categoryPercentage: 0.95
            }]
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => `Día ${context[0].label}`,
                  label: context => `${APP_CURRENCY.symbol}${CHART_CURRENCY_DETAILED.format(context.parsed.y || 0)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: 'rgba(100, 116, 139, 0.75)',
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { display: false }
              }
            }
          }
        });
      } catch (error) {
      }
    }
  }

  function exportarCsv(tx){
    const f = obtenerFiltros();
    const meta = [`Generado`, new Date().toISOString(), `AÃƒÂ±o`, f.year==null? 'Todos': String(f.year), `Mes`, f.month==null? 'Todos': String(f.month+1)];
    const rows = [meta, [], ['Tipo','Monto','DescripciÃƒÂ³n','Fecha','CategorÃƒÂ­a']];
    tx.forEach(t => rows.push([
      t.type==='income'?'Ingreso':'Gasto',
      String(t.amount),
      (t.description||'').replace(/\n/g,' '),
      (t.date instanceof Date ? t.date : new Date(t.date)).toISOString(),
      t.category
    ]));
    const csv = rows.map(r => r.map(v => /[",\n]/.test(v) ? '"'+String(v).replace(/"/g,'""')+'"' : v).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzapp-estadisticas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
  }

  

  function configurarDropdown(dropdownEl, onChange){
    const selected = dropdownEl.querySelector('.custom-dropdown-selected');
    const options = dropdownEl.querySelectorAll('.custom-dropdown-option');

    dropdownEl.setAttribute('role', 'listbox');
    selected.setAttribute('role', 'button');
    selected.setAttribute('aria-haspopup', 'listbox');
    selected.setAttribute('aria-expanded', 'false');
    options.forEach(opt => {
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', opt.classList.contains('selected') ? 'true' : 'false');
    });
    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdownEl.classList.contains('open')) {
        document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
      }
      const open = dropdownEl.classList.toggle('open');
      selected.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.getAttribute('data-value');
        const text = option.textContent;
        selected.querySelector('span').textContent = text;
        selected.setAttribute('data-value', value);
        dropdownEl.querySelectorAll('.custom-dropdown-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-selected','false'); });
        option.classList.add('selected');
        option.setAttribute('aria-selected','true');
        dropdownEl.classList.remove('open');
        selected.setAttribute('aria-expanded', 'false');
        if (onChange) onChange();
      });
    });
  }

  function configurarUI(){
    const yearDD = document.getElementById('yearFilter');
    const monthDD = document.getElementById('monthFilter');
    generarOpcionesAnio();
    
    // Establecer filtros por defecto a "Todos"
    const ySel = yearDD?.querySelector('.custom-dropdown-selected');
    const mSel = monthDD?.querySelector('.custom-dropdown-selected');
    if (ySel) { 
      ySel.setAttribute('data-value',''); 
      ySel.querySelector('span').textContent = 'Todos los años'; 
    }
    if (mSel) { 
      mSel.setAttribute('data-value',''); 
      mSel.querySelector('span').textContent = 'Todos los meses'; 
    }
    yearDD?.querySelectorAll('.custom-dropdown-option').forEach((o,i)=>{ o.classList.toggle('selected', i===0); });
    monthDD?.querySelectorAll('.custom-dropdown-option').forEach((o,i)=>{ o.classList.toggle('selected', i===0); });
    
    if (yearDD) configurarDropdown(yearDD, renderizarTodo);
    if (monthDD) configurarDropdown(monthDD, renderizarTodo);

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      const ySel = yearDD?.querySelector('.custom-dropdown-selected');
      const mSel = monthDD?.querySelector('.custom-dropdown-selected');
      if (ySel) { ySel.setAttribute('data-value',''); ySel.querySelector('span').textContent = 'Todos los años'; }
      if (mSel) { mSel.setAttribute('data-value',''); mSel.querySelector('span').textContent = 'Todos los meses'; }

      yearDD?.querySelectorAll('.custom-dropdown-option').forEach((o,i)=>{ o.classList.toggle('selected', i===0); });
      monthDD?.querySelectorAll('.custom-dropdown-option').forEach((o,i)=>{ o.classList.toggle('selected', i===0); });
      renderizarTodo();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.custom-dropdown')) return;
      
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
        const sel = d.querySelector('.custom-dropdown-selected');
        if (sel) sel.setAttribute('aria-expanded', 'false');
      });
    });

  }

  function obtenerTodasLasTransacciones(){
    const all = [];
    state.categories.forEach(c => (c.transactions||[]).forEach(t => all.push(t)));
    return all;
  }

  function renderizarTodo(){
    const tx = filtrarTransacciones();
    
    try {
      renderizarResumen(tx);
    } catch (error) {
    }
    
    try {
      renderizarKPIsDiarios(obtenerTodasLasTransacciones());
    } catch (error) {
    }
    
    try {
      renderizarGraficos(tx);
    } catch (error) {
    }
    
    try { window.__statsLastRenderAt = Date.now(); } catch {}
  }

  window.DataEvents = window.DataEvents || { emit(){}, on(){}, off(){} };

  function limpiarTodosLosDatos() {
    try { state.categories = []; } catch {}

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safeSet('sumIncome', formatCurrencyCard(0));
    safeSet('sumExpenses', formatCurrencyCard(0));
    safeSet('sumBalance', formatCurrencyCard(0));
    safeSet('txCount', '0');
    safeSet('avgIncome', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgExpenses', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgBalance', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgTicket', `Ticket promedio: ${formatCurrencyCard(0)}`);
    safeSet('dailyIncome', formatCurrencyCard(0));
    safeSet('dailyExpenses', formatCurrencyCard(0));
    safeSet('dailyAverage', formatCurrencyCard(0));

    try {
      destruirGraficos();
    } catch (error) {
    }

    const resetText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    resetText('insightTopCategoryValue', 'Sin datos');
    resetText('insightTopCategoryDetail', 'Aún no hay gastos registrados en este periodo.');
    resetText('insightBestMonthValue', 'Sin datos');
    resetText('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    resetText('insightSavingsValue', 'Sin datos');
    resetText('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');

    const cashflowSummary = document.getElementById('cashflowSummary');
    if (cashflowSummary) {
      cashflowSummary.textContent = '';
      cashflowSummary.style.display = 'none';
    }

    const gaugeLabel = document.getElementById('savingsGaugeLabel');
    if (gaugeLabel) {
      gaugeLabel.textContent = 'Sin datos';
      gaugeLabel.classList.remove('negative');
    }

  }

  /**
   * Controlador de página que extiende BasePage.
   * Centraliza la inicialización de Firebase, la carga de datos
   * y la suscripción a eventos cross-tab y de almacenamiento.
   *
   * @extends {window.BasePage}
   */
  class EstadisticaApp extends window.BasePage {
    /**
     * Punto de entrada tras DOMContentLoaded.
     * Inicializa Firebase, espera autenticación, carga datos y configura la UI.
     *
     * @override
     * @returns {Promise<void>}
     */
    async _init() {
      mostrarEsqueletos();
      try {
        if (!window.firebase) {
          throw new Error('Firebase SDK no disponible');
        }
        if (!firebase.apps.length) {
          const config = window.FIREBASE_CONFIG;
          if (!config) {
            throw new Error('Configuración de Firebase no disponible');
          }
          firebase.initializeApp(config);
        }
      } catch (error) {
      }
      await new Promise((resolve) => {
        try {
          const auth = firebase.auth();
          auth.onAuthStateChanged((user) => {
            resolve();
          });
        } catch (error) {
          resolve();
        }
      });
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
          if (window.FirestoreDB) {
            await window.FirestoreDB.init(currentUser.uid);
            window.FirestoreDB.setCurrentUser(currentUser.uid);
          }
        } else {
          const authUserRaw = localStorage.getItem('authUser');
          if (authUserRaw && authUserRaw !== 'guest') {
            const authUser = JSON.parse(authUserRaw);
            if (authUser.uid && window.FirestoreDB) {
              await window.FirestoreDB.init(authUser.uid);
              window.FirestoreDB.setCurrentUser(authUser.uid);
            }
          }
        }
      } catch (error) {
      }
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
      }
      let chartJsReady = false;
      let attempts = 0;
      const maxAttempts = 10;
      while (!chartJsReady && attempts < maxAttempts) {
        if (window.Chart) {
          chartJsReady = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }
      if (!chartJsReady) {
        document.querySelectorAll('.chart-wrap').forEach(wrap => {
          wrap.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444; text-align: center; flex-direction: column;"><div style="font-size: 2em;">❌</div><div>Error cargando Chart.js</div><small>Verifica tu conexión a internet y recarga la página</small></div>';
        });
      }
      await cargarDatos();
      configurarEventosComunes();
      poblarPerfilSidebar();
      inicializarTooltipPerfil();
      configurarUI();
      renderizarTodo();
      ocultarEsqueletos();
      this._bindCrossTabEvents();
    }

    /**
     * Suscribe a los eventos cross-tab y de almacenamiento para
     * recargar y renderizar estadísticas cuando los datos cambian.
     *
     * @override
     */
    _bindCrossTabEvents() {
      window.DataEvents.on('transactionChanged', (data) => {
        mostrarEsqueletos();
        setTimeout(async () => {
          await cargarDatos();
          renderizarTodo();
          ocultarEsqueletos();
        }, 200);
      });

      window.DataEvents.on('categoryChanged', (data) => {
        mostrarEsqueletos();
        if (data && data.action === 'clearAll') {
          limpiarTodosLosDatos();
          setTimeout(async () => {
            await cargarDatos();
            renderizarTodo();
            ocultarEsqueletos();
          }, 100);
        } else {
          setTimeout(async () => {
            await cargarDatos();
            renderizarTodo();
            ocultarEsqueletos();
          }, 200);
        }
      });

      window.DataEvents.on('dataImported', (data) => {
        mostrarEsqueletos();
        setTimeout(async () => {
          await cargarDatos();
          renderizarTodo();
          ocultarEsqueletos();
        }, 500);
      });

      window.addEventListener('storage', (e) => {
        if (e.key === 'finanzapp:data:v1') {
          mostrarEsqueletos();
          if (e.newValue === null || e.newValue === '' || e.newValue === '{"categories":[]}') {
            limpiarTodosLosDatos();
            setTimeout(async () => {
              await cargarDatos();
              renderizarTodo();
              ocultarEsqueletos();
            }, 100);
          } else {
            setTimeout(async () => {
              await cargarDatos();
              renderizarTodo();
              ocultarEsqueletos();
            }, 300);
          }
        }
      });
    }
  }

  const _estadisticaApp = new EstadisticaApp(); // eslint-disable-line no-unused-vars
})();
