const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;
const admin = require('firebase-admin');
const { extractTransactionData } = require('./emailParser');

/**
 * Escanea correos mediante IMAP para buscar transacciones nuevas.
 * @param {string} email Correo del usuario.
 * @param {string} appPassword Contraseña de Aplicación de 16 dígitos.
 * @param {Array<string>} targetSenders Arreglo de correos de bancos a escanear.
 * @param {string} uid UID de Firebase del usuario para guardar en Firestore.
 */
async function syncImapTransactions(email, appPassword, targetSenders, uid) {
  if (!email || !appPassword || !targetSenders || !targetSenders.length) {
    throw new Error('Faltan credenciales IMAP o remitentes objetivo.');
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: email,
      pass: appPassword
    },
    logger: false
  });

  const db = admin.firestore();
  const userDocRef = db.collection('users').doc(uid);
  const transactionsRef = userDocRef.collection('transactions');
  let newTransactionsCount = 0;
  const newTransactions = [];

  try {
    const userDocSnap = await userDocRef.get();
    const userData = userDocSnap.exists ? userDocSnap.data() : {};
    const lastSyncAt = userData?.imap?.lastSyncAt ? new Date(userData.imap.lastSyncAt) : null;

    await client.connect();
    let lock = await client.getMailboxLock('INBOX');

    try {
      // Si es la primera sincronización, busca todos los correos históricos (hasta 1 año hacia atrás)
      // Si ya se sincronizó antes, busca desde la última fecha sincronizada
      const searchSince = lastSyncAt ? lastSyncAt : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      const searchCriteria = {
        since: searchSince,
        or: targetSenders.map(sender => ({ from: sender }))
      };

      const searchResults = await client.search(searchCriteria);

      if (searchResults && searchResults.length > 0) {
        for await (const message of client.fetch(searchResults, { source: true, uid: true })) {
          const rawEmail = message.source;
          const parsedMail = await simpleParser(rawEmail);
          
          const messageId = parsedMail.messageId || `imap-${message.uid}`;
          
          // Escudo anti-duplicados por messageId
          const docRef = transactionsRef.doc(messageId);
          const docSnap = await docRef.get();
          
          if (!docSnap.exists) {
            const textBody = parsedMail.text || '';
            const subject = parsedMail.subject || '';
            const dateHeader = parsedMail.date || new Date();
            
            const txnData = extractTransactionData(subject, dateHeader, textBody);
            
            if (txnData && !txnData.ignored) {
              const formattedDate = new Date(txnData.date || dateHeader).toISOString();
              const newTx = {
                id: messageId,
                ...txnData,
                date: formattedDate,
                source: 'imap',
                originalMessageId: messageId,
                createdAt: new Date().toISOString()
              };

              await docRef.set({
                ...newTx,
                date: admin.firestore.Timestamp.fromDate(new Date(formattedDate)),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });

              newTransactions.push(newTx);
              newTransactionsCount++;
            } else if (txnData && txnData.ignored) {
              await docRef.set({
                ignored: true,
                reason: txnData.reason || 'Sin transacción financiera relevante',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }
      }

      // Actualizar el documento principal del usuario con las nuevas transacciones
      const currentTransactions = Array.isArray(userData.transactions) ? [...userData.transactions] : [];
      const currentCategories = Array.isArray(userData.categories) ? [...userData.categories] : [];

      if (newTransactions.length > 0) {
        const existingIds = new Set(currentTransactions.map(t => String(t.id)));
        for (const tx of newTransactions) {
          if (!existingIds.has(String(tx.id))) {
            currentTransactions.push(tx);
            existingIds.add(String(tx.id));
          }
        }

        await userDocRef.set({
          transactions: currentTransactions,
          categories: currentCategories,
          imap: {
            ...(userData.imap || {}),
            lastSyncAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await userDocRef.set({
          imap: {
            ...(userData.imap || {}),
            lastSyncAt: new Date().toISOString()
          }
        }, { merge: true });
      }

    } finally {
      lock.release();
    }

    await client.logout();
    return { success: true, count: newTransactionsCount, transactions: newTransactions };
  } catch (error) {
    console.error('Error en IMAP Sync:', error);
    throw new Error(error.message || 'No se pudo conectar a IMAP. Verifica el correo y la Contraseña de Aplicación.');
  }
}

module.exports = { syncImapTransactions };
