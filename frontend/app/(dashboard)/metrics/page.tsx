"use client";

import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ImageIcon,
  AlertCircle,
  Users,
  Clock,
  Target,
  DollarSign,
  ShoppingCart,
  Shield,
} from "lucide-react";
import type { DailyKPI, Vendor, PlatformRevenue } from "@/types/database";

// 模擬今日 KPI 資料 (對應 ops_metrics.daily_kpi)
const mockDailyKPI: Partial<DailyKPI> = {
  report_date: new Date().toISOString().split("T")[0],
  total_revenue: 125680,
  total_orders: 48,
  average_order_value: 2618,
  infringement_scanned: 1247,
  infringement_detected: 52,
  infringement_confirmed: 38,
  infringement_resolved: 25,
  outsourcing_tasks_total: 156,
  outsourcing_tasks_completed: 142,
  outsourcing_qc_pass_rate: 91.2,
};

// 模擬外包商績效資料 (對應 outsourcing_qc.vendors)
const mockVendors: (Partial<Vendor> & { recent_assets: number; error_rate: number })[] = [
  {
    vendor_name: "創意設計工作室",
    recent_assets: 156,
    error_rate: 2.5,
    rating: 4.8,
    average_quality_score: 94,
  },
  {
    vendor_name: "視覺魔法師",
    recent_assets: 134,
    error_rate: 3.2,
    rating: 4.5,
    average_quality_score: 89,
  },
  {
    vendor_name: "影視製作團隊",
    recent_assets: 89,
    error_rate: 4.1,
    rating: 4.2,
    average_quality_score: 85,
  },
  {
    vendor_name: "平面設計達人",
    recent_assets: 78,
    error_rate: 5.8,
    rating: 3.8,
    average_quality_score: 78,
  },
];

// 每日檢查量趨勢 (模擬過去 7 天)
const weeklyTrend = [65, 78, 92, 85, 120, 145, 168];

export default function MetricsPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="營運儀表板"
        description="查看 QC 效率、外包商績效與營運指標"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* 時間篩選 */}
        <div className="flex justify-end">
          <Select defaultValue="7d">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="選擇時間範圍" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">今天</SelectItem>
              <SelectItem value="7d">過去 7 天</SelectItem>
              <SelectItem value="30d">過去 30 天</SelectItem>
              <SelectItem value="90d">過去 90 天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI 卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日營收</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                NT$ {mockDailyKPI.total_revenue?.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="mr-1 inline h-3 w-3 text-green-500" />
                較上週 +12%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">侵權偵測</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockDailyKPI.infringement_detected}</div>
              <p className="text-xs text-muted-foreground">
                已掃描 {mockDailyKPI.infringement_scanned?.toLocaleString()} 個商品
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">外包完成率</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockDailyKPI.outsourcing_tasks_completed} / {mockDailyKPI.outsourcing_tasks_total}
              </div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="mr-1 inline h-3 w-3 text-green-500" />
                {((mockDailyKPI.outsourcing_tasks_completed || 0) / (mockDailyKPI.outsourcing_tasks_total || 1) * 100).toFixed(1)}% 完成
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QC 通過率</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockDailyKPI.outsourcing_qc_pass_rate}%</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="mr-1 inline h-3 w-3 text-green-500" />
                較上週 +1.2%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 圖表區域 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 每日檢查量趨勢 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">外包任務完成趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-[200px] items-end gap-2">
                {weeklyTrend.map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${(value / Math.max(...weeklyTrend)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>週一</span>
                <span>週二</span>
                <span>週三</span>
                <span>週四</span>
                <span>週五</span>
                <span>週六</span>
                <span>週日</span>
              </div>
            </CardContent>
          </Card>

          {/* 錯誤類型分布 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">錯誤類型分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>錯別字</span>
                  <span>42%</span>
                </div>
                <Progress value={42} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>規格錯誤</span>
                  <span>28%</span>
                </div>
                <Progress value={28} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>價格錯誤</span>
                  <span>15%</span>
                </div>
                <Progress value={15} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>品牌違規</span>
                  <span>10%</span>
                </div>
                <Progress value={10} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>禁用詞彙</span>
                  <span>5%</span>
                </div>
                <Progress value={5} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 外包商績效 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              外包商績效排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockVendors.map((vendor, index) => (
                <div
                  key={vendor.vendor_name}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{vendor.vendor_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {vendor.recent_assets} 個素材
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">錯誤率</p>
                      <p
                        className={`font-medium ${
                          vendor.error_rate <= 3
                            ? "text-green-600"
                            : vendor.error_rate <= 5
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {vendor.error_rate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">品質分數</p>
                      <p className="font-medium">{vendor.average_quality_score}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">評分</p>
                      <p className="font-medium">{vendor.rating}</p>
                    </div>
                    <Badge
                      variant={
                        (vendor.rating || 0) >= 4.5
                          ? "default"
                          : (vendor.rating || 0) >= 4
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {(vendor.rating || 0) >= 4.5
                        ? "優秀"
                        : (vendor.rating || 0) >= 4
                        ? "良好"
                        : "待改進"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
