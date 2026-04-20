import re

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Dispatch Corporate Invite -> Send Invite
text = text.replace('Dispatch Corporate Invite', 'Send Invite')

# 2. Form validation for create event
old_validation = '''    if (!newEventSubject || !newEventStart || !newEventEnd || !user || !primaryMailProvider) {
      showToast('Please fill in Subject, Start, and End times.', 'error');
      return;
    }'''

new_validation = '''    if (!newEventSubject || !newEventStart || !newEventEnd) {
      showToast('Please fill in Subject, Start, and End times.', 'error');
      return;
    }
    if (!user || !primaryMailProvider) {
      showToast('Please connect an email provider in Settings first.', 'error');
      return;
    }'''
text = text.replace(old_validation, new_validation)

# 3. CRM Linking
old_crm_link = "await logEmailToCrm(selectedLog, 'client_123', 'John Doe');"
new_crm_link = "if (user) { await logEmailToCrm(user.uid, selectedLog, 'client_123', 'John Doe'); }"
text = text.replace(old_crm_link, new_crm_link)

# 4. Invalid Date display fix
old_date = "{new Date(selectedLog.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}"
new_date = "{(() => { const d = new Date(isNaN(Number(selectedLog.date)) ? selectedLog.date : Number(selectedLog.date)); return isNaN(d.getTime()) ? 'No Date' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); })()}"
text = text.replace(old_date, new_date)

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied 4 targeted fixes successfully!")
