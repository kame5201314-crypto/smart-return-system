'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Keyboard,
  Loader2,
  ScanLine,
  Smartphone,
  SwitchCamera,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scanShopeeReturn } from '@/lib/actions/shopee-returns.actions';

const SCANNER_ELEMENT_ID = 'shopee-return-scanner';

type ScannerFacingMode = 'environment' | 'user';

type Html5QrcodeScanner = {
  start: (
    cameraConfig: { facingMode: ScannerFacingMode } | string,
    config: Record<string, unknown>,
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => Promise<void>;
};

interface ScanHistoryItem {
  id: string;
  orderNumber: string;
  platform: 'shopee' | 'mall' | null;
  trackingNumber: string | null;
  scannedAt: string | null;
  code: string;
  alreadyScanned: boolean;
  matchedCount: number;
  updatedCount: number;
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

function getPlatformLabel(platform: 'shopee' | 'mall' | null): string {
  return platform === 'mall' ? '商城' : '蝦皮';
}

export default function ShopeeReturnScanPage() {
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
  const [facingMode, setFacingMode] = useState<ScannerFacingMode>('environment');
  const [manualCode, setManualCode] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [latestScan, setLatestScan] = useState<ScanHistoryItem | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  const handleCode = useCallback(async (rawCode: string) => {
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

    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setLastCode(code);

    const result = await scanShopeeReturn(code);
    if (result.success && result.data) {
      const {
        matched,
        alreadyScanned,
        matchedCount = 1,
        updatedCount = alreadyScanned ? 0 : 1,
      } = result.data;

      const historyItem: ScanHistoryItem = {
        id: matched.id,
        orderNumber: matched.order_number,
        platform: matched.platform,
        trackingNumber: matched.tracking_number,
        scannedAt: matched.scanned_at,
        code,
        alreadyScanned,
        matchedCount,
        updatedCount,
      };
      setLatestScan(historyItem);

      setHistory((prev) => [
        historyItem,
        ...prev.filter((item) => item.id !== matched.id),
      ].slice(0, 20));

      const platformLabel = getPlatformLabel(matched.platform);
      if (alreadyScanned) {
        toast.info(`已掃描過：${matched.order_number}（${platformLabel}）`);
      } else {
        const countText = matchedCount > 1 ? `（同單共 ${matchedCount} 筆）` : '';
        toast.success(`掃描成功：${matched.order_number}（${platformLabel}）${countText}`);
      }
    } else {
      toast.error(result.error || '掃描失敗');
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, []);

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

  const startScanner = useCallback(async () => {
    if (isStarting || isActive) return;

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
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          rememberLastUsedCamera: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
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
      toast.error('相機啟動失敗，請確認瀏覽器相機權限');
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, handleCode, isActive, isStarting]);

  const switchCamera = useCallback(async () => {
    const nextFacing: ScannerFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);

    if (isActive) {
      await stopScanner();
      setTimeout(() => {
        void startScanner();
      }, 100);
    }
  }, [facingMode, isActive, startScanner, stopScanner]);

  const submitManualCode = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualCode.trim()) {
      toast.error('請輸入條碼內容');
      return;
    }

    await handleCode(manualCode);
    setManualCode('');
  }, [handleCode, manualCode]);

  useEffect(() => {
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    void startScanner();
  }, [startScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="px-0">
            <Link href="/shopee-returns">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回蝦皮退貨
            </Link>
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <ScanLine className="w-6 h-6" />
              條碼掃描工具
            </h1>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            相機掃描
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-black/5 overflow-hidden">
            <div id={SCANNER_ELEMENT_ID} className="w-full min-h-[260px] [&_video]:w-full [&_video]:h-[260px] [&_video]:object-cover" />
          </div>

          <div className="flex flex-wrap gap-2">
            {!isActive && (
              <Button onClick={() => void startScanner()} disabled={isStarting}>
                {isStarting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-1" />
                )}
                開始掃描
              </Button>
            )}

            <Button variant="outline" onClick={() => void switchCamera()} disabled={isStarting}>
              <SwitchCamera className="w-4 h-4 mr-1" />
              切換鏡頭
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isProcessing && (
              <Badge className="bg-indigo-100 text-indigo-800">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                比對中
              </Badge>
            )}
            {lastCode && (
              <span className="font-mono font-medium">最近掃描：{lastCode}</span>
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
        <CardHeader>
          <CardTitle className="text-base">最新掃描結果</CardTitle>
        </CardHeader>
        <CardContent>
          {!latestScan ? (
            <p className="text-sm text-muted-foreground">尚未掃描</p>
          ) : (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-sm px-2 py-0.5">
                  {getPlatformLabel(latestScan.platform)}
                </Badge>
                <Badge
                  className={`text-sm px-2 py-0.5 ${latestScan.alreadyScanned ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                >
                  {latestScan.alreadyScanned ? '已掃描過' : '新掃描'}
                </Badge>
                {latestScan.matchedCount > 1 && (
                  <Badge variant="outline" className="text-sm px-2 py-0.5">
                    同單 {latestScan.matchedCount} 筆
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/shopee-returns/${latestScan.id}`}
                  className="font-mono text-lg font-semibold underline underline-offset-2 hover:text-primary"
                >
                  {latestScan.orderNumber}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                掃描值：{latestScan.code}
              </div>
              <div className="text-xs text-muted-foreground">
                寄件編號：{latestScan.trackingNumber || '-'} ｜ 寫入筆數：{latestScan.updatedCount} ｜ 掃描時間：{formatDateTime(latestScan.scannedAt)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            手動輸入條碼
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitManualCode} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="manual-code">條碼內容</Label>
              <Input
                id="manual-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="例如 260130D0X7N6FH 或 TW2631984572320"
                className="font-mono"
              />
            </div>
            <Button type="submit" className="sm:self-end" disabled={isProcessing}>
              送出比對
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近掃描紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無掃描紀錄</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={`${item.id}-${item.scannedAt || item.code}`}
                  className="rounded-lg border p-3 space-y-1 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/shopee-returns/${item.id}`}
                      className="font-mono underline underline-offset-2 hover:text-primary"
                    >
                      {item.orderNumber}
                    </Link>
                    <Badge variant="outline">
                      {getPlatformLabel(item.platform)}
                    </Badge>
                    <Badge className={item.alreadyScanned ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
                      {item.alreadyScanned ? '已掃描過' : '新掃描'}
                    </Badge>
                    {item.matchedCount > 1 && (
                      <Badge variant="outline">同單 {item.matchedCount} 筆</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    掃描值：{item.code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    寄件編號：{item.trackingNumber || '-'} ｜ 寫入筆數：{item.updatedCount} ｜ 掃描時間：{formatDateTime(item.scannedAt)}
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
