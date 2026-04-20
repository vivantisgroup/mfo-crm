import urllib.request
import re

companies = ['docusign', 'clicksign', 'certisign']

for c in companies:
    try:
        req = urllib.request.Request('https://br.linkedin.com/company/' + c, headers={'User-Agent': 'Googlebot/2.1'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if match:
            print(f"{c.upper()}_LOGO={match.group(1).replace('&amp;', '&')}")
        else:
            print(f"{c.upper()}_LOGO=Not found")
    except Exception as e:
        print(f"{c.upper()}_LOGO=Error {e}")
