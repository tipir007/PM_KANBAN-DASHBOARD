from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUsername
from app.schemas.board import (
    BoardContentResponse,
    BoardListResponse,
    BoardPayload,
    BoardSummary,
    CreateBoardRequest,
    RenameBoardRequest,
)
from app.services.board_service import (
    BoardNotFoundError,
    BoardService,
    LastBoardError,
)

router = APIRouter(prefix="/api/boards", tags=["boards"])
service = BoardService()


@router.get("", response_model=BoardListResponse)
def list_boards(username: str = CurrentUsername) -> BoardListResponse:
    return BoardListResponse(boards=service.list_boards(username))


@router.post("", response_model=BoardSummary, status_code=201)
def create_board(payload: CreateBoardRequest, username: str = CurrentUsername) -> BoardSummary:
    try:
        return service.create_board(username, payload.name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/{board_id}", response_model=BoardContentResponse)
def get_board(board_id: str, username: str = CurrentUsername) -> BoardContentResponse:
    try:
        name, board = service.get_board_by_id(username, board_id)
    except BoardNotFoundError as error:
        raise HTTPException(status_code=404, detail="board not found") from error
    return BoardContentResponse(id=board_id, name=name, board=board)


@router.put("/{board_id}", response_model=BoardContentResponse)
def update_board(
    board_id: str, payload: BoardPayload, username: str = CurrentUsername
) -> BoardContentResponse:
    try:
        name, board = service.save_board_by_id(username, board_id, payload)
    except BoardNotFoundError as error:
        raise HTTPException(status_code=404, detail="board not found") from error
    return BoardContentResponse(id=board_id, name=name, board=board)


@router.patch("/{board_id}", response_model=BoardSummary)
def rename_board(
    board_id: str, payload: RenameBoardRequest, username: str = CurrentUsername
) -> BoardSummary:
    try:
        return service.rename_board(username, board_id, payload.name)
    except BoardNotFoundError as error:
        raise HTTPException(status_code=404, detail="board not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/{board_id}", status_code=204)
def delete_board(board_id: str, username: str = CurrentUsername) -> None:
    try:
        service.delete_board(username, board_id)
    except BoardNotFoundError as error:
        raise HTTPException(status_code=404, detail="board not found") from error
    except LastBoardError as error:
        raise HTTPException(
            status_code=409, detail="cannot delete your only board"
        ) from error
