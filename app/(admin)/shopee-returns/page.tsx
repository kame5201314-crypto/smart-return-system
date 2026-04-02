'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Upload,
  Download,
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
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Palette,
  Circle,
  Calendar,
  Store,
  Plus,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  getShopeeReturns,
  importShopeeReturns,
  createShopeeReturn,
  updateShopeeReturnStatus,
  batchUpdateShopeeReturns,
  deleteShopeeReturns,
  type ShopeeReturn,
  type ShopeeReturnInput,
  type ColorTag,
} from '@/lib/actions/shopee-returns.actions';
import {
  buildShopeeReturnGroups,
  type ShopeeReturnGroup,
} from '@/lib/utils/shopee-return-grouping';

// Color tag options
const COLOR_TAG_OPTIONS: { value: ColorTag; label: string; color: string }[] = [
  { value: 'yellow', label: '\u6aa2\u9a57\u4e2d', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'red', label: '\u722d\u8b70\u4e2d', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'purple', label: '\u5b89\u6392\u6536\u4ef6', color: 'bg-purple-100 text-purple-800 border-purple-300' },
];

type ImportColumnKey = keyof ShopeeReturnInput | 'returnRefundStatus' | 'returnRefundScheme';

const EXCLUDED_RETURN_REFUND_STATUSES = new Set([
  '\u7533\u8acb\u5df2\u53d6\u6d88', // cancelled request
  '\u722d\u8b70\u5df2\u64a4\u56de', // withdrawn dispute
]);

const EXCLUDED_RETURN_REFUND_SCHEMES = new Set([
  '\u50c5\u9000\u6b3e', // refund only
]);

const AUTO_PICKUP_SHIPPING_METHOD = '\u5b89\u6392\u6536\u4ef6'; // auto pickup

function normalizeImportRuleValue(value: string): string {
  return value.replace(/\s+/g, '');
}

// Column mappings for Shopee export file
const COLUMN_MAPPINGS: Record<string, ImportColumnKey> = {
  '\u8a02\u55ae\u7de8\u865f': 'orderNumber',
  '\u8766\u76ae\u8a02\u55ae\u7de8\u865f': 'orderNumber',
  '\u8a02\u55ae\u865f\u78bc': 'orderNumber',
  '\u8a02\u55ae\u65e5\u671f': 'orderDate',
  '\u8a02\u55ae\u5efa\u7acb\u65e5\u671f': 'orderDate',
  '\u8a02\u55ae\u6210\u7acb\u65e5\u671f': 'orderDate',
  '\u5546\u54c1\u539f\u50f9': 'totalPrice',
  '\u5546\u54c1\u7e3d\u50f9': 'totalPrice',
  '\u8cb7\u5bb6\u539f\u59cb\u8a02\u55ae\u91d1\u984d': 'totalPrice',
  '\u5546\u54c1\u540d\u7a31': 'productName',
  '\u8ce3\u5834\u5546\u54c1\u540d\u7a31': 'productName',
  '\u5546\u54c1\u898f\u683c': 'optionName',
  '\u5546\u54c1\u898f\u683c\u540d\u7a31': 'optionName',
  '\u5546\u54c1\u9078\u9805\u540d\u7a31': 'optionName',
  '\u5546\u54c1\u6d3b\u52d5\u50f9\u683c': 'activityPrice',
  '\u6d3b\u52d5\u50f9\u683c': 'activityPrice',
  '\u6298\u6263\u5f8c\u91d1\u984d': 'activityPrice',
  '\u5546\u54c1\u9078\u9805\u8ca8\u865f': 'optionSku',
  '\u5546\u54c1\u9078\u9805\u8cc7\u865f': 'optionSku',
  '\u5546\u54c1\u8ca8\u865f': 'optionSku',
  '\u8ce3\u5bb6SKU': 'optionSku',
  '\u5546\u54c1\u8ca8\u865f(\u8ce3\u5bb6SKU)': 'optionSku',
  'SKU': 'optionSku',
  '\u8ca8\u865f': 'optionSku',
  '\u9000\u8ca8\u6578\u91cf': 'returnQuantity',
  '\u6578\u91cf': 'returnQuantity',
  '\u5546\u54c1\u6578\u91cf': 'returnQuantity',
  '\u7269\u6d41\u55ae\u865f': 'trackingNumber',
  '\u904b\u55ae\u7de8\u865f': 'trackingNumber',
  '\u5305\u88f9\u67e5\u8a62\u865f\u78bc': 'trackingNumber',
  '\u5bc4\u4ef6\u7de8\u865f': 'trackingNumber',
  '\u9006\u7269\u6d41\u55ae\u865f': 'trackingNumber',
  '\u9000\u8ca8\u5bc4\u4ef6\u7de8\u865f': 'trackingNumber',
  '\u722d\u8b70\u7533\u8acb\u671f\u9650': 'disputeDeadline',
  '\u8cb7\u5bb6\u9000\u6b3e\u91d1\u984d': 'refundAmount',
  '\u9000\u8ca8\u539f\u56e0': 'returnReason',
  '\u8cb7\u5bb6\u9000\u8ca8\u539f\u56e0\u8aaa\u660e': 'buyerNote',
  '\u8cb7\u5bb6\u5099\u8a3b': 'buyerNote',
  '\u9000\u8ca8\u904b\u9001\u65b9\u5f0f': 'shippingMethod',
  '\u9000\u8ca8 / \u9000\u6b3e\u72c0\u614b': 'returnRefundStatus',
  '\u9000\u8ca8/\u9000\u6b3e\u72c0\u614b': 'returnRefundStatus',
  '\u9000\u8ca8\u9000\u6b3e\u72c0\u614b': 'returnRefundStatus',
  '\u9000\u8ca8 / \u9000\u6b3e\u65b9\u6848': 'returnRefundScheme',
  '\u9000\u8ca8/\u9000\u6b3e\u65b9\u6848': 'returnRefundScheme',
  '\u9000\u8ca8\u9000\u6b3e\u65b9\u6848': 'returnRefundScheme',
};

