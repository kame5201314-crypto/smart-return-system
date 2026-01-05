"""
OpenAI GPT-4o Vision 服務
處理圖片 OCR 與智能檢查
"""
import asyncio
import base64
import logging
import time
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.models.schemas import (
    AnnotationResult,
    AnnotationType,
    Severity,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class OpenAIVisionService:
    """OpenAI Vision 服務"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
        self.max_tokens = settings.openai_vision_max_tokens

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def analyze_image(
        self,
        image_url: str,
        rules: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        分析圖片並檢查錯誤

        Args:
            image_url: 圖片 URL
            rules: 檢查規則列表

        Returns:
            分析結果
        """
        start_time = time.time()

        # 構建系統提示
        system_prompt = self._build_system_prompt(rules)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "請分析這張圖片，找出所有文字錯誤、規格錯誤、品牌違規，並提供創意建議。以 JSON 格式回傳結果。",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url},
                            },
                        ],
                    },
                ],
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"},
            )

            result = response.choices[0].message.content
            processing_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "result": result,
                "processing_time_ms": processing_time,
            }

        except Exception as e:
            logger.error(f"OpenAI Vision 分析失敗: {str(e)}")
            raise

    async def analyze_image_from_base64(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg",
        rules: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        從 Base64 編碼分析圖片

        Args:
            image_base64: Base64 編碼的圖片
            mime_type: 圖片 MIME 類型
            rules: 檢查規則列表

        Returns:
            分析結果
        """
        image_url = f"data:{mime_type};base64,{image_base64}"
        return await self.analyze_image(image_url, rules)

    def _build_system_prompt(self, rules: Optional[List[Dict[str, Any]]] = None) -> str:
        """構建系統提示"""
        base_prompt = """你是一個專業的電商圖片品質檢查員。你的任務是分析圖片並找出以下類型的問題：

1. **錯別字 (typo)**: 文字拼寫錯誤、多字少字
2. **規格錯誤 (spec_error)**: 產品規格、型號、尺寸標示錯誤
3. **價格錯誤 (price_error)**: 價格標示錯誤或不一致
4. **品牌違規 (brand_violation)**: Logo 位置不正確、使用過期素材
5. **禁用詞彙 (forbidden_word)**: 使用了不應該出現的詞彙
6. **創意建議 (suggestion)**: 可以改進的設計或文案建議

請以下列 JSON 格式回傳結果：
{
    "annotations": [
        {
            "type": "typo|spec_error|price_error|brand_violation|forbidden_word|suggestion",
            "severity": "error|warning|info",
            "position": {
                "x": 100,
                "y": 200,
                "width": 50,
                "height": 20,
                "description": "位置描述"
            },
            "detected_text": "偵測到的文字",
            "expected_text": "正確的文字（如果適用）",
            "correction_suggestion": "修正建議",
            "creative_suggestion": "創意改進建議（僅 suggestion 類型）",
            "confidence": 85
        }
    ],
    "summary": {
        "total_issues": 3,
        "errors": 1,
        "warnings": 1,
        "suggestions": 1,
        "overall_confidence": 90
    }
}"""

        if rules:
            rules_text = "\n\n**檢查規則：**\n"
            for rule in rules:
                if rule.get("rule_type") == "product_spec":
                    rules_text += f"- 產品 {rule.get('product_name')}: 型號應為 {rule.get('product_model')}, 價格應為 {rule.get('correct_price')}\n"
                elif rule.get("rule_type") == "forbidden_word":
                    words = rule.get("forbidden_words", [])
                    rules_text += f"- 禁用詞彙: {', '.join(words)}\n"
                elif rule.get("rule_type") == "brand_guideline":
                    rules_text += f"- 品牌規範: {rule.get('description')}\n"

            return base_prompt + rules_text

        return base_prompt

    def parse_annotations(
        self, raw_result: str, asset_id: str
    ) -> List[AnnotationResult]:
        """
        解析 AI 回傳的標註結果

        Args:
            raw_result: AI 原始回傳的 JSON 字串
            asset_id: 素材 ID

        Returns:
            標註結果列表
        """
        import json

        try:
            data = json.loads(raw_result)
            annotations = []

            for item in data.get("annotations", []):
                annotation = AnnotationResult(
                    annotation_type=AnnotationType(item["type"]),
                    severity=Severity(item.get("severity", "warning")),
                    position=item.get("position", {}),
                    detected_text=item.get("detected_text"),
                    expected_text=item.get("expected_text"),
                    correction_suggestion=item.get("correction_suggestion"),
                    creative_suggestion=item.get("creative_suggestion"),
                    ai_confidence=item.get("confidence", 0),
                )
                annotations.append(annotation)

            return annotations

        except json.JSONDecodeError as e:
            logger.error(f"解析 AI 回傳結果失敗: {str(e)}")
            return []


# 單例模式
_vision_service: Optional[OpenAIVisionService] = None


def get_vision_service() -> OpenAIVisionService:
    """取得 Vision 服務實例"""
    global _vision_service
    if _vision_service is None:
        _vision_service = OpenAIVisionService()
    return _vision_service
