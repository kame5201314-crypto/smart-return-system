"use client";

import { useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  X,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Send,
} from "lucide-react";
import {
  ANNOTATION_TYPE_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
} from "@/config/constants";

// 模擬標註資料
const mockAnnotations = [
  {
    id: "1",
    annotation_type: "typo",
    severity: "error",
    detected_text: "優惠價 $1,9999",
    expected_text: "優惠價 $1,999",
    correction_suggestion: "請修正價格，去除多餘的 9",
    position: { x: 150, y: 200, width: 120, height: 30 },
    ai_confidence: 95,
    is_confirmed: false,
  },
  {
    id: "2",
    annotation_type: "spec_error",
    severity: "error",
    detected_text: "尺寸：15吋",
    expected_text: "尺寸：14吋",
    correction_suggestion: "產品規格庫顯示此產品為 14 吋，請確認並修正",
    position: { x: 300, y: 350, width: 80, height: 25 },
    ai_confidence: 88,
    is_confirmed: false,
  },
  {
    id: "3",
    annotation_type: "suggestion",
    severity: "info",
    detected_text: null,
    expected_text: null,
    correction_suggestion: null,
    creative_suggestion: "建議將標題文字放大 10%，以增加視覺衝擊力。可考慮加入光影效果突顯產品質感。",
    position: { x: 100, y: 50, width: 300, height: 60 },
    ai_confidence: 75,
    is_confirmed: false,
  },
  {
    id: "4",
    annotation_type: "forbidden_word",
    severity: "warning",
    detected_text: "全台最低價",
    expected_text: null,
    correction_suggestion: "「最低價」為禁用詞彙，建議改為「超值優惠」或「限時特價」",
    position: { x: 200, y: 150, width: 100, height: 25 },
    ai_confidence: 92,
    is_confirmed: false,
  },
];

const annotationTypeIcons: Record<string, React.ReactNode> = {
  typo: <AlertCircle className="h-4 w-4" />,
  spec_error: <AlertTriangle className="h-4 w-4" />,
  price_error: <AlertTriangle className="h-4 w-4" />,
  brand_violation: <AlertCircle className="h-4 w-4" />,
  forbidden_word: <AlertTriangle className="h-4 w-4" />,
  suggestion: <Lightbulb className="h-4 w-4" />,
};

export default function ReviewPage() {
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(
    "1"
  );
  const [annotations, setAnnotations] = useState(mockAnnotations);
  const [zoom, setZoom] = useState(100);
  const [reviewerNote, setReviewerNote] = useState("");

  const handleConfirm = (id: string) => {
    setAnnotations(
      annotations.map((a) =>
        a.id === id ? { ...a, is_confirmed: true } : a
      )
    );
  };

  const handleDismiss = (id: string) => {
    setAnnotations(annotations.filter((a) => a.id !== id));
  };

  const confirmedCount = annotations.filter((a) => a.is_confirmed).length;
  const errorCount = annotations.filter((a) => a.severity === "error").length;
  const warningCount = annotations.filter((a) => a.severity === "warning").length;

  return (
    <div className="flex h-screen flex-col">
      <Header
        title="雙屏審核界面"
        description="AI 自動檢測結果審核與標註"
      />

      {/* 工具列 */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            上一個
          </Button>
          <span className="text-sm text-muted-foreground">
            1 / 15 需審核
          </span>
          <Button variant="outline" size="sm">
            下一個
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(Math.max(50, zoom - 10))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-sm">{zoom}%</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(Math.min(200, zoom + 10))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="destructive">{errorCount} 錯誤</Badge>
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            {warningCount} 警告
          </Badge>
          <Badge variant="secondary">{confirmedCount} 已確認</Badge>
        </div>
      </div>

      {/* 雙屏內容 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側：圖片預覽 */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div
            className="relative mx-auto bg-white shadow-lg"
            style={{
              width: `${(800 * zoom) / 100}px`,
              height: `${(600 * zoom) / 100}px`,
            }}
          >
            {/* 模擬圖片 */}
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
              <span className="text-gray-400">產品圖片預覽區</span>
            </div>

            {/* 標註框 */}
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className={`absolute cursor-pointer border-2 transition-all ${
                  selectedAnnotation === annotation.id
                    ? "border-primary bg-primary/10"
                    : annotation.severity === "error"
                    ? "border-red-500 bg-red-500/10"
                    : annotation.severity === "warning"
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-blue-500 bg-blue-500/10"
                } ${annotation.is_confirmed ? "opacity-50" : ""}`}
                style={{
                  left: `${(annotation.position.x * zoom) / 100}px`,
                  top: `${(annotation.position.y * zoom) / 100}px`,
                  width: `${(annotation.position.width * zoom) / 100}px`,
                  height: `${(annotation.position.height * zoom) / 100}px`,
                }}
                onClick={() => setSelectedAnnotation(annotation.id)}
              />
            ))}
          </div>
        </div>

        {/* 右側：AI 檢查報告 */}
        <div className="w-96 border-l bg-white">
          <div className="border-b p-4">
            <h2 className="font-semibold">AI 檢查報告</h2>
            <p className="text-sm text-muted-foreground">
              檔案：產品主圖_A001.jpg
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-3 p-4">
              {annotations.map((annotation) => (
                <Card
                  key={annotation.id}
                  className={`cursor-pointer transition-all ${
                    selectedAnnotation === annotation.id
                      ? "ring-2 ring-primary"
                      : ""
                  } ${annotation.is_confirmed ? "opacity-60" : ""}`}
                  onClick={() => setSelectedAnnotation(annotation.id)}
                >
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`rounded-full p-1 ${
                            SEVERITY_COLORS[annotation.severity]
                          }`}
                        >
                          {annotationTypeIcons[annotation.annotation_type]}
                        </div>
                        <CardTitle className="text-sm">
                          {ANNOTATION_TYPE_LABELS[annotation.annotation_type]}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className={SEVERITY_COLORS[annotation.severity]}
                      >
                        {SEVERITY_LABELS[annotation.severity]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {annotation.detected_text && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">偵測內容</p>
                        <p className="text-sm font-medium text-red-600 line-through">
                          {annotation.detected_text}
                        </p>
                      </div>
                    )}
                    {annotation.expected_text && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">正確內容</p>
                        <p className="text-sm font-medium text-green-600">
                          {annotation.expected_text}
                        </p>
                      </div>
                    )}
                    {annotation.correction_suggestion && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">修正建議</p>
                        <p className="text-sm">{annotation.correction_suggestion}</p>
                      </div>
                    )}
                    {annotation.creative_suggestion && (
                      <div className="mb-2 rounded-lg bg-blue-50 p-2">
                        <p className="text-xs font-medium text-blue-700">
                          AI 創意建議
                        </p>
                        <p className="text-sm text-blue-600">
                          {annotation.creative_suggestion}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        信心度：{annotation.ai_confidence}%
                      </span>
                      {!annotation.is_confirmed && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-green-600 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirm(annotation.id);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(annotation.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {annotation.is_confirmed && (
                        <Badge variant="secondary" className="text-xs">
                          已確認
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* 審核操作區 */}
          <div className="border-t p-4">
            <div className="mb-3">
              <Label htmlFor="note" className="text-sm">
                審核備註
              </Label>
              <Input
                id="note"
                placeholder="輸入給外包的備註..."
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                退回修改
              </Button>
              <Button className="flex-1">
                <Send className="mr-2 h-4 w-4" />
                生成反饋單
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
