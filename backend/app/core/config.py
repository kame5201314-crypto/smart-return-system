"""
應用程式配置
使用 pydantic-settings 從環境變數讀取設定
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """應用程式設定"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 伺服器設定
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    allowed_origins: str = "http://localhost:3000"

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o"
    openai_vision_max_tokens: int = 4096

    # Google Drive
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/oauth/google/callback"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 安全設定
    api_secret_key: str
    access_token_expire_minutes: int = 60

    # AI 處理設定
    ai_batch_size: int = 10
    ai_timeout_seconds: int = 120
    ai_confidence_threshold: int = 70

    @property
    def allowed_origins_list(self) -> List[str]:
        """解析允許的來源清單"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """取得快取的設定實例"""
    return Settings()
