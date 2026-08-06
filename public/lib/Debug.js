/**
 * @fileoverview Gestión del modo debug de consola.
 *
 * Controla si los mensajes de `console.log`, `console.info` y `console.debug`
 * se muestran o se suprimen según el valor almacenado en localStorage.
 * `console.warn` y `console.error` nunca se suprimen.
 *
 * @example
 * Debug.setOn();           // Activar
 * Debug.setOff();          // Desactivar
 * Debug.toggle();          // Alternar
 * if (Debug.isOn()) { }   // Consultar estado
 */
class Debug {
  /** @type {string[]} Claves de localStorage que controlan el modo debug */
  static #LS_KEYS = ['finanzapp:debug', 'debug'];

  /**
   * Métodos originales de console, capturados antes de cualquier supresión.
   * @type {{ log: Function, info: Function, debug: Function, warn: Function, error: Function }}
   */
  static #original = {
    log:   console.log.bind(console),
    info:  console.info?.bind(console)  ?? console.log.bind(console),
    debug: console.debug?.bind(console) ?? console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console)
  };

  /**
   * Comprueba si el modo debug está activo leyendo localStorage.
   * @returns {boolean}
   */
  static isOn() {
    try {
      return Debug.#LS_KEYS.some(k => (localStorage.getItem(k) || '').toLowerCase() === 'on');
    } catch {
      return false;
    }
  }

  /**
   * Aplica el estado actual de debug: suprime o restaura console.log/info/debug.
   */
  static #apply() {
    if (Debug.isOn()) {
      console.log   = Debug.#original.log;
      console.info  = Debug.#original.info;
      console.debug = Debug.#original.debug;
    } else {
      console.log   = function () {};
      console.info  = function () {};
      console.debug = function () {};
    }
    console.warn  = Debug.#original.warn;
    console.error = Debug.#original.error;
  }

  /**
   * Persiste el estado del debug y re-aplica los métodos de consola.
   * @param {boolean} on
   */
  static #set(on) {
    try { localStorage.setItem('finanzapp:debug', on ? 'on' : 'off'); } catch { /* sin acceso a localStorage */ }
    Debug.#apply();
  }

  /** Activa el modo debug. */
  static setOn()  { Debug.#set(true); }

  /** Desactiva el modo debug. */
  static setOff() { Debug.#set(false); }

  /** Alterna el estado del modo debug. */
  static toggle() { Debug.#set(!Debug.isOn()); }

  /**
   * Restaura todos los métodos de consola a su implementación original.
   * Útil para pruebas o limpieza de entorno.
   */
  static _restore() {
    const o = Debug.#original;
    console.log   = o.log;
    console.info  = o.info;
    console.debug = o.debug;
    console.warn  = o.warn;
    console.error = o.error;
  }

  static {
    // Sincronizar cuando otro tab cambia la configuración de debug
    window.addEventListener('storage', (e) => {
      if (Debug.#LS_KEYS.includes(e.key)) Debug.#apply();
    });
    // Aplicar estado inicial al cargar el módulo
    Debug.#apply();
  }
}

window.Debug = Debug;
