// fetch test script

async function run() {
  console.log("Testing with Admin SDK...");
  const admin = require('firebase-admin');
  let db;
  try {
     admin.initializeApp({
         projectId: "mfo-crm"
     });
     db = admin.firestore();
     console.log("Initialized.");
  } catch(e) {
     if(admin.apps.length > 0) db = admin.firestore();
  }

  if (!db) {
     console.log("Could not init firebase admin");
     return;
  }

  const snap = await db.collection('communications').where('subject', '==', 'Re: Cópia visto - F1/F2 - MAP/LT').get();
  if (snap.empty) {
     console.log("No messages found.");
     return;
  }
  
  snap.forEach(doc => {
     console.log("FOUND DOC: ", doc.id);
     console.log(JSON.stringify(doc.data(), null, 2));
  });
}

run();
