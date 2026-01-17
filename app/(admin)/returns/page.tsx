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
import { ReturnsTable, SortField, SortDirection } from '@/components/shared/returns-table';

import { getReturnRequests } from '@/lib/actions/return.actions';
import { RETURN_STATUS, RETURN_STATUS_LABELS, CHANNEL_LIST } from '@/config/constants';

// Status order for sorting
const STATUS_ORDER: Record<string, number> = {
  'pending_review': 1,
  'approved_waiting_shipping': 2,
  'shipping_in_transit': 3,
  'received_inspecting': 4,
  'refund_processing': 5,
  'abnormal_disputed': 6,
  'completed': 7,
};

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
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchReturns();
  }, []);

  useEffect(() => {
    filterReturns();
  }, [returns, statusFilter, channelFilter, sortField, sortDirection]); // Remove searchQuery - only filter on button click

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
      if (statusFilter === 'pending_inspection') {
        // 待驗收 includes multiple statuses
        const pendingStatuses = ['pending_review', 'approved_waiting_shipping', 'shipping_in_transit', 'received_inspecting', 'refund_processing'];
        filtered = filtered.filter((r) => pendingStatuses.includes(r.status));
      } else {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
    }

    // Channel filter
    if (channelFilter !== 'all') {
      filtered = filtered.filter((r) => r.channel_source === channelFilter);
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'status':
            const statusA = STATUS_ORDER[a.status] ?? 99;
            const statusB = STATUS_ORDER[b.status] ?? 99;
            comparison = statusA - statusB;
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case 'channel_source':
            const channelA = a.channel_source || '';
            const channelB = b.channel_source || '';
            comparison = channelA.localeCompare(channelB);
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredReturns(filtered);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default desc direction
      setSortField(field);
      setSortDirection('desc');
    }
  }

  async function handleExport() {
    const ExcelJS = (await import('exceljs')).default;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('退貨單');

    // Define columns
    worksheet.columns = [
      { header: '退貨單號', key: 'request_number', width: 18 },
      { header: '客戶名稱', key: 'customer_name', width: 15 },
      { header: '訂單編號', key: 'order_number', width: 18 },
      { header: '狀態', key: 'status', width: 12 },
      { header: '通路', key: 'channel', width: 10 },
      { header: '退款金額', key: 'refund_amount', width: 10 },
      { header: '建立時間', key: 'created_at', width: 18 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };

    // Add data
    filteredReturns.forEach((r) => {
      worksheet.addRow({
        request_number: r.request_number,
        customer_name: r.order?.customer_name || '',
        order_number: r.order?.order_number || '',
        status: RETURN_STATUS_LABELS[r.status] || r.status,
        channel: r.channel_source || '',
        refund_amount: r.refund_amount || 0,
        created_at: r.created_at,
      });
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `退貨單_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
            <div className="relative flex-1 min-w-[200px] flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋退貨單號、客戶名稱、電話..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      filterReturns();
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => filterReturns()} variant="secondary">
                <Search className="w-4 h-4 mr-2" />
                搜尋
              </Button>
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="所有狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                <SelectItem value="pending_inspection">待驗收</SelectItem>
                <SelectItem value="completed">已結案</SelectItem>
                <SelectItem value="abnormal_disputed">驗收異常</SelectItem>
              </SelectContent>
            </Select>

            {/* Channel filter */}
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="所有來源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有來源</SelectItem>
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
        <ReturnsTable
          items={filteredReturns}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}
    </div>
  );
}
