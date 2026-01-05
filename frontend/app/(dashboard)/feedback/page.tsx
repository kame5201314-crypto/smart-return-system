"use client";

import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Send,
  Copy,
  FileText,
  Clock,
  CheckCircle,
  Mail,
} from "lucide-react";

// 模擬反饋單資料
const mockFeedbacks = [
  {
    id: "1",
    title: "2024/01 第一批素材修正",
    vendor_name: "創意設計工作室",
    asset_count: 5,
    total_errors: 8,
    total_warnings: 3,
    status: "sent",
    sent_at: "2024-01-15T10:30:00Z",
    viewed_at: "2024-01-15T14:20:00Z",
    public_url_slug: "fb-2024-001",
  },
  {
    id: "2",
    title: "促銷 Banner 修正",
    vendor_name: "視覺魔法師",
    asset_count: 3,
    total_errors: 2,
    total_warnings: 1,
    status: "viewed",
    sent_at: "2024-01-14T09:00:00Z",
    viewed_at: "2024-01-14T11:30:00Z",
    public_url_slug: "fb-2024-002",
  },
  {
    id: "3",
    title: "產品主圖重製",
    vendor_name: "平面設計達人",
    asset_count: 10,
    total_errors: 15,
    total_warnings: 5,
    status: "draft",
    sent_at: null,
    viewed_at: null,
    public_url_slug: "fb-2024-003",
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: "草稿",
    color: "bg-gray-100 text-gray-800",
    icon: <FileText className="h-4 w-4" />,
  },
  sent: {
    label: "已發送",
    color: "bg-blue-100 text-blue-800",
    icon: <Send className="h-4 w-4" />,
  },
  viewed: {
    label: "已查看",
    color: "bg-green-100 text-green-800",
    icon: <Eye className="h-4 w-4" />,
  },
  revised: {
    label: "已修改",
    color: "bg-purple-100 text-purple-800",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  closed: {
    label: "已結案",
    color: "bg-gray-100 text-gray-800",
    icon: <CheckCircle className="h-4 w-4" />,
  },
};

export default function FeedbackPage() {
  const stats = {
    total: mockFeedbacks.length,
    draft: mockFeedbacks.filter((f) => f.status === "draft").length,
    sent: mockFeedbacks.filter((f) => f.status === "sent").length,
    viewed: mockFeedbacks.filter((f) => f.status === "viewed").length,
  };

  return (
    <div className="flex flex-col">
      <Header
        title="反饋單管理"
        description="管理發送給外包商的修正反饋單"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">全部反饋單</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">草稿</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已發送</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已查看</CardTitle>
              <Eye className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.viewed}</div>
            </CardContent>
          </Card>
        </div>

        {/* 操作區 */}
        <div className="flex justify-end">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增反饋單
          </Button>
        </div>

        {/* 反饋單列表 */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>外包商</TableHead>
                <TableHead>素材數</TableHead>
                <TableHead>錯誤/警告</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>發送時間</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFeedbacks.map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{feedback.title}</TableCell>
                  <TableCell>{feedback.vendor_name}</TableCell>
                  <TableCell>{feedback.asset_count} 個</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant="destructive">
                        {feedback.total_errors} 錯誤
                      </Badge>
                      <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                        {feedback.total_warnings} 警告
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[feedback.status].color}>
                      <span className="mr-1">{statusConfig[feedback.status].icon}</span>
                      {statusConfig[feedback.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {feedback.sent_at
                      ? new Date(feedback.sent_at).toLocaleDateString("zh-TW")
                      : "-"}
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
                          預覽
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" />
                          複製連結
                        </DropdownMenuItem>
                        {feedback.status === "draft" && (
                          <DropdownMenuItem>
                            <Send className="mr-2 h-4 w-4" />
                            發送
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
