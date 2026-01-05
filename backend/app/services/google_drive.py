"""
Google Drive API 服務
處理雲端資料夾同步
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import get_settings
from app.models.schemas import AssetType, CloudFileInfo

logger = logging.getLogger(__name__)
settings = get_settings()

# 支援的檔案類型
SUPPORTED_MIME_TYPES = {
    # 圖片
    "image/jpeg": AssetType.IMAGE,
    "image/png": AssetType.IMAGE,
    "image/webp": AssetType.IMAGE,
    "image/gif": AssetType.IMAGE,
    # 影片
    "video/mp4": AssetType.VIDEO,
    "video/webm": AssetType.VIDEO,
    "video/quicktime": AssetType.VIDEO,
}


class GoogleDriveService:
    """Google Drive 服務"""

    def __init__(self, access_token: str, refresh_token: Optional[str] = None):
        """
        初始化服務

        Args:
            access_token: OAuth 存取權杖
            refresh_token: OAuth 更新權杖
        """
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        self.service = build("drive", "v3", credentials=self.credentials)

    async def list_files_in_folder(
        self,
        folder_id: str,
        page_size: int = 100,
        page_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        列出資料夾中的檔案

        Args:
            folder_id: 資料夾 ID
            page_size: 每頁數量
            page_token: 分頁 Token

        Returns:
            檔案列表和下一頁 Token
        """
        try:
            # 構建查詢條件：在指定資料夾中且為支援的檔案類型
            mime_conditions = " or ".join(
                [f"mimeType='{mime}'" for mime in SUPPORTED_MIME_TYPES.keys()]
            )
            query = f"'{folder_id}' in parents and ({mime_conditions}) and trashed=false"

            response = (
                self.service.files()
                .list(
                    q=query,
                    pageSize=page_size,
                    pageToken=page_token,
                    fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webContentLink, thumbnailLink)",
                    orderBy="modifiedTime desc",
                )
                .execute()
            )

            files = []
            for file in response.get("files", []):
                mime_type = file.get("mimeType", "")
                if mime_type in SUPPORTED_MIME_TYPES:
                    # 取得直接下載連結
                    file_url = self._get_download_url(file["id"])

                    files.append(
                        CloudFileInfo(
                            file_id=file["id"],
                            file_name=file["name"],
                            file_type=SUPPORTED_MIME_TYPES[mime_type],
                            file_url=file_url,
                            file_size_bytes=int(file.get("size", 0)),
                            mime_type=mime_type,
                            created_time=datetime.fromisoformat(
                                file["createdTime"].replace("Z", "+00:00")
                            ),
                            modified_time=datetime.fromisoformat(
                                file["modifiedTime"].replace("Z", "+00:00")
                            ),
                        )
                    )

            return {
                "files": files,
                "next_page_token": response.get("nextPageToken"),
            }

        except HttpError as e:
            logger.error(f"Google Drive API 錯誤: {str(e)}")
            raise

    async def get_all_files_in_folder(self, folder_id: str) -> List[CloudFileInfo]:
        """
        取得資料夾中的所有檔案（處理分頁）

        Args:
            folder_id: 資料夾 ID

        Returns:
            所有檔案列表
        """
        all_files = []
        page_token = None

        while True:
            result = await self.list_files_in_folder(
                folder_id=folder_id,
                page_token=page_token,
            )
            all_files.extend(result["files"])

            page_token = result.get("next_page_token")
            if not page_token:
                break

        return all_files

    def _get_download_url(self, file_id: str) -> str:
        """取得檔案的直接下載 URL"""
        return f"https://drive.google.com/uc?export=download&id={file_id}"

    async def get_file_content(self, file_id: str) -> bytes:
        """
        下載檔案內容

        Args:
            file_id: 檔案 ID

        Returns:
            檔案內容（bytes）
        """
        try:
            request = self.service.files().get_media(fileId=file_id)
            content = request.execute()
            return content
        except HttpError as e:
            logger.error(f"下載檔案失敗: {str(e)}")
            raise

    async def get_folder_info(self, folder_id: str) -> Dict[str, Any]:
        """
        取得資料夾資訊

        Args:
            folder_id: 資料夾 ID

        Returns:
            資料夾資訊
        """
        try:
            response = (
                self.service.files()
                .get(fileId=folder_id, fields="id, name, createdTime, modifiedTime")
                .execute()
            )
            return response
        except HttpError as e:
            logger.error(f"取得資料夾資訊失敗: {str(e)}")
            raise


def create_google_drive_service(
    access_token: str, refresh_token: Optional[str] = None
) -> GoogleDriveService:
    """建立 Google Drive 服務實例"""
    return GoogleDriveService(access_token, refresh_token)
