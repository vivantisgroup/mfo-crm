import re

def add_reload_import(text):
    if "forceReinitializeAdmin" not in text:
        text = text.replace(
            "import { getAdminFirestore } from '@/lib/firebaseAdmin';",
            "import { getAdminFirestore, forceReinitializeAdmin } from '@/lib/firebaseAdmin';"
        )
    return text

def add_catch_block(text):
    return text.replace(
        "} catch (err: any) {",
        """} catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('invalid_rapt')) {
      await forceReinitializeAdmin();
      return NextResponse.json({ error: 'Auth token expired and was forcefully reloaded. Please repeat your action.' }, { status: 503 });
    }"""
    )
    
files = [
    'apps/web/app/api/admin/catalog/collections/route.ts',
    'apps/web/app/api/admin/catalog/document/route.ts'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    text = add_reload_import(text)
    text = add_catch_block(text)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)

