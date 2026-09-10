import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { extractTransactionData } = require('../functions/src/emailParser.js');

describe('EmailParser - Dominican Bank Notifications', () => {

  describe('Banreservas', () => {
    it('debe extraer compra en pesos (RD$) correctamente', () => {
      const subject = 'Banreservas - Notificación de Consumo';
      const dateHeader = '2026-03-05T14:30:00Z';
      const body = `
        Estimado cliente,
        Le informamos que se ha realizado un consumo con su tarjeta de crédito terminada en 4321.
        Monto: RD$ 3,450.50
        Comercio: SUPERMERCADOS BRAVO
        Fecha: 05/03/2026 10:30 AM
        Balance disponible: RD$ 45,000.00
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.ignored).toBeUndefined();
      expect(result.amount).toBe(3450.50);
      expect(result.type).toBe('expense');
      expect(result.status).toBe('approved');
      expect(result.description.toUpperCase()).toContain('SUPERMERCADOS BRAVO');
    });

    it('debe identificar transacciones rechazadas/declinadas', () => {
      const subject = 'Banreservas - Transacción Declinada';
      const dateHeader = '2026-03-06T09:00:00Z';
      const body = `
        Aviso de transacción no aprobada.
        Su consumo por RD$ 1,200.00 en IBERIA no fue procesado.
        Estado: declinada por fondos insuficientes.
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.status).toBe('rejected');
      expect(result.amount).toBe(1200);
    });
  });

  describe('Banco Popular Dominicano (BPD)', () => {
    it('debe extraer consumo internacional en dólares (US$)', () => {
      const subject = 'Banco Popular - Alerta Móvil';
      const dateHeader = '2026-03-07T18:00:00Z';
      const body = `
        Banco Popular Dominicano informa:
        Cargo de US$ 49.99 por compra en AMAZON.COM realizado con su tarjeta Débito *9988.
        07/03/2026.
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.amount).toBe(49.99);
      expect(result.type).toBe('expense');
      expect(result.status).toBe('approved');
      expect(result.description.toUpperCase()).toContain('AMAZON.COM');
    });

    it('debe detectar transferencia entrante / abono como income', () => {
      const subject = 'Banco Popular - Notificación de Depósito';
      const dateHeader = '2026-03-08T12:00:00Z';
      const body = `
        Se ha registrado una transferencia recibida por abono a su cuenta de ahorros.
        Monto acreditado: RD$ 25,000.00
        Concepto: Nomina quincenal
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.amount).toBe(25000);
      expect(result.type).toBe('income');
      expect(result.status).toBe('approved');
    });
  });

  describe('Banco BHD', () => {
    it('debe extraer consumo y comercio en compras cotidianas', () => {
      const subject = 'BHD - Notificación de Transacción Aprobada';
      const dateHeader = '2026-03-08T15:20:00Z';
      const body = `
        Banco BHD le informa que su transacción ha sido exitosa.
        Monto: RD$ 820.00
        Establecimiento: FARMACIA CAROL
        Tarjeta: Clásica ****1122
        Fecha: 08/03/2026
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.amount).toBe(820);
      expect(result.type).toBe('expense');
      expect(result.description.toUpperCase()).toContain('FARMACIA CAROL');
    });
  });

  describe('Qik Banco Digital', () => {
    it('debe procesar notificaciones modernas de Qik', () => {
      const subject = 'Qik - Pago aprobado';
      const dateHeader = '2026-03-09T20:10:00Z';
      const body = `
        ¡Hola! Tu pago de RD$ 650.00 en PEDIDOSYA fue aprobado con tu tarjeta Qik.
        Fecha: 09/03/2026.
      `;

      const result = extractTransactionData(subject, dateHeader, body);
      expect(result).not.toBeNull();
      expect(result.amount).toBe(650);
      expect(result.type).toBe('expense');
      expect(result.status).toBe('approved');
    });
  });

  describe('Filtros anti-spam y correos no bancarios', () => {
    it('debe ignorar estados de cuenta mensuales', () => {
      const subject = 'Su estado de cuenta mensual Banreservas ya está disponible';
      const body = 'Adjunto encontrará su estado de cuenta correspondiente al mes de febrero. Monto a pagar...';

      const result = extractTransactionData(subject, null, body);
      expect(result).toEqual({ ignored: true, reason: 'marketing/spam' });
    });

    it('debe ignorar newsletters, promociones y códigos OTP', () => {
      const subject = 'Código de verificación temporal';
      const body = 'Tu clave temporal OTP para inicio de sesión es 849201. No la compartas con nadie.';

      const result = extractTransactionData(subject, null, body);
      expect(result).toEqual({ ignored: true, reason: 'marketing/spam' });
    });

    it('debe ignorar correos sin contexto bancario o comercial', () => {
      const subject = 'Hola amigo';
      const body = '¿Nos vemos este fin de semana para salir a caminar por el parque un rato?';

      const result = extractTransactionData(subject, null, body);
      expect(result).toEqual({ ignored: true, reason: 'no_bank_context' });
    });
  });
});
