from fastapi import Depends, Header, HTTPException

from app.services.auth_service import AuthService

auth_service = AuthService()


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def get_current_username(authorization: str | None = Header(default=None)) -> str:
    """Resolve the authenticated username from the Authorization: Bearer <token> header."""
    token = extract_bearer_token(authorization)
    if token is None:
        raise HTTPException(status_code=401, detail="authentication required")
    username = auth_service.username_for_token(token)
    if username is None:
        raise HTTPException(status_code=401, detail="invalid or expired session")
    return username


CurrentUsername = Depends(get_current_username)
