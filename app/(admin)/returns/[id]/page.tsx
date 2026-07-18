'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  ArrowLeft,
  Package,
  User,
  Edit,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ProgressTracker } from '@/components/shared/progress-tracker';
import { useWorkspaceAccess } from '@/components/saas/workspace-access-provider';
import { WORKSPACE_RESTRICTED_ACTION_TITLE } from '@/lib/saas/workspace-action-access';

import { getReturnRequestDetail, updateReturnInfo, submitInspection, deleteReturnRequest } from '@/lib/actions/return.actions';
import { getCurrentMerchantUser } from '@/lib/actions/auth';
import { inspectionSchema, type InspectionInput } from '@/lib/validations/return.schema';
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASONS,
  RETURN_ITEM_RESOLUTION_TYPES,
  CHANNEL_LIST,
  ERROR_MESSAGES,
} from '@/config/constants';

// Helper to get channel label in Chinese
function getChannelLabel(channelSource: string | null): string {
  if (!channelSource) return '-';
  const channel = CHANNEL_LIST.find(c => c.key === channelSource);
  return channel?.label || channelSource;
}

function getOrderAccountId(order: ReturnDetail['order']): string {
  const metadata = order?.metadata;
  if (!metadata || typeof metadata !== 'object') return '-';
  const accountId = (metadata as { account_id?: unknown }).account_id;
  if (typeof accountId !== 'string') return '-';
  const normalized = accountId.trim();
  return normalized.length > 0 ? normalized : '-';
}

interface ReturnDetail {
  id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  return_reason_note: string | null;
  return_shipping_method: string | null;
  tracking_number: string | null;
  logistics_company: string | null;
  refund_amount: number | null;
  refund_type: string;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  inspected_at: string | null;
  closed_at: string | null;
  review_notes: string | null;
  inspection_notes: string | null;
  dispute_notes: string | null;
  order?: {
    id: string;
    order_number: string;
    customer_name: string | null;
    customer_phone: string;
    channel_source: string;
    total_amount: number | null;
    metadata?: Record<string, unknown> | null;
    created_at: string | null;
  } | null;
  customer?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  } | null;
  return_items?: {
    id: string;
    product_sku: string | null;
    product_name: string;
    quantity: number;
    unit_price: number | null;
    reason: string | null;
    resolution_type?: string | null;
  }[];
  return_images?: {
    id: string;
    image_url: string;
    image_type: string | null;
    uploaded_by: string | null;
    created_at: string;
  }[];
  inspection_records?: {
    id: string;
    result: string | null;
    condition_grade: string | null;
    checklist: Record<string, boolean | null> | null;
    inspector_comment: string | null;
    inspected_at: string;
  }[];
}

type ItemRefundOption = 'full' | 'partial' | 'exchange' | 'round_trip';

const ITEM_REFUND_OPTIONS: Array<{ key: ItemRefundOption; label: string }> = [
  { key: RETURN_ITEM_RESOLUTION_TYPES.FULL.key, label: RETURN_ITEM_RESOLUTION_TYPES.FULL.label },
  { key: RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.key, label: RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.label },
  { key: RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.key, label: RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.label },
  { key: RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key, label: RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.label },
];

function normalizeItemResolutionType(value?: string | null): ItemRefundOption {
  const valid = ITEM_REFUND_OPTIONS.some((option) => option.key === value);
  return valid ? (value as ItemRefundOption) : RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
}

