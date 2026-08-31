/**
 * @fileoverview Dashboard principal de FinanzApp.
 *
 * Gestiona categorías, transacciones, filtros, exportación y KPIs diarios.
 * Orquestado por `CategoriasApp extends BasePage` al final del archivo.
 *
 * Dependencias de window: firebase, FirestoreDB, DataEvents, Core.helpers,
 * Core.storeFactories, showAlert, sidebarRenderer, jsPDF.
 */
window.DataEvents = window.DataEvents || { emit(){}, on(){}, off(){} };

if (typeof window !== 'undefined' && window.sidebarRenderer) {
  window.sidebarRenderer.render('categorias');
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

const CATEGORIAS_PREDETERMINADAS = [
  { id: 1, name: 'Nómina', fixedType: 'income', isDefault: true, transactions: [], isPinned: false },
  { id: 2, name: 'Comida', fixedType: 'expense', isDefault: true, transactions: [], isPinned: false },
  { id: 3, name: 'Transporte', fixedType: 'expense', isDefault: true, transactions: [], isPinned: false }
];

const datosUsuario = {
  categories: [],
  monthlyData: {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    income: Array(12).fill(0),
    expenses: Array(12).fill(0)
  },
  user: { name: "Usuario", email: "usuario@ejemplo.com" }
};

// Carga síncrona inmediata desde localStorage para renderizado instantáneo (0ms)
(function _initCachedCategoriesInstant() {
  try {
    const authUserRaw = localStorage.getItem('authUser');
    let uid = 'guest';
    if (authUserRaw && authUserRaw !== 'guest') {
      try {
        const u = JSON.parse(authUserRaw);
        uid = u.uid || u.email || 'guest';
      } catch {}
    }
    // Clave correcta usada por FirestoreStore
    const rawCats = localStorage.getItem(`finanzapp:data:v1:${uid}:categories`);
    if (rawCats !== null) {
      // rawCats puede ser '[]' (usuario borró todo) — respetar ese valor
      const parsed = JSON.parse(rawCats);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0) {
          datosUsuario.categories = parsed.map(c => ({
            ...c,
            transactions: (c.transactions || []).map(t => ({
              ...t,
              date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
            }))
          }));
        } else {
          // El usuario eliminó todas las categorías: respetar array vacío
          datosUsuario.categories = [];
        }
        return; // Datos locales encontrados — no usar predeterminadas
      }
    }
    // Solo si nunca hubo datos guardados para este uid, usar predeterminadas
    datosUsuario.categories = CATEGORIAS_PREDETERMINADAS.map(c => ({ ...c, transactions: [] }));
  } catch {}
})();
/** Redondea un número a exactamente dos decimales evitando errores de punto flotante.
 * @param {number} n
 * @returns {number}
 */
function redondear2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
/** Genera un ID único basado en timestamp y aleatoriedad (base-36).
 * @returns {string}
 */
function generarId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Genera un ID de categoría con prefijo `cat_` y componentes de tiempo/aleatoriedad.
 * @returns {string}
 */
function generarIdCategoria(){
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
}

/**
 * Crea una versión con antirrebote de una función.
 * @param {Function} fn   - Función a limitar.
 * @param {number}   wait - Milisegundos a esperar tras la última invocación.
 * @returns {Function}
 */
function antirrebote(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

let dataVersion = 0;
/** Incrementa el contador global de versión de datos e invalida el caché de filtros. */
function marcarCambioDatos() { dataVersion++; cacheFiltros.key = null; }

/** Normaliza cualquier ID a `string` para comparaciones seguras.
 * @param {*} id
 * @returns {string}
 */
function normalizarId(id){ return String(id); }
/** Busca y devuelve una categoría por su ID (normalizado a string), o `null` si no existe.
 * @param {*} categoryId
 * @returns {object|null}
 */
function buscarCategoria(categoryId){ const nid = normalizarId(categoryId); return datosUsuario.categories.find(c => normalizarId(c.id) === nid) || null; }

/**
 * Parsea una cadena de fecha en formato `DD/MM/YYYY`, `YYYY-MM-DD` o `DD.MM.YYYY`.
 * @param {string} raw - Valor crudo del input.
 * @returns {Date|null} Objeto `Date` válido, o `null` si el formato es inválido.
 */
function parseFechaInput(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let day, month, year;
  let isMdy = false;
  try {
    const rawSettings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
    isMdy = rawSettings?.dateFormat === 'mdy';
  } catch (_) {}

  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length !== 3) return null;
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else if (s.includes('/') || s.includes('.')) {
    const parts = s.includes('/') ? s.split('/') : s.split('.');
    if (parts.length !== 3) return null;
    if (isMdy) {
      month = Number(parts[0]);
      day = Number(parts[1]);
      year = Number(parts[2]);
    } else {
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }
  } else {
    return null;
  }
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}


const cacheFiltros = { key: null, version: -1, result: [] };
/**
 * Genera la clave de caché para un objeto de filtros dado.
 * @param {{ year: number|null, month: number|null, searchTerm: string }} f
 * @returns {string}
 */
function claveFiltros(f) { return `${f.year ?? ''}|${f.month ?? ''}|${(f.searchTerm || '').trim().toLowerCase()}`; }

const {
  esc,
  formatCurrency,
  formatInputAmount,
  sanitizeAmount,
  isValidAmount,
  hasMultipleDecimalSeparators,
  hasTooManyFractionDigits,
  validateDate,
  formatDate,
  formatDateForInput
} = window.Core.helpers;
const { createFirestoreStore } = window.Core.storeFactories;
const store = createFirestoreStore();

const MSG_NUMERIC_ONLY = 'Solo se pueden agregar caracteres numéricos';
const MSG_MAX_DIGITS = 'El monto no puede tener más de 8 dígitos';
const MSG_ONE_DECIMAL = 'Solo se permite un separador decimal (punto o coma)';
const MSG_MAX_DECIMALS = 'El monto no puede tener más de 2 decimales';
const MSG_INVALID_DATE = 'Por favor, ingresa una fecha válida';

const MAX_CATEGORIES = 200;

const PIE_COLORS = [
  '#6C63FF', '#564FD8', '#36D6C3', '#00C9A7', '#7ED957',
  '#C4A7E7', '#A78BFA', '#8892FF', '#7EA1FF', '#4DD0E1',
  '#80CBC4', '#B39DDB', '#CE93D8', '#F48FB1', '#FFAB91',
  '#FFE082', '#FFC75F', '#FFD166', '#FF9F1C', '#FF6F91',
  '#F86A92', '#EF476F', '#92E6E6', '#3EC1D3', '#2EC4B6'
];

/**
 * Asegura que las categorías predeterminadas existan en `datosUsuario`.
 * @returns {boolean} `true` si se añadió alguna categoría.
 */
function asegurarCategoriasPredeterminadas() {
  let changed = false;
  CATEGORIAS_PREDETERMINADAS.forEach(def => {
    if (!datosUsuario.categories.some(c => c.id === def.id)) {
      datosUsuario.categories.push({ ...def, transactions: [], isPinned: false });
      changed = true;
    }
  });
  return changed;
}


let lastDeletedTransaction = null;
let undoTimeout = null;
let dragCategoryId = null;
const sortFechaCategorias = new Map(); // categoryId -> 'newest' | 'oldest'
const sortMontoCategorias = new Map(); // categoryId -> 'off' | 'amount-desc' | 'amount-asc'
const paginaCategorias = new Map(); // categoryId -> número de página actual (0-based)
const expandedCategoryIds = new Set(); // categorías que el usuario ha expandido manualmente

// Restaurar sort guardado
(function _cargarSort() {
  try {
    const sf = JSON.parse(localStorage.getItem('sort_fecha') || '{}');
    const sm = JSON.parse(localStorage.getItem('sort_monto') || '{}');
    Object.entries(sf).forEach(([k,v]) => sortFechaCategorias.set(k, v));
    Object.entries(sm).forEach(([k,v]) => sortMontoCategorias.set(k, v));
  } catch {}
})();

function _guardarSort() {
  try {
    localStorage.setItem('sort_fecha', JSON.stringify(Object.fromEntries(sortFechaCategorias)));
    localStorage.setItem('sort_monto', JSON.stringify(Object.fromEntries(sortMontoCategorias)));
  } catch {}
}

let filtrosActuales = {
  year: null,
  month: null,
  searchTerm: ''
};

/** Actualiza los estilos visuales de los controles de filtro según el estado actual de `filtrosActuales`. */
function actualizarIndicadorFiltros() {
  const yearFilter = document.getElementById('yearFilter');
  const monthFilter = document.getElementById('monthFilter');
  const clearBtn = document.getElementById('clearFiltersBtn');
  const hayAnio = filtrosActuales.year !== null;
  const hayMes = filtrosActuales.month !== null;
  const hayBusqueda = !!(filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim());

  if (yearFilter) yearFilter.classList.toggle('filter-active', hayAnio);
  if (monthFilter) monthFilter.classList.toggle('filter-active', hayMes);
  if (clearBtn) clearBtn.classList.toggle('filter-active', hayAnio || hayMes || hayBusqueda);
}

/** Genera las opciones dinámicas del dropdown de año abarcando desde 2025 hasta el año actual. */
function generarOpcionesAnio() {
  const yearFilter = document.getElementById('yearFilter');
  if (!yearFilter) return;
  
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');
  
  if (!optionsContainer) return;
  
  optionsContainer.innerHTML = '';

  const endYear = Math.max(startYear, currentYear);
  
  for (let year = startYear; year <= endYear; year++) {
    const option = document.createElement('div');
    option.className = 'custom-dropdown-option';
    option.setAttribute('data-value', year);
    option.textContent = year;
    optionsContainer.appendChild(option);
  }

  const selectedElement = yearFilter.querySelector('.custom-dropdown-selected');
  if (selectedElement) {
    selectedElement.querySelector('span').textContent = 'Todos los años';
    selectedElement.setAttribute('data-value', '');

    const options = optionsContainer.querySelectorAll('.custom-dropdown-option');
    options.forEach(opt => opt.classList.remove('selected'));

  }
}

let alertaUltimoFoco = null;
let manejadorTeclaAlerta = null;
let resolverAlerta = null;
let botonCancelarAlerta = null;
let alertaAbierta = false;

let superposicionAlerta = null;
let alertaPersonalizada = null;
let tituloAlerta = null;
let mensajeAlerta = null;
let botonesAlerta = null;
let confirmarAlerta = null;
let raizApp = null;

/** Devuelve todos los elementos enfocables dentro del elemento dado.
 * @param {HTMLElement} el
 * @returns {HTMLElement[]}
 */
function obtenerEnfocables(el) {
  const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  return Array.from(el.querySelectorAll(sel))
    .filter(n => !n.hasAttribute('disabled') && n.tabIndex !== -1);
}

/**
 * Muestra el diálogo de alerta personalizado con trampa de foco y soporte Escape.
 */
function abrirDialogoAlerta() {
  if (!superposicionAlerta || !alertaPersonalizada) {
    console.error('Elementos de alerta no encontrados');
    return;
  }
  
      try { document.body.setAttribute('tabindex','-1'); document.body.focus(); } catch {}
  superposicionAlerta.classList.remove('hidden');
  superposicionAlerta.style.display = 'block';
  alertaPersonalizada.classList.remove('hidden');
  alertaPersonalizada.style.display = 'block';
  document.body.classList.add('no-scroll');
  raizApp?.setAttribute('aria-hidden', 'true');

  alertaUltimoFoco = document.activeElement;
  alertaPersonalizada.focus();

  manejadorTeclaAlerta = (e) => {
    if (e.key === 'Tab') {
      const list = obtenerEnfocables(alertaPersonalizada);
      if (!list.length) return;
      const idx = list.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx <= 0) { list[list.length - 1].focus(); e.preventDefault(); }
      } else {
        if (idx === list.length - 1) { list[0].focus(); e.preventDefault(); }
      }
    } else if (e.key === 'Escape' && !opcionesAlertaAbierta.disableEsc) {
      cerrarDialogoAlerta('cancel');
    }
  };
  alertaPersonalizada.addEventListener('keydown', manejadorTeclaAlerta);
  alertaAbierta = true;
}

/**
 * Cierra el diálogo de alerta y resuelve la promesa asociada.
 * @param {string} [result='cancel'] - Resultado devuelto al llamador: `'confirm'` o `'cancel'`.
 */
function cerrarDialogoAlerta(result = 'cancel') {
  if (!alertaAbierta) {
    return;
  }

  if (!superposicionAlerta || !alertaPersonalizada) {
    console.error('Elementos de alerta no encontrados en cerrarDialogoAlerta');
    return;
  }

  superposicionAlerta.classList.add('hidden');
  superposicionAlerta.style.display = 'none';
  alertaPersonalizada.classList.add('hidden');
  alertaPersonalizada.style.display = 'none';
  document.body.classList.remove('no-scroll');
  raizApp?.removeAttribute('aria-hidden');
  limpiarBloqueoScroll();

  if (manejadorTeclaAlerta) {
    alertaPersonalizada.removeEventListener('keydown', manejadorTeclaAlerta);
    manejadorTeclaAlerta = null;
  }

  if (botonCancelarAlerta && botonCancelarAlerta.parentElement) {
    botonCancelarAlerta.remove();
  }
  botonCancelarAlerta = null;

  alertaAbierta = false;

  if (alertaUltimoFoco && typeof alertaUltimoFoco.focus === 'function') {
    setTimeout(() => { try { alertaUltimoFoco.focus(); } catch {} }, 0);
  }

  if (resolverAlerta) {
    const r = resolverAlerta;
    resolverAlerta = null;
    r(result);
  }
}

let opcionesAlertaAbierta = { disableEsc: false, preventCloseOnOverlay: false };

/**
 * Muestra un diálogo de alerta/confirmación accesible.
 * @param {string} title   - Título del diálogo.
 * @param {string} message - Cuerpo del mensaje.
 * @param {object} [options] - Opciones de comportamiento y texto de botones.
 * @returns {Promise<string>} Resuelve con `'confirm'` o `'cancel'`.
 */
function mostrarAlerta(title, message, options = {}) {
  const {
    variant = 'info',
    emphasis = 'primary',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    disableEsc = false,
    preventCloseOnOverlay = false,
    autoCloseMs = 0
  } = options || {};

  opcionesAlertaAbierta = { disableEsc, preventCloseOnOverlay };

  return new Promise((resolve) => {
    resolverAlerta = resolve;

    if (!tituloAlerta || !mensajeAlerta || !confirmarAlerta || !botonesAlerta) {
      console.error('Elementos de alerta no encontrados en mostrarAlerta');
      resolve('error');
      return;
    }

    tituloAlerta.textContent = String(title ?? '');
    mensajeAlerta.textContent = String(message ?? '');

    alertaPersonalizada.className = 'custom-alert hidden';
    alertaPersonalizada.classList.add(variant);

    confirmarAlerta.textContent = confirmText;
    confirmarAlerta.classList.remove('btn-danger', 'btn-primary');
    confirmarAlerta.classList.add(emphasis === 'danger' ? 'btn-danger' : 'btn-primary');

    if (variant === 'confirm') {
      botonCancelarAlerta = document.createElement('button');
      botonCancelarAlerta.id = 'alertCancel';
      botonCancelarAlerta.className = 'btn btn-secondary';
      botonCancelarAlerta.textContent = cancelText;
      botonesAlerta.prepend(botonCancelarAlerta);
      botonCancelarAlerta.onclick = () => cerrarDialogoAlerta('cancel');
    }

    confirmarAlerta.onclick = () => {
      cerrarDialogoAlerta('confirm');
    };

    if (superposicionAlerta) {
      superposicionAlerta.onclick = null;
      
      superposicionAlerta.onclick = () => {
        if (!preventCloseOnOverlay) cerrarDialogoAlerta('cancel');
      };
    }

    abrirDialogoAlerta();

    if (autoCloseMs && Number.isFinite(autoCloseMs) && autoCloseMs > 0) {
      setTimeout(() => {
        if (alertaAbierta) cerrarDialogoAlerta('confirm');
      }, autoCloseMs);
    }
  });
}

/** Cierra la alerta programáticamente (equivale a `cerrarDialogoAlerta('cancel')`). */
function ocultarAlerta() {
  if (alertaAbierta) cerrarDialogoAlerta('cancel');
}



// ===== Sistema de Bottom Drawer de Confirmación =====
let activeDrawer = null;
let drawerOverlay = null;

/** Cierra y elimina del DOM el drawer de confirmación inferior activo. */
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

/**
 * Muestra un panel de confirmación deslizable desde la parte inferior.
 * @param {{ mensaje?: string, mensajeHtml?: string, confirmText?: string, cancelText?: string, variant?: string, onConfirm: Function }} param0
 */
function mostrarBottomDrawer({ mensaje, mensajeHtml, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger', onConfirm }) {
  cerrarDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  document.body.appendChild(overlay);
  drawerOverlay = overlay;

  const drawer = document.createElement('div');
  drawer.className = `confirm-drawer confirm-drawer-${variant}`;
  drawer.setAttribute('role', 'dialog');

  const handle = document.createElement('div');
  handle.className = 'confirm-drawer-handle';

  const msgEl = document.createElement('p');
  msgEl.className = 'confirm-drawer-msg';
  if (mensajeHtml !== undefined) {
    msgEl.innerHTML = String(mensajeHtml ?? '');
  } else {
    msgEl.textContent = String(mensaje ?? '');
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-drawer-cancel';
  cancelBtn.textContent = cancelText;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = `confirm-drawer-confirm confirm-drawer-confirm-${variant}`;
  confirmBtn.textContent = confirmText;

  const btnsEl = document.createElement('div');
  btnsEl.className = 'confirm-drawer-btns';
  btnsEl.append(cancelBtn, confirmBtn);

  drawer.append(handle, msgEl, btnsEl);
  document.body.appendChild(drawer);
  activeDrawer = drawer;

  requestAnimationFrame(() => {
    drawer.classList.add('drawer-show');
    overlay.classList.add('drawer-overlay-show');
  });

  cancelBtn.addEventListener('click', cerrarDrawer);
  confirmBtn.addEventListener('click', () => {
    cerrarDrawer();
    if (onConfirm) onConfirm();
  });
  overlay.addEventListener('click', () => { if (window.innerWidth <= 980) cerrarDrawer(); });

  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { cerrarDrawer(); document.removeEventListener('keydown', handler); }
  });
}
// ===== Fin Sistema de Bottom Drawer =====

