const fs = require('fs');
const admin = require('firebase-admin');

async function createBucket() {
  const envFile = fs.readFileSync('../../.env.local', 'utf-8');
  const tokenMatched = envFile.match(/FIREBASE_ADMIN_SDK_JSON="([\s\S]+?)"/);
  const tokenStr = tokenMatched ? tokenMatched[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;

  if (!tokenStr) {
     console.log("Could not extract cred string.");
     return;
  }

  let cred;
  try {
    cred = JSON.parse(tokenStr);
  } catch(e) {
    console.log("Could not parse cred", e.message);
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert(cred)
  });

  const bucketV2 = admin.storage().bucket('mfo-crm.firebasestorage.app');
  
  try {
    await bucketV2.create({ location: 'US-CENTRAL1' });
    console.log("SUCCESS_V2_CREATED");
  } catch (e) {
    if (e.message.includes('already exists')) {
       console.log("V2 Bucket already exists - verifying Permissions.");
    } else if (e.message.includes('Billing') || e.message.includes('billing')) {
       console.log("Billing restriction on V2");
    } else {
       console.log("V2 Error:", e.message);
    }
  }
}

createBucket();
