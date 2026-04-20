import os

target_dirs = [
    r'c:\MFO-CRM\apps\web\app\api',
    r'c:\MFO-CRM\apps\web\lib'
]

for root_dir in target_dirs:
    for root, dirs, files in os.walk(root_dir):
        for f in files:
            if f.endswith('.ts') or f.endswith('.tsx'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        c = file.read()
                        if 'nodemailer' in c or 'createTransport' in c or 'sendMail' in c:
                            print(f"FOUND IN: {path}")
                except Exception as e:
                    print(f"Error reading {path}: {e}")
