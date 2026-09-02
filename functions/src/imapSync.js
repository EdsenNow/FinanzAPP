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
function extractTextFromEmail(parsedMail) {
  if (parsedMail.text && parsedMail.text.trim().length > 10) {
    return parsedMail.text;
  }
  const html = parsedMail.html || '';
  if (!html) return parsedMail.text || '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function syncImapTransactions(email, appPassword, targetSenders, uid) {
  if (!email || !appPassword || !Array.isArray(targetSenders) || targetSenders.length === 0) {
    throw new Error('Credenciales o remitentes no configurados.');
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

    await client.connect();
    const mailboxes = await client.list();
    const allMailBox = mailboxes.find(m => 
      m.specialUse === '\\All' || 
      m.path === '[Gmail]/All Mail' || 
      m.path === '[Gmail]/Todos' ||
      m.name === 'All Mail' ||
      m.name === 'Todos'
    );
    const mailboxPath = allMailBox ? allMailBox.path : 'INBOX';
    let lock = await client.getMailboxLock(mailboxPath);

    try {
      // Determinar la fecha desde la cual buscar correos (última sincronización o login con margen de 24h)
      const lastSync = userData.imapSettings?.lastSyncAt || userData.imap?.lastSyncAt || userData.lastLoginAt;
      let sinceDate = null;
      if (lastSync) {
        const parsed = new Date(lastSync);
        if (!isNaN(parsed.getTime())) {
          // Margen de seguridad de 24 horas antes para evitar pérdidas por husos horarios
          sinceDate = new Date(parsed.getTime() - 24 * 60 * 60 * 1000);
        }
      }
      if (!sinceDate) {
        // Por defecto, buscar los últimos 30 días
        sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const matchedUids = new Set();
      for (const sender of targetSenders) {
        const cleanSender = String(sender).trim();
        if (!cleanSender) continue;

        const searchQuery = { from: cleanSender };
        if (sinceDate && !isNaN(sinceDate.getTime())) {
          searchQuery.since = sinceDate;
        }

        try {
          const results = await client.search(searchQuery, { uid: true });
          if (Array.isArray(results)) {
            results.forEach(id => matchedUids.add(id));
          }
        } catch (searchErr) {
          console.warn(`[IMAP] Fallo al buscar remitente ${cleanSender} con since:`, searchErr?.message || searchErr);
          try {
            const fallbackResults = await client.search({ from: cleanSender }, { uid: true });
            if (Array.isArray(fallbackResults)) {
              fallbackResults.forEach(id => matchedUids.add(id));
            }
          } catch {}
        }

        if (cleanSender.includes('@')) {
          const domain = cleanSender.split('@')[1];
          if (domain) {
            const domQuery = { from: domain };
            if (sinceDate && !isNaN(sinceDate.getTime())) {
              domQuery.since = sinceDate;
            }
            try {
              const domResults = await client.search(domQuery, { uid: true });
              if (Array.isArray(domResults)) {
                domResults.forEach(id => matchedUids.add(id));
              }
            } catch (searchErr) {
              console.warn(`[IMAP] Fallo al buscar dominio ${domain} con since:`, searchErr?.message || searchErr);
              try {
                const fallbackResults = await client.search({ from: domain }, { uid: true });
                if (Array.isArray(fallbackResults)) {
                  fallbackResults.forEach(id => matchedUids.add(id));
                }
              } catch {}
            }
          }
        }
      }

      console.log(`[IMAP Sync] Mailbox: ${mailboxPath} - UIDs encontrados: ${matchedUids.size} (desde ${sinceDate.toISOString().split('T')[0]})`);

      if (matchedUids.size > 0) {
        const searchResults = Array.from(matchedUids);
        for await (const message of client.fetch(searchResults, { source: true }, { uid: true })) {
          const rawEmail = message.source;
          const parsedMail = await simpleParser(rawEmail);
          
          const messageId = parsedMail.messageId || `imap-${message.uid}`;
          const subject = parsedMail.subject || '';
          console.log(`[IMAP Sync] Procesando correo: "${subject}"`);
          
          const docRef = transactionsRef.doc(messageId);
          const docSnap = await docRef.get();
          
          if (!docSnap.exists) {
            const textBody = extractTextFromEmail(parsedMail);
            const subject = parsedMail.subject || '';
            const dateHeader = parsedMail.date || new Date();
            
            const txnData = extractTransactionData(subject, dateHeader, textBody);
            
            if (txnData && !txnData.ignored && txnData.amount) {
              const formattedDate = new Date(txnData.date || dateHeader).toISOString();
              const newTx = {
                id: messageId,
                amount: txnData.amount,
                description: txnData.description || subject,
                subject,
                type: txnData.type || 'expense',
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
          } else {
            const existing = docSnap.data();
            if (existing && !existing.ignored && existing.amount) {
              newTransactions.push({
                id: docRef.id,
                amount: existing.amount,
                description: existing.description || existing.subject || 'Transacción Bancaria',
                subject: existing.subject || '',
                type: existing.type || 'expense',
                date: existing.date ? (existing.date.toDate ? existing.date.toDate().toISOString() : new Date(existing.date).toISOString()) : new Date().toISOString(),
                source: 'imap'
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

        const syncTimestamp = new Date().toISOString();
        await userDocRef.set({
          transactions: currentTransactions,
          categories: currentCategories,
          imapSettings: {
            ...(userData.imapSettings || {}),
            lastSyncAt: syncTimestamp
          },
          imap: {
            ...(userData.imap || {}),
            lastSyncAt: syncTimestamp
          },
          updatedAt: syncTimestamp
        }, { merge: true });
      } else {
        const syncTimestamp = new Date().toISOString();
        await userDocRef.set({
          imapSettings: {
            ...(userData.imapSettings || {}),
            lastSyncAt: syncTimestamp
          },
          imap: {
            ...(userData.imap || {}),
            lastSyncAt: syncTimestamp
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
    if (error.authenticationFailed || (error.response && String(error.response).includes('AUTHENTICATIONFAILED')) || (error.message && String(error.message).includes('AUTHENTICATIONFAILED'))) {
      throw new Error('Error de autenticación en Gmail: La Contraseña de Aplicación o el correo son incorrectos. Asegúrate de generar una contraseña de app de 16 letras en tu cuenta de Google.');
    }
    throw new Error(error.responseText || error.message || 'No se pudo conectar a IMAP. Verifica el correo y la Contraseña de Aplicación.');
  }
}

module.exports = { syncImapTransactions };
