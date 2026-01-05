'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, Download, Plus, LayoutGrid, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { ReturnsTable } from '@/components/shared/returns-table';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { RETURN_STATUS, RETURN_STATUS_LABELS, CHANNEL_LIST } from '@/config/constants';

interface ReturnItem {
  id: string;
  request_number: string;
  status: string;
  created_at: string;
  refund_amount: number | null;
  channel_source: string | null;
  order?: {
    customer_name: string | null;
    customer_phone: string | null;
    order_number: string;
  } | null;
  return_items?: {
    product_name: string;
  }[];
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  useEffect(() => {
    fetchReturns();
  }, []);

  useEffect(() => {
    filterReturns();
  }, [returns, searchQuery, statusFilter, channelFilter]);

  async function fetchReturns() {
    try {
      const result = await getReturnRequests();
      if (result.success && result.data) {
        setReturns(result.data as ReturnItem[]);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterReturns() {
    let filtered = [...returns];

    // Search filter (supports phone number search)
    if (searchQuery) {
      const query = searchQuery.toLowerCase().replace(/[-\s]/g, '');
      filtered = filtered.filter(
        (r) =>
          r.request_number.toLowerCase().includes(query) ||
          r.order?.customer_name?.toLowerCase().includes(query) ||
          r.order?.order_number?.toLowerCase().includes(query) ||
          r.order?.customer_phone?.replace(/[-\s]/g, '').includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Channel filter
    if (channelFilter !== 'all') {
      filtered = filtered.filter((r) => r.channel_source === channelFilter);
    }

    setFilteredReturns(filtered);
  }

  async function handleExport() {
    // In production, this would generate and download an Excel file
    const { utils, writeFile } = await import('xlsx');

    const data = filteredReturns.map((r) => ({
      退貨單號: r.request_number,
      客戶名稱: r.order?.customer_name || '',
      訂單編號: r.order?.order_number || '',
      狀態: RETURN_STATUS_LABELS[r.status] || r.status,
      通路: r.channel_source || '',
      退款金額: r.refund_amount || 0,
      建立時間: r.created_at,
    }));

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '退貨單');
    writeFile(wb, `退貨單_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">退貨管理</h1>
          <p className="text-muted-foreground">管理所有退貨申請</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          匯出 Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋退貨單號、客戶名稱、電話..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="所有狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                {Object.entries(RETURN_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={value}>
                    {RETURN_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Channel filter */}
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="所有通路" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有通路</SelectItem>
                {CHANNEL_LIST.map((channel) => (
                  <SelectItem key={channel.key} value={channel.key}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={view === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('kanban')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">載入中...</div>
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard items={filteredReturns} />
      ) : (
        <ReturnsTable items={filteredReturns} />
      )}
    </div>
  );
}
