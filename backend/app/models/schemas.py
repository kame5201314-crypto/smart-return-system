"""
Pydantic 資料模型
定義 API 請求/回應的資料結構
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl


# ============================================
# 列舉類型
# ============================================
class AssetType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class AssetStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SENT_TO_VENDOR = "sent_to_vendor"


class AnnotationType(str, Enum):
    TYPO = "typo"
    SPEC_ERROR = "spec_error"
    PRICE_ERROR = "price_error"
    BRAND_VIOLATION = "brand_violation"
    FORBIDDEN_WORD = "forbidden_word"
    SUGGESTION = "suggestion"


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


# ============================================
# AI 檢查相關
# ============================================
class AICheckRequest(BaseModel):
    """AI 檢查請求"""

    asset_id: str
    file_url: str
    file_type: AssetType
    org_id: str = "00000000-0000-0000-0000-000000000001"
    rules: Optional[List[Dict[str, Any]]] = None


class AnnotationResult(BaseModel):
    """單一標註結果"""

    annotation_type: AnnotationType
    severity: Severity
    position: Dict[str, Any] = Field(
        ..., description="位置資訊 (圖片座標或影片時間戳)"
    )
    detected_text: Optional[str] = None
    expected_text: Optional[str] = None
    correction_suggestion: Optional[str] = None
    creative_suggestion: Optional[str] = None
    ai_confidence: float = Field(..., ge=0, le=100)
    matched_rule_id: Optional[str] = None


class AICheckResponse(BaseModel):
    """AI 檢查回應"""

    asset_id: str
    status: str = "completed"
    error_count: int = 0
    warning_count: int = 0
    suggestion_count: int = 0
    ai_confidence_score: float
    annotations: List[AnnotationResult] = []
    processing_time_ms: int
    message: Optional[str] = None


class AICheckBatchRequest(BaseModel):
    """批次 AI 檢查請求"""

    assets: List[AICheckRequest]


class AICheckBatchResponse(BaseModel):
    """批次 AI 檢查回應"""

    total: int
    completed: int
    failed: int
    results: List[AICheckResponse]


# ============================================
# 雲端同步相關
# ============================================
class CloudSyncRequest(BaseModel):
    """雲端同步請求"""

    connection_id: str
    folder_id: str
    provider: str = "google_drive"


class CloudFileInfo(BaseModel):
    """雲端檔案資訊"""

    file_id: str
    file_name: str
    file_type: AssetType
    file_url: str
    file_size_bytes: int
    mime_type: str
    created_time: datetime
    modified_time: datetime


class CloudSyncResponse(BaseModel):
    """雲端同步回應"""

    connection_id: str
    total_files: int
    new_files: int
    files: List[CloudFileInfo]
    sync_completed_at: datetime


# ============================================
# 影片處理相關
# ============================================
class VideoProcessRequest(BaseModel):
    """影片處理請求"""

    asset_id: str
    video_url: str
    extract_keyframes: bool = True
    extract_audio: bool = True
    keyframe_interval_seconds: float = 5.0


class KeyframeInfo(BaseModel):
    """關鍵影格資訊"""

    timestamp_seconds: float
    frame_url: str
    text_detected: Optional[str] = None


class TranscriptSegment(BaseModel):
    """字幕片段"""

    start_seconds: float
    end_seconds: float
    text: str


class VideoProcessResponse(BaseModel):
    """影片處理回應"""

    asset_id: str
    duration_seconds: float
    keyframes: List[KeyframeInfo] = []
    transcript: List[TranscriptSegment] = []
    processing_time_ms: int


# ============================================
# 通用回應
# ============================================
class HealthResponse(BaseModel):
    """健康檢查回應"""

    status: str = "healthy"
    version: str = "1.0.0"
    timestamp: datetime


class ErrorResponse(BaseModel):
    """錯誤回應"""

    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class TaskStatusResponse(BaseModel):
    """非同步任務狀態回應"""

    task_id: str
    status: str  # pending, processing, completed, failed
    progress: int = Field(0, ge=0, le=100)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
