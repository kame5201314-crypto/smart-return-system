'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Package,
  TrendingUp,
  Calendar,
  RefreshCw,
  History,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface AIAnalysisResult {
  id?: string;
  period: string;
  summary: string;
  painPoints: {
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
  skuAnalysis: {
    sku: string;
    product_name: string;
    return_count: number;
    main_issues: string[];
    suggestion: string;
  }[];
  channelAnalysis: {
    channel: string;
    return_count: number;
    common_issues: string[];
  }[];
  statistics: {
    totalReturns: number;
    totalRefundAmount: number;
    storeCreditRate: number;
  };
}

export default function AIReportPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(
    format(new Date(), 'yyyy-MM')
  );
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [hasExistingReport, setHasExistingReport] = useState(false);

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'yyyy年MM月'),
    };
  });

  // Load existing report for the selected period
  const loadExistingReport = useCallback(async (period: string) => {
    try {
      setLoadingExisting(true);
      const response = await fetch(`/api/v1/ai/analyze?period=${period}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        // Get the most recent report for this period
        const report = data.data[0];
        setResult({
          id: report.id,
          period: report.report_period,
          summary: report.trend_analysis?.summary || '',
          painPoints: report.pain_points || [],
          recommendations: report.recommendations || [],
          skuAnalysis: report.sku_analysis || [],
          channelAnalysis: report.channel_analysis || [],
          statistics: {
            totalReturns: report.total_returns || 0,
            totalRefundAmount: report.total_refund_amount || 0,
            storeCreditRate: report.store_credit_rate || 0,
          },
        });
        setHasExistingReport(true);
      } else {
        setResult(null);
        setHasExistingReport(false);
      }
    } catch (error) {
      console.error('Load existing report error:', error);
      setResult(null);
      setHasExistingReport(false);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  // Load existing report on mount and when period changes
  useEffect(() => {
    loadExistingReport(selectedPeriod);
  }, [selectedPeriod, loadExistingReport]);

  async function handleAnalyze() {
    try {
      setLoading(true);
      setResult(null);

      const response = await fetch('/api/v1/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        setHasExistingReport(true);
        toast.success('分析完成，報告已儲存');
      } else {
        toast.error(data.error || '分析失敗');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('分析請求失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            AI 分析報告
          </h1>
          <p className="text-muted-foreground">
            運用 AI 分析退貨數據，產生可執行的商業洞察
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="選擇月份" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAnalyze} disabled={loading || loadingExisting}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : hasExistingReport ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新分析
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  AI 分析本月退貨報告
                </>
              )}
            </Button>

            {hasExistingReport && !loading && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <History className="w-3 h-3 mr-1" />
                已有歷史報告
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">
              AI 正在分析 {selectedPeriod} 的退貨數據...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              這可能需要 10-30 秒，請稍候
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Summary & Stats */}
          <Card>
            <CardHeader>
              <CardTitle>分析摘要</CardTitle>
              <CardDescription>{result.period} 月份退貨分析報告</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm bg-primary/5 p-4 rounded-lg">
                {result.summary}
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{result.statistics.totalReturns}</p>
                  <p className="text-sm text-muted-foreground">總退貨單數</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    NT$ {result.statistics.totalRefundAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">總退款金額</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {result.statistics.storeCreditRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">購物金轉換率</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pain Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                核心痛點診斷
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.painPoints?.map((point, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{point.issue}</h4>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            point.impact === 'high'
                              ? 'destructive'
                              : point.impact === 'medium'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          影響: {point.impact === 'high' ? '高' : point.impact === 'medium' ? '中' : '低'}
                        </Badge>
                        <Badge variant="outline">
                          頻率: {point.frequency === 'high' ? '高' : point.frequency === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                    </div>
                    {point.affected_products?.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        受影響產品：{point.affected_products.join('、')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                優化建議
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.recommendations?.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{rec.title}</h4>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            rec.priority === 'high'
                              ? 'destructive'
                              : rec.priority === 'medium'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {rec.priority === 'high' ? '高優先' : rec.priority === 'medium' ? '中優先' : '低優先'}
                        </Badge>
                        <Badge variant="outline">{rec.category}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SKU Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                SKU 分析
              </CardTitle>
              <CardDescription>
                退貨率最高的商品及改善建議
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.skuAnalysis?.map((sku, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{sku.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {sku.sku}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {sku.return_count} 件退貨
                      </Badge>
                    </div>
                    {sku.main_issues?.length > 0 && (
                      <p className="text-sm mb-2">
                        主要問題：{sku.main_issues.join('、')}
                      </p>
                    )}
                    {sku.suggestion && (
                      <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                        建議：{sku.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Channel Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                通路分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {result.channelAnalysis?.map((channel, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{channel.channel}</Badge>
                      <span className="font-bold">{channel.return_count}</span>
                    </div>
                    {channel.common_issues?.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        常見問題：{channel.common_issues.join('、')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading existing report */}
      {loadingExisting && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">
              載入歷史報告中...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!result && !loading && !loadingExisting && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">選擇月份並開始分析</h3>
            <p className="text-muted-foreground">
              AI 將分析該月份的退貨數據，產生痛點診斷與優化建議
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
