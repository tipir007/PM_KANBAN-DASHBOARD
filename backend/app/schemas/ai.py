from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.board import BoardPayload


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class AIChatRequest(BaseModel):
    username: str = Field(default="user", min_length=1)
    board_id: str | None = None
    question: str = Field(min_length=1)
    conversation: list[ChatMessage] = Field(default_factory=list)


class AIChatResponse(BaseModel):
    response: str
    board_update: BoardPayload | None = None


class AIChatStructuredOutput(BaseModel):
    response: str = Field(min_length=1)
    board_update: BoardPayload | None = None
