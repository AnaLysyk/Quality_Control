import os
import time
from typing import List, Dict, Generator, Optional

try:
    from openai import OpenAI
    _HAS_OPENAI = True
except Exception:
    OpenAI = None  # type: ignore
    _HAS_OPENAI = False

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

_client = None
if _HAS_OPENAI and OPENAI_API_KEY:
    try:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        _client = None


def generate_text(prompt: str, model: str = "gpt-4o-mini") -> str:
    """Synchronous single-response generator using OpenAI Responses API when available.
    Falls back to a deterministic placeholder when no key is configured.
    """
    if _client is None:
        return f"[mock] {prompt[:200]}"

    try:
        resp = _client.responses.create(model=model, input=prompt)
        # best-effort extraction of text
        out = getattr(resp, "output_text", None)
        if out:
            return out
        # fallback: join content elements
        if hasattr(resp, "output"):
            parts = []
            for item in resp.output:
                if isinstance(item, dict):
                    for k in ("content", "text"):
                        v = item.get(k)
                        if isinstance(v, str):
                            parts.append(v)
                        elif isinstance(v, list):
                            for chunk in v:
                                if isinstance(chunk, dict) and "text" in chunk:
                                    parts.append(chunk["text"]) 
                elif hasattr(item, "text"):
                    parts.append(item.text)
            if parts:
                return "".join(parts)
        return str(resp)
    except Exception as e:
        return f"[error] {e}"


def chat(messages: List[Dict[str, str]], model: str = "gpt-4o-mini") -> str:
    """Simple chat wrapper. `messages` is a list of {"role": "user|assistant|system", "content": "..."}
    """
    if _client is None:
        joined = "\n".join(m.get("content", "") for m in messages)
        return f"[mock-chat] {joined[:300]}"

    try:
        # Responses API accepts input as list of messages or string depending on SDK version
        resp = _client.responses.create(model=model, input=messages)
        return getattr(resp, "output_text", str(resp))
    except Exception as e:
        return f"[error] {e}"


def stream_text(prompt: str, model: str = "gpt-4o-mini") -> Generator[str, None, None]:
    """Yield text deltas. If OpenAI client not available, yield a mock stream.
    """
    if _client is None:
        for i in range(1, 4):
            yield f"[mock chunk {i}] " + prompt[:50]
            time.sleep(0.05)
        return

    try:
        # Some SDKs support streaming via `stream=True` or via an `iter` result.
        # We'll attempt a best-effort streaming call and fall back to a single response.
        stream = _client.responses.stream(model=model, input=prompt)
        for event in stream:
            # event may be bytes or dict-like
            text = None
            if hasattr(event, "get"):
                text = event.get("delta") or event.get("output_text") or event.get("text")
            else:
                text = str(event)
            if text:
                yield text
        return
    except Exception:
        # fallback single response
        yield generate_text(prompt, model=model)
