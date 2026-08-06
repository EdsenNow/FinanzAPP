class ProcesadorDatos {
  constructor() {
    this.MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  }

  filtrarTransacciones(categories, filters = {}) {
    const { year, month } = filters;
    const transactions = [];
    
    categories.forEach(category => {
      const catTransactions = category.transactions || [];

      catTransactions.forEach(transaction => {
        const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
        if (Number.isNaN(date.getTime())) {
          return;
        }
        if (year != null && date.getFullYear() !== year) return;
        if (month != null && date.getMonth() !== month) return;
        transactions.push({ ...transaction, category: category.name });
      });
    });
    
    return transactions;
  }

  calcularMensual(transactions) {
    const income = Array(12).fill(0);
    const expenses = Array(12).fill(0);
    
    transactions.forEach(tx => {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      const month = date.getMonth();
      if (tx.type === 'income') {
        income[month] += tx.amount;
      } else {
        expenses[month] += tx.amount;
      }
    });
    
    return { income, expenses };
  }

  calcularAcumulado(income, expenses) {
    const cumulative = [];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += (income[i] - expenses[i]);
      cumulative.push(sum);
    }
    return cumulative;
  }

  calcularDivisionCategorias(transactions) {
    const expenseMap = new Map();
    const incomeMap = new Map();
    
    transactions.forEach(tx => {
      const map = tx.type === 'income' ? incomeMap : expenseMap;
      map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
    });
    
    const toArray = (map) => Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    
    return {
      expenses: toArray(expenseMap),
      income: toArray(incomeMap)
    };
  }

  calcularEstadisticasDiarias(transactions) {
    const today = new Date();
    const start30 = new Date();
    start30.setDate(today.getDate() - 29);

    let incomeToday = 0;
    let expensesToday = 0;
    const netByDate = new Map();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(start30);
      date.setDate(start30.getDate() + i);
      netByDate.set(date.toISOString().slice(0, 10), 0);
    }

    transactions.forEach(tx => {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);

      if (date.getFullYear() === today.getFullYear() && 
          date.getMonth() === today.getMonth() && 
          date.getDate() === today.getDate()) {
        if (tx.type === 'income') {
          incomeToday += tx.amount;
        } else if (tx.type === 'expense') {
          expensesToday += tx.amount;
        }
      }

      if (date >= start30 && date <= today) {
        const delta = tx.type === 'income' ? tx.amount : -tx.amount;
        netByDate.set(key, (netByDate.get(key) || 0) + delta);
      }
    });

    let sum = 0;
    let count = 0;
    netByDate.forEach(value => {
      sum += value;
      count++;
    });
    const avgDaily = count ? (sum / count) : 0;
    
    return { incomeToday, expensesToday, avgDaily };
  }

  calcularGastosPorDia(transactions) {
    const expenseByDay = Array(31).fill(0);
    
    transactions.forEach(tx => {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      if (tx.type === 'expense') {
        const dayIndex = Math.max(0, Math.min(30, date.getDate() - 1));
        expenseByDay[dayIndex] += tx.amount;
      }
    });
    
    return expenseByDay;
  }

  prepararDatosTabla(list, type) {
    const total = list.reduce((sum, item) => sum + item.amount, 0) || 1;
    return list.map((item, index) => ({
      id: item.id || `${type}_${index + 1}`,
      name: item.name,
      amount: item.amount,
      percent: (item.amount / total) * 100,
      type: type
    }));
  }
}

window.ProcesadorDatos = ProcesadorDatos;
window.DataProcessor = ProcesadorDatos;
