'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  ArrowLeft,
  Package,
  User,
  Truck,
  Clock,
  Edit,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProgressTracker } from '@/components/shared/progress-tracker';

import { getReturnRequestDetail, updateReturnStatus } from '@/lib/actions/return.actions';
import {
  RETURN_STATUS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASONS,
  RETURN_SHIPPING_METHODS,
  REFUND_TYPES,
} from '@/config/constants';

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
  applied_at: string;
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
    order_date: string | null;
  } | null;
  customer?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  } | null;
  return_items?: {
    id: string;
    sku: string | null;
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
    checklist: Record<string, boolean | null>;
    notes: string | null;
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
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

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
      const result = await updateReturnStatus(
        {
          returnRequestId: returnData.id,
          newStatus: newStatus as typeof RETURN_STATUS[keyof typeof RETURN_STATUS],
          notes,
          trackingNumber: trackingNumber || undefined,
        },
        'current-user-id' // TODO: Get from auth
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
            {format(new Date(returnData.applied_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={RETURN_STATUS_COLORS[returnData.status]} variant="outline">
            {RETURN_STATUS_LABELS[returnData.status]}
          </Badge>

          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Edit className="w-4 h-4 mr-2" />
                更新狀態
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>更新退貨單狀態</DialogTitle>
                <DialogDescription>
                  選擇新狀態並填寫備註
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>新狀態</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RETURN_STATUS).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {RETURN_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newStatus === RETURN_STATUS.SHIPPING_IN_TRANSIT && (
                  <div className="space-y-2">
                    <Label>物流單號</Label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="輸入物流單號"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>備註</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="輸入備註..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleStatusUpdate} disabled={!newStatus || updating}>
                  {updating ? '更新中...' : '確認更新'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Link href={`/returns/inspection/${returnData.id}`}>
            <Button variant="outline">
              <CheckCircle className="w-4 h-4 mr-2" />
              驗貨
            </Button>
          </Link>
        </div>
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
                  <p className="text-muted-foreground">通路來源</p>
                  <Badge variant="outline">{returnData.channel_source || '-'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                退貨資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">退貨原因</p>
                  <p className="font-medium">{reason?.label || returnData.reason_category || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">退回方式</p>
                  <p className="font-medium">{shippingMethod?.label || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">退款方式</p>
                  <p className="font-medium">{refundType?.label || '-'}</p>
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

              {returnData.tracking_number && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">物流單號</p>
                  <p className="font-mono bg-gray-50 p-2 rounded">
                    {returnData.tracking_number}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">退貨商品</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {returnData.return_items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku || 'N/A'} × {item.quantity}
                      </p>
                    </div>
                    {item.unit_price && (
                      <p className="font-medium">
                        NT$ {(item.unit_price * item.quantity).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                照片證據
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
                        {image.image_type === 'shipping_label' && '物流面單'}
                        {image.image_type === 'product_damage' && '商品狀況'}
                        {image.image_type === 'outer_box' && '外箱狀況'}
                        {image.image_type === 'inspection' && '驗貨照片'}
                        {image.image_type === 'other' && '其他'}
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
                      <Badge variant="outline">等級 {record.condition_grade}</Badge>
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
