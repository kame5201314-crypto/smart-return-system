'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  getShopeeReturnGroupById,
  updateShopeeReturn,
  updateShopeeReturnStatus,
  type ShopeeReturn,
  type ShopeeReturnPlatform,
} from '@/lib/actions/shopee-returns.actions';

interface EditFormState {
  platform: ShopeeReturnPlatform;
  orderNumber: string;
  trackingNumber: string;
  shippingMethod: string;
  orderDate: string;
  disputeDeadline: string;
  refundAmount: string;
  returnQuantity: string;
  productName: string;
  optionName: string;
  optionSku: string;
  returnReason: string;
  buyerNote: string;
  returnReasonNote: string;
  note: string;
}

const LIST_STATE_RETURN_PATH = '/shopee-returns';

function getPlatformLabel(platform: ShopeeReturn['platform']): string {
  if (platform === 'mall') return '商城';
  if (platform === 'other') return '其他';
  if (platform === 'shopee') return '蝦皮';
  return '-';
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toDateInput(dateString: string | null): string {
  if (!dateString) return '';
  return dateString.slice(0, 10);
}

function buildEditForm(record: ShopeeReturn): EditFormState {
  return {
    platform: record.platform || 'shopee',
    orderNumber: record.order_number || '',
    trackingNumber: record.tracking_number || '',
    shippingMethod: record.shipping_method || '',
    orderDate: toDateInput(record.order_date),
    disputeDeadline: toDateInput(record.dispute_deadline),
    refundAmount: record.refund_amount != null ? String(record.refund_amount) : '',
    returnQuantity: String(record.return_quantity || 1),
    productName: record.product_name || '',
    optionName: record.option_name || '',
    optionSku: record.option_sku || '',
    returnReason: record.return_reason || '',
    buyerNote: record.buyer_note || '',
    returnReasonNote: record.return_reason_note || '',
    note: record.note || '',
  };
}

function buildDraftMap(items: ShopeeReturn[], key: 'note' | 'return_reason_note'): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item[key] || '']));
}

function pickSharedDateValue(items: ShopeeReturn[], key: 'scanned_at' | 'inbound_at' | 'processed_at'): string | null {
  if (items.length === 0) return null;
  const firstValue = items[0][key] || null;
  const allSame = items.every((item) => (item[key] || null) === firstValue);
  if (allSame) {
    return firstValue;
  }

  const sorted = items
    .map((item) => item[key])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return sorted[0] || null;
}

