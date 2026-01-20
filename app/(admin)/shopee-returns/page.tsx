'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Upload,
  Search,
  Printer,
  Check,
  X,
  FileSpreadsheet,
  Trash2,
  Filter,
  ShoppingBag,
  Loader2,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  getShopeeReturns,
  importShopeeReturns,
  updateShopeeReturnStatus,
  batchUpdateShopeeReturns,
  deleteShopeeReturns,
  type ShopeeReturn,
  type ShopeeReturnInput,
} from '@/lib/actions/shopee-returns.actions';

// Column mappings for Shopee export file
const COLUMN_MAPPINGS: Record<string, keyof ShopeeReturnInput> = {
  '訂單編號': 'orderNumber',
  '訂單號碼': 'orderNumber',
  '退貨/退款編號': 'orderNumber',
  '退貨編號': 'orderNumber',
  '退款編號': 'orderNumber',
  '訂單成立日期': 'orderDate',
  '訂單成立時間': 'orderDate',
  '訂單完成時間': 'orderDate',
  '商品總價': 'totalPrice',
  '商品合計': 'totalPrice',
  '買家總支付金額': 'totalPrice',
  '商品名稱': 'productName',
  '產品名稱': 'productName',
  '商品選項名稱': 'optionName',
  '規格名稱': 'optionName',
  '商品活動價格': 'activityPrice',
  '活動價格': 'activityPrice',
  '商品原價': 'activityPrice',
  '商品選項貨號': 'optionSku',
  '商品選項資號': 'optionSku',
  '主商品資號': 'optionSku',
  '賣家SKU': 'optionSku',
  '商品選項貨號(賣家SKU)': 'optionSku',
  'SKU': 'optionSku',
  '貨號': 'optionSku',
  '退貨數量': 'returnQuantity',
  '數量': 'returnQuantity',
  '退款數量': 'returnQuantity',
  '寄件編號': 'trackingNumber',
  '運單編號': 'trackingNumber',
  '物流單號': 'trackingNumber',
  '追蹤編號': 'trackingNumber',
  '包裹查詢號碼': 'trackingNumber',
  '退貨寄件編號': 'trackingNumber',
  // New fields
  '爭議申請期限': 'disputeDeadline',
  '買家退款金額': 'refundAmount',
  '退貨原因': 'returnReason',
  '買家退貨備註': 'buyerNote',
  '買家備註': 'buyerNote',
};

type SortField = 'order_date' | 'is_processed' | 'is_scanned' | null;
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

