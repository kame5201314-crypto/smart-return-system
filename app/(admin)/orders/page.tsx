'use client';

import { useEffect, useState } from 'react';
import { Search, Package, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { createClient } from '@/lib/supabase/client';
import { CHANNEL_LIST } from '@/config/constants';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string;
  channel_source: string | null;
  total_amount: number | null;
  order_date: string | null;
  delivered_at: string | null;
  order_items?: {
    id: string;
    product_name: string;
    sku: string | null;
    quantity: number;
    unit_price: number | null;
  }[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            sku,
            quantity,
            unit_price
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Fetch orders error:', error);
      } else {
        setOrders((data as Order[]) || []);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.customer_phone.includes(search)
    );
  });

  const getChannelLabel = (channelSource: string | null) => {
    const channel = CHANNEL_LIST.find((c) => c.key === channelSource);
    return channel?.label || channelSource || '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">訂單查詢</h1>
        <p className="text-muted-foreground">查看所有訂單資訊</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>訂單列表</CardTitle>
          <CardDescription>共 {filteredOrders.length} 筆訂單</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="搜尋訂單編號、客戶名稱、手機..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">尚無訂單資料</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>訂單編號</TableHead>
                    <TableHead>客戶</TableHead>
                    <TableHead>通路</TableHead>
                    <TableHead>訂單金額</TableHead>
                    <TableHead>訂單日期</TableHead>
                    <TableHead>到貨日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{order.customer_name || '-'}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.customer_phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getChannelLabel(order.channel_source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.total_amount
                          ? `NT$ ${order.total_amount.toLocaleString()}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {order.order_date
                          ? format(new Date(order.order_date), 'yyyy/MM/dd', {
                              locale: zhTW,
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {order.delivered_at
                          ? format(new Date(order.delivered_at), 'yyyy/MM/dd', {
                              locale: zhTW,
                            })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>訂單詳情</DialogTitle>
            <DialogDescription>
              訂單編號：{selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">客戶名稱</p>
                  <p className="font-medium">{selectedOrder.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">手機號碼</p>
                  <p className="font-medium">{selectedOrder.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">通路來源</p>
                  <p className="font-medium">
                    {getChannelLabel(selectedOrder.channel_source)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">訂單金額</p>
                  <p className="font-medium">
                    {selectedOrder.total_amount
                      ? `NT$ ${selectedOrder.total_amount.toLocaleString()}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">訂單日期</p>
                  <p className="font-medium">
                    {selectedOrder.order_date
                      ? format(new Date(selectedOrder.order_date), 'yyyy/MM/dd HH:mm', {
                          locale: zhTW,
                        })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">到貨日期</p>
                  <p className="font-medium">
                    {selectedOrder.delivered_at
                      ? format(new Date(selectedOrder.delivered_at), 'yyyy/MM/dd HH:mm', {
                          locale: zhTW,
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">商品明細</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>商品名稱</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">數量</TableHead>
                        <TableHead className="text-right">單價</TableHead>
                        <TableHead className="text-right">小計</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.order_items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.sku || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {item.unit_price
                              ? `NT$ ${item.unit_price.toLocaleString()}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unit_price
                              ? `NT$ ${(item.unit_price * item.quantity).toLocaleString()}`
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