/** Devuelve `true` cuando la UI está en tamaño de escritorio. */
function esVistaEscritorio() {
  return window.matchMedia('(min-width: 900px)').matches;
}


let toastContainer = null;

/** Crea el contenedor de toasts en el DOM si aún no existe. */
function asegurarContenedorToast() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

/**
 * Oculta y elimina un toast del DOM.
 * @param {HTMLElement} toast     - Elemento toast a ocultar.
 * @param {boolean}    [immediate=false] - Si es `true`, lo elimina sin animación.
 */
function ocultarToast(toast, immediate = false) {
  if (!toast) return;
  if (toast._timeout) { clearTimeout(toast._timeout); toast._timeout = null; }
  toast.classList.remove('show');
  toast.classList.add('hide');
  const remove = () => { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); };
  if (immediate) { remove(); return; }
  setTimeout(remove, 400);
}

/**
 * Crea y muestra un toast con el mensaje dado.
 * @param {string} message - Texto a mostrar.
 * @param {{ variant?: string, duration?: number }} [options]
 * @returns {HTMLElement} El elemento toast creado.
 */
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

/** Muestra un toast de éxito. @param {string} message @param {object} [options] @returns {HTMLElement} */
function mostrarExito(message, options = {}) {
  return mostrarToast(message, { variant: 'success', duration: 3000, ...(options || {}) });
}
/** Muestra un toast de error. @param {string} message @param {object} [options] @returns {HTMLElement} */
function mostrarError(message, options = {}) {
  return mostrarToast(message, { variant: 'error', duration: 3000, ...(options || {}) });
}
/** Muestra un toast de advertencia. @param {string} message @param {object} [options] @returns {HTMLElement} */
function mostrarAdvertencia(message, options = {}) {
  return mostrarToast(message, { variant: 'warning', duration: 3000, ...(options || {}) });
}
/** Muestra un toast informativo. @param {string} message @param {object} [options] @returns {HTMLElement} */
function mostrarInfo(message, options = {}) {
  return mostrarToast(message, { variant: 'warning', duration: 3000, ...(options || {}) });
}

/**
 * Abre un modal, establece la trampa de foco y lo hace visible para lectores de pantalla.
 * @param {HTMLElement}      modal          - Elemento modal a abrir.
 * @param {HTMLElement|null} [triggerElement] - Elemento que desencadenó la apertura (para restaurar foco al cerrar).
 */
function abrirModal(modal, triggerElement = null) {
  if (!modal) return;
  document.querySelectorAll('.modal.active').forEach(m => {
    if (m !== modal) {
      m.classList.remove('active');
      m.setAttribute('aria-hidden','true');
    }
  });
  
  modal.classList.add('active');
  modal.removeAttribute('inert');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) {
    setTimeout(() => {
      try {
        firstFocusable.focus();
      } catch (e) {
        console.warn('No se pudo enfocar el primer elemento del modal:', e);
      }
    }, 100);
  }

  if (triggerElement && document.contains(triggerElement)) {
    modal._triggerElement = triggerElement;
  }
}

/**
 * Cierra un modal, restaura el foco al elemento disparador y limpia el estado ARIA.
 * @param {HTMLElement} modal - Elemento modal a cerrar.
 */
function cerrarModal(modal) {
  if (!modal) return;
  try {
    const triggerEl = modal._triggerElement || null;
    const hadFocusInside = modal.contains(document.activeElement);

    modal.classList.remove('active');
    modal.setAttribute('inert', '');
    limpiarBloqueoScroll();

    if (hadFocusInside) {
      try { document.body.setAttribute('tabindex','-1'); document.body.focus(); } catch {}
    }

    setTimeout(() => {
      let restored = false;
      try {
        if (triggerEl && typeof triggerEl.focus === 'function' && document.contains(triggerEl) && triggerEl.offsetParent !== null) {
          triggerEl.focus();
          restored = true;
        }
      } catch (e) { console.warn('No se pudo restaurar foco al trigger:', e); }

      if (!restored) {
        const fallback = document.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (fallback && document.contains(fallback)) {
          try { fallback.focus(); } catch {}
        }
      }

      if (document.body.getAttribute('tabindex') === '-1') document.body.removeAttribute('tabindex');

      modal.setAttribute('aria-hidden','true');
      modal.removeAttribute('inert');
      modal._triggerElement = null;
    }, 40);
  } catch (e) {
    console.error('Error cerrando modal:', e);
  }
}

/** Elimina los bloqueos de scroll del `body` si no hay modales ni alertas activas. */
function limpiarBloqueoScroll() {
  const hasModal = !!document.querySelector('.modal.active');
  const overlay = document.getElementById('alertOverlay');
  const alertBox = document.getElementById('customAlert');
  const alertVisible = (overlay && !overlay.classList.contains('hidden')) || (alertBox && !alertBox.classList.contains('hidden'));
  if (!hasModal) document.body.classList.remove('modal-open');
  if (!alertVisible) document.body.classList.remove('no-scroll');
  if (!hasModal && !alertVisible) document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.category-menu-wrapper')) {
    document.querySelectorAll('.category-menu.active').forEach(menu => {
      menu.classList.remove('active');
    });
  }
});

/** Persiste el estado completo de `datosUsuario` en el almacén configurado (Firestore/Local). */
async function persist() {
  try {
    // Asegurar que FirestoreDB esté inicializado antes de guardar
    if (window.FirestoreDB && !window.FirestoreDB.initialized) {
      const authUserRaw = localStorage.getItem('authUser');
      if (authUserRaw && authUserRaw !== 'guest') {
        try {
          const authUser = JSON.parse(authUserRaw);
          if (authUser.uid) {
            await window.FirestoreDB.init(authUser.uid);
            window.FirestoreDB.setCurrentUser(authUser.uid);
          }
        } catch {}
      }
    }

    const allTransactions = datosUsuario.categories.flatMap(c => 
      (c.transactions || []).map(t => ({
        ...t,
        categoryId: c.id,
        categoryName: c.name,
        date: t.date instanceof Date ? t.date.toISOString() : t.date
      }))
    );

    const snapshot = {
      version: 1,
      ...datosUsuario,
      transactions: allTransactions,
      categories: datosUsuario.categories.map(c => ({
        ...c,
        transactions: (c.transactions || []).map(t => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : t.date
        }))
      }))
    };
    await store.save(snapshot);
  } catch (err) {
    console.error('Error en persist():', err);
  }
}

/** Carga los datos guardados al iniciar la aplicación y asegura las categorías predeterminadas. */
async function boot() {
  try {
    const saved = await store.load();
    if (saved && saved.categories) {
      saved.categories.forEach(c => {
        c.transactions = (c.transactions || []).map(t => ({
          ...t,
          date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
        }));
        if (typeof c.isPinned !== 'boolean') c.isPinned = false;
      });

      if (Array.isArray(saved.transactions) && saved.transactions.length > 0) {
        saved.transactions.forEach(t => {
          const tDate = (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date;
          const cat = saved.categories.find(c => String(c.id) === String(t.categoryId));
          if (cat) {
            if (!cat.transactions) cat.transactions = [];
            const exists = cat.transactions.some(ct => String(ct.id) === String(t.id));
            if (!exists) {
              cat.transactions.push({ ...t, date: tDate });
            }
          }
        });
      }

      Object.assign(datosUsuario, saved);
    } else {
      // Solo para usuario completamente nuevo sin datos previos
      const changed = asegurarCategoriasPredeterminadas();
      if (changed) await persist();
    }
  } catch (err) {
    console.error('Error en boot():', err);
  }
}

/**
 * Garantiza que un string numérico tenga exactamente dos dígitos decimales.
 * @param {string} s
 * @returns {string}
 */
function ensureTwoDecimals(s) {
  if (!s) return s;
  if (s.includes('.')) {
    const [intPart, fracPart = ''] = s.split('.');
    if (fracPart.length === 0) return `${intPart}.00`;
    if (fracPart.length === 1) return `${intPart}.${fracPart}0`;
    return s;
  }
  return s;
}

/**
 * Formatea un string de importe al estilo europeo (`1.234,56`) mientras el usuario escribe.
 * Elimina zeros a la izquierda, limita a 8 dígitos enteros y 2 decimales.
 * @param {string} raw - Valor crudo desde el input.
 * @returns {string}
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
 * Convierte un importe formateado en estilo europeo (ej. `"1,234.56"`) a string normalizado (`"1234.56"`).
 * Devuelve cadena vacía si el formato no es válido.
 * @param {string} raw
 * @returns {string}
 */
function parseEsAmountToNormalized(raw){
  if (!raw) return '';
  let s = raw.replace(/,/g,'');
  if (!/^\d{1,8}(?:\.\d{0,2})?$/.test(s)) return '';
  return s;
}


document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

    document.querySelectorAll('.modal.active').forEach(m => cerrarModal(m));
    ocultarAlerta();

    if (toastContainer && toastContainer.lastElementChild) {
      e.stopPropagation();
      ocultarToast(toastContainer.lastElementChild);
    }
  }
});

