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

  _txCollection() {
    return this._userDoc().collection('transactions');
  }

  /**
   * Guarda transacciones en lotes de hasta 450 documentos (límite de Firestore: 500 ops/batch).
   * @param {Array<Object>} transactions
   */
  async _batchSaveTransactions(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) return;
    const txCol = this._txCollection();
    const BATCH_SIZE = 450;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const chunk = transactions.slice(i, i + BATCH_SIZE);
      const batch = this.db.batch();

      for (const t of chunk) {
        const txId = t.id ? String(t.id) : (t.firestoreId || this.db.collection('temp').doc().id);
        const cleanTx = {
          id: txId,
          amount: Number(t.amount) || 0,
          categoryId: t.categoryId || null,
          categoryName: t.category || t.categoryName || '',
          type: t.type || 'expense',
          description: t.description || t.note || '',
          date: t.date instanceof Date ? t.date.toISOString() : (t.date || new Date().toISOString()),
          source: t.source || 'manual',
          updatedAt: new Date().toISOString()
        };
        batch.set(txCol.doc(txId), cleanTx, { merge: true });
      }

      await batch.commit();
    }
  }

  /**
   * Guarda o actualiza una transacción individual en la subcolección.
   * @param {Object} tx
   */
  async saveTransaction(tx) {
    if (!await this.ensureUserContext()) return false;
    if (!tx || !tx.id) return false;
    const txId = String(tx.id);
    const cleanTx = {
      ...tx,
      id: txId,
      amount: Number(tx.amount) || 0,
      date: tx.date instanceof Date ? tx.date.toISOString() : (tx.date || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    };
    await this._txCollection().doc(txId).set(cleanTx, { merge: true });
    return true;
  }

  /**
   * Elimina una transacción individual de la subcolección.
   * @param {string} txId
   */
  async deleteTransaction(txId) {
    if (!await this.ensureUserContext()) return false;
    if (!txId) return false;
    await this._txCollection().doc(String(txId)).delete();
    return true;
  }

  /**
   * Guarda el estado del usuario.
   * Guarda metadatos y categorías en users/{uid} y las transacciones en la subcolección
   * para evitar el límite duro de 1 MB por documento de Firestore.
   */
  async saveAll(data) {
    try {
      if (!await this.ensureUserContext()) return false;

      // Guardar categorías limpias en users/{uid} (sin el array redundante masivo de transacciones)
      const categoriesClean = (data.categories || []).map(c => {
        const { transactions, ...rest } = c;
        return rest;
      });

      const transactions = (data.transactions || []).map(t => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : (t.date || null)
      }));

      // 1. Guardar documento raíz sin exceder el límite de 1 MB
      await this._userDoc().set({
        categories: categoriesClean,
        budgets: data.budgets || {},
        settings: data.settings || {},
        transactionsCount: transactions.length,
        transactionsMigratedToSubcollection: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Sincronizar transacciones a la subcolección en lotes seguros
      if (transactions.length > 0) {
        await this._batchSaveTransactions(transactions);
      }

      return true;
    } catch (error) {
      console.error('[FirestoreDB] saveAll error:', error);
      return false;
    }
  }

  /**
   * Carga todo el estado del usuario desde Firestore.
   * Consulta la subcolección de transacciones con fallback y migración transparente
   * de cuentas legadas almacenadas en el documento raíz.
   */
  async loadAll() {
    try {
      if (!await this.ensureUserContext()) return null;

      const userRef = this._userDoc();
      const doc = await userRef.get();
      let data = doc.exists ? doc.data() : null;

      if (!data && !doc.exists) return null;

      // 1. Intentar cargar transacciones desde la subcolección
      const txCollection = this._txCollection();
      const txSnapshot = await txCollection.get();

      let allTransactions = [];

      if (!txSnapshot.empty) {
        allTransactions = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } else if (data && Array.isArray(data.transactions) && data.transactions.length > 0) {
        // Subcolección vacía pero existen transacciones en el documento raíz:
        // Realizar migración transparente en segundo plano sin bloquear al usuario
        allTransactions = data.transactions;
        this._batchSaveTransactions(allTransactions).then(() => {
          console.log(`[FirestoreDB] Migradas exitosamente ${allTransactions.length} transacciones a la subcolección.`);
          userRef.set({
            transactionsMigratedToSubcollection: true,
            transactionsCount: allTransactions.length
          }, { merge: true }).catch(() => {});
        }).catch(err => {
          console.warn('[FirestoreDB] Error en migración de fondo a subcolección:', err);
        });
      }

      // Reensamblar transacciones en sus categorías para total compatibilidad con la UI existente
      const rawCategories = Array.isArray(data?.categories) ? data.categories : [];
      const categories = rawCategories.map(c => {
        const cTxs = allTransactions.filter(t => String(t.categoryId) === String(c.id) || t.categoryId === c.name);
        return {
          ...c,
          transactions: cTxs
        };
      });

      return {
        categories,
        transactions: allTransactions,
        budgets: data?.budgets || {},
        settings: data?.settings || {},
        gmail: data?.gmail || null,
        imapSettings: data?.imapSettings || data?.imap || null
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

  /**
   * Suscribe en tiempo real a la subcolección de transacciones (/users/{uid}/transactions).
   * @param {function} callback - Recibe (transactions, changes)
   * @returns {function} Función para desuscribirse.
   */
  subscribeToTransactions(callback) {
    if (!this.db || !this.currentUserId) {
      console.warn('[FirestoreDB] No se puede suscribir a transacciones: falta db o currentUserId');
      return () => {};
    }
    this.unsubscribeFromTransactions();

    try {
      this._unsubscribeTransactionsSnapshot = this._txCollection().onSnapshot(
        (snap) => {
          const txs = snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d,
              id: doc.id,
              date: (d.date && typeof d.date === 'string') ? new Date(d.date) : d.date
            };
          });

          // Actualizar snapshot local para carga instantánea
          try {
            if (this.currentUserId) {
              localStorage.setItem(`finanzapp:data:v1:${this.currentUserId}:transactions`, JSON.stringify(txs));
            }
          } catch {}

          if (typeof callback === 'function') {
            callback(txs, snap.docChanges());
          }

          if (window.DataEvents && typeof window.DataEvents.emit === 'function') {
            window.DataEvents.emit('transactions:updated', { transactions: txs, changes: snap.docChanges() });
          }
        },
        (err) => {
          console.error('[FirestoreDB] onSnapshot transactions error:', err);
        }
      );
    } catch (e) {
      console.warn('[FirestoreDB] Error suscribiendo a transacciones:', e);
    }

    return this._unsubscribeTransactionsSnapshot || (() => {});
  }

  unsubscribeFromTransactions() {
    if (typeof this._unsubscribeTransactionsSnapshot === 'function') {
      this._unsubscribeTransactionsSnapshot();
      this._unsubscribeTransactionsSnapshot = null;
    }
  }

  unsubscribeAll() {
    this.unsubscribeFromUserData();
    this.unsubscribeFromTransactions();
  }

  async saveImapSettings(settings) {
    if (!await this.ensureUserContext()) {
      throw new Error('No hay sesión de usuario activa');
    }

    const email = settings.email || '';
    const appPassword = settings.appPassword || '';
    const targetSenders = settings.targetSenders || [];

    // Limpiar contraseñas en texto plano de localStorage por seguridad
    if (this.currentUserId) {
      try {
        localStorage.removeItem(`finanzapp:imap_settings:${this.currentUserId}`);
      } catch {}
    }

    // Usar SyncAPI para guardar de forma cifrada en la colección privada userSecrets/{uid}
    if (window.SyncAPI && typeof window.SyncAPI.saveImapCredentials === 'function') {
      try {
        const result = await window.SyncAPI.saveImapCredentials({ email, appPassword, targetSenders });
        return result.success !== false;
      } catch (err) {
        console.warn('[FirestoreDB] saveImapCredentials vía SyncAPI falló, usando fallback Firestore:', err);
      }
    }

    // Fallback: guardar únicamente metadatos no sensibles en Firestore (SIN appPassword)
    // Fallback: guardar en Firestore para no interrumpir el flujo del usuario si el backend no está disponible
    const imapData = {
      configured: true,
      email,
      targetSenders,
      updatedAt: new Date().toISOString()
    };
    if (appPassword) imapData.appPassword = appPassword;

    await this._userDoc().set({
      imapSettings: imapData,
      imap: imapData
    }, { merge: true });

    return true;
  }

  async getImapSettings() {
    // 1. Intentar consultar el estado seguro vía SyncAPI
    if (window.SyncAPI && typeof window.SyncAPI.getImapStatus === 'function') {
      try {
        const status = await window.SyncAPI.getImapStatus();
        if (status) return status;
      } catch (e) {
        console.warn('[FirestoreDB] getImapStatus vía SyncAPI falló, usando Firestore:', e);
      }
    }

    if (!await this.ensureUserContext()) {
      return null;
    }

    // 2. Fallback: leer metadatos de configuración desde el documento del usuario
    try {
      const doc = await this._userDoc().get();
      if (doc.exists) {
        const data = doc.data();
        const imap = data?.imapSettings || data?.imap;
        if (imap) {
          return {
            configured: !!(imap.configured || imap.appPassword || imap.email),
            email: imap.email || '',
            targetSenders: imap.targetSenders || [],
            lastSyncAt: imap.lastSyncAt || null
          };
        }
      }
    } catch (e) {
      console.warn('[FirestoreDB] Error reading imapSettings from Firestore:', e);
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
