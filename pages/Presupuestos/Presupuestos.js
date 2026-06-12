/**
 * @fileoverview Página de Presupuestos de FinanzApp.
 *
 * Permite crear, editar y eliminar presupuestos por categoría y periodo,
 * visualizar el progreso de gasto frente a cada presupuesto y filtrar
 * por año, mes y categoría. Incluye renovación automática de presupuestos
 * vencidos y un selector de fechas modal.
 *
 * @module Presupuestos
 */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.sidebarRenderer) {
    window.sidebarRenderer.render('presupuestos');
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

  const datosApp = {
    budgets: [],
    categories: [],
    transactions: [],
    user: { name: 'Usuario', email: 'usuario@ejemplo.com' }
  };

  let filtros = {
    year: null,
    month: null,
    category: null
  };

  let editingBudgetId = null;

  // Variables para el mini calendario
  let miniCalCurrentDate = new Date();
  let miniCalSelectedDate = null;
  let miniCalTargetInput = null;
  let miniCalInputType = null; // 'start' o 'end'

  function formatCurrency(amount) {
    if (window.Core?.helpers?.formatCurrency) {
      return window.Core.helpers.formatCurrency(amount);
    }

    const n = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(n).replace('US', '');
  }

  /**
   * Formatea un string de importe al estilo europeo mientras el usuario escribe.
   * Elimina ceros a la izquierda, limita a 8 dígitos enteros y 2 decimales.
   * Ejemplo de salida: "1,234.56" o "1,234." si aún no puso decimales.
   */
  function formatInputAmountEs(raw){
    if (raw == null) return '';
    let s = String(raw).replace(/\s+/g,'');
    s = s.replace(/[^\d.]/g,'');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1){
      const before = s.slice(0, firstDot+1);
      let after = s.slice(firstDot+1).replace(/\./g,'');
      s = before + after;
    }
    let [intPart, decPart = ''] = s.split('.');
    intPart = intPart.replace(/^0+(?=\d)/,'');
    intPart = intPart.slice(0,8);
    decPart = decPart.replace(/\D/g,'').slice(0,2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return decPart.length ? `${intFormatted}.${decPart}` : (s.endsWith('.') ? intFormatted+'.' : intFormatted);
  }

  /**
   * Convierte un importe formateado (ej. "1,234.56") a string normalizado ("1234.56").
   * Devuelve cadena vacía si no es válido.
   */
  function parseEsAmountToNormalized(raw){
    if (!raw) return '';
    let s = raw.replace(/,/g,'');
    if (!/^\d{1,8}(?:\.\d{0,2})?$/.test(s)) return '';
    return s;
  }

  function generarId() {
    return `budget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function procesarQuickCreateDesdeURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const quickCreate = params.get('quickCreate');

      if (quickCreate !== '1') return;

      abrirModalCrear();

      params.delete('quickCreate');
      const query = params.toString();
      const hash = window.location.hash || '';
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn('No se pudo procesar quickCreate desde URL:', e);
    }
  }

  

  function formatDate(date) {
    if (!date || !(date instanceof Date)) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function parseFechaInput(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    let day, month, year;
    
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length !== 3) return null;
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    } else if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length !== 3) return null;
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      return null;
    }
    
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

    if (raw && typeof raw.toDate === 'function') {
      const d = raw.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }

    if (raw && typeof raw === 'object' && Number.isFinite(raw.seconds)) {
      const d = new Date(raw.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const directa = new Date(raw);
    if (!Number.isNaN(directa.getTime())) return directa;

    if (typeof raw === 'string') {
      return parseFechaInput(raw);
    }

    return null;
  }

  function normalizarTipoTx(type) {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'income' || t === 'ingreso') return 'income';
    if (t === 'expense' || t === 'gasto') return 'expense';
    return '';
  }

  function transaccionCoincideTipoPresupuesto(tx, categoryId) {
    const txTipo = normalizarTipoTx(tx?.type);
    if (!txTipo) return false;

    const categoria = datosApp.categories.find(c => String(c.id) === String(categoryId));
    const fixedType = String(categoria?.fixedType || '').trim().toLowerCase();

    if (fixedType === 'income' || fixedType === 'expense') {
      return txTipo === fixedType;
    }

    return txTipo === 'expense';
  }

  function transaccionPerteneceACategoria(tx, categoryId) {
    if (String(tx?.categoryId ?? '') === String(categoryId)) return true;

    const categoria = datosApp.categories.find(c => String(c.id) === String(categoryId));
    if (!categoria) return false;

    const txCategoryName = String(tx?.categoryName || tx?.category || '').trim().toLowerCase();
    const categoriaNombre = String(categoria.name || '').trim().toLowerCase();
    return !!txCategoryName && txCategoryName === categoriaNombre;
  }

  function normalizarTransacciones(rawTransactions = []) {
    const categoryIdByName = new Map();
    datosApp.categories.forEach(cat => {
      const key = String(cat?.name || '').trim().toLowerCase();
      if (key) categoryIdByName.set(key, cat.id);
    });

    const seen = new Set();
    const result = [];

    (rawTransactions || []).forEach((tx, index) => {
      if (!tx || typeof tx !== 'object') return;

      let categoryId = tx.categoryId;
      if (categoryId == null || categoryId === '') {
        const key = String(tx.categoryName || tx.category || '').trim().toLowerCase();
        if (key && categoryIdByName.has(key)) categoryId = categoryIdByName.get(key);
      }

      const normalized = {
        ...tx,
        categoryId,
        categoryName: tx.categoryName || tx.category || null
      };

      const d = parseFechaFlexible(normalized.date);
      const dateKey = d ? d.toISOString() : String(normalized.date || '');
      const dedupeKey = [
        normalized.id || `idx_${index}`,
        String(normalized.categoryId ?? ''),
        String(Number(normalized.amount) || 0),
        String(normalized.type || ''),
        dateKey
      ].join('|');

      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      result.push(normalized);
    });

    return result;
  }

  function inicializar() {
    cargarElementosDOM();
    configurarEventos();
    configurarOrdenTabla();
    configurarDropdowns();
    cargarDatosIniciales();
    aplicarTemaGuardado();
    actualizarInfoUsuario();
    inicializarTooltipPerfil();
    // inicializarMiniCalendario(); // Removed because function is undefined
  }

  let elementos = {};

  function cargarElementosDOM() {
    elementos = {
      yearFilter: document.getElementById('yearFilter'),
      monthFilter: document.getElementById('monthFilter'),
      categoryFilter: document.getElementById('categoryFilter'),
      clearFiltersBtn: document.getElementById('clearFiltersBtn'),
      
      totalBudgeted: document.getElementById('totalBudgeted'),
      totalSpent: document.getElementById('totalSpent'),
      totalAvailable: document.getElementById('totalAvailable'),
      complianceRate: document.getElementById('complianceRate'),
      
      budgetsContainer: document.getElementById('budgetsContainer'),
      budgetsTableBody: document.getElementById('budgetsTableBody'),
      
      budgetModal: document.getElementById('budgetModal'),
      budgetModalTitle: document.getElementById('budgetModalTitle'),
      budgetForm: document.getElementById('budgetForm'),
      closeBudgetModal: document.getElementById('closeBudgetModal'),
      cancelBudgetBtn: document.getElementById('cancelBudgetBtn'),
      saveBudgetBtn: document.getElementById('saveBudgetBtn'),
      addBudgetBtn: document.getElementById('addBudgetBtn'),
      
      budgetCategoryDropdown: document.getElementById('budgetCategoryDropdown'),
      budgetCategory: document.getElementById('budgetCategory'),
      budgetAmount: document.getElementById('budgetAmount'),
      budgetPeriodDropdown: document.getElementById('budgetPeriodDropdown'),
      budgetPeriod: document.getElementById('budgetPeriod'),
      budgetStartDate: document.getElementById('budgetStartDate'),
      budgetEndDate: document.getElementById('budgetEndDate'),
      customPeriodGroup: document.getElementById('customPeriodGroup'),
      customEndGroup: document.getElementById('customEndGroup'),
      
      budgetTableSearch: document.getElementById('budgetTableSearch'),
      budgetTableInfo: document.getElementById('budgetTableInfo'),
      prevPageBtn: document.getElementById('prevPageBtn'),
      nextPageBtn: document.getElementById('nextPageBtn'),
      pageInfo: document.getElementById('pageInfo'),
      
      themeToggle: document.getElementById('themeToggle'),
      logoutButton: document.getElementById('logoutButton'),
      userInfoHover: document.getElementById('userInfoHover')
    };
  }

  function configurarEventos() {
    if (elementos.addBudgetBtn) {
      elementos.addBudgetBtn.addEventListener('click', abrirModalCrear);
    }
    
    if (elementos.clearFiltersBtn) {
      elementos.clearFiltersBtn.addEventListener('click', limpiarFiltros);
    }
    
    if (elementos.closeBudgetModal) {
      elementos.closeBudgetModal.addEventListener('click', cerrarModal);
    }
    
    if (elementos.cancelBudgetBtn) {
      elementos.cancelBudgetBtn.addEventListener('click', cerrarModal);
    }
    
    if (elementos.saveBudgetBtn) {
      elementos.saveBudgetBtn.addEventListener('click', guardarPresupuesto);
    }
    
    if (elementos.budgetPeriod) {
      elementos.budgetPeriod.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        if (elementos.customPeriodGroup) {
          elementos.customPeriodGroup.style.display = isCustom ? 'block' : 'none';
        }
        if (elementos.customEndGroup) {
          elementos.customEndGroup.style.display = isCustom ? 'block' : 'none';
        }
      });
    }
    
    if (elementos.budgetAmount) {
      elementos.budgetAmount.addEventListener('input', function () {
        const caret = this.selectionStart;
        const before = this.value;
        const formatted = formatInputAmountEs(before);
        this.value = formatted;
        const diff = this.value.length - before.length;
        try { this.setSelectionRange(caret + diff, caret + diff); } catch (err) {}
      });

      elementos.budgetAmount.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          guardarPresupuesto();
        }
      });
    }
    
    if (elementos.themeToggle) {
      elementos.themeToggle.addEventListener('click', alternarTema);
    }
    
    if (elementos.logoutButton) {
      elementos.logoutButton.addEventListener('click', cerrarSesion);
    }
    
    if (elementos.budgetTableSearch) {
      elementos.budgetTableSearch.addEventListener('input', debounce(buscarEnTabla, 300));
    }
    
    if (elementos.prevPageBtn) {
      elementos.prevPageBtn.addEventListener('click', () => cambiarPagina(-1));
    }
    
    if (elementos.nextPageBtn) {
      elementos.nextPageBtn.addEventListener('click', () => cambiarPagina(1));
    }

    document.addEventListener('click', (e) => {
      const btnDelete = e.target.closest('.btn-delete');
      if (btnDelete && btnDelete.dataset.id) {
        e.preventDefault();
        eliminarPresupuesto(btnDelete.dataset.id);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elementos.budgetModal && !elementos.budgetModal.classList.contains('hidden')) {
        cerrarModal();
      }
    });
  }

  function configurarOrdenTabla() {
    const headers = document.querySelectorAll('#budgetsTable thead th.sortable');
    if (!headers.length) return;

    headers.forEach(header => {
      header.addEventListener('click', () => {
        const key = header.getAttribute('data-key');
        if (!key) return;

        if (ordenTabla.key === key) {
          ordenTabla.direction = ordenTabla.direction === 'asc' ? 'desc' : 'asc';
        } else {
          ordenTabla.key = key;
          ordenTabla.direction = 'asc';
        }

        paginaActual = 1;
        actualizarIndicadoresOrdenTabla();
        renderizarTabla();
      });
    });

    actualizarIndicadoresOrdenTabla();
  }

  function actualizarIndicadoresOrdenTabla() {
    const headers = document.querySelectorAll('#budgetsTable thead th.sortable');

    headers.forEach(header => {
      const icon = header.querySelector('.sort-icon');
      if (!icon) return;

      icon.classList.remove('fa-sort', 'fa-sort-up', 'fa-sort-down');

      if (header.getAttribute('data-key') === ordenTabla.key) {
        icon.classList.add(ordenTabla.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
      } else {
        icon.classList.add('fa-sort');
      }
    });
  }

  function configurarDropdowns() {
    generarOpcionesAnio();
    
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
      const selected = dropdown.querySelector('.custom-dropdown-selected');
      const options = dropdown.querySelector('.custom-dropdown-options');
      
      if (!selected || !options) return;
      
      selected.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        
        document.querySelectorAll('.custom-dropdown.open').forEach(d => {
          d.classList.remove('open');
        });
        
        if (!isOpen) {
          dropdown.classList.add('open');
        }
      });
      
      options.addEventListener('click', (e) => {
        if (e.target.classList.contains('custom-dropdown-option')) {
          const value = e.target.getAttribute('data-value');
          const text = e.target.textContent;
          
          selected.querySelector('span').textContent = text;
          selected.setAttribute('data-value', value);
          
          options.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
          });
          e.target.classList.add('selected');
          
          dropdown.classList.remove('open');
          
          if (dropdown.id === 'yearFilter') {
            filtros.year = value || null;
            aplicarFiltros();
          } else if (dropdown.id === 'monthFilter') {
            filtros.month = value ? parseInt(value) : null;
            aplicarFiltros();
          } else if (dropdown.id === 'categoryFilter') {
            filtros.category = value || null;
            aplicarFiltros();
          } else if (dropdown.id === 'budgetCategoryDropdown') {
            if (elementos.budgetCategory) {
              elementos.budgetCategory.value = value || '';
            }
          } else if (dropdown.id === 'budgetPeriodDropdown') {
            if (elementos.budgetPeriod) {
              elementos.budgetPeriod.value = value || '';
              elementos.budgetPeriod.dispatchEvent(new Event('change'));
            }
            actualizarSeleccionPeriodo(value || 'monthly');
          }
        }
      });
    });
    
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
      });
    });
  }

  function generarOpcionesAnio() {
    const yearFilter = elementos.yearFilter;
    if (!yearFilter) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');
    
    if (!optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    
    const allYearsOption = document.createElement('div');
    allYearsOption.className = 'custom-dropdown-option selected';
    allYearsOption.setAttribute('data-value', '');
    allYearsOption.textContent = 'Todos los años';
    optionsContainer.appendChild(allYearsOption);
    
    for (let year = startYear; year <= currentYear; year++) {
      const option = document.createElement('div');
      option.className = 'custom-dropdown-option';
      option.setAttribute('data-value', year);
      option.textContent = year;
      optionsContainer.appendChild(option);
    }
  }

  async function cargarDatosIniciales() {
    try {
      let data = null;
      try {
        if (window.Core?.storeFactories?.createFirestoreStore) {
          const store = window.Core.storeFactories.createFirestoreStore();
          data = await store.load();
        } else if (window.DataStore && typeof window.DataStore.loadData === 'function') {
          data = await window.DataStore.loadData();
        }
      } catch (e) {
      }

      let dataFromLocalStore = null;
      try {
        if (window.Core?.storeFactories?.createLocalStorageStore) {
          const localStore = window.Core.storeFactories.createLocalStorageStore();
          dataFromLocalStore = await localStore.load();
        }
      } catch (e) {
      }

      const categoriesFromStore = Array.isArray(data?.categories) ? data.categories : [];
      const transactionsFromStore = Array.isArray(data?.transactions) ? data.transactions : [];

      const categoriesFromLocalStore = Array.isArray(dataFromLocalStore?.categories)
        ? dataFromLocalStore.categories
        : [];
      const transactionsFromLocalStore = Array.isArray(dataFromLocalStore?.transactions)
        ? dataFromLocalStore.transactions
        : [];

      const categoriesFromLocal = (() => {
        try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch { return []; }
      })();
      const transactionsFromLocal = (() => {
        try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; }
      })();

      datosApp.categories = categoriesFromStore.length
        ? categoriesFromStore
        : (categoriesFromLocalStore.length ? categoriesFromLocalStore : categoriesFromLocal);

      const transactionsFromCategories = [];
      datosApp.categories.forEach(cat => {
        if (Array.isArray(cat?.transactions)) {
          transactionsFromCategories.push(...cat.transactions.map(t => ({
            ...t,
            categoryId: cat.id,
            categoryName: cat.name
          })));
        }
      });

      datosApp.transactions = normalizarTransacciones([
        ...transactionsFromStore,
        ...transactionsFromLocalStore,
        ...transactionsFromLocal,
        ...transactionsFromCategories
      ]);
      
      const budgetData = localStorage.getItem('finanzapp:budgets');
      if (budgetData) {
        try {
          datosApp.budgets = JSON.parse(budgetData);
        } catch (e) {
          datosApp.budgets = [];
        }
      }
      
      actualizarCategorias();
      // Actualizar nombres guardados (p.ej. reemplazar 'weekly' por 'Semanal')
      try {
        actualizarNombresPeriodosGuardados();
      } catch (e) { console.warn('Error actualizando nombres de periodo:', e); }

      // Revisar y renovar presupuestos vencidos automáticamente (mantener resumen del periodo anterior)
      try {
        const renewals = revisarYRenovarPresupuestos();
        renderizarTodo();
        if (renewals && renewals.length) {
          let html = '<p>Se renovaron los siguientes presupuestos y se registró su estado anterior:</p><ul>';
          renewals.forEach(r => {
            html += `<li><strong>${escapeHtml(r.name)}</strong> (${formatDate(new Date(r.startDate))} - ${formatDate(new Date(r.endDate))}): Gastado ${formatCurrency(r.spent)} de ${formatCurrency(r.amount)} — <em>${r.status === 'completed' ? 'Cumplido' : 'No cumplido'}</em></li>`;
          });
          html += '</ul>';
          if (typeof showAlert === 'function') {
            await showAlert('Renovación de presupuestos', html, { isHtml: true });
          } else {
            mostrarInfo('Se renovaron presupuestos. Revisa la sección de presupuestos.');
          }
        }
      } catch (e) {
        console.error('Error revisando renovaciones de presupuestos', e);
        renderizarTodo();
      }

      procesarQuickCreateDesdeURL();
    } catch (error) {
      mostrarError('Error al cargar los datos');
    }
  }

  

  function guardarPresupuestos() {
    try {
      localStorage.setItem('finanzapp:budgets', JSON.stringify(datosApp.budgets));
    } catch (e) {
    }
  }

  // ===== Helpers para renovación automática =====
  function calcularGastadoEnRango(categoryId, startDate, endDate) {
    try {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      const gastos = datosApp.transactions.filter(t => {
        if (!transaccionCoincideTipoPresupuesto(t, categoryId)) return false;
        if (!transaccionPerteneceACategoria(t, categoryId)) return false;
        const txDate = parseFechaFlexible(t.date);
        if (!txDate) return false;
        return txDate >= start && txDate <= end;
      });
      return gastos.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } catch (e) {
      return 0;
    }
  }

  // Normaliza los nombres guardados para que no incluyan el periodo,
  // ya que este se muestra en el chip visual de cada tarjeta.
  function actualizarNombresPeriodosGuardados() {
    try {
      if (!Array.isArray(datosApp.budgets) || !Array.isArray(datosApp.categories)) return;
      let changed = false;
      datosApp.budgets.forEach(b => {
        try {
          if (!b) return;
          const cat = datosApp.categories.find(c => String(c.id) === String(b.categoryId));
          const nuevo = String(cat?.name || 'Sin categoría').trim();
          if (nuevo && b.name !== nuevo) {
            b.name = nuevo;
            changed = true;
          }
        } catch (e) {}
      });
      if (changed) guardarPresupuestos();
    } catch (e) {
      console.error('Error migrando nombres de periodo:', e);
    }
  }

  function addDays(d, days) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  }

  function getNextPeriodRange(startDate, endDate, period) {
    const s = new Date(startDate);
    const e = new Date(endDate);

    if (period === 'weekly') {
      const newStart = addDays(e, 1);
      const newEnd = addDays(newStart, 6);
      return { newStart, newEnd };
    }

    if (period === 'biweekly') {
      // Quincenal: 15 días
      const newStart = addDays(e, 1);
      const newEnd = addDays(newStart, 14);
      return { newStart, newEnd };
    }

    if (period === 'monthly') {
      // Avanzar al primer día del siguiente mes
      const newStart = new Date(s.getFullYear(), s.getMonth() + 1, 1);
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      return { newStart, newEnd };
    }

    if (period === 'yearly') {
      const newStart = new Date(s.getFullYear() + 1, 0, 1);
      const newEnd = new Date(newStart.getFullYear(), 11, 31);
      return { newStart, newEnd };
    }

    // Por defecto no cambiar
    return { newStart: addDays(e, 1), newEnd: addDays(e, 1) };
  }

  /**
   * Revisa presupuestos vencidos y los renueva al siguiente periodo.
   * Devuelve un array con los resúmenes (periodo anterior) para notificar al usuario.
   */
  function revisarYRenovarPresupuestos() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const summaries = [];
    let changed = false;

    datosApp.budgets.forEach(budget => {
      if (!budget || budget.period === 'custom') return;

      try {
        let start = new Date(budget.startDate);
        let end = new Date(budget.endDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);

        let anyRenewed = false;
        let lastSummary = null;

        while (end < today) {
          const spent = calcularGastadoEnRango(budget.categoryId, start.toISOString(), end.toISOString());
          const status = (spent <= (Number(budget.amount) || 0)) ? 'completed' : 'failed';

          lastSummary = {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            amount: Number(budget.amount) || 0,
            spent,
            status
          };

          const { newStart, newEnd } = getNextPeriodRange(start, end, budget.period);
          start = newStart;
          end = newEnd;
          anyRenewed = true;
        }

        if (anyRenewed && lastSummary) {
          budget.lastPeriodSummary = lastSummary;
          budget.startDate = start.toISOString();
          budget.endDate = end.toISOString();
          budget.lastRenewedAt = new Date().toISOString();
          summaries.push({ id: budget.id, name: budget.name, ...lastSummary });
          changed = true;
        }
      } catch (e) {
        console.error('Error renovando presupuesto', budget && budget.id, e);
      }
    });

    if (changed) guardarPresupuestos();
    return summaries;
  }
  // ===== Fin helpers renovación =====

  function actualizarCategorias() {
    const categorySelect = elementos.budgetCategory;
    const categoryFilter = elementos.categoryFilter;
    const budgetDropdown = elementos.budgetCategoryDropdown;
    
    const categoriasPresupuestables = datosApp.categories.filter(cat => {
      const ft = String(cat?.fixedType || '').trim().toLowerCase();
      return ft !== 'income' && ft !== 'ingreso';
    });

    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
      
      categoriasPresupuestables.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
      });
    }

    if (budgetDropdown) {
      const optionsContainer = budgetDropdown.querySelector('.custom-dropdown-options');
      const selected = budgetDropdown.querySelector('.custom-dropdown-selected');

      if (optionsContainer && selected) {
        optionsContainer.innerHTML = '<div class="custom-dropdown-option selected" data-value="">Selecciona una categoría</div>';

        categoriasPresupuestables.forEach(cat => {
          const option = document.createElement('div');
          option.className = 'custom-dropdown-option';
          option.setAttribute('data-value', cat.id);
          option.textContent = cat.name;
          optionsContainer.appendChild(option);
        });

        const currentValue = categorySelect?.value || '';
        actualizarSeleccionCategoria(currentValue);
      }
    }
    
    if (categoryFilter) {
      const optionsContainer = categoryFilter.querySelector('.custom-dropdown-options');
      if (optionsContainer) {
        optionsContainer.innerHTML = '<div class="custom-dropdown-option selected" data-value="">Todas las categorías</div>';
        
        datosApp.categories.forEach(cat => {
          const option = document.createElement('div');
          option.className = 'custom-dropdown-option';
          option.setAttribute('data-value', cat.id);
          option.textContent = cat.name;
          optionsContainer.appendChild(option);
        });
      }
    }
  }

  function calcularGastado(budget) {
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const gastos = datosApp.transactions.filter(t => {
      if (!transaccionCoincideTipoPresupuesto(t, budget.categoryId)) return false;
      if (!transaccionPerteneceACategoria(t, budget.categoryId)) return false;
      
      const txDate = parseFechaFlexible(t.date);
      if (!txDate) return false;
      return txDate >= startDate && txDate <= endDate;
    });
    
    return gastos.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  function calcularEstadisticas() {
    let totalPresupuestado = 0;
    let totalGastado = 0;
    let presupuestosDentroDeLimite = 0;
    
    const presupuestosFiltrados = obtenerPresupuestosFiltrados();
    
    presupuestosFiltrados.forEach(budget => {
      const gastado = calcularGastado(budget);
      totalPresupuestado += budget.amount;
      totalGastado += gastado;
      
      if (gastado <= budget.amount) {
        presupuestosDentroDeLimite++;
      }
    });
    
    const totalDisponible = totalPresupuestado - totalGastado;
    const tasaCumplimiento = presupuestosFiltrados.length > 0 
      ? (presupuestosDentroDeLimite / presupuestosFiltrados.length) * 100 
      : 0;
    
    return {
      totalPresupuestado,
      totalGastado,
      totalDisponible,
      tasaCumplimiento
    };
  }

  function obtenerPresupuestosFiltrados() {
    return datosApp.budgets.filter(budget => {
      if (filtros.category && String(budget.categoryId) !== String(filtros.category)) {
        return false;
      }
      
      if (filtros.year) {
        const startDate = new Date(budget.startDate);
        if (startDate.getFullYear() !== parseInt(filtros.year)) {
          return false;
        }
      }
      
      if (filtros.month !== null) {
        const startDate = new Date(budget.startDate);
        if (startDate.getMonth() !== filtros.month) {
          return false;
        }
      }
      
      return true;
    });
  }

  function renderizarTodo() {
    actualizarResumen();
    renderizarTarjetasPresupuestos();
    renderizarTabla();
  }

  function actualizarResumen() {
    const stats = calcularEstadisticas();
    
    if (elementos.totalBudgeted) {
      elementos.totalBudgeted.textContent = formatCurrency(stats.totalPresupuestado);
    }
    
    if (elementos.totalSpent) {
      elementos.totalSpent.textContent = formatCurrency(stats.totalGastado);
    }
    
    if (elementos.totalAvailable) {
      elementos.totalAvailable.textContent = formatCurrency(stats.totalDisponible);
    }
    
    if (elementos.complianceRate) {
      elementos.complianceRate.textContent = `${Math.round(stats.tasaCumplimiento)}%`;
    }
  }

  function renderizarTarjetasPresupuestos() {
    const container = elementos.budgetsContainer;
    if (!container) return;
    
    const presupuestosFiltrados = obtenerPresupuestosFiltrados();
    
    if (presupuestosFiltrados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-invoice-dollar"></i>
          <p>No hay presupuestos creados</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    presupuestosFiltrados.forEach(budget => {
      const gastado = calcularGastado(budget);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = datosApp.categories.find(c => String(c.id) === String(budget.categoryId));
      
      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }
      
      const last = budget.lastPeriodSummary;
      let lastHtml = '';
      if (last) {
        const statusClass = last.status === 'completed' ? 'completed' : 'failed';
        lastHtml = `<div class="prev-period-summary ${statusClass}">Anterior (${formatDate(new Date(last.startDate))} - ${formatDate(new Date(last.endDate))}): ${formatCurrency(last.spent)} / ${formatCurrency(last.amount)} — ${last.status === 'completed' ? 'Cumplido' : 'No cumplido'}</div>`;
      }

      const card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = `
        <div class="card-top">
          <h3>
            ${escapeHtml(getBudgetDisplayName(budget, categoria))}
          </h3>
          <span class="period-chip">${getPeriodText(budget.period)}</span>
        </div>
        
        <div class="budget-stats">
          <div class="stat-row">
            <span>Categoría:</span>
            <strong>${escapeHtml(categoria?.name || 'Sin categoría')}</strong>
          </div>
          <div class="stat-row">
            <span>Presupuestado:</span>
            <strong class="stat-value-budgeted">${formatCurrency(budget.amount)}</strong>
          </div>
          <div class="stat-row">
            <span>Gastado:</span>
            <strong class="stat-value-spent">${formatCurrency(gastado)}</strong>
          </div>
          <div class="stat-row">
            <span>Restante:</span>
            <strong class="stat-value-remaining">${formatCurrency(restante)}</strong>
          </div>
        </div>
        ${lastHtml}
        
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
          <button class="btn btn-icon btn-sync app-tooltip" data-tooltip="Sincronizar" data-id="${budget.id}">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="btn btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      const btnSync = card.querySelector('.btn-sync');
      const btnEdit = card.querySelector('.btn-edit');
      const btnDelete = card.querySelector('.btn-delete');
      
      if (btnSync) {
        btnSync.addEventListener('click', () => sincronizarPresupuesto(budget.id));
      }
      
      if (btnEdit) {
        btnEdit.addEventListener('click', () => editarPresupuesto(budget.id));
      }
      
      if (btnDelete) {
        btnDelete.addEventListener('click', () => eliminarPresupuesto(budget.id));
      }
      
      container.appendChild(card);
    });
  }

  function renderizarTabla() {
    const tbody = elementos.budgetsTableBody;
    if (!tbody) return;

    const term = (elementos.budgetTableSearch?.value || '').trim().toLowerCase();

    let filasTabla = obtenerPresupuestosFiltrados().map(budget => {
      const gastado = calcularGastado(budget);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = datosApp.categories.find(c => String(c.id) === String(budget.categoryId));

      return {
        budget,
        categoriaNombre: categoria?.name || 'Sin categoría',
        gastado,
        restante,
        progreso
      };
    });

    if (term) {
      filasTabla = filasTabla.filter(item => {
        const texto = [
          getBudgetDisplayName(item.budget, { name: item.categoriaNombre }),
          item.categoriaNombre,
          getPeriodText(item.budget.period),
          formatCurrency(item.budget.amount),
          formatCurrency(item.gastado),
          formatCurrency(item.restante)
        ].join(' ').toLowerCase();

        return texto.includes(term);
      });
    }

    if (ordenTabla.key) {
      const multiplier = ordenTabla.direction === 'asc' ? 1 : -1;

      filasTabla.sort((a, b) => {
        switch (ordenTabla.key) {
          case 'name':
            return getBudgetDisplayName(a.budget, { name: a.categoriaNombre })
              .localeCompare(getBudgetDisplayName(b.budget, { name: b.categoriaNombre }), 'es') * multiplier;
          case 'category':
            return a.categoriaNombre.localeCompare(b.categoriaNombre, 'es') * multiplier;
          case 'amount':
            return (a.budget.amount - b.budget.amount) * multiplier;
          case 'spent':
            return (a.gastado - b.gastado) * multiplier;
          case 'remaining':
            return (a.restante - b.restante) * multiplier;
          case 'progress':
            return (a.progreso - b.progreso) * multiplier;
          default:
            return 0;
        }
      });
    }

    const totalItems = filasTabla.length;

    if (totalItems === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem;">
            No hay presupuestos para mostrar
          </td>
        </tr>
      `;

      if (elementos.budgetTableInfo) {
        elementos.budgetTableInfo.textContent = 'Mostrando 0 de 0 presupuestos';
      }

      if (elementos.pageInfo) {
        elementos.pageInfo.textContent = 'Página 1 de 1';
      }

      if (elementos.prevPageBtn) elementos.prevPageBtn.disabled = true;
      if (elementos.nextPageBtn) elementos.nextPageBtn.disabled = true;

      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    const inicio = itemsPorPagina === Infinity ? 0 : (paginaActual - 1) * itemsPorPagina;
    const fin = itemsPorPagina === Infinity ? totalItems : Math.min(inicio + itemsPorPagina, totalItems);
    const filasPagina = filasTabla.slice(inicio, fin);

    tbody.innerHTML = '';

    filasPagina.forEach(item => {
      const { budget, categoriaNombre, gastado, restante, progreso } = item;
      
      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(getBudgetDisplayName(budget, { name: categoriaNombre }))}</td>
        <td>${escapeHtml(categoriaNombre)}</td>
        <td>${formatCurrency(budget.amount)}</td>
        <td>${formatCurrency(gastado)}</td>
        <td class="${restante < 0 ? 'text-danger' : ''}">${formatCurrency(restante)}</td>
        <td>
          <div class="progress-bar-small">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(progreso, 100)}%"></div>
          </div>
          <span class="progress-text">${Math.min(progreso, 100).toFixed(1)}%</span>
        </td>
        <td>
          <button class="btn btn-sm btn-icon btn-sync app-tooltip" data-tooltip="Sincronizar" data-id="${budget.id}">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      const btnSync = row.querySelector('.btn-sync');
      const btnEdit = row.querySelector('.btn-edit');
      const btnDelete = row.querySelector('.btn-delete');
      
      if (btnSync) {
        btnSync.addEventListener('click', () => sincronizarPresupuesto(budget.id));
      }
      
      if (btnEdit) {
        btnEdit.addEventListener('click', () => editarPresupuesto(budget.id));
      }
      
      if (btnDelete) {
        btnDelete.addEventListener('click', () => eliminarPresupuesto(budget.id));
      }
      
      tbody.appendChild(row);
    });

    if (elementos.budgetTableInfo) {
      elementos.budgetTableInfo.textContent = `Mostrando ${inicio + 1} a ${fin} de ${totalItems} presupuestos`;
    }

    if (elementos.pageInfo) {
      elementos.pageInfo.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    }

    if (elementos.prevPageBtn) {
      elementos.prevPageBtn.disabled = paginaActual <= 1;
    }

    if (elementos.nextPageBtn) {
      elementos.nextPageBtn.disabled = paginaActual >= totalPaginas;
    }
  }



  function abrirModalCrear() {
    editingBudgetId = null;
    
    if (elementos.budgetModalTitle) {
      elementos.budgetModalTitle.innerHTML = '<i class="fas fa-plus"></i> Crear Presupuesto';
    }
    
    if (elementos.budgetForm) {
      elementos.budgetForm.reset();
    }

    if (elementos.budgetCategory) {
      elementos.budgetCategory.value = '';
    }
    actualizarSeleccionCategoria('');

    if (elementos.budgetPeriod) {
      elementos.budgetPeriod.value = '';
      elementos.budgetPeriod.dispatchEvent(new Event('change'));
    }
    actualizarSeleccionPeriodo('');
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    if (elementos.budgetStartDate) {
      elementos.budgetStartDate.value = formatDate(firstDay);
    }
    
    if (elementos.budgetEndDate) {
      elementos.budgetEndDate.value = formatDate(lastDay);
    }
    
    mostrarModal(elementos.budgetModal);
  }

  function editarPresupuesto(budgetId) {
    const budget = datosApp.budgets.find(b => b.id === budgetId);
    if (!budget) {
      mostrarError('Presupuesto no encontrado');
      return;
    }
    
    editingBudgetId = budgetId;
    
    if (elementos.budgetModalTitle) {
      elementos.budgetModalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Presupuesto';
    }
    
    if (elementos.budgetCategory) elementos.budgetCategory.value = budget.categoryId;
    actualizarSeleccionCategoria(budget.categoryId);
    if (elementos.budgetAmount) {
      const n = Number(budget.amount) || 0;
      const parts = n % 1 === 0 ? [String(n), ''] : n.toFixed(2).split('.');
      const formattedInt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      elementos.budgetAmount.value = (parts[1] && parts[1] !== '00') ? formattedInt + '.' + parts[1] : formattedInt;
    }
    if (elementos.budgetPeriod) elementos.budgetPeriod.value = budget.period;
    
    if (budget.period === 'custom') {
      if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'block';
      if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'block';
      
      if (elementos.budgetStartDate && budget.startDate) {
        const dateObj = new Date(budget.startDate);
        elementos.budgetStartDate.value = formatDate(dateObj);
      }
      if (elementos.budgetEndDate && budget.endDate) {
        const dateObj = new Date(budget.endDate);
        elementos.budgetEndDate.value = formatDate(dateObj);
      }
    }
    
    mostrarModal(elementos.budgetModal);
  }

  function actualizarSeleccionCategoria(value) {
    const dropdown = elementos.budgetCategoryDropdown;
    if (!dropdown) return;

    const selected = dropdown.querySelector('.custom-dropdown-selected');
    const options = dropdown.querySelector('.custom-dropdown-options');
    if (!selected || !options) return;

    const optionsList = Array.from(options.querySelectorAll('.custom-dropdown-option'));
    optionsList.forEach(opt => opt.classList.remove('selected'));

    const valueStr = value == null ? '' : String(value);
    const match = optionsList.find(opt => opt.getAttribute('data-value') === valueStr);

    if (match) {
      match.classList.add('selected');
      selected.querySelector('span').textContent = match.textContent;
      selected.setAttribute('data-value', valueStr);
    } else {
      selected.querySelector('span').textContent = 'Selecciona una categoría';
      selected.setAttribute('data-value', '');
    }
  }

  function actualizarSeleccionPeriodo(value) {
    const dropdown = elementos.budgetPeriodDropdown;
    if (!dropdown) return;

    const selected = dropdown.querySelector('.custom-dropdown-selected');
    const options = dropdown.querySelector('.custom-dropdown-options');
    if (!selected || !options) return;

    const optionsList = Array.from(options.querySelectorAll('.custom-dropdown-option'));
    optionsList.forEach(opt => opt.classList.remove('selected'));

    const valueStr = value == null ? 'monthly' : String(value);
    const match = optionsList.find(opt => opt.getAttribute('data-value') === valueStr);

    if (match) {
      match.classList.add('selected');
      selected.querySelector('span').textContent = match.textContent;
      selected.setAttribute('data-value', valueStr);
    }
  }

  function sincronizarPresupuesto(budgetId) {
    const budget = datosApp.budgets.find(b => String(b.id) === String(budgetId));
    if (!budget) return;

    if (budget.period === 'custom') {
      mostrarAdvertencia('Los presupuestos personalizados no se pueden sincronizar automáticamente. Usa Editar para ajustar las fechas.');
      return;
    }

    const categoria = datosApp.categories.find(c => String(c.id) === String(budget.categoryId));
    const nombre = getBudgetDisplayName(budget, categoria);

    cerrarDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = 'confirm-drawer confirm-drawer-primary';
    drawer.setAttribute('role', 'dialog');
    drawer.innerHTML = `
      <div class="confirm-drawer-handle"></div>
      <p class="confirm-drawer-msg">Sincronizar <strong>${escapeHtml(nombre)}</strong><br><small>¿Desde cuándo quieres que este presupuesto cuente transacciones?</small></p>
      <div class="confirm-drawer-btns sync-drawer-btns">
        <button class="confirm-drawer-cancel">Cancelar</button>
        <button class="btn-sync-desde-hoy"><i class="fas fa-calendar-day"></i> Desde hoy</button>
        <button class="btn-sync-con-historial"><i class="fas fa-history"></i> Con historial del período</button>
      </div>
    `;
    document.body.appendChild(drawer);
    activeDrawer = drawer;

    requestAnimationFrame(() => {
      drawer.classList.add('drawer-show');
      overlay.classList.add('drawer-overlay-show');
    });

    drawer.querySelector('.confirm-drawer-cancel').addEventListener('click', cerrarDrawer);
    overlay.addEventListener('click', () => { if (window.innerWidth <= 980) cerrarDrawer(); });

    drawer.querySelector('.btn-sync-desde-hoy').addEventListener('click', () => {
      cerrarDrawer();
      aplicarSincronizacion(budget, 'fresh');
    });

    drawer.querySelector('.btn-sync-con-historial').addEventListener('click', () => {
      cerrarDrawer();
      aplicarSincronizacion(budget, 'history');
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cerrarDrawer(); document.removeEventListener('keydown', handler); }
    });
  }

  function aplicarSincronizacion(budget, modo) {
    const now = new Date();
    let startDate, endDate;

    if (modo === 'fresh') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (budget.period === 'weekly') {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (budget.period === 'biweekly') {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);
      } else if (budget.period === 'monthly') {
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        endDate = new Date(now.getFullYear(), 11, 31);
      }
    } else {
      // "Con historial": retrocede hasta la transacción más antigua de la categoría
      const txsCategoria = (datosApp.transactions || []).filter(t =>
        transaccionPerteneceACategoria(t, budget.categoryId)
      );
      const fechas = txsCategoria
        .map(t => parseFechaFlexible(t.date))
        .filter(Boolean);

      if (fechas.length > 0) {
        startDate = new Date(Math.min(...fechas.map(d => d.getTime())));
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      endDate = new Date(now.getFullYear() + 1, 11, 31);
      endDate.setHours(23, 59, 59, 999);
    }

    const idx = datosApp.budgets.findIndex(b => String(b.id) === String(budget.id));
    if (idx === -1) return;

    datosApp.budgets[idx] = {
      ...datosApp.budgets[idx],
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      updatedAt: new Date().toISOString()
    };

    guardarPresupuestos();
    renderizarTodo();
    mostrarExito(modo === 'fresh' ? 'Presupuesto reiniciado desde hoy.' : 'Presupuesto sincronizado con el período actual.');
  }

  async function eliminarPresupuesto(budgetId) {
    const budget = datosApp.budgets.find(b => b.id === budgetId);
    if (!budget) return;
    const categoria = datosApp.categories.find(c => String(c.id) === String(budget.categoryId));
    
    const safeName = getBudgetDisplayName(budget, categoria)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');

    const ejecutar = () => {
      datosApp.budgets = datosApp.budgets.filter(b => b.id !== budgetId);
      guardarPresupuestos();
      renderizarTodo();
      mostrarExito('Presupuesto eliminado correctamente');
    };

    if (window.__appConfirmDelete === false) {
      ejecutar();
      return;
    }

    mostrarBottomDrawer({
      mensaje: `¿Estás seguro de que deseas eliminar el presupuesto "<strong>${safeName}</strong>"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: ejecutar
    });
  }

  function guardarPresupuesto() {
    const categoryValue =
      elementos.budgetCategory?.value ||
      elementos.budgetCategoryDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ||
      '';

    if (!categoryValue) {
      mostrarAdvertencia('Debes seleccionar una categoría');
      const cd = elementos.budgetCategoryDropdown;
      if (cd) {
        cd.classList.add('open');
        cd.querySelector('.custom-dropdown-selected')?.focus();
      } else {
        elementos.budgetCategory?.focus();
      }
      return;
    }

    if (elementos.budgetCategory) {
      elementos.budgetCategory.value = categoryValue;
    }
    
    const amountStr = (elementos.budgetAmount.value || '').trim();
    const normalized = parseEsAmountToNormalized(amountStr);
    if (!normalized) {
      mostrarAdvertencia('El monto debe ser un número mayor a 0');
      elementos.budgetAmount.focus();
      return;
    }
    const amount = parseFloat(normalized);
    if (isNaN(amount) || amount <= 0) {
      mostrarAdvertencia('El monto debe ser un número mayor a 0');
      elementos.budgetAmount.focus();
      return;
    }
    
    const period =
      elementos.budgetPeriod?.value ||
      elementos.budgetPeriodDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ||
      '';

    if (elementos.budgetPeriod) {
      elementos.budgetPeriod.value = period;
    }

    // Validación: exigir selección de período antes de continuar
    if (!period) {
      mostrarAdvertencia('Selecciona un período para el presupuesto');
      // abrir el dropdown visual para que el usuario lo vea
      const pd = elementos.budgetPeriodDropdown;
      if (pd) {
        pd.classList.add('open');
        const sel = pd.querySelector('.custom-dropdown-selected');
        if (sel && sel.focus) {
          sel.setAttribute('tabindex', '-1');
          sel.focus();
        }
      }
      return;
    }

    let startDate, endDate;
    
    if (period === 'custom') {
      if (!elementos.budgetStartDate.value || !elementos.budgetEndDate.value) {
        mostrarAdvertencia('Debes especificar las fechas de inicio y fin');
        return;
      }
      
      startDate = parseFechaInput(elementos.budgetStartDate.value);
      endDate = parseFechaInput(elementos.budgetEndDate.value);
      
      if (!startDate || !endDate) {
        mostrarAdvertencia('Las fechas ingresadas no son válidas');
        return;
      }
      
      if (endDate <= startDate) {
        mostrarAdvertencia('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }
    } else {
      const now = new Date();
      if (period === 'weekly') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (period === 'biweekly') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }
    }
    
    const cat = datosApp.categories?.find(c => String(c.id) === String(categoryValue));
    const budgetData = {
      id: editingBudgetId || generarId(),
      name: String(cat?.name || 'Sin categoría').trim(),
      categoryId: categoryValue,
      amount: amount,
      period: period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: editingBudgetId 
        ? datosApp.budgets.find(b => b.id === editingBudgetId)?.createdAt 
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (editingBudgetId) {
      const index = datosApp.budgets.findIndex(b => b.id === editingBudgetId);
      if (index !== -1) {
        datosApp.budgets[index] = budgetData;
        mostrarExito('Presupuesto actualizado correctamente');
      }
    } else {
      const duplicado = datosApp.budgets.find(b => String(b.categoryId) === String(categoryValue));
      if (duplicado) {
        mostrarAdvertencia(`Ya existe un presupuesto para la categoría "${duplicado.name || 'esta categoría'}"`);
        return;
      }
      datosApp.budgets.push(budgetData);
      mostrarExito('Presupuesto creado correctamente');
    }
    
    guardarPresupuestos();
    cerrarModal();
    renderizarTodo();
  }

  function cerrarModal() {
    if (elementos.budgetModal) {
      elementos.budgetModal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
    
    editingBudgetId = null;
    
    if (elementos.budgetForm) {
      elementos.budgetForm.reset();
    }

    // Limpiar campos de fecha personalizados
    if (elementos.budgetStartDate) elementos.budgetStartDate.value = '';
    if (elementos.budgetEndDate) elementos.budgetEndDate.value = '';
    if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'none';
    if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'none';
  }

  function mostrarModal(modal) {
    if (!modal) return;
    
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.classList.add('hidden');
    });
    
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    const firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  function aplicarFiltros() {
    paginaActual = 1;
    renderizarTodo();
  }

  function limpiarFiltros() {
    filtros = {
      year: null,
      month: null,
      category: null
    };
    
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
      const selected = dropdown.querySelector('.custom-dropdown-selected');
      const options = dropdown.querySelectorAll('.custom-dropdown-option');
      
      if (selected && options.length > 0) {
        const firstOption = options[0];
        selected.querySelector('span').textContent = firstOption.textContent;
        selected.setAttribute('data-value', '');
        
        options.forEach((opt, i) => {
          opt.classList.toggle('selected', i === 0);
        });
      }
    });
    
    paginaActual = 1;
    renderizarTodo();
    mostrarInfo('Filtros limpiados');
  }

  function buscarEnTabla() {
    paginaActual = 1;
    renderizarTabla();
  }

  let paginaActual = 1;
  const itemsPorPagina = window.__appTxPerPage || 10;
  let ordenTabla = {
    key: null,
    direction: 'asc'
  };

  function cambiarPagina(direccion) {
    const nuevaPagina = paginaActual + direccion;
    if (nuevaPagina < 1) return;
    paginaActual = nuevaPagina;
    renderizarTabla();
  }

  function aplicarTemaGuardado() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    aplicarTema(savedTheme);
  }

  function alternarTema() {
    const currentTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    aplicarTema(newTheme);
  }

  function aplicarTema(theme) {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      body.setAttribute('data-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
      body.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('theme', theme);
    actualizarIconoTema(theme);
  }

  function actualizarIconoTema(theme) {
    const icon = elementos.themeToggle?.querySelector('i');
    if (icon) {
      icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  function actualizarInfoUsuario() {
    try {
      const raw = localStorage.getItem('authUser');
      const profile = raw && raw !== 'guest'
        ? JSON.parse(raw)
        : { name: 'Invitado', email: '', picture: '' };

      const displayName = profile.name || profile.displayName || profile.email?.split('@')[0] || 'Usuario';
      const displayEmail = profile.email || '';
      const picture = profile.picture || profile.photoURL || '';

      if (elementos.userInfoHover) {
        const nameEl = elementos.userInfoHover.querySelector('.user-name');
        const emailEl = elementos.userInfoHover.querySelector('.user-email');

        if (nameEl) {
          nameEl.textContent = displayName;
          nameEl.setAttribute('aria-label', displayName);
        }
        if (emailEl) {
          emailEl.textContent = displayEmail;
          if (displayEmail) {
            emailEl.setAttribute('aria-label', displayEmail);
            emailEl.style.display = 'block';
          } else {
            emailEl.removeAttribute('aria-label');
            emailEl.style.display = 'none';
          }
        }
      }

      const avatarEl = document.querySelector('.user-avatar');
      if (avatarEl) {
        avatarEl.innerHTML = '';
        if (picture) {
          const img = document.createElement('img');
          img.src = picture;
          img.alt = displayName || 'Usuario';
          avatarEl.appendChild(img);
        } else {
          const initial = (displayName || 'U').trim().charAt(0).toUpperCase();
          avatarEl.textContent = initial || 'U';
        }
      }

      const tooltipName = document.querySelector('#profileTooltip .tooltip-name');
      const tooltipEmail = document.querySelector('#profileTooltip .tooltip-email');

      if (tooltipName) tooltipName.textContent = displayName;
      if (tooltipEmail) tooltipEmail.textContent = displayEmail;
    } catch (e) {
    }
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

      try {
        const raw = localStorage.getItem('authUser');
        const profile = raw && raw !== 'guest'
          ? JSON.parse(raw)
          : { name: 'Invitado', email: '' };

        const displayName = profile.name || profile.displayName || 'Usuario';
        const displayEmail = profile.email || '';

        if (tooltipName) tooltipName.textContent = displayName;
        if (tooltipEmail) {
          tooltipEmail.textContent = displayEmail;
          tooltipEmail.style.display = (displayEmail && displayEmail !== '') ? 'block' : 'none';
        }
      } catch {}

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

  function cerrarSesion() {
    confirmar(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      { emphasis: 'danger' }
    ).then(result => {
      if (result === 'confirm') {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('authUser');
        window.location.href = '../Login/Login.html';
      }
    });
  }
  // ===== Sistema de Bottom Drawer de Confirmación =====
  let activeDrawer = null;
  let drawerOverlay = null;

  function cerrarDrawer() {
    if (activeDrawer) {
      activeDrawer.classList.remove('drawer-show');
      if (drawerOverlay) drawerOverlay.classList.remove('drawer-overlay-show');
      const d = activeDrawer;
      const o = drawerOverlay;
      setTimeout(() => {
        if (d && d.parentNode) d.parentNode.removeChild(d);
        if (o && o.parentNode) o.parentNode.removeChild(o);
      }, 280);
      activeDrawer = null;
      drawerOverlay = null;
    }
  }

  function mostrarBottomDrawer({ mensaje, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger', onConfirm }) {
    cerrarDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = `confirm-drawer confirm-drawer-${variant}`;
    drawer.setAttribute('role', 'dialog');
    drawer.innerHTML = `
      <div class="confirm-drawer-handle"></div>
      <p class="confirm-drawer-msg">${mensaje}</p>
      <div class="confirm-drawer-btns">
        <button class="confirm-drawer-cancel">${cancelText}</button>
        <button class="confirm-drawer-confirm confirm-drawer-confirm-${variant}">${confirmText}</button>
      </div>
    `;
    document.body.appendChild(drawer);
    activeDrawer = drawer;

    requestAnimationFrame(() => {
      drawer.classList.add('drawer-show');
      overlay.classList.add('drawer-overlay-show');
    });

    drawer.querySelector('.confirm-drawer-cancel').addEventListener('click', cerrarDrawer);
    drawer.querySelector('.confirm-drawer-confirm').addEventListener('click', () => {
      cerrarDrawer();
      if (onConfirm) onConfirm();
    });
    overlay.addEventListener('click', () => { if (window.innerWidth <= 980) cerrarDrawer(); });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cerrarDrawer(); document.removeEventListener('keydown', handler); }
    });
  }
  // ===== Fin Sistema de Bottom Drawer =====

  // ===== Sistema de Toasts =====
  let toastContainer = null;

  function asegurarContenedorToast() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  function ocultarToast(toast, immediate = false) {
    if (!toast) return;
    if (toast._timeout) { clearTimeout(toast._timeout); toast._timeout = null; }
    toast.classList.remove('show');
    toast.classList.add('hide');
    const remove = () => { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); };
    if (immediate) { remove(); return; }
    setTimeout(remove, 400);
  }

  function mostrarToast(message, options = {}) {
    if (window.__appTooltips === false) return null;
    const { variant = 'warning', duration = 3000 } = options || {};
    asegurarContenedorToast();

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (variant) toast.classList.add(`toast-${variant}`);

    const isAssertive = variant === 'error' || variant === 'warning';
    toast.setAttribute('role', isAssertive ? 'alert' : 'status');
    toast.setAttribute('aria-live', isAssertive ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = String(message ?? '');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => ocultarToast(toast);

    toast.append(content, closeBtn);
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    if (duration && Number.isFinite(duration) && duration > 0) {
      toast._timeout = setTimeout(() => ocultarToast(toast), duration);
    }

    while (toastContainer.children.length > 3) {
      const first = toastContainer.firstElementChild;
      ocultarToast(first, true);
    }

    return toast;
  }

  function mostrarExito(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'success', duration: 3000, ...(options || {}) });
  }

  function mostrarError(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'error', duration: 3000, ...(options || {}) });
  }

  function mostrarAdvertencia(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'warning', duration: 3000, ...(options || {}) });
  }

  function mostrarInfo(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'warning', duration: 3000, ...(options || {}) });
  }
  // ===== Fin Sistema de Toasts =====

  function confirmar(titulo, mensaje, opciones = {}) {
    if (typeof showAlert === 'function') {
      return showAlert(titulo, mensaje, { variant: 'confirm', ...opciones })
        .then(result => result === 'error' ? (window.confirm(mensaje) ? 'confirm' : 'cancel') : result)
        .catch(() => window.confirm(mensaje) ? 'confirm' : 'cancel');
    }
    return Promise.resolve(window.confirm(mensaje) ? 'confirm' : 'cancel');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPeriodText(period) {
    const periods = {
      'weekly': 'Semanal',
      'biweekly': 'Quincenal',
      'monthly': 'Mensual',
      'yearly': 'Anual',
      'custom': 'Personalizado'
    };
    return periods[period] || period;
  }

  function getBudgetDisplayName(budget, categoria = null) {
    const fallback = String(categoria?.name || 'Sin categoría').trim() || 'Sin categoría';
    const rawName = String(budget?.name || '').trim();
    if (!rawName) return fallback;

    return rawName.replace(
      /\s*[·\-|]\s*(Semanal|Quincenal|Mensual|Anual|Personalizado|weekly|biweekly|monthly|yearly|custom)\s*$/i,
      ''
    ).trim() || fallback;
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }


  // ===== Calendario Modal tipo Dashboard =====
  let currentDatePicker = null;
  let selectedDate = null;
  let currentDisplayDate = new Date();

    // --- OCULTAR MODAL DE PRESUPUESTO AL ABRIR CALENDARIO ---
    function ocultarBudgetModal() {
      const budgetModal = document.getElementById('budgetModal');
      if (budgetModal) {
        budgetModal.classList.add('hidden');
        budgetModal.style.display = 'none';
      }
    }
    function mostrarBudgetModal() {
      const budgetModal = document.getElementById('budgetModal');
      if (budgetModal) {
        budgetModal.classList.remove('hidden');
        budgetModal.style.display = '';
      }
    }

  function abrirSelectorFecha(inputId) {
    currentDatePicker = inputId;
    const input = document.getElementById(inputId === 'start' ? 'budgetStartDate' : 'budgetEndDate');
    let displayDate = new Date();
    selectedDate = null;

    if (input && input.value) {
      const parsed = parseFechaInput(input.value);
      if (parsed) {
        displayDate = parsed;
        selectedDate = parsed;
      }
    }

    currentDisplayDate = displayDate;

    const datePickerModal = document.getElementById('datePickerModal');
    if (datePickerModal) {
        ocultarBudgetModal();
      datePickerModal.classList.add('active');
      datePickerModal.removeAttribute('inert');
      datePickerModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      renderizarCalendario();
    }
  }

  function renderizarCalendario() {
    const currentMonthYear = document.getElementById('currentMonthYear');
    const calendarDays = document.getElementById('calendarDays');

    if (!currentMonthYear || !calendarDays) return;

    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    currentMonthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    calendarDays.innerHTML = '';

    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'calendar-day empty';
      calendarDays.appendChild(emptyElement);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      dayElement.textContent = day;

      if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
        dayElement.classList.add('selected');
      }

      const today = new Date();
      if (date > today) {
        dayElement.classList.add('disabled');
      } else {
        dayElement.addEventListener('click', () => seleccionarFecha(date));
      }

      calendarDays.appendChild(dayElement);
    }
  }

  function seleccionarFecha(date) {
    document.querySelectorAll('.calendar-day.selected').forEach(day => {
      day.classList.remove('selected');
    });

    const dayElements = document.querySelectorAll('.calendar-day:not(.empty)');
    dayElements.forEach(day => {
      const dayNumber = parseInt(day.textContent);
      const dayDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), dayNumber);
      if (dayDate.toDateString() === date.toDateString()) {
        day.classList.add('selected');
      }
    });
    selectedDate = date;
  }

  function navegarMes(direction) {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + direction);
    if (selectedDate) {
      const selectedMonth = selectedDate.getMonth();
      const selectedYear = selectedDate.getFullYear();
      const currentMonth = currentDisplayDate.getMonth();
      const currentYear = currentDisplayDate.getFullYear();
      if (selectedMonth !== currentMonth || selectedYear !== currentYear) {
        selectedDate = null;
      }
    }
    renderizarCalendario();
  }

  function establecerHoy() {
    selectedDate = new Date();
    currentDisplayDate = new Date();
    renderizarCalendario();
  }

  function confirmarSeleccionFecha() {
    if (!currentDatePicker) return;
    if (!selectedDate) {
      const selectedEl = document.querySelector('.calendar-day.selected');
      if (selectedEl) {
        const dayNumber = parseInt(selectedEl.textContent);
        if (!Number.isNaN(dayNumber)) {
          selectedDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), dayNumber);
        }
      }
    }
    if (!selectedDate) return;
    const input = document.getElementById(currentDatePicker === 'start' ? 'budgetStartDate' : 'budgetEndDate');
    if (input) {
      input.value = formatDate(selectedDate);
    }
    const datePickerModal = document.getElementById('datePickerModal');
    if (datePickerModal) {
      datePickerModal.classList.remove('active');
      datePickerModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
        mostrarBudgetModal();
    }
  }

  // Eventos del calendario
  document.addEventListener('click', (e) => {
    const datePickerModal = document.getElementById('datePickerModal');
    if (datePickerModal && datePickerModal.classList.contains('active')) {
      if (!datePickerModal.contains(e.target) && !e.target.classList.contains('date-picker-btn') && !e.target.closest('.date-picker-btn')) {
        datePickerModal.classList.remove('active');
        datePickerModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
          mostrarBudgetModal();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    const datePickerModal = document.getElementById('datePickerModal');
    if (e.key === 'Escape' && datePickerModal && datePickerModal.classList.contains('active')) {
      datePickerModal.classList.remove('active');
      datePickerModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
        mostrarBudgetModal();
    }
  });

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => navegarMes(-1));
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => navegarMes(1));
  document.getElementById('todayBtn')?.addEventListener('click', establecerHoy);
  document.getElementById('selectDateBtn')?.addEventListener('click', confirmarSeleccionFecha);
  document.getElementById('cancelDateBtn')?.addEventListener('click', () => {
    const datePickerModal = document.getElementById('datePickerModal');
    if (datePickerModal) {
      datePickerModal.classList.remove('active');
      datePickerModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
        mostrarBudgetModal();
    }
  });

  window.openDatePicker = function(inputId) {
    abrirSelectorFecha(inputId);
  };

  /**
   * Controlador de página que extiende BasePage.
   * Delega el bootstrap completo a `inicializar()` y registra
   * la recarga de datos ante eventos cross-tab.
   *
   * @extends {window.BasePage}
   */
  class PresupuestosApp extends window.BasePage {
    /**
     * Punto de entrada tras DOMContentLoaded.
     * Llama a `inicializar()` que gestiona DOM, eventos y carga de datos,
     * y luego registra los listeners cross-tab.
     *
     * @override
     * @returns {Promise<void>}
     */
    async _init() {
      inicializar();
      this._bindCrossTabEvents();
    }

    /**
     * Suscribe a `datos:actualizados` para recargar los datos
     * cuando otra pestaña persiste cambios.
     *
     * @override
     */
    _bindCrossTabEvents() {
      if (!window.DataEvents) return;
      window.DataEvents.on('datos:actualizados', async () => {
        await cargarDatosIniciales();
      });
    }
  }

  const _presupuestosApp = new PresupuestosApp(); // eslint-disable-line no-unused-vars

  window.PresupuestosApp = {
    renderizarTodo,
    limpiarFiltros,
    abrirModalCrear
  };

  // Exponer función del calendario globalmente
  window.openDatePicker = openDatePicker;
})();