type SortField = 'order_date' | 'is_processed' | 'is_scanned' | null;
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

export default function ShopeeReturnsPage() {
  const [returns, setReturns] = useState<ShopeeReturn[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ShopeeReturn[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [inboundFilter, setInboundFilter] = useState<'all' | 'inbound' | 'not_inbound'>('all');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'not_printed'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'shopee' | 'mall'>('all');
  const [shippingMethodFilter, setShippingMethodFilter] = useState<string>('all');
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
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({
    orderNumber: '',
    platform: 'shopee' as 'shopee' | 'mall',
    trackingNumber: '',
    orderDate: '',
    disputeDeadline: '',
    refundAmount: '',
    productName: '',
    optionSku: '',
    returnQuantity: '1',
    returnReason: '',
    buyerNote: '',
    shippingMethod: '',
    note: '',
  });

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

  // Load from database
  useEffect(() => {
    // Data fetch on mount is a valid useEffect use-case; this rule is too strict here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReturns();
  }, []);

  // Filter and sort returns
  useEffect(() => {
    let filtered = [...returns];

    // Status filter
    if (statusFilter === 'processed') {
      filtered = filtered.filter((r) => r.is_processed);
    } else if (statusFilter === 'unprocessed') {
      filtered = filtered.filter((r) => !r.is_processed);
    }

    // Inbound filter
    if (inboundFilter === 'inbound') {
      filtered = filtered.filter((r) => !!r.is_inbound);
    } else if (inboundFilter === 'not_inbound') {
      filtered = filtered.filter((r) => !r.is_inbound);
    }

    // Print filter
    if (printFilter === 'printed') {
      filtered = filtered.filter((r) => r.is_printed);
    } else if (printFilter === 'not_printed') {
      filtered = filtered.filter((r) => !r.is_printed);
    }

    // Platform filter
    if (platformFilter === 'shopee') {
      filtered = filtered.filter((r) => r.platform === 'shopee' || !r.platform);
    } else if (platformFilter === 'mall') {
      filtered = filtered.filter((r) => r.platform === 'mall');
    }

    if (shippingMethodFilter !== 'all') {
      filtered = filtered.filter(
        (r) => (r.shipping_method || AUTO_PICKUP_SHIPPING_METHOD) === shippingMethodFilter
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.order_number.toLowerCase().includes(query) ||
          (r.tracking_number?.toLowerCase().includes(query) ?? false) ||
          (r.shipping_method?.toLowerCase().includes(query) ?? false) ||
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

    // Derived state; keep behavior but silence overly-strict lint rule for this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredReturns(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [
    returns,
    searchQuery,
    statusFilter,
    inboundFilter,
    printFilter,
    platformFilter,
    shippingMethodFilter,
    sortField,
    sortDirection,
  ]);

  const groupedReturns = useMemo(() => buildShopeeReturnGroups(returns), [returns]);
  const groupedFilteredReturns = useMemo(
    () => buildShopeeReturnGroups(filteredReturns),
    [filteredReturns]
  );

  // Calculate pagination by grouped order rows
  const totalPages = Math.ceil(groupedFilteredReturns.length / ITEMS_PER_PAGE);
  const paginatedGroups = groupedFilteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const paginatedGroupItemIds = paginatedGroups.flatMap((group) => group.itemIds);
  const isAllPaginatedSelected =
    paginatedGroupItemIds.length > 0 && paginatedGroupItemIds.every((id) => selectedIds.has(id));
  const selectedGroupCount = groupedFilteredReturns.filter((group) =>
    group.itemIds.every((id) => selectedIds.has(id))
  ).length;

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
        toast.error('請匯入蝦皮退貨檔，檔名需包含「蝦皮」或 shopee');
        e.target.value = '';
        return;
      }
      if (fileName.includes('商城') || fileName.includes('mall')) {
        toast.error('這份檔案看起來是商城資料，請改用「商城匯入」');
        e.target.value = '';
        return;
      }
    } else if (platform === 'mall') {
      if (!fileName.includes('商城') && !fileName.includes('mall')) {
        toast.error('請匯入商城退貨檔，檔名需包含「商城」或 mall');
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
        toast.error('Excel 內容格式不正確');
        setIsImporting(false);
        return;
      }

      // Get headers from first row
      const headerRow = worksheet.getRow(1);
      const headers: unknown[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value;
      });

      const columnIndices: Partial<Record<ImportColumnKey, number>> = {};
      const foundHeaders: string[] = [];

      headers.forEach((header, index) => {
        const cleanHeader = header?.toString().trim();
        if (cleanHeader) {
          foundHeaders.push(cleanHeader);
          const normalizedHeader = cleanHeader.replace(/\s+/g, '');
          const mappedKey = COLUMN_MAPPINGS[cleanHeader] ?? COLUMN_MAPPINGS[normalizedHeader];
          if (mappedKey) {
            if (columnIndices[mappedKey] === undefined) {
              columnIndices[mappedKey] = index;
            }
          }
        }
      });

      if (columnIndices.orderNumber === undefined) {
        const orderColIndex = headers.findIndex((h) => {
          const str = h?.toString() || '';
          return str.includes('訂單') || str.includes('編號');
        });
        if (orderColIndex >= 0) {
          columnIndices.orderNumber = orderColIndex;
        } else if (headers.length > 0) {
          columnIndices.orderNumber = 0;
        }
      }

      const newItems: ShopeeReturnInput[] = [];
      let skippedByBusinessRules = 0;
      let autoPickupCount = 0;

      // Process data rows (starting from row 2)
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowValues: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });

        if (rowValues.length === 0) return;

        let orderNumber = '';
        const orderColIdx = columnIndices.orderNumber;
        const orderVal = orderColIdx === undefined ? undefined : rowValues[orderColIdx];
        if (orderVal !== undefined && orderVal !== null && orderVal !== '') {
          orderNumber = String(orderVal).trim();
        }

        if (!orderNumber) return;

        const getCellValue = (key: ImportColumnKey): string => {
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

        const getCellNumber = (key: ImportColumnKey, defaultVal: number = 0): number => {
          const idx = columnIndices[key];
          if (idx === undefined) return defaultVal;
          const val = rowValues[idx];
          if (val === undefined || val === null) return defaultVal;
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? defaultVal : num;
        };

        const returnRefundStatus = normalizeImportRuleValue(getCellValue('returnRefundStatus'));
        const returnRefundScheme = normalizeImportRuleValue(getCellValue('returnRefundScheme'));
        const shouldSkipByStatus = EXCLUDED_RETURN_REFUND_STATUSES.has(returnRefundStatus);
        const shouldSkipByScheme = EXCLUDED_RETURN_REFUND_SCHEMES.has(returnRefundScheme);
        if (shouldSkipByStatus || shouldSkipByScheme) {
          skippedByBusinessRules++;
          return;
        }

        const shippingMethodRaw = getCellValue('shippingMethod');
        const shippingMethod = shippingMethodRaw || AUTO_PICKUP_SHIPPING_METHOD;
        if (!shippingMethodRaw) {
          autoPickupCount++;
        }

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
          shippingMethod,
        });
      });

      if (newItems.length > 0) {
        const platformLabel = platform === 'shopee' ? '蝦皮' : '商城';
        const result = await importShopeeReturns(newItems, platform);
        if (result.success && result.data) {
          const { imported, duplicates } = result.data;
          if (imported > 0) {
            const skippedInfo = skippedByBusinessRules > 0 ? `，略過 ${skippedByBusinessRules} 筆不符合規則資料` : '';
            const autoPickupInfo = autoPickupCount > 0 ? `，其中 ${autoPickupCount} 筆已自動補為「${AUTO_PICKUP_SHIPPING_METHOD}」` : '';
            toast.success(`成功匯入 ${imported} 筆${platformLabel}退貨資料${duplicates > 0 ? `，略過 ${duplicates} 筆重複資料` : ''}${skippedInfo}${autoPickupInfo}`);
            loadReturns();
          } else if (duplicates > 0) {
            toast.info(`共有 ${duplicates} 筆資料因重複而未匯入`);
          } else if (skippedByBusinessRules > 0) {
            toast.info(`本次資料全部被略過，共 ${skippedByBusinessRules} 筆不符合規則`);
          }
        } else {
          toast.error(result.error || '匯入失敗');
        }
      } else {
        toast.error(`找不到可匯入的欄位，已辨識欄位：${foundHeaders.slice(0, 5).join(', ')}${foundHeaders.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('password') || errorMsg.includes('encrypt')) {
        toast.error('Excel 檔案似乎有保護或加密，請先解除後再匯入');
      } else {
        toast.error('匯入失敗，請檢查 Excel 內容後再試一次');
      }
    }

    setIsImporting(false);
    // Clear both file inputs
    if (shopeeFileRef.current) shopeeFileRef.current.value = '';
    if (mallFileRef.current) mallFileRef.current.value = '';
  }

  async function updateGroupRows(
    ids: string[],
    updates: Parameters<typeof updateShopeeReturnStatus>[1]
  ) {
    const results = await Promise.all(ids.map((id) => updateShopeeReturnStatus(id, updates)));
    const failed = results.find((result) => !result.success);
    if (failed) {
      toast.error(failed.error || '\u66f4\u65b0\u5931\u6557');
      return false;
    }

    setReturns((prev) =>
      prev.map((record) => (ids.includes(record.id) ? { ...record, ...updates } : record))
    );
    return true;
  }

  async function toggleProcessed(group: ShopeeReturnGroup) {
    const nextProcessed = !group.isProcessed;
    const result = await batchUpdateShopeeReturns(group.itemIds, { is_processed: nextProcessed });
    if (result.success) {
      setReturns((prev) =>
        prev.map((record) =>
          group.itemIds.includes(record.id) ? { ...record, is_processed: nextProcessed } : record
        )
      );
    } else {
      toast.error(result.error || '\u66f4\u65b0\u5931\u6557');
    }
  }

  async function togglePrinted(group: ShopeeReturnGroup) {
    const nextPrinted = !group.isPrinted;
    const result = await batchUpdateShopeeReturns(group.itemIds, { is_printed: nextPrinted });
    if (result.success) {
      setReturns((prev) =>
        prev.map((record) =>
          group.itemIds.includes(record.id) ? { ...record, is_printed: nextPrinted } : record
        )
      );
    } else {
      toast.error(result.error || '\u66f4\u65b0\u5931\u6557');
    }
  }

  async function toggleInbound(group: ShopeeReturnGroup) {
    const nextInbound = !group.isInbound;
    const now = new Date().toISOString();
    await updateGroupRows(group.itemIds, {
      is_inbound: nextInbound,
      inbound_at: nextInbound ? now : null,
    });
  }

  async function updateProcessedDate(group: ShopeeReturnGroup, processedAt: string | null) {
    await updateGroupRows(group.itemIds, { processed_at: processedAt });
  }

  const clearLocalNote = useCallback((groupKey: string) => {
    setLocalNotes((prev) => {
      if (prev[groupKey] === undefined) return prev;
      const newNotes = { ...prev };
      delete newNotes[groupKey];
      return newNotes;
    });
  }, []);

  const syncNote = useCallback(async (
    group: ShopeeReturnGroup,
    note: string,
    options?: { clearLocalOnSuccess?: boolean }
  ) => {
    const results = await Promise.all(
      group.itemIds.map((id) => updateShopeeReturnStatus(id, { note }))
    );
    const failed = results.find((result) => !result.success);
    if (!failed) {
      setReturns((prev) =>
        prev.map((record) =>
          group.itemIds.includes(record.id) ? { ...record, note } : record
        )
      );
      if (options?.clearLocalOnSuccess) {
        clearLocalNote(group.groupKey);
      }
    } else {
      toast.error(failed.error || '\u5099\u8a3b\u66f4\u65b0\u5931\u6557');
    }
  }, [clearLocalNote]);

  const debouncedUpdateNote = useCallback((groupKey: string, note: string) => {
    setLocalNotes((prev) => ({ ...prev, [groupKey]: note }));

    if (noteTimersRef.current[groupKey]) {
      clearTimeout(noteTimersRef.current[groupKey]);
    }

    noteTimersRef.current[groupKey] = setTimeout(() => {
      delete noteTimersRef.current[groupKey];
    }, 500);
  }, []);

  const flushNoteUpdate = useCallback((group: ShopeeReturnGroup, note: string) => {
    if (noteTimersRef.current[group.groupKey]) {
      clearTimeout(noteTimersRef.current[group.groupKey]);
      delete noteTimersRef.current[group.groupKey];
    }
    const currentNote = group.note;
    if (note === currentNote) {
      clearLocalNote(group.groupKey);
      return;
    }
    void syncNote(group, note, { clearLocalOnSuccess: true });
  }, [clearLocalNote, syncNote]);

  const getNoteValue = useCallback((group: ShopeeReturnGroup) => {
    return localNotes[group.groupKey] !== undefined ? localNotes[group.groupKey] : group.note;
  }, [localNotes]);

  useEffect(() => {
    return () => {
      Object.values(noteTimersRef.current).forEach((timer) => clearTimeout(timer));
      noteTimersRef.current = {};
    };
  }, []);

  function toggleSelectAll() {
    const newSelected = new Set(selectedIds);
    if (isAllPaginatedSelected) {
      paginatedGroupItemIds.forEach((id) => newSelected.delete(id));
    } else {
      paginatedGroupItemIds.forEach((id) => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  }

  function toggleSelect(group: ShopeeReturnGroup) {
    const newSelected = new Set(selectedIds);
    const isSelected = group.itemIds.every((id) => newSelected.has(id));
    if (isSelected) {
      group.itemIds.forEach((id) => newSelected.delete(id));
    } else {
      group.itemIds.forEach((id) => newSelected.add(id));
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
      toast.success(`已更新 ${ids.length} 筆商品為${processed ? '已處理' : '未處理'}`);
    } else {
      toast.error(result.error || '更新處理狀態失敗');
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
      toast.success(`已更新 ${ids.length} 筆商品為${printed ? '已列印' : '未列印'}`);
    } else {
      toast.error(result.error || '更新列印狀態失敗');
    }
  }

  async function handleDeleteSelected() {
    if (!confirm(`確定要刪除這 ${selectedIds.size} 筆商品資料嗎？`)) return;

    const ids = Array.from(selectedIds);
    const result = await deleteShopeeReturns(ids);
    if (result.success) {
      setReturns((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      toast.success('已刪除選取資料');
    } else {
      toast.error(result.error || '刪除失敗');
    }
  }

  async function handleColorTag(colorTag: ColorTag) {
    const ids = Array.from(selectedIds);
    const result = await batchUpdateShopeeReturns(ids, { color_tag: colorTag });
    if (result.success) {
      setReturns((prev) =>
        prev.map((r) => (selectedIds.has(r.id) ? { ...r, color_tag: colorTag } : r))
      );
      setSelectedIds(new Set());
      toast.success(colorTag ? `已套用顏色標記：${COLOR_TAG_OPTIONS.find((o) => o.value === colorTag)?.label}` : '已清除顏色標記');
    } else {
      toast.error(result.error || '顏色標記更新失敗');
    }
  }

  async function handleManualSubmit() {
    if (!manualForm.orderNumber.trim()) {
      toast.error('請輸入訂單編號');
      return;
    }
    setIsManualSubmitting(true);
    try {
      const result = await createShopeeReturn({
        orderNumber: manualForm.orderNumber,
        platform: manualForm.platform,
        trackingNumber: manualForm.trackingNumber || undefined,
        orderDate: manualForm.orderDate || undefined,
        disputeDeadline: manualForm.disputeDeadline || undefined,
        refundAmount: manualForm.refundAmount ? parseFloat(manualForm.refundAmount) : undefined,
        productName: manualForm.productName || undefined,
        optionSku: manualForm.optionSku || undefined,
        returnQuantity: manualForm.returnQuantity ? parseInt(manualForm.returnQuantity) : 1,
        returnReason: manualForm.returnReason || undefined,
        buyerNote: manualForm.buyerNote || undefined,
        shippingMethod: manualForm.shippingMethod || undefined,
        note: manualForm.note || undefined,
      });
      if (result.success) {
        toast.success('手動新增成功');
        setManualDialogOpen(false);
        setManualForm({
          orderNumber: '', platform: 'shopee', trackingNumber: '', orderDate: '',
          disputeDeadline: '', refundAmount: '', productName: '', optionSku: '',
          returnQuantity: '1', returnReason: '', buyerNote: '', shippingMethod: '', note: '',
        });
        loadReturns();
      } else {
        toast.error(result.error || '新增失敗');
      }
    } catch {
      toast.error('新增失敗');
    }
    setIsManualSubmitting(false);
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
      toast.error('\u6c92\u6709\u53ef\u5217\u5370\u7684\u8cc7\u6599');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('\u7121\u6cd5\u958b\u555f\u5217\u5370\u8996\u7a97\uff0c\u8acb\u78ba\u8a8d\u700f\u89bd\u5668\u5141\u8a31\u5f48\u51fa\u8996\u7a97');
      return;
    }

    const labels = printData.map((r) => {
      // Determine shipping display: directly use shipping_method field value
      const shippingDisplay = r.shipping_method || AUTO_PICKUP_SHIPPING_METHOD;

      return {
        orderNumber: r.order_number,
        trackingNumber: r.tracking_number || '',
        date: formatLabelDate(r.dispute_deadline),
        platform: r.platform || 'shopee',
        shippingDisplay,
      };
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>\u8766\u76ae\u9000\u8ca8\u6a19\u7c64 - ${format(new Date(), 'yyyy/MM/dd')}</title>
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
              <div class=\"label-cell platform\">${label.platform === 'mall' ? '\u5546\u57ce' : '\u8766\u76ae'}</div>
              <div class="label-cell date">${label.date}</div>
              <div class="label-cell shipping">${label.shippingDisplay}</div>
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

  const unprocessedCount = groupedReturns.filter((group) => !group.isProcessed).length;
  const processedCount = groupedReturns.filter((group) => group.isProcessed).length;
  const scannedCount = groupedReturns.filter((group) => group.isScanned).length;
  const notScannedCount = groupedReturns.filter((group) => !group.isScanned).length;
  const inboundCount = groupedReturns.filter((group) => group.isInbound).length;
  const notInboundCount = groupedReturns.filter((group) => !group.isInbound).length;
  const shippingMethodOptions = Array.from(
    new Set(
      returns
        .map((r) => (r.shipping_method || AUTO_PICKUP_SHIPPING_METHOD).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - RWD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 md:w-7 md:h-7" />
            {'\u8766\u76ae\u9000\u8ca8'}
          </h1>
          <p className="text-sm text-muted-foreground">{'\u532f\u5165\u8766\u76ae\u9000\u8ca8\u8a02\u55ae\u4e26\u7ba1\u7406\u9000\u8ca8\u8655\u7406'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            {'\u8766\u76ae\u532f\u5165'}
          </Button>
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
            {'\u5546\u57ce\u532f\u5165'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManualDialogOpen(true)}
            className="border-green-300 text-green-600 hover:bg-green-50"
          >
            <Plus className="w-4 h-4 mr-1" />
            {'\u624b\u52d5\u65b0\u589e'}
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
          >
            <Link href="/shopee-returns/scan">
              <ScanLine className="w-4 h-4 mr-1" />
              {'\u6383\u63cf\u5de5\u5177'}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            <a href="/api/v1/admin/shopee-returns/export" target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 mr-1" />
              {'\u532f\u51fa'}
            </a>
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            {'\u5217\u5370'}
          </Button>
        </div>
      </div>

      {/* Filters & Stats - RWD */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={'\u641c\u5c0b\u8a02\u55ae\u7de8\u865f\u3001\u5bc4\u4ef6\u7de8\u865f\u3001\u5546\u54c1\u540d\u7a31\u3001\u8ca8\u865f...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u7e3d\u8a08:'}</span>
                <Badge variant="secondary" className="text-xs">{groupedReturns.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u672a\u8655\u7406:'}</span>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">{unprocessedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u5df2\u8655\u7406:'}</span>
                <Badge className="bg-green-100 text-green-800 text-xs">{processedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u5df2\u6383\u63cf:'}</span>
                <Badge className="bg-blue-100 text-blue-800 text-xs">{scannedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u672a\u6383\u63cf:'}</span>
                <Badge variant="outline" className="text-xs">{notScannedCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u5df2\u5165\u5eab:'}</span>
                <Badge className="bg-cyan-100 text-cyan-800 text-xs">{inboundCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{'\u672a\u5165\u5eab:'}</span>
                <Badge variant="outline" className="text-xs">{notInboundCount}</Badge>
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'\u5168\u90e8'}</SelectItem>
                  <SelectItem value="unprocessed">{'\u672a\u8655\u7406'}</SelectItem>
                  <SelectItem value="processed">{'\u5df2\u8655\u7406'}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={inboundFilter} onValueChange={(v) => setInboundFilter(v as typeof inboundFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'\u5168\u90e8'}</SelectItem>
                  <SelectItem value="inbound">{'\u5df2\u5165\u5eab'}</SelectItem>
                  <SelectItem value="not_inbound">{'\u672a\u5165\u5eab'}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={printFilter} onValueChange={(v) => setPrintFilter(v as typeof printFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Printer className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'\u5168\u90e8'}</SelectItem>
                  <SelectItem value="printed">{'\u5df2\u5217\u5370'}</SelectItem>
                  <SelectItem value="not_printed">{'\u672a\u5217\u5370'}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as typeof platformFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <Store className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'\u5168\u90e8'}</SelectItem>
                  <SelectItem value="shopee">{'\u8766\u76ae'}</SelectItem>
                  <SelectItem value="mall">{'\u5546\u57ce'}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={shippingMethodFilter} onValueChange={setShippingMethodFilter}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <Truck className="w-3 h-3 mr-1" />
                  <SelectValue placeholder={'\u9000\u8ca8\u904b\u9001\u65b9\u5f0f'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{'\u5168\u90e8\u904b\u9001\u65b9\u5f0f'}</SelectItem>
                  {shippingMethodOptions.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {`\u5df2\u9078 ${selectedGroupCount} \u55ae / ${selectedIds.size} \u7b46\u5546\u54c1`}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markSelectedAsProcessed(true)}>
                  <Check className="w-3 h-3 mr-1" />
                  {'\u5df2\u8655\u7406'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markSelectedAsProcessed(false)}>
                  <X className="w-3 h-3 mr-1" />
                  {'\u672a\u8655\u7406'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={handleDeleteSelected}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  {'\u522a\u9664'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Palette className="w-3 h-3 mr-1" />
                      {'\u984f\u8272\u6a19\u8a18'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleColorTag('yellow')} className="text-xs">
                      <Circle className="w-3 h-3 mr-2 fill-yellow-400 text-yellow-400" />
                      {'\u6aa2\u9a57\u4e2d'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleColorTag('red')} className="text-xs">
                      <Circle className="w-3 h-3 mr-2 fill-red-400 text-red-400" />
                      {'\u722d\u8b70\u4e2d'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleColorTag('purple')} className="text-xs">
                      <Circle className="w-3 h-3 mr-2 fill-purple-400 text-purple-400" />
                      {'\u5b89\u6392\u6536\u4ef6'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleColorTag(null)} className="text-xs text-muted-foreground">
                      <X className="w-3 h-3 mr-2" />
                      {'\u53d6\u6d88\u6a19\u8a18'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table - RWD */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {'\u9000\u8ca8\u8a02\u55ae\u5217\u8868'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : groupedFilteredReturns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              {returns.length === 0 ? (
                <div>
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{'\u5c1a\u7121\u9000\u8ca8\u8cc7\u6599'}</p>
                  <p className="text-sm mt-2">{'\u4f60\u53ef\u4ee5\u5148\u4f7f\u7528\u4e0a\u65b9\u532f\u5165\u529f\u80fd\uff0c\u6216\u624b\u52d5\u65b0\u589e\u4e00\u7b46\u9000\u8ca8\u8a02\u55ae\u3002'}</p>
                </div>
              ) : (
                '\u76ee\u524d\u7be9\u9078\u689d\u4ef6\u4e0b\u6c92\u6709\u7b26\u5408\u7684\u8cc7\u6599'
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] sticky left-0 bg-background">
                      <Checkbox checked={isAllPaginatedSelected} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead className="w-[110px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {'\u8655\u7406\u65e5\u671f'}
                      </div>
                    </TableHead>
                    <TableHead className="w-[70px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('is_scanned')}>
                      <div className="flex items-center">
                        {'\u6383\u63cf'}
                        {getSortIcon('is_scanned')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[60px]">{'\u5165\u5eab'}</TableHead>
                    <TableHead className="w-[60px]">{'\u72c0\u614b'}</TableHead>
                    <TableHead className="w-[60px]">{'\u5217\u5370'}</TableHead>
                    <TableHead className="w-[50px]">{'\u5e73\u53f0'}</TableHead>
                    <TableHead className="min-w-[120px]">{'\u8a02\u55ae\u7de8\u865f'}</TableHead>
                    <TableHead className="min-w-[120px]">{'\u9000\u8ca8\u904b\u9001\u65b9\u5f0f'}</TableHead>
                    <TableHead className="min-w-[100px]">{'\u9000\u8ca8\u5bc4\u4ef6\u7de8\u865f'}</TableHead>
                    <TableHead className="w-[100px] hidden md:table-cell">{'\u722d\u8b70\u7533\u8acb\u671f\u9650'}</TableHead>
                    <TableHead className="min-w-[150px]">{'\u5099\u8a3b'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGroups.map((group) => (
                    <TableRow
                      key={group.primaryId}
                      className={
                        group.colorTag === 'yellow' ? 'bg-yellow-50 border-l-4 border-l-yellow-400' :
                        group.colorTag === 'red' ? 'bg-red-50 border-l-4 border-l-red-400' :
                        group.colorTag === 'purple' ? 'bg-purple-50 border-l-4 border-l-purple-300' :
                        group.isProcessed ? 'bg-green-50' :
                        group.isInbound ? 'bg-blue-50/50' : ''
                      }
                    >
                      <TableCell className="sticky left-0 bg-inherit">
                        <Checkbox
                          checked={group.itemIds.every((id) => selectedIds.has(id))}
                          onCheckedChange={() => toggleSelect(group)}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="date"
                          className="text-xs border rounded px-1 py-1 w-full max-w-[110px] cursor-pointer"
                          defaultValue={group.processedAt ? group.processedAt.slice(0, 10) : ''}
                          onChange={async (e) => {
                            const newDate = e.target.value || null;
                            await updateProcessedDate(group, newDate);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {group.isScanned ? (
                          <Badge className="bg-indigo-100 text-indigo-800 text-[10px] px-1">{'\u5df2\u6383\u63cf'}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1">{'\u672a\u6383\u63cf'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => toggleInbound(group)} className="flex items-center">
                          {group.isInbound ? (
                            <Badge className="bg-blue-100 text-blue-800 cursor-pointer text-[10px] px-1">{'\u5df2\u5165\u5eab'}</Badge>
                          ) : (
                            <Badge variant="outline" className="cursor-pointer text-gray-500 border-gray-300 text-[10px] px-1">{'\u672a\u5165\u5eab'}</Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => toggleProcessed(group)} className="flex items-center">
                          {group.isProcessed ? (
                            <Badge className="bg-green-100 text-green-800 cursor-pointer text-[10px] px-1">{'\u5df2\u8655\u7406'}</Badge>
                          ) : (
                            <Badge variant="outline" className="cursor-pointer text-yellow-700 border-yellow-300 text-[10px] px-1">{'\u672a\u8655\u7406'}</Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => togglePrinted(group)} className="flex items-center">
                          {group.isPrinted ? (
                            <Badge className="bg-purple-100 text-purple-800 cursor-pointer text-[10px] px-1">{'\u5df2\u5217\u5370'}</Badge>
                          ) : (
                            <Badge variant="outline" className="cursor-pointer text-gray-500 border-gray-300 text-[10px] px-1">{'\u672a\u5217\u5370'}</Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-center">{group.platform === 'mall' ? '\u5546\u57ce' : '\u8766\u76ae'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/shopee-returns/${group.primaryId}`} className="underline underline-offset-2 hover:text-primary">
                          {group.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{group.shippingMethod || AUTO_PICKUP_SHIPPING_METHOD}</TableCell>
                      <TableCell className="font-mono text-xs">{group.trackingNumber || '-'}</TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{group.disputeDeadline || '-'}</TableCell>
                      <TableCell>
                        <div className="relative group/note">
                          <Input
                            placeholder={'\u8f38\u5165\u5099\u8a3b...'}
                            value={getNoteValue(group)}
                            className="text-xs h-8 min-w-[120px]"
                            onChange={(e) => debouncedUpdateNote(group.groupKey, e.target.value)}
                            onBlur={(e) => flushNoteUpdate(group, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                          />
                          {getNoteValue(group) && getNoteValue(group).length > 10 && (
                            <div className="invisible group-hover/note:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-[300px] whitespace-pre-wrap break-words pointer-events-none">
                              {getNoteValue(group)}
                              <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    {`\u986f\u793a\u7b2c ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, groupedFilteredReturns.length)} \u55ae\uff0c\u5171 ${groupedFilteredReturns.length} \u55ae`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
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
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>手動新增退貨</DialogTitle>
            <DialogDescription>手動輸入退貨訂單資料</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>平台 *</Label>
                <Select value={manualForm.platform} onValueChange={(v) => setManualForm((f) => ({ ...f, platform: v as 'shopee' | 'mall' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopee">蝦皮</SelectItem>
                    <SelectItem value="mall">商城</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>訂單編號 *</Label>
                <Input value={manualForm.orderNumber} onChange={(e) => setManualForm((f) => ({ ...f, orderNumber: e.target.value }))} placeholder="輸入訂單編號" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>退貨寄件編號</Label>
                <Input value={manualForm.trackingNumber} onChange={(e) => setManualForm((f) => ({ ...f, trackingNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>退貨運送方式</Label>
                <Input value={manualForm.shippingMethod} onChange={(e) => setManualForm((f) => ({ ...f, shippingMethod: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>訂單日期</Label>
                <Input type="date" value={manualForm.orderDate} onChange={(e) => setManualForm((f) => ({ ...f, orderDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>爭議申請期限</Label>
                <Input type="date" value={manualForm.disputeDeadline} onChange={(e) => setManualForm((f) => ({ ...f, disputeDeadline: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>買家退款金額</Label>
                <Input type="number" value={manualForm.refundAmount} onChange={(e) => setManualForm((f) => ({ ...f, refundAmount: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>數量</Label>
                <Input type="number" min="1" value={manualForm.returnQuantity} onChange={(e) => setManualForm((f) => ({ ...f, returnQuantity: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>商品規格名稱</Label>
                <Input value={manualForm.productName} onChange={(e) => setManualForm((f) => ({ ...f, productName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>貨號</Label>
                <Input value={manualForm.optionSku} onChange={(e) => setManualForm((f) => ({ ...f, optionSku: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>退貨原因</Label>
              <Input value={manualForm.returnReason} onChange={(e) => setManualForm((f) => ({ ...f, returnReason: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>買家備註</Label>
              <Textarea rows={2} value={manualForm.buyerNote} onChange={(e) => setManualForm((f) => ({ ...f, buyerNote: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>備註</Label>
              <Textarea rows={2} value={manualForm.note} onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>取消</Button>
            <Button onClick={handleManualSubmit} disabled={isManualSubmitting}>
              {isManualSubmitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />新增中...</> : '確認新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