(function setupGlobalShortcuts() {
  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  };

  const openShortcutsModal = () => {
    const modal = document.getElementById('shortcutsModal');
    const fab = document.getElementById('shortcutsFab');
    if (modal) abrirModal(modal, fab || null);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('shortcutsFab');
    const modal = document.getElementById('shortcutsModal');
    if (fab) {
      fab.addEventListener('click', () => openShortcutsModal());
    }
    if (modal) {

      modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(modal); });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const shortcutsModal = document.getElementById('shortcutsModal');
      if (shortcutsModal && shortcutsModal.classList.contains('active')) cerrarModal(shortcutsModal);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (window.__appShortcutsEnabled === false) return;
    const isEditing = isEditableTarget(document.activeElement);
    const withMod = e.ctrlKey || e.metaKey || e.altKey;

    if (!withMod && (e.key === '?' || (e.shiftKey && e.key === '/')) && !isEditing) {
      e.preventDefault();
      openShortcutsModal();
      return;
    }

    if (!withMod && e.key === '/' && !e.shiftKey && !isEditing) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) { e.preventDefault(); searchInput.focus(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'n' && !isEditing) {
      const btn = document.getElementById('addCategoryBtn');
      const modal = document.getElementById('categoryModal');
      if (btn && modal) { e.preventDefault(); abrirModal(modal, btn); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 's' && !isEditing) {
      const btn = document.getElementById('exportDropdownBtn');
      const menu = document.getElementById('exportDropdown');
      if (btn && menu) { e.preventDefault(); menu.classList.toggle('active'); btn.focus(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'j' && !isEditing) {
      const btn = document.getElementById('exportJsonBtn');
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'p' && !isEditing) {
      const btn = document.getElementById('exportPdfBtn');
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'i' && !isEditing) {
      const btn = document.getElementById('importStateBtn');
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'y' && !isEditing) {
      const dd = document.getElementById('yearFilter');
      if (dd) { e.preventDefault(); dd.classList.add('open'); dd.querySelector('.custom-dropdown-selected')?.focus?.(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'm' && !isEditing) {
      const dd = document.getElementById('monthFilter');
      if (dd) { e.preventDefault(); dd.classList.add('open'); dd.querySelector('.custom-dropdown-selected')?.focus?.(); }
      return;
    }

    if (!withMod && e.key.toLowerCase() === 'l' && !isEditing) {
      const btn = document.getElementById('clearFiltersBtn');
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }

    if (e.shiftKey && e.key === 'Delete' && !withMod) {
      const btn = document.getElementById('clearAllCategoriesBtn');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
      return;
    }
  });
})();

/**
 * Alterna el estado de fijado de una categoría, reordena la lista y persiste el cambio.
 * @param {*} categoryId
 */
async function alternarFijado(categoryId) {
  const category = buscarCategoria(categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  category.isPinned = !category.isPinned;

  datosUsuario.categories = obtenerCategoriasMostradas();
  marcarCambioDatos();
  await persist();
  renderizarCategorias();
  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));
  mostrarExito(category.isPinned ? `Categoría "${category.name}" fijada` : `Categoría "${category.name}" desfijada`);
}

/**
 * Muestra el drawer de confirmación para eliminar todas las transacciones de una categoría.
 * @param {*} categoryId
 * @param {HTMLElement|null} [triggerEl]
 */
function limpiarTransaccionesCategoria(categoryId, triggerEl = null) {
  const category = buscarCategoria(categoryId);
  if (!category) return;

  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

  const ejecutar = async () => {
    category.transactions = [];
    marcarCambioDatos();
    renderizarCategorias();
    renderizarGraficos();
    actualizarUIEstadisticasDiarias();
    await persist();
    setTimeout(() => { window.DataEvents.emit('transactionChanged', { action: 'clearAll', categoryId }); }, 100);
    mostrarExito(`Transacciones de "${category.name}" eliminadas`);
  };

  if (window.__appConfirmDelete === false) {
    ejecutar();
    return;
  }

  mostrarBottomDrawer({
    mensajeHtml: `¿Limpiar todas las transacciones de "<strong>${esc(category.name)}</strong>"?`,
    confirmText: 'Limpiar',
    cancelText: 'Cancelar',
    variant: 'danger',
    onConfirm: ejecutar
  });
}

/**
 * Devuelve las categorías de `datosUsuario` ordenadas: fijadas primero, luego el resto.
 * @returns {Array}
 */
function obtenerCategoriasMostradas() {
  const pinned = datosUsuario.categories.filter(c => c.isPinned);
  const unpinned = datosUsuario.categories.filter(c => !c.isPinned);
  return [...pinned, ...unpinned];
}

/**
 * Filtra el arreglo de transacciones de una categoría aplicando los filtros activos
 * (año, mes y término de búsqueda).
 * @param {Array} transactions
 * @returns {Array}
 */
function filtrarTransaccionesPorFecha(transactions) {
  if (!transactions || !Array.isArray(transactions)) return [];
  
  return transactions.filter(transaction => {
    const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);

    if (filtrosActuales.year !== null && transactionDate.getFullYear() !== filtrosActuales.year) {
      return false;
    }

    if (filtrosActuales.month !== null && transactionDate.getMonth() !== filtrosActuales.month) {
      return false;
    }

    if (filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim() !== '') {
      const searchTerm = filtrosActuales.searchTerm.toLowerCase().trim();
      const description = (transaction.description || '').toLowerCase();

      const amount = formatCurrency(Math.abs(transaction.amount));
      const amountWithComma = amount.replace('.', ',');

      const searchTermClean = searchTerm.replace(/[$,]/g, '');
      const isNumericSearch = !isNaN(parseFloat(searchTermClean)) && isFinite(parseFloat(searchTermClean));
      
      let matchesAmount = false;
      if (isNumericSearch) {

        const searchAmount = parseFloat(searchTermClean);
        matchesAmount = Math.abs(Math.abs(transaction.amount) - searchAmount) < 0.01;
      }

      const textMatchesAmount = amount.includes(searchTermClean) ||
        amountWithComma.includes(searchTermClean) ||
        amount.toLowerCase().includes(searchTerm) ||
        amount.replace(/[$,]/g, '').toLowerCase().includes(searchTermClean);

      matchesAmount = matchesAmount || textMatchesAmount;

      const typeText = transaction.type === 'income' ? 'ingreso' : 'gasto';
      const matchesType = typeText.includes(searchTerm);
      
      if (!description.includes(searchTerm) && !matchesAmount && !matchesType) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Devuelve las categorías de `datosUsuario` con sus transacciones filtradas por
 * `filtrosActuales`. Usa un caché interno para evitar recalcular si los datos no cambiaron.
 * @returns {Array}
 */
function aplicarFiltrosACategorias() {
  const key = claveFiltros(filtrosActuales);
  if (cacheFiltros.key === key && cacheFiltros.version === dataVersion) {
    return cacheFiltros.result;
  }
  const res = datosUsuario.categories.map(category => ({
    ...category,
    transactions: filtrarTransaccionesPorFecha(category.transactions)
  }));
  cacheFiltros.key = key;
  cacheFiltros.version = dataVersion;
  cacheFiltros.result = res;
  return res;
}

/**
 * Extrae y sanitiza el nombre del usuario autenticado desde `localStorage`,
 * dejándolo listo para usarse en nombres de archivo exportados.
 * @returns {string} Nombre sin espacios ni caracteres especiales, o `'Invitado'`/`'Usuario'`.
 */
function _obtenerNombreArchivoUsuario() {
  const rawAuth = localStorage.getItem('authUser') || 'guest';
  let nombre;
  if (!rawAuth || rawAuth === 'guest') {
    nombre = 'Invitado';
  } else {
    try {
      const parsed = JSON.parse(rawAuth);
      nombre = String(parsed?.name || parsed?.displayName || parsed?.email || 'Usuario').trim();
    } catch {
      nombre = 'Usuario';
    }
  }
  return nombre.replace(/\s+/g, '').replace(/[^\wÁÉÍÓÚÑáéíóúñ-]/g, '') || 'Usuario';
}

/**
 * Serializa todos los datos del usuario a JSON y los descarga como archivo.
 */
function exportarAJSON() {
  const nombreUsuario = _obtenerNombreArchivoUsuario();
  const fecha = new Date().toISOString().split('T')[0];
  const instantanea = {
    version: 1,
    ...datosUsuario,
    categories: datosUsuario.categories.map(c => ({
      ...c,
      transactions: (c.transactions || []).map(t => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : t.date
      }))
    }))
  };
  const blob = new Blob([JSON.stringify(instantanea, null, 2)], { type: 'application/json' });
  const enlaceDescarga = document.createElement('a');
  enlaceDescarga.href = URL.createObjectURL(blob);
  enlaceDescarga.download = `FinanzApp-${nombreUsuario}-${fecha}.json`;
  document.body.appendChild(enlaceDescarga);
  enlaceDescarga.click();
  URL.revokeObjectURL(enlaceDescarga.href);
  enlaceDescarga.remove();

  mostrarExito('Archivo JSON exportado correctamente.');
}

/**
 * Genera un PDF ejecutivo con el resumen financiero y el detalle de transacciones filtradas,
 * y lo descarga automáticamente. Requiere la librería jsPDF en `window`.
 */
function exportarAPDF() {
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    console.error('jsPDF no está disponible');
    mostrarError('La librería PDF no está disponible. Por favor, recarga la página.');
    return;
  }

  try {
    const categoriasFiltradas = aplicarFiltrosACategorias();
    const jsPDF = window.jsPDF || window.jspdf.jsPDF;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const bottomLimit = pageHeight - 18;

    // Calcular totales
    let totalIngresos = 0;
    let totalGastos = 0;
    let totalTransacciones = 0;

    categoriasFiltradas.forEach(category => {
      (category.transactions || []).forEach(transaction => {
        totalTransacciones++;
        if (transaction.type === 'income') {
          totalIngresos += transaction.amount;
        } else {
          totalGastos += transaction.amount;
        }
      });
    });

    const balance = totalIngresos - totalGastos;

    // Filtros activos
    let filtroTexto = 'Todos los periodos';
    try {
      const yf = document.getElementById('yearFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
      const mf = document.getElementById('monthFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      if (yf || mf !== '') {
        const anoStr = yf ? `Año ${yf}` : 'Todos los años';
        const mesStr = mf !== '' ? monthNames[Number(mf)] || `Mes ${Number(mf) + 1}` : 'Todos los meses';
        filtroTexto = `${anoStr} • ${mesStr}`;
      }
    } catch {}

    // Nombre de usuario
    let nombreUsuario = 'Usuario';
    try {
      const rawAuth = localStorage.getItem('authUser');
      if (rawAuth && rawAuth !== 'guest') {
        const parsed = JSON.parse(rawAuth);
        nombreUsuario = parsed.name || parsed.displayName || 'Usuario';
      }
    } catch {}

    // ── 1. Banner Superior (Página 1) ──────────────────────────────────
    doc.setFillColor(31, 29, 46); // #1F1D2E
    doc.roundedRect(margin, 12, contentWidth, 26, 3, 3, 'F');

    // Accent line en el banner
    doc.setFillColor(235, 111, 146); // #EB6F92
    doc.roundedRect(margin, 12, 4, 26, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FinanzApp', margin + 8, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(224, 222, 244);
    doc.text('Reporte de Transacciones y Estado Financiero', margin + 8, 29);

    // Metadatos a la derecha
    doc.setFontSize(8);
    doc.setTextColor(224, 222, 244);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - margin - 6, 20, { align: 'right' });
    doc.text(`Usuario: ${nombreUsuario}`, pageWidth - margin - 6, 25, { align: 'right' });
    doc.text(`Filtro: ${filtroTexto}`, pageWidth - margin - 6, 30, { align: 'right' });

    // ── 2. Tarjetas de Resumen Financiero (KPIs) ──────────────────────
    let yPos = 44;
    const cardGap = 4;
    const cardWidth = (contentWidth - (cardGap * 2)) / 3;
    const cardHeight = 18;

    // Card 1: Ingresos
    doc.setFillColor(235, 248, 244);
    doc.setDrawColor(45, 149, 123);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    doc.setTextColor(45, 149, 123);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TOTAL INGRESOS', margin + 5, yPos + 6);
    doc.setFontSize(10.5);
    doc.text(`+${formatCurrency(totalIngresos)}`, margin + 5, yPos + 13);

    // Card 2: Gastos
    const card2X = margin + cardWidth + cardGap;
    doc.setFillColor(253, 242, 244);
    doc.setDrawColor(235, 111, 146);
    doc.setLineWidth(0.4);
    doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    doc.setTextColor(235, 111, 146);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TOTAL GASTOS', card2X + 5, yPos + 6);
    doc.setFontSize(10.5);
    doc.text(`-${formatCurrency(totalGastos)}`, card2X + 5, yPos + 13);

    // Card 3: Balance Neto
    const card3X = card2X + cardWidth + cardGap;
    const balanceColor = balance >= 0 ? [120, 80, 180] : [235, 111, 146];
    doc.setFillColor(244, 239, 251);
    doc.setDrawColor(196, 167, 231);
    doc.setLineWidth(0.4);
    doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('BALANCE NETO', card3X + 5, yPos + 6);
    doc.setFontSize(10.5);
    doc.text(`${formatCurrency(balance)}`, card3X + 5, yPos + 13);

    yPos += cardHeight + 8;

    // Helper para dibujar encabezado de tabla de categoría
    function dibujarTableHeader(currentY) {
      doc.setFillColor(31, 29, 46);
      doc.roundedRect(margin, currentY, contentWidth, 6.5, 1.5, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('TIPO', margin + 4, currentY + 4.5);
      doc.text('MONTO', margin + 30, currentY + 4.5);
      doc.text('DESCRIPCIÓN', margin + 70, currentY + 4.5);
      doc.text('FECHA', pageWidth - margin - 4, currentY + 4.5, { align: 'right' });

      return currentY + 7.5;
    }

    // ── 3. Categorías y Tablas de Transacciones ────────────────────────
    categoriasFiltradas.forEach(category => {
      const txs = category.transactions || [];
      if (txs.length === 0) return;

      // Calcular subtotal de categoría
      let catTotal = 0;
      txs.forEach(t => catTotal += t.amount);
      const esIngresoCat = txs.some(t => t.type === 'income') && !txs.some(t => t.type === 'expense');

      // Verificar si cabe el bloque de categoría (al menos header + tabla + 2 filas)
      if (yPos + 26 > bottomLimit) {
        doc.addPage();
        yPos = 20;
      }

      // Banner de la Categoría
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yPos, contentWidth, 7.5, 2, 2, 'FD');

      // Indicador de color de categoría
      doc.setFillColor(esIngresoCat ? 45 : 235, esIngresoCat ? 149 : 111, esIngresoCat ? 123 : 146);
      doc.circle(margin + 4.5, yPos + 3.75, 1.8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(category.name, margin + 9, yPos + 5.2);

      // Subtotal a la derecha
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const subtotalTexto = `${txs.length} ${txs.length === 1 ? 'movimiento' : 'movimientos'}  •  Subtotal: ${formatCurrency(catTotal)}`;
      doc.text(subtotalTexto, pageWidth - margin - 4, yPos + 5.2, { align: 'right' });

      yPos += 9;

      // Dibujar cabecera de columnas
      yPos = dibujarTableHeader(yPos);

      // Dibujar filas de transacciones
      txs.forEach((transaction, idx) => {
        if (yPos + 7 > bottomLimit) {
          doc.addPage();
          yPos = 20;
          yPos = dibujarTableHeader(yPos);
        }

        // Fila alternada
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, yPos - 1, contentWidth, 6.2, 'F');
        }

        const isIncome = transaction.type === 'income';
        const tipoTexto = isIncome ? 'Ingreso' : 'Gasto';
        const montoTexto = formatCurrency(transaction.amount);
        const descTexto = transaction.description || 'Sin descripción';
        const fechaTexto = formatDate(transaction.date);

        // Badge Tipo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        if (isIncome) {
          doc.setTextColor(45, 149, 123);
        } else {
          doc.setTextColor(235, 111, 146);
        }
        doc.text(tipoTexto, margin + 4, yPos + 3.5);

        // Monto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(montoTexto, margin + 30, yPos + 3.5);

        // Descripción (truncada si es muy larga)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(71, 85, 105);
        const descCorta = descTexto.length > 45 ? descTexto.substring(0, 42) + '...' : descTexto;
        doc.text(descCorta, margin + 70, yPos + 3.5);

        // Fecha
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(fechaTexto, pageWidth - margin - 4, yPos + 3.5, { align: 'right' });

        // Línea divisoria muy suave entre filas
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(margin, yPos + 5.2, pageWidth - margin, yPos + 5.2);

        yPos += 6.2;
      });

      yPos += 6; // Espacio entre categorías
    });

    // ── 4. Running Header & Footer en todas las páginas ────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Running header en páginas 2+
      if (i > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('FinanzApp  •  Reporte Detallado de Transacciones', margin, 10);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, 12, pageWidth - margin, 12);
      }

      // Running footer en todas las páginas
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('FinanzApp • Documento confidencial generado automáticamente', margin, pageHeight - 7);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    const fileName = `FinanzApp-${_obtenerNombreArchivoUsuario()}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    mostrarExito('Archivo PDF exportado correctamente con formato ejecutivo.');
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    mostrarError(`Error al exportar PDF: ${error.message}`);
  }
}

let currentDatePicker = null;
let selectedDate = null;
let currentDisplayDate = new Date();

/**
 * Abre el selector de fecha para el input asociado al ID de categoría indicado.
 * @param {string|number} inputId - ID de la categoría o la cadena `'edit'` para el modal de edición.
 */
function abrirSelectorFecha(inputId) {
  currentDatePicker = inputId;

  let inputEl;
  if (inputId === 'edit') {
    inputEl = document.getElementById('editTransactionDate');
  } else if (inputId === 'gmail') {
    inputEl = document.getElementById('gmailTxDate');
  } else {
    inputEl = document.getElementById(`transaction-date-${inputId}`);
  }
  let displayDate = new Date();
  selectedDate = null;
  
  if (inputEl && inputEl.value) {
    const parsed = parseFechaInput(inputEl.value);
    if (parsed) {
      displayDate = parsed;
      selectedDate = parsed;
    }
  }
  
  currentDisplayDate = displayDate;
  
  const datePickerModal = document.getElementById('datePickerModal');
  if (datePickerModal) {
    datePickerModal.classList.add('active');
    datePickerModal.removeAttribute('inert');
    datePickerModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    renderizarCalendario();
  }
}

/** Renderiza la cuadrícula de días del mes actualmente visible en el selector de fecha. */
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

/**
 * Establece `date` como la fecha seleccionada y actualiza el marcado visual del calendario.
 * @param {Date} date
 */
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

/**
 * Avanza o retrocede el mes visible en el selector de fecha.
 * @param {1|-1} direction - `1` para avanzar, `-1` para retroceder.
 */
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

/** Establece la fecha seleccionada al día de hoy y re-renderiza el calendario. */
function establecerHoy() {
  selectedDate = new Date();
  currentDisplayDate = new Date();
  renderizarCalendario();
}


/** Escribe la fecha seleccionada en el input de orige y cierra el selector. */
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
  
  let inputTarget;
  if (currentDatePicker === 'edit') {
    inputTarget = document.getElementById('editTransactionDate');
  } else if (currentDatePicker === 'gmail') {
    inputTarget = document.getElementById('gmailTxDate');
  } else {
    inputTarget = document.getElementById(`transaction-date-${currentDatePicker}`);
  }
  const input = inputTarget;
  if (input) {
    input.value = formatDate(selectedDate);
  }
  
  const datePickerModal = document.getElementById('datePickerModal');
  if (datePickerModal) {
    cerrarModal(datePickerModal);
  }
}

// Compatibilidad: exponer `openDatePicker` globalmente para los botones en HTML
function openDatePicker(inputId) {
  try {
    abrirSelectorFecha(inputId);
  } catch (e) {
    console.error('openDatePicker: error llamando a abrirSelectorFecha', e);
  }
}
window.openDatePicker = openDatePicker;

/**
 * Adjunta el manejador de eventos unificado a una tarjeta de categoría.
 * Gestiona acciones de menú, formulario y ordenación mediante delegación de eventos.
 * @param {HTMLElement} tarjeta    - Elemento DOM de la tarjeta.
 * @param {*}           categoryId - ID de la categoría asociada.
 */
function configurarListenersCategoria(tarjeta, categoryId) {

  const toggleCategoriaCompacta = () => {
    if (!window.matchMedia('(max-width: 980px)').matches) return;
    tarjeta.classList.toggle('mobile-collapsed');
    if (tarjeta.classList.contains('mobile-collapsed')) {
      expandedCategoryIds.delete(categoryId);
    } else {
      expandedCategoryIds.add(categoryId);
    }
  };

  const encabezadoCategoria = tarjeta.querySelector('.category-header');
  if (encabezadoCategoria) {
    encabezadoCategoria.addEventListener('click', function(e) {
      if (e.target.closest('.category-menu-wrapper') || e.target.closest('.category-drag-handle')) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      toggleCategoriaCompacta();
    });
  }

  tarjeta.addEventListener('click', function(e) {

    let target = e.target;
    while (target && !target.getAttribute('data-action') && !target.classList.contains('category-menu-btn') && target !== tarjeta) {
      target = target.parentElement;
    }
    
    if (!target) {
      return;
    }
    
    const action = target.getAttribute('data-action');
    const catId = parseInt(target.getAttribute('data-category-id')) || categoryId;

    // Cierra cualquier menú abierto si el click no fue dentro del wrapper
    if (!e.target.closest('.category-menu-wrapper')) {
      document.querySelectorAll('.category-menu.active').forEach(m => m.classList.remove('active'));
    }

    e.stopPropagation();
    e.preventDefault();

    if (target.classList.contains('category-menu-btn')) {
      alternarMenuCategoria(categoryId);
      return;
    }

    if (!action) {
      return;
    }

    if (target.classList.contains('category-menu-item')) {

      const menu = document.getElementById(`category-menu-${catId}`);
      if (menu) {
        menu.classList.remove('active');
      }

      if (action === 'alternarFijado') {
        alternarFijado(catId);
      } else if (action === 'editarCategoria') {
        mostrarModalEditarCategoria(catId);
      } else if (action === 'limpiarTransacciones') {
        limpiarTransaccionesCategoria(catId);
      } else if (action === 'eliminarCategoria') {
        mostrarModalEliminarCategoria(catId);
      } else {
        console.warn('Acción no reconocida:', action);
      }
      return;
    }

    if (action === 'agregarTransaccion') {
      agregarTransaccion(categoryId);
      return;
    }

    if (action === 'toggleTransactions') {
      const card = target.closest('.category-card');
      if (card) {
        const isCurrentlyExpanded = card.classList.contains('tx-expanded');
        
        // Colapsar todas las demás tarjetas
        document.querySelectorAll('.category-card.tx-expanded').forEach(otherCard => {
          if (otherCard !== card) {
            otherCard.classList.remove('tx-expanded');
            const otherIcon = otherCard.querySelector('.compact-toggle-btn i');
            if (otherIcon) otherIcon.className = 'fas fa-chevron-down';
          }
        });

        // Alternar la actual
        card.classList.toggle('tx-expanded', !isCurrentlyExpanded);
        const icon = target.querySelector('i');
        if (icon) {
          icon.className = !isCurrentlyExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        }
      }
      return;
    }

    if (action === 'abrirSelectorFecha') {
      abrirSelectorFecha(categoryId);
      return;
    }

    if (action === 'editarTransaccion' || action === 'eliminarTransaccion') {
      const transactionIdRaw = target.getAttribute('data-transaction-id');

      const transactionId = isNaN(parseInt(transactionIdRaw)) ? transactionIdRaw : parseInt(transactionIdRaw);
      
      
      if (action === 'editarTransaccion') {
        editarTransaccion(catId, transactionId);
      } else if (action === 'eliminarTransaccion') {
        const itemEl = target.closest('.transaction-item');
        if (itemEl) {
          itemEl.classList.add('is-deleting');
          setTimeout(() => eliminarTransaccion(catId, transactionId), 220);
        } else {
          eliminarTransaccion(catId, transactionId);
        }
      }
      return;
    }

    if (action === 'sortFecha') {
      const current = sortFechaCategorias.get(catId) || 'newest';
      sortFechaCategorias.set(catId, current === 'newest' ? 'oldest' : 'newest');
      _guardarSort();
      renderizarCategorias();
      return;
    }

    if (action === 'sortMonto') {
      const current = sortMontoCategorias.get(catId) || 'off';
      const next = current === 'off' ? 'amount-desc' : current === 'amount-desc' ? 'amount-asc' : 'off';
      sortMontoCategorias.set(catId, next);
      _guardarSort();
      renderizarCategorias();
      return;
    }

    if (action === 'txPrevPage') {
      const current = paginaCategorias.get(catId) || 0;
      if (current > 0) { paginaCategorias.set(catId, current - 1); renderizarCategorias(); }
      return;
    }

    if (action === 'txNextPage') {
      const current = paginaCategorias.get(catId) || 0;
      paginaCategorias.set(catId, current + 1);
      renderizarCategorias();
      return;
    }

    if (action === 'toggleCollapse') {
      toggleCategoriaCompacta();
      return;
    }

    
  });
  
}

/**
 * Re-renderiza todas las tarjetas de categoría en el contenedor principal
 * aplicando los filtros y el orden activos, y actualiza el resumen financiero.
 */
function renderizarCategorias() {
  const categoriesContainer = document.getElementById('categoriesContainer');
  if (categoriesContainer && !categoriesContainer._menuDelegationBound) {
    categoriesContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.category-menu-btn, .category-menu-item');
  if (!btn) return;
  const catId = btn.getAttribute('data-category-id') || btn.closest('.category-card')?.getAttribute('data-category-id');
  if (!catId) return;
      if (btn.classList.contains('category-menu-btn')) {
        alternarMenuCategoria(catId);
        e.preventDefault();
        return;
      }
      const action = btn.getAttribute('data-action');
      const menu = document.getElementById(`category-menu-${catId}`);
      if (menu) menu.classList.remove('active');
      switch (action) {
        case 'alternarFijado': alternarFijado(catId); break;
        case 'editarCategoria': mostrarModalEditarCategoria(catId); break;
  case 'limpiarTransacciones': limpiarTransaccionesCategoria(catId, btn); break;
        case 'eliminarCategoria': mostrarModalEliminarCategoria(catId); break;
      }
      e.preventDefault();
    });
    categoriesContainer._menuDelegationBound = true;
  }
  if (!categoriesContainer) {
    console.error('No se encontró el contenedor de categorías');
    return;
  }
  

  actualizarIndicadorFiltros();
  categoriesContainer.innerHTML = '';
  if (datosUsuario.categories.length === 0) {
    categoriesContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-tags"></i>
        <p>No hay categorías creadas. Agrega tu primera categoría.</p>
      </div>
    `;
    actualizarResumenFinanciero();
    return;
  }

  const categoriasFiltradas = aplicarFiltrosACategorias();
  const totalTransaccionesFiltradas = categoriasFiltradas.reduce((sum, cat) => sum + cat.transactions.length, 0);

  const hayFiltrosActivos = filtrosActuales.year !== null || filtrosActuales.month !== null || (filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim() !== '');

  if (hayFiltrosActivos && totalTransaccionesFiltradas === 0) {
    categoriesContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-filter"></i>
        <p>No se encontraron transacciones para los filtros seleccionados.</p>
      </div>
    `;
    actualizarResumenFinanciero();
    return;
  }

  let categoriasParaMostrar = obtenerCategoriasMostradas();
  if (hayFiltrosActivos) {
    const idsFiltradosConTransacciones = new Set(
      categoriasFiltradas.filter(c => (c.transactions && c.transactions.length > 0)).map(c => c.id)
    );
    categoriasParaMostrar = categoriasParaMostrar.filter(c => idsFiltradosConTransacciones.has(c.id));
    if (categoriasParaMostrar.length === 0) {
      let mensajeFiltro = 'No se encontraron transacciones';
      if (filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim() !== '') {
        mensajeFiltro += ` para la búsqueda "${esc(filtrosActuales.searchTerm)}"`;
      } else if (filtrosActuales.year !== null || filtrosActuales.month !== null) {
        mensajeFiltro += ' para el período seleccionado';
      }
      mensajeFiltro += '.';
      categoriesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-filter"></i>
          <p>${mensajeFiltro}</p>
        </div>
      `;
      actualizarResumenFinanciero();
      return;
    }
  }
  

  categoriasParaMostrar.forEach((category, cardIndex) => {
    const categoriaFiltrada = categoriasFiltradas.find(c => c.id === category.id);
    const transaccionesFiltradas = categoriaFiltrada ? categoriaFiltrada.transactions : [];
    

    let totalIngresos = 0;
    let totalGastos = 0;
    
    if (category.fixedType === 'income') {

      totalIngresos = transaccionesFiltradas.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) || 0;
    } else if (category.fixedType === 'expense') {

      totalGastos = transaccionesFiltradas.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;
    } else {

      totalIngresos = transaccionesFiltradas.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) || 0;
      totalGastos = transaccionesFiltradas.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;
    }

    const controlesTipoHtml = category.fixedType
      ? `<div class="form-group"><div class="type-chip ${category.fixedType}">${category.fixedType === 'income' ? 'Ingreso' : 'Gasto'}</div></div>`
      : `
        <div class="form-group">
          <div class="transaction-type-selector" id="transaction-type-${category.id}">
            <button type="button" class="transaction-type-btn" data-value="income">
              <i class="fas fa-arrow-up"></i>
              <span>Ingreso</span>
            </button>
            <button type="button" class="transaction-type-btn" data-value="expense">
              <i class="fas fa-arrow-down"></i>
              <span>Gasto</span>
            </button>
          </div>
          <div class="inline-warning" id="type-warning-${category.id}">Por favor, elige un tipo de transacción</div>
        </div>
      `;

    const sumaIE = totalIngresos + totalGastos;
    const porcentajeIngreso = sumaIE > 0 ? Math.round((totalIngresos / sumaIE) * 100) : 0;
    const porcentajeGasto = sumaIE > 0 ? (100 - porcentajeIngreso) : 0;

    const txVisibles = transaccionesFiltradas.filter(t => {
      if (category.fixedType === 'income') return t.type === 'income';
      if (category.fixedType === 'expense') return t.type === 'expense';
      return true;
    });
    const sortFecha = sortFechaCategorias.get(category.id) || 'newest';
    const sortMonto = sortMontoCategorias.get(category.id) || 'off';
    const txOrdenadas = [...txVisibles].sort((a, b) => {
      if (sortMonto === 'amount-desc') return b.amount - a.amount;
      if (sortMonto === 'amount-asc') return a.amount - b.amount;
      return sortFecha === 'oldest' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date);
    });
    const txPerPage = (typeof window.__appTxPerPage === 'number' && window.__appTxPerPage > 0) ? window.__appTxPerPage : Infinity;
    const totalPaginas = txPerPage === Infinity ? 1 : Math.max(1, Math.ceil(txOrdenadas.length / txPerPage));
    const paginaActual = Math.min(paginaCategorias.get(category.id) || 0, totalPaginas - 1);
    paginaCategorias.set(category.id, paginaActual);
    const txPagina = txPerPage === Infinity ? txOrdenadas : txOrdenadas.slice(paginaActual * txPerPage, (paginaActual + 1) * txPerPage);
    const fechaIcon = sortFecha === 'newest' ? 'fa-sort-amount-down' : 'fa-sort-amount-up';
    const fechaLabel = sortFecha === 'newest' ? 'Más reciente primero' : 'Más antiguo primero';
    const montoIcon = sortMonto === 'amount-desc' ? 'fa-sort-numeric-down' : sortMonto === 'amount-asc' ? 'fa-sort-numeric-up' : 'fa-dollar-sign';
    const montoLabel = sortMonto === 'amount-desc' ? 'Mayor monto primero' : sortMonto === 'amount-asc' ? 'Menor monto primero' : 'Ordenar por monto';
    const montoClass = sortMonto === 'amount-desc' ? ' sort-btn--desc' : sortMonto === 'amount-asc' ? ' sort-btn--asc' : '';
    const mostrarTooltipFiltrosTx = esVistaEscritorio();
    const fechaTitleAttr = mostrarTooltipFiltrosTx ? ` title="${fechaLabel}"` : '';
    const montoTitleAttr = mostrarTooltipFiltrosTx ? ` title="${montoLabel}"` : '';

  const tarjeta = document.createElement('div');
  const isExpanded = expandedCategoryIds.has(category.id);
  let viewMode = 'extended';
  try {
    const rawSettings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
    if (rawSettings.categoryViewMode === 'compact') viewMode = 'compact';
  } catch (e) {}

  tarjeta.className = `category-card fade-in${category.isPinned ? ' pinned' : ''}${viewMode === 'compact' ? ' compact-mode' : (isExpanded ? '' : ' mobile-collapsed')}`;
  tarjeta.setAttribute('data-category-id', category.id);
  tarjeta.style.animationDelay = `${cardIndex * 45}ms`;

    tarjeta.innerHTML = `
      <div class="category-header">
        <button
          class="category-drag-handle btn-icon"
          type="button"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar para reordenar"
          ${category.isPinned ? 'disabled' : ''}
        >
          <i class="fas fa-grip-lines" aria-hidden="true"></i>
        </button>
  <div class="category-name">${esc(category.name)}</div>
        
        <div class="category-menu-wrapper">
          <button
            class="category-menu-btn btn-icon"
            type="button"
            title="Opciones"
            aria-label="Opciones de categoría"
            data-category-id="${category.id}"
          >
            <i class="fas fa-ellipsis-v" aria-hidden="true"></i>
          </button>
          
          <div class="category-menu" id="category-menu-${category.id}">
            <button
              class="category-menu-item ${category.isPinned ? 'pin-on' : ''}"
              data-action="alternarFijado"
              data-category-id="${category.id}"
            >
              <i class="fas fa-thumbtack"></i>
              ${category.isPinned ? 'Desfijar' : 'Fijar categoría'}
            </button>
            <button
              class="category-menu-item"
              data-action="editarCategoria"
              data-category-id="${category.id}"
            >
              <i class="fas fa-edit"></i>
              Renombrar
            </button>
            <button
              class="category-menu-item"
              data-action="limpiarTransacciones"
              data-category-id="${category.id}"
            >
              <i class="fas fa-eraser"></i>
              Limpiar transacciones
            </button>
            <button
              class="category-menu-item"
              data-action="eliminarCategoria"
              data-category-id="${category.id}"
            >
              <i class="fas fa-trash"></i>
              Eliminar categoría
            </button>
          </div>
        </div>
      </div>

      <div class="category-stats alt">
        <div class="ie-summary">
          ${category.fixedType === 'income' ? `
            <div class="amount-chip income" title="Ingresos">
              <i class="fas fa-arrow-up" aria-hidden="true"></i>
              ${formatCurrency(totalIngresos)}
            </div>
          ` : category.fixedType === 'expense' ? `
            <div class="amount-chip expense" title="Total Gastos: ${formatCurrency(totalGastos)}">
              <i class="fas fa-arrow-down" aria-hidden="true"></i>
              ${formatCurrency(totalGastos)}
            </div>
          ` : `
            <div class="amount-chip income" title="Total Ingresos: ${formatCurrency(totalIngresos)}">
              <i class="fas fa-arrow-up" aria-hidden="true"></i>
              ${formatCurrency(totalIngresos)}
            </div>
            <div class="amount-chip expense" title="Total Gastos: ${formatCurrency(totalGastos)}">
              <i class="fas fa-arrow-down" aria-hidden="true"></i>
              ${formatCurrency(totalGastos)}
            </div>
          `}
        </div>
      </div>

      <div class="category-details">
      <div class="transaction-form">
        ${controlesTipoHtml}
        <div class="form-group">
          <input type="text" class="form-control" id="transaction-amount-${category.id}" placeholder="Monto" inputmode="decimal" aria-label="Monto para ${esc(category.name)}">
          <div class="warning-message" id="amount-digit-warning-${category.id}">${MSG_MAX_DIGITS}</div>
          <div class="inline-warning" id="amount-error-${category.id}">Por favor, ingresa un monto válido</div>
        </div>
        <div class="form-group">
          <input type="text" class="form-control" id="transaction-desc-${category.id}" placeholder="Descripción (opcional)" maxlength="80" aria-label="Descripción para ${esc(category.name)}">
        </div>
        <div class="form-group">
          <div class="date-picker-wrapper">
            <input type="text" class="form-control date-picker-input" id="transaction-date-${category.id}" placeholder="Seleccionar fecha" readonly aria-label="Fecha para ${esc(category.name)}">
            <button type="button" class="date-picker-btn" data-action="abrirSelectorFecha" data-category-id="${category.id}">
              <i class="fas fa-calendar-alt"></i>
            </button>
          </div>
          <div class="inline-warning" id="date-error-${category.id}">Por favor, ingresa una fecha válida</div>
        </div>
        <button class="btn btn-primary" style="width: 100%;" data-action="agregarTransaccion" data-category-id="${category.id}" aria-label="Agregar transacción a ${esc(category.name)}">Agregar Transacción</button>
      </div>

      ${viewMode === 'compact' ? `
      <div class="compact-tx-toggle" style="margin-top: 10px; text-align: center;">
        <button class="btn btn-secondary btn-sm compact-toggle-btn" style="width: 100%; padding: 8px; border-radius: 8px; font-weight: 500;" data-action="toggleTransactions" data-category-id="${category.id}">
          <i class="fas fa-chevron-down"></i> Ver transacciones (${txVisibles.length})
        </button>
      </div>
      ` : ''}

      <div class="transaction-list${txVisibles.length === 0 ? ' is-empty' : ''}">
        ${txVisibles.length > 0 ? `
          <div class="transaction-list-header">
            <span class="transaction-count">${txVisibles.length} ${txVisibles.length === 1 ? 'transacción' : 'transacciones'}${totalPaginas > 1 ? ` · Pág. ${paginaActual + 1}/${totalPaginas}` : ''}</span>
            <div class="sort-btn-group">
              <button class="sort-btn btn-icon" data-action="sortFecha" data-category-id="${category.id}"${fechaTitleAttr}>
                <i class="fas ${fechaIcon}"></i>
              </button>
              <button class="sort-btn btn-icon${montoClass}" data-action="sortMonto" data-category-id="${category.id}"${montoTitleAttr}>
                <i class="fas ${montoIcon}"></i>
              </button>
            </div>
          </div>
        ` : ''}
        ${txPagina.map(t => `
          <div class="transaction-item">
            <div class="transaction-item-header">
              <div class="transaction-amount ${t.type}" title="${t.type === 'income' ? 'Ingreso: ' : 'Gasto: '}${formatCurrency(t.amount)}">${formatCurrency(t.amount)}</div>
              <div class="transaction-actions">
                <button class="btn-icon" data-action="editarTransaccion" data-category-id="${category.id}" data-transaction-id="${t.id}" aria-label="Editar transacción de ${esc(category.name)}"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" data-action="eliminarTransaccion" data-category-id="${category.id}" data-transaction-id="${t.id}" aria-label="Eliminar transacción de ${esc(category.name)}"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div class="transaction-desc" title="${esc(t.description || 'Sin descripción')}">${esc(t.description || 'Sin descripción')}</div>
            <div class="transaction-date">${formatDate(t.date)}</div>
          </div>
        `).join('')}
        ${totalPaginas > 1 ? `
          <div class="tx-pagination">
            <button class="btn-icon tx-page-btn" data-action="txPrevPage" data-category-id="${category.id}" ${paginaActual === 0 ? 'disabled' : ''} aria-label="Página anterior"><i class="fas fa-chevron-left"></i></button>
            <span class="tx-page-info">${paginaActual + 1} / ${totalPaginas}</span>
            <button class="btn-icon tx-page-btn" data-action="txNextPage" data-category-id="${category.id}" ${paginaActual >= totalPaginas - 1 ? 'disabled' : ''} aria-label="Página siguiente"><i class="fas fa-chevron-right"></i></button>
          </div>
        ` : ''}
      </div>
      </div>
    `;

    const handleEl = tarjeta.querySelector('.category-drag-handle');
    if (handleEl) {
      handleEl.setAttribute('draggable', String(!category.isPinned));
      handleEl.addEventListener('dragstart', (e) => {
        if (category.isPinned) {
          e.preventDefault();
          return;
        }
        dragCategoryId = category.id;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', String(category.id)); } catch (_) {}
        }
      });
    }

    tarjeta.addEventListener('dragover', (e) => {
      if (!dragCategoryId) return;
      const dragCat = datosUsuario.categories.find(c => c.id === dragCategoryId);
      if (!dragCat) return;
      if (dragCat.isPinned !== category.isPinned) return;
      e.preventDefault();
      tarjeta.classList.add('drag-over');
    });

    tarjeta.addEventListener('dragleave', () => { tarjeta.classList.remove('drag-over'); });

    tarjeta.addEventListener('drop', async (e) => {
      e.preventDefault();
      tarjeta.classList.remove('drag-over');

      const targetId = category.id;
      if (!dragCategoryId || dragCategoryId === targetId) return;

      const displayed = obtenerCategoriasMostradas();
      const isPinnedGroup = category.isPinned;

      let pinnedCats = displayed.filter(c => c.isPinned);
      let unpinnedCats = displayed.filter(c => !c.isPinned);
      let group = isPinnedGroup ? pinnedCats.slice() : unpinnedCats.slice();

      const from = group.findIndex(c => c.id === dragCategoryId);
      const to = group.findIndex(c => c.id === targetId);
      if (from === -1 || to === -1) return;

      const [moved] = group.splice(from, 1);
      group.splice(to, 0, moved);

      if (isPinnedGroup) pinnedCats = group; else unpinnedCats = group;

      datosUsuario.categories = [...pinnedCats, ...unpinnedCats];

      dragCategoryId = null;
      renderizarCategorias();
      renderizarGraficos();
      marcarCambioDatos();
      await persist();
    });

    categoriesContainer.appendChild(tarjeta);

    configurarListenersCategoria(tarjeta, category.id);

    if (!category.fixedType) {
      const transactionTypeSelector = tarjeta.querySelector(`#transaction-type-${category.id}`);
      const typeWarning = document.getElementById(`type-warning-${category.id}`);
      
      if (transactionTypeSelector && typeWarning) {
        typeWarning.style.display = 'none';
        
        const buttons = transactionTypeSelector.querySelectorAll('.transaction-type-btn');
        buttons.forEach(button => {
          button.addEventListener('click', () => {

            buttons.forEach(btn => btn.classList.remove('active'));

            button.classList.add('active');

            typeWarning.style.display = 'none';
          });
        });
      }
    }

    const amountInput = document.getElementById(`transaction-amount-${category.id}`);
    const descInput = document.getElementById(`transaction-desc-${category.id}`);
    const dateInput = document.getElementById(`transaction-date-${category.id}`);
    const amountDigitWarning = document.getElementById(`amount-digit-warning-${category.id}`);
    const amountError = document.getElementById(`amount-error-${category.id}`);
    const dateError = document.getElementById(`date-error-${category.id}`);

    amountDigitWarning.style.display = 'none';
    amountError.style.display = 'none';
    dateError.style.display = 'none';

    if (dateInput) {
      dateInput.value = formatDate(new Date());
    }

    amountInput.addEventListener('input', function () {
      const caret = this.selectionStart;
      const before = this.value;
      const formatted = formatInputAmountEs(before);
      this.value = formatted;
      const diff = this.value.length - before.length;
      try { this.setSelectionRange(caret + diff, caret + diff); } catch {}
      amountDigitWarning.style.display = 'none';
      if (this.value.trim() !== '') amountError.style.display = 'none';
    });

    const submitOnEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        agregarTransaccion(category.id);
      }
    };
    amountInput.addEventListener('keydown', submitOnEnter);
    descInput.addEventListener('keydown', submitOnEnter);
    if (dateInput) dateInput.addEventListener('keydown', submitOnEnter);
  });

  actualizarResumenFinanciero();
}

