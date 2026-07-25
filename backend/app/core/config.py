from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Project Management MVP"
    static_dir: Path = BACKEND_ROOT / "static"
    db_path: Path = BACKEND_ROOT / "data" / "pm.db"
    openrouter_api_key: str | None = None
    openrouter_model: str = "moonshotai/kimi-k2.5"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_live_test_enabled: bool = False


settings = Settings()
