"""Probe utilitário para validar backend de IA local."""

import os
import sys
import time

import httpx


BASE_URL = os.getenv("AI_BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def ok(message: str) -> None:
    print(f"[OK] {message}")


def warn(message: str) -> None:
    print(f"[WARN] {message}")


def fail(message: str) -> None:
    print(f"[FAIL] {message}")


def _timed_get(client: httpx.Client, url: str, **kwargs) -> tuple[httpx.Response, int]:
    started = time.perf_counter()
    response = client.get(url, **kwargs)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    return response, elapsed_ms


def _show_preview(payload: object, limit: int = 120) -> str:
    text = str(payload)
    return text[:limit] + ("..." if len(text) > limit else "")


def check_health(client: httpx.Client) -> bool:
    response, elapsed = _timed_get(client, f"{BASE_URL}/health")

    if response.status_code != 200:
        fail(f"/health status={response.status_code}")
        return False

    try:
        data = response.json()
    except Exception:
        fail("/health não retornou JSON")
        return False

    if not isinstance(data, dict) or data.get("status") != "ok":
        fail(f"/health payload inesperado: {data}")
        return False

    ok(f"/health {elapsed}ms { _show_preview(data) }")
    return True


def check_generate(client: httpx.Client) -> bool:
    response, elapsed = _timed_get(client, f"{BASE_URL}/generate", params={"prompt": "probe-check"})

    if response.status_code != 200:
        fail(f"/generate status={response.status_code}")
        return False

    payload: str
    try:
        data = response.json()
        payload = str(data)
    except Exception:
        data = None
        payload = response.text

    if not payload.strip():
        fail("/generate retornou conteúdo vazio")
        return False

    if "[mock]" in payload:
        warn("modelo mock detectado")

    ok(f"/generate {elapsed}ms len={len(payload)}")
    return True


def main() -> None:
    print("=== AI BACKEND PROBE ===")

    try:
        with httpx.Client(timeout=10) as client:
            if not check_health(client):
                sys.exit(2)

            if not check_generate(client):
                sys.exit(3)

    except Exception as exc:
        fail(f"erro conexão: {exc}")
        sys.exit(1)

    ok("backend operacional")


if __name__ == "__main__":
    main()
