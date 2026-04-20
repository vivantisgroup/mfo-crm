import { getAdminFirestore, getAdminAuth } from './lib/firebaseAdmin';
import * as fs from 'fs';

const envLocal = fs.readFileSync('../../.env.local', 'utf-8');
const match = envLocal.match(/FIREBASE_ADMIN_SDK_JSON="([\s\S]*?)"\r?\n/);
if (match) {
  process.env.FIREBASE_ADMIN_SDK_JSON = match[1].replace(/\\n/g, '\n');
}

async function run() {
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  
  const snaps = await db.collection('users').where('email', '==', 'marcelo.gavazzi@transparenza-advisors.com').get();
  
  if (snaps.empty) {
     console.log('No matching user found in DB by email: marcelo.gavazzi@transparenza-advisors.com');
  } else {
    for (const doc of snaps.docs) {
       console.log('Found user:', doc.id, doc.data());
       await db.collection('users').doc(doc.id).delete();
       console.log('Deleted from DB');
       try {
         await auth.deleteUser(doc.id);
         console.log('Deleted from Auth');
       } catch (e: any) {
         console.log('Auth delete error: ', e.message);
       }
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
