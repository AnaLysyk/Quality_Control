payload = {"session_id": "demo-1", "message": "Stream recent runs for company acme"}
import httpx

payload = {"session_id": "demo-1", "message": "Stream recent runs for company acme"}
try:
    with httpx.stream("POST", "http://127.0.0.1:8000/agent/chat_stream", json=payload, timeout=30.0) as resp:
        print("STATUS", resp.status_code, flush=True)
        if resp.status_code != 200:
            print("Erro: status", resp.status_code, flush=True)
            print(resp.text, flush=True)
        else:
            for chunk in resp.iter_text():
                if chunk:
                    print(repr(chunk), flush=True)
except Exception as e:
    print("[ERROR STREAM]", type(e).__name__, str(e), flush=True)
