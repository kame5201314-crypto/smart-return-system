'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Eye, Edit } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '@/config/constants';

interface ReturnItem {
  id: string;
  request_number: string;
  status: string;
  created_at: string;
  refund_amount: number | null;
  channel_source: string | null;
  order?: {
    customer_name: string | null;
    order_number: string;
  } | null;
  return_items?: {
    product_name: string;
  }[];
}

interface ReturnsTableProps {
  items: ReturnItem[];
}

export function ReturnsTable({ items }: ReturnsTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        沒有符合條件的退貨單
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>退貨單號</TableHead>
            <TableHead>客戶</TableHead>
            <TableHead>訂單編號</TableHead>
            <TableHead>通路</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>退款金額</TableHead>
            <TableHead>建立時間</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/returns/${item.id}`}
                  className="hover:text-primary"
                >
                  {item.request_number}
                </Link>
              </TableCell>
              <TableCell>{item.order?.customer_name || '-'}</TableCell>
              <TableCell>{item.order?.order_number || '-'}</TableCell>
              <TableCell>
                {item.channel_source && (
                  <Badge variant="outline">{item.channel_source}</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge className={RETURN_STATUS_COLORS[item.status]}>
                  {RETURN_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                {item.refund_amount
                  ? `NT$ ${item.refund_amount.toLocaleString()}`
                  : '-'}
              </TableCell>
              <TableCell>
                {format(new Date(item.created_at), 'MM/dd HH:mm', {
                  locale: zhTW,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/returns/${item.id}`}>
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/returns/inspection/${item.id}`}>
                      <Edit className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
