/**
 * @fileoverview Bus de eventos pub/sub con sincronización entre pestañas.
 *
 * Permite publicar y suscribirse a eventos dentro de la misma pestaña.
 * Los eventos también se retransmiten a otras pestañas del mismo origen
 * mediante `localStorage`, de modo que los cambios en una pestaña se
 * reflejan automáticamente en las demás.
 *
 * @example
 * // Suscribirse
 * DataEvents.on('transacciones:actualizadas', (data) => console.log(data));
 *
 * // Emitir
 * DataEvents.emit('transacciones:actualizadas', { count: 5 });
 *
 * // Desuscribirse
 * DataEvents.off('transacciones:actualizadas', handler);
 */
class EventBus {
  /** @type {Object.<string, Function[]>} Mapa de nombre de evento a callbacks suscritos */
  #listeners = {};

  constructor() {
    this.#initCrossTabListener();
  }

  /**
   * Registra el listener de `storage` para recibir eventos emitidos en otras pestañas.
   */
  #initCrossTabListener() {
    window.addEventListener('storage', (e) => {
      if (e.key !== 'dataEvent' || !e.newValue) return;
      try {
        const event = JSON.parse(e.newValue);
        // Ignorar eventos originados en esta misma pestaña
        if (event.source === window.location.pathname) return;
        const cbs = this.#listeners[event.type] || [];
        for (const cb of cbs) {
          try { cb(event.data); } catch { /* no interrumpir otros listeners */ }
        }
      } catch { /* JSON malformado o storage inaccesible */ }
    });
  }

  /**
   * Emite un evento de forma local y lo retransmite a otras pestañas via localStorage.
   * @param {string} eventName - Nombre del evento.
   * @param {*} [data=null] - Datos opcionales asociados al evento.
   */
  emit(eventName, data = null) {
    const cbs = this.#listeners[eventName];
    if (cbs?.length) {
      for (const cb of cbs) {
        try { cb(data); } catch { /* no interrumpir otros listeners */ }
      }
    }
    try {
      const event = {
        type:      eventName,
        data,
        timestamp: Date.now(),
        source:    window.location.pathname
      };
      localStorage.setItem('dataEvent', JSON.stringify(event));
      setTimeout(() => localStorage.removeItem('dataEvent'), 100);
    } catch { /* localStorage no disponible */ }
  }

  /**
   * Suscribe un callback a un evento.
   * @param {string}   eventName - Nombre del evento.
   * @param {Function} callback  - Función a ejecutar cuando se emita el evento.
   */
  on(eventName, callback) {
    if (!this.#listeners[eventName]) this.#listeners[eventName] = [];
    this.#listeners[eventName].push(callback);
  }

  /**
   * Desuscribe un callback de un evento.
   * @param {string}   eventName - Nombre del evento.
   * @param {Function} callback  - La misma referencia de función usada en `on()`.
   */
  off(eventName, callback) {
    const arr = this.#listeners[eventName];
    if (!arr) return;
    const i = arr.indexOf(callback);
    if (i > -1) arr.splice(i, 1);
  }
}

/** @type {EventBus} Instancia global del bus de eventos */
window.DataEvents = new EventBus();
