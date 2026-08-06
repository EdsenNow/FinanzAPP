class ProcesadorDatos {
  constructor() {
    this.MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  }

  filtrarPresupuestos(budgets, filters = {}) {
    const { year, month, category } = filters;
    
    return budgets.filter(budget => {
      if (category && String(budget.categoryId) !== String(category)) {
        return false;
      }
      
      if (year) {
        const startDate = new Date(budget.startDate);
        if (startDate.getFullYear() !== parseInt(year)) {
          return false;
        }
      }
      
      if (month !== null && month !== undefined) {
        const startDate = new Date(budget.startDate);
        if (startDate.getMonth() !== parseInt(month)) {
          return false;
        }
      }
      
      return true;
    });
  }

  calcularGastado(budget, transactions) {
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    
    const gastos = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      if (String(t.categoryId) !== String(budget.categoryId)) return false;
      
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate;
    });
    
    return gastos.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  calcularEstadisticas(budgets, transactions) {
    let totalPresupuestado = 0;
    let totalGastado = 0;
    let presupuestosDentroDeLimite = 0;
    
    budgets.forEach(budget => {
      const gastado = this.calcularGastado(budget, transactions);
      totalPresupuestado += budget.amount;
      totalGastado += gastado;
      
      if (gastado <= budget.amount) {
        presupuestosDentroDeLimite++;
      }
    });
    
    const totalDisponible = totalPresupuestado - totalGastado;
    const tasaCumplimiento = budgets.length > 0 
      ? (presupuestosDentroDeLimite / budgets.length) * 100 
      : 0;
    
    return {
      totalPresupuestado,
      totalGastado,
      totalDisponible,
      tasaCumplimiento
    };
  }

  prepararDatosComparacion(budgets, transactions) {
    const labels = budgets.map(b => b.name);
    const presupuestadoData = budgets.map(b => b.amount);
    const gastadoData = budgets.map(b => this.calcularGastado(b, transactions));
    
    return {
      labels,
      datasets: [
        {
          label: 'Presupuestado',
          data: presupuestadoData,
          backgroundColor: 'rgba(86, 148, 159, 0.7)',
          borderColor: 'rgba(86, 148, 159, 1)',
          borderWidth: 1
        },
        {
          label: 'Gastado',
          data: gastadoData,
          backgroundColor: 'rgba(180, 99, 122, 0.7)',
          borderColor: 'rgba(180, 99, 122, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  prepararDatosDistribucion(budgets) {
    const labels = budgets.map(b => b.name);
    const data = budgets.map(b => b.amount);
    
    const colors = [
      'rgba(180, 99, 122, 0.7)',
      'rgba(86, 148, 159, 0.7)',
      'rgba(156, 107, 215, 0.7)',
      'rgba(45, 149, 123, 0.7)',
      'rgba(234, 157, 52, 0.7)',
      'rgba(215, 130, 126, 0.7)',
      'rgba(191, 166, 230, 0.7)',
      'rgba(40, 105, 131, 0.7)'
    ];
    
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#fff',
        borderWidth: 2
      }]
    };
  }

  calcularProgreso(budget, gastado) {
    if (budget.amount === 0) return 0;
    return (gastado / budget.amount) * 100;
  }

  determinarEstado(progreso) {
    if (progreso > 100) {
      return { class: 'danger', label: 'Excedido' };
    } else if (progreso > 80) {
      return { class: 'warning', label: 'Alerta' };
    } else {
      return { class: 'success', label: 'Normal' };
    }
  }

  agruparPorCategoria(budgets, categories) {
    const grouped = {};
    
    budgets.forEach(budget => {
      const categoria = categories.find(c => String(c.id) === String(budget.categoryId));
      const categoryName = categoria?.name || 'Sin categoría';
      
      if (!grouped[categoryName]) {
        grouped[categoryName] = {
          name: categoryName,
          budgets: [],
          total: 0
        };
      }
      
      grouped[categoryName].budgets.push(budget);
      grouped[categoryName].total += budget.amount;
    });
    
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }

  calcularTendencias(budgets, transactions, mesesAtras = 3) {
    const now = new Date();
    const tendencias = [];
    
    for (let i = 0; i < mesesAtras; i++) {
      const mes = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesStr = this.MONTHS[mes.getMonth()];
      
      let totalGastado = 0;
      let totalPresupuestado = 0;
      
      budgets.forEach(budget => {
        const startDate = new Date(budget.startDate);
        if (startDate.getMonth() === mes.getMonth() && 
            startDate.getFullYear() === mes.getFullYear()) {
          totalPresupuestado += budget.amount;
          totalGastado += this.calcularGastado(budget, transactions);
        }
      });
      
      tendencias.unshift({
        mes: mesStr,
        presupuestado: totalPresupuestado,
        gastado: totalGastado
      });
    }
    
    return tendencias;
  }

  identificarPresupuestosEnRiesgo(budgets, transactions) {
    const enRiesgo = [];
    
    budgets.forEach(budget => {
      const gastado = this.calcularGastado(budget, transactions);
      const progreso = this.calcularProgreso(budget, gastado);
      
      if (progreso > 80 && progreso <= 100) {
        enRiesgo.push({
          ...budget,
          gastado,
          progreso,
          restante: budget.amount - gastado
        });
      }
    });
    
    return enRiesgo.sort((a, b) => b.progreso - a.progreso);
  }

  identificarPresupuestosExcedidos(budgets, transactions) {
    const excedidos = [];
    
    budgets.forEach(budget => {
      const gastado = this.calcularGastado(budget, transactions);
      const progreso = this.calcularProgreso(budget, gastado);
      
      if (progreso > 100) {
        excedidos.push({
          ...budget,
          gastado,
          progreso,
          exceso: gastado - budget.amount
        });
      }
    });
    
    return excedidos.sort((a, b) => b.exceso - a.exceso);
  }
}

window.ProcesadorDatos = ProcesadorDatos;
window.DataProcessor = ProcesadorDatos;
