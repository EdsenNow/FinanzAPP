/**
 * @fileoverview Sistema de diálogos y notificaciones de la aplicación.
 *
 * Gestiona:
 * - Alertas modales (info, success, warning, error)
 * - Diálogos de confirmación via bottom drawer
 * - Accesibilidad: focus trap, aria-hidden, tecla ESC, restauración de foco
 *
 * Las funciones globales `window.showAlert` y `window.hideAlert` son el punto
 * de entrada desde todas las páginas.
 *
 * @example
 * // Alerta simple
 * await showAlert('Guardado', 'Los cambios se guardaron correctamente', { variant: 'success' });
 *
 * // Confirmación
 * const result = await showAlert('¿Eliminar?', 'Esta acción no se puede deshacer', {
 *   variant: 'confirm', emphasis: 'danger',
 *   confirmText: 'Eliminar', cancelText: 'Cancelar'
 * });
 * if (result === 'confirm') { ... }
 */
class UIManager {
  /** @type {boolean} Si hay un diálogo modal actualmente abierto */
  #alertOpen = false;

  /** @type {Function|null} Función resolve de la Promise del diálogo activo */
  #resolveFn = null;

  /** @type {Element|null} Elemento con foco antes de abrir el diálogo (para restaurar) */
  #lastFocused = null;

  /** @type {Function|null} Handler de teclado activo para el focus trap */
  #keyHandler = null;

  /** @type {{ disableEsc: boolean, preventCloseOnOverlay: boolean }} */
  #optionsLive = { disableEsc: false, preventCloseOnOverlay: false };

  /** @type {Element|null} Drawer activo actualmente */
  #activeDrawer = null;

  /** @type {Element|null} Overlay del drawer activo */
  #drawerOverlay = null;

  /**
   * Obtiene un elemento del DOM por ID.
   * @param {string} id
   * @returns {Element|null}
   */
  #q(id) { return document.getElementById(id); }

