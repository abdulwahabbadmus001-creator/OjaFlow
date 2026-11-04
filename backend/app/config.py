from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "OjaFlow API"

    database_url: str = "sqlite:///./ojaflow.db"

    frontend_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"

    session_secret: str = "ojaflow-development-only-secret-key-change-before-production-32b"
    session_days: int = 14

    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # OTP providers:
    # console   -> prints OTP in backend terminal
    # whatsapp  -> sends OTP through WhatsApp Cloud API
    # termii    -> existing Termii SMS provider
    otp_provider: str = "console"
    otp_ttl_minutes: int = 5

    # WhatsApp Cloud API
    whatsapp_api_url: str = ""
    whatsapp_access_token: str = ""
    whatsapp_template_name: str = "ojaflow_verification"
    whatsapp_template_language: str = "en_US"

    # Existing Termii configuration
    termii_base_url: str = ""
    termii_api_key: str = ""
    termii_sender_id: str = "OjaFlow"
    termii_channel: str = "generic"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
