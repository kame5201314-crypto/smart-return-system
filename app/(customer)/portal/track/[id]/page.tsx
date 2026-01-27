'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Truck, Clock, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProgressTracker } from '@/components/shared/progress-tracker';

import { getReturnStatus } from '@/lib/actions/return.actions';
import { RETURN_STATUS_LABELS, RETURN_STATUS_COLORS, RETURN_SHIPPING_METHODS, RETURN_REASONS } from '@/config/constants';
import type { ReturnRequestWithRelations } from '@/types';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function TrackReturnPage() {
  const params = useParams();
  const router = useRouter();
  const [returnRequest, setReturnRequest] = useState<ReturnRequestWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('customerSession');
    if (!stored) {
      router.push('/portal');
      return;
    }

    const session = JSON.parse(stored);
    const requestNumber = params.id as string;

    getReturnStatus(requestNumber, session.phone)
      .then((result) => {
        if (result.success && result.data) {
          setReturnRequest(result.data);
        } else {
          setError(result.error || '找不到此退貨申請');
        }
      })
      .catch((err) => {
        console.error('Failed to fetch return status:', err);
        setError('系統錯誤，請稍後再試');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (error || !returnRequest) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push('/portal/dashboard')}>返回首頁</Button>
      </div>
    );
  }

  const shippingMethod = Object.values(RETURN_SHIPPING_METHODS).find(
    (m) => m.key === returnRequest.return_shipping_method
  );
  const reason = Object.values(RETURN_REASONS).find(
    (r) => r.key === returnRequest.reason_category
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>退貨單 {returnRequest.request_number}</CardTitle>
              <CardDescription>
                申請時間：
                {format(new Date(returnRequest.applied_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
              </CardDescription>
            </div>
            <Badge className={RETURN_STATUS_COLORS[returnRequest.status]}>
              {RETURN_STATUS_LABELS[returnRequest.status]}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">進度追蹤</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTracker currentStatus={returnRequest.status} />
        </CardContent>
      </Card>

      {/* Return details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">退貨資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">退貨原因</p>
              <p className="font-medium">{reason?.label || returnRequest.reason_category}</p>
            </div>
            <div>
              <p className="text-muted-foreground">退回方式</p>
              <p className="font-medium">{shippingMethod?.label || '-'}</p>
            </div>
            {returnRequest.tracking_number && (
              <div>
                <p className="text-muted-foreground">物流單號</p>
                <p className="font-medium font-mono">{returnRequest.tracking_number}</p>
              </div>
            )}
            {returnRequest.refund_amount && (
              <div>
                <p className="text-muted-foreground">退款金額</p>
                <p className="font-medium text-green-600">
                  NT$ {returnRequest.refund_amount.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {returnRequest.reason_detail && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">詳細說明</p>
              <p className="text-sm bg-gray-50 p-3 rounded">{returnRequest.reason_detail}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return items */}
      {returnRequest.return_items && returnRequest.return_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">退貨商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {returnRequest.return_items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">× {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded images */}
      {returnRequest.return_images && returnRequest.return_images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">已上傳照片</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {returnRequest.return_images.map((image) => (
                <div key={image.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={image.image_url}
                    alt={image.image_type || 'Photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">處理紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {returnRequest.applied_at && (
              <TimelineItem
                icon={<Clock className="w-4 h-4" />}
                title="已申請"
                time={returnRequest.applied_at}
              />
            )}
            {returnRequest.approved_at && (
              <TimelineItem
                icon={<Package className="w-4 h-4" />}
                title="審核通過"
                time={returnRequest.approved_at}
              />
            )}
            {returnRequest.shipped_at && (
              <TimelineItem
                icon={<Truck className="w-4 h-4" />}
                title="已寄出"
                time={returnRequest.shipped_at}
                description={returnRequest.tracking_number ? `物流單號：${returnRequest.tracking_number}` : undefined}
              />
            )}
            {returnRequest.received_at && (
              <TimelineItem
                icon={<Package className="w-4 h-4" />}
                title="倉庫已收貨"
                time={returnRequest.received_at}
              />
            )}
            {returnRequest.inspected_at && (
              <TimelineItem
                icon={<Package className="w-4 h-4" />}
                title="驗貨完成"
                time={returnRequest.inspected_at}
              />
            )}
            {returnRequest.closed_at && (
              <TimelineItem
                icon={<Package className="w-4 h-4" />}
                title="已結案"
                time={returnRequest.closed_at}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  time,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  description?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">
          {format(new Date(time), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
