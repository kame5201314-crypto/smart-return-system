"""
API 依賴注入
"""
from supabase import create_client, Client

from app.core.config import get_settings

settings = get_settings()


def get_supabase_client() -> Client:
    """取得 Supabase 客戶端"""
    return create_client(settings.supabase_url, settings.supabase_service_key)
