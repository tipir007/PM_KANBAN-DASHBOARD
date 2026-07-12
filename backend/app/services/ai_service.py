import json

import httpx

from app.core.config import settings
from app.schemas.ai import AIChatRequest, AIChatStructuredOutput
from app.schemas.board import BoardPayload


class AIConfigurationError(ValueError):
    """Raised when AI configuration is missing or invalid."""


class AIProviderError(RuntimeError):
    """Raised when the AI provider call fails."""


class AIService:
    def __init__(self, timeout_seconds: float = 30.0):
        self.timeout_seconds = timeout_seconds

    def chat(self, payload: AIChatRequest, board: BoardPayload) -> AIChatStructuredOutput:
        api_key = (settings.openrouter_api_key or "").strip()
        if not api_key:
            raise AIConfigurationError(
                "OPENROUTER_API_KEY is not configured. Set it in the project .env file."
            )

        messages = [message.model_dump() for message in payload.conversation]
        messages.append(
            {
                "role": "user",
                "content": (
                    "User question:\n"
                    f"{payload.question}\n\n"
                    "Current Kanban board JSON:\n"
                    f"{json.dumps(board.model_dump(), ensure_ascii=True)}"
                ),
            }
        )

        try:
            response = httpx.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": messages,
                    "temperature": 0,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "kanban_chat_response",
                            "strict": True,
                            "schema": AIChatStructuredOutput.model_json_schema(),
                        },
                    },
                },
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as error:
            raise AIProviderError(f"OpenRouter request failed: {error}") from error

        if response.status_code == 401:
            raise AIProviderError("OpenRouter rejected the API key (401 Unauthorized).")

        if response.status_code >= 400:
            raise AIProviderError(
                f"OpenRouter returned {response.status_code}: {response.text}"
            )

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise AIProviderError("OpenRouter response did not include choices.")

        message = choices[0].get("message", {})
        content = message.get("content", "")
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError("OpenRouter response content was empty.")

        return parse_structured_output(content.strip())


def parse_structured_output(content: str) -> AIChatStructuredOutput:
    try:
        decoded = json.loads(content)
    except json.JSONDecodeError as error:
        raise AIProviderError(
            "OpenRouter response did not match expected structured JSON output."
        ) from error

    try:
        return AIChatStructuredOutput.model_validate(decoded)
    except Exception as error:
        raise AIProviderError(
            "OpenRouter structured output was invalid for the expected response schema."
        ) from error
