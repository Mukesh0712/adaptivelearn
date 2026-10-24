# AdaptiveLearn AI service

A small Python (FastAPI) server that does the AI work. Only the Node
backend calls it, with a shared secret in the `X-Internal-Key` header;
browsers never talk to it directly.

```
app/
  main.py        routes: /health (public) and /v1/* (secret needed)
  config.py      settings from .env, checked at startup
  security.py    secret check + body size limit, before the body is read
  providers/     the AI model behind the service ("mock" for now)
  tasks/         one file per job: prompt, input limits, output checks
tests/           python -m pytest
```

| Route | Used for |
|---|---|
| `GET /health` | Render's health check; wakes a sleeping service |
| `GET /v1/status` | which provider/model is answering (admin dashboard) |
| `POST /v1/feedback` | explain a student's wrong quiz answer |
| `POST /v1/summary` | summary of a lesson (instructor) |
| `POST /v1/questions` | draft quiz questions from a lesson (instructor), as checked JSON |
| `POST /v1/chat` | study assistant: answer a question from one lesson's text |

Only quiz/lesson text and the student's own question are sent; never
names, emails or ids. Text inside the prompt's data tags (`<lesson>`,
`<question>`…) is treated as data, and a closing tag typed inside it is
defused, so instructions hidden in a lesson can't take over the prompt.

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
