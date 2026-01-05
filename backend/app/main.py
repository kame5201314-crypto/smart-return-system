"""
AI Visual QC Automator - FastAPI 後端
主程式入口點
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import ai_check, cloud_sync
from app.core.config import get_settings
from app.models.schemas import ErrorResponse, HealthResponse

# 設定 logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時執行
    logger.info("🚀 AI Visual QC Automator 後端服務啟動中...")
    logger.info(f"📍 監聽地址: {settings.host}:{settings.port}")
    logger.info(f"🔧 偵錯模式: {settings.debug}")
    yield
    # 關閉時執行
    logger.info("👋 服務關閉中...")


# 建立 FastAPI 應用
app = FastAPI(
    title="AI Visual QC Automator API",
    description="""
    ## 視覺品管自動化系統 API

    提供以下功能：
    - **AI 智能檢查**：使用 GPT-4o Vision 分析圖片錯誤
    - **雲端同步**：連接 Google Drive 資料夾
    - **影片處理**：提取關鍵影格與語音轉文字
    - **批次處理**：支援非同步批次處理

    ### 認證方式
    所有 API 都需要在 Header 中帶入 `X-API-Key`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全域例外處理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全域例外處理 - 隱藏詳細錯誤訊息"""
    logger.error(f"未處理的例外: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="內部伺服器錯誤",
            detail="操作失敗，請稍後再試",
            code="INTERNAL_ERROR",
        ).model_dump(),
    )


# 註冊路由
app.include_router(ai_check.router, prefix="/api")
app.include_router(cloud_sync.router, prefix="/api")


# 健康檢查端點
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["系統"],
    summary="健康檢查",
)
async def health_check():
    """健康檢查端點"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc),
    )


@app.get("/", tags=["系統"])
async def root():
    """根路徑"""
    return {
        "name": "AI Visual QC Automator API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
