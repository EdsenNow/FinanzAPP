/**
 * GmailAPI.js
 * Módulo para detectar transacciones bancarias en Gmail via OAuth 2.0.
 * Requiere Google Identity Services (GIS) cargado en la página antes de usar.
 */

const GMAIL_CLIENT_ID = '569331846575-ejuffko4br7ujllgoaoffqcg0a75ct0h.apps.googleusercontent.com';
const GMAIL_BACKEND_URL = window.APP_CONFIG?.gmailBackendUrl || '';
const GMAIL_POLLING_INTERVAL_MS = 10000;
const GMAIL_LAST_CHECKED_KEY   = 'finanzapp:gmail:lastChecked';
const GMAIL_PROCESSED_IDS_KEY  = 'finanzapp:gmail:processedIds';
const GMAIL_TOKEN_KEY          = 'finanzapp:gmail:token';
const GMAIL_TOKEN_EXPIRY_KEY   = 'finanzapp:gmail:tokenExpiry';
const GMAIL_HISTORY_ID_KEY     = 'finanzapp:gmail:historyId';

class GmailAPI {
  constructor() {
    this._clientId       = window.APP_CONFIG?.gmailClientId || window.APP_CONFIG?.googleClientId || GMAIL_CLIENT_ID;
    this._accessToken    = null;
    this._pollingTimer   = null;
    this._lastChecked    = this._loadLastChecked();
    this._processedIds   = this._loadProcessedIds();
    this._lastHistoryId  = localStorage.getItem(GMAIL_HISTORY_ID_KEY) || null;
    this._onTransaction  = null;
    this._onStatusChange = null;
    this._signedIn       = false;
    this._transactionsUnsub = null;
    // Restaurar sesión previa si el token aún es válido
    this._restoreToken();
  }

  // Para depuración: mostrar qué clientId se está usando en tiempo de ejecución
  _debugClientId() {
    try {
      console.info('[GmailAPI] clientId en uso:', this._clientId);
    } catch (e) {}
  }

  // ── Persistencia de estado ──────────────────────────────────────────────────