export default function ReturnDetailPage() {
  const { canCreateData } = useWorkspaceAccess();
  const params = useParams();
  const returnRequestId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [returnData, setReturnData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [editProductName, setEditProductName] = useState('');
  const [editProductSku, setEditProductSku] = useState('');
  const [editRefundAmount, setEditRefundAmount] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [editReturnReasonNote, setEditReturnReasonNote] = useState('');
  const [returnReasonNoteDraft, setReturnReasonNoteDraft] = useState('');
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [itemRefundTypes, setItemRefundTypes] = useState<Record<string, ItemRefundOption>>({});
  const [updatingResolutionItemId, setUpdatingResolutionItemId] = useState<string | null>(null);
  const [updatingReturnReasonNote, setUpdatingReturnReasonNote] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState('未作廢');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const inspectionForm = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      returnRequestId: returnRequestId || '',
      result: undefined,
      conditionGrade: undefined,
      notes: '',
      inspectorComment: '',
    },
  });

  const fetchDetail = useCallback(async () => {
    if (!returnRequestId) {
      setLoading(false);
      return;
    }

    try {
      const result = await getReturnRequestDetail(returnRequestId) as { success: boolean; data?: ReturnDetail & { invoice_status?: string }; error?: string };
      if (result.success && result.data) {
        setReturnData(result.data);
        setReturnReasonNoteDraft(result.data.return_reason_note || '');
        if (result.data.invoice_status) {
          setInvoiceStatus(result.data.invoice_status);
        }
        const initialResolutionTypes: Record<string, ItemRefundOption> = {};
        result.data.return_items?.forEach((item) => {
          initialResolutionTypes[item.id] = normalizeItemResolutionType(item.resolution_type);
        });
        setItemRefundTypes(initialResolutionTypes);
      } else if (result.error) {
        console.error('Fetch detail failed:', result.error);
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to fetch return detail:', error);
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [returnRequestId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const openEditInfoDialog = useCallback(() => {
    if (!canCreateData) return;
    const firstItem = returnData?.return_items?.[0];
    setEditProductName(firstItem?.product_name || '');
    setEditProductSku(firstItem?.product_sku || '');
    setEditRefundAmount(returnData?.refund_amount?.toString() || '');
    setEditAdminNote((returnData as { admin_note?: string })?.admin_note || '');
    setEditReturnReasonNote(returnData?.return_reason_note || '');
    setEditInfoDialogOpen(true);
  }, [canCreateData, returnData]);

  // Auto-open edit dialog if ?edit=true in URL
  useEffect(() => {
    if (canCreateData && searchParams.get('edit') === 'true' && returnData && returnRequestId) {
      openEditInfoDialog();
      // Clear the query param from URL
      router.replace(`/returns/${returnRequestId}`, { scroll: false });
    }
  }, [canCreateData, searchParams, returnData, returnRequestId, openEditInfoDialog, router]);

  async function handleInfoUpdate() {
    if (!returnData || !canCreateData) return;

    try {
      setUpdating(true);
      const result = await updateReturnInfo(returnData.id, {
        productName: editProductName || undefined,
        productSku: editProductSku || undefined,
        refundAmount: editRefundAmount ? parseFloat(editRefundAmount) : undefined,
        adminNote: editAdminNote,
        returnReasonNote: editReturnReasonNote,
        invoiceStatus,
        itemResolutionTypes: itemRefundTypes,
      });

      if (result.success) {
        toast.success(result.message || '資訊更新成功');
        setEditInfoDialogOpen(false);
        await fetchDetail();
      } else {
        toast.error(result.error || '更新失敗');
      }
    } catch {
      toast.error('更新失敗');
    } finally {
      setUpdating(false);
    }
  }

  async function handleItemResolutionChange(itemId: string, nextType: ItemRefundOption) {
    if (!canCreateData) return;
    if (!returnData || updatingResolutionItemId) return;

    const previousType = itemRefundTypes[itemId]
      || normalizeItemResolutionType(returnData.return_items?.find((item) => item.id === itemId)?.resolution_type);
    if (previousType === nextType) return;

    setItemRefundTypes((prev) => ({ ...prev, [itemId]: nextType }));
    setUpdatingResolutionItemId(itemId);

    try {
      const result = await updateReturnInfo(returnData.id, {
        itemResolutionTypes: { [itemId]: nextType },
      });

      if (!result.success) {
        setItemRefundTypes((prev) => ({ ...prev, [itemId]: previousType }));
        toast.error(result.error || '更新處理方式失敗');
        return;
      }

      setReturnData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          return_items: prev.return_items?.map((item) =>
            item.id === itemId ? { ...item, resolution_type: nextType } : item
          ),
        };
      });
      toast.success(result.message || '處理方式已更新');
    } catch {
      setItemRefundTypes((prev) => ({ ...prev, [itemId]: previousType }));
      toast.error('更新處理方式失敗');
    } finally {
      setUpdatingResolutionItemId(null);
    }
  }

  async function handleReturnReasonNoteSave() {
    if (!canCreateData) return;
    if (!returnData || updatingReturnReasonNote) return;

    const currentValue = returnData.return_reason_note || '';
    if (returnReasonNoteDraft === currentValue) return;

    try {
      setUpdatingReturnReasonNote(true);
      const result = await updateReturnInfo(returnData.id, {
        returnReasonNote: returnReasonNoteDraft,
      });

      if (!result.success) {
        setReturnReasonNoteDraft(currentValue);
        toast.error(result.error || '退貨原因備註儲存失敗');
        return;
      }

      setReturnData((prev) => (prev ? { ...prev, return_reason_note: returnReasonNoteDraft } : prev));
      toast.success('退貨原因備註已儲存');
    } catch {
      setReturnReasonNoteDraft(currentValue);
      toast.error('退貨原因備註儲存失敗');
    } finally {
      setUpdatingReturnReasonNote(false);
    }
  }

  async function handleInspectionSubmit(data: InspectionInput) {
    if (!canCreateData) return;
    try {
      setSubmittingInspection(true);
      const user = await getCurrentMerchantUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      const result = await submitInspection(data, user.id);
      if (result.success) {
        toast.success('驗貨結果已提交');
        inspectionForm.reset();
        await fetchDetail();
      } else {
        toast.error(result.error || ERROR_MESSAGES.GENERIC);
      }
    } catch {
      toast.error(ERROR_MESSAGES.GENERIC);
    } finally {
      setSubmittingInspection(false);
    }
  }

  async function handleDelete() {
    if (!returnData || !canCreateData) return;

    try {
      setDeleting(true);
      const user = await getCurrentMerchantUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      const result = await deleteReturnRequest(returnData.id, user.id);
      if (result.success) {
        toast.success('退貨單已刪除');
        router.push('/returns');
      } else {
        toast.error(result.error || '刪除失敗');
      }
    } catch {
      toast.error('刪除失敗');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">找不到此退貨單</p>
        <Button onClick={() => router.push('/returns')}>返回列表</Button>
      </div>
    );
  }

  const reason = Object.values(RETURN_REASONS).find(
    (r) => r.key === returnData.reason_category
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{returnData.request_number}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={RETURN_STATUS_COLORS[returnData.status]} variant="outline">
            {RETURN_STATUS_LABELS[returnData.status]}
          </Badge>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={!canCreateData}
                title={!canCreateData ? WORKSPACE_RESTRICTED_ACTION_TITLE : undefined}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>確認刪除</DialogTitle>
                <DialogDescription>
                  確定要刪除退貨單 {returnData.request_number} 嗎？此操作無法復原，相關的退貨商品、照片和驗貨紀錄都會一併刪除。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting || !canCreateData}>
                  {deleting ? '刪除中...' : '確認刪除'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">處理進度</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTracker
            currentStatus={returnData.status}
            stepTimes={{
              pendingInspection: returnData.created_at,
              completed: returnData.closed_at,
            }}
          />
        </CardContent>
      </Card>

      {/* Main content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                客戶資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">客戶名稱</p>
                  <p className="font-medium">{returnData.order?.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">手機號碼</p>
                  <p className="font-medium">{returnData.order?.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">訂單編號</p>
                  <p className="font-medium">{returnData.order?.order_number || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">退貨來源</p>
                  <Badge variant="outline">{getChannelLabel(returnData.channel_source)}</Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">客戶帳號 (官網 / 蝦皮)</p>
                  <p className="font-medium">{getOrderAccountId(returnData.order)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                退貨資訊
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={openEditInfoDialog}
                disabled={!canCreateData}
                title={!canCreateData ? WORKSPACE_RESTRICTED_ACTION_TITLE : undefined}
              >
                <Edit className="w-4 h-4 mr-1" />
                編輯
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Return items with handling-mode selection */}
              {returnData.return_items && returnData.return_items.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">退貨商品</p>
                  <div className="space-y-3">
                    {returnData.return_items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            {item.product_sku && (
                              <p className="text-sm text-muted-foreground">貨號：{item.product_sku}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              數量：{item.quantity} {item.unit_price && `/ 單價：NT$ ${item.unit_price.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pt-2 border-t">
                          <span className="text-sm text-muted-foreground">處理方式：</span>
                          <div className="flex items-center gap-4 flex-wrap">
                            {ITEM_REFUND_OPTIONS.map((option) => (
                              <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={
                                    itemRefundTypes[item.id]
                                      ? itemRefundTypes[item.id] === option.key
                                      : option.key === RETURN_ITEM_RESOLUTION_TYPES.FULL.key
                                  }
                                  disabled={updatingResolutionItemId === item.id || !canCreateData}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      void handleItemResolutionChange(item.id, option.key);
                                    }
                                  }}
                                />
                                <span className="text-sm">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div>
                  <p className="text-muted-foreground">退款金額</p>
                  <p className="font-medium text-green-600">
                    {returnData.refund_amount
                      ? `NT$ ${returnData.refund_amount.toLocaleString()}`
                      : '待定'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">發票狀態</p>
                  <Badge variant={
                    invoiceStatus === '已作廢' ? 'destructive' :
                    invoiceStatus === '已折讓' ? 'secondary' : 'outline'
                  }>
                    {invoiceStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">退貨原因</p>
                  <p className="font-medium">{reason?.label || returnData.reason_category || '-'}</p>
                </div>
              </div>

              {returnData.reason_detail && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">退貨詳細說明</p>
                  <p className="text-sm bg-gray-50 p-3 rounded">
                    {returnData.reason_detail}
                  </p>
                </div>
              )}

              {(returnData as { admin_note?: string }).admin_note && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">備註</p>
                  <p className="text-sm bg-blue-50 p-3 rounded border border-blue-100">
                    {(returnData as { admin_note?: string }).admin_note}
                  </p>
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-sm mb-1">退貨原因備註（離開欄位後自動儲存）</p>
                <Textarea
                  value={returnReasonNoteDraft}
                  onChange={(event) => setReturnReasonNoteDraft(event.target.value)}
                  onBlur={handleReturnReasonNoteSave}
                  disabled={updatingReturnReasonNote || !canCreateData}
                  placeholder="輸入退貨原因備註..."
                  className="min-h-[96px] text-sm"
                />
              </div>

            </CardContent>
          </Card>

          {/* Inspection Form - Always visible */}
          <Card className="border-teal-200 bg-teal-50/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-teal-800">
                <CheckCircle className="w-5 h-5" />
                驗貨表單
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...inspectionForm}>
                <form onSubmit={inspectionForm.handleSubmit(handleInspectionSubmit)} className="space-y-5">
                  {/* Result */}
                  <FormField
                    control={inspectionForm.control}
                    name="result"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>驗貨結果 *</FormLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant={field.value === 'passed' ? 'default' : 'outline'}
                            className={field.value === 'passed' ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={() => field.onChange('passed')}
                            disabled={!canCreateData}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            通過（直接結案）
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'failed' ? 'default' : 'outline'}
                            className={field.value === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => field.onChange('failed')}
                            disabled={!canCreateData}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            異常（驗收異常）
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={inspectionForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>內部備註</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="輸入驗貨過程的內部備註..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    disabled={submittingInspection || !canCreateData}
                  >
                    {submittingInspection ? '提交中...' : '提交驗貨結果'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Edit Info Dialog */}
          <Dialog open={editInfoDialogOpen} onOpenChange={setEditInfoDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>編輯退貨資訊</DialogTitle>
                <DialogDescription>
                  更新商品資訊和退款金額
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label>商品名稱</Label>
                  <Input
                    value={editProductName}
                    onChange={(e) => setEditProductName(e.target.value)}
                    placeholder="輸入商品名稱"
                  />
                </div>
                <div className="space-y-2">
                  <Label>商品貨號</Label>
                  <Input
                    value={editProductSku}
                    onChange={(e) => setEditProductSku(e.target.value)}
                    placeholder="輸入商品貨號"
                  />
                </div>
                <div className="space-y-2">
                  <Label>退款金額 (NT$)</Label>
                  <Input
                    type="number"
                    value={editRefundAmount}
                    onChange={(e) => setEditRefundAmount(e.target.value)}
                    placeholder="輸入退款金額"
                  />
                </div>
                <div className="space-y-2">
                  <Label>發票狀態</Label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇發票狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="未作廢">未作廢</SelectItem>
                      <SelectItem value="已作廢">已作廢</SelectItem>
                      <SelectItem value="已折讓">已折讓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>備註</Label>
                  <Textarea
                    value={editAdminNote}
                    onChange={(e) => setEditAdminNote(e.target.value)}
                    placeholder="輸入備註內容"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>退貨原因備註</Label>
                  <Textarea
                    value={editReturnReasonNote}
                    onChange={(e) => setEditReturnReasonNote(e.target.value)}
                    placeholder="輸入退貨原因備註"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditInfoDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleInfoUpdate} disabled={updating || !canCreateData}>
                  {updating ? '更新中...' : '確認更新'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                退貨照片
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnData.return_images && returnData.return_images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {returnData.return_images.map((image) => (
                    <div key={image.id} className="space-y-1">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL with unknown intrinsic dimensions; next/image would need remotePatterns + width/height. */}
                        <img
                          src={image.image_url}
                          alt={image.image_type || 'Photo'}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxImage(image.image_url)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {image.image_type === 'shipping_label' ? '物流面單' :
                         image.image_type === 'outer_box' ? '外箱狀況' :
                         image.image_type === 'inspection' ? '驗貨照片' :
                         '退貨照片'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  尚無照片
                </p>
              )}
            </CardContent>
          </Card>

          {/* Inspection records */}
          {returnData.inspection_records && returnData.inspection_records.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  驗貨紀錄
                </CardTitle>
              </CardHeader>
              <CardContent>
                {returnData.inspection_records.map((record) => (
                  <div key={record.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      {record.result === 'passed' ? (
                        <Badge className="bg-green-100 text-green-800">驗收通過</Badge>
                      ) : record.result === 'failed' ? (
                        <Badge variant="destructive">驗收異常</Badge>
                      ) : (
                        <Badge variant="secondary">部分通過</Badge>
                      )}
                    </div>
                    {record.inspector_comment && (
                      <p className="text-sm bg-gray-50 p-3 rounded">
                        {record.inspector_comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      驗貨時間：
                      {format(new Date(record.inspected_at), 'yyyy/MM/dd HH:mm', {
                        locale: zhTW,
                      })}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {(returnData.review_notes || returnData.inspection_notes || returnData.dispute_notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">處理備註</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {returnData.review_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">審核備註</p>
                    <p className="text-sm bg-gray-50 p-2 rounded">{returnData.review_notes}</p>
                  </div>
                )}
                {returnData.inspection_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">驗貨備註</p>
                    <p className="text-sm bg-gray-50 p-2 rounded">{returnData.inspection_notes}</p>
                  </div>
                )}
                {returnData.dispute_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">爭議備註</p>
                    <p className="text-sm bg-red-50 p-2 rounded text-red-800">
                      {returnData.dispute_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>照片預覽</DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            // eslint-disable-next-line @next/next/no-img-element -- Lightbox preview of user-uploaded Storage URL with unknown dimensions.
            <img
              src={lightboxImage}
              alt="放大照片"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