  /**
   * Devuelve todos los elementos enfocables dentro de un contenedor.
   * @param {Element} el
   * @returns {Element[]}
   */
  #getFocusable(el) {
    const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(el.querySelectorAll(sel))
      .filter(n => !n.hasAttribute('disabled') && n.tabIndex !== -1);
  }

  /**
   * Abre el diálogo modal y activa el focus trap y los atributos de accesibilidad.
   */
  #openDialog() {
    const overlay = this.#q('alertOverlay');
    const box     = this.#q('customAlert');
    const appRoot = document.querySelector('.app-container');
    if (!overlay || !box) return;

    overlay.classList.remove('hidden');
    box.classList.remove('hidden');
    overlay.style.display = 'block';
    box.style.display     = 'block';
    document.body.classList.add('no-scroll');
    appRoot?.setAttribute('aria-hidden', 'true');
    this.#lastFocused = document.activeElement;
    box.focus();

    this.#keyHandler = (e) => {
      if (e.key === 'Tab') {
        const list = this.#getFocusable(box);
        if (!list.length) return;
        const idx = list.indexOf(document.activeElement);
        if (e.shiftKey) {
          if (idx <= 0) { list[list.length - 1].focus(); e.preventDefault(); }
        } else {
          if (idx === list.length - 1) { list[0].focus(); e.preventDefault(); }
        }
      } else if (e.key === 'Escape' && !this.#optionsLive.disableEsc) {
        this.#closeDialog('cancel');
      }
    };
    box.addEventListener('keydown', this.#keyHandler);
    this.#alertOpen = true;
  }

  /**
   * Cierra el diálogo modal, restaura el foco y resuelve la Promise.
   * @param {string} [result='cancel']
   */
  #closeDialog(result = 'cancel') {
    if (!this.#alertOpen) return;
    const overlay = this.#q('alertOverlay');
    const box     = this.#q('customAlert');
    const appRoot = document.querySelector('.app-container');

    overlay?.classList.add('hidden');
    if (box) {
      box.classList.add('hidden');
      if (this.#keyHandler) box.removeEventListener('keydown', this.#keyHandler);
    }
    if (overlay) overlay.style.display = 'none';
    if (box)     box.style.display     = 'none';
    document.body.classList.remove('no-scroll');
    appRoot?.removeAttribute('aria-hidden');
    this.#alertOpen = false;

    if (this.#lastFocused && typeof this.#lastFocused.focus === 'function') {
      setTimeout(() => { try { this.#lastFocused.focus(); } catch { /* noop */ } }, 0);
    }
    if (this.#resolveFn) {
      const r = this.#resolveFn;
      this.#resolveFn = null;
      r(result);
    }
  }

  /**
   * Cierra el bottom drawer con animación y resuelve la Promise.
   * @param {string} [result='cancel']
   */
  #closeDrawer(result = 'cancel') {
    if (this.#activeDrawer) {
      this.#activeDrawer.classList.remove('drawer-show');
      this.#drawerOverlay?.classList.remove('drawer-overlay-show');
      const drawer  = this.#activeDrawer;
      const overlay = this.#drawerOverlay;
      setTimeout(() => {
        drawer?.parentNode?.removeChild(drawer);
        overlay?.parentNode?.removeChild(overlay);
      }, 280);
      this.#activeDrawer  = null;
      this.#drawerOverlay = null;
    }
    if (this.#resolveFn) {
      const r = this.#resolveFn;
      this.#resolveFn = null;
      r(result);
    }
  }

  /**
   * Muestra un bottom drawer de confirmación.
   * Se usa internamente para `variant: 'confirm'`.
   * @param {string} message                                - Texto o HTML del mensaje.
   * @param {{ emphasis?: string, confirmText?: string, cancelText?: string, disableEsc?: boolean }} [opts]
   * @returns {Promise<'confirm'|'cancel'>}
   */
  showDrawer(message, opts = {}) {
    const {
      emphasis    = 'primary',
      confirmText = 'Aceptar',
      cancelText  = 'Cancelar',
      disableEsc  = false
    } = opts;

    this.#closeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);
    this.#drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = 'confirm-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.innerHTML = `
      <p class="confirm-drawer-msg">${message}</p>
      <div class="confirm-drawer-btns">
        <button class="confirm-drawer-cancel">${cancelText}</button>
        <button class="confirm-drawer-confirm confirm-drawer-confirm-${emphasis}">${confirmText}</button>
      </div>
    `;
    document.body.appendChild(drawer);
    this.#activeDrawer = drawer;

    requestAnimationFrame(() => {
      drawer.classList.add('drawer-show');
      overlay.classList.add('drawer-overlay-show');
    });

    drawer.querySelector('.confirm-drawer-cancel').addEventListener('click', () => this.#closeDrawer('cancel'));
    drawer.querySelector('.confirm-drawer-confirm').addEventListener('click', () => this.#closeDrawer('confirm'));
    overlay.addEventListener('click', () => {
      if (window.innerWidth <= 980) this.#closeDrawer('cancel');
    });

    if (!disableEsc) {
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.#closeDrawer('cancel');
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }

    return new Promise(res => { this.#resolveFn = res; });
  }

  /**
   * Muestra un diálogo de alerta o confirmación.
   *
   * @param {string} title   - Título del diálogo.
   * @param {string} message - Mensaje principal.
   * @param {{
   *   variant?:               'info'|'success'|'warning'|'error'|'confirm',
   *   emphasis?:              'primary'|'danger',
   *   confirmText?:           string,
   *   cancelText?:            string,
   *   disableEsc?:            boolean,
   *   preventCloseOnOverlay?: boolean,
   *   autoCloseMs?:           number,
   *   isHtml?:                boolean
   * }} [opts]
   * @warning La opción `isHtml` debe usarse únicamente con HTML confiable generado
   *          internamente. Nunca la actives con contenido proveniente del usuario.
   * @returns {Promise<'confirm'|'cancel'|'error'>}
   */
  async showAlert(title, message, opts = {}) {
    const {
      variant               = 'info',
      emphasis              = 'primary',
      confirmText           = 'Aceptar',
      cancelText            = 'Cancelar',
      disableEsc            = false,
      preventCloseOnOverlay = false,
      autoCloseMs           = 0
    } = opts || {};

    if (variant === 'confirm') {
      return this.showDrawer(message, { emphasis, confirmText, cancelText, disableEsc });
    }

    this.#optionsLive = { disableEsc, preventCloseOnOverlay };

    const box     = this.#q('customAlert');
    const t       = this.#q('alertTitle');
    const m       = this.#q('alertMessage');
    const btns    = this.#q('alertButtons') || box;
    const ok      = this.#q('alertConfirm');
    const overlay = this.#q('alertOverlay');

    if (!box || !t || !m || !btns || !ok || !overlay) return Promise.resolve('error');

    box.className = 'custom-alert hidden';
    box.classList.add(variant);
    t.textContent = String(title ?? '');

    if (opts?.isHtml) {
      m.innerHTML = String(message ?? '');
    } else {
      m.textContent = String(message ?? '');
    }

    ok.textContent = confirmText;
    ok.classList.remove('btn-danger', 'btn-primary');
    ok.classList.add(emphasis === 'danger' ? 'btn-danger' : 'btn-primary');

    btns.querySelector('#alertCancel')?.remove();

    ok.onclick      = () => this.#closeDialog('confirm');
    overlay.onclick = () => {
      if (!preventCloseOnOverlay && window.innerWidth <= 980) this.#closeDialog('cancel');
    };

    this.#openDialog();

    if (autoCloseMs && Number.isFinite(autoCloseMs) && autoCloseMs > 0) {
      setTimeout(() => { if (this.#alertOpen) this.#closeDialog('confirm'); }, autoCloseMs);
    }

    return new Promise(res => { this.#resolveFn = res; });
  }

  /**
   * Cierra cualquier diálogo o drawer que esté abierto actualmente.
   */
  hideAlert() {
    this.#closeDialog('cancel');
    this.#closeDrawer('cancel');
  }
}

const _uiManager = new UIManager();

/**
 * Muestra un diálogo de alerta o confirmación.
 * @type {UIManager['showAlert']}
 */
window.showAlert = _uiManager.showAlert.bind(_uiManager);

/**
 * Cierra el diálogo o drawer activo.
 * @type {UIManager['hideAlert']}
 */
window.hideAlert = _uiManager.hideAlert.bind(_uiManager);