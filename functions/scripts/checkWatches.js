const admin = require('firebase-admin');
admin.initializeApp();

async function checkWatches() {
  const watchers = await admin.firestore().collection('gmailWatchers').get();
  console.log(`Encontrados ${watchers.size} usuarios con watch activo.`);
  watchers.forEach(doc => {
    const data = doc.data();
    console.log(`- Email: ${doc.id}`);
    console.log(`  UID: ${data.uid}`);
    console.log(`  Topic: ${data.topicName}`);
    console.log(`  Expira: ${new Date(data.watchExpiration).toLocaleString()}`);
  });
  process.exit(0);
}

checkWatches().catch(console.error);