export default function ShopeeReturnsPage() {
  const [returns, setReturns] = useState<ShopeeReturn[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ShopeeReturn[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [scanFilter, setScanFilter] = useState<'all' | 'scanned' | 'not_scanned'>('all');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'not_printed'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importPlatform, setImportPlatform] = useState<'shopee' | 'mall'>('shopee');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const shopeeFileRef = useRef<HTMLInputElement>(null);
  const mallFileRef = useRef<HTMLInputElement>(null);
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // Load from database
  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    setIsLoading(true);
    const result = await getShopeeReturns();
    if (result.success && result.data) {
      setReturns(result.data);
    } else {
      toast.error(result.error || '載入失敗');
    }
    setIsLoading(false);
  }

  // Filter and sort returns
  useEffect(() => {
    let filtered = [...returns];

    // Status filter
    if (statusFilter === 'processed') {
      filtered = filtered.filter((r) => r.is_processed);
    } else if (statusFilter === 'unprocessed') {
      filtered = filtered.filter((r) => !r.is_processed);
    }

    // Scan filter
    if (scanFilter === 'scanned') {
      filtered = filtered.filter((r) => r.is_scanned);
    } else if (scanFilter === 'not_scanned') {
      filtered = filtered.filter((r) => !r.is_scanned);
    }

    // Print filter
    if (printFilter === 'printed') {
      filtered = filtered.filter((r) => r.is_printed);
    } else if (printFilter === 'not_printed') {
      filtered = filtered.filter((r) => !r.is_printed);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.order_number.toLowerCase().includes(query) ||
          (r.tracking_number?.toLowerCase().includes(query) ?? false) ||
          (r.product_name?.toLowerCase().includes(query) ?? false) ||
          (r.option_sku?.toLowerCase().includes(query) ?? false) ||
          (r.note?.toLowerCase().includes(query) ?? false)
      );
    }

    // Sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let comparison = 0;

        if (sortField === 'order_date') {
          const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
          const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
          comparison = dateA - dateB;
        } else if (sortField === 'is_processed') {
          comparison = (a.is_processed ? 1 : 0) - (b.is_processed ? 1 : 0);
        } else if (sortField === 'is_scanned') {
          comparison = (a.is_scanned ? 1 : 0) - (b.is_scanned ? 1 : 0);
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredReturns(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [returns, searchQuery, statusFilter, scanFilter, printFilter, sortField, sortDirection]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE);
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handle column sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction or clear
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  // Get sort icon for column
  function getSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'desc'
      ? <ArrowDown className="w-3 h-3 ml-1" />
      : <ArrowUp className="w-3 h-3 ml-1" />;
  }

  function formatOrderDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const match = dateStr.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      return match ? match[1].replace(/\//g, '-') : dateStr.substring(0, 10);
    }
    return format(date, 'yyyy-MM-dd');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, platform: 'shopee' | 'mall') {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file name based on platform
    const fileName = file.name.toLowerCase();
    if (platform === 'shopee') {
      if (!fileName.includes('蝦皮') && !fileName.includes('shopee')) {
        toast.error('蝦皮匯入只能匯入檔名包含「蝦皮」的檔案');
        e.target.value = '';
        return;
      }
      if (fileName.includes('商城') || fileName.includes('mall')) {
        toast.error('此檔案應使用「商城匯入」功能');
        e.target.value = '';
        return;
      }
    } else if (platform === 'mall') {
      if (!fileName.includes('商城') && !fileName.includes('mall')) {
        toast.error('商城匯入只能匯入檔名包含「商城」的檔案');
        e.target.value = '';
        return;
      }
    }

    setIsImporting(true);
    setImportPlatform(platform);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) {
        toast.error('Excel 檔案沒有資料');
        setIsImporting(false);
        return;
      }

      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value;
      });

      const columnIndices: Record<string, number> = {};
      const foundHeaders: string[] = [];

      headers.forEach((header, index) => {
        const cleanHeader = header?.toString().trim();
        if (cleanHeader) {
          foundHeaders.push(cleanHeader);
          if (COLUMN_MAPPINGS[cleanHeader]) {
            if (columnIndices[COLUMN_MAPPINGS[cleanHeader]] === undefined) {
              columnIndices[COLUMN_MAPPINGS[cleanHeader]] = index;
            }
          }
        }
      });

      if (columnIndices.orderNumber === undefined) {
        const orderColIndex = headers.findIndex((h) => {
          const str = h?.toString() || '';
          return str.includes('編號') || str.includes('訂單');
        });
        if (orderColIndex >= 0) {
          columnIndices.orderNumber = orderColIndex;
        } else if (headers.length > 0) {
          columnIndices.orderNumber = 0;
        }
      }

      const newItems: ShopeeReturnInput[] = [];

      // Process data rows (starting from row 2)
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowValues: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });

        if (rowValues.length === 0) return;

        let orderNumber = '';
        const orderVal = rowValues[columnIndices.orderNumber];
        if (orderVal !== undefined && orderVal !== null && orderVal !== '') {
          orderNumber = String(orderVal).trim();
        }

        if (!orderNumber) return;

        const getCellValue = (key: string): string => {
          const idx = columnIndices[key];
          if (idx === undefined) return '';
          const val = rowValues[idx];
          if (val === undefined || val === null) return '';
          // Handle Date objects from Excel
          if (val instanceof Date) {
            return val.toISOString().split('T')[0];
          }
          return String(val).trim();
        };

        const getCellNumber = (key: string, defaultVal: number = 0): number => {
          const idx = columnIndices[key];
          if (idx === undefined) return defaultVal;
          const val = rowValues[idx];
          if (val === undefined || val === null) return defaultVal;
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? defaultVal : num;
        };

        newItems.push({
          orderNumber,
          trackingNumber: getCellValue('trackingNumber') || undefined,
          orderDate: getCellValue('orderDate'),
          totalPrice: getCellNumber('totalPrice'),
          productName: getCellValue('productName'),
          optionName: getCellValue('optionName'),
          activityPrice: getCellNumber('activityPrice'),
          optionSku: getCellValue('optionSku'),
          returnQuantity: getCellNumber('returnQuantity', 1) || 1,
          disputeDeadline: getCellValue('disputeDeadline') || undefined,
          refundAmount: getCellNumber('refundAmount') || undefined,
          returnReason: getCellValue('returnReason') || undefined,
          buyerNote: getCellValue('buyerNote') || undefined,
        });
      });

      if (newItems.length > 0) {
        const platformLabel = platform === 'shopee' ? '蝦皮' : '商城';
        const result = await importShopeeReturns(newItems, platform);
        if (result.success && result.data) {
          const { imported, duplicates } = result.data;
          if (imported > 0) {
            toast.success(`成功匯入 ${imported} 筆${platformLabel}資料${duplicates > 0 ? `，略過 ${duplicates} 筆重複` : ''}`);
            loadReturns();
          } else if (duplicates > 0) {
            toast.info(`所有 ${duplicates} 筆資料都是重複的`);
          }
        } else {
          toast.error(result.error || '匯入失敗');
        }
      } else {
        toast.error(`無法解析資料，找到的欄位：${foundHeaders.slice(0, 5).join(', ')}${foundHeaders.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('password') || errorMsg.includes('encrypt')) {
        toast.error('檔案有密碼保護，請先解除密碼後再匯入');
      } else {
        toast.error('匯入失敗，請確認檔案格式');
      }
    }

    setIsImporting(false);
    // Clear both file inputs
    if (shopeeFileRef.current) shopeeFileRef.current.value = '';
    if (mallFileRef.current) mallFileRef.current.value = '';
  }

  async function toggleProcessed(id: string) {
    const record = returns.find((r) => r.id === id);
    if (!record) return;

    const result = await updateShopeeReturnStatus(id, { is_processed: !record.is_processed });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, is_processed: !r.is_processed } : r
        )
      );
    } else {
      toast.error(result.error || '更新失敗');
    }
  }

  async function togglePrinted(id: string) {
    const record = returns.find((r) => r.id === id);
    if (!record) return;

    const result = await updateShopeeReturnStatus(id, { is_printed: !record.is_printed });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, is_printed: !r.is_printed } : r
        )
      );
    } else {
      toast.error(result.error || '更新失敗');
    }
  }

  // Debounced note update to avoid excessive API calls
  const debouncedUpdateNote = useCallback((id: string, note: string) => {
    // Update local state immediately for responsive UI
    setLocalNotes((prev) => ({ ...prev, [id]: note }));

    // Clear existing timer for this ID
    if (noteTimersRef.current[id]) {
      clearTimeout(noteTimersRef.current[id]);
    }

    // Set new timer for debounced API call (500ms delay)
    noteTimersRef.current[id] = setTimeout(async () => {
      const result = await updateShopeeReturnStatus(id, { note });
      if (result.success) {
        setReturns((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, note } : r
          )
        );
        // Clear local note since it's now synced
        setLocalNotes((prev) => {
          const newNotes = { ...prev };
          delete newNotes[id];
          return newNotes;
        });
      }
      delete noteTimersRef.current[id];
    }, 500);
  }, []);

  // Get note value (prefer local state for responsiveness)
  const getNoteValue = useCallback((record: ShopeeReturn) => {
    return localNotes[record.id] !== undefined ? localNotes[record.id] : (record.note || '');
  }, [localNotes]);

  function toggleSelectAll() {
    if (selectedIds.size === paginatedReturns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedReturns.map((r) => r.id)));
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

  async function markSelectedAsProcessed(processed: boolean) {
    const ids = Array.from(selectedIds);
    const result = await batchUpdateShopeeReturns(ids, { is_processed: processed });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) ? { ...r, is_processed: processed } : r
        )
      );
      setSelectedIds(new Set());
      toast.success(`已將 ${ids.length} 筆標記為${processed ? '已處理' : '未處理'}`);
    } else {
      toast.error(result.error || '更新失敗');
    }
  }

  async function markSelectedAsPrinted(printed: boolean) {
    const ids = Array.from(selectedIds);
    const result = await batchUpdateShopeeReturns(ids, { is_printed: printed });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) ? { ...r, is_printed: printed } : r
        )
      );
      setSelectedIds(new Set());
      toast.success(`已將 ${ids.length} 筆標記為${printed ? '已列印' : '未列印'}`);
    } else {
      toast.error(result.error || '更新失敗');
    }
  }

  async function handleDeleteSelected() {
    if (!confirm(`確定要刪除選取的 ${selectedIds.size} 筆資料嗎？`)) return;

    const ids = Array.from(selectedIds);
    const result = await deleteShopeeReturns(ids);
    if (result.success) {
      setReturns((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      toast.success('已刪除選取的資料');
    } else {
      toast.error(result.error || '刪除失敗');
    }
  }

  function formatLabelDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const match = dateStr.match(/\d{1,2}[-/](\d{1,2})/);
      return match ? match[1] : '-';
    }
    return format(date, 'M/d');
  }

  async function handlePrint() {
    const selectedReturns = filteredReturns.filter((r) => selectedIds.has(r.id));
    const printData = selectedReturns.length > 0 ? selectedReturns : filteredReturns.filter((r) => !r.is_processed);

    if (printData.length === 0) {
      toast.error('沒有可列印的資料');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('無法開啟列印視窗，請允許彈出視窗');
      return;
    }

    const labels = printData.map((r) => ({
      orderNumber: r.order_number,
      trackingNumber: r.tracking_number || '',
      date: formatLabelDate(r.order_date),
      platform: r.platform || 'shopee',
    }));

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>退貨標籤 - ${format(new Date(), 'yyyy/MM/dd')}</title>
        <style>
          @page { size: A4; margin: 5mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Microsoft JhengHei', 'Arial', sans-serif; }
          .labels-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; padding: 5mm; }
          .label { border: 2px solid #000; display: grid; grid-template-columns: 2.5fr 1fr 1fr 1.5fr; height: 25mm; page-break-inside: avoid; }
          .label-cell { border-right: 2px solid #000; display: flex; align-items: center; justify-content: center; padding: 2mm; text-align: center; font-size: 11pt; font-weight: bold; overflow: hidden; word-break: break-all; }
          .label-cell:last-child { border-right: none; }
          .label-cell.order-info { flex-direction: column; font-size: 9pt; line-height: 1.3; gap: 1mm; }
          .label-cell.order-info .order-number { font-size: 10pt; }
          .label-cell.order-info .tracking-number { font-size: 9pt; color: #333; }
          .label-cell.platform { background: #fff; font-size: 12pt; }
          .label-cell.date { font-size: 12pt; }
          .label-cell.shipping { font-size: 10pt; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .labels-container { gap: 2mm; } }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labels.map((label) => `
            <div class="label">
              <div class="label-cell order-info">
                <div class="order-number">${label.orderNumber}</div>
                <div class="tracking-number">${label.trackingNumber}</div>
              </div>
              <div class="label-cell platform">${label.platform === 'mall' ? '商城' : '蝦皮'}</div>
              <div class="label-cell date">${label.date}</div>
              <div class="label-cell shipping">${label.platform === 'mall' ? '黑貓' : '蝦皮店到店'}</div>
            </div>
          `).join('')}
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    const printedIds = printData.map((r) => r.id);
    const result = await batchUpdateShopeeReturns(printedIds, { is_printed: true });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) =>
          printedIds.includes(r.id) ? { ...r, is_printed: true } : r
        )
      );
    }
  }

  const unprocessedCount = returns.filter((r) => !r.is_processed).length;
  const processedCount = returns.filter((r) => r.is_processed).length;
  const scannedCount = returns.filter((r) => r.is_scanned).length;
  const notScannedCount = returns.filter((r) => !r.is_scanned).length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - RWD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 md:w-7 md:h-7" />
            蝦皮退貨
          </h1>
          <p className="text-sm text-muted-foreground">匯入蝦皮退貨訂單並管理處理</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Hidden file inputs */}
          <input
            ref={shopeeFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e, 'shopee')}
            className="hidden"
          />
          <input
            ref={mallFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e, 'mall')}
            className="hidden"
          />
          {/* Shopee Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => shopeeFileRef.current?.click()}
            disabled={isImporting}
            className="border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            {isImporting && importPlatform === 'shopee' ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            蝦皮匯入
          </Button>
          {/* Mall Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mallFileRef.current?.click()}
            disabled={isImporting}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {isImporting && importPlatform === 'mall' ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            商城匯入
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            列印
          </Button>
        </div>
      </div>

      {/* Filters & Stats - RWD */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋訂單編號、寄件編號、商品名稱、貨號..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Stats & Filters Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">總計:</span>
                <Badge variant="secondary" className="text-xs">{returns.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">未處理:</span>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">{unprocessedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">已處理:</span>
                <Badge className="bg-green-100 text-green-800 text-xs">{processedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">已入庫:</span>
                <Badge className="bg-blue-100 text-blue-800 text-xs">{scannedCount}</Badge>
              </div>

              {/* Status Filter - moved here */}
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="unprocessed">未處理</SelectItem>
                  <SelectItem value="processed">已處理</SelectItem>
                </SelectContent>
              </Select>

              {/* Stock Filter */}
              <Select value={scanFilter} onValueChange={(v) => setScanFilter(v as typeof scanFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="scanned">已入庫</SelectItem>
                  <SelectItem value="not_scanned">未入庫</SelectItem>
                </SelectContent>
              </Select>

              {/* Print Filter */}
              <Select value={printFilter} onValueChange={(v) => setPrintFilter(v as typeof printFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Printer className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="printed">已列印</SelectItem>
                  <SelectItem value="not_printed">未列印</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">已選 {selectedIds.size} 筆：</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markSelectedAsProcessed(true)}>
                <Check className="w-3 h-3 mr-1" />
                已處理
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markSelectedAsProcessed(false)}>
                <X className="w-3 h-3 mr-1" />
                未處理
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={handleDeleteSelected}>
                <Trash2 className="w-3 h-3 mr-1" />
                刪除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table - RWD */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            退貨訂單列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              {returns.length === 0 ? (
                <div>
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>尚無資料</p>
                  <p className="text-sm mt-2">點擊「匯入」上傳蝦皮退貨訂單</p>
                </div>
              ) : (
                '找不到符合條件的資料'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] sticky left-0 bg-background">
                      <Checkbox
                        checked={selectedIds.size === paginatedReturns.length && paginatedReturns.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead
                      className="w-[60px] cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('is_scanned')}
                    >
                      <div className="flex items-center">
                        入庫
                        {getSortIcon('is_scanned')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[60px]">狀態</TableHead>
                    <TableHead className="w-[60px]">列印</TableHead>
                    <TableHead className="min-w-[120px]">訂單編號</TableHead>
                    <TableHead className="min-w-[100px]">退貨寄件編號</TableHead>
                    <TableHead className="w-[100px] hidden md:table-cell">爭議申請期限</TableHead>
                    <TableHead className="w-[90px] hidden md:table-cell text-center">買家退款金額</TableHead>
                    <TableHead className="hidden lg:table-cell">商品</TableHead>
                    <TableHead className="w-[80px] hidden lg:table-cell">貨號</TableHead>
                    <TableHead className="w-[50px] hidden lg:table-cell text-center">數量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReturns.map((record) => (
                    <React.Fragment key={record.id}>
                      <TableRow
                        className={record.is_processed ? 'bg-green-50' : record.is_scanned ? 'bg-blue-50/50' : ''}
                      >
                        <TableCell className="sticky left-0 bg-inherit" rowSpan={2}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={() => toggleSelect(record.id)}
                          />
                        </TableCell>
                        <TableCell rowSpan={2}>
                          {record.is_scanned ? (
                            <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1">
                              已入庫
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1">
                              未入庫
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell rowSpan={2}>
                          <button onClick={() => toggleProcessed(record.id)} className="flex items-center">
                            {record.is_processed ? (
                              <Badge className="bg-green-100 text-green-800 cursor-pointer text-[10px] px-1">
                                已處理
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="cursor-pointer text-yellow-700 border-yellow-300 text-[10px] px-1">
                                未處理
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell rowSpan={2}>
                          <button onClick={() => togglePrinted(record.id)} className="flex items-center">
                            {record.is_printed ? (
                              <Badge className="bg-purple-100 text-purple-800 cursor-pointer text-[10px] px-1">
                                已列印
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="cursor-pointer text-gray-500 border-gray-300 text-[10px] px-1">
                                未列印
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{record.order_number}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {record.tracking_number || '-'}
                        </TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{record.dispute_deadline || '-'}</TableCell>
                        <TableCell className="text-center text-xs hidden md:table-cell">
                          {record.refund_amount ? `$${record.refund_amount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="max-w-[150px] truncate text-xs" title={record.product_name || ''}>
                            {record.product_name || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden lg:table-cell">{record.option_sku || '-'}</TableCell>
                        <TableCell className="text-center text-xs hidden lg:table-cell">{record.return_quantity}</TableCell>
                      </TableRow>
                      <TableRow
                        className={`border-b-2 ${record.is_processed ? 'bg-green-50' : record.is_scanned ? 'bg-blue-50/50' : ''}`}
                      >
                        <TableCell colSpan={7} className="py-1">
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-foreground">退貨原因:</span>
                              <span>{record.return_reason || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-foreground">買家備註:</span>
                              <span>{record.buyer_note || '-'}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredReturns.length)} 筆，共 {filteredReturns.length} 筆
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
