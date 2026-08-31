(function() {
  'use strict';

  class SyncAPIClass {
    constructor() {
      // Usar la API desplegada en Firebase functions
      const isEmulator = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.__USE_FIREBASE_EMULATORS === true;
      this.baseUrl = isEmulator
        ? 'http://127.0.0.1:5001/finanzapp-fb/us-central1/api'
        : 'https://us-central1-finanzapp-fb.cloudfunctions.net/api';
    }

    /**
     * Llama al backend para forzar la sincronización IMAP a demanda.
     * Retorna una promesa con la cantidad de transacciones encontradas y sincronizadas.
     */
    async syncImapOnDemand() {
      const user = window.firebase ? window.firebase.auth().currentUser : null;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      const token = await user.getIdToken();
      const uid = user.uid;

      const response = await fetch(`${this.baseUrl}/syncImap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con el servidor para sincronizar IMAP');
      }

      return data;
    }
  }

  window.SyncAPI = new SyncAPIClass();
})();
