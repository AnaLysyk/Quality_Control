"""Minimal FastAPI server exposing AI helper endpoints."""

import os
import time
from typing import Any, AsyncGenerator, Dict, Generator, Union

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from . import gptAPI

app = FastAPI(title="AI-Applying (minimal)")

_SERVICE_NAME = os.getenv("AI_BACKEND_SERVICE_NAME", "ai-applying-backend")
_ENVIRONMENT = os.getenv("AI_BACKEND_ENV", "local")
_VERSION = os.getenv("AI_BACKEND_VERSION", "dev")
_STARTED_AT = time.time()


@app.get("/health")
async def health() -> Dict[str, Any]:
    uptime = round(time.time() - _STARTED_AT, 2)
    return {
        "status": "ok",
        "service": _SERVICE_NAME,
        "environment": _ENVIRONMENT,
        "version": _VERSION,
        "uptime_seconds": uptime,
    }


@app.get("/generate")
async def generate(prompt: str = "Hello") -> Dict[str, Any]:
    text = gptAPI.generate_text(prompt)
    return {"prompt": prompt, "text": text}


@app.get("/chat")
async def chat(message: str = "Hi") -> Dict[str, Any]:
    reply = gptAPI.chat([{"role": "user", "content": message}])
    return {"message": message, "reply": reply}


@app.get("/stream")
async def stream(prompt: str = "Stream me") -> StreamingResponse:
    def iter_stream() -> Generator[str, None, None]:
        for chunk in gptAPI.stream_text(prompt):
            yield chunk

    return StreamingResponse(iter_stream(), media_type="text/plain")


@app.post("/agent/chat")
async def agent_chat(payload: Dict[str, Any]) -> Union[Dict[str, Any], JSONResponse]:
    raw_message = payload.get("message")
    message = str(raw_message or "").strip()
    if not message:
        return JSONResponse({"error": "message is required"}, status_code=422)

    session = payload.get("session_id")
    reply = gptAPI.chat([{"role": "user", "content": message}])
    return {"session_id": session, "reply": reply}


@app.post("/agent/reset")
async def agent_reset(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"ok": True, "reset": payload.get("session_id")}


@app.post("/agent/chat_stream")
async def agent_chat_stream(request: Request) -> Union[StreamingResponse, JSONResponse]:
    body = await request.json()
    raw_message = body.get("message")
    message = str(raw_message or "").strip()
    if not message:
        return JSONResponse({"error": "message is required"}, status_code=422)

    async def streamer() -> AsyncGenerator[str, None]:
        for chunk in gptAPI.stream_text(message):
            yield chunk

    return StreamingResponse(streamer(), media_type="text/plain")


@app.get("/agent/ui")
async def agent_ui() -> HTMLResponse:
    html = """
    <html><body>
    <h3>AI-Applying Agent UI (minimal)</h3>
    <p>Use POST /agent/chat to interact.</p>
    </body></html>
    """
    return HTMLResponse(html)


@app.post("/observer/event")
async def observer_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    # In a real implementation, would store/process the event
    return {"ok": True, "received": payload}


@app.get("/observer/report")
async def observer_report() -> Dict[str, str]:
    return {"report": "no-data"}
