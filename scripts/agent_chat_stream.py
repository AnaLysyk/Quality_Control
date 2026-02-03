import httpx

payload = {"session_id": "demo-1", "message": "Stream recent runs for company acme"}
try:
    with httpx.stream("POST", "http://127.0.0.1:8000/agent/chat_stream", json=payload, timeout=30.0) as resp:
        print("STATUS", resp.status_code)
        for chunk in resp.iter_text():
            if chunk:
                print(repr(chunk))
except Exception as e:
    print("ERROR", e)
