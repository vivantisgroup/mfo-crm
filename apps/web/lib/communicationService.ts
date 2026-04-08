import { getAdminFirestore } from './firebaseAdmin';

export type CommunicationProvider = 'microsoft' | 'google' | 'teams' | 'slack' | 'whatsapp';
export type CommunicationType = 'email' | 'chat';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface CommunicationRecord {
  id: string; // msg_1234
  tenant_id: string;
  provider: CommunicationProvider;
  type: CommunicationType;
  direction: CommunicationDirection;
  
  subject?: string;
  body: string;
  snippet: string;
  
  from: string; // email or user name
  to: string[];
  cc?: string[];
  
  timestamp: string; // ISO 8601
  thread_id?: string;
  
  provider_message_id: string;
  crm_entity_links: Array<{ type: string; id: string; name?: string }>;
}

export const communicationService = {
  /**
   * Normalizes an MS Graph Email object into our Canonical Schema
   */
  normalizeGraphEmail(emailData: any, tenantId: string, isOutbound: boolean): CommunicationRecord {
    const fromAddress = emailData.from?.emailAddress?.address || '';
    const toAddresses = emailData.toRecipients?.map((r: any) => r.emailAddress?.address) || [];
    
    return {
      id: `msg_${emailData.id}`,
      tenant_id: tenantId,
      provider: 'microsoft',
      type: 'email',
      direction: isOutbound ? 'outbound' : 'inbound',
      
      subject: emailData.subject || '(No Subject)',
      body: emailData.bodyPreview || '', // We default to Preview to save space, but full body can be stored here
      snippet: emailData.bodyPreview || '',
      
      from: fromAddress,
      to: toAddresses,
      timestamp: emailData.receivedDateTime || new Date().toISOString(),
      thread_id: emailData.conversationId,
      provider_message_id: emailData.id,
      crm_entity_links: []
    };
  },

  /**
   * Normalizes a Teams chat message into our Canonical Schema
   */
  normalizeTeamsMessage(msgData: any, tenantId: string, isOutbound: boolean): CommunicationRecord {
    return {
      id: `chat_${msgData.id}`,
      tenant_id: tenantId,
      provider: 'teams',
      type: 'chat',
      direction: isOutbound ? 'outbound' : 'inbound',
      
      body: msgData.body?.content || '',
      snippet: (msgData.body?.content || '').substring(0, 100),
      
      from: msgData.from?.user?.displayName || msgData.from?.application?.displayName || 'Unknown',
      to: [msgData.chatId || 'channel'],
      
      timestamp: msgData.createdDateTime || new Date().toISOString(),
      thread_id: msgData.chatId,
      provider_message_id: msgData.id,
      crm_entity_links: []
    };
  },

  /**
   * Ingests a normalized message:
   * 1. Runs the CRM Association Engine
   * 2. Writes securely to the single `communications` collection
   */
  async ingestMessage(message: CommunicationRecord) {
    const db = getAdminFirestore();

    // CRM ASSOCIATION ENGINE
    // We look at the 'from' and 'to' emails. In a real system, we'd query:
    // const contacts = await db.collection('contacts').where('email', 'in', [message.from, ...message.to]).get()
    // For now, we perform a best-effort structural matching placeholder that can be expanded.
    
    // Create a flat array of IDs for easy Firestore querying with array-contains
    const crm_entity_ids: string[] = [];

    try {
      const searchEmails = [message.from, ...message.to].filter(Boolean);
      if (searchEmails.length > 0) {
        // Find matching contacts in this specific tenant (pseudo-search)
        const contactsQuery = await db.collection('contacts')
                                       .where('tenant_id', '==', message.tenant_id)
                                       .where('email', 'in', searchEmails.slice(0, 10))
                                       .limit(3)
                                       .get();
        
        contactsQuery.docs.forEach((doc: any) => {
           message.crm_entity_links.push({
             type: 'contact',
             id: doc.id,
             name: doc.data().name
           });
           crm_entity_ids.push(doc.id);
        });
      }
    } catch (e) {
      console.warn('[CommunicationService] CRM Association failed', e);
    }
    
    // Ensure any pre-resolved links (e.g. from the sync engine) are flattened into IDs so Firestore array-contains queries work.
    if (message.crm_entity_links && message.crm_entity_links.length > 0) {
      message.crm_entity_links.forEach(link => {
        if (!crm_entity_ids.includes(link.id)) crm_entity_ids.push(link.id);
      });
    }

    // Write to unified communications layer
    await db.collection('communications').doc(message.id).set({
       ...message,
       crm_entity_ids
    }, { merge: true });
    
    // In HubSpot, messages might ALSO be written to activities for generic timelines, 
    // but building the dedicated 'communications' feed fulfills the single pane of glass.
    console.log(`[CommunicationService] Ingested message ${message.id} for tenant ${message.tenant_id}`);
  }
};
