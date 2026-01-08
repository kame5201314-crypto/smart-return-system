'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { RETURN_STATUS, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS, KANBAN_COLUMNS } from '@/config/constants';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface DashboardStats {
  totalReturns: number;
  pendingReview: number;
  inProgress: number;
  abnormal: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReturns, setRecentReturns] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await getReturnRequests();

        if (result.success && result.data) {
          const data = result.data as unknown[];

          // Calculate stats
          const pendingReview = data.filter(
            (r: unknown) => (r as { status: string }).status === RETURN_STATUS.PENDING_REVIEW
          ).length;
          const inProgressStatuses = [
            RETURN_STATUS.APPROVED_WAITING_SHIPPING,
            RETURN_STATUS.SHIPPING_IN_TRANSIT,
            RETURN_STATUS.RECEIVED_INSPECTING,
            RETURN_STATUS.REFUND_PROCESSING,
          ] as string[];
          const inProgress = data.filter((r: unknown) =>
            inProgressStatuses.includes((r as { status: string }).status)
          ).length;
          const abnormal = data.filter(
            (r: unknown) => (r as { status: string }).status === RETURN_STATUS.ABNORMAL_DISPUTED
          ).length;

          setStats({
            totalReturns: data.length,
            pendingReview,
            inProgress,
            abnormal,
          });

          // Get recent 5 returns
          setRecentReturns(data.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">儀表板</h1>
        <p className="text-muted-foreground">退貨營運總覽</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="總退貨單數"
          value={stats?.totalReturns}
          icon={<Package className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          title="待處理"
          value={stats?.pendingReview}
          icon={<Clock className="w-5 h-5" />}
          loading={loading}
          variant="warning"
        />
        <StatCard
          title="異常/爭議"
          value={stats?.abnormal}
          icon={<AlertTriangle className="w-5 h-5" />}
          loading={loading}
          variant="danger"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/returns">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">退貨看板</h3>
                <p className="text-sm text-muted-foreground">查看所有退貨單狀態</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/analytics">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">數據分析</h3>
                <p className="text-sm text-muted-foreground">查看退貨統計報表</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/analytics/ai-report">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">AI 分析報告</h3>
                <p className="text-sm text-muted-foreground">生成智能分析報告</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent returns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最新退貨單</CardTitle>
            <CardDescription>最近提交的退貨申請</CardDescription>
          </div>
          <Link href="/returns">
            <Button variant="outline" size="sm">
              查看全部
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentReturns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              尚無退貨申請
            </p>
          ) : (
            <div className="space-y-4">
              {recentReturns.map((returnReq: unknown) => {
                const r = returnReq as {
                  id: string;
                  request_number: string;
                  status: string;
                  created_at: string;
                  refund_amount: number | null;
                  order?: { customer_name: string | null };
                };
                return (
                  <Link
                    key={r.id}
                    href={`/returns/${r.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{r.request_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.order?.customer_name || '未知客戶'} ·{' '}
                          {format(new Date(r.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                        </p>
                      </div>
                    </div>
                    <Badge className={RETURN_STATUS_COLORS[r.status]}>
                      {RETURN_STATUS_LABELS[r.status]}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>各階段分佈</CardTitle>
          <CardDescription>退貨單當前狀態分佈</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {KANBAN_COLUMNS.map((col) => {
              // Count items that match any of the statuses in this column
              const columnStatuses = (col.statuses || [col.id]) as string[];
              const count = recentReturns.filter(
                (r: unknown) => columnStatuses.includes((r as { status: string }).status)
              ).length;
              return (
                <div
                  key={col.id}
                  className={`p-4 rounded-lg border-l-4 bg-gray-50 ${col.color}`}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{col.title}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
  variant,
  format: formatType,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
  variant?: 'warning' | 'danger';
  format?: 'currency';
}) {
  const bgColor =
    variant === 'warning'
      ? 'bg-yellow-50'
      : variant === 'danger'
      ? 'bg-red-50'
      : 'bg-gray-50';

  const iconColor =
    variant === 'warning'
      ? 'text-yellow-600'
      : variant === 'danger'
      ? 'text-red-600'
      : 'text-primary';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {formatType === 'currency'
                  ? `NT$ ${(value || 0).toLocaleString()}`
                  : value || 0}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-full ${bgColor} ${iconColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
