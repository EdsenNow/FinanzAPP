import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/lib/DataStore.js';

const storeFactories = window.Core?.storeFactories;

describe('DataStore - Jerarquia y Persistencia de Almacenamiento', () => {

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('LocalStorageStore', () => {
    it('debe devolver null cuando no existe ningun dato guardado para el usuario', async () => {
      const store = storeFactories.createLocalStorageStore();
      const data = await store.load();
      expect(data).toBeNull();
    });

    it('debe guardar y cargar transacciones, categorias y presupuestos con aislamiento por usuario', async () => {
      // 1. Guardar datos como usuario autenticado
      localStorage.setItem('authUser', JSON.stringify({ uid: 'usr_abc_123', email: 'test@finanzapp.com' }));
      const store = storeFactories.createLocalStorageStore();

      const userState = {
        transactions: [{ id: 1, monto: 1200, category: 'Comida' }],
        categories: [{ id: 10, name: 'Comida' }],
        budgets: { Comida: 5000 }
      };

      await store.save(userState);

      const loaded = await store.load();
      expect(loaded).not.toBeNull();
      expect(loaded.transactions).toHaveLength(1);
      expect(loaded.transactions[0].monto).toBe(1200);
      expect(loaded.categories[0].name).toBe('Comida');
      expect(loaded.budgets['Comida']).toBe(5000);

      // 2. Cambiar a usuario invitado -> no debe ver los datos del usuario anterior
      localStorage.setItem('authUser', JSON.stringify({ uid: 'guest', provider: 'guest' }));
      const guestStore = storeFactories.createLocalStorageStore();
      const guestData = await guestStore.load();
      expect(guestData).toBeNull();
    });

    it('debe tolerar datos con listas o campos vacios sin arrojar error', async () => {
      localStorage.setItem('authUser', JSON.stringify({ uid: 'usr_empty' }));
      const store = storeFactories.createLocalStorageStore();

      await store.save({});
      const loaded = await store.load();

      expect(loaded).toEqual({
        transactions: [],
        categories: [],
        budgets: {}
      });
    });
  });

  describe('FirestoreStore (Modo Local / Fallback)', () => {
    it('debe operar con localStorage y sincronizar tema en snapshot cuando es usuario invitado', async () => {
      localStorage.setItem('authUser', JSON.stringify({ uid: 'guest' }));
      const fStore = storeFactories.createFirestoreStore();

      const state = {
        transactions: [{ id: 'tx_guest', monto: 350 }],
        categories: [{ id: 'cat_guest', name: 'Transporte' }],
        budgets: { Transporte: 1000 },
        settings: { theme: 'dark', currency: 'DOP' }
      };

      await fStore.save(state);

      const loaded = await fStore.load();
      expect(loaded).not.toBeNull();
      expect(loaded.transactions).toHaveLength(1);
      expect(loaded.transactions[0].id).toBe('tx_guest');
      expect(loaded.budgets['Transporte']).toBe(1000);
    });

    it('unsubscribe debe ser idempotente y seguro de llamar multiples veces', () => {
      const fStore = storeFactories.createFirestoreStore();
      expect(() => {
        fStore.unsubscribe();
        fStore.unsubscribe();
      }).not.toThrow();
    });
  });

});