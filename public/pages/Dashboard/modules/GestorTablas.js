/**
 * GestorTablas — Gestiona tablas de datos con ordenación, filtrado y paginación.
 * Maneja eventos DOM, actualizaciones de datos y renderizado de filas y controles.
 */
class GestorTablas {
  /**
   * @param {string} tableId - ID del elemento <table> en el DOM.
   * @param {object} [options={}] - Configuración opcional e IDs de elementos asociados.
   */
  constructor(tableId, options = {}) {
    this.table = document.getElementById(tableId);
    this.tbody = this.table?.querySelector('tbody');
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

    /** Formateador reutilizable para importes en tabla (locale es-ES, evita recrearlo por fila). */
    this._formatter = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    /** Indica si esta tabla muestra datos de gastos; se evalúa una sola vez al construir. */
    this._isExpenseTable =
      this.table?.id === 'expensesTable' ||
      this.table?.closest('.stats-table-card')?.classList.contains('expense-table') ||
      false;

    this.inicializar();
  }

  /** Inicializa la tabla si el elemento DOM existe. */
  inicializar() {
    if (!this.table) return;
    this.configurarEventos();
    this.cargarDatos();
  }

  /** Adjunta los listeners de ordenación, búsqueda y paginación. */
  configurarEventos() {
    this.table.querySelectorAll('th.sortable').forEach(header => {
      header.addEventListener('click', () => this.manejarOrden(header.dataset.key));
    });
    this.searchInput?.addEventListener('input', () => this.manejarBusqueda());
    this.prevBtn?.addEventListener('click', () => this.paginaAnterior());
    this.nextBtn?.addEventListener('click', () => this.paginaSiguiente());
  }

  /** Reinicia todos los arreglos de datos y renderiza una tabla vacía. */
  cargarDatos() {
    this.originalData = [];
    this.filteredData = [];
    this.sortedData = [];
    this.paginatedData = [];
    this.actualizarTabla();
  }

  /**
   * Calcula el porcentaje de cada ítem respecto al total y lo almacena en `item.percent`.
   */
  calcularPorcentajes() {
    const total = this.originalData.reduce((sum, item) => sum + item.amount, 0);
    this.originalData.forEach(item => {
      item.percent = total > 0 ? (item.amount / total) * 100 : 0;
    });
  }

  /**
   * Reemplaza el conjunto de datos, recalcula porcentajes, regresa a página 1 y re-renderiza.
   * @param {Array} newData - Nuevo arreglo de objetos a mostrar.
   */
  actualizarDatos(newData) {
    this.originalData = newData || [];
    this.calcularPorcentajes();
    this.filteredData = [...this.originalData];
    this.config.currentPage = 1;
    this.ordenarDatos();
    this.actualizarTabla();
  }

  /**
   * Maneja el clic en un encabezado de columna: actualiza el estado de ordenación
   * y delega la actualización de iconos a `actualizarIndicadoresOrden`.
   * @param {string} key - Clave de datos de la columna a ordenar.
   */
  manejarOrden(key) {
    const currentHeader = this.table.querySelector(`th.sortable[data-key="${key}"]`);
    if (currentHeader) {
      if (this.config.sortKey === key) {
        this.config.sortDirection = this.config.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.config.sortKey = key;
        this.config.sortDirection = 'asc';
      }
      this.actualizarIndicadoresOrden();
    }
    this.ordenarDatos();
    this.paginarDatos();
    this.actualizarTabla();
  }

