const admin = require('firebase-admin');

// Ensure you have a service account imported or process.env set
const serviceAccount = require('./apps/web/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('tenants').doc('master').get();
  console.log(snap.data());
  process.exit(0);
}

main();
