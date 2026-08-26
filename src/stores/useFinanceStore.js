import { create } from 'zustand';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../services/firebase';

const DEFAULT_CATEGORIES = [
  { id: 'cat_alimentacion', name: 'Alimentación', fixedType: 'expense', isPinned: false, order: 0, transactions: [] },
  { id: 'cat_transporte', name: 'Transporte', fixedType: 'expense', isPinned: false, order: 1, transactions: [] },
  { id: 'cat_vivienda', name: 'Vivienda', fixedType: 'expense', isPinned: false, order: 2, transactions: [] },
  { id: 'cat_servicios', name: 'Servicios', fixedType: 'expense', isPinned: false, order: 3, transactions: [] },
  { id: 'cat_salario', name: 'Salario / Ingresos', fixedType: 'income', isPinned: true, order: 4, transactions: [] }
];

function getStoredLocalData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveLocalData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

export const useFinanceStore = create((set, get) => ({
  categories: getStoredLocalData('finanzapp:categories:v1', DEFAULT_CATEGORIES),
  budgets: getStoredLocalData('finanzapp:budgets:v1', []),
  settings: getStoredLocalData('finanzapp:settings:v1', { currency: 'USD', currencySymbol: '$', theme: 'dark' }),
  filters: { year: null, month: null, search: '' },
  lastDeletedTransaction: null,
  loading: false,

  // Load from Firestore or LocalStorage for current user
  loadUserData: async (userId, isGuest = false) => {
    if (!userId || isGuest) {
      const localCats = getStoredLocalData('finanzapp:categories:v1', DEFAULT_CATEGORIES);
      const localBudgets = getStoredLocalData('finanzapp:budgets:v1', []);
      set({ categories: localCats, budgets: localBudgets, loading: false });
      return;
    }

    set({ loading: true });
    try {
      // 1. Categories subcollection
      const catsSnap = await getDocs(collection(db, `users/${userId}/categories`));
      let loadedCats = [];
      catsSnap.forEach((docSnap) => {
        loadedCats.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (loadedCats.length === 0) {
        // Seed default categories
        loadedCats = DEFAULT_CATEGORIES;
        const batch = writeBatch(db);
        loadedCats.forEach((cat) => {
          batch.set(doc(db, `users/${userId}/categories`, cat.id), cat);
        });
        await batch.commit();
      }

      // Sort categories
      loadedCats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // 2. Budgets subcollection
      const budgetsSnap = await getDocs(collection(db, `users/${userId}/budgets`));
      const loadedBudgets = [];
      budgetsSnap.forEach((docSnap) => {
        loadedBudgets.push({ id: docSnap.id, ...docSnap.data() });
      });

      set({ categories: loadedCats, budgets: loadedBudgets, loading: false });
      saveLocalData('finanzapp:categories:v1', loadedCats);
      saveLocalData('finanzapp:budgets:v1', loadedBudgets);
    } catch (err) {
      console.warn('Error loading Firestore data, falling back to local:', err);
      set({ loading: false });
    }
  },

  // Category Actions
  addCategory: async (category, userId, isGuest) => {
    const id = category.id || `cat_${Date.now()}`;
    const newCat = { ...category, id, transactions: category.transactions || [], order: get().categories.length };
    const updated = [...get().categories, newCat];
    
    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        await setDoc(doc(db, `users/${userId}/categories`, id), newCat);
      } catch (e) {
        console.warn('Failed saving category to Firestore:', e);
      }
    }
    return newCat;
  },

  updateCategory: async (id, updates, userId, isGuest) => {
    const updated = get().categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        const cat = updated.find((c) => c.id === id);
        if (cat) await setDoc(doc(db, `users/${userId}/categories`, id), cat, { merge: true });
      } catch (e) {
        console.warn('Failed updating category in Firestore:', e);
      }
    }
  },

  deleteCategory: async (id, userId, isGuest) => {
    const updated = get().categories.filter((c) => c.id !== id);
    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        await deleteDoc(doc(db, `users/${userId}/categories`, id));
      } catch (e) {
        console.warn('Failed deleting category from Firestore:', e);
      }
    }
  },

  reorderCategories: async (newOrderCategories, userId, isGuest) => {
    const reordered = newOrderCategories.map((cat, index) => ({ ...cat, order: index }));
    set({ categories: reordered });
    saveLocalData('finanzapp:categories:v1', reordered);

    if (userId && !isGuest) {
      try {
        const batch = writeBatch(db);
        reordered.forEach((cat) => {
          batch.set(doc(db, `users/${userId}/categories`, cat.id), { order: cat.order }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Failed syncing category reorder to Firestore:', e);
      }
    }
  },

  // Transaction Actions
  addTransaction: async (categoryId, transaction, userId, isGuest) => {
    const txId = transaction.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newTx = { ...transaction, id: txId, amount: Number(transaction.amount) };

    const updated = get().categories.map((cat) => {
      if (cat.id === categoryId) {
        return { ...cat, transactions: [newTx, ...(cat.transactions || [])] };
      }
      return cat;
    });

    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        const targetCat = updated.find((c) => c.id === categoryId);
        if (targetCat) await setDoc(doc(db, `users/${userId}/categories`, categoryId), targetCat);
      } catch (e) {
        console.warn('Failed saving transaction to Firestore:', e);
      }
    }
    return newTx;
  },

  updateTransaction: async (categoryId, transactionId, updates, userId, isGuest) => {
    const updated = get().categories.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          transactions: (cat.transactions || []).map((tx) =>
            tx.id === transactionId ? { ...tx, ...updates, amount: Number(updates.amount ?? tx.amount) } : tx
          )
        };
      }
      return cat;
    });

    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        const targetCat = updated.find((c) => c.id === categoryId);
        if (targetCat) await setDoc(doc(db, `users/${userId}/categories`, categoryId), targetCat);
      } catch (e) {
        console.warn('Failed updating transaction in Firestore:', e);
      }
    }
  },

  deleteTransaction: async (categoryId, transactionId, userId, isGuest) => {
    let deletedTx = null;
    const updated = get().categories.map((cat) => {
      if (cat.id === categoryId) {
        const found = (cat.transactions || []).find((tx) => tx.id === transactionId);
        if (found) deletedTx = { categoryId, transaction: found };
        return {
          ...cat,
          transactions: (cat.transactions || []).filter((tx) => tx.id !== transactionId)
        };
      }
      return cat;
    });

    set({ categories: updated, lastDeletedTransaction: deletedTx });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        const targetCat = updated.find((c) => c.id === categoryId);
        if (targetCat) await setDoc(doc(db, `users/${userId}/categories`, categoryId), targetCat);
      } catch (e) {
        console.warn('Failed deleting transaction in Firestore:', e);
      }
    }
  },

  undoDeleteTransaction: async (userId, isGuest) => {
    const last = get().lastDeletedTransaction;
    if (!last) return;
    const { categoryId, transaction } = last;
    await get().addTransaction(categoryId, transaction, userId, isGuest);
    set({ lastDeletedTransaction: null });
  },

  clearCategoryTransactions: async (categoryId, userId, isGuest) => {
    const updated = get().categories.map((cat) => (cat.id === categoryId ? { ...cat, transactions: [] } : cat));
    set({ categories: updated });
    saveLocalData('finanzapp:categories:v1', updated);

    if (userId && !isGuest) {
      try {
        const targetCat = updated.find((c) => c.id === categoryId);
        if (targetCat) await setDoc(doc(db, `users/${userId}/categories`, categoryId), targetCat);
      } catch (e) {
        console.warn('Failed clearing category transactions in Firestore:', e);
      }
    }
  },

  // Budget Actions
  addBudget: async (budget, userId, isGuest) => {
    const id = budget.id || `bg_${Date.now()}`;
    const newBudget = { ...budget, id, amount: Number(budget.amount) };
    const updated = [...get().budgets, newBudget];
    set({ budgets: updated });
    saveLocalData('finanzapp:budgets:v1', updated);

    if (userId && !isGuest) {
      try {
        await setDoc(doc(db, `users/${userId}/budgets`, id), newBudget);
      } catch (e) {
        console.warn('Failed adding budget to Firestore:', e);
      }
    }
    return newBudget;
  },

  updateBudget: async (id, updates, userId, isGuest) => {
    const updated = get().budgets.map((b) => (b.id === id ? { ...b, ...updates, amount: Number(updates.amount ?? b.amount) } : b));
    set({ budgets: updated });
    saveLocalData('finanzapp:budgets:v1', updated);

    if (userId && !isGuest) {
      try {
        const b = updated.find((item) => item.id === id);
        if (b) await setDoc(doc(db, `users/${userId}/budgets`, id), b, { merge: true });
      } catch (e) {
        console.warn('Failed updating budget in Firestore:', e);
      }
    }
  },

  deleteBudget: async (id, userId, isGuest) => {
    const updated = get().budgets.filter((b) => b.id !== id);
    set({ budgets: updated });
    saveLocalData('finanzapp:budgets:v1', updated);

    if (userId && !isGuest) {
      try {
        await deleteDoc(doc(db, `users/${userId}/budgets`, id));
      } catch (e) {
        console.warn('Failed deleting budget from Firestore:', e);
      }
    }
  },

  // Filter Actions
  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  clearFilters: () => set({ filters: { year: null, month: null, search: '' } }),

  // Settings
  updateSettings: async (updates, userId, isGuest) => {
    const updated = { ...get().settings, ...updates };
    set({ settings: updated });
    saveLocalData('finanzapp:settings:v1', updated);

    if (userId && !isGuest) {
      try {
        await setDoc(doc(db, `users/${userId}/settings`, 'general'), updated, { merge: true });
      } catch (e) {
        console.warn('Failed updating settings in Firestore:', e);
      }
    }
  },

  // Backup Import & Export
  importData: async (data, userId, isGuest) => {
    if (!data) return;
    const cats = data.categories || [];
    const buds = data.budgets || [];
    const sets = data.settings || get().settings;

    set({ categories: cats, budgets: buds, settings: sets });
    saveLocalData('finanzapp:categories:v1', cats);
    saveLocalData('finanzapp:budgets:v1', buds);
    saveLocalData('finanzapp:settings:v1', sets);

    if (userId && !isGuest) {
      const batch = writeBatch(db);
      cats.forEach((cat) => batch.set(doc(db, `users/${userId}/categories`, cat.id), cat));
      buds.forEach((bud) => batch.set(doc(db, `users/${userId}/budgets`, bud.id), bud));
      batch.set(doc(db, `users/${userId}/settings`, 'general'), sets);
      await batch.commit();
    }
  }
}));
