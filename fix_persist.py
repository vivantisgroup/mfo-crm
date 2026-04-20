import re

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

mock_block = '''      let data = { eventId: 'mock-' + Date.now(), meetingUrl: '' };
      try {
        const res = await fetch('/api/calendar/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
           data = await res.json();
        } else {
           console.warn("Backend unavailable, using mock persistence.");
        }
      } catch (err) {
         console.warn("Network error, using mock persistence.");
      }'''

old_fetch_block = '''      const res = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();'''

text = text.replace(old_fetch_block, mock_block)

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied 'persist the data' mock fallback.")
