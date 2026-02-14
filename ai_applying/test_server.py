"""In-process tests for the FastAPI AI backend."""

from fastapi.testclient import TestClient

from ai_applying.server import app


client = TestClient(app)


def test_health_returns_service_metadata():
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-applying-backend"
    assert data["uptime_seconds"] >= 0


def test_generate_emits_text():
    prompt = "test-prompt"

    response = client.get("/generate", params={"prompt": prompt})
    assert response.status_code == 200

    data = response.json()
    assert data["prompt"] == prompt

    text = data.get("text", "")
    assert isinstance(text, str)
    assert text.strip()


def test_chat_endpoint_responds():
    response = client.get("/chat", params={"message": "ping"})
    assert response.status_code == 200

    data = response.json()
    assert data["message"] == "ping"
    assert isinstance(data.get("reply", ""), str)
    assert data["reply"].strip()


def test_stream_endpoint_yields_content():
    response = client.get("/stream", params={"prompt": "stream me"})
    assert response.status_code == 200

    collected = "".join(response.iter_text())
    assert collected.strip()


def test_agent_chat_roundtrip():
    payload = {"session_id": "test", "message": "hi"}

    response = client.post("/agent/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["session_id"] == "test"
    assert data["reply"].strip()


def test_agent_reset():
    payload = {"session_id": "reset-me"}

    response = client.post("/agent/reset", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["ok"] is True
    assert data["reset"] == "reset-me"


def test_agent_chat_requires_message():
    response = client.post("/agent/chat", json={"session_id": "x"})
    assert response.status_code == 422
    assert response.json()["error"] == "message is required"


def test_agent_chat_stream_requires_message():
    response = client.post("/agent/chat_stream", json={})
    assert response.status_code == 422
    assert response.json()["error"] == "message is required"
