import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/lib/Events.js';

const DataEvents = window.DataEvents;

describe('EventBus - Bus de Eventos Pub/Sub y Sincronizacion', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  it('debe registrar oyentes con on() y recibir datos emitidos con emit()', () => {
    const handler = vi.fn();
    DataEvents.on('transaccion:creada', handler);

    const payload = { id: 101, monto: 500, comercio: 'Farmacia' };
    DataEvents.emit('transaccion:creada', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);

    DataEvents.off('transaccion:creada', handler);
  });

  it('debe permitir multiples oyentes para un mismo evento', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    DataEvents.on('presupuesto:alerta', handler1);
    DataEvents.on('presupuesto:alerta', handler2);

    DataEvents.emit('presupuesto:alerta', { porcentaje: 95 });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    DataEvents.off('presupuesto:alerta', handler1);
    DataEvents.off('presupuesto:alerta', handler2);
  });

  it('debe aislar errores si un oyente falla, permitiendo que los demas se ejecuten', () => {
    const faultyHandler = vi.fn(() => {
      throw new Error('Fallo simulado en oyente');
    });
    const goodHandler = vi.fn();

    DataEvents.on('sync:completada', faultyHandler);
    DataEvents.on('sync:completada', goodHandler);

    expect(() => {
      DataEvents.emit('sync:completada', { ok: true });
    }).not.toThrow();

    expect(faultyHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);

    DataEvents.off('sync:completada', faultyHandler);
    DataEvents.off('sync:completada', goodHandler);
  });

  it('debe desuscribir correctamente con off() y no volver a invocar el callback', () => {
    const handler = vi.fn();
    DataEvents.on('filtro:cambiado', handler);

    DataEvents.emit('filtro:cambiado', { mes: 5 });
    expect(handler).toHaveBeenCalledTimes(1);

    DataEvents.off('filtro:cambiado', handler);
    DataEvents.emit('filtro:cambiado', { mes: 6 });
    expect(handler).toHaveBeenCalledTimes(1); // No incrementa
  });

  it('debe guardar el evento en localStorage con estructura para retransmision cross-tab', () => {
    DataEvents.emit('test:crosstab', { test: true });

    const raw = localStorage.getItem('dataEvent');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw);
    expect(parsed.type).toBe('test:crosstab');
    expect(parsed.data).toEqual({ test: true });
    expect(parsed.source).toBe(window.location.pathname);
    expect(parsed.timestamp).toBeTypeOf('number');
  });

  it('el listener de storage debe invocar callbacks cuando llega un evento de otra pestana', () => {
    const remoteHandler = vi.fn();
    DataEvents.on('remoto:cambio', remoteHandler);

    // Simular evento storage desde otra ruta / pestana
    const fakeStorageEvent = new StorageEvent('storage', {
      key: 'dataEvent',
      newValue: JSON.stringify({
        type: 'remoto:cambio',
        data: { balance: 12000 },
        source: '/pages/OtraPestana/index.html'
      })
    });
    window.dispatchEvent(fakeStorageEvent);

    expect(remoteHandler).toHaveBeenCalledTimes(1);
    expect(remoteHandler).toHaveBeenCalledWith({ balance: 12000 });

    DataEvents.off('remoto:cambio', remoteHandler);
  });

  it('el listener de storage debe ignorar eventos que provienen de esta misma pestana', () => {
    const loopHandler = vi.fn();
    DataEvents.on('mismo:origen', loopHandler);

    const sameOriginEvent = new StorageEvent('storage', {
      key: 'dataEvent',
      newValue: JSON.stringify({
        type: 'mismo:origen',
        data: { test: true },
        source: window.location.pathname
      })
    });
    window.dispatchEvent(sameOriginEvent);

    expect(loopHandler).not.toHaveBeenCalled();

    DataEvents.off('mismo:origen', loopHandler);
  });

  it('debe tolerar eventos de storage con contenido corrupto o keys distintas', () => {
    const safeHandler = vi.fn();
    DataEvents.on('seguro', safeHandler);

    // Evento con key diferente
    window.dispatchEvent(new StorageEvent('storage', { key: 'otraKey', newValue: '{}' }));
    // Evento con JSON roto
    window.dispatchEvent(new StorageEvent('storage', { key: 'dataEvent', newValue: '{corrupt json' }));

    expect(safeHandler).not.toHaveBeenCalled();

    DataEvents.off('seguro', safeHandler);
  });

});