export default function ShopeeReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string | undefined;

  const [record, setRecord] = useState<ShopeeReturn | null>(null);
  const [groupItems, setGroupItems] = useState<ShopeeReturn[]>([]);
  const [portalReasonDetail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<'scanned' | 'inbound' | 'processed' | 'printed' | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [returnReasonNoteDrafts, setReturnReasonNoteDrafts] = useState<Record<string, string>>({});
  const [updatingNoteId, setUpdatingNoteId] = useState<string | null>(null);
  const [updatingReturnReasonNoteId, setUpdatingReturnReasonNoteId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const backToList = useCallback(() => {
    router.push(LIST_STATE_RETURN_PATH);
  }, [router]);

  const loadOrderGroup = useCallback(async (recordId: string) => {
    setLoading(true);
    const result = await getShopeeReturnGroupById(recordId);

    if (result.success && result.data) {
      setRecord(result.data.primary);
      setGroupItems(result.data.items);
      setNoteDrafts(buildDraftMap(result.data.items, 'note'));
      setReturnReasonNoteDrafts(buildDraftMap(result.data.items, 'return_reason_note'));
    } else {
      toast.error(result.error || '找不到退貨資料');
      setRecord(null);
      setGroupItems([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    const recordId = id;
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      await loadOrderGroup(recordId);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, loadOrderGroup]);

  const orderItems = useMemo(() => {
    if (groupItems.length > 0) return groupItems;
    return record ? [record] : [];
  }, [groupItems, record]);

  const orderIsScanned = orderItems.length > 0 && orderItems.every((item) => item.is_scanned);
  const orderIsInbound = orderItems.length > 0 && orderItems.every((item) => !!item.is_inbound);
  const orderIsProcessed = orderItems.length > 0 && orderItems.every((item) => item.is_processed);
  const orderIsPrinted = orderItems.length > 0 && orderItems.every((item) => item.is_printed);
  const orderScannedAt = pickSharedDateValue(orderItems, 'scanned_at');
  const orderInboundAt = pickSharedDateValue(orderItems, 'inbound_at');
  const orderProcessedAt = pickSharedDateValue(orderItems, 'processed_at');
  const totalRefundAmount = orderItems.reduce((sum, item) => sum + (item.refund_amount || 0), 0);
  const totalReturnQuantity = orderItems.reduce((sum, item) => sum + (item.return_quantity || 0), 0);

  async function updateOrderStatus(type: 'scanned' | 'inbound' | 'processed' | 'printed') {
    if (orderItems.length === 0 || updatingStatus) return;

    setUpdatingStatus(type);
    const now = new Date().toISOString();
    const updates =
      type === 'scanned'
        ? { is_scanned: !orderIsScanned, scanned_at: !orderIsScanned ? now : null }
        : type === 'inbound'
          ? { is_inbound: !orderIsInbound, inbound_at: !orderIsInbound ? now : null }
          : type === 'processed'
            ? { is_processed: !orderIsProcessed, processed_at: !orderIsProcessed ? now : null }
            : { is_printed: !orderIsPrinted };

    const ids = orderItems.map((item) => item.id);
    const results = await Promise.all(ids.map((itemId) => updateShopeeReturnStatus(itemId, updates)));
    const failed = results.find((result) => !result.success);

    if (failed) {
      toast.error(failed.error || '更新狀態失敗');
      setUpdatingStatus(null);
      return;
    }

    setRecord((prev) => (prev ? { ...prev, ...updates } : prev));
    setGroupItems((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, ...updates } : item)));
    toast.success('訂單狀態已更新');
    setUpdatingStatus(null);
  }

  async function saveItemNote(item: ShopeeReturn) {
    if (updatingNoteId) return;

    const nextNote = noteDrafts[item.id] ?? '';
    const currentNote = item.note || '';
    if (nextNote === currentNote) return;

    setUpdatingNoteId(item.id);
    const result = await updateShopeeReturnStatus(item.id, { note: nextNote });

    if (result.success) {
      setGroupItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, note: nextNote } : entry)));
      setRecord((prev) => (prev && prev.id === item.id ? { ...prev, note: nextNote } : prev));
      toast.success('管理備註已儲存');
    } else {
      setNoteDrafts((prev) => ({ ...prev, [item.id]: currentNote }));
      toast.error(result.error || '管理備註儲存失敗');
    }

    setUpdatingNoteId(null);
  }

  async function saveItemReturnReasonNote(item: ShopeeReturn) {
    if (updatingReturnReasonNoteId) return;

    const nextValue = returnReasonNoteDrafts[item.id] ?? '';
    const currentValue = item.return_reason_note || '';
    if (nextValue === currentValue) return;

    setUpdatingReturnReasonNoteId(item.id);
    const result = await updateShopeeReturnStatus(item.id, { return_reason_note: nextValue });

    if (result.success) {
      setGroupItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, return_reason_note: nextValue } : entry))
      );
      setRecord((prev) => (prev && prev.id === item.id ? { ...prev, return_reason_note: nextValue } : prev));
      toast.success('退貨原因備註已儲存');
    } else {
      setReturnReasonNoteDrafts((prev) => ({ ...prev, [item.id]: currentValue }));
      toast.error(result.error || '退貨原因備註儲存失敗');
    }

    setUpdatingReturnReasonNoteId(null);
  }

  function updateEditField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function openEditDialog() {
    if (!record) return;
    setEditForm(buildEditForm(record));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!record || !editForm || savingEdit) return;

    const orderNumber = editForm.orderNumber.trim();
    if (!orderNumber) {
      toast.error('請輸入訂單編號');
      return;
    }

    const quantity = Number(editForm.returnQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error('退貨數量必須是大於 0 的整數');
      return;
    }

    let refundAmount: number | null = null;
    if (editForm.refundAmount.trim() !== '') {
      const parsed = Number(editForm.refundAmount);
      if (Number.isNaN(parsed)) {
        toast.error('退款金額格式錯誤');
        return;
      }
      refundAmount = parsed;
    }

    setSavingEdit(true);
    const result = await updateShopeeReturn(record.id, {
      platform: editForm.platform,
      orderNumber,
      trackingNumber: editForm.trackingNumber,
      shippingMethod: editForm.shippingMethod,
      orderDate: editForm.orderDate,
      disputeDeadline: editForm.disputeDeadline,
      refundAmount,
      returnQuantity: quantity,
      productName: editForm.productName,
      optionName: editForm.optionName,
      optionSku: editForm.optionSku,
      returnReason: editForm.returnReason,
      buyerNote: editForm.buyerNote,
      returnReasonNote: editForm.returnReasonNote,
      note: editForm.note,
    });

    if (result.success && result.data) {
      await loadOrderGroup(result.data.id);
      setEditOpen(false);
      toast.success('退貨資料已更新');
    } else {
      toast.error(result.error || '更新退貨資料失敗');
    }

    setSavingEdit(false);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={backToList} className="px-0">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">蝦皮退貨訂單明細</h1>
            <p className="text-sm text-muted-foreground">同訂單的退貨商品會在同一頁顯示，方便一起檢視與處理。</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">基本資訊</CardTitle>
          {!loading && record && (
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="w-4 h-4 mr-1" />
              編輯主項資料
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !record ? (
            <div className="py-12 text-center text-muted-foreground">找不到退貨資料</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void updateOrderStatus('scanned')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {orderIsScanned ? (
                      <Badge className="bg-indigo-100 text-indigo-800 cursor-pointer">
                        {updatingStatus === 'scanned' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        已掃描
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="cursor-pointer">
                        {updatingStatus === 'scanned' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        未掃描
                      </Badge>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void updateOrderStatus('inbound')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {orderIsInbound ? (
                      <Badge className="bg-blue-100 text-blue-800 cursor-pointer">
                        {updatingStatus === 'inbound' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        已入庫
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="cursor-pointer">
                        {updatingStatus === 'inbound' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        未入庫
                      </Badge>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void updateOrderStatus('processed')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {orderIsProcessed ? (
                      <Badge className="bg-green-100 text-green-800 cursor-pointer">
                        {updatingStatus === 'processed' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        已處理
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="cursor-pointer text-yellow-700 border-yellow-300">
                        {updatingStatus === 'processed' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        未處理
                      </Badge>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void updateOrderStatus('printed')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {orderIsPrinted ? (
                      <Badge className="bg-purple-100 text-purple-800 cursor-pointer">
                        {updatingStatus === 'printed' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        已列印
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="cursor-pointer">
                        {updatingStatus === 'printed' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        未列印
                      </Badge>
                    )}
                  </button>

                  {record.color_tag === 'yellow' && (
                    <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">顏色標記：檢驗中</Badge>
                  )}
                  {record.color_tag === 'red' && (
                    <Badge className="bg-red-100 text-red-800 border border-red-300">顏色標記：爭議中</Badge>
                  )}
                  {record.color_tag === 'purple' && (
                    <Badge className="bg-purple-100 text-purple-800 border border-purple-300">顏色標記：安排收件</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  掃描時間：{formatDateTime(orderScannedAt)} ｜ 入庫時間：{formatDateTime(orderInboundAt)} ｜ 已處理時間：{formatDateTime(orderProcessedAt)}
                </div>
                <div className="text-xs text-muted-foreground">同一訂單共 {orderItems.length} 項退貨商品，點選上方狀態會一起切換。</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">平台</div>
                  <div className="text-sm font-medium">{getPlatformLabel(record.platform)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">訂單編號</div>
                  <div className="text-sm font-mono">{record.order_number}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">退貨寄件編號</div>
                  <div className="text-sm font-mono">{record.tracking_number || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">退貨運送方式</div>
                  <div className="text-sm">{record.shipping_method || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">訂單日期</div>
                  <div className="text-sm">{record.order_date || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">爭議申請期限</div>
                  <div className="text-sm">{record.dispute_deadline || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">總退款金額</div>
                  <div className="text-sm font-medium">{totalRefundAmount > 0 ? `$${totalRefundAmount.toLocaleString()}` : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">總退貨數量</div>
                  <div className="text-sm font-medium">{totalReturnQuantity}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">退貨明細</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !record ? (
            <div className="py-12 text-center text-muted-foreground">找不到退貨資料</div>
          ) : (
            <div className="space-y-6">
              {orderItems.map((item, index) => {
                const directBuyerNote = item.buyer_note?.trim() || '';
                const fallbackBuyerNote = portalReasonDetail?.trim() || '';
                const buyerNoteValue = directBuyerNote || fallbackBuyerNote || '-';
                const buyerNoteSource = directBuyerNote
                  ? '買家退貨備註'
                  : fallbackBuyerNote
                    ? '客戶退貨說明（fallback）'
                    : null;

                return (
                <div key={item.id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">第 {index + 1} 項商品</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.id}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.option_sku || item.option_name || item.product_name || '-'}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">買家退款金額</div>
                      <div className="text-sm font-medium">
                        {item.refund_amount != null ? `$${item.refund_amount.toLocaleString()}` : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">數量</div>
                      <div className="text-sm font-medium">{item.return_quantity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">商品名稱</div>
                      <div className="text-sm whitespace-pre-wrap break-words">{item.product_name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">商品規格名稱</div>
                      <div className="text-sm whitespace-pre-wrap break-words">{item.option_name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">貨號</div>
                      <div className="text-sm font-mono">{item.option_sku || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">退貨原因</div>
                      <div className="text-sm whitespace-pre-wrap break-words">{item.return_reason || '-'}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground">
                        買家備註{buyerNoteSource ? `（來源：${buyerNoteSource}）` : ''}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{buyerNoteValue}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">管理備註（離開欄位後自動儲存）</div>
                      <Textarea
                        value={noteDrafts[item.id] ?? ''}
                        placeholder="輸入備註..."
                        className="mt-1 min-h-[84px] text-sm"
                        disabled={updatingNoteId === item.id}
                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                        onBlur={() => void saveItemNote(item)}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">退貨原因備註（離開欄位後自動儲存）</div>
                      <Textarea
                        value={returnReasonNoteDrafts[item.id] ?? ''}
                        placeholder="輸入退貨原因備註..."
                        className="mt-1 min-h-[84px] text-sm"
                        disabled={updatingReturnReasonNoteId === item.id}
                        onChange={(event) =>
                          setReturnReasonNoteDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        onBlur={() => void saveItemReturnReasonNote(item)}
                      />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>編輯主項退貨資料</DialogTitle>
            <DialogDescription>此視窗編輯目前開啟的主要品項資料；同訂單其他商品仍可在下方明細區個別備註。</DialogDescription>
          </DialogHeader>

          {!editForm ? null : (
            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>平台 *</Label>
                  <Select
                    value={editForm.platform}
                    onValueChange={(value) => updateEditField('platform', value as ShopeeReturnPlatform)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shopee">蝦皮</SelectItem>
                      <SelectItem value="mall">商城</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>訂單編號 *</Label>
                  <Input
                    value={editForm.orderNumber}
                    onChange={(event) => updateEditField('orderNumber', event.target.value)}
                    placeholder="輸入訂單編號"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>退貨寄件編號</Label>
                  <Input
                    value={editForm.trackingNumber}
                    onChange={(event) => updateEditField('trackingNumber', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>退貨運送方式</Label>
                  <Input
                    value={editForm.shippingMethod}
                    onChange={(event) => updateEditField('shippingMethod', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>訂單日期</Label>
                  <Input
                    type="date"
                    value={editForm.orderDate}
                    onChange={(event) => updateEditField('orderDate', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>爭議申請期限</Label>
                  <Input
                    type="date"
                    value={editForm.disputeDeadline}
                    onChange={(event) => updateEditField('disputeDeadline', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>買家退款金額</Label>
                  <Input
                    type="number"
                    value={editForm.refundAmount}
                    onChange={(event) => updateEditField('refundAmount', event.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>數量</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editForm.returnQuantity}
                    onChange={(event) => updateEditField('returnQuantity', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>商品名稱</Label>
                  <Input
                    value={editForm.productName}
                    onChange={(event) => updateEditField('productName', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>商品規格名稱</Label>
                  <Input
                    value={editForm.optionName}
                    onChange={(event) => updateEditField('optionName', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>貨號</Label>
                  <Input
                    value={editForm.optionSku}
                    onChange={(event) => updateEditField('optionSku', event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>退貨原因</Label>
                  <Input
                    value={editForm.returnReason}
                    onChange={(event) => updateEditField('returnReason', event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>買家備註</Label>
                <Textarea rows={2} value={editForm.buyerNote} onChange={(event) => updateEditField('buyerNote', event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>管理備註</Label>
                <Textarea rows={2} value={editForm.note} onChange={(event) => updateEditField('note', event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>退貨原因備註</Label>
                <Textarea rows={2} value={editForm.returnReasonNote} onChange={(event) => updateEditField('returnReasonNote', event.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              取消
            </Button>
            <Button onClick={() => void saveEdit()} disabled={savingEdit || !editForm}>
              {savingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
