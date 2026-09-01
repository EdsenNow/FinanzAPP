const functions = require('firebase-functions');
let functionsV1;
try {
  functionsV1 = require('firebase-functions/v1');
} catch (e) {
  functionsV1 = functions;
}
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

admin.initializeApp();

const KMS_KEY_NAME = process.env.KMS_KEY_NAME || null;

async function encryptKms(plaintext) {
  if (!plaintext) return null;
  if (!KMS_KEY_NAME) {
    console.warn('[KMS] KMS_KEY_NAME not set, storing plaintext (not secure)');
    return plaintext;
  }
  // Cargar @google-cloud/kms dinámicamente solo cuando esté configurado
  const {KeyManagementServiceClient} = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.encrypt({ name: KMS_KEY_NAME, plaintext: Buffer.from(plaintext) });
  return result.ciphertext.toString('base64');
}

async function decryptKms(ciphertextBase64) {
  if (!ciphertextBase64) return null;
  if (!KMS_KEY_NAME) {
    return ciphertextBase64;
  }
  const {KeyManagementServiceClient} = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.decrypt({ name: KMS_KEY_NAME, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
  return result.plaintext.toString();
}

const app = express();
const ADMIN_UIDS = new Set(
  (process.env.REPROCESS_ADMIN_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://byfinanzapp.com,https://www.byfinanzapp.com,https://finanzapp-fb.web.app,https://finanzapp-fb.firebaseapp.com,http://localhost:5000,http://127.0.0.1:5000,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 120);
const RATE_LIMITED_PATHS = new Set(['/exchangeCode', '/refreshAccessToken', '/gmail/startWatch', '/gmail/stopWatch', '/admin/reprocess']);
const APPCHECK_PROTECTED_PATHS = new Set(['/exchangeCode', '/refreshAccessToken', '/gmail/startWatch', '/gmail/stopWatch']);
const ENFORCE_APPCHECK = String(process.env.ENFORCE_APPCHECK || 'false').toLowerCase() === 'true';

const rateLimitBuckets = new Map();

function normalizeOrigin(origin) {
  return String(origin || '').trim().toLowerCase();
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const o = normalizeOrigin(origin);
  if (ALLOWED_ORIGINS.has(o)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(o) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(o)) {
    return true;
  }
  return false;
}

function getRequestIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function consumeRateLimit(key, maxHits = API_RATE_LIMIT_MAX, windowMs = API_RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || now > current.resetAt) {
    rateLimitBuckets.set(key, { hits: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.hits >= maxHits) {
    return false;
  }
  current.hits += 1;
  return true;
}

function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) return null;
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function verifyAppCheckRequest(req) {
  const token = req.headers?.['x-firebase-appcheck'];
  if (!token) return false;
  try {
    await admin.appCheck().verifyToken(String(token));
    return true;
  } catch (e) {
    return false;
  }
}

async function verifyUserRequest(req, expectedUid) {
  if (!expectedUid) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.uid === expectedUid) return decoded;
    if (decoded.admin === true || ADMIN_UIDS.has(decoded.uid)) return decoded;
    return null;
  } catch (e) {
    return null;
  }
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  return next();
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('origin_not_allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  if (!RATE_LIMITED_PATHS.has(req.path)) return next();
  const ip = getRequestIp(req);
  const key = `${req.path}:${ip}`;
  if (!consumeRateLimit(key)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }
  return next();
});

app.use(async (req, res, next) => {
  if (!ENFORCE_APPCHECK || !APPCHECK_PROTECTED_PATHS.has(req.path)) return next();
  const isValid = await verifyAppCheckRequest(req);
  if (!isValid) {
    const bearer = getBearerToken(req);
    if (bearer) {
      try {
        const decoded = await admin.auth().verifyIdToken(bearer);
        if (decoded && decoded.uid) return next();
      } catch (e) {}
    }
    return res.status(401).json({ error: 'invalid_app_check' });
  }
  return next();
});


app.use(express.json({ limit: '100kb' }));

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || process.env.REDIRECT_URI || 'postmessage';

const GMAIL_RUNTIME_SECRETS = ['GMAIL_CLIENT_SECRET'];
// Pub/Sub topic to receive Gmail push notifications (full path and short name)
const GMAIL_PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC || `projects/${process.env.GCLOUD_PROJECT}/topics/gmail-notifications`;
const GMAIL_PUBSUB_SHORT = process.env.GMAIL_PUBSUB_SHORT || 'gmail-notifications';
// Renovar watches antes de expirar (margen en ms). Por defecto: 5 minutos.
const GMAIL_WATCH_RENEW_MARGIN_MS = Number(process.env.GMAIL_WATCH_RENEW_MARGIN_MS || (5 * 60 * 1000)); // 5 minutos por defecto
// Programación para la tarea de renovación. Puede configurarse con env var.
const GMAIL_WATCH_RENEW_SCHEDULE = process.env.GMAIL_WATCH_RENEW_SCHEDULE || 'every 5 minutes';

function isInvalidGrantError(err) {
  const d = err && err.response && err.response.data ? err.response.data : null;
  const code = d && typeof d === 'object' ? d.error : (typeof d === 'string' ? d : null);
  const desc = d && typeof d === 'object' ? (d.error_description || '') : (typeof d === 'string' ? d : '');
  return code === 'invalid_grant' || (typeof desc === 'string' && /expired|revoked|invalid_grant/i.test(desc));
}

async function clearUserGmailTokens(uid) {
  try {
    await admin.firestore().collection('users').doc(uid).set({
      gmail: {
        encrypted_refresh_token: admin.firestore.FieldValue.delete(),
        refresh_token: admin.firestore.FieldValue.delete(),
        tokens: admin.firestore.FieldValue.delete()
      }
    }, { merge: true });
    console.log('[gmail] cleared refresh token for', uid);
  } catch (e) {
    console.warn('[gmail] failed clearing refresh token for', uid, e);
  }
}

app.post('/exchangeCode', async (req, res) => {
  const { code, uid } = req.body || {};
  if (!code || !uid) return res.status(400).json({ error: 'missing code or uid' });

  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const redirectUri = req.body.redirect_uri || REDIRECT_URI || 'postmessage';
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    let tokenResp;
    try {
      tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch (e1) {
      if (redirectUri !== 'postmessage') {
        params.set('redirect_uri', 'postmessage');
        tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
      } else {
        throw e1;
      }
    }

    const tokens = tokenResp.data;

    const gmailDoc = {
      tokens: tokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (tokens.refresh_token) {
      gmailDoc.refresh_token = tokens.refresh_token;
      gmailDoc.encrypted_refresh_token = await encryptKms(tokens.refresh_token);
    }

    await admin.firestore().collection('users').doc(uid).set({
      gmail: gmailDoc
    }, { merge: true });

    res.json({
      success: true,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in || 3600
    });

  } catch (err) {
    const errData = err?.response?.data;
    console.error('exchangeCode error', errData || err.message);
    
    let errMsg = errData?.error_description || errData?.error || err.message;
    if (typeof errMsg === 'object') {
      errMsg = JSON.stringify(errMsg);
    }
    
    if (errMsg.includes('invalid_client') || errMsg.includes('invalid_grant') || errMsg.includes('unauthorized_client') || errMsg.includes('deleted_client')) {
      errMsg = 'Las credenciales de Google OAuth de tu proyecto Firebase (Client ID o Client Secret) no son válidas, están cruzadas, fueron eliminadas o están mal configuradas. Por favor, asegúrate de que coincidan con la consola de Google Cloud.';
    }
    
    res.status(500).json({ error: errMsg });
  }
});

// Permitir que Google redirija directamente con GET (útil para pruebas manuales
// o cuando se incluye el `state` con el `uid`). Responderá con una página simple.
app.get('/exchangeCode', async (req, res) => {
  const code = req.query.code;
  // uid puede venir como query param `uid` o en `state`
  const uid = req.query.uid || req.query.state;
  if (!code || !uid) {
    res.status(400).type('text/plain').send('Missing code or uid (provide uid as query param or as state)');
    return;
  }

  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) {
      res.status(403).type('text/plain').send('Unauthorized');
      return;
    }

    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('grant_type', 'authorization_code');

    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokens = tokenResp.data;

    // No sobrescribir el refresh_token guardado con null si Google no devuelve
    // uno nuevo (solo lo emite cuando hay consentimiento explícito).
    const gmailDoc = {
      tokens: tokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (tokens.refresh_token) {
      gmailDoc.refresh_token = tokens.refresh_token;
      gmailDoc.encrypted_refresh_token = await encryptKms(tokens.refresh_token);
    }

    await admin.firestore().collection('users').doc(uid).set({
      gmail: gmailDoc
    }, { merge: true });

    // Responder una página simple para el navegador
    res.status(200).type('text/html').send(`
      <html>
        <head><meta charset="utf-8"><title>Autorización completada</title></head>
        <body>
          <h2>Autorización completada</h2>
          <p>El código fue intercambiado y el refresh_token guardado para el usuario <strong>${uid}</strong>.</p>
          <p>Puedes cerrar esta pestaña y volver a la aplicación.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('exchangeCode (GET) error', err?.response?.data || err.message);
    const payload = err?.response?.data || { message: err?.message };
    res.status(500).type('application/json').send(JSON.stringify(payload, null, 2));
  }
});

app.get('/refreshAccessToken', async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'missing uid' });

  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const doc = await admin.firestore().collection('users').doc(uid).get();
    const data = doc.data();
    let refresh_token = null;
    try {
      const encrypted = data?.gmail?.encrypted_refresh_token;
      refresh_token = encrypted ? await decryptKms(encrypted) : data?.gmail?.refresh_token;
    } catch (kmsErr) {
      console.warn('[refreshAccessToken] KMS decrypt error:', kmsErr?.message);
      refresh_token = data?.gmail?.refresh_token || null;
    }

    if (!refresh_token) return res.status(200).json({ error: 'no refresh token', code: 'not_found' });

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refresh_token);

    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokens = tokenResp.data;

    // Guardar último access token metadata (opcional)
    await admin.firestore().collection('users').doc(uid).set({
      gmail: {
        lastAccess: tokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    res.json({ access_token: tokens.access_token, expires_in: tokens.expires_in, scope: tokens.scope });
  } catch (err) {
    const errData = err?.response?.data;
    const isInvalid = err?.code === 'invalid_grant' || errData?.error === 'invalid_grant' || err?.response?.status === 400 || err?.response?.status === 401;
    if (isInvalid) {
      try {
        await admin.firestore().collection('users').doc(uid).set({
          gmail: {
            encrypted_refresh_token: admin.firestore.FieldValue.delete(),
            refresh_token: admin.firestore.FieldValue.delete()
          }
        }, { merge: true });
      } catch (e) {
        console.warn('[refreshAccessToken] failed clearing tokens for', uid, e);
      }
      return res.status(401).json({ error: 'invalid_grant', message: 'refresh_token_revoked' });
    }
    console.error('refreshAccessToken error', errData || err.message);
    res.status(500).json({ error: errData || err.message });
  }
});

// Endpoint para iniciar un watch (configurar Gmail push -> Pub/Sub)
app.post('/gmail/startWatch', async (req, res) => {
  const uid = (req.body && req.body.uid) || req.query.uid;
  if (!uid) return res.status(400).json({ error: 'missing uid' });
  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const doc = await admin.firestore().collection('users').doc(uid).get();
    const data = doc.exists ? doc.data() : null;
    const encrypted = data?.gmail?.encrypted_refresh_token;
    const refresh_token = encrypted ? await decryptKms(encrypted) : data?.gmail?.refresh_token;
    if (!refresh_token) return res.status(200).json({ error: 'no refresh token', code: 'not_found' });

    const tokenData = await refreshAccessTokenWithRefreshToken(refresh_token);
    const access_token = tokenData.access_token;

    // Obtener email y historyId inicial
    const profileResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${access_token}` } });
    const emailAddress = profileResp.data?.emailAddress || null;
    const historyId = profileResp.data?.historyId || null;

    // Registrar watch apuntando al topic Pub/Sub
    const watchBody = { topicName: GMAIL_PUBSUB_TOPIC, labelIds: ['INBOX'] };
    const watchResp = await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/watch', watchBody, { headers: { Authorization: `Bearer ${access_token}` } });

    // Convertir expiration a número (ms desde epoch) y guardar metadata en Firestore
    const watchExpirationValue = watchResp.data && watchResp.data.expiration ? Number(watchResp.data.expiration) : null;
    await admin.firestore().collection('users').doc(uid).set({
      gmail: {
        watchedEmail: emailAddress,
        watchTopic: GMAIL_PUBSUB_TOPIC,
        watchExpiration: watchExpirationValue,
        lastHistoryId: historyId
      }
    }, { merge: true });

    if (emailAddress) {
      await admin.firestore().collection('gmailWatchers').doc(emailAddress).set({ uid, topicName: GMAIL_PUBSUB_TOPIC, lastHistoryId: historyId, watchExpiration: watchExpirationValue, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    res.json({ success: true, emailAddress, watch: watchResp.data || null });
  } catch (err) {
    console.error('/gmail/startWatch error', err?.response?.data || err.message || err);
    if (err && (err.code === 'invalid_grant' || isInvalidGrantError(err))) {
      try {
        await admin.firestore().collection('users').doc(uid).set({ gmail: { encrypted_refresh_token: admin.firestore.FieldValue.delete(), refresh_token: admin.firestore.FieldValue.delete() } }, { merge: true });
      } catch (e) {
        console.warn('[startWatch] failed clearing tokens for', uid, e);
      }
      return res.status(401).json({ error: 'invalid_grant', message: 'refresh_token_revoked' });
    }
    res.status(500).json({ error: err?.response?.data || err.message || String(err) });
  }
});

// Endpoint para detener el watch en Gmail (opcional)
app.post('/gmail/stopWatch', async (req, res) => {
  const uid = (req.body && req.body.uid) || req.query.uid;
  if (!uid) return res.status(400).json({ error: 'missing uid' });
  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const doc = await admin.firestore().collection('users').doc(uid).get();
    const data = doc.exists ? doc.data() : null;
    const emailAddress = data?.gmail?.watchedEmail || null;
    const encrypted = data?.gmail?.encrypted_refresh_token;
    const refresh_token = encrypted ? await decryptKms(encrypted) : data?.gmail?.refresh_token;

    if (refresh_token) {
      const tokenData = await refreshAccessTokenWithRefreshToken(refresh_token);
      const access_token = tokenData.access_token;
      // Llamar el endpoint stop de Gmail
      await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/stop', null, { headers: { Authorization: `Bearer ${access_token}` } });
    }

    // Limpiar metadata
    await admin.firestore().collection('users').doc(uid).set({ gmail: { watchedEmail: admin.firestore.FieldValue.delete(), watchTopic: admin.firestore.FieldValue.delete(), watchExpiration: admin.firestore.FieldValue.delete() } }, { merge: true });
    if (emailAddress) await admin.firestore().collection('gmailWatchers').doc(emailAddress).delete();

    res.json({ success: true, stopped: true });
  } catch (err) {
    console.error('/gmail/stopWatch error', err?.response?.data || err.message || err);
    if (err && (err.code === 'invalid_grant' || isInvalidGrantError(err))) {
      try {
        await admin.firestore().collection('users').doc(uid).set({ gmail: { encrypted_refresh_token: admin.firestore.FieldValue.delete(), refresh_token: admin.firestore.FieldValue.delete() } }, { merge: true });
      } catch (e) {
        console.warn('[stopWatch] failed clearing tokens for', uid, e);
      }
      return res.status(401).json({ error: 'invalid_grant', message: 'refresh_token_revoked' });
    }
    res.status(500).json({ error: err?.response?.data || err.message || String(err) });
  }
});

const { syncImapTransactions } = require('./src/imapSync');

app.post('/syncImap', async (req, res) => {
  const uid = (req.body && req.body.uid) || req.query.uid;
  if (!uid) return res.status(400).json({ error: 'missing uid' });

  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const doc = await admin.firestore().collection('users').doc(uid).get();
    const data = doc.exists ? doc.data() : null;
    const imapSettings = data?.imapSettings || data?.imap || {};
    
    if (!imapSettings.email || !imapSettings.appPassword) {
      return res.status(400).json({ error: 'Faltan credenciales IMAP (correo o contraseña de aplicación).' });
    }
    
    const targetSenders = imapSettings.targetSenders || [];
    if (!targetSenders.length) {
      return res.status(400).json({ error: 'No se han configurado remitentes (bancos) a escanear.' });
    }

    const result = await syncImapTransactions(
      imapSettings.email,
      imapSettings.appPassword,
      targetSenders,
      uid
    );

    res.json(result);
  } catch (err) {
    console.error('/syncImap error', err);
    res.status(500).json({ error: err.message || 'Error interno al sincronizar IMAP' });
  }
});

const REGION = process.env.FUNCTIONS_REGION || 'us-central1';

function regioned(runWithOptions = null) {
  if (functionsV1 && typeof functionsV1.region === 'function') {
    const builder = functionsV1.region(REGION);
    if (runWithOptions && typeof builder.runWith === 'function') {
      return builder.runWith(runWithOptions);
    }
    return builder;
  }
  if (typeof functions.region === 'function') {
    const builder = functions.region(REGION);
    if (runWithOptions && typeof builder.runWith === 'function') {
      return builder.runWith(runWithOptions);
    }
    return builder;
  }
  const fallback = functionsV1 || functions;
  if (runWithOptions && typeof fallback.runWith === 'function') {
    return fallback.runWith(runWithOptions);
  }
  return fallback;
}

exports.api = regioned({ secrets: GMAIL_RUNTIME_SECRETS }).https.onRequest(app);

// --------------------
// Server-side Gmail poller
// --------------------

function decodeBase64Url(input) {
  if (!input) return '';
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try {
    return Buffer.from(s, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    let raw = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      raw = raw.replace(/<[^>]+>/g, ' ');
      raw = raw.replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
    }
    return raw.replace(/\s{2,}/g, ' ').trim();
  }
  if (Array.isArray(payload.parts)) {
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    const plainPart = payload.parts.find(p => p.mimeType === 'text/plain');
    for (const part of [htmlPart, plainPart, ...payload.parts].filter(Boolean)) {
      const t = extractBody(part);
      if (t) return t;
    }
  }
  return '';
}

function normalizeText(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isDeclinedText(text) {
  const t = normalizeText(text);
  const declinedPatterns = [/declinad/, /rechazad/, /denegad/, /no\s+aprobad/, /transaccion\s+fallid/, /operacion\s+fallid/, /no\s+procesad/, /error\s+en\s+la\s+transaccion/];
  return declinedPatterns.some(p => p.test(t));
}

function parseAmount(text) {
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
    if (/,\d{2}$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0 && n < 10000000) return n;
  }
  return null;
}

function parseNumericAmount(value) {
  let raw = String(value || '').trim().replace(/\s/g, '');
  if (!raw) return null;
  if (/,\d{1,4}$/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else {
    raw = raw.replace(/,/g, '');
  }
  const n = parseFloat(raw);
  return !isNaN(n) && n > 0 && n < 10000000 ? n : null;
}

function currencyFromToken(token) {
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

function parseMoneyMentions(text) {
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
      const parsedAmount = parseNumericAmount(match[amountIndex]);
      const currency = currencyFromToken(match[tokenIndex]);
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

function scoreMoneyMention(mention) {
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
  const context = normalizeText(`${before.slice(beforeStart)} ${after.slice(0, afterEnd)}`);
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

function parseAmountInfo(text, preferredCurrency = null) {
  const mentions = parseMoneyMentions(text);
  if (mentions.length) {
    const scored = mentions.map(mention => ({ ...mention, score: scoreMoneyMention(mention) }));
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

  const patterns = [
    /(?:monto|importe|valor|cargo|compra|d[eé]bito|debito|pago|transacci[oó]n)[:\s]+(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. ]+)/i,
  ];
  for (const p of patterns) {
    const m = String(text || '').match(p);
    if (!m) continue;
    const n = parseNumericAmount(m[1]);
    if (n) return { amount: n, currency: null, index: m.index };
  }
  return null;
}



const DOP_USD_RATE_MIN = 40;
const DOP_USD_RATE_MAX = 120;

function isPlausibleEffectiveRate(fromCurrency, toCurrency, rate) {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  if (fromCurrency === 'USD' && toCurrency === 'DOP') {
    return rate >= DOP_USD_RATE_MIN && rate <= DOP_USD_RATE_MAX;
  }
  return rate < 100000;
}

function selectTransactionAmountInfo(text, userCurrency = 'USD') {
  // Simplified: do not try to detect/convert charged vs original amounts from email text.
  // Always return the amount detected in the email without applying any currency conversion.
  return parseAmountInfo(text, userCurrency);
}

async function saveLearnedBankRate(bankMeta, fromCurrency, toCurrency, rate, sample = {}) {
  if (!bankMeta || !bankMeta.label || !isPlausibleEffectiveRate(fromCurrency, toCurrency, rate)) return;
  const bankKey = normalizeKey(bankMeta.label);
  const update = {
    bankLabel: bankMeta.label,
    bankKey,
    country: bankMeta.country || null,
    base: fromCurrency,
    rates: {
      [toCurrency]: rate
    },
    sourceName: 'email_effective',
    sourceUrl: null,
    lastEffectiveRate: rate,
    lastEffectiveRatePair: `${fromCurrency}/${toCurrency}`,
    lastSample: {
      originalAmount: sample.originalAmount || null,
      chargedAmount: sample.chargedAmount || null,
      messageId: sample.messageId || null,
      subject: sample.subject || null
    },
    samplesCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    learnedAt: admin.firestore.Timestamp.fromDate(new Date()),
    status: 'learned'
  };

  try {
    await admin.firestore().collection('bankRates').doc(bankKey).set(update, { merge: true });
    delete cachedBankRates[bankKey];
    delete cachedBankRatesTimestamps[bankKey];
  } catch (err) {
    console.warn('[saveLearnedBankRate] failed', bankKey, err && err.message ? err.message : err);
  }
}

function parseMerchant(text, amountInfo, headers) {
  const STATUS_WORDS = /^(estatus|estado|aprobad|declinad|pendiente|procesad|exitosa|fallid|rechazad)/i;
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();

  // 1) Try explicit patterns in full text
  const patterns = [
    /(?:comercio|merchant|establecimiento|local)[:\-\s]+([A-Za-z0-9][A-Za-z0-9 &'.,:\/\-*]{2,80})/i,
    /(?:compra en|pago en|cargo en|consumo en|compras en|pago a|pago con)[:\-\s]+([A-Za-z0-9 &'.,:\/\-]{2,80})/i,
    /(?:descripci[oó]n|concepto)[:\-\s]+([A-Za-z0-9 &'.,:\/\-]{2,80})/i,
    /\bde\s+([A-Z][A-Za-z0-9 &'.,:\/\-]{2,80})\b/, // "de Comercio XYZ"
    /\ben\s+([A-Z][A-Za-z0-9 &'.,:\/\-]{2,80})\b/ // generic "en Mercado X"
  ];

  const full = String(text || '');
  for (const p of patterns) {
    const m = full.match(p);
    if (!m) continue;
    let merchant = normalize(m[1]);
    if (STATUS_WORDS.test(merchant)) continue;
    merchant = merchant.split('*')[0].trim();
    merchant = merchant.replace(/\b(?:pos|visa|mastercard|tarjeta|debito|credito)\b/gi, '').trim();
    if (merchant.length >= 2) return merchant;
  }

  // 2) Try context around detected amount (more reliable)
  try {
    const ctx = (amountInfo && (amountInfo.before || amountInfo.after)) ? `${amountInfo.before || ''} ${amountInfo.after || ''}` : '';
    if (ctx) {
      for (const p of patterns) {
        const m = ctx.match(p);
        if (!m) continue;
        let merchant = normalize(m[1]);
        if (STATUS_WORDS.test(merchant)) continue;
        merchant = merchant.split('*')[0].trim();
        merchant = merchant.replace(/\b(?:pos|visa|mastercard|tarjeta|debito|credito)\b/gi, '').trim();
        if (merchant.length >= 2) return merchant;
      }

      // fallback: try to extract a short run of capitalized words near amount
      const capMatch = ctx.match(/([A-Z][A-Za-z0-9&\.-]{1,}\s+(?:[A-Z][A-Za-z0-9&\.-]{1,}\s*){0,2})/);
      if (capMatch) {
        let m = normalize(capMatch[1]);
        m = m.replace(/[^A-Za-z0-9 &'\.\-]/g, '').trim();
        if (!STATUS_WORDS.test(m) && m.length >= 2) return m;
      }
    }
  } catch (e) {
    // ignore
  }

  // 3) Use From header (sender name) as last resort
  try {
    if (Array.isArray(headers)) {
      const from = headers.find(h => h.name && h.name.toLowerCase() === 'from');
      if (from && from.value) {
        // value could be: "MercadoPago <no-reply@mercadopago.com>" or "Banco Popular"
        const v = from.value;
        const name = v.split('<')[0].replace(/\"/g, '').trim();
        let candidate = normalize(name);
        // if email only, take local-part
        if (!candidate || candidate.includes('@')) {
          const local = v.split('@')[0] || '';
          candidate = local.replace(/[-_.]/g, ' ').replace(/\d+/g, '').trim();
        }
        candidate = candidate.replace(/\b(?:no reply|noreply|no-reply|alerta|info|aviso)\b/gi, '').trim();
        if (candidate && candidate.length >= 2 && !STATUS_WORDS.test(candidate)) return candidate;
      }
    }
  } catch (e) {}

  return null;
}

function detectTransactionType(text) {
  const t = normalizeText(text);
  const incomePatterns = [/abono/, /deposito/, /acreditad/, /acreditacion/, /ingreso/, /nomina/, /transferencia\s+recibid/, /transferencia\s+entrante/, /reembolso/, /devolucion/];
  const expensePatterns = [/consumo/, /compra/, /cargo/, /debito/, /d[eé]bito/, /retiro/, /pago/, /transferencia\s+enviad/, /transferencia\s+saliente/];
  const incomeScore = incomePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);
  const expenseScore = expensePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);
  if (incomeScore > expenseScore) return 'income';
  return 'expense';
}

function parseDate(dateHeader, body) {
  if (dateHeader) {
    const d = new Date(dateHeader);
    if (!isNaN(d.getTime())) return d;
  }
  const m1 = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) {
    const d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const m2 = body.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

let cachedRates = null;
let cachedRatesTimestamp = 0;

async function getExchangeRates() {
  if (cachedRates && (Date.now() - cachedRatesTimestamp < 12 * 60 * 60 * 1000)) {
    return cachedRates;
  }
  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    if (res.data && res.data.rates) {
      cachedRates = res.data.rates;
      cachedRatesTimestamp = Date.now();
      return cachedRates;
    }
  } catch (err) {
    console.error('[gmailPoller] error fetching exchange rates', err.message);
  }
  return cachedRates || { USD: 1 };
}

function detectCurrencyFromText(text) {
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

// --- Listado de bancos por país y detección ---
const BANKS = [
  // República Dominicana
  { label: 'Banreservas', country: 'DO', patterns: ['banreservas', 'banco de reservas', 'banco reservas', 'reservas'], defaultSpread: 1.5 },
  { label: 'Banco Popular', country: 'DO', patterns: ['banco popular', 'banco popular dominicano', 'popular'], defaultSpread: 1.5 },
  { label: 'BHD León', country: 'DO', patterns: ['bhd', 'bhd leon', 'bhdleon', 'bhd le?n'], defaultSpread: 2.0 },
  { label: 'Asociación Popular', country: 'DO', patterns: ['asociacion popular', 'asociaci?n popular', 'apap'], defaultSpread: 2.0 },
  { label: 'Scotiabank RD', country: 'DO', patterns: ['scotiabank', 'scotia bank', 'scotiabank rd'], defaultSpread: 2.0 },
  { label: 'Banco Santa Cruz', country: 'DO', patterns: ['banco santa cruz', 'santa cruz'], defaultSpread: 2.0 },
  { label: 'ACAP', country: 'DO', patterns: ['acap', 'asociacion cibao', 'asociaci?n cibao'], defaultSpread: 2.0 },
  { label: 'Banco Promerica', country: 'DO', patterns: ['promerica'], defaultSpread: 2.0 },
  { label: 'Banco BDI', country: 'DO', patterns: ['bdi', 'banco bdi'], defaultSpread: 2.0 },
  { label: 'Banco López de Haro', country: 'DO', patterns: ['lopez de haro', 'l?pez de haro'], defaultSpread: 2.0 },

  // Brasil
  { label: 'Itaú Unibanco', country: 'BR', patterns: ['itau', 'itau unibanco', 'itauunibanco'], defaultSpread: 1.5 },
  { label: 'Banco do Brasil', country: 'BR', patterns: ['banco do brasil', 'banco brasil'], defaultSpread: 1.5 },
  { label: 'Bradesco', country: 'BR', patterns: ['bradesco'], defaultSpread: 1.5 },
  { label: 'Caixa Econômica', country: 'BR', patterns: ['caixa economica', 'caixa econ', 'caixa'], defaultSpread: 1.5 },
  { label: 'Santander Brasil', country: 'BR', patterns: ['santander brasil', 'santander'], defaultSpread: 1.5 },
  { label: 'BTG Pactual', country: 'BR', patterns: ['btg', 'btg pactual'], defaultSpread: 2.0 },
  { label: 'Banco Safra', country: 'BR', patterns: ['safra'], defaultSpread: 2.0 },
  { label: 'Nubank', country: 'BR', patterns: ['nubank'], defaultSpread: 2.0 },
  { label: 'Banco Inter', country: 'BR', patterns: ['banco inter', 'inter'], defaultSpread: 2.0 },
  { label: 'C6 Bank', country: 'BR', patterns: ['c6 bank', 'c6bank'], defaultSpread: 2.0 },

  // Perú
  { label: 'BCP', country: 'PE', patterns: ['bcp', 'banco de cr[eé]dito del per[uú]', 'banco de credito'], defaultSpread: 1.5 },
  { label: 'BBVA Perú', country: 'PE', patterns: ['bbva peru', 'bbva'], defaultSpread: 1.5 },
  { label: 'Interbank', country: 'PE', patterns: ['interbank'], defaultSpread: 1.5 },
  { label: 'Scotiabank Perú', country: 'PE', patterns: ['scotiabank peru', 'scotiabank'], defaultSpread: 1.5 },
  { label: 'Banco de la Nación', country: 'PE', patterns: ['banco de la naci[oó]n', 'banco de la nacion'], defaultSpread: 1.5 },
  { label: 'BanBif', country: 'PE', patterns: ['banbif'], defaultSpread: 1.5 },
  { label: 'MiBanco', country: 'PE', patterns: ['mibanco'], defaultSpread: 2.0 },

  // Chile
  { label: 'BCI', country: 'CL', patterns: ['bci', 'banco de cr[eé]dito e inversiones'], defaultSpread: 1.5 },
  { label: 'Banco Santander Chile', country: 'CL', patterns: ['santander chile', 'santander'], defaultSpread: 1.5 },
  { label: 'Banco Estado', country: 'CL', patterns: ['bancoestado', 'banco estado', 'banco del estado'], defaultSpread: 1.5 },
  { label: 'Banco de Chile', country: 'CL', patterns: ['banco de chile', 'banco chile'], defaultSpread: 1.5 },
  { label: 'Scotiabank Chile', country: 'CL', patterns: ['scotiabank'], defaultSpread: 1.5 },

  // Argentina
  { label: 'Banco de la Nación Argentina', country: 'AR', patterns: ['banco de la naci[oó]n argentina', 'bna', 'banco nacion'], defaultSpread: 2.0 },
  { label: 'Banco Galicia', country: 'AR', patterns: ['galicia', 'banco galicia'], defaultSpread: 2.0 },
  { label: 'Banco Provincia', country: 'AR', patterns: ['banco provincia', 'bapro'], defaultSpread: 2.0 },
  { label: 'Santander Argentina', country: 'AR', patterns: ['santander'], defaultSpread: 2.0 },
  { label: 'BBVA Argentina', country: 'AR', patterns: ['bbva'], defaultSpread: 2.0 },
  { label: 'Banco Macro', country: 'AR', patterns: ['macro', 'banco macro'], defaultSpread: 2.0 },

  // México
  { label: 'BBVA México', country: 'MX', patterns: ['bbva m[eé]xico', 'bbva'], defaultSpread: 1.5 },
  { label: 'Banorte', country: 'MX', patterns: ['banorte', 'banco mercantil del norte'], defaultSpread: 1.5 },
  { label: 'Santander México', country: 'MX', patterns: ['santander mexico', 'santander'], defaultSpread: 1.5 },
  { label: 'Citibanamex', country: 'MX', patterns: ['citibanamex', 'banamex'], defaultSpread: 1.5 },
  { label: 'Scotiabank México', country: 'MX', patterns: ['scotiabank'], defaultSpread: 1.5 },

  // Colombia
  { label: 'Bancolombia', country: 'CO', patterns: ['bancolombia'], defaultSpread: 1.5 },
  { label: 'Banco de Bogotá', country: 'CO', patterns: ['banco de bogota', 'banco bogota'], defaultSpread: 1.5 },
  { label: 'Davivienda', country: 'CO', patterns: ['davivienda'], defaultSpread: 1.5 },
  { label: 'BBVA Colombia', country: 'CO', patterns: ['bbva'], defaultSpread: 1.5 },

  // Estados Unidos (nombres comunes)
  { label: 'JPMorgan Chase', country: 'US', patterns: ['jpmorgan', 'chase'], defaultSpread: 1.0 },
  { label: 'Bank of America', country: 'US', patterns: ['bank of america', 'boa'], defaultSpread: 1.0 },
  { label: 'Citigroup', country: 'US', patterns: ['citigroup', 'citibank'], defaultSpread: 1.0 },
  { label: 'Wells Fargo', country: 'US', patterns: ['wells fargo'], defaultSpread: 1.0 },

  // Reino Unido / Europa (muestras)
  { label: 'HSBC', country: 'GB', patterns: ['hsbc'], defaultSpread: 1.0 },
  { label: 'Barclays', country: 'GB', patterns: ['barclays'], defaultSpread: 1.0 },
  { label: 'Deutsche Bank', country: 'EU', patterns: ['deutsche bank'], defaultSpread: 1.0 },
  { label: 'Banco Santander', country: 'EU', patterns: ['santander'], defaultSpread: 1.0 }
];

function normalizeKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function detectBankFromText(text) {
  if (!text) return { label: null, defaultSpread: 1.34 };
  const t = normalizeText(text);
  for (const b of BANKS) {
    for (const p of b.patterns) {
      if (!p) continue;
      // usar contains en texto normalizado
      if (t.includes(p.replace(/\s+/g, ' '))) return b;
    }
  }
  return { label: null, defaultSpread: 1.34 };
}

// Cache simple para tasas por banco
const cachedBankRates = {};
const cachedBankRatesTimestamps = {};
const BANK_RATES_TTL = 12 * 60 * 60 * 1000; // 12 horas

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let raw = value.trim().replace(/\s/g, '');
  if (!raw) return null;
  if (/,\d{1,4}$/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else {
    raw = raw.replace(/,/g, '');
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizePairRate(rate, baseCurrency, targetCurrency) {
  if (!rate || rate <= 0) return null;
  // USD/DOP is often stored as DOP per USD. Guard the reverse conversion.
  if (baseCurrency === 'USD' && targetCurrency === 'DOP' && rate > 1) {
    return 1 / rate;
  }
  return rate;
}

function resolveRateFromBankData(data, baseCurrency, targetCurrency) {
  if (!data) return null;

  if (data.pairs && typeof data.pairs === 'object') {
    const directPairKey = `${baseCurrency}/${targetCurrency}`;
    const reversePairKey = `${targetCurrency}/${baseCurrency}`;
    const directPair = toNumber(data.pairs[directPairKey]);
    if (directPair) return normalizePairRate(directPair, baseCurrency, targetCurrency);
    const reversePair = toNumber(data.pairs[reversePairKey]);
    if (reversePair) return normalizePairRate(reversePair, baseCurrency, targetCurrency);
  }

  if (data.base && data.rates && typeof data.rates === 'object') {
    const base = String(data.base).toUpperCase();
    const rates = data.rates;

    if (base === targetCurrency) {
      const rate = toNumber(rates[baseCurrency]);
      if (rate) return rate;
    }

    if (base === baseCurrency) {
      const rate = toNumber(rates[targetCurrency]);
      if (rate) return 1 / rate;
    }

    const baseRate = toNumber(rates[baseCurrency]);
    const targetRate = toNumber(rates[targetCurrency]);
    if (baseRate && targetRate) return baseRate / targetRate;
  }

  return null;
}

/**
 * Obtener tasa para un banco (intenta Firestore -> si no, usa mercado+spread).
 * Formato esperado en Firestore: collection 'bankRates' docId = normalizeKey(label)
 * doc.data() puede exponer:
 *  - pairs: { 'USD/DOP': 56.5 }
 *  - base: 'USD', rates: { 'DOP': 56.5 }
 *  - spread: 1.5 (porcentaje a aplicar sobre la tasa de mercado)
 */
async function getBankRate(bankMeta, baseCurrency, targetCurrency) {
  const bankKey = normalizeKey(bankMeta && bankMeta.label ? bankMeta.label : (bankMeta || 'market'));
  const now = Date.now();
  if (cachedBankRates[bankKey] && (now - (cachedBankRatesTimestamps[bankKey] || 0) < BANK_RATES_TTL)) {
    return { rate: cachedBankRates[bankKey], source: 'cache' };
  }

  // Intentar leer de Firestore
  try {
    const doc = await admin.firestore().collection('bankRates').doc(bankKey).get();
    if (doc.exists) {
      const data = doc.data();
      if (data) {
        const resolvedRate = resolveRateFromBankData(data, baseCurrency, targetCurrency);
        if (resolvedRate) {
          cachedBankRates[bankKey] = resolvedRate;
          cachedBankRatesTimestamps[bankKey] = now;
          return { rate: resolvedRate, source: data.sourceName ? `bank:${data.sourceName}` : 'bank:rates', bankData: data };
        }

        // 2) si el documento contiene 'spread' podemos aplicarlo sobre el mercado
        if (typeof data.spread === 'number') {
          const market = await getExchangeRates();
          if (market && market[baseCurrency] && market[targetCurrency]) {
            const marketRate = market[baseCurrency] / market[targetCurrency];
            const r = marketRate * (1 + (data.spread / 100));
            cachedBankRates[bankKey] = r;
            cachedBankRatesTimestamps[bankKey] = now;
            return { rate: r, source: 'bank:spread', spread: data.spread, bankData: data };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[getBankRate] firestore read error', bankKey, e && e.message ? e.message : e);
  }

  // Fallback: mercado + spread por defecto del banco
  try {
    const market = await getExchangeRates();
    if (market && market[baseCurrency] && market[targetCurrency]) {
      const marketRate = market[baseCurrency] / market[targetCurrency];
      const spreadPct = (bankMeta && (bankMeta.defaultSpread || bankMeta.spread)) ? (bankMeta.defaultSpread || bankMeta.spread) : 1.34;
      const r = marketRate * (1 + (spreadPct / 100));
      cachedBankRates[bankKey] = r;
      cachedBankRatesTimestamps[bankKey] = now;
      return { rate: r, source: 'market+spread', spread: spreadPct };
    }
  } catch (e) {
    console.warn('[getBankRate] market fallback error', e && e.message ? e.message : e);
  }

  // Último recurso: devolver la tasa de mercado sin spread
  const market = await getExchangeRates();
  const finalRate = (market && market[baseCurrency] && market[targetCurrency]) ? (market[baseCurrency] / market[targetCurrency]) : 1;
  cachedBankRates[bankKey] = finalRate;
  cachedBankRatesTimestamps[bankKey] = now;
  return { rate: finalRate, source: 'market' };
}
async function parseMessageToTransactionAsync(msg, userCurrency = 'USD') {
  try {
    const headers = (msg.payload && msg.payload.headers) || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const dateHeader = headers.find(h => h.name === 'Date')?.value || '';
    const body = extractBody(msg.payload);
    const fullText = `${subject}\n${body}`;

    // PREVENCIÓN DE SPAM, PUBLICIDAD, ESTADOS DE CUENTA Y FALSOS POSITIVOS:
    // 1. Filtrado de estados de cuenta, ofertas de empleo, anuncios, promociones y newsletters
    const spamMarketingRegex = /(estado de cuenta|extracto|resumen de cuenta|resumen de saldo|balance de cuenta|balance mensual|informe de cuenta|estado de tarjeta|resumen mensual|alerta de inicio de sesi[oó]n|intento de acceso|cambio de contrase[nñ]a|empleo|vacante|postula|bolet[ií]n|newsletter|publicidad|descuento|ofert|promoci[oó]n|suscr[ií]bete|unsubscribe|darse de baja|ver en navegador|tienes hamb|lugares nuevos|soluciones|ahorro\s*🎨|bolsa de trabajo|linkedIn|glassdoor|indeed|career|hiring|trabajo|pide tu s[uú]per|como pides tu comida|c[oó]digo de verificaci[oó]n|verificar tu correo|clave temporal|otp|security code)/i;
    if (spamMarketingRegex.test(subject) || spamMarketingRegex.test(fullText)) {
      return null;
    }


    // 2. Validar que tenga palabras clave de transacciones bancarias o comerciales
    const isTransaction = /(monto|importe|cargo|compra|consumo|d[eé]bito|debito|pago|transacci[oó]n|recibo|factura|viaje|transferencia|notificaci[oó]n|alerta|aprobada|banco|bhd|popular|banreservas|scotiabank|visa|mastercard|paypal|stripe|voucher)/i.test(fullText);
    if (!isTransaction) return null;

    const declined = isDeclinedText(fullText);
    const amountInfo = selectTransactionAmountInfo(fullText, userCurrency);

    // 3. Si el monto detectado tiene un "score" negativo (es decir, el algoritmo cree que es un saldo o no tiene sentido de pago), lo ignoramos.
    if (amountInfo && amountInfo.score !== undefined && amountInfo.score < 0) {
      return null;
    }


    let amount = amountInfo ? amountInfo.amount : parseAmount(fullText);
    if (!amount) return null;

    // 3. Prevenir montos irrisorios que suelen ser errores de parsing (ej. $0.06 de código fuente o CSS)
    if (amount < 0.1) return null;

    // Preparar metadatos para la conversión
    const detectedCurrency = amountInfo && amountInfo.currency ? amountInfo.currency : detectCurrencyFromText(fullText);
    let note = '';
    // Metadatos default
    let originalAmount = amount;
    let originalCurrency = detectedCurrency || userCurrency;
    let bankMeta = { label: null, defaultSpread: 1.34 };
    let bankRateInfo = null;
    let rateUsed = 1;
    let rateSource = 'none';
    bankMeta = detectBankFromText(fullText) || { label: null, defaultSpread: 1.34 };

    // Política actual: NO realizar conversiones automáticas.
    // Preservar el monto detectado en el email y su moneda original.
    originalAmount = amount;
    originalCurrency = detectedCurrency || userCurrency;
    rateUsed = 1;
    rateSource = 'no_conversion';

    const description = parseMerchant(fullText, amountInfo, headers) || subject;
    const date = parseDate(dateHeader, fullText);
    const type = detectTransactionType(fullText);
    return {
      messageId: msg.id,
      subject,
      amount,
      originalAmount: originalAmount,
      originalCurrency: originalCurrency,
      appliedRate: rateUsed,
      rateSource: rateSource,
      rateFetchedAt: admin.firestore.Timestamp.fromDate(new Date()),
      bankName: bankMeta && bankMeta.label ? bankMeta.label : null,
      bankKey: bankMeta && bankMeta.label ? normalizeKey(bankMeta.label) : null,
      bankSpread: (bankRateInfo && typeof bankRateInfo.spread === 'number') ? bankRateInfo.spread : (bankMeta && bankMeta.defaultSpread ? bankMeta.defaultSpread : null),
      description: description.substring(0, 80),
      date: admin.firestore.Timestamp.fromDate(date),
      type,
      status: declined ? 'rejected' : 'approved',
      rawPreview: fullText.substring(0, 1000),
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  } catch (e) {
    return null;
  }
}

function conversionAmountText(amount, currency) {
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', DOP: 'RD$', COP: 'COL$',
    MXN: 'MX$', ARS: 'ARS$', CLP: 'CLP$', PEN: 'S/.', BRL: 'R$'
  };
  const sym = symbols[currency] || currency;
  return `${sym}${amount}`;
}

function refreshAccessTokenWithRefreshToken(refresh_token) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refresh_token);
  return axios.post('https://oauth2.googleapis.com/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(r => r.data).catch(err => {
    if (isInvalidGrantError(err)) {
      const e = new Error('invalid_grant');
      e.code = 'invalid_grant';
      e.original = err;
      throw e;
    }
    throw err;
  });
}

// Legacy scheduled poller removed: Gmail push (Pub/Sub) + `gmailPubSubHandler` now handle inbox changes.
// The previous scheduled Cloud Function `gmailPoller` (every 5 minutes) has been intentionally removed.
// If you need to re-enable polling, restore the function from version control or implement a cron-based fallback.

// Cloud Function para manejar notificaciones push de Gmail (Pub/Sub)
async function gmailPubSubHandlerImpl(message) {
  try {
    const raw = message.data ? Buffer.from(message.data, 'base64').toString('utf8') : null;
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (e) {
        payload = message.json || {};
        console.warn('[gmailPubSub] raw message data is not JSON, falling back to message.json/attributes');
      }
    } else {
      payload = message.json || {};
    }
    const emailAddress = payload?.emailAddress || payload?.email || message.attributes?.emailAddress;
    const historyId = payload?.historyId || null;
    if (!emailAddress) {
      console.log('[gmailPubSub] missing emailAddress in message, skipping');
      return;
    }

    // Resolver uid a partir del mapeo guardado o del Auth user
    let watcherDoc = await admin.firestore().collection('gmailWatchers').doc(emailAddress).get();
    let uid = null;
    if (watcherDoc.exists) {
      uid = watcherDoc.data().uid;
    } else {
      try {
        const userRecord = await admin.auth().getUserByEmail(emailAddress);
        uid = userRecord.uid;
      } catch (e) {
        console.warn('[gmailPubSub] no uid found for email', emailAddress);
        return;
      }
    }

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const data = userDoc.exists ? userDoc.data() : {};
    const encrypted = data?.gmail?.encrypted_refresh_token;
    const refresh_token = encrypted ? await decryptKms(encrypted) : data?.gmail?.refresh_token;
    if (!refresh_token) return console.warn('[gmailPubSub] no refresh token for', uid);

    let tokenData;
    try {
      tokenData = await refreshAccessTokenWithRefreshToken(refresh_token);
    } catch (err) {
      if (err && (err.code === 'invalid_grant' || isInvalidGrantError(err))) {
        console.warn('[gmailPubSub] refresh token invalid for', uid, '- clearing tokens and watcher');
        try {
          await admin.firestore().collection('users').doc(uid).set({ gmail: { encrypted_refresh_token: admin.firestore.FieldValue.delete(), refresh_token: admin.firestore.FieldValue.delete() } }, { merge: true });
          if (watcherDoc && watcherDoc.exists && emailAddress) await admin.firestore().collection('gmailWatchers').doc(emailAddress).delete();
        } catch (e) {
          console.warn('[gmailPubSub] error clearing tokens/watchers for', uid, e);
        }
        return;
      }
      throw err;
    }
    const access_token = tokenData.access_token;

    let lastHistoryId = data?.gmail?.lastHistoryId || (watcherDoc.exists ? watcherDoc.data().lastHistoryId : null) || null;
    let messageIds = [];

    if (lastHistoryId) {
      try {
        const histUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(lastHistoryId)}&historyTypes=messageAdded&labelId=INBOX&maxResults=200`;
        const histResp = await axios.get(histUrl, { headers: { Authorization: `Bearer ${access_token}` } });
        const hdata = histResp.data;
        if (hdata && Array.isArray(hdata.history)) {
          for (const record of hdata.history) {
            for (const added of (record.messagesAdded || [])) {
              if (added?.message?.id) messageIds.push(added.message.id);
            }
          }
        }
        if (hdata.historyId) lastHistoryId = hdata.historyId;
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.warn('[gmailPubSub] historyId obsolete for', uid, '- resetting');
          lastHistoryId = null;
        } else {
          console.warn('[gmailPubSub] history.list error for', uid, err?.response?.data || err.message);
          lastHistoryId = null;
        }
      }
    }

    if (!lastHistoryId) {
      try {
        const profileResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${access_token}` } });
        if (profileResp.data && profileResp.data.historyId) {
          lastHistoryId = profileResp.data.historyId;
          await admin.firestore().collection('users').doc(uid).set({ gmail: { lastHistoryId } }, { merge: true });
          console.log('[gmailPubSub] initialized historyId for', uid);
        }
      } catch (err) {
        console.warn('[gmailPubSub] profile fetch error for', uid, err?.response?.data || err.message);
      }

      try {
        const listResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50', { headers: { Authorization: `Bearer ${access_token}` } });
        if (listResp.data && Array.isArray(listResp.data.messages)) {
          for (const m of listResp.data.messages) if (m?.id) messageIds.push(m.id);
        }
      } catch (err) {
        console.warn('[gmailPubSub] messages.list error for', uid, err?.response?.data || err.message);
      }
    }

    messageIds = Array.from(new Set(messageIds));
    const processedSet = new Set(Array.isArray(data?.gmail?.processedIds) ? data.gmail.processedIds : []);
    const toProcess = messageIds.filter(id => !processedSet.has(id));

    for (const mid of toProcess) {
      try {
        const msgResp = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${mid}?format=full`, { headers: { Authorization: `Bearer ${access_token}` } });
        const msg = msgResp.data;
        const userCurrency = data?.settings?.currency || 'USD';
        const parsed = await parseMessageToTransactionAsync(msg, userCurrency);
        if (parsed) {
          await admin.firestore().collection('users').doc(uid).collection('transactions').doc(mid).set(parsed);
          // Enviar notificación FCM si hay tokens
          try {
            const tokens = Array.isArray(data?.fcmTokens) ? data.fcmTokens : [];
            if (tokens.length) {
              const messagePayload = {
                notification: {
                  title: parsed.type === 'income' ? 'Ingreso detectado' : 'Nuevo movimiento',
                  body: `${parsed.description} • ${parsed.amount}`
                },
                tokens
              };
              await admin.messaging().sendMulticast(messagePayload);
            }
          } catch (e) {
            console.warn('[gmailPubSub] fcm send error', e?.message || e);
          }
        }
        processedSet.add(mid);
      } catch (err) {
        console.warn('[gmailPubSub] error processing message', mid, err?.response?.data || err.message);
      }
    }

    const procArr = Array.from(processedSet).slice(-500);
    await admin.firestore().collection('users').doc(uid).set({ gmail: { processedIds: procArr, lastHistoryId } }, { merge: true });
    await admin.firestore().collection('gmailWatchers').doc(emailAddress).set({ uid, lastHistoryId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  } catch (e) {
    console.error('[gmailPubSub] fatal error', e?.response?.data || e.message || e);
  }
}

exports.gmailPubSubHandler = regioned({ secrets: GMAIL_RUNTIME_SECRETS }).pubsub.topic(GMAIL_PUBSUB_SHORT).onPublish(gmailPubSubHandlerImpl);

// Scheduled function: renovar watches próximos a expirar
async function gmailWatchRenewImpl(context) {
  console.log('[gmailWatchRenew] running', new Date().toISOString());
  try {
    // Consultar solo usuarios cuyo watchExpiration esté dentro del margen
    const cutoff = Date.now() + GMAIL_WATCH_RENEW_MARGIN_MS;
    const usersSnap = await admin.firestore().collection('users').where('gmail.watchExpiration', '<=', cutoff).get();
    if (usersSnap.empty) {
      console.log('[gmailWatchRenew] no users with watches expiring soon');
      return null;
    }

    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const data = doc.data() || {};
      const watchExpiration = Number(data?.gmail?.watchExpiration || 0);
      const watchTopic = data?.gmail?.watchTopic || GMAIL_PUBSUB_TOPIC;
      if (!watchExpiration) continue;

      try {
        const encrypted = data?.gmail?.encrypted_refresh_token;
        const refresh_token = encrypted ? await decryptKms(encrypted) : data?.gmail?.refresh_token;
        if (!refresh_token) {
          console.warn('[gmailWatchRenew] no refresh token for', uid);
          continue;
        }

        const tokenData = await refreshAccessTokenWithRefreshToken(refresh_token);
        const access_token = tokenData.access_token;

        const watchBody = { topicName: watchTopic, labelIds: ['INBOX'] };
        const watchResp = await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/watch', watchBody, { headers: { Authorization: `Bearer ${access_token}` } });
        const newExpiration = watchResp.data && watchResp.data.expiration ? Number(watchResp.data.expiration) : null;

        await admin.firestore().collection('users').doc(uid).set({ gmail: { watchExpiration: newExpiration } }, { merge: true });

        // actualizar mapping gmailWatchers
        try {
          const profileResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${access_token}` } });
          const emailAddress = profileResp.data?.emailAddress || null;
          const historyId = profileResp.data?.historyId || data?.gmail?.lastHistoryId || null;
          if (emailAddress) {
            await admin.firestore().collection('gmailWatchers').doc(emailAddress).set({ uid, topicName: watchTopic, lastHistoryId: historyId, watchExpiration: newExpiration, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          }
        } catch (e) {
          console.warn('[gmailWatchRenew] profile fetch/update watchers failed for', uid, e?.message || e);
        }

        console.log('[gmailWatchRenew] renewed watch for', uid, 'newExpiration', newExpiration);
      } catch (err) {
        console.warn('[gmailWatchRenew] failed renewing watch for', uid, err?.response?.data || err.message || err);
      }
    }
  } catch (err) {
    console.error('[gmailWatchRenew] fatal error', err?.response?.data || err.message || err);
  }
  return null;
}

exports.gmailWatchRenew = regioned({ secrets: GMAIL_RUNTIME_SECRETS }).pubsub.schedule(GMAIL_WATCH_RENEW_SCHEDULE).onRun(gmailWatchRenewImpl);


// ---- Admin reprocess endpoint (queues job) ----
async function verifyAdminRequest(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.admin === true) return decoded;
    if (ADMIN_UIDS.has(decoded.uid)) return decoded;
    return null;
  } catch (e) {
    console.warn('[verifyAdminRequest] token verify failed', e && e.message ? e.message : e);
    return null;
  }
}

app.post('/admin/reprocess', async (req, res) => {
  try {
    const caller = await verifyAdminRequest(req);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const body = req.body || {};
    const targetUid = body.targetUid;
    if (!targetUid) return res.status(400).json({ error: 'missing targetUid' });

    const transactionIds = Array.isArray(body.transactionIds) ? body.transactionIds : null;
    const dateFrom = body.dateFrom ? admin.firestore.Timestamp.fromDate(new Date(body.dateFrom)) : null;
    const dateTo = body.dateTo ? admin.firestore.Timestamp.fromDate(new Date(body.dateTo)) : null;
    const mode = body.mode === 'dry' ? 'dry' : 'update';
    const requestedBatch = typeof body.batchSize === 'number' ? Math.max(10, Math.min(200, body.batchSize)) : 200;

    const job = {
      targetUid,
      transactionIds,
      dateFrom,
      dateTo,
      mode,
      batchSize: requestedBatch,
      status: 'queued',
      creatorUid: caller.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const jobRef = await admin.firestore().collection('reprocessJobs').add(job);
    console.log('[admin/reprocess] job queued', jobRef.id, 'by', caller.uid);
    return res.json({ jobId: jobRef.id, message: 'reprocess job queued' });
  } catch (e) {
    console.error('[admin/reprocess] error', e && e.message ? e.message : e);
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// Firestore worker triggered on job creation
async function reprocessJobOnCreateImpl(snap, ctx) {
  const jobRef = snap.ref;
  const job = snap.data() || {};
  try {
    await jobRef.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp(), progress: { processed: 0 } });

    const targetUid = job.targetUid;
    const batchSize = job.batchSize || 200;
    const mode = job.mode || 'update';

    // get user currency
    const userDoc = await admin.firestore().collection('users').doc(targetUid).get();
    const userCurrency = userDoc.exists ? (userDoc.data()?.settings?.currency || 'USD') : 'USD';

    // helper to process a single transaction doc snapshot
    const processDoc = async (docSnap, batch) => {
      if (!docSnap.exists) return;
      const data = docSnap.data();
      const docRef = docSnap.ref;

      const originalAmount = (typeof data.originalAmount === 'number') ? data.originalAmount : (typeof data.amount === 'number' ? data.amount : null);
      const originalCurrency = data.originalCurrency || userCurrency;
      if (originalAmount === null) return;

      // No automatic conversion: preserve original amounts and do not update them.
      const bankMeta = data.bankName ? { label: data.bankName, defaultSpread: data.bankSpread || 1.34 } : detectBankFromText(data.description || '');
      const rate = 1;
      const newAmount = originalAmount;
      const needUpdate = false;

      const logData = {
        transactionId: docRef.id,
        oldAmount: data.amount || null,
        newAmount,
        originalAmount,
        originalCurrency,
        appliedRate: rate,
        rateSource: bankRateInfo && bankRateInfo.source ? bankRateInfo.source : null,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (mode === 'dry') {
        // only write a log entry
        const logRef = jobRef.collection('logs').doc(docRef.id);
        batch.set(logRef, logData, { merge: true });
      } else if (needUpdate) {
        batch.update(docRef, {
          amount: newAmount,
          appliedRate: rate,
          rateSource: bankRateInfo && bankRateInfo.source ? bankRateInfo.source : null,
          rateFetchedAt: admin.firestore.Timestamp.fromDate(new Date()),
          lastReprocessedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const logRef = jobRef.collection('logs').doc(docRef.id);
        batch.set(logRef, logData, { merge: true });
      }
    };

    if (Array.isArray(job.transactionIds) && job.transactionIds.length) {
      // process explicit list of ids in chunks
      const ids = job.transactionIds;
      let total = 0;
      for (let i = 0; i < ids.length; i += batchSize) {
        const chunk = ids.slice(i, i + batchSize);
        const batch = admin.firestore().batch();
        const docs = await Promise.all(chunk.map(id => admin.firestore().collection('users').doc(targetUid).collection('transactions').doc(id).get()));
        for (const d of docs) {
          await processDoc(d, batch);
        }
        await batch.commit();
        total += docs.length;
        await jobRef.update({ 'progress.processed': admin.firestore.FieldValue.increment(docs.length) });
      }
    } else {
      // process by query with optional date filters
      let query = admin.firestore().collection('users').doc(targetUid).collection('transactions').orderBy('date');
      if (job.dateFrom) query = query.where('date', '>=', job.dateFrom);
      if (job.dateTo) query = query.where('date', '<=', job.dateTo);

      let lastDoc = null;
      let totalProcessed = 0;
      while (true) {
        let q = query.limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snapTrans = await q.get();
        if (snapTrans.empty) break;
        const batch = admin.firestore().batch();
        for (const doc of snapTrans.docs) {
          await processDoc(doc, batch);
        }
        await batch.commit();
        totalProcessed += snapTrans.size;
        lastDoc = snapTrans.docs[snapTrans.docs.length - 1];
        await jobRef.update({ 'progress.processed': totalProcessed, lastDocId: lastDoc.id });
      }
    }

    await jobRef.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('[reprocessJobOnCreate] completed', jobRef.id);
  } catch (err) {
    console.error('[reprocessJobOnCreate] error', err && err.message ? err.message : err);
    try { await jobRef.update({ status: 'failed', error: err && err.message ? err.message : String(err), failedAt: admin.firestore.FieldValue.serverTimestamp() }); } catch (e) { /* ignore */ }
  }
}

if (typeof functionsV1.region === 'function') {
  exports.reprocessJobOnCreate = functionsV1.region(REGION).runWith({ memory: '1GB', timeoutSeconds: 540 }).firestore.document('reprocessJobs/{jobId}').onCreate(reprocessJobOnCreateImpl);
} else {
  exports.reprocessJobOnCreate = functionsV1.runWith({ memory: '1GB', timeoutSeconds: 540 }).firestore.document('reprocessJobs/{jobId}').onCreate(reprocessJobOnCreateImpl);
}
