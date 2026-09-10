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
     * Guarda credenciales IMAP en el backend de forma cifrada y segura.
     * @param {{ email: string, appPassword?: string, targetSenders: string[] }} params
     */
    async saveImapCredentials({ email, appPassword, targetSenders }) {
      if (window.FirestoreDB?.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }
      const user = (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function')
        ? window.firebase.auth().currentUser
        : null;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      const token = await user.getIdToken();
      const uid = user.uid;

      const response = await fetch(`${this.baseUrl}/saveImapCredentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid, email, appPassword, targetSenders })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar credenciales en el servidor');
      }
      return data;
    }

    /**
     * Obtiene el estado seguro de la configuración IMAP (sin exponer la contraseña).
     * @returns {Promise<{ configured: boolean, email: string, targetSenders: string[], lastSyncAt: string|null }|null>}
     */
    async getImapStatus() {
      if (window.FirestoreDB?.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }
      const user = (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function')
        ? window.firebase.auth().currentUser
        : null;
      if (!user) return null;

      try {
        const token = await user.getIdToken();
        const uid = user.uid;

        const response = await fetch(`${this.baseUrl}/getImapStatus?uid=${encodeURIComponent(uid)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) return null;
        return await response.json();
      } catch (e) {
        console.warn('[SyncAPI] getImapStatus falló:', e);
        return null;
      }
    }

    /**
     * Llama al backend para forzar la sincronización IMAP a demanda.
     * Retorna una promesa con la cantidad de transacciones encontradas y sincronizadas.
     */
    async syncImapOnDemand() {
      if (window.FirestoreDB?.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }
      const user = (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function')
        ? window.firebase.auth().currentUser
        : null;
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
        throw new Error(data.message || data.error || 'Error al conectar con el servidor para sincronizar IMAP');
      }

      return data;
    }
  }

  window.SyncAPI = new SyncAPIClass();
})();
