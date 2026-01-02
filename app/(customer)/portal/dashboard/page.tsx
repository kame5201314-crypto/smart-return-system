'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, ArrowRight, Clock, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { getOrderForReturn } from '@/lib/actions/return.actions';
import { getRemainingDays } from '@/lib/validations/return.schema';
import { CHANNELS } from '@/config/constants';
import type { CustomerSession, OrderWithItems } from '@/types';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('customerSession');
    if (!stored) {
      router.push('/portal');
      return;
    }

    const sessionData = JSON.parse(stored) as CustomerSession;
    setSession(sessionData);

    // Fetch order details
    getOrderForReturn(sessionData.orderId).then((res) => {
      const result = res as { success: boolean; data?: OrderWithItems; error?: string };
      if (result.success && result.data) {
        setOrder(result.data);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  const remainingDays = getRemainingDays(session.deliveredAt);
  const channel = Object.values(CHANNELS).find((c) => c.key === session.channelSource);

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            您好，{session.customerName || '顧客'}
          </CardTitle>
          <CardDescription>訂單編號：{session.orderNumber}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{channel?.label || session.channelSource}</Badge>
            {session.isReturnEligible ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Clock className="w-3 h-3 mr-1" />
                剩餘 {remainingDays} 天可申請退貨
              </Badge>
            ) : (
              <Badge variant="destructive">已超過退貨期限</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shopee Warning */}
      {session.channelSource === 'shopee' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            蝦皮訂單請至蝦皮 App 內申請退貨。本頁僅供查詢訂單資訊。
          </AlertDescription>
        </Alert>
      )}

      {/* Order Items */}
      {order?.order_items && order.order_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">訂單商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku || 'N/A'} × {item.quantity}
                      </p>
                    </div>
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
      )}

      {/* Action Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        {session.canApplyReturn && session.isReturnEligible && (
          <Link href="/portal/apply">
            <Card className="cursor-pointer hover:border-primary transition-colors h-full">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-semibold">申請退貨</h3>
                  <p className="text-sm text-muted-foreground">
                    填寫退貨表單並上傳照片
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/portal/track/query">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">查詢退貨進度</h3>
                <p className="text-sm text-muted-foreground">
                  追蹤您的退貨申請狀態
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Logout */}
      <div className="text-center">
        <Button
          variant="ghost"
          onClick={() => {
            sessionStorage.removeItem('customerSession');
            router.push('/portal');
          }}
        >
          返回登入頁
        </Button>
      </div>
    </div>
  );
}
