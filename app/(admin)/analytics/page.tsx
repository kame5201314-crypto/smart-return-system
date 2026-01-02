'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Brain,
  Download,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { RETURN_STATUS_LABELS, CHANNEL_LIST, RETURN_REASONS } from '@/config/constants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface AnalyticsData {
  totalReturns: number;
  totalRefundAmount: number;
  avgRefundAmount: number;
  byStatus: { name: string; value: number }[];
  byChannel: { name: string; value: number }[];
  byReason: { name: string; value: number }[];
  monthlyTrend: { month: string; returns: number; amount: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const result = await getReturnRequests();

      if (result.success && result.data) {
        const returns = result.data as {
          status: string;
          channel_source: string | null;
          reason_category: string | null;
          refund_amount: number | null;
          created_at: string;
        }[];

        // Calculate statistics
        const totalReturns = returns.length;
        const totalRefundAmount = returns.reduce(
          (sum, r) => sum + (r.refund_amount || 0),
          0
        );
        const avgRefundAmount =
          totalReturns > 0 ? totalRefundAmount / totalReturns : 0;

        // By status
        const statusCounts: Record<string, number> = {};
        returns.forEach((r) => {
          const label = RETURN_STATUS_LABELS[r.status] || r.status;
          statusCounts[label] = (statusCounts[label] || 0) + 1;
        });
        const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
          name,
          value,
        }));

        // By channel
        const channelCounts: Record<string, number> = {};
        returns.forEach((r) => {
          const channel = CHANNEL_LIST.find(
            (c) => c.key === r.channel_source
          )?.label || r.channel_source || '未知';
          channelCounts[channel] = (channelCounts[channel] || 0) + 1;
        });
        const byChannel = Object.entries(channelCounts).map(([name, value]) => ({
          name,
          value,
        }));

        // By reason
        const reasonCounts: Record<string, number> = {};
        returns.forEach((r) => {
          const reason =
            Object.values(RETURN_REASONS).find(
              (re) => re.key === r.reason_category
            )?.label || r.reason_category || '其他';
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });
        const byReason = Object.entries(reasonCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);

        // Monthly trend (last 6 months)
        const monthlyData: Record<string, { returns: number; amount: number }> = {};
        returns.forEach((r) => {
          const month = r.created_at.substring(0, 7); // YYYY-MM
          if (!monthlyData[month]) {
            monthlyData[month] = { returns: 0, amount: 0 };
          }
          monthlyData[month].returns += 1;
          monthlyData[month].amount += r.refund_amount || 0;
        });
        const monthlyTrend = Object.entries(monthlyData)
          .map(([month, data]) => ({
            month,
            returns: data.returns,
            amount: data.amount,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-6);

        setData({
          totalReturns,
          totalRefundAmount,
          avgRefundAmount,
          byStatus,
          byChannel,
          byReason,
          monthlyTrend,
        });
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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
            <BarChart3 className="w-6 h-6" />
            數據中心
          </h1>
          <p className="text-muted-foreground">退貨數據分析與視覺化報表</p>
        </div>
        <Link href="/analytics/ai-report">
          <Button>
            <Brain className="w-4 h-4 mr-2" />
            AI 智能分析
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">總退貨單數</p>
                {loading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{data?.totalReturns || 0}</p>
                )}
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">總退款金額</p>
                {loading ? (
                  <Skeleton className="h-8 w-32 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">
                    NT$ {(data?.totalRefundAmount || 0).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均退款金額</p>
                {loading ? (
                  <Skeleton className="h-8 w-28 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">
                    NT$ {Math.round(data?.avgRefundAmount || 0).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>月度趨勢</CardTitle>
            <CardDescription>退貨數量與金額變化趨勢</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.monthlyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="returns"
                    stroke="#3b82f6"
                    name="退貨數量"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    name="退款金額"
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
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data?.byChannel || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {data?.byChannel?.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
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
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.byReason || []} layout="vertical">
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

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>狀態分佈</CardTitle>
          <CardDescription>各處理階段的退貨單數量</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.byStatus || []}>
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
