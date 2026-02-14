"""Manual probe to validate BackendClient behaviour against httpbin."""

from typing import Any, Dict

from ai_applying.backend_client import BackendClient


def _print_result(label: str, payload: Any) -> None:
    print(f"{label}: {payload}")


def _exercise_get(client: BackendClient) -> None:
    response = client.get("/get", params={"test": "1"})
    args = response.get("args", {}) if isinstance(response, dict) else response
    _print_result("GET args", args)
    if isinstance(args, dict) and args.get("test") == "1":
        print("[OK] GET echo matches expected value")
    else:
        print("[WARN] Unexpected GET echo payload")


def _exercise_post(client: BackendClient) -> None:
    payload: Dict[str, Any] = {"value": 42}
    response = client.post("/post", json_body=payload)
    echoed = response.get("json") if isinstance(response, dict) else response
    _print_result("POST json", echoed)
    if isinstance(echoed, dict) and echoed.get("value") == 42:
        print("[OK] POST echo matches expected value")
    else:
        print("[WARN] Unexpected POST echo payload")


def _exercise_timeout() -> None:
    try:
        slow_client = BackendClient(base_url="https://httpbin.org/delay/3", timeout_seconds=1, token="")
        slow_client.get("/")
        print("[WARN] Timeout probe did not raise as expected")
    except Exception as exc:
        print(f"[OK] Timeout probe raised: {type(exc).__name__}: {exc}")


def main() -> None:
    try:
        client = BackendClient(base_url="https://httpbin.org", timeout_seconds=10, token="")
    except Exception as exc:
        print(f"[FAIL] Could not initialise BackendClient: {exc}")
        return

    _exercise_get(client)
    _exercise_post(client)
    _exercise_timeout()


if __name__ == "__main__":
    main()
