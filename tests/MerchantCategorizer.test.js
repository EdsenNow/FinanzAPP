import { describe, it, expect } from 'vitest';
import '../src/lib/MerchantCategorizer.js';

const MerchantCategorizer = window.MerchantCategorizer || globalThis.MerchantCategorizer;

describe('MerchantCategorizer - Intelligent Categorization Engine', () => {

  const testCategories = [
    { id: 1, name: 'Comida', fixedType: 'expense', transactions: [] },
    { id: 2, name: 'Transporte', fixedType: 'expense', transactions: [] },
    { id: 3, name: 'Servicios', fixedType: 'expense', transactions: [] },
    { id: 4, name: 'Salud', fixedType: 'expense', transactions: [] },
    { id: 5, name: 'Nómina', fixedType: 'income', transactions: [] }
  ];

  describe('Reglas heurísticas dominicanas y globales', () => {
    it('debe sugerir Comida para compras en supermercados dominicanos', () => {
      const r1 = MerchantCategorizer.suggestCategory('SUPERMERCADOS BRAVO SANTIAGO', testCategories);
      expect(r1).not.toBeNull();
      expect(r1.categoryName).toBe('Comida');
      expect(r1.confidence).toBe('heuristic');

      const r2 = MerchantCategorizer.suggestCategory('SIRENA CHURCHILL', testCategories);
      expect(r2.categoryName).toBe('Comida');

      const r3 = MerchantCategorizer.suggestCategory('PEDIDOSYA RESTAURANTE', testCategories);
      expect(r3.categoryName).toBe('Comida');
    });

    it('debe sugerir Transporte para viajes y combustibles', () => {
      const r1 = MerchantCategorizer.suggestCategory('UBER *TRIP Santo Domingo', testCategories);
      expect(r1).not.toBeNull();
      expect(r1.categoryName).toBe('Transporte');

      const r2 = MerchantCategorizer.suggestCategory('ESTACION TOTAL LINCOLN', testCategories);
      expect(r2.categoryName).toBe('Transporte');
    });

    it('debe sugerir Servicios para suscripciones y telecomunicaciones', () => {
      const r1 = MerchantCategorizer.suggestCategory('CLARO DOMINICANA FACTURA', testCategories);
      expect(r1.categoryName).toBe('Servicios');

      const r2 = MerchantCategorizer.suggestCategory('NETFLIX.COM MENSUAL', testCategories);
      expect(r2.categoryName).toBe('Servicios');
    });

    it('debe sugerir Salud para farmacias y clínicas', () => {
      const r1 = MerchantCategorizer.suggestCategory('FARMACIA CAROL PIANTINI', testCategories);
      expect(r1.categoryName).toBe('Salud');
    });
  });

  describe('Aprendizaje adaptativo por historial', () => {
    it('debe aprender de categorizaciones personalizadas previas del usuario', () => {
      const customCategories = [
        {
          id: 'cat_tech',
          name: 'Tecnología y Gadgets',
          fixedType: 'expense',
          transactions: [
            { description: 'AMAZON.COM ELECTRONICS' },
            { description: 'AMAZON.COM ORDER #112' }
          ]
        },
        {
          id: 'cat_compras',
          name: 'Compras Generales',
          fixedType: 'expense',
          transactions: []
        }
      ];

      const memory = MerchantCategorizer.learnFromHistory(customCategories);

      // Una nueva compra de Amazon debe sugerir "Tecnología y Gadgets" por historial
      const suggestion = MerchantCategorizer.suggestCategory('AMAZON.COM MOUSE GAMER', customCategories, { historyMemory: memory });
      expect(suggestion).not.toBeNull();
      expect(suggestion.categoryId).toBe('cat_tech');
      expect(suggestion.confidence).toBe('history');
      expect(suggestion.reason).toContain('gasto(s) previo(s)');
    });
  });

  describe('Compatibilidad de tipo de transacción', () => {
    it('no debe sugerir categorías de gastos para transacciones de ingreso', () => {
      const r = MerchantCategorizer.suggestCategory('PAGO DE NOMINA EMPRESA', testCategories, { txType: 'income' });
      expect(r).not.toBeNull();
      expect(r.categoryName).toBe('Nómina');
    });
  });
});

