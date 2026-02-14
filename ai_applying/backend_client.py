"""Cliente HTTP resiliente para chamadas ao backend de IA."""

import os
import time
from typing import Any, Dict, Generator, Optional

import httpx


class BackendError(RuntimeError):
    """Erro levantado quando o backend retorna falha após os retries."""


class BackendClient:
    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        retries: Optional[int] = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("AI_BACKEND_BASE_URL", "")).strip()
        if not self.base_url:
            raise RuntimeError("AI_BACKEND_BASE_URL não está configurada")

        self.token = (token or os.getenv("AI_BACKEND_TOKEN", "")).strip()
        self.timeout_seconds = timeout_seconds or int(os.getenv("AI_BACKEND_TIMEOUT_SECONDS", "10"))
        self.retries = retries or int(os.getenv("AI_BACKEND_RETRIES", "3"))

        self._client = httpx.Client(
            timeout=self.timeout_seconds,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )

    # -----------------------------
    # Public helpers
    # -----------------------------

    def get(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        return self._request("GET", path, params=params, context=context)

    def post(
        self,
        path: str,
        *,
        json_body: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        return self._request("POST", path, json_body=json_body, context=context)

    def stream(
        self,
        path: str,
        *,
        json_body: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Generator[str, None, None]:
        url = self._build_url(path)
        headers = self._headers(context or {})

        with self._client.stream("POST", url, json=json_body, headers=headers) as response:
            response.raise_for_status()
            for chunk in response.iter_text():
                if chunk:
                    yield chunk

    # -----------------------------
    # Internals
    # -----------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = self._build_url(path)
        headers = self._headers(context or {})

        last_error: Optional[Exception] = None

        for attempt in range(self.retries):
            try:
                started = time.perf_counter()
                response = self._client.request(
                    method,
                    url,
                    params=params,
                    json=json_body,
                    headers=headers,
                )
                response.raise_for_status()

                elapsed = round(time.perf_counter() - started, 4)
                content_type = response.headers.get("content-type", "")

                if content_type.startswith("application/json"):
                    data = response.json()
                    if isinstance(data, dict):
                        data.setdefault("_latency", elapsed)
                    return data

                return {"text": response.text, "_latency": elapsed}

            except httpx.HTTPStatusError as exc:
                raise BackendError(
                    f"{method} {url} -> {exc.response.status_code}: {exc.response.text[:200]}"
                ) from exc
            except Exception as exc:  # pragma: no cover - best effort
                last_error = exc
                time.sleep(0.2 * (2 ** attempt))

        raise BackendError(f"Falha ao chamar backend após retries: {last_error}")

    def _build_url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

    def _headers(self, context: Dict[str, Any]) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": "application/json",
            "X-Trace-Id": str(time.time_ns()),
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if context.get("user_id"):
            headers["X-User-Id"] = str(context["user_id"])
        if context.get("role"):
            headers["X-User-Role"] = str(context["role"])
        if context.get("company_slug"):
            headers["X-Company-Slug"] = str(context["company_slug"])
        return headers
