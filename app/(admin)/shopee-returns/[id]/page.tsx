'use client';

import { useEffect, useState } from 'react';
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
  getShopeeReturnById,
  updateShopeeReturn,
  updateShopeeReturnStatus,
  type ShopeeReturn,
} from '@/lib/actions/shopee-returns.actions';

interface EditFormState {
  platform: 'shopee' | 'mall';
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

function getPlatformLabel(platform: ShopeeReturn['platform']): string {
  if (platform === 'mall') return '商城';
  if (platform === 'shopee') return '蝦皮';
  return '-';
}

function formatDateTime(dateString: string | null): string {
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
    platform: record.platform === 'mall' ? 'mall' : 'shopee',
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

export default function ShopeeReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string | undefined;

  const [record, setRecord] = useState<ShopeeReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<'scanned' | 'inbound' | 'processed' | 'printed' | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [returnReasonNoteDraft, setReturnReasonNoteDraft] = useState('');
  const [updatingNote, setUpdatingNote] = useState(false);
  const [updatingReturnReasonNote, setUpdatingReturnReasonNote] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  useEffect(() => {
    if (!id) return;
    const recordId = id;

    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getShopeeReturnById(recordId);
      if (cancelled) return;

      if (result.success && result.data) {
        setRecord(result.data);
        setNoteDraft(result.data.note || '');
        setReturnReasonNoteDraft(result.data.return_reason_note || '');
      } else {
        toast.error(result.error || '載入失敗');
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleStatus(type: 'scanned' | 'inbound' | 'processed' | 'printed') {
    if (!record || updatingStatus) return;

    setUpdatingStatus(type);

    const now = new Date().toISOString();
    const updates =
      type === 'scanned'
        ? { is_scanned: !record.is_scanned, scanned_at: !record.is_scanned ? now : null }
        : type === 'inbound'
          ? { is_inbound: !record.is_inbound, inbound_at: !record.is_inbound ? now : null }
        : type === 'processed'
          ? { is_processed: !record.is_processed, processed_at: !record.is_processed ? now : null }
          : { is_printed: !record.is_printed };

    const result = await updateShopeeReturnStatus(record.id, updates);

    if (result.success) {
      setRecord((prev) => (prev ? { ...prev, ...updates } : prev));
      toast.success('狀態已更新');
    } else {
      toast.error(result.error || '狀態更新失敗');
    }

    setUpdatingStatus(null);
  }

  async function saveNote() {
    if (!record || updatingNote) return;
    const currentNote = record.note || '';
    if (noteDraft === currentNote) return;

    setUpdatingNote(true);
    const result = await updateShopeeReturnStatus(record.id, { note: noteDraft });

    if (result.success) {
      setRecord((prev) => (prev ? { ...prev, note: noteDraft } : prev));
      toast.success('備註已更新');
    } else {
      setNoteDraft(currentNote);
      toast.error(result.error || '備註更新失敗');
    }

    setUpdatingNote(false);
  }

  async function saveReturnReasonNote() {
    if (!record || updatingReturnReasonNote) return;
    const currentReasonNote = record.return_reason_note || '';
    if (returnReasonNoteDraft === currentReasonNote) return;

    setUpdatingReturnReasonNote(true);
    const result = await updateShopeeReturnStatus(record.id, { return_reason_note: returnReasonNoteDraft });

    if (result.success) {
      setRecord((prev) => (prev ? { ...prev, return_reason_note: returnReasonNoteDraft } : prev));
      toast.success('退貨原因備註已儲存');
    } else {
      setReturnReasonNoteDraft(currentReasonNote);
      toast.error(result.error || '退貨原因備註儲存失敗');
    }

    setUpdatingReturnReasonNote(false);
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
      toast.error('數量必須為正整數');
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
      setRecord(result.data);
      setNoteDraft(result.data.note || '');
      setReturnReasonNoteDraft(result.data.return_reason_note || '');
      setEditOpen(false);
      toast.success('內容已更新');
    } else {
      toast.error(result.error || '更新失敗');
    }

    setSavingEdit(false);
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="px-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">退貨訂單明細</h1>
            <p className="text-sm text-muted-foreground">查看與編輯退貨金額、規格、貨號等資訊</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">基本資訊</CardTitle>
          {!loading && record && (
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="w-4 h-4 mr-1" />
              編輯內容
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !record ? (
            <div className="py-12 text-center text-muted-foreground">找不到資料</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStatus('scanned')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {record.is_scanned ? (
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
                    onClick={() => toggleStatus('inbound')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {record.is_inbound ? (
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
                    onClick={() => toggleStatus('processed')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {record.is_processed ? (
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
                    onClick={() => toggleStatus('printed')}
                    disabled={!!updatingStatus}
                    className="disabled:opacity-60"
                  >
                    {record.is_printed ? (
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
                    <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">顏色標籤: 黃</Badge>
                  )}
                  {record.color_tag === 'red' && (
                    <Badge className="bg-red-100 text-red-800 border border-red-300">顏色標籤: 紅</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  掃描時間：{formatDateTime(record.scanned_at)} ｜ 入庫時間：{formatDateTime(record.inbound_at || null)} ｜ 已處理時間：{formatDateTime(record.processed_at)}
                </div>
                <div className="text-xs text-muted-foreground">點選上方狀態可切換。</div>
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
            <div className="py-12 text-center text-muted-foreground">找不到資料</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">買家退款金額</div>
                <div className="text-sm font-medium">
                  {record.refund_amount != null ? `$${record.refund_amount.toLocaleString()}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">數量</div>
                <div className="text-sm font-medium">{record.return_quantity}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">商品名稱</div>
                <div className="text-sm">{record.product_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">商品規格名稱</div>
                <div className="text-sm">{record.option_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">貨號</div>
                <div className="text-sm font-mono">{record.option_sku || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">退貨原因</div>
                <div className="text-sm">{record.return_reason || '-'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground">買家備註</div>
                <div className="text-sm whitespace-pre-wrap break-words">{record.buyer_note || '-'}</div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">管理備註（離開欄位後自動儲存）</div>
                  <Textarea
                    value={noteDraft}
                    placeholder="輸入備註..."
                    className="mt-1 min-h-[84px] text-sm"
                    disabled={updatingNote}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    onBlur={saveNote}
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">退貨原因備註（離開欄位後自動儲存）</div>
                  <Textarea
                    value={returnReasonNoteDraft}
                    placeholder="輸入退貨原因備註..."
                    className="mt-1 min-h-[84px] text-sm"
                    disabled={updatingReturnReasonNote}
                    onChange={(event) => setReturnReasonNoteDraft(event.target.value)}
                    onBlur={saveReturnReasonNote}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>編輯退貨內容</DialogTitle>
            <DialogDescription>可修改平台、訂單資訊、商品與備註內容。</DialogDescription>
          </DialogHeader>

          {!editForm ? null : (
            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>平台 *</Label>
                  <Select
                    value={editForm.platform}
                    onValueChange={(value) => updateEditField('platform', value as 'shopee' | 'mall')}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shopee">蝦皮</SelectItem>
                      <SelectItem value="mall">商城</SelectItem>
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
                <Textarea
                  rows={2}
                  value={editForm.buyerNote}
                  onChange={(event) => updateEditField('buyerNote', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>管理備註</Label>
                <Textarea
                  rows={2}
                  value={editForm.note}
                  onChange={(event) => updateEditField('note', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>退貨原因備註</Label>
                <Textarea
                  rows={2}
                  value={editForm.returnReasonNote}
                  onChange={(event) => updateEditField('returnReasonNote', event.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editForm}>
              {savingEdit ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />儲存中...</> : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
