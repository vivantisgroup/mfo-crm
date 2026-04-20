import re

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r"import \{ Mail, Search, RefreshCw, Send, Paperclip, Clock, Calendar, AlertCircle, FileText, Bot, Reply, Forward, Trash2, LogOut, CheckCircle2, ChevronDown, Check, LayoutDashboard, Target, Users, BookOpen, Link as LinkIcon, Building2 \} from 'lucide-react';",
    "import { Mail, Search, RefreshCw, Send, Paperclip, Clock, Calendar, AlertCircle, FileText, Bot, Reply, Forward, Trash2, LogOut, CheckCircle2, ChevronDown, Check, LayoutDashboard, Target, Users, BookOpen, Link as LinkIcon, Building2, Eye, X } from 'lucide-react';",
    text
)

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
