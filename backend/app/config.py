from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "OjaFlow API"
    database_url: str = "sqlite:///./ojaflow.db"
    frontend_origins: str = "http://localhost:5173"
    session_secret: str = "development-only-change-me"
    session_days: int = 14
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    otp_provider: str = "console"
    otp_ttl_minutes: int = 5
    termii_base_url: str = ""
    termii_api_key: str = ""
    termii_sender_id: str = "OjaFlow"
    termii_channel: str = "generic"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()