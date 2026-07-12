import httpx

from app.core.config import settings
from app.schemas.ai import AIChatRequest


class AIConfigurationError(ValueError):
    """Raised when AI configuration is missing or invalid."""


class AIProviderError(RuntimeError):
    """Raised when the AI provider call fails."""


class AIService:
    def __init__(self, timeout_seconds: float = 30.0):
        self.timeout_seconds = timeout_seconds

    def chat(self, payload: AIChatRequest) -> str:
        api_key = (settings.openrouter_api_key or "").strip()
        if not api_key:
            raise AIConfigurationError(
                "OPENROUTER_API_KEY is not configured. Set it in the project .env file."
            )

        messages = [message.model_dump() for message in payload.conversation]
        messages.append({"role": "user", "content": payload.question})

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

        return content.strip()
