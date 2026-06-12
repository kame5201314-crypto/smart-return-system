'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  ClipboardList,
  Search,
  Printer,
  Upload,
  Download,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/saas/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import {
  getPickupRecords,
  createPickupRecord,
  updatePickupRecord,
  deletePickupRecord,
  importPickupRecords,
  batchDeletePickupRecords,
  batchUpdatePickupPrinted,
} from '@/lib/actions/pickup.actions';
import type { PickupRecord } from '@/lib/actions/pickup.actions';

const PLATFORMS = ['商城', '蝦皮', '官網', 'MOMO', '其他'];
const LOGISTICS_PROVIDERS = ['黑貓', '新竹物流', '7-11', '全家', '宅配通', '其他'];
const DELIVERY_STATUSES = ['派車收件', '來回件', '已送達', '配送中', '待收件', '已退回'];
const RECEIVED_STATUSES = ['未收到', '已收到', '已貼標', '待確認', '完成'];

const PICKUP_IMPORT_COLUMN_MAPPINGS: Record<string, string> = {
  '處理日期': 'process_date',
  '訂單編號': 'order_number',
  '物流單號': 'tracking_number',
  '平台': 'platform',
  '物流': 'logistics_provider',
  '物流狀態': 'delivery_status',
  '收到/已貼': 'received_status',
  '收件人姓名': 'receiver_info',
  '備註': 'notes',
};

