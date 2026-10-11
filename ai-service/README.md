# AdaptiveLearn AI service

A small Python (FastAPI) server that does the AI work. Only the Node
backend calls it, with a shared secret in the `X-Internal-Key` header;
browsers never talk to it directly.

```
app/
  main.py        routes: /health (public) and /v1/* (secret needed)
  config.py      settings from .env, checked at startup
  security.py    the shared-secret check
  providers/     the AI model behind the service ("mock" for now)
tests/           python -m pytest
```

## Run it locally (PowerShell, from the `ai-service` folder)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env      # then set AI_SERVICE_SECRET in .env
uvicorn app.main:app --reload --port 8000
```

Check: <http://localhost:8000/health> shows `{"status":"ok"}` and the
API docs are at <http://localhost:8000/docs>.

Tests: `python -m pytest`
