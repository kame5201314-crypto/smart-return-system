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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  FileWarning,
  Send,
} from "lucide-react";
import type { Match, ScrapedItem } from "@/types/database";

// 模擬侵權比對資料 (對應 infringement_system.matches + scraped_items)
type MockMatch = Match & {
  scraped_item?: Partial<ScrapedItem>;
};

const mockMatches: MockMatch[] = [
  {
    id: "1",
    org_id: "admin",
    job_id: "job-001",
    product_id: "prod-001",
    scraped_item_id: "si-001",
    similarity_score: 92,
    risk_level: "critical",
    status: "pending",
    auto_filtered: false,
    evidence_screenshot_url: null,
    evidence_captured_at: null,
    legal_action_status: "none",
    created_at: "2024-01-15T10:30:00Z",
    scraped_item: {
      platform: "shopee",
      title: "仿冒無線滑鼠 A1 超值優惠",
      seller_name: "xx3c旗艦店",
      url: "https://shopee.tw/product/123",
    },
  },
  {
    id: "2",
    org_id: "admin",
    job_id: "job-001",
    product_id: "prod-002",
    scraped_item_id: "si-002",
    similarity_score: 88,
    risk_level: "high",
    status: "confirmed",
    auto_filtered: false,
    evidence_screenshot_url: "/evidence/002.png",
    evidence_captured_at: "2024-01-14T16:00:00Z",
    legal_action_status: "warning_sent",
    created_at: "2024-01-14T15:20:00Z",
    scraped_item: {
      platform: "momo",
      title: "機械鍵盤 K1 PRO 同款",
      seller_name: "數位3C專賣",
      url: "https://momo.com/product/456",
    },
  },
  {
    id: "3",
    org_id: "admin",
    job_id: "job-002",
    product_id: "prod-001",
    scraped_item_id: "si-003",
    similarity_score: 95,
    risk_level: "critical",
    status: "confirmed",
    auto_filtered: false,
    evidence_screenshot_url: "/evidence/003.png",
    evidence_captured_at: "2024-01-13T10:00:00Z",
    legal_action_status: "reported",
    created_at: "2024-01-13T09:00:00Z",
    scraped_item: {
      platform: "pchome",
      title: "仿品無線滑鼠特價",
      seller_name: "快速出貨商城",
      url: "https://pchome.com/product/789",
    },
  },
];

const platformLabels: Record<string, string> = {
  shopee: "蝦皮購物",
  momo: "momo購物",
  pchome: "PChome",
  yahoo: "Yahoo購物",
  ruten: "露天拍賣",
};

// 風險等級配置 (對應 Match.risk_level)
const riskLevelConfig: Record<Match["risk_level"], { label: string; color: string }> = {
  critical: { label: "極高", color: "bg-red-100 text-red-800" },
  high: { label: "高", color: "bg-orange-100 text-orange-800" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-800" },
  low: { label: "低", color: "bg-gray-100 text-gray-800" },
};

// 狀態配置 (對應 Match.status)
const statusConfig: Record<Match["status"], { label: string; color: string }> = {
  pending: { label: "待審核", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "已確認", color: "bg-blue-100 text-blue-800" },
  dismissed: { label: "已忽略", color: "bg-gray-100 text-gray-800" },
};

// 法律行動狀態配置 (對應 Match.legal_action_status)
const legalActionConfig: Record<Match["legal_action_status"], { label: string; color: string }> = {
  none: { label: "無", color: "bg-gray-100 text-gray-800" },
  warning_sent: { label: "已警告", color: "bg-yellow-100 text-yellow-800" },
  reported: { label: "已檢舉", color: "bg-purple-100 text-purple-800" },
  resolved: { label: "已解決", color: "bg-green-100 text-green-800" },
};

export default function InfringementPage() {
  // 統計數據
  const stats = {
    total: mockMatches.length,
    pending: mockMatches.filter((m) => m.status === "pending").length,
    confirmed: mockMatches.filter((m) => m.status === "confirmed").length,
    reported: mockMatches.filter((m) => m.legal_action_status === "reported").length,
    resolved: mockMatches.filter((m) => m.legal_action_status === "resolved").length,
    critical: mockMatches.filter((m) => m.risk_level === "critical").length,
  };

  return (
    <div className="flex flex-col">
      <Header
        title="侵權監控"
        description="監控並處理各平台的仿冒侵權商品"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總比對數</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                極高風險: {stats.critical} 件
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待審核</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已檢舉</CardTitle>
              <FileWarning className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.reported}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已解決</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.resolved}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜尋與篩選 */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜尋商品標題或賣家..." className="pl-9" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="選擇平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              <SelectItem value="shopee">蝦皮購物</SelectItem>
              <SelectItem value="momo">momo購物</SelectItem>
              <SelectItem value="pchome">PChome</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="風險等級" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部風險</SelectItem>
              <SelectItem value="critical">極高風險</SelectItem>
              <SelectItem value="high">高風險</SelectItem>
              <SelectItem value="medium">中風險</SelectItem>
              <SelectItem value="low">低風險</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="審核狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="pending">待審核</SelectItem>
              <SelectItem value="confirmed">已確認</SelectItem>
              <SelectItem value="dismissed">已忽略</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Search className="mr-2 h-4 w-4" />
            開始掃描
          </Button>
        </div>

        {/* 侵權列表 */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>商品標題</TableHead>
                <TableHead>賣家</TableHead>
                <TableHead>相似度</TableHead>
                <TableHead>風險等級</TableHead>
                <TableHead>審核狀態</TableHead>
                <TableHead>法律行動</TableHead>
                <TableHead>偵測時間</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockMatches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {match.scraped_item?.platform
                        ? platformLabels[match.scraped_item.platform] || match.scraped_item.platform
                        : "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {match.scraped_item?.title || "-"}
                  </TableCell>
                  <TableCell>{match.scraped_item?.seller_name || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={match.similarity_score >= 90 ? "destructive" : "secondary"}
                    >
                      {match.similarity_score}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={riskLevelConfig[match.risk_level].color}>
                      {riskLevelConfig[match.risk_level].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[match.status].color}>
                      {statusConfig[match.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={legalActionConfig[match.legal_action_status].color}>
                      {legalActionConfig[match.legal_action_status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(match.created_at).toLocaleDateString("zh-TW")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {match.scraped_item?.url && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={match.scraped_item.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="發送檢舉">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
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
