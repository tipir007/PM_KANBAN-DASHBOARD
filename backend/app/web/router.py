from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.core.config import settings
from app.web.fallback import FALLBACK_HTML

router = APIRouter()

STATIC_DIR = settings.static_dir
INDEX_FILE = STATIC_DIR / "index.html"


def _render_index() -> HTMLResponse:
    if INDEX_FILE.exists():
        return HTMLResponse(INDEX_FILE.read_text(encoding="utf-8"))
    return HTMLResponse(FALLBACK_HTML)


def resolve_static_file(full_path: str) -> Path | None:
    """Resolve full_path against STATIC_DIR, rejecting anything that escapes it."""
    requested_path = (STATIC_DIR / full_path).resolve()
    if requested_path.is_file() and Path(STATIC_DIR).resolve() in requested_path.parents:
        return requested_path
    return None


@router.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return _render_index()


@router.get("/{full_path:path}", response_class=HTMLResponse)
def spa_fallback(full_path: str) -> HTMLResponse:
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    if not INDEX_FILE.exists():
        return HTMLResponse(FALLBACK_HTML)

    static_file = resolve_static_file(full_path)
    if static_file is not None:
        return FileResponse(path=static_file)

    # Keep frontend client-side routes working when static build is available.
    return _render_index()
