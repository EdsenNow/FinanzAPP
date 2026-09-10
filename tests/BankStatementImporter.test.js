import { describe, it, expect } from 'vitest';
import '../src/lib/MerchantCategorizer.js';
import '../src/lib/BankStatementImporter.js';

const BankStatementImporter = window.BankStatementImporter || globalThis.BankStatementImporter;

describe('BankStatementImporter - Bank Extract CSV Parser', () => {

  const testCategories = [
    { id: 1, name: 'Comida', fixedType: 'expense', transactions: [] },
    { id: 2, name: 'Transporte', fixedType: 'expense', transactions: [] },
    { id: 3, name: 'Servicios', fixedType: 'expense', transactions: [] },
    { id: 4, name: 'Nómina', fixedType: 'income', transactions: [] }
  ];

  it('debe autodetectar delimitador por coma y extraer transacciones estándar', () => {
    const csv = `Fecha,Descripcion,Monto
10/03/2026,SUPERMERCADOS BRAVO,1250.00
11/03/2026,UBER TRIP SANTO DOMINGO,350.50
12/03/2026,CLARO FACTURA MOVIL,1890.00`;

    const result = BankStatementImporter.parseStatement(csv, testCategories);
    expect(result.success).toBe(true);
    expect(result.delimiter).toBe(',');
    expect(result.importedCount).toBe(3);

    const r1 = result.rows[0];
    expect(r1.description).toBe('SUPERMERCADOS BRAVO');
    expect(r1.amount).toBe(1250);
    expect(r1.categoryName).toBe('Comida');

    const r2 = result.rows[1];
    expect(r2.description).toBe('UBER TRIP SANTO DOMINGO');
    expect(r2.amount).toBe(350.50);
    expect(r2.categoryName).toBe('Transporte');
  });

  it('debe soportar formato con punto y coma (;) y columnas separadas de Débito y Crédito', () => {
    const csv = `Fecha;Concepto;Debito;Credito
01/03/2026;PAGO DE NOMINA;;45000.00
02/03/2026;ESTACION TOTAL LINCOLN;2500.00;
03/03/2026;FARMACIA CAROL;850.00;`;

    const result = BankStatementImporter.parseStatement(csv, testCategories);
    expect(result.success).toBe(true);
    expect(result.delimiter).toBe(';');
    expect(result.importedCount).toBe(3);

    const incomeRow = result.rows[0];
    expect(incomeRow.type).toBe('income');
    expect(incomeRow.amount).toBe(45000);

    const expenseRow = result.rows[1];
    expect(expenseRow.type).toBe('expense');
    expect(expenseRow.amount).toBe(2500);
    expect(expenseRow.categoryName).toBe('Transporte');
  });

  it('debe parsear montos con símbolos monetarios y separadores de miles', () => {
    expect(BankStatementImporter.parseAmount('RD$ 3,450.50')).toBe(3450.50);
    expect(BankStatementImporter.parseAmount('US$ 49.99')).toBe(49.99);
    expect(BankStatementImporter.parseAmount('1.250,50')).toBe(1250.50);
    expect(BankStatementImporter.parseAmount('(500.00)')).toBe(-500);
  });
});

