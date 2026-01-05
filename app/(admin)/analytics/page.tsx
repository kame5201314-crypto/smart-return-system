'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Package,
  Brain,
  Calendar,
  Filter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { RETURN_STATUS_LABELS, CHANNEL_LIST, RETURN_REASONS } from '@/config/constants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface ReturnData {
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  created_at: string;
}

export default function AnalyticsPage() {
  const [allReturns, setAllReturns] = useState<ReturnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

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
  }, []);

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

  // Calculate statistics
  const stats = useMemo(() => {
    const totalReturns = filteredReturns.length;

    // By channel
    const channelCounts: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const channel = CHANNEL_LIST.find(c => c.key === r.channel_source)?.label || r.channel_source || '未知';
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
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

    // Monthly trend
    const monthlyData: Record<string, number> = {};
    filteredReturns.forEach(r => {
      const month = r.created_at.substring(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, returns]) => ({ month, returns }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return { totalReturns, byChannel, byReason, byStatus, monthlyTrend };
  }, [filteredReturns]);

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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">篩選條件：</span>
            </div>

            {/* Year filter */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
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
              <SelectTrigger className="w-[120px]">
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
              <SelectTrigger className="w-[140px]">
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
          <div className="flex items-center justify-between">
            <div>
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
            </div>
            <div className="p-4 bg-blue-50 rounded-full text-blue-600">
              <Package className="w-6 h-6" />
            </div>
          </div>
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
