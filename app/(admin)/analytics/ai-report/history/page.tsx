'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Brain,
  Loader2,
  History,
  ArrowLeft,
  Eye,
  GitCompare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  Package,
  X,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HistoricalReport {
  id: string;
  report_period: string;
  created_at: string;
  total_returns: number;
  total_refund_amount: number;
  store_credit_rate: number;
  trend_analysis: {
    summary?: string;
  };
  pain_points: {
    issue: string;
    frequency: string;
    impact: string;
    affected_products: string[];
  }[];
  recommendations: {
    title: string;
    description: string;
    priority: string;
    category: string;
  }[];
  sku_analysis: {
    sku_group?: string;
    sku?: string;
    product_name: string;
    return_count: number;
    return_rate?: string;
    main_issues: string[];
    suggestion: string;
    variants?: {
      product_name: string;
      sku: string;
      return_count: number;
      main_issues: string[];
      suggestion: string;
    }[];
  }[];
  channel_analysis: {
    channel: string;
    return_count: number;
    common_issues: string[];
  }[];
}

function getSkuGroupLabel(item: HistoricalReport['sku_analysis'][number]): string {
  return item.sku_group || item.sku || '-';
}

function getRankingLabel(index: number): string {
  const numerals = [
    '一', '二', '三', '四', '五',
    '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五',
    '十六', '十七', '十八', '十九', '二十',
  ];

  return numerals[index] || String(index + 1);
}

