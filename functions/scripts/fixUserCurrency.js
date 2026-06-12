const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp();
const db = getFirestore(app);

async function fixUserCurrency() {
  const uid = 'goQkxH0bynQv3UVAS6MdSUEWA3F2';
  await db.collection('users').doc(uid).set(
    { settings: { currency: 'DOP' } },
    { merge: true }
  );
  console.log('✅ Moneda actualizada a DOP (Peso Dominicano) correctamente.');
  process.exit(0);
}
fixUserCurrency().catch(e => { console.error(e); process.exit(1); });
