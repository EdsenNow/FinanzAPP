class FirestoreDB {
  constructor() {
    this.db = null;
    this.currentUserId = null;
    this.initialized = false;
  }

  async init(userId = null) {
    try {
      if (!window.firebase) {
        return false;
      }

      const config = window.FIREBASE_CONFIG || window.APP_CONFIG?.firebaseConfig;
      if (!config || !config.apiKey) {
        return false;
      }

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
            try {
              const parsed = JSON.parse(authUser);
              this.currentUserId = parsed.uid;
            } catch (error) {
            }
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async ensureUserContext() {
    if (!this.initialized) {
      const ok = await this.init();
      if (!ok) return false;
    }

    let resolved = false;
    try {
      const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
      const authUser = auth?.currentUser;

      if (authUser?.uid) {
        if (this.currentUserId !== authUser.uid) {
          this.currentUserId = authUser.uid;
        }
        resolved = true;
      } else if (this.currentUserId) {
        resolved = true;
      } else {
        const raw = localStorage.getItem('authUser');
        if (raw && raw !== 'guest') {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.uid) {
              this.currentUserId = parsed.uid;
              resolved = true;
            }
          } catch { }
        }
      }
    } catch (error) {
    }

    return resolved;
  }

  setCurrentUser(userId) {
    this.currentUserId = userId;
  }

  getUserCollection(collection) {
    if (!this.currentUserId) {
      throw new Error('No hay usuario autenticado. Debes iniciar sesión primero.');
    }
    return this.db.collection('users').doc(this.currentUserId).collection(collection);
  }

  async saveTransactions(transactions) {
    try {
      if (!await this.ensureUserContext()) {
        return false;
      }

      const batch = this.db.batch();
      const transactionsRef = this.getUserCollection('transactions');

      const snapshot = await transactionsRef.get();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));

      transactions.forEach(transaction => {
        const docRef = transactionsRef.doc(transaction.id.toString());
        batch.set(docRef, transaction);
      });

      await batch.commit();
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadTransactions() {
    try {
      if (!await this.ensureUserContext()) {
        return [];
      }

      const transactionsRef = this.getUserCollection('transactions');
      const snapshot = await transactionsRef.get();

      const transactions = [];
      snapshot.forEach(doc => {
        transactions.push(doc.data());
      });

      return transactions;
    } catch (error) {
      return [];
    }
  }

  async saveCategories(categories) {
    try {
      if (!await this.ensureUserContext()) {
        return false;
      }

      const batch = this.db.batch();
      const categoriesRef = this.getUserCollection('categories');

      const snapshot = await categoriesRef.get();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));

      categories.forEach(category => {
        const docRef = categoriesRef.doc(category.id.toString());
        batch.set(docRef, category);
      });

      await batch.commit();
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadCategories() {
    try {
      if (!await this.ensureUserContext()) {
        return [];
      }

      const categoriesRef = this.getUserCollection('categories');
      const snapshot = await categoriesRef.get();

      const categories = [];
      snapshot.forEach(doc => {
        categories.push(doc.data());
      });

      return categories;
    } catch (error) {
      return [];
    }
  }

  async saveBudgets(budgets) {
    try {
      if (!await this.ensureUserContext()) {
        return false;
      }

      const budgetsRef = this.getUserCollection('budgets');
      await budgetsRef.doc('data').set({ budgets });

      return true;
    } catch (error) {
      return false;
    }
  }

  async loadBudgets() {
    try {
      if (!await this.ensureUserContext()) {
        return {};
      }

      const budgetsRef = this.getUserCollection('budgets');
      const doc = await budgetsRef.doc('data').get();

      if (doc.exists) {
        const data = doc.data();
        return data.budgets || {};
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  async saveSettings(settings) {
    try {
      if (!await this.ensureUserContext()) {
        return false;
      }

      const userRef = this.db.collection('users').doc(this.currentUserId);
      await userRef.set({ settings }, { merge: true });

      return true;
    } catch (error) {
      return false;
    }
  }

  async loadSettings() {
    try {
      if (!await this.ensureUserContext()) {
        return {};
      }

      const userRef = this.db.collection('users').doc(this.currentUserId);
      const doc = await userRef.get();

      if (doc.exists) {
        const data = doc.data();
        return data.settings || {};
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  async migrateFromLocalStorage() {
    try {
      const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const categories = JSON.parse(localStorage.getItem('categories') || '[]');
      const budgets = JSON.parse(localStorage.getItem('budgets') || '{}');

      await this.saveTransactions(transactions);
      await this.saveCategories(categories);
      await this.saveBudgets(budgets);

      return true;
    } catch (error) {
      return false;
    }
  }

  async loadAllUserData() {
    try {
      if (!await this.ensureUserContext()) {
        return { transactions: [], categories: [], budgets: {} };
      }

      const [transactions, categories, budgets] = await Promise.all([
        this.loadTransactions(),
        this.loadCategories(),
        this.loadBudgets()
      ]);

      localStorage.setItem('transactions', JSON.stringify(transactions));
      localStorage.setItem('categories', JSON.stringify(categories));
      localStorage.setItem('budgets', JSON.stringify(budgets));

      return { transactions, categories, budgets };
    } catch (error) {
      return { transactions: [], categories: [], budgets: {} };
    }
  }

  async syncChange(type, data) {
    try {
      if (!await this.ensureUserContext()) {
        return;
      }

      switch (type) {
        case 'transactions':
          await this.saveTransactions(data);
          break;
        case 'categories':
          await this.saveCategories(data);
          break;
        case 'budgets':
          await this.saveBudgets(data);
          break;
        default:
      }
    } catch (error) {
    }
  }
}

window.FirestoreDB = window.FirestoreDB || new FirestoreDB();
