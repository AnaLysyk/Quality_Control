AI-Applying (minimal)

Quickstart

- Create a .env from .env.example and set `OPENAI_API_KEY`.
- Create venv and install dependencies:

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

- Run the FastAPI server:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn ai_applying.server:app --reload --port 8000
```

CLI

```powershell
python -m ai_applying generate "Explain what an API is in one sentence."
python -m ai_applying chat "Hi"
python -m ai_applying stream "Write a short story in two lines."
```

API Endpoints

GET /health
GET /generate?prompt=...
GET /chat?message=...
GET /stream?prompt=...

Agent API

POST /agent/chat
POST /agent/reset
POST /agent/chat_stream
GET /agent/ui

Observer API

POST /observer/event
GET /observer/report

Notes

- The implementation attempts to use the OpenAI Responses API via the `openai` package. If `OPENAI_API_KEY` is not set, the CLI and API return mocked responses for quick testing.
