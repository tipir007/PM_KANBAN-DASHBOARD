from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Project Management MVP"
    static_dir: Path = Path(__file__).resolve().parents[2] / "static"
    db_path: Path = Path(__file__).resolve().parents[2] / "data" / "pm.db"


settings = Settings()
