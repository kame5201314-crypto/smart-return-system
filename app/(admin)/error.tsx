'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="size-8 text-amber-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">頁面載入失敗</h2>
        <p className="mt-2 text-sm text-gray-600">
          發生未預期的錯誤，請稍後再試。若問題持續，請聯絡管理員。
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-gray-400">
            error id: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            重新載入
          </Button>
          <Button variant="outline" onClick={() => window.location.assign('/analytics')}>
            回到總覽
          </Button>
        </div>
      </div>
    </div>
  );
}
