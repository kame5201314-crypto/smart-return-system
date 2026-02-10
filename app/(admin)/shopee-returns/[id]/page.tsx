'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { getShopeeReturnById, type ShopeeReturn } from '@/lib/actions/shopee-returns.actions';

function getPlatformLabel(platform: ShopeeReturn['platform']): string {
  if (platform === 'mall') return '商城';
  if (platform === 'shopee') return '蝦皮';
  return '-';
}

export default function ShopeeReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string | undefined;

  const [record, setRecord] = useState<ShopeeReturn | null>(null);
  const [loading, setLoading] = useState(true);

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

  const statusBadges = useMemo(() => {
    if (!record) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {record.is_scanned ? (
          <Badge className="bg-blue-100 text-blue-800">已入庫</Badge>
        ) : (
          <Badge variant="outline">未入庫</Badge>
        )}
        {record.is_processed ? (
          <Badge className="bg-green-100 text-green-800">已處理</Badge>
        ) : (
          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
            未處理
          </Badge>
        )}
        {record.is_printed ? (
          <Badge className="bg-purple-100 text-purple-800">已列印</Badge>
        ) : (
          <Badge variant="outline">未列印</Badge>
        )}
        {record.color_tag === 'yellow' && (
          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">標記: 黃</Badge>
        )}
        {record.color_tag === 'red' && (
          <Badge className="bg-red-100 text-red-800 border border-red-300">標記: 紅</Badge>
        )}
      </div>
    );
  }, [record]);

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
            <p className="text-sm text-muted-foreground">查看買家退款金額、規格、貨號等資訊</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">基本資訊</CardTitle>
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
              {statusBadges}

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
              <div className="md:col-span-2">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
