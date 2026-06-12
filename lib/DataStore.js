/**
 * @fileoverview Jerarquía de almacenamiento de datos de la aplicación.
 *
 * Define una clase base `Store` y tres implementaciones concretas:
 * - {@link LocalStorageStore} - localStorage con sync opcional a Firestore.
 * - {@link FirestoreStore}   - Firestore como fuente principal + fallback a localStorage.
 * - {@link ApiStore}         - REST API (preparado para expansión backend futura).
 *
 * Todas las implementaciones comparten la misma interfaz:
 * `load(): Promise<State>` y `save(state): Promise<void>`.
 *
 * @example
 * const store = window.Core.storeFactories.createFirestoreStore();
 * const data  = await store.load();
 * await store.save({ transactions: [], categories: [], budgets: {} });
 */

// ---------------------------------------------------------------------------
// Utilidades internas (no expuestas globalmente)
// ---------------------------------------------------------------------------

/**
 * Lee el UID del usuario autenticado desde localStorage.
 * @returns {string} UID del usuario, o 'guest' si no hay sesión activa.
 */
function _getUserId() {
  try {
    const authUser = localStorage.getItem('authUser');
    if (authUser) {
      const user = JSON.parse(authUser);
      return user.uid || user.email || 'guest';
    }
  } catch (e) {
    console.warn('Error obteniendo userId:', e);
  }
  return 'guest';
}

/**
 * Determina si el usuario actual es un invitado (sin cuenta registrada).
 * @returns {boolean}
 */
