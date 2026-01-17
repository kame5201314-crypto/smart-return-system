'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface PickupRecord {
  id: string;
  processDate: string;
  orderNumber: string;
  platform: string;
  logisticsProvider: string;
  deliveryStatus: string;
  receivedStatus: string;
  notes: string;
  receiverInfo: string;
  createdAt: string;
  updatedAt: string;
}

const PLATFORMS = ['商城', '蝦皮', '官網', 'MOMO', '其他'];
const LOGISTICS_PROVIDERS = ['黑貓', '新竹物流', '7-11', '全家', '郵局', '其他'];
const DELIVERY_STATUSES = ['派車收件', '來回件', '已送達', '配送中', '待收件', '已退回'];
const RECEIVED_STATUSES = ['未收到', '已收到', '已貼單', '處理中', '完成'];

const STORAGE_KEY = 'pickup-records';

export default function PickupPage() {
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<PickupRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PickupRecord | null>(null);
  const [formData, setFormData] = useState({
    processDate: format(new Date(), 'yyyy-MM-dd'),
    orderNumber: '',
    platform: '商城',
    logisticsProvider: '黑貓',
    deliveryStatus: '派車收件',
    receivedStatus: '未收到',
    notes: '',
    receiverInfo: '',
  });

  // Load records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecords(parsed);
        setFilteredRecords(parsed);
      } catch (e) {
        console.error('Failed to parse saved records:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save records to localStorage - only after initial load
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records, isLoaded]);

  // Filter records
  useEffect(() => {
    if (!searchQuery) {
      setFilteredRecords(records);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRecords(
        records.filter(
          (r) =>
            r.orderNumber.toLowerCase().includes(query) ||
            r.platform.toLowerCase().includes(query) ||
            r.notes.toLowerCase().includes(query) ||
            r.receiverInfo.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, records]);

  function handleOpenDialog(record?: PickupRecord) {
    if (record) {
      setEditingRecord(record);
      setFormData({
        processDate: record.processDate,
        orderNumber: record.orderNumber,
        platform: record.platform,
        logisticsProvider: record.logisticsProvider,
        deliveryStatus: record.deliveryStatus,
        receivedStatus: record.receivedStatus,
        notes: record.notes,
        receiverInfo: record.receiverInfo,
      });
    } else {
      setEditingRecord(null);
      setFormData({
        processDate: format(new Date(), 'yyyy-MM-dd'),
        orderNumber: '',
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

  function handleSave() {
    if (!formData.orderNumber.trim()) {
      toast.error('請填寫訂單編號');
      return;
    }

    const now = new Date().toISOString();

    if (editingRecord) {
      // Update existing record
      setRecords((prev) =>
        prev.map((r) =>
          r.id === editingRecord.id
            ? { ...r, ...formData, updatedAt: now }
            : r
        )
      );
      toast.success('記錄已更新');
    } else {
      // Create new record
      const newRecord: PickupRecord = {
        id: `pickup-${Date.now()}`,
        ...formData,
        createdAt: now,
        updatedAt: now,
      };
      setRecords((prev) => [newRecord, ...prev]);
      toast.success('記錄已新增');
    }

    setIsDialogOpen(false);
  }

  function handleDelete(id: string) {
    if (confirm('確定要刪除此記錄嗎？')) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('記錄已刪除');
    }
  }

  function handleQuickStatusUpdate(id: string, field: 'receivedStatus', value: string) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: value, updatedAt: new Date().toISOString() }
          : r
      )
    );
    toast.success('狀態已更新');
  }

  function getStatusColor(status: string) {
    switch (status) {
      case '已收到':
      case '完成':
      case '已送達':
        return 'bg-green-100 text-green-800';
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

  function handlePrint() {
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
      orderNumber: r.orderNumber.split('\n')[0],
      platform: r.platform,
      date: format(new Date(r.processDate), 'M/d'),
      shipping: r.deliveryStatus,
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
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7" />
            派車收件
          </h1>
          <p className="text-muted-foreground">追蹤物流派車收件狀態</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={selectedIds.size === 0}>
            <Printer className="w-4 h-4 mr-2" />
            列印 {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            新增記錄
          </Button>
        </div>
      </div>

      {/* Search & Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋訂單編號、備註、收件資料..."
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
                  {records.filter((r) => r.receivedStatus === '未收到').length} 筆
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">已收到:</span>
                <Badge className="bg-green-100 text-green-800">
                  {records.filter((r) => r.receivedStatus === '已收到' || r.receivedStatus === '完成').length} 筆
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">收件記錄</CardTitle>
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
                    <TableHead className="w-[100px]">處理日期</TableHead>
                    <TableHead className="w-[180px]">訂單編號</TableHead>
                    <TableHead className="w-[80px]">平台</TableHead>
                    <TableHead className="w-[80px]">物流</TableHead>
                    <TableHead className="w-[100px]">物流狀態</TableHead>
                    <TableHead className="w-[120px]">收到/已貼</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead>收件資料</TableHead>
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
                      <TableCell className="font-medium">
                        {format(new Date(record.processDate), 'M/d', { locale: zhTW })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{record.orderNumber.split('\n')[0]}</div>
                          {record.orderNumber.split('\n')[1] && (
                            <div className="text-muted-foreground text-xs">
                              {record.orderNumber.split('\n')[1]}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{record.platform}</TableCell>
                      <TableCell>{record.logisticsProvider}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.deliveryStatus)}>
                          {record.deliveryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.receivedStatus}
                          onValueChange={(value) => handleQuickStatusUpdate(record.id, 'receivedStatus', value)}
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
                        <div className="max-w-[150px] truncate text-sm" title={record.notes}>
                          {record.notes || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm" title={record.receiverInfo}>
                          {record.receiverInfo || '-'}
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
                <Label>處理日期</Label>
                <Input
                  type="date"
                  value={formData.processDate}
                  onChange={(e) => setFormData({ ...formData, processDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>平台</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger>
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
              <Label>訂單編號 *</Label>
              <Textarea
                placeholder="輸入訂單編號（可多行，例如訂單號+物流單號）"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>物流平台</Label>
                <Select
                  value={formData.logisticsProvider}
                  onValueChange={(value) => setFormData({ ...formData, logisticsProvider: value })}
                >
                  <SelectTrigger>
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
                <Label>物流狀態</Label>
                <Select
                  value={formData.deliveryStatus}
                  onValueChange={(value) => setFormData({ ...formData, deliveryStatus: value })}
                >
                  <SelectTrigger>
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
              <Label>收到/已貼</Label>
              <Select
                value={formData.receivedStatus}
                onValueChange={(value) => setFormData({ ...formData, receivedStatus: value })}
              >
                <SelectTrigger>
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
              <Label>備註</Label>
              <Input
                placeholder="輸入備註內容"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>收件資料</Label>
              <Textarea
                placeholder="輸入收件人地址、電話等資訊"
                value={formData.receiverInfo}
                onChange={(e) => setFormData({ ...formData, receiverInfo: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {editingRecord ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
