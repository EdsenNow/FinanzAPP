const TABLE_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

class GestorTablas {
  constructor(tableId, options = {}) {
    this.table = document.getElementById(tableId);
    this.tbody = this.table.querySelector('tbody');
    this.searchInput = document.getElementById(options.searchInputId || '');
    this.prevBtn = document.getElementById(options.prevBtnId || '');
    this.nextBtn = document.getElementById(options.nextBtnId || '');
    this.pageInfo = document.getElementById(options.pageInfoId || '');
    this.tableInfo = document.getElementById(options.tableInfoId || '');
    this.config = {
      itemsPerPage: 7,
      currentPage: 1,
      sortKey: 'amount',
      sortDirection: 'desc',
      ...options
    };
    this.originalData = [];
    this.filteredData = [];
    this.sortedData = [];
    this.paginatedData = [];
    this.inicializar();
  }

  inicializar() {
    this.configurarEventos();
    this.cargarDatos();
  }

  configurarEventos() {
    const sortableHeaders = this.table.querySelectorAll('th.sortable');
    sortableHeaders.forEach(header => {
      header.addEventListener('click', () => this.manejarOrden(header.dataset.key));
    });
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.manejarBusqueda());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.paginaAnterior());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.paginaSiguiente());
    }
  }

  cargarDatos() {
    this.originalData = [];
    this.filteredData = [];
    this.sortedData = [];
    this.paginatedData = [];
    this.actualizarTabla();
  }

  calcularPorcentajes() {
    const total = this.originalData.reduce((sum, item) => sum + item.amount, 0);
    this.originalData.forEach(item => {
      item.percent = total > 0 ? (item.amount / total) * 100 : 0;
    });
  }

  actualizarDatos(newData) {
    this.originalData = newData || [];
    this.calcularPorcentajes();
    this.filteredData = [...this.originalData];
    this.config.currentPage = 1;
    this.ordenarDatos();
    this.actualizarTabla();
  }

  manejarOrden(key) {
    const sortableHeaders = this.table.querySelectorAll('th.sortable .sort-icon');
    sortableHeaders.forEach(icon => {
      icon.style.display = 'none';
    });
    const currentHeader = this.table.querySelector(`th.sortable[data-key="${key}"]`);
    if (currentHeader) {
      const icon = currentHeader.querySelector('.sort-icon');
      if (this.config.sortKey === key) {
        this.config.sortDirection = this.config.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.config.sortKey = key;
        this.config.sortDirection = 'asc';
      }
      if (icon) {
        icon.style.display = 'inline-block';
        icon.className = 'sort-icon fas';
        icon.classList.add(this.config.sortDirection === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down');
      }
    }
    this.ordenarDatos();
    this.paginarDatos();
    this.actualizarTabla();
  }

  actualizarIndicadoresOrden() {
    const sortableHeaders = this.table.querySelectorAll('th.sortable .sort-icon');
    sortableHeaders.forEach(icon => {
      icon.style.display = 'none';
    });
    const currentHeader = this.table.querySelector(`th.sortable[data-key="${this.config.sortKey}"]`);
    if (currentHeader) {
      const icon = currentHeader.querySelector('.sort-icon');
      if (icon) {
        icon.style.display = 'inline-block';
        icon.className = 'sort-icon fas';
        icon.classList.add(this.config.sortDirection === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down');
      }
    }
  }

  ordenarDatos() {
    this.filteredData.sort((a, b) => {
      let valueA = a[this.config.sortKey];
      let valueB = b[this.config.sortKey];
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      if (valueA < valueB) {
        return this.config.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.config.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    this.sortedData = [...this.filteredData];
    this.paginarDatos();
  }

  manejarBusqueda() {
    const searchTerm = this.searchInput.value.toLowerCase();
    if (!searchTerm) {
      this.filteredData = [...this.originalData];
    } else {
      this.filteredData = this.originalData.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.amount.toString().includes(searchTerm)
      );
    }
    this.config.currentPage = 1;
    this.ordenarDatos();
    this.actualizarTabla();
  }

  paginarDatos() {
    const start = (this.config.currentPage - 1) * this.config.itemsPerPage;
    const end = start + this.config.itemsPerPage;
    this.paginatedData = this.sortedData.slice(start, end);
  }

  paginaSiguiente() {
    const totalPages = Math.ceil(this.sortedData.length / this.config.itemsPerPage);
    if (this.config.currentPage < totalPages) {
      this.config.currentPage++;
      this.paginarDatos();
      this.actualizarTabla();
    }
  }

  paginaAnterior() {
    if (this.config.currentPage > 1) {
      this.config.currentPage--;
      this.paginarDatos();
      this.actualizarTabla();
    }
  }

  actualizarTabla() {
    this.tbody.innerHTML = '';
    this.paginatedData.forEach(item => {
      const row = document.createElement('tr');
      const formattedAmount = TABLE_CURRENCY_FORMATTER.format(Number(item.amount) || 0);
      const isExpenseTable = this.table.id === 'expensesTable' || this.table.closest('.stats-table-card')?.classList.contains('expense-table');
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const barBg = isExpenseTable
        ? (isLight
            ? 'linear-gradient(90deg, rgba(255, 99, 132, 0.55), rgba(255, 99, 132, 0.9))'
            : 'linear-gradient(90deg, rgba(255, 99, 132, 0.3), rgba(255, 99, 132, 0.6))')
        : (isLight
            ? 'linear-gradient(90deg, rgba(75, 192, 192, 0.55), rgba(75, 192, 192, 0.9))'
            : 'linear-gradient(90deg, rgba(75, 192, 192, 0.3), rgba(75, 192, 192, 0.6))');
      row.innerHTML = `
        <td>${item.name}</td>
        <td class="num">${formattedAmount}</td>
        <td class="num">${item.percent.toFixed(1)}%</td>
        <td>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${item.percent}%; background: ${barBg};"></div>
          </div>
        </td>
      `;
      this.tbody.appendChild(row);
    });
    this.actualizarControlesPaginacion();
  }

  actualizarControlesPaginacion() {
    const totalItems = this.filteredData.length;
    const totalPages = Math.ceil(totalItems / this.config.itemsPerPage);
    const startItem = Math.min(((this.config.currentPage - 1) * this.config.itemsPerPage) + 1, totalItems);
    const endItem = Math.min(startItem + this.config.itemsPerPage - 1, totalItems);
    if (this.tableInfo) {
      this.tableInfo.textContent = `Mostrando ${startItem} a ${endItem} de ${totalItems} entradas`;
    }
    if (this.pageInfo) {
      this.pageInfo.textContent = `${this.config.currentPage} / ${Math.max(totalPages, 1)}`;
    }
    if (this.prevBtn) {
      this.prevBtn.disabled = this.config.currentPage <= 1;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.config.currentPage >= totalPages;
    }
  }
}

window.GestorTablas = GestorTablas;
window.TableManager = GestorTablas;
