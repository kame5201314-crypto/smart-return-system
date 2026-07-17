'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspaceAccess } from '@/components/saas/workspace-access-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  bindShopeeUnmatchedScan,
  getShopeeUnmatchedScans,
  searchShopeeReturnScanCandidates,
  type ShopeeReturnPlatform,
  type ShopeeReturnScanCandidate,
  type ShopeeUnmatchedScan,
} from '@/lib/actions/shopee-returns.actions';

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getPlatformLabel(platform: ShopeeReturnPlatform | null): string {
  if (platform === 'mall') return '商城';
  if (platform === 'other') return '其他';
  return '蝦皮';
}

export default function UnmatchedScanPage() {
  const { canCreateData } = useWorkspaceAccess();
  const [rows, setRows] = useState<ShopeeUnmatchedScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [targetRow, setTargetRow] = useState<ShopeeUnmatchedScan | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ShopeeReturnScanCandidate[]>([]);
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [binding, setBinding] = useState(false);

  const fetchRows = useCallback(async () => {
    return getShopeeUnmatchedScans(200);
  }, []);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchRows();
    if (result.success && result.data) {
      setRows(result.data);
    } else {
      toast.error(result.error || '載入未匹配清單失敗');
    }
    setIsLoading(false);
  }, [fetchRows]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      const result = await fetchRows();
      if (disposed) return;
      if (result.success && result.data) {
        setRows(result.data);
      } else {
        toast.error(result.error || '載入未匹配清單失敗');
      }
      setIsLoading(false);
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, [fetchRows]);

  const openBindDialog = (row: ShopeeUnmatchedScan) => {
    if (!canCreateData) return;
    setTargetRow(row);
    setBindDialogOpen(true);
    setSearchKeyword(row.sample_scanned_code);
    setCandidates([]);
    setSelectedReturnId('');
  };

  const runSearch = async () => {
    const keyword = searchKeyword.trim();
    if (!keyword) {
      toast.error('請輸入訂單或寄件編號');
      return;
    }

    setSearching(true);
    const result = await searchShopeeReturnScanCandidates(keyword, 20);
    if (result.success && result.data) {
      setCandidates(result.data);
      if (result.data.length === 0) {
        toast.info('找不到候選訂單');
      }
    } else {
      toast.error(result.error || '搜尋候選訂單失敗');
    }
    setSearching(false);
  };

  const bindTarget = async () => {
    if (!canCreateData) return;
    if (!targetRow) return;
    if (!selectedReturnId) {
      toast.error('請先選擇要綁定的訂單');
      return;
    }

    setBinding(true);
    const result = await bindShopeeUnmatchedScan({
      unmatchedScanId: targetRow.id,
      shopeeReturnId: selectedReturnId,
      resolvedBy: 'admin',
      note: 'manual_bind',
    });

    if (result.success) {
      toast.success('綁定成功，已移出未匹配清單');
      setBindDialogOpen(false);
      setTargetRow(null);
      await loadRows();
    } else {
      toast.error(result.error || '綁定失敗');
    }

    setBinding(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link href="/shopee-returns/scan">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回掃描工具
          </Link>
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">未匹配掃描清單</h1>
        <p className="text-sm text-muted-foreground">
          掃不到訂單的條碼會出現在這裡，可手動綁定後追蹤。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">待處理筆數：{rows.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前沒有未匹配掃描。</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">OPEN</Badge>
                    <span className="font-mono font-semibold">{row.sample_scanned_code}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    正規化碼：{row.normalized_code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    出現次數：{row.hit_count} ｜ 最近時間：{formatDateTime(row.last_seen_at)}
                  </div>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openBindDialog(row)}
                      disabled={!canCreateData}
                    >
                      <Link2 className="w-4 h-4 mr-1" />
                      手動綁定訂單
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手動綁定未匹配掃描</DialogTitle>
            <DialogDescription>
              先搜尋候選訂單，再選擇一筆完成綁定。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>原始掃描值</Label>
              <Input value={targetRow?.sample_scanned_code || ''} disabled />
            </div>
            <div className="space-y-1">
              <Label>搜尋關鍵字（訂單編號 / 寄件編號）</Label>
              <div className="flex gap-2">
                <Input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="例如 260130D0X7N6FH 或 TW263..."
                />
                <Button type="button" onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>選擇候選訂單</Label>
              <Select value={selectedReturnId} onValueChange={setSelectedReturnId}>
                <SelectTrigger>
                  <SelectValue placeholder="請先搜尋，再選擇訂單" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.order_number}｜{candidate.tracking_number || '-'}｜{getPlatformLabel(candidate.platform)}｜{candidate.is_scanned ? '已掃描' : '未掃描'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBindDialogOpen(false)} disabled={binding}>
              取消
            </Button>
            <Button onClick={bindTarget} disabled={binding || !canCreateData}>
              {binding ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />綁定中...</> : '確認綁定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
