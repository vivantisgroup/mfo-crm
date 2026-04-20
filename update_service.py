import re

with open(r'c:\MFO-CRM\apps\web\lib\emailIntegrationService.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# I need to use regex because spacing might not be perfect
old_func_pattern = r"export async function logEmailToCrm\([\s\S]*?return activityRef\.id;\s*\}"

new_func = '''export async function logEmailToCrm(
    uid:    string,
    entry:  EmailLogEntry,
    records: Array<{ id: string, name: string }>
  ): Promise<string[]> {
    const activityIds: string[] = [];
    
    // 1. Post an activity for each selected CRM record
    for (const record of records) {
      const activityRef = await addDoc(collection(db, 'activities'), {
        tenantId: '',        // filled server-side
        familyId: record.id,
        familyName: record.name,
        type: 'email',
        direction: entry.direction,
        subject: entry.subject,
        fromEmail: entry.fromEmail,
        fromName: entry.fromName,
        toEmails: entry.toEmails,
        snippet: entry.snippet ?? '',
        provider: entry.provider,
        messageId: entry.messageId,
        loggedBy: uid,
        createdAt: new Date().toISOString(),
      });
      activityIds.push(activityRef.id);
    }

    // 2. Update the source email log document with the linked records
    if (entry.id) {
       try {
         const logRef = doc(db, 'users', uid, 'email_logs', entry.id);
         await updateDoc(logRef, {
            linkedRecordIds: records.map(r => r.id),
            linkedRecordNames: records.map(r => r.name)
         });
       } catch (err) {
         console.error('Failed to update email log entry with linked records:', err);
       }
    }

    return activityIds;
  }'''

text = re.sub(old_func_pattern, new_func, text)

# I should also update EmailLogEntry type if it doesn't already have linked fields
if 'linkedRecordIds?: string[];' not in text:
    old_interface = '''export interface EmailLogEntry {
  id?:        string;
  provider:   MailProvider;'''

    new_interface = '''export interface EmailLogEntry {
  id?:        string;
  provider:   MailProvider;
  linkedRecordIds?: string[];
  linkedRecordNames?: string[];'''
    text = text.replace(old_interface, new_interface)

with open(r'c:\MFO-CRM\apps\web\lib\emailIntegrationService.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated logEmailToCrm successfully.")
