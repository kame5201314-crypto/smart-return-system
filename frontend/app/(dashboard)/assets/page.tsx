"use client";

import { useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ImageIcon,
  Video,
  MoreHorizontal,
  Eye,
  Trash2,
  Send,
  RefreshCw,
  Upload,
  FolderSync,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import type { TaskItem, QCReview } from "@/types/database";

// 工作狀態標籤 (對應 outsourcing_qc.task_items.work_status)
const WORK_STATUS_LABELS: Record<TaskItem["work_status"], string> = {
  pending: "待處理",
  processing: "處理中",
  completed: "已完成",
  revision: "需修正",
};

const WORK_STATUS_COLORS: Record<TaskItem["work_status"], string> = {
  pending: "bg-gray-100 text-gray-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  revision: "bg-yellow-100 text-yellow-800",
};

// 模擬資料 (對應 outsourcing_qc.task_items 結構)
const mockTaskItems: (TaskItem & {
  vendor_name?: string;
  qc_result?: QCReview["qc_result"] | null;
  qc_score?: number | null;
})[] = [
  {
    id: "1",
    org_id: "admin",
    batch_id: "batch-001",
    item_name: "產品主圖_A001.jpg",
    original_image_url: "/images/original/a001.jpg",
    processed_image_url: "/images/processed/a001.jpg",
    work_status: "completed",
    worker_id: "worker-1",
    worker_notes: null,
    completed_at: "2024-01-15T10:30:00Z",
    created_at: "2024-01-15T08:00:00Z",
    vendor_name: "創意設計工作室",
    qc_result: "revision_needed",
    qc_score: 72,
  },
  {
    id: "2",
    org_id: "admin",
    batch_id: "batch-001",
    item_name: "促銷Banner_春節.png",
    original_image_url: "/images/original/banner.png",
    processed_image_url: "/images/processed/banner.png",
    work_status: "completed",
    worker_id: "worker-2",
    worker_notes: null,
    completed_at: "2024-01-14T15:20:00Z",
    created_at: "2024-01-14T10:00:00Z",
    vendor_name: "視覺魔法師",
    qc_result: "pass",
    qc_score: 95,
  },
  {
    id: "3",
    org_id: "admin",
    batch_id: "batch-002",
    item_name: "產品介紹影片.mp4",
    original_image_url: "/videos/original/intro.mp4",
    processed_image_url: null,
    work_status: "processing",
    worker_id: "worker-3",
    worker_notes: null,
    completed_at: null,
    created_at: "2024-01-14T09:00:00Z",
    vendor_name: "影視製作團隊",
    qc_result: null,
    qc_score: null,
  },
  {
    id: "4",
    org_id: "admin",
    batch_id: "batch-001",
    item_name: "商品細節圖_B002.jpg",
    original_image_url: "/images/original/b002.jpg",
    processed_image_url: null,
    work_status: "pending",
    worker_id: null,
    worker_notes: null,
    completed_at: null,
    created_at: "2024-01-13T14:45:00Z",
    vendor_name: "創意設計工作室",
    qc_result: null,
    qc_score: null,
  },
  {
    id: "5",
    org_id: "admin",
    batch_id: "batch-003",
    item_name: "活動海報_雙11.png",
    original_image_url: "/images/original/1111.png",
    processed_image_url: "/images/processed/1111.png",
    work_status: "revision",
    worker_id: "worker-4",
    worker_notes: "需重新調整色彩",
    completed_at: null,
    created_at: "2024-01-12T11:30:00Z",
    vendor_name: "平面設計達人",
    qc_result: "fail",
    qc_score: 45,
  },
];

const statusIcons: Record<TaskItem["work_status"], React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  revision: <AlertCircle className="h-4 w-4" />,
};

export default function AssetsPage() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const stats = {
    total: mockTaskItems.length,
    pending: mockTaskItems.filter((a) => a.work_status === "pending").length,
    processing: mockTaskItems.filter((a) => a.work_status === "processing").length,
    completed: mockTaskItems.filter((a) => a.work_status === "completed").length,
    revision: mockTaskItems.filter((a) => a.work_status === "revision").length,
  };

  const toggleSelectAll = () => {
    if (selectedAssets.length === mockTaskItems.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(mockTaskItems.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedAssets.includes(id)) {
      setSelectedAssets(selectedAssets.filter((a) => a !== id));
    } else {
      setSelectedAssets([...selectedAssets, id]);
    }
  };

  // 判斷檔案類型
  const getFileType = (fileName: string): "image" | "video" => {
    const videoExts = [".mp4", ".mov", ".avi", ".webm"];
    return videoExts.some((ext) => fileName.toLowerCase().endsWith(ext))
      ? "video"
      : "image";
  };

  // QC 結果顏色
  const getQCResultBadge = (result: QCReview["qc_result"] | null | undefined, score: number | null | undefined) => {
    if (!result) return null;
    const config: Record<QCReview["qc_result"], { label: string; color: string }> = {
      pass: { label: "通過", color: "bg-green-100 text-green-800" },
      fail: { label: "不通過", color: "bg-red-100 text-red-800" },
      revision_needed: { label: "需修正", color: "bg-yellow-100 text-yellow-800" },
    };
    return (
      <div className="flex gap-2">
        <Badge className={config[result].color}>{config[result].label}</Badge>
        {score !== null && score !== undefined && (
          <span className="text-sm text-muted-foreground">{score}分</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Header
        title="素材管理"
        description="管理所有外包上傳的圖片與影片素材"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">全部項目</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待處理</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">需修正</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.revision}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 操作區 */}
        <div className="flex items-center justify-between">
          <Tabs defaultValue="all" className="w-auto">
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="pending">待處理</TabsTrigger>
              <TabsTrigger value="processing">處理中</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
              <TabsTrigger value="revision">需修正</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <FolderSync className="mr-2 h-4 w-4" />
              同步雲端
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              上傳素材
            </Button>
            {selectedAssets.length > 0 && (
              <Button size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                批次 AI 檢查 ({selectedAssets.length})
              </Button>
            )}
          </div>
        </div>

        {/* 素材列表 */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedAssets.length === mockTaskItems.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>項目名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>工作狀態</TableHead>
                <TableHead>外包商</TableHead>
                <TableHead>QC 結果</TableHead>
                <TableHead>建立時間</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTaskItems.map((item) => {
                const fileType = getFileType(item.item_name);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAssets.includes(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {fileType === "image" ? (
                          <ImageIcon className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Video className="h-4 w-4 text-purple-500" />
                        )}
                        {item.item_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {fileType === "image" ? "圖片" : "影片"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={WORK_STATUS_COLORS[item.work_status]}
                      >
                        <span className="mr-1">{statusIcons[item.work_status]}</span>
                        {WORK_STATUS_LABELS[item.work_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.vendor_name || "-"}</TableCell>
                    <TableCell>
                      {getQCResultBadge(item.qc_result, item.qc_score) || (
                        <span className="text-muted-foreground">待審核</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            檢視詳情
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            重新 QC 審核
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="mr-2 h-4 w-4" />
                            生成修正指示
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            刪除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
