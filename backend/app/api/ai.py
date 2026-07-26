from fastapi import APIRouter, HTTPException

from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services.ai_service import AIConfigurationError, AIProviderError, AIService
from app.services.board_service import BoardNotFoundError, BoardService

router = APIRouter(prefix="/api/ai", tags=["ai"])
service = AIService()
board_service = BoardService()


@router.post("/chat", response_model=AIChatResponse)
def chat(payload: AIChatRequest) -> AIChatResponse:
    try:
        if payload.board_id is not None:
            _, board = board_service.get_board_by_id(payload.username, payload.board_id)
        else:
            board = board_service.get_board(payload.username)

        ai_output = service.chat(payload, board)

        updated_board = None
        if ai_output.board_update is not None:
            if payload.board_id is not None:
                _, updated_board = board_service.save_board_by_id(
                    payload.username, payload.board_id, ai_output.board_update
                )
            else:
                updated_board = board_service.save_board(
                    payload.username, ai_output.board_update
                )
    except AIConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AIProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except BoardNotFoundError as error:
        raise HTTPException(status_code=404, detail="board not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return AIChatResponse(response=ai_output.response, board_update=updated_board)
