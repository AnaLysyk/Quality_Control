import httpx

try:
    r = httpx.get('http://127.0.0.1:8000/health', timeout=5.0)
    print('STATUS', r.status_code)
    print(r.text)
except Exception as e:
    print('ERROR', e)
