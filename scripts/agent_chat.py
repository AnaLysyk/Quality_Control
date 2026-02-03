import httpx

payload = {"session_id": "demo-1", "message": "List recent runs for company acme"}
try:
    r = httpx.post('http://127.0.0.1:8000/agent/chat', json=payload, timeout=10.0)
    print('STATUS', r.status_code)
    print(r.text)
except Exception as e:
    print('ERROR', e)
