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
      const userId = _getUserId();
      const p = this.#baseKey;
      const rawCategories = localStorage.getItem(`${p}:${userId}:categories`);
      const rawTransactions = localStorage.getItem(`${p}:${userId}:transactions`);
      const rawBudgets = localStorage.getItem(`${p}:${userId}:budgets`);
      
      if (rawCategories === null && rawTransactions === null && rawBudgets === null) {
        return null;
      }

      return {
        transactions: JSON.parse(rawTransactions || '[]'),
        categories:   JSON.parse(rawCategories   || '[]'),
        budgets:      JSON.parse(rawBudgets      || '{}')
      };
    } catch {
      return null;
    }
  }

  /** @override */
  async save(state) {
    try {
      const userId = _getUserId();
      const p = this.#baseKey;
      localStorage.setItem(`${p}:${userId}:transactions`, JSON.stringify(state.transactions || []));
      localStorage.setItem(`${p}:${userId}:categories`,   JSON.stringify(state.categories   || []));
      localStorage.setItem(`${p}:${userId}:budgets`,      JSON.stringify(state.budgets      || {}));
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

  /** @type {number} Margen en ms para ignorar nuestros propios guardados */
  static #OWN_SAVE_MARGIN_MS = 500;

  #unsubscribe = null;
  #lastLocalSaveAt = 0;

  /**
   * Lee el snapshot actual de localStorage para un usuario.
   * @param {string} userId
   * @returns {{ transactions: Array, categories: Array, budgets: Object }}
   */
  static #readLocalSnapshot(userId) {
    const p = FirestoreStore.#LS_PREFIX;
    const rawCategories = localStorage.getItem(`${p}:${userId}:categories`);
    const rawTransactions = localStorage.getItem(`${p}:${userId}:transactions`);
    const rawBudgets = localStorage.getItem(`${p}:${userId}:budgets`);

    if (rawCategories === null && rawTransactions === null && rawBudgets === null) {
      return null;
    }

    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
    } catch {}
    return {
      categories:   JSON.parse(rawCategories   || '[]'),
      transactions: JSON.parse(rawTransactions || '[]'),
      budgets:      JSON.parse(rawBudgets      || '{}'),
      settings:     settings
    };
  }

  static #writeLocalSnapshot(userId, snapshot) {
    const p = FirestoreStore.#LS_PREFIX;
    localStorage.setItem(`${p}:${userId}:transactions`, JSON.stringify(snapshot.transactions || []));
    localStorage.setItem(`${p}:${userId}:categories`,   JSON.stringify(snapshot.categories   || []));
    localStorage.setItem(`${p}:${userId}:budgets`,      JSON.stringify(snapshot.budgets      || {}));
    if (snapshot.settings && typeof snapshot.settings === 'object' && Object.keys(snapshot.settings).length > 0) {
      try {
        const localTheme = localStorage.getItem('theme');
        const activeTheme = localTheme || snapshot.settings.theme || 'dark';
        snapshot.settings.theme = activeTheme;
        localStorage.setItem('finanzapp:settings:v1', JSON.stringify(snapshot.settings));
        localStorage.setItem('theme', activeTheme);
        document.documentElement.setAttribute('data-theme', activeTheme);
        if (document.body) document.body.setAttribute('data-theme', activeTheme);
      } catch {}
    }
  }


  static #snapshotsEqual(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  /**
   * Inicia la suscripción a cambios remotos del usuario autenticado.
   * Emite `finanzapp:data:updated` cuando llegan datos diferentes desde otro dispositivo.
   */
  #subscribeToRemote(userId) {
    if (this.#unsubscribe || !window.FirestoreDB?.initialized || userId === 'guest') return;

    this.#unsubscribe = window.FirestoreDB.subscribeToUserData((remoteData) => {
      if (!remoteData) return;

      // Ignorar snapshots que son eco de nuestro propio guardado reciente
      const now = Date.now();
      if (now - this.#lastLocalSaveAt < FirestoreStore.#OWN_SAVE_MARGIN_MS) return;

      const localSnapshot = FirestoreStore.#readLocalSnapshot(userId);
      if (FirestoreStore.#snapshotsEqual(localSnapshot, remoteData)) return;

      FirestoreStore.#writeLocalSnapshot(userId, remoteData);
      window.dispatchEvent(new CustomEvent('finanzapp:data:updated', {
        detail: remoteData
      }));
      if (window.DataEvents) {
        window.DataEvents.emit('datos:actualizados', remoteData);
        window.DataEvents.emit('transactionChanged', { action: 'remoteSync', remoteData });
      }
    });
  }


  unsubscribe() {
    if (typeof this.#unsubscribe === 'function') {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }

  /** @override */
  async load() {
    // Esperar a que Firebase Auth resuelva el usuario antes de intentar cargar.
    // waitForAuth() solo resuelve con un UID cuando hay sesión Firebase real —
    // devuelve null si Firebase no tiene usuario (no hay fallback a localStorage).
    let userId = 'guest';
    let hasFirebaseSession = false; // ¿Firebase Auth confirmó al usuario?

    if (window.FirestoreDB && window.firebase) {
      try {
        const uid = await window.FirestoreDB.waitForAuth(5000);
        if (uid) {
          userId = uid;
          hasFirebaseSession = true;
          // Asegurar que FirestoreDB esté inicializado con el UID verificado por Firebase
          if (!window.FirestoreDB.initialized) {
            await window.FirestoreDB.init(userId);
          }
          window.FirestoreDB.setCurrentUser(userId);
          console.log('[DataStore] Sesión Firebase confirmada para uid:', userId);
        } else {
          // No hay sesión Firebase real — operar solo en modo local
          userId = _getUserId();
          console.warn('[DataStore] Sin sesión Firebase — modo local para uid:', userId);
        }
      } catch {
        userId = _getUserId();
      }
    } else {
      userId = _getUserId();
    }

    // Sin sesión Firebase verificada → solo localStorage (acceder Firestore sin token
    // causaría "Missing or insufficient permissions").
    if (!hasFirebaseSession || !window.FirestoreDB) {
      return FirestoreStore.#readLocalSnapshot(userId);
    }

    try {
      // Suscribirse a cambios remotos
      this.#subscribeToRemote(userId);

      // Intentar cargar desde Firestore
      const remoteData = await window.FirestoreDB.loadAll();

      if (remoteData !== null) {
        FirestoreStore.#writeLocalSnapshot(userId, remoteData);
        return remoteData;
      }

      // Sin datos remotos en Firestore — usar snapshot local si existe
      const localSnapshot = FirestoreStore.#readLocalSnapshot(userId);
      if (localSnapshot !== null) {
        // Subir datos locales a Firestore para sincronizar
        try {
          await window.FirestoreDB.saveAll(localSnapshot);
        } catch (e) {
          console.warn('[DataStore] No se pudo migrar datos locales a Firestore:', e);
        }
        return localSnapshot;
      }

      return null;
    } catch (err) {
      console.error('[DataStore] Error cargando desde Firestore:', err);
      return FirestoreStore.#readLocalSnapshot(userId);
    }
  }

  /** @override */
  async save(state) {
    try {
      // Preferir el UID resuelto por FirestoreDB (via waitForAuth en load()) sobre
      // la lectura síncrona de localStorage, que puede no estar actualizada aún.
      const userId = window.FirestoreDB?.currentUserId || _getUserId();

      // Guardar copia local primero (siempre, como respaldo)
      FirestoreStore.#writeLocalSnapshot(userId, state);
      this.#lastLocalSaveAt = Date.now();

      // Sincronizar con Firestore
      if (window.FirestoreDB && userId !== 'guest') {
        // Si FirestoreDB no está inicializado o no tiene usuario, intentarlo ahora.
        // Esto cubre el caso donde persist() se llama antes de que boot() complete.
        if (!window.FirestoreDB.initialized || !window.FirestoreDB.currentUserId) {
          try {
            const uid = await window.FirestoreDB.waitForAuth(3000);
            const uidToUse = uid || userId;
            await window.FirestoreDB.init(uidToUse);
            window.FirestoreDB.setCurrentUser(uidToUse);
            console.log('[DataStore] FirestoreDB inicializado en save() con uid:', uidToUse);
          } catch (initErr) {
            console.warn('[DataStore] No se pudo inicializar FirestoreDB en save():', initErr);
          }
        }

        if (window.FirestoreDB.initialized && window.FirestoreDB.currentUserId) {
          try {
            await window.FirestoreDB.saveAll(state);
            console.log('[DataStore] Datos guardados en Firestore para uid:', window.FirestoreDB.currentUserId);
          } catch (err) {
            console.error('[DataStore] Error sincronizando con Firestore:', err);
          }
        } else {
          console.warn('[DataStore] save() omitido en Firestore: FirestoreDB no listo. Solo guardado localmente.');
        }
      }
    } catch (err) {
      console.error('[DataStore] Error guardando datos en FirestoreStore:', err);
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