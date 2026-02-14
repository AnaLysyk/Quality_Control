import httpx

payload = {"session_id": "demo-1", "message": "List recent runs for company acme"}
try:
    r = httpx.post('http://127.0.0.1:8000/agent/chat', json=payload, timeout=10.0)
    print('STATUS', r.status_code, flush=True)
    if r.status_code != 200:
        print('Erro: status', r.status_code, flush=True)
        print(r.text, flush=True)
    else:
        print(r.text, flush=True)
except Exception as e:
    print('[ERROR CHAT]', type(e).__name__, str(e), flush=True)