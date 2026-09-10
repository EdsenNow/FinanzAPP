const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const axios = require('axios');
const { encryptSecret, decryptKms } = require('../cryptoHelper');
const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GMAIL_PUBSUB_TOPIC,
  isInvalidGrantError,
  refreshAccessTokenWithRefreshToken
} = require('../gmailHelper');

/**
 * Registra y exporta las rutas de autenticación y sincronización Gmail Push.
 * @param {Function} verifyUserRequest - Validador de autorización Bearer token
 * @returns {express.Router}
 */
module.exports = function createGmailRoutes(verifyUserRequest) {

  // Intercambio de código OAuth por tokens (POST desde la web app)
  router.post('/exchangeCode', async (req, res) => {
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

      const safeTokens = { ...tokens };
      delete safeTokens.refresh_token;

      const gmailDoc = {
        tokens: safeTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (tokens.refresh_token) {
        gmailDoc.encrypted_refresh_token = await encryptSecret(tokens.refresh_token);
        await admin.firestore().collection('userSecrets').doc(uid).set({
          gmail_encrypted_refresh_token: gmailDoc.encrypted_refresh_token,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await admin.firestore().collection('users').doc(uid).set({
        gmail: {
          ...gmailDoc,
          refresh_token: admin.firestore.FieldValue.delete()
        }
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

  // Intercambio de código OAuth vía GET (redirección directa)
  router.get('/exchangeCode', async (req, res) => {
    const code = req.query.code;
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

      const safeTokens = { ...tokens };
      delete safeTokens.refresh_token;

      const gmailDoc = {
        tokens: safeTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (tokens.refresh_token) {
        gmailDoc.encrypted_refresh_token = await encryptSecret(tokens.refresh_token);
        await admin.firestore().collection('userSecrets').doc(uid).set({
          gmail_encrypted_refresh_token: gmailDoc.encrypted_refresh_token,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await admin.firestore().collection('users').doc(uid).set({
        gmail: {
          ...gmailDoc,
          refresh_token: admin.firestore.FieldValue.delete()
        }
      }, { merge: true });

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

  // Renovación de access token usando refresh token cifrado o legado
  router.get('/refreshAccessToken', async (req, res) => {
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

  // Iniciar watch de notificaciones push de Gmail hacia Cloud Pub/Sub
  router.post('/gmail/startWatch', async (req, res) => {
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

      const profileResp = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${access_token}` } });
      const emailAddress = profileResp.data?.emailAddress || null;
      const historyId = profileResp.data?.historyId || null;

      const watchBody = { topicName: GMAIL_PUBSUB_TOPIC, labelIds: ['INBOX'] };
      const watchResp = await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/watch', watchBody, { headers: { Authorization: `Bearer ${access_token}` } });

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

  // Detener watch de Gmail push
  router.post('/gmail/stopWatch', async (req, res) => {
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
        await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/stop', null, { headers: { Authorization: `Bearer ${access_token}` } });
      }

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

  return router;
};

