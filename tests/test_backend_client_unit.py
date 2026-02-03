import httpx
import respx

from ai_applying.backend_client import BackendClient

@respx.mock
def test_backend_client_get():
    url = "https://httpbin.org/get"
    route = respx.get(url).mock(return_value=httpx.Response(200, json={"args": {"test": "1"}}))

    client = BackendClient(base_url="https://httpbin.org")
    resp = client.get("/get", params={"test": "1"})

    assert resp["args"]["test"] == "1"
    assert route.called
