"""
雲端同步 API 路由
處理 Google Drive / Dropbox 資料夾同步
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_api_key
from app.models.schemas import CloudSyncRequest, CloudSyncResponse
from app.services.google_drive import create_google_drive_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cloud-sync", tags=["雲端同步"])


@router.post(
    "/google-drive",
    response_model=CloudSyncResponse,
    summary="同步 Google Drive 資料夾",
    description="掃描指定的 Google Drive 資料夾，取得所有圖片與影片檔案",
)
async def sync_google_drive(
    request: CloudSyncRequest,
    access_token: str,
    refresh_token: Optional[str] = None,
    _: str = Depends(verify_api_key),
):
    """
    同步 Google Drive 資料夾

    - 連接指定的 Google Drive 資料夾
    - 掃描所有圖片 (JPG/PNG/WebP/GIF) 和影片 (MP4/WebM)
    - 回傳檔案清單供後續處理
    """
    try:
        # 建立 Google Drive 服務
        drive_service = create_google_drive_service(access_token, refresh_token)

        # 取得所有檔案
        files = await drive_service.get_all_files_in_folder(request.folder_id)

        return CloudSyncResponse(
            connection_id=request.connection_id,
            total_files=len(files),
            new_files=len(files),  # 實際應比對已存在的檔案
            files=files,
            sync_completed_at=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"Google Drive 同步失敗: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="雲端同步過程發生錯誤",
        ) from e


@router.get(
    "/google-drive/folder/{folder_id}",
    summary="取得資料夾資訊",
    description="取得指定 Google Drive 資料夾的詳細資訊",
)
async def get_folder_info(
    folder_id: str,
    access_token: str,
    _: str = Depends(verify_api_key),
):
    """取得 Google Drive 資料夾資訊"""
    try:
        drive_service = create_google_drive_service(access_token)
        folder_info = await drive_service.get_folder_info(folder_id)
        return folder_info

    except Exception as e:
        logger.error(f"取得資料夾資訊失敗: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="無法取得資料夾資訊",
        ) from e
