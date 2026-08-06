class FirestoreDB {
  constructor() {
    this.db = null;
    this.currentUserId = null;
    this.initialized = false;
  }

  async init(userId = null) {
    try {
      if (!window.firebase) return false;

      const config = window.FIREBASE_CONFIG || window.APP_CONFIG?.firebaseConfig;
      if (!config || !config.apiKey) return false;

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

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
      try {
        const raw = localStorage.getItem('authUser');
        if (raw && raw !== 'guest') {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) this.currentUserId = parsed.uid;
        }
      } catch {}
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
        updatedAt: new Date().toISOString()
      }, { merge: false });

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

      // Si no existe data o las categorías están vacías, intentar recuperar de las subcolecciones antiguas (MIGRACIÓN A PRUEBA DE FALLOS)
      if (!data || !data.categories || data.categories.length === 0) {
        console.log('[FirestoreDB] No hay datos en documento raíz, buscando en subcolecciones antiguas...');
        try {
          const catsSnapshot = await userRef.collection('categories').get();
          const txSnapshot = await userRef.collection('transactions').get();
          
          if (!catsSnapshot.empty || !txSnapshot.empty) {
            console.log('[FirestoreDB] Subcolecciones antiguas encontradas! Migrando...');
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
              budgets: data?.budgets || {}
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
        categories: data.categories || [],
        transactions: data.transactions || [],
        budgets: data.budgets || {}
      };
    } catch (error) {
      console.error('[FirestoreDB] loadAll error:', error);
      return null;
    }
  }

  // Alias para compatibilidad con código existente
  async loadAllUserData() {
    const result = await this.loadAll();
    return result || { transactions: [], categories: [], budgets: {} };
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
