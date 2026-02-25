'use client';

import { useCallback, useEffect, useState, useRef, type ChangeEvent } from 'react';
import { Search, Download, Upload, Plus, LayoutGrid, List, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { ReturnsTable, SortField, SortDirection } from '@/components/shared/returns-table';

import { getReturnRequests, createManualReturnRequest } from '@/lib/actions/return.actions';
import { RETURN_STATUS_LABELS, CHANNEL_LIST, RETURN_REASONS, RETURN_ITEM_RESOLUTION_TYPES } from '@/config/constants';

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
    resolution_type?: string | null;
  }[];
}

const RETURN_IMPORT_COLUMN_MAPPINGS: Record<string, string> = {
  '訂單編號': 'orderNumber',
  '通路': 'channelSource',
  '來源': 'channelSource',
  '客戶名稱': 'customerName',
  '客戶電話': 'customerPhone',
  '電話': 'customerPhone',
  '退貨原因': 'reasonCategory',
  '退貨原因說明': 'reasonDetail',
  '退貨詳細說明': 'reasonDetail',
  '退款金額': 'refundAmount',
  '商品名稱': 'productName',
  '商品貨號': 'productSku',
  '貨號': 'productSku',
  'SKU': 'productSku',
  '數量': 'quantity',
  '單價': 'unitPrice',
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [manualForm, setManualForm] = useState({
    orderNumber: '',
    channelSource: 'official',
    customerName: '',
    customerPhone: '',
    reasonCategory: '',
    reasonDetail: '',
    refundAmount: '',
    items: [{ productName: '', productSku: '', quantity: '1', unitPrice: '' }],
  });

  useEffect(() => {
    fetchReturns();
  }, []);

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

  const filterReturns = useCallback(() => {
    let filtered = [...returns];

    // Search filter (supports phone number search)
    if (appliedSearchQuery) {
      const query = appliedSearchQuery.toLowerCase().replace(/[-\s]/g, '');
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
        // 待審核 includes multiple statuses
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
  }, [appliedSearchQuery, channelFilter, returns, sortDirection, sortField, statusFilter]);

  useEffect(() => {
    filterReturns();
  }, [filterReturns]);

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

  function resetManualForm() {
    setManualForm({
      orderNumber: '', channelSource: 'official', customerName: '', customerPhone: '',
      reasonCategory: '', reasonDetail: '', refundAmount: '',
      items: [{ productName: '', productSku: '', quantity: '1', unitPrice: '' }],
    });
  }

  async function handleManualSubmit() {
    if (!manualForm.orderNumber.trim()) {
      toast.error('請輸入訂單編號');
      return;
    }
    if (!manualForm.items[0]?.productName.trim()) {
      toast.error('請至少輸入一項退貨商品名稱');
      return;
    }
    setIsManualSubmitting(true);
    try {
      const result = await createManualReturnRequest({
        orderNumber: manualForm.orderNumber,
        channelSource: manualForm.channelSource,
        customerName: manualForm.customerName || undefined,
        customerPhone: manualForm.customerPhone || undefined,
        reasonCategory: manualForm.reasonCategory || undefined,
        reasonDetail: manualForm.reasonDetail || undefined,
        refundAmount: manualForm.refundAmount ? parseFloat(manualForm.refundAmount) : undefined,
        items: manualForm.items.filter((i) => i.productName.trim()).map((i) => ({
          productName: i.productName,
          productSku: i.productSku || undefined,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : undefined,
        })),
      });
      if (result.success && result.data) {
        toast.success(`退貨單 ${result.data.requestNumber} 建立成功`);
        setManualDialogOpen(false);
        resetManualForm();
        fetchReturns();
      } else {
        toast.error(result.error || '建立失敗');
      }
    } catch {
      toast.error('建立失敗');
    }
    setIsManualSubmitting(false);
  }

  function normalizeChannelSource(value: string): string {
    const v = value.trim();
    if (!v) return 'official';

    const lower = v.toLowerCase();
    if (['official', 'shopee', 'shopee_mall', 'other'].includes(lower)) return lower;

    const byLabel = CHANNEL_LIST.find((ch) => ch.label === v);
    if (byLabel) return byLabel.key;

    if (v.includes('官')) return 'official';
    if (v.includes('蝦皮') || lower.includes('shopee')) {
      return v.includes('商城') ? 'shopee_mall' : 'shopee';
    }
    if (v.includes('商城')) return 'shopee_mall';

    return 'other';
  }

  function normalizeReasonCategory(value: string): string | undefined {
    const v = value.trim();
    if (!v) return undefined;

    const direct = Object.values(RETURN_REASONS).find((r) => r.key === v);
    if (direct) return direct.key;

    const byLabel = Object.values(RETURN_REASONS).find((r) => r.label === v);
    if (byLabel) return byLabel.key;

    return v; // allow importing custom reason keys
  }

  function cellValueToString(val: unknown): string {
    if (val === undefined || val === null) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'object') {
      const obj = val as { text?: unknown; richText?: Array<{ text?: unknown }>; result?: unknown };
      if (typeof obj.text === 'string') return obj.text.trim();
      if (Array.isArray(obj.richText)) {
        return obj.richText.map((r) => String(r.text ?? '')).join('').trim();
      }
      if (obj.result !== undefined && obj.result !== null) return String(obj.result).trim();
    }
    return String(val).trim();
  }

  function parseNumber(val: unknown): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return isNaN(val) ? undefined : val;
    const cleaned = cellValueToString(val).replace(/[^0-9.-]/g, '');
    if (!cleaned) return undefined;
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  function parseInteger(val: unknown, defaultVal: number = 1): number {
    const num = parseNumber(val);
    if (num === undefined) return defaultVal;
    const intVal = Math.trunc(num);
    return intVal > 0 ? intVal : defaultVal;
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) {
        toast.error('Excel 檔案沒有資料');
        return;
      }

      const headerRow = worksheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value;
      });

      const columnIndices: Record<string, number> = {};
      headers.forEach((header, index) => {
        const cleanHeader = header?.toString().trim();
        if (!cleanHeader) return;
        const key = RETURN_IMPORT_COLUMN_MAPPINGS[cleanHeader];
        if (!key) return;
        if (columnIndices[key] === undefined) {
          columnIndices[key] = index;
        }
      });

      if (columnIndices.orderNumber === undefined || columnIndices.productName === undefined) {
        toast.error('匯入失敗：找不到必要欄位（訂單編號、商品名稱）');
        return;
      }

      type ImportGroup = {
        orderNumber: string;
        channelSource: string;
        customerName?: string;
        customerPhone?: string;
        reasonCategory?: string;
        reasonDetail?: string;
        refundAmount?: number;
        items: { productName: string; productSku?: string; quantity: number; unitPrice?: number }[];
      };

      const groups = new Map<string, ImportGroup>();

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const rowValues: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });

        const getRaw = (key: string): unknown => {
          const idx = columnIndices[key];
          if (idx === undefined) return undefined;
          return rowValues[idx];
        };

        const getText = (key: string): string => cellValueToString(getRaw(key));

        const orderNumber = getText('orderNumber');
        const productName = getText('productName');
        if (!orderNumber || !productName) return;

        const channelSource = normalizeChannelSource(getText('channelSource'));
        const customerName = getText('customerName') || undefined;
        const customerPhone = getText('customerPhone') || undefined;
        const reasonCategory = normalizeReasonCategory(getText('reasonCategory') || '');
        const reasonDetail = getText('reasonDetail') || undefined;
        const refundAmount = parseNumber(getRaw('refundAmount'));

        const productSku = getText('productSku') || undefined;
        const quantity = parseInteger(getRaw('quantity'), 1);
        const unitPrice = parseNumber(getRaw('unitPrice'));

        const groupKey = [
          orderNumber,
          customerPhone || '',
          channelSource,
          reasonCategory || '',
          reasonDetail || '',
          refundAmount ?? '',
        ].join('||');

        const group = groups.get(groupKey) || {
          orderNumber,
          channelSource,
          customerName,
          customerPhone,
          reasonCategory,
          reasonDetail,
          refundAmount,
          items: [],
        };

        group.items.push({
          productName,
          productSku,
          quantity,
          unitPrice,
        });

        groups.set(groupKey, group);
      });

      const requests = Array.from(groups.values());
      if (requests.length === 0) {
        toast.error('Excel 沒有可匯入的資料');
        return;
      }

      let importedCount = 0;
      const failed: Array<{ orderNumber: string; error: string }> = [];

      for (const req of requests) {
        const result = await createManualReturnRequest({
          orderNumber: req.orderNumber,
          channelSource: req.channelSource,
          customerName: req.customerName,
          customerPhone: req.customerPhone,
          reasonCategory: req.reasonCategory,
          reasonDetail: req.reasonDetail,
          refundAmount: req.refundAmount,
          items: req.items,
        });

        if (result.success) {
          importedCount++;
        } else {
          failed.push({ orderNumber: req.orderNumber, error: result.error || '建立失敗' });
        }
      }

      if (importedCount > 0) {
        toast.success(`已匯入 ${importedCount} 筆退貨單${failed.length > 0 ? `，失敗 ${failed.length} 筆` : ''}`);
        fetchReturns();
      } else {
        toast.error(`匯入失敗（共 ${failed.length} 筆）`);
      }

      if (failed.length > 0) {
        console.warn('Return import failures:', failed);
        toast.error(`部分失敗：${failed.slice(0, 3).map((f) => f.orderNumber).join(', ')}${failed.length > 3 ? ' ...' : ''}`);
      }
    } catch (error) {
      console.error('Return import error:', error);
      toast.error('匯入失敗，請確認檔案格式');
    } finally {
      setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
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
      { header: '處理方式', key: 'resolution_type', width: 18 },
      { header: '退款金額', key: 'refund_amount', width: 10 },
      { header: '建立時間', key: 'created_at', width: 18 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };

    // Add data
    filteredReturns.forEach((r) => {
      const resolutionLabels = Array.from(
        new Set(
          ((r.return_items || [])
            .map((item) =>
              Object.values(RETURN_ITEM_RESOLUTION_TYPES).find((type) => type.key === item.resolution_type)?.label
            )
            .filter(Boolean) as string[])
        )
      );

      worksheet.addRow({
        request_number: r.request_number,
        customer_name: r.order?.customer_name || '',
        order_number: r.order?.order_number || '',
        status: RETURN_STATUS_LABELS[r.status] || r.status,
        channel: r.channel_source || '',
        resolution_type: resolutionLabels.join('、') || RETURN_ITEM_RESOLUTION_TYPES.FULL.label,
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
        <div className="flex gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button onClick={() => setManualDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            手動新增
          </Button>
          <Button
            variant="outline"
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? '匯入中...' : '匯入'}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            匯出 Excel
          </Button>
        </div>
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
                      setAppliedSearchQuery(searchQuery.trim());
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setAppliedSearchQuery(searchQuery.trim())} variant="secondary">
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
                <SelectItem value="pending_inspection">待審核</SelectItem>
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
          onRefresh={fetchReturns}
        />
      )}

      {/* Manual Entry Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>手動新增退貨單</DialogTitle>
            <DialogDescription>手動輸入退貨申請資料</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-2">
            {/* Customer Info */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">客戶資訊</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>客戶名稱</Label>
                  <Input value={manualForm.customerName} onChange={(e) => setManualForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="輸入客戶名稱" />
                </div>
                <div className="space-y-1">
                  <Label>客戶電話</Label>
                  <Input value={manualForm.customerPhone} onChange={(e) => setManualForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="09xxxxxxxx" />
                </div>
              </div>
            </div>

            {/* Order Info */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">訂單資訊</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>訂單編號 *</Label>
                  <Input value={manualForm.orderNumber} onChange={(e) => setManualForm((f) => ({ ...f, orderNumber: e.target.value }))} placeholder="輸入訂單編號" />
                </div>
                <div className="space-y-1">
                  <Label>通路 *</Label>
                  <Select value={manualForm.channelSource} onValueChange={(v) => setManualForm((f) => ({ ...f, channelSource: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_LIST.map((ch) => (
                        <SelectItem key={ch.key} value={ch.key}>{ch.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Return Info */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">退貨資訊</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>退貨原因</Label>
                  <Select value={manualForm.reasonCategory} onValueChange={(v) => setManualForm((f) => ({ ...f, reasonCategory: v }))}>
                    <SelectTrigger><SelectValue placeholder="選擇退貨原因" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(RETURN_REASONS).map((r) => (
                        <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>退款金額</Label>
                  <Input type="number" value={manualForm.refundAmount} onChange={(e) => setManualForm((f) => ({ ...f, refundAmount: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label>退貨詳細說明</Label>
                <Textarea rows={2} value={manualForm.reasonDetail} onChange={(e) => setManualForm((f) => ({ ...f, reasonDetail: e.target.value }))} />
              </div>
            </div>

            {/* Return Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">退貨商品</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setManualForm((f) => ({ ...f, items: [...f.items, { productName: '', productSku: '', quantity: '1', unitPrice: '' }] }))}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  新增商品
                </Button>
              </div>
              <div className="space-y-3">
                {manualForm.items.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">商品名稱 *</Label>
                        <Input
                          value={item.productName}
                          onChange={(e) => {
                            const newItems = [...manualForm.items];
                            newItems[idx] = { ...newItems[idx], productName: e.target.value };
                            setManualForm((f) => ({ ...f, items: newItems }));
                          }}
                          placeholder="輸入商品名稱"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">貨號</Label>
                        <Input
                          value={item.productSku}
                          onChange={(e) => {
                            const newItems = [...manualForm.items];
                            newItems[idx] = { ...newItems[idx], productSku: e.target.value };
                            setManualForm((f) => ({ ...f, items: newItems }));
                          }}
                          placeholder="輸入貨號"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">數量</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...manualForm.items];
                            newItems[idx] = { ...newItems[idx], quantity: e.target.value };
                            setManualForm((f) => ({ ...f, items: newItems }));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">單價</Label>
                          {manualForm.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-red-500"
                              onClick={() => setManualForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newItems = [...manualForm.items];
                            newItems[idx] = { ...newItems[idx], unitPrice: e.target.value };
                            setManualForm((f) => ({ ...f, items: newItems }));
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>取消</Button>
            <Button onClick={handleManualSubmit} disabled={isManualSubmitting}>
              {isManualSubmitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />建立中...</> : '確認建立'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
