'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  ScanLine,
  Volume2,
  XCircle,
  CheckCircle2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  getShopeeReturns,
  importShopeeReturns,
  updateShopeeReturnStatus,
  batchUpdateShopeeReturns,
  deleteShopeeReturns,
  scanShopeeReturn,
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ success: boolean; message: string; orderNumber?: string } | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const scanResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // Load from database
  useEffect(() => {
    loadReturns();
  }, []);

  // Focus scan input when scanner opens
  useEffect(() => {
    if (scannerOpen && scanInputRef.current) {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [scannerOpen]);

  // Initialize camera scanner with delay for DOM readiness
  useEffect(() => {
    if (scannerOpen) {
      setCameraError(null);
      // Add delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeScanner();
      }, 500);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    }
    return () => {
      stopScanner();
    };
  }, [scannerOpen]);

  async function initializeScanner() {
    setCameraLoading(true);
    setCameraError(null);

    try {
      // Check if mediaDevices is available
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('您的瀏覽器不支援相機功能，請重試或稍後再試');
        setCameraLoading(false);
        return;
      }

      // Wait for container to be ready
      const container = document.getElementById('scanner-video');
      if (!container) {
        setCameraError('相機容器載入失敗');
        setCameraLoading(false);
        return;
      }

      const { Html5Qrcode } = await import('html5-qrcode');

      if (html5QrCodeRef.current) {
        try {
          await (html5QrCodeRef.current as { stop: () => Promise<void> }).stop();
        } catch {
          // Ignore stop errors
        }
      }

      const html5QrCode = new Html5Qrcode('scanner-video');
      html5QrCodeRef.current = html5QrCode;

      const containerWidth = container.clientWidth || 320;
      // Larger scanning area for barcodes on mobile
      const qrboxWidth = Math.min(280, containerWidth - 40);
      const qrboxHeight = Math.min(120, qrboxWidth * 0.4);

      // Try different camera configurations for mobile
      const cameraConfigs = [
        { facingMode: 'environment' },              // Prefer back camera
        { facingMode: 'user' },                     // Front camera
      ];

      let started = false;
      let lastError: unknown = null;

      for (const config of cameraConfigs) {
        try {
          await html5QrCode.start(
            config,
            {
              fps: 15,  // Higher FPS for smoother scanning
              qrbox: { width: qrboxWidth, height: qrboxHeight },
              aspectRatio: 1.777,  // 16:9 aspect ratio
            },
            handleScanSuccess,
            () => {}
          );
          started = true;
          console.log('Camera started with config:', config);
          break;
        } catch (err) {
          console.log(`Camera config ${JSON.stringify(config)} failed:`, err);
          lastError = err;
          continue;
        }
      }

      if (!started) {
        throw lastError || new Error('All camera configurations failed');
      }
    } catch (error) {
      console.error('Failed to initialize scanner:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('Permission') || errorMsg.includes('NotAllowed')) {
        setCameraError('相機權限被拒絕，請在瀏覽器設定中允許相機存取');
      } else if (errorMsg.includes('NotFound') || errorMsg.includes('DevicesNotFound')) {
        setCameraError('找不到相機裝置，請重試或稍後再試');
      } else {
        setCameraError('相機啟動失敗，請重試或稍後再試');
      }
    } finally {
      setCameraLoading(false);
    }
  }

  async function stopScanner() {
    if (html5QrCodeRef.current) {
      try {
        await (html5QrCodeRef.current as { stop: () => Promise<void> }).stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
  }

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    await processScan(decodedText);
  }, []);

  async function processScan(code: string) {
    if (isScanning || !code.trim()) return;

    setIsScanning(true);

    // Clear existing timer
    if (scanResultTimerRef.current) {
      clearTimeout(scanResultTimerRef.current);
    }

    try {
      const result = await scanShopeeReturn(code);

      if (result.success && result.data) {
        const { matched, alreadyScanned } = result.data;

        // Play success sound
        playBeep(alreadyScanned ? 'warning' : 'success');

        if (alreadyScanned) {
          setLastScanResult({
            success: true,
            message: '此訂單已掃描過',
            orderNumber: matched.order_number
          });
        } else {
          setLastScanResult({
            success: true,
            message: '掃描成功！',
            orderNumber: matched.order_number
          });

          // Update local state
          setReturns(prev =>
            prev.map(r =>
              r.id === matched.id ? { ...r, is_scanned: true, scanned_at: new Date().toISOString() } : r
            )
          );
        }
      } else {
        playBeep('error');
        setLastScanResult({
          success: false,
          message: result.error || '找不到符合的訂單'
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      playBeep('error');
      setLastScanResult({
        success: false,
        message: '掃描失敗，請重試'
      });
    } finally {
      setIsScanning(false);
      setScanInput('');

      // Auto-dismiss result after 5 seconds
      scanResultTimerRef.current = setTimeout(() => {
        setLastScanResult(null);
      }, 5000);
    }
  }

  function playBeep(type: 'success' | 'warning' | 'error') {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'success') {
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
      } else if (type === 'warning') {
        oscillator.frequency.value = 600;
        gainNode.gain.value = 0.2;
      } else {
        oscillator.frequency.value = 300;
        gainNode.gain.value = 0.3;
      }

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Ignore audio errors
    }
  }

  async function handleManualScan() {
    if (scanInput.trim()) {
      await processScan(scanInput);
    }
  }

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

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
        });
      });

      if (newItems.length > 0) {
        const result = await importShopeeReturns(newItems);
        if (result.success && result.data) {
          const { imported, duplicates } = result.data;
          if (imported > 0) {
            toast.success(`成功匯入 ${imported} 筆資料${duplicates > 0 ? `，略過 ${duplicates} 筆重複` : ''}`);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      date: formatLabelDate(r.order_date),
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
          .label-cell.order-number { font-size: 10pt; line-height: 1.2; }
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
              <div class="label-cell order-number">${label.orderNumber}</div>
              <div class="label-cell platform">蝦皮</div>
              <div class="label-cell date">${label.date}</div>
              <div class="label-cell shipping">蝦皮店到店</div>
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="default"
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="w-4 h-4 mr-1" />
            掃描
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            匯入
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            列印
          </Button>
        </div>
      </div>

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => {
        if (!open) stopScanner();
        setScannerOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              相機掃描
            </DialogTitle>
            <DialogDescription>
              將條碼對準下方框內，自動識別
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Camera Scanner - Primary focus */}
            <div className="relative">
              <div
                id="scanner-video"
                ref={videoContainerRef}
                className="w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden min-h-[280px]"
              />
              {/* Targeting frame overlay - white corner brackets for better visibility */}
              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  {/* Square scanning frame */}
                  <div className="relative w-[70%] aspect-square max-w-[280px]">
                    {/* Corner brackets - white, thick, prominent */}
                    {/* Top-left */}
                    <div className="absolute top-0 left-0 w-12 h-12">
                      <div className="absolute top-0 left-0 w-full h-1 bg-white rounded-full" />
                      <div className="absolute top-0 left-0 w-1 h-full bg-white rounded-full" />
                    </div>
                    {/* Top-right */}
                    <div className="absolute top-0 right-0 w-12 h-12">
                      <div className="absolute top-0 right-0 w-full h-1 bg-white rounded-full" />
                      <div className="absolute top-0 right-0 w-1 h-full bg-white rounded-full" />
                    </div>
                    {/* Bottom-left */}
                    <div className="absolute bottom-0 left-0 w-12 h-12">
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-white rounded-full" />
                      <div className="absolute bottom-0 left-0 w-1 h-full bg-white rounded-full" />
                    </div>
                    {/* Bottom-right */}
                    <div className="absolute bottom-0 right-0 w-12 h-12">
                      <div className="absolute bottom-0 right-0 w-full h-1 bg-white rounded-full" />
                      <div className="absolute bottom-0 right-0 w-1 h-full bg-white rounded-full" />
                    </div>
                  </div>
                  <p className="absolute bottom-6 left-0 right-0 text-center text-white text-sm font-medium drop-shadow-lg">
                    將條碼對準框內
                  </p>
                </div>
              )}
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg z-20">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                    <p className="text-base font-medium">正在啟動相機...</p>
                    <p className="text-sm text-gray-400 mt-1">請允許相機權限</p>
                  </div>
                </div>
              )}
              {cameraError && !cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg z-20">
                  <div className="text-center text-white p-4">
                    <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-gray-300 mb-4">{cameraError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCameraError(null);
                        initializeScanner();
                      }}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      重試相機
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Scan Result */}
            {lastScanResult && (
              <div
                className={`p-3 rounded-lg flex items-center gap-3 ${
                  lastScanResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {lastScanResult.success ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${lastScanResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {lastScanResult.message}
                  </p>
                  {lastScanResult.orderNumber && (
                    <p className="text-sm font-mono text-muted-foreground">
                      {lastScanResult.orderNumber}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex justify-center gap-6 text-sm py-2 border-t">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">{scannedCount}</Badge>
                <span className="text-muted-foreground">已掃描</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{notScannedCount}</Badge>
                <span className="text-muted-foreground">未掃描</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <span className="text-muted-foreground">已掃描:</span>
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

              {/* Scan Filter */}
              <Select value={scanFilter} onValueChange={(v) => setScanFilter(v as typeof scanFilter)}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <ScanLine className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="scanned">已掃描</SelectItem>
                  <SelectItem value="not_scanned">未掃描</SelectItem>
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
                        掃描
                        {getSortIcon('is_scanned')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[60px]">狀態</TableHead>
                    <TableHead className="w-[60px]">列印</TableHead>
                    <TableHead className="min-w-[120px]">訂單編號</TableHead>
                    <TableHead className="min-w-[100px] hidden md:table-cell">寄件編號</TableHead>
                    <TableHead
                      className="w-[80px] hidden md:table-cell cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('order_date')}
                    >
                      <div className="flex items-center">
                        日期
                        {getSortIcon('order_date')}
                      </div>
                    </TableHead>
                    <TableHead className="w-[70px] hidden lg:table-cell text-center">總價</TableHead>
                    <TableHead className="hidden lg:table-cell">商品</TableHead>
                    <TableHead className="w-[80px] hidden xl:table-cell">貨號</TableHead>
                    <TableHead className="w-[50px] hidden xl:table-cell">數量</TableHead>
                    <TableHead className="hidden md:table-cell text-left">備註</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReturns.map((record) => (
                    <TableRow
                      key={record.id}
                      className={record.is_processed ? 'bg-green-50' : record.is_scanned ? 'bg-blue-50/50' : ''}
                    >
                      <TableCell className="sticky left-0 bg-inherit">
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
                      <TableCell>
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
                      <TableCell className="hidden md:table-cell font-mono text-xs">
                        {record.tracking_number || '-'}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{formatOrderDate(record.order_date)}</TableCell>
                      <TableCell className="text-center text-xs hidden lg:table-cell">${(record.total_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="max-w-[150px] truncate text-xs" title={record.product_name || ''}>
                          {record.product_name || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden xl:table-cell">{record.option_sku || '-'}</TableCell>
                      <TableCell className="text-center text-xs hidden xl:table-cell">{record.return_quantity}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Input
                          value={getNoteValue(record)}
                          onChange={(e) => debouncedUpdateNote(record.id, e.target.value)}
                          placeholder="備註..."
                          className="h-7 text-xs"
                        />
                      </TableCell>
                    </TableRow>
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