/**
 * Valida y agrega una nueva transacción a la categoría indicada.
 * @param {*} categoryId - ID de la categoría destino.
 */
async function agregarTransaccion(categoryId) {
  
  const category = buscarCategoria(categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  

  const typeSelect = category.fixedType ? null : document.getElementById(`transaction-type-${category.id}`);
  const amountInput = document.getElementById(`transaction-amount-${category.id}`);
  const descInput = document.getElementById(`transaction-desc-${category.id}`);
  const dateInput = document.getElementById(`transaction-date-${category.id}`);


  const typeWarning = category.fixedType ? null : document.getElementById(`type-warning-${category.id}`);
  const amountDigitWarning = document.getElementById(`amount-digit-warning-${category.id}`);
  const amountError = document.getElementById(`amount-error-${category.id}`);
  const dateError = document.getElementById(`date-error-${category.id}`);

  if (!amountInput) {
    console.error('No se encontró el input de monto para la categoría:', categoryId);
    return;
  }

  let typeValue = '';
  
  if (!category.fixedType) {
    if (!typeSelect) {
      console.error('No se encontró el selector de tipo para la categoría:', categoryId);
      return;
    }

    const activeButton = typeSelect.querySelector('.transaction-type-btn.active');
    typeValue = activeButton ? activeButton.getAttribute('data-value') : '';
    
    if (!typeValue || typeValue === '') {
      if (typeWarning) typeWarning.style.display = 'block';
      if (activeButton) activeButton.focus();
      return;
    }
  }

  const amountStr = amountInput.value.trim();
  const normalizedFromEs = parseEsAmountToNormalized(amountStr);
  const description = (descInput.value || '').trim();
  const dateStr = dateInput.value.trim();


  if (!normalizedFromEs) {
    if (amountError) {
      amountError.textContent = 'Por favor, ingresa un monto';
      amountError.style.display = 'block';
    }
    amountInput.focus();
    return;
  }

  if (!dateStr) {
    if (dateError) {
      dateError.textContent = 'Por favor, selecciona una fecha';
      dateError.style.display = 'block';
    }
    dateInput.focus();
    return;
  }

  const dateParts = dateStr.split('/');
  if (dateParts.length !== 3) {
    if (dateError) {
      dateError.textContent = 'Formato de fecha inválido';
      dateError.style.display = 'block';
    }
    dateInput.focus();
    return;
  }

  const day = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const year = parseInt(dateParts[2]);
  
  const inputDate = new Date(year, month, day);
  
  const dateValidation = validateDate(inputDate);
  if (!dateValidation.isValid) {
    if (dateError) {
      dateError.textContent = dateValidation.error;
      dateError.style.display = 'block';
    }
    dateInput.focus();
    return;
  }

  const hadNonNumeric = /[^\d.,]/.test(amountStr);
  const multipleDecimals = hasMultipleDecimalSeparators(amountStr);
  const tooManyDecimals = hasTooManyFractionDigits(amountStr, 2);
  const sanitized = sanitizeAmount(normalizedFromEs, 8, 2);
  const normalized = ensureTwoDecimals(sanitized);
  if (!isValidAmount(normalized, 8, 2)) {
    if (amountError) {
      amountError.textContent = 'Por favor, ingresa un monto válido';
      amountError.style.display = 'block';
    }
    amountInput.focus();
    return;
  }

  const amount = parseFloat(normalized);
  const type = category.fixedType || typeValue;

  category.transactions = category.transactions || [];
  category.transactions.push({
    id: generarId(),
    type,
    amount: redondear2(amount),
    description: description || 'Sin descripción',
    date: dateValidation.date
  });


  if (typeSelect) {

    const buttons = typeSelect.querySelectorAll('.transaction-type-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
  }
  amountInput.value = '';
  descInput.value = '';

  dateInput.value = formatDate(new Date());
  if (typeWarning) typeWarning.style.display = 'none';
  if (amountError) amountError.style.display = 'none';
  if (amountDigitWarning) amountDigitWarning.style.display = 'none';
  if (dateError) dateError.style.display = 'none';

  marcarCambioDatos();
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
  await persist();
  setTimeout(() => {
    window.DataEvents.emit('transactionChanged', { action: 'add', categoryId, transactionId: category.transactions[category.transactions.length - 1].id });
  }, 100);
}

/**
 * Alterna la visibilidad del menú contextual de una categoría,
 * cerrando todos los demás menús abiertos.
 * @param {*} categoryId
 */
function posicionarMenuCategoria(menu) {
  if (!menu) return;

  menu.classList.remove('open-up');

  const wrapper = menu.closest('.category-menu-wrapper');
  if (!wrapper) return;

  const mobileNav = document.querySelector('.mobile-bottom-nav');
  const mobileNavVisible = mobileNav && window.getComputedStyle(mobileNav).display !== 'none';
  const mobileNavHeight = mobileNavVisible ? mobileNav.getBoundingClientRect().height : 0;
  const viewportPadding = 12;
  const blockedBottom = mobileNavHeight + viewportPadding;

  const wasActive = menu.classList.contains('active');
  if (!wasActive) menu.classList.add('active');

  const wrapperRect = wrapper.getBoundingClientRect();
  const menuHeight = menu.getBoundingClientRect().height || menu.scrollHeight || 0;
  const availableBelow = window.innerHeight - wrapperRect.bottom - blockedBottom;
  const availableAbove = wrapperRect.top - viewportPadding;

  if (!wasActive) menu.classList.remove('active');

  if (menuHeight > availableBelow && availableAbove > availableBelow) {
    menu.classList.add('open-up');
  }
}

function alternarMenuCategoria(categoryId) {
  const menu = document.getElementById(`category-menu-${categoryId}`);
  const allMenus = document.querySelectorAll('.category-menu');
  
  allMenus.forEach(m => {
    if (m !== menu) m.classList.remove('active');
  });
  
  if (menu) {
    const shouldOpen = !menu.classList.contains('active');

    if (shouldOpen) {
      posicionarMenuCategoria(menu);
    }

    menu.classList.toggle('active', shouldOpen);
  } else {
    console.error('No se encontró el menú para la categoría:', categoryId);
  }
}

/**
 * Abre el modal de edición de categoría precargando el nombre actual.
 * @param {*} categoryId
 */
function mostrarModalEditarCategoria(categoryId) {
  const category = buscarCategoria(categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  
  const editCategoryId = document.getElementById('editCategoryId');
  const editCategoryName = document.getElementById('editCategoryName');
  const editCategoryModal = document.getElementById('editCategoryModal');
  
  if (editCategoryId) editCategoryId.value = categoryId;
  if (editCategoryName) editCategoryName.value = category.name || '';
  if (editCategoryModal) abrirModal(editCategoryModal);
  
  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));
}
/**
 * Muestra el drawer de confirmación para eliminar una categoría y todas sus transacciones.
 * @param {*} categoryId
 */
function mostrarModalEliminarCategoria(categoryId) {
  const category = buscarCategoria(categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }

  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

  const ejecutar = async () => {
    const idx = datosUsuario.categories.findIndex(c => normalizarId(c.id) === normalizarId(categoryId));
    if (idx === -1) return;
    datosUsuario.categories.splice(idx, 1);
    marcarCambioDatos();
    renderizarCategorias();
    renderizarGraficos();
    actualizarUIEstadisticasDiarias();
    await persist();
    mostrarExito(`Categoría "${category.name}" eliminada`);
    setTimeout(() => { window.DataEvents.emit('categoryChanged', { action: 'delete', categoryId }); }, 100);
  };

  if (window.__appConfirmDelete === false) {
    ejecutar();
    return;
  }

  mostrarBottomDrawer({
    mensajeHtml: `¿Eliminar la categoría "<strong>${esc(category.name)}</strong>"?<br>Se eliminarán todas sus transacciones.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    variant: 'danger',
    onConfirm: ejecutar
  });
}

/**
 * Abre el modal de edición precargando los campos con los datos de la transacción.
 * @param {*} categoryId    - ID de la categoría que contiene la transacción.
 * @param {*} transactionId - ID de la transacción a editar.
 */
function editarTransaccion(categoryId, transactionId) {
  const category = datosUsuario.categories.find(c => c.id === categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  
  
  const transaction = (category.transactions || []).find(t => t.id == transactionId);
  if (!transaction) {
    console.error('No se encontró la transacción:', transactionId);
    return;
  }
  

  const typeSelect = document.getElementById('editTransactionType');
  const amountInput = document.getElementById('editTransactionAmount');
  const descInput = document.getElementById('editTransactionDesc');
  const dateInput = document.getElementById('editTransactionDate');
  const idInput = document.getElementById('editTransactionId');
  const categoryIdInput = document.getElementById('editTransactionCategoryId');
  const amountWarning = document.getElementById('amountWarning');
  const dateWarning = document.getElementById('editDateWarning');
  const editTransactionModal = document.getElementById('editTransactionModal');

  if (typeSelect) {
    if (category.fixedType) {
      const fixed = category.fixedType;
      typeSelect.dataset.mode = 'fixed';
      typeSelect.innerHTML = `
        <div class="type-chip ${fixed}">
          <i class="fas ${fixed === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
          <span>${fixed === 'income' ? 'Ingreso' : 'Gasto'}</span>
        </div>`;
      typeSelect.style.opacity = '0.85';
      typeSelect.style.pointerEvents = 'none';
      typeSelect.setAttribute('title', 'Tipo definido por la categoría');

      let hint = document.getElementById('editTypeFixedHint');
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'editTypeFixedHint';
        hint.innerHTML = '<i class="fas fa-lock" style="margin-right:6px;"></i><em>Tipo definido por la categoría</em>';
        hint.style.marginTop = '6px';
        hint.style.color = 'var(--muted, var(--gray))';
        hint.style.fontSize = '12px';
        const container = typeSelect.parentElement || typeSelect;
        container.insertBefore(hint, typeSelect.nextSibling);
      } else {
        hint.style.display = '';
      }
    } else {
      if (!typeSelect.querySelector('.transaction-type-btn')) {
        typeSelect.innerHTML = `
          <button type="button" class="transaction-type-btn" data-value="income">
            <i class="fas fa-arrow-up"></i>
            <span>Ingreso</span>
          </button>
          <button type="button" class="transaction-type-btn" data-value="expense">
            <i class="fas fa-arrow-down"></i>
            <span>Gasto</span>
          </button>`;
      }
      typeSelect.style.opacity = '1';
      typeSelect.style.pointerEvents = 'auto';
      typeSelect.removeAttribute('title');
      const hint = document.getElementById('editTypeFixedHint');
      if (hint) hint.remove();

      const buttons = typeSelect.querySelectorAll('.transaction-type-btn');
      buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-value') === transaction.type) {
          btn.classList.add('active');
        }
      });
    }
  }
  if (amountInput) amountInput.value = formatInputAmountEs(transaction.amount.toString());
  if (descInput) descInput.value = transaction.description || '';
  if (dateInput) {
    dateInput.value = formatDate(transaction.date);
  }
  if (idInput) idInput.value = transactionId;
  if (categoryIdInput) categoryIdInput.value = categoryId;
  if (amountWarning) amountWarning.style.display = 'none';
  if (dateWarning) dateWarning.style.display = 'none';
  if (editTransactionModal) {
    abrirModal(editTransactionModal);

    setTimeout(() => {
      setupEditTransactionTypeButtons();
    }, 100);
  }
}

/** Configura los botones de tipo (Ingreso/Gasto) en el modal de edición de transacción. */
function setupEditTransactionTypeButtons() {
  const typeSelector = document.getElementById('editTransactionType');
  if (typeSelector) {
    if (!typeSelector.querySelector('.transaction-type-btn')) return;
    const buttons = typeSelector.querySelectorAll('.transaction-type-btn');
    buttons.forEach(button => {
      button.addEventListener('click', () => {

        buttons.forEach(btn => btn.classList.remove('active'));

        button.classList.add('active');
      });
    });
  }
}

/**
 * Elimina una transacción de la categoría, almacena el último eliminado para deshacer
 * y actualiza la UI y el almacén.
 * @param {*} categoryId    - ID de la categoría.
 * @param {*} transactionId - ID de la transacción a eliminar.
 */
async function eliminarTransaccion(categoryId, transactionId) {
  const category = datosUsuario.categories.find(c => c.id === categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  
  
  const idx = (category.transactions || []).findIndex(t => t.id == transactionId);
  
  if (idx !== -1) {
    const [deleted] = category.transactions.splice(idx, 1);
    lastDeletedTransaction = { categoryId, transaction: deleted };
    showUndoNotification();
  marcarCambioDatos();
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
  await persist();
    setTimeout(() => {
      window.DataEvents.emit('transactionChanged', { action: 'remove', categoryId, transactionId });
    }, 100);
  } else {
    console.error('No se encontró la transacción:', transactionId);
  }
}

/** Muestra la notificación de deshacer eliminación y programa su ocultamiento automático. */
function showUndoNotification() {
  const undoNotification = document.getElementById('undoNotification');
  if (undoNotification) undoNotification.classList.add('active');
  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => { hideUndoNotification(); lastDeletedTransaction = null; }, 6000);
}
/** Oculta la notificación de deshacer eliminación y cancela su temporizador. */
function hideUndoNotification() {
  const undoNotification = document.getElementById('undoNotification');
  if (undoNotification) undoNotification.classList.remove('active');
  if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
}

/**
 * Recalcula `datosUsuario.monthlyData` para el año proporcionado recorriendo todas las transacciones.
 * @param {number} [year=año actual]
 */
function recomputeMonthlyDataForYear(year = new Date().getFullYear()) {
  datosUsuario.monthlyData.income = Array(12).fill(0);
  datosUsuario.monthlyData.expenses = Array(12).fill(0);

  datosUsuario.categories.forEach(c => {
    (c.transactions || []).forEach(t => {
      const d = t.date instanceof Date ? t.date : (t.date ? new Date(t.date) : null);
      if (!d || isNaN(d)) return;
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      if (t.type === 'income') datosUsuario.monthlyData.income[m] = redondear2(datosUsuario.monthlyData.income[m] + t.amount);
      else if (t.type === 'expense') datosUsuario.monthlyData.expenses[m] = redondear2(datosUsuario.monthlyData.expenses[m] + t.amount);
    });
  });
}
  /** Actualiza `datosUsuario.monthlyData` para el año del filtro activo (o el año actual). */
function actualizarDatosMensuales() {

    const year = (filtrosActuales && filtrosActuales.year != null)
      ? filtrosActuales.year
      : new Date().getFullYear();
    recomputeMonthlyDataForYear(year);
  }
function calcularTotalesMes(year, month) {
  const totals = { income: 0, expenses: 0 };
  datosUsuario.categories.forEach(category => {
    (category.transactions || []).forEach(transaction => {
      const date = transaction.date instanceof Date ? transaction.date : (transaction.date ? new Date(transaction.date) : null);
      if (!date || isNaN(date)) return;
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      if (transaction.type === 'income') {
        totals.income = redondear2(totals.income + transaction.amount);
      } else if (transaction.type === 'expense') {
        totals.expenses = redondear2(totals.expenses + transaction.amount);
      }
    });
  });
  return totals;
}

const pctFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Genera el texto de variación porcentual entre el mes actual y el anterior.
 * @param {number} curr - Valor del mes actual.
 * @param {number} prev - Valor del mes anterior.
 * @returns {string}
 */
function pctChangeText(curr, prev) {
  if (prev === 0) {
    if (curr === 0) return { pct: 0, sign: '', formatted: '0.0', text: '0.0% desde el mes pasado' };
    return { pct: 100, sign: '+', formatted: '100.0', text: '+100.0% desde el mes pasado' };
  }

  const pct = ((curr - prev) / prev) * 100;
  const sign = pct > 0 ? '+' : (pct < 0 ? '-' : '');
  const formatted = pctFormatter.format(Math.abs(pct));
  return { pct, sign, formatted, text: `${sign}${formatted}% desde el mes pasado` };
}
/**
 * Actualiza las tarjetas de resumen financiero (ingresos, gastos, balance) y
 * el indicador de período en la UI.
 */
function actualizarResumenFinanciero() {
  actualizarDatosMensuales();

  const filteredCategories = aplicarFiltrosACategorias();
  let totalIncome = 0;
  let totalExpenses = 0;
  
  filteredCategories.forEach(category => {
    category.transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        totalIncome = redondear2(totalIncome + transaction.amount);
      } else if (transaction.type === 'expense') {
        totalExpenses = redondear2(totalExpenses + transaction.amount);
      }
    });
  });

  const today = new Date();
  const summaryYear = filtrosActuales.year !== null ? filtrosActuales.year : today.getFullYear();
  const summaryMonth = filtrosActuales.month !== null ? filtrosActuales.month : today.getMonth();
  const hasSearchFilter = !!(filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim());

  
  
  const balance = redondear2(totalIncome - totalExpenses);

  const currentMonthTotals = calcularTotalesMes(summaryYear, summaryMonth);
  const currentMonthBalance = redondear2(currentMonthTotals.income - currentMonthTotals.expenses);

  const previousDate = new Date(summaryYear, summaryMonth - 1, 1);
  const previousTotals = calcularTotalesMes(previousDate.getFullYear(), previousDate.getMonth());
  const prevIncome = previousTotals.income;
  const prevExpenses = previousTotals.expenses;
  const prevBalance = prevIncome - prevExpenses;

  const incomeValue = document.querySelector('.summary-card.income .card-value');
  const expensesValue = document.querySelector('.summary-card.expenses .card-value');
  const balanceValue = document.querySelector('.summary-card.balance .card-value');
  const incomeChange = document.querySelector('.summary-card.income .card-change');
  const expensesChange = document.querySelector('.summary-card.expenses .card-change');
  const balanceChange = document.querySelector('.summary-card.balance .card-change');

  if (incomeValue) incomeValue.textContent = formatCurrency(totalIncome);
  if (expensesValue) expensesValue.textContent = formatCurrency(totalExpenses);
  if (balanceValue) balanceValue.textContent = formatCurrency(balance);

  // Ingresos: texto claro
  const pctIncome = pctChangeText(currentMonthTotals.income, prevIncome);
  if (incomeChange) {
    
    if (pctIncome.pct !== 0) {
      incomeChange.textContent = `${pctIncome.sign}${pctIncome.formatted}% respecto al mes pasado`;
    } else {
      incomeChange.textContent = `0% de cambio respecto al mes pasado`;
    }
  }

  // Gastos: texto claro
  const pctExpenses = pctChangeText(currentMonthTotals.expenses, prevExpenses);
  if (expensesChange) {
    
    if (pctExpenses.pct !== 0) {
      expensesChange.textContent = `${pctExpenses.sign}${pctExpenses.formatted}% respecto al mes pasado`;
    } else {
      expensesChange.textContent = `0% de cambio respecto al mes pasado`;
    }
  }

  // Balance: texto claro
  const pctBalance = pctChangeText(currentMonthBalance, prevBalance);
  if (balanceChange) {
    
    if (pctBalance.pct !== 0) {
      balanceChange.textContent = `${pctBalance.sign}${pctBalance.formatted}% respecto al mes pasado`;
    } else {
      balanceChange.textContent = `0% de cambio respecto al mes pasado`;
    }
  }

  const periodLabel = document.getElementById('filter-period-label');
  if (periodLabel) {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const hayAnio = filtrosActuales.year !== null;
    const hayMes = filtrosActuales.month !== null;
    let txt = '';
    if (hayAnio || hayMes) {
      txt = 'Mostrando: ';
      if (hayMes) txt += meses[filtrosActuales.month];
      if (hayAnio && hayMes) txt += ' ';
      if (hayAnio) txt += filtrosActuales.year;
    }
    periodLabel.textContent = txt;
    periodLabel.classList.toggle('is-visible', !!txt);
  }
}



/**
 * Calcula los KPIs diarios (ingresos/gastos de hoy y promedio neto de los últimos 30 días)
 * a partir de las transacciones filtradas.
 * @returns {{ incomeToday: number, expensesToday: number, avgDaily: number }}
 */
function calcularEstadisticasDiarias() {
  const today = new Date();
  const start30 = new Date();
  start30.setDate(today.getDate() - 29);

  let incomeToday = 0;
  let expensesToday = 0;
  let sumNetLast30 = 0;
  let daysCounted = 0;

  const netByDate = new Map();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start30);
    d.setDate(start30.getDate() + i);
    const key = d.toISOString().slice(0,10);
    netByDate.set(key, 0);
  }

  const filteredCategories = aplicarFiltrosACategorias();
  filteredCategories.forEach(cat => {
    (cat.transactions||[]).forEach(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0,10);

      if (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      ) {
        if (t.type === 'income') incomeToday = redondear2(incomeToday + t.amount);
        else if (t.type === 'expense') expensesToday = redondear2(expensesToday + t.amount);
      }

      if (d >= start30 && d <= today) {
        const delta = (t.type === 'income') ? t.amount : -t.amount;
        netByDate.set(key, redondear2((netByDate.get(key) || 0) + delta));
      }
    });
  });

  netByDate.forEach(v => { sumNetLast30 = redondear2(sumNetLast30 + v); daysCounted++; });
  const avgDaily = daysCounted > 0 ? redondear2(sumNetLast30 / daysCounted) : 0;

  return { incomeToday, expensesToday, avgDaily };
}

/** Obtiene los KPIs diarios y los escribe en los elementos del DOM correspondientes. */
function actualizarUIEstadisticasDiarias() {

  const incomeEl = document.getElementById('dailyIncome');
  const expenseEl = document.getElementById('dailyExpenses');
  const avgEl = document.getElementById('dailyAverage');
  if (!incomeEl || !expenseEl || !avgEl) return;
  const { incomeToday, expensesToday, avgDaily } = calcularEstadisticasDiarias();
  incomeEl.textContent = formatCurrency(incomeToday);
  expenseEl.textContent = formatCurrency(expensesToday);
  avgEl.textContent = formatCurrency(avgDaily);
}

/** Marcador de posición reservado para renderizar gráficos. Se invoca explícitamente
 * desde múltiples puntos del flujo de actualización; la implementación real reside
 * en la página de Estadísticas que comparte el contexto de datos. */
function renderizarGraficos() {}

/** Carga el tablero realizando el renderizado inicial de categorías, gráficos y KPIs diarios. */
function cargarTablero() {
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
}

/** Vuelve a renderizar el tablero completo al cambiar los filtros activos. */
function aplicarFiltros() {
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
}

const aplicarFiltrosAntirrebote = antirrebote(aplicarFiltros, 200);

/** Configura los dropdowns de año y mes con sus listeners de selección y accesibilidad ARIA. */
function configurarListenersFiltros() {
  const yearFilter = document.getElementById('yearFilter');
  const monthFilter = document.getElementById('monthFilter');

  // Establecer filtro de mes por defecto a "Todos los meses"
  if (monthFilter) {
    const monthSelected = monthFilter.querySelector('.custom-dropdown-selected');
    if (monthSelected) {
      monthSelected.querySelector('span').textContent = 'Todos los meses';
      monthSelected.setAttribute('data-value', '');
    }
    const monthOptions = monthFilter.querySelectorAll('.custom-dropdown-option');
    monthOptions.forEach(opt => opt.classList.remove('selected'));
  }

  const manejarSeleccionOpcion = (tipoFiltro, value, text) => {
    if (tipoFiltro === 'year') {
      filtrosActuales.year = value === '' ? null : parseInt(value);
    } else if (tipoFiltro === 'month') {
      filtrosActuales.month = value === '' ? null : parseInt(value);
    }
    aplicarFiltrosAntirrebote();
  };

  const configurarDropdown = (dropdownEl, tipoFiltro) => {
    const selected = dropdownEl.querySelector('.custom-dropdown-selected');
    const options = dropdownEl.querySelectorAll('.custom-dropdown-option');

    dropdownEl.setAttribute('role', 'listbox');
    selected.setAttribute('role', 'button');
    selected.setAttribute('aria-haspopup', 'listbox');
    selected.setAttribute('aria-expanded', 'false');
    options.forEach((opt, idx) => {
      opt.setAttribute('role', 'option');
      if (idx === 0 && opt.classList.contains('selected')) {
        opt.setAttribute('aria-selected', 'true');
      } else {
        opt.setAttribute('aria-selected', opt.classList.contains('selected') ? 'true' : 'false');
      }
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
        
        options.forEach(opt => { 
          opt.classList.remove('selected');
          opt.setAttribute('aria-selected', 'false');
        });
        option.classList.add('selected');
        option.setAttribute('aria-selected', 'true');

        manejarSeleccionOpcion(tipoFiltro, value, text);
        dropdownEl.classList.remove('open');
        selected.setAttribute('aria-expanded', 'false');
      });
    });
  };

  if (yearFilter) configurarDropdown(yearFilter, 'year');
  if (monthFilter) configurarDropdown(monthFilter, 'month');

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown.open').forEach(d => {
      d.classList.remove('open');
      const sel = d.querySelector('.custom-dropdown-selected');
      if (sel) sel.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Enlaza todos los listeners de UI globales: modales, formularios, importación/exportación,
 * tema, perfil de usuario, selector de fecha y atajos de teclado.
 */
function configurarListenersEventos() {

  const categoriesContainer = document.getElementById('categoriesContainer');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const logoutButton = document.getElementById('logoutButton');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  
  const categoryModal = document.getElementById('categoryModal');
  const editCategoryModal = document.getElementById('editCategoryModal');
  const deleteCategoryModal = document.getElementById('deleteCategoryModal');
  const editTransactionModal = document.getElementById('editTransactionModal');
  const clearTransactionsModal = document.getElementById('clearTransactionsModal');
  const clearAllModal = document.getElementById('clearAllModal');
  
  const saveCategoryBtn = document.getElementById('saveCategory');
  const cancelCategoryBtn = document.getElementById('cancelCategory');
  const saveEditCategoryBtn = document.getElementById('saveEditCategory');
  const cancelEditCategoryBtn = document.getElementById('cancelEditCategory');
  const confirmDeleteCategoryBtn = document.getElementById('confirmDeleteCategory');
  const cancelDeleteCategoryBtn = document.getElementById('cancelDeleteCategory');
  const saveEditTransactionBtn = document.getElementById('saveEditTransaction');
  const cancelEditTransactionBtn = document.getElementById('cancelEditTransaction');
  const confirmClearTransactionsBtn = document.getElementById('confirmClearTransactions');
  const cancelClearTransactionsBtn = document.getElementById('cancelClearTransactions');
  const confirmClearAllBtn = document.getElementById('confirmClearAll');
  const cancelClearAllBtn = document.getElementById('cancelClearAll');
  
  const exportDropdownBtn = document.getElementById('exportDropdownBtn');
  const exportDropdown = document.getElementById('exportDropdown');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const importBtn = document.getElementById('importStateBtn');
  const clearAllBtn = document.getElementById('clearAllCategoriesBtn');
  const importFileInput = document.getElementById('importFileInput');
  
  const categoryNameInput = document.getElementById('categoryName');
  const categoryFixedTypeInput = document.getElementById('categoryFixedType');
  const editCategoryNameInput = document.getElementById('editCategoryName');
  const editCategoryIdInput = document.getElementById('editCategoryId');
  const deleteCategoryNameSpan = document.getElementById('deleteCategoryName');
  const deleteCategoryIdInput = document.getElementById('deleteCategoryId');
  const clearTransCategoryNameSpan = document.getElementById('clearTransCategoryName');
  const clearTransCategoryIdInput = document.getElementById('clearTransCategoryId');
  
  const undoNotification = document.getElementById('undoNotification');
  const undoDeleteBtn = document.getElementById('undoDelete');
  const editAmountInput = document.getElementById('editTransactionAmount');
  const amountWarning = document.getElementById('amountWarning');

  const yearFilter = document.getElementById('yearFilter');
  const monthFilter = document.getElementById('monthFilter');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  (function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const root = document.documentElement;
    const body = document.body;
    
    const apply = (t) => {
      const theme = t === 'light' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      if (body) body.setAttribute('data-theme', theme);
      root.style.backgroundColor = theme === 'light' ? '#f5efea' : '#191724';
      if (body) body.style.backgroundColor = theme === 'light' ? '#f5efea' : '#191724';

      localStorage.setItem('theme', theme);
      try {
        const rawSettings = localStorage.getItem('finanzapp:settings:v1');
        const settings = rawSettings ? JSON.parse(rawSettings) : {};
        settings.theme = theme;
        localStorage.setItem('finanzapp:settings:v1', JSON.stringify(settings));
      } catch (e) {}

      const icon = btn?.querySelector('i');
      if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

      try { renderizarGraficos(); } catch {}
    };
    
    let stored = localStorage.getItem('theme');
    if (!stored) {
      try {
        const s = localStorage.getItem('finanzapp:settings:v1');
        if (s) {
          const p = JSON.parse(s);
          if (p && p.theme) stored = p.theme;
        }
      } catch (e) {}
    }
    apply(stored === 'light' ? 'light' : 'dark');
    
    if (btn) {
      btn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
        apply(current === 'light' ? 'dark' : 'light');
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'theme' && e.newValue) {
        apply(e.newValue);
      }
    });
  })();

  (function populateUserProfile() {
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
          img.src = profile.picture;
          img.alt = profile.name || 'Usuario';
          avatarEl.appendChild(img);
        } else {
          const initial = (profile.name || 'U').trim().charAt(0).toUpperCase();
          avatarEl.textContent = initial || 'U';
        }
      }
    } catch {}
  })();
  
  (function initProfileTooltip() {
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
  })();
  
  
  const modalCloseButtons = document.querySelectorAll('.modal-close');

  superposicionAlerta = document.getElementById('alertOverlay');
  alertaPersonalizada = document.getElementById('customAlert');
  tituloAlerta = document.getElementById('alertTitle');
  mensajeAlerta = document.getElementById('alertMessage');
  botonesAlerta = document.getElementById('alertButtons');
  confirmarAlerta = document.getElementById('alertConfirm');
  raizApp = document.querySelector('.app-container');

  if (logoutButton) {
    logoutButton.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      const confirmed = await (typeof window.showAlert === 'function'
        ? window.showAlert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', { variant: 'confirm', emphasis: 'danger' })
        : Promise.resolve(window.confirm('¿Estás seguro de que deseas cerrar sesión?') ? 'confirm' : 'cancel'));

      if (confirmed !== 'confirm') return;

      try {
        sessionStorage.setItem('finanzapp:logged_out', '1');
        localStorage.setItem('logoutTimestamp', Date.now().toString());

        if (window.firebaseAuth && typeof window.firebaseAuth.logout === 'function') {
          await window.firebaseAuth.logout();
        } else if (window.firebase && typeof window.firebase.auth === 'function') {
          try {
            await window.firebase.auth().signOut();
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error en logout:', err);
      } finally {
        sessionStorage.setItem('finanzapp:logged_out', '1');
        localStorage.setItem('logoutTimestamp', Date.now().toString());
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('authUser');
        window.location.replace('../Login/Login.html?logout=true');
      }
    });
  }

  const categoryTypeSelector = document.getElementById('categoryFixedType');
  if (categoryTypeSelector) {
    const buttons = categoryTypeSelector.querySelectorAll('.category-type-btn');
    buttons.forEach(button => {
      button.addEventListener('click', () => {

        buttons.forEach(btn => btn.classList.remove('active'));

        button.classList.add('active');
      });
    });
  }

  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      if (categoryNameInput) categoryNameInput.value = '';

      const categoryTypeSelector = document.getElementById('categoryFixedType');
      if (categoryTypeSelector) {
        const buttons = categoryTypeSelector.querySelectorAll('.category-type-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

      }
      if (categoryModal) {
        abrirModal(categoryModal, addCategoryBtn);
      } else {
        console.error('categoryModal no encontrado');
      }
    });
  } else {
    console.error('addCategoryBtn no encontrado en el DOM');
  }

  modalCloseButtons.forEach(btn => btn.addEventListener('click', () => {
    const m = btn.closest('.modal');
    if (m) cerrarModal(m);
  }));

  document.addEventListener('click', limpiarBloqueoScroll);
  document.addEventListener('keyup', limpiarBloqueoScroll);
  window.addEventListener('focus', limpiarBloqueoScroll);
  
  [deleteCategoryModal, editTransactionModal, clearTransactionsModal, clearAllModal]
    .filter(Boolean)
    .forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal && window.innerWidth <= 980) cerrarModal(modal); });
    });
  
  if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', () => categoryModal && cerrarModal(categoryModal));
  if (cancelEditCategoryBtn) cancelEditCategoryBtn.addEventListener('click', () => editCategoryModal && cerrarModal(editCategoryModal));
  if (cancelDeleteCategoryBtn) cancelDeleteCategoryBtn.addEventListener('click', () => deleteCategoryModal && cerrarModal(deleteCategoryModal));
  if (cancelEditTransactionBtn) cancelEditTransactionBtn.addEventListener('click', () => editTransactionModal && cerrarModal(editTransactionModal));
  if (cancelClearTransactionsBtn) cancelClearTransactionsBtn.addEventListener('click', () => clearTransactionsModal && cerrarModal(clearTransactionsModal));
  if (cancelClearAllBtn) cancelClearAllBtn.addEventListener('click', () => clearAllModal && cerrarModal(clearAllModal));

  if (exportDropdownBtn) {
    exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('active');
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-dropdown')) {
      if (exportDropdown) exportDropdown.classList.remove('active');
    }
  });

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      exportarAJSON();
      if (exportDropdown) exportDropdown.classList.remove('active');
    });
  }


  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportarAPDF();
      if (exportDropdown) exportDropdown.classList.remove('active');
    });
  } else {
    console.error('No se encontró el botón exportPdfBtn');
  }

  if (importBtn) importBtn.addEventListener('click', () => importFileInput && importFileInput.click());
  if (importFileInput) importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || (json.version !== undefined && json.version !== 1)) throw new Error('Versión incompatible');
      if (!Array.isArray(json.categories)) throw new Error('Formato inválido');

      json.categories.forEach(c => {
        c.transactions = (c.transactions || []).map(t => ({
          ...t,
          date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
        }));
        if (typeof c.isPinned !== 'boolean') c.isPinned = false;
      });

      datosUsuario.categories = json.categories;
      if (json.user) datosUsuario.user = json.user;

      
      marcarCambioDatos();
      await persist();

      const renderAndNotify = async () => {
        renderizarCategorias();
        renderizarGraficos();
        actualizarUIEstadisticasDiarias();
        

        setTimeout(() => {
          setTimeout(() => {
            window.DataEvents.emit('dataImported', { 
              categoriesCount: datosUsuario.categories.length,
              timestamp: Date.now()
            });
          }, 100);
        }, 500);
        
        mostrarExito('Datos importados correctamente.');
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAndNotify);
      } else {

        await renderAndNotify();
      }
    } catch (error) {
      console.error('Error al importar archivo:', error);
      let errorMessage = 'No se pudo importar el archivo. ';
      
      if (error.message.includes('Unexpected token')) {
        errorMessage += 'El archivo no tiene un formato JSON válido.';
      } else if (error.message.includes('Versión incompatible')) {
        errorMessage += 'La versión del archivo no es compatible.';
      } else if (error.message.includes('Formato inválido')) {
        errorMessage += 'El formato del archivo no es correcto. Debe contener un array de categorías.';
      } else {
        errorMessage += 'Verifica que el archivo sea un JSON válido exportado desde esta aplicación.';
      }
      
  mostrarError(errorMessage);
    } finally {
      importFileInput.value = '';
    }
  });

  const ejecutarEliminarTodasCategorias = async () => {
    datosUsuario.categories = [];
    localStorage.removeItem('categories');
    localStorage.removeItem('transactions');
    marcarCambioDatos();
    await persist();
    
    renderizarCategorias();
    renderizarGraficos();
    actualizarUIEstadisticasDiarias();
    
    setTimeout(() => {
      window.DataEvents.emit('categoryChanged', { action: 'clearAll', categoriesCount: 0 });
    }, 100);
    
    if (clearAllModal) cerrarModal(clearAllModal);
    mostrarExito('Se eliminaron todas las categorías y sus transacciones.');
  };

  if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
    if (window.__appConfirmDelete === false) {
      ejecutarEliminarTodasCategorias();
      return;
    }
    if (esVistaEscritorio()) {
      mostrarBottomDrawer({
        mensajeHtml: '¿Quieres eliminar todas las categorías y sus transacciones?<br>Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        onConfirm: ejecutarEliminarTodasCategorias
      });
      return;
    }
    if (clearAllModal) abrirModal(clearAllModal, clearAllBtn);
  });

  if (confirmClearAllBtn) confirmClearAllBtn.addEventListener('click', ejecutarEliminarTodasCategorias);

  if (undoDeleteBtn) undoDeleteBtn.addEventListener('click', async () => {
    if (!lastDeletedTransaction) return;
    const { categoryId, transaction } = lastDeletedTransaction;
    const cat = datosUsuario.categories.find(c => c.id === categoryId);
    if (cat) {
      cat.transactions.push(transaction);
      marcarCambioDatos();
      renderizarCategorias();
      renderizarGraficos();
      actualizarUIEstadisticasDiarias();
      await persist();
      setTimeout(() => {
        window.DataEvents.emit('transactionChanged', { action: 'undo', categoryId, transactionId: transaction.id });
      }, 50);
    }
    lastDeletedTransaction = null;
    hideUndoNotification();
  });

  if (editAmountInput) {
    editAmountInput.addEventListener('input', function(){
      const caret = this.selectionStart;
      const before = this.value;
      const formatted = formatInputAmountEs(before);
      this.value = formatted;
      const diff = this.value.length - before.length;
      try { this.setSelectionRange(caret + diff, caret + diff); } catch {}
      amountWarning.style.display = 'none';
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener('click', async () => {

      const categoryName = categoryNameInput ? categoryNameInput.value.replace(/\s+/g,' ').trim() : '';
      const categoryTypeSelector = document.getElementById('categoryFixedType');
      const activeButton = categoryTypeSelector ? categoryTypeSelector.querySelector('.category-type-btn.active') : null;
      const fixedType = activeButton ? activeButton.getAttribute('data-value') || '' : '';
      const selectedText = activeButton ? activeButton.querySelector('span').textContent : 'Ninguno';
      
      if (!categoryName) { 
        mostrarAlerta('Advertencia', 'Por favor, ingresa un nombre para la categoría.', { variant: 'warning' }); 
        return; 
      }
      
      if (selectedText === 'Seleccionar tipo') {
        mostrarAlerta('Advertencia', 'Por favor, selecciona un tipo de categoría (Libre, Ingreso o Gasto).', { variant: 'warning' });
        return;
      }

      if (datosUsuario.categories.length >= MAX_CATEGORIES) {
        mostrarAlerta('Límite alcanzado', `No se pueden agregar más de ${MAX_CATEGORIES} categorías. Elimina alguna categoría existente para agregar una nueva.`, { variant: 'warning' });
        return;
      }
      
      const typeKey = (fixedType || '');
      const exists = datosUsuario.categories.some(c =>
        ((c.fixedType || '') === typeKey) && (String(c.name || '').trim().toLowerCase() === categoryName.toLowerCase())
      );
      if (exists) { mostrarAdvertencia('Ya existe una categoría de ese tipo con ese nombre.'); return; }
  const newCategory = { id: generarIdCategoria(), name: categoryName, transactions: [], isPinned: false };
      if (fixedType === 'income' || fixedType === 'expense') newCategory.fixedType = fixedType;
      
      datosUsuario.categories.push(newCategory);
        renderizarCategorias();
        renderizarGraficos();
        actualizarUIEstadisticasDiarias();
  marcarCambioDatos();
  await persist();

      setTimeout(() => {
        window.DataEvents.emit('categoryChanged', { action: 'add', categoryId: newCategory.id });
      }, 100);
      
      if (categoryModal) cerrarModal(categoryModal);
    });
  }

  saveEditCategoryBtn.addEventListener('click', async () => {
    const categoryId = editCategoryIdInput.value;
    const newName = editCategoryNameInput.value.replace(/\s+/g,' ').trim();
    if (!newName) { mostrarAlerta('Advertencia', 'Por favor, ingresa un nombre válido para la categoría.'); return; }
    const category = buscarCategoria(categoryId);
    if (category) {
      const typeKey = (category.fixedType || '');
      const dup = datosUsuario.categories.some(c => normalizarId(c.id) !== normalizarId(categoryId) && (c.fixedType || '') === typeKey && (String(c.name || '').trim().toLowerCase() === newName.toLowerCase()));
      if (dup) { mostrarAdvertencia('Ya existe una categoría de ese tipo con ese nombre.'); return; }
      category.name = newName;
      cerrarModal(editCategoryModal);
      mostrarExito(`Categoría renombrada a "${newName}"`);
      renderizarCategorias();
      renderizarGraficos();
      actualizarUIEstadisticasDiarias();
      await persist();

      setTimeout(() => {
        window.DataEvents.emit('categoryChanged', { action: 'edit', categoryId });
      }, 100);
    }
  });

  saveEditTransactionBtn.addEventListener('click', async () => {
    const transactionIdRaw = document.getElementById('editTransactionId').value;
    const categoryIdRaw = document.getElementById('editTransactionCategoryId').value;

    const transactionId = isNaN(parseInt(transactionIdRaw)) ? transactionIdRaw : parseInt(transactionIdRaw);
    const categoryId = isNaN(parseInt(categoryIdRaw)) ? categoryIdRaw : parseInt(categoryIdRaw);
  const typeSelect = document.getElementById('editTransactionType');
  const amountInputEl = document.getElementById('editTransactionAmount');
  const descInputEl = document.getElementById('editTransactionDesc');
  const dateInputEl = document.getElementById('editTransactionDate');

  const amountStr = amountInputEl.value.trim();
  const dateStr = dateInputEl.value.trim();

  if (!dateStr) {
    mostrarAlerta('Advertencia', 'Por favor, selecciona una fecha.');
    return;
  }

  const dateParts = dateStr.split('/');
  if (dateParts.length !== 3) {
    mostrarAlerta('Advertencia', 'Formato de fecha inválido');
    return;
  }

  const day = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const year = parseInt(dateParts[2]);
  
  const inputDate = new Date(year, month, day);
  
  const dateValidation = validateDate(inputDate);
  if (!dateValidation.isValid) {
    mostrarAlerta('Advertencia', dateValidation.error);
    return;
  }

    const normalizedRaw = parseEsAmountToNormalized(amountStr);
    if (!normalizedRaw) {
      amountWarning.textContent = 'Monto inválido';
      amountWarning.style.display = 'block';
      amountInputEl.focus();
      return;
    }
    const [intPartRaw, decPartRaw = ''] = normalizedRaw.split('.');
    if (intPartRaw.length > 8) {
      amountWarning.textContent = MSG_MAX_DIGITS;
      amountWarning.style.display = 'block';
      amountInputEl.focus();
      return;
    }
    const decFixed = decPartRaw.slice(0,2);
    const finalNumber = Number(intPartRaw + (decFixed ? '.' + decFixed : ''));
    if (!finalNumber || finalNumber <= 0) {
      amountWarning.textContent = 'Monto inválido';
      amountWarning.style.display = 'block';
      amountInputEl.focus();
      return;
    }
    const amount = redondear2(finalNumber);

    const category = buscarCategoria(categoryId);
    if (!category) return;
    const transaction = (category.transactions || []).find(t => t.id == transactionId);
    if (!transaction) return;

    let transactionType = category.fixedType;
    if (!transactionType && typeSelect) {
      const activeButton = typeSelect.querySelector('.transaction-type-btn.active');
      transactionType = activeButton ? activeButton.getAttribute('data-value') : '';
    }
    transaction.type = transactionType;
    transaction.amount = amount;
    transaction.description = descInputEl.value.trim();
    transaction.date = dateValidation.date;

    if (editTransactionModal) cerrarModal(editTransactionModal);
    marcarCambioDatos();
    renderizarCategorias();
    renderizarGraficos();
    actualizarUIEstadisticasDiarias();
    await persist();
    setTimeout(() => { window.DataEvents.emit('transactionChanged', { action: 'edit', categoryId, transactionId }); }, 100);
    mostrarExito('Transacción actualizada correctamente.');
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      const hadActiveFilters = filtrosActuales.year !== null || filtrosActuales.month !== null || !!(filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim());

      filtrosActuales.year = null;
      filtrosActuales.month = null;
      filtrosActuales.searchTerm = '';

      const yearDropdown = document.getElementById('yearFilter');
      if (yearDropdown) {
        const selected = yearDropdown.querySelector('.custom-dropdown-selected');
        const optionItems = yearDropdown.querySelectorAll('.custom-dropdown-option');
        selected.querySelector('span').textContent = 'Todos los años';
        selected.setAttribute('data-value', '');
        optionItems.forEach(opt => opt.classList.remove('selected'));
      }

      const monthDropdown = document.getElementById('monthFilter');
      if (monthDropdown) {
        const monthSelected = monthDropdown.querySelector('.custom-dropdown-selected');
        if (monthSelected) {
          monthSelected.querySelector('span').textContent = 'Todos los meses';
          monthSelected.setAttribute('data-value', '');
        }
        const monthOptions = monthDropdown.querySelectorAll('.custom-dropdown-option');
        monthOptions.forEach(opt => opt.classList.remove('selected'));
      }

      if (searchInput) searchInput.value = '';
      aplicarFiltrosAntirrebote();

      if (hadActiveFilters) {
        mostrarExito('Filtros limpiados');
      } else {
        mostrarInfo('No hay filtros activos');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filtrosActuales.searchTerm = e.target.value;
      aplicarFiltrosAntirrebote();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      filtrosActuales.searchTerm = '';
      if (searchInput) searchInput.value = '';
      aplicarFiltrosAntirrebote();
    });
  }

  const datePickerModal = document.getElementById('datePickerModal');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('todayBtn');
  const selectDateBtn = document.getElementById('selectDateBtn');
  const cancelDateBtn = document.getElementById('cancelDateBtn');

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => navegarMes(-1));
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => navegarMes(1));
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', establecerHoy);
  }

  if (selectDateBtn) {
    selectDateBtn.addEventListener('click', confirmarSeleccionFecha);
  }

  if (cancelDateBtn) {
    cancelDateBtn.addEventListener('click', () => {
      if (datePickerModal) {
        cerrarModal(datePickerModal);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && datePickerModal && datePickerModal.classList.contains('active')) {
      cerrarModal(datePickerModal);
    }
  });

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

}

/**
 * @fileoverview Controlador principal del Dashboard.
 *
 * `CategoriasApp` extiende `BasePage` para heredar la verificación de autenticación
 * y la suscripción a eventos cross-tab. El bootstrapping completo de Firebase,
 * Firestore, datos y UI se realiza en `onDataLoaded()` y `bindEvents()`.
 */
class CategoriasApp extends BasePage {
  /**
   * Inicializa Firebase, carga los datos del usuario y monta la UI del Dashboard.
   * Se llama automáticamente tras `DOMContentLoaded` desde `BasePage`.
   * @override
   * @returns {Promise<void>}
   */
  async onDataLoaded() {
    // No se usa data de BasePage — el Dashboard gestiona datosUsuario directamente
    // a través de `boot()` para mantener compatibilidad con las funciones de módulo.
  }

  /**
   * Inicializa Firebase + Firestore y arranca todos los subsistemas del Dashboard.
   * Sobreescribe `_init` de `BasePage` para controlar el orden de operaciones.
   * @override
   * @protected
   */
  async _init() {
    // 1. Renderizado instantáneo (0ms) con categorías predeterminadas o datos locales
    generarOpcionesAnio();
    configurarListenersEventos();
    configurarListenersFiltros();
    initCustomTransactionTooltip();
    this._bindCrossTabEvents();
    initGmailTransactionListener();
    cargarTablero();

    // 2. Inicialización y sincronización en segundo plano con Firebase / Firestore
    try {
      if (!window.firebase) {
        console.error('❌ Firebase SDK no cargado');
        throw new Error('Firebase SDK no disponible');
      }

      if (window.FirestoreDB) {
        window.FirestoreDB.ensureFirebaseInitialized();
      } else if (!firebase.apps.length) {
        const config = window.FIREBASE_CONFIG;
        if (config) firebase.initializeApp(config);
      }
    } catch (error) {
      console.error('❌ Error inicializando Firebase:', error);
    }

    await new Promise((resolve) => {
      try {
        const auth = firebase.auth();
        let resolved = false;
        let nullCount = 0;
        const fallbackTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 8000);

        auth.onAuthStateChanged(async (currentUser) => {
          if (currentUser) {
            if (resolved) return; // already resolved by timer, ignore late emission
            clearTimeout(fallbackTimer);
            resolved = true;

            const profile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
              picture: currentUser.photoURL || currentUser.providerData?.[0]?.photoURL || '',
              provider: currentUser.providerData?.[0]?.providerId || 'google',
              emailVerified: currentUser.emailVerified
            };
            localStorage.setItem('authUser', JSON.stringify(profile));

            // Actualizar el avatar inmediatamente con la foto real de Google.
            try {
              const avatarEl = document.querySelector('.user-avatar');
              if (avatarEl) {
                avatarEl.innerHTML = '';
                if (profile.picture) {
                  const img = document.createElement('img');
                  img.src = profile.picture;
                  img.alt = profile.name || 'Usuario';
                  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
                  avatarEl.appendChild(img);
                } else {
                  avatarEl.textContent = (profile.name || 'U').charAt(0).toUpperCase();
                }
              }
              const nameEl = document.querySelector('.user-name');
              if (nameEl) nameEl.textContent = profile.name || 'Usuario';
            } catch {}

            if (window.FirestoreDB) {
              await window.FirestoreDB.init(currentUser.uid);
              window.FirestoreDB.setCurrentUser(currentUser.uid);
            }
            resolve();
          } else {
            nullCount++;
          }
        });
      } catch (error) {
        resolve();
      }
    });

    await boot();
    cargarTablero();
  }

  /**
   * Suscribe al evento cross-tab `datos:actualizados` para recargar y re-renderizar
   * el tablero cuando otra pestaña modifica los datos.
   * @override
   * @protected
   */
  _bindCrossTabEvents() {
    if (!window.DataEvents) return;
    window.DataEvents.on('datos:actualizados', async () => {
      await boot();
      marcarCambioDatos();
      cargarTablero();
    });
  }
}

/** Instancia global del controlador del Dashboard. */
const _categoriasApp = new CategoriasApp();

window.alternarMenuCategoria = alternarMenuCategoria;
window.alternarFijado = alternarFijado;
window.mostrarModalEditarCategoria = mostrarModalEditarCategoria;
window.mostrarModalEliminarCategoria = mostrarModalEliminarCategoria;
window.limpiarTransaccionesCategoria = limpiarTransaccionesCategoria;
window.agregarTransaccion = agregarTransaccion;

/**
 * Administrador de Notificaciones Bancarias para el icono de la Campanita (🔔).
 * Mantiene la lista de notificaciones pendientes de Gmail y su insignia de conteo.
 */
class GmailNotificationManager {
  constructor() {
    this.notifications = this._loadNotifications();
    this.init();
  }

  _getStorageKey() {
    const uid = window.firebase?.auth?.()?.currentUser?.uid;
    return uid ? `finanzapp:gmail:pending_notifications:${uid}` : 'finanzapp:gmail:pending_notifications';
  }

  _isRealTransactionNotif(notif) {
    if (!notif || !notif.amount) return false;
    if (notif.source === 'imap' || notif.amount > 0) return true;
    const text = `${notif.description || ''} ${notif.subject || ''}`;
    const spamRegex = /(estado de cuenta|extracto|resumen de cuenta|resumen de saldo|balance de cuenta|balance mensual|informe de cuenta|estado de tarjeta|resumen mensual|alerta de inicio de sesi[oó]n|intento de acceso|cambio de contrase[nñ]a|empleo|vacante|postula|bolet[ií]n|newsletter|publicidad|descuento|ofert|promoci[oó]n|suscr[ií]bete|unsubscribe|darse de baja|ver en navegador|tienes hamb|lugares nuevos|soluciones|ahorro\s*🎨|bolsa de trabajo|linkedIn|glassdoor|indeed|career|hiring|trabajo|pide tu s[uú]per|como pides tu comida|c[oó]digo de verificaci[oó]n|verificar tu correo|clave temporal|otp|security code)/i;
    if (spamRegex.test(text)) return false;
    return true;
  }

  _sortList(list) {
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : (a.timestamp || 0);
      const timeB = b.date ? new Date(b.date).getTime() : (b.timestamp || 0);
      const valA = isNaN(timeA) ? 0 : timeA;
      const valB = isNaN(timeB) ? 0 : timeB;
      return valB - valA;
    });
  }

  _loadNotifications() {
    try {
      const user = window.firebase?.auth?.()?.currentUser;
      if (!user) return [];
      const key = this._getStorageKey();
      const raw = localStorage.getItem(key);
      const items = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
      const filtered = items.filter(item => this._isRealTransactionNotif(item));
      return this._sortList(filtered);
    } catch {
      return [];
    }
  }

  _saveNotifications() {
    this.notifications = this._sortList(this.notifications);
    const key = this._getStorageKey();
    localStorage.setItem(key, JSON.stringify(this.notifications));
    this.updateBadges();
    this.renderList();
    if (typeof window.renderMobileNotificationsMenu === 'function') {
      window.renderMobileNotificationsMenu();
    }
  }

  addNotification(txn) {
    if (!txn || !txn.amount || !this._isRealTransactionNotif(txn)) return;

    const notif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      amount: txn.amount,
      description: txn.description || 'Comercio no especificado',
      subject: txn.subject || '',
      date: txn.date || new Date().toISOString(),
      type: txn.type || 'expense',
      timestamp: Date.now()
    };

    const exists = this.notifications.some(n => 
      n.amount === notif.amount && n.description === notif.description && n.date === notif.date
    );
    if (!exists) {
      this.notifications.push(notif);
      this.notifications = this._sortList(this.notifications);
      this._saveNotifications();
    }
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this._saveNotifications();
  }

  async clearAll() {
    if (this.notifications.length === 0) return;
    
    const result = await (typeof window.showAlert === 'function'
      ? window.showAlert('Limpiar Notificaciones', '¿Estás seguro de que deseas eliminar todas las notificaciones?', { variant: 'confirm', emphasis: 'danger' })
      : Promise.resolve(confirm('¿Estás seguro de que deseas eliminar todas las notificaciones?')));
      
    if (result !== 'confirm' && result !== true) return;
    
    this.notifications = [];
    this._saveNotifications();
  }

  updateBadges() {
    const count = this.notifications.length;
    const badge = document.getElementById('gmailBadge');
    const mobileBadge = document.getElementById('mobileGmailBadge');

    [badge, mobileBadge].forEach(b => {
      if (!b) return;
      b.textContent = count;
      if (count > 0) {
        b.classList.remove('hidden');
        b.style.display = 'inline-flex';
        b.style.alignItems = 'center';
        b.style.justifyContent = 'center';
      } else {
        b.classList.add('hidden');
        b.style.display = 'none';
      }
    });
  }

  renderList() {
    const listEl = document.getElementById('gmailNotifList');
    const footerEl = document.getElementById('gmailNotifFooter');
    if (!listEl) return;

    try {
      this.notifications = this._sortList(this.notifications);

      if (!this.notifications.length) {
        listEl.innerHTML = '<p class="gmail-notif-empty" style="text-align:center; color:#888; padding:20px 10px;">Sin notificaciones bancarias pendientes.</p>';
        if (footerEl) footerEl.style.display = 'none';
        return;
      }

      if (footerEl) footerEl.style.display = 'flex';

      listEl.innerHTML = this.notifications.map(n => {
        const numAmount = Number(n.amount) || 0;
        let formattedAmount;
        try {
          if (window.Core?.helpers?.formatCurrency) {
            formattedAmount = window.Core.helpers.formatCurrency(numAmount);
          } else {
            const raw = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
            if (raw?.censorAmounts === 'on') {
              formattedAmount = '$ ••••';
            } else {
              formattedAmount = `$${numAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        } catch {
          formattedAmount = `$${numAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        let formattedDate = '';
        try {
          if (n.date) {
            const rawDate = (n.date && typeof n.date.toDate === 'function') ? n.date.toDate() : n.date;
            formattedDate = typeof formatDate === 'function' ? formatDate(rawDate) : new Date(rawDate).toLocaleDateString();
          }
        } catch (_) {}

        const subjectText = (n.subject && n.subject !== n.description) ? n.subject : (n.description || 'Notificación bancaria');
        return `
          <div class="gmail-notif-item" data-id="${n.id}">
            <div class="gmail-notif-item-top">
              <span class="gmail-notif-merchant">${n.description || 'Comercio'}</span>
              <span class="gmail-notif-amount">${formattedAmount}</span>
            </div>
            <div class="gmail-notif-item-bottom">
              <span class="gmail-notif-detail">${subjectText}</span>
              ${formattedDate ? `<span class="gmail-notif-date"><i class="far fa-calendar-alt"></i>${formattedDate}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.gmail-notif-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          const notif = this.notifications.find(n => n.id === id);
          if (notif) {
            this.togglePanel(false);
            abrirModalRevisarGmail(notif, id);
          }
        });
      });
    } catch (err) {
      console.error('Error rendering notification list:', err);
    }
  }

  positionPanel() {
    const panel = document.getElementById('gmailNotifPanel');
    const bellBtn = document.getElementById('gmailBellBtn');
    if (!panel) return;

    panel.style.zIndex = '999999';

    if (!bellBtn || bellBtn.offsetParent === null) {
      panel.style.top = '70px';
      panel.style.right = '16px';
      panel.style.left = 'auto';
      return;
    }

    const rect = bellBtn.getBoundingClientRect();
    const panelWidth = Math.min(360, window.innerWidth - 32);
    const top = Math.max(10, Math.round(rect.bottom + 8));
    let right = Math.round(window.innerWidth - rect.right);

    if (right < 16) right = 16;
    if (window.innerWidth - right - panelWidth < 16) {
      right = Math.max(16, window.innerWidth - panelWidth - 16);
    }

    panel.style.top = `${top}px`;
    panel.style.right = `${right}px`;
    panel.style.left = 'auto';
  }

  togglePanel(show) {
    const panel = document.getElementById('gmailNotifPanel');
    const overlay = document.getElementById('gmailNotifOverlay');
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden') || panel.style.display === 'none';
    const shouldShow = typeof show === 'boolean' ? show : isHidden;

    if (shouldShow) {
      panel.classList.remove('hidden');
      panel.style.display = 'flex';
      panel.style.zIndex = '999999';
      this.positionPanel();
      if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'block';
        overlay.style.zIndex = '999998';
      }
      this.renderList();
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
      }
    }
  }

  init() {
    this.updateBadges();

    const bellBtn = document.getElementById('gmailBellBtn');
    if (bellBtn) {
      bellBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanel();
      };
    }

    const closeBtn = document.getElementById('gmailNotifClose');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanel(false);
      };
    }

    const overlay = document.getElementById('gmailNotifOverlay');
    if (overlay) {
      overlay.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanel(false);
      };
    }

    const clearBtn = document.getElementById('gmailClearAllBtn');
    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearAll();
      };
    }

    window.addEventListener('resize', () => {
      const panel = document.getElementById('gmailNotifPanel');
      if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
        this.positionPanel();
      }
    });

    window.addEventListener('scroll', () => {
      const panel = document.getElementById('gmailNotifPanel');
      if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
        this.positionPanel();
      }
    }, { passive: true });

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('gmailNotifPanel');
      const bell = document.getElementById('gmailBellBtn');
      if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
        if (!panel.contains(e.target) && (!bell || !bell.contains(e.target))) {
          this.togglePanel(false);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = document.getElementById('gmailNotifPanel');
        if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
          this.togglePanel(false);
        }
      }
    });

    window.addEventListener('finanzapp:gmail:open-review', (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      const notif = this.notifications.find(n => n.id === id);
      if (notif) {
        this.togglePanel(false);
        abrirModalRevisarGmail(notif, id);
      }
    });

    window.addEventListener('finanzapp:gmail:clear-all', () => {
      this.clearAll();
    });

    window.addEventListener('finanzapp:gmail:notifications-updated', () => {
      this.notifications = this._loadNotifications();
      this.updateBadges();
      this.renderList();
    });

    window.addEventListener('storage', (e) => {
      const key = this._getStorageKey();
      if (e.key === key || e.key === 'finanzapp:gmail:pending_notifications' || e.key === 'finanzapp:gmail:notifications') {
        this.notifications = this._loadNotifications();
        this.updateBadges();
        this.renderList();
      }
    });

    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.notifications = this._loadNotifications();
          this.updateBadges();
          this.renderList();
          this.syncFromFirestore();
        } else {
          this.notifications = [];
          this.updateBadges();
          this.renderList();
        }
      });
    }

    this.syncFromFirestore();
  }

  async syncFromFirestore() {
    try {
      const user = window.firebase ? window.firebase.auth().currentUser : null;
      if (!user || !window.firebase.firestore) {
        this.notifications = [];
        this.updateBadges();
        this.renderList();
        return;
      }
      const db = window.firebase.firestore();
      const snap = await db.collection('users').doc(user.uid).collection('transactions')
        .where('source', '==', 'imap')
        .limit(100)
        .get();

      const firestoreNotifs = [];
      if (!snap.empty) {
        snap.forEach(doc => {
          const d = doc.data();
          if (d && !d.ignored && d.amount) {
            firestoreNotifs.push({
              id: doc.id,
              amount: d.amount,
              description: d.description || d.merchant || 'Transacción Bancaria',
              subject: d.subject || '',
              date: d.date ? (d.date.toDate ? d.date.toDate().toISOString() : new Date(d.date).toISOString()) : new Date().toISOString(),
              type: d.type || 'expense',
              timestamp: d.createdAt ? (d.createdAt.toMillis ? d.createdAt.toMillis() : Date.now()) : Date.now(),
              source: 'imap'
            });
          }
        });
      }

      const currentMap = new Map();
      firestoreNotifs.forEach(n => currentMap.set(n.id || `${n.amount}_${n.description}_${n.date}`, n));
      this._loadNotifications().forEach(n => {
        const key = n.id || `${n.amount}_${n.description}_${n.date}`;
        if (!currentMap.has(key)) currentMap.set(key, n);
      });

      this.notifications = this._sortList(Array.from(currentMap.values()));
      this._saveNotifications();
    } catch (e) {
      console.warn('Error syncing notifications from Firestore', e);
    }
  }
}

let gmailNotifManager = null;

function ensureGmailNotifManager() {
  if (!gmailNotifManager) {
    gmailNotifManager = new GmailNotificationManager();
    window.gmailNotifManager = gmailNotifManager;
  }
  return gmailNotifManager;
}

window.ensureGmailNotifManager = ensureGmailNotifManager;
window.toggleGmailNotifPanel = function(show) {
  const mgr = ensureGmailNotifManager();
  if (mgr) mgr.togglePanel(show);
};

// Inicializar inmediatamente el gestor de notificaciones
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ensureGmailNotifManager());
} else {
  ensureGmailNotifManager();
}

async function initGmailTransactionListener() {
  ensureGmailNotifManager();

  if (!window.GmailAPI) return;

  const handleTransaction = (txn) => {
    if (!txn || !txn.amount) return;
    gmailNotifManager.addNotification(txn);
  };

  if (!window.GmailAPI.isSignedIn() && typeof window.GmailAPI.ensureSession === 'function') {
    await window.GmailAPI.ensureSession();
  }

  if (window.GmailAPI.isSignedIn()) {
    window.GmailAPI.startPolling(handleTransaction);
  }

  window.GmailAPI._onStatusChange = (signedIn) => {
    if (signedIn) {
      window.GmailAPI.startPolling(handleTransaction);
    }
  };
}


/**
 * Abre el modal preexistente en Categorias.html (#gmailReviewModal) para revisar
 * y guardar la transacción bancaria detectada por Gmail.
 * @param {Object} notif
 * @param {string} notifId
 */
function abrirModalRevisarGmail(notif, notifId = null) {
  const modal = document.getElementById('gmailReviewModal');
  if (!modal) return;

  // Eliminar cualquier modal dinámico antiguo si existía
  const oldDynamicModal = document.getElementById('gmail-authorize-modal');
  if (oldDynamicModal) oldDynamicModal.remove();

  const amountInput = document.getElementById('gmailTxAmount');
  const descInput = document.getElementById('gmailTxDesc');
  const dateInput = document.getElementById('gmailTxDate');
  const catDropdown = document.getElementById('gmailTxCategory');
  const saveBtn = document.getElementById('gmailReviewSave');
  const discardBtn = document.getElementById('gmailReviewDiscard');
  const cancelBtn = document.getElementById('gmailReviewCancel');
  const closeBtn = document.getElementById('gmailReviewClose');

  if (amountInput) amountInput.value = notif.amount || '';
  if (descInput) descInput.value = notif.description || '';

  if (dateInput) {
    dateInput.value = formatDate(notif.date || new Date());
  }


  let currentTxType = notif.type || 'expense';

  // Configurar tipo de transacción (Gasto vs Ingreso) y repoblar categorías
  const typeSelector = document.getElementById('gmailTxTypeSelector');

  // Poblar categorías según el tipo (Excluir categorías de Ingreso para Gastos)
  const poblarCategoriasModal = (txType) => {
    const allCategories = (typeof datosUsuario !== 'undefined' && datosUsuario.categories) ? datosUsuario.categories : [];
    const validCategories = allCategories.filter(c => {
      if (txType === 'expense') return c.fixedType !== 'income';
      if (txType === 'income') return c.fixedType !== 'expense';
      return true;
    });

    let matchedCatId = '';
    if (notif.description && validCategories.length) {
      const descLower = notif.description.toLowerCase();
      const subjectLower = (notif.subject || '').toLowerCase();
      const matched = validCategories.find(c => {
        const cName = c.name.toLowerCase();
        return descLower.includes(cName) || subjectLower.includes(cName);
      });
      if (matched) matchedCatId = matched.id;
    }

    const selectedCatId = matchedCatId || validCategories[0]?.id || '';

    if (catDropdown) {
      catDropdown.classList.remove('open');
      const optionsContainer = catDropdown.querySelector('.custom-dropdown-options');
      const selectedEl = catDropdown.querySelector('.custom-dropdown-selected');

      if (optionsContainer) {
        if (!validCategories.length) {
          optionsContainer.innerHTML = '<div class="custom-dropdown-option disabled"><span>Sin categorías disponibles</span></div>';
        } else {
          optionsContainer.innerHTML = validCategories.map(c => `
            <div class="custom-dropdown-option ${String(c.id) === String(selectedCatId) ? 'selected' : ''}" data-value="${c.id}">
              <span>${c.name}</span>
            </div>
          `).join('');
        }

        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          opt.onclick = (e) => {
            e.stopPropagation();
            const val = opt.getAttribute('data-value');
            const catObj = validCategories.find(c => String(c.id) === String(val));
            if (selectedEl) {
              selectedEl.setAttribute('data-value', val || '');
              const span = selectedEl.querySelector('span');
              if (span) span.textContent = catObj ? catObj.name : 'Seleccionar categoría';
            }
            optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            catDropdown.classList.remove('open');
          };
        });
      }

      if (selectedEl) {
        const selectedCat = validCategories.find(c => String(c.id) === String(selectedCatId));
        selectedEl.setAttribute('data-value', selectedCatId);
        const span = selectedEl.querySelector('span');
        if (span) span.textContent = selectedCat ? selectedCat.name : 'Seleccionar categoría';
        
        selectedEl.onclick = (e) => {
          e.stopPropagation();
          catDropdown.classList.toggle('open');
        };
      }
    }
  };

  if (typeSelector) {
    const btns = typeSelector.querySelectorAll('.transaction-type-btn');
    btns.forEach(b => {
      const val = b.getAttribute('data-value');
      b.classList.toggle('active', val === currentTxType);
      b.onclick = () => {
        btns.forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        currentTxType = val;
        poblarCategoriasModal(currentTxType);
      };
    });
  }

  poblarCategoriasModal(currentTxType);

  // Mostrar modal preexistente usando las funciones nativas del Dashboard
  abrirModal(modal);

  const closeModal = () => {
    cerrarModal(modal);
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (discardBtn) {
    discardBtn.onclick = () => {
      if (notifId && gmailNotifManager) gmailNotifManager.removeNotification(notifId);
      closeModal();
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const amountVal = parseFloat(amountInput?.value || notif.amount);
      const descVal = descInput?.value || notif.description;
      const catVal = catDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || selectedCatId;

      if (!catVal) {
        alert('Por favor selecciona una categoría.');
        return;
      }

      const activeTypeBtn = typeSelector?.querySelector('.transaction-type-btn.active');
      const typeVal = activeTypeBtn?.getAttribute('data-value') || notif.type || 'expense';

      const success = await agregarTransaccionDirecta(
        catVal,
        typeVal,
        amountVal,
        descVal,
        notif.date ? new Date(notif.date) : new Date()
      );

      if (success) {
        if (notifId && gmailNotifManager) gmailNotifManager.removeNotification(notifId);
        closeModal();
        if (typeof window._configMostrarToast === 'function') {
          window._configMostrarToast(`✓ Transacción agregada exitosamente`, 'exito');
        }
      }
    };
  }
}

/**
 * Agrega una transacción directamente a una categoría sin pasar por los inputs del DOM.
 * Usada por la integración de Gmail para guardar transacciones detectadas automáticamente.
 * @param {string|number} categoryId
 * @param {'income'|'expense'} type
 * @param {number} amount
 * @param {string} description
 * @param {Date} date
 * @returns {Promise<boolean>}
 */
async function agregarTransaccionDirecta(categoryId, type, amount, description, date) {
  const category = buscarCategoria(categoryId);
  if (!category) return false;
  const resolvedType = type || category.fixedType || 'expense';
  const resolvedDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  category.transactions = category.transactions || [];
  category.transactions.push({
    id: generarId(),
    type: resolvedType,
    amount: redondear2(amount),
    description: (description || 'Sin descripción').substring(0, 100),
    date: resolvedDate
  });
  marcarCambioDatos();
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
  await persist();
  window.DataEvents.emit('transactionChanged', { action: 'add', categoryId });
  return true;
}
window.agregarTransaccionDirecta = agregarTransaccionDirecta;
window.obtenerCategorias = () => datosUsuario.categories || [];

let customTxnTooltipInitialized = false;
/**
 * Inicializa el tooltip personalizado para descripciones de transacciones y botones de ordenación.
 * Se registra una sola vez gracias a la bandera `customTxnTooltipInitialized`.
 */
function initCustomTransactionTooltip() {
  if (customTxnTooltipInitialized) return;
  customTxnTooltipInitialized = true;

  const tooltip = document.createElement('div');
  tooltip.id = 'txn-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);

  let hideTimer = null;

  const positionTooltip = (evt) => {
    const padding = 10;
    const maxWidth = 320;
    tooltip.style.maxWidth = maxWidth + 'px';
    const rect = tooltip.getBoundingClientRect();
    let x = evt.clientX + 14;
    let y = evt.clientY - rect.height - 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + rect.width + padding > vw) x = vw - rect.width - padding;
    if (y < padding) y = evt.clientY + 18;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  };

  const showTooltip = (el, evt) => {
    const text = el.getAttribute('title');
    if (!text || !text.trim()) return;
    el.dataset._originalTitle = text;
    el.removeAttribute('title');
    tooltip.textContent = text;
    positionTooltip(evt);
    clearTimeout(hideTimer);
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    });
  };

  const hideTooltip = (el) => {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(-4px)';
    hideTimer = setTimeout(() => {
      if (el && el.dataset._originalTitle) {
        el.setAttribute('title', el.dataset._originalTitle);
        delete el.dataset._originalTitle;
      }
    }, 160);
  };

  const safeClosest = (t, sel) => {
    if (!t) return null;
    if (t.nodeType === 3) t = t.parentElement;
    if (!(t instanceof Element) || typeof t.closest !== 'function') return null;
    return t.closest(sel);
  };

  const forceHide = () => {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(-4px)';
  };

  const TOOLTIP_TARGETS = '.transaction-desc, .transaction-amount, .amount-chip, .sort-btn, [data-tooltip]';

  document.addEventListener('click', forceHide, true);
  document.addEventListener('scroll', forceHide, { capture: true, passive: true });
  document.addEventListener('keydown', forceHide, true);

  document.addEventListener('mouseenter', (e) => {
    const target = safeClosest(e.target, TOOLTIP_TARGETS);
    if (!target) return;
    showTooltip(target, e);
  }, true);

  document.addEventListener('mousemove', (e) => {
    const has = safeClosest(e.target, TOOLTIP_TARGETS);
    if (!has) return;
    positionTooltip(e);
  }, true);

  document.addEventListener('mouseleave', (e) => {
    const target = safeClosest(e.target, TOOLTIP_TARGETS);
    if (!target) return;
    if (target.contains(e.relatedTarget)) return;
    hideTooltip(target);
  }, true);
}

window.editarTransaccion = editarTransaccion;
window.eliminarTransaccion = eliminarTransaccion;
window.abrirSelectorFecha = abrirSelectorFecha;




