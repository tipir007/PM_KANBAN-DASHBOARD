from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "hello world"}
