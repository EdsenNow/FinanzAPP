const admin = require('firebase-admin');
admin.initializeApp();

async function checkUserSettings() {
  const uid = 'goQkxH0bynQv3UVAS6MdSUEWA3F2';
  const doc = await admin.firestore().collection('users').doc(uid).get();
  if (!doc.exists) {
    console.log('No existe el documento del usuario.');
    process.exit(0);
  }
  const data = doc.data();
  console.log('Settings del usuario:');
  console.log(JSON.stringify(data?.settings || {}, null, 2));
  console.log('\nCampo currency:', data?.settings?.currency || '(no definido, usando USD por defecto)');
  process.exit(0);
}
checkUserSettings().catch(e => { console.error(e); process.exit(1); });
