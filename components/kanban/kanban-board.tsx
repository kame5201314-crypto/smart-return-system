'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KANBAN_COLUMNS } from '@/config/constants';

interface KanbanItem {
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

interface KanbanBoardProps {
  items: KanbanItem[];
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function KanbanBoard({ items, onStatusChange }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 pb-4">
      {KANBAN_COLUMNS.map((column) => {
        // Filter items by statuses array (supports multiple statuses per column)
        const columnStatuses = (column.statuses || [column.id]) as string[];
        const columnItems = items.filter((item) => columnStatuses.includes(item.status));

        return (
          <div
            key={column.id}
            className="flex-1 min-w-0 bg-gray-50 rounded-lg"
          >
            {/* Column header */}
            <div className={`p-3 border-l-4 ${column.color} bg-white rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{column.title}</h3>
                <Badge variant="secondary">{columnItems.length}</Badge>
              </div>
            </div>

            {/* Column content */}
            <div className="p-2 space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto">
              {columnItems.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  無退貨單
                </p>
              ) : (
                columnItems.map((item) => (
                  <KanbanCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ item }: { item: KanbanItem }) {
  const productSummary =
    item.return_items && item.return_items.length > 0
      ? item.return_items.map((i) => i.product_name).join(', ')
      : '無商品資訊';

  return (
    <Link href={`/returns/${item.id}`} className="block">
      <Card className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-sm">{item.request_number}</p>
              <p className="text-xs text-muted-foreground">
                {item.order?.customer_name || '未知客戶'}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {productSummary}
          </p>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(new Date(item.created_at), 'MM/dd', { locale: zhTW })}
            </div>
            {item.channel_source && (
              <Badge variant="outline" className="text-xs">
                {item.channel_source}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
