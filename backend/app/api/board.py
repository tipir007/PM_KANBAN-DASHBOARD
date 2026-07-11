from fastapi import APIRouter, HTTPException, Query

from app.schemas.board import BoardPayload, BoardResponse
from app.services.board_service import BoardService

router = APIRouter(prefix="/api", tags=["board"])
service = BoardService()


@router.get("/board", response_model=BoardResponse)
def get_board(username: str = Query(default="user")) -> BoardResponse:
    try:
        board = service.get_board(username)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return BoardResponse(username=username, board=board)


@router.put("/board", response_model=BoardResponse)
def update_board(payload: BoardPayload, username: str = Query(default="user")) -> BoardResponse:
    try:
        board = service.save_board(username, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return BoardResponse(username=username, board=board)
