'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Package,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/saas/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { getShopeeReturns, type ShopeeReturn } from '@/lib/actions/shopee-returns.actions';
import {
  RETURN_STATUS,
  RETURN_STATUS_LABELS,
  CHANNEL_LIST,
  RETURN_REASONS,
  RETURN_ITEM_RESOLUTION_TYPES,
} from '@/config/constants';
import { aggregateReturnRanking } from '@/lib/utils/return-ranking';
import { getShopeeReturnReportPeriod } from '@/lib/utils/return-period';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PRODUCT_RANKING_COMPACT_LIMIT = 10;
const PRODUCT_RANKING_PAGE_SIZE = 30;
const PRODUCT_RANKING_MAX = 60;

function getReturnChannelLabel(channelSource: string | null): string {
  if (channelSource === 'other') return '其他';
  return CHANNEL_LIST.find(c => c.key === channelSource)?.label || channelSource || '未知';
}

function getShopeePlatformChannelKey(platform: ShopeeReturn['platform']): string {
  if (platform === 'mall') return 'shopee_mall';
  if (platform === 'other') return 'other';
  return 'shopee';
}

function getShopeePlatformLabel(platform: ShopeeReturn['platform']): string {
  if (platform === 'mall') return '商城';
  if (platform === 'other') return '其他';
  return '蝦皮';
}

interface ReturnItem {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  resolution_type?: string | null;
}

interface ReturnData {
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  created_at: string;
  return_items?: ReturnItem[];
}

// ShopeeReturn type is now imported from server actions

