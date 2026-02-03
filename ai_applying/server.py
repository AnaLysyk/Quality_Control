import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse
from typing import Dict

from . import gptAPI

app = FastAPI(title="AI-Applying (minimal)")


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/generate")
async def generate(prompt: str = "Hello"):
    text = gptAPI.generate_text(prompt)
    return {"prompt": prompt, "text": text}


@app.get("/chat")
async def chat(message: str = "Hi"):
    out = gptAPI.chat([{"role": "user", "content": message}])
    return {"message": message, "reply": out}


@app.get("/stream")
async def stream(prompt: str = "Stream me"):
    def iter_stream():
        for chunk in gptAPI.stream_text(prompt):
            yield chunk
    return StreamingResponse(iter_stream(), media_type="text/plain")


# Agent API (simple stubs)
@app.post("/agent/chat")
async def agent_chat(payload: Dict):
    session = payload.get("session_id")
    message = payload.get("message")
    reply = gptAPI.chat([{"role": "user", "content": message}])
    return {"session_id": session, "reply": reply}


@app.post("/agent/reset")
async def agent_reset(payload: Dict):
    return {"ok": True, "reset": payload.get("session_id")}


@app.post("/agent/chat_stream")
async def agent_chat_stream(request: Request):
    body = await request.json()
    message = body.get("message", "")

    async def streamer():
        for chunk in gptAPI.stream_text(message):
            yield chunk
    return StreamingResponse(streamer(), media_type="text/plain")


@app.get("/agent/ui")
async def agent_ui():
    html = """
    <html><body>
    <h3>AI-Applying Agent UI (minimal)</h3>
    <p>Use POST /agent/chat to interact.</p>
    </body></html>
    """
    return HTMLResponse(html)


# Observer endpoints (minimal)
@app.post("/observer/event")
async def observer_event(payload: Dict):
    # In a real implementation, would store/process the event
    return {"ok": True, "received": payload}


@app.get("/observer/report")
async def observer_report():
    return {"report": "no-data"}
