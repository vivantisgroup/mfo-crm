import { getAdminFirestore } from './lib/firebaseAdmin';

async function run() {
  const db = getAdminFirestore();
  const snap = await db.collection('tenants').limit(1).get();
  if (snap.empty) {
    console.log("No tenants");
    return;
  }
  const tenantId = snap.docs[0].id;
  console.log("Tenant:", tenantId);
  
  const articles = await db.collection(`tenants/${tenantId}/knowledge_articles`).get();
  console.log("Articles:", articles.size);
  articles.forEach((doc: any) => {
     console.log(doc.id, doc.data());
  });
}

run().catch(console.error);