export default function AnalyticsPage() {
  const [allReturns, setAllReturns] = useState<ReturnData[]>([]);
  const [shopeeReturns, setShopeeReturns] = useState<ShopeeReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [isProductRankingExpanded, setIsProductRankingExpanded] = useState(false);
  const [productRankingPage, setProductRankingPage] = useState(1);

  // Generate year options (last 3 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2].map(y => y.toString());
  }, []);

  // Month options
  const monthOptions = [
    { value: '01', label: '1月' },
    { value: '02', label: '2月' },
    { value: '03', label: '3月' },
    { value: '04', label: '4月' },
    { value: '05', label: '5月' },
    { value: '06', label: '6月' },
    { value: '07', label: '7月' },
    { value: '08', label: '8月' },
    { value: '09', label: '9月' },
    { value: '10', label: '10月' },
    { value: '11', label: '11月' },
    { value: '12', label: '12月' },
  ];

  useEffect(() => {
    fetchData();
    loadShopeeReturns();
  }, []);

  // Reset ranking pagination when filters change
  useEffect(() => {
    setProductRankingPage(1);
  }, [selectedYear, selectedMonth, selectedChannel]);

  async function fetchData() {
    try {
      const result = await getReturnRequests();
      if (result.success && result.data) {
        setAllReturns(result.data as ReturnData[]);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadShopeeReturns() {
    try {
      const result = await getShopeeReturns();
      if (result.success && result.data) {
        setShopeeReturns(result.data);
      }
    } catch (error) {
      console.error('Failed to load shopee returns:', error);
    }
  }

  // Filter data based on selections
  const filteredReturns = useMemo(() => {
    return allReturns.filter(r => {
      const date = new Date(r.created_at);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');

      if (selectedYear !== 'all' && year !== selectedYear) return false;
      if (selectedMonth !== 'all' && month !== selectedMonth) return false;
      if (selectedChannel !== 'all' && r.channel_source !== selectedChannel) return false;

      return true;
    });
  }, [allReturns, selectedYear, selectedMonth, selectedChannel]);

  // Filter shopee returns based on selections
  const filteredShopeeReturns = useMemo(() => {
    return shopeeReturns.filter(r => {
      // Channel filter: shopee matches platform='shopee', shopee_mall matches platform='mall', other matches platform='other'
      if (selectedChannel !== 'all') {
        if (getShopeePlatformChannelKey(r.platform) !== selectedChannel) return false;
      }

      const reportPeriod = getShopeeReturnReportPeriod(r);
      if (!reportPeriod) return selectedYear === 'all' && selectedMonth === 'all';
      const [year, month] = reportPeriod.split('-');

      if (selectedYear !== 'all' && year !== selectedYear) return false;
      if (selectedMonth !== 'all' && month !== selectedMonth) return false;

      return true;
    });
  }, [shopeeReturns, selectedYear, selectedMonth, selectedChannel]);

  // Calculate statistics
  const stats = useMemo(() => {
    // Include both database returns and shopee returns in total count
    const totalReturns = filteredReturns.length + filteredShopeeReturns.length;

    // Count by specific channels
    const officialCount = filteredReturns.filter(r => r.channel_source === 'official').length;
    const shopeeFromReturns = filteredReturns.filter(r => r.channel_source === 'shopee').length;
    const shopeeFromShopeeReturns = filteredShopeeReturns.filter(r => r.platform === 'shopee' || !r.platform).length;
    const shopeeCount = shopeeFromReturns + shopeeFromShopeeReturns;
    const mallFromReturns = filteredReturns.filter(r => r.channel_source === 'shopee_mall').length;
    const mallFromShopeeReturns = filteredShopeeReturns.filter(r => r.platform === 'mall').length;
    const shopeeMallCount = mallFromReturns + mallFromShopeeReturns;
    const otherFromReturns = filteredReturns.filter(r => r.channel_source === 'other').length;
    const otherFromShopeeReturns = filteredShopeeReturns.filter(r => r.platform === 'other').length;
    const otherCount = otherFromReturns + otherFromShopeeReturns;

    // By channel - include shopee returns
    const channelCounts: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const channel = getReturnChannelLabel(r.channel_source);
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });
    // Add shopee returns count by platform
    filteredShopeeReturns.forEach(r => {
      const channelLabel = getShopeePlatformLabel(r.platform);
      channelCounts[channelLabel] = (channelCounts[channelLabel] || 0) + 1;
    });
    const byChannel = Object.entries(channelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // By reason
    const reasonCounts: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const reason = Object.values(RETURN_REASONS).find(re => re.key === r.reason_category)?.label || r.reason_category || '其他';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const byReason = Object.entries(reasonCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // By status
    const statusCounts: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const label = RETURN_STATUS_LABELS[r.status] || r.status;
      statusCounts[label] = (statusCounts[label] || 0) + 1;
    });
    const byStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // By handling mode (全額退款 / 部分退款 / 換貨 / 來回件)
    const resolutionCounts: Record<string, number> = {};
    filteredReturns.forEach((r) => {
      r.return_items?.forEach((item) => {
        const resolutionLabel =
          Object.values(RETURN_ITEM_RESOLUTION_TYPES).find((type) => type.key === item.resolution_type)?.label
          || RETURN_ITEM_RESOLUTION_TYPES.FULL.label;
        resolutionCounts[resolutionLabel] = (resolutionCounts[resolutionLabel] || 0) + 1;
      });
    });
    const byResolution = Object.entries(resolutionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly trend - include shopee returns
    const monthlyData: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const month = r.created_at.substring(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    // Add shopee returns to monthly trend
    filteredShopeeReturns.forEach(r => {
      const month = getShopeeReturnReportPeriod(r);
      if (!month) return;
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, returns]) => ({ month, returns }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    // Product ranking - aggregate by classified sku group + channel
    const productRankingInputs: Array<{ name: string; sku: string | null; channel: string; quantity: number }> = [];
    filteredReturns.forEach(r => {
      // Ranking only counts closed or abnormal cases
      if (r.status !== RETURN_STATUS.COMPLETED && r.status !== RETURN_STATUS.ABNORMAL_DISPUTED) return;

      const channelLabel = getReturnChannelLabel(r.channel_source);
      r.return_items?.forEach(item => {
        const sku = item.product_sku?.trim() || null;
        // No SKU => don't enter ranking (prevents "-" items from polluting the leaderboard)
        if (!sku) return;

        productRankingInputs.push({
          name: item.product_name,
          sku,
          channel: channelLabel,
          quantity: item.quantity,
        });
      });
    });
    // Add shopee returns to product ranking
    filteredShopeeReturns.forEach(r => {
      if (!r.product_name) return;
      const sku = r.option_sku?.trim() || null;
      // No SKU => don't enter ranking
      if (!sku) return;

      const channelLabel = getShopeePlatformLabel(r.platform);
      productRankingInputs.push({
        name: r.product_name,
        sku,
        channel: channelLabel,
        quantity: r.return_quantity,
      });
    });
    const productRanking = aggregateReturnRanking(productRankingInputs);

    return {
      totalReturns,
      officialCount,
      shopeeCount,
      shopeeMallCount,
      otherCount,
      byChannel,
      byReason,
      byStatus,
      byResolution,
      monthlyTrend,
      productRanking,
    };
  }, [filteredReturns, filteredShopeeReturns]);

  const productRankingLimited = stats.productRanking.slice(0, PRODUCT_RANKING_MAX);
  const productRankingTotalPages = Math.max(
    1,
    Math.ceil(productRankingLimited.length / PRODUCT_RANKING_PAGE_SIZE)
  );
  const productRankingClampedPage = Math.min(
    Math.max(productRankingPage, 1),
    productRankingTotalPages
  );
  const productRankingPageStart = (productRankingClampedPage - 1) * PRODUCT_RANKING_PAGE_SIZE;
  const productRankingVisible = isProductRankingExpanded
    ? productRankingLimited.slice(
      productRankingPageStart,
      productRankingPageStart + PRODUCT_RANKING_PAGE_SIZE
    )
    : stats.productRanking.slice(0, PRODUCT_RANKING_COMPACT_LIMIT);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        icon={<BarChart3 className="size-6" />}
        title="數據中心"
        description="退貨數據分析與視覺化報表。"
        actions={
          <Link href="/analytics/ai-report">
            <Button>
              <Brain className="w-4 h-4 mr-2" />
              AI 智能分析
            </Button>
          </Link>
        }
      />

      {!loading && allReturns.length === 0 && shopeeReturns.length === 0 && (
        <section className="border border-emerald-200 bg-emerald-50 p-5 sm:p-6" aria-labelledby="first-import-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <Upload className="size-5" aria-hidden="true" />
                <h2 id="first-import-title" className="font-semibold">匯入第一批退貨資料</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-700">
                建議先從蝦皮匯出檔開始；其他通路可先手動建立退貨，資料進來後報表與 AI 分析才會顯示內容。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/shopee-returns">前往蝦皮退貨</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/returns">手動建立退貨</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 sm:mr-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">篩選條件：</span>
            </div>

            {/* Year filter */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="選擇年度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部年度</SelectItem>
                {yearOptions.map(year => (
                  <SelectItem key={year} value={year}>{year}年</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Month filter */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="選擇月份" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部月份</SelectItem>
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Channel filter */}
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="選擇通路" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部通路</SelectItem>
                {CHANNEL_LIST.map(channel => (
                  <SelectItem key={channel.key} value={channel.key}>{channel.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset button */}
            {(selectedYear !== 'all' || selectedMonth !== 'all' || selectedChannel !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedMonth('all');
                  setSelectedChannel('all');
                }}
              >
                重置篩選
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {selectedYear !== 'all' || selectedMonth !== 'all' || selectedChannel !== 'all'
                  ? '篩選後退貨單數'
                  : '總退貨單數'}
              </p>
              {loading ? (
                <Skeleton className="h-10 w-24 mt-1" />
              ) : (
                <p className="text-3xl font-bold">{stats.totalReturns}</p>
              )}
              {/* Channel breakdown */}
              {!loading && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-muted-foreground">官網</span>
                    <span className="font-medium">{stats.officialCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-muted-foreground">蝦皮</span>
                    <span className="font-medium">{stats.shopeeCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-muted-foreground">蝦皮商城</span>
                    <span className="font-medium">{stats.shopeeMallCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <span className="text-muted-foreground">其他</span>
                    <span className="font-medium">{stats.otherCount}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="self-start rounded-full bg-blue-50 p-4 text-blue-600 sm:self-auto">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            退貨商品排名
          </CardTitle>
          <CardDescription>
            {selectedYear !== 'all' || selectedMonth !== 'all'
              ? '篩選期間內退貨數量最多的商品'
              : '全部期間退貨數量最多的商品'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : stats.productRanking.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-muted-foreground">
              無數據
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium w-12 whitespace-nowrap">排名</th>
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">商品名稱</th>
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">商品貨號</th>
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">退貨平台</th>
                      <th className="text-center py-3 px-4 font-medium whitespace-nowrap">退貨數量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRankingVisible.map((product, index) => {
                      const rank = isProductRankingExpanded ? productRankingPageStart + index + 1 : index + 1;
                      return (
                      <tr key={`${product.name}-${product.sku}-${product.channel}`} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-600">
                            {rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{product.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{product.sku || '-'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{product.channel}</td>
                        <td className="text-center py-3 px-4 font-medium">{product.quantity}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stats.productRanking.length > PRODUCT_RANKING_COMPACT_LIMIT && (
                <div className="flex flex-col items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsProductRankingExpanded(!isProductRankingExpanded);
                      setProductRankingPage(1);
                    }}
                    className="text-muted-foreground"
                  >
                    {isProductRankingExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        查看更多（前 30 名）
                      </>
                    )}
                  </Button>

                  {isProductRankingExpanded && productRankingTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      {Array.from({ length: productRankingTotalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={productRankingClampedPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setProductRankingPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>月度趨勢</CardTitle>
            <CardDescription>退貨數量變化趨勢</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : stats.monthlyTrend.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                無數據
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="returns"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="退貨數量"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By channel */}
        <Card>
          <CardHeader>
            <CardTitle>通路分佈</CardTitle>
            <CardDescription>各通路退貨數量佔比</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : stats.byChannel.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                無數據
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.byChannel}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {stats.byChannel.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By reason */}
        <Card>
          <CardHeader>
            <CardTitle>退貨原因分析</CardTitle>
            <CardDescription>各原因類別數量排名</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : stats.byReason.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                無數據
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byReason} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" name="數量" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>各通路詳細統計</CardTitle>
          <CardDescription>各通路的退貨數量與退貨原因分佈</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : stats.byChannel.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-muted-foreground">
              無數據
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">通路</th>
                    <th className="text-right py-3 px-4 font-medium">退貨數量</th>
                    <th className="text-right py-3 px-4 font-medium">佔比</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byChannel.map((channel, index) => (
                    <tr key={channel.name} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {channel.name}
                      </td>
                      <td className="text-right py-3 px-4 font-medium">{channel.value}</td>
                      <td className="text-right py-3 px-4 text-muted-foreground">
                        {stats.totalReturns > 0
                          ? ((channel.value / stats.totalReturns) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution distribution */}
      <Card>
        <CardHeader>
          <CardTitle>處理方式分布</CardTitle>
          <CardDescription>全額退款、部分退款、換貨、來回件的件數</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : stats.byResolution.length === 0 ? (
            <div className="h-[80px] flex items-center justify-center text-muted-foreground">
              無數據
            </div>
          ) : (
            <div className="space-y-2">
              {stats.byResolution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between py-1 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>狀態分佈</CardTitle>
          <CardDescription>各處理階段的退貨單數量</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : stats.byStatus.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-muted-foreground">
              無數據
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" name="數量" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
