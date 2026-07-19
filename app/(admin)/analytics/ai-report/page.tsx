'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
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
  FileText,
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
import { ConfirmDialog } from '@/components/saas/confirm-dialog';
import { useWorkspaceAccess } from '@/components/saas/workspace-access-provider';
import type { SelfServiceTrialAIQuotaSnapshot } from '@/lib/saas/self-service-trial-ai-quota';
import { WORKSPACE_RESTRICTED_ACTION_TITLE } from '@/lib/saas/workspace-action-access';
import { normalizeAISkuAnalysisOutput } from '@/lib/utils/ai-sku-analysis';

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
  diagnostics?: {
    model?: string | null;
  };
}

function buildStaticDemoReport(period: string): AIAnalysisResult {
  return {
    period,
    summary:
      '示範資料顯示，退貨主要集中在尺寸認知落差與商品頁資訊不足。優先補強尺寸說明與出貨前檢查，可降低重複退貨並縮短客服處理時間。',
    painPoints: [
      {
        issue: '尺寸與商品頁說明不一致',
        frequency: 'high',
        impact: 'high',
        affected_products: ['示範商品 A', '示範商品 B'],
      },
      {
        issue: '包裝保護不足造成外觀瑕疵',
        frequency: 'medium',
        impact: 'medium',
        affected_products: ['示範商品 C'],
      },
    ],
    recommendations: [
      {
        title: '補強尺寸與適用情境說明',
        description: '在商品頁加入實測尺寸、適用範例與常見誤解，並同步客服回覆範本。',
        priority: 'high',
        category: '商品頁優化',
      },
      {
        title: '建立高退貨商品出貨檢查表',
        description: '針對高退貨 SKU 增加包裝與配件確認，降低可避免的退貨。',
        priority: 'medium',
        category: '倉儲流程',
      },
    ],
    skuAnalysis: [
      {
        sku_group: 'DEMO-A',
        product_name: '示範商品 A',
        return_count: 8,
        return_rate: '12.5%',
        main_issues: ['尺寸不合', '資訊理解落差'],
        suggestion: '補上尺寸對照與使用情境圖片，並在下單前提示確認。',
      },
      {
        sku_group: 'DEMO-C',
        product_name: '示範商品 C',
        return_count: 4,
        return_rate: '6.3%',
        main_issues: ['包裝受損'],
        suggestion: '增加緩衝包材並納入出貨抽查。',
      },
    ],
    channelAnalysis: [
      {
        channel: '蝦皮（示範）',
        return_count: 9,
        common_issues: ['尺寸不合', '商品資訊落差'],
      },
      {
        channel: '官網（示範）',
        return_count: 3,
        common_issues: ['包裝受損'],
      },
    ],
    statistics: {
      totalReturns: 12,
      totalRefundAmount: 8640,
      storeCreditRate: 25,
    },
    diagnostics: { model: 'static-demo' },
  };
}

