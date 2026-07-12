from fastapi import APIRouter, HTTPException

from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services.ai_service import AIConfigurationError, AIProviderError, AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])
service = AIService()


@router.post("/chat", response_model=AIChatResponse)
def chat(payload: AIChatRequest) -> AIChatResponse:
    try:
        message = service.chat(payload)
    except AIConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AIProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AIChatResponse(response=message, board_update=None)
