'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * UI-only 確認對話框。所有危險操作（變更角色、停用成員、撤銷／重送邀請）
 * 都透過此元件二次確認。送出中會鎖定按鈕與關閉行為，避免重複觸發。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
