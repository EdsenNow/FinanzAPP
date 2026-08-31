const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Remove exchangeCode POST
content = content.replace(/app\.post\('\/exchangeCode'[\s\S]*?(?=\n\/\/ Permitir que Google redirija)/, '');

// 2. Remove exchangeCode GET
content = content.replace(/\/\/ Permitir que Google redirija[\s\S]*?app\.get\('\/exchangeCode'[\s\S]*?(?=\napp\.get\('\/refreshAccessToken')/, '');

// 3. Remove refreshAccessToken
content = content.replace(/app\.get\('\/refreshAccessToken'[\s\S]*?(?=\n\/\/ Endpoint para iniciar un watch)/, '');

// 4. Remove startWatch and stopWatch
content = content.replace(/\/\/ Endpoint para iniciar un watch[\s\S]*?app\.post\('\/gmail\/startWatch'[\s\S]*?app\.post\('\/gmail\/stopWatch'[\s\S]*?res\.status\(500\)\.json\(\{ error: err\?\.response\?\.data \|\| err\.message \|\| String\(err\) \}\);\s*\}\s*\}\);\s*/, '');

// 5. Add syncImapTransactions endpoint
const syncImapCode = `
const { syncImapTransactions } = require('./src/imapSync');

app.post('/syncImap', async (req, res) => {
  const uid = (req.body && req.body.uid) || req.query.uid;
  if (!uid) return res.status(400).json({ error: 'missing uid' });

  try {
    const caller = await verifyUserRequest(req, uid);
    if (!caller) return res.status(403).json({ error: 'unauthorized' });

    const doc = await admin.firestore().collection('users').doc(uid).get();
    const data = doc.exists ? doc.data() : null;
    const imapSettings = data?.imap || {};
    
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

`;

// Insert the new code where we deleted the old endpoints
content = content.replace(/async function clearUserGmailTokens[\s\S]*?\}\s*/, match => match + '\n' + syncImapCode);

// Write back
fs.writeFileSync(indexPath, content);
console.log('index.js updated successfully');