function _isGuestUser() {
  try {
    const authUser = localStorage.getItem('authUser');
    if (!authUser) return true;
    const user = JSON.parse(authUser);
    return user.uid === 'guest' || user.provider === 'guest' || !user.uid;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Clase base abstracta
// ---------------------------------------------------------------------------

/**
 * Contrato base para todas las implementaciones de almacenamiento.
 * Las subclases deben implementar `load()` y `save()`.
 * @abstract
 */
class Store {
  /**
   * Carga el estado de la aplicación desde el medio de almacenamiento.
   * @abstract
   * @returns {Promise<{transactions: Array, categories: Array, budgets: Object}|null>}
   */
  async load() {
    throw new Error(`${this.constructor.name}.load() debe ser implementado.`);
  }

  /**
   * Persiste el estado completo de la aplicación.
   * @abstract
   * @param {{ transactions: Array, categories: Array, budgets: Object }} state
   * @returns {Promise<void>}
   */
  async save(state) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.save() debe ser implementado.`);
  }
}

// ---------------------------------------------------------------------------
// LocalStorageStore
// ---------------------------------------------------------------------------

/**
 * Almacenamiento basado en localStorage.
 * Si Firestore está disponible y el usuario está autenticado, sincroniza
 * automáticamente tras cada `save()`.
 * @extends Store
 */
class LocalStorageStore extends Store {
  /** @type {string} Clave base para el almacenamiento (se agrega el userId al final) */
  #baseKey;

  /**
   * @param {string} [baseKey='finanzapp:data:v1']
   */
  constructor(baseKey = 'finanzapp:data:v1') {
    super();
    this.#baseKey = baseKey;
  }

  /** @override */
  async load() {
    try {
      const key = `${this.#baseKey}:${_getUserId()}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** @override */
  async save(state) {
    try {
      const userId = _getUserId();
      localStorage.setItem(`${this.#baseKey}:${userId}`, JSON.stringify(state));

      if (window.FirestoreDB?.initialized && userId !== 'guest') {
        try {
          await Promise.all([
            window.FirestoreDB.saveTransactions(state.transactions || []),
            window.FirestoreDB.saveCategories(state.categories   || []),
            window.FirestoreDB.saveBudgets(state.budgets         || {})
          ]);
        } catch (err) {
          console.warn('Error sincronizando con Firestore:', err);
        }
      }
    } catch (err) {
      console.error('Error guardando en LocalStorageStore:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// FirestoreStore
// ---------------------------------------------------------------------------

/**
 * Almacenamiento híbrido: Firestore como fuente principal con fallback a localStorage.
 * En modo invitado opera exclusivamente con localStorage.
 * @extends Store
 */
class FirestoreStore extends Store {
  /** @type {string} Prefijo de claves en localStorage */
  static #LS_PREFIX = 'finanzapp:data:v1';

  /**
   * Lee el snapshot actual de localStorage para un usuario.
   * @param {string} userId
   * @returns {{ transactions: Array, categories: Array, budgets: Object }}
   */
  static #readLocalSnapshot(userId) {
    const p = FirestoreStore.#LS_PREFIX;
    return {
      transactions: JSON.parse(localStorage.getItem(`${p}:${userId}:transactions`) || '[]'),
      categories:   JSON.parse(localStorage.getItem(`${p}:${userId}:categories`)   || '[]'),
      budgets:      JSON.parse(localStorage.getItem(`${p}:${userId}:budgets`)       || '{}')
    };
  }

  /** @override */
  async load() {
    const userId = _getUserId();

    if (_isGuestUser() || !window.FirestoreDB) {
      return FirestoreStore.#readLocalSnapshot(userId);
    }

    try {
      const localSnapshot = FirestoreStore.#readLocalSnapshot(userId);

      await window.FirestoreDB.init(userId);
      window.FirestoreDB.setCurrentUser(userId);

      const data = await window.FirestoreDB.loadAllUserData();
      const hasRemoteData = data && (
        data.transactions.length > 0 ||
        data.categories.length   > 0 ||
        Object.keys(data.budgets || {}).length > 0
      );

      if (hasRemoteData) return data;

      const hasLocalData =
        localSnapshot.transactions.length > 0 ||
        localSnapshot.categories.length   > 0 ||
        Object.keys(localSnapshot.budgets).length > 0;

      if (hasLocalData) {
        try {
          const p = FirestoreStore.#LS_PREFIX;
          localStorage.setItem(`${p}:${userId}:transactions`, JSON.stringify(localSnapshot.transactions));
          localStorage.setItem(`${p}:${userId}:categories`,   JSON.stringify(localSnapshot.categories));
          localStorage.setItem(`${p}:${userId}:budgets`,      JSON.stringify(localSnapshot.budgets));
          await window.FirestoreDB.migrateFromLocalStorage();
        } catch (e) {
          console.warn('No se pudo migrar datos locales a Firestore:', e);
        }
        return localSnapshot;
      }

      return { transactions: [], categories: [], budgets: {} };
    } catch (err) {
      console.error('Error cargando desde Firestore:', err);
      return FirestoreStore.#readLocalSnapshot(userId);
    }
  }

  /** @override */
  async save(state) {
    try {
      const userId = _getUserId();
      const p      = FirestoreStore.#LS_PREFIX;

      localStorage.setItem(`${p}:${userId}:transactions`, JSON.stringify(state.transactions || []));
      localStorage.setItem(`${p}:${userId}:categories`,   JSON.stringify(state.categories   || []));
      localStorage.setItem(`${p}:${userId}:budgets`,      JSON.stringify(state.budgets       || {}));

      if (window.FirestoreDB?.initialized && userId !== 'guest') {
        try {
          await Promise.all([
            window.FirestoreDB.saveTransactions(state.transactions || []),
            window.FirestoreDB.saveCategories(state.categories   || []),
            window.FirestoreDB.saveBudgets(state.budgets           || {})
          ]);
        } catch (err) {
          console.error('Error sincronizando con Firestore:', err);
          throw err;
        }
      }
    } catch (err) {
      console.error('Error guardando datos en FirestoreStore:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// ApiStore
// ---------------------------------------------------------------------------

/**
 * Almacenamiento basado en una API REST.
 * Preparado para expansión futura con backend propio.
 * @extends Store
 */
class ApiStore extends Store {
  /** @type {string} URL base de la API */
  #baseUrl;

  /**
   * @param {string} [baseUrl='/api']
   */
  constructor(baseUrl = '/api') {
    super();
    this.#baseUrl = baseUrl;
  }

  /** @override */
  async load() {
    const res = await fetch(`${this.#baseUrl}/state`, { credentials: 'include' });
    if (!res.ok) throw new Error('No se pudo cargar el estado desde la API');
    return res.json();
  }

  /** @override */
  async save(state) {
    const res = await fetch(`${this.#baseUrl}/state`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(state)
    });
    if (!res.ok) throw new Error('No se pudo guardar el estado en la API');
  }
}

// ---------------------------------------------------------------------------
// Exportación global
// ---------------------------------------------------------------------------

window.Core = window.Core || {};

/**
 * Fábricas de almacenamiento expuestas en `window.Core.storeFactories`.
 * Mantiene compatibilidad con el código existente.
 * @namespace
 * @property {function(string=): LocalStorageStore} createLocalStorageStore
 * @property {function(): FirestoreStore}           createFirestoreStore
 * @property {function(string=): ApiStore}          createApiStore
 */
window.Core.storeFactories = {
  /**
   * Crea un store de localStorage con sync opcional a Firestore.
   * @param {string} [baseKey]
   * @returns {LocalStorageStore}
   */
  createLocalStorageStore: (baseKey) => new LocalStorageStore(baseKey),

  /**
   * Crea un store híbrido Firestore + localStorage.
   * @returns {FirestoreStore}
   */
  createFirestoreStore: () => new FirestoreStore(),

  /**
   * Crea un store basado en API REST.
   * @param {string} [baseUrl]
   * @returns {ApiStore}
   */
  createApiStore: (baseUrl) => new ApiStore(baseUrl)
};