class RenderizadorUI {
  constructor() {
    this.formatters = {
      percent: new Intl.NumberFormat('es-ES', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
      compact: new Intl.NumberFormat('es-ES', {
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
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    let result = hasFraction ? `${intPart},${fracPart}` : intPart;
    if (negative) result = '-' + result;
    return result;
  }

  formatearMoneda(amount) {
    if (window.Core?.helpers?.formatCurrency) {
      return window.Core.helpers.formatCurrency(amount);
    }

    const n = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n).replace('US', '').trim();
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

  renderizarResumen(stats) {
    const { totalPresupuestado, totalGastado, totalDisponible, tasaCumplimiento } = stats;
    
    const elementos = {
      totalBudgeted: document.getElementById('totalBudgeted'),
      totalSpent: document.getElementById('totalSpent'),
      totalAvailable: document.getElementById('totalAvailable'),
      complianceRate: document.getElementById('complianceRate')
    };
    
    this.animarValor(elementos.totalBudgeted, this.formatearMoneda(totalPresupuestado));
    this.animarValor(elementos.totalSpent, this.formatearMoneda(totalGastado));
    this.animarValor(elementos.totalAvailable, this.formatearMoneda(totalDisponible));
    this.animarValor(elementos.complianceRate, Math.round(tasaCumplimiento) + '%');
  }

  renderizarTarjetasPresupuestos(container, budgets, categories, transactions, callbacks = {}) {
    if (!container) return;
    
    if (budgets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-invoice-dollar"></i>
          <p>No hay presupuestos creados</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    budgets.forEach(budget => {
      const gastado = this.calcularGastado(budget, transactions);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = categories.find(c => String(c.id) === String(budget.categoryId));
      
      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }
      
      let dateRangeText = '';
      if (budget.startDate && budget.endDate) {
        dateRangeText = `${this.formatDate(new Date(budget.startDate))} - ${this.formatDate(new Date(budget.endDate))}`;
      } else {
        const now = new Date();
        let sDate, eDate;
        if (budget.period === 'weekly') {
          const day = now.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          sDate = new Date(now);
          sDate.setDate(now.getDate() + diffToMonday);
          eDate = new Date(sDate);
          eDate.setDate(sDate.getDate() + 6);
        } else if (budget.period === 'biweekly') {
          const day = now.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          sDate = new Date(now);
          sDate.setDate(now.getDate() + diffToMonday);
          eDate = new Date(sDate);
          eDate.setDate(sDate.getDate() + 13);
        } else if (budget.period === 'yearly') {
          sDate = new Date(now.getFullYear(), 0, 1);
          eDate = new Date(now.getFullYear(), 11, 31);
        } else {
          sDate = new Date(now.getFullYear(), now.getMonth(), 1);
          eDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        dateRangeText = `${this.formatDate(sDate)} - ${this.formatDate(eDate)}`;
      }

      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="card-top">
          <div class="category-info-box">
            <h3>
              <i class="fas fa-wallet"></i>
              ${this.escapeHtml(budget.name)}
            </h3>
            ${dateRangeText ? `
              <div class="budget-custom-duration">
                <i class="fas fa-calendar-alt"></i>
                <span>${dateRangeText}</span>
              </div>
            ` : ''}
          </div>
          <span class="period-chip">${this.getPeriodText(budget.period)}</span>
        </div>
        
        <div class="budget-stats">
          <div class="stat-row">
            <span>Categoría:</span>
            <strong>${this.escapeHtml(categoria?.name || 'Sin categoría')}</strong>
          </div>
          <div class="stat-row">
            <span>Presupuestado:</span>
            <strong class="stat-value-budgeted">${this.formatearMoneda(budget.amount)}</strong>
          </div>
          <div class="stat-row">
            <span>Gastado:</span>
            <strong class="stat-value-spent">${this.formatearMoneda(gastado)}</strong>
          </div>
          <div class="stat-row">
            <span>Restante:</span>
            <strong class="stat-value-remaining">${this.formatearMoneda(restante)}</strong>
          </div>
        </div>
        
        <div class="progress-section">
          <div class="progress-header">
            <span>Progreso</span>
            <span>${Math.min(progreso, 100).toFixed(1)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(progreso, 100)}%"></div>
          </div>
        </div>
        
        <div class="actions">
          <button class="btn btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      const btnEdit = card.querySelector('.btn-edit');
      const btnDelete = card.querySelector('.btn-delete');
      
      if (btnEdit && callbacks.onEdit) {
        btnEdit.addEventListener('click', () => callbacks.onEdit(budget.id));
      }
      
      if (btnDelete && callbacks.onDelete) {
        btnDelete.addEventListener('click', () => callbacks.onDelete(budget.id));
      }
      
      container.appendChild(card);
    });
  }

  renderizarTabla(tbody, budgets, categories, transactions, callbacks = {}) {
    if (!tbody) return;
    
    if (budgets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem;">
            No hay presupuestos para mostrar
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = '';
    
    budgets.forEach(budget => {
      const gastado = this.calcularGastado(budget, transactions);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = categories.find(c => String(c.id) === String(budget.categoryId));
      
      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this.escapeHtml(budget.name)}</td>
        <td>${this.escapeHtml(categoria?.name || 'Sin categoría')}</td>
        <td>${this.formatearMoneda(budget.amount)}</td>
        <td>${this.formatearMoneda(gastado)}</td>
        <td class="${restante < 0 ? 'text-danger' : ''}">${this.formatearMoneda(restante)}</td>
        <td>
          <div class="progress-bar-small">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(progreso, 100)}%"></div>
          </div>
          <span class="progress-text">${Math.min(progreso, 100).toFixed(1)}%</span>
        </td>
        <td>
          <button class="btn btn-sm btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      const btnEdit = row.querySelector('.btn-edit');
      const btnDelete = row.querySelector('.btn-delete');
      
      if (btnEdit && callbacks.onEdit) {
        btnEdit.addEventListener('click', () => callbacks.onEdit(budget.id));
      }
      
      if (btnDelete && callbacks.onDelete) {
        btnDelete.addEventListener('click', () => callbacks.onDelete(budget.id));
      }
      
      tbody.appendChild(row);
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getPeriodText(period) {
    const periods = {
      'weekly': 'Semanal',
      'biweekly': 'Quincenal',
      'monthly': 'Mensual',
      'yearly': 'Anual',
      'custom': 'Personalizado'
    };
    return periods[period] || period;
  }

  mostrarEsqueletos() {
    ['totalBudgeted', 'totalSpent', 'totalAvailable', 'complianceRate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton', 'skeleton-value');
        el.textContent = '';
      }
    });
  }

  ocultarEsqueletos() {
    document.querySelectorAll('.skeleton').forEach(el => {
      el.classList.remove('skeleton', 'skeleton-value', 'skeleton-full');
    });
  }
}

window.RenderizadorUI = RenderizadorUI;
window.UIRenderer = RenderizadorUI;
