'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Keyboard, Loader2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspaceAccess } from '@/components/saas/workspace-access-provider';
import {
  getRecentScannedPickupRecords,
  scanPickupRecord,
  type PickupRecord,
} from '@/lib/actions/pickup.actions';

const SCANNER_ELEMENT_ID = 'pickup-record-scanner';

type Html5QrcodeScanner = {
  start: (
    cameraConfig: { facingMode: 'environment' | 'user' } | string,
    config: Record<string, unknown>,
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => Promise<void>;
};

interface PickupScanResult {
  id: string;
  orderNumber: string;
  trackingNumber: string | null;
  platform: string;
  logisticsProvider: string;
  scannedAt: string | null;
  code: string;
  alreadyScanned: boolean;
  matchedCount: number;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
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

function mapRecordToScanResult(record: PickupRecord): PickupScanResult {
  return {
    id: record.id,
    orderNumber: record.order_number,
    trackingNumber: record.tracking_number,
    platform: record.platform || '-',
    logisticsProvider: record.logistics_provider || '-',
    scannedAt: record.scanned_at,
    code: record.tracking_number || record.order_number,
    alreadyScanned: true,
    matchedCount: 1,
  };
}

export default function PickupScanPage() {
  const { canCreateData } = useWorkspaceAccess();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const autoStartRef = useRef(false);
  const processingRef = useRef(false);
  const dedupeRef = useRef<{ code: string; timestamp: number }>({
    code: '',
    timestamp: 0,
  });

  const [isStarting, setIsStarting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [latestScan, setLatestScan] = useState<PickupScanResult | null>(null);
  const [history, setHistory] = useState<PickupScanResult[]>([]);

  const loadHistory = useCallback(async () => {
    const result = await getRecentScannedPickupRecords(20);
    if (!result.success || !result.data) {
      if (result.error) toast.error(result.error);
      return;
    }

    const mapped = result.data.map(mapRecordToScanResult);
    setHistory(mapped);
    setLatestScan(mapped[0] || null);
  }, []);

  const handleCode = useCallback(async (rawCode: string) => {
    if (!canCreateData) return;
    const code = rawCode.trim();
    if (!code) return;

    const now = Date.now();
    if (
      dedupeRef.current.code === code
      && now - dedupeRef.current.timestamp < 1200
    ) {
      return;
    }
    dedupeRef.current = { code, timestamp: now };

    if (processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);

    const result = await scanPickupRecord(code);
    if (result.success && result.data) {
      const { matched, alreadyScanned, matchedCount = 1 } = result.data;
      const nextItem: PickupScanResult = {
        id: matched.id,
        orderNumber: matched.order_number,
        trackingNumber: matched.tracking_number,
        platform: matched.platform || '-',
        logisticsProvider: matched.logistics_provider || '-',
        scannedAt: matched.scanned_at,
        code,
        alreadyScanned,
        matchedCount,
      };

      setLatestScan(nextItem);
      setHistory((prev) => [nextItem, ...prev.filter((item) => item.id !== matched.id)].slice(0, 20));

      if (alreadyScanned) {
        toast.info(`已掃描過：${matched.order_number}`);
      } else {
        toast.success(`掃描成功：${matched.order_number}${matchedCount > 1 ? `（匹配 ${matchedCount} 筆）` : ''}`);
      }
    } else {
      toast.error(result.error || '掃描失敗');
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [canCreateData]);

  const startScanner = useCallback(async () => {
    if (isStarting || isActive || !canCreateData) return;

    setIsStarting(true);
    setCameraError('');

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(
          SCANNER_ELEMENT_ID
        ) as unknown as Html5QrcodeScanner;
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          rememberLastUsedCamera: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        },
        (decodedText: string) => {
          void handleCode(decodedText);
        },
        () => {
          // Ignore frame-level decode failures.
        }
      );

      setIsActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCameraError(message);
      toast.error('無法啟動相機，請確認相機權限');
    } finally {
      setIsStarting(false);
    }
  }, [canCreateData, handleCode, isActive, isStarting]);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) {
      setIsActive(false);
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch {
      // Ignore stop errors from already-stopped scanner.
    }

    try {
      await scannerRef.current.clear();
    } catch {
      // Ignore clear errors from detached scanner DOM.
    }

    scannerRef.current = null;
    setIsActive(false);
  }, []);

  const submitManualCode = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualCode.trim()) {
      toast.error('請輸入條碼內容');
      return;
    }

    await handleCode(manualCode);
    setManualCode('');
  }, [handleCode, manualCode]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    if (canCreateData) void startScanner();
  }, [canCreateData, startScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link href="/pickup">
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回派車收件
          </Link>
        </Button>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <ScanLine className="w-6 h-6" />
          派車收件掃描工具
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">相機掃描</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-black/5 overflow-hidden">
            <div id={SCANNER_ELEMENT_ID} className="w-full min-h-[260px] [&_video]:w-full [&_video]:h-[260px] [&_video]:object-cover" />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isStarting && (
              <Badge className="bg-indigo-100 text-indigo-800">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                啟動相機中
              </Badge>
            )}
            {isActive && !isStarting && (
              <Badge className="bg-green-100 text-green-800">掃描中</Badge>
            )}
            {isProcessing && (
              <Badge className="bg-blue-100 text-blue-800">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                比對中
              </Badge>
            )}
          </div>

          {cameraError && (
            <div className="text-xs text-red-600">
              相機錯誤：{cameraError}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            手動輸入條碼
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitManualCode} className="space-y-2">
            <Label htmlFor="manual-code">條碼內容</Label>
            <Input
              id="manual-code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="例如 210-372-2821 或 9074-5843-8256"
              disabled={!canCreateData}
            />
            <Button type="submit" disabled={isProcessing || !canCreateData}>
              送出比對
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">最新掃描結果</CardTitle>
        </CardHeader>
        <CardContent>
          {!latestScan ? (
            <div className="text-sm text-muted-foreground">尚未有掃描結果</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-100 text-slate-800">{latestScan.platform}</Badge>
                <Badge className={latestScan.alreadyScanned ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                  {latestScan.alreadyScanned ? '已掃描過' : '新掃描'}
                </Badge>
              </div>
              <div className="text-lg font-semibold break-all">{latestScan.orderNumber}</div>
              <div className="text-sm text-muted-foreground">
                物流單號：{latestScan.trackingNumber || '-'}
              </div>
              <div className="text-sm text-muted-foreground">
                掃描值：{latestScan.code}
              </div>
              <div className="text-sm text-muted-foreground">
                物流商：{latestScan.logisticsProvider} ｜ 掃描時間：{formatDateTime(latestScan.scannedAt)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            最近掃描紀錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground">尚無紀錄</div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={`${item.id}-${item.scannedAt || item.code}`} className="rounded-md border p-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-800">{item.platform}</Badge>
                    <Badge className={item.alreadyScanned ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                      {item.alreadyScanned ? '已掃描過' : '新掃描'}
                    </Badge>
                  </div>
                  <div className="font-medium break-all">{item.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    物流單號：{item.trackingNumber || '-'} ｜ 掃描時間：{formatDateTime(item.scannedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