  async _restoreToken() {
    const token  = localStorage.getItem(GMAIL_TOKEN_KEY);
    const expiry = Number(localStorage.getItem(GMAIL_TOKEN_EXPIRY_KEY) || 0);
    if (token && expiry > Date.now() + 60_000) { // al menos 1 min de vida
      this._accessToken = token;
      this._signedIn    = true;
      console.log('[GmailAPI] Sesión restaurada desde localStorage. Expira en', Math.round((expiry - Date.now()) / 60000), 'min');
      return;
    }

    // Si no hay token válido en localStorage, intentar renovar vía backend
    if (GMAIL_BACKEND_URL) {
      try {
        const uid = await this._getCurrentUserId();
        if (uid) {
          const url = GMAIL_BACKEND_URL.replace(/\/$/, '') + '/refreshAccessToken?uid=' + encodeURIComponent(uid);
          const headers = await this._getBackendHeaders(false);
          const resp = await fetch(url, { method: 'GET', headers });
          if (resp.ok) {
            const json = await resp.json();
            if (json && json.access_token) {
              console.log('[GmailAPI] Token restaurado vía backend al iniciar.');
              this._saveToken(json.access_token, json.expires_in || 3600);
              this._signedIn = true;
              if (this._onStatusChange) this._onStatusChange(true);
              return;
            }
          } else {
            const json = await resp.json().catch(() => ({}));
            if (resp.status === 401 && (json.error === 'invalid_grant' || json.message === 'refresh_token_revoked')) {
              console.warn('[GmailAPI] _restoreToken: refresh_token revoked, forcing interactive reauth');
              this._clearToken();
              if (window.google?.accounts?.oauth2) this.signInInteractive().catch(e => console.warn('[GmailAPI] signInInteractive failed', e));
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[GmailAPI] _restoreToken: error al pedir token al backend:', err);
      }
    }
  }

  _saveToken(token, expiresInSeconds) {
    this._accessToken = token;
    const expiry = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(GMAIL_TOKEN_KEY, token);
    localStorage.setItem(GMAIL_TOKEN_EXPIRY_KEY, String(expiry));
    // Programar renovación automática 5 min antes de expirar
    const renewIn = (expiresInSeconds - 300) * 1000;
    if (renewIn > 0) {
      setTimeout(() => this._renewToken(), renewIn);
    }
  }

  _clearToken() {
    this._accessToken = null;
    this._signedIn    = false;
    localStorage.removeItem(GMAIL_TOKEN_KEY);
    localStorage.removeItem(GMAIL_TOKEN_EXPIRY_KEY);
  }

  _renewToken() {
    // Intentar renovar vía backend (si está configurado) usando el refresh_token
    (async () => {
      try {
        if (GMAIL_BACKEND_URL) {
          const uid = await this._getCurrentUserId();
          if (uid) {
            const url = GMAIL_BACKEND_URL.replace(/\/$/, '') + '/refreshAccessToken?uid=' + encodeURIComponent(uid);
            const headers = await this._getBackendHeaders(false);
            const resp = await fetch(url, { method: 'GET', headers });
            if (resp.ok) {
              const json = await resp.json();
              if (json && json.access_token) {
                console.log('[GmailAPI] Token renovado vía backend.');
                this._saveToken(json.access_token, json.expires_in || 3600);
                this._signedIn = true;
                if (this._onStatusChange) this._onStatusChange(true);
                return;
              }
            } else {
              const json = await resp.json().catch(() => ({}));
              if (resp.status === 401 && (json.error === 'invalid_grant' || json.message === 'refresh_token_revoked')) {
                console.warn('[GmailAPI] _renewToken: refresh_token revoked, forcing interactive reauth');
                this._clearToken();
                if (window.google?.accounts?.oauth2) this.signInInteractive().catch(e => console.warn('[GmailAPI] signInInteractive failed', e));
                return;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[GmailAPI] Renovación vía backend falló:', err);
      }

      // Fallback: pedir nuevo token interactivo (GIS)
      if (!window.google?.accounts?.oauth2) return;
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this._clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: (response) => {
          if (response.error || !response.access_token) {
            console.warn('[GmailAPI] No se pudo renovar el token (fallback):', response.error);
            this._clearToken();
            this.stopPolling();
            if (this._onStatusChange) this._onStatusChange(false);
            return;
          }
          console.log('[GmailAPI] Token renovado automáticamente (fallback).');
          this._saveToken(response.access_token, response.expires_in || 3600);
          this._signedIn = true;
          if (this._onStatusChange) this._onStatusChange(true);
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    })();
  }

  async _getCurrentUserId() {
    try {
      if (window.FirestoreDB) {
        await window.FirestoreDB.ensureUserContext();
        if (window.FirestoreDB.currentUserId) return window.FirestoreDB.currentUserId;
      }
      if (window.firebaseAuth) {
        const u = window.firebaseAuth.getCurrentUser();
        if (u && u.uid) return u.uid;
      }
      const raw = localStorage.getItem('authUser');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) return parsed.uid;
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  async _getFirebaseIdToken() {
    try {
      if (window.firebaseAuth?.init) {
        await window.firebaseAuth.init();
      }

      const authUser = window.firebaseAuth?.getCurrentUser?.()
        || (window.firebase?.auth ? window.firebase.auth().currentUser : null);

      if (authUser && typeof authUser.getIdToken === 'function') {
        return await authUser.getIdToken();
      }
    } catch (e) {
      console.warn('[GmailAPI] No se pudo obtener ID token de Firebase:', e);
    }
    return null;
  }

  async _getBackendHeaders(includeJson = true) {
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';

    const idToken = await this._getFirebaseIdToken();
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    return headers;
  }

  _loadLastChecked() {
    const ts = localStorage.getItem(GMAIL_LAST_CHECKED_KEY);
    if (ts) {
      const d = new Date(Number(ts));
      if (!isNaN(d.getTime())) return d;
    }
    // Primera vez: últimas 24h
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  _saveLastChecked() {
    localStorage.setItem(GMAIL_LAST_CHECKED_KEY, String(this._lastChecked.getTime()));
  }

  _loadProcessedIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(GMAIL_PROCESSED_IDS_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch { return new Set(); }
  }

  _saveProcessedIds() {
    // Mantener solo los últimos 200 IDs para no llenar localStorage
    const arr = [...this._processedIds].slice(-200);
    localStorage.setItem(GMAIL_PROCESSED_IDS_KEY, JSON.stringify(arr));
  }

  // ── Configuración ──────────────────────────────────────────────────────────

  isConfigured() {
    return !!this._clientId;
  }

  isSignedIn() {
    return this._signedIn && !!this._accessToken;
  }

  // ── Autenticación ──────────────────────────────────────────────────────────

  /**
   * Abre el popup OAuth de Google y solicita acceso de solo lectura a Gmail.
   * @returns {Promise<void>}
   */
  signIn() {
    // Si ya hay token válido en localStorage, usarlo directamente sin OAuth
    if (this._accessToken && this._signedIn) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services no está cargado.'));
        return;
      }

      this._debugClientId();
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this._clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: (response) => {
          if (response.error) {
            this._signedIn = false;
            let msg = response.error_description || response.error || 'error_oauth';
            // Mensaje más amigable para errores comunes de cliente OAuth
            if (response.error === 'invalid_client' || /client.*not.*found/i.test(msg)) {
              msg = 'El cliente OAuth no fue encontrado. Verifica `lib/config.js` y la Consola de Google Cloud (Credentials → OAuth 2.0 Client IDs). Asegura que el Client ID coincide y que el origen de la app está autorizado.';
            }
            reject(new Error(msg));
            return;
          }
          this._saveToken(response.access_token, response.expires_in || 3600);
          this._signedIn = true;
          if (this._onStatusChange) this._onStatusChange(true);
          resolve();
        },
      });

      // prompt: '' reutiliza el token si ya fue autorizado previamente
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Igual que signIn() pero muestra el selector de cuenta (primera vez o si el silencioso falla).
   */
  signInInteractive() {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services no está cargado.'));
        return;
      }

      let settled = false;
      // Si el popup es bloqueado, GIS nunca llama al callback → timeout de 15s
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('popup_blocked'));
        }
      }, 15000);

      // Usar flujo de código (authorization code) para solicitar refresh_token al backend
      this._debugClientId();
      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: this._clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        ux_mode: 'popup',
        callback: async (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (response.error || !response.code) {
            this._signedIn = false;
            let msg = response.error_description || response.error || 'no-code';
            if (response.error === 'invalid_client' || /client.*not.*found/i.test(msg)) {
              msg = 'El cliente OAuth no fue encontrado. Verifica `lib/config.js` y la Consola de Google Cloud (Credentials → OAuth 2.0 Client IDs). Asegura que el Client ID coincide y que el origen de la app está autorizado.';
            }
            reject(new Error(msg));
            return;
          }

          // Enviar el authorization code al backend para que intercambie y guarde el refresh_token
          try {
            if (GMAIL_BACKEND_URL) {
              const uid = await this._getCurrentUserId();
              if (uid) {
                const url = GMAIL_BACKEND_URL.replace(/\/$/, '') + '/exchangeCode';
                const headers = await this._getBackendHeaders(true);
                const resp = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ code: response.code, uid })
                });
                
                if (resp.ok) {
                  const json = await resp.json();
                  if (json && json.access_token) {
                    this._saveToken(json.access_token, json.expires_in || 3600);
                    this._signedIn = true;
                    if (this._onStatusChange) this._onStatusChange(true);
                    resolve();
                    return;
                  } else {
                    reject(new Error('No se recibió el token de acceso del backend.'));
                    return;
                  }
                } else {
                  const json = await resp.json().catch(() => ({}));
                  const errMsg = json.error || `Error del servidor (HTTP ${resp.status})`;
                  reject(new Error(errMsg));
                  return;
                }
              }
            }
            reject(new Error('URL del backend de Gmail o UID del usuario no configurados.'));
          } catch (err) {
            console.warn('[GmailAPI] Error enviando code al backend:', err);
            reject(err);
          }
        }
      });

      // prompt: 'consent' fuerza mostrar pantalla para garantizar refresh_token
      // Pedir explicitamente 'access_type: offline' para solicitar refresh_token
      codeClient.requestCode({ prompt: 'consent', access_type: 'offline', include_granted_scopes: true });
    });
  }

  signOut() {
    if (this._accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this._accessToken, () => {});
    }
    this._clearToken();
    this.stopPolling();
    if (this._onStatusChange) this._onStatusChange(false);
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  /**
   * Inicia la consulta periódica a Gmail buscando transacciones en correos nuevos.
   * @param {Function} onTransaction  Callback que recibe cada transacción detectada.
   */
  startPolling(onTransaction) {
    if (!this.isSignedIn()) return;
    this._onTransaction = onTransaction;
    // _lastChecked ya viene de localStorage (no retrocede 24h en cada sesión)
    this.stopPolling();
    this._poll();
    this._pollingTimer = setInterval(() => this._poll(), GMAIL_POLLING_INTERVAL_MS);
  }

  stopPolling() {
    if (this._pollingTimer) {
      clearInterval(this._pollingTimer);
      this._pollingTimer = null;
    }
  }

  /**
   * Inicia la escucha por push: solicita al backend que registre el watch
   * y suscribe un listener Firestore para cambios en la colección de transacciones.
   */
  async startPushListening(onTransaction) {
    if (!this.isSignedIn()) return;
    this._onTransaction = onTransaction;

    // Intentar iniciar el watch en el backend (necesita uid)
    try {
      const uid = await this._getCurrentUserId();
      if (!uid) {
        console.warn('[GmailAPI] startPushListening: no uid disponible');
      } else if (!GMAIL_BACKEND_URL) {
        console.warn('[GmailAPI] startPushListening: no backend configurado');
      } else {
        const url = GMAIL_BACKEND_URL.replace(/\/$/, '') + '/gmail/startWatch';
        try {
          const headers = await this._getBackendHeaders(true);
          const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ uid })
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            if (resp.status === 401 && (json.error === 'invalid_grant' || json.message === 'refresh_token_revoked')) {
              console.warn('[GmailAPI] startWatch: refresh_token revoked, initiating interactive sign-in');
              this._clearToken();
              try { await this.signInInteractive(); } catch (e) { console.warn('[GmailAPI] signInInteractive failed', e); }
              return;
            }
            console.warn('[GmailAPI] startWatch backend responded', resp.status, json);
          } else {
            console.log('[GmailAPI] startWatch registered via backend');
          }
        } catch (e) {
          console.warn('[GmailAPI] startPushListening error', e);
        }
      }
    } catch (e) {
      console.warn('[GmailAPI] startPushListening internal error', e);
    }

    // Suscribirse a cambios en Firestore para recibir transacciones nuevas
    try {
      if (window.FirestoreDB) {
        await window.FirestoreDB.ensureUserContext();
        const uidLocal = window.FirestoreDB.currentUserId;
        if (window.firebase && uidLocal) {
          if (this._transactionsUnsub) this._transactionsUnsub();
          const ref = firebase.firestore().collection('users').doc(uidLocal).collection('transactions').orderBy('date', 'desc').limit(20);
          this._transactionsUnsub = ref.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (!this._processedIds.has(change.doc.id)) {
                  this._processedIds.add(change.doc.id);
                  this._saveProcessedIds();
                  if (this._onTransaction) this._onTransaction(data);
                }
              }
            });
          });
        }
      }
    } catch (e) {
      console.warn('[GmailAPI] Firestore listener setup failed', e);
    }
  }

  async stopPushListening() {
    if (this._transactionsUnsub) {
      try { this._transactionsUnsub(); } catch (e) {}
      this._transactionsUnsub = null;
    }
  }

  // ── Lógica interna ─────────────────────────────────────────────────────────

  async _poll() {
    if (!this._accessToken) { console.warn('[GmailAPI] _poll: sin accessToken'); return; }

    try {
      // Primera vez: obtener el historyId actual del buzón sin leer emails viejos
      if (!this._lastHistoryId) {
        await this._initHistoryId();
        return;
      }

      // Pedir solo los mensajes nuevos desde el último historyId
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/history` +
        `?startHistoryId=${this._lastHistoryId}&historyTypes=messageAdded&labelId=INBOX&maxResults=20`;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this._accessToken}` }
      });

      if (resp.status === 401) {
        console.warn('[GmailAPI] Token expirado (401)');
        this._clearToken();
        this.stopPolling();
        if (this._onStatusChange) this._onStatusChange(false);
        return;
      }

      // 404 significa historyId obsoleto (buzón muy antiguo) → reiniciar
      if (resp.status === 404) {
        console.warn('[GmailAPI] historyId obsoleto, reiniciando...');
        this._lastHistoryId = null;
        localStorage.removeItem(GMAIL_HISTORY_ID_KEY);
        await this._initHistoryId();
        return;
      }

      const data = await resp.json();

      // Siempre actualizar el historyId al más reciente
      if (data.historyId) {
        this._lastHistoryId = data.historyId;
        localStorage.setItem(GMAIL_HISTORY_ID_KEY, data.historyId);
      }

      if (!data.history || !data.history.length) {
        return; // Sin cambios, nada que hacer
      }

      // Reunir IDs únicos de mensajes agregados
      const newIds = new Set();
      for (const record of data.history) {
        for (const added of (record.messagesAdded || [])) {
          newIds.add(added.message.id);
        }
      }

      // Procesar todos los mensajes nuevos y dejar el descarte al parser.
      for (const id of newIds) {
        if (this._processedIds.has(id)) continue;
        this._processedIds.add(id);
        this._saveProcessedIds();
        await this._processMessage(id);
      }
    } catch (e) {
      console.error('[GmailAPI] Error en polling:', e);
    }
  }

  async _initHistoryId() {
    const resp = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${this._accessToken}` } }
    );
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.historyId) {
      this._lastHistoryId = data.historyId;
      localStorage.setItem(GMAIL_HISTORY_ID_KEY, data.historyId);
      console.log('[GmailAPI] historyId inicial establecido:', data.historyId);
    }
  }

  async _processMessage(messageId) {
    try {
      const resp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${this._accessToken}` } }
      );
      const msg = await resp.json();
      const subject = msg.payload?.headers?.find(h => h.name === 'Subject')?.value || '(sin subject)';
      console.log(`[GmailAPI] Procesando: "${subject}"`);
      const parsed = await this._parseEmail(msg);
      if (!parsed) {
        const body = this._extractBody(msg.payload);
        console.warn(`[GmailAPI] No se pudo parsear monto. Primeros 300 chars del body:`, body.substring(0, 300));
        return;
      }
      if (parsed.ignored) {
        console.info(`[GmailAPI] Transacción ignorada (${parsed.reason || 'sin motivo'}):`, subject);
        return;
      }
      console.log(`[GmailAPI] Transacción detectada:`, parsed);
      if (this._onTransaction) this._onTransaction(parsed);
    } catch (e) {
      console.error('[GmailAPI] Error procesando mensaje:', e);
    }
  }

  async _parseEmail(msg) {
    const headers    = msg.payload?.headers || [];
    const subject    = headers.find(h => h.name === 'Subject')?.value || '';
    const dateHeader = headers.find(h => h.name === 'Date')?.value   || '';
    const body       = this._extractBody(msg.payload);
    const fullText   = `${subject}\n${body}`;

    console.log('[GmailAPI] === TEXTO DEL CORREO (primeros 800 chars) ===\n', fullText.substring(0, 800));

    const isDeclined = this._isDeclined(fullText);

    const userCurrency = window.Core?.helpers?.getCurrencyMeta()?.code || 'USD';
    const amountInfo = this._selectTransactionAmountInfo(fullText, userCurrency);
    let amount = amountInfo ? amountInfo.amount : this._parseAmount(fullText);
    if (!amount) return null;

    // Política actual: NO realizar conversiones automáticas en el cliente.
    // Preservar el monto detectado en el email y no modificarlo.
    const conversion = { amount, note: '' };
    amount = conversion.amount;

    const description = this._parseMerchant(fullText) || subject;
    const date        = this._parseDate(dateHeader, fullText);
    const type        = this._detectTransactionType(fullText);

    console.log('[GmailAPI] Comercio detectado:', description, '| Tipo:', type);

    return {
      amount,
      description: (description + conversion.note).substring(0, 80),
      date,
      subject,
      type,
      status: isDeclined ? 'rejected' : 'approved',
    };
  }

  _extractBody(payload) {
    if (!payload) return '';
    if (payload.body?.data) {
      try {
        const raw = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        let text = raw;
        if (payload.mimeType === 'text/html') {
          text = raw.replace(/<[^>]+>/g, ' ');
          // Decodificar entidades HTML comunes
          text = text
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&[a-z]+;/gi, ' ');
        }
        return text.replace(/\s{2,}/g, ' ');
      } catch { return ''; }
    }
    if (payload.parts) {
      // Preferir text/html sobre text/plain para capturar tablas
      const htmlPart  = payload.parts.find(p => p.mimeType === 'text/html');
      const plainPart = payload.parts.find(p => p.mimeType === 'text/plain');
      for (const part of [htmlPart, plainPart, ...payload.parts].filter(Boolean)) {
        const text = this._extractBody(part);
        if (text) return text;
      }
    }
    return '';
  }

  _parseNumericAmount(value) {
    let raw = String(value || '').trim().replace(/\s/g, '');
    if (!raw) return null;
    if (/,\d{1,4}$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
    const n = parseFloat(raw);
    return !isNaN(n) && n > 0 && n < 10_000_000 ? n : null;
  }

  _currencyFromToken(token) {
    const t = String(token || '').toUpperCase();
    if (t.includes('RD$') || t === 'DOP') return 'DOP';
    if (t.includes('US$') || t === 'USD' || t === '$') return 'USD';
    if (t === 'EUR' || t.includes('€')) return 'EUR';
    if (t === 'GBP' || t.includes('£')) return 'GBP';
    if (t === 'COP' || t.includes('COL$')) return 'COP';
    if (t === 'MXN' || t.includes('MX$')) return 'MXN';
    if (t === 'ARS') return 'ARS';
    if (t === 'CLP') return 'CLP';
    if (t === 'PEN' || t.includes('S/.')) return 'PEN';
    if (t === 'BRL' || t.includes('R$')) return 'BRL';
    return null;
  }

  _parseMoneyMentions(text) {
    const mentions = [];
    const token = '(RD\\$|US\\$|COL\\$|MX\\$|R\\$|S\\/\\.|USD|DOP|EUR|GBP|COP|MXN|ARS|CLP|PEN|BRL|[$€£¥])';
    const amount = '(\\d[\\d,. ]*)';
    const patterns = [
      { regex: new RegExp(`${token}\\s*${amount}`, 'gi'), tokenIndex: 1, amountIndex: 2 },
      { regex: new RegExp(`${amount}\\s*${token}`, 'gi'), tokenIndex: 2, amountIndex: 1 }
    ];

    for (const { regex, tokenIndex, amountIndex } of patterns) {
      let match = regex.exec(text || '');
      while (match) {
        const parsedAmount = this._parseNumericAmount(match[amountIndex]);
        const currency = this._currencyFromToken(match[tokenIndex]);
        if (parsedAmount && currency) {
          const rawText = String(text || '');
          const before = rawText.slice(Math.max(0, match.index - 90), match.index);
          const after = rawText.slice(match.index + match[0].length, match.index + match[0].length + 90);
          mentions.push({ amount: parsedAmount, currency, index: match.index, before, after });
        }
        if (match[0] === '') regex.lastIndex += 1;
        match = regex.exec(text || '');
      }
    }

    return mentions
      .sort((a, b) => a.index - b.index)
      .filter((mention, index, arr) => {
        const prev = arr[index - 1];
        return !prev || prev.index !== mention.index || prev.currency !== mention.currency || prev.amount !== mention.amount;
      });
  }

  _scoreMoneyMention(mention) {
    const before = String(mention.before || '');
    const after = String(mention.after || '');
    const beforeStart = Math.max(
      before.lastIndexOf('.'),
      before.lastIndexOf(';'),
      before.lastIndexOf('|'),
      before.lastIndexOf('\n')
    ) + 1;
    const afterEndCandidates = ['.', ';', '|', '\n']
      .map(separator => after.indexOf(separator))
      .filter(index => index >= 0);
    const afterEnd = afterEndCandidates.length ? Math.min(...afterEndCandidates) : after.length;
    const context = this._normalizeText(`${before.slice(beforeStart)} ${after.slice(0, afterEnd)}`);
    let score = 0;

    if (/(monto|importe|valor|cargo|compra|consumo|debito|pago|transaccion|autorizacion|realizad|aprobada|aprobado)/.test(context)) {
      score += 5;
    }

    if (/(balance|saldo|disponible|limite|credito disponible|balance disponible|saldo disponible)/.test(context)) {
      score -= 12;
    }

    if (/(tasa|tipo de cambio|comision|itbis|impuesto|fee)/.test(context)) {
      score -= 4;
    }

    if (mention.currency === 'USD' && mention.amount < 10000) {
      score += 1;
    }

    return score;
  }

  _parseAmountInfo(text, preferredCurrency = null) {
    const mentions = this._parseMoneyMentions(text);
    if (mentions.length) {
      const scored = mentions.map(mention => ({ ...mention, score: this._scoreMoneyMention(mention) }));
      const viable = scored.filter(mention => mention.score >= 0);
      const candidates = viable.length ? viable : scored;
      const preferred = preferredCurrency
        ? candidates
          .filter(m => m.currency === preferredCurrency)
          .sort((a, b) => b.score - a.score || a.index - b.index)[0]
        : null;

      if (preferred && preferred.score > 0) return preferred;
      return candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0] || mentions[0];
    }

    const m = String(text || '').match(/(?:monto|importe|valor|cargo|compra|d[eé]bito|debito|pago|transacci[oó]n)[:\s]+(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. ]+)/i);
    if (!m) return null;
    const amount = this._parseNumericAmount(m[1]);
    return amount ? { amount, currency: null, index: m.index } : null;
  }

  _isPlausibleEffectiveRate(fromCurrency, toCurrency, rate) {
    if (!Number.isFinite(rate) || rate <= 0) return false;
    if (fromCurrency === 'USD' && toCurrency === 'DOP') {
      return rate >= 40 && rate <= 120;
    }
    return rate < 100000;
  }

  _selectTransactionAmountInfo(text, userCurrency = 'USD') {
    // Simplificado: no detectar ni aplicar conversiones; devolver el monto tal cual se detecta.
    return this._parseAmountInfo(text, userCurrency);
  }

  _parseAmount(text) {
    const patterns = [
      // 1. Prefijo de moneda (ej: US$ 10.00, USD 10.00, €10.00, RD$ 500)
      /(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])\s*(\d[\d,. ]*)/i,
      // 2. Sufijo de moneda (ej: 10.00 USD, 10.00 €, 500 RD$)
      /(\d[\d,. ]*)\s*(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])/i,
      // 3. Etiquetas explícitas con o sin moneda (ej: Monto: 123.45, Cargo: $123.45)
      /(?:monto|importe|valor|cargo|compra|débito|debito|pago|transacci[oó]n)[:\s]+(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. ]+)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (!m) continue;
      let raw = m[1].trim().replace(/\s/g, '');
      // Si termina en ,XX el punto es separador de miles → quitarlo, coma → punto
      if (/,\d{2}$/.test(raw)) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0 && n < 10_000_000) return n;
    }
    return null;
  }

  _detectCurrencyFromText(text) {
    const t = text.toUpperCase();
    if (t.includes('RD$') || t.includes('DOP')) return 'DOP';
    if (t.includes('US$') || t.includes('USD')) return 'USD';
    if (t.includes('EUR') || t.includes('€')) return 'EUR';
    if (t.includes('GBP') || t.includes('£')) return 'GBP';
    if (t.includes('COP') || t.includes('COL$')) return 'COP';
    if (t.includes('MXN') || t.includes('MX$')) return 'MXN';
    if (t.includes('ARS')) return 'ARS';
    if (t.includes('CLP')) return 'CLP';
    if (t.includes('PEN') || t.includes('S/.')) return 'PEN';
    if (t.includes('BRL') || t.includes('R$')) return 'BRL';
    return null;
  }

  async _convertCurrencyIfNeeded(amount, text, amountCurrency = null) {
    try {
      const userCurrency = window.Core?.helpers?.getCurrencyMeta()?.code || 'USD';
      const detectedCurrency = amountCurrency || this._detectCurrencyFromText(text);
      if (!detectedCurrency || detectedCurrency === userCurrency) {
        return { amount, note: '' };
      }
      const CACHE_KEY = 'finanzapp:exchangerates:v1';
      let ratesData = null;
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && cached.rates && (Date.now() - cached.timestamp < 12 * 60 * 60 * 1000)) {
          ratesData = cached.rates;
        }
      } catch (err) { /* sin cache */ }

      if (!ratesData) {
        console.log('[GmailAPI] Obteniendo tasas de cambio actualizadas...');
        const resp = await fetch('https://open.er-api.com/v6/latest/USD');
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.rates) {
            ratesData = json.rates;
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              rates: ratesData,
              timestamp: Date.now()
            }));
          }
        }
      }

      if (ratesData && ratesData[userCurrency] && ratesData[detectedCurrency]) {
        const rateFromDetectedToUser = ratesData[userCurrency] / ratesData[detectedCurrency];
        const converted = amount * rateFromDetectedToUser;
        const rounded = Math.round(converted * 100) / 100;
        console.log(`[GmailAPI] Conversión: ${amount} ${detectedCurrency} -> ${rounded} ${userCurrency} (Tasa: ${rateFromDetectedToUser.toFixed(4)})`);
        return {
          amount: rounded,
          note: ` (Conv. de ${this._conversionAmountText(amount, detectedCurrency)})`
        };
      }
    } catch (e) {
      console.error('[GmailAPI] Error en la conversión de moneda:', e);
    }
    return { amount, note: '' };
  }

  _conversionAmountText(amount, currency) {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', DOP: 'RD$', COP: 'COL$',
      MXN: 'MX$', ARS: 'ARS$', CLP: 'CLP$', PEN: 'S/.', BRL: 'R$'
    };
    const sym = symbols[currency] || currency;
    return `${sym}${amount}`;
  }

  _parseMerchant(text) {
    // Palabras que indican estado, no nombre de comercio
    const STATUS_WORDS = /^(estatus|estado|aprobad|declinad|pendiente|procesad|exitosa|fallid|rechazad)/i;

    const patterns = [
      // Tabla banco: "DD/MM/YYYY  NOMBRE COMERCIO  Aprobada/Declinada"
      // Captura lo que está entre la fecha y la palabra de estado
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+([A-Za-z][A-Za-z0-9 &'.,:/\-*]{2,60?})\s+(?:aprobad|declinad|pendiente|procesad|exitosa|fallid|rechazad)/i,
      // Etiqueta explícita de comercio seguida del valor (no otro encabezado)
      /(?:comercio|merchant|establecimiento|local)[:\s]+([A-Za-z0-9][A-Za-z0-9 &'.,:/\-*]{2,60})/i,
      /(?:compra en|pago en|cargo en|consumo en)[:\s]+([A-Za-z0-9 &'.,:/\-]{2,50})/i,
      /(?:en|at)\s+([A-Z][A-Za-z0-9 &'.,:/\-]{2,50})/,
      /(?:descripci[oó]n|concepto)[:\s]+([A-Za-z0-9 &'.,:/\-]{2,50})/i,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (!m) continue;

      let merchant = m[1].trim();

      // Ignorar si es una palabra de estado, no un comercio real
      if (STATUS_WORDS.test(merchant)) continue;

      // Red de tarjetas repite el nombre: "DIDI RIDES-W*DIDI RIDES-W" → "DIDI RIDES-W"
      if (merchant.includes('*')) {
        merchant = merchant.split('*')[0].trim();
      }

      if (merchant.length >= 2) return merchant;
    }
    return null;
  }

  _normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  _isDeclined(text) {
    const t = this._normalizeText(text);
    const declinedPatterns = [
      /declinad/, /rechazad/, /denegad/, /no\s+aprobad/, /transaccion\s+fallid/,
      /operacion\s+fallid/, /no\s+procesad/, /error\s+en\s+la\s+transaccion/
    ];
    return declinedPatterns.some((p) => p.test(t));
  }

  _detectTransactionType(text) {
    const t = this._normalizeText(text);
    const incomePatterns = [
      /abono/, /deposito/, /acreditad/, /acreditacion/, /ingreso/, /nomina/,
      /transferencia\s+recibid/, /transferencia\s+entrante/, /reembolso/, /devolucion/
    ];
    const expensePatterns = [
      /consumo/, /compra/, /cargo/, /debito/, /débito/, /retiro/, /pago/,
      /transferencia\s+enviad/, /transferencia\s+saliente/
    ];

    const incomeScore = incomePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);
    const expenseScore = expensePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);

    if (incomeScore > expenseScore) return 'income';
    return 'expense';
  }

  _parseDate(dateHeader, body) {
    // Primero intentar el encabezado Date del correo (más confiable)
    if (dateHeader) {
      const d = new Date(dateHeader);
      if (!isNaN(d.getTime())) return d;
    }
    // DD/MM/YYYY o DD-MM-YYYY
    const m1 = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m1) {
      const d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD
    const m2 = body.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) {
      const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }
}

window.GmailAPI = new GmailAPI();
