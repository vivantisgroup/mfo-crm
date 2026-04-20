import re

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("await updateDoc(doc(db, 'platform_contacts', editContact.id), patch);", "await updateContact(editContact.id, patch);")
    
if "updateContact" not in code and "await updateContact" in code:
    code = code.replace("createContact, deleteContact", "createContact, deleteContact, updateContact")

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
