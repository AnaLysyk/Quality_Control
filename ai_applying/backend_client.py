"""Cliente HTTP simples para chamadas ao backend de IA.

Este módulo fornece uma classe `BackendClient` usada pelos utilitários
do pacote `ai_applying` para chamar endpoints de IA de forma centralizada.
"""

import os
from typing import Any, Dict, Optional

import httpx


class BackendClient:
    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("AI_BACKEND_BASE_URL", "")).strip()
        self.token = (token or os.getenv("AI_BACKEND_TOKEN", "")).strip()
        self.timeout_seconds = timeout_seconds or int(os.getenv("AI_BACKEND_TIMEOUT_SECONDS", "10"))

    def get(self, path: str, *, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Any:
        return self._request("GET", path, params=params, context=context)

    def post(self, path: str, *, json_body: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Any:
        return self._request("POST", path, json_body=json_body, context=context)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        if not self.base_url:
            raise RuntimeError("AI_BACKEND_BASE_URL não está configurada")

        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/') }"
        headers = self._headers(context or {})

        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.request(method, url, params=params, json=json_body, headers=headers)
            response.raise_for_status()
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.json()
            return {"text": response.text}

    def _headers(self, context: Dict[str, Any]) -> Dict[str, str]:
        headers: Dict[str, str] = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if context.get("user_id"):
            headers["X-User-Id"] = str(context["user_id"])
        if context.get("role"):
            headers["X-User-Role"] = str(context["role"])
        if context.get("company_slug"):
            headers["X-Company-Slug"] = str(context["company_slug"])
        return headers
