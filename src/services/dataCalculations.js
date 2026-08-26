/**
 * dataCalculations.js
 * Funciones puras para el cálculo y formateo financiero de FinanzApp
 */

export function formatCurrency(amount = 0, symbol = '$') {
  const num = Number(amount) || 0;
  return `${symbol} ${num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseTransactionDate(date) {
  if (date instanceof Date) return date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
}

export function filterTransactions(categories = [], filters = {}) {
  const { year, month, search } = filters;
  const searchLower = (search || '').toLowerCase().trim();

  let allTx = [];
  categories.forEach((cat) => {
    (cat.transactions || []).forEach((tx) => {
      const d = parseTransactionDate(tx.date);
      if (Number.isNaN(d.getTime())) return;

      if (year !== null && year !== undefined && year !== '' && d.getFullYear() !== Number(year)) return;
      if (month !== null && month !== undefined && month !== '' && d.getMonth() !== Number(month)) return;

      if (searchLower) {
        const desc = (tx.desc || tx.description || '').toLowerCase();
        const catName = (cat.name || '').toLowerCase();
        const amt = String(tx.amount);
        if (!desc.includes(searchLower) && !catName.includes(searchLower) && !amt.includes(searchLower)) {
          return;
        }
      }

      allTx.push({
        ...tx,
        categoryId: cat.id,
        categoryName: cat.name,
        parsedDate: d
      });
    });
  });

  return allTx.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
}

export function calculateSummary(categories = [], filters = {}) {
  const txs = filterTransactions(categories, filters);
  let totalIncome = 0;
  let totalExpenses = 0;

  txs.forEach((tx) => {
    if (tx.type === 'income') totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  });

  const netBalance = totalIncome - totalExpenses;
  return {
    totalIncome,
    totalExpenses,
    netBalance,
    totalCount: txs.length
  };
}

export function calculateCashflow(categories = []) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const income = Array(12).fill(0);
  const expenses = Array(12).fill(0);
  const balance = Array(12).fill(0);

  const currentYear = new Date().getFullYear();

  categories.forEach((cat) => {
    (cat.transactions || []).forEach((tx) => {
      const d = parseTransactionDate(tx.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== currentYear) return;
      const m = d.getMonth();
      if (tx.type === 'income') income[m] += tx.amount;
      else expenses[m] += tx.amount;
    });
  });

  for (let i = 0; i < 12; i++) {
    balance[i] = income[i] - expenses[i];
  }

  return { labels: months, income, expenses, balance };
}

export function calculateCategoryBreakdown(categories = [], filters = {}) {
  const txs = filterTransactions(categories, filters);
  const incomeMap = new Map();
  const expenseMap = new Map();

  txs.forEach((tx) => {
    const catName = tx.categoryName || 'Sin categoría';
    if (tx.type === 'income') {
      incomeMap.set(catName, (incomeMap.get(catName) || 0) + tx.amount);
    } else {
      expenseMap.set(catName, (expenseMap.get(catName) || 0) + tx.amount);
    }
  });

  const toSortedArray = (map) =>
    [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

  return {
    income: toSortedArray(incomeMap),
    expenses: toSortedArray(expenseMap)
  };
}

export function calculateHeatmap(categories = [], filters = {}) {
  const txs = filterTransactions(categories, filters);
  const incomeByDay = Array(31).fill(0);
  const expensesByDay = Array(31).fill(0);

  txs.forEach((tx) => {
    const dayIndex = Math.max(0, Math.min(30, tx.parsedDate.getDate() - 1));
    if (tx.type === 'income') {
      incomeByDay[dayIndex] += tx.amount;
    } else {
      expensesByDay[dayIndex] += tx.amount;
    }
  });

  return { incomeByDay, expensesByDay };
}

export function calculateDailyStats(categories = []) {
  const allTx = [];
  categories.forEach((c) => (c.transactions || []).forEach((t) => allTx.push(t)));

  const d = new Date();
  let incomeToday = 0;
  let expensesToday = 0;

  const nowYear = d.getFullYear();
  const nowMonth = d.getMonth();
  const nowDate = d.getDate();

  allTx.forEach((tx) => {
    const txDate = parseTransactionDate(tx.date);
    if (Number.isNaN(txDate.getTime())) return;
    if (txDate.getFullYear() === nowYear && txDate.getMonth() === nowMonth && txDate.getDate() === nowDate) {
      if (tx.type === 'income') incomeToday += tx.amount;
      else expensesToday += tx.amount;
    }
  });

  return {
    incomeToday,
    expensesToday,
    dailyAverage: (incomeToday - expensesToday)
  };
}

export function calculateBudgetStatus(budget, categories = []) {
  let spent = 0;
  const cat = categories.find((c) => String(c.id) === String(budget.categoryId));

  if (cat && cat.transactions) {
    cat.transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        const d = parseTransactionDate(tx.date);
        const now = new Date();
        
        let matchPeriod = true;
        if (budget.period === 'monthly') {
          matchPeriod = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        } else if (budget.period === 'yearly') {
          matchPeriod = d.getFullYear() === now.getFullYear();
        } else if (budget.startDate && budget.endDate) {
          const s = parseTransactionDate(budget.startDate);
          const e = parseTransactionDate(budget.endDate);
          matchPeriod = d >= s && d <= e;
        }

        if (matchPeriod) {
          spent += tx.amount;
        }
      }
    });
  }

  const limit = Number(budget.amount) || 0;
  const remaining = limit - spent;
  const percent = limit > 0 ? (spent / limit) * 100 : 0;

  let status = 'success';
  if (percent > 100) status = 'danger';
  else if (percent > 80) status = 'warning';

  return { spent, remaining, percent, status };
}
