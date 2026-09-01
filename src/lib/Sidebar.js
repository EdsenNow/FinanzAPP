/**
 * @fileoverview Renderizador unificado del menú lateral (sidebar).
 *
 * Genera el HTML del sidebar, gestiona el estado activo de la navegación
 * y emite el evento `sidebar:rendered` tras cada renderizado.
 *
 * @example
 * // Renderizar el sidebar marcando 'dashboard' como activo
 * window.sidebarRenderer.render('dashboard');
 */

/**
 * Definición de los ítems de navegación principal.
 * Agregar un objeto con `upcoming: true` y `message` para secciones en desarrollo.
 * @type {Array<{key: string, label: string, icon: string, href: string, upcoming?: boolean, message?: string}>}
 */
const NAV_ITEMS = [
  { key: 'categorias',    label: 'Categorías',     icon: 'fas fa-home',      href: '/pages/Categorias/Categorias.html' },
  { key: 'presupuestos',  label: 'Presupuestos',   icon: 'fas fa-wallet',    href: '/pages/Presupuestos/Presupuestos.html' },
  { key: 'estadistica',   label: 'Estadísticas',   icon: 'fas fa-chart-pie', href: '/pages/Estadistica/Estadistica.html' },
  { key: 'configuracion', label: 'Configuración',  icon: 'fas fa-cog',       href: '/pages/Configuracion/Configuracion.html' }
];

/**
 * Renderizador del sidebar de la aplicación.
 * Genera el markup HTML, aplica el ítem activo y delega eventos para secciones futuras.
 */
class SidebarRenderer {
  /**
   * Renderiza el sidebar en el elemento `#sidebar` del DOM.
   * Emite `sidebar:rendered` tras completar el renderizado.
   * @param {string} activeKey - Clave del ítem de navegación activo (ej. 'dashboard').
   */
  render(activeKey) {
    if (typeof document === 'undefined') return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = this.#buildMarkup();
    this.#attachUpcomingHandlers(sidebar);
    this.setActive(activeKey);

    document.dispatchEvent(new CustomEvent('sidebar:rendered', {
      bubbles: false,
      detail:  { active: activeKey }
    }));
  }

  /**
   * Construye el HTML completo del sidebar a partir de `NAV_ITEMS`.
   * @returns {string} HTML del sidebar.
   */
  #buildMarkup() {
    const navItemsMarkup = NAV_ITEMS.map(({ key, label, icon, href, upcoming, message }) => {
      const attrs = [`class="nav-item"`, `data-nav="${key}"`];

      if (upcoming) {
        attrs.push('href="#"', 'data-upcoming="true"', `data-message="${message}"`, 'role="button"');
      } else {
        attrs.push(`href="${href}"`);
      }

      return `<a ${attrs.join(' ')}><i class="${icon}"></i><span>${label}</span></a>`;
    }).join('');

    return `
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon"><i class="fas fa-wallet"></i></div>
          <span class="logo-text">FinanzApp</span>
        </div>
      </div>
      <nav class="nav-links">
        ${navItemsMarkup}
      </nav>
      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar">U</div>
          <div class="user-info">
            <div class="user-name">Usuario</div>
            <div class="user-email"></div>
          </div>
          <button class="btn btn-icon app-tooltip" id="themeToggle" data-tooltip="Cambiar tema">
            <i class="fas fa-sun"></i>
          </button>
          <button class="btn btn-icon app-tooltip" id="logoutButton" data-tooltip="Cerrar sesión">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Registra handlers para los ítems marcados como `upcoming`.
   * Al hacer clic muestran un aviso via `showAlert` o `alert` como fallback.
   * @param {Element} container - Elemento raíz donde buscar los links.
   */
  #attachUpcomingHandlers(container) {
    container.querySelectorAll('[data-upcoming="true"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const msg = link.getAttribute('data-message') || 'Esta sección estará disponible próximamente.';
        if (typeof window.showAlert === 'function') {
          window.showAlert('Próximamente', msg, { variant: 'warning' });
        } else {
          alert(`Próximamente: ${msg}`);
        }
      });
    });
  }

  /**
   * Aplica la clase `active` al ítem cuya clave coincida con `key`.
   * @param {string} key - Clave del ítem a marcar como activo.
   */
  setActive(key) {
    if (!key) return;
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-nav') === key);
    });
  }
}

/** @type {SidebarRenderer} Instancia global del renderizador de sidebar */
window.sidebarRenderer = new SidebarRenderer();
