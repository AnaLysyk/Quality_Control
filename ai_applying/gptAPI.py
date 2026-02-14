import os
import time
from typing import Any, Dict, Generator, Iterable, List, Optional

try:
    from openai import OpenAI

    _HAS_OPENAI = True
except Exception:  # pragma: no cover - defensive import
    OpenAI = None  # type: ignore
    _HAS_OPENAI = False


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")
MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "3"))
DEFAULT_TIMEOUT = float(os.getenv("OPENAI_TIMEOUT", "45"))

_client: Optional[OpenAI] = None
if _HAS_OPENAI and OPENAI_API_KEY:
    try:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception:  # pragma: no cover - initialization guard
        _client = None


def _mock_text(prefix: str) -> str:
    return f"[mock] {prefix[:200]}"


def _extract_text(resp: Any) -> str:
    if hasattr(resp, "output_text") and resp.output_text:
        return str(resp.output_text)

    parts: List[str] = []
    for item in getattr(resp, "output", []) or []:
        content = getattr(item, "content", None)
        if isinstance(content, Iterable):
            for chunk in content:
                if hasattr(chunk, "text") and chunk.text:
                    parts.append(str(chunk.text))
    return "".join(parts) if parts else str(resp)


def _retry(fn, retries: int = MAX_RETRIES, base_delay: float = 0.5):
    for attempt in range(retries):
        try:
            return fn()
        except Exception:  # pragma: no cover - best effort resilience
            if attempt == retries - 1:
                raise
            time.sleep(base_delay * (2 ** attempt))


def generate_text(
    prompt: str,
    model: str = DEFAULT_MODEL,
    timeout: float = DEFAULT_TIMEOUT,
) -> str:
    """Generate a single response. Falls back to mock output when SDK/key missing."""

    if _client is None:
        return _mock_text(prompt)

    start = time.time()

    def _call():
        return _client.responses.create(model=model, input=prompt, timeout=timeout)

    try:
        resp = _retry(_call)
        text = _extract_text(resp).strip()
        latency = round(time.time() - start, 3)
        return text or f"[empty-response] {latency}s"
    except Exception as exc:
        return f"[error] {type(exc).__name__}: {exc}"


def chat(messages: List[Dict[str, str]], model: str = DEFAULT_MODEL) -> str:
    """Chat helper that accepts OpenAI Responses API style message list."""

    if not isinstance(messages, list):
        raise ValueError("messages must be a list of chat dicts")

    if _client is None:
        joined = "\n".join(m.get("content", "") for m in messages)
        return _mock_text(joined)

    try:
        resp = _retry(lambda: _client.responses.create(model=model, input=messages))
        return _extract_text(resp)
    except Exception as exc:
        return f"[error] {exc}"


def generate_json(prompt: str, schema_hint: str = "", model: str = DEFAULT_MODEL) -> str:
    """Request JSON payloads by augmenting the prompt."""

    full_prompt = f"{prompt}\nReturn ONLY valid JSON.\n{schema_hint}".strip()
    return generate_text(full_prompt, model=model)


def stream_text(prompt: str, model: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Yield streamed chunks; mock mode emits deterministic fragments."""

    if _client is None:
        for idx in range(1, 4):
            yield f"[mock chunk {idx}] {prompt[:50]}"
            time.sleep(0.05)
        return

    try:
        stream = _client.responses.stream(model=model, input=prompt)
        for event in stream:
            delta = getattr(event, "delta", None)
            if delta:
                yield str(delta)
    except Exception:
        yield generate_text(prompt, model=model)


def agent_call(prompt: str, tools: Optional[List[Dict[str, Any]]] = None, model: str = DEFAULT_MODEL):
    """Trigger a tool-enabled call; returns raw response for advanced flows."""

    if _client is None:
        return {"mock": True, "prompt": prompt, "tools": tools}

    return _client.responses.create(model=model, input=prompt, tools=tools or [])
