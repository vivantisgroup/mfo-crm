import io
filepath = 'apps/web/app/(dashboard)/calendar/page.tsx'
with io.open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# ADD X to lucide imports
text = text.replace("import { ChevronLeft, ChevronRight, Mail, Plus, RefreshCcw, AlertCircle } from 'lucide-react';", "import { ChevronLeft, ChevronRight, Mail, Plus, RefreshCcw, AlertCircle, X } from 'lucide-react';")

# ADD EVENT_COLORS if missing
if "EVENT_COLORS" not in text:
    event_colors_code = """
const EVENT_COLORS: any = {
  task: { bg: '#c7d2fe', border: '#4f46e5' },
  activity: { bg: '#fef08a', border: '#ca8a04' },
  calendar: { bg: '#e2e8f0', border: '#475569' }
};
"""
    # put it before export default function CalendarPage
    text = text.replace("export default function CalendarPage", event_colors_code + "\nexport default function CalendarPage")

with io.open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("fixes applied")
