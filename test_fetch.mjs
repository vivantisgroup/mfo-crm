import fetch from 'node-fetch';

async function testFetch() {
  const url = 'http://localhost:3000/api/mail/thread/placeholder?uid=test&idToken=test&provider=microsoft&tenantId=test';
  // We can't actually do this without a real idToken.
  console.log("Since I don't have a valid ID token, testing the route fully from outside is tricky.");
}
testFetch();