function getSkuGroupLabel(item: AIAnalysisResult['skuAnalysis'][number]): string {
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

export default function AIReportPage() {
  const { canUseAI } = useWorkspaceAccess();
  const [selectedPeriod, setSelectedPeriod] = useState(
    format(new Date(), 'yyyy-MM')
  );
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [trialQuota, setTrialQuota] = useState<SelfServiceTrialAIQuotaSnapshot | null>(null);
  const [trialConfirmOpen, setTrialConfirmOpen] = useState(false);
  const [showingDemo, setShowingDemo] = useState(false);

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
      const response = await fetch(`/api/v1/ai/analyze?period=${period}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        // Get the most recent report for this period
        const report = data.data[0];

        if (report.is_stale) {
          setResult(null);
          setHasExistingReport(false);
          toast.warning(
            `${period} 既有 AI 報告與目前退貨資料不一致，請重新產生分析。`
          );
          return;
        }

        setResult({
          id: report.id,
          period: report.report_period,
          summary: report.trend_analysis?.summary || '',
          painPoints: report.pain_points || [],
          recommendations: report.recommendations || [],
          skuAnalysis: normalizeAISkuAnalysisOutput(report.sku_analysis || []),
          channelAnalysis: report.channel_analysis || [],
          statistics: {
            totalReturns: report.total_returns || 0,
            totalRefundAmount: report.total_refund_amount || 0,
            storeCreditRate: report.store_credit_rate || 0,
          },
        });
        setHasExistingReport(true);
        setShowingDemo(false);
      } else {
        setResult(null);
        setHasExistingReport(false);
        setShowingDemo(false);
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

  const loadTrialQuota = useCallback(async () => {
    try {
      const response = await fetch('/api/saas/trial/ai-quota', { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data.quota) {
        setTrialQuota(data.quota as SelfServiceTrialAIQuotaSnapshot);
      }
    } catch (error) {
      console.warn('Load trial AI quota error:', error);
    }
  }, []);

  useEffect(() => {
    void loadTrialQuota();
  }, [loadTrialQuota]);

  async function handleAnalyze() {
    if (!canUseAI) {
      toast.info(WORKSPACE_RESTRICTED_ACTION_TITLE);
      return;
    }
    try {
      setLoading(true);

      const response = await fetch('/api/v1/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod }),
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        if (data?.quota?.applies) {
          setTrialQuota(data.quota as SelfServiceTrialAIQuotaSnapshot);
        }
        toast.error(data?.error || 'AI \u5206\u6790\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002');
        return;
      }

      if (!data.data) {
        toast.error('AI \u5206\u6790\u5B8C\u6210\u4F46\u56DE\u50B3\u5167\u5BB9\u70BA\u7A7A\uFF0C\u8ACB\u91CD\u65B0\u6574\u7406\u5F8C\u518D\u8A66\u3002');
        return;
      }

      const nextResult = {
        ...data.data,
        skuAnalysis: normalizeAISkuAnalysisOutput(data.data?.skuAnalysis || []),
      };

      setResult(nextResult);
      setShowingDemo(false);

      const usedLocalFallback = data.data?.diagnostics?.model === 'local-text-fallback';
      if (trialQuota?.applies && data.reused !== true && !usedLocalFallback) {
        setTrialQuota({
          ...trialQuota,
          used: 1,
          remaining: 0,
          reason: 'limit_reached',
          completedAt: new Date().toISOString(),
        });
      }
      if (data.saved !== false) {
        setHasExistingReport(true);
        if (usedLocalFallback) {
          toast.warning('AI \u670D\u52D9\u66AB\u6642\u7121\u6CD5\u4F7F\u7528\uFF0C\u5DF2\u5148\u7522\u751F\u672C\u5730\u6587\u5B57\u7D71\u8A08\u5831\u544A\u3002');
        } else {
          toast.success('AI \u5206\u6790\u5B8C\u6210\uFF0C\u5DF2\u5132\u5B58\u5831\u544A\u3002');
        }
        void loadExistingReport(selectedPeriod);
      } else {
        toast.warning(data.warning || 'AI \u5206\u6790\u5B8C\u6210\uFF0C\u4F46\u5831\u544A\u672A\u80FD\u5132\u5B58\u3002');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('AI \u5206\u6790\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002');
    } finally {
      setLoading(false);
    }
  }

  function handleAnalyzeClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!canUseAI) {
      toast.info(WORKSPACE_RESTRICTED_ACTION_TITLE);
      return;
    }
    if (trialQuota?.applies) {
      if (trialQuota.reason === 'in_progress') {
        toast.info('AI 分析正在處理中，請稍候再重新整理。');
        return;
      }
      if (trialQuota.remaining <= 0 || trialQuota.reason === 'trial_inactive') {
        toast.info('本次試用的真實 AI 分析額度已使用完畢。');
        return;
      }
      setTrialConfirmOpen(true);
      return;
    }
    void handleAnalyze();
  }

  function showStaticDemo() {
    setResult(buildStaticDemoReport(selectedPeriod));
    setHasExistingReport(false);
    setShowingDemo(true);
    toast.info('目前顯示固定示範資料，不會使用 AI 額度。');
  }

  const trialAnalysisBlocked = Boolean(
    trialQuota?.applies
    && (trialQuota.remaining <= 0
      || trialQuota.reason === 'in_progress'
      || trialQuota.reason === 'trial_inactive')
  );

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
        <Button variant="outline" asChild>
          <Link href="/analytics/ai-report/history">
            <FileText className="w-4 h-4 mr-2" />
            歷史報告
          </Link>
        </Button>
      </div>

      {trialQuota?.applies && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">試用 AI 體驗</h2>
                <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700">
                  已使用 {trialQuota.used} / {trialQuota.limit}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                試用期間包含 1 次真實 AI 分析。你可以先查看固定示範報告，不會扣除額度。
              </p>
              {trialQuota.reason === 'in_progress' && (
                <p className="text-sm font-medium text-amber-700">分析正在處理中，請勿重複送出。</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={showStaticDemo}>
                <FileText className="mr-2 size-4" />
                查看示範報告
              </Button>
              {trialQuota.remaining <= 0 && (
                <Button asChild>
                  <Link href="/settings/billing#plans">升級方案</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
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

            <Button
              type="button"
              onClick={handleAnalyzeClick}
              disabled={loading || loadingExisting || trialAnalysisBlocked || !canUseAI}
              title={!canUseAI ? WORKSPACE_RESTRICTED_ACTION_TITLE : undefined}
            >
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

            {!canUseAI && (
              <p className="text-sm text-amber-800" role="status">
                工作區目前為唯讀，AI 分析已停用。請前往
                <Link
                  className="mx-1 font-medium underline underline-offset-2"
                  href="/settings/billing#plans"
                >
                  帳務與訂閱
                </Link>
                選擇升級方案。
              </p>
            )}

            {showingDemo && !loading && (
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                示範資料，不會扣額度
              </Badge>
            )}

            {hasExistingReport && !loading && !showingDemo && (
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

          {/* SKU Analysis - Top 20 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                退貨率最高商品分析 (Top 20)
              </CardTitle>
              <CardDescription>
                退貨次數最高的前 20 名商品及改善建議
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.skuAnalysis?.slice(0, 20).map((sku, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-sm font-bold shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold">
                              退貨第{getRankingLabel(index)}名：{getSkuGroupLabel(sku)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              型號群組：{getSkuGroupLabel(sku)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              代表商品：{sku.product_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="destructive">
                            {sku.return_count} 件退貨
                          </Badge>
                          {sku.return_rate && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              退貨率 {sku.return_rate}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {sku.variants?.length ? (
                        <div className="space-y-3">
                          {sku.variants.map((variant, variantIndex) => (
                            <div key={`${variant.sku}-${variantIndex}`} className="rounded-md border bg-white p-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{variant.product_name}</p>
                                  <p className="text-sm text-muted-foreground">型號：{variant.sku}</p>
                                </div>
                                <Badge variant="outline">{variant.return_count} 件</Badge>
                              </div>

                              {variant.main_issues?.length > 0 && (
                                <p className="text-sm">
                                  <span className="font-medium">主要問題：</span>
                                  <span className="text-muted-foreground">{variant.main_issues.join('、')}</span>
                                </p>
                              )}

                              {variant.suggestion && (
                                <p className="text-sm text-blue-600">
                                  <span className="font-medium">建議：</span>
                                  <span>{variant.suggestion}</span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
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

      <ConfirmDialog
        open={trialConfirmOpen && canUseAI}
        onOpenChange={setTrialConfirmOpen}
        title="使用本次試用唯一的 AI 分析額度？"
        description="送出後會使用你的退貨資料產生真實報告。只有成功完成的真實 AI 分析才會扣除這次額度；失敗或固定示範報告都不扣額度。"
        confirmLabel="開始真實分析"
        cancelLabel="先不使用"
        pending={loading}
        onConfirm={() => {
          setTrialConfirmOpen(false);
          void handleAnalyze();
        }}
      />
    </div>
  );
}
