const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { encryptSecret, decryptSecret } = require('../cryptoHelper');
const { syncImapTransactions } = require('../imapSync');

/**
 * Registra y exporta las rutas IMAP recibiendo la función verificadora de usuario.
 * @param {Function} verifyUserRequest
 * @returns {express.Router}
 */
module.exports = function createImapRoutes(verifyUserRequest) {

  /**
   * Guarda credenciales IMAP bancarias en la colección privada userSecrets/{uid}.
   * Cifra la contraseña de aplicación y mantiene users/{uid} libre de secretos.
   */
  router.post('/saveImapCredentials', async (req, res) => {
    const { uid, email, appPassword, targetSenders } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'missing uid' });

    try {
      const caller = await verifyUserRequest(req, uid);
      if (!caller) return res.status(403).json({ error: 'unauthorized' });

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanSenders = Array.isArray(targetSenders)
        ? targetSenders.map(s => String(s).trim()).filter(Boolean)
        : [];

      let secretPassword = appPassword ? String(appPassword).replace(/\s+/g, '').trim() : null;

      const secretDocRef = admin.firestore().collection('userSecrets').doc(uid);
      const existingSecret = await secretDocRef.get();

      // Si el usuario no envió una nueva contraseña (deja en blanco), conservar la existente si ya estaba configurada
      if (!secretPassword && existingSecret.exists) {
        const sData = existingSecret.data();
        if (sData?.encryptedAppPassword) {
          secretPassword = await decryptSecret(sData.encryptedAppPassword);
        }
      }

      // Fallback a credencial legada en users/{uid} si aún no existía en userSecrets
      if (!secretPassword) {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const legacyData = userDoc.exists ? (userDoc.data()?.imapSettings || userDoc.data()?.imap) : null;
        if (legacyData?.appPassword) {
          secretPassword = legacyData.appPassword;
        }
      }

      if (!cleanEmail || !secretPassword) {
        return res.status(400).json({ error: 'Debes proporcionar correo electrónico y contraseña de aplicación.' });
      }

      // 1. Guardar en colección privada protegida (inaccesible desde cliente)
      const encrypted = await encryptSecret(secretPassword);
      await secretDocRef.set({
        email: cleanEmail,
        encryptedAppPassword: encrypted,
        targetSenders: cleanSenders,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. Guardar metadatos públicos en users/{uid} ELIMINANDO cualquier password residual
      const nowIso = new Date().toISOString();
      await admin.firestore().collection('users').doc(uid).set({
        imapSettings: {
          configured: true,
          email: cleanEmail,
          targetSenders: cleanSenders,
          updatedAt: nowIso,
          appPassword: admin.firestore.FieldValue.delete()
        },
        imap: {
          configured: true,
          email: cleanEmail,
          targetSenders: cleanSenders,
          updatedAt: nowIso,
          appPassword: admin.firestore.FieldValue.delete()
        }
      }, { merge: true });

      res.json({
        success: true,
        configured: true,
        email: cleanEmail,
        targetSenders: cleanSenders
      });
    } catch (err) {
      console.error('/saveImapCredentials error', err);
      res.status(500).json({ error: err.message || 'Error al guardar credenciales IMAP de forma segura' });
    }
  });

  /**
   * Consulta el estado seguro de la configuración IMAP (sin exponer jamás la contraseña).
   */
  router.get('/getImapStatus', async (req, res) => {
    const uid = req.query.uid;
    if (!uid) return res.status(400).json({ error: 'missing uid' });

    try {
      const caller = await verifyUserRequest(req, uid);
      if (!caller) return res.status(403).json({ error: 'unauthorized' });

      // 1. Consultar en userSecrets
      const secretDoc = await admin.firestore().collection('userSecrets').doc(uid).get();
      if (secretDoc.exists) {
        const sData = secretDoc.data();
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const uData = userDoc.exists ? userDoc.data() : {};
        const lastSyncAt = uData.imapSettings?.lastSyncAt || uData.imap?.lastSyncAt || null;

        return res.json({
          configured: !!(sData.email && sData.encryptedAppPassword),
          email: sData.email || '',
          targetSenders: sData.targetSenders || [],
          lastSyncAt
        });
      }

      // 2. Fallback a configuración legada en users/{uid}
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      const data = userDoc.exists ? userDoc.data() : null;
      const imap = data?.imapSettings || data?.imap || {};

      res.json({
        configured: !!(imap.appPassword || imap.configured),
        email: imap.email || '',
        targetSenders: imap.targetSenders || [],
        lastSyncAt: imap.lastSyncAt || null
      });
    } catch (err) {
      console.error('/getImapStatus error', err);
      res.status(500).json({ error: err.message || 'Error al consultar estado IMAP' });
    }
  });

  /**
   * Sincroniza correos bancarios usando credenciales seguras de userSecrets/{uid}.
   */
  router.post('/syncImap', async (req, res) => {
    const uid = (req.body && req.body.uid) || req.query.uid;
    if (!uid) return res.status(400).json({ error: 'missing uid' });

    try {
      const caller = await verifyUserRequest(req, uid);
      if (!caller) return res.status(403).json({ error: 'unauthorized' });

      let email = null;
      let appPassword = null;
      let targetSenders = [];

      // 1. Intentar leer desde la colección privada segura userSecrets/{uid}
      const secretDoc = await admin.firestore().collection('userSecrets').doc(uid).get();
      if (secretDoc.exists) {
        const sData = secretDoc.data();
        email = sData.email || null;
        targetSenders = sData.targetSenders || [];
        if (sData.encryptedAppPassword) {
          appPassword = await decryptSecret(sData.encryptedAppPassword);
        }
      }

      // 2. Fallback a credenciales legacy en users/{uid}
      if (!email || !appPassword) {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const legacyImap = userData?.imapSettings || userData?.imap || {};
        email = email || legacyImap.email;
        appPassword = appPassword || legacyImap.appPassword;
        if (!targetSenders.length) {
          targetSenders = legacyImap.targetSenders || [];
        }
      }
      
      if (!email || !appPassword) {
        return res.status(400).json({ error: 'Faltan credenciales IMAP (correo o contraseña de aplicación).' });
      }
      
      if (!targetSenders.length) {
        return res.status(400).json({ error: 'No se han configurado remitentes (bancos) a escanear.' });
      }

      const result = await syncImapTransactions(
        email,
        appPassword,
        targetSenders,
        uid
      );

      res.json(result);
    } catch (err) {
      console.error('/syncImap error', err);
      res.status(500).json({ error: err.message || 'Error durante la sincronización IMAP' });
    }
  });

  return router;
};

