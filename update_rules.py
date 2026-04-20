import re

with open('C:/MFO-CRM/firestore.rules', 'r', encoding='utf-8') as f:
    text = f.read()

rules_to_add = """
    match /platform_accounting/{docId} {
      allow read, write: if isSalesRole();
    }
    match /platform_people/{docId} {
      allow read, write: if isSalesRole();
    }
"""

if "platform_accounting" not in text:
    text = text.replace(
        "    match /platform_expenses/{expenseId} {",
        rules_to_add + "    match /platform_expenses/{expenseId} {"
    )

with open('C:/MFO-CRM/firestore.rules', 'w', encoding='utf-8') as f:
    f.write(text)

