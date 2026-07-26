from fastapi import APIRouter, Header, HTTPException

from app.api.deps import CurrentUsername, auth_service
from app.schemas.auth import AuthResponse, LoginRequest, MeResponse, RegisterRequest
from app.services.auth_service import AuthError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest) -> AuthResponse:
    try:
        return auth_service.register(payload.username, payload.password)
    except AuthError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    try:
        return auth_service.login(payload.username, payload.password)
    except AuthError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)) -> None:
    token = None
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip() or None
    if token:
        auth_service.logout(token)


@router.get("/me", response_model=MeResponse)
def me(username: str = CurrentUsername) -> MeResponse:
    return MeResponse(username=username)
