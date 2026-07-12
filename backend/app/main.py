from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.api.ai import router as ai_router
from app.api.board import router as board_router
from app.api.health import router as system_router
from app.core.config import settings
from app.db.bootstrap import init_database

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(system_router)
app.include_router(board_router)
app.include_router(ai_router)

STATIC_DIR = settings.static_dir
INDEX_FILE = STATIC_DIR / "index.html"

FALLBACK_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Management MVP</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #032147; }
      code { background: #f3f3f3; padding: 0.2rem 0.4rem; border-radius: 4px; }
      #status { color: #888888; margin-top: 0.8rem; }
    </style>
  </head>
  <body>
    <h1>Project Management MVP</h1>
    <p>Backend scaffold is running. API call status:</p>
    <div id="status">Checking <code>/api/hello</code>...</div>
    <script>
      fetch('/api/hello')
        .then((response) => response.json())
        .then((data) => {
          document.getElementById('status').textContent = `API OK: ${data.message}`;
        })
        .catch(() => {
          document.getElementById('status').textContent = 'API check failed';
        });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    if INDEX_FILE.exists():
        return HTMLResponse(INDEX_FILE.read_text(encoding="utf-8"))
    return HTMLResponse(FALLBACK_HTML)


@app.get("/{full_path:path}", response_class=HTMLResponse)
def spa_fallback(full_path: str) -> HTMLResponse:
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    if INDEX_FILE.exists():
        requested_path = (STATIC_DIR / full_path).resolve()
        if requested_path.is_file() and Path(STATIC_DIR).resolve() in requested_path.parents:
            return FileResponse(path=requested_path)
        # Keep frontend client-side routes working when static build is available.
        return HTMLResponse(INDEX_FILE.read_text(encoding="utf-8"))
    return HTMLResponse(FALLBACK_HTML)
