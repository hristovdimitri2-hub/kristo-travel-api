import os
for f in ['icon-192.png', 'icon-512.png', 'logo.svg']:
    p = os.path.join('/home/z/my-project/public', f)
    if os.path.exists(p):
        print(f"{f}: {os.path.getsize(p)} bytes")
    else:
        print(f"{f}: MISSING")