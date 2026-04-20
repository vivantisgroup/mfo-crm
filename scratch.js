const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON || fs.readFileSync('c:/MFO-CRM/mfo-crm-firebase-adminsdk.json', 'utf8'));

if (!getFirestore.apps?.length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function run() {
  const tId = 'TransparenzaAdvisors';
  const snap = await db.collection('tenants').doc(tId).get();
  console.log(JSON.stringify(snap.data(), null, 2));
}
run();
