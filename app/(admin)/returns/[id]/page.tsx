'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

import { getReturnRequestDetail, updateReturnStatus, updateReturnInfo, submitInspection } from '@/lib/actions/return.actions';
import { getCurrentUser } from '@/lib/actions/auth';
import { inspectionSchema, type InspectionInput } from '@/lib/validations/return.schema';
import {
  RETURN_STATUS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASONS,
  RETURN_SHIPPING_METHODS,
  REFUND_TYPES,
  CHANNEL_LIST,
  INSPECTION_GRADES,
  INSPECTION_CHECKLIST,
  ERROR_MESSAGES,
} from '@/config/constants';

// Helper to get channel label in Chinese
function getChannelLabel(channelSource: string | null): string {
  if (!channelSource) return '-';
  const channel = CHANNEL_LIST.find(c => c.key === channelSource);
  return channel?.label || channelSource;
}

interface ReturnDetail {
  id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
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
    inspector_comment: string | null;
    inspected_at: string;
  }[];
}

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [returnData, setReturnData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editInfoDialogOpen, setEditInfoDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editProductSku, setEditProductSku] = useState('');
  const [editRefundAmount, setEditRefundAmount] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [itemRefundTypes, setItemRefundTypes] = useState<Record<string, 'full' | 'partial'>>({});
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const inspectionForm = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      returnRequestId: params.id as string,
      result: undefined,
      conditionGrade: undefined,
      checklist: {
        packaging_intact: null,
        product_intact: null,
        accessories_complete: null,
        matches_photos: null,
        resellable: null,
      },
      notes: '',
      inspectorComment: '',
    },
  });

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  async function fetchDetail() {
    try {
      const result = await getReturnRequestDetail(params.id as string) as { success: boolean; data?: ReturnDetail; error?: string };
      if (result.success && result.data) {
        setReturnData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch return detail:', error);
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate() {
    if (!newStatus || !returnData) return;

    try {
      setUpdating(true);
      const user = await getCurrentUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }
      const result = await updateReturnStatus(
        {
          returnRequestId: returnData.id,
          newStatus: newStatus as typeof RETURN_STATUS[keyof typeof RETURN_STATUS],
          notes,
        },
        user.id
      );

      if (result.success) {
        toast.success('狀態更新成功');
        setStatusDialogOpen(false);
        fetchDetail();
      } else {
        toast.error(result.error || '更新失敗');
      }
    } catch {
      toast.error('更新失敗');
    } finally {
      setUpdating(false);
    }
  }

  async function handleInfoUpdate() {
    if (!returnData) return;

    try {
      setUpdating(true);
      const result = await updateReturnInfo(returnData.id, {
        productName: editProductName || undefined,
        productSku: editProductSku || undefined,
        refundAmount: editRefundAmount ? parseFloat(editRefundAmount) : undefined,
        adminNote: editAdminNote,
      });

      if (result.success) {
        toast.success('資訊更新成功');
        setEditInfoDialogOpen(false);
        fetchDetail();
      } else {
        toast.error(result.error || '更新失敗');
      }
    } catch {
      toast.error('更新失敗');
    } finally {
      setUpdating(false);
    }
  }

  function openEditInfoDialog() {
    const firstItem = returnData?.return_items?.[0];
    setEditProductName(firstItem?.product_name || '');
    setEditProductSku(firstItem?.product_sku || '');
    setEditRefundAmount(returnData?.refund_amount?.toString() || '');
    setEditAdminNote((returnData as { admin_note?: string })?.admin_note || '');
    setEditInfoDialogOpen(true);
  }

  async function handleInspectionSubmit(data: InspectionInput) {
    try {
      setSubmittingInspection(true);
      const user = await getCurrentUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      const result = await submitInspection(data, user.id);
      if (result.success) {
        toast.success('驗貨結果已提交');
        inspectionForm.reset();
        fetchDetail();
      } else {
        toast.error(result.error || ERROR_MESSAGES.GENERIC);
      }
    } catch {
      toast.error(ERROR_MESSAGES.GENERIC);
    } finally {
      setSubmittingInspection(false);
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
  const shippingMethod = Object.values(RETURN_SHIPPING_METHODS).find(
    (m) => m.key === returnData.return_shipping_method
  );
  const refundType = Object.values(REFUND_TYPES).find(
    (t) => t.key === returnData.refund_type
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
          <p className="text-muted-foreground">
            申請時間：
            {format(new Date(returnData.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
          </p>
        </div>
        <Badge className={RETURN_STATUS_COLORS[returnData.status]} variant="outline">
          {RETURN_STATUS_LABELS[returnData.status]}
        </Badge>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">處理進度</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTracker currentStatus={returnData.status} />
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
              <Button variant="outline" size="sm" onClick={openEditInfoDialog}>
                <Edit className="w-4 h-4 mr-1" />
                編輯
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Return Items with Refund Type Selection */}
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
                          <span className="text-sm text-muted-foreground">退款方式：</span>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={itemRefundTypes[item.id] === 'full' || (!itemRefundTypes[item.id])}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setItemRefundTypes(prev => ({ ...prev, [item.id]: 'full' }));
                                  }
                                }}
                              />
                              <span className="text-sm">全額退款</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={itemRefundTypes[item.id] === 'partial'}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setItemRefundTypes(prev => ({ ...prev, [item.id]: 'partial' }));
                                  }
                                }}
                              />
                              <span className="text-sm">部分退款</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div>
                  <p className="text-muted-foreground">退貨原因</p>
                  <p className="font-medium">{reason?.label || returnData.reason_category || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">發票號碼</p>
                  <p className="font-medium">{invoiceNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">退款金額</p>
                  <p className="font-medium text-green-600">
                    {returnData.refund_amount
                      ? `NT$ ${returnData.refund_amount.toLocaleString()}`
                      : '待定'}
                  </p>
                </div>
              </div>

              {returnData.reason_detail && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">詳細說明</p>
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
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            通過（直接結案）
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'failed' ? 'default' : 'outline'}
                            className={field.value === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => field.onChange('failed')}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            異常（驗收異常）
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Checklist */}
                  <div className="space-y-2">
                    <FormLabel>檢查項目</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {INSPECTION_CHECKLIST.map((item) => (
                        <FormField
                          key={item.key}
                          control={inspectionForm.control}
                          name={`checklist.${item.key}` as const}
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value === true}
                                  onCheckedChange={(checked) => field.onChange(checked)}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer text-sm">
                                {item.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>

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
                    disabled={submittingInspection}
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
                  <Label>發票號碼</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="輸入發票號碼"
                  />
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditInfoDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleInfoUpdate} disabled={updating}>
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
                        <img
                          src={image.image_url}
                          alt={image.image_type || 'Photo'}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80"
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
    </div>
  );
}
