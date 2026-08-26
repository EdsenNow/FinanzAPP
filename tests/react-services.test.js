import { describe, it, expect } from 'vitest';
import { 
  formatCurrency, 
  calculateSummary, 
  calculateCashflow, 
  calculateCategoryBreakdown, 
  calculateHeatmap, 
  calculateBudgetStatus 
} from '../src/services/dataCalculations';

describe('React Architecture Services & Calculations', () => {
  const mockCategories = [
    {
      id: 'cat_1',
      name: 'Comida',
      fixedType: 'expense',
      transactions: [
        { id: 'tx_1', amount: 50, date: '2026-08-10', type: 'expense', desc: 'Supermercado' },
        { id: 'tx_2', amount: 25, date: '2026-08-15', type: 'expense', desc: 'Restaurante' }
      ]
    },
    {
      id: 'cat_2',
      name: 'Sueldo',
      fixedType: 'income',
      transactions: [
        { id: 'tx_3', amount: 1200, date: '2026-08-01', type: 'income', desc: 'Nómina mensual' }
      ]
    }
  ];

  it('formatea moneda correctamente con símbolo personalizado', () => {
    const formatted = formatCurrency(1250.5, '$');
    expect(formatted).toContain('$');
    expect(formatted).toContain('50');
    expect(formatCurrency(0, '€')).toContain('€');
  });

  it('calcula resumen financiero (Ingresos, Gastos, Balance)', () => {
    const summary = calculateSummary(mockCategories);
    expect(summary.totalIncome).toBe(1200);
    expect(summary.totalExpenses).toBe(75);
    expect(summary.netBalance).toBe(1125);
    expect(summary.totalCount).toBe(3);
  });

  it('filtra transacciones por año y mes', () => {
    const summaryFiltered = calculateSummary(mockCategories, { year: 2026, month: 7 }); // Month 7 is August (0-indexed)
    expect(summaryFiltered.totalIncome).toBe(1200);
    expect(summaryFiltered.totalExpenses).toBe(75);

    const summaryNoMatch = calculateSummary(mockCategories, { year: 2025 });
    expect(summaryNoMatch.totalCount).toBe(0);
  });

  it('calcula desglose por categorías ordenado descendente', () => {
    const breakdown = calculateCategoryBreakdown(mockCategories);
    expect(breakdown.expenses).toHaveLength(1);
    expect(breakdown.expenses[0].name).toBe('Comida');
    expect(breakdown.expenses[0].amount).toBe(75);
    expect(breakdown.income[0].name).toBe('Sueldo');
    expect(breakdown.income[0].amount).toBe(1200);
  });

  it('calcula mapa de actividad diaria (heatmap)', () => {
    const heatmap = calculateHeatmap(mockCategories);
    expect(heatmap.expensesByDay[9]).toBe(50); // Día 10 -> índice 9
    expect(heatmap.expensesByDay[14]).toBe(25); // Día 15 -> índice 14
    expect(heatmap.incomeByDay[0]).toBe(1200); // Día 1 -> índice 0
  });

  it('calcula estado y porcentaje de presupuestos correctamente', () => {
    const budget = {
      id: 'bg_1',
      name: 'Límite Comida',
      categoryId: 'cat_1',
      amount: 100,
      period: 'monthly'
    };

    const status = calculateBudgetStatus(budget, mockCategories);
    expect(status.spent).toBe(75);
    expect(status.remaining).toBe(25);
    expect(status.percent).toBe(75);
    expect(status.status).toBe('success');
  });

  it('marca presupuesto como warning o danger cuando supera el 80% o 100%', () => {
    const budgetDanger = {
      id: 'bg_2',
      name: 'Límite Ajustado',
      categoryId: 'cat_1',
      amount: 60,
      period: 'monthly'
    };

    const statusDanger = calculateBudgetStatus(budgetDanger, mockCategories);
    expect(statusDanger.spent).toBe(75);
    expect(statusDanger.remaining).toBe(-15);
    expect(statusDanger.status).toBe('danger');
  });
});
