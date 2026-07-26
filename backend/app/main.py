from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.board import router as board_router
from app.api.boards import router as boards_router
from app.api.health import router as system_router
from app.core.config import settings
from app.db.bootstrap import init_database
from app.web.router import router as web_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# web_router's catch-all route must be registered last: FastAPI matches routes in
# registration order, and its "/{full_path:path}" pattern would otherwise shadow /api/*.
app.include_router(system_router)
app.include_router(auth_router)
app.include_router(board_router)
app.include_router(boards_router)
app.include_router(ai_router)
app.include_router(web_router)
