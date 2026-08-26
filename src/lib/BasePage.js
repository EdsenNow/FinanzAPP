/**
 * @fileoverview Clase base para todas las páginas de FinanzApp.
 *
 * Centraliza la funcionalidad compartida entre páginas:
 * - Verificación de autenticación y redirección a Login
 * - Carga y refresco de datos del usuario via DataStore
 * - Aplicación del tema (claro/oscuro)
 * - Actualización del perfil de usuario en el sidebar
 * - Suscripción a eventos cross-tab via DataEvents
 *
 * Las páginas deben extender `BasePage` e implementar los hooks:
 * - `onDataLoaded(data)` - se ejecuta tras la carga inicial de datos
 * - `bindEvents()` - registra los eventos de la página (llamar `super.bindEvents()`)
 *
 * @example
 * class DashboardApp extends BasePage {
 *   async onDataLoaded(data) {
 *     // Renderizar con los datos cargados
 *     this.renderTransactions(data.transactions);
 *   }
 *
 *   bindEvents() {
 *     super.bindEvents();
 *     document.getElementById('btnAgregar')
 *       .addEventListener('click', () => this.abrirFormulario());
 *   }
 * }
 *
 * document.addEventListener('DOMContentLoaded', () => new DashboardApp());
 */
class BasePage {
  /**
   * Datos del usuario actualmente cargados.
   * @type {{ transactions: Array, categories: Array, budgets: Object, user: Object }}
   */
  datosUsuario = {
    transactions: [],
    categories:   [],
    budgets:      {},
    user:         {}
  };

  /** @type {boolean} Indica si los datos fueron cargados al menos una vez */
  dataLoaded = false;

  constructor() {
    this._checkAuth();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init());
    } else {
      setTimeout(() => this._init(), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Ciclo de vida
  // ---------------------------------------------------------------------------

  /**
   * Verifica que haya una sesión activa; redirige a Login si no la hay.
   * @protected
   */
  _checkAuth() {
    try {
      const loggedIn = localStorage.getItem('loggedIn');
      const authUser = localStorage.getItem('authUser');
      if (!loggedIn || !authUser) {
        window.location.replace('/pages/Login/Login.html');
      }
    } catch {
      window.location.replace('/pages/Login/Login.html');
    }
  }

  /**
   * Punto de entrada tras DOMContentLoaded.
   * Aplica tema, actualiza perfil, carga datos y registra eventos.
   * @protected
   */
  async _init() {
    this._applyTheme();
    this._updateUserProfile();
    await this._loadData();
    this.bindEvents();
    this._bindCrossTabEvents();
  }

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------

  /**
   * Carga los datos del usuario desde FirestoreStore (con fallback a localStorage).
   * Llama a `onDataLoaded()` con los datos obtenidos.
   * @protected
   */
  async _loadData() {
    try {
      const store = window.Core.storeFactories.createFirestoreStore();
      const data  = await store.load();
      if (data) {
        this.datosUsuario.transactions = data.transactions || [];
        this.datosUsuario.categories   = data.categories   || [];
        this.datosUsuario.budgets      = data.budgets      || {};
      }
      try {
        const raw = localStorage.getItem('authUser');
        this.datosUsuario.user = raw ? JSON.parse(raw) : {};
      } catch {
        this.datosUsuario.user = {};
      }
      this.dataLoaded = true;
      await this.onDataLoaded(this.datosUsuario);
    } catch (err) {
      console.error(`[${this.constructor.name}] Error cargando datos:`, err);
    }
  }

  /**
   * Hook llamado tras la carga (o recarga) de datos.
   * Implementar en la subclase para renderizar la página con los datos recibidos.
   *
   * @param {{ transactions: Array, categories: Array, budgets: Object, user: Object }} data
   * @returns {Promise<void>}
   */
  async onDataLoaded(data) { // eslint-disable-line no-unused-vars
    // Sobreescribir en la subclase
  }

  // ---------------------------------------------------------------------------
  // Tema y perfil
  // ---------------------------------------------------------------------------

  /**
   * Lee el tema guardado en la configuración y lo aplica al atributo `data-theme` del documento.
   * @protected
   */
  _applyTheme() {
    try {
      const settings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
      document.documentElement.setAttribute('data-theme', settings?.theme || 'dark');
    } catch { /* usa tema por defecto */ }
  }

  /**
   * Actualiza los elementos de perfil del sidebar con el nombre, email y avatar del usuario.
   * @protected
   */
  _updateUserProfile() {
    try {
      const raw     = localStorage.getItem('authUser');
      const user    = raw && raw !== 'guest' ? JSON.parse(raw) : {};
      const name    = user?.name || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
      const picture = user?.picture || user?.photoURL || '';
      const nameEl  = document.querySelector('.user-name');
      const emailEl = document.querySelector('.user-email');
      const avatarEl = document.querySelector('.user-avatar');
      if (nameEl)  nameEl.textContent  = name;
      if (emailEl) emailEl.textContent = user?.email || '';
      if (avatarEl) {
        avatarEl.innerHTML = '';
        if (picture) {
          const img = document.createElement('img');
          img.src = picture;
          img.alt = name;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
          avatarEl.appendChild(img);
        } else {
          avatarEl.textContent = (name || 'U').trim().charAt(0).toUpperCase();
        }
      }
    } catch { /* noop */ }
  }


  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------

  /**
   * Registra listeners de eventos cross-tab via `DataEvents`.
   * Por defecto recarga los datos al recibir `datos:actualizados`.
   * Sobreescribir para agregar listeners adicionales.
   * @protected
   */
  _bindCrossTabEvents() {
    if (!window.DataEvents) return;
    window.DataEvents.on('datos:actualizados', () => this._loadData());
  }

  /**
   * Registra los eventos de la página (botones, inputs, etc.).
   * Llamar `super.bindEvents()` al sobreescribir para incluir el comportamiento base.
   * @protected
   */
  bindEvents() {
    // Implementar en la subclase
  }
}

/** @type {typeof BasePage} Clase base disponible globalmente */
window.BasePage = BasePage;
