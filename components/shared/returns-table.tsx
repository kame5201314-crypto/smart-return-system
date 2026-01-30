'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RETURN_STATUS_LABELS, RETURN_STATUS_COLORS, CHANNEL_LIST } from '@/config/constants';
import { deleteReturnRequest } from '@/lib/actions/return.actions';
import { getCurrentUser } from '@/lib/actions/auth';

// Helper to get channel label in Chinese
function getChannelLabel(channelSource: string | null): string {
  if (!channelSource) return '-';
  const channel = CHANNEL_LIST.find(c => c.key === channelSource);
  return channel?.label || channelSource;
}

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

export type SortField = 'status' | 'created_at' | 'channel_source' | null;
export type SortDirection = 'asc' | 'desc';

interface ReturnsTableProps {
  items: ReturnItem[];
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
  onRefresh?: () => void;
}

export function ReturnsTable({ items, sortField, sortDirection, onSort, onRefresh }: ReturnsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ReturnItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;

    try {
      setBatchDeleting(true);
      const user = await getCurrentUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const id of selectedIds) {
        const result = await deleteReturnRequest(id, user.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success(`已刪除 ${successCount} 筆退貨單`);
      } else {
        toast.warning(`成功 ${successCount} 筆，失敗 ${failCount} 筆`);
      }

      setSelectedIds(new Set());
      onRefresh?.();
    } catch {
      toast.error('批量刪除失敗');
    } finally {
      setBatchDeleting(false);
      setBatchDeleteDialogOpen(false);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;

    try {
      setDeleting(true);
      const user = await getCurrentUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      const result = await deleteReturnRequest(deletingItem.id, user.id);
      if (result.success) {
        toast.success('退貨單已刪除');
        onRefresh?.();
      } else {
        toast.error(result.error || '刪除失敗');
      }
    } catch {
      toast.error('刪除失敗');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  }

  function openDeleteDialog(item: ReturnItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }
  // Helper to render sort icon
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  }

  // Sortable header component
  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <button
        onClick={() => onSort?.(field)}
        className="flex items-center hover:text-primary transition-colors cursor-pointer"
      >
        {children}
        <SortIcon field={field} />
      </button>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        沒有符合條件的退貨單
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted border-b">
          <span className="text-sm text-muted-foreground">已選 {selectedIds.size} 筆</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBatchDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            批量刪除
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>退貨單號</TableHead>
            <TableHead>客戶</TableHead>
            <TableHead>訂單編號</TableHead>
            <TableHead>
              <SortableHeader field="channel_source">通路</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="status">狀態</SortableHeader>
            </TableHead>
            <TableHead>退款金額</TableHead>
            <TableHead>
              <SortableHeader field="created_at">建立時間</SortableHeader>
            </TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-state={selectedIds.has(item.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
              </TableCell>
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
                <Badge variant="outline">{getChannelLabel(item.channel_source)}</Badge>
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
                  <Button variant="ghost" size="icon" asChild title="查看詳情">
                    <Link href={`/returns/${item.id}`}>
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild title="編輯資訊">
                    <Link href={`/returns/${item.id}?edit=true`}>
                      <Edit className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openDeleteDialog(item)}
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除退貨單 {deletingItem?.request_number} 嗎？此操作無法復原，相關的退貨商品、照片和驗貨紀錄都會一併刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認批量刪除</DialogTitle>
            <DialogDescription>
              確定要刪除所選的 {selectedIds.size} 筆退貨單嗎？此操作無法復原，相關的退貨商品、照片和驗貨紀錄都會一併刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)} disabled={batchDeleting}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              {batchDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  刪除中...
                </>
              ) : (
                `確認刪除 ${selectedIds.size} 筆`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