  /** Actualiza los iconos de flecha para reflejar la columna y dirección de ordenación actuales. */
  actualizarIndicadoresOrden() {
    this.table.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
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

  /** Ordena `filteredData` por la clave y dirección actuales y actualiza `sortedData`. */
  ordenarDatos() {
    this.filteredData.sort((a, b) => {
      let valueA = a[this.config.sortKey];
      let valueB = b[this.config.sortKey];
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      if (valueA < valueB) return this.config.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.config.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    this.sortedData = [...this.filteredData];
    this.paginarDatos();
  }

  /**
   * Filtra `originalData` con el término de búsqueda actual, regresa a página 1
   * y re-renderiza. Coincide contra nombre e importe del ítem.
   */
  manejarBusqueda() {
    const term = (this.searchInput?.value || '').toLowerCase();
    this.filteredData = term
      ? this.originalData.filter(item =>
          item.name.toLowerCase().includes(term) ||
          item.amount.toString().includes(term)
        )
      : [...this.originalData];
    this.config.currentPage = 1;
    this.ordenarDatos();
    this.actualizarTabla();
  }

  /** Recorta `sortedData` para obtener las filas de la página actual. */
  paginarDatos() {
    const start = (this.config.currentPage - 1) * this.config.itemsPerPage;
    this.paginatedData = this.sortedData.slice(start, start + this.config.itemsPerPage);
  }

  /** Avanza a la siguiente página si existe. */
  paginaSiguiente() {
    const totalPages = Math.ceil(this.sortedData.length / this.config.itemsPerPage);
    if (this.config.currentPage < totalPages) {
      this.config.currentPage++;
      this.paginarDatos();
      this.actualizarTabla();
    }
  }

  /** Retrocede a la página anterior si no está en la primera. */
  paginaAnterior() {
    if (this.config.currentPage > 1) {
      this.config.currentPage--;
      this.paginarDatos();
      this.actualizarTabla();
    }
  }

  /**
   * Vacía y re-renderiza el tbody con los datos de la página actual.
   * Calcula el color de la barra y el tema una sola vez, fuera del bucle de filas.
   */
  actualizarTabla() {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const barBg = this._isExpenseTable
      ? (isLight
          ? 'linear-gradient(90deg, rgba(255, 99, 132, 0.55), rgba(255, 99, 132, 0.9))'
          : 'linear-gradient(90deg, rgba(255, 99, 132, 0.3), rgba(255, 99, 132, 0.6))')
      : (isLight
          ? 'linear-gradient(90deg, rgba(75, 192, 192, 0.55), rgba(75, 192, 192, 0.9))'
          : 'linear-gradient(90deg, rgba(75, 192, 192, 0.3), rgba(75, 192, 192, 0.6))');

    this.paginatedData.forEach(item => {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = item.name;

      const amountCell = document.createElement('td');
      amountCell.className = 'num';
      amountCell.textContent = this._formatter.format(Number(item.amount) || 0);

      const percentCell = document.createElement('td');
      percentCell.className = 'num';
      percentCell.textContent = `${item.percent.toFixed(1)}%`;

      const progressFill = document.createElement('div');
      progressFill.className = 'progress-bar-fill';
      progressFill.style.width = `${item.percent}%`;
      progressFill.style.background = barBg;

      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      progressBar.appendChild(progressFill);

      const barCell = document.createElement('td');
      barCell.appendChild(progressBar);

      row.append(nameCell, amountCell, percentCell, barCell);
      this.tbody.appendChild(row);
    });
    this.actualizarControlesPaginacion();
  }

  /** Actualiza el texto informativo y habilita/deshabilita los botones de paginación. */
  actualizarControlesPaginacion() {
    const totalItems = this.filteredData.length;
    const totalPages = Math.ceil(totalItems / this.config.itemsPerPage);
    const startItem = Math.min(((this.config.currentPage - 1) * this.config.itemsPerPage) + 1, totalItems);
    const endItem = Math.min(startItem + this.config.itemsPerPage - 1, totalItems);
    if (this.tableInfo) this.tableInfo.textContent = `Mostrando ${startItem} a ${endItem} de ${totalItems} entradas`;
    if (this.pageInfo) this.pageInfo.textContent = `${this.config.currentPage} / ${Math.max(totalPages, 1)}`;
    if (this.prevBtn) this.prevBtn.disabled = this.config.currentPage <= 1;
    if (this.nextBtn) this.nextBtn.disabled = this.config.currentPage >= totalPages;
  }
}

window.GestorTablas = GestorTablas;
window.TableManager = GestorTablas;
