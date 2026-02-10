from fastapi.testclient import TestClient
from ai_applying.server import app


def main():
    client = TestClient(app)
    print("/health ->", client.get("/health").json())
    print("/generate ->", client.get("/generate", params={"prompt": "test-prompt"}).json())


if __name__ == "__main__":
    main()
