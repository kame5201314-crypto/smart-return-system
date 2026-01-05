"""
AI 檢查 API 路由
處理圖片/影片的 AI 智能檢查
"""
import logging
import time
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.security import verify_api_key
from app.models.schemas import (
    AICheckBatchRequest,
    AICheckBatchResponse,
    AICheckRequest,
    AICheckResponse,
    AnnotationResult,
    TaskStatusResponse,
)
from app.services.openai_vision import get_vision_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-check", tags=["AI 檢查"])

# 儲存非同步任務狀態（生產環境應使用 Redis）
_task_status: dict = {}


@router.post(
    "/image",
    response_model=AICheckResponse,
    summary="AI 圖片檢查",
    description="使用 GPT-4o Vision 分析圖片，找出錯誤並提供建議",
)
async def check_image(
    request: AICheckRequest,
    _: str = Depends(verify_api_key),
):
    """
    AI 圖片檢查

    - 分析圖片中的文字
    - 比對產品規格庫
    - 找出錯別字、規格錯誤、品牌違規
    - 提供創意改進建議
    """
    start_time = time.time()

    try:
        vision_service = get_vision_service()

        # 呼叫 AI 分析
        result = await vision_service.analyze_image(
            image_url=request.file_url,
            rules=request.rules,
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI 分析失敗",
            )

        # 解析標註結果
        annotations = vision_service.parse_annotations(
            result["result"], request.asset_id
        )

        # 統計錯誤數量
        error_count = sum(1 for a in annotations if a.severity.value == "error")
        warning_count = sum(1 for a in annotations if a.severity.value == "warning")
        suggestion_count = sum(1 for a in annotations if a.severity.value == "info")

        # 計算整體信心分數
        if annotations:
            ai_confidence_score = sum(a.ai_confidence for a in annotations) / len(
                annotations
            )
        else:
            ai_confidence_score = 100.0

        processing_time = int((time.time() - start_time) * 1000)

        return AICheckResponse(
            asset_id=request.asset_id,
            status="completed",
            error_count=error_count,
            warning_count=warning_count,
            suggestion_count=suggestion_count,
            ai_confidence_score=ai_confidence_score,
            annotations=annotations,
            processing_time_ms=processing_time,
        )

    except Exception as e:
        logger.error(f"AI 檢查失敗: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 處理過程發生錯誤",
        ) from e


@router.post(
    "/batch",
    response_model=AICheckBatchResponse,
    summary="批次 AI 檢查",
    description="批次處理多個素材的 AI 檢查",
)
async def check_batch(
    request: AICheckBatchRequest,
    _: str = Depends(verify_api_key),
):
    """
    批次 AI 檢查

    - 一次處理多個素材
    - 並行處理以提高效率
    - 回傳所有結果
    """
    import asyncio

    results: List[AICheckResponse] = []
    failed_count = 0

    # 並行處理所有請求
    async def process_single(req: AICheckRequest) -> AICheckResponse:
        try:
            # 複用單一檢查邏輯
            vision_service = get_vision_service()
            result = await vision_service.analyze_image(
                image_url=req.file_url,
                rules=req.rules,
            )

            annotations = vision_service.parse_annotations(result["result"], req.asset_id)

            error_count = sum(1 for a in annotations if a.severity.value == "error")
            warning_count = sum(1 for a in annotations if a.severity.value == "warning")
            suggestion_count = sum(1 for a in annotations if a.severity.value == "info")

            ai_confidence_score = (
                sum(a.ai_confidence for a in annotations) / len(annotations)
                if annotations
                else 100.0
            )

            return AICheckResponse(
                asset_id=req.asset_id,
                status="completed",
                error_count=error_count,
                warning_count=warning_count,
                suggestion_count=suggestion_count,
                ai_confidence_score=ai_confidence_score,
                annotations=annotations,
                processing_time_ms=0,
            )
        except Exception as e:
            logger.error(f"批次處理失敗 (asset_id={req.asset_id}): {str(e)}")
            return AICheckResponse(
                asset_id=req.asset_id,
                status="failed",
                error_count=0,
                warning_count=0,
                suggestion_count=0,
                ai_confidence_score=0,
                annotations=[],
                processing_time_ms=0,
                message=str(e),
            )

    # 執行並行處理
    tasks = [process_single(req) for req in request.assets]
    results = await asyncio.gather(*tasks)

    failed_count = sum(1 for r in results if r.status == "failed")

    return AICheckBatchResponse(
        total=len(request.assets),
        completed=len(request.assets) - failed_count,
        failed=failed_count,
        results=results,
    )


@router.post(
    "/async",
    response_model=TaskStatusResponse,
    summary="非同步 AI 檢查",
    description="提交 AI 檢查任務並立即返回，稍後查詢結果",
)
async def check_async(
    request: AICheckRequest,
    background_tasks: BackgroundTasks,
    _: str = Depends(verify_api_key),
):
    """
    非同步 AI 檢查

    - 立即返回任務 ID
    - 背景處理 AI 分析
    - 使用 GET /status/{task_id} 查詢結果
    """
    import uuid
    from datetime import datetime, timezone

    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # 初始化任務狀態
    _task_status[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "progress": 0,
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }

    # 背景任務處理函數
    async def process_task():
        try:
            _task_status[task_id]["status"] = "processing"
            _task_status[task_id]["progress"] = 10
            _task_status[task_id]["updated_at"] = datetime.now(timezone.utc)

            vision_service = get_vision_service()
            result = await vision_service.analyze_image(
                image_url=request.file_url,
                rules=request.rules,
            )

            _task_status[task_id]["progress"] = 80

            annotations = vision_service.parse_annotations(result["result"], request.asset_id)

            _task_status[task_id]["status"] = "completed"
            _task_status[task_id]["progress"] = 100
            _task_status[task_id]["result"] = {
                "asset_id": request.asset_id,
                "annotations": [a.model_dump() for a in annotations],
            }
            _task_status[task_id]["updated_at"] = datetime.now(timezone.utc)

        except Exception as e:
            _task_status[task_id]["status"] = "failed"
            _task_status[task_id]["error"] = str(e)
            _task_status[task_id]["updated_at"] = datetime.now(timezone.utc)

    # 加入背景任務
    background_tasks.add_task(process_task)

    return TaskStatusResponse(**_task_status[task_id])


@router.get(
    "/status/{task_id}",
    response_model=TaskStatusResponse,
    summary="查詢任務狀態",
    description="查詢非同步 AI 檢查任務的狀態",
)
async def get_task_status(
    task_id: str,
    _: str = Depends(verify_api_key),
):
    """查詢非同步任務狀態"""
    if task_id not in _task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到指定的任務",
        )

    return TaskStatusResponse(**_task_status[task_id])
