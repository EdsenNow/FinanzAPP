const admin = require('firebase-admin');
admin.initializeApp();

async function checkTx() {
  const uid = 'goQkxH0bynQv3UVAS6MdSUEWA3F2';
  console.log(`Buscando transacciones recientes para el usuario ${uid}...`);
  const snapshot = await admin.firestore()
    .collection('users')
    .doc(uid)
    .collection('transactions')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
    
  if (snapshot.empty) {
    console.log('No hay transacciones recientes en Firestore.');
  } else {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n- Transacción: ${doc.id}`);
      console.log(`  Descripción: ${data.description}`);
      console.log(`  Monto: ${data.amount}`);
      console.log(`  Fecha: ${data.date}`);
      console.log(`  Tipo: ${data.type}`);
      if (data.source) console.log(`  Origen: ${data.source}`);
    });
  }
  process.exit(0);
}

checkTx().catch(err => {
  console.error(err);
  process.exit(1);
});