export default function AIReportHistoryPage() {
  const [reports, setReports] = useState<HistoricalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<HistoricalReport | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  // Load all historical reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/ai/analyze');
      const data = await response.json();

      if (data.success && data.data) {
        setReports(data.data);
      }
    } catch (error) {
      console.error('Load reports error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Open detail dialog
  function viewReportDetail(report: HistoricalReport) {
    setSelectedReport(report);
    setDetailDialogOpen(true);
  }

  // Toggle compare selection
  function toggleCompareSelection(reportId: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(reportId)) {
        return prev.filter((id) => id !== reportId);
      }
      if (prev.length >= 2) {
        return [prev[1], reportId]; // Keep last selected and add new
      }
      return [...prev, reportId];
    });
  }

  // Get reports for comparison
  function getCompareReports() {
    return reports.filter((r) => selectedForCompare.includes(r.id));
  }

  // Calculate trend between two values
  function getTrend(current: number, previous: number) {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  }

  // Format period display
  function formatPeriod(period: string) {
    const [year, month] = period.split('-');
    return `${year}年${month}月`;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/analytics/ai-report">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6" />
              歷史分析報告
            </h1>
            <p className="text-muted-foreground">
              查看所有月份的 AI 分析報告，點擊查看詳細內容或比較不同月份
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {compareMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setCompareMode(false);
                  setSelectedForCompare([]);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                取消比較
              </Button>
              <Button
                disabled={selectedForCompare.length !== 2}
                onClick={() => setCompareDialogOpen(true)}
              >
                <GitCompare className="w-4 h-4 mr-2" />
                比較 ({selectedForCompare.length}/2)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setCompareMode(true)}>
              <GitCompare className="w-4 h-4 mr-2" />
              比較月份
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">載入歷史報告中...</p>
          </CardContent>
        </Card>
      )}

      {/* Reports list */}
      {!loading && reports.length > 0 && (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className={`transition-all ${
                compareMode && selectedForCompare.includes(report.id)
                  ? 'ring-2 ring-primary'
                  : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {compareMode && (
                      <Checkbox
                        checked={selectedForCompare.includes(report.id)}
                        onCheckedChange={() => toggleCompareSelection(report.id)}
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          {formatPeriod(report.report_period)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        建立時間：{format(new Date(report.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats summary */}
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-xl font-bold">{report.total_returns}</p>
                        <p className="text-xs text-muted-foreground">退貨單數</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-green-600">
                          NT$ {report.total_refund_amount?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">退款金額</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-blue-600">
                          {report.store_credit_rate?.toFixed(1) || 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">購物金轉換</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!compareMode && (
                      <Button onClick={() => viewReportDetail(report)}>
                        <Eye className="w-4 h-4 mr-2" />
                        查看詳情
                      </Button>
                    )}
                  </div>
                </div>

                {/* Summary preview */}
                {report.trend_analysis?.summary && (
                  <p className="mt-4 text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg line-clamp-2">
                    {report.trend_analysis.summary}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">尚無歷史報告</h3>
            <p className="text-muted-foreground mb-4">
              請先前往 AI 分析頁面產生報告
            </p>
            <Button asChild>
              <Link href="/analytics/ai-report">
                <Brain className="w-4 h-4 mr-2" />
                前往 AI 分析
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              {selectedReport && formatPeriod(selectedReport.report_period)} 分析報告
            </DialogTitle>
            <DialogDescription>
              建立時間：{selectedReport && format(new Date(selectedReport.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedReport && (
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h3 className="font-medium mb-2">分析摘要</h3>
                  <p className="text-sm bg-primary/5 p-4 rounded-lg">
                    {selectedReport.trend_analysis?.summary || '無摘要'}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{selectedReport.total_returns}</p>
                    <p className="text-sm text-muted-foreground">總退貨單數</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      NT$ {selectedReport.total_refund_amount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">總退款金額</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedReport.store_credit_rate?.toFixed(1) || 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">購物金轉換率</p>
                  </div>
                </div>

                <Separator />

                {/* Pain Points */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    核心痛點診斷
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.pain_points?.map((point, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{point.issue}</span>
                          <div className="flex gap-2">
                            <Badge
                              variant={point.impact === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              影響: {point.impact === 'high' ? '高' : point.impact === 'medium' ? '中' : '低'}
                            </Badge>
                          </div>
                        </div>
                        {point.affected_products?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            受影響：{point.affected_products.slice(0, 3).join('、')}
                            {point.affected_products.length > 3 && ` 等 ${point.affected_products.length} 項`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Recommendations */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    優化建議
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.recommendations?.map((rec, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{rec.title}</span>
                          <Badge
                            variant={rec.priority === 'high' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {rec.priority === 'high' ? '高優先' : rec.priority === 'medium' ? '中優先' : '低優先'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Top SKUs */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    退貨率最高商品 (Top 10)
                  </h3>
                  <div className="space-y-2">
                    {selectedReport.sku_analysis?.slice(0, 10).map((sku, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm">
                            退貨第{getRankingLabel(index)}名：{getSkuGroupLabel(sku)}
                          </span>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {sku.return_count} 件
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5" />
              月份比較
            </DialogTitle>
            <DialogDescription>
              比較兩個月份的退貨分析數據
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedForCompare.length === 2 && (
              <div className="space-y-6">
                {(() => {
                  const compareReports = getCompareReports();
                  const [report1, report2] = compareReports.sort((a, b) =>
                    a.report_period.localeCompare(b.report_period)
                  );

                  if (!report1 || !report2) return null;

                  return (
                    <>
                      {/* Header */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="font-medium text-lg">
                          {formatPeriod(report1.report_period)}
                        </div>
                        <div className="text-muted-foreground">vs</div>
                        <div className="font-medium text-lg">
                          {formatPeriod(report2.report_period)}
                        </div>
                      </div>

                      <Separator />

                      {/* Stats comparison */}
                      <div className="space-y-4">
                        <h3 className="font-medium">統計數據比較</h3>

                        {/* Total returns */}
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-2xl font-bold">{report1.total_returns}</p>
                            <p className="text-xs text-muted-foreground">退貨單數</p>
                          </div>
                          <div className="text-center">
                            {getTrend(report2.total_returns, report1.total_returns) === 'up' && (
                              <div className="flex items-center justify-center text-red-500">
                                <TrendingUp className="w-5 h-5 mr-1" />
                                +{report2.total_returns - report1.total_returns}
                              </div>
                            )}
                            {getTrend(report2.total_returns, report1.total_returns) === 'down' && (
                              <div className="flex items-center justify-center text-green-500">
                                <TrendingDown className="w-5 h-5 mr-1" />
                                {report2.total_returns - report1.total_returns}
                              </div>
                            )}
                            {getTrend(report2.total_returns, report1.total_returns) === 'same' && (
                              <div className="flex items-center justify-center text-gray-500">
                                <Minus className="w-5 h-5 mr-1" />
                                持平
                              </div>
                            )}
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-2xl font-bold">{report2.total_returns}</p>
                            <p className="text-xs text-muted-foreground">退貨單數</p>
                          </div>
                        </div>

                        {/* Total refund */}
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-green-600">
                              NT$ {report1.total_refund_amount?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">退款金額</p>
                          </div>
                          <div className="text-center">
                            {(() => {
                              const diff = (report2.total_refund_amount || 0) - (report1.total_refund_amount || 0);
                              if (diff > 0) return (
                                <div className="flex items-center justify-center text-red-500">
                                  <TrendingUp className="w-5 h-5 mr-1" />
                                  +NT$ {diff.toLocaleString()}
                                </div>
                              );
                              if (diff < 0) return (
                                <div className="flex items-center justify-center text-green-500">
                                  <TrendingDown className="w-5 h-5 mr-1" />
                                  NT$ {diff.toLocaleString()}
                                </div>
                              );
                              return (
                                <div className="flex items-center justify-center text-gray-500">
                                  <Minus className="w-5 h-5 mr-1" />
                                  持平
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-green-600">
                              NT$ {report2.total_refund_amount?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">退款金額</p>
                          </div>
                        </div>

                        {/* Store credit rate */}
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-blue-600">
                              {report1.store_credit_rate?.toFixed(1) || 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">購物金轉換</p>
                          </div>
                          <div className="text-center">
                            {(() => {
                              const diff = (report2.store_credit_rate || 0) - (report1.store_credit_rate || 0);
                              if (diff > 0) return (
                                <div className="flex items-center justify-center text-green-500">
                                  <TrendingUp className="w-5 h-5 mr-1" />
                                  +{diff.toFixed(1)}%
                                </div>
                              );
                              if (diff < 0) return (
                                <div className="flex items-center justify-center text-red-500">
                                  <TrendingDown className="w-5 h-5 mr-1" />
                                  {diff.toFixed(1)}%
                                </div>
                              );
                              return (
                                <div className="flex items-center justify-center text-gray-500">
                                  <Minus className="w-5 h-5 mr-1" />
                                  持平
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-xl font-bold text-blue-600">
                              {report2.store_credit_rate?.toFixed(1) || 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">購物金轉換</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Top products comparison */}
                      <div>
                        <h3 className="font-medium mb-3">退貨商品 Top 5 比較</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">{formatPeriod(report1.report_period)}</p>
                            <div className="space-y-2">
                              {report1.sku_analysis?.slice(0, 5).map((sku, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="truncate">
                                      第{getRankingLabel(index)}名：{getSkuGroupLabel(sku)}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0 ml-2">
                                    {sku.return_count}件
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">{formatPeriod(report2.report_period)}</p>
                            <div className="space-y-2">
                              {report2.sku_analysis?.slice(0, 5).map((sku, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="truncate">
                                      第{getRankingLabel(index)}名：{getSkuGroupLabel(sku)}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0 ml-2">
                                    {sku.return_count}件
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
