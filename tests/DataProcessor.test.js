import { describe, it, expect, beforeEach } from 'vitest';
import '../src/lib/DataProcessor.js';

describe('DataProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new window.DataProcessor();
  });

  describe('filtrarTransacciones', () => {
    it('aplasta categorías y añade nombre de categoría', () => {
      const categorias = [
        { name: 'Comida', transactions: [{ amount: 10, date: '2024-01-15', type: 'expense' }] },
        { name: 'Sueldo', transactions: [{ amount: 1000, date: '2024-01-01', type: 'income' }] }
      ];
      const txs = processor.filtrarTransacciones(categorias);
      expect(txs).toHaveLength(2);
      expect(txs[0].category).toBe('Comida');
      expect(txs[1].category).toBe('Sueldo');
    });

    it('filtra por año y mes', () => {
      const categorias = [{
        name: 'Varios',
        transactions: [
          { amount: 10, date: '2024-01-15', type: 'expense' },
          { amount: 20, date: '2024-02-15', type: 'expense' },
          { amount: 30, date: '2023-01-15', type: 'expense' }
        ]
      }];
      expect(processor.filtrarTransacciones(categorias, { year: 2024 })).toHaveLength(2);
      expect(processor.filtrarTransacciones(categorias, { year: 2024, month: 0 })).toHaveLength(1);
    });

    it('ignora fechas inválidas', () => {
      const categorias = [{
        name: 'X',
        transactions: [
          { amount: 10, date: 'invalid', type: 'expense' },
          { amount: 20, date: '2024-01-15', type: 'expense' }
        ]
      }];
      expect(processor.filtrarTransacciones(categorias)).toHaveLength(1);
    });
  });

  describe('calcularMensual', () => {
    it('acumula ingresos y gastos por mes', () => {
      const txs = [
        { amount: 100, date: '2024-01-15', type: 'income' },
        { amount: 50, date: '2024-01-20', type: 'expense' },
        { amount: 200, date: '2024-02-10', type: 'income' }
      ];
      const mensual = processor.calcularMensual(txs);
      expect(mensual.income[0]).toBe(100);
      expect(mensual.expenses[0]).toBe(50);
      expect(mensual.income[1]).toBe(200);
    });
  });

  describe('calcularAcumulado', () => {
    it('calcula balance neto acumulado mes a mes', () => {
      const income = [100, 200];
      const expenses = [50, 100];
      const acum = processor.calcularAcumulado(income, expenses);
      expect(acum[0]).toBe(50);
      expect(acum[1]).toBe(150);
    });
  });

  describe('calcularDivisionCategorias', () => {
    it('agrupa por categoría y separa ingresos/gastos ordenados descendente', () => {
      const txs = [
        { amount: 100, category: 'A', type: 'expense' },
        { amount: 50, category: 'B', type: 'expense' },
        { amount: 200, category: 'C', type: 'income' }
      ];
      const div = processor.calcularDivisionCategorias(txs);
      expect(div.expenses).toHaveLength(2);
      expect(div.expenses[0].name).toBe('A');
      expect(div.income).toHaveLength(1);
      expect(div.income[0].amount).toBe(200);
    });
  });

  describe('calcularEstadisticasDiarias', () => {
    it('calcula ingresos/gastos de hoy y promedio diario de 30 días', () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const txs = [
        { amount: 100, date: hoy, type: 'income' },
        { amount: 40, date: hoy, type: 'expense' },
        { amount: 30, date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), type: 'income' }
      ];
      const stats = processor.calcularEstadisticasDiarias(txs);
      expect(stats.incomeToday).toBe(100);
      expect(stats.expensesToday).toBe(40);
      expect(stats.avgDaily).toBeGreaterThan(0);
    });
  });

  describe('calcularGastosPorDia', () => {
    it('suma gastos por día del mes (índice 0 = día 1)', () => {
      const txs = [
        { amount: 10, date: '2024-01-01T12:00:00', type: 'expense' },
        { amount: 20, date: '2024-01-02T12:00:00', type: 'expense' },
        { amount: 30, date: '2024-01-01T12:00:00', type: 'income' }
      ];
      const porDia = processor.calcularGastosPorDia(txs);
      expect(porDia[0]).toBe(10); // solo suma gastos
      expect(porDia[1]).toBe(20);
      expect(porDia[2]).toBe(0);
    });
  });

  describe('prepararDatosTabla', () => {
    it('añade porcentaje y ids de respaldo', () => {
      const lista = [
        { name: 'A', amount: 75 },
        { name: 'B', amount: 25 }
      ];
      const result = processor.prepararDatosTabla(lista, 'expense');
      expect(result[0].percent).toBe(75);
      expect(result[1].percent).toBe(25);
      expect(result[0].type).toBe('expense');
      expect(result[0].id).toBe('expense_1');
    });
  });
});
