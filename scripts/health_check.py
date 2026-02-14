import httpx
import sys

try:
    r = httpx.get('http://127.0.0.1:8000/health', timeout=5.0)
    print('STATUS', r.status_code, flush=True)
    print(r.text, flush=True)
    if r.status_code != 200:
        print('ERROR: Health check failed', flush=True)
        sys.exit(1)
except Exception as e:
    print('[ERROR HEALTH]', type(e).__name__, str(e), flush=True)
    sys.exit(1)
