const { getAdminFirestore } = require('./apps/web/lib/firebaseAdmin.ts');

async function run() {
  const db = getAdminFirestore();
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'marcelo.gavazzi@transparenza-advisors.com').get();
  
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

run().catch(console.error);