export default function PickupPage() {
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<PickupRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PickupRecord | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    processDate: format(new Date(), 'yyyy-MM-dd'),
    orderNumber: '',
    trackingNumber: '',
    platform: '商城',
    logisticsProvider: '黑貓',
    deliveryStatus: '派車收件',
    receivedStatus: '未收到',
    notes: '',
    receiverInfo: '',
  });

  // Load records from Supabase
  const loadRecords = useCallback(async () => {
    const result = await getPickupRecords();
    if (result.success && result.data) {
      setRecords(result.data);
    } else {
      toast.error(result.error || '載入資料失敗');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Filter records
  useEffect(() => {
    if (!searchQuery) {
      setFilteredRecords(records);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRecords(
        records.filter(
          (r) =>
            r.order_number.toLowerCase().includes(query) ||
            r.platform.toLowerCase().includes(query) ||
            (r.receiver_info || '').toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, records]);

  function normalizeExcelDate(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'number') {
      // Excel serial date -> JS date
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }
    const str = String(value ?? '').trim();
    if (!str) return '';

    const match = str.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    if (match) return match[1].replace(/\//g, '-');
    return str.length >= 10 ? str.slice(0, 10) : str;
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
        const key = PICKUP_IMPORT_COLUMN_MAPPINGS[cleanHeader];
        if (!key) return;
        if (columnIndices[key] === undefined) {
          columnIndices[key] = index;
        }
      });

      if (columnIndices.order_number === undefined) {
        const idx = headers.findIndex((h) => (h?.toString() || '').includes('訂單'));
        if (idx >= 0) columnIndices.order_number = idx;
      }
      if (columnIndices.process_date === undefined) {
        const idx = headers.findIndex((h) => (h?.toString() || '').includes('日期'));
        if (idx >= 0) columnIndices.process_date = idx;
      }

      const importedItems: Array<{
        process_date: string;
        order_number: string;
        tracking_number?: string;
        platform: string;
        logistics_provider: string;
        delivery_status: string;
        received_status: string;
        notes?: string;
        receiver_info?: string;
      }> = [];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const rowValues: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });

        const getCellValue = (key: string): string => {
          const idx = columnIndices[key];
          if (idx === undefined) return '';
          const val = rowValues[idx];
          if (val === undefined || val === null) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return String(val).trim();
        };

        const orderNumber = getCellValue('order_number');
        if (!orderNumber) return;

        const processDateRaw = columnIndices.process_date !== undefined ? rowValues[columnIndices.process_date] : '';
        const processDate = normalizeExcelDate(processDateRaw) || format(new Date(), 'yyyy-MM-dd');

        importedItems.push({
          process_date: processDate,
          order_number: orderNumber,
          tracking_number: getCellValue('tracking_number') || undefined,
          platform: getCellValue('platform') || '商城',
          logistics_provider: getCellValue('logistics_provider') || '黑貓',
          delivery_status: getCellValue('delivery_status') || '派車收件',
          received_status: getCellValue('received_status') || '未收到',
          receiver_info: getCellValue('receiver_info') || undefined,
          notes: getCellValue('notes') || undefined,
        });
      });

      if (importedItems.length === 0) {
        toast.error('無法解析匯入內容，請確認 Excel 欄位');
        return;
      }

      const result = await importPickupRecords(importedItems);
      if (result.success && result.data) {
        const { imported, duplicates } = result.data;
        if (imported > 0) {
          toast.success(`已匯入 ${imported} 筆${duplicates > 0 ? `，略過 ${duplicates} 筆重複` : ''}`);
          await loadRecords();
        } else if (duplicates > 0) {
          toast.info(`全部都是重複資料（共 ${duplicates} 筆）`);
        }
      } else {
        toast.error(result.error || '匯入失敗');
      }
    } catch (error) {
      console.error('Pickup import error:', error);
      toast.error('匯入失敗，請確認檔案格式');
    } finally {
      setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  }

  function handleOpenDialog(record?: PickupRecord) {
    if (record) {
      setEditingRecord(record);
      setFormData({
        processDate: record.process_date,
        orderNumber: record.order_number,
        trackingNumber: record.tracking_number || '',
        platform: record.platform,
        logisticsProvider: record.logistics_provider,
        deliveryStatus: record.delivery_status,
        receivedStatus: record.received_status,
        notes: record.notes || '',
        receiverInfo: record.receiver_info || '',
      });
    } else {
      setEditingRecord(null);
      setFormData({
        processDate: format(new Date(), 'yyyy-MM-dd'),
        orderNumber: '',
        trackingNumber: '',
        platform: '商城',
        logisticsProvider: '黑貓',
        deliveryStatus: '派車收件',
        receivedStatus: '未收到',
        notes: '',
        receiverInfo: '',
      });
    }
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.orderNumber.trim()) {
      toast.error('請填寫訂單編號');
      return;
    }

    setIsSaving(true);

    const input = {
      process_date: formData.processDate,
      order_number: formData.orderNumber,
      tracking_number: formData.trackingNumber || undefined,
      platform: formData.platform,
      logistics_provider: formData.logisticsProvider,
      delivery_status: formData.deliveryStatus,
      received_status: formData.receivedStatus,
      notes: formData.notes || undefined,
      receiver_info: formData.receiverInfo || undefined,
    };

    if (editingRecord) {
      const result = await updatePickupRecord(editingRecord.id, input);
      if (result.success && result.data) {
        setRecords((prev) =>
          prev.map((r) => (r.id === editingRecord.id ? result.data! : r))
        );
        toast.success('記錄已更新');
      } else {
        toast.error(result.error || '更新失敗');
      }
    } else {
      const result = await createPickupRecord(input);
      if (result.success && result.data) {
        setRecords((prev) => [result.data!, ...prev]);
        toast.success('記錄已新增');
      } else {
        toast.error(result.error || '新增失敗');
      }
    }

    setIsSaving(false);
    setIsDialogOpen(false);
  }

  async function handleDelete(id: string) {
    if (confirm('確定要刪除此記錄嗎？')) {
      const result = await deletePickupRecord(id);
      if (result.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        toast.success('記錄已刪除');
      } else {
        toast.error(result.error || '刪除失敗');
      }
    }
  }

  async function handleQuickStatusUpdate(id: string, field: 'received_status', value: string) {
    const result = await updatePickupRecord(id, { [field]: value });
    if (result.success && result.data) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? result.data! : r))
      );
      toast.success('狀態已更新');
    } else {
      toast.error(result.error || '更新失敗');
    }
  }

  async function togglePrinted(id: string) {
    const record = records.find((r) => r.id === id);
    if (!record) return;

    const result = await updatePickupRecord(id, { is_printed: !record.is_printed });
    if (result.success && result.data) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? result.data! : r))
      );
    } else {
      toast.error(result.error || '更新列印狀態失敗');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case '已收到':
      case '完成':
      case '已送達':
        return 'bg-green-100 text-green-800';
      case '待確認':
      case '處理中':
      case '配送中':
      case '派車收件':
        return 'bg-blue-100 text-blue-800';
      case '未收到':
      case '待收件':
        return 'bg-yellow-100 text-yellow-800';
      case '已退回':
      case '來回件':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定要刪除所選的 ${selectedIds.size} 筆記錄嗎？`)) return;

    const ids = Array.from(selectedIds);
    const result = await batchDeletePickupRecords(ids);
    if (result.success) {
      setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      toast.success(`已刪除 ${ids.length} 筆記錄`);
    } else {
      toast.error(result.error || '批次刪除失敗');
    }
  }

  async function handlePrint() {
    const selectedRecords = filteredRecords.filter((r) => selectedIds.has(r.id));

    if (selectedRecords.length === 0) {
      toast.error('請先勾選要列印的項目');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('無法開啟列印視窗，請允許彈出視窗');
      return;
    }

    // Generate labels
    const labels = selectedRecords.map((r) => ({
      orderNumber: r.order_number.split('\n')[0],
      platform: r.platform,
      date: format(new Date(r.process_date), 'M/d'),
      shipping: r.delivery_status,
    }));

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>派車收件標籤 - ${format(new Date(), 'yyyy/MM/dd')}</title>
        <style>
          @page {
            size: A4;
            margin: 5mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
          }
          .labels-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 3mm;
            padding: 5mm;
          }
          .label {
            border: 2px solid #000;
            display: grid;
            grid-template-columns: 2.5fr 1fr 1fr 1.5fr;
            height: 25mm;
            page-break-inside: avoid;
          }
          .label-cell {
            border-right: 2px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2mm;
            text-align: center;
            font-size: 11pt;
            font-weight: bold;
            overflow: hidden;
            word-break: break-all;
          }
          .label-cell:last-child {
            border-right: none;
          }
          .label-cell.order-number {
            font-size: 10pt;
            line-height: 1.2;
          }
          .label-cell.platform {
            background: #fff;
            font-size: 12pt;
          }
          .label-cell.date {
            font-size: 12pt;
          }
          .label-cell.shipping {
            font-size: 10pt;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .labels-container {
              gap: 2mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labels.map((label) => `
            <div class="label">
              <div class="label-cell order-number">${label.orderNumber}</div>
              <div class="label-cell platform">${label.platform}</div>
              <div class="label-cell date">${label.date}</div>
              <div class="label-cell shipping">${label.shipping}</div>
            </div>
          `).join('')}
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Auto-mark selected records as printed in database
    const printedIds = selectedRecords.map((r) => r.id);
    const result = await batchUpdatePickupPrinted(printedIds);
    if (result.success) {
      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, is_printed: true, updated_at: new Date().toISOString() }
            : r
        )
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<ClipboardList className="size-6" />}
        title="派車收件"
        description="追蹤物流派車收件狀態。"
        actions={
          <>
            <input
              ref={importFileRef}
              id="pickup-import-file"
              name="pickupImportFile"
              type="file"
              accept=".xlsx,.xls"
              aria-label="匯入派車收件 Excel 檔案"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? '匯入中...' : '匯入'}
            </Button>
            <Button asChild variant="outline">
              <a href="/api/v1/admin/pickup/export" target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" />
                匯出
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pickup/scan">
                <ScanLine className="w-4 h-4 mr-2" />
                掃描頁面
              </Link>
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={selectedIds.size === 0}>
              <Printer className="w-4 h-4 mr-2" />
              列印 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              新增記錄
            </Button>
          </>
        }
      />

      {/* Search & Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="pickup-search"
                name="pickupSearch"
                aria-label="搜尋派車收件記錄"
                placeholder="搜尋訂單編號、收件人姓名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">總計:</span>
                <Badge variant="secondary">{records.length} 筆</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">待收件:</span>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {records.filter((r) => r.received_status === '未收到').length} 筆
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">已收到:</span>
                <Badge className="bg-green-100 text-green-800">
                  {records.filter((r) => r.received_status === '已收到' || r.received_status === '完成').length} 筆
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">收件記錄</CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">已選 {selectedIds.size} 筆</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  批量刪除
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {records.length === 0 ? '尚無記錄，點擊上方「新增記錄」開始' : '找不到符合條件的記錄'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[70px]">掃描</TableHead>
                    <TableHead className="w-[60px]">列印</TableHead>
                    <TableHead className="w-[100px]">處理日期</TableHead>
                    <TableHead className="w-[180px]">訂單編號</TableHead>
                    <TableHead className="w-[140px]">物流單號</TableHead>
                    <TableHead className="w-[80px]">平台</TableHead>
                    <TableHead className="w-[80px]">物流</TableHead>
                    <TableHead className="w-[100px]">物流狀態</TableHead>
                    <TableHead className="w-[120px]">收到/已貼</TableHead>
                    <TableHead>收件人姓名</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className={selectedIds.has(record.id) ? 'bg-blue-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleSelect(record.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {record.is_scanned ? (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1">
                            已掃描
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1">
                            未掃描
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => togglePrinted(record.id)}>
                          {record.is_printed ? (
                            <Badge className="bg-purple-100 text-purple-800 text-[10px] px-1">
                              已列印
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1">
                              未列印
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {format(new Date(record.process_date), 'M/d', { locale: zhTW })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{record.order_number.split('\n')[0]}</div>
                          {record.order_number.split('\n')[1] && (
                            <div className="text-muted-foreground text-xs">
                              {record.order_number.split('\n')[1]}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{record.tracking_number || '-'}</TableCell>
                      <TableCell>{record.platform}</TableCell>
                      <TableCell>{record.logistics_provider}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.delivery_status)}>
                          {record.delivery_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.received_status}
                          onValueChange={(value) => handleQuickStatusUpdate(record.id, 'received_status', value)}
                        >
                          <SelectTrigger className="h-8 w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECEIVED_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm" title={record.receiver_info || ''}>
                          {record.receiver_info || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(record)}
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(record.id)}
                            title="刪除"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecord ? '編輯記錄' : '新增派車收件記錄'}</DialogTitle>
            <DialogDescription>
              填寫派車收件的相關資訊
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickup-process-date">處理日期</Label>
                <Input
                  id="pickup-process-date"
                  name="processDate"
                  type="date"
                  value={formData.processDate}
                  onChange={(e) => setFormData({ ...formData, processDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-platform">平台</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger id="pickup-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup-order-number">訂單編號 *</Label>
              <Textarea
                id="pickup-order-number"
                name="orderNumber"
                placeholder="輸入訂單編號（可多行，例如訂單號+物流單號）"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup-tracking-number">物流單號</Label>
              <Input
                id="pickup-tracking-number"
                name="trackingNumber"
                placeholder="輸入物流單號"
                value={formData.trackingNumber}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickup-logistics-provider">物流平台</Label>
                <Select
                  value={formData.logisticsProvider}
                  onValueChange={(value) => setFormData({ ...formData, logisticsProvider: value })}
                >
                  <SelectTrigger id="pickup-logistics-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGISTICS_PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-delivery-status">物流狀態</Label>
                <Select
                  value={formData.deliveryStatus}
                  onValueChange={(value) => setFormData({ ...formData, deliveryStatus: value })}
                >
                  <SelectTrigger id="pickup-delivery-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup-received-status">收到/已貼</Label>
              <Select
                value={formData.receivedStatus}
                onValueChange={(value) => setFormData({ ...formData, receivedStatus: value })}
              >
                <SelectTrigger id="pickup-received-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVED_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup-receiver-info">收件人姓名</Label>
              <Input
                id="pickup-receiver-info"
                name="receiverInfo"
                placeholder="輸入收件人姓名"
                value={formData.receiverInfo}
                onChange={(e) => setFormData({ ...formData, receiverInfo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup-notes">備註</Label>
              <Textarea
                id="pickup-notes"
                name="notes"
                placeholder="輸入備註內容"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '儲存中...' : editingRecord ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
