from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class AIChatRequest(BaseModel):
    username: str = Field(default="user", min_length=1)
    question: str = Field(min_length=1)
    conversation: list[ChatMessage] = Field(default_factory=list)


class AIChatResponse(BaseModel):
    response: str
    board_update: dict | None = None
