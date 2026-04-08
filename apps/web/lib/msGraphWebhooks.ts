// apps/web/lib/msGraphWebhooks.ts

export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'mfo-crm-super-secret-validation-key';

function getWebhookUrl() {
  const base = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mfo-crm-web.vercel.app';
  // Strip trailing slashes
  return `${base.replace(/\/$/, '')}/api/webhooks/mail`;
}

/**
 * Creates a Microsoft Graph Subscription for a user's mailbox.
 * Listens for created, updated, and deleted messages.
 */
export async function subscribeToInbox(uid: string, accessToken: string) {
  const url = getWebhookUrl();
  console.log(`[MSGraph] Provisioning Subscription -> ${url} for user ${uid}`);

  // Max subscription length for messages is 4230 minutes (under 3 days)
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 70); 

  const payload = {
    changeType: 'created,updated,deleted',
    notificationUrl: url,
    resource: 'me/messages',
    expirationDateTime: expiration.toISOString(),
    clientState: WEBHOOK_SECRET,
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[MSGraph] Subscription failed: ${res.status}`, errText);
    throw new Error(`Failed to subscribe to MS Graph: ${errText}`);
  }

  const data = await res.json();
  return {
    subscriptionId: data.id,
    expirationDateTime: data.expirationDateTime,
  };
}

/**
 * Renews an existing Microsoft Graph Subscription before it expires.
 */
export async function renewSubscription(subscriptionId: string, accessToken: string) {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 70);

  const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expirationDateTime: expiration.toISOString(),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to renew MS Graph Subscription: ${errText}`);
  }

  return await res.json();
}

/**
 * Creates Global Microsoft Graph Subscriptions for Teams Channels and Chats.
 * Listens for created messages across the entire tenant.
 * REQUIRES Application Permissions and a Client Credentials App Token.
 */
export async function provisionGlobalTeamsWebhooks(appToken: string) {
  const base = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mfo-crm-web.vercel.app';
  const url = `${base.replace(/\/$/, '')}/api/teams/webhook`;
  
  console.log(`[MSGraph] Provisioning GLOBAL Teams Subscriptions -> ${url}`);

  // Max subscription length for teams chat messages is 59 minutes according to Graph docs.
  // We will need a cron job to renew this in production.
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 59);

  const createBody = (resource: string) => ({
    changeType: 'created',
    notificationUrl: url,
    resource: resource,
    expirationDateTime: expiration.toISOString(),
    clientState: WEBHOOK_SECRET,
  });

  const headers = {
    Authorization: `Bearer ${appToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Subscribe to Global Channels
  const channelsRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers,
    body: JSON.stringify(createBody('/teams/getAllMessages')),
  });

  if (!channelsRes.ok) {
    const errText = await channelsRes.text();
    console.error(`[MSGraph] Global Channels Subscription failed: ${channelsRes.status}`, errText);
    throw new Error(`Failed to subscribe to Global Teams Channels: ${errText}`);
  }
  const channelsData = await channelsRes.json();

  // 2. Subscribe to Global Chats (1-on-1 and Group Chats)
  const chatsRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers,
    body: JSON.stringify(createBody('/chats/getAllMessages')),
  });

  if (!chatsRes.ok) {
    const errText = await chatsRes.text();
    console.error(`[MSGraph] Global Chats Subscription failed: ${chatsRes.status}`, errText);
    throw new Error(`Failed to subscribe to Global Teams Chats: ${errText}`);
  }
  const chatsData = await chatsRes.json();

  return {
    channelsSubscriptionId: channelsData.id,
    channelsExpirationDateTime: channelsData.expirationDateTime,
    chatsSubscriptionId: chatsData.id,
    chatsExpirationDateTime: chatsData.expirationDateTime,
  };
}
