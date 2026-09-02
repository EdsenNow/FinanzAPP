class FirestoreDB {
  constructor() {
    this.db = null;
    this.currentUserId = null;
    this.initialized = false;
    this._unsubscribeSnapshot = null;
  }

  /**
   * Garantiza que Firebase App y App Check estén inicializados juntos.
   * Se invoca automáticamente antes de cualquier operación de Auth o Firestore.
   * @returns {boolean}
   */
  static ensureFirebaseInitialized() {
    if (!window.firebase) return false;

    const config = window.FIREBASE_CONFIG || window.APP_CONFIG?.firebaseConfig;
    if (!config || !config.apiKey) return false;

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    if (!FirestoreDB._appCheckActivated && firebase.appCheck) {
      FirestoreDB._appCheckActivated = true;
      try {
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocalhost) {
          try {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          } catch {}
        }

        const appCheckEnabled = window.APP_CONFIG?.appCheckEnabled === true;
        const siteKey = window.APP_CONFIG?.recaptchaSiteKey;
        if (appCheckEnabled && siteKey && !isLocalhost) {
          let provider = null;
          if (firebase.appCheck.ReCaptchaEnterpriseProvider) {
            provider = new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey);
          } else if (firebase.appCheck.ReCaptchaV3Provider) {
            provider = new firebase.appCheck.ReCaptchaV3Provider(siteKey);
          }
          if (provider) {
            firebase.appCheck().activate(provider, true);
          }
        }
      } catch (e) {
        // Silencioso en producción
      }
    }
    return true;

  }


  ensureFirebaseInitialized() {
    return FirestoreDB.ensureFirebaseInitialized();
  }

  /**
   * Espera a que Firebase Auth resuelva el estado de autenticación.
   * Devuelve el UID del usuario autenticado, o null si no hay sesión real.
   *
   * IMPORTANTE: NO resuelve en la primera emisión null de onAuthStateChanged —
   * Firebase siempre emite null primero mientras restaura la sesión desde IndexedDB.
   * Solo resuelve cuando:
   *   1. Un usuario real (con UID) aparece en onAuthStateChanged.
   *   2. El timer expira → devuelve null (sin fallback a localStorage, porque
   *      un UID de localStorage sin token Firebase real causa "Missing or insufficient permissions").
   *
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<string|null>}
   */
  waitForAuth(timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (!FirestoreDB.ensureFirebaseInitialized()) { resolve(null); return; }

      // Si Firebase Auth ya tiene un usuario resuelto, devolverlo inmediatamente.
      try {
        const current = firebase.auth().currentUser;
        if (current && current.uid) {
          resolve(current.uid);
          return;
        }
      } catch {}

      let unsubscribe;
      let resolved = false;

      const doResolve = (uid) => {
        if (resolved) return;
        resolved = true;
        try { if (typeof unsubscribe === 'function') unsubscribe(); } catch {}
        resolve(uid);
      };

      const timer = setTimeout(() => {
        console.warn('[FirestoreDB] waitForAuth timeout — sin sesión Firebase activa.');
        doResolve(null);
      }, timeoutMs);

      try {
        unsubscribe = firebase.auth().onAuthStateChanged((user) => {
          if (user && user.uid) {
            clearTimeout(timer);
            doResolve(user.uid);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        doResolve(null);
      }
    });
  }

  async init(userId = null) {
    try {
      if (!FirestoreDB.ensureFirebaseInitialized()) return false;

      this.db = firebase.firestore();
      this.initialized = true;

      if (userId) {
        this.currentUserId = userId;
      } else {
        const auth = firebase.auth();
        if (auth.currentUser) {
          this.currentUserId = auth.currentUser.uid;
        } else {
          const authUser = localStorage.getItem('authUser');
          if (authUser) {
            try { this.currentUserId = JSON.parse(authUser).uid; } catch {}
          }
        }
      }
      return true;
    } catch (error) {
      console.error('[FirestoreDB] init error:', error);
      return false;
    }
  }


  setCurrentUser(userId) {
    this.currentUserId = userId;
  }

  async ensureUserContext() {
    if (!this.initialized) await this.init();
    if (!this.currentUserId) {
      // Esperar a que Firebase Auth resuelva el usuario (cubre el caso
      // en que currentUser es null momentáneamente al inicio de la sesión)
      const uid = await this.waitForAuth(4000);
      if (uid) this.currentUserId = uid;
    }
    return !!(this.initialized && this.currentUserId);
  }

  _userDoc() {
    if (!this.db || !this.currentUserId) throw new Error('FirestoreDB no inicializado o sin usuario.');
    return this.db.collection('users').doc(this.currentUserId);
  }

  /**
   * Guarda TODO el estado del usuario en un único documento Firestore.
   * Esto garantiza consistencia y sincronización entre dispositivos.
   */
  async saveAll(data) {
    try {
      if (!await this.ensureUserContext()) return false;

      const categories = (data.categories || []).map(c => ({
        ...c,
        transactions: (c.transactions || []).map(t => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : (t.date || null)
        }))
      }));

      const transactions = (data.transactions || []).map(t => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : (t.date || null)
      }));

      await this._userDoc().set({
        categories,
        transactions,
        budgets: data.budgets || {},
        settings: data.settings || {},
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('[FirestoreDB] saveAll error:', error);
      return false;
    }
  }

  /**
   * Carga TODO el estado del usuario desde Firestore.
   */
  async loadAll() {
    try {
      if (!await this.ensureUserContext()) return null;

      const userRef = this._userDoc();
      const doc = await userRef.get();
      let data = doc.exists ? doc.data() : null;

      // Si el documento principal NO existe en absoluto, intentar migrar de subcolecciones antiguas
      if (!doc.exists) {
        try {
          const catsSnapshot = await userRef.collection('categories').get();
          const txSnapshot = await userRef.collection('transactions').get();
          
          if (!catsSnapshot.empty || !txSnapshot.empty) {
            const oldCategories = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const oldTx = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Anidar transacciones dentro de las categorías correspondientes para la nueva estructura
            const mergedCategories = oldCategories.map(c => {
              const cTxs = oldTx.filter(t => t.categoryId === c.id || t.categoryId === c.name);
              return { ...c, transactions: cTxs };
            });

            data = {
              categories: mergedCategories,
              transactions: oldTx,
              budgets: {},
              settings: {}
            };
            
            // Guardar inmediatamente en la nueva estructura para sellar la migración
            await this.saveAll(data);
          }
        } catch (migErr) {
          console.error('[FirestoreDB] Error migrando subcolecciones:', migErr);
        }
      }

      if (!data) return null;

      return {
        categories: Array.isArray(data.categories) ? data.categories : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        budgets: data.budgets || {},
        settings: data.settings || {}
      };
    } catch (error) {
      console.error('[FirestoreDB] loadAll error:', error);
      return null;
    }
  }

  // Alias para compatibilidad con código existente
  async loadAllUserData() {
    const result = await this.loadAll();
    return result || { transactions: [], categories: [], budgets: {}, settings: {} };
  }

  async saveSettings(settings) {
    try {
      if (!await this.ensureUserContext()) return false;
      await this._userDoc().set({ settings }, { merge: true });
      return true;
    } catch { return false; }
  }

  async loadSettings() {
    try {
      if (!await this.ensureUserContext()) return {};
      const doc = await this._userDoc().get();
      return doc.exists ? (doc.data().settings || {}) : {};
    } catch { return {}; }
  }

  /**
   * Suscribe a cambios del documento del usuario en Firestore.
   * @param {function} callback - recibe { categories, transactions, budgets, settings } o null si no existe.
   * @returns {function} Función para cancelar la suscripción.
   */
  subscribeToUserData(callback) {
    if (!this.db || !this.currentUserId) {
      console.warn('[FirestoreDB] No se puede suscribir: falta db o currentUserId');
      return () => {};
    }
    this.unsubscribeFromUserData();

    this._unsubscribeSnapshot = this._userDoc().onSnapshot(
      (doc) => {
        if (!doc.exists) {
          callback(null);
          return;
        }
        const data = doc.data();
        callback({
          categories: data.categories || [],
          transactions: data.transactions || [],
          budgets: data.budgets || {},
          settings: data.settings || {}
        });
      },
      (error) => {
        console.error('[FirestoreDB] onSnapshot error:', error);
      }
    );

    return this._unsubscribeSnapshot;
  }

  unsubscribeFromUserData() {
    if (typeof this._unsubscribeSnapshot === 'function') {
      this._unsubscribeSnapshot();
      this._unsubscribeSnapshot = null;
    }
  }

  async saveImapSettings(settings) {
    if (!await this.ensureUserContext()) {
      throw new Error('No hay sesión de usuario activa en Firestore');
    }
    const dataToSave = {
      email: settings.email || '',
      appPassword: settings.appPassword || '',
      targetSenders: settings.targetSenders || [],
      updatedAt: new Date().toISOString()
    };

    await this._userDoc().set({
      imapSettings: dataToSave
    }, { merge: true });

    if (this.currentUserId) {
      localStorage.setItem(`finanzapp:imap_settings:${this.currentUserId}`, JSON.stringify(dataToSave));
    }
    return true;
  }

  async getImapSettings() {
    if (!await this.ensureUserContext()) {
      const authUser = localStorage.getItem('authUser');
      const uid = authUser ? JSON.parse(authUser).uid : null;
      if (uid) {
        const cached = localStorage.getItem(`finanzapp:imap_settings:${uid}`);
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }

    try {
      const doc = await this._userDoc().get();
      if (doc.exists && doc.data()?.imapSettings) {
        return doc.data().imapSettings;
      }
    } catch (e) {
      console.warn('[FirestoreDB] Error reading imapSettings from Firestore:', e);
    }

    if (this.currentUserId) {
      const cached = localStorage.getItem(`finanzapp:imap_settings:${this.currentUserId}`);
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }

  // Métodos stub de compatibilidad (el guardado real usa saveAll)
  async saveTransactions(transactions) { return true; }
  async loadTransactions() { return []; }
  async saveCategories(categories) { return true; }
  async loadCategories() { return []; }
  async saveBudgets(budgets) { return true; }
  async loadBudgets() { return {}; }
  async migrateFromLocalStorage() { return true; }
  async syncChange(type, data) { return true; }
}

window.FirestoreDB = window.FirestoreDB || new FirestoreDB();
